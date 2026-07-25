import React from 'react';
import * as THREE from 'three';
import { box, cyl, mergedBoxes } from '../Stage';
import { BurgerShop } from '../BurgerShop';
import { HotDogStand } from '../HotDogStand';
import { SodaStand } from '../SodaStand';
import { CottonCandyStand } from '../CottonCandyStand';
import { BalloonStand } from '../BalloonStand';
import { buildSceneryAnimated } from '../SceneryPack';
import {
  CELL,
  makeSetPiecePlan,
  plantedRadius,
  setPiece,
  setPieceBench,
  setPieceLamp,
  setPieceRegistry,
  setPieceSpan,
} from '../SetPieceKit';
import type { SetPiecePlan, SetPieceProps, XZ } from '../SetPieceKit';

// ---------------------------------------------------------------------------
// Bazaar — the MACRO SET-PIECE for a park's shopping row: a paved market
// courtyard with 3-6 CATALOG STALLS facing a central aisle, striped canopies
// and bunting overhead, lantern lamps and festival spans at both entrances,
// benches + bins on the verges, its own spine path and TWO end ports.
//
// Why it exists: hand-placed stalls kept landing OFF the traffic flow (a shop
// whose serving front faced a hedge sells nothing, and an anchor more than
// ~1 u from a walkable edge attaches nowhere). Here the aisle IS a street in
// the park's shared graph and every stall is planted 1.2 u off it, serving
// front toward it, registered with the GameManager. That cannot be got wrong.
//
// Geometry (local frame, aisle along local x; `rotation` turns it in quarter
// turns). T = the odd tile length that fits the stalls with a free end tile
// each side (k odd → k+2, k even → k+3):
//
//    port W ·─┬─────────────── aisle (z = 0) ───────────────┬─· port E
//             │  [stall]     [stall]     [stall]            │
//     z=+1.2  │        [stall]     [stall]                  │   ← rows stagger
//     z=−1.2  └────────────────────────────────────────────-┘      by 1.2
//
//   half = T × 0.6 (pad + OBB half-length) · pad depth 3 tiles (± 1.8)
//   ports at ± (half + 0.6) — one lattice cell OUTSIDE the footprint
//   stall anchors ± 1.2 off the aisle: the manager's serving attach point
//   (anchor + 0.72 × front) lands 0.48 from the aisle centreline, ON the path
//
// Deterministic (hashed sine only); everything settles through `park.floorAt`
// (courtyard paving inside the pad, terrain on the verges).
// ---------------------------------------------------------------------------

export type BazaarStallKind = 'burger' | 'hotDog' | 'soda' | 'cottonCandy' | 'balloon';

const STALL_COMPONENT: Record<BazaarStallKind, React.FC<Record<string, unknown>>> = {
  burger: BurgerShop as unknown as React.FC<Record<string, unknown>>,
  hotDog: HotDogStand as unknown as React.FC<Record<string, unknown>>,
  soda: SodaStand as unknown as React.FC<Record<string, unknown>>,
  cottonCandy: CottonCandyStand as unknown as React.FC<Record<string, unknown>>,
  balloon: BalloonStand as unknown as React.FC<Record<string, unknown>>,
};
const STALL_LABEL: Record<BazaarStallKind, string> = {
  burger: 'Burger Bar',
  hotDog: 'Hot Dogs',
  soda: 'Soda Stand',
  cottonCandy: 'Cotton Candy',
  balloon: 'Balloon Stand',
};

const CANOPY_CREAM = 0xe8dfc8;
const CANOPY_RED = 0xa8443c;
const BUNT_NAVY = 0x2f4a6d;
const CABLE = 0x26262c;

export interface BazaarPlanInput {
  /** unique piece id — port refs read `'<id>:W'` / `'<id>:E'` */
  id: string;
  title?: string;
  /** the courtyard centre cell (snapped to the 1.2 lattice) */
  position: XZ;
  /** quarter-turn yaw (default 0 — aisle running east/west) */
  rotation?: number;
  /** 3-6 catalog stalls, laid alternately along the two rows
   *  (default `['burger', 'soda', 'cottonCandy', 'balloon']`) */
  stalls?: BazaarStallKind[];
  /** striped canopies strung across the aisle (default true) */
  canopies?: boolean;
  /** pennant bunting down both rows (default true) */
  bunting?: boolean;
  /** festival spans across both entrances (default true) */
  stringLights?: boolean;
  /** benches on the entrance verges (default true) */
  benches?: boolean;
  /** keep the stalls where the plan put them — the set-piece is ONE unit, so
   *  the settle-time corridor resolver must not shuffle a single shop out of
   *  the row (default true) */
  pinStalls?: boolean;
  /** register the footprint (default true — the bazaar OWNS its land) */
  reserve?: boolean;
  seed?: number;
}

export interface BazaarStallSlot {
  kind: BazaarStallKind;
  name: string;
  /** world anchor cell */
  at: XZ;
  /** world yaw — serving front (local +z of the stall) faces the aisle */
  yaw: number;
  /** which row: +1 = the piece's +z side */
  side: 1 | -1;
}

export interface BazaarPlan extends SetPiecePlan {
  kind: 'Bazaar';
  /** aisle length in tiles (odd) */
  tiles: number;
  /** pad half-length along the aisle */
  half: number;
  slots: BazaarStallSlot[];
  lampSpots: { at: XZ; light: boolean }[];
  /** [a, b] lamp-hook pairs for the entrance spans */
  spans: [XZ, XZ][];
  /** [a, b] lamp-hook pairs for the pennant bunting runs */
  bunting: [XZ, XZ][];
  /** canopy strips: world centre + the aisle-crossing yaw */
  canopies: { at: XZ; yaw: number }[];
  benchSpots: { at: XZ; yaw: number }[];
  props: { at: XZ; name: string; yaw: number; scale: number; seed: number }[];
  pinStalls: boolean;
}

/**
 * Plan a bazaar — PURE. Returns the courtyard's paving rect, spine nodes, two
 * end ports, every stall anchor/yaw/name, the bins and every dressing anchor,
 * all in world coordinates. Feed it to `buildParkNet({ pieces: [plan] })` and
 * to `<Bazaar plan={plan} />`.
 */
export function bazaarPlan(input: BazaarPlanInput): BazaarPlan {
  const id = input.id;
  const title = input.title ?? id.replace(/(^|[\s-_])(\w)/g, (_m, a, b) => `${a ? ' ' : ''}${b.toUpperCase()}`).trim();
  const wanted = input.stalls ?? ['burger', 'soda', 'cottonCandy', 'balloon'];
  const stalls = wanted.slice(0, 6);
  if (stalls.length < 3) {
    console.info(`[Bazaar ${id}] a bazaar wants 3-6 stalls (got ${stalls.length}) — padding with a balloon stand`);
    while (stalls.length < 3) stalls.push('balloon');
  }
  const k = stalls.length;
  // STALL PITCH 2.4 (two lattice cells) along the aisle: the catalog shops
  // carry big signature props (the burger ball, the candy cloud), so
  // same-side neighbours need 4.8 u and the staggered opposite row 2.4 u.
  // Aisle length 2k + 1 tiles keeps a free end tile at both entrances.
  const tiles = 2 * k + 1;
  const half = tiles * 0.6;
  const xEnd = half - 0.6; // end-tile centre
  const stub = half + 0.6; // port cell — one lattice cell outside the pad
  const seed = input.seed ?? 1;

  // ---- spine: one node per aisle tile + a stub node at each end -----------
  const localNodes: XZ[] = [];
  const localEdges: [number, number][] = [];
  for (let i = 0; i < tiles; i += 1) localNodes.push([-xEnd + i * CELL, 0]);
  for (let i = 1; i < tiles; i += 1) localEdges.push([i - 1, i]);
  const wNode = localNodes.length;
  localNodes.push([-stub, 0]);
  localEdges.push([0, wNode]);
  const eNode = localNodes.length;
  localNodes.push([stub, 0]);
  localEdges.push([tiles - 1, eNode]);

  // ---- stall slots: staggered rows, serving fronts toward the aisle -------
  const used = new Map<BazaarStallKind, number>();
  const localSlots = stalls.map((kind, j) => {
    const side: 1 | -1 = j % 2 === 0 ? 1 : -1;
    const at: XZ = [(j - (k - 1) / 2) * (2 * CELL), side * CELL];
    const n = (used.get(kind) ?? 0) + 1;
    used.set(kind, n);
    const name = `${title} ${STALL_LABEL[kind]}${n > 1 ? ` ${n}` : ''}`;
    // the serving front is the stall's local +z; aim it at the aisle
    return { kind, name, at, side, localYaw: side === 1 ? Math.PI : 0 };
  });

  const base = makeSetPiecePlan({
    kind: 'Bazaar',
    id,
    title,
    position: input.position,
    rotation: input.rotation ?? 0,
    localNodes,
    localEdges,
    localPorts: [
      { name: 'W', node: wNode, dir: [-1, 0] },
      { name: 'E', node: eNode, dir: [1, 0] },
    ],
    localPlazas: [[0, 0, tiles * CELL, 3 * CELL]],
    localBins: [
      [-stub, -CELL],
      [stub, CELL],
    ],
    half: [half, 1.8],
    reserve: input.reserve ?? true,
    localCells: [
      [-stub, CELL],
      [stub, -CELL],
      [-stub, 2 * CELL],
      [stub, -2 * CELL],
    ],
    keyData: [stalls.join(','), input.canopies !== false, input.bunting !== false, input.stringLights !== false, input.benches !== false, seed],
  });

  const slots: BazaarStallSlot[] = localSlots.map((s) => ({
    kind: s.kind,
    name: s.name,
    at: base.toWorld(s.at),
    yaw: base.toWorldYaw(s.localYaw),
    side: s.side,
  }));

  // lamps in the two free end tiles, one each side of the aisle
  const lampLocals: XZ[] = [
    [-xEnd, CELL],
    [-xEnd, -CELL],
    [xEnd, CELL],
    [xEnd, -CELL],
  ];
  const lampSpots = lampLocals.map((l, i) => ({ at: base.toWorld(l), light: i === 0 || i === 3 }));
  const spans: [XZ, XZ][] =
    input.stringLights === false
      ? []
      : [
          [lampSpots[0].at, lampSpots[1].at],
          [lampSpots[2].at, lampSpots[3].at],
        ];
  const bunting: [XZ, XZ][] =
    input.bunting === false
      ? []
      : [
          [lampSpots[0].at, lampSpots[2].at],
          [lampSpots[1].at, lampSpots[3].at],
        ];
  // canopies straddle the aisle in the GAPS between consecutive stalls
  const canopies =
    input.canopies === false
      ? []
      : localSlots.slice(0, -1).map((s) => ({
          at: base.toWorld([s.at[0] + CELL, 0]),
          yaw: base.toWorldYaw(Math.PI / 2), // the strip runs ACROSS the aisle
        }));
  const benchSpots =
    input.benches === false
      ? []
      : ([
          [-stub, CELL],
          [stub, -CELL],
        ] as XZ[]).map((l, i) => ({
          at: base.toWorld(l),
          // benches look along the aisle, back to the grass
          yaw: base.toWorldYaw(i === 0 ? -Math.PI / 2 : Math.PI / 2),
        }));

  // entrance markers on the grass verges, just outside the footprint
  const props: BazaarPlan['props'] = [
    { at: base.toWorld([-stub, 2 * CELL]), name: 'signpost', yaw: base.toWorldYaw(Math.PI / 2), scale: 1, seed: seed + 2 },
    { at: base.toWorld([stub, -2 * CELL]), name: 'flagpole', yaw: base.toWorldYaw(-Math.PI / 2), scale: 1, seed: seed + 3 },
  ];

  return {
    ...base,
    kind: 'Bazaar',
    props,
    tiles,
    half,
    slots,
    lampSpots,
    spans,
    bunting,
    canopies,
    benchSpots,
    pinStalls: input.pinStalls !== false,
  };
}

// ---- dressing builders ----------------------------------------------------

/** a striped market canopy strung across the aisle (no posts — it hangs from
 *  the bunting lines, so nothing stands in the walkway) */
function canopyStrip(t: typeof THREE, at: XZ, y: number, yaw: number): THREE.Group {
  const g = new t.Group();
  const W = 2.5; // across the aisle
  const D = 0.5; // along the aisle
  const cream: { dims: [number, number, number]; pos: [number, number, number]; repeat: [number, number] }[] = [];
  const red: typeof cream = [];
  const STRIPES = 10;
  for (let i = 0; i < STRIPES; i += 1) {
    const w = W / STRIPES;
    const x = -W / 2 + (i + 0.5) * w;
    // shallow sag: the fabric dips 0.06 at mid-span
    const sag = 0.06 * (1 - Math.abs((i + 0.5) / STRIPES - 0.5) * 2);
    // cream sailcloth with two red edge courses — RCT2 awning language, and
    // far calmer over an aisle whose stalls already carry striped roofs
    (i === 0 || i === STRIPES - 1 ? red : cream).push({ dims: [w, 0.035, D], pos: [x, -sag, 0], repeat: [1, 2] });
  }
  g.add(mergedBoxes(t, cream, CANOPY_CREAM, { tex: 'fabric', rough: 0.8 }));
  g.add(mergedBoxes(t, red, CANOPY_RED, { tex: 'fabric', rough: 0.8 }));
  // scalloped hem + the two carrying cables
  g.add(box(t, [W, 0.05, 0.05], CANOPY_RED, [0, -0.09, D / 2], { tex: 'fabric', repeat: [8, 1], rough: 0.85 }));
  g.add(box(t, [W, 0.05, 0.05], CANOPY_RED, [0, -0.09, -D / 2], { tex: 'fabric', repeat: [8, 1], rough: 0.85 }));
  [-D / 2, D / 2].forEach((z) => g.add(cyl(t, 0.012, 0.012, W, CABLE, [0, 0.04, z], { rough: 0.9, seg: 5, rotZ: Math.PI / 2 })));
  g.position.set(at[0], y, at[1]);
  g.rotation.y = yaw;
  return g;
}

/** a pennant garland between two hooks — flags only, no lights (day flavour
 *  that costs nothing against the park's light budget) */
function buntingLine(t: typeof THREE, from: [number, number, number], to: [number, number, number], seed: number): THREE.Group {
  const g = new t.Group();
  const cols = [CANOPY_CREAM, CANOPY_RED, BUNT_NAVY, 0xd8b54a];
  const dist = Math.hypot(to[0] - from[0], to[2] - from[2]);
  const n = Math.max(6, Math.min(16, Math.round(dist / 0.55)));
  const sag = 0.22;
  const at = (u: number): [number, number, number] => [
    from[0] + (to[0] - from[0]) * u,
    from[1] + (to[1] - from[1]) * u - sag * 4 * u * (1 - u),
    from[2] + (to[2] - from[2]) * u,
  ];
  const yaw = Math.atan2(to[0] - from[0], to[2] - from[2]);
  const cable: { dims: [number, number, number]; pos: [number, number, number]; rotX?: number; repeat: [number, number] }[] = [];
  for (let i = 0; i < n; i += 1) {
    const a = at(i / n);
    const b = at((i + 1) / n);
    const seg = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    const pitch = Math.atan2(b[1] - a[1], Math.hypot(b[0] - a[0], b[2] - a[2]));
    cable.push({
      dims: [0.02, 0.02, seg],
      pos: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2],
      rotX: -pitch,
      repeat: [1, 1],
    });
  }
  // one merged cable (rotated boxes) then the flags, one merge per colour
  const cableSpecs = cable.map((c) => ({ dims: c.dims, pos: c.pos, rotX: c.rotX, rotY: yaw, repeat: c.repeat }));
  g.add(mergedBoxes(t, cableSpecs, CABLE, { rough: 0.9 }));
  const buckets: Record<number, { dims: [number, number, number]; pos: [number, number, number]; rotY: number; rotZ: number; repeat: [number, number] }[]> = {};
  for (let i = 0; i < n; i += 1) {
    const p = at((i + 0.5) / n);
    const col = cols[(i + Math.round(seed)) % cols.length];
    (buckets[col] ??= []).push({
      dims: [0.015, 0.24, 0.19],
      pos: [p[0], p[1] - 0.13, p[2]],
      rotY: yaw,
      rotZ: 0,
      repeat: [1, 1],
    });
  }
  Object.entries(buckets).forEach(([col, specs]) => g.add(mergedBoxes(t, specs, Number(col), { tex: 'fabric', rough: 0.82 })));
  return g;
}

const BazaarShell = setPiece<BazaarPlan>('BazaarShell', (t, plan, park) => {
  const g = new t.Group();
  const ups: ((time: number) => void)[] = [];
  const floor = (p: XZ) => park.floorAt(p[0], p[1]);

  // round-6 channels: lamps/benches/markers are PLANTED footprints; the STALL
  // bodies register their own blockers through the manager (registerStall), and
  // the canopies are OVERHEAD — an overhanging awning is not an obstacle.
  const reg = setPieceRegistry(park, plan);
  const hooks = new Map<string, [number, number, number]>();
  plan.lampSpots.forEach((l) => {
    const lamp = setPieceLamp(t, [l.at[0], floor(l.at), l.at[1]], { light: l.light, height: 2.85 });
    g.add(lamp.group);
    ups.push(lamp.update);
    hooks.set(`${l.at[0]},${l.at[1]}`, lamp.hook);
    reg.plant('lamp', l.at);
  });
  const hookOf = (p: XZ) => hooks.get(`${p[0]},${p[1]}`);
  // festival spans across the two entrances
  plan.spans.forEach(([a, b]) => {
    const ha = hookOf(a);
    const hb = hookOf(b);
    if (!ha || !hb) return;
    const span = setPieceSpan(t, ha, hb, { colors: [0xffd9a0, 0xffb46c, 0xfff0c8], bulbs: 5 });
    g.add(span.group);
    ups.push(span.update);
  });
  // pennant bunting down both rows
  plan.bunting.forEach(([a, b], i) => {
    const ha = hookOf(a);
    const hb = hookOf(b);
    if (!ha || !hb) return;
    g.add(buntingLine(t, ha, hb, i * 3 + 1));
  });
  // striped canopies across the aisle (hung between the bunting runs)
  plan.canopies.forEach((c) => g.add(canopyStrip(t, c.at, floor(c.at) + 2.76, c.yaw)));
  // verge benches + entrance markers
  plan.benchSpots.forEach((b) => {
    g.add(setPieceBench(t, [b.at[0], floor(b.at), b.at[1]], b.yaw));
    reg.plant('bench', b.at);
  });
  plan.props.forEach((p) => {
    const built = buildSceneryAnimated(t, p.name, { scale: p.scale, seed: p.seed });
    built.group.position.set(p.at[0], floor(p.at), p.at[1]);
    built.group.rotation.y = p.yaw;
    g.add(built.group);
    if (built.update) ups.push(built.update);
    reg.plant(p.name, p.at, plantedRadius(p.name) * p.scale);
  });

  return { group: g, update: (time) => ups.forEach((u) => u(time)), dispose: reg.dispose };
});

/**
 * <Bazaar plan={bazaarPlan(...)} /> — the market courtyard: the shell
 * (lamps, spans, bunting, canopies, benches) plus every catalog stall mounted
 * ON the plan's anchors with `register`, so each shop is a real GameManager
 * stall selling on the aisle's traffic flow. Declare it AFTER `<Paths>`.
 */
export const Bazaar: React.FC<SetPieceProps<BazaarPlan>> = ({ plan, reserve }) => (
  <>
    <BazaarShell plan={plan} reserve={reserve} />
    {plan.slots.map((s) => {
      const C = STALL_COMPONENT[s.kind];
      return <C key={s.name} position={s.at} rotation={s.yaw} register name={s.name} pinned={plan.pinStalls} />;
    })}
  </>
);
Bazaar.displayName = 'Bazaar';

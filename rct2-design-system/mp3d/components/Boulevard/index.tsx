import * as THREE from 'three';
import { tree } from '../Kit';
import { buildSceneryAnimated } from '../SceneryPack';
import { CELL, hash01, makeSetPiecePlan, plantedRadius, setPiece, setPieceBench, setPieceLamp, setPieceRegistry, setPieceSpan, snapXZ } from '../SetPieceKit';
import type { SetPiecePlan, SetPieceProps, XZ } from '../SetPieceKit';

// ---------------------------------------------------------------------------
// Boulevard — the MACRO SET-PIECE that makes a big plot read as EXPANSIVE
// instead of huddled: a long straight avenue between TWO ports, dressed at
// regular intervals with lamp posts, trees, benches, planters and optional
// string-light spans across the carriageway.
//
// It is a STREET piece, so its contract differs from a land-owning piece in
// exactly one place: `reserve` defaults to FALSE. A boulevard's whole job is
// to be walked and to be tailed onto — ride queue lanes legitimately end on
// its nodes and side streets legitimately branch off it, and both would
// "overlap" a reserved OBB. `plan.footprint` is still computed (the dressed
// verge strip) so the composing agent can space districts, sweep coaster
// corridors and reason about the avenue as one object; pass `reserve` to opt
// in when the avenue really must be exclusive land.
//
// Geometry (world, axis-aligned — `from`/`to` must share an x or a z):
//
//   port A ·──o──────o──────o──────o──────o──────o──· port B     nodes every 1.2
//          T  L  b   L      L  b   L      L  b   L               L lamp pair
//             ·      ·      ·      ·      ·      ·               (± 1.35 verge)
//          T     tree    tree    tree    tree                    (± 2.4 verge)
//
// Every dressing anchor is ≥ 1.35 from the centreline (clear of the 1.1-wide
// slab and its kerbs), junction cells are skipped, and an `avoid` list keeps
// the verge clear of planned queue lanes / exit huts / ride pads.
// Deterministic (hashed sine only); everything settles on `park.floorAt`.
// ---------------------------------------------------------------------------

export interface BoulevardPlanInput {
  /** unique piece id — port refs read `'<id>:A'` / `'<id>:B'` */
  id: string;
  title?: string;
  /** both ends, lattice cells sharing an x or a z (typically two pieces'
   *  ports: `from: HUB.port('W'), to: MARKET.port('E')`) */
  from: XZ;
  to: XZ;
  /** lamp-pair spacing in units, rounded to the lattice (default 4.8) */
  spacing?: number;
  lamps?: boolean;
  trees?: boolean;
  benches?: boolean;
  planters?: boolean;
  /** string-light spans across the avenue between opposite lamp hooks — on
   *  every OTHER lamp pair (default true) */
  stringLights?: boolean;
  /** cells that must stay clear of dressing (planned queue lanes, exit huts,
   *  ride pads, other pieces) */
  avoid?: XZ[];
  /** clearance radius around each `avoid` cell (default 1.3) */
  clear?: number;
  /** register the footprint — default FALSE (see the header) */
  reserve?: boolean;
  seed?: number;
}

export interface BoulevardPlan extends SetPiecePlan {
  kind: 'Boulevard';
  /** centreline length in units */
  length: number;
  /** unit direction from port A to port B */
  axis: XZ;
  lampSpots: { at: XZ; light: boolean }[];
  spans: [XZ, XZ][];
  treeSpots: { at: XZ; shape: 'round' | 'pine' | 'willow'; scale: number; yaw: number }[];
  benchSpots: { at: XZ; yaw: number }[];
  props: { at: XZ; name: string; yaw: number; scale: number; seed: number }[];
}

/**
 * Plan a boulevard — PURE. Returns the chain of street nodes (one per lattice
 * cell), the two end ports and every dressing anchor in world coordinates.
 * The end nodes ARE the ports, so when you plan them ON a neighbouring
 * piece's port cell `buildParkNet` merges them and the avenue is connected by
 * construction — no index arithmetic, no dangling stub.
 */
export function boulevardPlan(input: BoulevardPlanInput): BoulevardPlan {
  const id = input.id;
  const title = input.title ?? id.replace(/(^|[\s-_])(\w)/g, (_m, a, b) => `${a ? ' ' : ''}${b.toUpperCase()}`).trim();
  const from = snapXZ(input.from);
  const to = snapXZ(input.to);
  const dx = to[0] - from[0];
  const dz = to[1] - from[1];
  if (Math.abs(dx) > 1e-6 && Math.abs(dz) > 1e-6)
    throw new Error(
      `boulevardPlan(${id}): from [${from}] → to [${to}] is DIAGONAL — an RCT2 avenue runs N/S or E/W (share an x or a z, or compose two boulevards through a corner node)`,
    );
  const length = Math.hypot(dx, dz);
  const steps = Math.round(length / CELL);
  if (steps < 3)
    throw new Error(`boulevardPlan(${id}): from [${from}] → to [${to}] is only ${steps} cell(s) long — a boulevard wants ≥ 3 (3.6 u); use a plain street edge instead`);
  const axis: XZ = [dx / length, dz / length];
  const seed = input.seed ?? 1;

  // local frame: the avenue runs along local +z from port A (the ORIGIN, so
  // the piece origin is always a lattice cell whatever the length parity) —
  // the plan's rotation carries the direction and every offset stays a simple
  // [lateral, along] pair
  const rotation = Math.atan2(axis[0], axis[1]);
  const localNodes: XZ[] = [];
  const localEdges: [number, number][] = [];
  for (let i = 0; i <= steps; i += 1) localNodes.push([0, i * CELL]);
  for (let i = 1; i <= steps; i += 1) localEdges.push([i - 1, i]);

  const base = makeSetPiecePlan({
    kind: 'Boulevard',
    id,
    title,
    position: from,
    rotation,
    localNodes,
    localEdges,
    localPorts: [
      // chain ENDS, not stubs: the carriageway itself terminates here, so
      // buildParkNet must never prune them (a gate/junction may sit on one)
      { name: 'A', node: 0, dir: [0, -1], prunable: false },
      { name: 'B', node: steps, dir: [0, 1], prunable: false },
    ],
    half: [2.4, length / 2],
    footOffset: [0, length / 2],
    reserve: input.reserve ?? false,
    keyData: [from, to, input.spacing ?? 4.8, input.lamps !== false, input.trees !== false, input.benches !== false, input.planters !== false, input.stringLights !== false, input.avoid ?? null, seed],
  });

  // ---- dressing stations along the avenue ---------------------------------
  const clear = input.clear ?? 1.3;
  const avoid = (input.avoid ?? []).map(snapXZ);
  const blocked = (p: XZ) => avoid.some((a) => Math.hypot(a[0] - p[0], a[1] - p[1]) < clear);
  const spacing = Math.max(CELL * 2, Math.round((input.spacing ?? 4.8) / CELL) * CELL);
  const stations: number[] = []; // distance along the avenue from port A
  for (let d = spacing; d <= length - spacing * 0.5; d += spacing) stations.push(d);
  const alongLocal = (d: number) => d;

  const lampSpots: BoulevardPlan['lampSpots'] = [];
  const spans: [XZ, XZ][] = [];
  const treeSpots: BoulevardPlan['treeSpots'] = [];
  const benchSpots: BoulevardPlan['benchSpots'] = [];
  const props: BoulevardPlan['props'] = [];

  // the avenue's RHYTHM: a lamp PAIR at every station, a tree PAIR at every
  // half-station between them (a real allée, not scattered planting), and a
  // bench or planter alternating on the verge — deliberate, never random.
  stations.forEach((d, si) => {
    const z = alongLocal(d);
    if (input.lamps !== false) {
      const pair: XZ[] = [];
      ([-1, 1] as const).forEach((s) => {
        const at = base.toWorld([s * 1.35, z]);
        if (blocked(at)) return;
        // real PointLights on every OTHER station only: the lanterns all glow
        // emissively at night, but a long avenue must not eat the park's
        // global light budget on its own
        lampSpots.push({ at, light: si % 2 === 0 });
        pair.push(at);
      });
      if (input.stringLights !== false && pair.length === 2 && si % 2 === 0) spans.push([pair[0], pair[1]]);
    }
    // benches face the street, alternating verge, on the odd stations
    if (input.benches !== false && si % 2 === 1) {
      const s = si % 4 === 1 ? 1 : -1;
      const at = base.toWorld([s * 1.7, z]);
      if (!blocked(at)) benchSpots.push({ at, yaw: base.toWorldYaw(s > 0 ? Math.PI / 2 : -Math.PI / 2) });
    }
    // planter/topiary on the OPPOSITE verge from the bench
    if (input.planters !== false && si % 2 === 1) {
      const s = si % 4 === 1 ? -1 : 1;
      const at = base.toWorld([s * 1.7, z]);
      if (!blocked(at))
        props.push({
          at,
          name: hash01(seed * 3 + si) > 0.5 ? 'planterBox' : 'topiarySpiral',
          yaw: base.toWorldYaw(s > 0 ? Math.PI / 2 : -Math.PI / 2),
          scale: 0.9,
          seed: seed + si * 5,
        });
    }
  });

  // street trees: a PAIR facing each other at every half-station, well off
  // the kerb (canopy over the verge, never over the slab centreline)
  if (input.trees !== false) {
    for (let d = spacing / 2; d <= length - spacing / 2 + 1e-6; d += spacing) {
      const i = Math.round((d - spacing / 2) / spacing);
      const h = hash01(seed * 7 + i * 11);
      const shape = h < 0.3 ? 'pine' : h < 0.85 ? 'round' : 'willow';
      ([-1, 1] as const).forEach((s) => {
        const at = base.toWorld([s * 2.45, alongLocal(d)]);
        if (blocked(at)) return;
        treeSpots.push({
          at,
          shape,
          scale: 0.8 + hash01(seed * 13 + i * 5 + (s > 0 ? 1 : 2)) * 0.3,
          yaw: hash01(seed + i * 3 + (s > 0 ? 7 : 11)) * Math.PI * 2,
        });
      });
    }
  }

  // keepDry: the carriageway cells come from the sub-net; add every verge cell
  const cells: XZ[] = [
    ...base.cells,
    ...lampSpots.map((l) => l.at),
    ...treeSpots.map((tr) => tr.at),
    ...benchSpots.map((b) => b.at),
    ...props.map((p) => p.at),
  ];

  return {
    ...base,
    cells,
    kind: 'Boulevard',
    length,
    axis,
    lampSpots,
    spans,
    treeSpots,
    benchSpots,
    props,
  };
}

/**
 * <Boulevard plan={boulevardPlan(...)} /> — mounts the avenue's dressing
 * (lamp pairs, night-gated spans across the carriageway, street trees,
 * benches, planters). The carriageway itself is street: it comes from the
 * plan's nodes/edges through `buildParkNet` → `<Paths>`, so guests walk it,
 * queue tails may land on it and it is bermed/grounded like every other
 * street. Declare it AFTER `<Paths>`.
 */
export const Boulevard = setPiece<BoulevardPlan>('Boulevard', (t, plan, park) => {
  const g = new t.Group();
  const ups: ((time: number) => void)[] = [];
  const floor = (p: XZ) => park.floorAt(p[0], p[1]);

  // round-6 channels: every verge item is a PLANTED footprint (validatePark's
  // `scenery` gate audits it for dryness and for standing in a walked slab).
  // Nothing here is a blocker: thin lamp columns and tree trunks on a 1.35 u
  // verge are things guests brush past, and fencing an avenue would strand it.
  const reg = setPieceRegistry(park, plan);
  const hooks = new Map<string, [number, number, number]>();
  plan.lampSpots.forEach((l) => {
    const lamp = setPieceLamp(t, [l.at[0], floor(l.at), l.at[1]], { light: l.light });
    g.add(lamp.group);
    ups.push(lamp.update);
    hooks.set(`${l.at[0]},${l.at[1]}`, lamp.hook);
    reg.plant('lamp', l.at);
  });
  plan.spans.forEach(([a, b]) => {
    const ha = hooks.get(`${a[0]},${a[1]}`);
    const hb = hooks.get(`${b[0]},${b[1]}`);
    if (!ha || !hb) return;
    const span = setPieceSpan(t, ha, hb, { colors: [0xffd9a0, 0xfff0c8], bulbs: 5 });
    g.add(span.group);
    ups.push(span.update);
  });
  plan.treeSpots.forEach((s) => {
    const tr = tree(t, { shape: s.shape, scale: s.scale });
    tr.position.set(s.at[0], floor(s.at) - 0.05, s.at[1]); // seated, never floating
    tr.rotation.y = s.yaw;
    g.add(tr);
    reg.plant('tree', s.at, plantedRadius('tree') * s.scale);
  });
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

export type { SetPieceProps };

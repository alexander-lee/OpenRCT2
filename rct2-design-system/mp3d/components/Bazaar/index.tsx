import React from 'react';
import * as THREE from 'three';
import { box, cyl, mergedBoxes } from '../Stage';
import { BurgerShop } from '../BurgerShop';
import { HotDogStand } from '../HotDogStand';
import { SodaStand } from '../SodaStand';
import { CottonCandyStand } from '../CottonCandyStand';
import { BalloonStand } from '../BalloonStand';
import { Restroom } from '../Restroom';
// the five THEMED counters, one per world preset — a themed world's row stocks
// its OWN shop instead of the same three neutral stands every other world has
import { EmberRoast } from '../EmberRoast';
import { SushiStall } from '../SushiStall';
import { GoggleWorks } from '../GoggleWorks';
import { Honeywitch } from '../Honeywitch';
import { NeonSlush } from '../NeonSlush';
import { offPathCell, reportPlanLint } from '../ParkBuilder';
import { buildSceneryAnimated } from '../SceneryPack';
import {
  CELL,
  makeSetPiecePlan,
  plantedRadius,
  rotateXZ,
  setPiece,
  setPieceBench,
  setPieceLamp,
  setPieceRegistry,
  setPieceSpan,
  snapXZ,
  themeOf,
  themedSeed,
} from '../SetPieceKit';
import type { SetPiecePlan, SetPieceProps, WorldPalette, WorldTheme, XZ } from '../SetPieceKit';

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

/**
 * The stalls a row can be stocked with: the five NEUTRAL catalog stands, legal
 * in any world, plus the five THEMED counters — one per world preset.
 *
 * **THE THEMED FIVE WERE ADDED 2026-07-27 AND THE OMISSION WAS A REAL DEFECT.**
 * Every world preset ships its own stall (`ParkBuilder/worlds.ts:
 * COMPONENT_THEME`), but a bazaar could only mount the neutral five — so the
 * market in the volcanic caldera, the one on the shipwreck beach and the one in
 * the nightclub street were *the same three shops*, and the only way to stock a
 * world's own counter was to hand-mount it outside the row. Measured across the
 * 30-park corpus: the themed stalls appear 1, 1, 2, 4 and 1 times respectively,
 * against 27 / 26 / 23 / 17 / 15 for the neutral ones. The rows were identical
 * because the vocabulary made them identical.
 *
 * They are drop-in: all ten are built by the same `composableStall` factory and
 * take the same `position` / `rotation` / `register` / `name` / `pinned` props.
 */
export type BazaarStallKind =
  | 'burger'
  | 'hotDog'
  | 'soda'
  | 'cottonCandy'
  | 'balloon'
  // ---- one per world preset (themed; see THEMED_STALL_OF) ----
  | 'emberRoast'
  | 'sushi'
  | 'goggles'
  | 'honeywitch'
  | 'neonSlush';

const STALL_COMPONENT: Record<BazaarStallKind, React.FC<Record<string, unknown>>> = {
  burger: BurgerShop as unknown as React.FC<Record<string, unknown>>,
  hotDog: HotDogStand as unknown as React.FC<Record<string, unknown>>,
  soda: SodaStand as unknown as React.FC<Record<string, unknown>>,
  cottonCandy: CottonCandyStand as unknown as React.FC<Record<string, unknown>>,
  balloon: BalloonStand as unknown as React.FC<Record<string, unknown>>,
  emberRoast: EmberRoast as unknown as React.FC<Record<string, unknown>>,
  sushi: SushiStall as unknown as React.FC<Record<string, unknown>>,
  goggles: GoggleWorks as unknown as React.FC<Record<string, unknown>>,
  honeywitch: Honeywitch as unknown as React.FC<Record<string, unknown>>,
  neonSlush: NeonSlush as unknown as React.FC<Record<string, unknown>>,
};
const STALL_LABEL: Record<BazaarStallKind, string> = {
  burger: 'Burger Bar',
  hotDog: 'Hot Dogs',
  soda: 'Soda Stand',
  cottonCandy: 'Cotton Candy',
  balloon: 'Balloon Stand',
  emberRoast: 'Ember Roast',
  sushi: 'Dockside Sushi',
  goggles: 'The Goggle Works',
  honeywitch: 'The Honeywitch',
  neonSlush: 'Neon Slush',
};

/**
 * THEME ID → THAT WORLD'S OWN STALL. Both the canonical genre ids and the five
 * legacy place names resolve, exactly as `SetPieceKit.WORLD_THEMES` does.
 *
 * A themed piece is only coherent INSIDE its own world (`auditWorldThemes`
 * reports one standing anywhere else as a `crossTheme` defect), so this table
 * is also the safety rule: stock `THEMED_STALL_OF[theme.id]` and nothing else
 * themed, and the row cannot raise a finding.
 */
export const THEMED_STALL_OF: Record<string, BazaarStallKind> = {
  fire: 'emberRoast',
  emberfall: 'emberRoast',
  pirateBeach: 'sushi',
  tidewater: 'sushi',
  steampunk: 'goggles',
  brasswork: 'goggles',
  enchantedForest: 'honeywitch',
  thornwick: 'honeywitch',
  neon: 'neonSlush',
  pulse: 'neonSlush',
};

/** the THEMED stall kinds, for the "is this row stocked with a foreign theme's
 *  counter?" check below */
const THEMED_KINDS = new Set<BazaarStallKind>(['emberRoast', 'sushi', 'goggles', 'honeywitch', 'neonSlush']);

// The canopy / bunting / cable palette now comes from the piece's WorldTheme
// (`plan.theme.palette`) — `DEFAULT_THEME` carries the exact cream / red / navy
// / gold / near-black cable this bazaar always used, so an unthemed bazaar is
// pixel-identical to the pre-theme one.

export interface BazaarPlanInput {
  /** unique piece id — port refs read `'<id>:W'` / `'<id>:E'` */
  id: string;
  title?: string;
  /** the courtyard centre cell (snapped to the 1.2 lattice) */
  position: XZ;
  /** quarter-turn yaw (default 0 — aisle running east/west).
   *
   *  **A BAZAAR HAS EXACTLY TWO PORTS, `W` and `E`, AND THEY ALWAYS LIE ON THE
   *  AISLE AXIS** — there is no N or S port to wire, at any rotation. Rotating
   *  by `Math.PI / 2` runs the aisle NORTH/SOUTH, and the port NAMED `W` then
   *  faces NORTH (the names are LOCAL, not compass). Never infer which way a
   *  port faces: read `plan.portDir('W')`, or let `facing` aim it for you. */
  rotation?: number;
  /** aim a NAMED PORT at a world point and let the planner pick the rotation
   *  (`facing: { port: 'E', toward: HUB.port('S') }`). Wins over `rotation`.
   *  This is the safe way to hook a bazaar onto a hub: the round-8 park set
   *  `rotation` by hand, assumed "its E port faces the hub after the default
   *  rotation", and wired a DIAGONAL avenue that threw at module scope. */
  facing?: { port: 'W' | 'E'; toward: XZ };
  /** 3-6 catalog stalls, laid alternately along the two rows
   *  (default `['burger', 'soda', 'cottonCandy', 'balloon']`) */
  stalls?: BazaarStallKind[];
  /** THEMED NAMES, one per entry in `stalls` (positional; short arrays fall
   *  back per slot). Omit it and each stall is auto-named
   *  `'<title> <CatalogDefault>'` — "EmberRow Soda Stand" — which passes a
   *  mechanical `themedName` check and still reads as machine output. Name
   *  them: `names: ['Cinder Grill', 'Slagworks Sodas', 'Ashfloss']`. */
  names?: string[];
  /** the four lantern lamps in the two free end tiles (default true). They are
   *  also the HOOKS the spans and the bunting hang from, so `lamps: false`
   *  takes both of those runs with it (the canopies are unaffected). Turn them
   *  off when a corner lamp would compose under the waterline: a lamp is
   *  DRESSING, and the row's guard cells hold the terrain, so moving the whole
   *  bazaar to save one lamp trades a composition for a decoration. */
  lamps?: boolean;
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
  /**
   * A RESTROOM at the row's end (default **true**).
   *
   * A market is where guests eat, and eating is what creates the need — RCT2
   * parks put the toilets next to the food for exactly that reason. Parks were
   * shipping one restroom for the whole plot (or none), so guests crossed the
   * map with a full bladder and the sim's `needsToilet` thoughts piled up.
   * Every bazaar now brings its own, planted just outside the free end tile,
   * facing the aisle, so it is served by the same street the shops are.
   *
   * `false` turns it off; `'W'` / `'E'` picks which end (default: the end
   * FURTHEST from the row's wired port, so it never blocks the approach).
   */
  restroom?: boolean | 'W' | 'E';
  /** the WORLD this bazaar is dressed for — canopy colours, bunting pennants,
   *  cable, lantern character, span bulbs and the two entrance markers come
   *  from it. Default `DEFAULT_THEME` = today's cream/red market. */
  theme?: WorldTheme;
  seed?: number;
}

/** where this row's restroom stands, or `null` when `restroom: false` */
export interface BazaarRestroom {
  at: XZ;
  yaw: number;
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
  /** THE TWO PORTS THIS PIECE HAS — always exactly `['W', 'E']`, always on the
   *  aisle axis. Read it (or `portDirs`) instead of assuming compass names. */
  portNames: ['W', 'E'];
  /** each port's OUTWARD world direction, as data: `{ W: [-1, 0], E: [1, 0] }`
   *  at rotation 0, `{ W: [0, 1], E: [0, -1] }` at `Math.PI / 2`. */
  portDirs: { W: XZ; E: XZ };
  /** the aisle's world axis (unit, W→E) — the ONLY axis this piece connects on */
  aisleAxis: XZ;
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
  /** the row's own restroom, or null when `restroom: false` */
  restroom: BazaarRestroom | null;
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
    reportPlanLint(
      'bazaarStallCount',
      `bazaarPlan(${id}): a bazaar wants 3-6 stalls (got ${stalls.length}) — padded with a balloon stand`,
      false,
    );
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
  const theme = themeOf(input.theme);
  const seed = themedSeed(theme, input.seed ?? 1);

  // ---- THEME COHERENCE of the STOCK (2026-07-27, with the themed five) -----
  // A themed counter is only coherent inside its OWN world: `auditWorldThemes`
  // reports one standing anywhere else as a `crossTheme` defect, which is a
  // scored deduction and a `validatePark` warning. Now that a row CAN be
  // stocked with another world's shop, say so here — at plan time, naming the
  // row and the fix — instead of letting it surface as a settle-time finding
  // about a piece whose coordinates the author never wrote.
  const ownStall = THEMED_STALL_OF[theme.id];
  const foreign = [...new Set(stalls.filter((s) => THEMED_KINDS.has(s) && s !== ownStall))];
  if (foreign.length)
    reportPlanLint(
      'bazaarForeignStall',
      `bazaarPlan(${id}): stocked with ${foreign.map((f) => `'${f}'`).join(', ')}, which ${
        foreign.length > 1 ? 'are themed counters' : 'is a themed counter'
      } belonging to ANOTHER world — this row is dressed '${theme.id}'. A themed stall standing outside its own ` +
        `world is a crossTheme deduction. Use ${ownStall ? `'${ownStall}' (this world's own shop)` : 'a neutral stand'} ` +
        `or one of 'burger' / 'hotDog' / 'soda' / 'cottonCandy' / 'balloon', which are legal anywhere.`,
      false,
    );

  // ---- rotation: `facing` aims a NAMED port at a world point ---------------
  // The piece has TWO ports and they are both on the aisle axis, so "which way
  // does E face?" has exactly four answers — pick the one that points at the
  // thing you are wiring to instead of guessing (P0-B).
  let rotation = input.rotation ?? 0;
  if (input.facing) {
    const pos = snapXZ(input.position);
    const vx = input.facing.toward[0] - pos[0];
    const vz = input.facing.toward[1] - pos[1];
    // the port's LOCAL outward dir: W = [-1, 0], E = [+1, 0]
    const localSign = input.facing.port === 'E' ? 1 : -1;
    // of the four quarter turns, keep the one whose rotated local dir best
    // points along [vx, vz] (ties break toward the smaller turn — deterministic)
    let best = 0;
    let bestDot = -Infinity;
    for (let q = 0; q < 4; q += 1) {
      const d = rotateXZ(q * (Math.PI / 2), [localSign, 0] as XZ);
      const dot = d[0] * vx + d[1] * vz;
      if (dot > bestDot + 1e-9) {
        bestDot = dot;
        best = q;
      }
    }
    rotation = best * (Math.PI / 2);
  }

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
    // AUTHORED NAME WINS. The auto-name `'<title> <CatalogDefault>'` satisfies
    // every mechanical themed-name check and still reads as generated text, so
    // `names:` is the lever that makes a row sound like a place.
    const authored = input.names?.[j]?.trim();
    const name = authored || `${title} ${STALL_LABEL[kind]}${n > 1 ? ` ${n}` : ''}`;
    // the serving front is the stall's local +z; aim it at the aisle
    return { kind, name, at, side, localYaw: side === 1 ? Math.PI : 0 };
  });

  const base = makeSetPiecePlan({
    kind: 'Bazaar',
    id,
    title,
    position: input.position,
    rotation,
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
    theme,
    // `makeSetPiecePlan` folds `themeKey(theme)` into the remount key this
    // keyData feeds, so re-dressing the row for another world rebuilds it
    keyData: [stalls.join(','), (input.names ?? []).join('|'), input.canopies !== false, input.bunting !== false, input.stringLights !== false, input.benches !== false, input.lamps !== false, seed],
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
  const lampSpots = input.lamps === false ? [] : lampLocals.map((l, i) => ({ at: base.toWorld(l), light: i === 0 || i === 3 }));
  // no lamps → no hooks, so the two hung runs go with them (same guard shape
  // FountainPlaza uses for its spans)
  const spans: [XZ, XZ][] =
    input.stringLights === false || lampSpots.length < 4
      ? []
      : [
          [lampSpots[0].at, lampSpots[1].at],
          [lampSpots[2].at, lampSpots[3].at],
        ];
  const bunting: [XZ, XZ][] =
    input.bunting === false || lampSpots.length < 4
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

  // entrance markers on the grass verges, just outside the footprint — the
  // world's own pair (default: the signpost + flagpole this piece always had)
  const props: BazaarPlan['props'] = [
    { at: base.toWorld([-stub, 2 * CELL]), name: theme.planting.markers[0], yaw: base.toWorldYaw(Math.PI / 2), scale: 1, seed: seed + 2 },
    { at: base.toWorld([stub, -2 * CELL]), name: theme.planting.markers[1], yaw: base.toWorldYaw(-Math.PI / 2), scale: 1, seed: seed + 3 },
  ];

  // ---- THE ROW'S OWN RESTROOM (2026-07-28) --------------------------------
  // Planted one cell OUTSIDE the free end tile, set back across the aisle so it
  // never sits on the stall line, and facing the aisle it serves.
  const restroomOpt = input.restroom ?? true;
  const restroomEnd: 'W' | 'E' =
    restroomOpt === 'W' || restroomOpt === 'E' ? restroomOpt : (input.facing?.port === 'W' ? 'E' : 'W');
  const rSign = restroomEnd === 'E' ? 1 : -1;
  const restroom = restroomOpt === false
    ? null
    : {
        at: base.toWorld([rSign * (half + 0.6), -2 * CELL]),
        yaw: base.toWorldYaw(0),
      };

  return {
    ...base,
    kind: 'Bazaar',
    props,
    restroom,
    // the two-port contract, as DATA (P0-B) — never infer these
    portNames: ['W', 'E'],
    portDirs: { W: base.portDir('W'), E: base.portDir('E') },
    aisleAxis: base.portDir('E'),
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
 *  the bunting lines, so nothing stands in the walkway). `pal` is the world's
 *  palette: field = `canopyPrimary`, edge courses + hem = `canopySecondary`,
 *  carrying wires = `cable`. */
function canopyStrip(t: typeof THREE, at: XZ, y: number, yaw: number, pal: WorldPalette): THREE.Group {
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
  g.add(mergedBoxes(t, cream, pal.canopyPrimary, { tex: 'fabric', rough: 0.8 }));
  g.add(mergedBoxes(t, red, pal.canopySecondary, { tex: 'fabric', rough: 0.8 }));
  // scalloped hem + the two carrying cables
  g.add(box(t, [W, 0.05, 0.05], pal.canopySecondary, [0, -0.09, D / 2], { tex: 'fabric', repeat: [8, 1], rough: 0.85 }));
  g.add(box(t, [W, 0.05, 0.05], pal.canopySecondary, [0, -0.09, -D / 2], { tex: 'fabric', repeat: [8, 1], rough: 0.85 }));
  [-D / 2, D / 2].forEach((z) => g.add(cyl(t, 0.012, 0.012, W, pal.cable, [0, 0.04, z], { rough: 0.9, seg: 5, rotZ: Math.PI / 2 })));
  g.position.set(at[0], y, at[1]);
  g.rotation.y = yaw;
  return g;
}

/** a pennant garland between two hooks — flags only, no lights (day flavour
 *  that costs nothing against the park's light budget) */
function buntingLine(t: typeof THREE, from: [number, number, number], to: [number, number, number], seed: number, pal: WorldPalette): THREE.Group {
  const g = new t.Group();
  // the world's four pennant colours, in the order the run cycles them
  const cols = [pal.canopyPrimary, pal.canopySecondary, pal.bunting, pal.buntingAccent];
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
  g.add(mergedBoxes(t, cableSpecs, pal.cable, { rough: 0.9 }));
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

  // ---- VERGE DRESSING vs the STREET (wave-18) ------------------------------
  // `bazaarPlan` emits its verge dressing at FIXED LOCAL offsets the author
  // never sees and therefore cannot sieve: bench at (±stub, ±1.2) and entrance
  // marker at (±stub, ±2.4) — both on the PORT CELL's column, PERPENDICULAR to
  // the aisle. Enter a port ALONG the aisle (the intended wiring) and all four
  // cells clear the slab comfortably. Run a street THROUGH the port cell ACROSS
  // the aisle — which is legal, cardinal, and what a north-south spine past an
  // east-west row looks like — and the bench and the marker land 0.00 u from
  // that street's centreline: two `scenery` FAILs (round 14 park B) that no
  // author-side check could have caught, because the offsets are not in the
  // plan they wrote.
  //
  // So the piece sieves its OWN dressing, with the helper an author would use
  // and against the SAME floor `validatePark`'s `scenery` gate measures
  // (`pathWidth/2 + min(r, 0.6)`, its blocking radius capped at half a cell).
  // `offPathCell` RETURNS THE CELL UNCHANGED when it already clears, so a row
  // whose streets respect its aisle is pixel-identical to before. Plaza
  // dressing is exempt in the gate, so it is exempt here too.
  const dressAt = (at: XZ, r: number): XZ => {
    const p = park.paths;
    if (!p) return at;
    const half = (p.width ?? 1.1) / 2;
    const inPlaza = p.plazas.some(([cx, cz, w, d]) => Math.abs(at[0] - cx) <= w / 2 + 0.05 && Math.abs(at[1] - cz) <= d / 2 + 0.05);
    if (inPlaza) return at;
    const clear = half + Math.min(r, 0.6) + 0.05;
    const spot = offPathCell(p.net, at, {
      clear,
      streetNodes: p.streetNodes,
      size: park.size,
      isDry: (x, z) => park.isDry([x, z]),
      rings: 4,
    });
    if (!spot) return at;
    if (spot[0] !== at[0] || spot[1] !== at[1])
      // eslint-disable-next-line no-console
      console.warn(
        `[Bazaar ${plan.id}] verge dressing at [${at[0].toFixed(1)}, ${at[1].toFixed(1)}] was inside a street slab ` +
          `(needs ${clear.toFixed(2)} u of clearance) — moved to [${spot[0].toFixed(1)}, ${spot[1].toFixed(1)}]. A street ` +
          `crossing a bazaar PORT CELL perpendicular to the aisle runs through this row's entrance verge: wire the port ` +
          `ALONG the aisle axis and keep other streets ≥ 2.4 u off it (rules §3.1 bazaar dressing halo).`,
      );
    return spot as XZ;
  };
  const pal = plan.theme.palette;
  const hooks = new Map<string, [number, number, number]>();
  plan.lampSpots.forEach((l) => {
    const lamp = setPieceLamp(t, [l.at[0], floor(l.at), l.at[1]], { light: l.light, height: 2.85, theme: plan.theme });
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
    const span = setPieceSpan(t, ha, hb, { colors: pal.spanBulbs, bulbs: 5 });
    g.add(span.group);
    ups.push(span.update);
  });
  // pennant bunting down both rows
  plan.bunting.forEach(([a, b], i) => {
    const ha = hookOf(a);
    const hb = hookOf(b);
    if (!ha || !hb) return;
    g.add(buntingLine(t, ha, hb, i * 3 + 1, pal));
  });
  // striped canopies across the aisle (hung between the bunting runs)
  plan.canopies.forEach((c) => g.add(canopyStrip(t, c.at, floor(c.at) + 2.76, c.yaw, pal)));
  // verge benches + entrance markers
  plan.benchSpots.forEach((b) => {
    const at = dressAt(b.at, plantedRadius('bench'));
    g.add(setPieceBench(t, [at[0], floor(at), at[1]], b.yaw));
    reg.plant('bench', at);
  });
  plan.props.forEach((p) => {
    const r = plantedRadius(p.name) * p.scale;
    const at = dressAt(p.at, r);
    const built = buildSceneryAnimated(t, p.name, { scale: p.scale, seed: p.seed });
    built.group.position.set(at[0], floor(at), at[1]);
    built.group.rotation.y = p.yaw;
    g.add(built.group);
    if (built.update) ups.push(built.update);
    reg.plant(p.name, at, r);
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
    {/* THE ROW'S OWN RESTROOM — a market is where guests eat, and eating is what
        creates the need. Turn it off with `restroom: false`. */}
    {plan.restroom ? <Restroom position={plan.restroom.at} rotation={plan.restroom.yaw} /> : null}
  </>
);
Bazaar.displayName = 'Bazaar';

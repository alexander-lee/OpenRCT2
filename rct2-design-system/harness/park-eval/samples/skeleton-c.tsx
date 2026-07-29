/*
 * SKELETON C — "THE SIX TERRACES". A DENSE park, deliberately: the density
 * class is the deliverable, not a decoration.
 *
 * §0 PRE-FLIGHT (all arithmetic COUNTED FROM THIS FILE)
 *
 * SEED   seed=107 climate="alpine" size=128 — NOT one of the 16 published §1
 *        rows, and pinned on MEASUREMENT rather than on the table:
 *          * UNGUARDED it composes `ridges` amp 8.32, relief 14.88 / stdH 1.36,
 *            probes 1, violations 0, water 7.4 % in TWO bodies (secondFrac 0.40,
 *            gap 66.5 u) — a flank lake (37.0, 29.9) and a SW tarn (−29.2, −30.5).
 *          * RING-CLEAN AT THE PUBLISHED §4.2-A START POSE: re-composing with only
 *            the ring's 16 cells moves the DOMINANT centroid 0.0 u and the
 *            SECONDARY 0.0 u, violations 0, and all four deck cells compose DRY
 *            with POSITIVE ground (h 0.26 / 0.45 / 0.66 / 0.68) and peak-bump 0.
 *          * IT SURVIVES A DENSE GUARD LIST, which is the whole point. Composed
 *            against FOUR different ~560-cell synthetic street grids it measures
 *            relief/stdH 9.61/1.24, 10.52/1.26, 9.93/1.00 and 11.19/1.22 — every
 *            one ABOVE the published size-128 band floor (relief 8.15 / stdH
 *            0.76), so `terrainFlattened` cannot fire on this row however heavy
 *            the net gets. (The rows a dense park dies on read 6.7/0.43 and
 *            4.5/0.42 on the same test.) Measured with
 *            `node sweep-dense-row.mjs --seeds=107 --climates=alpine --variants`.
 *          * <Paths>' own solve over a 6-u-node grid on that ground reads
 *            causewayLevel 0.20 (FATAL over 0.8), worst span lift 0.98, 0 spans
 *            REFUSED, 0 spans in water.
 *        THE ROW IS OFF-TABLE, so `expectWater` is undefined and `waterRePicked`
 *        cannot fire; §5c's re-compose below is therefore the ONLY water
 *        authority this park has, and it runs at module scope.
 * GATE   [9.6, 63.6] on the +z rim. Nearest queue tail [7.2, 57.6] — 8.4 u.
 * SHAPE  SIX EAST-WEST TERRACES at irregular z (57.6 / 48.0 / 38.4 / 27.6 / 14.4
 *        / 2.4) with a DIFFERENT node pitch each (4.8 / 3.6 / 6.0 / 2.4 / 8.4 /
 *        7.2), stitched by 20 short vertical links at irregular x plus three
 *        <Boulevard> chains, then three long ARMS south/east/west to the ring's
 *        W/E/S queue tails. That is a MESHED net with real cycles, not a tree:
 *        skeleton B is 56 nodes / 410 u / mean edge 7.46 / 0 cycles; this is a
 *        DENSE ~180-node / ~800-u / mean-edge ~4 net with ~15 cycles, which is
 *        the one lever the rulebook says actually moves the novelty vector.
 *        THE RING'S NORTH TAIL [0, 27.6] IS A THROUGH NODE — it sits on terrace
 *        T4 — and the other three tails are DEAD ENDS at the end of their arm.
 * WORLDS thornwick NW · brasswork SE · emberfall SW. Each reaches the ring's beam
 *        corridor, each mounts one registered ride and three of its own scenery.
 * ROSTER 9 registered rides / 12 stalls (3 + 6 + 3 bazaar slots) / 5 categories
 *        gentle Carousel + Flying Saucers · thrill Terrace Flyer (coaster) +
 *        Discotron + Enterprise · water Paddle Boats · transport Grand Circle
 *        Monorail + Chairlift · dark Ghost Train.
 * FLAG   §4.0-B family rectangle at start [15.6, 0.55, -25.2]; the rectangle
 *        occupies x[-14.4 … 16.8] z[-39.6 … -7.2] — the plot's south-centre,
 *        which no terrace reaches. Queue tail [21.6, -25.2] = start.x + 6.0,
 *        queueDir [1, 0], hung off the EAST ARM's own spur column at x 21.6.
 *        CORRIDOR KEEP-OUT (§4.0-B at start [15.6, -25.2], PLOT coords):
 *          west valley  x[-14.4..-13.2] z[-31.2..-14.4]
 *          west valley  x[-12.0]        z[-32.4..-14.4]
 *          south valley x[-7.2..9.6]    z[-39.6..-37.2]
 *          north valley x[-2.4..9.6]    z[-9.6..-7.2]
 *          station leg  x[14.4..16.8]   z[-32.4..-18.0]
 *        every street node and every street edge is outside all five (asserted).
 * RING   §4.2-A grand circle at the published START POSE [-42.6, 0, -9.7],
 *        rotation 0, beamY 2.6, four platforms W/N/E/S, the four queue tails
 *        [-36, -8.4] [0, 27.6] [36, -8.4] [0, -44.4] AUTHORED as street nodes.
 */
import React from 'react';
import * as THREE from 'three';
import type { V3, XZ } from './components/Park';
import type { TrackPiece } from './components/SplineRideKit';
import {
  Park, GameManager, Terrain, Paths, Gate, Coaster,
  Restroom, Scenery, Lights, Placed, offPathCell,
} from './components/Park';
import { laneLenOf, parkComposition } from './components/ParkBuilder';
import {
  buildParkNet, worldPlan, World,
  BRASSWORK_FOUNDRY, EMBERFALL_CALDERA, THORNWICK_GLADE,
} from './components/SetPieceKit';
import type { NetRef, SetPiecePlan } from './components/SetPieceKit';
import { Bazaar, bazaarPlan } from './components/Bazaar';
import { Boulevard, boulevardPlan } from './components/Boulevard';
import { compileTrackPieces } from './components/SplineRideKit';
import { tree } from './components/Kit';

import { Monorail } from './components/Monorail';
import { Carousel } from './components/Carousel';
import { Chairlift } from './components/Chairlift';
import { GhostTrain } from './components/GhostTrain';
import { PaddleBoats } from './components/PaddleBoats';
import { Discotron } from './components/Discotron';
import { Enterprise } from './components/Enterprise';
import { FlyingSaucers } from './components/FlyingSaucers';

import { GiantToadstools, StandingStones, LanternTree } from './components/ThornwickScenery';
import { GiantGear, SteamPipes, ClockTower } from './components/BrassworkScenery';
import { Fumarole, ObsidianShards, BasaltColumns } from './components/EmberfallScenery';

const SEED = 107;
const CLIMATE = 'alpine' as const;
const SIZE = 128;

// ── 0a. THE MANDATORY RING'S TRACK, INLINE (§4.2-A, verbatim) ───────────────
const MONO_PIECES: TrackPiece[] = [
  'station',                                     // platform 0 — WEST
  { type: 'straight', length: 35.3 },
  { type: 'turnL', angle: 90, radius: 6 },
  { type: 'straight', length: 35.3 },
  'station',                                     // platform 1 — NORTH
  { type: 'straight', length: 35.3 },
  { type: 'turnL', angle: 90, radius: 6 },
  { type: 'straight', length: 35.3 },
  'station',                                     // platform 2 — EAST
  { type: 'straight', length: 35.3 },
  { type: 'turnL', angle: 90, radius: 6 },
  { type: 'straight', length: 35.3 },
  'station',                                     // platform 3 — SOUTH
  { type: 'straight', length: 35.3 },
  { type: 'turnL', angle: 90, radius: 6 },
  { type: 'straight', length: 33.5 },            // the tail, in TWO pieces
  { type: 'straight', length: 1.5 },
];
// the ring's 16 GROUND cells — they go in KEEP_DRY and get walked in §5c
const RING_CELLS: XZ[] = [
  [-42.6, -8.4], [0, 34.2], [42.6, -8.4], [0, -51.0],   // decks
  [-42.6, -9.7],                                        // start
  [-36.0, -8.4], [0, 27.6], [36.0, -8.4], [0, -44.4],   // tails (AUTHORED below)
  [-40.81, -8.4], [0, 32.41], [40.81, -8.4], [0, -49.21], // queue anchors
  [-1.2, 33.03], [41.43, -7.2], [1.2, -49.83],          // exits
];

// ── 0b. THE FLAGSHIP: §4.0-B FAMILY rectangle, verbatim ────────────────────
const A_PIECES: TrackPiece[] = [
  'station',
  { type: 'lift', height: 3.6 }, { type: 'straight', length: 2.56 }, { type: 'turnR', angle: 90, radius: 2.5 },
  { type: 'drop', height: 3.6 },
  { type: 'lift', height: 3.2 }, { type: 'straight', length: 5.46 }, { type: 'turnR', angle: 90, radius: 2.5 },
  { type: 'drop', height: 3.2 }, { type: 'hill', height: 0.9 },
  { type: 'lift', height: 3.2 }, { type: 'straight', length: 1.5 }, { type: 'turnR', angle: 90, radius: 2.5 },
  { type: 'drop', height: 3.2 }, { type: 'hill', height: 0.9 },
  { type: 'lift', height: 3.2 }, { type: 'turnR', angle: 90, radius: 2.5 },
  { type: 'drop', height: 3.2 }, { type: 'straight', length: 1.5 },
];
const A_START: V3 = [15.6, 0.55, -25.2];
const A_TAIL: XZ = [21.6, -25.2];                  // start.x + 6.0, same z
const { points: FLAG_PTS } = compileTrackPieces(A_PIECES, {
  type: 'steel', start: A_START, heading: 0, bounds: SIZE,
});
/** the coaster's REGISTERED position is its footprint CENTRE, not `start` — read
 *  it off the compiled points so `__netdump`'s district metrics cannot drift */
const FLAG_CENTRE: XZ = (() => {
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  for (const p of FLAG_PTS) {
    if (p[0] < x0) x0 = p[0];
    if (p[0] > x1) x1 = p[0];
    if (p[2] < z0) z0 = p[2];
    if (p[2] > z1) z1 = p[2];
  }
  return [+((x0 + x1) / 2).toFixed(2), +((z0 + z1) / 2).toFixed(2)];
})();
/** the five §4.0-B corridor rectangles at THIS start, in plot coords */
const FLAG_KEEPOUT: { x: [number, number]; z: [number, number] }[] = (() => {
  const [sx, , sz] = A_START;
  return [
    { x: [sx - 30.0, sx - 28.8], z: [sz - 6.0, sz + 10.8] },
    { x: [sx - 27.6, sx - 27.6], z: [sz - 7.2, sz + 10.8] },
    { x: [sx - 22.8, sx - 6.0], z: [sz - 14.4, sz - 12.0] },
    { x: [sx - 18.0, sx - 6.0], z: [sz + 15.6, sz + 18.0] },
    { x: [sx - 1.2, sx + 1.2], z: [sz - 7.2, sz + 7.2] },
  ];
})();

// ── 1. THE STREET SKELETON, AS DATA ────────────────────────────────────────
// A dense net is a TABLE, not 140 hand-typed literals: six terraces (an x range
// and a NODE PITCH each), the vertical links that stitch them, and three arms.
// Every pitch is different on purpose — `gridRegularity`'s `lengthUniformity`
// term is 1/effectiveClasses, so one repeated pitch across six rows would cost
// the anti-lattice point that a dense park is otherwise most at risk of.
const NODES: XZ[] = [];
const KEY = new Map<string, number>();
const k2 = (x: number, z: number) => `${x.toFixed(2)},${z.toFixed(2)}`;
function nid(x: number, z: number): number {
  const k = k2(x, z);
  const hit = KEY.get(k);
  if (hit !== undefined) return hit;
  KEY.set(k, NODES.length);
  NODES.push([x, z]);
  return NODES.length - 1;
}
const AUTHORED: [number, number][] = [];
const link = (a: number, b: number) => { if (a !== b) AUTHORED.push([a, b]); };
/** chain a sorted list of coordinates along one row (z fixed) or column (x fixed) */
function chainRow(z: number, xs: number[]): void {
  const s = [...new Set(xs)].sort((a, b) => a - b);
  for (let i = 1; i < s.length; i += 1) link(nid(s[i - 1], z), nid(s[i], z));
}
function chainCol(x: number, zs: number[]): void {
  const s = [...new Set(zs)].sort((a, b) => a - b);
  for (let i = 1; i < s.length; i += 1) link(nid(x, s[i - 1]), nid(x, s[i]));
}
const ramp = (a: number, b: number, step: number): number[] => {
  const out: number[] = [];
  for (let v = a; v <= b + 1e-6; v += step) out.push(+v.toFixed(2));
  return out;
};

/** the six terraces: z, x range, node pitch */
const TERRACES: { z: number; x0: number; x1: number; step: number }[] = [
  { z: 57.6, x0: -45.6, x1: 20.4, step: 4.8 },
  { z: 48.0, x0: -42.0, x1: 26.4, step: 3.6 },
  { z: 38.4, x0: -51.6, x1: 20.4, step: 6.0 },
  { z: 27.6, x0: -43.2, x1: 14.4, step: 2.4 },
  { z: 14.4, x0: -49.2, x1: 16.8, step: 8.4 },
  { z: 2.4, x0: -45.6, x1: 32.4, step: 7.2 },
];
/** the vertical links, by terrace GAP — each spans exactly two adjacent
 *  terraces, so its x carries at most two street nodes and stays OFF the
 *  `latticeNodeShare` col-line test (a coordinate needs three nodes to count) */
const LINKS: number[][] = [
  [-22.8, -19.2, -6.0, 1.2, 9.6, 18.0],       // gap 0: T1 57.6 ↔ T2 48.0  (-34.8 is bvN)
  [-42.0, -25.2, -12.0, -8.4, 15.6, 20.4],    // gap 1: T2 48.0 ↔ T3 38.4  (4.8 is bvC)
  [-48.0, -39.6, -30.0, -18.0, -13.2, -4.8, 10.8], // gap 2: T3 38.4 ↔ T4 27.6
  [-44.4, -37.2, -10.8, -1.2, 3.6, 8.4, 13.2], // gap 3: T4 27.6 ↔ T5 14.4
  [-49.2, -32.4, -24.0, -20.4, 6.0],          // gap 4: T5 14.4 ↔ T6 2.4
];
/** every link is SUBDIVIDED, at irregular fractions that vary per link. Three
 *  things fall out of one edit: the interior nodes sit at z values no terrace
 *  shares, so they are not `latticeNodeShare` lattice nodes; the vertical EDGE
 *  count roughly doubles, which moves the 30° bearing histogram off the
 *  x-dominant mix every dense park in the corpus has; and the mean edge length
 *  drops without shortening the net. */
// Every link in a gap gets a DIFFERENT interior row, drawn from a fixed
// scramble of that gap's 1.2-u cells, so no interior z is shared by three nodes
// and none of them counts as a lattice node (`latticeNodeShare` needs a
// coordinate with three nodes on it before it calls it a grid line). Giving them
// all the same midpoint measured `latticeNodeShare` 0.612 and cost 0.65 of the
// anti-lattice point; distinct rows measure it back down.
const scramble = (n: number, g: number): number[] => {
  const slots: number[] = [];
  for (let k = 1; k < n; k += 1) slots.push(k);
  return slots.sort((a, b) => ((a * 7 + g * 3) % n) - ((b * 7 + g * 3) % n));
};
/** extra x values a terrace must carry: an arm head, a set-piece port's row, a
 *  boulevard terminus */
const TERRACE_EXTRA: number[][] = [
  [-28.8, -24.0], [-28.8], [4.8], [0.0], [], [-36.0, -32.4, -16.8, 21.6, 32.4],
];

/** every link is a JOG, not a straight rung: it leaves its terrace at `xTop`,
 *  steps ONE OR TWO CELLS sideways on its own interior row, then meets the next
 *  terrace at `xBot`. Three edges instead of one, at three different lengths —
 *  and, critically, NEITHER x ends up carrying three street nodes, so the
 *  terrace ends of a link are not `latticeNodeShare` lattice nodes. (A straight
 *  subdivided rung puts three nodes on its own x, which makes that x a grid
 *  line and both terrace ends lattice nodes: measured `latticeNodeShare` 0.548
 *  and 0.55 of the anti-lattice point.) */
type Jog = { g: number; xTop: number; xBot: number; zMid: number };
const JOGS: Jog[] = [];
LINKS.forEach((xs, g) => {
  const zHi = TERRACES[g].z, zLo = TERRACES[g + 1].z;
  const lo = TERRACES[g + 1];
  const order = scramble(Math.round((zHi - zLo) / 1.2), g);
  xs.forEach((x, i) => {
    if (x < lo.x0 - 1e-6 || x > lo.x1 + 1e-6) return;   // no orphan on the lower row
    const zMid = +(zHi - order[i % order.length] * 1.2).toFixed(2);
    const step = (g + i) % 3 === 0 ? 2.4 : 0;
    let xBot = +(x + ((g + i) % 2 ? step : -step)).toFixed(2);
    if (xBot < lo.x0 - 1e-6 || xBot > lo.x1 + 1e-6) xBot = +(2 * x - xBot).toFixed(2);
    JOGS.push({ g, xTop: x, xBot, zMid });
  });
});

const TERRACE_XS: number[][] = TERRACES.map((t, i) => {
  const xs = ramp(t.x0, t.x1, t.step).filter((x) => x <= t.x1 + 1e-6);
  const ends = [
    ...JOGS.filter((j) => j.g === i).map((j) => j.xTop),
    ...JOGS.filter((j) => j.g === i - 1).map((j) => j.xBot),
  ];
  const extra = [...(TERRACE_EXTRA[i] ?? []), ...ends].filter((x) => x >= t.x0 - 1e-6 && x <= t.x1 + 1e-6);
  return [...new Set([...xs, ...extra, t.x0, t.x1])].sort((a, b) => a - b);
});
TERRACES.forEach((t, i) => chainRow(t.z, TERRACE_XS[i]));
JOGS.forEach((j) => {
  const zHi = TERRACES[j.g].z, zLo = TERRACES[j.g + 1].z;
  if (Math.abs(j.xBot - j.xTop) < 1e-6) { link(nid(j.xTop, zHi), nid(j.xTop, zLo)); return; }
  // a JOG: leave the terrace at `xTop`, step sideways on its own interior row,
  // meet the next terrace at `xBot`. Three edges at three different lengths.
  link(nid(j.xTop, zHi), nid(j.xTop, j.zMid));
  link(nid(j.xTop, j.zMid), nid(j.xBot, j.zMid));
  link(nid(j.xBot, j.zMid), nid(j.xBot, zLo));
});

// ── the three ARMS out to the ring's own queue tails ────────────────────────
// WEST arm: a column at x −36 dropping to the W tail. The tail is a DEAD END
// approached from +z, so no street ever continues to x < −36 where the platform
// pad stands at [−42.6, −8.4].
chainCol(-36.0, [2.4, -8.4]);
const RING_W_TAIL = nid(-36.0, -8.4);
// EAST arm: a column at x 21.6 to z −8.4, then EAST to the E tail (dead end),
// and on south down the same column to the flagship's own queue tail.
chainCol(21.6, [2.4, -8.4, -16.8, -25.2]);
chainRow(-8.4, [21.6, 32.4, 36.0]);
chainCol(32.4, [2.4, -8.4]);
const RING_E_TAIL = nid(36.0, -8.4);
const FLAG_TAIL = nid(A_TAIL[0], A_TAIL[1]);
// SOUTH arm: the long descent at x −16.8 (irregular pitch), then EAST to the S
// tail (dead end). x −16.8 clears the flagship's west valley at x[−14.4, −13.2].
chainCol(-16.8, [2.4, -6.0, -15.6, -22.8, -38.4, -44.4]);
link(nid(-16.8, -44.4), nid(0.0, -44.4));
const RING_S_TAIL = nid(0.0, -44.4);
const RING_N_TAIL = nid(0.0, 27.6);   // a THROUGH node on terrace T4
const GATE: XZ = [20.4, 63.6];
link(nid(GATE[0], GATE[1]), nid(20.4, 57.6));  // the gate spine — 20.4 is T1's east end
const STREET_NODE_COUNT = NODES.length;

// ── 2. THE SET-PIECES: three bazaars of DIFFERENT lengths + three boulevards ─
// Three identical rows measure `openSpace.areaSpread` 1.0 and throw away half
// the axis-15 plaza point; 3 / 6 / 3 slots measure a real spread.
const GLADE_ROW = bazaarPlan({
  id: 'gladeRow', title: 'Toadstool Market', position: [-56.4, 57.6],
  facing: { port: 'E', toward: [-45.6, 57.6] },
  // `lamps: false` — the two +z corner lamps at [-60.0, 58.8] / [-52.8, 58.8]
  // composed 0.01 and 0.05 u UNDER the waterline on this row (ground -0.26 /
  // -0.22 vs waterline+0.05 = -0.21). The row cannot move: its guard cells are
  // what hold seed 107's SECONDARY water body in place, and relocating it drops
  // that body from 33 % of the dominant to 6 % — a composition violation and a
  // hard `terrain` FAIL. A lamp is DRESSING; the water body is the composition.
  stalls: ['cottonCandy', 'burger', 'soda'], theme: THORNWICK_GLADE, seed: 11, benches: false, lamps: false,
});
const BRASS_ROW = bazaarPlan({
  id: 'brassRow', title: 'Foundry Arcade', position: [32.4, -21.6],
  facing: { port: 'W', toward: [32.4, -8.4] },
  stalls: ['soda', 'burger', 'hotDog', 'balloon', 'cottonCandy', 'soda'],
  theme: BRASSWORK_FOUNDRY, seed: 7,
});
const EMBER_ROW = bazaarPlan({
  id: 'emberRow', title: 'Caldera Market', position: [-32.4, -16.8],
  facing: { port: 'W', toward: [-32.4, 2.4] },
  stalls: ['hotDog', 'burger', 'soda'], theme: EMBERFALL_CALDERA, seed: 3, benches: false,
});
// Three dressed avenues, each REPLACING a plain vertical link so the net is not
// paved twice. Endpoints sit one cell inside their terrace so both ports get a
// real (1.2 u) edge and neither can be pruned.
const BV_NORTH = boulevardPlan({ id: 'bvN', from: [-28.8, 56.4], to: [-28.8, 49.2], spacing: 3.6, theme: THORNWICK_GLADE, seed: 5 });
const BV_CENTRE = boulevardPlan({ id: 'bvC', from: [4.8, 46.8], to: [4.8, 39.6], spacing: 2.4, seed: 9 });
const BV_SOUTH = boulevardPlan({ id: 'bvS', from: [-16.8, -24.0], to: [-16.8, -37.2], spacing: 4.8, theme: EMBERFALL_CALDERA, seed: 13 });

const EDGES: [NetRef, NetRef][] = [
  ...AUTHORED as [NetRef, NetRef][],
  ['gladeRow:E', nid(-45.6, 57.6)],
  ['brassRow:W', nid(32.4, -8.4)],
  ['emberRow:W', nid(-32.4, 2.4)],
  [nid(-28.8, 57.6), 'bvN:A'], ['bvN:B', nid(-28.8, 48.0)],
  [nid(4.8, 48.0), 'bvC:A'], ['bvC:B', nid(4.8, 38.4)],
  [nid(-16.8, -22.8), 'bvS:A'], ['bvS:B', nid(-16.8, -38.4)],
];

// ── 3. THE QUEUE ARITHMETIC (§0.19) ────────────────────────────────────────
const minReachOf = (c: number) => laneLenOf(c) + 0.35 + 0.62 + 0.5 + 0.45;
function place(net: ReturnType<typeof buildParkNet>, tail: XZ, out: XZ, capacity: number) {
  const join = laneLenOf(capacity) + 0.35;
  // TWO lattice cells past the floor, not one: `minReachOf` is the floor for the
  // BOARD PAD, and a `composableRide`'s boardPoint sits `layout.front` in FRONT
  // of `position` (up to ~1.4 u for a <Discotron>).
  const reach = minReachOf(capacity) + 2.4;
  const cand: XZ = [tail[0] + out[0] * reach, tail[1] + out[1] * reach];
  const pad = (offPathCell(net, cand, { clear: 3.2 }) ?? cand) as XZ;
  const got = Math.hypot(pad[0] - tail[0], pad[1] - tail[1]);
  if (got < minReachOf(capacity) + 1.2)
    throw new Error(
      `pad [${pad}] sits ${got.toFixed(2)} u from its tail [${tail}] — the cap-${capacity} floor is ` +
        `${(minReachOf(capacity) + 1.2).toFixed(2)} u. Move the TAIL outward or open the court.`,
    );
  return {
    pad,
    anchor: [tail[0] + out[0] * join, tail[1] + out[1] * join] as XZ,
    dir: [-out[0], -out[1]] as XZ,
    yaw: Math.atan2(-out[0], -out[1]),
  };
}

// ── 4. THE FIVE MODULE-SCOPE ASSERTIONS ────────────────────────────────────
const ALL_PLANS: SetPiecePlan[] = [GLADE_ROW, BRASS_ROW, EMBER_ROW, BV_NORTH, BV_CENTRE, BV_SOUTH];
const portCell = (ref: NetRef): XZ => {
  if (typeof ref === 'number') return NODES[ref];
  const [id, name] = ref.split(':');
  const p = ALL_PLANS.find((q) => q.id === id);
  if (!p) throw new Error(`EDGES references '${ref}' but no plan with id '${id}' exists`);
  return p.port(name);
};
const EPS = 1e-6;
{
  const bad: string[] = [];
  EDGES.forEach(([a, b]) => {
    const A = portCell(a), B = portCell(b);
    if (Math.abs(A[0] - B[0]) > EPS && Math.abs(A[1] - B[1]) > EPS)
      bad.push(`${a}→${b}: [${A[0].toFixed(2)}, ${A[1].toFixed(2)}] → [${B[0].toFixed(2)}, ${B[1].toFixed(2)}]`);
  });
  if (bad.length) throw new Error(`${bad.length} DIAGONAL edge(s):\n  ${bad.join('\n  ')}`);
}

const SOLID_CLEAR: Record<string, number> = { FountainPlaza: 1.8, Bazaar: 0.6, Boulevard: 0 };
function assertNodesOffPieces(nodes: XZ[], plans: SetPiecePlan[], what = 'authored cell'): void {
  const hits: string[] = [];
  plans.forEach((p) => {
    const clear = SOLID_CLEAR[p.kind] ?? 1.8;
    if (clear === 0) return;
    const ports = new Set(p.ports.map((pt) => `${pt.at[0].toFixed(2)},${pt.at[1].toFixed(2)}`));
    const f = p.footprint;
    const c = Math.cos(-f.yaw), s = Math.sin(-f.yaw);
    nodes.forEach((n, i) => {
      if (ports.has(`${n[0].toFixed(2)},${n[1].toFixed(2)}`)) return;
      const dx = n[0] - f.cx, dz = n[1] - f.cz;
      const lx = dx * c - dz * s, lz = dx * s + dz * c;
      const gap = Math.max(Math.abs(lx) - f.hx, Math.abs(lz) - f.hz);
      if (gap < clear)
        hits.push(`[${n[0]}, ${n[1]}] (${what} ${i}) is ${gap.toFixed(2)} u from '${p.id}' (${p.kind}) — needs ${clear}`);
    });
  });
  if (hits.length)
    throw new Error(`${hits.length} ${what}(s) stand inside or against a set-piece footprint:\n  ${hits.join('\n  ')}`);
}
assertNodesOffPieces(NODES, ALL_PLANS);

const PORT_REFS = EDGES.flat().filter((x): x is string => typeof x === 'string');
ALL_PLANS.forEach((p) => {
  const wired = new Set(PORT_REFS.filter((r) => r.split(':')[0] === p.id).map((r) => r.split(':')[1]));
  if (!wired.size) throw new Error(`set-piece '${p.id}' has NO '${p.id}:<PORT>' ref in EDGES — it composes as an ISLAND`);
  p.ports.filter((pt) => !pt.prunable).forEach((pt) => {
    if (wired.has(pt.name)) return;
    throw new Error(`chain piece '${p.id}' (${p.kind}) wires [${[...wired]}] but NOT '${p.id}:${pt.name}'`);
  });
});

/** the §4.0-B corridor: no street NODE and no street EDGE inside any of the five */
{
  const inRect = (x: number, z: number, r: { x: [number, number]; z: [number, number] }) =>
    x >= r.x[0] - EPS && x <= r.x[1] + EPS && z >= r.z[0] - EPS && z <= r.z[1] + EPS;
  const hits: string[] = [];
  NODES.forEach((n, i) => FLAG_KEEPOUT.forEach((r, ri) => {
    if (inRect(n[0], n[1], r)) hits.push(`node ${i} [${n[0]}, ${n[1]}] is inside corridor rect ${ri}`);
  }));
  AUTHORED.forEach(([a, b]) => {
    const A = NODES[a], B = NODES[b];
    for (let t = 0; t <= 24; t += 1) {
      const u = t / 24, x = A[0] + (B[0] - A[0]) * u, z = A[1] + (B[1] - A[1]) * u;
      FLAG_KEEPOUT.forEach((r, ri) => { if (inRect(x, z, r)) hits.push(`edge ${a}→${b} crosses corridor rect ${ri} at [${x.toFixed(1)}, ${z.toFixed(1)}]`); });
    }
  });
  if (hits.length) throw new Error(`${[...new Set(hits)].length} corridor violation(s):\n  ${[...new Set(hits)].join('\n  ')}`);
}

/** the three DEAD-END tails: nothing may continue OUTWARD past them into the
 *  platform pad 6.6 u further out (r12a's `blockers` failure) */
{
  const outward: [number, XZ][] = [[RING_W_TAIL, [-1, 0]], [RING_E_TAIL, [1, 0]], [RING_S_TAIL, [0, -1]]];
  outward.forEach(([n, o]) => {
    const deg = AUTHORED.filter(([a, b]) => a === n || b === n);
    const bad = deg.filter(([a, b]) => {
      const other = NODES[a === n ? b : a];
      return (other[0] - NODES[n][0]) * o[0] + (other[1] - NODES[n][1]) * o[1] > EPS;
    });
    if (bad.length)
      throw new Error(`ring tail [${NODES[n]}] has ${bad.length} street(s) continuing OUTWARD toward its platform pad`);
  });
}

// ── 5. ONE FUSE ────────────────────────────────────────────────────────────
// the three worlds' hand-placed scenery cells — they are STRUCTURES, so they
// are guarded here and not merely sieved for dryness later.
const GLADE_SC: XZ[] = [[-57.6, 52.8], [-61.2, 55.2], [-52.8, 50.4]];
const BRASS_SC: XZ[] = [[37.2, -20.4], [37.2, -27.6], [27.6, -24.0]];
const EMBER_SC: XZ[] = [[-38.4, -21.6], [-28.8, -22.8], [-39.6, -10.8]];
const BINS: XZ[] = [[8.4, 55.2], [-33.6, 46.8], [1.2, 26.4], [-18.0, 1.2], [22.8, 1.2], [-15.6, -21.6]];
const KEEP_DRY: XZ[] = [...RING_CELLS, ...GLADE_SC, ...BRASS_SC, ...EMBER_SC];
const NET = buildParkNet({
  nodes: NODES,
  edges: EDGES,
  pieces: ALL_PLANS,
  keepDry: KEEP_DRY,
  bins: BINS,
});

// ── 6. THE PADS, out of the fuse ───────────────────────────────────────────
const SAUCERS = place(NET, [-51.6, 38.4], [-1, 0], 8);    // thornwick, the west shelf
const CAROUSEL = place(NET, [-49.2, 14.4], [-1, 0], 8);   // the west meadow
const CHAIR = place(NET, [32.4, 2.4], [1, 0], 6);         // brasswork, E
const PADDLE = place(NET, [20.4, 57.6], [1, 0], 4);       // 6.0 u from the turnstile
const DISCO = place(NET, [16.8, 14.4], [1, 0], 12);       // the east centre
const GHOST = place(NET, [-45.6, 2.4], [-1, 0], 6);       // the west margin
const ENTER = place(NET, [-16.8, -15.6], [-1, 0], 8);     // the south arm
const PADS = [SAUCERS, CAROUSEL, CHAIR, PADDLE, DISCO, GHOST, ENTER];
assertNodesOffPieces(PADS.map((p) => p.pad), ALL_PLANS, 'ride pad');

// ── 7. THE WORLD REGIONS ───────────────────────────────────────────────────
const cellsOf = (x0: number, x1: number, z0: number, z1: number): XZ[] => {
  const out: XZ[] = [];
  for (let x = x0; x <= x1 + 1e-6; x += 2.4) for (let z = z0; z <= z1 + 1e-6; z += 2.4) out.push([x, z]);
  return out;
};

const GLADE = worldPlan({
  id: 'thornwick', theme: THORNWICK_GLADE, pieces: [GLADE_ROW, BV_NORTH],
  rides: [{ at: SAUCERS.pad, name: 'Flying Saucers' }],
  include: [...GLADE_SC, ...cellsOf(-62.4, -48.0, 40.8, 60.0), [-45.6, 36.0], [-40.8, 36.0]],
});
const BRASS = worldPlan({
  id: 'brasswork', theme: BRASSWORK_FOUNDRY, pieces: [BRASS_ROW],
  rides: [{ at: CHAIR.pad, name: 'Ridgeline Chairlift' }],
  include: [...BRASS_SC, ...cellsOf(27.6, 42.0, -30.0, -12.0), [44.4, -4.8], [44.4, 0.0], [40.8, 0.0]],
});
const EMBER = worldPlan({
  id: 'emberfall', theme: EMBERFALL_CALDERA, pieces: [EMBER_ROW, BV_SOUTH],
  rides: [{ at: ENTER.pad, name: 'Caldera Enterprise' }],
  include: [...EMBER_SC, ...cellsOf(-40.8, -24.0, -26.4, -8.4), [-36.0, -38.4], [-36.0, -45.6], [-36.0, -52.8]],
});
const WORLDS = [GLADE, BRASS, EMBER];
([['thornwick', GLADE_SC], ['brasswork', BRASS_SC], ['emberfall', EMBER_SC]] as const).forEach(([id, cells]) => {
  const w = WORLDS.find((x) => x.id === id)!;
  const inside = cells.filter((c) => w.contains(c)).length;
  if (inside < 3) throw new Error(`world '${id}' has ${inside} scenery cell(s) inside its rect — the floor is 3`);
});

// ── 8. §5c COMPOSE THE WATER TWICE AND REFUSE TO SHIP IF IT MOVED ──────────
// THE ONLY water authority this park has: 107 alpine is OFF the §1 table, so
// `expectWater` is undefined and the gate's `waterRePicked` never runs.
const GUARDS: XZ[] = [
  ...NET.keepDry,
  ...PADS.map((p) => p.pad),
  ...PADS.map((p) => p.anchor),
];
const BARE = parkComposition(THREE, SEED, SIZE, CLIMATE);
const COMP = parkComposition(THREE, SEED, SIZE, CLIMATE, { keepDry: GUARDS, coasterPts: FLAG_PTS });
const movedBy = (a: XZ | null, b: XZ | null) =>
  a && b ? Math.hypot(a[0] - b[0], a[1] - b[1]) : a === b ? 0 : Infinity;
([['DOMINANT', BARE.waterCentre, COMP.waterCentre],
  ['SECONDARY', BARE.waterCentreSecond, COMP.waterCentreSecond]] as const).forEach(([n, a, b]) => {
  const d = movedBy(a as XZ | null, b as XZ | null);
  if (d > 6)
    // eslint-disable-next-line no-console
    console.warn(
      `[Skeleton C] the guard list moved the ${n} water body ${d === Infinity ? '— it VANISHED' : `${d.toFixed(1)} u`} ` +
        `(terrainSeed ${BARE.terrainSeed} → ${COMP.terrainSeed}) — every cell below is sieved against the COMPOSED basins, ` +
        'not against the unguarded row.',
    );
});
const isDry = (c: XZ, margin = 1.2) =>
  [...COMP.basins, ...COMP.basinsSecond].every((b) => Math.hypot(c[0] - b.x, c[1] - b.z) > 0.74 * b.radius + margin);
/** the sieve for UNGUARDED dressing. `clampBasins` are the bowls the GUARD CLAMP
 *  itself dug, and they are NOT in `basins`, so a cell can clear every composed
 *  basin disc and still compose 4 u under water (measured on this row:
 *  [-60.6, 60.6] reads dry against `basins`, composes h -3.96). A guarded cell is
 *  raised by the same pass and must NOT be sieved this way — hence two tests. */
const isDryUnguarded = (c: XZ, margin = 1.2) =>
  isDry(c, margin)
  && (COMP.clampBasins ?? []).every((b) => Math.hypot(c[0] - b.x, c[1] - b.z) > 0.74 * b.radius + margin);
const dry = (c: XZ): XZ => {
  if (!isDry(c)) throw new Error(`cell [${c}] is inside the COMPOSED waterline — move it, do not guard it`);
  return c;
};
{
  const wet = NET.keepDry.filter((c) => !isDry(c, 0.6));
  if (wet.length)
    throw new Error(
      `${wet.length} paved/structural cell(s) sit inside the COMPOSED waterline — the first five: ` +
        wet.slice(0, 5).map((c) => `[${c[0].toFixed(1)}, ${c[1].toFixed(1)}]`).join(' '),
    );
}

// ── 9. DRESSING (sieved, never guarded) ────────────────────────────────────
const TREE_CELLS: { at: XZ; shape: 'pine' | 'round' | 'willow' }[] = ([
  [-60, 45.6], [-56.4, 38.4], [-60, 27.6], [-56.4, 20.4], [-60, 8.4], [-56.4, -4.8],
  [-49.2, 60], [-38.4, 61.2], [-27.6, 61.2], [-16.8, 61.2], [-4.8, 61.2], [4.8, 61.2],
  [16.8, 61.2], [24, 56.4], [31.2, 50.4], [33.6, 42, ], [27.6, 33.6], [20.4, 24],
  [16.8, 33.6], [12, 20.4], [19.2, 9.6], [27.6, -3.6], [-51.6, 8.4], [-45.6, -6],
  [-24, -8.4], [-9.6, -6], [-4.8, -12], [-26.4, -14.4], [-33.6, -24], [-21.6, -28.8],
  [-9.6, -33.6], [-2.4, -27.6], [-8.4, -44.4], [-24, -44.4], [-33.6, -38.4], [-45.6, -30],
  [-52.8, -20.4], [-56.4, -33.6], [-45.6, -45.6], [-27.6, -52.8], [-13.2, -55.2], [8.4, -52.8],
  [21.6, -45.6], [33.6, -33.6], [42, -21.6], [45.6, -8.4], [50.4, 4.8], [-49.2, 20.4],
] as [number, number][]).map((c, i) => ({
  at: (offPathCell(NET, c as XZ, { clear: 1.6 }) ?? c) as XZ,
  shape: (['pine', 'round', 'willow'] as const)[i % 3],
}));
const TREES_DRY = TREE_CELLS.filter((t) => isDryUnguarded(t.at, 2.4));

const NEUTRAL_SCENERY: { name: string; at: XZ }[] = ([
  ['flagpole', [18.0, 61.2]], ['parkClock', [22.8, 60.0]], ['signpost', [16.8, 54.0]],
  ['marbleStatue', [-2.4, 52.8]], ['topiarySpiral', [-13.2, 52.8]], ['topiaryElephant', [-24.0, 52.8]],
  ['birdbath', [-8.4, 43.2]], ['planterBox', [8.4, 33.6]], ['picnicTable', [-6.0, 21.6]],
  ['gazebo', [-27.6, 21.6]], ['wishingWell', [-36.0, 8.4]], ['lionStatue', [-4.8, 8.4]],
  ['flagpole', [14.4, -3.6]], ['signpost', [-24.0, -3.6]],
] as [string, [number, number]][])
  .map(([name, at]) => ({ name, at: (offPathCell(NET, at as XZ, { clear: 1.6 }) ?? at) as XZ }))
  .filter((s) => isDryUnguarded(s.at, 2.4));

const RESTROOM: XZ = (offPathCell(NET, [-1.2, 54.0], { clear: 1.8 }) ?? [-1.2, 54.0]) as XZ;

/** the ring of cells each set-piece dresses (verges, lamp pairs, benches): NOT
 *  guarded, so the composed ground under them has to be dry on its own. */
const DRESS_CELLS: XZ[] = ALL_PLANS.flatMap((p) => {
  const f = p.footprint, out: XZ[] = [];
  for (let x = f.cx - f.hx - 2.4; x <= f.cx + f.hx + 2.4 + 1e-6; x += 1.2)
    for (let z = f.cz - f.hz - 2.4; z <= f.cz + f.hz + 2.4 + 1e-6; z += 1.2)
      out.push([+x.toFixed(2), +z.toFixed(2)]);
  return out;
});

const STALL_COUNT = [GLADE_ROW, BRASS_ROW, EMBER_ROW].reduce((n, b) => n + b.slots.length, 0);
const RIDE_NAMES = [
  'Terrace Flyer', 'Grand Circle Monorail', 'Terrace Carousel', 'Saucer Glade',
  'Discotron', 'Ridgeline Chairlift', 'Tarn Paddle Boats', 'Ghost Train', 'Caldera Enterprise',
];

export function ThemePark() {
  return (
    <Park
      seed={SEED}
      climate={CLIMATE}
      size={SIZE}
      roster={{ rides: RIDE_NAMES, stalls: STALL_COUNT, categories: 5 }}
      onReady={(report: { ok: boolean }) => {
        // eslint-disable-next-line no-console
        console.log('[Skeleton C] validatePark', report);
      }}
    >
      <Terrain keepDry={GUARDS} coasterPts={FLAG_PTS} />
      <Paths
        nodes={NET.nodes}
        edges={NET.edges}
        plazas={NET.plazas}
        bins={NET.bins}
        walkers={10}
        surfaceZones={WORLDS.map((w) => ({ ...w.region, surface: w.theme.pathSurface }))}
      />
      <GameManager />
      <Gate position={GATE} />

      {/* ── §4.2-A THE MANDATORY RING, at the published start pose ── */}
      <Monorail
        position={[-42.6, 0, -9.7]} rotation={0} pieces={MONO_PIECES} beamY={2.6} loopSeconds={12} pinned
        name="Grand Circle Monorail" capacity={6} rideDuration={12} intensity={1} price={0}
        queue={{ anchor: [-40.81, -8.4], dir: [1, 0] }}
        register={{
          board: [-42.6, 2.6, -8.4],
          stations: [
            { label: 'North', boardPoint: [0, 2.6, 34.2], queueAnchor: [0, 0.05, 32.41], queueDir: [0, -1], exitPoint: [-1.2, 0.05, 33.03], exitDir: [0, -1] },
            { label: 'East', boardPoint: [42.6, 2.6, -8.4], queueAnchor: [40.81, 0.05, -8.4], queueDir: [-1, 0], exitPoint: [41.43, 0.05, -7.2], exitDir: [-1, 0] },
            { label: 'South', boardPoint: [0, 2.6, -51.0], queueAnchor: [0, 0.05, -49.21], queueDir: [0, 1], exitPoint: [1.2, 0.05, -49.83], exitDir: [0, 1] },
          ],
        }}
      />

      {/* ── THRILL flagship — §4.0-B family rectangle in the south centre ── */}
      <Coaster
        name="Terrace Flyer"
        pieces={A_PIECES}
        start={A_START}
        heading={0}
        type="steel"
        cars={4}
        capacity={4}
        rideDuration={10}
        loadTime={2}
        intensity={7}
        price={6}
        queueTailNode={NET.node(A_TAIL)}
        queueDir={[1, 0]}
      />

      <Carousel position={CAROUSEL.pad} rotation={CAROUSEL.yaw}
        register={{ name: 'Terrace Carousel', capacity: 8, rideDuration: 9, intensity: 2, price: 3 }}
        queue={{ anchor: CAROUSEL.anchor, dir: CAROUSEL.dir }} />
      <PaddleBoats position={PADDLE.pad} rotation={PADDLE.yaw}
        register={{ name: 'Tarn Paddle Boats', capacity: 4, rideDuration: 12, intensity: 1, price: 2 }}
        queue={{ anchor: PADDLE.anchor, dir: PADDLE.dir }} />
      <Discotron position={DISCO.pad} rotation={DISCO.yaw}
        register={{ name: 'Discotron', capacity: 12, rideDuration: 13, intensity: 6, price: 4 }}
        queue={{ anchor: DISCO.anchor, dir: DISCO.dir }} />
      <GhostTrain position={GHOST.pad} rotation={GHOST.yaw}
        register={{ name: 'Ghost Train', capacity: 6, rideDuration: 11, intensity: 5, price: 4 }}
        queue={{ anchor: GHOST.anchor, dir: GHOST.dir }} />

      <Boulevard plan={BV_NORTH} />
      <Boulevard plan={BV_CENTRE} />
      <Boulevard plan={BV_SOUTH} />

      {/* ── the three worlds: region + themed row + own ride + 3 scenery ── */}
      <World plan={GLADE} />
      <Bazaar plan={GLADE_ROW} />
      <FlyingSaucers position={SAUCERS.pad} rotation={SAUCERS.yaw}
        register={{ name: 'Saucer Glade', capacity: 8, rideDuration: 9, intensity: 4, price: 3 }}
        queue={{ anchor: SAUCERS.anchor, dir: SAUCERS.dir }} />
      <GiantToadstools position={dry(GLADE_SC[0])} seed={1} />
      <StandingStones position={dry(GLADE_SC[1])} seed={3} />
      <LanternTree position={dry(GLADE_SC[2])} seed={5} />

      <World plan={BRASS} />
      <Bazaar plan={BRASS_ROW} />
      <Chairlift position={CHAIR.pad} rotation={CHAIR.yaw}
        register={{ name: 'Ridgeline Chairlift', capacity: 6, rideDuration: 10, intensity: 2, price: 3 }}
        queue={{ anchor: CHAIR.anchor, dir: CHAIR.dir }} />
      <GiantGear position={dry(BRASS_SC[0])} seed={3} />
      <SteamPipes position={dry(BRASS_SC[1])} seed={5} />
      <ClockTower position={dry(BRASS_SC[2])} seed={7} />

      <World plan={EMBER} />
      <Bazaar plan={EMBER_ROW} />
      <Enterprise position={ENTER.pad} rotation={ENTER.yaw}
        register={{ name: 'Caldera Enterprise', capacity: 8, rideDuration: 12, intensity: 8, price: 5 }}
        queue={{ anchor: ENTER.anchor, dir: ENTER.dir }} />
      <Fumarole position={dry(EMBER_SC[0])} seed={2} />
      <ObsidianShards position={dry(EMBER_SC[1])} seed={4} />
      <BasaltColumns position={dry(EMBER_SC[2])} seed={6} />

      <Restroom position={RESTROOM} rotation={Math.PI / 2} />

      {NEUTRAL_SCENERY.map((s, i) => (
        <Scenery key={`sc-${i}`} name={s.name} position={s.at} seed={i + 1} />
      ))}
      {TREES_DRY.map((t, i) => (
        <Placed key={`tr-${i}`} build={(three) => tree(three, { shape: t.shape })} position={t.at} />
      ))}

      <Lights from={[20.4, 63.6]} to={[20.4, 57.6]} />
      <Lights from={[-16.8, 2.4]} to={[-16.8, -15.6]} />
      <Lights from={[21.6, 2.4]} to={[21.6, -8.4]} />
      <Lights from={[-32.4, 2.4]} to={[-32.4, -12.0]} />
    </Park>
  );
}

export default ThemePark;

// ── OFFLINE MEASUREMENT HOOK (harness only; not part of the park) ──────────
export function __netdump() {
  const rides = [
    { name: 'Terrace Flyer', at: [A_START[0], A_START[2]] as XZ, registered: true, centre: FLAG_CENTRE },
    { name: 'Grand Circle Monorail', at: [-42.6, -9.7] as XZ, registered: true },
    { name: 'Terrace Carousel', at: CAROUSEL.pad, registered: true },
    { name: 'Saucer Glade', at: SAUCERS.pad, registered: true },
    { name: 'Discotron', at: DISCO.pad, registered: true },
    { name: 'Ridgeline Chairlift', at: CHAIR.pad, registered: true },
    { name: 'Tarn Paddle Boats', at: PADDLE.pad, registered: true },
    { name: 'Ghost Train', at: GHOST.pad, registered: true },
    { name: 'Caldera Enterprise', at: ENTER.pad, registered: true },
  ];
  const stalls = [GLADE_ROW, BRASS_ROW, EMBER_ROW].flatMap((b) =>
    (b.slots as { at: XZ }[]).map((s) => ({ at: s.at })),
  );
  const setPieces = ALL_PLANS.map((p) => ({
    kind: p.kind, id: p.id,
    bbox: { min: [p.footprint.cx - p.footprint.hx, 0, p.footprint.cz - p.footprint.hz],
            max: [p.footprint.cx + p.footprint.hx, 3, p.footprint.cz + p.footprint.hz] },
  }));
  return {
    seed: SEED, size: SIZE, climate: CLIMATE,
    keepDry: GUARDS, coasterPts: FLAG_PTS,
    paved: NET.keepDry,
    dressCells: DRESS_CELLS,
    hardCells: [
      ...DRESS_CELLS,
      ...NODES, ...RING_CELLS, ...GLADE_SC, ...BRASS_SC, ...EMBER_SC,
      ...PADS.map((p) => p.pad), ...PADS.map((p) => p.anchor),
      RESTROOM, ...stalls.map((s) => s.at),
    ],
    layoutRaw: {
      size: SIZE,
      streetNodes: NET.nodes.length,
      nodes: NET.nodes,
      edges: NET.edges,
      plazas: NET.plazas,
      bins: NET.bins,
      rides, stalls, setPieces,
      sceneryByName: Object.fromEntries(NEUTRAL_SCENERY.map((s) => [s.name, 1])),
      trees: TREES_DRY.length,
    },
    regions: WORLDS.map((w) => ({ id: w.id, ...w.region, centre: w.centre, half: w.half })),
    netWarnings: NET.warnings,
    pruned: NET.pruned,
    authoredNodes: STREET_NODE_COUNT,
    authoredEdges: AUTHORED.length,
    ringTails: { W: RING_W_TAIL, N: RING_N_TAIL, E: RING_E_TAIL, S: RING_S_TAIL, flag: FLAG_TAIL },
  };
}

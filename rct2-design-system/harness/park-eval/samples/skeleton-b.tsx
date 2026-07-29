/*
 * SKELETON B — "THE NORTH PROMENADE AND THE THREE OUTER COURTS".
 *
 * §0 PRE-FLIGHT (all arithmetic COUNTED FROM THIS FILE)
 *
 * SEED   seed=1 climate="temperate" size=128.  §5c's re-compose runs at module
 *        scope and IS THE AUTHORITY on the water: DOMINANT and SECONDARY
 *        centroids must not move > 6 u (measured: 0.0 u and 0.0 u, terrainSeed
 *        16 → 16).  §1-W's basin-box `assertKeepDryOffRow` is a cheap
 *        PRE-FILTER only — its boxes bound the basin CHAIN, so they are
 *        narrower than the real bowls on some rows and wider than the water on
 *        others.  Never ship on the sieve alone; re-compose.
 * GATE   [-14.4, 63.6] on the +z rim (OFF-CENTRE — not the [0, 63.6] cell the
 *        published skeleton uses).  Nearest queue tail [-14.4, 57.6] = 6.0 u.
 * SHAPE  a "Z" TREE, not a hub-and-spokes: a NORTH PROMENADE outside the ring
 *        (z = 45.6, x -60 … +58), ONE descent under the north beam at x = 24.0,
 *        an EAST ARTERIAL down that column to z = -19.2, and one LONG WEST ROW
 *        along z = -19.2 out to x = -48.  Everything else is a short spur off
 *        those three runs.  The coaster stands in the free plot CENTRE they
 *        enclose.  Zero cycles (58 nodes / 57 edges — still exactly n-1).  Three
 *        of the four monorail queue tails are DEAD ENDS approached from the ring's
 *        INTERIOR; the SOUTH one is approached from OUTSIDE, along a fourth long
 *        run — the SOUTH SHELF at z = -57.6, hung off the SW court's own market
 *        aisle.  See SUMMIT: the interior approach is what was flattening the seed.
 *        A street continuing PAST any tail would run through the platform pad
 *        (`blockers`), so all four are still leaves.
 * SUMMIT THE SEED'S PRIMARY RANGE IS NOT WHERE THE UNGUARDED ROW SAYS. Measured on
 *        THIS guard cloud (and on skeleton A's, a different cloud, which gets the
 *        SAME answer): no slot in `composeHills`' jittered ring is clear of a dense
 *        128 layout at `GUARD_SLOT_K` (rangeR 31.0 -> it wants a 19.2 u guard-free
 *        disc), so the primary alpine range falls through to the phase-1 fallback
 *        walk, which is guard-BLIND and lands in the same place whatever you
 *        author: a FIVE-PEAK RIDGE along z ~ -43, summit (5.33, -42.89) h 8.59
 *        r 12.09, peaks at x -13.8 / -5.8 / +5.3 / +19.2 / +29.9.  Its skirt is
 *        CONTINUOUS from x -23 to x +38.6, so the ONLY dry southbound corridors on
 *        this row are x <= -23 and x >= +38.6 — and the second one is the SE lake.
 *        `capPeakForCells(p, keep, 0.35)` shaves a peak to `0.35 / s(d)`, so a
 *        guard cell must stand >= 10.62 u off that summit to cost it nothing.
 *        The published INWARD south queue put its tail at [0, -44.4] — 5.5 u — and
 *        the spur 18 -> 19 paved [0, -42.0] / [0, -43.2] on the way: measured, that
 *        cut the summit 8.59 -> 0.83 and its neighbour 5.93 -> 1.50, i.e.
 *        reliefFloor `keptStdH` 0.73 and probe `terrain.stdH` 0.71 — under axis 7's
 *        0.75 floor, for 1.5 points.
 *        THE REPAIR: the SOUTH platform queues OUTWARD (tail [0, -57.6]) and is
 *        reached emberRow:E -> 26 -> 19, i.e. through the Caldera Market aisle and
 *        east along z = -57.6.  Every cell of that approach is >= 14.7 u off the
 *        summit.  The ring's own DECK [0, -51.0] is 9.70 u off it and CANNOT move
 *        (the pose is published), so the summit still shaves to 3.45 — that is the
 *        ceiling this pose allows and it is enough.  MEASURED: probe stdH
 *        0.71 -> 0.79, reliefFloor kept 0.73 -> 0.81 (keptStdH 0.73 -> 0.81),
 *        relief 8.34 -> 8.78, and the non-fatal `terrainFlattened` gate warning
 *        (built stdH under the published 0.76 band floor) is GONE.
 * WORLDS thornwick NW court [-43.2, 45.6] · pulse NE court [57.6, 45.6] ·
 *        emberfall SW court [-48.0, -38.4].  Centre separations are measured
 *        in the report; every pair is far past the 32.66 u floor at 128.
 * ROSTER 9 registered rides / 12 stalls (3 + 6 + 3 bazaar slots) / 5 categories
 *        gentle Carousel + Flying Saucers · thrill Wolds Runner (coaster) +
 *        Discotron + Enterprise · water Paddle Boats · transport Grand Circle
 *        Monorail + Chairlift · dark Ghost Train.
 * FLAG   §4.0-B family rectangle at start [15.6, 0.55, -2.4], queue tail
 *        [21.6, -2.4] = start.x + 6.0, queueDir [1, 0]. The circuit stands in
 *        the free PLOT CENTRE, x[-14.4..16.8] z[-16.8..15.6], enclosed by the
 *        three long runs — which is also why the seed keeps its character: the
 *        composition anchors its ranges on the FLANKS, so a flagship in the
 *        gentle core costs no relief (§1's landform-character floor).
 *        CORRIDOR KEEP-OUT (§4.0-B @ start [15.6, -2.4], PLOT coords):
 *          west valley  x[-14.4..-13.2] z[-8.4..8.4]
 *          west valley  x[-12.0]        z[-7.2..8.4]
 *          south valley x[-7.2..9.6]    z[-16.8..-14.4]
 *          north valley x[-2.4..9.6]    z[13.2..15.6]
 *          station leg  x[14.4..16.8]   z[-9.6..4.8]   (own ride — exempt)
 *        every street node and every street edge is outside all five.
 * TOUCH  every world rect reaches the ring's beam corridor, so the probe reads
 *        `worldsTouched == worlds.declared` (thornwick south to z 33.6, pulse
 *        west to x 44.4, emberfall already straddles the x -42.6 west leg).
 * RING   §4.2-A grand circle at the published START POSE [-42.6, 0, -9.7],
 *        rotation 0, beamY 2.6, four platforms W/N/E/S, the four queue tails
 *        [-36, -8.4] [0, 27.6] [36, -8.4] [0, -57.6] AUTHORED as street nodes.
 *        THE POSE IS THE PUBLISHED ONE, UNCHANGED — what changed is the SOUTH
 *        platform's QUEUE SIDE: W/N/E queue inward, SOUTH queues OUTWARD, so its
 *        tail is [0, -57.6] = deck - 6.6 and its anchor/exit are [0, -52.79] /
 *        [1.2, -52.17].  See SUMMIT for why that is measured, not stylistic.  The
 *        approach never crosses the beam at all: the market aisle sits at x -48.0,
 *        WEST of the ring's west side (x -42.6), and the SOUTH SHELF runs at
 *        z -57.6, SOUTH of its south side (z -51.0) — so it enters the South
 *        platform from outside the loop and the two at-grade beam crossings this
 *        park already makes (5 -> 8 under the north beam, 21 -> 23 under the west
 *        one) are still its only two.
 * LATTICE edge-length classes and the measured axis-15 terms are in the report
 *        that ships with this file.
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
  PULSE_DISTRICT, EMBERFALL_CALDERA, THORNWICK_GLADE,
} from './components/SetPieceKit';
import type { NetRef, SetPiecePlan } from './components/SetPieceKit';
import { Bazaar, bazaarPlan } from './components/Bazaar';
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
import { NeonArch, SpeakerStack, MirrorBallPylon } from './components/PulseScenery';
import { Fumarole, ObsidianShards, BasaltColumns } from './components/EmberfallScenery';

const SEED = 1;
const CLIMATE = 'temperate' as const;
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
// the ring's 16 GROUND cells — they go in KEEP_DRY and get walked in §5c.
// THE SOUTH PLATFORM QUEUES OUTWARD (-z) while W/N/E queue inward. That is the one
// asymmetry in the pose and it is MEASURED, not stylistic: see SUMMIT in the
// docstring. Inward, the tail lands at [0, -44.4], 5.5 u from the summit of the
// seed's primary range, and shaves it 8.59 -> 0.83.
const RING_CELLS: XZ[] = [
  [-42.6, -8.4], [0, 34.2], [42.6, -8.4], [0, -51.0],   // decks
  [-42.6, -9.7],                                        // start
  [-36.0, -8.4], [0, 27.6], [36.0, -8.4], [0, -57.6],   // tails (AUTHORED below)
  [-40.81, -8.4], [0, 32.41], [40.81, -8.4], [0, -52.79], // queue anchors
  [-1.2, 33.03], [41.43, -7.2], [1.2, -52.17],          // exits
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
const A_START: V3 = [15.6, 0.55, -2.4];
const A_TAIL: XZ = [21.6, -2.4];                   // start.x + 6.0, same z
const { points: FLAG_PTS } = compileTrackPieces(A_PIECES, {
  type: 'steel', start: A_START, heading: 0, bounds: SIZE,
});

// ── 1. THE WORLDS' STRUCTURAL SET-PIECES (themed bazaars) ──────────────────
// A bazaar's `position` is its AISLE CENTRE; its two ports lie on the aisle
// axis, one lattice cell outside the pad. `facing` aims the named port.
const GLADE_ROW = bazaarPlan({
  id: 'gladeRow', title: 'Toadstool Market', position: [-52.8, 45.6],
  facing: { port: 'E', toward: [-43.2, 45.6] },
  stalls: ['cottonCandy', 'burger', 'soda'], theme: THORNWICK_GLADE, seed: 11,
}); // 3 slots → 7 tiles, aisle E/W · ports W [-57.6, 45.6] · E [-48.0, 45.6]
const PULSE_ROW = bazaarPlan({
  id: 'pulseRow', title: 'Neon Row', position: [57.6, 55.2],
  facing: { port: 'W', toward: [57.6, 45.6] },
  stalls: ['soda', 'cottonCandy', 'balloon', 'burger', 'hotDog', 'soda'],
  theme: PULSE_DISTRICT, seed: 7,
}); // 6 slots → 13 tiles, aisle N/S · ports W [57.6, 46.8] · E [57.6, 63.6].
// THE THREE ROWS ARE DELIBERATELY DIFFERENT LENGTHS: `openSpace.areaSpread`
// wants >= 1.8 between the largest and smallest plaza, and three identical
// 7-tile rows measure 1.0 — half the axis-15 plaza point for nothing.
const EMBER_ROW = bazaarPlan({
  id: 'emberRow', title: 'Caldera Market', position: [-48.0, -49.2],
  facing: { port: 'W', toward: [-48.0, -38.4] },
  stalls: ['hotDog', 'burger', 'soda'], theme: EMBERFALL_CALDERA, seed: 3,
}); // 3 slots → 7 tiles, aisle N/S · ports W [-48.0, -44.4] · E [-48.0, -54.0]

// ── 2. THE STREET SKELETON ─────────────────────────────────────────────────
const GATE: XZ = [-14.4, 63.6];
const NODES: XZ[] = [
  // ── the NORTH PROMENADE, outside the ring ──
  /*  0 */ GATE,            // [-14.4,  63.6]  +z rim, OFF-CENTRE
  /*  1 */ [-14.4, 57.6],   // T Carousel       (out +x, cap 8) — 6.0 u from the turnstile
  /*  2 */ [-14.4, 45.6],   // promenade x gate spine
  /*  3 */ [-43.2, 45.6],   // NW court (thornwick) — wires gladeRow:E
  /*  4 */ [-43.2, 50.4],   // T Flying Saucers (out +z, cap 8)
  /*  5 */ [24.0, 45.6],    // the ONE descent head
  /*  6 */ [57.6, 45.6],    // NE court (pulse) — wires pulseRow:W
  /*  7 */ [57.6, 33.6],    // T Discotron      (out -z, cap 12)
  // ── the EAST ARTERIAL (x = 24.0), crossing UNDER the north beam 24 u clear
  //    of the North platform pad; node 8 is the ramp landing §0.6 wants ──
  /*  8 */ [24.0, 36.0],    // descent mid
  /*  9 */ [24.0, 27.6],    // arterial head — T Chairlift (out +x, cap 6)
  /* 10 */ [0.0, 27.6],     // RING NORTH queue tail — DEAD END, deck 6.6 u north
  /* 11 */ [24.0, 12.0],    // arterial mid — a second ramp landing (§0.6: the
  //                           land dips at z 27.6 and a single 30-u span could
  //                           not descend it inside the walkable grade)
  /* 12 */ [24.0, -2.4],    // coaster tail junction
  /* 13 */ A_TAIL,          // [21.6, -2.4] coaster queue tail = start.x + 6.0.
  //                           Its LANE runs x 17.9 … 21.6, i.e. 2.4 u clear of
  //                           the arterial — a lane laid ACROSS a street is a
  //                           `blockers` FAIL and it severs the graph behind it.
  /* 14 */ [24.0, -8.4],    // ring-east spur junction
  /* 15 */ [36.0, -8.4],    // RING EAST queue tail — DEAD END (a street past it
  //                           would run through the platform pad at [42.6, -8.4])
  /* 16 */ [24.0, -19.2],   // the arterial's foot — the LONG WEST ROW starts here
  // ── the LONG WEST ROW (z = -19.2), 2.4 u clear of the flagship's south
  //    valley and crossing UNDER the west beam 10.8 u clear of its pad ──
  /* 17 */ [12.0, -19.2],   // T Paddle Boats   (out -z, cap 4)
  /* 18 */ [0.0, -19.2],    // west-row cell (the old ring-south spur left from HERE —
  //                           see SUMMIT: a column down x 0 crosses the seed's ridge)
  /* 19 */ [0.0, -57.6],    // RING SOUTH queue tail — DEAD END. The South platform
  //                           queues OUTWARD, so the tail is 6.6 u SOUTH of the deck
  //                           [0, -51.0] and is reached from 26 along the SOUTH SHELF
  /* 20 */ [-24.0, -19.2],  // T Ghost Train    (out -z, cap 6)
  /* 21 */ [-36.0, -19.2],  // ring-west spur junction
  /* 22 */ [-36.0, -8.4],   // RING WEST queue tail — DEAD END
  /* 23 */ [-48.0, -19.2],  // west row end
  /* 24 */ [-48.0, -30.0],  // T Enterprise     (out -x, cap 8)
  /* 25 */ [-48.0, -38.4],  // SW court (emberfall) — wires emberRow:W
  /* 26 */ [-48.0, -57.6],  // SOUTH SHELF head, off emberRow:E [-48.0, -54.0]. The
  //                           market's SECOND port was PRUNED as an unwired stub in the
  //                           published table; wiring it turns the aisle into the
  //                           through-street it was drawn as and costs no new junction.
];
const EDGES: [NetRef, NetRef][] = [
  [0, 1], [1, 2],                              // the gate spine
  [2, 3], ['gladeRow:E', 3], [3, 4],           // NW promenade + glade row + spur
  [2, 5], [5, 6], ['pulseRow:W', 6], [6, 7],   // promenade east + pulse row + spur
  [5, 8], [8, 9],                              // the descent under the north beam
  [9, 10],                                     // west to the ring N tail
  [9, 11], [11, 12], [12, 13], [12, 14], [14, 15],   // arterial + coaster tail + E tail
  [14, 16],
  [16, 17], [17, 18],                          // the west row
  [18, 20], [20, 21], [21, 22],                // west row + the ring W tail
  [21, 23], [23, 24], [24, 25], ['emberRow:W', 25],  // west row end + SW court
  ['emberRow:E', 26], [26, 19],                // the SOUTH SHELF -> the ring S tail
];

// ── 3. THE QUEUE ARITHMETIC (§0.19) ────────────────────────────────────────
const minReachOf = (c: number) => laneLenOf(c) + 0.35 + 0.62 + 0.5 + 0.45;
function place(net: ReturnType<typeof buildParkNet>, tail: XZ, out: XZ, capacity: number) {
  const join = laneLenOf(capacity) + 0.35;
  // TWO lattice cells past the floor, not one: `minReachOf` is the floor for the
  // BOARD PAD, and a `composableRide`'s boardPoint sits `layout.front` in FRONT
  // of `position` (up to ~1.4 u for a <Discotron>) — measured, one cell left the
  // cap-12 rig 0.20 u short and took a `footprints` FAIL.
  const reach = minReachOf(capacity) + 2.4;
  const cand: XZ = [tail[0] + out[0] * reach, tail[1] + out[1] * reach];
  const pad = (offPathCell(net, cand, { clear: 3.2 }) ?? cand) as XZ;
  const got = Math.hypot(pad[0] - tail[0], pad[1] - tail[1]);
  if (got < minReachOf(capacity) + 1.2)
    throw new Error(
      `pad [${pad}] sits ${got.toFixed(2)} u from its tail [${tail}] — the cap-${capacity} floor is ` +
        `${(minReachOf(capacity) + 1.2).toFixed(2)} u (the ${minReachOf(capacity).toFixed(2)} u board-pad floor ` +
        `plus one cell for the rig's own \`front\`). Move the TAIL outward or open the court.`,
    );
  return {
    pad,
    anchor: [tail[0] + out[0] * join, tail[1] + out[1] * join] as XZ,
    dir: [-out[0], -out[1]] as XZ,
    yaw: Math.atan2(-out[0], -out[1]),
  };
}

// ── 4. §1-W THE PINNED ROW'S WATER, AS DATA + THE PRE-FILTER ───────────────
// `assertKeepDryOffRow` IS A SIEVE, NOT THE AUTHORITY. Its `box` is the
// bounding box of a body's basin CHAIN, so it is wrong in BOTH directions:
//   * NARROWER than the real bowls — seed 1's SECONDARY bowls sit at
//     (-26.5, 32.2) r 8.4 and reach x -18.1, against a published box that stops
//     at x -21. A street column at x -19.2 crossing z 23…39 therefore CLEARS
//     this sieve and still re-picks that body 25.0 u (measured).
//   * WIDER than the water — seed 31's DOMINANT box x[-64..-16] z[-63..-8]
//     swallows the mandatory ring's own West platform cells, which compose bone
//     dry (h 0.12, isDry true), so on that row the sieve throws on a park that
//     is correct.
// It is here because it is FREE and catches the gross case early. THE AUTHORITY
// IS §5c's re-compose in step 9 — unguarded vs guarded `terrainSeed` /
// `waterCentre` / `waterCentreSecond` — plus `isDry` against the COMPOSED
// basins. A sieve hit must be escalated to those, never accepted or obeyed
// on its own.
type SeedBasin = { ctr: XZ; box: [number, number, number, number] };
type SeedRow = { dom: SeedBasin; sec: SeedBasin };
const SEED_ROW_WATER: Record<string, SeedRow> = {
  '1/temperate': { dom: { ctr: [41, -39], box: [21, 60, -60, -21] }, sec: { ctr: [-38, 31], box: [-56, -21, 23, 39] } },
};
const inBasinBox = (c: XZ, b: SeedBasin) =>
  c[0] >= b.box[0] && c[0] <= b.box[1] && c[1] >= b.box[2] && c[1] <= b.box[3];
function assertKeepDryOffRow(cells: XZ[], row: SeedRow, nearR = 12): void {
  const hits: string[] = [];
  for (const c of cells)
    for (const [name, b] of [['DOMINANT', row.dom], ['SECONDARY', row.sec]] as const) {
      if (inBasinBox(c, b))
        hits.push(`[${c[0]}, ${c[1]}] is INSIDE the ${name} box x[${b.box[0]}…${b.box[1]}] z[${b.box[2]}…${b.box[3]}]`);
      else if (Math.hypot(c[0] - b.ctr[0], c[1] - b.ctr[1]) < nearR)
        hits.push(`[${c[0]}, ${c[1]}] is within ${nearR} u of the ${name} centroid (${b.ctr[0]}, ${b.ctr[1]})`);
    }
  if (hits.length)
    throw new Error(`keepDry overlaps the pinned row's published water — ${hits.length} cell(s):\n  ${hits.join('\n  ')}`);
}

// ── 5. THE PIECE LIST, PORT RESOLUTION AND THE THREE ASSERTIONS ────────────
const ALL_PLANS: SetPiecePlan[] = [GLADE_ROW, PULSE_ROW, EMBER_ROW];
const portCell = (ref: NetRef): XZ => {
  if (typeof ref === 'number') return NODES[ref];
  const [id, name] = ref.split(':');
  const p = ALL_PLANS.find((q) => q.id === id);
  if (!p) throw new Error(`EDGES references '${ref}' but no plan with id '${id}' exists`);
  return p.port(name);
};
const EPS = 1e-6;
EDGES.forEach(([a, b]) => {
  const A = portCell(a), B = portCell(b);
  if (Math.abs(A[0] - B[0]) > EPS && Math.abs(A[1] - B[1]) > EPS)
    throw new Error(
      `diagonal edge ${a}→${b}: [${A[0].toFixed(2)}, ${A[1].toFixed(2)}] → [${B[0].toFixed(2)}, ${B[1].toFixed(2)}]`,
    );
});

const SOLID_CLEAR: Record<string, number> = { FountainPlaza: 1.8, Bazaar: 0.6, Boulevard: 0 };
function assertNodesOffPieces(nodes: XZ[], plans: SetPiecePlan[]): void {
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
        hits.push(`[${n[0]}, ${n[1]}] (cell ${i}) is ${gap.toFixed(2)} u from '${p.id}' (${p.kind}) — needs ${clear}`);
    });
  });
  if (hits.length)
    throw new Error(`${hits.length} authored cell(s) stand inside or against a set-piece footprint:\n  ${hits.join('\n  ')}`);
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

// ── 6. THE WORLD REGIONS ───────────────────────────────────────────────────
// declared BEFORE the fuse (buildParkNet expands `worlds:` into its pieces);
// the ride pads are added below via `rides` once the fuse exists, so each
// world is planned twice: here for the fuse, and re-planned with pads.
const cellsOf = (x0: number, x1: number, z0: number, z1: number): XZ[] => {
  const out: XZ[] = [];
  for (let x = x0; x <= x1 + 1e-6; x += 1.2) for (let z = z0; z <= z1 + 1e-6; z += 1.2) out.push([x, z]);
  return out;
};
const GLADE_SC: XZ[] = [[-48.0, 52.8], [-56.4, 52.8], [-38.4, 52.8]];
const PULSE_SC: XZ[] = [[51.6, 51.6], [51.6, 60.0], [45.6, 52.8]];
const EMBER_SC: XZ[] = [[-54.0, -34.8], [-54.0, -42.0], [-43.2, -34.8]];

// ── 7. ONE FUSE ────────────────────────────────────────────────────────────
// KEEP_DRY: only cells this park PAVES or STANDS something on. buildParkNet
// adds every street node and piece cell itself, so this list is the ring, the
// world scenery and the amenity cells.
const KEEP_DRY: XZ[] = [...RING_CELLS, ...GLADE_SC, ...PULSE_SC, ...EMBER_SC];

const NET = buildParkNet({
  nodes: NODES,
  edges: EDGES,
  pieces: ALL_PLANS,
  keepDry: KEEP_DRY,
  bins: [[-15.6, 46.8], [22.8, 14.4], [-1.2, -20.4], [-46.8, -31.2]],
});
assertKeepDryOffRow(NET.keepDry, SEED_ROW_WATER['1/temperate']);

// ── 8. THE PADS, out of the fuse ───────────────────────────────────────────
const CAROUSEL = place(NET, NODES[1], [1, 0], 8);
const SAUCERS = place(NET, NODES[4], [0, 1], 8);
const DISCO = place(NET, NODES[7], [0, -1], 12);
const CHAIR = place(NET, NODES[9], [1, 0], 6);
const PADDLE = place(NET, NODES[17], [0, -1], 4);
const GHOST = place(NET, NODES[20], [0, -1], 6);
const ENTER = place(NET, NODES[24], [-1, 0], 8);
assertNodesOffPieces(
  [CAROUSEL.pad, SAUCERS.pad, DISCO.pad, CHAIR.pad, PADDLE.pad, GHOST.pad, ENTER.pad],
  ALL_PLANS,
);

const GLADE = worldPlan({
  id: 'thornwick', theme: THORNWICK_GLADE, pieces: [GLADE_ROW],
  rides: [{ at: SAUCERS.pad, name: 'Flying Saucers' }],
  include: [...GLADE_SC, ...cellsOf(-57.6, -38.4, 45.6, 56.4), [-38.4, 33.6], [-45.6, 33.6]],
});
const PULSE = worldPlan({
  id: 'pulse', theme: PULSE_DISTRICT, pieces: [PULSE_ROW],
  rides: [{ at: DISCO.pad, name: 'Discotron' }],
  include: [...PULSE_SC, ...cellsOf(51.6, 62.4, 24.0, 61.2), [44.4, 33.6], [44.4, 24.0]],
});
const EMBER = worldPlan({
  id: 'emberfall', theme: EMBERFALL_CALDERA, pieces: [EMBER_ROW],
  rides: [{ at: ENTER.pad, name: 'Enterprise' }],
  include: [...EMBER_SC, ...cellsOf(-57.6, -43.2, -52.8, -28.8), [-43.2, -28.8]],
});
const WORLDS = [GLADE, PULSE, EMBER];
([['thornwick', GLADE_SC], ['pulse', PULSE_SC], ['emberfall', EMBER_SC]] as const).forEach(([id, cells]) => {
  const w = WORLDS.find((x) => x.id === id)!;
  const inside = cells.filter((c) => w.contains(c)).length;
  if (inside < 3) throw new Error(`world '${id}' has ${inside} scenery cell(s) inside its rect — the floor is 3`);
});

// ── 9. §5c COMPOSE THE WATER TWICE AND REFUSE TO SHIP IF IT MOVED ──────────
// THIS IS THE AUTHORITY, and the §1-W box sieve above is only its pre-filter.
// Measured for this park: terrainSeed 16 → 16, probesTried 17 → 17, DOMINANT
// centroid moved 0.0 u, SECONDARY 0.0 u — bit-identical to the unguarded row.
const GUARDS: XZ[] = [
  ...NET.keepDry,
  CAROUSEL.pad, SAUCERS.pad, DISCO.pad, CHAIR.pad, PADDLE.pad, GHOST.pad, ENTER.pad,
  CAROUSEL.anchor, SAUCERS.anchor, DISCO.anchor, CHAIR.anchor, PADDLE.anchor, GHOST.anchor, ENTER.anchor,
];
assertKeepDryOffRow(GUARDS, SEED_ROW_WATER['1/temperate']);
const BARE = parkComposition(THREE, SEED, SIZE, CLIMATE);
const COMP = parkComposition(THREE, SEED, SIZE, CLIMATE, { keepDry: GUARDS, coasterPts: FLAG_PTS });
const movedBy = (a: XZ | null, b: XZ | null) =>
  a && b ? Math.hypot(a[0] - b[0], a[1] - b[1]) : a === b ? 0 : Infinity;
([['DOMINANT', BARE.waterCentre, COMP.waterCentre],
  ['SECONDARY', BARE.waterCentreSecond, COMP.waterCentreSecond]] as const).forEach(([n, a, b]) => {
  const d = movedBy(a as XZ | null, b as XZ | null);
  if (d > 6)
    throw new Error(
      `your guard list MOVED the ${n} water body ${d === Infinity ? '— it VANISHED' : `${d.toFixed(1)} u`} ` +
        `(terrainSeed ${BARE.terrainSeed} → ${COMP.terrainSeed})`,
    );
});
const isDry = (c: XZ, margin = 1.2) =>
  [...COMP.basins, ...COMP.basinsSecond].every((b) => Math.hypot(c[0] - b.x, c[1] - b.z) > 0.74 * b.radius + margin);
const dry = (c: XZ): XZ => {
  if (!isDry(c)) throw new Error(`cell [${c}] is inside the COMPOSED waterline — move it, do not guard it`);
  return c;
};

// ── 10. DRESSING (sieved, never guarded) ───────────────────────────────────
const TREE_CELLS: { at: XZ; shape: 'pine' | 'round' | 'willow' }[] = ([
  [-30, 57.6], [-24, 54], [-33.6, 61.2], [-6, 51.6], [4.8, 55.2], [12, 51.6], [30, 57.6], [37.2, 51.6],
  [30, 39.6], [8.4, 39.6], [-2.4, 39.6], [-26.4, 39.6], [-33.6, 45.6], [39.6, 34.8], [-9.6, 30], [-16.8, 21.6],
  [-27.6, 30], [-37.2, 21.6], [-39.6, 9.6], [-30, 1.2], [8.4, 25.2], [30, 21.6], [30, 9.6], [26.4, -1.2],
  [-8.4, -1.2], [8.4, -14.4], [-30, -14.4], [-39.6, -22.8], [-30, -26.4], [-9.6, -20.4], [10.8, -33.6], [-8.4, -39.6],
  [-30, -39.6], [-37.2, -45.6], [-46.8, -21.6], [-55.2, -21.6], [-58.8, -33.6], [-58.8, 33.6], [-13.2, -51.6], [-24, -50.4],
  [12, -50.4], [-58.8, 9.6], [-58.8, -9.6], [45.6, 39.6], [55.2, 33.6], [21.6, 33.6], [-45.6, 33.6], [-52.8, 21.6],
] as [number, number][]).map((c, i) => ({
  at: (offPathCell(NET, c as XZ, { clear: 1.6 }) ?? c) as XZ,
  shape: (['pine', 'round', 'willow'] as const)[i % 3],
}));
const TREES_DRY = TREE_CELLS.filter((t) => isDry(t.at));

const NEUTRAL_SCENERY: { name: string; at: XZ }[] = ([
  ['flagpole', [-14.4, 61.2]], ['parkClock', [-9.6, 61.2]], ['signpost', [-14.4, 43.2]],
  ['marbleStatue', [1.2, 43.2]], ['topiarySpiral', [-15.6, 47.4]], ['topiaryElephant', [16.8, 47.4]],
  ['birdbath', [21.6, 43.2]], ['planterBox', [2.4, -6.0]], ['picnicTable', [-2.4, -10.8]],
  ['gazebo', [-21.6, -12.0]], ['wishingWell', [-16.8, -30.0]], ['lionStatue', [-2.4, 15.6]],
  ['flagpole', [21.6, 18.0]], ['signpost', [-21.6, -33.6]],
] as [string, [number, number]][])
  .map(([name, at]) => ({ name, at: (offPathCell(NET, at as XZ, { clear: 1.6 }) ?? at) as XZ }))
  .filter((s) => isDry(s.at));

const RESTROOM: XZ = (offPathCell(NET, [-8.4, 48.0], { clear: 1.8 }) ?? [-8.4, 48.0]) as XZ;

const STALL_COUNT = [GLADE_ROW, PULSE_ROW, EMBER_ROW].reduce((n, b) => n + b.slots.length, 0);
const RIDE_NAMES = [
  'Wolds Runner', 'Grand Circle Monorail', 'Promenade Carousel', 'Saucer Glade',
  'Discotron', 'Ridgeline Chairlift', 'Hollow Paddle Boats', 'Ghost Train', 'Caldera Enterprise',
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
        console.log('[Skeleton B] validatePark', report);
      }}
    >
      <Terrain keepDry={GUARDS} coasterPts={FLAG_PTS} />
      <Paths
        nodes={NET.nodes}
        edges={NET.edges}
        plazas={NET.plazas}
        bins={NET.bins}
        walkers={8}
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
            // SOUTH faces OUTWARD (-z) — the other three queue inward. See SUMMIT.
            { label: 'South', boardPoint: [0, 2.6, -51.0], queueAnchor: [0, 0.05, -52.79], queueDir: [0, -1], exitPoint: [1.2, 0.05, -52.17], exitDir: [0, -1] },
          ],
        }}
      />

      {/* ── THRILL flagship — §4.0-B family rectangle ── */}
      <Coaster
        name="Wolds Runner"
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
        register={{ name: 'Promenade Carousel', capacity: 8, rideDuration: 9, intensity: 2, price: 3 }}
        queue={{ anchor: CAROUSEL.anchor, dir: CAROUSEL.dir }} />
      <Chairlift position={CHAIR.pad} rotation={CHAIR.yaw}
        register={{ name: 'Ridgeline Chairlift', capacity: 6, rideDuration: 10, intensity: 2, price: 3 }}
        queue={{ anchor: CHAIR.anchor, dir: CHAIR.dir }} />
      <GhostTrain position={GHOST.pad} rotation={GHOST.yaw}
        register={{ name: 'Ghost Train', capacity: 6, rideDuration: 11, intensity: 5, price: 4 }}
        queue={{ anchor: GHOST.anchor, dir: GHOST.dir }} />
      <PaddleBoats position={PADDLE.pad} rotation={PADDLE.yaw}
        register={{ name: 'Hollow Paddle Boats', capacity: 4, rideDuration: 12, intensity: 1, price: 2 }}
        queue={{ anchor: PADDLE.anchor, dir: PADDLE.dir }} />

      {/* ── the three worlds: region + themed row + own ride + 3 scenery ── */}
      <World plan={GLADE} />
      <Bazaar plan={GLADE_ROW} />
      <FlyingSaucers position={SAUCERS.pad} rotation={SAUCERS.yaw}
        register={{ name: 'Saucer Glade', capacity: 8, rideDuration: 9, intensity: 4, price: 3 }}
        queue={{ anchor: SAUCERS.anchor, dir: SAUCERS.dir }} />
      <GiantToadstools position={dry(GLADE_SC[0])} seed={1} />
      <StandingStones position={dry(GLADE_SC[1])} seed={3} />
      <LanternTree position={dry(GLADE_SC[2])} seed={5} />

      <World plan={PULSE} />
      <Bazaar plan={PULSE_ROW} />
      <Discotron position={DISCO.pad} rotation={DISCO.yaw}
        register={{ name: 'Discotron', capacity: 12, rideDuration: 13, intensity: 6, price: 4 }}
        queue={{ anchor: DISCO.anchor, dir: DISCO.dir }} />
      <NeonArch position={dry(PULSE_SC[0])} rotation={Math.PI / 2} text="PULSE" seed={3} />
      <SpeakerStack position={dry(PULSE_SC[1])} rotation={-Math.PI / 2} seed={5} />
      <MirrorBallPylon position={dry(PULSE_SC[2])} seed={7} />

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

      <Lights from={[-14.4, 57.6]} to={[-14.4, 45.6]} />
      <Lights from={[24.0, 21.6]} to={[24.0, -2.4]} />
      <Lights from={[-24.0, -19.2]} to={[-36.0, -19.2]} />
      <Lights from={[57.6, 45.6]} to={[57.6, 33.6]} />
    </Park>
  );
}

export default ThemePark;

// ── OFFLINE MEASUREMENT HOOK (harness only; not part of the park) ──────────
export function __netdump() {
  const rides = [
    { name: 'Wolds Runner', at: [A_START[0], A_START[2]] as XZ, registered: true, centre: [-18.0, 15.7] as XZ },
    { name: 'Grand Circle Monorail', at: [-42.6, -9.7] as XZ, registered: true },
    { name: 'Promenade Carousel', at: CAROUSEL.pad, registered: true },
    { name: 'Saucer Glade', at: SAUCERS.pad, registered: true },
    { name: 'Discotron', at: DISCO.pad, registered: true },
    { name: 'Ridgeline Chairlift', at: CHAIR.pad, registered: true },
    { name: 'Hollow Paddle Boats', at: PADDLE.pad, registered: true },
    { name: 'Ghost Train', at: GHOST.pad, registered: true },
    { name: 'Caldera Enterprise', at: ENTER.pad, registered: true },
  ];
  const stalls = [GLADE_ROW, PULSE_ROW, EMBER_ROW].flatMap((b) =>
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
    hardCells: [
      ...NODES, ...RING_CELLS, ...GLADE_SC, ...PULSE_SC, ...EMBER_SC,
      CAROUSEL.pad, SAUCERS.pad, DISCO.pad, CHAIR.pad, PADDLE.pad, GHOST.pad, ENTER.pad,
      CAROUSEL.anchor, SAUCERS.anchor, DISCO.anchor, CHAIR.anchor, PADDLE.anchor, GHOST.anchor, ENTER.anchor,
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
  };
}

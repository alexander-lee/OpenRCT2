/*
 * SKELETON A (REPAIRED) — "THE CENTRE PLAZA AND THE FOUR CARDINALS".
 * The SPARSE RADIAL density class: a hub-and-spokes park.
 *
 * WHY THIS FILE EXISTS. The published §3.1-A table was marked VERIFIED and was
 * not: with `keepDryOf` in place, THIRTEEN of its cells stand in seed 1
 * temperate's real water, because it hung one district off node 8
 * [22.8, -27.6] (SE lake, h -0.66) and another off node 16 [-31.2, 30.0]
 * (NW inlet, h -2.96). This file re-derives the geometry on the SAME pinned
 * row and the SAME hub-and-spokes CHARACTER, with every cell measured dry.
 *
 * §0 PRE-FLIGHT (all arithmetic COUNTED FROM THIS FILE)
 *
 * SEED   seed=1 climate="temperate" size=128 — the row §3.1-A pinned, kept.
 *        The two bodies are the SE lake (dominant, centroid (43.4, -43.4)) and
 *        the NW inlet (secondary, (-33.7, 28.1)). MEASURED off the BUILT
 *        heightfield, the wet regions are:
 *          NW inlet   x[-56.2, -20.2] z[+23.0, +38.0]
 *          SE lake    x >= 20.6 for z[-21, -37]; x >= 29.0 for z[-38, -60]
 *        and the four RANGES no guarded cell may stand on (h > 0.8):
 *          west   x[-56, -39] z[-4, +18]      east   x[+26.6, +48.2] z[+7, +25]
 *          south-west x[-19, -2.2] z[-36, -48]
 *          south-centre x[+12.2, +33.8] z[-37, -52]
 *        EVERY street node, ring cell, stall anchor, ride pad, queue anchor and
 *        scenery cell below is outside all six. §5c re-composes and refuses.
 * SUMMIT THOSE FOUR BOXES ARE THE UNGUARDED ROW'S AND THEY DO NOT DESCRIBE THE
 *        RANGE THIS LAYOUT ACTUALLY GETS — the gap they leave at x ~ 0, z ~ -43 is
 *        exactly where the composer puts its biggest range. Measured on THIS guard
 *        cloud (and on skeleton B's, a different cloud, which gets the SAME
 *        answer): no slot in `composeHills`' jittered ring is clear of a dense 128
 *        layout at `GUARD_SLOT_K` (rangeR 31.0 -> it wants a 19.2 u guard-free
 *        disc), so the seed's PRIMARY alpine range falls through to the phase-1
 *        fallback walk, which is guard-BLIND and therefore lands in the same place
 *        whatever you author: a FIVE-PEAK RIDGE along z ~ -43, summit
 *        (5.33, -42.89) h 8.59 r 12.09, peaks at x -13.8 / -5.8 / +5.3 / +19.2 /
 *        +29.9. Its skirt is CONTINUOUS from x -23 to x +38.6, so the only dry
 *        southbound corridors on this row are x <= -23 and x >= +38.6 — and the
 *        second one is the SE lake. `capPeakForCells(p, keep, 0.35)` shaves a peak
 *        to `0.35 / s(d)`, so a guard cell has to stand >= 10.62 u off that summit
 *        to cost it nothing at all.
 *        The published INWARD south queue put its tail at [0, -44.4] — 5.5 u — and
 *        the street column from node 16 down to it added [0, -42.0] / [0, -43.2]:
 *        measured, that cut the summit 8.59 -> 0.83 and its neighbour 5.93 -> 1.50,
 *        i.e. reliefFloor `keptStdH` 0.74 and probe `terrain.stdH` 0.73 — ONE
 *        HUNDREDTH under axis 7's 0.75 floor, for 1.5 points.
 *        THE REPAIR: the SOUTH platform queues OUTWARD (tail [0, -57.6]) and is
 *        reached 20 -> 30 -> 17, down the x -24.0 column and east along z -57.6.
 *        Every cell of that approach is >= 14.7 u off the summit. The ring's own
 *        DECK [0, -51.0] is 9.70 u off it and CANNOT move (the pose is published),
 *        so the summit still shaves to 3.45 — that is the ceiling this pose allows
 *        and it is enough. MEASURED: probe stdH 0.73 -> 0.81, reliefFloor kept
 *        0.74 -> 0.82 (keptStdH 0.74 -> 0.82), relief 8.34 -> 8.78, worst path ramp
 *        0.50 -> 0.19, and the non-fatal `terrainFlattened` gate warning (built
 *        stdH under the published 0.76 band floor) is GONE.
 * SHAPE  HUB-AND-SPOKES, one cycle. A <FountainPlaza> hub at [0, 45.6]
 *        TERMINATES the centred gate street; three cardinal spokes leave its
 *        N/E/W ports; the E spoke (x 22.8) and the W spoke (x -13.2) each turn
 *        SOUTH and are closed by the z -21.6 south leg, which is the one cycle.
 *        Long runs, few junctions: 31 authored cells, 37 edges, mean edge 14.0.
 *        The ring's SOUTH tail hangs off the SOUTH SHELF (20 -> 30 -> 17) rather
 *        than off node 16, which is a LENGTHENED SPOKE, not a new shape: no cycle
 *        is added (17 is a leaf, 30 is a degree-2 elbow on the x -24.0 column that
 *        19 -> 20 already runs down) and every bearing is one 19/20 already had.
 *        THE REPAIR, vs the published table:
 *          * the WEST spoke is x -13.2, NOT x -31.2. A column at -31.2 crosses
 *            the NW inlet for 15 u (z 23..38). x -13.2 is dry from z 45.6 to
 *            z -21.6 AND threads the flagship's west valley (x[-19.2,-16.8]) on
 *            the east and its N/S valleys on the west.
 *          * the SOUTH leg is z -21.6, NOT z -27.6, and its east end is
 *            x 9.6, NOT x 22.8. Node 8 of the published table is DELETED: the
 *            SE lake reaches x 20.6 at z -28.
 *          * the two water districts are ROTATED to the dry WEST shelf and the
 *            dry EAST strip; nothing is hung off the SE corner at all.
 * GATE   [0, 63.6], CENTRED (skeleton A's signature). Nearest queue tail
 *        [9.6, 58.8] = 4.8 + 9.6 = 14.4 u of street, inside §3.1-A's 15 u
 *        sim-smoke budget (20 u practical max, 24 u FAILS).
 * WORLDS pulse NORTH (on the gate street, the front world) · brasswork WEST
 *        SHELF (by the W platform) · thornwick EAST STRIP (by the E platform).
 *        Each reaches the ring's beam corridor, so `everyWorldTouched`.
 * ROSTER 9 registered rides / 12 stalls (6 + 3 + 3 bazaar slots) / 5 categories
 *        thrill Corkscrew Ascent (§4.0-C) + Breakwater Flyer (§4.0-B) +
 *        MotionSimulator · transport Grand Circle Monorail + GoKarts ·
 *        dark HauntedMansion · water RiverRapids + MoonlitBarge ·
 *        gentle Helicycles.
 *        TRIED AND REVERTED: swapping two ride kinds off skeleton-a's roster bought
 *        axis 13 +0.5 (selection Jaccard 0 -> 0.4) and cost axis 16 -1.75 (world
 *        coherence 1.5 -> 0), net -1.25, because one of the substitutes carries a
 *        themeId and outside every <World> rect that is a `themedPieceOutsideWorlds`
 *        finding — the same trap the note further down already records. Axis 13's
 *        roster point needs an UNTHEMED never-shipped kind, and every remaining one
 *        needs a >= 7 u court. NOTE: do not name candidate rigs in comments here —
 *        the probe extracts ride kinds STATICALLY from this source, so a rig named
 *        only in prose still lands in the measured roster.
 *        FOUR of the nine are catalog circuits that had NEVER SHIPPED
 *        (MotionSimulator, HauntedMansion, GoKarts, Helicycles)
 *        — NINE circuits over all FIVE families, and the only two kinds shared
 *        with skeletons B and C are the two MANDATORY ones (Coaster, Monorail).
 * FLAG   §4.0-L LOOPER rect (real vertical loop) at start [16.8, 0.55, -3.6], heading 0, steel,
 *        tail [22.8, -3.6] (= start.x + 6.0), queueDir [1, 0].
 *        rateCoaster (cars 3, bank 0.7): E 6.27, I 9.55 intense, N 3.55,
 *        maxLatG 0.73, INVERSIONS 2 — the
 *        archetype no corpus park has ever mounted. MEASURED ON THIS BUILD:
 *        §4.0-C's PUBLISHED line (E 6.31 / I 9.64 / N 3.60 / latG 0.90) no
 *        longer reproduces. Track length is identical (152.17) and §4.0-A and
 *        §4.0-B reproduce EXACTLY, so the drift is corkscrew-specific — do not
 *        "correct" these numbers back to the archetype's. Footprint
 *        x[-18.42, 16.80] z[-18.16, 18.64], the dry plot CORE.
 *        CORRIDOR KEEP-OUT (§4.0-C @ start [16.8, -3.6], PLOT coords):
 *          west valley  x[-19.2..-16.8] z[-4.8..10.8]
 *          south valley x[-10.8..4.8]   z[-19.2..-16.8]
 *          north valley x[-8.4..7.2]    z[18.0..19.2]
 *          station leg  x[15.6..18.0]   z[-10.8..4.8]   (own ride — exempt)
 * FLAG2  §4.0-B FAMILY rect at start [-33.6, 0.55, -48.0], tail [-27.6, -48.0],
 *        queueDir [1, 0]. rateCoaster (cars 3, bank 0.7): E 5.27, I 6.25
 *        THRILLING, N 2.25, maxLatG 0.27 — a different archetype AND
 *        a different intensity band from the flagship (§4.0-E wants A+B or
 *        C+B, never A+C). Footprint x[-62.52, -33.60] z[-61.27, -30.85]: the
 *        deep SOUTH-WEST, which composes UNIFORMLY FLAT AND DRY on this row, so
 *        its `coasterPts` pre-cap crushes no range at all.
 *        CORRIDOR KEEP-OUT (§4.0-B @ start [-33.6, -48.0], PLOT coords):
 *          west valley  x[-63.6..-62.4] z[-54.0..-37.2]
 *          west valley  x[-61.2]        z[-52.8..-37.2]
 *          south valley x[-56.4..-39.6] z[-62.4..-60.0]
 *          north valley x[-51.6..-39.6] z[-32.4..-30.0]
 *          station leg  x[-34.8..-32.4] z[-55.2..-40.8]  (own ride — exempt)
 *        disjoint from the flagship by 15.18 u in x and 12.69 u in z.
 * RING   §4.2-A grand circle at the published START POSE [-42.6, 0, -9.7],
 *        rotation 0, beamY 2.6, four platforms W/N/E/S, the four queue tails
 *        [-36, -8.4] [0, 27.6] [36, -8.4] [0, -57.6] AUTHORED as street nodes
 *        and ALL FOUR LEAVES (the published table shipped `7 -> 20`, a street
 *        continuing east past the E tail straight through the East deck).
 *        THE POSE IS THE PUBLISHED ONE, UNCHANGED — what changed is the SOUTH
 *        platform's QUEUE SIDE: W/N/E queue inward (toward the ring's interior),
 *        SOUTH queues OUTWARD, so its tail is [0, -57.6] = deck -6.6 and its
 *        anchor/exit are [0, -52.79] / [1.2, -52.17]. See SUMMIT above for why
 *        that is measured rather than stylistic. The approach 30 -> 17 passes
 *        UNDER the ring's south beam at [-24, -51] (beamY 2.6, 24 u clear of the
 *        South platform pad) — the same at-grade crossing 3 -> 4 already makes
 *        under the north beam.
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
  TIDEWATER_HOLLOW, PULSE_DISTRICT, THORNWICK_GLADE,
} from './components/SetPieceKit';
import type { NetRef, SetPiecePlan } from './components/SetPieceKit';
import { Bazaar, bazaarPlan } from './components/Bazaar';
import { FountainPlaza, fountainPlazaPlan } from './components/FountainPlaza';
import { Boulevard, boulevardPlan } from './components/Boulevard';
import { compileTrackPieces } from './components/SplineRideKit';
import { tree } from './components/Kit';

import { Monorail } from './components/Monorail';
import { GoKarts } from './components/GoKarts';
import { HauntedMansion } from './components/HauntedMansion';
import { RiverRapids } from './components/RiverRapids';
import { MoonlitBarge } from './components/MoonlitBarge';
import { SpaceRings } from './components/SpaceRings';
import { LaunchedFreefall } from './components/LaunchedFreefall';

import { NeonArch, SpeakerStack, MirrorBallPylon } from './components/PulseScenery';
import { WreckedHull, CoralCluster, AnchorPile } from './components/TidewaterScenery';
import { GiantToadstools, StandingStones, LanternTree } from './components/ThornwickScenery';

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
/** the ring's 16 GROUND cells — in KEEP_DRY, and walked in §5c.
 *  THE SOUTH PLATFORM'S QUEUE FACES OUTWARD (-z), not inward like the other
 *  three. It is the ONE asymmetry in the pose and it is measured, not stylistic:
 *  see the SUMMIT block in the docstring. Inward, the tail lands at [0, -44.4],
 *  5.5 u from the summit of the seed's PRIMARY range, and shaves it 8.59 → 0.83. */
const RING_CELLS: XZ[] = [
  [-42.6, -8.4], [0, 34.2], [42.6, -8.4], [0, -51.0],     // decks
  [-42.6, -9.7],                                          // start
  [-36.0, -8.4], [0, 27.6], [36.0, -8.4], [0, -57.6],     // tails (AUTHORED below)
  [-40.81, -8.4], [0, 32.41], [40.81, -8.4], [0, -52.79], // queue anchors
  [-1.2, 33.03], [41.43, -7.2], [1.2, -52.17],            // exits
];
const RING_TAILS: XZ[] = [[36.0, -8.4], [0, 27.6], [-36.0, -8.4], [0, -57.6]];  // E N W S

// ── 0b. THE FLAGSHIP: §4.0-C INVERTING rectangle, verbatim ──────────────────
// ── §4.0-L LOOPER — the flagship, with a real VERTICAL LOOP ──────────────────
// Swapped in for §4.0-C (two corkscrews, no loop). SAME start pose and SAME tail
// cell, so the street table, queue lane and monorail ring are untouched.
// VERIFIED by `node probe-coaster-design.mjs`: E 6.29 · I 8.58 · N 3.17 ·
// maxLatG 1.20 (guard 1.275) · 2 inversions (loop + corkscrew) · 0 synthesized.
// DO NOT retune the heights: a loop raises maxY, speed is sqrt(2g(maxY - y)) so
// the car is faster EVERYWHERE, and the closure arc's radius is FIXED at 2.2 —
// measured 2.38 g when the rise was not paid for, worst point at u = 0.9875,
// i.e. IN THE CLOSURE, not in the loop.
//
// ⚠ KNOWN, MEASURED LIMIT OF THIS FILE. §4.0-L flies LOWER (maxY 4.75 vs 6.05),
// so its corridor keep-out is DIFFERENT and this table — cut for §4.0-C — leaves
// 2 `corridor` FAILs (94.18/100 vs 97.68). §4.0-L's measured envelope is
//   west x[-22.2,-21.0] z[-4.2,12.6] · south x[-17.4,3.0] z[-15.0,-13.8]
//   north x[-12.6,9.0] z[16.2,18.6] · INTERIOR return x[3.0,4.2] z[-13.8,-0.6]
// and the interior column is the new one — §4.0-C left its ring interior free.
// Rerouting needs a JOGGED west spoke, not a shifted column: south valley forces
// x <= -19.0, west valley forces x >= -19.4, and seed 1's secondary bowl reaches
// x -18.1, so every single-column choice either clips a valley or moves the lake
// 25 u (`waterRePicked`). Left as-is deliberately rather than shipped broken.
const C_PIECES: TrackPiece[] = [
  'station',
  { type: 'lift', height: 4.2 }, { type: 'straight', length: 6 }, { type: 'turnR', angle: 90, radius: 2.5 },
  { type: 'drop', height: 4.2 }, { type: 'loop', radius: 1.4 }, { type: 'straight', length: 3.6 }, { type: 'hill', height: 0.6 },
  { type: 'lift', height: 2.0 }, { type: 'straight', length: 4.8 }, { type: 'turnR', angle: 90, radius: 2.5 },
  { type: 'drop', height: 2.0 }, { type: 'hill', height: 0.6 },
  { type: 'lift', height: 2.0 }, { type: 'corkscrewR' }, { type: 'straight', length: 3 }, { type: 'turnR', angle: 90, radius: 2.5 },
  { type: 'drop', height: 2.0 }, { type: 'hill', height: 0.6 },
  { type: 'lift', height: 1.6 }, { type: 'turnR', angle: 90, radius: 2.5 },
  { type: 'drop', height: 1.6 }, { type: 'straight', length: 1.5 },
];
const C_START: V3 = [16.8, 0.55, -3.6];
const C_TAIL: XZ = [22.8, -3.6];                   // start.x + 6.0, same z
const { points: FLAG_PTS } = compileTrackPieces(C_PIECES, {
  type: 'steel', start: C_START, heading: 0, bounds: SIZE,
});

// ── 0c. THE SECOND COASTER: §4.0-B FAMILY rectangle, verbatim ───────────────
const B_PIECES: TrackPiece[] = [
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
const B_START: V3 = [-33.6, 0.55, -48.0];
const B_TAIL: XZ = [-27.6, -48.0];                 // start.x + 6.0, same z
const { points: FLAG2_PTS } = compileTrackPieces(B_PIECES, {
  type: 'steel', start: B_START, heading: 0, bounds: SIZE,
});
/** BOTH point sets feed the terrain pre-cap — §4.0-E, not optional */
const ALL_COASTER_PTS = [...FLAG_PTS, ...FLAG2_PTS];

const bboxOf = (pts: V3[]): { x: [number, number]; z: [number, number] } => {
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  for (const p of pts) {
    if (p[0] < x0) x0 = p[0];
    if (p[0] > x1) x1 = p[0];
    if (p[2] < z0) z0 = p[2];
    if (p[2] > z1) z1 = p[2];
  }
  return { x: [+x0.toFixed(2), +x1.toFixed(2)], z: [+z0.toFixed(2), +z1.toFixed(2)] };
};
const FLAG_BB = bboxOf(FLAG_PTS as V3[]);
const FLAG2_BB = bboxOf(FLAG2_PTS as V3[]);
const FLAG_CENTRE: XZ = [+((FLAG_BB.x[0] + FLAG_BB.x[1]) / 2).toFixed(2), +((FLAG_BB.z[0] + FLAG_BB.z[1]) / 2).toFixed(2)];
const FLAG2_CENTRE: XZ = [+((FLAG2_BB.x[0] + FLAG2_BB.x[1]) / 2).toFixed(2), +((FLAG2_BB.z[0] + FLAG2_BB.z[1]) / 2).toFixed(2)];

/** the corridor rects of BOTH circuits, in PLOT coords (§4 keep-out tables +
 *  each start). Station legs are the ride's own and are listed `own: true`. */
type Rect = { x: [number, number]; z: [number, number]; own?: boolean; who: string };
const KEEPOUT: Rect[] = (() => {
  const [cx, , cz] = C_START;
  const [bx, , bz] = B_START;
  return [
    // §4.0-C offsets
    // §4.0-L — MEASURED (every compiled point under the 2.2-u overfly bar,
    // bucketed to the 1.2 lattice), NOT inherited from the §4.0-C this replaced.
    { who: 'L-west', x: [cx - 39.0, cx - 37.8], z: [cz - 0.6, cz + 16.2] },
    { who: 'L-south', x: [cx - 34.2, cx - 13.8], z: [cz - 11.4, cz - 10.2] },
    { who: 'L-north', x: [cx - 29.4, cx - 7.8], z: [cz + 19.8, cz + 22.2] },
    // the INTERIOR return column — §4.0-C had none and left its ring interior
    // free for streets; §4.0-L drops a 0.50-u leg down the middle at x 3.6.
    { who: 'L-interior', x: [cx - 13.8, cx - 12.6], z: [cz - 10.2, cz + 3.0] },
    { who: 'L-station', x: [cx - 6.6, cx + 0.6], z: [cz - 4.2, cz + 6.0], own: true },
    // §4.0-B offsets
    { who: 'B-west', x: [bx - 30.0, bx - 27.6], z: [bz - 6.0, bz + 10.8] },
    { who: 'B-south', x: [bx - 22.8, bx - 6.0], z: [bz - 14.4, bz - 12.0] },
    { who: 'B-north', x: [bx - 18.0, bx - 6.0], z: [bz + 15.6, bz + 18.0] },
    { who: 'B-station', x: [bx - 1.2, bx + 1.2], z: [bz - 7.2, bz + 8.4], own: true },
  ];
})();

// ── 1. parkAssert — COLLECT, print ONE block, throw ONCE (§4b) ──────────────
type Sev = 'structural' | 'advisory';
const PARK_FAILS: { name: string; detail: string; sev: Sev }[] = [];
function parkAssert(name: string, cond: boolean, detail: string, sev: Sev = 'structural'): boolean {
  if (!cond) PARK_FAILS.push({ name, detail, sev });
  return cond;
}
function parkAssertFlush(): void {
  if (!PARK_FAILS.length) {
    // eslint-disable-next-line no-console
    console.log('[Skeleton A] assertions: all pass');
    return;
  }
  const hard = PARK_FAILS.filter((f) => f.sev === 'structural');
  // eslint-disable-next-line no-console
  console.error(`[Skeleton A] ${PARK_FAILS.length} ASSERTION FAILURE(S) (${hard.length} structural):\n` +
    PARK_FAILS.map((f, i) => `  ${i + 1}. [${f.sev}] ${f.name}\n     ${f.detail}`).join('\n'));
  if (hard.length) throw new Error(`[Skeleton A] ${hard.length} STRUCTURAL failure(s) — see the numbered block above.`);
}

// ── 2. THE TWO PLAZAS. `half = tiles * 0.6`, ports one cell out at half + 0.6.
// The published §3.1-A table printed `hub:E` at [6.0, 45.6] for `tiles: 7`,
// which is WRONG by 1.2 u (7 * 0.6 + 0.6 = 4.8). Never retype a port cell —
// read it off the plan, which is what `portCell()` below does.
const HUB = fountainPlazaPlan({ id: 'hub', title: 'Centre Plaza', position: [0, 45.6], tiles: 7, ports: ['N', 'E', 'W'] });
const VIEWPOINT = fountainPlazaPlan({ id: 'viewpoint', title: 'East Belvedere', position: [57.6, 0], tiles: 9, ports: ['W'] });
// DIFFERENT `tiles` on purpose: `openSpace.areaSpread` wants >= 1.8 between the
// largest and smallest plaza, and equal-sized rects measure exactly 1.0.

// ── 3. THE THREE WORLDS' STRUCTURAL SET-PIECES (themed bazaars) ─────────────
// 6 / 3 / 3 slots — three DIFFERENT lengths, so `openSpace.areaSpread` clears its
// 1.8 floor (three identical rows measure exactly 1.0 and throw away half the
// axis-15 plaza point).
//
// MEASURED `bazaarPlan` DEFECT, and it is NOT avoidable by the author. A row's
// stall anchors sit at +-1.2 u across the aisle (`side * CELL`), the aisle itself
// is PAVED into the fused net, and the gate's `padNearStreet` floor is 1.20 u — so
// every stall in every row sits EXACTLY ON the threshold. Measured over row sizes
// 3..8 in isolation: stall -> street is 1.200 u in ALL of them, and which rows
// then trip the lint is decided by floating-point in the `facing` rotation.
// Measured in THIS park: 6/3/3 -> 6 non-fatal `padNearStreet` lints (the 13-tile
// row is clean, the two 7-tile rows are not); 4/4/4 -> 8. Published skeleton C
// ships 5 of the same lint. It is non-fatal and `validatePark` still reads
// ok: true — but until `bazaarPlan` offsets its own rows (or publishes a
// `rowClear` to assert against) NO row configuration clears it.
const PULSE_ROW = bazaarPlan({
  id: 'pulseRow', title: 'Neon Row', position: [12.0, 52.8],
  facing: { port: 'W', toward: [0, 52.8] },
  // EACH WORLD'S ROW CARRIES ITS OWN COUNTER (`neonSlush` here). Before the
  // themed five were added to `BazaarStallKind` the vocabulary was the neutral
  // five only, so all three rows were the same three shops in different
  // canopy colours — and axis 16's ownContent term reads a world stocked
  // entirely from the neutral catalog as a world that is dressed, not built.
  stalls: ['neonSlush', 'cottonCandy', 'balloon', 'burger', 'hotDog', 'soda'],
  theme: PULSE_DISTRICT, seed: 7,
});
const WORKS_ROW = bazaarPlan({
  id: 'worksRow', title: 'Dockside Arcade', position: [-52.8, -16.8],
  facing: { port: 'E', toward: [-44.4, -16.8] },
  stalls: ['sushi', 'hotDog', 'soda'], theme: TIDEWATER_HOLLOW, seed: 9,
});
const GLADE_ROW = bazaarPlan({
  id: 'gladeRow', title: 'Toadstool Market', position: [56.4, -14.4],
  facing: { port: 'W', toward: [48.0, -14.4] },
  stalls: ['honeywitch', 'burger', 'soda'], theme: THORNWICK_GLADE, seed: 11,
});
/** ONE dressed avenue on the hub's west spoke — the natural approach leg */
const AVE_WEST = boulevardPlan({ id: 'aveW', from: [-6.0, 45.6], to: [-12.0, 45.6], spacing: 3.0, seed: 5 });

// ── 4. THE STREET SKELETON — 31 authored cells ──────────────────────────────
const GATE: XZ = [0, 63.6];
const NODES: XZ[] = [
  /*  0 */ GATE,             // [0, 63.6]  +z rim, CENTRED
  /*  1 */ [0, 58.8],        // gate-street junction               4.8 u from the turnstile
  /*  2 */ [9.6, 58.8],      // NEAR-GATE ride TAIL (leaf) — 4.8 + 9.6 = 14.4 u <= 15 ✓
  /*  3 */ [22.8, 45.6],     // east apron  <- hub:E
  /*  4 */ [22.8, 27.6],     // east spine north — crosses UNDER the N beam (z 34.2)
  /*  5 */ [9.6, 27.6],      // ring-ENTRY column head. x 9.6 is EAST of the flagship's
  //                            north valley (x <= 7.2) and south valley (x <= 4.8)
  /*  6 */ [0, 27.6],        // RING NORTH platform tail — LEAF (deck [0, 34.2], 6.6 u)
  /*  7 */ [22.8, 0],        // east-spine junction — the satellite branch leaves HERE
  /*  8 */ C_TAIL,           // [22.8, -3.6] FLAGSHIP queue TAIL. Its lane runs
  //                            x 18.49..22.8, i.e. 0.49 u east of the station rect,
  //                            and BOTH its street edges are perpendicular to it.
  /*  9 */ [22.8, -8.4],     // east junction
  /* 10 */ [36.0, -8.4],     // RING EAST platform tail — LEAF. Nothing continues east:
  //                            x 42.6 is the deck. (The published table's `7 -> 20`.)
  /* 11 */ [22.8, -14.4],    // south-east corner — the EAST STRIP row starts here
  /* 12 */ [48.0, -14.4],    // thornwick court — wires gladeRow:W
  /* 13 */ [48.0, -19.2],    // T MoonlitBarge (out +x, cap 4) — leaf
  /* 14 */ [49.2, 0],        // satellite belvedere approach, OUTSIDE the ring band.
  //                            2.4 u off `viewpoint:W` [51.6, 0]: at [50.4, 0] the gap to
  //                            the plaza's SOLID pad is exactly 1.80 u and the 1.8 u
  //                            FountainPlaza clearance is a STRICT `<`, so it fails.
  /* 15 */ [9.6, -21.6],     // ring interior spine, south end — the whole 49.2 u leg
  //                            is corridor-clear and dry
  /* 16 */ [0, -21.6],       // south leg junction
  /* 17 */ [0, -57.6],       // RING SOUTH platform tail — LEAF (deck [0, -51.0], queue
  //                            faces OUT, so the tail is SOUTH of the deck). Reached
  //                            from 20 -> 30 along the ONE dry corridor past the
  //                            seed's primary ridge (x <= -23); a column at x 0 from
  //                            node 16 would cross the ridge and shave it 8.59 -> 0.83.
  /* 18 */ [-13.2, -21.6],   // south-west junction — foot of the WEST spoke
  /* 19 */ [-24.0, -21.6],   // south-west corner
  /* 20 */ [-24.0, -48.0],   // second-coaster stub junction
  /* 21 */ B_TAIL,           // [-27.6, -48.0] SECOND COASTER queue TAIL — leaf.
  //                            Its lane runs x -31.91..-27.6, i.e. WEST of the tail,
  //                            while the stub 20-21 runs EAST. No overlap.
  /* 22 */ [-13.2, -16.8],   // west leg head
  /* 23 */ [-36.0, -16.8],   // west leg mid — 8.4 u SOUTH of the W platform pad
  /* 24 */ [-36.0, -8.4],    // RING WEST platform tail — LEAF (deck [-42.6, -8.4])
  /* 25 */ [-44.4, -16.8],   // brasswork court — wires worksRow:E
  /* 26 */ [-44.4, -21.6],   // T GearworksExpress (out -x, cap 6) — leaf
  /* 27 */ [-13.2, 45.6],    // north-west corner <- aveW:B
  /* 28 */ [-13.2, 21.6],    // west column mid
  /* 29 */ [0, 52.8],        // gate-street mid — wires pulseRow:W
  /* 30 */ [-24.0, -57.6],   // SOUTH SHELF corner — the elbow of the ring's S approach.
  //                            x -24.0 is the SAME column as 19/20, so this adds no new
  //                            bearing; it is 10.2 u from the ridge's west peak
  //                            (-13.8, -42.0) r 9.25, i.e. just clear of its skirt.
  // ── §4.0-L WEST-SPOKE JOG (31-34) ────────────────────────────────────────────
  // §4.0-L flies LOWER than the §4.0-C this table was cut for (maxY 4.75 vs 6.05),
  // so the single column at x -13.2 from z 21.6 to -16.8 clipped BOTH its north
  // valley (0.6 u against a 1.6-u corridor) and its south valley. No shifted
  // column fixes it: south x[-17.4,3.0] forces x <= -19.0, west x[-22.2,-21.0]
  // forces x >= -19.4, and seed 1's secondary bowl reaches x -18.1 — so x -19.2
  // moves that lake 25 u (`waterRePicked`, the counter-example SETUP.md names).
  // The spoke therefore JOGS west twice, threading between the valleys:
  /* 31 */ [-16.8, 45.6],    // the jog leaves from 27, NOT from 28: node 28 is
  //                            the GoKarts queue TAIL and its lane runs west
  //                            along z 21.6, so a street there is a `blockers` FAIL
  //                            through its own railing. 28 stays a LEAF.
  /* 32 */ [-16.8, -10.8],   // straight down, 4.2 u clear of the west valley too
  /* 33 */ [-21.6, -10.8],   // jog west, 3.0 u NORTH of the south valley
  /* 34 */ [-21.6, -16.8],   // straight down, 4.2 u WEST of the south valley;
  //                            x -21.6 sits inside the west valley's x band but
  //                            its z range ends at -4.2, so this leg is clear.
  /* 35 */ [22.8, -21.6],    // SOUTH-EAST elbow — carries the park-spanning cycle now that
  //                            the ring interior is closed (see the [11,35] edge).
];
const EDGES: [NetRef, NetRef][] = [
  [0, 1], [1, 29], [29, 'hub:N'], [1, 2],            // the gate spine + the near-gate tail
  ['pulseRow:W', 29],                                // the front world's row
  ['hub:E', 3], [3, 4], [4, 5], [5, 6],              // the EAST spoke + the ring N tail
  [4, 7], [7, 8], [8, 9], [9, 10],                   // east spine + flagship tail + E tail
  [9, 11], [11, 12], ['gladeRow:W', 12], [12, 13],   // the EAST STRIP row + thornwick
  [7, 14], [14, 'viewpoint:W'],                      // the satellite branch, off the SPINE
  [11, 35], [35, 15], [15, 16],                      // §4.0-L closes the ring INTERIOR to a
  //                                                    north-south column (north valley reaches
  //                                                    x 9.0, east sweep starts x 10.2, and the
  //                                                    1.6-u corridor needs >=10.6 or <=8.6 —
  //                                                    no legal x). So the cycle comes south down
  //                                                    the EAST spine and west along z -21.6.
  [16, 18], [18, 19], [19, 20], [20, 21],            // the SOUTH leg + coaster-2 stub
  [20, 30], [30, 17],                                // the SOUTH SHELF -> the ring S tail
  [18, 22], [23, 24],                                // the WEST spoke foot + W tail
  [23, 25], ['worksRow:E', 25], [25, 26],            // the WEST SHELF + brasswork
  ['aveW:A', 'hub:W'], ['aveW:B', 27], [27, 28],     // the WEST spoke, both chain ends
  [27, 31], [31, 32], [32, 33], [33, 34],            // the §4.0-L JOG (see NODES 31-34)
  [34, 22], [34, 23],                                // ...back onto the z -16.8 shelf
];

// ── 5. THE QUEUE ARITHMETIC (§0.19) + the pad margin ────────────────────────
// `clear` for a ride pad is `max(1.8, padHalf + pathWidth/2 + 0.05)` where
// padHalf is the largest half-extent of the RENDERED rig, NOT a function of
// capacity. Measured track spans (probe-tracked-roster.mjs) give the floors
// below; the two <FountainPlaza>-adjacent flats take the compact default.
const PAD_MARGIN: Record<string, number> = {
  GhostTrain: 4.77, HauntedMansion: 4.77, PaddleBoats: 3.12, Discotron: 3.07,
  FerrisWheel: 2.97, AetherBalloons: 2.95,
  // measured track spans -> padHalf + 0.55 + 0.05, rounded UP to the lattice
  GearworksExpress: 8.4,   // 15.1 x 7.4  -> padHalf 7.55
  RiverRapids: 6.6,        // a flume basin; the generous clear only pushes the pad
  //                          FURTHER from the street, and the reach floor still holds
  MagneticRide: 5.4,       //  9.0 x  8.3 -> padHalf 4.5
  MoonlitBarge: 4.8,       //  8.5 x  6.05 -> padHalf 4.25
  SpaceRings: 1.92,        // NEVER SHIPPED, and a SMALLER court than Helicycles' 3.2
  LaunchedFreefall: 2.25,  // NEVER SHIPPED, smaller court than MotionSimulator's 3.2
  GoKarts: 3.60,           // NEVER SHIPPED. Stock kart course is ~6.0 x 4.5 (the LAYOUT
  //                          comment in components/GoKarts) -> padHalf 3.0 + 0.55 + 0.05.
  //                          SMALLER than the <MagneticRide> 5.4 it replaces, so the
  //                          meadow it stands in was already clear at a wider margin.
};
const padMarginOf = (rig: string) => PAD_MARGIN[rig] ?? 3.2;
const minReachOf = (c: number) => laneLenOf(c) + 0.35 + 0.62 + 0.5 + 0.45;

// ── 6. PORT RESOLUTION + THE MODULE-SCOPE ASSERTIONS ────────────────────────
const PIECES: SetPiecePlan[] = [HUB, VIEWPOINT, AVE_WEST];
const ALL_PLANS: SetPiecePlan[] = [...PIECES, PULSE_ROW, WORKS_ROW, GLADE_ROW];
const portCell = (ref: NetRef): XZ => {
  if (typeof ref === 'number') return NODES[ref];
  const [id, name] = ref.split(':');
  const p = ALL_PLANS.find((q) => q.id === id);
  if (!p) throw new Error(`EDGES references '${ref}' but no plan with id '${id}' is in PIECES or the world rows`);
  return p.port(name);
};
// CARDINAL on the RESOLVED cells, with a TOLERANCE (port cells are computed, so
// 7 * 0.6 + 0.6 is 4.799999999999999 and a strict !== throws a false diagonal).
const EPS = 1e-6;
EDGES.forEach(([a, b]) => {
  const A = portCell(a), B = portCell(b);
  parkAssert('edgeCardinal', !(Math.abs(A[0] - B[0]) > EPS && Math.abs(A[1] - B[1]) > EPS),
    `diagonal edge ${a}->${b}: [${A[0].toFixed(2)}, ${A[1].toFixed(2)}] -> [${B[0].toFixed(2)}, ${B[1].toFixed(2)}]. ` +
      'buildParkNet repairs it with an ELBOW through a synthesised corner you did not plan.');
});

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
      if (ports.has(`${n[0].toFixed(2)},${n[1].toFixed(2)}`)) return;      // a PORT is legal
      const dx = n[0] - f.cx, dz = n[1] - f.cz;
      const lx = dx * c - dz * s, lz = dx * s + dz * c;
      const gap = Math.max(Math.abs(lx) - f.hx, Math.abs(lz) - f.hz);      // < 0 => INSIDE
      if (gap < clear)
        hits.push(`[${n[0]}, ${n[1]}] (${what} ${i}) is ${gap.toFixed(2)} u from '${p.id}' (${p.kind}) — needs ${clear}`);
    });
  });
  parkAssert('nodesOffPieces', !hits.length,
    `${hits.length} ${what}(s) stand inside or against a set-piece's SOLID footprint:\n  ${hits.join('\n  ')}`);
}
assertNodesOffPieces(NODES, ALL_PLANS);

// PORT-REF AUDIT — PRESENCE for every piece, BOTH ENDS for a CHAIN piece.
const PORT_REFS = EDGES.flat().filter((x): x is string => typeof x === 'string');
ALL_PLANS.forEach((p) => {
  const wired = new Set(PORT_REFS.filter((r) => r.split(':')[0] === p.id).map((r) => r.split(':')[1]));
  parkAssert('pieceWired', wired.size > 0,
    `set-piece '${p.id}' has NO '${p.id}:<PORT>' ref in EDGES — it composes as an ISLAND`);
  p.ports.filter((pt) => !pt.prunable).forEach((pt) => {
    parkAssert('chainEndWired', wired.has(pt.name),
      `chain piece '${p.id}' (${p.kind}) wires [${[...wired]}] but NOT '${p.id}:${pt.name}' — a prunable:false port ` +
        'is a structural carriageway END, so this avenue dead-ends in grass (deadStreetNode)');
  });
});

// `facing` AND THE WIRED PORT AGREE.
ALL_PLANS.forEach((p) => {
  const wired = PORT_REFS.filter((r) => r.startsWith(`${p.id}:`));
  const f = (p as { facing?: { port: string } }).facing;
  parkAssert('facingWired', !f || wired.includes(`${p.id}:${f.port}`),
    `'${p.id}' declares facing.port '${f?.port}' but EDGES wires [${wired.join(', ')}]`);
});

// BOTH CIRCUITS' CORRIDOR: no street NODE and no street EDGE inside any rect
// that is not the ride's own station leg.
{
  const inRect = (x: number, z: number, r: Rect) =>
    x >= r.x[0] - EPS && x <= r.x[1] + EPS && z >= r.z[0] - EPS && z <= r.z[1] + EPS;
  const foreign = KEEPOUT.filter((r) => !r.own);
  const hits: string[] = [];
  NODES.forEach((n, i) => foreign.forEach((r) => {
    if (inRect(n[0], n[1], r)) hits.push(`node ${i} [${n[0]}, ${n[1]}] is inside ${r.who}`);
  }));
  EDGES.forEach(([a, b]) => {
    const A = portCell(a), B = portCell(b);
    const steps = Math.max(1, Math.ceil(Math.hypot(B[0] - A[0], B[1] - A[1]) / 0.6));
    for (let k = 0; k <= steps; k += 1) {
      const u = k / steps, x = A[0] + (B[0] - A[0]) * u, z = A[1] + (B[1] - A[1]) * u;
      foreign.forEach((r) => { if (inRect(x, z, r)) hits.push(`edge ${a}->${b} crosses ${r.who} at [${x.toFixed(1)}, ${z.toFixed(1)}]`); });
    }
  });
  const uniq = [...new Set(hits)];
  parkAssert('corridor', !uniq.length,
    `${uniq.length} corridor violation(s) — a street at grade through a coaster's VALLEY leg (the valleys run ` +
      `~0.6 u up, nowhere near the 2.2 u overfly gate):\n  ${uniq.join('\n  ')}`);
}

// THE TWO CIRCUIT BOUNDING BOXES MUST BE DISJOINT (§4.0-E rule 2).
{
  const gapX = Math.max(FLAG_BB.x[0] - FLAG2_BB.x[1], FLAG2_BB.x[0] - FLAG_BB.x[1]);
  const gapZ = Math.max(FLAG_BB.z[0] - FLAG2_BB.z[1], FLAG2_BB.z[0] - FLAG_BB.z[1]);
  parkAssert('circuitsDisjoint', gapX > 0 || gapZ > 0,
    `the two circuits' bboxes OVERLAP: ${JSON.stringify(FLAG_BB)} vs ${JSON.stringify(FLAG2_BB)}. ` +
      'Rings are hollow but the `footprints` SAT check is not.');
  // and neither may stand on a monorail platform cell
  RING_CELLS.forEach((c) => {
    [['flagship', FLAG_BB], ['second', FLAG2_BB]].forEach(([who, bb]) => {
      const b = bb as typeof FLAG_BB;
      parkAssert('circuitOffRing',
        !(c[0] >= b.x[0] - EPS && c[0] <= b.x[1] + EPS && c[1] >= b.z[0] - EPS && c[1] <= b.z[1] + EPS),
        `${who} circuit's bbox contains the monorail ground cell [${c}] — the beam may be crossed, the PLATFORMS may not`);
    });
  });
}

// EVERY MONORAIL PLATFORM TAIL IS A LEAF.
RING_TAILS.forEach((c) => {
  const i = NODES.findIndex((n) => Math.hypot(n[0] - c[0], n[1] - c[1]) < 1e-6);
  parkAssert('tailAuthored', i >= 0, `monorail platform tail [${c}] is not a cell in NODES — NO QUEUE WAS PLACED`);
  if (i < 0) return;
  const deg = EDGES.filter(([a, b]) => a === i || b === i).length;
  parkAssert('tailIsLeaf', deg <= 1,
    `street node ${i} [${c}] is a monorail platform tail with degree ${deg}. A tail sits 6.6 u off a deck, so ` +
      'anything continuing past it runs THROUGH the platform pad. Hang the branch off the SPINE instead.');
});

// NO QUEUE TAIL IS ALSO A SET-PIECE PORT CELL.
const QUEUE_TAILS: XZ[] = [
  NODES[2], C_TAIL, NODES[13], B_TAIL, NODES[26],
  ...RING_TAILS,
];
const PORT_CELLS = ALL_PLANS.flatMap((p) => p.ports.map((pt) => ({ id: p.id, name: pt.name, at: p.port(pt.name) as XZ })));
QUEUE_TAILS.forEach((t) => {
  const hit = PORT_CELLS.find((q) => Math.hypot(q.at[0] - t[0], q.at[1] - t[1]) < 1.2 - 1e-6);
  parkAssert('tailOffPort', !hit,
    hit ? `queue tail [${t}] is (or abuts) '${hit.id}:${hit.name}'s port cell [${hit.at}] — the derived exit lane ` +
      'leaves from the cell NEXT to the tail, which is inside the piece.' : '');
});

// ── 7. §1-W THE PINNED ROW'S WATER, AS DATA + THE BOX PRE-FILTER ────────────
// ADVISORY: the published `box` is the basin CHAIN's bounding box, so it has
// known false positives in the corners and known false NEGATIVES where the real
// bowls reach past it. §5c's re-compose is the AUTHORITY.
type SeedBasin = { ctr: XZ; box: [number, number, number, number] };
type SeedRow = { dom: SeedBasin; sec: SeedBasin };
const SEED_ROW_WATER: Record<string, SeedRow> = {
  '1/temperate': { dom: { ctr: [41, -39], box: [21, 60, -60, -21] }, sec: { ctr: [-38, 31], box: [-56, -21, 23, 39] } },
};
const ROW = SEED_ROW_WATER['1/temperate'];
const inBasinBox = (c: XZ, b: SeedBasin) =>
  c[0] >= b.box[0] && c[0] <= b.box[1] && c[1] >= b.box[2] && c[1] <= b.box[3];
function assertKeepDryOffRow(cells: XZ[], row: SeedRow, nearR = 12): void {
  const hits: string[] = [];
  for (const c of cells)
    for (const [name, b] of [['DOMINANT', row.dom], ['SECONDARY', row.sec]] as const) {
      if (inBasinBox(c, b)) hits.push(`[${c[0]}, ${c[1]}] is INSIDE the ${name} box`);
      else if (Math.hypot(c[0] - b.ctr[0], c[1] - b.ctr[1]) < nearR)
        hits.push(`[${c[0]}, ${c[1]}] is within ${nearR} u of the ${name} centroid`);
    }
  parkAssert('keepDryOffRow', !hits.length,
    `${hits.length} guard cell(s) overlap the pinned row's PUBLISHED water box (advisory — §5c is the authority):\n  ` +
      hits.slice(0, 10).join('\n  '), 'advisory');
}
/** THE SIEVE. `buildParkNet` merges every set-piece and world cell into
 *  `NET.keepDry`, so the fuse's output is NOT a guard list yet: a blanket
 *  `NODES.slice()` is what hid thirteen wet cells in the published table, and a
 *  blanket `NET.keepDry` is what moved seed 1's bodies 77.3 / 69.4 u. */
const offRow = (c: XZ, row: SeedRow = ROW, nearR = 12) =>
  [row.dom, row.sec].every((b) =>
    !inBasinBox(c, b) && Math.hypot(c[0] - b.ctr[0], c[1] - b.ctr[1]) >= nearR);
function keepDryOf(net: { keepDry: XZ[] }, row: SeedRow = ROW): XZ[] {
  const kept = net.keepDry.filter((c) => offRow(c, row));
  const dropped = net.keepDry.length - kept.length;
  if (dropped) {
    // eslint-disable-next-line no-console
    console.warn(
      `[Skeleton A] keepDryOf dropped ${dropped} of ${net.keepDry.length} guard cell(s) on the pinned row's water. ` +
        'A DROPPED guard is NOT a fixed cell — whatever you meant to build there is still in the lake. MOVE it.');
  }
  return kept;
}

// ── 8. THE WORLDS' HAND-PLACED SCENERY CELLS (guarded — they are STRUCTURES) ─
const PULSE_SC: XZ[] = [[24.0, 55.2], [24.0, 49.2], [16.8, 61.2]];
const WORKS_SC: XZ[] = [[-58.8, -8.4], [-58.8, -24.0], [-49.2, -6.0]];
const GLADE_SC: XZ[] = [[52.8, -8.4], [61.2, -8.4], [48.0, -10.8]];
const BINS: XZ[] = [[-2.4, 56.4], [22.8, 33.6], [1.2, -18.0], [-15.6, -14.4], [46.8, -11.6]];

// ── 9. ONE FUSE — buildParkNet is called EXACTLY ONCE ───────────────────────
// `pieces: ALL_PLANS` — the two plazas, the avenue AND all three world rows. The
// WORLDS themselves are planned below (they need the ride pads, which come out of
// this fuse), so they are not passed as `worlds:`; every world piece is therefore
// listed here explicitly, which is what keeps the port-ref audit above and the
// fuse looking at the SAME piece set. Pass `pieces: PIECES` instead and every
// '<bazaarId>:<PORT>' ref is DROPPED as an unknown port (measured: 3 FATAL
// `unknownPort` lints and three orphan islands).
const KEEP_DRY: XZ[] = [...RING_CELLS, ...PULSE_SC, ...WORKS_SC, ...GLADE_SC];
const NET = buildParkNet({
  nodes: NODES, edges: EDGES, pieces: ALL_PLANS,
  keepDry: KEEP_DRY, bins: BINS,
});
const GUARD_BASE = keepDryOf(NET);
assertKeepDryOffRow(GUARD_BASE, ROW);

// ── 10. §5c PASS ONE — compose the row so `place()` has a real heightfield ──
// `parkComposition(t, seed, size, climate, guards)` is POSITIONAL and PURE, and
// `size` DEFAULTS TO 48, so 128 must be passed or a different park is audited.
const BARE = parkComposition(THREE, SEED, SIZE, CLIMATE);
const COMP0 = parkComposition(THREE, SEED, SIZE, CLIMATE, { keepDry: GUARD_BASE, coasterPts: ALL_COASTER_PTS });
/** THE DRYNESS PREDICATE, from the COMPOSED basins. The waterline is
 *  0.74 * radius — the constant `ParkBuilder/dressing.ts` sieves with. */
// clampBasins IS THE THIRD LIST AND OMITTING IT IS A SILENT WRONG ANSWER: <Terrain>
// builds its heightfield from the clamp discs too, so a cell measured against only
// basins + basinsSecond can report dry: true and then compose ~3.9 u underwater.
// This file shipped with the two-list version while all four published copies of
// the predicate were being corrected to three; it is the reference park, so the
// omission here would have propagated straight back out into the next skeleton.
const isDryIn = (comp: typeof COMP0, c: XZ, margin = 1.2) =>
  [...comp.basins, ...comp.basinsSecond, ...(comp.clampBasins ?? [])].every(
    (b) => Math.hypot(c[0] - b.x, c[1] - b.z) > 0.74 * b.radius + margin);
/** the PEAK-BUMP contribution validatePark fails a footprint on at > 0.75 */
const PEAK_LIMIT = 0.75;
const bumpIn = (comp: typeof COMP0, c: XZ) =>
  Math.max(0, ...comp.peaks.map((p) => {
    const k = Math.max(0, 1 - Math.hypot(c[0] - p.x, c[1] - p.z) / p.radius);
    return k * k * (3 - 2 * k) * p.height;
  }));

// ── 11. THE PAD HELPER — streets, THEN terrain, and the reach floor ─────────
// `offPathCell` is street-aware and TERRAIN-BLIND, so the helper's LAST test is
// a FLATNESS test: a boardPoint on a hill flank at bump > 0.75 is a hard
// `terrain` FAIL every street check here is invisible to.
function assertPadFlat(pad: XZ, clear: number, label: string): XZ {
  if (bumpIn(COMP0, pad) <= PEAK_LIMIT && isDryIn(COMP0, pad)) return pad;
  for (let r = 1; r <= 8; r += 1)
    for (let ix = -r; ix <= r; ix += 1)
      for (let iz = -r; iz <= r; iz += 1) {
        if (Math.max(Math.abs(ix), Math.abs(iz)) !== r) continue;          // ring, not disc
        const c: XZ = [+(pad[0] + ix * 0.6).toFixed(2), +(pad[1] + iz * 0.6).toFixed(2)];
        if (bumpIn(COMP0, c) > PEAK_LIMIT || !isDryIn(COMP0, c)) continue;
        const off = offPathCell(NET, c, { clear });
        if (off && Math.hypot(off[0] - c[0], off[1] - c[1]) < 1e-6) {
          // eslint-disable-next-line no-console
          console.warn(`[Skeleton A] ${label}: pad [${pad}] on a hill flank or in water ` +
            `(bump ${bumpIn(COMP0, pad).toFixed(2)}) — moved to [${c}]`);
          return c;
        }
      }
  parkAssert('padOnFlank', false,
    `${label}: pad [${pad}] is on a hill flank (bump ${bumpIn(COMP0, pad).toFixed(2)} > ${PEAK_LIMIT}) or wet, and no ` +
      'cell within 4.8 u is flat, dry AND clear of the street. MOVE THE TAIL — this rig is standing on a range.');
  return pad;
}
function place(tail: XZ, out: XZ, capacity: number, rig: string) {
  const clear = padMarginOf(rig);
  const join = laneLenOf(capacity) + 0.35;
  // TWO lattice cells past the floor, not one: `minReachOf` is the floor for the
  // BOARD PAD, and a composableRide's boardPoint sits NEARER the tail than
  // `position` is (1.40 u on a <Discotron>).
  const reach = minReachOf(capacity) + 2.4;
  const cand: XZ = [+(tail[0] + out[0] * reach).toFixed(2), +(tail[1] + out[1] * reach).toFixed(2)];
  const onStreet = (offPathCell(NET, cand, { clear }) ?? cand) as XZ;       // streets…
  const pad = assertPadFlat(onStreet, clear, rig);                         // …THEN terrain
  const got = Math.hypot(pad[0] - tail[0], pad[1] - tail[1]);
  parkAssert('padReach', got >= minReachOf(capacity) + 1.2,
    `${rig}: pad [${pad}] sits ${got.toFixed(2)} u from its tail [${tail}] — the cap-${capacity} floor is ` +
      `${(minReachOf(capacity) + 1.2).toFixed(2)} u. offPathCell's ring search pulled the candidate INWARD, which ` +
      'means the court is too tight: move the TAIL outward or open the court. Do NOT lower the clearance.');
  return {
    pad,
    anchor: [+(tail[0] + out[0] * join).toFixed(2), +(tail[1] + out[1] * join).toFixed(2)] as XZ,
    dir: [-out[0], -out[1]] as XZ,
    yaw: Math.atan2(-out[0], -out[1]),
  };
}

// ── 12. THE PADS, out of the fuse ───────────────────────────────────────────
const SIM = place(NODES[2], [1, 0], 4, 'LaunchedFreefall');      // pulse, near the gate
const MANSION = place(NODES[26], [-1, 0], 6, 'HauntedMansion');  // brasswork, the west shelf
const BARGE = place(NODES[13], [1, 0], 4, 'MoonlitBarge');       // thornwick, the east strip
// OUT FLIPPED WEST -> EAST for §4.0-L. Node 28 is this ride's tail, and with the
// spoke's new jog column at x -16.8 a westward lane put the street THROUGH its own
// queue railing (`blockers`, -3 on axis 12). Facing east the lane runs into the
// open meadow between the column and the hub, clear of the L-north valley (which
// tops out at z 18.6, while this lane sits at z 21.6).
// SWAPPED <MagneticRide> -> <GoKarts> for axis 14's NEVER-USED CIRCUIT shelf (0.25).
// Both are TRACKED `transport`-family circuits, so the roster keeps its 7 circuits and
// 4 families; the difference is that no park in the 30-park corpus has ever shipped a
// go-kart course, and MagneticRide has. Capacity drops 8 -> 4 because the ride IS its
// four karts (one driver each, distinct `seatWorld` anchors) — registering 8 would seat
// guests on anchors that do not exist.
const MAGLEV = place(NODES[28], [1, 0], 4, 'GoKarts');           // the west column's meadow
const HELI = place(NODES[11], [0, -1], 2, 'SpaceRings');         // the south-east apron
const DRIFT = place(NODES[15], [0, -1], 6, 'RiverRapids');       // the ring's interior south
const PADS = [SIM, MANSION, BARGE, MAGLEV, HELI, DRIFT];
assertNodesOffPieces(PADS.map((p) => p.pad), ALL_PLANS, 'ride pad');
assertNodesOffPieces(PADS.map((p) => p.anchor), ALL_PLANS, 'queue anchor');

// ── 13. THE WORLD REGIONS — the set-piece PLUS every hand-placed cell ───────
// `include` IS NOT OPTIONAL: a hand-mounted ride/stall/scenery is not a member
// plan, so without its cell the piece falls OUTSIDE the region and counts for
// nothing (`built` stays false, the piece reads `unplacedThemed`).
const PULSE = worldPlan({
  id: 'pulse', theme: PULSE_DISTRICT, pieces: [PULSE_ROW],
  rides: [{ at: SIM.pad, name: 'Pulse Launcher' }],
  include: [...PULSE_SC, [16.8, 40.8], [16.8, 37.2], [12.0, 37.2]],
});
// RE-THEMED brasswork -> TIDEWATER for the axis-16 world-CHOICE credit. Measured over
// the 30-park corpus: brasswork 12 and pulse 12 are OVERUSED, thornwick 11 is AT the
// median, tidewater 2 and emberfall 5 are UNDERUSED — and choice credit is strictly
// median-relative. Safe here because this world's only ride is <HauntedMansion>, which
// carries NO themeId, so re-theming the district cannot raise a `crossTheme` finding.
const FOUNDRY = worldPlan({
  id: 'tidewater', theme: TIDEWATER_HOLLOW, pieces: [WORKS_ROW],
  rides: [{ at: MANSION.pad, name: 'The Drowned Manor' }],
  include: [...WORKS_SC, [-44.4, -8.4], [-46.8, -12.0]],
});
const GLADE = worldPlan({
  id: 'thornwick', theme: THORNWICK_GLADE, pieces: [GLADE_ROW],
  rides: [{ at: BARGE.pad, name: 'Toadstool Barge' }],
  include: [...GLADE_SC, [44.4, -14.4], [45.6, -10.8]],
});
const WORLDS = [PULSE, FOUNDRY, GLADE];
([['pulse', PULSE_SC], ['tidewater', WORKS_SC], ['thornwick', GLADE_SC]] as const).forEach(([id, cells]) => {
  const w = WORLDS.find((x) => x.id === id)!;
  const inside = cells.filter((c) => w.contains(c)).length;
  parkAssert('sceneryInWorld', inside >= 3,
    `world '${id}' has ${inside} scenery cell(s) INSIDE its rect — the floor is 3 per world.`);
});
// NEITHER CIRCUIT MAY SIT IN A WORLD RECT (§4.0-E rule 4).
WORLDS.forEach((w) => {
  const r = w.region as unknown as { cx: number; cz: number; hx: number; hz: number };
  ([['flagship', FLAG_BB], ['second', FLAG2_BB]] as const).forEach(([who, bb]) => {
    const ox = Math.min(bb.x[1], r.cx + r.hx) - Math.max(bb.x[0], r.cx - r.hx);
    const oz = Math.min(bb.z[1], r.cz + r.hz) - Math.max(bb.z[0], r.cz - r.hz);
    parkAssert('circuitOffWorld', ox <= 0 || oz <= 0,
      `the ${who} circuit's bbox ${JSON.stringify(bb)} overlaps world '${w.id}' by ${ox.toFixed(2)} x ${oz.toFixed(2)} u`);
  });
});

// ── 14. §5c PASS TWO — COMPOSE THE WATER TWICE AND REFUSE TO SHIP IF IT MOVED
// THIS IS THE AUTHORITY; the §1-W box sieve above is only its pre-filter.
const GUARDS: XZ[] = [
  ...GUARD_BASE,
  ...PADS.map((p) => p.pad),
  ...PADS.map((p) => p.anchor),
].filter((c) => offRow(c));
const COMP = parkComposition(THREE, SEED, SIZE, CLIMATE, { keepDry: GUARDS, coasterPts: ALL_COASTER_PTS });
const movedBy = (a: XZ | null, b: XZ | null) =>
  a && b ? Math.hypot(a[0] - b[0], a[1] - b[1]) : a === b ? 0 : Infinity;
([['DOMINANT', BARE.waterCentre, COMP.waterCentre],
  ['SECONDARY', BARE.waterCentreSecond, COMP.waterCentreSecond]] as const).forEach(([n, a, b]) => {
  const d = movedBy(a as XZ | null, b as XZ | null);
  parkAssert('waterRePicked', d <= 6,
    `your guard list MOVED the ${n} water body ${d === Infinity ? '— it VANISHED' : `${d.toFixed(1)} u`} ` +
      `(terrainSeed ${BARE.terrainSeed} -> ${COMP.terrainSeed}). keepDry does not AVOID water, it LIFTS the ground ` +
      'and pushes the body out: this is a §0-FATAL waterRePicked/waterShrunk. Guard ONLY what you pave and stand on.');
});
// AND DIFF THE *RELIEF*, NOT ONLY THE WATER: a landform the guard list flattened
// is a `terrainFlattened` the centroid diff passes clean. `report.reliefFloor` is
// NULL on an unguarded composition and on any plot <= 48, and it already carries
// the ratio — `kept` = built relief / authored relief, against `floor` 0.70.
// (`report.relief` DOES NOT EXIST: the published §3.1-A block reads it and throws
// a TypeError at module scope, i.e. a black page, on every park that copies it.)
{
  const rf = COMP.report.reliefFloor;
  parkAssert('terrainFlattened', !rf || rf.kept >= rf.floor,
    rf ? `keepDry FLATTENED the seed: authored relief ${rf.authoredRelief.toFixed(2)} -> built ${rf.relief.toFixed(2)} ` +
      `(kept ${rf.kept.toFixed(2)} against the ${rf.floor} floor), stdH ${rf.authoredStdH.toFixed(2)} -> ${rf.stdH.toFixed(2)}. ` +
      `Guarding a cell does not dodge the land, it LIFTS it — a tail or a deck on a range SHAVES the range. ` +
      `The ranges this guard list touched: ${JSON.stringify(rf.guardedRanges)}` : '',
    'advisory');
}

const isDry = (c: XZ, margin = 1.2) => isDryIn(COMP, c, margin);
/** `clampBasins` are the bowls the guard clamp itself dug and are NOT in
 *  `basins`, so an UNGUARDED cell can clear every composed basin disc and still
 *  compose metres under water. A GUARDED cell is raised by the same pass and
 *  must NOT be sieved this way — hence two predicates. */
const isDryUnguarded = (c: XZ, margin = 1.2) =>
  isDry(c, margin)
  && (COMP.clampBasins ?? []).every((b) => Math.hypot(c[0] - b.x, c[1] - b.z) > 0.74 * b.radius + margin);
const dry = (c: XZ): XZ => {
  parkAssert('cellInWater', isDry(c), `cell [${c}] is inside the COMPOSED waterline — move it, do not guard it`);
  return c;
};
// every PAVED / STRUCTURAL cell against the composed waterline
{
  const wet = NET.keepDry.filter((c) => !isDry(c, 0.6));
  parkAssert('pavedInWater', !wet.length,
    `${wet.length} paved/structural cell(s) sit inside the COMPOSED waterline — the first five: ` +
      wet.slice(0, 5).map((c) => `[${c[0].toFixed(1)}, ${c[1].toFixed(1)}]`).join(' '));
}

// ── 15. DRESSING — SIEVED, never guarded. Every authored cell that mounts
// geometry ends through `offPathCell`, INCLUDING the tree scatter: a tree plants
// a 0.7-u footprint and the gate's floor is pathWidth/2 + min(r, 0.6) - 0.1.
const TREE_SHAPES = ['round', 'pine', 'willow', 'round', 'pine'] as const;
type TreeShape = (typeof TREE_SHAPES)[number];
const RAW_TREES: [number, number][] = [
  [-34.8, 61.2], [-24.0, 57.6], [-45.6, 55.2], [-56.4, 60.0], [-8.4, 61.2], [6.0, 61.2],
  [31.2, 60.0], [40.8, 55.2], [52.8, 60.0], [-30.0, 49.2], [-38.4, 42.0], [-52.8, 44.4],
  [-58.8, 50.4], [8.4, 42.0], [31.2, 42.0], [43.2, 45.6], [55.2, 42.0], [-58.8, 21.6],
  [-49.2, 27.6], [-6.0, 33.6], [-4.8, 15.6], [-30.0, 14.4], [-27.6, 3.6], [-38.4, 27.6],
  [3.6, 8.4], [14.4, 21.6], [-58.8, -1.2], [-52.8, -12.0], [-33.6, -4.8], [-24.0, -8.4],
  [-8.4, -6.0], [4.8, -12.0], [14.4, -6.0], [33.6, -14.4], [43.2, -18.0], [58.8, -4.8],
  [-6.0, -27.6], [-16.8, -30.0], [-30.0, -33.6], [-8.4, -39.6], [-16.8, -55.2], [-30.0, -57.6],
  [-45.6, -25.2], [-57.6, -27.6], [-4.8, -49.2], [8.4, -46.8], [4.8, -57.6], [-52.8, -33.6],
];
const TREE_CELLS: { at: XZ; shape: TreeShape }[] = RAW_TREES.map((c, i) => ({
  at: (offPathCell(NET, c as XZ, { clear: 0.75 }) ?? c) as XZ,
  shape: TREE_SHAPES[i % TREE_SHAPES.length],
}));
const TREES_DRY = TREE_CELLS.filter((t) => isDryUnguarded(t.at, 2.4));

const NEUTRAL_SCENERY: { name: string; at: XZ }[] = ([
  ['flagpole', [-3.6, 61.2]], ['parkClock', [3.6, 61.2]], ['signpost', [-3.6, 55.2]],
  ['marbleStatue', [-8.4, 45.6]], ['topiarySpiral', [8.4, 49.2]], ['topiaryElephant', [-18.0, 42.0]],
  ['birdbath', [18.0, 33.6]], ['planterBox', [-18.0, 27.6]], ['picnicTable', [4.8, -16.8]],
  ['gazebo', [-19.2, -12.0]], ['wishingWell', [-19.2, -26.4]], ['lionStatue', [45.6, 4.8]],
  ['flagpole', [50.4, -8.4]], ['signpost', [-6.0, -21.6]],
] as [string, [number, number]][])
  .map(([name, at]) => ({ name, at: (offPathCell(NET, at as XZ, { clear: 1.6 }) ?? at) as XZ }))
  .filter((s) => isDryUnguarded(s.at, 2.4));

const RESTROOM: XZ = (offPathCell(NET, [-8.4, 52.8], { clear: 1.8 }) ?? [-8.4, 52.8]) as XZ;

// ── 16. THE ROSTER IS ARITHMETIC, WRITTEN FROM THE REGISTRATION ──────────────
// stalls = SUM over bazaar rows of plan.slots.length (POST-padding), plus the
// standalone stands mounted by hand. Here: 6 + 3 + 3 = 12, and no hand stalls.
const STALL_COUNT = [PULSE_ROW, WORKS_ROW, GLADE_ROW].reduce((n, b) => n + b.slots.length, 0);
const RIDE_NAMES = [
  'Corkscrew Ascent', 'Breakwater Flyer', 'Grand Circle Monorail', 'Pulse Launcher',
  'The Drowned Manor', 'Toadstool Barge', 'Meadowline Karts', 'Meadow Orbiter', 'Hollow Rapids',
];
parkAssertFlush();        // ← the LAST line of the assertion block

export function ThemePark() {
  return (
    <Park
      seed={SEED}
      climate={CLIMATE}
      size={SIZE}
      roster={{ rides: RIDE_NAMES, stalls: STALL_COUNT, categories: 5 }}
      onReady={(report: { ok: boolean }) => {
        // eslint-disable-next-line no-console
        console.log('[Skeleton A] validatePark', report);
      }}
    >
      <Terrain keepDry={GUARDS} coasterPts={ALL_COASTER_PTS} />
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

      {/* ── §4.2-A THE MANDATORY RING, at the published start pose. <Monorail>
          has NO `start` and NO `heading`: it is a composableRide, so its
          transform props are `position` and `rotation`, and it ALWAYS compiles
          its own track from the local origin [0, beamY, 0]. `rotation` stays 0 —
          the four decks below are published in the WORLD frame at this pose. ── */}
      <Monorail
        position={[-42.6, 0, -9.7]} rotation={0} pieces={MONO_PIECES} beamY={2.6} loopSeconds={12} pinned
        name="Grand Circle Monorail" capacity={6} rideDuration={12} intensity={1} price={0}
        queue={{ anchor: [-40.81, -8.4], dir: [1, 0] }}
        register={{
          board: [-42.6, 2.6, -8.4],
          stations: [
            { label: 'North', boardPoint: [0, 2.6, 34.2], queueAnchor: [0, 0.05, 32.41], queueDir: [0, -1], exitPoint: [-1.2, 0.05, 33.03], exitDir: [0, -1] },
            { label: 'East', boardPoint: [42.6, 2.6, -8.4], queueAnchor: [40.81, 0.05, -8.4], queueDir: [-1, 0], exitPoint: [41.43, 0.05, -7.2], exitDir: [-1, 0] },
            // SOUTH faces OUTWARD (-z). The other three queue inward; this one cannot,
            // because inward puts its tail on the summit of the seed's primary range.
            { label: 'South', boardPoint: [0, 2.6, -51.0], queueAnchor: [0, 0.05, -52.79], queueDir: [0, -1], exitPoint: [1.2, 0.05, -52.17], exitDir: [0, -1] },
          ],
        }}
      />

      {/* ── THE FLAGSHIP — §4.0-C INVERTING rectangle, the plot CORE ──
          `cars` IS NOT OPTIONAL EVEN THOUGH IT HAS A DEFAULT. Measured: with the
          prop omitted the component returns `ratings: null`, so probe.json reads
          `thrill.ratedCount 0`, `flagshipExcitement null`, `archetypes []` and
          `secondCoasterQualifies false` — i.e. §4.0-E's "each rateCoaster-measured"
          clause silently reads as UNMET on a park whose coasters are both fine.
          Pass the archetype's published car count (§4.0-C: 3, §4.0-B: 3). */}
      <Coaster
        name="Corkscrew Ascent"
        pieces={C_PIECES}
        start={C_START}
        heading={0}
        type="steel"
        cars={3}
        capacity={4}
        rideDuration={10}
        loadTime={2}
        intensity={9}
        price={7}
        queueTailNode={NET.node(C_TAIL)}
        queueDir={[1, 0]}
      />
      {/* ── THE SECOND CIRCUIT — §4.0-B FAMILY rectangle, the deep SOUTH-WEST ── */}
      <Coaster
        name="Breakwater Flyer"
        pieces={B_PIECES}
        start={B_START}
        heading={0}
        type="steel"
        cars={3}
        capacity={4}
        rideDuration={10}
        loadTime={2}
        intensity={6}
        price={5}
        queueTailNode={NET.node(B_TAIL)}
        queueDir={[1, 0]}
      />

      <FountainPlaza plan={HUB} />
      <FountainPlaza plan={VIEWPOINT} />
      <Boulevard plan={AVE_WEST} />

      {/* neutral rides, outside every world rect */}
      <GoKarts position={MAGLEV.pad} rotation={MAGLEV.yaw}
        register={{ name: 'Meadowline Karts', capacity: 4, rideDuration: 12, intensity: 5, price: 4 }}
        queue={{ anchor: MAGLEV.anchor, dir: MAGLEV.dir }} />
      <SpaceRings position={HELI.pad} rotation={HELI.yaw}
        register={{ name: 'Meadow Orbiter', capacity: 2, rideDuration: 8, intensity: 2, price: 2 }}
        queue={{ anchor: HELI.anchor, dir: HELI.dir }} />
      {/* UNTHEMED on purpose: a THEMED circuit standing outside every <World> rect is a
          `themedPieceOutsideWorlds` gate warning. <DeepDrift> was the first choice here and
          carries themeId 'tidewater', which this park has no world for — measured. */}
      <RiverRapids position={DRIFT.pad} rotation={DRIFT.yaw}
        register={{ name: 'Hollow Rapids', capacity: 6, rideDuration: 12, intensity: 5, price: 4 }}
        queue={{ anchor: DRIFT.anchor, dir: DRIFT.dir }} />

      {/* ── the three worlds: region + themed row + own ride + 3 named scenery ── */}
      <World plan={PULSE} />
      <Bazaar plan={PULSE_ROW} />
      <LaunchedFreefall position={SIM.pad} rotation={SIM.yaw}
        register={{ name: 'Pulse Launcher', capacity: 4, rideDuration: 7, intensity: 6, price: 3 }}
        queue={{ anchor: SIM.anchor, dir: SIM.dir }} />
      <NeonArch position={dry(PULSE_SC[0])} rotation={Math.PI / 2} text="PULSE" seed={3} />
      <SpeakerStack position={dry(PULSE_SC[1])} rotation={-Math.PI / 2} seed={5} />
      <MirrorBallPylon position={dry(PULSE_SC[2])} seed={7} />

      <World plan={FOUNDRY} />
      <Bazaar plan={WORKS_ROW} />
      <HauntedMansion position={MANSION.pad} rotation={MANSION.yaw}
        register={{ name: 'The Drowned Manor', capacity: 6, rideDuration: 11, intensity: 5, price: 4 }}
        queue={{ anchor: MANSION.anchor, dir: MANSION.dir }} />
      <WreckedHull position={dry(WORKS_SC[0])} seed={3} />
      <CoralCluster position={dry(WORKS_SC[1])} seed={5} />
      <AnchorPile position={dry(WORKS_SC[2])} seed={7} />

      <World plan={GLADE} />
      <Bazaar plan={GLADE_ROW} />
      <MoonlitBarge position={BARGE.pad} rotation={BARGE.yaw}
        register={{ name: 'Toadstool Barge', capacity: 4, rideDuration: 12, intensity: 2, price: 3 }}
        queue={{ anchor: BARGE.anchor, dir: BARGE.dir }} />
      <GiantToadstools position={dry(GLADE_SC[0])} seed={1} />
      <StandingStones position={dry(GLADE_SC[1])} seed={3} />
      <LanternTree position={dry(GLADE_SC[2])} seed={5} />

      <Restroom position={RESTROOM} rotation={Math.PI / 2} />

      {NEUTRAL_SCENERY.map((s, i) => (
        <Scenery key={`sc-${i}`} name={s.name} position={s.at} seed={i + 1} />
      ))}
      {TREES_DRY.map((t, i) => (
        <Placed key={`tr-${i}`} build={(three) => tree(three, { shape: t.shape })} position={t.at} />
      ))}

      <Lights from={[0, 58.8]} to={[0, 52.8]} />
      <Lights from={[22.8, 45.6]} to={[22.8, 27.6]} />
      <Lights from={[-13.2, 21.6]} to={[-13.2, -16.8]} />
      <Lights from={[9.6, 27.6]} to={[9.6, -21.6]} />
    </Park>
  );
}

export default ThemePark;

// ── OFFLINE MEASUREMENT HOOK (harness only; not part of the park) ───────────
export function __netdump() {
  const rides = [
    { name: 'Corkscrew Ascent', at: [C_START[0], C_START[2]] as XZ, registered: true, centre: FLAG_CENTRE },
    { name: 'Breakwater Flyer', at: [B_START[0], B_START[2]] as XZ, registered: true, centre: FLAG2_CENTRE },
    { name: 'Grand Circle Monorail', at: [-42.6, -9.7] as XZ, registered: true },
    { name: 'Pulse Launcher', at: SIM.pad, registered: true },
    { name: 'The Drowned Manor', at: MANSION.pad, registered: true },
    { name: 'Toadstool Barge', at: BARGE.pad, registered: true },
    { name: 'Meadowline Karts', at: MAGLEV.pad, registered: true },
    { name: 'Meadow Orbiter', at: HELI.pad, registered: true },
    { name: 'Hollow Rapids', at: DRIFT.pad, registered: true },
  ];
  const stalls = [PULSE_ROW, WORKS_ROW, GLADE_ROW].flatMap((b) =>
    (b.slots as { at: XZ }[]).map((s) => ({ at: s.at })),
  );
  const setPieces = ALL_PLANS.map((p) => ({
    kind: p.kind, id: p.id,
    bbox: { min: [p.footprint.cx - p.footprint.hx, 0, p.footprint.cz - p.footprint.hz],
            max: [p.footprint.cx + p.footprint.hx, 3, p.footprint.cz + p.footprint.hz] },
  }));
  /** the ring of cells each set-piece dresses — NOT guarded, so the composed
   *  ground under them has to be dry on its own */
  const DRESS_CELLS: XZ[] = ALL_PLANS.flatMap((p) => {
    const f = p.footprint, out: XZ[] = [];
    const LIM = SIZE / 2 - 1.0;            // the dress ring is CLAMPED to the plot
    for (let x = f.cx - f.hx - 1.2; x <= f.cx + f.hx + 1.2 + 1e-6; x += 1.2)
      for (let z = f.cz - f.hz - 1.2; z <= f.cz + f.hz + 1.2 + 1e-6; z += 1.2)
        if (Math.abs(x) <= LIM && Math.abs(z) <= LIM) out.push([+x.toFixed(2), +z.toFixed(2)]);
    return out;
  });
  return {
    seed: SEED, size: SIZE, climate: CLIMATE,
    keepDry: GUARDS, coasterPts: ALL_COASTER_PTS,
    paved: NET.keepDry,
    dressCells: DRESS_CELLS,
    hardCells: [
      ...NODES, ...RING_CELLS, ...PULSE_SC, ...WORKS_SC, ...GLADE_SC,
      ...PADS.map((p) => p.pad), ...PADS.map((p) => p.anchor),
      C_TAIL, B_TAIL, RESTROOM, ...stalls.map((s) => s.at),
      ...DRESS_CELLS,
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
    authoredNodes: NODES.length,
    authoredEdges: EDGES.length,
    circuits: { flagship: FLAG_BB, second: FLAG2_BB },
  };
}

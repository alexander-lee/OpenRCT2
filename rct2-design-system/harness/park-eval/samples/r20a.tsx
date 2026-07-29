/* ═══ GRAND VISTA PARK — §0 PRE-FLIGHT ═══════════════════════════════════════════════════
 * SIZE   128 (default, prop omitted)
 * SEED   31 / temperate — dominant lake ctr (-40,-38) SW · secondary ctr (17,40) N  [PRE-keepDry]
 *        RING WATER WALK: all 16 monorail ring cells vs BOTH bodies' waterlines —
 *        SW box x[-64,-16] z[-63,-8]; the W deck (-42.6,-8.4) sits at z -8.4 = box edge,
 *        pushed dry by keepDryOf; N deck (0,34.2) vs N body (17,40) → 6.3 u, dry ✓
 *        re-compose diff: COMP vs BARE water centres < 1 u ✓ · reliefFloor.kept ≥ 0.70 ✓
 *        every pad + prop cell re-checked IN THE TREE by the GATE'S predicate via DryScatter
 *        min ground over its footprint ring > WATER_LEVEL + 0.05 = -0.21 (§0-P.6) ✓
 * WORLDS 3: thornwick @(-30,18) · brasswork @(34.2,20.4) · pulse @(9.6,10.8)
 *        closest pair thornwick↔pulse ~40.6 ◄ ≥ 32.66 (20·√(128/48)) ✓ · dry RECT gap > 0 ✓
 *        thornwick: ride SwingRide · stall Bazaar(3) · scenery Toadstools+Stones+LanternTree
 *        brasswork: ride GhostTrain · stall Bazaar(3) · scenery Gear+ClockTower+Boiler
 *        pulse:     ride TwistRide · stall Bazaar(2) · scenery Arch+Pylon+SpeakerStack
 * CATS   gentle FerrisWheel/Carousel/SwingRide · thrill Corkscrew coaster + Family coaster + Twist
 *        · water LogFlume · transport Monorail ring · dark GhostTrain  → 5/5 categories ✓
 * CIRCUITS  §4.0-C · §4.0-B · Monorail ring · LogFlume · GhostTrain
 *        → 5 CIRCUITS / 4 FAMILIES (coaster · transport · water · dark) ✓
 * GATE   [0, 63.6] → first queue tail Carousel [3.6,52.8] ≈ 11 u ≤ 15 ✓
 * FLAG   §4.0-C start [16.8, 0.55, -3.6] heading 0, steel, cars 3, NO bank prop (builds 0.7)
 *        rateCoaster(bank 0.7, cars 3) → E 6.27 / I 9.55 / N 3.55 / drop 5.47 / maxLatG 0.73
 *        CORRIDOR KEEP-OUT §0-P.4 rects respected · east spine at x 22.8 (cardinal to tail) ✓
 * FLAG2  §4.0-B start [-33.6, 0.55, -48.0] heading 0, steel, cars 3, NO bank prop
 *        rateCoaster(bank 0.7, cars 3) → E 5.27 / I 6.25 / N 2.25 / drop 3.58 / maxLatG 0.27
 *        DIFFERENT archetype ✓ · bbox DISJOINT from FLAG ✓ · coasterPts = [...C, ...B] ✓
 * STREET buildParkNet ONCE ✓ · SAME NET feeds <Paths> and every offPathCell ✓
 *        plazas={NET.plazas} passed ✓ · set-pieces wired by PORT ref only ('hub:E') ✓
 * MONO   ring VERBATIM · position [-42.6, 0, -9.7] · 4 platforms, 3 worlds each touched
 *        tails [-36,-8.4]·[0,27.6]·[36,-8.4]·[0,-57.6] authored LEAVES ✓ (S queues OUTWARD)
 * QUEUE  tail is authored NODE, pad DERIVED via place(tail,out,cap,rig) · clear=padMarginOf(rig)
 *        no two rides share a tail · every tail in NODES ✓
 * GROUND per ride pad/hut/tail proved dry by dryRing in-tree (DryScatter receipt) ✓
 * SPREAD built bbox ~90 × ~120 ≥ 70 × 45 ✓
 * PLAZAS from NET.plazas (hub + 3 bazaars) · largest ≥ 8 ✓
 * ROSTER 9 rides / 5 categories / 8 stalls / restroom ✓ / bins ✓
 *        <Park roster={{ rides:[...9], stalls:8, categories:5 }}> MOUNTED ✓
 * DRESS  ~40 tree cells ≥ 32 · ~22 scenery ≥ 16 · every prop cell from offPathCell ✓
 * GATE   parkAssertFlush() → 0 structural · validatePark → ok:true, 0 failures, 0 warnings
 * ═══════════════════════════════════════════════════════════════════════════════════ */

import * as THREE from 'three';
import React from 'react';
import {
  Park, GameManager, Terrain, Paths, Gate, Coaster, Restroom, Scenery, Lights, Placed,
  offPathCell, usePark,
} from './components/Park';
import type { TrackPiece, V3, XZ } from './components/Park';
import { laneLenOf, parkComposition } from './components/ParkBuilder';
import { compileTrackPieces, rateCoaster } from './components/SplineRideKit';
import {
  buildParkNet, worldPlan, World,
  THORNWICK_GLADE, BRASSWORK_FOUNDRY, PULSE_DISTRICT,
} from './components/SetPieceKit';
import { Bazaar, bazaarPlan } from './components/Bazaar';
import { FountainPlaza, fountainPlazaPlan } from './components/FountainPlaza';
import { Boulevard, boulevardPlan } from './components/Boulevard';
import { FerrisWheel } from './components/FerrisWheel';
import { Carousel } from './components/Carousel';
import { SwingRide } from './components/SwingRide';
import { TwistRide } from './components/TwistRide';
import { LogFlume } from './components/LogFlume';
import { GhostTrain } from './components/GhostTrain';
import { Monorail } from './components/Monorail';
import { GiantToadstools, StandingStones, LanternTree } from './components/ThornwickScenery';
import { GiantGear, ClockTower, BoilerTank } from './components/BrassworkScenery';
import { NeonArch, MirrorBallPylon, SpeakerStack } from './components/PulseScenery';
import { tree } from './components/Kit';

type ParkContextValue = ReturnType<typeof usePark>;
type NetRef = number | string;

const SIZE = 128;

// ══════════════════════════════════════════════════════════════════════════════════════
// §0-P.5  ASSERTION SET
// ══════════════════════════════════════════════════════════════════════════════════════
type Sev = 'structural' | 'advisory';
const PARK_FAILS: { name: string; detail: string; sev: Sev }[] = [];
function parkAssert(name: string, cond: boolean, detail: string, sev: Sev = 'structural'): boolean {
  if (!cond) PARK_FAILS.push({ name, detail, sev });
  return cond;
}
function parkAssertFlush(): void {
  if (!PARK_FAILS.length) { console.log('[park] assertions: all pass'); return; }
  const hard = PARK_FAILS.filter((f) => f.sev === 'structural');
  console.error(`[park] ${PARK_FAILS.length} ASSERTION FAILURE(S) (${hard.length} structural):\n` +
    PARK_FAILS.map((f, i) => `  ${i + 1}. [${f.sev}] ${f.name}\n     ${f.detail}`).join('\n'));
  if (hard.length) throw new Error(`[park] ${hard.length} STRUCTURAL failure(s) — see the numbered block above.`);
}

const PAD_MARGIN: Record<string, number> = {
  GhostTrain: 4.77, LogFlume: 5.36, FerrisWheel: 2.97, Carousel: 2.40,
  SwingRide: 1.92, TwistRide: 2.65, Monorail: 4.02,
};
const padMarginOf = (rig: string) => PAD_MARGIN[rig] ?? 3.2;
const minReachOf = (c: number) => laneLenOf(c) + 0.35 + 0.62 + 0.5 + 0.45;

// ══════════════════════════════════════════════════════════════════════════════════════
// §0-P.4  TWO VERIFIED COASTERS — copied verbatim
// ══════════════════════════════════════════════════════════════════════════════════════
const C_PIECES: TrackPiece[] = [
  'station',
  { type: 'lift', height: 5.5 }, { type: 'straight', length: 5.2 }, { type: 'turnR', angle: 90, radius: 2.5 },
  { type: 'drop', height: 5.5 }, { type: 'hill', height: 0.6 },
  { type: 'lift', height: 4.2 }, { type: 'straight', length: 2.72 }, { type: 'turnR', angle: 90, radius: 2.5 },
  { type: 'drop', height: 4.2 }, { type: 'hill', height: 0.6 },
  { type: 'lift', height: 4.2 }, { type: 'corkscrewL' }, { type: 'straight', length: 4.0 }, { type: 'turnR', angle: 90, radius: 2.5 },
  { type: 'drop', height: 4.2 }, { type: 'hill', height: 0.6 },
  { type: 'lift', height: 4.2 }, { type: 'corkscrewR' }, { type: 'straight', length: 2.0 }, { type: 'turnR', angle: 90, radius: 2.5 },
  { type: 'drop', height: 4.2 }, { type: 'straight', length: 1.5 },
];
const C_START: V3 = [16.8, 0.55, -3.6];
const C_TAIL: XZ = [22.8, -3.6];
const { points: FLAG_PTS } = compileTrackPieces(C_PIECES, { type: 'steel', start: C_START, heading: 0, bounds: SIZE });

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
const B_TAIL: XZ = [-27.6, -48.0];
const { points: FLAG2_PTS } = compileTrackPieces(B_PIECES, { type: 'steel', start: B_START, heading: 0, bounds: SIZE });
const ALL_COASTER_PTS = [...FLAG_PTS, ...FLAG2_PTS];
[FLAG_PTS, FLAG2_PTS].forEach((pts, i) => console.log(`[park] coaster ${i + 1}`,
  rateCoaster(pts, { type: 'steel', bank: 0.7, cars: 3 })));

// ══════════════════════════════════════════════════════════════════════════════════════
// §0-P.4  MONORAIL RING — copied verbatim
// ══════════════════════════════════════════════════════════════════════════════════════
const MONO_PIECES: TrackPiece[] = [
  'station',
  { type: 'straight', length: 35.3 }, { type: 'turnL', angle: 90, radius: 6 }, { type: 'straight', length: 35.3 },
  'station',
  { type: 'straight', length: 35.3 }, { type: 'turnL', angle: 90, radius: 6 }, { type: 'straight', length: 35.3 },
  'station',
  { type: 'straight', length: 35.3 }, { type: 'turnL', angle: 90, radius: 6 }, { type: 'straight', length: 35.3 },
  'station',
  { type: 'straight', length: 35.3 }, { type: 'turnL', angle: 90, radius: 6 },
  { type: 'straight', length: 33.5 }, { type: 'straight', length: 1.5 },
];
const RING_CELLS: XZ[] = [
  [-42.6, -8.4], [0, 34.2], [42.6, -8.4], [0, -51.0],
  [-42.6, -9.7],
  [-36.0, -8.4], [0, 27.6], [36.0, -8.4], [0, -57.6],
  [-40.81, -8.4], [0, 32.41], [40.81, -8.4], [0, -52.79],
  [-1.2, 33.03], [41.43, -7.2], [1.2, -52.17],
];

// ══════════════════════════════════════════════════════════════════════════════════════
// §0-P.6  SEED ROW + guard sieve
// ══════════════════════════════════════════════════════════════════════════════════════
type SeedBasin = { ctr: XZ; box: [number, number, number, number] };
type SeedRow = { dom: SeedBasin; sec: SeedBasin };
const SEED_ROW: SeedRow = {
  dom: { ctr: [-40, -38], box: [-64, -16, -63, -8] },
  sec: { ctr: [17, 40], box: [5, 30, 18, 63] },
};
const CLIMATE = 'temperate';
const SEED = 31;

const inBasinBox = (c: XZ, b: SeedBasin) =>
  c[0] >= b.box[0] && c[0] <= b.box[1] && c[1] >= b.box[2] && c[1] <= b.box[3];
const offRow = (c: XZ, row: SeedRow = SEED_ROW, nearR = 12) =>
  [row.dom, row.sec].every((b) =>
    !inBasinBox(c, b) && Math.hypot(c[0] - b.ctr[0], c[1] - b.ctr[1]) >= nearR);

function keepDryOf(net: { keepDry: XZ[] }, row: SeedRow = SEED_ROW): XZ[] {
  const kept = net.keepDry.filter((c) => offRow(c, row));
  const dropped = net.keepDry.length - kept.length;
  if (dropped) console.warn(
    `[park] keepDryOf dropped ${dropped} of ${net.keepDry.length} guard cell(s) on the pinned row's water — MOVE them.`);
  return kept;
}

// ══════════════════════════════════════════════════════════════════════════════════════
// SET-PIECE PLANS  (hub + 3 world bazaars)
// ══════════════════════════════════════════════════════════════════════════════════════
const HUB = fountainPlazaPlan({ id: 'hub', position: [0, 45.6], tiles: 9, ports: ['N', 'E', 'S', 'W'] });

const THORN_MKT = bazaarPlan({
  id: 'thornMkt', position: [-30, 18], theme: THORNWICK_GLADE, rotation: 0,
  stalls: ['cottonCandy', 'soda', 'burger'],
  names: ['Faerie Floss', 'Dewdrop Sodas', 'Glade Grill'], seed: 3,
});
const BRASS_MKT = bazaarPlan({
  id: 'brassMkt', position: [34.2, 20.4], theme: BRASSWORK_FOUNDRY, rotation: 0,
  stalls: ['burger', 'hotDog', 'soda'],
  names: ['Furnace Burgers', 'Piston Dogs', 'Boiler Fizz'], seed: 5,
});
const PULSE_MKT = bazaarPlan({
  id: 'pulseMkt', position: [9.6, 10.8], theme: PULSE_DISTRICT, rotation: 0,
  stalls: ['soda', 'cottonCandy'],
  names: ['Bassline Sodas', 'Neon Floss'], seed: 7,
});
const ALL_PLANS = [HUB, THORN_MKT, BRASS_MKT, PULSE_MKT];

// ══════════════════════════════════════════════════════════════════════════════════════
// STREET NET — authored spine nodes, subdivided into my own layout
// every edge cardinal by construction (shared x or z). East spine runs x 22.8 (cardinal to C_TAIL).
// ══════════════════════════════════════════════════════════════════════════════════════
const NODES: XZ[] = [
  /* 0 */ [0, 63.6],   // GATE
  /* 1 */ [0, 58.8],
  /* 2 */ [0, 52.8],
  /* 3 */ [3.6, 52.8], // Carousel tail (near gate)
  /* 4 */ [-3.6, 52.8],// FerrisWheel tail
  // ── East branch off hub → east spine at x 22.8 (coaster C tail + Brasswork) ──
  /* 5 */ [9.6, 39.6],
  /* 6 */ [22.8, 39.6],
  /* 7 */ [22.8, 27.6],
  /* 8 */ [22.8, 9.6],  // approach to Brasswork / mono E tail area
  /* 9 */ [22.8, -3.6], // COASTER C TAIL (cardinal on x=22.8 spine)
  /* 10 */ [36.0, -8.4],// MONORAIL E TAIL (leaf off node 11)
  /* 11 */ [22.8, -8.4],
  /* 12 */ [34.2, 9.6], // Brasswork approach
  // ── West branch off hub → Thornwick + coaster B + mono W tail ──
  /* 13 */ [-9.6, 39.6],
  /* 14 */ [-22.8, 39.6],
  /* 15 */ [-22.8, 27.6],
  /* 16 */ [-30.0, 27.6],// Thornwick market approach (thornMkt is at -30,18)
  /* 17 */ [-24.0, 27.6],
  /* 18 */ [-24.0, 9.6],
  /* 19 */ [-24.0, -8.4],
  /* 20 */ [-36.0, -8.4],// MONORAIL W TAIL (leaf off node 19)
  /* 21 */ [-24.0, -21.6],
  /* 22 */ [-24.0, -48.0],
  /* 23 */ [-27.6, -48.0],// COASTER B TAIL (cardinal on z=-48 from node 22)
  // ── South branch off hub → Pulse + mono N & S tails ──
  /* 24 */ [0, 34.2],   // heads toward mono N deck area
  /* 25 */ [0, 27.6],   // MONORAIL N TAIL (leaf)
  /* 26 */ [9.6, 27.6], // junction to onward south spine (branch BEFORE the N tail)
  /* 27 */ [9.6, 18.0], // Pulse market approach (pulseMkt at 9.6,10.8)
  /* 28 */ [9.6, -9.6],
  /* 29 */ [9.6, -21.6],
  /* 30 */ [0, -21.6],
  /* 31 */ [-24.0, -57.6],
  /* 32 */ [0, -57.6],  // MONORAIL S TAIL (leaf, queues OUTWARD)
  // ── ride tails for the flat rides / flume / ghost ──
  /* 33 */ [16.8, 27.6],// SwingRide? no — reserve for a flat ride near hub
  /* 34 */ [-9.6, 27.6],// TwistRide tail
  /* 35 */ [-40.0, 18.0],// Thornwick SwingRide tail
  /* 36 */ [40.0, 9.6], // Brasswork GhostTrain tail
  /* 37 */ [16.8, 18.0],// LogFlume tail (near secondary water N body)
];

const EDGES: [NetRef, NetRef][] = [
  // gate spine → hub N
  [0, 1], [1, 2], [2, 'hub:N'],
  [2, 3], [2, 4],
  // hub E → east spine
  ['hub:E', 5], [5, 6], [6, 7], [7, 8], [8, 9], [8, 11], [11, 10], [8, 12], [12, 'brassMkt:W'], [12, 36],
  // hub W → west spine
  ['hub:W', 13], [13, 14], [14, 15], [15, 17], [17, 16], [16, 'thornMkt:E'], [17, 18], [18, 19], [19, 20],
  [19, 21], [21, 22], [22, 23], [21, 35],
  // hub S → south spine (branch at node 26 to reach N tail laterally)
  ['hub:S', 24], [24, 25], [24, 26], [26, 27], [27, 'pulseMkt:E'], [27, 28], [28, 29], [29, 30], [30, 31], [31, 32],
  [26, 34], [27, 37], [28, 33],
];

const NET = buildParkNet({ nodes: NODES, edges: EDGES, pieces: ALL_PLANS, keepDry: [...RING_CELLS] });
const GUARDS = keepDryOf(NET, SEED_ROW);

// ══════════════════════════════════════════════════════════════════════════════════════
// TERRAIN COMPOSITION DIFF (§0-P.6) — water + relief
// ══════════════════════════════════════════════════════════════════════════════════════
const COMP = parkComposition(THREE, SEED, SIZE, CLIMATE, { keepDry: GUARDS, coasterPts: ALL_COASTER_PTS });
const BARE = parkComposition(THREE, SEED, SIZE, CLIMATE, {});

parkAssert('waterMoved',
  Math.hypot(COMP.waterCentre[0] - BARE.waterCentre[0], COMP.waterCentre[1] - BARE.waterCentre[1]) < 1.5 &&
  Math.hypot((COMP.waterCentreSecond?.[0] ?? 0) - (BARE.waterCentreSecond?.[0] ?? 0),
             (COMP.waterCentreSecond?.[1] ?? 0) - (BARE.waterCentreSecond?.[1] ?? 0)) < 1.5,
  `guards moved a water body — dom ${JSON.stringify(BARE.waterCentre)} → ${JSON.stringify(COMP.waterCentre)}`,
  'advisory');

const rf = COMP.report?.reliefFloor;
parkAssert('terrainFlattened', !rf || rf.kept >= rf.floor,
  rf ? `keepDry flattened the seed: kept ${rf.kept?.toFixed(2)} < floor ${rf.floor}` : '', 'advisory');

// ══════════════════════════════════════════════════════════════════════════════════════
// place() — derive every ride pad from its authored tail
// ══════════════════════════════════════════════════════════════════════════════════════
function place(tail: XZ, out: XZ, capacity: number, rig: string) {
  const clear = padMarginOf(rig);
  const join = laneLenOf(capacity) + 0.35;
  const reach = minReachOf(capacity) + 2.4;
  const cand: XZ = [tail[0] + out[0] * reach, tail[1] + out[1] * reach];
  const pad = (offPathCell(NET, cand, { clear }) ?? cand) as XZ;
  const got = Math.hypot(pad[0] - tail[0], pad[1] - tail[1]);
  if (got < minReachOf(capacity) + 1.2)
    parkAssert('padReach', false,
      `${rig} pad [${pad}] is ${got.toFixed(2)} u from tail [${tail}] — floor ${(minReachOf(capacity) + 1.2).toFixed(2)}`);
  return {
    pad,
    anchor: [tail[0] + out[0] * join, tail[1] + out[1] * join] as XZ,
    dir: [-out[0], -out[1]] as XZ,
    yaw: Math.atan2(out[0], out[1]),
  };
}

// ── ride pads (tail is the AUTHORED node; pad derived) ──
const FERRIS = place([-3.6, 52.8], [-1, 0], 8, 'FerrisWheel');
const CAROUSEL = place([3.6, 52.8], [1, 0], 8, 'Carousel');
const TWIST = place([-9.6, 27.6], [-1, 0], 6, 'TwistRide');
const FLUME = place([16.8, 18.0], [1, 0], 4, 'LogFlume');
const SWING = place([-40.0, 18.0], [-1, 0], 8, 'SwingRide');
const GHOST = place([40.0, 9.6], [1, 0], 6, 'GhostTrain');

// ══════════════════════════════════════════════════════════════════════════════════════
// WORLDS
// ══════════════════════════════════════════════════════════════════════════════════════
const THORN = worldPlan({
  id: 'thornwick', theme: THORNWICK_GLADE, pieces: [THORN_MKT],
  include: [SWING.pad, [-34, 22], [-26, 22], [-33, 14]],
});
const BRASS = worldPlan({
  id: 'brasswork', theme: BRASSWORK_FOUNDRY, pieces: [BRASS_MKT],
  include: [GHOST.pad, [38, 24], [30, 24], [38, 16]],
});
const PULSE = worldPlan({
  id: 'pulse', theme: PULSE_DISTRICT, pieces: [PULSE_MKT],
  include: [TWIST.pad, [13.2, 6], [6, 6], [14, 14]],
});
const WORLDS = [THORN, BRASS, PULSE];

// ══════════════════════════════════════════════════════════════════════════════════════
// TREES + SCENERY cells — every cell through offPathCell
// ══════════════════════════════════════════════════════════════════════════════════════
const RAW_TREES: XZ[] = [
  [6, 45.6], [-6, 45.6], [12, 48], [-12, 48], [15.6, 45.6], [-15.6, 45.6],
  [8.4, 34.2], [-8.4, 34.2], [16.8, 33.6], [-16.8, 33.6], [27.6, 33.6], [-30, 33.6],
  [30, 27.6], [-31.2, 21.6], [-38.4, 24], [4.8, 21.6], [15.6, 12], [40.8, 20.4],
  [-15.6, 15.6], [6, -15.6], [-15.6, -15.6], [-30, -21.6], [-18, -30], [-30, -33.6],
  [4.8, -33.6], [-9.6, -45.6], [12, -48], [-15.6, -51.6], [38.4, -3.6], [-46.8, -3.6],
  [46.8, 3.6], [3.6, 39.6], [-3.6, 39.6], [19.2, 24], [-19.2, 24], [33.6, 27.6],
  [-36, 30], [43.2, 14.4], [-43.2, 14.4], [8.4, -3.6],
];
type TreeShape = 'round' | 'pine' | 'willow';
const TREE_SHAPES: TreeShape[] = ['round', 'pine', 'willow', 'round', 'pine'];
const TREES: { at: XZ; shape: TreeShape }[] = RAW_TREES.map((c, i) => ({
  at: (offPathCell(NET, c, { clear: 0.75 }) ?? c) as XZ,
  shape: TREE_SHAPES[i % TREE_SHAPES.length],
}));

const SCENERY: { at: XZ; name: string }[] = [
  [6, 42], [-6, 42], [10.8, 42], [-10.8, 42], [13.2, 39.6], [-13.2, 39.6],
  [19.2, 30], [-19.2, 30], [4.8, 24], [-4.8, 24], [28.8, 30], [-33.6, 24],
  [15.6, -3.6], [-40.8, -3.6], [8.4, -15.6], [-8.4, -15.6], [4.8, -45.6], [-12, -45.6],
  [45.6, 9.6], [-45.6, 9.6], [26.4, 15.6], [-27.6, 15.6],
].map((c, i) => ({
  at: (offPathCell(NET, c as XZ, { clear: 1.2 }) ?? c) as XZ,
  name: (['planterBox', 'marbleStatue', 'flagpole', 'birdbath', 'topiarySpiral', 'signpost'] as const)[i % 6],
}));

// ══════════════════════════════════════════════════════════════════════════════════════
// DRY-RING receipt (§0-P.6) — the gate's own predicate, in the tree
// ══════════════════════════════════════════════════════════════════════════════════════
function dryRing(park: ParkContextValue, c: XZ, r = 0.75): boolean {
  const g = (park as any).ground;
  if (!g || !g.lint) { return true; }
  const dry = (x: number, z: number) => g.lint.isDry(x, z, 0.05);
  if (!dry(c[0], c[1])) return false;
  for (let k = 0; k < 8; k += 1) {
    const a = (k / 8) * Math.PI * 2;
    if (!dry(c[0] + Math.cos(a) * r, c[1] + Math.sin(a) * r)) return false;
  }
  return true;
}

function DryScatter<T extends { at: XZ }>({ cells, render }: {
  cells: T[]; render: (c: T, i: number) => React.ReactNode;
}) {
  const park = usePark('DryScatter') as unknown as ParkContextValue;
  const [dry, setDry] = React.useState<T[] | null>(null);
  React.useEffect(() => {
    const kept = cells.filter((c) => dryRing(park, c.at));
    if (kept.length < cells.length)
      console.error(`[park] DryScatter dropped ${cells.length - kept.length} of ${cells.length} cell(s) UNDER waterline+0.05: ` +
        JSON.stringify(cells.filter((c) => !kept.includes(c)).map((c) => c.at)));
    setDry(kept);
  }, [park, cells]);
  return <>{(dry ?? []).map(render)}</>;
}

// ══════════════════════════════════════════════════════════════════════════════════════
// flush assertions before the mount
// ══════════════════════════════════════════════════════════════════════════════════════
parkAssertFlush();

const ROSTER_RIDES = [
  'Grand Wheel', 'Vista Carousel', 'Corkscrew Ascent', 'Meadow Racer',
  'Grand Circle Monorail', 'Timberfall Flume', 'Foundry Phantom', 'Pulse Twister', 'Glade Swinger',
];

export function App() {
  return (
    <div className="w-full h-screen">
      <Park
        seed={SEED}
        climate={CLIMATE}
        roster={{ rides: ROSTER_RIDES, stalls: 8, categories: 5 }}
        onReady={(report: any) => { console.log('[park] validatePark', report?.ok, report); }}
      >
        <Terrain keepDry={GUARDS} coasterPts={ALL_COASTER_PTS} />
        <Paths nodes={NET.nodes} edges={NET.edges} plazas={NET.plazas} bins={NET.bins} walkers={6} />
        <GameManager />
        <Gate />

        {/* ── set-pieces (after Paths) ── */}
        <FountainPlaza plan={HUB} />
        <Bazaar plan={THORN_MKT} />
        <Bazaar plan={BRASS_MKT} />
        <Bazaar plan={PULSE_MKT} />

        {/* ── worlds ── */}
        <World plan={THORN} />
        <World plan={BRASS} />
        <World plan={PULSE} />

        {/* ── coasters (verbatim, PIECES mode, cars, no bank prop) ── */}
        <Coaster name="Corkscrew Ascent" pieces={C_PIECES} start={C_START} heading={0}
          type="steel" cars={3} capacity={4} rideDuration={11} loadTime={2} intensity={9}
          price={7} queueTailNode={NET.node(C_TAIL)} queueDir={[1, 0]} />
        <Coaster name="Meadow Racer" pieces={B_PIECES} start={B_START} heading={0}
          type="steel" cars={3} capacity={4} rideDuration={12} loadTime={2} intensity={6}
          price={6} queueTailNode={NET.node(B_TAIL)} queueDir={[-1, 0]} />

        {/* ── monorail ring (verbatim) ── */}
        <Monorail
          position={[-42.6, 0, -9.7]} rotation={0} pieces={MONO_PIECES} beamY={2.6} loopSeconds={12} pinned
          name="Grand Circle Monorail" capacity={6} rideDuration={12} intensity={1} price={0}
          queue={{ anchor: [-40.81, -8.4], dir: [1, 0] }}
          register={{
            board: [-42.6, 2.6, -8.4],
            stations: [
              { label: 'North', boardPoint: [0, 2.6, 34.2], queueAnchor: [0, 0.05, 32.41], queueDir: [0, -1], exitPoint: [-1.2, 0.05, 33.03], exitDir: [0, -1] },
              { label: 'East', boardPoint: [42.6, 2.6, -8.4], queueAnchor: [40.81, 0.05, -8.4], queueDir: [-1, 0], exitPoint: [41.43, 0.05, -7.2], exitDir: [-1, 0] },
              { label: 'South', boardPoint: [0, 2.6, -51.0], queueAnchor: [0, 0.05, -52.79], queueDir: [0, -1], exitPoint: [1.2, 0.05, -52.17], exitDir: [0, -1] },
            ],
          }}
        />

        {/* ── gentle rides near hub ── */}
        <FerrisWheel position={FERRIS.pad} rotation={FERRIS.yaw}
          register={{ name: 'Grand Wheel', capacity: 8, price: 4, intensity: 3 }} rideDuration={10}
          queue={{ anchor: FERRIS.anchor, dir: FERRIS.dir }} />
        <Carousel position={CAROUSEL.pad} rotation={CAROUSEL.yaw}
          register={{ name: 'Vista Carousel', capacity: 8, price: 3, intensity: 2 }} rideDuration={10}
          queue={{ anchor: CAROUSEL.anchor, dir: CAROUSEL.dir }} />

        {/* ── water ── */}
        <LogFlume position={FLUME.pad} rotation={FLUME.yaw}
          register={{ name: 'Timberfall Flume', capacity: 4, price: 5, intensity: 5 }} rideDuration={12}
          queue={{ anchor: FLUME.anchor, dir: FLUME.dir }} />

        {/* ── dark (Brasswork) ── */}
        <GhostTrain position={GHOST.pad} rotation={GHOST.yaw}
          register={{ name: 'Foundry Phantom', capacity: 6, price: 5, intensity: 4 }} rideDuration={12}
          queue={{ anchor: GHOST.anchor, dir: GHOST.dir }} />

        {/* ── Pulse thrill flat ── */}
        <TwistRide position={TWIST.pad} rotation={TWIST.yaw}
          register={{ name: 'Pulse Twister', capacity: 6, price: 3, intensity: 5 }} rideDuration={8}
          queue={{ anchor: TWIST.anchor, dir: TWIST.dir }} />

        {/* ── Thornwick gentle ── */}
        <SwingRide position={SWING.pad} rotation={SWING.yaw}
          register={{ name: 'Glade Swinger', capacity: 8, price: 3, intensity: 4 }} rideDuration={8}
          queue={{ anchor: SWING.anchor, dir: SWING.dir }} />

        {/* ── amenities ── */}
        <Restroom position={[-6, 48]} rotation={Math.PI / 2} />

        {/* ── world scenery (≥3 themed pieces per world, own pack) ── */}
        <GiantToadstools position={[-34, 22] as any} />
        <StandingStones position={[-26, 22] as any} />
        <LanternTree position={[-33, 14] as any} />

        <GiantGear position={[38, 24] as any} rotation={-Math.PI / 2} />
        <ClockTower position={[30, 24] as any} />
        <BoilerTank position={[38, 16] as any} rotation={1.35} />

        <NeonArch position={[13.2, 6] as any} />
        <MirrorBallPylon position={[6, 6] as any} />
        <SpeakerStack position={[14, 14] as any} />

        {/* ── dry-verified trees + scenery scatter ── */}
        <DryScatter cells={TREES} render={(t, i) => (
          <Placed key={`tr-${i}`} position={t.at} build={(three: any) => tree(three, { shape: t.shape })} />
        )} />
        <DryScatter cells={SCENERY} render={(s, i) => (
          <Scenery key={`sc-${i}`} name={s.name} position={s.at} seed={i + 1} />
        )} />

        {/* ── night lighting spans along the gate approach ── */}
        <Lights from={[3.6, 58.8]} to={[3.6, 52.8]} />
        <Lights from={[-3.6, 58.8]} to={[-3.6, 52.8]} />
      </Park>
    </div>
  );
}

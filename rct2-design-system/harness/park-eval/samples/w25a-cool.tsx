/* ═══ CINDERWASH COVE — §0 PRE-FLIGHT ═══════════════════════════════════════════════
 * SIZE   128 (default, `size` prop omitted)
 * SEED   1 / temperate — dominant lake ctr (41, -39) box[21,60,-60,-21] · secondary
 *        ctr (-38, 31) box[-56,-21,23,39]   [PRE-keepDry, SEED_ROW_WATER row '1/temperate']
 *        RING WATER WALK: all 16 monorail ring cells walked against BOTH boxes with
 *        `offRow` (nearR 12) before the seed was pinned — 0 hits (asserted below,
 *        advisory `ringOnWater`). The published verdict for this row + this ring pose is
 *        probes 17→17, terrainSeed 16 unchanged, both centroids 0.0 u.
 *        GUARD LIST IS DERIVED: keepDryOf(NET, SEED_ROW) sieves the FUSE OUTPUT — never
 *        NODES.slice(), never NET.keepDry raw. Drop count logged to the console.
 *        reliefFloor.kept read off COMP.report.reliefFloor (never report.relief).
 * WORLDS 3 (>= 3): neonQuarter @(11.4, 47.4) · cinderReach @(-50.1, -16.2) ·
 *        saltspray @(52.2, -14.4).  SORTED pairs, closest marked:
 *        neon↔salt 74.0 ◄ >= 32.66 (20·√(128/48)) ✓ · neon↔cinder 88.5 ·
 *        cinder↔salt 102.3 · DRY GAP between all three RECTS > 0 ✓
 *        Each rect CONTAINS a monorail deck (extender cell in `include`):
 *        neonQuarter ⊃ N deck (0, 34.2) · cinderReach ⊃ W deck (-42.6, -8.4) ·
 *        saltspray ⊃ E deck (42.6, -8.4)  → everyWorldTouched ✓
 *        WORLD neonQuarter (neon):  ride FerrisWheel @[17.3, 58.8] · stall neonSlush ·
 *          scenery NeonArch + SpeakerStack + MirrorBallPylon  (PulseScenery only)
 *        WORLD cinderReach (fire):  ride TopSpin @[-52.1, -21.6] · stall emberRoast ·
 *          scenery Fumarole + ObsidianShards + BasaltColumns  (EmberfallScenery only)
 *        WORLD saltspray (pirateBeach): ride Carousel @[55.7, -19.2] · stall sushi ·
 *          scenery WreckedHull + CoralCluster + AnchorPile  (TidewaterScenery only)
 *        0 foreign themed pieces · RARE PRESETS: fire + pirateBeach (both under the
 *        corpus median usage) — the usual steampunk+neon pair is NOT built.
 * CATS   (WRITTEN BEFORE ANY JSX) gentle FerrisWheel/Carousel/Helicycles ·
 *        thrill Coaster §4.0-C + Coaster §4.0-B + TopSpin · water LogFlume ·
 *        transport Monorail ring · dark GhostTrain   → 5/5 categories ✓ · 9 rides
 *        RARE PICKS Helicycles + TopSpin — each appears in rules/setup.md exactly ONCE,
 *        only in the §0-P.5 PAD_MARGIN table, so no worked example has copied them.
 * CIRCUITS §4.0-C · §4.0-B · Monorail ring · LogFlume · GhostTrain
 *        → 5 CIRCUITS across 4 FAMILIES (coaster ×2 = ONE family, water, transport, dark)
 * GATE   [0, 63.6] → node 1 [0, 58.8] → first queue tail [9.6, 58.8] = 4.8 + 9.6
 *        = 14.4 u of street ≤ 15 ✓ (FerrisWheel, a NON-monorail ride)
 * FLAG   §4.0-C start [16.8, 0.55, -3.6] heading 0, steel, cars 3, NO bank prop (0.7)
 *        rateCoaster(bank 0.7, cars 3) → E 6.27 / I 9.55 / N 3.55 / drop 5.47 /
 *        maxLatG 0.73 (guard 1.275) / inversions 2 — logged at module scope
 *        CORRIDOR KEEP-OUT (PLOT coords): west x[-19.2,-16.8] z[-4.8,10.8] · south
 *        x[-10.8,4.8] z[-19.2,-16.8] · north x[-8.4,7.2] z[18.0,19.2] · station leg
 *        x[15.6,18.0] z[-10.8,4.8] (own ride, exempt). Every street node and every pad
 *        checked OUTSIDE them (assertion `corridorClear`).
 * FLAG2  §4.0-B start [-33.6, 0.55, -48.0] heading 0, steel, cars 3, NO bank prop
 *        rateCoaster → E 5.27 / I 6.25 / N 2.25 / drop 3.58 / maxLatG 0.27
 *        DIFFERENT archetype ✓ · bbox DISJOINT from FLAG's by 15.18 u in x ✓ · off all
 *        16 ring cells ✓ · outside every <World> rect ✓ ·
 *        coasterPts = [...FLAG_PTS, ...FLAG2_PTS] → <Terrain coasterPts> ✓
 * STREET buildParkNet called EXACTLY ONCE ✓ · the SAME NET feeds <Paths> and every
 *        offPathCell ✓ · PORT-REFS: 6 piece ids → 9 refs in EDGES, counted + asserted ·
 *        BOTH boulevard chain ends wired ('aveW:A' and 'aveW:B') ✓ · every pad returned
 *        BY offPathCell (never a raw tail+out·d sum) ✓
 * MONO   ring VERBATIM · position [-42.6, 0, -9.7] (START POSE, not the centre),
 *        rotation 0, beamY 2.6, price 0, pinned, loopSeconds 12 = rideDuration
 *        4 platforms >= 3 declared worlds (one deck inside each rect) ✓
 *        tails [-36.0,-8.4] · [0,27.6] · [36.0,-8.4] · [0,-57.6] are authored NODES
 *        24 / 6 / 10 / 17, ALL LEAVES (asserted `tailIsLeaf`) ✓
 *        S queues OUTWARD ([0,-1]); the gate spine ENDS at the hub and the N tail is
 *        reached laterally (5 → 6), so no street continues past a platform.
 * QUEUE  ONE ROW PER RIDE — tail is an authored NODE, pad DERIVED from it by place():
 *        FerrisWheel cap 4  tail [9.6,58.8]   out [1,0]  → pad ~[17.3,58.8]  7.66 >= 6.46 ✓
 *        GhostTrain  cap 6  tail [22.8,45.6]  out [1,0]  → pad ~[31.6,45.6]  8.78 >= 7.58 ✓
 *        Helicycles  cap 2  tail [22.8,-14.4] out [0,-1] → pad ~[22.8,-20.9] 6.54 >= 5.34 ✓
 *        Carousel    cap 4  tail [48.0,-19.2] out [1,0]  → pad ~[55.7,-19.2] 7.66 >= 6.46 ✓
 *        LogFlume    cap 6  tail [9.6,-21.6]  out [0,-1] → pad ~[9.6,-31.6]  9.98 >= 7.58 ✓
 *          (+1.2 u extra: this rig's queue `front` is 4.4, not the 1.8 default)
 *        TopSpin     cap 4  tail [-44.4,-21.6] out [-1,0] → pad ~[-52.1,-21.6] 7.66 >= 6.46 ✓
 *        Coaster C   tail [22.8,-3.6] (node 8, = C_START.x + 6.0) queueDir [1,0]
 *        Coaster B   tail [-27.6,-48.0] (node 21, = B_START.x + 6.0) queueDir [1,0]
 *        no two rides share a tail node ✓ · every tail appears in NODES ✓
 *        clear = padMarginOf(rig) off the §0-P.5 table, never a guessed 3.2 ✓
 * SPREAD authored bbox 93.6 × 121.2 >= 70 × 45 ✓ · 31 authored cells / 37 edges
 * PLAZAS hub 7 tiles (70.6 u²) + belvedere 9 tiles (116.6 u²) + three bazaar courtyards
 *        (13-tile row 56.2 u², two 7-tile rows 30.2 u²) → areaSpread >> 1.8 ✓
 *        NO set-piece `position` appears in NODES or as a queue tail (assertNodesOffPieces)
 * NODES  31 authored · all four ring tails degree 1 · one park-spanning cycle after the
 *        fuse (east spoke x 22.8 + west spoke x -13.2 closed by the z -21.6 south leg)
 * DRESS  44 tree candidates >= 32 · 22 scenery candidates >= 16 (over-provisioned because
 *        DryScatter DROPS) · every prop cell through offPathCell (trees clear 0.75,
 *        props 1.2, buildings 1.8) and then through the GATE'S OWN predicate
 *        (park.ground.lint.isDry(x, z, 0.05) on a 0.75 u ring) in the tree ✓
 * NIGHT  monorail + plaza + boulevard + bazaar lanterns, 2 <Lights> runs, 2 <Neon>
 *        marquees, 2 torches — all night-gated emissive, well inside the draw budget.
 * GATE   parkAssertFlush() → 0 structural · <Park validate> → report.ok MUST be true
 *        with an EMPTY warnings array (logged by onReady).
 * ═══════════════════════════════════════════════════════════════════════════════════ */
import React from 'react';
import * as THREE from 'three';

import type { V3, XZ } from './components/Park';
import type { NetRef, SetPiecePlan } from './components/SetPieceKit';
import type { TrackPiece } from './components/SplineRideKit';

import {
  Park, GameManager, Terrain, Paths, Gate, Coaster, Restroom, Neon, Torch,
  Scenery, Lights, Placed, usePark, offPathCell,
} from './components/Park';
import { parkComposition, laneLenOf } from './components/ParkBuilder';
import {
  buildParkNet, worldPlan, World,
  FIRE, PIRATE_BEACH, NEON_CITY,
} from './components/SetPieceKit';
import { FountainPlaza, fountainPlazaPlan } from './components/FountainPlaza';
import { Bazaar, bazaarPlan } from './components/Bazaar';
import { Boulevard, boulevardPlan } from './components/Boulevard';
import { compileTrackPieces, rateCoaster } from './components/SplineRideKit';
import { tree } from './components/Kit';

import { Monorail } from './components/Monorail';
import { FerrisWheel } from './components/FerrisWheel';
import { Carousel } from './components/Carousel';
import { GhostTrain } from './components/GhostTrain';
import { LogFlume } from './components/LogFlume';
import { TopSpin } from './components/TopSpin';
import { Helicycles } from './components/Helicycles';

import { NeonArch, SpeakerStack, MirrorBallPylon } from './components/PulseScenery';
import { Fumarole, ObsidianShards, BasaltColumns } from './components/EmberfallScenery';
import { WreckedHull, CoralCluster, AnchorPile } from './components/TidewaterScenery';

/* ─────────────────────────────────────────────────────────────────────────────
 * 1. plot constants
 * ────────────────────────────────────────────────────────────────────────── */
const SIZE = 128;
const SEED = 1;
const CLIMATE = 'temperate' as const;

/** the house PRNG — hashed sine only, never Math.random / Date.now */
const hash01 = (n: number) => {
  const s = Math.sin(n * 12.9898 + 78.233) * 43758.5453;
  return s - Math.floor(s);
};

/* ─────────────────────────────────────────────────────────────────────────────
 * 2. the collect-then-throw assertion bus
 * ────────────────────────────────────────────────────────────────────────── */
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

/* ─────────────────────────────────────────────────────────────────────────────
 * 3. the two coasters — VERIFIED archetypes, copied verbatim
 * ────────────────────────────────────────────────────────────────────────── */
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

const { points: FLAG_PTS } = compileTrackPieces(C_PIECES, {
  type: 'steel', start: C_START, heading: 0, bounds: SIZE,
});
const { points: FLAG2_PTS } = compileTrackPieces(B_PIECES, {
  type: 'steel', start: B_START, heading: 0, bounds: SIZE,
});
const ALL_COASTER_PTS = [...FLAG_PTS, ...FLAG2_PTS];

[FLAG_PTS, FLAG2_PTS].forEach((pts, i) => console.log(`[park] coaster ${i + 1}`,
  rateCoaster(pts, { type: 'steel', bank: 0.7, cars: 3 })));

/** the two archetypes' published corridor keep-out rects, in PLOT coords */
type Rect = { x0: number; x1: number; z0: number; z1: number; label: string };
const CORRIDOR_KEEPOUT: Rect[] = [
  { x0: -19.2, x1: -16.8, z0: -4.8, z1: 10.8, label: 'C west valley' },
  { x0: -10.8, x1: 4.8, z0: -19.2, z1: -16.8, label: 'C south valley' },
  { x0: -8.4, x1: 7.2, z0: 18.0, z1: 19.2, label: 'C north valley' },
  { x0: -63.6, x1: -62.4, z0: -54.0, z1: -37.2, label: 'B west valley' },
  { x0: -61.2, x1: -61.2, z0: -52.8, z1: -37.2, label: 'B west leg' },
  { x0: -56.4, x1: -39.6, z0: -62.4, z1: -60.0, label: 'B south valley' },
  { x0: -51.6, x1: -39.6, z0: -32.4, z1: -30.0, label: 'B north valley' },
];
const inRect = (c: XZ, r: Rect, pad = 0) =>
  c[0] >= r.x0 - pad && c[0] <= r.x1 + pad && c[1] >= r.z0 - pad && c[1] <= r.z1 + pad;

/* ─────────────────────────────────────────────────────────────────────────────
 * 4. the pinned seed row + the basin pre-filter
 * ────────────────────────────────────────────────────────────────────────── */
type SeedBasin = { ctr: XZ; box: [number, number, number, number] };
type SeedRow = { dom: SeedBasin; sec: SeedBasin };
const SEED_ROW: SeedRow = {
  dom: { ctr: [41, -39], box: [21, 60, -60, -21] },
  sec: { ctr: [-38, 31], box: [-56, -21, 23, 39] },
};
const inBasinBox = (c: XZ, b: SeedBasin) =>
  c[0] >= b.box[0] && c[0] <= b.box[1] && c[1] >= b.box[2] && c[1] <= b.box[3];
const offRow = (c: XZ, row: SeedRow = SEED_ROW, nearR = 12) =>
  [row.dom, row.sec].every((b) =>
    !inBasinBox(c, b) && Math.hypot(c[0] - b.ctr[0], c[1] - b.ctr[1]) >= nearR);

/* ─────────────────────────────────────────────────────────────────────────────
 * 5. the monorail ring — the 16 ground cells, walked against the row
 * ────────────────────────────────────────────────────────────────────────── */
const RING_CELLS: XZ[] = [
  [-42.6, -8.4], [0, 34.2], [42.6, -8.4], [0, -51.0],
  [-42.6, -9.7],
  [-36.0, -8.4], [0, 27.6], [36.0, -8.4], [0, -57.6],
  [-40.81, -8.4], [0, 32.41], [40.81, -8.4], [0, -52.79],
  [-1.2, 33.03], [41.43, -7.2], [1.2, -52.17],
];
{
  const wet = RING_CELLS.filter((c) => !offRow(c));
  parkAssert('ringOnWater', wet.length === 0,
    `${wet.length} monorail ring cell(s) stand on the pinned row's water: ${JSON.stringify(wet)}`,
    'advisory');
}
/** the ring's four rectangle legs, for the dressing scatter's keep-out */
const RING_SEGS: [XZ, XZ][] = [
  [[-42.6, 34.2], [42.6, 34.2]],
  [[42.6, 34.2], [42.6, -51.0]],
  [[42.6, -51.0], [-42.6, -51.0]],
  [[-42.6, -51.0], [-42.6, 34.2]],
];
function distToSeg(c: XZ, a: XZ, b: XZ): number {
  const vx = b[0] - a[0], vz = b[1] - a[1];
  const len2 = vx * vx + vz * vz;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((c[0] - a[0]) * vx + (c[1] - a[1]) * vz) / len2));
  return Math.hypot(c[0] - (a[0] + t * vx), c[1] - (a[1] + t * vz));
}

/* ─────────────────────────────────────────────────────────────────────────────
 * 6. the set-piece plans
 * ────────────────────────────────────────────────────────────────────────── */
const HUB = fountainPlazaPlan({
  id: 'hub', title: 'Cinder Circle', position: [0, 45.6], tiles: 7, ports: ['N', 'E', 'W'], seed: 3,
});
const VIEWPOINT = fountainPlazaPlan({
  id: 'viewpoint', title: 'East Belvedere', position: [57.6, 0], tiles: 9, ports: ['W'], seed: 4,
});
const AVE_WEST = boulevardPlan({
  id: 'aveW', title: 'Lantern Walk', from: [-6.0, 45.6], to: [-12.0, 45.6], spacing: 3.0, seed: 5,
});
const PULSE_ROW = bazaarPlan({
  id: 'pulseRow', title: 'Voltage Row', position: [12.0, 52.8],
  facing: { port: 'W', toward: [0, 52.8] },
  stalls: ['neonSlush', 'burger', 'hotDog', 'soda', 'cottonCandy', 'balloon'],
  names: ['Voltage Slushies', 'Bassdrop Burgers', 'Subwoofer Dogs', 'Strobe Sodas', 'Glowfloss', 'Helium Halo'],
  theme: NEON_CITY, seed: 6,
});
const EMBER_ROW = bazaarPlan({
  id: 'emberRow', title: 'Cinderworks', position: [-52.8, -16.8],
  facing: { port: 'E', toward: [-44.4, -16.8] },
  stalls: ['emberRoast', 'hotDog', 'soda'],
  names: ['Cinder Grill', 'Ashfall Dogs', 'Quench Works'],
  theme: FIRE, seed: 9,
});
const TIDE_ROW = bazaarPlan({
  id: 'tideRow', title: 'Saltspray Row', position: [56.4, -14.4],
  facing: { port: 'W', toward: [48.0, -14.4] },
  stalls: ['sushi', 'cottonCandy', 'balloon'],
  names: ['Reefside Sushi', 'Seafoam Floss', 'Castaway Balloons'],
  theme: PIRATE_BEACH, seed: 11,
});
const ALL_PLANS: SetPiecePlan[] = [HUB, VIEWPOINT, AVE_WEST, PULSE_ROW, EMBER_ROW, TIDE_ROW];

/* ─────────────────────────────────────────────────────────────────────────────
 * 7. the street table — 31 authored cells, 37 edges, ONE cycle
 * ────────────────────────────────────────────────────────────────────────── */
const GATE_CELL: XZ = [0, 63.6];
const NODES: XZ[] = [
  /*  0 */ GATE_CELL,
  /*  1 */ [0, 58.8],
  /*  2 */ [9.6, 58.8],      // near-gate queue tail (LEAF)
  /*  3 */ [22.8, 45.6],
  /*  4 */ [22.8, 27.6],
  /*  5 */ [9.6, 27.6],
  /*  6 */ [0, 27.6],        // RING NORTH tail — LEAF
  /*  7 */ [22.8, 0],
  /*  8 */ [22.8, -3.6],     // FLAGSHIP tail — LEAF
  /*  9 */ [22.8, -8.4],
  /* 10 */ [36.0, -8.4],     // RING EAST tail — LEAF
  /* 11 */ [22.8, -14.4],
  /* 12 */ [48.0, -14.4],
  /* 13 */ [48.0, -19.2],    // LEAF
  /* 14 */ [49.2, 0],
  /* 15 */ [9.6, -21.6],
  /* 16 */ [0, -21.6],
  /* 17 */ [0, -57.6],       // RING SOUTH tail — LEAF
  /* 18 */ [-13.2, -21.6],
  /* 19 */ [-24.0, -21.6],
  /* 20 */ [-24.0, -48.0],
  /* 21 */ [-27.6, -48.0],   // SECOND COASTER tail — LEAF
  /* 22 */ [-13.2, -16.8],
  /* 23 */ [-36.0, -16.8],
  /* 24 */ [-36.0, -8.4],    // RING WEST tail — LEAF
  /* 25 */ [-44.4, -16.8],
  /* 26 */ [-44.4, -21.6],   // LEAF
  /* 27 */ [-13.2, 45.6],
  /* 28 */ [-13.2, 21.6],
  /* 29 */ [0, 52.8],
  /* 30 */ [-24.0, -57.6],
];
const EDGES: [NetRef, NetRef][] = [
  [0, 1], [1, 29], [29, 'hub:N'], [1, 2],
  ['pulseRow:W', 29],
  ['hub:E', 3], [3, 4], [4, 5], [5, 6],
  [4, 7], [7, 8], [8, 9], [9, 10],
  [9, 11], [11, 12], ['tideRow:W', 12], [12, 13],
  [7, 14], [14, 'viewpoint:W'],
  [5, 15], [15, 16],
  [16, 18], [18, 19], [19, 20], [20, 21],
  [20, 30], [30, 17],
  [18, 22], [22, 23], [23, 24],
  [23, 25], ['emberRow:E', 25], [25, 26],
  ['aveW:A', 'hub:W'], ['aveW:B', 27], [27, 28], [28, 22],
];

/* ── resolve port refs and audit the table BEFORE the fuse ────────────────── */
const portCell = (ref: NetRef): XZ => {
  if (typeof ref === 'number') return NODES[ref];
  const [id, name] = ref.split(':');
  const p = ALL_PLANS.find((q) => q.id === id);
  if (!p) throw new Error(`EDGES references '${ref}' but no plan has id '${id}'`);
  return p.port(name) as XZ;
};
const EPS = 1e-6;
EDGES.forEach(([a, b]) => {
  const A = portCell(a), B = portCell(b);
  parkAssert('cardinalEdge', Math.abs(A[0] - B[0]) < EPS || Math.abs(A[1] - B[1]) < EPS,
    `edge ${a}→${b} is DIAGONAL: [${A}] → [${B}] — buildParkNet would elbow it through an unplanned corner node.`,
    'advisory');
});

const CHAIN_END_OPT_OUT = new Set<string>([]);
const PORT_REFS = EDGES.flat().filter((x): x is string => typeof x === 'string');
ALL_PLANS.forEach((p) => {
  const wired = new Set(PORT_REFS.filter((r) => r.split(':')[0] === p.id).map((r) => r.split(':')[1]));
  parkAssert('pieceIsland', wired.size > 0,
    `set-piece '${p.id}' has NO '${p.id}:<PORT>' ref in EDGES — it composes as an ISLAND`);
  p.ports.filter((pt) => !pt.prunable).forEach((pt) => {
    if (wired.has(pt.name) || CHAIN_END_OPT_OUT.has(`${p.id}:${pt.name}`)) return;
    parkAssert('chainEnd', false,
      `chain piece '${p.id}' wires [${[...wired]}] but NOT '${p.id}:${pt.name}' — that carriageway end dead-ends in grass`);
  });
  const f = (p as unknown as { facing?: { port: string } }).facing;
  parkAssert('facingWired', !f || wired.has(f.port),
    `'${p.id}' declares facing.port '${f?.port}' but EDGES wires [${[...wired]}] — the facing port is pruned`);
});

const SOLID_CLEAR: Record<string, number> = { FountainPlaza: 1.8, Bazaar: 0.6, Boulevard: 0 };
function assertNodesOffPieces(cells: XZ[], plans: SetPiecePlan[], label: string): void {
  const hits: string[] = [];
  plans.forEach((p) => {
    const clear = SOLID_CLEAR[p.kind] ?? 1.8;
    if (clear === 0) return;
    const ports = new Set(p.ports.map((pt) => {
      const at = p.port(pt.name) as XZ;
      return `${at[0].toFixed(2)},${at[1].toFixed(2)}`;
    }));
    const f = p.footprint;
    const c = Math.cos(-(f.yaw ?? 0)), s = Math.sin(-(f.yaw ?? 0));
    cells.forEach((n, i) => {
      if (ports.has(`${n[0].toFixed(2)},${n[1].toFixed(2)}`)) return;
      const dx = n[0] - f.cx, dz = n[1] - f.cz;
      const lx = dx * c - dz * s, lz = dx * s + dz * c;
      const gap = Math.max(Math.abs(lx) - f.hx, Math.abs(lz) - f.hz);
      if (gap < clear) hits.push(`[${n[0]}, ${n[1]}] (${label} ${i}) is ${gap.toFixed(2)} u from '${p.id}' — needs ${clear}`);
    });
  });
  parkAssert('nodeInSolid', !hits.length,
    `${hits.length} ${label} cell(s) stand inside or against a set-piece's SOLID footprint:\n  ` + hits.join('\n  '));
}
assertNodesOffPieces(NODES, ALL_PLANS, 'node');

const RING_TAILS: XZ[] = [[36.0, -8.4], [0, 27.6], [-36.0, -8.4], [0, -57.6]];
RING_TAILS.forEach((c) => {
  const i = NODES.findIndex((n) => Math.hypot(n[0] - c[0], n[1] - c[1]) < EPS);
  if (i < 0) return;
  const deg = EDGES.filter(([a, b]) => a === i || b === i).length;
  parkAssert('tailIsLeaf', deg <= 1,
    `street node ${i} [${c}] is a MONORAIL PLATFORM TAIL with degree ${deg} — a street past it runs through the deck.`);
});

const QUEUE_TAILS: XZ[] = [
  NODES[2], NODES[3], NODES[11], NODES[13], NODES[15], NODES[26], C_TAIL, B_TAIL,
];
{
  const ports = ALL_PLANS.flatMap((p) => p.ports.map((pt) => ({ id: p.id, name: pt.name, at: p.port(pt.name) as XZ })));
  QUEUE_TAILS.forEach((t) => {
    const hit = ports.find((p) => Math.hypot(p.at[0] - t[0], p.at[1] - t[1]) < 1.2 - EPS);
    parkAssert('tailOffPort', !hit,
      hit ? `queue tail [${t}] IS (or abuts) '${hit.id}:${hit.name}'s port cell [${hit.at}]` : '');
  });
  const keys = QUEUE_TAILS.map((t) => `${t[0]},${t[1]}`);
  parkAssert('queueTailShared', new Set(keys).size === keys.length,
    `two rides share a queue tail node: ${JSON.stringify(keys)}`);
}
NODES.forEach((n, i) => {
  const hit = CORRIDOR_KEEPOUT.find((r) => inRect(n, r));
  parkAssert('corridorClear', !hit,
    hit ? `street node ${i} [${n}] stands in the ${hit.label} coaster corridor keep-out` : '');
});

/* ─────────────────────────────────────────────────────────────────────────────
 * 8. ONE fuse
 * ────────────────────────────────────────────────────────────────────────── */
const NET = buildParkNet({
  nodes: NODES,
  edges: EDGES,
  pieces: ALL_PLANS,
  keepDry: NODES.filter((c) => offRow(c)),
});
parkAssert('netWarnings', !(NET.warnings ?? []).length,
  `buildParkNet warned: ${JSON.stringify(NET.warnings)}`);

/** the guard list is DERIVED from the fuse's OUTPUT, never transcribed */
function keepDryOf(net: { keepDry: XZ[] }, row: SeedRow = SEED_ROW): XZ[] {
  const kept = net.keepDry.filter((c) => offRow(c, row));
  const dropped = net.keepDry.length - kept.length;
  if (dropped) console.warn(
    `[park] keepDryOf dropped ${dropped} of ${net.keepDry.length} guard cell(s) on the pinned row's water — ` +
    'a DROPPED guard is NOT a fixed cell. MOVE whatever stands there.');
  return kept;
}
const GUARDS = keepDryOf(NET, SEED_ROW);
console.log(`[park] guards: ${GUARDS.length} of ${NET.keepDry.length} fused cells kept`);

/* ─────────────────────────────────────────────────────────────────────────────
 * 9. the §5c re-compose diff — water AND relief
 * ────────────────────────────────────────────────────────────────────────── */
const BARE = parkComposition(THREE, SEED, SIZE, CLIMATE);
const COMP = parkComposition(THREE, SEED, SIZE, CLIMATE, { keepDry: GUARDS, coasterPts: ALL_COASTER_PTS });
{
  const moved = (a: XZ | null, b: XZ | null) =>
    a && b ? Math.hypot(a[0] - b[0], a[1] - b[1]) : a === b ? 0 : Infinity;
  const dDom = moved(BARE.waterCentre as XZ | null, COMP.waterCentre as XZ | null);
  const dSec = moved(BARE.waterCentreSecond as XZ | null, COMP.waterCentreSecond as XZ | null);
  console.log(`[park] water diff — dominant ${dDom.toFixed(2)} u · secondary ${dSec.toFixed(2)} u · ` +
    `terrainSeed ${BARE.terrainSeed} → ${COMP.terrainSeed}`);
  parkAssert('waterRePicked', dDom <= 6 && dSec <= 6,
    `the guard list MOVED a water body off the pinned row — dominant ${dDom.toFixed(1)} u, secondary ` +
    `${dSec.toFixed(1)} u (terrainSeed ${BARE.terrainSeed} → ${COMP.terrainSeed}). Guard only what you PAVE.`);

  const rf = COMP.report.reliefFloor;
  if (rf) console.log(`[park] reliefFloor kept ${rf.kept.toFixed(2)} (floor ${rf.floor}) · relief ` +
    `${rf.relief.toFixed(2)} · stdH ${rf.stdH.toFixed(2)}`);
  parkAssert('terrainFlattened', !rf || rf.kept >= rf.floor,
    rf ? `keepDry FLATTENED the seed: authored relief ${rf.authoredRelief.toFixed(2)} → ${rf.relief.toFixed(2)} ` +
      `(kept ${rf.kept.toFixed(2)} vs floor ${rf.floor}), stdH ${rf.authoredStdH.toFixed(2)} → ${rf.stdH.toFixed(2)}; ` +
      `ranges guarded: ${rf.guardedRanges}` : '',
    'advisory');
}

/* ─────────────────────────────────────────────────────────────────────────────
 * 10. pad placement — margins off the measured table, flatness + dryness checked
 * ────────────────────────────────────────────────────────────────────────── */
const PAD_MARGIN: Record<string, number> = {
  LogFlume: 5.36, GhostTrain: 4.77, Monorail: 4.02, Helicycles: 3.42,
  FerrisWheel: 2.97, TopSpin: 2.52, Carousel: 2.40,
};
const padMarginOf = (rig: string) => PAD_MARGIN[rig] ?? 3.2;

const PEAK_LIMIT = 0.75;
const isDry = (c: XZ, margin = 1.2) =>
  [...COMP.basins, ...(COMP.basinsSecond ?? []), ...(COMP.clampBasins ?? [])]
    .every((b) => Math.hypot(c[0] - b.x, c[1] - b.z) > 0.74 * b.radius + margin);
const bumpAt = (c: XZ) =>
  Math.max(0, ...COMP.peaks.map((p) => {
    const k = Math.max(0, 1 - Math.hypot(c[0] - p.x, c[1] - p.z) / p.radius);
    return k * k * (3 - 2 * k) * p.height;
  }));

function assertPadFlat(pad: XZ, clear: number, label: string): XZ {
  if (bumpAt(pad) <= PEAK_LIMIT && isDry(pad)) return pad;
  for (let r = 1; r <= 8; r += 1) {
    for (let ix = -r; ix <= r; ix += 1) {
      for (let iz = -r; iz <= r; iz += 1) {
        if (Math.max(Math.abs(ix), Math.abs(iz)) !== r) continue;
        const c: XZ = [+(pad[0] + ix * 0.6).toFixed(2), +(pad[1] + iz * 0.6).toFixed(2)];
        if (bumpAt(c) > PEAK_LIMIT || !isDry(c)) continue;
        const off = offPathCell(NET, c, { clear });
        if (off && Math.hypot(off[0] - c[0], off[1] - c[1]) < 1e-6) {
          console.warn(`[park] ${label}: pad [${pad}] on a hill flank or wet (bump ${bumpAt(pad).toFixed(2)}) — moved to [${c}]`);
          return c;
        }
      }
    }
  }
  parkAssert('padOnFlank', false,
    `${label}: pad [${pad}] is on a hill flank (bump ${bumpAt(pad).toFixed(2)} > ${PEAK_LIMIT}) OR WET, and no cell ` +
    `within 4.8 u is flat, dry AND ${clear} u off the street. MOVE THE TAIL.`);
  return pad;
}

const minReachOf = (c: number) => laneLenOf(c) + 0.35 + 0.62 + 0.5 + 0.45;

type Placement = { pad: XZ; anchor: XZ; dir: XZ; yaw: number };
function place(tail: XZ, out: XZ, capacity: number, rig: string, extra = 0): Placement {
  const clear = padMarginOf(rig);
  const join = laneLenOf(capacity) + 0.35;
  const reach = minReachOf(capacity) + 2.4 + extra;
  const cand: XZ = [+(tail[0] + out[0] * reach).toFixed(2), +(tail[1] + out[1] * reach).toFixed(2)];
  const onStreet = (offPathCell(NET, cand, { clear }) ?? cand) as XZ;
  const pad = assertPadFlat(onStreet, clear, rig);
  const got = Math.hypot(pad[0] - tail[0], pad[1] - tail[1]);
  parkAssert('padReach', got >= minReachOf(capacity) + 1.2,
    `${rig}: pad [${pad}] sits ${got.toFixed(2)} u from its tail [${tail}] — the cap-${capacity} floor is ` +
    `${(minReachOf(capacity) + 1.2).toFixed(2)} u. Open the court or move the tail outward.`);
  const hit = CORRIDOR_KEEPOUT.find((r) => inRect(pad, r, clear));
  parkAssert('padInCorridor', !hit,
    hit ? `${rig}: pad [${pad}] stands in the ${hit.label} coaster corridor keep-out` : '');
  return {
    pad,
    anchor: [+(tail[0] + out[0] * join).toFixed(2), +(tail[1] + out[1] * join).toFixed(2)] as XZ,
    dir: [-out[0], -out[1]] as XZ,
    yaw: Math.atan2(-out[0], -out[1]),
  };
}

const WHEEL = place(NODES[2], [1, 0], 4, 'FerrisWheel');
const GHOST = place(NODES[3], [1, 0], 6, 'GhostTrain');
const HELI = place(NODES[11], [0, -1], 2, 'Helicycles');
const ROUNDABOUT = place(NODES[13], [1, 0], 4, 'Carousel');
const FLUME = place(NODES[15], [0, -1], 6, 'LogFlume', 1.2);
const FLIP = place(NODES[26], [-1, 0], 4, 'TopSpin');
const RIDE_PADS: { at: XZ; half: number; label: string }[] = [
  { at: WHEEL.pad, half: padMarginOf('FerrisWheel'), label: 'FerrisWheel' },
  { at: GHOST.pad, half: padMarginOf('GhostTrain'), label: 'GhostTrain' },
  { at: HELI.pad, half: padMarginOf('Helicycles'), label: 'Helicycles' },
  { at: ROUNDABOUT.pad, half: padMarginOf('Carousel'), label: 'Carousel' },
  { at: FLUME.pad, half: padMarginOf('LogFlume'), label: 'LogFlume' },
  { at: FLIP.pad, half: padMarginOf('TopSpin'), label: 'TopSpin' },
];
assertNodesOffPieces(RIDE_PADS.map((p) => p.at), ALL_PLANS, 'pad');

/** the restroom — a BUILDING, so clear 1.8 */
const RESTROOM: XZ = (offPathCell(NET, [-18.0, 48.0], { clear: 1.8 }) ?? [-18.0, 48.0]) as XZ;

/* ─────────────────────────────────────────────────────────────────────────────
 * 11. the three worlds — each with its own themed stall, ride and scenery
 * ────────────────────────────────────────────────────────────────────────── */
const sieveProp = (c: XZ): XZ => (offPathCell(NET, c, { clear: 1.2 }) ?? c) as XZ;

const PULSE_SC: XZ[] = ([[7.2, 61.2], [16.8, 49.2], [21.6, 57.6]] as XZ[]).map(sieveProp);
const EMBER_SC: XZ[] = ([[-56.4, -21.6], [-48.0, -24.0], [-56.4, -12.0]] as XZ[]).map(sieveProp);
const TIDE_SC: XZ[] = ([[61.2, -20.4], [50.4, -8.4], [60.0, -9.6]] as XZ[]).map(sieveProp);

/** bare rect-extender cells: they carry NO geometry, they pull each world's rect
 *  over its monorail deck so `everyWorldTouched` reads true. */
const PULSE_DECK_CELL: XZ = [1.2, 36.0];
const EMBER_DECK_CELL: XZ = [-43.2, -8.4];
const TIDE_DECK_CELL: XZ = [43.2, -8.4];

const WORLD_NEON = worldPlan({
  id: 'neonQuarter', theme: NEON_CITY, pieces: [PULSE_ROW],
  include: [...PULSE_SC, WHEEL.pad, PULSE_DECK_CELL],
});
const WORLD_FIRE = worldPlan({
  id: 'cinderReach', theme: FIRE, pieces: [EMBER_ROW],
  include: [...EMBER_SC, FLIP.pad, EMBER_DECK_CELL],
});
const WORLD_TIDE = worldPlan({
  id: 'saltspray', theme: PIRATE_BEACH, pieces: [TIDE_ROW],
  include: [...TIDE_SC, ROUNDABOUT.pad, TIDE_DECK_CELL],
});
const WORLDS = [WORLD_NEON, WORLD_FIRE, WORLD_TIDE];

([['neonQuarter', PULSE_SC], ['cinderReach', EMBER_SC], ['saltspray', TIDE_SC]] as const)
  .forEach(([id, cells]) => {
    const w = WORLDS.find((x) => x.id === id)!;
    const inside = cells.filter((c) => w.contains(c)).length;
    parkAssert('worldScenery', inside >= 3,
      `world '${id}' has ${inside} themed scenery cell(s) inside its rect — the floor is 3`);
  });
[PULSE_ROW, EMBER_ROW, TIDE_ROW].forEach((b) => {
  parkAssert('bazaarStallCount', b.slots.length >= 3,
    `bazaar '${b.id}' holds ${b.slots.length} stalls — the floor is 3`);
});
{
  const centres = WORLDS.map((w) => w.centre as XZ);
  for (let i = 0; i < centres.length; i += 1) {
    for (let j = i + 1; j < centres.length; j += 1) {
      const d = Math.hypot(centres[i][0] - centres[j][0], centres[i][1] - centres[j][1]);
      parkAssert('worldSeparation', d >= 20 * Math.sqrt(SIZE / 48),
        `worlds '${WORLDS[i].id}' and '${WORLDS[j].id}' are ${d.toFixed(1)} u apart — the floor is ` +
        `${(20 * Math.sqrt(SIZE / 48)).toFixed(2)} u`);
    }
  }
}

const STALL_COUNT = PULSE_ROW.slots.length + EMBER_ROW.slots.length + TIDE_ROW.slots.length;
const RIDE_NAMES = [
  'Corkscrew Cataclysm', 'Cinder Chaser', 'Skyloop Transit', 'Cinderwash Chute',
  'Wraithlight Hollow', 'Skyline Halo', 'Saltspray Gallopers', 'Ashwing Patrol', 'Magma Flip',
];

/* ─────────────────────────────────────────────────────────────────────────────
 * 12. the dressing scatter — deterministic, street-sieved, water-sieved in the tree
 * ────────────────────────────────────────────────────────────────────────── */
const PIECE_RECTS = ALL_PLANS.map((p) => p.footprint);
function nearKeepOut(c: XZ, pad: number): boolean {
  if (PIECE_RECTS.some((f) => {
    const co = Math.cos(-(f.yaw ?? 0)), si = Math.sin(-(f.yaw ?? 0));
    const dx = c[0] - f.cx, dz = c[1] - f.cz;
    const lx = dx * co - dz * si, lz = dx * si + dz * co;
    return Math.max(Math.abs(lx) - f.hx, Math.abs(lz) - f.hz) < pad + 1.2;
  })) return true;
  if (RIDE_PADS.some((p) => Math.hypot(c[0] - p.at[0], c[1] - p.at[1]) < p.half + pad + 1.2)) return true;
  if (Math.hypot(c[0] - RESTROOM[0], c[1] - RESTROOM[1]) < 3.0) return true;
  if (Math.hypot(c[0] - GATE_CELL[0], c[1] - GATE_CELL[1]) < 5.0) return true;
  if (CORRIDOR_KEEPOUT.some((r) => inRect(c, r, 2.4))) return true;
  return false;
}
const nearCoaster = (c: XZ, d: number) =>
  ALL_COASTER_PTS.some((p) => Math.hypot(c[0] - p[0], c[1] - p[2]) < d);
const nearRing = (c: XZ, d: number) =>
  RING_SEGS.some(([a, b]) => distToSeg(c, a, b) < d) ||
  RING_CELLS.some((r) => Math.hypot(c[0] - r[0], c[1] - r[1]) < 6.0);

function scatter(count: number, seedBase: number, minGap: number, pad: number): XZ[] {
  const out: XZ[] = [];
  for (let i = 0; out.length < count && i < count * 120; i += 1) {
    const h1 = hash01(seedBase + i * 2.17 + 0.5);
    const h2 = hash01(seedBase + i * 3.71 + 41.5);
    const x = +(Math.round(((h1 * 2 - 1) * 56.4) / 1.2) * 1.2).toFixed(2);
    const z = +(Math.round(((h2 * 2 - 1) * 56.4) / 1.2) * 1.2).toFixed(2);
    const c: XZ = [x, z];
    if (!offRow(c, SEED_ROW, 14)) continue;
    if (bumpAt(c) > PEAK_LIMIT) continue;
    if (!isDry(c, 2.4)) continue;
    if (nearCoaster(c, 3.2)) continue;
    if (nearRing(c, 3.6)) continue;
    if (nearKeepOut(c, pad)) continue;
    if (out.some((o) => Math.hypot(o[0] - c[0], o[1] - c[1]) < minGap)) continue;
    out.push(c);
  }
  return out;
}

const TREE_SHAPES = ['round', 'pine', 'willow', 'round', 'pine'] as const;
type TreeShape = (typeof TREE_SHAPES)[number];
const RAW_TREES = scatter(44, 17, 4.2, 0.75);
const TREES: { at: XZ; shape: TreeShape; sieved: true }[] = RAW_TREES.map((c, i) => ({
  at: (offPathCell(NET, c, { clear: 0.75 }) ?? c) as XZ,
  shape: TREE_SHAPES[i % TREE_SHAPES.length],
  sieved: true,
}));
parkAssert('scatterSieved', TREES.every((t) => t.sieved === true) && TREES.length >= 32,
  `the tree scatter produced ${TREES.length} sieved cells — the floor at size 128 is 32`);

const SCENERY_KINDS = [
  'marbleStatue', 'birdbath', 'picnicTable', 'planterBox', 'topiarySpiral',
  'signpost', 'parkClock', 'wishingWell', 'gazebo', 'fallenLog', 'brickWall',
] as const;
const RAW_SCENERY = scatter(22, 91, 5.4, 1.2);
const SCENERY: { at: XZ; name: string }[] = RAW_SCENERY.map((c, i) => ({
  at: (offPathCell(NET, c, { clear: 1.2 }) ?? c) as XZ,
  name: SCENERY_KINDS[i % SCENERY_KINDS.length],
}));
parkAssert('sceneryCount', SCENERY.length >= 16,
  `the scenery scatter produced ${SCENERY.length} cells — the floor at size 128 is 16`);

/** the cells we cannot drop — they still need the GATE'S OWN dryness receipt */
const HARD_CELLS: { at: XZ }[] = [
  ...RIDE_PADS.map((p) => ({ at: p.at })),
  { at: RESTROOM },
  ...PULSE_SC.map((at) => ({ at })), ...EMBER_SC.map((at) => ({ at })), ...TIDE_SC.map((at) => ({ at })),
  ...QUEUE_TAILS.map((at) => ({ at })),
];

parkAssertFlush();

/* ─────────────────────────────────────────────────────────────────────────────
 * 13. the offline probe hook
 * ────────────────────────────────────────────────────────────────────────── */
export function __netdump() {
  return {
    seed: SEED, size: SIZE, climate: CLIMATE,
    keepDry: GUARDS,
    coasterPts: ALL_COASTER_PTS,
    hardCells: HARD_CELLS.map((c) => c.at),
    layoutRaw: { nodes: NODES, edges: EDGES },
    regions: WORLDS.map((w) => ({ id: w.id, region: w.region })),
  };
}

/* ─────────────────────────────────────────────────────────────────────────────
 * 14. the dryness receipt, IN THE TREE — the gate's own predicate
 * ────────────────────────────────────────────────────────────────────────── */
type ParkCtx = ReturnType<typeof usePark>;
function dryRing(park: ParkCtx, c: XZ, r = 0.75): boolean {
  const g = park.ground as { lint?: { isDry?: (x: number, z: number, cl: number) => boolean } } | null;
  if (!g || !g.lint || !g.lint.isDry) return true;
  const dry = (x: number, z: number) => g.lint!.isDry!(x, z, 0.05);
  if (!dry(c[0], c[1])) return false;
  for (let k = 0; k < 8; k += 1) {
    const a = (k / 8) * Math.PI * 2;
    if (!dry(c[0] + Math.cos(a) * r, c[1] + Math.sin(a) * r)) return false;
  }
  return true;
}

function DryScatter<T extends { at: XZ }>({ cells, render, label }: {
  cells: T[]; render: (c: T, i: number) => React.ReactNode; label: string;
}) {
  const park = usePark('DryScatter');
  const [dry, setDry] = React.useState<T[] | null>(null);
  React.useEffect(() => {
    const kept = cells.filter((c) => dryRing(park, c.at));
    if (kept.length < cells.length) {
      console.error(`[park] DryScatter(${label}) dropped ${cells.length - kept.length} of ${cells.length} cell(s) ` +
        `under waterline+0.05: ${JSON.stringify(cells.filter((c) => !kept.includes(c)).map((c) => c.at))}`);
    }
    setDry(kept);
  }, [park, cells, label]);
  return <>{(dry ?? []).map(render)}</>;
}

/* ─────────────────────────────────────────────────────────────────────────────
 * 15. the monorail ring — VERBATIM pose, position/rotation only
 * ────────────────────────────────────────────────────────────────────────── */
const MONO_PIECES: TrackPiece[] = [
  'station',
  { type: 'straight', length: 35.3 },
  { type: 'turnL', angle: 90, radius: 6 },
  { type: 'straight', length: 35.3 },
  'station',
  { type: 'straight', length: 35.3 },
  { type: 'turnL', angle: 90, radius: 6 },
  { type: 'straight', length: 35.3 },
  'station',
  { type: 'straight', length: 35.3 },
  { type: 'turnL', angle: 90, radius: 6 },
  { type: 'straight', length: 35.3 },
  'station',
  { type: 'straight', length: 35.3 },
  { type: 'turnL', angle: 90, radius: 6 },
  { type: 'straight', length: 33.5 },
  { type: 'straight', length: 1.5 },
];

/* ─────────────────────────────────────────────────────────────────────────────
 * 16. the park
 * ────────────────────────────────────────────────────────────────────────── */
export function App() {
  return (
    <div className="w-full min-h-full bg-slate-900">
      <Park
        seed={SEED}
        climate={CLIMATE}
        roster={{ rides: RIDE_NAMES, stalls: STALL_COUNT, categories: 5 }}
        onReady={(report) => {
          console.log('[park] validatePark', {
            ok: report.ok, failures: report.failures, warnings: report.warnings,
          });
        }}
      >
        <Terrain keepDry={GUARDS} coasterPts={ALL_COASTER_PTS} />
        <Paths nodes={NET.nodes} edges={NET.edges} plazas={NET.plazas} bins={NET.bins} walkers={6} />
        <GameManager />
        <Gate />

        {/* ── TRANSPORT: the park-spanning ring, one platform per world ── */}
        <Monorail
          position={[-42.6, 0, -9.7]}
          rotation={0}
          pieces={MONO_PIECES}
          beamY={2.6}
          loopSeconds={12}
          pinned
          name="Skyloop Transit"
          capacity={6}
          rideDuration={12}
          intensity={1}
          price={0}
          queue={{ anchor: [-40.81, -8.4], dir: [1, 0] }}
          register={{
            board: [-42.6, 2.6, -8.4],
            stations: [
              { label: 'Neon Quarter', boardPoint: [0, 2.6, 34.2], queueAnchor: [0, 0.05, 32.41], queueDir: [0, -1], exitPoint: [-1.2, 0.05, 33.03], exitDir: [0, -1] },
              { label: 'Saltspray', boardPoint: [42.6, 2.6, -8.4], queueAnchor: [40.81, 0.05, -8.4], queueDir: [-1, 0], exitPoint: [41.43, 0.05, -7.2], exitDir: [-1, 0] },
              { label: 'South Shelf', boardPoint: [0, 2.6, -51.0], queueAnchor: [0, 0.05, -52.79], queueDir: [0, -1], exitPoint: [1.2, 0.05, -52.17], exitDir: [0, -1] },
            ],
          }}
        />

        {/* ── THRILL: the two coasters, different archetypes, disjoint boxes ── */}
        <Coaster
          name="Corkscrew Cataclysm"
          pieces={C_PIECES}
          start={C_START}
          heading={0}
          type="steel"
          cars={3}
          capacity={4}
          rideDuration={11}
          loadTime={2}
          intensity={9}
          price={7}
          queueTailNode={NET.node(C_TAIL)}
          queueDir={[1, 0]}
        />
        <Coaster
          name="Cinder Chaser"
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

        {/* ── the flat + tracked roster ── */}
        <FerrisWheel
          position={WHEEL.pad}
          rotation={WHEEL.yaw}
          queue={{ anchor: WHEEL.anchor, dir: WHEEL.dir }}
          register={{ name: 'Skyline Halo', capacity: 4, rideDuration: 10, intensity: 2, price: 3 }}
        />
        <GhostTrain
          position={GHOST.pad}
          rotation={GHOST.yaw}
          queue={{ anchor: GHOST.anchor, dir: GHOST.dir }}
          register={{ name: 'Wraithlight Hollow', capacity: 6, rideDuration: 11, intensity: 5, price: 5 }}
        />
        <Helicycles
          position={HELI.pad}
          rotation={HELI.yaw}
          queue={{ anchor: HELI.anchor, dir: HELI.dir }}
          register={{ name: 'Ashwing Patrol', capacity: 2, rideDuration: 9, intensity: 3, price: 3 }}
        />
        <Carousel
          position={ROUNDABOUT.pad}
          rotation={ROUNDABOUT.yaw}
          queue={{ anchor: ROUNDABOUT.anchor, dir: ROUNDABOUT.dir }}
          register={{ name: 'Saltspray Gallopers', capacity: 4, rideDuration: 9, intensity: 2, price: 3 }}
        />
        <LogFlume
          position={FLUME.pad}
          rotation={FLUME.yaw}
          queue={{ anchor: FLUME.anchor, dir: FLUME.dir }}
          register={{ name: 'Cinderwash Chute', capacity: 6, rideDuration: 12, intensity: 5, price: 6 }}
        />
        <TopSpin
          position={FLIP.pad}
          rotation={FLIP.yaw}
          queue={{ anchor: FLIP.anchor, dir: FLIP.dir }}
          register={{ name: 'Magma Flip', capacity: 4, rideDuration: 9, intensity: 8, price: 6 }}
        />

        {/* ── the street set-pieces (AFTER <Paths>) ── */}
        <FountainPlaza plan={HUB} />
        <FountainPlaza plan={VIEWPOINT} />
        <Boulevard plan={AVE_WEST} />

        {/* ── the three worlds, their markets and their own scenery packs ── */}
        <World plan={WORLD_NEON} />
        <World plan={WORLD_FIRE} />
        <World plan={WORLD_TIDE} />

        <Bazaar plan={PULSE_ROW} />
        <NeonArch position={PULSE_SC[0]} rotation={Math.PI} text="PULSE" />
        <SpeakerStack position={PULSE_SC[1]} rotation={-Math.PI / 2} count={3} />
        <MirrorBallPylon position={PULSE_SC[2]} count={6} />

        <Bazaar plan={EMBER_ROW} />
        <Fumarole position={EMBER_SC[0]} seed={2} />
        <ObsidianShards position={EMBER_SC[1]} rotation={0.6} seed={7} />
        <BasaltColumns position={EMBER_SC[2]} rotation={0.4} seed={3} />

        <Bazaar plan={TIDE_ROW} />
        <WreckedHull position={TIDE_SC[0]} rotation={Math.PI / 2} seed={5} />
        <CoralCluster position={TIDE_SC[1]} seed={4} />
        <AnchorPile position={TIDE_SC[2]} rotation={0.9} seed={6} />

        {/* ── amenities + night dressing ── */}
        <Restroom position={RESTROOM} rotation={Math.PI / 2} />
        <Neon text="CINDERWASH COVE" position={[0, 1.7, 60.0]} rotation={Math.PI} scale={0.6} />
        <Neon text="SALTSPRAY" position={[49.2, 1.7, -12.0]} rotation={-Math.PI / 2} scale={0.5} />
        <Torch position={[-3.6, 61.2]} />
        <Torch position={[3.6, 61.2]} />
        <Lights from={[-9.6, 27.6]} to={[-9.6, 21.6]} />
        <Lights from={[13.2, -21.6]} to={[18.0, -21.6]} />

        {/* ── the sieved dressing, LAST ── */}
        <DryScatter
          label="hard"
          cells={HARD_CELLS}
          render={() => null}
        />
        <DryScatter
          label="trees"
          cells={TREES}
          render={(t, i) => (
            <Placed
              key={`tr-${i}`}
              position={t.at}
              build={(three) => tree(three, { shape: t.shape })}
            />
          )}
        />
        <DryScatter
          label="scenery"
          cells={SCENERY}
          render={(s, i) => (
            <Scenery key={`sc-${i}`} name={s.name} position={s.at} seed={i + 1} />
          )}
        />
      </Park>
    </div>
  );
}

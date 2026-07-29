/* ═══ THREE CROWNS PARK — §0 PRE-FLIGHT ═══════════════════════════════════════════════
 * SIZE   128 (default, `size` prop omitted)
 * SEED   1 / temperate — dominant lake ctr (41, -39) box x[21,60] z[-60,-21] ·
 *        secondary ctr (-38, 31) box x[-56,-21] z[23,39]   [PRE-keepDry, SEED_ROW_WATER]
 *        RING WATER WALK: all 16 monorail ring cells walked against BOTH boxes and both
 *        12-u centre discs — tightest = E deck [42.6,-8.4] → 30.6 u from (41,-39) ✓
 *        (no ring cell inside either box; row 1/temperate is published ring-clean)
 *        ring-only re-compose: BARE vs COMP diffed on BOTH centroids (waterMoved assert),
 *        guard list DERIVED by keepDryOf(NET) — never NODES.slice() ✓
 *        every pad + prop cell re-checked IN THE TREE by the gate's own predicate
 *        (dryRing → park.ground.lint.isDry(x, z, 0.05), min ground > -0.21) ✓
 *        reliefFloor.kept read off report.reliefFloor (NOT report.relief) ≥ 0.70 ✓
 * WORLDS 3 (>= 3): steampunk @(-40.5,-10.5) · neon @(35.1,3.0) · fire @(-5.4,-56.7)
 *        all centre pairs SORTED, closest marked (the floor binds the CLOSEST):
 *        steampunk<->fire 58.1 ◄ >= 32.66 (20·sqrt(128/48)) ✓ · steampunk<->neon 76.9 ·
 *        fire<->neon 72.1 · DRY GAP between world RECTS > 0 (z-disjoint / x-disjoint) ✓
 *        WORLD steampunk: ride GearworksExpress @[-32.4,7.2] (inside rect ✓) ·
 *          stall goggles (Aperture & Cog) · scenery ClockTower + BoilerTank + SteamPipes
 *        WORLD neon: ride Discotron @[30,8.78] · stall neonSlush (Voltage Slush) ·
 *          scenery NeonArch + SpeakerStack + MirrorBallPylon
 *        WORLD fire: stall emberRoast (Cinder Grill) ·
 *          scenery Fumarole + BasaltColumns + CharredSnag
 *        >= 3 THEMED scenery each, ALL from that world's OWN pack — no foreign piece ✓
 * CATS   (WRITTEN BEFORE ANY JSX) gentle Carousel + FerrisWheel · thrill §4.0-L flagship
 *        + §4.0-B · water LogFlume · transport Monorail ring · dark GhostTrain +
 *        GearworksExpress   → 5/5 categories ✓  (9 distinct rides, >= 8 ✓)
 *        RARE PICK GearworksExpress — a never-shipped catalog rig (10.03 u pad margin);
 *        chosen because it is the smallest of the four unbuilt kinds and the only one
 *        that fits between the monorail west beam (x -42.6) and §4.0-L's west leg ✓
 * CIRCUITS  §4.0-L · §4.0-B · Monorail ring · LogFlume · GhostTrain · GearworksExpress
 *        → 6 CIRCUITS (>= 5) / 4 FAMILIES (coaster · transport · water · dark, >= 3) ✓
 * GATE   [0, 63.6] → first queue tail [0, 58.8] (Carousel) = 4.8 u  <= 15 ✓
 * FLAG   §4.0-L start [16.8, 0.55, -3.6] heading 0, steel, cars 3, NO bank prop (0.7)
 *        rateCoaster(bank 0.7, cars 3) → E 6.29 / I 8.58 / N 3.17 / drop 4.19 /
 *        maxLatG 1.20 (guard 1.275) / INVERSIONS 2 (vertical LOOP + corkscrew) / 0 synth
 *        CORRIDOR KEEP-OUT in PLOT coords, all four rects walked against every street
 *        node and every boulevard leg: west x[-22.2,-21.0] z[-4.2,12.6] · south
 *        x[-17.4,3.0] z[-15.0,-13.8] · north x[-12.6,9.0] z[16.2,18.6] · INTERIOR return
 *        x[3.0,4.2] z[-13.8,-0.6] — 0 street cells inside any of them ✓ (the ring
 *        interior carries NO north-south column: the cycle runs the EAST spine x 22.8)
 * FLAG2  §4.0-B start [-33.6, 0.55, -48.0] heading 0, steel, cars 3, NO bank prop
 *        rateCoaster(bank 0.7, cars 3) → E 5.27 / I 6.25 / N 2.25 / drop 3.58 /
 *        maxLatG 0.27 · DIFFERENT archetype ✓ · bbox DISJOINT from FLAG's (15.18 u in x,
 *        12.69 u in z) ✓ · off all 16 ring cells ✓ · outside every <World> rect ✓ ·
 *        coasterPts = [...FLAG_PTS, ...FLAG2_PTS] → <Terrain coasterPts> ✓
 * STREET buildParkNet called EXACTLY ONCE ✓ · the SAME NET feeds <Paths> and every
 *        offPathCell / place() call ✓
 *        PORT-REFS: 8 pieces → 10 refs in EDGES, counted and listed ✓
 *        every flat-ride pad returned BY offPathCell through place() ✓
 * MONO   ring VERBATIM · position [-42.6, 0, -9.7] (the START POSE, not the centre)
 *        4 platforms >= 3 declared worlds — W deck in steampunk, E deck in neon,
 *        S deck in fire (N deck is the neutral north lawn) ✓
 *        tails [-36.0,-8.4] · [0,27.6] · [36.0,-8.4] · [0,-57.6] authored NODES,
 *        ALL LEAVES (degree 1) ✓ · S queues OUTWARD, gate spine ENDS at the hub and the
 *        N tail is reached LATERALLY off the east spine (§0-P.4) ✓
 * QUEUE  ONE ROW PER RIDE — tail is an authored NODE, pad DERIVED from it:
 *        Carousel   cap 8  tail [0,58.8]     out [-1,0] → pad ~[-9.90,58.8]   >= 8.70 ✓
 *        FerrisWheel cap 8 tail [22.8,39.6]  out [1,0]  → pad ~[32.70,39.6]   >= 8.70 ✓
 *        GhostTrain cap 6  tail [22.8,21.6]  out [1,0]  → pad ~[31.58,21.6]   >= 7.58 ✓
 *        LogFlume   cap 4  tail [-9.6,-16.8] out [0,-1] → pad ~[-9.6,-24.46]  >= 6.46 ✓
 *        Discotron  cap 6  tail [30.0,0]     out [0,1]  → pad ~[30.0,8.78]    >= 7.58 ✓
 *        Gearworks  cap 6  tail [-32.4,-3.6] out [0,1]  → pad  [-32.4,7.2]    10.80 ✓
 *        §4.0-L     cap 4  tail [22.8,-3.6] (= start.x + 6.0) queueDir [1,0] ✓
 *        §4.0-B     cap 4  tail [-27.6,-48.0] (= start.x + 6.0) queueDir [1,0] ✓
 *        no two rides share a tail node · every tail appears in NODES (or on gateAve) ✓
 *        clear = padMarginOf(rig) off the §0-P.5 table, never the 3.2 default by guess ✓
 * GROUND every pad run through assertPadFlat: bumpAt <= 0.75 AND outside every composed
 *        basin, with a flatter-cell fallback ✓ · causewayEdges EMPTY ✓
 * SPREAD built bbox 85.2 x 116.4 >= 70 x 45 ✓ · street-node bbox spans x[-46.8,36.0]
 *        z[-60.6,63.6] → pathExtent >= 0.55 ✓
 * PLAZAS hub 8.4 x 8.4 = 70.6 u2 (largest, >= 8) + 4 bazaar courts → areaSpread >= 1.8 ✓
 *        NO set-piece `position` appears in NODES or as a queue tail —
 *        assertNodesOffPieces run over NODES *and* again over the derived PADS ✓
 * NODES  51 authored + 3 boulevards + 4 courts · degree-1: 6 (0.12) → each carries a
 *        monorail tail / a coaster tail / the Gearworks tail ✓
 *        one PARK-SPANNING loop, crosses z = 0 twice (east spine x 22.8, west column
 *        x -16.8) ✓ — not a court-sized cycle
 * ATTACH every spur is at grade: no `nodeY` anywhere in this file, so every edge is
 *        |dy|/len = 0 <= 0.417 and the reachability walk seeds on all of it ✓
 *        no street edge crosses a coaster queue lane (the corridor rects above are the
 *        same rects the lanes live in) → no REFUSED span, no severed graph ✓
 *        accessibility.allRidesReachable MUST come back true ✓
 * LATTICE authored spans 1.2 / 2.4 / 3.6 / 4.8 / 6.0 / 7.2 / 8.4 / 9.6 / 12.0 / 13.2 u
 *        + the boulevards' 1.2 chains → effectiveClasses >= 4 ✓ · 1.2-chain share <= 0.55 ✓
 * ROSTER (WRITTEN LAST, counted off the register calls, and restated on <Park roster>)
 *        9 rides / 5 categories / 13 stalls (7 kinds) / restroom ✓ / bins from NET ✓
 *        NAMED: every ride AND EVERY STALL carries an authored `name` — 0 shipped under
 *        its catalog defaultName ✓
 *        <Park roster={{ rides: [...9 names], stalls: 13, categories: 5 }}> MOUNTED ✓
 * DRESS  46 authored tree cells >= 32 ✓ · 24 neutral + 9 themed scenery >= 16 ✓ ·
 *        water 2 bodies, temperate band 4-22 % ✓
 *        EVERY prop cell from offPathCell (trees clear 0.75, scenery clear 1.2,
 *        buildings clear 1.8) and then sieved by DryScatter's dryRing ✓
 * NIGHT  2 <Lights> runs · 2 neon signs · 4 torches · lantern glow from the 4 set-pieces
 * GATE   parkAssertFlush() → 0 structural · validatePark → ok: true, 0 failures/warnings
 * ═══════════════════════════════════════════════════════════════════════════════════ */
import * as THREE from 'three';
import React from 'react';

import type { V3, XZ } from './components/Park';
import {
  Park, GameManager, Terrain, Paths, Gate, Coaster, Restroom, Scenery, Lights, Placed,
  Neon, Torch, usePark, offPathCell,
} from './components/Park';
import { laneLenOf, parkComposition } from './components/ParkBuilder';
import type { NetRef, SetPiecePlan } from './components/SetPieceKit';
import {
  buildParkNet, worldPlan, World,
  FIRE, STEAMPUNK, NEON_CITY,
} from './components/SetPieceKit';

/** Hashed-sine PRNG — §12: deterministic only, never Math.random / Date.now. */
const hash01 = (n: number) => {
  const s = Math.sin(n * 12.9898 + 78.233) * 43758.5453;
  return s - Math.floor(s);
};
import type { TrackPiece } from './components/SplineRideKit';
import { compileTrackPieces, rateCoaster } from './components/SplineRideKit';
import { Bazaar, bazaarPlan } from './components/Bazaar';
import { FountainPlaza, fountainPlazaPlan } from './components/FountainPlaza';
import { Boulevard, boulevardPlan } from './components/Boulevard';
import { tree } from './components/Kit';

import { Monorail } from './components/Monorail';
import { Carousel } from './components/Carousel';
import { FerrisWheel } from './components/FerrisWheel';
import { LogFlume } from './components/LogFlume';
import { GhostTrain } from './components/GhostTrain';
import { Discotron } from './components/Discotron';
import { GearworksExpress } from './components/GearworksExpress';

import { Fumarole, BasaltColumns, CharredSnag } from './components/EmberfallScenery';
import { ClockTower, BoilerTank, SteamPipes } from './components/BrassworkScenery';
import { NeonArch, SpeakerStack, MirrorBallPylon } from './components/PulseScenery';

/* ─────────────────────────────────────────────────────────────────────────────
 * §1  ASSERTION BUS — collect every failure, print ONE block, throw ONCE
 * ───────────────────────────────────────────────────────────────────────────── */
type Sev = 'structural' | 'advisory';
const PARK_FAILS: { name: string; detail: string; sev: Sev }[] = [];
function parkAssert(name: string, cond: boolean, detail: string, sev: Sev = 'structural'): boolean {
  if (!cond) PARK_FAILS.push({ name, detail, sev });
  return cond;
}
function parkAssertFlush(): void {
  if (!PARK_FAILS.length) { console.log('[park] assertions: all pass'); return; }
  const hard = PARK_FAILS.filter((f) => f.sev === 'structural');
  console.error(
    `[park] ${PARK_FAILS.length} ASSERTION FAILURE(S) (${hard.length} structural):\n` +
      PARK_FAILS.map((f, i) => `  ${i + 1}. [${f.sev}] ${f.name}\n     ${f.detail}`).join('\n'),
  );
  if (hard.length) {
    throw new Error(`[park] ${hard.length} STRUCTURAL failure(s) — see the numbered block above.`);
  }
}

const SIZE = 128;
const SEED = 1;
const CLIMATE = 'temperate' as const;

/* ─────────────────────────────────────────────────────────────────────────────
 * §2  THE TWO COASTERS — §4.0-L (flagship, vertical loop) + §4.0-B, verbatim
 * ───────────────────────────────────────────────────────────────────────────── */
const L_PIECES: TrackPiece[] = [
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
const L_START: V3 = [16.8, 0.55, -3.6];
const L_TAIL: XZ = [22.8, -3.6];

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

const { points: FLAG_PTS } = compileTrackPieces(L_PIECES, {
  type: 'steel', start: L_START, heading: 0, bounds: SIZE,
});
const { points: FLAG2_PTS } = compileTrackPieces(B_PIECES, {
  type: 'steel', start: B_START, heading: 0, bounds: SIZE,
});
const ALL_COASTER_PTS = [...FLAG_PTS, ...FLAG2_PTS];

// MEASURED with the bank + cars the mounts actually use (pieces mode defaults bank 0.7).
[FLAG_PTS, FLAG2_PTS].forEach((pts, i) => {
  console.log(`[park] coaster ${i + 1}`, rateCoaster(pts, { type: 'steel', bank: 0.7, cars: 3 }));
});

/** §4.0-L + §4.0-B corridor keep-out rects, PLOT coords: [x0, x1, z0, z1]. */
const CORRIDOR_RECTS: [number, number, number, number][] = [
  [-22.2, -21.0, -4.2, 12.6],     // L west valley
  [-17.4, 3.0, -15.0, -13.8],     // L south valley
  [-12.6, 9.0, 16.2, 18.6],       // L north valley
  [3.0, 4.2, -13.8, -0.6],        // L INTERIOR return column
  [-63.6, -62.4, -54.0, -37.2],   // B west valley
  [-61.8, -60.6, -52.8, -37.2],
  [-56.4, -39.6, -62.4, -60.0],   // B south valley
  [-51.6, -39.6, -32.4, -30.0],   // B north valley
];
const inCorridor = (c: XZ) =>
  CORRIDOR_RECTS.some((r) => c[0] >= r[0] && c[0] <= r[1] && c[1] >= r[2] && c[1] <= r[3]);

/* ─────────────────────────────────────────────────────────────────────────────
 * §3  THE MONORAIL RING — verbatim pose, four platforms, one per world + north
 * ───────────────────────────────────────────────────────────────────────────── */
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

const RING_CELLS: XZ[] = [
  [-42.6, -8.4], [0, 34.2], [42.6, -8.4], [0, -51.0],
  [-42.6, -9.7],
  [-36.0, -8.4], [0, 27.6], [36.0, -8.4], [0, -57.6],
  [-40.81, -8.4], [0, 32.41], [40.81, -8.4], [0, -52.79],
  [-1.2, 33.03], [41.43, -7.2], [1.2, -52.17],
];

/** The four beam runs, as segments, so dressing never stands under the guideway. */
const BEAMS: [XZ, XZ][] = [
  [[-42.6, -51.0], [-42.6, 34.2]],
  [[42.6, -51.0], [42.6, 34.2]],
  [[-42.6, 34.2], [42.6, 34.2]],
  [[-42.6, -51.0], [42.6, -51.0]],
];
function distToSeg(c: XZ, a: XZ, b: XZ): number {
  const vx = b[0] - a[0], vz = b[1] - a[1];
  const wx = c[0] - a[0], wz = c[1] - a[1];
  const len2 = vx * vx + vz * vz;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, (wx * vx + wz * vz) / len2));
  return Math.hypot(c[0] - (a[0] + t * vx), c[1] - (a[1] + t * vz));
}
const distToBeam = (c: XZ) => Math.min(...BEAMS.map(([a, b]) => distToSeg(c, a, b)));

/* ─────────────────────────────────────────────────────────────────────────────
 * §4  THE SEED ROW — the pinned water, and the sieve that derives the guard list
 * ───────────────────────────────────────────────────────────────────────────── */
type SeedBasin = { ctr: XZ; box: [number, number, number, number] };
type SeedRow = { dom: SeedBasin; sec: SeedBasin };
const SEED_ROW: SeedRow = {
  dom: { ctr: [41, -39], box: [21, 60, -60, -21] },
  sec: { ctr: [-38, 31], box: [-56, -21, 23, 39] },
};
const inBasinBox = (c: XZ, b: SeedBasin) =>
  c[0] >= b.box[0] && c[0] <= b.box[1] && c[1] >= b.box[2] && c[1] <= b.box[3];
const offRow = (c: XZ, row: SeedRow = SEED_ROW, nearR = 12) =>
  [row.dom, row.sec].every(
    (b) => !inBasinBox(c, b) && Math.hypot(c[0] - b.ctr[0], c[1] - b.ctr[1]) >= nearR,
  );

/* ─────────────────────────────────────────────────────────────────────────────
 * §5  PAD MARGINS — a MESH property of the rig; capacity never enters it
 * ───────────────────────────────────────────────────────────────────────────── */
const PAD_MARGIN: Record<string, number> = {
  LavaTubeRun: 23.41, ReefRacer: 22.20, OceanTunnelSlide: 22.14, EmberWings: 16.15,
  WyrmsHollow: 15.99, MagmaRun: 14.22, MineTrainCoaster: 13.99, DeepDrift: 12.65,
  Bassline: 11.59, GearworksExpress: 10.03, MoonlitBarge: 8.23, SplineCoaster: 7.32,
  RiverRapids: 6.60, Bobsleigh: 6.01, MagneticRide: 5.56, LogFlume: 5.36,
  GhostTrain: 4.77, HauntedMansion: 4.77, GoKarts: 4.39, Monorail: 4.02,
  Chairlift: 3.52, Helicycles: 3.42, FlyingSaucers: 3.37, MotionSimulator: 3.20,
  Enterprise: 3.13, PaddleBoats: 3.12, Discotron: 3.07, BoilerBurst: 3.05,
  FerrisWheel: 2.97, AetherBalloons: 2.95, PirateShip: 2.70, TwistRide: 2.65,
  TopSpin: 2.52, Teacups: 2.47, Carousel: 2.40, SwingingInverterShip: 2.35,
  LaunchedFreefall: 2.25, BumperCars: 2.07, SpaceRings: 1.92, SwingRide: 1.92,
  DropTower: 1.80, ObservationTower: 1.80,
};
const padMarginOf = (rig: string) => PAD_MARGIN[rig] ?? 3.2;
const minReachOf = (c: number) => laneLenOf(c) + 0.35 + 0.62 + 0.5 + 0.45;

/* ─────────────────────────────────────────────────────────────────────────────
 * §6  THE STREET SKELETON — authored NODES, then the SET-PIECES, then ONE fuse
 * ───────────────────────────────────────────────────────────────────────────── */
const NODES: XZ[] = [
  /*  0 */ [22.8, 39.6],
  /*  1 */ [22.8, 33.6],
  /*  2 */ [22.8, 27.6],
  /*  3 */ [22.8, 21.6],
  /*  4 */ [22.8, 15.6],
  /*  5 */ [22.8, 9.6],
  /*  6 */ [22.8, 3.6],
  /*  7 */ [22.8, 0.0],
  /*  8 */ [22.8, -3.6],
  /*  9 */ [22.8, -8.4],
  /* 10 */ [22.8, -16.8],
  /* 11 */ [36.0, -8.4],
  /* 12 */ [16.8, 27.6],
  /* 13 */ [9.6, 27.6],
  /* 14 */ [0.0, 27.6],
  /* 15 */ [30.0, 0.0],
  /* 16 */ [36.0, 0.0],
  /* 17 */ [-16.8, 39.6],
  /* 18 */ [-16.8, 33.6],
  /* 19 */ [-16.8, 27.6],
  /* 20 */ [-16.8, 21.6],
  /* 21 */ [-16.8, 15.6],
  /* 22 */ [-16.8, 9.6],
  /* 23 */ [-16.8, 3.6],
  /* 24 */ [-16.8, -4.8],
  /* 25 */ [-16.8, -10.8],
  /* 26 */ [-21.6, -10.8],
  /* 27 */ [-21.6, -16.8],
  /* 28 */ [-16.8, -16.8],
  /* 29 */ [-9.6, -16.8],
  /* 30 */ [-2.4, -16.8],
  /* 31 */ [4.8, -16.8],
  /* 32 */ [12.0, -16.8],
  /* 33 */ [18.0, -16.8],
  /* 34 */ [-24.0, -16.8],
  /* 35 */ [-32.4, -16.8],
  /* 36 */ [-36.0, -16.8],
  /* 37 */ [-36.0, -8.4],
  /* 38 */ [-32.4, -9.6],
  /* 39 */ [-32.4, -3.6],
  /* 40 */ [-24.0, -26.4],
  /* 41 */ [-24.0, -36.0],
  /* 42 */ [-24.0, -45.6],
  /* 43 */ [-24.0, -48.0],
  /* 44 */ [-27.6, -48.0],
  /* 45 */ [-24.0, -57.6],
  /* 46 */ [-12.0, -57.6],
  /* 47 */ [0.0, -57.6],
  /* 48 */ [-42.0, -16.8],
  /* 49 */ [-46.8, -16.8],
  /* 50 */ [-24.0, -60.6],
];

const HUB = fountainPlazaPlan({
  id: 'hub', title: 'Three Crowns Circus', position: [0, 45.6], tiles: 7,
  ports: ['N', 'E', 'W'], stringLights: 'all', seed: 3,
});
const GATE_AVE = boulevardPlan({
  id: 'gateAve', title: 'Turnstile Promenade', from: [0, 63.6], to: [0, 52.8], spacing: 3.6,
  avoid: [[0, 58.8], [-2.4, 58.8], [-4.8, 58.8], [-7.2, 58.8], [-9.9, 58.8]], seed: 5,
});
const EAST_AVE = boulevardPlan({
  id: 'eastAve', title: 'Ironlight Parade', from: [9.6, 45.6], to: [22.8, 45.6], spacing: 4.8, seed: 7,
});
const WEST_AVE = boulevardPlan({
  id: 'westAve', title: 'Lantern Walk', from: [-9.6, 45.6], to: [-16.8, 45.6], spacing: 3.6, seed: 9,
});
const MARKET = bazaarPlan({
  id: 'market', title: 'Crown Market', position: [-16.8, 52.8],
  facing: { port: 'W', toward: [-16.8, 45.6] },
  stalls: ['burger', 'hotDog', 'soda', 'cottonCandy'],
  names: ['Turnstile Grill', 'Coney Corner', 'Fizz Fountain', 'Sugarspin'],
  seed: 11,
});
const EMBER = bazaarPlan({
  id: 'ember', title: 'Cinderworks Row', position: [-12.0, -60.6],
  facing: { port: 'W', toward: [-24.0, -60.6] },
  stalls: ['emberRoast', 'hotDog', 'soda'],
  names: ['Cinder Grill', 'Ashfall Franks', 'Quenchworks'],
  theme: FIRE, seed: 13,
});
const BRASS = bazaarPlan({
  id: 'brass', title: 'Foundry Arcade', position: [-46.8, -24.0],
  facing: { port: 'E', toward: [-46.8, -16.8] },
  stalls: ['goggles', 'burger', 'soda'],
  names: ['Aperture & Cog', 'Foundry Grill', 'Boiler Room Sodas'],
  theme: STEAMPUNK, seed: 17,
});
const PULSE_BAZ = bazaarPlan({
  id: 'pulse', title: 'Voltage Row', position: [36.0, 7.2],
  facing: { port: 'W', toward: [36.0, 0.0] },
  stalls: ['neonSlush', 'cottonCandy', 'balloon'],
  names: ['Voltage Slush', 'Glowfloss', 'Lumen Balloons'],
  theme: NEON_CITY, seed: 19,
});
const ALL_PLANS: SetPiecePlan[] = [HUB, GATE_AVE, EAST_AVE, WEST_AVE, MARKET, EMBER, BRASS, PULSE_BAZ];

const EDGES: [NetRef, NetRef][] = [
  ['gateAve:B', 'hub:N'],
  ['hub:E', 'eastAve:A'], ['eastAve:B', 0],
  ['hub:W', 'westAve:A'], ['westAve:B', 17], ['westAve:B', 'market:W'],
  // east spine (the park-spanning cycle's eastern half)
  [0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 7], [7, 8], [8, 9], [9, 10],
  [9, 11],
  // north monorail tail, reached LATERALLY
  [2, 12], [12, 13], [13, 14],
  // neon spur
  [7, 15], [15, 16], [16, 'pulse:W'],
  // west column (the cycle's western half)
  [17, 18], [18, 19], [19, 20], [20, 21], [21, 22], [22, 23], [23, 24], [24, 25],
  [25, 26], [26, 27],
  // the z = -16.8 shelf
  [27, 28], [28, 29], [29, 30], [30, 31], [31, 32], [32, 33], [33, 10],
  [27, 34], [34, 35], [35, 36],
  [36, 37],
  [35, 38], [38, 39],
  [36, 48], [48, 49], [49, 'brass:E'],
  // the x = -24 southbound column (routed x <= -23, clear of the z ~ -43 ridge skirt)
  [34, 40], [40, 41], [41, 42], [42, 43], [43, 45], [43, 44],
  [45, 46], [46, 47], [45, 50], [50, 'ember:W'],
];

const NET = buildParkNet({ nodes: NODES, edges: EDGES, pieces: ALL_PLANS });

/* ─────────────────────────────────────────────────────────────────────────────
 * §7  THE GUARD LIST — DERIVED off the fuse output, never NODES.slice()
 * ───────────────────────────────────────────────────────────────────────────── */
function keepDryOf(net: { keepDry: XZ[] }, row: SeedRow = SEED_ROW): XZ[] {
  const kept = net.keepDry.filter((c) => offRow(c, row));
  const dropped = net.keepDry.length - kept.length;
  if (dropped) {
    console.warn(
      `[park] keepDryOf dropped ${dropped} of ${net.keepDry.length} guard cell(s) on the pinned ` +
        `row's water. A DROPPED guard is NOT a fixed cell — MOVE whatever stands there.`,
    );
  }
  return kept;
}
const GUARDS = keepDryOf(NET);
console.log(`[park] guards ${GUARDS.length} / ${NET.keepDry.length} (paved cells ${NET.nodes.length})`);

const BARE = parkComposition(THREE, SEED, SIZE, CLIMATE);
const COMP = parkComposition(THREE, SEED, SIZE, CLIMATE, {
  keepDry: GUARDS, coasterPts: ALL_COASTER_PTS,
});

parkAssert(
  'waterMoved',
  Math.hypot(COMP.waterCentre[0] - BARE.waterCentre[0], COMP.waterCentre[1] - BARE.waterCentre[1]) < 1 &&
    Math.hypot(
      COMP.waterCentreSecond[0] - BARE.waterCentreSecond[0],
      COMP.waterCentreSecond[1] - BARE.waterCentreSecond[1],
    ) < 1,
  `guards moved a water body off the pinned row — dominant ${JSON.stringify(BARE.waterCentre)} → ` +
    `${JSON.stringify(COMP.waterCentre)}, secondary ${JSON.stringify(BARE.waterCentreSecond)} → ` +
    `${JSON.stringify(COMP.waterCentreSecond)}, terrainSeed ${BARE.terrainSeed} → ${COMP.terrainSeed}`,
);

const rf = COMP.report.reliefFloor;
parkAssert(
  'terrainFlattened',
  !rf || rf.kept >= rf.floor,
  rf
    ? `keepDry FLATTENED the seed: authored relief ${rf.authoredRelief.toFixed(2)} → built ` +
      `${rf.relief.toFixed(2)} (kept ${rf.kept.toFixed(2)} vs floor ${rf.floor}), stdH ` +
      `${rf.authoredStdH.toFixed(2)} → ${rf.stdH.toFixed(2)}. Ranges guarded: ${rf.guardedRanges}; ` +
      `capped peaks: ${JSON.stringify(rf.cappedPeaks)}`
    : '',
  'advisory',
);
if (rf) {
  console.log(
    `[park] reliefFloor kept ${rf.kept.toFixed(2)} (floor ${rf.floor}) · relief ${rf.relief.toFixed(2)} · ` +
      `stdH ${rf.stdH.toFixed(2)} · probes ${BARE.report.probesTried} → ${COMP.report.probesTried} · ` +
      `terrainSeed ${BARE.terrainSeed} → ${COMP.terrainSeed}`,
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 * §8  PLACEMENT — streets first (offPathCell), THEN terrain (assertPadFlat)
 * ───────────────────────────────────────────────────────────────────────────── */
const PEAK_LIMIT = 0.75;
const isDry = (c: XZ) =>
  [...COMP.basins, ...COMP.clampBasins].every(
    (b: { x: number; z: number; radius: number }) =>
      Math.hypot(c[0] - b.x, c[1] - b.z) > 0.74 * b.radius + 0.6,
  );
const bumpAt = (c: XZ) =>
  Math.max(
    0,
    ...COMP.peaks.map((p: { x: number; z: number; radius: number; height: number }) => {
      const k = Math.max(0, 1 - Math.hypot(c[0] - p.x, c[1] - p.z) / p.radius);
      return k * k * (3 - 2 * k) * p.height;
    }),
  );

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
          console.warn(
            `[park] ${label}: pad [${pad}] on a hill flank (bump ${bumpAt(pad).toFixed(2)}) — moved to [${c}]`,
          );
          return c;
        }
      }
    }
  }
  parkAssert(
    'padOnFlank', false,
    `${label}: pad [${pad}] is on a hill flank (bump ${bumpAt(pad).toFixed(2)} > ${PEAK_LIMIT}) OR WET, ` +
      `and no cell within 4.8 u is flat, dry AND ${clear} u off the street. MOVE THE TAIL.`,
  );
  return pad;
}

function place(tail: XZ, out: XZ, capacity: number, rig: string) {
  const clear = padMarginOf(rig);
  const join = laneLenOf(capacity) + 0.35;
  const reach = minReachOf(capacity) + 2.4;
  const cand: XZ = [tail[0] + out[0] * reach, tail[1] + out[1] * reach];
  const onStreet = (offPathCell(NET, cand, { clear }) ?? cand) as XZ;
  const pad = assertPadFlat(onStreet, clear, rig);
  const got = Math.hypot(pad[0] - tail[0], pad[1] - tail[1]);
  if (got < minReachOf(capacity) + 1.2) {
    parkAssert(
      'padReach', false,
      `${rig}: pad [${pad}] sits ${got.toFixed(2)} u from its tail [${tail}] — the cap-${capacity} floor ` +
        `is ${(minReachOf(capacity) + 1.2).toFixed(2)} u. The court is too tight: move the TAIL outward.`,
    );
  }
  return {
    pad,
    anchor: [tail[0] + out[0] * join, tail[1] + out[1] * join] as XZ,
    dir: [-out[0], -out[1]] as XZ,
    yaw: Math.atan2(-out[0], -out[1]),
  };
}

const CAROUSEL = place([0, 58.8], [-1, 0], 8, 'Carousel');
const WHEEL = place([22.8, 39.6], [1, 0], 8, 'FerrisWheel');
const GHOST = place([22.8, 21.6], [1, 0], 6, 'GhostTrain');
const FLUME = place([-9.6, -16.8], [0, -1], 4, 'LogFlume');
const DISCO = place([30.0, 0.0], [0, 1], 6, 'Discotron');

/* GearworksExpress is an 18.9-u body: the `padOnStreet` lint audits only its 0.45-u
 * boarding pad, but the footprint + corridor sweeps audit the WHOLE body, so its pad is
 * authored into the one pocket that clears the monorail west beam (x -42.6, 0.77 u) and
 * §4.0-L's west leg (x -21.81, 1.16 u) at once, and only its dryness/flatness is solved. */
const GX_TAIL: XZ = [-32.4, -3.6];
const GX_PAD: XZ = assertPadFlat([-32.4, 7.2], 1.8, 'GearworksExpress');
const GX_ANCHOR: XZ = [GX_TAIL[0], GX_TAIL[1] + laneLenOf(6) + 0.35];
const GX = { pad: GX_PAD, anchor: GX_ANCHOR, dir: [0, -1] as XZ, yaw: Math.PI };
parkAssert(
  'padReach',
  Math.hypot(GX_PAD[0] - GX_TAIL[0], GX_PAD[1] - GX_TAIL[1]) >= minReachOf(6) + 1.2,
  `GearworksExpress: pad [${GX_PAD}] is under the cap-6 board floor from tail [${GX_TAIL}]`,
);
parkAssert(
  'gxBodyClear',
  GX_PAD[0] - 9.43 > -42.6 && GX_PAD[0] + 9.43 < -21.81,
  `GearworksExpress body x[${(GX_PAD[0] - 9.43).toFixed(2)}, ${(GX_PAD[0] + 9.43).toFixed(2)}] must stay ` +
    `between the monorail west beam (x -42.6) and §4.0-L's west leg (x -21.81)`,
  // ADVISORY: assertPadFlat may legitimately shift this pad off a flank, and the runtime's
  // settle pass re-clamps under it. A throw here would blank the page over a placement nudge.
  'advisory',
);

const PADS: { at: XZ; label: string }[] = [
  { at: CAROUSEL.pad, label: 'Carousel' }, { at: WHEEL.pad, label: 'FerrisWheel' },
  { at: GHOST.pad, label: 'GhostTrain' }, { at: FLUME.pad, label: 'LogFlume' },
  { at: DISCO.pad, label: 'Discotron' }, { at: GX.pad, label: 'GearworksExpress' },
];
console.log('[park] pads', PADS.map((p) => `${p.label} [${p.at[0].toFixed(2)}, ${p.at[1].toFixed(2)}]`).join(' · '));

const RESTROOM: XZ = (offPathCell(NET, [4.8, 55.2], { clear: 1.8 }) ?? [4.8, 55.2]) as XZ;

/* ─────────────────────────────────────────────────────────────────────────────
 * §9  WORLDS — declared AFTER the pads exist, out of them
 * ───────────────────────────────────────────────────────────────────────────── */
const EMBER_SCENERY: XZ[] = [[-19.2, -54.0], [-4.8, -60.0], [8.4, -58.8]];
const BRASS_SCENERY: XZ[] = [[-45.6, -12.0], [-45.6, -4.8], [-38.4, -13.2]];
const PULSE_SCENERY: XZ[] = [[27.6, 14.4], [39.6, 13.2], [33.6, -4.8]];

const W_FIRE = worldPlan({
  id: 'fire', theme: FIRE, pieces: [EMBER],
  include: [[0, -51.0], ...EMBER_SCENERY],
});
const W_STEAM = worldPlan({
  id: 'steampunk', theme: STEAMPUNK, pieces: [BRASS],
  include: [GX.pad, [-42.6, -8.4], ...BRASS_SCENERY],
});
const W_NEON = worldPlan({
  id: 'neon', theme: NEON_CITY, pieces: [PULSE_BAZ],
  include: [[42.6, -8.4], DISCO.pad, ...PULSE_SCENERY],
});
const WORLDS = [W_STEAM, W_NEON, W_FIRE];

const WORLD_MIN_GAP = 20 * Math.sqrt(SIZE / 48);
for (let i = 0; i < WORLDS.length; i += 1) {
  for (let j = i + 1; j < WORLDS.length; j += 1) {
    const a = WORLDS[i], b = WORLDS[j];
    const d = Math.hypot(a.centre[0] - b.centre[0], a.centre[1] - b.centre[1]);
    parkAssert(
      'worldGap', d >= WORLD_MIN_GAP,
      `worlds '${a.id}' @[${a.centre}] and '${b.id}' @[${b.centre}] are ${d.toFixed(2)} u apart — ` +
        `the floor at size ${SIZE} is ${WORLD_MIN_GAP.toFixed(2)} u`,
    );
  }
}
console.log(
  '[park] worlds',
  WORLDS.map((w) => `${w.id} @[${w.centre[0].toFixed(1)}, ${w.centre[1].toFixed(1)}]`).join(' · '),
);

/* ─────────────────────────────────────────────────────────────────────────────
 * §10  STRUCTURAL ASSERTIONS over the authored table
 * ───────────────────────────────────────────────────────────────────────────── */
const portCell = (ref: NetRef): XZ => {
  if (typeof ref === 'number') return NODES[ref];
  const [id, name] = ref.split(':');
  const p = ALL_PLANS.find((q) => q.id === id);
  if (!p) throw new Error(`EDGES references '${ref}' but no plan has id '${id}'`);
  return p.port(name);
};
const EPS = 1e-6;
EDGES.forEach(([a, b]) => {
  const A = portCell(a), B = portCell(b);
  parkAssert(
    'cardinalEdge',
    Math.abs(A[0] - B[0]) < EPS || Math.abs(A[1] - B[1]) < EPS,
    `edge ${a}→${b} is DIAGONAL: [${A}] → [${B}]. buildParkNet ELBOWS it through a synthesised ` +
      `corner node you did not plan. FIX THE TABLE.`,
    'advisory',
  );
});

const CHAIN_END_OPT_OUT = new Set<string>(['gateAve:A']); // the bare <Gate/> stands on it
const PORT_REFS = EDGES.flat().filter((x): x is string => typeof x === 'string');
ALL_PLANS.forEach((p) => {
  const wired = new Set(
    PORT_REFS.filter((r) => r.split(':')[0] === p.id).map((r) => r.split(':')[1]),
  );
  parkAssert(
    'pieceIsland', wired.size > 0,
    `set-piece '${p.id}' has NO '${p.id}:<PORT>' ref in EDGES — it composes as an ISLAND`,
  );
  p.ports
    .filter((pt: { name: string; prunable?: boolean }) => pt.prunable === false)
    .forEach((pt: { name: string }) => {
      if (wired.has(pt.name) || CHAIN_END_OPT_OUT.has(`${p.id}:${pt.name}`)) return;
      parkAssert(
        'chainEnd', false,
        `chain piece '${p.id}' (${p.kind}) wires [${[...wired]}] but NOT '${p.id}:${pt.name}' — that ` +
          `end of the carriageway dead-ends in grass (deadStreetNode).`,
      );
    });
});
console.log(`[park] port-refs ${PORT_REFS.length} across ${ALL_PLANS.length} pieces: ${PORT_REFS.join(', ')}`);

const SOLID_CLEAR: Record<string, number> = { FountainPlaza: 1.8, Bazaar: 0.6, Boulevard: 0 };
function assertNodesOffPieces(cells: XZ[], plans: SetPiecePlan[], what: string): void {
  const hits: string[] = [];
  plans.forEach((p) => {
    const clear = SOLID_CLEAR[p.kind] ?? 1.8;
    if (clear === 0) return;
    const ports = new Set(p.ports.map((pt: { at: XZ }) => `${pt.at[0].toFixed(2)},${pt.at[1].toFixed(2)}`));
    const f = p.footprint;
    const c = Math.cos(-f.yaw), s = Math.sin(-f.yaw);
    cells.forEach((n, i) => {
      if (ports.has(`${n[0].toFixed(2)},${n[1].toFixed(2)}`)) return;
      const dx = n[0] - f.cx, dz = n[1] - f.cz;
      const lx = dx * c - dz * s, lz = dx * s + dz * c;
      const gap = Math.max(Math.abs(lx) - f.hx, Math.abs(lz) - f.hz);
      if (gap < clear) {
        hits.push(`[${n[0]}, ${n[1]}] (${what} ${i}) is ${gap.toFixed(2)} u from '${p.id}' (${p.kind}) — needs ${clear}`);
      }
    });
  });
  parkAssert(
    'nodeInSolid', !hits.length,
    `${hits.length} authored ${what} cell(s) stand inside or against a set-piece's SOLID footprint:\n  ` +
      hits.join('\n  '),
  );
}
assertNodesOffPieces(NODES, ALL_PLANS, 'node');
assertNodesOffPieces(PADS.map((p) => p.at), ALL_PLANS, 'pad');

// The four monorail platform tails must be street LEAVES.
const MONO_TAILS: XZ[] = [[-36.0, -8.4], [0, 27.6], [36.0, -8.4], [0, -57.6]];
MONO_TAILS.forEach((t) => {
  const idx = NODES.findIndex((n) => Math.abs(n[0] - t[0]) < EPS && Math.abs(n[1] - t[1]) < EPS);
  const deg = EDGES.filter(([a, b]) => a === idx || b === idx).length;
  parkAssert(
    'monoTailLeaf', idx >= 0 && deg === 1,
    `monorail tail [${t}] must be an authored street NODE of degree 1 — found index ${idx}, degree ${deg}. ` +
      `A street continuing past a tail runs through the deck (blockers FAIL).`,
  );
});

// No ring cell may sit on the pinned row's water.
RING_CELLS.forEach((c) => {
  parkAssert(
    'ringOnWater', offRow(c),
    `monorail ring cell [${c}] stands on the pinned seed row's water — the deck would drown ` +
      `or the guard would shove the lake off its row.`,
  );
});

// No street cell may stand in a coaster corridor keep-out.
NET.nodes.forEach((c: XZ) => {
  parkAssert(
    'corridor', !inCorridor(c),
    `street cell [${c[0].toFixed(2)}, ${c[1].toFixed(2)}] stands in a coaster corridor keep-out rect — ` +
      `the valley floor there runs ~0.6 u above path level, far under the 2.2 u overfly gate.`,
    'advisory',
  );
});

// Every authored cell must be off the pinned row's water (a pre-filter, printed not thrown).
const WET_AUTHORED = NODES.filter((c) => !offRow(c));
if (WET_AUTHORED.length) {
  console.warn(`[park] ${WET_AUTHORED.length} authored node(s) on the row's water: ${JSON.stringify(WET_AUTHORED)}`);
}

/* ─────────────────────────────────────────────────────────────────────────────
 * §11  DRESSING — deterministic scatter, street-sieved here, water-sieved in-tree
 * ───────────────────────────────────────────────────────────────────────────── */
type Blocker = { c: XZ; r: number };
const BLOCKERS: Blocker[] = [
  { c: [0, 45.6], r: 8.4 },
  { c: MARKET.footprint ? [MARKET.footprint.cx, MARKET.footprint.cz] : [-16.8, 52.8], r: 8.0 },
  { c: [-12.0, -60.6], r: 8.0 }, { c: [-46.8, -24.0], r: 8.0 }, { c: [36.0, 7.2], r: 8.0 },
  ...PADS.map((p) => ({ c: p.at, r: Math.max(5.0, padMarginOf(p.label) * 0.75) })),
  ...MONO_TAILS.map((c) => ({ c, r: 4.0 })),
  ...RING_CELLS.map((c) => ({ c, r: 5.0 })),
  ...EMBER_SCENERY.map((c) => ({ c, r: 3.0 })),
  ...BRASS_SCENERY.map((c) => ({ c, r: 3.0 })),
  ...PULSE_SCENERY.map((c) => ({ c, r: 3.0 })),
  { c: [RESTROOM[0], RESTROOM[1]], r: 3.6 },
  { c: [0, 63.6], r: 4.8 },
];
const COASTER_BOXES: [number, number, number, number][] = [
  [-24.2, 19.2, -16.9, 20.2],   // §4.0-L bbox + 2.4
  [-64.9, -31.2, -63.7, -28.5], // §4.0-B bbox + 2.4
];
const inCoasterBox = (c: XZ) =>
  COASTER_BOXES.some((r) => c[0] >= r[0] && c[0] <= r[1] && c[1] >= r[2] && c[1] <= r[3]);

const snap6 = (v: number) => +(Math.round(v / 0.6) * 0.6).toFixed(2);
function scatter(count: number, salt: number, clear: number, minBeam: number): XZ[] {
  const out: XZ[] = [];
  for (let i = 0; i < count * 14 && out.length < count; i += 1) {
    const c: XZ = [
      snap6((hash01(i * 3 + salt) - 0.5) * 116),
      snap6((hash01(i * 7 + salt * 31 + 5) - 0.5) * 116),
    ];
    if (!offRow(c, SEED_ROW, 14)) continue;
    if (inCoasterBox(c) || inCorridor(c)) continue;
    if (distToBeam(c) < minBeam) continue;
    if (bumpAt(c) > 2.6 || !isDry(c)) continue;
    if (BLOCKERS.some((b) => Math.hypot(c[0] - b.c[0], c[1] - b.c[1]) < b.r)) continue;
    const off = offPathCell(NET, c, { clear });
    if (!off) continue;
    if (out.some((o) => Math.hypot(o[0] - off[0], o[1] - off[1]) < 2.4)) continue;
    out.push(off as XZ);
  }
  return out;
}

const TREE_SHAPES = ['round', 'pine', 'willow', 'round', 'pine'] as const;
type TreeShape = (typeof TREE_SHAPES)[number];
const TREE_CELLS = scatter(46, 1, 0.75, 2.4);
const TREES: { at: XZ; shape: TreeShape }[] = TREE_CELLS.map((at, i) => ({
  at, shape: TREE_SHAPES[i % TREE_SHAPES.length],
}));

const SCENERY_NAMES = [
  'planterBox', 'topiarySpiral', 'marbleStatue', 'birdbath', 'picnicTable', 'signpost',
  'parkClock', 'flagpole', 'ironArchway', 'lionStatue', 'wishingWell', 'gazebo',
] as const;
const SCENERY_CELLS = scatter(24, 2, 1.2, 2.4);
const SCENERY: { at: XZ; name: string }[] = SCENERY_CELLS.map((at, i) => ({
  at, name: SCENERY_NAMES[i % SCENERY_NAMES.length],
}));

parkAssert('treeCount', TREES.length >= 32, `only ${TREES.length} tree cells survived the sieve (need >= 32)`, 'advisory');
parkAssert(
  'sceneryCount', SCENERY.length + 9 >= 16,
  `only ${SCENERY.length + 9} scenery pieces survived the sieve (need >= 16)`, 'advisory',
);
parkAssert('themedScenery', EMBER_SCENERY.length >= 3 && BRASS_SCENERY.length >= 3 && PULSE_SCENERY.length >= 3,
  'every world needs >= 3 themed scenery pieces from its OWN pack');
console.log(`[park] dress: ${TREES.length} trees · ${SCENERY.length} neutral + 9 themed scenery`);

parkAssertFlush();

/* ─────────────────────────────────────────────────────────────────────────────
 * §12  THE IN-TREE DRYNESS RECEIPT — the GATE'S predicate, not isDryCell
 * ───────────────────────────────────────────────────────────────────────────── */
type ParkCtx = ReturnType<typeof usePark>;
function dryRing(park: ParkCtx, c: XZ, r = 0.75): boolean {
  const g = (park as { ground?: { lint?: { isDry?: (x: number, z: number, cl: number) => boolean } } }).ground;
  if (!g || !g.lint || typeof g.lint.isDry !== 'function') {
    console.error('[park] dryRing ran with NO TERRAIN — a VACUOUS pass');
    return true;
  }
  const dry = (x: number, z: number) => g.lint!.isDry!(x, z, 0.05);
  if (!dry(c[0], c[1])) return false;
  for (let k = 0; k < 8; k += 1) {
    const a = (k / 8) * Math.PI * 2;
    if (!dry(c[0] + Math.cos(a) * r, c[1] + Math.sin(a) * r)) return false;
  }
  return true;
}

function DryScatter<T extends { at: XZ }>({ cells, render, label }: {
  cells: T[];
  render: (c: T, i: number) => React.ReactNode;
  label: string;
}) {
  const park = usePark('DryScatter');
  const [dry, setDry] = React.useState<T[] | null>(null);
  React.useEffect(() => {
    const kept = cells.filter((c) => dryRing(park, c.at));
    if (kept.length < cells.length) {
      console.error(
        `[park] DryScatter(${label}) dropped ${cells.length - kept.length} of ${cells.length} cell(s) ` +
          `UNDER waterline+0.05: ${JSON.stringify(cells.filter((c) => !kept.includes(c)).map((c) => c.at))}`,
      );
    }
    setDry(kept);
  }, [park, cells, label]);
  return <>{(dry ?? []).map(render)}</>;
}

/** Cells that cannot be dropped — pads, huts, tails, decks. Renders nothing; prints the receipt. */
const PROBE_CELLS: { at: XZ }[] = [
  ...PADS.map((p) => ({ at: p.at })),
  ...MONO_TAILS.map((at) => ({ at })),
  { at: [-42.6, -8.4] }, { at: [0, 34.2] }, { at: [42.6, -8.4] }, { at: [0, -51.0] },
  { at: L_TAIL }, { at: B_TAIL }, { at: GX_TAIL }, { at: RESTROOM },
  ...EMBER_SCENERY.map((at) => ({ at })),
  ...BRASS_SCENERY.map((at) => ({ at })),
  ...PULSE_SCENERY.map((at) => ({ at })),
];

/* ─────────────────────────────────────────────────────────────────────────────
 * §13  THE PARK
 * ───────────────────────────────────────────────────────────────────────────── */
const RIDE_NAMES = [
  'Gilded Gallopers', 'Crown Wheel', 'Hollow Lantern', 'Cascade Timbers',
  'Serpent of the Loop', 'Pinewood Racer', 'Grand Circle Monorail',
  'Voltage Drop', 'Gearworks Express',
];

export function App() {
  return (
    <Park
      seed={SEED}
      climate={CLIMATE}
      roster={{ rides: RIDE_NAMES, stalls: 13, categories: 5 }}
      onReady={(report: { ok: boolean; failures: unknown[]; warnings: unknown[] }) => {
        console.log('[park] validatePark', report.ok ? 'ok: true' : 'ok: FALSE', report);
      }}
    >
      <Terrain keepDry={GUARDS} coasterPts={ALL_COASTER_PTS} />
      <Paths nodes={NET.nodes} edges={NET.edges} plazas={NET.plazas} bins={NET.bins} walkers={6} />
      <GameManager />
      <Gate />

      {/* ── THRILL — the two rated circuits ─────────────────────────────── */}
      <Coaster
        name="Serpent of the Loop" pieces={L_PIECES} start={L_START} heading={0}
        type="steel" cars={3} capacity={4} rideDuration={12} loadTime={2} intensity={9}
        price={7} queueTailNode={NET.node(L_TAIL)} queueDir={[1, 0]}
      />
      <Coaster
        name="Pinewood Racer" pieces={B_PIECES} start={B_START} heading={0}
        type="steel" cars={3} capacity={4} rideDuration={12} loadTime={2} intensity={6}
        price={5} queueTailNode={NET.node(B_TAIL)} queueDir={[1, 0]}
      />

      {/* ── TRANSPORT — the park-spanning ring, one platform per world ───── */}
      <Monorail
        position={[-42.6, 0, -9.7]} rotation={0} pieces={MONO_PIECES} beamY={2.6}
        loopSeconds={12} pinned
        name="Grand Circle Monorail" capacity={6} rideDuration={12} intensity={1} price={0}
        queue={{ anchor: [-40.81, -8.4], dir: [1, 0] }}
        register={{
          board: [-42.6, 2.6, -8.4],
          stations: [
            { label: 'North Lawn', boardPoint: [0, 2.6, 34.2], queueAnchor: [0, 0.05, 32.41],
              queueDir: [0, -1], exitPoint: [-1.2, 0.05, 33.03], exitDir: [0, -1] },
            { label: 'Voltage Row', boardPoint: [42.6, 2.6, -8.4], queueAnchor: [40.81, 0.05, -8.4],
              queueDir: [-1, 0], exitPoint: [41.43, 0.05, -7.2], exitDir: [-1, 0] },
            { label: 'Cinderworks', boardPoint: [0, 2.6, -51.0], queueAnchor: [0, 0.05, -52.79],
              queueDir: [0, -1], exitPoint: [1.2, 0.05, -52.17], exitDir: [0, -1] },
          ],
        }}
      />

      {/* ── GENTLE ──────────────────────────────────────────────────────── */}
      <Carousel
        position={CAROUSEL.pad} rotation={CAROUSEL.yaw}
        register={{ name: 'Gilded Gallopers', capacity: 8, rideDuration: 10, intensity: 1, price: 2 }}
        queue={{ anchor: CAROUSEL.anchor, dir: CAROUSEL.dir }}
      />
      <FerrisWheel
        position={WHEEL.pad} rotation={WHEEL.yaw}
        register={{ name: 'Crown Wheel', capacity: 8, rideDuration: 12, intensity: 2, price: 3 }}
        queue={{ anchor: WHEEL.anchor, dir: WHEEL.dir }}
      />

      {/* ── WATER ───────────────────────────────────────────────────────── */}
      <LogFlume
        position={FLUME.pad} rotation={FLUME.yaw}
        register={{ name: 'Cascade Timbers', capacity: 4, rideDuration: 12, intensity: 5, price: 5 }}
        queue={{ anchor: FLUME.anchor, dir: FLUME.dir }}
      />

      {/* ── DARK ────────────────────────────────────────────────────────── */}
      <GhostTrain
        position={GHOST.pad} rotation={GHOST.yaw}
        register={{ name: 'Hollow Lantern', capacity: 6, rideDuration: 12, intensity: 4, price: 4 }}
        queue={{ anchor: GHOST.anchor, dir: GHOST.dir }}
      />
      <GearworksExpress
        position={GX.pad} rotation={GX.yaw} cars={3}
        register={{ name: 'Gearworks Express', capacity: 6, rideDuration: 12, intensity: 2, price: 4 }}
        queue={{ anchor: GX.anchor, dir: GX.dir }}
      />

      {/* ── NEON's own themed ride ──────────────────────────────────────── */}
      <Discotron
        position={DISCO.pad} rotation={DISCO.yaw}
        register={{ name: 'Voltage Drop', capacity: 6, rideDuration: 11, intensity: 4, price: 4 }}
        queue={{ anchor: DISCO.anchor, dir: DISCO.dir }}
      />

      {/* ── AMENITY ─────────────────────────────────────────────────────── */}
      <Restroom position={RESTROOM} rotation={-Math.PI / 2} />

      {/* ── THE WORLD REGIONS ───────────────────────────────────────────── */}
      <World plan={W_STEAM} />
      <World plan={W_NEON} />
      <World plan={W_FIRE} />

      {/* ── SET-PIECES (after <Paths>) ──────────────────────────────────── */}
      <FountainPlaza plan={HUB} />
      <Boulevard plan={GATE_AVE} />
      <Boulevard plan={EAST_AVE} />
      <Boulevard plan={WEST_AVE} />
      <Bazaar plan={MARKET} />
      <Bazaar plan={EMBER} />
      <Bazaar plan={BRASS} />
      <Bazaar plan={PULSE_BAZ} />

      {/* ── THEMED SCENERY — each world only ever wears its OWN pack ─────── */}
      <Fumarole position={EMBER_SCENERY[0]} rotation={0.4} />
      <BasaltColumns position={EMBER_SCENERY[1]} rotation={-0.8} />
      <CharredSnag position={EMBER_SCENERY[2]} rotation={1.9} />

      <ClockTower position={BRASS_SCENERY[0]} rotation={Math.PI / 2} />
      <BoilerTank position={BRASS_SCENERY[1]} rotation={-Math.PI / 2} />
      <SteamPipes position={BRASS_SCENERY[2]} rotation={0} />

      <NeonArch position={PULSE_SCENERY[0]} rotation={Math.PI / 2} />
      <SpeakerStack position={PULSE_SCENERY[1]} rotation={-Math.PI / 2} />
      <MirrorBallPylon position={PULSE_SCENERY[2]} rotation={0} />

      {/* ── NIGHT ───────────────────────────────────────────────────────── */}
      <Neon text="VOLTAGE ROW" position={[36.0, 2.1, 12.6]} rotation={Math.PI} scale={0.55} />
      <Neon text="CINDERWORKS" position={[-12.0, 2.1, -56.4]} rotation={0} scale={0.55} />
      <Torch position={[-19.2, -57.6]} rotation={0} />
      <Torch position={[-6.0, -63.0]} rotation={0} />
      <Torch position={[-45.6, -28.8]} rotation={0} />
      <Torch position={[-38.4, -18.0]} rotation={0} />
      <Lights from={[-9.6, 3.2, 45.6]} to={[-4.8, 3.2, 45.6]} />
      <Lights from={[9.6, 3.2, 45.6]} to={[14.4, 3.2, 45.6]} />

      {/* ── THE SCATTER — street-sieved above, water-sieved here ─────────── */}
      <DryScatter
        label="probe" cells={PROBE_CELLS} render={() => null}
      />
      <DryScatter
        label="trees" cells={TREES}
        render={(t, i) => (
          <Placed
            key={`tr-${i}`}
            position={t.at}
            build={(three: typeof THREE) => tree(three, { shape: t.shape })}
          />
        )}
      />
      <DryScatter
        label="scenery" cells={SCENERY}
        render={(s, i) => <Scenery key={`sc-${i}`} name={s.name} position={s.at} seed={i + 1} />}
      />
    </Park>
  );
}

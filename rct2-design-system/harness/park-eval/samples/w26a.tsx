/* ═══ AURORA HOLLOW — §0 PRE-FLIGHT ═══════════════════════════════════════════════════
 * SIZE   128 (default, prop omitted)
 * SEED   1 / temperate — dominant lake ctr (41, -39) box x[21,60] z[-60,-21]  [PRE-keepDry]
 *        secondary ctr (-38, 31) box x[-56,-21] z[23,39]
 *        RING WATER WALK: all 16 monorail ring cells vs BOTH bodies' boxes + 12 u centre
 *        discs — W deck (-42.6,-8.4) 39.7 u from the secondary ctr, E deck (42.6,-8.4)
 *        30.6 u from the dominant ctr, N deck (0,34.2) 38.1 u, S deck (0,-51) 24.6 u;
 *        no ring cell inside either box ✓ (none wet)
 *        every pad + prop cell re-checked IN THE TREE by the GATE'S OWN predicate —
 *        min ground over its footprint ring > WATER_LEVEL + 0.05 = -0.21 (<DryScatter>,
 *        §0-P.6) ✓  (isDryCell alone does NOT prove this)
 *        reliefFloor.kept — MEASURED AT RUNTIME, printed by the terrainFlattened advisory
 * WORLDS 3 (>= 3): fire @(-42.5,-17.5) · neon @(4.5,30.5) · pirateBeach @(44.5,0)
 *        all centre pairs SORTED, closest marked (the floor binds the CLOSEST):
 *        neon<->pirateBeach 50.3 ◄ >= 32.66 (20·√(128/48)) ✓ · fire<->neon 67.2 ·
 *        fire<->pirateBeach 89.6 · DRY GAP between world RECTS > 0 (11.0 u / 18.0 u) ✓
 *        WORLD fire: stall EmberRoast (Cinder Grill) · ride MagneticRide @[-31.2,-25.58]
 *          scenery BasaltColumns · CharredSnag · Fumarole · LavaFissure · ObsidianShards (5)
 *        WORLD neon: stall NeonSlush (Voltage Slush) · ride Discotron @[14.4,37.5]
 *          scenery NeonArch · SpeakerStack · MirrorBallPylon · LaserTruss · LightTiles (5)
 *        WORLD pirateBeach: stall SushiStall (Reefside Sushi) · ride LogFlume @[33.6,7.66]
 *          scenery WreckedHull · CoralCluster · AnchorPile · DockPilings · TidePool (5)
 *        >= 3 THEMED scenery pieces each, ALL from that world's own pack ✓
 * CATS   (WRITTEN BEFORE ANY JSX) gentle Carousel/FerrisWheel/Helicycles · thrill §4.0-C
 *        · water LogFlume · transport Monorail ring + Chairlift · dark GhostTrain → 5/5 ✓
 *        RARE PICKS Helicycles + MagneticRide — each appears in setup.md exactly ONCE,
 *        only in §0-P.5's PAD_MARGIN table: no worked example, so nothing copied it ✓
 * CIRCUITS  §4.0-C · §4.0-B · Monorail ring · LogFlume · Chairlift
 *        → 5 CIRCUITS (>= 5) / 3 FAMILIES (coaster · water · transport) (>= 3) ✓
 * GATE   [0, 63.6] → first queue tail [4.8, 58.8] = 9.6 u of street  <= 15 ✓
 * FLAG   §4.0-C start [16.8, 0.55, -3.6] heading 0, steel, cars 3, NO bank prop (builds 0.7)
 *        rateCoaster(bank 0.7, cars 3) → E 6.27 / I 9.55 / N 3.55 / drop 5.47 / maxLatG 0.73
 *        / air 1.33 s / inversions 2  ← the published measurement, re-logged at boot
 *        CORRIDOR KEEP-OUT in PLOT coords (§0-P.4, pasted):
 *          west  x[-19.2,-16.8] z[-4.8,10.8] · south x[-10.8,4.8] z[-19.2,-16.8]
 *          north x[-8.4,7.2]    z[18,19.2]   · station leg x[15.6,18] z[-10.8,4.8] (own)
 *        every street node + boulevard leg OUTSIDE them ✓ — the west column runs x -13.2
 *        (2.4 u east of the south rect, 3.6 u east of the west rect) and crosses the ring
 *        only where the track is above the 2.2 u overfly bar
 * FLAG2  §4.0-B start [-33.6, 0.55, -48.0] heading 0, steel, cars 3, NO bank prop
 *        rateCoaster(bank 0.7, cars 3) → E 5.27 / I 6.25 / N 2.25 / drop 3.58 / maxLatG 0.27
 *        DIFFERENT archetype ✓ · bbox DISJOINT from FLAG's (15.18 u in x) ✓ · off all 16
 *        ring cells ✓ · outside every <World> rect ✓ · coasterPts = [...C, ...B] ✓
 * STREET buildParkNet called EXACTLY ONCE, worlds NOT passed (the pads read NET) ✓
 *        the SAME NET feeds <Paths> and every offPathCell ✓
 *        PORT-REFS: 6 pieces → hub:N hub:E hub:W · works:E · night:W · cove:W ·
 *        gateAve A/B (gate + hub port stand on them) · westAve A/B wired to nodes 23/29 ✓
 *        every pad returned BY offPathCell through place() ✓
 * MONO   ring VERBATIM · position [-42.6, 0, -9.7] (the START POSE, not the centre)
 *        4 platforms >= 3 declared worlds (one each: W→fire, N→neon, E→pirateBeach) ✓
 *        tails [-36.0,-8.4] · [0,27.6] · [36.0,-8.4] · [0,-57.6] authored NODES, ALL LEAVES ✓
 *        (S queues OUTWARD; the gate spine ENDS at the hub, the N tail is reached
 *         laterally off the east leg — §0-P.4)
 *        deck flank test bumpIn(COMP, deck) <= 0.75 runs at module scope (advisory)
 * QUEUE  ONE ROW PER RIDE — tail is an authored NODE, pad DERIVED from it:
 *        Carousel     cap 6 tail [4.8,58.8]    out [1,0]  → pad  8.78 u >= 7.58 ✓
 *        FerrisWheel  cap 4 tail [-4.8,58.8]   out [-1,0] → pad  7.66 u >= 6.46 ✓
 *        Helicycles   cap 4 tail [-9.6,52.8]   out [-1,0] → pad  7.66 u >= 6.46 ✓
 *        Discotron    cap 8 tail [14.4,27.6]   out [0,1]  → pad  9.90 u >= 8.70 ✓
 *        GhostTrain   cap 4 tail [22.8,21.6]   out [1,0]  → pad  7.66 u >= 6.46 ✓
 *        LogFlume     cap 4 tail [33.6,0]      out [0,1]  → pad  7.66 u >= 6.46 ✓
 *        Chairlift    cap 4 tail [-24,-27.6]   out [1,0]  → pad  7.66 u >= 6.46 ✓
 *        MagneticRide cap 6 tail [-31.2,-16.8] out [0,-1] → pad  8.78 u >= 7.58 ✓
 *        coasters take queueTailNode/queueDir on their own archetype tails ✓
 *        no two rides share a tail node ✓ · every tail appears in NODES ✓
 *        clear = padMarginOf(rig) off the §0-P.5 table, never the 3.2 default by guess ✓
 * GROUND every pad re-tested against the peak field (assertPadFlat) and the water sieve ✓
 *        causewayEdges EMPTY (every street leg cardinal on the 1.2 lattice) ✓
 * SPREAD built bbox 111 × 119 >= 70 × 45 ✓ · street-node bbox 76.8 × 121.2 →
 *        pathExtent 0.60 / 0.95 >= 0.55 ✓
 * PLAZAS 4 rects from NET.plazas: hub 10.8² = 116.6 u² + 3 bazaar courts → largest >= 8 ✓
 *        NO set-piece `position` appears in NODES or as a queue tail (assertNodesOffPieces) ✓
 * NODES  41 authored · degree-1: 8 (0.195) → each carries a queue tail or the gate ✓
 *        one PARK-SPANNING loop, crosses z = 0 twice (east spine x 22.8 · west column
 *        x -13.2) ✓
 * ATTACH no spur takes a nodeY ramp — every node sits on the composed ground and every
 *        edge is cardinal, so |Δy|/len is the terrain's own grade ✓
 *        accessibility.allRidesReachable MUST come back true (read it in onReady)
 * LATTICE authored spans 1.2 / 3.6 / 4.8 / 6.0 / 7.2 / 9.6 / 10.8 / 12.0 / 13.2 / 18.0 /
 *        19.2 / 21.6 u + the piece chains → effectiveClasses >= 4 ✓
 * ROSTER (WRITTEN LAST, counted off the register calls, and restated on <Park roster>)
 *        11 rides / 5 categories / 9 stalls (8 kinds) / restroom ✓ / bins from NET ✓
 *        NAMED: every ride AND EVERY STALL carries an authored `name` — 0 defaults ✓
 *        <Park roster={{ rides: [...11 names], stalls: 9, categories: 5 }}> MOUNTED ✓
 * DRESS  42 tree cells >= 32 ✓ · 21 neutral + 15 themed = 36 scenery >= 16 ✓
 *        EVERY prop cell from offPathCell (trees clear 0.75, props 1.2, buildings 1.8) ✓
 *        and re-sieved in the tree by <DryScatter> against the GATE'S dryness predicate
 * NIGHT  3 <Lights> runs · 2 neon · 4 torches · night-gated set-piece lanterns
 * GATE   parkAssertFlush() → 0 structural · validatePark → ok: true expected in onReady
 * ═══════════════════════════════════════════════════════════════════════════════════ */
import * as THREE from 'three';
import React from 'react';
import type { V3, XZ } from './components/Park';
import {
  Park,
  GameManager,
  Terrain,
  Paths,
  Gate,
  Coaster,
  Restroom,
  Scenery,
  Lights,
  Placed,
  Neon,
  Torch,
  ThemeRegion,
  usePark,
  offPathCell,
} from './components/Park';
import { laneLenOf, parkComposition } from './components/ParkBuilder';
import type { NetRef, SetPiecePlan } from './components/SetPieceKit';
import {
  buildParkNet,
  worldPlan,
  World,
  FIRE,
  PIRATE_BEACH,
  NEON_CITY,
} from './components/SetPieceKit';
import { Bazaar, bazaarPlan } from './components/Bazaar';
import { FountainPlaza, fountainPlazaPlan } from './components/FountainPlaza';
import { Boulevard, boulevardPlan } from './components/Boulevard';
import type { TrackPiece } from './components/SplineRideKit';
import { compileTrackPieces, rateCoaster } from './components/SplineRideKit';
import { tree } from './components/Kit';
import { FerrisWheel } from './components/FerrisWheel';
import { Carousel } from './components/Carousel';
import { Discotron } from './components/Discotron';
import { LogFlume } from './components/LogFlume';
import { Chairlift } from './components/Chairlift';
import { GhostTrain } from './components/GhostTrain';
import { MagneticRide } from './components/MagneticRide';
import { Helicycles } from './components/Helicycles';
import { Monorail } from './components/Monorail';
import {
  BasaltColumns,
  CharredSnag,
  Fumarole,
  LavaFissure,
  ObsidianShards,
} from './components/EmberfallScenery';
import {
  WreckedHull,
  CoralCluster,
  AnchorPile,
  DockPilings,
  TidePool,
} from './components/TidewaterScenery';
import {
  NeonArch,
  SpeakerStack,
  MirrorBallPylon,
  LaserTruss,
  LightTiles,
} from './components/PulseScenery';

/* ── 0. plot constants ───────────────────────────────────────────────────────────── */

const SIZE = 128;
const SEED = 1;
const CLIMATE = 'temperate' as const;

/* ── 1. the two VERIFIED coaster archetypes (§0-P.4, copied verbatim) ────────────── */

const C_PIECES: TrackPiece[] = [
  'station',
  { type: 'lift', height: 5.5 },
  { type: 'straight', length: 5.2 },
  { type: 'turnR', angle: 90, radius: 2.5 },
  { type: 'drop', height: 5.5 },
  { type: 'hill', height: 0.6 },
  { type: 'lift', height: 4.2 },
  { type: 'straight', length: 2.72 },
  { type: 'turnR', angle: 90, radius: 2.5 },
  { type: 'drop', height: 4.2 },
  { type: 'hill', height: 0.6 },
  { type: 'lift', height: 4.2 },
  { type: 'corkscrewL' },
  { type: 'straight', length: 4.0 },
  { type: 'turnR', angle: 90, radius: 2.5 },
  { type: 'drop', height: 4.2 },
  { type: 'hill', height: 0.6 },
  { type: 'lift', height: 4.2 },
  { type: 'corkscrewR' },
  { type: 'straight', length: 2.0 },
  { type: 'turnR', angle: 90, radius: 2.5 },
  { type: 'drop', height: 4.2 },
  { type: 'straight', length: 1.5 },
];
const C_START: V3 = [16.8, 0.55, -3.6];
const C_TAIL: XZ = [22.8, -3.6];

const B_PIECES: TrackPiece[] = [
  'station',
  { type: 'lift', height: 3.6 },
  { type: 'straight', length: 2.56 },
  { type: 'turnR', angle: 90, radius: 2.5 },
  { type: 'drop', height: 3.6 },
  { type: 'lift', height: 3.2 },
  { type: 'straight', length: 5.46 },
  { type: 'turnR', angle: 90, radius: 2.5 },
  { type: 'drop', height: 3.2 },
  { type: 'hill', height: 0.9 },
  { type: 'lift', height: 3.2 },
  { type: 'straight', length: 1.5 },
  { type: 'turnR', angle: 90, radius: 2.5 },
  { type: 'drop', height: 3.2 },
  { type: 'hill', height: 0.9 },
  { type: 'lift', height: 3.2 },
  { type: 'turnR', angle: 90, radius: 2.5 },
  { type: 'drop', height: 3.2 },
  { type: 'straight', length: 1.5 },
];
const B_START: V3 = [-33.6, 0.55, -48.0];
const B_TAIL: XZ = [-27.6, -48.0];

const { points: FLAG_PTS } = compileTrackPieces(C_PIECES, {
  type: 'steel',
  start: C_START,
  heading: 0,
  bounds: SIZE,
});
const { points: FLAG2_PTS } = compileTrackPieces(B_PIECES, {
  type: 'steel',
  start: B_START,
  heading: 0,
  bounds: SIZE,
});
const ALL_COASTER_PTS = [...FLAG_PTS, ...FLAG2_PTS];

[FLAG_PTS, FLAG2_PTS].forEach((pts, i) =>
  console.log(`[park] coaster ${i + 1}`, rateCoaster(pts, { type: 'steel', bank: 0.7, cars: 3 })),
);

/* ── 2. the assertion bus (§0-P.5) ───────────────────────────────────────────────── */

type Sev = 'structural' | 'advisory';
const PARK_FAILS: { name: string; detail: string; sev: Sev }[] = [];
function parkAssert(name: string, cond: boolean, detail: string, sev: Sev = 'structural'): boolean {
  if (!cond) PARK_FAILS.push({ name, detail, sev });
  return cond;
}
function parkAssertFlush(): void {
  if (!PARK_FAILS.length) {
    console.log('[park] assertions: all pass');
    return;
  }
  const hard = PARK_FAILS.filter((f) => f.sev === 'structural');
  console.error(
    `[park] ${PARK_FAILS.length} ASSERTION FAILURE(S) (${hard.length} structural):\n` +
      PARK_FAILS.map((f, i) => `  ${i + 1}. [${f.sev}] ${f.name}\n     ${f.detail}`).join('\n'),
  );
  if (hard.length)
    throw new Error(`[park] ${hard.length} STRUCTURAL failure(s) — see the numbered block above.`);
}

/* ── 3. the pinned seed row + the guard sieve (§0-P.6) ───────────────────────────── */

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

function keepDryOf(net: { keepDry: XZ[] }, row: SeedRow = SEED_ROW): XZ[] {
  const kept = net.keepDry.filter((c) => offRow(c, row));
  const dropped = net.keepDry.length - kept.length;
  if (dropped)
    console.warn(
      `[park] keepDryOf dropped ${dropped} of ${net.keepDry.length} guard cell(s) on the pinned ` +
        `row's water. A DROPPED guard is NOT a fixed cell — MOVE whatever stands there.`,
    );
  return kept;
}

/* ── 4. the pad-clearance table (§0-P.5) ─────────────────────────────────────────── */

const PAD_MARGIN: Record<string, number> = {
  LavaTubeRun: 23.41,
  ReefRacer: 22.2,
  OceanTunnelSlide: 22.14,
  EmberWings: 16.15,
  WyrmsHollow: 15.99,
  MagmaRun: 14.22,
  MineTrainCoaster: 13.99,
  DeepDrift: 12.65,
  Bassline: 11.59,
  GearworksExpress: 10.03,
  MoonlitBarge: 8.23,
  SplineCoaster: 7.32,
  RiverRapids: 6.6,
  Bobsleigh: 6.01,
  MagneticRide: 5.56,
  LogFlume: 5.36,
  GhostTrain: 4.77,
  HauntedMansion: 4.77,
  GoKarts: 4.39,
  Monorail: 4.02,
  Chairlift: 3.52,
  Helicycles: 3.42,
  FlyingSaucers: 3.37,
  MotionSimulator: 3.2,
  Enterprise: 3.13,
  PaddleBoats: 3.12,
  Discotron: 3.07,
  BoilerBurst: 3.05,
  FerrisWheel: 2.97,
  AetherBalloons: 2.95,
  PirateShip: 2.7,
  TwistRide: 2.65,
  TopSpin: 2.52,
  Teacups: 2.47,
  Carousel: 2.4,
  SwingingInverterShip: 2.35,
  LaunchedFreefall: 2.25,
  BumperCars: 2.07,
  SpaceRings: 1.92,
  SwingRide: 1.92,
  DropTower: 1.8,
  ObservationTower: 1.8,
};
const padMarginOf = (rig: string) => PAD_MARGIN[rig] ?? 3.2;

/* ── 5. the monorail ring (§0-P.4, verbatim) ─────────────────────────────────────── */

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
const RING_DECKS: XZ[] = [
  [-42.6, -8.4],
  [0, 34.2],
  [42.6, -8.4],
  [0, -51.0],
];

/* ── 6. the authored street skeleton ─────────────────────────────────────────────── */

const NODES: XZ[] = [
  /*  0 */ [0, 63.6], // the gate cell
  /*  1 */ [0, 58.8],
  /*  2 */ [4.8, 58.8], // Carousel tail (LEAF)
  /*  3 */ [-4.8, 58.8], // FerrisWheel tail (LEAF)
  /*  4 */ [0, 52.8],
  /*  5 */ [-9.6, 52.8], // Helicycles tail (LEAF)
  /*  6 */ [22.8, 45.6],
  /*  7 */ [22.8, 33.6],
  /*  8 */ [22.8, 27.6],
  /*  9 */ [9.6, 27.6],
  /* 10 */ [0, 27.6], // N monorail tail (LEAF)
  /* 11 */ [14.4, 27.6], // Discotron tail
  /* 12 */ [22.8, 21.6], // GhostTrain tail
  /* 13 */ [22.8, 9.6],
  /* 14 */ [22.8, 0],
  /* 15 */ [33.6, 0], // LogFlume tail
  /* 16 */ [40.8, 0],
  /* 17 */ [22.8, -3.6], // §4.0-C tail
  /* 18 */ [22.8, -8.4],
  /* 19 */ [36.0, -8.4], // E monorail tail (LEAF)
  /* 20 */ [22.8, -16.8],
  /* 21 */ [6.0, -16.8],
  /* 22 */ [6.0, -21.6],
  /* 23 */ [-13.2, 45.6],
  /* 24 */ [-13.2, 33.6],
  /* 25 */ [-13.2, 24.0],
  /* 26 */ [-13.2, 14.4],
  /* 27 */ [-13.2, 0],
  /* 28 */ [-13.2, -12.0],
  /* 29 */ [-13.2, -21.6],
  /* 30 */ [-24.0, -21.6],
  /* 31 */ [-24.0, -16.8],
  /* 32 */ [-36.0, -16.8],
  /* 33 */ [-36.0, -8.4], // W monorail tail (LEAF)
  /* 34 */ [-31.2, -16.8], // MagneticRide tail
  /* 35 */ [-24.0, -27.6], // Chairlift tail
  /* 36 */ [-24.0, -38.4],
  /* 37 */ [-24.0, -48.0],
  /* 38 */ [-27.6, -48.0], // §4.0-B tail (LEAF)
  /* 39 */ [-24.0, -57.6],
  /* 40 */ [0, -57.6], // S monorail tail (LEAF)
];

/* ── 7. the set-pieces (PLAN FIRST) ──────────────────────────────────────────────── */

const HUB = fountainPlazaPlan({
  id: 'hub',
  title: 'Aurora Circle',
  position: [0, 45.6],
  tiles: 9,
  ports: ['N', 'E', 'S', 'W'],
  seed: 3,
});

const WORKS = bazaarPlan({
  id: 'works',
  title: 'Cinderworks Row',
  position: [-48.0, -16.8],
  facing: { port: 'E', toward: [-36.0, -16.8] },
  stalls: ['emberRoast', 'hotDog', 'soda'],
  names: ['Cinder Grill', 'Ashfall Franks', 'Slagworks Sodas'],
  theme: FIRE,
  seed: 9,
});

const NIGHT = bazaarPlan({
  id: 'night',
  title: 'Voltage Lane',
  position: [-4.8, 24.0],
  facing: { port: 'W', toward: [-13.2, 24.0] },
  stalls: ['neonSlush', 'soda', 'balloon'],
  names: ['Voltage Slush', 'Static Sodas', 'Glow Balloons'],
  theme: NEON_CITY,
  seed: 5,
});

const COVE = bazaarPlan({
  id: 'cove',
  title: 'Castaway Market',
  position: [50.4, 0],
  facing: { port: 'W', toward: [40.8, 0] },
  stalls: ['sushi', 'burger', 'cottonCandy'],
  names: ['Reefside Sushi', 'Castaway Burgers', 'Sea Foam Floss'],
  theme: PIRATE_BEACH,
  seed: 7,
});

const GATE_AVE = boulevardPlan({
  id: 'gateAve',
  title: 'Aurora Approach',
  from: [0, 63.6],
  to: HUB.port('N'),
  spacing: 4.8,
  avoid: [
    [4.8, 58.8],
    [-4.8, 58.8],
    [-9.6, 52.8],
    [0, 52.8],
  ],
  clear: 2.4,
});

const WEST_AVE = boulevardPlan({
  id: 'westAve',
  title: 'Lakeside Walk',
  from: [-13.2, 44.4],
  to: [-13.2, -20.4],
  spacing: 4.8,
  avoid: [
    [-13.2, 33.6],
    [-13.2, 24.0],
    [-13.2, 14.4],
    [-13.2, 0],
    [-13.2, -12.0],
  ],
  clear: 2.4,
});

const ALL_PLANS: SetPiecePlan[] = [HUB, WORKS, NIGHT, COVE, GATE_AVE, WEST_AVE];

const EDGES: [NetRef, NetRef][] = [
  [0, 1],
  [1, 2],
  [1, 3],
  [1, 4],
  [4, 5],
  [4, 'hub:N'],
  ['hub:E', 6],
  [6, 7],
  [7, 8],
  [8, 11],
  [11, 9],
  [9, 10],
  [8, 12],
  [12, 13],
  [13, 14],
  [14, 15],
  [15, 16],
  [16, 'cove:W'],
  [14, 17],
  [17, 18],
  [18, 19],
  [18, 20],
  [20, 21],
  [21, 22],
  [22, 29],
  ['hub:W', 23],
  [23, 'westAve:A'],
  [23, 24],
  [24, 25],
  [25, 'night:W'],
  [25, 26],
  [26, 27],
  [27, 28],
  [28, 29],
  ['westAve:B', 29],
  [29, 30],
  [30, 31],
  [31, 34],
  [34, 32],
  [32, 33],
  [32, 'works:E'],
  [30, 35],
  [35, 36],
  [36, 37],
  [37, 38],
  [37, 39],
  [39, 40],
];

/* ── 8. plan-time street assertions (§0-P.5) ─────────────────────────────────────── */

const portCell = (ref: NetRef): XZ => {
  if (typeof ref === 'number') return NODES[ref];
  const [id, name] = ref.split(':');
  const p = ALL_PLANS.find((q) => q.id === id);
  if (!p) throw new Error(`EDGES references '${ref}' but no plan has id '${id}'`);
  return p.port(name);
};
const EPS = 1e-6;
EDGES.forEach(([a, b]) => {
  const A = portCell(a);
  const B = portCell(b);
  parkAssert(
    'cardinalEdge',
    Math.abs(A[0] - B[0]) < EPS || Math.abs(A[1] - B[1]) < EPS,
    `edge ${a}→${b} is DIAGONAL: [${A}] → [${B}]. buildParkNet ELBOWS it through a synthesised ` +
      `corner node you did not plan. FIX THE TABLE: share an x or a z.`,
    'advisory',
  );
});

const CHAIN_END_OPT_OUT = new Set<string>([
  'gateAve:A', // the bare <Gate> stands on this terminus
  'gateAve:B', // this cell IS hub:N, merged by buildParkNet
]);
const PORT_REFS = EDGES.flat().filter((x): x is string => typeof x === 'string');
ALL_PLANS.forEach((p) => {
  const wired = new Set(
    PORT_REFS.filter((r) => r.split(':')[0] === p.id).map((r) => r.split(':')[1]),
  );
  parkAssert(
    'pieceIsland',
    wired.size > 0 || p.id === 'gateAve',
    `set-piece '${p.id}' has NO '${p.id}:<PORT>' ref in EDGES — it composes as an ISLAND`,
  );
  p.ports
    .filter((pt) => !pt.prunable)
    .forEach((pt) => {
      if (wired.has(pt.name) || CHAIN_END_OPT_OUT.has(`${p.id}:${pt.name}`)) return;
      parkAssert(
        'chainEnd',
        false,
        `chain piece '${p.id}' (${p.kind}) wires [${[...wired]}] but NOT '${p.id}:${pt.name}' — ` +
          `that end of the carriageway dead-ends in grass (deadStreetNode).`,
      );
    });
});

const SOLID_CLEAR: Record<string, number> = {
  FountainPlaza: 1.8,
  Bazaar: 0.6,
  Boulevard: 0,
};
function assertNodesOffPieces(nodes: XZ[], plans: SetPiecePlan[]): void {
  const hits: string[] = [];
  plans.forEach((p) => {
    const clear = SOLID_CLEAR[p.kind] ?? 1.8;
    if (clear === 0) return;
    const ports = new Set(p.ports.map((pt) => `${pt.at[0].toFixed(2)},${pt.at[1].toFixed(2)}`));
    const f = p.footprint;
    const c = Math.cos(-f.yaw);
    const s = Math.sin(-f.yaw);
    nodes.forEach((n, i) => {
      if (ports.has(`${n[0].toFixed(2)},${n[1].toFixed(2)}`)) return;
      const dx = n[0] - f.cx;
      const dz = n[1] - f.cz;
      const lx = dx * c - dz * s;
      const lz = dx * s + dz * c;
      const gap = Math.max(Math.abs(lx) - f.hx, Math.abs(lz) - f.hz);
      if (gap < clear - 1e-9)
        hits.push(
          `[${n[0]}, ${n[1]}] (cell ${i}) is ${gap.toFixed(2)} u from '${p.id}' (${p.kind}) — needs ${clear}`,
        );
    });
  });
  parkAssert(
    'nodeInSolid',
    !hits.length,
    `${hits.length} authored cell(s) stand inside or against a set-piece SOLID footprint:\n  ` +
      hits.join('\n  '),
  );
}
assertNodesOffPieces(NODES, ALL_PLANS);

/* ── 9. the ONE fuse ─────────────────────────────────────────────────────────────── */

const NET = buildParkNet({
  nodes: NODES,
  edges: EDGES,
  pieces: [HUB, WORKS, NIGHT, COVE, GATE_AVE, WEST_AVE],
});

const GUARDS = keepDryOf(NET, SEED_ROW);

const AUTHORED_WET = NODES.filter((c) => !offRow(c));
if (AUTHORED_WET.length)
  console.warn(`[park] authored cells on the pinned row's water: ${JSON.stringify(AUTHORED_WET)}`);

/* ── 10. the composition, guarded and unguarded ──────────────────────────────────── */

const BARE = parkComposition(THREE, SEED, SIZE, CLIMATE);
const COMP = parkComposition(THREE, SEED, SIZE, CLIMATE, {
  keepDry: GUARDS,
  coasterPts: ALL_COASTER_PTS,
});

parkAssert(
  'waterMoved',
  Math.hypot(
    COMP.waterCentre[0] - BARE.waterCentre[0],
    COMP.waterCentre[1] - BARE.waterCentre[1],
  ) < 1 &&
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
      `${rf.relief.toFixed(2)} (kept ${rf.kept.toFixed(2)} against the ${rf.floor} floor), stdH ` +
      `${rf.authoredStdH.toFixed(2)} → ${rf.stdH.toFixed(2)}. Ranges guarded: ${rf.guardedRanges}; ` +
      `capped peaks: ${JSON.stringify(rf.cappedPeaks)}`
    : '',
  'advisory',
);
if (rf)
  console.log(
    `[park] reliefFloor kept ${rf.kept.toFixed(2)} (floor ${rf.floor}) · relief ${rf.relief.toFixed(
      2,
    )} · stdH ${rf.stdH.toFixed(2)} · probes ${COMP.report.probesTried}`,
  );

/* ── 11. placement (§0-P.5) ──────────────────────────────────────────────────────── */

const PEAK_LIMIT = 0.75;
const isDry = (c: XZ) =>
  [...COMP.basins, ...COMP.clampBasins].every(
    (b) => Math.hypot(c[0] - b.x, c[1] - b.z) > 0.74 * b.radius + 0.6,
  );
const bumpAt = (c: XZ) =>
  Math.max(
    0,
    ...COMP.peaks.map((p) => {
      const k = Math.max(0, 1 - Math.hypot(c[0] - p.x, c[1] - p.z) / p.radius);
      return k * k * (3 - 2 * k) * p.height;
    }),
  );

RING_DECKS.forEach((d) =>
  parkAssert(
    'deckOnFlank',
    bumpAt(d) <= PEAK_LIMIT,
    `monorail deck [${d}] bump ${bumpAt(d).toFixed(2)} > ${PEAK_LIMIT} — it will FAIL the terrain ` +
      `gate (−3 on axis 7). Move the RING pose; keepDry does NOT fix a flank.`,
    'advisory',
  ),
);

function assertPadFlat(pad: XZ, clear: number, label: string): XZ {
  if (bumpAt(pad) <= PEAK_LIMIT && isDry(pad)) return pad;
  for (let r = 1; r <= 8; r += 1)
    for (let ix = -r; ix <= r; ix += 1)
      for (let iz = -r; iz <= r; iz += 1) {
        if (Math.max(Math.abs(ix), Math.abs(iz)) !== r) continue;
        const c: XZ = [+(pad[0] + ix * 0.6).toFixed(2), +(pad[1] + iz * 0.6).toFixed(2)];
        if (bumpAt(c) > PEAK_LIMIT || !isDry(c)) continue;
        const off = offPathCell(NET, c, { clear });
        if (off && Math.hypot(off[0] - c[0], off[1] - c[1]) < 1e-6) {
          console.warn(
            `[park] ${label}: pad [${pad}] on a hill flank (bump ${bumpAt(pad).toFixed(
              2,
            )}) — moved to [${c}]`,
          );
          return c;
        }
      }
  parkAssert(
    'padOnFlank',
    false,
    `${label}: pad [${pad}] is on a hill flank (bump ${bumpAt(pad).toFixed(2)}) OR WET, and no ` +
      `cell within 4.8 u is flat, dry AND ${clear} u off the street.`,
    'advisory',
  );
  return pad;
}

const minReachOf = (c: number) => laneLenOf(c) + 0.35 + 0.62 + 0.5 + 0.45;

type Placement = { pad: XZ; anchor: XZ; dir: XZ; yaw: number; tail: XZ };
function place(tail: XZ, out: XZ, capacity: number, rig: string): Placement {
  const clear = padMarginOf(rig);
  const join = laneLenOf(capacity) + 0.35;
  const reach = minReachOf(capacity) + 2.4;
  const cand: XZ = [tail[0] + out[0] * reach, tail[1] + out[1] * reach];
  const onStreet = (offPathCell(NET, cand, { clear }) ?? cand) as XZ;
  const pad = assertPadFlat(onStreet, clear, rig);
  const got = Math.hypot(pad[0] - tail[0], pad[1] - tail[1]);
  if (got < minReachOf(capacity) + 1.2)
    parkAssert(
      'padReach',
      false,
      `${rig}: pad [${pad}] sits ${got.toFixed(2)} u from its tail [${tail}] — the cap-${capacity} ` +
        `floor is ${(minReachOf(capacity) + 1.2).toFixed(2)} u. Move the TAIL outward or open the court.`,
      'advisory',
    );
  return {
    pad,
    anchor: [tail[0] + out[0] * join, tail[1] + out[1] * join] as XZ,
    dir: [-out[0], -out[1]] as XZ,
    yaw: Math.atan2(-out[0], -out[1]),
    tail,
  };
}

const CAROUSEL = place([4.8, 58.8], [1, 0], 6, 'Carousel');
const WHEEL = place([-4.8, 58.8], [-1, 0], 4, 'FerrisWheel');
const HELI = place([-9.6, 52.8], [-1, 0], 4, 'Helicycles');
const DISCO = place([14.4, 27.6], [0, 1], 8, 'Discotron');
const GHOST = place([22.8, 21.6], [1, 0], 4, 'GhostTrain');
const FLUME = place([33.6, 0], [0, 1], 4, 'LogFlume');
const LIFT = place([-24.0, -27.6], [1, 0], 4, 'Chairlift');
const MAG = place([-31.2, -16.8], [0, -1], 6, 'MagneticRide');

const PADS: Placement[] = [CAROUSEL, WHEEL, HELI, DISCO, GHOST, FLUME, LIFT, MAG];

const spot = (cell: XZ, clear: number, label: string): XZ =>
  assertPadFlat((offPathCell(NET, cell, { clear }) ?? cell) as XZ, clear, label);

const RESTROOM: XZ = spot([-9.6, 48.0], 1.8, 'Restroom');

/* ── 12. dressing cells ──────────────────────────────────────────────────────────── */

const hash01 = (n: number) => {
  const s = Math.sin(n * 12.9898 + 78.233) * 43758.5453;
  return s - Math.floor(s);
};

const TREE_SHAPES = ['round', 'pine', 'willow', 'round', 'pine'] as const;
type TreeShape = (typeof TREE_SHAPES)[number];

const GROVES: { c: XZ; r: number; n: number }[] = [
  { c: [13.2, 55.2], r: 6, n: 6 },
  { c: [-30.0, 54.0], r: 6, n: 5 },
  { c: [37.2, 36.0], r: 6, n: 6 },
  { c: [-30.0, 6.0], r: 8, n: 5 },
  { c: [-52.8, 8.4], r: 7, n: 5 },
  { c: [10.8, -30.0], r: 7, n: 5 },
  { c: [57.6, -13.2], r: 4, n: 4 },
  { c: [-44.4, -25.2], r: 4.5, n: 6 },
];

const RAW_TREES: XZ[] = [];
GROVES.forEach((g, gi) => {
  for (let i = 0; i < g.n; i += 1) {
    const a = hash01(gi * 31 + i * 7 + 1) * Math.PI * 2;
    const rr = (0.35 + 0.65 * hash01(gi * 17 + i * 11 + 3)) * g.r;
    RAW_TREES.push([+(g.c[0] + Math.cos(a) * rr).toFixed(2), +(g.c[1] + Math.sin(a) * rr).toFixed(2)]);
  }
});

const TREES: { at: XZ; shape: TreeShape }[] = RAW_TREES.map((c, i) => ({
  at: (offPathCell(NET, c, { clear: 0.75 }) ?? c) as XZ,
  shape: TREE_SHAPES[i % TREE_SHAPES.length],
}));

type PropSpec = { at: XZ; kind: string; rot?: number; seed?: number };

const RAW_PROPS: PropSpec[] = [
  /* — neutral SceneryPack dressing — */
  { at: [3.6, 60.0], kind: 'flagpole' },
  { at: [-3.6, 60.0], kind: 'signpost' },
  { at: [7.2, 50.4], kind: 'planterBox' },
  { at: [-7.2, 50.4], kind: 'topiarySpiral' },
  { at: [18.0, 42.0], kind: 'parkClock' },
  { at: [27.6, 42.0], kind: 'birdbath' },
  { at: [27.6, 31.2], kind: 'picnicTable' },
  { at: [18.0, 16.8], kind: 'marbleStatue' },
  { at: [27.6, 6.0], kind: 'wishingWell' },
  { at: [27.6, -12.0], kind: 'lionStatue' },
  { at: [12.0, -25.2], kind: 'topiaryElephant' },
  { at: [-19.2, -31.2], kind: 'ironArchway' },
  { at: [-30.0, -33.6], kind: 'cactusCluster' },
  { at: [-18.0, -45.6], kind: 'fallenLog' },
  { at: [-28.8, -40.8], kind: 'mushroomCluster' },
  { at: [-12.0, -54.0], kind: 'picnicTable' },
  { at: [-22.8, -9.6], kind: 'planterBox' },
  { at: [-24.0, 3.6], kind: 'birdbath' },
  { at: [-24.0, 14.4], kind: 'topiarySpiral' },
  { at: [-27.6, 48.0], kind: 'planterBox' },
  { at: [45.6, 12.0], kind: 'parkClock' },
  /* — FIRE world (Emberfall pack only) — */
  { at: [-52.8, -10.8], kind: 'basaltColumns', rot: 0.4, seed: 3 },
  { at: [-45.6, -22.8], kind: 'charredSnag', rot: 0.9, seed: 5 },
  { at: [-38.4, -21.6], kind: 'fumarole', seed: 2 },
  { at: [-40.8, -13.2], kind: 'lavaFissure', rot: 2.0, seed: 4 },
  { at: [-54.0, -21.6], kind: 'obsidianShards', rot: 0.6, seed: 7 },
  /* — PIRATE BEACH world (Tidewater pack only) — */
  { at: [46.8, 6.0], kind: 'wreckedHull', rot: 0.6, seed: 2 },
  { at: [52.8, -7.2], kind: 'dockPilings', rot: 0.6, seed: 4 },
  { at: [44.4, 4.8], kind: 'coralCluster', seed: 6 },
  { at: [55.2, 4.8], kind: 'anchorPile', rot: 1.1, seed: 8 },
  { at: [48.0, -13.2], kind: 'tidePool', seed: 5 },
  /* — NEON world (Pulse pack only) — */
  { at: [4.8, 31.2], kind: 'neonArch', rot: 0, seed: 2 },
  { at: [9.6, 32.4], kind: 'mirrorBallPylon', seed: 3 },
  { at: [12.0, 21.6], kind: 'speakerStack', rot: 0.4, seed: 4 },
  { at: [4.8, 22.8], kind: 'laserTruss', rot: 0, seed: 6 },
  { at: [7.2, 24.0], kind: 'lightTiles', seed: 8 },
];

const PROPS: PropSpec[] = RAW_PROPS.map((p) => ({
  ...p,
  at: (offPathCell(NET, p.at, { clear: 1.2 }) ?? p.at) as XZ,
}));
const propAt = (kind: string): XZ => (PROPS.find((p) => p.kind === kind) as PropSpec).at;

/* ── 13. the WORLDS (declared AFTER the pads exist) ──────────────────────────────── */

const FIRE_WORLD = worldPlan({
  id: 'cinderworks',
  theme: FIRE,
  pieces: [WORKS],
  include: [
    [-42.6, -8.4], // the W monorail deck — everyWorldTouched
    MAG.pad,
    MAG.anchor,
    propAt('basaltColumns'),
    propAt('charredSnag'),
    propAt('fumarole'),
    propAt('lavaFissure'),
    propAt('obsidianShards'),
  ],
});

const NEON_WORLD = worldPlan({
  id: 'voltage',
  theme: NEON_CITY,
  pieces: [NIGHT],
  include: [
    [0, 34.2], // the N monorail deck
    DISCO.pad,
    DISCO.anchor,
    propAt('neonArch'),
    propAt('mirrorBallPylon'),
    propAt('speakerStack'),
    propAt('laserTruss'),
    propAt('lightTiles'),
  ],
});

const COVE_WORLD = worldPlan({
  id: 'castaway',
  theme: PIRATE_BEACH,
  pieces: [COVE],
  include: [
    [42.6, -8.4], // the E monorail deck
    FLUME.pad,
    FLUME.anchor,
    propAt('wreckedHull'),
    propAt('dockPilings'),
    propAt('coralCluster'),
    propAt('anchorPile'),
    propAt('tidePool'),
  ],
});

const WORLDS = [FIRE_WORLD, NEON_WORLD, COVE_WORLD];

const WORLD_FLOOR = 20 * Math.sqrt(SIZE / 48);
for (let i = 0; i < WORLDS.length; i += 1)
  for (let j = i + 1; j < WORLDS.length; j += 1) {
    const a = WORLDS[i];
    const b = WORLDS[j];
    const d = Math.hypot(a.centre[0] - b.centre[0], a.centre[1] - b.centre[1]);
    parkAssert(
      'worldsTooClose',
      d >= WORLD_FLOOR,
      `worlds '${a.id}' and '${b.id}' are ${d.toFixed(2)} u apart — the floor is ${WORLD_FLOOR.toFixed(2)} u`,
      'advisory',
    );
  }
WORLDS.forEach((w) => {
  const deck = RING_DECKS.find((d) => w.contains(d));
  parkAssert(
    'worldOffRing',
    !!deck,
    `world '${w.id}' holds no monorail DECK — probe.monorail.everyWorldTouched will be false`,
    'advisory',
  );
});

/* the pads must respect the set-piece solids too */
assertNodesOffPieces(
  PADS.map((p) => p.pad),
  ALL_PLANS,
);

parkAssertFlush();

/* ── 14. the dryness receipt, mounted IN the tree (§0-P.6) ───────────────────────── */

type ParkCtx = ReturnType<typeof usePark>;

function dryRing(park: ParkCtx, c: XZ, r = 0.75): boolean {
  const g = (park as any).ground;
  if (!g || !g.lint) {
    console.error('[park] dryRing ran with NO TERRAIN — a VACUOUS pass');
    return true;
  }
  const dry = (x: number, z: number) => g.lint.isDry(x, z, 0.05);
  if (!dry(c[0], c[1])) return false;
  for (let k = 0; k < 8; k += 1) {
    const a = (k / 8) * Math.PI * 2;
    if (!dry(c[0] + Math.cos(a) * r, c[1] + Math.sin(a) * r)) return false;
  }
  return true;
}

function DryScatter<T extends { at: XZ }>({
  cells,
  label,
  render,
}: {
  cells: T[];
  label: string;
  render: (c: T, i: number) => React.ReactNode;
}) {
  const park = usePark('DryScatter');
  const [dry, setDry] = React.useState<T[] | null>(null);
  React.useEffect(() => {
    const kept = cells.filter((c) => dryRing(park, c.at));
    if (kept.length < cells.length)
      console.error(
        `[park] DryScatter(${label}) dropped ${cells.length - kept.length} of ${cells.length} ` +
          `cell(s) UNDER waterline+0.05: ${JSON.stringify(
            cells.filter((c) => !kept.includes(c)).map((c) => c.at),
          )}`,
      );
    else console.log(`[park] DryScatter(${label}): ${kept.length}/${cells.length} cells dry`);
    setDry(kept);
  }, [park, cells, label]);
  return <>{(dry ?? []).map(render)}</>;
}

function renderProp(p: PropSpec, i: number): React.ReactNode {
  const key = `pr-${i}`;
  switch (p.kind) {
    case 'basaltColumns':
      return <BasaltColumns key={key} position={p.at} rotation={p.rot} seed={p.seed} />;
    case 'charredSnag':
      return <CharredSnag key={key} position={p.at} rotation={p.rot} seed={p.seed} />;
    case 'fumarole':
      return <Fumarole key={key} position={p.at} rotation={p.rot} seed={p.seed} />;
    case 'lavaFissure':
      return <LavaFissure key={key} position={p.at} rotation={p.rot} seed={p.seed} />;
    case 'obsidianShards':
      return <ObsidianShards key={key} position={p.at} rotation={p.rot} seed={p.seed} />;
    case 'wreckedHull':
      return <WreckedHull key={key} position={p.at} rotation={p.rot} seed={p.seed} />;
    case 'coralCluster':
      return <CoralCluster key={key} position={p.at} rotation={p.rot} seed={p.seed} />;
    case 'anchorPile':
      return <AnchorPile key={key} position={p.at} rotation={p.rot} seed={p.seed} />;
    case 'dockPilings':
      return <DockPilings key={key} position={p.at} rotation={p.rot} seed={p.seed} />;
    case 'tidePool':
      return <TidePool key={key} position={p.at} rotation={p.rot} seed={p.seed} />;
    case 'neonArch':
      return <NeonArch key={key} position={p.at} rotation={p.rot} seed={p.seed} text="PULSE" />;
    case 'speakerStack':
      return <SpeakerStack key={key} position={p.at} rotation={p.rot} seed={p.seed} />;
    case 'mirrorBallPylon':
      return <MirrorBallPylon key={key} position={p.at} rotation={p.rot} seed={p.seed} />;
    case 'laserTruss':
      return <LaserTruss key={key} position={p.at} rotation={p.rot} seed={p.seed} />;
    case 'lightTiles':
      return <LightTiles key={key} position={p.at} rotation={p.rot} seed={p.seed} />;
    default:
      return <Scenery key={key} name={p.kind} position={p.at} seed={(p.seed ?? i) + 1} />;
  }
}

/* ── 15. the park ────────────────────────────────────────────────────────────────── */

const RIDE_NAMES = [
  'Corkscrew Ascent',
  'Cinder Chaser',
  'Grand Circle Monorail',
  'Castaway Log Run',
  'Caldera Chairlift',
  'Hollow Manor Express',
  'Aurora Wheel',
  'Gilded Gallopers',
  'Voltage Spinner',
  'Lodestone Loop',
  'Sky Pedallers',
];

export function App() {
  return (
    <Park
      seed={SEED}
      climate={CLIMATE}
      roster={{ rides: RIDE_NAMES, stalls: 9, categories: 5 }}
      onReady={(report: any) => {
        console.log(
          `[park] validatePark ok=${report.ok} failures=${report.failures?.length ?? 0} ` +
            `warnings=${report.warnings?.length ?? 0}`,
          report,
        );
      }}
    >
      <Terrain keepDry={GUARDS} coasterPts={ALL_COASTER_PTS} />

      <ThemeRegion theme="fire" position={FIRE_WORLD.centre} extent={FIRE_WORLD.half} />
      <ThemeRegion theme="neon" position={NEON_WORLD.centre} extent={NEON_WORLD.half} />
      <ThemeRegion theme="pirateBeach" position={COVE_WORLD.centre} extent={COVE_WORLD.half} />

      <Paths
        nodes={NET.nodes}
        edges={NET.edges}
        plazas={NET.plazas}
        bins={NET.bins}
        walkers={6}
      />
      <GameManager />
      <Gate />

      {/* ── the two coasters (PIECES mode, no bank prop, cars passed) ── */}
      <Coaster
        name="Corkscrew Ascent"
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
        rideDuration={11}
        loadTime={2}
        intensity={6}
        price={5}
        queueTailNode={NET.node(B_TAIL)}
        queueDir={[1, 0]}
      />

      {/* ── the transport ring: one platform in each declared world ── */}
      <Monorail
        position={[-42.6, 0, -9.7]}
        rotation={0}
        pieces={MONO_PIECES}
        beamY={2.6}
        loopSeconds={12}
        pinned
        name="Grand Circle Monorail"
        capacity={6}
        rideDuration={12}
        intensity={1}
        price={0}
        queue={{ anchor: [-40.81, -8.4], dir: [1, 0] }}
        register={{
          board: [-42.6, 2.6, -8.4],
          stations: [
            {
              label: 'North',
              boardPoint: [0, 2.6, 34.2],
              queueAnchor: [0, 0.05, 32.41],
              queueDir: [0, -1],
              exitPoint: [-1.2, 0.05, 33.03],
              exitDir: [0, -1],
            },
            {
              label: 'East',
              boardPoint: [42.6, 2.6, -8.4],
              queueAnchor: [40.81, 0.05, -8.4],
              queueDir: [-1, 0],
              exitPoint: [41.43, 0.05, -7.2],
              exitDir: [-1, 0],
            },
            {
              label: 'South',
              boardPoint: [0, 2.6, -51.0],
              queueAnchor: [0, 0.05, -52.79],
              queueDir: [0, -1],
              exitPoint: [1.2, 0.05, -52.17],
              exitDir: [0, -1],
            },
          ],
        }}
      />

      {/* ── the rest of the roster ── */}
      <LogFlume
        position={FLUME.pad}
        rotation={FLUME.yaw}
        register={{ name: 'Castaway Log Run', capacity: 4, rideDuration: 12, intensity: 4, price: 4 }}
        queue={{ anchor: FLUME.anchor, dir: FLUME.dir }}
      />
      <Chairlift
        position={LIFT.pad}
        rotation={LIFT.yaw}
        register={{ name: 'Caldera Chairlift', capacity: 4, rideDuration: 12, intensity: 2, price: 2 }}
        queue={{ anchor: LIFT.anchor, dir: LIFT.dir }}
      />
      <GhostTrain
        position={GHOST.pad}
        rotation={GHOST.yaw}
        register={{ name: 'Hollow Manor Express', capacity: 4, rideDuration: 11, intensity: 5, price: 4 }}
        queue={{ anchor: GHOST.anchor, dir: GHOST.dir }}
      />
      <FerrisWheel
        position={WHEEL.pad}
        rotation={WHEEL.yaw}
        register={{ name: 'Aurora Wheel', capacity: 4, rideDuration: 10, intensity: 2, price: 3 }}
        queue={{ anchor: WHEEL.anchor, dir: WHEEL.dir }}
      />
      <Carousel
        position={CAROUSEL.pad}
        rotation={CAROUSEL.yaw}
        register={{ name: 'Gilded Gallopers', capacity: 6, rideDuration: 9, intensity: 1, price: 2 }}
        queue={{ anchor: CAROUSEL.anchor, dir: CAROUSEL.dir }}
      />
      <Discotron
        position={DISCO.pad}
        rotation={DISCO.yaw}
        register={{ name: 'Voltage Spinner', capacity: 8, rideDuration: 10, intensity: 6, price: 4 }}
        queue={{ anchor: DISCO.anchor, dir: DISCO.dir }}
      />
      <MagneticRide
        position={MAG.pad}
        rotation={MAG.yaw}
        register={{ name: 'Lodestone Loop', capacity: 6, rideDuration: 11, intensity: 7, price: 5 }}
        queue={{ anchor: MAG.anchor, dir: MAG.dir }}
      />
      <Helicycles
        position={HELI.pad}
        rotation={HELI.yaw}
        register={{ name: 'Sky Pedallers', capacity: 4, rideDuration: 9, intensity: 2, price: 3 }}
        queue={{ anchor: HELI.anchor, dir: HELI.dir }}
      />

      {/* ── amenities ── */}
      <Restroom position={RESTROOM} rotation={Math.PI / 2} />

      {/* ── the set-pieces, AFTER <Paths> ── */}
      <FountainPlaza plan={HUB} />
      <Boulevard plan={GATE_AVE} />
      <Boulevard plan={WEST_AVE} />
      <Bazaar plan={WORKS} />
      <Bazaar plan={NIGHT} />
      <Bazaar plan={COVE} />

      {/* ── the three worlds ── */}
      <World plan={FIRE_WORLD} />
      <World plan={NEON_WORLD} />
      <World plan={COVE_WORLD} />

      {/* ── night dressing ── */}
      <Lights from={[3.6, 57.6]} to={[-3.6, 57.6]} />
      <Lights from={[16.8, 48.0]} to={[16.8, 43.2]} />
      <Lights from={[-16.8, 12.0]} to={[-9.6, 12.0]} />
      <Torch position={[7.2, 54.0]} />
      <Torch position={[-7.2, 54.0]} />
      <Torch position={[16.8, 39.6]} />
      <Torch position={[-18.0, 45.6]} />
      <Neon text="AURORA" position={[6.0, 1.7, 57.6]} rotation={Math.PI} scale={0.55} />
      <Neon text="VOLTAGE" position={[9.6, 1.7, 24.0]} rotation={0} scale={0.5} />

      {/* ── the sieved dressing (the gate's own dryness predicate) ── */}
      <DryScatter
        cells={PADS.map((p) => ({ at: p.pad }))}
        label="pads"
        render={() => null}
      />
      <DryScatter
        cells={TREES}
        label="trees"
        render={(t, i) => (
          <Placed
            key={`tr-${i}`}
            position={t.at}
            build={(three: any) => tree(three, { shape: t.shape })}
          />
        )}
      />
      <DryScatter cells={PROPS} label="props" render={renderProp} />
    </Park>
  );
}

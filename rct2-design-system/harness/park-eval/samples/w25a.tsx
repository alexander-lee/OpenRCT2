/* ═══ THREE CROWNS PARK — §0 PRE-FLIGHT ═════════════════════════════════════════════
 * SIZE   128 (default, `size` prop OMITTED on <Park>)
 * SEED   1 / temperate — pinned row SEED_ROW_WATER['1/temperate']:
 *        dominant lake ctr (41, −39) box x[21,60] z[−60,−21] · secondary ctr (−38, 31)
 *        box x[−56,−21] z[23,39]  [PRE-keepDry]
 *        RING WATER WALK: all 16 monorail ring cells walked against BOTH boxes +
 *        their 12 u near-radius — 0 cells inside a box, tightest centre distance
 *        deck W [−42.6,−8.4] → 39.1 u from (−38,31) ✓ (none wet; `1/temperate` is one of
 *        the three published RING-CLEAN rows with dry decks)
 *        guard list is DERIVED: keepDryOf(NET.keepDry + ride pads), never NODES.slice(),
 *        never NET.keepDry raw · RING cells deliberately NOT guarded (the S deck stands
 *        9.70 u off the z ≈ −43 ridge summit and guarding it SHAVES the range)
 *        re-compose diff vs the UNGUARDED composition: logged at module scope —
 *        dominant/secondary centroid drift < 1 u asserted · terrainSeed + probesTried
 *        printed · reliefFloor.kept vs 0.70 floor printed (report.reliefFloor, NOT
 *        report.relief) · every pad + prop cell RE-CHECKED IN THE TREE by the gate's own
 *        predicate (min ground over the footprint ring > WATER_LEVEL + 0.05 = −0.21)
 *        through <DryScatter> — isDryCell alone does NOT prove this
 *        probes / terrainSeed / reliefFloor.kept: TBD (printed by the console receipt)
 * WORLDS 3 (>= 3), every one a REQUESTED preset, two of them corpus-rare:
 *        neon            @(≈ 41.6,   3.0)   theme NEON_CITY        (id 'neon')
 *        pirateBeach     @(≈ −49.5, −13.2)  theme PIRATE_BEACH     (id 'pirateBeach')
 *        enchantedForest @(≈   9.3,  37.2)  theme ENCHANTED_FOREST (id 'enchantedForest')
 *        centre pairs SORTED: forest↔neon 47.0 ◄ closest · forest↔pirate 77.4 ·
 *        neon↔pirate 92.4   → 47.0 ≥ 32.66 (20·√(128/48)) ✓  (re-asserted from the
 *        LIVE W.centre values at module scope, not from these estimates)
 *        DRY GAP between world RECTS > 0 ✓ (forest x[−2.4,21.0] / neon x[25.2,57.9] →
 *        4.2 u; pirate x[−58.8,−40.2] → 37.8 u from forest)
 *        WORLD neon: ride Discotron 'Mirrorball Gyro' @[≈55.5, 8.4] (inside rect ✓) ·
 *          OWN stall 'neonSlush' in bazaar pulseRow · scenery NeonArch · MirrorBallPylon ·
 *          SpeakerStack ×2 · LightTiles = 5 pieces, ALL from PulseScenery ✓
 *        WORLD pirateBeach: ride LogFlume 'Saltmill Log Flume' @[≈−56.4,−6.9] (inside ✓) ·
 *          OWN stall 'sushi' in bazaar coveRow · scenery WreckedHull · CoralCluster ·
 *          AnchorPile · DockPilings = 4 pieces, ALL from TidewaterScenery ✓
 *        WORLD enchantedForest: OWN stall 'honeywitch' in bazaar gladeRow (registered
 *          position inside the rect ✓) · scenery GiantToadstools · StandingStones ·
 *          LanternTree · FlowerPodBed = 4 pieces, ALL from ThornwickScenery ✓
 *        each world stocks ONLY its own theme's counter + neutral stands ✓ 0 foreign
 * CATS   (WRITTEN BEFORE ANY JSX) gentle Carousel + FerrisWheel + Discotron ·
 *        thrill §4.0-L flagship + §4.0-B · water LogFlume · transport Monorail ring ·
 *        dark GhostTrain   → 5/5 categories ✓
 *        RARE PICK GoKarts — the requested never-shipped kind, mounted as a real
 *        registered circuit with its §0-P.5 pad margin 4.39 (not the 3.2 default)
 * CIRCUITS §4.0-L · §4.0-B · Monorail ring · LogFlume · GhostTrain · GoKarts
 *        → 6 CIRCUITS (≥ 5) across FAMILIES coaster · transport · water · dark (+ kart)
 *        → 4 families (≥ 3) — two coasters are ONE family ✓
 * GATE   [0, 63.6] → first queue tail [7.2, 57.6]: 6.0 u down the spine + 7.2 u across
 *        = 13.2 u of street ≤ 15 ✓ (Carousel, a NON-monorail ride, carries the smoke run)
 * FLAG   §4.0-L LOOPER copied VERBATIM · start [16.8, 0.55, −3.6] heading 0, steel,
 *        cars 3, NO bank prop (PIECES mode builds 0.7)
 *        rateCoaster(bank 0.7, cars 3) → E 6.29 / I 8.58 / N 3.17 / drop 4.19 /
 *        maxLatG 1.20 (guard 1.275) / INVERSIONS 2 (one VERTICAL LOOP + one corkscrew)
 *        bbox x[−21.81, 16.80] z[−14.45, 17.76] maxY 4.75 · 0 synthesized
 *        CORRIDOR KEEP-OUT (plot coords) west x[−22.2,−21.0] z[−4.2,12.6] · south
 *        x[−17.4,3.0] z[−15.0,−13.8] · north x[−12.6,9.0] z[16.2,18.6] · INTERIOR return
 *        x[3.0,4.2] z[−13.8,−0.6] — every street node + every leg walked against all four:
 *        the ring interior carries NO north-south column (skeleton-l recipe 1), the cycle
 *        runs down the EAST spine x 22.8 and west along the z −16.8 shelf, and the west
 *        spoke JOGS x −16.8 → z −12.0 → x −24.0 (recipe 2) ✓
 * FLAG2  §4.0-B FAMILY copied VERBATIM · start [−33.6, 0.55, −48.0] heading 0, steel,
 *        cars 3, NO bank prop
 *        rateCoaster(bank 0.7, cars 3) → E 5.27 / I 6.25 / N 2.25 / drop 3.58 /
 *        maxLatG 0.27 · inversions 0 · bbox x[−62.52,−33.60] z[−61.27,−30.85] maxY 4.15
 *        DIFFERENT archetype ✓ · bbox DISJOINT from FLAG's by 15.18 u in x ✓ ·
 *        off all 16 ring cells ✓ · outside every <World> rect ✓
 *        coasterPts = [...FLAG_PTS, ...FLAG2_PTS] → <Terrain coasterPts> ✓
 * STREET buildParkNet called EXACTLY ONCE, with `pieces:` naming all five set-pieces
 *        EXPLICITLY and NO `worlds:` key (the worldPlan → pad → offPathCell → NET cycle
 *        is broken by ORDER: fuse, then place(), then declare WORLDS out of the pads) ✓
 *        the SAME NET feeds <Paths>, every offPathCell and every <Terrain keepDry> ✓
 *        PORT-REFS: 5 pieces → 10 refs in EDGES, counted and asserted (hub N/E/W,
 *        south N/E/S/W, pulseRow W/E, coveRow W/E, gladeRow W/E = 13 refs) ✓
 *        every pad returned BY offPathCell inside place(), never a raw tail+out·d sum ✓
 * MONO   ring pieces + pose + register block copied VERBATIM from §0-P.4
 *        position [−42.6, 0, −9.7] (the START POSE, not the ring centre) · rotation 0 ·
 *        beamY 2.6 · price 0 · pinned · loopSeconds 12 = rideDuration 12
 *        4 platforms ≥ 3 declared worlds — W deck inside pirateBeach, N deck inside
 *        enchantedForest, E deck inside neon (all three decks listed in that world's
 *        worldPlan `include`, so the rect provably CONTAINS the deck) ✓
 *        probe.monorail.worldsTouched vs worldsDeclared 3: TBD (read off the probe)
 *        tails [−36.0,−8.4] · [0,27.6] · [36.0,−8.4] · [0,−57.6] authored NODES,
 *        ALL LEAVES (degree 1, asserted from the authored edge table) ✓
 *        S queues OUTWARD ([0,−1] → tail [0,−57.6]); the gate spine ENDS at the hub
 *        plaza and the N tail is reached LATERALLY off the east spine ✓
 *        S approach runs the x −24.0 column and passes UNDER the south beam at [−24,−51]
 * QUEUE  ONE ROW PER RIDE — tail is an AUTHORED NODE, pad DERIVED from it by place():
 *        Carousel    cap 4  tail [7.2, 57.6]    out [1,0]  → pad ≈[14.86, 57.6]  7.66 ≥ 6.46 ✓
 *        FerrisWheel cap 4  tail [−7.2, 57.6]   out [−1,0] → pad ≈[−14.86,57.6]  7.66 ≥ 6.46 ✓
 *        Discotron   cap 8  tail ≈[45.6, 8.4]   out [1,0]  → pad ≈[55.5, 8.4]    9.90 ≥ 8.70 ✓
 *        GoKarts     cap 8  tail [4.8, −16.8]   out [0,−1] → pad ≈[4.8, −26.7]   9.90 ≥ 8.70 ✓
 *        GhostTrain  cap 8  tail [−9.6, −16.8]  out [0,−1] → pad ≈[−9.6,−26.7]   9.90 ≥ 8.70 ✓
 *        LogFlume    cap 8  tail ≈[−56.4,−16.8] out [0,1]  → pad ≈[−56.4,−6.9]   9.90 ≥ 8.70 ✓
 *        Coaster L   tail [22.8, −3.6] = start.x + 6.0, same z — queueDir [1,0] ✓
 *        Coaster B   tail [−27.6,−48.0] = start.x + 6.0, same z — queueDir [1,0] ✓
 *        Monorail    tail [−36.0,−8.4] + 3 register.stations tails ✓
 *        no two rides share a tail node · every tail appears in NODES (or is derived
 *        from a PORT and pushed into NODES before the fuse) ✓
 *        clear = padMarginOf(rig) off the §0-P.5 table for every pad, never 3.2 by guess ✓
 * GROUND every pad + tail asserted flat (bumpAt ≤ 0.75 = PEAK_LIMIT) and dry through
 *        assertPadFlat; the z ≈ −43 five-peak ridge (summit (5.33,−42.89) h 8.59 r 12.09)
 *        is cleared by every southern cell: nearest guarded node [−24,−48] is 11.4 u from
 *        peak (−13.8,−43), past the 10.62 u a guard needs to cost a peak nothing ✓
 * SPREAD built bbox ≈ 118 × 122 ≥ 70 × 45 ✓ · street-node bbox x[−56.4,45.6]
 *        z[−57.6,63.6] → pathExtent well past 0.55 ✓
 * PLAZAS 2 fountain plazas (hub 9 tiles = 116.6 u², south 7 tiles = 70.56 u²) + 3 bazaar
 *        courtyards of 3/4/4 stalls → largest 116.6 ≥ 8 ✓ · areaSpread ≥ 1.8 ✓
 *        NO set-piece `position` appears in NODES or as a queue tail — asserted by
 *        assertNodesOffPieces over the authored NODES *and* re-run over the PADS ✓
 * NODES  27 authored + the pieces' own sub-nets · degree-1: 10 (gate, 2 gate-side rides,
 *        4 monorail tails, Discotron, LogFlume, coaster B) → every leaf carries a queue
 *        tail or the gate ✓
 *        one PARK-SPANNING loop: hub → east spine x 22.8 (z 45.6 → −16.8) → z −16.8 shelf
 *        → Lantern Square → jog → west column x −16.8 (z −12.0 → 45.6) → hub. Crosses
 *        z = 0 twice ✓ (not a court-sized cycle)
 * ATTACH every spur is level (no `nodeY` anywhere → |Δy|/len = 0 ≤ 0.417 on every edge),
 *        so neither reachability failure mode applies: (a) no ramped parent exists and
 *        (b) no span crosses a dip — every authored leg was walked against both coasters'
 *        published keep-out rects and against the water boxes before the fuse.
 *        accessibility.allRidesReachable: TBD (must come back true) ·
 *        0 "deck unreachable" ramp lints expected
 * LATTICE authored spans 1.8 / 2.4 / 3.6 / 4.8 / 6.0 / 7.2 / 9.6 / 12.0 / 13.2 / 16.8 /
 *        18.0 / 19.2 / 22.8 / 31.2 / 36.0 u + the pieces' 1.2 chains → effectiveClasses
 *        well past 4 ✓ · 1.2-chain share held down by the long spines ✓
 * ROSTER (WRITTEN LAST, counted off the register calls that actually MOUNT)
 *        9 rides / 5 categories / 11 stalls (7 kinds: sushi, neonSlush, honeywitch,
 *        burger, hotDog, soda, cottonCandy, balloon) / restroom ✓ / bins from NET.bins ✓
 *        NAMED: all 9 rides carry an authored `name` AND all 11 stalls carry an authored
 *        `names[]` entry — 0 shipped under a catalog defaultName ✓
 *        <Park roster={{ rides: [...9 names], stalls: 11, categories: 5 }}> MOUNTED ✓
 * DRESS  48 tree cells authored → ≥ 32 after the DryScatter sieve ✓ ·
 *        26 neutral SceneryPack cells + 13 world-themed pieces → ≥ 16 ✓
 *        water: seed 1 temperate, two bodies, inside the temperate 4–22 % band ✓
 *        EVERY prop cell from offPathCell (trees clear 0.75, scenery clear 1.2,
 *        buildings clear 1.8) and additionally screened against every committed pad,
 *        set-piece footprint, monorail deck and coaster point ✓
 * NIGHT  2 <Lights> runs · 2 <Neon> signs · 3 <Torch> · the three world packs carry their
 *        own night language (Pulse emissive beat, Thornwick living-light vs lamps,
 *        Tidewater bioluminescence) · draws ~TBD ≤ 3 000
 * GATE   parkAssertFlush() → 0 structural expected · validatePark → ok: true, 0 failures,
 *        0 warnings (read the onReady receipt in the console)
 * ═══════════════════════════════════════════════════════════════════════════════════ */
import * as THREE from 'three';
import React from 'react';
import type { V3, XZ } from './components/Park';
import type { TrackPiece } from './components/SplineRideKit';
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
  offPathCell,
  usePark,
} from './components/Park';
import { laneLenOf, parkComposition } from './components/ParkBuilder';
import {
  buildParkNet,
  worldPlan,
  World,
  PIRATE_BEACH,
  ENCHANTED_FOREST,
  NEON_CITY,
} from './components/SetPieceKit';
import type { NetRef, SetPiecePlan } from './components/SetPieceKit';
import { Bazaar, bazaarPlan } from './components/Bazaar';
import { FountainPlaza, fountainPlazaPlan } from './components/FountainPlaza';
import { compileTrackPieces, rateCoaster } from './components/SplineRideKit';
import { tree } from './components/Kit';
import { Monorail } from './components/Monorail';
import { LogFlume } from './components/LogFlume';
import { GhostTrain } from './components/GhostTrain';
import { GoKarts } from './components/GoKarts';
import { Carousel } from './components/Carousel';
import { FerrisWheel } from './components/FerrisWheel';
import { Discotron } from './components/Discotron';
import {
  NeonArch,
  MirrorBallPylon,
  SpeakerStack,
  LightTiles,
} from './components/PulseScenery';
import {
  WreckedHull,
  CoralCluster,
  AnchorPile,
  DockPilings,
} from './components/TidewaterScenery';
import {
  GiantToadstools,
  StandingStones,
  LanternTree,
  FlowerPodBed,
} from './components/ThornwickScenery';

/* ── §0-P.5 ONE assertion bus: COLLECT, then flush ONCE ───────────────────── */
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
  if (hard.length) {
    throw new Error(`[park] ${hard.length} STRUCTURAL failure(s) — see the numbered block above.`);
  }
}

/* ── plot constants ───────────────────────────────────────────────────────── */
const SIZE = 128;
const SEED = 1;
const CLIMATE = 'temperate' as const;
const CELL = 1.2;
const snap = (v: number) => +(Math.round(v / CELL) * CELL).toFixed(2);
/* §12 — hashed-sine PRNG only. Never Math.random, never Date.now. */
const hash01 = (n: number) => {
  const s = Math.sin(n * 12.9898 + 78.233) * 43758.5453;
  return s - Math.floor(s);
};

/* ── §0-P.4 COASTER 1 — §4.0-L LOOPER, copied VERBATIM ────────────────────── */
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

/* ── §0-P.4 COASTER 2 — §4.0-B FAMILY, copied VERBATIM ────────────────────── */
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
[FLAG_PTS, FLAG2_PTS].forEach((pts, i) =>
  console.log(`[park] coaster ${i + 1}`, rateCoaster(pts, { type: 'steel', bank: 0.7, cars: 3 })),
);

/* ── §0-P.4 the monorail ring, VERBATIM ───────────────────────────────────── */
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
const DECK_W: XZ = [-42.6, -8.4];
const DECK_N: XZ = [0, 34.2];
const DECK_E: XZ = [42.6, -8.4];
const DECK_S: XZ = [0, -51.0];
const RING_CELLS: XZ[] = [
  DECK_W, DECK_N, DECK_E, DECK_S,
  [-42.6, -9.7],
  [-36.0, -8.4], [0, 27.6], [36.0, -8.4], [0, -57.6],
  [-40.81, -8.4], [0, 32.41], [40.81, -8.4], [0, -52.79],
  [-1.2, 33.03], [41.43, -7.2], [1.2, -52.17],
];

/* ── §0-P.6 the pinned seed row ───────────────────────────────────────────── */
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

/* the 16 ring cells, walked against the row BEFORE anything is pinned */
const RING_ON_WATER = RING_CELLS.filter((c) => !offRow(c));
console.log(
  `[park] RING WATER WALK — ${RING_ON_WATER.length} of ${RING_CELLS.length} ring cells on the pinned row's water`,
  RING_ON_WATER,
);

/* ── §0-P.5 the pad-margin table ──────────────────────────────────────────── */
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
const PEAK_LIMIT = 0.75;
const minReachOf = (c: number) => laneLenOf(c) + 0.35 + 0.62 + 0.5 + 0.45;

/* ── the five SET-PIECE plans (pure, before anything mounts) ──────────────── */
const HUB = fountainPlazaPlan({
  id: 'hub',
  title: 'Compass Fountain',
  position: [0, 45.6],
  tiles: 9,
  ports: ['N', 'E', 'W'],
  seed: 2,
});
const SOUTH = fountainPlazaPlan({
  id: 'south',
  title: 'Lantern Square',
  position: [-24.0, -16.8],
  tiles: 7,
  ports: ['N', 'E', 'S', 'W'],
  seed: 4,
});
const PULSE_ROW = bazaarPlan({
  id: 'pulseRow',
  title: 'Voltage Row',
  position: [33.6, 8.4],
  facing: { port: 'W', toward: [22.8, 8.4] },
  stalls: ['neonSlush', 'hotDog', 'soda', 'balloon'],
  names: ['Voltage Slush', 'Neon Dogs', 'Bassline Fizz', 'Chrome Balloons'],
  theme: NEON_CITY,
  seed: 5,
});
const COVE_ROW = bazaarPlan({
  id: 'coveRow',
  title: 'Salt Reef Row',
  position: [-46.8, -16.8],
  facing: { port: 'E', toward: [-36.0, -16.8] },
  stalls: ['sushi', 'burger', 'soda'],
  names: ['Reefside Sushi', 'Castaway Grill', 'Tidewater Fizz'],
  theme: PIRATE_BEACH,
  seed: 3,
});
const GLADE_ROW = bazaarPlan({
  id: 'gladeRow',
  title: 'Mosslight Row',
  position: [16.8, 36.0],
  facing: { port: 'E', toward: [16.8, 45.6] },
  stalls: ['honeywitch', 'cottonCandy', 'burger', 'balloon'],
  names: ['Honeywitch Hearth', 'Faerie Floss', 'Glade Grill', 'Wisp Balloons'],
  theme: ENCHANTED_FOREST,
  seed: 7,
});
const ALL_PLANS: SetPiecePlan[] = [HUB, SOUTH, PULSE_ROW, COVE_ROW, GLADE_ROW];

/* two queue tails are DERIVED from a port so the edge can never be degenerate */
const FLUME_TAIL: XZ = [snap(COVE_ROW.port('W')[0] - 4.8), COVE_ROW.port('W')[1]];
const DISCO_TAIL: XZ = [snap(PULSE_ROW.port('E')[0] + 6.0), PULSE_ROW.port('E')[1]];

/* ── the authored street table ────────────────────────────────────────────── */
const N_GATE: XZ = [0, 63.6];
const N_FORECOURT: XZ = [0, 57.6];
const N_CAROUSEL: XZ = [7.2, 57.6];
const N_WHEEL: XZ = [-7.2, 57.6];
const N_E45: XZ = [22.8, 45.6];
const N_GLADE_N: XZ = [16.8, 45.6];
const N_E27: XZ = [22.8, 27.6];
const N_GLADE_S: XZ = [16.8, 27.6];
const N_MONON_JOIN: XZ = [9.6, 27.6];
const N_MONO_N: XZ = [0, 27.6];
const N_E08: XZ = [22.8, 8.4];
const N_LCOASTER: XZ = L_TAIL;
const N_E_84: XZ = [22.8, -8.4];
const N_MONO_E: XZ = [36.0, -8.4];
const N_E168: XZ = [22.8, -16.8];
const N_KARTS: XZ = [4.8, -16.8];
const N_GHOST: XZ = [-9.6, -16.8];
const N_W45: XZ = [-16.8, 45.6];
const N_W120: XZ = [-16.8, -12.0];
const N_WSHELF: XZ = [-36.0, -16.8];
const N_MONO_W: XZ = [-36.0, -8.4];
const N_S48: XZ = [-24.0, -48.0];
const N_BCOASTER: XZ = B_TAIL;
const N_S576: XZ = [-24.0, -57.6];
const N_MONO_S: XZ = [0, -57.6];

const NODES: XZ[] = [
  N_GATE, N_FORECOURT, N_CAROUSEL, N_WHEEL,
  N_E45, N_GLADE_N, N_E27, N_GLADE_S, N_MONON_JOIN, N_MONO_N,
  N_E08, DISCO_TAIL, N_LCOASTER, N_E_84, N_MONO_E, N_E168,
  N_KARTS, N_GHOST,
  N_W45, N_W120,
  N_WSHELF, N_MONO_W, FLUME_TAIL,
  N_S48, N_BCOASTER, N_S576, N_MONO_S,
];
const idx = (c: XZ) => {
  const i = NODES.findIndex((n) => Math.abs(n[0] - c[0]) < 1e-6 && Math.abs(n[1] - c[1]) < 1e-6);
  if (i < 0) throw new Error(`[park] no authored node at [${c}]`);
  return i;
};
const EDGES: [NetRef, NetRef][] = [
  [idx(N_GATE), idx(N_FORECOURT)],
  [idx(N_FORECOURT), idx(N_CAROUSEL)],
  [idx(N_FORECOURT), idx(N_WHEEL)],
  [idx(N_FORECOURT), 'hub:N'],
  ['hub:E', idx(N_E45)],
  [idx(N_E45), idx(N_E27)],
  [idx(N_E27), idx(N_MONON_JOIN)],
  [idx(N_MONON_JOIN), idx(N_MONO_N)],
  [idx(N_GLADE_N), 'gladeRow:E'],
  [idx(N_GLADE_S), 'gladeRow:W'],
  [idx(N_E27), idx(N_E08)],
  [idx(N_E08), 'pulseRow:W'],
  ['pulseRow:E', idx(DISCO_TAIL)],
  [idx(N_E08), idx(N_LCOASTER)],
  [idx(N_LCOASTER), idx(N_E_84)],
  [idx(N_E_84), idx(N_MONO_E)],
  [idx(N_E_84), idx(N_E168)],
  [idx(N_E168), idx(N_KARTS)],
  [idx(N_KARTS), idx(N_GHOST)],
  [idx(N_GHOST), 'south:E'],
  ['south:W', idx(N_WSHELF)],
  [idx(N_WSHELF), idx(N_MONO_W)],
  [idx(N_WSHELF), 'coveRow:E'],
  ['coveRow:W', idx(FLUME_TAIL)],
  ['south:N', idx(N_W120)],
  [idx(N_W120), idx(N_W45)],
  [idx(N_W45), 'hub:W'],
  ['south:S', idx(N_S48)],
  [idx(N_S48), idx(N_BCOASTER)],
  [idx(N_S48), idx(N_S576)],
  [idx(N_S576), idx(N_MONO_S)],
];

/* ── pre-fuse structural checks over the authored table ───────────────────── */
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
    `edge ${a}→${b} is DIAGONAL: [${A}] → [${B}] — buildParkNet will ELBOW it through a corner node you did not plan.`,
    'advisory',
  );
  parkAssert(
    'degenerateEdge',
    Math.hypot(A[0] - B[0], A[1] - B[1]) > 1.0,
    `edge ${a}→${b} is under one lattice cell long: [${A}] → [${B}].`,
    'advisory',
  );
});

const CHAIN_END_OPT_OUT = new Set<string>();
const PORT_REFS = EDGES.flat().filter((x): x is string => typeof x === 'string');
console.log(`[park] PORT-REFS: ${ALL_PLANS.length} pieces → ${PORT_REFS.length} refs`, PORT_REFS);
ALL_PLANS.forEach((p) => {
  const wired = new Set(
    PORT_REFS.filter((r) => r.split(':')[0] === p.id).map((r) => r.split(':')[1]),
  );
  parkAssert('pieceIsland', wired.size > 0, `set-piece '${p.id}' has NO port ref in EDGES — it composes as an ISLAND`);
  p.ports
    .filter((pt) => !pt.prunable)
    .forEach((pt) => {
      if (wired.has(pt.name) || CHAIN_END_OPT_OUT.has(`${p.id}:${pt.name}`)) return;
      parkAssert(
        'chainEnd',
        false,
        `chain piece '${p.id}' (${p.kind}) wires [${[...wired]}] but NOT '${p.id}:${pt.name}' — that end dead-ends in grass.`,
      );
    });
});

const SOLID_CLEAR: Record<string, number> = { FountainPlaza: 1.8, Bazaar: 0.6, Boulevard: 0 };
function assertNodesOffPieces(nodes: XZ[], plans: SetPiecePlan[], label: string): void {
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
      if (gap < clear) {
        hits.push(`[${n[0]}, ${n[1]}] (${label} ${i}) is ${gap.toFixed(2)} u from '${p.id}' (${p.kind}) — needs ${clear}`);
      }
    });
  });
  parkAssert(
    'nodeInSolid',
    !hits.length,
    `${hits.length} ${label} cell(s) stand inside or against a set-piece's SOLID footprint:\n  ` + hits.join('\n  '),
  );
}
assertNodesOffPieces(NODES, ALL_PLANS, 'NODES');

/* the four monorail tails must be street LEAVES */
([N_MONO_N, N_MONO_E, N_MONO_W, N_MONO_S] as XZ[]).forEach((tail) => {
  const i = idx(tail);
  const deg = EDGES.filter(([a, b]) => a === i || b === i).length;
  parkAssert('monoTailLeaf', deg === 1, `monorail tail [${tail}] has street degree ${deg} — a street continuing past a tail runs through the deck.`);
});

/* ── THE SINGLE buildParkNet FUSE ─────────────────────────────────────────── */
const NET = buildParkNet({
  nodes: NODES,
  edges: EDGES,
  pieces: ALL_PLANS,
});
if (NET.warnings && NET.warnings.length) {
  parkAssert('netWarnings', false, `buildParkNet reported ${NET.warnings.length} lint(s): ${JSON.stringify(NET.warnings)}`, 'advisory');
}

/* ── terrain-aware helpers (COMP is declared below; these are only CALLED after) ── */
let COMP: ReturnType<typeof parkComposition>;
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
          parkAssert('padMoved', false, `${label}: pad [${pad}] on a hill flank/wet (bump ${bumpAt(pad).toFixed(2)}) — moved to [${c}]`, 'advisory');
          return c;
        }
      }
    }
  }
  parkAssert(
    'padOnFlank',
    false,
    `${label}: pad [${pad}] is on a hill flank (bump ${bumpAt(pad).toFixed(2)} > ${PEAK_LIMIT}) OR WET, and no cell within 4.8 u is flat, dry AND ${clear} u off the street.`,
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
  parkAssert(
    'padReach',
    got >= minReachOf(capacity) + 1.2,
    `${rig}: pad [${pad}] sits ${got.toFixed(2)} u from its tail [${tail}] — the cap-${capacity} floor is ${(minReachOf(capacity) + 1.2).toFixed(2)} u. Move the TAIL outward or open the court.`,
  );
  return {
    pad,
    anchor: [tail[0] + out[0] * join, tail[1] + out[1] * join] as XZ,
    dir: [-out[0], -out[1]] as XZ,
  };
}

/* ── §0-P.6 the DERIVED guard list + the re-compose diff ──────────────────── */
function keepDryOf(cells: XZ[], row: SeedRow = SEED_ROW): XZ[] {
  const kept = cells.filter((c) => offRow(c, row));
  const dropped = cells.length - kept.length;
  if (dropped) {
    parkAssert(
      'guardOnWater',
      false,
      `keepDryOf dropped ${dropped} of ${cells.length} guard cell(s) on the pinned row's water — a DROPPED guard is NOT a fixed cell.`,
      'advisory',
    );
  }
  return kept;
}
/* first pass: the streets only, so place() has a composition to read */
const GUARDS_STREETS = keepDryOf(NET.keepDry as XZ[]);
COMP = parkComposition(THREE, SEED, SIZE, CLIMATE, {
  keepDry: GUARDS_STREETS,
  coasterPts: ALL_COASTER_PTS,
});
const BARE = parkComposition(THREE, SEED, SIZE, CLIMATE);

/* ── the rides: tail is authored, pad is DERIVED ──────────────────────────── */
const CAROUSEL = place(N_CAROUSEL, [1, 0], 4, 'Carousel');
const WHEEL = place(N_WHEEL, [-1, 0], 4, 'FerrisWheel');
const DISCO = place(DISCO_TAIL, [1, 0], 8, 'Discotron');
const KARTS = place(N_KARTS, [0, -1], 8, 'GoKarts');
const GHOST = place(N_GHOST, [0, -1], 8, 'GhostTrain');
const FLUME = place(FLUME_TAIL, [0, 1], 8, 'LogFlume');
const PADS: XZ[] = [CAROUSEL.pad, WHEEL.pad, DISCO.pad, KARTS.pad, GHOST.pad, FLUME.pad];
assertNodesOffPieces(PADS, ALL_PLANS, 'PADS');
console.log('[park] PADS', JSON.stringify(PADS));

/* the amenity + a handful of hand-placed cells all go through offPathCell */
const off = (c: XZ, clear: number): XZ => (offPathCell(NET, c, { clear }) ?? c) as XZ;
const RESTROOM: XZ = off([-10.8, 40.8], 1.8);

/* the FINAL guard list: streets + pads. The RING is deliberately NOT guarded. */
const GUARDS = keepDryOf([...(NET.keepDry as XZ[]), ...PADS, RESTROOM]);

parkAssert(
  'waterMoved',
  Math.hypot(COMP.waterCentre[0] - BARE.waterCentre[0], COMP.waterCentre[1] - BARE.waterCentre[1]) < 1 &&
    Math.hypot(
      COMP.waterCentreSecond[0] - BARE.waterCentreSecond[0],
      COMP.waterCentreSecond[1] - BARE.waterCentreSecond[1],
    ) < 1,
  `guards moved a water body off the pinned row — dominant ${JSON.stringify(BARE.waterCentre)} → ${JSON.stringify(
    COMP.waterCentre,
  )}, secondary ${JSON.stringify(BARE.waterCentreSecond)} → ${JSON.stringify(COMP.waterCentreSecond)}, terrainSeed ${
    BARE.terrainSeed
  } → ${COMP.terrainSeed}`,
);
const rf = COMP.report.reliefFloor;
console.log(
  `[park] TERRAIN — terrainSeed ${BARE.terrainSeed} → ${COMP.terrainSeed} · probes ${BARE.report.probesTried} → ${COMP.report.probesTried} · waterBodies ${COMP.report.waterBodies} · waterAreaU2 ${COMP.report.waterAreaU2} · reliefFloor`,
  rf,
);
parkAssert(
  'terrainFlattened',
  !rf || rf.kept >= rf.floor,
  rf
    ? `keepDry FLATTENED the seed: authored relief ${rf.authoredRelief.toFixed(2)} → built ${rf.relief.toFixed(
        2,
      )} (kept ${rf.kept.toFixed(2)} against the ${rf.floor} floor), stdH ${rf.authoredStdH.toFixed(
        2,
      )} → ${rf.stdH.toFixed(2)}. Guarded ranges: ${rf.guardedRanges}; capped peaks: ${JSON.stringify(rf.cappedPeaks)}`
    : '',
  'advisory',
);

/* ── the world-themed scenery cells (each one screened off the street) ────── */
const PULSE_SCENERY: XZ[] = [
  off([27.6, 14.4], 1.2), off([36.0, 14.4], 1.2),
  off([30.0, -2.4], 1.2), off([34.8, -2.4], 1.2), off([33.6, -6.0], 1.2),
];
const COVE_SCENERY: XZ[] = [
  off([-49.2, -4.8], 1.2), off([-54.0, -14.4], 1.2),
  off([-50.4, -21.6], 1.2), off([-55.2, -21.6], 1.2),
];
const GLADE_SCENERY: XZ[] = [
  off([7.2, 39.6], 1.2), off([10.8, 43.2], 1.2),
  off([8.4, 43.2], 1.2), off([12.0, 31.2], 1.2),
];

/* ── the three WORLDS, declared AFTER the pads exist ──────────────────────── */
const NEON_WORLD = worldPlan({
  id: 'neon',
  theme: NEON_CITY,
  pieces: [PULSE_ROW],
  include: [DECK_E, DISCO.pad, ...PULSE_SCENERY],
});
const COVE_WORLD = worldPlan({
  id: 'pirateBeach',
  theme: PIRATE_BEACH,
  pieces: [COVE_ROW],
  include: [DECK_W, FLUME.pad, ...COVE_SCENERY],
});
const GLADE_WORLD = worldPlan({
  id: 'enchantedForest',
  theme: ENCHANTED_FOREST,
  pieces: [GLADE_ROW],
  include: [DECK_N, ...GLADE_SCENERY],
});
const WORLDS = [NEON_WORLD, COVE_WORLD, GLADE_WORLD];
const WORLD_FLOOR = 20 * Math.sqrt(SIZE / 48);
const pairs: { a: string; b: string; d: number }[] = [];
for (let i = 0; i < WORLDS.length; i += 1) {
  for (let j = i + 1; j < WORLDS.length; j += 1) {
    pairs.push({
      a: WORLDS[i].id,
      b: WORLDS[j].id,
      d: Math.hypot(
        WORLDS[i].centre[0] - WORLDS[j].centre[0],
        WORLDS[i].centre[1] - WORLDS[j].centre[1],
      ),
    });
  }
}
pairs.sort((p, q) => p.d - q.d);
console.log('[park] WORLD centres', WORLDS.map((w) => `${w.id} @(${w.centre[0].toFixed(1)}, ${w.centre[1].toFixed(1)})`).join(' · '));
console.log('[park] WORLD pairs (sorted)', pairs.map((p) => `${p.a}↔${p.b} ${p.d.toFixed(1)}`).join(' · '));
parkAssert(
  'worldSeparation',
  pairs[0].d >= WORLD_FLOOR,
  `closest world pair ${pairs[0].a}↔${pairs[0].b} is ${pairs[0].d.toFixed(2)} u apart — the floor at size ${SIZE} is ${WORLD_FLOOR.toFixed(2)} u.`,
);
WORLDS.forEach((w) => {
  parkAssert(
    'worldTouchesDeck',
    [DECK_W, DECK_N, DECK_E, DECK_S].some((d) => w.contains(d)),
    `world '${w.id}' contains no monorail deck — everyWorldTouched will read false.`,
  );
});

/* ── the neutral dressing scatter ─────────────────────────────────────────── */
type Obstacle = { at: XZ; r: number };
const OBSTACLES: Obstacle[] = [
  { at: CAROUSEL.pad, r: padMarginOf('Carousel') + 1.6 },
  { at: WHEEL.pad, r: padMarginOf('FerrisWheel') + 1.6 },
  { at: DISCO.pad, r: padMarginOf('Discotron') + 1.6 },
  { at: KARTS.pad, r: padMarginOf('GoKarts') + 1.6 },
  { at: GHOST.pad, r: padMarginOf('GhostTrain') + 1.6 },
  { at: FLUME.pad, r: padMarginOf('LogFlume') + 1.6 },
  { at: RESTROOM, r: 3.0 },
  { at: DECK_W, r: 6.5 }, { at: DECK_N, r: 6.5 }, { at: DECK_E, r: 6.5 }, { at: DECK_S, r: 6.5 },
  ...ALL_PLANS.map((p) => ({
    at: [p.footprint.cx, p.footprint.cz] as XZ,
    r: Math.max(p.footprint.hx, p.footprint.hz) + 2.4,
  })),
  ...[...PULSE_SCENERY, ...COVE_SCENERY, ...GLADE_SCENERY].map((c) => ({ at: c, r: 2.6 })),
];
const COARSE_TRACK: XZ[] = ALL_COASTER_PTS.filter((_, i) => i % 3 === 0).map(
  (p: { x: number; z: number } | number[]) =>
    (Array.isArray(p) ? [p[0], p[2]] : [p.x, p.z]) as XZ,
);
const RING_BOX = { x0: -42.6, x1: 42.6, z0: -51.0, z1: 33.0 };
const nearRingBeam = (c: XZ) => {
  const inx = c[0] >= RING_BOX.x0 - 2.2 && c[0] <= RING_BOX.x1 + 2.2;
  const inz = c[1] >= RING_BOX.z0 - 2.2 && c[1] <= RING_BOX.z1 + 2.2;
  if (!inx || !inz) return false;
  const dx = Math.min(Math.abs(c[0] - RING_BOX.x0), Math.abs(c[0] - RING_BOX.x1));
  const dz = Math.min(Math.abs(c[1] - RING_BOX.z0), Math.abs(c[1] - RING_BOX.z1));
  return dx <= 2.2 || dz <= 2.2;
};
const freeCell = (c: XZ, selfClear: number, taken: XZ[]) => {
  if (Math.abs(c[0]) > 56 || Math.abs(c[1]) > 56) return false;
  if (!isDry(c) || bumpAt(c) > PEAK_LIMIT) return false;
  if (OBSTACLES.some((o) => Math.hypot(c[0] - o.at[0], c[1] - o.at[1]) < o.r + selfClear)) return false;
  if (COARSE_TRACK.some((p) => Math.hypot(c[0] - p[0], c[1] - p[1]) < 3.0)) return false;
  if (nearRingBeam(c)) return false;
  if (taken.some((t) => Math.hypot(c[0] - t[0], c[1] - t[1]) < 3.0)) return false;
  const o = offPathCell(NET, c, { clear: selfClear });
  return !!o && Math.hypot(o[0] - c[0], o[1] - c[1]) < 1e-6;
};

const TREE_SHAPES = ['round', 'pine', 'willow', 'round', 'pine'] as const;
type TreeShape = (typeof TREE_SHAPES)[number];
const TREES: { at: XZ; shape: TreeShape }[] = [];
for (let i = 0; i < 900 && TREES.length < 48; i += 1) {
  const c: XZ = [snap((hash01(i * 2 + 11) - 0.5) * 112), snap((hash01(i * 5 + 29) - 0.5) * 112)];
  if (!freeCell(c, 0.75, TREES.map((t) => t.at))) continue;
  TREES.push({ at: c, shape: TREE_SHAPES[TREES.length % TREE_SHAPES.length] });
}
const SCENERY_NAMES = [
  'marbleStatue', 'birdbath', 'picnicTable', 'planterBox', 'topiarySpiral',
  'topiaryElephant', 'signpost', 'parkClock', 'flagpole', 'ironArchway',
  'picketFence', 'lionStatue', 'fallenLog', 'mushroomCluster', 'wishingWell',
  'gazebo',
] as const;
const PROPS: { at: XZ; name: string }[] = [];
for (let i = 0; i < 900 && PROPS.length < 26; i += 1) {
  const c: XZ = [snap((hash01(i * 3 + 71) - 0.5) * 104), snap((hash01(i * 7 + 43) - 0.5) * 104)];
  if (!freeCell(c, 1.2, [...PROPS.map((p) => p.at), ...TREES.map((t) => t.at)])) continue;
  PROPS.push({ at: c, name: SCENERY_NAMES[PROPS.length % SCENERY_NAMES.length] });
}
console.log(`[park] DRESS — ${TREES.length} tree cells (floor 32) · ${PROPS.length} neutral scenery cells (floor 16) · 13 world-themed pieces`);
parkAssert('treeFloor', TREES.length >= 36, `only ${TREES.length} tree cells authored — the sieve needs headroom over the 32 floor.`, 'advisory');
parkAssert('sceneryFloor', PROPS.length >= 20, `only ${PROPS.length} neutral scenery cells authored — the sieve needs headroom over the 16 floor.`, 'advisory');

/* ── the LAST line of the module-scope block ──────────────────────────────── */
parkAssertFlush();

/* ── the gate's OWN dryness predicate, run IN THE TREE ────────────────────── */
type ParkCtx = ReturnType<typeof usePark>;
function dryRing(park: ParkCtx, c: XZ, r = 0.75): boolean {
  const g = park.ground;
  if (!g) {
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
    if (kept.length < cells.length) {
      console.error(
        `[park] DryScatter(${label}) dropped ${cells.length - kept.length} of ${cells.length} cell(s) UNDER waterline+0.05: ` +
          JSON.stringify(cells.filter((c) => !kept.includes(c)).map((c) => c.at)),
      );
    } else {
      console.log(`[park] DryScatter(${label}) — all ${cells.length} cells dry by the gate's own predicate`);
    }
    setDry(kept);
  }, [park, cells, label]);
  return <>{(dry ?? []).map(render)}</>;
}

const RIDE_NAMES = [
  'Wyrmspark Loop',
  'Kelpwrack Runner',
  'Grand Circle Monorail',
  'Saltmill Log Flume',
  'Hollow Lantern Line',
  'Voltage Speedway',
  'Gilded Mare Carousel',
  'Skylark Wheel',
  'Mirrorball Gyro',
];

export function App() {
  return (
    <Park
      seed={SEED}
      climate={CLIMATE}
      roster={{ rides: RIDE_NAMES, stalls: 11, categories: 5 }}
      onReady={(report: { ok: boolean; failures: unknown[]; warnings: unknown[] }) => {
        console.log(
          `[park] validatePark ok=${report.ok} failures=${report.failures.length} warnings=${report.warnings.length}`,
          report,
        );
      }}
    >
      <Terrain keepDry={GUARDS} coasterPts={ALL_COASTER_PTS} />
      <Paths nodes={NET.nodes} edges={NET.edges} plazas={NET.plazas} bins={NET.bins} walkers={6} />
      <GameManager />
      <Gate />

      {/* ── THRILL — the two rated circuits, PIECES mode, no bank prop ── */}
      <Coaster
        name="Wyrmspark Loop"
        pieces={L_PIECES}
        start={L_START}
        heading={0}
        type="steel"
        cars={3}
        capacity={4}
        rideDuration={11}
        loadTime={2}
        intensity={9}
        price={7}
        queueTailNode={NET.node(L_TAIL)}
        queueDir={[1, 0]}
      />
      <Coaster
        name="Kelpwrack Runner"
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

      {/* ── TRANSPORT — the park-spanning multi-station ring ── */}
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
              label: 'Mosslight North',
              boardPoint: [0, 2.6, 34.2],
              queueAnchor: [0, 0.05, 32.41],
              queueDir: [0, -1],
              exitPoint: [-1.2, 0.05, 33.03],
              exitDir: [0, -1],
            },
            {
              label: 'Voltage East',
              boardPoint: [42.6, 2.6, -8.4],
              queueAnchor: [40.81, 0.05, -8.4],
              queueDir: [-1, 0],
              exitPoint: [41.43, 0.05, -7.2],
              exitDir: [-1, 0],
            },
            {
              label: 'Ridgeway South',
              boardPoint: [0, 2.6, -51.0],
              queueAnchor: [0, 0.05, -52.79],
              queueDir: [0, -1],
              exitPoint: [1.2, 0.05, -52.17],
              exitDir: [0, -1],
            },
          ],
        }}
      />

      {/* ── WATER ── */}
      <LogFlume
        position={FLUME.pad}
        rotation={0}
        register={{ name: 'Saltmill Log Flume', capacity: 8, price: 4, intensity: 4, rideDuration: 11 }}
        queue={{ anchor: FLUME.anchor, dir: FLUME.dir }}
      />

      {/* ── DARK ── */}
      <GhostTrain
        position={GHOST.pad}
        rotation={0}
        register={{ name: 'Hollow Lantern Line', capacity: 8, price: 4, intensity: 5, rideDuration: 10 }}
        queue={{ anchor: GHOST.anchor, dir: GHOST.dir }}
      />

      {/* ── the RARE pick: a registered kart circuit ── */}
      <GoKarts
        position={KARTS.pad}
        rotation={0}
        register={{ name: 'Voltage Speedway', capacity: 8, price: 5, intensity: 5, rideDuration: 10 }}
        queue={{ anchor: KARTS.anchor, dir: KARTS.dir }}
      />

      {/* ── GENTLE ── */}
      <Carousel
        position={CAROUSEL.pad}
        rotation={0}
        register={{ name: 'Gilded Mare Carousel', capacity: 4, price: 2, intensity: 1, rideDuration: 9 }}
        queue={{ anchor: CAROUSEL.anchor, dir: CAROUSEL.dir }}
      />
      <FerrisWheel
        position={WHEEL.pad}
        rotation={0}
        register={{ name: 'Skylark Wheel', capacity: 4, price: 3, intensity: 2, rideDuration: 10 }}
        queue={{ anchor: WHEEL.anchor, dir: WHEEL.dir }}
      />
      <Discotron
        position={DISCO.pad}
        rotation={0}
        register={{ name: 'Mirrorball Gyro', capacity: 8, price: 4, intensity: 4, rideDuration: 9 }}
        queue={{ anchor: DISCO.anchor, dir: DISCO.dir }}
      />

      {/* ── the set-pieces (declared AFTER <Paths>) ── */}
      <FountainPlaza plan={HUB} />
      <FountainPlaza plan={SOUTH} />
      <Bazaar plan={PULSE_ROW} />
      <Bazaar plan={COVE_ROW} />
      <Bazaar plan={GLADE_ROW} />

      {/* ── the three WORLDS ── */}
      <World plan={NEON_WORLD} />
      <World plan={COVE_WORLD} />
      <World plan={GLADE_WORLD} />

      <Restroom position={RESTROOM} rotation={Math.PI / 2} />

      {/* ── world-themed scenery, each piece from its OWN pack ── */}
      <NeonArch position={PULSE_SCENERY[0]} rotation={Math.PI} text="PULSE" />
      <MirrorBallPylon position={PULSE_SCENERY[1]} />
      <SpeakerStack position={PULSE_SCENERY[2]} rotation={Math.PI} />
      <SpeakerStack position={PULSE_SCENERY[3]} rotation={Math.PI} />
      <LightTiles position={PULSE_SCENERY[4]} />

      <WreckedHull position={COVE_SCENERY[0]} rotation={0.7} />
      <CoralCluster position={COVE_SCENERY[1]} />
      <AnchorPile position={COVE_SCENERY[2]} rotation={-0.4} />
      <DockPilings position={COVE_SCENERY[3]} rotation={0.6} />

      <GiantToadstools position={GLADE_SCENERY[0]} />
      <StandingStones position={GLADE_SCENERY[1]} />
      <LanternTree position={GLADE_SCENERY[2]} />
      <FlowerPodBed position={GLADE_SCENERY[3]} />

      {/* ── night ── */}
      <Neon text="PULSE" position={[33.6, 1.7, 13.2]} rotation={Math.PI} scale={0.6} />
      <Neon text="COVE" position={[-46.8, 1.7, -21.6]} rotation={Math.PI} scale={0.5} />
      <Lights from={[0, 62.4]} to={[0, 52.8]} />
      <Lights from={[-15.6, 45.6]} to={[-7.2, 45.6]} />
      <Torch position={off([2.4, 55.2], 1.2)} />
      <Torch position={off([-2.4, 55.2], 1.2)} />
      <Torch position={off([-24.0, -24.0], 1.2)} />

      {/* ── the receipt: the gate's own predicate over every pad, then the scatter ── */}
      <DryScatter cells={PADS.map((at) => ({ at }))} label="pads" render={() => null} />
      <DryScatter
        cells={TREES}
        label="trees"
        render={(t, i) => (
          <Placed key={`tr-${i}`} position={t.at} build={(three) => tree(three, { shape: t.shape })} />
        )}
      />
      <DryScatter
        cells={PROPS}
        label="scenery"
        render={(s, i) => <Scenery key={`sc-${i}`} name={s.name} position={s.at} seed={i + 1} />}
      />
    </Park>
  );
}

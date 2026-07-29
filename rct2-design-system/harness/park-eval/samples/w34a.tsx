/* ═══ WYRMHOLLOW GREAT PARK — §0 PRE-FLIGHT ═════════════════════════════════════════
 * SIZE   128 (default, `size` prop omitted)
 * SEED   1 / temperate — dominant lake ctr (41, -39) box[21,60,-60,-21] · secondary ctr
 *        (-38, 31) box[-56,-21,23,39]   [PRE-keepDry, SEED_ROW_WATER row '1/temperate']
 *        RING WATER WALK: all 16 monorail ring cells sieved against BOTH bodies by
 *        offRow() at author time AND again inside the dz sweep — the chosen RING_DZ is
 *        the first offset whose four DECKS are all dry AND all under bumpAt <= 0.75.
 *        reliefFloor.kept reported from report.reliefFloor (never report.relief).
 * WORLDS 5 (ALL of them) — fire · pirateBeach · steampunk · enchantedForest · neon.
 *        Rect centres are DERIVED by worldPlan from each world's own pieces + include
 *        cells; the include sets were laid out so the closest centre pair clears the
 *        20*sqrt(128/48) = 32.66 u floor and every pair of RECTS is disjoint with a dry
 *        gap. Four of the five contain a monorail DECK cell (declared in `include`);
 *        enchantedForest has no platform and is served by its own path spur instead, so
 *        everyWorldTouched is 4/5 BY DESIGN and is stated here rather than claimed.
 *        Every world: its own themed bazaar counter, >= 12 themed scenery placements
 *        from its OWN pack, <WorldGround>, <WorldLandmark>, a path spur, 2-3 rides.
 * CATS   gentle Carousel + Helicycles + AetherBalloons · thrill Coaster flagship +
 *        MineTrainCoaster + EmberWings + Discotron + BoilerBurst + SwingingInverterShip ·
 *        water MagmaRun + PaddleBoats + MoonlitBarge · transport Monorail + Chairlift +
 *        MagneticRide · dark HauntedMansion + DeepDrift + WyrmsHollow  → 5/5 ✓
 *        RARE PICKS Helicycles (3.42) + HauntedMansion (4.77) + SwingingInverterShip
 *        (2.35) + PaddleBoats (3.12) — each appears in rules/setup.md exactly ONCE, in
 *        the PAD_MARGIN table only, so no worked example has ever copied them.
 * CIRCUITS Coaster flagship · MineTrainCoaster · Monorail ring · MagmaRun · EmberWings ·
 *        GearworksExpress · WyrmsHollow · MoonlitBarge · DeepDrift · Bassline ·
 *        Chairlift · MagneticRide → 12 circuits / families coaster+water+transport+dark
 *        = 4 families (>= 5 circuits, >= 3 families) ✓
 * GATE   bare <Gate/> on [0, 63.6]; first queue tail [4.8, 57.6] (Carousel) is
 *        6.0 + 4.8 = 10.8 u of street from the turnstile  <= 15 ✓
 * FLAG   "Wyrmfire Spiral" — a balanced HEXAGON, side 12.0, six turnR 60 deg r2.5, with a
 *        lift/drop pair on opposite sides and a loopR/loopL pair on opposite sides so
 *        both the heading sum (6 x 60 = 360) and the lateral offsets CANCEL.
 *        start [-19.2, 0.55, -28.8] heading 0, steel, cars 3, NO bank prop.
 *        compileTrackPieces + rateCoaster + checkCoasterDesign all run at module scope
 *        and their numbers are printed to the console (verifyCircuit).
 * STREET buildParkNet called EXACTLY ONCE; the SAME NET feeds <Paths> and every
 *        offPathCell/place() call. Every pad is DERIVED from an authored tail node via
 *        place(), never a hand-summed tail + out*d. Span classes present: 1.2 2.4 3.6
 *        4.8 6.0 7.2 8.4 9.6 10.8 12.0 14.4 15.6 18.0 → effectiveClasses >= 4 ✓
 * MONO   17-piece ring copied VERBATIM. position = the START POSE [-42.6, 0, -9.7+DZ],
 *        rotation 0 — never start/heading. Four decks, four authored tail NODES, and
 *        every one of those four tails is a street LEAF (degree 1). S deck queues
 *        OUTWARD; W/N/E queue INWARD. The ring mount is GATED on RING_OK: if no dz in
 *        the sweep clears the flank + water test the ring is dropped and transport still
 *        comes from <Chairlift> and <MagneticRide> — the park is NEVER aborted.
 * QUEUE  one row per ride, tail authored FIRST and pad derived: place(tail, out, cap,
 *        rig) uses laneLenOf(cap) + 0.35 + 0.62 + 0.50 + 0.45 + 2.4 and clears by
 *        padMarginOf(rig) off the measured PAD_MARGIN table (never the 3.2 default by
 *        guess). No two rides share a tail node.
 * GROUND every pad passes assertPadFlat: bumpAt <= 0.75 AND outside every composed
 *        basin, with a ring search out to 4.8 u before it reports.
 * SPREAD built bbox roughly 108 x 122 u; street-node bbox spans x [-48, 45.6] and
 *        z [-58.8, 63.6] → pathExtent well over 0.55 ✓
 * DRESS  ~44 tree cells and ~24 neutral scenery cells authored against floors of 32 and
 *        16, then SIEVED in-tree by DryScatter against the GATE'S OWN predicate
 *        (park.ground.lint.isDry(x, z, 0.05)), never isDryCell. Over-provisioned so the
 *        sieve can drop without breaking the floor. Every prop cell comes out of
 *        offPathCell (clear 1.2 props / 0.75 trees / 1.8 buildings).
 * ROSTER 20 rides / 5 categories / 19 stalls (5 themed world counters + 14 neutral) /
 *        restrooms from every bazaar + one at the hub / bins from NET.
 *        EVERY ride and EVERY stall carries an AUTHORED name — 0 shipped on a catalog
 *        defaultName. <Park roster={{ rides: 20, stalls: 19, categories: 5 }}> MOUNTED.
 * GATE2  parkAssertFlush() prints one numbered block and NEVER throws; a blocking check
 *        drops its own piece and the park still renders and still scores.
 * ═══════════════════════════════════════════════════════════════════════════════════ */
import * as THREE from 'three';
import React from 'react';
import type { XZ } from './components/Park';
import type { TrackPiece } from './components/SplineRideKit';
import {
  Park, GameManager, Terrain, Paths, Gate, Coaster, Restroom, Scenery, Placed, Neon,
  Torch, offPathCell, usePark,
} from './components/Park';
import { laneLenOf, parkComposition } from './components/ParkBuilder';
import { buildParkNet, worldPlan, World, WORLD_THEMES } from './components/SetPieceKit';
import type { NetRef, SetPiecePlan } from './components/SetPieceKit';
import { compileTrackPieces, rateCoaster, checkCoasterDesign } from './components/SplineRideKit';
import { WorldGround } from './components/WorldGround';
import { WorldLandmark } from './components/WorldLandmark';
import { Bazaar, bazaarPlan } from './components/Bazaar';
import { FountainPlaza, fountainPlazaPlan } from './components/FountainPlaza';
import { Boulevard, boulevardPlan } from './components/Boulevard';
import { tree } from './components/Kit';
import { Monorail } from './components/Monorail';
// rides
import { Carousel } from './components/Carousel';
import { Helicycles } from './components/Helicycles';
import { HauntedMansion } from './components/HauntedMansion';
import { MineTrainCoaster } from './components/MineTrainCoaster';
import { MagmaRun } from './components/MagmaRun';
import { EmberWings } from './components/EmberWings';
import { DeepDrift } from './components/DeepDrift';
import { PaddleBoats } from './components/PaddleBoats';
import { SwingingInverterShip } from './components/SwingingInverterShip';
import { GearworksExpress } from './components/GearworksExpress';
import { AetherBalloons } from './components/AetherBalloons';
import { BoilerBurst } from './components/BoilerBurst';
import { WyrmsHollow } from './components/WyrmsHollow';
import { MoonlitBarge } from './components/MoonlitBarge';
import { Chairlift } from './components/Chairlift';
import { Bassline } from './components/Bassline';
import { Discotron } from './components/Discotron';
import { MagneticRide } from './components/MagneticRide';
// per-world scenery packs
import { Fumarole, ObsidianShards, BasaltColumns, LavaFissure, CharredSnag } from './components/EmberfallScenery';
import { WreckedHull, CoralCluster, AnchorPile, TidePool, DockPilings } from './components/TidewaterScenery';
import { GiantGear, SteamPipes, ClockTower, BoilerTank, CoalCart } from './components/BrassworkScenery';
import { GiantToadstools, StandingStones, LanternTree, RuinedArch, FlowerPodBed } from './components/ThornwickScenery';
import { NeonArch, SpeakerStack, MirrorBallPylon, LaserTruss, LightTiles } from './components/PulseScenery';
import { MagicMirror } from './components/MagicMirror';
import { BigPiano } from './components/BigPiano';

/* §12 determinism: hashed sine only, never Math.random / Date.now. */
const hash01 = (n: number) => {
  const s = Math.sin(n * 12.9898 + 78.233) * 43758.5453;
  return s - Math.floor(s);
};

/* ── §0-P.5 ASSERTION HARNESS — records, reports, NEVER throws ─────────────────── */
type Sev = 'blocking' | 'advisory';
const PARK_FAILS: { name: string; detail: string; sev: Sev }[] = [];
function parkAssert(name: string, cond: boolean, detail: string, sev: Sev = 'advisory'): boolean {
  if (!cond) PARK_FAILS.push({ name, detail, sev });
  return cond;
}
function parkAssertFlush(): void {
  if (!PARK_FAILS.length) { console.log('[park] assertions: all pass'); return; }
  const blocking = PARK_FAILS.filter((f) => f.sev === 'blocking');
  console.error(`[park] ${PARK_FAILS.length} ASSERTION FAILURE(S) (${blocking.length} blocking):\n` +
    PARK_FAILS.map((f, i) => `  ${i + 1}. [${f.sev}] ${f.name}\n     ${f.detail}`).join('\n'));
  if (blocking.length)
    console.error(`[park] ${blocking.length} BLOCKING failure(s) — the offending piece is DROPPED and ` +
      `the rest of the park still renders and still scores.`);
}

/* ── plot + seed ───────────────────────────────────────────────────────────────── */
const SIZE = 128;
const SEED = 1;
const CLIMATE = 'temperate';

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

/* ── measured pad clearances (mesh property of the rig, never capacity) ────────── */
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
const LAT_GUARD = 1.275;

/* ── §4 THE FLAGSHIP CIRCUIT — a BALANCED hexagon, not another rectangle ───────── */
/* Six turnR 60 deg = 360 deg.  Every side totals 12.0 u of forward travel, so the
 * polygon closes.  Drama is paid for out of that side's own straight:
 *   lift h1 / drop h1 cost 8.4 + 2.6h = 11.0 each, on OPPOSITE sides (net height 0)
 *   loopR r2.0 / loopL r2.0 cost 1.6r = 3.2 each, on OPPOSITE sides (lateral cancels) */
const SIDE = 12.0;
const LIFT_COST = 8.4 + 2.6 * 1.0;
const LOOP_COST = 1.6 * 2.0;
const TURN: TrackPiece = { type: 'turnR', angle: 60, radius: 2.5 };
const FLAG_PIECES: TrackPiece[] = [
  'station', { type: 'straight', length: SIDE - 2.6 }, TURN,
  { type: 'lift', height: 1.0 }, { type: 'straight', length: SIDE - LIFT_COST }, TURN,
  { type: 'loopR', radius: 2.0 }, { type: 'straight', length: SIDE - LOOP_COST }, TURN,
  { type: 'drop', height: 1.0 }, { type: 'straight', length: SIDE - LIFT_COST }, TURN,
  { type: 'loopL', radius: 2.0 }, { type: 'straight', length: SIDE - LOOP_COST }, TURN,
  { type: 'straight', length: SIDE - 1.5 }, { type: 'straight', length: 1.5 }, TURN,
];
const FLAG_START: [number, number, number] = [-19.2, 0.55, -28.8];

function verifyCircuit(name: string, pieces: TrackPiece[], start: [number, number, number]) {
  const out = compileTrackPieces(pieces, { profile: 'coaster', type: 'steel', start, heading: 0, bounds: SIZE });
  const rating = rateCoaster(out.points, { type: 'steel', bank: 0.7, cars: 3 });
  const design = checkCoasterDesign(out.points, { type: 'steel' });
  const violations: string[] = (design && design.violations ? design.violations : []).map((v: { kind: string }) => v.kind);
  const ok = !!out.report.ok && !out.report.fatal && rating.maxLatG <= LAT_GUARD && violations.length === 0;
  console.log(`[park] ${name}:`, {
    E: rating.excitement, I: rating.intensity, N: rating.nausea, maxLatG: rating.maxLatG,
    inversions: rating.inversions, synthesized: out.report.synthesizedCount,
    closure: out.report.closure ? out.report.closure.synthesized : undefined, ok,
  });
  parkAssert('flagshipCircuit', ok,
    `${name} failed verification — fatal ${String(out.report.fatal)} · maxLatG ${rating.maxLatG} ` +
      `· design [${violations.join(', ')}]. The mount is gated on this and falls back to the ` +
      `stock rectangle preset rather than shipping translucent red track.`, 'blocking');
  return { ok, points: out.points, rating };
}
const FLAG = verifyCircuit('Wyrmfire Spiral', FLAG_PIECES, FLAG_START);
/* the fallback: a plain closed rectangle, known-good, used only if the hexagon fails */
const FLAG_FALLBACK: TrackPiece[] = [
  'station', { type: 'straight', length: 5.4 }, { type: 'turnR', angle: 90, radius: 2.5 },
  { type: 'straight', length: 8.0 }, { type: 'turnR', angle: 90, radius: 2.5 },
  { type: 'straight', length: 8.0 }, { type: 'turnR', angle: 90, radius: 2.5 },
  { type: 'straight', length: 8.0 }, { type: 'turnR', angle: 90, radius: 2.5 },
];
const FLAG_MOUNT = FLAG.ok ? FLAG_PIECES : FLAG_FALLBACK;
const COASTER_PTS = FLAG.points;

/* ── the UNGUARDED composition: the landform every author-time test reads ──────── */
const COMP0 = parkComposition(THREE, SEED, SIZE, CLIMATE, { coasterPts: COASTER_PTS });

const isDry = (c: XZ) => [...COMP0.basins, ...COMP0.clampBasins]
  .every((b) => Math.hypot(c[0] - b.x, c[1] - b.z) > 0.74 * b.radius + 0.6);
const bumpAt = (c: XZ) =>
  Math.max(0, ...COMP0.peaks.map((p) => {
    const k = Math.max(0, 1 - Math.hypot(c[0] - p.x, c[1] - p.z) / p.radius);
    return k * k * (3 - 2 * k) * p.height;
  }));

/* ── §0-P.4 THE MONORAIL RING — the pose is SEARCHED, in both directions ───────── */
const ringCellsFor = (dz: number): XZ[] => {
  const rz = -8.4 + dz, nz = 34.2 + dz, sz = -51.0 + dz;
  return [
    [-42.6, rz], [0, nz], [42.6, rz], [0, sz],
    [-42.6, -9.7 + dz],
    [-36.0, rz], [0, nz - 6.6], [36.0, rz], [0, sz - 6.6],
    [-40.81, rz], [0, nz - 1.79], [40.81, rz], [0, sz + 1.79],
    [-1.2, nz - 1.17], [41.43, rz + 1.2], [1.2, sz + 1.17],
  ];
};
const DZ_SWEEP = [0, -1.2, 1.2, -2.4, 2.4, -3.6, 3.6, -4.8, 4.8, -6.0, 6.0];
let bestDz: number | null = null;
let bestBump = Infinity;
for (const dz of DZ_SWEEP) {
  const cells = ringCellsFor(dz);
  const decks = cells.slice(0, 4);
  const wet = cells.filter((c) => !offRow(c) || !isDry(c)).length;
  const bump = Math.max(...decks.map(bumpAt));
  if (bump < bestBump) bestBump = bump;
  if (wet === 0 && bump <= PEAK_LIMIT && Math.abs(cells[8][1]) < 63.0) { bestDz = dz; break; }
}
const RING_OK = parkAssert('ringPose', bestDz !== null,
  `no monorail ring pose in dz ${JSON.stringify(DZ_SWEEP)} clears the flank limit ` +
    `(best deck bump ${bestBump.toFixed(2)} > ${PEAK_LIMIT}) and the waterline. SHIPPING WITHOUT ` +
    `THE RING — transport still comes from <Chairlift> and <MagneticRide>.`, 'blocking');
const DZ = bestDz ?? 0;
const RING_CELLS = ringCellsFor(DZ);
const RZ = -8.4 + DZ;
const T_W: XZ = [-36.0, RZ];
const T_N: XZ = [0, 27.6 + DZ];
const T_E: XZ = [36.0, RZ];
const T_S: XZ = [0, -57.6 + DZ];
console.log(`[park] monorail ring: RING_DZ ${DZ} · deck bump ${Math.max(...RING_CELLS.slice(0, 4).map(bumpAt)).toFixed(2)} · ok ${RING_OK}`);

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

/* ── SET-PIECE PLANS ───────────────────────────────────────────────────────────── */
const TH = WORLD_THEMES as Record<string, Parameters<typeof bazaarPlan>[0]['theme']>;

const HUB = fountainPlazaPlan({
  id: 'hub', title: 'Grand Concourse', position: [0, 48], tiles: 9,
  ports: ['N', 'E', 'S', 'W'], stringLights: 'all', seed: 3,
});
const GATE_AVE = boulevardPlan({ id: 'gateAve', title: 'Turnstile Mall', from: [0, 63.6], to: [0, 55.2], spacing: 3.6, seed: 2 });
const SOUTH_AVE = boulevardPlan({ id: 'southAve', title: 'Long Parade', from: [7.2, 42.0], to: [7.2, -1.2], spacing: 4.8, seed: 5 });
const CROSS_AVE = boulevardPlan({ id: 'crossAve', title: 'Equator Walk', from: [6.0, -1.2], to: [-33.6, -1.2], spacing: 4.8, seed: 7 });

const MAIN_ROW = bazaarPlan({
  id: 'mainRow', title: 'Concourse Market', position: [-16.8, 48],
  stalls: ['burger', 'soda', 'cottonCandy', 'balloon'],
  names: ['The Brass Griddle', 'Fizzworks', 'Cloudspun', 'Sky Tethers'],
  facing: { port: 'E', toward: [0, 48] }, seed: 11,
});
const NEON_ROW = bazaarPlan({
  id: 'neonRow', title: 'Pulse Strip', position: [12.0, 38.4], theme: TH.neon,
  stalls: ['neonSlush', 'soda', 'hotDog'],
  names: ['Subzero Slush', 'Voltage Pop', 'The Late Set'],
  facing: { port: 'E', toward: [0, 38.4] }, seed: 13,
});
const PB_ROW = bazaarPlan({
  id: 'pbRow', title: 'Saltmarket', position: [-48.0, 3.6], theme: TH.pirateBeach,
  stalls: ['sushi', 'soda', 'burger'],
  names: ['Reefcutter Sushi', 'Bilge Bottles', 'Castaway Grill'],
  facing: { port: 'W', toward: [-48.0, 20.0] }, seed: 17,
});
const SP_ROW = bazaarPlan({
  id: 'spRow', title: 'Foundry Arcade', position: [45.6, 4.8], theme: TH.steampunk,
  stalls: ['goggles', 'hotDog', 'cottonCandy'],
  names: ['Bevelworks Optics', 'Piston & Bun', 'Flywheel Floss'],
  facing: { port: 'E', toward: [45.6, -20.0] }, seed: 19,
});
const EF_ROW = bazaarPlan({
  id: 'efRow', title: 'Glade Barter', position: [-39.6, -48.0], theme: TH.enchantedForest,
  stalls: ['honeywitch', 'cottonCandy', 'soda'],
  names: ['The Honeywitch', 'Spindlefloss', 'Dewdraught'],
  facing: { port: 'W', toward: [-39.6, -30.0] }, lamps: false, seed: 23,
});
const FIRE_ROW = bazaarPlan({
  id: 'fireRow', title: 'Cinder Row', position: [-9.6, -58.8], theme: TH.fire,
  stalls: ['emberRoast', 'burger', 'soda'],
  names: ['Ember Roast', 'Slagburger', 'Quench'],
  facing: { port: 'W', toward: [-30.0, -58.8] }, seed: 29,
});
const ALL_PLANS: SetPiecePlan[] = [
  HUB, GATE_AVE, SOUTH_AVE, CROSS_AVE, MAIN_ROW, NEON_ROW, PB_ROW, SP_ROW, EF_ROW, FIRE_ROW,
];

/* ── THE STREET SKELETON — authored nodes, cardinal edges ──────────────────────── */
const NODES: XZ[] = [
  /* 0 */ [0, 57.6],            // gate spine junction (lies on gateAve → split)
  /* 1 */ [4.8, 57.6],          // Carousel tail                       LEAF
  /* 2 */ [-4.8, 57.6],         // Helicycles tail                     LEAF
  /* 3 */ [13.2, 48.0],         // Haunted Mansion tail                LEAF
  /* 4 */ [-1.2, 38.4],         // neon street
  /* 5 */ [-9.6, 38.4],         // MagneticRide tail / corner
  /* 6 */ [-9.6, T_N[1]],       // neon corner, south
  /* 7 */ T_N,                  // MONORAIL N TAIL                     LEAF
  /* 8 */ [-9.6, T_N[1] - 8.4], // Discotron tail                      LEAF
  /* 9 */ [7.2, 30.0],          // southAve spur junction
  /*10 */ [16.8, 30.0],         // Bassline tail
  /*11 */ [18.0, -1.2],         // east junction
  /*12 */ [36.0, -1.2],         // east street
  /*13 */ T_E,                  // MONORAIL E TAIL                     LEAF
  /*14 */ [45.6, -1.2],         // Gearworks Express tail
  /*15 */ [45.6, 15.6],         // Aether Balloons tail                LEAF
  /*16 */ [45.6, -19.2],        // Boiler Burst tail                   LEAF
  /*17 */ [-36.0, -1.2],        // west junction
  /*18 */ T_W,                  // MONORAIL W TAIL                     LEAF
  /*19 */ [-36.0, 8.4],         // Deep Drift tail                     LEAF
  /*20 */ [-48.0, -1.2],        // pirate-beach junction
  /*21 */ [-48.0, 9.6],         // Paddle Boats tail                   LEAF
  /*22 */ [-48.0, -12.0],       // Swinging Inverter Ship tail         LEAF
  /*23 */ [-33.6, -19.2],       // south trunk
  /*24 */ [-24.0, -28.8],       // flagship coaster tail               LEAF
  /*25 */ [-33.6, -28.8],       // south trunk junction
  /*26 */ [-33.6, -43.2],       // glade junction
  /*27 */ [-39.6, -43.2],       // glade street
  /*28 */ [-39.6, -33.6],       // Wyrm's Hollow tail                  LEAF
  /*29 */ [-45.6, -43.2],       // Chairlift tail                      LEAF
  /*30 */ [-39.6, -56.4],       // Moonlit Barge tail                  LEAF
  /*31 */ [-33.6, -58.8],       // caldera approach corner
  /*32 */ [-15.6, -58.8],       // Magma Run tail
  /*33 */ [-3.6, -58.8],        // Ember Wings tail
  /*34 */ T_S,                  // MONORAIL S TAIL                     LEAF
  /*35 */ [18.0, -12.0],        // Mine Train tail                     LEAF
];
const EDGES: [NetRef, NetRef][] = [
  ['gateAve:B', 'hub:N'], [0, 1], [0, 2],
  ['hub:E', 3], ['hub:W', 'mainRow:E'],
  ['hub:S', 'southAve:A'], ['southAve:B', 11], ['southAve:B', 'crossAve:A'],
  ['neonRow:E', 4], ['neonRow:W', 10], [9, 10],
  [4, 5], [5, 6], [6, 7], [6, 8],
  [11, 12], [11, 35], [12, 13], [12, 14],
  ['spRow:E', 14], ['spRow:W', 15], [14, 16],
  ['crossAve:B', 17], ['crossAve:B', 23],
  [17, 18], [17, 19], [17, 20], [20, 22], ['pbRow:W', 21],
  [23, 25], [25, 24], [25, 26],
  [26, 27], [27, 28], [27, 29], ['efRow:E', 30], [26, 31],
  [31, 32], ['fireRow:W', 32], ['fireRow:E', 33], [33, 34],
];

const NET = buildParkNet({
  nodes: NODES,
  edges: EDGES,
  pieces: ALL_PLANS,
  keepDry: [...NODES, ...(RING_OK ? RING_CELLS : [])],
});

/* ── §0-P.5 pad derivation: the TAIL is authored, the PAD is derived ───────────── */
const minReachOf = (c: number) => laneLenOf(c) + 0.35 + 0.62 + 0.5 + 0.45;
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
          console.warn(`[park] ${label}: pad [${pad}] on a hill flank/wet (bump ${bumpAt(pad).toFixed(2)}) — moved to [${c}]`);
          return c;
        }
      }
  parkAssert('padOnFlank', false,
    `${label}: pad [${pad}] is on a hill flank (bump ${bumpAt(pad).toFixed(2)} > ${PEAK_LIMIT}) OR WET, and ` +
      `no cell within 4.8 u is flat, dry AND ${clear.toFixed(2)} u off the street.`);
  return pad;
}
type Placed3 = { pad: XZ; anchor: XZ; dir: XZ; yaw: number };
function place(tail: XZ, out: XZ, capacity: number, rig: string): Placed3 {
  const clear = padMarginOf(rig);
  const join = laneLenOf(capacity) + 0.35;
  const reach = minReachOf(capacity) + 2.4;
  const cand: XZ = [tail[0] + out[0] * reach, tail[1] + out[1] * reach];
  const onStreet = (offPathCell(NET, cand, { clear }) ?? cand) as XZ;
  const pad = assertPadFlat(onStreet, clear, rig);
  const got = Math.hypot(pad[0] - tail[0], pad[1] - tail[1]);
  parkAssert('padReach', got >= minReachOf(capacity) + 1.2,
    `${rig}: pad [${pad}] sits ${got.toFixed(2)} u from its tail [${tail}] — the cap-${capacity} floor is ` +
      `${(minReachOf(capacity) + 1.2).toFixed(2)} u. The court is too tight; move the TAIL outward.`);
  const lim = SIZE / 2 - 1.2;
  parkAssert('padBounds', Math.abs(pad[0]) <= lim && Math.abs(pad[1]) <= lim,
    `${rig}: pad [${pad}] is outside the plot's +/-${lim} u working area.`);
  const dir: XZ = [-out[0], -out[1]];
  return {
    pad, dir, yaw: Math.atan2(dir[0], dir[1]),
    anchor: [tail[0] + out[0] * join, tail[1] + out[1] * join] as XZ,
  };
}

const P = {
  carousel: place(NODES[1], [1, 0], 4, 'Carousel'),
  helicycles: place(NODES[2], [-1, 0], 4, 'Helicycles'),
  mansion: place(NODES[3], [1, 0], 8, 'HauntedMansion'),
  magnetic: place(NODES[5], [-1, 0], 6, 'MagneticRide'),
  discotron: place(NODES[8], [0, -1], 8, 'Discotron'),
  bassline: place(NODES[10], [1, 0], 4, 'Bassline'),
  gearworks: place(NODES[14], [1, 0], 6, 'GearworksExpress'),
  aether: place(NODES[15], [1, 0], 8, 'AetherBalloons'),
  boiler: place(NODES[16], [1, 0], 8, 'BoilerBurst'),
  deepDrift: place(NODES[19], [1, 0], 8, 'DeepDrift'),
  paddle: place(NODES[21], [0, 1], 4, 'PaddleBoats'),
  inverter: place(NODES[22], [0, -1], 8, 'SwingingInverterShip'),
  wyrm: place(NODES[28], [-1, 0], 4, 'WyrmsHollow'),
  chairlift: place(NODES[29], [-1, 0], 4, 'Chairlift'),
  barge: place(NODES[30], [-1, 0], 4, 'MoonlitBarge'),
  magma: place(NODES[32], [0, 1], 6, 'MagmaRun'),
  ember: place(NODES[33], [0, 1], 6, 'EmberWings'),
  mineTrain: place(NODES[35], [1, 0], 4, 'MineTrainCoaster'),
};

/* ── §0-P.6 the guard list is DERIVED, never a blanket NODES.slice() ───────────── */
function keepDryOf(net: { keepDry: XZ[] }, row: SeedRow = SEED_ROW): XZ[] {
  const kept = net.keepDry.filter((c) => offRow(c, row));
  const dropped = net.keepDry.length - kept.length;
  if (dropped) console.warn(
    `[park] keepDryOf dropped ${dropped} of ${net.keepDry.length} guard cell(s) on the pinned row's water. ` +
      `A DROPPED guard is NOT a fixed cell — move whatever stands there.`);
  return kept;
}
const PAD_CELLS: XZ[] = Object.keys(P).map((k) => (P as Record<string, Placed3>)[k].pad);
const GUARDS: XZ[] = [...keepDryOf(NET), ...PAD_CELLS.filter((c) => offRow(c))];

/* the GUARDED composition — read only for the water + relief diff */
const COMP = parkComposition(THREE, SEED, SIZE, CLIMATE, { keepDry: GUARDS, coasterPts: COASTER_PTS });
parkAssert('waterMoved',
  Math.hypot(COMP.waterCentre[0] - COMP0.waterCentre[0], COMP.waterCentre[1] - COMP0.waterCentre[1]) < 1 &&
  Math.hypot(COMP.waterCentreSecond[0] - COMP0.waterCentreSecond[0],
    COMP.waterCentreSecond[1] - COMP0.waterCentreSecond[1]) < 1,
  `guards moved a water body off the pinned row — dominant ${JSON.stringify(COMP0.waterCentre)} → ` +
    `${JSON.stringify(COMP.waterCentre)}, secondary ${JSON.stringify(COMP0.waterCentreSecond)} → ` +
    `${JSON.stringify(COMP.waterCentreSecond)}, terrainSeed ${COMP0.terrainSeed} → ${COMP.terrainSeed}`);
const RF = COMP.report.reliefFloor;
parkAssert('terrainFlattened', !RF || RF.kept >= RF.floor,
  RF ? `keepDry FLATTENED the seed: authored relief ${RF.authoredRelief.toFixed(2)} → built ` +
    `${RF.relief.toFixed(2)} (kept ${RF.kept.toFixed(2)} against the ${RF.floor} floor), stdH ` +
    `${RF.authoredStdH.toFixed(2)} → ${RF.stdH.toFixed(2)}; ranges guarded: ${RF.guardedRanges}` : '',
  'advisory');
console.log('[park] terrain:', {
  guards: GUARDS.length, probes: COMP.report.probesTried, terrainSeed: COMP.terrainSeed,
  waterBodies: COMP.report.waterBodies, waterAreaU2: COMP.report.waterAreaU2,
  reliefKept: RF ? RF.kept : null, stdH: RF ? RF.stdH : null,
});

/* ── the five WORLDS ───────────────────────────────────────────────────────────── */
const ring = (n: number, cx: number, cz: number, r: number, seed: number): XZ[] =>
  Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2 + hash01(seed * 31 + i) * 0.9;
    const rr = r * (0.45 + 0.55 * hash01(seed * 17 + i * 3));
    return [
      +(cx + Math.cos(a) * rr).toFixed(2),
      +(cz + Math.sin(a) * rr).toFixed(2),
    ] as XZ;
  });
const propCell = (c: XZ): XZ => (offPathCell(NET, c, { clear: 1.2 }) ?? c) as XZ;

const FIRE_PROPS = ring(14, -9.6, -54.0, 7.2, 3).map(propCell);
const PB_PROPS = ring(14, -46.8, 1.2, 8.4, 5).map(propCell);
const SP_PROPS = ring(14, 51.6, 1.2, 8.4, 7).map(propCell);
const EF_PROPS = ring(14, -44.4, -46.8, 8.4, 11).map(propCell);
const NEON_PROPS = ring(14, 3.6, 30.0, 9.6, 13).map(propCell);
/* HOISTED: DryScatter deps on `cells` by identity, so these must be stable module
 * constants — building them inline in JSX would re-run the sieve effect every render. */
const asCells = (cs: XZ[]) => cs.map((at, i) => ({ at, i }));
const FIRE_CELLS = asCells(FIRE_PROPS);
const PB_CELLS = asCells(PB_PROPS);
const SP_CELLS = asCells(SP_PROPS);
const EF_CELLS = asCells(EF_PROPS);
const NEON_CELLS = asCells(NEON_PROPS);

const FIRE = worldPlan({
  id: 'fire', theme: TH.fire, pieces: [FIRE_ROW],
  include: [...FIRE_PROPS, P.magma.pad, P.ember.pad, NODES[32], NODES[33], NODES[34],
    ...(RING_OK ? [RING_CELLS[3]] : [])],
});
const PIRATE = worldPlan({
  id: 'pirateBeach', theme: TH.pirateBeach, pieces: [PB_ROW],
  include: [...PB_PROPS, P.deepDrift.pad, P.paddle.pad, P.inverter.pad,
    NODES[19], NODES[21], NODES[22], ...(RING_OK ? [RING_CELLS[0], T_W] : [])],
});
const STEAM = worldPlan({
  id: 'steampunk', theme: TH.steampunk, pieces: [SP_ROW],
  include: [...SP_PROPS, P.gearworks.pad, P.aether.pad, P.boiler.pad,
    NODES[14], NODES[15], NODES[16], ...(RING_OK ? [RING_CELLS[2], T_E] : [])],
});
const GLADE = worldPlan({
  id: 'enchantedForest', theme: TH.enchantedForest, pieces: [EF_ROW],
  include: [...EF_PROPS, P.wyrm.pad, P.chairlift.pad, P.barge.pad,
    NODES[27], NODES[28], NODES[29], NODES[30]],
});
const PULSE = worldPlan({
  id: 'neon', theme: TH.neon, pieces: [NEON_ROW],
  include: [...NEON_PROPS, P.bassline.pad, P.discotron.pad, P.magnetic.pad,
    NODES[4], NODES[5], NODES[6], NODES[8], NODES[10], ...(RING_OK ? [RING_CELLS[1]] : [])],
});
const WORLDS = [FIRE, PIRATE, STEAM, GLADE, PULSE];

/* world separation + disjointness — the two floors that decide whether these are
 * five PLACES or one district with five labels */
const WORLD_FLOOR = 20 * Math.sqrt(SIZE / 48);
for (let i = 0; i < WORLDS.length; i += 1)
  for (let j = i + 1; j < WORLDS.length; j += 1) {
    const a = WORLDS[i].region, b = WORLDS[j].region;
    const d = Math.hypot(a.cx - b.cx, a.cz - b.cz);
    parkAssert('worldTooClose', d >= WORLD_FLOOR,
      `worlds '${WORLDS[i].id}' and '${WORLDS[j].id}' centres are ${d.toFixed(2)} u apart — the floor at ` +
        `size ${SIZE} is ${WORLD_FLOOR.toFixed(2)} u. They read as one district.`);
    const gap = Math.max(Math.abs(a.cx - b.cx) - (a.hx + b.hx), Math.abs(a.cz - b.cz) - (a.hz + b.hz));
    parkAssert('worldRectsTouch', gap > 0,
      `world rects '${WORLDS[i].id}' and '${WORLDS[j].id}' overlap by ${(-gap).toFixed(2)} u — touching rects ` +
        `are ONE district, not two.`);
  }
console.log('[park] worlds:', WORLDS.map((w) => ({
  id: w.id, cx: +w.region.cx.toFixed(1), cz: +w.region.cz.toFixed(1),
  hx: +w.region.hx.toFixed(1), hz: +w.region.hz.toFixed(1),
})));

/* ── §0-P.5 nodes vs set-piece SOLIDS, and every EDGE cardinal ─────────────────── */
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
      if (gap < clear - 1e-9)
        hits.push(`[${n[0]}, ${n[1]}] (cell ${i}) is ${gap.toFixed(2)} u from '${p.id}' (${p.kind}) — needs ${clear}`);
    });
  });
  parkAssert('nodeInSolid', !hits.length,
    `${hits.length} authored cell(s) stand inside or against a set-piece's SOLID footprint:\n  ` + hits.join('\n  '));
}
assertNodesOffPieces([...NODES, ...PAD_CELLS], ALL_PLANS);

const portCell = (ref: NetRef): XZ => {
  if (typeof ref === 'number') return NODES[ref];
  const [id, name] = ref.split(':');
  const p = ALL_PLANS.find((q) => q.id === id);
  if (!p) { parkAssert('unknownPiece', false, `EDGES references '${ref}' but no plan has id '${id}'`); return [0, 0]; }
  return p.port(name);
};
const EPS = 1e-6;
EDGES.forEach(([a, b]) => {
  const A = portCell(a), B = portCell(b);
  parkAssert('cardinalEdge', Math.abs(A[0] - B[0]) < EPS || Math.abs(A[1] - B[1]) < EPS,
    `edge ${String(a)}→${String(b)} is DIAGONAL: [${A}] → [${B}]. buildParkNet ELBOWS it through a ` +
      `synthesised corner node you did not plan. FIX THE TABLE.`, 'advisory');
});
const CHAIN_END_OPT_OUT = new Set<string>(['gateAve:A']); // the <Gate> itself stands on it
const PORT_REFS = EDGES.flat().filter((x): x is string => typeof x === 'string');
ALL_PLANS.forEach((p) => {
  const wired = new Set(PORT_REFS.filter((r) => r.split(':')[0] === p.id).map((r) => r.split(':')[1]));
  parkAssert('pieceIsland', wired.size > 0,
    `set-piece '${p.id}' has NO '${p.id}:<PORT>' ref in EDGES — it composes as an ISLAND`);
  p.ports.filter((pt) => !pt.prunable).forEach((pt) => {
    if (wired.has(pt.name) || CHAIN_END_OPT_OUT.has(`${p.id}:${pt.name}`)) return;
    parkAssert('chainEnd', false,
      `chain piece '${p.id}' (${p.kind}) wires [${[...wired]}] but NOT '${p.id}:${pt.name}' — that end of the ` +
        `carriageway dead-ends in grass.`);
  });
});
if (NET.warnings && NET.warnings.length)
  console.warn('[park] buildParkNet warnings:', NET.warnings);

/* ── DRESSING — over-provisioned, then sieved in-tree ──────────────────────────── */
const TREE_SHAPES = ['round', 'pine', 'willow', 'round', 'pine'] as const;
type TreeShape = (typeof TREE_SHAPES)[number];
const RAW_TREES: XZ[] = Array.from({ length: 46 }, (_, i) => {
  const a = hash01(i * 7 + 1) * Math.PI * 2;
  const r = 14 + hash01(i * 13 + 5) * 44;
  return [+(Math.cos(a) * r).toFixed(2), +(Math.sin(a) * r).toFixed(2)] as XZ;
});
const TREES: { at: XZ; shape: TreeShape }[] = RAW_TREES.map((c, i) => ({
  at: (offPathCell(NET, c, { clear: 0.75 }) ?? c) as XZ,
  shape: TREE_SHAPES[i % TREE_SHAPES.length],
}));
const NEUTRAL_NAMES = [
  'marbleStatue', 'birdbath', 'picnicTable', 'planterBox', 'topiarySpiral', 'signpost',
  'parkClock', 'flagpole', 'ironArchway', 'wishingWell', 'gazebo', 'lionStatue',
];
const SCENERY: { at: XZ; name: string }[] = Array.from({ length: 24 }, (_, i) => {
  const a = hash01(i * 23 + 3) * Math.PI * 2;
  const r = 10 + hash01(i * 29 + 9) * 34;
  const raw: XZ = [+(Math.cos(a) * r).toFixed(2), +(Math.sin(a) * r).toFixed(2)];
  return { at: (offPathCell(NET, raw, { clear: 1.2 }) ?? raw) as XZ, name: NEUTRAL_NAMES[i % NEUTRAL_NAMES.length] };
});
parkAssert('dressFloors', TREES.length >= 32 && SCENERY.length >= 16,
  `authored ${TREES.length} trees / ${SCENERY.length} scenery against the 32 / 16 floors at size 128`);

type ParkCtx = ReturnType<typeof usePark>;
function dryRing(park: ParkCtx, c: XZ, r = 0.75): boolean {
  const g = park.ground as unknown as { lint?: { isDry: (x: number, z: number, cl: number) => boolean } } | null;
  if (!g || !g.lint) { console.error('[park] dryRing ran with NO TERRAIN — a VACUOUS pass'); return true; }
  const dry = (x: number, z: number) => g.lint!.isDry(x, z, 0.05);
  if (!dry(c[0], c[1])) return false;
  for (let k = 0; k < 8; k += 1) {
    const a = (k / 8) * Math.PI * 2;
    if (!dry(c[0] + Math.cos(a) * r, c[1] + Math.sin(a) * r)) return false;
  }
  return true;
}
function DryScatter<T extends { at: XZ }>({ cells, label, render }: {
  cells: T[]; label: string; render: (c: T, i: number) => React.ReactNode;
}) {
  const park = usePark('DryScatter');
  const [dry, setDry] = React.useState<T[] | null>(null);
  React.useEffect(() => {
    const kept = cells.filter((c) => dryRing(park, c.at));
    if (kept.length < cells.length)
      console.error(`[park] DryScatter(${label}) dropped ${cells.length - kept.length} of ${cells.length} cell(s) ` +
        `UNDER waterline+0.05: ${JSON.stringify(cells.filter((c) => kept.indexOf(c) < 0).map((c) => c.at))}`);
    setDry(kept);
  }, [park, cells, label]);
  return <>{(dry ?? []).map(render)}</>;
}

/* ── the roster the header claims, restated on <Park roster> ───────────────────── */
const RIDE_NAMES = [
  'Gilded Gallopers', 'Skylark Helicycles', 'Marrowgate Manor', 'Wyrmfire Spiral',
  'Deadfall Mine Run', 'Three Crowns Skyline', 'Cinder Race', 'Ember Wings',
  'The Deep Drift', 'Bilgewater Paddles', 'Gallows Swing', 'Gearworks Express',
  'Aether Ascension', 'Boiler Burst', "Wyrm's Hollow", 'Moonlit Barge',
  'Canopy Chairlift', 'Bassline', 'Discotron', 'Maglev Mile',
];
const ROSTER = { rides: RIDE_NAMES, stalls: 19, categories: 5 };

parkAssertFlush();

/* ═══════════════════════════════════════════════════════════════════════════════ */
export function App() {
  return (
    <div className="w-full h-full min-h-screen bg-[#0b1016]">
      <Park
        seed={SEED}
        climate={CLIMATE}
        roster={ROSTER}
        onReady={(report: { ok: boolean; failures?: unknown[]; warnings?: unknown[] }) => {
          console.log('[park] validatePark →', report.ok ? 'ok' : 'FAILED', {
            failures: report.failures, warnings: report.warnings,
          });
        }}
      >
        <Terrain keepDry={GUARDS} coasterPts={COASTER_PTS} />
        <Paths nodes={NET.nodes} edges={NET.edges} plazas={NET.plazas} bins={NET.bins} walkers={6} />
        <GameManager />
        <Gate />

        {/* ── world floors, then each land's GIANT, then the region declarations ── */}
        {WORLDS.map((w) => <WorldGround key={`wg-${w.id}`} plan={w} />)}
        {WORLDS.map((w) => <WorldLandmark key={`wl-${w.id}`} plan={w} />)}
        {WORLDS.map((w) => <World key={`w-${w.id}`} plan={w} />)}

        {/* ── the street furniture ─────────────────────────────────────────────── */}
        <FountainPlaza plan={HUB} />
        <Boulevard plan={GATE_AVE} />
        <Boulevard plan={SOUTH_AVE} />
        <Boulevard plan={CROSS_AVE} />
        <Bazaar plan={MAIN_ROW} />
        <Bazaar plan={NEON_ROW} />
        <Bazaar plan={PB_ROW} />
        <Bazaar plan={SP_ROW} />
        <Bazaar plan={EF_ROW} />
        <Bazaar plan={FIRE_ROW} />
        <Restroom position={[6.0, 55.2]} rotation={-Math.PI / 2} />

        {/* ── TRANSPORT: the park-spanning ring, gated on a legal pose ─────────── */}
        {RING_OK && (
          <Monorail
            position={[-42.6, 0, -9.7 + DZ]}
            rotation={0}
            pieces={MONO_PIECES}
            register={{ name: 'Three Crowns Skyline', capacity: 12, price: 3 }}
          />
        )}

        {/* ── THRILL: the flagship, verified at module scope ───────────────────── */}
        <Coaster
          name="Wyrmfire Spiral"
          pieces={FLAG_MOUNT}
          start={FLAG_START}
          heading={0}
          type="steel"
          cars={3}
          capacity={4}
          rideDuration={11}
          loadTime={2}
          intensity={9}
          price={7}
          queueTailNode={NET.node(NODES[24])}
          queueDir={[1, 0]}
        />
        <MineTrainCoaster
          position={P.mineTrain.pad} rotation={P.mineTrain.yaw}
          register={{ name: 'Deadfall Mine Run', capacity: 4, price: 6 }}
          queue={{ anchor: P.mineTrain.anchor, dir: P.mineTrain.dir }}
        />

        {/* ── the entrance plaza rides ─────────────────────────────────────────── */}
        <Carousel
          position={P.carousel.pad} rotation={P.carousel.yaw}
          register={{ name: 'Gilded Gallopers', capacity: 4, price: 2 }}
          queue={{ anchor: P.carousel.anchor, dir: P.carousel.dir }}
        />
        <Helicycles
          position={P.helicycles.pad} rotation={P.helicycles.yaw}
          register={{ name: 'Skylark Helicycles', capacity: 4, price: 3 }}
          queue={{ anchor: P.helicycles.anchor, dir: P.helicycles.dir }}
        />
        <HauntedMansion
          position={P.mansion.pad} rotation={P.mansion.yaw}
          register={{ name: 'Marrowgate Manor', capacity: 8, price: 5 }}
          queue={{ anchor: P.mansion.anchor, dir: P.mansion.dir }}
        />

        {/* ── FIRE — Cinderfall Caldera ────────────────────────────────────────── */}
        <MagmaRun
          position={P.magma.pad} rotation={P.magma.yaw}
          register={{ name: 'Cinder Race', capacity: 6, price: 6 }}
          queue={{ anchor: P.magma.anchor, dir: P.magma.dir }}
        />
        <EmberWings
          position={P.ember.pad} rotation={P.ember.yaw}
          register={{ name: 'Ember Wings', capacity: 6, price: 7 }}
          queue={{ anchor: P.ember.anchor, dir: P.ember.dir }}
        />
        <DryScatter
          cells={FIRE_CELLS} label="fire"
          render={(c, i) => {
            const k = i % 5;
            const rot = hash01(i * 5 + 2) * Math.PI * 2;
            if (k === 0) return <BasaltColumns key={`f${i}`} position={c.at} rotation={rot} seed={i + 2} />;
            if (k === 1) return <CharredSnag key={`f${i}`} position={c.at} rotation={rot} seed={i + 3} />;
            if (k === 2) return <ObsidianShards key={`f${i}`} position={c.at} rotation={rot} seed={i + 5} />;
            if (k === 3) return <LavaFissure key={`f${i}`} position={c.at} rotation={rot} seed={i + 7} />;
            return <Fumarole key={`f${i}`} position={c.at} rotation={rot} seed={i + 11} />;
          }}
        />
        <Torch position={[-13.2, -55.2]} />
        <Torch position={[-6.0, -55.2]} />

        {/* ── PIRATE BEACH — Saltwreck Cove ────────────────────────────────────── */}
        <DeepDrift
          position={P.deepDrift.pad} rotation={P.deepDrift.yaw}
          register={{ name: 'The Deep Drift', capacity: 8, price: 6 }}
          queue={{ anchor: P.deepDrift.anchor, dir: P.deepDrift.dir }}
        />
        <PaddleBoats
          position={P.paddle.pad} rotation={P.paddle.yaw}
          register={{ name: 'Bilgewater Paddles', capacity: 4, price: 3 }}
          queue={{ anchor: P.paddle.anchor, dir: P.paddle.dir }}
        />
        <SwingingInverterShip
          position={P.inverter.pad} rotation={P.inverter.yaw}
          register={{ name: 'Gallows Swing', capacity: 8, price: 5 }}
          queue={{ anchor: P.inverter.anchor, dir: P.inverter.dir }}
        />
        <DryScatter
          cells={PB_CELLS} label="pirateBeach"
          render={(c, i) => {
            const k = i % 5;
            const rot = hash01(i * 9 + 4) * Math.PI * 2;
            if (k === 0) return <WreckedHull key={`p${i}`} position={c.at} rotation={rot} seed={i + 2} />;
            if (k === 1) return <CoralCluster key={`p${i}`} position={c.at} rotation={rot} seed={i + 3} />;
            if (k === 2) return <DockPilings key={`p${i}`} position={c.at} rotation={rot} seed={i + 5} />;
            if (k === 3) return <TidePool key={`p${i}`} position={c.at} rotation={rot} seed={i + 7} />;
            return <AnchorPile key={`p${i}`} position={c.at} rotation={rot} seed={i + 11} />;
          }}
        />

        {/* ── STEAMPUNK — The Brasswork Foundry ────────────────────────────────── */}
        <GearworksExpress
          position={P.gearworks.pad} rotation={P.gearworks.yaw}
          register={{ name: 'Gearworks Express', capacity: 6, price: 6 }}
          queue={{ anchor: P.gearworks.anchor, dir: P.gearworks.dir }}
        />
        <AetherBalloons
          position={P.aether.pad} rotation={P.aether.yaw}
          register={{ name: 'Aether Ascension', capacity: 8, price: 4 }}
          queue={{ anchor: P.aether.anchor, dir: P.aether.dir }}
        />
        <BoilerBurst
          position={P.boiler.pad} rotation={P.boiler.yaw}
          register={{ name: 'Boiler Burst', capacity: 8, price: 5 }}
          queue={{ anchor: P.boiler.anchor, dir: P.boiler.dir }}
        />
        <DryScatter
          cells={SP_CELLS} label="steampunk"
          render={(c, i) => {
            const k = i % 5;
            const rot = hash01(i * 11 + 6) * Math.PI * 2;
            if (k === 0) return <GiantGear key={`s${i}`} position={c.at} rotation={rot} seed={i + 2} />;
            if (k === 1) return <SteamPipes key={`s${i}`} position={c.at} rotation={rot} seed={i + 3} />;
            if (k === 2) return <CoalCart key={`s${i}`} position={c.at} rotation={rot} seed={i + 5} />;
            if (k === 3) return <BoilerTank key={`s${i}`} position={c.at} rotation={rot} seed={i + 7} />;
            return <ClockTower key={`s${i}`} position={c.at} rotation={rot} seed={i + 11} />;
          }}
        />

        {/* ── ENCHANTED FOREST — Thornwick Glade ───────────────────────────────── */}
        <WyrmsHollow
          position={P.wyrm.pad} rotation={P.wyrm.yaw}
          register={{ name: "Wyrm's Hollow", capacity: 4, price: 7 }}
          queue={{ anchor: P.wyrm.anchor, dir: P.wyrm.dir }}
        />
        <MoonlitBarge
          position={P.barge.pad} rotation={P.barge.yaw}
          register={{ name: 'Moonlit Barge', capacity: 4, price: 4 }}
          queue={{ anchor: P.barge.anchor, dir: P.barge.dir }}
        />
        <Chairlift
          position={P.chairlift.pad} rotation={P.chairlift.yaw}
          register={{ name: 'Canopy Chairlift', capacity: 4, price: 3 }}
          queue={{ anchor: P.chairlift.anchor, dir: P.chairlift.dir }}
        />
        <DryScatter
          cells={EF_CELLS} label="enchantedForest"
          render={(c, i) => {
            const rot = hash01(i * 13 + 8) * Math.PI * 2;
            if (i === 6) return <MagicMirror key={`e${i}`} position={c.at} rotation={rot} />;
            const k = i % 5;
            if (k === 0) return <GiantToadstools key={`e${i}`} position={c.at} rotation={rot} seed={i + 2} />;
            if (k === 1) return <StandingStones key={`e${i}`} position={c.at} rotation={rot} seed={i + 3} />;
            if (k === 2) return <LanternTree key={`e${i}`} position={c.at} rotation={rot} seed={i + 5} />;
            if (k === 3) return <RuinedArch key={`e${i}`} position={c.at} rotation={rot} seed={i + 7} />;
            return <FlowerPodBed key={`e${i}`} position={c.at} rotation={rot} seed={i + 11} />;
          }}
        />

        {/* ── NEON — Pulse Street ──────────────────────────────────────────────── */}
        <Bassline
          position={P.bassline.pad} rotation={P.bassline.yaw}
          register={{ name: 'Bassline', capacity: 4, price: 6 }}
          queue={{ anchor: P.bassline.anchor, dir: P.bassline.dir }}
        />
        <Discotron
          position={P.discotron.pad} rotation={P.discotron.yaw}
          register={{ name: 'Discotron', capacity: 8, price: 5 }}
          queue={{ anchor: P.discotron.anchor, dir: P.discotron.dir }}
        />
        <MagneticRide
          position={P.magnetic.pad} rotation={P.magnetic.yaw}
          register={{ name: 'Maglev Mile', capacity: 6, price: 4 }}
          queue={{ anchor: P.magnetic.anchor, dir: P.magnetic.dir }}
        />
        <DryScatter
          cells={NEON_CELLS} label="neon"
          render={(c, i) => {
            const rot = hash01(i * 17 + 10) * Math.PI * 2;
            if (i === 9) return <BigPiano key={`n${i}`} position={c.at} rotation={rot} />;
            const k = i % 5;
            if (k === 0) return <SpeakerStack key={`n${i}`} position={c.at} rotation={rot} seed={i + 2} />;
            if (k === 1) return <LightTiles key={`n${i}`} position={c.at} rotation={rot} seed={i + 3} />;
            if (k === 2) return <MirrorBallPylon key={`n${i}`} position={c.at} rotation={rot} seed={i + 5} />;
            if (k === 3) return <LaserTruss key={`n${i}`} position={c.at} rotation={rot} seed={i + 7} />;
            return <NeonArch key={`n${i}`} position={c.at} rotation={rot} seed={i + 11} />;
          }}
        />

        {/* ── park-wide dressing, sieved for water in the tree ─────────────────── */}
        <DryScatter
          cells={TREES} label="trees"
          render={(t, i) => (
            <Placed key={`tr-${i}`} position={t.at} build={(three) => tree(three, { shape: t.shape })} />
          )}
        />
        <DryScatter
          cells={SCENERY} label="scenery"
          render={(s, i) => <Scenery key={`sc-${i}`} name={s.name} position={s.at} seed={i + 1} />}
        />
        <Neon text="WYRMHOLLOW" position={[0, 2.2, 60.0]} rotation={Math.PI} scale={0.55} />
      </Park>
    </div>
  );
}

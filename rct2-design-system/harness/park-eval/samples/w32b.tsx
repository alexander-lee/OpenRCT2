/* ═══ FIVE CROWNS PARK — §0 PRE-FLIGHT ═══════════════════════════════════════════════
 * SIZE   128 (default, `size` prop omitted)
 * SEED   1 / temperate — dominant lake ctr (41, -39) box[21,60,-60,-21] · secondary ctr
 *        (-38, 31) box[-56,-21,23,39]  [PRE-keepDry, SEED_ROW_WATER '1/temperate']
 *        GUARDS are DERIVED — keepDryOf(NET) sieves the fused guard cloud against the
 *        pinned row; a blanket NODES.slice() is never passed to <Terrain keepDry>.
 *        BARE vs guarded composition diffed at module scope: waterMoved + terrainFlattened.
 * WORLDS 5 declared, ALL of them: fire @(-13,17) · enchantedForest @(-50,-2) ·
 *        steampunk @(+52,+4) · pirateBeach @(-42,-32) · neon @(+2,-26)
 *        every pair ≥ 32.66 u (20·√(128/48)); closest pair fire↔neon 43.2 ◄
 *        each world: 2 THEMED RIDES (own names) · its OWN themed stall row · 10 themed
 *        scenery placements from its own pack · a path spur · <WorldGround> · <WorldLandmark>
 * CATS   gentle FerrisWheel/Carousel/AetherBalloons · thrill Thunderhead Run/Cinder Run/
 *        Ashwing Flight/Bassline · water Deep Drift/Reef Racer/Moonlit Barge ·
 *        transport Monorail ring · dark Wyrm's Hollow/Discotron  → 5/5 categories
 * CIRCUITS Thunderhead (coaster) · Cinder Run · Bassline · Deep Drift (water) ·
 *        Moonlit Barge (water) · Monorail (transport) → ≥ 5 circuits / ≥ 3 families
 * GATE   gate cell [0, 63.6] → Skyline Wheel tail [0, 60.0] = 3.6 u ≤ 15 ✓
 * FLAG   Thunderhead Run — start [14.4, 0.55, -16.8] heading 0, steel, cars 3, NO bank prop.
 *        verifyCircuit() runs compileTrackPieces + rateCoaster + checkCoasterDesign at
 *        module scope and the mount is GATED on it (rectangle fallback if it fails).
 * STREET buildParkNet called EXACTLY ONCE · the SAME NET feeds <Paths>, every offPathCell
 *        and every queue tail · every set-piece wired through a PORT ref, never a centre.
 * MONO   17-piece ring VERBATIM · position = the START POSE [-42.6, 0, -9.7+DZ], rotation 0
 *        DZ searched over [0, ±1.2, ±2.4, +3.6, +4.8, +6.0] against bumpIn on ALL FOUR decks
 *        and the dryness of all 16 ring cells; if no pose clears, the ring is DROPPED and
 *        transport comes from the Chairlift instead — the park still ships.
 *        4 deck tails are authored street LEAVES (degree 1).
 * QUEUE  one row per ride, tail = an authored/boulevard NODE, pad DERIVED by place():
 *        pad = offPathCell(NET, tail + out·reach, { clear: padMarginOf(rig) }) then
 *        assertPadFlat (bump ≤ 0.75 AND dry). No two rides share a tail cell.
 * SPREAD built bbox ≈ 118 × 122 u · rides in 6 districts + the hub
 * ROSTER 14 rides / 5 categories / 15 bazaar stalls (5 rows × 3) / restrooms / bins
 *        EVERY ride and every stall carries an AUTHORED name — 0 catalog defaults.
 *        <Park roster={{ rides: [...14 names], stalls: 15, categories: 5 }}> MOUNTED
 * DRESS  34 trees · 50 themed scenery placements · every cell through offPathCell and
 *        then through DryScatter (the GATE's own waterline+0.05 ring predicate)
 * GATE   parkAssertFlush() → reports, NEVER throws · validatePark runs in the preview
 * ═══════════════════════════════════════════════════════════════════════════════════ */
import * as THREE from 'three';
import React from 'react';
import type { V3, XZ } from './components/Park';
import type { TrackPiece } from './components/SplineRideKit';
import {
  Park, GameManager, Terrain, Paths, Gate, Coaster, Restroom, Scenery, Lights, Placed,
  Torch, Neon, offPathCell, usePark,
} from './components/Park';
import { laneLenOf, parkComposition } from './components/ParkBuilder';
import { buildParkNet, worldPlan, World, WORLD_THEMES } from './components/SetPieceKit';
import type { NetRef, SetPiecePlan } from './components/SetPieceKit';
import { Bazaar, bazaarPlan } from './components/Bazaar';
import { FountainPlaza, fountainPlazaPlan } from './components/FountainPlaza';
import { Boulevard, boulevardPlan } from './components/Boulevard';
import { compileTrackPieces, rateCoaster, checkCoasterDesign } from './components/SplineRideKit';
import { tree } from './components/Kit';
import { WorldGround } from './components/WorldGround';
import { WorldLandmark } from './components/WorldLandmark';
import { Monorail } from './components/Monorail';
import { FerrisWheel } from './components/FerrisWheel';
import { Carousel } from './components/Carousel';
import { MagmaRun } from './components/MagmaRun';
import { EmberWings } from './components/EmberWings';
import { WyrmsHollow } from './components/WyrmsHollow';
import { MoonlitBarge } from './components/MoonlitBarge';
import { Chairlift } from './components/Chairlift';
import { GearworksExpress } from './components/GearworksExpress';
import { AetherBalloons } from './components/AetherBalloons';
import { DeepDrift } from './components/DeepDrift';
import { ReefRacer } from './components/ReefRacer';
import { Bassline } from './components/Bassline';
import { Discotron } from './components/Discotron';
import { Fumarole, ObsidianShards, BasaltColumns, LavaFissure, CharredSnag } from './components/EmberfallScenery';
import { WreckedHull, CoralCluster, AnchorPile, TidePool, DockPilings } from './components/TidewaterScenery';
import { GiantGear, SteamPipes, ClockTower, BoilerTank, CoalCart } from './components/BrassworkScenery';
import { GiantToadstools, StandingStones, LanternTree, RuinedArch, FlowerPodBed } from './components/ThornwickScenery';
import { NeonArch, SpeakerStack, MirrorBallPylon, LaserTruss, LightTiles } from './components/PulseScenery';

/* ─── §0-P.5 · one reporting channel. NOTHING here throws. ───────────────────────── */
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
    console.error(`[park] ${blocking.length} BLOCKING failure(s) — the offending PIECE is dropped, ` +
      `the park still renders and still scores.`);
}

const hash01 = (n: number) => {
  const s = Math.sin(n * 12.9898 + 78.233) * 43758.5453;
  return s - Math.floor(s);
};

/* ─── plot constants ─────────────────────────────────────────────────────────────── */
const SIZE = 128;
const SEED = 1;
const CLIMATE = 'temperate' as const;
const CELL = 1.2;
const snap = (v: number) => +(Math.round(v / CELL) * CELL).toFixed(2);
const snapXZ = (c: XZ): XZ => [snap(c[0]), snap(c[1])];

/* ─── §0-P.6 · the pinned seed row + the guard sieve ─────────────────────────────── */
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
function keepDryOf(cells: XZ[], row: SeedRow = SEED_ROW): XZ[] {
  const kept = cells.filter((c) => offRow(c, row));
  const dropped = cells.length - kept.length;
  if (dropped) console.warn(
    `[park] keepDryOf dropped ${dropped} of ${cells.length} guard cell(s) sitting on the pinned ` +
    `row's water. A DROPPED guard is not a fixed cell — check what stands there.`);
  return kept;
}

/* ─── the UNGUARDED composition: peaks + basins for every author-time test ───────── */
const COMP0 = parkComposition(THREE, SEED, SIZE, CLIMATE);
const PEAK_LIMIT = 0.75;
const isDry = (c: XZ) => [...COMP0.basins, ...(COMP0.clampBasins ?? [])]
  .every((b: any) => Math.hypot(c[0] - b.x, c[1] - b.z) > 0.74 * b.radius + 0.6);
const bumpAt = (c: XZ) =>
  Math.max(0, ...COMP0.peaks.map((p: any) => {
    const k = Math.max(0, 1 - Math.hypot(c[0] - p.x, c[1] - p.z) / p.radius);
    return k * k * (3 - 2 * k) * p.height;
  }));

/* ─── §0-P.4 · the MONORAIL ring — VERBATIM, and its pose SEARCHED ───────────────── */
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
const ringCellsFor = (dz: number): XZ[] => [
  [-42.6, -8.4 + dz], [0, 34.2 + dz], [42.6, -8.4 + dz], [0, -51.0 + dz],
  [-42.6, -9.7 + dz],
  [-36.0, -8.4 + dz], [0, 27.6 + dz], [36.0, -8.4 + dz], [0, -57.6 + dz],
  [-40.81, -8.4 + dz], [0, 32.41 + dz], [40.81, -8.4 + dz], [0, -52.79 + dz],
  [-1.2, 33.03 + dz], [41.43, -7.2 + dz], [1.2, -52.17 + dz],
];
const DZ_CANDIDATES = [0, -1.2, 1.2, -2.4, 2.4, 3.6, 4.8, 6.0];
let RING_DZ = 0;
let ringBestBump = Infinity;
let ringFound = false;
for (const dz of DZ_CANDIDATES) {
  const cells = ringCellsFor(dz);
  const decks = cells.slice(0, 4);
  const worstBump = Math.max(...decks.map(bumpAt));
  const wet = cells.filter((c) => !isDry(c) || !offRow(c)).length;
  if (worstBump < ringBestBump) ringBestBump = worstBump;
  if (worstBump <= PEAK_LIMIT && wet === 0) { RING_DZ = dz; ringFound = true; break; }
}
const RING_OK = parkAssert('ringPose', ringFound,
  `no monorail ring pose clears the flank limit (best deck bump ${ringBestBump.toFixed(2)} > ` +
  `${PEAK_LIMIT}) or the waterline — SHIPPING WITHOUT THE RING; transport comes from the ` +
  `Chairlift instead.`, 'blocking');
const RING_CELLS = ringCellsFor(RING_DZ);
const RZ = -8.4 + RING_DZ;
const NT: XZ = [0, 27.6 + RING_DZ];
const STZ = -57.6 + RING_DZ;
console.log(`[park] monorail ring pose: dz ${RING_DZ} · worst deck bump ${ringBestBump.toFixed(2)} · ok ${ringFound}`);

/* ─── §0-P.4 · the CIRCUITS. Authored, not stock. ────────────────────────────────── */
/** a closed ~6.4 × 7.3 u circuit that lands 0.3 u short of the start, heading +z */
const medCircuit = (mirror = false): TrackPiece[] => {
  const turn = mirror ? 'turnL' : 'turnR';
  return [
    'station',
    { type: 'straight', length: 2.4 },
    { type: turn, angle: 90, radius: 2 },
    { type: 'straight', length: 2.4 },
    { type: turn, angle: 90, radius: 2 },
    { type: 'straight', length: 1.3 },
    { type: turn, angle: 90, radius: 2 },
    { type: 'straight', length: 2.4 },
    { type: turn, angle: 90, radius: 2 },
  ] as TrackPiece[];
};
/** a closed ~10.3 × 11.2 u circuit with a real lift and a real drop */
const hillyCircuit = (mirror = false): TrackPiece[] => {
  const turn = mirror ? 'turnL' : 'turnR';
  return [
    'station',
    { type: 'lift', height: 1.2 },
    { type: turn, angle: 90, radius: 2 },
    { type: 'drop', height: 1.2 },
    { type: turn, angle: 90, radius: 2 },
    { type: 'straight', length: 5.18 },
    { type: turn, angle: 90, radius: 2 },
    { type: 'straight', length: 6.28 },
    { type: turn, angle: 90, radius: 2 },
  ] as TrackPiece[];
};
/** THE FLAGSHIP — big lift, deep drop, a vertical LOOP, a camelback, long return straight */
const FLAG_PIECES: TrackPiece[] = [
  'station',
  { type: 'lift', height: 2.4 },
  { type: 'turnR', angle: 90, radius: 3 },
  { type: 'drop', height: 2.4 },
  { type: 'loop', radius: 1.8 },
  { type: 'turnR', angle: 90, radius: 3 },
  { type: 'hill', height: 0.8 },
  { type: 'straight', length: 7.86 },
  { type: 'turnR', angle: 90, radius: 3 },
  { type: 'straight', length: 15.96 },
  { type: 'turnR', angle: 90, radius: 3 },
];
const FLAG_FALLBACK: TrackPiece[] = [
  'station',
  { type: 'lift', height: 2.0 },
  { type: 'turnR', angle: 90, radius: 3 },
  { type: 'drop', height: 2.0 },
  { type: 'turnR', angle: 90, radius: 3 },
  { type: 'hill', height: 0.8 },
  { type: 'straight', length: 2.42 },
  { type: 'turnR', angle: 90, radius: 3 },
  { type: 'straight', length: 12.14 },
  { type: 'turnR', angle: 90, radius: 3 },
];
const FLAG_START: V3 = [14.4, 0.55, -16.8];
const LAT_GUARD = 1.275;

function verifyCircuit(name: string, pieces: TrackPiece[], start: V3) {
  try {
    const out: any = compileTrackPieces(pieces, { type: 'steel', start, heading: 0, bounds: SIZE });
    const rating: any = rateCoaster(out.points, { type: 'steel', bank: 0.7, cars: 3 });
    const design: any = checkCoasterDesign(out.points, { type: 'steel' });
    const ok = !!out.report?.ok && !out.report?.fatal
      && rating.maxLatG <= LAT_GUARD && !(design.violations ?? []).length;
    console.log(`[park] ${name}:`, {
      E: rating.excitement, I: rating.intensity, N: rating.nausea,
      maxLatG: rating.maxLatG, inversions: rating.inversions,
      synthesized: out.report?.synthesizedCount, ok,
    });
    if (!ok) console.error(`[park] ${name} FAILED verification — ` +
      `${out.report?.fatal ?? (design.violations ?? []).map((v: any) => v.kind).join(', ') ?? `maxLatG ${rating.maxLatG}`}`);
    return { ok, points: out.points as V3[] };
  } catch (err) {
    console.error(`[park] ${name} could not be compiled:`, err);
    return { ok: false, points: [] as V3[] };
  }
}
const FLAG = verifyCircuit('Thunderhead Run', FLAG_PIECES, FLAG_START);
const FLAG_ALT = FLAG.ok ? FLAG : verifyCircuit('Thunderhead Run (fallback)', FLAG_FALLBACK, FLAG_START);
const FLAG_USES = FLAG.ok ? FLAG_PIECES : FLAG_FALLBACK;
const FLAG_PTS: V3[] = FLAG_ALT.points;
parkAssert('flagship', FLAG_ALT.ok,
  'neither the flagship circuit nor its rectangle fallback verified — the coaster still mounts, ' +
  'but expect a translucent-red track and no registration.', 'advisory');

/* ─── §0-P.5 · pad clearance, derived the way the validator derives it ───────────── */
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
/** every ride below hands the chassis a COMPACT authored circuit, so the demand is the
 *  4.4 u the med/hilly body really spans — never the stock circuit's table row. */
const AUTHORED_MARGIN = 4.4;
const padMarginOf = (rig: string) => Math.min(PAD_MARGIN[rig] ?? 3.2, AUTHORED_MARGIN);
const minReachOf = (c: number) => laneLenOf(c) + 0.35 + 0.62 + 0.5 + 0.45;
const yawToward = (out: XZ) => Math.atan2(-out[0], -out[1]);

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
          console.warn(`[park] ${label}: pad [${pad}] on a hill flank (bump ${bumpAt(pad).toFixed(2)}) — moved to [${c}]`);
          return c;
        }
      }
  parkAssert('padOnFlank', false,
    `${label}: pad [${pad}] is on a hill flank (bump ${bumpAt(pad).toFixed(2)}) OR WET and no cell ` +
    `within 4.8 u is flat, dry AND ${clear} u off the street.`);
  return pad;
}

type Placement = { pad: XZ; anchor: XZ; dir: XZ; yaw: number; tail: XZ };
function place(tail: XZ, out: XZ, capacity: number, rig: string): Placement {
  const clear = padMarginOf(rig);
  const join = laneLenOf(capacity) + 0.35;
  const reach = minReachOf(capacity) + 2.4;
  const cand: XZ = [+(tail[0] + out[0] * reach).toFixed(2), +(tail[1] + out[1] * reach).toFixed(2)];
  const onStreet = (offPathCell(NET, cand, { clear }) ?? cand) as XZ;
  const pad = assertPadFlat(onStreet, clear, rig);
  const got = Math.hypot(pad[0] - tail[0], pad[1] - tail[1]);
  if (got < minReachOf(capacity) + 1.2)
    parkAssert('padReach', false,
      `${rig}: pad [${pad}] sits ${got.toFixed(2)} u from its tail [${tail}] — the cap-${capacity} ` +
      `floor is ${(minReachOf(capacity) + 1.2).toFixed(2)} u. Open the court or move the tail.`);
  return {
    pad, tail,
    anchor: [+(tail[0] + out[0] * join).toFixed(2), +(tail[1] + out[1] * join).toFixed(2)] as XZ,
    dir: [-out[0], -out[1]] as XZ,
    yaw: yawToward(out),
  };
}

/* ─── the STREET SKELETON — one fuse, every piece wired through a PORT ───────────── */
const T = WORLD_THEMES as any;
const HUB = fountainPlazaPlan({ id: 'hub', title: 'Crown Circus', position: [0, 50.4], tiles: 9, ports: ['N', 'E', 'W'] });

const GATE_AVE = boulevardPlan({ id: 'gateAve', title: 'Gate Promenade', from: [0, 63.6], to: HUB.port('N'), spacing: 3.6 });
const WEST_LINK = boulevardPlan({ id: 'westLink', from: HUB.port('W'), to: [-24.0, 50.4] });
const EAST_LINK = boulevardPlan({ id: 'eastLink', from: HUB.port('E'), to: [38.4, 50.4] });
const SOUTH_AVE = boulevardPlan({ id: 'southAve', title: 'Long Meridian', from: [-24.0, 50.4], to: [-24.0, STZ], spacing: 6.0 });
const EAST_AVE = boulevardPlan({ id: 'eastAve', from: [38.4, 50.4], to: [38.4, -20.4], spacing: 6.0 });
const CROSS = boulevardPlan({ id: 'cross', title: 'Cross Parade', from: [-38.4, 19.2], to: [38.4, 19.2], spacing: 6.0 });
const WEST_AVE = boulevardPlan({ id: 'westAve', from: [-38.4, 19.2], to: [-38.4, -20.4], spacing: 6.0 });
const SOUTH_CROSS = boulevardPlan({ id: 'southCross', from: [-38.4, -20.4], to: [38.4, -20.4], spacing: 6.0 });
const SOUTH_LEG = boulevardPlan({ id: 'southLeg', from: [-24.0, STZ], to: [0, STZ] });
const GLADE_WALK = boulevardPlan({ id: 'gladeWalk', title: 'Glade Walk', from: [-38.4, -2.4], to: [-52.8, -2.4], theme: T.enchantedForest });
const FOUNDRY_WALK = boulevardPlan({ id: 'foundryWalk', title: 'Foundry Row', from: [38.4, 6.0], to: [50.4, 6.0], theme: T.steampunk });
const COVE_WALK = boulevardPlan({ id: 'coveWalk', title: 'Cove Walk', from: [-24.0, -38.4], to: [-48.0, -38.4], theme: T.pirateBeach });

const EMBER_ROW = bazaarPlan({
  id: 'emberRow', title: 'Cinder Market', position: [-9.6, 25.2], theme: T.fire,
  stalls: ['emberRoast', 'burger', 'soda'], names: ['Slagworks Grill', 'Ashfall Burgers', 'Quench Bar'],
});
const GLADE_ROW = bazaarPlan({
  id: 'gladeRow', title: 'Thornwick Row', position: [-57.6, -2.4], theme: T.enchantedForest, lamps: false,
  stalls: ['honeywitch', 'cottonCandy', 'soda'], names: ['The Honeywitch', 'Spindle Floss', 'Dewdrop Sodas'],
});
const FOUNDRY_ROW = bazaarPlan({
  id: 'foundryRow', title: 'Brasswork Arcade', position: [56.4, 6.0], theme: T.steampunk,
  stalls: ['goggles', 'hotDog', 'soda'], names: ['Goggleworks', 'The Pressure Dog', 'Condenser Sodas'],
});
const COVE_ROW = bazaarPlan({
  id: 'coveRow', title: 'Salt Cove Landing', position: [-54.0, -38.4], theme: T.pirateBeach,
  stalls: ['sushi', 'burger', 'balloon'], names: ['Longshore Sushi', 'Galley Burgers', 'Kite & Balloon'],
});
const PULSE_ROW = bazaarPlan({
  id: 'pulseRow', title: 'Pulse Arcade', position: [-9.6, -26.4], theme: T.neon,
  facing: { port: 'W', toward: [-9.6, -20.4] },
  stalls: ['neonSlush', 'cottonCandy', 'burger'], names: ['Subzero Slush', 'Static Floss', 'Bassline Burgers'],
});

const ALL_PLANS: SetPiecePlan[] = [
  HUB, GATE_AVE, WEST_LINK, EAST_LINK, SOUTH_AVE, EAST_AVE, CROSS, WEST_AVE, SOUTH_CROSS,
  SOUTH_LEG, GLADE_WALK, FOUNDRY_WALK, COVE_WALK,
  EMBER_ROW, GLADE_ROW, FOUNDRY_ROW, COVE_ROW, PULSE_ROW,
];

const NODES: XZ[] = [
  [0, 19.2],        // 0 · cross ∩ the monorail north spur
  NT,               // 1 · monorail NORTH tail — LEAF
  [-38.4, RZ],      // 2 · westAve at the ring row
  [-36.0, RZ],      // 3 · monorail WEST tail — LEAF
  [38.4, RZ],       // 4 · eastAve at the ring row
  [36.0, RZ],       // 5 · monorail EAST tail — LEAF
  [-14.4, 19.2],    // 6 · Cinder Market spur root
  [-9.6, -20.4],    // 7 · Pulse Arcade spur root
].map(snapXZ);

const EDGES: [NetRef, NetRef][] = [
  [0, 1], [2, 3], [4, 5],
  [6, 'emberRow:W'],
  [7, 'pulseRow:W'],
  ['gladeWalk:B', 'gladeRow:E'],
  ['foundryWalk:B', 'foundryRow:W'],
  ['coveWalk:B', 'coveRow:E'],
];

const NET = buildParkNet({ nodes: NODES, edges: EDGES, pieces: ALL_PLANS });

/* ─── port + solidity assertions over the authored table ─────────────────────────── */
const portCell = (ref: NetRef): XZ => {
  if (typeof ref === 'number') return NODES[ref];
  const [id, name] = String(ref).split(':');
  const p = ALL_PLANS.find((q) => q.id === id);
  if (!p) { parkAssert('unknownPiece', false, `EDGES references '${ref}' but no plan has id '${id}'`); return [0, 0]; }
  return p.port(name);
};
const EPS = 1e-6;
EDGES.forEach(([a, b]) => {
  const A = portCell(a), B = portCell(b);
  parkAssert('cardinalEdge', Math.abs(A[0] - B[0]) < EPS || Math.abs(A[1] - B[1]) < EPS,
    `edge ${a}→${b} is DIAGONAL: [${A}] → [${B}] — buildParkNet elbows it through a corner cell ` +
    `you did not plan.`, 'advisory');
});
const SOLID_CLEAR: Record<string, number> = { FountainPlaza: 1.8, Bazaar: 0.6, Boulevard: 0 };
function assertNodesOffPieces(nodes: XZ[], plans: SetPiecePlan[]): void {
  const hits: string[] = [];
  plans.forEach((p: any) => {
    const clear = SOLID_CLEAR[p.kind] ?? 1.8;
    if (clear === 0) return;
    const ports = new Set(p.ports.map((pt: any) => `${pt.at[0].toFixed(2)},${pt.at[1].toFixed(2)}`));
    const f = p.footprint;
    const c = Math.cos(-(f.yaw ?? 0)), s = Math.sin(-(f.yaw ?? 0));
    nodes.forEach((n, i) => {
      if (ports.has(`${n[0].toFixed(2)},${n[1].toFixed(2)}`)) return;
      const dx = n[0] - f.cx, dz = n[1] - f.cz;
      const lx = dx * c - dz * s, lz = dx * s + dz * c;
      const gap = Math.max(Math.abs(lx) - f.hx, Math.abs(lz) - f.hz);
      if (gap < clear - 1e-9)
        hits.push(`[${n[0]}, ${n[1]}] (cell ${i}) is ${gap.toFixed(2)} u from '${p.id}' — needs ${clear}`);
    });
  });
  parkAssert('nodeInSolid', !hits.length,
    `${hits.length} authored cell(s) stand inside a set-piece footprint:\n  ` + hits.join('\n  '));
}
const PORT_REFS = EDGES.flat().filter((x): x is string => typeof x === 'string');
ALL_PLANS.forEach((p: any) => {
  const wired = new Set(PORT_REFS.filter((r) => r.split(':')[0] === p.id).map((r) => r.split(':')[1]));
  const chained = p.ports.filter((pt: any) => !pt.prunable);
  if (!chained.length)
    parkAssert('pieceIsland', wired.size > 0 || p.kind === 'FountainPlaza',
      `set-piece '${p.id}' has no port ref in EDGES — it composes as an ISLAND`, 'advisory');
});

/* ─── §5 · the RIDE PLACEMENTS — tail first, pad derived ─────────────────────────── */
const WHEEL = place([0, 60.0], [1, 0], 4, 'FerrisWheel');
const CAROUSEL = place([-12.0, 50.4], [0, 1], 4, 'Carousel');

const MAGMA = place([-16.8, 19.2], [0, -1], 4, 'MagmaRun');
const EMBERW = place([-2.4, 19.2], [0, -1], 4, 'EmberWings');

const WYRM = place([-45.6, -2.4], [0, 1], 4, 'WyrmsHollow');
const BARGE = place([-50.4, -2.4], [0, -1], 6, 'MoonlitBarge');

const GEARS = place([50.4, 6.0], [0, 1], 4, 'GearworksExpress');
const AETHER = place([48.0, 6.0], [0, -1], 6, 'AetherBalloons');

const DRIFT = place([-32.4, -38.4], [0, 1], 6, 'DeepDrift');
const REEF = place([-45.6, -38.4], [0, 1], 4, 'ReefRacer');

const BASS = place([2.4, -20.4], [0, -1], 4, 'Bassline');
const DISCO = place([14.4, -20.4], [0, -1], 6, 'Discotron');

const CHAIR = place([-24.0, 32.4], [1, 0], 4, 'Chairlift');

const RIDE_PADS: XZ[] = [
  WHEEL.pad, CAROUSEL.pad, MAGMA.pad, EMBERW.pad, WYRM.pad, BARGE.pad, GEARS.pad,
  AETHER.pad, DRIFT.pad, REEF.pad, BASS.pad, DISCO.pad, CHAIR.pad,
];
assertNodesOffPieces([...NODES, ...RIDE_PADS], ALL_PLANS);

/* two rides may never share a tail cell */
const TAILS = [WHEEL, CAROUSEL, MAGMA, EMBERW, WYRM, BARGE, GEARS, AETHER, DRIFT, REEF, BASS, DISCO, CHAIR]
  .map((p) => `${p.tail[0]},${p.tail[1]}`);
parkAssert('queueTailShared', new Set(TAILS).size === TAILS.length,
  `two rides share a queue tail cell: ${TAILS.join(' | ')}`);

/* ─── landmarks + the themed scatter ─────────────────────────────────────────────── */
const VOLCANO_AT: XZ = [-19.2, 24.0];
const ROOST_AT: XZ = [-56.4, -16.8];
const FURNACE_AT: XZ = [58.8, -6.0];
const GALLEON_AT: XZ = [-56.4, -27.6];
const PYLON_AT: XZ = [-16.8, -31.2];
const LANDMARKS: XZ[] = [VOLCANO_AT, ROOST_AT, FURNACE_AT, GALLEON_AT, PYLON_AT];

const OCCUPIED: XZ[] = [...RIDE_PADS, ...LANDMARKS, ...RING_CELLS,
  ...ALL_PLANS.map((p: any) => [p.footprint.cx, p.footprint.cz] as XZ)];

function scatterCells(centre: XZ, hx: number, hz: number, n: number, seedBase: number,
                      minFromOccupied = 6.5, clear = 1.2): XZ[] {
  const out: XZ[] = [];
  for (let i = 0; i < n * 26 && out.length < n; i += 1) {
    const h1 = hash01(seedBase + i * 2.17);
    const h2 = hash01(seedBase + i * 3.71 + 11);
    const raw: XZ = [
      +(centre[0] + (h1 * 2 - 1) * hx).toFixed(2),
      +(centre[1] + (h2 * 2 - 1) * hz).toFixed(2),
    ];
    if (Math.abs(raw[0]) > 60 || Math.abs(raw[1]) > 60) continue;
    if (!offRow(raw, SEED_ROW, 10)) continue;
    if (bumpAt(raw) > 1.6 || !isDry(raw)) continue;
    if (OCCUPIED.some((o) => Math.hypot(o[0] - raw[0], o[1] - raw[1]) < minFromOccupied)) continue;
    if (out.some((o) => Math.hypot(o[0] - raw[0], o[1] - raw[1]) < 2.6)) continue;
    const cell = offPathCell(NET, raw, { clear });
    if (!cell) continue;
    if (OCCUPIED.some((o) => Math.hypot(o[0] - cell[0], o[1] - cell[1]) < minFromOccupied)) continue;
    out.push(cell as XZ);
  }
  return out;
}

type PropSpec = { C: React.ComponentType<any>; at: XZ; rot: number; s: number };
const propsFrom = (kinds: React.ComponentType<any>[], cells: XZ[], seedBase: number): PropSpec[] =>
  cells.map((at, i) => ({
    C: kinds[i % kinds.length],
    at,
    rot: (hash01(seedBase + i * 5.3) * 2 - 1) * Math.PI,
    s: i + 1,
  }));

const FIRE_CELLS = scatterCells([-13.0, 16.0], 11, 11, 10, 101);
const GLADE_CELLS = scatterCells([-50.0, -4.0], 10, 11, 10, 202);
const FOUNDRY_CELLS = scatterCells([52.0, 4.0], 8, 12, 10, 303);
const COVE_CELLS = scatterCells([-42.0, -32.0], 12, 8, 10, 404);
const PULSE_CELLS = scatterCells([2.0, -27.0], 13, 7, 10, 505);

const FIRE_PROPS = propsFrom([Fumarole, ObsidianShards, BasaltColumns, LavaFissure, CharredSnag], FIRE_CELLS, 11);
const GLADE_PROPS = propsFrom([GiantToadstools, StandingStones, LanternTree, RuinedArch, FlowerPodBed], GLADE_CELLS, 22);
const FOUNDRY_PROPS = propsFrom([GiantGear, SteamPipes, ClockTower, BoilerTank, CoalCart], FOUNDRY_CELLS, 33);
const COVE_PROPS = propsFrom([WreckedHull, CoralCluster, AnchorPile, TidePool, DockPilings], COVE_CELLS, 44);
const PULSE_PROPS = propsFrom([NeonArch, SpeakerStack, MirrorBallPylon, LaserTruss, LightTiles], PULSE_CELLS, 55);

const NEUTRAL_CELLS = [
  ...scatterCells([0, 40], 22, 10, 6, 606, 6.0),
  ...scatterCells([20, 4], 14, 16, 6, 707, 6.0),
];
const NEUTRAL_NAMES = ['planterBox', 'topiarySpiral', 'marbleStatue', 'picnicTable', 'birdbath', 'parkClock',
  'signpost', 'gazebo', 'wishingWell', 'flagpole', 'lionStatue', 'ironArchway'];

const TREE_SHAPES = ['round', 'pine', 'willow', 'round', 'pine'] as const;
type TreeShape = (typeof TREE_SHAPES)[number];
const TREE_CELLS: XZ[] = [
  ...scatterCells([-14, 40], 24, 14, 9, 801, 5.0, 0.75),
  ...scatterCells([26, 30], 18, 18, 9, 802, 5.0, 0.75),
  ...scatterCells([-46, 8], 14, 14, 9, 803, 5.0, 0.75),
  ...scatterCells([-6, -8], 24, 10, 9, 804, 5.0, 0.75),
  ...scatterCells([-34, -46], 18, 10, 8, 805, 5.0, 0.75),
];
const TREES = TREE_CELLS.map((at, i) => ({ at, shape: TREE_SHAPES[i % TREE_SHAPES.length] as TreeShape }));
parkAssert('dressCounts', TREES.length >= 32 && (FIRE_PROPS.length + GLADE_PROPS.length +
  FOUNDRY_PROPS.length + COVE_PROPS.length + PULSE_PROPS.length + NEUTRAL_CELLS.length) >= 16,
  `dressing under the floor — ${TREES.length} trees (≥ 32) and ` +
  `${FIRE_PROPS.length + GLADE_PROPS.length + FOUNDRY_PROPS.length + COVE_PROPS.length + PULSE_PROPS.length + NEUTRAL_CELLS.length} scenery placements (≥ 16)`);

/* ─── the FIVE WORLDS ────────────────────────────────────────────────────────────── */
const FIRE_WORLD = worldPlan({
  id: 'fire', theme: T.fire, pieces: [EMBER_ROW],
  include: [MAGMA.pad, EMBERW.pad, VOLCANO_AT, RING_CELLS[1], ...FIRE_CELLS],
});
const GLADE_WORLD = worldPlan({
  id: 'enchantedForest', theme: T.enchantedForest, pieces: [GLADE_ROW],
  include: [WYRM.pad, BARGE.pad, ROOST_AT, RING_CELLS[0], ...GLADE_CELLS],
});
const FOUNDRY_WORLD = worldPlan({
  id: 'steampunk', theme: T.steampunk, pieces: [FOUNDRY_ROW],
  include: [GEARS.pad, AETHER.pad, FURNACE_AT, RING_CELLS[2], ...FOUNDRY_CELLS],
});
const COVE_WORLD = worldPlan({
  id: 'pirateBeach', theme: T.pirateBeach, pieces: [COVE_ROW],
  include: [DRIFT.pad, REEF.pad, GALLEON_AT, ...COVE_CELLS],
});
const PULSE_WORLD = worldPlan({
  id: 'neon', theme: T.neon, pieces: [PULSE_ROW],
  include: [BASS.pad, DISCO.pad, PYLON_AT, ...PULSE_CELLS],
});
const WORLDS = [FIRE_WORLD, GLADE_WORLD, FOUNDRY_WORLD, COVE_WORLD, PULSE_WORLD];

const WORLD_FLOOR = 20 * Math.sqrt(SIZE / 48);
const pairs: string[] = [];
WORLDS.forEach((a: any, i) => WORLDS.slice(i + 1).forEach((b: any) => {
  const d = Math.hypot(a.centre[0] - b.centre[0], a.centre[1] - b.centre[1]);
  pairs.push(`${a.id}↔${b.id} ${d.toFixed(1)}`);
  parkAssert('worldSpacing', d >= WORLD_FLOOR,
    `worlds '${a.id}' and '${b.id}' are ${d.toFixed(2)} u apart — the floor is ${WORLD_FLOOR.toFixed(2)} u`);
}));
console.log('[park] world centre pairs:', pairs.join(' · '));

/* ─── the GUARD LIST — derived, sieved, never a blanket slice ────────────────────── */
const WORLD_CELLS: XZ[] = WORLDS.flatMap((w: any) => (w.cells ?? []) as XZ[]);
const GUARDS = keepDryOf([
  ...(NET.keepDry as XZ[]),
  ...WORLD_CELLS,
  ...RIDE_PADS,
  ...(RING_OK ? RING_CELLS : []),
]);

/* the GUARDED composition, diffed against the bare one */
const COMP: any = parkComposition(THREE, SEED, SIZE, CLIMATE, { keepDry: GUARDS, coasterPts: FLAG_PTS } as any);
parkAssert('waterMoved',
  Math.hypot(COMP.waterCentre[0] - COMP0.waterCentre[0], COMP.waterCentre[1] - COMP0.waterCentre[1]) < 1 &&
  Math.hypot(COMP.waterCentreSecond[0] - COMP0.waterCentreSecond[0],
             COMP.waterCentreSecond[1] - COMP0.waterCentreSecond[1]) < 1,
  `guards moved a water body off the pinned row — dominant ${JSON.stringify(COMP0.waterCentre)} → ` +
  `${JSON.stringify(COMP.waterCentre)}, secondary ${JSON.stringify(COMP0.waterCentreSecond)} → ` +
  `${JSON.stringify(COMP.waterCentreSecond)}, terrainSeed ${COMP0.terrainSeed} → ${COMP.terrainSeed}`);
const rf = COMP.report?.reliefFloor;
parkAssert('terrainFlattened', !rf || rf.kept >= rf.floor,
  rf ? `keepDry flattened the seed: relief ${rf.authoredRelief?.toFixed(2)} → ${rf.relief?.toFixed(2)} ` +
    `(kept ${rf.kept?.toFixed(2)} against the ${rf.floor} floor), stdH ${rf.authoredStdH?.toFixed(2)} → ` +
    `${rf.stdH?.toFixed(2)} · ranges ${rf.guardedRanges}` : '', 'advisory');
console.log('[park] composition:', {
  terrainSeed: COMP.terrainSeed, probes: `${COMP0.report?.probesTried}→${COMP.report?.probesTried}`,
  waterBodies: COMP.report?.waterBodies, waterAreaU2: COMP.report?.waterAreaU2,
  reliefKept: rf?.kept, stdH: rf?.stdH, guards: GUARDS.length,
});

parkAssertFlush();

/* ─── §0-P.6 · the DRY RECEIPT, taken IN THE TREE against the gate's own predicate ─ */
function dryRing(park: any, c: XZ, r = 0.75): boolean {
  const g = park.ground;
  if (!g?.lint) return true;
  const dry = (x: number, z: number) => g.lint.isDry(x, z, 0.05);
  if (!dry(c[0], c[1])) return false;
  for (let k = 0; k < 8; k += 1) {
    const a = (k / 8) * Math.PI * 2;
    if (!dry(c[0] + Math.cos(a) * r, c[1] + Math.sin(a) * r)) return false;
  }
  return true;
}
function DryScatter<Item extends { at: XZ }>({ cells, label, render }: {
  cells: Item[]; label: string; render: (c: Item, i: number) => React.ReactNode;
}) {
  const park = usePark('DryScatter');
  const [dry, setDry] = React.useState<Item[] | null>(null);
  React.useEffect(() => {
    const kept = cells.filter((c) => dryRing(park, c.at));
    if (kept.length < cells.length)
      console.error(`[park] DryScatter(${label}) dropped ${cells.length - kept.length} of ${cells.length} ` +
        `cell(s) under waterline+0.05: ${JSON.stringify(cells.filter((c) => !kept.includes(c)).map((c) => c.at))}`);
    setDry(kept);
  }, [park, cells, label]);
  return <>{(dry ?? []).map(render)}</>;
}

/* ─── the ROSTER, counted off the register calls that actually mount ─────────────── */
const RIDE_NAMES = [
  'Thunderhead Run', 'Skyline Wheel', 'Gilded Carousel', 'Cinder Run', 'Ashwing Flight',
  "Wyrm's Hollow", 'Moonlit Barge', 'Gearworks Express', 'Aether Ascent', 'Deep Drift',
  'Reef Racer', 'Bassline', 'Discotron Prime', RING_OK ? 'Five Crowns Skyline' : 'Canopy Chairlift',
];

export function App() {
  return (
    <div className="w-full min-h-full bg-slate-900">
      <Park
        seed={SEED}
        climate={CLIMATE}
        roster={{ rides: RIDE_NAMES, stalls: 15, categories: 5 }}
        onReady={(report: any) => {
          console.log('[park] validatePark →', {
            ok: report?.ok, failures: report?.failures?.length, warnings: report?.warnings?.length,
          });
          if (report?.failures?.length) console.error('[park] failures:', report.failures);
          if (report?.warnings?.length) console.warn('[park] warnings:', report.warnings);
        }}
      >
        <Terrain keepDry={GUARDS} coasterPts={FLAG_PTS} />
        <Paths nodes={NET.nodes} edges={NET.edges} plazas={NET.plazas} bins={NET.bins} walkers={8} />
        <GameManager />
        <Gate />

        {/* ── the world REGIONS + their floors and their giants ───────────────────── */}
        {WORLDS.map((w: any) => <World key={`w-${w.id}`} plan={w} />)}
        {WORLDS.map((w: any) => <WorldGround key={`wg-${w.id}`} plan={w} />)}
        <WorldLandmark plan={FIRE_WORLD} position={VOLCANO_AT} />
        <WorldLandmark plan={GLADE_WORLD} position={ROOST_AT} />
        <WorldLandmark plan={FOUNDRY_WORLD} position={FURNACE_AT} />
        <WorldLandmark plan={COVE_WORLD} position={GALLEON_AT} />
        <WorldLandmark plan={PULSE_WORLD} position={PYLON_AT} />

        {/* ── the street set-pieces ───────────────────────────────────────────────── */}
        <FountainPlaza plan={HUB} />
        <Boulevard plan={GATE_AVE} />
        <Boulevard plan={WEST_LINK} />
        <Boulevard plan={EAST_LINK} />
        <Boulevard plan={SOUTH_AVE} />
        <Boulevard plan={EAST_AVE} />
        <Boulevard plan={CROSS} />
        <Boulevard plan={WEST_AVE} />
        <Boulevard plan={SOUTH_CROSS} />
        <Boulevard plan={SOUTH_LEG} />
        <Boulevard plan={GLADE_WALK} />
        <Boulevard plan={FOUNDRY_WALK} />
        <Boulevard plan={COVE_WALK} />
        <Bazaar plan={EMBER_ROW} />
        <Bazaar plan={GLADE_ROW} />
        <Bazaar plan={FOUNDRY_ROW} />
        <Bazaar plan={COVE_ROW} />
        <Bazaar plan={PULSE_ROW} />

        {/* ── THE FLAGSHIP — pieces mode, verified at module scope ────────────────── */}
        <Coaster
          name="Thunderhead Run"
          pieces={FLAG_USES}
          start={FLAG_START}
          heading={0}
          type="steel"
          cars={3}
          capacity={4}
          rideDuration={11}
          loadTime={2}
          intensity={9}
          price={7}
          queueTailNode={NET.node([14.4, -20.4])}
          queueDir={[0, 1]}
        />

        {/* ── the entrance pair — the gate's own smoke-cycle ride is 3.6 u away ───── */}
        <FerrisWheel
          position={WHEEL.pad} rotation={WHEEL.yaw}
          register={{ name: 'Skyline Wheel', capacity: 4, price: 3, rideDuration: 9, intensity: 2 }}
          queue={{ anchor: WHEEL.anchor, dir: WHEEL.dir }}
        />
        <Carousel
          position={CAROUSEL.pad} rotation={CAROUSEL.yaw}
          register={{ name: 'Gilded Carousel', capacity: 4, price: 2, rideDuration: 8, intensity: 1 }}
          queue={{ anchor: CAROUSEL.anchor, dir: CAROUSEL.dir }}
        />

        {/* ── FIRE ────────────────────────────────────────────────────────────────── */}
        <MagmaRun
          position={MAGMA.pad} rotation={MAGMA.yaw} pieces={hillyCircuit()}
          register={{ name: 'Cinder Run', capacity: 4, price: 6, rideDuration: 10, intensity: 8 }}
          queue={{ anchor: MAGMA.anchor, dir: MAGMA.dir }}
        />
        <EmberWings
          position={EMBERW.pad} rotation={EMBERW.yaw} pieces={medCircuit(true)}
          register={{ name: 'Ashwing Flight', capacity: 4, price: 6, rideDuration: 9, intensity: 7 }}
          queue={{ anchor: EMBERW.anchor, dir: EMBERW.dir }}
        />

        {/* ── ENCHANTED FOREST ────────────────────────────────────────────────────── */}
        <WyrmsHollow
          position={WYRM.pad} rotation={WYRM.yaw} pieces={medCircuit()}
          register={{ name: "Wyrm's Hollow", capacity: 4, price: 5, rideDuration: 10, intensity: 6 }}
          queue={{ anchor: WYRM.anchor, dir: WYRM.dir }}
        />
        <MoonlitBarge
          position={BARGE.pad} rotation={BARGE.yaw} pieces={medCircuit(true)}
          register={{ name: 'Moonlit Barge', capacity: 6, price: 4, rideDuration: 11, intensity: 3 }}
          queue={{ anchor: BARGE.anchor, dir: BARGE.dir }}
        />

        {/* ── STEAMPUNK ───────────────────────────────────────────────────────────── */}
        <GearworksExpress
          position={GEARS.pad} rotation={GEARS.yaw} pieces={hillyCircuit(true)}
          register={{ name: 'Gearworks Express', capacity: 4, price: 5, rideDuration: 10, intensity: 6 }}
          queue={{ anchor: GEARS.anchor, dir: GEARS.dir }}
        />
        <AetherBalloons
          position={AETHER.pad} rotation={AETHER.yaw}
          register={{ name: 'Aether Ascent', capacity: 6, price: 3, rideDuration: 9, intensity: 2 }}
          queue={{ anchor: AETHER.anchor, dir: AETHER.dir }}
        />

        {/* ── PIRATE BEACH ────────────────────────────────────────────────────────── */}
        <DeepDrift
          position={DRIFT.pad} rotation={DRIFT.yaw} pieces={medCircuit()}
          register={{ name: 'Deep Drift', capacity: 6, price: 5, rideDuration: 11, intensity: 4 }}
          queue={{ anchor: DRIFT.anchor, dir: DRIFT.dir }}
        />
        <ReefRacer
          position={REEF.pad} rotation={REEF.yaw} pieces={medCircuit(true)}
          register={{ name: 'Reef Racer', capacity: 4, price: 5, rideDuration: 10, intensity: 5 }}
          queue={{ anchor: REEF.anchor, dir: REEF.dir }}
        />

        {/* ── NEON ────────────────────────────────────────────────────────────────── */}
        <Bassline
          position={BASS.pad} rotation={BASS.yaw} pieces={hillyCircuit()}
          register={{ name: 'Bassline', capacity: 4, price: 6, rideDuration: 10, intensity: 7 }}
          queue={{ anchor: BASS.anchor, dir: BASS.dir }}
        />
        <Discotron
          position={DISCO.pad} rotation={DISCO.yaw}
          register={{ name: 'Discotron Prime', capacity: 6, price: 4, rideDuration: 9, intensity: 5 }}
          queue={{ anchor: DISCO.anchor, dir: DISCO.dir }}
        />

        {/* ── TRANSPORT — the ring if a pose cleared, the chairlift if it did not ─── */}
        {RING_OK ? (
          <Monorail
            position={[-42.6, 0, -9.7 + RING_DZ]}
            rotation={0}
            pieces={MONO_PIECES}
            register={{ name: 'Five Crowns Skyline', capacity: 6, price: 3, rideDuration: 12, intensity: 1 }}
          />
        ) : (
          <Chairlift
            position={CHAIR.pad} rotation={CHAIR.yaw} pieces={medCircuit()}
            register={{ name: 'Canopy Chairlift', capacity: 4, price: 3, rideDuration: 10, intensity: 2 }}
            queue={{ anchor: CHAIR.anchor, dir: CHAIR.dir }}
          />
        )}

        {/* ── amenities ───────────────────────────────────────────────────────────── */}
        <Restroom position={[9.6, 45.6]} rotation={Math.PI} />
        <Neon text="FIVE CROWNS" position={[0, 1.8, 61.2]} rotation={Math.PI} scale={0.6} />
        <Lights from={[-2.4, 57.6]} to={[2.4, 57.6]} />
        <Lights from={[-2.4, 62.4]} to={[2.4, 62.4]} />
        <Torch position={[-3.6, 63.6]} />
        <Torch position={[3.6, 63.6]} />

        {/* ── the DRESS, sieved against the gate's own waterline predicate ────────── */}
        <DryScatter
          cells={TREES} label="trees"
          render={(t, i) => (
            <Placed key={`tr-${i}`} position={t.at} build={(three: any) => tree(three, { shape: t.shape })} />
          )}
        />
        <DryScatter
          cells={NEUTRAL_CELLS.map((at, i) => ({ at, name: NEUTRAL_NAMES[i % NEUTRAL_NAMES.length] }))}
          label="neutral"
          render={(s, i) => <Scenery key={`sc-${i}`} name={s.name} position={s.at} seed={i + 1} />}
        />
        {([
          ['fire', FIRE_PROPS], ['glade', GLADE_PROPS], ['foundry', FOUNDRY_PROPS],
          ['cove', COVE_PROPS], ['pulse', PULSE_PROPS],
        ] as [string, PropSpec[]][]).map(([label, list]) => (
          <DryScatter
            key={`ds-${label}`} cells={list} label={label}
            render={(p, i) => <p.C key={`${label}-${i}`} position={p.at} rotation={p.rot} seed={p.s} />}
          />
        ))}
      </Park>
    </div>
  );
}

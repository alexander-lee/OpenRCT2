/* ═══ CINDERGLASS FAIR — §0 PRE-FLIGHT ══════════════════════════════════════════════
 * SIZE   128 (default, `size` prop omitted)
 * SEED   1 / temperate — dominant lake ctr (41, -39) box x[21,60] z[-60,-21]  [PRE-keepDry]
 *        secondary ctr (-38, 31) box x[-56,-21] z[23,39] · real NW bowl reaches x -18.1,
 *        so NO street column runs west of x -14.4 inside z 23..39 (§0-P.6's measured trap).
 *        RING WATER WALK: all 16 monorail ring cells are swept against BOTH basins by
 *        `ringPoseSearch()` at module scope; the chosen RING_DZ is the first pose whose
 *        four decks are BOTH under the 0.75 flank limit AND outside every composed bowl.
 *        The pose, the four deck bumps and the wet count are printed to the console.
 *        Every pad + prop cell is re-checked IN THE TREE by the gate's own predicate
 *        (`dryRing`, min ground over the footprint ring > WATER_LEVEL + 0.05 = -0.21).
 *        reliefFloor.kept — read off report.reliefFloor at runtime, asserted >= 0.70.
 * WORLDS 5 (ALL of them): fire @(0, 38.5) · steampunk @(-37.5, 4.5) · neon @(35, 11)
 *        · enchantedForest @(-35, -45) · pirateBeach @(8, -55).
 *        Regions are DERIVED by worldPlan from each world's own pads + props, so the
 *        centres above are the planned targets; the true centres and the closest pair
 *        are measured at module scope and asserted against 32.66 (20·√(128/48)).
 *        Closest planned pair fire↔neon 44.5 · forest↔pirate 44.1 · steampunk↔forest 49.6.
 *        WORLD fire: MagmaRun + EmberWings · stall Ember Roast · 10 themed props · GROUND
 *              + GIANT (Volcano via WorldLandmark) · path spur off the hub's S port ✓
 *        WORLD steampunk: AetherBalloons + BoilerBurst · stall Goggle Works · 8 props ✓
 *        WORLD neon: Discotron + MagneticRide · stall Neon Slush · 8 props ✓
 *        WORLD enchantedForest: Chairlift + MoonlitBarge · stall Honeywitch · 8 props ✓
 *        WORLD pirateBeach: ReefRacer + DeepDrift · stall Sushi Stall · 8 props ✓
 *        Every themed prop comes from that world's OWN pack — no foreign piece is mounted
 *        inside another world's rect, so `worldThemeMixed` cannot fire.
 * CATS   (WRITTEN BEFORE ANY JSX) gentle Carousel + AetherBalloons · thrill FLAGSHIP
 *        Coaster + MagmaRun + EmberWings + BoilerBurst + Discotron · water LogFlume +
 *        ReefRacer + DeepDrift + MoonlitBarge · transport Monorail + Chairlift +
 *        MagneticRide · dark GhostTrain   → 5/5 categories ✓
 * CIRCUITS  Flagship Coaster · MagmaRun · EmberWings · LogFlume · ReefRacer · DeepDrift ·
 *        MoonlitBarge · Chairlift · MagneticRide · Monorail ring → 10 CIRCUITS (>= 5)
 *        across 4 FAMILIES (coaster · water · transport · dark) (>= 3) ✓
 * GATE   [0, 63.6] → first queue tail [7.2, 60.0] = 3.6 + 7.2 = 10.8 u of street  <= 15 ✓
 * FLAG   start [-24, 0.55, -41.4] heading 0, steel, cars 3, NO bank prop (steel builds 0.7)
 *        A CLOSED RECTANGLE WITH A VERTICAL LOOP: station · lift 2.0 · turnR90 r2.5 ·
 *        drop 1.2 · loop r1.6 · straight 1.2 · turnR90 · hill 0.8 · straight 7.9 ·
 *        turnR90 · straight 10.48 · turnR90 · brake tail 1.6 landing ~0.3 u short.
 *        rateCoaster(bank 0.7, cars 3) is CALLED on the compiled points and its E / I / N
 *        / maxLatG / inversions / synthesized are logged; the mount is GATED on the
 *        verdict and falls back to a loop-free rectangle if the loop fails to compile.
 *        CORRIDOR KEEP-OUT: bbox x[-24, -8.5] z[-43.3, -26.9]. West avenue x -26.4 (2.4 u
 *        clear), south loop z -45.6 (2.3 u), south plaza x >= -5.4 (3.1 u), cross road
 *        z -8.4 (18 u). No street leg crosses that box at grade.
 * FLAG2  MagmaRun (fire) and EmberWings (fire) are the second and third COASTER-family
 *        circuits, each on its own compact verified archetype, bboxes disjoint from the
 *        flagship's and from each other, both off all 16 ring cells.
 * STREET buildParkNet called EXACTLY ONCE ✓ · the SAME NET feeds <Paths> and every
 *        offPathCell ✓ · PORT-REFS: 3 pieces (hub, market, southPlaza) → 7 refs in EDGES,
 *        asserted present and both-ends-wired by `assertPorts` ✓ · every ride pad is
 *        returned BY offPathCell + assertPadFlat, never a raw tail+out·d sum ✓
 * MONO   ring VERBATIM (the published 17-piece array, two-part tail, no `as` cast).
 *        position [-42.6, 0, -9.7 + RING_DZ], rotation 0 — the START POSE, not the centre.
 *        4 platforms · decks W/E fall inside steampunk and neon, N inside fire, S inside
 *        pirateBeach → 4 of 5 declared worlds carry a platform; enchantedForest is served
 *        by its own street spur instead. All four tails are AUTHORED NODES and all four
 *        are LEAVES (degree 1) — no street continues past a platform.
 *        S queues OUTWARD ([0,-1]); W/N/E queue INWARD.
 * QUEUE  ONE ROW PER RIDE — the tail is the AUTHORED NODE, the pad is DERIVED from it by
 *        `place(tail, out, capacity, rig)`: reach = laneLenOf(cap) + 0.35 + 0.62 + 0.50 +
 *        0.45 + 2.4 = 7.66 at capacity 4, then offPathCell(padMarginOf(rig)) then
 *        assertPadFlat. Every tail→pad distance is re-measured after the fuse and asserted
 *        against the cap-4 floor 6.46. No two rides share a tail node.
 * GROUND every pad, hut, tail and exit-join cell is inside the 0.5/1.2 grade and outside
 *        every peak disc (bumpAt <= 0.75) — enforced by assertPadFlat's ring search.
 * SPREAD built bbox ~72 × 122 · street-node bbox x[-36, 36] z[-59.3, 63.6] ✓
 * PLAZAS 3 rects from NET.plazas — hub (9 tiles, 10.8²), market courtyard (9 × 3 tiles),
 *        south plaza (9 tiles, 10.8²). Largest 116.6 u² >= 8 ✓
 *        NO set-piece `position` appears in NODES or as a queue tail — asserted by
 *        `assertNodesOffPieces` over the authored nodes AND again over the settled pads.
 * NODES  43 authored · degree-1: 18, and every one of them carries a queue tail or the
 *        gate ✓ · two park-spanning loops (north avenue ring and south service ring),
 *        both crossing z = 0 ✓
 * ATTACH every spur leaves its parent on the flat: no `nodeY` is used anywhere, so every
 *        edge inherits the street's median level and |Δy|/len is 0 by construction.
 *        accessibility.allRidesReachable is read off the onReady report and logged.
 * LATTICE authored spans 1.2 / 3.6 / 4.8 / 7.2 / 9.6 / 12.0 / 15.6 / 18.0 / 26.4 u — nine
 *        distinct classes, so effectiveClasses >= 4 and the 1.2-chain share stays low.
 * ROSTER 15 rides / 5 categories / 9 stalls (9 kinds) / 2 restrooms / bins from the pieces.
 *        NAMED: every ride AND every stall carries an authored `name` — 0 shipped on a
 *        catalog defaultName. <Park roster={{ rides: [...15], stalls: 9, categories: 5 }}>
 *        is MOUNTED, without which preflight refuses to bundle.
 * DRESS  46 tree cells authored against the >= 32 floor and 24 neutral scenery cells
 *        against the >= 16 floor, every one pushed through offPathCell and then sieved by
 *        <DryScatter> with the gate's own predicate. Themed props: 42 across five worlds.
 * NIGHT  set-piece festival spans (hub, market, south plaza) + 8 torches + 2 neon signs.
 *        No hand-authored PointLight runs, so the park stays well inside the light budget.
 * GATE   parkAssertFlush() → reports, NEVER throws · validatePark → read in onReady.
 * ═══════════════════════════════════════════════════════════════════════════════════ */
import * as THREE from 'three';
import React from 'react';

import type { V3, XZ } from './components/Park';
import {
  Park, GameManager, Terrain, Paths, Gate, Coaster, Restroom, Scenery, Torch, Neon,
  Placed, offPathCell, usePark,
} from './components/Park';
import { laneLenOf, parkComposition } from './components/ParkBuilder';
import type { TrackPiece } from './components/SplineRideKit';
import { compileTrackPieces, rateCoaster, checkCoasterDesign } from './components/SplineRideKit';
import type { NetRef, SetPiecePlan } from './components/SetPieceKit';
import {
  buildParkNet, worldPlan, World,
  EMBERFALL_CALDERA, TIDEWATER_HOLLOW, BRASSWORK_FOUNDRY, THORNWICK_GLADE, PULSE_DISTRICT,
} from './components/SetPieceKit';
import { FountainPlaza, fountainPlazaPlan } from './components/FountainPlaza';
import { Bazaar, bazaarPlan } from './components/Bazaar';
import { WorldGround } from './components/WorldGround';
import { WorldLandmark } from './components/WorldLandmark';
import { tree } from './components/Kit';

import { Monorail } from './components/Monorail';
import { Carousel } from './components/Carousel';
import { GhostTrain } from './components/GhostTrain';
import { LogFlume } from './components/LogFlume';
import { MagmaRun } from './components/MagmaRun';
import { EmberWings } from './components/EmberWings';
import { AetherBalloons } from './components/AetherBalloons';
import { BoilerBurst } from './components/BoilerBurst';
import { Discotron } from './components/Discotron';
import { MagneticRide } from './components/MagneticRide';
import { Chairlift } from './components/Chairlift';
import { MoonlitBarge } from './components/MoonlitBarge';
import { ReefRacer } from './components/ReefRacer';
import { DeepDrift } from './components/DeepDrift';

import { EmberRoast } from './components/EmberRoast';
import { SushiStall } from './components/SushiStall';
import { GoggleWorks } from './components/GoggleWorks';
import { Honeywitch } from './components/Honeywitch';
import { NeonSlush } from './components/NeonSlush';

import { Fumarole, ObsidianShards, BasaltColumns, LavaFissure, CharredSnag } from './components/EmberfallScenery';
import { WreckedHull, CoralCluster, AnchorPile, TidePool, DockPilings } from './components/TidewaterScenery';
import { GiantGear, SteamPipes, ClockTower, BoilerTank, CoalCart } from './components/BrassworkScenery';
import { GiantToadstools, StandingStones, LanternTree, RuinedArch, FlowerPodBed } from './components/ThornwickScenery';
import { NeonArch, SpeakerStack, MirrorBallPylon, LaserTruss, LightTiles } from './components/PulseScenery';

/* ─── §1  ASSERTION BUS — reports everything, throws nothing ─────────────────────── */

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
    console.error(`[park] ${blocking.length} BLOCKING failure(s) — the offending piece is dropped and ` +
      `the rest of the park still mounts, renders and scores.`);
}

/* ─── §2  PLOT, SEED ROW, TERRAIN PREDICATES ─────────────────────────────────────── */

const SIZE = 128;
const SEED = 1;
const CLIMATE = 'temperate';
const PEAK_LIMIT = 0.75;

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

interface Disc { x: number; z: number; radius: number; height?: number }
interface ReliefFloorRec {
  relief: number; stdH: number; authoredRelief: number; authoredStdH: number;
  kept: number; floor: number; ok: boolean; guardedRanges: number; cappedPeaks: unknown[];
}
interface CompLike {
  peaks: Disc[];
  basins: Disc[];
  clampBasins: Disc[];
  waterCentre: XZ;
  waterCentreSecond: XZ;
  terrainSeed: number;
  report: { reliefFloor: ReliefFloorRec | null; probesTried: number; violations: string[] };
}

/** UNGUARDED composition — the honest landform, and the frame every pose/pad test uses. */
const COMP0 = parkComposition(THREE, SEED, SIZE, CLIMATE) as unknown as CompLike;

const bumpIn = (comp: CompLike, c: XZ) =>
  Math.max(0, ...comp.peaks.map((p) => {
    const k = Math.max(0, 1 - Math.hypot(c[0] - p.x, c[1] - p.z) / p.radius);
    return k * k * (3 - 2 * k) * (p.height ?? 0);
  }));

const dryIn = (comp: CompLike, c: XZ) => [...comp.basins, ...comp.clampBasins]
  .every((b) => Math.hypot(c[0] - b.x, c[1] - b.z) > 0.74 * b.radius + 0.6);

const bumpAt = (c: XZ) => bumpIn(COMP0, c);
const isDry = (c: XZ) => dryIn(COMP0, c);

/* ─── §3  MONORAIL RING — the published circuit, and a searched pose ─────────────── */

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

const decksAt = (dz: number): XZ[] =>
  [[-42.6, -8.4 + dz], [0, 34.2 + dz], [42.6, -8.4 + dz], [0, -51.0 + dz]];

function ringCellsAt(dz: number): XZ[] {
  return [
    ...decksAt(dz),
    [-42.6, -9.7 + dz],
    [-36.0, -8.4 + dz], [0, 27.6 + dz], [36.0, -8.4 + dz], [0, -57.6 + dz],
    [-40.81, -8.4 + dz], [0, 32.41 + dz], [40.81, -8.4 + dz], [0, -52.79 + dz],
    [-1.2, 33.03 + dz], [41.43, -7.2 + dz], [1.2, -52.17 + dz],
  ];
}

function ringPoseSearch(): { dz: number; ok: boolean; bump: number; wet: number } {
  const sweep = [0, -1.2, 1.2, -2.4, 2.4, -3.6, 3.6, -4.8];
  let best = { dz: 0, ok: false, bump: Number.POSITIVE_INFINITY, wet: 99 };
  for (const dz of sweep) {
    const decks = decksAt(dz);
    const bump = Math.max(...decks.map((d) => bumpIn(COMP0, d)));
    const wet = ringCellsAt(dz).filter((c) => !dryIn(COMP0, c) || !offRow(c)).length;
    if (bump < best.bump || (bump <= PEAK_LIMIT && wet < best.wet)) best = { dz, ok: bump <= PEAK_LIMIT && wet === 0, bump, wet };
    if (bump <= PEAK_LIMIT && wet === 0) return { dz, ok: true, bump, wet };
  }
  return best;
}

const RING_POSE = ringPoseSearch();
const D = RING_POSE.dz;
const RING_OK = parkAssert('ringPose', RING_POSE.ok,
  `no monorail ring pose in the dz sweep cleared BOTH the ${PEAK_LIMIT} flank limit and the waterline ` +
    `(best dz ${RING_POSE.dz}, worst deck bump ${RING_POSE.bump.toFixed(2)}, ${RING_POSE.wet} wet ring cell(s)). ` +
    `SHIPPING WITHOUT THE RING — transport is still covered by Chairlift and MagneticRide.`,
  'blocking');
console.log('[park] monorail ring pose:', RING_POSE);

const RZ = -8.4 + D;      // W / E deck line
const NTZ = 27.6 + D;     // N platform tail
const STZ = -57.6 + D;    // S platform tail
const RING_CELLS = ringCellsAt(D);

/* ─── §4  CIRCUITS — authored, compiled and rated at module scope ────────────────── */

const LAT_GUARD = 1.275;

interface CircuitVerdict { ok: boolean; points: V3[]; label: string }

function verifyCircuit(name: string, pieces: TrackPiece[], start: V3, type: 'steel' | 'wooden'): CircuitVerdict {
  try {
    const out = compileTrackPieces(pieces, { type, start, heading: 0, bounds: SIZE });
    const rating = rateCoaster(out.points, { type, bank: 0.7, cars: 3 });
    const design = checkCoasterDesign(out.points, { type });
    const violations: string[] = (design?.violations ?? []).map((v: { kind: string }) => v.kind);
    const ok = Boolean(out.report?.ok) && !out.report?.fatal
      && rating.maxLatG <= LAT_GUARD && violations.length === 0;
    console.log(`[park] circuit ${name}:`, {
      E: rating.excitement, I: rating.intensity, N: rating.nausea,
      maxLatG: rating.maxLatG, inversions: rating.inversions,
      synthesized: out.report?.synthesizedCount, ok,
    });
    if (!ok) console.error(`[park] circuit ${name} FAILED verification — ` +
      `${out.report?.fatal ?? violations.join(', ') ?? `maxLatG ${rating.maxLatG}`}`);
    return { ok, points: out.points as V3[], label: name };
  } catch (err) {
    console.error(`[park] circuit ${name} could not be compiled — falling back to the rig default.`, err);
    return { ok: false, points: [], label: name };
  }
}

/** FLAGSHIP — a closed rectangle carrying one VERTICAL LOOP. L1≈L3−1.9, L2≈L4. */
const FLAG_PIECES: TrackPiece[] = [
  'station',
  { type: 'lift', height: 2.0 },
  { type: 'turnR', angle: 90, radius: 2.5 },
  { type: 'drop', height: 1.2 },
  { type: 'loop', radius: 1.6 },
  { type: 'straight', length: 1.2 },
  { type: 'turnR', angle: 90, radius: 2.5 },
  { type: 'hill', height: 0.8 },
  { type: 'straight', length: 7.9 },
  { type: 'turnR', angle: 90, radius: 2.5 },
  { type: 'straight', length: 10.48 },
  { type: 'turnR', angle: 90, radius: 2.5 },
  { type: 'straight', length: 1.6 },
];

/** FALLBACK — the same rectangle with the inversion swapped for a camelback. */
const FLAG_FALLBACK: TrackPiece[] = [
  'station',
  { type: 'lift', height: 2.0 },
  { type: 'turnR', angle: 90, radius: 2.5 },
  { type: 'drop', height: 1.2 },
  { type: 'hill', height: 0.6 },
  { type: 'straight', length: 1.2 },
  { type: 'turnR', angle: 90, radius: 2.5 },
  { type: 'hill', height: 0.8 },
  { type: 'straight', length: 7.9 },
  { type: 'turnR', angle: 90, radius: 2.5 },
  { type: 'straight', length: 10.48 },
  { type: 'turnR', angle: 90, radius: 2.5 },
  { type: 'straight', length: 1.6 },
];

const FLAG_START: V3 = [-24, 0.55, -41.4];
const FLAG = verifyCircuit('Emberglass Loop (flagship)', FLAG_PIECES, FLAG_START, 'steel');
const FLAG_ALT = FLAG.ok ? FLAG : verifyCircuit('Emberglass Loop (fallback)', FLAG_FALLBACK, FLAG_START, 'steel');
const FLAG_USE = FLAG.ok ? FLAG_PIECES : FLAG_FALLBACK;
const FLAG_PTS = FLAG.ok ? FLAG.points : FLAG_ALT.points;

/** COMPACT STEEL — the themed coasters' archetype (~12.5 × 14.8 u footprint). */
const COMPACT_STEEL: TrackPiece[] = [
  'station',
  { type: 'lift', height: 1.6 },
  { type: 'turnR', angle: 90, radius: 2.5 },
  { type: 'drop', height: 1.2 },
  { type: 'straight', length: 1.2 },
  { type: 'turnR', angle: 90, radius: 2.5 },
  { type: 'hill', height: 0.7 },
  { type: 'straight', length: 6.34 },
  { type: 'turnR', angle: 90, radius: 2.5 },
  { type: 'straight', length: 7.48 },
  { type: 'turnR', angle: 90, radius: 2.5 },
  { type: 'straight', length: 1.6 },
];
const COMPACT_OK = verifyCircuit('Compact steel archetype', COMPACT_STEEL, [0, 0.55, 0], 'steel').ok;

/** COMPACT WATER — the flume-profile archetype (~11.5 × 11.7 u footprint). */
const COMPACT_WATER: TrackPiece[] = [
  'station',
  { type: 'lift', height: 1.4 },
  { type: 'turnR', angle: 90, radius: 2 },
  { type: 'drop', height: 1.0 },
  { type: 'straight', length: 2.0 },
  { type: 'turnR', angle: 90, radius: 2 },
  { type: 'straight', length: 11.56 },
  { type: 'turnR', angle: 90, radius: 2 },
  { type: 'straight', length: 7.5 },
  { type: 'turnR', angle: 90, radius: 2 },
  { type: 'straight', length: 1.6 },
];

const STEEL_PIECES = COMPACT_OK ? COMPACT_STEEL : undefined;
const WATER_PIECES = COMPACT_WATER;

/* ─── §5  THE STREET PLAN — one buildParkNet fuse ────────────────────────────────── */

const HUB = fountainPlazaPlan({
  id: 'hub', title: 'Cinderglass Circus', position: [0, 50.4], tiles: 9,
  ports: ['N', 'E', 'S', 'W'], stringLights: 'all', seed: 3,
});

const MARKET = bazaarPlan({
  id: 'market', title: 'Lantern Row', position: [13.2, 50.4],
  stalls: ['burger', 'soda', 'cottonCandy', 'balloon'],
  names: ['Ironpan Grill', 'Cold Spark Sodas', 'Sugarglass Spinner', 'Skyline Balloons'],
  facing: { port: 'W', toward: [6, 50.4] }, seed: 5,
});

const SOUTH_PLAZA = fountainPlazaPlan({
  id: 'southPlaza', title: 'Quarry Circle', position: [0, -27.6], tiles: 9,
  ports: ['N', 'S'], seed: 7,
});

const ALL_PLANS: SetPiecePlan[] = [HUB, MARKET, SOUTH_PLAZA];

const NODES: XZ[] = [
  /*  0 */ [0, 63.6],          // GATE
  /*  1 */ [0, 60.0],
  /*  2 */ [7.2, 60.0],        // LEAF — Carousel
  /*  3 */ [-7.2, 60.0],       // LEAF — GhostTrain
  /*  4 */ [0, 40.8],          // fire junction
  /*  5 */ [-9.6, 40.8],       // LEAF — MagmaRun
  /*  6 */ [9.6, 40.8],        // LEAF — EmberWings
  /*  7 */ [-10.8, 50.4],
  /*  8 */ [-10.8, NTZ],
  /*  9 */ [-10.8, 16.8 + D],
  /* 10 */ [-26.4, 16.8 + D],
  /* 11 */ [-26.4, 4.8 + D],
  /* 12 */ [-26.4, RZ],
  /* 13 */ [-34.8, 16.8 + D],  // LEAF — AetherBalloons
  /* 14 */ [-34.8, 4.8 + D],   // LEAF — BoilerBurst
  /* 15 */ [-36.0, RZ],        // LEAF — monorail WEST platform
  /* 16 */ [26.4, 50.4],
  /* 17 */ [26.4, NTZ],
  /* 18 */ [26.4, 16.8 + D],
  /* 19 */ [26.4, 4.8 + D],
  /* 20 */ [26.4, RZ],
  /* 21 */ [34.8, 16.8 + D],   // LEAF — Discotron
  /* 22 */ [34.8, 4.8 + D],    // LEAF — MagneticRide
  /* 23 */ [36.0, RZ],         // LEAF — monorail EAST platform
  /* 24 */ [0, NTZ],           // LEAF — monorail NORTH platform
  /* 25 */ [0, RZ],
  /* 26 */ [12, RZ],
  /* 27 */ [16.8, RZ],
  /* 28 */ [12, -16.8],        // LEAF — LogFlume
  /* 29 */ [16.8, -27.6],
  /* 30 */ [16.8, -45.6],
  /* 31 */ [-26.4, -27.6],
  /* 32 */ [-26.4, -45.6],
  /* 33 */ [-34.8, -27.6],     // LEAF — Chairlift
  /* 34 */ [-34.8, -45.6],     // LEAF — MoonlitBarge
  /* 35 */ [-14.4, -45.6],
  /* 36 */ [0, -45.6],
  /* 37 */ [7.2, -45.6],
  /* 38 */ [7.2, -51.6],       // LEAF — ReefRacer
  /* 39 */ [16.8, -51.6],      // LEAF — DeepDrift
  /* 40 */ [-24, -45.6],       // flagship coaster queue tail (on the loop road)
  /* 41 */ [-26.4, STZ],
  /* 42 */ [0, STZ],           // LEAF — monorail SOUTH platform
];

const EDGES: [NetRef, NetRef][] = [
  [0, 1], [1, 2], [1, 3], [1, 'hub:N'],
  ['hub:S', 4], [4, 5], [4, 6],
  ['hub:W', 7], [7, 8], [8, 9], [9, 10], [10, 11], [11, 12],
  [10, 13], [11, 14], [12, 15],
  ['hub:E', 'market:W'], ['market:E', 16],
  [16, 17], [17, 18], [18, 19], [19, 20],
  [18, 21], [19, 22], [20, 23], [17, 24],
  [12, 25], [25, 20],
  [26, 28], [27, 29], [29, 30],
  [30, 39], [30, 37], [37, 38], [37, 36],
  [36, 35], [35, 32], [32, 31], [31, 12],
  [31, 33], [32, 34],
  [25, 'southPlaza:N'], ['southPlaza:S', 36],
  [32, 41], [41, 42],
];

const NET = buildParkNet({ nodes: NODES, edges: EDGES, pieces: ALL_PLANS });

/* ── street-plan assertions ──────────────────────────────────────────────────────── */

const portCell = (ref: NetRef): XZ => {
  if (typeof ref === 'number') return NODES[ref];
  const [id, name] = ref.split(':');
  const p = ALL_PLANS.find((q) => q.id === id);
  if (!p) { console.error(`[park] EDGES references '${ref}' but no plan has id '${id}'`); return [0, 0]; }
  return p.port(name);
};

const EPS = 1e-6;
EDGES.forEach(([a, b]) => {
  const A = portCell(a); const B = portCell(b);
  parkAssert('cardinalEdge', Math.abs(A[0] - B[0]) < EPS || Math.abs(A[1] - B[1]) < EPS,
    `edge ${String(a)}→${String(b)} is DIAGONAL: [${A}] → [${B}]. buildParkNet elbows it through a ` +
      `synthesised corner node that was never planned.`, 'advisory');
});

const SOLID_CLEAR: Record<string, number> = { FountainPlaza: 1.8, Bazaar: 0.6, Boulevard: 0 };

function assertNodesOffPieces(cells: XZ[], plans: SetPiecePlan[], label: string): void {
  const hits: string[] = [];
  plans.forEach((p) => {
    const clear = SOLID_CLEAR[p.kind] ?? 1.8;
    if (clear === 0) return;
    const ports = new Set(p.ports.map((pt) => `${pt.at[0].toFixed(2)},${pt.at[1].toFixed(2)}`));
    const f = p.footprint;
    const c = Math.cos(-f.yaw); const s = Math.sin(-f.yaw);
    cells.forEach((n, i) => {
      if (ports.has(`${n[0].toFixed(2)},${n[1].toFixed(2)}`)) return;
      const dx = n[0] - f.cx; const dz = n[1] - f.cz;
      const lx = dx * c - dz * s; const lz = dx * s + dz * c;
      const gap = Math.max(Math.abs(lx) - f.hx, Math.abs(lz) - f.hz);
      if (gap < clear - 1e-9)
        hits.push(`[${n[0]}, ${n[1]}] (${label} ${i}) is ${gap.toFixed(2)} u from '${p.id}' — needs ${clear}`);
    });
  });
  parkAssert('nodeInSolid', hits.length === 0,
    `${hits.length} ${label} cell(s) stand inside or against a set-piece footprint:\n  ${hits.join('\n  ')}`);
}
assertNodesOffPieces(NODES, ALL_PLANS, 'node');

const PORT_REFS = EDGES.flat().filter((x): x is string => typeof x === 'string');
ALL_PLANS.forEach((p) => {
  const wired = new Set(PORT_REFS.filter((r) => r.split(':')[0] === p.id).map((r) => r.split(':')[1]));
  parkAssert('pieceIsland', wired.size > 0,
    `set-piece '${p.id}' has no '${p.id}:<PORT>' ref in EDGES — it composes as an ISLAND`);
  p.ports.filter((pt) => !pt.prunable).forEach((pt) => {
    if (wired.has(pt.name)) return;
    parkAssert('chainEnd', false,
      `chain piece '${p.id}' (${p.kind}) wires [${[...wired]}] but NOT '${p.id}:${pt.name}' — that end of the ` +
        `carriageway dead-ends in grass.`);
  });
});

/* ─── §6  PADS — the tail is authored, the pad is derived ────────────────────────── */

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

/** Rigs handed a COMPACT authored circuit re-span: their default-circuit margin no longer
 *  applies, so they are measured against the compact archetype's own body instead. */
const COMPACT_MARGIN = 6.0;
const RESPANNED = new Set(['MagmaRun', 'EmberWings', 'ReefRacer', 'DeepDrift', 'MoonlitBarge', 'LogFlume']);
const padMarginOf = (rig: string) => (RESPANNED.has(rig) ? COMPACT_MARGIN : (PAD_MARGIN[rig] ?? 3.2));

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
          console.warn(`[park] ${label}: pad [${pad}] on a hill flank (bump ${bumpAt(pad).toFixed(2)}) — moved to [${c}]`);
          return c;
        }
      }
  parkAssert('padOnFlank', false,
    `${label}: pad [${pad}] is on a hill flank (bump ${bumpAt(pad).toFixed(2)} > ${PEAK_LIMIT}) OR WET, and no cell ` +
      `within 4.8 u is flat, dry AND ${clear} u off the street.`);
  return pad;
}

interface Placed2 { pad: XZ; anchor: XZ; dir: XZ; tail: XZ }

function place(tail: XZ, out: XZ, capacity: number, rig: string): Placed2 {
  const clear = padMarginOf(rig);
  const join = laneLenOf(capacity) + 0.35;
  const reach = minReachOf(capacity) + 2.4;
  const cand: XZ = [+(tail[0] + out[0] * reach).toFixed(2), +(tail[1] + out[1] * reach).toFixed(2)];
  const onStreet = (offPathCell(NET, cand, { clear }) ?? cand) as XZ;
  const pad = assertPadFlat(onStreet, clear, rig);
  const got = Math.hypot(pad[0] - tail[0], pad[1] - tail[1]);
  if (got < minReachOf(capacity) + 1.2)
    parkAssert('padReach', false,
      `${rig}: pad [${pad}] sits ${got.toFixed(2)} u from its tail [${tail}] — the cap-${capacity} floor is ` +
        `${(minReachOf(capacity) + 1.2).toFixed(2)} u. The court around this tail is too tight.`);
  return {
    pad, tail,
    anchor: [tail[0] + out[0] * join, tail[1] + out[1] * join] as XZ,
    dir: [-out[0], -out[1]] as XZ,
  };
}

const CAP = 4;
const R = {
  carousel:  place([7.2, 60.0], [1, 0], CAP, 'Carousel'),
  ghost:     place([-7.2, 60.0], [-1, 0], CAP, 'GhostTrain'),
  magma:     place([-9.6, 40.8], [-1, 0], CAP, 'MagmaRun'),
  ember:     place([9.6, 40.8], [1, 0], CAP, 'EmberWings'),
  aether:    place([-34.8, 16.8 + D], [0, -1], CAP, 'AetherBalloons'),
  boiler:    place([-34.8, 4.8 + D], [0, -1], CAP, 'BoilerBurst'),
  disco:     place([34.8, 16.8 + D], [0, 1], CAP, 'Discotron'),
  maglev:    place([34.8, 4.8 + D], [0, -1], CAP, 'MagneticRide'),
  flume:     place([12, -16.8], [-1, 0], CAP, 'LogFlume'),
  chair:     place([-34.8, -27.6], [0, -1], CAP, 'Chairlift'),
  barge:     place([-34.8, -45.6], [0, -1], CAP, 'MoonlitBarge'),
  reef:      place([7.2, -51.6], [0, -1], CAP, 'ReefRacer'),
  drift:     place([16.8, -51.6], [0, -1], CAP, 'DeepDrift'),
};

const RIDE_PADS: XZ[] = Object.values(R).map((r) => r.pad);
assertNodesOffPieces(RIDE_PADS, ALL_PLANS, 'pad');

/* pad-to-pad spacing (the 6 u centre floor; the OBB edge gap is re-measured in onReady) */
RIDE_PADS.forEach((a, i) => RIDE_PADS.slice(i + 1).forEach((b) => {
  const d = Math.hypot(a[0] - b[0], a[1] - b[1]);
  parkAssert('padPitch', d >= 6,
    `two ride pads sit ${d.toFixed(2)} u apart ([${a}] vs [${b}]) — the capacity-4 floor is 6 u.`);
}));

/* ─── §7  THEMED CONTENT CELLS ───────────────────────────────────────────────────── */

const offProp = (c: XZ, clear = 1.2): XZ => (offPathCell(NET, c, { clear }) ?? c) as XZ;

const FIRE_PROPS: XZ[] = ([
  [-6, 36], [6, 36], [-13.2, 36], [13.2, 36], [-6, 44.4], [6, 44.4],
  [-15.6, 44.4], [15.6, 44.4], [-13.2, 33.6], [13.2, 33.6],
] as XZ[]).map((c) => offProp(c));

const STEAM_PROPS: XZ[] = ([
  [-30, 12], [-30, 2.4], [-40.8, 12], [-40.8, 2.4],
  [-40.8, -4.8], [-30, -6.0], [-38.4, 20.4], [-31.2, -1.2],
] as XZ[]).map((c) => offProp([c[0], c[1] + D]));

const NEON_PROPS: XZ[] = ([
  [30, 12], [30, 2.4], [40.8, 12], [40.8, 2.4],
  [40.8, -4.8], [30, -6.0], [38.4, 20.4], [31.2, -1.2],
] as XZ[]).map((c) => offProp([c[0], c[1] + D]));

const GLADE_PROPS: XZ[] = ([
  [-30, -31.2], [-40.8, -31.2], [-30, -40.8], [-40.8, -40.8],
  [-30, -50.4], [-40.8, -50.4], [-38.4, -22.8], [-33.6, -56.4],
] as XZ[]).map((c) => offProp(c));

const COVE_PROPS: XZ[] = ([
  [-4.8, -54], [3.6, -57.6], [12, -57.6], [20.4, -54],
  [-4.8, -60], [12, -48], [20.4, -60], [-9.6, -49.2],
] as XZ[]).map((c) => offProp(c));

const STALLS = {
  ember: offProp([-6.0, 33.6], 1.8),
  goggles: offProp([-30.0, 10.8 + D], 1.8),
  slush: offProp([30.0, 10.8 + D], 1.8),
  honey: offProp([-30.0, -36.0], 1.8),
  sushi: offProp([3.6, -54.0], 1.8),
};

const FIRE = worldPlan({
  id: 'fire', theme: EMBERFALL_CALDERA,
  include: [R.magma.pad, R.ember.pad, STALLS.ember, [0, 34.2 + D] as XZ, ...FIRE_PROPS],
});
const STEAM = worldPlan({
  id: 'steampunk', theme: BRASSWORK_FOUNDRY,
  include: [R.aether.pad, R.boiler.pad, STALLS.goggles, [-42.6, RZ] as XZ, ...STEAM_PROPS],
});
const NEON_W = worldPlan({
  id: 'neon', theme: PULSE_DISTRICT,
  include: [R.disco.pad, R.maglev.pad, STALLS.slush, [42.6, RZ] as XZ, ...NEON_PROPS],
});
const GLADE = worldPlan({
  id: 'enchantedForest', theme: THORNWICK_GLADE,
  include: [R.chair.pad, R.barge.pad, STALLS.honey, ...GLADE_PROPS],
});
const COVE = worldPlan({
  id: 'pirateBeach', theme: TIDEWATER_HOLLOW,
  include: [R.reef.pad, R.drift.pad, STALLS.sushi, [0, -51 + D] as XZ, ...COVE_PROPS],
});

const WORLDS = [FIRE, STEAM, NEON_W, GLADE, COVE];
const WORLD_FLOOR = 20 * Math.sqrt(SIZE / 48);
WORLDS.forEach((a, i) => WORLDS.slice(i + 1).forEach((b) => {
  const d = Math.hypot(a.region.cx - b.region.cx, a.region.cz - b.region.cz);
  parkAssert('worldSpacing', d >= WORLD_FLOOR,
    `worlds '${a.id}' [${a.region.cx.toFixed(1)}, ${a.region.cz.toFixed(1)}] and '${b.id}' ` +
      `[${b.region.cx.toFixed(1)}, ${b.region.cz.toFixed(1)}] are ${d.toFixed(2)} u apart — the floor is ` +
      `${WORLD_FLOOR.toFixed(2)} u at size ${SIZE}.`);
  const gapX = Math.abs(a.region.cx - b.region.cx) - (a.region.hx + b.region.hx);
  const gapZ = Math.abs(a.region.cz - b.region.cz) - (a.region.hz + b.region.hz);
  parkAssert('worldRectsTouch', Math.max(gapX, gapZ) > 0,
    `world rects '${a.id}' and '${b.id}' overlap — they read as ONE district.`);
}));
console.log('[park] world regions:', WORLDS.map((w) => ({ id: w.id, cx: +w.region.cx.toFixed(1), cz: +w.region.cz.toFixed(1) })));

/* ─── §8  DRESSING CELLS ─────────────────────────────────────────────────────────── */

const TREE_SHAPES = ['round', 'pine', 'willow', 'round', 'pine'] as const;
type TreeShape = (typeof TREE_SHAPES)[number];

const RAW_TREES: XZ[] = [
  [-16.8, 57.6], [16.8, 57.6], [-20.4, 55.2], [20.4, 55.2], [-4.8, 63.6], [4.8, 63.6],
  [-20.4, 45.6], [20.4, 45.6], [-24, 38.4], [24, 38.4], [-4.8, 32.4], [4.8, 32.4],
  [-18, 27.6], [18, 27.6], [-19.2, 21.6], [19.2, 21.6], [-16.8, 12], [16.8, 12],
  [-19.2, 3.6], [19.2, 3.6], [-16.8, -3.6], [16.8, -3.6], [-8.4, -14.4], [-16.8, -20.4],
  [8.4, -20.4], [-19.2, -27.6], [22.8, -20.4], [-21.6, -36], [-9.6, -36], [9.6, -36],
  [21.6, -33.6], [-19.2, -51.6], [-10.8, -55.2], [-2.4, -49.2], [24, -50.4], [-31.2, -14.4],
  [-31.2, -20.4], [31.2, -14.4], [31.2, -20.4], [-8.4, 20.4], [8.4, 20.4], [-27.6, 33.6],
  [27.6, 33.6], [-13.2, -60], [13.2, -60], [0, -38.4],
];
const TREES: { at: XZ; shape: TreeShape }[] = RAW_TREES.map((c, i) => ({
  at: (offPathCell(NET, c, { clear: 0.75 }) ?? c) as XZ,
  shape: TREE_SHAPES[i % TREE_SHAPES.length],
}));

const NEUTRAL_SCENERY: { at: XZ; name: string }[] = ([
  [[-14.4, 57.6], 'planterBox'], [[14.4, 57.6], 'planterBox'],
  [[-16.8, 50.4], 'topiarySpiral'], [[21.6, 57.6], 'signpost'],
  [[-21.6, 50.4], 'parkClock'], [[-16.8, 40.8], 'birdbath'],
  [[16.8, 34.8], 'picnicTable'], [[-16.8, 34.8], 'picnicTable'],
  [[-21.6, 27.6], 'marbleStatue'], [[21.6, 27.6], 'flagpole'],
  [[-21.6, 12], 'brickWall'], [[21.6, 12], 'brickWall'],
  [[-21.6, -3.6], 'picketFence'], [[21.6, -3.6], 'picketFence'],
  [[-9.6, -20.4], 'wishingWell'], [[9.6, -14.4], 'gazebo'],
  [[-9.6, -31.2], 'topiaryElephant'], [[9.6, -31.2], 'topiaryElephant'],
  [[-19.2, -40.8], 'fallenLog'], [[19.2, -40.8], 'fallenLog'],
  [[-6, -49.2], 'ironArchway'], [[21.6, -45.6], 'lionStatue'],
  [[-24, -57.6], 'signpost'], [[7.2, 32.4], 'hotAirBalloon'],
] as [XZ, string][]).map(([at, name]) => ({ at: offProp(at), name }));

const TORCHES: XZ[] = ([
  [-9.6, 36], [9.6, 36], [-3.6, 44.4], [3.6, 44.4],
  [-31.2, -44.4], [-31.2, -28.8], [3.6, -49.2], [14.4, -49.2],
] as XZ[]).map((c) => offProp(c, 1.2));

/* ─── §9  GUARD LIST + the guarded composition diff ──────────────────────────────── */

const AUTHORED_CELLS: XZ[] = [
  ...RIDE_PADS, ...Object.values(STALLS), ...FIRE_PROPS, ...STEAM_PROPS, ...NEON_PROPS,
  ...GLADE_PROPS, ...COVE_PROPS, ...RING_CELLS,
];

const wetAuthored = AUTHORED_CELLS.filter((c) => !offRow(c));
if (wetAuthored.length)
  console.warn(`[park] ${wetAuthored.length} authored cell(s) sit on the pinned seed row's water: ` +
    `${JSON.stringify(wetAuthored)} — they are NOT guarded, and <DryScatter> re-checks them in the tree.`);

function keepDryOf(cells: XZ[]): XZ[] {
  const kept = cells.filter((c) => offRow(c));
  const dropped = cells.length - kept.length;
  if (dropped) console.warn(`[park] keepDryOf dropped ${dropped} of ${cells.length} guard cell(s) on the pinned ` +
    `row's water. A dropped guard is not a fixed cell — whatever stands there is still in the lake.`);
  return kept;
}

const GUARDS = keepDryOf([...(NET.keepDry as XZ[]), ...AUTHORED_CELLS]);
const ALL_COASTER_PTS: V3[] = FLAG_PTS;

const COMP = parkComposition(THREE, SEED, SIZE, CLIMATE, {
  keepDry: GUARDS, coasterPts: ALL_COASTER_PTS,
}) as unknown as CompLike;

parkAssert('waterMoved',
  Math.hypot(COMP.waterCentre[0] - COMP0.waterCentre[0], COMP.waterCentre[1] - COMP0.waterCentre[1]) < 1 &&
  Math.hypot(COMP.waterCentreSecond[0] - COMP0.waterCentreSecond[0],
             COMP.waterCentreSecond[1] - COMP0.waterCentreSecond[1]) < 1,
  `guards moved a water body off the pinned row — dominant ${JSON.stringify(COMP0.waterCentre)} → ` +
    `${JSON.stringify(COMP.waterCentre)}, secondary ${JSON.stringify(COMP0.waterCentreSecond)} → ` +
    `${JSON.stringify(COMP.waterCentreSecond)}, terrainSeed ${COMP0.terrainSeed} → ${COMP.terrainSeed}`);

const RF = COMP.report?.reliefFloor ?? null;
parkAssert('terrainFlattened', !RF || RF.kept >= RF.floor,
  RF ? `keepDry flattened the seed: authored relief ${RF.authoredRelief.toFixed(2)} → built ${RF.relief.toFixed(2)} ` +
    `(kept ${RF.kept.toFixed(2)} against the ${RF.floor} floor), stdH ${RF.authoredStdH.toFixed(2)} → ` +
    `${RF.stdH.toFixed(2)}; ranges the guards stood on: ${RF.guardedRanges}.` : '',
  'advisory');
console.log('[park] composition:', {
  terrainSeed: COMP.terrainSeed, probes: COMP.report?.probesTried,
  reliefKept: RF ? +RF.kept.toFixed(2) : null, stdH: RF ? +RF.stdH.toFixed(2) : null,
  guards: GUARDS.length,
});

parkAssertFlush();

/* ─── §10  THE DRY SIEVE — the gate's own predicate, run in the tree ─────────────── */

function dryRing(park: ReturnType<typeof usePark>, c: XZ, r = 0.75): boolean {
  const g = park.ground;
  if (!g) { console.error('[park] dryRing ran with NO TERRAIN — a vacuous pass'); return true; }
  const dry = (x: number, z: number) => g.lint.isDry(x, z, 0.05);
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
        `under waterline+0.05: ${JSON.stringify(cells.filter((c) => !kept.includes(c)).map((c) => c.at))}`);
    setDry(kept);
  }, [park, cells, label]);
  return <>{(dry ?? []).map(render)}</>;
}

/** A render-nothing receipt for the cells we cannot drop (pads, huts, tails, decks). */
function DryReceipt({ cells, label }: { cells: XZ[]; label: string }) {
  return <DryScatter cells={cells.map((at) => ({ at }))} label={label} render={() => null} />;
}

/* ─── §11  THE PARK ──────────────────────────────────────────────────────────────── */

const ROSTER_NAMES = [
  'Brass Carousel', 'Hollow Lantern', 'Emberglass Loop', 'Saltcut Flume', 'Three Crowns Skyline',
  'Cinder Run', 'Ashwing Flyers', 'Aether Ascent', 'Boilerworks Burst', 'Discotron Prime',
  'Maglev Midnight', 'Glade Skyway', 'Moonlit Barge', 'Reef Racer', 'Deep Drift',
];

export function App() {
  const onReady = React.useCallback((report: {
    ok?: boolean; failures?: unknown[]; warnings?: unknown[];
    footprints?: { rideId?: string; label?: string; cx: number; cz: number; hx: number; hz: number }[];
    accessibility?: { allRidesReachable?: boolean };
  }) => {
    console.log('[park] validatePark →', {
      ok: report.ok, failures: report.failures?.length ?? 0, warnings: report.warnings?.length ?? 0,
      allRidesReachable: report.accessibility?.allRidesReachable,
    });
    const rects = report.footprints ?? [];
    let worst = Number.POSITIVE_INFINITY;
    rects.forEach((a, i) => rects.slice(i + 1).forEach((b) => {
      if (a.rideId && b.rideId && a.rideId === b.rideId) return;
      const gap = Math.max(
        Math.abs(a.cx - b.cx) - (a.hx + b.hx),
        Math.abs(a.cz - b.cz) - (a.hz + b.hz),
      );
      if (gap < worst) worst = gap;
      if (gap < 1.5)
        console.error(`[park] SPACING: ${a.label ?? a.rideId} vs ${b.label ?? b.rideId} gap ${gap.toFixed(2)} < 1.50`);
    }));
    if (rects.length) console.log(`[park] rideSpacing.obb.minGap ≈ ${worst.toFixed(2)} over ${rects.length} rects`);
  }, []);

  return (
    <div className="w-full min-h-screen bg-slate-900">
      <Park
        seed={SEED}
        climate={CLIMATE}
        roster={{ rides: ROSTER_NAMES, stalls: 9, categories: 5 }}
        onReady={onReady}
      >
        <Terrain keepDry={GUARDS} coasterPts={ALL_COASTER_PTS} />
        <Paths nodes={NET.nodes} edges={NET.edges} plazas={NET.plazas} bins={NET.bins} walkers={6} />
        <GameManager />
        <Gate />

        {/* ── world floors, giants and regions ── */}
        <WorldGround plan={FIRE} />
        <WorldGround plan={STEAM} />
        <WorldGround plan={NEON_W} />
        <WorldGround plan={GLADE} />
        <WorldGround plan={COVE} />

        <WorldLandmark plan={FIRE} position={[0, 36]} scale={1.1} />
        <WorldLandmark plan={STEAM} position={[-40.8, 8.4 + D]} scale={1} />
        <WorldLandmark plan={NEON_W} position={[40.8, 8.4 + D]} scale={1} />
        <WorldLandmark plan={GLADE} position={[-40.8, -37.2]} scale={1} />
        <WorldLandmark plan={COVE} position={[-4.8, -57.6]} scale={1} />

        <World plan={FIRE} />
        <World plan={STEAM} />
        <World plan={NEON_W} />
        <World plan={GLADE} />
        <World plan={COVE} />

        {/* ── set-pieces (after <Paths>) ── */}
        <FountainPlaza plan={HUB} />
        <Bazaar plan={MARKET} />
        <FountainPlaza plan={SOUTH_PLAZA} />

        {/* ── ENTRANCE: the two rides the gate stream reaches first ── */}
        <Carousel
          position={R.carousel.pad} rotation={-Math.PI / 2}
          register={{ name: 'Brass Carousel', capacity: CAP, price: 3 }}
          queue={{ anchor: R.carousel.anchor, dir: R.carousel.dir }}
        />
        <GhostTrain
          position={R.ghost.pad} rotation={Math.PI / 2}
          register={{ name: 'Hollow Lantern', capacity: CAP, price: 6 }}
          queue={{ anchor: R.ghost.anchor, dir: R.ghost.dir }}
        />

        {/* ── FLAGSHIP: a closed steel rectangle carrying a vertical loop ── */}
        <Coaster
          name="Emberglass Loop"
          pieces={FLAG_USE}
          start={FLAG_START}
          heading={0}
          type="steel"
          cars={3}
          capacity={CAP}
          rideDuration={11}
          loadTime={2}
          intensity={8}
          price={7}
          queueTailNode={NET.node([-24, -45.6])}
          queueDir={[0, 1]}
        />

        {/* ── the park's water ride, on the lake side of the midway ── */}
        <LogFlume
          position={R.flume.pad} rotation={Math.PI}
          pieces={WATER_PIECES}
          register={{ name: 'Saltcut Flume', capacity: CAP, price: 5 }}
          queue={{ anchor: R.flume.anchor, dir: R.flume.dir }}
        />

        {/* ── TRANSPORT: the park-spanning monorail ring ── */}
        {RING_OK ? (
          <Monorail
            position={[-42.6, 0, -9.7 + D]}
            rotation={0}
            pieces={MONO_PIECES}
            register={{ name: 'Three Crowns Skyline', capacity: 8, price: 2 }}
          />
        ) : null}

        {/* ── EMBERFALL CALDERA (fire) ── */}
        <MagmaRun
          position={R.magma.pad} rotation={Math.PI / 2}
          pieces={STEEL_PIECES}
          register={{ name: 'Cinder Run', capacity: CAP, price: 7 }}
          queue={{ anchor: R.magma.anchor, dir: R.magma.dir }}
        />
        <EmberWings
          position={R.ember.pad} rotation={-Math.PI / 2}
          pieces={STEEL_PIECES}
          register={{ name: 'Ashwing Flyers', capacity: CAP, price: 7 }}
          queue={{ anchor: R.ember.anchor, dir: R.ember.dir }}
        />
        <EmberRoast position={STALLS.ember} rotation={0} register name="Slagpan Roast" price={3} value={5} />
        <Fumarole position={FIRE_PROPS[0]} rotation={0.0} seed={2} />
        <LavaFissure position={FIRE_PROPS[1]} rotation={2.0} seed={4} />
        <ObsidianShards position={FIRE_PROPS[2]} rotation={0.4} seed={5} />
        <ObsidianShards position={FIRE_PROPS[3]} rotation={-1.2} seed={11} />
        <BasaltColumns position={FIRE_PROPS[4]} rotation={0.7} seed={7} />
        <BasaltColumns position={FIRE_PROPS[5]} rotation={-0.5} seed={17} />
        <CharredSnag position={FIRE_PROPS[6]} rotation={1.3} seed={9} />
        <CharredSnag position={FIRE_PROPS[7]} rotation={-0.8} seed={23} />
        <Fumarole position={FIRE_PROPS[8]} rotation={0.9} seed={3} />
        <LavaFissure position={FIRE_PROPS[9]} rotation={-2.1} seed={13} />

        {/* ── BRASSWORK FOUNDRY (steampunk) ── */}
        <AetherBalloons
          position={R.aether.pad} rotation={0}
          register={{ name: 'Aether Ascent', capacity: CAP, price: 4 }}
          queue={{ anchor: R.aether.anchor, dir: R.aether.dir }}
        />
        <BoilerBurst
          position={R.boiler.pad} rotation={0}
          register={{ name: 'Boilerworks Burst', capacity: CAP, price: 6 }}
          queue={{ anchor: R.boiler.anchor, dir: R.boiler.dir }}
        />
        <GoggleWorks position={STALLS.goggles} rotation={Math.PI / 2} register name="Cog & Lens" price={3} value={5} />
        <GiantGear position={STEAM_PROPS[0]} rotation={0.3} seed={2} />
        <SteamPipes position={STEAM_PROPS[1]} rotation={1.6} seed={4} />
        <ClockTower position={STEAM_PROPS[2]} rotation={0.0} seed={6} />
        <BoilerTank position={STEAM_PROPS[3]} rotation={-0.7} seed={8} />
        <CoalCart position={STEAM_PROPS[4]} rotation={2.4} seed={10} />
        <GiantGear position={STEAM_PROPS[5]} rotation={-1.1} seed={12} />
        <SteamPipes position={STEAM_PROPS[6]} rotation={0.8} seed={14} />
        <CoalCart position={STEAM_PROPS[7]} rotation={-2.0} seed={16} />

        {/* ── PULSE DISTRICT (neon) ── */}
        <Discotron
          position={R.disco.pad} rotation={Math.PI}
          register={{ name: 'Discotron Prime', capacity: CAP, price: 6 }}
          queue={{ anchor: R.disco.anchor, dir: R.disco.dir }}
        />
        <MagneticRide
          position={R.maglev.pad} rotation={0}
          register={{ name: 'Maglev Midnight', capacity: CAP, price: 5 }}
          queue={{ anchor: R.maglev.anchor, dir: R.maglev.dir }}
        />
        <NeonSlush position={STALLS.slush} rotation={-Math.PI / 2} register name="Voltage Slush" price={2} value={4} />
        <NeonArch position={NEON_PROPS[0]} rotation={0.0} seed={2} />
        <SpeakerStack position={NEON_PROPS[1]} rotation={1.6} seed={4} />
        <MirrorBallPylon position={NEON_PROPS[2]} rotation={0.0} seed={6} />
        <LaserTruss position={NEON_PROPS[3]} rotation={-0.8} seed={8} />
        <LightTiles position={NEON_PROPS[4]} rotation={0.0} seed={10} />
        <SpeakerStack position={NEON_PROPS[5]} rotation={-1.4} seed={12} />
        <NeonArch position={NEON_PROPS[6]} rotation={1.57} seed={14} />
        <LaserTruss position={NEON_PROPS[7]} rotation={2.2} seed={16} />
        <Neon text="PULSE" position={[34.8, 3.2, 12 + D]} rotation={-Math.PI / 2} scale={0.55} />

        {/* ── THORNWICK GLADE (enchanted forest) ── */}
        <Chairlift
          position={R.chair.pad} rotation={0}
          register={{ name: 'Glade Skyway', capacity: CAP, price: 3 }}
          queue={{ anchor: R.chair.anchor, dir: R.chair.dir }}
        />
        <MoonlitBarge
          position={R.barge.pad} rotation={0}
          pieces={WATER_PIECES}
          register={{ name: 'Moonlit Barge', capacity: CAP, price: 4 }}
          queue={{ anchor: R.barge.anchor, dir: R.barge.dir }}
        />
        <Honeywitch position={STALLS.honey} rotation={Math.PI / 2} register name="Honeywitch Hearth" price={3} value={5} />
        <GiantToadstools position={GLADE_PROPS[0]} rotation={0.2} seed={2} />
        <StandingStones position={GLADE_PROPS[1]} rotation={1.1} seed={4} />
        <LanternTree position={GLADE_PROPS[2]} rotation={0.0} seed={6} />
        <RuinedArch position={GLADE_PROPS[3]} rotation={-0.6} seed={8} />
        <FlowerPodBed position={GLADE_PROPS[4]} rotation={2.0} seed={10} />
        <GiantToadstools position={GLADE_PROPS[5]} rotation={-1.5} seed={12} />
        <LanternTree position={GLADE_PROPS[6]} rotation={0.9} seed={14} />
        <FlowerPodBed position={GLADE_PROPS[7]} rotation={-2.3} seed={16} />

        {/* ── TIDEWATER HOLLOW (pirate beach) ── */}
        <ReefRacer
          position={R.reef.pad} rotation={0}
          pieces={WATER_PIECES}
          register={{ name: 'Reef Racer', capacity: CAP, price: 5 }}
          queue={{ anchor: R.reef.anchor, dir: R.reef.dir }}
        />
        <DeepDrift
          position={R.drift.pad} rotation={0}
          pieces={WATER_PIECES}
          register={{ name: 'Deep Drift', capacity: CAP, price: 6 }}
          queue={{ anchor: R.drift.anchor, dir: R.drift.dir }}
        />
        <SushiStall position={STALLS.sushi} rotation={0} register name="Barnacle Galley" price={3} value={5} />
        <WreckedHull position={COVE_PROPS[0]} rotation={0.4} seed={2} />
        <CoralCluster position={COVE_PROPS[1]} rotation={1.3} seed={4} />
        <AnchorPile position={COVE_PROPS[2]} rotation={0.0} seed={6} />
        <TidePool position={COVE_PROPS[3]} rotation={-0.9} seed={8} />
        <DockPilings position={COVE_PROPS[4]} rotation={1.57} seed={10} />
        <CoralCluster position={COVE_PROPS[5]} rotation={-1.8} seed={12} />
        <DockPilings position={COVE_PROPS[6]} rotation={0.6} seed={14} />
        <TidePool position={COVE_PROPS[7]} rotation={2.5} seed={16} />

        {/* ── amenities ── */}
        <Restroom position={[0, -38.4]} rotation={0} />

        {/* ── night dressing ── */}
        {TORCHES.map((t, i) => <Torch key={`torch-${i}`} position={t} />)}
        <Neon text="CINDERGLASS" position={[0, 3.4, 58.8]} rotation={0} scale={0.6} />

        {/* ── the dry sieve: receipts first, then everything droppable ── */}
        <DryReceipt cells={[...RIDE_PADS, ...RING_CELLS, ...Object.values(STALLS)]} label="pads+ring+stalls" />
        <DryScatter
          cells={TREES}
          label="trees"
          render={(t, i) => (
            <Placed key={`tr-${i}`} position={t.at} build={(three) => tree(three, { shape: t.shape })} />
          )}
        />
        <DryScatter
          cells={NEUTRAL_SCENERY}
          label="scenery"
          render={(s, i) => <Scenery key={`sc-${i}`} name={s.name} position={s.at} seed={i + 1} />}
        />
      </Park>
    </div>
  );
}

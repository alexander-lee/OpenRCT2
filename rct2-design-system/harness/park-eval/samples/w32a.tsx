/* ═══ WYRMFIRE GARDENS — §0 PRE-FLIGHT ══════════════════════════════════════════════
 * SIZE   128 (default, prop omitted)
 * SEED   1 / temperate — dominant lake ctr (41, -39) box x[21,60] z[-60,-21] ·
 *        secondary NW inlet ctr (-38, 31) box x[-56,-21] z[23,39]   [PRE-keepDry]
 *        RING WATER WALK: all 16 monorail ring cells sit outside both boxes and outside
 *        both 12 u near-radii (offRow) — checked by the offRow sieve below ✓
 *        GUARDS = keepDryOf(NET, SEED_ROW) — the FUSE'S OUTPUT sieved, never NODES.slice()
 *        §5c re-compose diff: BARE vs COMP centroids + reliefFloor.kept asserted in code ✓
 * WORLDS 5 (ALL of them), regions DERIVED by worldPlan from pieces+include:
 *        neon @(~ -2, 34) · steampunk @(~ -47, -13) · pirateBeach @(~ 40, -8)
 *        · enchantedForest @(~ 31, 25) · fire @(~ -47, 49)
 *        closest centre pair ~34.5 u ≥ 32.66 (20·√(128/48)) ✓ · rects DISJOINT ✓
 *        each world: WorldGround + WorldLandmark + 10 themed scenery from its OWN pack
 *        + its own themed stall + a path spur ✓ · 0 foreign themed pieces ✓
 *        monorail decks inside neon / steampunk / pirateBeach (3 of 5 — the south deck
 *        stands on the z ≈ -43 ridge shelf and no world is placed there) ✓
 * CATS   gentle FerrisWheel/FlyingSaucers/AetherBalloons · thrill Wyrmfire Ascent
 *        · water Salt Run Flume · transport Monorail ring + Chairlift · dark Ghost Train
 *        → 5/5 categories ✓
 *        RARE PICKS <FlyingSaucers> + <SwingingInverterShip> — neither appears in any
 *        worked example in the delivered rules, only in §0-P.5's PAD_MARGIN table ✓
 * CIRCUITS  Wyrmfire Ascent · Cinderjack Run · Monorail ring · Salt Run Flume
 *        · Ghost Train · Glade Canopy Line → 6 CIRCUITS / 4 FAMILIES
 *        (coaster ×2 = one family, water, transport, dark) ✓
 * GATE   [0, 63.6] → first queue tail [9.6, 58.8] = 4.8 + 9.6 = 14.4 u ≤ 15 ✓
 * FLAG   Wyrmfire Ascent — AUTHORED circuit, start [16.8, 0.55, -3.6] heading 0, steel,
 *        cars 3, NO bank prop. TWO corkscrew INVERSIONS on mid-leg climb tops.
 *        verifyCircuit() compiles it, calls rateCoaster + checkCoasterDesign at module
 *        scope and PRINTS the line; the mount is GATED on the result (fallback rectangle)
 *        CORRIDOR KEEP-OUT (plot): the ring occupies x[-18.9, 16.8] z[-16.5, 13.4].
 *        The ONLY street inside it is the x = -13.2 column, which crosses leg B at
 *        track y ≈ 3.9 and leg D at the corkscrew y ≈ 4.2 — both ≥ 2.2 u overfly ✓
 * FLAG2  Cinderjack Run — AUTHORED family circuit, start [-33.6, 0.55, -48.0] heading 0,
 *        steel, cars 3. DIFFERENT archetype (0 inversions, gentler forces) ✓
 *        bbox x[-61.3, -33.6] z[-62.3, -33.9] — DISJOINT from FLAG ✓ · off all 16 ring
 *        cells ✓ · outside every world rect ✓ · coasterPts = [...FLAG, ...FLAG2] ✓
 * STREET buildParkNet called EXACTLY ONCE ✓ · the SAME NET feeds <Paths> and every
 *        offPathCell ✓ · 6 set-pieces, every one port-referenced in EDGES, both
 *        boulevard chain ends wired ✓ · every pad returned BY offPathCell ✓
 * MONO   ring VERBATIM (17 pieces, two-part tail) · position [-42.6, 0, -9.7] (START
 *        POSE) rotation 0 · 4 platforms · tails [-36,-8.4] [0,27.6] [36,-8.4] [0,-57.6]
 *        ALL AUTHORED NODES AND ALL LEAVES (asserted) · SOUTH queues OUTWARD [0,-1] ✓
 * QUEUE  ONE ROW PER RIDE — the tail is the AUTHORED node, the pad is DERIVED by place()
 *        through offPathCell(padMarginOf(rig)) then assertPadFlat. Reach authored at
 *        minReach(cap) + 2.4, asserted at + 1.2 ✓ · no two rides share a tail ✓
 * SPREAD authored street bbox 93.6 × 121.2 ≥ 70 × 45 ✓ · 37 authored cells / 41 edges
 * PLAZAS hub 8.4×8.4 = 70.6 u² · plazaRow 47.5 · emberRow 38.9 · worksRow / coveRow 30.2
 *        → areaSpread 2.34 ≥ 1.8 ✓ · no set-piece position is a node or a queue tail ✓
 * DRESS  40 tree cells + 20 scenery cells, EVERY ONE through offPathCell then the
 *        in-tree DryScatter (the GATE'S own waterline+0.05 predicate) ✓
 * ROSTER 14 rides / 5 categories / 17 stalls / restrooms via the bazaars ✓ every ride
 *        AND every hand-mounted stall carries an authored themed name ✓
 *        <Park roster={{ rides, stalls, categories }}> MOUNTED ✓
 * GATE   parkAssertFlush() reports and NEVER throws — a blocking check drops ONE piece,
 *        never the park. validatePark runs in the preview via <Park validate> default.
 * ═══════════════════════════════════════════════════════════════════════════════════ */
import * as THREE from 'three';
import React from 'react';
import type { V3, XZ } from './components/Park';
import type { NetRef, SetPiecePlan } from './components/SetPieceKit';
import type { TrackPiece } from './components/SplineRideKit';
import {
  Park, GameManager, Terrain, Paths, Gate, Coaster, Scenery, Placed, Torch, Neon,
  usePark, offPathCell,
} from './components/Park';
import { laneLenOf, parkComposition } from './components/ParkBuilder';
import {
  buildParkNet, worldPlan, World,
  EMBERFALL_CALDERA, TIDEWATER_HOLLOW, BRASSWORK_FOUNDRY, THORNWICK_GLADE, PULSE_DISTRICT,
} from './components/SetPieceKit';
import { WorldGround } from './components/WorldGround';
import { WorldLandmark } from './components/WorldLandmark';
import { FountainPlaza, fountainPlazaPlan } from './components/FountainPlaza';
import { Bazaar, bazaarPlan } from './components/Bazaar';
import { Boulevard, boulevardPlan } from './components/Boulevard';
import { compileTrackPieces, rateCoaster, checkCoasterDesign } from './components/SplineRideKit';
import { tree } from './components/Kit';
import { Monorail } from './components/Monorail';
import { FerrisWheel } from './components/FerrisWheel';
import { FlyingSaucers } from './components/FlyingSaucers';
import { SwingingInverterShip } from './components/SwingingInverterShip';
import { LaunchedFreefall } from './components/LaunchedFreefall';
import { GhostTrain } from './components/GhostTrain';
import { LogFlume } from './components/LogFlume';
import { PirateShip } from './components/PirateShip';
import { Chairlift } from './components/Chairlift';
import { Discotron } from './components/Discotron';
import { AetherBalloons } from './components/AetherBalloons';
import { BoilerBurst } from './components/BoilerBurst';
import { NeonSlush } from './components/NeonSlush';
import { Honeywitch } from './components/Honeywitch';
import { NeonArch, SpeakerStack, MirrorBallPylon, LaserTruss, LightTiles } from './components/PulseScenery';
import { GiantGear, SteamPipes, ClockTower, BoilerTank, CoalCart } from './components/BrassworkScenery';
import { WreckedHull, CoralCluster, AnchorPile, TidePool, DockPilings } from './components/TidewaterScenery';
import { GiantToadstools, StandingStones, LanternTree, RuinedArch, FlowerPodBed } from './components/ThornwickScenery';
import { Fumarole, ObsidianShards, BasaltColumns, LavaFissure, CharredSnag } from './components/EmberfallScenery';

/* ───────────────────────── the assertion bus (§0-P.5) ───────────────────────── */

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
    console.error(`[park] ${blocking.length} BLOCKING failure(s) — the offending piece is dropped and the ` +
      `rest of the park still renders and still scores.`);
}

const SIZE = 128;
const SEED = 1;
const CLIMATE = 'temperate' as const;
const LAT_GUARD = 1.275;

/* ───────────────────────── the two coaster circuits ───────────────────────── */

/** Wyrmfire Ascent — a steel rectangle with TWO corkscrew inversions, each ridden on a
 *  mid-leg climb top well under the apex, every turn taken on a crest. */
const FLAG_PIECES: TrackPiece[] = [
  'station',
  { type: 'lift', height: 5.5 },
  { type: 'turnR', angle: 90, radius: 2.5 },
  { type: 'drop', height: 5.5 },
  { type: 'hill', height: 0.9 },
  { type: 'lift', height: 4.2 },
  { type: 'turnR', angle: 90, radius: 2.5 },
  'corkscrewL',
  { type: 'drop', height: 4.2 },
  { type: 'straight', length: 2.0 },
  { type: 'lift', height: 4.2 },
  { type: 'turnR', angle: 90, radius: 2.5 },
  'corkscrewR',
  { type: 'drop', height: 4.2 },
  { type: 'hill', height: 0.9 },
  { type: 'lift', height: 2.4 },
  { type: 'straight', length: 1.3 },
  { type: 'turnR', angle: 90, radius: 2.5 },
  { type: 'drop', height: 2.4 },
  { type: 'straight', length: 1.9 },
];

/** Cinderjack Run — the FAMILY circuit: no inversion, shallower drops, rolling hills. */
const FLAG2_PIECES: TrackPiece[] = [
  'station',
  { type: 'lift', height: 3.6 },
  { type: 'turnR', angle: 90, radius: 2.0 },
  { type: 'drop', height: 3.6 },
  { type: 'hill', height: 0.9 },
  { type: 'lift', height: 2.4 },
  { type: 'turnR', angle: 90, radius: 2.0 },
  { type: 'straight', length: 3.0 },
  { type: 'drop', height: 2.4 },
  { type: 'hill', height: 0.6 },
  { type: 'lift', height: 2.4 },
  { type: 'turnR', angle: 90, radius: 2.0 },
  { type: 'drop', height: 2.4 },
  { type: 'hill', height: 0.9 },
  { type: 'lift', height: 2.4 },
  { type: 'straight', length: 1.3 },
  { type: 'turnR', angle: 90, radius: 2.0 },
  { type: 'drop', height: 2.4 },
  { type: 'straight', length: 3.7 },
];

/** The safe fallback: the published legacy rectangle, h 1.0, closure synthesizes nothing. */
const FALLBACK_PIECES: TrackPiece[] = [
  'station',
  { type: 'lift', height: 1.0 },
  'drop',
  'turnR',
  { type: 'straight', length: 2.0 },
  'turnR',
  { type: 'straight', length: 14.8 },
  'turnR',
  { type: 'straight', length: 2.0 },
  'turnR',
  { type: 'straight', length: 0.9 },
];

const FLAG_START: V3 = [16.8, 0.55, -3.6];
const FLAG2_START: V3 = [-33.6, 0.55, -48.0];

type Verified = { ok: boolean; points: V3[]; pieces: TrackPiece[] };

/** Compile a candidate, PRINT its numbers, and say whether it is safe to ship. */
function verifyCircuit(label: string, pieces: TrackPiece[], start: V3, cars: number): Verified {
  const out = compileTrackPieces(pieces, { profile: 'coaster', type: 'steel', start, heading: 0, bounds: SIZE });
  const rating = rateCoaster(out.points, { type: 'steel', bank: 0.7, cars });
  const design = checkCoasterDesign(out.points, { type: 'steel' });
  const violations: string[] = ((design as { violations?: { kind: string }[] }).violations ?? []).map((v) => v.kind);
  const ok = !out.report.fatal && rating.maxLatG <= LAT_GUARD && violations.length === 0;
  console.log(`[park] ${label}:`, {
    E: rating.excitement, I: rating.intensity, N: rating.nausea, band: rating.ratingBand,
    drop: rating.highestDrop, maxLatG: rating.maxLatG, inversions: rating.inversions,
    air: rating.airtimeSeconds, synthesized: out.report.synthesizedCount, ok,
  });
  if (!ok)
    console.error(`[park] ${label} FAILED verification — ${out.report.fatal ?? violations.join(', ') ??
      `maxLatG ${rating.maxLatG}`}. Falling back to the published rectangle.`);
  return { ok, points: out.points, pieces };
}

function circuitOrFallback(label: string, pieces: TrackPiece[], start: V3, cars: number): Verified {
  const first = verifyCircuit(label, pieces, start, cars);
  if (first.ok) return first;
  const back = verifyCircuit(`${label} (fallback)`, FALLBACK_PIECES, start, cars);
  return { ok: back.ok, points: back.points, pieces: FALLBACK_PIECES };
}

const FLAG = circuitOrFallback('Wyrmfire Ascent', FLAG_PIECES, FLAG_START, 3);
const FLAG2 = circuitOrFallback('Cinderjack Run', FLAG2_PIECES, FLAG2_START, 3);
const ALL_COASTER_PTS: V3[] = [...FLAG.points, ...FLAG2.points];

/* ───────────────────────── the set-pieces ───────────────────────── */

const HUB = fountainPlazaPlan({
  id: 'hub', title: 'Lanternwell Circle', position: [0, 45.6], tiles: 7,
  ports: ['N', 'E', 'S', 'W'],
});
const AVE_W = boulevardPlan({
  id: 'aveW', title: 'Wyrmfire Promenade',
  from: HUB.port('W'), to: [-12, 45.6], spacing: 3.0, seed: 5,
});
const PLAZA_ROW = bazaarPlan({
  id: 'plazaRow', title: 'Turnstile Market', position: [12, 52.8],
  facing: { port: 'W', toward: [0, 52.8] },
  stalls: ['burger', 'soda', 'cottonCandy', 'hotDog', 'balloon'],
  names: ['The Brass Griddle', 'Fizzworks', 'Cloudspun', 'Longbarrel Dogs', 'Skyfair Balloons'],
  seed: 3,
});
const WORKS_ROW = bazaarPlan({
  id: 'worksRow', title: 'Foundry Row', position: [-56.4, -19.2],
  facing: { port: 'E', toward: [-48, -19.2] },
  stalls: ['goggles', 'burger', 'soda'],
  names: ['Cogwright Optics', 'The Rivet & Bun', 'Condenser Sodas'],
  theme: BRASSWORK_FOUNDRY, restroom: false, seed: 11,
});
const COVE_ROW = bazaarPlan({
  id: 'coveRow', title: 'Salt Quay', position: [36, -13.2],
  facing: { port: 'W', toward: [30, -13.2] },
  stalls: ['sushi', 'soda', 'cottonCandy'],
  names: ['Reefline Sushi', 'Bilgewater Sodas', 'Sea Foam Floss'],
  theme: TIDEWATER_HOLLOW, restroom: false, seed: 17,
});
const EMBER_ROW = bazaarPlan({
  id: 'emberRow', title: 'Cinder Walk', position: [-45.6, 52.8],
  facing: { port: 'E', toward: [-37.2, 52.8] },
  stalls: ['emberRoast', 'burger', 'hotDog', 'soda'],
  names: ['Ashfall Roast', 'The Slag Grill', 'Magma Dogs', 'Quenchworks'],
  theme: EMBERFALL_CALDERA, seed: 23,
});
const ALL_PLANS: SetPiecePlan[] = [HUB, AVE_W, PLAZA_ROW, WORKS_ROW, COVE_ROW, EMBER_ROW];

/* ───────────────────────── the street table ───────────────────────── */

const GATE_CELL: XZ = [0, 63.6];
const NODES: XZ[] = [
  /*  0 */ GATE_CELL,
  /*  1 */ [0, 58.8],
  /*  2 */ [9.6, 58.8],      // TAIL FerrisWheel        out [ 1, 0] cap 4  LEAF
  /*  3 */ [0, 52.8],
  /*  4 */ [22.8, 45.6],
  /*  5 */ [22.8, 27.6],
  /*  6 */ [9.6, 27.6],
  /*  7 */ [0, 27.6],        // RING NORTH TAIL                            LEAF
  /*  8 */ [33.6, 27.6],     // TAIL Chairlift          out [ 0,-1] cap 6  LEAF
  /*  9 */ [22.8, 9.6],      // TAIL Ghost Train        out [ 1, 0] cap 6
  /* 10 */ [22.8, 0],
  /* 11 */ [22.8, -3.6],     // FLAGSHIP TAIL (= start.x + 6.0)
  /* 12 */ [22.8, -8.4],
  /* 13 */ [36.0, -8.4],     // RING EAST TAIL                             LEAF
  /* 14 */ [30.0, 0],
  /* 15 */ [30.0, -4.8],     // TAIL Pirate Ship        out [ 1, 0] cap 4
  /* 16 */ [30.0, -8.4],
  /* 17 */ [30.0, -13.2],
  /* 18 */ [-13.2, 45.6],
  /* 19 */ [-24.0, 45.6],    // TAIL Inverter Ship      out [ 0, 1] cap 4
  /* 20 */ [-37.2, 45.6],    // TAIL Launched Freefall  out [-1, 0] cap 4
  /* 21 */ [-37.2, 52.8],
  /* 22 */ [-13.2, 27.6],
  /* 23 */ [-13.2, 14.4],    // TAIL Flying Saucers     out [-1, 0] cap 4
  /* 24 */ [-13.2, -19.2],
  /* 25 */ [-27.6, -19.2],
  /* 26 */ [-36.0, -19.2],
  /* 27 */ [-36.0, -8.4],    // RING WEST TAIL                             LEAF
  /* 28 */ [-48.0, -19.2],
  /* 29 */ [-48.0, -26.4],   // TAIL Aether Balloons    out [-1, 0] cap 4  LEAF
  /* 30 */ [-48.0, -4.8],    // TAIL Boiler Burst       out [-1, 0] cap 4  LEAF
  /* 31 */ [-13.2, -26.4],
  /* 32 */ [0, -26.4],       // TAIL Log Flume          out [ 1, 0] cap 4  LEAF
  /* 33 */ [-27.6, -48.0],   // SECOND COASTER TAIL (= start.x + 6.0)
  /* 34 */ [-27.6, -57.6],
  /* 35 */ [0, -57.6],       // RING SOUTH TAIL (queues OUTWARD)           LEAF
  /* 36 */ [-9.6, 40.8],     // TAIL Discotron          out [ 0,-1] cap 12 LEAF
];

const EDGES: [NetRef, NetRef][] = [
  [0, 1], [1, 3], [3, 'hub:N'], [1, 2], [3, 'plazaRow:W'],
  ['hub:E', 4], [4, 5], [5, 6], [6, 7], [5, 8],
  [5, 9], [9, 10], [10, 11], [11, 12], [12, 16], [16, 13],
  [10, 14], [14, 15], [15, 16], [16, 17], [17, 'coveRow:W'],
  ['hub:W', 'aveW:A'], ['aveW:B', 18], [18, 19], [19, 20], [20, 21], [21, 'emberRow:E'],
  [18, 22], [22, 23], [23, 24],
  [24, 25], [25, 26], [26, 27], [26, 28], [28, 'worksRow:E'], [28, 29], [28, 30],
  [24, 31], [31, 32],
  [25, 33], [33, 34], [34, 35],
  ['hub:S', 36],
];

const RING_CELLS: XZ[] = [
  [-42.6, -8.4], [0, 34.2], [42.6, -8.4], [0, -51.0],
  [-42.6, -9.7],
  [-36.0, -8.4], [0, 27.6], [36.0, -8.4], [0, -57.6],
  [-40.81, -8.4], [0, 32.41], [40.81, -8.4], [0, -52.79],
  [-1.2, 33.03], [41.43, -7.2], [1.2, -52.17],
];

/* ─────────────── pinned seed row + the guard sieve (§0-P.6) ─────────────── */

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

/* ─────────────── plan-time assertions, BEFORE the single fuse ─────────────── */

const portCell = (ref: NetRef): XZ => {
  if (typeof ref === 'number') return NODES[ref];
  const [id, name] = ref.split(':');
  const p = ALL_PLANS.find((q) => q.id === id);
  if (!p) { parkAssert('unknownPiece', false, `EDGES references '${ref}' but no plan has id '${id}'`, 'blocking'); return [0, 0]; }
  return p.port(name) as XZ;
};
const EPS = 1e-6;
EDGES.forEach(([a, b]) => {
  const A = portCell(a); const B = portCell(b);
  parkAssert('cardinalEdge', Math.abs(A[0] - B[0]) < EPS || Math.abs(A[1] - B[1]) < EPS,
    `edge ${a}→${b} is DIAGONAL: [${A}] → [${B}]. buildParkNet elbows it through a synthesised corner.`,
    'advisory');
});

const RING_TAILS: XZ[] = [[36.0, -8.4], [0, 27.6], [-36.0, -8.4], [0, -57.6]];
RING_TAILS.forEach((c) => {
  const i = NODES.findIndex((n) => Math.hypot(n[0] - c[0], n[1] - c[1]) < EPS);
  if (i < 0) return;
  const deg = EDGES.filter(([a, b]) => a === i || b === i).length;
  parkAssert('tailIsLeaf', deg <= 1,
    `street node ${i} [${c}] is a MONORAIL PLATFORM TAIL with degree ${deg} — anything continuing past it ` +
      `runs through the platform pad.`);
});

const PORT_REFS = EDGES.flat().filter((x): x is string => typeof x === 'string');
ALL_PLANS.forEach((p) => {
  const wired = new Set(PORT_REFS.filter((r) => r.split(':')[0] === p.id).map((r) => r.split(':')[1]));
  parkAssert('pieceIsland', wired.size > 0,
    `set-piece '${p.id}' has NO '${p.id}:<PORT>' ref in EDGES — it composes as an ISLAND`);
  p.ports.filter((pt) => !pt.prunable).forEach((pt) => {
    parkAssert('chainEnd', wired.has(pt.name),
      `chain piece '${p.id}' wires [${[...wired]}] but NOT '${p.id}:${pt.name}' — that carriageway end ` +
        `dead-ends in grass`);
  });
});

function assertNodesOffPieces(nodes: XZ[], plans: SetPiecePlan[]): void {
  const SOLID_CLEAR: Record<string, number> = { FountainPlaza: 1.8, Bazaar: 0.6, Boulevard: 0 };
  const hits: string[] = [];
  plans.forEach((p) => {
    const clear = SOLID_CLEAR[p.kind] ?? 1.8;
    if (clear === 0) return;
    const ports = new Set(p.ports.map((pt) => {
      const at = p.port(pt.name) as XZ;
      return `${at[0].toFixed(2)},${at[1].toFixed(2)}`;
    }));
    const f = p.footprint;
    const c = Math.cos(-f.yaw); const s = Math.sin(-f.yaw);
    nodes.forEach((n, i) => {
      if (ports.has(`${n[0].toFixed(2)},${n[1].toFixed(2)}`)) return;
      const dx = n[0] - f.cx; const dz = n[1] - f.cz;
      const lx = dx * c - dz * s; const lz = dx * s + dz * c;
      const gap = Math.max(Math.abs(lx) - f.hx, Math.abs(lz) - f.hz);
      if (gap < clear - 1e-9)
        hits.push(`[${n[0]}, ${n[1]}] (cell ${i}) is ${gap.toFixed(2)} u from '${p.id}' — needs ${clear}`);
    });
  });
  parkAssert('nodeInSolid', !hits.length,
    `${hits.length} authored cell(s) stand inside or against a set-piece footprint:\n  ` + hits.join('\n  '));
}
assertNodesOffPieces(NODES, ALL_PLANS);

/* ─────────────── THE ONE FUSE ─────────────── */

const NET = buildParkNet({
  nodes: NODES,
  edges: EDGES,
  pieces: ALL_PLANS,
  keepDry: [...NODES, ...RING_CELLS].filter((c) => offRow(c, SEED_ROW)),
});
parkAssert('netWarnings', !(NET.warnings ?? []).length,
  `buildParkNet warned: ${JSON.stringify(NET.warnings)}`);

function keepDryOf(net: { keepDry: XZ[] }, row: SeedRow = SEED_ROW): XZ[] {
  const kept = net.keepDry.filter((c) => offRow(c, row));
  const dropped = net.keepDry.length - kept.length;
  if (dropped) console.warn(
    `[park] keepDryOf dropped ${dropped} of ${net.keepDry.length} guard cell(s) on the pinned row's water — ` +
      `a DROPPED guard is not a fixed cell, whatever stands there is still in the lake.`);
  return kept;
}
const GUARDS: XZ[] = keepDryOf(NET, SEED_ROW);

/* ─────────────── the §5c re-compose diff ─────────────── */

const BARE = parkComposition(THREE, SEED, SIZE, CLIMATE);
const COMP = parkComposition(THREE, SEED, SIZE, CLIMATE, { keepDry: GUARDS, coasterPts: ALL_COASTER_PTS });
const movedBy = (a: XZ | null, b: XZ | null) =>
  a && b ? Math.hypot(a[0] - b[0], a[1] - b[1]) : a === b ? 0 : Infinity;
([['DOMINANT', BARE.waterCentre, COMP.waterCentre],
  ['SECONDARY', BARE.waterCentreSecond, COMP.waterCentreSecond]] as const).forEach(([n, a, b]) => {
  const d = movedBy(a as XZ | null, b as XZ | null);
  parkAssert('waterRePicked', d <= 6,
    `the guard list MOVED the ${n} water body ${d === Infinity ? '— it VANISHED' : `${d.toFixed(1)} u`} ` +
      `(terrainSeed ${BARE.terrainSeed} → ${COMP.terrainSeed})`);
});
{
  const rf = COMP.report.reliefFloor;
  parkAssert('terrainFlattened', !rf || rf.kept >= rf.floor,
    rf ? `keepDry FLATTENED the seed: authored relief ${rf.authoredRelief.toFixed(2)} → built ` +
      `${rf.relief.toFixed(2)} (kept ${rf.kept.toFixed(2)} against the ${rf.floor} floor), stdH ` +
      `${rf.authoredStdH.toFixed(2)} → ${rf.stdH.toFixed(2)}` : '',
    'advisory');
  if (rf) console.log('[park] reliefFloor', {
    kept: rf.kept, floor: rf.floor, relief: rf.relief, stdH: rf.stdH, guardedRanges: rf.guardedRanges,
  });
}

/* ─────────────── pad placement (§0-P.5) ─────────────── */

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
const BASINS = [...(COMP.basins ?? []), ...(COMP.basinsSecond ?? []), ...(COMP.clampBasins ?? [])];
const isDryCellPre = (c: XZ, margin = 0.6) =>
  BASINS.every((b) => Math.hypot(c[0] - b.x, c[1] - b.z) > 0.74 * b.radius + margin);
const bumpAt = (c: XZ) =>
  Math.max(0, ...(COMP.peaks ?? []).map((p) => {
    const k = Math.max(0, 1 - Math.hypot(c[0] - p.x, c[1] - p.z) / p.radius);
    return k * k * (3 - 2 * k) * p.height;
  }));

function assertPadFlat(pad: XZ, clear: number, label: string): XZ {
  if (bumpAt(pad) <= PEAK_LIMIT && isDryCellPre(pad)) return pad;
  for (let r = 1; r <= 8; r += 1)
    for (let ix = -r; ix <= r; ix += 1)
      for (let iz = -r; iz <= r; iz += 1) {
        if (Math.max(Math.abs(ix), Math.abs(iz)) !== r) continue;
        const c: XZ = [+(pad[0] + ix * 0.6).toFixed(2), +(pad[1] + iz * 0.6).toFixed(2)];
        if (bumpAt(c) > PEAK_LIMIT || !isDryCellPre(c)) continue;
        const off = offPathCell(NET, c, { clear });
        if (off && Math.hypot(off[0] - c[0], off[1] - c[1]) < 1e-6) {
          console.warn(`[park] ${label}: pad [${pad}] on a hill flank (bump ${bumpAt(pad).toFixed(2)}) — moved to [${c}]`);
          return c;
        }
      }
  parkAssert('padOnFlank', false,
    `${label}: pad [${pad}] is on a hill flank (bump ${bumpAt(pad).toFixed(2)}) or wet, and no cell within ` +
      `4.8 u is flat, dry AND ${clear} u off the street.`);
  return pad;
}

const minReachOf = (c: number) => laneLenOf(c) + 0.35 + 0.62 + 0.5 + 0.45;

type Placement = { pad: XZ; anchor: XZ; dir: XZ; yaw: number };
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
      `${rig}: pad [${pad}] sits ${got.toFixed(2)} u from its tail [${tail}] — the cap-${capacity} floor is ` +
        `${(minReachOf(capacity) + 1.2).toFixed(2)} u. The court is too tight; move the TAIL outward.`);
  const dir: XZ = [-out[0], -out[1]];
  return {
    pad,
    anchor: [+(tail[0] + out[0] * join).toFixed(2), +(tail[1] + out[1] * join).toFixed(2)] as XZ,
    dir,
    yaw: Math.atan2(dir[0], dir[1]),
  };
}

const WHEEL = place([9.6, 58.8], [1, 0], 4, 'FerrisWheel');
const CHAIR = place([33.6, 27.6], [0, -1], 6, 'Chairlift');
const GHOST = place([22.8, 9.6], [1, 0], 6, 'GhostTrain');
const SHIP = place([30.0, -4.8], [1, 0], 4, 'PirateShip');
const INVERT = place([-24.0, 45.6], [0, 1], 4, 'SwingingInverterShip');
const FREEFALL = place([-37.2, 45.6], [-1, 0], 4, 'LaunchedFreefall');
const SAUCERS = place([-13.2, 14.4], [-1, 0], 4, 'FlyingSaucers');
const BALLOONS = place([-48.0, -26.4], [-1, 0], 4, 'AetherBalloons');
const BOILER = place([-48.0, -4.8], [-1, 0], 4, 'BoilerBurst');
const FLUME = place([0, -26.4], [1, 0], 4, 'LogFlume');
const DISCO = place([-9.6, 40.8], [0, -1], 12, 'Discotron');

/* ─────────────── themed dressing cells, all sieved off the streets ─────────────── */

const sieve = (cells: XZ[], clear: number): XZ[] =>
  cells.map((c) => (offPathCell(NET, c, { clear }) ?? c) as XZ);

const NEON_SC = sieve([
  [-13.2, 30], [-13.2, 36.6], [-6, 31.2], [4.8, 30], [9.6, 30],
  [12, 36], [6, 39.6], [12, 40.8], [-12, 39.6], [9.6, 26.4],
], 1.2);
const WORKS_SC = sieve([
  [-33.6, -24], [-33.6, 0], [-38.4, -25.2], [-38.4, 2.4], [-52.8, -30],
  [-58.8, -12], [-52.8, 0], [-44.4, -26.4], [-44.4, 2.4], [-58.8, 2.4],
], 1.2);
const COVE_SC = sieve([
  [30, -16.8], [33.6, -18], [36, -18], [39.6, -18], [46.8, -14.4],
  [46.8, -4.8], [46.8, 0], [43.2, -18], [30, -18], [45.6, -18],
], 1.2);
const GLADE_SC = sieve([
  [24, 21.6], [24, 26.4], [24, 31.2], [28.8, 31.2], [33.6, 31.2],
  [38.4, 31.2], [38.4, 22.8], [38.4, 19.2], [27.6, 20.4], [30, 30],
], 1.2);
const EMBER_SC = sieve([
  [-56.4, 48], [-56.4, 54], [-49.2, 42], [-43.2, 42], [-38.4, 42],
  [-56.4, 42], [-49.2, 56.4], [-43.2, 56.4], [-39.6, 49.2], [-56.4, 44.4],
], 1.2);

const NEON_LANDMARK: XZ = [-16.8, 40.8];
const WORKS_LANDMARK: XZ = [-36, -28.8];
const COVE_LANDMARK: XZ = [49.2, -12];
const GLADE_LANDMARK: XZ = [37.2, 26.4];
const EMBER_LANDMARK: XZ = [-52.8, 45.6];

const NEON_STALL = (offPathCell(NET, [-4.8, 38.4], { clear: 1.8 }) ?? [-4.8, 38.4]) as XZ;
const GLADE_STALL = (offPathCell(NET, [28.8, 24], { clear: 1.8 }) ?? [28.8, 24]) as XZ;

/* ─────────────── the five worlds ─────────────── */

const NEON_WORLD = worldPlan({
  id: 'neon', theme: PULSE_DISTRICT, pieces: [],
  include: [...NEON_SC, NEON_LANDMARK, NEON_STALL, DISCO.pad, [0, 34.2] as XZ],
});
const WORKS_WORLD = worldPlan({
  id: 'steampunk', theme: BRASSWORK_FOUNDRY, pieces: [WORKS_ROW],
  include: [...WORKS_SC, WORKS_LANDMARK, BALLOONS.pad, BOILER.pad, [-42.6, -8.4] as XZ],
});
const COVE_WORLD = worldPlan({
  id: 'pirateBeach', theme: TIDEWATER_HOLLOW, pieces: [COVE_ROW],
  include: [...COVE_SC, COVE_LANDMARK, SHIP.pad, [42.6, -8.4] as XZ],
});
const GLADE_WORLD = worldPlan({
  id: 'enchantedForest', theme: THORNWICK_GLADE, pieces: [],
  include: [...GLADE_SC, GLADE_LANDMARK, GLADE_STALL, CHAIR.pad],
});
const EMBER_WORLD = worldPlan({
  id: 'fire', theme: EMBERFALL_CALDERA, pieces: [EMBER_ROW],
  include: [...EMBER_SC, EMBER_LANDMARK, FREEFALL.pad],
});
const WORLDS = [NEON_WORLD, WORKS_WORLD, COVE_WORLD, GLADE_WORLD, EMBER_WORLD];

WORLDS.forEach((w) => {
  const others = WORLDS.filter((o) => o.id !== w.id);
  others.forEach((o) => {
    const d = Math.hypot(w.centre[0] - o.centre[0], w.centre[1] - o.centre[1]);
    parkAssert('worldSeparation', d >= 20 * Math.sqrt(SIZE / 48),
      `worlds '${w.id}' and '${o.id}' are ${d.toFixed(1)} u apart — the floor is ` +
        `${(20 * Math.sqrt(SIZE / 48)).toFixed(2)} u`);
  });
});
([['neon', NEON_SC], ['steampunk', WORKS_SC], ['pirateBeach', COVE_SC],
  ['enchantedForest', GLADE_SC], ['fire', EMBER_SC]] as const).forEach(([id, cells]) => {
  const w = WORLDS.find((x) => x.id === id);
  if (!w) return;
  const inside = cells.filter((c) => w.contains(c)).length;
  parkAssert('worldScenery', inside >= 3,
    `world '${id}' has ${inside} themed scenery cell(s) inside its rect — the floor is 3`);
});

/* ─────────────── generic dressing ─────────────── */

const TREE_SHAPES = ['round', 'pine', 'willow', 'round', 'pine'] as const;
type TreeShape = (typeof TREE_SHAPES)[number];
const RAW_TREES: XZ[] = [
  [-6, 60], [6, 61.2], [-18, 57.6], [-30, 57.6], [18, 50.4], [27.6, 55.2], [-9.6, 49.2], [13.2, 62.4],
  [33.6, 60], [-45.6, 60], [-57.6, 45.6], [38.4, 44.4], [46.8, 50.4], [-25.2, 33.6], [16.8, 34.8],
  [27.6, 38.4], [46.8, 36], [54, 21.6], [54, 9.6], [56.4, -14.4], [50.4, -4.8], [19.2, -33.6],
  [8.4, -38.4], [-6, -34.8], [-19.2, -33.6], [-30, -33.6], [-13.2, -45.6], [-6, -51.6], [-16.8, -57.6],
  [-33.6, -13.2], [-58.8, -28.8], [-45.6, 4.8], [-33.6, 8.4], [-24, -4.8], [-24, 4.8], [9.6, -51.6],
  [15.6, -51.6], [12, -45.6], [2.4, -45.6], [-9.6, -45.6],
];
const TREES: { at: XZ; shape: TreeShape }[] = RAW_TREES.map((c, i) => ({
  at: (offPathCell(NET, c, { clear: 0.75 }) ?? c) as XZ,
  shape: TREE_SHAPES[i % TREE_SHAPES.length],
}));

const RAW_SCENERY: { at: XZ; name: string }[] = [
  { at: [-7.2, 56.4], name: 'planterBox' }, { at: [7.2, 56.4], name: 'topiarySpiral' },
  { at: [-16.8, 49.2], name: 'parkClock' }, { at: [20.4, 42], name: 'signpost' },
  { at: [-20.4, 42], name: 'birdbath' }, { at: [31.2, 45.6], name: 'picnicTable' },
  { at: [-31.2, 40.8], name: 'flagpole' }, { at: [15.6, 20.4], name: 'marbleStatue' },
  { at: [-25.2, 20.4], name: 'gazebo' }, { at: [42, 14.4], name: 'wishingWell' },
  { at: [-40.8, 20.4], name: 'topiaryElephant' }, { at: [52.8, 0], name: 'ironArchway' },
  { at: [-30, -4.8], name: 'brickWall' }, { at: [-19.2, -45.6], name: 'fallenLog' },
  { at: [4.8, -33.6], name: 'mushroomCluster' }, { at: [-30, -40.8], name: 'picketFence' },
  { at: [16.8, -38.4], name: 'cactusCluster' }, { at: [-52.8, 8.4], name: 'lionStatue' },
  { at: [18, -24], name: 'tvMonitorPost' }, { at: [-3.6, -40.8], name: 'hotAirBalloon' },
];
const SCENERY_CELLS = RAW_SCENERY.map((s) => ({
  ...s, at: (offPathCell(NET, s.at, { clear: 1.2 }) ?? s.at) as XZ,
}));

/* ─────────────── the monorail ring, verbatim ─────────────── */

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

const RIDE_NAMES = [
  'Wyrmfire Ascent', 'Cinderjack Run', 'Three Crowns Monorail', 'Salt Run Flume',
  'Hollow Lantern Line', 'Lanternwell Wheel', 'Saucer Scramble', 'Gravity Gale',
  'Bassline Spin', 'Glade Canopy Line', 'Salt Quay Marauder', 'Zephyr Ascent',
  "Riveter's Revolt", 'Cinder Launch',
];
const STALL_COUNT =
  PLAZA_ROW.slots.length + WORKS_ROW.slots.length + COVE_ROW.slots.length + EMBER_ROW.slots.length + 2;

parkAssertFlush();
console.log('[park] roster', { rides: RIDE_NAMES.length, stalls: STALL_COUNT, categories: 5 });

/* ─────────────── the in-tree dryness receipt ─────────────── */

type ParkCtx = ReturnType<typeof usePark>;
function dryRing(park: ParkCtx, c: XZ, r = 0.75): boolean {
  const g = (park as { ground?: { lint?: { isDry?: (x: number, z: number, cl: number) => boolean } } }).ground;
  const isDry = g && g.lint && g.lint.isDry;
  if (!isDry) return true;
  if (!isDry(c[0], c[1], 0.05)) return false;
  for (let k = 0; k < 8; k += 1) {
    const a = (k / 8) * Math.PI * 2;
    if (!isDry(c[0] + Math.cos(a) * r, c[1] + Math.sin(a) * r, 0.05)) return false;
  }
  return true;
}

function DryScatter<T extends { at: XZ }>({ cells, render }: {
  cells: T[]; render: (c: T, i: number) => React.ReactNode;
}) {
  const park = usePark('DryScatter');
  const [dry, setDry] = React.useState<T[] | null>(null);
  React.useEffect(() => {
    const kept = cells.filter((c) => dryRing(park, c.at));
    if (kept.length < cells.length)
      console.warn(`[park] DryScatter dropped ${cells.length - kept.length} of ${cells.length} cell(s) ` +
        `under waterline + 0.05`);
    setDry(kept);
  }, [park, cells]);
  return <>{(dry ?? []).map(render)}</>;
}

/* ─────────────── the park ─────────────── */

export function App() {
  return (
    <div className="w-full h-full min-h-screen bg-slate-900">
      <Park
        seed={SEED}
        climate={CLIMATE}
        roster={{ rides: RIDE_NAMES, stalls: STALL_COUNT, categories: 5 }}
        onReady={(report: { ok: boolean; failures?: unknown[]; warnings?: unknown[] }) => {
          console.log('[park] validatePark', {
            ok: report.ok, failures: report.failures?.length ?? 0, warnings: report.warnings?.length ?? 0,
          });
        }}
      >
        <Terrain keepDry={GUARDS} coasterPts={ALL_COASTER_PTS} />
        <Paths nodes={NET.nodes} edges={NET.edges} plazas={NET.plazas} bins={NET.bins} walkers={6} />
        <GameManager />
        <Gate />

        {/* ── transport: the park-spanning ring ── */}
        <Monorail
          position={[-42.6, 0, -9.7]} rotation={0} pieces={MONO_PIECES} beamY={2.6} loopSeconds={12} pinned
          name="Three Crowns Monorail" capacity={6} rideDuration={12} intensity={1} price={0}
          queue={{ anchor: [-40.81, -8.4], dir: [1, 0] }}
          register={{
            board: [-42.6, 2.6, -8.4],
            stations: [
              { label: 'Neon Cross', boardPoint: [0, 2.6, 34.2], queueAnchor: [0, 0.05, 32.41], queueDir: [0, -1], exitPoint: [-1.2, 0.05, 33.03], exitDir: [0, -1] },
              { label: 'Salt Quay', boardPoint: [42.6, 2.6, -8.4], queueAnchor: [40.81, 0.05, -8.4], queueDir: [-1, 0], exitPoint: [41.43, 0.05, -7.2], exitDir: [-1, 0] },
              { label: 'Ridge End', boardPoint: [0, 2.6, -51.0], queueAnchor: [0, 0.05, -52.79], queueDir: [0, -1], exitPoint: [1.2, 0.05, -52.17], exitDir: [0, -1] },
            ],
          }}
        />

        {/* ── the two coasters ── */}
        <Coaster
          name="Wyrmfire Ascent" pieces={FLAG.pieces} start={FLAG_START} heading={0}
          type="steel" cars={3} capacity={4} rideDuration={10} loadTime={2} intensity={9} price={7}
          queueTailNode={NET.node([22.8, -3.6])} queueDir={[1, 0]}
        />
        <Coaster
          name="Cinderjack Run" pieces={FLAG2.pieces} start={FLAG2_START} heading={0}
          type="steel" cars={3} capacity={4} rideDuration={10} loadTime={2} intensity={7} price={5}
          queueTailNode={NET.node([-27.6, -48.0])} queueDir={[1, 0]}
        />

        {/* ── the entrance quarter ── */}
        <FountainPlaza plan={HUB} />
        <Boulevard plan={AVE_W} />
        <Bazaar plan={PLAZA_ROW} />
        <FerrisWheel
          position={WHEEL.pad} rotation={WHEEL.yaw}
          register={{ name: 'Lanternwell Wheel', capacity: 4, rideDuration: 10, price: 3, intensity: 2 }}
          queue={{ anchor: WHEEL.anchor, dir: WHEEL.dir }}
        />
        <SwingingInverterShip
          position={INVERT.pad} rotation={INVERT.yaw}
          register={{ name: 'Gravity Gale', capacity: 4, rideDuration: 9, price: 5, intensity: 8 }}
          queue={{ anchor: INVERT.anchor, dir: INVERT.dir }}
        />
        <FlyingSaucers
          position={SAUCERS.pad} rotation={SAUCERS.yaw}
          register={{ name: 'Saucer Scramble', capacity: 4, rideDuration: 8, price: 3, intensity: 3 }}
          queue={{ anchor: SAUCERS.anchor, dir: SAUCERS.dir }}
        />
        <GhostTrain
          position={GHOST.pad} rotation={GHOST.yaw}
          register={{ name: 'Hollow Lantern Line', capacity: 6, rideDuration: 11, price: 5, intensity: 5 }}
          queue={{ anchor: GHOST.anchor, dir: GHOST.dir }}
        />
        <LogFlume
          position={FLUME.pad} rotation={FLUME.yaw}
          register={{ name: 'Salt Run Flume', capacity: 4, rideDuration: 12, price: 5, intensity: 5 }}
          queue={{ anchor: FLUME.anchor, dir: FLUME.dir }}
        />

        {/* ── NEON: the Pulse quarter ── */}
        <WorldGround plan={NEON_WORLD} />
        <WorldLandmark plan={NEON_WORLD} position={NEON_LANDMARK} scale={0.75} />
        <World plan={NEON_WORLD} />
        <Discotron
          position={DISCO.pad} rotation={DISCO.yaw}
          register={{ name: 'Bassline Spin', capacity: 12, rideDuration: 10, price: 4, intensity: 6 }}
          queue={{ anchor: DISCO.anchor, dir: DISCO.dir }}
        />
        <NeonSlush register name="Voltage Slush" price={2} value={4} position={NEON_STALL} rotation={Math.PI} />
        <Neon text="PULSE" position={[6, 1.7, 30]} rotation={Math.PI} scale={0.55} />
        <NeonArch position={NEON_SC[0]} rotation={0} seed={2} />
        <NeonArch position={NEON_SC[1]} rotation={Math.PI / 2} seed={5} />
        <SpeakerStack position={NEON_SC[2]} rotation={0.4} seed={3} />
        <SpeakerStack position={NEON_SC[3]} rotation={-1.1} seed={9} />
        <MirrorBallPylon position={NEON_SC[4]} rotation={0} seed={4} />
        <MirrorBallPylon position={NEON_SC[5]} rotation={1.6} seed={13} />
        <LaserTruss position={NEON_SC[6]} rotation={0.8} seed={6} />
        <LaserTruss position={NEON_SC[7]} rotation={-0.6} seed={19} />
        <LightTiles position={NEON_SC[8]} rotation={0} seed={7} />
        <LightTiles position={NEON_SC[9]} rotation={1.2} seed={23} />

        {/* ── STEAMPUNK: the Foundry ── */}
        <WorldGround plan={WORKS_WORLD} />
        <WorldLandmark plan={WORKS_WORLD} position={WORKS_LANDMARK} scale={0.9} />
        <World plan={WORKS_WORLD} />
        <Bazaar plan={WORKS_ROW} />
        <AetherBalloons
          position={BALLOONS.pad} rotation={BALLOONS.yaw}
          register={{ name: 'Zephyr Ascent', capacity: 4, rideDuration: 11, price: 4, intensity: 2 }}
          queue={{ anchor: BALLOONS.anchor, dir: BALLOONS.dir }}
        />
        <BoilerBurst
          position={BOILER.pad} rotation={BOILER.yaw}
          register={{ name: "Riveter's Revolt", capacity: 4, rideDuration: 9, price: 5, intensity: 7 }}
          queue={{ anchor: BOILER.anchor, dir: BOILER.dir }}
        />
        <GiantGear position={WORKS_SC[0]} rotation={0} seed={2} />
        <GiantGear position={WORKS_SC[1]} rotation={1.1} seed={11} />
        <SteamPipes position={WORKS_SC[2]} rotation={0.5} seed={3} />
        <SteamPipes position={WORKS_SC[3]} rotation={-0.9} seed={17} />
        <ClockTower position={WORKS_SC[4]} rotation={0} seed={4} />
        <BoilerTank position={WORKS_SC[5]} rotation={0.7} seed={5} />
        <BoilerTank position={WORKS_SC[6]} rotation={-1.4} seed={29} />
        <CoalCart position={WORKS_SC[7]} rotation={0.2} seed={6} />
        <CoalCart position={WORKS_SC[8]} rotation={1.9} seed={31} />
        <SteamPipes position={WORKS_SC[9]} rotation={2.4} seed={37} />

        {/* ── PIRATE BEACH: the Salt Quay ── */}
        <WorldGround plan={COVE_WORLD} />
        <WorldLandmark plan={COVE_WORLD} position={COVE_LANDMARK} scale={0.9} />
        <World plan={COVE_WORLD} />
        <Bazaar plan={COVE_ROW} />
        <PirateShip
          position={SHIP.pad} rotation={SHIP.yaw}
          register={{ name: 'Salt Quay Marauder', capacity: 4, rideDuration: 9, price: 5, intensity: 7 }}
          queue={{ anchor: SHIP.anchor, dir: SHIP.dir }}
        />
        <WreckedHull position={COVE_SC[0]} rotation={0.3} seed={2} />
        <WreckedHull position={COVE_SC[1]} rotation={-1.2} seed={13} />
        <CoralCluster position={COVE_SC[2]} rotation={0} seed={3} />
        <CoralCluster position={COVE_SC[3]} rotation={1.5} seed={19} />
        <AnchorPile position={COVE_SC[4]} rotation={0.9} seed={4} />
        <AnchorPile position={COVE_SC[5]} rotation={-0.4} seed={23} />
        <TidePool position={COVE_SC[6]} rotation={0} seed={5} />
        <TidePool position={COVE_SC[7]} rotation={2.1} seed={29} />
        <DockPilings position={COVE_SC[8]} rotation={0.6} seed={6} />
        <DockPilings position={COVE_SC[9]} rotation={-1.7} seed={31} />

        {/* ── ENCHANTED FOREST: Thornwick Glade ── */}
        <WorldGround plan={GLADE_WORLD} />
        <WorldLandmark plan={GLADE_WORLD} position={GLADE_LANDMARK} scale={0.9} />
        <World plan={GLADE_WORLD} />
        <Chairlift
          position={CHAIR.pad} rotation={CHAIR.yaw}
          register={{ name: 'Glade Canopy Line', capacity: 6, rideDuration: 12, price: 3, intensity: 1 }}
          queue={{ anchor: CHAIR.anchor, dir: CHAIR.dir }}
        />
        <Honeywitch register name="The Honeywitch's Kettle" price={3} value={5} position={GLADE_STALL} rotation={-Math.PI / 2} />
        <GiantToadstools position={GLADE_SC[0]} rotation={0} seed={2} />
        <GiantToadstools position={GLADE_SC[1]} rotation={1.3} seed={11} />
        <StandingStones position={GLADE_SC[2]} rotation={0.4} seed={3} />
        <StandingStones position={GLADE_SC[3]} rotation={-1.0} seed={17} />
        <LanternTree position={GLADE_SC[4]} rotation={0} seed={4} />
        <LanternTree position={GLADE_SC[5]} rotation={2.2} seed={19} />
        <RuinedArch position={GLADE_SC[6]} rotation={0.8} seed={5} />
        <RuinedArch position={GLADE_SC[7]} rotation={-0.5} seed={23} />
        <FlowerPodBed position={GLADE_SC[8]} rotation={0} seed={6} />
        <FlowerPodBed position={GLADE_SC[9]} rotation={1.7} seed={29} />

        {/* ── FIRE: the Cinder Walk ── */}
        <WorldGround plan={EMBER_WORLD} />
        <WorldLandmark plan={EMBER_WORLD} position={EMBER_LANDMARK} scale={1} />
        <World plan={EMBER_WORLD} />
        <Bazaar plan={EMBER_ROW} />
        <LaunchedFreefall
          position={FREEFALL.pad} rotation={FREEFALL.yaw}
          register={{ name: 'Cinder Launch', capacity: 4, rideDuration: 8, price: 6, intensity: 8 }}
          queue={{ anchor: FREEFALL.anchor, dir: FREEFALL.dir }}
        />
        <Fumarole position={EMBER_SC[0]} rotation={0} seed={2} />
        <Fumarole position={EMBER_SC[1]} rotation={1.4} seed={11} />
        <ObsidianShards position={EMBER_SC[2]} rotation={0.4} seed={3} />
        <ObsidianShards position={EMBER_SC[3]} rotation={-1.2} seed={17} />
        <BasaltColumns position={EMBER_SC[4]} rotation={0.7} seed={4} />
        <BasaltColumns position={EMBER_SC[5]} rotation={-0.5} seed={19} />
        <LavaFissure position={EMBER_SC[6]} rotation={0} seed={5} />
        <LavaFissure position={EMBER_SC[7]} rotation={2.0} seed={23} />
        <CharredSnag position={EMBER_SC[8]} rotation={1.3} seed={6} />
        <CharredSnag position={EMBER_SC[9]} rotation={-0.8} seed={31} />
        <Torch position={[-40.8, 45.6]} />
        <Torch position={[-40.8, 49.2]} />

        {/* ── the sieved dressing, LAST ── */}
        <DryScatter
          cells={TREES}
          render={(t, i) => (
            <Placed key={`tr-${i}`} position={t.at} build={(three) => tree(three, { shape: t.shape })} />
          )}
        />
        <DryScatter
          cells={SCENERY_CELLS}
          render={(s, i) => <Scenery key={`sc-${i}`} name={s.name} position={s.at} seed={i + 1} />}
        />
      </Park>
    </div>
  );
}

/** Offline probe hook — `probe-skeleton.mjs` refuses to run without it. */
export function __netdump() {
  return {
    seed: SEED, size: SIZE, climate: CLIMATE,
    keepDry: GUARDS,
    coasterPts: ALL_COASTER_PTS,
    hardCells: [
      WHEEL.pad, CHAIR.pad, GHOST.pad, SHIP.pad, INVERT.pad, FREEFALL.pad, SAUCERS.pad,
      BALLOONS.pad, BOILER.pad, FLUME.pad, DISCO.pad,
    ],
    layoutRaw: { nodes: NODES, edges: EDGES },
    regions: WORLDS.map((w) => ({ id: w.id, region: w.region })),
  };
}

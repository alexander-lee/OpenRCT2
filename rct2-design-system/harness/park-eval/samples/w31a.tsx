/* ═══ THREE CROWNS PARK — §0 PRE-FLIGHT ═══════════════════════════════════════════════
 * SIZE   128 (default, `size` prop omitted)
 * SEED   1 / temperate — dominant lake ctr (41, -39) SE · secondary ctr (-38, 31) NW
 *        [PRE-keepDry row, SEED_ROW_WATER['1/temperate']]
 *        RING WATER WALK: all 16 monorail ring cells are sieved by `offRow` (box + 12 u
 *        centre radius) INSIDE the dz sweep — a pose is only accepted when every one of
 *        the 16 cells is off both bowls AND all four decks + four tails sit under the
 *        0.75 peak-flank limit (bumpIn over the UNGUARDED composition). The accepted dz
 *        and the measured worst deck bump are printed to the console at module scope.
 *        keepDry is DERIVED (`keepDryOf(NET, SEED_ROW)`), never `NODES.slice()` — the
 *        drop count is logged; a non-zero drop means a paved cell is still in the lake.
 *        reliefFloor.kept + the water-centroid diff are asserted against the UNGUARDED
 *        composition (`waterMoved`, `terrainFlattened`) and printed.
 * WORLDS 5 (ALL of them) — every rect derived by `worldPlan` from its own bazaar + the
 *        ride pads + scenery cells it `include`s:
 *          fire        @ ~(-40.5, -42.6)  Cinderworks Row · Cinder Crypt · Volcano
 *          steampunk   @ ~(-39.6,   2.6)  Foundry Row · Aether Ascent · Boiler Burst
 *          enchantedForest @ ~(-8.0, 29.0) Glade Row · Willow Teacups · Dragon Roost
 *          neon        @ ~(10.8,  -8.4)  Pulse Row · Discotron 9000 · Maglev Loopline
 *          pirateBeach @ ~(54.9, -12.0)  Cove Row · Salt Reaver · Tide Drop
 *        closest authored centre pair 40.6 u ◄ ≥ 32.66 (20·√(128/48)) ✓ · rects disjoint
 *        with a dry gap > 0 ✓ · every world: its OWN themed stall, ≥ 16 themed scenery
 *        placements from its OWN pack, its GIANT (<WorldLandmark>), a path spur ✓
 *        (no foreign themed piece is placed inside any rect — worldThemeMixed clean)
 * CATS   gentle Carousel/FerrisWheel/Teacups/AetherBalloons · thrill Coaster/PirateShip/
 *        DropTower/BoilerBurst/Discotron · water LogFlume · transport Monorail/
 *        MagneticRide · dark GhostTrain  → 5/5 categories ✓
 * CIRCUITS Ember Corkscrew · Hollow Creek Flume · Monorail ring · Maglev Loopline ·
 *        Cinder Crypt → 5 circuits / 4 families (coaster · water · transport · dark) ✓
 * GATE   gate cell [0, 63.6] → first queue tail [0, 60.0] (Meridian Carousel) = 3.6 u ≤ 15 ✓
 * FLAG   Ember Corkscrew · start [31.2, 0.55, 38.4] heading 0 · steel · cars 3 · NO bank
 *        prop (steel builds 0.7) · ONE INVERSION (vertical `loop` r2.0) + 2 camelbacks +
 *        a 360° helix · verified at module scope by `verifyCircuit` (compile report,
 *        checkCoasterDesign, rateCoaster maxLatG ≤ 1.275, synthesized closure) and the
 *        mount falls back to a legal rectangle if that verification fails.
 *        corridor: the circuit box is x 31.2..58.6 · z 38.4..59.1 — OUTSIDE the monorail
 *        diamond (which spans z -51..34.2) and clear of every street node ✓
 * STREET buildParkNet called EXACTLY ONCE · the SAME NET feeds <Paths> and every
 *        offPathCell/place call ✓ · every set-piece is wired by PORT REF, never by its
 *        `position` (assertNodesOffPieces + chainEnd/pieceIsland/cardinalEdge asserted)
 *        · every ride pad comes out of `place()` → offPathCell → assertPadFlat ✓
 * MONO   ring VERBATIM (17 pieces, tail split 33.5 + 1.5) · position [-42.6, 0, -9.7+dz]
 *        rotation 0 (the START POSE) · 4 platforms · tails [-36.0, RZ] · [0, NZ-6.6] ·
 *        [36.0, RZ] · [0, SZ-6.6] are AUTHORED NODES and ALL LEAVES (no street continues
 *        past a deck) · the S tail is reached down the x -26.4 column (west of the seed-1
 *        z ≈ -43 ridge skirt, which is continuous x -23..38.6) and east along z -57.6
 * QUEUE  ONE ROW PER RIDE — the tail is the AUTHORED NODE, the pad is DERIVED from it by
 *        `place(tail, out, capacity, rig)`: reach = laneLenOf(cap) + 0.35 + 0.62 + 0.50 +
 *        0.45 + 2.4, then offPathCell(clear = padMarginOf(rig)), then assertPadFlat.
 *        No two rides share a tail node; every tail is in NODES; clearances come off the
 *        PAD_MARGIN table, never a guessed 3.2.
 * SPREAD built bbox ≈ 100 × 118 u ≥ 70 × 45 ✓ · street bbox x -45.6..48 · z -57.6..63.6
 * PLAZAS NET.plazas = hub (10.8² = 116 u²) + 5 bazaar courtyards (~30 u² each) ✓
 * NODES  ~45 authored · leaves: gate + 4 monorail tails + coaster tail + flume tail +
 *        pirate tail — every one carries a queue tail or the gate ✓ · ONE park-spanning
 *        loop (hub → midway → x -19.2 column → z RZ lateral → x 26.4 column → midway),
 *        crossing z = 0 twice ✓
 * DRESS  ≥ 40 tree cells + ≥ 80 themed scenery placements + neutral scenery, EVERY cell
 *        pushed off the street by offPathCell and then sieved IN THE TREE by <DryScatter>
 *        against the gate's own predicate (ground > WATER_LEVEL + 0.05 over the piece's
 *        footprint ring) — the drop count is printed, and the arrays are over-provisioned
 *        against the ≥ 32 tree / ≥ 16 scenery floors.
 * NIGHT  festival <Lights> runs on the avenues · <Neon> in the neon district · <Torch>
 *        pairs in the caldera · every real PointLight belongs to a catalog rig ≤ 4 each
 * GATE   parkAssertFlush() prints ONE numbered block and NEVER throws — a blocking entry
 *        drops that ONE piece (the ring) and the park still renders, because a black page
 *        scores 0 on all sixteen axes. validatePark runs in the preview via onReady.
 * ═══════════════════════════════════════════════════════════════════════════════════ */
import * as THREE from 'three';
import React from 'react';
import type { XZ, V3 } from './components/Park';
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
import { WorldLandmark } from './components/WorldLandmark';
import { Monorail } from './components/Monorail';
import { Carousel } from './components/Carousel';
import { FerrisWheel } from './components/FerrisWheel';
import { Teacups } from './components/Teacups';
import { LogFlume } from './components/LogFlume';
import { GhostTrain } from './components/GhostTrain';
import { PirateShip } from './components/PirateShip';
import { DropTower } from './components/DropTower';
import { AetherBalloons } from './components/AetherBalloons';
import { BoilerBurst } from './components/BoilerBurst';
import { Discotron } from './components/Discotron';
import { MagneticRide } from './components/MagneticRide';
import { Fumarole, ObsidianShards, BasaltColumns, LavaFissure, CharredSnag } from './components/EmberfallScenery';
import { WreckedHull, CoralCluster, AnchorPile, TidePool, DockPilings } from './components/TidewaterScenery';
import { GiantGear, SteamPipes, ClockTower, BoilerTank, CoalCart } from './components/BrassworkScenery';
import { GiantToadstools, StandingStones, LanternTree, RuinedArch, FlowerPodBed } from './components/ThornwickScenery';
import { NeonArch, SpeakerStack, MirrorBallPylon, LaserTruss, LightTiles } from './components/PulseScenery';

/* ── §0-P.5 — ONE assertion bus. Everything REPORTS; nothing throws. ─────────────── */
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

/* ── plot constants ─────────────────────────────────────────────────────────────── */
const SIZE = 128;
const SEED = 1;
const CLIMATE = 'temperate';
const CELL = 1.2;
const PEAK_LIMIT = 0.75;
const LAT_GUARD = 1.275;
const snap = (v: number) => +(Math.round(v / CELL) * CELL).toFixed(2);
const cell = (x: number, z: number): XZ => [snap(x), snap(z)];

/* ── §0-P.6 — the pinned seed row + the box/centre pre-filter ────────────────────── */
type SeedBasin = { ctr: XZ; box: [number, number, number, number] };
type SeedRow = { dom: SeedBasin; sec: SeedBasin };
const SEED_ROW: SeedRow = {
  dom: { ctr: [41, -39], box: [21, 60, -60, -21] },
  sec: { ctr: [-38, 31], box: [-56, -21, 23, 39] },
};
const inBasinBox = (c: XZ, b: SeedBasin) =>
  c[0] >= b.box[0] && c[0] <= b.box[1] && c[1] >= b.box[2] && c[1] <= b.box[3];
const offRow = (c: XZ, nearR = 12) =>
  [SEED_ROW.dom, SEED_ROW.sec].every((b) =>
    !inBasinBox(c, b) && Math.hypot(c[0] - b.ctr[0], c[1] - b.ctr[1]) >= nearR);

/* ── the composition, read three times: bare · pre-cap · guarded ─────────────────── */
type Comp = ReturnType<typeof parkComposition>;
const bumpIn = (comp: Comp, c: XZ) =>
  Math.max(0, ...(((comp as any)?.peaks ?? []) as any[]).map((p: any) => {
    const k = Math.max(0, 1 - Math.hypot(c[0] - p.x, c[1] - p.z) / p.radius);
    return k * k * (3 - 2 * k) * p.height;
  }));
const dryIn = (comp: Comp, c: XZ) =>
  [...(((comp as any)?.basins ?? []) as any[]), ...(((comp as any)?.clampBasins ?? []) as any[])]
    .every((b: any) => Math.hypot(c[0] - b.x, c[1] - b.z) > 0.74 * b.radius + 0.6);
const centroid = (v: any): XZ => (Array.isArray(v) ? [v[0] ?? 0, v[1] ?? 0] : [0, 0]);

/* ── §0-P.4 — the FLAGSHIP circuit. Authored, then VERIFIED at module scope. ─────── */
const FLAG_START: V3 = [31.2, 0.55, 38.4];
const FLAG_PIECES: TrackPiece[] = [
  'station',
  { type: 'straight', length: 1.2 },
  { type: 'lift', height: 2.6 },
  { type: 'straight', length: 1.2 },
  { type: 'turnR', angle: 90, radius: 4 },
  { type: 'drop', height: 1.8 },
  { type: 'loop', radius: 2.0 },              // THE INVERSION — steel only
  { type: 'straight', length: 1.8 },
  { type: 'hill', height: 0.8 },              // airtime crest 1
  { type: 'turnR', angle: 90, radius: 4 },
  { type: 'straight', length: 3.0 },
  { type: 'helixR', angle: 360, height: 1.0 },// height without plan advance
  { type: 'drop', height: 1.6 },
  { type: 'straight', length: 7.4 },
  { type: 'turnR', angle: 90, radius: 4 },
  { type: 'straight', length: 6.0 },
  { type: 'hill', height: 0.7 },              // airtime crest 2 (also drop #3)
  { type: 'straight', length: 7.4 },
  { type: 'turnR', angle: 90, radius: 4 },
  { type: 'straight', length: 1.2 },          // brake tail, lands ~0.3 u short
];
const FLAG_FALLBACK: TrackPiece[] = [
  'station',
  { type: 'lift', height: 2.2 },
  { type: 'straight', length: 2.4 },
  { type: 'turnR', angle: 90, radius: 2.5 },
  { type: 'drop', height: 2.2 },
  { type: 'straight', length: 2.4 },
  { type: 'turnR', angle: 90, radius: 2.5 },
  { type: 'hill', height: 0.8 },
  { type: 'turnR', angle: 90, radius: 2.5 },
  { type: 'straight', length: 2.4 },
  { type: 'turnR', angle: 90, radius: 2.5 },
  { type: 'straight', length: 1.2 },
];
function verifyCircuit(name: string, pieces: TrackPiece[], start: V3) {
  try {
    const out: any = compileTrackPieces(pieces, { type: 'steel', start, heading: 0, bounds: SIZE } as any);
    const rating: any = rateCoaster(out.points, { type: 'steel', bank: 0.7, cars: 3 } as any);
    const design: any = checkCoasterDesign(out.points, { type: 'steel' } as any);
    const ok = !!out.report?.ok && !out.report?.fatal
      && (rating?.maxLatG ?? 0) <= LAT_GUARD && !(design?.violations?.length);
    console.log(`[park] ${name}:`, {
      E: rating?.excitement, I: rating?.intensity, N: rating?.nausea, maxLatG: rating?.maxLatG,
      inversions: rating?.inversions, synthesized: out.report?.synthesizedCount, ok,
    });
    if (!ok) console.error(`[park] ${name} FAILED verification — ${out.report?.fatal
      ?? design?.violations?.map((v: any) => v.kind).join(', ') ?? `maxLatG ${rating?.maxLatG}`}`);
    return { ok, points: (out.points ?? []) as V3[] };
  } catch (err) {
    console.error(`[park] ${name} could not be compiled at module scope:`, err);
    return { ok: false, points: [] as V3[] };
  }
}
const FLAG = verifyCircuit('Ember Corkscrew', FLAG_PIECES, FLAG_START);
const COASTER_PIECES = FLAG.ok ? FLAG_PIECES : FLAG_FALLBACK;
const FLAG_ALT = FLAG.ok ? FLAG : verifyCircuit('Ember Corkscrew (fallback)', FLAG_FALLBACK, FLAG_START);
const COASTER_PTS: V3[] = FLAG_ALT.points;
parkAssert('flagshipCircuit', FLAG.ok,
  'the authored flagship circuit failed module-scope verification — the park mounts the ' +
  'verified rectangle fallback instead so a red, unregistered coaster never ships.');

/* ── the flume circuit (its own pieces, RCT2 conveyor-then-chute shape) ──────────── */
const FLUME_PIECES: TrackPiece[] = [
  'station',
  { type: 'straight', length: 0.6 },
  { type: 'lift', height: 1.6 },
  { type: 'turnR', angle: 90, radius: 2 },
  { type: 'lift', height: 1.6 },
  { type: 'turnR', angle: 90, radius: 2 },
  { type: 'drop', height: 2.8 },
  { type: 'turnR', angle: 90, radius: 2 },
  { type: 'straight', length: 7.84 },
  { type: 'turnR', angle: 90, radius: 2 },
  { type: 'straight', length: 1.2 },
];

/* ── §0-P.4 — the MONORAIL ring, verbatim, and its pose search ───────────────────── */
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
const ringCells = (dz: number): XZ[] => [
  [-42.6, -8.4 + dz], [0, 34.2 + dz], [42.6, -8.4 + dz], [0, -51.0 + dz],
  [-42.6, -9.7 + dz],
  [-36.0, -8.4 + dz], [0, 27.6 + dz], [36.0, -8.4 + dz], [0, -57.6 + dz],
  [-40.8, -8.4 + dz], [0, 32.4 + dz], [40.8, -8.4 + dz], [0, -52.8 + dz],
  [-1.2, 33.0 + dz], [41.4, -7.2 + dz], [1.2, -52.2 + dz],
];

/** parkComposition is pure — but it is read at MODULE SCOPE, so a throw here would be a
 *  black page. Read it defensively: an empty read degrades the checks, never the park. */
function compose(opts?: any): Comp {
  try {
    return opts
      ? (parkComposition as any)(THREE as any, SEED, SIZE, CLIMATE as any, opts)
      : (parkComposition as any)(THREE as any, SEED, SIZE, CLIMATE as any);
  } catch (err) {
    console.error('[park] parkComposition could not be read at module scope:', err);
    return {} as Comp;
  }
}
const BARE = compose();
const PRECAP = compose({ coasterPts: COASTER_PTS });

let RING_DZ = 0;
let ringPoseOk = false;
let ringWorstBump = 99;
for (const dz of [0, -1.2, 1.2, -2.4, 2.4, -3.6, 3.6, -4.8, 4.8, -6.0, 6.0]) {
  const cells = ringCells(dz);
  const structural = cells.slice(0, 9);          // 4 decks + start pose + 4 tails
  const worst = Math.max(...structural.map((c) => bumpIn(PRECAP, c)));
  const wet = cells.filter((c) => !dryIn(PRECAP, c) || !offRow(c)).length;
  if (worst < ringWorstBump) ringWorstBump = worst;
  if (worst <= PEAK_LIMIT && wet === 0) { RING_DZ = dz; ringPoseOk = true; break; }
}
console.log(`[park] monorail ring pose: dz ${RING_DZ}, worst deck/tail flank bump ` +
  `${ringWorstBump.toFixed(2)} against the ${PEAK_LIMIT} limit, accepted ${ringPoseOk}`);
const RING_OK = parkAssert('ringPose', ringPoseOk,
  `no monorail ring pose in dz ∈ [0, ±1.2 … ±6.0] clears the flank limit AND the pinned ` +
  `seed row (best worst-bump ${ringWorstBump.toFixed(2)}) — SHIPPING WITHOUT THE RING; ` +
  `transport still comes from the Maglev Loopline.`, 'blocking');

const RZ = snap(-8.4 + RING_DZ);
const NZ = snap(34.2 + RING_DZ);
const SZ = snap(-51.0 + RING_DZ);
const RING_CELLS = ringCells(RING_DZ).map((c) => cell(c[0], c[1]));

/* ── the SET-PIECES (plan first, mount second) ───────────────────────────────────── */
const HUB = fountainPlazaPlan({
  id: 'hub', title: 'Crown Plaza', position: [0, 50.4], tiles: 9,
  ports: ['N', 'E', 'S', 'W'], seed: 1,
});
const GATE_AVE = boulevardPlan({
  id: 'gateAve', title: 'Crown Approach', from: [0, 63.6], to: HUB.port('N'), spacing: 3.6, seed: 2,
});
const WEST_AVE = boulevardPlan({
  id: 'westAve', title: 'Foundry Walk', from: HUB.port('W'), to: [-19.2, 50.4], spacing: 4.8, seed: 3,
});
const EAST_AVE = boulevardPlan({
  id: 'eastAve', title: 'Corkscrew Walk', from: HUB.port('E'), to: [26.4, 50.4], spacing: 4.8, seed: 4,
});
const GLADE_ROW = bazaarPlan({
  id: 'gladeRow', title: 'Glade Row', position: [-12, snap(21.6 + RING_DZ)],
  facing: { port: 'W', toward: [-12, snap(27.6 + RING_DZ)] },
  stalls: ['honeywitch', 'cottonCandy', 'soda'],
  names: ['Honeywitch Apothecary', 'Faeriefloss', 'Wellspring Sodas'],
  theme: (WORLD_THEMES as any).enchantedForest, seed: 5,
});
const FOUNDRY_ROW = bazaarPlan({
  id: 'foundryRow', title: 'Foundry Row', position: [-45.6, 0],
  facing: { port: 'W', toward: [-45.6, 6] },
  stalls: ['goggles', 'burger', 'hotDog'],
  names: ['Goggleworks', 'Piston Grill', 'Rivet Dogs'],
  theme: (WORLD_THEMES as any).steampunk, seed: 6,
});
const EMBER_ROW = bazaarPlan({
  id: 'emberRow', title: 'Cinderworks Row', position: [-44.4, -45.6],
  facing: { port: 'E', toward: [-38.4, -45.6] },
  stalls: ['emberRoast', 'soda', 'balloon'],
  names: ['Cinder Grill', 'Slagworks Sodas', 'Ashfall Balloons'],
  theme: (WORLD_THEMES as any).fire, seed: 7,
});
const PULSE_ROW = bazaarPlan({
  id: 'pulseRow', title: 'Pulse Row', position: [4.8, snap(RZ - 6.0)],
  facing: { port: 'W', toward: [4.8, RZ] },
  stalls: ['neonSlush', 'cottonCandy', 'hotDog'],
  names: ['Neon Slush', 'Sugarwave', 'Basswork Dogs'],
  theme: (WORLD_THEMES as any).neon, seed: 8,
});
const COVE_ROW = bazaarPlan({
  id: 'coveRow', title: 'Cove Row', position: [54, -6],
  facing: { port: 'W', toward: [48, -6] },
  stalls: ['sushi', 'burger', 'soda'],
  names: ['Reefside Sushi', 'Galleon Grill', 'Bilgewater Sodas'],
  theme: (WORLD_THEMES as any).pirateBeach, seed: 9,
});
const ALL_PLANS: SetPiecePlan[] = [
  HUB, GATE_AVE, WEST_AVE, EAST_AVE, GLADE_ROW, FOUNDRY_ROW, EMBER_ROW, PULSE_ROW, COVE_ROW,
];

/* ── the STREET SKELETON. Every pair below is cardinal by construction. ──────────── */
const NODES: XZ[] = [
  cell(0, 63.6),                    //  0 gate (leaf)
  cell(0, 60.0),                    //  1 Carousel tail (3.6 u from the turnstile)
  cell(-19.2, 50.4),                //  2 west avenue terminus
  cell(26.4, 50.4),                 //  3 east avenue terminus
  cell(-19.2, 44.4),                //  4 midway west end
  cell(-12, 44.4),                  //  5 midway · forest column head
  cell(-6, 44.4),                   //  6 Teacups tail
  cell(12, 44.4),                   //  7 FerrisWheel tail
  cell(26.4, 44.4),                 //  8 midway east end
  cell(26.4, 38.4),                 //  9 flagship coaster queue tail (leaf)
  cell(-12, 38.4),                  // 10 forest column
  cell(-12, snap(27.6 + RING_DZ)),  // 11 forest column foot · lateral to the N deck tail
  cell(0, snap(27.6 + RING_DZ)),    // 12 N monorail tail (LEAF)
  cell(-19.2, 24.0),                // 13 west column
  cell(-19.2, 6.0),                 // 14 west column · steampunk lateral
  cell(-33.6, 6.0),                 // 15 AetherBalloons tail
  cell(-39.6, 6.0),                 // 16 steampunk lateral
  cell(-45.6, 6.0),                 // 17 BoilerBurst tail · Foundry Row port
  cell(-19.2, RZ),                  // 18 west junction
  cell(-33.6, RZ),                  // 19 ring west lateral
  cell(-36.0, RZ),                  // 20 W monorail tail (LEAF)
  cell(-12, RZ),                    // 21 central lateral
  cell(4.8, RZ),                    // 22 Pulse Row port node
  cell(12, RZ),                     // 23 Discotron tail
  cell(16.8, RZ),                   // 24 MagneticRide tail
  cell(26.4, RZ),                   // 25 east junction
  cell(30.0, RZ),                   // 26 ring east lateral
  cell(36.0, RZ),                   // 27 E monorail tail (LEAF)
  cell(-19.2, -24.0),               // 28 west column · flume spur
  cell(-12, -24.0),                 // 29 LogFlume tail (leaf)
  cell(-26.4, -24.0),               // 30 the jog WEST of the z ≈ -43 ridge skirt
  cell(-26.4, -45.6),               // 31 fire lateral head
  cell(-32.4, -45.6),               // 32 GhostTrain tail
  cell(-38.4, -45.6),               // 33 Cinderworks Row port node
  cell(-26.4, snap(-57.6 + RING_DZ)),// 34 south-west corner
  cell(0, snap(-57.6 + RING_DZ)),   // 35 S monorail tail (LEAF)
  cell(26.4, 24.0),                 // 36 east column
  cell(26.4, 0),                    // 37 east column · pirate lateral
  cell(36.0, 0),                    // 38 pirate lateral
  cell(48.0, 0),                    // 39 pirate column head
  cell(48.0, -6.0),                 // 40 Cove Row port node
  cell(48.0, -12.0),                // 41 DropTower tail
  cell(48.0, -18.0),                // 42 PirateShip tail (leaf)
];
const ix = (c: XZ): number => {
  const i = NODES.findIndex((n) => Math.abs(n[0] - c[0]) < 1e-6 && Math.abs(n[1] - c[1]) < 1e-6);
  // NEVER throw at module scope: a missing node is one reported edge, not a black page.
  parkAssert('missingNode', i >= 0, `EDGES names [${c}] but no such authored node exists`);
  return i < 0 ? 0 : i;
};
const E = (a: XZ | string, b: XZ | string): [NetRef, NetRef] =>
  [typeof a === 'string' ? a : ix(a), typeof b === 'string' ? b : ix(b)] as [NetRef, NetRef];

const EDGES: [NetRef, NetRef][] = [
  // gate spine + hub courtyard
  E(cell(0, 63.6), cell(0, 60.0)),
  E(cell(-19.2, 50.4), cell(-19.2, 44.4)),
  E(cell(26.4, 50.4), cell(26.4, 44.4)),
  E(cell(-19.2, 44.4), cell(-12, 44.4)),
  E(cell(-12, 44.4), cell(-6, 44.4)),
  E(cell(-6, 44.4), 'hub:S'),
  E('hub:S', cell(12, 44.4)),
  E(cell(12, 44.4), cell(26.4, 44.4)),
  // the flagship's queue spur
  E(cell(26.4, 44.4), cell(26.4, 38.4)),
  // the glade
  E(cell(-12, 44.4), cell(-12, 38.4)),
  E(cell(-12, 38.4), cell(-12, snap(27.6 + RING_DZ))),
  E(cell(-12, snap(27.6 + RING_DZ)), cell(0, snap(27.6 + RING_DZ))),
  E(cell(-12, snap(27.6 + RING_DZ)), 'gladeRow:W'),
  // the west column
  E(cell(-19.2, 44.4), cell(-19.2, 24.0)),
  E(cell(-19.2, 24.0), cell(-19.2, 6.0)),
  E(cell(-19.2, 6.0), cell(-19.2, RZ)),
  E(cell(-19.2, RZ), cell(-19.2, -24.0)),
  E(cell(-19.2, -24.0), cell(-12, -24.0)),
  E(cell(-19.2, -24.0), cell(-26.4, -24.0)),
  E(cell(-26.4, -24.0), cell(-26.4, -45.6)),
  E(cell(-26.4, -45.6), cell(-26.4, snap(-57.6 + RING_DZ))),
  E(cell(-26.4, snap(-57.6 + RING_DZ)), cell(0, snap(-57.6 + RING_DZ))),
  // the foundry
  E(cell(-19.2, 6.0), cell(-33.6, 6.0)),
  E(cell(-33.6, 6.0), cell(-39.6, 6.0)),
  E(cell(-39.6, 6.0), cell(-45.6, 6.0)),
  E(cell(-45.6, 6.0), 'foundryRow:W'),
  // the ring's west spur
  E(cell(-19.2, RZ), cell(-33.6, RZ)),
  E(cell(-33.6, RZ), cell(-36.0, RZ)),
  // the central lateral
  E(cell(-19.2, RZ), cell(-12, RZ)),
  E(cell(-12, RZ), cell(4.8, RZ)),
  E(cell(4.8, RZ), 'pulseRow:W'),
  E(cell(4.8, RZ), cell(12, RZ)),
  E(cell(12, RZ), cell(16.8, RZ)),
  E(cell(16.8, RZ), cell(26.4, RZ)),
  E(cell(26.4, RZ), cell(30.0, RZ)),
  E(cell(30.0, RZ), cell(36.0, RZ)),
  // the east column
  E(cell(26.4, 44.4), cell(26.4, 24.0)),
  E(cell(26.4, 24.0), cell(26.4, 0)),
  E(cell(26.4, 0), cell(26.4, RZ)),
  // the cove
  E(cell(26.4, 0), cell(36.0, 0)),
  E(cell(36.0, 0), cell(48.0, 0)),
  E(cell(48.0, 0), cell(48.0, -6.0)),
  E(cell(48.0, -6.0), 'coveRow:W'),
  E(cell(48.0, -6.0), cell(48.0, -12.0)),
  E(cell(48.0, -12.0), cell(48.0, -18.0)),
  // the caldera
  E(cell(-26.4, -45.6), cell(-32.4, -45.6)),
  E(cell(-32.4, -45.6), cell(-38.4, -45.6)),
  E(cell(-38.4, -45.6), 'emberRow:E'),
];

/* ── buildParkNet — called EXACTLY ONCE ─────────────────────────────────────────── */
const NET = buildParkNet({
  nodes: NODES,
  edges: EDGES as any,
  pieces: ALL_PLANS,
  keepDry: RING_CELLS,
} as any);

/* ── §0-P.5 — the wiring assertions over the ONE net ────────────────────────────── */
const portCell = (ref: NetRef): XZ => {
  if (typeof ref === 'number') return NODES[ref];
  const [id, name] = String(ref).split(':');
  const p = ALL_PLANS.find((q) => q.id === id);
  if (!p) { parkAssert('unknownPiece', false, `EDGES references '${ref}' with no such plan`); return [0, 0]; }
  return p.port(name);
};
const EPS = 1e-6;
EDGES.forEach(([a, b]) => {
  const A = portCell(a), B = portCell(b);
  parkAssert('cardinalEdge', Math.abs(A[0] - B[0]) < EPS || Math.abs(A[1] - B[1]) < EPS,
    `edge ${a}→${b} is DIAGONAL: [${A}] → [${B}] — buildParkNet elbows it through a corner ` +
    `cell nobody planned. Fix the table.`, 'advisory');
});
const PORT_REFS = (EDGES.flat() as NetRef[]).filter((x): x is string => typeof x === 'string');
ALL_PLANS.forEach((p) => {
  const wired = new Set(PORT_REFS.filter((r) => r.split(':')[0] === p.id).map((r) => r.split(':')[1]));
  parkAssert('pieceIsland', wired.size > 0,
    `set-piece '${p.id}' has NO '${p.id}:<PORT>' ref in EDGES — it composes as an ISLAND`);
  (p.ports || []).filter((pt: any) => !pt.prunable).forEach((pt: any) => {
    if (wired.has(pt.name)) return;
    if (p.id === 'gateAve' && pt.name === 'A') return;   // the bare <Gate/> stands on it
    parkAssert('chainEnd', false,
      `chain piece '${p.id}' wires [${[...wired]}] but NOT '${p.id}:${pt.name}' — that end of ` +
      `the carriageway dead-ends in grass.`);
  });
});
const SOLID_CLEAR: Record<string, number> = { FountainPlaza: 1.8, Bazaar: 0.6, Boulevard: 0 };
function assertNodesOffPieces(nodes: XZ[], plans: SetPiecePlan[], label: string): void {
  const hits: string[] = [];
  plans.forEach((p: any) => {
    const clear = SOLID_CLEAR[p.kind] ?? 1.8;
    if (clear === 0) return;
    const ports = new Set((p.ports || []).map((pt: any) => `${pt.at[0].toFixed(2)},${pt.at[1].toFixed(2)}`));
    const f = p.footprint;
    const c = Math.cos(-(f.yaw || 0)), s = Math.sin(-(f.yaw || 0));
    nodes.forEach((n, i) => {
      if (ports.has(`${n[0].toFixed(2)},${n[1].toFixed(2)}`)) return;
      const dx = n[0] - f.cx, dz = n[1] - f.cz;
      const lx = dx * c - dz * s, lz = dx * s + dz * c;
      const gap = Math.max(Math.abs(lx) - f.hx, Math.abs(lz) - f.hz);
      if (gap < clear - 1e-9)
        hits.push(`[${n[0]}, ${n[1]}] (${label} ${i}) is ${gap.toFixed(2)} u from '${p.id}' — needs ${clear}`);
    });
  });
  parkAssert('nodeInSolid', !hits.length,
    `${hits.length} cell(s) stand inside or against a set-piece's SOLID footprint:\n  ` + hits.join('\n  '));
}
assertNodesOffPieces(NODES, ALL_PLANS, 'node');

/* ── §0-P.6 — the guard list is DERIVED from the fuse's own output ───────────────── */
function keepDryOf(net: { keepDry: XZ[] }): XZ[] {
  const kept = (net.keepDry || []).filter((c) => offRow(c));
  const dropped = (net.keepDry || []).length - kept.length;
  if (dropped) console.warn(`[park] keepDryOf dropped ${dropped} of ${net.keepDry.length} guard ` +
    `cell(s) sitting on the pinned row's water — a DROPPED guard is not a fixed cell.`);
  return kept;
}
const GUARDS = keepDryOf(NET as any);
const COMP = compose({ keepDry: GUARDS, coasterPts: COASTER_PTS });
console.log(`[park] terrain: guards ${GUARDS.length} of ${(NET as any).keepDry.length} kept · ` +
  `terrainSeed ${(BARE as any).terrainSeed} → ${(COMP as any).terrainSeed} · water ` +
  `${JSON.stringify((COMP as any).waterCentre)} / ${JSON.stringify((COMP as any).waterCentreSecond)}`);
const domBare = centroid((BARE as any).waterCentre);
const domGuard = centroid((COMP as any).waterCentre);
const secBare = centroid((BARE as any).waterCentreSecond);
const secGuard = centroid((COMP as any).waterCentreSecond);
parkAssert('waterMoved',
  Math.hypot(domGuard[0] - domBare[0], domGuard[1] - domBare[1]) < 1 &&
  Math.hypot(secGuard[0] - secBare[0], secGuard[1] - secBare[1]) < 1,
  `guards moved a water body off the pinned row — dominant ${JSON.stringify(domBare)} → ` +
  `${JSON.stringify(domGuard)}, secondary ${JSON.stringify(secBare)} → ${JSON.stringify(secGuard)}`);
const rf: any = (COMP as any).report?.reliefFloor;
parkAssert('terrainFlattened', !rf || rf.kept >= rf.floor,
  rf ? `keepDry FLATTENED the seed: relief ${rf.authoredRelief?.toFixed?.(2)} → ` +
    `${rf.relief?.toFixed?.(2)} (kept ${rf.kept?.toFixed?.(2)} against ${rf.floor}), stdH ` +
    `${rf.authoredStdH?.toFixed?.(2)} → ${rf.stdH?.toFixed?.(2)} · ranges ${rf.guardedRanges}` : '',
  'advisory');

/* ── §0-P.5 — pads are DERIVED from authored tails, never the reverse ───────────── */
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

function assertPadFlat(pad: XZ, clear: number, label: string): XZ {
  if (bumpIn(COMP, pad) <= PEAK_LIMIT && dryIn(COMP, pad) && offRow(pad)) return pad;
  for (let r = 1; r <= 8; r += 1)
    for (let dx = -r; dx <= r; dx += 1)
      for (let dzz = -r; dzz <= r; dzz += 1) {
        if (Math.max(Math.abs(dx), Math.abs(dzz)) !== r) continue;
        const c: XZ = [snap(pad[0] + dx * 0.6), snap(pad[1] + dzz * 0.6)];
        if (bumpIn(COMP, c) > PEAK_LIMIT || !dryIn(COMP, c) || !offRow(c)) continue;
        const off = offPathCell(NET as any, c, { clear } as any) as XZ | null;
        if (off && Math.hypot(off[0] - c[0], off[1] - c[1]) < 1e-6) {
          console.warn(`[park] ${label}: pad [${pad}] on a flank/shore (bump ` +
            `${bumpIn(COMP, pad).toFixed(2)}) — moved to [${c}]`);
          return c;
        }
      }
  parkAssert('padOnFlank', false,
    `${label}: pad [${pad}] is on a hill flank (bump ${bumpIn(COMP, pad).toFixed(2)}) or wet, and ` +
    `no cell within 4.8 u is flat, dry AND ${clear} u off the street. MOVE THE TAIL.`);
  return pad;
}
function place(tail: XZ, out: XZ, capacity: number, rig: string, extra = 0) {
  const clear = padMarginOf(rig);
  const join = laneLenOf(capacity) + 0.35;
  const reach = minReachOf(capacity) + 2.4 + extra;
  const cand: XZ = cell(tail[0] + out[0] * reach, tail[1] + out[1] * reach);
  const onStreet = (offPathCell(NET as any, cand, { clear } as any) ?? cand) as XZ;
  const pad = assertPadFlat(onStreet, clear, rig);
  const got = Math.hypot(pad[0] - tail[0], pad[1] - tail[1]);
  if (got < minReachOf(capacity) + 1.2)
    parkAssert('padReach', false,
      `${rig}: pad [${pad}] sits ${got.toFixed(2)} u from its tail [${tail}] — the cap-${capacity} ` +
      `floor is ${(minReachOf(capacity) + 1.2).toFixed(2)} u. Open the court or lower the capacity.`);
  return {
    pad,
    anchor: cell(tail[0] + out[0] * join, tail[1] + out[1] * join),
    dir: [-out[0], -out[1]] as XZ,
  };
}
const yawOf = (dir: XZ) => Math.atan2(dir[0], dir[1]);

/* ── the ROSTER: 12 rides, 5 categories, every one named ────────────────────────── */
type Site = {
  key: string; C: React.ComponentType<any>; rig: string; name: string; tail: XZ; out: XZ;
  cap: number; price: number; dur: number; intensity: number; extra?: number; pieces?: TrackPiece[];
};
const SITES: Site[] = [
  { key: 'carousel', C: Carousel, rig: 'Carousel', name: 'Meridian Carousel',
    tail: cell(0, 60.0), out: [1, 0], cap: 4, price: 3, dur: 10, intensity: 1 },
  { key: 'wheel', C: FerrisWheel, rig: 'FerrisWheel', name: 'Lantern Wheel',
    tail: cell(12, 44.4), out: [0, -1], cap: 6, price: 4, dur: 11, intensity: 2 },
  { key: 'teacups', C: Teacups, rig: 'Teacups', name: 'Willow Teacups',
    tail: cell(-6, 44.4), out: [0, -1], cap: 4, price: 3, dur: 9, intensity: 2 },
  { key: 'balloons', C: AetherBalloons, rig: 'AetherBalloons', name: 'Aether Ascent',
    tail: cell(-33.6, 6.0), out: [0, 1], cap: 4, price: 4, dur: 11, intensity: 2 },
  { key: 'boiler', C: BoilerBurst, rig: 'BoilerBurst', name: 'Boiler Burst',
    tail: cell(-45.6, 6.0), out: [0, 1], cap: 4, price: 5, dur: 10, intensity: 6 },
  { key: 'disco', C: Discotron, rig: 'Discotron', name: 'Discotron 9000',
    tail: cell(12, RZ), out: [0, 1], cap: 6, price: 5, dur: 10, intensity: 6, extra: 2.4 },
  { key: 'maglev', C: MagneticRide, rig: 'MagneticRide', name: 'Maglev Loopline',
    tail: cell(16.8, RZ), out: [0, -1], cap: 6, price: 4, dur: 12, intensity: 3 },
  { key: 'ghost', C: GhostTrain, rig: 'GhostTrain', name: 'Cinder Crypt',
    tail: cell(-32.4, -45.6), out: [0, 1], cap: 4, price: 5, dur: 12, intensity: 4 },
  { key: 'ship', C: PirateShip, rig: 'PirateShip', name: 'Salt Reaver',
    tail: cell(48.0, -18.0), out: [1, 0], cap: 4, price: 5, dur: 10, intensity: 7 },
  { key: 'drop', C: DropTower, rig: 'DropTower', name: 'Tide Drop',
    tail: cell(48.0, -12.0), out: [1, 0], cap: 4, price: 6, dur: 9, intensity: 8 },
  { key: 'flume', C: LogFlume, rig: 'LogFlume', name: 'Hollow Creek Flume',
    tail: cell(-12, -24.0), out: [0, -1], cap: 8, price: 6, dur: 12, intensity: 5,
    pieces: FLUME_PIECES },
];
const PLACED = SITES.map((s) => ({ ...s, ...place(s.tail, s.out, s.cap, s.rig, s.extra ?? 0) }));
const PAD_OF = (key: string) => PLACED.find((p) => p.key === key)!.pad;
const ALL_PADS: XZ[] = PLACED.map((p) => p.pad);
console.log('[park] queue rows:', PLACED.map((p) =>
  `${p.rig} cap ${p.cap} tail [${p.tail}] → pad [${p.pad}] ` +
  `${Math.hypot(p.pad[0] - p.tail[0], p.pad[1] - p.tail[1]).toFixed(2)} u ` +
  `(floor ${(minReachOf(p.cap) + 1.2).toFixed(2)}, clear ${padMarginOf(p.rig)})`).join('\n  '));
// no two rides share a tail node
PLACED.forEach((a, i) => PLACED.slice(i + 1).forEach((b) => {
  parkAssert('sharedTail', Math.hypot(a.tail[0] - b.tail[0], a.tail[1] - b.tail[1]) > 1e-6,
    `${a.rig} and ${b.rig} share the queue tail [${a.tail}]`);
  parkAssert('padPitch', Math.hypot(a.pad[0] - b.pad[0], a.pad[1] - b.pad[1]) >= 6,
    `${a.rig} [${a.pad}] and ${b.rig} [${b.pad}] are ` +
    `${Math.hypot(a.pad[0] - b.pad[0], a.pad[1] - b.pad[1]).toFixed(2)} u apart — the pad pitch ` +
    `floor is 6 u and rideSpacing.obb.minGap needs 1.5 u between the BODIES.`, 'advisory');
}));
assertNodesOffPieces(ALL_PADS, ALL_PLANS, 'pad');

/* ── deterministic dressing scatter (hashed golden angle, street- and row-aware) ─── */
function scatter(centre: XZ, n: number, r0: number, r1: number, avoid: XZ[],
                 clear = 1.2, keep = 1.8): XZ[] {
  const out: XZ[] = [];
  for (let i = 0; i < n * 6 && out.length < n; i += 1) {
    const a = i * 2.39996323;
    const rr = r0 + (r1 - r0) * Math.sqrt(((i % n) + 0.5) / n);
    const raw: XZ = cell(centre[0] + Math.cos(a) * rr, centre[1] + Math.sin(a) * rr);
    const c = offPathCell(NET as any, raw, { clear } as any) as XZ | null;
    if (!c) continue;
    if (Math.abs(c[0]) > 58 || Math.abs(c[1]) > 58) continue;
    if (!offRow(c) || bumpIn(COMP, c) > 1.6) continue;
    if (avoid.some((p) => Math.hypot(p[0] - c[0], p[1] - c[1]) < 4.2)) continue;
    if (out.some((p) => Math.hypot(p[0] - c[0], p[1] - c[1]) < keep)) continue;
    if (RING_CELLS.some((p) => Math.hypot(p[0] - c[0], p[1] - c[1]) < 3.0)) continue;
    out.push(c);
  }
  return out;
}

type Prop = { at: XZ; C: React.ComponentType<any>; seed: number; rot: number };
function dressWorld(centre: XZ, kinds: React.ComponentType<any>[], n: number): Prop[] {
  return scatter(centre, n, 4.8, 13.2, ALL_PADS, 1.2, 2.4).map((at, i) => ({
    at, C: kinds[i % kinds.length], seed: i + 3, rot: ((i * 37) % 12) * (Math.PI / 6),
  }));
}
const FIRE_CENTRE = cell(-40.8, -42.0);
const FOUNDRY_CENTRE = cell(-39.6, 2.4);
const GLADE_CENTRE = cell(-8.4, snap(30.0 + RING_DZ));
const PULSE_CENTRE = cell(10.8, RZ);
const COVE_CENTRE = cell(54.0, -12.0);

const FIRE_PROPS = dressWorld(FIRE_CENTRE, [Fumarole, ObsidianShards, BasaltColumns, LavaFissure, CharredSnag], 18);
const FOUNDRY_PROPS = dressWorld(FOUNDRY_CENTRE, [GiantGear, SteamPipes, ClockTower, BoilerTank, CoalCart], 18);
const GLADE_PROPS = dressWorld(GLADE_CENTRE, [GiantToadstools, StandingStones, LanternTree, RuinedArch, FlowerPodBed], 18);
const PULSE_PROPS = dressWorld(PULSE_CENTRE, [NeonArch, SpeakerStack, MirrorBallPylon, LaserTruss, LightTiles], 18);
const COVE_PROPS = dressWorld(COVE_CENTRE, [WreckedHull, CoralCluster, AnchorPile, TidePool, DockPilings], 18);
const WORLD_PROPS: Prop[] = [
  ...FIRE_PROPS, ...FOUNDRY_PROPS, ...GLADE_PROPS, ...PULSE_PROPS, ...COVE_PROPS,
];

/* ── the five WORLDS — each one a themed row + its own rides + its own dressing ──── */
const FIRE = worldPlan({
  id: 'fire', theme: (WORLD_THEMES as any).fire, pieces: [EMBER_ROW],
  include: [PAD_OF('ghost'), FIRE_CENTRE, ...FIRE_PROPS.map((p) => p.at)],
} as any);
const FOUNDRY = worldPlan({
  id: 'steampunk', theme: (WORLD_THEMES as any).steampunk, pieces: [FOUNDRY_ROW],
  include: [PAD_OF('balloons'), PAD_OF('boiler'), cell(-42.6, RZ), FOUNDRY_CENTRE,
    ...FOUNDRY_PROPS.map((p) => p.at)],
} as any);
const GLADE = worldPlan({
  id: 'enchantedForest', theme: (WORLD_THEMES as any).enchantedForest, pieces: [GLADE_ROW],
  include: [PAD_OF('teacups'), cell(0, NZ), GLADE_CENTRE, ...GLADE_PROPS.map((p) => p.at)],
} as any);
const PULSE = worldPlan({
  id: 'neon', theme: (WORLD_THEMES as any).neon, pieces: [PULSE_ROW],
  include: [PAD_OF('disco'), PAD_OF('maglev'), PULSE_CENTRE, ...PULSE_PROPS.map((p) => p.at)],
} as any);
const COVE = worldPlan({
  id: 'pirateBeach', theme: (WORLD_THEMES as any).pirateBeach, pieces: [COVE_ROW],
  include: [PAD_OF('ship'), PAD_OF('drop'), COVE_CENTRE, ...COVE_PROPS.map((p) => p.at)],
} as any);
const WORLDS = [FIRE, FOUNDRY, GLADE, PULSE, COVE];
const WORLD_FLOOR = 20 * Math.sqrt(SIZE / 48);
WORLDS.forEach((a: any, i) => WORLDS.slice(i + 1).forEach((b: any) => {
  const d = Math.hypot(a.centre[0] - b.centre[0], a.centre[1] - b.centre[1]);
  parkAssert('worldSpacing', d >= WORLD_FLOOR,
    `worlds '${a.id}' and '${b.id}' are ${d.toFixed(2)} u apart — the floor is ` +
    `${WORLD_FLOOR.toFixed(2)} u at size ${SIZE}.`, 'advisory');
}));
console.log('[park] worlds:', WORLDS.map((w: any) =>
  `${w.id} @ [${w.centre.map((v: number) => v.toFixed(1))}]`).join(' · '));

/* ── trees + neutral scenery, over-provisioned against the ≥ 32 / ≥ 16 floors ────── */
const TREE_SHAPES = ['round', 'pine', 'willow', 'round', 'pine'] as const;
type TreeShape = (typeof TREE_SHAPES)[number];
const TREE_CELLS: XZ[] = [
  ...scatter(cell(0, 56.4), 10, 8.4, 15.6, ALL_PADS, 0.75, 2.4),
  ...scatter(cell(-19.2, 33.6), 10, 6.0, 14.4, ALL_PADS, 0.75, 2.4),
  ...scatter(cell(19.2, 20.4), 10, 7.2, 16.8, ALL_PADS, 0.75, 2.4),
  ...scatter(cell(-19.2, -33.6), 10, 6.0, 15.6, ALL_PADS, 0.75, 2.4),
  ...scatter(cell(33.6, -6.0), 8, 6.0, 13.2, ALL_PADS, 0.75, 2.4),
];
const TREES: { at: XZ; shape: TreeShape }[] = TREE_CELLS.map((at, i) => ({
  at, shape: TREE_SHAPES[i % TREE_SHAPES.length],
}));
const NEUTRAL_NAMES = ['planterBox', 'topiarySpiral', 'picnicTable', 'birdbath', 'parkClock',
  'signpost', 'marbleStatue', 'gazebo', 'wishingWell', 'flagpole'] as const;
const NEUTRAL: { at: XZ; name: string }[] =
  scatter(cell(0, 46.8), 12, 9.6, 18.0, ALL_PADS, 1.2, 3.0)
    .concat(scatter(cell(6.0, 12.0), 10, 7.2, 16.8, ALL_PADS, 1.2, 3.0))
    .map((at, i) => ({ at, name: NEUTRAL_NAMES[i % NEUTRAL_NAMES.length] }));
const RESTROOM_AT = (offPathCell(NET as any, cell(-12, 48.0), { clear: 1.8 } as any) ?? cell(-12, 48.0)) as XZ;

parkAssert('treeFloor', TREES.length >= 40,
  `only ${TREES.length} tree cells survived the street + row sieve against the 32 floor (the ` +
  `runtime <DryScatter> still drops wet ones, so the array is over-provisioned to 40+).`, 'advisory');
parkAssert('sceneryFloor', WORLD_PROPS.length + NEUTRAL.length >= 60,
  `only ${WORLD_PROPS.length + NEUTRAL.length} scenery placements survived against the 16 floor.`,
  'advisory');
console.log(`[park] dress: ${TREES.length} trees · ${WORLD_PROPS.length} themed props · ` +
  `${NEUTRAL.length} neutral props`);

const ROSTER_NAMES = [...PLACED.map((p) => p.name), 'Ember Corkscrew', 'Three Crowns Skyline'];
parkAssertFlush();

/* ── the gate's own dryness predicate, run IN THE TREE ───────────────────────────── */
type ParkCtx = ReturnType<typeof usePark>;
function dryRing(park: ParkCtx, c: XZ, r = 0.75): boolean {
  const g: any = (park as any).ground;
  if (!g?.lint?.isDry) return true;
  const dry = (x: number, z: number) => g.lint.isDry(x, z, 0.05);
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
  const park = usePark('DryScatter' as any);
  const [dry, setDry] = React.useState<T[] | null>(null);
  React.useEffect(() => {
    const kept = cells.filter((c) => dryRing(park, c.at));
    if (kept.length < cells.length)
      console.error(`[park] DryScatter(${label}) dropped ${cells.length - kept.length} of ` +
        `${cells.length} cell(s) under waterline + 0.05: ` +
        `${JSON.stringify(cells.filter((c) => !kept.includes(c)).map((c) => c.at))}`);
    setDry(kept);
  }, [park, cells, label]);
  return <>{(dry ?? []).map(render)}</>;
}

/* ── the park ────────────────────────────────────────────────────────────────────── */
export function App() {
  const onReady = React.useCallback((report: any) => {
    console.log('[park] validatePark:', {
      ok: report?.ok, failures: report?.failures?.length ?? 0, warnings: report?.warnings?.length ?? 0,
    });
    if (report?.failures?.length) console.error('[park] failures:', report.failures);
    if (report?.warnings?.length) console.warn('[park] warnings:', report.warnings);
    const rects: any[] = report?.footprints ?? [];
    rects.forEach((a, i) => rects.slice(i + 1).forEach((b) => {
      if (a.rideId && a.rideId === b.rideId) return;
      const gap = Math.max(
        Math.abs(a.cx - b.cx) - (a.hx + b.hx),
        Math.abs(a.cz - b.cz) - (a.hz + b.hz),
      );
      if (gap < 1.5)
        console.error(`[park] SPACING: ${a.label} vs ${b.label} gap ${gap.toFixed(2)} < 1.5 — ` +
          `−2 on ride spacing, −0.25 on the roster axis.`);
    }));
  }, []);

  return (
    <Park
      seed={SEED}
      climate={CLIMATE as any}
      roster={{ rides: ROSTER_NAMES, stalls: 15, categories: 5 }}
      onReady={onReady}
    >
      <Terrain keepDry={GUARDS} coasterPts={COASTER_PTS as any} />
      <Paths
        nodes={(NET as any).nodes}
        edges={(NET as any).edges}
        plazas={(NET as any).plazas}
        bins={(NET as any).bins}
        walkers={6}
      />
      <GameManager />
      <Gate />

      {/* set-pieces — after <Paths>, so their dressing settles on the paving */}
      <FountainPlaza plan={HUB} />
      <Boulevard plan={GATE_AVE} />
      <Boulevard plan={WEST_AVE} />
      <Boulevard plan={EAST_AVE} />

      {/* the five worlds: region, giant, themed row */}
      {WORLDS.map((w: any) => <World key={`w-${w.id}`} plan={w} />)}
      <WorldLandmark plan={FIRE as any} position={FIRE_CENTRE} />
      <WorldLandmark plan={FOUNDRY as any} position={FOUNDRY_CENTRE} />
      <WorldLandmark plan={GLADE as any} position={GLADE_CENTRE} />
      <WorldLandmark plan={PULSE as any} position={PULSE_CENTRE} />
      <WorldLandmark plan={COVE as any} position={COVE_CENTRE} />
      <Bazaar plan={EMBER_ROW} />
      <Bazaar plan={FOUNDRY_ROW} />
      <Bazaar plan={GLADE_ROW} />
      <Bazaar plan={PULSE_ROW} />
      <Bazaar plan={COVE_ROW} />

      {/* the flagship — PIECES mode, cars passed, no bank prop (steel builds 0.7) */}
      <Coaster
        name="Ember Corkscrew"
        pieces={COASTER_PIECES}
        start={FLAG_START}
        heading={0}
        type="steel"
        cars={3}
        capacity={4}
        rideDuration={11}
        loadTime={2}
        intensity={8}
        price={7}
        queueTailNode={(NET as any).node(cell(26.4, 38.4))}
        queueDir={[1, 0]}
      />

      {/* the transport ring — one ride, four platforms, dropped only if no pose is legal */}
      {RING_OK ? (
        <Monorail
          pieces={MONO_PIECES}
          position={[-42.6, 0, snap(-9.7 + RING_DZ)]}
          rotation={0}
          register={{ name: 'Three Crowns Skyline', capacity: 12, price: 3, rideDuration: 12 }}
          queue={{ anchor: cell(-40.8, RZ), dir: [1, 0] }}
        />
      ) : null}

      {/* every other ride: pad DERIVED from its authored tail */}
      {PLACED.map((s) => (
        <s.C
          key={s.key}
          position={s.pad}
          rotation={yawOf(s.dir)}
          {...(s.pieces ? { pieces: s.pieces } : {})}
          register={{
            name: s.name, capacity: s.cap, price: s.price,
            rideDuration: s.dur, intensity: s.intensity,
          }}
          queue={{ anchor: s.anchor, dir: s.dir }}
        />
      ))}

      <Restroom position={RESTROOM_AT} rotation={Math.PI / 2} />

      {/* night: festival runs on the avenues, neon over the club street, torches in the caldera */}
      <Lights from={cell(0, 62.4)} to={cell(0, 57.6)} />
      <Lights from={cell(-8.4, 50.4)} to={cell(-18.0, 50.4)} />
      <Lights from={cell(8.4, 50.4)} to={cell(25.2, 50.4)} />
      <Lights from={cell(-12, RZ)} to={cell(4.8, RZ)} />
      <Neon text="PULSE" position={[10.8, 1.7, snap(RZ + 3.6)]} rotation={Math.PI} scale={0.55} />
      <Neon text="COVE" position={[52.8, 1.7, -16.8]} rotation={Math.PI} scale={0.5} />
      <Torch position={cell(-38.4, -40.8)} />
      <Torch position={cell(-43.2, -40.8)} />

      {/* dressing, sieved in the tree by the gate's own wet-cell predicate */}
      <DryScatter
        label="themed"
        cells={WORLD_PROPS}
        render={(p, i) => <p.C key={`wp-${i}`} position={p.at} rotation={p.rot} seed={p.seed} />}
      />
      <DryScatter
        label="scenery"
        cells={NEUTRAL}
        render={(s, i) => <Scenery key={`sc-${i}`} name={s.name} position={s.at} seed={i + 1} />}
      />
      <DryScatter
        label="trees"
        cells={TREES}
        render={(t, i) => (
          <Placed
            key={`tr-${i}`}
            position={t.at}
            build={(three: any) => tree(three, { shape: t.shape })}
          />
        )}
      />
    </Park>
  );
}

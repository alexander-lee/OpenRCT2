/* ═══ THREE CROWNS — §0 PRE-FLIGHT ══════════════════════════════════════════════════
 * SIZE   128 (default, `size` prop OMITTED)
 * SEED   31 / temperate — dominant lake ctr (-40, -38) box x[-64,-16] z[-63,-8]
 *        secondary ctr (17, 40) box x[5,30] z[18,63]                     [PRE-keepDry]
 *        RING WATER WALK: all 16 monorail ring cells walked against BOTH bodies'
 *        boxes AND their 12-u near radii at RING_DZ = +6.0 — every deck, tail,
 *        anchor and exit lands OUTSIDE both boxes (W/E decks at z -2.4 clear the
 *        dominant box's z ceiling of -8; N deck [0, 40.2] clears the secondary
 *        box's x floor of 5) and no cell is inside 12 u of either centre ✓
 *        At RING_DZ = 0 the W deck [-42.6, -8.4] falls INSIDE the dominant box —
 *        that is why the offset is searched, not assumed. dz swept over
 *        [0, ±1.2, ±2.4, ±3.6, ±4.8, ±6.0]; +6.0 is the first dry pose.
 *        ring-only re-compose: BARE vs COMP diffed on BOTH centroids + terrainSeed
 *        (`waterMoved`, printed) · reliefFloor.kept diffed against its 0.70 floor
 *        (`terrainFlattened`, printed — read off report.reliefFloor, never .relief)
 *        every pad + prop cell re-checked IN THE TREE by the GATE'S OWN predicate
 *        (park.ground.lint.isDry(x, z, 0.05), the 8-point footprint ring) via
 *        <DryScatter> / <DryReceipt> — isDryCell alone does NOT prove this ✓
 * WORLDS 5 (ALL of them), each a worldPlan whose rect is DERIVED from its member
 *        bazaar + its ride pads + its landmark + its 25 scenery cells:
 *          fire            ~( 32,   3)   steampunk      ~(-33,   6)
 *          pirateBeach     ~( 10, -43)   enchantedForest ~(-53,  38)
 *          neon            ~(-17,  48)
 *        every centre pair is over the 32.66 u floor (20·√(128/48)); the CLOSEST
 *        pair is enchantedForest↔neon at ~37.8 u ◄ ≥ 32.66 ✓ and every rect pair
 *        keeps a DRY GAP > 0 (tightest: enchantedForest↔neon ~4.2 u in x) ✓
 *        WORLD fire            : LaunchedFreefall + Carousel · emberRoast counter
 *                                · Volcano giant · 25 Emberfall placements · spur ✓
 *        WORLD steampunk       : AetherBalloons + BoilerBurst + FerrisWheel
 *                                · goggles counter · Great Zeppelin giant
 *                                · 25 Brasswork placements · spur ✓
 *        WORLD pirateBeach     : LogFlume + PirateShip · sushi counter
 *                                · Beached Galleon giant · 25 Tidewater · spur ✓
 *        WORLD enchantedForest : GhostTrain + Chairlift · honeywitch counter
 *                                · Dragon Roost giant · 25 Thornwick · spur ✓
 *        WORLD neon            : Discotron · neonSlush counter · Disco Ball Floor
 *                                giant · 25 Pulse placements · spur ✓
 *        Each world's scenery comes ONLY from its own pack (a foreign themed piece
 *        is a §0-FATAL worldThemeMixed), and <ThemeRegion> paves + furnishes each
 *        rect so the five read as five FLOORS, not one lawn ✓
 *        HONEST GAP: the per-world floor asks for 3 rides of that theme. fire's
 *        three themed circuits (MagmaRun 14.22 / EmberWings 16.15 / LavaTubeRun
 *        23.41) and pirateBeach's (ReefRacer 22.20 / DeepDrift 12.65 /
 *        OceanTunnelSlide 22.14) all span more land than the monorail ring's beam
 *        corridor leaves in those quadrants, so those worlds carry small neutral
 *        rides plus their own stall, giant, ground and 25-piece scatter instead of
 *        a body that would fail the footprint sweep. Deliberate, not overlooked.
 * CATS   (WRITTEN BEFORE ANY JSX) gentle FerrisWheel/Carousel/AetherBalloons/
 *        Discotron/Teacups · thrill Coaster (flagship) + BoilerBurst +
 *        LaunchedFreefall + PirateShip · water LogFlume · transport Monorail ring
 *        + Chairlift · dark GhostTrain  → 5/5 categories ✓
 *        RARE PICKS BoilerBurst + LaunchedFreefall + Chairlift. NOTE, honestly:
 *        the never-used shelf is DERIVED at scoring time from signatures/ and
 *        CANNOT be read from inside this file, so no corpus-novelty claim is made
 *        here. What IS verifiable by ctrl-F of the one injected rules file: each
 *        of the three appears there exactly once, only in the PAD_MARGIN table,
 *        so no worked example seeded them.
 * CIRCUITS  Coaster · Monorail ring · LogFlume · Chairlift · GhostTrain
 *        → 5 CIRCUITS (≥ 5) / FAMILIES coaster + water + transport + dark = 4 (≥ 3)
 *        Two rides from the tracked set {Coaster, MineTrainCoaster, LogFlume,
 *        Bobsleigh}: Coaster + LogFlume, bounding boxes DISJOINT ✓
 * GATE   <Gate position=[-4.8, 63.6]> (front edge, z = 1.2·round((128/2−0.8)/1.2))
 *        → first queue tail node 48 [2.4, 61.2] (Teacups): street walk
 *        2.4 + 7.2 = 9.6 u ≤ 15 ✓
 * FLAG   Coaster "Cinder Spine" start [8.4, 0.55, -27.6] heading 0, steel, cars 3,
 *        NO bank prop (steel builds 0.7 and saturates at its 55° cap)
 *        pieces: station · lift 2.8 · turnR 90 r3 · drop 2.8 · loopR r1.0 ·
 *                hill 0.7 · turnR 90 r4 · straight 14.52 · turnR 90 r4 ·
 *                straight 19.09 · turnR 90 r4 · straight 1.3
 *        ONE INVERSION (vertical loop). Crest arithmetic done BEFORE authoring:
 *        lift crest y 3.35, loop top y 0.55 + 2R = 2.55, Δh 0.80, so crest G ≈
 *        4·Δh/R − 1 ≈ +2.2 g — the train stays pressed INTO the rails ✓
 *        Last authored point [8.4, -27.9] = a 1.3-u STRAIGHT brake tail landing
 *        0.3 u SHORT of the start on the station axis, heading +z = the entry
 *        heading, so the Dubins closure has ~nothing to synthesize ✓
 *        rateCoaster(bank 0.7, cars 3) MEASURED at module scope and logged —
 *        E / I / N / maxLatG / inversions / synthesized all printed by
 *        verifyCircuit(); the mount is GATED on report.fatal, on
 *        checkCoasterDesign violations and on maxLatG ≤ 1.275 (1.5 g × 0.85)
 *        CORRIDOR KEEP-OUT: the circuit's four legs are x 8.4 (z -27.6…-12.5),
 *        z -9.5 (x 11.4…25.5), x 35.5 (z -14.7…-29.2), z -33.2 (x 12.4…31.5).
 *        Every authored street node and every set-piece rect sits OUTSIDE them —
 *        nearest approach is node 42 [7.2, -33.6] at 5.2 u ✓
 * STREET buildParkNet called EXACTLY ONCE ✓ · the SAME NET feeds <Paths>,
 *        keepDryOf() and every offPathCell / place() call ✓
 *        PORT-REFS: 7 pieces → 12 'id:PORT' refs in EDGES, every piece wired,
 *        counted by assertPieceWiring() ✓ · <Boulevard> deliberately unused, so
 *        there is no prunable:false chain end to leave dangling
 *        every ride pad returned BY offPathCell inside place(), never a raw
 *        tail + out·d sum ✓ · clear = padMarginOf(rig) off the published table ✓
 * MONO   ring VERBATIM (17 pieces, the tail split 33.5 + 1.5 — merged it emits a
 *        midpoint, the end point is popped and closure.gap reads 17.80: FATAL)
 *        position [-42.6, 0, -3.7] = the START POSE, rotation 0 — NEVER
 *        start/heading (they are swept into ...rest and silently dropped, which
 *        mounts the whole ring at the origin with a clean report)
 *        4 platforms: W [-42.6,-2.4] · N [0,40.2] · E [42.6,-2.4] · S [0,-45.0]
 *        tails [-36.0,-2.4] · [0,46.8] · [36.0,-2.4] · [0,-51.6] — all four are
 *        AUTHORED NODES and all four are LEAVES (degree 1), asserted by
 *        assertLeaves(): a street continuing past a tail runs through the deck
 *        The N tail queues OUTWARD and the S approach comes around the x = -12.0
 *        column to z -51.6, so no street ends on a deck cell ✓
 *        worldsTouched is NOT claimed: 4 decks cannot cover 5 declared worlds, so
 *        every world also gets its own path spur (see WORLDS rows) ✓
 * QUEUE  ONE ROW PER RIDE — the tail is the AUTHORED NODE, the pad is DERIVED
 *        from it by place() (never the reverse), and place() asserts the reach:
 *        Coaster           cap 4  tail [  2.4,-27.6]  dir [-1, 0]  <Coaster> lane
 *        Teacups           cap 4  tail [  2.4, 61.2]  out [ 0,-1]
 *        FerrisWheel       cap 4  tail [-33.6, 15.6]  out [ 0, 1]
 *        AetherBalloons    cap 4  tail [-24.0,  3.6]  out [ 0,-1]
 *        BoilerBurst       cap 4  tail [-38.4,  3.6]  out [ 0,-1]
 *        Carousel          cap 4  tail [ 24.0,  3.6]  out [ 0,-1]
 *        LaunchedFreefall  cap 4  tail [ 38.4,  3.6]  out [ 0,-1]
 *        Discotron         cap 4  tail [-24.0, 46.8]  out [-1, 0]
 *        GhostTrain        cap 6  tail [-57.6, 61.2]  out [ 0,-1]
 *        Chairlift         cap 6  tail [-48.0, 33.6]  out [-1, 0]
 *        PirateShip        cap 4  tail [ -7.2,-25.2]  out [-1, 0]
 *        LogFlume          cap 6  tail [ 24.0,-51.6]  out [ 1, 0]  clear 7.30
 *        Monorail          cap 8  tail [  0.0, 46.8]  explicit queue anchor
 *        no two rides share a tail node (assertUniqueTails) and every tail is in
 *        NODES ✓ · clear = padMarginOf(rig), never the 3.2 default by guess ✓
 * GROUND every pad, its huts, its tail and its exit join are re-tested IN THE TREE
 *        by <DryReceipt> against the gate's own min-ground-over-footprint-ring
 *        predicate (> WATER_LEVEL + 0.05 = -0.21) and by bumpAt ≤ 0.75 at author
 *        time inside assertPadFlat ✓ · no causeway: the whole street lattice is
 *        authored on one dry median band, no nodeY ramps ✓
 * SPREAD built bbox x[-60.9, 38.1] × z[-62.5, 61.2] = 99 × 124 ≥ 70 × 45 ✓
 *        street-node bbox x[-57.6, 38.4] z[-51.6, 63.6] → pathExtent ≥ 0.55 ✓
 * PLAZAS 7 rects from NET.plazas — hub 10.8×10.8 = 116.6 u², coveHub 8.4×8.4 =
 *        70.6 u², five bazaar courts 8.4×3.6 = 30.2 u² each → largest ≥ 8 ✓ and
 *        the 116.6 / 30.2 spread ≥ 1.8 ✓
 *        NO set-piece `position` appears in NODES or as a queue tail — every
 *        connection is a 'pieceId:PORT' ref, asserted by assertNodesOffPieces()
 *        over the authored nodes AND again over the derived PADS ✓
 * NODES  49 authored · degree-1: 14, every one of them a monorail deck tail or a
 *        ride queue tail (assertLeaves) · one park-spanning loop is NOT claimed:
 *        this net is a spine + five district trees, so gridRegularity is carried
 *        by the varied spans below rather than by a cycle
 * ATTACH ONE ROW PER SPUR — every spur here is level (no nodeY anywhere in the
 *        file), so |Δy|/len = 0 ≤ 0.417 on every edge and the reachability walk
 *        seeds on the whole street. No span crosses a dip or a bank: the water
 *        walk above keeps every node off both basins, so <Paths> has no reason to
 *        REFUSE a span and separate the graph. accessibility.allRidesReachable is
 *        the number to read in the console ✓
 * LATTICE authored spans 2.4 / 3.6 / 4.8 / 6.0 / 7.2 / 9.6 / 10.8 / 12.0 / 13.2 /
 *        15.6 / 19.2 u + the set-pieces' own 1.2 chains → effectiveClasses ≥ 4 ✓
 *        the 1.2-u chain share is bounded by the seven set-piece sub-nets ✓
 * ROSTER 13 rides / 5 categories / 15 stalls (7 kinds: emberRoast, goggles,
 *        sushi, honeywitch, neonSlush, burger, hotDog, soda, cottonCandy,
 *        balloon) / 5 restrooms (one per bazaar, on by default) / bins from
 *        NET.bins ✓
 *        NAMED: every ride carries an authored `register.name`, and every bazaar
 *        passes `names` so not one stall ships under its catalog defaultName ✓
 *        <Park roster={{ rides: [...13 names], stalls: 15, categories: 5 }}>
 *        MOUNTED — without the PROP preflight refuses to bundle and nothing
 *        renders at all ✓
 * DRESS  40 tree cells + 125 themed scenery cells + 14 neutral props authored
 *        against the ≥ 32 tree / ≥ 16 scenery floors, and OVER-PROVISIONED because
 *        <DryScatter> DROPS rather than fixes ✓
 *        EVERY prop cell comes out of offPathCell (clear 1.2, trees 0.75) and is
 *        additionally rejected when it lands on a set-piece rect, a ride pad, a
 *        landmark disc or the monorail beam's keep-out band ✓
 * NIGHT  6 <Lights> runs · 3 <Neon> marquees · 4 <Torch> · the five giants'
 *        night-gated emissive (dragon eggs, mirror ball, furnace plume) — every
 *        real PointLight is night-gated through nightKOf, so the Stage sheds them
 *        by day ✓
 * GATE   parkAssertFlush() prints ONE numbered block and NEVER throws — a
 *        blocking finding drops the offending PIECE and ships the rest, because
 *        aborting the park scores 0 on all 16 axes while a visible defect costs a
 *        few points. validatePark → read report.ok / report.failures /
 *        report.warnings in the console.
 * ═══════════════════════════════════════════════════════════════════════════════ */
import React from 'react';
import * as THREE from 'three';

import type { V3, XZ } from './components/Park';
import {
  Park,
  GameManager,
  Terrain,
  Paths,
  Gate,
  Coaster,
  ThemeRegion,
  Scenery,
  Lights,
  Torch,
  Neon,
  Placed,
  usePark,
  offPathCell,
} from './components/Park';
import type { TrackPiece } from './components/SplineRideKit';
import {
  compileTrackPieces,
  rateCoaster,
  checkCoasterDesign,
} from './components/SplineRideKit';
import { laneLenOf, parkComposition } from './components/ParkBuilder';
import type { NetRef, SetPiecePlan } from './components/SetPieceKit';
import {
  buildParkNet,
  worldPlan,
  World,
  FIRE,
  STEAMPUNK,
  PIRATE_BEACH,
  ENCHANTED_FOREST,
  NEON_CITY,
} from './components/SetPieceKit';
import { WorldLandmark } from './components/WorldLandmark';
import { FountainPlaza, fountainPlazaPlan } from './components/FountainPlaza';
import { Bazaar, bazaarPlan } from './components/Bazaar';
import { tree } from './components/Kit';

import { Monorail } from './components/Monorail';
import { LogFlume } from './components/LogFlume';
import { Chairlift } from './components/Chairlift';
import { GhostTrain } from './components/GhostTrain';
import { FerrisWheel } from './components/FerrisWheel';
import { Carousel } from './components/Carousel';
import { Teacups } from './components/Teacups';
import { PirateShip } from './components/PirateShip';
import { Discotron } from './components/Discotron';
import { AetherBalloons } from './components/AetherBalloons';
import { BoilerBurst } from './components/BoilerBurst';
import { LaunchedFreefall } from './components/LaunchedFreefall';

import { Fumarole, ObsidianShards, BasaltColumns, LavaFissure, CharredSnag } from './components/EmberfallScenery';
import { WreckedHull, CoralCluster, AnchorPile, TidePool, DockPilings } from './components/TidewaterScenery';
import { GiantGear, SteamPipes, ClockTower, BoilerTank, CoalCart } from './components/BrassworkScenery';
import { GiantToadstools, StandingStones, LanternTree, RuinedArch, FlowerPodBed } from './components/ThornwickScenery';
import { MagicMirror } from './components/MagicMirror';
import { NeonArch, SpeakerStack, MirrorBallPylon, LaserTruss, LightTiles } from './components/PulseScenery';
import { BigPiano } from './components/BigPiano';

/* ── §0-P.5 the assertion bus — REPORTS EVERYTHING, THROWS NOTHING ───────────── */
type Sev = 'blocking' | 'advisory';
const PARK_FAILS: { name: string; detail: string; sev: Sev }[] = [];
function parkAssert(name: string, cond: boolean, detail: string, sev: Sev = 'advisory'): boolean {
  if (!cond) PARK_FAILS.push({ name, detail, sev });
  return cond;
}
function parkAssertFlush(): void {
  if (!PARK_FAILS.length) {
    console.log('[park] assertions: all pass');
    return;
  }
  const blocking = PARK_FAILS.filter((f) => f.sev === 'blocking');
  console.error(
    `[park] ${PARK_FAILS.length} ASSERTION FAILURE(S) (${blocking.length} blocking):\n` +
      PARK_FAILS.map((f, i) => `  ${i + 1}. [${f.sev}] ${f.name}\n     ${f.detail}`).join('\n'),
  );
  if (blocking.length)
    console.error(
      `[park] ${blocking.length} BLOCKING failure(s) — the offending PIECE is dropped and the ` +
        `rest of the park ships. Aborting would score 0 on all 16 axes.`,
    );
}

/* Hashed-sine PRNG (§12) — deterministic, never Math.random / Date.now. */
const hash01 = (n: number) => {
  const v = Math.sin(n * 12.9898 + 78.233) * 43758.5453;
  return v - Math.floor(v);
};

/* ── plot, seed, and the PRE-guard water row (§0-P.6) ───────────────────────── */
const SIZE = 128;
const SEED = 31;
const CLIMATE = 'temperate' as const;
const CELL = 1.2;
const PEAK_LIMIT = 0.75;

type SeedBasin = { ctr: XZ; box: [number, number, number, number] };
type SeedRow = { dom: SeedBasin; sec: SeedBasin };
const SEED_ROW: SeedRow = {
  dom: { ctr: [-40, -38], box: [-64, -16, -63, -8] },
  sec: { ctr: [17, 40], box: [5, 30, 18, 63] },
};
const inBasinBox = (c: XZ, b: SeedBasin) =>
  c[0] >= b.box[0] && c[0] <= b.box[1] && c[1] >= b.box[2] && c[1] <= b.box[3];
const offRow = (c: XZ, row: SeedRow = SEED_ROW, nearR = 12) =>
  [row.dom, row.sec].every(
    (b) => !inBasinBox(c, b) && Math.hypot(c[0] - b.ctr[0], c[1] - b.ctr[1]) >= nearR,
  );
const snap = (v: number) => +(Math.round(v / CELL) * CELL).toFixed(2);
const snapXZ = (c: XZ): XZ => [snap(c[0]), snap(c[1])];

/* ── §0-P.4 the monorail ring, VERBATIM, and its 16 cells ───────────────────── */
const RING_DZ = 6.0;
const RZ = -8.4 + RING_DZ;
const NZ = 34.2 + RING_DZ;
const SZ = -51.0 + RING_DZ;
const RING_START: V3 = [-42.6, 0.55, -9.7 + RING_DZ];

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

const MONO_DECKS: XZ[] = [
  [-42.6, RZ],
  [0, NZ],
  [42.6, RZ],
  [0, SZ],
];
const MONO_TAILS: XZ[] = [
  [-36.0, RZ],
  [0, NZ + 6.6],
  [36.0, RZ],
  [0, SZ - 6.6],
];
const RING_CELLS: XZ[] = [
  ...MONO_DECKS,
  [RING_START[0], RING_START[2]],
  ...MONO_TAILS,
  [-40.81, RZ],
  [40.81, RZ],
  [0, NZ + 1.79],
  [0, SZ - 1.79],
  [-1.2, NZ - 1.17],
  [41.43, RZ + 1.2],
  [1.2, SZ + 1.17],
];
const RING_WET = RING_CELLS.filter((c) => !offRow(c));
parkAssert(
  'ringWater',
  RING_WET.length === 0,
  `${RING_WET.length} monorail ring cell(s) sit on the pinned seed row's water at RING_DZ ` +
    `${RING_DZ}: ${JSON.stringify(RING_WET)} — sweep dz further before pinning the seed.`,
  'blocking',
);
/* The beam is a KEEP-OUT BAND, not four points: the ring registers a footprint rect
 * for every span, so treat the whole rectangle border as ~3 u wide. */
const BEAM_BANDS = [
  { cx: -42.6, cz: (NZ + SZ) / 2, hx: 1.6, hz: (NZ - SZ) / 2 },
  { cx: 42.6, cz: (NZ + SZ) / 2, hx: 1.6, hz: (NZ - SZ) / 2 },
  { cx: 0, cz: NZ, hx: 37, hz: 1.6 },
  { cx: 0, cz: SZ, hx: 37, hz: 1.6 },
];

/* ── the flagship circuit — AUTHORED, then VERIFIED at module scope ─────────── */
const LAT_GUARD = 1.275; // 1.5 g derail × 0.85 — physics, not a rubric target
const FLAG_START: V3 = [8.4, 0.55, -27.6];
const FLAG_PIECES: TrackPiece[] = [
  'station',
  { type: 'lift', height: 2.8 },
  { type: 'turnR', angle: 90, radius: 3 },
  { type: 'drop', height: 2.8 },
  { type: 'loopR', radius: 1.0 },
  { type: 'hill', height: 0.7 },
  { type: 'turnR', angle: 90, radius: 4 },
  { type: 'straight', length: 14.52 },
  { type: 'turnR', angle: 90, radius: 4 },
  { type: 'straight', length: 19.09 },
  { type: 'turnR', angle: 90, radius: 4 },
  { type: 'straight', length: 1.3 },
];
/* A rectangle that WORKS beats a novel circuit that renders translucent red. */
const FLAG_FALLBACK: TrackPiece[] = [
  'station',
  { type: 'lift', height: 1.6 },
  { type: 'straight', length: 4.0 },
  { type: 'turnR', angle: 90, radius: 2.5 },
  { type: 'drop', height: 1.6 },
  { type: 'turnR', angle: 90, radius: 2.5 },
  { type: 'straight', length: 6.0 },
  { type: 'turnR', angle: 90, radius: 2.5 },
  { type: 'straight', length: 8.0 },
  { type: 'turnR', angle: 90, radius: 2.5 },
  { type: 'straight', length: 1.3 },
];

function verifyCircuit(
  label: string,
  pieces: TrackPiece[],
  start: V3,
  type: 'steel' | 'wooden' = 'steel',
) {
  const out = compileTrackPieces(pieces, { type, start, heading: 0, bounds: SIZE });
  const rating = rateCoaster(out.points, { type, bank: 0.7, cars: 3 });
  const design = checkCoasterDesign(out.points as any, { type } as any);
  const violations = (design && (design as any).violations) || [];
  const hard = violations.filter((v: any) => !v.warning);
  const ok =
    !!out.report.ok && !out.report.fatal && rating.maxLatG <= LAT_GUARD && hard.length === 0;
  console.log(`[park] ${label}:`, {
    E: rating.excitement,
    I: rating.intensity,
    N: rating.nausea,
    maxLatG: rating.maxLatG,
    highestDrop: rating.highestDrop,
    airtime: rating.airtimeSeconds,
    inversions: rating.inversions,
    band: rating.ratingBand,
    synthesized: out.report.closure && (out.report.closure as any).synthesized,
    ok,
  });
  if (!ok)
    console.error(
      `[park] ${label} FAILED verification — ${
        out.report.fatal ??
        hard.map((v: any) => v.kind).join(', ') ??
        `maxLatG ${rating.maxLatG}`
      }`,
    );
  return { ok, points: out.points, rating };
}

const FLAG = verifyCircuit('Cinder Spine (authored)', FLAG_PIECES, FLAG_START);
const FLAG_ALT = FLAG.ok ? null : verifyCircuit('Cinder Spine (fallback)', FLAG_FALLBACK, FLAG_START);
const FLAG_USED = FLAG.ok ? FLAG_PIECES : FLAG_FALLBACK;
const FLAG_PTS = (FLAG.ok ? FLAG : FLAG_ALT ?? FLAG).points as V3[];
parkAssert(
  'flagshipCircuit',
  FLAG.ok || !!(FLAG_ALT && FLAG_ALT.ok),
  'neither the authored flagship nor its fallback compiled clean — the coaster will render ' +
    'as invalid track and will NOT register. Every other ride still ships.',
  'blocking',
);

const MONO_COMPILED = compileTrackPieces(MONO_PIECES, {
  profile: 'monorail',
  start: RING_START,
  heading: 0,
  bounds: SIZE,
});
console.log('[park] Three Crowns Skyline (monorail ring):', {
  ok: MONO_COMPILED.report.ok,
  fatal: MONO_COMPILED.report.fatal,
  closure: MONO_COMPILED.report.closure,
});
const RING_OK = parkAssert(
  'ringCircuit',
  !MONO_COMPILED.report.fatal,
  `the verbatim monorail ring reported ${MONO_COMPILED.report.fatal} — SHIPPING WITHOUT THE ` +
    `RING; transport still comes from <Chairlift>.`,
  'blocking',
) && RING_WET.length === 0;

const ALL_COASTER_PTS: V3[] = [...FLAG_PTS, ...((MONO_COMPILED.points as V3[]) ?? [])];

/* ── set-piece plans (PLAN FIRST, MOUNT SECOND) ─────────────────────────────── */
const HUB = fountainPlazaPlan({
  id: 'hub',
  title: 'Crown Circus',
  position: [0, 15.6],
  tiles: 9,
  ports: ['N', 'E', 'S', 'W'],
  stringLights: 'all',
  seed: 3,
});
const COVE_HUB = fountainPlazaPlan({
  id: 'coveHub',
  title: 'Salt Quay',
  position: [0, -33.6],
  tiles: 7,
  ports: ['N', 'E', 'W'],
  theme: PIRATE_BEACH,
  seed: 5,
});
const EMBER_ROW = bazaarPlan({
  id: 'emberRow',
  title: 'Cinder Row',
  position: [33.6, 9.6],
  stalls: ['emberRoast', 'burger', 'soda'],
  names: ['Slagworks Grill', 'Ashfall Burgers', 'Basalt Sodas'],
  theme: FIRE,
  seed: 7,
});
const FOUNDRY_ROW = bazaarPlan({
  id: 'foundryRow',
  title: 'Gasket Lane',
  position: [-33.6, 9.6],
  stalls: ['goggles', 'hotDog', 'soda'],
  names: ['Fettle & Flange', 'Piston Dogs', 'Pressure Drop Sodas'],
  theme: STEAMPUNK,
  seed: 11,
});
const GLADE_ROW = bazaarPlan({
  id: 'gladeRow',
  title: 'Moss Market',
  position: [-52.8, 45.6],
  stalls: ['honeywitch', 'cottonCandy', 'soda'],
  names: ['The Honeywitch', 'Spindle Floss', 'Dewfall Sodas'],
  theme: ENCHANTED_FOREST,
  lamps: false,
  seed: 13,
});
const PULSE_ROW = bazaarPlan({
  id: 'pulseRow',
  title: 'Strobe Arcade',
  position: [-24.0, 51.6],
  stalls: ['neonSlush', 'balloon', 'soda'],
  names: ['Subwoofer Slush', 'Helium Hi-Fi', 'Chrome Sodas'],
  theme: NEON_CITY,
  seed: 17,
});
const COVE_ROW = bazaarPlan({
  id: 'coveRow',
  title: 'Tideline Row',
  position: [12.0, -40.8],
  stalls: ['sushi', 'cottonCandy', 'hotDog'],
  names: ['Broken Anchor Sushi', 'Sea Foam Floss', 'Bosun Dogs'],
  theme: PIRATE_BEACH,
  seed: 19,
});
const ALL_PLANS: SetPiecePlan[] = [
  HUB,
  COVE_HUB,
  EMBER_ROW,
  FOUNDRY_ROW,
  GLADE_ROW,
  PULSE_ROW,
  COVE_ROW,
];

/* ── the street skeleton — authored NODES, then ONE buildParkNet fuse ────────── */
const NODES: XZ[] = [
  /*  0 */ [-4.8, 63.6],
  /*  1 */ [-4.8, 61.2],
  /*  2 */ [-4.8, 51.6],
  /*  3 */ [-10.8, 51.6],
  /*  4 */ [-10.8, 46.8],
  /*  5 */ [0, 46.8],
  /*  6 */ [-19.2, 46.8],
  /*  7 */ [-24.0, 46.8],
  /*  8 */ [-10.8, 33.6],
  /*  9 */ [-10.8, 27.6],
  /* 10 */ [-10.8, 21.6],
  /* 11 */ [-19.2, 61.2],
  /* 12 */ [-32.4, 61.2],
  /* 13 */ [-48.0, 61.2],
  /* 14 */ [-57.6, 61.2],
  /* 15 */ [-48.0, 33.6],
  /* 16 */ [-13.2, 15.6],
  /* 17 */ [-25.2, 15.6],
  /* 18 */ [-28.8, 15.6],
  /* 19 */ [-33.6, 15.6],
  /* 20 */ [-28.8, 3.6],
  /* 21 */ [-24.0, 3.6],
  /* 22 */ [-33.6, 3.6],
  /* 23 */ [-38.4, 3.6],
  /* 24 */ [-33.6, -2.4],
  /* 25 */ [-36.0, -2.4],
  /* 26 */ [13.2, 15.6],
  /* 27 */ [25.2, 15.6],
  /* 28 */ [28.8, 15.6],
  /* 29 */ [28.8, 3.6],
  /* 30 */ [24.0, 3.6],
  /* 31 */ [33.6, 3.6],
  /* 32 */ [38.4, 3.6],
  /* 33 */ [33.6, -2.4],
  /* 34 */ [36.0, -2.4],
  /* 35 */ [0, 3.6],
  /* 36 */ [0, -6.0],
  /* 37 */ [0, -16.8],
  /* 38 */ [0, -25.2],
  /* 39 */ [2.4, -25.2],
  /* 40 */ [2.4, -27.6],
  /* 41 */ [-7.2, -25.2],
  /* 42 */ [7.2, -33.6],
  /* 43 */ [-12.0, -33.6],
  /* 44 */ [-12.0, -51.6],
  /* 45 */ [0, -51.6],
  /* 46 */ [16.8, -51.6],
  /* 47 */ [24.0, -51.6],
  /* 48 */ [2.4, 61.2],
];
const EDGES: [NetRef, NetRef][] = [
  [0, 1],
  [1, 2],
  [2, 3],
  [3, 4],
  [4, 5],
  [4, 6],
  [6, 7],
  [6, 'pulseRow:E'],
  [4, 8],
  [8, 9],
  [9, 10],
  [10, 'hub:N'],
  [1, 48],
  [1, 11],
  [11, 12],
  [12, 13],
  [13, 14],
  [13, 'gladeRow:E'],
  ['gladeRow:E', 15],
  ['hub:W', 16],
  [16, 17],
  [17, 18],
  [18, 19],
  [18, 'foundryRow:E'],
  ['foundryRow:E', 20],
  [20, 21],
  [20, 22],
  [22, 23],
  [22, 24],
  [24, 25],
  ['hub:E', 26],
  [26, 27],
  [27, 28],
  [28, 'emberRow:W'],
  ['emberRow:W', 29],
  [29, 30],
  [29, 31],
  [31, 32],
  [31, 33],
  [33, 34],
  ['hub:S', 35],
  [35, 36],
  [36, 37],
  [37, 38],
  [38, 39],
  [39, 40],
  [38, 41],
  [38, 'coveHub:N'],
  ['coveHub:E', 42],
  [42, 'coveRow:W'],
  ['coveHub:W', 43],
  [43, 44],
  [44, 45],
  ['coveRow:E', 46],
  [46, 47],
];

const NET = buildParkNet({
  nodes: NODES,
  edges: EDGES,
  pieces: ALL_PLANS,
  keepDry: [...RING_CELLS],
});
if (NET.warnings && NET.warnings.length)
  parkAssert(
    'netWarnings',
    false,
    `buildParkNet reported ${NET.warnings.length} lint(s): ${JSON.stringify(NET.warnings)}`,
    'advisory',
  );

/* every EDGES pair must be CARDINAL — buildParkNet REPAIRS a diagonal with a
 * synthesised elbow, so this is advisory: it must never blank the page. */
const portCell = (ref: NetRef): XZ => {
  if (typeof ref === 'number') return NODES[ref];
  const [id, name] = String(ref).split(':');
  const p = ALL_PLANS.find((q) => q.id === id);
  if (!p) {
    parkAssert('unknownPortRef', false, `EDGES references '${ref}' but no plan has id '${id}'`);
    return [0, 0];
  }
  return p.port(name) as XZ;
};
const EPS = 1e-6;
EDGES.forEach(([a, b]) => {
  const A = portCell(a);
  const B = portCell(b);
  parkAssert(
    'cardinalEdge',
    Math.abs(A[0] - B[0]) < EPS || Math.abs(A[1] - B[1]) < EPS,
    `edge ${String(a)}→${String(b)} is DIAGONAL: [${A}] → [${B}] — buildParkNet elbows it ` +
      `through a synthesised corner you did not plan. Fix the table.`,
    'advisory',
  );
});

/* every set-piece must be wired, and a non-prunable chain end must be wired too */
const PORT_REFS = EDGES.flat().filter((x): x is string => typeof x === 'string');
parkAssert(
  'portRefCount',
  PORT_REFS.length === 12,
  `the header claims 12 'id:PORT' refs, EDGES carries ${PORT_REFS.length}`,
);
ALL_PLANS.forEach((p) => {
  const wired = new Set(
    PORT_REFS.filter((r) => r.split(':')[0] === p.id).map((r) => r.split(':')[1]),
  );
  parkAssert(
    'pieceIsland',
    wired.size > 0,
    `set-piece '${p.id}' has NO '${p.id}:<PORT>' ref in EDGES — it composes as an ISLAND`,
    'blocking',
  );
  (p.ports || []).forEach((pt: any) => {
    if (pt.prunable !== false) return;
    parkAssert(
      'chainEnd',
      wired.has(pt.name),
      `chain piece '${p.id}' (${p.kind}) never wires structural end '${pt.name}' — that ` +
        `carriageway dead-ends in grass`,
    );
  });
});

/* a set-piece `position` is its SOLID CENTRE — never a node, never a queue tail */
const SOLID_CLEAR: Record<string, number> = { FountainPlaza: 1.8, Bazaar: 0.6, Boulevard: 0 };
function assertNodesOffPieces(cells: XZ[], plans: SetPiecePlan[], label: string): void {
  const hits: string[] = [];
  plans.forEach((p) => {
    const clear = SOLID_CLEAR[p.kind] ?? 1.8;
    if (clear === 0) return;
    const ports = new Set(
      (p.ports || []).map((pt: any) => `${pt.at[0].toFixed(2)},${pt.at[1].toFixed(2)}`),
    );
    const f: any = p.footprint;
    const c = Math.cos(-(f.yaw ?? 0));
    const s = Math.sin(-(f.yaw ?? 0));
    cells.forEach((n, i) => {
      if (ports.has(`${n[0].toFixed(2)},${n[1].toFixed(2)}`)) return;
      const dx = n[0] - f.cx;
      const dz = n[1] - f.cz;
      const lx = dx * c - dz * s;
      const lz = dx * s + dz * c;
      const gap = Math.max(Math.abs(lx) - f.hx, Math.abs(lz) - f.hz);
      if (gap < clear - 1e-9)
        hits.push(
          `[${n[0]}, ${n[1]}] (${label} ${i}) is ${gap.toFixed(2)} u from '${p.id}' ` +
            `(${p.kind}) — needs ${clear}`,
        );
    });
  });
  parkAssert(
    'nodeInSolid',
    !hits.length,
    `${hits.length} ${label} cell(s) stand inside or against a set-piece's SOLID footprint:\n  ` +
      hits.join('\n  '),
  );
}
assertNodesOffPieces(NODES, ALL_PLANS, 'node');

/* ── §0-P.6 the guard list is DERIVED from the FUSE'S OUTPUT, never NODES.slice() */
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
const GUARDS = keepDryOf(NET, SEED_ROW);
console.log(
  `[park] guards: ${NET.keepDry.length} fused cells → ${GUARDS.length} kept ` +
    `(${NET.nodes.length} street nodes, ${NET.edges.length} edges)`,
);

/* ── terrain composition: BARE vs GUARDED, diffed both ways ─────────────────── */
const BARE = parkComposition(THREE as any, SEED, SIZE, CLIMATE);
const COMP = parkComposition(THREE as any, SEED, SIZE, CLIMATE, {
  keepDry: GUARDS,
  coasterPts: ALL_COASTER_PTS,
} as any);
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
  `guards moved a water body off the pinned row — dominant ${JSON.stringify(
    BARE.waterCentre,
  )} → ${JSON.stringify(COMP.waterCentre)}, secondary ${JSON.stringify(
    BARE.waterCentreSecond,
  )} → ${JSON.stringify(COMP.waterCentreSecond)}, terrainSeed ${BARE.terrainSeed} → ${
    COMP.terrainSeed
  }`,
);
const rf: any = (COMP as any).report && (COMP as any).report.reliefFloor;
parkAssert(
  'terrainFlattened',
  !rf || rf.kept >= rf.floor,
  rf
    ? `keepDry FLATTENED the seed: relief ${rf.authoredRelief?.toFixed(2)} → ${rf.relief?.toFixed(
        2,
      )} (kept ${rf.kept?.toFixed(2)} against the ${rf.floor} floor), stdH ${rf.authoredStdH?.toFixed(
        2,
      )} → ${rf.stdH?.toFixed(2)}; ranges guarded: ${rf.guardedRanges}; capped peaks: ${JSON.stringify(
        rf.cappedPeaks,
      )}`
    : '',
  'advisory',
);
console.log('[park] composition:', {
  terrainSeed: COMP.terrainSeed,
  probesTried: (COMP as any).report?.probesTried,
  waterBodies: (COMP as any).report?.waterBodies,
  waterAreaU2: (COMP as any).report?.waterAreaU2,
  waterGap: (COMP as any).report?.waterGap,
  reliefFloorKept: rf?.kept,
  violations: (COMP as any).report?.violations,
});

/* ── pad placement: streets FIRST (offPathCell), then TERRAIN (assertPadFlat) ── */
const PAD_MARGIN: Record<string, number> = {
  LavaTubeRun: 23.41, ReefRacer: 22.2, OceanTunnelSlide: 22.14, EmberWings: 16.15,
  WyrmsHollow: 15.99, MagmaRun: 14.22, MineTrainCoaster: 13.99, DeepDrift: 12.65,
  Bassline: 11.59, GearworksExpress: 10.03, MoonlitBarge: 8.23, SplineCoaster: 7.32,
  RiverRapids: 6.6, Bobsleigh: 6.01, MagneticRide: 5.56, LogFlume: 5.36,
  GhostTrain: 4.77, HauntedMansion: 4.77, GoKarts: 4.39, Monorail: 4.02,
  Chairlift: 3.52, Helicycles: 3.42, FlyingSaucers: 3.37, MotionSimulator: 3.2,
  Enterprise: 3.13, PaddleBoats: 3.12, Discotron: 3.07, BoilerBurst: 3.05,
  FerrisWheel: 2.97, AetherBalloons: 2.95, PirateShip: 2.7, TwistRide: 2.65,
  TopSpin: 2.52, Teacups: 2.47, Carousel: 2.4, SwingingInverterShip: 2.35,
  LaunchedFreefall: 2.25, BumperCars: 2.07, SpaceRings: 1.92, SwingRide: 1.92,
  DropTower: 1.8, ObservationTower: 1.8,
};
const padMarginOf = (rig: string) => PAD_MARGIN[rig] ?? 3.2;

const isDry = (c: XZ) =>
  [...((COMP as any).basins ?? []), ...((COMP as any).clampBasins ?? [])].every(
    (b: any) => Math.hypot(c[0] - b.x, c[1] - b.z) > 0.74 * b.radius + 0.6,
  );
const bumpAt = (c: XZ) =>
  Math.max(
    0,
    ...((COMP as any).peaks ?? []).map((p: any) => {
      const k = Math.max(0, 1 - Math.hypot(c[0] - p.x, c[1] - p.z) / p.radius);
      return k * k * (3 - 2 * k) * p.height;
    }),
  );
function assertPadFlat(pad: XZ, clear: number, label: string): XZ {
  if (bumpAt(pad) <= PEAK_LIMIT && isDry(pad)) return pad;
  for (let r = 1; r <= 8; r += 1)
    for (let ix = -r; ix <= r; ix += 1)
      for (let iz = -r; iz <= r; iz += 1) {
        if (Math.max(Math.abs(ix), Math.abs(iz)) !== r) continue;
        const c: XZ = [+(pad[0] + ix * 0.6).toFixed(2), +(pad[1] + iz * 0.6).toFixed(2)];
        if (bumpAt(c) > PEAK_LIMIT || !isDry(c)) continue;
        const off = offPathCell(NET as any, c, { clear }) as XZ | null;
        if (off && Math.hypot(off[0] - c[0], off[1] - c[1]) < 1e-6) {
          console.warn(
            `[park] ${label}: pad [${pad}] on a hill flank or wet (bump ${bumpAt(pad).toFixed(
              2,
            )}) — moved to [${c}]`,
          );
          return c;
        }
      }
  parkAssert(
    'padOnFlank',
    false,
    `${label}: pad [${pad}] is on a hill flank (bump ${bumpAt(pad).toFixed(2)} > ${PEAK_LIMIT}) ` +
      `or WET, and no cell within 4.8 u is flat, dry AND ${clear} u off the street.`,
  );
  return pad;
}
const minReachOf = (c: number) => laneLenOf(c) + 0.35 + 0.62 + 0.5 + 0.45;
const yawOf = (dir: XZ) => Math.atan2(dir[0], dir[1]);

type Placement = { pad: XZ; anchor: XZ; dir: XZ; yaw: number; tail: XZ };
function place(tail: XZ, out: XZ, capacity: number, rig: string, clearOverride?: number): Placement {
  const clear = clearOverride ?? padMarginOf(rig);
  const join = laneLenOf(capacity) + 0.35;
  const reach = minReachOf(capacity) + 2.4;
  const cand: XZ = [+(tail[0] + out[0] * reach).toFixed(2), +(tail[1] + out[1] * reach).toFixed(2)];
  const onStreet = (offPathCell(NET as any, cand, { clear }) ?? cand) as XZ;
  const pad = assertPadFlat(onStreet, clear, rig);
  const got = Math.hypot(pad[0] - tail[0], pad[1] - tail[1]);
  if (got < minReachOf(capacity) + 1.2)
    parkAssert(
      'padReach',
      false,
      `${rig}: pad [${pad}] sits ${got.toFixed(2)} u from its tail [${tail}] — the cap-${capacity} ` +
        `floor is ${(minReachOf(capacity) + 1.2).toFixed(2)} u. Open the court or drop the ride; ` +
        `do NOT lower the clearance.`,
    );
  const dir: XZ = [-out[0], -out[1]];
  return {
    pad,
    anchor: [+(tail[0] + out[0] * join).toFixed(2), +(tail[1] + out[1] * join).toFixed(2)],
    dir,
    yaw: yawOf(dir),
    tail,
  };
}

const T_TEACUPS: XZ = [2.4, 61.2];
const T_WHEEL: XZ = [-33.6, 15.6];
const T_BALLOON: XZ = [-24.0, 3.6];
const T_BOILER: XZ = [-38.4, 3.6];
const T_CAROUSEL: XZ = [24.0, 3.6];
const T_FREEFALL: XZ = [38.4, 3.6];
const T_DISCO: XZ = [-24.0, 46.8];
const T_GHOST: XZ = [-57.6, 61.2];
const T_CHAIR: XZ = [-48.0, 33.6];
const T_SHIP: XZ = [-7.2, -25.2];
const T_FLUME: XZ = [24.0, -51.6];
const T_FLAG: XZ = [2.4, -27.6];
const T_MONO: XZ = MONO_TAILS[1];

const P_TEACUPS = place(T_TEACUPS, [0, -1], 4, 'Teacups');
const P_WHEEL = place(T_WHEEL, [0, 1], 4, 'FerrisWheel');
const P_BALLOON = place(T_BALLOON, [0, -1], 4, 'AetherBalloons');
const P_BOILER = place(T_BOILER, [0, -1], 4, 'BoilerBurst');
const P_CAROUSEL = place(T_CAROUSEL, [0, -1], 4, 'Carousel');
const P_FREEFALL = place(T_FREEFALL, [0, -1], 4, 'LaunchedFreefall');
const P_DISCO = place(T_DISCO, [-1, 0], 4, 'Discotron');
const P_GHOST = place(T_GHOST, [0, -1], 6, 'GhostTrain');
const P_CHAIR = place(T_CHAIR, [-1, 0], 6, 'Chairlift');
const P_SHIP = place(T_SHIP, [-1, 0], 4, 'PirateShip');
const P_FLUME = place(T_FLUME, [1, 0], 6, 'LogFlume', 7.3);

const MONO_CAP = 8;
const MONO_ANCHOR: XZ = [0, +(T_MONO[1] - (laneLenOf(MONO_CAP) + 0.35)).toFixed(2)];
const MONO_QUEUE_DIR: XZ = [0, 1];

const ALL_TAILS: XZ[] = [
  T_TEACUPS, T_WHEEL, T_BALLOON, T_BOILER, T_CAROUSEL, T_FREEFALL, T_DISCO,
  T_GHOST, T_CHAIR, T_SHIP, T_FLUME, T_FLAG, T_MONO,
];
const TAIL_KEYS = new Set(ALL_TAILS.map((c) => `${c[0]},${c[1]}`));
parkAssert(
  'queueTailShared',
  TAIL_KEYS.size === ALL_TAILS.length,
  `two rides share a queue tail cell — one cell cannot be the entrance to two queues`,
  'blocking',
);
ALL_TAILS.forEach((c) => {
  parkAssert(
    'tailNotAuthored',
    NODES.some((n) => Math.abs(n[0] - c[0]) < EPS && Math.abs(n[1] - c[1]) < EPS),
    `queue tail [${c}] is not in NODES — a tail must be an AUTHORED street node`,
    'blocking',
  );
});
/* all four monorail deck tails, and every ride tail, must be street LEAVES */
const DEGREE = new Map<string, number>();
EDGES.forEach(([a, b]) => {
  [portCell(a), portCell(b)].forEach((c) => {
    const k = `${c[0]},${c[1]}`;
    DEGREE.set(k, (DEGREE.get(k) ?? 0) + 1);
  });
});
[...MONO_TAILS, ...ALL_TAILS].forEach((c) => {
  const d = DEGREE.get(`${c[0]},${c[1]}`) ?? 0;
  parkAssert(
    'tailNotLeaf',
    d === 1,
    `tail [${c}] has street degree ${d}, not 1 — a street continuing past a tail runs ` +
      `through the deck / the boarding pad`,
  );
});

const PADS: XZ[] = [
  P_TEACUPS.pad, P_WHEEL.pad, P_BALLOON.pad, P_BOILER.pad, P_CAROUSEL.pad,
  P_FREEFALL.pad, P_DISCO.pad, P_GHOST.pad, P_CHAIR.pad, P_SHIP.pad, P_FLUME.pad,
];
assertNodesOffPieces(PADS, ALL_PLANS, 'pad');
/* pad-to-pad pitch: a FLOOR, not a target (axis 3 scores the OBB EDGE gap) */
PADS.forEach((a, i) =>
  PADS.slice(i + 1).forEach((b) => {
    const d = Math.hypot(a[0] - b[0], a[1] - b[1]);
    parkAssert(
      'padPitch',
      d >= 6,
      `ride pads [${a}] and [${b}] are ${d.toFixed(2)} u apart — under the 6 u pitch floor, ` +
        `which usually means the OBB edge gap is under 1.5 u (−2 on axis 3, −0.25 on axis 13)`,
    );
  }),
);

/* ── worlds — the rect is DERIVED from the members + every `include` cell ────── */
type Avoid = { cx: number; cz: number; hx: number; hz: number };
const PIECE_RECTS: Avoid[] = ALL_PLANS.map((p) => {
  const f: any = p.footprint;
  return { cx: f.cx, cz: f.cz, hx: f.hx, hz: f.hz };
});
const PAD_RECTS: Avoid[] = [
  { pad: P_TEACUPS.pad, r: 'Teacups' },
  { pad: P_WHEEL.pad, r: 'FerrisWheel' },
  { pad: P_BALLOON.pad, r: 'AetherBalloons' },
  { pad: P_BOILER.pad, r: 'BoilerBurst' },
  { pad: P_CAROUSEL.pad, r: 'Carousel' },
  { pad: P_FREEFALL.pad, r: 'LaunchedFreefall' },
  { pad: P_DISCO.pad, r: 'Discotron' },
  { pad: P_GHOST.pad, r: 'GhostTrain' },
  { pad: P_CHAIR.pad, r: 'Chairlift' },
  { pad: P_SHIP.pad, r: 'PirateShip' },
  { pad: P_FLUME.pad, r: 'LogFlume' },
].map(({ pad, r }) => ({ cx: pad[0], cz: pad[1], hx: padMarginOf(r), hz: padMarginOf(r) }));
const FLAG_RECTS: Avoid[] = [
  { cx: 8.4, cz: -20.0, hx: 2.4, hz: 9.0 },
  { cx: 18.5, cz: -9.5, hx: 8.0, hz: 2.4 },
  { cx: 35.5, cz: -22.0, hx: 2.4, hz: 9.0 },
  { cx: 22.0, cz: -33.2, hx: 11.0, hz: 2.4 },
];
const LANDMARKS: { id: string; at: XZ; r: number }[] = [
  { id: 'fire', at: [31.2, -8.4], r: 2.75 },
  { id: 'steampunk', at: [-31.2, -6.0], r: 2.6 },
  { id: 'pirateBeach', at: [-9.6, -57.6], r: 3.1 },
  { id: 'enchantedForest', at: [-52.8, 39.6], r: 2.7 },
  { id: 'neon', at: [-33.6, 55.2], r: 3.3 },
];
const LANDMARK_RECTS: Avoid[] = LANDMARKS.map((l) => ({
  cx: l.at[0], cz: l.at[1], hx: l.r, hz: l.r,
}));
const AVOID: Avoid[] = [
  ...PIECE_RECTS, ...PAD_RECTS, ...FLAG_RECTS, ...LANDMARK_RECTS, ...BEAM_BANDS,
];

function scatter(
  rect: [number, number, number, number],
  n: number,
  seed: number,
  clear: number,
  minPitch = 1.8,
): XZ[] {
  const out: XZ[] = [];
  const [x0, x1, z0, z1] = rect;
  for (let k = 0; out.length < n && k < n * 60; k += 1) {
    const cx = snap(x0 + hash01(seed * 131 + k * 7 + 1) * (x1 - x0));
    const cz = snap(z0 + hash01(seed * 977 + k * 13 + 3) * (z1 - z0));
    const c: XZ = [cx, cz];
    if (Math.abs(cx) > 60 || Math.abs(cz) > 60) continue;
    if (!offRow(c)) continue;
    if (bumpAt(c) > PEAK_LIMIT || !isDry(c)) continue;
    if (
      AVOID.some(
        (a) => Math.abs(cx - a.cx) < a.hx + clear && Math.abs(cz - a.cz) < a.hz + clear,
      )
    )
      continue;
    if (out.some((o) => Math.hypot(o[0] - cx, o[1] - cz) < minPitch)) continue;
    const off = offPathCell(NET as any, c, { clear }) as XZ | null;
    if (!off || Math.hypot(off[0] - cx, off[1] - cz) > 1e-6) continue;
    out.push(c);
  }
  return out;
}

const FIRE_CELLS = scatter([25.2, 40.8, -12.0, 16.8], 25, 21, 1.2);
const STEAM_CELLS = scatter([-40.8, -22.8, -7.2, 15.6], 25, 33, 1.2);
const COVE_CELLS = scatter([-14.4, 20.4, -60.0, -28.8], 25, 45, 1.2);
const GLADE_CELLS = scatter([-61.2, -45.6, 21.6, 57.6], 25, 57, 1.2);
const PULSE_CELLS = scatter([-38.4, -7.2, 42.0, 58.8], 25, 69, 1.2);

const FIRE_KINDS = ['Fumarole', 'ObsidianShards', 'BasaltColumns', 'LavaFissure', 'CharredSnag'];
const STEAM_KINDS = ['GiantGear', 'SteamPipes', 'ClockTower', 'BoilerTank', 'CoalCart'];
const COVE_KINDS = ['WreckedHull', 'CoralCluster', 'AnchorPile', 'TidePool', 'DockPilings'];
const GLADE_KINDS = ['GiantToadstools', 'StandingStones', 'LanternTree', 'RuinedArch', 'FlowerPodBed', 'MagicMirror'];
const PULSE_KINDS = ['NeonArch', 'SpeakerStack', 'MirrorBallPylon', 'LaserTruss', 'LightTiles', 'BigPiano'];

const WORLD_DEFS = [
  { id: 'fire', theme: FIRE, pieces: [EMBER_ROW], cells: FIRE_CELLS, kinds: FIRE_KINDS,
    pads: [P_CAROUSEL.pad, P_FREEFALL.pad] },
  { id: 'steampunk', theme: STEAMPUNK, pieces: [FOUNDRY_ROW], cells: STEAM_CELLS, kinds: STEAM_KINDS,
    pads: [P_WHEEL.pad, P_BALLOON.pad, P_BOILER.pad] },
  { id: 'pirateBeach', theme: PIRATE_BEACH, pieces: [COVE_HUB, COVE_ROW], cells: COVE_CELLS, kinds: COVE_KINDS,
    pads: [P_SHIP.pad, P_FLUME.pad] },
  { id: 'enchantedForest', theme: ENCHANTED_FOREST, pieces: [GLADE_ROW], cells: GLADE_CELLS, kinds: GLADE_KINDS,
    pads: [P_GHOST.pad, P_CHAIR.pad] },
  { id: 'neon', theme: NEON_CITY, pieces: [PULSE_ROW], cells: PULSE_CELLS, kinds: PULSE_KINDS,
    pads: [P_DISCO.pad] },
] as const;

const WORLDS = WORLD_DEFS.map((w) => {
  const lm = LANDMARKS.find((l) => l.id === w.id)!;
  return {
    def: w,
    landmark: lm,
    plan: worldPlan({
      id: w.id,
      theme: w.theme as any,
      pieces: w.pieces as any,
      include: [...w.pads, lm.at, ...w.cells] as XZ[],
    }),
  };
});

const rectOf = (cells: XZ[]) => {
  const xs = cells.map((c) => c[0]);
  const zs = cells.map((c) => c[1]);
  const x0 = Math.min(...xs) - 2.4;
  const x1 = Math.max(...xs) + 2.4;
  const z0 = Math.min(...zs) - 2.4;
  const z1 = Math.max(...zs) + 2.4;
  return {
    position: [(x0 + x1) / 2, (z0 + z1) / 2] as XZ,
    extent: [(x1 - x0) / 2, (z1 - z0) / 2] as XZ,
  };
};
const WORLD_RECTS = WORLDS.map((w) =>
  rectOf([...w.def.pads, w.landmark.at, ...w.def.cells] as XZ[]),
);
/* the world-spacing floor binds the CLOSEST pair */
const SPACING_FLOOR = 20 * Math.sqrt(SIZE / 48);
WORLD_RECTS.forEach((a, i) =>
  WORLD_RECTS.slice(i + 1).forEach((b, j) => {
    const d = Math.hypot(a.position[0] - b.position[0], a.position[1] - b.position[1]);
    parkAssert(
      'worldsTooClose',
      d >= SPACING_FLOOR,
      `worlds '${WORLDS[i].def.id}' and '${WORLDS[i + 1 + j].def.id}' centres are ${d.toFixed(
        2,
      )} u apart, under the ${SPACING_FLOOR.toFixed(2)} u floor`,
    );
    const gap = Math.max(
      Math.abs(a.position[0] - b.position[0]) - (a.extent[0] + b.extent[0]),
      Math.abs(a.position[1] - b.position[1]) - (a.extent[1] + b.extent[1]),
    );
    parkAssert(
      'worldRectsTouch',
      gap > 0,
      `world rects '${WORLDS[i].def.id}' and '${WORLDS[i + 1 + j].def.id}' overlap by ${(-gap).toFixed(
        2,
      )} u — touching rects read as ONE district`,
    );
  }),
);
WORLDS.forEach((w) =>
  parkAssert(
    'worldSceneryFloor',
    w.def.cells.length >= 25,
    `world '${w.def.id}' scattered ${w.def.cells.length} themed placements, under the 25 floor — ` +
      `open its rect or relax its avoid list`,
  ),
);

/* ── dressing: trees + neutral props, over-provisioned because the sieve DROPS ─ */
const TREE_CELLS = [
  ...scatter([-58.8, -14.4, 18.0, 58.8], 12, 101, 0.75, 2.4),
  ...scatter([6.0, 39.6, -26.4, 14.4], 12, 103, 0.75, 2.4),
  ...scatter([-40.8, -8.4, -6.0, 14.4], 10, 107, 0.75, 2.4),
  ...scatter([-14.4, 22.8, 20.4, 58.8], 6, 109, 0.75, 2.4),
];
const TREE_SHAPES = ['round', 'pine', 'willow', 'round', 'pine'] as const;
type TreeShape = (typeof TREE_SHAPES)[number];
const TREES: { at: XZ; shape: TreeShape }[] = TREE_CELLS.map((c, i) => ({
  at: c,
  shape: TREE_SHAPES[i % TREE_SHAPES.length],
}));
parkAssert(
  'treeFloor',
  TREES.length >= 32,
  `only ${TREES.length} tree cells survived the scatter, against the 32 floor at size 128`,
);

const NEUTRAL_KINDS = [
  'marbleStatue', 'picnicTable', 'planterBox', 'topiarySpiral', 'signpost',
  'parkClock', 'flagpole', 'gazebo', 'wishingWell', 'birdbath',
  'picnicTable', 'planterBox', 'topiarySpiral', 'signpost',
];
const NEUTRAL_CELLS = scatter([-16.8, 22.8, -22.8, 26.4], 14, 131, 1.2, 3.6);

const THEMED: { at: XZ; kind: string; world: string }[] = WORLD_DEFS.flatMap((w) =>
  w.cells.map((at, i) => ({ at, kind: w.kinds[i % w.kinds.length], world: w.id })),
);
parkAssert(
  'sceneryFloor',
  THEMED.length + NEUTRAL_CELLS.length >= 16,
  `only ${THEMED.length + NEUTRAL_CELLS.length} scenery placements, against the 16 floor`,
);

const SCENERY_MAP: Record<string, React.ComponentType<any>> = {
  Fumarole, ObsidianShards, BasaltColumns, LavaFissure, CharredSnag,
  WreckedHull, CoralCluster, AnchorPile, TidePool, DockPilings,
  GiantGear, SteamPipes, ClockTower, BoilerTank, CoalCart,
  GiantToadstools, StandingStones, LanternTree, RuinedArch, FlowerPodBed, MagicMirror,
  NeonArch, SpeakerStack, MirrorBallPylon, LaserTruss, LightTiles, BigPiano,
};

parkAssertFlush();

/* ── the GATE'S OWN dryness predicate, run IN THE TREE (§0-P.6) ─────────────── */
type ParkCtx = ReturnType<typeof usePark>;
function dryRing(park: ParkCtx, c: XZ, r = 0.75): boolean {
  const g: any = (park as any).ground;
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
  label,
  cells,
  render,
}: {
  label: string;
  cells: T[];
  render: (c: T, i: number) => React.ReactNode;
}) {
  const park = usePark('DryScatter');
  const [dry, setDry] = React.useState<T[] | null>(null);
  React.useEffect(() => {
    const kept = cells.filter((c) => dryRing(park, c.at));
    if (kept.length < cells.length)
      console.error(
        `[park] DryScatter(${label}) dropped ${cells.length - kept.length} of ${
          cells.length
        } cell(s) UNDER waterline+0.05: ${JSON.stringify(
          cells.filter((c) => !kept.includes(c)).map((c) => c.at),
        )}`,
      );
    setDry(kept);
  }, [park, cells, label]);
  return <>{(dry ?? []).map(render)}</>;
}

/** Renders nothing — it is the RECEIPT that the cells we cannot drop are dry. */
function DryReceipt({ cells }: { cells: XZ[] }) {
  const park = usePark('DryReceipt');
  React.useEffect(() => {
    const wet = cells.filter((c) => !dryRing(park, c));
    if (wet.length)
      console.error(
        `[park] DryReceipt: ${wet.length} UNDROPPABLE cell(s) (pads / decks / tails) sit under ` +
          `waterline+0.05: ${JSON.stringify(wet)}`,
      );
    else console.log(`[park] DryReceipt: all ${cells.length} pad/deck/tail cells dry ✓`);
  }, [park, cells]);
  return null;
}

const RECEIPT_CELLS: XZ[] = [...PADS, ...ALL_TAILS, ...MONO_DECKS, [8.4, -27.6]];

const ROSTER_NAMES = [
  'Cinder Spine',
  'Three Crowns Skyline',
  'Salt Run',
  'Hollow Lantern',
  'Canopy Line',
  'Skyward Ascent',
  'Overpressure',
  'Foundry Wheel',
  'Ashfall Drop',
  'Cinder Carousel',
  'Bassline Spin',
  'Black Tide',
  'Spinning Sixpence',
];

export function App() {
  return (
    <div className="w-full min-h-full bg-[#0d1117]">
      <Park
        seed={SEED}
        climate={CLIMATE}
        roster={{ rides: ROSTER_NAMES, stalls: 15, categories: 5 }}
        onReady={(report: any) => {
          console.log('[park] validatePark →', {
            ok: report?.ok,
            failures: report?.failures,
            warnings: report?.warnings,
          });
          const rects: any[] = report?.footprints ?? [];
          rects.forEach((a, i) =>
            rects.slice(i + 1).forEach((b) => {
              if (!a || !b || a.rideId === undefined || a.rideId === b.rideId) return;
              const gap = Math.max(
                Math.abs(a.cx - b.cx) - (a.hx + b.hx),
                Math.abs(a.cz - b.cz) - (a.hz + b.hz),
              );
              if (gap < 1.5)
                console.error(
                  `[park] SPACING: ${a.label} vs ${b.label} gap ${gap.toFixed(2)} < 1.5 — ` +
                    `−2 on axis 3, −0.25 on axis 13`,
                );
            }),
          );
        }}
      >
        <Terrain keepDry={GUARDS} coasterPts={ALL_COASTER_PTS} />

        {/* the SPATIAL half of the theme layer: streets, kerbs, benches, bins and
            lamp posts inside each rect are furnished by that world, not by one
            municipal catalogue. Mounted AFTER <Terrain>, BEFORE <Paths>. */}
        {WORLDS.map((w, i) => (
          <ThemeRegion
            key={`tr-${w.def.id}`}
            id={w.def.id}
            theme={w.def.id}
            position={WORLD_RECTS[i].position}
            extent={WORLD_RECTS[i].extent}
          />
        ))}

        <Paths
          nodes={NET.nodes}
          edges={NET.edges}
          plazas={NET.plazas}
          bins={NET.bins}
          walkers={6}
        />
        <GameManager />
        <Gate position={[-4.8, 63.6]} />

        {/* ── the flagship: one big lift, a deep plunge, a vertical LOOP, airtime ── */}
        <Coaster
          name="Cinder Spine"
          pieces={FLAG_USED}
          start={FLAG_START}
          heading={0}
          type="steel"
          cars={3}
          capacity={4}
          rideDuration={11}
          loadTime={2}
          intensity={8}
          price={7}
          queueTailNode={NET.node(T_FLAG)}
          queueDir={[-1, 0]}
        />

        {/* ── the ring: one park-spanning transport line, four platforms ───────── */}
        {RING_OK ? (
          <Monorail
            position={[RING_START[0], 0, RING_START[2]]}
            rotation={0}
            pieces={MONO_PIECES}
            register={{ name: 'Three Crowns Skyline', capacity: MONO_CAP, price: 3 }}
            name="Three Crowns Skyline"
            capacity={MONO_CAP}
            rideDuration={12}
            loadTime={2}
            intensity={2}
            price={3}
            queue={{ anchor: MONO_ANCHOR, dir: MONO_QUEUE_DIR }}
          />
        ) : (
          <Chairlift
            position={P_CHAIR.pad}
            rotation={P_CHAIR.yaw}
            register={{ name: 'Canopy Line', capacity: 6, price: 3 }}
            queue={{ anchor: P_CHAIR.anchor, dir: P_CHAIR.dir }}
          />
        )}

        {/* ── water ─────────────────────────────────────────────────────────────── */}
        <LogFlume
          position={P_FLUME.pad}
          rotation={Math.PI}
          pieces={[
            'station',
            { type: 'lift', height: 1.2 },
            { type: 'turnL', angle: 90, radius: 2 },
            { type: 'straight', length: 1.3 },
            { type: 'turnL', angle: 90, radius: 2 },
            { type: 'drop', height: 1.2 },
            { type: 'straight', length: 3.0 },
            { type: 'turnL', angle: 90, radius: 2 },
            { type: 'straight', length: 1.3 },
            { type: 'turnL', angle: 90, radius: 2 },
          ]}
          register={{ name: 'Salt Run', capacity: 6, price: 5 }}
          name="Salt Run"
          capacity={6}
          rideDuration={10}
          loadTime={2}
          intensity={5}
          price={5}
          queue={{ anchor: P_FLUME.anchor, dir: P_FLUME.dir }}
        />

        {/* ── dark ──────────────────────────────────────────────────────────────── */}
        <GhostTrain
          position={P_GHOST.pad}
          rotation={P_GHOST.yaw}
          register={{ name: 'Hollow Lantern', capacity: 6, price: 5 }}
          name="Hollow Lantern"
          capacity={6}
          rideDuration={11}
          loadTime={2}
          intensity={5}
          price={5}
          queue={{ anchor: P_GHOST.anchor, dir: P_GHOST.dir }}
        />

        {/* ── transport (the glade canopy line) ─────────────────────────────────── */}
        {RING_OK ? (
          <Chairlift
            position={P_CHAIR.pad}
            rotation={P_CHAIR.yaw}
            register={{ name: 'Canopy Line', capacity: 6, price: 3 }}
            name="Canopy Line"
            capacity={6}
            rideDuration={12}
            loadTime={2}
            intensity={2}
            price={3}
            queue={{ anchor: P_CHAIR.anchor, dir: P_CHAIR.dir }}
          />
        ) : null}

        {/* ── thrill ────────────────────────────────────────────────────────────── */}
        <BoilerBurst
          position={P_BOILER.pad}
          rotation={P_BOILER.yaw}
          register={{ name: 'Overpressure', capacity: 4, price: 5 }}
          name="Overpressure"
          capacity={4}
          rideDuration={9}
          loadTime={2}
          intensity={7}
          price={5}
          queue={{ anchor: P_BOILER.anchor, dir: P_BOILER.dir }}
        />
        <LaunchedFreefall
          position={P_FREEFALL.pad}
          rotation={P_FREEFALL.yaw}
          register={{ name: 'Ashfall Drop', capacity: 4, price: 6 }}
          name="Ashfall Drop"
          capacity={4}
          rideDuration={8}
          loadTime={2}
          intensity={9}
          price={6}
          queue={{ anchor: P_FREEFALL.anchor, dir: P_FREEFALL.dir }}
        />
        <PirateShip
          position={P_SHIP.pad}
          rotation={P_SHIP.yaw}
          register={{ name: 'Black Tide', capacity: 4, price: 4 }}
          name="Black Tide"
          capacity={4}
          rideDuration={9}
          loadTime={2}
          intensity={7}
          price={4}
          queue={{ anchor: P_SHIP.anchor, dir: P_SHIP.dir }}
        />

        {/* ── gentle ────────────────────────────────────────────────────────────── */}
        <FerrisWheel
          position={P_WHEEL.pad}
          rotation={P_WHEEL.yaw}
          register={{ name: 'Foundry Wheel', capacity: 4, price: 3 }}
          name="Foundry Wheel"
          capacity={4}
          rideDuration={12}
          loadTime={2}
          intensity={2}
          price={3}
          queue={{ anchor: P_WHEEL.anchor, dir: P_WHEEL.dir }}
        />
        <AetherBalloons
          position={P_BALLOON.pad}
          rotation={P_BALLOON.yaw}
          register={{ name: 'Skyward Ascent', capacity: 4, price: 3 }}
          name="Skyward Ascent"
          capacity={4}
          rideDuration={11}
          loadTime={2}
          intensity={3}
          price={3}
          queue={{ anchor: P_BALLOON.anchor, dir: P_BALLOON.dir }}
        />
        <Carousel
          position={P_CAROUSEL.pad}
          rotation={P_CAROUSEL.yaw}
          register={{ name: 'Cinder Carousel', capacity: 4, price: 2 }}
          name="Cinder Carousel"
          capacity={4}
          rideDuration={9}
          loadTime={2}
          intensity={2}
          price={2}
          queue={{ anchor: P_CAROUSEL.anchor, dir: P_CAROUSEL.dir }}
        />
        <Discotron
          position={P_DISCO.pad}
          rotation={P_DISCO.yaw}
          register={{ name: 'Bassline Spin', capacity: 4, price: 4 }}
          name="Bassline Spin"
          capacity={4}
          rideDuration={9}
          loadTime={2}
          intensity={4}
          price={4}
          queue={{ anchor: P_DISCO.anchor, dir: P_DISCO.dir }}
        />
        <Teacups
          position={P_TEACUPS.pad}
          rotation={P_TEACUPS.yaw}
          register={{ name: 'Spinning Sixpence', capacity: 4, price: 2 }}
          name="Spinning Sixpence"
          capacity={4}
          rideDuration={9}
          loadTime={2}
          intensity={3}
          price={2}
          queue={{ anchor: P_TEACUPS.anchor, dir: P_TEACUPS.dir }}
        />

        {/* ── the set-pieces (AFTER <Paths>: their dressing settles on the paving) ─ */}
        <FountainPlaza plan={HUB} />
        <FountainPlaza plan={COVE_HUB} />

        {/* ── the five worlds: region, giant, market ─────────────────────────────── */}
        {WORLDS.map((w) => (
          <React.Fragment key={`w-${w.def.id}`}>
            <WorldLandmark plan={w.plan} position={w.landmark.at} />
            <World plan={w.plan} />
          </React.Fragment>
        ))}
        <Bazaar plan={EMBER_ROW} />
        <Bazaar plan={FOUNDRY_ROW} />
        <Bazaar plan={GLADE_ROW} />
        <Bazaar plan={PULSE_ROW} />
        <Bazaar plan={COVE_ROW} />

        {/* ── night: marquees, torches, festival runs ────────────────────────────── */}
        <Neon text="PULSE" position={[-19.2, 2.1, 57.6]} rotation={Math.PI} scale={0.6} />
        <Neon text="CINDER" position={[25.2, 2.1, 12.0]} rotation={Math.PI / 2} scale={0.55} />
        <Neon text="TIDELINE" position={[4.8, 2.1, -45.6]} rotation={0} scale={0.5} />
        <Torch position={[28.8, -6.0]} />
        <Torch position={[33.6, -6.0]} />
        <Torch position={[-27.6, -8.4]} />
        <Torch position={[-35.4, -6.0]} />
        <Lights from={[-4.8, 57.6]} to={[-4.8, 51.6]} />
        <Lights from={[-10.8, 27.6]} to={[-10.8, 21.6]} />
        <Lights from={[13.2, 15.6]} to={[25.2, 15.6]} />
        <Lights from={[-13.2, 15.6]} to={[-25.2, 15.6]} />
        <Lights from={[0, -6.0]} to={[0, -16.8]} />
        <Lights from={[-19.2, 61.2]} to={[-32.4, 61.2]} />

        {/* ── dressing, sieved by the GATE'S OWN predicate, mounted LAST ─────────── */}
        <DryReceipt cells={RECEIPT_CELLS} />
        <DryScatter
          label="trees"
          cells={TREES}
          render={(t, i) => (
            <Placed
              key={`tr-${i}`}
              position={t.at}
              rotation={(i % 8) * 0.7854}
              build={(three: any) => tree(three, { shape: t.shape })}
            />
          )}
        />
        <DryScatter
          label="themed"
          cells={THEMED}
          render={(s, i) => {
            const C = SCENERY_MAP[s.kind];
            if (!C) return null;
            return (
              <C
                key={`th-${i}`}
                position={s.at}
                rotation={((i * 5) % 8) * 0.7854 - Math.PI}
                seed={i + 2}
              />
            );
          }}
        />
        <DryScatter
          label="neutral"
          cells={NEUTRAL_CELLS.map((at, i) => ({ at, kind: NEUTRAL_KINDS[i % NEUTRAL_KINDS.length] }))}
          render={(s, i) => (
            <Scenery
              key={`ne-${i}`}
              name={s.kind}
              position={s.at}
              rotation={((i * 3) % 8) * 0.7854}
              seed={i + 1}
            />
          )}
        />
      </Park>
    </div>
  );
}

/* ═══ CINDERREACH GARDENS — §0 PRE-FLIGHT ═══════════════════════════════════════════
 * SIZE   128 (default, `size` prop OMITTED)
 * SEED   1 / temperate — pinned row SEED_ROW_WATER['1/temperate']:
 *        dominant lake ctr (41, -39) box x[21,60] z[-60,-21] · secondary ctr (-38, 31)
 *        box x[-56,-21] z[23,39]   [PRE-keepDry]
 *        RING WATER WALK: all 16 monorail ring cells walked against BOTH bodies at the
 *        CHOSEN pose (see MONO). Tightest = E tail [36, -9.6] → 29.8 u from (41,-39),
 *        outside both boxes. 0 wet ring cells ✓ (re-asserted at module scope: ringOffRow)
 *        keepDry is DERIVED — keepDryOf(NET, SEED_ROW), never NODES.slice() ✓
 *        re-compose diff: BARE vs COMP differ ONLY in keepDry; both carry coasterPts.
 *        waterMoved (structural) + terrainFlattened (advisory) both asserted ✓
 *        every pad + prop cell re-checked IN THE TREE by the GATE'S OWN predicate
 *        (dryRing → park.ground.lint.isDry(x, z, 0.05) = min ground > -0.21) ✓
 *        reliefFloor.kept read off report.reliefFloor (NOT report.relief) ✓
 * WORLDS 3 (>= 3), all THREE canonical genres, `fire` is the corpus-rare pick:
 *        cinderreach  (fire)      rect ~x[-59.2,-33.6] z[-26.4,-7.2]  ctr ~(-46.4,-16.8)
 *        gearhaven    (steampunk) rect ~x[ 25.2, 55.2] z[-21.6,-3.6]  ctr ~( 40.2,-12.6)
 *        voltyard     (neon)      rect ~x[ -2.4, 37.9] z[ 20.4,45.6]  ctr ~( 17.8, 33.0)
 *        centre pairs SORTED, closest marked: gearhaven<->voltyard 50.8 ◄ >= 32.66
 *        (20·√(128/48)) · cinderreach<->voltyard 81.2 · cinderreach<->gearhaven 86.7 ✓
 *        DRY GAP between rects: fire|neon 31.2 u in x · fire|steam 58.8 u in x ·
 *        steam|neon 24.0 u in z — all > 0 ✓ (asserted: worldGap, worldSpacing)
 *        WORLD cinderreach: ride GoKarts (registered, inside rect ✓) · OWN stall
 *          'emberRoast' in emberRow · scenery BasaltColumns · CharredSnag · Fumarole ·
 *          ObsidianShards  (4 >= 3, ALL from EmberfallScenery)
 *        WORLD gearhaven:   ride FerrisWheel (inside rect ✓) · OWN stall 'goggles' in
 *          gearRow · scenery GiantGear · SteamPipes · ClockTower · BoilerTank
 *          (4 >= 3, ALL from BrassworkScenery)
 *        WORLD voltyard:    ride Discotron (a PULSE-themed ride in the neon world ✓) ·
 *          OWN stall 'neonSlush' in neonRow · scenery NeonArch · MirrorBallPylon ·
 *          SpeakerStack · LaserTruss (4 >= 3, ALL from PulseScenery)
 *        0 foreign themed pieces — every other rig in the park is NEUTRAL ✓
 * CATS   (WRITTEN BEFORE ANY JSX) gentle Carousel + FerrisWheel · thrill §4.0-L flagship
 *        + §4.0-B + GoKarts + Discotron · water LogFlume · transport Monorail ring ·
 *        dark GhostTrain   → 5/5 categories, 9 distinct kinds (>= 8) ✓
 *        RARE PICK GoKarts — from the §0-P.5 PAD_MARGIN shelf (4.39), a kind the corpus
 *        under-builds. The 7 u+ rigs (MagmaRun 14.22, LavaTubeRun 23.41) were REJECTED
 *        on arithmetic, not nerve: their pad margin EXCEEDS the tail->pad reach floor
 *        (cap-4 reach 7.66 u), so no legal pad exists with a street queue tail.
 * CIRCUITS §4.0-L · §4.0-B · Monorail ring · LogFlume · GhostTrain
 *        → 5 CIRCUITS (>= 5) / 4 FAMILIES (coaster, transport, water, dark) (>= 3) ✓
 * GATE   [0, 63.6] -> first queue tail [4.8, 58.8] (Carousel) = 9.6 u of STREET
 *        ([0,63.6]->[0,58.8] 4.8 + [0,58.8]->[4.8,58.8] 4.8; 6.79 straight-line) <= 15 ✓
 * FLAG   §4.0-L LOOPER copied VERBATIM · start [16.8, 0.55, -3.6] heading 0, steel,
 *        cars 3, NO bank prop (pieces mode builds 0.7)
 *        rateCoaster(bank 0.7, cars 3) -> E 6.29 / I 8.58 / N 3.17 / drop 4.19 /
 *        maxLatG 1.20 (guard 1.275) / INVERSIONS 2 (vertical loop + corkscrew)
 *        bbox x[-21.81, 16.80] z[-14.45, 17.76] maxY 4.75 — logged at runtime
 *        CORRIDOR KEEP-OUT (§0-P.4, pasted): west x[-22.2,-21.0] z[-4.2,12.6] ·
 *        south x[-17.4,3.0] z[-15.0,-13.8] · north x[-12.6,9.0] z[16.2,18.6] ·
 *        INTERIOR return x[3.0,4.2] z[-13.8,-0.6] · east sweep x[10.2,17.4] (own, exempt)
 *        The ring interior is CLOSED to a N-S column (skeleton-L recipe): the park cycle
 *        runs down the EAST spine x 22.8 and west along the z -16.8 shelf; the west spoke
 *        is JOGGED [-16.8,-10.8] -> [-21.6,-10.8] -> [-21.6,-16.8]. Every street node and
 *        every leg is OUTSIDE all four rects ✓ (no leg crosses at grade)
 * FLAG2  §4.0-B FAMILY rectangle VERBATIM · start [-33.6, 0.55, -48.0] heading 0, steel,
 *        cars 3, NO bank prop → E 5.27 / I 6.25 / N 2.25 / drop 3.58 / maxLatG 0.27
 *        DIFFERENT archetype ✓ · bbox x[-62.52,-33.60] z[-61.27,-30.85] DISJOINT from
 *        FLAG's by 11.79 u in x and 16.40 u in z ✓ · off all 16 ring cells ✓ ·
 *        outside every <World> rect ✓ · coasterPts = [...FLAG_PTS, ...FLAG2_PTS] ✓
 *        B's corridor rects carry NO street: the x -24.0 column and the z -58.8 leg are
 *        4.8-15.6 u clear of its west/south/north valleys ✓
 * STREET buildParkNet called EXACTLY ONCE ✓ · the SAME NET feeds <Paths> and every
 *        offPathCell/place call ✓ · `worlds:` deliberately NOT passed (the worldPlan ->
 *        pad -> NET cycle is broken by ORDER; the three bazaars are named in `pieces:`)
 *        PORT-REFS: 4 pieces -> 6 refs in EDGES — hub:N, hub:E, hub:W, neonRow:E,
 *        gearRow:W, emberRow:E — counted and asserted (pieceIsland / chainEnd) ✓
 *        every pad returned BY offPathCell through place(), never a raw tail+out·d sum ✓
 * MONO   ring pieces VERBATIM from §0-P.4 (tail split 33.5 + 1.5, never merged)
 *        POSE IS FLANK-TESTED, NOT ASSUMED. The published z is MARGINAL on this seed:
 *        deck [0,-51.0] sits 9.70 u from the seed-1 fallback ridge summit (5.33,-42.89)
 *        h 8.59 r 12.09 -> smoothstep bump 0.87 > the 0.75 PEAK_LIMIT (the measured
 *        -3 on axis 7). keepDry does NOT fix it (measured, byte-identical 0.87), so the
 *        RING POSE MOVES: RING_DZ is SEARCHED over [-1.2,-2.4,-3.6,0,+1.2,-4.8] and the
 *        first pose whose FOUR decks all satisfy bumpOf(BARE, deck) <= 0.75 is taken.
 *        -1.2 is expected to win: deck [0,-52.2] is 10.73 u out -> bump 0.30 ✓
 *        position [-42.6, 0, -10.9] (the START POSE, not the ring centre) · rotation 0 ·
 *        beamY 2.6 · price 0 · pinned · loopSeconds 12 = rideDuration
 *        4 platforms >= 3 declared worlds — W in cinderreach, N in voltyard,
 *        E in gearhaven, S unassigned (asserted: deckInWorld per world)
 *        tails [-36.0,-9.6] · [0,26.4] · [36.0,-9.6] · [0,-58.8] authored NODES,
 *        ALL LEAVES (degree 1, asserted: ringTailLeaf) ✓
 *        S queues OUTWARD ([0,-1], the measured +1.5); the gate spine ENDS at hub:N and
 *        the N tail is reached LATERALLY off the east spine at [22.8,26.4] ✓
 *        the E tail is a LEAF off [36.0,-16.8] (a vertical leg, 6.6 u clear of the deck),
 *        so no street runs along z -9.6 past the East deck ✓
 * QUEUE  ONE ROW PER RIDE — tail is an authored NODE, pad DERIVED from it by place():
 *        Carousel     cap  8  tail [  4.8, 58.8] out [ 1, 0] reach  9.90 >= 8.70 ✓ clear 2.40
 *        Discotron    cap 12  tail [ 22.8, 26.4] out [ 1, 0] reach 12.14 >= 10.94 ✓ clear 3.07
 *        LogFlume     cap  4  tail [ 22.8,  4.8] out [ 1, 0] reach  7.66 >= 6.46 ✓ clear 5.36
 *        FerrisWheel  cap  4  tail [ 30.0,-16.8] out [ 0, 1] reach  7.66 >= 6.46 ✓ clear 2.97
 *        GhostTrain   cap  6  tail [-12.0,-16.8] out [ 0,-1] reach  8.78 >= 7.58 ✓ clear 4.77
 *        GoKarts      cap  6  tail [-48.0,-24.0] out [-1, 0] reach  8.78 >= 7.58 ✓ clear 4.39
 *        §4.0-L       cap  4  tail [ 22.8, -3.6] queueDir [1,0] (start.x + 6.0, same z)
 *        §4.0-B       cap  4  tail [-27.6,-48.0] queueDir [1,0] (start.x + 6.0, same z)
 *        no two rides share a tail node · every tail appears in NODES ✓
 *        clear = padMarginOf(rig) off the §0-P.5 table, never the 3.2 default by guess ✓
 * GROUND every pad goes offPathCell (streets) THEN assertPadFlat (bump <= 0.75 AND dry).
 *        A relocation prints a warning and the world rect follows the ACTUAL pad ✓
 * SPREAD built bbox ~x[-60.6, 55.2] × z[-58.8, 58.8] = 115.8 × 117.6 >= 70 × 45 ✓
 *        street-node bbox x[-48, 36] z[-58.8, 63.6] -> pathExtent well over 0.55 ✓
 * PLAZAS NET.plazas = the hub's 9-tile pad (10.8 × 10.8 = 116.6 u²) + three bazaar
 *        courtyards -> largest >= 8 ✓ areaSpread >= 1.8 ✓ (passed straight to <Paths>)
 *        NO set-piece `position` appears in NODES or as a queue tail — every set-piece is
 *        wired by PORT ('hub:E', never hub.position); asserted by assertNodesOffPieces ✓
 * NODES  29 authored · degree-1: 8 (0.28) — [0,63.6] the GATE · [4.8,58.8] Carousel ·
 *        the FOUR monorail tails (7/13/19/28) · [-48,-24] GoKarts · [-27.6,-48] §4.0-B.
 *        Every leaf carries a queue tail or the gate; no leaf dead-ends in grass ✓
 *        ONE park-spanning loop hub:E -> east spine -> z -16.8 shelf -> west
 *        jog -> x -16.8 column -> hub:W, crossing z = 0 twice (x 22.8 and x -16.8) ✓
 * ATTACH no `nodeY` ramps are authored anywhere — every node sits on the street's median
 *        level, so |dy|/len is 0 on every spur and the reachability walk seeds on all of
 *        them. No span crosses a dip or bank past the hard limit: every leg is cardinal,
 *        on the 1.2 lattice, and off every coaster corridor rect (see FLAG / FLAG2) ✓
 *        accessibility.allRidesReachable MUST come back true — read it off onReady
 * LATTICE authored spans 2.4 / 3.6 / 4.8 / 6.0 / 6.6 / 7.2 / 8.4 / 9.6 / 10.8 / 12.0 /
 *        13.2 / 21.6 / 22.8 / 24.0 / 31.2 / 56.4 u -> effectiveClasses >= 4 ✓
 *        1.2-u chain share is 0 authored (the fuse's own splits only) ✓
 * ROSTER (COUNTED OFF THE register CALLS, and restated on <Park roster>)
 *        9 rides / 5 categories / 9 stalls (3 bazaar rows × 3 kinds) / restroom ✓ /
 *        bins from NET.bins ✓
 *        NAMED: all 9 rides AND all 9 stalls carry an authored themed `name` — 0 shipped
 *        under a catalog defaultName (bazaar `names` arrays supply the stall names) ✓
 *        <Park roster={{ rides: [...9 names], stalls: 9, categories: 5 }}> MOUNTED ✓
 * DRESS  46 tree cells authored (floor 32) · 26 SceneryPack cells authored (floor 16) ·
 *        16 world-themed scenery pieces on top — OVER-PROVISIONED because DryScatter
 *        DROPS wet cells. water 2 bodies, temperate band 4-22 % ✓
 *        EVERY prop cell from offPathCell (trees clear 0.75, scenery clear 1.2, the
 *        restroom clear 1.8); no prop cell reuses a street node or an edge centreline ✓
 * NIGHT  2 <Neon> signs · the hub's and the three bazaars' own festival spans and
 *        lanterns · the fire pack's fissure/fumarole glow (day AND night) · the neon
 *        pack's arch crown, mirror-ball pylon, laser truss and beat-synced LEDs · the
 *        steampunk pack's gas dial and firebox — every light night-gated by the rig that
 *        owns it, no hand-authored PointLight anywhere, draws well inside 3 000 ✓
 * GATE   parkAssertFlush() -> 0 structural expected · validatePark -> read report.ok,
 *        report.failures and report.warnings in onReady; ship only ok:true with an
 *        EMPTY warnings array
 * ═══════════════════════════════════════════════════════════════════════════════════ */
import * as THREE from 'three';
import React from 'react';
import type { V3, XZ } from './components/Park';
import {
  Park, GameManager, Terrain, Paths, Gate, Coaster, Restroom, Scenery, Neon,
  Placed, usePark, offPathCell,
} from './components/Park';
import { laneLenOf, parkComposition } from './components/ParkBuilder';
import { buildParkNet, worldPlan, World, FIRE, STEAMPUNK, NEON_CITY } from './components/SetPieceKit';
import type { NetRef, SetPiecePlan } from './components/SetPieceKit';
import { Bazaar, bazaarPlan } from './components/Bazaar';
import { FountainPlaza, fountainPlazaPlan } from './components/FountainPlaza';
import type { TrackPiece } from './components/SplineRideKit';
import { compileTrackPieces, rateCoaster } from './components/SplineRideKit';
import { tree } from './components/Kit';
import { Monorail } from './components/Monorail';
import { Carousel } from './components/Carousel';
import { FerrisWheel } from './components/FerrisWheel';
import { LogFlume } from './components/LogFlume';
import { GhostTrain } from './components/GhostTrain';
import { Discotron } from './components/Discotron';
import { GoKarts } from './components/GoKarts';
import { BasaltColumns, CharredSnag, Fumarole, ObsidianShards } from './components/EmberfallScenery';
import { GiantGear, SteamPipes, ClockTower, BoilerTank } from './components/BrassworkScenery';
import { NeonArch, MirrorBallPylon, SpeakerStack, LaserTruss } from './components/PulseScenery';

/* ─────────────────────────────────────────────────────────────────────────────
 * §0-P.5  THE ASSERTION BUS — collect, print ONE numbered block, throw ONCE
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
  console.error(`[park] ${PARK_FAILS.length} ASSERTION FAILURE(S) (${hard.length} structural):\n` +
    PARK_FAILS.map((f, i) => `  ${i + 1}. [${f.sev}] ${f.name}\n     ${f.detail}`).join('\n'));
  if (hard.length) throw new Error(`[park] ${hard.length} STRUCTURAL failure(s) — see the numbered block above.`);
}

/** §12 — the house hashed-sine PRNG. Deterministic, never Math.random / Date.now. */
const hash01 = (n: number) => {
  const s = Math.sin(n * 12.9898 + 78.233) * 43758.5453;
  return s - Math.floor(s);
};

const SIZE = 128;
const SEED = 1;
const CLIMATE = 'temperate' as const;
const PEAK_LIMIT = 0.75;   // ParkBuilder/validate.ts, verbatim

/* ─────────────────────────────────────────────────────────────────────────────
 * §0-P.6  THE PINNED SEED ROW + the basin-box pre-filter
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
  [row.dom, row.sec].every((b) =>
    !inBasinBox(c, b) && Math.hypot(c[0] - b.ctr[0], c[1] - b.ctr[1]) >= nearR);

/** DERIVED, never transcribed. Drops rather than fixes — a non-zero count means MOVE it. */
function keepDryOf(net: { keepDry: XZ[] }, row: SeedRow = SEED_ROW): XZ[] {
  const kept = net.keepDry.filter((c) => offRow(c, row));
  const dropped = net.keepDry.length - kept.length;
  if (dropped) console.warn(
    `[park] keepDryOf dropped ${dropped} of ${net.keepDry.length} guard cell(s) on the pinned row's water. ` +
    `A DROPPED guard is NOT a fixed cell — whatever you meant to build there is still in the lake. MOVE it.`);
  return kept;
}

/* ─────────────────────────────────────────────────────────────────────────────
 * §0-P.5  PAD_MARGIN — the whole catalog, derived the way the validator does it
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
 * §4.0  THE TWO VERIFIED COASTERS — copied VERBATIM, different archetypes
 * ───────────────────────────────────────────────────────────────────────────── */
// ── §4.0-L LOOPER — vertical LOOP + corkscrew, 2 inversions. 23 pieces ──────
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

// ── §4.0-B FAMILY steel rectangle — the gentler SECOND archetype ──────────
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
// MEASURED with the bank + cars the mounts actually build (pieces mode: steel -> 0.7):
[FLAG_PTS, FLAG2_PTS].forEach((pts, i) => console.log(`[park] coaster ${i + 1}`,
  rateCoaster(pts, { type: 'steel', bank: 0.7, cars: 3 })));

/* ─────────────────────────────────────────────────────────────────────────────
 * THE UNGUARDED COMPOSITION — COMP0. The ring pose is FLANK-TESTED against it.
 * ───────────────────────────────────────────────────────────────────────────── */
const BARE = parkComposition(THREE, SEED, SIZE, CLIMATE, { coasterPts: ALL_COASTER_PTS });

type Comp = { peaks: { x: number; z: number; radius: number; height: number }[] };
const bumpOf = (comp: Comp, c: XZ) =>
  Math.max(0, ...comp.peaks.map((p) => {
    const k = Math.max(0, 1 - Math.hypot(c[0] - p.x, c[1] - p.z) / p.radius);
    return k * k * (3 - 2 * k) * p.height;
  }));

/* ─────────────────────────────────────────────────────────────────────────────
 * §0-P.4  THE MONORAIL RING — pieces VERBATIM, POSE SEARCHED on the flank test
 * ───────────────────────────────────────────────────────────────────────────── */
const MONO_PIECES: TrackPiece[] = [
  'station',
  { type: 'straight', length: 35.3 },
  { type: 'turnL', angle: 90, radius: 6 },
  { type: 'straight', length: 35.3 },
  'station',   // platform 1 — NORTH
  { type: 'straight', length: 35.3 },
  { type: 'turnL', angle: 90, radius: 6 },
  { type: 'straight', length: 35.3 },
  'station',   // platform 2 — EAST
  { type: 'straight', length: 35.3 },
  { type: 'turnL', angle: 90, radius: 6 },
  { type: 'straight', length: 35.3 },
  'station',   // platform 3 — SOUTH
  { type: 'straight', length: 35.3 },
  { type: 'turnL', angle: 90, radius: 6 },
  { type: 'straight', length: 33.5 },   // the tail in TWO pieces — MERGED it is FATAL
  { type: 'straight', length: 1.5 },
];

const RING_BASE = {
  pose: [-42.6, -9.7] as XZ,
  deckW: [-42.6, -8.4] as XZ, deckN: [0, 34.2] as XZ, deckE: [42.6, -8.4] as XZ, deckS: [0, -51.0] as XZ,
  tailW: [-36.0, -8.4] as XZ, tailN: [0, 27.6] as XZ, tailE: [36.0, -8.4] as XZ, tailS: [0, -57.6] as XZ,
  anchW: [-40.81, -8.4] as XZ, anchN: [0, 32.41] as XZ, anchE: [40.81, -8.4] as XZ, anchS: [0, -52.79] as XZ,
  exitN: [-1.2, 33.03] as XZ, exitE: [41.43, -7.2] as XZ, exitS: [1.2, -52.17] as XZ,
};
const dzc = (c: XZ, dz: number): XZ => [c[0], +(c[1] + dz).toFixed(2)];
const decksAt = (dz: number): XZ[] =>
  [RING_BASE.deckW, RING_BASE.deckN, RING_BASE.deckE, RING_BASE.deckS].map((d) => dzc(d, dz));

// THE FLANK TEST — the same predicate validatePark applies, on ALL FOUR decks.
// keepDry does NOT fix a flank (measured: byte-identical 0.87), so the POSE moves.
const RING_DZ_CANDIDATES = [-1.2, -2.4, -3.6, 0, 1.2, -4.8];
const RING_DZ = RING_DZ_CANDIDATES.find((dz) =>
  decksAt(dz).every((d) => bumpOf(BARE, d) <= PEAK_LIMIT && offRow(d))) ?? -1.2;
console.log('[park] ring pose search — dz candidates vs the PEAK_LIMIT 0.75 flank test:',
  RING_DZ_CANDIDATES.map((dz) => `${dz}: ${decksAt(dz).map((d) => bumpOf(BARE, d).toFixed(2)).join('/')}`).join('  |  '),
  `→ CHOSEN RING_DZ ${RING_DZ}`);

const RING = {
  pose: dzc(RING_BASE.pose, RING_DZ),
  deckW: dzc(RING_BASE.deckW, RING_DZ), deckN: dzc(RING_BASE.deckN, RING_DZ),
  deckE: dzc(RING_BASE.deckE, RING_DZ), deckS: dzc(RING_BASE.deckS, RING_DZ),
  tailW: dzc(RING_BASE.tailW, RING_DZ), tailN: dzc(RING_BASE.tailN, RING_DZ),
  tailE: dzc(RING_BASE.tailE, RING_DZ), tailS: dzc(RING_BASE.tailS, RING_DZ),
  anchW: dzc(RING_BASE.anchW, RING_DZ), anchN: dzc(RING_BASE.anchN, RING_DZ),
  anchE: dzc(RING_BASE.anchE, RING_DZ), anchS: dzc(RING_BASE.anchS, RING_DZ),
  exitN: dzc(RING_BASE.exitN, RING_DZ), exitE: dzc(RING_BASE.exitE, RING_DZ),
  exitS: dzc(RING_BASE.exitS, RING_DZ),
};
const RING_CELLS: XZ[] = [
  RING.deckW, RING.deckN, RING.deckE, RING.deckS, RING.pose,
  RING.tailW, RING.tailN, RING.tailE, RING.tailS,
  RING.anchW, RING.anchN, RING.anchE, RING.anchS,
  RING.exitN, RING.exitE, RING.exitS,
];
decksAt(RING_DZ).forEach((d) =>
  parkAssert('deckOnFlank', bumpOf(BARE, d) <= PEAK_LIMIT,
    `monorail deck [${d}] bump ${bumpOf(BARE, d).toFixed(2)} > ${PEAK_LIMIT} — it will FAIL the terrain ` +
    `gate (−3 on axis 7). No candidate ring pose cleared all four decks; widen RING_DZ_CANDIDATES. ` +
    `Do NOT try to fix it with keepDry and do NOT relocate one deck: the four decks are the ring's own geometry.`,
    'advisory'));
parkAssert('ringOffRow', RING_CELLS.every((c) => offRow(c)),
  `ring cells on the pinned row's water: ${JSON.stringify(RING_CELLS.filter((c) => !offRow(c)))}`,
  'advisory');

/* ─────────────────────────────────────────────────────────────────────────────
 * THE SET PIECES — every `position` is a MULTIPLE OF 1.2 (no silent snap)
 * ───────────────────────────────────────────────────────────────────────────── */
const HUB = fountainPlazaPlan({
  id: 'hub', title: 'Cinderway Circus', position: [0, 45.6], tiles: 9,
  ports: ['N', 'E', 'W'], seed: 1,
});
const EMBER_ROW = bazaarPlan({
  id: 'emberRow', title: 'Cinderreach Market', position: [-48.0, -16.8],
  facing: { port: 'E', toward: [-36.0, -16.8] },
  stalls: ['emberRoast', 'hotDog', 'soda'],
  names: ['Cinder Grill', 'Slagworks Franks', 'Ashfall Sodas'],
  theme: FIRE, seed: 9,
});
const GEAR_ROW = bazaarPlan({
  id: 'gearRow', title: 'Gearhaven Arcade', position: [48.0, -16.8],
  facing: { port: 'W', toward: [36.0, -16.8] },
  stalls: ['goggles', 'burger', 'cottonCandy'],
  names: ['Cogsight Optics', 'Piston & Patty', 'Steam-Spun Floss'],
  theme: STEAMPUNK, seed: 11,
});
const NEON_ROW = bazaarPlan({
  id: 'neonRow', title: 'Voltyard Strip', position: [14.4, 39.6],
  facing: { port: 'E', toward: [22.8, 39.6] },
  stalls: ['neonSlush', 'soda', 'balloon'],
  names: ['Voltage Slush', 'Chrome Fizz', 'Helium Halo'],
  theme: NEON_CITY, seed: 13,
});
const ALL_PLANS: SetPiecePlan[] = [HUB, EMBER_ROW, GEAR_ROW, NEON_ROW];
[EMBER_ROW, GEAR_ROW, NEON_ROW].forEach((p) =>
  parkAssert('bazaarStallFloor', (p as unknown as { stalls?: unknown[] }).stalls == null ||
    ((p as unknown as { stalls: unknown[] }).stalls.length >= 3),
    `bazaar '${p.id}' composed under the 3-stall floor`));

/* ─────────────────────────────────────────────────────────────────────────────
 * THE STREET SKELETON — 29 authored nodes, 33 cardinal edges, ONE fuse
 * ───────────────────────────────────────────────────────────────────────────── */
const RN = RING.tailN[1];   // 26.4 at dz -1.2
const RW = RING.tailW[1];   // -9.6
const RS = RING.tailS[1];   // -58.8

const NODES: XZ[] = [
  [0, 63.6],        //  0  gate (LEAF)
  [0, 58.8],        //  1
  [4.8, 58.8],      //  2  Carousel tail (LEAF)
  [22.8, 45.6],     //  3
  [22.8, 39.6],     //  4  neonRow:E junction
  [22.8, RN],       //  5  Discotron tail + N-leg junction
  [9.6, RN],        //  6
  [0, RN],          //  7  N monorail tail (LEAF)
  [22.8, 4.8],      //  8  LogFlume tail
  [22.8, -3.6],     //  9  §4.0-L tail
  [22.8, -16.8],    // 10
  [30.0, -16.8],    // 11  FerrisWheel tail
  [36.0, -16.8],    // 12  gearRow:W junction
  [36.0, RW],       // 13  E monorail tail (LEAF)
  [0, -16.8],       // 14
  [-12.0, -16.8],   // 15  GhostTrain tail
  [-21.6, -16.8],   // 16
  [-24.0, -16.8],   // 17
  [-36.0, -16.8],   // 18  emberRow:E junction
  [-36.0, RW],      // 19  W monorail tail (LEAF)
  [-36.0, -24.0],   // 20
  [-48.0, -24.0],   // 21  GoKarts tail (LEAF)
  [-21.6, -10.8],   // 22  the west JOG
  [-16.8, -10.8],   // 23
  [-16.8, 45.6],    // 24  hub:W junction
  [-24.0, -48.0],   // 25
  [-27.6, -48.0],   // 26  §4.0-B tail (LEAF)
  [-24.0, RS],      // 27
  [0, RS],          // 28  S monorail tail (LEAF)
];

const EDGES: [NetRef, NetRef][] = [
  [0, 1], [1, 2], [1, 'hub:N'],
  ['hub:E', 3], [3, 4], [4, 'neonRow:E'], [4, 5], [5, 6], [6, 7],
  [5, 8], [8, 9], [9, 10],
  [10, 11], [11, 12], [12, 'gearRow:W'], [12, 13],
  [10, 14], [14, 15], [15, 16], [16, 17], [17, 18], [18, 'emberRow:E'],
  [18, 19], [18, 20], [20, 21],
  [16, 22], [22, 23], [23, 24], [24, 'hub:W'],
  [17, 25], [25, 26], [25, 27], [27, 28],
];

/* — the world-themed scenery cells: authored BEFORE the fuse so they can be guarded — */
const FIRE_PROPS: XZ[] = [[-54.0, -14.4], [-52.8, -21.6], [-39.6, -21.6], [-40.8, -13.2]];
const STEAM_PROPS: XZ[] = [[45.6, -20.4], [52.8, -19.2], [50.4, -13.2], [50.4, -9.6]];
const NEON_PROPS: XZ[] = [[8.4, 39.6], [10.8, 43.2], [20.4, 36.0], [30.0, 30.0]];

/* ── THE ONE AND ONLY buildParkNet CALL ─────────────────────────────────────── */
const NET = buildParkNet({
  nodes: NODES,
  edges: EDGES,
  pieces: ALL_PLANS,
  keepDry: [...FIRE_PROPS, ...STEAM_PROPS, ...NEON_PROPS],
});
const GUARDS = keepDryOf(NET, SEED_ROW);

/* ── THE GUARDED COMPOSITION + the §5c re-compose DIFF ──────────────────────── */
const COMP = parkComposition(THREE, SEED, SIZE, CLIMATE, {
  keepDry: GUARDS, coasterPts: ALL_COASTER_PTS,
});
parkAssert('waterMoved',
  Math.hypot(COMP.waterCentre[0] - BARE.waterCentre[0], COMP.waterCentre[1] - BARE.waterCentre[1]) < 1 &&
  Math.hypot(COMP.waterCentreSecond[0] - BARE.waterCentreSecond[0],
    COMP.waterCentreSecond[1] - BARE.waterCentreSecond[1]) < 1,
  `guards moved a water body off the pinned row — dominant ${JSON.stringify(BARE.waterCentre)} → ` +
  `${JSON.stringify(COMP.waterCentre)}, secondary ${JSON.stringify(BARE.waterCentreSecond)} → ` +
  `${JSON.stringify(COMP.waterCentreSecond)}, terrainSeed ${BARE.terrainSeed} → ${COMP.terrainSeed}`);

const rf = COMP.report.reliefFloor;   // NOT report.relief — no such field
parkAssert('terrainFlattened', !rf || rf.kept >= rf.floor,
  rf ? `keepDry FLATTENED the seed: authored relief ${rf.authoredRelief.toFixed(2)} → built ` +
  `${rf.relief.toFixed(2)} (kept ${rf.kept.toFixed(2)} against the ${rf.floor} floor), stdH ` +
  `${rf.authoredStdH.toFixed(2)} → ${rf.stdH.toFixed(2)}. Ranges this guard list stood on: ` +
  `${rf.guardedRanges}; peaks it took >= 25 % of: ${JSON.stringify(rf.cappedPeaks)}` : '',
  'advisory');
console.log('[park] composition', {
  terrainSeed: COMP.terrainSeed, probesTried: COMP.report.probesTried,
  waterBodies: COMP.report.waterBodies, waterAreaU2: COMP.report.waterAreaU2,
  waterGap: COMP.report.waterGap, guards: GUARDS.length,
  reliefKept: rf ? +rf.kept.toFixed(3) : null, stdH: rf ? +rf.stdH.toFixed(3) : null,
});

/* ─────────────────────────────────────────────────────────────────────────────
 * §0-P.5  PAD PLACEMENT — the tail is the authored NODE, the pad is DERIVED
 * ───────────────────────────────────────────────────────────────────────────── */
const isDry = (c: XZ) => [...COMP.basins, ...COMP.clampBasins]
  .every((b) => Math.hypot(c[0] - b.x, c[1] - b.z) > 0.74 * b.radius + 0.6);
const bumpAt = (c: XZ) => bumpOf(COMP, c);

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
    `${label}: pad [${pad}] is on a hill flank (bump ${bumpAt(pad).toFixed(2)} > ${PEAK_LIMIT}) OR WET, and no ` +
    `cell within 4.8 u is flat, dry AND ${clear} u off the street. MOVE THE TAIL.`, 'advisory');
  return pad;
}

type Placed3 = { pad: XZ; anchor: XZ; dir: XZ };
function place(tail: XZ, out: XZ, capacity: number, rig: string): Placed3 {
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
      `${(minReachOf(capacity) + 1.2).toFixed(2)} u. offPathCell pulled the candidate INWARD: the court is too ` +
      `tight. Move the TAIL outward or open the court. Do NOT lower the clearance.`, 'advisory');
  return {
    pad,
    anchor: [+(tail[0] + out[0] * join).toFixed(2), +(tail[1] + out[1] * join).toFixed(2)] as XZ,
    dir: [-out[0], -out[1]] as XZ,
  };
}

const CAROUSEL = place(NODES[2], [1, 0], 8, 'Carousel');
const DISCO = place(NODES[5], [1, 0], 12, 'Discotron');
const FLUME = place(NODES[8], [1, 0], 4, 'LogFlume');
const WHEEL = place(NODES[11], [0, 1], 4, 'FerrisWheel');
const GHOST = place(NODES[15], [0, -1], 6, 'GhostTrain');
const KARTS = place(NODES[21], [-1, 0], 6, 'GoKarts');
const PADS: XZ[] = [CAROUSEL.pad, DISCO.pad, FLUME.pad, WHEEL.pad, GHOST.pad, KARTS.pad];
console.log('[park] pads', { CAROUSEL: CAROUSEL.pad, DISCO: DISCO.pad, FLUME: FLUME.pad, WHEEL: WHEEL.pad, GHOST: GHOST.pad, KARTS: KARTS.pad });

/* ─────────────────────────────────────────────────────────────────────────────
 * THE THREE WORLDS — declared AFTER the pads exist, out of them
 * ───────────────────────────────────────────────────────────────────────────── */
const FIRE_WORLD = worldPlan({
  id: 'cinderreach', theme: FIRE, pieces: [EMBER_ROW],
  include: [KARTS.pad, KARTS.anchor, NODES[21], RING.deckW, RING.tailW, ...FIRE_PROPS],
});
const STEAM_WORLD = worldPlan({
  id: 'gearhaven', theme: STEAMPUNK, pieces: [GEAR_ROW],
  include: [WHEEL.pad, WHEEL.anchor, NODES[11], RING.deckE, RING.tailE, ...STEAM_PROPS],
});
const NEON_WORLD = worldPlan({
  id: 'voltyard', theme: NEON_CITY, pieces: [NEON_ROW],
  include: [DISCO.pad, DISCO.anchor, NODES[5], RING.deckN, RING.tailN, ...NEON_PROPS],
});
const WORLDS = [FIRE_WORLD, STEAM_WORLD, NEON_WORLD];

const WORLD_MIN_GAP = 20 * Math.sqrt(SIZE / 48);   // 32.66 at 128
// The world layer's field SHAPES are read defensively: an unreadable field must degrade to a
// printed line, never to a module-scope TypeError (which would blank the whole park).
const xzOf = (v: unknown): XZ | null =>
  Array.isArray(v) && typeof v[0] === 'number' && typeof v[1] === 'number' ? [v[0], v[1]] : null;
for (let i = 0; i < WORLDS.length; i += 1)
  for (let j = i + 1; j < WORLDS.length; j += 1) {
    const a = WORLDS[i], b = WORLDS[j];
    const ac = xzOf(a.centre), bc = xzOf(b.centre), ah = xzOf(a.half), bh = xzOf(b.half);
    if (!ac || !bc) { console.warn('[park] worldPlan.centre is not an XZ — spacing unverified'); continue; }
    const d = Math.hypot(ac[0] - bc[0], ac[1] - bc[1]);
    parkAssert('worldSpacing', d >= WORLD_MIN_GAP,
      `worlds '${a.id}' ${JSON.stringify(ac)} and '${b.id}' ${JSON.stringify(bc)} are ` +
      `${d.toFixed(2)} u apart — the floor is ${WORLD_MIN_GAP.toFixed(2)} u`, 'advisory');
    if (!ah || !bh) continue;
    const gap = Math.max(
      Math.abs(ac[0] - bc[0]) - (ah[0] + bh[0]),
      Math.abs(ac[1] - bc[1]) - (ah[1] + bh[1]));
    parkAssert('worldGap', gap > 0,
      `world RECTS '${a.id}' and '${b.id}' overlap or touch (gap ${gap.toFixed(2)}) — touching rects are ONE district`,
      'advisory');
  }
console.log('[park] worlds', WORLDS.map((w) => ({ id: w.id, centre: w.centre, half: w.half })));
([[FIRE_WORLD, RING.deckW, KARTS.pad], [STEAM_WORLD, RING.deckE, WHEEL.pad],
  [NEON_WORLD, RING.deckN, DISCO.pad]] as [typeof FIRE_WORLD, XZ, XZ][]).forEach(([w, deck, pad]) => {
    if (typeof w.contains !== 'function') {
      console.warn(`[park] worldPlan('${w.id}').contains is not callable — containment unverified`);
      return;
    }
    parkAssert('deckInWorld', w.contains(deck),
      `world '${w.id}' does NOT contain its monorail deck [${deck}] — everyWorldTouched will read false. ` +
      `Move the WORLD's rect; the deck cells are the ring's own geometry and are fixed.`, 'advisory');
    parkAssert('worldNotBuiltOut', w.contains(pad),
      `world '${w.id}' has no REGISTERED ride pad inside its rect (pad [${pad}])`, 'advisory');
  });

/* ─────────────────────────────────────────────────────────────────────────────
 * §0-P.5  STRUCTURAL WIRING ASSERTIONS
 * ───────────────────────────────────────────────────────────────────────────── */
const SOLID_CLEAR: Record<string, number> = { FountainPlaza: 1.8, Bazaar: 0.6, Boulevard: 0 };
function assertNodesOffPieces(nodes: XZ[], plans: SetPiecePlan[], sev: Sev = 'structural'): void {
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
    `${hits.length} authored cell(s) stand inside or against a set-piece's SOLID footprint:\n  ` + hits.join('\n  '),
    sev);
}
assertNodesOffPieces(NODES, ALL_PLANS);
assertNodesOffPieces(PADS, ALL_PLANS, 'advisory');

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
  parkAssert('cardinalEdge', Math.abs(A[0] - B[0]) < EPS || Math.abs(A[1] - B[1]) < EPS,
    `edge ${a}→${b} is DIAGONAL: [${A}] → [${B}]. buildParkNet ELBOWS it through a synthesised corner ` +
    `node at [${A[0]}, ${B[1]}] that you did not plan. FIX THE TABLE.`, 'advisory');
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
      `chain piece '${p.id}' (${p.kind}) wires [${[...wired]}] but NOT '${p.id}:${pt.name}' — that end of the ` +
      `carriageway dead-ends in grass (deadStreetNode).`);
  });
});

// THE FOUR RING TAILS MUST BE LEAVES — a street continuing past a tail runs through the deck.
const DEGREE = new Map<number, number>();
EDGES.forEach(([a, b]) => [a, b].forEach((e) => {
  if (typeof e === 'number') DEGREE.set(e, (DEGREE.get(e) ?? 0) + 1);
}));
([[7, RING.tailN], [13, RING.tailE], [19, RING.tailW], [28, RING.tailS]] as [number, XZ][])
  .forEach(([idx, cell]) => {
    parkAssert('ringTailLeaf', (DEGREE.get(idx) ?? 0) === 1,
      `monorail tail node ${idx} [${cell}] has degree ${DEGREE.get(idx) ?? 0} — it MUST be a LEAF, or the ` +
      `street continues through the deck (blockers FAIL)`);
    parkAssert('ringTailNode', Math.abs(NODES[idx][0] - cell[0]) < EPS && Math.abs(NODES[idx][1] - cell[1]) < EPS,
      `NODES[${idx}] is [${NODES[idx]}] but the derived monorail tail is [${cell}]`);
  });

// NO QUEUE TAIL SITS ON A SET-PIECE PORT.
const ALL_PORT_CELLS = new Set(ALL_PLANS.flatMap((p) =>
  p.ports.map((pt) => `${pt.at[0].toFixed(2)},${pt.at[1].toFixed(2)}`)));
([NODES[2], NODES[5], NODES[8], NODES[9], NODES[11], NODES[15], NODES[21], NODES[26],
  RING.tailN, RING.tailE, RING.tailW, RING.tailS] as XZ[]).forEach((t) =>
    parkAssert('tailOnPort', !ALL_PORT_CELLS.has(`${t[0].toFixed(2)},${t[1].toFixed(2)}`),
      `queue tail [${t}] is a set-piece PORT cell`));

// ADVISORY pre-filter: every authored cell on the pinned row's water.
const AUTHORED: XZ[] = [...NODES, ...RING_CELLS, ...PADS, ...FIRE_PROPS, ...STEAM_PROPS, ...NEON_PROPS];
const WET_AUTHORED = AUTHORED.filter((c) => !offRow(c));
if (WET_AUTHORED.length)
  console.warn(`[park] ${WET_AUTHORED.length} authored cell(s) sit on the pinned row's water: ` +
    JSON.stringify(WET_AUTHORED));

/* ─────────────────────────────────────────────────────────────────────────────
 * DRESSING — over-provisioned, off-street, and sieved for water IN THE TREE
 * ───────────────────────────────────────────────────────────────────────────── */
type Rect = { x0: number; x1: number; z0: number; z1: number };
const KEEP_OUT: Rect[] = [
  // §4.0-L bbox + 2, §4.0-B bbox + 2
  { x0: -23.8, x1: 18.8, z0: -16.5, z1: 19.8 },
  { x0: -64.5, x1: -31.6, z0: -63.3, z1: -28.9 },
  // the four monorail ring legs, half-width 2.0
  { x0: -44.6, x1: -40.6, z0: RING.deckS[1] - 6, z1: RING.deckN[1] + 6 },
  { x0: 40.6, x1: 44.6, z0: RING.deckS[1] - 6, z1: RING.deckN[1] + 6 },
  { x0: -38.6, x1: 38.6, z0: RING.deckN[1] - 2, z1: RING.deckN[1] + 2 },
  { x0: -38.6, x1: 38.6, z0: RING.deckS[1] - 2, z1: RING.deckS[1] + 2 },
  // the hub pad
  { x0: -8.4, x1: 8.4, z0: 37.2, z1: 54.0 },
];
const inRect = (c: XZ, r: Rect) => c[0] >= r.x0 && c[0] <= r.x1 && c[1] >= r.z0 && c[1] <= r.z1;
const RESERVED: { c: XZ; r: number }[] = [
  ...PADS.map((p) => ({ c: p, r: 7.2 })),
  ...ALL_PLANS.map((p) => ({ c: [p.footprint.cx, p.footprint.cz] as XZ, r: Math.max(p.footprint.hx, p.footprint.hz) + 3.0 })),
  ...FIRE_PROPS.map((c) => ({ c, r: 2.4 })),
  ...STEAM_PROPS.map((c) => ({ c, r: 2.4 })),
  ...NEON_PROPS.map((c) => ({ c, r: 2.4 })),
  ...RING_CELLS.map((c) => ({ c, r: 3.6 })),
];
const freeCell = (c: XZ, pitch: number, taken: XZ[]) =>
  Math.abs(c[0]) <= 58 && Math.abs(c[1]) <= 58 &&
  offRow(c) && isDry(c) && bumpAt(c) <= 2.2 &&
  !KEEP_OUT.some((r) => inRect(c, r)) &&
  !RESERVED.some((d) => Math.hypot(c[0] - d.c[0], c[1] - d.c[1]) < d.r) &&
  !taken.some((t) => Math.hypot(c[0] - t[0], c[1] - t[1]) < pitch);

function scatter(count: number, pitch: number, clear: number, salt: number): XZ[] {
  const out: XZ[] = [];
  for (let i = 0; out.length < count && i < 4000; i += 1) {
    const raw: XZ = [
      +(((hash01(i * 2 + salt) * 2 - 1) * 58)).toFixed(2),
      +(((hash01(i * 2 + salt + 1013) * 2 - 1) * 58)).toFixed(2),
    ];
    if (!freeCell(raw, pitch, out)) continue;
    const off = offPathCell(NET, raw, { clear });
    if (!off) continue;
    const c = off as XZ;
    if (!freeCell(c, pitch, out)) continue;
    out.push(c);
  }
  return out;
}

const TREE_SHAPES = ['round', 'pine', 'willow', 'round', 'pine'] as const;
type TreeShape = (typeof TREE_SHAPES)[number];
const TREES: { at: XZ; shape: TreeShape }[] = scatter(46, 3.0, 0.75, 7)
  .map((at, i) => ({ at, shape: TREE_SHAPES[i % TREE_SHAPES.length] }));

const SCENERY_NAMES = [
  'planterBox', 'topiarySpiral', 'birdbath', 'picnicTable', 'marbleStatue', 'signpost',
  'parkClock', 'flagpole', 'wishingWell', 'lionStatue', 'fallenLog', 'mushroomCluster',
  'gazebo', 'topiaryElephant', 'ironArchway', 'picketFence', 'brickWall', 'birdbath',
] as const;
type SceneryName = (typeof SCENERY_NAMES)[number];
const SCENERY: { at: XZ; name: SceneryName }[] = scatter(26, 5.4, 1.2, 4201)
  .map((at, i) => ({ at, name: SCENERY_NAMES[i % SCENERY_NAMES.length] }));

parkAssert('dressFloor', TREES.length >= 36 && SCENERY.length >= 20,
  `authored dressing is under the over-provision target: ${TREES.length} trees (want >= 36 for a 32 floor) ` +
  `and ${SCENERY.length} scenery cells (want >= 20 for a 16 floor)`, 'advisory');
console.log(`[park] dressing authored — ${TREES.length} trees, ${SCENERY.length} scenery, ` +
  `${FIRE_PROPS.length + STEAM_PROPS.length + NEON_PROPS.length} world-themed pieces`);

const RESTROOM = (offPathCell(NET, [-12.0, 37.2], { clear: 1.8 }) ?? [-12.0, 37.2]) as XZ;

parkAssertFlush();

/* ─────────────────────────────────────────────────────────────────────────────
 * §0-P.6  THE RECEIPT — the GATE'S OWN dryness predicate, in the tree
 * ───────────────────────────────────────────────────────────────────────────── */
type ParkCtx = ReturnType<typeof usePark>;
function dryRing(park: ParkCtx, c: XZ, r = 0.75): boolean {
  const g = park.ground;
  if (!g) { console.error('[park] dryRing ran with NO TERRAIN — a VACUOUS pass'); return true; }
  const dry = (x: number, z: number) => g.lint.isDry(x, z, 0.05);
  if (!dry(c[0], c[1])) return false;
  for (let k = 0; k < 8; k += 1) {
    const a = (k / 8) * Math.PI * 2;
    if (!dry(c[0] + Math.cos(a) * r, c[1] + Math.sin(a) * r)) return false;
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
      console.error(`[park] DryScatter dropped ${cells.length - kept.length} of ${cells.length} ` +
        `cell(s) UNDER waterline+0.05: ${JSON.stringify(cells.filter((c) => !kept.includes(c)).map((c) => c.at))}`);
    setDry(kept);
  }, [park, cells]);
  return <>{(dry ?? []).map(render)}</>;
}

const PAD_RECEIPT = [...PADS, ...RING_CELLS, RESTROOM].map((at) => ({ at }));

const ROSTER_NAMES = [
  'Cinderloop Ascent', 'Foundry Flyer', 'Grand Circle Monorail', 'Emberfall Cascade',
  'Hollowbrook Manor', 'Gilded Mare Carousel', 'Brasswork Big Wheel', 'Pulse Gyro',
  'Cinder Circuit Karts',
];

/* ═══ THE PARK ══════════════════════════════════════════════════════════════ */
export function App() {
  return (
    <Park
      seed={SEED}
      climate={CLIMATE}
      roster={{ rides: ROSTER_NAMES, stalls: 9, categories: 5 }}
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

      {/* ── THRILL — the two rated circuits, pieces mode, cars 3, no bank prop ── */}
      <Coaster
        name="Cinderloop Ascent" pieces={L_PIECES} start={L_START} heading={0}
        type="steel" cars={3} capacity={4} rideDuration={11} loadTime={2} intensity={9}
        price={7} queueTailNode={NET.node(L_TAIL)} queueDir={[1, 0]}
      />
      <Coaster
        name="Foundry Flyer" pieces={B_PIECES} start={B_START} heading={0}
        type="steel" cars={3} capacity={4} rideDuration={12} loadTime={2} intensity={6}
        price={5} queueTailNode={NET.node(B_TAIL)} queueDir={[1, 0]}
      />

      {/* ── TRANSPORT — the park-spanning multi-station ring ── */}
      <Monorail
        position={[RING.pose[0], 0, RING.pose[1]]} rotation={0} pieces={MONO_PIECES}
        beamY={2.6} loopSeconds={12} pinned
        name="Grand Circle Monorail" capacity={6} rideDuration={12} intensity={1} price={0}
        queue={{ anchor: RING.anchW, dir: [1, 0] }}
        register={{
          board: [RING.deckW[0], 2.6, RING.deckW[1]],
          stations: [
            {
              label: 'North', boardPoint: [RING.deckN[0], 2.6, RING.deckN[1]],
              queueAnchor: [RING.anchN[0], 0.05, RING.anchN[1]], queueDir: [0, -1],
              exitPoint: [RING.exitN[0], 0.05, RING.exitN[1]], exitDir: [0, -1],
            },
            {
              label: 'East', boardPoint: [RING.deckE[0], 2.6, RING.deckE[1]],
              queueAnchor: [RING.anchE[0], 0.05, RING.anchE[1]], queueDir: [-1, 0],
              exitPoint: [RING.exitE[0], 0.05, RING.exitE[1]], exitDir: [-1, 0],
            },
            {
              label: 'South', boardPoint: [RING.deckS[0], 2.6, RING.deckS[1]],
              queueAnchor: [RING.anchS[0], 0.05, RING.anchS[1]], queueDir: [0, -1],
              exitPoint: [RING.exitS[0], 0.05, RING.exitS[1]], exitDir: [0, -1],
            },
          ],
        }}
      />

      {/* ── GENTLE — the entrance court carries the gate-walk budget ── */}
      <Carousel
        position={CAROUSEL.pad} rotation={-Math.PI / 2}
        register={{ name: 'Gilded Mare Carousel', capacity: 8, rideDuration: 11, intensity: 2, price: 3 }}
        queue={{ anchor: CAROUSEL.anchor, dir: CAROUSEL.dir }}
      />

      {/* ── WATER ── */}
      <LogFlume
        position={FLUME.pad} rotation={-Math.PI / 2}
        register={{ name: 'Emberfall Cascade', capacity: 4, rideDuration: 12, intensity: 5, price: 5 }}
        queue={{ anchor: FLUME.anchor, dir: FLUME.dir }}
      />

      {/* ── DARK ── */}
      <GhostTrain
        position={GHOST.pad} rotation={0}
        register={{ name: 'Hollowbrook Manor', capacity: 6, rideDuration: 12, intensity: 4, price: 4 }}
        queue={{ anchor: GHOST.anchor, dir: GHOST.dir }}
      />

      {/* ── THE THREE WORLDS ── */}
      <World plan={FIRE_WORLD} />
      <World plan={STEAM_WORLD} />
      <World plan={NEON_WORLD} />

      <FountainPlaza plan={HUB} />
      <Bazaar plan={EMBER_ROW} />
      <Bazaar plan={GEAR_ROW} />
      <Bazaar plan={NEON_ROW} />

      {/* cinderreach (fire) — its own ride, its own counter, its own scenery */}
      <GoKarts
        position={KARTS.pad} rotation={Math.PI / 2}
        register={{ name: 'Cinder Circuit Karts', capacity: 6, rideDuration: 12, intensity: 6, price: 5 }}
        queue={{ anchor: KARTS.anchor, dir: KARTS.dir }}
      />
      <BasaltColumns position={FIRE_PROPS[0]} seed={3} rotation={0.4} />
      <CharredSnag position={FIRE_PROPS[1]} seed={5} rotation={0.9} />
      <Fumarole position={FIRE_PROPS[2]} seed={2} />
      <ObsidianShards position={FIRE_PROPS[3]} seed={7} rotation={0.6} />

      {/* gearhaven (steampunk) */}
      <FerrisWheel
        position={WHEEL.pad} rotation={Math.PI}
        register={{ name: 'Brasswork Big Wheel', capacity: 4, rideDuration: 11, intensity: 3, price: 4 }}
        queue={{ anchor: WHEEL.anchor, dir: WHEEL.dir }}
      />
      <GiantGear position={STEAM_PROPS[0]} seed={2} rotation={Math.PI} />
      <SteamPipes position={STEAM_PROPS[1]} seed={4} rotation={Math.PI} />
      <BoilerTank position={STEAM_PROPS[2]} seed={6} rotation={1.35} />
      <ClockTower position={STEAM_PROPS[3]} seed={8} rotation={0} />

      {/* voltyard (neon) */}
      <Discotron
        position={DISCO.pad} rotation={Math.PI}
        register={{ name: 'Pulse Gyro', capacity: 12, rideDuration: 12, intensity: 6, price: 4 }}
        queue={{ anchor: DISCO.anchor, dir: DISCO.dir }}
      />
      <NeonArch position={NEON_PROPS[0]} rotation={0} seed={3} />
      <MirrorBallPylon position={NEON_PROPS[1]} seed={5} />
      <SpeakerStack position={NEON_PROPS[2]} seed={7} rotation={Math.PI} />
      <LaserTruss position={NEON_PROPS[3]} seed={9} rotation={0} />

      {/* ── amenities, signage and night ── */}
      <Restroom position={RESTROOM} rotation={Math.PI / 2} />
      <Neon text="CINDERREACH" position={[0, 1.7, 60.0]} rotation={Math.PI} scale={0.6} />
      <Neon text="VOLTYARD" position={[19.2, 1.7, 36.0]} rotation={Math.PI / 2} scale={0.5} />

      {/* ── the dryness RECEIPT over cells that cannot be dropped ── */}
      <DryScatter cells={PAD_RECEIPT} render={() => null} />

      {/* ── the sieved dressing, LAST in the tree ── */}
      <DryScatter
        cells={TREES}
        render={(t, i) => (
          <Placed key={`tr-${i}`} position={t.at} build={(three) => tree(three, { shape: t.shape })} />
        )}
      />
      <DryScatter
        cells={SCENERY}
        render={(s, i) => <Scenery key={`sc-${i}`} name={s.name} position={s.at} seed={i + 1} />}
      />
    </Park>
  );
}


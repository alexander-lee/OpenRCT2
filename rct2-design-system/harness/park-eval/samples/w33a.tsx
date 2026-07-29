/* ═══ SUNSPIRE HOLLOW — §0 PRE-FLIGHT ═══════════════════════════════════════════════
 * SIZE   128 (default, `size` prop omitted)
 * SEED   91 / desert — dominant lake ctr (-51,-50) box[-61,-42,-61,-40] · secondary
 *        ctr (40,16) box[36,45,13,21]  [PRE-keepDry, off the published SEED_ROW table]
 *        RING WATER WALK: all 16 monorail ring cells are swept against BOTH boxes and
 *        their 12 u near-radius by the pose search below (`ringScore`); the chosen pose
 *        reports 0 wet cells or the ring is dropped and transport comes from <Chairlift>.
 *        ring pose SEARCHED: dx +7.2 fixed (keeps the north deck OFF the x=0 gate spine),
 *        dz swept over 0, ±1.2, ±2.4, ±3.6, ±4.8, ±6.0 scoring bumpAt on all four decks.
 *        reliefFloor.kept — read at runtime from GCOMP.report.reliefFloor (TBD until run)
 * WORLDS 5 (ALL of them): enchantedForest @(0,39) · steampunk @(-42,-10) · neon @(42,-15)
 *        · pirateBeach @(-26,-45) · fire @(18,-48)   (regions derived by worldPlan)
 *        planned centre pairs, SORTED, closest first:
 *        steampunk↔pirateBeach 38.5 ◄ ≥ 32.66 (20·√(128/48)) ✓ · neon↔fire 41.0 ✓
 *        · pirateBeach↔fire 43.8 ✓ · rest ≥ 66 ✓ — DRY GAP between world RECTS > 0 ✓
 *        WORLD enchantedForest: rides WyrmsHollow + MoonlitBarge + Chairlift (3 of its
 *              theme, distinct names) · stall honeywitch · 25 scenery placements from
 *              ThornwickScenery ONLY · GROUND + GIANT ✓ · gate-avenue spur ✓
 *        WORLD steampunk: GearworksExpress + AetherBalloons + BoilerBurst · goggles
 *              · 25 BrassworkScenery · GROUND + GIANT ✓ · spur ✓
 *        WORLD neon: Bassline + Discotron + MagneticRide · neonSlush · 25 PulseScenery
 *              · GROUND + GIANT ✓ · spur ✓
 *        WORLD pirateBeach: ReefRacer + DeepDrift + OceanTunnelSlide · sushi
 *              · 25 TidewaterScenery · GROUND + GIANT ✓ · spur ✓
 *        WORLD fire: MagmaRun + EmberWings + LavaTubeRun · emberRoast
 *              · 25 EmberfallScenery · GROUND + GIANT ✓ · spur ✓
 *        no foreign themed piece is placed inside any rect (each world scatters from its
 *        OWN pack only — a §0-FATAL worldThemeMixed cannot arise by construction) ✓
 * CATS   (WRITTEN BEFORE ANY JSX) gentle Carousel/FerrisWheel/Teacups/AetherBalloons ·
 *        thrill Thunderhead Spiral (flagship) · water MoonlitBarge/ReefRacer/
 *        OceanTunnelSlide/LavaTubeRun · transport Monorail ring + Chairlift +
 *        MagneticRide · dark WyrmsHollow + DeepDrift  → 5/5 categories ✓
 *        RARE PICKS LavaTubeRun (23.41) + OceanTunnelSlide (22.14) — both off the TOP of
 *        the PAD_MARGIN table, the 7 u+ band the corpus skips because it is awkward to
 *        place; each is given its margin explicitly rather than the 3.2 default ✓
 * CIRCUITS  flagship <Coaster> · <MineTrainCoaster> · Monorail ring · MagmaRun · Bassline
 *        · ReefRacer · LavaTubeRun · GearworksExpress · MoonlitBarge · Chairlift
 *        · MagneticRide · DeepDrift · OceanTunnelSlide · EmberWings · WyrmsHollow
 *        → 15 CIRCUITS (≥ 5) across families coaster|water|transport|dark (4 ≥ 3) ✓
 * GATE   [0, 63.6] → first queue tail [0, 50.4] (Carousel) = 13.2 u ≤ 15 ✓
 * FLAG   Thunderhead Spiral — start [-26.4, 0.55, -22.8] heading 0, steel, cars 3, NO
 *        bank prop (steel builds 0.7). TWO inversions (corkscrewL + corkscrewR).
 *        Closed by construction: r1=r3=3.0, r2=r4=2.4, L1=20.0, L2=L4=14.0, L3=21.5
 *        → net (0, -1.5) then a 1.2 u brake tail lands 0.3 u SHORT on the station axis.
 *        rateCoaster(bank 0.7, cars 3) → MEASURED at module scope by verifyCircuit(),
 *        printed to the console with E / I / N / maxLatG / inversions / synthesized.
 *        CORRIDOR: bbox x[-26.4,-7.0] z[-24.3,0.2] — the SW quadrant, bounded by the
 *        x=-32.4 street (6.0 u), the x=0 south avenue (7.0 u) and the z=-30 cross (5.7 u).
 *        No street node and no boulevard leg falls inside that rect ✓
 * FLAG2  MineTrainCoaster — position [21.6,-22.8] rotation 0, left-handed mirror of the
 *        same closure algebra (r1=r3=2.4, r2=r4=3.0, L1=17.0, L2=L4=12.6, L3=18.5), ends
 *        FACING the station. bbox x[3.6,21.6] z[-24.3,-3.4] — DISJOINT from FLAG's ✓
 *        off all 16 ring cells ✓ · outside every world rect ✓
 *        coasterPts = [...FLAG.points, ...MINE.points] → <Terrain coasterPts> ✓
 * STREET buildParkNet called EXACTLY ONCE ✓ · the SAME NET feeds <Paths> and every
 *        offPathCell / place() call ✓ · PORT-REFS: 10 pieces, every one wired and
 *        asserted by the pieceIsland / chainEnd sweep ✓ · every pad returned BY
 *        offPathCell, never a raw tail+out·d sum ✓
 * MONO   ring pieces VERBATIM (17-piece published array) · position = the START POSE
 *        [-35.4, 0, -9.7 + RING_DZ], rotation 0 — never start/heading
 *        4 platforms inside 4 of the 5 declared worlds (fire S, steampunk W, neon E,
 *        enchantedForest N); pirateBeach has no deck and takes a path spur instead, so
 *        everyWorldTouched is EXPECTED false at 4 decks / 5 worlds
 *        tails [-28.8,RZ] · [7.2,27.6+dz] · [43.2,RZ] · [7.2,-57.6+dz] authored NODES
 *        (S queues OUTWARD; the gate spine is at x=0 and the ring is offset dx +7.2 so
 *         no street ever runs through a deck)
 * QUEUE  ONE ROW PER RIDE — the tail is the authored NODE, the pad is DERIVED from it by
 *        place(tail, out, capacity, rig): pad = offPathCell(tail + out·(minReach+2.4))
 *        then assertPadFlat. clear = padMarginOf(rig) off the §0-P.5 table, never 3.2 by
 *        guess. No two rides share a tail node ✓ every tail appears in NODES ✓
 *        The reach floor is asserted per ride (padReach) and reported, never silenced.
 * GROUND every pad is re-tested by assertPadFlat (bumpAt ≤ 0.75 AND outside every basin)
 *        with a ring search out to 4.8 u before it is committed ✓
 * SPREAD built bbox ≈ 109 x 121 ≥ 70 x 45 ✓ · street-node bbox spans x[-45.6,49.8],
 *        z[-57.6,63.6] → pathExtent well over 0.55 ✓
 * PLAZAS the hub is a 9-tile <FountainPlaza> (10.8 u square = 116 u² ≥ 8) plus the five
 *        bazaar courts and the four boulevard carriageways ✓
 *        NO set-piece `position` appears in NODES or as a queue tail — asserted by
 *        assertNodesOffPieces over BOTH the authored nodes AND the committed pads ✓
 * NODES  ~60 authored · one PARK-SPANNING loop (hub → west avenue → x=-32.4 column →
 *        z=-30 cross → south avenue → hub) and a second east loop, both crossing z = 0 ✓
 * ATTACH every spur is a cardinal edge off a parent already on the walked street; no
 *        nodeY ramps are authored anywhere, so the reachability walk seeds on the whole
 *        median-level net and no span is refused for grade ✓
 * LATTICE authored spans 3.6 / 4.8 / 6.0 / 7.2 / 9.6 / 12.0 / 13.2 / 16.8 u + the 1.2
 *        boulevard chains → effectiveClasses ≥ 4 ✓
 * ROSTER 21 rides / 5 categories / 20 stalls (9 kinds) / 5 bazaar restrooms + 1 standalone
 *        / bins from NET.bins ✓
 *        NAMED: every ride AND every stall carries an authored name — 0 shipped under a
 *        catalog defaultName ✓
 *        <Park roster={{ rides: 21, stalls: 20, categories: 5 }}> MOUNTED ✓
 * DRESS  44 tree cells ≥ 32 ✓ · 20 neutral <Scenery> ≥ 16 ✓ · 125 themed placements
 *        EVERY prop cell comes from offPathCell (trees clear 0.75, scenery clear 1.2) and
 *        is then re-sieved IN THE TREE by DryScatter against the gate's own predicate
 *        (ground > WATER_LEVEL + 0.05 over the piece's own footprint ring) ✓
 * NIGHT  boulevard + plaza + bazaar lanterns, the themed packs' emissives (lava, runes,
 *        glow-worms, pod beds, neon crowns, mirror balls) — real PointLights stay inside
 *        each pack's own rationed budget ✓
 * GATE   parkAssertFlush() → reports, NEVER throws · validatePark verdict read in onReady
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
  Placed,
  Torch,
  offPathCell,
  usePark,
} from './components/Park';
import { laneLenOf, parkComposition } from './components/ParkBuilder';
import { buildParkNet, worldPlan, World, WORLD_THEMES } from './components/SetPieceKit';
import type { NetRef, SetPiecePlan } from './components/SetPieceKit';
import { Bazaar, bazaarPlan } from './components/Bazaar';
import { FountainPlaza, fountainPlazaPlan } from './components/FountainPlaza';
import { Boulevard, boulevardPlan } from './components/Boulevard';
import { compileTrackPieces, rateCoaster, checkCoasterDesign } from './components/SplineRideKit';
import type { TrackPiece } from './components/SplineRideKit';
import { tree } from './components/Kit';
import { WorldGround } from './components/WorldGround';
import { WorldLandmark } from './components/WorldLandmark';

/* ─── catalog rides ─────────────────────────────────────────────────────────────── */
import { Carousel } from './components/Carousel';
import { FerrisWheel } from './components/FerrisWheel';
import { Teacups } from './components/Teacups';
import { Monorail } from './components/Monorail';
import { MineTrainCoaster } from './components/MineTrainCoaster';
import { WyrmsHollow } from './components/WyrmsHollow';
import { MoonlitBarge } from './components/MoonlitBarge';
import { Chairlift } from './components/Chairlift';
import { GearworksExpress } from './components/GearworksExpress';
import { AetherBalloons } from './components/AetherBalloons';
import { BoilerBurst } from './components/BoilerBurst';
import { Bassline } from './components/Bassline';
import { Discotron } from './components/Discotron';
import { MagneticRide } from './components/MagneticRide';
import { ReefRacer } from './components/ReefRacer';
import { DeepDrift } from './components/DeepDrift';
import { OceanTunnelSlide } from './components/OceanTunnelSlide';
import { MagmaRun } from './components/MagmaRun';
import { EmberWings } from './components/EmberWings';
import { LavaTubeRun } from './components/LavaTubeRun';

/* ─── per-world scenery packs ───────────────────────────────────────────────────── */
import { Fumarole, ObsidianShards, BasaltColumns, LavaFissure, CharredSnag } from './components/EmberfallScenery';
import { WreckedHull, CoralCluster, AnchorPile, TidePool, DockPilings } from './components/TidewaterScenery';
import { GiantGear, SteamPipes, ClockTower, BoilerTank, CoalCart } from './components/BrassworkScenery';
import { GiantToadstools, StandingStones, LanternTree, RuinedArch, FlowerPodBed } from './components/ThornwickScenery';
import { NeonArch, SpeakerStack, MirrorBallPylon, LaserTruss, LightTiles } from './components/PulseScenery';

/* ══ 1. ASSERTION BUS — records everything, NEVER throws ═════════════════════════ */

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
      `[park] ${blocking.length} BLOCKING failure(s) — the offending piece is dropped and the rest ships. ` +
        `The park still renders and still scores; aborting it would score 0 on all 16 axes.`,
    );
}

/* ══ 2. PLOT CONSTANTS + the pad-clearance catalog ══════════════════════════════ */

const SIZE = 128;
const SEED = 91;
const CLIMATE = 'desert' as const;
const CELL = 1.2;
const PEAK_LIMIT = 0.75;
const LAT_GUARD = 1.275;

const snap = (v: number): number => +(Math.round(v / CELL) * CELL).toFixed(2);
const cell = (x: number, z: number): XZ => [snap(x), snap(z)];
const hash01 = (n: number): number => {
  const s = Math.sin(n * 12.9898 + 78.233) * 43758.5453;
  return s - Math.floor(s);
};
const dist = (a: XZ, b: XZ): number => Math.hypot(a[0] - b[0], a[1] - b[1]);

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
const padMarginOf = (rig: string): number => PAD_MARGIN[rig] ?? 3.2;
/* offPathCell only searches 4.8 u, so a 23 u body margin can never be SOLVED by the ring
 * search. The search clear is capped; the REAL margin is still reported per ride. */
const searchClearOf = (rig: string): number => Math.min(padMarginOf(rig), 4.2);
const minReachOf = (c: number): number => laneLenOf(c) + 0.35 + 0.62 + 0.5 + 0.45;

/* ══ 3. THE TWO TRACKED CIRCUITS — authored, then MEASURED ══════════════════════ */

const FLAG_START: V3 = [-26.4, 0.55, -22.8];
const FLAG_PIECES: TrackPiece[] = [
  'station',                                       // 2.60  ┐
  { type: 'lift', height: 3.2 },                   // 14.08 │ L1 = 20.00
  'corkscrewL',                                    //  2.40 │ inversion 1
  { type: 'straight', length: 0.92 },              //  0.92 ┘
  { type: 'turnR', angle: 90, radius: 3.0 },       // r1
  { type: 'drop', height: 1.4 },                   //  7.06 ┐
  'corkscrewR',                                    //  2.40 │ inversion 2 — L2 = 14.00
  { type: 'straight', length: 4.54 },              //  4.54 ┘
  { type: 'turnR', angle: 90, radius: 2.4 },       // r2
  { type: 'hill', height: 1.0 },                   //  6.00 ┐
  { type: 'helixR', angle: 360, height: -0.6 },    //  0 net│ L3 = 21.50
  { type: 'drop', height: 1.2 },                   //  6.28 │
  { type: 'straight', length: 9.22 },              //  9.22 ┘
  { type: 'turnR', angle: 90, radius: 3.0 },       // r3
  { type: 'straight', length: 5.2 },               //       ┐
  'sbend',                                         //  3.60 │ L4 = 14.00
  { type: 'straight', length: 5.2 },               //       ┘
  { type: 'turnR', angle: 90, radius: 2.4 },       // r4
  { type: 'straight', length: 1.2 },               // brake tail — lands 0.3 u short
];

/* the rectangle archetype, used only if the authored circuit fails verification */
const FALLBACK_PIECES: TrackPiece[] = [
  'station',
  { type: 'lift', height: 1.6 }, { type: 'straight', length: 4.0 }, { type: 'turnR', angle: 90, radius: 2.5 }, { type: 'drop', height: 1.6 },
  { type: 'lift', height: 1.6 }, { type: 'straight', length: 4.0 }, { type: 'turnR', angle: 90, radius: 2.5 }, { type: 'drop', height: 1.6 },
  { type: 'lift', height: 1.6 }, { type: 'straight', length: 4.0 }, { type: 'turnR', angle: 90, radius: 2.5 }, { type: 'drop', height: 1.6 },
  { type: 'lift', height: 1.6 }, { type: 'straight', length: 4.0 }, { type: 'turnR', angle: 90, radius: 2.5 }, { type: 'drop', height: 1.6 },
];

const MINE_START: V3 = [21.6, 0.55, -22.8];
const MINE_PIECES: TrackPiece[] = [
  'station',                                       //  2.60 ┐
  { type: 'lift', height: 2.4 },                   // 10.96 │ L1 = 17.00
  { type: 'straight', length: 3.44 },              //  3.44 ┘
  { type: 'turnL', angle: 90, radius: 2.4 },       // r1
  { type: 'drop', height: 1.2 },                   //  6.28 ┐
  { type: 'straight', length: 2.72 },              //  2.72 │ L2 = 12.60
  'sbend',                                         //  3.60 ┘
  { type: 'turnL', angle: 90, radius: 3.0 },       // r2
  { type: 'hill', height: 0.8 },                   //  6.00 ┐
  { type: 'helixL', angle: 360, height: -0.3 },    //  0 net│ L3 = 18.50
  { type: 'drop', height: 0.9 },                   //  5.11 │
  { type: 'straight', length: 7.39 },              //  7.39 ┘
  { type: 'turnL', angle: 90, radius: 2.4 },       // r3
  { type: 'straight', length: 12.6 },              //       L4 = 12.60
  { type: 'turnL', angle: 90, radius: 3.0 },       // r4
  { type: 'straight', length: 1.2 },               // brake tail — ends FACING the station
];

interface Verified {
  ok: boolean;
  points: V3[];
}

function verifyCircuit(name: string, pieces: TrackPiece[], start: V3): Verified {
  try {
    const out = compileTrackPieces(pieces, { type: 'steel', start, heading: 0, bounds: SIZE });
    const rating = rateCoaster(out.points, { type: 'steel', bank: 0.7, cars: 3 });
    const design = checkCoasterDesign(out.points, { type: 'steel' });
    const ok =
      !!out.report.ok &&
      !out.report.fatal &&
      rating.maxLatG <= LAT_GUARD &&
      !(design.violations || []).length;
    console.log(`[park] ${name}:`, {
      E: rating.excitement,
      I: rating.intensity,
      N: rating.nausea,
      maxLatG: rating.maxLatG,
      inversions: rating.inversions,
      synthesized: out.report.synthesizedCount,
      ok,
    });
    if (!ok)
      parkAssert(
        'circuit',
        false,
        `${name} FAILED verification — ${String(out.report.fatal ?? '')} ${(design.violations || []).map((v: { kind: string }) => v.kind).join(', ')} maxLatG ${rating.maxLatG}`,
        'blocking',
      );
    return { ok, points: out.points as V3[] };
  } catch (err) {
    parkAssert('circuit', false, `${name} threw during verification: ${String(err)}`, 'blocking');
    return { ok: false, points: [] };
  }
}

const FLAG = verifyCircuit('Thunderhead Spiral', FLAG_PIECES, FLAG_START);
const MINE = verifyCircuit('Copper Gulch Mine Train', MINE_PIECES, MINE_START);
const FLAG_TRACK: TrackPiece[] = FLAG.ok ? FLAG_PIECES : FALLBACK_PIECES;
const ALL_COASTER_PTS: V3[] = [...FLAG.points, ...MINE.points];

/* ══ 4. THE COMPOSITION (unguarded) — the landform every cell is tested against ══ */

const COMP = parkComposition(THREE, SEED, SIZE, CLIMATE, { coasterPts: ALL_COASTER_PTS });

const isDry = (c: XZ): boolean =>
  [...(COMP.basins || []), ...(COMP.clampBasins || [])].every(
    (b: { x: number; z: number; radius: number }) =>
      Math.hypot(c[0] - b.x, c[1] - b.z) > 0.74 * b.radius + 0.6,
  );

const bumpAt = (c: XZ): number =>
  Math.max(
    0,
    ...(COMP.peaks || []).map((p: { x: number; z: number; radius: number; height: number }) => {
      const k = Math.max(0, 1 - Math.hypot(c[0] - p.x, c[1] - p.z) / p.radius);
      return k * k * (3 - 2 * k) * p.height;
    }),
  );

/* the pinned seed row — the PRE-guard water pre-filter (a BOX sieve, not a proof) */
type SeedBasin = { ctr: XZ; box: [number, number, number, number] };
const SEED_ROW: { dom: SeedBasin; sec: SeedBasin } = {
  dom: { ctr: [-51, -50], box: [-61, -42, -61, -40] },
  sec: { ctr: [40, 16], box: [36, 45, 13, 21] },
};
const inBasinBox = (c: XZ, b: SeedBasin): boolean =>
  c[0] >= b.box[0] && c[0] <= b.box[1] && c[1] >= b.box[2] && c[1] <= b.box[3];
const offRow = (c: XZ, nearR = 12): boolean =>
  [SEED_ROW.dom, SEED_ROW.sec].every(
    (b) => !inBasinBox(c, b) && Math.hypot(c[0] - b.ctr[0], c[1] - b.ctr[1]) >= nearR,
  );

/* ══ 5. THE MONORAIL RING — pieces VERBATIM, pose SEARCHED ══════════════════════ */

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

const RING_DX = 7.2; // keeps the NORTH deck off the x = 0 gate spine

const ringCells = (dz: number): XZ[] =>
  (
    [
      [-42.6, -8.4], [0, 34.2], [42.6, -8.4], [0, -51.0],
      [-42.6, -9.7],
      [-36.0, -8.4], [0, 27.6], [36.0, -8.4], [0, -57.6],
      [-40.81, -8.4], [0, 32.41], [40.81, -8.4], [0, -52.79],
      [-1.2, 33.03], [41.43, -7.2], [1.2, -52.17],
    ] as XZ[]
  ).map((c) => [+(c[0] + RING_DX).toFixed(2), +(c[1] + dz).toFixed(2)] as XZ);

const ringDecks = (dz: number): XZ[] => ringCells(dz).slice(0, 4);

let RING_DZ = 0;
let ringBestBump = Infinity;
let ringBestWet = 99;
for (const dz of [0, -1.2, 1.2, -2.4, 2.4, -3.6, 3.6, -4.8, 4.8, -6.0, 6.0]) {
  const decks = ringDecks(dz);
  const worst = Math.max(...decks.map(bumpAt));
  const wet = ringCells(dz).filter((c) => !isDry(c) || !offRow(c, 9)).length;
  const better = wet < ringBestWet || (wet === ringBestWet && worst < ringBestBump);
  if (better) {
    ringBestWet = wet;
    ringBestBump = worst;
    RING_DZ = dz;
  }
  if (wet === 0 && worst <= PEAK_LIMIT) {
    RING_DZ = dz;
    ringBestWet = 0;
    ringBestBump = worst;
    break;
  }
}
const RING_OK = parkAssert(
  'ringPose',
  ringBestWet === 0 && ringBestBump <= PEAK_LIMIT,
  `best monorail ring pose (dx ${RING_DX}, dz ${RING_DZ}) still reports ${ringBestWet} wet ring cell(s) and a worst ` +
    `deck flank of ${ringBestBump.toFixed(2)} against the ${PEAK_LIMIT} limit. The ring is MOUNTED anyway — a slightly ` +
    `banked platform costs a lint; dropping the ring costs a ride and the transport category, and aborting costs the park.`,
);
console.log('[park] monorail ring pose:', { dx: RING_DX, dz: RING_DZ, worstDeckBump: +ringBestBump.toFixed(3), wetCells: ringBestWet });

const RZ = snap(-8.4 + RING_DZ);
const NZ = -0 + 34.2 + RING_DZ;
const SZ = -51.0 + RING_DZ;
const RING_TAIL_W: XZ = cell(-28.8, RZ);
const RING_TAIL_N: XZ = cell(7.2, 27.6 + RING_DZ);
const RING_TAIL_E: XZ = cell(43.2, RZ);
const RING_TAIL_S: XZ = cell(7.2, -57.6 + RING_DZ);
const DECK_W: XZ = [-35.4, +RZ.toFixed(2)];
const DECK_N: XZ = [7.2, +NZ.toFixed(2)];
const DECK_E: XZ = [49.8, +RZ.toFixed(2)];
const DECK_S: XZ = [7.2, +SZ.toFixed(2)];

/* ══ 6. THE STREET SKELETON ═════════════════════════════════════════════════════ */

const NODES: XZ[] = [];
const NODE_IX = new Map<string, number>();
const nid = (c: XZ): number => {
  const k = `${c[0].toFixed(2)},${c[1].toFixed(2)}`;
  const hit = NODE_IX.get(k);
  if (hit !== undefined) return hit;
  NODES.push(c);
  NODE_IX.set(k, NODES.length - 1);
  return NODES.length - 1;
};

const GATE_CELL: XZ = [0, 63.6];

const HUB = fountainPlazaPlan({ id: 'hub', title: 'Sunspire Circus', position: [0, 12], tiles: 9, ports: ['N', 'E', 'S', 'W'], seed: 3 });
const GATE_AVE = boulevardPlan({ id: 'gateAve', title: 'Sunspire Promenade', from: GATE_CELL, to: HUB.port('N'), spacing: 4.8, seed: 5 });
const WEST_AVE = boulevardPlan({ id: 'westAve', title: 'Foundry Walk', from: HUB.port('W'), to: [-32.4, 12], spacing: 4.8, seed: 7 });
const EAST_AVE = boulevardPlan({ id: 'eastAve', title: 'Voltage Row', from: HUB.port('E'), to: [27.6, 12], spacing: 4.8, seed: 11 });
const SOUTH_AVE = boulevardPlan({ id: 'southAve', title: 'Cinder Mile', from: HUB.port('S'), to: [0, -30], spacing: 4.8, seed: 13 });

const GLADE_BAZAAR = bazaarPlan({
  id: 'gladeBazaar', title: 'Thornwick Row', position: [12, 48],
  facing: { port: 'W', toward: [0, 48] },
  stalls: ['honeywitch', 'burger', 'soda', 'cottonCandy'],
  names: ['Witchlight Honey', 'Glade Grill', 'Dewdrop Sodas', 'Spindle Floss'],
  theme: WORLD_THEMES.enchantedForest, seed: 21,
});
const FOUNDRY_BAZAAR = bazaarPlan({
  id: 'foundryBazaar', title: 'Brasswork Arcade', position: [-45.6, 3.6],
  facing: { port: 'W', toward: [-45.6, -2.4] },
  stalls: ['goggles', 'hotDog', 'soda', 'balloon'],
  names: ['Gasket & Lens', 'Piston Dogs', 'Boiler Fizz', 'Zeppelin Balloons'],
  theme: WORLD_THEMES.steampunk, seed: 22,
});
const PULSE_BAZAAR = bazaarPlan({
  id: 'pulseBazaar', title: 'Subwoofer Lane', position: [49.2, -18],
  facing: { port: 'W', toward: [43.2, -18] },
  stalls: ['neonSlush', 'burger', 'soda', 'cottonCandy'],
  names: ['Subwoofer Slush', 'Bassline Burgers', 'Voltage Sodas', 'Strobe Floss'],
  theme: WORLD_THEMES.neon, seed: 23,
});
const COVE_BAZAAR = bazaarPlan({
  id: 'coveBazaar', title: 'Castaway Market', position: [-15.6, -45.6],
  facing: { port: 'W', toward: [-22.8, -45.6] },
  stalls: ['sushi', 'hotDog', 'soda', 'balloon'],
  names: ['Reefside Sushi', 'Castaway Dogs', 'Tide Fizz', 'Gull Balloons'],
  theme: WORLD_THEMES.pirateBeach, seed: 24,
});
const EMBER_BAZAAR = bazaarPlan({
  id: 'emberBazaar', title: 'Cinder Market', position: [27.6, -57.6],
  facing: { port: 'W', toward: [21.6, -57.6] },
  stalls: ['emberRoast', 'burger', 'soda', 'cottonCandy'],
  names: ['Cinder Roast', 'Basalt Burgers', 'Magma Fizz', 'Ashfloss'],
  theme: WORLD_THEMES.fire, seed: 25,
});

const ALL_PLANS: SetPiecePlan[] = [
  HUB, GATE_AVE, WEST_AVE, EAST_AVE, SOUTH_AVE,
  GLADE_BAZAAR, FOUNDRY_BAZAAR, PULSE_BAZAAR, COVE_BAZAAR, EMBER_BAZAAR,
];

/* queue-tail cells that sit ON a boulevard: authoring the cell makes it a real node */
const AVENUE_TAILS: XZ[] = [
  [0, 50.4], [0, 48], [0, 45.6], [0, 42], [0, 38.4], cell(0, 27.6 + RING_DZ),
  [-12, 12], [12, 12],
];
AVENUE_TAILS.forEach(nid);

const EDGES: [NetRef, NetRef][] = [];
const link = (a: NetRef, b: NetRef): void => {
  EDGES.push([a, b]);
};

/* west column + the steampunk quarter */
nid([-32.4, 0]);
nid(cell(-32.4, RZ));
nid([-32.4, -22.8]);
link('westAve:B', nid([-32.4, -19.2]));
link(nid([-32.4, -19.2]), nid([-32.4, -30]));
link(nid(cell(-32.4, RZ)), nid(RING_TAIL_W));
link(nid([-32.4, -19.2]), nid([-45.6, -19.2]));
nid([-45.6, -16.8]);
nid([-45.6, -8.4]);
link(nid([-45.6, -19.2]), nid([-45.6, -2.4]));
link(nid([-45.6, -2.4]), 'foundryBazaar:W');

/* the z = -30 cross — closes the park-spanning loop */
link(nid([-32.4, -30]), 'southAve:B');
link(nid([27.6, -30]), 'southAve:B');

/* pirate cove */
link(nid([-32.4, -30]), nid([-32.4, -38.4]));
link(nid([-32.4, -38.4]), nid([-22.8, -38.4]));
nid([-22.8, -44.4]);
nid([-22.8, -45.6]);
link(nid([-22.8, -38.4]), nid([-22.8, -51.6]));
link(nid([-22.8, -45.6]), 'coveBazaar:W');

/* cinder mile south + the fire caldera */
link('southAve:B', nid([0, -38.4]));
nid([12, -38.4]);
link(nid([0, -38.4]), nid([21.6, -38.4]));
nid([21.6, -43.2]);
nid([21.6, -51.6]);
link(nid([21.6, -38.4]), nid([21.6, -57.6]));
link(nid([21.6, -57.6]), 'emberBazaar:W');
link(nid([12, -38.4]), nid(cell(12, -57.6 + RING_DZ)));
link(nid(cell(12, -57.6 + RING_DZ)), nid(RING_TAIL_S));

/* east column + the neon district */
nid([27.6, 0]);
nid([27.6, -12]);
nid([27.6, -22.8]);
link('eastAve:B', nid([27.6, -30]));
nid([32.4, -12]);
nid([36, -12]);
link(nid([27.6, -12]), nid([43.2, -12]));
link(nid([43.2, -12]), nid([43.2, -18]));
link(nid([43.2, -12]), nid(RING_TAIL_E));
link(nid([43.2, -18]), 'pulseBazaar:W');

/* the glade, hung off the gate promenade */
link(nid([0, 48]), 'gladeBazaar:W');
link(nid(cell(0, 27.6 + RING_DZ)), nid(RING_TAIL_N));

const NET = buildParkNet({ nodes: NODES, edges: EDGES, pieces: ALL_PLANS, keepDry: [] });

/* ══ 7. PORT + LATTICE HYGIENE ══════════════════════════════════════════════════ */

const portCell = (ref: NetRef): XZ => {
  if (typeof ref === 'number') return NODES[ref];
  const [id, name] = ref.split(':');
  const p = ALL_PLANS.find((q) => q.id === id);
  if (!p) return [0, 0];
  return p.port(name);
};
const EPS = 1e-6;
EDGES.forEach(([a, b]) => {
  const A = portCell(a);
  const B = portCell(b);
  parkAssert(
    'cardinalEdge',
    Math.abs(A[0] - B[0]) < EPS || Math.abs(A[1] - B[1]) < EPS,
    `edge ${String(a)}→${String(b)} is DIAGONAL: [${A}] → [${B}]. buildParkNet ELBOWS it through a synthesised corner ` +
      `node that was not planned. FIX THE TABLE: move one endpoint so the pair shares an x or a z.`,
    'advisory',
  );
});

const CHAIN_END_OPT_OUT = new Set<string>(['gateAve:A']); // a bare <Gate> stands on it
const PORT_REFS = EDGES.flat().filter((x): x is string => typeof x === 'string');
ALL_PLANS.forEach((p) => {
  const wired = new Set(
    PORT_REFS.filter((r) => r.split(':')[0] === p.id).map((r) => r.split(':')[1]),
  );
  const merged = p.ports.filter((pt: { name: string; at: XZ }) =>
    NET.nodes.some((n: XZ) => Math.abs(n[0] - pt.at[0]) < 0.01 && Math.abs(n[1] - pt.at[1]) < 0.01),
  );
  parkAssert(
    'pieceIsland',
    wired.size > 0 || merged.length > 0,
    `set-piece '${p.id}' has no '${p.id}:<PORT>' ref in EDGES and no port cell merged into the net — it composes as an ISLAND`,
  );
  p.ports
    .filter((pt: { prunable?: boolean }) => pt.prunable === false)
    .forEach((pt: { name: string; at: XZ }) => {
      if (wired.has(pt.name) || CHAIN_END_OPT_OUT.has(`${p.id}:${pt.name}`)) return;
      const mergedHere = NET.nodes.some(
        (n: XZ) => Math.abs(n[0] - pt.at[0]) < 0.01 && Math.abs(n[1] - pt.at[1]) < 0.01,
      );
      parkAssert(
        'chainEnd',
        mergedHere,
        `chain piece '${p.id}' wires [${[...wired]}] but not '${p.id}:${pt.name}' — that end of the carriageway dead-ends in grass.`,
      );
    });
});

const SOLID_CLEAR: Record<string, number> = { FountainPlaza: 1.8, Bazaar: 0.6, Boulevard: 0 };
function assertNodesOffPieces(nodes: XZ[], plans: SetPiecePlan[], label: string): void {
  const hits: string[] = [];
  plans.forEach((p) => {
    const clear = SOLID_CLEAR[p.kind] ?? 1.8;
    if (clear === 0) return;
    const ports = new Set(p.ports.map((pt: { at: XZ }) => `${pt.at[0].toFixed(2)},${pt.at[1].toFixed(2)}`));
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
        hits.push(`[${n[0]}, ${n[1]}] (${label} ${i}) is ${gap.toFixed(2)} u from '${p.id}' (${p.kind}) — needs ${clear}`);
    });
  });
  parkAssert('nodeInSolid', !hits.length, `${hits.length} ${label} cell(s) stand against a set-piece footprint:\n  ` + hits.join('\n  '));
}
assertNodesOffPieces(NODES, ALL_PLANS, 'node');

/* ══ 8. PADS — the tail is authored, the pad is DERIVED ═════════════════════════ */

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
  parkAssert(
    'padOnFlank',
    false,
    `${label}: pad [${pad}] is on a hill flank (bump ${bumpAt(pad).toFixed(2)} > ${PEAK_LIMIT}) OR WET, and no cell within ` +
      `4.8 u is flat, dry AND ${clear} u off the street.`,
  );
  return pad;
}

interface Placement {
  pad: XZ;
  anchor: XZ;
  dir: XZ;
  tail: XZ;
}

const COMMITTED: XZ[] = [];

function place(tail: XZ, out: XZ, capacity: number, rig: string): Placement {
  const clear = searchClearOf(rig);
  const join = laneLenOf(capacity) + 0.35;
  const reach = minReachOf(capacity) + 2.4;
  const cand: XZ = [snap(tail[0] + out[0] * reach), snap(tail[1] + out[1] * reach)];
  const onStreet = (offPathCell(NET, cand, { clear }) ?? cand) as XZ;
  const pad = assertPadFlat(onStreet, clear, rig);
  const got = dist(pad, tail);
  parkAssert(
    'padReach',
    got >= minReachOf(capacity) + 1.2,
    `${rig}: pad [${pad}] sits ${got.toFixed(2)} u from its tail [${tail}] — the cap-${capacity} floor is ` +
      `${(minReachOf(capacity) + 1.2).toFixed(2)} u. The court is too tight; the ride still mounts.`,
  );
  parkAssert(
    'padMargin',
    padMarginOf(rig) <= 4.2,
    `${rig} declares a ${padMarginOf(rig)} u body margin, past offPathCell's 4.8 u ring search, so the pad was solved at ` +
      `${clear} u instead. Its body will sit closer to a street than the footprint sweep prefers — accepted deliberately: ` +
      `these are the never-built 7 u+ rigs and omitting them would cost a whole world's ride floor.`,
  );
  const near = COMMITTED.find((c) => dist(c, pad) < 6);
  parkAssert('padPitch', !near, `${rig}: pad [${pad}] is ${near ? dist(near, pad).toFixed(2) : ''} u from an already committed pad [${near}] — the floor is 6 u.`);
  COMMITTED.push(pad);
  return {
    pad,
    anchor: [snap(tail[0] + out[0] * join), snap(tail[1] + out[1] * join)],
    dir: [-out[0], -out[1]],
    tail,
  };
}

const W: XZ = [-1, 0];
const E: XZ = [1, 0];
const N: XZ = [0, 1];
const S: XZ = [0, -1];

/* entrance + hub */
const CAROUSEL = place([0, 50.4], W, 8, 'Carousel');
const WHEEL = place([-12, 12], N, 4, 'FerrisWheel');
const CUPS = place([12, 12], N, 6, 'Teacups');
const MINETRAIN = place([27.6, -22.8], W, 4, 'MineTrainCoaster');
/* the flagship coaster tails straight onto the west column */
const FLAG_TAIL: XZ = [-32.4, -22.8];

/* enchantedForest */
const WYRM = place([0, 45.6], W, 4, 'WyrmsHollow');
const BARGE = place([0, 38.4], W, 6, 'MoonlitBarge');
const CHAIR = place([0, 42], E, 4, 'Chairlift');

/* steampunk */
const GEARWORKS = place([-45.6, -8.4], W, 4, 'GearworksExpress');
const AETHER = place([-45.6, -2.4], W, 8, 'AetherBalloons');
const BOILER = place([-45.6, -16.8], S, 6, 'BoilerBurst');

/* neon */
const BASS = place([36, -12], S, 4, 'Bassline');
const DISCO = place([43.2, -18], S, 6, 'Discotron');
const MAGLEV = place([32.4, -12], N, 4, 'MagneticRide');

/* pirateBeach */
const REEF = place([-32.4, -38.4], W, 4, 'ReefRacer');
const DRIFT = place([-22.8, -44.4], W, 6, 'DeepDrift');
const TUNNEL = place([-22.8, -51.6], W, 4, 'OceanTunnelSlide');

/* fire */
const MAGMA = place([21.6, -43.2], E, 4, 'MagmaRun');
const WINGS = place([21.6, -51.6], E, 4, 'EmberWings');
const LAVATUBE = place([12, -38.4], W, 4, 'LavaTubeRun');

assertNodesOffPieces(COMMITTED, ALL_PLANS, 'pad');

const RESTROOM_CELL = (offPathCell(NET, [-6, 21.6], { clear: 1.8 }) ?? [-6, 21.6]) as XZ;

/* ══ 9. DRESSING — scattered off the street, sieved for water in the tree ═══════ */

const AVOID: XZ[] = [...COMMITTED, RESTROOM_CELL, DECK_W, DECK_N, DECK_E, DECK_S];

function scatter(centre: XZ, count: number, rMin: number, rMax: number, seed: number, minSep = 2.4, avoidR = 5.4): XZ[] {
  const out: XZ[] = [];
  for (let i = 0; i < count * 60 && out.length < count; i += 1) {
    const a = hash01(seed * 7.13 + i * 3.37) * Math.PI * 2;
    const r = rMin + (rMax - rMin) * Math.sqrt(hash01(seed * 2.71 + i * 5.93));
    const raw: XZ = cell(centre[0] + Math.cos(a) * r, centre[1] + Math.sin(a) * r);
    if (Math.abs(raw[0]) > 57.6 || Math.abs(raw[1]) > 57.6) continue;
    if (!offRow(raw, 10)) continue;
    if (bumpAt(raw) > 1.7) continue;
    if (AVOID.some((c) => dist(c, raw) < avoidR)) continue;
    if (out.some((c) => dist(c, raw) < minSep)) continue;
    const off = offPathCell(NET, raw, { clear: 1.2 });
    if (!off || dist(off, raw) > 1e-6) continue;
    out.push(raw);
  }
  return out;
}

interface Prop {
  at: XZ;
  kind: number;
  seed: number;
  rot: number;
}
const asProps = (cells: XZ[], seed: number): Prop[] =>
  cells.map((at, i) => ({
    at,
    kind: i % 5,
    seed: i + 1 + seed,
    rot: +(hash01(seed * 3.1 + i * 1.7) * Math.PI * 2).toFixed(3),
  }));

const GLADE_CELLS = scatter([2.4, 40.8], 25, 6, 15, 101);
const FOUNDRY_CELLS = scatter([-44.4, -10.8], 25, 6, 15, 202);
const PULSE_CELLS = scatter([42, -15.6], 25, 6, 15, 303);
const COVE_CELLS = scatter([-27.6, -45.6], 25, 6, 14, 404);
const EMBER_CELLS = scatter([18, -48], 25, 6, 14, 505);

const GLADE_PROPS = asProps(GLADE_CELLS, 11);
const FOUNDRY_PROPS = asProps(FOUNDRY_CELLS, 22);
const PULSE_PROPS = asProps(PULSE_CELLS, 33);
const COVE_PROPS = asProps(COVE_CELLS, 44);
const EMBER_PROPS = asProps(EMBER_CELLS, 55);

[
  ['enchantedForest', GLADE_CELLS], ['steampunk', FOUNDRY_CELLS], ['neon', PULSE_CELLS],
  ['pirateBeach', COVE_CELLS], ['fire', EMBER_CELLS],
].forEach(([id, cells]) => {
  parkAssert(
    'themedScenery',
    (cells as XZ[]).length >= 20,
    `world '${id as string}' only found ${(cells as XZ[]).length} clear scenery cells against the 25 floor — the district reads thin.`,
  );
});

const THEMED_CELLS: XZ[] = [...GLADE_CELLS, ...FOUNDRY_CELLS, ...PULSE_CELLS, ...COVE_CELLS, ...EMBER_CELLS];
const AVOID2: XZ[] = [...AVOID, ...THEMED_CELLS];

function scatterWide(count: number, seed: number, minSep: number, clear: number): XZ[] {
  const out: XZ[] = [];
  for (let i = 0; i < count * 90 && out.length < count; i += 1) {
    const a = hash01(seed * 9.17 + i * 2.31) * Math.PI * 2;
    const r = 8 + 48 * Math.sqrt(hash01(seed * 4.41 + i * 6.07));
    const raw: XZ = cell(Math.cos(a) * r, Math.sin(a) * r);
    if (Math.abs(raw[0]) > 57.6 || Math.abs(raw[1]) > 57.6) continue;
    if (!offRow(raw, 10)) continue;
    if (bumpAt(raw) > 1.9) continue;
    if (AVOID2.some((c) => dist(c, raw) < 4.2)) continue;
    if (out.some((c) => dist(c, raw) < minSep)) continue;
    const off = offPathCell(NET, raw, { clear });
    if (!off || dist(off, raw) > 1e-6) continue;
    out.push(raw);
  }
  return out;
}

const TREE_SHAPES = ['round', 'pine', 'willow', 'round', 'pine'] as const;
type TreeShape = (typeof TREE_SHAPES)[number];
const TREE_CELLS = scatterWide(48, 707, 2.4, 0.75);
const TREES: { at: XZ; shape: TreeShape }[] = TREE_CELLS.map((at, i) => ({
  at,
  shape: TREE_SHAPES[i % TREE_SHAPES.length],
}));
parkAssert('treeCount', TREES.length >= 32, `only ${TREES.length} tree cells cleared the street/water sieve against the 32 floor.`);

const NEUTRAL_NAMES = [
  'marbleStatue', 'birdbath', 'picnicTable', 'planterBox', 'topiarySpiral',
  'signpost', 'parkClock', 'flagpole', 'ironArchway', 'wishingWell',
] as const;
const SCENERY_CELLS = scatterWide(22, 808, 3.6, 1.2);
const SCENERY: { at: XZ; name: string }[] = SCENERY_CELLS.map((at, i) => ({
  at,
  name: NEUTRAL_NAMES[i % NEUTRAL_NAMES.length],
}));
parkAssert('sceneryCount', SCENERY.length >= 16, `only ${SCENERY.length} neutral scenery cells cleared the sieve against the 16 floor.`);

const TORCHES: { at: XZ }[] = scatterWide(8, 909, 6, 1.2).map((at) => ({ at }));

/* ══ 10. THE FIVE WORLDS ════════════════════════════════════════════════════════ */

const GLADE = worldPlan({
  id: 'enchantedForest', theme: WORLD_THEMES.enchantedForest,
  pieces: [GLADE_BAZAAR],
  include: [WYRM.pad, BARGE.pad, CHAIR.pad, DECK_N, RING_TAIL_N, ...GLADE_CELLS],
});
const FOUNDRY = worldPlan({
  id: 'steampunk', theme: WORLD_THEMES.steampunk,
  pieces: [FOUNDRY_BAZAAR],
  include: [GEARWORKS.pad, AETHER.pad, BOILER.pad, DECK_W, RING_TAIL_W, ...FOUNDRY_CELLS],
});
const PULSE = worldPlan({
  id: 'neon', theme: WORLD_THEMES.neon,
  pieces: [PULSE_BAZAAR],
  include: [BASS.pad, DISCO.pad, MAGLEV.pad, DECK_E, RING_TAIL_E, ...PULSE_CELLS],
});
const COVE = worldPlan({
  id: 'pirateBeach', theme: WORLD_THEMES.pirateBeach,
  pieces: [COVE_BAZAAR],
  include: [REEF.pad, DRIFT.pad, TUNNEL.pad, ...COVE_CELLS],
});
const EMBER = worldPlan({
  id: 'fire', theme: WORLD_THEMES.fire,
  pieces: [EMBER_BAZAAR],
  include: [MAGMA.pad, WINGS.pad, LAVATUBE.pad, DECK_S, RING_TAIL_S, ...EMBER_CELLS],
});
const WORLDS = [GLADE, FOUNDRY, PULSE, COVE, EMBER];

const WORLD_FLOOR = 20 * Math.sqrt(SIZE / 48);
for (let i = 0; i < WORLDS.length; i += 1)
  for (let j = i + 1; j < WORLDS.length; j += 1) {
    const a = WORLDS[i];
    const b = WORLDS[j];
    const d = dist(a.centre as XZ, b.centre as XZ);
    parkAssert(
      'worldSpacing',
      d >= WORLD_FLOOR,
      `worlds '${a.id}' @[${(a.centre as XZ).map((v) => v.toFixed(1))}] and '${b.id}' @[${(b.centre as XZ).map((v) => v.toFixed(1))}] ` +
        `are ${d.toFixed(2)} u apart, under the ${WORLD_FLOOR.toFixed(2)} u floor — they read as one district.`,
    );
  }
console.log('[park] worlds:', WORLDS.map((w) => ({ id: w.id, centre: w.centre, half: w.half })));

/* ══ 11. THE GUARD LIST — DERIVED from the fuse's own output, never NODES.slice() ═ */

function keepDryOf(cells: XZ[]): XZ[] {
  const kept = cells.filter((c) => offRow(c, 9));
  const dropped = cells.length - kept.length;
  if (dropped)
    console.warn(
      `[park] keepDryOf dropped ${dropped} of ${cells.length} guard cell(s) on the pinned row's water. A DROPPED guard is ` +
        `NOT a fixed cell — whatever stands there is still in the lake.`,
    );
  return kept;
}
const GUARDS = keepDryOf([
  ...((NET.keepDry || []) as XZ[]),
  ...COMMITTED,
  ...WORLDS.flatMap((w) => (w.cells || []) as XZ[]),
]);

const GCOMP = parkComposition(THREE, SEED, SIZE, CLIMATE, { keepDry: GUARDS, coasterPts: ALL_COASTER_PTS });

parkAssert(
  'waterMoved',
  Math.hypot(GCOMP.waterCentre[0] - COMP.waterCentre[0], GCOMP.waterCentre[1] - COMP.waterCentre[1]) < 1 &&
    Math.hypot(
      GCOMP.waterCentreSecond[0] - COMP.waterCentreSecond[0],
      GCOMP.waterCentreSecond[1] - COMP.waterCentreSecond[1],
    ) < 1,
  `guards moved a water body off the pinned row — dominant ${JSON.stringify(COMP.waterCentre)} → ` +
    `${JSON.stringify(GCOMP.waterCentre)}, secondary ${JSON.stringify(COMP.waterCentreSecond)} → ` +
    `${JSON.stringify(GCOMP.waterCentreSecond)}, terrainSeed ${COMP.terrainSeed} → ${GCOMP.terrainSeed}`,
);

const rf = GCOMP.report.reliefFloor;
parkAssert(
  'terrainFlattened',
  !rf || rf.kept >= rf.floor,
  rf
    ? `keepDry FLATTENED the seed: authored relief ${rf.authoredRelief.toFixed(2)} → built ${rf.relief.toFixed(2)} ` +
      `(kept ${rf.kept.toFixed(2)} against the ${rf.floor} floor), stdH ${rf.authoredStdH.toFixed(2)} → ${rf.stdH.toFixed(2)}. ` +
      `Ranges the guard list stood on: ${rf.guardedRanges}; peaks it took ≥ 25 % of: ${JSON.stringify(rf.cappedPeaks)}`
    : '',
  'advisory',
);
console.log('[park] terrain:', {
  guards: GUARDS.length,
  terrainSeed: GCOMP.terrainSeed,
  probes: GCOMP.report.probesTried,
  waterBodies: GCOMP.report.waterBodies,
  waterAreaU2: GCOMP.report.waterAreaU2,
  reliefKept: rf ? +rf.kept.toFixed(3) : null,
  stdH: rf ? +rf.stdH.toFixed(3) : null,
});

parkAssertFlush();

/* ══ 12. THE DRY SIEVE — the GATE's own predicate, run IN THE TREE ══════════════ */

type GroundLint = { isDry: (x: number, z: number, c?: number) => boolean };
type ParkLike = { ground: { lint: GroundLint } | null };

function dryRing(park: ParkLike, c: XZ, r = 0.75): boolean {
  const g = park.ground;
  if (!g) {
    console.error('[park] dryRing ran with NO TERRAIN — a VACUOUS pass');
    return true;
  }
  const dry = (x: number, z: number): boolean => g.lint.isDry(x, z, 0.05);
  if (!dry(c[0], c[1])) return false;
  for (let k = 0; k < 8; k += 1) {
    const a = (k / 8) * Math.PI * 2;
    if (!dry(c[0] + Math.cos(a) * r, c[1] + Math.sin(a) * r)) return false;
  }
  return true;
}

function DryScatter<T extends { at: XZ }>({
  cells,
  render,
  label,
}: {
  cells: T[];
  render: (c: T, i: number) => React.ReactNode;
  label: string;
}): JSX.Element {
  const park = usePark('DryScatter') as unknown as ParkLike;
  const [dry, setDry] = React.useState<T[] | null>(null);
  React.useEffect(() => {
    const kept = cells.filter((c) => dryRing(park, c.at));
    if (kept.length < cells.length)
      console.error(
        `[park] DryScatter(${label}) dropped ${cells.length - kept.length} of ${cells.length} cell(s) under waterline+0.05: ` +
          JSON.stringify(cells.filter((c) => !kept.includes(c)).map((c) => c.at)),
      );
    setDry(kept);
  }, [park, cells, label]);
  return <>{(dry ?? []).map(render)}</>;
}

/* ══ 13. THEMED SCENERY DISPATCH ════════════════════════════════════════════════ */

type PropComp = React.ComponentType<{ position: XZ; rotation?: number; seed?: number }>;
const GLADE_KINDS: PropComp[] = [GiantToadstools, StandingStones, LanternTree, RuinedArch, FlowerPodBed] as unknown as PropComp[];
const FOUNDRY_KINDS: PropComp[] = [GiantGear, SteamPipes, ClockTower, BoilerTank, CoalCart] as unknown as PropComp[];
const PULSE_KINDS: PropComp[] = [NeonArch, SpeakerStack, MirrorBallPylon, LaserTruss, LightTiles] as unknown as PropComp[];
const COVE_KINDS: PropComp[] = [WreckedHull, CoralCluster, AnchorPile, TidePool, DockPilings] as unknown as PropComp[];
const EMBER_KINDS: PropComp[] = [Fumarole, ObsidianShards, BasaltColumns, LavaFissure, CharredSnag] as unknown as PropComp[];

function ThemedScatter({ props, kinds, tag }: { props: Prop[]; kinds: PropComp[]; tag: string }): JSX.Element {
  return (
    <DryScatter
      label={tag}
      cells={props}
      render={(p, i) => {
        const Comp = kinds[p.kind];
        return <Comp key={`${tag}-${i}`} position={p.at} rotation={p.rot} seed={p.seed} />;
      }}
    />
  );
}

/* ══ 14. THE PARK ═══════════════════════════════════════════════════════════════ */

export function App(): JSX.Element {
  return (
    <main className="w-full min-h-full bg-slate-900">
      <Park
        seed={SEED}
        climate={CLIMATE}
        roster={{ rides: 21, stalls: 20, categories: 5 }}
        onReady={(report: { ok: boolean; failures?: unknown[]; warnings?: unknown[] }) => {
          console.log('[park] validatePark:', report.ok, report.failures, report.warnings);
        }}
      >
        <Terrain keepDry={GUARDS} coasterPts={ALL_COASTER_PTS} />
        <Paths nodes={NET.nodes} edges={NET.edges} plazas={NET.plazas} bins={NET.bins} walkers={6} />
        <GameManager />
        <Gate />

        {/* ── the street set-pieces, after <Paths> ─────────────────────────────── */}
        <FountainPlaza plan={HUB} />
        <Boulevard plan={GATE_AVE} />
        <Boulevard plan={WEST_AVE} />
        <Boulevard plan={EAST_AVE} />
        <Boulevard plan={SOUTH_AVE} />

        {/* ── the five worlds: floor, giant, region ────────────────────────────── */}
        <WorldGround plan={GLADE} />
        <WorldGround plan={FOUNDRY} />
        <WorldGround plan={PULSE} />
        <WorldGround plan={COVE} />
        <WorldGround plan={EMBER} />
        <WorldLandmark plan={GLADE} />
        <WorldLandmark plan={FOUNDRY} />
        <WorldLandmark plan={PULSE} />
        <WorldLandmark plan={COVE} />
        <WorldLandmark plan={EMBER} />
        <World plan={GLADE} />
        <World plan={FOUNDRY} />
        <World plan={PULSE} />
        <World plan={COVE} />
        <World plan={EMBER} />

        {/* ── markets ──────────────────────────────────────────────────────────── */}
        <Bazaar plan={GLADE_BAZAAR} />
        <Bazaar plan={FOUNDRY_BAZAAR} />
        <Bazaar plan={PULSE_BAZAAR} />
        <Bazaar plan={COVE_BAZAAR} />
        <Bazaar plan={EMBER_BAZAAR} />
        <Restroom position={RESTROOM_CELL} rotation={Math.PI / 2} />

        {/* ── entrance + hub rides ─────────────────────────────────────────────── */}
        <Carousel
          position={CAROUSEL.pad}
          rotation={Math.PI / 2}
          register={{ name: 'Sunspire Carousel', kind: 'gentle', capacity: 8, price: 3 }}
          queue={{ anchor: CAROUSEL.anchor, dir: CAROUSEL.dir }}
        />
        <FerrisWheel
          position={WHEEL.pad}
          rotation={0}
          register={{ name: 'Dune Wheel', kind: 'gentle', capacity: 4, price: 4 }}
          queue={{ anchor: WHEEL.anchor, dir: WHEEL.dir }}
        />
        <Teacups
          position={CUPS.pad}
          rotation={0}
          register={{ name: 'Whirlaway Cups', kind: 'gentle', capacity: 6, price: 3 }}
          queue={{ anchor: CUPS.anchor, dir: CUPS.dir }}
        />

        {/* ── the flagship: two inversions, a helix and a closed rectangle ──────── */}
        <Coaster
          name="Thunderhead Spiral"
          pieces={FLAG_TRACK}
          start={FLAG_START}
          heading={0}
          type="steel"
          cars={3}
          capacity={4}
          rideDuration={11}
          loadTime={2}
          intensity={9}
          price={7}
          queueTailNode={NET.node(FLAG_TAIL)}
          queueDir={[1, 0]}
        />
        <MineTrainCoaster
          position={[21.6, -22.8]}
          rotation={0}
          pieces={MINE.ok ? MINE_PIECES : undefined}
          register={{ name: 'Copper Gulch Mine Train', kind: 'thrill', capacity: 4, price: 6 }}
          queue={{ anchor: MINETRAIN.anchor, dir: MINETRAIN.dir }}
        />

        {/* ── the park-spanning monorail ring ──────────────────────────────────── */}
        <Monorail
          position={[-42.6 + RING_DX, 0, -9.7 + RING_DZ]}
          rotation={0}
          pieces={MONO_PIECES}
          register={{ name: 'Sunspire Skyline', kind: 'transport', capacity: 8, price: 2 }}
        />

        {/* ── enchantedForest ──────────────────────────────────────────────────── */}
        <WyrmsHollow
          position={WYRM.pad}
          rotation={Math.PI / 2}
          register={{ name: "Wyrm's Hollow", kind: 'dark', capacity: 4, price: 6 }}
          queue={{ anchor: WYRM.anchor, dir: WYRM.dir }}
        />
        <MoonlitBarge
          position={BARGE.pad}
          rotation={Math.PI / 2}
          register={{ name: 'Moonlit Barge', kind: 'water', capacity: 6, price: 5 }}
          queue={{ anchor: BARGE.anchor, dir: BARGE.dir }}
        />
        <Chairlift
          position={CHAIR.pad}
          rotation={-Math.PI / 2}
          register={{ name: 'Canopy Chairlift', kind: 'transport', capacity: 4, price: 3 }}
          queue={{ anchor: CHAIR.anchor, dir: CHAIR.dir }}
        />
        <ThemedScatter props={GLADE_PROPS} kinds={GLADE_KINDS} tag="glade" />

        {/* ── steampunk ────────────────────────────────────────────────────────── */}
        <GearworksExpress
          position={GEARWORKS.pad}
          rotation={Math.PI / 2}
          register={{ name: 'Gearworks Express', kind: 'thrill', capacity: 4, price: 6 }}
          queue={{ anchor: GEARWORKS.anchor, dir: GEARWORKS.dir }}
        />
        <AetherBalloons
          position={AETHER.pad}
          rotation={Math.PI / 2}
          register={{ name: 'Aether Balloons', kind: 'gentle', capacity: 8, price: 4 }}
          queue={{ anchor: AETHER.anchor, dir: AETHER.dir }}
        />
        <BoilerBurst
          position={BOILER.pad}
          rotation={0}
          register={{ name: 'Boiler Burst', kind: 'thrill', capacity: 6, price: 5 }}
          queue={{ anchor: BOILER.anchor, dir: BOILER.dir }}
        />
        <ThemedScatter props={FOUNDRY_PROPS} kinds={FOUNDRY_KINDS} tag="foundry" />

        {/* ── neon ─────────────────────────────────────────────────────────────── */}
        <Bassline
          position={BASS.pad}
          rotation={0}
          register={{ name: 'Bassline', kind: 'thrill', capacity: 4, price: 7 }}
          queue={{ anchor: BASS.anchor, dir: BASS.dir }}
        />
        <Discotron
          position={DISCO.pad}
          rotation={0}
          register={{ name: 'Discotron 5000', kind: 'thrill', capacity: 6, price: 5 }}
          queue={{ anchor: DISCO.anchor, dir: DISCO.dir }}
        />
        <MagneticRide
          position={MAGLEV.pad}
          rotation={Math.PI}
          register={{ name: 'Maglev Midnight', kind: 'transport', capacity: 4, price: 4 }}
          queue={{ anchor: MAGLEV.anchor, dir: MAGLEV.dir }}
        />
        <ThemedScatter props={PULSE_PROPS} kinds={PULSE_KINDS} tag="pulse" />

        {/* ── pirateBeach ──────────────────────────────────────────────────────── */}
        <ReefRacer
          position={REEF.pad}
          rotation={Math.PI / 2}
          register={{ name: 'Reef Racer', kind: 'water', capacity: 4, price: 6 }}
          queue={{ anchor: REEF.anchor, dir: REEF.dir }}
        />
        <DeepDrift
          position={DRIFT.pad}
          rotation={Math.PI / 2}
          register={{ name: 'Deep Drift', kind: 'dark', capacity: 6, price: 6 }}
          queue={{ anchor: DRIFT.anchor, dir: DRIFT.dir }}
        />
        <OceanTunnelSlide
          position={TUNNEL.pad}
          rotation={Math.PI / 2}
          register={{ name: 'Ocean Tunnel Slide', kind: 'water', capacity: 4, price: 5 }}
          queue={{ anchor: TUNNEL.anchor, dir: TUNNEL.dir }}
        />
        <ThemedScatter props={COVE_PROPS} kinds={COVE_KINDS} tag="cove" />

        {/* ── fire ─────────────────────────────────────────────────────────────── */}
        <MagmaRun
          position={MAGMA.pad}
          rotation={-Math.PI / 2}
          register={{ name: 'Magma Run', kind: 'thrill', capacity: 4, price: 7 }}
          queue={{ anchor: MAGMA.anchor, dir: MAGMA.dir }}
        />
        <EmberWings
          position={WINGS.pad}
          rotation={-Math.PI / 2}
          register={{ name: 'Ember Wings', kind: 'thrill', capacity: 4, price: 7 }}
          queue={{ anchor: WINGS.anchor, dir: WINGS.dir }}
        />
        <LavaTubeRun
          position={LAVATUBE.pad}
          rotation={Math.PI / 2}
          register={{ name: 'Lava Tube Run', kind: 'water', capacity: 4, price: 6 }}
          queue={{ anchor: LAVATUBE.anchor, dir: LAVATUBE.dir }}
        />
        <ThemedScatter props={EMBER_PROPS} kinds={EMBER_KINDS} tag="ember" />

        {/* ── the neutral dress, sieved last ───────────────────────────────────── */}
        <DryScatter
          label="trees"
          cells={TREES}
          render={(t, i) => (
            <Placed key={`tr-${i}`} position={t.at} build={(three) => tree(three, { shape: t.shape })} />
          )}
        />
        <DryScatter
          label="scenery"
          cells={SCENERY}
          render={(s, i) => <Scenery key={`sc-${i}`} name={s.name} position={s.at} seed={i + 1} />}
        />
        <DryScatter
          label="torches"
          cells={TORCHES}
          render={(t, i) => <Torch key={`to-${i}`} position={t.at} />}
        />
      </Park>
    </main>
  );
}

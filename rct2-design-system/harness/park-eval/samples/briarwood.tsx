/* ===========================================================================
 * BRIARWOOD — a large FAMILY theme park (size 192, temperate, seed 83)
 * ===========================================================================
 *
 * §0 PRE-FLIGHT (static arithmetic — done on paper before shipping)
 * -----------------------------------------------------------------
 * PLOT: <Park size={192}>  → x,z ∈ [-96, 96].  Gate cell z = 94.8.
 *       Gate-reach band: x ∈ [-75,75], z ∈ [19.8, 94.8].
 *
 * SEED 83 temperate (§1 table, generated at 192):
 *   ONE water body = corner lake, wet box x[38..88] z[-91..-38] (5.5%).
 *   → ENTIRELY south of the gate-reach band. NOTHING is placed in the wet box;
 *     our whole layout sits at z ≥ ~20, trivially clear → the listed lake
 *     candidate wins, no water re-pick.  "The whole NORTH half is open."
 *   Sentinel ×8 ranges, nearest to band (52.6,17.1)/(28.3,-22.0) all z<20
 *     (south of band). keepDry covers every cell; guard-clamp handles bulges.
 *
 * DISTRICTS (centres, ≥ ~40 u apart):
 *   HUB  "Briarwood Green"   (0, 75.6)          FountainPlaza, 9-tile
 *   EAST "Meadow Midway"    ~(43, 66)  d(hub)=42   Teacups/Twist/Swing/Drop + Bazaar
 *   WEST "Timberline Heights"~(-38, 55) d(hub)=43   the coaster in its own meadow
 *   SOUTH"Willow Hollow"    ~(-2, 36)  d(hub)~40    FerrisWheel + LogFlume (own water)
 *   Built-bbox spread: x -52.9..+60 = 113 (≥82 ✓), z ~20..94.8 = 75 (≥45 ✓).
 *
 * STREETS: buildParkNet fuses FountainPlaza + Bazaar + 4 Boulevards + a
 *   14-node spine.  Every edge is cardinal (verified). No dead spine nodes.
 *
 * ROSTER (9 registered rides, 5 categories, all 3 intensity bands):
 *   coaster  Timberline Racer  §4.0-B FAMILY steel  (intense, int 6.25)
 *   ferris   Meadow Wheel      cap 8  (gentle)
 *   carousel Briarwood Gallopers cap 8 (gentle) — FIRST ride, tail 6 u off gate
 *   teacups  Bramble Cups      cap 4  (moderate)
 *   twist    Willow Whirl      cap 6  (moderate)
 *   swing    Sky Dancer        cap 8  (moderate)
 *   drop     Cedar Plunge      cap 10 (intense)
 *   flume    Otter Falls       cap 4  water ride, builds own trough (moderate)
 *  → non-coaster water ride = LogFlume ✓ ; categories coaster/gentle/spin/drop/water ✓
 *
 * FIRST-RIDE GATE PROXIMITY: Briarwood Gallopers queue TAIL = [0, 88.8] on the
 *   Main Street boulevard; gate cell [0, 94.8] → 6.0 u street distance (≤ 15 ✓).
 *
 * QUEUES: every flat ride pins its HEAD: anchor = tail − dir·(laneLenOf(cap)+0.35)
 *   laneLenOf: cap4 3.34 / cap6 4.46 / cap8 5.58 / cap10 6.70.
 *
 * COASTER §4.0-B copied VERBATIM, translated by lattice (+ (-38.4,+54.0) →
 *   start [-24.0, 0.55, 51.6], heading 0, type steel, cars 3, cap 4, int 7):
 *   queueTailNode = spine index 9 = [-18, 51.6] (start.x+6), queueDir [1,0],
 *   exit [-21.6, 54.0] exitDir [1,0].  Footprint X -52.92..-24.0 Z 38.33..68.75
 *   (worst |coord| 68.75 < 96 ✓). Ring interior kept as open meadow; approach
 *   spine reaches the tail from the EAST (offsets +6/+12, outside the corridor).
 *   rateCoaster is CALLED at runtime — the measured line is console.logged as
 *   "[thrill] …"; §4.0-B published (cars 3, bank 0.7): E 5.27 I 6.25 N 2.25,
 *   highest drop 3.58 u, +G 3.51, maxLatG 0.27 g, airtime 0.56 s, len 120.87.
 *
 * STALLS: Bazaar "Commons Market" = burger/soda/cottonCandy/hotDog (4 kinds,
 *   themed names) + a Restroom + 3 bins.
 *
 * SCENERY: ≥ 24 SceneryPack pieces + ≥ 48 Kit trees, scattered deterministically
 *   OFF every street/pad/coaster-polyline and inside the dry north half.
 *
 * validatePark runs LAST (Park's built-in gate, validate default true) and its
 *   verdict + per-failure lines are logged via onReady. Target: ok:true, 0 fail.
 * ========================================================================= */

import React from 'react';
import {
  Park, GameManager, Terrain, Paths, Gate, Coaster, FlatRide, Placed,
  Restroom, Fountain, Torch, Neon, Scenery, Lights,
} from './Park';
import { buildParkNet } from './SetPieceKit';
import { FountainPlaza, fountainPlazaPlan } from './FountainPlaza';
import { Bazaar, bazaarPlan } from './Bazaar';
import { Boulevard, boulevardPlan } from './Boulevard';
import { FerrisWheel } from './FerrisWheel';
import { Carousel } from './Carousel';
import { Teacups } from './Teacups';
import { TwistRide } from './TwistRide';
import { SwingRide } from './SwingRide';
import { DropTower } from './DropTower';
import { LogFlume } from './LogFlume';
import { compileTrackPieces, rateCoaster } from './SplineRideKit';
import { tree } from './Kit';

/* ----------------------------------------------------------------------- */
/* constants                                                               */
/* ----------------------------------------------------------------------- */
const SIZE = 192;
const SEED = 83;
const HALF_PI = Math.PI / 2;

type XZ = [number, number];

/* §4.0-B FAMILY steel rectangle — copied VERBATIM */
const B_PIECES: any[] = ['station',
  { type: 'lift', height: 3.6 }, { type: 'straight', length: 2.56 }, { type: 'turnR', angle: 90, radius: 2.5 },
  { type: 'drop', height: 3.6 },
  { type: 'lift', height: 3.2 }, { type: 'straight', length: 5.46 }, { type: 'turnR', angle: 90, radius: 2.5 },
  { type: 'drop', height: 3.2 }, { type: 'hill', height: 0.9 },
  { type: 'lift', height: 3.2 }, { type: 'straight', length: 1.5 }, { type: 'turnR', angle: 90, radius: 2.5 },
  { type: 'drop', height: 3.2 }, { type: 'hill', height: 0.9 },
  { type: 'lift', height: 3.2 }, { type: 'turnR', angle: 90, radius: 2.5 },
  { type: 'drop', height: 3.2 }, { type: 'straight', length: 1.5 }];

const COASTER_START: [number, number, number] = [-24.0, 0.55, 51.6];
const COASTER_HEADING = 0;

/* Otter Falls — a compact horseshoe log flume (own trough water) */
const FLUME_PIECES: any[] = ['station',
  { type: 'lift', height: 1.4, length: 8 },
  { type: 'turnR', angle: 180, radius: 3 },
  { type: 'drop', height: 1.15 },
  { type: 'straight', length: 2.6 }];

/* Monorail dropped from the roster to keep the corridor sweep trivial — the
 * water ride (LogFlume) already satisfies the "besides the coaster" rule. */

/* ----------------------------------------------------------------------- */
/* street plan (module scope — plan builders DEGRADE, they never throw)     */
/* ----------------------------------------------------------------------- */

const HUB = fountainPlazaPlan({
  id: 'hub', title: 'Briarwood Green', position: [0, 75.6], tiles: 9,
  ports: ['N', 'E', 'S', 'W'], seed: SEED,
});

const MARKET = bazaarPlan({
  id: 'market', title: 'Commons Market', position: [40.8, 88.8],
  facing: { port: 'E', toward: [40.8, 75.6] },
  stalls: ['burger', 'soda', 'cottonCandy', 'hotDog'], seed: 5,
});

const B_MAIN = boulevardPlan({ id: 'main', title: 'Grand Promenade',
  from: [0, 94.8], to: HUB.port('N'), spacing: 4.8, seed: 2 });
const B_EAST = boulevardPlan({ id: 'aveE', from: HUB.port('E'), to: [40.8, 75.6], spacing: 4.8, seed: 3 });
const B_WEST = boulevardPlan({ id: 'aveW', from: HUB.port('W'), to: [-12, 75.6], spacing: 4.8, seed: 4 });
const B_SOUTH = boulevardPlan({ id: 'aveS', from: HUB.port('S'), to: [0, 45.6], spacing: 4.8, seed: 6 });

/* hand-authored spine — indices are PRESERVED by buildParkNet.
 * (coaster queue tail = index 9) */
const SPINE: XZ[] = [
  /* 0 */ [40.8, 75.6],  // east boulevard terminus (merges with B_EAST:B)
  /* 1 */ [40.8, 68.4],  // east junction
  /* 2 */ [48.0, 68.4],  // Teacups tail
  /* 3 */ [33.6, 68.4],  // Willow Whirl tail
  /* 4 */ [40.8, 60.0],  // Sky Dancer tail
  /* 5 */ [48.0, 75.6],  // Cedar Plunge tail
  /* 6 */ [-12.0, 75.6], // west boulevard terminus (merges with B_WEST:B)
  /* 7 */ [-12.0, 63.6],
  /* 8 */ [-12.0, 51.6],
  /* 9 */ [-18.0, 51.6], // COASTER queue tail
  /* 10 */ [0.0, 45.6],  // south boulevard terminus (merges with B_SOUTH:B)
  /* 11 */ [9.6, 45.6],
  /* 12 */ [9.6, 38.4],  // Otter Falls tail
  /* 13 */ [-9.6, 45.6], // Meadow Wheel tail
];

const SPINE_EDGES: [number | string, number | string][] = [
  [0, 1], [1, 2], [1, 3], [1, 4], [2, 5],
  [6, 7], [7, 8], [8, 9],
  [10, 11], [11, 12], [10, 13],
  ['market:E', 0],
];

/* cells to keep dry — every ride pad, queue-lane cell and hut, plus the
 * coaster envelope */
const RIDE_CELLS: XZ[] = [
  [10.8, 88.8], [5.93, 88.8], [0, 88.8],            // carousel pad/head/tail
  [56.4, 68.4], [51.69, 68.4], [48, 68.4],          // teacups
  [24.0, 68.4], [28.79, 68.4], [33.6, 68.4],        // twist
  [40.8, 50.1], [40.8, 54.07], [40.8, 60],          // swing
  [60.0, 75.6], [55.05, 75.6], [48, 75.6],          // drop tower
  [-19.5, 45.6], [-15.53, 45.6], [-9.6, 45.6],      // ferris wheel
  [9.6, 27.6], [9.6, 31.0], [9.6, 34.71], [9.6, 38.4], // otter falls
  [-24, 51.6], [-21.69, 51.6], [-18, 51.6], [-21.6, 54.0], // coaster station/lane/exit
  [-3.6, 67.2],                                      // restroom
];

const COASTER_PTS = compileTrackPieces(B_PIECES, {
  type: 'steel', start: COASTER_START, heading: COASTER_HEADING, bounds: SIZE,
}).points;

/* extra keepDry along the coaster ring perimeter (coarse) */
const COASTER_KEEP: XZ[] = COASTER_PTS.filter((_: any, i: number) => i % 6 === 0)
  .map((p: number[]) => [Math.round(p[0] / 1.2) * 1.2, Math.round(p[2] / 1.2) * 1.2] as XZ);

const NET = buildParkNet({
  nodes: SPINE,
  edges: SPINE_EDGES,
  pieces: [HUB, MARKET, B_MAIN, B_EAST, B_WEST, B_SOUTH],
  keepDry: [...RIDE_CELLS, ...COASTER_KEEP],
});

/* log any plan lints so a degraded plan is visible in the console */
if (NET.warnings && NET.warnings.length) console.warn('[Briarwood] buildParkNet warnings', NET.warnings);
if (NET.pruned && NET.pruned.length) console.warn('[Briarwood] buildParkNet pruned', NET.pruned);

/* measure the flagship and print the MEASURED line */
try {
  const r = rateCoaster(COASTER_PTS, { type: 'steel', bank: 0.7, cars: 3 });
  console.log(
    `[thrill] Timberline Racer  E ${r.excitement} I ${r.intensity} N ${r.nausea} (${r.ratingBand})`,
    `drop ${r.highestDrop} G +${r.maxPosVertG}/${r.maxNegVertG} lat ${r.maxLatG} air ${r.airtimeSeconds}s`,
  );
} catch (e) { console.warn('[thrill] rateCoaster failed', e); }

/* ----------------------------------------------------------------------- */
/* deterministic scenery + tree scatter                                    */
/* ----------------------------------------------------------------------- */
function hash01(n: number): number {
  const s = Math.sin(n * 12.9898 + 78.233) * 43758.5453;
  return s - Math.floor(s);
}

/* street segments (world) for clearance tests */
const STREET_SEGS: [XZ, XZ][] = (() => {
  const segs: [XZ, XZ][] = [];
  const nd = NET.nodes as XZ[];
  for (const [a, b] of NET.edges as [number, number][]) {
    if (nd[a] && nd[b]) segs.push([[nd[a][0], nd[a][1]], [nd[b][0], nd[b][1]]]);
  }
  return segs;
})();

const PAD_CENTERS: XZ[] = [
  [10.8, 88.8], [56.4, 68.4], [24.0, 68.4], [40.8, 50.1], [60.0, 75.6],
  [-19.5, 45.6], [9.6, 27.6], [-24, 52.2],
  [0, 75.6], [40.8, 88.8], // hub + bazaar centres
];

function distSeg(px: number, pz: number, a: XZ, b: XZ): number {
  const dx = b[0] - a[0], dz = b[1] - a[1];
  const len2 = dx * dx + dz * dz || 1e-6;
  let t = ((px - a[0]) * dx + (pz - a[1]) * dz) / len2;
  t = Math.max(0, Math.min(1, t));
  const cx = a[0] + t * dx, cz = a[1] + t * dz;
  return Math.hypot(px - cx, pz - cz);
}

function safeSpot(px: number, pz: number, clear: number): boolean {
  if (Math.abs(px) > 74 || pz < 24 || pz > 92) return false;
  // plaza + bazaar exclusion
  if (Math.abs(px) < 7.2 && Math.abs(pz - 75.6) < 7.2) return false;
  if (Math.abs(px - 40.8) < 6.6 && Math.abs(pz - 88.8) < 6.6) return false;
  for (const s of STREET_SEGS) if (distSeg(px, pz, s[0], s[1]) < clear) return false;
  for (const p of PAD_CENTERS) if (Math.hypot(px - p[0], pz - p[1]) < 3.0) return false;
  // coaster polyline
  for (let i = 0; i < COASTER_PTS.length; i += 2) {
    const p = COASTER_PTS[i];
    if (Math.hypot(px - p[0], pz - p[2]) < 2.2) return false;
  }
  return true;
}

const TREE_SHAPES = ['round', 'pine', 'round', 'willow', 'pine'] as const;
const SCENERY_NAMES = [
  'marbleStatue', 'planterBox', 'topiarySpiral', 'flagpole', 'parkClock',
  'gazebo', 'birdbath', 'picnicTable', 'signpost', 'wishingWell',
  'lionStatue', 'mushroomCluster', 'fallenLog', 'topiaryElephant',
];

type Plant = { x: number; z: number; kind: 'tree' | 'scenery'; v: number };
const PLANTS: Plant[] = (() => {
  const out: Plant[] = [];
  let idx = 0;
  // jittered grid across the dry north band
  for (let gx = -72; gx <= 72; gx += 6) {
    for (let gz = 26; gz <= 92; gz += 6) {
      const h1 = hash01(idx * 3 + 1), h2 = hash01(idx * 3 + 2), h3 = hash01(idx * 3 + 3);
      idx++;
      const px = gx + (h1 - 0.5) * 4.4;
      const pz = gz + (h2 - 0.5) * 4.4;
      const isScenery = h3 > 0.72;
      const clear = isScenery ? 2.4 : 1.8;
      if (!safeSpot(px, pz, clear)) continue;
      out.push({ x: px, z: pz, kind: isScenery ? 'scenery' : 'tree', v: idx });
    }
  }
  return out;
})();

const TREES = PLANTS.filter((p) => p.kind === 'tree').slice(0, 64);
const SCENERY = PLANTS.filter((p) => p.kind === 'scenery').slice(0, 30);

/* ----------------------------------------------------------------------- */
/* the park                                                                */
/* ----------------------------------------------------------------------- */
export default function BriarwoodPark() {
  return (
    <div style={{ width: '100%', height: '100vh' }}>
      <Park
        seed={SEED}
        climate="temperate"
        size={SIZE}
        guests={18}
        background="#9ec7d8"
        roster={{ rides: 8, stalls: 4 }}
        onReady={(report: any) => {
          if (report && report.ok) {
            console.log('[Park] validatePark → ok: true');
          } else if (report) {
            console.log('[Park] validatePark → ok: false', JSON.stringify(report.failures));
            (report.failures || []).forEach((f: any) =>
              console.log(`[Park] validatePark FAIL [${f.check}] ${f.detail}`));
            (report.warnings || []).filter((w: any) => w.fatal).forEach((w: any) =>
              console.log(`[Park] validatePark WARN(fatal) [${w.kind}] ${w.detail}`));
          }
        }}
      >
        {/* 1 — terrain (guarded landform + the one far lake) */}
        <Terrain keepDry={NET.keepDry} coasterPts={COASTER_PTS} />

        {/* 2 — streets */}
        <Paths
          nodes={NET.nodes}
          edges={NET.edges}
          plazas={NET.plazas}
          bins={NET.bins}
          walkers={8}
        />

        {/* 3 — the sim brain */}
        <GameManager />

        {/* 4 — the gate (sole spawn; front-edge apron) */}
        <Gate />

        {/* set-pieces (after <Paths>) */}
        <FountainPlaza plan={HUB} />
        <Bazaar plan={MARKET} />
        <Boulevard plan={B_MAIN} />
        <Boulevard plan={B_EAST} />
        <Boulevard plan={B_WEST} />
        <Boulevard plan={B_SOUTH} />

        {/* ---------------- WEST: Timberline Heights ---------------- */}
        <Coaster
          name="Timberline Racer"
          pieces={B_PIECES}
          type="steel"
          start={COASTER_START}
          heading={COASTER_HEADING}
          capacity={4}
          rideDuration={10}
          intensity={7}
          price={5}
          cars={3}
          queueTailNode={9}
          queueDir={[1, 0]}
          deck={[-24.0, 52.2]}
        />

        {/* ---------------- MAIN STREET: first ride ---------------- */}
        <Carousel
          position={[10.8, 88.8]}
          rotation={-HALF_PI}
          register={{ name: 'Briarwood Gallopers', capacity: 8, rideDuration: 9, intensity: 2, price: 3 }}
          queue={{ anchor: [5.93, 88.8], dir: [-1, 0] }}
        />

        {/* ---------------- EAST: Meadow Midway ---------------- */}
        <Teacups
          position={[56.4, 68.4]}
          rotation={-HALF_PI}
          register={{ name: 'Bramble Cups', capacity: 4, rideDuration: 8, intensity: 3, price: 3 }}
          queue={{ anchor: [51.69, 68.4], dir: [-1, 0] }}
        />
        <TwistRide
          position={[24.0, 68.4]}
          rotation={HALF_PI}
          register={{ name: 'Willow Whirl', capacity: 6, rideDuration: 8, intensity: 5, price: 3 }}
          queue={{ anchor: [28.79, 68.4], dir: [1, 0] }}
        />
        <SwingRide
          position={[40.8, 50.1]}
          rotation={0}
          register={{ name: 'Sky Dancer', capacity: 8, rideDuration: 8, intensity: 4, price: 3 }}
          queue={{ anchor: [40.8, 54.07], dir: [0, 1] }}
        />
        <DropTower
          position={[60.0, 75.6]}
          rotation={-HALF_PI}
          register={{ name: 'Cedar Plunge', capacity: 10, rideDuration: 9, intensity: 8, price: 4 }}
          queue={{ anchor: [55.05, 75.6], dir: [-1, 0] }}
        />

        {/* ---------------- SOUTH: Willow Hollow ---------------- */}
        <FerrisWheel
          position={[-19.5, 45.6]}
          rotation={HALF_PI}
          register={{ name: 'Meadow Wheel', capacity: 8, rideDuration: 10, intensity: 1, price: 3 }}
          queue={{ anchor: [-15.53, 45.6], dir: [1, 0] }}
        />
        <LogFlume
          position={[9.6, 27.6]}
          rotation={0}
          pieces={FLUME_PIECES}
          register={{ name: 'Otter Falls', capacity: 4, rideDuration: 12, intensity: 5, price: 4 }}
          queue={{ anchor: [9.6, 34.71], dir: [0, 1] }}
        />

        {/* ---------------- amenities ---------------- */}
        <Restroom position={[-3.6, 67.2]} rotation={HALF_PI} />

        {/* dressing */}
        <Neon text="BRIARWOOD" position={[0, 3.2, 88.8]} rotation={Math.PI} scale={0.5} />
        <Torch position={[6, 81.6]} />
        <Torch position={[-6, 81.6]} />
        <Torch position={[13.2, 75.6]} />
        <Torch position={[-13.2, 75.6]} />
        <Torch position={[6, 69.6]} />
        <Lights from={[-6, 84]} to={[6, 84]} />
        <Lights from={[-6, 69.6]} to={[6, 69.6]} />

        {/* deterministic trees (≥48) */}
        {TREES.map((p, i) => (
          <Placed
            key={`t${i}`}
            position={[p.x, p.z]}
            build={(t: any) => tree(t, { shape: TREE_SHAPES[p.v % TREE_SHAPES.length] })}
          />
        ))}

        {/* deterministic scenery (≥24) */}
        {SCENERY.map((p, i) => (
          <Scenery
            key={`s${i}`}
            name={SCENERY_NAMES[p.v % SCENERY_NAMES.length]}
            position={[p.x, p.z]}
            seed={p.v}
          />
        ))}
      </Park>
    </div>
  );
}

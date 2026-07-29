// "Sunspire Gardens" — a cool RCT2-style 3D theme park.
//
// Built on the verified worked skeleton (park-composition / coaster-pieces /
// ride-and-stall-roster skills): seed 1 / temperate / size 128, the published
// 20+3 node street table, the §4.0-A steel flagship (rateCoaster measured), and
// a VERIFIED monorail circuit. Every coordinate is transcribed from a verified
// source; every ride pad is the LAST line of a tail-first helper that ends in
// offPathCell; buildParkNet is called EXACTLY ONCE.
//
// ── §0 HEADER ──────────────────────────────────────────────────────────────
// SEED   seed={1} climate="temperate" — the ring-park verified pin (relief
//        12.13 / stdH 1.09 / water 9.4% / secondFrac 0.38; bit-identical under
//        the ring's guard cells).
// CATS   gentle Meadow Carousel · thrill Sunspire Racer §4.0-A ·
//        water Lakeside Paddle Boats ⭐ · transport Skyline Monorail ·
//        dark Cinder Manor (GhostTrain) ⭐                        → 5/5
//        never-used picks: PaddleBoats, GhostTrain (≥ 2) ✓
// ROSTER 9 rides · 5 stalls (Neon/Foundry/Cove Bazaar rows + Balloon) · 5 cats
// FLAGSHIP §4.0-A steel @ start [16.8,0.55,-3.6]; queue tail [22.8,-3.6] dir[1,0]
//        rateCoaster line logged at module scope.
// CORRIDOR KEEP-OUT (§4.0-A @ start [16.8,-3.6], PLOT coords):
//   west valley  x[-21.6..-20.4] z[-10.8..9.6]
//   south valley x[-12.0..8.4]   z[-20.4..-18.0]
//   north valley x[-9.6..7.2]    z[16.8..19.2]
//   station leg  x[15.6..18.0]   z[-10.8..4.8]  (own ride — exempt)
//   every street node + boulevard leg sits outside all four ✓
// TRANSPORT Skyline Monorail — the VERIFIED single-platform circuit (worst
//        clearance 1.75, closed, nothing synthesized, not fatal), beamY 2.6,
//        price 0, pinned, sited on the west spine near node 15. Its queue tail
//        [-36.0,-8.4] is a real street node; it carries no gate-walk duty (the
//        near-gate Carousel does).
// WATER  seed-1 temperate: dominant + secondary; every pad/node walked dry.
// WORLDS pulse (E) · brasswork (S) · tidewater (N) — 3 built, each with a
//        registered ride pad inside its rect + a themed Bazaar row + scenery.
// QUEUE ROWS (tail → pad reach, AUTHOR column, via place()):
//   Sunspire Racer  cap4 tail [22.8,-3.6]  → §4.0-A start (queueTailNode)
//   Meadow Carousel cap8 tail [9.6,58.8]   near gate 14.4 u ✓
//   others tail-first through place(), offPathCell the LAST line.
// ───────────────────────────────────────────────────────────────────────────

import React from 'react';

import type { V3, XZ } from './components/Park';
import type { TrackPiece } from './components/SplineRideKit';
import {
  Park, GameManager, Terrain, Paths, Gate, Coaster, Restroom, Lights, Placed,
  offPathCell,
} from './components/Park';
import {
  buildParkNet, worldPlan, World,
  PULSE_DISTRICT, BRASSWORK_FOUNDRY, TIDEWATER_HOLLOW,
} from './components/SetPieceKit';
import { FountainPlaza, fountainPlazaPlan } from './components/FountainPlaza';
import { Bazaar, bazaarPlan } from './components/Bazaar';
import { Boulevard, boulevardPlan } from './components/Boulevard';
import { compileTrackPieces, rateCoaster } from './components/SplineRideKit';
import { tree } from './components/Kit';

import { Monorail } from './components/Monorail';
import { Carousel } from './components/Carousel';
import { GhostTrain } from './components/GhostTrain';
import { PaddleBoats } from './components/PaddleBoats';
import { ObservationTower } from './components/ObservationTower';
import { Discotron } from './components/Discotron';
import { AetherBalloons } from './components/AetherBalloons';
import { LogFlume } from './components/LogFlume';
import { BalloonStand } from './components/BalloonStand';

// ── FLAGSHIP §4.0-A (verbatim from the coaster-pieces archetype) ─────────────
const A_PIECES: TrackPiece[] = ['station',
  { type: 'lift', height: 5.5 }, { type: 'straight', length: 4.84 }, { type: 'turnR', angle: 90, radius: 2.5 },
  { type: 'drop', height: 5.5 }, { type: 'hill', height: 1.2 },
  { type: 'lift', height: 5.1 }, { type: 'straight', length: 2.34 }, { type: 'turnR', angle: 90, radius: 2.5 },
  { type: 'drop', height: 5.1 }, { type: 'hill', height: 0.6 }, { type: 'hill', height: 0.6 },
  { type: 'lift', height: 5.1 }, { type: 'turnR', angle: 90, radius: 2.5 },
  { type: 'drop', height: 5.1 }, { type: 'hill', height: 0.6 }, { type: 'hill', height: 0.6 },
  { type: 'lift', height: 5.1 }, { type: 'turnR', angle: 90, radius: 2.5 },
  { type: 'drop', height: 5.1 }, { type: 'straight', length: 1.5 }];
const A_START: V3 = [16.8, 0.55, -3.6];

const { points: FLAG_PTS } = compileTrackPieces(A_PIECES, {
  profile: 'coaster', type: 'steel', start: A_START, heading: 0, bounds: 128,
});
const RATING = rateCoaster(FLAG_PTS, { type: 'steel', bank: 0.7, cars: 5 });
// eslint-disable-next-line no-console
console.log('[thrill]', RATING.excitement, RATING.intensity, RATING.nausea,
  'drop', RATING.highestDrop, 'lat', RATING.maxLatG, 'air', RATING.airtimeSeconds);

// ── TRANSPORT — the VERIFIED single-platform monorail circuit ────────────────
// The byte-verified starter loop (worst clearance 1.75, closed, nothing
// synthesized, NOT fatal — Monorail/Context.md). beamY 2.6 flies its soffit
// 2.36 u over a slab; price 0; pinned. Sited on the west spine so it rings the
// quiet quarter of the park. Its station deck is the piece origin.
const RING_START: V3 = [-42.6, 2.6, -14.4];
const RING_PIECES: TrackPiece[] = [
  'station',                                     // the 2.6-u boarding deck
  { type: 'straight', length: 1.2 },             // near leg a
  { type: 'turnL', angle: 90, radius: 2 },
  { type: 'straight', length: 3 },               // cross leg b
  { type: 'turnL', angle: 90, radius: 2 },
  { type: 'straight', length: 5.3 },             // far = 2.6 + a + tail + 0.3
  { type: 'turnL', angle: 90, radius: 2 },
  { type: 'straight', length: 3 },               // cross leg b again (MATCHES)
  { type: 'turnL', angle: 90, radius: 2 },
  { type: 'straight', length: 1.2 },             // tail — lands 0.3 u short
];

// ── STREET SKELETON — the published 20 + 3 node table ────────────────────────
const NODES: XZ[] = [
  [0, 63.6],      // 0  GATE
  [0, 58.8],      // 1  gate-street junction
  [9.6, 58.8],    // 2  near-gate ride TAIL (Carousel) — 14.4 u of street from gate ✓
  [22.8, 45.6],   // 3  east apron north
  [22.8, 21.6],   // 4  east spine
  [22.8, -3.6],   // 5  §4.0-A queue TAIL (junction)
  [22.8, -8.4],   // 6  east junction
  [36.0, -8.4],   // 7  east district tail (Discotron)
  [22.8, -27.6],  // 8  south-east corner
  [9.6, 21.6],    // 9  ring ENTRY column
  [9.6, -27.6],   // 10 ring interior spine, south
  [0, -27.6],     // 11 south leg junction
  [0, -44.4],     // 12 south district tail (Aether Balloons)
  [-31.2, -27.6], // 13 south-west corner
  [-31.2, -8.4],  // 14 west junction
  [-36.0, -8.4],  // 15 monorail platform tail
  [-31.2, 16.8],  // 16 west leg north (z 16.8 clear of the seed-1 NW inlet)
  [-31.2, 45.6],  // 17 north-west corner
  [9.6, 27.6],    // 18 elbow to the north district
  [0, 27.6],      // 19 north district tail (Log Flume)
  [50.4, -8.4],   // 20 satellite viewpoint + second plaza
];

const HUB = fountainPlazaPlan({ id: 'hub', position: [0, 45.6], tiles: 7, ports: ['N', 'E', 'W'] });
const VIEW_PLAZA = fountainPlazaPlan({ id: 'viewpoint', position: [50.4, -8.4], tiles: 9, ports: ['W'] });

// Themed shopping rows, one per world, aimed by port so no diagonal can arise.
const PULSE_ROW = bazaarPlan({
  id: 'pulseRow', title: 'Neon Bazaar', position: [42.6, 3.6], theme: PULSE_DISTRICT,
  stalls: ['soda', 'cottonCandy', 'burger'], rotation: Math.PI / 2,
});
const WORKS_ROW = bazaarPlan({
  id: 'worksRow', title: 'Foundry Market', position: [12.0, -27.6], theme: BRASSWORK_FOUNDRY,
  stalls: ['burger', 'hotDog', 'soda'],
});
const TIDE_ROW = bazaarPlan({
  id: 'tideRow', title: 'Cove Market', position: [-12.0, 27.6], theme: TIDEWATER_HOLLOW,
  stalls: ['soda', 'cottonCandy', 'hotDog'],
});

const AVE_W = boulevardPlan({ id: 'aveW', from: HUB.port('W'), to: [-31.2, 45.6] });

// ── ASSERTIONS — cardinal edges, then a port-ref count ───────────────────────
const EDGES: [number | string, number | string][] = [
  [0, 1], [1, 'hub:N'], [1, 2],
  ['hub:E', 3], [3, 4], [4, 5], [5, 6], [6, 7], [6, 8], [4, 9],
  [9, 10], [9, 18], [18, 19], [8, 10], [10, 11], [11, 12], [11, 13],
  [13, 14], [14, 15], [14, 16], [16, 17], [17, 'aveW:B'], [7, 20],
  ['pulseRow:W', 6], ['worksRow:E', 11], ['tideRow:E', 19], ['viewpoint:W', 20],
];

EDGES.forEach(([a, b]) => {
  if (typeof a !== 'number' || typeof b !== 'number') return;
  const A = NODES[a], B = NODES[b];
  if (A[0] !== B[0] && A[1] !== B[1]) throw new Error(`diagonal edge ${a}->${b}`);
});

const EXPLICIT_PIECES = [HUB, VIEW_PLAZA, AVE_W];

// ── WORLDS — a registered ride pad falls inside each rect ─────────────────────
// `include` MUST list each world's registered ride PAD so the rect covers it —
// the pad cells are the offPathCell outputs computed below (DISCO/AETHER/FLUME).
const PULSE = worldPlan({
  id: 'pulse', theme: PULSE_DISTRICT, pieces: [PULSE_ROW],
  include: [[36.0, -8.4], [48.0, -8.4], [48.0, 3.6], [42.6, 12.0]],
});
const FOUNDRY = worldPlan({
  id: 'brasswork', theme: BRASSWORK_FOUNDRY, pieces: [WORKS_ROW],
  include: [[0, -44.4], [0, -34.8], [6.0, -33.6], [-6.0, -33.6]],
});
const GLADE = worldPlan({
  id: 'tidewater', theme: TIDEWATER_HOLLOW, pieces: [TIDE_ROW],
  include: [[0, 27.6], [0, 37.2], [-6.0, 33.6], [6.0, 33.6]],
});
const WORLDS = [PULSE, FOUNDRY, GLADE];

// EVERY set-piece port-referenced in EDGES (3 explicit + 3 world bazaars).
[...EXPLICIT_PIECES, ...WORLDS.flatMap((w) => w.pieces)].map((p) => p.id).forEach((id) => {
  if (!EDGES.some(([a, b]) => [a, b].some(
    (x) => typeof x === 'string' && x.split(':')[0] === id)))
    throw new Error(`set-piece '${id}' has NO '${id}:<PORT>' ref in EDGES`);
});

// ── ONE FUSE ─────────────────────────────────────────────────────────────────
const NET = buildParkNet({
  nodes: NODES, edges: EDGES, pieces: EXPLICIT_PIECES, worlds: WORLDS, keepDry: [],
  bins: [[15.6, -8.4], [4.8, 27.6]],
});

// ── the tail-first pad helper — offPathCell is the LAST line ──────────────────
function place(tail: XZ, out: XZ, capacity: number, front: number) {
  const join = Math.max(2.2, 1.1 + 0.56 * capacity) + 0.35;
  const cand: XZ = [tail[0] + out[0] * (join + front), tail[1] + out[1] * (join + front)];
  const anchor: XZ = [tail[0] + out[0] * join, tail[1] + out[1] * join];
  return {
    pad: (offPathCell(NET, cand, { clear: 1.8 }) ?? cand) as XZ,
    anchor, dir: [-out[0], -out[1]] as XZ,
  };
}

// near-gate gentle (Carousel cap 8), tail node 2, into the plot (-z)
const CAROUSEL = place([9.6, 58.8], [0, -1], 8, 1.8);
// water (PaddleBoats cap 4) on DRY land, tail node 3
const PADDLE = place([22.8, 45.6], [-1, 0], 4, 2.0);
// dark (GhostTrain cap 6), tail node 8
const GHOST = place([22.8, -27.6], [-1, 0], 6, 1.8);
// gentle landmark tower (cap 8), tail node 20
const TOWER = place([50.4, -8.4], [0, 1], 8, 1.8);
// pulse thrill (Discotron cap 12), tail node 7 — pad inside the E world rect
const DISCO = place([36.0, -8.4], [1, 0], 12, 4.0);
// foundry gentle (AetherBalloons cap 12), tail node 12 — pad inside the S rect
const AETHER = place([0, -44.4], [0, 1], 12, 3.7);
// tidewater water flume (cap 4) on DRY land, tail node 19 — pad inside the N rect
const FLUME = place([0, 27.6], [0, 1], 4, 4.4);

// buildings — clear 1.8
const REST = offPathCell(NET, [-31.2, 30.0], { clear: 1.8 }) ?? [-31.2, 30.0];
const BALLOON = offPathCell(NET, [3.6, 52.8], { clear: 1.8 }) ?? [3.6, 52.8];

// ── SCENERY — ≥ 32 mixed-shape trees, every cell off the streets ─────────────
const TREE_CELLS: { at: XZ; shape: 'pine' | 'round' | 'willow' }[] = ([
  [[-6, 54], 'round'], [[6, 54], 'pine'], [[-14, 50.4], 'willow'], [[14, 50.4], 'round'],
  [[-20.4, 40.8], 'pine'], [[20.4, 33.6], 'round'], [[-24, 21.6], 'willow'], [[27.6, 15.6], 'pine'],
  [[-24, 6], 'round'], [[30, 3.6], 'pine'], [[-24, -6], 'willow'], [[30, -14.4], 'round'],
  [[-24, -20.4], 'pine'], [[27.6, -20.4], 'round'], [[-18, -33.6], 'willow'], [[18, -33.6], 'pine'],
  [[-6, -39.6], 'round'], [[6, -39.6], 'pine'], [[-38.4, -3.6], 'willow'], [[-38.4, -14.4], 'round'],
  [[-38.4, 9.6], 'pine'], [[-25.2, 39.6], 'round'], [[-25.2, 45.6], 'willow'], [[14.4, 33.6], 'pine'],
  [[-14.4, 39.6], 'round'], [[47.6, -14.4], 'willow'], [[54, -3.6], 'round'], [[47.6, -3.6], 'pine'],
  [[-38.4, 21.6], 'willow'], [[38.4, 9.6], 'round'], [[-6.0, 39.6], 'pine'], [[6.0, 39.6], 'round'],
  [[42.6, 18.0], 'willow'], [[-9.6, -33.6], 'pine'],
] as [XZ, 'pine' | 'round' | 'willow'][]).map(([at, shape]) => ({
  at: (offPathCell(NET, at, { clear: 1.2 }) ?? at) as XZ,
  shape,
}));

export function App() {
  return (
    <Park
      seed={1}
      climate="temperate"
      roster={{
        rides: [
          'Sunspire Racer', 'Skyline Monorail', 'Meadow Carousel', 'Cinder Manor',
          'Lakeside Paddle Boats', 'Sunspire Tower', 'Discotron', 'Aether Balloons',
          'Timber Chute',
        ],
        stalls: 5,
        categories: 5,
      }}
      onReady={(report) => {
        // eslint-disable-next-line no-console
        console.log('[Park] ok:', report.ok, 'failures:', report.failures?.length,
          'warnings:', report.warnings?.length);
      }}
    >
      <Terrain keepDry={NET.keepDry} coasterPts={FLAG_PTS} />
      <Paths
        nodes={NET.nodes}
        edges={NET.edges}
        plazas={NET.plazas}
        bins={NET.bins}
        walkers={8}
      />
      <GameManager />
      <Gate />

      {/* THRILL — the §4.0-A flagship */}
      <Coaster
        name="Sunspire Racer"
        pieces={A_PIECES}
        start={A_START}
        heading={0}
        type="steel"
        cars={5}
        capacity={4}
        rideDuration={10}
        loadTime={2}
        intensity={7}
        price={6}
        queueTailNode={NET.node([22.8, -3.6])}
        queueDir={[1, 0]}
        deck={[A_START[0], A_START[2] + 1.2]}
      />

      {/* TRANSPORT — the verified elevated monorail circuit */}
      <Monorail
        pieces={RING_PIECES}
        start={RING_START}
        heading={0}
        beamY={2.6}
        loopSeconds={12}
        pinned
        register={{
          name: 'Skyline Monorail', capacity: 6, rideDuration: 12, intensity: 1, price: 0,
          queueAnchor: [-36.0 + 0.56, -8.4], queueDir: [1, 0],
        }}
      />

      {/* GENTLE near the gate — carries the smoke cycle (14.4 u tail) */}
      <Carousel
        position={CAROUSEL.pad}
        rotation={0}
        register={{ name: 'Meadow Carousel', capacity: 8, rideDuration: 9, intensity: 2, price: 3 }}
        queue={{ anchor: CAROUSEL.anchor, dir: CAROUSEL.dir }}
      />

      {/* WATER — PaddleBoats (builds its own pond, on DRY land) */}
      <PaddleBoats
        position={PADDLE.pad}
        rotation={0}
        register={{ name: 'Lakeside Paddle Boats', capacity: 4, rideDuration: 12, intensity: 1, price: 2 }}
        queue={{ anchor: PADDLE.anchor, dir: PADDLE.dir }}
      />

      {/* DARK — GhostTrain */}
      <GhostTrain
        position={GHOST.pad}
        rotation={0}
        register={{ name: 'Cinder Manor', capacity: 6, rideDuration: 11, intensity: 5, price: 4 }}
        queue={{ anchor: GHOST.anchor, dir: GHOST.dir }}
      />

      {/* GENTLE LANDMARK — the observation tower on the viewpoint */}
      <ObservationTower
        position={TOWER.pad}
        rotation={0}
        register={{ name: 'Sunspire Tower', capacity: 8, rideDuration: 10, intensity: 1, price: 2 }}
        queue={{ anchor: TOWER.anchor, dir: TOWER.dir }}
      />

      {/* PULSE world thrill */}
      <Discotron
        position={DISCO.pad}
        rotation={0}
        register={{ name: 'Discotron', capacity: 12, rideDuration: 13, intensity: 6, price: 4 }}
        queue={{ anchor: DISCO.anchor, dir: DISCO.dir }}
      />

      {/* FOUNDRY world gentle */}
      <AetherBalloons
        position={AETHER.pad}
        rotation={0}
        register={{ name: 'Aether Balloons', capacity: 12, rideDuration: 14, intensity: 2, price: 3 }}
        queue={{ anchor: AETHER.anchor, dir: AETHER.dir }}
      />

      {/* TIDEWATER world water flume (stock layout — no pieces) */}
      <LogFlume
        position={FLUME.pad}
        rotation={0}
        register={{ name: 'Timber Chute', capacity: 4, rideDuration: 12, intensity: 5, price: 4 }}
        queue={{ anchor: FLUME.anchor, dir: FLUME.dir }}
      />

      {/* AMENITIES */}
      <Restroom position={REST as XZ} rotation={Math.PI / 2} />
      <BalloonStand position={BALLOON as XZ} rotation={Math.PI} register name="Sunspire Balloons" price={2} value={3} />

      {/* SET-PIECES + WORLD REGIONS (after <Paths>) */}
      <FountainPlaza plan={HUB} />
      <FountainPlaza plan={VIEW_PLAZA} />
      <Boulevard plan={AVE_W} />
      <World plan={PULSE} />
      <Bazaar plan={PULSE_ROW} />
      <World plan={FOUNDRY} />
      <Bazaar plan={WORKS_ROW} />
      <World plan={GLADE} />
      <Bazaar plan={TIDE_ROW} />

      {/* LIGHTS — one run per district, along the street */}
      <Lights from={[22.8, 21.6]} to={[22.8, 3.6]} />
      <Lights from={[0, -27.6]} to={[0, -39.6]} />
      <Lights from={[-31.2, -8.4]} to={[-31.2, 8.4]} />
      <Lights from={[0, 58.8]} to={[9.6, 58.8]} />

      {/* SCENERY — ≥ 32 mixed trees */}
      {TREE_CELLS.map((t, i) => (
        <Placed
          key={i}
          build={(three) => tree(three, { shape: t.shape })}
          position={t.at}
        />
      ))}
    </Park>
  );
}

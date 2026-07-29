// Willowmere Park — a full RCT2-style theme park on ONE <Park> canvas.
//
// SEED  seed=1 climate="temperate" (verified ring-clean; both water bodies stay put).
//
// CATS  gentle Carousel · thrill Thunderhead(coaster) · water Reef Racer ·
//       transport Skyline Chairlift · dark Haunted Hollow(ghost train)          → 5/5
//       never-used: Chairlift, GhostTrain, PaddleBoats, Bobsleigh, Discotron,
//                   EmberWings, ReefRacer  (≥ 2) ✓
//
// ROSTER 10 rides · 6 stalls (3 themed bazaars) · 5 categories.
//
// WORLDS pulse (E court) · emberfall (S-centre court) · tidewater (W court) —
//        each with its own themed bazaar + a world ride + world scenery, region
//        declared via <World>.
//
// CORRIDOR KEEP-OUT (§4.0-A @ start [16.8,-3.6], PLOT coords):
//   west valley  x[-21.6..-20.4] z[-10.8..9.6]
//   south valley x[-12.0..8.4]   z[-20.4..-18.0]
//   north valley x[-9.6..7.2]    z[16.8..19.2]
//   station leg  x[15.6..18.0]   z[-10.8..4.8]  (own ride — exempt)
//   every street node + the avenue sits outside all four ✓

import React from 'react';
import type { V3, XZ } from './components/Park';
import type { TrackPiece } from './components/SplineRideKit';
import {
  Park, GameManager, Terrain, Paths, Gate, Coaster,
  Restroom, Scenery, Lights, Placed, offPathCell,
} from './components/Park';
import {
  buildParkNet, worldPlan, World,
  PULSE_DISTRICT, EMBERFALL_CALDERA, TIDEWATER_HOLLOW,
} from './components/SetPieceKit';
import { FountainPlaza, fountainPlazaPlan } from './components/FountainPlaza';
import { Bazaar, bazaarPlan } from './components/Bazaar';
import { Boulevard, boulevardPlan } from './components/Boulevard';
import { compileTrackPieces } from './components/SplineRideKit';
import { tree } from './components/Kit';

import { Carousel } from './components/Carousel';
import { Chairlift } from './components/Chairlift';
import { GhostTrain } from './components/GhostTrain';
import { PaddleBoats } from './components/PaddleBoats';
import { Bobsleigh } from './components/Bobsleigh';
import { ObservationTower } from './components/ObservationTower';
import { Discotron } from './components/Discotron';
import { EmberWings } from './components/EmberWings';
import { ReefRacer } from './components/ReefRacer';

import { LavaFissure, CharredSnag, BasaltColumns } from './components/EmberfallScenery';
import { WreckedHull, CoralCluster, AnchorPile } from './components/TidewaterScenery';
import { NeonArch, SpeakerStack, LightTiles } from './components/PulseScenery';

// ── FLAGSHIP: §4.0-A steel rectangle, verbatim ──────────────────────────────
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
const A_TAIL: XZ = [22.8, -3.6];

const { points: FLAG_PTS } = compileTrackPieces(A_PIECES, {
  profile: 'coaster', type: 'steel', start: A_START, heading: 0,
});

// ── SET-PIECES ──────────────────────────────────────────────────────────────
const HUB = fountainPlazaPlan({ id: 'hub', position: [0, 45.6], tiles: 7, ports: ['N', 'E', 'W'] });
// ports: N [0,50.4] · E [6.0,45.6] · W [-6.0,45.6]

// 2-stall bazaars → tiles 5, half 3.0, ports ±3.6 on the aisle axis (rot 0 = E/W).
const PULSE_ROW = bazaarPlan({ id: 'pulseRow', title: 'Neon Bazaar', position: [46.8, -8.4], theme: PULSE_DISTRICT, stalls: ['soda', 'cottonCandy'], seed: 7 });
//   W [43.2,-8.4]  E [50.4,-8.4]
const TIDE_ROW = bazaarPlan({ id: 'tideRow', title: 'Cove Market', position: [-46.8, -8.4], theme: TIDEWATER_HOLLOW, stalls: ['burger', 'soda'], seed: 5 });
//   W [-50.4,-8.4]  E [-43.2,-8.4]
const EMBER_ROW = bazaarPlan({ id: 'emberRow', title: 'Caldera Market', position: [0, -33.6], theme: EMBERFALL_CALDERA, stalls: ['hotDog', 'cottonCandy'], seed: 3 });
//   W [-3.6,-33.6]  E [3.6,-33.6]

// ── STREET SKELETON — a park-spanning loop crossing z=0 on three legs ────────
const NODES: XZ[] = [
  /*  0 */ [0, 63.6],      // GATE
  /*  1 */ [0, 58.8],      // gate junction
  /*  2 */ [9.6, 58.8],    // Carousel tail (14.4 u of street from the gate)
  /*  3 */ [22.8, 45.6],   // NE apron  (wired from hub:E)
  /*  4 */ [22.8, 36.0],   // Skyward Tower tail  (on 3->5)
  /*  5 */ [22.8, 21.6],   // east spine mid
  /*  6 */ [22.8, -3.6],   // Thunderhead tail (junction)
  /*  7 */ [22.8, -8.4],   // east junction
  /*  8 */ [22.8, -27.6],  // SE corner
  /*  9 */ [0, -27.6],     // south junction
  /* 10 */ [-22.8, -27.6], // SW mid
  /* 11 */ [-31.2, -27.6], // SW corner
  /* 12 */ [-31.2, -8.4],  // west junction
  /* 13 */ [-31.2, 30.0],  // west leg north (clear of pier rows)
  /* 14 */ [-31.2, 45.6],  // NW corner (wired to hub:W + avenue)
  /* 15 */ [9.6, 21.6],    // interior column north
  /* 16 */ [9.6, -8.4],    // Haunted Hollow tail (interior column)
  /* 17 */ [9.6, -27.6],   // interior column south
  // PULSE court (east)
  /* 18 */ [43.2, -8.4],   // pulseRow:W
  /* 19 */ [50.4, -8.4],   // pulseRow:E
  /* 20 */ [50.4, -16.8],  // Discotron tail
  // TIDEWATER court (west)
  /* 21 */ [-43.2, -8.4],  // tideRow:E
  /* 22 */ [-43.2, -16.8], // Reef Racer tail
  /* 23 */ [-31.2, -14.4], // Alpine Bobsleigh tail (west spine)
  // EMBERFALL court (south centre)
  /* 24 */ [3.6, -27.6],   // ember spur top
  /* 25 */ [3.6, -33.6],   // emberRow:E
  /* 26 */ [-3.6, -33.6],  // emberRow:W (Ember Wings reach)
  /* 27 */ [-9.6, -33.6],  // Ember Wings tail
  // satellite viewpoint + 2nd plaza (outside the gate-reach band)
  /* 28 */ [50.4, 12.0],   // Skyline Chairlift tail (east apron north)
];

const EDGES: [number | string, number | string][] = [
  [0, 1], [1, 'hub:N'], [1, 2],
  ['hub:E', 3], [3, 4], [4, 5], [5, 6], [6, 7], [7, 8], [8, 9],
  [5, 15], [15, 17], [17, 8],           // interior column (auto-splits at 16)
  [9, 10], [10, 11],                    // south spine
  [11, 12], [12, 13], [13, 14], [14, 'hub:W'],
  // PULSE court
  [7, 18], [18, 19], [19, 20],
  ['pulseRow:W', 18], ['pulseRow:E', 19],
  [19, 28],                             // chairlift spur up the east apron
  // TIDEWATER court
  [12, 21], [21, 22],
  ['tideRow:E', 21],
  [12, 23],                             // bobsleigh spur (z between 12 and 11)
  // EMBERFALL court
  [9, 24], [24, 25], [25, 26], [26, 27],
  ['emberRow:E', 25], ['emberRow:W', 26],
];

// ── QUEUE HELPER — the pad is an OUTPUT of offPathCell ───────────────────────
function laneLenOf(c: number) { return Math.max(2.2, 1.1 + 0.56 * c); }
function place(net: ReturnType<typeof buildParkNet>, tail: XZ, out: XZ, capacity: number, front: number) {
  const join = laneLenOf(capacity) + 0.35;
  const cand: XZ = [tail[0] + out[0] * (join + front), tail[1] + out[1] * (join + front)];
  const anchor: XZ = [tail[0] + out[0] * join, tail[1] + out[1] * join];
  const pad = (offPathCell(net, cand, { clear: 1.8 }) ?? cand) as XZ;
  return { pad, anchor, dir: [-out[0], -out[1]] as XZ };
}

// one approach avenue on the long NW->hub leg
const AVE = boulevardPlan({ id: 'ave', from: [-31.2, 45.6], to: [-13.2, 45.6], avoid: [[-31.2, 45.6]], clear: 2.6 });

const KEEP_DRY: XZ[] = [...NODES];

// EVERY EDGE CARDINAL (skip NetRef strings)
EDGES.forEach(([a, b]) => {
  if (typeof a !== 'number' || typeof b !== 'number') return;
  const A = NODES[a], B = NODES[b];
  if (A[0] !== B[0] && A[1] !== B[1]) throw new Error(`diagonal edge ${a}->${b}`);
});

// ── ONE FUSE ────────────────────────────────────────────────────────────────
const NET = buildParkNet({
  nodes: NODES,
  edges: [...EDGES, [14, 'ave:A'] as [number | string, number | string]],
  pieces: [HUB, PULSE_ROW, TIDE_ROW, EMBER_ROW, AVE],
  keepDry: KEEP_DRY,
  bins: [[1.5, 12.0]],
});

// ── ride pads (all through place() → offPathCell) ───────────────────────────
const CAROUSEL = place(NET, NODES[2], [0, -1], 8, 1.8);
const TOWER = place(NET, NODES[4], [1, 0], 8, 1.8);
const GHOST = place(NET, NODES[16], [-1, 0], 6, 1.8);
const CHAIR = place(NET, NODES[28], [-1, 0], 6, 1.8);
const DISCO = place(NET, NODES[20], [-1, 0], 12, 4.0);
const REEF = place(NET, NODES[22], [-1, 0], 4, 2.1);
const EMBER = place(NET, NODES[27], [-1, 0], 8, 3.1);
const BOBSLED = place(NET, NODES[23], [-1, 0], 4, 4.6);
const PADDLE = place(NET, NODES[10], [0, 1], 4, 1.8);

// ── worlds (region contains the ride PAD + stall + scenery) ──────────────────
const PULSE = worldPlan({
  id: 'pulse', theme: PULSE_DISTRICT, pieces: [PULSE_ROW],
  rides: [{ at: DISCO.pad, name: 'Discotron' }],
  include: [[46.8, -8.4], [55.2, -14.4], [55.2, -24.0], [44.4, -26.4]],
});
const EMBER_WORLD = worldPlan({
  id: 'emberfall', theme: EMBERFALL_CALDERA, pieces: [EMBER_ROW],
  rides: [{ at: EMBER.pad, name: 'Ember Wings' }],
  include: [[0, -33.6], [-15.6, -40.8], [6.0, -42.0], [-9.6, -45.6]],
});
const TIDE_WORLD = worldPlan({
  id: 'tidewater', theme: TIDEWATER_HOLLOW, pieces: [TIDE_ROW],
  rides: [{ at: REEF.pad, name: 'Reef Racer' }],
  include: [[-46.8, -8.4], [-55.2, -14.4], [-55.2, -24.0], [-44.4, -26.4]],
});
const WORLDS = [PULSE, EMBER_WORLD, TIDE_WORLD];

// ── scenery scatter, snapped off the lattice ────────────────────────────────
const dry = (x: number, z: number) => (offPathCell(NET, [x, z], { clear: 1.2 }) ?? [x, z]) as XZ;

const TREE_CELLS: [number, number][] = [
  [-8, 40], [8, 40], [-16, 40], [16, 40], [-24, 38], [28, 32], [-28, 24], [30, 18],
  [-36, 14], [34, 10], [-38, -2], [40, 2], [-6, 34], [6, 34], [14, 30], [-14, 30],
  [-2, 12], [2, 12], [-20, 4], [20, 4], [-26, -16], [26, -18], [-6, -40], [6, -40],
  [-20, -40], [16, -34], [-38, -20], [38, -22], [-2, -44], [2, -44], [56, 6], [-56, 6],
  [58, -6], [-58, -6], [12, -44], [-14, -44],
];
const TREES = TREE_CELLS.map((c, i) => ({
  at: dry(c[0], c[1]),
  shape: (['pine', 'round', 'willow'] as const)[i % 3],
}));

const NEUTRAL_SCENERY: { name: string; at: XZ }[] = [
  { name: 'flagpole', at: dry(3.6, 40.8) },
  { name: 'flagpole', at: dry(-3.6, 40.8) },
  { name: 'parkClock', at: dry(-9.6, 40.8) },
  { name: 'gazebo', at: dry(-34.8, 6.0) },
  { name: 'wishingWell', at: dry(33.6, 4.8) },
  { name: 'topiaryElephant', at: dry(15.6, 33.6) },
  { name: 'topiarySpiral', at: dry(-15.6, 33.6) },
  { name: 'planterBox', at: dry(4.8, 33.6) },
  { name: 'birdbath', at: dry(-4.8, 33.6) },
  { name: 'picnicTable', at: dry(30.0, 24.0) },
  { name: 'marbleStatue', at: dry(58.8, 0.0) },
  { name: 'lionStatue', at: dry(-58.8, 0.0) },
  { name: 'signpost', at: dry(9.6, 12.0) },
  { name: 'flagpole', at: dry(-9.6, 12.0) },
];

export function ThemePark() {
  return (
    <Park
      seed={1}
      climate="temperate"
      roster={{
        rides: [
          'Thunderhead', 'Carousel', 'Skyline Chairlift', 'Haunted Hollow',
          'Tidewater Paddle Boats', 'Alpine Bobsleigh', 'Skyward Tower',
          'Discotron', 'Ember Wings', 'Reef Racer',
        ],
        stalls: 6,
        categories: 5,
      }}
      onReady={(report: { ok: boolean }) => {
        // eslint-disable-next-line no-console
        console.log('[Willowmere Park] validatePark', report);
      }}
    >
      <Terrain keepDry={NET.keepDry} coasterPts={FLAG_PTS} />
      <Paths nodes={NET.nodes} edges={NET.edges} plazas={NET.plazas} bins={NET.bins} walkers={8} />
      <GameManager />
      <Gate />

      {/* THRILL flagship — §4.0-A (exit/exitDir omitted; chassis derives) */}
      <Coaster
        name="Thunderhead"
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
        queueTailNode={NET.node(A_TAIL)}
        queueDir={[1, 0]}
        deck={[A_START[0], A_START[2] + 1.2]}
      />

      {/* near-gate GENTLE cycle carrier */}
      <Carousel position={CAROUSEL.pad} rotation={Math.PI}
        register={{ name: 'Carousel', capacity: 8, rideDuration: 9, intensity: 2, price: 3 }}
        queue={{ anchor: CAROUSEL.anchor, dir: CAROUSEL.dir }} />

      {/* TRANSPORT (never-used) */}
      <Chairlift position={CHAIR.pad} rotation={Math.PI / 2}
        register={{ name: 'Skyline Chairlift', capacity: 6, rideDuration: 10, intensity: 2, price: 3 }}
        queue={{ anchor: CHAIR.anchor, dir: CHAIR.dir }} />

      {/* DARK (never-used) */}
      <GhostTrain position={GHOST.pad} rotation={Math.PI / 2}
        register={{ name: 'Haunted Hollow', capacity: 6, rideDuration: 11, intensity: 5, price: 4 }}
        queue={{ anchor: GHOST.anchor, dir: GHOST.dir }} />

      {/* WATER (never-used) — builds its own pond, on DRY land */}
      <PaddleBoats position={PADDLE.pad} rotation={0}
        register={{ name: 'Tidewater Paddle Boats', capacity: 4, rideDuration: 12, intensity: 1, price: 2 }}
        queue={{ anchor: PADDLE.anchor, dir: PADDLE.dir }} />

      {/* THRILL moderate (never-used) */}
      <Bobsleigh position={BOBSLED.pad} rotation={Math.PI / 2}
        register={{ name: 'Alpine Bobsleigh', capacity: 4, rideDuration: 10, intensity: 6, price: 4 }}
        queue={{ anchor: BOBSLED.anchor, dir: BOBSLED.dir }} />

      {/* GENTLE landmark */}
      <ObservationTower position={TOWER.pad} rotation={-Math.PI / 2}
        register={{ name: 'Skyward Tower', capacity: 8, rideDuration: 10, intensity: 1, price: 2 }}
        queue={{ anchor: TOWER.anchor, dir: TOWER.dir }} />

      {/* PULSE world ride (never-used) */}
      <Discotron position={DISCO.pad} rotation={-Math.PI / 2}
        register={{ name: 'Discotron', capacity: 12, rideDuration: 13, intensity: 6, price: 4 }}
        queue={{ anchor: DISCO.anchor, dir: DISCO.dir }} />

      {/* EMBERFALL world ride (never-used) — suspended flyer, stock circuit */}
      <EmberWings position={EMBER.pad} rotation={-Math.PI / 2}
        register={{ name: 'Ember Wings', capacity: 8, rideDuration: 18, intensity: 4, price: 5 }}
        queue={{ anchor: EMBER.anchor, dir: EMBER.dir }} />

      {/* TIDEWATER world ride (never-used) — water coaster, stock circuit */}
      <ReefRacer position={REEF.pad} rotation={Math.PI / 2}
        register={{ name: 'Reef Racer', capacity: 4, rideDuration: 22, intensity: 8, price: 5 }}
        queue={{ anchor: REEF.anchor, dir: REEF.dir }} />

      {/* amenity */}
      <Restroom position={offPathCell(NET, [-9.6, 51.6], { clear: 1.8 }) ?? [-9.6, 51.6]} rotation={Math.PI / 2} />

      {/* set-pieces AFTER <Paths> */}
      <FountainPlaza plan={HUB} />
      <Boulevard plan={AVE} />
      <Bazaar plan={PULSE_ROW} />
      <Bazaar plan={TIDE_ROW} />
      <Bazaar plan={EMBER_ROW} />

      <World plan={PULSE} />
      <World plan={EMBER_WORLD} />
      <World plan={TIDE_WORLD} />

      {/* world scenery (each world ≥ 1 piece from its own pack) */}
      <NeonArch position={dry(55.2, -14.4)} rotation={Math.PI / 2} />
      <SpeakerStack position={dry(55.2, -24.0)} rotation={Math.PI / 2} />
      <LightTiles position={dry(44.4, -26.4)} />

      <LavaFissure position={dry(-15.6, -40.8)} rotation={1.6} length={2.2} seed={4} />
      <CharredSnag position={dry(6.0, -42.0)} seed={5} />
      <BasaltColumns position={dry(-9.6, -45.6)} seed={3} />

      <WreckedHull position={dry(-55.2, -14.4)} rotation={0.6} />
      <CoralCluster position={dry(-55.2, -24.0)} seed={5} />
      <AnchorPile position={dry(-44.4, -26.4)} seed={2} />

      {/* neutral scenery */}
      {NEUTRAL_SCENERY.map((s, i) => (
        <Scenery key={`sc-${i}`} name={s.name} position={s.at} seed={i + 1} />
      ))}

      {/* trees (mixed shapes) */}
      {TREES.map((t, i) => (
        <Placed key={`tr-${i}`} build={(three) => tree(three, { shape: t.shape })} position={t.at} />
      ))}

      {/* one <Lights> run per district */}
      <Lights from={[22.8, 12.0]} to={[22.8, 0.0]} />
      <Lights from={[50.4, -8.4]} to={[50.4, -16.8]} />
      <Lights from={[-31.2, -8.4]} to={[-31.2, -16.8]} />
      <Lights from={[3.6, -27.6]} to={[3.6, -33.6]} />
    </Park>
  );
}

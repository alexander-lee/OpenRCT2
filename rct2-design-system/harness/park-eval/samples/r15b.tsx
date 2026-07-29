import React from 'react';
import * as THREE from 'three';

import {
  Park,
  GameManager,
  Terrain,
  Paths,
  Gate,
  Coaster,
  Restroom,
  Fountain,
  Torch,
  Neon,
  Scenery,
  Lights,
  Placed,
  offPathCell,
} from './components/Park';
import type { V3, XZ } from './components/Park';
import type { NetRef } from './components/SetPieceKit';
import type { TrackPiece } from './components/SplineRideKit';

import { parkComposition } from './components/ParkBuilder';
import { compileTrackPieces, rateCoaster } from './components/SplineRideKit';
import { buildParkNet } from './components/SetPieceKit';
import { FountainPlaza, fountainPlazaPlan } from './components/FountainPlaza';
import { Bazaar, bazaarPlan } from './components/Bazaar';
import { tree } from './components/Kit';

import { FerrisWheel } from './components/FerrisWheel';
import { Carousel } from './components/Carousel';
import { Teacups } from './components/Teacups';
import { DropTower } from './components/DropTower';
import { SwingRide } from './components/SwingRide';

// ─────────────────────────────────────────────────────────────────────────
// A compact, hand-composed park at size 48 (single water body, no mandatory
// monorail). Streets are fused by buildParkNet so every edge is cardinal and
// every set-piece is a real junction; the coaster is the VERIFIED legacy steel
// rectangle translated rigidly in lattice multiples of 1.2.
// ─────────────────────────────────────────────────────────────────────────

const SEED = 4;
const SIZE = 48;
const CLIMATE = 'temperate' as const;

// ── The coaster — legacy steel rectangle, translated by (dx -12.0, dz -1.2) ──
// Verified start [2.4, 0.55, -6.0] → translated start [-9.6, 0.55, -7.2].
const COASTER_PIECES: TrackPiece[] = [
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
const C_START: V3 = [-9.6, 0.55, -7.2];
const C_TAIL: XZ = [C_START[0] + 6.0, C_START[2]]; // [-3.6, -7.2]

const compiled = compileTrackPieces(COASTER_PIECES, {
  profile: 'coaster',
  type: 'steel',
  start: C_START,
  heading: 0,
});
const COASTER_PTS: V3[] = compiled.points;
const RATING = rateCoaster(COASTER_PTS, { type: 'steel', bank: 0.7, cars: 3 });
// eslint-disable-next-line no-console
console.log(
  '[thrill] Cinder Racer',
  'E', RATING.excitement.toFixed(2),
  'I', RATING.intensity.toFixed(2),
  'N', RATING.nausea.toFixed(2),
  'lat', RATING.maxLatG.toFixed(2),
);

// ── Set-pieces ──────────────────────────────────────────────────────────────
const HUB = fountainPlazaPlan({
  id: 'hub',
  title: 'Grand Plaza',
  position: [0, 15.6],
  tiles: 7, // half 4.2 → ports N [0,20.4] E [4.8,15.6] W [-4.8,15.6] S [0,10.8]
  ports: ['N', 'E', 'W', 'S'],
});

// Market row on the east column, aisle running N/S so its W port faces north
// and is entered ALONG the aisle. half 5.4 → W port at [16.8, -3.6].
const MARKET = bazaarPlan({
  id: 'market',
  title: 'Sunset Market',
  position: [16.8, -9.6],
  stalls: ['burger', 'soda', 'cottonCandy', 'hotDog'],
  facing: { port: 'W', toward: [16.8, 4.8] },
  names: ['Ferris Fries', 'Plaza Pop', 'Cloud Nine Candy', 'Coaster Dogs'],
});

// ── The street lattice (authored cells) ─────────────────────────────────────
const GATE: XZ = [0, 22.8];
const NODES: XZ[] = [
  /*  0 */ GATE, //           +z rim, centred
  /*  1 */ [16.8, 15.6], //   east promenade   ← 'hub:E' [4.8,15.6]
  /*  2 */ [-13.2, 15.6], //  west promenade   ← 'hub:W' [-4.8,15.6]
  /*  3 */ [0, 9.6], //       central south    ← 'hub:S' [0,10.8]
  /*  4 */ [8.4, 9.6], //     south-east link
  /*  5 */ [8.4, -1.2], //    south column
  /*  6 */ [8.4, -7.2], //    south-east corner
  /*  7 */ C_TAIL, //         [-3.6,-7.2] COASTER queue tail (leaf)
  /*  8 */ [-13.2, 9.6], //   west column (clear of the coaster corridor)
  /*  9 */ [16.8, 4.8], //    east column       ← 'market:W' approach
];
const EDGES: [NetRef, NetRef][] = [
  [0, 'hub:N'],
  ['hub:E', 1],
  ['hub:W', 2],
  ['hub:S', 3],
  [3, 4],
  [4, 5],
  [5, 6],
  [6, 7], // south-east arm → coaster tail
  [2, 8], // west column
  [1, 9], // east promenade → east column
  [9, 'market:W'], // enter the bazaar along its aisle
];

// ── ONE fuse ────────────────────────────────────────────────────────────────
const NET = buildParkNet({
  nodes: NODES,
  edges: EDGES,
  pieces: [HUB, MARKET],
  keepDry: NODES,
  bins: [[1.5, 12.0]],
});

// ── Dryness sieve, from the composed basins ─────────────────────────────────
const COMP = parkComposition(THREE, SEED, SIZE, CLIMATE, {
  keepDry: NET.keepDry,
  coasterPts: COASTER_PTS,
});
const isDry = (c: XZ, margin = 1.2) =>
  [...COMP.basins, ...COMP.basinsSecond].every(
    (b) => Math.hypot(c[0] - b.x, c[1] - b.z) > 0.74 * b.radius + margin,
  );

// ── Trees + scenery, sieved off the streets AND the water ───────────────────
const TREE_SHAPES = ['round', 'pine', 'willow', 'round', 'pine'] as const;
type TreeShape = (typeof TREE_SHAPES)[number];
const RAW_TREES: XZ[] = [
  [-6.0, 20.4], [6.0, 20.4], [-19.2, 20.4], [19.2, 20.4],
  [-19.2, 6.0], [21.6, 12.0], [21.6, -3.6], [-19.2, -6.0],
  [12.0, 13.2], [-8.4, 13.2], [3.6, -12.0], [-3.6, 13.2],
  [21.6, 18.0], [-9.6, 20.4], [14.4, -14.4], [-16.8, 12.0],
];
const TREES = RAW_TREES.map((c, i) => ({
  at: (offPathCell(NET, c, { clear: 0.75 }) ?? c) as XZ,
  shape: TREE_SHAPES[i % TREE_SHAPES.length] as TreeShape,
})).filter((tr) => isDry(tr.at));

const RAW_SCENERY: { name: string; at: XZ }[] = [
  { name: 'topiarySpiral', at: [-6.0, 18.0] },
  { name: 'topiarySpiral', at: [6.0, 18.0] },
  { name: 'marbleStatue', at: [-16.8, 18.0] },
  { name: 'wishingWell', at: [12.0, 6.0] },
  { name: 'parkClock', at: [-9.6, 12.0] },
  { name: 'flagpole', at: [4.8, 12.0] },
  { name: 'planterBox', at: [-4.8, 6.0] },
  { name: 'gazebo', at: [-19.2, 3.6] },
];
const SCENERY = RAW_SCENERY.map((s) => ({
  ...s,
  at: (offPathCell(NET, s.at, { clear: 1.2 }) ?? s.at) as XZ,
})).filter((s) => isDry(s.at));

// ── Flat rides — placed at open cells, aimed at a nearby street node ─────────
const aim = (pad: XZ, node: XZ) => Math.atan2(node[0] - pad[0], node[1] - pad[1]);

const FLATS = [
  { pad: [-13.2, 18.0] as XZ, node: [-13.2, 15.6] as XZ }, // FerrisWheel → node 2
  { pad: [12.6, 1.2] as XZ, node: [8.4, -1.2] as XZ }, //     Carousel   → node 5
  { pad: [4.2, 4.2] as XZ, node: [8.4, 9.6] as XZ }, //       Teacups    → node 4
  { pad: [21.0, 9.6] as XZ, node: [16.8, 4.8] as XZ }, //     DropTower  → node 9
  { pad: [-4.8, 3.6] as XZ, node: [0, 9.6] as XZ }, //        SwingRide  → node 3
];

export function ThemePark() {
  return (
    <Park
      seed={SEED}
      climate={CLIMATE}
      size={SIZE}
      background="#a9cfe0"
      onReady={(report: { ok: boolean }) => {
        // eslint-disable-next-line no-console
        console.log('[ThemePark] validatePark ok:', report.ok);
      }}
    >
      <Terrain keepDry={NET.keepDry} coasterPts={COASTER_PTS} />
      <Paths
        nodes={NET.nodes}
        edges={NET.edges}
        plazas={NET.plazas}
        bins={NET.bins}
        walkers={6}
      />
      <GameManager />
      <Gate />

      {/* Set-pieces (after <Paths> so their dressing settles on the paving) */}
      <FountainPlaza plan={HUB} />
      <Bazaar plan={MARKET} />

      {/* The thrill ride */}
      <Coaster
        name="Cinder Racer"
        pieces={COASTER_PIECES}
        start={C_START}
        heading={0}
        type="steel"
        cars={3}
        capacity={4}
        rideDuration={10}
        loadTime={2}
        intensity={6}
        price={5}
        queueTailNode={NET.node(C_TAIL)}
        queueDir={[1, 0]}
        deck={[C_START[0], C_START[2] + 1.2]}
      />

      {/* Flat rides */}
      <FerrisWheel
        position={FLATS[0].pad}
        rotation={aim(FLATS[0].pad, FLATS[0].node)}
        register={{ name: 'Skyline Wheel', capacity: 8, rideDuration: 10, price: 4, intensity: 3 }}
      />
      <Carousel
        position={FLATS[1].pad}
        rotation={aim(FLATS[1].pad, FLATS[1].node)}
        register={{ name: 'Carousel Royale', capacity: 8, rideDuration: 8, price: 3, intensity: 2 }}
      />
      <Teacups
        position={FLATS[2].pad}
        rotation={aim(FLATS[2].pad, FLATS[2].node)}
        register={{ name: 'Spin Cups', capacity: 4, rideDuration: 8, price: 3, intensity: 4 }}
      />
      <DropTower
        position={FLATS[3].pad}
        rotation={aim(FLATS[3].pad, FLATS[3].node)}
        register={{ name: 'Vertigo Drop', capacity: 4, rideDuration: 9, price: 5, intensity: 7 }}
      />
      <SwingRide
        position={FLATS[4].pad}
        rotation={aim(FLATS[4].pad, FLATS[4].node)}
        register={{ name: 'Sky Swings', capacity: 6, rideDuration: 9, price: 3, intensity: 5 }}
      />

      {/* Amenities */}
      <Restroom position={[-16.8, 15.6]} rotation={Math.PI / 2} />
      <Fountain />
      <Neon text="FUN FAIR" position={[0, 2.2, 20.4]} rotation={0} scale={0.6} />

      {/* Dressing */}
      <Torch position={[-6.0, 21.6]} />
      <Torch position={[6.0, 21.6]} />
      <Lights from={[-4.8, 15.6]} to={[4.8, 15.6]} />
      <Lights from={[8.4, 9.6]} to={[8.4, -1.2]} />

      {SCENERY.map((s, i) => (
        <Scenery key={`sc-${i}`} name={s.name} position={s.at} seed={i + 1} />
      ))}
      {TREES.map((tr, i) => (
        <Placed
          key={`tr-${i}`}
          build={(t: typeof THREE) => tree(t, { shape: tr.shape })}
          position={tr.at}
        />
      ))}
    </Park>
  );
}

/*
 * THUNDER HOLLOW — a composed RCT2 park on the 128 plot (seed 1, temperate).
 *
 * ROSTER (5 categories, 9 rides):
 *   transport  Grand Circle Monorail (ring, 4 platforms)
 *   thrill     Ridgeback Racer (§4.0-B steel family flagship)
 *   gentle     Willowmere Gallopers (Carousel) · Cloudchaser Cable (Chairlift)
 *              Orbiton (Enterprise) · Static Saucers (FlyingSaucers)
 *              Mirrorfall (Discotron)
 *   water      Willow Pond Paddlers (PaddleBoats)
 *   dark       Hollow's End (GhostTrain)
 *
 * COACHER KEEP-OUT (§4.0-B @ start [15.6, -2.4], PLOT coords) sits in the free
 * plot CORE x[-14.4..16.8] z[-16.8..15.6]; every street node clears it.
 */
import * as THREE from 'three';
import type { V3, XZ } from './components/Park';
import type { NetRef } from './components/SetPieceKit';
import type { TrackPiece } from './components/SplineRideKit';
import {
  Park, GameManager, Terrain, Paths, Gate, Coaster, Restroom,
  Lights, Placed,
} from './components/Park';
import { parkComposition, laneLenOf } from './components/ParkBuilder';
import { buildParkNet, worldPlan, World, WORLD_THEMES } from './components/SetPieceKit';
import { Bazaar, bazaarPlan } from './components/Bazaar';
import { compileTrackPieces, rateCoaster } from './components/SplineRideKit';
import { tree } from './components/Kit';
import { Monorail } from './components/Monorail';
import { Carousel } from './components/Carousel';
import { FlyingSaucers } from './components/FlyingSaucers';
import { Discotron } from './components/Discotron';
import { Chairlift } from './components/Chairlift';
import { PaddleBoats } from './components/PaddleBoats';
import { GhostTrain } from './components/GhostTrain';
import { Enterprise } from './components/Enterprise';
import { GiantToadstools, StandingStones, LanternTree } from './components/ThornwickScenery';
import { NeonArch, SpeakerStack, MirrorBallPylon } from './components/PulseScenery';
import { Fumarole, ObsidianShards, BasaltColumns } from './components/EmberfallScenery';

/* ─────────────────────────── the flagship coaster ─────────────────────── */
// §4.0-B FAMILY flagship, verbatim. TrackPiece[] with no cast.
const B_PIECES: TrackPiece[] = ['station',
  { type: 'lift', height: 3.6 }, { type: 'straight', length: 2.56 }, { type: 'turnR', angle: 90, radius: 2.5 },
  { type: 'drop', height: 3.6 },
  { type: 'lift', height: 3.2 }, { type: 'straight', length: 5.46 }, { type: 'turnR', angle: 90, radius: 2.5 },
  { type: 'drop', height: 3.2 }, { type: 'hill', height: 0.9 },
  { type: 'lift', height: 3.2 }, { type: 'straight', length: 1.5 }, { type: 'turnR', angle: 90, radius: 2.5 },
  { type: 'drop', height: 3.2 }, { type: 'hill', height: 0.9 },
  { type: 'lift', height: 3.2 }, { type: 'turnR', angle: 90, radius: 2.5 },
  { type: 'drop', height: 3.2 }, { type: 'straight', length: 1.5 }];
const B_START: V3 = [15.6, 0.55, -2.4];
const COASTER_TAIL: XZ = [21.6, -2.4];

const { points: FLAG_PTS, report: FLAG_REPORT } = compileTrackPieces(B_PIECES, {
  profile: 'coaster', type: 'steel', start: B_START, heading: 0,
});
const RATING = rateCoaster(FLAG_PTS, { type: 'steel', bank: 0.7, cars: 3 });
// eslint-disable-next-line no-console
console.log('[thrill] Ridgeback Racer', RATING.excitement, RATING.intensity, RATING.nausea,
  'drop', RATING.highestDrop, 'lat', RATING.maxLatG, 'fatal', FLAG_REPORT.fatal);

/* ─────────────────────────── the monorail ring ────────────────────────── */
const MONO_PIECES: TrackPiece[] = [
  'station',                                     // 0 — WEST
  { type: 'straight', length: 35.3 }, { type: 'turnL', angle: 90, radius: 6 }, { type: 'straight', length: 35.3 },
  'station',                                     // 1 — NORTH
  { type: 'straight', length: 35.3 }, { type: 'turnL', angle: 90, radius: 6 }, { type: 'straight', length: 35.3 },
  'station',                                     // 2 — EAST
  { type: 'straight', length: 35.3 }, { type: 'turnL', angle: 90, radius: 6 }, { type: 'straight', length: 35.3 },
  'station',                                     // 3 — SOUTH
  { type: 'straight', length: 35.3 }, { type: 'turnL', angle: 90, radius: 6 },
  { type: 'straight', length: 33.5 }, { type: 'straight', length: 1.5 },
];
const MONO_STATIONS = [
  { label: 'North', boardPoint: [0, 2.6, 34.2] as V3, queueAnchor: [0, 0.05, 32.41] as V3,
    queueDir: [0, -1] as XZ, exitPoint: [-1.2, 0.05, 33.03] as V3, exitDir: [0, -1] as XZ },
  { label: 'East', boardPoint: [42.6, 2.6, -8.4] as V3, queueAnchor: [40.81, 0.05, -8.4] as V3,
    queueDir: [-1, 0] as XZ, exitPoint: [41.43, 0.05, -7.2] as V3, exitDir: [-1, 0] as XZ },
  { label: 'South', boardPoint: [0, 2.6, -51.0] as V3, queueAnchor: [0, 0.05, -49.21] as V3,
    queueDir: [0, 1] as XZ, exitPoint: [1.2, 0.05, -49.83] as V3, exitDir: [0, 1] as XZ },
];
const { points: MONO_PTS } = compileTrackPieces(MONO_PIECES, {
  profile: 'monorail', type: 'steel', start: [-42.6, 2.6, -9.7], heading: 0,
});

/* ─────────────────────────── the street skeleton ──────────────────────── */
// The verified TREE (park-generation-worlds §3.1-B): off-centre gate, north
// promenade OUTSIDE the ring, one descent, an east arterial and a long west row.
const NODES: XZ[] = [
  [-14.4, 63.6],   //  0 GATE
  [-14.4, 57.6],   //  1 Carousel tail
  [-14.4, 45.6],   //  2 north spine
  [-43.2, 45.6],   //  3 NW court (glade)
  [-43.2, 50.4],   //  4 FlyingSaucers tail
  [24.0, 45.6],    //  5 descent head / NE junction
  [57.6, 45.6],    //  6 NE court (pulse)
  [57.6, 33.6],    //  7 Discotron tail
  [24.0, 36.0],    //  8 descent
  [24.0, 27.6],    //  9 Chairlift tail
  [0, 27.6],       // 10 RING N tail
  [24.0, 12.0],    // 11 arterial
  [24.0, -2.4],    // 12 arterial junction
  [21.6, -2.4],    // 13 COASTER tail
  [24.0, -8.4],    // 14 east junction
  [36.0, -8.4],    // 15 RING E tail
  [24.0, -19.2],   // 16 foot of arterial
  [12.0, -19.2],   // 17 PaddleBoats tail
  [0, -19.2],      // 18 west row junction
  [0, -44.4],      // 19 RING S tail
  [-24.0, -19.2],  // 20 GhostTrain tail
  [-36.0, -19.2],  // 21 west junction
  [-36.0, -8.4],   // 22 RING W tail
  [-48.0, -19.2],  // 23 far-west junction
  [-48.0, -30.0],  // 24 Enterprise tail
  [-48.0, -38.4],  // 25 SW court (ember)
];
const ni = (x: number, z: number): number => {
  const i = NODES.findIndex((n) => n[0] === x && n[1] === z);
  if (i < 0) throw new Error(`no node at [${x}, ${z}]`);
  return i;
};

/* ─────────────────────────── the districts (worlds) ───────────────────── */
const GLADE_ROW = bazaarPlan({
  id: 'gladeRow', position: [-52.8, 45.6], theme: WORLD_THEMES.thornwick,
  stalls: ['cottonCandy', 'soda', 'balloon'], facing: { port: 'E', toward: [-43.2, 45.6] }, seed: 3,
});
const PULSE_ROW = bazaarPlan({
  id: 'pulseRow', position: [57.6, 54.0], theme: WORLD_THEMES.pulse,
  stalls: ['soda', 'burger', 'cottonCandy'], facing: { port: 'W', toward: [57.6, 45.6] }, seed: 7,
});
const EMBER_ROW = bazaarPlan({
  id: 'emberRow', position: [-48.0, -48.0], theme: WORLD_THEMES.emberfall,
  stalls: ['burger', 'hotDog', 'soda'], facing: { port: 'E', toward: [-48.0, -38.4] }, seed: 5,
});

// themed scenery cells (3 per world, inside the rect, dry, off the streets)
const GLADE_SC: XZ[] = [[-52.8, 50.4], [-57.6, 44.4], [-52.8, 40.8]];
const PULSE_SC: XZ[] = [[54.0, 50.4], [61.2, 50.4], [54.0, 42.0]];
const EMBER_SC: XZ[] = [[-52.8, -43.2], [-43.2, -45.6], [-52.8, -33.6]];

// ride PADS derived tail-first: pad = tail + out·(minReach(cap) + 2.4)
const minReachOf = (c: number) => laneLenOf(c) + 1.92;
const place = (tail: XZ, out: XZ, cap: number) => {
  const reach = minReachOf(cap) + 2.4;
  const join = laneLenOf(cap) + 0.35;
  return {
    pad: [tail[0] + out[0] * reach, tail[1] + out[1] * reach] as XZ,
    anchor: [tail[0] + out[0] * join, tail[1] + out[1] * join] as XZ,
    dir: [-out[0], -out[1]] as XZ,
  };
};
const CAROUSEL = place([-14.4, 57.6], [1, 0], 8);
const SAUCERS = place([-43.2, 50.4], [0, 1], 6);
const DISCO = place([57.6, 33.6], [0, -1], 12);
const CHAIR = place([24.0, 27.6], [1, 0], 6);
const PADDLE = place([12.0, -19.2], [0, -1], 4);
const GHOST = place([-24.0, -19.2], [0, -1], 6);
const ORBIT = place([-48.0, -30.0], [-1, 0], 10);

const GLADE = worldPlan({
  id: 'glade', theme: WORLD_THEMES.thornwick, pieces: [GLADE_ROW],
  rides: [{ at: SAUCERS.pad, name: 'Static Saucers' }],
  include: [SAUCERS.pad, ...GLADE_SC, [-38.4, 33.6]],
});
const PULSE = worldPlan({
  id: 'pulse', theme: WORLD_THEMES.pulse, pieces: [PULSE_ROW],
  rides: [{ at: DISCO.pad, name: 'Mirrorfall' }],
  include: [DISCO.pad, ...PULSE_SC, [44.4, 33.6]],
});
const EMBER = worldPlan({
  id: 'ember', theme: WORLD_THEMES.emberfall, pieces: [EMBER_ROW],
  rides: [{ at: ORBIT.pad, name: 'Orbiton' }],
  include: [ORBIT.pad, ...EMBER_SC, [-43.2, -28.8]],
});
const WORLDS = [GLADE, PULSE, EMBER];

// restroom — off-street, dry, on the promenade
const REST: XZ = [-20.4, 52.8];

/* ─────────────────────────── the street EDGES ─────────────────────────── */
const EDGES: [NetRef, NetRef][] = [
  // gate spur + north promenade
  [ni(-14.4, 63.6), ni(-14.4, 57.6)],
  [ni(-14.4, 57.6), ni(-14.4, 45.6)],
  [ni(-14.4, 45.6), ni(-43.2, 45.6)],
  [ni(-43.2, 45.6), 'gladeRow:E'],
  [ni(-43.2, 45.6), ni(-43.2, 50.4)],
  [ni(-14.4, 45.6), ni(24.0, 45.6)],
  [ni(24.0, 45.6), ni(57.6, 45.6)],
  [ni(57.6, 45.6), 'pulseRow:W'],
  [ni(57.6, 45.6), ni(57.6, 33.6)],
  // east arterial (x 24 column) + branches
  [ni(24.0, 45.6), ni(24.0, 36.0)],
  [ni(24.0, 36.0), ni(24.0, 27.6)],
  [ni(24.0, 27.6), ni(0, 27.6)],
  [ni(24.0, 27.6), ni(24.0, 12.0)],
  [ni(24.0, 12.0), ni(24.0, -2.4)],
  [ni(24.0, -2.4), ni(21.6, -2.4)],
  [ni(24.0, -2.4), ni(24.0, -8.4)],
  [ni(24.0, -8.4), ni(36.0, -8.4)],
  [ni(24.0, -8.4), ni(24.0, -19.2)],
  // long west row (z -19.2) + ring tails
  [ni(24.0, -19.2), ni(12.0, -19.2)],
  [ni(12.0, -19.2), ni(0, -19.2)],
  [ni(0, -19.2), ni(0, -44.4)],
  [ni(0, -19.2), ni(-24.0, -19.2)],
  [ni(-24.0, -19.2), ni(-36.0, -19.2)],
  [ni(-36.0, -19.2), ni(-36.0, -8.4)],
  [ni(-36.0, -19.2), ni(-48.0, -19.2)],
  [ni(-48.0, -19.2), ni(-48.0, -30.0)],
  [ni(-48.0, -30.0), ni(-48.0, -38.4)],
  [ni(-48.0, -38.4), 'emberRow:W'],
];

/* ─────────────────────────── keepDry + verification ───────────────────── */
const KEEP_DRY: XZ[] = [
  ...NODES,
  CAROUSEL.pad, SAUCERS.pad, DISCO.pad, CHAIR.pad, PADDLE.pad, GHOST.pad, ORBIT.pad,
  CAROUSEL.anchor, SAUCERS.anchor, DISCO.anchor, CHAIR.anchor, PADDLE.anchor, GHOST.anchor, ORBIT.anchor,
  REST,
  GLADE_ROW.position, PULSE_ROW.position, EMBER_ROW.position,
];

// NON-throwing sanity checks — a slip becomes a console warning, never a black page.
const warn = (m: string) => console.warn(`[ThunderHollow] ${m}`);
EDGES.forEach(([a, b]) => {
  if (typeof a !== 'number' || typeof b !== 'number') return;
  const A = NODES[a], B = NODES[b];
  if (Math.abs(A[0] - B[0]) > 1e-6 && Math.abs(A[1] - B[1]) > 1e-6) warn(`diagonal edge ${a}->${b}`);
});
try {
  const BARE = parkComposition(THREE, 1, 128, 'temperate');
  const COMP = parkComposition(THREE, 1, 128, 'temperate', { keepDry: KEEP_DRY, coasterPts: FLAG_PTS });
  const moved = (p?: XZ | null, q?: XZ | null) =>
    p && q ? Math.hypot(p[0] - q[0], p[1] - q[1]) : p === q ? 0 : Infinity;
  const dDom = moved(BARE.waterCentre as XZ, COMP.waterCentre as XZ);
  const dSec = moved(BARE.waterCentreSecond as XZ, COMP.waterCentreSecond as XZ);
  if (dDom > 6) warn(`dominant water moved ${dDom.toFixed(1)} u`);
  if (dSec > 6) warn(`secondary water moved ${dSec.toFixed(1)} u`);
} catch (e) {
  warn(`water re-compose skipped: ${(e as Error).message}`);
}

const NET = buildParkNet({
  nodes: NODES, edges: EDGES, pieces: [GLADE_ROW, PULSE_ROW, EMBER_ROW],
  worlds: WORLDS, keepDry: KEEP_DRY, bins: [[1.5, 12.0]],
});

const STALL_COUNT = 3 + 3 + 3;
const RIDE_NAMES = [
  'Grand Circle Monorail', 'Ridgeback Racer', 'Willowmere Gallopers', 'Static Saucers',
  'Mirrorfall', 'Cloudchaser Cable', 'Willow Pond Paddlers', "Hollow's End", 'Orbiton',
];

// mixed-shape tree scatter (over-provisioned) + world scenery arrays
const TREE_CELLS: { at: XZ; shape: string }[] = [
  { at: [-8.4, 60.0], shape: 'round' }, { at: [-20.4, 45.6 + 3.6], shape: 'pine' },
  { at: [4.8, 45.6], shape: 'willow' }, { at: [14.4, 45.6], shape: 'round' },
  { at: [33.6, 45.6], shape: 'pine' }, { at: [48.0, 45.6], shape: 'round' },
  { at: [30.0, 36.0], shape: 'pine' }, { at: [30.0, 24.0], shape: 'round' },
  { at: [18.0, 12.0], shape: 'willow' }, { at: [30.0, 12.0], shape: 'pine' },
  { at: [18.0, -8.4], shape: 'round' }, { at: [30.0, -14.4], shape: 'pine' },
  { at: [18.0, -19.2], shape: 'willow' }, { at: [6.0, -14.4], shape: 'round' },
  { at: [-6.0, -14.4], shape: 'pine' }, { at: [-6.0, -24.0], shape: 'round' },
  { at: [-18.0, -14.4], shape: 'willow' }, { at: [-30.0, -14.4], shape: 'pine' },
  { at: [-42.0, -14.4], shape: 'round' }, { at: [-42.0, -24.0], shape: 'pine' },
  { at: [-54.0, -19.2], shape: 'willow' }, { at: [-54.0, -30.0], shape: 'round' },
  { at: [-40.8, -38.4], shape: 'pine' }, { at: [-32.4, 40.8], shape: 'willow' },
  { at: [-48.0, 40.8], shape: 'round' }, { at: [-48.0, 52.8], shape: 'pine' },
  { at: [50.4, 40.8], shape: 'round' }, { at: [63.6, 40.8], shape: 'pine' },
  { at: [50.4, 28.8], shape: 'willow' }, { at: [-27.6, 52.8], shape: 'round' },
  { at: [-13.2, -30.0], shape: 'pine' }, { at: [13.2, -30.0], shape: 'round' },
  { at: [36.0, 0.0], shape: 'willow' }, { at: [-31.2, 0.0], shape: 'round' },
  { at: [8.4, 33.6], shape: 'pine' }, { at: [-9.6, 33.6], shape: 'round' },
];

/* ─────────────────────────── the composition ──────────────────────────── */
export function ThemePark() {
  return (
    <Park
      seed={1}
      climate="temperate"
      roster={{ rides: RIDE_NAMES, stalls: STALL_COUNT, categories: 5 }}
      onReady={(report) => {
        // eslint-disable-next-line no-console
        console.log('[ThunderHollow] validatePark', report.ok, report.failures, report.warnings);
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
      <Gate position={[-14.4, 63.6]} />

      {/* THRILL — steel family flagship in the plot core */}
      <Coaster
        name="Ridgeback Racer" pieces={B_PIECES} start={B_START} heading={0} type="steel"
        capacity={4} rideDuration={10} loadTime={2} intensity={6} price={6}
        queueTailNode={NET.node(COASTER_TAIL)} queueDir={[1, 0]}
      />

      {/* TRANSPORT — the park-spanning monorail ring, four platforms */}
      <Monorail
        position={[-42.6, 0, -9.7]} rotation={0} pieces={MONO_PIECES} beamY={2.6}
        loopSeconds={12} pinned name="Grand Circle Monorail" capacity={6} rideDuration={12}
        intensity={1} price={0}
        queue={{ anchor: [-40.81, -8.4], dir: [1, 0] }}
        register={{ board: [-42.6, 2.6, -8.4], stations: MONO_STATIONS }}
      />

      {/* GENTLE + WATER + DARK — catalog rides, tail-first placement */}
      <Carousel position={CAROUSEL.pad} rotation={-Math.PI / 2}
        register={{ name: 'Willowmere Gallopers', capacity: 8, rideDuration: 11, intensity: 2, price: 3 }}
        queue={{ anchor: CAROUSEL.anchor, dir: CAROUSEL.dir }} />
      <FlyingSaucers position={SAUCERS.pad} rotation={Math.PI}
        register={{ name: 'Static Saucers', capacity: 6, rideDuration: 12, intensity: 4, price: 4 }}
        queue={{ anchor: SAUCERS.anchor, dir: SAUCERS.dir }} />
      <Discotron position={DISCO.pad} rotation={0}
        register={{ name: 'Mirrorfall', capacity: 12, rideDuration: 12, intensity: 6, price: 4 }}
        queue={{ anchor: DISCO.anchor, dir: DISCO.dir }} />
      <Chairlift position={CHAIR.pad} rotation={-Math.PI / 2}
        register={{ name: 'Cloudchaser Cable', capacity: 6, rideDuration: 12, intensity: 2, price: 3 }}
        queue={{ anchor: CHAIR.anchor, dir: CHAIR.dir }} />
      <PaddleBoats position={PADDLE.pad} rotation={0}
        register={{ name: 'Willow Pond Paddlers', capacity: 4, rideDuration: 11, intensity: 2, price: 3 }}
        queue={{ anchor: PADDLE.anchor, dir: PADDLE.dir }} />
      <GhostTrain position={GHOST.pad} rotation={0}
        register={{ name: "Hollow's End", capacity: 6, rideDuration: 12, intensity: 5, price: 5 }}
        queue={{ anchor: GHOST.anchor, dir: GHOST.dir }} />
      <Enterprise position={ORBIT.pad} rotation={Math.PI / 2}
        register={{ name: 'Orbiton', capacity: 10, rideDuration: 12, intensity: 7, price: 6 }}
        queue={{ anchor: ORBIT.anchor, dir: ORBIT.dir }} />

      <Restroom position={REST} rotation={Math.PI / 2} />

      {/* the three districts */}
      <World plan={GLADE} /> <Bazaar plan={GLADE_ROW} />
      <GiantToadstools position={GLADE_SC[0]} /> <StandingStones position={GLADE_SC[1]} />
      <LanternTree position={GLADE_SC[2]} />

      <World plan={PULSE} /> <Bazaar plan={PULSE_ROW} />
      <NeonArch position={PULSE_SC[0]} /> <SpeakerStack position={PULSE_SC[1]} />
      <MirrorBallPylon position={PULSE_SC[2]} />

      <World plan={EMBER} /> <Bazaar plan={EMBER_ROW} />
      <Fumarole position={EMBER_SC[0]} /> <ObsidianShards position={EMBER_SC[1]} />
      <BasaltColumns position={EMBER_SC[2]} />

      {/* district string-light runs along the streets */}
      <Lights from={[-14.4, 45.6]} to={[24.0, 45.6]} />
      <Lights from={[24.0, 12.0]} to={[24.0, -8.4]} />
      <Lights from={[0, -19.2]} to={[-24.0, -19.2]} />

      {/* tree scatter (mixed shapes) */}
      {TREE_CELLS.map((t, i) => (
        <Placed key={`tr-${i}`} position={t.at} build={(three) => tree(three, { shape: t.shape })} />
      ))}
    </Park>
  );
}

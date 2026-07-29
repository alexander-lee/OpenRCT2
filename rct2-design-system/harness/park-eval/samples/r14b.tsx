// Aurora Springs — a full simulated RCT2-style theme park.
//
// Built on the verified hub-and-spokes skeleton (seed 1 / temperate, 128 plot):
// a park-spanning multi-station monorail ring, a steel flagship coaster (§4.0-A),
// three themed worlds (Thornwick Glade / Brasswork Foundry / Pulse District) each
// with a bazaar, its own ride and themed scenery, a hub fountain plaza, a satellite
// viewpoint plaza, plus stalls, a restroom, lamp runs, and mixed trees/scenery.
//
// ROSTER (8 rides, 5 categories):
//   transport = Grand Circle Monorail    thrill   = Thunderhead (coaster) + Nebula Spinner
//   water     = Cedar Rapids Flume        dark     = Hollow's End (ghost train)
//   gentle    = Gilded Gallopers, Skyward Wheel, Whirligig Teacups
// stalls = 3 bazaars x 3 = 9   categories = 5

import * as THREE from 'three';
import type { V3, XZ } from './components/Park';
import type { NetRef, SetPiecePlan } from './components/SetPieceKit';
import type { TrackPiece } from './components/SplineRideKit';
import {
  Park, GameManager, Terrain, Paths, Gate, Coaster, Restroom, Scenery, Lights,
  Torch, Placed, offPathCell,
} from './components/Park';
import { parkComposition, laneLenOf } from './components/ParkBuilder';
import { buildParkNet, worldPlan, World, WORLD_THEMES } from './components/SetPieceKit';
import { FountainPlaza, fountainPlazaPlan } from './components/FountainPlaza';
import { Bazaar, bazaarPlan } from './components/Bazaar';
import { compileTrackPieces, rateCoaster } from './components/SplineRideKit';
import { tree } from './components/Kit';
import { Monorail } from './components/Monorail';
import { FerrisWheel } from './components/FerrisWheel';
import { Carousel } from './components/Carousel';
import { Teacups } from './components/Teacups';
import { Enterprise } from './components/Enterprise';
import { LogFlume } from './components/LogFlume';
import { GhostTrain } from './components/GhostTrain';
import { GiantToadstools, StandingStones, LanternTree } from './components/ThornwickScenery';
import { GiantGear, BoilerTank, CoalCart } from './components/BrassworkScenery';
import { NeonArch, SpeakerStack, MirrorBallPylon } from './components/PulseScenery';
import React from 'react';

// ─────────────────────────────────────────────────────────────────────────────
// Flagship coaster — §4.0-A verbatim (THRILL, E ≈ 6.1). Do not re-tune.
// ─────────────────────────────────────────────────────────────────────────────
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
const A_TAIL: XZ = [A_START[0] + 6.0, A_START[2]]; // [22.8, -3.6] — authored node 5

const compiled = compileTrackPieces(A_PIECES, { profile: 'coaster', type: 'steel', start: A_START, heading: 0 });
const FLAG_PTS: V3[] = compiled.points;
try {
  const r = rateCoaster(FLAG_PTS, { type: 'steel', bank: 0.7, cars: 5 });
  // eslint-disable-next-line no-console
  console.log('[thrill] Thunderhead E', r.excitement, 'I', r.intensity, 'N', r.nausea,
    'drop', r.highestDrop, 'lat', r.maxLatG);
} catch { /* rating is advisory */ }

// ─────────────────────────────────────────────────────────────────────────────
// Monorail ring — the park-spanning transport circuit (§4.2-A verbatim).
// ─────────────────────────────────────────────────────────────────────────────
const MONO_PIECES: TrackPiece[] = [
  'station',
  { type: 'straight', length: 35.3 }, { type: 'turnL', angle: 90, radius: 6 }, { type: 'straight', length: 35.3 },
  'station',
  { type: 'straight', length: 35.3 }, { type: 'turnL', angle: 90, radius: 6 }, { type: 'straight', length: 35.3 },
  'station',
  { type: 'straight', length: 35.3 }, { type: 'turnL', angle: 90, radius: 6 }, { type: 'straight', length: 35.3 },
  'station',
  { type: 'straight', length: 35.3 }, { type: 'turnL', angle: 90, radius: 6 }, { type: 'straight', length: 33.5 },
  { type: 'straight', length: 1.5 },
];
const MONO_STATIONS = [
  { label: 'North', boardPoint: [0, 2.6, 34.2] as V3, queueAnchor: [0, 0.05, 32.41] as V3,
    queueDir: [0, -1] as XZ, exitPoint: [-1.2, 0.05, 33.03] as V3, exitDir: [0, -1] as XZ },
  { label: 'East', boardPoint: [42.6, 2.6, -8.4] as V3, queueAnchor: [40.81, 0.05, -8.4] as V3,
    queueDir: [-1, 0] as XZ, exitPoint: [41.43, 0.05, -7.2] as V3, exitDir: [-1, 0] as XZ },
  { label: 'South', boardPoint: [0, 2.6, -51.0] as V3, queueAnchor: [0, 0.05, -49.21] as V3,
    queueDir: [0, 1] as XZ, exitPoint: [1.2, 0.05, -49.83] as V3, exitDir: [0, 1] as XZ },
];

// ─────────────────────────────────────────────────────────────────────────────
// STREET NODES — verified skeleton A (node 16 nudged off seed-1 secondary basin).
// ─────────────────────────────────────────────────────────────────────────────
const NODES: XZ[] = [
  [0, 63.6],      // 0  GATE
  [0, 58.8],      // 1  gate-street junction
  [9.6, 58.8],    // 2  near-gate ride tail (Carousel) — 14.4 u from gate
  [22.8, 45.6],   // 3  east apron (GhostTrain wire / bazaar)  → hub:E
  [22.8, 21.6],   // 4  east spine (LogFlume tail)
  [22.8, -3.6],   // 5  FLAGSHIP queue tail (junction)
  [22.8, -8.4],   // 6  east junction
  [36, -8.4],     // 7  monorail EAST platform tail (leaf)
  [22.8, -27.6],  // 8  Teacups tail / pulse bazaar wire
  [9.6, 21.6],    // 9  ring entry column
  [9.6, -27.6],   // 10 interior spine south
  [0, -27.6],     // 11 south leg junction
  [0, -44.4],     // 12 monorail SOUTH platform tail (leaf)
  [-31.2, -27.6], // 13 south-west corner (Enterprise tail)
  [-31.2, -8.4],  // 14 west junction
  [-36, -8.4],    // 15 monorail WEST platform tail (leaf)
  [-31.2, 16.8],  // 16 west leg (FerrisWheel tail) — off the secondary basin
  [-31.2, 45.6],  // 17 north-west corner → hub:W
  [9.6, 27.6],    // 18 elbow to north platform
  [0, 27.6],      // 19 monorail NORTH platform tail (through-node)
  [50.4, -8.4],   // 20 satellite viewpoint (wires straight to viewpoint:W)
  [-31.2, 30],    // 21 glade bazaar wire (on the 16→17 leg)
];

// ─────────────────────────────────────────────────────────────────────────────
// SET-PIECES — hub plaza, viewpoint plaza, three themed bazaars.
// ─────────────────────────────────────────────────────────────────────────────
const HUB = fountainPlazaPlan({ id: 'hub', position: [0, 45.6], tiles: 7, ports: ['N', 'E', 'W'] });
const VIEWPOINT = fountainPlazaPlan({ id: 'viewpoint', position: [57.6, -8.4], tiles: 9, ports: ['W'] });

const GLADE_ROW = bazaarPlan({
  id: 'gladeRow', position: [-40.8, 30], theme: WORLD_THEMES.thornwick,
  stalls: ['soda', 'cottonCandy', 'hotDog'], seed: 3,
});
const WORKS_ROW = bazaarPlan({
  id: 'worksRow', position: [27.6, 45.6], theme: WORLD_THEMES.brasswork,
  stalls: ['burger', 'soda', 'cottonCandy'], seed: 5,
});
const PULSE_ROW = bazaarPlan({
  id: 'pulseRow', position: [27.6, -27.6], theme: WORLD_THEMES.pulse,
  stalls: ['hotDog', 'soda', 'cottonCandy'], seed: 7,
});

// ─────────────────────────────────────────────────────────────────────────────
// WORLDS — each carries its bazaar + a ride pad + 3 themed scenery cells.
// ─────────────────────────────────────────────────────────────────────────────
const GLADE_SC: XZ[] = [[-45.6, 24], [-36, 36], [-45.6, 36]];
const WORKS_SC: XZ[] = [[15.6, 40.8], [33.6, 40.8], [15.6, 33.6]];
const PULSE_SC: XZ[] = [[33.6, -33.6], [33.6, -21.6], [16.8, -33.6]];

const GLADE = worldPlan({
  id: 'glade', theme: WORLD_THEMES.thornwick, pieces: [GLADE_ROW],
  rides: [{ at: [-41.1, 16.8] as XZ, name: 'Skyward Wheel' }],
  include: [[-43.2, -8.4] as XZ, ...GLADE_SC],
});
const FOUNDRY = worldPlan({
  id: 'foundry', theme: WORLD_THEMES.brasswork, pieces: [WORKS_ROW],
  rides: [{ at: [18.4, 27.6] as XZ, name: "Hollow's End" }],
  include: [[0, 34.2] as XZ, ...WORKS_SC],
});
const PULSE = worldPlan({
  id: 'pulse', theme: WORLD_THEMES.pulse, pieces: [PULSE_ROW],
  rides: [{ at: [22.8, -35.3] as XZ, name: 'Whirligig Teacups' }],
  include: [[44.4, -8.4] as XZ, ...PULSE_SC],
});
const WORLDS = [GLADE, FOUNDRY, PULSE];

// ─────────────────────────────────────────────────────────────────────────────
// EDGES — every pair cardinal; set-pieces port-referenced.
// ─────────────────────────────────────────────────────────────────────────────
const EDGES: [NetRef, NetRef][] = [
  [0, 1], [1, 'hub:N'], [1, 2],
  ['hub:E', 3], [3, 4], [4, 5], [5, 6], [6, 7], [6, 8],
  [4, 9], [9, 10], [9, 18], [18, 19],
  [8, 10], [10, 11], [11, 12], [11, 13],
  [13, 14], [14, 15], [14, 16], [16, 17], [17, 'hub:W'],
  [7, 20], [20, 'viewpoint:W'],
  [21, 'gladeRow:E'], [3, 'worksRow:W'], [8, 'pulseRow:W'],
];

// ── cardinal check (verified by hand; warn rather than throw to protect render) ─
const ALL_PLANS: SetPiecePlan[] = [HUB, VIEWPOINT, GLADE_ROW, WORKS_ROW, PULSE_ROW];
const portCell = (ref: NetRef): XZ => {
  if (typeof ref === 'number') return NODES[ref];
  const [id, name] = ref.split(':');
  const p = ALL_PLANS.find((q) => q.id === id);
  return p ? (p.port(name) as XZ) : [0, 0];
};
const EPS = 1e-6;
EDGES.forEach(([a, b]) => {
  const A = portCell(a), B = portCell(b);
  if (Math.abs(A[0] - B[0]) > EPS && Math.abs(A[1] - B[1]) > EPS)
    console.warn(`[park] diagonal edge ${a}->${b}`, A, B);
});

// ── THE SINGLE FUSE ────────────────────────────────────────────────────────────
const KEEP_DRY: XZ[] = NODES.slice();
const NET = buildParkNet({
  nodes: NODES, edges: EDGES, pieces: [HUB, VIEWPOINT], worlds: WORLDS,
  keepDry: KEEP_DRY, bins: [[9.6, 21.6], [9.6, -27.6]],
});
if (NET.warnings && NET.warnings.length) console.warn('[park] NET.warnings', NET.warnings);

// water re-compose diff — advisory (never throws at module scope)
let COMP: ReturnType<typeof parkComposition> | null = null;
try {
  COMP = parkComposition(THREE, 1, 128, 'temperate', { keepDry: NET.keepDry, coasterPts: FLAG_PTS });
} catch { COMP = null; }
const BASINS = COMP ? [...(COMP.basins ?? []), ...((COMP as { basinsSecond?: { x: number; z: number; radius: number }[] }).basinsSecond ?? [])] : [];
const isDry = (c: XZ, margin = 1.2) =>
  BASINS.every((b) => Math.hypot(c[0] - b.x, c[1] - b.z) > 0.74 * b.radius + margin);

// ─────────────────────────────────────────────────────────────────────────────
// RIDE PLACEMENT — tail-first: pad DERIVED off an authored tail via offPathCell.
// ─────────────────────────────────────────────────────────────────────────────
const minReachOf = (c: number) => laneLenOf(c) + 1.92;
function place(tail: XZ, out: XZ, cap: number) {
  const anchor: XZ = [tail[0] + out[0] * (laneLenOf(cap) + 0.35), tail[1] + out[1] * (laneLenOf(cap) + 0.35)];
  const reach = minReachOf(cap) + 2.4;
  const cand: XZ = [tail[0] + out[0] * reach, tail[1] + out[1] * reach];
  const pad = (offPathCell(NET, cand, { clear: 3.2 }) ?? cand) as XZ;
  const dir: XZ = [-out[0], -out[1]];
  const rotation = Math.atan2(-out[0], -out[1]);
  return { pad, anchor, dir, rotation };
}

const CAROUSEL = place([9.6, 58.8], [1, 0], 8);
const GHOST = place([9.6, 27.6], [1, 0], 6);
const FERRIS = place([-31.2, 16.8], [-1, 0], 8);
const TEACUPS = place([22.8, -27.6], [0, -1], 4);
const ENTERPRISE = place([-31.2, -27.6], [0, -1], 10);
const FLUME = place([22.8, 21.6], [1, 0], 6);

// ─────────────────────────────────────────────────────────────────────────────
// TREES + SCENERY — over-provisioned, sieved for street clearance + dryness.
// ─────────────────────────────────────────────────────────────────────────────
const TREE_SHAPES = ['round', 'pine', 'willow', 'round', 'pine'] as const;
const RAW_TREES: XZ[] = [
  [6, 51.6], [-6, 51.6], [14.4, 51.6], [-14.4, 51.6], [30, 51.6], [-24, 51.6],
  [15.6, 33.6], [-15.6, 33.6], [30, 27.6], [-42, 40.8], [42, 40.8], [-48, 24],
  [15.6, 9.6], [-15.6, 9.6], [30, 9.6], [-42, 6], [42, 6], [-48, -4.8],
  [15.6, -14.4], [-15.6, -14.4], [30, -16.8], [-42, -14.4], [45.6, -16.8], [-48, -20.4],
  [15.6, -34.8], [-15.6, -34.8], [33.6, -40.8], [-42, -38.4], [9.6, -38.4], [-18, -40.8],
  [48, -27.6], [-48, 36], [51.6, 4.8], [-51.6, 4.8], [6, 34.8], [-6, 34.8],
  [39.6, 30], [-39.6, 30], [45.6, 21.6], [-45.6, -33.6], [39.6, -33.6], [3.6, -16.8],
  [-3.6, -16.8], [51.6, -21.6], [-51.6, 16.8], [33.6, 9.6], [-33.6, 9.6], [16.8, 45.6],
];
const TREES: { at: XZ; shape: string }[] = RAW_TREES
  .map((c) => (offPathCell(NET, c, { clear: 1.2 }) ?? c) as XZ)
  .filter((c) => isDry(c))
  .map((at, i) => ({ at, shape: TREE_SHAPES[i % TREE_SHAPES.length] }));

const RAW_SCENERY: { name: string; at: XZ }[] = [
  { name: 'marbleStatue', at: [8.4, 39.6] }, { name: 'topiarySpiral', at: [-8.4, 39.6] },
  { name: 'flagpole', at: [4.8, 54] }, { name: 'flagpole', at: [-4.8, 54] },
  { name: 'birdbath', at: [18, 33.6] }, { name: 'planterBox', at: [-18, 33.6] },
  { name: 'gazebo', at: [-51.6, -8.4] }, { name: 'wishingWell', at: [48, 33.6] },
  { name: 'picnicTable', at: [13.2, -21.6] }, { name: 'picnicTable', at: [-13.2, -21.6] },
  { name: 'topiaryElephant', at: [33.6, 33.6] }, { name: 'signpost', at: [12, 51.6] },
  { name: 'planterBox', at: [-12, 51.6] }, { name: 'birdbath', at: [39.6, 9.6] },
  { name: 'marbleStatue', at: [-39.6, -21.6] }, { name: 'topiarySpiral', at: [16.8, 9.6] },
  { name: 'planterBox', at: [-16.8, 9.6] }, { name: 'signpost', at: [3.6, -33.6] },
  { name: 'topiaryElephant', at: [-3.6, -33.6] }, { name: 'gazebo', at: [45.6, -33.6] },
];
const SCENERY = RAW_SCENERY
  .map((s) => ({ name: s.name, at: (offPathCell(NET, s.at, { clear: 1.2 }) ?? s.at) as XZ }))
  .filter((s) => isDry(s.at));

// dry-only viewpoint restroom + torch cells
const REST = (offPathCell(NET, [-6, 51.6], { clear: 1.8 }) ?? [-6, 51.6]) as XZ;

const RIDE_NAMES = [
  'Thunderhead', 'Grand Circle Monorail', 'Cedar Rapids Flume', "Hollow's End",
  'Gilded Gallopers', 'Skyward Wheel', 'Whirligig Teacups', 'Nebula Spinner',
];

export function ThemeParkScene() {
  return (
    <Park
      seed={1}
      climate="temperate"
      roster={{ rides: RIDE_NAMES, stalls: 9, categories: 5 }}
      onReady={(report: { ok: boolean }) => {
        // eslint-disable-next-line no-console
        console.log('[park] validatePark ->', report.ok ? 'ok: true' : 'FAIL', report);
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

      {/* THRILL flagship */}
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

      {/* TRANSPORT — the park-spanning monorail ring */}
      <Monorail
        position={[-42.6, 0, -9.7]}
        rotation={0}
        pieces={MONO_PIECES}
        beamY={2.6}
        loopSeconds={12}
        pinned
        name="Grand Circle Monorail"
        capacity={6}
        rideDuration={12}
        intensity={1}
        price={0}
        queue={{ anchor: [-40.81, -8.4], dir: [1, 0] }}
        register={{ board: [-42.6, 2.6, -8.4], stations: MONO_STATIONS }}
      />

      {/* GENTLE — near-gate carousel (carries the acceptance smoke cycle) */}
      <Carousel
        position={CAROUSEL.pad}
        rotation={CAROUSEL.rotation}
        queue={{ anchor: CAROUSEL.anchor, dir: CAROUSEL.dir }}
        register={{ name: 'Gilded Gallopers', capacity: 8, rideDuration: 8, price: 3, intensity: 2 }}
      />

      {/* GENTLE — ferris wheel (Thornwick Glade) */}
      <FerrisWheel
        position={FERRIS.pad}
        rotation={FERRIS.rotation}
        queue={{ anchor: FERRIS.anchor, dir: FERRIS.dir }}
        register={{ name: 'Skyward Wheel', capacity: 8, rideDuration: 10, price: 4, intensity: 2 }}
      />

      {/* GENTLE — teacups (Pulse District) */}
      <Teacups
        position={TEACUPS.pad}
        rotation={TEACUPS.rotation}
        queue={{ anchor: TEACUPS.anchor, dir: TEACUPS.dir }}
        register={{ name: 'Whirligig Teacups', capacity: 4, rideDuration: 8, price: 3, intensity: 3 }}
      />

      {/* THRILL — enterprise spinner */}
      <Enterprise
        position={ENTERPRISE.pad}
        rotation={ENTERPRISE.rotation}
        queue={{ anchor: ENTERPRISE.anchor, dir: ENTERPRISE.dir }}
        register={{ name: 'Nebula Spinner', capacity: 10, rideDuration: 10, price: 5, intensity: 7 }}
      />

      {/* WATER — log flume (stock layout, no pieces) */}
      <LogFlume
        position={FLUME.pad}
        rotation={FLUME.rotation}
        queue={{ anchor: FLUME.anchor, dir: FLUME.dir }}
        register={{ name: 'Cedar Rapids Flume', capacity: 6, rideDuration: 11, price: 5, intensity: 4 }}
      />

      {/* DARK — ghost train (Brasswork Foundry) */}
      <GhostTrain
        position={GHOST.pad}
        rotation={GHOST.rotation}
        queue={{ anchor: GHOST.anchor, dir: GHOST.dir }}
        register={{ name: "Hollow's End", capacity: 6, rideDuration: 9, price: 5, intensity: 4 }}
      />

      {/* Plazas + bazaars (after Paths) */}
      <FountainPlaza plan={HUB} />
      <FountainPlaza plan={VIEWPOINT} />

      <World plan={GLADE} />
      <Bazaar plan={GLADE_ROW} />
      <World plan={FOUNDRY} />
      <Bazaar plan={WORKS_ROW} />
      <World plan={PULSE} />
      <Bazaar plan={PULSE_ROW} />

      {/* Themed scenery, three per world, inside each rect */}
      <GiantToadstools position={GLADE_SC[0]} />
      <StandingStones position={GLADE_SC[1]} />
      <LanternTree position={GLADE_SC[2]} />
      <GiantGear position={WORKS_SC[0]} />
      <BoilerTank position={WORKS_SC[1]} />
      <CoalCart position={WORKS_SC[2]} />
      <NeonArch position={PULSE_SC[0]} />
      <SpeakerStack position={PULSE_SC[1]} />
      <MirrorBallPylon position={PULSE_SC[2]} />

      {/* Amenities */}
      <Restroom position={REST} rotation={Math.PI / 2} />
      <Torch position={[6, 45.6]} />
      <Torch position={[-6, 45.6]} />

      {/* One lamp run per district, laid along a street */}
      <Lights from={[22.8, 45.6]} to={[22.8, 21.6]} />
      <Lights from={[-31.2, 16.8]} to={[-31.2, -8.4]} />
      <Lights from={[9.6, 21.6]} to={[9.6, -27.6]} />

      {/* Trees + scenery scatter (sieved for streets + water) */}
      {TREES.map((t, i) => (
        <Placed key={`tr-${i}`} position={t.at} build={(three: typeof THREE) => tree(three, { shape: t.shape })} />
      ))}
      {SCENERY.map((s, i) => (
        <Scenery key={`sc-${i}`} name={s.name} position={s.at} seed={i + 1} />
      ))}
    </Park>
  );
}

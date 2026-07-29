import React from 'react';
import {
  Park,
  Terrain,
  Paths,
  GameManager,
  Gate,
  Coaster,
  Fountain,
  Restroom,
  Torch,
  Neon,
  Scenery,
  Lights,
  Placed,
} from './components/Park';
import { compileTrackPieces } from './components/SplineRideKit';
import { FerrisWheel } from './components/FerrisWheel';
import { DropTower } from './components/DropTower';
import { Enterprise } from './components/Enterprise';
import { PirateShip } from './components/PirateShip';
import { SwingRide } from './components/SwingRide';
import { BurgerShop } from './components/BurgerShop';
import { SodaStand } from './components/SodaStand';
import { CottonCandyStand } from './components/CottonCandyStand';
import { Fence } from './components/Fence';
import { tree } from './components/Kit';

/*
================================================================================
 CINDER PEAK — a large expansive THRILL park (size 48, seed 7 temperate)
 RE-CREATED verbatim as the wave-7 evidence park (the /tmp copy was lost to a
 reboot). DO NOT EDIT — it is the round-7 artifact, defects and all.
================================================================================
*/

// §4.0-A THRILL steel rectangle — copied VERBATIM (do NOT re-tune).
const FIRESTORM_PIECES = [
  'station',
  { type: 'lift', height: 5.5 }, { type: 'straight', length: 4.84 }, { type: 'turnR', angle: 90, radius: 2.5 },
  { type: 'drop', height: 5.5 }, { type: 'hill', height: 1.2 },
  { type: 'lift', height: 5.1 }, { type: 'straight', length: 2.34 }, { type: 'turnR', angle: 90, radius: 2.5 },
  { type: 'drop', height: 5.1 }, { type: 'hill', height: 0.6 }, { type: 'hill', height: 0.6 },
  { type: 'lift', height: 5.1 }, { type: 'turnR', angle: 90, radius: 2.5 },
  { type: 'drop', height: 5.1 }, { type: 'hill', height: 0.6 }, { type: 'hill', height: 0.6 },
  { type: 'lift', height: 5.1 }, { type: 'turnR', angle: 90, radius: 2.5 },
  { type: 'drop', height: 5.1 }, { type: 'straight', length: 1.5 },
] as const;

const COASTER_START: [number, number, number] = [16.8, 0.55, -3.6];
const COASTER_HEADING = 0;

// Compile ONCE up front so <Terrain> can pre-cap peaks under the circuit + keepDry.
const COMPILED = compileTrackPieces(FIRESTORM_PIECES as any, {
  type: 'steel',
  start: COASTER_START,
  heading: COASTER_HEADING,
  bounds: 48,
});
const COASTER_PTS = COMPILED.points as [number, number, number][];

// ---- Street lattice -----------------------------------------------------------
const COLS = [-18, -12, -6, 0, 6, 12];
const ROWS = [15.6, 9.6, 3.6, -3.6, -9.6, -14.4];

const NODES: [number, number][] = [];
for (const z of ROWS) for (const x of COLS) NODES.push([x, z]);

// gate spur + east detour extra nodes
const EXTRA: [number, number][] = [
  [-12, 22.8], // gate node
  [18, -14.4],
  [22.8, -14.4],
  [22.8, -9.6],
  [22.8, -3.6], // coaster queue tail
];
for (const n of EXTRA) NODES.push(n);

const idx = (x: number, z: number) =>
  NODES.findIndex((n) => Math.abs(n[0] - x) < 1e-6 && Math.abs(n[1] - z) < 1e-6);

const EDGES: [number, number][] = [];
// interior grid: horizontal + vertical adjacencies
for (let r = 0; r < ROWS.length; r++) {
  for (let c = 0; c < COLS.length; c++) {
    const a = idx(COLS[c], ROWS[r]);
    if (c + 1 < COLS.length) EDGES.push([a, idx(COLS[c + 1], ROWS[r])]);
    if (r + 1 < ROWS.length) EDGES.push([a, idx(COLS[c], ROWS[r + 1])]);
  }
}
// gate spur
EDGES.push([idx(-12, 22.8), idx(-12, 15.6)]);
// east detour to the coaster queue tail (south of the station corridor)
EDGES.push([idx(12, -14.4), idx(18, -14.4)]);
EDGES.push([idx(18, -14.4), idx(22.8, -14.4)]);
EDGES.push([idx(22.8, -14.4), idx(22.8, -9.6)]);
EDGES.push([idx(22.8, -9.6), idx(22.8, -3.6)]);

const QUEUE_TAIL_NODE = idx(22.8, -3.6);

const PLAZA: [number, number, number, number] = [3.0, 6.0, 3.6, 3.6];
const BINS: [number, number][] = [[0, 3.6], [-6, 3.6], [6, -3.6]];

// keepDry: every built cell (nodes, ride pads, lanes, stalls, scenery, plaza).
const KEEP_DRY: [number, number][] = [
  ...NODES,
  // ride pads
  [-12, -2.4], [-6, -3.6], [0, 3.6], [-12, 9.6], [6, 3.6],
  // flat-ride lane midpoints
  [-12, 0.6], [-6, -6.6], [0, 6.6], [-12, 12.6], [6, 6.6],
  // coaster queue / exit apron
  [20.4, -3.6], [19.2, -1.2], [18.0, -3.6],
  // stalls + restroom
  [-3, 6.6], [3, 0], [-9, 6.6], [-3, -6.6],
  // scenery cells + plaza
  [3.0, 6.0], [-3, 3], [3, 3], [-3, -3], [9, 0], [-9, 3], [3, -3], [9, 6], [-15, 3],
];

// Trees (>=12) — dry cell interiors, clear of streets, rides and the coaster plan.
const TREES: [number, number, string][] = [
  [-15, 12, 'pine'], [-15, -3, 'pine'], [-15, -9, 'round'], [9, 12, 'round'],
  [9, -6, 'pine'], [-9, 12, 'round'], [-9, -6, 'pine'], [3, 12, 'round'],
  [-3, 12, 'pine'], [11, 6, 'round'], [11, 0, 'pine'], [3, -12, 'round'],
  [-9, -12, 'pine'], [-15, 6, 'round'],
];

export default function CinderPeak() {
  return (
    <div style={{ width: '100%', height: '100vh', position: 'relative' }}>
      <Park
        seed={7}
        climate="temperate"
        size={48}
        guests={26}
        onReady={(report: any) => {
          if (report?.ok) {
            // eslint-disable-next-line no-console
            console.log('[CINDER PEAK] validatePark ok — park is open.', report);
          } else {
            // eslint-disable-next-line no-console
            console.warn('[CINDER PEAK] validatePark failures:', report?.failures, report?.warnings);
          }
        }}
      >
        {/* 1 — terrain + climate (guards keep every built cell dry, peaks pre-capped) */}
        <Terrain keepDry={KEEP_DRY} coasterPts={COASTER_PTS} />

        {/* 2 — street lattice + walkers + bins */}
        <Paths nodes={NODES} edges={EDGES} plazas={[PLAZA]} walkers={6} bins={BINS} />

        {/* 3 — the one simulation */}
        <GameManager />

        {/* 4 — park entrance on the front apron, clear of the flying north leg */}
        <Gate position={[-12, 22.8]} />

        {/* 5 — FLAGSHIP: §4.0-A THRILL rectangle (verbatim) */}
        <Coaster
          name="Cinder Peak Firestorm"
          pieces={FIRESTORM_PIECES as any}
          start={COASTER_START}
          heading={COASTER_HEADING}
          type="steel"
          cars={5}
          capacity={4}
          rideDuration={10}
          intensity={7}
          price={6}
          deck={[-2.4, 0]}
          queueTailNode={QUEUE_TAIL_NODE}
          queueDir={[1, 0]}
        />

        {/* Ashfall Fairground (west) — thrill flats */}
        <DropTower
          position={[-12, -2.4]}
          rotation={0}
          register={{ name: 'The Cinder Drop', capacity: 10, rideDuration: 10, intensity: 8, price: 5 }}
          queue={{ anchor: [-12, 3.6], dir: [0, 1] }}
        />
        <Enterprise
          position={[-6, -3.6]}
          rotation={Math.PI}
          register={{ name: 'Ember Cyclone', capacity: 10, rideDuration: 10, intensity: 7, price: 5 }}
          queue={{ anchor: [-6, -9.6], dir: [0, -1] }}
        />
        <SwingRide
          position={[-12, 9.6]}
          rotation={0}
          register={{ name: 'Ashfall Swings', capacity: 8, rideDuration: 9, intensity: 4, price: 3 }}
          queue={{ anchor: [-12, 15.6], dir: [0, 1] }}
        />

        {/* Ember Plaza (hub) — moderate + gentle */}
        <PirateShip
          position={[0, 3.6]}
          rotation={0}
          register={{ name: 'Blackwater Galleon', capacity: 10, rideDuration: 10, intensity: 5, price: 4 }}
          queue={{ anchor: [0, 9.6], dir: [0, 1] }}
        />
        <FerrisWheel
          position={[6, 3.6]}
          rotation={0}
          register={{ name: 'Summit Skyline Wheel', capacity: 8, rideDuration: 11, intensity: 2, price: 4 }}
          queue={{ anchor: [6, 9.6], dir: [0, 1] }}
        />

        {/* Amenities */}
        <Fountain position={[3.0, 6.0]} />
        <Restroom position={[-3, -6.6]} rotation={0} />

        {/* Food (>=1 per 2 rides) — serving front toward the hub streets */}
        <BurgerShop position={[-3, 6.6]} rotation={0} register price={3} value={5} />
        <SodaStand position={[3, 0]} rotation={Math.PI} register price={2} value={4} />
        <CottonCandyStand position={[-9, 6.6]} rotation={0} register price={2} value={3} />

        {/* Boardwalk flavour — one neon marquee + string lights on the plaza */}
        <Neon text="CINDER PEAK" position={[3.0, 1.7, 4.2]} rotation={Math.PI} scale={0.6} />
        <Lights from={[1.2, 9.0]} to={[4.8, 9.0]} />

        {/* Torches around the plaza corners */}
        <Torch position={[1.2, 4.2]} />
        <Torch position={[4.8, 4.2]} />
        <Torch position={[1.2, 7.8]} />
        <Torch position={[4.8, 7.8]} />

        {/* Scenery — 8 distinct pieces, all on dry off-path cells */}
        <Scenery name="marbleStatue" position={[-3, 3]} />
        <Scenery name="flagpole" position={[3, 3]} />
        <Scenery name="planterBox" position={[-3, -3]} />
        <Scenery name="gazebo" position={[9, 0]} />
        <Scenery name="topiarySpiral" position={[-9, 3]} />
        <Scenery name="parkClock" position={[3, -3]} />
        <Scenery name="lionStatue" position={[9, 6]} />
        <Scenery name="signpost" position={[-15, 3]} />

        {/* Trees (>=12) */}
        {TREES.map(([x, z, shape], i) => (
          <Placed
            key={`tree-${i}`}
            build={(t: any) => tree(t, { shape })}
            position={[x, z]}
          />
        ))}
      </Park>
    </div>
  );
}

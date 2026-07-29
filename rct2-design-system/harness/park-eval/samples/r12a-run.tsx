/* =============================================================================
 * VOLTAIC PEAKS — a THRILL park on the default 128 plot
 * =============================================================================
 * seed 7 · climate "temperate" (7's default is desert — climate is PASSED)
 *
 * ROSTER (8 rides, 5 categories) — counted off the register calls that mount:
 *   thrill     Voltaic Peaks   §4.0-A steel flagship (E ~6.06 measured)
 *   transport  Grand Circle    §4.2-A 4-platform monorail ring (verbatim)
 *   dark       Hollow Hall     GhostTrain      (never-used shelf)
 *   water      Tidewater Oars  PaddleBoats     (never-used shelf, builds own pond)
 *   gentle     Pulse Spinner   Discotron       (Pulse world)
 *   gentle     Carousel Court  Carousel
 *   thrill     Foundry Fling   Enterprise      (Brasswork world)
 *   thrill     Galleon Swing   PirateShip      (Thornwick world)
 *
 * WORLDS (3, centres ≥ 32.66 u apart):
 *   pulse    PULSE_DISTRICT    at the gate street  (Discotron + NeonSlush + Pulse scenery)
 *   foundry  BRASSWORK_FOUNDRY west district       (Enterprise + soda + Brasswork scenery)
 *   glade    THORNWICK_GLADE   south district      (PirateShip + burger + Thornwick scenery)
 *
 * CORRIDOR KEEP-OUT (§4.0-A @ start [16.8, -3.6], PLOT coords):
 *   west valley  x[-21.6..-20.4] z[-10.8..9.6]
 *   south valley x[-12.0..8.4]   z[-20.4..-18.0]
 *   north valley x[-9.6..7.2]    z[16.8..19.2]
 *   station leg  x[15.6..18.0]   z[-10.8..4.8]   (own ride — exempt)
 * MONORAIL PIER LINES: x ≈ ±(37.2..44.4), z rows 33.0/34.2/35.4 (N) & -49.8/-51.0/-52.2 (S)
 * ========================================================================== */

import React from 'react';
import type { XZ, NetRef } from '../../../mp3d/components/SetPieceKit';
import type { TrackPiece } from '../../../mp3d/components/SplineRideKit';
import type { V3 } from '../../../mp3d/components/Park';
import {
  Park, GameManager, Terrain, Paths, Gate, Coaster,
  Restroom, Scenery, Lights, Placed,
  offPathCell,
} from '../../../mp3d/components/Park';
import {
  World, worldPlan, buildParkNet,
  BRASSWORK_FOUNDRY, THORNWICK_GLADE, PULSE_DISTRICT,
} from '../../../mp3d/components/SetPieceKit';
import { FountainPlaza, fountainPlazaPlan } from '../../../mp3d/components/FountainPlaza';
import { Bazaar, bazaarPlan } from '../../../mp3d/components/Bazaar';
import { Boulevard, boulevardPlan } from '../../../mp3d/components/Boulevard';
import { compileTrackPieces, rateCoaster } from '../../../mp3d/components/SplineRideKit';
import { tree } from '../../../mp3d/components/Kit';

// catalog rides — each from its OWN folder
import { Monorail } from '../../../mp3d/components/Monorail';
import { GhostTrain } from '../../../mp3d/components/GhostTrain';
import { PaddleBoats } from '../../../mp3d/components/PaddleBoats';
import { Discotron } from '../../../mp3d/components/Discotron';
import { Carousel } from '../../../mp3d/components/Carousel';
import { Enterprise } from '../../../mp3d/components/Enterprise';
import { PirateShip } from '../../../mp3d/components/PirateShip';
// world scenery
import { NeonArch, MirrorBallPylon, SpeakerStack } from '../../../mp3d/components/PulseScenery';
import { GiantGear, ClockTower, BoilerTank } from '../../../mp3d/components/BrassworkScenery';
import { GiantToadstools, LanternTree, RuinedArch } from '../../../mp3d/components/ThornwickScenery';
import { NeonSlush } from '../../../mp3d/components/NeonSlush';

/* ── the flagship coaster: §4.0-A verbatim ─────────────────────────────── */
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
const A_TAIL: XZ = [22.8, -3.6];                 // start.x + 6.0
const A_REG: XZ = [-2.0, -0.5];                  // registered FOOTPRINT centre (start + (-18.81,+3.08))

const { points: FLAG_PTS, report: FLAG_REPORT } = compileTrackPieces(A_PIECES, {
  profile: 'coaster', type: 'steel', start: A_START, heading: 0,
});
const FLAG_RATING = rateCoaster(FLAG_PTS, { type: 'steel', bank: 0.7, cars: 5 });
console.log('[thrill] Voltaic Peaks E', FLAG_RATING.excitement, 'I', FLAG_RATING.intensity,
  'N', FLAG_RATING.nausea, 'drop', FLAG_RATING.highestDrop, 'lat', FLAG_RATING.maxLatG,
  'air', FLAG_RATING.airtimeSeconds, 'fatal', FLAG_REPORT.fatal ?? false,
  'synth', FLAG_REPORT.closure?.synthesized?.length ?? 0);

/* ── the monorail ring: §4.2-A verbatim (size 128) ─────────────────────── */
const MONO_PIECES: TrackPiece[] = [
  'station',
  { type: 'straight', length: 35.3 }, { type: 'turnL', angle: 90, radius: 6 }, { type: 'straight', length: 35.3 },
  'station',
  { type: 'straight', length: 35.3 }, { type: 'turnL', angle: 90, radius: 6 }, { type: 'straight', length: 35.3 },
  'station',
  { type: 'straight', length: 35.3 }, { type: 'turnL', angle: 90, radius: 6 }, { type: 'straight', length: 35.3 },
  'station',
  { type: 'straight', length: 35.3 }, { type: 'turnL', angle: 90, radius: 6 },
  { type: 'straight', length: 33.5 }, { type: 'straight', length: 1.5 },
];
const MONO_PTS = compileTrackPieces(MONO_PIECES, {
  profile: 'monorail', start: [-42.6, 2.6, -9.7], heading: 0,
}).points;

/* ── flat-ride placement: TAIL FIRST, pad DERIVED ───────────────────────
 * catalog rides take queue={{ anchor, dir }} (no queueTailNode). Build from an
 * AUTHORED tail node with out = unit(tail -> ride):
 *   laneLenOf(c) = max(2.2, 1.1 + 0.56c);  join = laneLenOf + 0.35
 *   anchor(head) = tail + out*join ;  pad = tail + out*(join + front) ;  dir = -out
 * ---------------------------------------------------------------------------- */
type Placement = { pad: XZ; anchor: XZ; dir: XZ };
function place(tail: XZ, out: XZ, capacity: number, front: number): Placement {
  const lane = Math.max(2.2, 1.1 + 0.56 * capacity);
  const join = lane + 0.35;
  const pad: XZ = [tail[0] + out[0] * (join + front), tail[1] + out[1] * (join + front)];
  const anchor: XZ = [tail[0] + out[0] * join, tail[1] + out[1] * join];
  const dir: XZ = [-out[0], -out[1]];
  return { pad, anchor, dir };
}

/* Discotron (cap 12, front 4.0) — Pulse world, tail node D_TAIL, ride to the +x */
const D_TAIL: XZ = [9.6, 54.0];
const DISCO = place(D_TAIL, [1, 0], 12, 4.0);       // pad ~[19.6, 54.0]
/* Carousel (cap 8, front auto ~5.0) — hub apron, tail node C_TAIL, ride to the -x */
const C_TAIL: XZ = [-9.6, 54.0];
const CARO = place(C_TAIL, [-1, 0], 8, 5.0);        // pad ~[-20.6, 54.0]
/* Enterprise (cap 10, front auto ~5.3) — Brasswork world, tail E_TAIL, ride to -z */
const E_TAIL: XZ = [-33.6, 9.6];
const ENT = place(E_TAIL, [0, -1], 10, 5.3);        // pad ~[-33.6, -2.7]
/* PirateShip (cap 10, front auto ~5.3) — Thornwick world, tail P_TAIL, ride to -x */
const P_TAIL: XZ = [-9.6, -27.6];
const PIRATE = place(P_TAIL, [-1, 0], 10, 5.3);     // pad ~[-22.5, -27.6]
/* GhostTrain (cap 6, front auto ~4.0) — near hub east, tail G_TAIL, ride to +x */
const G_TAIL: XZ = [9.6, 45.6];
const GHOST = place(G_TAIL, [1, 0], 6, 4.0);        // pad ~[18.3, 45.6]
/* PaddleBoats — flat rig, builds own pond; give it its own tail P2_TAIL */
const PB_TAIL: XZ = [36.0, 21.6];
const PADDLE = place(PB_TAIL, [1, 0], 8, 5.0);      // pad ~[47.9, 21.6]

/* ── the HUB (neutral, no theme) ───────────────────────────────────────── */
const GATE: XZ = [0, 63.6];
const HUB = fountainPlazaPlan({ id: 'hub', position: [0, 45.6], tiles: 7, ports: ['N', 'E', 'W'] });
// half = 4.2 → ports: N [0,50.4]  E [6.0,45.6]  W [-6.0,45.6]

/* ── the three WORLD bazaars (themed shop rows) ────────────────────────── */
const PULSE_ROW = bazaarPlan({
  id: 'pulseRow', title: 'Pulse Market', position: [0, 33.6],
  facing: { port: 'W', toward: [0, 45.6] }, stalls: ['soda', 'cottonCandy'],
  theme: PULSE_DISTRICT, seed: 7,
});
const WORKS_ROW = bazaarPlan({
  id: 'worksRow', title: 'Foundry Row', position: [-33.6, 21.6],
  facing: { port: 'E', toward: [-9.6, 21.6] }, stalls: ['burger', 'hotDog', 'soda'],
  theme: BRASSWORK_FOUNDRY, seed: 9,
});
const GLADE_ROW = bazaarPlan({
  id: 'gladeRow', title: 'Glade Market', position: [0, -27.6],
  facing: { port: 'E', toward: [22.8, -27.6] }, stalls: ['cottonCandy', 'burger', 'soda'],
  theme: THORNWICK_GLADE, seed: 11,
});

/* ── scenery + stall region HINTS (approx cells, so each world's region covers
 *    them; the ACTUAL placement cells are offPathCell-resolved after NET) ──── */
const S_PULSE_ARCH_HINT: XZ = [4.8, 58.8];
const S_PULSE_PYLON_HINT: XZ = [22.8, 51.6];
const S_PULSE_SPKR_HINT: XZ = [15.6, 52.8];
const NEONSLUSH_HINT: XZ = [-4.8, 27.6];
const S_FOUNDRY_GEAR_HINT: XZ = [-43.2, 3.6];
const S_FOUNDRY_CLOCK_HINT: XZ = [-43.2, -3.6];
const S_FOUNDRY_BOILER_HINT: XZ = [-27.6, -8.4];
const S_GLADE_TOAD_HINT: XZ = [-15.6, -33.6];
const S_GLADE_TREE_HINT: XZ = [-31.2, -33.6];
const S_GLADE_ARCH_HINT: XZ = [13.2, -33.6];

/* ── the WORLDS: set-piece PLUS every hand-placed PAD / stall / scenery cell ── */
const PULSE = worldPlan({
  id: 'pulse', theme: PULSE_DISTRICT, pieces: [PULSE_ROW],
  include: [DISCO.pad, DISCO.anchor, D_TAIL, [22.8, 54.0], S_PULSE_ARCH_HINT,
    S_PULSE_PYLON_HINT, S_PULSE_SPKR_HINT, NEONSLUSH_HINT] as XZ[],
});
const FOUNDRY = worldPlan({
  id: 'foundry', theme: BRASSWORK_FOUNDRY, pieces: [WORKS_ROW],
  include: [ENT.pad, ENT.anchor, E_TAIL, [-33.6, -6.0], S_FOUNDRY_GEAR_HINT,
    S_FOUNDRY_CLOCK_HINT, S_FOUNDRY_BOILER_HINT] as XZ[],
});
const GLADE = worldPlan({
  id: 'glade', theme: THORNWICK_GLADE, pieces: [GLADE_ROW],
  include: [PIRATE.pad, PIRATE.anchor, P_TAIL, S_GLADE_TOAD_HINT,
    S_GLADE_TREE_HINT, S_GLADE_ARCH_HINT] as XZ[],
});
const WORLDS = [PULSE, FOUNDRY, GLADE];

/* ── ONE approach boulevard (novelty + the required avenue) ─────────────── */
const AVE_W = boulevardPlan({
  id: 'aveW', from: HUB.port('W'), to: [-33.6, 45.6], spacing: 4.8, theme: BRASSWORK_FOUNDRY,
  avoid: [HUB.port('W'), [-33.6, 45.6], [-31.2, 45.6], [-12.0, 45.6], [-24.0, 45.6]] as XZ[],
  clear: 2.6,
});

/* ── the street graph: authored nodes (indices preserved) ──────────────── */
const NODES: XZ[] = [
  GATE,            // 0  gate  [0,63.6]
  [0, 58.8],       // 1  gate junction
  [9.6, 58.8],     // 2  near-gate ride approach
  G_TAIL,          // 3  GhostTrain tail [9.6,45.6]  (14.4 u street from gate)
  D_TAIL,          // 4  Discotron tail [9.6,54.0]
  C_TAIL,          // 5  Carousel tail [-9.6,54.0]
  [22.8, 45.6],    // 6  east apron north
  [22.8, 21.6],    // 7  east spine (under monorail N leg)
  A_TAIL,          // 8  §4.0-A queue tail [22.8,-3.6] (junction)
  [22.8, -8.4],    // 9  east junction
  [36.0, -8.4],    // 10 monorail EAST platform tail
  PB_TAIL,         // 11 PaddleBoats tail [36.0,21.6]
  [22.8, -27.6],   // 12 south-east corner
  [9.6, 21.6],     // 13 ring ENTRY column (clear of valleys)
  [9.6, -27.6],    // 14 ring interior spine south
  [0, -27.6],      // 15 south leg junction
  [0, -44.4],      // 16 monorail SOUTH platform tail
  [-31.2, -27.6],  // 17 south-west corner
  P_TAIL,          // 18 PirateShip tail [-9.6,-27.6]
  [-31.2, -8.4],   // 19 west junction
  [-36.0, -8.4],   // 20 monorail WEST platform tail
  [-33.6, -6.0],   // 21 Enterprise approach (E_TAIL at -33.6,9.6 -> spine)
  E_TAIL,          // 22 Enterprise tail [-33.6,9.6]
  [-33.6, 45.6],   // 23 north-west corner (boulevard B end)
  [-31.2, 30.0],   // 24 west leg north (clear of N pier rows)
  [9.6, 27.6],     // 25 elbow to north platform
  [0, 27.6],       // 26 monorail NORTH platform tail
  [50.4, -8.4],    // 27 satellite viewpoint + 2nd plaza (OUTSIDE band)
];

const EDGES: [NetRef, NetRef][] = [
  [0, 1], [1, 'hub:N'], [1, 2], [2, 3], [2, 4], [1, 5],
  ['hub:E', 6], [6, 7], [7, 8], [8, 9], [9, 10], [7, 11],
  [7, 13], [13, 25], [25, 26], [13, 14],
  [9, 12], [12, 14], [14, 15], [15, 16], [15, 17],
  [17, 18], [17, 19], [19, 20], [19, 21], [21, 22],
  [17, 23], [23, 'hub:W'], [24, 23], [19, 24],
  [10, 27],
];

/* ── keepDry: only what we PAVE or stand a structure on ────────────────── */
const KEEP_DRY: XZ[] = [
  ...NODES,
  A_TAIL, DISCO.pad, CARO.pad, ENT.pad, PIRATE.pad, GHOST.pad, PADDLE.pad,
  DISCO.anchor, CARO.anchor, ENT.anchor, PIRATE.anchor, GHOST.anchor, PADDLE.anchor,
  A_REG, [0, -3.6], [16.8, -3.6],
  // monorail platform decks + queue tails
  [-42.6, -8.4], [0, 34.2], [42.6, -8.4], [0, -51.0],
  [-36.0, -8.4], [0, 27.6], [36.0, -8.4], [0, -44.4],
];

const NET = buildParkNet({
  nodes: NODES,
  edges: EDGES,
  pieces: [HUB, AVE_W],
  worlds: WORLDS,
  keepDry: KEEP_DRY,
  bins: [[4.8, 40.8], [13.2, -12.0], [-27.6, 3.6]] as XZ[],
});

/* ── offPathCell for every hand-placed prop / building cell ─────────────── */
const oc = (cell: XZ, clear = 1.2): XZ => (offPathCell(NET, cell, { clear }) ?? cell) as XZ;
const RESTROOM_CELL = oc([50.4, -14.4], 1.8);
const NEONSLUSH_CELL = oc(NEONSLUSH_HINT, 1.8);

// scenery cells (all through offPathCell so none reuse a street axis)
const S_PULSE_ARCH = oc(S_PULSE_ARCH_HINT);
const S_PULSE_PYLON = oc(S_PULSE_PYLON_HINT);
const S_PULSE_SPKR = oc(S_PULSE_SPKR_HINT);
const S_FOUNDRY_GEAR = oc(S_FOUNDRY_GEAR_HINT);
const S_FOUNDRY_CLOCK = oc(S_FOUNDRY_CLOCK_HINT);
const S_FOUNDRY_BOILER = oc(S_FOUNDRY_BOILER_HINT);
const S_GLADE_TOAD = oc(S_GLADE_TOAD_HINT);
const S_GLADE_TREE = oc(S_GLADE_TREE_HINT);
const S_GLADE_ARCH = oc(S_GLADE_ARCH_HINT);

// tree cells — mixed shapes, ≥ 32; drawn from a lattice offset off the streets
const TREE_CELLS: { at: XZ; shape: 'pine' | 'round' | 'willow' }[] = [
  { at: [6.0, 61.2], shape: 'round' }, { at: [-6.0, 61.2], shape: 'pine' },
  { at: [14.4, 61.2], shape: 'round' }, { at: [-14.4, 58.8], shape: 'willow' },
  { at: [27.6, 51.6], shape: 'pine' }, { at: [27.6, 39.6], shape: 'round' },
  { at: [27.6, 27.6], shape: 'pine' }, { at: [27.6, 16.8], shape: 'round' },
  { at: [16.8, 16.8], shape: 'willow' }, { at: [4.8, 16.8], shape: 'pine' },
  { at: [16.8, -13.2], shape: 'round' }, { at: [4.8, -13.2], shape: 'pine' },
  { at: [16.8, -33.6], shape: 'willow' }, { at: [4.8, -33.6], shape: 'round' },
  { at: [-6.0, -33.6], shape: 'pine' }, { at: [-25.2, -22.8], shape: 'round' },
  { at: [-25.2, -13.2], shape: 'willow' }, { at: [-37.2, -13.2], shape: 'pine' },
  { at: [-37.2, 3.6], shape: 'round' }, { at: [-37.2, 15.6], shape: 'pine' },
  { at: [-27.6, 27.6], shape: 'willow' }, { at: [-37.2, 40.8], shape: 'round' },
  { at: [-27.6, 40.8], shape: 'pine' }, { at: [-16.8, 40.8], shape: 'round' },
  { at: [42.0, -14.4], shape: 'pine' }, { at: [45.6, -3.6], shape: 'round' },
  { at: [55.2, -3.6], shape: 'willow' }, { at: [55.2, -14.4], shape: 'pine' },
  { at: [33.6, 27.6], shape: 'round' }, { at: [42.0, 27.6], shape: 'pine' },
  { at: [-13.2, 51.6], shape: 'round' }, { at: [13.2, 27.6], shape: 'pine' },
  { at: [-4.8, -50.4], shape: 'willow' }, { at: [6.0, -50.4], shape: 'round' },
].map((t) => ({ ...t, at: oc(t.at) }));

/* ── the second plaza (satellite viewpoint, different tiles) ────────────── */
const VIEWPOINT = fountainPlazaPlan({
  id: 'viewpoint', position: [50.4, -8.4], tiles: 9, ports: ['W'],
});

const NET2 = buildParkNet({
  nodes: NODES,
  edges: EDGES,
  pieces: [HUB, AVE_W, VIEWPOINT],
  worlds: WORLDS,
  keepDry: KEEP_DRY,
  bins: [[4.8, 40.8], [13.2, -12.0], [-27.6, 3.6]] as XZ[],
});

export function App() {
  return (
    <div className="w-full min-h-screen bg-slate-900">
      <Park
        seed={7}
        climate="temperate"
        /* HARNESS-ONLY DELTA vs samples/r12a.tsx: the generated park shipped NO
         * `roster` prop and therefore FAILS preflight, which refuses to bundle.
         * Values are deliberately floored at 1 so `rosterOverstated` CANNOT
         * fire off this line — the real claim is audited from the §0 header via
         * probe.rideRoster.headerClaim, which is untouched. */
        roster={{ rides: 1, stalls: 1, categories: 1 }}
        onReady={(report: { ok: boolean }) => {
          console.log('[Voltaic Peaks] ready — validatePark ok:', report.ok);
        }}
      >
        <Terrain keepDry={NET2.keepDry} coasterPts={FLAG_PTS} />
        <Paths
          nodes={NET2.nodes}
          edges={NET2.edges}
          plazas={NET2.plazas}
          bins={NET2.bins}
          walkers={8}
        />
        <GameManager />
        <Gate />

        {/* ── THRILL flagship (near-hub-anchored via its east spine) ── */}
        <Coaster
          name="Voltaic Peaks"
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
          queueTailNode={NET2.node(A_TAIL)}
          queueDir={[1, 0]}
          deck={[A_START[0], A_START[2] + 1.2]}
        />

        {/* ── TRANSPORT: the park-spanning monorail ring (§4.2-A verbatim) ── */}
        <Monorail
          position={[-42.6, 0, -9.7]}
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
          register={{
            board: [-42.6, 2.6, -8.4],
            stations: [
              { label: 'North', boardPoint: [0, 2.6, 34.2], queueAnchor: [0, 0.05, 32.41],
                queueDir: [0, -1], exitPoint: [-1.2, 0.05, 33.03], exitDir: [0, -1] },
              { label: 'East', boardPoint: [42.6, 2.6, -8.4], queueAnchor: [40.81, 0.05, -8.4],
                queueDir: [-1, 0], exitPoint: [41.43, 0.05, -7.2], exitDir: [-1, 0] },
              { label: 'South', boardPoint: [0, 2.6, -51.0], queueAnchor: [0, 0.05, -49.21],
                queueDir: [0, 1], exitPoint: [1.2, 0.05, -49.83], exitDir: [0, 1] },
            ],
          }}
        />

        {/* ── DARK: Hollow Hall ghost train (never-used shelf) ── */}
        <GhostTrain
          position={GHOST.pad}
          rotation={-Math.PI / 2}
          register={{ name: 'Hollow Hall', capacity: 6, rideDuration: 9, intensity: 3, price: 4 }}
          queue={{ anchor: GHOST.anchor, dir: GHOST.dir }}
        />

        {/* ── WATER: Tidewater Oars paddle boats (never-used shelf) ── */}
        <PaddleBoats
          position={PADDLE.pad}
          rotation={-Math.PI / 2}
          register={{ name: 'Tidewater Oars', capacity: 8, rideDuration: 11, intensity: 2, price: 3 }}
          queue={{ anchor: PADDLE.anchor, dir: PADDLE.dir }}
        />

        {/* ── GENTLE: Pulse Spinner (Discotron) ── */}
        <Discotron
          position={DISCO.pad}
          rotation={-Math.PI / 2}
          riders={false}
          register={{ name: 'Pulse Spinner', capacity: 12, rideDuration: 13, intensity: 6, price: 4 }}
          queue={{ anchor: DISCO.anchor, dir: DISCO.dir }}
        />

        {/* ── GENTLE: Carousel Court ── */}
        <Carousel
          position={CARO.pad}
          rotation={Math.PI / 2}
          register={{ name: 'Carousel Court', capacity: 8, rideDuration: 10, intensity: 2, price: 3 }}
          queue={{ anchor: CARO.anchor, dir: CARO.dir }}
        />

        {/* ── THRILL: Foundry Fling (Enterprise) ── */}
        <Enterprise
          position={ENT.pad}
          rotation={0}
          register={{ name: 'Foundry Fling', capacity: 10, rideDuration: 12, intensity: 7, price: 5 }}
          queue={{ anchor: ENT.anchor, dir: ENT.dir }}
        />

        {/* ── THRILL: Galleon Swing (PirateShip) ── */}
        <PirateShip
          position={PIRATE.pad}
          rotation={Math.PI / 2}
          register={{ name: 'Galleon Swing', capacity: 10, rideDuration: 12, intensity: 6, price: 5 }}
          queue={{ anchor: PIRATE.anchor, dir: PIRATE.dir }}
        />

        {/* ── amenities ── */}
        <Restroom position={RESTROOM_CELL} rotation={Math.PI / 2} />

        {/* ── set-pieces + worlds (AFTER Paths) ── */}
        <FountainPlaza plan={HUB} />
        <FountainPlaza plan={VIEWPOINT} />
        <Boulevard plan={AVE_W} />

        <World plan={PULSE} />
        <Bazaar plan={PULSE_ROW} />
        <NeonSlush position={NEONSLUSH_CELL} rotation={0}
          register={{ name: 'Pulse Slush', price: 3, value: 5 }} />
        <NeonArch position={S_PULSE_ARCH} rotation={0} />
        <MirrorBallPylon position={S_PULSE_PYLON} rotation={0} />
        <SpeakerStack position={S_PULSE_SPKR} rotation={-Math.PI / 2} />

        <World plan={FOUNDRY} />
        <Bazaar plan={WORKS_ROW} />
        <GiantGear position={S_FOUNDRY_GEAR} rotation={Math.PI / 2} />
        <ClockTower position={S_FOUNDRY_CLOCK} rotation={0} />
        <BoilerTank position={S_FOUNDRY_BOILER} rotation={1.35} />

        <World plan={GLADE} />
        <Bazaar plan={GLADE_ROW} />
        <GiantToadstools position={S_GLADE_TOAD} rotation={0} />
        <LanternTree position={S_GLADE_TREE} rotation={0} />
        <RuinedArch position={S_GLADE_ARCH} rotation={Math.PI / 2} />

        {/* ── district lighting runs (ALONG the street, one per district) ── */}
        <Lights from={[9.6, 51.6]} to={[9.6, 45.6]} />
        <Lights from={[-31.2, -12.0]} to={[-31.2, -6.0]} />
        <Lights from={[4.8, -27.6]} to={[-4.8, -27.6]} />

        {/* ── trees (≥ 32, mixed shapes) ── */}
        {TREE_CELLS.map((t, i) => (
          <Placed key={`tree-${i}`} position={t.at}
            build={(three: typeof import('three')) => tree(three, { shape: t.shape })} />
        ))}
      </Park>
    </div>
  );
}

export default App;

/* ═══ CINDERLOCH FAIR — a cool theme park (§0 PRE-FLIGHT, size 48 / DistrictPark discipline) ══
 * SIZE   48 (compact worked-example scale — FountainPlaza + Bazaar + Boulevard fused by
 *        buildParkNet, a pieces-mode §4.0-A flagship, pads on the ring's free interior)
 * SEED   7 / temperate — ONE water body at 48; keepDry covers every pad/hut/lane so the
 *        body re-picks clear of the layout.
 * GATE   [0, 22.8] on the +z front edge.
 * CATS   gentle Carousel · thrill §4.0-A flagship + Teacups + DropTower · water PaddleBoats
 *        · dark GhostTrain   → 4 categories (compact park; monorail is the 128 requirement).
 * FLAG   §4.0-A VERBATIM · start [16.8, 0.55, -3.6] heading 0 steel cars 5 · queue tail
 *        [22.8, -3.6] queueDir [1,0] · exit/exitDir OMITTED (chassis derives the RCT2 pair).
 *        rateCoaster logged at runtime (see console) — pasted here after first run.
 * CORRIDOR KEEP-OUT (§4.0-A @ start [16.8,-3.6], PLOT coords):
 *        W valley  x[-21.6..-20.4] z[-10.8..9.6] · S valley x[-12.0..8.4] z[-20.4..-18.0]
 *        N valley  x[-9.6..7.2]    z[16.8..19.2]  · station leg x[15.6..18.0] z[-10.8..4.8] (own)
 *        Every street node routed clear of all four; the promenade wraps NORTH of the ring
 *        (x -12 and x 10.8 columns, both outside the N-valley x-span) into the free interior.
 * QUEUE  tail is an AUTHORED NODE, pad DERIVED from it (§0.4 construction):
 *        Carousel  cap4 tail [10.8,12]  out[0,1]  → pad [10.8,17.49]  ≥5.26 ✓
 *        Teacups   cap4 tail [-12,12]   out[0,1]  → pad [-12,17.49]   ≥5.26 ✓
 *        DropTower cap8 tail [-12,4.8]  out[-1,0] → pad [-19.73,4.8]   ≥7.50 ✓
 *        GhostTrain cap6 tail [10.8,4.8] out[0,-1]→ pad [10.8,-1.81]   ≥6.38 ✓
 *        PaddleBoats cap4 tail [-12,-4.8] out[0,-1]→ pad [-12,-10.29]  ≥5.26 ✓
 *        Flagship  cap4 queueTailNode NET.node([22.8,-3.6]) — chassis derives the lane.
 * GATE   validatePark → logged at runtime.
 * ═════════════════════════════════════════════════════════════════════════════════════ */
import React from 'react';
import {
  Park, Terrain, Paths, Gate, GameManager, Coaster, Fountain, Restroom,
  Torch, Neon, Scenery, Lights, Placed,
} from './components/Park';
import type { XZ } from './components/SetPieceKit';
import type { TrackPiece } from './components/SplineRideKit';
import type { V3 } from './components/Park';
import { buildParkNet, EMBERFALL_CALDERA } from './components/SetPieceKit';
import { FountainPlaza, fountainPlazaPlan } from './components/FountainPlaza';
import { Bazaar, bazaarPlan } from './components/Bazaar';
import { Boulevard, boulevardPlan } from './components/Boulevard';
import { Carousel } from './components/Carousel';
import { Teacups } from './components/Teacups';
import { DropTower } from './components/DropTower';
import { GhostTrain } from './components/GhostTrain';
import { PaddleBoats } from './components/PaddleBoats';
import { compileTrackPieces, rateCoaster } from './components/SplineRideKit';
import { tree } from './components/Kit';

// ── FLAGSHIP: §4.0-A THRILL steel rectangle, copied VERBATIM (no casts) ──────────────
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
const { points: FLAG_PTS, report: FLAG_REPORT } =
  compileTrackPieces(A_PIECES, { type: 'steel', start: A_START, heading: 0 });

// ── STREET SKELETON — my own spine + spurs (indices preserved by buildParkNet) ───────
const GATE: XZ = [0, 22.8];
const NODES: XZ[] = [
  GATE,             // 0  gate, front edge
  [-12, 22.8],      // 1  NW promenade corner
  [-12, 12],        // 2  W entry into the ring interior
  [10.8, 22.8],     // 3  NE promenade corner
  [10.8, 12],       // 4  E entry — Carousel tail
  [-12, 4.8],       // 5  W lower — DropTower tail
  [10.8, 4.8],      // 6  E lower — GhostTrain tail
  [22.8, -3.6],     // 7  flagship queue tail (east of the station, clear of the ring)
  [-6, 12],         // 8  hub approach
  [-12, -4.8],      // 9  SW — PaddleBoats tail
  [-12, -12],       // 10 SW corner (loop return, crosses z=0)
  [10.8, -12],      // 11 SE corner (loop return)
];
const HUB = fountainPlazaPlan({ id: 'hub', title: 'Grand Plaza', position: [-6, 8.4], tiles: 7 });
const MARKET = bazaarPlan({
  id: 'market', title: 'Cinder Market', position: [-6, -3.6],
  stalls: ['burger', 'hotDog', 'soda', 'cottonCandy'],
  facing: { port: 'E', toward: [-6, 8.4] }, theme: EMBERFALL_CALDERA, seed: 4,
});
const GATE_AVE = boulevardPlan({
  id: 'gateAve', from: GATE, to: [-12, 22.8],
  avoid: [GATE, [-12, 22.8], [-12, 12], [10.8, 22.8]], clear: 2.6,
});

const NET = buildParkNet({
  nodes: NODES,
  edges: [
    // promenade wraps NORTH of the ring, down both flanks, and closes a loop across z=0
    [0, 3], [3, 4], [4, 6],
    [1, 2], [2, 5], [5, 9], [9, 10], [10, 11], [11, 6],
    [2, 8], [8, 'hub:N'],           // into the hub from the west entry
    ['hub:S', 'market:E'],           // hub → market
    // ride tails already sit on nodes 4/5/6/7/9; the flagship tail (7) hangs off the SE corner
    [11, 7],
  ] as [any, any][],
  pieces: [HUB, MARKET, GATE_AVE],
  keepDry: [
    ...NODES,
    // ride pads / lanes
    [10.8, 17.49], [-12, 17.49], [-19.73, 4.8], [10.8, -1.81], [-12, -10.29],
    A_START.slice(0, 3) as unknown as XZ, [16.8, -3.6], [18.49, -4.8],
  ] as XZ[],
});

function logReport(report: any) {
  const r = rateCoaster(FLAG_PTS, { type: 'steel', bank: 0.7, cars: 5 });
  console.log(`[thrill] Cinderloch Racer  E ${r.excitement} I ${r.intensity} N ${r.nausea}`,
    `drop ${r.highestDrop} G +${r.maxPosVertG}/${r.maxNegVertG} lat ${r.maxLatG} air ${r.airtimeSeconds}s`,
    `| compile fatal=${!!FLAG_REPORT.fatal}`);
}

export function App() {
  return (
    <Park seed={7} climate="temperate" size={48} onReady={logReport}
      roster={{ rides: ['Cinderloch Racer', 'Sunlit Carousel', 'Whirligig Teacups', 'Ashfall Drop', 'Hollow Manor', 'Lagoon Paddlers'], stalls: 4, categories: 4 }}>
      <Terrain keepDry={NET.keepDry} coasterPts={FLAG_PTS} />
      <Paths nodes={NET.nodes} edges={NET.edges} plazas={NET.plazas} bins={NET.bins} walkers={5} />
      <GameManager />
      <Gate position={GATE} />

      {/* ── HUB + shops ────────────────────────────────────────────── */}
      <FountainPlaza plan={HUB} />
      <Bazaar plan={MARKET} />
      <Boulevard plan={GATE_AVE} />
      <Restroom position={[-3.6, 12]} rotation={-Math.PI / 2} />

      {/* ── FLAGSHIP — §4.0-A, pieces mode ─────────────────────────── */}
      <Coaster name="Cinderloch Racer" pieces={A_PIECES} start={A_START} heading={0}
        type="steel" cars={5} capacity={4} rideDuration={10} intensity={7} price={5}
        queueTailNode={NET.node([22.8, -3.6])} queueDir={[1, 0]}
        deck={[-4.31, 0]} colours="fire" />

      {/* ── GENTLE ─────────────────────────────────────────────────── */}
      <Carousel position={[10.8, 17.49]} rotation={Math.PI}
        register={{ name: 'Sunlit Carousel', capacity: 4, rideDuration: 8, intensity: 2, price: 3 }}
        queue={{ anchor: [10.8, 15.69], dir: [0, -1] }} />

      {/* ── THRILL spinners ────────────────────────────────────────── */}
      <Teacups position={[-12, 17.49]} rotation={Math.PI}
        register={{ name: 'Whirligig Teacups', capacity: 4, rideDuration: 8, intensity: 5, price: 3 }}
        queue={{ anchor: [-12, 15.69], dir: [0, -1] }} />
      <DropTower position={[-19.73, 4.8]} rotation={Math.PI / 2}
        register={{ name: 'Ashfall Drop', capacity: 8, rideDuration: 10, intensity: 8, price: 4 }}
        queue={{ anchor: [-17.93, 4.8], dir: [1, 0] }} />

      {/* ── DARK ───────────────────────────────────────────────────── */}
      <GhostTrain position={[10.8, -1.81]} rotation={0} riders
        register={{ name: 'Hollow Manor', capacity: 6, rideDuration: 11, intensity: 5, price: 4 }}
        queue={{ anchor: [10.8, 0.01], dir: [0, 1] }} />

      {/* ── WATER (builds its own pond, dry flat land) ─────────────── */}
      <PaddleBoats position={[-12, -10.29]} rotation={0}
        register={{ name: 'Lagoon Paddlers', capacity: 4, rideDuration: 12, intensity: 1, price: 2 }}
        queue={{ anchor: [-12, -8.49], dir: [0, 1] }} />

      {/* ── DRESSING ───────────────────────────────────────────────── */}
      <Neon text="CINDERLOCH" position={[0, 3.6, 21.6]} rotation={Math.PI} scale={0.55} />
      <Lights from={[-12, 12]} to={[-12, 4.8]} />
      <Lights from={[10.8, 12]} to={[10.8, 4.8]} />
      <Lights from={[-12, -4.8]} to={[-12, -12]} />
      <Torch position={[-1.2, 8.4]} />
      <Torch position={[-10.8, 8.4]} />
      <Torch position={[10.8, 8.4]} />
      <Torch position={[-16.8, -6]} />

      <Scenery name="marbleStatue" position={[-6, 4.8]} />
      <Scenery name="topiarySpiral" position={[-3.6, 4.8]} />
      <Scenery name="topiaryElephant" position={[-8.4, 4.8]} />
      <Scenery name="gazebo" position={[14.4, 12]} />
      <Scenery name="picnicTable" position={[13.2, 15.6]} />
      <Scenery name="lionStatue" position={[-16.8, 12]} />
      <Scenery name="wishingWell" position={[-16.8, -12]} />
      <Scenery name="signpost" position={[3.6, 12]} />
      <Scenery name="flagpole" position={[-3.6, 15.6]} />
      <Scenery name="parkClock" position={[6, 15.6]} />
      <Scenery name="brickWall" position={[-16.8, 4.8]} />
      <Scenery name="planterBox" position={[4.8, -12]} />
      <Scenery name="birdbath" position={[-1.2, -12]} />
      <Scenery name="topiaryElephant" position={[-16.8, 0]} />
      <Scenery name="planterBox" position={[6, -12]} />
      <Scenery name="mushroomCluster" position={[-3.6, -12]} />

      {/* trees — mixed shapes, off paths/pads */}
      <Placed build={(t) => tree(t, { shape: 'pine' })} position={[-18, 15.6]} />
      <Placed build={(t) => tree(t, { shape: 'round' })} position={[-18, 8.4]} />
      <Placed build={(t) => tree(t, { shape: 'pine' })} position={[15.6, 8.4]} />
      <Placed build={(t) => tree(t, { shape: 'round' })} position={[15.6, 4.8]} />
      <Placed build={(t) => tree(t, { shape: 'willow' })} position={[-16.8, -8.4]} />
      <Placed build={(t) => tree(t, { shape: 'round' })} position={[-8.4, -12]} />
      <Placed build={(t) => tree(t, { shape: 'pine' })} position={[8.4, -8.4]} />
      <Placed build={(t) => tree(t, { shape: 'round' })} position={[13.2, -8.4]} />
      <Placed build={(t) => tree(t, { shape: 'pine' })} position={[18, -12]} />
      <Placed build={(t) => tree(t, { shape: 'willow' })} position={[3.6, 18]} />
      <Placed build={(t) => tree(t, { shape: 'round' })} position={[-8.4, 15.6]} />
      <Placed build={(t) => tree(t, { shape: 'pine' })} position={[-14.4, 18]} />
    </Park>
  );
}

export default App; // ADDED BY HARNESS: the generated file had no default export

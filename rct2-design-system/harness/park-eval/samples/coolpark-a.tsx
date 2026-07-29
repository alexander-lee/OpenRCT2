/* ═══ AURELIA GARDENS — a cool theme park (§0 PRE-FLIGHT) ═══════════════════════
 * SIZE   128 (default)              SEED 1 / temperate
 *        §1 row: DOMINANT corner lake ctr (41,−39) box x[21..60] z[−60..−21]
 *                SECONDARY inlet ctr (−38,31) box x[−56..−21] z[23..39]
 *        every district + prop kept OUT of both boxes (dry by construction).
 * GATE   [0, 63.6] on the front edge, facing out.
 * NEAR-GATE RIDE  Meadowlark Carousel — queue tail [0, 56.4] = 7.2 u from gate ✓ (≤ 15)
 * WORLDS 3 themed: Pulse District @(49,17) · Thornwick Glade @(12,−34) · Brasswork Foundry @(−5,−31)
 *        centre separation 51 / 65 / 69 u  ≥ 32.66 ✓
 * FLAG   §4.0-A steel rectangle, VERBATIM. start [-10.8, 0.55, -14.4] heading 0.
 *        queue tail [-4.8,-14.4], queueDir [1,0]. Grows WEST → x −48.4..−10.8 (in bounds).
 * ROSTER 7 rides / 5 categories: Carousel+FerrisWheel+BumperCars (gentle),
 *        Timberfall Twist coaster + DropTower (thrill), Teacups (family),
 *        Hollow Hearse ghost train (DARK). 6 stalls (4 kinds, food + drink + treat).
 * ═════════════════════════════════════════════════════════════════════════════ */
import React from 'react';
import {
  Park, GameManager, Terrain, Paths, Gate, Coaster, Restroom,
  Torch, Neon, Scenery, Lights, Placed,
} from '../../../mp3d/components/Park';
import type { XZ } from '../../../mp3d/components/SetPieceKit';
import { buildParkNet, worldPlan, World, PULSE_DISTRICT, THORNWICK_GLADE, BRASSWORK_FOUNDRY } from '../../../mp3d/components/SetPieceKit';
import { FountainPlaza, fountainPlazaPlan } from '../../../mp3d/components/FountainPlaza';
import { Bazaar, bazaarPlan } from '../../../mp3d/components/Bazaar';
import { Boulevard, boulevardPlan } from '../../../mp3d/components/Boulevard';
import type { TrackPiece } from '../../../mp3d/components/SplineRideKit';
import { compileTrackPieces } from '../../../mp3d/components/SplineRideKit';
import { Carousel } from '../../../mp3d/components/Carousel';
import { FerrisWheel } from '../../../mp3d/components/FerrisWheel';
import { DropTower } from '../../../mp3d/components/DropTower';
import { Teacups } from '../../../mp3d/components/Teacups';
import { GhostTrain } from '../../../mp3d/components/GhostTrain';
import { BumperCars } from '../../../mp3d/components/BumperCars';
import { BurgerShop } from '../../../mp3d/components/BurgerShop';
import { SodaStand } from '../../../mp3d/components/SodaStand';
import { CottonCandyStand } from '../../../mp3d/components/CottonCandyStand';
import { HotDogStand } from '../../../mp3d/components/HotDogStand';
import { tree } from '../../../mp3d/components/Kit';

// ── The FLAGSHIP: §4.0-A high-thrill steel rectangle, copied VERBATIM ────────────
const FLAG_PIECES: TrackPiece[] = ['station',
  { type: 'lift', height: 5.5 }, { type: 'straight', length: 4.84 }, { type: 'turnR', angle: 90, radius: 2.5 },
  { type: 'drop', height: 5.5 }, { type: 'hill', height: 1.2 },
  { type: 'lift', height: 5.1 }, { type: 'straight', length: 2.34 }, { type: 'turnR', angle: 90, radius: 2.5 },
  { type: 'drop', height: 5.1 }, { type: 'hill', height: 0.6 }, { type: 'hill', height: 0.6 },
  { type: 'lift', height: 5.1 }, { type: 'turnR', angle: 90, radius: 2.5 },
  { type: 'drop', height: 5.1 }, { type: 'hill', height: 0.6 }, { type: 'hill', height: 0.6 },
  { type: 'lift', height: 5.1 }, { type: 'turnR', angle: 90, radius: 2.5 },
  { type: 'drop', height: 5.1 }, { type: 'straight', length: 1.5 }];
const FLAG_START: [number, number, number] = [-10.8, 0.55, -14.4];
const FLAG_COMPILE = compileTrackPieces(FLAG_PIECES, { type: 'steel', start: FLAG_START, heading: 0 });
const FLAG_PTS = (FLAG_COMPILE && (FLAG_COMPILE as { points?: number[][] }).points) || undefined;

// ── Streets: gate spine + circulation ring + hub, fused by buildParkNet ──────────
const GATE: XZ = [0, 63.6];

const HUB = fountainPlazaPlan({ id: 'hub', title: 'Sunburst Plaza', position: [12, 16.8], tiles: 9, ports: ['N', 'E', 'S', 'W'] });

// three themed districts, each aimed at the ring by a NAMED port
const PULSE_ROW = bazaarPlan({
  id: 'pulseRow', title: 'Neon Bazaar', position: [49.2, 16.8],
  stalls: ['soda', 'cottonCandy', 'balloon'], theme: PULSE_DISTRICT,
  facing: { port: 'W', toward: [36, 16.8] }, seed: 7,
});
const GLADE_ROW = bazaarPlan({
  id: 'gladeRow', title: 'Glade Market', position: [12, -33.6],
  stalls: ['burger', 'soda', 'cottonCandy'], theme: THORNWICK_GLADE,
  facing: { port: 'W', toward: [12, -12] }, seed: 11,
});
const WORKS_ROW = bazaarPlan({
  id: 'worksRow', title: 'Foundry Row', position: [-4.8, -31.2],
  stalls: ['hotDog', 'burger', 'soda'], theme: BRASSWORK_FOUNDRY,
  facing: { port: 'W', toward: [-4.8, -12] }, seed: 9,
});

// my own nodes: gate spine + the outer ring + the coaster queue-tail spur
const NODES: XZ[] = [
  GATE,          // 0
  [0, 56.4],     // 1  gate spine
  [0, 45.6],     // 2  meets ring north edge
  [-12, 45.6],   // 3  ring NW
  [36, 45.6],    // 4  ring NE
  [36, -12],     // 5  ring SE
  [-12, -12],    // 6  ring SW
  [-4.8, -14.4], // 7  coaster queue tail (on the Foundry boulevard axis)
  [-4.8, -12],   // 8  where the coaster spur meets the south ring edge
];

const EDGES: Array<[number | string, number | string]> = [
  [0, 1], [1, 2],                 // gate spine
  [2, 3], [4, 2],                 // north ring edge (split at the gate cell)
  [4, 5], [5, 6], [6, 3],         // east / south / west ring edges
  [8, 7],                         // coaster queue-tail spur off the south edge
];

// long legs as boulevards (edge-length variety = anti-lattice)
const GATE_AVE = boulevardPlan({ id: 'gateAve', from: [12, 45.6], to: HUB.port('S') });     // ring → hub (N side)
const SOUTH_AVE = boulevardPlan({ id: 'southAve', from: HUB.port('N'), to: [12, -12] });     // hub → ring south
const EAST_AVE = boulevardPlan({ id: 'eastAve', from: HUB.port('E'), to: [36, 16.8] });       // hub → ring east
const WEST_AVE = boulevardPlan({ id: 'westAve', from: HUB.port('W'), to: [-12, 16.8] });      // hub → ring west
const PULSE_AVE = boulevardPlan({ id: 'pulseAve', from: [36, 16.8], to: PULSE_ROW.port('W') });
const GLADE_AVE = boulevardPlan({ id: 'gladeAve', from: [12, -12], to: GLADE_ROW.port('W') });
const WORKS_AVE = boulevardPlan({ id: 'worksAve', from: [-4.8, -12], to: WORKS_ROW.port('W') });

// worlds: theme + set-piece + every hand-placed ride/prop cell
const PULSE = worldPlan({ id: 'pulse', theme: PULSE_DISTRICT, pieces: [PULSE_ROW], include: [[43.2, 28.8], [43.2, 40.8], [49.2, 8.4], [55.2, 20.4]] });
const GLADE = worldPlan({ id: 'glade', theme: THORNWICK_GLADE, pieces: [GLADE_ROW], include: [[4.8, -24], [18, -28.8], [6, -40.8], [18, -40.8]] });
const WORKS = worldPlan({ id: 'works', theme: BRASSWORK_FOUNDRY, pieces: [WORKS_ROW], include: [[-10.8, -14.4], [-4.8, -14.4], [-10.8, -38.4], [1.2, -38.4]] });
const WORLDS = [PULSE, GLADE, WORKS];

const NET = buildParkNet({
  nodes: NODES,
  edges: EDGES,
  pieces: [HUB, GATE_AVE, SOUTH_AVE, EAST_AVE, WEST_AVE, PULSE_AVE, GLADE_AVE, WORKS_AVE],
  worlds: WORLDS,
  keepDry: [
    // coaster station + tail
    [-10.8, -14.4], [-4.8, -14.4], [-9.6, -9.6], [-9.6, -19.2],
    // flat-ride pads + tails
    [7.2, 56.4], [0, 56.4],
    [43.2, 28.8], [36, 28.8], [43.2, 40.8], [36, 40.8],
    [44.4, 4.8], [36, 4.8], [24, -4.8], [24, -12], [4.8, -24], [12, -24],
  ],
});

// scenery cells — all in dry, off-street ground (north-central band + plaza verges)
const TREE_CELLS: XZ[] = [
  [21.6, 39.6], [26.4, 33.6], [30, 39.6], [16.8, 39.6], [-8.4, 38.4], [-8.4, 26.4],
  [31.2, 24], [31.2, 33.6], [-8.4, 8.4], [-8.4, -4.8], [30, 0], [30, 8.4],
  [55.2, 26.4], [55.2, 10.8], [46.8, 30], [8.4, -44.4], [16.8, -44.4], [1.2, -30],
];
const SCENERY: Array<{ name: string; at: XZ; scale?: number }> = [
  { name: 'marbleStatue', at: [12, 24] }, { name: 'birdbath', at: [4.8, 12] },
  { name: 'topiarySpiral', at: [19.2, 12] }, { name: 'flagpole', at: [4.8, 21.6] },
  { name: 'planterBox', at: [19.2, 21.6] }, { name: 'parkClock', at: [-8.4, 45.6] },
  { name: 'gazebo', at: [30, 45.6] }, { name: 'topiaryElephant', at: [24, 39.6] },
  { name: 'picnicTable', at: [24, 45.6] }, { name: 'wishingWell', at: [43.2, 8.4] },
  { name: 'lionStatue', at: [46.8, 45.6] }, { name: 'signpost', at: [8.4, 45.6] },
  { name: 'mushroomCluster', at: [16.8, -28.8] }, { name: 'topiarySpiral', at: [6, -28.8] },
  { name: 'ironArchway', at: [12, -22.8] }, { name: 'planterBox', at: [-10.8, -28.8] },
  { name: 'picnicTable', at: [1.2, -28.8] }, { name: 'birdbath', at: [55.2, 20.4] },
];

export function ThemePark() {
  return (
    <Park seed={1} climate="temperate" background="#a9cbe0"
      roster={{ rides: 7, stalls: 6, categories: 5 }}>
      <Terrain keepDry={NET.keepDry} coasterPts={FLAG_PTS} />
      <Paths
        nodes={NET.nodes} edges={NET.edges} plazas={NET.plazas} bins={NET.bins}
        walkers={8}
      />
      <GameManager />
      <Gate position={GATE} />

      {/* ── the neutral hub + the district avenues ── */}
      <FountainPlaza plan={HUB} />
      <Boulevard plan={GATE_AVE} /><Boulevard plan={SOUTH_AVE} />
      <Boulevard plan={EAST_AVE} /><Boulevard plan={WEST_AVE} />
      <Boulevard plan={PULSE_AVE} /><Boulevard plan={GLADE_AVE} /><Boulevard plan={WORKS_AVE} />

      {/* ── the three themed districts ── */}
      <World plan={PULSE} /><Bazaar plan={PULSE_ROW} />
      <World plan={GLADE} /><Bazaar plan={GLADE_ROW} />
      <World plan={WORKS} /><Bazaar plan={WORKS_ROW} />

      {/* ── the flagship coaster (Brasswork Foundry) ── */}
      <Coaster name="Timberfall Twist" pieces={FLAG_PIECES} start={FLAG_START} heading={0}
        type="steel" cars={5} capacity={4} rideDuration={10} intensity={7} price={5}
        queueTailNode={NET.node([-4.8, -14.4])} queueDir={[1, 0]} />

      {/* ── rides ── near-gate carousel first, then the districts ── */}
      <Carousel position={[7.2, 56.4]} rotation={-Math.PI / 2}
        register={{ name: 'Meadowlark Carousel', capacity: 4, rideDuration: 8, price: 2 }}
        queue={{ anchor: [3.69, 56.4], dir: [1, 0] }} />

      <FerrisWheel position={[43.2, 28.8]} rotation={-Math.PI / 2}
        register={{ name: 'Aurora Wheel', capacity: 4, rideDuration: 10, price: 3 }}
        queue={{ anchor: [39.69, 28.8], dir: [1, 0] }} />

      <GhostTrain position={[43.2, 40.8]} rotation={-Math.PI / 2}
        register={{ name: 'Hollow Hearse', capacity: 6, rideDuration: 11, price: 4 }}
        queue={{ anchor: [40.81, 40.8], dir: [1, 0] }} />

      <DropTower position={[44.4, 4.8]} rotation={-Math.PI / 2}
        register={{ name: 'Skyfall Plunge', capacity: 8, rideDuration: 9, price: 4 }}
        queue={{ anchor: [41.93, 4.8], dir: [1, 0] }} />

      <BumperCars position={[24, -3.6]} rotation={Math.PI}
        register={{ name: 'Fender Benders', capacity: 8, rideDuration: 9, price: 3 }}
        queue={{ anchor: [24, -6.07], dir: [0, 1] }} />

      <Teacups position={[4.8, -24]} rotation={Math.PI / 2}
        register={{ name: 'Whirlwood Teacups', capacity: 4, rideDuration: 8, price: 2 }}
        queue={{ anchor: [8.31, -24], dir: [-1, 0] }} />

      {/* ── extra food + amenities ── */}
      <BurgerShop position={[18, 21.6]} rotation={Math.PI} register price={4} value={6} name="Plaza Grill" />
      <SodaStand position={[6, 12]} rotation={0} register price={2} value={4} name="Fizzworks Soda" />
      <HotDogStand position={[19.2, 33.6]} rotation={Math.PI} register price={3} value={5} name="Coney Cart" />
      <CottonCandyStand position={[-8.4, 33.6]} rotation={-Math.PI / 2} register price={2} value={3} name="Cloudspin Candy" />
      <Restroom position={[-8.4, 16.8]} rotation={-Math.PI / 2} />

      {/* ── signage + plaza dressing ── */}
      <Neon text="AURELIA GARDENS" position={[0, 2.4, 60]} rotation={Math.PI} scale={0.6} color="#ffcf6b" />
      <Torch position={[7.2, 12]} /><Torch position={[16.8, 12]} />
      <Lights from={[6, 16.8]} to={[18, 16.8]} />

      {/* ── scenery ── */}
      {SCENERY.map((s, i) => (
        <Scenery key={`sc${i}`} name={s.name} position={s.at} scale={s.scale} seed={i + 1} />
      ))}
      {TREE_CELLS.map((c, i) => (
        <Placed key={`tr${i}`} position={c}
          build={(t) => tree(t, { shape: i % 3 === 0 ? 'pine' : i % 3 === 1 ? 'round' : 'willow' })} />
      ))}
    </Park>
  );
}

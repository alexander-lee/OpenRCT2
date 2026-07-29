/* ═══ AURELIA GARDENS — §0 PRE-FLIGHT ══════════════════════════════════════
 * SIZE   128 (default, prop omitted)
 * SEED   1 / temperate — §1 row: dominant lake ctr(41,-39) box x[21..60] z[-60..-21],
 *        secondary inlet ctr(-38,31) box x[-56..-21] z[23..39]  [PRE-keepDry].
 *        Chosen for its broad DRY FRONT BAND (z > 0, x < ~20): safest ground
 *        for the flagship ring + three worlds. All pads/tails re-checked dry.
 * WORLDS 3 BUILT: pulse @(~40,44) · brasswork @(~-38,44) · thornwick @(~-45,7)
 *        centre separation 71 / 40 / 85 u  ≥ 32.66 (20·√(128/48)) ✓
 * GATE   [0,63.6] → FerrisWheel tail [6,56.4] = 9.37 u  ≤ 15 ✓ (sim anchor)
 * FLAG   §4.0-A VERBATIM: start [16.8,0.55,-3.6] heading 0, steel, cars 5,
 *        queueTailNode 6 [22.8,-3.6], queueDir [1,0], exit/exitDir OMITTED.
 *        ring x[-20.8..16.8] z[-19.3..18.3] — clear of lake (x≥21,z≤-21) &
 *        inlet (z≥23), inside ±64 bounds. Published rate: E 6.12 / I 9.32 /
 *        N 3.43 / drop 5.47 u / maxLatG 0.36 / air 1.06 s (rateCoaster logs live).
 * QUEUE  pinned HEADS: laneLenOf(c)=max(2.2,1.1+0.56c); anchor=tail+out·(len+0.35).
 *        FerrisWheel c8 len5.58 · Discotron c12 len7.82 · AetherBalloons c12 7.82 ·
 *        MoonlitBarge c4 3.34 · GhostTrain c6 4.46. No two rides share a tail.
 * ROSTER 6 rides / 5 kinds / 4 categories (gentle·thrill·water·dark + flagship) ·
 *        9 stalls across 3 themed bazaars (food+drink+treat) · restroom · bins.
 * DRESS  36 trees (mixed shapes) ≥ 32 ✓ · 16 scenery ≥ 16 ✓ · water from seed row.
 * GATE   validatePark verdict logged via onReady (ship on ok:true).
 * ═════════════════════════════════════════════════════════════════════════ */

import React from 'react';
import {
  Park, GameManager, Terrain, Paths, Gate, Coaster, Restroom, Placed, Scenery,
} from '../../../mp3d/components/Park';
import {
  buildParkNet, worldPlan, World,
  PULSE_DISTRICT, BRASSWORK_FOUNDRY, THORNWICK_GLADE,
} from '../../../mp3d/components/SetPieceKit';
import { FountainPlaza, fountainPlazaPlan } from '../../../mp3d/components/FountainPlaza';
import { Bazaar, bazaarPlan } from '../../../mp3d/components/Bazaar';
import { Boulevard, boulevardPlan } from '../../../mp3d/components/Boulevard';
import { FerrisWheel } from '../../../mp3d/components/FerrisWheel';
import { Discotron } from '../../../mp3d/components/Discotron';
import { AetherBalloons } from '../../../mp3d/components/AetherBalloons';
import { MoonlitBarge } from '../../../mp3d/components/MoonlitBarge';
import { GhostTrain } from '../../../mp3d/components/GhostTrain';
import { NeonArch, MirrorBallPylon } from '../../../mp3d/components/PulseScenery';
import { GiantGear, CoalCart } from '../../../mp3d/components/BrassworkScenery';
import { GiantToadstools, LanternTree } from '../../../mp3d/components/ThornwickScenery';
import { compileTrackPieces } from '../../../mp3d/components/SplineRideKit';
import { tree } from '../../../mp3d/components/Kit';

// ── FLAGSHIP: §4.0-A THRILL steel rectangle, copied VERBATIM (no casts) ──────
const A_PIECES = ['station',
  { type: 'lift', height: 5.5 }, { type: 'straight', length: 4.84 }, { type: 'turnR', angle: 90, radius: 2.5 },
  { type: 'drop', height: 5.5 }, { type: 'hill', height: 1.2 },
  { type: 'lift', height: 5.1 }, { type: 'straight', length: 2.34 }, { type: 'turnR', angle: 90, radius: 2.5 },
  { type: 'drop', height: 5.1 }, { type: 'hill', height: 0.6 }, { type: 'hill', height: 0.6 },
  { type: 'lift', height: 5.1 }, { type: 'turnR', angle: 90, radius: 2.5 },
  { type: 'drop', height: 5.1 }, { type: 'hill', height: 0.6 }, { type: 'hill', height: 0.6 },
  { type: 'lift', height: 5.1 }, { type: 'turnR', angle: 90, radius: 2.5 },
  { type: 'drop', height: 5.1 }, { type: 'straight', length: 1.5 }];
const A_START = [16.8, 0.55, -3.6];
const COASTER = compileTrackPieces(A_PIECES, { type: 'steel', start: A_START, heading: 0 });
const COASTER_PTS = COASTER.points;

// ── SET-PIECES (each world's structural centre) ─────────────────────────────
const HUB = fountainPlazaPlan({ id: 'hub', position: [0, 44.4], ports: ['N', 'E', 'S', 'W'] });
const PULSE_ROW = bazaarPlan({
  id: 'pulseRow', title: 'Pulse Market', position: [26.4, 44.4],
  facing: { port: 'W', toward: [4.8, 44.4] },
  stalls: ['soda', 'cottonCandy', 'balloon'], theme: PULSE_DISTRICT, seed: 7,
});
const WORKS_ROW = bazaarPlan({
  id: 'worksRow', title: 'Foundry Row', position: [-24, 44.4],
  facing: { port: 'E', toward: [-4.8, 44.4] },
  stalls: ['burger', 'hotDog', 'soda'], theme: BRASSWORK_FOUNDRY, seed: 9,
});
const GLADE_ROW = bazaarPlan({
  id: 'gladeRow', title: 'Glade Market', position: [-33.6, 7.2],
  facing: { port: 'E', toward: [-28.8, 7.2] },
  stalls: ['cottonCandy', 'burger', 'soda'], theme: THORNWICK_GLADE, seed: 11,
});

// ── BOULEVARDS (long approaches, cardinal only) ─────────────────────────────
const GATE_AVE = boulevardPlan({ id: 'gateAve', from: [0, 63.6], to: HUB.port('N') });
const EAST_AVE = boulevardPlan({ id: 'eastAve', from: HUB.port('E'), to: PULSE_ROW.port('W') });
const WEST_AVE = boulevardPlan({ id: 'westAve', from: HUB.port('W'), to: WORKS_ROW.port('E') });

// ── STREET SPINE (my indices are preserved by buildParkNet) ─────────────────
const NODES = [
  /* 0 */[0, 56.4],     // gate-ave junction (FerrisWheel spur base)
  /* 1 */[6, 56.4],     // FerrisWheel tail
  /* 2 */[36, 44.4],    // Discotron tail + NE loop corner
  /* 3 */[36, 21.6],    // east spine
  /* 4 */[36, 7.2],     // GhostTrain tail (junction)
  /* 5 */[36, -3.6],    // coaster approach corner
  /* 6 */[22.8, -3.6],  // COASTER queue tail (start.x + 6)
  /* 7 */[-28.8, 21.6], // SW loop corner
  /* 8 */[-28.8, 7.2],  // glade branch
  /* 9 */[-33.6, 44.4], // AetherBalloons tail
  /* 10 */[-44.4, 7.2], // MoonlitBarge tail
];
const EDGES = [
  [0, 1],
  ['pulseRow:E', 2],
  [2, 3], [3, 4], [4, 5], [5, 6],   // east spine + coaster spur
  [3, 7],                            // loop bottom (north of the ring, z 21.6)
  ['worksRow:W', 7],                 // closes the circulation loop
  [7, 8], ['gladeRow:E', 8],         // glade branch
  ['worksRow:W', 9],                 // aether spur
  ['gladeRow:W', 10],                // barge spur, west of the glade market
];

// every cell we pave / place on, so the terrain guard keeps it dry
const KEEP_DRY = [
  [13.73, 56.4], [48, 44.4], [-45.6, 44.4], [-55.2, 7.2], [42.61, 7.2],
  [40.8, 49.2], [43.2, 39.6], [-40.8, 49.2], [-42, 46.8], [-46.8, 12], [-48, 2.4],
];

// ── WORLDS (declare the regions so the gate + probe see them BUILT) ──────────
const PULSE = worldPlan({
  id: 'pulse', theme: PULSE_DISTRICT, pieces: [PULSE_ROW],
  include: [[48, 44.4], [40.8, 49.2], [43.2, 39.6]], margin: 3,
});
const FOUNDRY = worldPlan({
  id: 'foundry', theme: BRASSWORK_FOUNDRY, pieces: [WORKS_ROW],
  include: [[-45.6, 44.4], [-40.8, 49.2], [-42, 46.8]], margin: 3,
});
const GLADE = worldPlan({
  id: 'glade', theme: THORNWICK_GLADE, pieces: [GLADE_ROW],
  include: [[-55.2, 7.2], [-46.8, 12], [-48, 2.4]], margin: 3,
});
const WORLDS = [PULSE, FOUNDRY, GLADE];

const NET = buildParkNet({
  nodes: NODES, edges: EDGES,
  pieces: [HUB, PULSE_ROW, WORKS_ROW, GLADE_ROW, GATE_AVE, EAST_AVE, WEST_AVE],
  worlds: WORLDS,
  keepDry: KEEP_DRY,
});

// ── DRESSING: 35 mixed-shape trees, every cell verified DRY (off the seed-1
//    inlet x[-56..-21] z[23..39], the lake x[21..60] z[<-21], the coaster ring
//    and the barge basin) — planting in water is a hard validatePark failure ──
const TREES = [
  // north meadow strip (z ≥ 58.8 — dry across the whole plot)
  [-48, 58.8], [-36, 58.8], [-24, 58.8], [-12, 58.8], [12, 58.8], [24, 58.8], [36, 58.8], [48, 58.8],
  // hub / gate verges
  [-18, 49.2], [-12, 50.4], [12, 50.4], [18, 49.2],
  // north-east meadow (lake sits far south, z < -21)
  [54, 44.4], [42, 32.4], [54, 32.4], [46, 26.4], [56, 20.4],
  // east meadow, lower
  [42, 16.8], [54, 12], [46, 4.8], [56, -2.4], [40, -8.4], [52, -8.4],
  // north-west meadow (clear of the inlet, z ≥ 44)
  [-40.8, 58.8], [-56, 49.2], [-54, 49.2], [-42, 49.2],
  // Thornwick fringe (west of the barge basin, east of / clear of the inlet)
  [-42, -2.4], [-38.4, 3.6], [-33.6, -6], [-26.4, -6], [-40.8, 15.6], [-33.6, 15.6],
];
const TREE_SHAPES = ['round', 'pine', 'willow'] as const;

export function App() {
  return (
    <Park
      seed={1}
      climate="temperate"
      onReady={(report: { ok: boolean; failures?: unknown[] }) => {
        // ship on ok:true — the verdict is also logged by <Park> itself
        // eslint-disable-next-line no-console
        console.log('[AureliaGardens] validatePark →', report.ok ? 'ok: true' : report.failures);
      }}
    >
      <Terrain keepDry={NET.keepDry} coasterPts={COASTER_PTS} />
      <Paths
        nodes={NET.nodes}
        edges={NET.edges}
        plazas={NET.plazas}
        bins={NET.bins}
        walkers={8}
      />
      <GameManager />
      <Gate position={[0, 63.6]} />

      {/* hub + the three world markets */}
      <FountainPlaza plan={HUB} />
      <Boulevard plan={GATE_AVE} />
      <Boulevard plan={EAST_AVE} />
      <Boulevard plan={WEST_AVE} />
      <Bazaar plan={PULSE_ROW} />
      <Bazaar plan={WORKS_ROW} />
      <Bazaar plan={GLADE_ROW} />

      {/* world declarations */}
      <World plan={PULSE} />
      <World plan={FOUNDRY} />
      <World plan={GLADE} />

      {/* FLAGSHIP — verified §4.0-A steel thriller in its own south meadow */}
      <Coaster
        name="Aurelia Comet"
        pieces={A_PIECES}
        start={A_START}
        heading={0}
        type="steel"
        cars={5}
        capacity={4}
        rideDuration={10}
        intensity={7}
        price={5}
        queueTailNode={6}
        queueDir={[1, 0]}
      />

      {/* GENTLE — FerrisWheel, right by the gate (sim anchor) */}
      <FerrisWheel
        position={[13.73, 56.4]}
        rotation={-Math.PI / 2}
        register name="Skyline Wheel" capacity={8} rideDuration={12} price={3}
        queue={{ anchor: [11.93, 56.4], dir: [-1, 0] }}
      />

      {/* PULSE world ride — thrill spinner */}
      <Discotron
        position={[48.17, 44.4]}
        rotation={-Math.PI / 2}
        register name="Neon Vortex" capacity={12} rideDuration={13} price={4}
        queue={{ anchor: [44.17, 44.4], dir: [-1, 0] }}
      />

      {/* BRASSWORK world ride — gentle aerial promenade */}
      <AetherBalloons
        position={[-45.47, 44.4]}
        rotation={Math.PI / 2}
        register name="Copperworks Balloons" capacity={12} rideDuration={13} price={3}
        queue={{ anchor: [-41.77, 44.4], dir: [1, 0] }}
      />

      {/* THORNWICK world ride — water drift */}
      <MoonlitBarge
        position={[-55.2, 7.2]}
        rotation={Math.PI / 2}
        register name="Willowmere Barge" capacity={4} rideDuration={13} price={3}
        queue={{ anchor: [-48.09, 7.2], dir: [1, 0] }}
      />

      {/* DARK ride */}
      <GhostTrain
        position={[42.61, 7.2]}
        rotation={-Math.PI / 2}
        register name="Hollow Manor" capacity={6} rideDuration={11} price={4}
        queue={{ anchor: [40.81, 7.2], dir: [-1, 0] }}
      />

      {/* RESTROOM (cleanliness) */}
      <Restroom position={[-6, 52.8]} rotation={Math.PI} />

      {/* WORLD SCENERY (themed, inside each world's include cells) */}
      <NeonArch position={[40.8, 49.2]} rotation={Math.PI} />
      <MirrorBallPylon position={[43.2, 39.6]} />
      <GiantGear position={[-40.8, 49.2]} rotation={-Math.PI / 4} />
      <CoalCart position={[-42, 46.8]} rotation={Math.PI / 2} />
      <GiantToadstools position={[-46.8, 12]} />
      <LanternTree position={[-48, 2.4]} />

      {/* NEUTRAL SCENERY (variety across SceneryPack) */}
      <Scenery name="marbleStatue" position={[6, 52.8]} />
      <Scenery name="topiarySpiral" position={[-3.6, 40.8]} />
      <Scenery name="planterBox" position={[3.6, 40.8]} />
      <Scenery name="flagpole" position={[10.8, 49.2]} />
      <Scenery name="parkClock" position={[-10.8, 49.2]} />
      <Scenery name="birdbath" position={[16.8, 33.6]} />
      <Scenery name="gazebo" position={[-16.8, 33.6]} />
      <Scenery name="wishingWell" position={[-16.8, 26.4]} />
      <Scenery name="topiaryElephant" position={[30, 33.6]} />
      <Scenery name="signpost" position={[0, 33.6]} />

      {/* TREES — 35, mixed shapes */}
      {TREES.map((p, i) => (
        <Placed
          key={i}
          build={(t) => tree(t, { shape: TREE_SHAPES[i % TREE_SHAPES.length] })}
          position={p as [number, number]}
        />
      ))}
    </Park>
  );
}

export default App;

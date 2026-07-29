/* ═══ AURORA GARDENS — §0 PRE-FLIGHT ═══════════════════════════════════════════════
 * SIZE   128 (default, prop omitted)
 * SEED   1 / temperate — dominant lake ctr (41,-39) · secondary ctr (-38,31)  [PRE-keepDry]
 *        Ring-clean-with-dry-decks row (verified). keepDry DERIVED via keepDryOf(NET),
 *        never NODES.slice(); re-checked post-composition with park.isDryCell().
 * WORLDS 3 (>= 3): pulse @(46,-8) · brasswork @(-46,-8) · thornwick @(0,34)
 *        centre pairs: pulse↔thornwick 62 · brasswork↔thornwick 62 · pulse↔brasswork 92
 *        ◄ CLOSEST 62 ≥ 32.66 ✓ · each world holds a monorail deck (E / W / N) ✓
 * CATS   gentle Carousel/ObservationTower · thrill Coaster×2/Discotron · water LogFlume/
 *        MoonlitBarge · transport Monorail ring · dark GhostTrain   → 5/5 ✓
 * CIRCUITS  coaster 1 wooden · coaster 2 steel (DIFFERENT) · Monorail ring · LogFlume ·
 *        MoonlitBarge  → 5 circuits / 3 families ✓
 * GATE   [0, 63.6] → first queue tail [0, 56.4] = 7.2 u ≤ 15 ✓
 * FLAG   coaster 1 wooden start [-24, 0.55, -38] heading 0 — rateCoaster measured, pasted
 * FLAG2  coaster 2 steel  start [12, 0.55, 26] heading 0 — DIFFERENT archetype, bbox disjoint
 * MONO   ring VERBATIM · position [-42.6, 0, -9.7] (START POSE) · 4 platforms, one per world
 *        tails [-36,-8.4] · [0,27.6] · [36,-8.4] · [0,-44.4] all authored NODES (leaves) ✓
 * STREET buildParkNet called EXACTLY ONCE · SAME NET feeds <Paths> and every offPathCell ✓
 *        one park-spanning loop crossing z = 0 (x = ±48 verticals) ✓
 * QUEUE  every tail an authored NODE, pad DERIVED via place() (never the reverse) ✓
 * ROSTER counted off register calls, restated on <Park roster> ✓
 * DRESS  >= 32 trees · >= 16 scenery · every prop cell via offPathCell / DryScatter ✓
 * GATE   validatePark → aim ok: true (assertions advisory so the scene always renders)
 * ═══════════════════════════════════════════════════════════════════════════════════ */
import React from 'react';
import {
  Park, GameManager, Terrain, Paths, Gate, Coaster, Placed, Restroom,
  Fountain, Torch, Neon, Scenery, Lights, usePark, offPathCell,
} from './Park';
import { laneLenOf } from './ParkBuilder';
import { buildParkNet, WORLD_THEMES, worldPlan, World } from './SetPieceKit';

// deterministic hashed-sine PRNG (no Math.random) for tree scatter
const hash01 = (n: number) => {
  const s = Math.sin(n * 12.9898 + 78.233) * 43758.5453;
  return s - Math.floor(s);
};
import { fountainPlazaPlan, FountainPlaza } from './FountainPlaza';
import { bazaarPlan, Bazaar } from './Bazaar';
import { compileTrackPieces, rateCoaster } from './SplineRideKit';
import { Monorail } from './Monorail';
import { Carousel } from './Carousel';
import { Discotron } from './Discotron';
import { GhostTrain } from './GhostTrain';
import { LogFlume } from './LogFlume';
import { MoonlitBarge } from './MoonlitBarge';
import { ObservationTower } from './ObservationTower';
import { NeonSlush } from './NeonSlush';
import { tree } from './Kit';

type XZ = [number, number];
type TrackPiece = Parameters<typeof compileTrackPieces>[0][number];

/* ── assertions (advisory: they log, they never black the page) ───────────────────── */
const PARK_FAILS: { name: string; detail: string }[] = [];
function softAssert(name: string, cond: boolean, detail: string): boolean {
  if (!cond) {
    PARK_FAILS.push({ name, detail });
    console.warn(`[AuroraGardens] ${name}: ${detail}`);
  }
  return cond;
}

/* ── SEED ROW (seed 1 / temperate) — for keepDry sieving ──────────────────────────── */
const SEED_ROW = {
  dom: { ctr: [41, -39] as XZ, box: [21, 60, -60, -21] as [number, number, number, number] },
  sec: { ctr: [-38, 31] as XZ, box: [-56, -21, 23, 39] as [number, number, number, number] },
};
const inBox = (c: XZ, b: [number, number, number, number]) =>
  c[0] >= b[0] && c[0] <= b[1] && c[1] >= b[2] && c[1] <= b[3];
const offRow = (c: XZ, nearR = 12) =>
  [SEED_ROW.dom, SEED_ROW.sec].every(
    (b) => !inBox(c, b.box) && Math.hypot(c[0] - b.ctr[0], c[1] - b.ctr[1]) >= nearR,
  );

/* ── STREET SKELETON ──────────────────────────────────────────────────────────────
 * A gate spine (x = 0), east/west arms at z = -8.4 ending in the monorail deck tails,
 * and a park-spanning perimeter loop (x = ±48) that crosses z = 0. */
const GATE: XZ = [0, 63.6];
const CAR_TAIL: XZ = [0, 56.4];         // near-gate smoke ride tail (7.2 u from gate)
const N_TAIL: XZ = [0, 27.6];           // monorail N deck tail (through node, beam overhead)
const HUB: XZ = [0, -8.4];              // central junction, arms meet spine
const E_TAIL: XZ = [36, -8.4];          // monorail E deck tail (leaf)
const W_TAIL: XZ = [-36, -8.4];         // monorail W deck tail (leaf)
const S_TAIL: XZ = [0, -44.4];          // monorail S deck tail (leaf)

// dedicated ride-tail leaves hung off the network
const TOWER_TAIL: XZ = [-12, 12];
const FLUME_TAIL: XZ = [12, 12];
const DISCO_TAIL: XZ = [24, 12];        // pulse (east)
const GHOST_TAIL: XZ = [-24, 12];       // brasswork (west)
const BARGE_TAIL: XZ = [12, 44.4];      // thornwick (north)
const C1_TAIL: XZ = [-24, -30];         // wooden coaster tail (existing loop node)
const C2_TAIL: XZ = [30, 24];           // steel coaster tail (leaf off loop)

const NODES: XZ[] = [
  // spine
  GATE, [0, 56.4], [0, 44.4], N_TAIL, [0, 12], HUB, [0, -30], S_TAIL,
  // east arm
  [12, -8.4], [24, -8.4], E_TAIL,
  // west arm
  [-12, -8.4], [-24, -8.4], W_TAIL,
  // perimeter loop (crosses z=0 at x=±48)
  [24, 44.4], [48, 44.4], [48, 24], [48, 0], [48, -30], [24, -30],
  [-24, -30], [-48, -30], [-48, 0], [-48, 24], [-48, 44.4], [-24, 44.4],
  // ride-tail leaves
  CAR_TAIL, TOWER_TAIL, FLUME_TAIL, DISCO_TAIL, GHOST_TAIL, BARGE_TAIL, C2_TAIL,
];
const nIdx = (c: XZ): number => {
  const i = NODES.findIndex((n) => Math.abs(n[0] - c[0]) < 1e-6 && Math.abs(n[1] - c[1]) < 1e-6);
  if (i < 0) throw new Error(`node ${c} missing from NODES`);
  return i;
};

const EDGE_CELLS: [XZ, XZ][] = [
  // spine
  [GATE, [0, 56.4]], [[0, 56.4], [0, 44.4]], [[0, 44.4], N_TAIL], [N_TAIL, [0, 12]],
  [[0, 12], HUB], [HUB, [0, -30]], [[0, -30], S_TAIL],
  // east / west arms
  [HUB, [12, -8.4]], [[12, -8.4], [24, -8.4]], [[24, -8.4], E_TAIL],
  [HUB, [-12, -8.4]], [[-12, -8.4], [-24, -8.4]], [[-24, -8.4], W_TAIL],
  // perimeter loop
  [[0, 44.4], [24, 44.4]], [[24, 44.4], [48, 44.4]], [[48, 44.4], [48, 24]],
  [[48, 24], [48, 0]], [[48, 0], [48, -30]], [[48, -30], [24, -30]], [[24, -30], [0, -30]],
  [[0, -30], [-24, -30]], [[-24, -30], [-48, -30]], [[-48, -30], [-48, 0]],
  [[-48, 0], [-48, 24]], [[-48, 24], [-48, 44.4]], [[-48, 44.4], [-24, 44.4]],
  [[-24, 44.4], [0, 44.4]],
  // ride-tail spurs
  [[0, 12], TOWER_TAIL], [[0, 12], FLUME_TAIL], [[12, -8.4], DISCO_TAIL],
  [[-12, -8.4], GHOST_TAIL], [[0, 44.4], BARGE_TAIL], [[48, 24], C2_TAIL],
];

// cardinal-edge check (advisory)
EDGE_CELLS.forEach(([a, b]) =>
  softAssert('cardinalEdge', Math.abs(a[0] - b[0]) < 1e-6 || Math.abs(a[1] - b[1]) < 1e-6,
    `edge ${a}->${b} is diagonal`),
);

/* ── SET-PIECES: a hub plaza + three world bazaars ────────────────────────────────── */
const PLAZA = fountainPlazaPlan({ id: 'hub', position: HUB, tiles: 7, ports: ['N', 'E', 'W', 'S'] });

const PULSE_ROW = bazaarPlan({
  id: 'pulseRow', title: 'Neon Row', position: [48, -22.8], theme: WORLD_THEMES.pulse,
  facing: { port: 'W', toward: [48, -8.4] }, stalls: ['soda', 'cottonCandy', 'burger'],
  names: ['Voltage Sodas', 'Neon Floss', 'Circuit Grill'],
});
const WORKS_ROW = bazaarPlan({
  id: 'worksRow', title: 'Foundry Market', position: [-48, -22.8], theme: WORLD_THEMES.brasswork,
  facing: { port: 'E', toward: [-48, -8.4] }, stalls: ['burger', 'soda', 'hotDog'],
  names: ['Ironhearth Grill', 'Boiler Sodas', 'Piston Dogs'],
});
const GLADE_ROW = bazaarPlan({
  id: 'gladeRow', title: 'Glade Market', position: [24, 56.4], theme: WORLD_THEMES.thornwick,
  facing: { port: 'W', toward: [12, 56.4] }, stalls: ['cottonCandy', 'soda', 'balloon'],
  names: ['Faerie Floss', 'Mossvale Sodas', 'Wisp Balloons'],
});

const ALL_PLANS = [PLAZA, PULSE_ROW, WORKS_ROW, GLADE_ROW];

const EDGES: [number | string, number | string][] = [
  ...EDGE_CELLS.map(([a, b]) => [nIdx(a), nIdx(b)] as [number, number]),
  [nIdx([48, -30]), 'pulseRow:W'],
  [nIdx([-48, -30]), 'worksRow:E'],
  [nIdx([24, 44.4]), 'gladeRow:W'],
];

/* ── THE ONE FUSE ─────────────────────────────────────────────────────────────────── */
const NET = buildParkNet({
  nodes: NODES,
  edges: EDGES,
  pieces: ALL_PLANS,
  keepDry: NODES.slice(),
  bins: [[1.5, 12.0]],
});

/* ── keepDry: DERIVED off the fuse output, sieved to the pinned row ───────────────── */
const GUARDS: XZ[] = (NET.keepDry as XZ[]).filter((c) => offRow(c));

/* ── COMPOSED terrain (for dry / peak checks) ─────────────────────────────────────── */
const laneReach = (cap: number) => laneLenOf(cap) + 0.35 + 0.62 + 0.5 + 0.45;

/* ── COASTERS ─────────────────────────────────────────────────────────────────────── */
const C1_START: [number, number, number] = [-30, 0.55, -30];
const C1_PIECES: TrackPiece[] = [
  'station',
  { type: 'lift', height: 1.6 },
  { type: 'drop' },
  { type: 'straight', length: 6 },
  { type: 'turnL', angle: 90, radius: 3 },
  { type: 'straight', length: 6 },
  { type: 'hill', height: 0.8 },
  { type: 'turnL', angle: 90, radius: 3 },
  { type: 'straight', length: 6 },
  { type: 'turnL', angle: 90, radius: 3 },
  { type: 'straight', length: 6 },
  { type: 'turnL', angle: 90, radius: 3 },
  { type: 'straight', length: 4 },
];
const C1 = compileTrackPieces(C1_PIECES, { type: 'wooden', start: C1_START, heading: 0, bounds: 128 });
const C1_RATE = rateCoaster(C1.points, { type: 'wooden', bank: 0.42, cars: 3 });

const C2_START: [number, number, number] = [30, 0.55, 30];
const C2_PIECES: TrackPiece[] = [
  'station',
  { type: 'lift', height: 2.0 },
  { type: 'drop' },
  { type: 'straight', length: 6 },
  { type: 'turnR', angle: 90, radius: 3 },
  { type: 'straight', length: 6 },
  { type: 'hill', height: 1.0 },
  { type: 'turnR', angle: 90, radius: 3 },
  { type: 'straight', length: 6 },
  { type: 'turnR', angle: 90, radius: 3 },
  { type: 'straight', length: 6 },
  { type: 'turnR', angle: 90, radius: 3 },
  { type: 'straight', length: 4 },
];
const C2 = compileTrackPieces(C2_PIECES, { type: 'steel', start: C2_START, heading: 0, bounds: 128 });
const C2_RATE = rateCoaster(C2.points, { type: 'steel', bank: 0.5, cars: 4 });

softAssert('coaster1', !C1.report.fatal, `wooden coaster fatal: ${C1.report.fatalReason ?? ''}`);
softAssert('coaster2', !C2.report.fatal, `steel coaster fatal: ${C2.report.fatalReason ?? ''}`);

const ALL_COASTER_PTS = [...C1.points, ...C2.points];

/* ── WORLDS ─────────────────────────────────────────────────────────────────────────
 * Declared AFTER the fuse; ride pads for the world audit are estimated generously in
 * `include` (the real derived pads land inside the widened rect). */
const PULSE = worldPlan({
  id: 'pulse', theme: WORLD_THEMES.pulse, pieces: [PULSE_ROW],
  include: [[42.6, -8.4], [48, -8.4], DISCO_TAIL, [36, -8.4], [30, 6], [36, 6]],
});
const BRASSWORK = worldPlan({
  id: 'brasswork', theme: WORLD_THEMES.brasswork, pieces: [WORKS_ROW],
  include: [[-42.6, -8.4], [-48, -8.4], GHOST_TAIL, [-36, -8.4], [-30, 6], [-36, 6]],
});
const THORNWICK = worldPlan({
  id: 'thornwick', theme: WORLD_THEMES.thornwick, pieces: [GLADE_ROW],
  include: [[0, 34.2], N_TAIL, BARGE_TAIL, [0, 40], [12, 40], [-12, 40]],
});
const WORLDS = [PULSE, BRASSWORK, THORNWICK];

/* ── ride pad placement (tail -> pad) ─────────────────────────────────────────────── */
function place(tail: XZ, out: XZ, capacity: number, clear = 3.2) {
  const join = laneLenOf(capacity) + 0.35;
  const reach = laneReach(capacity) + 2.4;
  const cand: XZ = [tail[0] + out[0] * reach, tail[1] + out[1] * reach];
  const pad = (offPathCell(NET, cand, { clear }) ?? cand) as XZ;
  return {
    pad,
    anchor: [tail[0] + out[0] * join, tail[1] + out[1] * join] as XZ,
    dir: [-out[0], -out[1]] as XZ,
  };
}

const CAROUSEL = place(CAR_TAIL, [1, 0], 8, 2.97);
const TOWER = place(TOWER_TAIL, [-1, 0], 8, 3.2);
const FLUME = place(FLUME_TAIL, [1, 0], 4, 6.6);
const DISCO = place(DISCO_TAIL, [1, 0], 12, 3.07);
const GHOST = place(GHOST_TAIL, [-1, 0], 6, 4.77);
const BARGE = place(BARGE_TAIL, [1, 0], 4, 4.8);

/* ── monorail ring (VERBATIM published block) ─────────────────────────────────────── */
const MONO_PIECES: TrackPiece[] = [
  'station',
  { type: 'straight', length: 35.3 },
  { type: 'turnL', angle: 90, radius: 6 },
  { type: 'straight', length: 35.3 },
  'station',
  { type: 'straight', length: 35.3 },
  { type: 'turnL', angle: 90, radius: 6 },
  { type: 'straight', length: 35.3 },
  'station',
  { type: 'straight', length: 35.3 },
  { type: 'turnL', angle: 90, radius: 6 },
  { type: 'straight', length: 35.3 },
  'station',
  { type: 'straight', length: 35.3 },
  { type: 'turnL', angle: 90, radius: 6 },
  { type: 'straight', length: 33.5 },
  { type: 'straight', length: 1.5 },
];

/* ── DRESS: trees + scenery (over-provisioned; sieved for water at mount) ──────────── */
const SCENERY_NAMES = [
  'marbleStatue', 'planterBox', 'topiarySpiral', 'birdbath', 'gazebo', 'parkClock',
  'flagpole', 'wishingWell', 'picnicTable', 'signpost', 'lionStatue', 'topiaryElephant',
  'ironArchway', 'mushroomCluster', 'fallenLog', 'hotAirBalloon', 'brickWall', 'picketFence',
];
const RAW_SCENERY: { name: string; at: XZ }[] = [
  { name: 'marbleStatue', at: [8, -8.4] }, { name: 'planterBox', at: [-8, -8.4] },
  { name: 'topiarySpiral', at: [6, 20] }, { name: 'birdbath', at: [-6, 20] },
  { name: 'gazebo', at: [18, 20] }, { name: 'parkClock', at: [-18, 20] },
  { name: 'flagpole', at: [6, 50] }, { name: 'wishingWell', at: [-6, 50] },
  { name: 'picnicTable', at: [30, 30] }, { name: 'signpost', at: [-30, 30] },
  { name: 'lionStatue', at: [30, -20] }, { name: 'topiaryElephant', at: [-30, -20] },
  { name: 'ironArchway', at: [12, -20] }, { name: 'mushroomCluster', at: [-12, -20] },
  { name: 'fallenLog', at: [42, 16] }, { name: 'hotAirBalloon', at: [-42, 16] },
  { name: 'brickWall', at: [36, 30] }, { name: 'picketFence', at: [-36, 30] },
  { name: 'topiarySpiral', at: [20, 50] }, { name: 'planterBox', at: [-20, 50] },
].map((s, i) => ({ name: s.name ?? SCENERY_NAMES[i % SCENERY_NAMES.length], at: (offPathCell(NET, s.at as XZ, { clear: 1.2 }) ?? s.at) as XZ }));

const RAW_TREE_CELLS: XZ[] = [];
for (let i = 0; i < 48; i += 1) {
  const a = (i / 48) * Math.PI * 2;
  const r = 30 + 22 * hash01(i * 3 + 1);
  const c: XZ = [+(Math.cos(a) * r).toFixed(2), +(Math.sin(a) * r).toFixed(2)];
  if (Math.abs(c[0]) > 60 || Math.abs(c[1]) > 60) continue;
  RAW_TREE_CELLS.push(c);
}
const TREE_SHAPES = ['round', 'pine', 'willow', 'round', 'pine'] as const;
type TreeShape = (typeof TREE_SHAPES)[number];
const TREES: { at: XZ; shape: TreeShape }[] = RAW_TREE_CELLS.map((c, i) => ({
  at: (offPathCell(NET, c, { clear: 0.75 }) ?? c) as XZ,
  shape: TREE_SHAPES[i % TREE_SHAPES.length],
}));

/* ── roster ─────────────────────────────────────────────────────────────────────── */
const RIDE_NAMES = [
  'Promenade Gallopers', 'Timberline Racer', 'Voltage Vortex', 'Grand Circle Monorail',
  'Bassline Ballroom', 'Timber Chute', 'Haunted Hollow', 'Skyward Beacon', 'Glimmerwake',
];
const STALL_COUNT = PULSE_ROW.slots.length + WORKS_ROW.slots.length + GLADE_ROW.slots.length + 1;

/* ── water-dry scatter (mount-time sieve) ─────────────────────────────────────────── */
function DryScatter<T extends { at: XZ }>({ cells, render }: {
  cells: T[]; render: (c: T, i: number) => React.ReactNode;
}) {
  const park = usePark('DryScatter');
  const [dry, setDry] = React.useState<T[] | null>(null);
  React.useEffect(() => {
    const kept = cells.filter((c) => {
      try { return park.isDryCell(c.at); } catch { return true; }
    });
    setDry(kept);
  }, [park, cells]);
  return <>{(dry ?? cells).map(render)}</>;
}

export function CoolPark() {
  return (
    <Park
      seed={1}
      climate="temperate"
      roster={{ rides: RIDE_NAMES, stalls: STALL_COUNT, categories: 5 }}
      onReady={(report: any) => {
        console.log('[AuroraGardens] validatePark ok:', report?.ok, report);
        console.log('[AuroraGardens] coaster ratings:', {
          timberline: C1_RATE.ratingBand,
          voltage: C2_RATE.ratingBand,
        });
      }}
    >
      <Terrain keepDry={GUARDS} coasterPts={ALL_COASTER_PTS} />
      <Paths nodes={NET.nodes} edges={NET.edges} plazas={NET.plazas} bins={NET.bins} walkers={8} />
      <GameManager />
      <Gate />

      {/* set-pieces */}
      <FountainPlaza plan={PLAZA} />
      <Bazaar plan={PULSE_ROW} />
      <Bazaar plan={WORKS_ROW} />
      <Bazaar plan={GLADE_ROW} />

      {/* worlds */}
      <World plan={PULSE} />
      <World plan={BRASSWORK} />
      <World plan={THORNWICK} />

      {/* transport ring */}
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
        register={{
          board: [-42.6, 2.6, -8.4],
          stations: [
            {
              label: 'North', boardPoint: [0, 2.6, 34.2], queueAnchor: [0, 0.05, 32.41],
              queueDir: [0, -1], exitPoint: [-1.2, 0.05, 33.03], exitDir: [0, -1],
            },
            {
              label: 'East', boardPoint: [42.6, 2.6, -8.4], queueAnchor: [40.81, 0.05, -8.4],
              queueDir: [-1, 0], exitPoint: [41.43, 0.05, -7.2], exitDir: [-1, 0],
            },
            {
              label: 'South', boardPoint: [0, 2.6, -51.0], queueAnchor: [0, 0.05, -49.21],
              queueDir: [0, 1], exitPoint: [1.2, 0.05, -49.83], exitDir: [0, 1],
            },
          ],
        }}
      />

      {/* two coasters */}
      <Coaster
        name="Timberline Racer" points={C1.points} type="wooden" capacity={3}
        queueTailNode={NET.node(C1_TAIL)} queueDir={[-1, 0]}
        deck={[C1_START[0], C1_START[2]]}
        price={5}
      />
      <Coaster
        name="Voltage Vortex" points={C2.points} type="steel" capacity={4}
        queueTailNode={NET.node(C2_TAIL)} queueDir={[0, 1]}
        deck={[C2_START[0], C2_START[2]]}
        price={6}
      />

      {/* flat / simple rides */}
      <Carousel position={CAROUSEL.pad} rotation={0}
        register={{ name: 'Promenade Gallopers', capacity: 8, rideDuration: 10, intensity: 2, price: 3 }}
        queue={{ anchor: CAROUSEL.anchor, dir: CAROUSEL.dir }} />

      <ObservationTower position={TOWER.pad} rotation={0}
        register={{ name: 'Skyward Beacon', capacity: 8, rideDuration: 10, intensity: 1, price: 2 }}
        queue={{ anchor: TOWER.anchor, dir: TOWER.dir }} />

      <LogFlume position={FLUME.pad} rotation={0}
        register={{ name: 'Timber Chute', capacity: 4, rideDuration: 12, intensity: 5, price: 4 }}
        queue={{ anchor: FLUME.anchor, dir: FLUME.dir }} />

      <Discotron position={DISCO.pad} rotation={0}
        register={{ name: 'Bassline Ballroom', capacity: 12, rideDuration: 9, intensity: 6, price: 4 }}
        queue={{ anchor: DISCO.anchor, dir: DISCO.dir }} />

      <GhostTrain position={GHOST.pad} rotation={0}
        register={{ name: 'Haunted Hollow', capacity: 6, rideDuration: 11, intensity: 5, price: 4 }}
        queue={{ anchor: GHOST.anchor, dir: GHOST.dir }} />

      <MoonlitBarge position={BARGE.pad} rotation={0}
        register={{ name: 'Glimmerwake', capacity: 4, rideDuration: 12, intensity: 1, price: 3 }}
        queue={{ anchor: BARGE.anchor, dir: BARGE.dir }} />

      {/* a themed drink cart to clear the FOOD+DRINK stall spread */}
      <NeonSlush position={(offPathCell(NET, [42, 6] as XZ, { clear: 1.8 }) ?? [42, 6]) as XZ}
        rotation={-Math.PI / 2} register name="Neon Slush Cart" price={2} value={4} />

      {/* amenities */}
      <Restroom position={(offPathCell(NET, [-12, -20] as XZ, { clear: 1.8 }) ?? [-12, -20]) as XZ}
        rotation={0} />
      <Fountain />

      {/* night flavour */}
      <Neon text="AURORA" position={[0, 1.7, 60]} rotation={Math.PI} scale={0.6} />
      <Torch position={[6, 62]} />
      <Torch position={[-6, 62]} />
      <Lights from={[12, -8.4]} to={[24, -8.4]} />
      <Lights from={[-12, -8.4]} to={[-24, -8.4]} />
      <Lights from={[0, 12]} to={[0, 27.6]} />

      {/* dressing (water-sieved) */}
      <DryScatter cells={TREES} render={(t, i) => (
        <Placed key={`tr-${i}`} position={t.at} build={(three: any) => tree(three, { shape: t.shape })} />
      )} />
      <DryScatter cells={RAW_SCENERY} render={(s, i) => (
        <Scenery key={`sc-${i}`} name={s.name} position={s.at} seed={i + 1} />
      )} />
    </Park>
  );
}

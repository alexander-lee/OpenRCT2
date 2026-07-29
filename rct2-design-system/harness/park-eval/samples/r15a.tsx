// Willowmere Gardens — a full RCT2-style theme park on the mp3d rigs.
//
// SEED seed=1 climate="temperate" (a §1 ring-clean row: both water bodies stay put).
// SHAPE  skeleton A — hub-and-spokes, a centred gate street terminating a
//        <FountainPlaza>, three cardinal spokes, ONE park-spanning loop.
// CATS   gentle Carousel · thrill Thunderhead(§4.0-C) · water Log Flume ·
//        transport Grand Circle Monorail · dark Foundry Phantoms(GhostTrain)  → 5/5
//        never-used picks: GhostTrain (dark), Helicycles (gentle)             ✓
// CIRCUITS Thunderhead(coaster) · Wolds Runner(coaster) · Monorail(transport) ·
//        Log Flume(water) · Skyward Belvedere(tower) · Foundry Phantoms(dark)  → 6 / 5 fam ✓
//        coasters: Thunderhead §4.0-C (intense) · Wolds Runner §4.0-B (thrilling) — DIFFERENT bands ✓
import React from 'react';
import type { TrackPiece } from './SplineRideKit';
import {
  Park, GameManager, Terrain, Paths, Gate, Coaster, Restroom, Lights,
  Scenery, Placed, offPathCell,
} from './Park';
import { laneLenOf } from './ParkBuilder';
import { compileTrackPieces } from './SplineRideKit';
import {
  buildParkNet, PULSE_DISTRICT, BRASSWORK_FOUNDRY, THORNWICK_GLADE,
} from './SetPieceKit';
import { worldPlan, World } from './SetPieceKit';
import { FountainPlaza, fountainPlazaPlan } from './FountainPlaza';
import { Bazaar, bazaarPlan } from './Bazaar';
import { Boulevard, boulevardPlan } from './Boulevard';
import { Monorail } from './Monorail';
import { Carousel } from './Carousel';
import { Discotron } from './Discotron';
import { GhostTrain } from './GhostTrain';
import { LogFlume } from './LogFlume';
import { ObservationTower } from './ObservationTower';
import { Helicycles } from './Helicycles';
import { tree } from './Kit';
import { NeonArch, SpeakerStack, MirrorBallPylon } from './PulseScenery';
import { GiantGear, BoilerTank, CoalCart } from './BrassworkScenery';
import { GiantToadstools, StandingStones, LanternTree } from './ThornwickScenery';

type XZ = [number, number];
type V3 = [number, number, number];
type NetRef = number | string;
type TreeShape = 'round' | 'pine' | 'willow' | 'palm';

const SIZE = 128;

// ── module-scope assertions: collect, print ONE block, throw ONCE ───────────
type Sev = 'structural' | 'advisory';
const PARK_FAILS: { name: string; detail: string; sev: Sev }[] = [];
function parkAssert(name: string, ok: boolean, detail: string, sev: Sev = 'structural') {
  if (!ok) PARK_FAILS.push({ name, detail, sev });
}
function parkAssertFlush() {
  if (!PARK_FAILS.length) return;
  console.error(
    '[park] assertion failures:\n' +
      PARK_FAILS.map((f, i) => `  ${i + 1}. [${f.sev}] ${f.name}: ${f.detail}`).join('\n'),
  );
  const structural = PARK_FAILS.filter((f) => f.sev === 'structural');
  if (structural.length) throw new Error(`[park] ${structural.length} structural failure(s) — see above`);
}

// ── seed 1 temperate water row (PRE-guard) + the keepDry sieve ──────────────
type SeedBasin = { ctr: XZ; box: [number, number, number, number] };
type SeedRow = { dom: SeedBasin; sec: SeedBasin };
const SEED_ROW: SeedRow = {
  dom: { ctr: [41, -39], box: [21, 60, -60, -21] },
  sec: { ctr: [-38, 31], box: [-56, -21, 23, 39] },
};
const inBasinBox = (c: XZ, b: SeedBasin) =>
  c[0] >= b.box[0] && c[0] <= b.box[1] && c[1] >= b.box[2] && c[1] <= b.box[3];
const offRow = (c: XZ, row: SeedRow) =>
  !inBasinBox(c, row.dom) && !inBasinBox(c, row.sec) &&
  Math.hypot(c[0] - row.dom.ctr[0], c[1] - row.dom.ctr[1]) >= 12 &&
  Math.hypot(c[0] - row.sec.ctr[0], c[1] - row.sec.ctr[1]) >= 12;
function keepDryOf(net: { keepDry: XZ[] }, row: SeedRow): XZ[] {
  const all = net.keepDry;
  const kept = all.filter((c) => offRow(c, row));
  if (kept.length !== all.length)
    console.warn(`[park] keepDryOf dropped ${all.length - kept.length} guard cell(s) on the water row`);
  return kept;
}

// ── the two coasters (copied verbatim, translated rigidly) ──────────────────
// §4.0-C — INVERTING flagship, E 6.27 / I 9.55 (intense), 2 corkscrews.
const C_PIECES: TrackPiece[] = ['station',
  { type: 'lift', height: 5.5 }, { type: 'straight', length: 5.2 }, { type: 'turnR', angle: 90, radius: 2.5 },
  { type: 'drop', height: 5.5 }, { type: 'hill', height: 0.6 },
  { type: 'lift', height: 4.2 }, { type: 'straight', length: 2.72 }, { type: 'turnR', angle: 90, radius: 2.5 },
  { type: 'drop', height: 4.2 }, { type: 'hill', height: 0.6 },
  { type: 'lift', height: 4.2 }, { type: 'corkscrewL' }, { type: 'straight', length: 4.0 }, { type: 'turnR', angle: 90, radius: 2.5 },
  { type: 'drop', height: 4.2 }, { type: 'hill', height: 0.6 },
  { type: 'lift', height: 4.2 }, { type: 'corkscrewR' }, { type: 'straight', length: 2.0 }, { type: 'turnR', angle: 90, radius: 2.5 },
  { type: 'drop', height: 4.2 }, { type: 'straight', length: 1.5 }];
const C_START: V3 = [16.8, 0.55, -3.6];
// §4.0-B — FAMILY second coaster, E 5.27 / I 6.25 (thrilling).
const B_PIECES: TrackPiece[] = ['station',
  { type: 'lift', height: 3.6 }, { type: 'straight', length: 2.56 }, { type: 'turnR', angle: 90, radius: 2.5 },
  { type: 'drop', height: 3.6 },
  { type: 'lift', height: 3.2 }, { type: 'straight', length: 5.46 }, { type: 'turnR', angle: 90, radius: 2.5 },
  { type: 'drop', height: 3.2 }, { type: 'hill', height: 0.9 },
  { type: 'lift', height: 3.2 }, { type: 'straight', length: 1.5 }, { type: 'turnR', angle: 90, radius: 2.5 },
  { type: 'drop', height: 3.2 }, { type: 'hill', height: 0.9 },
  { type: 'lift', height: 3.2 }, { type: 'turnR', angle: 90, radius: 2.5 },
  { type: 'drop', height: 3.2 }, { type: 'straight', length: 1.5 }];
const B_START: V3 = [-33.6, 0.55, -48.0];

const FLAG_PTS: V3[] = compileTrackPieces(C_PIECES, { profile: 'coaster', type: 'steel', start: C_START, heading: 0 }).points;
const FLAG2_PTS: V3[] = compileTrackPieces(B_PIECES, { profile: 'coaster', type: 'steel', start: B_START, heading: 0 }).points;
const ALL_COASTER_PTS: V3[] = [...FLAG_PTS, ...FLAG2_PTS];

// ── the authored street net — skeleton A, 30 cells / 36 edges / ONE loop ────
const GATE: XZ = [0, 63.6];
const NODES: XZ[] = [
  /*  0 */ GATE,
  /*  1 */ [0, 58.8],
  /*  2 */ [9.6, 58.8],       // near-gate Carousel tail (LEAF)
  /*  3 */ [22.8, 45.6],
  /*  4 */ [22.8, 27.6],
  /*  5 */ [9.6, 27.6],
  /*  6 */ [0, 27.6],         // RING NORTH tail (LEAF)
  /*  7 */ [22.8, 0],
  /*  8 */ [22.8, -3.6],      // FLAGSHIP coaster tail (LEAF)
  /*  9 */ [22.8, -8.4],
  /* 10 */ [36.0, -8.4],      // RING EAST tail (LEAF)
  /* 11 */ [22.8, -14.4],     // Helicycles tail
  /* 12 */ [48.0, -14.4],
  /* 13 */ [48.0, -19.2],     // Log Flume tail (LEAF)
  /* 14 */ [49.2, 0],
  /* 15 */ [9.6, -21.6],      // Discotron tail
  /* 16 */ [0, -21.6],
  /* 17 */ [0, -44.4],        // RING SOUTH tail (LEAF)
  /* 18 */ [-13.2, -21.6],
  /* 19 */ [-24.0, -21.6],
  /* 20 */ [-24.0, -48.0],
  /* 21 */ [-27.6, -48.0],    // SECOND coaster tail (LEAF)
  /* 22 */ [-13.2, -16.8],
  /* 23 */ [-36.0, -16.8],
  /* 24 */ [-36.0, -8.4],     // RING WEST tail (LEAF)
  /* 25 */ [-44.4, -16.8],
  /* 26 */ [-44.4, -21.6],    // GhostTrain tail (LEAF)
  /* 27 */ [-13.2, 45.6],
  /* 28 */ [-13.2, 21.6],     // Observation Tower tail (LEAF)
  /* 29 */ [0, 52.8],
];
const EDGES: [NetRef, NetRef][] = [
  [0, 1], [1, 29], [29, 'hub:N'], [1, 2],
  ['pulseRow:W', 29],
  ['hub:E', 3], [3, 4], [4, 5], [5, 6],
  [4, 7], [7, 8], [8, 9], [9, 10],
  [9, 11], [11, 12], ['gladeRow:W', 12], [12, 13],
  [7, 14], [14, 'viewpoint:W'],
  [5, 15], [15, 16], [16, 17],
  [16, 18], [18, 19], [19, 20], [20, 21],
  [18, 22], [22, 23], [23, 24],
  [23, 25], ['worksRow:E', 25], [25, 26],
  ['aveW:A', 'hub:W'], ['aveW:B', 27], [27, 28], [28, 22],
];

// ── the set-pieces the net wires ────────────────────────────────────────────
const HUB = fountainPlazaPlan({ id: 'hub', title: 'Willowmere Circle', position: [0, 45.6], tiles: 7, ports: ['N', 'E', 'W'] });
const VIEWPOINT = fountainPlazaPlan({ id: 'viewpoint', title: 'East Belvedere', position: [57.6, 0], tiles: 9, ports: ['W'] });
const AVE_WEST = boulevardPlan({ id: 'aveW', from: [-6.0, 45.6], to: [-12.0, 45.6], spacing: 3.0, seed: 5 });

const PULSE_ROW = bazaarPlan({
  id: 'pulseRow', title: 'Neon Bazaar', position: [12.0, 52.8], theme: PULSE_DISTRICT,
  facing: { port: 'W', toward: [0, 52.8] }, seed: 3,
  stalls: ['burger', 'soda', 'cottonCandy', 'hotDog', 'balloon', 'soda'],
  names: ['Voltage Grill', 'Neon Sodas', 'Static Floss', 'Pulse Dogs', 'Sky Balloons', 'Circuit Fizz'],
});
const WORKS_ROW = bazaarPlan({
  id: 'worksRow', title: 'Foundry Market', position: [-52.8, -16.8], theme: BRASSWORK_FOUNDRY,
  facing: { port: 'E', toward: [-44.4, -16.8] }, seed: 5,
  stalls: ['burger', 'soda', 'cottonCandy'],
  names: ['Foundry Grill', 'Boiler Sodas', 'Cog Candy'],
});
const GLADE_ROW = bazaarPlan({
  id: 'gladeRow', title: 'Glade Market', position: [56.4, -14.4], theme: THORNWICK_GLADE,
  facing: { port: 'W', toward: [48.0, -14.4] }, seed: 7,
  stalls: ['cottonCandy', 'burger', 'soda'],
  names: ['Faerie Floss', 'Thornwick Grill', 'Mossy Sodas'],
});

const PIECES = [HUB, VIEWPOINT, AVE_WEST];

// ── themed world scenery cells (also fed to each world's include) ───────────
const PULSE_SC: XZ[] = [[16.8, 48.0], [6.0, 48.0], [21.6, 55.2]];
const WORKS_SC: XZ[] = [[-56.4, -10.8], [-48.0, -25.2], [-58.8, -21.6]];
const GLADE_SC: XZ[] = [[54.0, -8.4], [61.2, -19.2], [50.4, -22.8]];

// ── the worlds (include: ride-pad ESTIMATES + scenery + a ring-reach cell) ──
const PULSE = worldPlan({
  id: 'pulse', theme: PULSE_DISTRICT, pieces: [PULSE_ROW],
  include: [[16.8, 58.8], [9.6, 36.0], ...PULSE_SC],
});
const WORKS = worldPlan({
  id: 'foundry', theme: BRASSWORK_FOUNDRY, pieces: [WORKS_ROW],
  include: [[-53.2, -21.6], [-42.0, -8.4], ...WORKS_SC],
});
const GLADE = worldPlan({
  id: 'glade', theme: THORNWICK_GLADE, pieces: [GLADE_ROW],
  include: [[55.7, -19.2], [42.0, -8.4], ...GLADE_SC],
});
const WORLDS = [PULSE, WORKS, GLADE];
const ALL_PLANS = [...PIECES, ...WORLDS.flatMap((w) => w.pieces)];

// ── THE SINGLE FUSE ─────────────────────────────────────────────────────────
const NET = buildParkNet({
  nodes: NODES,
  edges: EDGES,
  pieces: PIECES,
  worlds: WORLDS,
  keepDry: NODES.filter((c) => offRow(c, SEED_ROW)),
  bins: [[1.5, 12.0]],
});
const GUARDS = keepDryOf(NET, SEED_ROW);

// ── assertions (verified coordinates — these pass; they guard regressions) ──
const portCell = (r: NetRef): XZ => {
  if (typeof r !== 'string') return NODES[r];
  const [id, name] = r.split(':');
  const p = ALL_PLANS.find((q) => q.id === id);
  return (p ? p.port(name) : [0, 0]) as XZ;
};
EDGES.forEach(([a, b]) => {
  const A = portCell(a), B = portCell(b);
  parkAssert('cardinalEdge', Math.abs(A[0] - B[0]) < 1e-6 || Math.abs(A[1] - B[1]) < 1e-6,
    `edge ${a}->${b} is DIAGONAL: [${A}] -> [${B}]`);
});
const RING_TAILS: XZ[] = [[36.0, -8.4], [0, 27.6], [-36.0, -8.4], [0, -44.4]];
const idxOf = (c: XZ) => NODES.findIndex((n) => Math.hypot(n[0] - c[0], n[1] - c[1]) < 1e-6);
RING_TAILS.forEach((c) => {
  const i = idxOf(c);
  if (i < 0) return;
  const deg = EDGES.filter(([a, b]) => a === i || b === i).length;
  parkAssert('tailIsLeaf', deg <= 1, `monorail platform tail node ${i} [${c}] has degree ${deg} (must be a leaf)`);
});
const QUEUE_TAILS: XZ[] = [
  [9.6, 58.8], [22.8, -14.4], [48.0, -19.2], [9.6, -21.6],
  [-44.4, -21.6], [-13.2, 21.6], [22.8, -3.6], [-27.6, -48.0],
];
const PORTS = ALL_PLANS.flatMap((p) => p.ports.map((pt: { name: string }) => ({ id: p.id, name: pt.name, at: p.port(pt.name) as XZ })));
QUEUE_TAILS.forEach((t) => {
  const hit = PORTS.find((p) => Math.hypot(p.at[0] - t[0], p.at[1] - t[1]) < 1.2 - 1e-6);
  parkAssert('tailOffPort', !hit, hit ? `queue tail [${t}] abuts '${hit.id}:${hit.name}' port [${hit.at}]` : '');
});
const PORT_REFS = EDGES.flat().filter((x): x is string => typeof x === 'string');
ALL_PLANS.forEach((p) => {
  const wired = new Set(PORT_REFS.filter((r) => r.split(':')[0] === p.id).map((r) => r.split(':')[1]));
  parkAssert('pieceWired', wired.size > 0, `set-piece '${p.id}' has no port-ref in EDGES (island)`);
  p.ports.filter((pt: { prunable?: boolean }) => pt.prunable === false).forEach((pt: { name: string }) => {
    parkAssert('chainEndWired', wired.has(pt.name), `chain piece '${p.id}' port '${pt.name}' is not wired (dead-ends)`);
  });
});
[PULSE_ROW, WORKS_ROW, GLADE_ROW].forEach((b) => {
  parkAssert('bazaarStallCount', b.slots.length >= 3 && b.slots.length <= 6, `bazaar '${b.id}' holds ${b.slots.length} stalls`);
});
parkAssertFlush();

// ── pad placement: build the queue from the TAIL out, pad OFF the lattice ───
const PAD_MARGIN: Record<string, number> = {
  GhostTrain: 4.77, Discotron: 3.07, LogFlume: 6.6, Helicycles: 3.2,
  Carousel: 3.2, ObservationTower: 3.2,
};
const padMarginOf = (rig: string) => PAD_MARGIN[rig] ?? 3.2;
const minReachOf = (c: number) => laneLenOf(c) + 0.35 + 0.62 + 0.5 + 0.45;
function place(tail: XZ, out: XZ, capacity: number, rig: string) {
  const clear = padMarginOf(rig);
  const join = laneLenOf(capacity) + 0.35;
  const reach = minReachOf(capacity) + 2.4;
  const cand: XZ = [tail[0] + out[0] * reach, tail[1] + out[1] * reach];
  const pad = (offPathCell(NET, cand, { clear }) ?? cand) as XZ;
  return { pad, anchor: [tail[0] + out[0] * join, tail[1] + out[1] * join] as XZ, dir: [-out[0], -out[1]] as XZ };
}
const yawFace = (out: XZ) => Math.atan2(-out[0], -out[1]);

const CAROUSEL = place([9.6, 58.8], [1, 0], 4, 'Carousel');
const HELI = place([22.8, -14.4], [0, -1], 2, 'Helicycles');
const FLUME = place([48.0, -19.2], [1, 0], 4, 'LogFlume');
const DISCO = place([9.6, -21.6], [0, -1], 6, 'Discotron');
const GHOST = place([-44.4, -21.6], [-1, 0], 6, 'GhostTrain');
const TOWER = place([-13.2, 21.6], [-1, 0], 8, 'ObservationTower');

// ── prop + tree scatter (every cell through offPathCell; nulls dropped) ─────
const sc = (c: XZ, clear = 1.2): XZ => (offPathCell(NET, c, { clear }) ?? c) as XZ;
const PULSE_SC_P = PULSE_SC.map((c) => sc(c));
const WORKS_SC_P = WORKS_SC.map((c) => sc(c));
const GLADE_SC_P = GLADE_SC.map((c) => sc(c));

const GENERAL_SCENERY: { name: string; at: XZ }[] = ([
  ['parkClock', [0, 40.8]], ['marbleStatue', [-6.0, 40.8]], ['flagpole', [6.0, 40.8]],
  ['gazebo', [-19.2, 30.0]], ['topiarySpiral', [15.6, 33.6]], ['birdbath', [15.6, 6.0]],
  ['wishingWell', [-19.2, 6.0]], ['planterBox', [-19.2, -6.0]],
] as [string, XZ][]).map(([name, c]) => ({ name, at: sc(c) }));

const TREE_SHAPES: TreeShape[] = ['round', 'pine', 'willow', 'round', 'pine'];
const RAW_TREES: XZ[] = [
  [6, 60], [-6, 60], [15, 55], [-15, 52.8], [20, 49.2], [-20, 49.2],
  [28.8, 42], [28.8, 33.6], [15.6, 39.6], [-8.4, 34.8], [3.6, 33.6], [-19.2, 39.6],
  [30, 6], [30, -6], [15.6, 12], [-8.4, 12], [-19.2, 15.6], [4.8, 8.4],
  [-8.4, -8.4], [4.8, -6], [-19.2, -8.4], [30, -18], [15.6, -30], [3.6, -33.6],
  [-30, -8.4], [-30, -18], [-19.2, -30], [-8.4, -36], [-36, -30], [-20.4, -48],
  [-48, -30], [-58.8, -8.4], [-48, -6], [-56.4, -28.8], [54, 3.6], [61.2, -4.8],
  [45.6, -6], [54, 6], [-13.2, 51.6], [8.4, 45.6], [-24, 6], [36, 3.6],
];
const TREES: { at: XZ; shape: TreeShape }[] = RAW_TREES
  .map((c, i) => ({ at: sc(c, 0.75), shape: TREE_SHAPES[i % TREE_SHAPES.length] }))
  .filter((t): t is { at: XZ; shape: TreeShape } => !!t.at);

const RESTROOM = sc([-8.4, -30.0], 1.8);

const RIDE_NAMES = [
  'Willowmere Gallopers', 'Thunderhead', 'Wolds Runner', 'Grand Circle Monorail',
  'Foundry Phantoms', 'Willowmere Log Flume', 'Skyward Belvedere', 'Bassline Ballroom', 'Zephyr Wings',
];
const STALL_COUNT = PULSE_ROW.slots.length + WORKS_ROW.slots.length + GLADE_ROW.slots.length;

// ── the mandatory 4-platform monorail ring (verified, copied verbatim) ──────
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

export function WillowmerePark() {
  return (
    <Park
      seed={1}
      climate="temperate"
      roster={{ rides: RIDE_NAMES, stalls: STALL_COUNT, categories: 5 }}
      onReady={(report: { ok: boolean }) => console.log('[Willowmere] validatePark ok:', report.ok)}
    >
      <Terrain keepDry={GUARDS} coasterPts={ALL_COASTER_PTS} />
      <Paths nodes={NET.nodes} edges={NET.edges} plazas={NET.plazas} bins={NET.bins} walkers={8} />
      <GameManager />
      <Gate />

      {/* transport — the park-spanning ring */}
      <Monorail
        position={[-42.6, 0, -9.7]} rotation={0} pieces={MONO_PIECES} beamY={2.6} loopSeconds={12} pinned
        name="Grand Circle Monorail" capacity={6} rideDuration={12} intensity={1} price={0}
        queue={{ anchor: [-40.81, -8.4], dir: [1, 0] }}
        register={{
          board: [-42.6, 2.6, -8.4],
          stations: [
            { label: 'North', boardPoint: [0, 2.6, 34.2], queueAnchor: [0, 0.05, 32.41], queueDir: [0, -1], exitPoint: [-1.2, 0.05, 33.03], exitDir: [0, -1] },
            { label: 'East', boardPoint: [42.6, 2.6, -8.4], queueAnchor: [40.81, 0.05, -8.4], queueDir: [-1, 0], exitPoint: [41.43, 0.05, -7.2], exitDir: [-1, 0] },
            { label: 'South', boardPoint: [0, 2.6, -51.0], queueAnchor: [0, 0.05, -49.21], queueDir: [0, 1], exitPoint: [1.2, 0.05, -49.83], exitDir: [0, 1] },
          ],
        }}
      />

      {/* thrill — two coasters, different archetypes + bands */}
      <Coaster
        name="Thunderhead" pieces={C_PIECES} start={C_START} heading={0} type="steel" cars={3}
        capacity={4} rideDuration={10} loadTime={2} intensity={7} price={6}
        queueTailNode={NET.node([22.8, -3.6])} queueDir={[1, 0]} deck={[16.8, -2.4]}
      />
      <Coaster
        name="Wolds Runner" pieces={B_PIECES} start={B_START} heading={0} type="steel" cars={3}
        capacity={4} rideDuration={10} loadTime={2} intensity={6} price={5}
        queueTailNode={NET.node([-27.6, -48.0])} queueDir={[1, 0]} deck={[-33.6, -46.8]}
      />

      {/* gentle / dark / water / tower flat + tracked rides */}
      <Carousel position={CAROUSEL.pad} rotation={yawFace([1, 0])}
        register={{ name: 'Willowmere Gallopers', capacity: 4, rideDuration: 9, intensity: 2, price: 2 }}
        queue={{ anchor: CAROUSEL.anchor, dir: CAROUSEL.dir }} />
      <Helicycles position={HELI.pad} rotation={yawFace([0, -1])}
        register={{ name: 'Zephyr Wings', capacity: 2, rideDuration: 8, intensity: 2, price: 2 }}
        queue={{ anchor: HELI.anchor, dir: HELI.dir }} />
      <ObservationTower position={TOWER.pad} rotation={yawFace([-1, 0])}
        register={{ name: 'Skyward Belvedere', capacity: 8, rideDuration: 10, intensity: 1, price: 2 }}
        queue={{ anchor: TOWER.anchor, dir: TOWER.dir }} />
      <GhostTrain position={GHOST.pad} rotation={yawFace([-1, 0])}
        register={{ name: 'Foundry Phantoms', capacity: 6, rideDuration: 11, intensity: 5, price: 4 }}
        queue={{ anchor: GHOST.anchor, dir: GHOST.dir }} />
      <LogFlume position={FLUME.pad} rotation={yawFace([1, 0])}
        register={{ name: 'Willowmere Log Flume', capacity: 4, rideDuration: 12, intensity: 5, price: 4 }}
        queue={{ anchor: FLUME.anchor, dir: FLUME.dir }} />
      <Discotron position={DISCO.pad} rotation={yawFace([0, -1])}
        register={{ name: 'Bassline Ballroom', capacity: 6, rideDuration: 10, intensity: 6, price: 3 }}
        queue={{ anchor: DISCO.anchor, dir: DISCO.dir }} />

      {/* plazas + boulevard */}
      <FountainPlaza plan={HUB} />
      <FountainPlaza plan={VIEWPOINT} />
      <Boulevard plan={AVE_WEST} />

      {/* worlds: region + bazaar + three themed scenery pieces each */}
      <World plan={PULSE} />
      <Bazaar plan={PULSE_ROW} />
      <NeonArch position={PULSE_SC_P[0]} />
      <SpeakerStack position={PULSE_SC_P[1]} />
      <MirrorBallPylon position={PULSE_SC_P[2]} />

      <World plan={WORKS} />
      <Bazaar plan={WORKS_ROW} />
      <GiantGear position={WORKS_SC_P[0]} />
      <BoilerTank position={WORKS_SC_P[1]} />
      <CoalCart position={WORKS_SC_P[2]} />

      <World plan={GLADE} />
      <Bazaar plan={GLADE_ROW} />
      <GiantToadstools position={GLADE_SC_P[0]} />
      <StandingStones position={GLADE_SC_P[1]} />
      <LanternTree position={GLADE_SC_P[2]} />

      {/* amenities */}
      <Restroom position={RESTROOM} rotation={0} />

      {/* one lights run per district, laid along the street */}
      <Lights from={[0, 58.8]} to={[9.6, 58.8]} />
      <Lights from={[22.8, 27.6]} to={[22.8, 0]} />
      <Lights from={[-13.2, -21.6]} to={[-24.0, -21.6]} />
      <Lights from={[48.0, -14.4]} to={[48.0, -19.2]} />

      {/* general scenery */}
      {GENERAL_SCENERY.map((s, i) => (
        <Scenery key={`sc-${i}`} name={s.name} position={s.at} />
      ))}

      {/* trees — mixed shapes, sieved off streets + water */}
      {TREES.map((t, i) => (
        <Placed key={`tree-${i}`} build={(three: unknown) => tree(three, { shape: t.shape })} position={t.at} />
      ))}
    </Park>
  );
}

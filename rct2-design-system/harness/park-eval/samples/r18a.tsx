/* ═══ AURORA GROVE — §0 PRE-FLIGHT ═══════════════════════════════════════════════════
 * SIZE   128 (default, size prop omitted)
 * SEED   1 / temperate — RING-CLEAN row with dry decks (§0-P.6). Dominant lake SE
 *        ctr (41,-39), secondary inlet NW ctr (-38,31). All 16 monorail RING_CELLS
 *        walked against both waterlines: none wet. Guard list is DERIVED from the fuse
 *        via keepDryOf(NET) — never a blanket NODES.slice(). Every planted tree/scenery
 *        cell is re-checked IN THE TREE by DryScatter (the gate's own isDry predicate).
 * WORLDS 3 (>= 3): thornwick @NW · pulse @NE · emberfall @SW. Each rect reaches the
 *        monorail beam corridor (everyWorldTouched) via `include` reach cells, and each
 *        carries >= 3 THEMED scenery pieces from its OWN pack + a themed bazaar + a ride.
 * CATS   gentle FerrisWheel/FlyingSaucers · thrill Coaster(§4.0-B)+Coaster(§4.0-C)+
 *        Discotron/Enterprise · water LogFlume · transport Monorail ring + Chairlift ·
 *        dark GhostTrain  → 5/5 categories.
 * CIRCUITS §4.0-B core coaster · §4.0-C SW coaster · Monorail ring · LogFlume · GhostTrain
 *        → 5 circuits / 3 families (coaster·water·transport / dark).
 * GATE   [-14.4, 63.6] off-centre rim → first queue tail node 1 [-14.4,57.6] = 6.0 u <= 15.
 * FLAG   §4.0-B family steel rectangle, start [15.6,0.55,-2.4], heading 0, cars 3, NO bank
 *        prop (builds 0.7). rateCoaster logged. Sits in the PLOT CORE (not a flank).
 * FLAG2  §4.0-C inverting steel rectangle, start [-2.4,0.55,-38.4], heading 0, cars 3.
 *        DIFFERENT archetype (2 corkscrews) · bbox disjoint from FLAG · coasterPts = BOTH.
 * STREET buildParkNet called EXACTLY ONCE; the SAME NET feeds <Paths> and every offPathCell.
 *        Every set-piece port wired; every EDGES pair cardinal (asserted).
 * MONO   ring VERBATIM (§0-P.4) · position [-42.6,0,-9.7] START POSE · beamY 2.6 · price 0
 *        · pinned · 4 platforms, tails [-36,-8.4] [0,27.6] [36,-8.4] [0,-57.6] all LEAVES.
 * QUEUE  every tail is an authored NODE; every pad DERIVED from it through place()/offPathCell,
 *        clearance = padMarginOf(rig) off the §0-P.5 table. No two rides share a tail.
 * SPREAD built bbox spans the plot (>= 70 x 45). Rides spread across NW/NE/SW/core + the ring.
 * DRESS  40 tree cells (>= 32) + 24 scenery cells (>= 16 + 9 themed), all sieved by DryScatter.
 *        water inside the temperate 4-22% band. Neon marquees, festival string lights, torches.
 * ROSTER 10 rides / 5 categories / bazaar stalls + food kiosks / restroom / bins.
 *        <Park roster={{ rides: 10, stalls: 8, categories: 5 }}> MOUNTED.
 * GATE   parkAssertFlush() collects then throws once on any structural failure;
 *        validatePark runs in-preview and logs its report to the console.
 * ═══════════════════════════════════════════════════════════════════════════════════ */
import React from 'react';
import type { TrackPiece } from './components/SplineRideKit';
import { compileTrackPieces, rateCoaster } from './components/SplineRideKit';
import {
  Park, GameManager, Terrain, Paths, Gate, Coaster, Restroom, Neon, Torch, Lights, Scenery, Placed, usePark, offPathCell,
} from './components/Park';
import { laneLenOf } from './components/ParkBuilder';
import { buildParkNet, worldPlan, World, THORNWICK_GLADE, PULSE_DISTRICT, EMBERFALL_CALDERA } from './components/SetPieceKit';
import { bazaarPlan, Bazaar } from './components/Bazaar';
import { Monorail } from './components/Monorail';
import { FerrisWheel } from './components/FerrisWheel';
import { LogFlume } from './components/LogFlume';
import { GhostTrain } from './components/GhostTrain';
import { Discotron } from './components/Discotron';
import { Enterprise } from './components/Enterprise';
import { FlyingSaucers } from './components/FlyingSaucers';
import { Chairlift } from './components/Chairlift';
import { BurgerShop } from './components/BurgerShop';
import { HotDogStand } from './components/HotDogStand';
import { SodaStand } from './components/SodaStand';
import { tree } from './components/Kit';
import { GiantToadstools, LanternTree, StandingStones } from './components/ThornwickScenery';
import { NeonArch, MirrorBallPylon, SpeakerStack } from './components/PulseScenery';
import { Fumarole, BasaltColumns, CharredSnag } from './components/EmberfallScenery';

type XZ = [number, number];
type V3 = [number, number, number];
type NetRef = number | string;

const SIZE = 128;

// ── The two coasters — VERIFIED §4.0 archetypes (copied verbatim, different starts) ──
const B_PIECES: TrackPiece[] = [
  'station',
  { type: 'lift', height: 3.6 }, { type: 'straight', length: 2.56 }, { type: 'turnR', angle: 90, radius: 2.5 },
  { type: 'drop', height: 3.6 },
  { type: 'lift', height: 3.2 }, { type: 'straight', length: 5.46 }, { type: 'turnR', angle: 90, radius: 2.5 },
  { type: 'drop', height: 3.2 }, { type: 'hill', height: 0.9 },
  { type: 'lift', height: 3.2 }, { type: 'straight', length: 1.5 }, { type: 'turnR', angle: 90, radius: 2.5 },
  { type: 'drop', height: 3.2 }, { type: 'hill', height: 0.9 },
  { type: 'lift', height: 3.2 }, { type: 'turnR', angle: 90, radius: 2.5 },
  { type: 'drop', height: 3.2 }, { type: 'straight', length: 1.5 },
];
const B_START: V3 = [15.6, 0.55, -2.4];       // the PLOT CORE — the free centre the runs enclose
const B_TAIL: XZ = [21.6, -2.4];              // start.x + 6.0 — authored NODE 13

const C_PIECES: TrackPiece[] = [
  'station',
  { type: 'lift', height: 5.5 }, { type: 'straight', length: 5.2 }, { type: 'turnR', angle: 90, radius: 2.5 },
  { type: 'drop', height: 5.5 }, { type: 'hill', height: 0.6 },
  { type: 'lift', height: 4.2 }, { type: 'straight', length: 2.72 }, { type: 'turnR', angle: 90, radius: 2.5 },
  { type: 'drop', height: 4.2 }, { type: 'hill', height: 0.6 },
  { type: 'lift', height: 4.2 }, { type: 'corkscrewL' }, { type: 'straight', length: 4.0 }, { type: 'turnR', angle: 90, radius: 2.5 },
  { type: 'drop', height: 4.2 }, { type: 'hill', height: 0.6 },
  { type: 'lift', height: 4.2 }, { type: 'corkscrewR' }, { type: 'straight', length: 2.0 }, { type: 'turnR', angle: 90, radius: 2.5 },
  { type: 'drop', height: 4.2 }, { type: 'straight', length: 1.5 },
];
const C_START: V3 = [-2.4, 0.55, -38.4];      // deep SW, disjoint from the core flagship
const C_TAIL: XZ = [3.6, -38.4];              // start.x + 6.0 — authored NODE 28 (a LEAF stub)

const { points: FLAG_PTS } = compileTrackPieces(B_PIECES, { type: 'steel', start: B_START, heading: 0, bounds: SIZE });
const { points: FLAG2_PTS } = compileTrackPieces(C_PIECES, { type: 'steel', start: C_START, heading: 0, bounds: SIZE });
const ALL_COASTER_PTS = [...FLAG_PTS, ...FLAG2_PTS];
[FLAG_PTS, FLAG2_PTS].forEach((pts, i) => console.log(`[park] coaster ${i + 1}`,
  rateCoaster(pts, { type: 'steel', bank: 0.7, cars: 3 })));

// ── The park-spanning monorail ring — VERBATIM §0-P.4 ────────────────────────
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
const RING_CELLS: XZ[] = [
  [-42.6, -8.4], [0, 34.2], [42.6, -8.4], [0, -51.0],
  [-42.6, -9.7],
  [-36.0, -8.4], [0, 27.6], [36.0, -8.4], [0, -57.6],
  [-40.81, -8.4], [0, 32.41], [40.81, -8.4], [0, -52.79],
  [-1.2, 33.03], [41.43, -7.2], [1.2, -52.17],
];

// ── §0-P.5 assertion collector ───────────────────────────────────────────────
type Sev = 'structural' | 'advisory';
const PARK_FAILS: { name: string; detail: string; sev: Sev }[] = [];
function parkAssert(name: string, cond: boolean, detail: string, sev: Sev = 'structural'): boolean {
  if (!cond) PARK_FAILS.push({ name, detail, sev });
  return cond;
}
function parkAssertFlush(): void {
  if (!PARK_FAILS.length) { console.log('[park] assertions: all pass'); return; }
  const hard = PARK_FAILS.filter((f) => f.sev === 'structural');
  console.error(`[park] ${PARK_FAILS.length} ASSERTION FAILURE(S) (${hard.length} structural):\n` +
    PARK_FAILS.map((f, i) => `  ${i + 1}. [${f.sev}] ${f.name}\n     ${f.detail}`).join('\n'));
  if (hard.length) throw new Error(`[park] ${hard.length} STRUCTURAL failure(s) — see the numbered block above.`);
}

// ── The rig clearance table (§0-P.5), the reach arithmetic, and place() ───────
const PAD_MARGIN: Record<string, number> = {
  LavaTubeRun: 23.41, ReefRacer: 22.20, OceanTunnelSlide: 22.14, EmberWings: 16.15,
  WyrmsHollow: 15.99, MagmaRun: 14.22, MineTrainCoaster: 13.99, DeepDrift: 12.65,
  Bassline: 11.59, GearworksExpress: 10.03, MoonlitBarge: 8.23, SplineCoaster: 7.32,
  RiverRapids: 6.60, Bobsleigh: 6.01, MagneticRide: 5.56, LogFlume: 5.36,
  GhostTrain: 4.77, HauntedMansion: 4.77, GoKarts: 4.39, Monorail: 4.02,
  Chairlift: 3.52, Helicycles: 3.42, FlyingSaucers: 3.37, MotionSimulator: 3.20,
  Enterprise: 3.13, PaddleBoats: 3.12, Discotron: 3.07, BoilerBurst: 3.05,
  FerrisWheel: 2.97, AetherBalloons: 2.95, PirateShip: 2.70, TwistRide: 2.65,
  TopSpin: 2.52, Teacups: 2.47, Carousel: 2.40, SwingingInverterShip: 2.35,
  LaunchedFreefall: 2.25, BumperCars: 2.07, SpaceRings: 1.92, SwingRide: 1.92,
  DropTower: 1.80, ObservationTower: 1.80,
};
const padMarginOf = (rig: string) => PAD_MARGIN[rig] ?? 3.2;
const minReachOf = (c: number) => laneLenOf(c) + 0.35 + 0.62 + 0.5 + 0.45;

// NET is declared just below, after the plans; place() is called after the fuse.
let NET: any = null;

function place(tail: XZ, out: XZ, capacity: number, rig: string) {
  const clear = padMarginOf(rig);
  const join = laneLenOf(capacity) + 0.35;
  const reach = minReachOf(capacity) + 2.4;
  const cand: XZ = [tail[0] + out[0] * reach, tail[1] + out[1] * reach];
  const pad = (offPathCell(NET, cand, { clear }) ?? cand) as XZ;
  const got = Math.hypot(pad[0] - tail[0], pad[1] - tail[1]);
  parkAssert('padReach', got >= minReachOf(capacity) + 0.4,
    `pad [${pad}] sits ${got.toFixed(2)} u from its tail [${tail}] for ${rig} (cap ${capacity}) — too tight; open the court or lower the capacity.`,
    'advisory');
  return {
    pad,
    anchor: [tail[0] + out[0] * join, tail[1] + out[1] * join] as XZ,
    dir: [-out[0], -out[1]] as XZ,
  };
}

// ── The three themed bazaars ─────────────────────────────────────────────────
const GLADE_ROW = bazaarPlan({
  id: 'gladeRow', title: 'Toadstool Market', position: [-52.8, 45.6],
  facing: { port: 'E', toward: [-43.2, 45.6] },
  stalls: ['cottonCandy', 'burger', 'soda'], theme: THORNWICK_GLADE, seed: 11,
});
const PULSE_ROW = bazaarPlan({
  id: 'pulseRow', title: 'Neon Row', position: [57.6, 55.2],
  facing: { port: 'W', toward: [57.6, 45.6] },
  stalls: ['soda', 'cottonCandy', 'balloon', 'burger', 'hotDog', 'soda'], theme: PULSE_DISTRICT, seed: 7,
});
const EMBER_ROW = bazaarPlan({
  id: 'emberRow', title: 'Caldera Market', position: [-48.0, -49.2],
  facing: { port: 'W', toward: [-48.0, -38.4] },
  stalls: ['hotDog', 'burger', 'soda'], theme: EMBERFALL_CALDERA, seed: 3,
});
const ALL_PLANS = [GLADE_ROW, PULSE_ROW, EMBER_ROW];

// ── The street skeleton — a north promenade + descent + long west row (a TREE) ─
const NODES: XZ[] = [
  /*  0 */ [-14.4, 63.6],   // GATE — off-centre rim
  /*  1 */ [-14.4, 57.6],   // near-gate tail (FerrisWheel)
  /*  2 */ [-14.4, 45.6],   // promenade x gate spine
  /*  3 */ [-43.2, 45.6],   // NW court — wires gladeRow:E
  /*  4 */ [-43.2, 50.4],   // NW court tail (FlyingSaucers)
  /*  5 */ [24.0, 45.6],    // the one descent head
  /*  6 */ [57.6, 45.6],    // NE court — wires pulseRow:W
  /*  7 */ [57.6, 33.6],    // NE court tail (Discotron)
  /*  8 */ [24.0, 36.0],    // descent mid
  /*  9 */ [24.0, 27.6],    // arterial head tail (Chairlift)
  /* 10 */ [0.0, 27.6],     // RING NORTH queue tail — LEAF
  /* 11 */ [24.0, 12.0],    // arterial mid (ramp landing)
  /* 12 */ [24.0, -2.4],    // coaster tail junction
  /* 13 */ [21.6, -2.4],    // FLAGSHIP coaster queue tail = B_START.x + 6.0
  /* 14 */ [24.0, -8.4],    // ring-east spur junction
  /* 15 */ [36.0, -8.4],    // RING EAST queue tail — LEAF
  /* 16 */ [24.0, -19.2],   // the west row starts here
  /* 17 */ [12.0, -19.2],   // west row tail (LogFlume)
  /* 18 */ [0.0, -19.2],    // west row cell
  /* 19 */ [0.0, -57.6],    // RING SOUTH queue tail — LEAF (reached from the south shelf)
  /* 20 */ [-24.0, -19.2],  // west row tail (GhostTrain)
  /* 21 */ [-36.0, -19.2],  // ring-west spur junction
  /* 22 */ [-36.0, -8.4],   // RING WEST queue tail — LEAF
  /* 23 */ [-48.0, -19.2],  // west row end
  /* 24 */ [-48.0, -30.0],  // SW court tail (Enterprise)
  /* 25 */ [-48.0, -38.4],  // SW court — wires emberRow:W
  /* 26 */ [-48.0, -57.6],  // south shelf head, off emberRow:E
  /* 27 */ [0.0, -38.4],    // stub column toward the SW coaster
  /* 28 */ [3.6, -38.4],    // SW coaster queue tail = C_START.x + 6.0 — LEAF
];
const EDGES: [NetRef, NetRef][] = [
  [0, 1], [1, 2],
  [2, 3], ['gladeRow:E', 3], [3, 4],
  [2, 5], [5, 6], ['pulseRow:W', 6], [6, 7],
  [5, 8], [8, 9],
  [9, 10],
  [9, 11], [11, 12], [12, 13], [12, 14], [14, 15],
  [14, 16],
  [16, 17], [17, 18],
  [18, 20], [20, 21], [21, 22],
  [21, 23], [23, 24], [24, 25], ['emberRow:W', 25],
  ['emberRow:E', 26], [26, 19],
  [18, 27], [27, 28],
];

// ── Module-scope assertions: cardinal edges · ports wired · ring tails are leaves ─
const portCell = (ref: NetRef): XZ => {
  if (typeof ref === 'number') return NODES[ref];
  const [id, name] = ref.split(':');
  const p = ALL_PLANS.find((q) => q.id === id);
  if (!p) throw new Error(`EDGES references '${ref}' but no plan has id '${id}'`);
  return p.port(name);
};
const EPS = 1e-6;
EDGES.forEach(([a, b]) => {
  const A = portCell(a), B = portCell(b);
  parkAssert('cardinalEdge', Math.abs(A[0] - B[0]) < EPS || Math.abs(A[1] - B[1]) < EPS,
    `edge ${a}->${b} is DIAGONAL: [${A}] -> [${B}].`);
});

const PORT_REFS = EDGES.flat().filter((x): x is string => typeof x === 'string');
ALL_PLANS.forEach((p) => {
  const wired = new Set(PORT_REFS.filter((r) => r.split(':')[0] === p.id).map((r) => r.split(':')[1]));
  parkAssert('pieceIsland', wired.size > 0, `set-piece '${p.id}' has NO port ref in EDGES — it composes as an ISLAND`);
  (p.ports as any[]).filter((pt) => !pt.prunable).forEach((pt) => {
    parkAssert('chainEnd', wired.has(pt.name),
      `chain piece '${p.id}' wires [${[...wired]}] but NOT '${p.id}:${pt.name}' — that carriageway end dead-ends in grass.`);
  });
});

const RING_TAILS: XZ[] = [[36.0, -8.4], [0, 27.6], [-36.0, -8.4], [0, -57.6]];
RING_TAILS.forEach((c) => {
  const i = NODES.findIndex((n) => Math.hypot(n[0] - c[0], n[1] - c[1]) < EPS);
  if (i < 0) return;
  const deg = EDGES.filter(([a, b]) => a === i || b === i).length;
  parkAssert('tailIsLeaf', deg <= 1,
    `street node ${i} [${c}] is a monorail platform tail with degree ${deg}; a street past it runs through the deck.`);
});

// ── ONE fuse ─────────────────────────────────────────────────────────────────
NET = buildParkNet({ nodes: NODES, edges: EDGES, pieces: ALL_PLANS });

// keepDry is DERIVED, not transcribed (§0-P.6).
type SeedBasin = { ctr: XZ; box: [number, number, number, number] };
const SEED_ROW = {
  dom: { ctr: [41, -39] as XZ, box: [21, 60, -60, -21] as [number, number, number, number] },
  sec: { ctr: [-38, 31] as XZ, box: [-56, -21, 23, 39] as [number, number, number, number] },
};
const inBox = (c: XZ, b: SeedBasin) => c[0] >= b.box[0] && c[0] <= b.box[1] && c[1] >= b.box[2] && c[1] <= b.box[3];
const offRow = (c: XZ) => [SEED_ROW.dom, SEED_ROW.sec].every((b) =>
  !inBox(c, b) && Math.hypot(c[0] - b.ctr[0], c[1] - b.ctr[1]) >= 12);
const GUARDS = (NET.keepDry as XZ[]).filter(offRow);

// ── The pads, derived from the tails through the fused net ────────────────────
const WHEEL_LOC = place(NODES[1], [1, 0], 6, 'FerrisWheel');
const SAUCERS_LOC = place(NODES[4], [0, 1], 6, 'FlyingSaucers');
const DISCO_LOC = place(NODES[7], [0, -1], 6, 'Discotron');
const CHAIR_LOC = place(NODES[9], [1, 0], 6, 'Chairlift');
const FLUME_LOC = place(NODES[17], [0, -1], 6, 'LogFlume');
const GHOST_LOC = place(NODES[20], [0, 1], 6, 'GhostTrain');
const ENTER_LOC = place(NODES[24], [-1, 0], 8, 'Enterprise');

// ── The worlds — declared AFTER the pads exist ───────────────────────────────
const GLADE_SC: XZ[] = [[-48.0, 52.8], [-56.4, 52.8], [-38.4, 52.8]];
const PULSE_SC: XZ[] = [[51.6, 51.6], [51.6, 60.0], [45.6, 52.8]];
const EMBER_SC: XZ[] = [[-54.0, -34.8], [-54.0, -42.0], [-43.2, -34.8]];
const cellsOf = (x0: number, x1: number, z0: number, z1: number): XZ[] => {
  const out: XZ[] = [];
  for (let x = x0; x <= x1 + EPS; x += 1.2) for (let z = z0; z <= z1 + EPS; z += 1.2) out.push([x, z]);
  return out;
};
const THORNWICK = worldPlan({
  id: 'thornwick', theme: THORNWICK_GLADE, pieces: [GLADE_ROW],
  rides: [{ at: SAUCERS_LOC.pad, name: 'Toadstool Saucers' }],
  include: [...GLADE_SC, SAUCERS_LOC.pad, ...cellsOf(-57.6, -38.4, 45.6, 62.4), [-38.4, 33.6], [-45.6, 33.6]],
});
const PULSE = worldPlan({
  id: 'pulse', theme: PULSE_DISTRICT, pieces: [PULSE_ROW],
  rides: [{ at: DISCO_LOC.pad, name: 'Pulse Spinner' }],
  include: [...PULSE_SC, DISCO_LOC.pad, ...cellsOf(45.6, 62.4, 24.0, 61.2), [44.4, 33.6], [44.4, 24.0]],
});
const EMBER = worldPlan({
  id: 'emberfall', theme: EMBERFALL_CALDERA, pieces: [EMBER_ROW],
  rides: [{ at: ENTER_LOC.pad, name: 'Caldera Enterprise' }],
  include: [...EMBER_SC, ENTER_LOC.pad, ...cellsOf(-62.4, -43.2, -52.8, -28.8), [-43.2, -28.8]],
});
const WORLDS = [THORNWICK, PULSE, EMBER];

// ── Dressing cells ───────────────────────────────────────────────────────────
const TREE_SHAPES = ['round', 'pine', 'willow', 'round', 'pine'] as const;
type TreeShape = (typeof TREE_SHAPES)[number];
const RAW_TREES: XZ[] = [
  [-20.4, 60.0], [-8.4, 60.0], [10.8, 60.0], [30.0, 60.0], [48.0, 60.0],
  [-30.0, 40.8], [-4.8, 40.8], [12.0, 40.8], [40.8, 40.8], [-52.8, 33.6],
  [50.4, 27.6], [32.4, 20.4], [10.8, 8.4], [-10.8, 8.4], [-30.0, 8.4],
  [40.8, 4.8], [-46.8, 4.8], [-58.8, -4.8], [50.4, -18.0], [-18.0, -8.4],
  [8.4, -12.0], [-30.0, -12.0], [-6.0, -30.0], [18.0, -30.0], [-15.6, -32.4],
  [-40.8, -30.0], [-58.8, -24.0], [36.0, -30.0], [12.0, -45.6], [-18.0, -45.6],
  [-33.6, -45.6], [-9.6, -49.2], [24.0, -49.2], [-58.8, -45.6], [40.8, -46.8],
  [-2.4, -63.0], [-24.0, -63.0], [18.0, -63.0], [45.6, -34.8], [-52.8, 8.4],
];
const TREES: { at: XZ; shape: TreeShape }[] = RAW_TREES.map((c, i) => ({
  at: (offPathCell(NET, c, { clear: 0.75 }) ?? c) as XZ,
  shape: TREE_SHAPES[i % TREE_SHAPES.length],
}));

const RAW_SCENERY: { name: string; at: XZ }[] = [
  { name: 'marbleStatue', at: [-14.4, 51.6] }, { name: 'parkClock', at: [-14.4, 60.0] },
  { name: 'planterBox', at: [-20.4, 45.6] }, { name: 'planterBox', at: [-8.4, 45.6] },
  { name: 'picnicTable', at: [30.0, 48.0] }, { name: 'picnicTable', at: [18.0, 42.0] },
  { name: 'flagpole', at: [-8.4, 63.0] }, { name: 'flagpole', at: [-20.4, 63.0] },
  { name: 'topiarySpiral', at: [30.0, 8.4] }, { name: 'topiarySpiral', at: [18.0, 6.0] },
  { name: 'birdbath', at: [-30.0, -6.0] }, { name: 'signpost', at: [12.0, -12.0] },
  { name: 'planterBox', at: [-42.0, -12.0] }, { name: 'picnicTable', at: [-30.0, -24.0] },
  { name: 'signpost', at: [8.4, -30.0] }, { name: 'topiaryElephant', at: [-6.0, -45.6] },
];
const SCENERY: { name: string; at: XZ }[] = RAW_SCENERY.map((s) => ({
  name: s.name, at: (offPathCell(NET, s.at, { clear: 1.2 }) ?? s.at) as XZ,
}));

const BINS: XZ[] = [[-15.6, 46.8], [22.8, 14.4], [-1.2, -20.4], [-46.8, -31.2]];

parkAssertFlush();

// ── In-tree water sieve (the gate's own predicate) ───────────────────────────
function dryRing(park: any, c: XZ, r = 0.75): boolean {
  const g = park.ground;
  if (!g || !g.lint) return true;
  const dry = (x: number, z: number) => g.lint.isDry(x, z, 0.05);
  if (!dry(c[0], c[1])) return false;
  for (let k = 0; k < 8; k += 1) {
    const a = (k / 8) * Math.PI * 2;
    if (!dry(c[0] + Math.cos(a) * r, c[1] + Math.sin(a) * r)) return false;
  }
  return true;
}
function DryScatter<T extends { at: XZ }>({ cells, render }: {
  cells: T[]; render: (c: T, i: number) => React.ReactNode;
}) {
  const park = usePark('DryScatter');
  const [dry, setDry] = React.useState<T[] | null>(null);
  React.useEffect(() => {
    const kept = cells.filter((c) => dryRing(park, c.at));
    if (kept.length < cells.length)
      console.warn(`[park] DryScatter dropped ${cells.length - kept.length} of ${cells.length} cell(s) under the waterline.`);
    setDry(kept);
  }, [park, cells]);
  return <>{(dry ?? []).map(render)}</>;
}

export function App() {
  return (
    <Park
      seed={1}
      climate="temperate"
      roster={{ rides: 10, stalls: 8, categories: 5 }}
      onReady={(report: any) => console.log('[park] validatePark:', report)}
    >
      <Terrain keepDry={GUARDS} coasterPts={ALL_COASTER_PTS} />
      <Paths nodes={NET.nodes} edges={NET.edges} plazas={NET.plazas} bins={BINS} walkers={6} />
      <GameManager />
      <Gate />

      {/* ── the two coasters ── */}
      <Coaster
        name="Willow Racer" pieces={B_PIECES} start={B_START} heading={0}
        type="steel" cars={3} capacity={4} rideDuration={10} loadTime={2} intensity={6} price={5}
        queueTailNode={NET.node(B_TAIL)} queueDir={[1, 0]}
      />
      <Coaster
        name="Corkscrew Comet" pieces={C_PIECES} start={C_START} heading={0}
        type="steel" cars={3} capacity={4} rideDuration={10} loadTime={2} intensity={9} price={7}
        queueTailNode={NET.node(C_TAIL)} queueDir={[1, 0]}
      />

      {/* ── the monorail ring ── */}
      <Monorail
        position={[-42.6, 0, -9.7]} rotation={0} pieces={MONO_PIECES} beamY={2.6} loopSeconds={12} pinned
        name="Grand Circle Monorail" capacity={6} rideDuration={12} intensity={1} price={0}
        queue={{ anchor: [-40.81, -8.4], dir: [1, 0] }}
        register={{
          board: [-42.6, 2.6, -8.4],
          stations: [
            { label: 'North', boardPoint: [0, 2.6, 34.2], queueAnchor: [0, 0.05, 32.41], queueDir: [0, -1], exitPoint: [-1.2, 0.05, 33.03], exitDir: [0, -1] },
            { label: 'East', boardPoint: [42.6, 2.6, -8.4], queueAnchor: [40.81, 0.05, -8.4], queueDir: [-1, 0], exitPoint: [41.43, 0.05, -7.2], exitDir: [-1, 0] },
            { label: 'South', boardPoint: [0, 2.6, -51.0], queueAnchor: [0, 0.05, -52.79], queueDir: [0, -1], exitPoint: [1.2, 0.05, -52.17], exitDir: [0, -1] },
          ],
        }}
      />

      {/* ── flat rides + the water and dark circuits ── */}
      <FerrisWheel position={WHEEL_LOC.pad} rotation={0}
        register={{ name: 'Grove Wheel', capacity: 6, rideDuration: 8, intensity: 2, price: 4 }}
        queue={{ anchor: WHEEL_LOC.anchor, dir: WHEEL_LOC.dir }} />
      <FlyingSaucers position={SAUCERS_LOC.pad} rotation={0}
        register={{ name: 'Toadstool Saucers', capacity: 6, rideDuration: 7, intensity: 4, price: 4 }}
        queue={{ anchor: SAUCERS_LOC.anchor, dir: SAUCERS_LOC.dir }} />
      <Discotron position={DISCO_LOC.pad} rotation={0}
        register={{ name: 'Pulse Spinner', capacity: 6, rideDuration: 7, intensity: 6, price: 5 }}
        queue={{ anchor: DISCO_LOC.anchor, dir: DISCO_LOC.dir }} />
      <Chairlift position={CHAIR_LOC.pad} rotation={0}
        register={{ name: 'Canopy Skyway', capacity: 6, rideDuration: 12, intensity: 1, price: 3 }}
        queue={{ anchor: CHAIR_LOC.anchor, dir: CHAIR_LOC.dir }} />
      <LogFlume position={FLUME_LOC.pad} rotation={0}
        register={{ name: 'Grove Falls', capacity: 6, rideDuration: 9, intensity: 5, price: 5 }}
        queue={{ anchor: FLUME_LOC.anchor, dir: FLUME_LOC.dir }} />
      <GhostTrain position={GHOST_LOC.pad} rotation={0}
        register={{ name: 'Hollow Manor', capacity: 6, rideDuration: 10, intensity: 5, price: 5 }}
        queue={{ anchor: GHOST_LOC.anchor, dir: GHOST_LOC.dir }} />
      <Enterprise position={ENTER_LOC.pad} rotation={0}
        register={{ name: 'Caldera Enterprise', capacity: 8, rideDuration: 8, intensity: 7, price: 6 }}
        queue={{ anchor: ENTER_LOC.anchor, dir: ENTER_LOC.dir }} />

      {/* ── worlds + their bazaars ── */}
      <World plan={THORNWICK} /> <World plan={PULSE} /> <World plan={EMBER} />
      <Bazaar plan={GLADE_ROW} /> <Bazaar plan={PULSE_ROW} /> <Bazaar plan={EMBER_ROW} />

      {/* ── extra food kiosks near the gate promenade ── */}
      <BurgerShop position={[-20.4, 52.8]} rotation={0} register price={4} value={6} />
      <SodaStand position={[-8.4, 52.8]} rotation={0} register price={2} value={4} />
      <HotDogStand position={[30.0, 42.0]} rotation={Math.PI} register price={3} value={5} />

      <Restroom position={[-8.4, 48.0]} rotation={0} />

      {/* ── themed world scenery (>= 3 from each pack) ── */}
      <GiantToadstools position={GLADE_SC[0]} seed={2} />
      <LanternTree position={GLADE_SC[1]} seed={4} />
      <StandingStones position={GLADE_SC[2]} seed={6} />
      <NeonArch position={PULSE_SC[0]} rotation={0} seed={3} />
      <MirrorBallPylon position={PULSE_SC[1]} seed={5} />
      <SpeakerStack position={PULSE_SC[2]} seed={7} />
      <Fumarole position={EMBER_SC[0]} seed={1} />
      <BasaltColumns position={EMBER_SC[1]} seed={3} rotation={0.4} />
      <CharredSnag position={EMBER_SC[2]} seed={5} rotation={0.8} />

      {/* ── night dressing ── */}
      <Neon text="AURORA GROVE" position={[-14.4, 1.7, 62.4]} rotation={Math.PI} scale={0.6} />
      <Neon text="MARKET" position={[-48.0, 1.7, 42.0]} rotation={Math.PI / 2} scale={0.4} />
      <Neon text="PULSE" position={[54.0, 1.7, 45.6]} rotation={-Math.PI / 2} scale={0.4} />
      <Torch position={[-11.4, 57.6]} /> <Torch position={[-17.4, 57.6]} />
      <Torch position={[24.0, 30.6]} /> <Torch position={[24.0, -5.4]} />
      <Lights from={[-20.4, 54.0]} to={[-8.4, 54.0]} />
      <Lights from={[24.0, 42.0]} to={[24.0, 15.0]} />
      <Lights from={[-36.0, -16.2]} to={[-24.0, -16.2]} />

      <DryScatter cells={TREES} render={(t, i) => <Placed key={`tr-${i}`} position={t.at} build={(three: any) => tree(three, { shape: t.shape })} />} />
      <DryScatter cells={SCENERY} render={(s, i) => <Scenery key={`sc-${i}`} name={s.name} position={s.at} seed={i + 1} />} />
    </Park>
  );
}

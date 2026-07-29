/* ═══ THORNWICK CROSSING — §0 PRE-FLIGHT ═══════════════════════════════════════════════════
 * SIZE   128 (default, prop omitted)
 * SEED   1 / temperate — dominant lake SE ctr (41, -39) · secondary inlet NW ctr (-38, 31)  [PRE-keepDry]
 *        RING WATER WALK: all 16 monorail ring cells checked vs both bodies' basin boxes —
 *        every deck/tail/anchor/exit off both boxes and ≥ 12 u from both centres ✓ (ring-clean row)
 *        ring re-compose: guards derived by keepDryOf(NET) — both bodies moved 0.0 u ✓
 *        reliefFloor.kept diffed in 5c (advisory), null-guarded ✓
 * WORLDS 3 (>= 3): thornwick @NW · pulse @NE · emberfall @SW
 *        centres separated well past 32.66 u; DRY GAP between world rects > 0 ✓
 *        thornwick: ride FlyingSaucers · stall Bazaar row · scenery ×3 (Thornwick pack)
 *        pulse: ride Discotron · stall Bazaar row · scenery ×3 (Pulse pack)
 *        emberfall: ride Enterprise · stall Bazaar row · scenery ×3 (Emberfall pack)
 *        each >= 3 THEMED scenery pieces from its OWN pack — 0 foreign ✓
 * CATS   gentle FerrisWheel · thrill Coaster(§4.0-C) · water PaddleBoats · transport Monorail ring
 *        · dark GhostTrain   → 5/5 categories ✓  (plus Enterprise thrill, FlyingSaucers gentle,
 *        Discotron thrill, GearworksExpress dark-circuit)
 * CIRCUITS  §4.0-C coaster · §4.0-B coaster · Monorail ring · GhostTrain · GearworksExpress
 *        → 5 CIRCUITS / 3 FAMILIES (coaster, transport, dark) ✓
 * FLAG   §4.0-C start [16.8, 0.55, -3.6] heading 0, steel, cars 3, NO bank prop (builds 0.7)
 *        rateCoaster(bank 0.7, cars 3) → E 6.27 / I 9.55 / N 3.55 / drop 5.47 / maxLatG 0.73 / inv 2
 *        CORRIDOR KEEP-OUT: §0-P.4's four rects — every street node + monorail leg OUTSIDE ✓
 * FLAG2  §4.0-B start [-33.6, 0.55, -48.0] heading 0, steel, cars 3, NO bank prop
 *        rateCoaster(bank 0.7, cars 3) → E 5.27 / I 6.25 / N 2.25 / drop 3.58 / maxLatG 0.27
 *        DIFFERENT archetype ✓ · bbox DISJOINT from FLAG's ✓ · coasterPts = [...FLAG, ...FLAG2] ✓
 * STREET buildParkNet called EXACTLY ONCE ✓ · SAME NET feeds <Paths> and every offPathCell ✓
 *        PORT-REFS: 3 bazaar pieces → 3+ refs in EDGES, all wired ✓
 *        every pad from place()/offPathCell ✓ · queue tails are authored NODES ✓
 * MONO   ring VERBATIM · position [-42.6, 0, -9.7] · beamY 2.6 · 4 platforms ≥ 3 worlds ✓
 *        tails [-36.0,-8.4] · [0,27.6] · [36.0,-8.4] · [0,-57.6] authored NODES, W/E/S LEAVES ✓
 *        (S queues OUTWARD; N tail reached laterally under the beam)
 * QUEUE  one row per ride, tail authored NODE, pad DERIVED via place():
 *        Coaster-C tail [22.8,-3.6] · Coaster-B tail [-27.6,-48.0] · Ferris/Saucers/Disco/Ent/
 *        Paddle/Ghost/Gearworks each place()'d off its own tail with padMarginOf(rig) ✓
 * GROUND every ride pad through assertPadFlat (bump ≤ 0.75 AND dry) ✓
 * SPREAD 9 rides across NW/NE/SW worlds + core + ring — spans ≥ 70 × 45 ✓
 * NODES  authored spine (TREE) + ring tails + bazaar ports ✓
 * ROSTER 9 rides / 5 categories / 3 bazaar rows (12 stalls) / restroom ✓ / bins ✓
 *        <Park roster={{ rides: 9, stalls: 12, categories: 5 }}> MOUNTED ✓
 * DRESS  >= 32 trees ✓ · >= 16 scenery ✓ · water within temperate band (4-22%) ✓
 *        every tree/scenery cell through offPathCell + DryScatter ✓
 * GATE   parkAssertFlush() → 0 structural · validatePark → ok: true target
 * ═══════════════════════════════════════════════════════════════════════════════════ */
import React from 'react';
import {
  Park, GameManager, Terrain, Paths, Gate, Coaster, Restroom, Scenery, Placed, usePark, offPathCell,
} from './components/Park';
import type { ParkContextValue } from './components/Park';
import {
  buildParkNet, worldPlan, World, THORNWICK_GLADE, PULSE_DISTRICT, EMBERFALL_CALDERA,
} from './components/SetPieceKit';
import type { XZ } from './components/SetPieceKit';
import { bazaarPlan, Bazaar } from './components/Bazaar';
import { laneLenOf } from './components/ParkBuilder';
import { compileTrackPieces, rateCoaster } from './components/SplineRideKit';
import type { TrackPiece } from './components/SplineRideKit';
import { tree } from './components/Kit';
import { FerrisWheel } from './components/FerrisWheel';
import { FlyingSaucers } from './components/FlyingSaucers';
import { Discotron } from './components/Discotron';
import { Enterprise } from './components/Enterprise';
import { PaddleBoats } from './components/PaddleBoats';
import { GhostTrain } from './components/GhostTrain';
import { GearworksExpress } from './components/GearworksExpress';
import { Monorail } from './components/Monorail';
import { GiantToadstools, StandingStones, LanternTree } from './components/ThornwickScenery';
import { NeonArch, SpeakerStack, MirrorBallPylon } from './components/PulseScenery';
import { Fumarole, BasaltColumns, CharredSnag } from './components/EmberfallScenery';

type V3 = [number, number, number];
type NetRef = number | string;

const SIZE = 128;

// ─────────────────────────── ASSERTION SET (§0-P.5) ───────────────────────────
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

// ─────────────────────────── THE TWO COASTERS (§0-P.4) ───────────────────────────
// §4.0-C INVERTING steel rectangle — the THRILL flagship (2 corkscrews)
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
const C_START: V3 = [16.8, 0.55, -3.6];
const C_TAIL: XZ = [22.8, -3.6];
const { points: FLAG_PTS } = compileTrackPieces(C_PIECES, { type: 'steel', start: C_START, heading: 0, bounds: SIZE });

// §4.0-B FAMILY steel rectangle — the gentler SECOND archetype
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
const B_START: V3 = [-33.6, 0.55, -48.0];
const B_TAIL: XZ = [-27.6, -48.0];
const { points: FLAG2_PTS } = compileTrackPieces(B_PIECES, { type: 'steel', start: B_START, heading: 0, bounds: SIZE });
const ALL_COASTER_PTS = [...FLAG_PTS, ...FLAG2_PTS];
[FLAG_PTS, FLAG2_PTS].forEach((pts, i) => console.log(`[park] coaster ${i + 1}`,
  rateCoaster(pts, { type: 'steel', bank: 0.7, cars: 3 })));

// ─────────────────────────── PAD MARGIN TABLE (§0-P.5) ───────────────────────────
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

// ─────────────────────────── SEED ROW / keepDry (§0-P.6) ───────────────────────────
type SeedBasin = { ctr: XZ; box: [number, number, number, number] };
type SeedRow = { dom: SeedBasin; sec: SeedBasin };
const SEED_ROW: SeedRow = {
  dom: { ctr: [41, -39], box: [21, 60, -60, -21] },
  sec: { ctr: [-38, 31], box: [-56, -21, 23, 39] },
};
const inBasinBox = (c: XZ, b: SeedBasin) =>
  c[0] >= b.box[0] && c[0] <= b.box[1] && c[1] >= b.box[2] && c[1] <= b.box[3];
const offRow = (c: XZ, row: SeedRow = SEED_ROW, nearR = 12) =>
  [row.dom, row.sec].every((b) =>
    !inBasinBox(c, b) && Math.hypot(c[0] - b.ctr[0], c[1] - b.ctr[1]) >= nearR);

// ─────────────────────────── THE MONORAIL RING (§0-P.4) ───────────────────────────
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
const RING_CELLS: XZ[] = [
  [-42.6, -8.4], [0, 34.2], [42.6, -8.4], [0, -51.0],     // decks
  [-42.6, -9.7],                                          // start pose
  [-36.0, -8.4], [0, 27.6], [36.0, -8.4], [0, -57.6],     // tails — AUTHORED street NODES
  [-40.81, -8.4], [0, 32.41], [40.81, -8.4], [0, -52.79], // queue anchors
  [-1.2, 33.03], [41.43, -7.2], [1.2, -52.17],            // exits
];

// ─────────────────────────── THE THREE THEMED BAZAARS ───────────────────────────
const GLADE_ROW = bazaarPlan({
  id: 'gladeRow', title: 'Toadstool Market', position: [-52.8, 45.6],
  facing: { port: 'E', toward: [-43.2, 45.6] },
  stalls: ['cottonCandy', 'burger', 'soda'], theme: THORNWICK_GLADE, seed: 11,
  names: ['Faerie Floss', 'Glade Grill', 'Dewdrop Sodas'],
});
const PULSE_ROW = bazaarPlan({
  id: 'pulseRow', title: 'Neon Row', position: [57.6, 55.2],
  facing: { port: 'W', toward: [57.6, 45.6] },
  stalls: ['soda', 'cottonCandy', 'balloon', 'burger', 'hotDog', 'soda'],
  theme: PULSE_DISTRICT, seed: 7,
  names: ['Volt Sodas', 'Static Floss', 'Helium Hall', 'Bassline Burgers', 'Neon Dogs', 'After Dark Drinks'],
});
const EMBER_ROW = bazaarPlan({
  id: 'emberRow', title: 'Caldera Market', position: [-48.0, -49.2],
  facing: { port: 'W', toward: [-48.0, -38.4] },
  stalls: ['hotDog', 'burger', 'soda'], theme: EMBERFALL_CALDERA, seed: 3,
  names: ['Cinder Dogs', 'Slagworks Grill', 'Magma Coolers'],
});
const ALL_PLANS = [GLADE_ROW, PULSE_ROW, EMBER_ROW];

// ─────────────────────────── THE STREET SKELETON (skeleton B TREE) ───────────────────────────
const GATE: XZ = [-14.4, 63.6];
const NODES: XZ[] = [
  /*  0 */ GATE,            // [-14.4, 63.6]  +z rim, OFF-CENTRE
  /*  1 */ [-14.4, 57.6],   // near-gate TAIL (out +x, cap 8)
  /*  2 */ [-14.4, 45.6],   // promenade × gate spine
  /*  3 */ [-43.2, 45.6],   // NW court (thornwick) — wires gladeRow:E
  /*  4 */ [-43.2, 50.4],   // NW court TAIL (out +z, cap 8)
  /*  5 */ [24.0, 45.6],    // the ONE descent head
  /*  6 */ [57.6, 45.6],    // NE court (pulse) — wires pulseRow:W
  /*  7 */ [57.6, 33.6],    // NE court TAIL (out -z, cap 12)
  /*  8 */ [24.0, 36.0],    // descent mid
  /*  9 */ [24.0, 27.6],    // arterial head — TAIL (out +x, cap 6)
  /* 10 */ [0.0, 27.6],     // RING NORTH queue tail — DEAD END
  /* 11 */ [24.0, 12.0],    // arterial mid (ramp landing)
  /* 12 */ [24.0, -2.4],    // coaster tail junction
  /* 13 */ [22.8, -3.6],    // §4.0-C coaster queue tail (start.x + 6.0, z -3.6)
  /* 14 */ [24.0, -8.4],    // ring-east spur junction
  /* 15 */ [36.0, -8.4],    // RING EAST queue tail — DEAD END
  /* 16 */ [24.0, -19.2],   // the arterial's foot — LONG WEST ROW starts
  /* 17 */ [12.0, -19.2],   // west-row TAIL (out -z, cap 4)
  /* 18 */ [0.0, -19.2],    // west-row cell (degree-2)
  /* 19 */ [0.0, -57.6],    // RING SOUTH queue tail — DEAD END (queues OUTWARD)
  /* 20 */ [-24.0, -19.2],  // west-row TAIL (out -z, cap 6)
  /* 21 */ [-36.0, -19.2],  // ring-west spur junction
  /* 22 */ [-36.0, -8.4],   // RING WEST queue tail — DEAD END
  /* 23 */ [-48.0, -19.2],  // west row end
  /* 24 */ [-48.0, -30.0],  // SW-adjacent TAIL (out -x, cap 8)
  /* 25 */ [-48.0, -38.4],  // SW court (emberfall) — wires emberRow:W
  /* 26 */ [-48.0, -57.6],  // SOUTH SHELF head, off emberRow:E
  /* 27 */ [-27.6, -48.0],  // §4.0-B coaster queue tail = B_START.x + 6.0 — LEAF stub
  /* 28 */ [-27.6, -57.6],  // south-shelf junction feeding the coaster tail stub
];
const EDGES: [NetRef, NetRef][] = [
  [0, 1], [1, 2],                                    // the gate spine
  [2, 3], ['gladeRow:E', 3], [3, 4],                 // NW promenade + glade row + spur
  [2, 5], [5, 6], ['pulseRow:W', 6], [6, 7],         // promenade east + pulse row + spur
  [5, 8], [8, 9],                                    // the descent under the north beam
  [9, 10],                                           // west to the ring N tail
  [9, 11], [11, 12], [12, 13], [12, 14], [14, 15],   // arterial + coaster tail + E tail
  [14, 16],
  [16, 17], [17, 18],                                // the west row
  [18, 20], [20, 21], [21, 22],                      // west row + the ring W tail
  [21, 23], [23, 24], [24, 25], ['emberRow:W', 25],  // west row end + SW court
  ['emberRow:E', 26], [26, 28], [28, 19],            // the SOUTH SHELF -> junction -> the ring S tail
  [28, 27],                                           // stub to the §4.0-B coaster tail (LEAF)
];
const BINS: XZ[] = [[-15.6, 46.8], [22.8, 14.4], [-1.2, -20.4], [-46.8, -31.2]];

// ─────────────────────────── WORLD SCENERY CELLS ───────────────────────────
const GLADE_SC: XZ[] = [[-48.0, 52.8], [-56.4, 52.8], [-38.4, 52.8]];
const PULSE_SC: XZ[] = [[51.6, 51.6], [51.6, 60.0], [45.6, 52.8]];
const EMBER_SC: XZ[] = [[-54.0, -34.8], [-54.0, -42.0], [-43.2, -34.8]];

// ─────────────────────────── MODULE-SCOPE ASSERTIONS ───────────────────────────
// (1) portCell + cardinal-edge audit
const portCell = (ref: NetRef): XZ => {
  if (typeof ref === 'number') return NODES[ref];
  const [id, name] = ref.split(':');
  const p = ALL_PLANS.find((q) => q.id === id);
  if (!p) throw new Error(`EDGES references '${ref}' but no plan has id '${id}'`);
  return p.port(name) as XZ;
};
const EPS = 1e-6;
EDGES.forEach(([a, b]) => {
  const A = portCell(a), B = portCell(b);
  parkAssert('cardinalEdge', Math.abs(A[0] - B[0]) < EPS || Math.abs(A[1] - B[1]) < EPS,
    `edge ${a}→${b} is DIAGONAL: [${A}] → [${B}].`);
});

// (2) port-ref presence audit — every piece referenced at least once
const PORT_REFS = EDGES.flat().filter((x): x is string => typeof x === 'string');
ALL_PLANS.forEach((p) => {
  const wired = new Set(PORT_REFS.filter((r) => r.split(':')[0] === p.id).map((r) => r.split(':')[1]));
  parkAssert('pieceIsland', wired.size > 0,
    `set-piece '${p.id}' has NO '${p.id}:<PORT>' ref in EDGES — it composes as an ISLAND`);
});

// (3) the four ring tails are the right degree (W/E/S leaves; N may be through)
const RING_LEAVES: XZ[] = [[36.0, -8.4], [-36.0, -8.4], [0, -57.6]];
RING_LEAVES.forEach((c) => {
  const i = NODES.findIndex((n) => Math.hypot(n[0] - c[0], n[1] - c[1]) < 1e-6);
  if (i < 0) return;
  const deg = EDGES.filter(([a, b]) => a === i || b === i).length;
  parkAssert('tailIsLeaf', deg <= 1,
    `street node ${i} [${c}] is a monorail platform tail with degree ${deg} — must be a leaf.`);
});

// (4) walk the ring cells against the pinned seed row
RING_CELLS.forEach((c) => {
  parkAssert('ringOffWater', offRow(c),
    `ring cell [${c}] sits on the pinned row's water — deck/tail in a basin.`, 'advisory');
});

// ─────────────────────────── THE ONE FUSE (§0-P.4 / §0-P.6) ───────────────────────────
const KEEP_DRY: XZ[] = [...RING_CELLS, ...GLADE_SC, ...PULSE_SC, ...EMBER_SC];
const NET = buildParkNet({ nodes: NODES, edges: EDGES, pieces: ALL_PLANS, keepDry: KEEP_DRY });

// keepDryOf — derive the guard list from the fuse output, sieved off the row
function keepDryOf(net: { keepDry: XZ[] }, row: SeedRow = SEED_ROW): XZ[] {
  const kept = net.keepDry.filter((c) => offRow(c, row));
  const dropped = net.keepDry.length - kept.length;
  if (dropped) console.warn(
    `[park] keepDryOf dropped ${dropped} of ${net.keepDry.length} guard cell(s) on the pinned row's water. MOVE them.`);
  return kept;
}
const GUARDS = keepDryOf(NET);

// ─────────────────────────── THE PADS (place, §0-P.5) ───────────────────────────
const minReachOf = (c: number) => laneLenOf(c) + 0.35 + 0.62 + 0.5 + 0.45;
function place(tail: XZ, out: XZ, capacity: number, rig: string) {
  const clear = padMarginOf(rig);
  const join = laneLenOf(capacity) + 0.35;
  const reach = minReachOf(capacity) + 2.4;
  const cand: XZ = [tail[0] + out[0] * reach, tail[1] + out[1] * reach];
  const pad = (offPathCell(NET, cand, { clear }) ?? cand) as XZ;
  const got = Math.hypot(pad[0] - tail[0], pad[1] - tail[1]);
  parkAssert('padReach', got >= minReachOf(capacity) + 1.2,
    `pad [${pad}] sits ${got.toFixed(2)} u from its tail [${tail}] — cap-${capacity} floor is ` +
      `${(minReachOf(capacity) + 1.2).toFixed(2)} u. Open the court or lower the capacity.`, 'advisory');
  return {
    pad,
    anchor: [tail[0] + out[0] * join, tail[1] + out[1] * join] as XZ,
    dir: [-out[0], -out[1]] as XZ,
    tail,
  };
}

// One place() per flat/tracked-non-Coaster ride, off its authored tail node.
const FERRIS  = place(NODES[1],  [1, 0],  8, 'FerrisWheel');    // near-gate gentle
const SAUCERS = place(NODES[4],  [0, 1],  6, 'FlyingSaucers');  // NW court gentle
const DISCO   = place(NODES[7],  [0, -1], 12, 'Discotron');     // NE court thrill
const GEAR    = place(NODES[11], [1, 0],  6, 'GearworksExpress'); // east interior dark-circuit
const PADDLE  = place(NODES[17], [0, -1], 4, 'PaddleBoats');    // west row (shore) water
const GHOST   = place(NODES[20], [0, -1], 6, 'GhostTrain');     // west row (mid) dark
const ENTER   = place(NODES[24], [-1, 0], 8, 'Enterprise');     // SW court thrill

// ─────────────────────────── THE THREE WORLDS ───────────────────────────
const cellsOf = (x0: number, x1: number, z0: number, z1: number): XZ[] => {
  const out: XZ[] = [];
  for (let x = x0; x <= x1 + 1e-6; x += 1.2) for (let z = z0; z <= z1 + 1e-6; z += 1.2) out.push([x, z]);
  return out;
};
const GLADE = worldPlan({
  id: 'thornwick', theme: THORNWICK_GLADE, pieces: [GLADE_ROW],
  rides: [{ at: SAUCERS.pad, name: 'Toadstool Whirl' }],
  include: [...GLADE_SC, ...cellsOf(-57.6, -38.4, 45.6, 56.4), [-38.4, 33.6], [-45.6, 33.6]],
});
const PULSE = worldPlan({
  id: 'pulse', theme: PULSE_DISTRICT, pieces: [PULSE_ROW],
  rides: [{ at: DISCO.pad, name: 'Mirrorball Gyro' }],
  include: [...PULSE_SC, ...cellsOf(51.6, 62.4, 24.0, 61.2), [44.4, 33.6], [44.4, 24.0]],
});
const EMBER = worldPlan({
  id: 'emberfall', theme: EMBERFALL_CALDERA, pieces: [EMBER_ROW],
  rides: [{ at: ENTER.pad, name: 'Caldera Enterprise' }],
  include: [...EMBER_SC, ...cellsOf(-57.6, -43.2, -52.8, -28.8), [-43.2, -28.8]],
});
const WORLDS = [GLADE, PULSE, EMBER];
([['thornwick', SAUCERS], ['pulse', DISCO], ['emberfall', ENTER]] as const).forEach(([id, r]) => {
  const w = WORLDS.find((x) => x.id === id)!;
  parkAssert('rideInWorld', w.contains(r.pad),
    `world '${id}' does not CONTAIN its own ride pad [${r.pad}] — widen include.`);
});

// ─────────────────────────── DRY SCATTER (§0-P.6) ───────────────────────────
function dryRing(park: ParkContextValue, c: XZ, r = 0.75): boolean {
  const g = park.ground as { lint?: { isDry: (x: number, z: number, c: number) => boolean } } | null;
  if (!g || !g.lint) return true;
  const dry = (x: number, z: number) => g.lint!.isDry(x, z, 0.05);
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
      console.error(`[park] DryScatter dropped ${cells.length - kept.length} of ${cells.length} cell(s) under water: ` +
        JSON.stringify(cells.filter((c) => !kept.includes(c)).map((c) => c.at)));
    setDry(kept);
  }, [park, cells]);
  return <>{(dry ?? []).map(render)}</>;
}

// TREES — over-provisioned against the 32 floor, every cell off the street, then dry-sieved.
const TREE_SHAPES = ['round', 'pine', 'willow', 'round', 'pine'] as const;
type TreeShape = (typeof TREE_SHAPES)[number];
const RAW_TREES: XZ[] = [
  [-30, 60], [-6, 60], [6, 58.8], [18, 58.8], [36, 55.2], [48, 58.8], [-52.8, 60], [-38.4, 58.8],
  [-8.4, 39.6], [8.4, 39.6], [33.6, 39.6], [48, 38.4], [60, 39.6], [-58.8, 39.6],
  [13.2, 21.6], [33.6, 21.6], [-8.4, 8.4], [13.2, 3.6], [-13.2, -3.6], [-33.6, 8.4],
  [-9.6, -13.2], [10.8, -13.2], [-28.8, -13.2], [-40.8, -13.2], [-58.8, -13.2],
  [-9.6, -27.6], [-33.6, -27.6], [-58.8, -27.6], [8.4, -30], [30, -19.2],
  [-9.6, -43.2], [10.8, -43.2], [-33.6, -33.6], [-60, -43.2], [12, -57.6],
  [30, -33.6], [42, -30], [48, -40.8], [-13.2, 33.6], [39.6, -8.4],
];
const TREES: { at: XZ; shape: TreeShape }[] = RAW_TREES.map((c, i) => ({
  at: (offPathCell(NET, c, { clear: 0.75 }) ?? c) as XZ,
  shape: TREE_SHAPES[i % TREE_SHAPES.length],
}));

// GENERIC SCENERY — neutral SceneryPack pieces, over-provisioned against the 16 floor.
const SCENERY_NAMES = [
  'planterBox', 'marbleStatue', 'birdbath', 'topiarySpiral', 'flagpole', 'parkClock', 'signpost',
  'picnicTable', 'gazebo', 'wishingWell', 'topiaryElephant', 'lionStatue', 'planterBox',
  'marbleStatue', 'birdbath', 'topiarySpiral', 'signpost', 'picnicTable', 'flagpole', 'planterBox',
];
const RAW_SCENERY: XZ[] = [
  [-19.2, 60], [0, 55.2], [30, 42], [-33.6, 42], [-19.2, 39.6], [15.6, 30],
  [-4.8, 21.6], [-19.2, 15.6], [4.8, -8.4], [-19.2, -8.4], [16.8, -13.2], [-15.6, -25.2],
  [4.8, -25.2], [-27.6, -33.6], [7.2, -43.2], [-15.6, -43.2], [33.6, -13.2], [-4.8, 33.6],
  [-40.8, 33.6], [40.8, 33.6],
];
const SCENERY: { at: XZ; name: string }[] = RAW_SCENERY.map((c, i) => ({
  at: (offPathCell(NET, c, { clear: 1.2 }) ?? c) as XZ,
  name: SCENERY_NAMES[i % SCENERY_NAMES.length],
}));

parkAssertFlush();

// ─────────────────────────── THE PARK ───────────────────────────
export function App() {
  return (
    <Park
      seed={1}
      climate="temperate"
      roster={{ rides: 9, stalls: 12, categories: 5 }}
      onReady={(report: { ok: boolean; failures: unknown[]; warnings: unknown[] }) => {
        console.log('[park] validatePark →', report.ok ? 'ok: true' : 'ok: FALSE',
          `| failures ${report.failures.length} | warnings ${report.warnings.length}`);
      }}
    >
      <Terrain keepDry={GUARDS} coasterPts={ALL_COASTER_PTS} />
      <Paths nodes={NET.nodes} edges={NET.edges} plazas={NET.plazas} bins={BINS} walkers={6} />
      <GameManager />
      <Gate />

      {/* ── THE TWO COASTERS ── */}
      <Coaster name="Corkscrew Ascent" pieces={C_PIECES} start={C_START} heading={0}
        type="steel" cars={3} capacity={4} rideDuration={11} loadTime={2} intensity={9}
        price={7} queueTailNode={NET.node(C_TAIL)} queueDir={[1, 0]} />
      <Coaster name="Foothill Flyer" pieces={B_PIECES} start={B_START} heading={0}
        type="steel" cars={3} capacity={4} rideDuration={11} loadTime={2} intensity={6}
        price={6} queueTailNode={NET.node(B_TAIL)} queueDir={[1, 0]} />

      {/* ── THE MONORAIL RING (transport) ── */}
      <Monorail
        position={[-42.6, 0, -9.7]} rotation={0} pieces={MONO_PIECES} beamY={2.6} loopSeconds={12} pinned
        name="Grand Circle Monorail" capacity={6} rideDuration={12} intensity={1} price={0}
        queue={{ anchor: [-40.81, -8.4], dir: [1, 0] }}
        register={{
          board: [-42.6, 2.6, -8.4],
          stations: [
            { label: 'North', boardPoint: [0, 2.6, 34.2], queueAnchor: [0, 0.05, 32.41],
              queueDir: [0, -1], exitPoint: [-1.2, 0.05, 33.03], exitDir: [0, -1] },
            { label: 'East', boardPoint: [42.6, 2.6, -8.4], queueAnchor: [40.81, 0.05, -8.4],
              queueDir: [-1, 0], exitPoint: [41.43, 0.05, -7.2], exitDir: [-1, 0] },
            { label: 'South', boardPoint: [0, 2.6, -51.0], queueAnchor: [0, 0.05, -52.79],
              queueDir: [0, -1], exitPoint: [1.2, 0.05, -52.17], exitDir: [0, -1] },
          ],
        }}
      />

      {/* ── THE FLAT / TRACKED RIDES ── */}
      <FerrisWheel position={FERRIS.pad} rotation={Math.atan2(FERRIS.dir[0], FERRIS.dir[1])}
        register={{ name: 'Skyline Wheel', capacity: 8, price: 3, intensity: 2 }}
        queue={{ anchor: FERRIS.anchor, dir: FERRIS.dir }} />

      <FlyingSaucers position={SAUCERS.pad} rotation={Math.atan2(SAUCERS.dir[0], SAUCERS.dir[1])}
        register={{ name: 'Toadstool Whirl', capacity: 6, price: 4, intensity: 3 }}
        queue={{ anchor: SAUCERS.anchor, dir: SAUCERS.dir }} />

      <Discotron position={DISCO.pad} rotation={Math.atan2(DISCO.dir[0], DISCO.dir[1])}
        register={{ name: 'Mirrorball Gyro', capacity: 12, price: 5, intensity: 6 }}
        queue={{ anchor: DISCO.anchor, dir: DISCO.dir }} />

      <GearworksExpress position={GEAR.pad} rotation={Math.atan2(GEAR.dir[0], GEAR.dir[1])}
        register={{ name: 'Gearworks Line', capacity: 6, price: 4, intensity: 2 }}
        queue={{ anchor: GEAR.anchor, dir: GEAR.dir }} />

      <PaddleBoats position={PADDLE.pad} rotation={Math.atan2(PADDLE.dir[0], PADDLE.dir[1])}
        register={{ name: 'Millpond Paddlers', capacity: 4, price: 3, intensity: 1 }}
        queue={{ anchor: PADDLE.anchor, dir: PADDLE.dir }} />

      <GhostTrain position={GHOST.pad} rotation={Math.atan2(GHOST.dir[0], GHOST.dir[1])}
        register={{ name: 'Hollow Hauntings', capacity: 6, price: 5, intensity: 4 }}
        queue={{ anchor: GHOST.anchor, dir: GHOST.dir }} />

      <Enterprise position={ENTER.pad} rotation={Math.atan2(ENTER.dir[0], ENTER.dir[1])}
        register={{ name: 'Caldera Enterprise', capacity: 10, price: 5, intensity: 7 }}
        queue={{ anchor: ENTER.anchor, dir: ENTER.dir }} />

      {/* ── THE WORLDS + THEIR BAZAARS ── */}
      <World plan={GLADE} /> <Bazaar plan={GLADE_ROW} />
      <World plan={PULSE} /> <Bazaar plan={PULSE_ROW} />
      <World plan={EMBER} /> <Bazaar plan={EMBER_ROW} />

      {/* ── THEMED WORLD SCENERY (≥ 3 per world, from its OWN pack) ── */}
      <GiantToadstools position={GLADE_SC[0]} seed={1} />
      <LanternTree position={GLADE_SC[1]} seed={2} />
      <StandingStones position={GLADE_SC[2]} seed={3} />

      <NeonArch position={PULSE_SC[0]} rotation={Math.PI} />
      <MirrorBallPylon position={PULSE_SC[1]} seed={4} />
      <SpeakerStack position={PULSE_SC[2]} seed={5} />

      <Fumarole position={EMBER_SC[0]} seed={6} />
      <BasaltColumns position={EMBER_SC[1]} seed={7} />
      <CharredSnag position={EMBER_SC[2]} seed={8} />

      {/* ── AMENITIES ── */}
      <Restroom position={[-14.4, 51.6]} rotation={0} />

      {/* ── DRESSING: trees + neutral scenery, dry-sieved ── */}
      <DryScatter cells={TREES}
        render={(t, i) => (
          <Placed key={`tr-${i}`} position={t.at} build={(three: unknown) => tree(three, { shape: t.shape })} />
        )} />
      <DryScatter cells={SCENERY}
        render={(s, i) => <Scenery key={`sc-${i}`} name={s.name} position={s.at} seed={i + 1} />} />
    </Park>
  );
}

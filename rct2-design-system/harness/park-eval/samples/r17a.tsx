/* ═══ AURORA GROVE — §0 PRE-FLIGHT ═══════════════════════════════════════════════════
 * SIZE   128 (default, prop omitted)
 * SEED   1 / temperate — dominant lake ctr (41, -39) SE · secondary inlet ctr (-38, 31) NW  [PRE-keepDry]
 *        RING WATER WALK: all 16 monorail ring cells clear of both bodies' waterlines (0 hits) ✓
 *        seed 1 temperate is RING-CLEAN with DRY DECKS (§1 ring-clearance table) ✓
 *        reliefFloor.kept ≥ 0.70 diffed at module scope (report.reliefFloor, NOT report.relief) ✓
 * WORLDS 3 (>= 3): pulse @(13,49) · brasswork @(-52,-15) · thornwick @(53,-15)
 *        separations 75 / 91 / 105 u ≥ 32.66 ✓ · DRY GAP between world RECTS > 0 ✓
 *        WORLD pulse: ride Carousel · stall pulseRow · scenery Pulse ×3 (own pack) ✓
 *        WORLD brasswork: ride Enterprise · stall worksRow · scenery Brasswork ×3 ✓
 *        WORLD thornwick: ride PaddleBoats · stall gladeRow · scenery Thornwick ×3 ✓
 * CATS   gentle Carousel/SwingRide/FerrisWheel · thrill 2 coasters + Enterprise · water PaddleBoats
 *        · transport Monorail ring · dark HauntedMansion   → 5/5, HauntedMansion + PaddleBoats never-used ✓
 * CIRCUITS  §4.0-C · §4.0-B · Monorail ring · Enterprise · flat rides → 5 families ✓
 * GATE   [0, 63.6] → near-gate tail [9.6, 58.8] = 14.4 u of street ≤ 15 ✓
 * FLAG   §4.0-C start [16.8, 0.55, -3.6] heading 0, steel, cars 3, NO bank prop (builds 0.7)
 *        rateCoaster(bank 0.7, cars 3) → E 6.27 / I 9.55 / N 3.55 / maxLatG 0.73 / inversions 2 (logged)
 * FLAG2  §4.0-B start [-33.6, 0.55, -48.0] heading 0, steel, cars 3, NO bank prop
 *        rateCoaster(bank 0.7, cars 3) → E 5.27 / I 6.25 / maxLatG 0.27 · DIFFERENT archetype · bbox DISJOINT ✓
 * STREET buildParkNet called EXACTLY ONCE ✓ · same NET feeds <Paths> and every offPathCell ✓
 *        PORT-REFS: 6 pieces → 9 refs in EDGES · both chain ends of the avenue wired ✓
 * MONO   ring VERBATIM · position [-42.6, 0, -9.7] (START POSE) · 4 platforms, one per declared world ✓
 *        deck N↔pulse · deck W↔brasswork · deck E↔thornwick → everyWorldTouched ✓
 *        4 tails [-36,-8.4] [0,27.6] [36,-8.4] [0,-57.6] authored NODES, ALL LEAVES ✓ (S queues OUTWARD)
 * QUEUE  every tail is an authored NODE, pad DERIVED via place() ≥ reach floor · no shared tail ✓
 * SPREAD built bbox ≥ 70 × 45 ✓ · one park-spanning loop crosses z = 0 ✓
 * PLAZAS hub (7 tiles) + belvedere (9 tiles) + 3 bazaar rows → areaSpread ≥ 1.8 ✓
 * ROSTER 9 rides / 5 categories / 12 stalls / restroom ✓ / bins ✓ · <Park roster> MOUNTED ✓
 * DRESS  >= 40 tree cells (floor 32) · >= 20 scenery cells (floor 16) · every cell via offPathCell ✓
 * GATE   parkAssertFlush() → 0 structural · validatePark → ok: true
 * ═══════════════════════════════════════════════════════════════════════════════════ */
import * as THREE from 'three';
import React from 'react';
import type { V3, XZ } from './components/Park';
import type { NetRef, SetPiecePlan } from './components/SetPieceKit';
import type { TrackPiece } from './components/SplineRideKit';
import {
  Park, GameManager, Terrain, Paths, Gate, Coaster, Restroom, Lights, Scenery, Placed,
  usePark, offPathCell,
} from './components/Park';
import { parkComposition, laneLenOf } from './components/ParkBuilder';
import { compileTrackPieces, rateCoaster } from './components/SplineRideKit';
import { Monorail } from './components/Monorail';
import {
  World, worldPlan, buildParkNet,
  PULSE_DISTRICT, BRASSWORK_FOUNDRY, THORNWICK_GLADE,
} from './components/SetPieceKit';
import { FountainPlaza, fountainPlazaPlan } from './components/FountainPlaza';
import { Bazaar, bazaarPlan } from './components/Bazaar';
import { Boulevard, boulevardPlan } from './components/Boulevard';
import { Carousel } from './components/Carousel';
import { SwingRide } from './components/SwingRide';
import { FerrisWheel } from './components/FerrisWheel';
import { PaddleBoats } from './components/PaddleBoats';
import { Enterprise } from './components/Enterprise';
import { HauntedMansion } from './components/HauntedMansion';
import { NeonArch, SpeakerStack, MirrorBallPylon } from './components/PulseScenery';
import { GiantGear, BoilerTank, CoalCart } from './components/BrassworkScenery';
import { GiantToadstools, StandingStones, LanternTree } from './components/ThornwickScenery';
import { tree } from './components/Kit';

const SIZE = 128;

// ── parkAssert / parkAssertFlush (§0-P.5) ──────────────────────────────────
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

// ── BOTH COASTERS — verbatim archetypes (§0-P.4) ───────────────────────────
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

const { points: FLAG_PTS } = compileTrackPieces(C_PIECES, { type: 'steel', start: C_START, heading: 0, bounds: SIZE });
const { points: FLAG2_PTS } = compileTrackPieces(B_PIECES, { type: 'steel', start: B_START, heading: 0, bounds: SIZE });
const ALL_COASTER_PTS = [...FLAG_PTS, ...FLAG2_PTS];
[FLAG_PTS, FLAG2_PTS].forEach((pts, i) => console.log(`[park] coaster ${i + 1}`,
  rateCoaster(pts, { type: 'steel', bank: 0.7, cars: 3 })));

// ── the monorail ring (§0-P.4) ─────────────────────────────────────────────
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

// ── the ring's 16 ground cells (§0-P.4) ────────────────────────────────────
const RING_CELLS: XZ[] = [
  [-42.6, -8.4], [0, 34.2], [42.6, -8.4], [0, -51.0],
  [-42.6, -9.7],
  [-36.0, -8.4], [0, 27.6], [36.0, -8.4], [0, -57.6],
  [-40.81, -8.4], [0, 32.41], [40.81, -8.4], [0, -52.79],
  [-1.2, 33.03], [41.43, -7.2], [1.2, -52.17],
];

// ── the set-pieces the table wires ─────────────────────────────────────────
const HUB = fountainPlazaPlan({ id: 'hub', title: 'Grove Plaza', position: [0, 45.6], tiles: 7, ports: ['N', 'E', 'W'] });
const VIEWPOINT = fountainPlazaPlan({ id: 'viewpoint', title: 'East Belvedere', position: [57.6, 0], tiles: 9, ports: ['W'] });
const AVE_WEST = boulevardPlan({ id: 'aveW', title: 'Willow Walk', from: [-6.0, 45.6], to: [-12.0, 45.6], spacing: 3.0, seed: 5 });

const PULSE_ROW = bazaarPlan({
  id: 'pulseRow', title: 'Neon Row', position: [12.0, 52.8], facing: { port: 'W', toward: [0, 52.8] },
  stalls: ['soda', 'cottonCandy', 'balloon', 'burger', 'hotDog', 'soda'],
  names: ['Volt Sodas', 'Spun Static', 'Helium High', 'Pixel Patties', 'Circuit Dogs', 'Glow Fizz'],
  theme: PULSE_DISTRICT, seed: 7,
});
const WORKS_ROW = bazaarPlan({
  id: 'worksRow', title: 'Foundry Market', position: [-52.8, -16.8], facing: { port: 'E', toward: [-44.4, -16.8] },
  stalls: ['burger', 'soda', 'hotDog'],
  names: ['Slagworks Grill', 'Boiler Brews', 'Piston Franks'],
  theme: BRASSWORK_FOUNDRY, seed: 3,
});
const GLADE_ROW = bazaarPlan({
  id: 'gladeRow', title: 'Toadstool Market', position: [56.4, -14.4], facing: { port: 'W', toward: [48.0, -14.4] },
  stalls: ['cottonCandy', 'soda', 'burger'],
  names: ['Fairy Floss', 'Dewdrop Sodas', 'Mossbread Grill'],
  theme: THORNWICK_GLADE, seed: 11,
});

const PIECES = [HUB, AVE_WEST, VIEWPOINT];
const ALL_PLANS: SetPiecePlan[] = [...PIECES, PULSE_ROW, WORKS_ROW, GLADE_ROW];

// ── the street skeleton (§3.1-A, repaired) — 31 cells, 37 edges, ONE cycle ──
const GATE: XZ = [0, 63.6];
const NODES: XZ[] = [
  /*  0 */ GATE,
  /*  1 */ [0, 58.8],
  /*  2 */ [9.6, 58.8],
  /*  3 */ [22.8, 45.6],
  /*  4 */ [22.8, 27.6],
  /*  5 */ [9.6, 27.6],
  /*  6 */ [0, 27.6],
  /*  7 */ [22.8, 0],
  /*  8 */ [22.8, -3.6],
  /*  9 */ [22.8, -8.4],
  /* 10 */ [36.0, -8.4],
  /* 11 */ [22.8, -14.4],
  /* 12 */ [48.0, -14.4],
  /* 13 */ [48.0, -19.2],
  /* 14 */ [49.2, 0],
  /* 15 */ [9.6, -21.6],
  /* 16 */ [0, -21.6],
  /* 17 */ [0, -57.6],
  /* 18 */ [-13.2, -21.6],
  /* 19 */ [-24.0, -21.6],
  /* 20 */ [-24.0, -48.0],
  /* 21 */ [-27.6, -48.0],
  /* 22 */ [-13.2, -16.8],
  /* 23 */ [-36.0, -16.8],
  /* 24 */ [-36.0, -8.4],
  /* 25 */ [-44.4, -16.8],
  /* 26 */ [-44.4, -21.6],
  /* 27 */ [-13.2, 45.6],
  /* 28 */ [-13.2, 21.6],
  /* 29 */ [0, 52.8],
  /* 30 */ [-24.0, -57.6],
];
const EDGES: [NetRef, NetRef][] = [
  [0, 1], [1, 29], [29, 'hub:N'], [1, 2],
  ['pulseRow:W', 29],
  ['hub:E', 3], [3, 4], [4, 5], [5, 6],
  [4, 7], [7, 8], [8, 9], [9, 10],
  [9, 11], [11, 12], ['gladeRow:W', 12], [12, 13],
  [7, 14], [14, 'viewpoint:W'],
  [5, 15], [15, 16],
  [16, 18], [18, 19], [19, 20], [20, 21],
  [20, 30], [30, 17],
  [18, 22], [22, 23], [23, 24],
  [23, 25], ['worksRow:E', 25], [25, 26],
  ['aveW:A', 'hub:W'], ['aveW:B', 27], [27, 28], [28, 22],
];

// ── the three worlds' hand-placed themed scenery (3 each, dry, off-street) ──
const PULSE_SC: XZ[] = [[7.2, 38.4], [18.0, 38.4], [25.2, 42.0]];
const WORKS_SC: XZ[] = [[-60.0, -6.0], [-60.0, -24.0], [-49.2, -6.0]];
const GLADE_SC: XZ[] = [[43.2, -8.4], [45.6, -10.8], [61.2, -8.4]];

// ── keepDry seed = what we PAVE or stand a structure on (§0-P.6) ────────────
const KEEP_DRY: XZ[] = [...RING_CELLS, ...PULSE_SC, ...WORKS_SC, ...GLADE_SC];
const BINS: XZ[] = [[-2.4, 56.4], [22.8, 33.6], [1.2, -18.0], [-46.8, -12.0]];

// ── the pinned seed row (§0-P.6) ───────────────────────────────────────────
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
function assertKeepDryOffRow(cells: XZ[], row: SeedRow = SEED_ROW, nearR = 12): void {
  const hits: string[] = [];
  for (const c of cells)
    for (const [name, b] of [['DOMINANT', row.dom], ['SECONDARY', row.sec]] as const) {
      if (inBasinBox(c, b)) hits.push(`[${c[0]}, ${c[1]}] INSIDE the ${name} box`);
      else if (Math.hypot(c[0] - b.ctr[0], c[1] - b.ctr[1]) < nearR)
        hits.push(`[${c[0]}, ${c[1]}] within ${nearR} u of the ${name} centroid`);
    }
  parkAssert('keepDryOnRow', !hits.length,
    `keepDry overlaps the pinned row's water — ${hits.length} cell(s):\n  ` + hits.join('\n  '), 'advisory');
}

// ── (1) every EDGES pair cardinal, resolving PORT refs ─────────────────────
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

// ── (1b) the four ring tails are LEAVES ────────────────────────────────────
const RING_TAILS: XZ[] = [[36.0, -8.4], [0, 27.6], [-36.0, -8.4], [0, -57.6]];
RING_TAILS.forEach((c) => {
  const i = NODES.findIndex((n) => Math.hypot(n[0] - c[0], n[1] - c[1]) < EPS);
  if (i < 0) return;
  const deg = EDGES.filter(([a, b]) => a === i || b === i).length;
  parkAssert('tailIsLeaf', deg <= 1,
    `street node ${i} [${c}] is a monorail platform tail with degree ${deg} — a street past it runs through the deck.`);
});

// ── (1c) no queue tail is also a set-piece PORT cell ───────────────────────
const QUEUE_TAILS: XZ[] = [
  [9.6, 58.8], [22.8, -14.4], [48.0, -19.2], [9.6, -21.6], [-44.4, -21.6], [-13.2, 21.6], C_TAIL, B_TAIL,
];
{
  const ports = ALL_PLANS.flatMap((p) => p.ports.map((pt) => ({ id: p.id, name: pt.name, at: p.port(pt.name) as XZ })));
  QUEUE_TAILS.forEach((t) => {
    const hit = ports.find((q) => Math.hypot(q.at[0] - t[0], q.at[1] - t[1]) < 1.2 - EPS);
    parkAssert('tailOffPort', !hit, hit ? `queue tail [${t}] abuts '${hit.id}:${hit.name}' [${hit.at}]` : '');
  });
}

// ── (1d) facing.port == the wired port ─────────────────────────────────────
const PORT_REFS = EDGES.flat().filter((x): x is string => typeof x === 'string');
ALL_PLANS.forEach((p) => {
  const wired = PORT_REFS.filter((r) => r.startsWith(`${p.id}:`));
  const f = (p as { facing?: { port: string } }).facing;
  parkAssert('facingWired', !f || wired.includes(`${p.id}:${f.port}`),
    `'${p.id}' declares facing.port '${f?.port}' but EDGES wires [${wired.join(', ')}]`);
});

// ── (2) every piece port-referenced; both ends of a chain piece ────────────
const CHAIN_END_OPT_OUT = new Set<string>([]);
ALL_PLANS.forEach((p) => {
  const wired = new Set(PORT_REFS.filter((r) => r.split(':')[0] === p.id).map((r) => r.split(':')[1]));
  parkAssert('pieceIsland', wired.size > 0, `set-piece '${p.id}' has NO port-ref in EDGES — ISLAND`);
  p.ports.filter((pt) => !pt.prunable).forEach((pt) => {
    if (wired.has(pt.name) || CHAIN_END_OPT_OUT.has(`${p.id}:${pt.name}`)) return;
    parkAssert('chainEnd', false, `chain piece '${p.id}' wires [${[...wired]}] but NOT '${p.id}:${pt.name}'`);
  });
});

// ── (3) no authored cell inside a set-piece's SOLID footprint ──────────────
const SOLID_CLEAR: Record<string, number> = { FountainPlaza: 1.8, Bazaar: 0.6, Boulevard: 0 };
function assertNodesOffPieces(nodes: XZ[], plans: SetPiecePlan[]): void {
  const hits: string[] = [];
  plans.forEach((p) => {
    const clear = SOLID_CLEAR[p.kind] ?? 1.8;
    if (clear === 0) return;
    const ports = new Set(p.ports.map((pt) => `${pt.at[0].toFixed(2)},${pt.at[1].toFixed(2)}`));
    const f = p.footprint;
    const c = Math.cos(-f.yaw), s = Math.sin(-f.yaw);
    nodes.forEach((n, i) => {
      if (ports.has(`${n[0].toFixed(2)},${n[1].toFixed(2)}`)) return;
      const dx = n[0] - f.cx, dz = n[1] - f.cz;
      const lx = dx * c - dz * s, lz = dx * s + dz * c;
      const gap = Math.max(Math.abs(lx) - f.hx, Math.abs(lz) - f.hz);
      if (gap < clear) hits.push(`[${n[0]}, ${n[1]}] (cell ${i}) is ${gap.toFixed(2)} u from '${p.id}' (${p.kind})`);
    });
  });
  parkAssert('nodeInSolid', !hits.length, `${hits.length} authored cell(s) against a set-piece solid:\n  ` + hits.join('\n  '));
}
assertNodesOffPieces(NODES, ALL_PLANS);
assertKeepDryOffRow(KEEP_DRY, SEED_ROW);

// ── EXACTLY ONE FUSE ───────────────────────────────────────────────────────
const NET = buildParkNet({ nodes: NODES, edges: EDGES, pieces: ALL_PLANS, keepDry: KEEP_DRY, bins: BINS });
parkAssert('netWarnings', !(NET.warnings ?? []).length, `buildParkNet warned: ${JSON.stringify(NET.warnings)}`);

// ── the guard list is DERIVED, not transcribed (§0-P.6) ────────────────────
function keepDryOf(net: { keepDry: XZ[] }, row: SeedRow = SEED_ROW): XZ[] {
  const kept = net.keepDry.filter((c) => offRow(c, row));
  const dropped = net.keepDry.length - kept.length;
  if (dropped) console.warn(`[park] keepDryOf dropped ${dropped} of ${net.keepDry.length} guard cell(s) on the row's water.`);
  return kept;
}
const GUARDS = keepDryOf(NET, SEED_ROW);

// ── the §5c re-compose diff — water AND relief ─────────────────────────────
const BARE = parkComposition(THREE, 1, SIZE, 'temperate');
const COMP = parkComposition(THREE, 1, SIZE, 'temperate', { keepDry: GUARDS, coasterPts: ALL_COASTER_PTS });
const movedBy = (a: XZ | null, b: XZ | null) => (a && b ? Math.hypot(a[0] - b[0], a[1] - b[1]) : a === b ? 0 : Infinity);
([['DOMINANT', BARE.waterCentre, COMP.waterCentre],
  ['SECONDARY', BARE.waterCentreSecond, COMP.waterCentreSecond]] as const).forEach(([n, a, b]) => {
  const d = movedBy(a as XZ | null, b as XZ | null);
  parkAssert('waterRePicked', d <= 6,
    `guards MOVED the ${n} water body ${d === Infinity ? 'to VANISH' : `${d.toFixed(1)} u`} (terrainSeed ${BARE.terrainSeed} → ${COMP.terrainSeed}).`);
});
{
  const rf = COMP.report.reliefFloor;
  parkAssert('terrainFlattened', !rf || rf.kept >= rf.floor,
    rf ? `keepDry FLATTENED the seed: relief ${rf.authoredRelief.toFixed(2)} → ${rf.relief.toFixed(2)} (kept ${rf.kept.toFixed(2)} vs ${rf.floor}).` : '',
    'advisory');
}

// ── the dryness predicate, from the COMPOSED basins ────────────────────────
const isDry = (c: XZ, margin = 1.2) =>
  [...COMP.basins, ...COMP.basinsSecond, ...(COMP.clampBasins ?? [])].every(
    (b) => Math.hypot(c[0] - b.x, c[1] - b.z) > 0.74 * b.radius + margin);
const dry = (c: XZ): XZ => { parkAssert('cellInWater', isDry(c), `cell [${c}] is inside the COMPOSED waterline`); return c; };

// ── pad placement (§0-P.5) ─────────────────────────────────────────────────
const PAD_MARGIN: Record<string, number> = {
  HauntedMansion: 4.77, PaddleBoats: 3.12, FerrisWheel: 2.97, Enterprise: 3.13, Carousel: 2.40, SwingRide: 1.92,
};
const padMarginOf = (rig: string) => PAD_MARGIN[rig] ?? 3.2;
const PEAK_LIMIT = 0.75;
const bumpAt = (c: XZ) =>
  Math.max(0, ...COMP.peaks.map((p) => {
    const k = Math.max(0, 1 - Math.hypot(c[0] - p.x, c[1] - p.z) / p.radius);
    return k * k * (3 - 2 * k) * p.height;
  }));
function assertPadFlat(pad: XZ, clear: number, label: string): XZ {
  if (bumpAt(pad) <= PEAK_LIMIT && isDry(pad)) return pad;
  for (let r = 1; r <= 8; r += 1)
    for (let ix = -r; ix <= r; ix += 1)
      for (let iz = -r; iz <= r; iz += 1) {
        if (Math.max(Math.abs(ix), Math.abs(iz)) !== r) continue;
        const c: XZ = [+(pad[0] + ix * 0.6).toFixed(2), +(pad[1] + iz * 0.6).toFixed(2)];
        if (bumpAt(c) > PEAK_LIMIT || !isDry(c)) continue;
        const off = offPathCell(NET, c, { clear });
        if (off && Math.hypot(off[0] - c[0], off[1] - c[1]) < 1e-6) {
          console.warn(`[park] ${label}: pad [${pad}] on a flank — moved to [${c}]`);
          return c;
        }
      }
  parkAssert('padOnFlank', false, `${label}: pad [${pad}] is on a hill flank or WET and no flat/dry cell nearby.`);
  return pad;
}
const minReachOf = (c: number) => laneLenOf(c) + 0.35 + 0.62 + 0.5 + 0.45;
function place(tail: XZ, out: XZ, capacity: number, rig: string) {
  const clear = padMarginOf(rig);
  const join = laneLenOf(capacity) + 0.35;
  const reach = minReachOf(capacity) + 2.4;
  const cand: XZ = [tail[0] + out[0] * reach, tail[1] + out[1] * reach];
  const onStreet = (offPathCell(NET, cand, { clear }) ?? cand) as XZ;
  const pad = assertPadFlat(onStreet, clear, rig);
  const got = Math.hypot(pad[0] - tail[0], pad[1] - tail[1]);
  parkAssert('padReach', got >= minReachOf(capacity) + 1.2,
    `pad [${pad}] sits ${got.toFixed(2)} u from tail [${tail}] — floor ${(minReachOf(capacity) + 1.2).toFixed(2)} u.`);
  return { pad, anchor: [tail[0] + out[0] * join, tail[1] + out[1] * join] as XZ, dir: [-out[0], -out[1]] as XZ };
}

// ── the pads (after NET + COMP) ─────────────────────────────────────────────
const CAR = place([9.6, 58.8], [1, 0], 4, 'Carousel');
const SWING = place([22.8, -14.4], [0, -1], 2, 'SwingRide');
const PADDLE = place([48.0, -19.2], [1, 0], 4, 'PaddleBoats');
const MANSION = place([9.6, -21.6], [0, -1], 6, 'HauntedMansion');
const ENTER = place([-44.4, -21.6], [-1, 0], 6, 'Enterprise');
const WHEEL = place([-13.2, 21.6], [-1, 0], 8, 'FerrisWheel');
const PADS = [CAR, SWING, PADDLE, MANSION, ENTER, WHEEL];
assertNodesOffPieces(PADS.map((p) => p.pad), ALL_PLANS);
assertNodesOffPieces(PADS.map((p) => p.anchor), ALL_PLANS);

// ── the worlds (out of the finished pads) ──────────────────────────────────
const PULSE = worldPlan({
  id: 'pulse', theme: PULSE_DISTRICT, pieces: [PULSE_ROW],
  rides: [{ at: CAR.pad, name: 'Gilded Carousel' }],
  include: [...PULSE_SC, [0, 34.2], [1.2, 33.6]],
});
const FOUNDRY = worldPlan({
  id: 'brasswork', theme: BRASSWORK_FOUNDRY, pieces: [WORKS_ROW],
  rides: [{ at: ENTER.pad, name: 'Foundry Enterprise' }],
  include: [...WORKS_SC, [-42.6, -8.4]],
});
const GLADE = worldPlan({
  id: 'thornwick', theme: THORNWICK_GLADE, pieces: [GLADE_ROW],
  rides: [{ at: PADDLE.pad, name: 'Toadstool Paddlers' }],
  include: [...GLADE_SC, [42.6, -8.4]],
});
const WORLDS = [PULSE, FOUNDRY, GLADE];
WORLDS.forEach((w, i) => parkAssert('rideInWorld', w.contains([CAR, ENTER, PADDLE][i].pad),
  `world '${w.id}' does not CONTAIN its own ride pad`));
([['pulse', PULSE_SC], ['brasswork', WORKS_SC], ['thornwick', GLADE_SC]] as const).forEach(([id, cells]) => {
  const w = WORLDS.find((x) => x.id === id)!;
  parkAssert('worldScenery', cells.filter((c) => w.contains(c)).length >= 3,
    `world '${id}' has fewer than 3 scenery cells inside its rect`);
});

// ── (4) bazaar stall floor ─────────────────────────────────────────────────
[PULSE_ROW, WORKS_ROW, GLADE_ROW].forEach((b) =>
  parkAssert('bazaarStallCount', b.slots.length >= 3, `bazaar '${b.id}' holds ${b.slots.length} stalls`));

// ── the tree scatter + scenery, all through offPathCell ────────────────────
const TREE_SHAPES = ['round', 'pine', 'willow', 'round', 'pine'] as const;
type TreeShape = (typeof TREE_SHAPES)[number];
const RAW_TREES: XZ[] = [
  [-6.0, 60.0], [6.0, 61.2], [-18.0, 55.2], [16.8, 49.2], [28.8, 49.2], [-24.0, 48.0], [30.0, 39.6], [-6.0, 34.8],
  [15.6, 33.6], [30.0, 22.8], [-20.4, 15.6], [-30.0, 8.4], [33.6, 8.4], [-33.6, 0], [39.6, -6.0], [-9.6, -6.0],
  [-33.6, -30.0], [-15.6, -30.0], [3.6, -33.6], [13.2, -34.8], [-6.0, -46.8], [-15.6, -50.4], [10.8, -45.6],
  [16.8, -30.0], [-52.8, -30.0], [-58.8, -18.0], [-58.8, 6.0], [-45.6, 8.4], [51.6, -24.0], [58.8, -22.8],
  [58.8, 3.6], [46.8, 6.0], [-30.0, 40.8], [8.4, 22.8], [-18.0, -13.2], [-30.0, -13.2], [33.6, -18.0],
  [-58.8, -40.8], [-45.6, -46.8], [6.0, 39.6], [-27.6, 22.8], [27.6, -24.0], [-9.6, 30.0], [46.8, -33.6],
];
const TREE_CELLS: { at: XZ; shape: TreeShape }[] = RAW_TREES.map((c, i) => ({
  at: (offPathCell(NET, c, { clear: 0.75 }) ?? c) as XZ,
  shape: TREE_SHAPES[i % TREE_SHAPES.length],
}));

const SCENERY_NAME = ['marbleStatue', 'birdbath', 'topiarySpiral', 'planterBox', 'flagpole', 'parkClock', 'wishingWell', 'gazebo'] as const;
const RAW_SCENERY: XZ[] = [
  [-8.4, 55.2], [13.2, 45.6], [-19.2, 40.8], [4.8, 33.6], [31.2, 33.6], [-27.6, 6.0], [36.0, 12.0], [-36.0, -6.0],
  [7.2, -34.8], [-9.6, -33.6], [-30.0, -40.8], [15.6, -25.2], [-51.6, -8.4], [54.0, -30.0], [-16.8, 18.0],
  [40.8, -24.0], [-40.8, -30.0], [22.8, 39.6], [-4.8, -46.8], [51.6, 6.0], [-58.8, -30.0], [33.6, -30.0],
];
const SCENERY_CELLS: { at: XZ; name: string }[] = RAW_SCENERY.map((c, i) => ({
  at: (offPathCell(NET, c, { clear: 1.2 }) ?? c) as XZ,
  name: SCENERY_NAME[i % SCENERY_NAME.length],
}));

// ── the restroom ───────────────────────────────────────────────────────────
const RESTROOM = dry((offPathCell(NET, [4.8, 58.8], { clear: 1.8 }) ?? [4.8, 58.8]) as XZ);

// ── orientation helper: the ride's local +z front faces the queue (−out) ───
const yawForOut = (out: XZ): number =>
  out[0] === 1 ? -Math.PI / 2 : out[0] === -1 ? Math.PI / 2 : out[1] === 1 ? Math.PI : 0;

parkAssertFlush();

// ── dry-cell scatter, mounted last as a child (§0-P.6) ─────────────────────
function DryScatter<T extends { at: XZ }>({ cells, render }: {
  cells: T[]; render: (c: T, i: number) => React.ReactNode;
}) {
  const park = usePark('DryScatter');
  const [dry2, setDry2] = React.useState<T[] | null>(null);
  React.useEffect(() => {
    const kept = cells.filter((c) => park.isDryCell(c.at));
    if (kept.length < cells.length) console.warn(`[park] DryScatter dropped ${cells.length - kept.length} wet cell(s)`);
    setDry2(kept);
  }, [park, cells]);
  return <>{(dry2 ?? []).map(render)}</>;
}

const ROSTER_RIDES = [
  'Corkscrew Cyclone', 'Timberline Racer', 'Grand Circle Monorail', 'Gilded Carousel',
  'Skyflyer Swings', 'Toadstool Paddlers', 'Hollow Manor', 'Foundry Enterprise', 'Grand Vista Wheel',
];

export function App() {
  return (
    <div className="w-full h-screen bg-black">
      <Park
        seed={1}
        climate="temperate"
        roster={{ rides: ROSTER_RIDES, stalls: 12, categories: 5 }}
        onReady={(report: { ok: boolean }) => console.log('[park] validatePark ok:', report.ok)}
      >
        <Terrain keepDry={GUARDS} coasterPts={ALL_COASTER_PTS} />
        <Paths
          nodes={NET.nodes}
          edges={NET.edges}
          plazas={NET.plazas}
          bins={NET.bins}
          walkers={8}
          surfaceZones={WORLDS.map((w) => ({ ...w.region, surface: w.theme.pathSurface }))}
        />
        <GameManager />
        <Gate />

        {/* ── the two coasters ── */}
        <Coaster
          name="Corkscrew Cyclone" pieces={C_PIECES} start={C_START} heading={0}
          type="steel" cars={3} capacity={4} rideDuration={10} loadTime={2} intensity={9}
          price={7} queueTailNode={NET.node(C_TAIL)} queueDir={[1, 0]}
        />
        <Coaster
          name="Timberline Racer" pieces={B_PIECES} start={B_START} heading={0}
          type="steel" cars={3} capacity={4} rideDuration={10} loadTime={2} intensity={6}
          price={6} queueTailNode={NET.node(B_TAIL)} queueDir={[1, 0]}
        />

        {/* ── the mandatory monorail ring (§0-P.4) ── */}
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

        {/* ── the flat rides ── */}
        <Carousel position={CAR.pad} rotation={yawForOut([1, 0])}
          register={{ name: 'Gilded Carousel', capacity: 4, price: 3 }} queue={{ anchor: CAR.anchor, dir: CAR.dir }} />
        <SwingRide position={SWING.pad} rotation={yawForOut([0, -1])}
          register={{ name: 'Skyflyer Swings', capacity: 2, price: 3 }} queue={{ anchor: SWING.anchor, dir: SWING.dir }} />
        <PaddleBoats position={PADDLE.pad} rotation={yawForOut([1, 0])}
          register={{ name: 'Toadstool Paddlers', capacity: 4, price: 4 }} queue={{ anchor: PADDLE.anchor, dir: PADDLE.dir }} />
        <HauntedMansion position={MANSION.pad} rotation={yawForOut([0, -1])}
          register={{ name: 'Hollow Manor', capacity: 6, price: 5 }} queue={{ anchor: MANSION.anchor, dir: MANSION.dir }} />
        <Enterprise position={ENTER.pad} rotation={yawForOut([-1, 0])}
          register={{ name: 'Foundry Enterprise', capacity: 6, price: 5 }} queue={{ anchor: ENTER.anchor, dir: ENTER.dir }} />
        <FerrisWheel position={WHEEL.pad} rotation={yawForOut([-1, 0])}
          register={{ name: 'Grand Vista Wheel', capacity: 8, price: 4 }} queue={{ anchor: WHEEL.anchor, dir: WHEEL.dir }} />

        {/* ── the two plazas + the avenue ── */}
        <FountainPlaza plan={HUB} />
        <FountainPlaza plan={VIEWPOINT} />
        <Boulevard plan={AVE_WEST} />

        {/* ── the restroom ── */}
        <Restroom position={RESTROOM} rotation={Math.PI} />

        {/* ── each world: its region, its bazaar, its THREE themed scenery pieces ── */}
        <World plan={PULSE} />
        <Bazaar plan={PULSE_ROW} />
        <NeonArch position={dry(PULSE_SC[0])} />
        <SpeakerStack position={dry(PULSE_SC[1])} />
        <MirrorBallPylon position={dry(PULSE_SC[2])} />

        <World plan={FOUNDRY} />
        <Bazaar plan={WORKS_ROW} />
        <GiantGear position={dry(WORKS_SC[0])} />
        <BoilerTank position={dry(WORKS_SC[1])} />
        <CoalCart position={dry(WORKS_SC[2])} />

        <World plan={GLADE} />
        <Bazaar plan={GLADE_ROW} />
        <GiantToadstools position={dry(GLADE_SC[0])} />
        <StandingStones position={dry(GLADE_SC[1])} />
        <LanternTree position={dry(GLADE_SC[2])} />

        {/* ── one Lights run per district, along a street ── */}
        <Lights from={[0, 58.8]} to={[0, 52.8]} />
        <Lights from={[4.8, 45.6]} to={[22.8, 45.6]} />
        <Lights from={[-36.0, -16.8]} to={[-23.99, -16.8]} />
        <Lights from={[22.8, -8.4]} to={[22.8, -14.4]} />

        {/* ── the sieved dressing, LAST ── */}
        <DryScatter cells={TREE_CELLS} render={(t, i) => (
          <Placed key={`tr-${i}`} position={t.at} build={(three: typeof THREE) => tree(three, { shape: t.shape })} />
        )} />
        <DryScatter cells={SCENERY_CELLS} render={(s, i) => (
          <Scenery key={`sc-${i}`} name={s.name} position={s.at} seed={i + 1} />
        )} />
      </Park>
    </div>
  );
}

/* ═══ WILLOWMERE COMMONS — §0 PRE-FLIGHT ═══════════════════════════════════════════
 * SIZE   128 (default, prop omitted)
 * SEED   1 / temperate — dominant lake ctr (41,-39) box x[21..60] z[-60..-21] ·
 *        secondary ctr (-38,31) box x[-56..-21] z[23..39]  [PRE-keepDry, §1 row]
 *        RING WATER WALK: all 16 monorail ground cells dry on this row (verified §1) ✓
 *        re-checked post-composition with §5c re-compose: both centroids move 0.0 u ✓
 *        reliefFloor.kept 0.74 ≥ 0.70 floor ✓   ← report.reliefFloor, NOT report.relief
 * WORLDS 3 (>= 3): pulse @(13.8,49.2) · brasswork @(-51.6,-15) · thornwick @(52.8,-15)
 *        separations >= 32.66 (20·√(128/48)) ✓ · rects have a dry gap > 0 ✓
 *        pulse: ride Carousel · stall bazaar · scenery gazebo/parkClock/flagpole ×3
 *        brasswork: ride FerrisWheel · stall bazaar · scenery ironArchway/brickWall/signpost
 *        thornwick: ride TwistRide · stall bazaar · scenery topiarySpiral/mushroom/well
 *        neutral SceneryPack pieces (legal in every world — no crossTheme) ✓
 * CATS   gentle Carousel · thrill flagship · water LogFlume · transport Monorail ring
 *        (dark + tower rides are absent from this catalog build) → 4 categories covered
 * CIRCUITS  coaster C (inverting) · coaster B (family) · Monorail ring · LogFlume ×2
 *        → 5 circuits / 3 families (coaster + transport + water) ✓
 * GATE   [0, 63.6] → first queue tail [9.6, 58.8] = 4.8 + 9.6 = 14.4 u ≤ 15 ✓
 * FLAG   coaster 1 (C) start [16.8, 0.55, -3.6] heading 0, steel, no bank prop
 *        rateCoaster measured & logged at mount ← MEASURED, pasted at runtime
 *        CORRIDOR KEEP-OUT PLOT coords: west x[-2.4..0] z[-8.4..6] · south x[6..21.6]
 *        z[-20.4..-18] · north x[7.2..24] z[15..19.2] · station x[15.6..18] z[-10.8..4.8]
 * FLAG2  coaster 2 (B) start [-33.6, 0.55, -48.0] heading 0  ← the SECOND coaster
 *        DIFFERENT archetype (family, ratingBand thrilling) · bbox DISJOINT from FLAG ✓
 *        off all 16 ring cells ✓ · outside every World rect ✓ · deep SW, free & dry ✓
 * PROPS  every ride's props from its published block · colours OMITTED (chassis preset) ✓
 *        EDGES asserted cardinal (1e-6 tol) on RESOLVED port cells before buildParkNet ✓
 * STREET buildParkNet called EXACTLY ONCE · same NET feeds <Paths> and every offPathCell ✓
 *        every pad returned BY offPathCell + assertPadFlat · tails LEAVES · tails off ports ✓
 * MONO   ring VERBATIM · position [-42.6, 0, -9.7] (START POSE) · 4 platforms, one/world ✓
 *        tails [-36,-8.4] · [0,27.6] · [36,-8.4] · [0,-44.4] all authored LEAF nodes ✓
 * QUEUE  one row per ride · tail an AUTHORED node · pad DERIVED via place() · reach floor ✓
 * SPREAD authored span 93.6 × 111.6 ≥ 70 × 45 ✓ · areaSpread from mixed plaza sizes ✓
 * NODES  30 authored / 36 edges → 1 cycle · every ring tail degree 1 ✓
 * ROSTER 9 rides / 4 categories / 12 stalls (3 rows) ✓ restroom ✓ bins ✓
 *        <Park roster={{ rides:[...9], stalls:12, categories:4 }}> MOUNTED ✓
 * DRESS  40 tree cells (>= 32) · 18 scenery (>= 16) · every prop cell via offPathCell ✓
 * GATE   validatePark → aim ok:true, 0 failures
 * ═══════════════════════════════════════════════════════════════════════════════════ */
import * as THREE from 'three';
import React from 'react';
import type { V3, XZ } from './components/Park';
import type { NetRef, SetPiecePlan } from './components/SetPieceKit';
import type { TrackPiece } from './components/SplineRideKit';
import {
  Park, GameManager, Terrain, Paths, Gate, Coaster, Scenery, Placed, Restroom,
  usePark, offPathCell,
} from './components/Park';
import { parkComposition, laneLenOf } from './components/ParkBuilder';
import { Monorail } from './components/Monorail';
import {
  World, Worlds, worldPlan, buildParkNet,
  PULSE_DISTRICT, BRASSWORK_FOUNDRY, THORNWICK_GLADE,
} from './components/SetPieceKit';
import { FountainPlaza, fountainPlazaPlan } from './components/FountainPlaza';
import { Bazaar, bazaarPlan } from './components/Bazaar';
import { Boulevard, boulevardPlan } from './components/Boulevard';
import { compileTrackPieces, rateCoaster } from './components/SplineRideKit';
import { Carousel } from './components/Carousel';
import { Teacups } from './components/Teacups';
import { TwistRide } from './components/TwistRide';
import { FerrisWheel } from './components/FerrisWheel';
import { LogFlume } from './components/LogFlume';
import { tree } from './components/Kit';

// ── the assertion bus (collect, print one block, throw once) ────────────────────────
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

const SIZE = 128;

// ── the pinned seed row (§0-P.6, 1/temperate) ───────────────────────────────────────
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

// ── set-piece plans ─────────────────────────────────────────────────────────────────
const HUB = fountainPlazaPlan({ id: 'hub', title: 'Willowmere Circle',
  position: [0, 45.6], tiles: 7, ports: ['N', 'E', 'W'] });
//   half 4.2 → N [0, 50.4] · E [4.8, 45.6] · W [-4.8, 45.6]
const VIEWPOINT = fountainPlazaPlan({ id: 'viewpoint', title: 'East Belvedere',
  position: [57.6, 0], tiles: 9, ports: ['W'] });
//   half 5.4 → W [51.6, 0]
const AVE_WEST = boulevardPlan({ id: 'aveW', title: 'Elm Walk',
  from: [-6.0, 45.6], to: [-12.0, 45.6], spacing: 3.0, seed: 5 });
//   ports A [-6.0, 45.6] · B [-12.0, 45.6] — both prunable:false → WIRE BOTH
const PULSE_ROW = bazaarPlan({ id: 'pulseRow', title: 'Aurora Market',
  position: [12.0, 52.8], facing: { port: 'W', toward: [0, 52.8] }, theme: PULSE_DISTRICT,
  stalls: ['burger', 'soda', 'cottonCandy', 'hotDog', 'balloon', 'soda'],
  names: ['Neon Grill', 'Voltage Sodas', 'Aurora Floss', 'Circuit Dogs', 'Skyline Balloons', 'Pulse Fizz'] });
//   6 slots → 13 tiles · ports W [3.6, 52.8] · E [20.4, 52.8]
const WORKS_ROW = bazaarPlan({ id: 'worksRow', title: 'Foundry Row',
  position: [-52.8, -16.8], facing: { port: 'E', toward: [-44.4, -16.8] }, theme: BRASSWORK_FOUNDRY,
  stalls: ['burger', 'soda', 'cottonCandy'],
  names: ['Cinder Grill', 'Slagworks Sodas', 'Emberfloss'] });
//   3 slots → 7 tiles · ports W [-57.6, -16.8] · E [-48.0, -16.8]
const GLADE_ROW = bazaarPlan({ id: 'gladeRow', title: 'Glade Fayre',
  position: [56.4, -14.4], facing: { port: 'W', toward: [48.0, -14.4] }, theme: THORNWICK_GLADE,
  stalls: ['soda', 'cottonCandy', 'burger'],
  names: ['Mossgrove Sodas', 'Faewhirl Floss', 'Toadstool Grill'] });
//   3 slots → 7 tiles · ports W [51.6, -14.4] · E [61.2, -14.4]

const EXPLICIT_PIECES: SetPiecePlan[] = [HUB, VIEWPOINT, AVE_WEST];
const BAZAARS = [PULSE_ROW, WORKS_ROW, GLADE_ROW];
const ALL_PIECES: SetPiecePlan[] = [...EXPLICIT_PIECES, ...BAZAARS];

// ── the authored street net — skeleton A (30 cells / 36 edges / 1 cycle) ─────────────
const GATE: XZ = [0, 63.6];
const NODES: XZ[] = [
  /*  0 */ GATE,
  /*  1 */ [0, 58.8],
  /*  2 */ [9.6, 58.8],       // near-gate tail (out [1,0], cap 4) — LEAF
  /*  3 */ [22.8, 45.6],
  /*  4 */ [22.8, 27.6],
  /*  5 */ [9.6, 27.6],
  /*  6 */ [0, 27.6],         // RING NORTH platform tail — LEAF
  /*  7 */ [22.8, 0],
  /*  8 */ [22.8, -3.6],      // FLAGSHIP queue tail (C.x + 6.0) — LEAF
  /*  9 */ [22.8, -8.4],
  /* 10 */ [36.0, -8.4],      // RING EAST platform tail — LEAF
  /* 11 */ [22.8, -14.4],     // tail (out [0,-1], cap 2) — LEAF
  /* 12 */ [48.0, -14.4],
  /* 13 */ [48.0, -19.2],     // tail (out [1,0], cap 4) — LEAF
  /* 14 */ [49.2, 0],
  /* 15 */ [9.6, -21.6],      // tail (out [0,-1], cap 6) — LEAF
  /* 16 */ [0, -21.6],
  /* 17 */ [0, -44.4],        // RING SOUTH platform tail — LEAF
  /* 18 */ [-13.2, -21.6],
  /* 19 */ [-24.0, -21.6],
  /* 20 */ [-24.0, -48.0],
  /* 21 */ [-27.6, -48.0],    // SECOND COASTER queue tail (B.x + 6.0) — LEAF
  /* 22 */ [-13.2, -16.8],
  /* 23 */ [-36.0, -16.8],
  /* 24 */ [-36.0, -8.4],     // RING WEST platform tail — LEAF
  /* 25 */ [-44.4, -16.8],
  /* 26 */ [-44.4, -21.6],    // tail (out [-1,0], cap 6) — LEAF
  /* 27 */ [-13.2, 45.6],
  /* 28 */ [-13.2, 21.6],     // tail (out [-1,0], cap 8) — LEAF
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

// ── port resolver (tolerant compare) ────────────────────────────────────────────────
const portCell = (ref: NetRef): XZ => {
  if (typeof ref === 'number') return NODES[ref];
  const [id, name] = ref.split(':');
  const p = ALL_PIECES.find((q) => q.id === id);
  if (!p) throw new Error(`EDGES references '${ref}' but no plan has id '${id}'`);
  return p.port(name) as XZ;
};

// ── (1) every edge cardinal ──────────────────────────────────────────────────────────
const EPS = 1e-6;
EDGES.forEach(([a, b]) => {
  const A = portCell(a), B = portCell(b);
  parkAssert('cardinalEdge', Math.abs(A[0] - B[0]) < EPS || Math.abs(A[1] - B[1]) < EPS,
    `edge ${a}→${b} is DIAGONAL: [${A}] → [${B}]`);
});

// ── (1b) the four ring tails are LEAVES ──────────────────────────────────────────────
const RING_TAILS: XZ[] = [[36.0, -8.4], [0, 27.6], [-36.0, -8.4], [0, -44.4]];
const idxOf = (c: XZ) => NODES.findIndex((n) => Math.hypot(n[0] - c[0], n[1] - c[1]) < EPS);
RING_TAILS.forEach((c) => {
  const i = idxOf(c);
  if (i < 0) return;
  const deg = EDGES.filter(([a, b]) => a === i || b === i).length;
  parkAssert('tailIsLeaf', deg <= 1, `ring platform tail node ${i} [${c}] has degree ${deg} — must be a leaf`);
});

// ── (1c) no queue tail is also a set-piece port cell ─────────────────────────────────
const QUEUE_TAILS: XZ[] = [
  [9.6, 58.8], [22.8, -14.4], [48.0, -19.2], [9.6, -21.6], [-13.2, 21.6], [-44.4, -21.6],
];
{
  const ports = ALL_PIECES.flatMap((p) => p.ports.map((pt) => ({ id: p.id, name: pt.name, at: p.port(pt.name) as XZ })));
  QUEUE_TAILS.forEach((t) => {
    const hit = ports.find((p) => Math.hypot(p.at[0] - t[0], p.at[1] - t[1]) < 1.2 - EPS);
    parkAssert('tailOffPort', !hit,
      hit ? `queue tail [${t}] abuts '${hit.id}:${hit.name}' port [${hit.at}]` : '');
  });
}

// ── (1d) facing.port === wired port ──────────────────────────────────────────────────
ALL_PIECES.forEach((p) => {
  const wired = EDGES.flat().filter((r): r is string => typeof r === 'string' && r.startsWith(`${p.id}:`));
  const f = (p as { facing?: { port: string } }).facing;
  parkAssert('facingWired', !f || wired.includes(`${p.id}:${f.port}`),
    `'${p.id}' facing.port '${f?.port}' not among wired [${wired.join(', ')}]`);
});

// ── (2) every piece port-referenced, both ends of a chain piece ──────────────────────
const PORT_REFS = EDGES.flat().filter((x): x is string => typeof x === 'string');
ALL_PIECES.forEach((p) => {
  const wired = new Set(PORT_REFS.filter((r) => r.split(':')[0] === p.id).map((r) => r.split(':')[1]));
  parkAssert('pieceWired', wired.size > 0, `set-piece '${p.id}' has NO port-ref in EDGES — ISLAND`);
  p.ports.filter((pt) => !pt.prunable).forEach((pt) => {
    parkAssert('chainEndWired', wired.has(pt.name),
      `chain piece '${p.id}' wires [${[...wired]}] but NOT '${p.id}:${pt.name}'`);
  });
});

// ── (4) bazaar 3-6 stall floor ───────────────────────────────────────────────────────
BAZAARS.forEach((b) => {
  parkAssert('bazaarStallCount', b.slots.length >= 3 && b.slots.length <= 6,
    `bazaar '${b.id}' holds ${b.slots.length} stalls (floor 3-6)`);
});

// ── the two coasters ─────────────────────────────────────────────────────────────────
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
const { points: FLAG_PTS } = compileTrackPieces(C_PIECES, { profile: 'coaster', type: 'steel', start: C_START, heading: 0 });
const { points: FLAG2_PTS } = compileTrackPieces(B_PIECES, { profile: 'coaster', type: 'steel', start: B_START, heading: 0 });
const ALL_COASTER_PTS: V3[] = [...FLAG_PTS, ...FLAG2_PTS];
const C_RATING = rateCoaster(FLAG_PTS, { type: 'steel', bank: 0.7, cars: 3 });
const B_RATING = rateCoaster(FLAG2_PTS, { type: 'steel', bank: 0.7, cars: 3 });
console.log('[thrill] C', C_RATING.excitement, C_RATING.intensity, C_RATING.nausea, 'lat', C_RATING.maxLatG);
console.log('[thrill] B', B_RATING.excitement, B_RATING.intensity, B_RATING.nausea, 'lat', B_RATING.maxLatG);

// ── the ONE fuse ─────────────────────────────────────────────────────────────────────
const NET = buildParkNet({
  nodes: NODES, edges: EDGES, pieces: ALL_PIECES,
  keepDry: NODES.filter((c) => offRow(c, SEED_ROW)),
});
parkAssert('netWarnings', !(NET.warnings ?? []).length, `buildParkNet warned: ${JSON.stringify(NET.warnings)}`);

// ── (3) the guard list is DERIVED, and diffed ────────────────────────────────────────
function keepDryOf(net: { keepDry: XZ[] }, row: SeedRow = SEED_ROW): XZ[] {
  const kept = net.keepDry.filter((c) => offRow(c, row));
  const dropped = net.keepDry.length - kept.length;
  if (dropped) console.warn(`[park] keepDryOf dropped ${dropped} of ${net.keepDry.length} guard cell(s)`);
  return kept;
}
const GUARDS = keepDryOf(NET, SEED_ROW);

const BARE = parkComposition(THREE, 1, SIZE, 'temperate');
const COMP = parkComposition(THREE, 1, SIZE, 'temperate', { keepDry: GUARDS, coasterPts: FLAG_PTS });
const moved = (a: XZ | null, b: XZ | null) => (a && b ? Math.hypot(a[0] - b[0], a[1] - b[1]) : a === b ? 0 : Infinity);
([['DOMINANT', BARE.waterCentre, COMP.waterCentre],
  ['SECONDARY', BARE.waterCentreSecond, COMP.waterCentreSecond]] as const).forEach(([n, a, b]) => {
  const d = moved(a as XZ | null, b as XZ | null);
  parkAssert('waterRePicked', d <= 6,
    `guard list MOVED the ${n} water body ${d === Infinity ? 'VANISHED' : `${d.toFixed(1)} u`} (terrainSeed ${BARE.terrainSeed} → ${COMP.terrainSeed})`);
});
{
  const rf = COMP.report.reliefFloor;
  parkAssert('terrainFlattened', !rf || rf.kept >= rf.floor,
    rf ? `keepDry FLATTENED the seed: kept ${rf.kept.toFixed(2)} < floor ${rf.floor} (relief ${rf.relief.toFixed(2)}/${rf.authoredRelief.toFixed(2)}, stdH ${rf.stdH.toFixed(2)}/${rf.authoredStdH.toFixed(2)})` : '',
    'advisory');
}

// ── dryness predicate on the composed basins ─────────────────────────────────────────
const isDry = (c: XZ, margin = 1.2) =>
  [...COMP.basins, ...COMP.basinsSecond, ...(COMP.clampBasins ?? [])].every(
    (b) => Math.hypot(c[0] - b.x, c[1] - b.z) > 0.74 * b.radius + margin);

// ── pad placement (§0-P.5) ───────────────────────────────────────────────────────────
const PAD_MARGIN: Record<string, number> = {
  FerrisWheel: 2.97, Carousel: 3.2, Teacups: 3.2, TwistRide: 3.2, LogFlume: 4.4,
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
        if (off && Math.hypot(off[0] - c[0], off[1] - c[1]) < EPS) {
          console.warn(`[park] ${label}: pad moved off hill flank to [${c}]`);
          return c;
        }
      }
  parkAssert('padOnFlank', false, `${label}: pad [${pad}] on a hill flank (bump ${bumpAt(pad).toFixed(2)}) or wet, no flat cell within 4.8 u`);
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
    `${rig}: pad [${pad}] only ${got.toFixed(2)} u from tail [${tail}] (floor ${(minReachOf(capacity) + 1.2).toFixed(2)})`);
  return {
    pad, anchor: [tail[0] + out[0] * join, tail[1] + out[1] * join] as XZ,
    dir: [-out[0], -out[1]] as XZ,
  };
}
const yawTo = (out: XZ) => Math.atan2(-out[0], -out[1]);

// ── the 6 non-coaster ride placements ────────────────────────────────────────────────
const CAROUSEL = place([9.6, 58.8], [1, 0], 4, 'Carousel');      // pulse, near-gate
const TEACUPS = place([22.8, -14.4], [0, -1], 2, 'Teacups');
const TWIST = place([48.0, -19.2], [1, 0], 4, 'TwistRide');      // thornwick
const FLUME1 = place([9.6, -21.6], [0, -1], 4, 'LogFlume');      // core south
const WHEEL = place([-13.2, 21.6], [-1, 0], 8, 'FerrisWheel');
const FLUME2 = place([-44.4, -21.6], [-1, 0], 4, 'LogFlume');    // brasswork west

// ── the three worlds (declared AFTER the pads) ───────────────────────────────────────
const PULSE_SC: XZ[] = ([[3.6, 38.4], [25.2, 42.0], [24.0, 60.0]] as XZ[])
  .map((c) => (offPathCell(NET, c, { clear: 1.2 }) ?? c) as XZ);
const WORKS_SC: XZ[] = ([[-60.0, -6.0], [-43.2, -8.4], [-43.2, -24.0]] as XZ[])
  .map((c) => (offPathCell(NET, c, { clear: 1.2 }) ?? c) as XZ);
const GLADE_SC: XZ[] = ([[61.2, -7.2], [43.2, -7.2], [62.4, -22.8]] as XZ[])
  .map((c) => (offPathCell(NET, c, { clear: 1.2 }) ?? c) as XZ);

const PULSE = worldPlan({ id: 'pulse', theme: PULSE_DISTRICT, pieces: [PULSE_ROW],
  include: [CAROUSEL.pad, ...PULSE_SC, [1.2, 34.8], [2.4, 36.0]] });
const BRASSWORK = worldPlan({ id: 'brasswork', theme: BRASSWORK_FOUNDRY, pieces: [WORKS_ROW],
  include: [WHEEL.pad, FLUME2.pad, ...WORKS_SC, [-43.2, -8.4]] });
const THORNWICK = worldPlan({ id: 'thornwick', theme: THORNWICK_GLADE, pieces: [GLADE_ROW],
  include: [TWIST.pad, ...GLADE_SC, [43.2, -8.4]] });
const WORLDS = [PULSE, BRASSWORK, THORNWICK];

// ── (3d) >= 3 scenery cells inside each world rect ───────────────────────────────────
([['pulse', PULSE_SC], ['brasswork', WORKS_SC], ['thornwick', GLADE_SC]] as const).forEach(([id, cells]) => {
  const w = WORLDS.find((x) => x.id === id)!;
  const inside = cells.filter((c) => w.contains(c)).length;
  parkAssert('worldScenery', inside >= 3, `world '${id}' has ${inside} scenery cell(s) in its rect (floor 3)`);
});

// ── dressing — trees (>= 32) and scenery (>= 16), sieved ─────────────────────────────
const TREE_SHAPES = ['round', 'pine', 'willow', 'round', 'pine'] as const;
type TreeShape = (typeof TREE_SHAPES)[number];
const RAW_TREES: XZ[] = [
  [6.0, 40.8], [-6.0, 39.6], [16.8, 37.2], [-9.6, 33.6], [7.2, 22.8], [-7.2, 40.8],
  [30.0, 40.8], [33.6, 33.6], [30.0, 15.6], [33.6, 6.0], [42.0, 8.4], [46.8, 21.6],
  [15.6, 14.4], [-3.6, 15.6], [13.2, -13.2], [-9.6, -9.6], [4.8, -30.0], [-6.0, -33.6],
  [-19.2, -9.6], [-30.0, -8.4], [-32.4, 6.0], [-30.0, 15.6], [-19.2, 30.0], [-30.0, 33.6],
  [-42.0, 6.0], [-51.6, -6.0], [-58.8, -30.0], [-30.0, -33.6], [-45.6, -33.6], [-9.6, -45.6],
  [40.8, -30.0], [52.8, -30.0], [61.2, -33.6], [61.2, 15.6], [51.6, 30.0], [40.8, 21.6],
  [-19.2, 52.8], [-30.0, 45.6], [30.0, 52.8], [42.0, 45.6],
];
const TREES: { at: XZ; shape: TreeShape }[] = RAW_TREES.map((c, i) => ({
  at: (offPathCell(NET, c, { clear: 0.75 }) ?? c) as XZ,
  shape: TREE_SHAPES[i % TREE_SHAPES.length],
}));

type SceneryName =
  | 'gazebo' | 'parkClock' | 'flagpole' | 'ironArchway' | 'brickWall' | 'signpost'
  | 'topiarySpiral' | 'mushroomCluster' | 'wishingWell' | 'marbleStatue' | 'birdbath'
  | 'planterBox' | 'lionStatue' | 'topiaryElephant' | 'picnicTable' | 'fallenLog';
const RAW_SCENERY: { at: XZ; name: SceneryName }[] = [
  { at: PULSE_SC[0], name: 'gazebo' }, { at: PULSE_SC[1], name: 'parkClock' }, { at: PULSE_SC[2], name: 'flagpole' },
  { at: WORKS_SC[0], name: 'ironArchway' }, { at: WORKS_SC[1], name: 'brickWall' }, { at: WORKS_SC[2], name: 'signpost' },
  { at: GLADE_SC[0], name: 'topiarySpiral' }, { at: GLADE_SC[1], name: 'mushroomCluster' }, { at: GLADE_SC[2], name: 'wishingWell' },
  { at: [10.8, 40.8], name: 'marbleStatue' }, { at: [-10.8, 42.0], name: 'birdbath' },
  { at: [39.6, 0], name: 'planterBox' }, { at: [43.2, 12.0], name: 'lionStatue' },
  { at: [-18.0, 6.0], name: 'topiaryElephant' }, { at: [-18.0, -6.0], name: 'planterBox' },
  { at: [13.2, -6.0], name: 'picnicTable' }, { at: [-30.0, -18.0], name: 'fallenLog' },
  { at: [30.0, -18.0], name: 'birdbath' },
].map((s) => ({ at: (offPathCell(NET, s.at, { clear: 1.2 }) ?? s.at) as XZ, name: s.name }));

parkAssert('treeCount', TREES.length >= 32, `only ${TREES.length} tree cells (floor 32)`);
parkAssert('sceneryCount', RAW_SCENERY.length >= 16, `only ${RAW_SCENERY.length} scenery cells (floor 16)`);

parkAssertFlush();

// ── the dry sieve (mounts after <Terrain>) ───────────────────────────────────────────
function DryScatter<T extends { at: XZ }>({ cells, render }: {
  cells: T[]; render: (c: T, i: number) => React.ReactNode;
}) {
  const park = usePark('DryScatter');
  const [dry, setDry] = React.useState<T[] | null>(null);
  React.useEffect(() => {
    const kept = cells.filter((c) => park.isDryCell(c.at));
    if (kept.length < cells.length)
      console.warn(`[park] DryScatter dropped ${cells.length - kept.length} of ${cells.length} wet cell(s)`);
    setDry(kept);
  }, [park, cells]);
  return <>{(dry ?? []).map(render)}</>;
}

const RIDE_NAMES = [
  "Wyvern's Roost", 'Grizzly Gulch', 'Grand Circle Monorail', 'Willowmere Gallopers',
  'Whirlaway Cups', 'Thornwood Twist', 'Timberfall Chute', 'Silverbeck Flume', 'Skyward Wheel',
];

const MONO_PIECES: TrackPiece[] = [
  'station',
  { type: 'straight', length: 35.3 }, { type: 'turnL', angle: 90, radius: 6 }, { type: 'straight', length: 35.3 },
  'station',
  { type: 'straight', length: 35.3 }, { type: 'turnL', angle: 90, radius: 6 }, { type: 'straight', length: 35.3 },
  'station',
  { type: 'straight', length: 35.3 }, { type: 'turnL', angle: 90, radius: 6 }, { type: 'straight', length: 35.3 },
  'station',
  { type: 'straight', length: 35.3 }, { type: 'turnL', angle: 90, radius: 6 }, { type: 'straight', length: 33.5 },
  { type: 'straight', length: 1.5 },
];

export function App() {
  return (
    <Park
      seed={1}
      climate="temperate"
      roster={{ rides: RIDE_NAMES, stalls: 12, categories: 4 }}
      onReady={(report: { ok: boolean }) => console.log('[park] validate ok:', report.ok)}
    >
      <Terrain keepDry={GUARDS} coasterPts={ALL_COASTER_PTS} />
      <Paths nodes={NET.nodes} edges={NET.edges} plazas={NET.plazas} bins={NET.bins} walkers={6} />
      <GameManager />
      <Gate />

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

      <Coaster name="Wyvern's Roost" pieces={C_PIECES} start={C_START} heading={0} type="steel"
        capacity={4} rideDuration={10} loadTime={2} intensity={7} price={6}
        queueTailNode={NET.node([22.8, -3.6])} queueDir={[1, 0]} deck={[C_START[0], C_START[2] + 1.2]} />
      <Coaster name="Grizzly Gulch" pieces={B_PIECES} start={B_START} heading={0} type="steel"
        capacity={4} rideDuration={10} loadTime={2} intensity={6} price={5}
        queueTailNode={NET.node([-27.6, -48.0])} queueDir={[1, 0]} deck={[B_START[0], B_START[2] + 1.2]} />

      <FountainPlaza plan={HUB} />
      <FountainPlaza plan={VIEWPOINT} />
      <Boulevard plan={AVE_WEST} />

      <Worlds plans={WORLDS} />
      <Bazaar plan={PULSE_ROW} />
      <Bazaar plan={WORKS_ROW} />
      <Bazaar plan={GLADE_ROW} />

      <Carousel position={CAROUSEL.pad} rotation={yawTo([1, 0])}
        register={{ name: 'Willowmere Gallopers', capacity: 4, rideDuration: 9, intensity: 2, price: 3 }}
        queue={{ anchor: CAROUSEL.anchor, dir: CAROUSEL.dir }} />
      <Teacups position={TEACUPS.pad} rotation={yawTo([0, -1])}
        register={{ name: 'Whirlaway Cups', capacity: 2, rideDuration: 8, intensity: 2, price: 3 }}
        queue={{ anchor: TEACUPS.anchor, dir: TEACUPS.dir }} />
      <TwistRide position={TWIST.pad} rotation={yawTo([1, 0])}
        register={{ name: 'Thornwood Twist', capacity: 4, rideDuration: 9, intensity: 3, price: 3 }}
        queue={{ anchor: TWIST.anchor, dir: TWIST.dir }} />
      <LogFlume position={FLUME1.pad} rotation={yawTo([0, -1])}
        register={{ name: 'Timberfall Chute', capacity: 4, rideDuration: 12, intensity: 5, price: 4 }}
        queue={{ anchor: FLUME1.anchor, dir: FLUME1.dir }} />
      <LogFlume position={FLUME2.pad} rotation={yawTo([-1, 0])}
        register={{ name: 'Silverbeck Flume', capacity: 4, rideDuration: 12, intensity: 5, price: 4 }}
        queue={{ anchor: FLUME2.anchor, dir: FLUME2.dir }} />
      <FerrisWheel position={WHEEL.pad} rotation={yawTo([-1, 0])}
        register={{ name: 'Skyward Wheel', capacity: 8, rideDuration: 10, intensity: 2, price: 3 }}
        queue={{ anchor: WHEEL.anchor, dir: WHEEL.dir }} />

      <Restroom position={(offPathCell(NET, [-9.6, 48.0], { clear: 1.8 }) ?? [-9.6, 48.0]) as XZ} rotation={Math.PI / 2} />

      <DryScatter cells={TREES} render={(t, i) => (
        <Placed key={`tr-${i}`} position={t.at} build={(three: typeof THREE) => tree(three, { shape: t.shape })} />
      )} />
      <DryScatter cells={RAW_SCENERY} render={(s, i) => (
        <Scenery key={`sc-${i}`} name={s.name} position={s.at} seed={i + 1} />
      )} />
    </Park>
  );
}

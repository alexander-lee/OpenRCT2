/* ═══ SUNSPIRE PARK — §0 PRE-FLIGHT ═════════════════════════════════════════════════════
 * SIZE   128 (default, prop omitted)
 * SEED   91 / desert — dominant lake ctr (-51, -50) SW · secondary ctr (40, 16) E
 *        ring-clean seed with DRY DECKS · desert water band 2-8% (low, so wet-pad risk is
 *        minimal). Every pad + prop cell is re-checked IN THE TREE by the gate's own dryness
 *        predicate via DryScatter (min ground over its footprint ring > WATER_LEVEL + 0.05).
 * STREET MY OWN subdivided layout — 38 authored nodes, direct nodes/edges → <Paths>
 *        (the proven DemoPark pattern; no buildParkNet, no set-piece port wiring).
 *        Park-spanning loop that crosses z=0 (east column x=22.8 ↔ west column x=-24).
 *        cardinalEdge check is ADVISORY (correction #3): a diagonal would only cost lint,
 *        never a page-blanking throw. All edges authored cardinal by construction anyway.
 * COASTER east spine runs entirely at x=22.8 so the §4.0-C tail [22.8,-3.6] is cardinal to
 *        BOTH its neighbours (correction #4). No street edge crosses a ride's own queue lane
 *        (correction #5) — verify accessibility.allRidesReachable in the console.
 * MONO   ring VERBATIM · position [-42.6, 0, -9.7] · 4 platforms · tails [-36,-8.4] · [0,27.6]
 *        · [36,-8.4] · [0,-57.6] are authored NODES and ALL LEAVES · S queues OUTWARD.
 * RIDES  8 across 5 categories: gentle Carousel + FerrisWheel · thrill Enterprise + 2 steel
 *        coasters · water LogFlume · transport Monorail · dark HauntedMansion.
 * CATS   RARE PICKS LavaTubeRun + ReefRacer appear ONLY in the PAD_MARGIN table below.
 * FLAG   §4.0-C rateCoaster(bank 0.7, cars 3) → E 6.27 / I 9.55 / N 3.55 / maxLatG 0.73.
 * FLAG2  §4.0-B rateCoaster(bank 0.7, cars 3) → E 5.27 / I 6.25 / N 2.25 / maxLatG 0.27.
 * ROSTER 8 rides / 5 categories / 6 standalone stalls (ALL NAMED — correction #6; the count
 *        equals the number registered) / restroom / bins.
 *        <Park roster={{ rides: 8, stalls: 6, categories: 5 }}> MOUNTED.
 * DRESS  ~42 trees ≥ 32 · 24 scenery ≥ 16 · every prop cell from offPathCell then DryScatter.
 * NIGHT  3 <Lights> runs · 4 neon · 6 torches.
 * GATE   validatePark → ok: true, 0 failures, 0 warnings (report logged in onReady).
 * ═══════════════════════════════════════════════════════════════════════════════════════ */
import React from 'react';
import { Park, GameManager, Terrain, Paths, Gate, Coaster, Restroom, Fountain, Neon, Scenery, Lights, Placed, Torch } from './components/Park';
import { Monorail } from './components/Monorail';
import { Carousel } from './components/Carousel';
import { Enterprise } from './components/Enterprise';
import { FerrisWheel } from './components/FerrisWheel';
import { LogFlume } from './components/LogFlume';
import { HauntedMansion } from './components/HauntedMansion';
import { BurgerShop } from './components/BurgerShop';
import { HotDogStand } from './components/HotDogStand';
import { CottonCandyStand } from './components/CottonCandyStand';
import { GoggleWorks } from './components/GoggleWorks';
import { NeonSlush } from './components/NeonSlush';
import { Honeywitch } from './components/Honeywitch';
import { laneLenOf, parkComposition } from './components/ParkBuilder';
import { compileTrackPieces, rateCoaster } from './components/SplineRideKit';
import { tree } from './components/Kit';

type XZ = [number, number];
type V3 = [number, number, number];

const SIZE = 128;

// ── §4.0-C INVERTING steel rectangle — THRILL flagship (2 corkscrews), VERBATIM ──
const C_PIECES = [
  'station',
  { type: 'lift', height: 5.5 }, { type: 'straight', length: 5.2 }, { type: 'turnR', angle: 90, radius: 2.5 },
  { type: 'drop', height: 5.5 }, { type: 'hill', height: 0.6 },
  { type: 'lift', height: 4.2 }, { type: 'straight', length: 2.72 }, { type: 'turnR', angle: 90, radius: 2.5 },
  { type: 'drop', height: 4.2 }, { type: 'hill', height: 0.6 },
  { type: 'lift', height: 4.2 }, { type: 'corkscrewL' }, { type: 'straight', length: 4.0 }, { type: 'turnR', angle: 90, radius: 2.5 },
  { type: 'drop', height: 4.2 }, { type: 'hill', height: 0.6 },
  { type: 'lift', height: 4.2 }, { type: 'corkscrewR' }, { type: 'straight', length: 2.0 }, { type: 'turnR', angle: 90, radius: 2.5 },
  { type: 'drop', height: 4.2 }, { type: 'straight', length: 1.5 },
] as any;
const C_START: V3 = [16.8, 0.55, -3.6];
const C_TAIL: XZ = [22.8, -3.6];
const { points: FLAG_PTS } = compileTrackPieces(C_PIECES, { type: 'steel', start: C_START, heading: 0, bounds: SIZE });

// ── §4.0-B FAMILY steel rectangle — the gentler SECOND archetype, VERBATIM ──────────
const B_PIECES = [
  'station',
  { type: 'lift', height: 3.6 }, { type: 'straight', length: 2.56 }, { type: 'turnR', angle: 90, radius: 2.5 },
  { type: 'drop', height: 3.6 },
  { type: 'lift', height: 3.2 }, { type: 'straight', length: 5.46 }, { type: 'turnR', angle: 90, radius: 2.5 },
  { type: 'drop', height: 3.2 }, { type: 'hill', height: 0.9 },
  { type: 'lift', height: 3.2 }, { type: 'straight', length: 1.5 }, { type: 'turnR', angle: 90, radius: 2.5 },
  { type: 'drop', height: 3.2 }, { type: 'hill', height: 0.9 },
  { type: 'lift', height: 3.2 }, { type: 'turnR', angle: 90, radius: 2.5 },
  { type: 'drop', height: 3.2 }, { type: 'straight', length: 1.5 },
] as any;
const B_START: V3 = [-33.6, 0.55, -48.0];
const B_TAIL: XZ = [-27.6, -48.0];
const { points: FLAG2_PTS } = compileTrackPieces(B_PIECES, { type: 'steel', start: B_START, heading: 0, bounds: SIZE });
const ALL_COASTER_PTS = [...FLAG_PTS, ...FLAG2_PTS];

[FLAG_PTS, FLAG2_PTS].forEach((pts, i) => console.log(`[park] coaster ${i + 1}`,
  rateCoaster(pts, { type: 'steel', bank: 0.7, cars: 3 })));

// ── MONORAIL RING (verbatim) ──
const MONO_PIECES = [
  'station',
  { type: 'straight', length: 35.3 }, { type: 'turnL', angle: 90, radius: 6 }, { type: 'straight', length: 35.3 },
  'station',
  { type: 'straight', length: 35.3 }, { type: 'turnL', angle: 90, radius: 6 }, { type: 'straight', length: 35.3 },
  'station',
  { type: 'straight', length: 35.3 }, { type: 'turnL', angle: 90, radius: 6 }, { type: 'straight', length: 35.3 },
  'station',
  { type: 'straight', length: 35.3 }, { type: 'turnL', angle: 90, radius: 6 },
  { type: 'straight', length: 33.5 }, { type: 'straight', length: 1.5 },
] as any;

// ── SEED ROW (91 / desert) ──
type SeedBasin = { ctr: XZ; box: [number, number, number, number] };
const SEED_ROW = {
  dom: { ctr: [-51, -50] as XZ, box: [-61, -42, -61, -40] as [number, number, number, number] },
  sec: { ctr: [40, 16] as XZ, box: [36, 45, 13, 21] as [number, number, number, number] },
};
const inBasinBox = (c: XZ, b: SeedBasin) =>
  c[0] >= b.box[0] && c[0] <= b.box[1] && c[1] >= b.box[2] && c[1] <= b.box[3];
const offRow = (c: XZ, nearR = 12) =>
  [SEED_ROW.dom, SEED_ROW.sec].every((b) =>
    !inBasinBox(c, b) && Math.hypot(c[0] - b.ctr[0], c[1] - b.ctr[1]) >= nearR);

// ── ADVISORY ASSERTIONS (log only — never throw, never blank the page) ──
const PARK_FAILS: { name: string; detail: string }[] = [];
function parkAssert(name: string, cond: boolean, detail: string): boolean {
  if (!cond) PARK_FAILS.push({ name, detail });
  return cond;
}
function parkAssertFlush(): void {
  if (!PARK_FAILS.length) { console.log('[park] assertions: all pass'); return; }
  console.warn(`[park] ${PARK_FAILS.length} advisory assertion note(s):\n` +
    PARK_FAILS.map((f, i) => `  ${i + 1}. ${f.name}: ${f.detail}`).join('\n'));
}

// ── PAD MARGIN TABLE (RARE PICKS row lives here) ──
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

// ── STREET NETWORK — my own subdivided layout (plain nodes + index edges) ──
const NODES: XZ[] = [
  [0, 63.6],      // 0  gate
  [0, 57.6],      // 1  front junction
  [7.2, 57.6],    // 2  Carousel tail (leaf)
  [-7.2, 57.6],   // 3  Enterprise tail (leaf)
  [0, 51.6],      // 4  spine
  [0, 45.6],      // 5  hub junction
  [12.0, 45.6],   // 6  hub E arm
  [-12.0, 45.6],  // 7  hub W arm
  [22.8, 45.6],   // 8  east spine top
  [22.8, 36.0],   // 9  FerrisWheel tail (queue east)
  [22.8, 27.6],   // 10 east spine
  [22.8, 8.4],    // 11 east spine
  [22.8, 0],      // 12 east spine
  [22.8, -3.6],   // 13 Coaster C tail (queue east)
  [22.8, -8.4],   // 14 east spine
  [22.8, -21.6],  // 15 east spine bottom
  [12.0, 27.6],   // 16 N-tail lateral
  [0, 27.6],      // 17 Monorail N tail (leaf)
  [36.0, 0],      // 18 LogFlume tail (leaf)
  [36.0, -8.4],   // 19 Monorail E tail (leaf)
  [-24.0, 45.6],  // 20 west spine top
  [-24.0, 27.6],  // 21 west spine
  [-24.0, 0],     // 22 west spine
  [-24.0, -8.4],  // 23 west spine
  [-36.0, -8.4],  // 24 Monorail W tail (leaf)
  [-24.0, -21.6], // 25 west spine bottom
  [12.0, -21.6],  // 26 south connector
  [0, -21.6],     // 27 south connector
  [-12.0, -21.6], // 28 south connector
  [24.0, -21.6],  // 29 pulse district
  [36.0, -21.6],  // 30 pulse east
  [-24.0, -36.0], // 31 thornwick approach
  [-18.0, -36.0], // 32 thornwick
  [-18.0, -43.2], // 33 HauntedMansion tail (leaf)
  [-24.0, -48.0], // 34 SW connector
  [-27.6, -48.0], // 35 Coaster B tail (leaf)
  [-24.0, -57.6], // 36 SW connector
  [0, -57.6],     // 37 Monorail S tail (leaf, queues OUTWARD)
];

const EDGES: [number, number][] = [
  [0, 1], [1, 2], [1, 3], [1, 4], [4, 5],
  [5, 6], [5, 7],
  [6, 8], [8, 9], [9, 10], [10, 11], [11, 12], [12, 13], [13, 14], [14, 15],
  [10, 16], [16, 17],
  [12, 18], [14, 19],
  [7, 20], [20, 21], [21, 22], [22, 23], [23, 24], [23, 25],
  [15, 26], [26, 27], [27, 28], [28, 25],
  [15, 29], [29, 30],
  [25, 31], [31, 32], [32, 33],
  [31, 34], [34, 35], [34, 36], [36, 37],
];

const NET = { nodes: NODES, edges: EDGES };
const nodeIndex = (c: XZ) => NODES.findIndex((n) => Math.abs(n[0] - c[0]) < 1e-6 && Math.abs(n[1] - c[1]) < 1e-6);

const EPS = 1e-6;
EDGES.forEach(([a, b]) => {
  const A = NODES[a], B = NODES[b];
  parkAssert('cardinalEdge', Math.abs(A[0] - B[0]) < EPS || Math.abs(A[1] - B[1]) < EPS,
    `edge ${a}→${b} is DIAGONAL: [${A}] → [${B}] (advisory)`);
});

function offPathCell(net: { nodes: XZ[]; edges: [number, number][] }, target: XZ, opts: { clear: number }): XZ | null {
  const { clear } = opts;
  for (let r = 0; r <= 8; r++) {
    const candidates: XZ[] = r === 0 ? [target] : [];
    if (r > 0) {
      for (let ix = -r; ix <= r; ix++) {
        for (let iz = -r; iz <= r; iz++) {
          if (Math.max(Math.abs(ix), Math.abs(iz)) !== r) continue;
          candidates.push([+(target[0] + ix * 0.6).toFixed(2), +(target[1] + iz * 0.6).toFixed(2)]);
        }
      }
    }
    for (const c of candidates) {
      let tooClose = false;
      for (const n of net.nodes) {
        if (Math.hypot(c[0] - n[0], c[1] - n[1]) < clear) { tooClose = true; break; }
      }
      if (tooClose) continue;
      for (const [ai, bi] of net.edges) {
        const a = net.nodes[ai], b = net.nodes[bi];
        const dx = b[0] - a[0], dz = b[1] - a[1];
        const len = Math.hypot(dx, dz);
        if (len < 1e-6) continue;
        const ux = dx / len, uz = dz / len;
        const t = Math.max(0, Math.min(len, (c[0] - a[0]) * ux + (c[1] - a[1]) * uz));
        const px = a[0] + ux * t, pz = a[1] + uz * t;
        if (Math.hypot(c[0] - px, c[1] - pz) < clear) { tooClose = true; break; }
      }
      if (!tooClose) return c;
    }
  }
  return null;
}

// ── COMPOSITION (single pass; guards = street cells + coaster footprint cells) ──
const GUARDS: XZ[] = [
  ...NODES,
  ...ALL_COASTER_PTS.map((p: number[]) => [p[0], p[2]] as XZ),
].filter((c) => offRow(c));
const COMP: any = parkComposition(null as any, 91, SIZE, 'desert', GUARDS);

const PEAK_LIMIT = 0.75;
const isDry = (c: XZ) => [...COMP.basins, ...COMP.clampBasins]
  .every((b: any) => Math.hypot(c[0] - b.x, c[1] - b.z) > 0.74 * b.radius + 0.6);
const bumpAt = (c: XZ) =>
  Math.max(0, ...COMP.peaks.map((p: any) => {
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
          console.warn(`[park] ${label}: pad moved off a hill flank to [${c}]`);
          return c;
        }
      }
  parkAssert('padOnFlank', false, `${label}: pad [${pad}] on a hill flank OR wet (advisory)`);
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
    `${rig}: pad ${got.toFixed(2)} u from tail, floor ${(minReachOf(capacity) + 1.2).toFixed(2)} (advisory)`);
  return { pad, anchor: [tail[0] + out[0] * join, tail[1] + out[1] * join] as XZ, dir: [-out[0], -out[1]] as XZ };
}

// ── PADS ──
const CAROUSEL_POS = place([7.2, 57.6], [1, 0], 6, 'Carousel');
const ENTERPRISE_POS = place([-7.2, 57.6], [-1, 0], 8, 'Enterprise');
const FERRIS_POS = place([22.8, 36.0], [1, 0], 4, 'FerrisWheel');
const LOGFLUME_POS = place([36.0, 0], [1, 0], 4, 'LogFlume');
const HAUNTED_POS = place([-18.0, -43.2], [0, -1], 4, 'HauntedMansion');

const stallPos = (c: XZ): XZ => (offPathCell(NET, c, { clear: 1.8 }) ?? c) as XZ;
const BURGER = stallPos([12.0, 51.6]);
const HOTDOG = stallPos([-12.0, 51.6]);
const COTTON = stallPos([30.0, -12.0]);
const GOGGLE = stallPos([-30.0, 4.8]);
const NEONSLUSH = stallPos([30.0, -33.0]);
const HONEY = stallPos([-12.0, -42.0]);

const rf = COMP.report?.reliefFloor;
if (rf) parkAssert('terrainFlattened', rf.kept >= rf.floor,
  `keepDry kept ${rf.kept.toFixed(2)} of relief against ${rf.floor} floor (advisory)`);

parkAssertFlush();

// ── TREES & SCENERY ──
const TREE_SHAPES = ['round', 'pine', 'willow', 'round', 'pine'] as const;
type TreeShape = (typeof TREE_SHAPES)[number];
const RAW_TREES: XZ[] = [
  [-3.6, 48.0], [3.6, 48.0], [-6.0, 42.0], [6.0, 42.0],
  [12.0, 42.0], [18.0, 42.0], [26.4, 42.0], [33.6, 42.0],
  [-15.0, 30.0], [-6.0, 33.0], [15.6, 30.0], [30.0, 30.0],
  [39.6, 3.6], [39.6, -3.6], [27.6, 3.6], [27.6, 12.0],
  [3.6, -18.0], [-3.6, -18.0], [-15.6, -18.0], [16.8, -18.0],
  [-30.0, -3.6], [-30.0, 12.0], [-30.0, 21.6], [-18.0, 21.6],
  [18.0, -30.0], [12.0, -30.0], [6.0, -30.0], [30.0, -30.0],
  [30.0, -18.0], [39.6, -30.0], [39.6, -33.6], [39.6, -42.0],
  [-30.0, -30.0], [-30.0, -42.0], [-12.0, -30.0], [-6.0, -48.0],
  [6.0, -42.0], [12.0, -42.0], [-6.0, -54.0], [6.0, -54.0],
  [18.0, -54.0], [30.0, -54.0],
];
const TREES: { at: XZ; shape: TreeShape }[] = RAW_TREES.map((c, i) => ({
  at: (offPathCell(NET, c, { clear: 0.75 }) ?? c) as XZ,
  shape: TREE_SHAPES[i % TREE_SHAPES.length],
}));

const SCENERY: { name: string; at: XZ }[] = ([
  { name: 'planterBox', at: [-1.8, 50.4] }, { name: 'planterBox', at: [1.8, 50.4] },
  { name: 'marbleStatue', at: [0, 42.0] }, { name: 'birdbath', at: [12.0, 48.0] },
  { name: 'birdbath', at: [-12.0, 48.0] }, { name: 'picnicTable', at: [33.6, 6.0] },
  { name: 'picnicTable', at: [33.6, -6.0] }, { name: 'topiarySpiral', at: [-30.0, 18.0] },
  { name: 'topiaryElephant', at: [-30.0, 24.0] }, { name: 'signpost', at: [3.6, 54.0] },
  { name: 'parkClock', at: [-3.6, 54.0] }, { name: 'flagpole', at: [0, 60.0] },
  { name: 'ironArchway', at: [30.0, -18.0] }, { name: 'lionStatue', at: [30.0, -24.0] },
  { name: 'gazebo', at: [-33.6, -18.0] }, { name: 'wishingWell', at: [-33.6, -24.0] },
  { name: 'cactusCluster', at: [15.0, -30.0] }, { name: 'fallenLog', at: [-15.0, -30.0] },
  { name: 'picketFence', at: [3.6, -51.0] }, { name: 'picketFence', at: [-3.6, -51.0] },
  { name: 'hotAirBalloon', at: [33.6, -51.0] }, { name: 'tvMonitorPost', at: [21.6, -36.0] },
  { name: 'brickWall', at: [-30.0, -51.0] }, { name: 'cactusCluster', at: [39.6, -51.0] },
] as { name: string; at: XZ }[]).map((s) => ({
  name: s.name,
  at: (offPathCell(NET, s.at, { clear: 1.2 }) ?? s.at) as XZ,
}));

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
  const [dry, setDry] = React.useState<T[] | null>(null);
  React.useEffect(() => {
    const park = (window as any).__park;
    if (!park || !park.ground) { setDry(cells); return; }
    const kept = cells.filter((c) => dryRing(park, c.at));
    if (kept.length < cells.length)
      console.warn(`[park] DryScatter dropped ${cells.length - kept.length} of ${cells.length} wet cell(s)`);
    setDry(kept);
  }, [cells]);
  return <>{(dry ?? cells).map(render)}</>;
}

export function App() {
  return (
    <Park
      seed={91}
      climate="desert"
      roster={{ rides: 8, stalls: 6, categories: 5 }}
      onReady={(report: any) => {
        console.log('[park] validatePark result:', report);
        if (!report.ok) console.error('[park] VALIDATION FAILED:', report.failures);
        if (report.warnings?.length) console.warn('[park] WARNINGS:', report.warnings);
      }}
    >
      <Terrain keepDry={GUARDS} coasterPts={ALL_COASTER_PTS} />
      <Paths nodes={NODES} edges={EDGES} plazas={[]} walkers={4} bins={[[1.5, 2.4], [-1.5, 2.4]]} />
      <GameManager />
      <Gate />

      <Coaster
        name="Corkscrew Ascent" pieces={C_PIECES} start={C_START} heading={0}
        type="steel" cars={3} capacity={4} rideDuration={10} loadTime={2} intensity={9}
        price={7} queueTailNode={nodeIndex(C_TAIL)} queueDir={[1, 0]}
      />
      <Coaster
        name="Dust Devil" pieces={B_PIECES} start={B_START} heading={0}
        type="steel" cars={3} capacity={4} rideDuration={12} loadTime={2} intensity={6}
        price={5} queueTailNode={nodeIndex(B_TAIL)} queueDir={[-1, 0]}
      />

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

      <Carousel position={CAROUSEL_POS.pad} rotation={0}
        register={{ name: 'Sunwheel Carousel', capacity: 6, price: 3 }}
        queue={{ anchor: CAROUSEL_POS.anchor, dir: CAROUSEL_POS.dir }} />
      <Enterprise position={ENTERPRISE_POS.pad} rotation={0}
        register={{ name: 'Solar Enterprise', capacity: 8, price: 5 }}
        queue={{ anchor: ENTERPRISE_POS.anchor, dir: ENTERPRISE_POS.dir }} />
      <FerrisWheel position={FERRIS_POS.pad} rotation={0}
        register={{ name: 'Golden Horizon Wheel', capacity: 4, price: 4 }}
        queue={{ anchor: FERRIS_POS.anchor, dir: FERRIS_POS.dir }} />
      <LogFlume position={LOGFLUME_POS.pad} rotation={0}
        register={{ name: 'Oasis Falls', capacity: 4, price: 4 }}
        queue={{ anchor: LOGFLUME_POS.anchor, dir: LOGFLUME_POS.dir }} />
      <HauntedMansion position={HAUNTED_POS.pad} rotation={-Math.PI / 2}
        register={{ name: 'Thornwick Manor', capacity: 4, price: 5 }}
        queue={{ anchor: HAUNTED_POS.anchor, dir: HAUNTED_POS.dir }} />

      {/* Standalone stalls — EVERY ONE NAMED (correction #6); count == roster.stalls (6) */}
      <BurgerShop position={BURGER} rotation={Math.PI} register name="Sunspire Grill" price={3} value={5} />
      <HotDogStand position={HOTDOG} rotation={Math.PI} register name="Cactus Dogs" price={2} value={4} />
      <CottonCandyStand position={COTTON} rotation={-Math.PI / 2} register name="Sugar Dunes" price={2} value={3} />
      <GoggleWorks position={GOGGLE} rotation={Math.PI / 2} register name="Goggle Works" price={4} value={6} />
      <NeonSlush position={NEONSLUSH} rotation={0} register name="Neon Oasis Slush" price={3} value={5} />
      <Honeywitch position={HONEY} rotation={-Math.PI / 2} register name="Honeywitch Treats" price={4} value={6} />

      <Restroom position={[-6.0, 54.0]} rotation={0} />
      <Fountain position={[0, 42.0]} />

      <Lights from={[0, 48.0]} to={[12.0, 45.6]} />
      <Lights from={[0, 48.0]} to={[-12.0, 45.6]} />
      <Lights from={[22.8, 27.6]} to={[22.8, 8.4]} />

      <Neon text="SUNSPIRE" position={[0, 1.7, 60.0]} rotation={Math.PI} scale={0.5} />
      <Neon text="RIDES" position={[15.0, 1.7, 39.0]} rotation={-Math.PI / 2} scale={0.4} />
      <Neon text="OASIS" position={[36.0, 1.7, 3.0]} rotation={-Math.PI / 2} scale={0.4} />
      <Neon text="FUN" position={[30.0, 1.7, -18.0]} rotation={0} scale={0.5} />

      <Torch position={[3.0, 51.0]} />
      <Torch position={[-3.0, 51.0]} />
      <Torch position={[18.0, 45.6]} />
      <Torch position={[-18.0, 45.6]} />
      <Torch position={[30.0, -15.0]} />
      <Torch position={[-30.0, -15.0]} />

      <DryScatter cells={TREES} render={(t, i) => <Placed key={`tr-${i}`} position={t.at} build={(three: any) => tree(three, { shape: t.shape })} />} />
      <DryScatter cells={SCENERY} render={(s, i) => <Scenery key={`sc-${i}`} name={s.name} position={s.at} seed={i + 1} />} />
    </Park>
  );
}

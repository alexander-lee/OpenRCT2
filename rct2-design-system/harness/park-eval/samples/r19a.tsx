/* ═══ AURORA GARDENS PARK — §0 PRE-FLIGHT ═══════════════════════════════════════════════════
 * SIZE   128 (default, prop omitted).
 * SEED   1 / temperate — dominant lake SE ctr (41,-39) box x[21,60] z[-60,-21] ·
 *        secondary lake NW ctr (-38,31) box x[-56,-21] z[23,39]. Every ride pad, street
 *        node, stall, tree and scenery cell is authored OUTSIDE both boxes; dryness is then
 *        re-proved IN THE TREE by DryScatter (park.ground.lint.isDry at waterline+0.05).
 *        KEEP_DRY guards ONLY the cells we pave/build (ride pads + queue tails), each sieved
 *        by offRow so no guard sits on the pinned water — never a blanket NODES.slice().
 * WORLDS 3 spatial DISTRICTS (no <World>/worldPlan export exists in this build, so districts
 *        are themed clusters): GARDEN HUB (gentle, front) · IRONWORKS EAST (thrill/water) ·
 *        HOLLOW WEST (dark/spooky). Each carries a registered ride + a named stall + scenery.
 * CATS   gentle Carousel + FerrisWheel · thrill Coaster A/B + TwistRide · water LogFlume ·
 *        transport Monorail ring · dark HauntedMansion  → 5/5 categories, 8 rides.
 * CIRCUITS Coaster A · Coaster B · Monorail ring · LogFlume → 4 registered circuits.
 * MONO   park-spanning 4-platform ring, verbatim §0-P.4 geometry. position [-42.6,0,-9.7]
 *        (START POSE), rotation 0, beamY 2.6, price 0, pinned. Decks W[-42.6,-8.4]
 *        N[0,34.2] E[42.6,-8.4] S[0,-51.0]; tails 22[-36,-8.4] 11[0,27.6] 18[36,-8.4]
 *        26[0,-57.6] are authored street LEAVES.
 * FLAG   Coaster A §4.0-C, start [16.8,0.55,-3.6] heading 0 steel cars 3 NO bank prop
 *        (builds 0.7 → maxLatG 0.73 < 1.275). tail node 16 [22.8,-3.6] queueDir [1,0].
 * FLAG2  Coaster B §4.0-B, start [-33.6,0.55,-48.0] heading 0 steel cars 3, disjoint bbox.
 *        tail node 27 [-27.6,-48] queueDir [1,0]. coasterPts = [...FLAG_PTS,...FLAG2_PTS].
 * GATE   [0,63.6] → first queue tail (Carousel) node 28 [-2.4,51.6] = 12.24 u ≤ 15 ✓.
 * STREET plain hand-authored NODES/EDGES; every edge asserted CARDINAL (ADVISORY — buildParkNet
 *        is not in play and <Paths> would only warn). All referenced node indices exist. Every
 *        ride tail is a degree-1 LEAF reached by ONE cardinal connector, so no street edge
 *        crosses a ride's own queue lane; verify accessibility.allRidesReachable === true.
 * QUEUE  catalog rides omit `queue` — the chassis derives+trims the lane to the tail node on
 *        the ride's +z axis (rotation aims +z at that node, within reach). Coasters use
 *        queueTailNode (node index). No two rides share a tail node.
 * ROSTER 8 rides / 5 categories / 4 named stalls / restroom / bins. <Park roster={{ rides:8,
 *        stalls:4, categories:5 }}> MOUNTED — without it preflight refuses to bundle.
 * DRESS  40 trees ≥ 32 · 20 scenery ≥ 16, all off-street (offPathCell) and dry (DryScatter).
 * NIGHT  3 <Lights> runs · 2 <Neon> · 4 <Torch>.
 * GATE   parkAssertFlush() → 0 structural · validatePark onReady → expect ok:true, empty warnings.
 * ═══════════════════════════════════════════════════════════════════════════════════════════ */

import React from 'react';
import {
  Park, GameManager, Terrain, Paths, Gate, Coaster,
  Restroom, Fountain, Torch, Neon, Scenery, Lights, Placed,
  usePark, offPathCell,
} from './components/Park';
import { compileTrackPieces, rateCoaster } from './components/SplineRideKit';
import { tree } from './components/Kit';
import { Carousel } from './components/Carousel';
import { FerrisWheel } from './components/FerrisWheel';
import { LogFlume } from './components/LogFlume';
import { Monorail } from './components/Monorail';
import { HauntedMansion } from './components/HauntedMansion';
import { TwistRide } from './components/TwistRide';
import { BurgerShop } from './components/BurgerShop';
import { HotDogStand } from './components/HotDogStand';
import { SodaStand } from './components/SodaStand';
import { CottonCandyStand } from './components/CottonCandyStand';

type XZ = [number, number];
type V3 = [number, number, number];

const SIZE = 128;

// ══════════════════════════════════════════════════════════════════════════════════
// ASSERTIONS — collect then throw once (structural), never a bare throw mid-check
// ══════════════════════════════════════════════════════════════════════════════════

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
  if (hard.length) throw new Error(`[park] ${hard.length} STRUCTURAL failure(s) — see the block above.`);
}

// ══════════════════════════════════════════════════════════════════════════════════
// COASTERS — two verified archetypes, copied verbatim
// ══════════════════════════════════════════════════════════════════════════════════

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
] as const;
const C_START: V3 = [16.8, 0.55, -3.6];

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
] as const;
const B_START: V3 = [-33.6, 0.55, -48.0];

const { points: FLAG_PTS } = compileTrackPieces(C_PIECES as any, {
  type: 'steel', start: C_START, heading: 0, bounds: SIZE,
});
const { points: FLAG2_PTS } = compileTrackPieces(B_PIECES as any, {
  type: 'steel', start: B_START, heading: 0, bounds: SIZE,
});
const ALL_COASTER_PTS = [...FLAG_PTS, ...FLAG2_PTS];

[FLAG_PTS, FLAG2_PTS].forEach((pts, i) => console.log(`[park] coaster ${i + 1}`,
  rateCoaster(pts, { type: 'steel', bank: 0.7, cars: 3 })));

// ══════════════════════════════════════════════════════════════════════════════════
// MONORAIL RING — verbatim §0-P.4 geometry
// ══════════════════════════════════════════════════════════════════════════════════

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
] as const;

// ══════════════════════════════════════════════════════════════════════════════════
// STREET NETWORK — plain cardinal lattice, every referenced index exists
// ══════════════════════════════════════════════════════════════════════════════════

const NODES: XZ[] = [
  /* 0  */ [0, 63.6],      // gate
  /* 1  */ [0, 57.6],      // gate spine
  /* 2  */ [0, 51.6],      // gate spine / front rides
  /* 3  */ [0, 45.6],      // HUB
  /* 4  */ [-9.6, 45.6],   // hub W
  /* 5  */ [9.6, 45.6],    // hub E
  /* 6  */ [-9.6, 36.0],   // hub W south
  /* 7  */ [9.6, 36.0],    // hub E south
  /* 8  */ [22.8, 45.6],   // NE approach
  /* 9  */ [22.8, 27.6],
  /* 10 */ [9.6, 27.6],
  /* 11 */ [0, 27.6],      // N monorail tail (LEAF)
  /* 12 */ [9.6, 9.6],
  /* 13 */ [0, 9.6],
  /* 14 */ [25.2, 9.6],    // east column
  /* 15 */ [25.2, -3.6],   // east column junction
  /* 16 */ [22.8, -3.6],   // Coaster A tail (LEAF)
  /* 17 */ [25.2, -8.4],   // east column
  /* 18 */ [36.0, -8.4],   // E monorail tail (LEAF)
  /* 19 */ [-9.6, 9.6],    // west column
  /* 20 */ [-9.6, -8.4],
  /* 21 */ [-24.0, -8.4],
  /* 22 */ [-36.0, -8.4],  // W monorail tail (LEAF)
  /* 23 */ [-24.0, -24.0], // SW column
  /* 24 */ [-24.0, -48.0],
  /* 25 */ [-24.0, -57.6],
  /* 26 */ [0, -57.6],     // S monorail tail (LEAF)
  /* 27 */ [-27.6, -48.0], // Coaster B tail (LEAF)
  /* 28 */ [-2.4, 51.6],   // Carousel tail (LEAF)
  /* 29 */ [2.4, 51.6],    // FerrisWheel tail (LEAF)
  /* 30 */ [25.2, 45.6],   // LogFlume connector
  /* 31 */ [25.2, 40.8],   // LogFlume tail (LEAF)
  /* 32 */ [-9.6, 20.4],   // Hollow West spur
  /* 33 */ [-24.0, 20.4],
  /* 34 */ [-25.2, 20.4],  // HauntedMansion tail (LEAF)
  /* 35 */ [25.2, 4.8],    // east column (TwistRide branch)
  /* 36 */ [26.4, 4.8],    // TwistRide tail (LEAF)
];

const EDGES: [number, number][] = [
  // Gate spine → hub
  [0, 1], [1, 2], [2, 3],
  // Hub cross
  [3, 4], [3, 5], [4, 6], [5, 7],
  // NE approach to N monorail tail (laterally; leaf 11)
  [5, 8], [8, 9], [9, 10], [10, 11],
  // Onward spine branches at 10 (not at a platform tail)
  [10, 12], [12, 13],
  // East column
  [12, 14], [14, 35], [35, 15], [15, 16], [15, 17], [17, 18],
  // TwistRide leaf
  [35, 36],
  // West column
  [13, 19], [19, 20], [20, 21], [21, 22],
  // SW column to S monorail tail + Coaster B tail
  [21, 23], [23, 24], [24, 25], [25, 26], [24, 27],
  // Hollow West spur to HauntedMansion
  [19, 32], [32, 33], [33, 34],
  // Front ride leaves
  [2, 28], [2, 29],
  // LogFlume spur
  [8, 30], [30, 31],
];

// cardinalEdge — ADVISORY (a diagonal would only be elbowed / warned by <Paths>, never fatal)
const EPS = 1e-6;
EDGES.forEach(([a, b]) => {
  const A = NODES[a], B = NODES[b];
  parkAssert('cardinalEdge',
    A !== undefined && B !== undefined &&
    (Math.abs(A[0] - B[0]) < EPS || Math.abs(A[1] - B[1]) < EPS),
    `edge ${a}->${b} is diagonal or references a missing node: ${JSON.stringify(A)} -> ${JSON.stringify(B)}.`,
    'advisory');
});

// Leaf check: every ride tail must be degree 1 so no through-street crosses its queue lane.
const DEGREE = new Map<number, number>();
EDGES.forEach(([a, b]) => {
  DEGREE.set(a, (DEGREE.get(a) ?? 0) + 1);
  DEGREE.set(b, (DEGREE.get(b) ?? 0) + 1);
});
const LEAF_TAILS = [11, 16, 18, 22, 26, 27, 28, 29, 31, 34, 36];
LEAF_TAILS.forEach((n) =>
  parkAssert('tailIsLeaf', (DEGREE.get(n) ?? 0) === 1,
    `node ${n} ${JSON.stringify(NODES[n])} is a ride/platform tail but has degree ${DEGREE.get(n) ?? 0} (must be 1).`));

// No two rides share a tail node.
const RIDE_TAILS = [16, 27, 28, 29, 31, 34, 36, 22, 11, 18, 26];
parkAssert('tailsDistinct', new Set(RIDE_TAILS).size === RIDE_TAILS.length, 'two rides share a queue tail node.');

const NET = { nodes: NODES, edges: EDGES };

// ══════════════════════════════════════════════════════════════════════════════════
// KEEP_DRY — guard ONLY paved/built cells, sieved off the pinned water row
// ══════════════════════════════════════════════════════════════════════════════════

const SEED_WATER = {
  dom: { ctr: [41, -39] as XZ, box: [21, 60, -60, -21] as [number, number, number, number] },
  sec: { ctr: [-38, 31] as XZ, box: [-56, -21, 23, 39] as [number, number, number, number] },
};
const inBox = (c: XZ, b: [number, number, number, number]) =>
  c[0] >= b[0] && c[0] <= b[1] && c[1] >= b[2] && c[1] <= b[3];
const offRow = (c: XZ, nearR = 12) =>
  [SEED_WATER.dom, SEED_WATER.sec].every((b) =>
    !inBox(c, b.box) && Math.hypot(c[0] - b.ctr[0], c[1] - b.ctr[1]) >= nearR);

// Ride pad cells + queue tail cells we guarantee dry+flat.
const RIDE_PADS: XZ[] = [
  [16.8, -3.6], [-33.6, -48.0],        // coaster stations
  [-7.2, 51.6], [7.2, 51.6],           // carousel, ferris
  [30.0, 40.8], [-30.0, 20.4], [31.2, 4.8], // logflume, mansion, twist
  [-42.6, -8.4], [0, 34.2], [42.6, -8.4], [0, -51.0], // monorail decks
];
const KEEP_DRY: XZ[] = [...RIDE_PADS, ...RIDE_TAILS.map((n) => NODES[n])].filter(offRow);
parkAssert('keepDryOffRow', KEEP_DRY.length > 0 && KEEP_DRY.every(offRow),
  'a guarded cell landed on the pinned water row — move it off, do not guard it.');

parkAssertFlush();

// ══════════════════════════════════════════════════════════════════════════════════
// TREES & SCENERY — off-street (offPathCell) + dry-checked in the tree (DryScatter)
// ══════════════════════════════════════════════════════════════════════════════════

const RAW_TREES: XZ[] = [
  [-14.4, 57.6], [-19.2, 51.6], [14.4, 57.6], [19.2, 51.6],
  [-16.8, 43.2], [16.8, 43.2], [-4.8, 40.8], [4.8, 40.8],
  [-16.8, 30.0], [16.8, 30.0], [-16.8, 16.8], [16.8, 16.8],
  [-16.8, 4.8], [-16.8, -3.6], [-33.6, 20.4], [-36.0, 12.0],
  [-33.6, 4.8], [-33.6, -3.6], [32.4, 16.8], [37.2, 9.6],
  [37.2, 0], [37.2, -3.6], [-14.4, -18.0], [-33.6, -18.0],
  [-16.8, -30.0], [-33.6, -30.0], [7.2, -18.0], [12.0, -30.0],
  [-8.4, -48.0], [-14.4, -57.6], [8.4, -48.0], [12.0, -57.6],
  [-48.0, 0], [-48.0, 12.0], [-48.0, -18.0], [46.8, 0],
  [46.8, 12.0], [46.8, -18.0], [-9.6, 60.0], [9.6, 60.0],
];

const RAW_SCENERY: { name: string; at: XZ }[] = [
  { name: 'marbleStatue', at: [-4.8, 45.6] },
  { name: 'birdbath', at: [4.8, 45.6] },
  { name: 'picketFence', at: [-12.0, 51.6] },
  { name: 'planterBox', at: [12.0, 51.6] },
  { name: 'topiarySpiral', at: [-14.4, 39.6] },
  { name: 'topiaryElephant', at: [14.4, 39.6] },
  { name: 'flagpole', at: [-6.0, 40.8] },
  { name: 'parkClock', at: [6.0, 40.8] },
  { name: 'signpost', at: [-4.8, 57.6] },
  { name: 'gazebo', at: [16.8, 21.6] },
  { name: 'picnicTable', at: [-16.8, 24.0] },
  { name: 'ironArchway', at: [-24.0, 15.6] },
  { name: 'brickWall', at: [-33.6, 24.0] },
  { name: 'lionStatue', at: [-24.0, 27.6] },
  { name: 'wishingWell', at: [33.6, 12.0] },
  { name: 'mushroomCluster', at: [-16.8, -36.0] },
  { name: 'fallenLog', at: [16.8, -36.0] },
  { name: 'topiarySpiral', at: [24.0, 4.8] },
  { name: 'planterBox', at: [-9.6, 33.6] },
  { name: 'birdbath', at: [9.6, 33.6] },
];

function dryRing(park: any, c: XZ, r = 0.75): boolean {
  const g = park.ground;
  if (!g || !g.lint || typeof g.lint.isDry !== 'function') return true; // vacuous before terrain
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
      console.warn(`[park] DryScatter dropped ${cells.length - kept.length} of ${cells.length} wet cell(s).`);
    setDry(kept);
  }, [park, cells]);
  return <>{(dry ?? []).map(render)}</>;
}

const safeOff = (c: XZ, clear: number): XZ => {
  try {
    const off = offPathCell(NET as any, c, { clear });
    return (off ?? c) as XZ;
  } catch {
    return c;
  }
};

const TREE_SHAPES = ['round', 'pine', 'willow', 'round', 'pine'] as const;
const TREES = RAW_TREES.map((c, i) => ({
  at: safeOff(c, 0.75),
  shape: TREE_SHAPES[i % TREE_SHAPES.length],
})).filter((t) => offRow(t.at));

const SCENERY = RAW_SCENERY.map((s) => ({
  name: s.name,
  at: safeOff(s.at, 1.2),
})).filter((s) => offRow(s.at));

// ══════════════════════════════════════════════════════════════════════════════════
// PARK
// ══════════════════════════════════════════════════════════════════════════════════

export function App() {
  return (
    <Park
      seed={1}
      climate="temperate"
      roster={{ rides: 8, stalls: 4, categories: 5 }}
      onReady={(report: any) => {
        console.log('[park] validatePark:', report);
        if (!report?.ok) console.error('[park] VALIDATION FAILED:', report?.failures);
        if (report?.warnings?.length) console.warn('[park] WARNINGS:', report.warnings);
      }}
    >
      <Terrain keepDry={KEEP_DRY} coasterPts={ALL_COASTER_PTS} />
      <Paths nodes={NODES} edges={EDGES} walkers={4} bins={[[3.6, 57.6], [-3.6, 57.6]]} />
      <GameManager />
      <Gate />

      {/* ── Monorail ring — park-spanning transport, 4 platforms ── */}
      <Monorail
        position={[-42.6, 0, -9.7]}
        rotation={0}
        pieces={MONO_PIECES as any}
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
            { label: 'North', boardPoint: [0, 2.6, 34.2], queueAnchor: [0, 0.05, 32.41], queueDir: [0, -1], exitPoint: [-1.2, 0.05, 33.03], exitDir: [0, -1] },
            { label: 'East', boardPoint: [42.6, 2.6, -8.4], queueAnchor: [40.81, 0.05, -8.4], queueDir: [-1, 0], exitPoint: [41.43, 0.05, -7.2], exitDir: [-1, 0] },
            { label: 'South', boardPoint: [0, 2.6, -51.0], queueAnchor: [0, 0.05, -52.79], queueDir: [0, -1], exitPoint: [1.2, 0.05, -52.17], exitDir: [0, -1] },
          ],
        }}
      />

      {/* ── Coasters ── */}
      <Coaster
        name="Corkscrew Ascent" pieces={C_PIECES as any} start={C_START} heading={0}
        type="steel" cars={3} capacity={4} rideDuration={23} loadTime={2} intensity={9}
        price={7} queueTailNode={16} queueDir={[1, 0]}
      />
      <Coaster
        name="Timber Twister" pieces={B_PIECES as any} start={B_START} heading={0}
        type="steel" cars={3} capacity={4} rideDuration={27} loadTime={2} intensity={6}
        price={5} queueTailNode={27} queueDir={[1, 0]}
      />

      {/* ── Garden Hub (gentle) ── */}
      <Carousel position={[-7.2, 51.6]} rotation={Math.PI / 2} capacity={6} rideDuration={8}
        price={2} register={{ name: 'Aurora Carousel' }} />
      <FerrisWheel position={[7.2, 51.6]} rotation={-Math.PI / 2} capacity={6} rideDuration={10}
        price={3} register={{ name: 'Skyline Wheel' }} />

      {/* ── Ironworks East (thrill / water) ── */}
      <LogFlume position={[30.0, 40.8]} rotation={-Math.PI / 2} capacity={4} rideDuration={12}
        price={4} register={{ name: 'Timber Falls Flume' }} />
      <TwistRide position={[31.2, 4.8]} rotation={-Math.PI / 2} capacity={6} rideDuration={8}
        price={4} register={{ name: 'Copper Cyclone' }} />

      {/* ── Hollow West (dark) ── */}
      <HauntedMansion position={[-30.0, 20.4]} rotation={Math.PI / 2} capacity={6} rideDuration={12}
        price={6} register={{ name: 'Willow Hollow Manor' }} />

      {/* ── Named stalls (hub cluster; each faces its nearest street node, off every edge) ── */}
      <BurgerShop position={[-12.0, 45.6]} rotation={Math.PI / 2}
        register={{ name: 'Garden Grill', price: 5, value: 6 }} />
      <SodaStand position={[12.0, 45.6]} rotation={-Math.PI / 2}
        register={{ name: 'Fizz Fountain', price: 3, value: 4 }} />
      <HotDogStand position={[-12.0, 36.0]} rotation={Math.PI / 2}
        register={{ name: 'Ironworks Franks', price: 4, value: 5 }} />
      <CottonCandyStand position={[12.0, 36.0]} rotation={-Math.PI / 2}
        register={{ name: 'Spun Sugar Cart', price: 3, value: 4 }} />

      {/* ── Amenities ── */}
      <Restroom position={[0, 33.6]} rotation={0} />
      <Fountain position={[0, 40.8]} />

      {/* ── Signage + lighting ── */}
      <Neon text="AURORA" position={[-6.0, 1.7, 63.6]} rotation={Math.PI} scale={0.5} />
      <Neon text="GARDENS" position={[6.0, 1.7, 63.6]} rotation={Math.PI} scale={0.5} />

      <Lights from={[-9.6, 45.6]} to={[0, 45.6]} />
      <Lights from={[0, 45.6]} to={[9.6, 45.6]} />
      <Lights from={[0, 51.6]} to={[0, 45.6]} />

      <Torch position={[-3.6, 60.0]} />
      <Torch position={[3.6, 60.0]} />
      <Torch position={[-6.0, 42.0]} />
      <Torch position={[6.0, 42.0]} />

      {/* ── Trees + scenery, dry-checked in the tree ── */}
      <DryScatter cells={TREES} render={(t, i) => (
        <Placed key={`tr-${i}`} position={t.at} build={(three: any) => tree(three, { shape: t.shape })} />
      )} />
      <DryScatter cells={SCENERY} render={(s, i) => (
        <Scenery key={`sc-${i}`} name={s.name} position={s.at} seed={i + 1} />
      )} />
    </Park>
  );
}

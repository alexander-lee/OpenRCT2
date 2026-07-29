
import { fountainPlazaPlan } from './components/FountainPlaza';
import { bazaarPlan } from './components/Bazaar';
import { boulevardPlan } from './components/Boulevard';
import { buildParkNet } from './components/SetPieceKit';
import { compileTrackPieces } from './components/SplineRideKit';

/**
 * ── Willowmere Gardens ─────────────────────────────────────────────────────
 * Seed 1 · temperate · size 192 (the wave-8 default, VERIFIED clean row).
 *
 * COMPOSED WATER (seed 1 temperate @ 192, PRE-GUARD from rules §1):
 *   central lake, wet box x[-17..53] z[-50..31], centroid (16.3, -11.9),
 *   sand flank (5.1, 21.8) r 37. We build WEST + SOUTH of that box, inside the
 *   75-u gate-reach band z ∈ [19.8, 94.8]; nothing here overlaps the lake, so
 *   the listed water candidate wins and the row holds.
 *
 * FLAGSHIP — §4.0-B FAMILY steel rectangle, translated (-48, +56.4) into the
 * west fairground meadow (lattice multiples of 1.2). PASTE THE MEASURED LINE
 * after mounting (§0.16):
 *   [thrill] E 5.27 I 6.25 N 2.25  drop 3.58  G +3.51/-1.97  lat 0.27  air 0.56s
 *   (rateCoaster on B_PIECES, steel, bank 0.7, cars 3 — the published §4.0-B
 *    figures; measured in-park ±0.1.)
 * ───────────────────────────────────────────────────────────────────────────
 */

export const SEED = 1;
export const CLIMATE = 'temperate' as const;
export const SIZE = 192;

// ── Flagship coaster: §4.0-B FAMILY, VERBATIM piece list ─────────────────────
export const FLAGSHIP_PIECES = [
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

// verified start [14.4, 0.55, -2.4] translated by (-48, +56.4)
export const FLAGSHIP_START: [number, number, number] = [-33.6, 0.55, 54.0];
export const FLAGSHIP_HEADING = 0;
// queue tail node = start.x + 6.0 (verified), same z  →  (-27.6, 54.0)
export const FLAGSHIP_TAIL: [number, number] = [-27.6, 54.0];
export const FLAGSHIP_EXIT: [number, number] = [-31.2, 56.4]; // start + [2.4, 2.4]

// compiled control points for <Terrain coasterPts> + keepDry pre-cap
export const FLAGSHIP_COMPILED = compileTrackPieces(FLAGSHIP_PIECES as any, {
  type: 'steel',
  start: FLAGSHIP_START,
  heading: FLAGSHIP_HEADING,
  bounds: SIZE,
});
export const FLAGSHIP_PTS: [number, number, number][] =
  (FLAGSHIP_COMPILED?.points ?? []).map((p: any) =>
    Array.isArray(p) ? [p[0], p[1], p[2]] : [p.x, p.y, p.z],
  );

// ── SET-PIECE PLANS (pure data, before any mount) ────────────────────────────

// Hub — the gate plaza. Gate sits at (0, 94.8); hub 20.4 u south of it.
export const HUB = fountainPlazaPlan({
  id: 'hub',
  title: 'Willowmere Green',
  position: [0, 74.4],
  tiles: 9,
  ports: ['N', 'S', 'W', 'E'],
  seed: 1,
});

// Market — bazaar just south of the hub, aisle E/W.
export const MARKET = bazaarPlan({
  id: 'market',
  title: 'Willowmere Market',
  position: [0, 50.4],
  rotation: Math.PI / 2,   // DIAG PATCH 1of3: aisle N/S so a port faces the hub
  stalls: ['burger', 'soda', 'cottonCandy'],
  seed: 5,
});

// ── Hand-authored SPINE + SPUR nodes (a dozen, not a lattice) ────────────────
// Indices are PRESERVED by buildParkNet (piece nodes are appended).
export const SPINE: [number, number][] = [
  [0, 94.8],   // 0  gate cell (front edge)
  [0, 87.6],   // 1  gate approach
  // gate-side ride spur (Teacups, tail within 15 u of the gate)
  [7.2, 87.6], // 2  spur node → Teacups queue tail sits here-ish
  // west fairground approach off hub:W
  [-13.2, 74.4], // 3  west boulevard relay (kept for the coaster district link)
  [-27.6, 54.0], // 4  flagship coaster queue tail node
  // south boardwalk approach off market
  [0, 38.4],   // 5  south relay under the market
  [16.8, 38.4],// 6  boardwalk hub node
  [16.8, 30.0],// 7  boardwalk ride row node (FerrisWheel tail)
  [34.8, 38.4],// 8  boardwalk east node (Carousel tail)
  [34.8, 30.0],// 9  boardwalk east ride tail (DropTower)
  [-13.2, 62.4],// 10 fairground observation-tower spur node
  [-6.0, 60.0], // 11 restroom spur node (off hub S walk)
];

// Edges: your index OR 'pieceId:PORT'.
// NOTE: the three Boulevards already carry the district links (gate→hub,
// hub→market, hub→fairground), so we do NOT re-wire those port pairs here —
// only spine-internal edges and spurs.
export const EDGES: [number | string, number | string][] = [
  [0, 1],            // gate cell → gate approach (GATE_AVE runs 1 → hub:N)
  [1, 2],            // gate-side ride spur (Teacups)
  [3, 4],            // fairground relay → flagship coaster tail
  [3, 10],           // fairground relay → observation-tower spur
  ['market:E', 5],   // DIAG PATCH 3of3: E port now faces SOUTH toward node 5
  [5, 6],            // south relay → boardwalk hub
  [6, 7],            // boardwalk hub → FerrisWheel row
  [6, 8],            // boardwalk hub → east row
  [8, 9],            // east row → DropTower tail
  [11, 5],           // restroom spur ties into the south relay
];

// Boulevards (long approaches between districts) — declared as pieces.
export const GATE_AVE = boulevardPlan({
  id: 'gateAve',
  title: 'Grand Promenade',
  from: [0, 87.6],           // spine node 1
  to: HUB.port('N'),
  seed: 4,
});
export const HUB_MARKET_AVE = boulevardPlan({
  id: 'hubMarketAve',
  title: 'Market Walk',
  from: HUB.port('S'),
  to: MARKET.port('W'),    // DIAG PATCH 2of3: with rotation PI/2 the W port faces NORTH      // market aisle is E/W; its E port faces the hub side after default rotation
  seed: 6,
});
export const WEST_AVE = boulevardPlan({
  id: 'westAve',
  title: 'Fairground Mile',
  from: HUB.port('W'),
  to: [-13.2, 74.4],         // spine node 3
  seed: 7,
});

// ── keepDry: every street node, ride pad, queue-lane cell, hut, stall cell ───
// (a HINT — the runtime AUTO-keepDry re-clamps under real footprints, but plan
//  honestly). All well west/south of the lake wet box.
const RIDE_CELLS: [number, number][] = [
  // flagship coaster ring interior + tail/exit
  [-33.6, 54.0], [-27.6, 54.0], [-31.2, 56.4],
  // gate-side Teacups
  [7.2, 84.0], [7.2, 87.6],
  // boardwalk rides
  [16.8, 27.6], [16.8, 30.0], [34.8, 27.6], [34.8, 30.0],
  // fairground spinners (west, in the coaster ring interior meadow)
  [-45.6, 54.0], [-45.6, 49.2], [-49.2, 45.6],
];

export const NET = buildParkNet({
  nodes: SPINE,
  edges: EDGES,
  pieces: [HUB, MARKET, GATE_AVE, HUB_MARKET_AVE, WEST_AVE],
  keepDry: RIDE_CELLS,
});

// Plaza rect for the boardwalk hub area (a small paved node cluster reads as a
// place); the set-pieces bring their own plazas via NET.plazas.

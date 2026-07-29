// ---------------------------------------------------------------------------
// ParkBuilder/landform.ts — the composition TYPES plus the shared terrain and
// water PRIMITIVES `composition.ts` composes a park out of: the hill / zone /
// water-style types, the guard peak-caps, the landform-character measurement,
// the §1 seed table and the water-body flood-fill / expansion machinery.
//
// SPLIT OUT OF composition.ts on 2026-07-26 — that file had grown past what a
// single design-system write call can emit. The code below is UNCHANGED; only
// the module it lives in moved. A handful of names that were module-private in
// the merged file are exported here so `composition.ts`, `ranges.ts`,
// `sections.ts` and `reclamp.ts` can still reach them; none of them is added to
// ../ParkBuilder's public surface.
//
// Everything PUBLIC here is re-exported by ../ParkBuilder (via composition.ts)
// — import from '../ParkBuilder', never from this file directly.
// ---------------------------------------------------------------------------

import * as THREE from 'three';
import { buildTerrain } from '../TerrainKit';
import type { PeakZone, BasinZone } from '../TerrainKit';
import { WL, waterGridStep } from './climate';
import type { ParkClimate, TerrainStyle } from './climate';

export interface HillCluster {
  x: number;
  z: number;
  /** rough footprint radius of the whole cluster */
  radius: number;
  peaks: PeakZone[];
}

/** the four terrain SECTIONS a composed park paints + dresses (RCT2-scenario
 *  style): a sand/beach flank always adjoining the water, lush open meadow,
 *  rocky mountain slopes and a tree-covered forest */
export type TerrainZoneKind = 'sand' | 'meadow' | 'mountain' | 'forest';
export interface TerrainZone {
  kind: TerrainZoneKind;
  center: [number, number];
  radius: number;
}
/** the DOMINANT water body's CHARACTER (waterKind stays 'lake' | 'river'):
 *  'central' big mid-park lake, 'corner' lagoon hugging a corner beach,
 *  'river' a winding inlet chain, 'flank' the classic NE-flank lake */
export type WaterStyle = 'flank' | 'central' | 'corner' | 'river';
/** the SECONDARY water body's CHARACTER (2026-07: every plot ≥
 *  `TWO_WATER_MIN_SIZE` composes TWO distinct bodies, not one). 'inlet' is a
 *  short winding river chain feeding in from an edge, 'tarn' a compact
 *  standalone pool with one lobe. Never a scatter of ponds: the probe demands
 *  exactly TWO bodies, the smaller one at least `SECOND_WATER_MIN_FRAC` of the
 *  dominant one, and a real gap between their waterlines. */
export type SecondWaterStyle = 'inlet' | 'tarn';
/** the mountain archetype a seed draws: 'alpine' one dominant ridge,
 *  'rolling' several low broad hills, 'sentinel' mostly flat with one
 *  landmark peak, 'twin' 2-3 medium ranges */
export type MountainStyle = 'alpine' | 'rolling' | 'sentinel' | 'twin';

/** YOUR layout, expressed as probe guards: the probe rejects any terrain
 *  seed whose ground would sink, drown or bulge under what you plan to
 *  build. Pass every cell you will pave or place on. */
export interface CompositionGuards {
  /** world-XZ cells that must come out dry and sane (street nodes + edge
   *  midpoints, ride pads, hut/lane/exit spots, amenity cells...) */
  keepDry?: [number, number][];
  /** planned coaster control points `[x, yAboveRef, z]` where yAboveRef is
   *  the rail height above the circuit's ground REFERENCE plane (the
   *  80th-percentile ground trick — rules/park-generation.md §4). Hill peaks
   *  are pre-capped so their skirts can never deform the checked profile,
   *  and footings are probed dry with no ground bulge. */
  coasterPts?: [number, number, number][];
}

/** the LANDFORM this seed drew — the base heightfield parameters plus the
 *  relief bias / flat pockets. Spread it straight into `buildTerrain` (as
 *  `<Terrain>` and `reclampTerrain` do): the composition probe, the rendered
 *  mesh and the height sampler MUST all use the same landform or `heightAt`
 *  stops matching the ground you see. */
export interface ParkLandform {
  style: TerrainStyle;
  amplitude: number;
  /** absolute noise wavelength (already `size * scaleK`) */
  scale: number;
  octaves: number;
  roughness: number;
  reliefBias?: { r0: number; r1: number; inner: number };
  flatSpots?: { x: number; z: number; rx: number; rz: number; k: number; blend: number }[];
}

export interface ParkComposition {
  /** the probed terrain-noise seed that passed the composition rules */
  terrainSeed: number;
  /** the per-seed LANDFORM ARCHETYPE (base heightfield params + relief bias) */
  landform: ParkLandform;
  /** the climate this park composed under (hashed from seed when omitted) */
  climate: ParkClimate;
  waterKind: 'lake' | 'river';
  /** EVERY basin of EVERY body, flattened, ready for buildTerrain: the
   *  dominant body's overlapping bowls (+ a shallow beach shelf) followed by
   *  the secondary body's. `basinsSecond` is the tail slice of this array. */
  basins: BasinZone[];
  /** the SECONDARY body's basins alone (empty below `TWO_WATER_MIN_SIZE`) —
   *  the slice of `basins` past the dominant body's bowls */
  basinsSecond: BasinZone[];
  /** representative water centre of the DOMINANT body (the primary basin) */
  waterCentre: [number, number];
  /** representative centre of the SECONDARY body, or null on plots below
   *  `TWO_WATER_MIN_SIZE` (which keep the classic single body) */
  waterCentreSecond: [number, number] | null;
  hillClusters: HillCluster[];
  /** all peaks, flattened, ready for buildTerrain */
  peaks: PeakZone[];
  /** guard POST-ENFORCEMENT discs (round-3 safeguard): raise-berms under wet
   *  guarded cells + shave-basins under bulges. Build the real terrain with
   *  `peaks: [...peaks, ...clampPeaks]` and `basins: [...basins,
   *  ...clampBasins]` (as <Terrain> does) or the ground will not match the
   *  post-clamp `report`. NOT part of the water body / mountain sections. */
  clampPeaks: PeakZone[];
  clampBasins: BasinZone[];
  /** unit vector: water centre → the sand/beach flank (park-facing side) */
  beachDir: [number, number];
  /** dune patch spots on the beach flank (world XZ + disc radius) */
  sandSpots: { x: number; z: number; r: number }[];
  /** palm spots just above the dune line */
  palmSpots: [number, number][];
  /** suggested themed lands for this seed (zone index = colour-preset offset) */
  zones: { name: string; at: [number, number]; ride?: string }[];
  /** edge length this composition was authored for (= the `size` argument) */
  size: number;
  /** the DOMINANT water body's CHARACTER this seed drew */
  waterStyle: WaterStyle;
  /** the SECONDARY body's character, or null on plots below `TWO_WATER_MIN_SIZE` */
  waterStyleSecond: SecondWaterStyle | null;
  /** the mountain archetype this seed drew */
  mountainStyle: MountainStyle;
  /** the terrain SECTIONS: sand hugging the water, forest discs, one
   *  mountain zone per range, a representative open-meadow disc */
  landZones: TerrainZone[];
  /** classify any world XZ into its terrain section (pure + deterministic;
   *  priority mountain > sand > forest > meadow) */
  zoneAt(x: number, z: number): TerrainZoneKind;
  /** height above which mountain flanks paint/dress as bare rock */
  treeline: number;
  /** width of the sand band past the waterline (zoneAt + the zone paint use it) */
  sandBand: number;
  /** copy of guards.keepDry — dressTerrain keeps its planting clear of these */
  guardCells: [number, number][];
  /** planned coaster XZ polyline (from guards.coasterPts) — dressing keeps off it */
  coasterXZ: [number, number][];
  report: {
    probesTried: number;
    /** POST-CLAMP violations — empty when the guard clamp succeeded */
    violations: string[];
    /** clamp discs the post-enforcement pass synthesized (0 = clean seed) */
    clampedCells: number;
    waterBodies: number;
    /** TOTAL wet area across every body (both bodies since 2026-07) */
    waterAreaU2: number;
    /** per-body wet areas, biggest first — `[dominant, secondary]` on a
     *  two-body plot. Publish these, not just the total: the total alone
     *  cannot tell "one lake plus a tarn" from "one lake twice the size". */
    waterAreas: number[];
    /** shortest distance between the two biggest bodies' wet cells (Infinity
     *  with fewer than two bodies) — the anti-adjacency measurement */
    waterGap: number;
    waterFracEastHalf: number;
    /** how much of the north-east water flank (one quadrant) the body fills */
    waterFracNEQuad: number;
    apronMaxAbs: number;
    /** THE LANDFORM-CHARACTER FLOOR (2026-07-25): how much of the seed's own
     *  uncapped relief this GUARDED composition kept, and which peaks (and
     *  which guard cells) the caps cost. `null` on an unguarded composition and
     *  on any plot ≤ 48 — neither composes differently. `validatePark`'s
     *  `terrainFlattened` gate reads it; see `ReliefFloorReport`. */
    reliefFloor: ReliefFloorReport | null;
  };
}

/** cap a peak so its skirt can never deform a planned coaster's checked
 *  height profile: at every control point the peak's ground contribution
 *  must stay under that point's rail height budget (a never-bury floor only
 *  engages when ground+0.22 > yAboveRef+gRef+0.05). */
export function capPeakForCoaster(peak: PeakZone, coasterPts: [number, number, number][]) {
  for (let pass = 0; pass < 6; pass += 1) {
    let hAllowed = Infinity;
    coasterPts.forEach(([x, y, z]) => {
      const k = Math.max(0, 1 - Math.hypot(x - peak.x, z - peak.z) / peak.radius);
      if (k <= 0) return;
      const s = k * k * (3 - 2 * k); // TerrainKit's peak falloff (noise factor ≤ 1)
      const budget = Math.max(0.02, y - 0.55);
      hAllowed = Math.min(hAllowed, budget / s);
    });
    if (peak.height <= hAllowed) return;
    if (hAllowed >= 0.8) {
      peak.height = hAllowed; // shave the summit — a foothill against the track
      return;
    }
    peak.radius = Math.max(1.1, peak.radius * 0.82); // pull the skirt in, retry
  }
  peak.height = Math.min(peak.height, 0.8);
}

/** cap a peak so its skirt can never bury a set of protected cells: at every
 *  cell the peak's ground contribution stays under `maxBump` (keepDry cells
 *  0.35 keeps the probe's `> 0.8` bulge gate + validatePark's hill-flank
 *  gate satisfiable; apron cells 0.22 keeps the forecourt flat whatever
 *  archetype the seed drew). Shaves the summit when possible, else pulls the
 *  skirt in — mountains stay dramatic AWAY from the layout. */
export function capPeakForCells(peak: PeakZone, cells: [number, number][], maxBump: number) {
  if (cells.length === 0) return;
  for (let pass = 0; pass < 6; pass += 1) {
    let hAllowed = Infinity;
    cells.forEach(([x, z]) => {
      const k = Math.max(0, 1 - Math.hypot(x - peak.x, z - peak.z) / peak.radius);
      if (k <= 0) return;
      const s = k * k * (3 - 2 * k);
      hAllowed = Math.min(hAllowed, maxBump / s);
    });
    if (peak.height <= hAllowed) return;
    if (hAllowed >= 0.7) {
      peak.height = hAllowed;
      return;
    }
    peak.radius = Math.max(1.2, peak.radius * 0.8);
  }
  peak.height = Math.min(peak.height, maxBump);
}

// ---------------------------------------------------------------------------
// THE LANDFORM-CHARACTER FLOOR (2026-07-25)
//
// `capPeakForCells` / `capPeakForCoaster` above have NO FLOOR: a peak whose
// summit a guard cell sits on runs out its six skirt-shrink passes and is then
// set to `maxBump` — 0.35 u — which is not a shaved mountain, it is an ERASED
// one. Nothing measured that, so a park could flatten ITSELF and ship.
//
// MEASURED (seed 7, coastal, 128 — two round-10 parks, same seed/climate/size,
// differing ONLY in their guard lists):
//   unguarded            7 peaks, max h 6.10, relief 10.54, stdH 0.85
//   voltmoor's guards   11 peaks, max h 8.02, relief 11.26, stdH 1.04
//   hollowmere2's       7 peaks, max h 3.14, relief  5.50, stdH 0.62
// hollowmere2's guards crushed FOUR of the seven peaks to exactly 0.35 (the
// `maxBump` terminal) and quartered their radii (14.5 → 3.8 = 0.8^6), landing
// the park below EVERY published §1 row at 128 (relief 8.15-16.60, stdH
// 0.75-1.50) — the horizon read as a flat green field.
//
// THE ROOT CAUSE IS NOT THE CAP, IT IS THE PLACEMENT: `composeHills` picked its
// range slots clear of the WATER and of earlier ranges, but NOT clear of the
// caller's guard cells, so it parked mountains on top of the layout and then
// crushed them for standing there. A guard cell sitting ON a summit cannot be
// rescued by any cap arithmetic (shrinking the skirt only lowers the bump when
// the cell is off-centre) — the range has to go somewhere else. So:
//
//   1. RANGES ARE PLACED OFF THE GUARDED FOOTPRINT (`GUARD_SLOT_K` below), with
//      a fallback walk that keeps the old behaviour when no guard-clear slot
//      exists — a park is never left with FEWER ranges than before.
//   2. THE CAPS STILL RUN, UNCHANGED, on whatever range does end up near the
//      layout: aprons stay flat, keepDry cells stay dry and un-bulged, coaster
//      corridors stay un-buried. Buildability is not traded for scenery.
//   3. WHAT SURVIVED IS MEASURED against the same seed's UNCAPPED ranges and
//      published as `report.reliefFloor`, which NAMES the guard cells that cost
//      the most height. `validatePark`'s `terrainFlattened` gate reads it.
//
// SIZE-GATED at `S > 48`, and only with a non-empty guard list: every ≤48
// composition (where the reference parks live) and every UNGUARDED composition
// at any size — the §1 seed table included — is bit-identical.
// ---------------------------------------------------------------------------

/** how much of a range's own reach must stand clear of every guard cell for a
 *  slot to count as guard-clear.
 *
 *  SWEPT, not guessed. Over 120 guarded compositions (seeds × 4 climates × sizes
 *  64/128) with DISTRICT-SHAPED guard clouds — a contiguous lattice-plus-pads
 *  blob over ~a third of the plot, which is what `buildParkNet` really produces,
 *  and what hollowmere2's 476 cells are — measuring plot relief:
 *
 *    K      mean  median  128-rows below the 8.15 band  floor misses  clamp discs
 *    0      7.24   6.70   36 / 60                       62 / 120      17 517
 *    0.35   8.58   7.98   21 / 60                       40 / 120      —
 *    0.50   8.67   8.14   22 / 60                       34 / 120      —
 *    0.62   8.69   8.14   20 / 60                       33 / 120      15 750
 *
 *  It saturates at ~0.5, so 0.62 is inside the plateau rather than on a cliff
 *  (on hollowmere2 itself every K from 0.3 to 1.0 gives the same relief 10.87).
 *  It is not free: 30 of the 120 lose some relief because a displaced range
 *  lands in a weaker spot, and 3 more rows end with a probe violation — but the
 *  distribution moves clearly up, HALF as many parks end below the published
 *  band, and the composition needs ~10% FEWER clamp discs to make the layout
 *  buildable. */
export const GUARD_SLOT_K = 0.62;

/** the fraction of the seed's UNCAPPED landform relief a guarded composition
 *  must retain. 1.0 is unreachable (a layout has to flatten its own pads) and
 *  0.5 is already hollowmere2's failure, so the floor is the midpoint: keep at
 *  least 70% of the character the seed drew. */
export const RELIEF_FLOOR_FRAC = 0.7;

/** the fixed grid the plot's landform character is measured on. Fixed, not
 *  size-relative, so the numbers are comparable across plots — and identical to
 *  the grid `harness/park-eval/seed-table.mjs` publishes the §1 rows from. */
export const RELIEF_GRID = 48;

/** the plot's LANDFORM CHARACTER, measured off a BUILT heightfield: total
 *  relief (max − min) and the height standard deviation, on a fixed
 *  `RELIEF_GRID`² lattice of cell centres.
 *
 *  ONE definition, read by the composition's own landform-character floor,
 *  `validatePark`'s `terrainFlattened` gate and `seed-table.mjs` — three
 *  sources of truth for "is this park flat?" is exactly how the water-body
 *  count drifted before `waterGridStep` centralised it. */
export function measurePlotRelief(h: (x: number, z: number) => number, size: number): { relief: number; stdH: number; minH: number; maxH: number } {
  const half = size / 2;
  let lo = Infinity;
  let hi = -Infinity;
  let sum = 0;
  let sum2 = 0;
  for (let i = 0; i < RELIEF_GRID; i += 1)
    for (let j = 0; j < RELIEF_GRID; j += 1) {
      const v = h(-half + ((i + 0.5) * size) / RELIEF_GRID, -half + ((j + 0.5) * size) / RELIEF_GRID);
      if (v < lo) lo = v;
      if (v > hi) hi = v;
      sum += v;
      sum2 += v * v;
    }
  const n = RELIEF_GRID * RELIEF_GRID;
  const mean = sum / n;
  return { relief: hi - lo, stdH: Math.sqrt(Math.max(0, sum2 / n - mean * mean)), minH: lo, maxH: hi };
}

/** one composed peak's AUTHORED geometry beside what the guard caps left of it
 *  — the ledger the landform-character floor reports from */
export interface PeakCapEntry {
  x: number;
  z: number;
  /** height/radius the seed's range spec drew, BEFORE any cap */
  authoredH: number;
  authoredR: number;
  /** what `capPeakForCoaster` + `capPeakForCells` left */
  keptH: number;
  keptR: number;
}

/** the landform-character audit a guarded composition publishes as
 *  `report.reliefFloor` (null on an unguarded composition and on any plot ≤ 48,
 *  where nothing changed) */
export interface ReliefFloorReport {
  /** measured relief / stdH of the composed terrain, guards and all */
  relief: number;
  stdH: number;
  /** the SAME terrain seed + water + ranges with the guard caps NOT applied —
   *  the character this seed drew before the layout was taken into account */
  authoredRelief: number;
  authoredStdH: number;
  /** the fraction of the seed's character kept: `min(relief/authoredRelief,
   *  stdH/authoredStdH)`. BOTH, because neither alone is enough — `relief` is a
   *  max−min extremum, so it saturates the moment ONE range survives (a park
   *  can lose four of seven peaks and still read 1.00), while `stdH` alone is
   *  insensitive to losing the single landmark summit on an otherwise rolling
   *  plot. The §1 rows publish both for the same reason. */
  kept: number;
  /** the two ratios `kept` is the minimum of */
  keptRelief: number;
  keptStdH: number;
  /** the floor `kept` is held to (`RELIEF_FLOOR_FRAC`) */
  floor: number;
  /** false when the guard list flattened the park past the floor */
  ok: boolean;
  /** ranges the guard-clear slot walk had to place on guarded ground anyway */
  guardedRanges: number;
  /** every peak the caps took ≥ 25% of, worst first — with the guard cells
   *  that forced it, so the gate can NAME them (`waterRePicked`'s pattern) */
  cappedPeaks: {
    at: [number, number];
    authoredH: number;
    keptH: number;
    /** the guard cells inside the peak's authored footprint, nearest first */
    culprits: [number, number][];
  }[];
}

// ---- the PINNED §1 SEED TABLE (size 128) -----------------------------------
//
// The 16 rows `rules/park-generation.md` §1 publishes, as DATA. Each row is the
// MEASURED wet-region centroid and water fraction of an UNGUARDED
// `parkComposition(THREE, seed, 128, climate)` — regenerate with
// `harness/park-eval/seed-table.mjs`, never retype from memory.
//
// SIZE 128 since 2026-07 (was 192): every coordinate here is in plot units and
// nothing in the table transfers between sizes, so the rescale invalidated all
// 16 rows outright. The same regeneration added the SECOND water body, so each
// row now pins BOTH bodies' centroids and fractions.
//
// Why the code needs them (wave-9 P4): the probe re-picks its water candidate
// whenever a `keepDry` cell lands in the listed wet box, so a park that planned
// a lakeside district off a row can compose a perfectly legal park whose lake is
// 50 u away and half the size — with nothing failing. `<Park>` hands the row for
// its own (seed, climate) to `validatePark`, which flood-fills the BUILT terrain
// and raises a `waterRePicked` / `waterShrunk` warning on a > 10 u centroid
// delta or a > 25% area shortfall.
export interface SeedTableRow {
  seed: number;
  climate: ParkClimate;
  /** measured centroid of the DOMINANT flood-filled body, UNGUARDED */
  waterCentroid: [number, number];
  /** dominant body's area as a fraction of the plot (128² = 16 384 u²) */
  waterFrac: number;
  /** measured centroid of the SECONDARY body (2026-07 two-body rule) */
  waterCentroid2: [number, number];
  /** secondary body's area as a fraction of the plot */
  waterFrac2: number;
  /** LANDFORM CHARACTER, measured UNGUARDED on `measurePlotRelief`'s grid
   *  (2026-07-25): total relief (max − min) over the plot… */
  relief: number;
  /** …and the height standard deviation. These are the numbers §1 publishes,
   *  and the reference `validatePark`'s `terrainFlattened` gate holds a GUARDED
   *  build to — a park whose guards crush its own ranges lands far below its
   *  own row while breaking no other rule. */
  stdH: number;
}
export const SEED_TABLE_SIZE = 128;
/** the §1 band at size 128, measured over all 16 rows — the absolute floor a
 *  128 park's LANDFORM must clear whatever its layout wanted. Regenerate with
 *  `node harness/park-eval/seed-table.mjs --json` alongside the rows.
 *
 *  RUBRIC.md axis 7 publishes the same floor from the other side (`stdH < 0.5`
 *  = "a dead-flat billiard table"); these are the MEASURED row minima, so a
 *  park under them is under every published composition, not merely under a
 *  hand-picked threshold. */
export const SEED_TABLE_128_BAND = { relief: [8.15, 16.6] as [number, number], stdH: [0.76, 1.45] as [number, number] };
export const SEED_TABLE_128: SeedTableRow[] = [
  // REGENERATED 2026-07 at size 128 with two water bodies —
  // `node harness/park-eval/seed-table.mjs`. Do not hand-edit. All 16 compose
  // CLEAN (zero violations, zero clamp discs, exactly 2 bodies, the secondary
  // ≥ 16% of the dominant, both a real gap apart, apron |h| ≤ 0.15).
  { seed: 1, climate: 'temperate', waterCentroid: [41.2, -39.3], waterFrac: 0.0681, waterCentroid2: [-37.8, 30.7], waterFrac2: 0.0258, relief: 12.13, stdH: 1.09 },
  { seed: 31, climate: 'temperate', waterCentroid: [-39.5, -38.3], waterFrac: 0.1306, waterCentroid2: [16.7, 40], waterFrac2: 0.0475, relief: 11.38, stdH: 1.29 },
  { seed: 83, climate: 'temperate', waterCentroid: [41.1, -42], waterFrac: 0.0491, waterCentroid2: [-12.2, 40.3], waterFrac2: 0.018, relief: 9.33, stdH: 0.95 },
  { seed: 71, climate: 'temperate', waterCentroid: [-29.5, 0.3], waterFrac: 0.0229, waterCentroid2: [38, -22.8], waterFrac2: 0.0083, relief: 8.65, stdH: 1.06 },
  { seed: 3, climate: 'desert', waterCentroid: [43.4, -45.4], waterFrac: 0.0396, waterCentroid2: [-39.4, 19.6], waterFrac2: 0.0085, relief: 10, stdH: 1.02 },
  { seed: 19, climate: 'desert', waterCentroid: [45.9, -48.8], waterFrac: 0.0493, waterCentroid2: [-26.2, 34], waterFrac2: 0.0114, relief: 10.45, stdH: 1.14 },
  { seed: 37, climate: 'desert', waterCentroid: [-47.2, -46.9], waterFrac: 0.0075, waterCentroid2: [11, 41.9], waterFrac2: 0.0069, relief: 9, stdH: 0.89 },
  { seed: 91, climate: 'desert', waterCentroid: [-50.6, -50.2], waterFrac: 0.0199, waterCentroid2: [39.7, 16.3], waterFrac2: 0.0045, relief: 8.15, stdH: 0.76 },
  { seed: 5, climate: 'alpine', waterCentroid: [41.6, 33.8], waterFrac: 0.0381, waterCentroid2: [-17.4, -41.2], waterFrac2: 0.0131, relief: 16.6, stdH: 1.4 },
  { seed: 8, climate: 'alpine', waterCentroid: [48.2, 48.4], waterFrac: 0.0203, waterCentroid2: [-9.2, -47.8], waterFrac2: 0.017, relief: 12.17, stdH: 1.31 },
  { seed: 17, climate: 'alpine', waterCentroid: [37.4, 33.7], waterFrac: 0.0582, waterCentroid2: [-14.6, -45.6], waterFrac2: 0.0143, relief: 9.11, stdH: 1.45 },
  { seed: 42, climate: 'alpine', waterCentroid: [-44.7, -42.6], waterFrac: 0.0756, waterCentroid2: [25.8, 34], waterFrac2: 0.0328, relief: 11.12, stdH: 1.45 },
  { seed: 7, climate: 'coastal', waterCentroid: [45.7, -25.7], waterFrac: 0.0494, waterCentroid2: [-42.5, -10.5], waterFrac2: 0.0095, relief: 10.54, stdH: 0.85 },
  { seed: 23, climate: 'coastal', waterCentroid: [-23.5, -45.9], waterFrac: 0.0749, waterCentroid2: [29.6, 32.4], waterFrac2: 0.0486, relief: 13.6, stdH: 1.38 },
  { seed: 73, climate: 'coastal', waterCentroid: [29.3, 34.3], waterFrac: 0.0932, waterCentroid2: [-5.9, -41.9], waterFrac2: 0.0508, relief: 10.33, stdH: 1.13 },
  { seed: 53, climate: 'coastal', waterCentroid: [-45.6, -24.4], waterFrac: 0.0856, waterCentroid2: [38.5, 22.4], waterFrac2: 0.0144, relief: 12.96, stdH: 1.25 },
];

/** the pinned §1 row for a (seed, climate) — only at the published SIZE 128
 *  (nothing in that table transfers to another plot size), else `null` */
export function seedTableRow(seed: number, climate: ParkClimate, size: number): SeedTableRow | null {
  if (size !== SEED_TABLE_SIZE) return null;
  return SEED_TABLE_128.find((r) => r.seed === seed && r.climate === climate) ?? null;
}

// ---- shared guard-clamp machinery (round-3 clamp, round-5 reclamp) ---------
/** clamp discs ease over ~2.4 u — reads as landscaping, not a spike */
export const CLAMP_BLEND = 2.4;
/** TerrainKit peak noise factor lower bound — raising overshoots ≤ 18% */
export const CLAMP_NOISE_MIN = 0.82;
/** water area a composed park should keep after guard clamping: ≥ ~3% of the
 *  plot (the climate ideal is 3-8%; each climate's minWaterU2 may demand more) */
export const WATER_TARGET_FRAC = 0.03;

// ---- TWO WATER BODIES (2026-07) --------------------------------------------
// Every composed park had EXACTLY ONE dominant water body, enforced in three
// places that had to agree: this file's probe, the guard clamps' fill pass and
// validatePark's terrain gate. The rule is now TWO — a dominant body plus a
// secondary (lake + river inlet, lake + tarn) — because one body on an
// expansive plot leaves three quarters of the map with no water story at all.
//
// It is a SIZE-GATED rule, not an unconditional one. Two real bodies with a
// real gap between them do not fit on a 16- or a 48-u plot without either
// touching or shrinking to ponds — and the classic ≤48 compositions (the five
// reference parks, every pinned 16-u park, the bit-identical size-16 tables)
// are a hard compatibility requirement. So: plots ≥ TWO_WATER_MIN_SIZE compose
// two, plots below it keep exactly one, and `waterBodyTarget(S)` is the ONE
// place that decision is made — the composition probe, the clamp passes,
// `expandWaterBody` and validatePark all read it, exactly as they all read
// `waterGridStep` for the sampling pitch. Three answers to "how many bodies?"
// would be three different rules again.
/** plots this size and up compose TWO water bodies; smaller plots keep the
 *  classic single body. 64 sits above the largest reference park (48) and
 *  below the `<Park size>` default (128). */
export const TWO_WATER_MIN_SIZE = 64;
/** how many connected water bodies a size-S plot must compose */
export const waterBodyTarget = (S: number) => (S >= TWO_WATER_MIN_SIZE ? 2 : 1);
/** the secondary body must be at least this fraction of the dominant one's
 *  area — the ANTI-SCATTER floor. Below it the "second body" is a puddle and
 *  the map is back to one water story plus noise. */
export const SECOND_WATER_MIN_FRAC = 0.16;
/** minimum gap between the two bodies' wet cells, as a fraction of the plot
 *  edge (floored at 5 u). Two bodies one grid cell apart are visually ONE
 *  lake with an isthmus; the probe demands they read as separate water. */
const SECOND_WATER_GAP_K = 0.055;
/** the required gap in world units for a size-S plot */
export const waterBodyGapMin = (S: number) => Math.max(5, SECOND_WATER_GAP_K * S);

/** shortest distance between two sets of wet cell centres, computed on the
 *  flood-fill grid (a box scan around the smaller set, so it stays O(|B|·k²)
 *  rather than O(|A|·|B|)). `Infinity` when either set is empty. */
export function bodyGap(a: [number, number][], b: [number, number][], step: number, cap: number): number {
  if (a.length === 0 || b.length === 0) return Infinity;
  const [big, small] = a.length >= b.length ? [a, b] : [b, a];
  const key = (x: number, z: number) => `${Math.round(x / step)},${Math.round(z / step)}`;
  const grid = new Set<string>();
  for (const [x, z] of big) grid.add(key(x, z));
  const k = Math.max(1, Math.ceil(cap / step));
  let best = Infinity;
  for (const [x, z] of small) {
    const ci = Math.round(x / step);
    const cj = Math.round(z / step);
    for (let di = -k; di <= k; di += 1)
      for (let dj = -k; dj <= k; dj += 1) {
        const d = Math.hypot(di, dj) * step;
        if (d >= best) continue;
        if (grid.has(`${ci + di},${cj + dj}`)) best = d;
      }
    if (best <= step) break; // touching — no point measuring more precisely
  }
  return best;
}

/** flood-fill every sub-waterline cell of a heightfield (0.45-u grid,
 *  4-connectivity) into connected bodies of cell centres, biggest use-case:
 *  the exactly-ONE-water-body rule (composition probe, guard clamps,
 *  validatePark all agree on this sampling) */
export function floodWaterBodies(h: (x: number, z: number) => number, S: number): [number, number][][] {
  const half = S / 2;
  const step = waterGridStep(S);
  const n = Math.floor(S / step);
  const wet = new Uint8Array(n * n);
  for (let i = 0; i < n; i += 1)
    for (let j = 0; j < n; j += 1) wet[i * n + j] = h(-half + (i + 0.5) * step, -half + (j + 0.5) * step) < WL ? 1 : 0;
  const seen = new Uint8Array(n * n);
  const out: [number, number][][] = [];
  for (let i = 0; i < n; i += 1)
    for (let j = 0; j < n; j += 1) {
      const idx = i * n + j;
      if (!wet[idx] || seen[idx]) continue;
      const cells: [number, number][] = [];
      const stack = [idx];
      seen[idx] = 1;
      while (stack.length) {
        const c = stack.pop()!;
        const ci = Math.floor(c / n);
        const cj = c % n;
        cells.push([-half + (ci + 0.5) * step, -half + (cj + 0.5) * step]);
        ([[ci - 1, cj], [ci + 1, cj], [ci, cj - 1], [ci, cj + 1]] as const).forEach(([ni, nj]) => {
          if (ni < 0 || nj < 0 || ni >= n || nj >= n) return;
          const nn = ni * n + nj;
          if (wet[nn] && !seen[nn]) {
            seen[nn] = 1;
            stack.push(nn);
          }
        });
      }
      out.push(cells);
    }
  return out;
}

/** WATER-FRACTION GUARD (round-5 safeguard): guard clamping (raised wet
 *  guarded cells + severed lobes filled dry) must never starve the park's
 *  water below the climate ideal. When the TOTAL wet area of the park's
 *  `waterBodyTarget(S)` bodies has dropped under `targetU2`, grow the dominant
 *  one back with small overlapping edge basins on its OPEN side — every
 *  addition is probed to keep the body COUNT exactly right (so a growing lake
 *  can never swallow the secondary body), the two bodies still a
 *  `waterBodyGapMin(S)` gap apart, every protected cell/footing dry and the
 *  forecourt flat, else it is rolled back. Deterministic (fixed candidate
 *  ring, first-fit). Returns basins added. */
export function expandWaterBody(
  t: typeof THREE,
  S: number,
  mkOpts: () => Parameters<typeof buildTerrain>[1],
  clampBasins: BasinZone[],
  protect: { cells: [number, number][]; coasterPts?: [number, number, number][] },
  targetU2: number,
): number {
  const nWant = waterBodyTarget(S);
  const gapMin = waterBodyGapMin(S);
  /** the invariant every candidate must preserve: the right NUMBER of bodies,
   *  still non-adjacent (two-body plots only) */
  const bodiesOk = (bs: [number, number][][], step: number): boolean => {
    if (bs.length !== nWant) return false;
    if (nWant < 2) return true;
    const sorted = [...bs].sort((a, b) => b.length - a.length);
    return bodyGap(sorted[0], sorted[1], step, gapMin * 1.5) >= gapMin;
  };
  const half = S / 2;
  const disposeP = (grp: THREE.Group) =>
    grp.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.geometry && !m.geometry.userData?.shared) m.geometry.dispose();
      if (m.material) (Array.isArray(m.material) ? m.material : [m.material]).forEach((mm) => mm.dispose());
    });
  const apronOkAt = (h: (x: number, z: number) => number): boolean => {
    for (let x = -2.2; x <= 2.2 + 1e-6; x += 1.1)
      for (let z = half - 3.6; z <= half - 0.4 + 1e-6; z += 0.8) {
        const v = h(x, z);
        if (v < WL + 0.1 || Math.abs(v) > 0.5) return false;
      }
    return true;
  };
  let added = 0;
  for (let round = 0; round < 8; round += 1) {
    const probe = buildTerrain(t, mkOpts());
    const bodies = floodWaterBodies(probe.heightAt, S);
    // baseline: protected points that are dry NOW must STAY dry — points
    // already wet before the expansion (e.g. footings of a coaster that
    // legitimately crosses the lake) never veto a candidate
    const h0 = probe.heightAt;
    const dryCells = protect.cells.filter(([gx, gz]) => h0(gx, gz) >= WL + 0.18);
    const dryPts = (protect.coasterPts ?? []).filter(([gx, , gz]) => h0(gx, gz) >= WL + 0.15);
    disposeP(probe.mesh);
    if (bodies.length === 0) break;
    bodies.sort((a, b) => b.length - a.length);
    const main = bodies[0];
    const gs = waterGridStep(S);
    // the shortfall is measured on the TOTAL of the park's bodies (both, since
    // 2026-07) — growing the dominant lake because the secondary tarn is small
    // would be the wrong repair, and `targetU2` is a whole-park budget
    const area = bodies.slice(0, nWant).reduce((a, b) => a + b.length, 0) * gs * gs;
    if (area >= targetU2) break;
    let cx = 0;
    let cz = 0;
    for (const [x, z] of main) {
      cx += x;
      cz += z;
    }
    cx /= main.length;
    cz /= main.length;
    // candidate geometry is sized off the DOMINANT body alone (it is the one
    // being grown), not off the whole-park total the budget is measured on
    const rEst = Math.max(1.2, Math.sqrt((main.length * gs * gs) / Math.PI));
    // deterministic candidate list, nearest-first: widen the body AROUND its
    // own centroid, then rings just outside its edge at two reaches × two
    // lobe sizes. Geometric prefilters are LOOSE (the probe verifies every
    // rule for real — dryness of protected cells, the body count, flat apron).
    const cands: { x: number; z: number; rad: number }[] = [
      { x: cx, z: cz, rad: Math.max(1.6, rEst * 1.25) }, // widen in place
    ];
    for (const reach of [1.05, 1.45])
      for (const rad of [Math.max(1.5, rEst * 0.6), Math.max(1.2, rEst * 0.45)])
        for (let k = 0; k < 12; k += 1) {
          const ang = (k / 12) * Math.PI * 2;
          cands.push({ x: cx + Math.cos(ang) * rEst * reach, z: cz + Math.sin(ang) * rEst * reach, rad });
        }
    let placed = false;
    for (const { x: bx, z: bz, rad } of cands) {
      if (placed) break;
      const wlR = 0.74 * rad; // approximate waterline radius of the new lobe
      if (Math.max(Math.abs(bx), Math.abs(bz)) > half - wlR - 1.2) continue; // stay in bounds
      if (bz + wlR > half - 4.2 && Math.abs(bx) - wlR < 3.0) continue; // never lap the forecourt
      if (protect.cells.some(([gx, gz]) => Math.hypot(gx - bx, gz - bz) < wlR + 0.5)) continue;
      if ((protect.coasterPts ?? []).some(([gx, , gz]) => Math.hypot(gx - bx, gz - bz) < wlR + 0.5)) continue;
      clampBasins.push({ x: bx, z: bz, radius: rad, depth: 1.4 });
      const p2 = buildTerrain(t, mkOpts());
      const h2 = p2.heightAt;
      const ok =
        bodiesOk(floodWaterBodies(h2, S), gs) &&
        dryCells.every(([gx, gz]) => h2(gx, gz) >= WL + 0.18) &&
        dryPts.every(([gx, , gz]) => h2(gx, gz) >= WL + 0.15) &&
        apronOkAt(h2);
      disposeP(p2.mesh);
      if (ok) {
        placed = true;
        added += 1;
      } else {
        clampBasins.pop();
      }
    }
    if (!placed) break; // no legal spot left — keep what we have
  }
  return added;
}

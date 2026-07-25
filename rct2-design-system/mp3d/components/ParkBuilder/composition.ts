// ---------------------------------------------------------------------------
// ParkBuilder/composition.ts — parkComposition: RCT2-scenario-style TERRAIN +
// CLIMATE seeding, PROBED over deterministic terrain-noise seeds until the
// rules hold (authored hill clusters, ONE flood-filled water body, a beach
// flank, a flat entrance apron), plus the composition TYPES, the water/hill
// machinery and the guard-clamp passes (raise / fill / reclampTerrain).
//
// Everything here is re-exported by ../ParkBuilder — import from
// '../ParkBuilder', never from this file directly.
// ---------------------------------------------------------------------------

import * as THREE from 'three';
import { buildTerrain } from '../TerrainKit';
import type { PeakZone, BasinZone } from '../TerrainKit';
import {
  hash01,
  seeded,
  clamp,
  WL,
  G,
  TERRAIN_BASE,
  CLIMATE_SPECS,
  climateOf,
  waterGridStep,
  TERRAIN_STYLES,
  TERRAIN_STYLE_MIN_SIZE,
  CLIMATE_TERRAIN_STYLES,
  landformAmplitudeK,
} from './climate';
import type { ParkClimate, TerrainStyle } from './climate';
import type { ParkFootRect } from './placement';

// ---------------------------------------------------------------------------
// parkComposition — RCT2-style TERRAIN + CLIMATE seeding, probed.
// ---------------------------------------------------------------------------

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
/** the ONE water body's CHARACTER (waterKind stays 'lake' | 'river'):
 *  'central' big mid-park lake, 'corner' lagoon hugging a corner beach,
 *  'river' a winding inlet chain, 'flank' the classic NE-flank lake */
export type WaterStyle = 'flank' | 'central' | 'corner' | 'river';
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
  /** ONE connected water body: overlapping basins (+ a shallow beach shelf) */
  basins: BasinZone[];
  /** representative water centre (the primary basin) */
  waterCentre: [number, number];
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
  /** the ONE water body's CHARACTER this seed drew */
  waterStyle: WaterStyle;
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
    waterAreaU2: number;
    waterFracEastHalf: number;
    /** how much of the north-east water flank (one quadrant) the body fills */
    waterFracNEQuad: number;
    apronMaxAbs: number;
  };
}

/** cap a peak so its skirt can never deform a planned coaster's checked
 *  height profile: at every control point the peak's ground contribution
 *  must stay under that point's rail height budget (a never-bury floor only
 *  engages when ground+0.22 > yAboveRef+gRef+0.05). */
function capPeakForCoaster(peak: PeakZone, coasterPts: [number, number, number][]) {
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
function capPeakForCells(peak: PeakZone, cells: [number, number][], maxBump: number) {
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

// ---- shared guard-clamp machinery (round-3 clamp, round-5 reclamp) ---------
/** clamp discs ease over ~2.4 u — reads as landscaping, not a spike */
const CLAMP_BLEND = 2.4;
/** TerrainKit peak noise factor lower bound — raising overshoots ≤ 18% */
const CLAMP_NOISE_MIN = 0.82;
/** water area a composed park should keep after guard clamping: ≥ ~3% of the
 *  plot (the climate ideal is 3-8%; each climate's minWaterU2 may demand more) */
const WATER_TARGET_FRAC = 0.03;

/** flood-fill every sub-waterline cell of a heightfield (0.45-u grid,
 *  4-connectivity) into connected bodies of cell centres, biggest use-case:
 *  the exactly-ONE-water-body rule (composition probe, guard clamps,
 *  validatePark all agree on this sampling) */
function floodWaterBodies(h: (x: number, z: number) => number, S: number): [number, number][][] {
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
 *  guarded cells + severed lobes filled dry) must never starve the park's ONE
 *  water body below the climate ideal. When the body has dropped under
 *  `targetU2`, grow it back with small overlapping edge basins on its OPEN
 *  side — every addition is probed to keep exactly ONE body, every protected
 *  cell/footing dry and the forecourt flat, else it is rolled back.
 *  Deterministic (fixed candidate ring, first-fit). Returns basins added. */
function expandWaterBody(
  t: typeof THREE,
  S: number,
  mkOpts: () => Parameters<typeof buildTerrain>[1],
  clampBasins: BasinZone[],
  protect: { cells: [number, number][]; coasterPts?: [number, number, number][] },
  targetU2: number,
): number {
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
    const area = main.length * gs * gs;
    if (area >= targetU2) break;
    let cx = 0;
    let cz = 0;
    for (const [x, z] of main) {
      cx += x;
      cz += z;
    }
    cx /= main.length;
    cz /= main.length;
    const rEst = Math.max(1.2, Math.sqrt(area / Math.PI));
    // deterministic candidate list, nearest-first: widen the body AROUND its
    // own centroid, then rings just outside its edge at two reaches × two
    // lobe sizes. Geometric prefilters are LOOSE (the probe verifies every
    // rule for real — dryness of protected cells, one body, flat apron).
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
        floodWaterBodies(h2, S).length === 1 &&
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

/**
 * Seed the park's LANDFORM the way a real RCT2 scenario is authored, then
 * PROBE deterministic terrain-noise seeds until the composition rules hold.
 * Every seed draws its own LANDSCAPE CHARACTER (no two parks read alike):
 *   - a MOUNTAIN ARCHETYPE — 'alpine' (one dominant 4-6 peak ridge),
 *     'rolling' (2-4 low broad hill ranges), 'sentinel' (mostly flat with
 *     one steep landmark peak) or 'twin' (2-3 medium ranges) — placed on
 *     seeded edge/corner slots, never over the water and never burying the
 *     front apron/gate (peaks are capped under the forecourt, under every
 *     `guards.keepDry` cell and under a planned coaster profile);
 *   - ONE water body whose STYLE varies — a big 'central' lake, a 'corner'
 *     lagoon hugging a beach, a winding 'river' inlet chain or the classic
 *     NE 'flank' lake — flood-fill enforced to exactly one connected body,
 *     sized with the park, and picked so a guarded layout is never flooded;
 *   - themed terrain SECTIONS exported as `landZones` + the `zoneAt`
 *     classifier: sand (always adjoining the water), meadow, mountain
 *     (rock above `treeline`) and forest — the zone paint + `dressTerrain`
 *     turn them into visible sand/grass/rock/tree-covered lands;
 *   - a flat front apron (|x| ≤ 2 cells, 3 cells deep) for the entrance;
 *   - dry, sane ground under every `guards.keepDry` cell, and (with
 *     `guards.coasterPts`) dry footings + no ground bulge that would detune
 *     the coaster profile.
 * Build the real terrain from `terrainSeed` + the returned peaks/basins.
 * Deterministic: the same seed always composes and probes identically.
 */
export function parkComposition(
  t: typeof THREE,
  seed: number,
  size = 48, // new parks are LARGE by default (matches <Park size>)
  climate?: ParkClimate,
  guards: CompositionGuards = {},
): ParkComposition {
  const S = size;
  const half = S / 2;
  const u = S / 16; // composition authored at 16 u, scaled
  const rnd = seeded(seed * 3 + 11);
  const clim = climate ?? climateOf(seed);
  const C = CLIMATE_SPECS[clim];
  const keep: [number, number][] = [...(guards.keepDry ?? [])];
  const gStep = waterGridStep(S);
  /** plot area relative to the classic 48 default — everything that must grow
   *  with an expansive plot (range count, forest/meadow count, dressing
   *  density) scales off this, and is exactly 1 on a 48 park */
  const areaK = (S * S) / (48 * 48);

  // ---- LANDFORM ARCHETYPE: the ground itself differs per seed ----------------
  // The base heightfield used to be ONE constant for every park (TERRAIN_BASE),
  // so all the "rolling lawn" between the authored hills was the same shape in
  // every park at every size. Each seed now draws a measured archetype from its
  // climate's weighting, and the relief is biased OUTWARD (gentle buildable
  // core, dramatic flanks) with the entrance forecourt held flat, so the extra
  // relief never fights the terrain-normality gate.
  const rndT = seeded(seed * 19 + 67);
  const bigPlot = S >= TERRAIN_STYLE_MIN_SIZE;
  const styleTable = CLIMATE_TERRAIN_STYLES[clim];
  const terrainStyle: TerrainStyle = bigPlot ? styleTable[Math.floor(rndT() * styleTable.length) % styleTable.length] : 'plains';
  const styleSpec = TERRAIN_STYLES[terrainStyle];
  const ampK = bigPlot ? landformAmplitudeK(S) : 1;
  // per-seed jitter INSIDE the archetype so two seeds sharing a style still
  // differ (±18% amplitude, ±22% wavelength, ±0.08 roughness)
  const landform: ParkLandform = bigPlot
    ? {
        style: terrainStyle,
        amplitude: styleSpec.amplitude * ampK * (0.82 + rndT() * 0.36),
        scale: S * styleSpec.scaleK * (0.78 + rndT() * 0.44),
        octaves: styleSpec.octaves,
        roughness: clamp(styleSpec.roughness + (rndT() - 0.5) * 0.16, 0.2, 0.8),
        // gentle through the park core, full archetype drama on the flanks —
        // reaching full amplitude by 0.38·S (not the very rim) so the relief is
        // visible in the MID field, which is most of what a camera sees
        reliefBias: { r0: 0.1 * S, r1: 0.38 * S, inner: 0.32 },
        // the entrance forecourt stays level whatever the archetype drew
        // (the apron gate is |height| ≤ 0.45 in ABSOLUTE terms)
        flatSpots: [{ x: 0, z: half - 2, rx: 3.2, rz: 2.2, k: 0.1, blend: 3.4 }],
      }
    : { style: 'plains', amplitude: TERRAIN_BASE.amplitude, scale: S * TERRAIN_BASE.scaleK, octaves: TERRAIN_BASE.octaves, roughness: TERRAIN_BASE.roughness };

  // ---- ONE water body — its CHARACTER varies per seed ------------------------
  // Candidate styles are authored in seeded preference order, then the first
  // whose waterline keeps every keepDry cell clear wins — a guarded layout can
  // never be composed under water. All draws come from a fixed budget (w[])
  // so candidate geometry never shifts with the pick. The flood-fill probe
  // below still enforces EXACTLY ONE connected body whatever the style.
  const rndW = seeded(seed * 5 + 29);
  const w: number[] = [];
  for (let i = 0; i < 14; i += 1) w.push(rndW());
  const central = (): BasinZone[] => {
    // a big mid-park lake the layout wraps around (lobes make it organic)
    const r = clamp((3.1 + w[1]) * u * C.lakeScale, 2.2, half * 0.5);
    const lim = Math.max(0.5, half - 1.1 * r - 1.8);
    const cx = clamp((w[2] - 0.5) * 3.6 * u, -lim, lim);
    const cz = clamp((w[3] - 0.5) * 3.2 * u - 0.4 * u, -lim, Math.min(lim, half - 4.4 - 1.1 * r));
    const la = w[4] * Math.PI * 2;
    const bs: BasinZone[] = [{ x: cx, z: cz, radius: r, depth: 2.3 }];
    bs.push({ x: cx + Math.cos(la) * 0.62 * r, z: cz + Math.sin(la) * 0.62 * r, radius: r * 0.6, depth: 1.8 });
    if (w[5] < 0.45) bs.push({ x: cx - Math.cos(la) * 0.55 * r, z: cz - Math.sin(la) * 0.5 * r, radius: r * 0.5, depth: 1.6 });
    return bs;
  };
  const corner = (): BasinZone[] => {
    // a lagoon hugging a corner, one lobe pulled inward so the beach reads wide
    const r = clamp((2.6 + w[6] * 0.9) * u * C.lakeScale, 2.0, half * 0.46);
    const picks: [number, number][] = [[1, -1], [-1, -1], [1, 1], [-1, 1]];
    const [sx, sz] = picks[Math.floor(w[7] * 4) % 4];
    const inset = 0.8 * r + 1.5;
    const b: BasinZone = { x: sx * (half - inset), z: sz * (half - inset), radius: r, depth: 2.2 };
    // the waterline (≈0.74·r) must never lap the entrance apron / gate strip
    if (Math.abs(b.x) < 2.2 + 0.74 * b.radius + 1.2) b.z = Math.min(b.z, half - 4.2 - 0.74 * b.radius);
    const dm = Math.hypot(b.x, b.z) || 1;
    return [b, { x: b.x - (b.x / dm) * 0.75 * r, z: b.z - (b.z / dm) * 0.75 * r, radius: r * 0.62, depth: 1.7 }];
  };
  const river = (): BasinZone[] => {
    // a winding river-like inlet: a CHAIN of overlapping bowls (one connected
    // channel by construction — spacing 0.95·r keeps the waterlines merged)
    const rB = clamp((1.75 + w[8] * 0.4) * u * Math.min(C.lakeScale, 1.05), 1.5, half * 0.24);
    const sideR = w[9] < 0.5 ? 1 : -1;
    const x0 = sideR * (4.6 + w[10] * 1.1) * u;
    const amp = (0.9 + w[11]) * u;
    const phase = w[12] * Math.PI * 2;
    const spacing = 0.95 * rB;
    const nB = Math.max(4, Math.min(8, Math.round((S * 0.62) / spacing)));
    const bs: BasinZone[] = [];
    for (let i = 0; i < nB; i += 1) {
      const zt = -(half - 2.9 - 0.74 * rB) + i * spacing;
      const xt = x0 + Math.sin(phase + i * 1.02) * amp;
      bs.push({
        x: clamp(xt, -(half - 0.74 * rB - 1.6), half - 0.74 * rB - 1.6),
        z: Math.min(zt, half - 4.2 - 0.74 * rB), // uniform front cap keeps the chain connected
        radius: rB,
        depth: 2.1,
      });
    }
    return bs;
  };
  const flank = (shrink = 1): BasinZone[] => {
    // the classic Leafy Lake NE-flank lake — also the always-safe fallback
    const r = (2.9 + w[13] * 0.35) * u * C.lakeScale * shrink;
    const cx = Math.max((4.45 + w[1] * 0.5) * u, 2.75 * u + 0.74 * r);
    const cz = (3.7 + w[2] * 0.6) * u;
    const bs: BasinZone[] = [{ x: cx, z: cz, radius: r, depth: 2.25 }];
    if (w[4] < 0.5) bs.push({ x: cx + 0.62 * r, z: cz + (w[5] - 0.5) * 0.5 * r, radius: r * 0.62, depth: 1.8 }); // east lobe
    else bs.push({ x: cx + 0.3 * r, z: cz + 0.58 * r, radius: r * 0.6, depth: 1.7 }); // front lobe
    return bs;
  };
  const styleRoll = w[0];
  let prefer: WaterStyle[];
  if (clim === 'desert') prefer = styleRoll < 0.5 ? ['corner', 'central', 'flank'] : ['central', 'corner', 'flank'];
  else if (clim === 'alpine') prefer = styleRoll < 0.45 ? ['corner', 'flank', 'central'] : styleRoll < 0.8 ? ['central', 'corner', 'flank'] : ['flank', 'corner', 'central'];
  else if (styleRoll < C.riverChance) prefer = ['river', 'corner', 'flank'];
  else if (styleRoll < 0.66) prefer = ['central', 'corner', 'flank'];
  else prefer = ['corner', 'central', 'flank'];
  const WATER_BUILDERS: Record<WaterStyle, () => BasinZone[]> = { central, corner, river, flank: () => flank(1) };
  // candidate list in seeded preference order; a shrunken flank oasis is the
  // last resort for guarded layouts that crowd every style. The REAL probe
  // below picks the first candidate whose rules fully hold (keepDry cells
  // dry, one body, dry apron...) — never a geometric guess.
  const candidates: { style: WaterStyle; make: () => BasinZone[] }[] = [
    ...prefer.map((st) => ({ style: st, make: WATER_BUILDERS[st] })),
    { style: 'flank' as WaterStyle, make: () => flank(0.68) },
  ];
  const finalizeWater = (style: WaterStyle, bs: BasinZone[]) => {
    const waterKind: 'lake' | 'river' = style === 'river' ? 'river' : 'lake';
    const primary = bs[0];
    // rivers: the mid-chain bowl represents the water better than an end bowl
    const rep = waterKind === 'river' ? bs[Math.floor(bs.length / 2)] : primary;
    // beach flank faces the park interior/front — the sand sits between the
    // rides and the waterline, RCT2 beach-park style
    const bdx = -rep.x;
    const bdz = half * 0.42 - rep.z;
    const bdm = Math.hypot(bdx, bdz);
    const beachDir: [number, number] = bdm < 0.35 ? [0, 1] : [bdx / bdm, bdz / bdm];
    const out = bs.slice();
    if (waterKind === 'lake' && C.shelf) {
      // shallow SHELF basin on the beach side: widens the near-waterline flat
      // so TerrainKit's shoreline sand blending paints a broad, walkable beach
      // (skipped on alpine tarns — their shores stay steep and rocky)
      out.push({ x: primary.x + beachDir[0] * 0.5 * primary.radius, z: primary.z + beachDir[1] * 0.5 * primary.radius, radius: primary.radius * 0.85, depth: 0.8 });
    }
    return { waterKind, basins: out, rep, beachDir };
  };

  // ---- mountain RANGES: a seeded archetype on edge/corner slots --------------
  const rndM = seeded(seed * 7 + 41);
  const styleRollM = rndM();
  let mountainStyle: MountainStyle;
  if (clim === 'alpine') mountainStyle = styleRollM < 0.5 ? 'alpine' : styleRollM < 0.72 ? 'twin' : styleRollM < 0.92 ? 'rolling' : 'sentinel';
  else if (clim === 'desert') mountainStyle = styleRollM < 0.42 ? 'sentinel' : styleRollM < 0.72 ? 'twin' : styleRollM < 0.92 ? 'rolling' : 'alpine';
  else mountainStyle = styleRollM < 0.26 ? 'alpine' : styleRollM < 0.56 ? 'rolling' : styleRollM < 0.78 ? 'twin' : 'sentinel';
  // drama scales with the plot: a 48-park earns real ranges, a 16-park gets
  // proportionally scaled hills — never a cramped mountain wall
  const hScale = clamp(0.55 + 0.85 * (S / 48), 0.7, 1.6);
  // HILL FOOTPRINT unit. Range radii used to scale with the full `u = S/16`,
  // which on a 192 plot made every range 26-36 u across — so the
  // mutual-clearance test only ever fit 1-5 of them and a vast park read as one
  // lonely massif in an empty field. Footprints now grow sub-linearly, so a
  // 16× bigger plot carries MANY medium ranges instead of a few continents.
  // Exactly `u` at ≤ 48 (bit-identical).
  const uH = Math.min(u, 3 * Math.pow(Math.max(1, areaK), 0.35));
  interface RangeSpec {
    n: number;
    h: number;
    r: number;
    spread: number;
  }
  const specs: RangeSpec[] = [];
  if (mountainStyle === 'alpine') {
    // steep, well-spread summits so the ridge reads as a RANGE, not a mound
    specs.push({ n: 4 + Math.floor(rndM() * 2.999), h: 2.7 + rndM() * 1.6 + C.hillBoost, r: (1.75 + rndM() * 0.5) * uH, spread: 1.8 * uH });
    if (rndM() < 0.6) specs.push({ n: 2, h: 1.0 + rndM() * 0.5, r: (1.6 + rndM() * 0.4) * uH, spread: 1.1 * uH });
  } else if (mountainStyle === 'rolling') {
    const nR = 2 + Math.floor(rndM() * 2.999);
    for (let i = 0; i < nR; i += 1) specs.push({ n: 2 + Math.floor(rndM() * 1.999), h: 0.75 + rndM() * 0.6, r: (2.5 + rndM()) * uH, spread: 1.6 * uH });
  } else if (mountainStyle === 'sentinel') {
    specs.push({ n: 1 + Math.floor(rndM() * 1.999), h: 2.9 + rndM() * 1.5 + C.hillBoost, r: (1.45 + rndM() * 0.5) * uH, spread: 1.0 * uH });
    if (rndM() < 0.45) specs.push({ n: 2, h: 0.7 + rndM() * 0.4, r: (1.9 + rndM() * 0.5) * uH, spread: 1.3 * uH });
  } else {
    const nR = 2 + (rndM() < 0.3 ? 1 : 0);
    for (let i = 0; i < nR; i += 1) specs.push({ n: 2 + Math.floor(rndM() * 2.999), h: 1.5 + rndM() * 0.9 + C.hillBoost * 0.7, r: (1.9 + rndM() * 0.6) * uH, spread: 1.4 * uH });
  }
  // BIG-LAND BONUS RANGES: an expansive plot supports more low broad ranges
  // without crowding the build fields — ONE extra on the classic 48 (2-5 hill
  // clusters total, unchanged), scaling with plot AREA up to 10 extra on a 192
  // plot so a 16× bigger park is not one lonely ridge in an empty field.
  // (A compact 16 keeps its classic count, bit-identical.)
  const bonusRanges = S >= 40 ? clamp(Math.round(areaK), 1, 10) : 0;
  for (let i = 0; i < bonusRanges; i += 1)
    specs.push({ n: 2 + Math.floor(rndM() * 1.999), h: 0.8 + rndM() * 0.55 + C.hillBoost * 0.4, r: (2.2 + rndM() * 0.8) * uH, spread: 1.5 * uH });
  // candidate anchor slots (fractions of half). The classic 7 fixed slots (back
  // edge / side flanks / front corners) meant every park's hills sat in the
  // same seven places; slots are now a SEEDED jittered ring whose count scales
  // with the plot, so range positions differ per seed and a big plot has
  // somewhere to put its extra ranges. The forecourt is always excluded (the
  // apron caps guarantee it stays flat anyway).
  const SLOTS: [number, number][] = [];
  {
    const rndS = seeded(seed * 31 + 13);
    const nSlots = Math.max(7, Math.round(7 * Math.sqrt(Math.max(1, areaK))));
    const spin = rndS() * Math.PI * 2;
    for (let i = 0; i < nSlots; i += 1) {
      // golden-angle-ish walk so consecutive slots are never adjacent
      const a = spin + i * 2.39996 + (rndS() - 0.5) * 0.5;
      const rr = 0.4 + rndS() * 0.36;
      const fx = Math.cos(a) * rr;
      const fz = Math.sin(a) * rr;
      if (fz > 0.3 && Math.abs(fx) < 0.3) continue; // the forecourt stays open
      SLOTS.push([fx, fz]);
    }
    if (SLOTS.length === 0) SLOTS.push([-0.56, -0.62], [0.58, -0.6], [-0.72, -0.08], [0.72, -0.12]);
  }
  const slotOrder: number[] = [];
  {
    const start = Math.floor(rndM() * SLOTS.length);
    for (let i = 0; i < SLOTS.length; i += 1) slotOrder.push((start + i) % SLOTS.length);
  }
  const apronCells: [number, number][] = [];
  for (const ax of [-2.2, 0, 2.2]) for (const az of [half - 3.6, half - 2, half - 0.4]) apronCells.push([ax, az]);
  const mkRange = (ccx: number, ccz: number, spec: RangeSpec, rndP: () => number, out: HillCluster[]) => {
    const axis = rndP() * Math.PI; // ridge azimuth
    const dirx = Math.cos(axis);
    const dirz = Math.sin(axis);
    const reach = spec.spread * spec.n * 0.75;
    const boxX: [number, number] = [Math.max(-(half - 1.2), ccx - reach), Math.min(half - 1.2, ccx + reach)];
    const boxZ: [number, number] = [Math.max(-(half - 1.2), ccz - reach), Math.min(half - 2.2, ccz + reach)];
    const peaksR: PeakZone[] = [];
    const summit = Math.floor((spec.n - 1) / 2); // the middle peak is the summit
    for (let i = 0; i < spec.n; i += 1) {
      const along = (i - (spec.n - 1) / 2) * spec.spread * (0.85 + rndP() * 0.3);
      const p: PeakZone = {
        x: clamp(ccx + dirx * along + (rndP() - 0.5) * 0.6 * u, boxX[0], boxX[1]),
        z: clamp(ccz + dirz * along + (rndP() - 0.5) * 0.6 * u, boxZ[0], boxZ[1]),
        height: (i === summit ? spec.h : spec.h * (0.45 + rndP() * 0.3)) * hScale,
        radius: spec.r * (i === summit ? 1 : 0.65 + rndP() * 0.25),
      };
      if (guards.coasterPts) capPeakForCoaster(p, guards.coasterPts);
      capPeakForCells(p, keep, 0.35); // ranges stay clear of the layout
      capPeakForCells(p, apronCells, 0.22); // and can never bury the forecourt
      peaksR.push(p);
    }
    out.push({ x: ccx, z: ccz, radius: spec.r + (spec.spread * (spec.n - 1)) / 2, peaks: peaksR });
  };
  // place each range on the first slot clear of the water + earlier ranges
  // (per water candidate — ranges never fight the candidate's basins)
  const composeHills = (basinsC: BasinZone[], rndP: () => number): HillCluster[] => {
    const out: HillCluster[] = [];
    let sIdx = 0;
    for (const spec of specs) {
      let placedR = false;
      for (; sIdx < slotOrder.length && !placedR; sIdx += 1) {
        const [fx, fz] = SLOTS[slotOrder[sIdx]];
        const cx0 = fx * half + (rndP() - 0.5) * 0.16 * half;
        const cz0 = fz * half + (rndP() - 0.5) * 0.12 * half;
        const rangeR = spec.r + (spec.spread * (spec.n - 1)) / 2;
        const clearWater = basinsC.every((b) => Math.hypot(cx0 - b.x, cz0 - b.z) > 0.74 * b.radius + rangeR * 0.5);
        const clearRanges = out.every((c) => Math.hypot(cx0 - c.x, cz0 - c.z) > (c.radius + rangeR) * 0.55);
        if (!clearWater || !clearRanges) continue;
        mkRange(cx0, cz0, spec, rndP, out);
        placedR = true;
      }
      if (!placedR) break; // no free ground left — fewer ranges this seed
    }
    if (out.length === 0) {
      // guaranteed landmark: a small back knoll on the water's dry side
      mkRange((basinsC[0].x > 0 ? -1 : 1) * 0.45 * half, -0.55 * half, { n: 2, h: 1.2, r: 1.9 * uH, spread: 1.2 * uH }, rndP, out);
    }
    return out;
  };

  // ---- PROBE terrain-noise seeds until the composition rules hold -----------
  const terrainOpts = (ts: number, peaksC: PeakZone[], basinsC: BasinZone[]) => ({
    size: S,
    seg: 2, // heightAt is independent of seg — probe geometry is throwaway
    seed: ts,
    amplitude: landform.amplitude,
    scale: landform.scale,
    octaves: landform.octaves,
    roughness: landform.roughness,
    reliefBias: landform.reliefBias,
    flatSpots: landform.flatSpots,
    waterLevel: WL,
    peaks: peaksC,
    basins: basinsC,
    firmShore: true, // stray noise puddles never compete with the ONE body
  });
  const disposeProbe = (grp: THREE.Group) =>
    grp.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.geometry && !m.geometry.userData?.shared) m.geometry.dispose();
      if (m.material) (Array.isArray(m.material) ? m.material : [m.material]).forEach((mm) => mm.dispose());
    });
  const crit: [number, number][] = [...(guards.keepDry ?? [])];

  const evaluate = (
    h: (x: number, z: number) => number,
  ): { violations: string[]; bodies: number; waterCells: number; eastCells: number; neCells: number; apronMaxAbs: number } => {
    const violations: string[] = [];
    // flat front apron — the entrance forecourt (gate street + flanking
    // amenity cells span |x| ≤ 1.9), 3 cells deep behind the front edge
    let apronMaxAbs = 0;
    for (let x = -2.2; x <= 2.2001; x += 0.4) {
      for (let z = half - 3.6; z <= half - 0.4001; z += 0.4) {
        const v = h(x, z);
        apronMaxAbs = Math.max(apronMaxAbs, Math.abs(v));
        if (v < WL + 0.1) violations.push(`apron wet at ${x.toFixed(1)},${z.toFixed(1)}`);
      }
    }
    if (apronMaxAbs > 0.45) violations.push(`apron relief ${apronMaxAbs.toFixed(2)} > 0.45`);
    // ONE connected water body (grid flood fill, 4-connectivity)
    const step = waterGridStep(S);
    const n = Math.floor(S / step);
    const wet = new Uint8Array(n * n);
    for (let i = 0; i < n; i += 1)
      for (let j = 0; j < n; j += 1) wet[i * n + j] = h(-half + (i + 0.5) * step, -half + (j + 0.5) * step) < WL ? 1 : 0;
    let bodies = 0;
    let waterCells = 0;
    let eastCells = 0;
    let neCells = 0;
    const seen = new Uint8Array(n * n);
    for (let i = 0; i < n; i += 1)
      for (let j = 0; j < n; j += 1) {
        const idx = i * n + j;
        if (!wet[idx] || seen[idx]) continue;
        bodies += 1;
        const stack = [idx];
        seen[idx] = 1;
        while (stack.length) {
          const c = stack.pop()!;
          waterCells += 1;
          const ci = Math.floor(c / n);
          const cj = c % n;
          if (-half + (ci + 0.5) * step > 0) {
            eastCells += 1;
            if (-half + (cj + 0.5) * step > 0) neCells += 1;
          }
          (
            [
              [ci - 1, cj],
              [ci + 1, cj],
              [ci, cj - 1],
              [ci, cj + 1],
            ] as const
          ).forEach(([ni, nj]) => {
            if (ni < 0 || nj < 0 || ni >= n || nj >= n) return;
            const nn = ni * n + nj;
            if (wet[nn] && !seen[nn]) {
              seen[nn] = 1;
              stack.push(nn);
            }
          });
        }
      }
    if (bodies !== 1) violations.push(`${bodies} water bodies (must be exactly 1)`);
    if (waterCells * step * step < C.minWaterU2 * u * u) violations.push('water body too small to dominate its flank');
    // dry, sane ground under everything the caller plans to build
    crit.forEach(([x, z]) => {
      const v = h(x, z);
      if (v < WL + 0.18) violations.push(`built cell wet/marshy at ${x.toFixed(1)},${z.toFixed(1)}`);
      if (v > 0.8) violations.push(`built cell on a bulge at ${x.toFixed(1)},${z.toFixed(1)}`);
    });
    // coaster footings dry + no per-point ground bulge that would engage the
    // never-bury floor and detune the checked profile
    if (guards.coasterPts) {
      const grounds = guards.coasterPts.map(([x, , z]) => h(x, z));
      const sorted = [...grounds].sort((a, b) => a - b);
      const q80 = sorted[Math.floor(sorted.length * 0.8)];
      grounds.forEach((gh, i) => {
        if (gh < WL + 0.15) violations.push(`coaster footing wet at point ${i}`);
        if (gh - q80 > guards.coasterPts![i][1] - 0.25) violations.push(`ground bulge under coaster point ${i}`);
      });
    }
    return { violations, bodies, waterCells, eastCells, neCells, apronMaxAbs };
  };

  // pick the water style + hills + terrain seed with the REAL probe: try the
  // candidates in seeded preference order (each with its own hill placement,
  // clear of that candidate's basins) and accept the FIRST whose rules fully
  // hold; otherwise keep the best fit found anywhere (fewest violations, ties
  // to the earlier/preferred candidate) — the clamp pass below then repairs it
  interface CandidateFit {
    style: WaterStyle;
    water: ReturnType<typeof finalizeWater>;
    hills: HillCluster[];
    peaks: PeakZone[];
    ts: number;
    ev: ReturnType<typeof evaluate>;
  }
  let best: CandidateFit | null = null;
  let probesTried = 0;
  for (let ci = 0; ci < candidates.length && !(best && best.ev.violations.length === 0); ci += 1) {
    const water = finalizeWater(candidates[ci].style, candidates[ci].make());
    const hills = composeHills(water.basins, seeded(seed * 17 + ci * 31 + 7));
    const peaksC = hills.flatMap((c) => c.peaks);
    for (let k = 0; k < 16; k += 1) {
      const ts = seed * 13 + 3 + k * 97;
      const probe = buildTerrain(t, terrainOpts(ts, peaksC, water.basins));
      const ev = evaluate(probe.heightAt);
      disposeProbe(probe.mesh);
      probesTried += 1;
      if (!best || ev.violations.length < best.ev.violations.length) best = { style: candidates[ci].style, water, hills, peaks: peaksC, ts, ev };
      if (ev.violations.length === 0) break;
    }
  }
  const chosen = best!;
  const waterStyle = chosen.style;
  const { waterKind, basins, rep, beachDir } = chosen.water;
  const waterCentre: [number, number] = [rep.x, rep.z];
  const hillClusters = chosen.hills;
  const peaks = chosen.peaks;
  const maxPeakH = peaks.reduce((mx, p) => Math.max(mx, p.height), 0);
  /** above this height mountain flanks paint/dress as bare rock */
  const treeline = Math.max(1.15, 0.42 * maxPeakH + 0.6);
  /** sand band width past the waterline (climate-scaled, capped for huge parks) */
  const sandBand = (C.beachRays.length > 0 ? 1.05 + 0.26 * C.beachRays.length : 0.5) * Math.min(u, 2.3);

  // ---- POST-ENFORCE the guards (round-3 safeguard) ---------------------------
  // The probe picks the best seed but used to only WARN when no seed fully
  // satisfied the rules — generated parks then built their pads/lanes on wet
  // or bulging ground anyway (agents can't read consoles). The composition now
  // CLAMPS the terrain instead: synthesized blend-radius "clamp" discs RAISE
  // every wet guarded cell above the waterline (a natural-reading bank/berm)
  // and SHAVE bulges flat under guarded footprints/coaster footings (killing
  // the hoisted-path-level causeway at its root). The clamp zones ride along
  // as `clampPeaks`/`clampBasins` — <Terrain> feeds them to buildTerrain with
  // the authored peaks/basins, so mesh, colours and heightAt all agree — and
  // `report.violations` reflects POST-CLAMP reality (empty when the clamp
  // succeeded). Deterministic: pure function of the chosen seed + guards.
  const clampPeaks: PeakZone[] = [];
  const clampBasins: BasinZone[] = [];
  let finalEv = chosen.ev;
  if (chosen.ev.violations.length > 0) {
    const BLEND = CLAMP_BLEND; // clamp discs ease over ~2.4 u — reads as landscaping, not a spike
    const NOISE_MIN = CLAMP_NOISE_MIN; // TerrainKit peak noise factor lower bound — raising overshoots ≤ 18%
    const clampedOpts = () => terrainOpts(chosen.ts, [...peaks, ...clampPeaks], [...basins, ...clampBasins]);
    // pass 1 — RAISE/SHAVE: dry + de-bulge every guarded cell and footing
    const raisePass = () => {
      for (let pass = 0; pass < 6; pass += 1) {
        const probe = buildTerrain(t, clampedOpts());
        const h = probe.heightAt;
        let touched = false;
        const raiseTo = (x: number, z: number, target: number) => {
          const v = h(x, z);
          if (v >= target) return;
          const need = (target - v) / NOISE_MIN;
          const hit = clampPeaks.find((p) => Math.hypot(p.x - x, p.z - z) < 0.4);
          if (hit) hit.height += need;
          // a cell UNDER the waterline gets a TIGHT disc (a steep bank/berm —
          // "raise the pads higher" instead of trading away water area,
          // round-5 water-fraction fix); marshy cells still blend wide
          else clampPeaks.push({ x, z, height: need, radius: v < WL + 0.02 ? 1.4 : BLEND });
          touched = true;
        };
        const lowerTo = (x: number, z: number, target: number) => {
          const v = h(x, z);
          if (v <= target) return;
          const need = v - target;
          const hit = clampBasins.find((b) => Math.hypot(b.x - x, b.z - z) < 0.4);
          if (hit) hit.depth += need;
          else clampBasins.push({ x, z, depth: need, radius: BLEND });
          touched = true;
        };
        // keepDry cells: dry (probe gate WL+0.18) and never a bulge (gate 0.8)
        crit.forEach(([x, z]) => {
          raiseTo(x, z, WL + 0.3);
          lowerTo(x, z, 0.72);
        });
        // coaster footings: dry (gate WL+0.15), no bulge past the never-bury
        // budget (gate gh − q80 > y − 0.25)
        if (guards.coasterPts) {
          const grounds = guards.coasterPts.map(([x, , z]) => h(x, z));
          const sorted = [...grounds].sort((a, b) => a - b);
          const q80 = sorted[Math.floor(sorted.length * 0.8)];
          guards.coasterPts.forEach(([x, y, z]) => {
            raiseTo(x, z, WL + 0.27);
            lowerTo(x, z, q80 + y - 0.33);
          });
        }
        disposeProbe(probe.mesh);
        if (!touched) break;
      }
    };
    // raising a guarded cell can BISECT the water body (a dry causeway
    // through a lobe) — and exactly-one-body is a composition rule. FILL
    // every severed pond except the largest: lift its cells just above the
    // waterline with small overlapping discs (reads as reclaimed bank).
    const floodBodies = (h: (x: number, z: number) => number): [number, number][][] => floodWaterBodies(h, S);
    const fillPass = () => {
      for (let round = 0; round < 3; round += 1) {
        const probe = buildTerrain(t, clampedOpts());
        const bodies = floodBodies(probe.heightAt);
        if (bodies.length <= 1) {
          disposeProbe(probe.mesh);
          break;
        }
        bodies.sort((a, b) => b.length - a.length);
        const fills: [number, number][] = [];
        bodies.slice(1).forEach((body) =>
          body.forEach(([x, z]) => {
            if (fills.some(([fx, fz]) => Math.hypot(fx - x, fz - z) < 0.75)) return;
            fills.push([x, z]);
            const need = (WL + 0.25 - probe.heightAt(x, z)) / NOISE_MIN;
            if (need > 0) clampPeaks.push({ x, z, height: need, radius: 1.1 });
          }),
        );
        disposeProbe(probe.mesh);
        if (fills.length === 0) break;
      }
    };
    raisePass();
    fillPass();
    // WATER-FRACTION GUARD (round-5 safeguard): filling severed lobes dry
    // must never starve the ONE body below the climate ideal (≥ ~3% of the
    // plot / the climate's minWaterU2). Rather than trading more water for
    // buildability, EXPAND the body on its open side — still exactly one
    // body, never under the guarded layout, the coaster or the forecourt.
    {
      const targetU2 = Math.max(WATER_TARGET_FRAC * S * S, C.minWaterU2 * u * u);
      const grown = expandWaterBody(t, S, clampedOpts, clampBasins, { cells: crit, coasterPts: guards.coasterPts }, targetU2);
      if (grown > 0)
        console.info(
          `[ParkBuilder] water-fraction guard: guard clamping had shrunk the water body below the ${(WATER_TARGET_FRAC * 100).toFixed(0)}% ideal — grew it back with ${grown} edge basin(s) on its open side (still ONE body, layout untouched)`,
        );
    }
    // post-clamp reality check — the report the park is validated against
    const probe = buildTerrain(t, clampedOpts());
    finalEv = evaluate(probe.heightAt);
    disposeProbe(probe.mesh);
    // trading water AREA for buildability is what the clamp is FOR: when the
    // chosen seed's body was big enough BEFORE the guard clamp, a post-clamp
    // "too small" is the clamp's own doing (severed lobes filled back dry),
    // not a composition defect — downgrade it to a console warning. A seed
    // whose body was too small to begin with keeps the violation.
    const SIZE_RULE = 'water body too small to dominate its flank';
    if (!chosen.ev.violations.includes(SIZE_RULE)) {
      const sizeIdx = finalEv.violations.indexOf(SIZE_RULE);
      if (sizeIdx >= 0) {
        finalEv.violations.splice(sizeIdx, 1);
        console.warn(
          `[ParkBuilder] guard clamping traded away some water area for seed ${seed} (severed lobes were filled dry) — the remaining body is under the climate ideal but the layout is fully buildable`,
        );
      }
    }
    if (finalEv.violations.length > 0)
      console.warn(
        `[ParkBuilder] composition guards UNSATISFIED for seed ${seed} even after terrain clamping: ${finalEv.violations[0]}${finalEv.violations.length > 1 ? ` (+${finalEv.violations.length - 1} more)` : ''}`,
      );
    else if (clampPeaks.length + clampBasins.length > 0)
      console.info(
        `[ParkBuilder] composition guards post-enforced for seed ${seed}: raised ${clampPeaks.length} wet cell(s), flattened ${clampBasins.length} bulge(s) (probe seed left ${chosen.ev.violations.length} violation(s); post-clamp terrain is clean)`,
      );
  }
  const allPeaks = [...peaks, ...clampPeaks];
  const allBasins = [...basins, ...clampBasins];

  // ---- sand/beach flank: dune spots + palms on the chosen terrain -----------
  // (ray count is the climate's — coastal fans a wide beach, alpine none)
  const shore = buildTerrain(t, terrainOpts(chosen.ts, allPeaks, allBasins));
  const h = shore.heightAt;
  const sandSpots: { x: number; z: number; r: number }[] = [];
  const palmSpots: [number, number][] = [];
  C.beachRays.forEach((da) => {
    const a = Math.atan2(beachDir[1], beachDir[0]) + da;
    const dx = Math.cos(a);
    const dz = Math.sin(a);
    for (let s = rep.radius * 0.35; s <= rep.radius + 3.2; s += 0.3) {
      const x = rep.x + dx * s;
      const z = rep.z + dz * s;
      if (Math.abs(x) > half - 1.2 || Math.abs(z) > half - 1.2) break;
      if (h(x, z) <= WL + 0.1) continue; // still wet — keep walking outward
      // first dry ground beyond the waterline: dune patch here, palm behind
      const px = x + dx * 0.35;
      const pz = z + dz * 0.35;
      sandSpots.push({ x: px, z: pz, r: 0.5 + rnd() * 0.3 });
      palmSpots.push([x + dx * 1.25, z + dz * 1.25]);
      break;
    }
  });
  // desert: dune patches are not just a beach flank — scatter more of them
  // across the open flats (dry, in-bounds; YOUR legality lint still rejects
  // any that land near paths/lanes/footprints when you place them)
  for (let i = 0; sandSpots.length < C.beachRays.length + C.extraDunes && i < C.extraDunes * 5; i += 1) {
    const dx0 = (hash01(seed * 57.1 + i * 3.1) - 0.5) * (S - 3);
    const dz0 = (hash01(seed * 57.1 + i * 3.1 + 1.7) - 0.5) * (S - 3);
    if (h(dx0, dz0) <= WL + 0.16) continue;
    sandSpots.push({ x: dx0, z: dz0, r: 0.55 + hash01(seed * 57.1 + i * 3.1 + 2.9) * 0.5 });
  }
  disposeProbe(shore.mesh);

  // ---- suggested themed lands (zone index = colour offset; names from the
  // climate; representative spots — YOUR layout decides the real extents) -----
  const c1 = hillClusters[0];
  const zones: ParkComposition['zones'] = [
    { name: C.zoneNames.hub, at: [0, 2 * G] },
    { name: `${C.zoneNames.water} (${waterKind})`, at: waterCentre, ride: 'water ride — water colour preset' },
    { name: C.zoneNames.hills, at: [c1.x, c1.z], ride: 'coaster — wooden colour preset' },
    { name: C.zoneNames.fair, at: [S * 0.22, -S * 0.37], ride: 'flat rides — steel colour preset' },
  ];

  // ---- terrain SECTIONS: sand / meadow / mountain / forest -------------------
  const landZones: TerrainZone[] = [];
  landZones.push({
    kind: 'sand',
    center: [rep.x + beachDir[0] * 0.82 * rep.radius, rep.z + beachDir[1] * 0.82 * rep.radius],
    radius: Math.max(2.2, rep.radius * 0.85),
  });
  hillClusters.forEach((c) => landZones.push({ kind: 'mountain', center: [c.x, c.z], radius: c.radius }));
  // forest discs — open dry ground, clear of water/mountains/the forecourt
  const rndF = seeded(seed * 11 + 53);
  // forest count scales with plot AREA: +1 disc on the classic 48 (unchanged),
  // up to +8 on a 192 plot — a 16× bigger park needs 16× the woodland or it
  // reads as an empty field. (A compact 16 keeps its classic 1-2.)
  const nF = (clim === 'desert' ? 1 : 1 + (rndF() < 0.6 ? 1 : 0)) + (S >= 40 ? clamp(Math.round(areaK), 1, 8) : 0);
  const forests: TerrainZone[] = [];
  for (let i = 0; i < 16 + (S >= 40 ? nF * 12 : 0) && forests.length < nF; i += 1) {
    // radius capped tighter on huge plots so MANY distinct woods fit rather
    // than two continent-sized ones (the 48 cap is unchanged)
    const fr = clamp((2.3 + rndF() * 1.3) * u, 2.0, Math.min(half * 0.42, 6 + S * 0.12));
    const fx2 = (rndF() - 0.5) * (S - 2 * fr - 2.4);
    const fz2 = (rndF() - 0.5) * (S - 2 * fr - 2.4) - 0.05 * S;
    if (fz2 + fr > half - 4.6 && Math.abs(fx2) - fr * 0.5 < 3.4) continue; // forecourt stays open
    if (basins.some((b) => Math.hypot(fx2 - b.x, fz2 - b.z) < 0.74 * b.radius + fr * 0.35)) continue;
    if (hillClusters.some((c) => Math.hypot(fx2 - c.x, fz2 - c.z) < (c.radius + fr) * 0.55)) continue;
    if (forests.some((f) => Math.hypot(fx2 - f.center[0], fz2 - f.center[1]) < (f.radius + fr) * 0.9)) continue;
    forests.push({ kind: 'forest', center: [fx2, fz2], radius: fr });
  }
  landZones.push(...forests);
  /** local relief over a ~3-u disc — build FIELDS are picked for flatness, not
   *  just for elbow room: once the landform archetype carries real relief, the
   *  farthest-from-everything spot can easily be a hillside */
  const localRelief = (x: number, z: number): number => {
    let lo = Infinity;
    let hiL = -Infinity;
    for (const [dx, dz] of [[0, 0], [3, 0], [-3, 0], [0, 3], [0, -3], [2.1, 2.1], [-2.1, -2.1]] as const) {
      const v = h(x + dx, z + dz);
      if (v < lo) lo = v;
      if (v > hiL) hiL = v;
    }
    return hiL - lo;
  };
  // representative open-meadow disc: the sampled spot farthest from every
  // other section and the water AND flat enough to build on (the classifier's
  // fallback either way)
  {
    let bestSpot: [number, number] = [S * 0.2, -S * 0.12];
    let bestD = -1;
    let bestScore = -Infinity;
    for (let i = 0; i < 20 + (bigPlot ? 28 : 0); i += 1) {
      const mx2 = (hash01(seed * 23.3 + i * 4.7) - 0.5) * (S - 6);
      const mz2 = (hash01(seed * 23.3 + i * 4.7 + 2.1) - 0.5) * (S - 6);
      let d = Infinity;
      for (const zn of landZones) d = Math.min(d, Math.hypot(mx2 - zn.center[0], mz2 - zn.center[1]) - zn.radius);
      for (const b of basins) d = Math.min(d, Math.hypot(mx2 - b.x, mz2 - b.z) - 0.74 * b.radius);
      // flatness only enters on archetype plots (a size-16 plains park scores
      // exactly as before — its localRelief term is 0 to within float noise)
      const score = bigPlot ? d - 3.5 * localRelief(mx2, mz2) : d;
      if (score > bestScore) {
        bestScore = score;
        bestD = d;
        bestSpot = [mx2, mz2];
      }
    }
    landZones.push({ kind: 'meadow', center: bestSpot, radius: Math.max(3, bestD + 2) });
  }
  // MULTIPLE DISTINCT FLAT BUILD ZONES (size ≥ 32): expansive land earns MORE
  // meadow fields — each the sampled spot farthest from every section already
  // placed (including earlier meadows) and the water, and (on archetype plots)
  // flat enough to build on — so layouts spread into real districts instead of
  // crowding one clearing. Count scales with plot AREA: 1 on the classic 48
  // (unchanged), up to 6 on a 192. Size-16 parks keep exactly one meadow.
  if (S >= 32) {
    const extraM = clamp(Math.round(areaK), 1, 6);
    for (let e = 0; e < extraM; e += 1) {
      let spot: [number, number] | null = null;
      let bd = -1;
      let bs = -Infinity;
      for (let i = 0; i < 24 + (bigPlot ? 24 : 0); i += 1) {
        const mx2 = (hash01(seed * 29.7 + e * 13.9 + i * 4.7) - 0.5) * (S - 6);
        const mz2 = (hash01(seed * 29.7 + e * 13.9 + i * 4.7 + 2.1) - 0.5) * (S - 6);
        let d = Infinity;
        for (const zn of landZones) d = Math.min(d, Math.hypot(mx2 - zn.center[0], mz2 - zn.center[1]) - zn.radius);
        for (const b of basins) d = Math.min(d, Math.hypot(mx2 - b.x, mz2 - b.z) - 0.74 * b.radius);
        const sc = bigPlot ? d - 3.5 * localRelief(mx2, mz2) : d;
        if (sc > bs) {
          bs = sc;
          bd = d;
          spot = [mx2, mz2];
        }
      }
      // only a genuinely OPEN field qualifies — never a sliver between zones
      if (spot && bd > 2.2) landZones.push({ kind: 'meadow', center: spot, radius: Math.max(3, bd + 2) });
    }
  }
  const sandZone = landZones[0];
  const waterB = basins.slice();
  const peakBumpAt = (x: number, z: number): number => {
    let bmp = 0;
    for (const p of peaks) {
      const k = Math.max(0, 1 - Math.hypot(x - p.x, z - p.z) / p.radius);
      if (k > 0) bmp += p.height * k * k * (3 - 2 * k);
    }
    return bmp;
  };
  const zoneAt = (x: number, z: number): TerrainZoneKind => {
    if (peakBumpAt(x, z) > 0.5) return 'mountain';
    let dW = Infinity;
    for (const b of waterB) dW = Math.min(dW, Math.hypot(x - b.x, z - b.z) - 0.74 * b.radius);
    const inSand = Math.hypot(x - sandZone.center[0], z - sandZone.center[1]) < sandZone.radius;
    if (dW < sandBand * (inSand ? 1.7 : 1)) return 'sand';
    for (const f of forests) if (Math.hypot(x - f.center[0], z - f.center[1]) < f.radius) return 'forest';
    return 'meadow';
  };

  return {
    terrainSeed: chosen.ts,
    landform,
    climate: clim,
    waterKind,
    basins,
    waterCentre,
    hillClusters,
    peaks,
    clampPeaks,
    clampBasins,
    beachDir,
    sandSpots,
    palmSpots,
    zones,
    size: S,
    waterStyle,
    mountainStyle,
    landZones,
    zoneAt,
    treeline,
    sandBand,
    guardCells: keep,
    coasterXZ: (guards.coasterPts ?? []).map(([x, , z]) => [x, z] as [number, number]),
    report: {
      probesTried,
      violations: finalEv.violations,
      clampedCells: clampPeaks.length + clampBasins.length,
      waterBodies: finalEv.bodies,
      waterAreaU2: finalEv.waterCells * gStep * gStep,
      waterFracEastHalf: (finalEv.eastCells * gStep * gStep) / (half * S),
      waterFracNEQuad: (finalEv.neCells * gStep * gStep) / (half * half),
      apronMaxAbs: finalEv.apronMaxAbs,
    },
  };
}

// ---------------------------------------------------------------------------
// reclampTerrain — AUTO-keepDry (round-5 safeguard). Authors' keepDry lists
// are a HINT, not a requirement: after every child has mounted, <Park>
// collects EVERY registered footprint (pads, huts, queue lanes — including
// the derived/trimmed/flipped/auto-shifted ones no static plan could have
// predicted) plus the as-built coaster polylines and re-runs the guard-clamp
// pass over them. Wet cells are raised into dry banks, bulges under rects are
// shaved, severed lobes re-merged/filled (exactly ONE body stays a rule), the
// water-fraction guard re-applies, and ground can never bury the built rails.
// The clamp discs are appended to comp.clampPeaks/clampBasins IN PLACE so a
// terrain rebuild from the composition reproduces the healed landform.
// Deterministic: pure function of the composition + the rect/point lists.
// ---------------------------------------------------------------------------

export interface ReclampReport {
  /** true when any clamp disc was added — rebuild the terrain mesh from the
   *  composition's updated peak/basin lists (<Park>'s <Terrain> does) */
  touched: boolean;
  /** wet guarded cells raised into banks */
  raised: number;
  /** bulges shaved under footprints / rails un-buried */
  shaved: number;
  /** severed water lobes filled back dry (one-body rule) */
  filled: number;
  /** water-fraction guard expansion basins added */
  expanded: number;
}

/**
 * Re-run the composition's terrain guard clamp over RUNTIME-DERIVED state:
 * `rects` are audited footprint rects (manager.footprints() + stall rects +
 * any registerFootprint extras), `coasterPts` the as-built circuit points
 * (world space). Appends clamp discs to `comp.clampPeaks`/`comp.clampBasins`
 * (mutated in place); the caller rebuilds the terrain mesh from
 * `[...comp.peaks, ...comp.clampPeaks]` / `[...comp.basins,
 * ...comp.clampBasins]` when `touched`. Notes:
 *   - wet gate mirrors validatePark's wet-pad check (rect centre + corners
 *     vs waterLevel + 0.05) with margin: triggers below WL+0.08, raises to
 *     WL+0.3;
 *   - bulges under rects above the probe gate (0.8) are shaved to 0.72;
 *   - coaster points are ANTI-BURIAL constraints (ground capped 0.35 under
 *     the rails) — footings standing IN water are the RCT2 look and are
 *     never "dried" (that would drain authored lakes under water rides);
 *   - the front apron stays flat and dry whatever the clamp does.
 */
export function reclampTerrain(
  t: typeof THREE,
  comp: ParkComposition,
  rects: ParkFootRect[],
  coasterPts: [number, number, number][] = [],
): ReclampReport {
  const S = comp.size;
  const half = S / 2;
  const report: ReclampReport = { touched: false, raised: 0, shaved: 0, filled: 0, expanded: 0 };
  // sample cells: rect centre + the four corners (the validator's sampling)
  const cells: [number, number][] = [];
  const pushCell = (x: number, z: number) => {
    if (Math.max(Math.abs(x), Math.abs(z)) > half - 0.15) return;
    // tight dedup only — the raise discs are steep (radius 1.4 over water),
    // so a merged sample 0.3 away can leave the REAL corner wet
    if (cells.some(([cx, cz]) => Math.hypot(cx - x, cz - z) < 0.12)) return;
    cells.push([x, z]);
  };
  for (const f of rects) {
    const ax: [number, number] = [Math.cos(f.yaw), -Math.sin(f.yaw)];
    const az: [number, number] = [Math.sin(f.yaw), Math.cos(f.yaw)];
    for (const [sx, sz] of [[0, 0], [1, 1], [1, -1], [-1, 1], [-1, -1]] as const)
      pushCell(f.cx + ax[0] * f.hx * sx + az[0] * f.hz * sz, f.cz + ax[1] * f.hx * sx + az[1] * f.hz * sz);
  }
  const clampPeaks = comp.clampPeaks;
  const clampBasins = comp.clampBasins;
  const mkOpts = () => ({
    size: S,
    seg: 2, // heightAt is independent of seg — probe geometry is throwaway
    seed: comp.terrainSeed,
    // the composition's own LANDFORM — never TERRAIN_BASE: a reclamp probing a
    // different base heightfield than the one <Terrain> renders would raise and
    // shave against ground that does not exist
    amplitude: comp.landform.amplitude,
    scale: comp.landform.scale,
    octaves: comp.landform.octaves,
    roughness: comp.landform.roughness,
    reliefBias: comp.landform.reliefBias,
    flatSpots: comp.landform.flatSpots,
    waterLevel: WL,
    peaks: [...comp.peaks, ...clampPeaks],
    basins: [...comp.basins, ...clampBasins],
    firmShore: true,
  });
  const disposeP = (grp: THREE.Group) =>
    grp.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.geometry && !m.geometry.userData?.shared) m.geometry.dispose();
      if (m.material) (Array.isArray(m.material) ? m.material : [m.material]).forEach((mm) => mm.dispose());
    });
  const apronCells: [number, number][] = [];
  for (const ax of [-2.2, 0, 2.2]) for (const az of [half - 3.6, half - 2, half - 0.4]) apronCells.push([ax, az]);

  // ---- fast precheck: is anything actually violating? -----------------------
  {
    const probe = buildTerrain(t, mkOpts());
    const h = probe.heightAt;
    const wet = cells.some(([x, z]) => h(x, z) < WL + 0.08);
    const bulged = cells.some(([x, z]) => h(x, z) > 0.8);
    const buried = coasterPts.some(([x, y, z]) => h(x, z) > y - 0.25);
    disposeP(probe.mesh);
    if (!wet && !bulged && !buried) return report; // terrain already sane — no rebuild
  }

  // ---- raise/shave + one-body fill, run as TWO healing cycles: filling a
  // severed lobe can re-wet a raised corner (and vice versa), so one more
  // cheap cycle guarantees convergence on the exact validator samples -------
  for (let cycle = 0; cycle < 2; cycle += 1) {
  // ---- raise/shave pass (same discs as the composition clamp) ---------------
  for (let pass = 0; pass < 8; pass += 1) {
    const probe = buildTerrain(t, mkOpts());
    const h = probe.heightAt;
    let touchedPass = false;
    // CONVERGENCE RULE: a correction first UNDOES an earlier opposite
    // correction near the cell (shrink an over-deepened basin / over-raised
    // peak) before adding a new disc — raise and shave can never stack into
    // a tug-of-war (overlapping rect samples used to diverge to ±15 u)
    const raiseTo = (x: number, z: number, trigger: number, target: number) => {
      const v = h(x, z);
      if (v >= trigger) return;
      const need = (target - v) / CLAMP_NOISE_MIN;
      const basin = clampBasins.find((b) => Math.hypot(b.x - x, b.z - z) < 0.7 && b.depth > 0.05);
      if (basin) basin.depth = Math.max(0, basin.depth - need);
      else {
        const hit = clampPeaks.find((p) => Math.hypot(p.x - x, p.z - z) < 0.4);
        if (hit) hit.height += need;
        // under-waterline cells: TIGHT disc (steep bank) so the raise trades
        // away as little water area as possible (round-5 water-fraction fix)
        else clampPeaks.push({ x, z, height: need, radius: v < WL + 0.02 ? 1.4 : CLAMP_BLEND });
      }
      report.raised += 1;
      touchedPass = true;
    };
    const lowerTo = (x: number, z: number, trigger: number, target: number) => {
      const v = h(x, z);
      if (v <= trigger) return;
      const need = v - target;
      const peak = clampPeaks.find((p) => Math.hypot(p.x - x, p.z - z) < 0.7 && p.height > 0.05);
      if (peak) peak.height = Math.max(0, peak.height - need / CLAMP_NOISE_MIN);
      else {
        const hit = clampBasins.find((b) => Math.hypot(b.x - x, b.z - z) < 0.4);
        if (hit) hit.depth += need;
        else clampBasins.push({ x, z, depth: need, radius: CLAMP_BLEND });
      }
      report.shaved += 1;
      touchedPass = true;
    };
    cells.forEach(([x, z]) => {
      raiseTo(x, z, WL + 0.08, WL + 0.3); // dry every footprint sample
      lowerTo(x, z, 0.8, 0.72); // shave bulges under it
    });
    // never bury the built rails: cap ground 0.35 under every track point
    coasterPts.forEach(([x, y, z]) => lowerTo(x, z, y - 0.25, y - 0.35));
    // the forecourt stays flat and dry whatever the discs did around it
    apronCells.forEach(([x, z]) => {
      raiseTo(x, z, WL + 0.1, WL + 0.22);
      lowerTo(x, z, 0.5, 0.42);
    });
    disposeP(probe.mesh);
    if (!touchedPass) break;
  }

  // ---- one-body fill pass (raising can bisect the water) --------------------
  for (let round = 0; round < 3; round += 1) {
    const probe = buildTerrain(t, mkOpts());
    const bodies = floodWaterBodies(probe.heightAt, S);
    if (bodies.length <= 1) {
      disposeP(probe.mesh);
      break;
    }
    bodies.sort((a, b) => b.length - a.length);
    const fills: [number, number][] = [];
    bodies.slice(1).forEach((body) =>
      body.forEach(([x, z]) => {
        if (fills.some(([fx, fz]) => Math.hypot(fx - x, fz - z) < 0.75)) return;
        fills.push([x, z]);
        const need = (WL + 0.25 - probe.heightAt(x, z)) / CLAMP_NOISE_MIN;
        if (need > 0) {
          clampPeaks.push({ x, z, height: need, radius: 1.1 });
          report.filled += 1;
        }
      }),
    );
    disposeP(probe.mesh);
    if (fills.length === 0) break;
  }
  } // healing cycles

  // ---- water-fraction guard (round-5 fix #4, same rule as composition) ------
  {
    const u = S / 16;
    const targetU2 = Math.max(WATER_TARGET_FRAC * S * S, CLIMATE_SPECS[comp.climate].minWaterU2 * u * u);
    report.expanded = expandWaterBody(t, S, mkOpts, clampBasins, { cells, coasterPts }, targetU2);
  }

  report.touched = report.raised + report.shaved + report.filled + report.expanded > 0;
  return report;
}

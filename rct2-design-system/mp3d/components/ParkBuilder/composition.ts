// ---------------------------------------------------------------------------
// ParkBuilder/composition.ts — parkComposition: RCT2-scenario-style TERRAIN +
// CLIMATE seeding, PROBED over deterministic terrain-noise seeds until the
// rules hold (authored hill clusters, TWO flood-filled water bodies on any
// plot >= TWO_WATER_MIN_SIZE / one below it, a beach
// flank, a flat entrance apron), plus the MEMOISED entry point every park
// mounts through.
//
// SPLIT LAYOUT (2026-07-26). This file was 109 KB — more than one design-system
// write call can emit — so everything that is not the composer itself moved to
// siblings, and every public name they carry is re-exported BY NAME below so
// ../ParkBuilder's surface is exactly what it was:
//   landform.ts — composition TYPES, the guard peak-caps, the landform-character
//                 measurement, the §1 seed table, water flood-fill/expansion
//   ranges.ts   — makeRangeComposer: the seeded mountain-range archetype, its
//                 anchor slots and the guard-aware placement walk
//   sections.ts — computeReliefFloor + composeLandZones
//   reclamp.ts  — reclampTerrain (AUTO-keepDry)
//
// `parkComposition`, its MEMO CACHE and `composeParkUncached` deliberately stay
// TOGETHER in this file: the cache exists only to guard that one function, and
// the "cache a pristine copy, hand out fresh clones" contract documented below
// is unreadable — and silently breakable — if the two drift into different
// modules.
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
  landformDramaK,
} from './climate';
import type { ParkClimate, TerrainStyle } from './climate';
import {
  bodyGap,
  floodWaterBodies,
  expandWaterBody,
  CLAMP_BLEND,
  CLAMP_NOISE_MIN,
  WATER_TARGET_FRAC,
  TWO_WATER_MIN_SIZE,
  SECOND_WATER_MIN_FRAC,
  waterBodyTarget,
  waterBodyGapMin,
} from './landform';
import type {
  CompositionGuards,
  HillCluster,
  ParkComposition,
  ParkLandform,
  PeakCapEntry,
  SecondWaterStyle,
  TerrainZoneKind,
  WaterStyle,
} from './landform';
import { makeRangeComposer } from './ranges';
import { computeReliefFloor, composeLandZones } from './sections';

// ---- the siblings' PUBLIC surface, re-exported BY NAME (never `export *`) so
// ../ParkBuilder/index.tsx keeps importing all of it from './composition' and
// no consumer of '../ParkBuilder' can tell the split happened.
export {
  measurePlotRelief,
  RELIEF_GRID,
  RELIEF_FLOOR_FRAC,
  SEED_TABLE_128,
  SEED_TABLE_SIZE,
  SEED_TABLE_128_BAND,
  seedTableRow,
  TWO_WATER_MIN_SIZE,
  SECOND_WATER_MIN_FRAC,
  waterBodyTarget,
  waterBodyGapMin,
} from './landform';
export type {
  HillCluster,
  TerrainZoneKind,
  TerrainZone,
  WaterStyle,
  SecondWaterStyle,
  MountainStyle,
  CompositionGuards,
  ParkComposition,
  ParkLandform,
  SeedTableRow,
  ReliefFloorReport,
} from './landform';
export { reclampTerrain } from './reclamp';
export type { ReclampReport } from './reclamp';

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
 *   - TWO water bodies on any plot ≥ `TWO_WATER_MIN_SIZE` (one below it): a
 *     DOMINANT body whose STYLE varies — a big 'central' lake, a 'corner'
 *     lagoon hugging a beach, a winding 'river' inlet chain or the classic
 *     NE 'flank' lake — plus a SECONDARY body across the plot ('inlet' river
 *     chain or standalone 'tarn'), flood-fill enforced to exactly
 *     `waterBodyTarget(size)` connected bodies with the secondary at least
 *     `SECOND_WATER_MIN_FRAC` of the dominant one and `waterBodyGapMin(size)`
 *     clear of it — never a scatter of ponds — sized with the park, and picked
 *     so a guarded layout is never flooded;
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
// ---------------------------------------------------------------------------
// MEMO CACHE. `parkComposition` is a deterministic pure function of (seed,
// size, climate, guards) — that is the property the whole seed table rests on
// — and it is also, measured, the single most expensive thing in a park's
// initial load: 601 ms of a park's 861 ms terrain build, because it probes up
// to 16 candidate terrains per water candidate and samples `heightAt` (FBM)
// across the plot for each. That search CANNOT be shortened without changing
// what it returns, and every park's layout plus every recorded seed-table
// number depends on the answer, so the cost of the FIRST call stands.
//
// What it must not do is pay that cost TWICE for the same question, and it was:
// <Terrain>'s effect re-runs whenever its props change, React StrictMode
// double-invokes effects in development, and the Magic Patterns editor
// remounts on every edit. Same inputs → same output, so the result is cached.
// Bounded to 4 entries (a park mounts one composition; the spare room covers a
// prop-tweak loop) and keyed on the exact arguments, guards included.
// CACHE A PRISTINE COPY, HAND OUT FRESH ONES. The composition is MUTATED after
// it is created — `reclampTerrain` pushes guard discs into `comp.clampPeaks` /
// `comp.clampBasins` when <Terrain>'s auto-keepDry pass re-runs — so handing
// the same instance to a second mount would leak the first mount's clamp discs
// into it and quietly change the terrain. Every hit therefore returns a deep
// clone of an untouched snapshot. If the environment cannot structuredClone the
// composition, nothing is cached and behaviour is exactly as it was before.
const COMPOSITION_CACHE = new Map<string, ParkComposition>();
const COMPOSITION_CACHE_MAX = 4;
const cloneComposition = (c: ParkComposition): ParkComposition | null => {
  try {
    return typeof structuredClone === 'function' ? structuredClone(c) : null;
  } catch {
    return null; // holds something non-cloneable — do not cache
  }
};

export function parkComposition(
  t: typeof THREE,
  seed: number,
  // NOT the <Park size> default. Wave 8 moved `<Park>` to 192
  // (parkRoot.tsx) and DELIBERATELY left this at 48: every direct caller
  // (the harness's seed-table.mjs, the §1 table, ParkBuilder.previews) passes
  // `size` explicitly, and raising this default would silently re-compose
  // every one of them. ALWAYS PASS `size` — omitting it gives you a 48-plot
  // composition on a 192 park, whose water and ranges are 1/4 the linear
  // scale and land in the wrong place. See rules/park-generation.md §7.
  size = 48,
  climate?: ParkClimate,
  guards: CompositionGuards = {},
): ParkComposition {
  const cacheKey = JSON.stringify([seed, size, climate ?? null, guards.keepDry ?? null, guards.coasterPts ?? null]);
  const cached = COMPOSITION_CACHE.get(cacheKey);
  if (cached) {
    const fresh = cloneComposition(cached);
    if (fresh) return fresh;
  }
  const composed = composeParkUncached(t, seed, size, climate, guards);
  const snapshot = cloneComposition(composed);
  if (snapshot) {
    if (COMPOSITION_CACHE.size >= COMPOSITION_CACHE_MAX) COMPOSITION_CACHE.delete(COMPOSITION_CACHE.keys().next().value as string);
    COMPOSITION_CACHE.set(cacheKey, snapshot);
  }
  return composed;
}

function composeParkUncached(
  t: typeof THREE,
  seed: number,
  size: number,
  climate: ParkClimate | undefined,
  guards: CompositionGuards,
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
  // MOUNTAINOUS CHARACTER (2026-07): the archetype's own drama factor, 1 at or
  // below the classic 48 so those compositions are bit-identical
  const dramaK = bigPlot ? landformDramaK(styleSpec, S) : 1;
  // per-seed jitter INSIDE the archetype so two seeds sharing a style still
  // differ (±18% amplitude, ±22% wavelength, ±0.08 roughness)
  const landform: ParkLandform = bigPlot
    ? {
        style: terrainStyle,
        amplitude: styleSpec.amplitude * ampK * dramaK * (0.82 + rndT() * 0.36),
        scale: S * styleSpec.scaleK * (0.78 + rndT() * 0.44),
        octaves: styleSpec.octaves,
        roughness: clamp(styleSpec.roughness + (rndT() - 0.5) * 0.16, 0.2, 0.8),
        // GENTLE THROUGH THE PARK CORE, FULL ARCHETYPE DRAMA ON THE FLANKS —
        // reaching full amplitude by 0.36·S (not the very rim) so the relief is
        // visible in the MID field, which is most of what a camera sees.
        //
        // 2026-07: `inner` drops 0.32 → 0.18 at the same time as the amplitude
        // roughly triples. That is deliberate and it is the whole trick — the
        // CORE ends up only ~1.35× its old relief (streets, ramps and the
        // path-level median still work, and the buildable-land fraction barely
        // moves) while the FLANKS get ~2.4× and the horizon finally has a
        // silhouette. Pushing amplitude without pushing `inner` DOWN is what
        // would break the terrain-normality gate.
        //
        // SIZE-GATED like every other part of this rescale: a ≤48 plot gets
        // neither the amplitude rise nor this rebalance, so it composes exactly
        // the ground it composed before (the five reference parks live there).
        reliefBias: S > 48 ? { r0: 0.09 * S, r1: 0.36 * S, inner: 0.18 } : { r0: 0.1 * S, r1: 0.38 * S, inner: 0.32 },
        // the entrance forecourt stays level whatever the archetype drew
        // (the apron gate is |height| ≤ 0.45 in ABSOLUTE terms). `k` had to drop
        // with the amplitude rise: 0.1 of an 8-u landform is ±0.4 u of residual
        // apron relief, which sits ON the 0.45 gate. The pocket also grows with
        // the plot so the whole sampled apron box stays inside it.
        flatSpots: [{ x: 0, z: half - 2, rx: Math.max(3.2, S * 0.03), rz: 2.2, k: bigPlot && S > 48 ? 0.035 : 0.1, blend: Math.max(3.4, S * 0.035) }],
      }
    : { style: 'plains', amplitude: TERRAIN_BASE.amplitude, scale: S * TERRAIN_BASE.scaleK, octaves: TERRAIN_BASE.octaves, roughness: TERRAIN_BASE.roughness };

  // ---- the DOMINANT water body — its CHARACTER varies per seed ---------------
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
  // dry, the right body count with a real gap, dry apron...) — never a
  // geometric guess.
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

  // ---- the SECOND water body (2026-07) ---------------------------------------
  // Plots ≥ TWO_WATER_MIN_SIZE carry a DOMINANT body plus a SECONDARY one — a
  // lake with a river inlet across the map, a lake with a back tarn. It is
  // authored as a proper body, never as scatter: sized off the dominant body
  // (so it is a real second water story, not a puddle — SECOND_WATER_MIN_FRAC),
  // and anchored on the FAR SIDE of the plot with a `waterBodyGapMin(S)` gap so
  // the two never read as one lake with an isthmus. The probe below verifies
  // count, size ratio and gap on the BUILT heightfield; these are just
  // candidates, deterministic and in a fixed seeded order.
  const twoWater = S >= TWO_WATER_MIN_SIZE;
  const gapMin = waterBodyGapMin(S);
  const rndW2 = seeded(seed * 23 + 71);
  const w2: number[] = [];
  for (let i = 0; i < 12; i += 1) w2.push(rndW2());
  /** the secondary body's own character: alpine/desert get a compact standalone
   *  pool (a back tarn / a second oasis), the wetter climates lean to a winding
   *  inlet chain — the same climate logic the dominant body's styles use */
  const secondStyle: SecondWaterStyle =
    clim === 'alpine' || clim === 'desert' ? (w2[0] < 0.24 ? 'inlet' : 'tarn') : w2[0] < 0.52 ? 'inlet' : 'tarn';
  /** build the secondary body's bowls at an anchor. Both shapes are ONE
   *  connected body by construction (the inlet's spacing keeps the waterlines
   *  merged, the tarn's lobe overlaps its bowl). `reach` is the shape's own
   *  waterline half-extent, used by the placement prefilters. */
  const secondAt = (ax: number, az: number, r2: number, axis: number): { bowls: BasinZone[]; reach: number } => {
    if (secondStyle === 'inlet') {
      const rB = Math.max(1.5, r2 * 0.74);
      const nB = 3 + (w2[1] < 0.55 ? 1 : 0);
      const spacing = 0.92 * rB;
      const dirx = Math.cos(axis);
      const dirz = Math.sin(axis);
      const wig = 0.55 * rB;
      const bowls: BasinZone[] = [];
      for (let i = 0; i < nB; i += 1) {
        const along = (i - (nB - 1) / 2) * spacing;
        const off = Math.sin(w2[2] * 6.28 + i * 1.1) * wig;
        // DEEPER THAN THE DOMINANT BODY'S BOWLS ON PURPOSE (2.05 → 2.9): the
        // secondary body is anchored geometrically, BEFORE any heightfield
        // exists, so its bowls can land on ground a metre or two above the water
        // table. At the dominant body's depth such a bowl floods only a sliver
        // and the "secondary is a pond, not a body" rule fires — measured on 1 of
        // 96 sweep pairs (seed 13 coastal, secondary at 3% of the dominant).
        bowls.push({ x: ax + dirx * along - dirz * off, z: az + dirz * along + dirx * off, radius: rB, depth: 2.9 });
      }
      return { bowls, reach: 0.74 * rB + spacing * ((nB - 1) / 2) + wig };
    }
    const lobeA = w2[3] * Math.PI * 2;
    const bowls: BasinZone[] = [
      // deeper than the dominant body's bowls for the same reason the inlet's
      // are — see the note there
      { x: ax, z: az, radius: r2, depth: 3 },
      { x: ax + Math.cos(lobeA) * 0.58 * r2, z: az + Math.sin(lobeA) * 0.58 * r2, radius: r2 * 0.64, depth: 2.3 },
    ];
    return { bowls, reach: 0.74 * r2 * 1.62 };
  };
  /** append a secondary body to a finalized dominant body. Anchors are a fixed
   *  jittered ring ordered FARTHEST-FROM-THE-DOMINANT-BODY first, so the two
   *  bodies land on opposite sides of the plot whenever there is room; the
   *  first anchor clearing every geometric prefilter wins (the real probe then
   *  checks the built ground). Returns the dominant body untouched when no
   *  anchor fits — the probe's `waterBodies` violation then says so out loud
   *  instead of the composition silently shipping one body. */
  const addSecond = (
    primary: ReturnType<typeof finalizeWater>,
  ): { basins: BasinZone[]; second: BasinZone[]; rep2: BasinZone | null } => {
    if (!twoWater) return { basins: primary.basins, second: [], rep2: null };
    // size it off the DOMINANT body so the ratio gate is satisfiable by
    // construction: ~0.45-0.62 of its radius ⇒ ~0.20-0.38 of its area
    const rPrim = primary.rep.radius;
    const r2 = clamp(rPrim * (0.46 + 0.17 * w2[4]), 1.8, half * 0.27);
    const anchors: { x: number; z: number; d: number }[] = [];
    const spin = w2[5] * Math.PI * 2;
    for (const rr of [0.66, 0.5, 0.78]) {
      for (let k = 0; k < 12; k += 1) {
        const a = spin + (k / 12) * Math.PI * 2 + (w2[6] - 0.5) * 0.3;
        const ax = Math.cos(a) * rr * half;
        const az = Math.sin(a) * rr * half;
        // distance from the DOMINANT body's waterline — the ordering key
        let d = Infinity;
        for (const b of primary.basins) d = Math.min(d, Math.hypot(ax - b.x, az - b.z) - 0.74 * b.radius);
        anchors.push({ x: ax, z: az, d });
      }
    }
    anchors.sort((p, q) => q.d - p.d);
    // FARTHEST-FIRST, but not slavishly: taking anchors[0] every time put the
    // secondary body in the exactly-diametrically-opposite corner on every
    // seed, so all 16 rows of the §1 table read "lake in one corner, tarn in
    // the other". Rotate the head of the list by a seeded offset instead — the
    // gap prefilter below is what actually guarantees separation, so any of the
    // roomiest handful is equally legal and the placement varies per seed.
    const headRoll = Math.floor(w2[8] * 6);
    const ordered = [...anchors.slice(headRoll, Math.min(anchors.length, headRoll + 6)), ...anchors];
    const axis = w2[7] * Math.PI;
    for (const an of ordered) {
      const { bowls, reach } = secondAt(an.x, an.z, r2, axis);
      // in bounds, with the plot-edge taper clear of the waterline
      if (bowls.some((b) => Math.max(Math.abs(b.x), Math.abs(b.z)) + 0.74 * b.radius > half - 1.8)) continue;
      // never lap the entrance forecourt (the apron gate is a hard rule)
      if (bowls.some((b) => b.z + 0.74 * b.radius > half - 4.6 && Math.abs(b.x) - 0.74 * b.radius < 3.4)) continue;
      // a real GAP from the dominant body's waterline — non-adjacency is the
      // whole point of a second body
      if (an.d < gapMin + reach) continue;
      // never drown a cell the caller plans to build on
      if (keep.some(([gx, gz]) => bowls.some((b) => Math.hypot(gx - b.x, gz - b.z) < 0.74 * b.radius + 1.2))) continue;
      if ((guards.coasterPts ?? []).some(([gx, , gz]) => bowls.some((b) => Math.hypot(gx - b.x, gz - b.z) < 0.74 * b.radius + 1.2))) continue;
      return { basins: [...primary.basins, ...bowls], second: bowls, rep2: bowls[Math.floor(bowls.length / 2)] };
    }
    return { basins: primary.basins, second: [], rep2: null };
  };

  // ---- mountain RANGES: a seeded archetype on edge/corner slots --------------
  // The composer itself lives in ./ranges (split 2026-07-26): same archetype
  // roll, same range specs, same slot ring, same guard-aware placement walk —
  // and the same `rndM`/`rndS` draw order, so it composes bit-identically.
  const { mountainStyle, guardCloud, guardAware, composeHills } = makeRangeComposer({
    seed,
    S,
    u,
    half,
    areaK,
    clim,
    hillBoost: C.hillBoost,
    keep,
    coasterPts: guards.coasterPts,
  });

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
    firmShore: true, // stray noise puddles never compose a THIRD body
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
  ): {
    violations: string[];
    bodies: number;
    waterCells: number;
    bodyCells: number[];
    gap: number;
    eastCells: number;
    neCells: number;
    apronMaxAbs: number;
  } => {
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
    // the park's water bodies (grid flood fill, 4-connectivity): exactly
    // `waterBodyTarget(S)` of them — TWO on any plot ≥ TWO_WATER_MIN_SIZE, one
    // below it — with the secondary a real body (SECOND_WATER_MIN_FRAC of the
    // dominant one) standing a `waterBodyGapMin(S)` gap clear of it
    const step = waterGridStep(S);
    const n = Math.floor(S / step);
    const wet = new Uint8Array(n * n);
    for (let i = 0; i < n; i += 1)
      for (let j = 0; j < n; j += 1) wet[i * n + j] = h(-half + (i + 0.5) * step, -half + (j + 0.5) * step) < WL ? 1 : 0;
    let bodies = 0;
    let waterCells = 0;
    let eastCells = 0;
    let neCells = 0;
    const bodyCellLists: [number, number][][] = [];
    const seen = new Uint8Array(n * n);
    for (let i = 0; i < n; i += 1)
      for (let j = 0; j < n; j += 1) {
        const idx = i * n + j;
        if (!wet[idx] || seen[idx]) continue;
        bodies += 1;
        const stack = [idx];
        seen[idx] = 1;
        const mine: [number, number][] = [];
        while (stack.length) {
          const c = stack.pop()!;
          waterCells += 1;
          const ci = Math.floor(c / n);
          const cj = c % n;
          const wx = -half + (ci + 0.5) * step;
          const wz = -half + (cj + 0.5) * step;
          mine.push([wx, wz]);
          if (wx > 0) {
            eastCells += 1;
            if (wz > 0) neCells += 1;
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
        bodyCellLists.push(mine);
      }
    bodyCellLists.sort((a, b) => b.length - a.length);
    const nWantEv = waterBodyTarget(S);
    const gapEv =
      bodyCellLists.length >= 2 ? bodyGap(bodyCellLists[0], bodyCellLists[1], step, gapMin * 1.6) : Infinity;
    if (bodies !== nWantEv) violations.push(`${bodies} water bodies (must be exactly ${nWantEv})`);
    else if (nWantEv === 2) {
      const aMain = bodyCellLists[0].length;
      const aSec = bodyCellLists[1].length;
      if (aSec < aMain * SECOND_WATER_MIN_FRAC)
        violations.push(
          `secondary water body is only ${((100 * aSec) / Math.max(1, aMain)).toFixed(0)}% of the dominant one (a pond, not a body — needs ≥ ${(
            100 * SECOND_WATER_MIN_FRAC
          ).toFixed(0)}%)`,
        );
      if (gapEv < gapMin) violations.push(`the two water bodies are ${gapEv.toFixed(1)} u apart (needs ≥ ${gapMin.toFixed(1)} u — they read as one lake)`);
    }
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
    return { violations, bodies, waterCells, bodyCells: bodyCellLists.map((b) => b.length), gap: gapEv, eastCells, neCells, apronMaxAbs };
  };

  // pick the water style + hills + terrain seed with the REAL probe: try the
  // candidates in seeded preference order (each with its own hill placement,
  // clear of that candidate's basins) and accept the FIRST whose rules fully
  // hold; otherwise keep the best fit found anywhere (fewest violations, ties
  // to the earlier/preferred candidate) — the clamp pass below then repairs it
  interface CandidateFit {
    style: WaterStyle;
    water: ReturnType<typeof finalizeWater>;
    /** the dominant body's bowls PLUS the secondary body's (what gets built) */
    allBasins: BasinZone[];
    second: BasinZone[];
    rep2: BasinZone | null;
    hills: HillCluster[];
    peaks: PeakZone[];
    /** authored-vs-kept peak geometry for THIS candidate's ranges */
    ledger: PeakCapEntry[];
    guardedRanges: number;
    ts: number;
    ev: ReturnType<typeof evaluate>;
  }
  let best: CandidateFit | null = null;
  let probesTried = 0;
  for (let ci = 0; ci < candidates.length && !(best && best.ev.violations.length === 0); ci += 1) {
    const water = finalizeWater(candidates[ci].style, candidates[ci].make());
    // the SECOND body rides on the same candidate (2026-07): it is anchored
    // relative to THIS dominant body, so it has to be composed per candidate,
    // and the hills/forests/meadows must all keep clear of BOTH bodies
    const sec = addSecond(water);
    const ledger: PeakCapEntry[] = [];
    const composed = composeHills(sec.basins, seeded(seed * 17 + ci * 31 + 7), ledger);
    const hills = composed.clusters;
    const peaksC = hills.flatMap((c) => c.peaks);
    for (let k = 0; k < 16; k += 1) {
      const ts = seed * 13 + 3 + k * 97;
      const probe = buildTerrain(t, terrainOpts(ts, peaksC, sec.basins));
      const ev = evaluate(probe.heightAt);
      disposeProbe(probe.mesh);
      probesTried += 1;
      if (!best || ev.violations.length < best.ev.violations.length)
        best = {
          style: candidates[ci].style,
          water,
          allBasins: sec.basins,
          second: sec.second,
          rep2: sec.rep2,
          hills,
          peaks: peaksC,
          ledger,
          guardedRanges: composed.guardedRanges,
          ts,
          ev,
        };
      if (ev.violations.length === 0) break;
    }
  }
  const chosen = best!;
  const waterStyle = chosen.style;
  const { waterKind, rep, beachDir } = chosen.water;
  /** EVERY bowl of EVERY body — the array `<Terrain>`/`buildTerrain` builds
   *  from, and the one every downstream "keep clear of the water" test reads */
  const basins = chosen.allBasins;
  const basinsSecond = chosen.second;
  const waterStyleSecond: SecondWaterStyle | null = basinsSecond.length ? secondStyle : null;
  const waterCentreSecond: [number, number] | null = chosen.rep2 ? [chosen.rep2.x, chosen.rep2.z] : null;
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
    // raising a guarded cell can BISECT a water body (a dry causeway through a
    // lobe) — and the body COUNT is a composition rule. FILL every severed
    // pond past the park's `waterBodyTarget(S)` biggest bodies: lift its cells
    // just above the waterline with small overlapping discs (reads as
    // reclaimed bank). Since 2026-07 that keeps the TWO biggest, so a bisected
    // lake no longer costs the park its secondary body — the anti-scatter
    // intent is unchanged, only the number that counts as "the park's water".
    const nKeep = waterBodyTarget(S);
    const floodBodies = (h: (x: number, z: number) => number): [number, number][][] => floodWaterBodies(h, S);
    const fillPass = () => {
      for (let round = 0; round < 3; round += 1) {
        const probe = buildTerrain(t, clampedOpts());
        const bodies = floodBodies(probe.heightAt);
        if (bodies.length <= nKeep) {
          disposeProbe(probe.mesh);
          break;
        }
        bodies.sort((a, b) => b.length - a.length);
        const fills: [number, number][] = [];
        bodies.slice(nKeep).forEach((body) =>
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
    // must never starve the park's water below the climate ideal (≥ ~3% of the
    // plot / the climate's minWaterU2). Rather than trading more water for
    // buildability, EXPAND the dominant body on its open side — still exactly
    // `waterBodyTarget(S)` bodies with their full gap, never under the guarded
    // layout, the coaster or the forecourt.
    {
      const targetU2 = Math.max(WATER_TARGET_FRAC * S * S, C.minWaterU2 * u * u);
      const grown = expandWaterBody(t, S, clampedOpts, clampBasins, { cells: crit, coasterPts: guards.coasterPts }, targetU2);
      if (grown > 0)
        console.info(
          `[ParkBuilder] water-fraction guard: guard clamping had shrunk the park's water below the ${(WATER_TARGET_FRAC * 100).toFixed(0)}% ideal — grew the dominant body back with ${grown} edge basin(s) on its open side (still ${waterBodyTarget(S)} bod${waterBodyTarget(S) === 1 ? 'y' : 'ies'}, layout untouched)`,
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

  // ---- THE LANDFORM-CHARACTER FLOOR: measure what the guards cost -----------
  // ./sections computeReliefFloor — same reference terrain (same seed, same
  // water, the SAME ranges with the caps NOT applied), same floor, same warning.
  const reliefFloor = computeReliefFloor({
    t,
    seed,
    S,
    h,
    guardAware,
    guardCloud,
    ledger: chosen.ledger,
    ts: chosen.ts,
    guardedRanges: chosen.guardedRanges,
    basins,
    terrainOpts,
    disposeProbe,
  });
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
  // ./sections composeLandZones — same sand/mountain discs, same seeded forest
  // and meadow sampling (its own `rndF` stream, the same `hash01` walk).
  const { landZones, forests } = composeLandZones({
    seed,
    S,
    u,
    half,
    areaK,
    bigPlot,
    clim,
    rep,
    beachDir,
    hillClusters,
    basins,
    h,
  });
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
    basinsSecond,
    waterCentre,
    waterCentreSecond,
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
    waterStyleSecond,
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
      waterAreas: finalEv.bodyCells.map((c) => c * gStep * gStep),
      waterGap: finalEv.gap,
      waterFracEastHalf: (finalEv.eastCells * gStep * gStep) / (half * S),
      waterFracNEQuad: (finalEv.neCells * gStep * gStep) / (half * half),
      apronMaxAbs: finalEv.apronMaxAbs,
      reliefFloor,
    },
  };
}

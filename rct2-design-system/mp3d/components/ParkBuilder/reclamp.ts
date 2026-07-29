// ---------------------------------------------------------------------------
// ParkBuilder/reclamp.ts — reclampTerrain, the AUTO-keepDry safeguard <Park>
// runs over EVERY registered footprint once its children have mounted.
//
// SPLIT OUT OF composition.ts on 2026-07-26 (module size only); the code is
// unchanged. Re-exported by ../ParkBuilder — import from '../ParkBuilder'.
// ---------------------------------------------------------------------------

import * as THREE from 'three';
import { buildTerrain } from '../TerrainKit';
import { WL, CLIMATE_SPECS } from './climate';
import type { ParkFootRect } from './placement';
import {
  CLAMP_BLEND,
  CLAMP_NOISE_MIN,
  WATER_TARGET_FRAC,
  waterBodyTarget,
  floodWaterBodies,
  expandWaterBody,
} from './landform';
import type { ParkComposition } from './landform';

// ---------------------------------------------------------------------------
// reclampTerrain — AUTO-keepDry (round-5 safeguard). Authors' keepDry lists
// are a HINT, not a requirement: after every child has mounted, <Park>
// collects EVERY registered footprint (pads, huts, queue lanes — including
// the derived/trimmed/flipped/auto-shifted ones no static plan could have
// predicted) plus the as-built coaster polylines and re-runs the guard-clamp
// pass over them. Wet cells are raised into dry banks, bulges under rects are
// shaved, severed lobes re-merged/filled (the park's `waterBodyTarget(S)` body
// count stays a rule — TWO on plots ≥ TWO_WATER_MIN_SIZE since 2026-07), the
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
  /** severed water lobes filled back dry (body-count rule) */
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

  // ---- body-COUNT fill pass (raising can bisect the water). Keeps the park's
  // `waterBodyTarget(S)` biggest bodies — TWO since 2026-07 on any plot ≥
  // TWO_WATER_MIN_SIZE — and fills every extra pond back dry. -----------------
  const nKeepR = waterBodyTarget(S);
  for (let round = 0; round < 3; round += 1) {
    const probe = buildTerrain(t, mkOpts());
    const bodies = floodWaterBodies(probe.heightAt, S);
    if (bodies.length <= nKeepR) {
      disposeP(probe.mesh);
      break;
    }
    bodies.sort((a, b) => b.length - a.length);
    const fills: [number, number][] = [];
    bodies.slice(nKeepR).forEach((body) =>
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

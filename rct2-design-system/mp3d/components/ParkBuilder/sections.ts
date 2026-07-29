// ---------------------------------------------------------------------------
// ParkBuilder/sections.ts — the two per-composition TERRAIN-CHARACTER stages:
//
//   computeReliefFloor()  the LANDFORM-CHARACTER FLOOR — how much of the relief
//                         this seed drew survived the caller's guard list
//   composeLandZones()    the terrain SECTIONS (sand / mountain / forest /
//                         meadow discs) a composed park paints and dresses
//
// SPLIT OUT OF composition.ts on 2026-07-26 (module size only). Both were
// straight-line blocks inside `composeParkUncached`; their parameters are
// exactly the values they read from the enclosing scope and their results
// exactly the bindings the rest of the composition went on to use.
// `composeLandZones` still creates its own `rndF` stream and walks `hash01` in
// the same order, so a composition is bit-identical.
// ---------------------------------------------------------------------------

import * as THREE from 'three';
import { buildTerrain } from '../TerrainKit';
import type { PeakZone, BasinZone } from '../TerrainKit';
import { hash01, seeded, clamp } from './climate';
import type { ParkClimate } from './climate';
import { measurePlotRelief, RELIEF_FLOOR_FRAC } from './landform';
import type { HillCluster, PeakCapEntry, ReliefFloorReport, TerrainZone } from './landform';

/** the probe-terrain option factory `composeParkUncached` builds its candidate
 *  heightfields with — passed in so the REFERENCE terrain is built from exactly
 *  the same landform archetype as the composed one */
export type TerrainOptsFn = (ts: number, peaks: PeakZone[], basins: BasinZone[]) => Parameters<typeof buildTerrain>[1];

export interface ReliefFloorOpts {
  t: typeof THREE;
  seed: number;
  S: number;
  /** the COMPOSED terrain's height sampler (guards, caps and clamps included) */
  h: (x: number, z: number) => number;
  guardAware: boolean;
  guardCloud: [number, number][];
  /** authored-vs-kept peak geometry for the chosen candidate's ranges */
  ledger: PeakCapEntry[];
  /** the chosen candidate's terrain-noise seed */
  ts: number;
  guardedRanges: number;
  /** the chosen candidate's water bowls, WITHOUT the clamp discs */
  basins: BasinZone[];
  terrainOpts: TerrainOptsFn;
  disposeProbe: (grp: THREE.Group) => void;
}

export function computeReliefFloor(opts: ReliefFloorOpts): ReliefFloorReport | null {
  const { t, seed, S, h, guardAware, guardCloud, ledger, ts, guardedRanges, basins, terrainOpts, disposeProbe } = opts;
  // ---- THE LANDFORM-CHARACTER FLOOR: measure what the guards cost -----------
  // Same terrain seed, same water, the SAME ranges with the caps NOT applied
  // and no clamp discs — i.e. the character this seed drew before the layout
  // was taken into account. Cheap: probe terrain is seg 2 and `heightAt` is
  // seg-independent. Only on a guarded plot past the classic 48 (nothing below
  // that, and nothing unguarded anywhere, composes differently).
  let reliefFloor: ReliefFloorReport | null = null;
  if (guardAware) {
    const built = measurePlotRelief(h, S);
    const authoredPeaks: PeakZone[] = ledger.map((e) => ({ x: e.x, z: e.z, height: e.authoredH, radius: e.authoredR }));
    const ref = buildTerrain(t, terrainOpts(ts, authoredPeaks, basins));
    const authored = measurePlotRelief(ref.heightAt, S);
    disposeProbe(ref.mesh);
    const keptRelief = authored.relief > 1e-6 ? built.relief / authored.relief : 1;
    const keptStdH = authored.stdH > 1e-6 ? built.stdH / authored.stdH : 1;
    const kept = Math.min(keptRelief, keptStdH);
    // every peak the caps took a quarter or more of, worst loss first, each with
    // the guard cells inside its AUTHORED footprint — the gate names these
    const cappedPeaks = ledger
      .filter((e) => e.authoredH > 0.5 && e.keptH < e.authoredH * 0.75)
      .sort((a, b) => b.authoredH - b.keptH - (a.authoredH - a.keptH))
      .map((e) => ({
        at: [Math.round(e.x * 10) / 10, Math.round(e.z * 10) / 10] as [number, number],
        authoredH: Math.round(e.authoredH * 100) / 100,
        keptH: Math.round(e.keptH * 100) / 100,
        culprits: guardCloud
          .map((c) => ({ c, d: Math.hypot(c[0] - e.x, c[1] - e.z) }))
          .filter((k2) => k2.d <= e.authoredR)
          .sort((a, b) => a.d - b.d)
          .slice(0, 6)
          .map((k2) => k2.c),
      }));
    reliefFloor = {
      relief: built.relief,
      stdH: built.stdH,
      authoredRelief: authored.relief,
      authoredStdH: authored.stdH,
      kept,
      keptRelief,
      keptStdH,
      floor: RELIEF_FLOOR_FRAC,
      ok: kept >= RELIEF_FLOOR_FRAC,
      guardedRanges: guardedRanges,
      cappedPeaks,
    };
    if (!reliefFloor.ok)
      console.warn(
        `[ParkBuilder] landform-character floor MISSED for seed ${seed}: your guard list flattened the composition to relief ${built.relief.toFixed(
          2,
        )} / stdH ${built.stdH.toFixed(2)} against the seed's own uncapped ${authored.relief.toFixed(2)} / ${authored.stdH.toFixed(2)} — ${(
          100 * kept
        ).toFixed(0)}% of its character kept, floor ${(100 * RELIEF_FLOOR_FRAC).toFixed(0)}%. ${
          cappedPeaks.length
            ? `The peaks the guards cost the most: ${cappedPeaks
                .slice(0, 3)
                .map((p) => `(${p.at[0]}, ${p.at[1]}) h ${p.authoredH}→${p.keptH}${p.culprits.length ? ` [guard cell ${JSON.stringify(p.culprits[0])}]` : ''}`)
                .join(', ')}. `
            : ''
        }Guard TIGHTLY (only the cells you really pave/place on), keep guards off the ranges the seed drew — probe UNGUARDED first — and prefer \`noDress\` where you only need bare ground rather than flat ground (rules/park-generation-composition.md §1)`,
      );
  }
  return reliefFloor;
}

export interface LandZonesOpts {
  seed: number;
  S: number;
  u: number;
  half: number;
  areaK: number;
  bigPlot: boolean;
  clim: ParkClimate;
  /** the dominant water body's representative bowl */
  rep: { x: number; z: number; radius: number };
  beachDir: [number, number];
  hillClusters: HillCluster[];
  /** every bowl of every body */
  basins: BasinZone[];
  /** the composed terrain's height sampler */
  h: (x: number, z: number) => number;
}

export function composeLandZones(opts: LandZonesOpts): { landZones: TerrainZone[]; forests: TerrainZone[] } {
  const { seed, S, u, half, areaK, bigPlot, clim, rep, beachDir, hillClusters, basins, h } = opts;
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
  return { landZones, forests };
}

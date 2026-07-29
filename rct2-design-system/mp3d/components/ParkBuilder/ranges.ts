// ---------------------------------------------------------------------------
// ParkBuilder/ranges.ts — MOUNTAIN-RANGE composition: the seeded range
// archetype (alpine / rolling / sentinel / twin), its per-style range specs,
// the jittered anchor-slot ring and the guard-aware placement walk that turns
// them into hill clusters.
//
// SPLIT OUT OF composition.ts on 2026-07-26 (module size only). This was a
// block of closures inside `composeParkUncached`; it is now a factory whose
// parameters are exactly the values that block read from its enclosing scope
// and whose result is exactly the four bindings the rest of the composition
// went on to use. Both RNG streams (`rndM`, `rndS`) are still created and
// drawn from HERE, in the same order, so a composition is bit-identical.
// ---------------------------------------------------------------------------

import { seeded, clamp } from './climate';
import type { ParkClimate } from './climate';
import type { PeakZone, BasinZone } from '../TerrainKit';
import { capPeakForCells, capPeakForCoaster, GUARD_SLOT_K } from './landform';
import type { HillCluster, MountainStyle, PeakCapEntry } from './landform';

export interface RangeComposerOpts {
  seed: number;
  /** plot edge, world units */
  S: number;
  /** composition unit (S / 16) */
  u: number;
  half: number;
  /** plot area relative to the classic 48 */
  areaK: number;
  clim: ParkClimate;
  /** the climate spec's `hillBoost` */
  hillBoost: number;
  /** the caller's keepDry cells */
  keep: [number, number][];
  /** the planned track polyline, when there is one */
  coasterPts?: [number, number, number][];
}

export interface RangeComposer {
  mountainStyle: MountainStyle;
  /** every cell the caller will pave/place on, plus the track's XZ polyline */
  guardCloud: [number, number][];
  /** is the guard-aware placement phase active on this plot? */
  guardAware: boolean;
  /** place this seed's ranges clear of a candidate's water and of each other */
  composeHills: (
    basinsC: BasinZone[],
    rndP: () => number,
    ledger: PeakCapEntry[],
  ) => { clusters: HillCluster[]; guardedRanges: number };
}

export function makeRangeComposer(opts: RangeComposerOpts): RangeComposer {
  const { seed, S, u, half, areaK, clim, hillBoost, keep, coasterPts } = opts;
  // ---- mountain RANGES: a seeded archetype on edge/corner slots --------------
  const rndM = seeded(seed * 7 + 41);
  const styleRollM = rndM();
  let mountainStyle: MountainStyle;
  if (clim === 'alpine') mountainStyle = styleRollM < 0.5 ? 'alpine' : styleRollM < 0.72 ? 'twin' : styleRollM < 0.92 ? 'rolling' : 'sentinel';
  else if (clim === 'desert') mountainStyle = styleRollM < 0.42 ? 'sentinel' : styleRollM < 0.72 ? 'twin' : styleRollM < 0.92 ? 'rolling' : 'alpine';
  else mountainStyle = styleRollM < 0.26 ? 'alpine' : styleRollM < 0.56 ? 'rolling' : styleRollM < 0.78 ? 'twin' : 'sentinel';
  // drama scales with the plot: a 48-park earns real ranges, a 16-park gets
  // proportionally scaled hills — never a cramped mountain wall. Past the
  // classic 48 the summits climb further (2026-07): the old cap of 1.6 was
  // reached at S ≈ 62 and never moved again, so a 128-u plot carried the same
  // 4-7 u peaks a 62-u plot did — over twice the ground, which is why the
  // horizon read as low swells. `capPeakForCells`/`capPeakForCoaster` still
  // shave any peak that would reach the layout or the apron, so the extra
  // height lands only where nothing is built. ≤48 is unchanged exactly.
  const hScale = clamp(0.55 + 0.85 * (S / 48), 0.7, 1.6) * (S > 48 ? 1 + 0.6 * clamp((S - 48) / 80, 0, 1) : 1);
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
    specs.push({ n: 4 + Math.floor(rndM() * 2.999), h: 2.7 + rndM() * 1.6 + hillBoost, r: (1.75 + rndM() * 0.5) * uH, spread: 1.8 * uH });
    if (rndM() < 0.6) specs.push({ n: 2, h: 1.0 + rndM() * 0.5, r: (1.6 + rndM() * 0.4) * uH, spread: 1.1 * uH });
  } else if (mountainStyle === 'rolling') {
    const nR = 2 + Math.floor(rndM() * 2.999);
    for (let i = 0; i < nR; i += 1) specs.push({ n: 2 + Math.floor(rndM() * 1.999), h: 0.75 + rndM() * 0.6, r: (2.5 + rndM()) * uH, spread: 1.6 * uH });
  } else if (mountainStyle === 'sentinel') {
    specs.push({ n: 1 + Math.floor(rndM() * 1.999), h: 2.9 + rndM() * 1.5 + hillBoost, r: (1.45 + rndM() * 0.5) * uH, spread: 1.0 * uH });
    if (rndM() < 0.45) specs.push({ n: 2, h: 0.7 + rndM() * 0.4, r: (1.9 + rndM() * 0.5) * uH, spread: 1.3 * uH });
  } else {
    const nR = 2 + (rndM() < 0.3 ? 1 : 0);
    for (let i = 0; i < nR; i += 1) specs.push({ n: 2 + Math.floor(rndM() * 2.999), h: 1.5 + rndM() * 0.9 + hillBoost * 0.7, r: (1.9 + rndM() * 0.6) * uH, spread: 1.4 * uH });
  }
  // BIG-LAND BONUS RANGES: an expansive plot supports more ranges without
  // crowding the build fields — ONE extra on the classic 48 (2-5 hill clusters
  // total, unchanged), scaling with plot AREA above it so a much bigger park is
  // not one lonely ridge in an empty field. 2026-07 raises the slope 1.7× (the
  // `areaK − 1` form keeps 48 at exactly ONE extra): a 128 plot now queues 11
  // bonus specs instead of 7. Not all of them get placed — `composeHills`
  // stops at the first spec with no slot clear of the water and the earlier
  // ranges — so this is a CEILING on ambition, not a guaranteed count.
  const bonusRanges = S >= 40 ? clamp(1 + Math.round((areaK - 1) * 1.7), 1, 14) : 0;
  for (let i = 0; i < bonusRanges; i += 1)
    specs.push({ n: 2 + Math.floor(rndM() * 1.999), h: 0.8 + rndM() * 0.55 + hillBoost * 0.4, r: (2.2 + rndM() * 0.8) * uH, spread: 1.5 * uH });
  // candidate anchor slots (fractions of half). The classic 7 fixed slots (back
  // edge / side flanks / front corners) meant every park's hills sat in the
  // same seven places; slots are now a SEEDED jittered ring whose count scales
  // with the plot, so range positions differ per seed and a big plot has
  // somewhere to put its extra ranges. The forecourt is always excluded (the
  // apron caps guarantee it stays flat anyway).
  const SLOTS: [number, number][] = [];
  {
    const rndS = seeded(seed * 31 + 13);
    // slot count must stay AHEAD of the spec count or the last bonus ranges have
    // nowhere to go (placement walks the slots once, never revisiting) — 1.45×
    // past the classic 48, which keeps a 48 park's 7 slots exactly
    const nSlots = Math.max(7, Math.round(7 * Math.sqrt(Math.max(1, areaK)) * (S > 48 ? 1.45 : 1)));
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
  // ---- GUARD-AWARE RANGE PLACEMENT (2026-07-25 landform-character floor) ----
  // The guard CLOUD: every cell the caller will pave or place on, plus the
  // planned track's XZ polyline (`capPeakForCoaster` erases a summit exactly as
  // `capPeakForCells` does). A range slot is preferred when its whole reach
  // stands clear of this cloud — see the floor block at the top of this file.
  const guardCloud: [number, number][] = [...keep, ...(coasterPts ?? []).map(([gx, , gz]) => [gx, gz] as [number, number])];
  /** only past the classic 48, and only when there IS a layout to avoid, so
   *  every ≤48 park and every unguarded composition is bit-identical */
  const guardAware = S > 48 && guardCloud.length > 0;
  const slotGuardClear = (cx0: number, cz0: number, rangeR: number) =>
    !guardCloud.some(([gx, gz]) => Math.hypot(cx0 - gx, cz0 - gz) < rangeR * GUARD_SLOT_K);
  const mkRange = (ccx: number, ccz: number, spec: RangeSpec, rndP: () => number, out: HillCluster[], ledger: PeakCapEntry[]) => {
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
      // AUTHORED geometry, recorded BEFORE the caps run: the landform-character
      // floor is `built relief / this relief`, and a peak the guards erased can
      // only be reported by name if we kept what it was supposed to be.
      const authoredH = p.height;
      const authoredR = p.radius;
      if (coasterPts) capPeakForCoaster(p, coasterPts);
      capPeakForCells(p, keep, 0.35); // ranges stay clear of the layout
      capPeakForCells(p, apronCells, 0.22); // and can never bury the forecourt
      ledger.push({ x: p.x, z: p.z, authoredH, authoredR, keptH: p.height, keptR: p.radius });
      peaksR.push(p);
    }
    out.push({ x: ccx, z: ccz, radius: spec.r + (spec.spread * (spec.n - 1)) / 2, peaks: peaksR });
  };
  // place each range on the first slot clear of the water + earlier ranges
  // (per water candidate — ranges never fight the candidate's basins) AND, past
  // the classic 48 with a guard list, clear of the caller's layout: PHASE 0
  // requires `slotGuardClear`, PHASE 1 is the pre-2026-07-25 walk and only runs
  // when phase 0 found the spec no slot at all — so guard-awareness can never
  // COST a park a range, it can only move one.
  const composeHills = (basinsC: BasinZone[], rndP: () => number, ledger: PeakCapEntry[]): { clusters: HillCluster[]; guardedRanges: number } => {
    const out: HillCluster[] = [];
    let guardedRanges = 0;
    let sIdx = 0;
    for (const spec of specs) {
      let placedR = false;
      /** did the guard filter — and ONLY the guard filter — turn a slot down?
       *  Phase 1 exists solely to undo that, so a composition in which
       *  guard-awareness never fired walks the slots exactly once, exactly as
       *  before 2026-07-25. */
      let guardSkipped = false;
      for (let phase = 0; phase < 2 && !placedR; phase += 1) {
        if (phase === 1) {
          if (!guardSkipped) break; // nothing to undo — the slots are genuinely full
          sIdx = 0; // re-walk, guard filter off: never LOSE a range to it
        }
        for (; sIdx < slotOrder.length && !placedR; sIdx += 1) {
          const [fx, fz] = SLOTS[slotOrder[sIdx]];
          const cx0 = fx * half + (rndP() - 0.5) * 0.16 * half;
          const cz0 = fz * half + (rndP() - 0.5) * 0.12 * half;
          const rangeR = spec.r + (spec.spread * (spec.n - 1)) / 2;
          const clearWater = basinsC.every((b) => Math.hypot(cx0 - b.x, cz0 - b.z) > 0.74 * b.radius + rangeR * 0.5);
          const clearRanges = out.every((c) => Math.hypot(cx0 - c.x, cz0 - c.z) > (c.radius + rangeR) * 0.55);
          if (!clearWater || !clearRanges) continue;
          if (phase === 0 && guardAware && !slotGuardClear(cx0, cz0, rangeR)) {
            guardSkipped = true;
            continue;
          }
          if (phase === 1) guardedRanges += 1;
          mkRange(cx0, cz0, spec, rndP, out, ledger);
          placedR = true;
        }
      }
      if (!placedR) break; // no free ground left — fewer ranges this seed
    }
    if (out.length === 0) {
      // guaranteed landmark: a small back knoll on the water's dry side
      mkRange((basinsC[0].x > 0 ? -1 : 1) * 0.45 * half, -0.55 * half, { n: 2, h: 1.2, r: 1.9 * uH, spread: 1.2 * uH }, rndP, out, ledger);
    }
    return { clusters: out, guardedRanges };
  };
  return { mountainStyle, guardCloud, guardAware, composeHills };
}

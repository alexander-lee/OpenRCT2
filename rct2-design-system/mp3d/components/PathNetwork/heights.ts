// ---------------------------------------------------------------------------
// PathNetwork / heights.ts — the PATH HEIGHT SOLVE ("the street follows the
// land"). Split out of ./index.tsx for FILE SIZE ONLY — Magic Patterns writes WHOLE
// files and this network no longer fits a single write. index.tsx re-exports
// every public name, so `from '../PathNetwork'` is unchanged.
// ---------------------------------------------------------------------------

import { PathNode } from './core';

// ---------------------------------------------------------------------------
// PATH HEIGHT SOLVE — "the street follows the land" (RCT2 fidelity)
// ---------------------------------------------------------------------------
// RCT2 never lays a path at ONE level over rolling ground. A footpath element
// takes its base Z from the SURFACE element under its own tile: flat where the
// land is flat, a single-step slope where the land slopes along the path, and
// otherwise RAISED one level and stood on supports —
// `Footpath.cpp:109-115 kDefaultPathSlope[]` maps every land-slope
// configuration to exactly one of { flat, sloped(dir), raise, irregular }, and
// `Paint.Path.cpp:665-693 ShouldDrawSupports()` draws support columns whenever
// the surface base is BELOW the path (or its slope does not match). The one
// thing that never happens is the path sinking INTO the land.
//
// This solver is that rule for a continuous heightfield. Given the street
// lattice and `groundAt`, it returns a per-node surface height that is:
//
//   (a) never below the ground it crosses — sampled across the FULL CORRIDOR
//       WIDTH, not just the centreline. A slab that is level across its width
//       buries its uphill KERB on a side-slope long before its centre touches;
//       measured on the sample corpus that lateral case was the single biggest
//       source of clipping (worlds-ref: 0.43 u buried, 31% of samples);
//   (b) inside the walkable grade on every span (RCT2: one 0.5 height step per
//       1.2 tile), so a run between two nodes of differing height RAMPS along
//       its length instead of stepping at a node;
//   (c) the POINTWISE LOWEST surface satisfying (a) and (b) — the raise pass
//       finds a feasible surface, the settle pass then lowers every node as far
//       as its own constraints allow, so nothing floats higher than the grade
//       rule forces it to. Whatever float is left is real: it gets an earth
//       berm (`bermNetToGround`) or, past SCAFFOLD_LIFT, wooden supports.

export interface PathHeightOpts {
  /** finished surface height above the corridor ground (default 0.03 — the
   *  slab's own 0.09 thickness then puts the walked top 0.12 proud) */
  clearance?: number;
  /** max |rise| per unit of run (default 0.5 / 1.2 — the RCT2 sloped path) */
  maxGrade?: number;
  /** corridor width sampled for the ground maximum (default 1.1) */
  width?: number;
  /** longitudinal sample pitch along a span (default 0.15 — finer than the
   *  harness clip probe's own pitch, so the probe cannot find a hump the
   *  solver never looked at) */
  step?: number;
  /** per-node FLOOR — an authored `[x, z, elevation]` deck is never lowered */
  floor?: number[];
}

export interface PathHeightSolution {
  /** solved surface height per node */
  h: number[];
  /** the corridor-ground target each node was solved against */
  target: number[];
  /** worst |h − target| left over (how far the grade rule forced a node up) */
  maxLift: number;
  /** did the relaxation reach a fixed point? */
  converged: boolean;
}

/** how far above its own CENTRELINE ground the corridor rule may lift a path
 *  to clear the uphill side of a cross-slope. Without a cap, a street running
 *  along the foot of a steep bank takes the bank's height as its target and
 *  the grade rule then propagates that a dozen tiles in both directions —
 *  measured on district-ref, a 1.1 u causeway over flat ground. Past the cap
 *  the OUTERMOST sliver of the slab tucks into the bank instead, which is what
 *  a path cut into a hillside looks like anyway. */
export const CROSS_SLOPE_CAP = 0.3;
/** the corridor is cleared out to this fraction of the slab's half-width; the
 *  last ~20% of the kerb is allowed to bury on a steep side-slope */
export const CORRIDOR_REACH = 0.8;

/** the MAX ground across the corridor cross-section at `[x, z]` — the RCT2
 *  "highest corner of the tile under the path" rule for a continuous field,
 *  capped by CROSS_SLOPE_CAP so a bank beside the road cannot hoist it */
export const corridorGround = (
  groundAt: (x: number, z: number) => number,
  x: number,
  z: number,
  nx: number,
  nz: number,
  half: number,
): number => {
  const c = groundAt(x, z);
  let g = c;
  const reach = half * CORRIDOR_REACH;
  for (const k of [-1, -0.5, 0.5, 1]) {
    const gk = groundAt(x + nx * reach * k, z + nz * reach * k);
    if (gk > g) g = gk;
  }
  return Math.min(g, c + CROSS_SLOPE_CAP);
};

/**
 * Solve the per-node path surface for a lattice over `groundAt` — see the
 * block comment above. Pure arithmetic: no THREE, no scene, so the validator
 * and the harness probe can run it too.
 */
export function solvePathHeights(
  nodes: [number, number][],
  edges: [number, number][],
  groundAt: (x: number, z: number) => number,
  opts: PathHeightOpts = {},
): PathHeightSolution {
  const CL = opts.clearance ?? 0.03;
  const G = opts.maxGrade ?? 0.5 / 1.2;
  const half = (opts.width ?? 1.1) / 2;
  const step = opts.step ?? 0.15;
  const floor = opts.floor;
  const n = nodes.length;
  // node targets: the corridor ground at the node, across every incident
  // direction (a junction is walked in all of them)
  const target = nodes.map(([x, z], ni) => {
    const c = groundAt(x, z);
    let g = c;
    const reach = half * CORRIDOR_REACH;
    for (const k of [-1, 1])
      for (const [dx, dz] of [
        [1, 0],
        [0, 1],
      ])
        g = Math.max(g, groundAt(x + dx * reach * k, z + dz * reach * k));
    void ni;
    return Math.min(g, c + CROSS_SLOPE_CAP) + CL;
  });
  // mid-span corridor targets, precomputed once (groundAt is the expensive bit)
  const spans = edges.map(([a, b]) => {
    const A = nodes[a];
    const B = nodes[b];
    if (!A || !B) return { a, b, cap: Infinity, pts: [] as { u: number; t: number }[] };
    const dx = B[0] - A[0];
    const dz = B[1] - A[1];
    const len = Math.hypot(dx, dz);
    if (!(len > 1e-6)) return { a, b, cap: Infinity, pts: [] as { u: number; t: number }[] };
    const nx = -dz / len;
    const nz = dx / len;
    const steps = Math.max(1, Math.ceil(len / step));
    const pts: { u: number; t: number }[] = [];
    for (let k = 1; k < steps; k += 1) {
      const u = k / steps;
      pts.push({ u, t: corridorGround(groundAt, A[0] + dx * u, A[1] + dz * u, nx, nz, half) + CL });
    }
    return { a, b, cap: G * len, pts };
  });
  const h = target.map((v, i) => Math.max(v, floor?.[i] ?? -Infinity));
  // ---- RAISE to feasibility (monotone up ⇒ always converges) ---------------
  let converged = false;
  for (let it = 0; it < 400 && !converged; it += 1) {
    let moved = 0;
    // alternate sweep direction so a long chain propagates from both ends
    const order = it % 2 ? spans.map((_, i) => spans.length - 1 - i) : spans.map((_, i) => i);
    for (const si of order) {
      const s = spans[si];
      if (!Number.isFinite(s.cap)) continue;
      const d = h[s.b] - h[s.a];
      if (d > s.cap) {
        moved = Math.max(moved, d - s.cap);
        h[s.a] = h[s.b] - s.cap;
      } else if (-d > s.cap) {
        moved = Math.max(moved, -d - s.cap);
        h[s.b] = h[s.a] - s.cap;
      }
      for (const p of s.pts) {
        const def = p.t - (h[s.a] + (h[s.b] - h[s.a]) * p.u);
        if (def > 1e-4) {
          // least-squares split: the smallest pair of raises that lifts the
          // interpolated surface at `u` by exactly `def`
          const w = 1 / ((1 - p.u) * (1 - p.u) + p.u * p.u);
          h[s.a] += def * (1 - p.u) * w;
          h[s.b] += def * p.u * w;
          moved = Math.max(moved, def);
        }
      }
    }
    if (moved <= 1e-4) converged = true;
  }
  // ---- SETTLE back down to the pointwise minimum ---------------------------
  // Gauss-Seidel descent: each node drops to the highest of its own floors —
  // its corridor target, the grade limit against every neighbour, and every
  // mid-span sample on its incident edges given the neighbour's current
  // height. Monotone down from a feasible point, so it stays feasible.
  const incident: number[][] = nodes.map(() => []);
  spans.forEach((s, si) => {
    if (!Number.isFinite(s.cap)) return;
    incident[s.a]?.push(si);
    incident[s.b]?.push(si);
  });
  for (let it = 0; it < 60; it += 1) {
    let dropped = 0;
    for (let i = 0; i < n; i += 1) {
      let lo = Math.max(target[i], floor?.[i] ?? -Infinity);
      for (const si of incident[i]) {
        const s = spans[si];
        const j = s.a === i ? s.b : s.a;
        const mine = s.a === i; // is this node the span's `a` end?
        if (h[j] - s.cap > lo) lo = h[j] - s.cap;
        for (const p of s.pts) {
          const w = mine ? 1 - p.u : p.u; // this end's weight in the lerp
          if (w < 1e-6) continue;
          const need = (p.t - (1 - w) * h[j]) / w;
          if (need > lo) lo = need;
        }
      }
      if (h[i] - lo > 1e-5) {
        dropped = Math.max(dropped, h[i] - lo);
        h[i] = lo;
      }
    }
    if (dropped <= 1e-5) break;
  }
  let maxLift = 0;
  for (let i = 0; i < n; i += 1) maxLift = Math.max(maxLift, h[i] - target[i]);
  return { h, target, maxLift, converged };
}


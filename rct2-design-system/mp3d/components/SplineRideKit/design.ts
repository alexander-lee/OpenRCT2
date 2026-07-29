// ---------------------------------------------------------------------------
// SplineRideKit / design.ts — DESIGN RULES + RAMP GEOMETRY.
// Split out of ./index.tsx purely for file size (Magic Patterns writes whole
// files; the kit no longer fits one call). Nothing here changed: index.tsx
// re-exports the public names, so `import { checkCoasterDesign } from
// '../SplineRideKit'` keeps working. This module is the kit's LEAF — it
// imports nothing from its siblings.
// ---------------------------------------------------------------------------

import * as THREE from 'three';
import {
  computeSplineFrames,
  detectLiftHill,
  SplineFrame,
  SplineFrames,
} from '../SplineCoaster';

/** Ride flavours the kit can build. Lives here so pieces.ts can name it too. */
export type RideProfile = 'coaster' | 'flume' | 'bobsled' | 'rapids' | 'gokart';

export const GRAV = 9.8;

// deterministic per-index jitter (no Math.random anywhere in this kit)
const fract = (x: number) => x - Math.floor(x);
export const hashN = (n: number) => fract(Math.sin(n * 127.1 + 311.7) * 43758.5453);

export interface SplineValidation {
  ok: boolean;
  /** smallest 3D distance found between parameter-distant sample pairs */
  worst: number;
  /** curve parameters [u1, u2] of the worst pair */
  at: [number, number];
}

/**
 * Self-intersection / clearance check for a composed spline: samples the
 * curve (default 240) and, for every pair of samples whose loop-parameter
 * distance exceeds ~0.06 (i.e. genuinely different track sections, not
 * neighbours), requires the 3D distance to exceed `clearance` (default 0.9 —
 * roughly a vehicle envelope). Reports the worst pair either way.
 */
export function validateSpline(
  t: typeof THREE,
  curve: THREE.Curve<THREE.Vector3>,
  opts: { clearance?: number; samples?: number } = {},
): SplineValidation {
  const S = opts.samples ?? 240;
  const clearance = opts.clearance ?? 0.9;
  const closed = (curve as { closed?: boolean }).closed !== false;
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i < S; i++) pts.push(curve.getPointAt(i / S, new t.Vector3()));
  let worst = Infinity;
  let at: [number, number] = [0, 0];
  for (let i = 0; i < S; i++) {
    for (let j = i + 1; j < S; j++) {
      const steps = closed ? Math.min(j - i, S - (j - i)) : j - i;
      if (steps / S <= 0.06) continue; // neighbours along the track — allowed to touch
      const d = pts[i].distanceTo(pts[j]);
      if (d < worst) {
        worst = d;
        at = [i / S, j / S];
      }
    }
  }
  return { ok: worst >= clearance, worst, at };
}

// ---------------------------------------------------------------------------
// RCT2 CONSTRUCTION RULES — per-type track whitelists ported to spline space.
// OpenRCT2 refs: ride/rtd/coaster/WoodenRollerCoaster.h:26,85 (the wooden
// TrackElemType table stops at steep 60° slopes, banks only to ~25° via
// dedicated flat-to-bank transition pieces, and has NO corkscrew/inversion
// groups); Ride.cpp:5648 (an incomplete circuit cannot open); and
// RideRatings.cpp:1318,2215 (stat gates: minimum highest-drop-height and
// minimum length penalise the excitement rating — warnings, not errors).
// ---------------------------------------------------------------------------

export type CoasterType = 'wooden' | 'steel' | 'inverted';

export const DEG = Math.PI / 180;
export const TOL = 5 * DEG; // spline smoothing is allowed to overshoot a piece limit by ~5°
// RCT2 track has FIXED slope steps — flat, 25°, 60° — connected by dedicated
// one-tile TRANSITION pieces (TrackElemType::FlatToUp25, Up25ToUp60, ...);
// there are no arbitrary kinks. One 25° step (0.436 rad) per tile-ish arc
// length (~0.8 units) caps the legal pitch rate at ~0.55 rad/unit.
const PITCH_RATE_MAX = 0.55;

export const TYPE_RULES: Record<CoasterType, { maxSlope: number; maxDrop: number; maxBank: number; inversions: boolean }> = {
  // wooden: slopes stop at the steep-60° pieces, banking ~25°, no inversions
  wooden: { maxSlope: 60 * DEG, maxDrop: 60 * DEG, maxBank: 25 * DEG, inversions: false },
  // steel: vertical (90°) pieces exist, corkscrews/loops allowed, bank to ~55°
  steel: { maxSlope: 90 * DEG, maxDrop: 90 * DEG, maxBank: 55 * DEG, inversions: true },
  // inverted: like steel but the piece table has no steep drops beyond ~75°
  inverted: { maxSlope: 90 * DEG, maxDrop: 75 * DEG, maxBank: 55 * DEG, inversions: true },
};

/**
 * The curvature-banking cap a coaster of `type` may build with: the requested
 * bank (or the kit's 0.7 rad default) SATURATED at the type's bankLimit
 * (wooden 25°, steel/inverted 55°) so auto-banking can never bank a compiled
 * turn past what checkCoasterDesign allows (round-3 safeguard: the 0.7
 * default hit 36-40° on wooden layouts, failing 'bankLimit' at documented
 * archetype params). The design check's ~5° TOL absorbs the residual roll
 * parallel transport adds on top of the cap. Used by compileTrackPieces,
 * buildRideSpline (coaster profile), <Coaster>/<TrackRide> and validatePark.
 */
export function coasterBankCap(type: CoasterType, requested?: number): number {
  const lim = TYPE_RULES[type].maxBank;
  return Math.min(requested ?? 0.7, lim);
}

export type DesignViolationKind =
  | 'slope'
  | 'pitchRate'
  | 'bankRate'
  | 'bankLimit'
  | 'inversion'
  | 'noStation'
  | 'shortDrop'
  | 'shortLength';

export interface DesignViolation {
  kind: DesignViolationKind;
  /** loop parameter u of the worst offending sample */
  at: number;
  detail: string;
  /** stat-gate warnings ('shortDrop'/'shortLength') don't fail the design */
  warning?: boolean;
}

export interface CoasterDesignReport {
  ok: boolean;
  violations: DesignViolation[];
}

/** signed bank angle of a frame vs world-up (0 when side is horizontal) */
export function rollOfFrame(f: SplineFrame): number {
  if (Math.abs(f.fwd.y) > 0.97) return 0; // near-vertical: bank is meaningless
  return Math.atan2(f.side.y, f.up.y);
}

/**
 * THE inversion-element window mask — ONE definition, shared by
 * `checkCoasterDesign`'s slope/pitch/bank sweeps, `replayCoasterForces`'s
 * lateral-G read and `rateCoaster`'s vertical-G / air-time / drop scans.
 *
 * RCT2 inversions (corkscrews, vertical loops) are FIXED multi-tile
 * `TrackElemType`s whose forces come from pre-baked per-element
 * verticalFactor / lateralFactor tables (`Vehicle.cpp:1173-1199`), NOT from
 * the track's measured curvature: the game never derives a lateral G from the
 * geometry of a loop, and the vertical-loop elements carry a lateral factor of
 * zero because a loop is laterally NEUTRAL — everything it does to the rider
 * is along the car's up axis. The kit's stand-ins are real curves, so their
 * raw curvature has to be read the same way: samples within ~2.8 arc-units of
 * an up-vector flip belong to a fixed-geometry element. Outside those windows
 * every sweep and every gate runs exactly as before.
 *
 * THE WINDOW IS ELEMENT-SIZED, NOT A FIXED 2.8. A flat 2.8 assumes every
 * inversion is the size of a corkscrew, and it silently CAPPED the vertical
 * loop: the arc from a loop's level entry to its first inverted sample is
 * ~2.07·R, so any loop past R≈1.35 pushed its own lead-in outside the window
 * and failed the pitchRate sweep — the geometry was legal, the ruler was too
 * short. So 2.8 is kept as the FLOOR (every previously-passing layout scores
 * bit-identically) and the window then grows outward from the flip for as
 * long as the track is still rolled/pitched out of level, which is exactly
 * the extent of the fixed element: every piece in this vocabulary enters and
 * exits LEVEL and UPRIGHT, so `up.y ≥ UPRIGHT` is the element's own boundary.
 * The growth is capped at 6 arc-units either side (R ≤ ~2.9 worth of lead-in)
 * so that a steeply BANKED turn welded straight onto a loop's exit — up.y
 * down to cos 55° = 0.57 on steel, i.e. never "upright" — cannot drag the
 * exemption around the rest of the circuit.
 */
const INVERSION_WINDOW_MIN = 2.8; // legacy floor — corkscrew-sized
const INVERSION_WINDOW_MAX = 6.0; // growth ceiling — see above
const INVERSION_UPRIGHT = 0.985; // up.y at which the element has ended (~10° of tilt)
export function inversionWindow(frames: SplineFrame[], N: number, ds: number): boolean[] {
  const win = Math.max(1, Math.round(INVERSION_WINDOW_MIN / ds));
  const grow = Math.max(win, Math.round(INVERSION_WINDOW_MAX / ds));
  const mask: boolean[] = new Array(N).fill(false);
  for (let i = 0; i < N; i += 1) {
    if (frames[i].up.y >= 0.02) continue;
    mask[i] = true;
    for (const step of [-1, 1]) {
      let ended = false;
      for (let k = 1; k <= grow; k += 1) {
        const j = (i + step * k + N) % N;
        if (frames[j].up.y >= INVERSION_UPRIGHT) ended = true; // back to level+upright: element over
        if (ended && k > win) break;
        mask[j] = true;
      }
    }
  }
  return mask;
}

/**
 * RCT2-faithful design check for a spline coaster. Samples parallel-transport
 * frames (reuse `computeSplineFrames`; pass `opts.frames` to avoid resampling)
 * and reports per-type violations:
 *  - 'slope'      pitch beyond the type's piece table (wooden ≤60°, steel ≤90°,
 *                 inverted drops ≤75°) — WoodenRollerCoaster.h:26,85
 *  - 'pitchRate'  |Δpitch|/Δarc over ~0.55 rad/unit — RCT2 track has FIXED
 *                 slope steps (flat, 25°, 60°) joined by dedicated one-tile
 *                 transition pieces (flat-to-25, 25-to-60...), never arbitrary
 *                 kinks; ~one 25° step per tile-ish arc length is the ceiling
 *  - 'bankRate'   |Δroll|/Δarc over ~0.9 rad/unit — RCT2 banks only through
 *                 gradual flat-to-bank transition pieces
 *  - 'bankLimit'  roll beyond the type max (wooden ~25°, steel ~55°)
 *  - 'inversion'  up-vector flip on a type without inversion pieces
 *  - 'noStation'  no flat straight ≥ 2.2 units in the lowest quarter of the
 *                 layout — Ride.cpp:5648: no complete station, cannot open
 * plus stat-gate WARNINGS (RideRatings.cpp:1318,2215):
 *  - 'shortDrop'  first drop right after the lift crest under ~0.9 units
 *  - 'shortLength' total circuit under ~10 units
 */
export function checkCoasterDesign(
  ...args:
    | [t: typeof THREE, curve: THREE.CatmullRomCurve3 | [number, number, number][], opts?: { type?: CoasterType; frames?: SplineFrames; bank?: number }]
    | [curve: THREE.CatmullRomCurve3 | [number, number, number][], opts?: { type?: CoasterType; frames?: SplineFrames; bank?: number }]
): CoasterDesignReport {
  // ---- THE LEADING `t` IS OPTIONAL (2026-07-28) ---------------------------
  // Its two siblings do NOT take a three namespace — `compileTrackPieces` and
  // `rateCoaster` both open with `const t = THREE;` — so a caller who has just
  // written those two naturally writes `checkCoasterDesign(points, { type })`
  // and passes the POINT ARRAY where `t` was expected. The failure is
  // `Uncaught TypeError: t.CatmullRomCurve3 is not a constructor`, thrown at
  // module scope, which blanks the whole park.
  //
  // MEASURED 2026-07-28: both bare-prompt generations died exactly this way,
  // following a published snippet that had the same slip. An API where one of
  // three neighbours needs an extra first argument is a trap, so both call
  // shapes are now accepted and the namespace defaults to the bundle's own.
  const first: unknown = args[0];
  const hasNs = !!first && typeof first === 'object' && !Array.isArray(first)
    && typeof (first as { CatmullRomCurve3?: unknown }).CatmullRomCurve3 === 'function';
  const t: typeof THREE = hasNs ? (args[0] as typeof THREE) : THREE;
  const curve = (hasNs ? args[1] : args[0]) as THREE.CatmullRomCurve3 | [number, number, number][];
  const opts = ((hasNs ? args[2] : args[1]) ?? {}) as { type?: CoasterType; frames?: SplineFrames; bank?: number };
  const type = opts.type ?? 'steel';
  const rules = TYPE_RULES[type];
  const fb =
    opts.frames ??
    computeSplineFrames(
      t,
      Array.isArray(curve)
        ? curve
        : (curve.points ?? []).map((p) => [p.x, p.y, p.z] as [number, number, number]),
      { bank: opts.bank },
    );
  const { frames, total, N, P } = fb;
  const ds = total / N;
  const violations: DesignViolation[] = [];

  // ---- per-frame sweeps: pitch, pitch rate, roll, bank rate, up-vector flips ----
  let maxUp = 0, maxUpAt = 0, maxDown = 0, maxDownAt = 0;
  let maxRoll = 0, maxRollAt = 0, maxRate = 0, maxRateAt = 0;
  let maxPitchRate = 0, maxPitchRateAt = 0;
  let minUpY = 1, minUpYAt = 0;
  const rollA: number[] = [];
  const pitchA: number[] = [];
  for (let i = 0; i < N; i++) {
    rollA.push(rollOfFrame(frames[i]));
    pitchA.push(Math.asin(Math.max(-1, Math.min(1, frames[i].fwd.y))));
  }
  // pitch-rate is measured over ONE TILE of arc (1.2 units), matching RCT2's
  // grammar: slope may step one grade per tile-long transition piece. A smooth
  // spline's instantaneous curvature legitimately exceeds the per-tile rate
  // locally, so frame-to-frame deltas would over-reject compact layouts.
  const TILE = 1.2;
  const pitchWin = Math.max(1, Math.round(TILE / ds));
  // Inversion-element windows: RCT2 corkscrews/loops are FIXED multi-tile
  // elements (TrackElemType::LeftCorkscrewUp...), not banked track assembled
  // from bank-transition pieces — their geometry rolls through 180°+ by
  // definition. For types whose piece table HAS inversions, samples within
  // ~2.8 units of arc of an up-vector flip belong to such an element and are
  // exempt from the slope/pitch/bank sweeps (types WITHOUT inversion pieces
  // still fail the 'inversion' check below, so nothing slips through).
  const exempt: boolean[] = rules.inversions ? inversionWindow(frames, N, ds) : new Array(N).fill(false);
  for (let i = 0; i < N; i++) {
    if (frames[i].up.y < minUpY) { minUpY = frames[i].up.y; minUpYAt = i / N; }
    if (exempt[i]) continue; // inside an inversion element — fixed geometry
    const pitch = pitchA[i];
    if (pitch > maxUp) { maxUp = pitch; maxUpAt = i / N; }
    if (-pitch > maxDown) { maxDown = -pitch; maxDownAt = i / N; }
    if (!exempt[(i + pitchWin) % N]) {
      const pRate = Math.abs(pitchA[(i + pitchWin) % N] - pitchA[i]) / (pitchWin * ds);
      if (pRate > maxPitchRate) { maxPitchRate = pRate; maxPitchRateAt = i / N; }
    }
    const r = Math.abs(rollA[i]);
    if (r > maxRoll) { maxRoll = r; maxRollAt = i / N; }
    if (!exempt[(i + 1) % N]) {
      let dr = rollA[(i + 1) % N] - rollA[i];
      if (dr > Math.PI) dr -= 2 * Math.PI;
      if (dr < -Math.PI) dr += 2 * Math.PI;
      const rate = Math.abs(dr) / ds;
      if (rate > maxRate) { maxRate = rate; maxRateAt = i / N; }
    }
  }
  const deg = (r: number) => (r / DEG).toFixed(0);
  if (maxUp > rules.maxSlope + TOL)
    violations.push({ kind: 'slope', at: maxUpAt, detail: `${deg(maxUp)}° climb exceeds the ${type} limit of ${deg(rules.maxSlope)}°` });
  if (maxDown > rules.maxDrop + TOL)
    violations.push({ kind: 'slope', at: maxDownAt, detail: `${deg(maxDown)}° drop exceeds the ${type} limit of ${deg(rules.maxDrop)}°` });
  if (maxPitchRate > PITCH_RATE_MAX)
    violations.push({ kind: 'pitchRate', at: maxPitchRateAt, detail: `pitch changes at ${maxPitchRate.toFixed(2)} rad/unit — RCT2 slopes step flat→25°→60° through one-tile transition pieces (~${PITCH_RATE_MAX} max)` });
  if (!rules.inversions && minUpY < -0.05)
    violations.push({ kind: 'inversion', at: minUpYAt, detail: `track inverts (up.y=${minUpY.toFixed(2)}) — ${type} coasters have no inversion pieces` });
  if (maxRoll > rules.maxBank + TOL)
    violations.push({ kind: 'bankLimit', at: maxRollAt, detail: `${deg(maxRoll)}° bank exceeds the ${type} limit of ${deg(rules.maxBank)}°` });
  if (maxRate > 0.9)
    violations.push({ kind: 'bankRate', at: maxRateAt, detail: `bank changes at ${maxRate.toFixed(2)} rad/unit — RCT2 banks only via gradual transition pieces (~0.9 max)` });

  // ---- station site: a flat run ≥ 2.2 units in the lowest quarter ----
  // (roll is NOT tested here — the kit auto-banks even gentle low curves)
  let minY = Infinity, maxY = 0;
  for (const p of P) { minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y); }
  const yLow = minY + 0.25 * (maxY - minY) + 0.05;
  const flatAt = (i: number) => Math.abs(frames[i % N].fwd.y) < 0.09 && frames[i % N].p.y <= yLow;
  let best = 0, bestAt = 0, cur = 0;
  for (let i = 0; i < 2 * N; i++) {
    if (flatAt(i)) {
      cur++;
      if (Math.min(cur, N) > best) { best = Math.min(cur, N); bestAt = (i % N) / N; }
    } else cur = 0;
  }
  if (best * ds < 2.2)
    violations.push({ kind: 'noStation', at: bestAt, detail: `longest flat low straight is ${(best * ds).toFixed(2)} units (station needs 2.2) — an incomplete circuit cannot open (Ride.cpp:5648)` });

  // ---- stat gates (warnings): first drop after the lift crest + length ----
  const { imax } = detectLiftHill(P);
  let runMin = P[imax].y;
  for (let s = 1; s < N; s++) {
    const y = P[(imax + s) % N].y;
    if (y < runMin) runMin = y;
    else if (y > runMin + 0.08) break; // drop bottomed out
  }
  const firstDrop = P[imax].y - runMin;
  if (firstDrop < 0.9)
    violations.push({ kind: 'shortDrop', at: imax / N, detail: `first drop after the lift is only ${firstDrop.toFixed(2)} units — low excitement stat gate (RideRatings.cpp:1318)`, warning: true });
  if (total < 10)
    violations.push({ kind: 'shortLength', at: 0, detail: `circuit is only ${total.toFixed(1)} units long — short-ride stat gate (RideRatings.cpp:2215)`, warning: true });

  return { ok: !violations.some((v) => !v.warning), violations };
}

export interface RampPointsOpts {
  /** horizontal run of the ramp in world units (auto-extended when the rise
   *  would need a gradient past 60° or a transition too abrupt to be legal) */
  run: number;
  /** total elevation change over the ramp; negative for a drop */
  rise: number;
  /** number of control points emitted (default ≈ one per 0.8-unit "tile") */
  steps?: number;
}

/**
 * Control points shaped like an RCT2 ramp, ready to splice into a spline
 * layout. RCT2 track climbs in FIXED slope steps — flat, 25°, 60° — joined by
 * dedicated one-tile transition pieces (flat-to-25, 25-to-60, ...), so a
 * legal ramp is: flat lead-in → eased transition (quarter-sine gradient) →
 * constant-gradient middle (capped at 60°) → eased top transition → flat
 * run-out. This helper emits exactly that profile from `from` heading along
 * the horizontal `dir` ([dx, dz], normalised internally): the run is
 * auto-extended when the requested rise would exceed the 60° cap or force a
 * transition steeper than checkCoasterDesign's pitchRate rule allows, so
 * composed layouts pass 'slope' and 'pitchRate' by construction. Pure and
 * deterministic — feed the result (with your other points) to
 * buildRideSpline / computeSplineFrames.
 */
export function rampPoints(
  from: [number, number, number],
  dir: [number, number],
  opts: RampPointsOpts,
): [number, number, number][] {
  const MAX_G = Math.tan(60 * DEG); // steepest RCT2 slope piece: 60°
  const dl = Math.hypot(dir[0], dir[1]) || 1;
  const dx = dir[0] / dl;
  const dz = dir[1] / dl;
  const sign = opts.rise < 0 ? -1 : 1;
  const rise = Math.abs(opts.rise);
  let H = Math.max(1.2, opts.run); // total horizontal run
  // segment lengths (horizontal): flat lead-in/out `a`, quarter-sine gradient
  // transitions `b` (each contributes (2/π)·g·b of rise), constant-gradient
  // middle `mid`. Fixed-point solve: grade g follows from the geometry, the
  // 60° cap stretches `mid`, and the pitch-rate ceiling (max dpitch/darc of a
  // quarter-sine transition = π·g/(2b)) stretches `b`.
  let a = Math.max(0.5, 0.1 * H);
  let b = Math.max(0.8, 0.16 * H);
  let mid = Math.max(0.6, H - 2 * a - 2 * b);
  let g = 0;
  for (let it = 0; it < 8; it++) {
    g = rise / (mid + (4 / Math.PI) * b);
    if (g > MAX_G) {
      mid = rise / MAX_G - (4 / Math.PI) * b; // hold 60°, lengthen the middle
      g = MAX_G;
    }
    const bReq = (Math.PI * g) / (2 * 0.5); // transition start rate ≤ 0.5 rad/unit
    if (bReq > b + 1e-6) b = bReq;
    else break;
  }
  H = Math.max(H, 2 * a + 2 * b + mid);
  a = (H - 2 * b - mid) / 2; // spare run pads the flat lead-in/out evenly
  // piecewise elevation profile y(h), h = horizontal distance along dir
  const yTrans = (g * 2 * b) / Math.PI; // rise across one quarter-sine transition
  const yOf = (h: number): number => {
    if (h <= a) return 0;
    if (h <= a + b) return yTrans * (1 - Math.cos((Math.PI * (h - a)) / (2 * b)));
    if (h <= a + b + mid) return yTrans + g * (h - a - b);
    if (h <= a + 2 * b + mid) return yTrans + g * mid + yTrans * Math.sin((Math.PI * (h - a - b - mid)) / (2 * b));
    return 2 * yTrans + g * mid;
  };
  const steps = Math.max(5, opts.steps ?? Math.round(H / 0.8) + 1);
  const pts: [number, number, number][] = [];
  for (let i = 0; i < steps; i++) {
    const h = (i / (steps - 1)) * H;
    pts.push([from[0] + dx * h, from[1] + sign * yOf(h), from[2] + dz * h]);
  }
  return pts;
}


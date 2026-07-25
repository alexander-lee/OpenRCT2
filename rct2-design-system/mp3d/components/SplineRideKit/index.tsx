import React from 'react';
import * as THREE from 'three';
import { box, cyl, ball, mat } from '../Stage';
import {
  buildSplineCoaster,
  computeSplineFrames,
  detectLiftHill,
  addSplineSupports,
  SplineFrame,
  SplineFrames,
  RunOpts,
} from '../SplineCoaster';
import { buildCoasterCar } from '../CoasterCar';
import { buildPeep, SHIRTS, SKIN_TONES } from '../Guest';
import { TrackScheme, VehicleScheme, rideColourPreset, shade } from '../ColorKit';
import { buildEmitter, Emitter, buildFire, Fire } from '../ParticleKit';
import { composable } from '../Park';

// Compatibility re-export (round-2 safeguard): rideColourPreset LIVES in
// ColorKit — import it from there (`import { rideColourPreset } from
// '../ColorKit'`). Generated parks keep guessing it lives beside
// compileTrackPieces, and one wrong-source import used to fail the whole
// bundle; the shim keeps those parks compiling. RideColourScheme rides along
// for the same reason.
export { rideColourPreset } from '../ColorKit';
export type { RideColourScheme } from '../ColorKit';

// ---------------------------------------------------------------------------
// SplineRideKit — generalises the SplineCoaster workflow into a ride kit: the
// SAME closed Catmull-Rom control points, parallel-transport frames and
// curvature banking now compose COASTERS (delegates to buildSplineCoaster),
// wooden U-channel FLUMES with a water strip, rocky RAPIDS channels, icy
// half-pipe BOBSLED chutes and flat asphalt GOKART circuits. Channel profiles
// are swept as quad-strip ribbons along the frames; supports reuse
// SplineCoaster's ground-aware columns and trestle bents. `run()` paces
// vehicles per profile: energy-paced (fast in valleys, crawl on the lift) for
// coaster/bobsled, near-constant drift for flume/rapids, constant throttle
// for gokarts. validateSpline is the composition guard for clearance;
// checkCoasterDesign ports RCT2's per-type CONSTRUCTION RULES; and the
// coaster/bobsled runners carry RCT2's CRASH PHYSICS — G-force derailment,
// station-brake failure and the ballistic explode-on-impact crash sequence
// (crashTrain). References into the OpenRCT2 source are cited inline.
// ---------------------------------------------------------------------------

const GRAV = 9.8;

// deterministic per-index jitter (no Math.random anywhere in this kit)
const fract = (x: number) => x - Math.floor(x);
const hashN = (n: number) => fract(Math.sin(n * 127.1 + 311.7) * 43758.5453);

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

const DEG = Math.PI / 180;
const TOL = 5 * DEG; // spline smoothing is allowed to overshoot a piece limit by ~5°
// RCT2 track has FIXED slope steps — flat, 25°, 60° — connected by dedicated
// one-tile TRANSITION pieces (TrackElemType::FlatToUp25, Up25ToUp60, ...);
// there are no arbitrary kinks. One 25° step (0.436 rad) per tile-ish arc
// length (~0.8 units) caps the legal pitch rate at ~0.55 rad/unit.
const PITCH_RATE_MAX = 0.55;

const TYPE_RULES: Record<CoasterType, { maxSlope: number; maxDrop: number; maxBank: number; inversions: boolean }> = {
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
function rollOfFrame(f: SplineFrame): number {
  if (Math.abs(f.fwd.y) > 0.97) return 0; // near-vertical: bank is meaningless
  return Math.atan2(f.side.y, f.up.y);
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
  t: typeof THREE,
  curve: THREE.CatmullRomCurve3 | [number, number, number][],
  opts: { type?: CoasterType; frames?: SplineFrames; bank?: number } = {},
): CoasterDesignReport {
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
  const invWin = Math.max(1, Math.round(2.8 / ds));
  const exempt: boolean[] = new Array(N).fill(false);
  if (rules.inversions) {
    for (let i = 0; i < N; i++) {
      if (frames[i].up.y < 0.02) {
        for (let k = -invWin; k <= invWin; k++) exempt[(i + k + N) % N] = true;
      }
    }
  }
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

// ---------------------------------------------------------------------------
// TRACK-PIECE COMPILER — RCT2 authors coasters from a fixed vocabulary of
// track PIECES, never freeform curves. compileTrackPieces walks a heading +
// position cursor through a piece list — a SUPERSET of TrackKit's grid
// vocabulary with smooth-spline semantics: lifts/drops are rampPoints-eased
// climbs that obey the pitchRate rule BY CONSTRUCTION, turns/helixes are
// chorded arcs, corkscrews real inverting barrels — and emits control points
// ready for buildRideSpline / <Coaster> / <TrackRide>. The cursor finishes
// wherever the pieces leave it, so the compiler then CLOSES the circuit
// legally (RCT2 refuses to open an unclosed circuit — Ride.cpp:5648): first
// an eased ramp back to station height along the current heading, then the
// shortest Dubins arc–straight–arc path (turn radius 1.5) onto the start
// point and heading. checkCoasterDesign + validateSpline always run on the
// result; both land in `report`, with closure details and warnings.
// ---------------------------------------------------------------------------

export type TrackPieceType =
  | 'station'   // flat straight that marks boarding (put it FIRST)
  | 'flat'      // alias of 'straight'
  | 'straight'  // level run (length)
  | 'lift'      // eased climb (height, optional length) — rampPoints grammar
  | 'drop'      // eased descent (height defaults to "back to station level")
  | 'hill'      // camelback bump (height, length) — starts and ends level
  | 'turnL' | 'turnR'   // flat arc (angle in degrees, default 90; radius 1.5)
  | 'helixL' | 'helixR' // long arc with an eased elevation change (angle 360, height)
  | 'corkscrewL' | 'corkscrewR' // inverting barrel — STEEL coasters only
  | 'sbend';    // lateral shift, heading preserved (length; radius = offset)

export interface TrackPieceDef {
  type: TrackPieceType;
  /** straight/hill/sbend run; lift/drop horizontal run override */
  length?: number;
  /** lift/drop/hill/helix elevation change (drop default: back to station level) */
  height?: number;
  /** turn/helix radius (default 1.5); sbend lateral offset (default 1.2, +ve left) */
  radius?: number;
  /** turn/helix sweep in DEGREES (turn default 90, helix default 360) */
  angle?: number;
}

/** a piece is its bare name (all defaults) or a parameterised descriptor */
export type TrackPiece = TrackPieceType | TrackPieceDef;

export interface TrackClosure {
  /** true when the synthesized return path lands on the start point+heading */
  closed: boolean;
  /** residual 3D gap to the start after closure (should be ~0) */
  gap: number;
  /** human-readable list of the auto-synthesized closing pieces */
  synthesized: string[];
}

export interface TrackPieceReport {
  /** valid.ok && closure.closed && (coaster profile: design.ok) && !fatal */
  ok: boolean;
  /** RCT2 construction-rule report (informational for water/monorail profiles) */
  design: CoasterDesignReport;
  /** clearance / self-intersection report */
  valid: SplineValidation;
  closure: TrackClosure;
  warnings: string[];
  /** FATAL guard: set when the checks fail, the synthesized closure exceeds
   *  40% of the authored arc length, or (with `opts.bounds`) the track leaves
   *  the park. Consumers (<Coaster>/<TrackRide>) must NOT register a fatal
   *  ride with the GameManager — they render it as a translucent red
   *  "invalid" track instead. */
  fatal?: boolean;
  /** human-readable reason `fatal` was set */
  fatalReason?: string;
}

export interface CompiledTrackPieces {
  /** control points for buildRideSpline / computeSplineFrames (closed loop) */
  points: [number, number, number][];
  report: TrackPieceReport;
}

export interface CompileTrackOpts {
  /** semantics + design-check defaults (default 'coaster'; 'monorail' allowed) */
  profile?: RideProfile | 'monorail';
  /** coaster rule set — gates corkscrews (default: coaster/bobsled 'steel', else 'wooden') */
  type?: CoasterType;
  /** cursor origin (default [0, 0.55, 0] — station rail height above local ground) */
  start?: [number, number, number];
  /** initial heading yaw in radians, 0 = +z (default 0) */
  heading?: number;
  /** bank forwarded to the design-check frames — match your buildRideSpline call */
  bank?: number;
  /** park bounds guard: the terrain edge length (points must stay within
   *  ±size/2 + margin) or `{ half, margin? }`. Points that leave the bounds
   *  set `report.fatal`. <Coaster>/<TrackRide> pass the park size for you.
   *  NOTE: closure-synthesized pieces COUNT toward the bounds — the Dubins
   *  return arcs sweep up to ~2·2.2 u past the cursor, so end the authored
   *  layout slightly SHORT of the start (~0.3 u) rather than past it. */
  bounds?: number | { half: number; margin?: number };
}

const TURN_RADIUS = 1.5;
const mod2pi = (a: number) => ((a % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);

/**
 * Compile a track-piece list into spline control points + a full legality
 * report. Vocabulary above (TrackPieceType); every piece starts and ends
 * LEVEL (like RCT2's transition grammar), so pieces chain freely. Corkscrews
 * warn on non-steel coasters (TRACK_WHITELIST semantics — the piece still
 * compiles so the author can see it) and are replaced by an sbend on water/
 * monorail profiles (an inverted water channel cannot exist). The circuit is
 * auto-closed: eased ramp to station height, then the shortest Dubins
 * arc–straight–arc back to the start pose; the closure is reported (and
 * warned about when it had to synthesize a suspiciously long return leg).
 * The synthesized closure pieces COUNT toward `opts.bounds` — land the last
 * authored piece ~0.3 u short of the start so the return arcs stay inside.
 * Coaster banking saturates at the type's bankLimit (coasterBankCap).
 * Pure and deterministic.
 */
export function compileTrackPieces(pieces: TrackPiece[], opts: CompileTrackOpts = {}): CompiledTrackPieces {
  const t = THREE; // same three namespace the bundle renders with
  const profile = opts.profile ?? 'coaster';
  const type: CoasterType = opts.type ?? (profile === 'coaster' || profile === 'bobsled' ? 'steel' : 'wooden');
  const warnings: string[] = [];
  const warn = (m: string) => {
    warnings.push(m);
    console.warn(`SplineRideKit: ${m}`);
  };
  const start: [number, number, number] = opts.start ?? [0, 0.55, 0];
  const startYaw = opts.heading ?? 0;
  const baseY = start[1];
  let yaw = startYaw;
  const pos = { x: start[0], y: start[1], z: start[2] };
  const points: [number, number, number][] = [[pos.x, pos.y, pos.z]];
  const emit = (x: number, y: number, z: number) => {
    const [lx, ly, lz] = points[points.length - 1];
    if (Math.hypot(x - lx, y - ly, z - lz) < 0.12) return; // dedupe — centripetal CR dislikes coincident points
    points.push([x, y, z]);
  };
  const setPosToLast = () => {
    const lp = points[points.length - 1];
    pos.x = lp[0];
    pos.y = lp[1];
    pos.z = lp[2];
  };
  const dir = () => [Math.sin(yaw), Math.cos(yaw)] as [number, number];

  /** level straight run along the heading */
  const straight = (len: number) => {
    const [dx, dz] = dir();
    if (len > 2.4) emit(pos.x + dx * len * 0.5, pos.y, pos.z + dz * len * 0.5);
    emit(pos.x + dx * len, pos.y, pos.z + dz * len);
    pos.x += dx * len;
    pos.z += dz * len;
  };
  /** eased RCT2 ramp via rampPoints (auto-extends its run for legality) */
  const ramp = (rise: number, run?: number) => {
    const [dx, dz] = dir();
    const r = Math.max(run ?? 0, 2.2, 1.9 * Math.abs(rise));
    const pts = rampPoints([pos.x, pos.y, pos.z], [dx, dz], { run: r, rise });
    for (const p of pts) emit(p[0], p[1], p[2]);
    const last = pts[pts.length - 1];
    pos.x = last[0];
    pos.y = last[1];
    pos.z = last[2];
  };
  /** chorded arc; s=+1 turns like TrackKit's turnL, dy is an eased total rise */
  const arc = (s: 1 | -1, angleRad: number, R: number, dy = 0) => {
    // turn centre on the inside of the turn (TrackKit convention): heading
    // (sin yaw, 0, cos yaw) has its turnL centre at +(cos yaw, 0, -sin yaw)
    const cx = pos.x + s * R * Math.cos(yaw);
    const cz = pos.z - s * R * Math.sin(yaw);
    const relX = pos.x - cx;
    const relZ = pos.z - cz;
    const y0 = pos.y;
    const steps = Math.max(2, Math.ceil(angleRad / (Math.PI / 6))); // ≤30° chords
    for (let k = 1; k <= steps; k++) {
      const a = s * (k / steps) * angleRad;
      const rx = relX * Math.cos(a) + relZ * Math.sin(a); // rotate about +Y
      const rz = -relX * Math.sin(a) + relZ * Math.cos(a);
      // eased elevation along the arc (smooth cosine — level entry and exit)
      const f = k / steps;
      emit(cx + rx, y0 + dy * 0.5 * (1 - Math.cos(Math.PI * f)), cz + rz);
    }
    yaw += s * angleRad;
    pos.x = cx + relX * Math.cos(s * angleRad) + relZ * Math.sin(s * angleRad);
    pos.z = cz - relX * Math.sin(s * angleRad) + relZ * Math.cos(s * angleRad);
    pos.y = y0 + dy;
  };
  /** lateral S-shift (level, heading preserved) */
  const sbend = (len: number, off: number) => {
    const [dx, dz] = dir();
    const lx = Math.cos(yaw); // left normal (matches the arc-centre convention)
    const lz = -Math.sin(yaw);
    for (let k = 1; k <= 4; k++) {
      const f = k / 4;
      const o = off * 0.5 * (1 - Math.cos(Math.PI * f)); // parallel entry/exit
      emit(pos.x + dx * len * f + lx * o, pos.y, pos.z + dz * len * f + lz * o);
    }
    pos.x += dx * len + lx * off;
    pos.z += dz * len + lz * off;
  };
  /** inverting corkscrew: one full loop of radius R lying in a PLANE that
   *  contains the heading, leaned s·20° off vertical (the classic inclined
   *  corkscrew loop), stretched forward by the net advance L so the entry
   *  and exit legs pass well clear of each other at the base. Because the
   *  element is exactly planar, parallel transport carries ZERO residual
   *  twist around the rest of the circuit (a non-planar barrel pollutes
   *  every other frame with distributed holonomy) — the frame flips through
   *  the top and comes back clean. Cursor: +L along the heading, level. */
  const corkscrew = (s: 1 | -1, R: number, L: number) => {
    const [dx, dz] = dir();
    const lx = Math.cos(yaw); // left normal
    const lz = -Math.sin(yaw);
    const LEAN = 0.35; // ~20° off vertical
    const ny = Math.cos(LEAN);
    const nl = Math.sin(LEAN) * s;
    const y0 = pos.y;
    for (let k = 1; k <= 10; k++) {
      const f = k / 10;
      const along = L * f + R * Math.sin(2 * Math.PI * f);
      const lift = R * (1 - Math.cos(2 * Math.PI * f));
      emit(pos.x + dx * along + lx * nl * lift, y0 + ny * lift, pos.z + dz * along + lz * nl * lift);
    }
    pos.x += dx * L;
    pos.z += dz * L;
    pos.y = y0;
  };

  // ---- walk the pieces ----
  const defs: TrackPieceDef[] = pieces.map((p) => (typeof p === 'string' ? { type: p } : p));
  const corkscrewOk = profile === 'coaster' && TYPE_RULES[type].inversions;
  for (let i = 0; i < defs.length; i++) {
    const d = defs[i];
    switch (d.type) {
      case 'station': {
        if (i !== 0) warn(`'station' (piece ${i}) is not the first piece — boarding decks assume frame 0 is the station`);
        const len = d.length ?? 2.6;
        const [dx, dz] = dir();
        emit(pos.x + dx * len * 0.5, pos.y, pos.z + dz * len * 0.5);
        emit(pos.x + dx * len, pos.y, pos.z + dz * len);
        pos.x += dx * len;
        pos.z += dz * len;
        break;
      }
      case 'flat':
      case 'straight':
        straight(d.length ?? 1.3);
        break;
      case 'lift':
        ramp(Math.abs(d.height ?? 1.5), d.length);
        break;
      case 'drop': {
        const fall = d.height ?? Math.max(0.55, pos.y - baseY);
        ramp(-Math.abs(fall), d.length);
        break;
      }
      case 'hill': {
        const h = Math.abs(d.height ?? 0.9);
        // camelback y = h/2·(1 − cos 2πf): level entry/exit; L keeps the max
        // slope (hπ/L) under 60° and the pitch rate (2π²h/L²) under the rule
        const L = Math.max(d.length ?? 0, 3.6, 6.3 * Math.sqrt(h));
        const [dx, dz] = dir();
        const steps = Math.max(6, Math.round(L / 0.9));
        const y0 = pos.y;
        for (let k = 1; k <= steps; k++) {
          const f = k / steps;
          emit(pos.x + dx * L * f, y0 + h * 0.5 * (1 - Math.cos(2 * Math.PI * f)), pos.z + dz * L * f);
        }
        pos.x += dx * L;
        pos.z += dz * L;
        pos.y = y0;
        break;
      }
      case 'turnL':
      case 'turnR': {
        const R = Math.max(0.8, d.radius ?? TURN_RADIUS);
        if ((d.radius ?? TURN_RADIUS) < 0.8) warn(`turn radius ${d.radius} clamped to 0.8 (piece ${i}) — tighter arcs kink the spline`);
        arc(d.type === 'turnL' ? 1 : -1, Math.abs(d.angle ?? 90) * DEG, R);
        break;
      }
      case 'helixL':
      case 'helixR':
        arc(d.type === 'helixL' ? 1 : -1, Math.abs(d.angle ?? 360) * DEG, Math.max(1.0, d.radius ?? TURN_RADIUS), d.height ?? 0);
        break;
      case 'corkscrewL':
      case 'corkscrewR': {
        if (profile !== 'coaster' && profile !== 'bobsled') {
          warn(`'${d.type}' (piece ${i}) replaced by an sbend — a ${profile} channel cannot invert`);
          sbend(3.6, (d.type === 'corkscrewL' ? 1 : -1) * 1.2);
          break;
        }
        if (!corkscrewOk) warn(`'${d.type}' (piece ${i}) is not in the ${type} coaster whitelist — RCT2's ${type} track table has no corkscrew group (WoodenRollerCoaster.h:26,85)`);
        {
          // R:L = 1:4 keeps the base pass over the 0.9 clearance AND the loop
          // tight enough to genuinely invert under the spline smoothing
          // (verified numerically: R 0.5–0.7 flips to up.y ≤ −0.8, worst
          // clearance ≥ 0.98; larger radii need more advance than they get)
          const R = Math.min(0.7, Math.max(0.45, d.radius ?? 0.6));
          const L = Math.max(d.length ?? 4 * R, 4 * R);
          corkscrew(d.type === 'corkscrewL' ? 1 : -1, R, L);
        }
        break;
      }
      case 'sbend':
        sbend(Math.max(2.4, d.length ?? 3.6), d.radius ?? 1.2);
        break;
      default:
        warn(`unknown piece '${(d as { type: string }).type}' (piece ${i}) skipped`);
    }
  }
  setPosToLast();

  // ---- close the circuit ----
  const synthesized: string[] = [];
  let authoredLen = 0;
  for (let i = 1; i < points.length; i++) {
    const [ax, ay, az] = points[i - 1];
    const [bx, by, bz] = points[i];
    authoredLen += Math.hypot(bx - ax, by - ay, bz - az);
  }
  const yawGapNow = () => Math.abs(mod2pi(yaw - startYaw + Math.PI) - Math.PI);
  const posGapNow = () => Math.hypot(pos.x - start[0], pos.z - start[2]) + Math.abs(pos.y - baseY);
  if (posGapNow() > 0.5 || yawGapNow() > 0.12) {
    // 1) eased ramp back to station height along the current heading
    if (Math.abs(pos.y - baseY) > 0.08) {
      const rise = baseY - pos.y;
      ramp(rise);
      synthesized.push(`${rise > 0 ? 'lift' : 'drop'} ${Math.abs(rise).toFixed(2)}`);
    }
    // 2) shortest Dubins arc–straight–arc onto the start pose. Coasters get
    // WIDER closing arcs (r 2.2): the return leg is ridden at full post-drop
    // speed, and the energy-paced lateral G through a 1.5-radius arc at the
    // banking ramp-in would graze the 1.5 g derail guard. Coasters ALSO land
    // via a straight BRAKE TAIL (round-4 safeguard): a closing arc welded
    // directly onto the station used to concentrate the spline's curvature at
    // the wrap point — the fastest, least-banked track on the circuit — and
    // validatePark's crash replay read a lateral-G spike there. The Dubins
    // path now targets a virtual pose TAIL units BEFORE the station along the
    // entry heading, then runs straight home, so the weld is always ridden on
    // dead-straight track whatever the arrival speed.
    const R = profile === 'coaster' ? 2.2 : TURN_RADIUS;
    const TAIL = profile === 'coaster' ? 1.2 : 0;
    const tx = start[0] - Math.sin(startYaw) * TAIL;
    const tz = start[2] - Math.cos(startYaw) * TAIL;
    const phiOf = (vx: number, vz: number) => Math.atan2(vx, vz);
    let best: { s1: 1 | -1; s2: 1 | -1; d1: number; d2: number; L: number; phiT: number; total: number } | null = null;
    ([[1, 1], [-1, -1], [1, -1], [-1, 1]] as [1 | -1, 1 | -1][]).forEach(([s1, s2]) => {
      const c1x = pos.x + s1 * R * Math.cos(yaw);
      const c1z = pos.z - s1 * R * Math.sin(yaw);
      const c2x = tx + s2 * R * Math.cos(startYaw);
      const c2z = tz - s2 * R * Math.sin(startYaw);
      const Dx = c2x - c1x;
      const Dz = c2z - c1z;
      const dd = Math.hypot(Dx, Dz);
      let L: number;
      let phiT: number;
      if (s1 === s2) {
        L = dd;
        phiT = dd < 1e-9 ? yaw : phiOf(Dx, Dz);
      } else {
        if (dd < 2 * R + 1e-6) return; // inner tangent doesn't exist
        L = Math.sqrt(dd * dd - 4 * R * R);
        phiT = phiOf(Dx, Dz) + (s1 === 1 ? 1 : -1) * Math.atan2(2 * R, L);
      }
      const d1 = mod2pi(s1 * (phiT - yaw));
      const d2 = mod2pi(s2 * (startYaw - phiT));
      const total = R * (d1 + d2) + L;
      if (!best || total < best.total) best = { s1, s2, d1, d2, L, phiT, total };
    });
    if (!best) {
      warn('layout cannot close cleanly — no return path found (this should not happen)');
    } else {
      const b = best as { s1: 1 | -1; s2: 1 | -1; d1: number; d2: number; L: number; phiT: number; total: number };
      if (b.d1 > 0.06) {
        arc(b.s1, b.d1, R);
        synthesized.push(`turn${b.s1 === 1 ? 'L' : 'R'} ${(b.d1 / DEG).toFixed(0)}°`);
      }
      yaw = b.phiT; // exact tangent heading (kills chord drift)
      if (b.L > 0.12) {
        straight(b.L);
        synthesized.push(`straight ${b.L.toFixed(2)}`);
      }
      if (b.d2 > 0.06) {
        arc(b.s2, b.d2, R);
        synthesized.push(`turn${b.s2 === 1 ? 'L' : 'R'} ${(b.d2 / DEG).toFixed(0)}°`);
      }
      if (TAIL > 0) {
        yaw = startYaw; // exact entry heading (kills chord drift on the tail)
        pos.x = tx;
        pos.z = tz;
        straight(TAIL);
        synthesized.push(`straight ${TAIL.toFixed(1)} (brake tail)`);
      }
      setPosToLast();
      if (b.total > Math.max(14, 1.6 * authoredLen))
        warn(`layout doesn't close cleanly — ${b.total.toFixed(1)} units of return track synthesized (${synthesized.join(', ')}); aim the last authored piece roughly back at the station`);
    }
  }
  // the closed CatmullRom wraps to points[0] automatically — points that
  // land ON the start would kink the wrap
  while (points.length > 3) {
    const [lx, ly, lz] = points[points.length - 1];
    if (Math.hypot(lx - start[0], ly - baseY, lz - start[2]) < 0.45) points.pop();
    else break;
  }
  // ---- station-weld fairness (round-4 safeguard) -----------------------------
  // The wrap segment (last point → points[0]) is ridden at full post-circuit
  // speed with the bank ramped out for the flat station — when the layout
  // lands on the station FROM A CURVE the closed spline concentrates the
  // remaining heading change right at the weld and the 1.5 g derail-guard
  // replay reads a spike there (the old L-wrap archetype replayed 1.31 g
  // against the 1.27 g crash margin at u = 1.00). Warn so authors add a trim
  // brake-run straight (the re-verified §4 archetypes end `straight g − 0.3`
  // with g ≈ 1.2 — see rules/park-generation.md).
  if (profile === 'coaster' && points.length >= 4) {
    const [lx, , lz] = points[points.length - 1];
    const ex = Math.sin(startYaw);
    const ez = Math.cos(startYaw);
    const relX = lx - start[0];
    const relZ = lz - start[2];
    const lateral = Math.abs(relX * ez - relZ * ex);
    const along = relX * ex + relZ * ez;
    if (lateral > 0.3 && along > -3.2)
      warn(
        `the circuit lands on the station from a curve (final point sits ${lateral.toFixed(2)} u off the station axis) — the station weld will read a lateral-G spike at speed; end the layout with a straight brake tail ≥ ~1.2 u along the station axis, landing ~0.3 u short of the start (see the §4 archetypes)`,
      );
  }
  const gap = (() => {
    const [lx, ly, lz] = points[points.length - 1];
    return Math.hypot(lx - start[0], ly - baseY, lz - start[2]);
  })();
  const closed = gap < TURN_RADIUS * 2.2 && yawGapNow() < 0.12;
  if (!closed) warn(`layout does not close (residual gap ${gap.toFixed(2)}, yaw off by ${(yawGapNow() / DEG).toFixed(0)}°)`);

  if (points.length < 4) {
    warn('too few pieces — a circuit needs at least ~4 control points');
    return {
      points,
      report: {
        ok: false,
        design: { ok: false, violations: [] },
        valid: { ok: false, worst: 0, at: [0, 0] },
        closure: { closed: false, gap, synthesized },
        warnings,
        fatal: true,
        fatalReason: 'too few pieces — a circuit needs at least ~4 control points',
      },
    };
  }

  // ---- always validate the result ----
  // design-check frames use the bank each profile actually builds with, so
  // the report matches what buildRideSpline will assemble. Coaster banking is
  // SATURATED at the type's bankLimit (round-3 safeguard): auto-banking used
  // to default to 0.7 rad (40°) even on wooden track whose limit is 25°,
  // making documented archetypes fail 'bankLimit' when no bank was passed.
  if (profile === 'coaster' && opts.bank !== undefined && opts.bank > TYPE_RULES[type].maxBank + 1e-6)
    warn(
      `bank ${opts.bank.toFixed(2)} rad exceeds the ${type} bankLimit ${(TYPE_RULES[type].maxBank).toFixed(2)} rad (${(TYPE_RULES[type].maxBank / DEG).toFixed(0)}°) — clamped to the limit`,
    );
  const designBank =
    profile === 'coaster' ? coasterBankCap(type, opts.bank)
    : opts.bank ??
    (profile === 'flume' || profile === 'rapids' ? 0.25
    : profile === 'monorail' ? 0.08
    : profile === 'gokart' ? 0.02
    : profile === 'bobsled' ? 0.55
    : undefined);
  const fb = computeSplineFrames(t, points, { bank: designBank });
  const design = checkCoasterDesign(t, points, { type, frames: fb, bank: designBank });
  const valid = validateSpline(t, fb.curve);
  if (profile === 'coaster')
    design.violations.forEach((v) =>
      warnings.push(`design ${v.warning ? 'warning' : 'violation'} [${v.kind}] at u=${v.at.toFixed(2)} — ${v.detail}`),
    );
  if (!valid.ok) warn(`compiled track self-intersects (worst clearance ${valid.worst.toFixed(2)}) — spread the layout out`);
  const checksOk = valid.ok && closed && (profile === 'coaster' ? design.ok : true);

  // ---- FATAL guard (round-1 safeguard) --------------------------------------
  // A track that fails its checks, needed a return leg past 40% of the
  // authored arc length, or leaves the park bounds must never be silently
  // built as a working ride: consumers (<Coaster>/<TrackRide>) render a fatal
  // track in translucent red and skip the GameManager registration.
  let fatal = false;
  let fatalReason = '';
  const fatalize = (m: string) => {
    if (!fatal) {
      fatal = true;
      fatalReason = m;
    }
    warn(
      `FATAL: ${m} — fix the layout: end it FACING the station (aim the last authored piece back at the station straight) and keep every piece inside the park`,
    );
  };
  let finalLen = 0;
  for (let i = 1; i < points.length; i++) {
    const [ax, ay, az] = points[i - 1];
    const [bx, by, bz] = points[i];
    finalLen += Math.hypot(bx - ax, by - ay, bz - az);
  }
  const closureLen = Math.max(0, finalLen - authoredLen);
  if (!checksOk) fatalize('the compiled track fails its design/clearance/closure checks (see report.design/valid/closure)');
  else if (closureLen > 0.4 * Math.max(authoredLen, 1e-6))
    fatalize(
      `the synthesized closure is ${closureLen.toFixed(1)} u — ${((100 * closureLen) / Math.max(authoredLen, 1e-6)).toFixed(0)}% of the ${authoredLen.toFixed(1)} u authored (limit 40%)`,
    );
  if (opts.bounds !== undefined) {
    const half = typeof opts.bounds === 'number' ? opts.bounds / 2 : opts.bounds.half;
    const margin = (typeof opts.bounds === 'number' ? undefined : opts.bounds.margin) ?? 0.3;
    let worstExt = 0;
    for (const [x, , z] of points) worstExt = Math.max(worstExt, Math.abs(x), Math.abs(z));
    if (worstExt > half + margin) fatalize(`the track reaches ±${worstExt.toFixed(1)} u — outside the ±${half.toFixed(1)} u park bounds`);
  }

  return {
    points,
    report: {
      ok: checksOk && !fatal,
      design,
      valid,
      closure: { closed, gap, synthesized },
      warnings,
      ...(fatal ? { fatal: true, fatalReason } : {}),
    },
  };
}

// ---------------------------------------------------------------------------
// RCT2 CRASH SEQUENCE — Vehicle.Crash.cpp:169-585: on a crash every car is
// detached and thrown ballistically in proportion to its velocity (with
// pseudo-random jitter), falls under gravity, and EXPLODES on ground impact:
// an explosion cloud + flare, ~7 debris particles per car, a burning wreck
// for ~2.4 s, riders removed (KillAllPassengersInTrain) and the ride closed.
// ---------------------------------------------------------------------------

export interface CrashFrameVel {
  p: THREE.Vector3;
  fwd: THREE.Vector3;
  speed: number;
}

export interface TrainCrash {
  update: (time: number) => void;
  done: () => boolean;
  /** remove all crash pyrotechnics and restore car visibility */
  dispose: () => void;
}

/**
 * Detach a train's cars ballistically and play the RCT2 crash sequence
 * (Vehicle.Crash.cpp:169-585): launch ∝ velocity with hashed jitter, gravity
 * fall, and on ground impact 2 expanding emissive fireballs, 6 debris boxes
 * and a charred wreck that BURNS with a ParticleKit `buildFire` (layered
 * core/outer-flame/ember/smoke emitters + flickering light) scaled to the
 * wreck, full blaze ~2.4 s then decaying to a smoulder — plus per-car
 * ParticleKit layers: an impact SPARK burst (additive) and a rising grey
 * SMOKE PLUME whose rate tracks the burn-down. Fully deterministic: jitter
 * is hashed by car index and t0 is taken from the first `update(time)` call —
 * no Math.random / Date.now.
 */
export function crashTrain(
  t: typeof THREE,
  parentGroup: THREE.Group,
  cars: THREE.Group[],
  frameVel: CrashFrameVel[],
  opts: { groundAt?: (x: number, z: number) => number } = {},
): TrainCrash {
  const groundAt = opts.groundAt ?? (() => 0);
  const worldUp = new t.Vector3(0, 1, 0);
  const DEBRIS_COLORS = [0x4a4e55, 0x6b4626, 0x8b2020, 0x3a3d42, 0x8b8f96, 0x2f2a26];

  interface Debris { m: THREE.Mesh; v: THREE.Vector3; land: number }
  interface Fx {
    root: THREE.Group;
    fire: THREE.Mesh;
    flare: THREE.Mesh;
    smoke: THREE.Mesh;
    debris: Debris[];
    /** ParticleKit layers: rising smoke plume, impact spark burst, layered fire */
    smokeE: Emitter;
    sparksE: Emitter;
    fireF: Fire;
  }
  interface Sim {
    car: THREE.Group;
    p0: THREE.Vector3;
    v0: THREE.Vector3;
    axis: THREE.Vector3;
    rate: number;
    seed: number;
    impactT?: number;
    fx?: Fx;
  }

  const sims: Sim[] = cars.map((car, i) => {
    const fv = frameVel[Math.min(i, frameVel.length - 1)] ?? { p: car.position, fwd: new t.Vector3(0, 0, 1), speed: 2 };
    const side = new t.Vector3().crossVectors(fv.fwd, worldUp);
    if (side.lengthSq() < 1e-4) side.set(1, 0, 0);
    else side.normalize();
    // ballistic launch ∝ train velocity + hashed jitter (Vehicle.Crash.cpp:169)
    const k = 0.9 + 0.35 * hashN(i + 0.37);
    const v0 = fv.fwd
      .clone()
      .multiplyScalar(fv.speed * k)
      .addScaledVector(side, (hashN(i + 1.13) - 0.5) * 0.55 * fv.speed)
      .addScaledVector(worldUp, 0.7 + 0.2 * fv.speed * hashN(i + 2.29));
    const axis = new t.Vector3(hashN(i + 3.17) - 0.5, hashN(i + 4.29) - 0.5, hashN(i + 5.41) - 0.5).normalize();
    return { car, p0: fv.p.clone(), v0, axis, rate: 3 + 5 * hashN(i + 6.53), seed: i };
  });

  const fxRoot = new t.Group();
  parentGroup.add(fxRoot);
  let t0: number | undefined;
  let lastTT = 0;
  const q = new t.Quaternion();

  const matOf = (m: THREE.Mesh) => m.material as THREE.MeshStandardMaterial;

  const spawnFx = (s: Sim, at: THREE.Vector3, gy: number) => {
    const root = new t.Group();
    root.position.set(at.x, gy, at.z);
    // charred burning wreck — persists after the pyrotechnics fade
    const wreck = box(t, [0.46, 0.2, 0.9], 0x2a2320, [0, 0.09, 0], { rough: 1, emissive: 0x2a0d02 });
    wreck.rotation.set(0.12 * (hashN(s.seed + 7.1) - 0.5), hashN(s.seed + 8.2) * Math.PI, 0.3 * (hashN(s.seed + 9.3) - 0.5));
    root.add(wreck);
    // explosion cloud: 2 expanding emissive spheres (orange -> fading)
    const fire = ball(t, 0.32, 0xff9a3c, [0, 0.24, 0], { emissive: 0xff7a20, opacity: 0.9, rough: 0.6 });
    const flare = ball(t, 0.2, 0xffd27a, [0, 0.26, 0], { emissive: 0xffc040, opacity: 0.9, rough: 0.4 });
    const smoke = ball(t, 0.16, 0x4c4a48, [0, 0.34, 0], { opacity: 0.45, rough: 1 });
    [fire, flare, smoke].forEach((m) => { m.castShadow = false; root.add(m); });
    // 6 debris boxes scattering ballistically (RCT2 spawns ~7 per car)
    const debris: Debris[] = [];
    for (let k = 0; k < 6; k++) {
      const n = s.seed * 6 + k;
      const sz = 0.05 + 0.06 * hashN(n + 12.3);
      const m = box(t, [sz, sz * 0.8, sz * 1.2], DEBRIS_COLORS[k % DEBRIS_COLORS.length], [0, 0.15, 0], { rough: 0.9 });
      const vy = 1.2 + 1.7 * hashN(n + 13.7);
      const v = new t.Vector3((hashN(n + 14.1) - 0.5) * 2.6, vy, (hashN(n + 15.9) - 0.5) * 2.6);
      const land = (vy + Math.sqrt(vy * vy + 2 * GRAV * 0.15)) / GRAV; // analytic touchdown
      debris.push({ m, v, land });
      root.add(m);
    }
    // ParticleKit layers (deterministic, fixed caps — ~228 particles per car):
    // a long-life grey smoke plume rising off the wreck, a one-shot spark
    // burst at the impact point, and a layered buildFire scaled to the wreck
    // (its own core/outer/ember/smoke layers + flickering warm light)
    const smokeE = buildEmitter(t, {
      max: 60, rate: 9, life: 3.0, lifeVar: 1.0,
      velocity: [0.05, 0.55, 0], spread: 0.16, gravity: -0.03,
      size: 0.14, sizeEnd: 0.55, color: 0x4a4846, colorEnd: 0x8d8d8a, opacity: 0.4,
    });
    smokeE.setOrigin(0, 0.28, 0);
    const sparksE = buildEmitter(t, {
      max: 40, rate: 0, life: 0.75, lifeVar: 0.35,
      velocity: [0, 1.8, 0], spread: 2.6, gravity: 7,
      size: 0.05, sizeEnd: 0.02, color: 0xffd070, colorEnd: 0xff5010, opacity: 1, additive: true,
    });
    sparksE.burst(26, [0, 0.2, 0]);
    const fireF = buildFire(t, { scale: 0.62 });
    fireF.group.position.y = 0.12;
    root.add(smokeE.points, sparksE.points, fireF.group);
    fxRoot.add(root);
    s.fx = { root, fire, flare, smoke, debris, smokeE, sparksE, fireF };
  };

  const animateFx = (s: Sim, e: number, time: number) => {
    const fx = s.fx!;
    // fireball + flare: expand fast, fade out
    fx.fire.visible = e < 0.7;
    if (fx.fire.visible) {
      fx.fire.scale.setScalar(0.35 + 1.9 * Math.min(1, e / 0.35));
      matOf(fx.fire).opacity = Math.max(0, 0.9 * (1 - e / 0.7));
    }
    fx.flare.visible = e < 0.32;
    if (fx.flare.visible) {
      fx.flare.scale.setScalar(0.3 + 2.4 * Math.min(1, e / 0.18));
      matOf(fx.flare).opacity = Math.max(0, 0.9 * (1 - e / 0.32));
    }
    // debris: ballistic until each piece's landing time, then rest
    fx.debris.forEach((d, k) => {
      const te = Math.min(e, d.land);
      d.m.position.set(d.v.x * te, Math.max(0.03, 0.15 + d.v.y * te - 0.5 * GRAV * te * te), d.v.z * te);
      if (te < d.land) d.m.rotation.set(te * (4 + k), te * 3.1, te * (2 + k * 0.7));
    });
    // smoke puff rises and thins for ~3.5 s
    const so = Math.max(0, 0.45 - e * 0.12);
    fx.smoke.visible = so > 0;
    if (fx.smoke.visible) {
      fx.smoke.position.y = 0.34 + e * 0.4;
      fx.smoke.scale.setScalar(0.5 + 0.65 * e);
      matOf(fx.smoke).opacity = so;
    }
    // ParticleKit layers: the plume rate and the buildFire intensity track
    // the burn-down — full blaze ~2.4 s, then decaying to a lasting smoulder
    // (sparks are a one-shot burst); emitters self-derive dt
    const burnK = e < 2.4 ? 1 : Math.max(0, 1 - (e - 2.4) / 3.6);
    fx.smokeE.setRate(9 * burnK);
    fx.fireF.setIntensity(e < 2.4 ? 1 : Math.max(0.22, burnK));
    fx.smokeE.update(time);
    fx.sparksE.update(time);
    fx.fireF.update(time);
  };

  const update = (time: number) => {
    if (t0 === undefined) t0 = time; // deterministic zero: the first update call
    const tt = time - t0;
    lastTT = tt;
    for (const s of sims) {
      if (s.impactT === undefined) {
        const p = s.p0.clone().addScaledVector(s.v0, tt);
        p.y -= 0.5 * GRAV * tt * tt;
        const gy = groundAt(p.x, p.z);
        if (tt > 0.02 && p.y <= gy + 0.08) {
          s.impactT = tt;
          s.car.visible = false; // car destroyed, riders removed (Vehicle.Crash.cpp KillAllPassengersInTrain)
          spawnFx(s, p, gy);
        } else {
          s.car.position.copy(p);
          q.setFromAxisAngle(s.axis, s.rate * tt); // tumbling flight
          s.car.quaternion.copy(q);
        }
      }
      if (s.impactT !== undefined && s.fx) animateFx(s, tt - s.impactT, time);
    }
  };

  const done = () =>
    t0 !== undefined &&
    sims.every((s) => s.impactT !== undefined) &&
    lastTT - Math.max(...sims.map((s) => s.impactT ?? 0)) > 3.2;

  const dispose = () => {
    parentGroup.remove(fxRoot);
    sims.forEach((s) => {
      s.fx?.smokeE.dispose();
      s.fx?.sparksE.dispose();
      s.fx?.fireF.dispose();
    });
    fxRoot.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.geometry && !mesh.geometry.userData?.shared) mesh.geometry.dispose();
      if (mesh.material) (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).forEach((m) => m.dispose());
    });
    sims.forEach((s) => { s.car.visible = true; });
  };

  return { update, done, dispose };
}

// ---------------------------------------------------------------------------
// Profiles + guarded runner
// ---------------------------------------------------------------------------

export type RideProfile = 'coaster' | 'flume' | 'bobsled' | 'rapids' | 'gokart';

export interface RideSplineOpts {
  profile?: RideProfile;
  /** coaster construction-rule set (default: wood → 'wooden', else 'steel') */
  type?: CoasterType;
  /** max bank angle in radians (profile default; flume/rapids cap at ~0.25) */
  bank?: number;
  /** sample stride between supports */
  supportEvery?: number;
  /** ground height sampler so supports land on terrain (default flat y=0) */
  groundAt?: (x: number, z: number) => number;
  /** wooden supports (default: on for flume/rapids/coaster-wood, off for bobsled) */
  wood?: boolean;
  /** rapids only: height of the channel water strip vs the centreline (default -0.02) */
  waterY?: number;
  /** RCT2 TrackColour scheme (ride/RideColour.h:19-24). Per profile:
   *  coaster rails/ties/supports; flume trough/rim+ribs/supports; rapids
   *  stonework/–/supports; bobsled rim rails+spine (ice stays ice)/supports;
   *  gokart asphalt/red kerb. Omitted = today's colours exactly. */
  colours?: TrackScheme;
  /** RCT2 VehicleColour schemes (ride/VehicleColour.h:19-24) — stored and
   *  returned on the RideSpline so callers can dress their vehicles */
  vehicleSchemes?: VehicleScheme[];
}

export interface RideRunOpts extends RunOpts {
  /** sideways shift of the vehicles along frame.side — go-kart lanes */
  laneOffset?: number;
  /** multiplies the profile's computed pace — go-kart throttle */
  speedScale?: number;
}

export interface RideSpline {
  group: THREE.Group;
  curve: THREE.CatmullRomCurve3;
  frameAt: (u: number) => SplineFrame;
  run: (vehicles: THREE.Group[], runOpts?: RideRunOpts) => (time: number) => void;
  valid: SplineValidation;
  /** coaster profile only: the RCT2 construction-rule report */
  design?: CoasterDesignReport;
  /** echo of opts.vehicleSchemes — the ride's vehicle liveries, if seeded */
  vehicleSchemes?: VehicleScheme[];
  /** RCT2 station-brakes-failure breakdown: the arriving train stops slowing
   *  and rams the parked train at the station (Vehicle.Station.cpp:1385-1418) */
  setBrakesFailure: (v: boolean) => void;
  crashed: () => boolean;
  /** crash the train at its current position on the next update */
  forceCrash: () => void;
  /** clear the wreck and restart the train from the station/lift */
  resetCrash: () => void;
}

type Pace = 'energy' | 'drift' | 'constant';

// per-profile tuning: banking, pacing and the default vehicle seat height
// (wheelOffset) that puts undersides ON the channel surface. `guard` enables
// the RCT2 crash physics (G-derail + station collision) for that profile.
const PROFILE_TUNE: Record<Exclude<RideProfile, 'coaster'>, {
  bankCap: number;
  bankGain: number;
  /** default run() wheelOffset — see channel floor heights below */
  offset: number;
  pace: Pace;
  liftV: number;
  woodDefault: boolean;
  guard: boolean;
}> = {
  // trough floor at -0.10 below the centreline; a log hull of radius 0.3
  // (origin at barrel centre) therefore rides at +0.20
  flume: { bankCap: 0.25, bankGain: 1.6, offset: 0.2, pace: 'drift', liftV: 0.85, woodDefault: true, guard: false },
  rapids: { bankCap: 0.2, bankGain: 1.4, offset: 0.2, pace: 'drift', liftV: 0.85, woodDefault: true, guard: false },
  // chute floor at -0.05; sled runner bottoms sit 0.045 below the sled origin.
  // Bobsleds have no upstop wheels (Vehicle.TrackMotion.cpp:98-122) so the
  // 1.5 g lateral guard applies — layouts must bank their fast curves.
  bobsled: { bankCap: 1.05, bankGain: 3.2, offset: -0.005, pace: 'energy', liftV: 1.3, woodDefault: false, guard: true },
  // flat asphalt circuit: karts hug the ground at near-constant speed
  gokart: { bankCap: 0.02, bankGain: 0.2, offset: 0.02, pace: 'constant', liftV: 1.0, woodDefault: false, guard: false },
};

interface CrashCtl {
  brakesFailure: boolean;
  forced: boolean;
  isCrashed: boolean;
  crash: TrainCrash | null;
  resetRequested: boolean;
}

const newCtl = (): CrashCtl => ({ brakesFailure: false, forced: false, isCrashed: false, crash: null, resetRequested: false });

/**
 * Shared vehicle runner with RCT2 crash physics. Guarded profiles
 * (coaster/bobsled) derail when the effective lateral acceleration exceeds
 * 1.5 g — Vehicle.TrackMotion.cpp:58-122 (UpdateTrackMotionUpStopCheck: cars
 * without upstop wheels derail past |lateralG| 1.5 g, or vertical under
 * -0.8 g, on unbanked track) — where banking absorbs lateral force:
 * effective = v²·κ_horizontal · (1 − min(1, |roll|/0.6)). Station-brake
 * failure (Vehicle.Station.cpp:1385-1418,1640) makes the train skip the brake
 * run; on completing the lap it rams the parked "phantom" train at the
 * station — a closing speed far above RCT2's 14 mph bump/crash threshold
 * (Vehicle.Collision.cpp:52), so it always crashes.
 */
function makeGuardedRun(
  t: typeof THREE,
  cfg: {
    group: THREE.Group;
    frames: SplineFrame[];
    frameAt: (u: number) => SplineFrame;
    total: number;
    N: number;
    onLift: boolean[];
    liftStart: number;
    liftLen: number;
    maxY: number;
    pace: Pace;
    liftV: number;
    defOffset: number;
    defSpacing: number;
    guard: boolean;
    groundAt?: (x: number, z: number) => number;
    ctl: CrashCtl;
  },
) {
  const { frames, N, total, ctl } = cfg;
  const ds = total / N;
  // pre-sampled horizontal curvature + signed roll per frame for the G guard
  const kH: number[] = [];
  const rollA: number[] = [];
  for (let i = 0; i < N; i++) {
    const a = frames[(i - 1 + N) % N].fwd;
    const b = frames[(i + 1) % N].fwd;
    const ah = new t.Vector3(a.x, 0, a.z);
    const bh = new t.Vector3(b.x, 0, b.z);
    if (ah.lengthSq() < 1e-6 || bh.lengthSq() < 1e-6) kH.push(0);
    else kH.push(ah.normalize().angleTo(bh.normalize()) / (2 * ds));
    rollA.push(rollOfFrame(frames[i]));
  }

  return (vehicles: THREE.Group[], runOpts: RideRunOpts = {}) => {
    const speed = runOpts.speed ?? 1;
    const spacing = runOpts.spacing ?? cfg.defSpacing;
    const wheelOffset = runOpts.wheelOffset ?? cfg.defOffset;
    const laneOffset = runOpts.laneOffset ?? 0;
    const speedScale = runOpts.speedScale ?? 1;
    vehicles.forEach((v) => cfg.group.add(v));
    const energy = GRAV * (cfg.maxY + 0.55);
    const vMin = 1.4;
    const u0 = cfg.liftLen >= 8 ? cfg.liftStart / cfg.N : 0;
    let uHead = u0;
    let lapBase = u0;
    let last = 0;
    const m = new t.Matrix4();

    const place = (u: number) => {
      vehicles.forEach((c, i) => {
        const f = cfg.frameAt(u - (i * spacing) / total);
        c.position.copy(f.p).addScaledVector(f.up, wheelOffset).addScaledVector(f.side, laneOffset);
        m.makeBasis(f.side, f.up, f.fwd);
        c.setRotationFromMatrix(m);
      });
    };

    const triggerCrash = (v: number) => {
      const fv: CrashFrameVel[] = vehicles.map((_, i) => {
        const f = cfg.frameAt(uHead - (i * spacing) / total);
        return {
          p: f.p.clone().addScaledVector(f.up, wheelOffset).addScaledVector(f.side, laneOffset),
          fwd: f.fwd.clone(),
          speed: v,
        };
      });
      ctl.crash = crashTrain(t, cfg.group, vehicles, fv, { groundAt: cfg.groundAt });
      ctl.isCrashed = true;
    };

    return (time: number) => {
      if (ctl.resetRequested) {
        ctl.resetRequested = false;
        ctl.crash?.dispose();
        ctl.crash = null;
        ctl.isCrashed = false;
        ctl.forced = false;
        uHead = u0;
        lapBase = u0;
      }
      if (ctl.isCrashed) {
        ctl.crash?.update(time);
        return;
      }
      const dt = Math.min(0.06, Math.max(0, time - last));
      last = time;
      const head = cfg.frameAt(uHead);
      const i = Math.floor((((uHead % 1) + 1) % 1) * N) % N;
      let v: number;
      if (cfg.pace === 'energy') v = Math.sqrt(Math.max(vMin * vMin, 2 * (energy - GRAV * head.p.y)));
      else if (cfg.pace === 'drift') v = 1.0 + 3.2 * Math.max(0, -head.fwd.y); // drift, plunging on drops
      else v = 1.7; // gokart: near-constant throttle
      if (cfg.pace !== 'constant' && cfg.onLift[i]) v = cfg.liftV;
      v *= speedScale;

      if (cfg.guard) {
        // station brake run just before the lap point — unless the brakes
        // have failed, in which case the train barrels straight through
        // (Vehicle.Station.cpp:1385-1418: brake failure skips deceleration)
        const dAhead = (((u0 - uHead) % 1) + 1) % 1 * total;
        if (!ctl.brakesFailure && !cfg.onLift[i] && dAhead > 0.05 && dAhead < 1.8) v = Math.min(v, 1.6);
      }

      if (ctl.forced) {
        ctl.forced = false;
        triggerCrash(Math.max(v, 2.5));
        return;
      }

      if (cfg.guard) {
        // G-force derailment: effective lateral = v²·κ_h, discounted by bank
        // (Vehicle.TrackMotion.cpp:58-122 — no-upstop derail past 1.5 g)
        const eff = v * v * kH[i] * (1 - Math.min(1, Math.abs(rollA[i]) / 0.6));
        if (eff > 1.5 * GRAV) {
          triggerCrash(v);
          return;
        }
      }

      uHead += (v * speed * dt) / total;

      if (cfg.guard && ctl.brakesFailure && uHead - lapBase >= 1) {
        // lap complete with dead brakes: ram the parked train at the station —
        // closing speed ≈ v ≫ the 14 mph bump threshold, so this always
        // crashes (Vehicle.Collision.cpp:52; Vehicle.Station.cpp:1640)
        triggerCrash(v);
        return;
      }
      if (uHead - lapBase >= 1) lapBase += 1;
      place(uHead);
    };
  };
}

// ---------------------------------------------------------------------------
// RCT2 RIDE RATINGS — measure a compiled circuit the way OpenRCT2's ride TEST
// does (Vehicle.cpp:470-520,658-700 UpdateMeasurements: max/average speed,
// per-frame G-forces, air time, drop count + highest drop, turn counts), then
// run RideRatings.cpp's modifier pipeline over the result to get RCT2's
// EXCITEMENT / INTENSITY / NAUSEA triple.
//
// The measurement pass is the SAME energy-paced replay the runner and
// validatePark's crash gate use — `replayCoasterForces` below is that replay,
// factored out so there is exactly ONE physics model in the kit: speed
// v = √(2·(g·(maxY + 0.55) − g·y)) clamped to vMin 1.4 (lift 1.5, station
// brake run 1.6), and the guard's effective lateral acceleration
// v²·κ_h·(1 − min(1, |roll|/0.6)) (Vehicle.TrackMotion.cpp:58-122). Vertical G
// is the same replay state read along the frame's up axis — gravity component
// + centripetal, exactly the shape of RCT2's Vehicle::GetGForces
// (Vehicle.cpp:1173-1199: pitch/roll gravity term plus |velocity|·98/factor).
//
// UNIT MAPPING (documented simplification): the kit authors its pieces roughly
// ONE PER RCT2 TILE (straight 1.3, turn radius 1.5, station 2.6 world units
// against RCT2's 1-3-tile equivalents), so ONE WORLD UNIT IS READ AS ONE RCT2
// TILE. Everything else follows from RCT2's own arithmetic:
//   • ride length  — a flat tile is 32 subposition steps of 0x368A distance
//     each (Vehicle.MiniGolf.cpp:49; Ride.cpp:3490), and ToHumanReadableRideLength
//     is `>> 16` (UnitConversion.cpp:74) → 446784/65536 = 6.8175 length units/tile
//   • speed        — distance/tick is (velocity >> 10)·42 at 40 ticks/s
//     (Vehicle.cpp:497) and mph is (velocity·9) >> 18 (UnitConversion.cpp:62)
//     → 1 tile/s = 9.3495 mph
//   • height       — kCoordsZStep 8 against a 32-coord tile → 4 z-steps/tile,
//     which is what highestDropHeight counts (Vehicle.cpp:664-673)
//   • duration     — SegmentTime ticks once per 32 game ticks (Vehicle.cpp:481-494)
//     → 0.8 s per RCT2 duration unit
// G-forces are DIMENSIONLESS and pass through 1:1 — the kit's replay is already
// calibrated against RCT2's own g thresholds (the 1.5 g no-upstop derail).
// ---------------------------------------------------------------------------

/** length units per RCT2 tile: (32 × 0x368A) >> 16 — Vehicle.cpp:497, UnitConversion.cpp:74 */
const RCT2_LENGTH_PER_TILE = (32 * 0x368a) / 65536;
/** mph per tile/second — Vehicle.cpp:497 distance/tick vs UnitConversion.cpp:62 */
const RCT2_MPH_PER_TILE_PER_SEC = 9.3495;
/** height steps per tile: kCoordsZStep 8 vs a 32-coord tile (Vehicle.cpp:664) */
const RCT2_ZSTEPS_PER_TILE = 4;
/** seconds per RCT2 duration unit: SegmentTime++ every 32 of 40 ticks/s */
const RCT2_SEC_PER_DURATION = 0.8;
/** RCT2 sim ticks per second — totalAirTime counts ticks (Vehicle.cpp:512-515) */
const RCT2_TICKS_PER_SEC = 40;
/** mph → the fixed-point `Ride::maxSpeed` field (mph = (v·9) >> 18) */
const RCT2_VELOCITY_PER_MPH = 262144 / 9;

export interface CoasterForceSample {
  /** loop parameter of the sample */
  u: number;
  /** rail height (world units) */
  y: number;
  /** energy-paced speed, units/s */
  v: number;
  /** horizontal curvature, 1/units */
  kH: number;
  /** signed bank angle, radians */
  roll: number;
  /** the GUARD's effective lateral acceleration in units/s² (= m/s²): the
   *  number validatePark tests against 1.5 g × 0.85 */
  latAccel: number;
  /** vertical G along the car's up axis (g): gravity term + centripetal */
  vertG: number;
}

export interface CoasterForceReplay {
  /** the frames the replay ran over (reuse them, don't resample) */
  frames: SplineFrames;
  samples: CoasterForceSample[];
  /** worst effective lateral acceleration, units/s² — validatePark's gate */
  worstLatAccel: number;
  /** loop parameter of `worstLatAccel` */
  worstLatAt: number;
  /** highest rail point (the replay's energy budget datum) */
  maxY: number;
  /** per-sample lift-hill mask (detectLiftHill) */
  onLift: boolean[];
  /** lap time in seconds at the paced speed */
  duration: number;
}

/**
 * THE energy-paced force replay (factored out of validatePark's crash gate so
 * rateCoaster and the gate cannot drift apart). Reproduces makeGuardedRun's
 * pacing sample-for-sample: energy speed off the highest rail point, lift
 * crawl at `liftV`, the pre-station brake run, and the bank-discounted
 * effective lateral acceleration of the no-upstop derail check
 * (Vehicle.TrackMotion.cpp:58-122). Vertical G is read off the same state
 * (Vehicle.cpp:1173-1199). Pure and deterministic.
 */
export function replayCoasterForces(
  t: typeof THREE,
  points: [number, number, number][],
  opts: { bank?: number; frames?: SplineFrames; liftV?: number } = {},
): CoasterForceReplay {
  const fb = opts.frames ?? computeSplineFrames(t, points, { bank: opts.bank ?? 0.7 });
  const { frames, total, N, P } = fb;
  const ds = total / N;
  const liftV = opts.liftV ?? 1.5;
  let maxY = 0;
  for (const p of P) maxY = Math.max(maxY, p.y);
  const energy = 9.8 * (maxY + 0.55);
  const { liftStart, liftLen, onLift } = detectLiftHill(P);
  const u0 = liftLen >= 8 ? liftStart / N : 0;
  const samples: CoasterForceSample[] = [];
  let worstLatAccel = 0;
  let worstLatAt = 0;
  let duration = 0;
  for (let i = 0; i < N; i += 1) {
    const a = frames[(i - 1 + N) % N].fwd;
    const b = frames[(i + 1) % N].fwd;
    const ah = Math.hypot(a.x, a.z);
    const bh = Math.hypot(b.x, b.z);
    let kH = 0;
    if (ah > 1e-3 && bh > 1e-3) {
      const dot = Math.max(-1, Math.min(1, (a.x * b.x + a.z * b.z) / (ah * bh)));
      kH = Math.acos(dot) / (2 * ds);
    }
    const f = frames[i];
    const roll = Math.abs(f.fwd.y) > 0.97 ? 0 : Math.atan2(f.side.y, f.up.y);
    let v = onLift[i] ? liftV : Math.sqrt(Math.max(1.4 * 1.4, 2 * (energy - 9.8 * f.p.y)));
    const dAhead = ((((u0 - i / N) % 1) + 1) % 1) * total; // station brake run
    if (!onLift[i] && dAhead > 0.05 && dAhead < 1.8) v = Math.min(v, 1.6);
    const latAccel = v * v * kH * (1 - Math.min(1, Math.abs(roll) / 0.6));
    if (latAccel > worstLatAccel) {
      worstLatAccel = latAccel;
      worstLatAt = i / N;
    }
    // vertical G along the car's up axis: the gravity term (up · world-up) plus
    // the centripetal component of the curvature vector dT/ds along that axis
    const kx = (b.x - a.x) / (2 * ds);
    const ky = (b.y - a.y) / (2 * ds);
    const kz = (b.z - a.z) / (2 * ds);
    const kUp = kx * f.up.x + ky * f.up.y + kz * f.up.z;
    const vertG = f.up.y + (v * v * kUp) / 9.8;
    samples.push({ u: i / N, y: f.p.y, v, kH, roll, latAccel, vertG });
    duration += ds / Math.max(0.2, v);
  }
  return { frames: fb, samples, worstLatAccel, worstLatAt, maxY, onLift, duration };
}

/** the RCT2 ride-window rating word for a rating, mapped onto the kit's five
 *  bands — RatingNames + GetRatingName (openrct2-ui/windows/Ride.cpp:501-509,
 *  5628-5632: index = rating >> 8, low / medium / high / very high / extreme /
 *  ultra-extreme) */
export type RatingBand = 'gentle' | 'moderate' | 'thrilling' | 'intense' | 'extreme';

const BAND_OF: RatingBand[] = ['gentle', 'moderate', 'thrilling', 'intense', 'extreme', 'extreme'];
const bandOfRating = (rating2dp: number): RatingBand =>
  BAND_OF[Math.max(0, Math.min(5, Math.floor(rating2dp / 256)))];

/** turn tally in RCT2's buckets (turn length in track ELEMENTS ≈ tiles) —
 *  Ride.cpp:4249-4328 GetTurnCount{1,2,3,4Plus}Elements */
export interface CoasterTurnCounts {
  flat: [number, number, number];
  banked: [number, number, number];
  /** sloped turns bucket 4+ separately (Ride.cpp:4312) */
  sloped: [number, number, number, number];
}

export interface CoasterRatings {
  /** RCT2 excitement rating (RideRatings.cpp) */
  excitement: number;
  /** RCT2 intensity rating */
  intensity: number;
  /** RCT2 nausea rating */
  nausea: number;
  /** peak / mean paced speed, world units per second */
  maxSpeed: number;
  avgSpeed: number;
  /** peak positive vertical G along the car's up axis */
  maxPosVertG: number;
  /** most NEGATIVE vertical G (airtime; ≤ 0 on any coaster with a crest) */
  maxNegVertG: number;
  /** worst effective lateral G — the SAME number validatePark's crash gate
   *  tests against its 1.27 g margin (1.5 g × 0.85) */
  maxLatG: number;
  /** biggest single descent, world units */
  highestDrop: number;
  /** summed descent over the lap, world units */
  totalDrop: number;
  dropCount: number;
  /** seconds of the lap ridden at vertical G ≤ 0 (Vehicle.cpp:512-515) */
  airtimeSeconds: number;
  inversions: number;
  /** circuit arc length, world units */
  length: number;
  /** lap time in seconds at the paced speed */
  duration: number;
  /** the RCT2 rating word for INTENSITY, in the kit's five bands */
  ratingBand: RatingBand;
  /** the rating word for NAUSEA (same table) */
  nauseaBand: RatingBand;
  /** nausea past the AVERAGE guest's tolerance (RideRating 8.00 —
   *  Guest.cpp:193-198 NauseaMaximumThresholds): a sick-making ride */
  nauseaExtreme: boolean;
  /** the construction-rule set the ratings table came from */
  type: CoasterType;
  /** RCT2 turn tally the BonusTurns modifier ran over */
  turns: CoasterTurnCounts;
}

/** the RatingsData block of one coaster RTD (ride/rtd/coaster/*.h) */
interface RatingsTable {
  /** RatingsData.BaseRatings */
  base: [number, number, number];
  /** BonusLength excitement multiplier (threshold 6000 length units) */
  length: number;
  /** BonusMaxSpeed [exc, int, nau] */
  maxSpeed: [number, number, number];
  /** BonusAverageSpeed [exc, int] */
  avgSpeed: [number, number];
  /** BonusGForces / PenaltyLateralGs [exc, int, nau] */
  gForces: [number, number, number];
  /** BonusTurns [exc, int, nau] */
  turns: [number, number, number];
  /** BonusDrops [exc, int, nau] */
  drops: [number, number, number];
  /** RequirementDropHeight threshold, z-steps */
  reqDropHeight: number;
  /** RequirementNegativeGs threshold, 2dp fixed */
  reqNegativeGs: number;
  /** RequirementLength threshold in length units (null = no such modifier) */
  reqLength: number | null;
  /** RequirementNumDrops threshold (null = no such modifier) */
  reqNumDrops: number | null;
  /** RatingsData.RelaxRequirementsIfInversions */
  relaxIfInversions: boolean;
}

// Ported verbatim from the RTD RatingsData blocks. Shared across all three:
// BonusTrainLength 187245, BonusMaxSpeed { 44281, 88562, 35424 },
// BonusDuration 26214 (threshold 150), RequirementMaxSpeed 0xA0000 (22.5 mph),
// RequirementNumDrops/DropHeight per type.
const RATINGS_TABLES: Record<CoasterType, RatingsTable> = {
  // ride/rtd/coaster/WoodenRollerCoaster.h:63-92
  wooden: {
    base: [320, 260, 200],
    length: 873,
    maxSpeed: [44281, 88562, 35424],
    avgSpeed: [364088, 655360],
    gForces: [40960, 34555, 49648],
    turns: [26749, 43458, 45749],
    drops: [40777, 46811, 49152],
    reqDropHeight: 12,
    reqNegativeGs: 10,
    reqLength: 0x1720000 >> 16,
    reqNumDrops: 2,
    relaxIfInversions: false,
  },
  // ride/rtd/coaster/LoopingRollerCoaster.h:64-91
  steel: {
    base: [300, 50, 20],
    length: 764,
    maxSpeed: [44281, 88562, 35424],
    avgSpeed: [291271, 436906],
    gForces: [24576, 35746, 49648],
    turns: [26749, 34767, 45749],
    drops: [29127, 46811, 49152],
    reqDropHeight: 14,
    reqNegativeGs: 10,
    reqLength: null,
    reqNumDrops: 2,
    relaxIfInversions: true,
  },
  // ride/rtd/coaster/InvertedRollerCoaster.h:65-91
  inverted: {
    base: [360, 280, 320],
    length: 764,
    maxSpeed: [44281, 88562, 35424],
    avgSpeed: [291271, 436906],
    gForces: [24576, 29789, 55606],
    turns: [26749, 29552, 57186],
    drops: [29127, 39009, 49152],
    reqDropHeight: 12,
    reqNegativeGs: 30,
    reqLength: null,
    reqNumDrops: null,
    relaxIfInversions: true,
  },
};

const TRAIN_LENGTH_BONUS = 187245; // BonusTrainLength, all coaster RTDs
const DURATION_BONUS = 26214; // BonusDuration excitement, threshold 150
const DURATION_THRESHOLD = 150;
const LENGTH_THRESHOLD = 6000; // BonusLength threshold, all coaster RTDs
const REQ_MAX_SPEED_MPH = 0xa0000 / RCT2_VELOCITY_PER_MPH; // 22.5 mph

export interface RateCoasterOpts {
  /** which RTD ratings table to use (default 'wooden' — <Coaster>'s default) */
  type?: CoasterType;
  /** bank forwarded to the replay frames — pass what you BUILT with
   *  (coasterBankCap(type, bank)) so the forces match the ride */
  bank?: number;
  /** pre-computed frames (skips the resample) */
  frames?: SplineFrames;
  /** cars per train — BonusTrainLength (default 3, <Coaster>'s default) */
  cars?: number;
  /** BonusScenery sub-score, 0-40 (default 0 — the DS has no tile scenery map) */
  sceneryScore?: number;
  /** world units per RCT2 TILE for the unit mapping (default 1 — see the
   *  header: the kit authors its pieces roughly one per tile). Raise it to read
   *  a layout as a smaller model, lower it to read it as a bigger one. */
  tileUnits?: number;
}

/**
 * RCT2-style ride ratings for a compiled spline circuit (`compileTrackPieces`
 * points, or any closed control-point list). Runs the shared energy-paced
 * force replay (`replayCoasterForces` — the SAME physics as `run()` and
 * validatePark's crash gate), measures the circuit the way OpenRCT2's ride
 * test does, then applies the type's RatingsData modifier chain from
 * RideRatings.cpp:876-1051 in order: BonusLength/TrainLength/MaxSpeed/
 * AverageSpeed/Duration/GForces/Turns/Drops, the Requirement* halvings
 * (drop height, max speed, negative Gs, length, drop count), the air-time
 * adjustment (RideRatings.cpp:1293-1310), PenaltyLateralGs
 * (RideRatings.cpp:2215-2245) and finally the universal intensity penalty
 * (RideRatings.cpp:1318-1330 — excitement loses a quarter per intensity band
 * over 10.00). See the unit-mapping header above for the world-unit → RCT2
 * conversions and `SIMPLIFIED` below for what is deliberately left out.
 *
 * SIMPLIFIED vs RideRatings.cpp: no BonusSheltered / BonusProximity (DS
 * circuits are open-air and there is no tile map to score against —
 * `sceneryScore` covers BonusScenery by hand), no BonusSynchronisation /
 * BonusReversedTrains / helices / water-splash special elements, and no
 * rideEntry excitement/intensity/nausea multipliers (those live on the vehicle
 * OBJECT, which the DS has no analogue for). Pure and deterministic.
 */
export function rateCoaster(points: [number, number, number][], opts: RateCoasterOpts = {}): CoasterRatings {
  const t = THREE; // same three namespace the bundle renders with
  const type = opts.type ?? 'wooden';
  const tab = RATINGS_TABLES[type];
  const bank = coasterBankCap(type, opts.bank);
  const rep = replayCoasterForces(t, points, { bank, frames: opts.frames });
  const { frames, total, N } = rep.frames;
  const ds = total / N;

  // ---- inversion-element windows. RCT2 corkscrews/loops are FIXED multi-tile
  // TrackElemTypes with pre-baked verticalFactor tables, not free-form curves;
  // the kit's stand-in is a compact planar loop whose raw curvature (R ≈ 0.6 u)
  // would read tens of g. So — exactly as checkCoasterDesign exempts these
  // windows from its slope/bank sweeps — samples within ~2.8 arc-units of an
  // up-vector flip are excluded from the vertical-G peak, the air-time tally
  // and the drop scan; RCT2 pays for inversions through getInversionsRatings
  // (RideRatings.cpp:1520-1531) instead, which is what runs below. SIMPLIFIED.
  const invWin = Math.max(1, Math.round(2.8 / ds));
  const inInversion: boolean[] = new Array(N).fill(false);
  for (let i = 0; i < N; i += 1) {
    if (frames[i].up.y < 0.02) for (let k = -invWin; k <= invWin; k += 1) inInversion[(i + k + N) % N] = true;
  }

  // ---- measurement pass (Vehicle.cpp:470-520 UpdateMeasurements) ----------
  let maxSpeed = 0;
  let speedSum = 0;
  let maxPosVertG = 0;
  let maxNegVertG = 0;
  let airtimeSeconds = 0;
  rep.samples.forEach((s, i) => {
    if (s.v > maxSpeed) maxSpeed = s.v;
    speedSum += s.v;
    if (inInversion[i]) return;
    if (s.vertG > maxPosVertG) maxPosVertG = s.vertG;
    if (s.vertG < maxNegVertG) maxNegVertG = s.vertG;
    if (s.vertG <= 0) airtimeSeconds += ds / Math.max(0.2, s.v);
  });
  const avgSpeed = speedSum / N;
  const maxLatG = rep.worstLatAccel / 9.8;

  // ---- drops (Vehicle.cpp:658-700: a drop opens on entering DOWN track and
  // closes with |Δz| when it levels out; sub-0.12 u ripples are spline noise,
  // not RCT2 track pieces, so they are discarded again) ---------------------
  const DOWN_EPS = 0.04; // ≈2.3° — below this the spline is level track
  const MIN_DROP = 0.12;
  let dropCount = 0;
  let highestDrop = 0;
  let totalDrop = 0;
  let falling = false;
  let dropTop = 0;
  for (let k = 0; k <= N; k += 1) {
    const f = frames[k % N];
    const goingDown = f.fwd.y < -DOWN_EPS && !inInversion[k % N];
    if (!falling && goingDown) {
      falling = true;
      dropTop = f.p.y;
    } else if (falling && !goingDown) {
      falling = false;
      const d = dropTop - f.p.y;
      if (d >= MIN_DROP) {
        dropCount += 1;
        totalDrop += d;
        if (d > highestDrop) highestDrop = d;
      }
    }
  }

  // ---- inversions: maximal runs with the up-vector flipped ----------------
  let inversions = 0;
  let inverted = false;
  for (let k = 0; k <= N; k += 1) {
    const up = frames[k % N].up.y;
    if (!inverted && up < -0.3) inverted = true;
    else if (inverted && up > 0) {
      inverted = false;
      inversions += 1;
    }
  }

  // ---- turns bucketed like RCT2 (Ride.cpp:4249-4328). A turn is a maximal
  // same-signed run of curvature tight enough to be a track curve; its length
  // in track ELEMENTS is its arc length in world units (1 u = 1 tile). RCT2
  // flags a piece banked AND sloped independently; here each turn lands in
  // exactly ONE bucket, sloped taking precedence over banked (SIMPLIFIED).
  const turns: CoasterTurnCounts = { flat: [0, 0, 0], banked: [0, 0, 0], sloped: [0, 0, 0, 0] };
  const perTileT = Math.max(0.01, opts.tileUnits ?? 1);
  {
    const K_MIN = 0.12; // radius under ~8 u — anything wider is a straight
    let runLen = 0;
    let runSign = 0;
    let rollSum = 0;
    let pitchSum = 0;
    let n = 0;
    const flush = () => {
      if (!n || runLen < 0.5) {
        runLen = 0;
        runSign = 0;
        rollSum = 0;
        pitchSum = 0;
        n = 0;
        return;
      }
      const elements = Math.max(1, Math.round(runLen / perTileT));
      const sloped = pitchSum / n > 0.17; // ≈10° mean pitch
      const banked = rollSum / n > 0.09; // ≈5° mean bank
      if (sloped) turns.sloped[Math.min(4, elements) - 1] += 1;
      else {
        const bucket = Math.min(3, elements) - 1;
        (banked ? turns.banked : turns.flat)[bucket] += 1;
      }
      runLen = 0;
      runSign = 0;
      rollSum = 0;
      pitchSum = 0;
      n = 0;
    };
    for (let k = 0; k <= N; k += 1) {
      const i = k % N;
      const s = rep.samples[i];
      const f = frames[i];
      // signed turn direction from the horizontal cross product of neighbours
      const a = frames[(i - 1 + N) % N].fwd;
      const b = frames[(i + 1) % N].fwd;
      const sign = Math.sign(a.z * b.x - a.x * b.z) || runSign;
      if (s.kH >= K_MIN && (runSign === 0 || sign === runSign)) {
        runSign = sign;
        runLen += ds;
        rollSum += Math.abs(s.roll);
        pitchSum += Math.abs(f.fwd.y);
        n += 1;
      } else if (s.kH >= K_MIN) {
        flush(); // curvature reversed — a new turn starts here
        runSign = sign;
        runLen = ds;
        rollSum = Math.abs(s.roll);
        pitchSum = Math.abs(f.fwd.y);
        n = 1;
      } else flush();
    }
    flush();
  }

  // ---- RCT2 units --------------------------------------------------------
  const perTile = Math.max(0.01, opts.tileUnits ?? 1);
  const rctLength = Math.round((total / perTile) * RCT2_LENGTH_PER_TILE);
  const maxMph = (maxSpeed / perTile) * RCT2_MPH_PER_TILE_PER_SEC;
  const avgMph = (avgSpeed / perTile) * RCT2_MPH_PER_TILE_PER_SEC;
  const maxSpeedMod = Math.floor((maxMph * 4) / 9); // ride.maxSpeed >> 16
  const avgSpeedMod = Math.floor((avgMph * 4) / 9);
  const rctDropHeight = Math.floor((highestDrop / perTile) * RCT2_ZSTEPS_PER_TILE);
  const rctDuration = Math.round(rep.duration / RCT2_SEC_PER_DURATION);
  const airTimeTicks = Math.round(airtimeSeconds * RCT2_TICKS_PER_SEC);
  const posG = Math.round(maxPosVertG * 100); // fixed16_2dp
  const negG = Math.round(maxNegVertG * 100);
  const latG = Math.round(maxLatG * 100);

  // ---- the modifier chain (RideRatings.cpp:876-1051) ---------------------
  const S16 = 32767;
  let exc = tab.base[0];
  let inten = tab.base[1];
  let naus = tab.base[2];
  /** RideRatingsAdd — overflow-protected add (RideRatings.cpp:1815-1823) */
  const add = (de: number, di: number, dn: number) => {
    exc = Math.max(0, Math.min(S16, exc + de));
    inten = Math.max(0, Math.min(S16, inten + di));
    naus = Math.max(0, Math.min(S16, naus + dn));
  };
  const sh = (x: number, m: number) => (x * m) >> 16;

  // BonusLength / BonusTrainLength / BonusMaxSpeed / BonusAverageSpeed / BonusDuration
  add(sh(Math.min(rctLength, LENGTH_THRESHOLD), tab.length), 0, 0);
  add(sh(Math.max(0, (opts.cars ?? 3) - 1), TRAIN_LENGTH_BONUS), 0, 0);
  add(sh(maxSpeedMod, tab.maxSpeed[0]), sh(maxSpeedMod, tab.maxSpeed[1]), sh(maxSpeedMod, tab.maxSpeed[2]));
  add(sh(avgSpeedMod, tab.avgSpeed[0]), sh(avgSpeedMod, tab.avgSpeed[1]), 0);
  add(sh(Math.min(rctDuration, DURATION_THRESHOLD), DURATION_BONUS), 0, 0);

  // BonusGForces — ride_ratings_get_gforce_ratings (RideRatings.cpp:1675-1715)
  const gforceSub = (): [number, number, number] => {
    let e = sh(posG, 5242);
    let i = sh(posG, 52428);
    let n = sh(posG, 17039);
    e += sh(Math.max(-250, Math.min(0, negG)), -15728);
    i += sh(negG - 100, -52428);
    n += sh(negG - 100, -14563);
    e += sh(Math.min(150, latG), 26214);
    i += latG;
    n += sh(latG, 21845);
    return [e, i, n];
  };
  {
    const [e, i, n] = gforceSub();
    add(sh(e, tab.gForces[0]), sh(i, tab.gForces[1]), sh(n, tab.gForces[2]));
  }

  // BonusTurns — ride_ratings_get_turns_ratings (RideRatings.cpp:1598-1630):
  // flat + banked + sloped turn ratings + the inversions rating
  {
    const [f1, f2, f3] = turns.flat;
    const [b1, b2, b3] = turns.banked;
    const [s1, s2, s3, s4] = turns.sloped;
    let e = sh(f3, 0x28000) + sh(f2, 0x30000) + sh(f1, 63421); // get_flat_turns_rating
    let i = sh(f3, 81920) + sh(f2, 49152) + sh(f1, 21140);
    let n = sh(f3, 0x50000) + sh(f2, 0x32000) + sh(f1, 42281);
    e += sh(b3, 0x3c000) + sh(b2, 0x3c000) + sh(b1, 73992); // get_banked_turns_rating
    i += sh(b3, 0x14000) + sh(b2, 49152) + sh(b1, 21140);
    n += sh(b3, 0x50000) + sh(b2, 0x32000) + sh(b1, 48623);
    e += sh(Math.min(s4, 4), 0x78000) + sh(Math.min(s3, 6), 273066); // get_sloped_turns_rating
    e += sh(Math.min(s2, 6), 0x3aaaa) + sh(Math.min(s1, 7), 187245);
    n += sh(Math.min(s4, 8), 0x78000);
    e += sh(Math.min(inversions, 6), 0x1aaaaa); // getInversionsRatings
    i += sh(inversions, 0x320000);
    n += sh(inversions, 0x15aaaa);
    add(sh(e, tab.turns[0]), sh(i, tab.turns[1]), sh(n, tab.turns[2]));
  }

  // BonusDrops — ride_ratings_get_drop_ratings (RideRatings.cpp:1721-1740)
  {
    let e = sh(Math.min(9, dropCount), 728177);
    let i = sh(dropCount, 928426);
    let n = sh(dropCount, 655360);
    e += sh(rctDropHeight * 2, 16000);
    i += sh(rctDropHeight * 2, 32000);
    n += sh(rctDropHeight * 2, 10240);
    add(sh(e, tab.drops[0]), sh(i, tab.drops[1]), sh(n, tab.drops[2]));
  }

  // BonusScenery (RideRatings.cpp:2085-2088) — hand-fed, 0 by default
  if (opts.sceneryScore) add(sh(Math.max(0, Math.min(40, opts.sceneryScore)), type === 'wooden' ? 11155 : 6693), 0, 0);

  // Requirement* halvings (RideRatings.cpp:2091-2140). RelaxRequirementsIfInversions
  // exempts the drop-height / drop-count / negative-G gates on inverting layouts.
  const halve = () => {
    exc = Math.floor(exc / 2);
    inten = Math.floor(inten / 2);
    naus = Math.floor(naus / 2);
  };
  if (tab.reqLength !== null && rctLength < tab.reqLength) halve();
  if (maxMph < REQ_MAX_SPEED_MPH) halve();
  if (!(inversions > 0 && tab.relaxIfInversions)) {
    if (rctDropHeight < tab.reqDropHeight) halve();
    if (tab.reqNumDrops !== null && dropCount < tab.reqNumDrops) halve();
    if (negG >= tab.reqNegativeGs) halve(); // no airtime at all
  }

  // PenaltyLateralGs — ride_ratings_get_excessive_lateral_g_penalty
  // (RideRatings.cpp:2215-2245). Unreachable in practice: validatePark fails
  // any circuit past 1.27 g, but a hand-built layout can still get here.
  if (latG > 280) {
    let pe = 0;
    let pi = 375;
    let pn = 200;
    if (latG > 310) {
      pe = sh(posG, 5242) + sh(Math.max(-250, Math.min(0, negG)), -15728) + sh(Math.min(150, latG), 26214);
      pe = -Math.floor(pe / 2);
      pi = 1225;
      pn = 600;
    }
    add(sh(pe, tab.gForces[0]), sh(pi, tab.gForces[1]), sh(pn, tab.gForces[2]));
  }

  // air-time adjustment (RideRatings.cpp:1293-1310, RtdFlag::hasAirTime)
  add(Math.floor(Math.min(airTimeTicks, 200) / 8), 0, Math.floor(airTimeTicks / 16));

  // universal intensity penalty (RideRatings.cpp:1318-1330)
  for (const bound of [1000, 1100, 1200, 1320, 1450]) if (inten >= bound) exc -= Math.floor(exc / 4);
  exc = Math.max(0, exc);

  const r2 = (v: number) => Math.round(v * 100) / 100;
  return {
    excitement: r2(exc / 100),
    intensity: r2(inten / 100),
    nausea: r2(naus / 100),
    maxSpeed: r2(maxSpeed),
    avgSpeed: r2(avgSpeed),
    maxPosVertG: r2(maxPosVertG),
    maxNegVertG: r2(maxNegVertG),
    maxLatG: r2(maxLatG),
    highestDrop: r2(highestDrop),
    totalDrop: r2(totalDrop),
    dropCount,
    airtimeSeconds: r2(airtimeSeconds),
    inversions,
    length: r2(total),
    duration: r2(rep.duration),
    ratingBand: bandOfRating(inten),
    nauseaBand: bandOfRating(naus),
    nauseaExtreme: naus >= 800,
    type,
    turns,
  };
}

/** Closed quad-strip ribbon swept between two side/height offsets of the frames. */
export function ribbon(
  t: typeof THREE,
  frames: SplineFrame[],
  sA: number,
  hA: number,
  sB: number,
  hB: number,
  material: THREE.Material,
  vRep = 0.35,
) {
  const n = frames.length;
  const pos: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  for (let i = 0; i <= n; i++) {
    const f = frames[i % n];
    const a = f.p.clone().addScaledVector(f.side, sA).addScaledVector(f.up, hA);
    const b = f.p.clone().addScaledVector(f.side, sB).addScaledVector(f.up, hB);
    pos.push(a.x, a.y, a.z, b.x, b.y, b.z);
    uv.push(0, i * vRep, 1, i * vRep);
  }
  for (let i = 0; i < n; i++) {
    const k = i * 2;
    idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2);
  }
  const geo = new t.BufferGeometry();
  geo.setAttribute('position', new t.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new t.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  const mesh = new t.Mesh(geo, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

/** Closed tube swept along a side/height offset chain of the frames. */
export function railTube(
  t: typeof THREE,
  frames: SplineFrame[],
  s: number,
  h: number,
  r: number,
  material: THREE.Material,
) {
  const off = frames.map((f) => f.p.clone().addScaledVector(f.side, s).addScaledVector(f.up, h));
  const c = new t.CatmullRomCurve3(off, true);
  const tube = new t.Mesh(new t.TubeGeometry(c, frames.length, r, 6, true), material);
  tube.castShadow = true;
  return tube;
}

function dsMat(t: typeof THREE, color: number, o: Parameters<typeof mat>[2] = {}) {
  const m = mat(t, color, o);
  m.side = t.DoubleSide;
  return m;
}

/**
 * Build any spline ride from 3D control points. 'coaster' delegates the mesh
 * to buildSplineCoaster and adds RCT2 construction rules + crash physics on
 * top (checkCoasterDesign runs automatically, warning per violation just like
 * validateSpline); 'flume' sweeps a wooden U-channel trough with a water
 * strip (banking capped gentle), 'rapids' a rocky stone channel (water strip
 * height via opts.waterY), 'bobsled' an icy hard-banked half-pipe chute with
 * the same 1.5 g derail guard, and 'gokart' a flat asphalt ribbon with
 * red/white kerbs (near-constant speed, laneOffset lanes). All profiles share
 * the parallel-transport frames, ground-aware supports and lift-hill
 * detection — and every assembled curve passes through validateSpline.
 */
export function buildRideSpline(
  t: typeof THREE,
  controlPoints: [number, number, number][],
  opts: RideSplineOpts = {},
): RideSpline {
  const profile = opts.profile ?? 'coaster';
  const ctl = newCtl();
  const ctlApi = {
    setBrakesFailure: (v: boolean) => { ctl.brakesFailure = v; },
    crashed: () => ctl.isCrashed,
    forceCrash: () => { ctl.forced = true; },
    resetCrash: () => { ctl.resetRequested = true; },
  };

  if (profile === 'coaster') {
    const type: CoasterType = opts.type ?? (opts.wood ? 'wooden' : 'steel');
    // banking saturates at the type's bankLimit (round-3 safeguard) — geometry,
    // frames and design check all build with the SAME clamped cap
    const bank = coasterBankCap(type, opts.bank);
    const c = buildSplineCoaster(t, controlPoints, {
      wood: opts.wood ?? type === 'wooden',
      bank,
      supportEvery: opts.supportEvery,
      groundAt: opts.groundAt,
      colours: opts.colours,
    });
    const valid = validateSpline(t, c.curve);
    if (!valid.ok)
      console.warn(
        `SplineRideKit: spline self-intersects — increase clearance (worst ${valid.worst.toFixed(2)} at u=${valid.at[0].toFixed(2)}/${valid.at[1].toFixed(2)})`,
      );
    // same frame parameters as buildSplineCoaster — identical deterministic frames
    const fb = computeSplineFrames(t, controlPoints, { bank });
    const design = checkCoasterDesign(t, c.curve, { type, frames: fb });
    design.violations.forEach((v) =>
      console.warn(
        `SplineRideKit: coaster design ${v.warning ? 'warning' : 'violation'} [${v.kind}] at u=${v.at.toFixed(2)} — ${v.detail}`,
      ),
    );
    const { liftStart, liftLen, onLift } = detectLiftHill(fb.P);
    let maxY = 0;
    for (const p of fb.P) maxY = Math.max(maxY, p.y);
    const run = makeGuardedRun(t, {
      group: c.group,
      frames: fb.frames,
      frameAt: c.frameAt,
      total: fb.total,
      N: fb.N,
      onLift,
      liftStart,
      liftLen,
      maxY,
      pace: 'energy',
      liftV: 1.5,
      defOffset: 0.195,
      defSpacing: 1.2,
      guard: true,
      groundAt: opts.groundAt,
      ctl,
    });
    return { group: c.group, curve: c.curve, frameAt: c.frameAt, run, valid, design, vehicleSchemes: opts.vehicleSchemes, ...ctlApi };
  }

  const tune = PROFILE_TUNE[profile];
  // water channels stay gentle and kart circuits flat, whatever the author asks
  const bank =
    profile === 'bobsled' ? opts.bank ?? tune.bankCap
    : profile === 'gokart' ? Math.min(opts.bank ?? tune.bankCap, tune.bankCap)
    : Math.min(opts.bank ?? tune.bankCap, 0.25);
  const { curve, total, N, P, frames, frameAt } = computeSplineFrames(t, controlPoints, {
    bank,
    bankGain: tune.bankGain,
  });

  const valid = validateSpline(t, curve);
  if (!valid.ok)
    console.warn(
      `SplineRideKit: spline self-intersects — increase clearance (worst ${valid.worst.toFixed(2)} at u=${valid.at[0].toFixed(2)}/${valid.at[1].toFixed(2)})`,
    );

  const group = new t.Group();

  // RCT2 TrackColour mapping per profile (ride/RideColour.h:19-24). Derived
  // tones use shade() at the stock ratios; all defaults are byte-identical.
  const col = opts.colours;

  if (profile === 'flume') {
    // brown wooden U-channel trough: floor (main), two side walls (main
    // darkened at the stock 0x4a3018:0x5a3d22 ≈ 0.82 ratio), rim rails + ribs
    // (additional)
    const FLOOR = col?.main ?? 0x5a3d22;
    const WALL = col !== undefined ? shade(col.main, 0.82) : 0x4a3018;
    const RIM = col?.additional ?? 0x6b4626;
    group.add(ribbon(t, frames, -0.45, -0.1, 0.45, -0.1, dsMat(t, FLOOR, { tex: 'wood', rough: 0.85 })));
    [-1, 1].forEach((s) => {
      group.add(ribbon(t, frames, s * 0.45, -0.12, s * 0.45, 0.18, dsMat(t, WALL, { tex: 'wood', rough: 0.85 })));
      group.add(railTube(t, frames, s * 0.46, 0.19, 0.045, mat(t, RIM, { tex: 'wood', repeat: [1, 36], rough: 0.9 })));
    });
    // water strip riding inside the trough — matched to WaterTile's NATURAL
    // desaturated palette (2026-07 THIRD pass: 0x2286c8 navy read dull,
    // 0x35c2e8 turquoise read neon, 0x4496a7 still read "tropical pool";
    // this is a muted, less-saturated blue-grey, plus a dim emissive so the
    // strip doesn't glow like a lit tank under the transparent ribbon).
    // rough 0.8: matte like the shader water — the old 0.2 gloss caught the
    // sun as near-white patches that read as plastic, not water
    group.add(ribbon(t, frames, -0.36, -0.02, 0.36, -0.02, dsMat(t, 0x447588, { rough: 0.8, opacity: 0.9, emissive: 0x1b2b37 })));
    // wooden ribs under the floor
    for (let i = 0; i < N; i += 8) {
      const f = frames[i];
      const rib = box(t, [1.06, 0.06, 0.14], col?.additional ?? 0x6b4626, [0, 0, 0], { tex: 'wood', repeat: [3, 1], rough: 0.9 });
      rib.position.copy(f.p).addScaledVector(f.up, -0.14);
      rib.setRotationFromMatrix(new t.Matrix4().makeBasis(f.side, f.up, new t.Vector3().crossVectors(f.side, f.up)));
      group.add(rib);
    }
  } else if (profile === 'rapids') {
    // rocky stone channel: rough floor (main), boulder-lined walls (main
    // darkened at the stock 0x76736a:0x8a8578 ≈ 0.87 ratio); the natural
    // boulders themselves stay stone-coloured
    const STONE = col?.main ?? 0x8a8578;
    const WALLS = col !== undefined ? shade(col.main, 0.87) : 0x76736a;
    group.add(ribbon(t, frames, -0.48, -0.1, 0.48, -0.1, dsMat(t, STONE, { tex: 'concrete', rough: 0.95 })));
    [-1, 1].forEach((s) => {
      group.add(ribbon(t, frames, s * 0.48, -0.12, s * 0.48, 0.22, dsMat(t, WALLS, { tex: 'concrete', rough: 0.95 })));
    });
    for (let i = 0; i < N; i += 7) {
      const f = frames[i];
      const s = i % 14 === 0 ? 1 : -1;
      const r = 0.13 + 0.1 * Math.abs(Math.sin(i * 2.3));
      const rock = ball(t, r, i % 21 === 0 ? 0x8d887c : 0x7d7a70, [0, 0, 0], { tex: 'concrete', flat: true, rough: 1 });
      // boulders line the OUTSIDE of the walls: per-rock offset keeps every
      // inner surface exactly 0.03 outside the 0.48 wall plane, clear of the
      // raft envelope (outer radius 0.455) passing inside the channel
      rock.position.copy(f.p).addScaledVector(f.side, s * (0.51 + r)).addScaledVector(f.up, 0.02);
      rock.scale.y = 0.75;
      group.add(rock);
    }
    // channel water strip — opts.waterY raises/lowers it vs the centreline;
    // matched to WaterTile's NATURAL desaturated palette (2026-07 THIRD
    // pass: two prior bright-turquoise fixes still read neon/tropical-pool;
    // the shader water ribbon RiverRapids lays on top is transparent, so
    // this backing strip sets the channel's body colour, now a muted
    // blue-grey with a dim emissive). rough 0.85: matte — the old 0.25
    // gloss bounced the sun back as huge near-white cyan patches through
    // the transparent ribbon (gloss, not water)
    const waterH = opts.waterY ?? -0.02;
    group.add(ribbon(t, frames, -0.38, waterH, 0.38, waterH, dsMat(t, 0x447588, { rough: 0.85, opacity: 0.88, emissive: 0x1b2b37 })));
  } else if (profile === 'gokart') {
    // flat asphalt ribbon with painted red/white rumble-strip kerbs along both
    // edges. Each kerb is a CHORDED segment: its ends sit exactly on the
    // kerb centreline (ribbon half-width 0.55 minus half the 0.10 kerb width,
    // pulled 0.01 further in for curvature safety → ±0.49) at consecutive
    // frames, so blocks follow the curve, stay fully ON the ribbon (outer
    // face 0.54, chord sag only pulls INWARD) and butt end-to-end with a
    // small overlap — no splayed corners, no gaps on the hairpin outside.
    group.add(ribbon(t, frames, -0.55, 0, 0.55, 0, dsMat(t, col?.main ?? 0x4a4d52, { tex: 'asphalt', rough: 0.95 }), 0.5));
    const K = 2; // frames per kerb segment
    const kerbUp = new t.Vector3();
    const kerbDir = new t.Vector3();
    const kerbSide = new t.Vector3();
    for (let i = 0; i < N; i += K) {
      const f0 = frames[i];
      const f1 = frames[(i + K) % N];
      const red = Math.floor(i / K) % 2 === 0;
      [-1, 1].forEach((s) => {
        const a = f0.p.clone().addScaledVector(f0.side, s * 0.49);
        const b = f1.p.clone().addScaledVector(f1.side, s * 0.49);
        kerbDir.subVectors(b, a);
        const len = kerbDir.length();
        kerbDir.normalize();
        kerbUp.addVectors(f0.up, f1.up).normalize();
        kerbUp.addScaledVector(kerbDir, -kerbUp.dot(kerbDir)).normalize();
        kerbSide.crossVectors(kerbUp, kerbDir).normalize();
        // 0.035 tall, embedded ~0.005 → reads as a strip painted ~0.03 proud;
        // alternate blocks sit 1.2mm apart so their overlapped ends never
        // share a coplanar top face (no z-fighting at the joints)
        const lift = 0.0125 + (red ? 0.0006 : -0.0006);
        // painted kerb: the red blocks take TrackColour.additional, the white
        // blocks stay white (RCT2 kerbs alternate scheme colour with white)
        const kerb = box(t, [0.1, 0.035, len + 0.02], red === (s > 0) ? col?.additional ?? 0xb03030 : 0xe6e3dc, [0, 0, 0], { tex: 'plastic', rough: 0.6 });
        kerb.position.copy(a).add(b).multiplyScalar(0.5).addScaledVector(kerbUp, lift);
        kerb.setRotationFromMatrix(new t.Matrix4().makeBasis(kerbSide, kerbUp, kerbDir));
        group.add(kerb);
      });
    }
    // gentle slope cap: go-kart track tables have gentle slopes only
    let worstPitch = 0;
    for (const f of frames) worstPitch = Math.max(worstPitch, Math.abs(Math.asin(Math.max(-1, Math.min(1, f.fwd.y)))));
    if (worstPitch > 25 * DEG + TOL)
      console.warn(`SplineRideKit: gokart circuit reaches ${(worstPitch / DEG).toFixed(0)}° — karts only climb gentle (≤25°) slopes`);
  } else {
    // bobsled: icy half-pipe chute — flat floor + steeply angled side plates,
    // pale-blue-tinted plastic texture + bump for a sheened, rutted ice look.
    // The ICE is never recoloured; TrackColour.additional paints the rim
    // rails and (shaded at the stock ratios) the spine + crossribs.
    const RIMRAIL = col?.additional ?? 0x8b8f96;
    const SPINE = col !== undefined ? shade(col.additional, 0.67) : 0x5b6068; // stock 0x5b6068 ≈ 0.67·0x8b8f96
    const RIB = col !== undefined ? shade(col.additional, 0.55) : 0x4a4e55; // stock 0x4a4e55 ≈ 0.55·0x8b8f96
    group.add(ribbon(t, frames, -0.34, -0.05, 0.34, -0.05, dsMat(t, 0xdfeaf2, { tex: 'plastic', repeat: [2, 1], rough: 0.22, metal: 0.05, bump: 0.012 })));
    [-1, 1].forEach((s) => {
      group.add(ribbon(t, frames, s * 0.34, -0.05, s * 0.72, 0.26, dsMat(t, 0xcfdeea, { tex: 'plastic', repeat: [2, 1], rough: 0.25, metal: 0.05, bump: 0.012 })));
      group.add(railTube(t, frames, s * 0.74, 0.27, 0.04, mat(t, RIMRAIL, { tex: 'metal', repeat: [1, 48], metal: 0.75, rough: 0.35 })));
    });
    // steel spine + crossribs carrying the chute
    group.add(railTube(t, frames, 0, -0.16, 0.06, mat(t, SPINE, { tex: 'metal', repeat: [1, 36], metal: 0.7, rough: 0.45 })));
    for (let i = 0; i < N; i += 8) {
      const f = frames[i];
      const rib = box(t, [1.42, 0.05, 0.12], RIB, [0, 0, 0], { tex: 'metal', repeat: [3, 1], rough: 0.6, metal: 0.5 });
      rib.position.copy(f.p).addScaledVector(f.up, -0.1);
      rib.setRotationFromMatrix(new t.Matrix4().makeBasis(f.side, f.up, new t.Vector3().crossVectors(f.side, f.up)));
      group.add(rib);
    }
  }

  // ---- lift hill: chain/belt strip up the tallest climb (not for karts) ----
  const { liftStart, liftLen, onLift } = detectLiftHill(P);
  if (liftLen >= 8 && profile !== 'gokart') {
    // Flume + bobsled use TWIN taut side chains at ±0.30 (r 0.02): a single
    // centreline chain would breach both hull undersides (log bottom -0.10 /
    // sled plate -0.02 vs a centreline chain top of -0.042/+0.013). At the
    // chains' inner edge |x| = 0.28 the widest log hull (radius 0.3 riding at
    // offset 0.2) is up at y = +0.093 — 0.09 above the flume chain top of
    // 0.0 — and the bobsled body's half-width 0.21 never reaches them
    // laterally. Rapids keeps the original single centreline belt: the raft
    // deck bottom (+0.095) clears its -0.042 top by 0.137.
    const sides = profile === 'rapids' ? [0] : [-1, 1];
    const off = 0.3;
    const h = profile === 'bobsled' ? -0.03 : profile === 'rapids' ? -0.075 : -0.02;
    const r = profile === 'rapids' ? 0.033 : 0.02;
    sides.forEach((s) => {
      const chainPts: THREE.Vector3[] = [];
      for (let k = 0; k <= liftLen; k++) {
        const f = frames[(liftStart + k) % N];
        chainPts.push(f.p.clone().addScaledVector(f.side, s * off).addScaledVector(f.up, h));
      }
      const chain = new t.Mesh(
        new t.TubeGeometry(new t.CatmullRomCurve3(chainPts, false), liftLen * 2, r, 6, false),
        mat(t, 0x3a3d42, { tex: 'metal', repeat: [1, 24], metal: 0.6, rough: 0.5 }),
      );
      chain.castShadow = true;
      group.add(chain);
    });
  }

  // ---- shared ground-aware supports (TrackColour.supports tints them) ----
  addSplineSupports(t, group, frames, {
    supportEvery: opts.supportEvery ?? (profile === 'bobsled' ? 8 : 10),
    groundAt: opts.groundAt,
    wood: opts.wood ?? tune.woodDefault,
    colour: opts.colours?.supports,
  });

  // ---- runner: energy/drift/constant pacing + RCT2 crash guards ----
  let maxY = 0;
  for (const p of P) maxY = Math.max(maxY, p.y);
  const run = makeGuardedRun(t, {
    group,
    frames,
    frameAt,
    total,
    N,
    onLift,
    liftStart,
    liftLen,
    maxY,
    pace: tune.pace,
    liftV: tune.liftV,
    defOffset: tune.offset,
    defSpacing: 1.4,
    guard: tune.guard,
    groundAt: opts.groundAt,
    ctl,
  });

  return { group, curve, frameAt, run, valid, vehicleSchemes: opts.vehicleSchemes, ...ctlApi };
}

// ---------------------------------------------------------------------------
// Preview: four mini rides on one Stage — the SAME control-point workflow
// composing a coaster, a flume, a bobsled chute (all validated + legal) and a
// DERAIL DEMO: an unbanked hairpin coaster deliberately past the 1.5 g limit,
// whose train launches, derails at the hairpin and explodes, then resets.
// ---------------------------------------------------------------------------

const shift = (pts: [number, number, number][], dx: number, dz: number): [number, number, number][] =>
  pts.map(([x, y, z]) => [x + dx, y, z + dz]);

// mini layouts follow the RCT2 ramp grammar (see rampPoints): gentle lift,
// PLATEAU crest, descent spread over half the loop — max pitch rate 0.36
// rad/unit, well under the 0.55 pitchRate rule (verified numerically)
const MINI_COASTER: [number, number, number][] = [
  [-3.0, 0.55, -0.6], [-2.2, 0.55, -1.9], [-0.4, 0.9, -2.5], [1.5, 1.5, -2.1],
  [2.6, 1.5, -0.6], [2.55, 1.0, 1.0], [1.2, 0.6, 2.2], [-1.0, 0.55, 2.4],
  [-2.7, 0.55, 1.5], [-3.2, 0.55, 0.4],
];
const MINI_FLUME: [number, number, number][] = [
  [-2.6, 0.5, -1.6], [-0.2, 0.55, -2.3], [2.0, 1.5, -1.4], [2.6, 1.7, 0.5],
  [1.0, 0.4, 1.9], [-1.6, 0.5, 2.0], [-3.0, 0.55, 0.2],
];
const MINI_BOB: [number, number, number][] = [
  [-2.6, 1.8, -1.5], [-0.2, 1.6, -2.3], [2.0, 1.2, -1.5], [2.7, 0.9, 0.5],
  [0.9, 0.55, 2.0], [-1.7, 0.45, 1.9], [-3.0, 0.9, 0.1],
];
// deliberately DANGEROUS but design-legal: the slopes follow the ramp grammar
// (max pitch rate 0.47 rad/unit — passes pitchRate), but bank is forced to 0
// and a tight hairpin sits right after the descent — the effective lateral G
// at the apex is ~7.6 g, far past the 1.5 g no-upstop derail threshold
// (verified numerically; clearance still > 0.9). It demos LATERAL G, not slope.
const MINI_DERAIL: [number, number, number][] = [
  [-2.4, 0.55, -1.2], [-1.4, 0.55, -2.0], [0.4, 0.9, -2.4], [1.9, 1.4, -1.8],
  [2.8, 1.4, -0.3], [2.5, 0.9, 1.2], [1.6, 0.55, 1.9], [-0.2, 0.5, 0.9],
  [-1.9, 0.55, 1.6], [-3.0, 0.6, 0.0],
];

/** Compact log boat for the flume mini (hull radius 0.26 → wheelOffset 0.16).
 *  Exported as <TrackRide>'s default flume/rapids vehicle. */
export function buildMiniLog(t: typeof THREE): THREE.Group {
  const g = new t.Group();
  g.add(cyl(t, 0.26, 0.26, 1.0, 0x8a5a28, [0, 0, 0], { rotX: Math.PI / 2, tex: 'wood', repeat: [6, 2], rough: 0.9, seg: 16 }));
  g.add(ball(t, 0.26, 0x8a5a28, [0, 0, 0.5], { tex: 'wood', repeat: [3, 3], flat: true, rough: 0.9 }));
  g.add(ball(t, 0.26, 0x8a5a28, [0, 0, -0.5], { tex: 'wood', repeat: [3, 3], flat: true, rough: 0.9 }));
  g.add(box(t, [0.42, 0.05, 1.02], 0xe8cc80, [0, 0.14, 0], { rough: 0.7 }));
  g.add(box(t, [0.34, 0.16, 0.9], 0x2a1c10, [0, 0.1, 0], { rough: 0.9 }));
  [0.2, -0.2].forEach((z, i) => {
    const p = buildPeep(t, { skin: SKIN_TONES[(i + 1) % SKIN_TONES.length], shirt: SHIRTS[(i + 2) % SHIRTS.length], seated: true, expression: i ? 'happy' : 'surprised' });
    p.group.scale.setScalar(0.38);
    p.group.position.set(0, 0.02, z);
    g.add(p.group);
  });
  return g;
}

/** Compact bobsled for the chute mini (runner bottoms 0.045 below origin).
 *  Exported as <TrackRide>'s default bobsled vehicle. */
export function buildMiniSled(t: typeof THREE): THREE.Group {
  const g = new t.Group();
  g.add(box(t, [0.38, 0.2, 1.05], 0x2f5d8a, [0, 0.14, 0], { tex: 'plastic', repeat: [1, 3], rough: 0.3 }));
  g.add(box(t, [0.42, 0.09, 1.1], 0x24486e, [0, 0.03, 0], { tex: 'plastic', rough: 0.3 }));
  g.add(box(t, [0.26, 0.18, 0.6], 0x2e2e34, [0, 0.22, -0.02], { rough: 0.85 }));
  g.add(box(t, [0.4, 0.14, 0.32], 0xc8d0d8, [0, 0.17, 0.42], { rotX: -0.4, tex: 'metal', metal: 0.7, rough: 0.3 }));
  [-0.16, 0.16].forEach((x) => g.add(box(t, [0.04, 0.045, 1.14], 0xd0d4da, [x, -0.022, 0], { tex: 'metal', metal: 0.85, rough: 0.2 })));
  [0.2, -0.18].forEach((z, i) => {
    const p = buildPeep(t, { skin: SKIN_TONES[(i + 2) % SKIN_TONES.length], shirt: SHIRTS[[1, 2][i]], seated: true, expression: 'surprised' });
    p.group.scale.setScalar(0.36);
    p.group.position.set(0, 0.12, z);
    g.add(p.group);
  });
  return g;
}

/** Preview: coaster, flume, bobsled and the derail-demo minis from one kit. */
export function buildSplineRideKitScene(three: typeof THREE): { group: THREE.Group; update?: (time: number) => void } {
  const group = new three.Group();
  const update =
    ((t: typeof THREE, g: THREE.Group) => {
        // seeded RCT2 steel scheme for the coaster mini (white/white/lightBlue
        // — TwisterRollerCoaster.h:55); the other minis keep default colours
        const scheme = rideColourPreset(12, 'steel');
        const coaster = buildRideSpline(t, shift(MINI_COASTER, -5.4, -1.2), { profile: 'coaster', colours: scheme.track, vehicleSchemes: scheme.vehicles });
        const flume = buildRideSpline(t, shift(MINI_FLUME, 0, -1.2), { profile: 'flume' });
        const bob = buildRideSpline(t, shift(MINI_BOB, 5.4, -1.2), { profile: 'bobsled' });
        // derail demo: unbanked hairpin past 1.5 g — crashes every lap, resets
        const derail = buildRideSpline(t, shift(MINI_DERAIL, 0, 4.6), { profile: 'coaster', bank: 0 });
        [coaster, flume, bob, derail].forEach((r) => g.add(r.group));
        // 2-car trains in RCT2 order (run() leads with index 0): nose car
        // up front, tail-fairing car behind — no plain middle in a 2-car train
        const runCoaster = coaster.run(
          [buildCoasterCar(t, 'front', coaster.vehicleSchemes?.[0]), buildCoasterCar(t, 'end', coaster.vehicleSchemes?.[0])],
          { spacing: 1.15 },
        );
        const runFlume = flume.run([buildMiniLog(t)], { wheelOffset: 0.16 });
        const runBob = bob.run([buildMiniSled(t)]);
        const runDerail = derail.run([buildCoasterCar(t, 'front'), buildCoasterCar(t, 'end')], { spacing: 1.15 });
        let wreckAt: number | null = null;
        return (time) => {
          runCoaster(time);
          runFlume(time);
          runBob(time);
          runDerail(time);
          // let the wreck burn ~6 s, then clear it and launch the next train
          if (derail.crashed()) {
            if (wreckAt === null) wreckAt = time;
            else if (time - wreckAt > 6) {
              derail.resetCrash();
              wreckAt = null;
            }
          }
        };
      })(three, group) || undefined;
  return { group, update };
}

/** <SplineRideKit> — composable (components/Park/Context.md): mounts the scene at
 *  `position`/`rotation`/`scale` inside a <Park> or <ScenePreview>. */
export const SplineRideKit = composable('SplineRideKit', (t) => buildSplineRideKitScene(t));

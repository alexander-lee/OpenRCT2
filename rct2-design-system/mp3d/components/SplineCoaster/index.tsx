import React from 'react';
import * as THREE from 'three';
import { box, cyl, ball, mat, mergedBoxes, nightKOf } from '../Stage';
import type { MergedBoxSpec } from '../Stage';
import { buildCoasterCar, gateCarLights } from '../CoasterCar';
import { TrackScheme, rideColourPreset, shade } from '../ColorKit';
import { composableRide } from '../Park';
import { buildLiftChain } from './liftChain';

// ---------------------------------------------------------------------------
// SplineCoaster — freeform coaster, a sibling of TrackKit. Where TrackKit
// compiles an RCT2-style piece vocabulary, this builds the track straight from
// 3D control points: a closed centripetal Catmull-Rom spline, PARALLEL-
// TRANSPORT frames (the up-vector is carried along the tangent so it never
// flips at crests or in steep drops, with a gentle relaxation toward world-up
// and a loop-closure twist correction), and AUTO-BANKING computed from the
// horizontal curvature — the track leans into every turn, clamped and
// box-smoothed so banking eases in and out. Rendered with our aesthetics:
// twin steel rail tubes (metal texture), crossties, a steel spine or wooden
// stringers, a chain-lift strip up the tallest climb, and supports dropped to
// the ground (steel columns + concrete footers, or splayed wooden trestle
// bents with ledgers and X-bracing). The train is energy-paced: fast in the
// valleys, slow over the crests, constant crawl on the lift chain.
//
// On top of the derived roll there is an explicit ROLL CHANNEL (`roll`) for
// INVERSIONS — corkscrews and barrel rolls, which no set of control points can
// ask for, because a barrel roll's path is a straight line. It is STEEL ONLY.
// See the long note above `SplineRoll` for the API, the RCT2 element it maps
// onto, and how it interacts with the loop-closure twist correction.
//
// The spline math (frames / banking / lift detection / supports) is exported
// piecemeal so SplineRideKit can compose flumes, rapids and bobsled chutes
// from the exact same control-point workflow.
//
// NOTE — this module is deliberately PHYSICS-FREE. RCT2's construction rules
// (per-type slope/bank/inversion whitelists, station checks) and crash
// physics (1.5 g derailment, brake failure, ballistic explosions) live in
// SplineRideKit, which imports from here (one direction only, no cycles).
// Parks should build coasters through buildRideSpline('coaster') to get the
// rules + crash wiring; buildSplineCoaster alone is just track and a train.
// ---------------------------------------------------------------------------

const SAMPLES = 320; // frames pre-sampled along the loop
const GAP = 0.34; // half rail gauge (matches TrackKit / CoasterCar)
const GRAV = 9.8; // scene gravity for the energy-paced train

export interface SplineFrame {
  p: THREE.Vector3;
  fwd: THREE.Vector3;
  up: THREE.Vector3;
  side: THREE.Vector3;
}

export interface SplineCoasterOpts {
  /** coaster family for SplineRideKit's construction rules; here it only
   *  defaults the look: 'wooden' implies wood construction (default from
   *  `wood`: wood → 'wooden', else 'steel') */
  type?: 'wooden' | 'steel' | 'inverted';
  /** wooden stringers + trestle bents instead of steel spine + columns */
  wood?: boolean;
  railColor?: number;
  /** RCT2 TrackColour scheme (ride/RideColour.h:19-24): rails = main,
   *  ties + stringers/spine = additional, supports = supports. Overrides
   *  railColor; omitted = today's colours exactly. */
  colours?: TrackScheme;
  /** max bank angle in radians (default 0.7 ≈ 40°) */
  bank?: number;
  /** sample stride between supports (default 9) */
  supportEvery?: number;
  /** ground height sampler so supports land on terrain (default flat y=0) */
  groundAt?: (x: number, z: number) => number;
  /** inverting roll elements — corkscrews / barrel rolls. STEEL ONLY: dropped
   *  with a warning on a wooden build (see the gate in buildSplineCoaster). */
  roll?: SplineRoll[];
}

export interface RunOpts {
  /** overall pace multiplier (default 1) */
  speed?: number;
  /** distance between car centres in world units (default 1.2) */
  spacing?: number;
  /** lift of the car above the rail centreline (default 0.195 — wheel bottoms
   *  sit 0.15 below the car origin, rail tube tops +0.045: wheels ON the rails) */
  wheelOffset?: number;
}

/** MergedBoxSpec for a sloped strut between two points (box aligned a→b) —
 *  the batched twin of `barBetween` for static trestle legs/braces. */
function barSpec(
  t: typeof THREE,
  a: THREE.Vector3,
  b: THREE.Vector3,
  w: number,
  repeat?: [number, number],
): MergedBoxSpec {
  const dir = b.clone().sub(a);
  const len = dir.length();
  const q = new t.Quaternion().setFromUnitVectors(new t.Vector3(0, 1, 0), dir.normalize());
  const m = new t.Matrix4().makeRotationFromQuaternion(q);
  m.setPosition(a.clone().add(b).multiplyScalar(0.5));
  return { dims: [w, len, w], matrix: m, repeat };
}

/** Sloped strut between two points (box aligned a→b) — trestle legs/braces. */
export function barBetween(
  t: typeof THREE,
  a: THREE.Vector3,
  b: THREE.Vector3,
  w: number,
  color: number,
  o: Parameters<typeof box>[4] = {},
) {
  const dir = b.clone().sub(a);
  const len = dir.length();
  const m = box(t, [w, len, w], color, [0, 0, 0], o);
  m.position.copy(a).add(b).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(new t.Vector3(0, 1, 0), dir.normalize());
  return m;
}

// ---------------------------------------------------------------------------
// THE ROLL CHANNEL — how a corkscrew / barrel roll becomes expressible.
//
// Everything else in this module derives the frame from the control points
// alone: parallel transport fixes the up-vector up to one degree of freedom
// (the roll about the tangent) and curvature banking spends that freedom on
// leaning into turns. A full 360° roll is therefore NOT expressible — no set
// of control points can ask for it, because the path a barrel roll follows is
// a plain straight line. The one missing channel is roll itself.
//
// RCT2 SAYS THE SAME THING, and it is the reason this is a separate channel
// rather than more control points. The game's barrel roll is
// `TrackElemType::leftBarrelRollUpToDown = 174` and its three siblings
// (ride/ted/TrackElemType.h:192-195); its descriptor is
// `TrackData.cpp:8633`, and read the `.definition` field:
//
//     { TrackGroup::barrelRoll, TrackPitch::none, TrackPitch::none,
//       TrackRoll::upsideDown, TrackRoll::none, 0 }
//
// pitch NONE at both ends, no curve in the chain, `pieceLength = 96` = three
// 32-unit tiles — a straight, level, un-turned element whose ONLY change is
// roll, none → upsideDown (`…DownToUp`) and back (`…UpToDown`). So a full
// barrel roll is 6 tiles = 7.2 units at this kit's 1.2 units/tile, which is
// the default `span` below. Its forces are pre-baked constants
// (`verticalFactor EvaluatorConst<170>`, `lateralFactor EvaluatorConst<115>`),
// which is the same reason SplineRideKit's `inversionWindow` exempts inversion
// elements from the curvature-derived sweeps.
//
// WHY THIS SHAPE OF API, and what was rejected:
//   · a 4th component on the control points — rejected: it would change the
//     type of the exported SPLINE_COASTER_LAYOUT, and roll would then be tied
//     to point SPACING (a long straight has few points and could not roll).
//   · a raw `roll: (u) => number` callback — rejected: nothing can then check
//     the closure constraint below, and it is not serialisable.
//   · a declarative ELEMENT list, chosen: it mirrors RCT2's fixed-element
//     model, it is data (so a park can round-trip it), and it makes the one
//     hard constraint checkable — see next paragraph.
//
// THE INTERACTION WITH THE LOOP-CLOSURE TWIST CORRECTION. The correction
// transports the last frame onto the first, measures the residual twist `err`
// and spreads it as `err·i/(N−1)`; it reads the PURE transported ups, before
// banking. Roll is applied at the same point banking is, and both are
// rotations about the SAME axis T[i], so they commute and simply add to the
// frame's roll angle: the correction is untouched, bit for bit. What the roll
// channel DOES owe the closure is PERIODICITY. `frameAt` interpolates the
// sampled ups cyclically (i1 = (i0+1) % N), so the roll profile must satisfy
// roll(N−1) ≡ roll(0) (mod 2π) or the frame jumps at the seam. Each element
// here ramps from 0 to 2π·turns and then HOLDS — so the requirement collapses
// to: the signed turns must SUM TO AN INTEGER around the circuit. That is
// checked, and a non-integer total is refused with a warning rather than
// silently tearing the seam (a half roll is not a legal circuit on its own;
// RCT2's own element table only offers …DownToUp and …UpToDown as a pair).
//
// ROLL AND CURVATURE BANK ADD. They are the same degree of freedom, so a roll
// element belongs on STRAIGHT track — exactly where RCT2 puts its own, whose
// descriptor is straight and level by construction. Put one in a turn and the
// auto-bank will lean the barrel.
// ---------------------------------------------------------------------------

/** one inverting roll element — see the note above. */
export interface SplineRoll {
  /** element CENTRE as a fractional CONTROL-POINT index. Preferred: it moves
   *  with the layout, and it is how an author reads their own points array
   *  ("roll across points 10-13" → `atPoint: 11.5`). */
  atPoint?: number;
  /** element centre as a loop parameter u ∈ [0,1) — for callers that only
   *  have arc fractions (a compiler, a saved design). `atPoint` wins. */
  at?: number;
  /** roll in TURNS (1 = a full 360° barrel roll). The signed total over all
   *  elements MUST be an integer — see the closure note. Default 1. */
  turns?: number;
  /** which way the train rolls; 'R' (default) = clockwise seen from behind */
  dir?: 'L' | 'R';
  /** element arc length in world units. Default 7.2·|turns| — RCT2's own
   *  barrel roll is 3 tiles per 180° (TrackData.cpp:8633, pieceLength 96). */
  span?: number;
}

export interface SplineFramesOpts {
  /** max bank angle in radians (default 0.7 ≈ 40°) */
  bank?: number;
  /** horizontal-curvature → bank-angle gain (default 1.9) */
  bankGain?: number;
  /** explicit ROLL elements — corkscrews / barrel rolls. Omitted or empty:
   *  output is bit-identical to a build with no roll channel at all. */
  roll?: SplineRoll[];
}

export interface SplineFrames {
  curve: THREE.CatmullRomCurve3;
  /** total arc length of the closed loop */
  total: number;
  /** number of pre-sampled frames */
  N: number;
  /** uniform arc-length sample positions */
  P: THREE.Vector3[];
  /** the pre-sampled frames (frameAt(i / N)) */
  frames: SplineFrame[];
  frameAt: (u: number) => SplineFrame;
}

/**
 * Compile a roll-element list into a per-sample roll angle, or `null` when the
 * list cannot be honoured (see the closure note above). Pure; exported so a
 * probe can read the profile without rebuilding a coaster.
 *
 * The ramp is a SMOOTHSTEP in arc length — zero roll RATE at both ends, so the
 * element welds onto un-rolled track without a roll-rate step — and it HOLDS
 * at 2π·turns afterwards, which is a no-op rotation exactly when the total is
 * an integer. Distances are measured cyclically, so an element may straddle
 * u = 0. Peak rate is 1.5·2π·turns/span (1.31 rad/unit at the RCT2 default),
 * which is why the whole element must sit inside SplineRideKit's
 * `inversionWindow` exemption — it does: the window grows from the inverted
 * samples until the track is level and upright again.
 *
 * `anchor`/`P` are used only to resolve `atPoint` to an arc fraction, by
 * nearest uniform sample. Deliberately NOT via `curve.getUtoTmapping`: that
 * would rebuild `cacheArcLengths` at a different division count and silently
 * change every later `curve.getPointAt` — including `validateSpline`'s.
 */
export function rollProfile(
  roll: SplineRoll[],
  anchor: THREE.Vector3[],
  P: THREE.Vector3[],
  total: number,
): number[] | null {
  const N = P.length;
  const signed = (r: SplineRoll) => (r.dir === 'L' ? -1 : 1) * (r.turns ?? 1);
  const net = roll.reduce((s, r) => s + signed(r), 0);
  if (Math.abs(net - Math.round(net)) > 1e-9) {
    console.warn(
      `[SplineCoaster] roll channel IGNORED: the signed turns sum to ${net.toFixed(3)}, which is not a whole number of rotations — ` +
        `the circuit would not close (u=1 must meet u=0). RCT2's barrel roll ships as a PAIR of elements (…DownToUp + …UpToDown, ` +
        `TrackElemType.h:192-195) for exactly this reason; pair your half rolls, or use turns: 1.`,
    );
    return null;
  }
  /** arc fraction of a fractional control-point index, by nearest sample */
  const uOfPoint = (k: number): number => {
    const nearest = (j: number): number => {
      const a = anchor[((j % anchor.length) + anchor.length) % anchor.length];
      let bi = 0;
      let bd = Infinity;
      for (let i = 0; i < N; i++) {
        const d = P[i].distanceToSquared(a);
        if (d < bd) {
          bd = d;
          bi = i;
        }
      }
      return bi / N;
    };
    const k0 = Math.floor(k);
    const fr = k - k0;
    const u0 = nearest(k0);
    if (fr < 1e-9) return u0;
    let u1 = nearest(k0 + 1);
    if (u1 < u0) u1 += 1; // the pair straddles u = 0
    return (u0 + (u1 - u0) * fr) % 1;
  };

  const ds = total / N;
  const out = new Array<number>(N).fill(0);
  for (const r of roll) {
    const turns = signed(r);
    const span = Math.max(1e-3, r.span ?? 7.2 * Math.abs(turns));
    const uc = r.atPoint !== undefined ? uOfPoint(r.atPoint) : (((r.at ?? 0) % 1) + 1) % 1;
    const sc = uc * total;
    for (let i = 0; i < N; i++) {
      let d = i * ds - sc;
      d -= total * Math.round(d / total); // signed cyclic arc distance from the centre
      const sig = Math.min(1, Math.max(0, d / span + 0.5));
      out[i] += turns * 2 * Math.PI * sig * sig * (3 - 2 * sig);
    }
  }
  return out;
}

/**
 * Shared spline core: closed centripetal Catmull-Rom through the control
 * points, parallel-transport frames with loop-closure twist correction,
 * curvature-based banking (clamped to `bank`, box-smoothed) and the optional
 * explicit ROLL channel. Every spline ride (coaster, flume, rapids, bobsled)
 * is built on these frames.
 */
export function computeSplineFrames(
  t: typeof THREE,
  controlPoints: [number, number, number][],
  opts: SplineFramesOpts = {},
): SplineFrames {
  const bankMax = opts.bank ?? 0.7;
  const bankGain = opts.bankGain ?? 1.9;
  const N = SAMPLES;
  const anchor = controlPoints.map(([x, y, z]) => new t.Vector3(x, y, z));
  const curve = new t.CatmullRomCurve3(anchor, true, 'centripetal', 0.5);
  const total = curve.getLength();

  // ---- uniform arc-length samples: positions + tangents ----
  const P: THREE.Vector3[] = [];
  const T: THREE.Vector3[] = [];
  for (let i = 0; i < N; i++) {
    P.push(curve.getPointAt(i / N));
    T.push(curve.getTangentAt(i / N).normalize());
  }

  // ---- parallel-transport up-vectors (no flips over crests/drops) ----
  const worldUp = new t.Vector3(0, 1, 0);
  const ups: THREE.Vector3[] = [];
  const q = new t.Quaternion();
  const up = worldUp.clone().addScaledVector(T[0], -worldUp.dot(T[0])).normalize();
  for (let i = 0; i < N; i++) {
    if (i > 0) {
      q.setFromUnitVectors(T[i - 1], T[i]); // minimal rotation between tangents
      up.applyQuaternion(q);
    }
    // relax toward the projected world-up so the frame stays upright overall,
    // but ONLY when the tangent is not near-vertical and no flip would occur —
    // through steep drops pure transport carries the frame smoothly.
    const proj = worldUp.clone().addScaledVector(T[i], -worldUp.dot(T[i]));
    if (proj.lengthSq() > 0.09 && proj.dot(up) > 0) up.lerp(proj.normalize(), 0.08);
    up.addScaledVector(T[i], -up.dot(T[i])).normalize(); // re-orthogonalise
    ups.push(up.clone());
  }
  // loop closure: transport the last frame back onto the first, measure the
  // residual twist and distribute it along the loop so u=1 meets u=0 exactly.
  q.setFromUnitVectors(T[N - 1], T[0]);
  const wrapped = ups[N - 1].clone().applyQuaternion(q);
  const sideRef = new t.Vector3().crossVectors(ups[0], T[0]);
  const err = Math.atan2(wrapped.dot(sideRef), wrapped.dot(ups[0]));
  for (let i = 1; i < N; i++) ups[i].applyAxisAngle(T[i], (err * i) / (N - 1)).normalize();

  // ---- banking from horizontal curvature: lean into turns, clamped, smoothed ----
  const ds = total / N;
  const rawBank = new Array<number>(N).fill(0);
  for (let i = 0; i < N; i++) {
    const right = new t.Vector3().crossVectors(T[i], worldUp);
    if (right.lengthSq() < 1e-4) continue; // near-vertical: keep transported roll
    right.normalize();
    const kSide = T[(i + 1) % N].clone().sub(T[(i - 1 + N) % N]).dot(right) / (2 * ds);
    rawBank[i] = Math.max(-bankMax, Math.min(bankMax, Math.atan(bankGain * kSide)));
  }
  const bankAt = new Array<number>(N).fill(0);
  const R = 7; // box filter: banking eases in/out over ~2 track units
  for (let i = 0; i < N; i++) {
    let s = 0;
    for (let k = -R; k <= R; k++) s += rawBank[(i + k + N) % N];
    bankAt[i] = s / (2 * R + 1);
  }
  // ---- the explicit ROLL channel, added to the bank about the SAME axis ----
  // `null` when there is no channel (or it was refused), and the branch then
  // evaluates the byte-for-byte ORIGINAL expression rather than `bankAt[i] + 0`
  // — so "no roll spec ⇒ identical output" is structural instead of something
  // that merely happens to hold. (Measured: on the three shipped layouts the
  // naive `+ 0` is in fact bit-identical too, because no bankAt entry lands on
  // −0; the branch is what makes it true for every layout.)
  const rollAt = opts.roll?.length ? rollProfile(opts.roll, anchor, P, total) : null;
  for (let i = 0; i < N; i++)
    ups[i].applyAxisAngle(T[i], rollAt ? bankAt[i] + rollAt[i] : bankAt[i]).normalize();

  // ---- frame query (interpolates the pre-sampled frames) ----
  const frameAt = (u: number): SplineFrame => {
    const uu = ((u % 1) + 1) % 1;
    const f = uu * N;
    const i0 = Math.floor(f) % N;
    const i1 = (i0 + 1) % N;
    const fr = f - Math.floor(f);
    const p = P[i0].clone().lerp(P[i1], fr);
    const fwd = T[i0].clone().lerp(T[i1], fr).normalize();
    const upV = ups[i0].clone().lerp(ups[i1], fr);
    upV.addScaledVector(fwd, -upV.dot(fwd)).normalize();
    const side = new t.Vector3().crossVectors(upV, fwd).normalize();
    return { p, fwd, up: upV, side };
  };

  const frames: SplineFrame[] = [];
  for (let i = 0; i < N; i++) frames.push(frameAt(i / N));

  return { curve, total, N, P, frames, frameAt };
}

/**
 * Find the longest continuous climb ending at the highest sample — the lift
 * hill. Returns the per-sample lift mask used to pin vehicles to chain speed.
 */
export function detectLiftHill(P: THREE.Vector3[]): {
  /** sample index of the crest (highest point) */
  imax: number;
  /** sample index where the climb starts */
  liftStart: number;
  /** climb length in samples (a chain is worth rendering when >= 8) */
  liftLen: number;
  onLift: boolean[];
} {
  const N = P.length;
  let imax = 0;
  for (let i = 1; i < N; i++) if (P[i].y > P[imax].y) imax = i;
  let liftStart = imax;
  for (let k = 0; k < N - 2; k++) {
    const prev = (liftStart - 1 + N) % N;
    if (P[prev].y < P[liftStart].y - 1e-4) liftStart = prev;
    else break;
  }
  const onLift = new Array<boolean>(N).fill(false);
  const liftLen = (imax - liftStart + N) % N;
  if (liftLen >= 8) for (let k = 0; k <= liftLen; k++) onLift[(liftStart + k) % N] = true;
  return { imax, liftStart, liftLen, onLift };
}

// ---------------------------------------------------------------------------
// CHAIN LIFT — `buildLiftChain` and `LiftChainOpts` LIVE IN ./liftChain.ts
// (split out for file size only — see that file's header). Re-exported here so
// the module's public surface is unchanged: SplineRideKit and everything else
// keep importing them from '../SplineCoaster'.
// ---------------------------------------------------------------------------
export { buildLiftChain };
export type { LiftChainOpts } from './liftChain';

export interface SplineSupportOpts {
  /** sample stride between supports (default 9) */
  supportEvery?: number;
  /** ground height sampler so supports land on terrain (default flat y=0) */
  groundAt?: (x: number, z: number) => number;
  /** splayed wooden trestle bents instead of steel columns */
  wood?: boolean;
  /** RCT2 TrackColour.supports (ride/RideColour.h:23) — tints the trestle
   *  timber / steel columns; omitted = today's colours exactly */
  colour?: number;
}

/**
 * Drop supports from the sampled frames onto the ground (terrain-aware via
 * opts.groundAt; skips near-ground / heavily banked track). Steel columns +
 * concrete footers, or wooden trestle bents with ledgers and X-bracing.
 */
export function addSplineSupports(
  t: typeof THREE,
  group: THREE.Group,
  frames: SplineFrame[],
  opts: SplineSupportOpts = {},
) {
  const N = frames.length;
  // supports colour: WOOD_D/STEEL derive from opts.colour when given (0.78 ≈
  // the stock 0x5f3f24 : 0x7a5230 ratio); defaults are byte-identical
  const WOOD = opts.colour ?? 0x7a5230;
  const WOOD_D = opts.colour !== undefined ? shade(opts.colour, 0.78) : 0x5f3f24;
  const STEEL = opts.colour ?? 0x9aa0a8;
  const CONCRETE = 0x8a8578;
  const groundAt = opts.groundAt ?? (() => 0);
  const every = opts.supportEvery ?? 9;
  // batched buckets — every strut/footer of the whole support run merges into
  // one mesh per material (mergedBoxes), instead of ~6-10 meshes per bent
  const legSpecs: MergedBoxSpec[] = []; // WOOD, repeat [1,4]
  const braceSpecs: MergedBoxSpec[] = []; // WOOD_D ledgers + X-bracing, repeat [3,1]
  const footerSpecs: MergedBoxSpec[] = []; // CONCRETE pads
  const steelSpecs: MergedBoxSpec[] = []; // STEEL diagonal braces
  for (let i = 0; i < N; i += every) {
    const f = frames[i];
    const topY = f.p.y - 0.16;
    const gC = groundAt(f.p.x, f.p.z);
    if (topY - gC < 0.3) continue; // track is near the ground
    // Only UPRIGHT track takes a column. This was `Math.abs(f.up.y) < 0.5`,
    // which passes an INVERTED frame (up.y = −1 → abs 1) just as readily as an
    // upright one — so the top of every vertical loop grew a steel column that
    // dropped straight down THROUGH THE INSIDE OF THE LOOP to the ground. It is
    // the vertical bar visible up the middle of the teardrop in
    // `harness/mp3d-render/shot-loop.mjs`. A loop hangs off its entry and exit;
    // nothing holds it up from the middle.
    if (f.up.y < 0.5) continue; // inverted or too banked to land a column here
    const ln = Math.hypot(f.side.x, f.side.z) || 1;
    const lx = f.side.x / ln;
    const lz = f.side.z / ln; // horizontal lateral direction for bents
    if (opts.wood) {
      // trestle bent: splayed legs, concrete footers, cap ledger, X-bracing
      const span = topY - gC;
      const spread = 0.5 + span * 0.09;
      [-1, 1].forEach((s) => {
        const bx = f.p.x + s * spread * lx;
        const bz = f.p.z + s * spread * lz;
        const gy = groundAt(bx, bz);
        const base = new t.Vector3(bx, gy - 0.06, bz); // footed into the ground
        const top = new t.Vector3(f.p.x + s * 0.4 * lx, topY, f.p.z + s * 0.4 * lz);
        legSpecs.push(barSpec(t, base, top, 0.1, [1, 4]));
        footerSpecs.push({ dims: [0.26, 0.08, 0.26], pos: [bx, gy + 0.02, bz] });
      });
      braceSpecs.push(
        barSpec(
          t,
          new t.Vector3(f.p.x - 0.5 * lx, topY, f.p.z - 0.5 * lz),
          new t.Vector3(f.p.x + 0.5 * lx, topY, f.p.z + 0.5 * lz),
          0.09,
          [3, 1],
        ),
      );
      const levels = Math.max(0, Math.floor((span - 0.55) / 0.85));
      for (let k = 1; k <= levels; k++) {
        const y = gC + (span * k) / (levels + 1);
        const w = spread + (0.4 - spread) * ((y - gC) / span);
        braceSpecs.push(
          barSpec(
            t,
            new t.Vector3(f.p.x - w * lx, y, f.p.z - w * lz),
            new t.Vector3(f.p.x + w * lx, y, f.p.z + w * lz),
            0.07,
            [3, 1],
          ),
        );
        const y2 = k === levels ? topY : gC + (span * (k + 1)) / (levels + 1);
        const w2 = spread + (0.4 - spread) * ((y2 - gC) / span);
        const d = k % 2 ? 1 : -1;
        braceSpecs.push(
          barSpec(
            t,
            new t.Vector3(f.p.x - d * w * lx, y, f.p.z - d * w * lz),
            new t.Vector3(f.p.x + d * w2 * lx, y2, f.p.z + d * w2 * lz),
            0.055,
            [3, 1],
          ),
        );
      }
    } else {
      // steel column + concrete footer, diagonal brace when tall
      group.add(cyl(t, 0.06, 0.085, topY - gC + 0.06, STEEL, [f.p.x, (topY + gC - 0.06) / 2 + 0.03, f.p.z], { tex: 'metal', metal: 0.6, rough: 0.4, seg: 10 }));
      footerSpecs.push({ dims: [0.3, 0.07, 0.3], pos: [f.p.x, gC + 0.035, f.p.z] });
      if (topY - gC > 2.2) {
        const bx = f.p.x + lx * 1.0;
        const bz = f.p.z + lz * 1.0;
        const gB = groundAt(bx, bz);
        const base = new t.Vector3(bx, gB - 0.04, bz);
        steelSpecs.push(barSpec(t, base, new t.Vector3(f.p.x, gC + (topY - gC) * 0.55, f.p.z), 0.06));
        footerSpecs.push({ dims: [0.22, 0.06, 0.22], pos: [bx, gB + 0.03, bz] });
      }
    }
  }
  if (legSpecs.length) group.add(mergedBoxes(t, legSpecs, WOOD, { tex: 'wood', rough: 0.9 }));
  if (braceSpecs.length) group.add(mergedBoxes(t, braceSpecs, WOOD_D, { tex: 'wood', rough: 0.9 }));
  if (steelSpecs.length) group.add(mergedBoxes(t, steelSpecs, STEEL, { tex: 'metal', metal: 0.6, rough: 0.4 }));
  if (footerSpecs.length) group.add(mergedBoxes(t, footerSpecs, CONCRETE, { tex: 'concrete', rough: 0.95 }));
}

/**
 * Build a freeform coaster from 3D control points. Returns the finished
 * track group, the closed spline, a frame query, and a `run` factory that
 * attaches a train of car groups (cars face +z, e.g. buildCoasterCar).
 */
export function buildSplineCoaster(
  t: typeof THREE,
  controlPoints: [number, number, number][],
  opts: SplineCoasterOpts = {},
): {
  group: THREE.Group;
  curve: THREE.CatmullRomCurve3;
  frameAt: (u: number) => SplineFrame;
  run: (cars: THREE.Group[], runOpts?: RunOpts) => (time: number) => void;
} {
  // 'wooden' type implies wood construction unless explicitly overridden
  const wood = opts.wood ?? opts.type === 'wooden';
  // ---- INVERSIONS ARE STEEL ONLY -------------------------------------------
  // The wooden RTD's `enabledTrackGroups` (ride/rtd/coaster/WoodenRollerCoaster.h:26)
  // lists `TrackGroup::verticalLoop` but NEITHER `TrackGroup::corkscrew` NOR
  // `TrackGroup::barrelRoll` — both of which the steel tables do carry
  // (TwisterRollerCoaster.h:27, plus Corkscrew/Looping/Giga/Hyper/…), so there
  // is no wooden element that rolls the track past vertical. The roll is
  // DROPPED rather than built-and-flagged: the frames this returns are the same
  // frames `checkCoasterDesign` and the crash physics read, and a legal-looking
  // build is worth more than an illegal one carrying a console warning. The
  // rule lives here, not in `computeSplineFrames`, because the leaf knows
  // nothing about coaster TYPES — SplineRideKit owns the rule tables.
  let roll = opts.roll;
  if (roll?.length && (wood || opts.type === 'wooden')) {
    console.warn(
      `[SplineCoaster] ${roll.length} roll element(s) DROPPED: inversions are steel only. RCT2's wooden track table ` +
        `(WoodenRollerCoaster.h:26) has no TrackGroup::corkscrew and no TrackGroup::barrelRoll — only the steel tables do ` +
        `(TwisterRollerCoaster.h:27). Build this layout with type: 'steel'.`,
    );
    roll = undefined;
  }
  const { curve, total, N, P, frames, frameAt } = computeSplineFrames(t, controlPoints, { bank: opts.bank, roll });

  // ---- meshes ----
  // RCT2 TrackColour mapping (ride/RideColour.h:19-24): rails = main,
  // ties + wooden stringers / steel spine = additional, supports = supports.
  // Every default below is byte-identical to the pre-scheme colours.
  const group = new t.Group();
  const RAIL = opts.colours?.main ?? opts.railColor ?? 0x8b8f96;
  const WOOD = opts.colours?.additional ?? 0x7a5230;
  const SPINE = opts.colours !== undefined ? shade(opts.colours.additional, 0.8) : 0x5b6068;
  const TIE = opts.colours?.additional;

  // twin running rails as metal tubes on offset point chains
  [-1, 1].forEach((s) => {
    const off = frames.map((f) => f.p.clone().addScaledVector(f.side, s * GAP));
    const railCurve = new t.CatmullRomCurve3(off, true);
    const tube = new t.Mesh(
      new t.TubeGeometry(railCurve, N, 0.045, 8, true),
      mat(t, RAIL, { tex: 'metal', repeat: [1, 48], metal: 0.8, rough: 0.35 }),
    );
    tube.castShadow = true;
    group.add(tube);
  });
  if (wood) {
    // wooden stringers laminated under each rail (TrackKit woodie style)
    [-1, 1].forEach((s) => {
      const off = frames.map((f) => f.p.clone().addScaledVector(f.side, s * GAP).addScaledVector(f.up, -0.12));
      const c = new t.CatmullRomCurve3(off, true);
      const tube = new t.Mesh(new t.TubeGeometry(c, N, 0.06, 6, true), mat(t, WOOD, { tex: 'wood', repeat: [1, 36], rough: 0.9 }));
      tube.castShadow = true;
      group.add(tube);
    });
  } else {
    // steel box spine beneath the centreline
    const off = frames.map((f) => f.p.clone().addScaledVector(f.up, -0.17));
    const c = new t.CatmullRomCurve3(off, true);
    const tube = new t.Mesh(new t.TubeGeometry(c, N, 0.07, 6, true), mat(t, SPINE, { tex: 'metal', repeat: [1, 36], metal: 0.7, rough: 0.45 }));
    tube.castShadow = true;
    group.add(tube);
  }
  // crossties every few samples — ~107 rigid boxes merged into ONE mesh
  {
    const tieSpecs: MergedBoxSpec[] = [];
    for (let i = 0; i < N; i += 3) {
      const f = frames[i];
      const m = new t.Matrix4().makeBasis(f.side, f.up, new t.Vector3().crossVectors(f.side, f.up));
      m.setPosition(f.p.clone().addScaledVector(f.up, -0.06));
      tieSpecs.push({ dims: [GAP * 2 + 0.28, 0.055, 0.13], matrix: m, repeat: [3, 1] });
    }
    group.add(mergedBoxes(t, tieSpecs, TIE ?? (wood ? 0x6b4626 : 0x4a4e55), { tex: wood ? 'wood' : 'metal', rough: 0.9 }));
  }

  // ---- lift hill: the MECHANISED chain lift up the longest climb ----------
  // Same driven-strand line and thickness as the old smooth tube (centreline,
  // up +0.02, r 0.035) — everything else is added around it inside the
  // CoasterCar's measured envelope (floor 0.335 on the centreline, 0.86 at
  // |x| 0.16, wheel bogies down to 0.045 only in the |x| 0.26-0.34 band, half
  // width 0.335). See buildLiftChain.
  const { liftStart, liftLen, onLift } = detectLiftHill(P);
  if (liftLen >= 8) {
    group.add(
      buildLiftChain(t, frames, {
        liftStart,
        liftLen,
        sides: [0],
        h: 0.02,
        r: 0.035,
        rackX: 0.155, // rack teeth top out at +0.073; the tub floor there is +0.86
        sprocketR: 0.08,
        motorX: 0.62, // clear of the 0.335 half-width car and the 0.48-wide ties
        catwalkX: 0.7,
        colour: opts.colours?.supports,
      }),
    );
  }

  // ---- supports dropped onto the ground ----
  addSplineSupports(t, group, frames, { supportEvery: opts.supportEvery, groundAt: opts.groundAt, wood, colour: opts.colours?.supports });

  // ---- energy-paced train runner ----
  let maxY = 0;
  for (const p of P) maxY = Math.max(maxY, p.y);
  const run = (cars: THREE.Group[], runOpts: RunOpts = {}) => {
    const speed = runOpts.speed ?? 1;
    const spacing = runOpts.spacing ?? 1.2;
    const wheelOffset = runOpts.wheelOffset ?? 0.195;
    cars.forEach((c) => group.add(c));
    const energy = GRAV * (maxY + 0.55); // head so the train always crests
    const vMin = 1.4;
    const liftV = 1.5; // constant chain speed
    let uHead = liftLen >= 8 ? liftStart / N : 0;
    let last = 0;
    const m = new t.Matrix4();
    return (time: number) => {
      const dt = Math.min(0.06, Math.max(0, time - last));
      last = time;
      const head = frameAt(uHead);
      let v = Math.sqrt(Math.max(vMin * vMin, 2 * (energy - GRAV * head.p.y)));
      if (onLift[Math.floor((((uHead % 1) + 1) % 1) * N) % N]) v = liftV;
      uHead += (v * speed * dt) / total;
      cars.forEach((c, i) => {
        const f = frameAt(uHead - (i * spacing) / total);
        c.position.copy(f.p).addScaledVector(f.up, wheelOffset);
        m.makeBasis(f.side, f.up, f.fwd);
        c.setRotationFromMatrix(m);
      });
    };
  };

  return { group, curve, frameAt, run };
}

// sweeping freeform layout: lift up the east side to a PLATEAU crest (two
// near-level points — RCT2 tops every ramp with a transition piece, never a
// kink), a long 60°-legal drop into the south valley, one camelback on the
// return and a wide banked low turn home. Pitch changes stay under
// SplineRideKit's pitchRate rule (~0.55 rad/unit ≈ one 25° step per tile):
// verified numerically over the whole loop — max pitch rate 0.46 rad/unit,
// worst wheel-vs-rail deviation 0.056, worst nose-to-tail approach 0.084 at
// spacing 1.5, checkCoasterDesign('steel') fully clean.
const LAYOUT: [number, number, number][] = [
  [-5.0, 0.7, -2.0], // station straight
  [-1.8, 0.8, -4.0],
  [2.0, 2.0, -4.4], // lift hill climbs...
  [4.3, 3.05, -3.5], // ...to the crest plateau...
  [5.3, 3.0, -2.0], // ...held level through the turn (eased top transition)
  [5.8, 2.0, 0.2], // long legal drop...
  [5.2, 1.15, 2.0],
  [3.6, 0.95, 3.6], // ...swoops through the valley
  [0.9, 1.6, 4.75], // rise out
  [-1.3, 2.0, 4.4], // camelback over the south-west
  [-3.6, 1.2, 3.6],
  [-4.9, 0.85, 2.6], // gliding down the west return
  [-6.35, 0.75, 0.7],
  [-5.9, 0.7, -1.15], // wide banked low turn home
];

/** Preview: steel spline coaster with a 3-car train of CoasterCar cars,
 *  painted with a seeded RCT2 steel scheme (darkGreen/mossGreen/darkBrown —
 *  TwisterRollerCoaster.h:56) and lit by station platform lamps after dark. */
/** the stock circuit, exported so compositions can start from it (or diff
 *  their own layout against a known-legal one) */
export const SPLINE_COASTER_LAYOUT = LAYOUT;

export interface SplineCoasterOpts {
  /** control points `[x, y, z]` in WORLD units (y is absolute, not
   *  ground-relative) — defaults to the verified stock circuit
   *  (SPLINE_COASTER_LAYOUT). Keep the first three points a level station
   *  straight and run checkCoasterDesign on anything you author. */
  points?: [number, number, number][];
  /** max curvature bank in radians (default 0.55) */
  bank?: number;
  /** ColorKit seed for the steel scheme (default 22) */
  seed?: number;
  /** (declared on the builder interface above — `roll?: SplineRoll[]`, the
   *  inverting corkscrew / barrel-roll elements; the two SplineCoasterOpts
   *  declarations in this module MERGE, so the prop is on the component too) */
}

export function buildSplineCoasterScene(
  three: typeof THREE,
  opts: SplineCoasterOpts = {},
): { group: THREE.Group; update?: (time: number) => void; vehicle?: THREE.Object3D } {
  const group = new three.Group();
  let vehicle: THREE.Object3D | undefined; // the lead coaster car — the RideViewer follow cam tracks it (userData.rideVehicle)
  const update =
    ((t: typeof THREE, g: THREE.Group) => {
        const scheme = rideColourPreset(opts.seed ?? 22, 'steel'); // deterministic: darkGreen main / mossGreen ties / darkBrown supports
        // This scene is STEEL by construction — its colours come from
        // rideColourPreset(seed, 'steel') on the line above, and `type`/`wood`
        // have never been forwarded from the props. Declaring `type: 'steel'`
        // states that instead of leaving it to the `wood` default, and is a
        // provable no-op (buildSplineCoaster reads `type` only for
        // `wood = opts.wood ?? opts.type === 'wooden'` and for the roll gate).
        // The stock circuit carries NO roll — an inversion is opt-in per layout.
        const coaster = buildSplineCoaster(t, opts.points ?? LAYOUT, {
          bank: opts.bank ?? 0.55,
          colours: scheme.track,
          type: 'steel',
          roll: opts.roll,
        });
        g.add(coaster.group);

        // station platform beside the first straight: steel-legged concrete
        // deck whose top sits just under the rail tops (+0.02 vs +0.045) and
        // whose inner edge (0.50 off the centreline) kisses but never clips
        // the crosstie ends (0.48); posts grounded on concrete footers
        const st = coaster.frameAt(0);
        const yaw = Math.atan2(st.fwd.x, st.fwd.z);
        const sideH = new t.Vector3(st.side.x, 0, st.side.z).normalize();
        const deckC = st.p.clone().addScaledVector(sideH, 0.9);
        const deck = box(t, [0.8, 0.07, 2.2], 0x8a8f98, [0, 0, 0], { tex: 'concrete', repeat: [3, 6], rough: 0.9, rotY: yaw });
        deck.position.set(deckC.x, st.p.y - 0.015, deckC.z);
        g.add(deck);
        [-0.85, 0.85].forEach((dz) => {
          [-0.28, 0.28].forEach((dx) => {
            const post = deckC.clone().addScaledVector(st.fwd, dz).addScaledVector(sideH, dx);
            const h = st.p.y - 0.05;
            g.add(cyl(t, 0.045, 0.055, h, 0x9aa0a8, [post.x, h / 2, post.z], { tex: 'metal', metal: 0.6, rough: 0.4, seg: 10 }));
            g.add(box(t, [0.16, 0.05, 0.16], 0x8a8578, [post.x, 0.025, post.z], { tex: 'concrete', rough: 0.95 }));
          });
        });

        // station platform lamps: a lantern pole at each end of the deck —
        // bulbs are emissive-only, ONE real PointLight over the deck centre.
        // Poles stand on the deck top (st.p.y − 0.015 + 0.035 = +0.02) at the
        // deck's outer edge (side offset 0.9 + 0.28 = 1.18 < outer face 1.30).
        const bulbMats: THREE.MeshStandardMaterial[] = [];
        [-0.85, 0.85].forEach((dz) => {
          const base = deckC.clone().addScaledVector(st.fwd, dz).addScaledVector(sideH, 0.28);
          const poleY = st.p.y + 0.02;
          g.add(cyl(t, 0.02, 0.025, 0.5, 0x3a3d42, [base.x, poleY + 0.25, base.z], { tex: 'metal', metal: 0.6, rough: 0.5, seg: 8 }));
          const bulb = ball(t, 0.05, 0xfff0c8, [base.x, poleY + 0.53, base.z], { emissive: 0xffb45e, rough: 0.35 });
          (bulb.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.15; // faint glass by day
          g.add(bulb);
          bulbMats.push(bulb.material as THREE.MeshStandardMaterial);
        });
        const deckLamp = new t.PointLight(0xffb45e, 0, 4, 2); // the ONLY real station light
        deckLamp.position.set(deckC.x, st.p.y + 0.6, deckC.z);
        g.add(deckLamp);

        // RCT2 train order: car 0 leads (run() places car i at uHead − i·spacing,
        // so index 0 is furthest along) — nose car first, plain middle, tail car
        const cars = (['front', 'middle', 'end'] as const).map((v) => buildCoasterCar(t, v, scheme.vehicles[0]));
        // spacing 1.5: the cars span -0.66 (coupler/tail-light) .. +0.71
        // (headlamp), so 1.5 leaves real daylight between nose and tail even
        // through the valley's relative-pitch pinch
        const run = coaster.run(cars, { spacing: 1.5 });
        vehicle = cars[0];
        return (time) => {
          run(time);
          const k = nightKOf(g); // headlamps + platform lamps only after dark
          cars.forEach((c) => gateCarLights(c, k));
          const ease = k * k * (3 - 2 * k); // smoothstep
          deckLamp.intensity = 0.8 * ease;
          bulbMats.forEach((m) => (m.emissiveIntensity = 0.15 + 1.05 * ease));
        };
      })(three, group) || undefined;
  return { group, update, vehicle };
}

/** <SplineCoaster> — composable ride (components/Park/Context.md): mounts the ride
 *  at `position`/`rotation`; inside a <Park>, `register` wires the full
 *  GameManager ride via <ConfigurableRide> — queue HEAD 1.5 out the local +z
 *  front (lane extending +z), exit hut beside it at local [-1.5, 1.35],
 *  boarding at the base. Override with top-level props / `queue`. */
export const SplineCoaster = composableRide<SplineCoasterOpts>(
  'SplineCoaster',
  (t, props) => buildSplineCoasterScene(t, props),
  { defaults: { name: 'Coaster', capacity: 6, rideDuration: 10, intensity: 7, price: 5 } },
);

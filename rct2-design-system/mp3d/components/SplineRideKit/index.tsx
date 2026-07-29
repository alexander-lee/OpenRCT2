import React from 'react';
import * as THREE from 'three';
import { box, cyl, ball, mat } from '../Stage';
import {
  buildSplineCoaster,
  computeSplineFrames,
  detectLiftHill,
  addSplineSupports,
  buildLiftChain,
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
// SIBLING MODULES — the kit is split across ./design, ./pieces, ./crash and
// ./ratings ONLY because Magic Patterns writes whole files and the combined
// source no longer fits a single write. The public surface below is exactly
// the one index.tsx exported before the split, name for name, so every
// `from '../SplineRideKit'` import keeps resolving. Do not add module-private
// helpers (GRAV, DEG, TYPE_RULES, inversionWindow, …) to these lists.
// ---------------------------------------------------------------------------
export { validateSpline, coasterBankCap, checkCoasterDesign, rampPoints } from './design';
export type {
  SplineValidation,
  CoasterType,
  DesignViolationKind,
  DesignViolation,
  CoasterDesignReport,
  RampPointsOpts,
  RideProfile,
} from './design';
export { compileTrackPieces, COASTER_PRESETS, COASTER_PRESET_PLUNGE } from './pieces';
export type { CoasterPreset } from './pieces';
export type {
  TrackPieceType,
  TrackPieceDef,
  TrackPiece,
  TrackClosure,
  TrackStationPose,
  TrackPieceReport,
  CompiledTrackPieces,
  CompileTrackOpts,
} from './pieces';
export { crashTrain } from './crash';
export type { CrashFrameVel, TrainCrash } from './crash';
export { replayCoasterForces, rateCoaster } from './ratings';
export type {
  CoasterForceSample,
  CoasterForceReplay,
  RatingBand,
  CoasterTurnCounts,
  CoasterRatings,
  RateCoasterOpts,
} from './ratings';

// values this file still uses directly
import {
  CoasterDesignReport,
  CoasterType,
  DEG,
  GRAV,
  RideProfile,
  SplineValidation,
  TOL,
  checkCoasterDesign,
  coasterBankCap,
  inversionWindow,
  rollOfFrame,
  validateSpline,
} from './design';
import { CrashFrameVel, TrainCrash, crashTrain } from './crash';

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

// ---------------------------------------------------------------------------
// Profiles + guarded runner
// ---------------------------------------------------------------------------

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
  // INVERSION ELEMENTS are exempt from the lateral derail read — the same
  // windows checkCoasterDesign, replayCoasterForces and rateCoaster use (see
  // `inversionWindow`). A vertical loop's tangent passes through the vertical,
  // where κ_h is a singular proxy for a force that is entirely along the car's
  // up axis; without this the train derails inside every legal loop.
  const inInversion = inversionWindow(frames, N, ds);
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
        const eff = inInversion[i] ? 0 : v * v * kH[i] * (1 - Math.min(1, Math.abs(rollA[i]) / 0.6));
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
    // ... and it is MECHANISED now (buildLiftChain, shared with the coaster
    // profile): the driven strand keeps EXACTLY these offsets and radii, so
    // every margin quoted above is unchanged, and the chain trough, guide
    // rollers, sprockets, motor/gearbox and catwalk are placed against each
    // vehicle's MEASURED cross-section — MiniLog half-width 0.26 with its hull
    // at -0.100 on the centreline, MiniSled half-width 0.21 with its floor at
    // +0.155 from |x| 0.14, the rapids raft's torus bottoming at -0.065 only
    // on the ring |x| 0.285-0.455 with its deck at +0.035 over the middle.
    // NO anti-rollback rack on the water profiles: a flume/rapids lift is a
    // belt conveyor and has none — and the rack would foul the log's hull.
    const sides = profile === 'rapids' ? [0] : [-0.3, 0.3];
    const h = profile === 'bobsled' ? -0.03 : profile === 'rapids' ? -0.075 : -0.02;
    const r = profile === 'rapids' ? 0.033 : 0.02;
    group.add(
      buildLiftChain(t, frames, {
        liftStart,
        liftLen,
        sides,
        h,
        r,
        // bobsled is a chain-lift coaster and gets the ratchet: rack top +0.015
        // against the sled's +0.155 floor at |x| 0.15
        ...(profile === 'bobsled' ? { rackX: 0.15 } : {}),
        // the rapids channel floor sits at -0.10, right under the belt
        ...(profile === 'rapids' ? { troughH: 0.05 } : {}),
        sprocketR: profile === 'rapids' ? 0.032 : 0.055,
        // outside the trough walls (flume 0.45), the boulder line (rapids, out
        // to ~0.97) and the bobsled chute's flared side plates (0.74)
        motorX: profile === 'rapids' ? 1.06 : profile === 'bobsled' ? 0.95 : 0.66,
        catwalkX: profile === 'rapids' ? 1.1 : profile === 'bobsled' ? 0.98 : 0.72,
        colour: opts.colours?.supports,
      }),
    );
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

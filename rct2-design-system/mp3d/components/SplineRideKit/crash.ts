// ---------------------------------------------------------------------------
// SplineRideKit / crash.ts — the RCT2 crash sequence (crashTrain).
// Split out of ./index.tsx for file size only; index.tsx re-exports it.
// ---------------------------------------------------------------------------

import * as THREE from 'three';
import { box, ball } from '../Stage';
import { buildEmitter, Emitter, buildFire, Fire } from '../ParticleKit';
import { GRAV, hashN } from './design';

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


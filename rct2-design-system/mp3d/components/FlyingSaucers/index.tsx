import React from 'react';
import * as THREE from 'three';
import { box, cyl, ball, nightKOf } from '../Stage';
import { buildPeep, SHIRTS, SKIN_TONES } from '../Guest';
import { RideColourScheme } from '../ColorKit';
import { createMotionGate } from '../GameManager';
import { composableRide } from '../Park';

// Flying Saucers modelled on the RCT2 Flying Saucers: an electric bumper-
// saucer pad — circular metallic floor crossed by radial glow strips and a
// perimeter glow ring, a low segmented containment wall, and six domed-disc
// saucers that ACTUALLY bump. The saucers run a deterministic rink sim —
// hashed-sine waypoint steering, velocity integration with clamped dt (<=0.1,
// GameManager-style), circular-wall reflection with restitution and circle-
// circle impulses (restitution 0.65) — so they visibly deflect off each other
// with a jolt: hull-tilt kick, rider whiplash and a rim-light flash on every
// hit. No Math.random anywhere: fixed seed layout, pure hashed-sine steering.
// One belted rider per saucer on a cushioned centre seat. Floor strips and
// saucer rims glow at night with two cool overhead PointLights.

export interface FlyingSaucersOpts {
  scheme?: RideColourScheme;
  /** decorative riders in the saucers (default true). A ride registered in a
   *  <Park> turns them off so the GameManager seats REAL guests via
   *  `seatWorld` instead. */
  riders?: boolean;
}

export interface FlyingSaucersBuilt {
  group: THREE.Group;
  update: (time: number) => void;
  /** per-seat world transform (seat -> live saucer) for GameManager seatWorld */
  seatWorld: (seat: number) => [number, number, number, number];
  /** one saucer for the RideViewer onboard cam (userData.rideVehicle) */
  vehicle: THREE.Object3D;
  /** GameManager FSM hook — saucers drift to a stop while brokenDown/beingRepaired */
  onStateChange: (state: string) => void;
}

export function buildFlyingSaucersScene(three: typeof THREE, opts: FlyingSaucersOpts = {}): FlyingSaucersBuilt {
  const t = three;
  const g = new t.Group();
  const scheme = opts.scheme;
  const withRiders = opts.riders ?? true;
  const PAD = 0x4a4e56; // gunmetal floor
  const WALL = scheme?.track.main ?? 0x2b3038; // containment wall
  const WALL2 = scheme?.track.additional ?? 0x3a4250;
  const RAIL = 0xd8dce0;

  // ---- pad: metallic disc + hub + radial glow strips + glow ring ------
  g.add(cyl(t, 2.62, 2.7, 0.12, PAD, [0, 0.06, 0], { tex: 'metal', repeat: [12, 2], metal: 0.55, rough: 0.45, seg: 40 }));
  g.add(cyl(t, 0.3, 0.36, 0.1, 0x33363e, [0, 0.17, 0], { tex: 'metal', repeat: [4, 1], metal: 0.5, rough: 0.5, seg: 20 })); // hub
  const hubDome = ball(t, 0.16, 0x9aa2ac, [0, 0.22, 0], { metal: 0.6, rough: 0.35 });
  hubDome.scale.y = 0.6;
  g.add(hubDome);
  const stripMat = new t.MeshStandardMaterial({ color: 0x9fdcff, emissive: 0x35b8e8, emissiveIntensity: 0.35, roughness: 0.4 });
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const strip = new t.Mesh(new t.BoxGeometry(2.05, 0.018, 0.07), stripMat);
    strip.position.set(Math.cos(a) * 1.32, 0.126, Math.sin(a) * 1.32);
    strip.rotation.y = -a;
    g.add(strip);
  }
  const ring = new t.Mesh(new t.TorusGeometry(2.38, 0.022, 8, 64), stripMat);
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.126;
  g.add(ring);

  // ---- low containment wall: 26 segments + white top rail --------------
  for (let i = 0; i < 26; i++) {
    const a = (i / 26) * Math.PI * 2;
    const seg = box(t, [0.64, 0.34, 0.1], i % 2 ? WALL : WALL2, [Math.cos(a) * 2.78, 0.29, Math.sin(a) * 2.78], { tex: 'plastic', repeat: [3, 1], rough: 0.55 });
    seg.rotation.y = -a + Math.PI / 2;
    g.add(seg);
  }
  const topRail = new t.Mesh(new t.TorusGeometry(2.78, 0.035, 10, 64), new t.MeshStandardMaterial({ color: RAIL, metalness: 0.5, roughness: 0.4 }));
  topRail.rotation.x = Math.PI / 2;
  topRail.position.y = 0.475;
  topRail.castShadow = true;
  g.add(topRail);
  // four perimeter pylons with lamp heads (emissive only — 2 real lights)
  const lampMat = new t.MeshStandardMaterial({ color: 0xd0ecff, emissive: 0x86c8f0, emissiveIntensity: 0.25, roughness: 0.35 });
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const x = Math.cos(a) * 2.95;
    const z = Math.sin(a) * 2.95;
    g.add(cyl(t, 0.035, 0.05, 1.3, 0x3a3f47, [x, 0.65, z], { tex: 'metal', metal: 0.5, rough: 0.5, seg: 10 }));
    const lampHead = new t.Mesh(new t.SphereGeometry(0.07, 12, 10), lampMat);
    lampHead.position.set(x, 1.33, z);
    g.add(lampHead);
  }
  const floodA = new t.PointLight(0x9fd4ff, 0, 7, 2);
  floodA.position.set(1.4, 2.0, 1.4);
  g.add(floodA);
  const floodB = new t.PointLight(0x9fd4ff, 0, 7, 2);
  floodB.position.set(-1.4, 2.0, -1.4);
  g.add(floodB);

  // ---- six saucers: domed metallic discs, rim lights, belted rider ----
  const domes = [0xc23434, 0x2456b0, 0x2e8b4a, 0xd4901a, 0x6c4ea0, 0x1c8b8b];
  const rimGeo = new t.SphereGeometry(0.03, 10, 8);
  const N = 6;
  const saucers: THREE.Group[] = [];
  const rimMats: THREE.MeshStandardMaterial[] = []; // per-saucer so a hit can flash ONE ring
  const riderGroups: (THREE.Group | undefined)[] = [];
  for (let i = 0; i < N; i++) {
    const s = new t.Group();
    const trim = scheme?.vehicles[i % scheme.vehicles.length]?.body ?? domes[i];
    const rimMat = new t.MeshStandardMaterial({ color: 0xffe9b8, emissive: 0xffb040, emissiveIntensity: 0.2, roughness: 0.35 });
    rimMats.push(rimMat);
    s.add(cyl(t, 0.5, 0.4, 0.1, 0xb8bcc4, [0, 0.09, 0], { tex: 'metal', repeat: [8, 1], metal: 0.6, rough: 0.35, seg: 24 })); // hull disc
    s.add(cyl(t, 0.34, 0.5, 0.07, trim, [0, 0.175, 0], { tex: 'plastic', repeat: [8, 1], rough: 0.45, seg: 24 })); // coloured dome skirt
    s.add(cyl(t, 0.3, 0.3, 0.03, 0x1d2127, [0, 0.225, 0], { rough: 0.7, seg: 20 })); // cockpit well
    const rimTorus = new t.Mesh(new t.TorusGeometry(0.475, 0.028, 8, 32), new t.MeshStandardMaterial({ color: 0x33363e, metalness: 0.5, roughness: 0.4 }));
    rimTorus.rotation.x = Math.PI / 2;
    rimTorus.position.y = 0.14;
    rimTorus.castShadow = true;
    s.add(rimTorus);
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      const rim = new t.Mesh(rimGeo, rimMat);
      rim.position.set(Math.cos(a) * 0.475, 0.175, Math.sin(a) * 0.475);
      s.add(rim);
    }
    // centre seat: pan + cushions + backrest + headrest
    s.add(box(t, [0.26, 0.05, 0.24], 0x2a2e35, [0, 0.26, -0.04], { rough: 0.6 }));
    s.add(box(t, [0.22, 0.025, 0.2], 0x33404e, [0, 0.3, -0.03], { tex: 'fabric', repeat: [2, 1], rough: 0.95 })); // pan cushion
    s.add(box(t, [0.26, 0.3, 0.05], 0x2a2e35, [0, 0.4, -0.17], { rough: 0.6 })); // backrest
    s.add(box(t, [0.2, 0.22, 0.02], 0x33404e, [0, 0.39, -0.135], { tex: 'fabric', repeat: [2, 2], rough: 0.95 })); // back cushion
    s.add(box(t, [0.12, 0.07, 0.025], 0x33404e, [0, 0.57, -0.14], { tex: 'fabric', rough: 0.95 })); // headrest
    // console + joystick in front of the rider
    s.add(box(t, [0.18, 0.08, 0.1], 0x1d2127, [0, 0.28, 0.2], { rough: 0.6, rotX: -0.35 }));
    s.add(cyl(t, 0.012, 0.012, 0.09, 0x111116, [0, 0.35, 0.17], { rough: 0.5, seg: 8, rotX: 0.3 }));
    s.add(ball(t, 0.025, trim, [0.014, 0.395, 0.155], { rough: 0.45 }));
    // rider with a lap BELT (webbing across the hips into side anchors)
    if (withRiders) {
      const p = buildPeep(t, { skin: SKIN_TONES[i % SKIN_TONES.length], shirt: SHIRTS[i % SHIRTS.length], seated: true, expression: i % 3 ? 'happy' : 'surprised', female: i % 2 === 1 });
      p.group.scale.setScalar(0.36);
      p.group.position.set(0, 0.145, -0.045);
      p.group.userData.lodDetail = true; // park runtime hides riders beyond NEAR distance
      s.add(p.group);
      riderGroups.push(p.group);
    } else riderGroups.push(undefined);
    s.add(box(t, [0.22, 0.035, 0.05], 0x14161a, [0, 0.345, 0.015], { tex: 'fabric', repeat: [3, 1], rough: 0.85 })); // lap belt webbing
    [-0.11, 0.11].forEach((bx) => s.add(box(t, [0.03, 0.07, 0.04], 0x8f959d, [bx, 0.31, 0.01], { metal: 0.6, rough: 0.35 }))); // buckles/anchors
    // dome beacon behind the headrest + antenna
    const beacon = new t.Mesh(new t.SphereGeometry(0.045, 12, 10), rimMat);
    beacon.position.set(0, 0.245, -0.4);
    s.add(beacon);
    s.add(cyl(t, 0.006, 0.006, 0.16, 0x8f959d, [0, 0.31, -0.4], { metal: 0.6, rough: 0.4, seg: 6 }));
    g.add(s);
    saucers.push(s);
  }

  // ---- deterministic rink sim -------------------------------------------
  // Each saucer is a circle of radius R on the pad plane; the hull disc
  // (r 0.5) is the footprint. Wall inner faces sit at radius 2.73 so centres
  // stay inside MAXR. Fixed seed layout, hashed-sine waypoint steering, dt
  // clamped to 0.1 — reproducible, never Math.random.
  const R = 0.5; // collision radius = hull disc footprint
  const MAXR = 2.73 - R; // centre travel disc (2.23)
  const SPEED = 0.85; // floatier cruise than the dodgems
  const STEER = 2.2; // soft hover steering
  const REST = 0.65; // saucer-saucer restitution
  const WALL_REST = 0.5; // containment-wall bounce
  const px: number[] = [], pz: number[] = [], vx: number[] = [], vz: number[] = [];
  const heading: number[] = [], kickT: number[] = [], kickA: number[] = [], kickX: number[] = [], kickZ: number[] = [];
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2 + 0.4; // fixed seed: ring layout, tangential launch
    px.push(Math.cos(a) * 1.45);
    pz.push(Math.sin(a) * 1.45);
    vx.push(-Math.sin(a) * 0.5);
    vz.push(Math.cos(a) * 0.5);
    heading.push(Math.atan2(-Math.sin(a), Math.cos(a)));
    kickT.push(-10); kickA.push(0); kickX.push(0); kickZ.push(1);
  }
  g.userData.simVehicles = saucers; // numeric-probe hook (harness reads positions)
  g.userData.simRadius = R;
  g.userData.simBumps = 0; // saucer-saucer impacts so far (probe asserts >= 1)

  // FSM spin-down: saucers drift to a stop while brokenDown/beingRepaired
  let speedK = 1;
  let speedTarget = 1;
  let lastT = 0;
  const onStateChange = (state: string) => {
    speedTarget = state === 'brokenDown' || state === 'beingRepaired' ? 0 : 1;
  };

  const kick = (i: number, nx: number, nz: number, amp: number, now: number) => {
    kickT[i] = now;
    kickA[i] = Math.min(1, amp);
    kickX[i] = nx;
    kickZ[i] = nz;
  };

  const update = (time: number, motionK = 1) => {
    const nk = nightKOf(g);
    const ease = nk * nk * (3 - 2 * nk); // smoothstep
    stripMat.emissiveIntensity = 0.35 + (1.7 + 0.25 * Math.sin(time * 2.4) - 0.35) * ease;
    lampMat.emissiveIntensity = 0.25 + (1.3 - 0.25) * ease;
    floodA.intensity = ease * 1.1;
    floodB.intensity = ease * 1.1;

    const dt = Math.min(Math.max(time - lastT, 0), 0.1); // clamped like the GameManager
    lastT = time;
    speedK += (speedTarget - speedK) * Math.min(1, dt * 1.5);
    const driveK = speedK * motionK; // breakdown stop × station gate — same drift-to-rest

    // steer: each saucer drifts toward its own hashed-sine waypoint roaming
    // the pad — the six tracks cross constantly, so saucers meet and bump
    for (let i = 0; i < N; i++) {
      const tx = 1.6 * Math.sin(time * 0.31 + i * 2.62 + Math.sin(time * 0.13 + i * 1.7));
      const tz = 1.6 * Math.sin(time * 0.41 + i * 3.83 + Math.sin(time * 0.19 + i * 2.3));
      const dx = tx - px[i];
      const dz = tz - pz[i];
      const dl = Math.hypot(dx, dz) || 1;
      // mild neighbour avoidance so contacts stay DISCRETE jolts (saucers
      // drift off after a hit instead of grinding), still weak enough to keep
      // the waypoint tracks crossing and bumping
      let ax = dx / dl;
      let az = dz / dl;
      for (let j = 0; j < N; j++) {
        if (j === i) continue;
        const ox = px[i] - px[j];
        const oz = pz[i] - pz[j];
        const od = Math.hypot(ox, oz);
        if (od < 3 * R && od > 1e-6) {
          const w = ((3 * R - od) / (3 * R)) * 1.2;
          ax += (ox / od) * w;
          az += (oz / od) * w;
        }
      }
      const al = Math.hypot(ax, az) || 1;
      const want = SPEED * driveK;
      vx[i] += ((ax / al) * want - vx[i]) * Math.min(1, STEER * dt);
      vz[i] += ((az / al) * want - vz[i]) * Math.min(1, STEER * dt);
      const s = Math.hypot(vx[i], vz[i]);
      if (s > SPEED) {
        vx[i] *= SPEED / s;
        vz[i] *= SPEED / s;
      }
      px[i] += vx[i] * dt;
      pz[i] += vz[i] * dt;
      // circular containment wall: reflect the radial velocity component
      const r = Math.hypot(px[i], pz[i]);
      if (r > MAXR) {
        const nx = px[i] / r; // outward normal
        const nz = pz[i] / r;
        px[i] = nx * MAXR;
        pz[i] = nz * MAXR;
        const vn = vx[i] * nx + vz[i] * nz;
        if (vn > 0) {
          vx[i] -= (1 + WALL_REST) * vn * nx;
          vz[i] -= (1 + WALL_REST) * vn * nz;
          kick(i, -nx, -nz, vn, time);
        }
      }
    }
    // circle-circle collisions: positional correction + impulse along the
    // contact normal (equal masses, restitution REST) — O(n²) over 6 saucers
    for (let i = 0; i < N; i++)
      for (let j = i + 1; j < N; j++) {
        let dx = px[j] - px[i];
        let dz = pz[j] - pz[i];
        let d = Math.hypot(dx, dz);
        if (d >= 2 * R) continue;
        if (d < 1e-6) { dx = 0.01; dz = 0.01 * (j - i); d = Math.hypot(dx, dz); } // deterministic degenerate split
        const nx = dx / d;
        const nz = dz / d;
        const push = (2 * R - d) / 2; // split the overlap
        px[i] -= nx * push; pz[i] -= nz * push;
        px[j] += nx * push; pz[j] += nz * push;
        const rel = (vx[i] - vx[j]) * nx + (vz[i] - vz[j]) * nz; // approach speed along n
        if (rel > 0) {
          const imp = ((1 + REST) * rel) / 2;
          vx[i] -= imp * nx; vz[i] -= imp * nz;
          vx[j] += imp * nx; vz[j] += imp * nz;
          kick(i, -nx, -nz, rel, time); // recoil tilt away from the contact
          kick(j, nx, nz, rel, time);
          if (rel > 0.15) g.userData.simBumps++; // count real hits, not residual grazing
        }
      }
    // drive the visuals: heading follows the velocity + drifty yaw, hulls
    // bank with a decaying kick on impact, that saucer's rim ring flashes
    for (let i = 0; i < N; i++) {
      const s = saucers[i];
      s.position.set(px[i], 0.115, pz[i]); // hull skims the pad top (0.12)
      const spd = Math.hypot(vx[i], vz[i]);
      if (spd > 0.04) {
        let dh = Math.atan2(vx[i], vz[i]) - heading[i];
        dh = Math.atan2(Math.sin(dh), Math.cos(dh));
        heading[i] += dh * Math.min(1, dt * 5);
      }
      const yaw = heading[i] + 0.5 * Math.sin(time * 0.7 + i * 1.9) * speedK; // drifty yaw
      s.rotation.y = yaw;
      const k = kickA[i] * Math.exp(-(time - kickT[i]) * 5);
      const ch = Math.cos(yaw);
      const sh = Math.sin(yaw);
      const lx = kickX[i] * ch - kickZ[i] * sh; // world hit normal -> saucer frame
      const lz = kickX[i] * sh + kickZ[i] * ch;
      s.rotation.x = 0.22 * k * lz;
      s.rotation.z = 0.22 * k * lx;
      const rg = riderGroups[i];
      if (rg) rg.rotation.x = -0.4 * k; // rider jerks with the hit
      rimMats[i].emissiveIntensity = 0.2 + (1.5 - 0.2) * ease + 1.6 * k; // night ramp + impact flash
    }
  };

  // per-seat transform so REGISTERED rides carry real GameManager guests: the
  // guest's group origin (feet) lands on the live saucer seat
  const _v = new t.Vector3();
  const _q = new t.Quaternion();
  const _e = new t.Euler();
  const seatWorld = (seat: number): [number, number, number, number] => {
    const s = saucers[seat % N];
    s.updateWorldMatrix(true, false);
    _v.set(0, 0.145, -0.045).applyMatrix4(s.matrixWorld);
    s.getWorldQuaternion(_q);
    _e.setFromQuaternion(_q, 'YXZ');
    return [_v.x, _v.y, _v.z, _e.y];
  };

  // station gate: the pad sim's internal clock (and its clamped dt) is fed
  // the GATED clock, so saucers sit PARKED while guests board and drift to a
  // stop for unloading — unified with the breakdown drift above.
  const gate = createMotionGate(update);
  const onStateChangeAll = (state: string) => {
    gate.onStateChange(state);
    onStateChange(state);
  };
  return { group: g, update: gate.update, seatWorld, vehicle: saucers[0], onStateChange: onStateChangeAll };
}

export interface FlyingSaucersProps {
  scheme?: RideColourScheme;
  /** decorative riders (default: on standalone, off when `register`ed) */
  riders?: boolean;
}

/** <FlyingSaucers> — composable ride (components/Park/Context.md): mounts the
 *  pad at `position`/`rotation`; inside a <Park>, `register` wires the full
 *  GameManager ride via <ConfigurableRide> — queue HEAD 4.0 out the local +z
 *  front (lane extending +z; the entrance hut then clears the wall ring at
 *  r 2.78), exit hut beside it at local [-3.3, 2.2], boarding at the pad.
 *  Real guests ride the bumping saucers via `seatWorld`; clicking the pad
 *  opens the RideViewer with the onboard cam on saucer 0. Override with
 *  top-level props / `queue`. */
export const FlyingSaucers = composableRide<FlyingSaucersProps>(
  'FlyingSaucers',
  (t, props) => buildFlyingSaucersScene(t, { scheme: props.scheme, riders: props.riders ?? !(props as { register?: unknown }).register }),
  {
    front: 4.0,
    exit: [-3.3, 2.2],
    board: [0, 0.25, 0],
    defaults: { name: 'Flying Saucers', capacity: 6, rideDuration: 8, intensity: 4, price: 3 },
  },
);

import React from 'react';
import * as THREE from 'three';
import { box, nightKOf } from '../Stage';
import { buildPeep, SHIRTS, SKIN_TONES } from '../Guest';
import { createMotionGate } from '../GameManager';
import { ConfigurableRide } from '../Park';
import type { ComposableRideProps, RideLayout } from '../Park';

// Top Spin matched to the RCT2 TOPSP1 sprite: a wide ROYAL-BLUE gondola row hung
// between two counter-swinging support arms on A-frame towers — the arms swing
// while the gondola somersaults, riders' arms up.

export interface TopSpinOpts {
  /** decorative peep riders in the gondola row (default true). A ride
   *  registered in a <Park> turns them off so the GameManager seats REAL
   *  guests via `seatWorld` instead. */
  riders?: boolean;
}

export interface TopSpinBuilt {
  group: THREE.Group;
  update: (time: number) => void;
  /** per-seat world transform (seat -> live tumbling gondola) for GameManager seatWorld */
  seatWorld: (seat: number) => [number, number, number, number];
  /** the gondola for the RideViewer onboard cam (userData.rideVehicle) */
  vehicle: THREE.Object3D;
  /** GameManager FSM hook — the swing eases to rest while brokenDown/beingRepaired */
  onStateChange: (state: string) => void;
}

export function buildTopSpinScene(three: typeof THREE, opts: TopSpinOpts = {}): TopSpinBuilt {
  const t = three;
  const g = new t.Group();
  const withRiders = opts.riders ?? true;
  const MAGENTA = 0x2456b0; // royal-blue gondola (realistic)
  const RED = 0xb03428;
  const ORANGE = 0xe8c020; // safety-yellow footrest
  // twin towers
  [-1, 1].forEach((s) => {
    const x = s * 1.7;
    g.add(box(t, [0.6, 0.25, 1.6], 0x8a8f98, [x, 0.12, 0], { tex: 'concrete', repeat: [2, 5], rough: 0.9 }));
    // legs lean INWARD (tops at x - s * 1.3 * sin(0.085) = x - s * 0.11 = ±1.59) so they meet the
    // top beam / bearing at ±1.52, and their inner faces (>= 1.51) clear the swinging arm (outer face 1.51)
    [-0.5, 0.5].forEach((z) => g.add(box(t, [0.16, 2.6, 0.16], RED, [x, 1.3, z * 0.9], { tex: 'metal', metal: 0.4, rough: 0.5, rotZ: s * 0.085 })));
    g.add(box(t, [0.2, 0.16, 1.06], RED, [x - s * 0.18, 2.62, 0], { metal: 0.4, rough: 0.5 })); // top beam joining both legs + bearing column
    g.add(box(t, [0.16, 0.9, 0.16], RED, [x - s * 0.18, 2.5, 0], { metal: 0.4, rough: 0.5 }));
  });
  // arms + gondola — pivots exactly on the bearing axis through both top beams (y = 2.62, z = 0)
  const armL = new t.Group();
  armL.position.set(-1.42, 2.62, 0);
  g.add(armL);
  const armR = new t.Group();
  armR.position.set(1.42, 2.62, 0);
  g.add(armR);
  [armL, armR].forEach((arm) => arm.add(box(t, [0.18, 1.7, 0.24], RED, [0, -0.85, 0], { tex: 'metal', metal: 0.4, rough: 0.5 })));
  const gondola = new t.Group();
  gondola.position.y = -1.7;
  armL.add(gondola); // carried by the left arm; right arm mirrors visually
  gondola.add(box(t, [2.7, 0.5, 0.6], MAGENTA, [1.42, 0, 0], { tex: 'plastic', repeat: [8, 1], rough: 0.45 }));
  gondola.add(box(t, [2.7, 0.12, 1.1], ORANGE, [1.42, -0.12, 0], { tex: 'plastic', repeat: [6, 2], rough: 0.5 })); // footrest rail just under the riders' feet (feet at y ~ -0.03, z ~ 0.47)
  [-1, 1].forEach((zs) => gondola.add(box(t, [2.5, 0.05, 0.28], 0x24242a, [1.42, -0.05, zs * 0.38], { rough: 0.6 }))); // seat pans off both faces
  // two back-to-back rows of riders, backs against the gondola block
  const seats: THREE.Group[] = [];
  for (let r = 0; r < 2; r++)
    for (let i = 0; i < 4; i++) {
      const zs = r === 0 ? 1 : -1;
      const px = 0.55 + i * 0.58;
      // seat anchor — the decorative rider's transform, kept even without
      // riders so `seatWorld` can carry REAL GameManager guests on the row
      const seat = new t.Group();
      seat.position.set(px, -0.18, zs * 0.336);
      if (r === 1) seat.rotation.y = Math.PI;
      gondola.add(seat);
      seats.push(seat);
      if (withRiders) {
        const p = buildPeep(t, { skin: SKIN_TONES[(r * 4 + i) % SKIN_TONES.length], shirt: SHIRTS[(r * 4 + i) % SHIRTS.length], seated: true, expression: 'surprised' });
        p.group.scale.setScalar(0.34);
        p.group.userData.lodDetail = true; // park runtime hides riders beyond NEAR distance
        seat.add(p.group);
      }
      gondola.add(box(t, [0.24, 0.02, 0.24], 0x3a5f9a, [px, -0.02, zs * 0.36], { tex: 'fabric', repeat: [2, 1], rough: 0.95 })); // padded pan cushion (pan top -0.025, cushion 0.005 sunk / 0.015 proud)
      // over-shoulder yoke per rider (Top-Spin class): vertical bars over
      // both shoulders dropping onto the chest rail at y 0.07, z ±0.4
      [-0.07, 0.07].forEach((dx) => gondola.add(box(t, [0.035, 0.18, 0.035], 0x24242a, [px + dx, 0.13, zs * 0.395], { metal: 0.5, rough: 0.4 })));
    }
  // night lighting: accent bulbs along the gondola top face (block top
  // 0.25; bulb bottoms 0.225 embed) + amber beacons on both tower beams
  // (beam tops 2.7) with a real light at each tower
  const bulbGeo = new t.SphereGeometry(0.035, 10, 8);
  const bulbMat = new t.MeshStandardMaterial({ color: 0xfff3c0, emissive: 0xffb040, emissiveIntensity: 0.15, roughness: 0.35 });
  for (let i = 0; i < 8; i++) {
    const bulb = new t.Mesh(bulbGeo, bulbMat);
    bulb.position.set(0.35 + i * 0.306, 0.26, 0);
    gondola.add(bulb);
  }
  const nightLights: { intensity: number }[] = [];
  [-1, 1].forEach((s) => {
    const beacon = new t.Mesh(new t.SphereGeometry(0.04, 10, 8), bulbMat);
    beacon.position.set(s * 1.52, 2.71, 0);
    g.add(beacon);
    const pl = new t.PointLight(0xffc97a, 0, 5, 2);
    pl.position.set(s * 1.52, 2.85, 0);
    g.add(pl);
    nightLights.push(pl);
  });
  // shoulder bars over the chests (chest centre y = -0.18 + 0.74 * 0.34 = 0.072, chest front z = 0.37), tied back to the gondola at both ends
  [-1, 1].forEach((zs) => {
    gondola.add(box(t, [2.5, 0.05, 0.05], 0x24242a, [1.42, 0.07, zs * 0.4], { metal: 0.5, rough: 0.4 }));
    [0.25, 2.59].forEach((bx) => gondola.add(box(t, [0.05, 0.05, 0.18], 0x24242a, [bx, 0.07, zs * 0.37], { metal: 0.5, rough: 0.4 })));
  });

  // per-seat transform so REGISTERED rides carry real GameManager guests
  const _v = new t.Vector3();
  const _q = new t.Quaternion();
  const _e = new t.Euler();
  const seatWorld = (seat: number): [number, number, number, number] => {
    const s = seats[seat % seats.length];
    s.updateWorldMatrix(true, false);
    _v.set(0, 0, 0).applyMatrix4(s.matrixWorld);
    s.getWorldQuaternion(_q);
    _e.setFromQuaternion(_q, 'YXZ');
    return [_v.x, _v.y, _v.z, _e.y];
  };

  // FSM spin-down: swing/somersault amplitudes ease to zero while
  // brokenDown/beingRepaired (gondola settles hanging level), then restart
  let speedK = 1;
  let speedTarget = 1;
  let lastT = 0;
  const onStateChange = (state: string) => {
    speedTarget = state === 'brokenDown' || state === 'beingRepaired' ? 0 : 1;
  };

  const update = (time: number, motionK = 1) => {
    // day -> night gate: gondola accents + tower lights rise at dusk
    const nk = nightKOf(g);
    const ease = nk * nk * (3 - 2 * nk); // smoothstep
    bulbMat.emissiveIntensity = 0.15 + (1.45 - 0.15) * ease;
    nightLights.forEach((pl) => (pl.intensity = ease * 1.15));
    const dt = Math.min(Math.max(time - lastT, 0), 0.1);
    lastT = time;
    speedK += (speedTarget - speedK) * Math.min(1, dt * 1.5);
    const k = speedK * motionK; // breakdown envelope × station-gate envelope
    const swing = Math.sin(time * 0.9) * 0.9 * k;
    armL.rotation.x = swing; // arms swing fore/aft about the tower bearing axis
    armR.rotation.x = swing;
    gondola.rotation.x = Math.sin(time * 0.9 + 1.2) * 1.6 * k - swing; // somersault about the arm-tip axis, counter-phase
  };
  // station gate: the swing amplitude follows the eased gate speed so the
  // gondola SETTLES hanging level while guests board/unload (spinDown 0.9 —
  // fully at rest before 'unloadingPassengers' begins)
  const gate = createMotionGate(update, { spinDown: 0.9 });
  const onStateChangeAll = (state: string) => {
    gate.onStateChange(state);
    onStateChange(state);
  };
  return { group: g, update: gate.update, seatWorld, vehicle: gondola, onStateChange: onStateChangeAll };
}

export interface TopSpinProps {
  /** decorative riders (default: on standalone, off when `register`ed) */
  riders?: boolean;
}

/** local access geometry: the gondola swings ±z to ~2.1 out and the row spans
 *  x ±1.4, so the queue hut (spans front−1.12..front−0.12) and exit hut stand
 *  clear of the swing envelope and tower pads (x ±2.0, z ±0.8) */
const TOPSPIN_LAYOUT: RideLayout = {
  front: 3.5,
  exit: [-2.3, 1.5],
  board: [0, 0.3, 0],
  defaults: { name: 'Top Spin', capacity: 8, rideDuration: 8, intensity: 8, price: 4 },
};

/** <TopSpin> — composable ride (components/Park/Context.md): mounts the ride
 *  at `position`/`rotation`; inside a <Park>, `register` (true or `{ name,
 *  capacity, rideDuration, price, intensity }`) wires the full GameManager
 *  ride via <ConfigurableRide>. Access geometry (local frame, yaw =
 *  `rotation`): queue HEAD 3.5 out the +z front — clear of the ~2.1 gondola
 *  swing — lane extending +z (tail at `3.5 + laneLenOf(capacity) + 0.35`),
 *  exit hut at local [-2.3, 1.5]. REAL guests ride the gondola row via
 *  `seatWorld`; the swing eases to rest on breakdown (`onStateChange`).
 *  Override with top-level props / `queue`. */
export const TopSpin: React.FC<TopSpinProps & ComposableRideProps> = (all) => {
  const { riders, register, position, rotation, scale, deps, ...rest } = all;
  return (
    <ConfigurableRide
      build={(t) => buildTopSpinScene(t, { riders: riders ?? !register })}
      layout={TOPSPIN_LAYOUT}
      register={register}
      position={position}
      rotation={rotation}
      scale={scale}
      deps={deps ?? [register, riders, rest]}
      {...rest}
    />
  );
};
TopSpin.displayName = 'TopSpin';

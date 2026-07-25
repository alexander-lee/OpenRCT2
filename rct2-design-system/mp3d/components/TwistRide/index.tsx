import React from 'react';
import * as THREE from 'three';
import { box, cyl, nightKOf } from '../Stage';
import { buildPeep, SHIRTS, SKIN_TONES } from '../Guest';
import { createMotionGate } from '../GameManager';
import { ConfigurableRide } from '../Park';
import type { ComposableRideProps, RideLayout } from '../Park';

// Twist matched to the RCT2 TWIST1 sprite: a low central hub drives THREE
// maroon/orange arms, each ending in a spinning 2-car cluster — arms sweep one
// way while each cluster counter-rotates, giving the classic scissor motion.

export interface TwistRideOpts {
  /** decorative peep riders in the tubs (default true). A ride registered in
   *  a <Park> turns them off so the GameManager seats REAL guests via
   *  `seatWorld` instead. */
  riders?: boolean;
}

export interface TwistRideBuilt {
  group: THREE.Group;
  update: (time: number) => void;
  /** per-seat world transform (seat -> live spinning tub) for GameManager seatWorld */
  seatWorld: (seat: number) => [number, number, number, number];
  /** a tub car for the RideViewer onboard cam (userData.rideVehicle) */
  vehicle: THREE.Object3D;
  /** GameManager FSM hook — the rotor spins down while brokenDown/beingRepaired */
  onStateChange: (state: string) => void;
}

export function buildTwistRideScene(three: typeof THREE, opts: TwistRideOpts = {}): TwistRideBuilt {
  const t = three;
  const g = new t.Group();
  const withRiders = opts.riders ?? true;
  const RED = 0xb03428; // arms (sprite #a04030/#d04020)
  const MAROON = 0x7a1a3c; // hub + cluster plates (sprite #801040)
  const SHELL = 0x24262c; // seat pan/backrest shells (dark moulded plastic)
  const PAD = 0x6b2430; // muted burgundy upholstery (CoasterCar pad fabric)
  g.add(cyl(t, 1.9, 2.0, 0.16, 0x8a8f98, [0, 0.08, 0], { tex: 'concrete', repeat: [12, 1], rough: 0.9, seg: 32 }));
  const hub = new t.Group();
  g.add(hub);
  hub.add(cyl(t, 0.35, 0.45, 0.5, MAROON, [0, 0.41, 0], { tex: 'metal', metal: 0.4, rough: 0.5, seg: 18 })); // 0.16..0.66, seated on the base top
  hub.add(cyl(t, 0.2, 0.2, 0.25, RED, [0, 0.77, 0], { metal: 0.4, rough: 0.5, seg: 14 })); // 0.645..0.895, overlaps hub top
  // night lighting: amber accent bulbs on each arm top (arm top 0.665;
  // bulb bottoms 0.64 embed) + a hub-cap bulb, hub light + a base flood
  const bulbGeo = new t.SphereGeometry(0.035, 10, 8);
  const bulbMat = new t.MeshStandardMaterial({ color: 0xfff3c0, emissive: 0xffb040, emissiveIntensity: 0.15, roughness: 0.35 });
  const hubBulb = new t.Mesh(new t.SphereGeometry(0.045, 10, 8), bulbMat);
  hubBulb.position.set(0, 0.9, 0); // hub cap top 0.895
  hub.add(hubBulb);
  const hubLight = new t.PointLight(0xffc97a, 0, 4.5, 2);
  hubLight.position.set(0, 1.05, 0);
  hub.add(hubLight);
  const floodLight = new t.PointLight(0xffc97a, 0, 5, 2);
  floodLight.position.set(1.7, 0.35, 1.7); // low pad flood, radial 2.4 — outside the 2.25 sweep of the spinning cars
  g.add(floodLight);
  const clusters: THREE.Group[] = [];
  const seats: THREE.Group[] = [];
  for (let armI = 0; armI < 3; armI++) {
    const arm = new t.Group();
    arm.rotation.y = (armI / 3) * Math.PI * 2;
    hub.add(arm);
    arm.add(box(t, [1.5, 0.13, 0.22], RED, [0.75, 0.6, 0], { tex: 'metal', metal: 0.35, rough: 0.5 }));
    arm.add(box(t, [0.9, 0.09, 0.14], MAROON, [0.7, 0.48, 0], { metal: 0.35, rough: 0.5, rotZ: 0.12 }));
    arm.add(cyl(t, 0.07, 0.07, 0.18, MAROON, [1.5, 0.69, 0], { metal: 0.4, rough: 0.5, seg: 10 })); // spindle: arm top -> spin plate
    [0.4, 0.75, 1.1].forEach((bx) => {
      const bulb = new t.Mesh(bulbGeo, bulbMat);
      bulb.position.set(bx, 0.675, 0);
      arm.add(bulb);
    });
    const cluster = new t.Group();
    cluster.position.set(1.5, 0.72, 0); // plate rides ABOVE the arm so the cars clear it
    arm.add(cluster);
    cluster.add(cyl(t, 0.5, 0.5, 0.08, MAROON, [0, 0, 0], { tex: 'metal', metal: 0.3, rough: 0.55, seg: 18 })); // spin plate
    for (let ci = 0; ci < 2; ci++) {
      const ca = ci * Math.PI;
      const car = new t.Group();
      car.position.set(Math.cos(ca) * 0.45, 0.09, Math.sin(ca) * 0.45); // tub base flush on the plate top
      car.rotation.y = -ca + Math.PI / 2;
      // tub car: low flared orange bucket with a REAL upholstered seat inside
      // (the CoasterCar/FlyingSaucers pattern: dark shells + fabric cushions)
      car.add(cyl(t, 0.3, 0.26, 0.16, 0xd6541a, [0, 0.08, 0], { tex: 'plastic', repeat: [4, 1], rough: 0.4, seg: 16 })); // flared hull 0..0.16
      const rim = new t.Mesh(new t.TorusGeometry(0.29, 0.022, 8, 24), new t.MeshStandardMaterial({ color: MAROON, metalness: 0.2, roughness: 0.5 }));
      rim.rotation.x = Math.PI / 2;
      rim.position.y = 0.16; // padded rim ring caps the hull lip
      rim.castShadow = true;
      car.add(rim);
      car.add(cyl(t, 0.27, 0.27, 0.025, 0x1d2127, [0, 0.155, 0], { rough: 0.8, seg: 16 })); // dark cockpit floor (top 0.1675)
      // contoured seat: pan + backrest shells (dark) with burgundy fabric
      // cushions and a headrest pad — hips land on the pan cushion top (0.25)
      car.add(box(t, [0.26, 0.05, 0.24], SHELL, [0, 0.195, -0.05], { rough: 0.6 })); // pan shell (top 0.22)
      car.add(box(t, [0.22, 0.03, 0.2], PAD, [0, 0.235, -0.04], { tex: 'fabric', repeat: [2, 1], rough: 0.95 })); // pan cushion 0.22..0.25
      car.add(box(t, [0.26, 0.34, 0.05], SHELL, [0, 0.35, -0.19], { rough: 0.6 })); // backrest shell 0.18..0.52
      car.add(box(t, [0.2, 0.22, 0.025], PAD, [0, 0.32, -0.15], { tex: 'fabric', repeat: [2, 2], rough: 0.95 })); // back cushion, proud of the shell
      car.add(box(t, [0.14, 0.08, 0.03], PAD, [0, 0.5, -0.165], { tex: 'fabric', rough: 0.95 })); // headrest pad (top 0.54, just over the head)
      // lap bar over the thighs (bar 0.2925..0.3275 clears knee tops ~0.28),
      // arms dropping onto the cockpit floor
      car.add(box(t, [0.3, 0.035, 0.05], 0x24242a, [0, 0.31, 0.1], { metal: 0.5, rough: 0.4 }));
      [-0.15, 0.15].forEach((bx) => car.add(box(t, [0.03, 0.16, 0.03], 0x24242a, [bx, 0.235, 0.1], { metal: 0.5, rough: 0.4 })));
      // seat anchor — the decorative rider's transform, kept even without
      // riders so `seatWorld` can carry REAL GameManager guests on the tub.
      // Hip convention: hip underside ≈ 0.45·scale above the group origin, so
      // 0.09 + 0.45·0.36 = 0.252 — settled onto the pan cushion top (0.25).
      const seat = new t.Group();
      seat.position.set(0, 0.09, -0.06); // hips on the cushion, back to the back pad
      car.add(seat);
      seats.push(seat);
      if (withRiders) {
        const p = buildPeep(t, { skin: SKIN_TONES[(armI * 2 + ci) % SKIN_TONES.length], shirt: SHIRTS[(armI * 2 + ci) % SHIRTS.length], seated: true, expression: 'surprised' });
        p.group.scale.setScalar(0.36);
        p.group.userData.lodDetail = true; // park runtime hides riders beyond NEAR distance
        seat.add(p.group);
      }
      cluster.add(car);
    }
    clusters.push(cluster);
  }

  // per-seat transform so REGISTERED rides carry real GameManager guests: the
  // guest's group origin lands on the live tub seat
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

  // FSM spin-down: the manager's ride state machine drives a speed target —
  // the rotor eases to a stop while brokenDown/beingRepaired, then restarts
  let speedK = 1;
  let speedTarget = 1;
  let lastT = 0;
  let angle = 0;
  const onStateChange = (state: string) => {
    speedTarget = state === 'brokenDown' || state === 'beingRepaired' ? 0 : 1;
  };

  const update = (time: number) => {
    // day -> night gate: arm accents + hub/base glow rise as it darkens
    const nk = nightKOf(g);
    const ease = nk * nk * (3 - 2 * nk); // smoothstep
    bulbMat.emissiveIntensity = 0.15 + (1.15 - 0.15) * ease;
    hubLight.intensity = ease * 0.8;
    floodLight.intensity = ease * 0.7;
    const dt = Math.min(Math.max(time - lastT, 0), 0.1);
    lastT = time;
    speedK += (speedTarget - speedK) * Math.min(1, dt * 1.5);
    angle += dt * speedK; // = time while running free
    hub.rotation.y = angle * 1.1;
    clusters.forEach((c, i) => (c.rotation.y = -angle * 2.6 + i));
  };
  // station gate (RCT2: rotor parked while guests board/unload) — composed
  // WITH the breakdown spin-down above
  const gate = createMotionGate(update);
  const onStateChangeAll = (state: string) => {
    gate.onStateChange(state);
    onStateChange(state);
  };
  return { group: g, update: gate.update, seatWorld, vehicle: seats[0].parent as THREE.Object3D, onStateChange: onStateChangeAll };
}

export interface TwistRideProps {
  /** decorative riders (default: on standalone, off when `register`ed) */
  riders?: boolean;
}

/** local access geometry: the spinning cars sweep radius 2.25 (pad 2.0), so
 *  the queue hut (spans front−1.12..front−0.12) and exit hut stand clear */
const TWIST_LAYOUT: RideLayout = {
  front: 3.5,
  exit: [-2.8, 1.5],
  board: [0, 0.25, 0],
  defaults: { name: 'Twist', capacity: 6, rideDuration: 8, intensity: 5, price: 3 },
};

/** <TwistRide> — composable ride (components/Park/Context.md): mounts the ride
 *  at `position`/`rotation`; inside a <Park>, `register` (true or `{ name,
 *  capacity, rideDuration, price, intensity }`) wires the full GameManager
 *  ride via <ConfigurableRide>. Access geometry (local frame, yaw =
 *  `rotation`): queue HEAD 3.5 out the +z front — clear of the 2.25 car sweep
 *  — lane extending +z (tail at `3.5 + laneLenOf(capacity) + 0.35`), exit hut
 *  at local [-2.8, 1.5]. REAL guests ride the tubs via `seatWorld`; the rotor
 *  spins down on breakdown (`onStateChange`). Override with top-level props /
 *  `queue`. */
export const TwistRide: React.FC<TwistRideProps & ComposableRideProps> = (all) => {
  const { riders, register, position, rotation, scale, deps, ...rest } = all;
  return (
    <ConfigurableRide
      build={(t) => buildTwistRideScene(t, { riders: riders ?? !register })}
      layout={TWIST_LAYOUT}
      register={register}
      position={position}
      rotation={rotation}
      scale={scale}
      deps={deps ?? [register, riders, rest]}
      {...rest}
    />
  );
};
TwistRide.displayName = 'TwistRide';

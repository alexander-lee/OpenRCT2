import React from 'react';
import * as THREE from 'three';
import { box, cyl, ball, nightKOf } from '../Stage';
import { buildPeep, SHIRTS, SKIN_TONES } from '../Guest';
import { createMotionGate } from '../GameManager';
import { ConfigurableRide } from '../Park';
import type { ComposableRideProps, RideLayout } from '../Park';

// Chair swing / wave-swinger, rebuilt: chairs hang from the CANOPY RIM on two
// visible chains, each hanger pivots at the rim and flings outward as the top
// spins (tilt follows spin speed). Striped red/gold carnival canopy, mirrored
// centre column, and a ring of lamps around the rim that glow at night.

export interface SwingRideOpts {
  /** decorative peep riders on the chairs (default true). A ride registered
   *  in a <Park> turns them off so the GameManager seats REAL guests via
   *  `seatWorld` instead. */
  riders?: boolean;
}

export interface SwingRideBuilt {
  group: THREE.Group;
  update: (time: number) => void;
  /** per-seat world transform (seat -> live flying chair) for GameManager seatWorld */
  seatWorld: (seat: number) => [number, number, number, number];
  /** a chair for the RideViewer onboard cam (userData.rideVehicle) */
  vehicle: THREE.Object3D;
  /** GameManager FSM hook — the canopy spins down (chairs settle inward)
   *  while brokenDown/beingRepaired */
  onStateChange: (state: string) => void;
}

export function buildSwingRideScene(three: typeof THREE, opts: SwingRideOpts = {}): SwingRideBuilt {
  const t = three;
  const g = new t.Group();
  const withRiders = opts.riders ?? true;
  const H = 3.2;
  const RIM = 1.25;
  const CHAIN = 0.95;
  const RED = 0xc23434;
  const GOLD = 0xd8b040;

  // base + column
  g.add(cyl(t, 0.6, 0.72, 0.35, 0x8a8f98, [0, 0.17, 0], { tex: 'concrete', repeat: [6, 1], rough: 0.9, seg: 24 }));
  g.add(cyl(t, 0.55, 0.55, 0.06, RED, [0, 0.38, 0], { rough: 0.6, seg: 24 }));
  g.add(cyl(t, 0.17, 0.22, H, RED, [0, H / 2 + 0.3, 0], { tex: 'plastic', repeat: [6, 3], rough: 0.5, seg: 18 }));
  // mirrored panels up the column: mirror face RADIAL (thin axis outward), leaning
  // with the column taper (0.0156 rad) so each stays 0.002 embedded / 0.018 proud
  // along its whole height instead of sinking into the fatter base
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    g.add(box(t, [0.02, 1.2, 0.09], 0xe8e8f0, [Math.cos(a) * 0.2076, 1.6, Math.sin(a) * 0.2076], { metal: 0.8, rough: 0.15, rotY: -a, rotZ: 0.0156 }));
  }

  const top = new t.Group();
  top.position.y = H + 0.3;
  g.add(top);
  // striped conical canopy (red/gold wedges) + rim ring + finial
  const SEGS = 12;
  for (let i = 0; i < SEGS; i++) {
    const a0 = (i / SEGS) * Math.PI * 2;
    const wedge = new t.Mesh(
      new t.CylinderGeometry(0.03, RIM, 0.45, 3, 1, false, a0, (Math.PI * 2) / SEGS),
      new t.MeshStandardMaterial({ color: i % 2 ? RED : GOLD, roughness: 0.55 }),
    );
    wedge.position.y = 0.36;
    wedge.castShadow = true;
    top.add(wedge);
  }
  top.add(cyl(t, RIM + 0.04, RIM + 0.04, 0.1, RED, [0, 0.12, 0], { rough: 0.55, seg: 28 }));
  top.add(cyl(t, 0.22, 0.26, 0.2, RED, [0, 0.05, 0], { rough: 0.55, seg: 18 })); // hub joining column top to canopy
  top.add(ball(t, 0.1, GOLD, [0, 0.66, 0], { metal: 0.6, rough: 0.3 }));
  // rim lamps (emissive — pop at night, faint glass tint by day) + three
  // REAL lights at every 4th lamp so the ground pools warm light
  const lampMats: THREE.MeshStandardMaterial[] = [];
  const rimLights: THREE.PointLight[] = [];
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const m = new t.MeshStandardMaterial({ color: 0xfff3c0, emissive: 0xffcc55, emissiveIntensity: 0.15, roughness: 0.4 });
    const lamp = new t.Mesh(new t.SphereGeometry(0.045, 10, 8), m);
    lamp.position.set(Math.cos(a) * (RIM + 0.04), 0.06, Math.sin(a) * (RIM + 0.04));
    top.add(lamp);
    lampMats.push(m);
    if (i % 4 === 0) {
      const pl = new t.PointLight(0xffcc66, 0, 3.5, 2);
      pl.position.set(Math.cos(a) * (RIM + 0.04), 0.0, Math.sin(a) * (RIM + 0.04));
      top.add(pl);
      rimLights.push(pl);
    }
  }

  // hangers: pivot AT the rim; two chains run down to the chair
  const N = 8;
  const hangers: THREE.Group[] = [];
  const seats: THREE.Group[] = [];
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2;
    const hanger = new t.Group();
    hanger.position.set(Math.cos(a) * RIM, 0.08, Math.sin(a) * RIM);
    hanger.rotation.y = -a; // local +x points radially outward
    top.add(hanger);
    [-0.09, 0.09].forEach((zz) =>
      hanger.add(cyl(t, 0.012, 0.012, CHAIN, 0xb9bec6, [0, -CHAIN / 2, zz], { tex: 'metal', metal: 0.7, rough: 0.35, seg: 6 })),
    );
    const chair = new t.Group();
    chair.position.y = -CHAIN;
    hanger.add(chair);
    chair.add(box(t, [0.3, 0.05, 0.3], 0x2f6fd0, [0, 0, 0], { tex: 'plastic', rough: 0.4 })); // seat pan
    chair.add(box(t, [0.05, 0.32, 0.3], 0x2f6fd0, [-0.14, 0.16, 0], { tex: 'plastic', rough: 0.4 })); // back (inboard side)
    chair.add(box(t, [0.24, 0.02, 0.24], 0x1a3f8a, [0.01, 0.03, 0], { tex: 'fabric', repeat: [2, 1], rough: 0.95 })); // padded pan cushion (pan top 0.025, 0.005 sunk)
    chair.add(box(t, [0.02, 0.24, 0.24], 0x1a3f8a, [-0.11, 0.16, 0], { tex: 'fabric', repeat: [1, 2], rough: 0.95 })); // back cushion (back inner face -0.115)
    chair.add(box(t, [0.035, 0.035, 0.32], GOLD, [0.1, 0.06, 0], { metal: 0.5, rough: 0.35 })); // safety bar across the rider's lap
    [-0.145, 0.145].forEach((zz) => chair.add(box(t, [0.26, 0.03, 0.03], GOLD, [-0.01, 0.06, zz], { metal: 0.5, rough: 0.35 }))); // armrests: seat back -> lap bar
    // seat anchor — the decorative rider's transform, kept even without
    // riders so `seatWorld` can carry REAL GameManager guests on the chair
    const seat = new t.Group();
    seat.position.set(-0.08, -0.14, 0); // hips on the pan, back against the backrest
    seat.rotation.y = Math.PI / 2; // face direction of travel
    chair.add(seat);
    seats.push(seat);
    if (withRiders) {
      const p = buildPeep(t, { skin: SKIN_TONES[i % SKIN_TONES.length], shirt: SHIRTS[i % SHIRTS.length], seated: true });
      p.group.scale.setScalar(0.36);
      p.group.userData.lodDetail = true; // park runtime hides riders beyond NEAR distance
      seat.add(p.group);
    }
    hangers.push(hanger);
  }

  // per-seat transform so REGISTERED rides carry real GameManager guests: the
  // guest rides the live flying chair, facing the direction of travel
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
  // the canopy eases to a stop (chairs settling inward) while
  // brokenDown/beingRepaired, then restarts after the repair
  let speedK = 1;
  let speedTarget = 1;
  let lastT = 0;
  let angle = 0;
  const onStateChange = (state: string) => {
    speedTarget = state === 'brokenDown' || state === 'beingRepaired' ? 0 : 1;
  };

  const update = (time: number, motionK = 1) => {
    const speed = 0.9;
    const dt = Math.min(Math.max(time - lastT, 0), 0.1);
    lastT = time;
    speedK += (speedTarget - speedK) * Math.min(1, dt * 1.5);
    const k = speedK * motionK; // breakdown envelope × station-gate envelope
    angle += dt * speed * speedK; // = time * speed while running free
    top.rotation.y = angle;
    const fling = 0.5 * k; // outward tilt from spin — settles as it stops
    hangers.forEach((h, i) => {
      h.rotation.z = fling + Math.sin(time * 1.6 + i) * 0.05 * (0.3 + 0.7 * k); // swing OUTWARD (+x is radial) + gentle flutter
    });
    // day -> night gate: rim lamps twinkle up, real lights pool below
    const nk = nightKOf(g);
    const ease = nk * nk * (3 - 2 * nk); // smoothstep
    lampMats.forEach((m, i) => (m.emissiveIntensity = 0.15 + (0.95 + Math.sin(time * 6 + i) * 0.25 - 0.15) * ease));
    rimLights.forEach((pl, i) => (pl.intensity = ease * (0.55 + 0.1 * Math.sin(time * 6 + i * 4))));
  };
  // station gate: canopy parked + chairs settled inward while guests
  // board/unload (spinDown 0.9: at rest before 'unloadingPassengers') —
  // composed WITH the breakdown spin-down above
  const gate = createMotionGate(update, { spinDown: 0.9 });
  const onStateChangeAll = (state: string) => {
    gate.onStateChange(state);
    onStateChange(state);
  };
  return { group: g, update: gate.update, seatWorld, vehicle: seats[0].parent as THREE.Object3D, onStateChange: onStateChangeAll };
}

export interface SwingRideProps {
  /** decorative riders (default: on standalone, off when `register`ed) */
  riders?: boolean;
}

/** local access geometry: only the 0.72 base pad obstructs at ground level
 *  (the chairs fly at y ≈ 2.6+), so the huts sit close in */
const SWING_LAYOUT: RideLayout = {
  front: 2.0,
  exit: [-1.5, 1.35],
  board: [0, 0.4, 0],
  defaults: { name: 'Swing Ride', capacity: 8, rideDuration: 8, intensity: 4, price: 3 },
};

/** <SwingRide> — composable ride (components/Park/Context.md): mounts the ride
 *  at `position`/`rotation`; inside a <Park>, `register` (true or `{ name,
 *  capacity, rideDuration, price, intensity }`) wires the full GameManager
 *  ride via <ConfigurableRide>. Access geometry (local frame, yaw =
 *  `rotation`): queue HEAD 2.0 out the +z front (lane extending +z, tail at
 *  `2.0 + laneLenOf(capacity) + 0.35`), exit hut at local [-1.5, 1.35]. REAL
 *  guests fly on the chairs via `seatWorld`; the canopy spins down on
 *  breakdown (`onStateChange`). Override with top-level props / `queue`. */
export const SwingRide: React.FC<SwingRideProps & ComposableRideProps> = (all) => {
  const { riders, register, position, rotation, scale, deps, ...rest } = all;
  return (
    <ConfigurableRide
      build={(t) => buildSwingRideScene(t, { riders: riders ?? !register })}
      layout={SWING_LAYOUT}
      register={register}
      position={position}
      rotation={rotation}
      scale={scale}
      deps={deps ?? [register, riders, rest]}
      {...rest}
    />
  );
};
SwingRide.displayName = 'SwingRide';

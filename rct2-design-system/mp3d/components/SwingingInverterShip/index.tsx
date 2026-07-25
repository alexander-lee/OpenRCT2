import React from 'react';
import * as THREE from 'three';
import { box, cyl, nightKOf } from '../Stage';
import { buildPeep, SHIRTS, SKIN_TONES } from '../Guest';
import { RideColourScheme } from '../ColorKit';
import { createMotionGate } from '../GameManager';
import { ConfigurableRide } from '../Park';
import type { ComposableRideProps, RideLayout } from '../Park';

// Swinging Inverter Ship modelled on the RCT2 Inverter Ship (HUSS Inverter
// silhouette): a single compact gondola rigidly bolted to a MASSIVE central
// arm slung between two lattice A-towers, with a steel counterweight disc on
// the short end. Two facing rows of riders under over-shoulder restraints ride
// through FULL 360° inversions: the swing cycle pumps up (pendulum easing),
// rolls through complete loops, then decays back to rest — one seamless,
// velocity-continuous deterministic curve. Night: amber accent bulbs climb the
// tower legs and strip lights run the arm; 2 real PointLights at the bearings.

export interface SwingingInverterShipOpts {
  scheme?: RideColourScheme;
  /** decorative peep riders in the gondola (default true). A ride registered
   *  in a <Park> turns them off so the GameManager seats REAL guests via
   *  `seatWorld` instead. */
  riders?: boolean;
}

export interface SwingingInverterShipBuilt {
  group: THREE.Group;
  update: (time: number) => void;
  /** per-seat world transform (seat -> live inverting gondola) for GameManager seatWorld */
  seatWorld: (seat: number) => [number, number, number, number];
  /** the gondola for the RideViewer onboard cam (userData.rideVehicle) */
  vehicle: THREE.Object3D;
  /** GameManager FSM hook — the swing cycle freezes while brokenDown/beingRepaired */
  onStateChange: (state: string) => void;
}

export function buildSwingingInverterShipScene(three: typeof THREE, opts: SwingingInverterShipOpts = {}): SwingingInverterShipBuilt {
  const t = three;
  const g = new t.Group();
  const scheme = opts.scheme;
  const withRiders = opts.riders ?? true;
  const pivotY = 3.25;
  const FRAME = scheme?.track.supports ?? 0x2456b0; // royal-blue lattice towers
  const ARM = scheme?.track.main ?? 0xaeb4bc; // pale steel arm
  const GON = scheme?.vehicles[0]?.body ?? 0xc9a616; // golden-yellow gondola
  const TRIM = scheme?.vehicles[0]?.trim ?? 0x24242a; // restraint steel
  const STEEL = 0x3a3f47;

  // ---- lattice A-towers (frames at z = ±0.95) -------------------------
  const legBotX = 1.55;
  const legTopX = 0.18;
  const hwAt = (y: number) => legBotX - ((legBotX - legTopX) / pivotY) * y;
  const legAng = Math.atan2(legBotX - legTopX, pivotY);
  const legLen = Math.hypot(legBotX - legTopX, pivotY) + 0.15;
  [-1, 1].forEach((zs) => {
    const z = zs * 0.95;
    [-1, 1].forEach((xs) => {
      g.add(
        box(t, [0.13, legLen, 0.13], FRAME, [(xs * (legBotX + legTopX)) / 2, pivotY / 2, z], {
          tex: 'metal', repeat: [1, 8], metal: 0.35, rough: 0.5, rotZ: xs * legAng,
        }),
      );
      g.add(box(t, [0.55, 0.14, 0.45], 0x8a8f98, [xs * legBotX, 0.07, z], { tex: 'concrete', rough: 0.9 })); // footing
    });
    // lattice rungs + zig-zag diagonals between the two legs of the frame
    const rungYs = [0.55, 1.1, 1.65, 2.2, 2.75];
    rungYs.forEach((y, i) => {
      const hw = hwAt(y);
      g.add(box(t, [hw * 2, 0.055, 0.055], FRAME, [0, y, z], { metal: 0.35, rough: 0.5 }));
      const yPrev = i === 0 ? 0.05 : rungYs[i - 1];
      const hwPrev = hwAt(yPrev);
      const dir = i % 2 ? 1 : -1; // alternate diagonal direction
      const dx = dir * hwPrev + dir * hw;
      const dLen = Math.hypot(dx, y - yPrev);
      g.add(
        box(t, [dLen, 0.045, 0.045], FRAME, [(-dir * hwPrev + dir * hw) / 2, (y + yPrev) / 2, z], {
          metal: 0.35, rough: 0.5, rotZ: Math.atan2(y - yPrev, dx),
        }),
      );
    });
    // bearing housing at the frame apex
    g.add(box(t, [0.4, 0.34, 0.22], STEEL, [0, pivotY, z], { tex: 'metal', metal: 0.5, rough: 0.4 }));
  });
  // portal ties between the frames near the apex
  [-0.32, 0.32].forEach((x) => g.add(box(t, [0.09, 0.09, 1.9], FRAME, [x, 2.85, 0], { metal: 0.35, rough: 0.5 })));
  // main axle + hub caps
  g.add(cyl(t, 0.11, 0.11, 2.2, STEEL, [0, pivotY, 0], { rotX: Math.PI / 2, metal: 0.6, rough: 0.35, seg: 14 }));
  [-1.06, 1.06].forEach((z) => g.add(cyl(t, 0.18, 0.18, 0.09, GON, [0, pivotY, z], { rotX: Math.PI / 2, metal: 0.4, rough: 0.45, seg: 16 })));

  // ---- night rig: leg accent bulbs + arm strips + 2 bearing lights ----
  const bulbGeo = new t.SphereGeometry(0.05, 10, 8);
  const bulbMat = new t.MeshStandardMaterial({ color: 0xfff3c0, emissive: 0xffb040, emissiveIntensity: 0.15, roughness: 0.35 });
  [-1, 1].forEach((zs) =>
    [-1, 1].forEach((xs) => {
      for (let i = 0; i < 5; i++) {
        const f = 0.14 + i * 0.17;
        const bulb = new t.Mesh(bulbGeo, bulbMat);
        // bulbs ride the leg centreline (leg is 0.13 thick — they sit proud)
        bulb.position.set(xs * (legBotX + (legTopX - legBotX) * f), pivotY * f, zs * 0.98);
        g.add(bulb);
      }
    }),
  );
  const stripMat = new t.MeshStandardMaterial({ color: 0xffd090, emissive: 0xff9030, emissiveIntensity: 0.12, roughness: 0.4 });
  const nightLights: { intensity: number }[] = [];
  [-1.15, 1.15].forEach((z) => {
    const pl = new t.PointLight(0xffc97a, 0, 7, 2);
    pl.position.set(0, pivotY - 0.15, z);
    g.add(pl);
    nightLights.push(pl);
  });
  const deckLight = new t.PointLight(0xffd9a0, 0, 5, 2); // platform up-wash
  deckLight.position.set(0, 0.7, 0);
  g.add(deckLight);

  // ---- boarding platform under the gondola's rest position ------------
  // (gondola keel bottoms out at y ≈ 0.49 — deck top 0.22 stays clear)
  g.add(box(t, [1.7, 0.22, 2.5], 0x8a8f98, [0, 0.11, 0], { tex: 'concrete', repeat: [5, 6], rough: 0.9 }));
  [-1, 1].forEach((zs) => g.add(box(t, [1.74, 0.05, 0.07], 0xd8b040, [0, 0.205, zs * 1.24], { metal: 0.3, rough: 0.6 }))); // hazard kerbs
  [-1, 1].forEach((xs) => g.add(box(t, [0.07, 0.05, 2.54], 0xd8b040, [xs * 0.845, 0.205, 0], { metal: 0.3, rough: 0.6 })));
  [-1, 1].forEach((zs) => g.add(box(t, [0.9, 0.1, 0.5], 0x8a8f98, [0, 0.05, zs * 1.48], { tex: 'concrete', repeat: [3, 1], rough: 0.9 }))); // steps
  // queue railings along both platform edges (clear of the swing plane)
  [-1, 1].forEach((zs) => {
    [-0.7, 0, 0.7].forEach((x) => g.add(cyl(t, 0.02, 0.02, 0.36, STEEL, [x, 0.4, zs * 1.2], { metal: 0.5, rough: 0.5, seg: 6 })));
    g.add(box(t, [1.5, 0.035, 0.035], STEEL, [0, 0.57, zs * 1.2], { metal: 0.5, rough: 0.5 }));
  });

  // ---- the arm assembly (rotates about the axle) ----------------------
  const arm = new t.Group();
  arm.position.set(0, pivotY, 0);
  g.add(arm);
  // MASSIVE tapered main arm: broad root plate + long shaft + gussets
  arm.add(box(t, [0.52, 0.9, 0.2], ARM, [0, -0.42, 0], { tex: 'metal', repeat: [2, 3], metal: 0.4, rough: 0.45 }));
  arm.add(box(t, [0.32, 2.1, 0.17], ARM, [0, -1.35, 0], { tex: 'metal', repeat: [1, 8], metal: 0.4, rough: 0.45 }));
  [-1, 1].forEach((s) => arm.add(box(t, [0.07, 1.9, 0.19], STEEL, [s * 0.13, -1.3, 0], { metal: 0.5, rough: 0.4 }))); // edge chords
  // arm strip lights down both faces of the shaft
  [-1, 1].forEach((zs) => {
    const strip = new t.Mesh(new t.BoxGeometry(0.05, 1.9, 0.02), stripMat);
    strip.position.set(0, -1.3, zs * 0.095);
    arm.add(strip);
  });
  // counterweight: short counter-arm + heavy steel disc + trim ring
  arm.add(box(t, [0.34, 1.0, 0.17], ARM, [0, 0.5, 0], { tex: 'metal', repeat: [1, 4], metal: 0.4, rough: 0.45 }));
  arm.add(cyl(t, 0.52, 0.52, 0.3, STEEL, [0, 1.05, 0], { rotX: Math.PI / 2, tex: 'metal', repeat: [4, 1], metal: 0.55, rough: 0.4, seg: 24 }));
  arm.add(cyl(t, 0.53, 0.53, 0.1, GON, [0, 1.05, 0], { rotX: Math.PI / 2, metal: 0.4, rough: 0.45, seg: 24 })); // trim band
  [-0.17, 0.17].forEach((z) => arm.add(cyl(t, 0.09, 0.09, 0.06, GON, [0, 1.05, z], { rotX: Math.PI / 2, metal: 0.4, rough: 0.4, seg: 12 }))); // hub bolts

  // ---- gondola: rigid tub, two facing rows of 3, OTSRs ----------------
  const gon = new t.Group();
  gon.position.y = -2.45;
  arm.add(gon);
  // spine + risers tying the tub to the arm shaft (arm shaft ends -2.4)
  gon.add(box(t, [0.14, 0.12, 1.34], ARM, [0, 0.34, 0], { metal: 0.4, rough: 0.45 }));
  [-0.55, 0.55].forEach((z) => gon.add(box(t, [0.09, 0.34, 0.09], ARM, [0, 0.19, z], { metal: 0.4, rough: 0.45 })));
  // hull tub: golden body, dark interior well, upswept ends
  gon.add(box(t, [1.0, 0.32, 1.5], GON, [0, -0.1, 0], { tex: 'plastic', repeat: [4, 1], rough: 0.45 }));
  gon.add(box(t, [0.86, 0.1, 1.36], 0x23262c, [0, 0.06, 0], { tex: 'plastic', repeat: [4, 2], rough: 0.7 })); // interior well (top 0.11)
  gon.add(box(t, [0.92, 0.07, 1.42], 0x8f959d, [0, -0.28, 0], { tex: 'metal', repeat: [3, 4], metal: 0.5, rough: 0.4 })); // keel plate
  [-1, 1].forEach((xs) => gon.add(box(t, [0.08, 0.05, 1.5], GON, [xs * 0.44, -0.29, 0], { metal: 0.3, rough: 0.5 }))); // gold rub strakes
  gon.add(box(t, [0.6, 0.05, 0.3], TRIM, [0, -0.3, 0], { metal: 0.5, rough: 0.4 })); // belly access hatch
  [-1, 1].forEach((s) => {
    gon.add(box(t, [0.98, 0.34, 0.42], GON, [0, 0.0, s * 0.78], { tex: 'plastic', repeat: [3, 1], rough: 0.45, rotX: -s * 0.5 })); // upswept prow
    gon.add(box(t, [1.0, 0.05, 0.05], TRIM, [0, 0.2, s * 0.9], { metal: 0.5, rough: 0.4, rotX: -s * 0.5 })); // prow rail
  });
  // side grab rails along the gunwales
  [-1, 1].forEach((xs) => gon.add(box(t, [0.04, 0.04, 1.4], TRIM, [xs * 0.49, 0.1, 0], { metal: 0.5, rough: 0.4 })));

  // seats: rows at x = ±0.27 facing EACH OTHER across the swing direction
  const seatAnchors: THREE.Group[] = [];
  for (let r = 0; r < 2; r++) {
    const xs = r === 0 ? 1 : -1;
    // full-row chest restraint rail (in front of the riders' chests)
    gon.add(box(t, [0.05, 0.05, 1.26], TRIM, [xs * 0.1, 0.35, 0], { metal: 0.5, rough: 0.4 }));
    [-0.63, 0.63].forEach((z) => gon.add(box(t, [0.18, 0.05, 0.05], TRIM, [xs * 0.19, 0.35, z], { metal: 0.5, rough: 0.4 }))); // rail ties into the prows
    for (let i = 0; i < 3; i++) {
      const z = -0.42 + i * 0.42;
      const seat = new t.Group();
      seat.position.set(xs * 0.27, 0, z);
      seat.rotation.y = xs > 0 ? -Math.PI / 2 : Math.PI / 2; // face the centre
      gon.add(seat);
      seat.add(box(t, [0.3, 0.06, 0.26], 0x2f333a, [0, 0.14, -0.03], { rough: 0.6 })); // seat pan
      seat.add(box(t, [0.24, 0.03, 0.2], 0x7a2020, [0, 0.185, -0.02], { tex: 'fabric', repeat: [2, 1], rough: 0.95 })); // pan cushion
      seat.add(box(t, [0.3, 0.4, 0.06], 0x2f333a, [0, 0.34, -0.19], { rough: 0.6 })); // seat back
      seat.add(box(t, [0.22, 0.3, 0.025], 0x7a2020, [0, 0.32, -0.155], { tex: 'fabric', repeat: [2, 2], rough: 0.95 })); // back cushion
      seat.add(box(t, [0.14, 0.08, 0.03], 0x7a2020, [0, 0.545, -0.15], { tex: 'fabric', rough: 0.95 })); // headrest
      // seat anchor — the decorative rider's transform, kept even without
      // riders so `seatWorld` can carry REAL GameManager guests in the tub
      const anchor = new t.Group();
      anchor.position.set(0, 0.035, -0.04); // hips sunk ~0.01 into the cushion
      seat.add(anchor);
      seatAnchors.push(anchor);
      if (withRiders) {
        const p = buildPeep(t, {
          skin: SKIN_TONES[(r * 3 + i) % SKIN_TONES.length],
          shirt: SHIRTS[(r * 3 + i) % SHIRTS.length],
          seated: true,
          expression: 'surprised',
          female: (r * 3 + i) % 2 === 1,
        });
        p.group.userData.lodDetail = true; // park runtime hides riders beyond NEAR distance
        p.group.scale.setScalar(0.34);
        anchor.add(p.group);
      }
      // over-shoulder restraint: two vertical bars over the shoulders
      // dropping to a chest pad (chest front z ≈ 0.028)
      [-0.055, 0.055].forEach((dx) => seat.add(box(t, [0.035, 0.24, 0.035], TRIM, [dx, 0.36, 0.02], { metal: 0.5, rough: 0.4 })));
      seat.add(box(t, [0.15, 0.09, 0.04], TRIM, [0, 0.255, 0.035], { rough: 0.6 })); // chest pad
    }
  }
  // gondola marker bulbs on both prow tips
  [-1, 1].forEach((s) => {
    const bulb = new t.Mesh(bulbGeo, bulbMat);
    bulb.position.set(0, 0.28, s * 0.93);
    gon.add(bulb);
  });

  // ---- the inversion cycle: pump-up → full loops → decay --------------
  // velocity-continuous piecewise curve, period 26 s. W = 4π/9 keeps the
  // pendulum phase hitting zero exactly at each hand-off.
  const W = (4 * Math.PI) / 9;
  const V0 = 2.7 * W; // hand-off angular velocity into the loops
  const V1 = (10 * Math.PI) / 4 - V0; // loop exit velocity (5 full loops)
  const A2 = V1 / W; // decay start amplitude — matches V1 exactly
  const ss = (v: number) => {
    const c = Math.max(0, Math.min(1, v));
    return c * c * (3 - 2 * c);
  };
  const swingAngle = (tt: number) => {
    const u = tt % 26;
    if (u < 9) return 2.7 * ss(u / 9) * Math.sin(W * u); // pump-up swings
    if (u < 17) {
      const s = u - 9;
      return V0 * s + ((V1 - V0) * s * s) / 16; // 5 continuous inversions
    }
    const s = u - 17;
    return A2 * (1 - ss(s / 9)) * Math.sin(W * s); // decaying swings
  };

  // per-seat transform so REGISTERED rides carry real GameManager guests
  const _v = new t.Vector3();
  const _q = new t.Quaternion();
  const _e = new t.Euler();
  const seatWorld = (seat: number): [number, number, number, number] => {
    const s = seatAnchors[seat % seatAnchors.length];
    s.updateWorldMatrix(true, false);
    _v.set(0, 0, 0).applyMatrix4(s.matrixWorld);
    s.getWorldQuaternion(_q);
    _e.setFromQuaternion(_q, 'YXZ');
    return [_v.x, _v.y, _v.z, _e.y];
  };

  // FSM spin-down: the swing cycle runs on its OWN integrated clock, so a
  // breakdown eases the cycle speed to zero (the arm freezes where it is,
  // RCT2-style) and the repair eases it back up — velocity-continuous.
  let speedK = 1;
  let speedTarget = 1;
  let lastT = 0;
  let cycleT = 0;
  const onStateChange = (state: string) => {
    speedTarget = state === 'brokenDown' || state === 'beingRepaired' ? 0 : 1;
  };

  const update = (time: number, motionK = 1) => {
    const nk = nightKOf(g);
    const ease = nk * nk * (3 - 2 * nk); // smoothstep
    bulbMat.emissiveIntensity = 0.15 + (2.1 - 0.15) * ease;
    stripMat.emissiveIntensity = 0.12 + (2.2 + 0.4 * Math.sin(time * 5) - 0.12) * ease;
    nightLights.forEach((pl) => (pl.intensity = ease * 1.5));
    deckLight.intensity = ease * 1.2;
    const dt = Math.min(Math.max(time - lastT, 0), 0.1);
    lastT = time;
    speedK += (speedTarget - speedK) * Math.min(1, dt * 1.5);
    cycleT += dt * speedK; // = time while running free
    const env = motionK * motionK * (3 - 2 * motionK); // station-gate settle: the arm swings back down to hang LEVEL
    arm.rotation.z = swingAngle(cycleT) * env;
  };
  // station gate: the arm hangs level while guests board/unload. spinDown
  // 0.85 puts it fully at rest inside the 1 s 'arriving' phase, and every
  // departure restarts the pump-up→loops→decay cycle from zero (composed
  // WITH the breakdown freeze above).
  const gate = createMotionGate(update, { spinDown: 0.85 });
  const onStateChangeAll = (state: string) => {
    gate.onStateChange(state);
    if (state === 'departing') cycleT = 0; // each run starts at the pump-up
    onStateChange(state);
  };
  return { group: g, update: gate.update, seatWorld, vehicle: gon, onStateChange: onStateChangeAll };
}

export interface SwingingInverterShipProps {
  scheme?: RideColourScheme;
  /** decorative riders (default: on standalone, off when `register`ed) */
  riders?: boolean;
}

/** local access geometry: the boarding platform + steps run to z ±1.73 and the
 *  gondola loops sweep ±x (radius ~3.4 in the x-y plane, z within ±0.95), so
 *  the queue hut (spans front−1.12..front−0.12) sits past the steps and the
 *  exit hut stands beside them, outside the tower footings */
const INVERTER_LAYOUT: RideLayout = {
  front: 3.0,
  exit: [-1.6, 1.8],
  board: [0, 0.3, 0],
  defaults: { name: 'Swinging Inverter Ship', capacity: 6, rideDuration: 8, intensity: 9, price: 4 },
};

/** <SwingingInverterShip> — composable ride (components/Park/Context.md):
 *  mounts the ride at `position`/`rotation`; inside a <Park>, `register`
 *  (true or `{ name, capacity, rideDuration, price, intensity }`) wires the
 *  full GameManager ride via <ConfigurableRide>. Access geometry (local
 *  frame, yaw = `rotation`): queue HEAD 3.0 out the +z front — past the
 *  boarding-platform steps — lane extending +z (tail at `3.0 +
 *  laneLenOf(capacity) + 0.35`), exit hut at local [-1.6, 1.8]. REAL guests
 *  ride the gondola through the inversions via `seatWorld`; the cycle freezes
 *  on breakdown and resumes after repair (`onStateChange`). Override with
 *  top-level props / `queue`. */
export const SwingingInverterShip: React.FC<SwingingInverterShipProps & ComposableRideProps> = (all) => {
  const { scheme, riders, register, position, rotation, scale, deps, ...rest } = all;
  return (
    <ConfigurableRide
      build={(t) => buildSwingingInverterShipScene(t, { scheme, riders: riders ?? !register })}
      layout={INVERTER_LAYOUT}
      register={register}
      position={position}
      rotation={rotation}
      scale={scale}
      deps={deps ?? [register, riders, scheme, rest]}
      {...rest}
    />
  );
};
SwingingInverterShip.displayName = 'SwingingInverterShip';

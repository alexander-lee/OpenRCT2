import React from 'react';
import * as THREE from 'three';
import { box, cyl, nightKOf } from '../Stage';
import { buildPeep } from '../Guest';
import { createMotionGate, makeSeatWorld } from '../GameManager';
import { composableRide } from '../Park';

// Space rings matched to the RCT2 SRINGS sprite: rust-orange gyroscope rings
// on a simple frame — an outer ring rocks while the inner ring tumbles with a
// strapped-in rider spread-eagle at the centre.
export function buildSpaceRingsScene(
  three: typeof THREE,
  opts: { riders?: boolean } = {},
): {
  group: THREE.Group;
  update?: (time: number) => void;
  vehicle?: THREE.Object3D;
  seatWorld: (seat: number) => [number, number, number, number];
  onStateChange: (state: string) => void;
} {
  const group = new three.Group();
  const withRiders = opts.riders ?? true; // decorative — off when registered so the REAL guest is strapped in
  const seats: THREE.Group[] = []; // the single ring anchor (seatWorld)
  let vehicle: THREE.Object3D | undefined; // the rider-carrying inner ring — the RideViewer follow cam tracks it (userData.rideVehicle)
  const update =
    ((t: typeof THREE, g: THREE.Group) => {
        const RUST = 0x8a92a0; // brushed-steel rings (realistic)
        const DARK = 0x3c4450;
        g.add(cyl(t, 1.3, 1.4, 0.14, 0x8a8f98, [0, 0.07, 0], { tex: 'concrete', repeat: [10, 1], rough: 0.9, seg: 28 }));
        // frame posts holding the outer ring's pivot
        [-1, 1].forEach((s) => {
          g.add(cyl(t, 0.06, 0.08, 1.15, DARK, [s * 1.05, 0.7, 0], { tex: 'metal', metal: 0.4, rough: 0.55, seg: 10 }));
          g.add(cyl(t, 0.1, 0.1, 0.14, RUST, [s * 1.05, 1.28, 0], { rotZ: Math.PI / 2, metal: 0.4, rough: 0.5, seg: 12 })); // pivot boss reaching INTO the ring (inner end 0.98 < ring edge 1.0)
        });
        const outer = new t.Group();
        outer.position.y = 1.28;
        g.add(outer);
        const ringO = new t.Mesh(new t.TorusGeometry(0.95, 0.05, 10, 36), new t.MeshStandardMaterial({ color: RUST, metalness: 0.35, roughness: 0.5 }));
        outer.add(ringO);
        const inner = new t.Group();
        outer.add(inner);
        vehicle = inner;
        const ringI = new t.Mesh(new t.TorusGeometry(0.72, 0.045, 10, 32), new t.MeshStandardMaterial({ color: 0xb8c0cc, metalness: 0.5, roughness: 0.4 }));
        ringI.rotation.y = Math.PI / 2;
        inner.add(ringI);
        // rider strapped upright in the inner ring: feet on a foot platform whose
        // ends bury into the ring tube, body centre at the ring centre, and wrist
        // straps running from the hands out into the ring tube — no air gaps.
        // ring anchor — the REAL GameManager guest lands here via seatWorld
        const seat = new t.Group();
        seat.position.y = -0.66; // feet on the platform, body midpoint at the ring centre
        seat.rotation.y = Math.PI / 2; // shoulders in the ring plane, hands beside the tube
        inner.add(seat);
        seats.push(seat);
        if (withRiders) {
          const p = buildPeep(t, { shirt: 0x2f6fd0, seated: false, expression: 'surprised' });
          p.group.scale.setScalar(1.15);
          seat.add(p.group);
        }
        inner.add(box(t, [0.2, 0.05, 0.62], 0x24242a, [0, -0.66, 0], { metal: 0.5, rough: 0.4 })); // foot platform spanning the ring
        [-1, 1].forEach((zs) => inner.add(cyl(t, 0.022, 0.022, 0.57, 0x24242a, [0, -0.02, zs * 0.45], { rotX: Math.PI / 2, metal: 0.5, rough: 0.4, seg: 6 }))); // wrist straps: hand ball -> ring tube
        // bearing collars bridging the inner ring to the outer ring (top + bottom)
        [-1, 1].forEach((ys) => outer.add(cyl(t, 0.035, 0.035, 0.26, 0x24242a, [0, ys * 0.835, 0], { metal: 0.5, rough: 0.4, seg: 8 })));
        // night lighting (minimal — gyro rings carry no show bulbs): one small
        // pad floodlamp atop each frame post (stalks 1.27..1.51 rooted in the
        // post tops at 1.275; lamp heads at 1.53, radial 1.079 from the pivot,
        // clear of the rocking outer ring's 1.0 sweep) + one real light
        const lampMat = new t.MeshStandardMaterial({ color: 0xfff3c0, emissive: 0xffcc55, emissiveIntensity: 0.15, roughness: 0.35 });
        [-1, 1].forEach((s) => {
          g.add(cyl(t, 0.02, 0.02, 0.24, DARK, [s * 1.05, 1.39, 0], { metal: 0.5, rough: 0.5, seg: 8 }));
          const head = new t.Mesh(new t.SphereGeometry(0.05, 10, 8), lampMat);
          head.position.set(s * 1.05, 1.53, 0);
          g.add(head);
        });
        const padLight = new t.PointLight(0xffc97a, 0, 4.5, 2);
        padLight.position.set(0.7, 2.0, 0.55); // held away from the post/lamp so nothing blows out at close range
        g.add(padLight);
        return (time: number, motionK = 1) => {
          // day -> night gate for the pad floodlight
          const nk = nightKOf(g);
          const ease = nk * nk * (3 - 2 * nk); // smoothstep
          lampMat.emissiveIntensity = 0.15 + (1.1 - 0.15) * ease;
          padLight.intensity = ease * 0.6;
          outer.rotation.z = Math.sin(time * 0.9) * 0.7 * motionK; // rock settles level when parked
          // tumble settles to the NEAREST upright turn as the gate closes, so
          // the guest is strapped in / released standing up (motionK 1 = raw)
          const raw = time * 1.7;
          const uprightTurn = Math.round(raw / (Math.PI * 2)) * Math.PI * 2;
          inner.rotation.x = uprightTurn + (raw - uprightTurn) * motionK;
        };
      })(three, group) || undefined;
  // station gate: rings parked upright while the guest boards/unloads
  // (spinDown 0.9 — settled before 'unloadingPassengers' begins)
  const gate = createMotionGate((tt, k) => update?.(tt, k), { spinDown: 0.9 });
  return { group, update: gate.update, vehicle, seatWorld: makeSeatWorld(three, seats), onStateChange: gate.onStateChange };
}

/** <SpaceRings> — composable ride (components/Park/Context.md): mounts the ride
 *  at `position`/`rotation`; inside a <Park>, `register` wires the full
 *  GameManager ride via <ConfigurableRide> — queue HEAD 1.5 out the local +z
 *  front (lane extending +z), exit hut beside it at local [-1.5, 1.35],
 *  boarding at the base. Capacity 1 = the single gyroscope harness: the REAL
 *  guest is strapped in via `seatWorld` (decorative rider off when
 *  registered) and the rings are motion-gated — parked UPRIGHT for
 *  boarding/unloading. Override with top-level props / `queue`. */
export const SpaceRings = composableRide<{ riders?: boolean }>(
  'SpaceRings',
  (t, props) => buildSpaceRingsScene(t, { riders: props.riders ?? !(props as { register?: unknown }).register }),
  { defaults: { name: 'Space Rings', capacity: 1, rideDuration: 7, intensity: 3, price: 1 } },
);

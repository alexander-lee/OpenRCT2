import React from 'react';
import * as THREE from 'three';
import { box, cyl, nightKOf } from '../Stage';
import { createMotionGate, makeSeatWorld } from '../GameManager';
import { composableRide } from '../Park';

// Motion simulator matched to the RCT2 SIMPOD sprite: a WHITE capsule pod with
// PINK racing stripes, mounted on six slate hydraulic rams that pitch and roll
// it through a flight program. Warning chevrons on the base plate.
export function buildMotionSimulatorScene(three: typeof THREE): {
  group: THREE.Group;
  update?: (time: number) => void;
  vehicle?: THREE.Object3D;
  seatWorld: (seat: number) => [number, number, number, number];
  onStateChange: (state: string) => void;
} {
  const group = new three.Group();
  const seats: THREE.Group[] = []; // 4 anchors INSIDE the enclosed pod (seatWorld)
  let vehicle: THREE.Object3D | undefined; // the simulator capsule — the RideViewer follow cam tracks it (userData.rideVehicle)
  const update =
    ((t: typeof THREE, g: THREE.Group) => {
        const WHITE = 0xe8ecee; // pod (sprite #e0f0f0)
        const PINK = 0x2456b0; // royal-blue racing stripes (realistic)
        const SLATE = 0x54646a; // rams (sprite #608080)
        g.add(box(t, [2.2, 0.18, 2.2], 0x8a8f98, [0, 0.09, 0], { tex: 'concrete', repeat: [7, 7], rough: 0.9 }));
        for (let i = 0; i < 6; i++) g.add(box(t, [0.3, 0.03, 0.14], i % 2 ? 0xe8b020 : 0x1c1c20, [-0.75 + i * 0.3, 0.195, 0.95], { rough: 0.6 })); // chevrons flush on the base top
        const pod = new t.Group();
        pod.position.y = 1.05;
        g.add(pod);
        vehicle = pod;
        // hydraulic rams (hexapod layout): piston + sleeve per leg, anchored in the
        // base plate and re-aimed every frame at a fixed point on the pod underside
        const up = new t.Vector3(0, 1, 0);
        const rams: { piston: THREE.Mesh; sleeve: THREE.Mesh; base: THREE.Vector3; attach: THREE.Vector3 }[] = [];
        for (let i = 0; i < 6; i++) {
          const a = (Math.floor(i / 2) / 3) * Math.PI * 2 + (i % 2 ? 0.35 : -0.35);
          const base = new t.Vector3(Math.cos(a) * 0.85, 0.14, Math.sin(a) * 0.85); // embedded in the base plate
          const attach = new t.Vector3(Math.cos(a) * 0.5, -0.34, Math.sin(a) * 0.5); // pod-local, just inside the underside
          const piston = cyl(t, 0.042, 0.042, 1, SLATE, [0, 0, 0], { tex: 'metal', metal: 0.6, rough: 0.35, seg: 10 });
          const sleeve = cyl(t, 0.075, 0.085, 0.45, SLATE, [0, 0, 0], { tex: 'metal', metal: 0.5, rough: 0.45, seg: 10 });
          g.add(piston);
          g.add(sleeve);
          rams.push({ piston, sleeve, base, attach });
        }
        const ramTop = new t.Vector3();
        const ramDir = new t.Vector3();
        // pod: layered white capsule + pink stripes + door + vents
        pod.add(box(t, [1.5, 0.75, 1.15], WHITE, [0, 0, 0], { tex: 'plastic', repeat: [4, 2], rough: 0.35 }));
        pod.add(box(t, [1.56, 0.09, 1.2], PINK, [0, -0.18, 0], { rough: 0.45 }));
        pod.add(box(t, [1.56, 0.05, 1.2], PINK, [0, -0.32, 0], { rough: 0.45 }));
        pod.add(box(t, [1.2, 0.4, 0.9], WHITE, [0, 0.5, 0], { tex: 'plastic', repeat: [3, 1], rough: 0.35 })); // cap tier
        pod.add(box(t, [0.36, 0.5, 0.04], 0x2a3236, [0, -0.05, 0.59], { rough: 0.6 })); // door
        pod.add(box(t, [0.3, 0.06, 0.02], 0xe8b020, [0, 0.24, 0.585], { rough: 0.5 })); // sign, backed onto the pod face
        [-0.45, 0.45].forEach((x) => pod.add(box(t, [0.24, 0.16, 0.02], 0x54646a, [x, 0.5, -0.46], { metal: 0.4, rough: 0.5 }))); // vents on the cap tier rear (front carries the visor)
        // panel seam lines over the white shell (flush strips — mesh richness)
        [-0.5, 0.5].forEach((x) => {
          pod.add(box(t, [0.02, 0.56, 0.02], 0xc7ced2, [x, 0.02, 0.57], { rough: 0.5 })); // front-face seams flanking the door
          pod.add(box(t, [0.02, 0.56, 0.02], 0xc7ced2, [x, 0.02, -0.57], { rough: 0.5 })); // back-face seams
        });
        [-0.3, 0.3].forEach((z) => [-1, 1].forEach((s) => pod.add(box(t, [0.02, 0.56, 0.02], 0xc7ced2, [s * 0.74, 0.02, z], { rough: 0.5 })))); // side-face seams
        // simulator windscreen visor band on the cap tier front (glows at dusk)
        const visorMat = new t.MeshStandardMaterial({ color: 0x22303a, emissive: 0x1a3a55, emissiveIntensity: 0.3, roughness: 0.25, metalness: 0.3 });
        const visor = new t.Mesh(new t.BoxGeometry(0.86, 0.2, 0.03), visorMat);
        visor.position.set(0, 0.52, 0.45);
        visor.castShadow = true;
        pod.add(visor);
        [-1, 1].forEach((s) => pod.add(box(t, [0.05, 0.2, 0.03], PINK, [s * 0.47, 0.52, 0.45], { rough: 0.45 }))); // blue visor end caps
        // hazard skirt strip along the pod underside edge
        pod.add(box(t, [1.52, 0.04, 1.16], 0x54646a, [0, -0.395, 0], { tex: 'metal', metal: 0.4, rough: 0.5 }));
        // 4 seat anchors INSIDE the enclosed pod (2 rows of 2, facing the
        // visor) — REAL GameManager guests ride the motion program invisibly,
        // like RCT2's windowless SIMPOD car
        [-0.18, 0.18].forEach((sz) =>
          [-0.33, 0.33].forEach((sx) => {
            const seat = new t.Group();
            seat.position.set(sx, -0.34, sz);
            pod.add(seat);
            seats.push(seat);
          }),
        );
        // night lighting (minimal — the pod is enclosed, so only an entrance
        // lamp is realistic): warm lamp above the door (back face 0.56 embeds
        // in the pod face 0.575) + one real light washing the doorway, both
        // riding the pod so they follow the motion program
        const lampMat = new t.MeshStandardMaterial({ color: 0xfff3c0, emissive: 0xffcc55, emissiveIntensity: 0.15, roughness: 0.35 });
        const doorLamp = new t.Mesh(new t.BoxGeometry(0.12, 0.05, 0.06), lampMat);
        doorLamp.position.set(0, 0.33, 0.59);
        pod.add(doorLamp);
        const doorLight = new t.PointLight(0xffc97a, 0, 3, 2);
        doorLight.position.set(0, 0.3, 0.85);
        pod.add(doorLight);
        // amber marker lamps on the base-plate corners (static, night-gated)
        for (const sx of [-1, 1])
          for (const sz of [-1, 1]) {
            g.add(cyl(t, 0.025, 0.03, 0.1, 0x54646a, [sx * 1.02, 0.23, sz * 1.02], { metal: 0.4, rough: 0.5, seg: 8 }));
            const marker = new t.Mesh(new t.SphereGeometry(0.035, 10, 8), lampMat);
            marker.position.set(sx * 1.02, 0.29, sz * 1.02);
            g.add(marker);
          }
        return (time: number, motionK = 1) => {
          // day -> night gate for the entrance lamp + corner markers + visor glow
          const nk = nightKOf(g);
          const ease = nk * nk * (3 - 2 * nk); // smoothstep
          lampMat.emissiveIntensity = 0.15 + (1.2 - 0.15) * ease;
          visorMat.emissiveIntensity = 0.3 + 1.1 * ease;
          doorLight.intensity = ease * 0.8;
          pod.rotation.x = Math.sin(time * 1.7) * 0.16 * motionK; // settles level when parked
          pod.rotation.z = Math.sin(time * 1.1 + 1) * 0.14 * motionK;
          pod.position.y = 1.05 + Math.sin(time * 2.3) * 0.06 * motionK;
          rams.forEach((r) => {
            ramTop.copy(r.attach).applyEuler(pod.rotation).add(pod.position);
            ramDir.subVectors(ramTop, r.base);
            const len = ramDir.length();
            ramDir.normalize();
            r.piston.scale.y = len;
            r.piston.position.copy(r.base).addScaledVector(ramDir, len / 2);
            r.piston.quaternion.setFromUnitVectors(up, ramDir);
            r.sleeve.position.copy(r.base).addScaledVector(ramDir, 0.225);
            r.sleeve.quaternion.setFromUnitVectors(up, ramDir);
          });
        };
      })(three, group) || undefined;
  // station gate: the pod settles LEVEL while guests board/unload (spinDown
  // 0.9 — at rest before 'unloadingPassengers' begins)
  const gate = createMotionGate((tt, k) => update?.(tt, k), { spinDown: 0.9 });
  return { group, update: gate.update, vehicle, seatWorld: makeSeatWorld(three, seats), onStateChange: gate.onStateChange };
}

/** <MotionSimulator> — composable ride (components/Park/Context.md): mounts the ride
 *  at `position`/`rotation`; inside a <Park>, `register` wires the full
 *  GameManager ride via <ConfigurableRide> — queue HEAD 1.5 out the local +z
 *  front (lane extending +z), exit hut beside it at local [-1.5, 1.35],
 *  boarding at the base. Capacity 4 = the enclosed pod's 2×2 seat grid: REAL
 *  guests ride the motion program on interior `seatWorld` anchors (hidden by
 *  the opaque shell, RCT2 SIMPOD-style) and the pod is motion-gated —
 *  settled level for boarding/unloading. Override with top-level props /
 *  `queue`. */
export const MotionSimulator = composableRide(
  'MotionSimulator',
  (t) => buildMotionSimulatorScene(t),
  { defaults: { name: 'Motion Simulator', capacity: 4, rideDuration: 7, intensity: 6, price: 3 } },
);

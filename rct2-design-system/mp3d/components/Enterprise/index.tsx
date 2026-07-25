import React from 'react';
import * as THREE from 'three';
import { box, cyl, nightKOf } from '../Stage';
import { buildPeep, SHIRTS, SKIN_TONES } from '../Guest';
import { createMotionGate, makeSeatWorld } from '../GameManager';
import { composableRide } from '../Park';

// Enterprise matched to the RCT2 ENTERP sprite: a silver-spoked wheel ringed
// with enclosed pod cars on a slate lattice support arm — the wheel spins up
// flat, then the arm lifts it toward vertical so the pods swing outward.
export function buildEnterpriseScene(
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
  const withRiders = opts.riders ?? true; // decorative — off when registered so REAL guests take the pods
  const seats: THREE.Group[] = []; // one anchor per pod (seatWorld)
  let vehicle: THREE.Object3D | undefined; // a pod car — the RideViewer follow cam tracks it (userData.rideVehicle)
  const update =
    ((t: typeof THREE, g: THREE.Group) => {
        const PINK = 0xc9ccd2; // silver wheel steel (realistic)
        const SLATE = 0x3c5454;
        const POD = 0x2e4444;
        g.add(box(t, [1.6, 0.3, 2.4], 0x8a8f98, [-1.6, 0.15, 0], { tex: 'concrete', repeat: [5, 7], rough: 0.9 })); // machinery base
        g.add(box(t, [0.5, 0.4, 0.5], SLATE, [-1.6, 0.32, 0], { tex: 'metal', metal: 0.5, rough: 0.45 })); // bearing pedestal: base plate up to the arm pivot (no floating hinge)
        g.add(cyl(t, 0.08, 0.08, 0.6, 0x9aa2ab, [-1.6, 0.5, 0], { rotX: Math.PI / 2, metal: 0.8, rough: 0.3, seg: 14 })); // pivot axle through the pedestal
        const armPivot = new t.Group();
        armPivot.position.set(-1.6, 0.5, 0);
        g.add(armPivot);
        // arm + brace ride BEHIND the wheel plane (z -0.26) so the rim/pods never sweep through them
        armPivot.add(box(t, [2.6, 0.22, 0.3], SLATE, [1.3, 0, -0.26], { tex: 'metal', metal: 0.5, rough: 0.45 })); // arm
        armPivot.add(box(t, [2.4, 0.14, 0.2], SLATE, [1.2, -0.22, -0.26], { metal: 0.5, rough: 0.45, rotZ: 0.08 }));
        const wheel = new t.Group();
        wheel.position.set(2.6, 0, 0);
        armPivot.add(wheel);
        const R = 1.5;
        // rim + 16 pink spokes
        const rim = new t.Mesh(new t.TorusGeometry(R, 0.06, 8, 40), new t.MeshStandardMaterial({ color: PINK, metalness: 0.3, roughness: 0.5 }));
        wheel.add(rim);
        for (let i = 0; i < 16; i++) wheel.add(box(t, [0.035, R * 2, 0.035], PINK, [0, 0, 0], { rotZ: (i / 16) * Math.PI, metal: 0.3, rough: 0.5 }));
        wheel.add(cyl(t, 0.14, 0.14, 0.26, SLATE, [0, 0, -0.02], { rotX: Math.PI / 2, metal: 0.6, rough: 0.4, seg: 16 })); // hub, reaching back into the arm end
        // night lighting: bulb at every spoke tip on the rim front face (rim
        // tube reaches z 0.06; bulb backs at z 0.03 embed) + hub & base lights
        const bulbGeo = new t.SphereGeometry(0.04, 10, 8);
        const bulbMat = new t.MeshStandardMaterial({ color: 0xfff8e0, emissive: 0xffe08a, emissiveIntensity: 0.15, roughness: 0.35 });
        for (let i = 0; i < 16; i++) {
          const a = (i / 16) * Math.PI * 2;
          [0.07, -0.07].forEach((z) => {
            const bulb = new t.Mesh(bulbGeo, bulbMat);
            bulb.position.set(Math.cos(a) * R, Math.sin(a) * R, z); // both rim faces — the wheel reads from any azimuth
            wheel.add(bulb);
          });
        }
        const hubLight = new t.PointLight(0xffdf9a, 0, 5, 2);
        hubLight.position.set(2.6, 0, 0.5);
        armPivot.add(hubLight);
        const baseLight = new t.PointLight(0xffc97a, 0, 4, 2);
        baseLight.position.set(-1.6, 1.2, 0);
        g.add(baseLight);
        // 10 enclosed pods hanging on the rim (mesh-front capsule cars)
        for (let i = 0; i < 10; i++) {
          const a = (i / 10) * Math.PI * 2;
          const pod = new t.Group();
          pod.position.set(Math.cos(a) * R, Math.sin(a) * R, 0.16);
          pod.rotation.z = a + Math.PI / 2; // wide floor end OUTWARD, riders' heads toward the hub (real Enterprise physics)
          wheel.add(pod);
          if (i === 0) vehicle = pod;
          // open-fronted pod shell (opening faces +z) so the rider is visible
          const shell = new t.Mesh(
            new t.CylinderGeometry(0.14, 0.18, 0.42, 14, 1, true, 0.9, Math.PI * 2 - 1.8),
            new t.MeshStandardMaterial({ color: POD, metalness: 0.3, roughness: 0.55, side: t.DoubleSide }),
          );
          shell.position.y = -0.1;
          shell.castShadow = true;
          pod.add(shell);
          pod.add(cyl(t, 0.18, 0.18, 0.03, POD, [0, -0.295, 0], { metal: 0.3, rough: 0.55, seg: 14 })); // floor cap
          pod.add(cyl(t, 0.14, 0.14, 0.03, POD, [0, 0.095, 0], { metal: 0.3, rough: 0.55, seg: 14 })); // roof cap
          pod.add(cyl(t, 0.15, 0.16, 0.03, 0x1c2626, [0, -0.16, 0], { rough: 0.6, seg: 14 })); // seat disc, walls to wall
          pod.add(cyl(t, 0.12, 0.13, 0.02, 0x24504e, [0, -0.14, 0], { rough: 0.95, seg: 14 })); // padded seat cushion on the disc
          pod.add(box(t, [0.16, 0.18, 0.02], 0x24504e, [0, -0.06, -0.135], { rough: 0.95 })); // back cushion against the shell wall
          // CURVED glass canopy over the pod opening — a partial cylinder
          // CONCENTRIC with the shell (radii +0.004, arc 1.86 rad lapping the
          // shell's 1.8 rad opening by 0.03 each side), so the glass follows
          // the pod's curvature and stays inside its silhouette. The old flat
          // 0.2 x 0.3 slab at z 0.14 had corners at radius 0.172 — outside the
          // 0.14 shell top radius — so it jutted through the pod body.
          const glass = new t.Mesh(
            new t.CylinderGeometry(0.144, 0.184, 0.4, 14, 1, true, -0.93, 1.86),
            new t.MeshStandardMaterial({ color: 0xbcd2da, metalness: 0.2, roughness: 0.15, transparent: true, opacity: 0.34, side: t.DoubleSide }),
          );
          glass.position.y = -0.1;
          pod.add(glass);
          // dark canopy trim: curved hood + sill, same construction 0.008 out
          [
            [0.149, 0.152, 0.085],
            [0.1842, 0.187, -0.285],
          ].forEach(([rt, rb, y]) => {
            const trim = new t.Mesh(
              new t.CylinderGeometry(rt, rb, 0.03, 14, 1, true, -0.95, 1.9),
              new t.MeshStandardMaterial({ color: POD, metalness: 0.3, roughness: 0.55, side: t.DoubleSide }),
            );
            trim.position.y = y;
            pod.add(trim);
          });
          // pod seat anchor — REAL GameManager guests land here via seatWorld
          const seat = new t.Group();
          seat.position.set(0, -0.26, 0.02); // hips on the seat disc
          pod.add(seat);
          seats.push(seat);
          if (withRiders) {
            const p = buildPeep(t, { skin: SKIN_TONES[i % SKIN_TONES.length], shirt: SHIRTS[i % SHIRTS.length], seated: true });
            p.group.scale.setScalar(0.26);
            seat.add(p.group);
          }
          // over-shoulder restraint bar (Enterprise-class): across the chest,
          // arms dropping into the seat disc at both sides
          pod.add(box(t, [0.17, 0.03, 0.03], 0x1c2626, [0, -0.07, 0.06], { metal: 0.5, rough: 0.4 }));
          [-0.075, 0.075].forEach((x) => pod.add(box(t, [0.025, 0.1, 0.025], 0x1c2626, [x, -0.115, 0.06], { metal: 0.5, rough: 0.4 })));
        }
        return (time: number, motionK = 1) => {
          // day -> night gate: rim bulbs + hub/base glow rise as it darkens
          const nk = nightKOf(g);
          const ease = nk * nk * (3 - 2 * nk); // smoothstep
          bulbMat.emissiveIntensity = 0.15 + (1.7 - 0.15) * ease;
          hubLight.intensity = ease * 1.3;
          baseLight.intensity = ease * 0.85;
          wheel.rotation.z = time * 1.6;
          const lift = ((Math.sin(time * 0.35) + 1) / 2) * motionK; // 0..1 — settles to the lowest arm angle when parked
          armPivot.rotation.z = 0.62 + lift * 0.85; // raise toward vertical; pod tips (radius 1.81) always >= 0.2 clear of the ground
        };
      })(three, group) || undefined;
  // station gate: wheel parked (arm lowered) while guests board/unload;
  // spinDown 0.9 has the arm down before 'unloadingPassengers' begins
  const gate = createMotionGate((tt, k) => update?.(tt, k), { spinDown: 0.9 });
  return { group, update: gate.update, vehicle, seatWorld: makeSeatWorld(three, seats), onStateChange: gate.onStateChange };
}

/** <Enterprise> — composable ride (components/Park/Context.md): mounts the ride
 *  at `position`/`rotation`; inside a <Park>, `register` wires the full
 *  GameManager ride via <ConfigurableRide> — queue HEAD 1.5 out the local +z
 *  front (lane extending +z), exit hut beside it at local [-1.5, 1.35],
 *  boarding at the base. Capacity 10 = the 10 pods: REAL guests ride the pod
 *  seats via `seatWorld` (decorative riders off when registered) and the
 *  wheel is motion-gated — parked with the arm lowered for boarding.
 *  Override with top-level props / `queue`. */
export const Enterprise = composableRide<{ riders?: boolean }>(
  'Enterprise',
  (t, props) => buildEnterpriseScene(t, { riders: props.riders ?? !(props as { register?: unknown }).register }),
  { defaults: { name: 'Enterprise', capacity: 10, rideDuration: 9, intensity: 8, price: 4 } },
);

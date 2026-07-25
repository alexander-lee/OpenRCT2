import React from 'react';
import * as THREE from 'three';
import { box, cyl, ball, nightKOf } from '../Stage';
import { buildPeep, SHIRTS, SKIN_TONES } from '../Guest';
import { createMotionGate, makeSeatWorld } from '../GameManager';
import { composableRide } from '../Park';

// Swinging ship matched to the RCT2 SWSH1 sprite: an ORANGE A-frame (two legs
// per side meeting at a high pivot), a dark slate cross-beam and centre pole,
// and a MAGENTA hull with carved dragon heads at BOTH ends, orange gunwale
// trim and rows of orange/pink striped seat backs. Riders swing with it.
export function buildPirateShipScene(
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
  const withRiders = opts.riders ?? true; // decorative — off when registered so REAL guests fill the rows
  const seats: THREE.Group[] = []; // 5 rows × 2 bench spots (seatWorld)
  let vehicle: THREE.Object3D | undefined; // the swinging boat — the RideViewer follow cam tracks it (userData.rideVehicle)
  const update =
    ((t: typeof THREE, g: THREE.Group) => {
        const pivotY = 3.1;
        const ORANGE = 0xe8641c; // frame (sprite #e05020)
        const WOOD = 0x8a5a28; // natural wooden hull
        const WOOD_D = 0x5a3a1c; // hull shadow planking
        const SLATE = 0x2e4444; // beam/pole (sprite #203030)

        // orange A-frame: two legs each side, meeting at the pivot
        [-1, 1].forEach((zs) => {
          const z = zs * 0.7;
          [-1, 1].forEach((xs) => {
            const x0 = xs * 1.6;
            const L = Math.hypot(x0, pivotY);
            const ang = Math.atan2(pivotY, -x0) - Math.PI / 2;
            g.add(box(t, [0.13, L, 0.13], ORANGE, [x0 / 2, pivotY / 2, z], { tex: 'metal', repeat: [1, 7], metal: 0.3, rough: 0.55, rotZ: ang }));
          });
          // horizontal tie between the two legs of this frame
          g.add(box(t, [1.7, 0.1, 0.1], ORANGE, [0, pivotY * 0.45, z], { metal: 0.3, rough: 0.55 }));
          // footing pads
          [-1, 1].forEach((xs) => g.add(box(t, [0.5, 0.12, 0.4], 0x8a8f98, [xs * 1.6, 0.06, z], { tex: 'concrete', rough: 0.9 })));
        });
        // slate cross-beam through the pivot + hub caps
        g.add(cyl(t, 0.09, 0.09, 1.7, SLATE, [0, pivotY, 0], { rotX: Math.PI / 2, metal: 0.5, rough: 0.4, seg: 14 }));
        [-0.72, 0.72].forEach((z) => g.add(cyl(t, 0.14, 0.14, 0.08, ORANGE, [0, pivotY, z], { rotX: Math.PI / 2, metal: 0.4, rough: 0.5, seg: 14 })));
        // night lighting (modest): amber accent bulbs along both A-frame ties
        // (tie tops 1.445; bulb bottoms 1.42 embed) + two warm pivot lights
        const bulbGeo = new t.SphereGeometry(0.04, 10, 8);
        const bulbMat = new t.MeshStandardMaterial({ color: 0xfff3c0, emissive: 0xffb040, emissiveIntensity: 0.15, roughness: 0.35 });
        [-0.7, 0.7].forEach((z) => {
          for (let i = 0; i < 5; i++) {
            const bulb = new t.Mesh(bulbGeo, bulbMat);
            bulb.position.set(-0.6 + i * 0.3, 1.46, z);
            g.add(bulb);
          }
        });
        const nightLights: { intensity: number }[] = [];
        [-0.9, 0.9].forEach((z) => {
          const pl = new t.PointLight(0xffc97a, 0, 6, 2);
          pl.position.set(0, pivotY - 0.1, z);
          g.add(pl);
          nightLights.push(pl);
        });

        const swing = new t.Group();
        swing.position.set(0, pivotY, 0);
        g.add(swing);
        // dark centre pole (the sprite hangs the boat from a single slate mast)
        swing.add(box(t, [0.11, 2.5, 0.11], SLATE, [0, -1.25, 0], { metal: 0.5, rough: 0.4 }));
        // magenta counterweight drum near the pivot (visible in the sprite)
        swing.add(cyl(t, 0.24, 0.3, 0.36, 0x6a4423, [0, -0.45, 0], { tex: 'wood', repeat: [3, 1], rough: 0.85, seg: 16 }));

        const boat = new t.Group();
        boat.position.y = -2.5;
        swing.add(boat);
        vehicle = boat;
        // magenta hull, layered for a curved profile, orange gunwale trim
        boat.add(box(t, [2.5, 0.34, 0.8], WOOD_D, [0, -0.05, 0], { tex: 'wood', repeat: [8, 1], rough: 0.85 }));
        boat.add(box(t, [2.7, 0.3, 0.88], WOOD, [0, 0.22, 0], { tex: 'wood', repeat: [8, 1], rough: 0.85 }));
        boat.add(box(t, [2.74, 0.07, 0.92], 0xd8b040, [0, 0.4, 0], { tex: 'metal', repeat: [10, 1], metal: 0.4, rough: 0.4 })); // gold gunwale
        boat.add(box(t, [2.2, 0.2, 0.7], 0x1c2e2e, [0, 0.32, 0], { tex: 'plastic', repeat: [6, 2], rough: 0.85 })); // dark interior well (top 0.42, tucked below the gunwale top 0.435)
        // upswept ends + dragon heads at BOTH ends
        [-1, 1].forEach((s) => {
          boat.add(box(t, [0.55, 0.6, 0.8], WOOD, [s * 1.35, 0.35, 0], { tex: 'wood', repeat: [2, 2], rough: 0.85, rotZ: s * 0.55 }));
          const neck = cyl(t, 0.09, 0.14, 0.6, 0x6a4423, [s * 1.72, 0.85, 0], { tex: 'wood', repeat: [1, 2], rough: 0.85, seg: 10, rotZ: -s * 0.5 }); // lean outward so the top buries in the head
          boat.add(neck);
          boat.add(ball(t, 0.17, 0x6a4423, [s * 1.92, 1.12, 0], { tex: 'wood', repeat: [2, 2], flat: true, rough: 0.85 })); // head
          boat.add(box(t, [0.2, 0.09, 0.1], 0x6a4423, [s * 2.08, 1.08, 0], { tex: 'wood', rough: 0.85 })); // snout
          boat.add(ball(t, 0.035, 0xd8b040, [s * 2.03, 1.2, 0.1], { metal: 0.5, rough: 0.3 })); // gold eye, proud of the head surface
          boat.add(ball(t, 0.035, 0xd8b040, [s * 2.03, 1.2, -0.1], { metal: 0.5, rough: 0.3 }));
        });
        // rows of orange/pink striped seat backs + riders
        for (let i = 0; i < 6; i++) {
          const z0 = -1.0 + i * 0.4;
          boat.add(box(t, [0.06, 0.3, 0.72], i % 2 ? 0xb03030 : 0x8a5a28, [z0, 0.5, 0], { tex: 'wood', repeat: [1, 2], rough: 0.8 })); // red/wood seat backs // seat back (across hull)
          if (i > 0) boat.add(box(t, [0.035, 0.035, 0.68], 0xd8b040, [z0 - 0.045, 0.56, 0], { metal: 0.5, rough: 0.35 })); // gold grab rail on the rear face for the row behind (lap-bar class)
          if (i < 5) boat.add(box(t, [0.03, 0.22, 0.62], 0x7a2020, [z0 + 0.042, 0.5, 0], { tex: 'fabric', repeat: [1, 2], rough: 0.95 })); // padded back cushion on the riders' side (back face 0.03)
          if (i < 5) {
            [-0.16, 0.16].forEach((zz, k) => {
              // bench anchor — REAL GameManager guests land here via seatWorld;
              // unfilled anchors read as visibly EMPTY bench spots
              const seat = new t.Group();
              seat.position.set(z0 + 0.075, 0.24, zz); // hips on the well bench (0.42), back 0.005 clear of the seat-back face (no coplanar fight)
              seat.rotation.y = Math.PI / 2;
              boat.add(seat);
              seats.push(seat);
              if (withRiders) {
                const p = buildPeep(t, { skin: SKIN_TONES[(i * 2 + k) % SKIN_TONES.length], shirt: SHIRTS[(i * 2 + k) % SHIRTS.length], seated: true, expression: 'surprised' });
                p.group.scale.setScalar(0.4);
                seat.add(p.group);
              }
            });
          }
        }
        return (time: number, motionK = 1) => {
          // day -> night gate: frame accents + pivot glow rise as it darkens
          const nk = nightKOf(g);
          const ease = nk * nk * (3 - 2 * nk); // smoothstep
          bulbMat.emissiveIntensity = 0.15 + (1.1 - 0.15) * ease;
          nightLights.forEach((pl) => (pl.intensity = ease * 0.9));
          swing.rotation.z = Math.sin(time * 1.05) * 0.85 * motionK; // settles hanging level when parked
        };
      })(three, group) || undefined;
  // station gate: the boat hangs LEVEL while guests board/unload (spinDown
  // 0.9 — at rest before 'unloadingPassengers' begins)
  const gate = createMotionGate((tt, k) => update?.(tt, k), { spinDown: 0.9 });
  return { group, update: gate.update, vehicle, seatWorld: makeSeatWorld(three, seats), onStateChange: gate.onStateChange };
}

/** <PirateShip> — composable ride (components/Park/Context.md): mounts the ride
 *  at `position`/`rotation`; inside a <Park>, `register` wires the full
 *  GameManager ride via <ConfigurableRide> — queue HEAD 1.5 out the local +z
 *  front (lane extending +z), exit hut beside it at local [-1.5, 1.35],
 *  boarding at the base. Capacity 10 = 5 rider rows × 2 bench spots: REAL
 *  guests fill the benches via `seatWorld` (decorative riders off when
 *  registered — a half-full boat shows EMPTY spots) and the swing is
 *  motion-gated — hanging level for boarding/unloading. Override with
 *  top-level props / `queue`. */
export const PirateShip = composableRide<{ riders?: boolean }>(
  'PirateShip',
  (t, props) => buildPirateShipScene(t, { riders: props.riders ?? !(props as { register?: unknown }).register }),
  { defaults: { name: 'Pirate Ship', capacity: 10, rideDuration: 8, intensity: 5, price: 3 } },
);

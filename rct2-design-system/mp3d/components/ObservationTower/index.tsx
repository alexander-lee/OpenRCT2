import React from 'react';
import * as THREE from 'three';
import { box, cyl, ball, nightKOf } from '../Stage';
import { buildPeep, SHIRTS, SKIN_TONES } from '../Guest';
import { createMotionGate, makeSeatWorld } from '../GameManager';
import { composableRide } from '../Park';

// Observation tower matched to the RCT2 OBS1 sprite: a round DEEP-BLUE cabin
// drum with a ring of windows under a RED/WHITE pinwheel cone roof, riding
// up and down a pale lattice mast while slowly rotating for the view.
export function buildObservationTowerScene(
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
  const withRiders = opts.riders ?? true; // decorative — off when registered so REAL guests fill the cabin
  const seats: THREE.Group[] = []; // 8 cabin window spots (seatWorld)
  let cycle0 = 0; // gated-clock value at the last departure (cycle phase zero)
  let vehicle: THREE.Object3D | undefined; // the cabin — the RideViewer follow cam tracks it (userData.rideVehicle)
  const update =
    ((t: typeof THREE, g: THREE.Group) => {
        const H = 5.6;
        const BLUE = 0x1a2f8c; // cabin drum (sprite #002090)
        const ORANGE = 0xc23434; // red/white cone (realistic)
        const CREAM = 0xdad4c8;
        const LATTICE = 0xc9ccd2;
        g.add(cyl(t, 0.9, 1.0, 0.35, 0x8a8f98, [0, 0.17, 0], { tex: 'concrete', repeat: [8, 1], rough: 0.9, seg: 28 }));
        // lattice mast
        const cs = 0.2;
        [-cs, cs].forEach((x) => [-cs, cs].forEach((z) => g.add(box(t, [0.06, H, 0.06], LATTICE, [x, H / 2, z], { tex: 'metal', metal: 0.5, rough: 0.4 }))));
        for (let y = 0.5; y < H; y += 0.4) {
          [-cs, cs].forEach((z) => g.add(box(t, [cs * 2, 0.04, 0.04], LATTICE, [0, y, z], { metal: 0.5, rough: 0.4 })));
          [-cs, cs].forEach((x) => g.add(box(t, [0.04, 0.04, cs * 2], LATTICE, [x, y, 0], { metal: 0.5, rough: 0.4 })));
        }
        g.add(ball(t, 0.14, ORANGE, [0, H + 0.1, 0], { rough: 0.5 }));
        // night lighting: red aviation beacon riding the mast-top ball (ball
        // top 5.84, beacon centre 5.86 overlaps it) + a red pulse light
        const beaconMat = new t.MeshStandardMaterial({ color: 0xff5544, emissive: 0xff2222, emissiveIntensity: 0.15, roughness: 0.4 });
        const beacon = new t.Mesh(new t.SphereGeometry(0.05, 10, 8), beaconMat);
        beacon.position.set(0, H + 0.26, 0);
        g.add(beacon);
        const beaconLight = new t.PointLight(0xff3333, 0, 4, 2);
        beaconLight.position.set(0, H + 0.32, 0);
        g.add(beaconLight);

        const cabin = new t.Group();
        g.add(cabin);
        vehicle = cabin;
        // warm interior glow that travels with the cabin
        const cabinLight = new t.PointLight(0xffc97a, 0, 4, 2);
        cabinLight.position.set(0, 0.45, 0);
        cabin.add(cabinLight);
        const winMats: { emissiveIntensity: number }[] = [];
        // blue drum: solid sill band + a mullioned glass ring (riders visible),
        // panes flush with the r=0.95 drum surface, band top meets the roof
        cabin.add(cyl(t, 0.95, 0.95, 0.255, BLUE, [0, 0.1825, 0], { tex: 'plastic', repeat: [10, 1], rough: 0.45, seg: 28 })); // sill 0.055..0.31
        cabin.add(cyl(t, 1.02, 1.02, 0.07, ORANGE, [0, 0.02, 0], { rough: 0.5, seg: 28 })); // floor ring
        for (let i = 0; i < 12; i++) {
          const a = (i / 12) * Math.PI * 2;
          const w = box(t, [0.02, 0.265, 0.36], 0xbfe2f0, [Math.cos(a) * 0.945, 0.4425, Math.sin(a) * 0.945], { opacity: 0.4, rough: 0.2, emissive: 0x2a4a66 }); // glass 0.31..0.575
          w.rotation.y = -a;
          cabin.add(w);
          winMats.push(w.material as unknown as { emissiveIntensity: number });
          const am = a + Math.PI / 12;
          const mull = box(t, [0.03, 0.265, 0.16], BLUE, [Math.cos(am) * 0.945, 0.4425, Math.sin(am) * 0.945], { rough: 0.45 });
          mull.rotation.y = -am;
          cabin.add(mull);
        }
        // orange/white pinwheel cone roof
        const SEGS = 12;
        for (let i = 0; i < SEGS; i++) {
          const a0 = (i / SEGS) * Math.PI * 2;
          const wedge = new t.Mesh(new t.CylinderGeometry(0.03, 1.05, 0.42, 3, 1, false, a0, (Math.PI * 2) / SEGS), new t.MeshStandardMaterial({ color: i % 2 ? ORANGE : CREAM, roughness: 0.55 }));
          wedge.position.y = 0.78;
          wedge.castShadow = true;
          cabin.add(wedge);
        }
        cabin.add(ball(t, 0.07, ORANGE, [0, 1.02, 0], { rough: 0.5 }));
        // 8 window spots around the cabin floor — REAL GameManager guests
        // ride the cabin at these anchors (seatWorld); decorative peeps fill
        // every other spot on a standalone build
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2 + 0.4;
          const seat = new t.Group();
          seat.position.set(Math.cos(a) * 0.62, 0.055, Math.sin(a) * 0.62); // feet on the floor ring top
          seat.rotation.y = Math.PI / 2 - a; // face radially OUT the window (painted faces visible through the glass)
          cabin.add(seat);
          seats.push(seat);
          if (withRiders && i % 2 === 0) {
            const p = buildPeep(t, { skin: SKIN_TONES[(i / 2) % SKIN_TONES.length], shirt: SHIRTS[(i / 2) % SHIRTS.length] });
            p.group.scale.setScalar(0.32);
            seat.add(p.group);
          }
        }
        return (time: number, motionK = 1) => {
          // day -> night gate: beacon pulses, window glass + interior glow rise
          const nk = nightKOf(g);
          const ease = nk * nk * (3 - 2 * nk); // smoothstep
          const pulse = 0.5 + 0.5 * Math.sin(time * 3.0);
          beaconMat.emissiveIntensity = 0.15 + (0.4 + 1.4 * pulse - 0.15) * ease;
          beaconLight.intensity = ease * (0.25 + 0.8 * pulse);
          winMats.forEach((m) => (m.emissiveIntensity = 1 + 2.2 * ease)); // day = original subtle tint
          cabinLight.intensity = ease * 0.9;
          const cyc = ((time - cycle0) * 0.18) % 1; // each departure restarts the climb
          const h = (cyc < 0.5 ? cyc * 2 : (1 - cyc) * 2) * motionK; // up then down; settles at the base when parked
          cabin.position.y = 0.35 + h * (H - 1.5);
          cabin.rotation.y = time * 0.4;
        };
      })(three, group) || undefined;
  // station gate: cabin parked at the base while guests board/unload
  // (spinDown 0.9), the climb restarting from zero on every departure
  const gate = createMotionGate((tt, k) => update?.(tt, k), { spinDown: 0.9 });
  const onStateChange = (state: string) => {
    gate.onStateChange(state);
    if (state === 'departing') cycle0 = gate.clock();
  };
  return { group, update: gate.update, vehicle, seatWorld: makeSeatWorld(three, seats), onStateChange };
}

/** <ObservationTower> — composable ride (components/Park/Context.md): mounts the ride
 *  at `position`/`rotation`; inside a <Park>, `register` wires the full
 *  GameManager ride via <ConfigurableRide> — queue HEAD 1.5 out the local +z
 *  front (lane extending +z), exit hut beside it at local [-1.5, 1.35],
 *  boarding at the base. Capacity 8 = the 8 cabin window spots: REAL guests
 *  ride the cabin via `seatWorld` (decorative riders off when registered)
 *  and the cabin is motion-gated — parked at the base for boarding, climbing
 *  afresh each departure. Override with top-level props / `queue`. */
export const ObservationTower = composableRide<{ riders?: boolean }>(
  'ObservationTower',
  (t, props) => buildObservationTowerScene(t, { riders: props.riders ?? !(props as { register?: unknown }).register }),
  { defaults: { name: 'Observation Tower', capacity: 8, rideDuration: 10, intensity: 1, price: 2 } },
);

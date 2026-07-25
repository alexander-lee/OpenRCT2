import React from 'react';
import * as THREE from 'three';
import { box, cyl, nightKOf } from '../Stage';
import { buildPeep, SHIRTS, SKIN_TONES } from '../Guest';
import { createMotionGate, makeSeatWorld } from '../GameManager';
import { composableRide } from '../Park';

// Roto-drop tower matched to the RCT2 GDROP1 sprite: the gondola is a dark
// slate-TEAL core drum ringed by outward-facing riders whose legs dangle, with
// royal-blue seat backs, a RED canopy ring above and red kick plates below.
// It climbs a pale lattice tower slowly, spins, then plummets.
export function buildDropTowerScene(
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
  const withRiders = opts.riders ?? true; // decorative — off when registered so REAL guests take the ring seats
  const seats: THREE.Group[] = []; // one anchor per ring seat (seatWorld)
  let cycle0 = 0; // gated-clock value at the last departure (cycle phase zero)
  let vehicle: THREE.Object3D | undefined; // the gondola — the RideViewer follow cam tracks it (userData.rideVehicle)
  const update =
    ((t: typeof THREE, g: THREE.Group) => {
        const H = 5.4;
        const TEAL = 0x2e4444; // core drum (sprite #203030/#305050)
        const ORANGE = 0xc23434; // red canopy + trim (realistic)
        const PINK = 0x2456b0; // royal-blue seat backs
        const LATTICE = 0xc9ccd2; // pale tower steel

        g.add(cyl(t, 0.75, 0.85, 0.4, 0x8a8f98, [0, 0.2, 0], { tex: 'concrete', repeat: [6, 1], rough: 0.9, seg: 24 }));
        // pale square lattice tower: 4 corner chords + rungs + diagonals
        const cs = 0.26;
        [-cs, cs].forEach((x) =>
          [-cs, cs].forEach((z) => g.add(box(t, [0.07, H, 0.07], LATTICE, [x, H / 2, z], { tex: 'metal', metal: 0.5, rough: 0.4 }))),
        );
        for (let y = 0.5; y < H; y += 0.45) {
          [-cs, cs].forEach((z) => g.add(box(t, [cs * 2, 0.045, 0.045], LATTICE, [0, y, z], { metal: 0.5, rough: 0.4 })));
          [-cs, cs].forEach((x) => g.add(box(t, [0.045, 0.045, cs * 2], LATTICE, [x, y, 0], { metal: 0.5, rough: 0.4 })));
          g.add(box(t, [cs * 2.7, 0.04, 0.04], LATTICE, [0, y + 0.22, cs], { rotZ: 0.7, metal: 0.5, rough: 0.4 }));
          g.add(box(t, [cs * 2.7, 0.04, 0.04], LATTICE, [0, y + 0.22, -cs], { rotZ: -0.7, metal: 0.5, rough: 0.4 }));
        }
        g.add(cyl(t, 0, 0.58, 0.5, ORANGE, [0, H + 0.18, 0], { seg: 6, rough: 0.5 })); // cap, base wide enough to swallow the chord tops (corner radius 0.417 < hex apothem 0.43 at y 5.4)
        // night lighting: red aviation beacon on the cap apex (cap top 5.83,
        // beacon centre 5.85 overlaps it) + a red pulse light beside it
        const beaconMat = new t.MeshStandardMaterial({ color: 0xff5544, emissive: 0xff2222, emissiveIntensity: 0.15, roughness: 0.4 });
        const beacon = new t.Mesh(new t.SphereGeometry(0.06, 10, 8), beaconMat);
        beacon.position.set(0, H + 0.45, 0);
        g.add(beacon);
        const beaconLight = new t.PointLight(0xff3333, 0, 4, 2);
        beaconLight.position.set(0, H + 0.52, 0);
        g.add(beaconLight);

        const gondola = new t.Group();
        g.add(gondola);
        vehicle = gondola;
        // teal core drum + orange canopy ring above + orange kick ring below
        gondola.add(cyl(t, 0.42, 0.42, 0.54, TEAL, [0, 0.15, 0], { tex: 'metal', metal: 0.3, rough: 0.6, seg: 22 }));
        const canopy = cyl(t, 0.8, 0.68, 0.12, ORANGE, [0, 0.48, 0], { rough: 0.5, seg: 22 }); // canopy
        canopy.castShadow = false; // sun reaches the riders below
        gondola.add(canopy);
        const canopyLip = cyl(t, 0.84, 0.84, 0.04, PINK, [0, 0.54, 0], { rough: 0.5, seg: 22 }); // blue canopy lip
        canopyLip.castShadow = false;
        gondola.add(canopyLip);
        gondola.add(cyl(t, 0.66, 0.72, 0.08, ORANGE, [0, -0.14, 0], { rough: 0.5, seg: 22 })); // kick ring
        // cabin glow: 8 warm bulbs tucked under the canopy edge (canopy bottom
        // 0.42 at r 0.68; bulb tops 0.44 embed in it) + one light in the drum
        const bulbGeo = new t.SphereGeometry(0.04, 10, 8);
        const bulbMat = new t.MeshStandardMaterial({ color: 0xfff3c0, emissive: 0xffcc55, emissiveIntensity: 0.15, roughness: 0.35 });
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2;
          const bulb = new t.Mesh(bulbGeo, bulbMat);
          bulb.position.set(Math.cos(a) * 0.7, 0.4, Math.sin(a) * 0.7);
          gondola.add(bulb);
        }
        const cabinLight = new t.PointLight(0xffc97a, 0, 3.2, 2);
        cabinLight.position.set(0, 0.25, 0);
        gondola.add(cabinLight);
        // 10 outward-facing riders: pink seat back, dangling legs (seated peeps)
        const N = 10;
        for (let i = 0; i < N; i++) {
          const a = (i / N) * Math.PI * 2;
          const seat = new t.Group();
          seat.position.set(Math.cos(a) * 0.56, 0, Math.sin(a) * 0.56);
          seat.rotation.y = Math.PI / 2 - a; // face outward: local +z = radially out, so the painted faces show
          seat.add(box(t, [0.26, 0.36, 0.06], PINK, [0, 0.21, -0.1], { rough: 0.55 })); // seat back (top 0.39, clear of the canopy bottom at 0.42)
          seat.add(box(t, [0.26, 0.06, 0.26], TEAL, [0, 0.0, -0.03], { rough: 0.6 })); // seat pan, reaching back to the drum
          seat.add(box(t, [0.2, 0.26, 0.025], 0x1a3f8a, [0, 0.18, -0.065], { tex: 'fabric', repeat: [2, 2], rough: 0.95 })); // back cushion on the seat-back face
          seat.add(box(t, [0.2, 0.025, 0.2], 0x3c5a5a, [0, 0.035, -0.03], { tex: 'fabric', repeat: [2, 1], rough: 0.95 })); // padded pan cushion
          // seat anchor — REAL GameManager guests land here via seatWorld
          const anchor = new t.Group();
          anchor.position.set(0, -0.12, -0.03); // hips on the pan, back on the seat back
          seat.add(anchor);
          seats.push(anchor);
          if (withRiders) {
            const p = buildPeep(t, { skin: SKIN_TONES[i % SKIN_TONES.length], shirt: SHIRTS[i % SHIRTS.length], seated: true, expression: 'surprised' });
            p.group.scale.setScalar(0.34);
            anchor.add(p.group);
          }
          seat.add(box(t, [0.2, 0.04, 0.04], TEAL, [0, 0.07, 0.09], { metal: 0.5, rough: 0.4 })); // lap bar across the thighs
          [-0.09, 0.09].forEach((x) => seat.add(box(t, [0.03, 0.09, 0.03], TEAL, [x, 0.045, 0.09], { metal: 0.5, rough: 0.4 }))); // lap-bar arms into the pan
          gondola.add(seat);
        }
        return (time: number, motionK = 1) => {
          // day -> night gate: beacon pulses, cabin bulbs + glow rise
          const nk = nightKOf(g);
          const ease = nk * nk * (3 - 2 * nk); // smoothstep
          const pulse = 0.5 + 0.5 * Math.sin(time * 3.2);
          beaconMat.emissiveIntensity = 0.15 + (0.4 + 1.4 * pulse - 0.15) * ease;
          beaconLight.intensity = ease * (0.25 + 0.9 * pulse);
          bulbMat.emissiveIntensity = 0.15 + (1.2 - 0.15) * ease;
          cabinLight.intensity = ease * 0.9;
          const cyc = ((time - cycle0) * 0.3) % 1; // each departure restarts the climb
          const h = (cyc < 0.8 ? cyc / 0.8 : 1 - (cyc - 0.8) / 0.2) * motionK; // slow climb, fast drop; settles at the base when parked
          gondola.position.y = 0.75 + h * (H - 1.5);
          gondola.rotation.y = time * (cyc < 0.8 ? 0.8 : 2.2); // spins, faster on the drop
        };
      })(three, group) || undefined;
  // station gate: gondola parked at the base while guests board/unload
  // (spinDown 0.9 — down before 'unloadingPassengers'), climb restarts from
  // zero on every departure
  const gate = createMotionGate((tt, k) => update?.(tt, k), { spinDown: 0.9 });
  const onStateChange = (state: string) => {
    gate.onStateChange(state);
    if (state === 'departing') cycle0 = gate.clock();
  };
  return { group, update: gate.update, vehicle, seatWorld: makeSeatWorld(three, seats), onStateChange };
}

/** <DropTower> — composable ride (components/Park/Context.md): mounts the ride
 *  at `position`/`rotation`; inside a <Park>, `register` wires the full
 *  GameManager ride via <ConfigurableRide> — queue HEAD 1.5 out the local +z
 *  front (lane extending +z), exit hut beside it at local [-1.5, 1.35],
 *  boarding at the base. Capacity 10 = the 10 outward-facing gondola seats:
 *  REAL guests ride them via `seatWorld` (decorative riders off when
 *  registered) and the gondola is motion-gated — parked at the base for
 *  boarding, climbing afresh on every departure. Override with top-level
 *  props / `queue`. */
export const DropTower = composableRide<{ riders?: boolean }>(
  'DropTower',
  (t, props) => buildDropTowerScene(t, { riders: props.riders ?? !(props as { register?: unknown }).register }),
  { defaults: { name: 'Drop Tower', capacity: 10, rideDuration: 7, intensity: 7, price: 4 } },
);

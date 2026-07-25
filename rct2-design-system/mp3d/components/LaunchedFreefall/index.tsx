import React from 'react';
import { box, cyl, ball, nightKOf } from '../Stage';
import { buildPeep, SHIRTS, SKIN_TONES } from '../Guest';
import { RideColourScheme } from '../ColorKit';
import { buildEmitter } from '../ParticleKit';
import { createMotionGate, makeSeatWorld } from '../GameManager';
import { composableRide } from '../Park';

// Launched Freefall modelled on the RCT2 Launched Freefall: a tall square
// lattice tower on a concrete base station with a bank of compressed-air
// cylinders (the launch plant), and a 4-seat ring car that LAUNCHES up fast,
// floats weightless at the apex — riders' arms rise — then glides back down.
// Deterministic 12 s cycle with a ParticleKit air-blast burst at each launch.
// Night: red aviation beacon on the cap + warm under-car light + one station
// light (3 real PointLights), plus tower marker bulbs.
export function buildLaunchedFreefallScene(
  three: typeof THREE,
  opts: { scheme?: RideColourScheme; riders?: boolean } = {},
): {
  group: THREE.Group;
  update?: (time: number) => void;
  vehicle?: THREE.Object3D;
  seatWorld: (seat: number) => [number, number, number, number];
  onStateChange: (state: string) => void;
} {
  const group = new three.Group();
  const scheme = opts.scheme;
  const withRiders = opts.riders ?? true; // decorative — off when registered so REAL guests take the ring car
  const anchors: THREE.Group[] = []; // one anchor per ring-car seat (seatWorld)
  let cycle0 = 0; // gated-clock value at the last departure (cycle phase zero)
  let vehicle: THREE.Object3D | undefined; // the ring car — the RideViewer follow cam tracks it (userData.rideVehicle)
  const update =
    ((t: typeof THREE, g: THREE.Group) => {
        const H = 5.2;
        const LATTICE = scheme?.track.supports ?? 0xc9ccd2; // pale tower steel
        const ACCENT = scheme?.track.main ?? 0xb03428; // red chords + cap
        const CAR = scheme?.vehicles[0]?.body ?? 0xc23434; // ring-car body
        const SEATC = 0x1a3f8a; // royal-blue cushions
        const STEEL = 0x3a3f47;

        // ---- base station -----------------------------------------------------
        g.add(cyl(t, 1.05, 1.15, 0.35, 0x8a8f98, [0, 0.175, 0], { tex: 'concrete', repeat: [8, 1], rough: 0.9, seg: 28 }));
        g.add(cyl(t, 1.18, 1.18, 0.06, 0xd8b040, [0, 0.03, 0], { tex: 'metal', repeat: [12, 1], metal: 0.3, rough: 0.6, seg: 28 })); // hazard kerb
        // safety railing ring (posts + connecting rail, boarding gap at +z)
        for (let i = 0; i <= 10; i++) {
          const a = (i / 12) * Math.PI * 2 + Math.PI * 0.62;
          g.add(cyl(t, 0.02, 0.02, 0.42, STEEL, [Math.cos(a) * 1.45, 0.21, Math.sin(a) * 1.45], { metal: 0.5, rough: 0.5, seg: 6 }));
          if (i < 10) {
            const a1 = ((i + 1) / 12) * Math.PI * 2 + Math.PI * 0.62;
            const mx = ((Math.cos(a) + Math.cos(a1)) / 2) * 1.45;
            const mz = ((Math.sin(a) + Math.sin(a1)) / 2) * 1.45;
            const len = Math.hypot(Math.cos(a1) - Math.cos(a), Math.sin(a1) - Math.sin(a)) * 1.45;
            const rail = box(t, [0.03, 0.03, len + 0.04], STEEL, [mx, 0.42, mz], { metal: 0.5, rough: 0.5 });
            rail.rotation.y = Math.atan2(Math.cos(a1) - Math.cos(a), Math.sin(a1) - Math.sin(a));
            g.add(rail);
          }
        }
        // compressed-air plant: three domed tanks + manifold + pipes into the base
        [-1, 0, 1].forEach((k) => {
          const x = 1.75;
          const z = k * 0.42;
          g.add(cyl(t, 0.14, 0.14, 0.95, 0x9aa2ac, [x, 0.5, z], { tex: 'metal', repeat: [3, 3], metal: 0.55, rough: 0.4, seg: 16 }));
          g.add(ball(t, 0.14, 0x9aa2ac, [x, 0.98, z], { metal: 0.55, rough: 0.4 }));
          g.add(cyl(t, 0.16, 0.16, 0.05, ACCENT, [x, 0.72, z], { metal: 0.4, rough: 0.5, seg: 16 })); // pressure band
          g.add(cyl(t, 0.03, 0.03, 0.7, STEEL, [x - 0.42, 0.16, z], { rotZ: Math.PI / 2, metal: 0.6, rough: 0.4, seg: 8 })); // feed pipe
        });
        g.add(box(t, [0.08, 0.08, 1.1], STEEL, [1.75, 1.06, 0], { metal: 0.6, rough: 0.4 })); // manifold
        g.add(box(t, [0.5, 0.45, 0.65], 0x6b7078, [1.75, 0.225, -0.85], { tex: 'metal', repeat: [3, 2], metal: 0.4, rough: 0.55 })); // compressor skid
        g.add(cyl(t, 0.09, 0.09, 0.1, 0xd8dce0, [1.62, 0.5, -0.85], { rotX: Math.PI / 2, metal: 0.4, rough: 0.4, seg: 12 })); // gauge dial

        // ---- square lattice tower --------------------------------------------
        const cs = 0.3;
        [-cs, cs].forEach((x) =>
          [-cs, cs].forEach((z) => g.add(box(t, [0.08, H, 0.08], LATTICE, [x, H / 2 + 0.3, z], { tex: 'metal', repeat: [1, 12], metal: 0.5, rough: 0.4 }))),
        );
        for (let y = 0.75; y < H + 0.2; y += 0.5) {
          [-cs, cs].forEach((z) => g.add(box(t, [cs * 2, 0.05, 0.05], LATTICE, [0, y, z], { metal: 0.5, rough: 0.4 })));
          [-cs, cs].forEach((x) => g.add(box(t, [0.05, 0.05, cs * 2], LATTICE, [x, y, 0], { metal: 0.5, rough: 0.4 })));
          g.add(box(t, [cs * 2.8, 0.045, 0.045], ACCENT, [0, y + 0.25, cs], { rotZ: 0.72, metal: 0.5, rough: 0.4 }));
          g.add(box(t, [cs * 2.8, 0.045, 0.045], ACCENT, [0, y + 0.25, -cs], { rotZ: -0.72, metal: 0.5, rough: 0.4 }));
        }
        g.add(cyl(t, 0, 0.52, 0.42, LATTICE, [0, H + 0.52, 0], { seg: 6, metal: 0.3, rough: 0.5 })); // cap cone
        g.add(cyl(t, 0.5, 0.53, 0.07, ACCENT, [0, H + 0.36, 0], { seg: 6, rough: 0.5 })); // cap brim band
        g.add(cyl(t, 0.4, 0.44, 0.18, STEEL, [0, H + 0.32, 0], { tex: 'metal', repeat: [4, 1], metal: 0.5, rough: 0.4, seg: 12 })); // head bearing drum
        // tower marker bulbs (emissive) up one chord pair
        const bulbGeo = new t.SphereGeometry(0.035, 10, 8);
        const bulbMat = new t.MeshStandardMaterial({ color: 0xfff3c0, emissive: 0xffb040, emissiveIntensity: 0.15, roughness: 0.35 });
        for (let i = 0; i < 6; i++) {
          [-1, 1].forEach((s) => {
            const bulb = new t.Mesh(bulbGeo, bulbMat);
            bulb.position.set(s * cs, 0.9 + i * 0.85, cs + 0.05);
            g.add(bulb);
          });
        }
        // red aviation beacon + its light
        const beaconMat = new t.MeshStandardMaterial({ color: 0xff5544, emissive: 0xff2222, emissiveIntensity: 0.15, roughness: 0.4 });
        const beacon = new t.Mesh(new t.SphereGeometry(0.06, 10, 8), beaconMat);
        beacon.position.set(0, H + 0.88, 0);
        g.add(beacon);
        const beaconLight = new t.PointLight(0xff3333, 0, 4, 2);
        beaconLight.position.set(0, H + 0.95, 0);
        g.add(beaconLight);
        // one warm station light on a short mast by the tanks
        const stationLight = new t.PointLight(0xffc97a, 0, 5, 2);
        stationLight.position.set(1.1, 1.6, 0.8);
        g.add(stationLight);
        g.add(cyl(t, 0.025, 0.035, 1.5, STEEL, [1.1, 0.75, 0.8], { metal: 0.5, rough: 0.5, seg: 8 }));
        const mastLamp = new t.Mesh(new t.SphereGeometry(0.06, 10, 8), bulbMat);
        mastLamp.position.set(1.1, 1.53, 0.8);
        g.add(mastLamp);

        // ---- 4-seat ring car ---------------------------------------------------
        const seats: ReturnType<typeof buildPeep>[] = [];
        const car = new t.Group();
        g.add(car);
        vehicle = car;
        // collar frame hugging the tower + skirt ring
        [-1, 1].forEach((s) => {
          car.add(box(t, [1.0, 0.22, 0.14], CAR, [0, 0.12, s * 0.43], { tex: 'plastic', repeat: [4, 1], rough: 0.45 }));
          car.add(box(t, [0.14, 0.22, 0.72], CAR, [s * 0.43, 0.12, 0], { tex: 'plastic', repeat: [1, 3], rough: 0.45 }));
        });
        car.add(box(t, [1.14, 0.06, 1.14], STEEL, [0, -0.02, 0], { metal: 0.5, rough: 0.4 })); // under-frame plate
        car.add(box(t, [0.98, 0.05, 0.98], STEEL, [0, 0.26, 0], { tex: 'metal', repeat: [6, 6], metal: 0.5, rough: 0.45 })); // top plate
        [-1, 1].forEach((sx) => [-1, 1].forEach((sz) => car.add(cyl(t, 0.03, 0.03, 0.24, STEEL, [sx * 0.36, 0.12, sz * 0.36], { metal: 0.6, rough: 0.4, seg: 8 })))); // guide bushes
        // 4 outward-facing seats (one per tower face)
        for (let i = 0; i < 4; i++) {
          const a = (i / 4) * Math.PI * 2;
          const seat = new t.Group();
          seat.position.set(Math.cos(a) * 0.58, 0, Math.sin(a) * 0.58);
          seat.rotation.y = Math.PI / 2 - a; // local +z points radially OUT
          car.add(seat);
          seat.add(box(t, [0.3, 0.4, 0.07], CAR, [0, 0.2, -0.12], { rough: 0.5 })); // seat back
          seat.add(box(t, [0.3, 0.07, 0.3], STEEL, [0, 0.0, -0.02], { rough: 0.55 })); // seat pan
          seat.add(box(t, [0.22, 0.28, 0.025], SEATC, [0, 0.2, -0.075], { tex: 'fabric', repeat: [2, 2], rough: 0.95 })); // back cushion
          seat.add(box(t, [0.22, 0.028, 0.22], SEATC, [0, 0.045, -0.02], { tex: 'fabric', repeat: [2, 1], rough: 0.95 })); // pan cushion
          seat.add(box(t, [0.14, 0.07, 0.03], SEATC, [0, 0.44, -0.1], { tex: 'fabric', rough: 0.95 })); // headrest
          // seat anchor — REAL GameManager guests land here via seatWorld
          const anchor = new t.Group();
          anchor.position.set(0, -0.11, -0.02); // hips on the cushion, legs dangling
          seat.add(anchor);
          anchors.push(anchor);
          if (withRiders) {
            const p = buildPeep(t, {
              skin: SKIN_TONES[i % SKIN_TONES.length],
              shirt: SHIRTS[(i + 4) % SHIRTS.length],
              seated: true,
              expression: 'surprised',
              female: i % 2 === 1,
            });
            p.group.scale.setScalar(0.34);
            anchor.add(p.group);
            seats.push(p);
          }
          // over-shoulder restraint: twin bars over the shoulders onto a chest pad
          [-0.055, 0.055].forEach((dx) => seat.add(box(t, [0.035, 0.22, 0.035], STEEL, [dx, 0.21, 0.055], { metal: 0.5, rough: 0.4 })));
          seat.add(box(t, [0.15, 0.08, 0.04], STEEL, [0, 0.11, 0.07], { rough: 0.6 })); // chest pad
          seat.add(box(t, [0.2, 0.04, 0.04], STEEL, [0, -0.02, 0.1], { metal: 0.5, rough: 0.4 })); // lap bar
        }
        // under-car light (warm wash pooling on the pad as it flies)
        const underGlow = new t.Mesh(new t.SphereGeometry(0.05, 10, 8), bulbMat);
        underGlow.position.set(0, -0.06, 0);
        car.add(underGlow);
        const underLight = new t.PointLight(0xffd090, 0, 4.5, 2);
        underLight.position.set(0, -0.16, 0);
        car.add(underLight);

        // launch air-blast: burst-only steam emitter at the base
        const blast = buildEmitter(t, {
          max: 60, rate: 0, life: 1.1, lifeVar: 0.3,
          velocity: [0, 1.6, 0], spread: 0.9, gravity: 0.6,
          size: 0.12, sizeEnd: 0.5, color: 0xe8eef2, colorEnd: 0xaeb6bc, opacity: 0.5,
        });
        blast.setOrigin(0, 0.45, 0);
        g.add(blast.points);

        // ---- deterministic 12 s cycle: launch → float → glide → reload -------
        const REST = 0.62;
        const HE = 3.6; // flight height above REST (apex stays clear of the cap)
        const ss = (v: number) => {
          const c = Math.max(0, Math.min(1, v));
          return c * c * (3 - 2 * c);
        };
        const heightAt = (u: number) => {
          if (u < 2) return 0; // loading dwell
          if (u < 2.9) {
            const v = (u - 2) / 0.9;
            return HE * (1 - (1 - v) * (1 - v)); // hard launch, easing into the apex
          }
          if (u < 4.6) return HE - 0.35 * (1 - Math.cos((2 * Math.PI * (u - 2.9)) / 1.7)) * 0.5; // weightless float bounce
          if (u < 7.0) return HE * (1 - ss((u - 4.6) / 2.4)); // long glide down
          return 0; // unload dwell
        };
        let prevU = 0;

        return (time: number, motionK = 1) => {
          const nk = nightKOf(g);
          const ease = nk * nk * (3 - 2 * nk); // smoothstep
          const pulse = 0.5 + 0.5 * Math.sin(time * 3.4);
          beaconMat.emissiveIntensity = 0.15 + (0.4 + 1.4 * pulse - 0.15) * ease;
          beaconLight.intensity = ease * (0.25 + 0.9 * pulse);
          bulbMat.emissiveIntensity = 0.15 + (1.25 - 0.15) * ease;
          stationLight.intensity = ease * 1.0;
          underLight.intensity = ease * 1.0;

          const u = (time - cycle0) % 12; // each departure restarts the launch cycle
          if (prevU < 2 && u >= 2) blast.burst(42); // air blast on launch
          if (prevU < 7 && u >= 7) blast.burst(14); // soft cushion puff on arrival
          prevU = u;
          const h = heightAt(u) * motionK; // settles at the station when parked
          car.position.y = REST + h;
          // arms rise near the apex (composed on top of the seated pose)
          const raise = ss((h / HE - 0.45) / 0.4);
          seats.forEach((p, i) => {
            const wave = 0.1 * Math.sin(time * 6 + i * 1.7) * raise;
            p.armL.rotation.x = -1.1 + raise * -1.55 + wave;
            p.armR.rotation.x = -1.1 + raise * -1.55 - wave;
            p.armL.rotation.z = 0.05 + raise * 0.3;
            p.armR.rotation.z = -0.05 - raise * 0.3;
          });
          blast.update(time);
        };
      })(three, group) || undefined;
  // station gate: ring car parked at the base while guests board/unload
  // (spinDown 0.9), the 12 s launch cycle restarting on every departure
  const gate = createMotionGate((tt, k) => update?.(tt, k), { spinDown: 0.9 });
  const onStateChange = (state: string) => {
    gate.onStateChange(state);
    if (state === 'departing') cycle0 = gate.clock();
  };
  return { group, update: gate.update, vehicle, seatWorld: makeSeatWorld(three, anchors), onStateChange };
}

/** <LaunchedFreefall> — composable ride (components/Park/Context.md): mounts the ride
 *  at `position`/`rotation`; inside a <Park>, `register` wires the full
 *  GameManager ride via <ConfigurableRide> — queue HEAD 1.5 out the local +z
 *  front (lane extending +z), exit hut beside it at local [-1.5, 1.35],
 *  boarding at the base. Capacity 4 = the 4-seat ring car: REAL guests ride
 *  it via `seatWorld` (decorative riders off when registered) and the car is
 *  motion-gated — parked at the base for boarding, launching afresh each
 *  departure. Override with top-level props / `queue`. */
export const LaunchedFreefall = composableRide<{ scheme?: RideColourScheme; riders?: boolean }>(
  'LaunchedFreefall',
  (t, props) => buildLaunchedFreefallScene(t, { scheme: props.scheme, riders: props.riders ?? !(props as { register?: unknown }).register }),
  { defaults: { name: 'Launched Freefall', capacity: 4, rideDuration: 7, intensity: 8, price: 4 } },
);

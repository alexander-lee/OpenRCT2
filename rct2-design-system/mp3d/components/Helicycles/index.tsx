import React from 'react';
import * as THREE from 'three';
import { box, cyl, ball, mergedBoxes, nightKOf } from '../Stage';
import { buildPeep, SKIN_TONES } from '../Guest';
import { createMotionGate, makeSeatWorld } from '../GameManager';
import { composableRide } from '../Park';

// Helicycles (RCT2 HELICAR) — a proper flat-ride FOUNDATION with proper
// helicopters on it.
//
// FOUNDATION (all static, batched): a poured CONCRETE plinth 2.58 u across
// with a kerb ring of 40 merged blocks, an asphalt apron ring under the flight
// circle, painted white markings (a chord-segmented circle on the flight line,
// 8 radial guide stripes, a helipad "H" on the boarding island), a bolted
// STEEL guide rail hooped at radius 1.4 on merged steel shoes, a hazard-edged
// boarding island, a low perimeter safety fence and a machinery cabinet. Every
// repeated part goes through `mergedBoxes` (kerbs / markings / rail shoes /
// fence posts / hazard blocks = 1 draw call each), and the concrete, asphalt
// and steel all carry procedural texture + bump.
//
// FLYERS: two open-cockpit helicopters — drooped rounded NOSE, raked tinted
// cockpit glass in a painted frame, coamed cockpit bay with an upholstered
// bucket seat, livery flash down each flank, tapering TAIL BOOM with fin,
// tailplane and a spinning two-blade TAIL ROTOR, and a real MAIN ROTOR (pylon,
// mast, swashplate, hub + cap and three grip-mounted blades with trim tips)
// over sprung SKID gear. Muted steel-teal / graphite / brick-red livery.
function buildFlyer(
  t: typeof THREE,
  beaconMat: THREE.MeshStandardMaterial,
  seats: THREE.Group[],
  index: number,
  withRiders: boolean,
): { grp: THREE.Group; rotor: THREE.Group; tailRotor: THREE.Group } {
  const BODY = 0x3d5661; // muted steel-teal fuselage
  const BODY_D = 0x2b3b43; // shaded underside / boom
  const TRIM = 0xa8462f; // muted brick-red livery flash
  const STEEL = 0x3a4046; // graphite gear + mast
  const HUB = 0x5a6067;
  const BLADE = 0x2c3034;
  const GLASS = 0x24343c;
  const UPH = 0x4a3b2e; // seat upholstery

  const h = new t.Group();

  // ---- fuselage: low belly hull + drooped nose ------------------------------
  const hull = ball(t, 0.3, BODY, [0, -0.1, 0.02], { tex: 'plastic', repeat: [3, 2], rough: 0.38 });
  hull.scale.set(0.88, 0.62, 1.2); // semi-axes 0.264 / 0.186 / 0.36 -> crown at y 0.086
  h.add(hull);
  const nose = ball(t, 0.2, BODY, [0, -0.055, 0.4], { tex: 'plastic', repeat: [2, 2], rough: 0.38 });
  nose.scale.set(0.95, 0.75, 1.55); // semi 0.19 / 0.15 / 0.31 -> tip at z 0.71, drooping below the glass
  h.add(nose);
  h.add(ball(t, 0.05, GLASS, [0, -0.06, 0.665], { rough: 0.35 })); // nose landing-light lens
  h.add(box(t, [0.34, 0.05, 0.26], BODY_D, [0, -0.235, 0.0], { tex: 'plastic', rough: 0.45 })); // belly keel pan
  // livery flash down each flank (half-buried in the hull skin at y −0.055)
  [-1, 1].forEach((s) => h.add(box(t, [0.02, 0.055, 0.44], TRIM, [s * 0.245, -0.055, 0.06], { rough: 0.5 })));

  // ---- open cockpit bay: floor, coamed side walls, bulkhead, seat ----------
  h.add(box(t, [0.32, 0.035, 0.36], 0x24282c, [0, 0.075, 0.1], { tex: 'metal', repeat: [2, 2], metal: 0.4, rough: 0.7, bump: 0.03 })); // cockpit floor pan
  [-1, 1].forEach((s) => {
    h.add(box(t, [0.035, 0.17, 0.38], BODY, [s * 0.17, 0.155, 0.09], { tex: 'plastic', rough: 0.38 })); // gunwale
    h.add(box(t, [0.06, 0.03, 0.4], TRIM, [s * 0.17, 0.25, 0.09], { rough: 0.5 })); // padded coaming lip
  });
  h.add(box(t, [0.34, 0.22, 0.05], BODY, [0, 0.18, -0.1], { tex: 'plastic', repeat: [2, 1], rough: 0.38 })); // rear bulkhead
  h.add(box(t, [0.24, 0.16, 0.04], UPH, [0, 0.19, -0.06], { tex: 'fabric', repeat: [2, 1], rough: 0.95 })); // upholstered backrest, proud of the bulkhead
  h.add(box(t, [0.24, 0.05, 0.2], UPH, [0, 0.115, 0.03], { tex: 'fabric', repeat: [2, 1], rough: 0.95 })); // seat cushion, top 0.14
  // raked tinted windscreen in a painted frame
  const glass = box(t, [0.31, 0.22, 0.02], GLASS, [0, 0.17, 0.285], { rotX: -0.55, rough: 0.15, opacity: 0.62 });
  h.add(glass);
  h.add(box(t, [0.34, 0.03, 0.035], TRIM, [0, 0.272, 0.222], { rough: 0.5 })); // windscreen header rail
  [-1, 1].forEach((s) => h.add(cyl(t, 0.014, 0.014, 0.24, BODY, [s * 0.163, 0.17, 0.285], { rotX: -0.55, metal: 0.4, rough: 0.45, seg: 6 }))); // A-pillar
  h.add(cyl(t, 0.012, 0.012, 0.28, STEEL, [0, 0.13, 0.2], { rotZ: Math.PI / 2, metal: 0.6, rough: 0.35, seg: 8 })); // pedal-crank handlebar at the rider's hands
  h.add(cyl(t, 0.02, 0.02, 0.2, STEEL, [0, 0.105, 0.19], { rotZ: Math.PI / 2, metal: 0.6, rough: 0.35, seg: 8 })); // pedal crank axle under the feet

  // ---- tail: boom, fin, tailplane, tail rotor -------------------------------
  h.add(cyl(t, 0.095, 0.05, 0.6, BODY_D, [0, 0.0, -0.62], { rotX: Math.PI / 2, tex: 'plastic', repeat: [3, 2], rough: 0.4, seg: 12 })); // boom, tapering to the tail
  h.add(box(t, [0.03, 0.28, 0.2], BODY, [0, 0.13, -0.87], { tex: 'plastic', rough: 0.38 })); // vertical fin
  h.add(box(t, [0.035, 0.05, 0.16], TRIM, [0, 0.25, -0.85], { rough: 0.5 })); // fin cap flash
  h.add(box(t, [0.32, 0.022, 0.09], BODY, [0, -0.01, -0.79], { tex: 'plastic', rough: 0.38 })); // tailplane
  h.add(cyl(t, 0.042, 0.042, 0.07, STEEL, [-0.045, 0.135, -0.86], { rotZ: Math.PI / 2, metal: 0.6, rough: 0.4, seg: 10 })); // tail gearbox
  const tailRotor = new t.Group();
  tailRotor.position.set(-0.085, 0.135, -0.86);
  tailRotor.add(ball(t, 0.028, HUB, [0, 0, 0], { metal: 0.6, rough: 0.4 }));
  [-1, 1].forEach((s) => tailRotor.add(box(t, [0.016, 0.2, 0.042], BLADE, [0, s * 0.105, 0], { rough: 0.5 })));
  h.add(tailRotor);
  const beacon = new t.Mesh(new t.SphereGeometry(0.025, 8, 6), beaconMat);
  beacon.position.set(0, 0.29, -0.85); // anti-collision beacon on the fin cap (emissive only)
  h.add(beacon);

  // ---- main rotor: pylon, mast, swashplate, hub, three blades ---------------
  h.add(box(t, [0.18, 0.12, 0.22], BODY, [0, 0.3, -0.1], { tex: 'plastic', rough: 0.38 })); // transmission pylon
  h.add(cyl(t, 0.03, 0.034, 0.18, STEEL, [0, 0.44, -0.1], { metal: 0.65, rough: 0.35, seg: 10 })); // mast
  h.add(cyl(t, 0.075, 0.075, 0.018, HUB, [0, 0.5, -0.1], { metal: 0.65, rough: 0.35, seg: 14 })); // swashplate
  const rotor = new t.Group();
  rotor.position.set(0, 0.545, -0.1);
  rotor.add(cyl(t, 0.055, 0.07, 0.05, HUB, [0, 0, 0], { metal: 0.65, rough: 0.35, seg: 12 })); // hub
  rotor.add(ball(t, 0.045, HUB, [0, 0.032, 0], { metal: 0.65, rough: 0.35 })); // hub cap
  for (let bl = 0; bl < 3; bl++) {
    const arm = new t.Group();
    arm.rotation.y = (bl * Math.PI * 2) / 3;
    arm.rotation.z = -0.045; // blade coning
    arm.add(cyl(t, 0.022, 0.022, 0.1, STEEL, [0.065, 0, 0], { rotZ: Math.PI / 2, metal: 0.6, rough: 0.4, seg: 8 })); // blade grip
    arm.add(box(t, [1.02, 0.016, 0.085], BLADE, [0.6, -0.004, 0], { tex: 'metal', repeat: [8, 1], metal: 0.35, rough: 0.5 })); // blade, tip at 1.11
    arm.add(box(t, [0.1, 0.018, 0.088], TRIM, [1.06, -0.004, 0], { rough: 0.5 })); // painted tip
    rotor.add(arm);
  }
  h.add(rotor);

  // ---- skid gear: two tubes with upturned toes on four sprung struts -------
  [-1, 1].forEach((s) => {
    h.add(cyl(t, 0.022, 0.022, 0.76, STEEL, [s * 0.23, -0.4, -0.02], { rotX: Math.PI / 2, metal: 0.65, rough: 0.4, seg: 10 })); // skid tube, bottom at −0.422
    h.add(cyl(t, 0.022, 0.022, 0.18, STEEL, [s * 0.23, -0.365, 0.435], { rotX: 1.0, metal: 0.65, rough: 0.4, seg: 8 })); // upturned toe
    [0.16, -0.16].forEach((sz) => h.add(cyl(t, 0.019, 0.019, 0.24, STEEL, [s * 0.135, -0.325, sz], { rotZ: s * 0.62, metal: 0.65, rough: 0.4, seg: 8 }))); // strut: belly -> skid
  });

  // ---- seat anchor: REAL GameManager guests land here via seatWorld --------
  const seat = new t.Group();
  seat.position.set(0, -0.045, 0.03); // hip underside 0.135 settles 0.005 into the cushion top (0.14)
  h.add(seat);
  seats.push(seat);
  if (withRiders) {
    const p = buildPeep(t, { skin: SKIN_TONES[(index * 2) % SKIN_TONES.length], shirt: index ? 0x2e6e54 : 0x2f5a90, seated: true });
    p.group.scale.setScalar(0.4);
    p.group.userData.lodDetail = true;
    seat.add(p.group);
  }
  return { grp: h, rotor, tailRotor };
}

export function buildHelicyclesScene(
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
  const withRiders = opts.riders ?? true; // decorative — off when registered so REAL guests fly the helis
  const seats: THREE.Group[] = []; // one cockpit anchor per heli (seatWorld)
  let vehicle: THREE.Object3D | undefined; // a heli — the RideViewer follow cam tracks it (userData.rideVehicle)
  const update =
    ((t: typeof THREE, g: THREE.Group) => {
        const DECK = 0.22; // concrete deck top — everything on the pad is measured off this
        const R_FLY = 1.4; // flight circle radius (= the steel guide rail radius)
        const CONCRETE = 0x8f8880;
        const DECK_C = 0x9ba1a7;
        const ASPHALT = 0x4a4a4e;
        const KERB = 0xb2aca4;
        const PAINT = 0xe6e6e0;
        const STEEL = 0x8f959c;
        const HAZARD = 0xc9a227;

        // ---- concrete plinth + deck slab ------------------------------------
        g.add(cyl(t, 2.5, 2.58, 0.22, CONCRETE, [0, 0.11, 0], { tex: 'concrete', repeat: [18, 1], rough: 0.95, bump: 0.05, seg: 40 }));
        g.add(cyl(t, 2.5, 2.5, 0.04, DECK_C, [0, DECK - 0.02, 0], { tex: 'concrete', repeat: [12, 12], rough: 0.95, bump: 0.05, seg: 40 }));
        // asphalt apron ring straddling the flight line (where the pods scuff down)
        g.add(cyl(t, 1.82, 1.82, 0.012, ASPHALT, [0, DECK + 0.006, 0], { tex: 'asphalt', repeat: [10, 10], rough: 0.98, bump: 0.05, seg: 40 }));
        g.add(cyl(t, 1.0, 1.0, 0.016, DECK_C, [0, DECK + 0.008, 0], { tex: 'concrete', repeat: [6, 6], rough: 0.95, bump: 0.05, seg: 32 })); // inner concrete island of the apron

        // ---- kerb ring: 40 merged blocks (ONE draw call) --------------------
        const kerbs: { dims: [number, number, number]; pos: [number, number, number]; rotY: number }[] = [];
        for (let i = 0; i < 40; i++) {
          const a = (i / 40) * Math.PI * 2;
          kerbs.push({ dims: [0.395, 0.14, 0.17], pos: [Math.cos(a) * 2.42, DECK + 0.05, Math.sin(a) * 2.42], rotY: -a + Math.PI / 2 });
        }
        g.add(mergedBoxes(t, kerbs, KERB, { tex: 'concrete', repeat: [2, 1], rough: 0.95, bump: 0.05 }));

        // ---- painted markings: flight circle + radial guides + helipad H ----
        const paint: { dims: [number, number, number]; pos: [number, number, number]; rotY?: number; repeat?: [number, number] }[] = [];
        for (let i = 0; i < 40; i++) {
          const a = (i / 40) * Math.PI * 2;
          paint.push({ dims: [0.222, 0.01, 0.075], pos: [Math.cos(a) * R_FLY, DECK + 0.014, Math.sin(a) * R_FLY], rotY: -a + Math.PI / 2 }); // chord segments -> a painted circle on the flight line (biting the asphalt, top 0.232)
        }
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
          paint.push({ dims: [0.5, 0.01, 0.1], pos: [Math.cos(a) * 2.1, DECK + 0.002, Math.sin(a) * 2.1], rotY: -a }); // radial guide stripes, biting the bare deck
        }
        [-0.17, 0.17].forEach((x) => paint.push({ dims: [0.085, 0.012, 0.54], pos: [x, DECK + 0.108, 0] })); // helipad H uprights, biting the island top (0.33)
        paint.push({ dims: [0.25, 0.012, 0.085], pos: [0, DECK + 0.108, 0] }); // H crossbar
        g.add(mergedBoxes(t, paint, PAINT, { rough: 0.8 }));

        // ---- boarding island: raised concrete pad + hazard-block edge -------
        g.add(cyl(t, 0.8, 0.86, 0.11, CONCRETE, [0, DECK + 0.055, 0], { tex: 'concrete', repeat: [8, 1], rough: 0.95, bump: 0.05, seg: 28 })); // top at DECK + 0.11 = 0.33
        const hazard: { dims: [number, number, number]; pos: [number, number, number]; rotY: number }[] = [];
        for (let i = 0; i < 24; i++) {
          const a = (i / 24) * Math.PI * 2;
          hazard.push({ dims: [0.12, 0.028, 0.09], pos: [Math.cos(a) * 0.79, DECK + 0.118, Math.sin(a) * 0.79], rotY: -a + Math.PI / 2 });
        }
        g.add(mergedBoxes(t, hazard, HAZARD, { rough: 0.7 }));

        // ---- steel guide rail hooped on the flight line ---------------------
        // a real bolted hoop the pods track: tube crowning at 0.33, on 16
        // merged steel shoes. PARKED the hoop runs BETWEEN the two skids
        // (skids sit at +-0.23 laterally, hoop half-width 0.035) and 0.026
        // under the hull; in flight the skids ride 0.09+ above it.
        const railGeo = new t.TorusGeometry(R_FLY, 0.035, 8, 96);
        railGeo.rotateX(Math.PI / 2);
        const rail = new t.Mesh(railGeo, new t.MeshStandardMaterial({ color: STEEL, metalness: 0.85, roughness: 0.3 }));
        rail.position.y = DECK + 0.075;
        rail.castShadow = true;
        rail.receiveShadow = true;
        g.add(rail);
        const shoes: { dims: [number, number, number]; pos: [number, number, number]; rotY: number }[] = [];
        for (let i = 0; i < 16; i++) {
          const a = (i / 16) * Math.PI * 2;
          shoes.push({ dims: [0.1, 0.09, 0.13], pos: [Math.cos(a) * R_FLY, DECK + 0.04, Math.sin(a) * R_FLY], rotY: -a + Math.PI / 2 });
        }
        g.add(mergedBoxes(t, shoes, STEEL, { tex: 'metal', repeat: [1, 1], metal: 0.6, rough: 0.4, bump: 0.03 }));

        // ---- perimeter safety fence: 28 merged posts + two steel rings ------
        const posts: { dims: [number, number, number]; pos: [number, number, number]; rotY: number }[] = [];
        for (let i = 0; i < 28; i++) {
          const a = (i / 28) * Math.PI * 2;
          posts.push({ dims: [0.05, 0.46, 0.05], pos: [Math.cos(a) * 2.36, DECK + 0.23, Math.sin(a) * 2.36], rotY: -a });
        }
        g.add(mergedBoxes(t, posts, STEEL, { tex: 'metal', metal: 0.5, rough: 0.45, bump: 0.03 }));
        [0.2, 0.42].forEach((fy) => {
          const ringGeo = new t.TorusGeometry(2.36, 0.018, 6, 72);
          ringGeo.rotateX(Math.PI / 2);
          const ring = new t.Mesh(ringGeo, new t.MeshStandardMaterial({ color: STEEL, metalness: 0.55, roughness: 0.42 }));
          ring.position.y = DECK + fy;
          ring.castShadow = true;
          g.add(ring);
        });

        // ---- machinery cabinet on the grass, clear of the plinth ------------
        g.add(box(t, [0.44, 0.56, 0.34], 0x6e7378, [2.98, 0.28, 0.92], { tex: 'metal', repeat: [2, 2], metal: 0.4, rough: 0.5, bump: 0.03 }));
        g.add(box(t, [0.48, 0.04, 0.38], 0x585d62, [2.98, 0.58, 0.92], { tex: 'metal', metal: 0.4, rough: 0.5 })); // cabinet lid
        g.add(mergedBoxes(
          t,
          [0, 1, 2].map((i) => ({ dims: [0.3, 0.02, 0.02] as [number, number, number], pos: [2.98, 0.42 - i * 0.06, 1.09] as [number, number, number] })),
          0x3f4348,
          { rough: 0.6 },
        )); // louvred vent

        // ---- night lighting: 4 pad floodlamps (emissive) + ONE PointLight ---
        // masts sit OUTSIDE the 2.51 blade sweep at radius 2.72, heads at 0.92
        const lampMat = new t.MeshStandardMaterial({ color: 0xfff3c0, emissive: 0xffcc55, emissiveIntensity: 0.15, roughness: 0.35 });
        const beaconMat = new t.MeshStandardMaterial({ color: 0xff5544, emissive: 0xff2222, emissiveIntensity: 0.15, roughness: 0.4 });
        const LR = 2.72 / Math.SQRT2;
        (
          [
            [LR, LR],
            [-LR, -LR],
            [LR, -LR],
            [-LR, LR],
          ] as const
        ).forEach(([bx, bz]) => {
          g.add(cyl(t, 0.03, 0.04, 0.86, 0x2c2c30, [bx, 0.43, bz], { tex: 'metal', metal: 0.5, rough: 0.5, seg: 8 })); // 0.0..0.86
          const head = new t.Mesh(new t.SphereGeometry(0.05, 10, 8), lampMat);
          head.position.set(bx, 0.89, bz);
          g.add(head);
        });
        const padLight = new t.PointLight(0xffc97a, 0, 5.5, 2);
        padLight.position.set(LR, 0.95, LR);
        g.add(padLight);

        // ---- the two flyers ------------------------------------------------
        const flyers: { grp: THREE.Group; rotor: THREE.Group; tailRotor: THREE.Group; ph: number }[] = [];
        for (let i = 0; i < 2; i++) {
          const f = buildFlyer(t, beaconMat, seats, i, withRiders);
          g.add(f.grp);
          flyers.push({ ...f, ph: i * Math.PI });
        }
        vehicle = flyers[0].grp;
        const PARK_Y = DECK + 0.422; // skid bottoms (local −0.422) rest ON the deck when parked
        return (time: number, motionK = 1) => {
          // day -> night gate: pad floodlights + blinking tail beacons
          const nk = nightKOf(g);
          const ease = nk * nk * (3 - 2 * nk); // smoothstep
          lampMat.emissiveIntensity = 0.15 + (1.1 - 0.15) * ease;
          beaconMat.emissiveIntensity = 0.15 + (0.3 + 1.3 * (0.5 + 0.5 * Math.sin(time * 4.5)) - 0.15) * ease;
          padLight.intensity = ease * 0.9;
          flyers.forEach(({ grp, rotor, tailRotor, ph }) => {
            const a = time * 0.5 + ph;
            // parked (motionK 0): skids settle onto the concrete for boarding —
            // cruise height + bob + travel bank all follow the gate envelope
            grp.position.set(Math.cos(a) * R_FLY, PARK_Y + (0.32 + Math.sin(time * 1.3 + ph) * 0.12) * motionK, Math.sin(a) * R_FLY);
            grp.rotation.y = -a; // nose along travel
            grp.rotation.z = 0.08 * motionK;
            rotor.rotation.y = time * 14;
            tailRotor.rotation.x = time * 30;
          });
        };
      })(three, group) || undefined;
  // station gate: helis land and hold while guests board/unload (spinDown
  // 0.9 — grounded before 'unloadingPassengers' begins)
  const gate = createMotionGate((tt, k) => update?.(tt, k), { spinDown: 0.9 });
  return { group, update: gate.update, vehicle, seatWorld: makeSeatWorld(three, seats), onStateChange: gate.onStateChange };
}

/** <Helicycles> — composable ride (components/Park/Context.md): mounts the ride
 *  at `position`/`rotation`; inside a <Park>, `register` wires the full
 *  GameManager ride via <ConfigurableRide> — queue HEAD 1.5 out the local +z
 *  front (lane extending +z), exit hut beside it at local [-1.5, 1.35],
 *  boarding at the base. Capacity 2 = the 2 single-seat helicopters: REAL
 *  guests fly them via `seatWorld` (decorative riders off when registered)
 *  and the flight is motion-gated — the helis LAND on the concrete pad for
 *  boarding/unloading. Override with top-level props / `queue`. */
export const Helicycles = composableRide<{ riders?: boolean }>(
  'Helicycles',
  (t, props) => buildHelicyclesScene(t, { riders: props.riders ?? !(props as { register?: unknown }).register }),
  { defaults: { name: 'Helicycles', capacity: 2, rideDuration: 8, intensity: 2, price: 2 } },
);

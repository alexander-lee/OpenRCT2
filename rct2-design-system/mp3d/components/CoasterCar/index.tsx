import * as THREE from 'three';
import { box, cyl, ball, nightKOf } from '../Stage';
import { buildPeep, SHIRTS, SKIN_TONES } from '../Guest';
import { VehicleScheme, rideColourPreset } from '../ColorKit';
import { composable } from '../Park';

// A wooden-coaster car, detailed from the RCT2 vehicle sprite: a rounded orange
// tub with chrome side trim, two bogies of wheels, over-shoulder restraints and
// two seated peeps (diverse skin + shirts, each with a face). RCT2 trains use
// DISTINCT sprites per position, so `variant` picks the body dressing:
//   'front'  (default) — swept nose, headlight + number panel (the lead car)
//   'middle' — flat front, chrome couplers at BOTH ends
//   'end'    — like middle but a tapered tail fairing + red tail-light
// Chassis, tub, riders, wheels and overall dimensions are IDENTICAL across
// variants, so train spacing math never changes. Exported so WoodenCoaster,
// SplineCoaster, CoasterBuilder and SplineRideKit build trains from it.
// The optional `scheme` is an RCT2 VehicleColour (ride/VehicleColour.h:19-24):
// body → tub hull, trim → chrome waist trim + couplers, tertiary → nose/tail
// fairings. Omitted = the classic orange/chrome livery, byte-identical.
export type CoasterCarVariant = 'front' | 'middle' | 'end';

/** seat geometry the seatWorld helpers rely on: 2 riders per car at these
 *  car-local offsets (peep GROUP origin — hips settle onto the cushions).
 *  The z pitch is 0.44 (front 0.24 / rear −0.20): the seat BACKS are welded
 *  onto the cushions (see buildCoasterCar) and that pitch is what keeps the
 *  rear rider's folded legs clear of the seat back in front of them. Park's
 *  trainSeatWorld reads these offsets, so they move together with the tub. */
export const COASTER_CAR_SEATS: { y: number; z: number }[] = [
  { y: 0.22, z: 0.24 },
  { y: 0.22, z: -0.2 },
];

export function buildCoasterCar(
  t: typeof THREE,
  variant: CoasterCarVariant = 'front',
  scheme?: VehicleScheme,
  opts: { riders?: boolean } = {},
): THREE.Group {
  const g = new t.Group();
  const ORANGE = scheme?.body ?? 0xe0601a;
  const ORANGE_D = scheme?.tertiary ?? 0xb5480f;
  const CHROME = scheme?.trim ?? 0xcfd4da;
  const DARK = 0x232327;
  const SEAT = 0x191a1e;
  const PAD = 0x6b2430; // padded cushion fabric — reads as upholstery, not part of the scheme

  // chassis + bogies
  g.add(box(t, [0.5, 0.1, 1.0], DARK, [0, 0.02, 0], { tex: 'metal', repeat: [3, 5], metal: 0.7, rough: 0.5 }));
  [-0.34, 0.34].forEach((z) => g.add(box(t, [0.56, 0.08, 0.24], DARK, [0, -0.04, z], { tex: 'metal', metal: 0.6, rough: 0.5 })));

  // tub: layered boxes for a rounded hull
  g.add(box(t, [0.58, 0.3, 1.0], ORANGE, [0, 0.24, 0], { tex: 'plastic', repeat: [2, 1], rough: 0.38 }));
  g.add(box(t, [0.64, 0.16, 0.94], ORANGE, [0, 0.2, 0], { tex: 'plastic', repeat: [2, 1], rough: 0.38 }));
  g.add(box(t, [0.5, 0.22, 0.86], SEAT, [0, 0.29, 0], { tex: 'fabric', repeat: [2, 3], rough: 0.9 })); // interior well floor (top 0.40 — cushions + riders sit proud of it)
  // chrome waist trim
  g.add(box(t, [0.66, 0.04, 0.96], CHROME, [0, 0.33, 0], { tex: 'metal', metal: 0.9, rough: 0.2 }));

  if (variant === 'front') {
    // front number panel + swept nose (front +z) + headlight — off by day,
    // gated on via gateCarLights()
    g.add(box(t, [0.52, 0.14, 0.02], 0xf5e6c8, [0, 0.24, 0.505], { rough: 0.5 })); // front panel
    g.add(box(t, [0.5, 0.26, 0.3], ORANGE_D, [0, 0.2, 0.56], { rotX: -0.7, tex: 'plastic', repeat: [1, 1], rough: 0.38 }));
    const lampBall = ball(t, 0.05, 0xfff3c0, [0, 0.24, 0.66], { emissive: 0xffcc55, rough: 0.3 });
    (lampBall.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.15; // faint glass tint by day
    g.add(lampBall);
    const headlamp = new t.PointLight(0xffcc66, 0, 3.5, 2); // the car casts real light at night
    headlamp.position.set(0, 0.26, 0.8);
    g.add(headlamp);
    // lamp refs for day/night gating (SplineCoaster & friends call gateCarLights)
    g.userData.headlamp = headlamp;
    g.userData.headlampMat = lampBall.material;
  } else {
    // middle/end cars have a FLAT front and a chrome coupler reaching forward
    // to the car ahead (RCT2's plain trailing-car sprites have no nose)
    g.add(cyl(t, 0.04, 0.04, 0.16, CHROME, [0, 0.18, 0.58], { rotX: Math.PI / 2, metal: 0.9, rough: 0.2, seg: 10 }));
  }

  if (variant === 'end') {
    // tapered tail fairing (rear −z, swept the opposite way to the nose) with
    // a red tail-light — emissive gated after dark like the headlamp
    g.add(box(t, [0.5, 0.2, 0.22], ORANGE_D, [0, 0.18, -0.55], { rotX: 0.7, tex: 'plastic', repeat: [1, 1], rough: 0.38 }));
    const tailBall = ball(t, 0.035, 0xd94a3a, [0, 0.22, -0.62], { emissive: 0xff2412, rough: 0.3 });
    (tailBall.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.15; // faint red glass by day
    g.add(tailBall);
    g.userData.taillampMat = tailBall.material;
  } else {
    // rear coupler (front + middle cars couple to the car behind)
    g.add(cyl(t, 0.04, 0.04, 0.16, CHROME, [0, 0.18, -0.58], { rotX: Math.PI / 2, metal: 0.9, rough: 0.2, seg: 10 }));
  }

  // two seated peeps front/back in proper BUCKET seats, each built as one
  // welded unit so nothing floats: the cushion is sunk 0.03 into the well
  // floor (top 0.46), the dark back SHELL rises straight out of that cushion
  // (bottom 0.415 — inside the cushion; front face 0.01 inside the cushion's
  // rear edge), the fabric back pad + lumbar roll are proud of the shell and
  // also bite into the cushion top, and a headrest caps the shell. Every
  // junction INTERPENETRATES by >= 0.005, so there is no gap to see from any
  // orbit angle. Registered trains pass `riders: false` — the GameManager
  // seats REAL guests at the COASTER_CAR_SEATS anchors instead, and empty
  // seats read empty (which is exactly why the upholstery has to hold up).
  COASTER_CAR_SEATS.forEach(({ z }, i) => {
    g.add(box(t, [0.42, 0.09, 0.31], PAD, [0, 0.415, z + 0.015], { tex: 'fabric', repeat: [2, 1], rough: 0.95 })); // cushion: 0.37..0.46, sunk into the well floor (top 0.40)
    g.add(box(t, [0.46, 0.3, 0.08], SEAT, [0, 0.565, z - 0.17], { tex: 'plastic', repeat: [2, 1], rough: 0.55 })); // back shell 0.415..0.715, WELDED into the cushion
    g.add(box(t, [0.36, 0.24, 0.055], PAD, [0, 0.55, z - 0.09], { tex: 'fabric', repeat: [2, 2], rough: 0.95 })); // back pad 0.43..0.67, proud of the shell, biting the cushion
    g.add(cyl(t, 0.035, 0.035, 0.34, PAD, [0, 0.475, z - 0.085], { rotZ: Math.PI / 2, tex: 'fabric', repeat: [3, 1], rough: 0.95, seg: 12 })); // lumbar roll sitting ON the cushion
    g.add(box(t, [0.3, 0.06, 0.1], SEAT, [0, 0.695, z - 0.14], { tex: 'plastic', rough: 0.55 })); // headrest cap on the shell top
    if (opts.riders === false) return;
    const p = buildPeep(t, { skin: SKIN_TONES[i], shirt: SHIRTS[(i * 3 + 2) % SHIRTS.length], seated: true, expression: i === 0 ? 'surprised' : 'happy' });
    p.group.scale.setScalar(0.5);
    p.group.position.set(0, 0.22, z); // hip undersides (0.445) settle 0.015 INTO the cushion top (0.46)
    p.group.userData.lodDetail = true; // park runtime sheds riders beyond NEAR
    g.add(p.group);
    // lap bar: padded cross bar over the thighs on a centre stem off the cushion
    g.add(cyl(t, 0.022, 0.022, 0.42, DARK, [0, 0.53, z + 0.14], { rotZ: Math.PI / 2, metal: 0.6, rough: 0.4, seg: 10 }));
    g.add(cyl(t, 0.036, 0.036, 0.24, 0x3a2a30, [0, 0.53, z + 0.14], { rotZ: Math.PI / 2, rough: 0.95, seg: 10 })); // foam sleeve
    g.add(cyl(t, 0.018, 0.018, 0.16, DARK, [0, 0.46, z + 0.14], { metal: 0.6, rough: 0.4, seg: 8 })); // stem cushion -> bar
  });

  const wheel = (x: number, z: number) =>
    cyl(t, 0.1, 0.1, 0.07, 0x141417, [x, -0.05, z], { rotZ: Math.PI / 2, tex: 'metal', repeat: [4, 1], metal: 0.6, rough: 0.4, seg: 20 });
  [
    [-0.3, 0.34],
    [0.3, 0.34],
    [-0.3, -0.34],
    [0.3, -0.34],
  ].forEach(([x, z]) => g.add(wheel(x, z)));

  return g;
}

/**
 * Dim/raise a coaster car's lights with the day/night cycle. `k` is the
 * Stage nightK (see nightKOf): 0 = day (lights off, faint glass tint),
 * 1 = night (full headlight beam + glowing red tail-light). Safe on any
 * group — no-ops without the lamp refs (front cars carry headlamp/
 * headlampMat, end cars taillampMat; middle cars have neither).
 */
export function gateCarLights(car: THREE.Group, k: number) {
  const ease = k * k * (3 - 2 * k); // smoothstep
  const lamp = car.userData.headlamp as THREE.PointLight | undefined;
  if (lamp) lamp.intensity = ease * 0.6;
  const m = car.userData.headlampMat as THREE.MeshStandardMaterial | undefined;
  if (m) m.emissiveIntensity = 0.15 + (1.2 - 0.15) * ease;
  const tail = car.userData.taillampMat as THREE.MeshStandardMaterial | undefined;
  if (tail) tail.emissiveIntensity = 0.15 + (1.4 - 0.15) * ease;
}

/** straight test-track bed: wooden ties + twin steel rails, `len` units long */
function testTrack(t: typeof THREE, g: THREE.Group, len: number) {
  const TIE = 0x6b4626;
  const half = len / 2 - 0.1;
  for (let z = -half; z <= half + 1e-6; z += 0.4) g.add(box(t, [0.98, 0.06, 0.12], TIE, [0, 0.02, z], { tex: 'wood', repeat: [3, 1], rough: 0.9 }));
  g.add(box(t, [0.07, 0.08, len], 0x8b8f96, [-0.32, 0.09, 0], { tex: 'metal', repeat: [1, 20], metal: 0.85, rough: 0.3 }));
  g.add(box(t, [0.07, 0.08, len], 0x8b8f96, [0.32, 0.09, 0], { tex: 'metal', repeat: [1, 20], metal: 0.85, rough: 0.3 }));
}

export function buildCoasterCarScene(three: typeof THREE): { group: THREE.Group; update?: (time: number) => void } {
  const group = new three.Group();
  const update =
    ((t: typeof THREE, g: THREE.Group) => {
        testTrack(t, g, 3.0);
        const car = buildCoasterCar(t);
        car.position.y = 0.28; // wheel bottoms (local -0.15) meet the rail tops at 0.13
        g.add(car);
        return (time) => {
          car.position.y = 0.28 + Math.sin(time * 2) * 0.015;
          car.rotation.z = Math.sin(time * 1.3) * 0.015;
          gateCarLights(car, nightKOf(g)); // headlight follows the day/night toggle
        };
      })(three, group) || undefined;
  return { group, update };
}

/** <CoasterCar> — composable (components/Park/Context.md): mounts the scene at
 *  `position`/`rotation`/`scale` inside a <Park> or <ScenePreview>. */
export const CoasterCar = composable('CoasterCar', (t) => buildCoasterCarScene(t));

/** The full 3-car train coupled — front (nose + headlight), middle (flat,
 *  couplers both ends) and end (tail fairing + red tail-light). Car order
 *  matches how run()/attachTrain lead: index 0 = front car at +z. Dressed in
 *  a seeded RCT2 steel scheme (bordeauxRed/lightOrange/white —
 *  TwisterRollerCoaster.h:57) to show the VehicleScheme customization. */
export function buildCoasterTrainScene(three: typeof THREE): { group: THREE.Group; update?: (time: number) => void } {
  const group = new three.Group();
  const update =
    ((t: typeof THREE, g: THREE.Group) => {
      testTrack(t, g, 5.6);
      const SPACING = 1.5; // same daylight-between-cars spacing as SplineCoaster
      const livery = rideColourPreset(27, 'steel').vehicles[0]; // deterministic: bordeauxRed body / lightOrange trim / white fairings
      const cars = (['front', 'middle', 'end'] as const).map((v, i) => {
        const car = buildCoasterCar(t, v, livery);
        car.position.set(0, 0.28, (1 - i) * SPACING); // front car leads at +z
        g.add(car);
        return car;
      });
      return (time: number) => {
        const k = nightKOf(g);
        cars.forEach((car, i) => {
          car.position.y = 0.28 + Math.sin(time * 2 + i * 0.9) * 0.015;
          car.rotation.z = Math.sin(time * 1.3 + i * 0.7) * 0.015;
          gateCarLights(car, k); // headlight + tail-light follow day/night
        });
      };
    })(three, group) || undefined;
  return { group, update };
}

/** <CoasterTrain> — composable (components/Park/Context.md) */
export const CoasterTrain = composable('CoasterTrain', (t) => buildCoasterTrainScene(t));

/** @deprecated renamed — use <CoasterTrain> inside a <ScenePreview> */
export const CoasterTrainPreview = CoasterTrain;

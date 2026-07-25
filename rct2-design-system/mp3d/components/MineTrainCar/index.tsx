import * as THREE from 'three';
import { box, cyl, ball } from '../Stage';
import { buildPeep, SHIRTS, SKIN_TONES } from '../Guest';
import { VehicleScheme } from '../ColorKit';
import { composable } from '../Park';

// Mine-train ORE CART modelled from the RCT2 mine-train vehicle sprite: a
// rough-sawn timber tub bound with iron bands on an iron underframe, riding
// four flanged wheels. RCT2 trains use DISTINCT sprites per position, so
// `variant` picks the dressing:
//   'front'  (default) — ore-guard plate + a hooded MINE LANTERN (night-gated)
//   'middle' — plain, iron couplers at BOTH ends
//   'end'    — tail coupler plus a red rear lantern
// Tub, bench seats, riders, wheels and overall dimensions are IDENTICAL across
// variants, so train spacing math never changes. Exported so MineTrainCoaster
// (and any <TrackRide vehicles={…}>) can build a whole ore train from it; the
// lamp refs use the same `userData.headlamp`/`headlampMat`/`taillampMat` keys
// CoasterCar uses, so `gateCarLights` works on these carts unchanged.
export type MineTrainCartVariant = 'front' | 'middle' | 'end';

/** seat geometry the seatWorld helpers rely on: 2 riders per cart at these
 *  cart-local offsets (peep GROUP origin — hips settle 0.015 INTO the cushion
 *  top at 0.435). The z pitch is 0.44 (front 0.22 / rear −0.22): the bench
 *  backs are welded onto the cushions, and that pitch keeps the rear rider's
 *  folded legs clear of the bench in front. MineTrainCoaster's seatWorld reads
 *  these offsets off the live cart transform, so riders ride the ore train. */
export const MINE_CART_SEATS: { y: number; z: number }[] = [
  { y: 0.195, z: 0.22 },
  { y: 0.195, z: -0.22 },
];

const IRON = 0x2a2a2e; // wrought-iron bands, rim and underframe
const IRON_D = 0x161619; // wheel tyres / dark ironwork
const TIMBER = 0x6a4a2a; // rough-sawn tub planking
const TIMBER_D = 0x4a3018; // shaded end planking
const LEATHER = 0x5c3320; // bench upholstery

/**
 * One ore cart, origin on the wheel axle line: wheel bottoms sit at −0.15, so
 * a spline runner's default `wheelOffset` 0.195 drops them exactly onto the
 * 0.045 rail tops. `scheme` is an RCT2 VehicleColour (ride/VehicleColour.h:
 * 19-24): body → tub planking, trim → ironwork (bands + rim), tertiary → the
 * end plank panels. Omitted = the weathered timber/iron default.
 */
export function buildMineTrainCart(
  t: typeof THREE,
  variant: MineTrainCartVariant = 'front',
  scheme?: VehicleScheme,
  opts: { riders?: boolean } = {},
): THREE.Group {
  const g = new t.Group();
  const WOOD = scheme?.body ?? TIMBER;
  const WOOD_D = scheme?.tertiary ?? TIMBER_D;
  const BAND = scheme?.trim ?? IRON;

  // ---- iron underframe + bogie bars -----------------------------------------
  g.add(box(t, [0.5, 0.09, 1.02], IRON, [0, 0.015, 0], { tex: 'metal', repeat: [3, 5], metal: 0.6, rough: 0.55 }));
  [-0.34, 0.34].forEach((z) => g.add(box(t, [0.58, 0.07, 0.22], IRON, [0, -0.04, z], { tex: 'metal', metal: 0.6, rough: 0.55 })));

  // ---- rough-sawn timber tub -------------------------------------------------
  g.add(box(t, [0.58, 0.34, 1.0], WOOD, [0, 0.22, 0], { tex: 'wood', repeat: [3, 2], rough: 0.92, bump: 0.02 })); // hull
  g.add(box(t, [0.64, 0.14, 0.94], WOOD, [0, 0.17, 0], { tex: 'wood', repeat: [3, 1], rough: 0.92 })); // belly flare
  [-0.49, 0.49].forEach((z) => g.add(box(t, [0.6, 0.34, 0.05], WOOD_D, [0, 0.22, z], { tex: 'wood', repeat: [2, 2], rough: 0.92 }))); // end planks
  g.add(box(t, [0.5, 0.16, 0.88], 0x1a120a, [0, 0.3, 0], { rough: 0.95 })); // dark interior well (top 0.38)
  // iron bands strapped around the OUTSIDE of the tub: side straps at two
  // stations plus horizontal straps across the end planks
  [-0.28, 0.28].forEach((z) =>
    [-0.295, 0.295].forEach((x) => g.add(box(t, [0.05, 0.34, 0.06], BAND, [x, 0.23, z], { tex: 'metal', metal: 0.6, rough: 0.5 }))),
  );
  [-0.5, 0.5].forEach((z) => g.add(box(t, [0.6, 0.06, 0.04], BAND, [0, 0.26, z], { tex: 'metal', metal: 0.6, rough: 0.5 })));
  // open iron RIM (a frame, never a lid): long side strips + end strips
  [-0.29, 0.29].forEach((x) => g.add(box(t, [0.08, 0.05, 1.02], BAND, [x, 0.4, 0], { tex: 'metal', metal: 0.6, rough: 0.5 })));
  [-0.485, 0.485].forEach((z) => g.add(box(t, [0.64, 0.05, 0.09], BAND, [0, 0.4, z], { tex: 'metal', metal: 0.6, rough: 0.5 })));

  // ---- two in-line bench seats ----------------------------------------------
  MINE_CART_SEATS.forEach(({ z }, i) => {
    g.add(box(t, [0.44, 0.07, 0.32], LEATHER, [0, 0.4, z + 0.01], { tex: 'fabric', repeat: [2, 1], rough: 0.95 })); // cushion 0.365..0.435, sunk into the well floor (0.38)
    g.add(box(t, [0.44, 0.24, 0.05], LEATHER, [0, 0.5, z - 0.18], { tex: 'fabric', repeat: [2, 2], rough: 0.95 })); // back pad, foot buried in the cushion
    g.add(cyl(t, 0.03, 0.03, 0.4, LEATHER, [0, 0.45, z - 0.135], { rotZ: Math.PI / 2, tex: 'fabric', repeat: [3, 1], rough: 0.95, seg: 10 })); // lumbar roll ON the cushion
    // grab bar on stems off the iron rim, right at the rider's hands
    g.add(cyl(t, 0.018, 0.018, 0.46, IRON, [0, 0.49, z + 0.16], { rotZ: Math.PI / 2, metal: 0.6, rough: 0.4, seg: 10 }));
    [-0.19, 0.19].forEach((x) => g.add(cyl(t, 0.013, 0.013, 0.1, IRON, [x, 0.44, z + 0.16], { metal: 0.6, rough: 0.4, seg: 6 })));
    if (opts.riders === false) return;
    const p = buildPeep(t, {
      skin: SKIN_TONES[(i * 2 + 1) % SKIN_TONES.length],
      shirt: SHIRTS[[7, 3][i % 2] % SHIRTS.length], // earthy prospector shirts
      trousers: 0x3a2a1a,
      seated: true,
      expression: i === 0 ? 'surprised' : 'happy',
    });
    p.group.scale.setScalar(0.5);
    p.group.position.set(0, 0.195, z); // hip underside 0.42 settles 0.015 INTO the 0.435 cushion top
    p.group.userData.lodDetail = true; // park runtime sheds riders beyond NEAR
    g.add(p.group);
  });

  // ---- per-variant dressing --------------------------------------------------
  if (variant === 'front') {
    // ore-guard plate raked over the leading axle + a hooded mine lantern
    g.add(box(t, [0.5, 0.24, 0.06], IRON, [0, 0.12, 0.53], { rotX: -0.45, tex: 'metal', metal: 0.55, rough: 0.6 }));
    g.add(box(t, [0.16, 0.14, 0.14], IRON, [0, 0.5, 0.5], { tex: 'metal', metal: 0.6, rough: 0.5 })); // lantern housing
    g.add(box(t, [0.2, 0.04, 0.18], IRON, [0, 0.585, 0.5], { tex: 'metal', metal: 0.6, rough: 0.5 })); // lantern hood
    const glass = ball(t, 0.052, 0xffe6b0, [0, 0.49, 0.575], { emissive: 0xffb45e, rough: 0.3 });
    (glass.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.15; // faint glass by day
    g.add(glass);
    const headlamp = new t.PointLight(0xffb45e, 0, 3.2, 2); // the cart's own light after dark
    headlamp.position.set(0, 0.5, 0.75);
    g.add(headlamp);
    g.userData.headlamp = headlamp; // gateCarLights (CoasterCar) reads these
    g.userData.headlampMat = glass.material;
  } else {
    g.add(cyl(t, 0.035, 0.035, 0.16, IRON, [0, 0.13, 0.58], { rotX: Math.PI / 2, metal: 0.7, rough: 0.4, seg: 10 })); // front coupler
  }
  if (variant === 'end') {
    const tail = ball(t, 0.038, 0xd94a3a, [0, 0.44, -0.55], { emissive: 0xff2412, rough: 0.3 });
    (tail.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.15;
    g.add(tail);
    g.add(box(t, [0.1, 0.1, 0.05], IRON, [0, 0.44, -0.51], { tex: 'metal', metal: 0.6, rough: 0.5 })); // lamp bracket
    g.userData.taillampMat = tail.material;
  }
  g.add(cyl(t, 0.035, 0.035, 0.16, IRON, [0, 0.13, -0.58], { rotX: Math.PI / 2, metal: 0.7, rough: 0.4, seg: 10 })); // rear coupler

  // ---- flanged wheels (bottoms at −0.15) -------------------------------------
  [
    [-0.3, 0.34],
    [0.3, 0.34],
    [-0.3, -0.34],
    [0.3, -0.34],
  ].forEach(([x, z]) => {
    g.add(cyl(t, 0.1, 0.1, 0.07, IRON_D, [x, -0.05, z], { rotZ: Math.PI / 2, tex: 'metal', repeat: [4, 1], metal: 0.6, rough: 0.45, seg: 18 }));
    g.add(cyl(t, 0.115, 0.115, 0.02, IRON_D, [x > 0 ? x + 0.04 : x - 0.04, -0.05, z], { rotZ: Math.PI / 2, metal: 0.6, rough: 0.45, seg: 16 })); // flange
  });

  return g;
}

/** straight rustic test-track bed: rough sleepers + twin rusted rails */
function mineTrack(t: typeof THREE, g: THREE.Group, len: number) {
  const half = len / 2 - 0.1;
  for (let z = -half; z <= half + 1e-6; z += 0.4) g.add(box(t, [0.98, 0.06, 0.12], TIMBER_D, [0, 0.02, z], { tex: 'wood', repeat: [3, 1], rough: 0.95 }));
  [-0.32, 0.32].forEach((x) => g.add(box(t, [0.08, 0.08, len], 0x7a5a44, [x, 0.09, 0], { tex: 'metal', repeat: [1, 20], metal: 0.55, rough: 0.65 })));
}

export function buildMineTrainCarScene(three: typeof THREE): { group: THREE.Group; update?: (time: number) => void } {
  const group = new three.Group();
  const update =
    ((t: typeof THREE, g: THREE.Group) => {
        mineTrack(t, g, 3.0);
        const car = buildMineTrainCart(t, 'front');
        car.position.y = 0.28; // wheel bottoms (local −0.15) meet the rail tops at 0.13
        g.add(car);
        return (time) => {
          car.position.y = 0.28 + Math.sin(time * 2) * 0.012;
          car.rotation.z = Math.sin(time) * 0.02;
        };
      })(three, group) || undefined;
  return { group, update };
}

/** <MineTrainCar> — composable (components/Park/Context.md): mounts the scene at
 *  `position`/`rotation`/`scale` inside a <Park> or <ScenePreview>. The cart
 *  itself is `buildMineTrainCart(t, variant, scheme, { riders })` — the vehicle
 *  <MineTrainCoaster> runs on its ore train. */
export const MineTrainCar = composable('MineTrainCar', (t) => buildMineTrainCarScene(t));

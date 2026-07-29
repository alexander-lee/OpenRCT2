// ---------------------------------------------------------------------------
// GreatZeppelin — Brasswork Foundry's giant: a rigid airship riding at its mooring mast.
//
// ONE GIANT SET-PIECE PER WORLD. `fire` always had `<Volcano>` (r 2.75, h 2.55,
// a cone visible from the gate) and the other four worlds had nothing of that
// mass — their biggest pieces were props, so those lands read as a lawn with
// ornaments on it. This is `steampunk`'s answer, built to the same class.
//
// Deterministic (hashed jitter only), night-gated through `nightKOf(group)`,
// and it registers a footprint so guests and the OBB sweep route around it.
// Mount it with `<GreatZeppelin position={[x, z]} />`, or let
// `<WorldLandmark plan={W} />` pick it off the world's theme.
// ---------------------------------------------------------------------------

import * as THREE from 'three';
import { ball, box, cyl } from '../Stage';
import { composable } from '../Park';

/** what each landmark builder returns */
export interface LandmarkBuilt {
  group: THREE.Group;
  /** the ground radius guests must walk around */
  radius: number;
  update?: (time: number) => void;
}

/** deterministic 0..1 — hashed, never Math.random, so a remount is identical */
const h01 = (n: number) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

/** local mirror of Stage's MergedBoxSpec (a second `import type` line from the
 *  same module tripped the design-system resolver) */
type MergedBoxSpec = {
  dims: [number, number, number];
  pos?: [number, number, number];
  rotX?: number; rotY?: number; rotZ?: number;
  matrix?: THREE.Matrix4;
  repeat?: [number, number];
};

export function buildGreatZeppelin(t: typeof THREE): LandmarkBuilt {
  const g = new t.Group();
  const SKIN = 0xc3b7a1;
  const SKIND = 0x9a8d76;
  const IRON = 0x5d5148;
  const BRASS = 0xb08a3c;
  const GLASS = 0x9fd4e0;

  // ---- the mooring mast ---------------------------------------------------
  const mastH = 4.6;
  for (let i = 0; i < 4; i += 1) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    g.add(box(t, [0.14, mastH, 0.14], IRON, [Math.cos(a) * 0.6, mastH / 2, Math.sin(a) * 0.6], {
      rotX: Math.sin(a) * 0.12, rotZ: -Math.cos(a) * 0.12, tex: 'metal', metal: 0.6, rough: 0.5,
    }));
    // lattice bracing, so the mast reads as a structure not four sticks
    for (let k = 0; k < 4; k += 1) {
      const b2 = (i / 4) * Math.PI * 2 + Math.PI / 4 + Math.PI / 2;
      g.add(box(t, [0.06, 0.06, 1.0], IRON, [
        Math.cos(a) * 0.6 * 0.85 + Math.cos(b2) * 0.1, 0.7 + k * 1.05, Math.sin(a) * 0.6 * 0.85 + Math.sin(b2) * 0.1,
      ], { rotY: a + 0.8, rotX: 0.6, tex: 'metal', metal: 0.6 }));
    }
  }
  g.add(cyl(t, 0.95, 1.15, 0.35, IRON, [0, 0.18, 0], { tex: 'concrete', rough: 1, seg: 16 }));

  // ---- THE ENVELOPE — ONE smooth ellipsoid, not a stack of cylinders ------
  // The first build lofted 22 cylinders down the hull, which read as a ribbed
  // tube and cost 22 draw calls. A sphere scaled on x IS the airship profile,
  // in one mesh, and the ring frames below supply the rigid-airship banding.
  const ship = new t.Group();
  ship.position.set(0, mastH + 1.15, 0);
  ship.rotation.y = 0.35;
  const LEN = 12.0;
  const RMAX = 1.62;

  const hull = ball(t, 1, SKIN, [0, 0, 0], { rough: 0.82, metal: 0.05 });
  hull.scale.set(LEN / 2, RMAX, RMAX);
  ship.add(hull);
  // a darker belly panel so the form reads in flat light
  const belly = ball(t, 1, SKIND, [0, -0.24, 0], { rough: 0.9 });
  belly.scale.set(LEN / 2 * 0.94, RMAX * 0.82, RMAX * 0.94);
  ship.add(belly);
  // nose cap + tail cone
  ship.add(cyl(t, 0.12, 0.55, 0.6, BRASS, [-LEN / 2 + 0.1, 0, 0], { rotZ: Math.PI / 2, tex: 'metal', metal: 0.75, rough: 0.35, seg: 14 }));
  ship.add(cyl(t, 0.06, 0.42, 0.9, SKIND, [LEN / 2 - 0.25, 0, 0], { rotZ: -Math.PI / 2, tex: 'concrete', rough: 0.85, seg: 14 }));

  // ring frames — thin TORI round the hull, the rigid airship's banding
  const bandMat = new t.MeshStandardMaterial({ color: BRASS, metalness: 0.75, roughness: 0.35 });
  [-4.0, -2.0, 0.2, 2.4, 4.3].forEach((x) => {
    const u = Math.min(0.98, Math.max(0.02, (x + LEN / 2) / LEN));
    const r = RMAX * Math.sqrt(Math.max(0.04, 1 - Math.pow((u - 0.5) * 2, 2))) + 0.03;
    const band = new t.Mesh(new t.TorusGeometry(r, 0.035, 6, 24), bandMat);
    band.rotation.y = Math.PI / 2;
    band.position.x = x;
    ship.add(band);
  });
  // longitudinal stringers
  [0.9, -0.9].forEach((sz) =>
    ship.add(box(t, [LEN * 0.78, 0.05, 0.05], BRASS, [0.2, 0.55, sz], { tex: 'metal', metal: 0.7 })),
  );

  // ---- tail fins: a proper cruciform, tapered ----------------------------
  const finX = 4.9;
  ([[0, 1], [0, -1], [1, 0], [-1, 0]] as const).forEach(([fy, fz]) => {
    const fin = new t.Group();
    fin.position.set(finX, fy * 1.05, fz * 1.05);
    const blade = box(t, [1.9, 0.08, 1.35], SKIND, [0, 0, 0], { tex: 'concrete', rough: 0.85 });
    if (fy !== 0) blade.rotation.x = Math.PI / 2;
    fin.add(blade);
    // the moving control surface at its trailing edge
    const rud = box(t, [0.55, 0.07, 1.15], SKIN, [0.95, 0, 0], { tex: 'concrete', rough: 0.85 });
    if (fy !== 0) rud.rotation.x = Math.PI / 2;
    fin.add(rud);
    ship.add(fin);
  });

  // ---- gondola: cabin, windows, nacelles, PROPELLERS ---------------------
  const gon = new t.Group();
  gon.position.set(-1.7, -RMAX - 0.32, 0);
  gon.add(box(t, [2.6, 0.62, 0.9], IRON, [0, 0, 0], { tex: 'metal', metal: 0.5, rough: 0.6 }));
  gon.add(cyl(t, 0.31, 0.31, 0.9, IRON, [1.3, 0, 0], { rotX: Math.PI / 2, tex: 'metal', metal: 0.5, seg: 12 }));
  [-0.45, 0.45].forEach((sz) =>
    [-0.75, -0.25, 0.25, 0.75].forEach((sx) =>
      gon.add(box(t, [0.26, 0.24, 0.03], GLASS, [sx, 0.08, sz], { emissive: 0x2b4d55, rough: 0.15, metal: 0.1 })),
    ),
  );
  ship.add(gon);

  const props: THREE.Group[] = [];
  [1.15, -1.15].forEach((sz) => {
    const nac = new t.Group();
    nac.position.set(0.6, -RMAX + 0.35, sz);
    nac.add(cyl(t, 0.3, 0.34, 0.85, IRON, [0, 0, 0], { rotZ: Math.PI / 2, tex: 'metal', metal: 0.6, seg: 12 }));
    nac.add(box(t, [0.18, 0.5, 0.12], IRON, [0.1, 0.42, 0], { tex: 'metal', metal: 0.6 })); // pylon to the hull
    // THE PROPELLER — its own group so it can actually spin
    const prop = new t.Group();
    prop.position.set(-0.55, 0, 0);
    prop.add(cyl(t, 0.09, 0.09, 0.16, BRASS, [0, 0, 0], { rotZ: Math.PI / 2, tex: 'metal', metal: 0.85, seg: 10 }));
    [0, 1, 2].forEach((k) => {
      const blade = box(t, [0.04, 0.92, 0.16], BRASS, [0, 0, 0], { tex: 'metal', metal: 0.8, rough: 0.3 });
      blade.rotation.x = (k / 3) * Math.PI * 2;
      blade.position.set(0, Math.cos((k / 3) * Math.PI * 2) * 0.46, Math.sin((k / 3) * Math.PI * 2) * 0.46);
      blade.rotation.z = 0.35;                    // pitch, so it reads as a blade
      prop.add(blade);
    });
    nac.add(prop);
    props.push(prop);
    ship.add(nac);
  });
  g.add(ship);

  // nose collar onto the mast head + guy lines
  g.add(cyl(t, 0.1, 0.34, 0.55, BRASS, [0, mastH + 0.62, 0], { tex: 'metal', metal: 0.8, seg: 12 }));
  for (let i = 0; i < 4; i += 1) {
    const a = (i / 4) * Math.PI * 2 + 0.5;
    g.add(cyl(t, 0.02, 0.02, 5.2, 0x3a3630, [Math.cos(a) * 1.6, 2.5, Math.sin(a) * 1.6], {
      rotX: Math.sin(a) * 0.52, rotZ: -Math.cos(a) * 0.52, seg: 5,
    }));
  }

  const update = (time: number) => {
    // SHE RIDES AT HER MOORING — a slow yaw round the mast, a little roll and a
    // gentle rise. Never a spin: she is tethered by the nose.
    ship.rotation.y = 0.35 + Math.sin(time * 0.19) * 0.11;
    ship.rotation.z = Math.sin(time * 0.15 + 1) * 0.03;
    ship.rotation.x = Math.sin(time * 0.23 + 2) * 0.012;
    ship.position.y = mastH + 1.15 + Math.sin(time * 0.28) * 0.09;
    // and the engines TURN — different phases so they never look geared together
    props.forEach((p, i) => { p.rotation.x = time * (5.5 + i * 0.7); });
  };
  return { group: g, radius: 2.7, update };
}

/** `<GreatZeppelin>` — steampunk's landmark. */
export const GreatZeppelin = composable('GreatZeppelin', (t) => buildGreatZeppelin(t));

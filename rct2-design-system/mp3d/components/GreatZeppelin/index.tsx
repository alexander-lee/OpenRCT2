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
import { ball, box, cyl, mergedBoxes } from '../Stage';
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

  // ---- THE GONDOLA — the one part a guest is ever close to -----------------
  // It was a box, a nose cylinder and eight flat window squares: at 2.6 u long
  // and hanging at eye height off the mast it read as a crate. A rigid airship's
  // car is a little BOAT — a hull with a rounded forefoot, a promenade window
  // band with mullions, a cambered roof, a door with steps, a keel skid it lands
  // on, and the brass and pipework that says steampunk. All of that is static
  // dressing, so the small repeated parts (mullions, rivets, roof ribs, steps)
  // are MERGED — the whole car adds ~10 draw calls, not ~60.
  const gon = new t.Group();
  gon.position.set(-1.7, -RMAX - 0.36, 0);
  const GL = 2.9;                       // gondola length
  const GW = 0.92;                      // beam
  const trim: MergedBoxSpec[] = [];     // brass small parts
  const dark: MergedBoxSpec[] = [];     // iron small parts
  // hull: a lower body with a tucked-in bottom (two boxes + a chine) so the
  // section is not a rectangle
  gon.add(box(t, [GL, 0.46, GW], IRON, [0, 0.06, 0], { tex: 'metal', metal: 0.5, rough: 0.6 }));
  gon.add(box(t, [GL * 0.94, 0.20, GW * 0.66], 0x4a4038, [0, -0.20, 0], { tex: 'metal', metal: 0.5, rough: 0.65 }));
  // rounded forefoot + a raked stern, so she has a bow and a counter
  gon.add(cyl(t, 0.33, 0.33, GW, IRON, [GL / 2 - 0.02, 0.06, 0], { rotX: Math.PI / 2, tex: 'metal', metal: 0.5, seg: 14 }));
  gon.add(cyl(t, 0.20, 0.30, GW * 0.8, IRON, [-GL / 2 + 0.06, 0.02, 0], { rotX: Math.PI / 2, tex: 'metal', metal: 0.5, seg: 12 }));
  // the CAMBERED ROOF: three shallow steps + ribs, instead of a flat lid
  gon.add(box(t, [GL * 0.99, 0.07, GW * 0.98], 0x6a5c50, [0, 0.32, 0], { tex: 'metal', metal: 0.55, rough: 0.5 }));
  gon.add(box(t, [GL * 0.90, 0.06, GW * 0.70], 0x6a5c50, [0, 0.38, 0], { tex: 'metal', metal: 0.55, rough: 0.5 }));
  for (let i = 0; i < 9; i += 1)
    trim.push({ dims: [0.05, 0.035, GW * 0.99], pos: [-GL / 2 + 0.26 + i * (GL * 0.92 / 8), 0.36, 0] });
  // PROMENADE WINDOW BAND — one long glazing per side with mullions across it,
  // which is how a real airship car looks; four separate squares never did
  [-1, 1].forEach((sd) => {
    gon.add(box(t, [GL * 0.74, 0.24, 0.03], GLASS, [0.06, 0.13, sd * (GW / 2 + 0.005)], {
      emissive: 0x2b4d55, rough: 0.12, metal: 0.1,
    }));
    for (let i = 0; i < 8; i += 1)
      trim.push({ dims: [0.045, 0.26, 0.05], pos: [0.06 - GL * 0.37 + i * (GL * 0.74 / 7), 0.13, sd * (GW / 2 + 0.01)] });
    // the sill and header the band sits between
    trim.push({ dims: [GL * 0.78, 0.045, 0.06], pos: [0.06, 0.005, sd * (GW / 2 + 0.01)] });
    trim.push({ dims: [GL * 0.78, 0.05, 0.06], pos: [0.06, 0.27, sd * (GW / 2 + 0.01)] });
    // rivet line along the hull bottom
    for (let i = 0; i < 12; i += 1)
      dark.push({ dims: [0.04, 0.04, 0.03], pos: [-GL / 2 + 0.2 + i * (GL * 0.86 / 11), -0.13, sd * (GW * 0.33 + 0.005)] });
  });
  // the CONTROL CAR at the bow: raked windscreen panes over the forefoot
  [[-0.22, 0.20], [0.0, 0.235], [0.22, 0.20]].forEach(([wz, wy]) =>
    gon.add(box(t, [0.30, 0.22, 0.03], GLASS, [GL / 2 + 0.12, wy, wz], {
      rotZ: 0.42, rotY: -wz * 0.9, emissive: 0x2b4d55, rough: 0.12, metal: 0.1,
    })),
  );
  trim.push({ dims: [0.34, 0.05, 0.78], pos: [GL / 2 + 0.06, 0.34, 0], rotZ: 0.3 });   // brow over the screens
  // the DOOR, its steps, and the handrail — the human-scale cue
  gon.add(box(t, [0.42, 0.40, 0.04], 0x54483e, [-0.62, 0.02, GW / 2 + 0.02], { tex: 'metal', metal: 0.45, rough: 0.6 }));
  trim.push({ dims: [0.06, 0.06, 0.05], pos: [-0.46, 0.02, GW / 2 + 0.05] });           // handle
  [0, 1, 2].forEach((k) =>
    dark.push({ dims: [0.34, 0.035, 0.10], pos: [-0.62, -0.20 - k * 0.13, GW / 2 + 0.06 + k * 0.04] }),
  );
  [0, 1].forEach((k) =>
    trim.push({ dims: [0.035, 0.42, 0.035], pos: [-0.44 - k * 0.36, -0.06, GW / 2 + 0.14] }),
  );
  // KEEL SKID she sets down on, on two struts
  gon.add(box(t, [GL * 0.62, 0.06, 0.14], 0x3f382f, [-0.1, -0.44, 0], { tex: 'metal', metal: 0.6, rough: 0.5 }));
  [-0.7, 0.5].forEach((sx) => dark.push({ dims: [0.07, 0.22, 0.07], pos: [sx, -0.33, 0] }));
  // steampunk plumbing: two exhaust stacks and a copper pipe run down the side
  [0.85, 0.45].forEach((sx, i) => {
    gon.add(cyl(t, 0.055, 0.07, 0.30 + i * 0.08, 0x54483e, [sx, 0.52, -0.22], { tex: 'metal', metal: 0.7, seg: 8 }));
    trim.push({ dims: [0.09, 0.04, 0.09], pos: [sx, 0.66 + i * 0.04, -0.22] });
  });
  trim.push({ dims: [GL * 0.5, 0.05, 0.05], pos: [-0.2, -0.10, -GW / 2 - 0.03] });
  // navigation lights: red to port, green to starboard (they read at night)
  gon.add(ball(t, 0.055, 0xd8402c, [GL / 2 - 0.1, 0.30, -GW / 2 + 0.06], { emissive: 0xd8402c, rough: 0.4 }));
  gon.add(ball(t, 0.055, 0x3ec46a, [GL / 2 - 0.1, 0.30, GW / 2 - 0.06], { emissive: 0x3ec46a, rough: 0.4 }));
  gon.add(mergedBoxes(t, trim, BRASS, { tex: 'metal', metal: 0.8, rough: 0.3 }));
  gon.add(mergedBoxes(t, dark, IRON, { tex: 'metal', metal: 0.6, rough: 0.5 }));
  // the four struts that actually carry her from the hull
  [-1, 1].forEach((sd) =>
    [-0.85, 0.75].forEach((sx) =>
      gon.add(box(t, [0.07, 0.42, 0.07], IRON, [sx, 0.55, sd * 0.34], {
        rotZ: -sx * 0.05, rotX: -sd * 0.16, tex: 'metal', metal: 0.65,
      })),
    ),
  );
  ship.add(gon);

  const props: THREE.Group[] = [];
  [1.15, -1.15].forEach((sz) => {
    const nac = new t.Group();
    nac.position.set(0.6, -RMAX + 0.35, sz);
    nac.add(cyl(t, 0.3, 0.34, 0.85, IRON, [0, 0, 0], { rotZ: Math.PI / 2, tex: 'metal', metal: 0.6, seg: 12 }));
    // COWLING, RADIATOR AND EXHAUST — a nacelle is an engine, not a tube. The
    // cowl ring is what reads from a distance; the stubs are what reads close.
    nac.add(cyl(t, 0.33, 0.30, 0.14, BRASS, [-0.44, 0, 0], { rotZ: Math.PI / 2, tex: 'metal', metal: 0.85, rough: 0.3, seg: 14 }));
    nac.add(cyl(t, 0.24, 0.30, 0.16, IRON, [0.44, 0, 0], { rotZ: Math.PI / 2, tex: 'metal', metal: 0.6, seg: 12 }));
    nac.add(box(t, [0.26, 0.30, 0.04], 0x3f382f, [0.30, 0.16, 0], { tex: 'metal', metal: 0.5, rough: 0.7 })); // radiator
    [0.16, -0.16].forEach((oz) =>
      nac.add(cyl(t, 0.035, 0.045, 0.26, 0x54483e, [0.05, 0.26, oz], { rotZ: 0.5, tex: 'metal', metal: 0.7, seg: 6 })),
    );
    nac.add(box(t, [0.18, 0.5, 0.12], IRON, [0.1, 0.42, 0], { tex: 'metal', metal: 0.6 })); // pylon to the hull
    nac.add(box(t, [0.05, 0.46, 0.05], BRASS, [-0.22, 0.40, 0], { rotZ: 0.28, tex: 'metal', metal: 0.8 })); // bracing strut
    // THE PROPELLER — its own group so it can actually spin
    const prop = new t.Group();
    prop.position.set(-0.55, 0, 0);
    prop.add(cyl(t, 0.09, 0.09, 0.16, BRASS, [0, 0, 0], { rotZ: Math.PI / 2, tex: 'metal', metal: 0.85, seg: 10 }));
    prop.add(cyl(t, 0.02, 0.085, 0.17, BRASS, [-0.16, 0, 0], { rotZ: Math.PI / 2, tex: 'metal', metal: 0.9, rough: 0.25, seg: 10 })); // spinner
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
export const GreatZeppelin = composable<Record<string, never>, LandmarkBuilt>(
  'GreatZeppelin',
  (t) => buildGreatZeppelin(t),
  {
    // REGISTER THE MASS. This header has always claimed the giant "registers a
    // footprint so guests and the OBB sweep route around it" and it did not:
    // `composable()` was called with no `compose` cfg, so nothing was declared
    // and guests walked straight THROUGH the hull / the mooring mast / the nest.
    // MEASURED 2026-07-28: of the five world giants only <Volcano> registered a
    // blocker (3 calls); these four registered none. The builder already returns
    // the `radius` guests are meant to walk around — it was simply never used.
    compose: (park, { built, position, rotation, scale }) => {
      void rotation;
      const [wx, , wz] = position;
      const un = park.registerBlocker({
        circle: { cx: wx, cz: wz, r: built.radius * scale },
        label: '<GreatZeppelin>',
        height: 3.4 * scale,
        kind: 'scenery',
      });
      return () => un();
    },
  },
);

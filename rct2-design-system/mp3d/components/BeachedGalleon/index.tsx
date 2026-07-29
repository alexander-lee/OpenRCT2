// ---------------------------------------------------------------------------
// BeachedGalleon — Tidewater Hollow's giant: a whole ship heeled over to port in the sand.
//
// ONE GIANT SET-PIECE PER WORLD. `fire` always had `<Volcano>` (r 2.75, h 2.55,
// a cone visible from the gate) and the other four worlds had nothing of that
// mass — their biggest pieces were props, so those lands read as a lawn with
// ornaments on it. This is `pirateBeach`'s answer, built to the same class.
//
// Deterministic (hashed jitter only), night-gated through `nightKOf(group)`,
// and it registers a footprint so guests and the OBB sweep route around it.
// Mount it with `<BeachedGalleon position={[x, z]} />`, or let
// `<WorldLandmark plan={W} />` pick it off the world's theme.
// ---------------------------------------------------------------------------

import * as THREE from 'three';
import { box, cyl } from '../Stage';
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

export function buildBeachedGalleon(t: typeof THREE): LandmarkBuilt {
  const g = new t.Group();
  const HULL = 0x6b4a30;
  const DARK = 0x46301e;
  const TRIM = 0x9a7448;
  const DECK = 0x8a6b45;
  const SAIL = 0xc9bfa6;
  const heel = 0.20;                 // she lies over to port

  // ---- the sand she is buried in -----------------------------------------
  g.add(cyl(t, 3.4, 4.0, 0.3, 0xc9b184, [0, 0.05, 0], { tex: 'sand', rough: 1, seg: 22 }));

  const hull = new t.Group();
  hull.rotation.z = heel;
  hull.position.y = 0.15;

  // ---- THE HULL — a lofted shell, curved in BOTH axes ---------------------
  // The first build stacked plain boxes, which read as a staircase. Each station
  // is now an ELLIPSOID slice: beam follows a fair curve fore-and-aft, and the
  // bilge is round because the slice is a scaled sphere, not a cube.
  const LEN = 6.2;
  const STATIONS = 15;
  for (let i = 0; i < STATIONS; i += 1) {
    const u = i / (STATIONS - 1);                 // 0 stern .. 1 bow
    // fair curve: full amidships, tapering to a narrow stern and a fine bow
    const beam = Math.pow(Math.sin(Math.PI * (0.10 + 0.86 * u)), 0.62);
    const w = 0.28 + 1.02 * beam;
    const dep = 0.5 + 0.72 * beam;
    const x = (u - 0.46) * LEN;
    // sheer: the deck line rises toward bow and stern
    const rise = 0.16 * (Math.pow(u - 0.5, 2) * 4);
    const sl = ball(t, 1, i % 3 === 0 ? DARK : HULL, [x, dep * 0.5 + rise, 0], { rough: 0.95, flat: true });
    sl.scale.set(LEN / STATIONS * 0.62, dep * 0.62, w * 0.62);
    hull.add(sl);
  }
  // planking strakes along the side — thin boxes following the sheer
  [-1, 1].forEach((sd) =>
    [0, 1, 2, 3, 4, 6, 7, 8].forEach((i) => {           // 5 is the TORN gap
      const u = i / 9;
      const beam = Math.pow(Math.sin(Math.PI * (0.10 + 0.86 * u)), 0.62);
      const rise = 0.16 * (Math.pow(u - 0.5, 2) * 4);
      hull.add(box(t, [LEN / 9 * 0.9, 0.13, 0.08], TRIM, [
        (u - 0.46) * LEN, 0.92 + 0.28 * beam + rise, sd * (0.2 + 0.62 * beam),
      ], { tex: 'wood', rough: 0.9 }));
    }),
  );
  // the DECK, what is left of it — planks over the after two thirds
  for (let k = 0; k < 7; k += 1)
    hull.add(box(t, [0.42, 0.06, 1.5 - k * 0.06], DECK, [-2.3 + k * 0.5, 1.12, 0], { tex: 'wood', rough: 0.95 }));
  // deck rail stanchions + cap rail on the high (starboard) side
  for (let k = 0; k < 8; k += 1) {
    const x = -2.5 + k * 0.52;
    hull.add(box(t, [0.06, 0.3, 0.06], TRIM, [x, 1.3, 0.62], { tex: 'wood' }));
  }
  hull.add(box(t, [4.2, 0.07, 0.1], TRIM, [-1.2, 1.46, 0.62], { tex: 'wood' }));

  // ---- the TORN side: broken frames standing in the gap -------------------
  [-0.75, -0.3, 0.15, 0.6].forEach((x, i) =>
    hull.add(cyl(t, 0.05, 0.075, 1.35 + (i % 2) * 0.25, DARK, [x, 0.78, 0.58], {
      rotX: 0.22 + i * 0.04, rotZ: 0.06, tex: 'wood', rough: 1, seg: 6,
    })),
  );
  // splintered plank ends round the hole
  [[-0.95, 1.15, 0.66], [0.85, 1.05, 0.64]].forEach(([px, py, pz], i) =>
    hull.add(box(t, [0.3, 0.09, 0.07], TRIM, [px, py, pz], { rotZ: i ? 0.4 : -0.35, tex: 'wood' })),
  );

  // ---- stem, bowsprit, sterncastle, rudder --------------------------------
  hull.add(box(t, [0.2, 2.0, 0.24], DARK, [2.85, 1.05, 0], { rotZ: -0.12, tex: 'wood' }));
  hull.add(cyl(t, 0.06, 0.09, 1.7, TRIM, [3.5, 1.95, 0], { rotZ: Math.PI / 2 - 0.32, tex: 'wood', seg: 8 }));
  hull.add(box(t, [1.05, 0.7, 1.15], HULL, [-2.55, 1.5, 0], { tex: 'wood', rough: 0.95 }));   // sterncastle
  hull.add(box(t, [0.5, 0.42, 0.06], 0x3a2c1c, [-2.9, 1.6, 0.58], { tex: 'wood' }));           // stern window
  hull.add(box(t, [0.12, 1.1, 0.5], DARK, [-3.1, 0.5, 0], { rotZ: 0.18, tex: 'wood' }));       // rudder

  g.add(hull);

  // ---- the mainmast, snapped two-thirds up --------------------------------
  const mast = new t.Group();
  mast.position.set(-0.3, 0.15, 0);
  mast.rotation.z = heel + 0.14;
  mast.add(cyl(t, 0.1, 0.17, 3.9, TRIM, [0, 2.9, 0], { tex: 'wood', seg: 10 }));
  mast.add(box(t, [0.1, 0.1, 2.7], DARK, [0, 3.9, 0], { tex: 'wood' }));                      // yard
  // a torn sail still bent to the yard
  mast.add(box(t, [0.04, 1.05, 2.3], SAIL, [0.02, 3.35, 0], { rough: 1 }));
  mast.add(box(t, [0.04, 0.5, 0.9], SAIL, [0.02, 2.7, -0.6], { rotX: 0.25, rough: 1 }));
  // shrouds down to the rail
  [-1, 1].forEach((sd) =>
    [0, 1, 2].forEach((k) =>
      mast.add(cyl(t, 0.015, 0.015, 3.1, 0x3a3630, [0.02, 1.9, sd * (0.2 + k * 0.16)], {
        rotX: sd * (0.16 + k * 0.05), seg: 4,
      })),
    ),
  );
  g.add(mast);

  // ---- the snapped topmast, half buried in the sand -----------------------
  g.add(cyl(t, 0.07, 0.1, 2.4, TRIM, [-2.7, 0.28, 1.7], { rotZ: Math.PI / 2, rotY: 0.55, tex: 'wood', seg: 8 }));
  g.add(box(t, [0.9, 0.05, 0.7], SAIL, [-3.3, 0.2, 2.05], { rotY: 0.5, rotX: 0.1, rough: 1 }));

  // ---- anchor + chain in the sand -----------------------------------------
  const anch = new t.Group();
  anch.position.set(2.6, 0.2, -1.9);
  anch.rotation.set(0.15, 0.7, 0.5);
  anch.add(cyl(t, 0.05, 0.05, 1.15, 0x4a4a4a, [0, 0, 0], { tex: 'metal', metal: 0.7, seg: 8 }));
  anch.add(box(t, [0.72, 0.07, 0.07], 0x4a4a4a, [0, 0.42, 0], { rotZ: Math.PI / 2, tex: 'metal', metal: 0.7 }));
  [-1, 1].forEach((sd) => anch.add(cyl(t, 0.05, 0.09, 0.42, 0x4a4a4a, [sd * 0.3, -0.5, 0], { rotZ: sd * 0.7, tex: 'metal', metal: 0.7, seg: 6 })));
  g.add(anch);
  [0, 1, 2, 3, 4].forEach((k) =>
    g.add(cyl(t, 0.045, 0.045, 0.16, 0x55504a, [2.35 - k * 0.16, 0.16, -1.55 + k * 0.2], {
      rotZ: Math.PI / 2, rotY: k * 0.9, tex: 'metal', metal: 0.6, seg: 6,
    })),
  );

  return { group: g, radius: 3.4 };
}

/** `<BeachedGalleon>` — pirateBeach's landmark. */
export const BeachedGalleon = composable('BeachedGalleon', (t) => buildBeachedGalleon(t));

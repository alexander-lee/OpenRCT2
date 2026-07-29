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
import { ball, box, cyl, mat, mergedBoxes } from '../Stage';
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

  // ---- THE HULL — ONE LOFTED SHELL, not a row of slices -------------------
  // Reported as "the boat looks like it's all the same disk", and that is
  // exactly what it was: 15 scaled SPHERES threaded on the centreline. Adjacent
  // slices differ by a few percent of beam, so the eye saw one disk repeated,
  // and because each was its own convex blob the silhouette was scalloped
  // instead of fair.
  //
  // A hull is a SURFACE, so this builds the surface: three fair curves (beam,
  // depth and sheer against the length) define a station, `sect()` walks one
  // station across the beam, and `loft()` triangulates the grid into a single
  // continuous shell. 25 stations × 19 points = one mesh, one draw call, and the
  // bilge/tuck/entry all come out of the curves rather than being faked.
  //
  // DoubleSide is deliberate: she is a BROKEN shell heeled over with a hole in
  // her side, so the inside of the far planking is part of the picture.
  const LEN = 6.4;
  const STA = 24;
  const HALF = 9;
  /** half-beam at u (0 stern … 1 bow): full amidships, fine at the entry */
  const beamAt = (u: number) => 0.09 + 1.14 * Math.pow(Math.sin(Math.PI * (0.05 + 0.92 * u)), 0.78);
  /** keel depth below the sheer */
  const depAt = (u: number) => 0.60 + 0.62 * Math.pow(Math.sin(Math.PI * (0.12 + 0.82 * u)), 0.5);
  /** the deck line — it RISES toward bow and stern, which is what makes a ship
   *  look like a ship rather than a barge */
  const sheerAt = (u: number) => 1.00 + 1.30 * Math.pow(Math.abs(u - 0.42), 2.1);
  /** a point on station u, w = −1 port … 0 keel … +1 starboard */
  const sect = (u: number, w: number) => {
    const b = beamAt(u);
    const d = depAt(u);
    const s = sheerAt(u);
    const aw = Math.abs(w);
    return new t.Vector3(
      (u - 0.46) * LEN,
      s - d * (1 - Math.pow(aw, 1.85)),      // flat-ish floor, hard turn of bilge
      b * Math.sign(w) * Math.pow(aw, 0.68), // full sections, not a V
    );
  };
  /** quads between consecutive rows of equal length → one BufferGeometry */
  const loft = (rows: THREE.Vector3[][]) => {
    const pos: number[] = [];
    const idx: number[] = [];
    const cols = rows[0].length;
    rows.forEach((r) => r.forEach((p) => pos.push(p.x, p.y, p.z)));
    for (let i = 0; i < rows.length - 1; i += 1)
      for (let j = 0; j < cols - 1; j += 1) {
        const a = i * cols + j;
        idx.push(a, a + cols, a + 1, a + 1, a + cols, a + cols + 1);
      }
    const geo = new t.BufferGeometry();
    geo.setAttribute('position', new t.Float32BufferAttribute(pos, 3));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    return geo;
  };
  const rows: THREE.Vector3[][] = [];
  for (let i = 0; i <= STA; i += 1) {
    const u = i / STA;
    const row: THREE.Vector3[] = [];
    for (let j = -HALF; j <= HALF; j += 1) row.push(sect(u, j / HALF));
    rows.push(row);
  }
  const plankMat = mat(t, HULL, { tex: 'wood', rough: 0.95, repeat: [6, 2] });
  plankMat.side = t.DoubleSide;
  const shell = new t.Mesh(loft(rows), plankMat);
  shell.castShadow = true;
  shell.receiveShadow = true;
  hull.add(shell);
  // TRANSOM: the stern is cut off square, so it needs a face. A fan from the
  // keel point closes the section the loft leaves open.
  {
    const r0 = rows[0];
    const pos: number[] = [];
    const idx: number[] = [];
    r0.forEach((p) => pos.push(p.x - 0.04, p.y, p.z));
    pos.push(r0[HALF].x - 0.04, sheerAt(0), 0); // apex at the deck centreline
    const apex = r0.length;
    for (let j = 0; j < r0.length - 1; j += 1) idx.push(j, j + 1, apex);
    const geo = new t.BufferGeometry();
    geo.setAttribute('position', new t.Float32BufferAttribute(pos, 3));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    const tr = new t.Mesh(geo, mat(t, DARK, { tex: 'wood', rough: 0.95 }));
    tr.material.side = t.DoubleSide;
    hull.add(tr);
  }

  // ---- oriented small parts, merged: wales, keel, frames, planks -----------
  // Every strake, frame and plank below is placed FROM ITS TWO ENDS (the
  // rotation that takes local +x onto b−a), so a part can follow a curve
  // instead of being axis-aligned — and they all land in three merged meshes.
  const XA = new t.Vector3(1, 0, 0);
  const dv = new t.Vector3();
  const mv = new t.Vector3();
  const qq = new t.Quaternion();
  const trimP: MergedBoxSpec[] = [];
  const darkP: MergedBoxSpec[] = [];
  const deckP: MergedBoxSpec[] = [];
  const strut = (
    a: THREE.Vector3, b: THREE.Vector3, th: number, tw: number, into: MergedBoxSpec[],
  ) => {
    dv.copy(b).sub(a);
    const len = dv.length();
    if (len < 1e-4) return;
    mv.copy(a).add(b).multiplyScalar(0.5);
    qq.setFromUnitVectors(XA, dv.normalize());
    const m = new t.Matrix4().makeRotationFromQuaternion(qq);
    m.setPosition(mv);
    into.push({ dims: [len, th, tw], matrix: m });
  };
  // THREE WALES per side, following the surface — the horizontal lines that give
  // a wooden hull its scale. The gap at u≈0.55 on the high side is the tear.
  [-1, 1].forEach((sd) => {
    [0.98, 0.80, 0.60].forEach((wv, k) => {
      for (let i = 0; i < STA; i += 1) {
        const u0 = i / STA;
        const u1 = (i + 1) / STA;
        if (sd > 0 && k === 0 && u0 > 0.50 && u0 < 0.66) continue;   // the torn gap
        strut(sect(u0, sd * wv), sect(u1, sd * wv), 0.075 - k * 0.012, 0.095, k === 0 ? trimP : darkP);
      }
    });
  });
  // the KEEL, and the stem it runs up into
  for (let i = 0; i < STA; i += 1)
    strut(sect(i / STA, 0), sect((i + 1) / STA, 0), 0.15, 0.16, darkP);
  // FRAMES standing proud of the planking on the torn side
  for (let i = 0; i < 5; i += 1) {
    const u = 0.49 + i * 0.045;
    strut(sect(u, 0.34), sect(u, 1.0), 0.075, 0.075, darkP);
    // and the broken rib ends above the sheer, snapped off at different heights
    const top = sect(u, 1.0);
    strut(top, new t.Vector3(top.x, top.y + 0.22 + h01(i * 5) * 0.3, top.z - 0.03), 0.07, 0.07, darkP);
  }
  // THE DECK — a lofted surface over the after two thirds, with plank seams
  {
    const drows: THREE.Vector3[][] = [];
    for (let i = 0; i <= 14; i += 1) {
      const u = 0.05 + (i / 14) * 0.62;
      const b = beamAt(u) * 0.97;
      const s = sheerAt(u);
      drows.push([new t.Vector3((u - 0.46) * LEN, s - 0.02, -b), new t.Vector3((u - 0.46) * LEN, s - 0.02, b)]);
    }
    const deck = new t.Mesh(loft(drows), mat(t, DECK, { tex: 'wood', rough: 0.95, repeat: [8, 3] }));
    deck.material.side = t.DoubleSide;
    deck.receiveShadow = true;
    hull.add(deck);
    // plank seams across the deck, and the two hatch coamings
    for (let i = 0; i < 13; i += 1) {
      const u = 0.07 + (i / 13) * 0.58;
      const b = beamAt(u) * 0.95;
      deckP.push({ dims: [0.05, 0.035, b * 2], pos: [(u - 0.46) * LEN, sheerAt(u) + 0.01, 0] });
    }
  }
  // BULWARKS: a low wall up from the deck edge, port and starboard, with a cap
  // rail. Also lofted, so it follows the sheer instead of being a straight box.
  [-1, 1].forEach((sd) => {
    const brows: THREE.Vector3[][] = [];
    for (let i = 0; i <= 16; i += 1) {
      const u = 0.04 + (i / 16) * 0.74;
      const p = sect(u, sd);
      brows.push([p.clone(), new t.Vector3(p.x, p.y + 0.30, p.z - sd * 0.02)]);
    }
    const bw = new t.Mesh(loft(brows), mat(t, HULL, { tex: 'wood', rough: 0.95, repeat: [8, 1] }));
    bw.material.side = t.DoubleSide;
    bw.castShadow = true;
    hull.add(bw);
    // cap rail along its top
    for (let i = 0; i < 16; i += 1) {
      const u0 = 0.04 + (i / 16) * 0.74;
      const u1 = 0.04 + ((i + 1) / 16) * 0.74;
      if (sd > 0 && u0 > 0.50 && u0 < 0.66) continue;    // gone at the tear
      const a = sect(u0, sd);
      const b2 = sect(u1, sd);
      strut(
        new t.Vector3(a.x, a.y + 0.31, a.z - sd * 0.02),
        new t.Vector3(b2.x, b2.y + 0.31, b2.z - sd * 0.02),
        0.075, 0.13, trimP,
      );
    }
  });
  // GUN PORTS — six dark squares down each side on the middle wale
  [-1, 1].forEach((sd) =>
    [0.20, 0.30, 0.40, 0.62, 0.72, 0.80].forEach((u) => {
      const p = sect(u, sd * 0.86);
      deckP.push({ dims: [0.19, 0.19, 0.06], pos: [p.x, p.y, p.z], rotY: sd > 0 ? 0 : Math.PI });
    }),
  );
  hull.add(mergedBoxes(t, trimP, TRIM, { tex: 'wood', rough: 0.9 }));
  hull.add(mergedBoxes(t, darkP, DARK, { tex: 'wood', rough: 1 }));
  hull.add(mergedBoxes(t, deckP, 0x3a2c1c, { tex: 'wood', rough: 1 }));

  // ---- stem, bowsprit, sterncastle, rudder --------------------------------
  // THE STEM: a raked cutwater that grows out of the planking, in three
  // shortening segments. One 1.9 u slab (the first attempt) read as a plank
  // nailed to the front and hid the whole bow.
  const bow = sect(1, 0);
  // (plain boxes, not merged parts — the merge above has already been built, and
  // three boxes is not worth a fourth batch)
  [0, 1, 2].forEach((i) =>
    hull.add(box(t, [0.20 - i * 0.03, 0.46, 0.24 - i * 0.05], DARK, [
      bow.x - 0.02 + i * 0.13, bow.y + 0.16 + i * 0.36, 0,
    ], { rotZ: -0.34, tex: 'wood', rough: 1 })),
  );
  // the bowsprit, springing FROM the stem head rather than hovering over it
  // The rotation matters and it is easy to get backwards: after `rotZ = θ` a
  // cylinder's axis points (−sinθ, cosθ, 0), so the FORWARD-AND-UP direction a
  // bowsprit needs is θ = −(π/2 − rake). The first attempt used +(π/2 − rake),
  // which aims it aft-and-down — and left the spar hanging in the air off the
  // bow with a visible gap.
  const RAKE = 0.37;
  const SPRIT = 1.8;
  const dirx = Math.cos(RAKE);
  const diry = Math.sin(RAKE);
  hull.add(cyl(t, 0.055, 0.095, SPRIT, TRIM, [
    bow.x + 0.30 + dirx * SPRIT * 0.5, bow.y + 0.98 + diry * SPRIT * 0.5, 0,
  ], { rotZ: -(Math.PI / 2 - RAKE), tex: 'wood', seg: 8 }));
  // a carved trailboard each side of the stem instead of a wheel-shaped scroll
  [-1, 1].forEach((sd) =>
    hull.add(box(t, [0.52, 0.10, 0.05], TRIM, [bow.x - 0.06, bow.y + 0.62, sd * 0.13], {
      rotZ: 0.42, rotY: sd * 0.22, tex: 'wood',
    })),
  );
  // STERNCASTLE — two tiers with a window band and a taffrail, not one block
  hull.add(box(t, [1.15, 0.60, 1.05], HULL, [-2.45, sheerAt(0) + 0.28, 0], { tex: 'wood', rough: 0.95, repeat: [3, 1] }));
  hull.add(box(t, [0.85, 0.44, 0.85], HULL, [-2.55, sheerAt(0) + 0.78, 0], { tex: 'wood', rough: 0.95 }));
  [-0.3, 0, 0.3].forEach((wz) =>
    hull.add(box(t, [0.05, 0.26, 0.20], 0x2a2016, [-3.02, sheerAt(0) + 0.32, wz], { rough: 0.6, emissive: 0x120c06 })),
  );
  hull.add(box(t, [0.95, 0.07, 1.1], TRIM, [-2.5, sheerAt(0) + 1.03, 0], { tex: 'wood' }));   // taffrail
  hull.add(box(t, [0.12, 1.2, 0.52], DARK, [-3.15, 0.45, 0], { rotZ: 0.18, tex: 'wood' }));   // rudder
  // capstan on the foredeck
  hull.add(cyl(t, 0.14, 0.18, 0.30, TRIM, [1.35, sheerAt(0.72) + 0.12, 0], { tex: 'wood', seg: 10 }));

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

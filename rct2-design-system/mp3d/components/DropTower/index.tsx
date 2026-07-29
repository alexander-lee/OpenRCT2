import React from 'react';
import * as THREE from 'three';
import { box, cyl, mat, mergedParts, mtx, nightKOf } from '../Stage';
import { buildPeep, SHIRTS, SKIN_TONES } from '../Guest';
import { createMotionGate, makeSeatWorld } from '../GameManager';
import { composableRide } from '../Park';

// ---------------------------------------------------------------------------
// DropTower — a REAL roto-drop tower (RCT2 GDROP1), not a pole with a lid.
//
// WHAT WAS WRONG. A tower is the most visible thing in a park from any
// distance, so it is also the easiest rig to fake: the old build was four
// vertical sticks with horizontal rungs and ONE diagonal pair on two of the
// four faces (a ladder, not a truss), a 6-sided cone for a "cap" that read as
// a party hat, and a gondola whose canopy was three stacked `cyl()` calls —
// and `cyl()` builds a SOLID DISC, so the r 0.84 "canopy lip" was a horizontal
// LID that covered the ten riders, the drum, the seats and the bulbs
// completely. From 9 u the whole rig read as a lamp post under a blue plate.
// There was no winch, no cable, no guide rail, no catch car, no brake, no pad.
//
// WHAT IT IS NOW, in the order it pays off against SKY (silhouette is the whole
// job for a tower):
//  1. A TRUSS. 12 bays, four tubular corner chords, a rung on ALL FOUR faces
//     at every bay line and a full X-brace on all four faces of every bay —
//     192 members, every one placed FROM ITS TWO ENDPOINTS, in one merged mesh.
//     Plus four RAKED outrigger legs with cross-bracing off the pad corners,
//     which is what gives a drop tower its flared stance.
//  2. GUIDE RAILS the car actually runs in (two proud rails up the +x/−x
//     faces), the fixed MAGNETIC BRAKE pairs gripping them at the bottom of
//     the drop, and the car's own guide shoes and brake fins.
//  3. A VISIBLE WINCH CROWN: a railed machine deck, two sheave wheels on a
//     shaft, the hoist motor, a lofted peaked roof (a SURFACE with sag, not a
//     cone) with a fascia at the eave, a finial and the aviation beacon.
//  4. TWO LIVE CABLES from the sheaves to the car, rescaled every frame so the
//     cable really pays out as the gondola climbs and goes slack on the drop.
//  5. A GONDOLA that reads as a gondola: a 10-panelled drum with gold
//     mouldings and cornices, a LOFTED canopy that sags between its ten ribs
//     over a warm inner ceiling, a scalloped valance, a bulb ring, and ten
//     seats with contoured shells, headrests, OVER-THE-SHOULDER restraints,
//     lap belts, footrests and frame arms back to the drum.
//  6. A PAD: tarmac, a hazard kerb, a railed fence with the boarding gap at
//     the local +z front, and the winch house behind.
//
// THE THREE TECHNIQUES (they did all the work — copy them):
//  * ENDPOINT PLACEMENT. `rotX/rotY/rotZ` cannot express an arbitrary
//    direction, which is exactly why the old mast was four parallel sticks.
//    `seg()` builds the quaternion taking +Y onto (b − a) and scales a shared
//    unit geometry to the run length. Every brace, rake, rail, restraint bar
//    and frame arm here is placed that way.
//  * REAL LOFTED SURFACES. The canopy, its ceiling, the valance and the crown
//    roof are indexed `BufferGeometry` lofts with real UVs and
//    `computeVertexNormals()`, not cones. A cone has no sag and no eave.
//  * CACHED-ENVMAP METAL. `metalness` with NO envMap is grey paint — three.js
//    feeds a metal's colour from its reflections, so a steel tower "painted
//    metal" with nothing to reflect reads as dull plastic. `steelEnv()` is one
//    cached 256x128 equirectangular canvas; `shiny()`/`gilt()` attach it.
//
// COST (measured, harness/mp3d-render/probe-tower-cost.mjs): 155 draws / 3,400
// tris before, 40 draws / 20,894 tris after — ~700 parts in 27 merged batches,
// far inside SETUP.md §13's "a single rig ≲ 300 draw calls". Real lights are
// unchanged at 2. Footprint is unchanged at 1.7 x 1.7 (the canopy eave lands
// exactly where the old lid's rim did, so the registered body blocker, the
// derived hut clearance and the queue front are all untouched).
// ---------------------------------------------------------------------------

/** local mirrors of Stage's batch specs (a second `import type` line from the
 *  same module tripped the design-system resolver) */
type PartSpec = { geo: THREE.BufferGeometry; matrix: THREE.Matrix4; uv?: [number, number] };
type V3 = [number, number, number];

/** deterministic 0..1 — hashed, never Math.random, so a remount is identical */
const h01 = (n: number) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

// ---------------------------------------------------------------------------
// THE ENVIRONMENT a tower's steel reflects. Drawn once, cached, and it is the
// difference between "galvanised steel" and "grey plastic": three.js takes a
// metal's colour ENTIRELY from its reflections, so `metal: 0.5` with no envMap
// is a flat grey fill. There is no scene-wide environment in this design
// system and a live CubeCamera is a whole extra render pass, so this is a
// 256x128 equirectangular CANVAS — a bright sky gradient (a tower is seen
// against sky, and sky is most of what it reflects), a horizon, sunlit ground,
// a sun blob and a haze band. The chords sweep across it as the camera orbits.
// ---------------------------------------------------------------------------
let _steelEnv: THREE.Texture | null = null;
function steelEnv(t: typeof THREE): THREE.Texture | null {
  if (_steelEnv) return _steelEnv;
  if (typeof document === 'undefined') return null; // SSR / node bundling
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 128;
  const x = c.getContext('2d');
  if (!x) return null;
  const sky = x.createLinearGradient(0, 0, 0, 68);
  sky.addColorStop(0, '#4d7fbb');
  sky.addColorStop(0.62, '#9dc0dd');
  sky.addColorStop(1, '#dfe8ec');
  x.fillStyle = sky;
  x.fillRect(0, 0, 256, 68);
  const gnd = x.createLinearGradient(0, 68, 0, 128);
  gnd.addColorStop(0, '#8d9a6a'); // sunlit park, not a dark lawn — a dark band
  gnd.addColorStop(1, '#4f5540'); // made every "metal" part read as paint again
  x.fillStyle = gnd;
  x.fillRect(0, 68, 256, 60);
  x.fillStyle = '#e6eef0';
  x.fillRect(0, 66, 256, 3);
  const sun = x.createRadialGradient(78, 22, 0, 78, 22, 20);
  sun.addColorStop(0, '#fffdf2');
  sun.addColorStop(1, 'rgba(255,253,242,0)');
  x.fillStyle = sun;
  x.fillRect(58, 2, 40, 40);
  const tex = new t.CanvasTexture(c);
  (tex as unknown as { mapping: number }).mapping = (t as unknown as { EquirectangularReflectionMapping: number }).EquirectangularReflectionMapping;
  (tex as unknown as { colorSpace: string }).colorSpace = (t as unknown as { SRGBColorSpace: string }).SRGBColorSpace;
  _steelEnv = tex;
  return tex;
}

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
  const t = three;
  const group = new t.Group();
  const withRiders = opts.riders ?? true; // decorative — off when registered so REAL guests take the ring seats
  const seats: THREE.Group[] = []; // one anchor per ring seat (seatWorld)
  let cycle0 = 0; // gated-clock value at the last departure (cycle phase zero)

  // ---- palette (RCT2 GDROP1: dark slate-teal drum, royal-blue seat backs,
  //      red canopy and kick plates, pale tower steel) -----------------------
  const TEAL = 0x2e4444; // gondola core drum (sprite #203030/#305050)
  const RED = 0xc23434; // canopy, kick ring, chord accents
  const BLUE = 0x2456b0; // seat backs / valance piping (sprite royal blue)
  const CUSHION = 0x1a3f8a;
  const LATTICE = 0xc9ccd2; // pale galvanised tower steel
  const STEEL = 0x3f454d; // dark machinery steel
  const GOLD = 0xd0ab3c;
  const STONE = 0x8a8f98;
  const CREAM = 0xdcd6c8;

  // ---- the dimension table: everything below is derived from these, so the
  //      stack cannot drift apart into coplanar seams --------------------------
  const R_PAD = 0.82; // tarmac pad (inside the 0.85 footprint half-extent)
  const Y_PAD = 0.13; // pad top
  const R_FENCE = 0.76;
  const Y_M0 = 0.10; // mast foot
  const Y_M1 = 5.30; // mast head (crown deck underside)
  const CS = 0.24; // mast half-width — CONSTANT, because the car rides it and
  //                  the gondola drum (r 0.44) has to swallow the chords:
  //                  corner distance 0.339 < 0.44. The flare that a tapering
  //                  mast would give comes from the raked outriggers instead.
  const BAYS = 12;
  const R_RAIL = CS + 0.075; // guide-rail face, proud of the chord line
  const Y_DECK = 5.30; // crown machine deck
  const Y_EAVE = 5.62; // crown roof eave
  const Y_APEX = 5.87;
  const Y_TIP = 6.0; // beacon
  // the gondola, in ITS OWN frame (y 0 = the seat-pan line)
  const R_DRUM = 0.44;
  const R_SEAT = 0.56; // seat ring — UNCHANGED, the seat anchors live on it
  const R_EAVE = 0.82; // canopy eave. The old build's widest part was a solid
  //                     r 0.84 disc at this height; the eave + its 0.03 fascia
  //                     land on 0.85, so the FOOTPRINT IS UNCHANGED at 1.7.
  const Y_CANOPY = 0.50; // canopy springing (eave) height
  const Y_CROWN = 0.86; // canopy apex
  const RIBS = 10; // canopy ribs = seats = canopy stripes = valance scallops
  const Y_LOW = 0.75; // parked gondola height
  const Y_HIGH = 4.65; // top of the climb

  // ---- shared unit geometries: one each, reused at hundreds of matrices and
  //      disposed at the end (mergedParts reads, never mutates, its sources) --
  const G_BOX = new t.BoxGeometry(1, 1, 1);
  const G_CYL = new t.CylinderGeometry(0.5, 0.5, 1, 8); // +Y run, diameter 1
  const G_CYLR = new t.CylinderGeometry(0.5, 0.5, 1, 14); // rounder: posts, rods
  const G_SPH = new t.SphereGeometry(0.5, 12, 8); // ellipsoid masses
  const G_CONE = new t.ConeGeometry(0.5, 1, 8);
  const G_TOR = new t.TorusGeometry(0.5, 0.14, 8, 16); // sheave wheels
  const G_BULB = new t.IcosahedronGeometry(0.038, 1);
  const SHARED = [G_BOX, G_CYL, G_CYLR, G_SPH, G_CONE, G_TOR, G_BULB];

  // ---- placement helpers ---------------------------------------------------
  const YA = new t.Vector3(0, 1, 0);
  const _d = new t.Vector3();
  const _mid = new t.Vector3();
  const _q = new t.Quaternion();
  /** a +Y unit geometry laid FROM a TO b with cross-section w x (w2 ?? w).
   *  THIS is what a truss needs: `rotX/rotY/rotZ` cannot express an arbitrary
   *  direction, and the old mast — four vertical sticks and a rung ladder — is
   *  what happens when you try. */
  const seg = (geo: THREE.BufferGeometry, a: V3, b: V3, w: number, into: PartSpec[], w2?: number) => {
    _d.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    const len = _d.length();
    if (len < 1e-5) return;
    _mid.set((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2);
    _q.setFromUnitVectors(YA, _d.normalize());
    into.push({ geo, matrix: new t.Matrix4().compose(_mid.clone(), _q.clone(), new t.Vector3(w, len, w2 ?? w)) });
  };
  /** a unit box scaled to full extents `dims` */
  const slab = (pos: V3, dims: V3, into: PartSpec[], rot: V3 = [0, 0, 0]) => into.push({ geo: G_BOX, matrix: mtx(t, pos, rot, dims) });
  /** an ellipsoid of FULL extents `dims` (G_SPH has diameter 1) */
  const blob = (pos: V3, dims: V3, into: PartSpec[], rot: V3 = [0, 0, 0]) => into.push({ geo: G_SPH, matrix: mtx(t, pos, rot, dims) });
  /** quads between consecutive rows -> ONE indexed geometry with real UVs.
   *  A curved surface has to BE a surface: a cone has no sag, no scallop and
   *  no eave, which is why the old canopy read as a plate. */
  const loft = (rows: THREE.Vector3[][], uvS: [number, number] = [1, 1]) => {
    const pos: number[] = [];
    const uv: number[] = [];
    const idx: number[] = [];
    const cols = rows[0].length;
    rows.forEach((r, i) =>
      r.forEach((p, j) => {
        pos.push(p.x, p.y, p.z);
        uv.push((j / (cols - 1)) * uvS[0], (i / (rows.length - 1)) * uvS[1]);
      }),
    );
    for (let i = 0; i < rows.length - 1; i += 1)
      for (let j = 0; j < cols - 1; j += 1) {
        const a = i * cols + j;
        idx.push(a, a + cols, a + 1, a + 1, a + cols, a + cols + 1);
      }
    const g = new t.BufferGeometry();
    g.setAttribute('position', new t.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new t.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  };
  /** ONE canvas panel between two ribs, as a real lofted surface: rows from
   *  the crown to the eave, SAGGING between the ribs (zero on a rib, zero at
   *  the eave and the apex). `pw < 1` makes the profile steep off the crown
   *  and flat at the rim, which is what a tensioned canvas does. */
  const panelLoft = (
    a0: number, a1: number, rTop: number, rBot: number, yTop: number, yBot: number,
    sag: number, rows = 5, cols = 5, pw = 0.72,
  ) => {
    const grid: THREE.Vector3[][] = [];
    for (let i = 0; i < rows; i += 1) {
      const u = i / (rows - 1);
      const r = rTop + (rBot - rTop) * Math.pow(u, pw);
      const yy = yTop + (yBot - yTop) * u;
      const row: THREE.Vector3[] = [];
      for (let j = 0; j < cols; j += 1) {
        const ph = j / (cols - 1);
        const a = a0 + (a1 - a0) * ph;
        const dip = sag * Math.sin(Math.PI * ph) * Math.sin(Math.PI * u);
        row.push(new t.Vector3(Math.cos(a) * r, yy - dip, Math.sin(a) * r));
      }
      grid.push(row);
    }
    return loft(grid);
  };
  /** A TRUE RING: an OPEN-ENDED cylinder wall. `cyl()` builds a SOLID DISC and
   *  a solid disc used as a band is a horizontal LID over everything inside it
   *  — which is literally what hid this gondola (an r 0.84 "canopy lip" disc
   *  0.04 thick, drawn straight across the ten riders). */
  const ringWall = (rTop: number, rBot: number, h: number, y: number, into: PartSpec[], sg = 40) =>
    into.push({ geo: new t.CylinderGeometry(rTop, rBot, h, sg, 1, true), matrix: mtx(t, [0, y, 0]) });
  /** the flat annulus that CAPS a ringWall (normals up) */
  const ringTop = (rIn: number, rOut: number, y: number, into: PartSpec[], sg = 40, down = false) =>
    into.push({ geo: new t.RingGeometry(rIn, rOut, sg), matrix: mtx(t, [0, y, 0], [down ? Math.PI / 2 : -Math.PI / 2, 0, 0]) });

  const env = steelEnv(t);
  /** a material that REFLECTS rather than glows — the only way a metal reads as
   *  metal (see the header note). Lofts get DoubleSide: a canopy is a sheet. */
  const shiny = (color: number, metal: number, rough: number, o: { tex?: 'metal' | 'plastic' | 'fabric' | 'concrete'; repeat?: [number, number]; two?: boolean } = {}) => {
    const m = mat(t, color, { metal, rough, tex: o.tex, repeat: o.repeat });
    if (env && metal > 0.05) {
      m.envMap = env;
      m.envMapIntensity = metal > 0.9 ? 1.3 : 0.95;
    }
    if (o.two) m.side = t.DoubleSide;
    return m;
  };
  /** attach the environment to a mesh built through the box/cyl/ball helpers */
  const gilt = <M extends THREE.Mesh>(m: M, i = 0.95) => {
    const mm = m.material as THREE.MeshStandardMaterial;
    if (env) {
      mm.envMap = env;
      mm.envMapIntensity = i;
    }
    return m;
  };

  // =========================================================================
  // 1. THE PAD — tarmac, hazard kerb, railed fence, winch house
  // =========================================================================
  {
    const pad: PartSpec[] = [];
    ringWall(R_PAD, R_PAD, Y_PAD, Y_PAD / 2, pad, 48);
    ringTop(0, R_PAD, Y_PAD, pad, 48);
    group.add(mergedParts(t, pad, mat(t, STONE, { tex: 'concrete', rough: 0.94 }), false));
    // hazard kerb: 24 alternating blocks round the rim, which reads as painted
    // kerbstones instead of one more grey ring
    const kA: PartSpec[] = [];
    const kB: PartSpec[] = [];
    for (let i = 0; i < 24; i += 1) {
      const a = (i / 24) * Math.PI * 2;
      const r = R_PAD - 0.02;
      slab([Math.cos(a) * r, Y_PAD + 0.015, Math.sin(a) * r], [0.115, 0.05, 0.075], i % 2 ? kA : kB, [0, -a, 0]);
    }
    group.add(mergedParts(t, kA, mat(t, 0xd8b040, { rough: 0.7 })));
    group.add(mergedParts(t, kB, mat(t, STEEL, { rough: 0.7 })));
    // fence: posts + top and mid rails, with the boarding GAP at the local +z
    // front (the queue arrives there, so the pad has to be open there)
    const fence: PartSpec[] = [];
    const N_F = 16;
    const open = (i: number) => {
      const a = ((i + 0.5) / N_F) * Math.PI * 2;
      return Math.cos(a - Math.PI / 2) > 0.72; // the +z quadrant stays open
    };
    for (let i = 0; i < N_F; i += 1) {
      const a = (i / N_F) * Math.PI * 2;
      const p: V3 = [Math.cos(a) * R_FENCE, Y_PAD, Math.sin(a) * R_FENCE];
      if (!open(i) || !open(i - 1)) seg(G_CYLR, p, [p[0], Y_PAD + 0.42, p[2]], 0.032, fence);
      if (open(i)) continue;
      const a1 = ((i + 1) / N_F) * Math.PI * 2;
      const q: V3 = [Math.cos(a1) * R_FENCE, Y_PAD, Math.sin(a1) * R_FENCE];
      [0.42, 0.24].forEach((h) => seg(G_BOX, [p[0], Y_PAD + h, p[2]], [q[0], Y_PAD + h, q[2]], 0.028, fence));
    }
    group.add(mergedParts(t, fence, shiny(STEEL, 0.55, 0.45)));
    // winch house behind the mast: walls, a louvred vent, a door, a pitched lid
    const house: PartSpec[] = [];
    slab([-0.4, Y_PAD + 0.17, -0.4], [0.42, 0.34, 0.34], house, [0, 0.78, 0]);
    slab([-0.4, Y_PAD + 0.36, -0.4], [0.47, 0.04, 0.39], house, [0, 0.78, 0]);
    for (let i = 0; i < 5; i += 1) slab([-0.4 + 0.115, Y_PAD + 0.1 + i * 0.05, -0.4 + 0.115], [0.2, 0.022, 0.01], house, [0, 0.78, 0]);
    group.add(mergedParts(t, house, mat(t, CREAM, { tex: 'metal', repeat: [3, 2], metal: 0.25, rough: 0.6 })));
    const houseTrim: PartSpec[] = [];
    slab([-0.4 - 0.1, Y_PAD + 0.15, -0.4 - 0.1], [0.14, 0.28, 0.012], houseTrim, [0, 0.78, 0]); // door
    group.add(mergedParts(t, houseTrim, mat(t, RED, { rough: 0.55 })));
  }

  // =========================================================================
  // 2. THE TRUSS — 12 bays, 4 chords, rungs on all four faces, a full X-brace
  //    on every face of every bay, and four RAKED outriggers off the pad
  // =========================================================================
  {
    const chords: PartSpec[] = [];
    const braces: PartSpec[] = [];
    const accents: PartSpec[] = [];
    const corner = (k: number, y: number, r: number): V3 => [k === 0 || k === 3 ? r : -r, y, k < 2 ? r : -r];
    for (let b = 0; b < BAYS; b += 1) {
      const yb = Y_M0 + ((Y_M1 - Y_M0) * b) / BAYS;
      const yt = Y_M0 + ((Y_M1 - Y_M0) * (b + 1)) / BAYS;
      for (let k = 0; k < 4; k += 1) {
        const k1 = (k + 1) % 4;
        seg(G_CYL, corner(k, yb, CS), corner(k, yt, CS), 0.072, chords); // chord
        seg(G_BOX, corner(k, yt, CS), corner(k1, yt, CS), 0.046, braces); // rung
        // the X: BOTH diagonals, on ALL FOUR faces. This is the single change
        // that turns a ladder into a truss in silhouette.
        seg(G_BOX, corner(k, yb, CS), corner(k1, yt, CS), 0.038, braces);
        seg(G_BOX, corner(k1, yb, CS), corner(k, yt, CS), 0.038, braces);
      }
      // a horizontal plan brace across the square every third bay + a red
      // marker band, so the truss has depth rather than being a flat grid
      if (b % 3 === 2) {
        seg(G_BOX, corner(0, yt, CS), corner(2, yt, CS), 0.034, braces);
        seg(G_BOX, corner(1, yt, CS), corner(3, yt, CS), 0.034, braces);
        for (let k = 0; k < 4; k += 1) seg(G_BOX, corner(k, yt + 0.02, CS + 0.012), corner((k + 1) % 4, yt + 0.02, CS + 0.012), 0.05, accents, 0.026);
      }
    }
    // base rung + gusset plates where the chords meet the pad
    for (let k = 0; k < 4; k += 1) {
      const k1 = (k + 1) % 4;
      seg(G_BOX, corner(k, Y_M0 + 0.06, CS), corner(k1, Y_M0 + 0.06, CS), 0.05, braces);
      const c = corner(k, Y_PAD + 0.05, CS);
      slab(c, [0.16, 0.1, 0.16], braces, [0, Math.PI / 4, 0]);
    }
    // FOUR RAKED OUTRIGGERS — the flared stance. Each runs from a pad corner up
    // to the mast at bay 3, with two cross-braces and a horizontal tie.
    const R_OUT = 0.6;
    for (let k = 0; k < 4; k += 1) {
      const a = Math.PI / 4 + (k * Math.PI) / 2;
      const foot: V3 = [Math.cos(a) * R_OUT, Y_PAD, Math.sin(a) * R_OUT];
      const head: V3 = [Math.cos(a) * CS * Math.SQRT2, 1.6, Math.sin(a) * CS * Math.SQRT2];
      seg(G_CYL, foot, head, 0.062, chords);
      const mid = (u: number): V3 => [foot[0] + (head[0] - foot[0]) * u, foot[1] + (head[1] - foot[1]) * u, foot[2] + (head[2] - foot[2]) * u];
      seg(G_BOX, mid(0.34), [Math.cos(a) * CS * Math.SQRT2, 0.62, Math.sin(a) * CS * Math.SQRT2], 0.036, braces);
      seg(G_BOX, mid(0.68), [Math.cos(a) * CS * Math.SQRT2, 1.1, Math.sin(a) * CS * Math.SQRT2], 0.036, braces);
      slab([foot[0], Y_PAD + 0.03, foot[2]], [0.17, 0.06, 0.17], braces, [0, -a, 0]);
    }
    group.add(mergedParts(t, chords, shiny(LATTICE, 0.55, 0.38, { tex: 'metal', repeat: [1, 3] })));
    group.add(mergedParts(t, braces, shiny(LATTICE, 0.5, 0.42)));
    group.add(mergedParts(t, accents, mat(t, RED, { rough: 0.55 })));
  }

  // =========================================================================
  // 3. GUIDE RAILS + the fixed magnetic brakes at the bottom of the drop
  // =========================================================================
  {
    const rails: PartSpec[] = [];
    const brakes: PartSpec[] = [];
    [1, -1].forEach((s) => {
      // the rail the car's shoes run in: a proud box section with a web
      slab([s * R_RAIL, (Y_M0 + Y_M1) / 2, 0], [0.05, Y_M1 - Y_M0, 0.15], rails);
      slab([s * (R_RAIL - 0.045), (Y_M0 + Y_M1) / 2, 0], [0.05, Y_M1 - Y_M0, 0.055], rails);
      // rail ties back onto the chords, every half-bay
      for (let y = Y_M0 + 0.2; y < Y_M1; y += 0.43) {
        seg(G_BOX, [s * (R_RAIL - 0.06), y, 0], [s * CS, y, CS], 0.03, rails);
        seg(G_BOX, [s * (R_RAIL - 0.06), y, 0], [s * CS, y, -CS], 0.03, rails);
      }
      // magnetic brake fin pairs, gripping the rail through the braking zone
      for (let i = 0; i < 4; i += 1) {
        const y = 0.95 + i * 0.3;
        [0.11, -0.11].forEach((dz) => slab([s * (R_RAIL + 0.02), y, dz], [0.12, 0.2, 0.05], brakes));
        slab([s * (R_RAIL + 0.07), y, 0], [0.05, 0.2, 0.27], brakes);
      }
    });
    group.add(mergedParts(t, rails, shiny(0xa8adb5, 0.85, 0.22)));
    group.add(mergedParts(t, brakes, mat(t, 0xb8481c, { metal: 0.3, rough: 0.6 })));
  }

  // =========================================================================
  // 4. THE WINCH CROWN — railed machine deck, sheaves, hoist, lofted roof,
  //    fascia, finial, beacon. A tower's top is the shape you read at 100 u;
  //    the old one was a 6-sided cone, i.e. a party hat.
  // =========================================================================
  const cableTop: V3[] = [];
  {
    const deck: PartSpec[] = [];
    ringWall(0.42, 0.46, 0.07, Y_DECK + 0.035, deck, 32);
    ringTop(0, 0.42, Y_DECK + 0.07, deck, 32);
    ringTop(0.42, 0.46, Y_DECK + 0.07, deck, 32);
    // deck brackets down onto the chord heads
    for (let k = 0; k < 4; k += 1) {
      const a = Math.PI / 4 + (k * Math.PI) / 2;
      seg(G_BOX, [Math.cos(a) * 0.44, Y_DECK + 0.02, Math.sin(a) * 0.44], [Math.cos(a) * CS * Math.SQRT2, Y_DECK - 0.22, Math.sin(a) * CS * Math.SQRT2], 0.04, deck);
    }
    group.add(mergedParts(t, deck, shiny(0x9ba2ab, 0.6, 0.4, { tex: 'metal', repeat: [6, 1] })));
    // deck railing: 10 stanchions + two rails
    const rail: PartSpec[] = [];
    for (let i = 0; i < 10; i += 1) {
      const a = (i / 10) * Math.PI * 2;
      const a1 = ((i + 1) / 10) * Math.PI * 2;
      const p: V3 = [Math.cos(a) * 0.42, Y_DECK + 0.07, Math.sin(a) * 0.42];
      seg(G_CYLR, p, [p[0], Y_DECK + 0.3, p[2]], 0.024, rail);
      const q: V3 = [Math.cos(a1) * 0.42, Y_DECK + 0.07, Math.sin(a1) * 0.42];
      [0.3, 0.17].forEach((h) => seg(G_BOX, [p[0], Y_DECK + h, p[2]], [q[0], Y_DECK + h, q[2]], 0.02, rail));
    }
    group.add(mergedParts(t, rail, shiny(GOLD, 0.85, 0.3)));
    // the HOIST: a shaft across the deck carrying two sheave wheels, plus the
    // motor and gearbox. This is the part that says "the car hangs on a cable".
    const gear: PartSpec[] = [];
    seg(G_CYLR, [-0.3, Y_DECK + 0.34, 0], [0.3, Y_DECK + 0.34, 0], 0.05, gear);
    [0.15, -0.15].forEach((sx) => {
      gear.push({ geo: G_TOR, matrix: mtx(t, [sx, Y_DECK + 0.34, 0], [0, Math.PI / 2, 0], [0.3, 0.3, 0.3]) });
      cableTop.push([sx, Y_DECK + 0.34, 0]);
    });
    slab([0, Y_DECK + 0.2, -0.24], [0.3, 0.24, 0.18], gear); // motor
    slab([0, Y_DECK + 0.2, 0.24], [0.24, 0.2, 0.16], gear); // gearbox
    [-1, 1].forEach((s) => seg(G_BOX, [s * 0.3, Y_DECK + 0.34, 0], [s * 0.3, Y_DECK + 0.08, 0], 0.05, gear)); // bearing pedestals
    group.add(mergedParts(t, gear, shiny(STEEL, 0.7, 0.35)));
    // the ROOF: 8 lofted panels with sag, alternating cream/red, over a warm
    // ceiling, closed by a fascia ring at the eave. Not a cone.
    const rA: PartSpec[] = [];
    const rB: PartSpec[] = [];
    for (let i = 0; i < 8; i += 1) {
      const a0 = (i / 8) * Math.PI * 2;
      const a1 = ((i + 1) / 8) * Math.PI * 2;
      (i % 2 ? rA : rB).push({ geo: panelLoft(a0, a1, 0.05, 0.46, Y_APEX, Y_EAVE, 0.022, 4, 5), matrix: new t.Matrix4() });
    }
    const roofA = mergedParts(t, rA, shiny(RED, 0, 0.6, { two: true }));
    const roofB = mergedParts(t, rB, shiny(CREAM, 0, 0.62, { two: true }));
    roofA.castShadow = false;
    roofB.castShadow = false;
    group.add(roofA, roofB);
    const fascia: PartSpec[] = [];
    ringWall(0.47, 0.47, 0.05, Y_EAVE - 0.02, fascia, 32);
    group.add(mergedParts(t, fascia, mat(t, RED, { rough: 0.55 })));
    // finial rod + the aviation beacon (kept as its own mesh: its material is
    // mutated every frame by the night gate, so it must not be merged)
    group.add(gilt(cyl(t, 0.018, 0.026, Y_TIP - Y_APEX + 0.06, GOLD, [0, (Y_APEX + Y_TIP) / 2, 0], { metal: 0.85, rough: 0.3, seg: 8 })));
  }
  const beaconMat = new t.MeshStandardMaterial({ color: 0xff5544, emissive: 0xff2222, emissiveIntensity: 0.15, roughness: 0.4 });
  const beacon = new t.Mesh(new t.SphereGeometry(0.062, 10, 8), beaconMat);
  beacon.position.set(0, Y_TIP, 0);
  group.add(beacon);
  const beaconLight = new t.PointLight(0xff3333, 0, 4, 2);
  beaconLight.position.set(0, Y_TIP + 0.07, 0);
  group.add(beaconLight);

  // =========================================================================
  // 5. THE GONDOLA — a panelled drum, a LOFTED canopy that sags between its
  //    ribs over a lit ceiling, a valance, a bulb ring and ten real seats
  // =========================================================================
  const gondola = new t.Group();
  group.add(gondola);
  const vehicle: THREE.Object3D = gondola;
  const STEP = (Math.PI * 2) / RIBS;
  {
    // --- the drum: 10 flat panels between vertical mouldings, closed by a
    //     cornice top and bottom. A plain cylinder reads as a bucket.
    const drum: PartSpec[] = [];
    const trim: PartSpec[] = [];
    const chord = 2 * R_DRUM * Math.tan(STEP / 2) - 0.03;
    for (let i = 0; i < RIBS; i += 1) {
      const a = i * STEP;
      slab([Math.cos(a) * R_DRUM, 0.16, Math.sin(a) * R_DRUM], [chord, 0.5, 0.05], drum, [0, -a, 0]);
      const am = a + STEP / 2;
      slab([Math.cos(am) * (R_DRUM + 0.012), 0.16, Math.sin(am) * (R_DRUM + 0.012)], [0.05, 0.5, 0.05], trim, [0, -am, 0]);
    }
    ringWall(R_DRUM + 0.03, R_DRUM + 0.03, 0.05, 0.42, trim, 30); // top cornice
    ringWall(R_DRUM + 0.03, R_DRUM + 0.03, 0.05, -0.1, trim, 30); // bottom cornice
    ringTop(0, R_DRUM, 0.44, trim, 30); // the drum's own lid (a real one, up top)
    group.userData.dropTowerDrumParts = drum.length; // (kept: read by the geometry probe)
    gondola.add(mergedParts(t, drum, mat(t, TEAL, { tex: 'plastic', repeat: [2, 2], metal: 0.2, rough: 0.55 })));
    gondola.add(mergedParts(t, trim, shiny(GOLD, 0.85, 0.3)));
    // --- the kick ring under the seats (a RING, not a disc)
    const kick: PartSpec[] = [];
    ringWall(0.7, 0.62, 0.1, -0.17, kick, 34);
    ringTop(0.44, 0.7, -0.12, kick, 34);
    const kickMesh = mergedParts(t, kick, mat(t, RED, { rough: 0.55 }));
    gondola.add(kickMesh);
    // --- the CANOPY: 10 lofted stripes sagging 0.03 between the ribs, a warm
    //     inner ceiling 0.05 under it so the inside of the top is a lit canvas
    //     rather than a black cone, a fascia at the eave and a scalloped
    //     valance with tassels.
    const cA: PartSpec[] = [];
    const cB: PartSpec[] = [];
    for (let i = 0; i < RIBS; i += 1) {
      const a0 = i * STEP;
      const a1 = (i + 1) * STEP;
      (i % 2 ? cA : cB).push({ geo: panelLoft(a0, a1, 0.1, R_EAVE, Y_CROWN, Y_CANOPY, 0.03, 5, 6), matrix: new t.Matrix4() });
    }
    const canA = mergedParts(t, cA, shiny(RED, 0, 0.58, { two: true }));
    const canB = mergedParts(t, cB, shiny(CREAM, 0, 0.6, { two: true }));
    canA.castShadow = false; // the sun has to reach the riders under it
    canB.castShadow = false;
    gondola.add(canA, canB);
    const ceil: PartSpec[] = [];
    for (let i = 0; i < RIBS; i += 1)
      ceil.push({ geo: panelLoft(i * STEP, (i + 1) * STEP, 0.1, R_EAVE - 0.02, Y_CROWN - 0.05, Y_CANOPY - 0.045, 0.03, 4, 5), matrix: new t.Matrix4() });
    const ceilMat = mat(t, 0xf3e2bc, { rough: 0.85 });
    ceilMat.side = t.DoubleSide;
    ceilMat.emissive = new t.Color(0xffc97a);
    ceilMat.emissiveIntensity = 0;
    const ceiling = mergedParts(t, ceil, ceilMat);
    ceiling.castShadow = false;
    gondola.add(ceiling);
    // ribs: each in 4 endpoint-placed pieces so it FOLLOWS the canvas curve
    const ribs: PartSpec[] = [];
    const ribPt = (a: number, u: number): V3 => {
      const r = 0.1 + (R_EAVE - 0.1) * Math.pow(u, 0.72);
      return [Math.cos(a) * r, Y_CROWN + (Y_CANOPY - Y_CROWN) * u + 0.012, Math.sin(a) * r];
    };
    for (let i = 0; i < RIBS; i += 1) {
      const a = i * STEP;
      for (let k = 0; k < 4; k += 1) seg(G_BOX, ribPt(a, k / 4), ribPt(a, (k + 1) / 4), 0.026, ribs, 0.018);
    }
    gondola.add(mergedParts(t, ribs, shiny(GOLD, 0.85, 0.3)));
    const fascia: PartSpec[] = [];
    ringWall(R_EAVE + 0.03, R_EAVE + 0.03, 0.05, Y_CANOPY - 0.02, fascia, 40);
    gondola.add(mergedParts(t, fascia, mat(t, BLUE, { rough: 0.5 })));
    // valance: a scalloped hanging skirt, lofted, with a tassel on each point
    const val: PartSpec[] = [];
    for (let i = 0; i < RIBS; i += 1) {
      const a0 = i * STEP;
      const a1 = (i + 1) * STEP;
      const rows: THREE.Vector3[][] = [];
      for (let r = 0; r < 3; r += 1) {
        const u = r / 2;
        const row: THREE.Vector3[] = [];
        for (let j = 0; j <= 5; j += 1) {
          const ph = j / 5;
          const a = a0 + (a1 - a0) * ph;
          const drop = 0.12 * u * Math.sin(Math.PI * ph) ** 0.6;
          row.push(new t.Vector3(Math.cos(a) * (R_EAVE + 0.02), Y_CANOPY - 0.02 - drop, Math.sin(a) * (R_EAVE + 0.02)));
        }
        rows.push(row);
      }
      val.push({ geo: loft(rows), matrix: new t.Matrix4() });
    }
    const valMat = shiny(CREAM, 0, 0.75, { two: true });
    const valance = mergedParts(t, val, valMat);
    valance.castShadow = false;
    gondola.add(valance);
    const tass: PartSpec[] = [];
    for (let i = 0; i < RIBS; i += 1) {
      const a = (i + 0.5) * STEP;
      tass.push({ geo: G_CONE, matrix: mtx(t, [Math.cos(a) * (R_EAVE + 0.02), Y_CANOPY - 0.185, Math.sin(a) * (R_EAVE + 0.02)], [Math.PI, 0, 0], [0.05, 0.09, 0.05]) });
    }
    gondola.add(mergedParts(t, tass, shiny(GOLD, 0.8, 0.35)));
    // --- the bulb ring under the eave: ONE merged emissive mesh (never lights)
    const bulbs: PartSpec[] = [];
    for (let i = 0; i < 20; i += 1) {
      const a = (i / 20) * Math.PI * 2;
      bulbs.push({ geo: G_BULB, matrix: mtx(t, [Math.cos(a) * (R_EAVE - 0.02), Y_CANOPY - 0.05, Math.sin(a) * (R_EAVE - 0.02)]) });
    }
    const bulbMat = new t.MeshStandardMaterial({ color: 0xfff3c0, emissive: 0xffcc55, emissiveIntensity: 0.15, roughness: 0.35 });
    const bulbMesh = mergedParts(t, bulbs, bulbMat, false);
    bulbMesh.castShadow = false;
    gondola.add(bulbMesh);
    const cabinLight = new t.PointLight(0xffc97a, 0, 3.2, 2);
    cabinLight.position.set(0, 0.3, 0);
    gondola.add(cabinLight);

    // --- the CATCH CAR: the frame that rides the guide rails, its shoes, its
    //     brake fins and the cable eyes. It is what the cables attach to.
    const frame: PartSpec[] = [];
    [1, -1].forEach((s) => {
      slab([s * 0.3, 0.5, 0], [0.16, 0.14, 0.3], frame); // shoe housing
      [0.11, -0.11].forEach((dz) => slab([s * (R_RAIL + 0.02), 0.5, dz], [0.1, 0.16, 0.045], frame)); // shoes on the rail
      slab([s * 0.42, 0.5, 0], [0.2, 0.1, 0.1], frame); // arm out to the rail
      slab([s * (R_RAIL + 0.02), 0.28, 0], [0.05, 0.28, 0.24], frame); // BRAKE FIN
      seg(G_BOX, [s * 0.16, 0.44, 0], [s * 0.3, 0.5, 0], 0.06, frame); // yoke
    });
    gondola.add(mergedParts(t, frame, shiny(STEEL, 0.75, 0.3)));

    // --- TEN SEATS. Each has a contoured shell, a headrest, a cushion, an
    //     OVER-THE-SHOULDER restraint whose bars are placed from their
    //     endpoints so they curve over the shoulder onto a chest pad, a lap
    //     belt, a footrest and two frame arms back to the drum.
    const shell: PartSpec[] = [];
    const cush: PartSpec[] = [];
    const harn: PartSpec[] = [];
    const frameArms: PartSpec[] = [];
    for (let i = 0; i < RIBS; i += 1) {
      const a = i * STEP;
      // one local frame per seat: local +z is radially OUT (matching the old
      // build exactly, so the anchors and therefore every real rider land in
      // the same place)
      const M = (p: V3, dims: V3, rot: V3 = [0, 0, 0]) =>
        new t.Matrix4()
          .compose(new t.Vector3(Math.cos(a) * R_SEAT, 0, Math.sin(a) * R_SEAT), new t.Quaternion().setFromEuler(new t.Euler(0, Math.PI / 2 - a, 0)), new t.Vector3(1, 1, 1))
          .multiply(mtx(t, p, rot, dims));
      // seat pan + back shell + wings + headrest
      shell.push({ geo: G_BOX, matrix: M([0, -0.01, -0.03], [0.3, 0.07, 0.3]) });
      shell.push({ geo: G_SPH, matrix: M([0, 0.19, -0.12], [0.3, 0.42, 0.12]) });
      [-0.13, 0.13].forEach((dx) => shell.push({ geo: G_BOX, matrix: M([dx, 0.16, -0.05], [0.04, 0.3, 0.16]) }));
      shell.push({ geo: G_SPH, matrix: M([0, 0.42, -0.1], [0.17, 0.12, 0.09]) });
      cush.push({ geo: G_BOX, matrix: M([0, 0.18, -0.065], [0.22, 0.28, 0.03]) });
      cush.push({ geo: G_BOX, matrix: M([0, 0.035, -0.03], [0.22, 0.03, 0.22]) });
      // OTS restraint: two bars from behind the shoulders, over them, down to
      // a chest pad — three endpoint-placed runs each, so they CURVE
      [-0.075, 0.075].forEach((dx) => {
        const pts: V3[] = [[dx, 0.3, -0.1], [dx, 0.37, -0.03], [dx, 0.3, 0.07], [dx, 0.14, 0.09]];
        for (let k = 0; k < pts.length - 1; k += 1) {
          _d.set(pts[k + 1][0] - pts[k][0], pts[k + 1][1] - pts[k][1], pts[k + 1][2] - pts[k][2]);
          const len = _d.length();
          _q.setFromUnitVectors(YA, _d.clone().normalize());
          harn.push({
            geo: G_CYLR,
            matrix: M([0, 0, 0]).multiply(
              new t.Matrix4().compose(
                new t.Vector3((pts[k][0] + pts[k + 1][0]) / 2, (pts[k][1] + pts[k + 1][1]) / 2, (pts[k][2] + pts[k + 1][2]) / 2),
                _q.clone(),
                new t.Vector3(0.036, len, 0.036),
              ),
            ),
          });
        }
      });
      harn.push({ geo: G_BOX, matrix: M([0, 0.13, 0.1], [0.19, 0.13, 0.045]) }); // chest pad
      harn.push({ geo: G_BOX, matrix: M([0, -0.02, 0.1], [0.24, 0.04, 0.04]) }); // lap belt bar
      harn.push({ geo: G_BOX, matrix: M([0, -0.15, 0.05], [0.24, 0.035, 0.05]) }); // footrest
      // frame arms from the seat back into the drum, and the hanger above
      frameArms.push({ geo: G_BOX, matrix: M([-0.1, 0.1, -0.19], [0.05, 0.05, 0.18]) });
      frameArms.push({ geo: G_BOX, matrix: M([0.1, 0.1, -0.19], [0.05, 0.05, 0.18]) });
      // the seat ANCHOR — real GameManager guests land here via seatWorld. Same
      // local offset the old build used, on the same R_SEAT ring, so no rider
      // moves: hips on the pan, back against the shell.
      const anchor = new t.Group();
      anchor.position.set(Math.cos(a) * R_SEAT, 0, Math.sin(a) * R_SEAT);
      anchor.rotation.y = Math.PI / 2 - a;
      const inner = new t.Group();
      inner.position.set(0, -0.12, -0.03);
      anchor.add(inner);
      gondola.add(anchor);
      seats.push(inner);
      if (withRiders) {
        const p = buildPeep(t, {
          skin: SKIN_TONES[i % SKIN_TONES.length],
          shirt: SHIRTS[i % SHIRTS.length],
          seated: true,
          expression: 'surprised',
          female: h01(i * 3.7) > 0.5,
        });
        p.group.scale.setScalar(0.34);
        inner.add(p.group);
      }
    }
    gondola.add(mergedParts(t, shell, mat(t, BLUE, { tex: 'plastic', repeat: [2, 2], rough: 0.5 })));
    gondola.add(mergedParts(t, cush, mat(t, CUSHION, { tex: 'fabric', repeat: [2, 2], rough: 0.95 })));
    gondola.add(mergedParts(t, harn, shiny(0x6d747d, 0.6, 0.4)));
    gondola.add(mergedParts(t, frameArms, shiny(STEEL, 0.7, 0.35)));
    void kickMesh;
    void ceilMat;

    // --- THE CABLES. Two, from the sheaves down to the catch car, rescaled
    //     every frame: the cable really pays out as the gondola climbs.
    const cableMat = shiny(0x6b7076, 0.9, 0.25);
    const cables = cableTop.map(([cx, cy, cz]) => {
      const m = new t.Mesh(new t.CylinderGeometry(0.014, 0.014, 1, 6), cableMat);
      m.position.set(cx, cy, cz);
      m.castShadow = false;
      group.add(m);
      return { mesh: m, top: cy };
    });

    SHARED.forEach((g) => g.dispose());

    // =======================================================================
    // 6. THE CYCLE — unchanged timing (slow climb, fast drop, spin), plus the
    //    cable payout and the night gate.
    // =======================================================================
    const raw = (time: number, motionK = 1) => {
      const nk = nightKOf(group);
      const ease = nk * nk * (3 - 2 * nk); // smoothstep
      const pulse = 0.5 + 0.5 * Math.sin(time * 3.2);
      beaconMat.emissiveIntensity = 0.15 + (0.4 + 1.4 * pulse - 0.15) * ease;
      beaconLight.intensity = ease * (0.25 + 0.9 * pulse);
      bulbMat.emissiveIntensity = 0.15 + (1.2 - 0.15) * ease;
      ceilMat.emissiveIntensity = ease * 0.55;
      cabinLight.intensity = ease * 0.9;
      const cyc = ((time - cycle0) * 0.3) % 1; // each departure restarts the climb
      const h = (cyc < 0.8 ? cyc / 0.8 : 1 - (cyc - 0.8) / 0.2) * motionK; // slow climb, fast drop
      gondola.position.y = Y_LOW + h * (Y_HIGH - Y_LOW);
      gondola.rotation.y = time * (cyc < 0.8 ? 0.8 : 2.2); // spins, faster on the drop
      // cable payout: the run from the sheave to the catch-car yoke
      const carY = gondola.position.y + 0.5;
      for (const c of cables) {
        const len = Math.max(0.02, c.top - carY);
        c.mesh.scale.y = len;
        c.mesh.position.y = (c.top + carY) / 2;
      }
    };
    // station gate: gondola parked at the base while guests board/unload
    // (spinDown 0.9 — down before 'unloadingPassengers'), climb restarts from
    // zero on every departure
    const gate = createMotionGate(raw, { spinDown: 0.9 });
    const onStateChange = (state: string) => {
      gate.onStateChange(state);
      if (state === 'departing') cycle0 = gate.clock();
    };
    raw(0, 0); // seat the rest pose before the first frame
    return { group, update: gate.update, vehicle, seatWorld: makeSeatWorld(three, seats), onStateChange };
  }
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

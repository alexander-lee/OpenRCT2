import React from 'react';
import * as THREE from 'three';
import { cyl, mat, mergedParts, mtx, nightKOf } from '../Stage';
import { buildPeep, SHIRTS, SKIN_TONES } from '../Guest';
import { RideColourScheme } from '../ColorKit';
import { buildEmitter } from '../ParticleKit';
import { createMotionGate, makeSeatWorld } from '../GameManager';
import { composableRide } from '../Park';

// ---------------------------------------------------------------------------
// LaunchedFreefall — a real air-launched space-shot tower (RCT2 Launched
// Freefall): a 4-seat ring car blasts up the mast on compressed air, floats
// weightless at the apex and glides back down.
//
// WHAT WAS WRONG. This was the best of the three towers and still had the
// fleet-wide defect — every shape made from the cheapest primitive that would
// stand in for it:
//  * the mast got its diagonals on only TWO of its four faces, so from the
//    other two it was a rung ladder, and nothing braced the square in plan.
//  * the head was a 6-segment `cyl(0, 0.52, …)` — a grey PARTY HAT with a red
//    brim — over a plain drum. No machine deck, no sheaves, no air receiver.
//  * the "safety railing" was 11 sticks with straight boxes between them, the
//    air plant was three plain tubes with a ball on top, and the compressor was
//    one grey box.
//  * the car was a box collar plus a SOLID 1.14 under-plate and a solid top
//    plate — and the mast passes through the middle of the car, so both plates
//    were sawing straight through the tower on every launch. Its seats were
//    five boxes each.
//
// WHAT IT IS NOW:
//  1. A TRUSS: 11 bays, four tubular chords, a rung on ALL FOUR faces at every
//     bay line, a full X-brace on all four faces of every bay, plan bracing
//     every third bay, painted marker collars and gusseted feet — ~220 members,
//     every one placed FROM ITS TWO ENDPOINTS, in three merged meshes.
//  2. THE LAUNCH PLANT, which is what makes this ride this ride: three tanks
//     with DISHED heads on saddle legs, valve heads with handwheels, pressure
//     bands, a manifold running elbow-by-elbow into the tower, a compressor
//     skid with a louvred grille and cooling fins, a gauge board — and the big
//     vertical LAUNCH CYLINDER up the middle of the mast with its own pipework.
//  3. GUIDE RAILS the car runs on, its guide shoes, and the fin brakes.
//  4. A HEAD ASSEMBLY: a railed machine deck, the air receiver across it,
//     sheaves, the lofted sheet-metal roof, a finial and the aviation beacon.
//  5. A CAR that reads as a vehicle: an open collar frame with a HOLE for the
//     mast, nose fairings, four moulded seat pods with contoured shells,
//     headrests, cushions, OVER-THE-SHOULDER restraints placed from their
//     endpoints so they curve over the shoulder onto a chest pad, lap bars,
//     footrests and grab handles.
//  6. A PAD: tarmac with a hazard kerb, a striped launch pad under the car, a
//     railed fence with the boarding gap at the local +z front, and a boarding
//     step.
//
// THE THREE TECHNIQUES: endpoint placement (`seg` — `rotX/rotY/rotZ` cannot
// express an arbitrary direction, which is why two faces of the old mast had no
// diagonals), real lofted surfaces (`loft`/`panelLoft` — a cone has no sag and
// no eave), and cached-envMap metal (`steelEnv`/`shiny` — `metalness` with no
// envMap is grey paint, which is why the old tanks and mast read as plastic).
//
// THE CLEARANCE RULE. The car ENCIRCLES the mast, so R_SHAFT: nothing bolted to
// the tower inside the travel band may exceed 0.50 from the axis (chord corners
// 0.424, marker collars 0.474, guide rails 0.375, launch cylinder 0.125), and the
// car's own collar frame clears 0.51. The old solid plates ignored this
// completely.
//
// COST (harness/mp3d-render/probe-tower-cost.mjs): 167 draws / 5,736 tris before
// → 33 draws / 19,008 tris after; ~750 parts in 30 merged batches, far inside
// SETUP.md §13's "a single rig ≲ 300 draw calls" — a 5x cut for a park that
// mounts it. Real lights unchanged at 3. The footprint is 3.45 x 2.80 against
// the old 3.456 x 2.828: the compressor skid is still the widest thing at x 2.0
// and the fence now closes at 1.40 (its stanchion base plates stick out another
// 0.05), so the registered body blocker, the derived hut clearance and the queue
// front are all untouched.
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
// THE ENVIRONMENT THE STEEL REFLECTS — drawn once, cached. three.js takes a
// metal's colour ENTIRELY from its reflections, so `metal: 0.55` with no envMap
// (which is what every tank, rail and chord here used to be) is a flat grey
// fill. One 256x128 equirectangular canvas: sky gradient, horizon, sunlit
// ground, sun blob.
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
  gnd.addColorStop(0, '#8d9a6a');
  gnd.addColorStop(1, '#4f5540');
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
  const t = three;
  const group = new t.Group();
  const scheme = opts.scheme;
  const withRiders = opts.riders ?? true; // decorative — off when registered so REAL guests take the ring car
  const anchors: THREE.Group[] = []; // one anchor per ring-car seat (seatWorld)
  let cycle0 = 0; // gated-clock value at the last departure (cycle phase zero)

  // ---- palette (scheme-overridable, exactly as before) --------------------
  const LATTICE = scheme?.track.supports ?? 0xc9ccd2; // pale tower steel
  const ACCENT = scheme?.track.main ?? 0xb03428; // red chords + trim
  const CAR = scheme?.vehicles[0]?.body ?? 0xc23434; // ring-car body
  const SEATC = 0x1a3f8a; // royal-blue cushions
  const STEEL = 0x3a3f47;
  const RAILSTEEL = 0x7d858f;
  const TANK = 0x87909b; // air-vessel steel. Kept DARKER and less metallic than
  //                        the mast: at metal 0.7 against this bright sky envMap
  //                        the tanks washed out to pale frosted bottles.
  const STONE = 0x8a8f98;
  const GOLD = 0xd8b040;

  // ---- THE DIMENSION TABLE -------------------------------------------------
  const R_PAD = 1.15;
  const Y_PAD = 0.35;
  const R_KERB = 1.18;
  const R_FENCE = 1.4; // the fence ring. Its stanchion BASE PLATES stick out
  //                      0.05 further, and 1.45 + 0.05 pushed the registered
  //                      footprint from 3.456 to 3.54 — measured, then fixed.
  const Y_M0 = 0.3;
  const Y_M1 = 5.5; // chord heads
  const CS = 0.3; // mast half-width (corner 0.424) — the car encircles it
  const BAYS = 11;
  const R_RAIL = CS + 0.07;
  const R_SHAFT = 0.5; // nothing fixed to the mast may exceed this in the travel
  //                     band; the car's collar frame clears 0.51
  const Y_DECKF = 5.52;
  const Y_RECV = 5.72;
  const Y_EAVE = 5.82;
  const Y_APEX = 6.0;
  const Y_TIP = 6.1;
  const TANKX = 1.75; // the air plant's centreline
  // the car, in ITS OWN frame (y 0 = the seat-pan line)
  const R_SEAT = 0.58; // seat ring — UNCHANGED, the seat anchors live on it
  const REST = 0.62; // parked car height — UNCHANGED
  const HE = 3.6; // flight height above REST (apex stays clear of the head)

  // ---- shared unit geometries (mergedParts READS its sources, so batches from
  //      these pass dispose=false; all disposed once at the end) -------------
  const G_BOX = new t.BoxGeometry(1, 1, 1);
  const G_CYL = new t.CylinderGeometry(0.5, 0.5, 1, 8);
  const G_CYLR = new t.CylinderGeometry(0.5, 0.5, 1, 14);
  const G_SPH = new t.SphereGeometry(0.5, 12, 8);
  const G_TOR = new t.TorusGeometry(0.5, 0.14, 8, 16);
  const G_BULB = new t.IcosahedronGeometry(0.036, 1);
  const SHARED = [G_BOX, G_CYL, G_CYLR, G_SPH, G_TOR, G_BULB];

  // ---- placement helpers ---------------------------------------------------
  const YA = new t.Vector3(0, 1, 0);
  const _d = new t.Vector3();
  const _mid = new t.Vector3();
  const _q = new t.Quaternion();
  /** a +Y unit geometry laid FROM a TO b — the only way to point a part at an
   *  arbitrary direction, and what every brace, pipe elbow, rail and restraint
   *  bar in this file uses. */
  const seg = (geo: THREE.BufferGeometry, a: V3, b: V3, w: number, into: PartSpec[], w2?: number) => {
    _d.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    const len = _d.length();
    if (len < 1e-5) return;
    _mid.set((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2);
    _q.setFromUnitVectors(YA, _d.normalize());
    into.push({ geo, matrix: new t.Matrix4().compose(_mid.clone(), _q.clone(), new t.Vector3(w, len, w2 ?? w)) });
  };
  /** a unit box scaled to FULL extents `dims`. With `rot = [0, -a, 0]` local +x
   *  is RADIAL and local +z TANGENTIAL. */
  const slab = (pos: V3, dims: V3, into: PartSpec[], rot: V3 = [0, 0, 0]) => into.push({ geo: G_BOX, matrix: mtx(t, pos, rot, dims) });
  /** an ellipsoid of FULL extents `dims` (G_SPH has diameter 1) — dished tank
   *  heads, seat shells, fairings */
  const blob = (pos: V3, dims: V3, into: PartSpec[], rot: V3 = [0, 0, 0]) => into.push({ geo: G_SPH, matrix: mtx(t, pos, rot, dims) });
  /** quads between consecutive rows -> ONE indexed geometry with real UVs */
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
  /** ONE roof panel between two ribs, as a real lofted surface that SAGS */
  const panelLoft = (
    a0: number, a1: number, rTop: number, rBot: number, yTop: number, yBot: number,
    sag: number, rows = 4, cols = 5, pw = 0.72,
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
  /** A TRUE RING — an open-ended cylinder wall. `cyl()` builds a SOLID DISC and
   *  a solid disc used as a band is a horizontal LID. */
  const ringWall = (rTop: number, rBot: number, h: number, y: number, into: PartSpec[], sg = 40) =>
    into.push({ geo: new t.CylinderGeometry(rTop, rBot, h, sg, 1, true), matrix: mtx(t, [0, y, 0]) });
  /** the flat ANNULUS that caps a ringWall (`down` flips the normals) */
  const ringTop = (rIn: number, rOut: number, y: number, into: PartSpec[], sg = 40, down = false) =>
    into.push({ geo: new t.RingGeometry(rIn, rOut, sg), matrix: mtx(t, [0, y, 0], [down ? Math.PI / 2 : -Math.PI / 2, 0, 0]) });

  const env = steelEnv(t);
  const shiny = (
    color: number,
    metal: number,
    rough: number,
    o: { tex?: 'metal' | 'plastic' | 'fabric' | 'concrete'; repeat?: [number, number]; two?: boolean } = {},
  ) => {
    const m = mat(t, color, { metal, rough, tex: o.tex, repeat: o.repeat });
    if (env && metal > 0.05) {
      m.envMap = env;
      m.envMapIntensity = metal > 0.9 ? 1.3 : 0.95;
    }
    if (o.two) m.side = t.DoubleSide;
    return m;
  };
  const gilt = <M extends THREE.Mesh>(m: M, i = 0.95) => {
    const mm = m.material as THREE.MeshStandardMaterial;
    if (env) {
      mm.envMap = env;
      mm.envMapIntensity = i;
    }
    return m;
  };

  // =========================================================================
  // 1. THE PAD — tarmac, hazard kerb, striped launch pad, fence, boarding step
  // =========================================================================
  {
    const pad: PartSpec[] = [];
    ringWall(R_PAD, R_PAD, Y_PAD, Y_PAD / 2, pad, 48);
    ringTop(0, R_PAD, Y_PAD, pad, 48);
    group.add(mergedParts(t, pad, mat(t, STONE, { tex: 'concrete', repeat: [8, 2], rough: 0.9 })));
    const kerb: PartSpec[] = [];
    ringWall(R_KERB, R_KERB, 0.06, 0.03, kerb, 48);
    ringTop(R_PAD, R_KERB, 0.06, kerb, 48);
    group.add(mergedParts(t, kerb, mat(t, GOLD, { tex: 'metal', repeat: [12, 1], metal: 0.3, rough: 0.6 })));
    // the launch pad the car sits over: 16 alternating hazard blocks
    const hzA: PartSpec[] = [];
    const hzB: PartSpec[] = [];
    for (let i = 0; i < 16; i += 1) {
      const a = (i / 16) * Math.PI * 2;
      slab([Math.cos(a) * 0.78, Y_PAD + 0.012, Math.sin(a) * 0.78], [0.22, 0.024, 0.2], i % 2 ? hzA : hzB, [0, -a, 0]);
    }
    group.add(mergedParts(t, hzA, mat(t, GOLD, { rough: 0.7 }), false));
    group.add(mergedParts(t, hzB, mat(t, 0x2c3036, { rough: 0.7 }), false));
    // fence: stanchions, a top rail and a mid rail, boarding gap at the +z
    // front. The old one was 11 posts and 10 straight boxes; these follow the
    // ring because they are placed FROM THEIR ENDPOINTS.
    const fence: PartSpec[] = [];
    const N_F = 18;
    const open = (i: number) => Math.sin(((i + 0.5) / N_F) * Math.PI * 2) > 0.6;
    for (let i = 0; i < N_F; i += 1) {
      const a = (i / N_F) * Math.PI * 2;
      const p: V3 = [Math.cos(a) * R_FENCE, Y_PAD - 0.32, Math.sin(a) * R_FENCE];
      if (!open(i) || !open(i - 1)) {
        seg(G_CYLR, p, [p[0], Y_PAD + 0.1, p[2]], 0.034, fence);
        slab([p[0], Y_PAD - 0.3, p[2]], [0.1, 0.03, 0.1], fence, [0, -a, 0]);
      }
      if (open(i)) continue;
      const a1 = ((i + 1) / N_F) * Math.PI * 2;
      const q: V3 = [Math.cos(a1) * R_FENCE, Y_PAD - 0.32, Math.sin(a1) * R_FENCE];
      [0.1, -0.09].forEach((h) => seg(G_BOX, [p[0], Y_PAD + h, p[2]], [q[0], Y_PAD + h, q[2]], 0.028, fence));
    }
    group.add(mergedParts(t, fence, shiny(RAILSTEEL, 0.6, 0.42), false));
    // boarding step up onto the pad at the local +z front
    const step: PartSpec[] = [];
    slab([0, 0.09, R_PAD + 0.11], [0.7, 0.18, 0.2], step);
    slab([0, 0.26, R_PAD + 0.06], [0.7, 0.17, 0.11], step);
    group.add(mergedParts(t, step, mat(t, 0xa8aeb6, { tex: 'concrete', rough: 0.9 }), false));
  }

  // =========================================================================
  // 2. THE TRUSS — 11 bays, four chords, rungs and a full X-brace on ALL FOUR
  //    faces of every bay (the old one braced two faces), plan bracing, feet
  // =========================================================================
  {
    const chords: PartSpec[] = [];
    const braces: PartSpec[] = [];
    const marks: PartSpec[] = [];
    const corner = (k: number, y: number, r: number): V3 => [k === 0 || k === 3 ? r : -r, y, k < 2 ? r : -r];
    for (let b = 0; b < BAYS; b += 1) {
      const yb = Y_M0 + ((Y_M1 - Y_M0) * b) / BAYS;
      const yt = Y_M0 + ((Y_M1 - Y_M0) * (b + 1)) / BAYS;
      for (let k = 0; k < 4; k += 1) {
        const k1 = (k + 1) % 4;
        seg(G_CYL, corner(k, yb, CS), corner(k, yt, CS), 0.08, chords);
        seg(G_BOX, corner(k, yt, CS), corner(k1, yt, CS), 0.05, braces);
        seg(G_BOX, corner(k, yb, CS), corner(k1, yt, CS), 0.042, braces);
        seg(G_BOX, corner(k1, yb, CS), corner(k, yt, CS), 0.042, braces);
      }
      if (b % 3 === 2) {
        seg(G_BOX, corner(0, yt, CS), corner(2, yt, CS), 0.036, braces);
        seg(G_BOX, corner(1, yt, CS), corner(3, yt, CS), 0.036, braces);
        for (let k = 0; k < 4; k += 1) {
          const c = corner(k, yt, CS);
          marks.push({ geo: G_CYLR, matrix: mtx(t, [c[0], yt - 0.1, c[2]], [0, 0, 0], [0.105, 0.12, 0.105]) });
        }
      }
    }
    for (let k = 0; k < 4; k += 1) {
      const k1 = (k + 1) % 4;
      seg(G_BOX, corner(k, Y_M0 + 0.06, CS), corner(k1, Y_M0 + 0.06, CS), 0.055, braces);
      slab(corner(k, Y_PAD + 0.04, CS), [0.19, 0.08, 0.19], braces, [0, Math.PI / 4, 0]);
    }
    group.add(mergedParts(t, chords, shiny(ACCENT, 0.35, 0.45, { tex: 'metal', repeat: [1, 3] }), false));
    group.add(mergedParts(t, braces, shiny(LATTICE, 0.5, 0.42), false));
    group.add(mergedParts(t, marks, shiny(LATTICE, 0.55, 0.4), false));
  }

  // =========================================================================
  // 3. THE LAUNCH PLANT — tanks with dished heads, valve heads, manifold,
  //    compressor skid, gauge board, and the vertical LAUNCH CYLINDER
  // =========================================================================
  {
    const tanks: PartSpec[] = [];
    const bands: PartSpec[] = [];
    const pipes: PartSpec[] = [];
    const plant: PartSpec[] = [];
    [-1, 0, 1].forEach((k) => {
      const z = k * 0.42;
      // shell with DISHED heads top and bottom, on saddle legs
      tanks.push({ geo: new t.CylinderGeometry(0.14, 0.14, 0.8, 16, 1, true), matrix: mtx(t, [TANKX, 0.56, z]) });
      blob([TANKX, 0.96, z], [0.28, 0.15, 0.28], tanks); // dished head, not a ball
      blob([TANKX, 0.16, z], [0.28, 0.14, 0.28], tanks);
      [-1, 1].forEach((s) => {
        seg(G_BOX, [TANKX + s * 0.1, 0.06, z], [TANKX + s * 0.13, 0.2, z], 0.045, plant);
        slab([TANKX + s * 0.11, 0.05, z], [0.12, 0.03, 0.16], plant);
      });
      bands.push({ geo: new t.CylinderGeometry(0.152, 0.152, 0.1, 16, 1, true), matrix: mtx(t, [TANKX, 0.74, z]) });
      bands.push({ geo: new t.CylinderGeometry(0.152, 0.152, 0.1, 16, 1, true), matrix: mtx(t, [TANKX, 0.38, z]) });
      // valve head + handwheel on top
      seg(G_CYLR, [TANKX, 1.04, z], [TANKX, 1.14, z], 0.06, plant);
      plant.push({ geo: G_TOR, matrix: mtx(t, [TANKX, 1.17, z], [0, 0, 0], [0.13, 0.05, 0.13]) });
      // The feed run to the tower: down off the valve head, in as far as the
      // CAR'S SWEPT ENVELOPE allows, then down again and into the pad wall.
      // The first pass ran it straight in at y 0.5 and it passed 0.055 under the
      // parked car's skirt rail and visibly crossed the vehicle in the close-up.
      // The car's outermost parts reach r 0.88 and its lowest reaches y 0.31, so
      // the horizontal leg stops at r 0.95 and the rest is buried.
      seg(G_CYLR, [TANKX, 1.1, z], [TANKX - 0.24, 1.1, z], 0.05, pipes);
      seg(G_CYLR, [TANKX - 0.24, 1.1, z], [TANKX - 0.24, 0.5, z], 0.05, pipes);
      seg(G_CYLR, [TANKX - 0.24, 0.5, z], [1.02, 0.5, z * 0.75], 0.05, pipes);
      seg(G_CYLR, [1.02, 0.5, z * 0.75], [1.02, 0.22, z * 0.75], 0.05, pipes);
      seg(G_CYLR, [1.02, 0.22, z * 0.75], [R_KERB - 0.03, 0.22, z * 0.75], 0.05, pipes);
    });
    // manifold across the three valve heads + a riser into the head assembly
    seg(G_CYLR, [TANKX, 1.28, -0.5], [TANKX, 1.28, 0.5], 0.055, pipes);
    [-0.42, 0, 0.42].forEach((z) => seg(G_CYLR, [TANKX, 1.17, z], [TANKX, 1.28, z], 0.045, pipes));
    // compressor skid: frame, body, a louvred grille, cooling fins, a gauge
    // board. The old one was a single 0.5 x 0.45 x 0.65 grey box.
    const sx = TANKX;
    const sz = -0.85;
    slab([sx, 0.24, sz], [0.5, 0.42, 0.62], plant);
    slab([sx, 0.47, sz], [0.5, 0.05, 0.68], plant);
    slab([sx, 0.03, sz], [0.5, 0.06, 0.7], plant); // 0.5, not 0.58: the skid is
    // the +x footprint edge at x 2.0 and must not grow past it
    for (let i = 0; i < 6; i += 1) slab([sx - 0.26, 0.12 + i * 0.055, sz], [0.02, 0.03, 0.4], plant);
    for (let i = 0; i < 7; i += 1) slab([sx, 0.5, sz - 0.28 + i * 0.093], [0.4, 0.05, 0.02], plant);
    const gauges: PartSpec[] = [];
    slab([sx - 0.28, 0.36, sz + 0.36], [0.03, 0.2, 0.24], gauges);
    [-0.06, 0.06].forEach((dz) => gauges.push({ geo: G_CYLR, matrix: mtx(t, [sx - 0.3, 0.4, sz + 0.36 + dz], [0, 0, Math.PI / 2], [0.09, 0.02, 0.09]) }));
    // THE LAUNCH CYLINDER up the middle of the mast: the pneumatic ram this
    // whole ride is named for, with a gland at the top and its own feed.
    // KEPT SLIM ON PURPOSE. At r 0.16 it read as a fat grey MAST filling the
    // middle of the truss and undid the bracing the rebuild exists to show; a
    // ram inside a tower should read as a rod between the diagonals, not as the
    // tower. It is fed from under the pad, not across the car.
    tanks.push({ geo: new t.CylinderGeometry(0.105, 0.105, 3.5, 16, 1, true), matrix: mtx(t, [0, 2.15, 0]) });
    ringTop(0, 0.105, 0.4, tanks, 16, true);
    bands.push({ geo: new t.CylinderGeometry(0.125, 0.125, 0.09, 16, 1, true), matrix: mtx(t, [0, 3.85, 0]) });
    bands.push({ geo: new t.CylinderGeometry(0.125, 0.125, 0.09, 16, 1, true), matrix: mtx(t, [0, 0.5, 0]) });
    group.add(mergedParts(t, tanks, shiny(TANK, 0.45, 0.45, { tex: 'metal', repeat: [3, 3] })));
    group.add(mergedParts(t, bands, shiny(ACCENT, 0.4, 0.5)));
    group.add(mergedParts(t, pipes, shiny(0x6f767f, 0.75, 0.32), false));
    group.add(mergedParts(t, plant, shiny(0x6b7078, 0.5, 0.5, { tex: 'metal', repeat: [3, 2] }), false));
    group.add(mergedParts(t, gauges, shiny(0xd8dce0, 0.5, 0.35), false));
  }

  // =========================================================================
  // 4. GUIDE RAILS + fin brakes
  // =========================================================================
  {
    const rails: PartSpec[] = [];
    const brakes: PartSpec[] = [];
    [1, -1].forEach((s) => {
      slab([s * R_RAIL, (Y_M0 + Y_M1) / 2, 0], [0.05, Y_M1 - Y_M0, 0.12], rails);
      slab([s * (R_RAIL - 0.045), (Y_M0 + Y_M1) / 2, 0], [0.05, Y_M1 - Y_M0, 0.05], rails);
      for (let y = Y_M0 + 0.24; y < Y_M1; y += 0.473) {
        seg(G_BOX, [s * (R_RAIL - 0.06), y, 0], [s * CS, y, CS], 0.03, rails);
        seg(G_BOX, [s * (R_RAIL - 0.06), y, 0], [s * CS, y, -CS], 0.03, rails);
      }
      // the fin-brake calipers over the landing zone, jaws either side of the
      // plane the car's fin runs in
      for (let i = 0; i < 5; i += 1) {
        const y = 1.1 + i * 0.26;
        [0.1, -0.1].forEach((dz) => slab([s * (R_RAIL - 0.02), y, dz], [0.11, 0.18, 0.05], brakes));
        slab([s * (R_RAIL - 0.08), y, 0], [0.04, 0.18, 0.26], brakes);
      }
    });
    group.add(mergedParts(t, rails, shiny(RAILSTEEL, 0.8, 0.24), false));
    group.add(mergedParts(t, brakes, mat(t, 0xb8481c, { metal: 0.3, rough: 0.6 }), false));
  }

  // =========================================================================
  // 5. THE HEAD ASSEMBLY — railed machine deck, the air receiver, sheaves, a
  //    LOFTED sheet-metal roof, finial and beacon (it was a grey party hat)
  // =========================================================================
  {
    const deck: PartSpec[] = [];
    ringWall(0.56, 0.52, 0.1, Y_DECKF - 0.05, deck, 28);
    ringTop(0.2, 0.56, Y_DECKF, deck, 28);
    for (let k = 0; k < 4; k += 1) {
      const a = Math.PI / 4 + (k * Math.PI) / 2;
      seg(G_BOX, [Math.cos(a) * 0.54, Y_DECKF - 0.02, Math.sin(a) * 0.54], [Math.cos(a) * CS * Math.SQRT2, Y_DECKF - 0.26, Math.sin(a) * CS * Math.SQRT2], 0.045, deck);
    }
    group.add(mergedParts(t, deck, shiny(0x9ba2ab, 0.6, 0.4, { tex: 'metal', repeat: [8, 1] })));
    const rail: PartSpec[] = [];
    for (let i = 0; i < 12; i += 1) {
      const a = (i / 12) * Math.PI * 2;
      const a1 = ((i + 1) / 12) * Math.PI * 2;
      const p: V3 = [Math.cos(a) * 0.53, Y_DECKF, Math.sin(a) * 0.53];
      const q: V3 = [Math.cos(a1) * 0.53, Y_DECKF, Math.sin(a1) * 0.53];
      seg(G_CYLR, p, [p[0], Y_DECKF + 0.26, p[2]], 0.024, rail);
      [0.26, 0.15].forEach((h) => seg(G_BOX, [p[0], Y_DECKF + h, p[2]], [q[0], Y_DECKF + h, q[2]], 0.02, rail));
    }
    group.add(mergedParts(t, rail, shiny(GOLD, 0.8, 0.3), false));
    // the air receiver lying across the deck, its saddles, and the sheaves
    const head: PartSpec[] = [];
    head.push({ geo: new t.CylinderGeometry(0.13, 0.13, 0.62, 16, 1, true), matrix: mtx(t, [0, Y_RECV, 0], [0, 0, Math.PI / 2]) });
    [-1, 1].forEach((s) => blob([s * 0.31, Y_RECV, 0], [0.16, 0.26, 0.26], head, [0, 0, Math.PI / 2]));
    [-1, 1].forEach((s) => seg(G_BOX, [s * 0.2, Y_RECV - 0.12, 0], [s * 0.2, Y_DECKF, 0], 0.06, head));
    [0.2, -0.2].forEach((sz) => head.push({ geo: G_TOR, matrix: mtx(t, [0, Y_DECKF + 0.2, sz], [0, Math.PI / 2, 0], [0.24, 0.24, 0.24]) }));
    group.add(mergedParts(t, head, shiny(STEEL, 0.7, 0.34), false));
    // the roof: 8 lofted sheet-metal panels in two tones, with a red fascia
    const rA: PartSpec[] = [];
    const rB: PartSpec[] = [];
    for (let i = 0; i < 8; i += 1) {
      const a0 = (i / 8) * Math.PI * 2;
      (i % 2 ? rA : rB).push({ geo: panelLoft(a0, a0 + Math.PI / 4, 0.05, 0.58, Y_APEX, Y_EAVE, 0.026, 4, 5), matrix: new t.Matrix4() });
    }
    const roofA = mergedParts(t, rA, shiny(0x9198a1, 0.55, 0.4, { two: true }));
    const roofB = mergedParts(t, rB, shiny(0x777e87, 0.55, 0.42, { two: true }));
    roofA.castShadow = false;
    roofB.castShadow = false;
    group.add(roofA, roofB);
    const fascia: PartSpec[] = [];
    ringWall(0.59, 0.59, 0.055, Y_EAVE - 0.02, fascia, 28);
    group.add(mergedParts(t, fascia, mat(t, ACCENT, { rough: 0.55 })));
    group.add(gilt(cyl(t, 0.018, 0.028, Y_TIP - Y_APEX + 0.08, GOLD, [0, (Y_APEX + Y_TIP) / 2, 0], { metal: 0.85, rough: 0.3, seg: 8 })));
  }
  const beaconMat = new t.MeshStandardMaterial({ color: 0xff5544, emissive: 0xff2222, emissiveIntensity: 0.15, roughness: 0.4 });
  const beacon = new t.Mesh(new t.SphereGeometry(0.06, 10, 8), beaconMat);
  beacon.position.set(0, Y_TIP, 0);
  group.add(beacon);
  const beaconLight = new t.PointLight(0xff3333, 0, 4, 2);
  beaconLight.position.set(0, Y_TIP + 0.07, 0);
  group.add(beaconLight);

  // ---- tower marker bulbs + the station lamp mast (unchanged lights) -------
  const bulbMat = new t.MeshStandardMaterial({ color: 0xfff3c0, emissive: 0xffb040, emissiveIntensity: 0.15, roughness: 0.35 });
  {
    const bulbs: PartSpec[] = [];
    for (let i = 0; i < 7; i += 1)
      [-1, 1].forEach((s) => bulbs.push({ geo: G_BULB, matrix: mtx(t, [s * CS, 0.62 + i * 0.72, CS + 0.055]) }));
    const bm = mergedParts(t, bulbs, bulbMat, false);
    bm.castShadow = false;
    group.add(bm);
  }
  const stationLight = new t.PointLight(0xffc97a, 0, 5, 2);
  stationLight.position.set(1.1, 1.6, 0.8);
  group.add(stationLight);
  {
    const lamp: PartSpec[] = [];
    seg(G_CYLR, [1.1, Y_PAD, 0.8], [1.1, 1.5, 0.8], 0.05, lamp);
    seg(G_BOX, [1.1, 1.5, 0.8], [1.1, 1.5, 0.62], 0.045, lamp);
    slab([1.1, 1.47, 0.62], [0.17, 0.05, 0.17], lamp);
    group.add(mergedParts(t, lamp, shiny(STEEL, 0.6, 0.42), false));
  }
  const mastLamp = new t.Mesh(new t.SphereGeometry(0.06, 10, 8), bulbMat);
  mastLamp.position.set(1.1, 1.44, 0.62);
  group.add(mastLamp);

  // =========================================================================
  // 6. THE 4-SEAT RING CAR — an open collar frame with a HOLE for the mast (the
  //    old one had two solid plates straight through the tower), nose fairings,
  //    guide shoes, a brake fin, and four moulded seat pods
  // =========================================================================
  const car = new t.Group();
  group.add(car);
  const vehicle: THREE.Object3D = car;
  const riders: ReturnType<typeof buildPeep>[] = [];
  {
    // the collar: four side beams round a 0.51-clear hole, cross-corner
    // gussets, and a floor GRATING that is a frame, not a plate
    const body: PartSpec[] = [];
    const frame: PartSpec[] = [];
    [1, -1].forEach((s) => {
      slab([0, 0.12, s * 0.56], [1.12, 0.24, 0.13], body);
      slab([s * 0.56, 0.12, 0], [0.13, 0.24, 1.12], body);
      slab([0, 0.29, s * 0.56], [1.2, 0.05, 0.16], body); // capping rail
      slab([0, -0.04, s * 0.56], [1.2, 0.05, 0.16], body); // skirt rail
    });
    for (let k = 0; k < 4; k += 1) {
      const a = Math.PI / 4 + (k * Math.PI) / 2;
      // corner fairing: the shape that makes the car read as a vehicle
      blob([Math.cos(a) * 0.6, 0.12, Math.sin(a) * 0.6], [0.3, 0.3, 0.3], body, [0, -a, 0]);
      seg(G_BOX, [Math.cos(a) * 0.52, 0.02, Math.sin(a) * 0.52], [Math.cos(a) * 0.36, 0.02, Math.sin(a) * 0.36], 0.07, frame, 0.05);
    }
    for (let i = 0; i < 4; i += 1) {
      const a = (i / 4) * Math.PI * 2;
      seg(G_BOX, [Math.cos(a) * 0.4, 0.02, Math.sin(a) * 0.4], [Math.cos(a) * 0.56, 0.02, Math.sin(a) * 0.56], 0.07, frame, 0.05);
    }
    ringWall(0.36, 0.36, 0.1, 0.06, frame, 20); // the collar round the shaft
    // guide shoes on both rails + the brake fin between the caliper jaws
    [1, -1].forEach((s) => {
      slab([s * 0.44, 0.12, 0], [0.16, 0.2, 0.24], frame);
      [0.1, -0.1].forEach((dz) => slab([s * (R_RAIL - 0.02), 0.12, dz], [0.1, 0.14, 0.045], frame));
      slab([s * (R_RAIL - 0.05), -0.16, 0], [0.06, 0.3, 0.085], frame); // FIN
    });
    car.add(mergedParts(t, body, mat(t, CAR, { tex: 'plastic', repeat: [4, 1], rough: 0.45 }), false));
    car.add(mergedParts(t, frame, shiny(STEEL, 0.7, 0.35), false));

    // --- four seat pods, one per tower face -------------------------------
    const shell: PartSpec[] = [];
    const cushions: PartSpec[] = [];
    const harn: PartSpec[] = [];
    for (let i = 0; i < 4; i += 1) {
      const a = (i / 4) * Math.PI * 2;
      // local +z points radially OUT — identical to the old build, so every
      // seat anchor (and therefore every real rider) is unmoved
      const seatM = new t.Matrix4().compose(
        new t.Vector3(Math.cos(a) * R_SEAT, 0, Math.sin(a) * R_SEAT),
        new t.Quaternion().setFromEuler(new t.Euler(0, Math.PI / 2 - a, 0)),
        new t.Vector3(1, 1, 1),
      );
      const M = (p: V3, dims: V3, rot: V3 = [0, 0, 0]) => seatM.clone().multiply(mtx(t, p, rot, dims));
      shell.push({ geo: G_BOX, matrix: M([0, 0, -0.02], [0.32, 0.07, 0.32]) }); // pan
      shell.push({ geo: G_SPH, matrix: M([0, 0.2, -0.13], [0.33, 0.46, 0.13]) }); // moulded back
      [-0.145, 0.145].forEach((dx) => shell.push({ geo: G_BOX, matrix: M([dx, 0.17, -0.04], [0.045, 0.34, 0.19]) })); // wings
      shell.push({ geo: G_SPH, matrix: M([0, 0.45, -0.11], [0.18, 0.13, 0.1]) }); // headrest
      cushions.push({ geo: G_BOX, matrix: M([0, 0.2, -0.07], [0.23, 0.3, 0.032]) });
      cushions.push({ geo: G_BOX, matrix: M([0, 0.045, -0.02], [0.23, 0.032, 0.23]) });
      cushions.push({ geo: G_BOX, matrix: M([0, 0.45, -0.075], [0.15, 0.09, 0.035]) }); // headrest pad
      // OTS restraint: three endpoint-placed runs a side, so the bar CURVES
      // over the shoulder and down onto a chest pad
      [-0.075, 0.075].forEach((dx) => {
        const pts: V3[] = [[dx, 0.33, -0.11], [dx, 0.42, -0.02], [dx, 0.33, 0.08], [dx, 0.15, 0.1]];
        for (let k = 0; k < pts.length - 1; k += 1) {
          const p = pts[k];
          const q = pts[k + 1];
          _d.set(q[0] - p[0], q[1] - p[1], q[2] - p[2]);
          const len = _d.length();
          _q.setFromUnitVectors(YA, _d.clone().normalize());
          harn.push({
            geo: G_CYLR,
            matrix: seatM
              .clone()
              .multiply(new t.Matrix4().compose(new t.Vector3((p[0] + q[0]) / 2, (p[1] + q[1]) / 2, (p[2] + q[2]) / 2), _q.clone(), new t.Vector3(0.038, len, 0.038))),
          });
        }
      });
      harn.push({ geo: G_BOX, matrix: M([0, 0.14, 0.11], [0.2, 0.14, 0.05]) }); // chest pad
      harn.push({ geo: G_BOX, matrix: M([0, -0.02, 0.11], [0.26, 0.045, 0.045]) }); // lap bar
      harn.push({ geo: G_BOX, matrix: M([0, -0.15, 0.06], [0.26, 0.04, 0.055]) }); // footrest
      [-0.155, 0.155].forEach((dx) => harn.push({ geo: G_CYLR, matrix: M([dx, 0.2, 0.03], [Math.PI / 2, 0, 0], [0.03, 0.16, 0.03]) })); // grab handles
      // the seat ANCHOR — real GameManager guests land here via seatWorld,
      // at the SAME local offset the old build used
      const anchor = new t.Group();
      anchor.position.set(Math.cos(a) * R_SEAT, 0, Math.sin(a) * R_SEAT);
      anchor.rotation.y = Math.PI / 2 - a;
      const inner = new t.Group();
      inner.position.set(0, -0.11, -0.02); // hips on the cushion, legs dangling
      anchor.add(inner);
      car.add(anchor);
      anchors.push(inner);
      if (withRiders) {
        const p = buildPeep(t, {
          skin: SKIN_TONES[i % SKIN_TONES.length],
          shirt: SHIRTS[(i + 4) % SHIRTS.length],
          seated: true,
          expression: 'surprised',
          female: h01(i * 2.3) > 0.5,
        });
        p.group.scale.setScalar(0.34);
        inner.add(p.group);
        riders.push(p);
      }
    }
    car.add(mergedParts(t, shell, mat(t, CAR, { tex: 'plastic', repeat: [2, 2], rough: 0.48 }), false));
    car.add(mergedParts(t, cushions, mat(t, SEATC, { tex: 'fabric', repeat: [2, 2], rough: 0.95 }), false));
    car.add(mergedParts(t, harn, shiny(0x767d86, 0.6, 0.4), false));
  }
  // under-car light (a warm wash pooling on the pad as the car flies)
  const underGlow = new t.Mesh(new t.SphereGeometry(0.05, 10, 8), bulbMat);
  underGlow.position.set(0, -0.24, 0);
  car.add(underGlow);
  const underLight = new t.PointLight(0xffd090, 0, 4.5, 2);
  underLight.position.set(0, -0.34, 0);
  car.add(underLight);

  SHARED.forEach((g) => g.dispose()); // every batch has copied what it needed

  // launch air-blast: burst-only steam emitter at the base (unchanged)
  const blast = buildEmitter(t, {
    max: 60, rate: 0, life: 1.1, lifeVar: 0.3,
    velocity: [0, 1.6, 0], spread: 0.9, gravity: 0.6,
    size: 0.12, sizeEnd: 0.5, color: 0xe8eef2, colorEnd: 0xaeb6bc, opacity: 0.5,
  });
  blast.setOrigin(0, 0.45, 0);
  group.add(blast.points);

  // =========================================================================
  // 7. THE DETERMINISTIC 12 s CYCLE — launch, float, glide, reload (unchanged)
  // =========================================================================
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
  const raw = (time: number, motionK = 1) => {
    const nk = nightKOf(group);
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
    riders.forEach((p, i) => {
      const wave = 0.1 * Math.sin(time * 6 + i * 1.7) * raise;
      p.armL.rotation.x = -1.1 + raise * -1.55 + wave;
      p.armR.rotation.x = -1.1 + raise * -1.55 - wave;
      p.armL.rotation.z = 0.05 + raise * 0.3;
      p.armR.rotation.z = -0.05 - raise * 0.3;
    });
    blast.update(time);
  };
  // station gate: ring car parked at the base while guests board/unload
  // (spinDown 0.9), the 12 s launch cycle restarting on every departure
  const gate = createMotionGate(raw, { spinDown: 0.9 });
  const onStateChange = (state: string) => {
    gate.onStateChange(state);
    if (state === 'departing') cycle0 = gate.clock();
  };
  raw(0, 0); // seat the rest pose before the first frame
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

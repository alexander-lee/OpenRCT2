import React from 'react';
import * as THREE from 'three';
import { ball, cyl, mat, mergedParts, mtx, nightKOf } from '../Stage';
import { buildPeep, SHIRTS, SKIN_TONES } from '../Guest';
import { createMotionGate, makeSeatWorld } from '../GameManager';
import { composableRide } from '../Park';

// ---------------------------------------------------------------------------
// ObservationTower — a real observation tower (RCT2 OBS1): a glazed cabin that
// climbs a lattice mast. Not a parasol on a ladder.
//
// WHAT WAS WRONG. Rendered at 9.5 u it read as a red-and-white BEACH UMBRELLA
// halfway up a stick, and that was accurate to the geometry:
//  * the mast had FOUR vertical sticks and horizontal rungs and NO DIAGONALS AT
//    ALL — a ladder, not a truss. Against sky a ladder has no silhouette.
//  * the roof was 12 `CylinderGeometry` wedges of rTop 0.03 / rBot 1.05 over a
//    0.42 height: a flat cone with a 68-degree eave, i.e. a parasol. It
//    overhung the r 0.95 drum by 0.10 in every direction, so from any camera
//    above eye level it HID the entire cabin — the blue drum, the twelve
//    windows, the mullions and the eight riders were all under it.
//  * the "floor ring" was a `cyl()`, and `cyl()` builds a SOLID DISC, so the
//    r 1.02 ring was a lid over the boarding platform.
//  * the base was one grey concrete disc. No station, no platform, no rails,
//    no operator booth, no footing, no ladder, no crown, no drive.
//
// WHAT IT IS NOW:
//  1. A TRUSS: 13 bays with four tubular chords, a rung on ALL FOUR faces at
//     every bay line, a full X-brace on all four faces of every bay, plan
//     bracing every third bay, painted marker collars, gusseted feet and a
//     caged SERVICE LADDER up the −x face. ~250 members, every one placed FROM
//     ITS TWO ENDPOINTS, in three merged meshes.
//  2. A DRIVE: two guide rails the cabin runs on, a toothed RACK up the +x face
//     (this is a rack-and-pinion tower), the cabin's own pinion housing, guide
//     shoes and outrigger arms.
//  3. A CROWN: a railed machine deck with a cable slot, the hoist sheaves and
//     motor, a lofted peaked roof, a lightning finial and the aviation beacon.
//  4. A CABIN that reads as a glazed room: a panelled sill band, TWELVE tall
//     windows in real frames with head and cill transoms, an inner handrail, a
//     bench ring round the core, a floor ring that is a RING, an eave fascia
//     with gutter, a LOFTED red/cream pinwheel roof with SAG between its ribs
//     over a lit cream ceiling, a bulb ring under the eave and a finial. The
//     apex is 0.48 above the eave, not 0.42 over a 68-degree cone: a SHALLOW
//     roof seen from a park camera is a flat disc, which is the whole reason the
//     old 12-wedge one read as a parasol.
//  5. A STATION: an apron, a boarding platform with a yellow-nosed riser and a
//     stepped approach at the local +z front, twelve deck studs, a boarding GATE
//     with a sign, the operator's console with its lever bank, and the mast
//     footing plinth. Where the station furniture can stand is not a style
//     choice — see THE ONLY FREE RING note in section 1.
//
// THE THREE TECHNIQUES: endpoint placement (`seg`), real lofted surfaces
// (`loft`/`panelLoft`), and cached-envMap metal (`steelEnv`/`shiny`) — because
// `metalness` with no envMap is grey paint, measured, not opinion.
//
// COST (harness/mp3d-render/probe-tower-cost.mjs): 98 draws / 2,220 tris before
// → 41 draws / 17,668 tris after; ~800 parts in 28 merged batches, far inside
// SETUP.md §13's "a single rig ≲ 300 draw calls". Real lights unchanged at 2.
// The footprint is unchanged at 2.1 x 2.1: the cabin roof used to be the widest
// thing at r 1.05, and the eave fascia now lands on exactly that radius, so the
// registered body blocker, hut clearance and queue front are all untouched.
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
// THE ENVIRONMENT THE STEEL AND THE GLASS REFLECT — drawn once, cached. three.js
// takes a metal's colour ENTIRELY from its reflections, so `metal: 0.5` with no
// envMap is a flat grey fill; the old mast was exactly that. A 256x128
// equirectangular canvas (sky gradient, horizon, sunlit ground, sun blob) costs
// one texture and makes galvanised steel read as galvanised steel.
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

export function buildObservationTowerScene(
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
  const withRiders = opts.riders ?? true; // decorative — off when registered so REAL guests fill the cabin
  const seats: THREE.Group[] = []; // 8 cabin window spots (seatWorld)
  let cycle0 = 0; // gated-clock value at the last departure (cycle phase zero)

  // ---- palette (RCT2 OBS1: deep-blue cabin drum, red/white pinwheel roof,
  //      pale galvanised mast) ------------------------------------------------
  const BLUE = 0x1a2f8c; // cabin drum (sprite #002090)
  const BLUE2 = 0x14245f; // its shaded sill panels
  const RED = 0xc23434; // roof stripes, marker collars, booth trim
  const CREAM = 0xdad4c8; // roof stripes, fascia
  const LATTICE = 0xc9ccd2; // pale tower steel
  const STEEL = 0x3f454d; // dark machinery steel
  const RAILSTEEL = 0x7d858f;
  const GOLD = 0xd0ab3c;
  const STONE = 0x9aa0a8;
  const GLASS = 0xbfe2f0;

  // ---- THE DIMENSION TABLE -------------------------------------------------
  const R_APRON = 1.02; // station apron (inside the 1.05 footprint half-extent)
  const Y_APRON = 0.06;
  const Y_PLAT = 0.2; // boarding platform top — the cabin floor meets it at rest
  const R_PLAT = 0.86;
  const Y_M0 = 0.06;
  const Y_M1 = 5.58; // chord heads
  const CS = 0.2; // mast half-width (corner 0.283) — the cabin encircles it
  const BAYS = 13;
  const R_RAIL = CS + 0.07;
  const R_SHAFT = 0.37; // nothing fixed to the mast may exceed this inside the
  //                      climb range; the cabin's inner clearance is 0.40
  const Y_DECKF = 5.54;
  const Y_SHEAVE = 5.74;
  const Y_EAVE = 5.86;
  const Y_APEX = 6.04;
  const Y_TIP = 6.14;
  // the cabin, in ITS OWN frame (y 0 = the floor line)
  const R_DRUM = 0.95;
  const R_HOLE = 0.4; // the hole the mast passes through
  const R_EAVE = 1.05; // roof eave == the OLD widest part, so the footprint is
  //                     unchanged at 2.1 x 2.1
  const Y_SILL = 0.31; // top of the sill band / bottom of the glass
  const Y_HEAD = 0.6; // top of the glass
  const Y_ROOF0 = 0.66; // eave
  const Y_ROOF1 = 1.14; // apex — STEEPER than the first pass (1.08). A shallow
  //                        cone seen from a park camera is a flat disc, which is
  //                        the whole reason the old 12-wedge roof read as a parasol.
  const PANES = 12;
  const Y_LOW = 0.35; // parked cabin height — UNCHANGED
  const Y_HIGH = 4.34; // top of the climb: the cabin roof at the deck's inner
  //                     radius tops out at 5.38 against a 5.45 deck underside,
  //                     and the cabin's finial rides UP THE CABLE SLOT (r 0.2)

  // ---- shared unit geometries (mergedParts READS its sources, so batches
  //      built from these pass dispose=false; disposed once at the end) ------
  const G_BOX = new t.BoxGeometry(1, 1, 1);
  const G_CYL = new t.CylinderGeometry(0.5, 0.5, 1, 8);
  const G_CYLR = new t.CylinderGeometry(0.5, 0.5, 1, 14);
  const G_SPH = new t.SphereGeometry(0.5, 12, 8);
  const G_TOR = new t.TorusGeometry(0.5, 0.14, 8, 16);
  const G_BULB = new t.IcosahedronGeometry(0.034, 1);
  const SHARED = [G_BOX, G_CYL, G_CYLR, G_SPH, G_TOR, G_BULB];

  // ---- placement helpers ---------------------------------------------------
  const YA = new t.Vector3(0, 1, 0);
  const _d = new t.Vector3();
  const _mid = new t.Vector3();
  const _q = new t.Quaternion();
  /** a +Y unit geometry laid FROM a TO b — the ONLY way to point a part at an
   *  arbitrary direction. `rotX/rotY/rotZ` cannot express one, and this mast's
   *  complete absence of diagonals is what happens when nobody has the tool. */
  const seg = (geo: THREE.BufferGeometry, a: V3, b: V3, w: number, into: PartSpec[], w2?: number) => {
    _d.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    const len = _d.length();
    if (len < 1e-5) return;
    _mid.set((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2);
    _q.setFromUnitVectors(YA, _d.normalize());
    into.push({ geo, matrix: new t.Matrix4().compose(_mid.clone(), _q.clone(), new t.Vector3(w, len, w2 ?? w)) });
  };
  /** a unit box scaled to FULL extents `dims`. With `rot = [0, -a, 0]` local +x
   *  is RADIAL and local +z TANGENTIAL — so a wall panel is [thickness, h, w]. */
  const slab = (pos: V3, dims: V3, into: PartSpec[], rot: V3 = [0, 0, 0]) => into.push({ geo: G_BOX, matrix: mtx(t, pos, rot, dims) });
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
  /** ONE roof panel between two ribs, as a real lofted SURFACE that SAGS
   *  between them. The old roof was 12 cone wedges: a cone has no sag, no
   *  gutter and no eave, which is exactly why it read as a parasol. */
  const panelLoft = (
    a0: number, a1: number, rTop: number, rBot: number, yTop: number, yBot: number,
    sag: number, rows = 5, cols = 5, pw = 0.7,
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
   *  a solid disc used as a band is a horizontal LID: the old r 1.02 "floor
   *  ring" was a lid across the boarding platform. */
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
    o: { tex?: 'metal' | 'plastic' | 'fabric' | 'concrete' | 'wood'; repeat?: [number, number]; two?: boolean } = {},
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
  // 1. THE STATION — apron, boarding platform + nosed step, deck studs, and the
  //    boarding gate + operator console on the ONE free ring (see the note below)
  // =========================================================================
  {
    const apron: PartSpec[] = [];
    ringWall(R_APRON, R_APRON, Y_APRON, Y_APRON / 2, apron, 48);
    ringTop(0, R_APRON, Y_APRON, apron, 48);
    group.add(mergedParts(t, apron, mat(t, STONE, { tex: 'concrete', rough: 0.94 })));
    // the boarding platform: a real riser + tread, so guests step UP to the
    // cabin floor rather than standing on a painted disc
    const plat: PartSpec[] = [];
    ringWall(R_PLAT, R_PLAT, Y_PLAT - Y_APRON, (Y_PLAT + Y_APRON) / 2, plat, 44);
    ringTop(R_HOLE - 0.02, R_PLAT, Y_PLAT, plat, 44);
    group.add(mergedParts(t, plat, mat(t, 0xb0b6bd, { tex: 'concrete', repeat: [8, 1], rough: 0.9 })));
    const nose: PartSpec[] = [];
    ringWall(R_PLAT + 0.035, R_PLAT + 0.035, 0.045, Y_PLAT - 0.022, nose, 44);
    ringTop(R_PLAT, R_PLAT + 0.035, Y_PLAT, nose, 44);
    group.add(mergedParts(t, nose, mat(t, 0xd8b040, { rough: 0.65 })));
    // the step down to the apron at the local +z front, where the queue arrives
    const step: PartSpec[] = [];
    slab([0, Y_APRON + 0.035, R_PLAT + 0.075], [0.62, 0.07, 0.15], step);
    slab([0, Y_APRON + 0.105, R_PLAT + 0.03], [0.62, 0.07, 0.09], step);
    group.add(mergedParts(t, step, mat(t, 0xb0b6bd, { tex: 'concrete', rough: 0.9 }), false));
    // ---- THE ONLY FREE RING ON THIS RIDE IS r 1.02 ------------------------
    // The PARKED CABIN owns the platform. Its floor annulus spans r 0.40 → 0.98
    // at y 0.31 → 0.39, and its sill/head band r 0.90 → 1.00 up to y 1.01, so
    // ANYTHING standing on the platform above y ~0.30 is inside the cabin when
    // it lands. The first pass put a 0.44-high railing ring at r 0.83 and an
    // operator booth at r 0.83 x 0.55 high straight through it — invisible at
    // rest and shearing through the cabin floor on every cycle.
    // What IS free is the annulus just outboard of the cabin's widest band and
    // under its roof eave: r 1.02 (the footprint is 1.05) below y ~0.95. So the
    // station furniture lives there — and only there.
    // The gate is an ARC, not a portal, and that is forced by the geometry: a
    // straight lintel across the boarding opening dips to r 0.93 at its middle,
    // which is inside the cabin's window band. Everything here therefore follows
    // the r 1.025 circle — two posts, a six-segment curved lintel, a sign.
    const RF = 1.025; // THE FREE RADIUS: 1.005 (cabin's outer face) .. 1.05 (footprint)
    const at = (a: number, y: number): V3 => [Math.cos(a) * RF, y, Math.sin(a) * RF];
    const A0 = Math.PI / 2; // the local +z front, where the queue arrives
    // Two tall gate posts with a curved head, plus a curved TOP and MID rail
    // running the width of the boarding frontage. The first pass made it a
    // narrow +/-0.44 rad arch and the close-up read it as a stray piece of
    // railing rather than a gateway; a boarding gate is as wide as its frontage.
    const gate: PartSpec[] = [];
    const SPAN = 0.86; // radians either side of the +z front
    [-SPAN, -0.3, 0.3, SPAN].forEach((d, i) => seg(G_CYLR, at(A0 + d, Y_APRON), at(A0 + d, i === 0 || i === 3 ? 0.86 : 0.74), 0.042, gate));
    [0.88, 0.46].forEach((h, r) => {
      const n = 10;
      for (let i = 0; i < n; i += 1)
        seg(G_BOX, at(A0 - SPAN + ((2 * SPAN) / n) * i, h), at(A0 - SPAN + ((2 * SPAN) / n) * (i + 1), h), r ? 0.032 : 0.05, gate, r ? 0.032 : 0.04);
    });
    group.add(mergedParts(t, gate, shiny(RAILSTEEL, 0.6, 0.42), false));
    const gateSign: PartSpec[] = [];
    for (let i = 0; i < 5; i += 1) {
      const a = A0 - 0.3 + (0.6 * i) / 4;
      slab([Math.cos(a) * RF, 0.955, Math.sin(a) * RF], [0.03, 0.11, 0.14], gateSign, [0, -a, 0]);
    }
    group.add(mergedParts(t, gateSign, mat(t, RED, { rough: 0.55 }), false));
    // the operator's console on the same free ring, a third of the way round:
    // a slim post, an angled desk panel, a lever bank and a weather visor
    const ca = Math.PI * 0.62;
    const desk: PartSpec[] = [];
    seg(G_CYLR, at(ca, Y_APRON), at(ca, 0.5), 0.045, desk);
    slab([Math.cos(ca) * RF, 0.53, Math.sin(ca) * RF], [0.04, 0.045, 0.22], desk, [0, -ca, 0]);
    slab([Math.cos(ca) * RF, 0.66, Math.sin(ca) * RF], [0.042, 0.035, 0.24], desk, [0, -ca, 0]);
    seg(G_BOX, at(ca, 0.55), at(ca, 0.64), 0.035, desk);
    group.add(mergedParts(t, desk, shiny(0x8d939b, 0.5, 0.45), false));
    const levers: PartSpec[] = [];
    for (let i = 0; i < 3; i += 1) {
      const a = ca - 0.06 + i * 0.06;
      slab([Math.cos(a) * RF, 0.58, Math.sin(a) * RF], [0.022, 0.09, 0.022], levers, [0, -a, 0]);
    }
    group.add(mergedParts(t, levers, mat(t, RED, { rough: 0.5 }), false));
    // low platform studs — deck lights, and the ONLY things allowed to stand on
    // the platform itself (0.05 high, well under the cabin floor at 0.31)
    const studs: PartSpec[] = [];
    for (let i = 0; i < 12; i += 1) {
      const a = (i / 12) * Math.PI * 2;
      studs.push({ geo: G_CYLR, matrix: mtx(t, [Math.cos(a) * 0.7, Y_PLAT + 0.02, Math.sin(a) * 0.7], [0, 0, 0], [0.08, 0.05, 0.08]) });
    }
    group.add(mergedParts(t, studs, mat(t, 0xd8b040, { metal: 0.3, rough: 0.5 }), false));
    // mast footing: a plinth with anchor bolts under each chord
    const foot: PartSpec[] = [];
    ringWall(R_HOLE + 0.06, R_HOLE + 0.1, 0.1, Y_PLAT + 0.05, foot, 24);
    ringTop(R_HOLE - 0.02, R_HOLE + 0.06, Y_PLAT + 0.1, foot, 24);
    group.add(mergedParts(t, foot, mat(t, 0x8d939b, { tex: 'concrete', rough: 0.92 })));
  }

  // =========================================================================
  // 2. THE TRUSS — 13 bays, four chords, rungs on all four faces, a full
  //    X-brace on every face of every bay, plan bracing, a caged ladder
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
        seg(G_CYL, corner(k, yb, CS), corner(k, yt, CS), 0.062, chords);
        seg(G_BOX, corner(k, yt, CS), corner(k1, yt, CS), 0.04, braces);
        // BOTH diagonals on ALL FOUR faces — the change that gives the mast a
        // silhouette. It had none at all.
        seg(G_BOX, corner(k, yb, CS), corner(k1, yt, CS), 0.034, braces);
        seg(G_BOX, corner(k1, yb, CS), corner(k, yt, CS), 0.034, braces);
      }
      if (b % 3 === 2) {
        seg(G_BOX, corner(0, yt, CS), corner(2, yt, CS), 0.03, braces);
        seg(G_BOX, corner(1, yt, CS), corner(3, yt, CS), 0.03, braces);
        for (let k = 0; k < 4; k += 1) {
          const c = corner(k, yt, CS);
          marks.push({ geo: G_CYLR, matrix: mtx(t, [c[0], yt - 0.08, c[2]], [0, 0, 0], [0.086, 0.1, 0.086]) });
        }
      }
    }
    for (let k = 0; k < 4; k += 1) {
      const k1 = (k + 1) % 4;
      seg(G_BOX, corner(k, Y_M0 + 0.05, CS), corner(k1, Y_M0 + 0.05, CS), 0.044, braces);
      slab(corner(k, Y_PLAT + 0.13, CS), [0.14, 0.06, 0.14], braces, [0, Math.PI / 4, 0]); // base plate
    }
    // SERVICE LADDER with a safety cage up the −x face: stringers, 26 rungs and
    // 7 hoops. Every real tower has one and it reads as scale at any distance.
    const ladder: PartSpec[] = [];
    const lx = -(CS + 0.075);
    [0.11, -0.11].forEach((dz) => seg(G_BOX, [lx, Y_PLAT + 0.2, dz], [lx, Y_M1, dz], 0.024, ladder));
    for (let y = Y_PLAT + 0.3; y < Y_M1; y += 0.2) seg(G_BOX, [lx, y, 0.11], [lx, y, -0.11], 0.02, ladder);
    for (let y = Y_PLAT + 0.6; y < Y_M1; y += 0.75) {
      const hoop: V3[] = [
        [lx + 0.02, y, 0.15], [lx - 0.11, y, 0.13], [lx - 0.16, y, 0], [lx - 0.11, y, -0.13], [lx + 0.02, y, -0.15],
      ];
      for (let i = 0; i < hoop.length - 1; i += 1) seg(G_BOX, hoop[i], hoop[i + 1], 0.02, ladder);
    }
    group.add(mergedParts(t, chords, shiny(LATTICE, 0.55, 0.38, { tex: 'metal', repeat: [1, 3] }), false));
    group.add(mergedParts(t, braces, shiny(LATTICE, 0.5, 0.42), false));
    group.add(mergedParts(t, ladder, shiny(RAILSTEEL, 0.6, 0.4), false));
    group.add(mergedParts(t, marks, mat(t, RED, { rough: 0.55 }), false));
  }

  // =========================================================================
  // 3. THE DRIVE — two guide rails and a toothed RACK the cabin's pinion runs
  //    on (a rack-and-pinion tower is what this ride actually is)
  // =========================================================================
  {
    const rails: PartSpec[] = [];
    const rack: PartSpec[] = [];
    [1, -1].forEach((s) => {
      slab([0, (Y_M0 + Y_M1) / 2, s * R_RAIL], [0.1, Y_M1 - Y_M0, 0.042], rails);
      slab([0, (Y_M0 + Y_M1) / 2, s * (R_RAIL - 0.04)], [0.05, Y_M1 - Y_M0, 0.05], rails);
      for (let y = Y_M0 + 0.25; y < Y_M1; y += 0.425) {
        seg(G_BOX, [0, y, s * (R_RAIL - 0.055)], [CS, y, s * CS], 0.028, rails);
        seg(G_BOX, [0, y, s * (R_RAIL - 0.055)], [-CS, y, s * CS], 0.028, rails);
      }
    });
    // the rack: a web up the +x face with 60 teeth on it
    slab([R_RAIL - 0.03, (Y_M0 + Y_M1) / 2, 0], [0.05, Y_M1 - Y_M0, 0.12], rack);
    for (let i = 0; i < 62; i += 1) slab([R_RAIL + 0.015, Y_M0 + 0.1 + i * 0.086, 0], [0.05, 0.042, 0.14], rack);
    group.add(mergedParts(t, rails, shiny(RAILSTEEL, 0.8, 0.24), false));
    group.add(mergedParts(t, rack, shiny(0x9198a1, 0.85, 0.3), false));
  }

  // =========================================================================
  // 4. THE CROWN — railed machine deck with a cable slot, sheaves on a bearing
  //    shaft, the hoist motor, a LOFTED roof, a finial and the beacon
  // =========================================================================
  {
    const deck: PartSpec[] = [];
    ringWall(0.46, 0.42, 0.09, Y_DECKF - 0.045, deck, 28);
    ringTop(0.2, 0.46, Y_DECKF, deck, 28); // floor, with the cable slot
    group.add(mergedParts(t, deck, shiny(0x9ba2ab, 0.6, 0.4, { tex: 'metal', repeat: [8, 1] })));
    const rail: PartSpec[] = [];
    for (let i = 0; i < 10; i += 1) {
      const a = (i / 10) * Math.PI * 2;
      const a1 = ((i + 1) / 10) * Math.PI * 2;
      const p: V3 = [Math.cos(a) * 0.43, Y_DECKF, Math.sin(a) * 0.43];
      const q: V3 = [Math.cos(a1) * 0.43, Y_DECKF, Math.sin(a1) * 0.43];
      seg(G_CYLR, p, [p[0], Y_DECKF + 0.24, p[2]], 0.022, rail);
      [0.24, 0.14].forEach((h) => seg(G_BOX, [p[0], Y_DECKF + h, p[2]], [q[0], Y_DECKF + h, q[2]], 0.019, rail));
    }
    group.add(mergedParts(t, rail, shiny(GOLD, 0.85, 0.3), false));
    const gear: PartSpec[] = [];
    seg(G_CYLR, [-0.24, Y_SHEAVE, 0], [0.24, Y_SHEAVE, 0], 0.04, gear);
    [0.12, -0.12].forEach((sx) => gear.push({ geo: G_TOR, matrix: mtx(t, [sx, Y_SHEAVE, 0], [0, Math.PI / 2, 0], [0.26, 0.26, 0.26]) }));
    slab([0, Y_DECKF + 0.12, -0.24], [0.26, 0.24, 0.16], gear);
    [-1, 1].forEach((s) => seg(G_BOX, [s * 0.24, Y_SHEAVE, 0], [s * 0.24, Y_DECKF, 0], 0.05, gear));
    group.add(mergedParts(t, gear, shiny(STEEL, 0.7, 0.35), false));
    const rA: PartSpec[] = [];
    const rB: PartSpec[] = [];
    for (let i = 0; i < 8; i += 1) {
      const a0 = (i / 8) * Math.PI * 2;
      (i % 2 ? rA : rB).push({ geo: panelLoft(a0, a0 + Math.PI / 4, 0.05, 0.5, Y_APEX, Y_EAVE, 0.022, 4, 5), matrix: new t.Matrix4() });
    }
    // the crown roof is METAL, in two tones — the first pass made it red/cream
    // like the cabin's and the rig read as two candy-striped caps on a stick,
    // one big and one small. A machine deck has a sheet-metal roof.
    const roofA = mergedParts(t, rA, shiny(0x9198a1, 0.55, 0.4, { two: true }));
    const roofB = mergedParts(t, rB, shiny(0x767d86, 0.55, 0.42, { two: true }));
    roofA.castShadow = false;
    roofB.castShadow = false;
    group.add(roofA, roofB);
    const fascia: PartSpec[] = [];
    ringWall(0.51, 0.51, 0.05, Y_EAVE - 0.018, fascia, 28);
    group.add(mergedParts(t, fascia, mat(t, RED, { rough: 0.55 })));
    group.add(gilt(cyl(t, 0.016, 0.026, Y_TIP - Y_APEX + 0.08, GOLD, [0, (Y_APEX + Y_TIP) / 2, 0], { metal: 0.85, rough: 0.3, seg: 8 })));
  }
  // the beacon keeps its own mesh — the night gate mutates its material
  const beaconMat = new t.MeshStandardMaterial({ color: 0xff5544, emissive: 0xff2222, emissiveIntensity: 0.15, roughness: 0.4 });
  const beacon = new t.Mesh(new t.SphereGeometry(0.055, 10, 8), beaconMat);
  beacon.position.set(0, Y_TIP, 0);
  group.add(beacon);
  const beaconLight = new t.PointLight(0xff3333, 0, 4, 2);
  beaconLight.position.set(0, Y_TIP + 0.06, 0);
  group.add(beaconLight);

  // =========================================================================
  // 5. THE CABIN — a glazed room: sill band, 12 framed windows, transoms, an
  //    inner handrail, a bench ring, a LOFTED pinwheel roof over a lit ceiling
  // =========================================================================
  const cabin = new t.Group();
  group.add(cabin);
  const vehicle: THREE.Object3D = cabin;
  const STEP = (Math.PI * 2) / PANES;
  const cabinLight = new t.PointLight(0xffc97a, 0, 4, 2);
  cabinLight.position.set(0, 0.42, 0);
  cabin.add(cabinLight);
  {
    // --- floor: a RING (the old r 1.02 `cyl()` was a lid over the platform) --
    const floor: PartSpec[] = [];
    ringWall(R_DRUM + 0.03, R_DRUM - 0.01, 0.075, 0.0, floor, 40);
    ringTop(R_HOLE, R_DRUM + 0.03, 0.038, floor, 40);
    ringTop(R_HOLE, R_DRUM + 0.03, -0.038, floor, 40, true);
    cabin.add(mergedParts(t, floor, mat(t, RED, { tex: 'metal', repeat: [16, 1], metal: 0.3, rough: 0.6 })));
    // --- the sill band: 12 recessed panels between vertical pilasters, with a
    //     skirt below and a cill capping — a plain cylinder reads as a bucket
    const sillA: PartSpec[] = [];
    const sillB: PartSpec[] = [];
    const paneW = 2 * R_DRUM * Math.tan(STEP / 2);
    for (let i = 0; i < PANES; i += 1) {
      const a = i * STEP;
      slab([Math.cos(a) * R_DRUM, 0.19, Math.sin(a) * R_DRUM], [0.05, 0.26, paneW - 0.06], sillA, [0, -a, 0]);
      slab([Math.cos(a) * (R_DRUM - 0.03), 0.19, Math.sin(a) * (R_DRUM - 0.03)], [0.05, 0.17, paneW - 0.13], sillB, [0, -a, 0]);
      const am = a + STEP / 2;
      slab([Math.cos(am) * (R_DRUM + 0.015), 0.19, Math.sin(am) * (R_DRUM + 0.015)], [0.06, 0.28, 0.055], sillA, [0, -am, 0]);
    }
    ringWall(R_DRUM + 0.045, R_DRUM + 0.045, 0.045, Y_SILL - 0.02, sillA, 40); // cill
    ringWall(R_DRUM + 0.045, R_DRUM + 0.02, 0.05, 0.075, sillA, 40); // skirt
    cabin.add(mergedParts(t, sillA, mat(t, BLUE, { tex: 'plastic', repeat: [3, 2], rough: 0.45 }), false));
    cabin.add(mergedParts(t, sillB, mat(t, BLUE2, { tex: 'plastic', repeat: [2, 2], rough: 0.5 }), false));
    // --- 12 TALL WINDOWS in real frames: glass pane, a mullion each side, a
    //     head transom and a cill transom. The riders are visible through them.
    const glassParts: PartSpec[] = [];
    const frameParts: PartSpec[] = [];
    for (let i = 0; i < PANES; i += 1) {
      const a = i * STEP;
      slab([Math.cos(a) * R_DRUM, (Y_SILL + Y_HEAD) / 2, Math.sin(a) * R_DRUM], [0.016, Y_HEAD - Y_SILL, paneW - 0.09], glassParts, [0, -a, 0]);
      const am = a + STEP / 2;
      slab([Math.cos(am) * (R_DRUM + 0.012), (Y_SILL + Y_HEAD) / 2, Math.sin(am) * (R_DRUM + 0.012)], [0.055, Y_HEAD - Y_SILL + 0.02, 0.055], frameParts, [0, -am, 0]);
      slab([Math.cos(a) * (R_DRUM + 0.01), Y_SILL + 0.015, Math.sin(a) * (R_DRUM + 0.01)], [0.04, 0.03, paneW - 0.05], frameParts, [0, -a, 0]);
      slab([Math.cos(a) * (R_DRUM + 0.01), Y_HEAD - 0.015, Math.sin(a) * (R_DRUM + 0.01)], [0.04, 0.03, paneW - 0.05], frameParts, [0, -a, 0]);
    }
    const glassMat = mat(t, GLASS, { opacity: 0.34, rough: 0.12, metal: 0.15 });
    if (env) {
      glassMat.envMap = env;
      glassMat.envMapIntensity = 1.1;
    }
    glassMat.emissive = new t.Color(0xffd9a0);
    glassMat.emissiveIntensity = 0;
    const glassMesh = mergedParts(t, glassParts, glassMat, false);
    glassMesh.castShadow = false;
    cabin.add(glassMesh);
    cabin.add(mergedParts(t, frameParts, mat(t, CREAM, { metal: 0.2, rough: 0.5 }), false));
    // --- the head band above the glass (where the roof springs from) + gutter
    const head: PartSpec[] = [];
    ringWall(R_DRUM + 0.05, R_DRUM + 0.05, Y_ROOF0 - Y_HEAD + 0.02, (Y_HEAD + Y_ROOF0) / 2, head, 40);
    cabin.add(mergedParts(t, head, mat(t, BLUE, { tex: 'plastic', repeat: [3, 1], rough: 0.45 })));
    // --- inner handrail at the windows + a bench ring round the core, so the
    //     inside of the cabin is a ROOM and not an empty shell
    const fit: PartSpec[] = [];
    for (let i = 0; i < PANES; i += 1) {
      const a = i * STEP;
      const a1 = (i + 1) * STEP;
      const p: V3 = [Math.cos(a) * (R_DRUM - 0.1), Y_SILL + 0.02, Math.sin(a) * (R_DRUM - 0.1)];
      const q: V3 = [Math.cos(a1) * (R_DRUM - 0.1), Y_SILL + 0.02, Math.sin(a1) * (R_DRUM - 0.1)];
      seg(G_CYLR, p, q, 0.03, fit);
      seg(G_CYLR, [p[0], Y_SILL - 0.14, p[2]], p, 0.026, fit);
    }
    cabin.add(mergedParts(t, fit, shiny(GOLD, 0.85, 0.28), false));
    // the bench stops at r 0.50: the riders stand on the r 0.62 ring and their
    // legs would otherwise be INSIDE the seat plank
    const bench: PartSpec[] = [];
    ringWall(0.5, 0.5, 0.05, 0.2, bench, 28); // seat plank
    ringTop(0.44, 0.5, 0.225, bench, 28);
    ringWall(0.44, 0.44, 0.2, 0.1, bench, 28); // its pedestal
    cabin.add(mergedParts(t, bench, mat(t, 0x7a5a34, { tex: 'wood', repeat: [18, 1], rough: 0.82 })));
    // --- THE ROOF: 12 lofted pinwheel panels, red/cream, SAGGING between the
    //     ribs, over a cream ceiling. The overhang is 0.05 — not 0.10 — so the
    //     cabin below is visible from a park camera instead of being hidden.
    const rA: PartSpec[] = [];
    const rB: PartSpec[] = [];
    for (let i = 0; i < PANES; i += 1) {
      const a0 = i * STEP;
      (i % 2 ? rA : rB).push({ geo: panelLoft(a0, a0 + STEP, 0.07, R_EAVE, Y_ROOF1, Y_ROOF0, 0.04, 5, 5, 0.66), matrix: new t.Matrix4() });
    }
    const roofA = mergedParts(t, rA, shiny(RED, 0, 0.58, { two: true }));
    const roofB = mergedParts(t, rB, shiny(CREAM, 0, 0.6, { two: true }));
    roofA.castShadow = false; // or the whole cabin sits in its own shadow
    roofB.castShadow = false;
    cabin.add(roofA, roofB);
    const ceil: PartSpec[] = [];
    for (let i = 0; i < PANES; i += 1)
      ceil.push({ geo: panelLoft(i * STEP, (i + 1) * STEP, 0.09, R_EAVE - 0.06, Y_ROOF1 - 0.05, Y_ROOF0 - 0.04, 0.04, 4, 4, 0.66), matrix: new t.Matrix4() });
    const ceilMat = mat(t, 0xf6e8c8, { rough: 0.85 });
    ceilMat.side = t.DoubleSide;
    ceilMat.emissive = new t.Color(0xffc97a);
    ceilMat.emissiveIntensity = 0;
    const ceiling = mergedParts(t, ceil, ceilMat);
    ceiling.castShadow = false;
    cabin.add(ceiling);
    // roof ribs, each in 4 endpoint-placed pieces so they FOLLOW the curve
    const ribs: PartSpec[] = [];
    const ribPt = (a: number, u: number): V3 => {
      // stops 0.02 short of the eave: a rib laid AT R_EAVE puts its half-width
      // outside it, and R_EAVE is the whole footprint (2.1 x 2.1)
      const r = 0.07 + (R_EAVE - 0.09) * Math.pow(u, 0.66);
      return [Math.cos(a) * r, Y_ROOF1 + (Y_ROOF0 - Y_ROOF1) * u + 0.013, Math.sin(a) * r];
    };
    for (let i = 0; i < PANES; i += 1)
      for (let k = 0; k < 4; k += 1) seg(G_BOX, ribPt(i * STEP, k / 4), ribPt(i * STEP, (k + 1) / 4), 0.024, ribs, 0.016);
    cabin.add(mergedParts(t, ribs, shiny(GOLD, 0.85, 0.3), false));
    // eave fascia + gutter: the roof edge is a BAND, so it has a shadow line
    const eave: PartSpec[] = [];
    ringWall(R_EAVE, R_EAVE - 0.01, 0.055, Y_ROOF0 - 0.022, eave, 40);
    ringTop(R_EAVE - 0.055, R_EAVE, Y_ROOF0 - 0.05, eave, 40, true);
    cabin.add(mergedParts(t, eave, mat(t, CREAM, { rough: 0.6 })));
    cabin.add(gilt(ball(t, 0.062, GOLD, [0, Y_ROOF1 + 0.05, 0], { metal: 0.85, rough: 0.3 })));
    cabin.add(gilt(cyl(t, 0.014, 0.02, 0.16, GOLD, [0, Y_ROOF1 + 0.14, 0], { metal: 0.85, rough: 0.3, seg: 8 })));
    // --- bulb ring tucked under the eave: ONE merged emissive mesh
    const bulbs: PartSpec[] = [];
    for (let i = 0; i < 24; i += 1) {
      const a = (i / 24) * Math.PI * 2;
      bulbs.push({ geo: G_BULB, matrix: mtx(t, [Math.cos(a) * (R_EAVE - 0.05), Y_ROOF0 - 0.062, Math.sin(a) * (R_EAVE - 0.05)]) });
    }
    const bulbMat = new t.MeshStandardMaterial({ color: 0xfff3c0, emissive: 0xffcc55, emissiveIntensity: 0.12, roughness: 0.35 });
    const bulbMesh = mergedParts(t, bulbs, bulbMat, false);
    bulbMesh.castShadow = false;
    cabin.add(bulbMesh);
    // --- the cabin's DRIVE GEAR: a pinion housing on the rack, guide shoes on
    //     both rails and four outrigger arms into the floor ring. Without this
    //     the cabin is a drum floating past a mast.
    // Every one of these sits OUTBOARD of the fixed part it engages: the rack
    // teeth stop at x 0.335 and the housing starts at 0.345; the rail head is
    // x +/-0.05 and the shoe jaws straddle it at +/-0.085. The first pass put a
    // solid housing straight through the rack and a solid shoe through the rail
    // — invisible at rest and a mesh sawing through the mast on every climb.
    const drive: PartSpec[] = [];
    slab([0.42, 0.22, 0], [0.15, 0.3, 0.2], drive); // pinion housing
    drive.push({ geo: G_TOR, matrix: mtx(t, [0.35, 0.22, 0], [0, 0, Math.PI / 2], [0.17, 0.09, 0.17]) }); // the pinion
    [1, -1].forEach((s) => {
      slab([0, 0.22, s * 0.345], [0.24, 0.15, 0.05], drive); // shoe bridge
      [0.085, -0.085].forEach((dx) => slab([dx, 0.22, s * 0.27], [0.05, 0.15, 0.12], drive)); // jaws
      seg(G_BOX, [0, 0.22, s * 0.345], [0, 0.06, s * (R_DRUM - 0.1)], 0.06, drive, 0.05); // arm to the floor
    });
    for (let k = 0; k < 4; k += 1) {
      const a = Math.PI / 4 + (k * Math.PI) / 2;
      seg(G_BOX, [Math.cos(a) * (R_HOLE + 0.02), -0.02, Math.sin(a) * (R_HOLE + 0.02)], [Math.cos(a) * (R_DRUM - 0.04), -0.055, Math.sin(a) * (R_DRUM - 0.04)], 0.055, drive, 0.05);
    }
    cabin.add(mergedParts(t, drive, shiny(STEEL, 0.72, 0.32), false));

    // --- the 8 window spots. REAL GameManager guests ride the cabin at these
    //     anchors (seatWorld); decorative peeps fill every other spot on a
    //     standalone build. Radius, height and facing are UNCHANGED.
    for (let i = 0; i < 8; i += 1) {
      const a = (i / 8) * Math.PI * 2 + 0.4;
      const seat = new t.Group();
      seat.position.set(Math.cos(a) * 0.62, 0.055, Math.sin(a) * 0.62); // feet on the floor
      seat.rotation.y = Math.PI / 2 - a; // face radially OUT the window
      cabin.add(seat);
      seats.push(seat);
      if (withRiders && i % 2 === 0) {
        const p = buildPeep(t, {
          skin: SKIN_TONES[(i / 2) % SKIN_TONES.length],
          shirt: SHIRTS[(i / 2) % SHIRTS.length],
          female: h01(i * 5.1) > 0.5,
        });
        p.group.scale.setScalar(0.32);
        seat.add(p.group);
      }
    }

    SHARED.forEach((g) => g.dispose()); // every batch has copied what it needed

    // =======================================================================
    // 6. THE CYCLE — unchanged timing (up, then down, rotating for the view)
    // =======================================================================
    const raw = (time: number, motionK = 1) => {
      const nk = nightKOf(group);
      const ease = nk * nk * (3 - 2 * nk); // smoothstep
      const pulse = 0.5 + 0.5 * Math.sin(time * 3.0);
      beaconMat.emissiveIntensity = 0.15 + (0.4 + 1.4 * pulse - 0.15) * ease;
      beaconLight.intensity = ease * (0.25 + 0.8 * pulse);
      // THE GLASS GLOWS BECAUSE THE ROOM BEHIND IT IS LIT. Emissive alone was not
      // enough and the first night render proved it: a TRANSPARENT material's
      // emissive is scaled by its own alpha, so 0.34-opacity glass at emissive
      // 0.85 read as an unlit cabin. A lit window at dusk is also nearly opaque
      // — so the opacity comes UP with the night gate, and only then does the
      // twelve-window ring read from across a park.
      glassMat.emissiveIntensity = ease * 1.35; // 1.9 clipped to white-hot
      glassMat.opacity = 0.34 + 0.56 * ease;
      ceilMat.emissiveIntensity = ease * 0.6;
      bulbMat.emissiveIntensity = 0.12 + (1.15 - 0.12) * ease;
      cabinLight.intensity = ease * 0.9;
      const cyc = ((time - cycle0) * 0.18) % 1; // each departure restarts the climb
      const h = (cyc < 0.5 ? cyc * 2 : (1 - cyc) * 2) * motionK; // up then down
      cabin.position.y = Y_LOW + h * (Y_HIGH - Y_LOW);
      cabin.rotation.y = time * 0.4;
    };
    // station gate: cabin parked at the base while guests board/unload
    // (spinDown 0.9), the climb restarting from zero on every departure
    const gate = createMotionGate(raw, { spinDown: 0.9 });
    const onStateChange = (state: string) => {
      gate.onStateChange(state);
      if (state === 'departing') cycle0 = gate.clock();
    };
    raw(0, 0); // seat the rest pose before the first frame
    return { group, update: gate.update, vehicle, seatWorld: makeSeatWorld(three, seats), onStateChange };
  }
}

/** <ObservationTower> — composable ride (components/Park/Context.md): mounts the ride
 *  at `position`/`rotation`; inside a <Park>, `register` wires the full
 *  GameManager ride via <ConfigurableRide> — queue HEAD 1.5 out the local +z
 *  front (lane extending +z), exit hut beside it at local [-1.5, 1.35],
 *  boarding at the base. Capacity 8 = the 8 cabin window spots: REAL guests
 *  ride the cabin via `seatWorld` (decorative riders off when registered)
 *  and the cabin is motion-gated — parked at the base for boarding, climbing
 *  afresh each departure. Override with top-level props / `queue`. */
export const ObservationTower = composableRide<{ riders?: boolean }>(
  'ObservationTower',
  (t, props) => buildObservationTowerScene(t, { riders: props.riders ?? !(props as { register?: unknown }).register }),
  { defaults: { name: 'Observation Tower', capacity: 8, rideDuration: 10, intensity: 1, price: 2 } },
);

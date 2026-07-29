import React from 'react';
import * as THREE from 'three';
import { box, cyl, ball, mat, mergedBoxes, mergedParts, mtx, nightKOf } from '../Stage';
import { buildPeep, SKIN_TONES } from '../Guest';
import { createMotionGate, makeSeatWorld } from '../GameManager';
import { composableRide } from '../Park';

// ---------------------------------------------------------------------------
// Carousel — a REAL fairground merry-go-round, not a striped disc on a drum.
//
// WHAT WAS WRONG (reported fleet-wide: "set-pieces read as primitives stuck
// together rather than as the thing they depict"). The previous build was, part
// for part: three fat orange rings (a wedding cake), one plain tan disc, one
// plain brown cylinder with eight 0.1-wide gold strips glued on, a 16-wedge
// flat cone, a fat orange ring band with 18 balls round it, and eight horses
// each made of a 0.48 box + a 0.13 box + a 0.18 box + four 0.05 sticks. From
// mid-distance it read as a beach umbrella over a stool; at eye level the
// horses read as blocky grey dogs. Every part that should have been a SURFACE
// was a primitive, and every part that should have pointed somewhere was
// axis-aligned.
//
// WHAT IT IS NOW — the six things a carousel actually has, in the order they
// pay off visually:
//  1. a CENTRE DRUM (the mirror barrel): 16 alternating MIRROR and painted
//     panels in a two-band arrangement over a dado, separated by vertical gold
//     mouldings, capped top and bottom by cornices. The mirrors are real
//     reflections (metalness 1 / roughness 0.05 + a cached equirectangular
//     envMap), never an `emissive` fake — see `fairEnv()` below.
//  2. a CROWN and a CANOPY that is a LOFTED SURFACE, not a cone: 16 stripe
//     patches whose canvas SAGS between the sweeps (0.055 u at mid-radius,
//     zero on the ridges and at the rim), a bulb-lit inner ceiling under it,
//     and a scalloped hanging VALANCE with tassels round the rim.
//  3. SWEEPS — the 16 radial rods from the crown down to the rim, sitting on
//     the canvas ridges — and 6 brass POLES that line up with the horses
//     (same ring radius, so a pole passes through each horse's withers).
//  4. ROUNDING BOARDS: 16 upright decorated boards at the rim carrying two
//     bulb rows, a name band and a framed medallion each, with cresting along
//     the top rail.
//  5. six JUMPING HORSES in two poses (galloping / prancing) that read as
//     horses — chest, barrel, croup, two-segment legs with hooves, arched
//     neck, head with jaw, muzzle, ears, mane, flowing tail, saddle with
//     pommel and cantle, blanket, girth, stirrups, bridle and reins — plus a
//     two-seat CHARIOT with lofted swan-scroll sides for variety.
//  6. a PLATFORM of 24 radial planks in two tones with a decorated rim kerb,
//     a boarding stair with handrails at the front, and a stationary panelled
//     SKIRT below the platform hiding the machinery, ringed by a true step
//     (an OPEN-ENDED cylinder + a RingGeometry tread, so the step is a ring
//     and does not bury the skirt the way a solid disc did).
//
// HOW IT IS BUILT (the two rules that decide whether it reads as a thing):
//  * Anything that points somewhere is placed FROM ITS TWO ENDPOINTS via
//    `seg()` — quaternion from +Y onto (b−a), scaled to the run length. Legs,
//    necks, tails, sweeps, reins, handrails and mane plates all use it.
//    `rotX/rotY/rotZ` cannot express an arbitrary direction and reaching for
//    them is exactly what flattened the old horses.
//  * Anything curved is a SURFACE: `loft()` turns parameter curves into one
//    indexed BufferGeometry with real UVs and `computeVertexNormals()`. The
//    canopy, its ceiling, the valance and the chariot sides are all lofts.
//
// DRAW CALLS ARE THE BUDGET (SETUP.md §13: a single rig ≲ 300). Everything
// static in its own frame is merged: ~71 meshes total, of which 30 are merged
// batches standing in for ~700 loose parts. NO new real lights — the two warm
// centre PointLights are the ones this component always had, and all night
// reading comes from one merged emissive bulb mesh gated on `nightKOf(group)`.
// ---------------------------------------------------------------------------

/** local mirrors of Stage's batch specs (a second `import type` line from the
 *  same module tripped the design-system resolver) */
type PartSpec = { geo: THREE.BufferGeometry; matrix: THREE.Matrix4; uv?: [number, number] };
type BoxSpec = {
  dims: [number, number, number];
  pos?: [number, number, number];
  rotX?: number; rotY?: number; rotZ?: number;
  matrix?: THREE.Matrix4;
  repeat?: [number, number];
};

/** deterministic 0..1 — hashed, never Math.random, so a remount is identical */
const h01 = (n: number) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

// ---------------------------------------------------------------------------
// THE FAIRGROUND ENVIRONMENT — drawn once, cached, and it is what makes the
// barrel's mirror panels and the brass MIRRORS/BRASS instead of paint.
//
// A mirror is not a colour, it is whatever is around it, so faking one with
// `emissive` gives a flat glowing panel (the disco-ball lesson: it read as a
// beach ball). There is no scene-wide environment in this design system and a
// live CubeCamera is a whole extra render pass per frame, so this is a 256x128
// equirectangular CANVAS — sky, ground, a horizon band, a sun blob and a row of
// warm bulb spots at the height a carousel's own rim lights would sit. The
// panel normals sweep across it as the ride turns, which is a real reflection
// of a fake world rather than a fake reflection of a real one.
// ---------------------------------------------------------------------------
let _fairEnv: THREE.Texture | null = null;
function fairEnv(t: typeof THREE): THREE.Texture | null {
  if (_fairEnv) return _fairEnv;
  if (typeof document === 'undefined') return null; // SSR / node bundling
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 128;
  const x = c.getContext('2d');
  if (!x) return null;
  const sky = x.createLinearGradient(0, 0, 0, 66);
  sky.addColorStop(0, '#5e8fc4');
  sky.addColorStop(0.75, '#a8c6dd');
  sky.addColorStop(1, '#d8e2e6');
  x.fillStyle = sky;
  x.fillRect(0, 0, 256, 66);
  const gnd = x.createLinearGradient(0, 66, 0, 128);
  gnd.addColorStop(0, '#a08c62');   // the ride's own lit deck, not a dark lawn:
  gnd.addColorStop(1, '#5a5240');   // a dark band made every mirror read as paint
  x.fillStyle = gnd;
  x.fillRect(0, 66, 256, 62);
  x.fillStyle = '#cfd8d2';
  x.fillRect(0, 64, 256, 3);
  // the sun, then the ride's own bulb row reflected just above the horizon
  const spots: [number, number, number, number, string][] = [
    [72, 26, 16, 16, '#fffcee'],
    [200, 44, 7, 7, '#ffe6b0'],
  ];
  for (let i = 0; i < 22; i += 1) spots.push([6 + i * 11.6, 58, 4.2, 4.2, '#ffe6ad']);
  for (let i = 0; i < 11; i += 1) spots.push([12 + i * 23, 74, 5, 5, '#f6e2c0']);
  for (const [cx, cy, rx, ry, col] of spots) {
    const gr = x.createRadialGradient(cx, cy, 0, cx, cy, Math.max(rx, ry));
    gr.addColorStop(0, col);
    gr.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = gr;
    x.beginPath();
    x.arc(cx, cy, Math.max(rx, ry), 0, Math.PI * 2);
    x.fill();
  }
  const tex = new t.CanvasTexture(c);
  (tex as unknown as { mapping: number }).mapping = (t as unknown as { EquirectangularReflectionMapping: number }).EquirectangularReflectionMapping;
  (tex as unknown as { colorSpace: string }).colorSpace = (t as unknown as { SRGBColorSpace: string }).SRGBColorSpace;
  _fairEnv = tex;
  return tex;
}

export function buildCarouselScene(
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
  const withRiders = opts.riders ?? true; // decorative — off when registered so REAL guests take the saddles
  const seats: THREE.Group[] = []; // one anchor per rider place, in ANGULAR order (seatWorld)
  let vehicle: THREE.Object3D | undefined; // a horse — the RideViewer follow cam tracks it

  // ---- palette (RCT2 MGR1 sprite: orange/white canopy, green+gold frieze,
  //      tan deck, white horses with pink saddles) --------------------------
  const ORANGE = 0xe8641c;
  const CREAM = 0xdad4c8; // canopy white (sprite #d0d0d0)
  const BOARD = 0xe9dcbc; // rounding-board field — warmer than the canvas, so the
                          // boards read as painted timber and not as more canvas
  const RED = 0xa8281c;   // name band, deck kerb, barrel field
  const GREEN = 0x3d5c2a; // stationary skirt, barrel dado
  const GOLD = 0xd8b040;
  const BRASS = 0xc8a83e;
  const TAN = 0x9a8456;   // deck plank tone A (sprite #605030 lit)
  const TAN2 = 0x836d45;  // deck plank tone B
  const STONE = 0xb5ab99;
  const HIDE = [0xf7f4ee, 0xeee2ca]; // white / cream horses (the first pass at
                                     // 0xf0ece4 read mid-GREY in the canopy's
                                     // ambient — a carousel horse is WHITE)
  const DARK = 0x413830;  // manes, tails, hooves, straps, seams
  const TACK = [0xc23a80, 0x33689e, 0x487f4c]; // pink / blue / green saddles (the
                                              // first pass' full-chroma versions
                                              // read as plastic at eye level)

  // ---- the dimension table (every number below is derived from these, so the
  //      stack cannot drift apart into coplanar seams) --------------------
  const R_OUT = 1.86;    // ground apron — UNCHANGED, this is the registered footprint
  const R_STEP = 1.80;   // the ring step round the base
  const R_SKIRT = 1.54;  // stationary panelled skirt
  const R_DECK = 1.62;   // rotating platform
  const R_KERB = 1.66;   // platform rim kerb (overhangs the skirt by 0.12)
  const R_DRUM = 0.42;   // centre barrel
  const R_HORSE = 1.26;  // the horse/pole ring (0.99 of arc per station)
  const R_BOARD = 1.79;  // rounding boards
  // THE EAVE LANDS ON THE BOARD LINE, it does not overhang it. The first render
  // of this rebuild put R_CAP at 1.82, outboard of the 1.79 boards, so the top
  // rail and the cresting spikes came up THROUGH the canvas and the whole rim
  // read as a dark scalloped smear from above. Canvas edge == board centreline is
  // also the real construction: boards outside the canvas, cresting on their rail.
  const R_CAP = 1.79;    // canopy eave (== R_BOARD; inside R_OUT, footprint unchanged)
  const R_APEX = 0.10;
  const Y_APRON = 0.07;
  const Y_TREAD = 0.20;  // the step you stand on
  const Y_DECK = 0.55;   // platform top
  const Y_VAL = 1.86;    // valance hangs from here
  const Y_B0 = 1.88;     // rounding boards bottom
  // the boards' top IS the canopy springing line, so the canvas edge and the
  // board rail meet instead of leaving a slot to see the sky through
  const Y_B1 = 2.10;     // rounding boards top / canopy springing
  const Y_RIM = 2.10;    // canopy canvas at the eave
  const Y_APEX = 2.66;
  const SEGS = 16;       // canopy stripes = sweeps = valance scallops = boards
  const STEP = (Math.PI * 2) / SEGS;
  const SAG = 0.055;     // how far the canvas sags between two sweeps

  // ---- shared unit geometries: one each, reused at hundreds of matrices and
  //      disposed at the end (mergedParts reads, never mutates, its sources) --
  const G_BOX = new t.BoxGeometry(1, 1, 1);
  const G_CYL = new t.CylinderGeometry(0.5, 0.5, 1, 8);   // +Y run, diameter 1
  const G_CYLR = new t.CylinderGeometry(0.5, 0.5, 1, 14); // rounder, for poles/bosses
  const G_TAP = new t.CylinderGeometry(0.3, 0.5, 1, 8);   // tapered limb / neck
  const G_SPH = new t.SphereGeometry(0.5, 12, 8);         // ellipsoid masses
  const G_CONE = new t.ConeGeometry(0.5, 1, 6);           // ears, tassels, cresting
  const G_BULB = new t.IcosahedronGeometry(0.032, 1);
  const SHARED = [G_BOX, G_CYL, G_CYLR, G_TAP, G_SPH, G_CONE, G_BULB];

  // ---- placement helpers ---------------------------------------------------
  const YA = new t.Vector3(0, 1, 0);
  const _d = new t.Vector3();
  const _mid = new t.Vector3();
  const _q = new t.Quaternion();
  /** a +Y unit geometry laid FROM a TO b, cross-section w x (w2 ?? w). This is
   *  the only way to point a part at an arbitrary direction — rotX/rotY/rotZ
   *  cannot express one, and the old horses' legs prove what happens when you
   *  try (they came out as four parallel sticks). */
  const seg = (
    geo: THREE.BufferGeometry,
    a: [number, number, number],
    b: [number, number, number],
    w: number,
    into: PartSpec[],
    w2?: number,
  ) => {
    _d.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    const len = _d.length();
    if (len < 1e-5) return;
    _mid.set((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2);
    _q.setFromUnitVectors(YA, _d.normalize());
    into.push({ geo, matrix: new t.Matrix4().compose(_mid.clone(), _q.clone(), new t.Vector3(w, len, w2 ?? w)) });
  };
  /** an ellipsoid of FULL extents `dims` (G_SPH has diameter 1) */
  const blob = (
    pos: [number, number, number], dims: [number, number, number], into: PartSpec[],
    rot: [number, number, number] = [0, 0, 0],
  ) => into.push({ geo: G_SPH, matrix: mtx(t, pos, rot, dims) });
  /** a unit box scaled to `dims` — for parts that live in a batch of mixed geometry */
  const slab = (
    pos: [number, number, number], dims: [number, number, number], into: PartSpec[],
    rot: [number, number, number] = [0, 0, 0],
  ) => into.push({ geo: G_BOX, matrix: mtx(t, pos, rot, dims) });
  /** quads between consecutive rows → ONE indexed geometry with real UVs.
   *  A curved surface has to BE a surface: the old canopy was 16 cone wedges
   *  and read as a beach umbrella because a cone has no sag, no scallop and no
   *  eave. */
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
  const I4 = () => new t.Matrix4();
  /** A TRUE RING (open-ended cylinder wall, optionally tapered), as a PartSpec.
   *  `cyl()` builds SOLID discs and a solid disc used as a band is a horizontal
   *  LID across everything inside it. That single mistake cost two whole reads in
   *  the first pass of this rebuild: the deck kerb's top face (r 1.66, y 0.56)
   *  covered the radial planking so the platform rendered as a plain red disc,
   *  and the five rim rings (name band, two beadings, top and bottom rail, all
   *  r ~1.82) stacked five horizontal discs in the air over the horses' heads so
   *  the inside of the top read as a flat lid instead of a canopy. Rings are
   *  rings now, and they merge by material into one draw each. */
  const ringWall = (rTop: number, rBot: number, h: number, y: number, into: PartSpec[], sg = 48) =>
    into.push({ geo: new t.CylinderGeometry(rTop, rBot, h, sg, 1, true), matrix: mtx(t, [0, y, 0]) });
  /** the flat annulus that caps a ringWall (normals up) */
  const ringTop = (rIn: number, rOut: number, y: number, into: PartSpec[], sg = 48) =>
    into.push({ geo: new t.RingGeometry(rIn, rOut, sg), matrix: mtx(t, [0, y, 0], [-Math.PI / 2, 0, 0]) });
  /** shadow-off: the canopy stack must not shade the horses it covers, or the
   *  whole deck goes flat in daylight (this was already true of the old cone) */
  const noShade = <M extends THREE.Object3D>(m: M) => {
    m.castShadow = false;
    return m;
  };

  /** the canopy ceiling's material — held here so the night gate can raise its
   *  emissive without hunting through the scene graph every frame */
  let ceilMat: THREE.MeshStandardMaterial | null = null;

  const env = fairEnv(t);
  /** a polished material that REFLECTS (mirror glass, brass) rather than glows */
  const shiny = (color: number, metal: number, rough: number) => {
    const m = mat(t, color, { metal, rough });
    if (env) {
      m.envMap = env;
      m.envMapIntensity = metal > 0.9 ? 1.25 : 0.9;
    }
    return m;
  };
  /** METALNESS WITHOUT AN ENVMAP IS GREY PAINT, NOT METAL. three.js feeds a
   *  metal's colour entirely from its reflections, so the first render of this
   *  rebuild came back with every gold rail, pilaster and stud reading as dull
   *  grey — the gold had nothing to reflect. Anything metallic built through the
   *  `cyl`/`box`/`ball`/`mergedBoxes` helpers gets the environment attached
   *  here; anything built through `mergedParts` gets `shiny()` directly. */
  const gilt = <M extends THREE.Mesh>(m: M, i = 0.9) => {
    const mm = m.material as THREE.MeshStandardMaterial;
    if (env) {
      mm.envMap = env;
      mm.envMapIntensity = i;
    }
    return m;
  };

  // =========================================================================
  // 1. THE STATIONARY BASE — apron, ring step, panelled skirt, boarding stair
  // =========================================================================
  // ground apron: the ride's footing, and the outermost thing in the group —
  // R_OUT is what ConfigurableRide measures for the body blocker and the hut
  // clearance, so it is deliberately the SAME 1.86 the old three-ring base had.
  group.add(cyl(t, R_OUT - 0.04, R_OUT, Y_APRON, STONE, [0, Y_APRON / 2, 0], { tex: 'concrete', rough: 0.95, seg: 40 }));

  // THE RING STEP. The old base was three solid discs of r 1.78/1.68/1.60 —
  // a wedding cake, and a solid disc also BURIES whatever stands inside it, so
  // there was nowhere for a skirt to be seen. This is a true ring: an
  // OPEN-ENDED cylinder for the riser plus a RingGeometry tread, so the skirt
  // behind it stays visible from y 0.20 up.
  {
    const st: PartSpec[] = [
      { geo: new t.CylinderGeometry(R_STEP, R_STEP, Y_TREAD - Y_APRON, 44, 1, true), matrix: mtx(t, [0, (Y_TREAD + Y_APRON) / 2, 0]) },
      { geo: new t.RingGeometry(R_SKIRT - 0.02, R_STEP, 44), matrix: mtx(t, [0, Y_TREAD, 0], [-Math.PI / 2, 0, 0]) },
    ];
    group.add(mergedParts(t, st, mat(t, STONE, { tex: 'concrete', rough: 0.95 })));
    // a nosing lip in ride colours, overhanging the riser by 0.045
    const nose: PartSpec[] = [
      { geo: new t.CylinderGeometry(R_STEP + 0.045, R_STEP + 0.045, 0.04, 44, 1, true), matrix: mtx(t, [0, Y_TREAD - 0.02, 0]) },
      { geo: new t.RingGeometry(R_STEP, R_STEP + 0.045, 44), matrix: mtx(t, [0, Y_TREAD, 0], [-Math.PI / 2, 0, 0]) },
    ];
    group.add(mergedParts(t, nose, mat(t, RED, { rough: 0.6 })));
  }

  // THE SKIRT — the stationary panelled ring that hides the machinery. Green
  // drum, 28 recessed cream panels, 28 gold pilasters between them, a cornice
  // at the top. Visible band is y 0.20 (step tread) .. 0.47 (platform
  // underside); the panels sit inside that band so nothing is half-buried.
  group.add(cyl(t, R_SKIRT, R_SKIRT, Y_DECK - 0.08 - Y_APRON, GREEN, [0, (Y_DECK - 0.08 + Y_APRON) / 2, 0], {
    tex: 'wood', repeat: [10, 1], rough: 0.8, seg: 32,
  }));
  {
    const NP = 28;
    const panels: BoxSpec[] = [];
    const pil: BoxSpec[] = [];
    for (let i = 0; i < NP; i += 1) {
      const a = (i / NP) * Math.PI * 2;
      const c = Math.cos(a);
      const s = Math.sin(a);
      // width tangential / thickness radial: rotY = PI/2 - a
      panels.push({ dims: [0.21, 0.17, 0.02], pos: [c * (R_SKIRT + 0.008), 0.335, s * (R_SKIRT + 0.008)], rotY: Math.PI / 2 - a });
      pil.push({ dims: [0.035, 0.26, 0.035], pos: [c * (R_SKIRT + 0.014), 0.335, s * (R_SKIRT + 0.014)], rotY: Math.PI / 2 - a });
    }
    group.add(mergedBoxes(t, panels, CREAM, { rough: 0.7 }));
    group.add(gilt(mergedBoxes(t, pil, GOLD, { metal: 0.55, rough: 0.35 })));
  }
  group.add(gilt(cyl(t, R_SKIRT + 0.05, R_SKIRT + 0.02, 0.05, GOLD, [0, Y_DECK - 0.10, 0], { metal: 0.55, rough: 0.35, seg: 32 })));

  // THE BOARDING STAIR at the local +z front (where ConfigurableRide puts the
  // queue head and the boarding point), with handrails — two treads bridging
  // the 0.35 from the ring step to the platform. A ring step all round plus a
  // stair at ONE point is how a real carousel is entered.
  {
    const st: BoxSpec[] = [
      { dims: [1.12, 0.12, 0.15], pos: [0, 0.26, R_STEP - 0.10] },
      { dims: [1.12, 0.24, 0.15], pos: [0, 0.32, R_STEP - 0.25] },
    ];
    group.add(mergedBoxes(t, st, STONE, { tex: 'concrete', rough: 0.95 }));
    const rail: PartSpec[] = [];
    [-1, 1].forEach((sd) => {
      const px = sd * 0.60;
      // the posts STAND ON the step tread (y 0.20) and the rail runs all the way
      // in to the platform kerb: the first render started them at 0.32 and ended
      // the rail short, so the whole thing read as a gold staple in mid-air
      seg(G_CYLR, [px, Y_TREAD, R_STEP - 0.07], [px, 0.94, R_STEP - 0.07], 0.045, rail);
      seg(G_CYLR, [px, 0.9, R_STEP - 0.03], [px, 1.0, R_KERB - 0.02], 0.038, rail);
      seg(G_CYLR, [px, 0.6, R_STEP - 0.05], [px, 0.7, R_KERB - 0.02], 0.028, rail);
      blob([px, 0.965, R_STEP - 0.07], [0.09, 0.09, 0.09], rail);                          // ball finial
    });
    group.add(mergedParts(t, rail, shiny(BRASS, 0.8, 0.25), false));
  }

  // =========================================================================
  // 2. THE ROTATING RIDE — platform, barrel, canopy, boards, horses
  // =========================================================================
  const ride = new t.Group();
  group.add(ride);

  // ---- the PLATFORM: 24 radial planks in two tones ------------------------
  // The old deck was one plain tan disc. Real platform decking is radial, and
  // at the 35-degree park view the deck is most of what you see, so the two
  // alternating tones are doing real work. 24 partial cylinders merged into two
  // meshes by tone, with dark seam strips laid along the joints.
  {
    const NPL = 24;
    const wedge: PartSpec[][] = [[], []];
    const seams: BoxSpec[] = [];
    for (let i = 0; i < NPL; i += 1) {
      const a0 = (i / NPL) * Math.PI * 2;
      const span = (Math.PI * 2) / NPL;
      wedge[i % 2].push({
        geo: new t.CylinderGeometry(R_DECK, R_DECK, 0.08, 3, 1, false, a0, span),
        matrix: mtx(t, [0, Y_DECK - 0.04, 0]),
      });
      seams.push({ dims: [R_DECK - 0.3, 0.014, 0.022], pos: [Math.cos(a0) * (R_DECK + 0.3) / 2, Y_DECK + 0.004, Math.sin(a0) * (R_DECK + 0.3) / 2], rotY: -a0 });
    }
    wedge.forEach((parts, i) =>
      ride.add(mergedParts(t, parts, mat(t, i ? TAN2 : TAN, { tex: 'wood', repeat: [3, 3], rough: 0.88 }))),
    );
    ride.add(mergedBoxes(t, seams, DARK, { rough: 0.9 }));
  }
  // rim kerb: a painted band with gold studs, standing 0.025 proud of the planks
  // — a RING (see ringWall), not the solid disc that first hid the planking
  {
    const kerb: PartSpec[] = [];
    ringWall(R_KERB, R_KERB - 0.02, 0.15, Y_DECK - 0.05, kerb, 44);
    ringTop(R_DECK - 0.02, R_KERB, Y_DECK + 0.025, kerb, 44);
    ride.add(mergedParts(t, kerb, mat(t, RED, { tex: 'plastic', repeat: [16, 1], rough: 0.6 })));
  }
  {
    const studs: PartSpec[] = [];
    for (let i = 0; i < 32; i += 1) {
      const a = (i / 32) * Math.PI * 2;
      blob([Math.cos(a) * (R_KERB + 0.005), Y_DECK - 0.04, Math.sin(a) * (R_KERB + 0.005)], [0.05, 0.05, 0.05], studs);
    }
    ride.add(mergedParts(t, studs, shiny(GOLD, 0.7, 0.3), false));
  }
  {
    const collar: PartSpec[] = [];
    ringWall(R_DRUM + 0.18, R_DRUM + 0.22, 0.06, Y_DECK + 0.015, collar, 28);
    ringTop(R_DRUM + 0.1, R_DRUM + 0.18, Y_DECK + 0.045, collar, 28);
    ride.add(mergedParts(t, collar, shiny(GOLD, 0.6, 0.32)));
  }

  // ---- the CENTRE DRUM (mirror barrel) ------------------------------------
  // Was: one 0.34-radius brown cylinder with eight 0.1 x 0.5 gold strips. A
  // mirror barrel is a PANELLED cabinet: two bands of panels over a dado,
  // alternating mirror glass and painted boards, divided by vertical carved
  // mouldings and closed by cornices top and bottom.
  ride.add(cyl(t, R_DRUM, R_DRUM, Y_B0 - Y_DECK, RED, [0, (Y_B0 + Y_DECK) / 2, 0], { tex: 'wood', repeat: [8, 3], rough: 0.75, seg: 24 }));
  {
    const NB = 16;
    const mirror: BoxSpec[] = [];
    const painted: BoxSpec[] = [];
    const dado: BoxSpec[] = [];
    const mould: BoxSpec[] = [];
    const medal: PartSpec[] = [];
    for (let i = 0; i < NB; i += 1) {
      const a = (i / NB) * Math.PI * 2;
      const c = Math.cos(a);
      const s = Math.sin(a);
      const rot = Math.PI / 2 - a;
      const p: [number, number, number] = [c * (R_DRUM + 0.012), 1.45, s * (R_DRUM + 0.012)];
      (i % 2 ? painted : mirror).push({ dims: [0.148, 0.68, 0.018], pos: p, rotY: rot });
      if (i % 2) {
        // the painted panels carry a framed medallion — a fairground barrel is
        // never a flat colour between its mouldings
        medal.push({ geo: G_CYLR, matrix: mtx(t, [c * (R_DRUM + 0.026), 1.45, s * (R_DRUM + 0.026)], [Math.PI / 2 - a, Math.PI / 2, 0], [0.1, 0.012, 0.1]) });
      }
      dado.push({ dims: [0.148, 0.30, 0.018], pos: [c * (R_DRUM + 0.012), 0.86, s * (R_DRUM + 0.012)], rotY: rot });
      // mouldings straddle the panel joints (half a step off)
      const am = a + Math.PI / NB;
      mould.push({ dims: [0.032, Y_B0 - Y_DECK - 0.14, 0.04], pos: [Math.cos(am) * (R_DRUM + 0.018), (Y_B0 + Y_DECK) / 2, Math.sin(am) * (R_DRUM + 0.018)], rotY: Math.PI / 2 - am });
    }
    // MIRROR GLASS — metalness 1 / roughness 0.05 + envMap. Never `emissive`:
    // an emissive panel is a glowing rectangle, not a reflection.
    ride.add(mergedParts(t, mirror.map((p) => ({ geo: G_BOX, matrix: mtx(t, p.pos as [number, number, number], [0, p.rotY as number, 0], p.dims) })), shiny(0xdfe6ea, 1, 0.05), false));
    ride.add(mergedBoxes(t, painted, RED, { tex: 'plastic', rough: 0.7 }));
    ride.add(mergedBoxes(t, dado, GREEN, { rough: 0.75 }));
    ride.add(gilt(mergedBoxes(t, mould, GOLD, { metal: 0.55, rough: 0.35 })));
    ride.add(mergedParts(t, medal, mat(t, 0xf0e4c6, { rough: 0.6 }), false));
  }
  ride.add(gilt(cyl(t, R_DRUM + 0.09, R_DRUM + 0.04, 0.07, GOLD, [0, Y_B0 - 0.035, 0], { metal: 0.55, rough: 0.35, seg: 24 }))); // top cornice
  ride.add(gilt(cyl(t, R_DRUM + 0.04, R_DRUM + 0.09, 0.08, GOLD, [0, Y_DECK + 0.04, 0], { metal: 0.55, rough: 0.35, seg: 24 }))); // plinth
  ride.add(gilt(cyl(t, R_DRUM + 0.03, R_DRUM + 0.03, 0.05, GOLD, [0, 1.06, 0], { metal: 0.55, rough: 0.35, seg: 24 })));          // mid rail
  // KING POLE, from inside the barrel up to the crown
  ride.add(gilt(cyl(t, 0.075, 0.075, Y_APEX - 1.4, BRASS, [0, (Y_APEX + 1.4) / 2, 0], { tex: 'metal', metal: 0.8, rough: 0.25, seg: 12 })));

  // ---- the CANOPY: 16 lofted stripe patches that SAG between the sweeps ----
  /** a point on the canvas: u = 0 apex .. 1 eave, s = 0..1 across one stripe */
  const capPt = (u: number, s: number, a0: number, dy = 0) => {
    const r = R_APEX + (R_CAP - R_APEX) * u;
    const a = a0 + STEP * s;
    // pow(u, 0.75): steep off the crown, flattening to the eave — a carousel
    // top is not a straight cone, and the old straight cone is why it read as
    // an umbrella. The sag term is the canvas hanging between two sweeps.
    const y =
      Y_APEX - (Y_APEX - Y_RIM) * Math.pow(u, 0.75)
      - SAG * Math.sin(Math.PI * s) * Math.sin(Math.PI * Math.pow(u, 0.85))
      + dy;
    return new t.Vector3(Math.cos(a) * r, y, Math.sin(a) * r);
  };
  {
    const NR = 9;
    const stripe: PartSpec[][] = [[], []];
    for (let i = 0; i < SEGS; i += 1) {
      const a0 = i * STEP;
      const rows: THREE.Vector3[][] = [];
      for (let ri = 0; ri <= NR; ri += 1) {
        const row: THREE.Vector3[] = [];
        for (let ci = 0; ci <= 4; ci += 1) row.push(capPt(ri / NR, ci / 4, a0));
        rows.push(row);
      }
      stripe[i % 2].push({ geo: loft(rows, [1, 2]), matrix: I4() });
    }
    stripe.forEach((parts, i) => {
      const m = mat(t, i ? ORANGE : CREAM, { tex: 'fabric', repeat: [2, 3], rough: 0.72 });
      m.side = t.DoubleSide; // the eave overhangs the boards — its underside is in shot
      ride.add(noShade(mergedParts(t, parts, m)));
    });
    // the INNER CEILING, one closed lofted surface 0.04 under the canvas, warm
    // and gated on night: a carousel's ceiling is lit by its own bulb rows, and
    // without it the eye-level view looks up into a black canvas underside.
    const crows: THREE.Vector3[][] = [];
    const NAZ = 64;
    for (let ri = 0; ri <= 8; ri += 1) {
      const u = 0.03 + (ri / 8) * 0.985;   // past the eave, so it tucks behind the boards
      const row: THREE.Vector3[] = [];
      for (let j = 0; j <= NAZ; j += 1) {
        const f = (j / NAZ) * SEGS;
        row.push(capPt(u, f - Math.floor(f), Math.floor(f) * STEP, -0.06));
      }
      crows.push(row);
    }
    ceilMat = mat(t, 0xf2e6cd, { rough: 0.85, emissive: 0xffcf88 });
    ceilMat.side = t.DoubleSide;
    // it faces DOWN, so no daylight ever reaches it: without a floor of glow the
    // inside of the top renders as a black cone at eye level
    ceilMat.emissiveIntensity = 0.12;
    const ceiling = noShade(new t.Mesh(loft(crows, [8, 1]), ceilMat));
    ceiling.receiveShadow = false;
    ride.add(ceiling);
  }
  // SWEEPS — the radial rods from the crown to the eave, riding the stripe
  // ridges (s = 0, where the sag is zero) so they sit ON the canvas rather
  // than through it. Placed from endpoints in 5 pieces each so they FOLLOW the
  // profile curve; a single rotZ'd cylinder would chord straight through it.
  {
    const sw: PartSpec[] = [];
    for (let i = 0; i < SEGS; i += 1) {
      const a0 = i * STEP;
      for (let k = 0; k < 5; k += 1) {
        const p0 = capPt(0.08 + (k / 5) * 0.92, 0, a0, 0.045);
        const p1 = capPt(0.08 + ((k + 1) / 5) * 0.92, 0, a0, 0.045);
        seg(G_CYL, [p0.x, p0.y, p0.z], [p1.x, p1.y, p1.z], 0.034, sw);
      }
    }
    ride.add(noShade(mergedParts(t, sw, shiny(BRASS, 0.8, 0.25), false)));
  }

  // ---- ROUNDING BOARDS: the decorated wall at the rim ---------------------
  // Was: a fat orange cylinder band with 18 balls stuck round it, which read as
  // a ring of berries. Real rounding boards are upright panels carrying the
  // bulb rows, a name band and a medallion each, capped by cresting.
  {
    const field: BoxSpec[] = [];
    const frame: BoxSpec[] = [];
    const medal: PartSpec[] = [];
    const crest: PartSpec[] = [];
    const chord = 2 * R_BOARD * Math.sin(STEP / 2) + 0.02; // +0.02 so joints never gap
    for (let i = 0; i < SEGS; i += 1) {
      const a = (i + 0.5) * STEP;
      const c = Math.cos(a);
      const s = Math.sin(a);
      const rot = Math.PI / 2 - a;
      field.push({ dims: [chord, Y_B1 - Y_B0 - 0.04, 0.03], pos: [c * R_BOARD, (Y_B0 + Y_B1) / 2, s * R_BOARD], rotY: rot });
      // divider pilaster on each joint
      const aj = i * STEP;
      frame.push({ dims: [0.04, Y_B1 - Y_B0, 0.05], pos: [Math.cos(aj) * (R_BOARD + 0.012), (Y_B0 + Y_B1) / 2, Math.sin(aj) * (R_BOARD + 0.012)], rotY: Math.PI / 2 - aj });
      medal.push({ geo: G_CYLR, matrix: mtx(t, [c * (R_BOARD + 0.022), Y_B1 - 0.085, s * (R_BOARD + 0.022)], [rot, Math.PI / 2, 0], [0.11, 0.012, 0.11]) });
      // cresting: little gold spikes along the top rail, two per board
      [-0.22, 0.22].forEach((o) => {
        const ac = a + o * STEP;
        crest.push({ geo: G_CONE, matrix: mtx(t, [Math.cos(ac) * (R_BOARD + 0.018), Y_B1 + 0.055, Math.sin(ac) * (R_BOARD + 0.018)], [0, 0, 0], [0.075, 0.12, 0.075]) });
      });
    }
    ride.add(noShade(mergedBoxes(t, field, BOARD, { tex: 'plastic', rough: 0.65 })));
    ride.add(noShade(gilt(mergedBoxes(t, frame, GOLD, { metal: 0.55, rough: 0.35 }))));
    ride.add(noShade(mergedParts(t, medal, mat(t, ORANGE, { rough: 0.6 }), false)));
    ride.add(noShade(mergedParts(t, crest, shiny(GOLD, 0.7, 0.3), false)));
    // the NAME BAND across the lower half of the boards, and the four gold
    // rails/beadings. ALL FIVE ARE RINGS: as solid `cyl` discs of r ~1.82 they
    // stacked five horizontal lids in the air over the horses (see ringWall).
    const nameB: PartSpec[] = [];
    ringWall(R_BOARD + 0.024, R_BOARD + 0.024, 0.095, Y_B0 + 0.085, nameB);
    ride.add(noShade(mergedParts(t, nameB, mat(t, RED, { tex: 'plastic', repeat: [24, 1], rough: 0.55 }))));
    const rails: PartSpec[] = [];
    ringWall(R_BOARD + 0.032, R_BOARD + 0.032, 0.03, Y_B0 + 0.14, rails);   // beading over the band
    ringWall(R_BOARD + 0.032, R_BOARD + 0.032, 0.03, Y_B0 + 0.03, rails);   // beading under it
    ringWall(R_BOARD + 0.05, R_BOARD + 0.02, 0.055, Y_B1 - 0.018, rails);   // top rail (flared out)
    ringTop(R_BOARD - 0.01, R_BOARD + 0.05, Y_B1 + 0.01, rails);            // ...capped FLUSH with the canvas edge
    ringWall(R_BOARD + 0.02, R_BOARD + 0.05, 0.055, Y_B0 - 0.008, rails);   // bottom rail (flared out)
    ride.add(noShade(mergedParts(t, rails, shiny(GOLD, 0.6, 0.3))));
  }

  // ---- the VALANCE: the scalloped canvas skirt round the rim --------------
  // Every fairground top has one and it is the single most recognisable part of
  // the silhouette. 16 lofted panels: top edge level, bottom edge dipping
  // 0.19 at mid-scallop and pinching to a point under each sweep, flaring
  // 0.02 outward as it falls. Tassel at every low point.
  {
    const val: PartSpec[][] = [[], []];
    const tass: PartSpec[] = [];
    for (let i = 0; i < SEGS; i += 1) {
      const a0 = i * STEP;
      const top: THREE.Vector3[] = [];
      const bot: THREE.Vector3[] = [];
      for (let j = 0; j <= 6; j += 1) {
        const s = j / 6;
        const a = a0 + STEP * s;
        const dip = 0.19 * Math.sin(Math.PI * s);
        // OUTBOARD of the boards' face (1.805) so the scallops hang clear of the
        // bottom rail instead of half-vanishing into it
        top.push(new t.Vector3(Math.cos(a) * (R_BOARD + 0.014), Y_VAL, Math.sin(a) * (R_BOARD + 0.014)));
        bot.push(new t.Vector3(Math.cos(a) * (R_BOARD + 0.038), Y_VAL - 0.03 - dip, Math.sin(a) * (R_BOARD + 0.038)));
      }
      val[i % 2].push({ geo: loft([top, bot], [2, 1]), matrix: I4() });
      const am = a0 + STEP / 2;
      tass.push({ geo: G_CONE, matrix: mtx(t, [Math.cos(am) * (R_BOARD + 0.038), Y_VAL - 0.25, Math.sin(am) * (R_BOARD + 0.038)], [Math.PI, 0, 0], [0.055, 0.09, 0.055]) });
    }
    // opposite phase to the canopy stripe above it, so the valance CONTRASTS
    // with the canvas instead of vanishing into it
    val.forEach((parts, i) => {
      const m = mat(t, i ? CREAM : ORANGE, { tex: 'fabric', repeat: [2, 1], rough: 0.75 });
      m.side = t.DoubleSide;
      ride.add(noShade(mergedParts(t, parts, m)));
    });
    ride.add(noShade(mergedParts(t, tass, shiny(GOLD, 0.7, 0.3), false)));
  }

  // ---- the CROWN ----------------------------------------------------------
  ride.add(gilt(cyl(t, 0.20, 0.24, 0.13, GOLD, [0, Y_APEX + 0.03, 0], { metal: 0.6, rough: 0.32, seg: 20 })));
  {
    const cr: PartSpec[] = [];
    for (let i = 0; i < 8; i += 1) {
      const a = (i / 8) * Math.PI * 2;
      // scroll leaves round the crown drum, each leaning out from the pole
      seg(G_TAP, [Math.cos(a) * 0.13, Y_APEX + 0.09, Math.sin(a) * 0.13], [Math.cos(a) * 0.30, Y_APEX + 0.20, Math.sin(a) * 0.30], 0.055, cr);
    }
    ride.add(noShade(mergedParts(t, cr, shiny(GOLD, 0.7, 0.3), false)));
  }
  ride.add(noShade(gilt(cyl(t, 0.026, 0.026, 0.34, GOLD, [0, Y_APEX + 0.26, 0], { metal: 0.7, rough: 0.3, seg: 8 }))));
  ride.add(noShade(gilt(ball(t, 0.085, GOLD, [0, Y_APEX + 0.45, 0], { metal: 0.7, rough: 0.3 }))));
  // a pennant, so the top is not just a lollipop
  ride.add(noShade(box(t, [0.005, 0.11, 0.22], RED, [0, Y_APEX + 0.37, 0.11], { rough: 0.8 })));

  // ---- the BULB ROWS (night) ----------------------------------------------
  // ONE merged mesh sharing ONE material, whose emissiveIntensity is the night
  // gate — 60 bulbs for 1 draw call, and no new real lights (SETUP.md §13).
  const bulbMat = new t.MeshStandardMaterial({ color: 0xfff3c0, emissive: 0xffcc55, emissiveIntensity: 0.15, roughness: 0.35 });
  {
    const bulbs: PartSpec[] = [];
    for (let i = 0; i < 24; i += 1) {
      const a = ((i + 0.5) / 24) * Math.PI * 2;
      // r 1.82 keeps bulb + radius inside the 1.86 footprint; the rows sit just
      // clear of the rails they hang under / stand on rather than inside them
      const c = Math.cos(a) * (R_BOARD + 0.03);
      const s = Math.sin(a) * (R_BOARD + 0.03);
      bulbs.push({ geo: G_BULB, matrix: mtx(t, [c, Y_B0 - 0.055, s]) });   // under the bottom rail
      bulbs.push({ geo: G_BULB, matrix: mtx(t, [c, Y_B1 + 0.048, s]) });   // on top of the top rail
    }
    for (let i = 0; i < 12; i += 1) {
      const a = (i / 12) * Math.PI * 2;
      bulbs.push({ geo: G_BULB, matrix: mtx(t, [Math.cos(a) * 0.3, Y_APEX + 0.19, Math.sin(a) * 0.3]) }); // crown ring
    }
    const bm = mergedParts(t, bulbs, bulbMat, false);
    bm.castShadow = false;
    bm.receiveShadow = false;
    ride.add(bm);
  }
  // the two warm centre lights this component always had (≤ 4 real lights per
  // component; everything else at night is emissive)
  const nightLights: THREE.PointLight[] = [];
  [-0.62, 0.62].forEach((x) => {
    const pl = new t.PointLight(0xffc97a, 0, 5.5, 2);
    pl.position.set(x, 1.62, 0);
    ride.add(pl);
    nightLights.push(pl);
  });

  // ---- the BRASS POLES ----------------------------------------------------
  // They must LINE UP WITH THE HORSES: same ring radius, so each pole passes
  // through its horse's withers just in front of the saddle and the horse
  // visibly slides on it. Six poles (the chariot has none) + collars top and
  // bottom, two merged meshes.
  const horseA: number[] = [];   // which stations carry a horse
  const CHARIOT_AT = 3;          // stations 3 and 4 are the chariot's two seats
  for (let i = 0; i < 8; i += 1) if (i !== CHARIOT_AT && i !== CHARIOT_AT + 1) horseA.push(i);
  {
    const poles: PartSpec[] = [];
    const collar: PartSpec[] = [];
    horseA.forEach((i) => {
      const a = (i / 8) * Math.PI * 2;
      const c = Math.cos(a) * R_HORSE;
      const s = Math.sin(a) * R_HORSE;
      // 2.10 is under the ceiling at this radius (2.137 at its deepest sag) — the
      // pole must stop below the CEILING, not below the canvas 0.06 above it
      seg(G_CYLR, [c, Y_DECK - 0.06, s], [c, 2.1, s], 0.046, poles);
      collar.push({ geo: G_CYLR, matrix: mtx(t, [c, 2.05, s], [0, 0, 0], [0.085, 0.05, 0.085]) });
      collar.push({ geo: G_CYLR, matrix: mtx(t, [c, Y_DECK + 0.03, s], [0, 0, 0], [0.09, 0.06, 0.09]) });
    });
    ride.add(mergedParts(t, poles, shiny(BRASS, 0.85, 0.18), false));
    ride.add(mergedParts(t, collar, shiny(GOLD, 0.7, 0.3), false));
  }

  // =========================================================================
  // 3. THE HORSES — the part that has to read as a horse at eye level
  // =========================================================================
  // Was: five boxes and a ball, all axis-aligned, which is why they read as
  // blocky dogs. A horse is chest + barrel + croup (three ellipsoid masses), an
  // ARCHED neck, a head with jaw / muzzle / ears, a mane, a flowing tail, and
  // four TWO-SEGMENT legs whose joints bend — none of which can be expressed
  // with rotX/rotY/rotZ, so every limb here is placed from its two endpoints.
  //
  // Local frame: +x is FORWARD (the direction of travel — the group's rotY of
  // (PI/2 − a) puts local +x on the tangent), +y up, origin at the barrel
  // centre. The pole runs vertically through local (0, *, 0), i.e. through the
  // withers just in front of the saddle at x = −0.10.
  //
  // Four merged meshes per horse (hide / dark / tack / gold): 24 draws for six
  // horses, standing in for ~110 parts. They cannot merge ACROSS horses —
  // each bobs on its own phase.
  const horses: { grp: THREE.Group; ph: number }[] = [];
  const buildHorse = (idx: number, pose: number) => {
    const hg = new t.Group();
    const hide: PartSpec[] = [];
    const dark: PartSpec[] = [];
    const tack: PartSpec[] = [];
    const gold: PartSpec[] = [];

    // ---- the three body masses ----
    blob([0, 0, 0], [0.5, 0.32, 0.27], hide);            // barrel
    blob([0.2, 0.03, 0], [0.31, 0.33, 0.28], hide);      // chest / shoulder
    blob([-0.2, 0.04, 0], [0.32, 0.32, 0.27], hide);     // croup / hindquarters
    // ---- neck and head: an ARCH, not a stub ----
    const poll: [number, number, number] = [0.44 + pose * 0.02, 0.34 - pose * 0.06, 0];
    seg(G_TAP, [0.26, 0.09, 0], poll, 0.19, hide, 0.16);         // neck, tapering up
    blob([poll[0] + 0.05, poll[1] - 0.03, 0], [0.19, 0.16, 0.13], hide);   // jaw / cheek
    const muz: [number, number, number] = [poll[0] + 0.16, poll[1] - 0.11, 0];
    seg(G_TAP, [poll[0] + 0.03, poll[1] - 0.01, 0], muz, 0.115, hide, 0.1); // muzzle
    blob([muz[0], muz[1], 0], [0.1, 0.09, 0.095], hide);                    // nose
    [-1, 1].forEach((sd) =>
      hide.push({ geo: G_CONE, matrix: mtx(t, [poll[0] - 0.025, poll[1] + 0.055, sd * 0.045], [0, 0, sd * 0.2], [0.042, 0.065, 0.036]) }),
    );                                                                       // ears
    // ---- mane: overlapping plates down the crest (this is the single detail
    //      that makes the silhouette read "horse" from 6 u away) ----
    // Two passes have proved the point: 9 loose plates standing off the crest read
    // as a dorsal fin, and shortening them just made a row of teeth. A mane is a
    // CONTINUOUS SHEET falling to one side, so it is lofted — two ribbons, one per
    // side, each a 2-row surface from the crest line out to a ragged hair edge.
    const maneGeo: THREE.BufferGeometry[] = [];
    [-1, 1].forEach((sd) => {
      const root: THREE.Vector3[] = [];
      const tip: THREE.Vector3[] = [];
      for (let k = 0; k <= 9; k += 1) {
        const f = k / 9;
        const cx = 0.25 + (poll[0] - 0.23) * f;
        const cy = 0.15 + (poll[1] + 0.03 - 0.15) * f;
        root.push(new t.Vector3(cx, cy, sd * 0.012));
        tip.push(new t.Vector3(cx - 0.055 - h01(idx * 7 + k) * 0.02, cy + 0.02, sd * (0.055 + 0.02 * Math.sin(f * 3.1))));
      }
      const g = loft([root, tip], [2, 1]);
      maneGeo.push(g);
      dark.push({ geo: g, matrix: I4() });
    });
    seg(G_BOX, [poll[0] + 0.01, poll[1] + 0.055, 0], [poll[0] + 0.09, poll[1] - 0.01, 0], 0.045, dark, 0.028); // forelock
    // ---- tail: an arc of tapering strands, swept back and down ----
    for (let sd = -1; sd <= 1; sd += 1) {
      let px = -0.29;
      let py = 0.13 - Math.abs(sd) * 0.02;
      for (let k = 0; k < 5; k += 1) {
        // measured fix: the first pass compounded −0.012/−0.055 per step and put
        // the tip at (−0.69, −0.52), i.e. 0.17 BELOW the hooves — six black
        // wedges dragging on the deck. This lands it at (−0.47, −0.24).
        const nx = px - 0.04 + k * 0.004 - Math.abs(sd) * 0.004;
        const ny = py - 0.03 - k * 0.021;
        seg(G_CYL, [px, py, sd * 0.045], [nx, ny, sd * 0.06], 0.058 - k * 0.008, dark);
        px = nx;
        py = ny;
      }
    }
    // ---- legs: TWO segments each with a real joint, plus a hoof ----
    // pose 0 = galloping (fores reaching forward, hinds thrust back)
    // pose 1 = prancing  (fores folded up high, hinds tucked under)
    const legs: [[number, number, number], [number, number, number], [number, number, number]][] =
      pose === 0
        ? [
            [[0.18, -0.09, 0], [0.31, -0.25, 0], [0.41, -0.35, 0]],
            [[-0.18, -0.08, 0], [-0.32, -0.23, 0], [-0.43, -0.35, 0]],
          ]
        : [
            [[0.18, -0.09, 0], [0.31, -0.19, 0], [0.36, -0.04, 0]],
            [[-0.18, -0.08, 0], [-0.29, -0.26, 0], [-0.26, -0.4, 0]],
          ];
    legs.forEach(([hipL, jointL, hoofL], li) =>
      [-1, 1].forEach((sd) => {
        const splay = sd * (0.085 + li * 0.01);
        const near = sd > 0 ? 0.035 : -0.035; // near/far leg out of phase so the
        const hip: [number, number, number] = [hipL[0], hipL[1], splay];   // pair never reads as one stick
        const jnt: [number, number, number] = [jointL[0] + near, jointL[1], splay * 1.1];
        const hof: [number, number, number] = [hoofL[0] + near * 1.6, hoofL[1], splay * 1.15];
        seg(G_TAP, hip, jnt, 0.105, hide, 0.09);   // upper leg
        seg(G_CYL, jnt, hof, 0.062, hide);         // cannon
        dark.push({ geo: G_CYLR, matrix: mtx(t, [hof[0], hof[1] - 0.02, hof[2]], [0, 0, 0], [0.075, 0.05, 0.07]) }); // hoof
      }),
    );
    // ---- saddle, blanket, girth, stirrups: the tack sits at x = −0.10 so the
    //      pole (local x = 0) passes just in FRONT of the rider ----
    const SX = -0.1;
    // The cloth is a shaped pad that WRAPS the barrel (an ellipsoid a touch wider
    // than it), not a flat plate laid across it — and the separate flat side flaps
    // are gone: at 0.30 x 0.19 they read as coloured boards bolted to the flanks.
    blob([SX, 0.125, 0], [0.34, 0.17, 0.295], tack);
    const fringe: PartSpec[] = [];
    [-1, 1].forEach((sd) => {
      for (let k = 0; k < 6; k += 1)
        seg(G_BOX, [SX - 0.11 + k * 0.045, 0.075, sd * 0.14], [SX - 0.11 + k * 0.045, 0.02 - h01(idx + k) * 0.02, sd * 0.145], 0.028, fringe, 0.016);
    });
    fringe.forEach((f) => tack.push(f));
    blob([SX, 0.175, 0], [0.25, 0.11, 0.23], tack);                      // seat, dished not slabbed
    blob([SX + 0.115, 0.2, 0], [0.07, 0.06, 0.13], tack);                // pommel
    blob([SX - 0.125, 0.205, 0], [0.07, 0.07, 0.15], tack);              // cantle
    [-1, 1].forEach((sd) => {
      seg(G_BOX, [SX, 0.15, sd * 0.13], [SX + 0.01, -0.02, sd * 0.16], 0.03, dark, 0.02);  // stirrup leather
      gold.push({ geo: G_CYLR, matrix: mtx(t, [SX + 0.01, -0.05, sd * 0.165], [0, Math.PI / 2, 0], [0.075, 0.022, 0.075]) }); // iron
      seg(G_BOX, [0.06, 0.12, sd * 0.12], [0.06, -0.13, sd * 0.13], 0.035, dark, 0.025);   // girth
      gold.push({ geo: G_CYLR, matrix: mtx(t, [0.19, 0.13, sd * 0.135], [Math.PI / 2, 0, 0], [0.055, 0.014, 0.055]) }); // shoulder rosette
    });
    // ---- bridle and reins ----
    slab([poll[0] + 0.02, poll[1] + 0.02, 0], [0.03, 0.035, 0.13], dark);              // browband
    slab([muz[0] - 0.03, muz[1] + 0.02, 0], [0.035, 0.09, 0.115], dark);               // noseband
    [-1, 1].forEach((sd) => {
      seg(G_BOX, [poll[0] + 0.02, poll[1] + 0.02, sd * 0.055], [muz[0] - 0.03, muz[1] + 0.03, sd * 0.05], 0.02, dark, 0.014); // cheek strap
      // over the crest in two runs, so it drapes instead of spanning straight
      seg(G_BOX, [muz[0] - 0.04, muz[1] + 0.01, sd * 0.05], [poll[0] - 0.02, poll[1] + 0.02, sd * 0.07], 0.013, dark, 0.011);
      seg(G_BOX, [poll[0] - 0.02, poll[1] + 0.02, sd * 0.07], [SX + 0.13, 0.235, sd * 0.075], 0.013, dark, 0.011);
    });
    // ---- the pole bosses where the brass passes through the withers ----
    gold.push({ geo: G_CYLR, matrix: mtx(t, [0, 0.185, 0], [0, 0, 0], [0.105, 0.045, 0.105]) });
    gold.push({ geo: G_CYLR, matrix: mtx(t, [0, -0.185, 0], [0, 0, 0], [0.085, 0.035, 0.085]) });

    hg.add(mergedParts(t, hide, mat(t, HIDE[idx % HIDE.length], { rough: 0.5 }), false));
    hg.add(mergedParts(t, dark, mat(t, DARK, { rough: 0.55 }), false));
    hg.add(mergedParts(t, tack, mat(t, TACK[idx % TACK.length], { tex: 'fabric', repeat: [2, 2], rough: 0.65 }), false));
    hg.add(mergedParts(t, gold, shiny(GOLD, 0.75, 0.28), false));
    maneGeo.forEach((g) => g.dispose()); // per-horse temporaries; the batch copied them
    // the saddle anchor — rides the bobbing horse; REAL GameManager guests land
    // here via seatWorld. 0.19 below the seat top because buildPeep's origin is
    // at the peep's FEET and its hips sit 0.46·scale above that.
    const seat = new t.Group();
    seat.position.set(SX, 0.02, 0);
    seat.rotation.y = Math.PI / 2; // face the horse's head (local +x)
    hg.add(seat);
    return { hg, seat };
  };

  // ---- the CHARIOT: two seats, lofted swan-scroll sides -------------------
  const buildChariot = () => {
    const cg = new t.Group();
    const wood: PartSpec[] = [];
    const gold: PartSpec[] = [];
    const cush: PartSpec[] = [];
    /** the side profile: bench-height amidships, scrolling up into a swan neck
     *  at the front, with a low back at the rear */
    const prof = (v: number) => 0.32 + 0.5 * Math.pow(Math.max(0, v - 0.55) / 0.45, 1.7) + 0.14 * Math.pow(1 - v, 2.2);
    const CL = 0.48; // half length — the chariot fills the 2-station gap (90 deg of arc)
    slab([0, 0.03, 0], [CL * 2 + 0.04, 0.06, 0.44], wood); // floor
    [-1, 1].forEach((sd) => {
      const rows: THREE.Vector3[][] = [];
      for (let k = 0; k <= 12; k += 1) {
        const v = k / 12;
        const x = -CL + 2 * CL * v;
        rows.push([new t.Vector3(x, 0.04, sd * 0.21), new t.Vector3(x, prof(v), sd * 0.21)]);
      }
      const m = mat(t, CREAM, { tex: 'wood', repeat: [3, 1], rough: 0.7 });
      m.side = t.DoubleSide;
      cg.add(new t.Mesh(loft(rows, [3, 1]), m));
      // gold beading following the carved top edge — from endpoints, so it
      // follows the scroll instead of chording across it
      for (let k = 0; k < 12; k += 1) {
        const v0 = k / 12;
        const v1 = (k + 1) / 12;
        seg(G_CYL, [-CL + 2 * CL * v0, prof(v0), sd * 0.21], [-CL + 2 * CL * v1, prof(v1), sd * 0.21], 0.038, gold);
      }
      gold.push({ geo: G_CYLR, matrix: mtx(t, [0.3, 0.36, sd * 0.22], [Math.PI / 2, 0, 0], [0.15, 0.014, 0.15]) }); // rosette
    });
    slab([-0.04, 0.34, 0], [0.6, 0.07, 0.4], cush);                   // bench
    slab([-0.34, 0.52, 0], [0.07, 0.32, 0.4], cush, [0, 0, -0.12]);   // backrest
    cg.add(mergedParts(t, wood, mat(t, TAN, { tex: 'wood', repeat: [3, 1], rough: 0.85 }), false));
    cg.add(mergedParts(t, gold, shiny(GOLD, 0.75, 0.28), false));
    cg.add(mergedParts(t, cush, mat(t, TACK[0], { tex: 'fabric', repeat: [2, 2], rough: 0.7 }), false));
    const cs: THREE.Group[] = [];
    [-1, 1].forEach((sd) => {
      const s = new t.Group();
      s.position.set(-0.04, 0.19, sd * 0.11); // 0.19 under the bench top, as above
      s.rotation.y = Math.PI / 2;
      cg.add(s);
      cs.push(s);
    });
    return { cg, cs };
  };

  // ---- mount the eight stations in ANGULAR order (so seat index n and
  //      station n agree, and a registered capacity of 8 fills them all) ----
  let hIdx = 0;
  const chariot = buildChariot();
  for (let i = 0; i < 8; i += 1) {
    const a = (i / 8) * Math.PI * 2;
    if (i === CHARIOT_AT) {
      // the chariot spans stations 3 and 4 — it sits at their midpoint
      const am = (i + 0.5) * (Math.PI * 2) / 8;
      chariot.cg.position.set(Math.cos(am) * R_HORSE, Y_DECK, Math.sin(am) * R_HORSE);
      chariot.cg.rotation.y = Math.PI / 2 - am;
      ride.add(chariot.cg);
      seats.push(chariot.cs[0]);
      continue;
    }
    if (i === CHARIOT_AT + 1) {
      seats.push(chariot.cs[1]);
      continue;
    }
    const { hg, seat } = buildHorse(hIdx, hIdx % 2);
    hg.position.set(Math.cos(a) * R_HORSE, 1.08, Math.sin(a) * R_HORSE);
    hg.rotation.y = Math.PI / 2 - a; // local +x onto the tangent = direction of travel
    ride.add(hg);
    seats.push(seat);
    horses.push({ grp: hg, ph: a });
    if (withRiders && hIdx % 2 === 0) {
      const p = buildPeep(t, {
        skin: SKIN_TONES[hIdx % SKIN_TONES.length],
        shirt: [0x3aa0e0, 0xe0a020, 0x2e9e54, 0xd6338c][hIdx % 4],
        seated: true,
      });
      p.group.scale.setScalar(0.42);
      seat.add(p.group);
    }
    hIdx += 1;
  }
  if (withRiders) {
    const p = buildPeep(t, { skin: SKIN_TONES[1 % SKIN_TONES.length], shirt: 0xe04a3a, seated: true, female: true });
    p.group.scale.setScalar(0.42);
    chariot.cs[0].add(p.group);
  }
  vehicle = horses[0].grp;
  SHARED.forEach((g) => g.dispose()); // every batch has copied what it needed

  const step = (time: number) => {
    // day → night gate: the bulb rows and the canopy ceiling come up together,
    // so the inside of the top reads as lit rather than as a black cone.
    const nk = nightKOf(group); // nightKOf takes the OBJECT, never a time value
    const ease = nk * nk * (3 - 2 * nk); // smoothstep
    bulbMat.emissiveIntensity = 0.15 + (1.25 + 0.12 * Math.sin(time * 2.7) - 0.15) * ease;
    if (ceilMat) ceilMat.emissiveIntensity = 0.12 + 0.5 * ease;
    nightLights.forEach((pl) => (pl.intensity = ease * 1.0));
    ride.rotation.y = time * 0.55;
    // the JUMP: each horse bobs on its own phase, sliding up and down its pole
    horses.forEach((hh, i) => (hh.grp.position.y = 1.08 + Math.sin(time * 3 + hh.ph * 2 + i * 0.4) * 0.13));
  };

  // station gate (RCT2: the carousel is PARKED while guests mount the horses
  // and only turns departing→arriving)
  const gate = createMotionGate((tt) => step(tt));
  return { group, update: gate.update, vehicle, seatWorld: makeSeatWorld(t, seats), onStateChange: gate.onStateChange };
}

/** <Carousel> — composable ride (components/Park/Context.md): mounts the ride
 *  at `position`/`rotation`; inside a <Park>, `register` wires the full
 *  GameManager ride via <ConfigurableRide> — queue HEAD 1.5 out the local +z
 *  front (lane extending +z), exit hut beside it at local [-1.5, 1.35],
 *  boarding at the base. Capacity 8 = six jumping horses + the chariot's two
 *  bench places: REAL guests ride them via `seatWorld` (decorative riders off
 *  when registered) and the deck is motion-gated — parked for boarding and
 *  unloading. Override with top-level props / `queue`. */
export const Carousel = composableRide<{ riders?: boolean }>(
  'Carousel',
  (t, props) => buildCarouselScene(t, { riders: props.riders ?? !(props as { register?: unknown }).register }),
  { defaults: { name: 'Carousel', capacity: 8, rideDuration: 8, intensity: 2, price: 2 } },
);

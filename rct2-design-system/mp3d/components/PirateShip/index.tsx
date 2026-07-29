import React from 'react';
import * as THREE from 'three';
import { box, cyl, mat, mergedParts, mtx, nightKOf } from '../Stage';
import { buildPeep, SHIRTS, SKIN_TONES } from '../Guest';
import { createMotionGate, makeSeatWorld } from '../GameManager';
import { composableRide } from '../Park';

// ---------------------------------------------------------------------------
// PirateShip — a real galleon on a real pendulum, not a plank on a swing.
//
// WHAT WAS WRONG (reported after a render, 2026-07-28: "the ship is a flat slab
// of boxes with two brown blobs at the ends"). Part for part the boat was: a
// 2.5 x 0.34 x 0.8 box, a 2.7 x 0.30 x 0.88 box on top of it, a flat gold strip,
// a dark 2.2 x 0.2 x 0.7 box for the interior, and at each end a rotated 0.55
// box + a cone + a SPHERE + a small box for a "dragon head". There was no hull
// curve, no sheer, no prow, no stern, no gunwale and no figurehead: three nested
// slabs cannot be a hull, because a hull is a SURFACE, and a sphere on a stick
// is not a head. From mid-distance it read as a pallet with two tree stumps.
//
// WHAT IT IS NOW — the things a ship actually has, in the order they pay off:
//  1. A LOFTED TWO-TONE HULL. Three fair curves against the length (half-beam,
//     keel depth, and the SHEER — the deck line that rises fore and aft, which
//     is the single thing that separates a ship from a barge) define a station;
//     `sect()` walks one station from keel to sheer; `loft()` triangulates the
//     grid. It is built as TWO shells split at the boot-top, so the hull has a
//     real dark underbody and a lighter topside instead of one flat colour.
//     The entry is fine, the run aft is full, and the stern is closed by a
//     RAKED TRANSOM lofted aft-and-up off the last station.
//  2. BULWARKS + A CAP RAIL — the gunwale. A lofted wall standing up off the
//     sheer with a little tumblehome, a painted red waist inboard of it, and a
//     cap rail laid along its top in endpoint-placed segments so it FOLLOWS the
//     sheer instead of being a straight box.
//  3. A BOW: stem post, gammoning, trailboards, cathead, bowsprit — and a
//     GILDED FIGUREHEAD (head, muzzle, jaw, brow, horns and an endpoint-placed
//     radiating mane) under it.
//  4. A STERN: raked transom with a window band, two quarter galleries, a
//     taffrail, a rudder, and a stern LANTERN that lights after dark.
//  5. ARCHITECTURE, not one flat floor: a flat waist sole where the benches
//     are, a raised FORECASTLE forward and a raised QUARTERDECK aft with
//     breaks, ladders, the ship's wheel, a capstan and hatch coamings.
//  6. A RIG: a mast between the pendulum legs with a crow's nest, a yard
//     across the beam, a furled sail, endpoint-placed shrouds and ratlines,
//     and a jolly-roger pennant. This is what gives the rig a silhouette from
//     across a park.
//  7. A REAL PENDULUM. The boat used to hang off a single 0.11 box down the
//     centreline. It now hangs the way a swinging ship does: FOUR splayed arms
//     off the axle, outboard of the hull on both sides, down to a cross-shaft
//     under the keel — which also frees the centreline for the mast.
//  8. A STATION: two flanking boarding decks with hazard kerbs, steps and
//     handrails, so the rig reads as a ride and not as a sculpture on a lawn.
//
// HOW IT IS BUILT (the three rules that decide whether it reads as a thing):
//  * Anything that POINTS SOMEWHERE is placed from its two endpoints via
//    `segP()` — the quaternion that takes +Y onto (b−a), scaled to the run
//    length. `rotX/rotY/rotZ` cannot express an arbitrary direction. Wales,
//    cap rails, frames, braces, shrouds, ratlines, the mane and the pendulum
//    arms all use it.
//  * Anything CURVED is a surface: `loft()` → one indexed BufferGeometry with
//    real UVs and `computeVertexNormals()`.
//  * Anything METALLIC gets an envMap. `metalness` with nothing to reflect is
//    grey paint — that is measured, not an opinion — so the gold, the brass and
//    the steel all reflect a cached 256x128 equirectangular sea-and-sky canvas.
//
// DRAW CALLS ARE THE BUDGET (SETUP.md §13: a single rig ≲ 300). Everything
// static in its own frame is merged by material: ~400 parts land in 21 merged
// batches, so the rebuilt rig costs FEWER draws than the slab it replaces.
// Deterministic (hashed `h01`, never Math.random) and every glow is gated on
// `nightKOf(group)` — which takes the OBJECT, never a time value.
// ---------------------------------------------------------------------------

/** local mirror of Stage's batch spec (a second `import type` line from the
 *  same module tripped the design-system resolver) */
type PartSpec = { geo: THREE.BufferGeometry; matrix: THREE.Matrix4; uv?: [number, number] };

/** deterministic 0..1 — hashed, never Math.random, so a remount is identical */
const h01 = (n: number) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

// ---------------------------------------------------------------------------
// THE SEA-AND-SKY ENVIRONMENT — drawn once, cached, and it is the whole reason
// the gilding reads as GOLD. three.js feeds a metal's colour entirely from its
// reflections, so a `metalness: 0.6` gold rail with no environment renders dull
// grey (measured on the Carousel rebuild, twice). There is no scene-wide
// environment in this design system and a live CubeCamera is an extra render
// pass per frame, so this is a 256x128 equirectangular CANVAS: sky, a bright
// horizon band, a sunlit sea, a sun blob and a row of warm fairground bulb
// spots at about the height this ride's own frame lights sit at.
// ---------------------------------------------------------------------------
let _seaEnv: THREE.Texture | null = null;
function seaEnv(t: typeof THREE): THREE.Texture | null {
  if (_seaEnv) return _seaEnv;
  if (typeof document === 'undefined') return null; // SSR / node bundling
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 128;
  const x = c.getContext('2d');
  if (!x) return null;
  const sky = x.createLinearGradient(0, 0, 0, 64);
  sky.addColorStop(0, '#4d7fb6');
  sky.addColorStop(0.72, '#a3c2dc');
  sky.addColorStop(1, '#e2e8e6');
  x.fillStyle = sky;
  x.fillRect(0, 0, 256, 64);
  const sea = x.createLinearGradient(0, 64, 0, 128);
  sea.addColorStop(0, '#8f9a86'); // a LIT deck/quay tone, not a dark lawn — a dark
  sea.addColorStop(1, '#4c4b3c'); // lower hemisphere makes every metal read as paint
  x.fillStyle = sea;
  x.fillRect(0, 64, 256, 64);
  x.fillStyle = '#dfe6e4';
  x.fillRect(0, 62, 256, 4);
  const spots: [number, number, number, string][] = [
    [78, 24, 17, '#fffdf2'], // sun
    [206, 42, 8, '#ffe9bc'],
  ];
  for (let i = 0; i < 20; i += 1) spots.push([7 + i * 12.8, 56, 4.4, '#ffe4a8']);
  for (let i = 0; i < 10; i += 1) spots.push([13 + i * 25.6, 74, 5.2, '#f2ddb8']);
  for (const [cx, cy, r, col] of spots) {
    const gr = x.createRadialGradient(cx, cy, 0, cx, cy, r);
    gr.addColorStop(0, col);
    gr.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = gr;
    x.beginPath();
    x.arc(cx, cy, r, 0, Math.PI * 2);
    x.fill();
  }
  const tex = new t.CanvasTexture(c);
  (tex as unknown as { mapping: number }).mapping = (t as unknown as { EquirectangularReflectionMapping: number }).EquirectangularReflectionMapping;
  (tex as unknown as { colorSpace: string }).colorSpace = (t as unknown as { SRGBColorSpace: string }).SRGBColorSpace;
  _seaEnv = tex;
  return tex;
}

export function buildPirateShipScene(
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
  const g = new t.Group();
  const withRiders = opts.riders ?? true; // decorative — off when registered so REAL guests fill the rows
  const seats: THREE.Group[] = []; // 5 rows x 2 bench spots (seatWorld)

  // ---- palette -----------------------------------------------------------
  // The RCT2 SWSH1 frame colours are kept exactly (orange #e05020 legs, slate
  // #203030 beam) because those are the sprite's identity; everything on the
  // BOAT is a galleon's palette rather than the old undifferentiated brown.
  const ORANGE = 0xe8641c; // A-frame
  const ORANGE_D = 0xa8410f; // A-frame shadow / gussets
  const SLATE = 0x2e4444; // beam, axle, pendulum arms
  const STEEL = 0x8d949c; // bright steelwork, handrails
  const CONCRETE = 0x8a8f98;
  const UNDER = 0x6e3d22; // hull below the boot-top
  const TOPSIDE = 0xa06e36; // hull topside planking
  const WALE = 0x2c1d0c; // wales, keel, stem — near-black oiled oak
  const DECK = 0xa4854f; // deck planking
  const RAIL = 0x8a5c2c; // bulwark timber, cap rail
  const RED = 0xb0322a; // painted inner bulwarks, shields
  const CREAM = 0xd8cdb4; // canvas, alternating shields
  const GOLD = 0xd4a72c;
  const GLASS = 0x2a2b22;

  // =======================================================================
  // shared helpers
  // =======================================================================
  const env = seaEnv(t);
  /** a polished material that REFLECTS rather than glows. Metalness with no
   *  envMap is grey paint — the gold on this ship is 60% of its charm. */
  const shiny = (color: number, metal: number, rough: number, texName?: 'metal' | 'wood') => {
    const m = mat(t, color, { metal, rough, tex: texName, repeat: [2, 2] });
    if (env) {
      m.envMap = env;
      m.envMapIntensity = metal > 0.8 ? 1.15 : 0.85;
    }
    return m;
  };
  /** attach the environment to a mesh built through box()/cyl() */
  const gilt = <M extends THREE.Mesh>(m: M, i = 0.9) => {
    const mm = m.material as THREE.MeshStandardMaterial;
    if (env) {
      mm.envMap = env;
      mm.envMapIntensity = i;
    }
    return m;
  };

  const G_BOX = new t.BoxGeometry(1, 1, 1);
  const G_SPH = new t.SphereGeometry(0.5, 12, 8);
  const G_ROD = new t.CylinderGeometry(0.5, 0.5, 1, 7); // +Y run, diameter 1
  const G_ROD4 = new t.CylinderGeometry(0.5, 0.5, 1, 4); // cheap rope/ratline
  const G_DISC = new t.CylinderGeometry(0.5, 0.5, 1, 12);
  const G_BULB = new t.SphereGeometry(0.5, 8, 6); // 80 tri, not 168 — a bulb is 6 cm across

  const YA = new t.Vector3(0, 1, 0);
  const _d = new t.Vector3();
  const _mid = new t.Vector3();
  const _q = new t.Quaternion();
  type V3 = [number, number, number];
  /** a +Y unit geometry laid FROM a TO b, cross-section w x (w2 ?? w). The only
   *  way to point a part at an arbitrary direction. */
  const segP = (geo: THREE.BufferGeometry, a: V3, b: V3, w: number, into: PartSpec[], w2?: number) => {
    _d.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    const len = _d.length();
    if (len < 1e-5) return;
    _mid.set((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2);
    _q.setFromUnitVectors(YA, _d.normalize());
    into.push({ geo, matrix: new t.Matrix4().compose(_mid.clone(), _q.clone(), new t.Vector3(w, len, w2 ?? w)) });
  };
  /** a unit box scaled to `dims` at `pos` (YXZ euler) */
  const slab = (pos: V3, dims: V3, into: PartSpec[], rot: V3 = [0, 0, 0], uv?: [number, number]) =>
    into.push({ geo: G_BOX, matrix: mtx(t, pos, rot, dims), uv });
  /** an ellipsoid of FULL extents `dims` */
  const blob = (pos: V3, dims: V3, into: PartSpec[], rot: V3 = [0, 0, 0]) =>
    into.push({ geo: G_SPH, matrix: mtx(t, pos, rot, dims) });
  /** quads between consecutive equal-length rows → ONE indexed geometry */
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
    const geo = new t.BufferGeometry();
    geo.setAttribute('position', new t.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new t.Float32BufferAttribute(uv, 2));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    return geo;
  };
  /** a lofted shell is an OPEN surface — a hull with a hole in the top, a sail
   *  with two faces — so every loft here is DoubleSide on purpose. */
  const shell = (geo: THREE.BufferGeometry, m: THREE.MeshStandardMaterial, cast = true) => {
    m.side = t.DoubleSide;
    const me = new t.Mesh(geo, m);
    me.castShadow = cast;
    me.receiveShadow = true;
    return me;
  };

  // =======================================================================
  // 1. THE STATIONARY A-FRAME — a braced space frame, not four sticks
  // =======================================================================
  const pivotY = 3.1;
  const LEG_X = 1.6; // foot half-spread, UNCHANGED (the registered silhouette)
  const LEG_Z = 0.7; // frame planes, UNCHANGED
  const frameP: PartSpec[] = []; // orange painted steel
  const gussetP: PartSpec[] = []; // darker orange gussets/collars
  const steelP: PartSpec[] = []; // bright steel
  const padP: PartSpec[] = []; // concrete
  const boltP: PartSpec[] = [];

  /** the leg centreline: x at height y on side xs of frame zs */
  const legX = (y: number, xs: number) => xs * LEG_X * (1 - y / pivotY);
  [-1, 1].forEach((zs) => {
    const z = zs * LEG_Z;
    [-1, 1].forEach((xs) => {
      // TAPERED leg in two segments (a real fairground A-frame leg is a fabricated
      // box section that thins toward the bearing), placed from its endpoints
      segP(G_BOX, [xs * LEG_X, 0.1, z], [legX(1.62, xs), 1.62, z], 0.15, frameP, 0.14);
      segP(G_BOX, [legX(1.6, xs), 1.6, z], [legX(pivotY + 0.06, xs), pivotY + 0.06, z], 0.12, frameP, 0.115);
      // cast foot: plinth, base plate, anchor bolts
      slab([xs * LEG_X, 0.05, z], [0.56, 0.1, 0.5], padP, [0, 0, 0], [3, 1]);
      slab([xs * LEG_X, 0.12, z], [0.4, 0.06, 0.36], gussetP);
      [-1, 1].forEach((a) =>
        [-1, 1].forEach((b) => segP(G_ROD, [xs * LEG_X + a * 0.16, 0.09, z + b * 0.14], [xs * LEG_X + a * 0.16, 0.2, z + b * 0.14], 0.045, boltP)),
      );
      // knee gusset where the leg changes section
      slab([legX(1.6, xs), 1.6, z], [0.22, 0.15, 0.145], gussetP, [0, 0, xs * 0.47]);
    });
    // TWO horizontal ties (was one) and a single zig-zag diagonal per bay. An
    // earlier pass put three ties and a full X in every bay: the frame came
    // back as a WALL of orange lattice that hid the ship it exists to swing.
    // A fairground A-frame is a light truss; keep it light.
    const tieY = [0.9, 2.05];
    tieY.forEach((y, k) => {
      const hw = Math.abs(legX(y, 1));
      segP(G_BOX, [-hw, y, z], [hw, y, z], 0.085, frameP, 0.085);
      const yp = k === 0 ? 0.2 : tieY[k - 1];
      const hp = Math.abs(legX(yp, 1));
      const dir = k % 2 ? 1 : -1;
      segP(G_BOX, [-dir * hp, yp, z], [dir * hw, y, z], 0.06, frameP);
    });
    // bearing housing at the apex: a cast pillow block, not a bare box end
    slab([0, pivotY, z], [0.46, 0.4, 0.26], steelP, [0, 0, 0], [2, 2]);
    slab([0, pivotY + 0.21, z], [0.34, 0.08, 0.3], gussetP);
    [-1, 1].forEach((a) => segP(G_ROD, [a * 0.17, pivotY - 0.24, z], [a * 0.17, pivotY + 0.23, z], 0.05, boltP));
  });
  // OUT-OF-PLANE BRACING between the two frames. Without it the rig is two
  // parallel flat ladders and from any azimuth off the broadside they overlap
  // into one — the same defect the towers on the inverter ship had.
  [0.9, 2.05].forEach((y) => {
    const hw = Math.abs(legX(y, 1));
    [-1, 1].forEach((xs) => segP(G_BOX, [xs * hw, y, -LEG_Z], [xs * hw, y, LEG_Z], 0.065, frameP));
  });
  {
    const y0 = 0.9;
    const y1 = 2.05;
    [-1, 1].forEach((xs) =>
      segP(G_BOX, [xs * Math.abs(legX(y0, 1)), y0, -xs * LEG_Z], [xs * Math.abs(legX(y1, 1)), y1, xs * LEG_Z], 0.045, frameP),
    );
  }
  // portal ties under the bearings + the drive motor and its guard
  [-1, 1].forEach((xs) => segP(G_BOX, [xs * 0.3, pivotY - 0.3, -LEG_Z], [xs * 0.3, pivotY - 0.3, LEG_Z], 0.085, frameP));
  slab([0.62, pivotY - 0.34, 0], [0.44, 0.32, 0.5], steelP, [0, 0, 0], [2, 2]);
  slab([0.62, pivotY - 0.15, 0], [0.3, 0.08, 0.36], gussetP);
  [-1, 1].forEach((zs) => slab([0.62, pivotY - 0.34, zs * 0.27], [0.36, 0.24, 0.03], boltP));

  // PAINTED steel takes NO envMap. The first pass ran the orange through
  // `shiny()` and the whole A-frame came back brick-dark: at metalness 0.35 a
  // third of the surface colour then comes from the environment's lower
  // hemisphere, which is deliberately dark. An envMap is for CHROME and GILDING
  // (which have nothing else to be); paint is paint.
  g.add(mergedParts(t, frameP, mat(t, ORANGE, { tex: 'metal', repeat: [1, 1], metal: 0.15, rough: 0.55 }), false));
  g.add(mergedParts(t, gussetP, mat(t, ORANGE_D, { metal: 0.15, rough: 0.5 }), false));
  g.add(mergedParts(t, steelP, shiny(SLATE, 0.6, 0.35), false));
  g.add(mergedParts(t, boltP, shiny(STEEL, 0.85, 0.28), false));

  // the slate cross-beam through the pivot + gilded hub caps
  g.add(gilt(cyl(t, 0.095, 0.095, 1.86, SLATE, [0, pivotY, 0], { rotX: Math.PI / 2, tex: 'metal', metal: 0.6, rough: 0.35, seg: 14 }), 1.0));
  [-0.9, 0.9].forEach((z) => {
    g.add(gilt(cyl(t, 0.19, 0.19, 0.07, GOLD, [0, pivotY, z], { rotX: Math.PI / 2, metal: 0.75, rough: 0.28, seg: 16 }), 1.1));
    g.add(gilt(cyl(t, 0.06, 0.06, 0.11, STEEL, [0, pivotY, z], { rotX: Math.PI / 2, metal: 0.9, rough: 0.22, seg: 10 }), 1.1));
  });

  // =======================================================================
  // 2. THE STATION — two flanking boarding decks. A swinging ship is boarded
  //    from gangways OUTSIDE the beam (the hull's rest clearance is 0.38 u, so
  //    there is no room for a deck under it), which is also how the real ride
  //    works.
  // =======================================================================
  const kerbP: PartSpec[] = [];
  const railP: PartSpec[] = [];
  // The decks stand OUTBOARD of the frame legs (leg faces reach z 0.775) and the
  // step is folded onto the deck's own outboard edge rather than being a third
  // slab further out — the registered body footprint grows by 0.4 u in z as it
  // is, and every extra centimetre there pushes the derived queue head out with
  // it (`minHutFront = foot.max.z + 1.27`).
  [-1, 1].forEach((zs) => {
    const zc = zs * 1.0;
    slab([0, 0.11, zc], [2.86, 0.22, 0.44], padP, [0, 0, 0], [8, 2]);
    slab([0, 0.055, zc + zs * 0.28], [2.5, 0.11, 0.12], padP, [0, 0, 0], [7, 1]); // step nosing
    // hazard kerb along the outboard edge + the two ends
    slab([0, 0.235, zc + zs * 0.19], [2.86, 0.05, 0.06], kerbP, [0, 0, 0], [22, 1]);
    [-1, 1].forEach((xs) => slab([xs * 1.4, 0.235, zc], [0.06, 0.05, 0.44], kerbP, [0, 0, 0], [3, 1]));
    // handrail: posts + top rail + mid rail, outboard so nobody leans into the arc
    const rz = zc + zs * 0.19;
    [-1.33, -0.665, 0, 0.665, 1.33].forEach((x) => segP(G_ROD, [x, 0.2, rz], [x, 0.76, rz], 0.045, railP));
    [0.72, 0.42].forEach((y) => segP(G_ROD, [-1.36, y, rz], [1.36, y, rz], 0.038, railP));
  });
  g.add(mergedParts(t, padP, mat(t, CONCRETE, { tex: 'concrete', rough: 0.92 }), false));
  g.add(mergedParts(t, kerbP, shiny(GOLD, 0.4, 0.55, 'metal'), false));
  g.add(mergedParts(t, railP, shiny(STEEL, 0.8, 0.3), false));

  // =======================================================================
  // 3. THE PENDULUM — four splayed arms off the axle to a cross-shaft under
  //    the keel. The old rig was ONE 0.11 box down the centreline, which is
  //    both wrong and in the way of a mast.
  // =======================================================================
  const swing = new t.Group();
  swing.position.set(0, pivotY, 0);
  g.add(swing);
  const armP: PartSpec[] = [];
  const armSteelP: PartSpec[] = [];
  const ARM_Z = 0.52; // outboard of the hull, inboard of the frame legs (0.635)
  const SHAFT_X = 0.95;
  const SHAFT_Y = -2.62; // swing-local: 0.12 under the boat origin at -2.5
  [-1, 1].forEach((zs) => {
    const z = zs * ARM_Z;
    [-1, 1].forEach((xs) => {
      segP(G_BOX, [0, -0.04, z], [xs * SHAFT_X, SHAFT_Y, z], 0.13, armP, 0.11);
      // a lightening web + a splice plate down each arm
      segP(G_BOX, [xs * 0.28, -0.78, z], [xs * 0.74, -2.08, z], 0.055, armSteelP, 0.16);
    });
    // lateral ties between the two arms of this side
    [-1.05, -1.95].forEach((y) => {
      const f = (y - -0.04) / (SHAFT_Y + 0.04);
      const hx = SHAFT_X * f;
      segP(G_BOX, [-hx, y, z], [hx, y, z], 0.07, armP);
    });
  });
  // the cross-shaft under the keel + its two saddles, and the axle fairing
  [-1, 1].forEach((xs) => {
    segP(G_ROD, [xs * SHAFT_X, SHAFT_Y, -ARM_Z - 0.05], [xs * SHAFT_X, SHAFT_Y, ARM_Z + 0.05], 0.11, armSteelP);
    [-1, 1].forEach((zs) => slab([xs * SHAFT_X, SHAFT_Y + 0.09, zs * 0.3], [0.2, 0.2, 0.12], armSteelP));
  });
  swing.add(mergedParts(t, armP, shiny(SLATE, 0.55, 0.4, 'metal'), false));
  swing.add(mergedParts(t, armSteelP, shiny(STEEL, 0.7, 0.32), false));
  // hub fairing at the axle — kept SMALL and dark. A first pass at r 0.30 with
  // gold end caps read as a brass boiler slung over the frame and drew the eye
  // straight off the ship.
  swing.add(gilt(cyl(t, 0.21, 0.21, 0.34, SLATE, [0, -0.02, 0], { rotX: Math.PI / 2, tex: 'metal', repeat: [4, 1], metal: 0.55, rough: 0.4, seg: 16 }), 0.9));
  [-0.17, 0.17].forEach((z) => swing.add(gilt(cyl(t, 0.225, 0.225, 0.05, SLATE, [0, -0.02, z], { rotX: Math.PI / 2, metal: 0.7, rough: 0.3, seg: 16 }), 0.9)));

  const boat = new t.Group();
  boat.position.y = -2.5;
  swing.add(boat);
  const vehicle: THREE.Object3D = boat;

  // =======================================================================
  // 4. THE HULL — a lofted surface off three fair curves
  // =======================================================================
  const LEN = 4.3;
  const STA = 26; // stations along the length
  const NW = 9; // samples from keel to sheer, per side
  const xAt = (u: number) => (u - 0.5) * LEN;
  /** half-beam at u (0 = transom … 1 = stem). Full amidships at u 0.42, a FINE
   *  entry forward (p 1.55) and a full run aft into a 0.20 transom (p 2.2). */
  const beamAt = (u: number) => {
    const fwd = u >= 0.42;
    const a = fwd ? (u - 0.42) / 0.58 : (0.42 - u) / 0.42;
    const p = fwd ? 1.55 : 2.2;
    const e = fwd ? 0.045 : 0.2;
    return e + (0.465 - e) * Math.pow(Math.max(0, 1 - Math.pow(a, p)), 0.62);
  };
  /** THE SHEER — the deck line. It RISES fore and aft, and it is the single
   *  curve that makes a hull read as a ship instead of a barge. */
  const sheerAt = (u: number) =>
    0.4 + 0.5 * Math.pow(Math.max(0, (0.42 - u) / 0.42), 2) + 0.6 * Math.pow(Math.max(0, (u - 0.42) / 0.58), 2.2);
  /** keel depth below the sheer — deepest amidships, so the keel line rises
   *  fore and aft the way a real profile does */
  const depAt = (u: number) => 0.3 + 0.325 * Math.pow(Math.sin(Math.PI * (0.1 + 0.82 * u)), 0.5);
  /** a point on station u at w = 0 (keel) … 1 (sheer), on side sd */
  const sect = (u: number, w: number, sd: number) => {
    const b = beamAt(u);
    const d = depAt(u);
    const s = sheerAt(u);
    return new t.Vector3(xAt(u), s - d * (1 - Math.pow(w, 1.9)), sd * b * Math.pow(w, 0.62));
  };
  const Y_SOLE = 0.06; // the flat waist sole the benches stand on
  const Y_FC = 0.52; // forecastle deck
  const Y_QD = 0.46; // quarterdeck
  const U_FC = 0.87;
  const U_QD = 0.14;
  const W_BOOT = 0.55; // the boot-top: where the dark underbody stops

  /** the hull, in TWO shells so it has an underbody and a topside */
  const hullRows = (w0: number, w1: number, n: number) => {
    const rows: THREE.Vector3[][] = [];
    for (let i = 0; i <= STA; i += 1) {
      const u = i / STA;
      const row: THREE.Vector3[] = [];
      for (let j = -n; j <= n; j += 1) {
        const w = w0 + (w1 - w0) * (Math.abs(j) / n);
        row.push(j === 0 ? sect(u, w0, 1) : sect(u, w, Math.sign(j)));
      }
      rows.push(row);
    }
    return rows;
  };
  // underbody: keel (w 0) out to the boot-top
  boat.add(shell(loft(hullRows(0, W_BOOT, NW), [3, 8]), mat(t, UNDER, { tex: 'wood', rough: 0.9, repeat: [1, 1] })));
  // topside: boot-top up to the sheer
  boat.add(shell(loft(hullRows(W_BOOT, 1, 6), [2, 9]), mat(t, TOPSIDE, { tex: 'wood', rough: 0.88 })));

  // THE RAKED TRANSOM. The loft leaves the stern open at u = 0; a real stern is
  // not a flat cut, it rakes aft-and-up over a counter. Loft the last station
  // out to a second row displaced aft, up and slightly wider.
  {
    const rows: THREE.Vector3[][] = [];
    const mk = (dx: number, dy: number, k: number) => {
      const r: THREE.Vector3[] = [];
      for (let j = -8; j <= 8; j += 1) {
        const w = Math.abs(j) / 8;
        const p = sect(0, w, Math.sign(j) || 1);
        r.push(new t.Vector3(p.x + dx, p.y + dy, p.z * k));
      }
      return r;
    };
    rows.push(mk(0, 0, 1));
    rows.push(mk(-0.11, 0.13, 1.06));
    rows.push(mk(-0.2, 0.32, 1.1));
    boat.add(shell(loft(rows, [3, 1]), mat(t, TOPSIDE, { tex: 'wood', rough: 0.88, repeat: [3, 2] })));
  }

  // ---- BULWARKS: the gunwale that was missing --------------------------
  // A wall standing up off the sheer with a little TUMBLEHOME (leaning inboard),
  // lofted so it follows the sheer curve, plus a painted cream waist inboard of it.
  const BULW = (u: number) => 0.2 + 0.24 * Math.pow(Math.max(0, (u - 0.42) / 0.58), 1.6) + 0.14 * Math.pow(Math.max(0, (0.42 - u) / 0.42), 1.8);
  /** the WALL IS A CONSTANT THICKNESS, not a constant FRACTION of the beam. The
   *  first pass offset the inner face to `p.z * 0.955`, which is 21 mm of timber
   *  amidships and TWO mm at the stem — so fore and aft the two faces z-fought and
   *  the painted strake came back patched grey and red along its whole length. The
   *  `max` keeps the wall from crossing itself where the beam runs out. */
  const inZ = (pz: number, wall: number) => Math.sign(pz) * Math.max(Math.abs(pz) * 0.45, Math.abs(pz) - wall);
  [-1, 1].forEach((sd) => {
    const rows: THREE.Vector3[][] = [];
    const inner: THREE.Vector3[][] = [];
    for (let i = 0; i <= 22; i += 1) {
      const u = 0.02 + (i / 22) * 0.955;
      const p = sect(u, 1, sd);
      const h = BULW(u);
      rows.push([p.clone(), new t.Vector3(p.x, p.y + h, inZ(p.z, 0.026))]);
      inner.push([
        new t.Vector3(p.x, p.y - 0.02, inZ(p.z, 0.024)),
        new t.Vector3(p.x, p.y + h - 0.015, inZ(p.z, 0.05)),
      ]);
    }
    boat.add(shell(loft(rows, [9, 1]), mat(t, RED, { tex: 'wood', rough: 0.8 })));
    boat.add(shell(loft(inner, [9, 1]), mat(t, CREAM, { tex: 'wood', rough: 0.85, repeat: [1, 1] }), false));
  });
  // TRANSOM BOARD — closes the gap the raked counter leaves between its top edge
  // and the quarterdeck. Without it the stern rendered as a black hole from any
  // angle abaft the beam.
  {
    const rows: THREE.Vector3[][] = [];
    const b0 = beamAt(0) * 1.1;
    const yb = sheerAt(0) + 0.32;
    const yt = sheerAt(0.02) + BULW(0.02);
    for (let i = 0; i <= 4; i += 1) {
      const f = i / 4;
      const y = yb + (yt - yb) * f;
      const b = b0 * (1 - 0.22 * f);
      rows.push([new t.Vector3(xAt(0) - 0.2 + f * 0.04, y, -b), new t.Vector3(xAt(0) - 0.2 + f * 0.04, y, b)]);
    }
    boat.add(shell(loft(rows, [3, 1]), mat(t, RED, { tex: 'wood', rough: 0.8, repeat: [2, 1] })));
  }

  // ---- the deck: flat waist sole + raised forecastle and quarterdeck ----
  const deckSheet = (uA: number, uB: number, y: number, k: number, n: number) => {
    const rows: THREE.Vector3[][] = [];
    for (let i = 0; i <= n; i += 1) {
      const u = uA + ((uB - uA) * i) / n;
      const b = beamAt(u) * k;
      rows.push([new t.Vector3(xAt(u), y, -b), new t.Vector3(xAt(u), y, b)]);
    }
    return rows;
  };
  boat.add(shell(loft(deckSheet(U_QD - 0.01, U_FC + 0.01, Y_SOLE, 0.93, 16), [12, 3]), mat(t, DECK, { tex: 'wood', rough: 0.9, repeat: [1, 1] }), false));
  boat.add(shell(loft(deckSheet(U_FC - 0.005, 0.975, Y_FC, 0.9, 6), [4, 2]), mat(t, DECK, { tex: 'wood', rough: 0.9, repeat: [1, 1] }), false));
  boat.add(shell(loft(deckSheet(0.02, U_QD + 0.005, Y_QD, 0.92, 6), [4, 2]), mat(t, DECK, { tex: 'wood', rough: 0.9, repeat: [1, 1] }), false));

  // =======================================================================
  // 5. HULL DETAIL — wales, frames, cap rail, seams, shields, ports
  // =======================================================================
  const waleP: PartSpec[] = []; // near-black oak: wales, keel, stem, frames
  const trimP: PartSpec[] = []; // cap rail + mouldings in bulwark timber
  const goldP: PartSpec[] = []; // gilding: mouldings, grab rails, gunport rings
  const seamP: PartSpec[] = []; // deck seams, hatch coamings
  const redP: PartSpec[] = [];
  const creamP: PartSpec[] = [];
  const canvasP: PartSpec[] = [];
  const ropeP: PartSpec[] = [];
  const woodP: PartSpec[] = []; // benches, ladders, fittings
  const cushP: PartSpec[] = [];

  const V = (p: THREE.Vector3): V3 => [p.x, p.y, p.z];
  // THREE WALES down each side, each following the hull SURFACE (so they curve
  // in three dimensions), plus a gilded sheer moulding right under the cap.
  [-1, 1].forEach((sd) => {
    ([[0.99, 0.055, goldP], [0.86, 0.075, waleP], [0.64, 0.062, waleP], [0.4, 0.05, waleP]] as [number, number, PartSpec[]][]).forEach(
      ([w, th, into]) => {
        for (let i = 0; i < 24; i += 1) {
          const a = sect(0.03 + (i / 24) * 0.94, w, sd);
          const b = sect(0.03 + ((i + 1) / 24) * 0.94, w, sd);
          segP(G_BOX, V(a), V(b), th, into, 0.055);
        }
      },
    );
  });
  // the keel and the deadwood under it
  for (let i = 0; i < 24; i += 1) {
    const a = sect(0.02 + (i / 24) * 0.96, 0, 1);
    const b = sect(0.02 + ((i + 1) / 24) * 0.96, 0, 1);
    segP(G_BOX, [a.x, a.y - 0.03, 0], [b.x, b.y - 0.03, 0], 0.09, waleP, 0.13);
  }
  // THE CAP RAIL — the top of the gunwale, laid from its endpoints so it
  // follows the sheer. This is the line the eye reads as "ship".
  [-1, 1].forEach((sd) => {
    for (let i = 0; i < 20; i += 1) {
      const u0 = 0.03 + (i / 20) * 0.94;
      const u1 = 0.03 + ((i + 1) / 20) * 0.94;
      const a = sect(u0, 1, sd);
      const b = sect(u1, 1, sd);
      segP(
        G_BOX,
        [a.x, a.y + BULW(u0) + 0.02, inZ(a.z, 0.038)],
        [b.x, b.y + BULW(u1) + 0.02, inZ(b.z, 0.038)],
        0.055,
        trimP,
        0.11,
      );
    }
    // frames standing proud inboard, every other station
    for (let i = 0; i < 10; i += 1) {
      const u = 0.11 + (i / 10) * 0.74;
      const p = sect(u, 1, sd);
      const fz = inZ(p.z, 0.08);
      // TIMBER, not near-black. Against the cream inner face the wale colour read
      // as a row of black rectangles — holes in the side of the ship rather than ribs.
      segP(G_BOX, [p.x, p.y - 0.04, fz], [p.x, p.y + BULW(u) - 0.01, fz], 0.05, trimP, 0.04);
    }
  });
  // deck plank seams in the waist, and two hatch coamings
  for (let i = 0; i < 22; i += 1) {
    const u = U_QD + ((U_FC - U_QD) * i) / 21;
    slab([xAt(u), Y_SOLE + 0.012, 0], [0.035, 0.02, beamAt(u) * 1.82], seamP);
  }
  slab([-1.36, Y_SOLE + 0.05, 0], [0.4, 0.08, 0.44], seamP, [0, 0, 0], [3, 1]);
  slab([1.36, Y_SOLE + 0.05, 0], [0.34, 0.08, 0.38], seamP, [0, 0, 0], [3, 1]);
  // ROUND SHIELDS along the topsides, alternating red and cream — the cheap,
  // authentic bit of pirate dressing, and they break up a long brown flank
  [-1, 1].forEach((sd) => {
    for (let i = 0; i < 7; i += 1) {
      const u = 0.21 + i * 0.09;
      const p = sect(u, 0.87, sd);
      const m = mtx(t, [p.x, p.y, p.z * 1.02], [0, 0, Math.PI / 2], [0.245, 0.035, 0.245]);
      (i % 2 ? creamP : redP).push({ geo: G_DISC, matrix: m });
      goldP.push({ geo: G_DISC, matrix: mtx(t, [p.x, p.y, p.z * 1.05], [0, 0, Math.PI / 2], [0.08, 0.03, 0.08]) });
    }
    // gilded gunport rings low on the topside, with a dark port behind each
    for (let i = 0; i < 5; i += 1) {
      const u = 0.26 + i * 0.105;
      const p = sect(u, 0.63, sd);
      slab([p.x, p.y, p.z * 1.01], [0.15, 0.15, 0.03], waleP);
      goldP.push({ geo: G_DISC, matrix: mtx(t, [p.x, p.y, p.z * 1.03], [0, 0, Math.PI / 2], [0.185, 0.02, 0.185]) });
    }
  });

  // =======================================================================
  // 6. THE BOW — stem, trailboards, catheads, bowsprit, GILDED FIGUREHEAD
  // =======================================================================
  const stem = sect(0.985, 1, 1);
  // the stem post, in three shortening segments up the raked cutwater
  for (let i = 0; i < 2; i += 1) {
    const y0 = stem.y - 0.42 + i * 0.31;
    segP(G_BOX, [stem.x - 0.07 + i * 0.05, y0, 0], [stem.x + 0.01 + i * 0.07, y0 + 0.33, 0], 0.085 - i * 0.012, waleP, 0.1 - i * 0.015);
  }
  const STEM_HEAD: V3 = [stem.x + 0.13, stem.y + 0.2, 0];
  // gammoning lashings round the stem head
  [0, 1, 2].forEach((i) => segP(G_ROD4, [stem.x + 0.02 + i * 0.05, stem.y - 0.02 + i * 0.09, -0.06], [stem.x + 0.02 + i * 0.05, stem.y - 0.02 + i * 0.09, 0.06], 0.028, ropeP));
  // trailboards each side of the stem, and a cathead per bow
  [-1, 1].forEach((sd) => {
    segP(G_BOX, [stem.x - 0.42, stem.y - 0.14, sd * 0.11], [stem.x + 0.16, stem.y + 0.26, sd * 0.05], 0.05, goldP, 0.09);
    segP(G_BOX, [xAt(0.9), sheerAt(0.9) + 0.15, sd * beamAt(0.9) * 0.75], [xAt(0.975), sheerAt(0.9) + 0.19, sd * 0.2], 0.05, trimP, 0.06);
  });
  // THE BOWSPRIT, springing FROM the stem head. After rotZ = θ a cylinder's
  // axis is (−sinθ, cosθ, 0), so forward-and-up is θ = −(π/2 − rake); the
  // opposite sign aims it aft-and-down and leaves the spar hanging in space.
  const RAKE = 0.34;
  const SPRIT = 0.52;
  boat.add(
    cyl(t, 0.032, 0.055, SPRIT, RAIL, [STEM_HEAD[0] + Math.cos(RAKE) * SPRIT * 0.5, STEM_HEAD[1] + Math.sin(RAKE) * SPRIT * 0.5, 0], {
      rotZ: -(Math.PI / 2 - RAKE),
      tex: 'wood',
      rough: 0.85,
      seg: 8,
    }),
  );
  const SPRIT_TIP: V3 = [STEM_HEAD[0] + Math.cos(RAKE) * SPRIT, STEM_HEAD[1] + Math.sin(RAKE) * SPRIT, 0];
  // THE FIGUREHEAD — a gilded sea-lion under the bowsprit. Masses first, then
  // the mane RADIATES from endpoint-placed spikes: a sphere on a stick is not a
  // head, and that is exactly what the old "dragon head" was.
  const figP: PartSpec[] = [];
  const FH: V3 = [stem.x + 0.2, stem.y + 0.06, 0];
  blob([FH[0] - 0.16, FH[1] - 0.03, 0], [0.34, 0.26, 0.22], figP, [0, 0, 0.24]); // shoulders
  blob(FH, [0.24, 0.25, 0.2], figP); // skull
  blob([FH[0] + 0.15, FH[1] - 0.06, 0], [0.22, 0.14, 0.14], figP, [0, 0, -0.16]); // muzzle
  slab([FH[0] + 0.14, FH[1] - 0.11, 0], [0.19, 0.05, 0.11], figP, [0, 0, -0.2]); // jaw
  slab([FH[0] + 0.05, FH[1] + 0.09, 0], [0.13, 0.05, 0.19], figP, [0, 0, 0.22]); // brow
  for (let i = 0; i < 11; i += 1) {
    const a = -0.5 + (i / 10) * 1.5; // swept BACK and up off the crest, x-y plane
    const zz = (h01(i * 3.7) - 0.5) * 0.12;
    segP(
      G_ROD,
      [FH[0] - 0.05, FH[1] + 0.03, zz],
      [FH[0] - 0.05 - Math.cos(a) * 0.2, FH[1] + 0.03 + Math.sin(a) * 0.17, zz * 1.7],
      0.036,
      figP,
      0.022,
    );
  }
  [-1, 1].forEach((sd) => {
    segP(G_ROD, [FH[0] + 0.02, FH[1] + 0.1, sd * 0.055], [FH[0] - 0.1, FH[1] + 0.27, sd * 0.1], 0.05, figP, 0.02); // horns
    blob([FH[0] + 0.09, FH[1] + 0.02, sd * 0.075], [0.05, 0.05, 0.05], figP); // eyes
  });
  boat.add(mergedParts(t, figP, shiny(GOLD, 0.8, 0.3), false));

  // =======================================================================
  // 7. THE STERN — transom band, quarter galleries, taffrail, rudder, lantern
  // =======================================================================
  const tr = sect(0, 1, 1);
  // a gilded transom moulding + a band of three dark windows
  segP(G_BOX, [tr.x - 0.19, tr.y + 0.3, -0.2], [tr.x - 0.19, tr.y + 0.3, 0.2], 0.06, goldP, 0.09);
  [-0.14, 0, 0.14].forEach((z) => slab([tr.x - 0.22, tr.y + 0.16, z], [0.05, 0.16, 0.1], canvasP, [0, 0, 0.28]));
  segP(G_BOX, [tr.x - 0.17, tr.y - 0.02, -0.21], [tr.x - 0.17, tr.y - 0.02, 0.21], 0.05, goldP, 0.07);
  // quarter galleries — the little boxed balconies on the stern corners
  [-1, 1].forEach((sd) => {
    slab([xAt(0.055), sheerAt(0.055) + 0.02, sd * (beamAt(0.055) + 0.05)], [0.34, 0.28, 0.14], woodP, [0, 0, 0], [2, 1]);
    slab([xAt(0.055), sheerAt(0.055) + 0.19, sd * (beamAt(0.055) + 0.05)], [0.38, 0.05, 0.18], goldP);
    slab([xAt(0.055), sheerAt(0.055) - 0.14, sd * (beamAt(0.055) + 0.04)], [0.24, 0.06, 0.13], goldP, [0, 0, 0.3]);
    slab([xAt(0.055), sheerAt(0.055) + 0.03, sd * (beamAt(0.055) + 0.11)], [0.16, 0.14, 0.04], canvasP);
  });
  // taffrail across the stern, on turned stanchions
  {
    const yt = sheerAt(0.03) + BULW(0.03) + 0.24;
    [-1, 0, 1].forEach((k) => segP(G_ROD, [tr.x + 0.06, yt - 0.26, k * 0.14], [tr.x + 0.06, yt, k * 0.14], 0.038, goldP));
    segP(G_BOX, [tr.x + 0.06, yt, -0.22], [tr.x + 0.06, yt, 0.22], 0.05, trimP, 0.1);
  }
  // rudder + gudgeons
  segP(G_BOX, [tr.x + 0.04, tr.y - depAt(0) - 0.02, 0], [tr.x - 0.12, tr.y - 0.06, 0], 0.09, waleP, 0.35);
  [-1, 1].forEach((sd) => segP(G_ROD, [tr.x - 0.02, tr.y - 0.32, sd * 0.05], [tr.x - 0.02, tr.y - 0.24, sd * 0.05], 0.05, goldP));

  // =======================================================================
  // 8. DECK FURNITURE — breaks, ladders, wheel, capstan, bitts
  // =======================================================================
  // the break bulkheads under the raised decks
  slab([xAt(U_FC) - 0.02, (Y_SOLE + Y_FC) / 2, 0], [0.07, Y_FC - Y_SOLE, beamAt(U_FC) * 1.8], woodP, [0, 0, 0], [3, 1]);
  slab([xAt(U_QD) + 0.02, (Y_SOLE + Y_QD) / 2, 0], [0.07, Y_QD - Y_SOLE, beamAt(U_QD) * 1.8], woodP, [0, 0, 0], [3, 1]);
  // ladders up to each raised deck (treads placed from their endpoints)
  ([[xAt(U_FC) - 0.16, Y_FC, 1], [xAt(U_QD) + 0.16, Y_QD, -1]] as [number, number, number][]).forEach(([x0, yTop, dir]) => {
    [-1, 1].forEach((sd) => segP(G_BOX, [x0 + dir * 0.18, Y_SOLE, sd * 0.12], [x0, yTop, sd * 0.12], 0.045, woodP));
    for (let i = 1; i <= 3; i += 1) {
      const f = i / 4;
      segP(G_BOX, [x0 + dir * 0.18 * (1 - f), Y_SOLE + (yTop - Y_SOLE) * f, -0.13], [x0 + dir * 0.18 * (1 - f), Y_SOLE + (yTop - Y_SOLE) * f, 0.13], 0.035, woodP);
    }
  });
  // the ship's wheel on the quarterdeck: a gilded rim on 8 endpoint spokes
  {
    const wx = xAt(0.07);
    const wy = Y_QD + 0.23;
    slab([wx + 0.06, Y_QD + 0.08, 0], [0.12, 0.16, 0.3], woodP);
    for (let i = 0; i < 8; i += 1) {
      const a = (i / 8) * Math.PI * 2;
      segP(G_ROD, [wx, wy, 0], [wx, wy + Math.cos(a) * 0.2, Math.sin(a) * 0.2], 0.03, goldP);
    }
    for (let i = 0; i < 12; i += 1) {
      const a0 = (i / 12) * Math.PI * 2;
      const a1 = ((i + 1) / 12) * Math.PI * 2;
      segP(G_ROD, [wx, wy + Math.cos(a0) * 0.19, Math.sin(a0) * 0.19], [wx, wy + Math.cos(a1) * 0.19, Math.sin(a1) * 0.19], 0.032, goldP);
    }
  }
  // capstan + coiled rope + bitts on the forecastle
  boat.add(cyl(t, 0.09, 0.115, 0.22, RAIL, [xAt(0.93), Y_FC + 0.11, 0], { tex: 'wood', rough: 0.85, seg: 10 }));
  goldP.push({ geo: G_DISC, matrix: mtx(t, [xAt(0.93), Y_FC + 0.22, 0], [0, 0, 0], [0.2, 0.03, 0.2]) });
  [0, 1, 2].forEach((i) => segP(G_ROD4, [xAt(0.905) + i * 0.005, Y_FC + 0.02 + i * 0.035, -0.19], [xAt(0.905) + i * 0.005, Y_FC + 0.02 + i * 0.035, 0.19], 0.035, ropeP));
  [-1, 1].forEach((sd) => segP(G_ROD, [xAt(0.9), Y_FC, sd * 0.16], [xAt(0.9), Y_FC + 0.14, sd * 0.16], 0.045, woodP));

  // =======================================================================
  // 9. BENCHES — 5 rider rows x 2 spots. The seat ANCHORS keep their exact old
  //    positions (x = row + 0.075, y 0.24, z ±0.16) so `seatWorld` and every
  //    registered park that boards this ride are byte-compatible; what changed
  //    is that they now sit on real benches instead of against a flat plank.
  // =======================================================================
  const ROWS = [-1.0, -0.6, -0.2, 0.2, 0.6, 1.0];
  ROWS.forEach((x0, i) => {
    const u = x0 / LEN + 0.5;
    const hw = beamAt(u) * 0.87;
    // bench back: a panel with a shaped top rail
    slab([x0, 0.34, 0], [0.06, 0.24, hw * 2], woodP, [0, 0, 0], [1, 2]);
    slab([x0, 0.47, 0], [0.085, 0.045, hw * 2 + 0.03], trimP, [0, 0, 0], [1, 1]);
    if (i > 0) {
      // gilded grab rail on the AFT face for the row behind (lap-bar class)
      segP(G_ROD, [x0 - 0.055, 0.5, -hw], [x0 - 0.055, 0.5, hw], 0.045, goldP);
      [-1, 0, 1].forEach((k) => segP(G_ROD, [x0 - 0.055, 0.44, k * hw * 0.62], [x0 - 0.055, 0.51, k * hw * 0.62], 0.032, goldP));
    }
    if (i < 5) {
      // seat pan + cushion + cheeks + footrest
      slab([x0 + 0.17, 0.19, 0], [0.3, 0.09, hw * 2], woodP, [0, 0, 0], [2, 1]);
      slab([x0 + 0.17, 0.245, 0], [0.27, 0.025, hw * 1.9], cushP, [0, 0, 0], [3, 1]);
      slab([x0 + 0.05, 0.24, 0], [0.05, 0.16, hw * 1.94], cushP, [0, 0, 0], [3, 2]); // back cushion
      [-1, 1].forEach((sd) => slab([x0 + 0.17, 0.16, sd * hw], [0.28, 0.16, 0.05], woodP));
      slab([x0 + 0.38, 0.11, 0], [0.05, 0.05, hw * 1.7], trimP);
      [-0.16, 0.16].forEach((zz, k) => {
        const seat = new t.Group();
        seat.position.set(x0 + 0.075, 0.24, zz);
        seat.rotation.y = Math.PI / 2;
        boat.add(seat);
        seats.push(seat);
        if (withRiders) {
          const p = buildPeep(t, {
            skin: SKIN_TONES[(i * 2 + k) % SKIN_TONES.length],
            shirt: SHIRTS[(i * 2 + k) % SHIRTS.length],
            seated: true,
            expression: 'surprised',
          });
          p.group.userData.lodDetail = true; // the park runtime sheds riders past NEAR
          p.group.scale.setScalar(0.4);
          seat.add(p.group);
        }
      });
    }
  });

  // =======================================================================
  // 10. THE RIG — mast, top, yard, furled sail, shrouds, ratlines, pennant.
  //     This is the silhouette. The mast rises BETWEEN the pendulum arms on
  //     the centreline (which is why the pendulum had to stop being a
  //     centreline post) and its tip sits 1.0 u from the axle, so it can never
  //     reach the cross-beam however far the boat swings.
  // =======================================================================
  // MAST HEIGHT IS CONSTRAINED BY THE PENDULUM, and the first pass got it wrong
  // in the cheap direction. At MAST_TOP 1.50 the masthead sat only 0.3 u above
  // the stay anchors on the cap rail, so the fore-and-aft stays rendered as one
  // nearly HORIZONTAL black wire strung the whole length of the ship and the
  // mast itself never broke the frame's silhouette. The real ceiling is the axle
  // hub fairing: its underside is 0.30 u below the axle, i.e. boat-local 2.20,
  // and the four pendulum arms narrow to |x| = 0.95·(2.5−h)/2.58 at height h —
  // 0.125 at h = 2.20, which still clears a 0.02 flagstaff. So 1.92 for the
  // masthead and 2.20 for the truck is the most this rig can carry.
  const MAST_TOP = 1.92;
  boat.add(cyl(t, 0.038, 0.078, MAST_TOP - Y_SOLE + 0.1, RAIL, [0, (MAST_TOP + Y_SOLE) / 2, 0], { tex: 'wood', rough: 0.85, seg: 9 }));
  // mast collar + hoops
  [0.32, 0.86, 1.34].forEach((y) => goldP.push({ geo: G_DISC, matrix: mtx(t, [0, y, 0], [0, 0, 0], [0.13, 0.028, 0.13]) }));
  // crow's nest: a ring platform on four endpoint-placed knees
  {
    const ny = 1.5;
    for (let i = 0; i < 10; i += 1) {
      const a0 = (i / 10) * Math.PI * 2;
      const a1 = ((i + 1) / 10) * Math.PI * 2;
      segP(G_BOX, [Math.cos(a0) * 0.19, ny, Math.sin(a0) * 0.19], [Math.cos(a1) * 0.19, ny, Math.sin(a1) * 0.19], 0.055, woodP, 0.11);
      segP(G_BOX, [Math.cos(a0) * 0.19, ny + 0.13, Math.sin(a0) * 0.19], [Math.cos(a1) * 0.19, ny + 0.13, Math.sin(a1) * 0.19], 0.045, trimP, 0.05);
      if (i % 2 === 0) segP(G_ROD, [Math.cos(a0) * 0.185, ny, Math.sin(a0) * 0.185], [Math.cos(a0) * 0.185, ny + 0.14, Math.sin(a0) * 0.185], 0.03, woodP);
    }
    [0, 1, 2, 3].forEach((i) => {
      const a = (i / 4) * Math.PI * 2 + 0.4;
      segP(G_BOX, [0, ny - 0.24, 0], [Math.cos(a) * 0.19, ny - 0.01, Math.sin(a) * 0.19], 0.045, woodP);
    });
  }
  // the YARD runs ACROSS the beam (z), which is both correct and the only
  // direction that clears the pendulum arms in the x-y plane
  boat.add(cyl(t, 0.026, 0.034, 1.16, RAIL, [0, 1.24, 0], { rotX: Math.PI / 2, tex: 'wood', rough: 0.85, seg: 7 }));
  [-1, 1].forEach((sd) => goldP.push({ geo: G_DISC, matrix: mtx(t, [0, 1.24, sd * 0.5], [Math.PI / 2, 0, 0], [0.07, 0.03, 0.07]) }));
  // a FURLED sail bundled along the yard — a lofted sausage, gathered at each
  // gasket, not a flat plank
  {
    const rows: THREE.Vector3[][] = [];
    const N = 14;
    for (let i = 0; i <= N; i += 1) {
      const f = i / N;
      const z = -0.5 + f;
      const gather = 0.55 + 0.45 * Math.abs(Math.sin(f * Math.PI * 4));
      const r = 0.075 * gather;
      const row: THREE.Vector3[] = [];
      for (let j = 0; j <= 8; j += 1) {
        const a = (j / 8) * Math.PI * 2;
        row.push(new t.Vector3(Math.cos(a) * r, 1.19 + Math.sin(a) * r * 0.8, z));
      }
      rows.push(row);
    }
    boat.add(shell(loft(rows, [6, 1]), mat(t, CREAM, { tex: 'fabric', rough: 0.95, repeat: [4, 1] }), false));
  }
  // gaskets round the furl
  for (let i = 0; i < 5; i += 1) {
    const z = -0.4 + i * 0.2;
    segP(G_ROD4, [0, 1.12, z], [0, 1.28, z], 0.028, ropeP);
  }
  // SHROUDS + RATLINES: from the masthead down and outboard to the cap rail.
  // Every one is placed from its two endpoints, which is the whole reason they
  // can be a fan instead of a row of parallel sticks.
  [-1, 1].forEach((sd) => {
    const anchors: V3[] = [-0.34, 0, 0.34].map((dx) => {
      const u = (dx + 0.0) / LEN + 0.5;
      const p = sect(u, 1, sd);
      return [p.x, p.y + BULW(u) + 0.03, inZ(p.z, 0.038)] as V3;
    });
    const head: V3 = [0, MAST_TOP - 0.14, sd * 0.03];
    anchors.forEach((an) => segP(G_ROD4, head, an, 0.017, ropeP));
    // ratlines between the outer two shrouds
    for (let i = 1; i <= 5; i += 1) {
      const f = 0.2 + (i / 6) * 0.66;
      const a: V3 = [head[0] + (anchors[0][0] - head[0]) * f, head[1] + (anchors[0][1] - head[1]) * f, head[2] + (anchors[0][2] - head[2]) * f];
      const b: V3 = [head[0] + (anchors[2][0] - head[0]) * f, head[1] + (anchors[2][1] - head[1]) * f, head[2] + (anchors[2][2] - head[2]) * f];
      segP(G_ROD4, a, b, 0.013, ropeP);
    }
    // a backstay to the taffrail and a forestay to the bowsprit tip
    segP(G_ROD4, head, [tr.x + 0.06, sheerAt(0.03) + BULW(0.03) + 0.22, sd * 0.1], 0.016, ropeP);
    segP(G_ROD4, head, [SPRIT_TIP[0] - 0.04, SPRIT_TIP[1], sd * 0.03], 0.016, ropeP);
  });
  // THE JOLLY ROGER on a staff at the masthead, flying aft. Measured on the
  // first pass: the flag came out a 0.50 x 0.21 plane with 0.055 of z travel and
  // rendered BLACK-ON-GREEN as a thin vertical smear from most azimuths. Two
  // fixes, both about legibility at park distance: it is CRIMSON now (a black
  // rag against grass is a hole, and RCT2's own pirate banners are red), and it
  // has a real double curl in z so it presents cloth from every side.
  boat.add(cyl(t, 0.014, 0.02, 0.26, RAIL, [0, MAST_TOP + 0.09, 0], { tex: 'wood', seg: 6 }));
  {
    const rows: THREE.Vector3[][] = [];
    for (let i = 0; i <= 12; i += 1) {
      const f = i / 12;
      const x = -f * 0.62;
      const w = 0.135 * (1 - 0.3 * f);
      const flap = Math.sin(f * 3.4) * 0.055 * f;
      const curl = Math.sin(f * 4.6) * 0.15 * f; // the whole point: it is not a plane
      rows.push([
        new t.Vector3(x, MAST_TOP + 0.14 + w + flap, curl),
        new t.Vector3(x, MAST_TOP + 0.14 - w + flap, curl),
      ]);
    }
    boat.add(shell(loft(rows, [3, 1]), mat(t, 0xa8221c, { tex: 'fabric', rough: 0.95, repeat: [3, 1] }), false));
    // a bone skull and crossbones on the luff, big enough to read
    const sk: PartSpec[] = [];
    blob([-0.19, MAST_TOP + 0.17, 0.012], [0.11, 0.115, 0.02], sk);
    slab([-0.19, MAST_TOP + 0.095, 0.012], [0.1, 0.03, 0.02], sk, [0, 0, 0.28]);
    [-1, 1].forEach((k) => segP(G_ROD, [-0.32, MAST_TOP + 0.06 + k * 0.055, 0.012], [-0.06, MAST_TOP + 0.06 - k * 0.055, 0.012], 0.026, sk));
    boat.add(mergedParts(t, sk, mat(t, 0xece6d6, { rough: 0.8 }), false));
  }

  // =======================================================================
  // 11. NIGHT — one merged bulb mesh per frame of reference, a stern lantern,
  //     a masthead lamp, and the two PointLights this ride always had.
  // =======================================================================
  const bulbMat = new t.MeshStandardMaterial({ color: 0xfff3c0, emissive: 0xffb040, emissiveIntensity: 0.15, roughness: 0.35 });
  const lantMat = new t.MeshStandardMaterial({ color: 0xffe6a8, emissive: 0xffa832, emissiveIntensity: 0.12, roughness: 0.3 });
  // festoon bulbs strung along the frame ties (the old rig's 10, now on all three)
  {
    const bs: PartSpec[] = [];
    [-1, 1].forEach((zs) =>
      [0.75, 1.45, 2.2].forEach((y) => {
        const hw = Math.abs(legX(y, 1));
        const n = y < 1 ? 5 : 4;
        for (let i = 0; i < n; i += 1) {
          const x = -hw + 0.1 + ((hw * 2 - 0.2) * i) / (n - 1);
          bs.push({ geo: G_BULB, matrix: mtx(t, [x, y + 0.062, zs * LEG_Z], [0, 0, 0], [0.055, 0.068, 0.055]) });
        }
      }),
    );
    const m = mergedParts(t, bs, bulbMat, false);
    m.castShadow = false;
    g.add(m);
  }
  // lanterns along the boat's cap rail + the masthead lamp
  {
    const bs: PartSpec[] = [];
    [-1, 1].forEach((sd) => {
      for (let i = 0; i < 6; i += 1) {
        const u = 0.16 + i * 0.13;
        const p = sect(u, 1, sd);
        bs.push({ geo: G_BULB, matrix: mtx(t, [p.x, p.y + BULW(u) + 0.075, inZ(p.z, 0.038)], [0, 0, 0], [0.05, 0.06, 0.05]) });
      }
    });
    bs.push({ geo: G_BULB, matrix: mtx(t, [0, MAST_TOP - 0.02, 0], [0, 0, 0], [0.075, 0.09, 0.075]) });
    const m = mergedParts(t, bs, bulbMat, false);
    m.castShadow = false;
    boat.add(m);
  }
  // THE STERN LANTERN. The first pass was a 0.075-radius gold cylinder with a
  // tapered cap and it rendered as a YELLOW BOLLARD standing on the taffrail —
  // no glazing, no cage, no shape. A lantern is a GLAZED CAGE: six gold corner
  // posts between a base ring and a cornice, glass between them, a domed cap and
  // a finial on top, on a short pedestal.
  {
    const yt = sheerAt(0.03) + BULW(0.03) + 0.28;
    const lx = tr.x + 0.02;
    const LR = 0.058;
    segP(G_ROD, [lx, yt, 0], [lx, yt + 0.045, 0], 0.05, goldP); // pedestal
    goldP.push({ geo: G_DISC, matrix: mtx(t, [lx, yt + 0.055, 0], [0, 0, 0], [LR * 2.3, 0.022, LR * 2.3]) }); // base ring
    for (let i = 0; i < 6; i += 1) {
      const a = (i / 6) * Math.PI * 2;
      segP(G_ROD, [lx + Math.cos(a) * LR, yt + 0.055, Math.sin(a) * LR], [lx + Math.cos(a) * LR, yt + 0.2, Math.sin(a) * LR], 0.017, goldP);
    }
    goldP.push({ geo: G_DISC, matrix: mtx(t, [lx, yt + 0.208, 0], [0, 0, 0], [LR * 2.5, 0.024, LR * 2.5]) }); // cornice
    boat.add(gilt(cyl(t, 0.012, LR * 1.15, 0.075, GOLD, [lx, yt + 0.255, 0], { metal: 0.8, rough: 0.28, seg: 8 }), 1.15)); // dome
    boat.add(gilt(cyl(t, 0.02, 0.02, 0.05, GOLD, [lx, yt + 0.315, 0], { metal: 0.85, rough: 0.25, seg: 6 }), 1.15)); // finial
    // the glazing — an open-ended hexagonal drum, so it is a CAGE with light
    // inside it and not a solid post
    const glass = new t.Mesh(new t.CylinderGeometry(LR * 0.92, LR * 0.92, 0.145, 6, 1, true), lantMat);
    glass.position.set(lx, yt + 0.13, 0);
    glass.material.side = t.DoubleSide;
    glass.castShadow = false;
    boat.add(glass);
    const lens = new t.Mesh(new t.SphereGeometry(0.036, 8, 6), lantMat);
    lens.position.set(lx, yt + 0.13, 0);
    lens.castShadow = false;
    boat.add(lens);
  }
  const nightLights: { intensity: number }[] = [];
  [-0.95, 0.95].forEach((z) => {
    const pl = new t.PointLight(0xffc97a, 0, 6, 2);
    pl.position.set(0, pivotY - 0.12, z);
    g.add(pl);
    nightLights.push(pl);
  });

  // ---- flush every batch --------------------------------------------------
  boat.add(mergedParts(t, waleP, mat(t, WALE, { tex: 'wood', rough: 0.95 }), false));
  boat.add(mergedParts(t, trimP, mat(t, RAIL, { tex: 'wood', rough: 0.88 }), false));
  boat.add(mergedParts(t, woodP, mat(t, DECK, { tex: 'wood', rough: 0.88 }), false));
  boat.add(mergedParts(t, seamP, mat(t, 0x3a2a16, { tex: 'wood', rough: 1 }), false));
  boat.add(mergedParts(t, goldP, shiny(GOLD, 0.75, 0.3), false));
  boat.add(mergedParts(t, redP, mat(t, RED, { tex: 'wood', rough: 0.7 }), false));
  boat.add(mergedParts(t, creamP, mat(t, CREAM, { tex: 'wood', rough: 0.7 }), false));
  boat.add(mergedParts(t, canvasP, mat(t, GLASS, { rough: 0.45 }), false));
  boat.add(mergedParts(t, ropeP, mat(t, 0x776b55, { rough: 1 }), false));
  boat.add(mergedParts(t, cushP, mat(t, 0x7a2020, { tex: 'fabric', rough: 0.95 }), false));

  const update = (time: number, motionK = 1) => {
    // day -> night gate: festoon bulbs, cap-rail lanterns, the stern lantern
    // and the two pivot floods all rise together as it darkens
    const nk = nightKOf(g);
    const ease = nk * nk * (3 - 2 * nk); // smoothstep
    bulbMat.emissiveIntensity = 0.15 + (1.35 - 0.15) * ease;
    lantMat.emissiveIntensity = 0.12 + (2.1 - 0.12) * ease;
    nightLights.forEach((pl) => (pl.intensity = ease * 0.9));
    swing.rotation.z = Math.sin(time * 1.05) * 0.85 * motionK; // settles hanging level when parked
  };
  // station gate: the boat hangs LEVEL while guests board/unload (spinDown
  // 0.9 — at rest before 'unloadingPassengers' begins)
  const gate = createMotionGate((tt, k) => update(tt, k), { spinDown: 0.9 });
  return { group: g, update: gate.update, vehicle, seatWorld: makeSeatWorld(three, seats), onStateChange: gate.onStateChange };
}

/** <PirateShip> — composable ride (components/Park/Context.md): mounts the ride
 *  at `position`/`rotation`; inside a <Park>, `register` wires the full
 *  GameManager ride via <ConfigurableRide> — queue HEAD out the local +z
 *  front (lane extending +z), exit hut beside it, boarding at the base.
 *  Capacity 10 = 5 rider rows × 2 bench spots: REAL guests fill the benches
 *  via `seatWorld` (decorative riders off when registered — a half-full boat
 *  shows EMPTY spots) and the swing is motion-gated — hanging level for
 *  boarding/unloading. Override with top-level props / `queue`. */
export const PirateShip = composableRide<{ riders?: boolean }>(
  'PirateShip',
  (t, props) => buildPirateShipScene(t, { riders: props.riders ?? !(props as { register?: unknown }).register }),
  { defaults: { name: 'Pirate Ship', capacity: 10, rideDuration: 8, intensity: 5, price: 3 } },
);

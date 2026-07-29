import React from 'react';
import * as THREE from 'three';
import { box, cyl, mat, mergedParts, mtx, nightKOf } from '../Stage';
import { buildPeep, SHIRTS, SKIN_TONES } from '../Guest';
import { RideColourScheme } from '../ColorKit';
import { createMotionGate } from '../GameManager';
import { ConfigurableRide } from '../Park';
import type { ComposableRideProps, RideLayout } from '../Park';

// ---------------------------------------------------------------------------
// SwingingInverterShip — a HUSS-Inverter-class thrill ride.
//
// WHAT WAS WRONG (rendered and looked at, 2026-07-28). Every mass on this rig
// was the cheapest primitive that could stand in for it:
//   * THE COUNTERWEIGHT was `cyl(0.52, 0.52, 0.30, 0x3a3f47, metal 0.55)` with
//     no envMap — so a 1-metre machined flywheel rendered as a FLAT BLACK DISC
//     with a gold rim, i.e. a vinyl record bolted to the sky. This is the
//     measured design-system trap in its purest form: three.js takes a metal's
//     colour ENTIRELY from its reflections, so metalness with nothing to reflect
//     is dark grey paint. The axle and the bearing housings had it too.
//   * THE GONDOLA was a 1.0 x 0.32 x 1.5 BOX with a smaller box inside it for
//     the well and two boxes at `rotX ±0.5` for "upswept prows" — which read as
//     two flat flaps folded off the ends of a shoebox.
//   * THE ARM was three flat plates: a 0.52 root slab, a 0.32 shaft slab and a
//     pale 0.9 root plate that rendered as a white card behind the axle.
//   * THE TOWERS were two lattice frames in the SAME PLANE with only two thin
//     portal ties between them, so off the broadside they read as two separate
//     blue ladders standing next to each other rather than one space frame.
//
// WHAT IT IS NOW:
//  1. A SPACE FRAME. The two A-frames keep their exact leg geometry (the
//     registered footprint), but every member is placed from its endpoints and
//     they are now tied together OUT OF PLANE: horizontal ties and X-braces at
//     three heights, cast feet with base plates and anchor bolts, gusset plates
//     at each panel point, a caged access ladder up one leg, and a real pillow
//     block with a bolted cap at each bearing.
//  2. A TAPERED BOX GIRDER for the arm — a LOFTED four-sided beam whose depth
//     runs 0.54 at the root to 0.23 at the gondola, with corner flanges, web
//     stiffeners, a bolted root gusset and the strip lights let into its faces.
//  3. A BOLTED COUNTERWEIGHT STACK: three plates of decreasing radius, a hub
//     boss, radial rib plates, two rings of bolt heads and a painted hazard
//     band — all against a cached equirectangular envMap, so it reads as
//     machined steel catching the sky instead of a hole.
//  4. A LOFTED GONDOLA TUB with a real rockered keel, a fair sheer that SWEEPS
//     UP at both ends (the prows are the hull's own shape now, not flaps), a
//     floor pan, side bolsters, a roll bar that follows the gunwale, an arch
//     hoop at each end and painted nose panels.
//  5. Riders still in two facing rows of three under over-shoulder restraints,
//     on the SAME seat anchors as before — `seatWorld` and every registered
//     park that boards this ride are unchanged.
//
// The 26-second pump-up → five inversions → decay cycle, the motion gate, the
// breakdown freeze, the ColorKit `scheme` prop and the access layout are all
// untouched. Everything static in its own frame is merged by material, so the
// rebuilt rig costs FEWER draw calls than the box version it replaces.
// ---------------------------------------------------------------------------

/** local mirror of Stage's batch spec (a second `import type` line from the
 *  same module tripped the design-system resolver) */
type PartSpec = { geo: THREE.BufferGeometry; matrix: THREE.Matrix4; uv?: [number, number] };

// ---------------------------------------------------------------------------
// THE ENVIRONMENT the steelwork reflects — 256x128 equirectangular canvas, drawn
// once and cached. Sky over a LIT ground: a dark lower hemisphere is what made
// the first counterweight read as paint, so the ground band is a bright quay
// tone rather than a lawn.
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
  const sky = x.createLinearGradient(0, 0, 0, 64);
  sky.addColorStop(0, '#4b7cb4');
  sky.addColorStop(0.7, '#a6c4de');
  sky.addColorStop(1, '#e4eaea');
  x.fillStyle = sky;
  x.fillRect(0, 0, 256, 64);
  const gnd = x.createLinearGradient(0, 64, 0, 128);
  gnd.addColorStop(0, '#9aa091');
  gnd.addColorStop(1, '#55523f');
  x.fillStyle = gnd;
  x.fillRect(0, 64, 256, 64);
  x.fillStyle = '#e2e8e4';
  x.fillRect(0, 62, 256, 4);
  const spots: [number, number, number, string][] = [
    [82, 22, 18, '#fffdf4'],
    [210, 40, 8, '#ffeabf'],
  ];
  for (let i = 0; i < 18; i += 1) spots.push([8 + i * 14.2, 56, 4.2, '#ffe6ad']);
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
  _steelEnv = tex;
  return tex;
}

export interface SwingingInverterShipOpts {
  scheme?: RideColourScheme;
  /** decorative peep riders in the gondola (default true). A ride registered
   *  in a <Park> turns them off so the GameManager seats REAL guests via
   *  `seatWorld` instead. */
  riders?: boolean;
}

export interface SwingingInverterShipBuilt {
  group: THREE.Group;
  update: (time: number) => void;
  /** per-seat world transform (seat -> live inverting gondola) for GameManager seatWorld */
  seatWorld: (seat: number) => [number, number, number, number];
  /** the gondola for the RideViewer onboard cam (userData.rideVehicle) */
  vehicle: THREE.Object3D;
  /** GameManager FSM hook — the swing cycle freezes while brokenDown/beingRepaired */
  onStateChange: (state: string) => void;
}

export function buildSwingingInverterShipScene(three: typeof THREE, opts: SwingingInverterShipOpts = {}): SwingingInverterShipBuilt {
  const t = three;
  const g = new t.Group();
  const scheme = opts.scheme;
  const withRiders = opts.riders ?? true;
  const pivotY = 3.25;
  const FRAME = scheme?.track.supports ?? 0x2456b0; // royal-blue lattice towers
  const ARM = scheme?.track.main ?? 0xaeb4bc; // pale steel arm
  const GON = scheme?.vehicles[0]?.body ?? 0xc9a616; // golden-yellow gondola
  const TRIM = scheme?.vehicles[0]?.trim ?? 0x24242a; // restraint steel
  const STEEL = 0x3a3f47;
  const BRIGHT = 0x9aa3ad; // machined/galvanised steel
  const CONCRETE = 0x8a8f98;
  const HAZARD = 0xd8b040;
  const OFFWHITE = 0xe4e0d4;

  // =======================================================================
  // shared helpers — endpoint placement, lofting, reflective metal
  // =======================================================================
  const env = steelEnv(t);
  /** a material that REFLECTS. `metalness` with no envMap is grey paint: that is
   *  what turned this ride's 1 m counterweight into a black disc. */
  const shiny = (color: number, metal: number, rough: number, texName?: 'metal') => {
    const m = mat(t, color, { metal, rough, tex: texName, repeat: [2, 2] });
    if (env) {
      m.envMap = env;
      m.envMapIntensity = metal > 0.8 ? 1.2 : 0.85;
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
  const G_ROD = new t.CylinderGeometry(0.5, 0.5, 1, 7);
  const G_DISC = new t.CylinderGeometry(0.5, 0.5, 1, 14);
  const G_BULB = new t.SphereGeometry(0.5, 8, 6);

  const YA = new t.Vector3(0, 1, 0);
  const _d = new t.Vector3();
  const _mid = new t.Vector3();
  const _q = new t.Quaternion();
  type V3 = [number, number, number];
  /** a +Y unit geometry laid FROM a TO b — the only way to point a part at an
   *  arbitrary direction. Every leg, rung, brace, flange, rib, roll bar and
   *  ladder rung below goes through it. */
  const segP = (geo: THREE.BufferGeometry, a: V3, b: V3, w: number, into: PartSpec[], w2?: number) => {
    _d.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    const len = _d.length();
    if (len < 1e-5) return;
    _mid.set((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2);
    _q.setFromUnitVectors(YA, _d.normalize());
    into.push({ geo, matrix: new t.Matrix4().compose(_mid.clone(), _q.clone(), new t.Vector3(w, len, w2 ?? w)) });
  };
  const slab = (pos: V3, dims: V3, into: PartSpec[], rot: V3 = [0, 0, 0], uv?: [number, number]) =>
    into.push({ geo: G_BOX, matrix: mtx(t, pos, rot, dims), uv });
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
  const shell = (geo: THREE.BufferGeometry, m: THREE.MeshStandardMaterial, cast = true) => {
    m.side = t.DoubleSide;
    const me = new t.Mesh(geo, m);
    me.castShadow = cast;
    me.receiveShadow = true;
    return me;
  };

  // ---- batches ------------------------------------------------------------
  const frameP: PartSpec[] = []; // painted blue tower steel
  const gussetP: PartSpec[] = []; // darker gussets + base plates
  const steelP: PartSpec[] = []; // machined/galvanised bright steel
  const boltP: PartSpec[] = [];
  const padP: PartSpec[] = []; // concrete
  const kerbP: PartSpec[] = [];
  const railP: PartSpec[] = [];

  // =======================================================================
  // 1. THE LATTICE A-TOWERS — the same legs, now a braced SPACE FRAME
  // =======================================================================
  const legBotX = 1.55;
  const legTopX = 0.18;
  const hwAt = (y: number) => legBotX - ((legBotX - legTopX) / pivotY) * y;
  const TZ = 0.95; // the two frame planes — UNCHANGED (registered footprint)
  [-1, 1].forEach((zs) => {
    const z = zs * TZ;
    [-1, 1].forEach((xs) => {
      // the leg in two tapering segments, from its endpoints
      segP(G_BOX, [xs * legBotX, 0.12, z], [xs * hwAt(1.7), 1.7, z], 0.155, frameP, 0.15);
      segP(G_BOX, [xs * hwAt(1.68), 1.68, z], [xs * hwAt(pivotY + 0.1), pivotY + 0.1, z], 0.125, frameP, 0.125);
      // cast foot: concrete pad, base plate, four anchor bolts
      slab([xs * legBotX, 0.06, z], [0.6, 0.14, 0.5], padP, [0, 0, 0], [3, 1]);
      slab([xs * legBotX, 0.15, z], [0.42, 0.05, 0.38], gussetP);
      [-1, 1].forEach((a) =>
        [-1, 1].forEach((b) => segP(G_ROD, [xs * legBotX + a * 0.17, 0.14, z + b * 0.15], [xs * legBotX + a * 0.17, 0.23, z + b * 0.15], 0.05, boltP)),
      );
      slab([xs * hwAt(1.69), 1.69, z + zs * 0.095], [0.3, 0.2, 0.025], frameP, [0, 0, xs * 0.4]); // knee splice plate
    });
    // in-plane rungs + alternating diagonals (the familiar lattice), endpoint-placed
    const rungYs = [0.55, 1.1, 1.65, 2.2, 2.75];
    rungYs.forEach((y, i) => {
      const hw = hwAt(y);
      segP(G_BOX, [-hw, y, z], [hw, y, z], 0.06, frameP);
      const yp = i === 0 ? 0.16 : rungYs[i - 1];
      const hp = hwAt(yp);
      const dir = i % 2 ? 1 : -1;
      segP(G_BOX, [-dir * hp, yp, z], [dir * hw, y, z], 0.05, frameP);
      // a gusset PLATE on the outboard face of the leg, in the tower's own paint
      slab([dir * hw, y, z + zs * 0.095], [0.21, 0.21, 0.025], frameP);
    });
    // THE PILLOW BLOCK at the apex: a body, a bolted cap and four bolts, not a box
    slab([0, pivotY - 0.06, z], [0.46, 0.3, 0.24], steelP, [0, 0, 0], [2, 2]);
    slab([0, pivotY + 0.13, z], [0.5, 0.1, 0.26], steelP, [0, 0, 0], [2, 1]);
    [-1, 1].forEach((a) => segP(G_ROD, [a * 0.2, pivotY - 0.16, z], [a * 0.2, pivotY + 0.2, z], 0.055, boltP));
    slab([0, pivotY - 0.25, z], [0.34, 0.1, 0.28], frameP);
  });
  // OUT-OF-PLANE BRACING. This is the fix for "two blue ladders standing side by
  // side": horizontal ties plus a full X between the frames at three heights, so
  // the towers are one three-dimensional structure from every azimuth.
  [0.55, 2.75].forEach((y) => {
    const hw = hwAt(y);
    [-1, 1].forEach((xs) => segP(G_BOX, [xs * hw, y, -TZ], [xs * hw, y, TZ], 0.055, frameP));
  });
  ([[0.55, 1.65], [1.65, 2.75]] as [number, number][]).forEach(([y0, y1]) => {
    [-1, 1].forEach((xs) => {
      segP(G_BOX, [xs * hwAt(y0), y0, -TZ], [xs * hwAt(y1), y1, TZ], 0.032, frameP);
      segP(G_BOX, [xs * hwAt(y0), y0, TZ], [xs * hwAt(y1), y1, -TZ], 0.032, frameP);
    });
  });
  // portal ties right under the bearings (kept from the original silhouette)
  [-0.32, 0.32].forEach((x) => segP(G_BOX, [x, 2.92, -TZ], [x, 2.92, TZ], 0.075, frameP));
  // ACCESS LADDER up the −x leg of the +z frame, with a back cage — every real
  // fairground tower has one and it is what gives the leg a sense of scale
  {
    const lz = TZ + 0.17;
    const lx = (y: number) => -hwAt(y) + 0.02;
    [-1, 1].forEach((sd) => segP(G_BOX, [lx(0.3) + sd * 0.11, 0.3, lz], [lx(2.85) + sd * 0.11, 2.85, lz], 0.035, steelP));
    for (let i = 0; i <= 8; i += 1) {
      const y = 0.35 + (i / 8) * 2.45;
      segP(G_ROD, [lx(y) - 0.11, y, lz], [lx(y) + 0.11, y, lz], 0.034, steelP);
      if (i % 4 === 0) {
        // cage hoop behind the ladder
        [-1, 1].forEach((sd) => segP(G_ROD, [lx(y) + sd * 0.11, y, lz], [lx(y) + sd * 0.2, y, lz + 0.2], 0.024, steelP));
        segP(G_ROD, [lx(y) - 0.2, y, lz + 0.2], [lx(y) + 0.2, y, lz + 0.2], 0.024, steelP);
      }
    }
    // a small maintenance platform at the bearing
    slab([-0.42, 2.92, lz - 0.02], [0.5, 0.045, 0.42], steelP, [0, 0, 0], [3, 3]);
    [-0.64, -0.2].forEach((x) => segP(G_ROD, [x, 2.94, lz + 0.18], [x, 3.28, lz + 0.18], 0.028, railP));
    segP(G_ROD, [-0.68, 3.26, lz + 0.18], [-0.16, 3.26, lz + 0.18], 0.026, railP);
  }
  // main axle + hub caps — now reflective, so it is a machined shaft not a black tube
  g.add(gilt(cyl(t, 0.11, 0.11, 2.2, BRIGHT, [0, pivotY, 0], { rotX: Math.PI / 2, tex: 'metal', metal: 0.85, rough: 0.28, seg: 16 }), 1.15));
  [-1.06, 1.06].forEach((z) => {
    g.add(gilt(cyl(t, 0.19, 0.19, 0.08, GON, [0, pivotY, z], { rotX: Math.PI / 2, metal: 0.5, rough: 0.4, seg: 18 }), 0.8));
    g.add(gilt(cyl(t, 0.07, 0.07, 0.13, BRIGHT, [0, pivotY, z], { rotX: Math.PI / 2, metal: 0.9, rough: 0.22, seg: 10 }), 1.2));
  });

  // =======================================================================
  // 2. NIGHT RIG — leg accent bulbs, arm strips, bearing + deck lights
  // =======================================================================
  const bulbMat = new t.MeshStandardMaterial({ color: 0xfff3c0, emissive: 0xffb040, emissiveIntensity: 0.15, roughness: 0.35 });
  const stripMat = new t.MeshStandardMaterial({ color: 0xffd090, emissive: 0xff9030, emissiveIntensity: 0.12, roughness: 0.4 });
  {
    const bs: PartSpec[] = [];
    [-1, 1].forEach((zs) =>
      [-1, 1].forEach((xs) => {
        for (let i = 0; i < 5; i += 1) {
          const f = 0.14 + i * 0.17;
          const y = pivotY * f;
          bs.push({ geo: G_BULB, matrix: mtx(t, [xs * hwAt(y), y, zs * (TZ + 0.085)], [0, 0, 0], [0.06, 0.075, 0.06]) });
        }
      }),
    );
    const m = mergedParts(t, bs, bulbMat, false);
    m.castShadow = false;
    g.add(m);
  }
  const nightLights: { intensity: number }[] = [];
  [-1.15, 1.15].forEach((z) => {
    const pl = new t.PointLight(0xffc97a, 0, 7, 2);
    pl.position.set(0, pivotY - 0.15, z);
    g.add(pl);
    nightLights.push(pl);
  });
  const deckLight = new t.PointLight(0xffd9a0, 0, 5, 2); // platform up-wash
  deckLight.position.set(0, 0.7, 0);
  g.add(deckLight);

  // =======================================================================
  // 3. BOARDING PLATFORM — same footprint, real edges
  //    (gondola keel bottoms out at y ≈ 0.48 — deck top 0.22 stays clear)
  // =======================================================================
  g.add(box(t, [1.7, 0.22, 2.5], CONCRETE, [0, 0.11, 0], { tex: 'concrete', repeat: [5, 6], rough: 0.9 }));
  [-1, 1].forEach((zs) => {
    slab([0, 0.235, zs * 1.24], [1.74, 0.05, 0.07], kerbP, [0, 0, 0], [14, 1]);
    slab([0, 0.05, zs * 1.48], [0.9, 0.1, 0.5], padP, [0, 0, 0], [3, 1]); // steps
    slab([0, 0.105, zs * 1.66], [0.9, 0.09, 0.16], padP, [0, 0, 0], [3, 1]);
  });
  [-1, 1].forEach((xs) => slab([xs * 0.845, 0.235, 0], [0.07, 0.05, 2.54], kerbP, [0, 0, 0], [1, 14]));
  // hazard chequer down the boarding lane, and a drain grate
  for (let i = 0; i < 10; i += 1) slab([-0.62 + (i % 2) * 1.24, 0.234, -1.13 + i * 0.25], [0.34, 0.022, 0.16], kerbP);
  for (let i = 0; i < 5; i += 1) slab([0, 0.236, -0.24 + i * 0.12], [0.34, 0.024, 0.045], gussetP);
  // queue railings along both platform edges (clear of the swing plane), with
  // proper gate posts at the boarding face
  [-1, 1].forEach((zs) => {
    [-0.7, 0, 0.7].forEach((x) => segP(G_ROD, [x, 0.22, zs * 1.2], [x, 0.6, zs * 1.2], 0.026, railP));
    segP(G_ROD, [-0.82, 0.58, zs * 1.2], [0.82, 0.58, zs * 1.2], 0.024, railP);
    segP(G_ROD, [-0.82, 0.4, zs * 1.2], [0.82, 0.4, zs * 1.2], 0.02, railP);
    [-1, 1].forEach((xs) => {
      segP(G_BOX, [xs * 0.56, 0.22, zs * 1.2], [xs * 0.56, 0.92, zs * 1.2], 0.08, frameP);
      slab([xs * 0.56, 0.95, zs * 1.2], [0.13, 0.05, 0.13], gussetP);
    });
  });

  // =======================================================================
  // 4. THE ARM — a lofted TAPERED BOX GIRDER, not three flat plates
  // =======================================================================
  const arm = new t.Group();
  arm.position.set(0, pivotY, 0);
  g.add(arm);
  const armP: PartSpec[] = []; // pale steel stiffeners — ARM frame
  const armDkP: PartSpec[] = []; // dark structural steel — ARM frame
  const armBoltP: PartSpec[] = []; // bolt heads — ARM frame (NOT the group's boltP)

  /** four-sided tapered beam between two stations on the arm's y axis.
   *  `hx` is the DEPTH (the bending direction — the arm swings in x/y) and `hz`
   *  the width. Five perimeter points per row so the loft closes the tube. */
  const girder = (y0: number, y1: number, hx0: number, hx1: number, hz0: number, hz1: number, n = 8) => {
    const rows: THREE.Vector3[][] = [];
    for (let i = 0; i <= n; i += 1) {
      const f = i / n;
      const y = y0 + (y1 - y0) * f;
      const hx = hx0 + (hx1 - hx0) * f;
      const hz = hz0 + (hz1 - hz0) * f;
      rows.push([
        new t.Vector3(hx, y, hz),
        new t.Vector3(hx, y, -hz),
        new t.Vector3(-hx, y, -hz),
        new t.Vector3(-hx, y, hz),
        new t.Vector3(hx, y, hz),
      ]);
    }
    return rows;
  };
  const SHAFT_TIP = -2.42;
  arm.add(shell(loft(girder(-0.05, SHAFT_TIP, 0.27, 0.115, 0.105, 0.075, 10), [4, 6]), mat(t, ARM, { tex: 'metal', metal: 0.45, rough: 0.42, repeat: [1, 1] })));
  arm.add(shell(loft(girder(0.05, 1.0, 0.25, 0.15, 0.1, 0.085, 5), [4, 3]), mat(t, ARM, { tex: 'metal', metal: 0.45, rough: 0.42, repeat: [1, 1] })));
  // CORNER FLANGES down all four edges of the shaft — the lines that make a
  // girder read as fabricated steel rather than an extruded prism
  ([[1, 1], [1, -1], [-1, -1], [-1, 1]] as [number, number][]).forEach(([sx, sz]) => {
    segP(G_BOX, [sx * 0.27, -0.05, sz * 0.105], [sx * 0.115, SHAFT_TIP, sz * 0.075], 0.032, armDkP, 0.035);
    segP(G_BOX, [sx * 0.25, 0.05, sz * 0.1], [sx * 0.15, 1.0, sz * 0.085], 0.03, armDkP, 0.032);
  });
  // WEB STIFFENERS across both x faces, with a bolt at each end
  for (let i = 0; i < 8; i += 1) {
    const f = 0.06 + (i / 7) * 0.88;
    const y = -0.05 + (SHAFT_TIP + 0.05) * f;
    const hx = 0.27 + (0.115 - 0.27) * f;
    const hz = 0.105 + (0.075 - 0.105) * f;
    [-1, 1].forEach((sx) => {
      segP(G_BOX, [sx * (hx + 0.012), y, -hz], [sx * (hx + 0.012), y, hz], 0.05, armP, 0.03);
      [-1, 1].forEach((sz) => segP(G_ROD, [sx * (hx + 0.01), y, sz * hz * 0.7], [sx * (hx + 0.035), y, sz * hz * 0.7], 0.035, armBoltP));
    });
  }
  // ROOT GUSSET + bearing boss: the arm has to look BOLTED to the axle
  [-1, 1].forEach((sz) => {
    segP(G_BOX, [0.06, 0.4, sz * 0.115], [0.36, -0.42, sz * 0.115], 0.14, armDkP, 0.028);
    segP(G_BOX, [-0.06, 0.4, sz * 0.115], [-0.36, -0.42, sz * 0.115], 0.14, armDkP, 0.028);
  });
  arm.add(gilt(cyl(t, 0.24, 0.24, 0.44, STEEL, [0, 0, 0], { rotX: Math.PI / 2, tex: 'metal', repeat: [4, 1], metal: 0.7, rough: 0.32, seg: 18 }), 1.0));
  [-0.23, 0.23].forEach((z) => arm.add(gilt(cyl(t, 0.26, 0.26, 0.05, STEEL, [0, 0, z], { metal: 0.8, rough: 0.28, seg: 18, rotX: Math.PI / 2 }), 1.1)));
  for (let i = 0; i < 8; i += 1) {
    const a = (i / 8) * Math.PI * 2;
    [-1, 1].forEach((sz) => segP(G_ROD, [Math.cos(a) * 0.17, Math.sin(a) * 0.17, sz * 0.24], [Math.cos(a) * 0.17, Math.sin(a) * 0.17, sz * 0.29], 0.04, armBoltP));
  }
  // strip lights let into both z faces of the shaft
  [-1, 1].forEach((zs) => {
    const strip = new t.Mesh(new t.BoxGeometry(0.05, 1.9, 0.02), stripMat);
    strip.position.set(0, -1.3, zs * 0.1);
    strip.castShadow = false;
    arm.add(strip);
  });

  // =======================================================================
  // 5. THE COUNTERWEIGHT — a bolted plate STACK that reflects, not a black disc
  // =======================================================================
  const cwY = 1.05;
  const cwP: PartSpec[] = []; // bright machined plates
  const cwDkP: PartSpec[] = []; // dark ribs + hub boss — the CONTRAST
  ([[0.52, 0.1, 0], [0.44, 0.035, 0.135], [0.34, 0.035, 0.2]] as [number, number, number][]).forEach(([r, half, zc]) => {
    [-1, 1].forEach((sz) => {
      if (zc === 0 && sz < 0) return;
      cwP.push({ geo: G_DISC, matrix: mtx(t, [0, cwY, sz * zc], [Math.PI / 2, 0, 0], [r * 2, half * 2, r * 2]) });
    });
  });
  // hub boss through the stack + radial rib plates on both faces
  cwDkP.push({ geo: G_DISC, matrix: mtx(t, [0, cwY, 0], [Math.PI / 2, 0, 0], [0.34, 0.5, 0.34]) });
  for (let i = 0; i < 6; i += 1) {
    const a = (i / 6) * Math.PI * 2;
    [-1, 1].forEach((sz) =>
      segP(
        G_BOX,
        [Math.cos(a) * 0.18, cwY + Math.sin(a) * 0.18, sz * 0.115],
        [Math.cos(a) * 0.48, cwY + Math.sin(a) * 0.48, sz * 0.115],
        0.085,
        cwDkP,
        0.06,
      ),
    );
  }
  // two rings of bolt heads, on the outer plate face and round the boss
  for (let i = 0; i < 12; i += 1) {
    const a = (i / 12) * Math.PI * 2 + 0.13;
    [-1, 1].forEach((sz) => segP(G_ROD, [Math.cos(a) * 0.475, cwY + Math.sin(a) * 0.475, sz * 0.075], [Math.cos(a) * 0.475, cwY + Math.sin(a) * 0.475, sz * 0.13], 0.055, armBoltP));
  }
  for (let i = 0; i < 8; i += 1) {
    const a = (i / 8) * Math.PI * 2;
    [-1, 1].forEach((sz) => segP(G_ROD, [Math.cos(a) * 0.255, cwY + Math.sin(a) * 0.255, sz * 0.2], [Math.cos(a) * 0.255, cwY + Math.sin(a) * 0.255, sz * 0.245], 0.05, armBoltP));
  }
  arm.add(mergedParts(t, cwP, shiny(BRIGHT, 0.7, 0.33, 'metal'), false));
  arm.add(mergedParts(t, cwDkP, shiny(STEEL, 0.7, 0.35), false));
  // a PAINTED hazard band round the rim in the ride's own trim colour, so the
  // mass reads at a distance instead of being a grey wheel
  {
    const hz: PartSpec[] = [];
    const hzDk: PartSpec[] = [];
    for (let i = 0; i < 14; i += 1) {
      const a0 = (i / 14) * Math.PI * 2;
      const a1 = ((i + 1) / 14) * Math.PI * 2;
      const into = i % 2 ? hzDk : hz;
      for (let k = 0; k < 2; k += 1) {
        const a = a0 + ((a1 - a0) * k) / 2;
        const b = a0 + ((a1 - a0) * (k + 1)) / 2;
        segP(G_BOX, [Math.cos(a) * 0.535, cwY + Math.sin(a) * 0.535, 0], [Math.cos(b) * 0.535, cwY + Math.sin(b) * 0.535, 0], 0.05, into, 0.21);
      }
    }
    arm.add(mergedParts(t, hz, mat(t, HAZARD, { metal: 0.25, rough: 0.5 }), false));
    arm.add(mergedParts(t, hzDk, mat(t, 0x24242a, { metal: 0.2, rough: 0.55 }), false));
  }

  // =======================================================================
  // 6. THE GONDOLA — a LOFTED tub whose prows are its own sheer
  // =======================================================================
  const gon = new t.Group();
  gon.position.y = -2.45;
  arm.add(gon);
  const gonP: PartSpec[] = []; // gondola body paint — GON frame
  const gonSteelP: PartSpec[] = []; // gondola spine/risers/knees — GON frame
  const gTrimP: PartSpec[] = []; // dark restraint / bolster steel
  const gBrightP: PartSpec[] = []; // bright steel: roll bar, rails
  const gWhiteP: PartSpec[] = [];
  const cushP: PartSpec[] = [];

  const LZ = 1.62; // tub length along the axle
  /** the gunwale line — it SWEEPS UP at both ends. The old prows were two boxes
   *  at `rotX ±0.5`; this is the tub's own sheer, which is the difference between
   *  a boat shape and a shoebox with flaps. */
  const gunAt = (v: number) => 0.24 + 0.3 * Math.pow(Math.abs(2 * v - 1), 2.2);
  /** a ROCKERED keel: deepest amidships, rising to nothing at the ends. The keel
   *  must not go below −0.33 — at −0.35 the tub clips the 0.22 boarding deck at
   *  the bottom of the loop. */
  const keelAt = (v: number) => -0.32 + 0.3 * Math.pow(Math.abs(2 * v - 1), 1.8);
  const hwAtV = (v: number) => 0.28 + 0.24 * Math.pow(Math.sin(Math.PI * v), 0.6);
  const zAt = (v: number) => -LZ / 2 + v * LZ;
  const tub = (v: number, w: number, sd: number) => {
    const gu = gunAt(v);
    const dep = gu - keelAt(v);
    return new t.Vector3(sd * hwAtV(v) * Math.pow(w, 0.42), gu - dep * (1 - Math.pow(w, 2.7)), zAt(v));
  };
  {
    const rows: THREE.Vector3[][] = [];
    const N = 20;
    const M = 7;
    for (let i = 0; i <= N; i += 1) {
      const v = i / N;
      const row: THREE.Vector3[] = [];
      for (let j = -M; j <= M; j += 1) row.push(j === 0 ? tub(v, 0, 1) : tub(v, Math.abs(j) / M, Math.sign(j)));
      rows.push(row);
    }
    gon.add(shell(loft(rows, [3, 5]), mat(t, GON, { tex: 'plastic', rough: 0.42, repeat: [1, 1] })));
  }
  // the FLOOR PAN the seats stand on, at the height they were always at
  {
    const rows: THREE.Vector3[][] = [];
    for (let i = 0; i <= 10; i += 1) {
      const v = 0.06 + (i / 10) * 0.88;
      const b = hwAtV(v) * 0.9;
      rows.push([new t.Vector3(-b, 0.11, zAt(v)), new t.Vector3(b, 0.11, zAt(v))]);
    }
    gon.add(shell(loft(rows, [4, 5]), mat(t, 0x23262c, { tex: 'plastic', rough: 0.7, repeat: [1, 1] }), false));
  }
  // ROLL BAR following the gunwale all the way round, plus an arch hoop over
  // each prow — every piece placed from its endpoints, so it follows the sheer
  [-1, 1].forEach((sd) => {
    for (let i = 0; i < 20; i += 1) {
      const v0 = i / 20;
      const v1 = (i + 1) / 20;
      const a = tub(v0, 1, sd);
      const b = tub(v1, 1, sd);
      segP(G_ROD, [a.x, a.y + 0.035, a.z], [b.x, b.y + 0.035, b.z], 0.055, gBrightP);
      // a rub strake a little below it, in the body colour
      const a2 = tub(v0, 0.82, sd);
      const b2 = tub(v1, 0.82, sd);
      segP(G_BOX, [a2.x, a2.y, a2.z], [b2.x, b2.y, b2.z], 0.05, gWhiteP, 0.05);
    }
    // side bolsters inside the tub
    slab([sd * 0.44, 0.2, 0], [0.07, 0.13, 1.3], gTrimP, [0, 0, 0], [1, 6]);
  });
  [0, 1].forEach((e) => {
    const v = e ? 0.985 : 0.015;
    const zz = zAt(v);
    const hw = hwAtV(v);
    const gu = gunAt(v);
    for (let i = 0; i < 8; i += 1) {
      const a0 = (i / 8) * Math.PI;
      const a1 = ((i + 1) / 8) * Math.PI;
      segP(
        G_ROD,
        [-Math.cos(a0) * hw, gu + Math.sin(a0) * 0.16, zz],
        [-Math.cos(a1) * hw, gu + Math.sin(a1) * 0.16, zz],
        0.045,
        gBrightP,
      );
    }
    // painted nose panel + a chevron on it
    slab([0, gu - 0.06, zz + (e ? 0.035 : -0.035)], [hw * 1.5, 0.16, 0.03], gWhiteP);
    [-1, 1].forEach((sx) => segP(G_BOX, [sx * hw * 0.7, gu - 0.14, zz + (e ? 0.05 : -0.05)], [0, gu + 0.02, zz + (e ? 0.05 : -0.05)], 0.05, gTrimP, 0.03));
  });
  // spine + risers tying the tub to the arm shaft (shaft ends at arm-local −2.42)
  slab([0, 0.36, 0], [0.24, 0.14, 1.36], gonSteelP, [0, 0, 0], [1, 5]);
  [-0.56, 0.56].forEach((z) => slab([0, 0.2, z], [0.14, 0.34, 0.14], gonSteelP));
  [-1, 1].forEach((sx) => [-1, 1].forEach((sz) => segP(G_BOX, [sx * 0.1, 0.42, sz * 0.62], [sx * 0.2, 0.2, sz * 0.3], 0.045, gonSteelP)));
  // a keel strake + belly hatch under the tub
  for (let i = 0; i < 16; i += 1) {
    const v0 = 0.06 + (i / 16) * 0.88;
    const v1 = 0.06 + ((i + 1) / 16) * 0.88;
    segP(G_BOX, [0, keelAt(v0) - 0.01, zAt(v0)], [0, keelAt(v1) - 0.01, zAt(v1)], 0.13, gBrightP, 0.05);
  }
  slab([0, keelAt(0.5) - 0.02, 0], [0.3, 0.05, 0.34], gTrimP);

  // ---- seats: two facing rows of three. THE ANCHORS DO NOT MOVE. ----------
  const seatAnchors: THREE.Group[] = [];
  for (let r = 0; r < 2; r += 1) {
    const xs = r === 0 ? 1 : -1;
    // full-row chest restraint rail in front of the riders' chests
    segP(G_ROD, [xs * 0.1, 0.35, -0.63], [xs * 0.1, 0.35, 0.63], 0.05, gBrightP);
    [-0.63, 0.63].forEach((z) => segP(G_ROD, [xs * 0.1, 0.35, z], [xs * 0.28, 0.35, z], 0.045, gBrightP));
    for (let i = 0; i < 3; i += 1) {
      const z = -0.42 + i * 0.42;
      const seat = new t.Group();
      seat.position.set(xs * 0.27, 0, z);
      seat.rotation.y = xs > 0 ? -Math.PI / 2 : Math.PI / 2; // face the centre
      gon.add(seat);
      // moulded bucket seat: pan, bolstered back, wings, headrest
      seat.add(box(t, [0.3, 0.06, 0.26], 0x2f333a, [0, 0.14, -0.03], { rough: 0.6 }));
      seat.add(box(t, [0.24, 0.03, 0.2], 0x7a2020, [0, 0.185, -0.02], { tex: 'fabric', repeat: [2, 1], rough: 0.95 }));
      seat.add(box(t, [0.3, 0.4, 0.06], 0x2f333a, [0, 0.34, -0.19], { rough: 0.6 }));
      seat.add(box(t, [0.22, 0.3, 0.025], 0x7a2020, [0, 0.32, -0.155], { tex: 'fabric', repeat: [2, 2], rough: 0.95 }));
      seat.add(box(t, [0.14, 0.08, 0.03], 0x7a2020, [0, 0.545, -0.15], { tex: 'fabric', rough: 0.95 }));
      // side wings + a footrest bar, in the shared dark batch (gon frame)
      const anchor = new t.Group();
      anchor.position.set(0, 0.035, -0.04); // hips sunk ~0.01 into the cushion
      seat.add(anchor);
      seatAnchors.push(anchor);
      if (withRiders) {
        const p = buildPeep(t, {
          skin: SKIN_TONES[(r * 3 + i) % SKIN_TONES.length],
          shirt: SHIRTS[(r * 3 + i) % SHIRTS.length],
          seated: true,
          expression: 'surprised',
          female: (r * 3 + i) % 2 === 1,
        });
        p.group.userData.lodDetail = true; // park runtime hides riders beyond NEAR distance
        p.group.scale.setScalar(0.34);
        anchor.add(p.group);
      }
      // OVER-SHOULDER RESTRAINT in the gondola frame (so it merges): two bars
      // over the shoulders dropping to a chest pad
      const sx = xs * 0.27;
      [-1, 1].forEach((k) => segP(G_ROD, [sx + xs * 0.02, 0.24, z + k * 0.055], [sx + xs * 0.02, 0.48, z + k * 0.055], 0.04, gTrimP));
      segP(G_BOX, [sx - xs * 0.015, 0.255, z - 0.075], [sx - xs * 0.015, 0.255, z + 0.075], 0.09, gTrimP, 0.04);
      // seat wings each side
      [-1, 1].forEach((k) => slab([sx - xs * 0.02, 0.24, z + k * 0.15], [0.2, 0.2, 0.04], gTrimP));
      // footrest on the tub floor
      segP(G_ROD, [sx - xs * 0.16, 0.16, z - 0.11], [sx - xs * 0.16, 0.16, z + 0.11], 0.035, gBrightP);
    }
  }
  // gondola marker bulbs on both prow tips
  {
    const bs: PartSpec[] = [];
    [0, 1].forEach((e) => {
      const v = e ? 0.985 : 0.015;
      bs.push({ geo: G_BULB, matrix: mtx(t, [0, gunAt(v) + 0.2, zAt(v)], [0, 0, 0], [0.075, 0.09, 0.075]) });
    });
    [-1, 1].forEach((sd) =>
      [0.3, 0.5, 0.7].forEach((v) => {
        const p = tub(v, 1, sd);
        bs.push({ geo: G_BULB, matrix: mtx(t, [p.x + sd * 0.02, p.y + 0.09, p.z], [0, 0, 0], [0.055, 0.065, 0.055]) });
      }),
    );
    const m = mergedParts(t, bs, bulbMat, false);
    m.castShadow = false;
    gon.add(m);
  }

  // ---- flush every batch --------------------------------------------------
  // PAINTED steel takes no envMap (an envMap on paint just mixes in the dark
  // lower hemisphere and muddies it); bright/machined steel does.
  g.add(mergedParts(t, frameP, mat(t, FRAME, { tex: 'metal', repeat: [1, 1], metal: 0.2, rough: 0.5 }), false));
  g.add(mergedParts(t, gussetP, mat(t, STEEL, { metal: 0.3, rough: 0.5 }), false));
  g.add(mergedParts(t, steelP, shiny(BRIGHT, 0.7, 0.35, 'metal'), false));
  g.add(mergedParts(t, boltP, shiny(BRIGHT, 0.9, 0.25), false));
  g.add(mergedParts(t, padP, mat(t, CONCRETE, { tex: 'concrete', rough: 0.92 }), false));
  g.add(mergedParts(t, kerbP, mat(t, HAZARD, { metal: 0.25, rough: 0.55 }), false));
  g.add(mergedParts(t, railP, shiny(BRIGHT, 0.8, 0.3), false));
  arm.add(mergedParts(t, armP, mat(t, ARM, { tex: 'metal', repeat: [1, 1], metal: 0.4, rough: 0.42 }), false));
  arm.add(mergedParts(t, armDkP, shiny(0x6e7681, 0.6, 0.38), false));
  arm.add(mergedParts(t, armBoltP, shiny(BRIGHT, 0.9, 0.25), false));
  gon.add(mergedParts(t, gonSteelP, mat(t, ARM, { tex: 'metal', repeat: [1, 1], metal: 0.4, rough: 0.42 }), false));
  gon.add(mergedParts(t, gonP, mat(t, GON, { tex: 'plastic', rough: 0.42 }), false));
  gon.add(mergedParts(t, gTrimP, shiny(TRIM, 0.55, 0.4), false));
  gon.add(mergedParts(t, gBrightP, shiny(BRIGHT, 0.8, 0.3), false));
  gon.add(mergedParts(t, gWhiteP, mat(t, OFFWHITE, { rough: 0.55 }), false));
  gon.add(mergedParts(t, cushP, mat(t, 0x7a2020, { tex: 'fabric', rough: 0.95 }), false));

  // ---- the inversion cycle: pump-up → full loops → decay --------------
  // velocity-continuous piecewise curve, period 26 s. W = 4π/9 keeps the
  // pendulum phase hitting zero exactly at each hand-off.
  const W = (4 * Math.PI) / 9;
  const V0 = 2.7 * W; // hand-off angular velocity into the loops
  const V1 = (10 * Math.PI) / 4 - V0; // loop exit velocity (5 full loops)
  const A2 = V1 / W; // decay start amplitude — matches V1 exactly
  const ss = (v: number) => {
    const c = Math.max(0, Math.min(1, v));
    return c * c * (3 - 2 * c);
  };
  const swingAngle = (tt: number) => {
    const u = tt % 26;
    if (u < 9) return 2.7 * ss(u / 9) * Math.sin(W * u); // pump-up swings
    if (u < 17) {
      const s = u - 9;
      return V0 * s + ((V1 - V0) * s * s) / 16; // 5 continuous inversions
    }
    const s = u - 17;
    return A2 * (1 - ss(s / 9)) * Math.sin(W * s); // decaying swings
  };

  // per-seat transform so REGISTERED rides carry real GameManager guests
  const _v = new t.Vector3();
  const _sq = new t.Quaternion();
  const _e = new t.Euler();
  const seatWorld = (seat: number): [number, number, number, number] => {
    const s = seatAnchors[seat % seatAnchors.length];
    s.updateWorldMatrix(true, false);
    _v.set(0, 0, 0).applyMatrix4(s.matrixWorld);
    s.getWorldQuaternion(_sq);
    _e.setFromQuaternion(_sq, 'YXZ');
    return [_v.x, _v.y, _v.z, _e.y];
  };

  // FSM spin-down: the swing cycle runs on its OWN integrated clock, so a
  // breakdown eases the cycle speed to zero (the arm freezes where it is,
  // RCT2-style) and the repair eases it back up — velocity-continuous.
  let speedK = 1;
  let speedTarget = 1;
  let lastT = 0;
  let cycleT = 0;
  const onStateChange = (state: string) => {
    speedTarget = state === 'brokenDown' || state === 'beingRepaired' ? 0 : 1;
  };

  const update = (time: number, motionK = 1) => {
    const nk = nightKOf(g);
    const ease = nk * nk * (3 - 2 * nk); // smoothstep
    bulbMat.emissiveIntensity = 0.15 + (2.1 - 0.15) * ease;
    stripMat.emissiveIntensity = 0.12 + (2.2 + 0.4 * Math.sin(time * 5) - 0.12) * ease;
    nightLights.forEach((pl) => (pl.intensity = ease * 1.5));
    deckLight.intensity = ease * 1.2;
    const dt = Math.min(Math.max(time - lastT, 0), 0.1);
    lastT = time;
    speedK += (speedTarget - speedK) * Math.min(1, dt * 1.5);
    cycleT += dt * speedK; // = time while running free
    const envK = motionK * motionK * (3 - 2 * motionK); // station-gate settle: the arm swings back down to hang LEVEL
    arm.rotation.z = swingAngle(cycleT) * envK;
  };
  // station gate: the arm hangs level while guests board/unload. spinDown
  // 0.85 puts it fully at rest inside the 1 s 'arriving' phase, and every
  // departure restarts the pump-up→loops→decay cycle from zero (composed
  // WITH the breakdown freeze above).
  const gate = createMotionGate(update, { spinDown: 0.85 });
  const onStateChangeAll = (state: string) => {
    gate.onStateChange(state);
    if (state === 'departing') cycleT = 0; // each run starts at the pump-up
    onStateChange(state);
  };
  return { group: g, update: gate.update, seatWorld, vehicle: gon, onStateChange: onStateChangeAll };
}

export interface SwingingInverterShipProps {
  scheme?: RideColourScheme;
  /** decorative riders (default: on standalone, off when `register`ed) */
  riders?: boolean;
}

/** local access geometry: the boarding platform + steps run to z ±1.74 and the
 *  gondola loops sweep ±x (radius ~3.4 in the x-y plane, z within ±0.95), so
 *  the queue hut (spans front−1.12..front−0.12) sits past the steps and the
 *  exit hut stands beside them, outside the tower footings */
const INVERTER_LAYOUT: RideLayout = {
  front: 3.0,
  exit: [-1.6, 1.8],
  board: [0, 0.3, 0],
  defaults: { name: 'Swinging Inverter Ship', capacity: 6, rideDuration: 8, intensity: 9, price: 4 },
};

/** <SwingingInverterShip> — composable ride (components/Park/Context.md):
 *  mounts the ride at `position`/`rotation`; inside a <Park>, `register`
 *  (true or `{ name, capacity, rideDuration, price, intensity }`) wires the
 *  full GameManager ride via <ConfigurableRide>. Access geometry (local
 *  frame, yaw = `rotation`): queue HEAD 3.0 out the +z front — past the
 *  boarding-platform steps — lane extending +z (tail at `3.0 +
 *  laneLenOf(capacity) + 0.35`), exit hut at local [-1.6, 1.8]. REAL guests
 *  ride the gondola through the inversions via `seatWorld`; the cycle freezes
 *  on breakdown and resumes after repair (`onStateChange`). Override with
 *  top-level props / `queue`. */
export const SwingingInverterShip: React.FC<SwingingInverterShipProps & ComposableRideProps> = (all) => {
  const { scheme, riders, register, position, rotation, scale, deps, ...rest } = all;
  return (
    <ConfigurableRide
      build={(t) => buildSwingingInverterShipScene(t, { scheme, riders: riders ?? !register })}
      layout={INVERTER_LAYOUT}
      register={register}
      position={position}
      rotation={rotation}
      scale={scale}
      deps={deps ?? [register, riders, scheme, rest]}
      {...rest}
    />
  );
};
SwingingInverterShip.displayName = 'SwingingInverterShip';

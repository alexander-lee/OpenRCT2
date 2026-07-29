import React from 'react';
import * as THREE from 'three';
import { box, cyl, mat, mergedParts, mtx, nightKOf } from '../Stage';
import { buildPeep, SHIRTS, SKIN_TONES } from '../Guest';
import { createMotionGate, makeSeatWorld } from '../GameManager';
import { composableRide } from '../Park';

// ---------------------------------------------------------------------------
// Enterprise — a Schwarzkopf/HUSS-class pod wheel that spins up flat and is
// then LIFTED toward vertical by a hydraulic ram (RCT2 ENTERP).
//
// WHAT WAS WRONG (rendered and looked at, 2026-07-28). This one was almost
// entirely grey-on-black, and every part was the cheapest primitive available:
//   * THE WHEEL was one `TorusGeometry(1.5, 0.06)` plus SIXTEEN 0.035-wide boxes
//     all lying IN the wheel plane at `rotZ = i·π/16`. Sixteen coplanar hairlines
//     is not a spoke structure, it is a spider's web — and a real Enterprise
//     wheel is a DISH: its spokes run from two hub flanges out to one rim, which
//     is the only reason the thing is stiff enough to exist.
//   * THE BOOM was `box([2.6, 0.22, 0.3], 0x3c5454, metal 0.5)` with no envMap —
//     so the ride's biggest single member rendered as a BLACK SLAB, a tombstone
//     standing on a grey pad. There was no lift ram at all, which is the one
//     piece of machinery that says "Enterprise".
//   * THE PODS were 10 identical dark capsules, all in `0x2e4444`, reading as
//     thimbles hung on a bike rim: no livery, no numbers, no hinge, no rollers.
//   * THE BASE was a plain concrete slab. No machinery house, no operator booth,
//     no sign — nothing to say the ride was operated by anyone.
//
// WHAT IT IS NOW:
//  1. A DISHED WHEEL. 20 tapered spokes from a FRONT hub flange and 20 from a
//     REAR one, all endpoint-placed, meeting a box-section rim (two open-ended
//     cylinder walls closed by two annulus faces — `cyl()` builds a solid disc,
//     and a solid disc used as a rim is a lid), plus a tension ring at mid-span.
//     The rim carries 20 alternating cream/red panels and two bulb rows.
//  2. A FABRICATED BOOM: a lofted tapered box girder with corner flanges and
//     web stiffeners, on a bolted trunnion, and a real HYDRAULIC LIFT RAM —
//     barrel, gland, polished rod and clevis — that is RE-AIMED AND EXTENDED
//     every frame from the live boom angle, so the machinery actually works.
//  3. TEN LOFTED PODS in alternating cream and red livery, each with a numbered
//     door panel, a chrome canopy frame over the (kept) concentric curved glass,
//     a hinge yoke and pin on the rim, and a roller at the outboard end.
//  4. A STATION: a chamfered plinth, a machinery house with louvre vents and a
//     ribbed roof, an operator booth with glazing and a control desk, the
//     hydraulic power pack, a hazard-chequered apron and a bulb-lit ENTERPRISE
//     sign board.
//
// Placement rule throughout: anything that POINTS SOMEWHERE is built from its
// two endpoints (`segP`), anything CURVED is a lofted surface, and anything
// METALLIC gets a cached equirectangular envMap — metalness with nothing to
// reflect is grey paint, which is exactly what made the old boom black.
// Capacity, the seat anchors, `seatWorld`, the motion gate and the lift
// animation are unchanged.
// ---------------------------------------------------------------------------

/** local mirror of Stage's batch spec (a second `import type` line from the
 *  same module tripped the design-system resolver) */
type PartSpec = { geo: THREE.BufferGeometry; matrix: THREE.Matrix4; uv?: [number, number] };

// ---- the environment the steelwork and the chrome reflect (cached) ---------
let _entEnv: THREE.Texture | null = null;
function entEnv(t: typeof THREE): THREE.Texture | null {
  if (_entEnv) return _entEnv;
  if (typeof document === 'undefined') return null; // SSR / node bundling
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 128;
  const x = c.getContext('2d');
  if (!x) return null;
  const sky = x.createLinearGradient(0, 0, 0, 64);
  sky.addColorStop(0, '#4a7ab2');
  sky.addColorStop(0.72, '#a4c3dd');
  sky.addColorStop(1, '#e3e9e8');
  x.fillStyle = sky;
  x.fillRect(0, 0, 256, 64);
  const gnd = x.createLinearGradient(0, 64, 0, 128);
  gnd.addColorStop(0, '#9ba193'); // a LIT apron, not a dark lawn — a dark lower
  gnd.addColorStop(1, '#54513f'); // hemisphere is what turns metal back into paint
  x.fillStyle = gnd;
  x.fillRect(0, 64, 256, 64);
  x.fillStyle = '#e2e8e4';
  x.fillRect(0, 62, 256, 4);
  const spots: [number, number, number, string][] = [
    [70, 22, 18, '#fffdf4'],
    [198, 40, 8, '#ffeabf'],
  ];
  for (let i = 0; i < 20; i += 1) spots.push([6 + i * 12.8, 56, 4.2, '#ffe6ad']);
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
  _entEnv = tex;
  return tex;
}

export function buildEnterpriseScene(
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
  const withRiders = opts.riders ?? true; // decorative — off when registered so REAL guests take the pods
  const seats: THREE.Group[] = []; // one anchor per pod (seatWorld)
  let vehicle: THREE.Object3D | undefined; // a pod car — the RideViewer follow cam tracks it

  // ---- palette ------------------------------------------------------------
  const STEELB = 0x4a6172; // boom / structure: steel-blue, not black
  const BRIGHT = 0xb9c1c9; // galvanised spokes, rim webs
  const CHROME = 0xd7dde2;
  const CREAM = 0xe2dccb;
  const RED = 0xb2302a;
  const POD = 0x2e4444; // pod shell shadow / interior (kept)
  const DARK = 0x24292e;
  const CONCRETE = 0x8a8f98;
  const HAZARD = 0xd8b040;
  const GLASS = 0xbcd2da;

  // =======================================================================
  // helpers
  // =======================================================================
  const env = entEnv(t);
  const shiny = (color: number, metal: number, rough: number, texName?: 'metal') => {
    const m = mat(t, color, { metal, rough, tex: texName, repeat: [2, 2] });
    if (env) {
      m.envMap = env;
      m.envMapIntensity = metal > 0.8 ? 1.2 : 0.85;
    }
    return m;
  };
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
  const G_DISC = new t.CylinderGeometry(0.5, 0.5, 1, 12);
  const G_BULB = new t.SphereGeometry(0.5, 8, 6);

  const YA = new t.Vector3(0, 1, 0);
  const _d = new t.Vector3();
  const _mid = new t.Vector3();
  const _q = new t.Quaternion();
  type V3 = [number, number, number];
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
  /** a four-sided tapered box beam between two stations on the local +y axis */
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

  // ---- batches ------------------------------------------------------------
  const padP: PartSpec[] = [];
  const kerbP: PartSpec[] = [];
  const houseP: PartSpec[] = [];
  const houseDkP: PartSpec[] = [];
  const steelP: PartSpec[] = [];
  const boltP: PartSpec[] = [];
  const railP: PartSpec[] = [];
  const glassP: PartSpec[] = [];

  const PIVX = -1.6; // the boom trunnion — UNCHANGED (registered geometry)
  const PIVY = 0.5;

  // =======================================================================
  // 1. THE STATION — plinth, machinery house, operator booth, sign
  // =======================================================================
  g.add(box(t, [1.6, 0.3, 2.4], CONCRETE, [PIVX, 0.15, 0], { tex: 'concrete', repeat: [5, 7], rough: 0.9 })); // the pad, unchanged
  slab([PIVX, 0.32, 0], [1.44, 0.05, 2.24], padP, [0, 0, 0], [5, 7]); // a chamfered top course
  // hazard chequer round the apron edge
  for (let i = 0; i < 9; i += 1) {
    slab([PIVX - 0.74, 0.335, -1.06 + i * 0.265], [0.1, 0.02, 0.13], kerbP);
    slab([PIVX + 0.74, 0.335, -1.06 + i * 0.265], [0.1, 0.02, 0.13], kerbP);
  }
  [-1, 1].forEach((zs) => slab([PIVX, 0.335, zs * 1.15], [1.44, 0.02, 0.1], kerbP));
  // MACHINERY HOUSE behind the trunnion: body, louvre vents, ribbed roof
  slab([PIVX - 0.36, 0.72, 0.62], [0.78, 0.8, 0.9], houseP, [0, 0, 0], [3, 2]);
  slab([PIVX - 0.36, 1.15, 0.62], [0.88, 0.09, 1.0], houseDkP, [0, 0, 0], [3, 3]);
  for (let i = 0; i < 5; i += 1) slab([PIVX - 0.36, 1.2 + i * 0.008, 0.62], [0.84 - i * 0.02, 0.02, 0.96 - i * 0.02], houseDkP);
  for (let i = 0; i < 6; i += 1) slab([PIVX - 0.76, 0.55 + i * 0.09, 0.62], [0.04, 0.05, 0.66], houseDkP, [0.35, 0, 0]); // louvres
  [-1, 1].forEach((zs) => segP(G_ROD, [PIVX - 0.72, 1.24, 0.62 + zs * 0.42], [PIVX - 0.72, 1.42, 0.62 + zs * 0.42], 0.07, steelP)); // vent stacks
  // OPERATOR BOOTH on the other side: body, glazing band, mullions, desk, roof
  slab([PIVX - 0.3, 0.68, -0.72], [0.66, 0.72, 0.72], houseP, [0, 0, 0], [3, 2]);
  slab([PIVX - 0.3, 1.07, -0.72], [0.76, 0.07, 0.82], houseDkP, [0, 0, 0], [3, 3]);
  [-1, 1].forEach((sx) => slab([PIVX - 0.3 + sx * 0.335, 0.86, -0.72], [0.02, 0.3, 0.66], glassP));
  slab([PIVX - 0.3, 0.86, -1.085], [0.62, 0.3, 0.02], glassP);
  for (let i = -1; i <= 1; i += 1) {
    segP(G_ROD, [PIVX - 0.3 + i * 0.2, 0.7, -1.09], [PIVX - 0.3 + i * 0.2, 1.03, -1.09], 0.028, steelP);
    segP(G_ROD, [PIVX + 0.04, 0.7, -0.72 + i * 0.2], [PIVX + 0.04, 1.03, -0.72 + i * 0.2], 0.028, steelP);
  }
  slab([PIVX - 0.3, 0.7, -0.98], [0.5, 0.05, 0.2], houseDkP); // the control desk behind the glass
  [-0.12, 0.12].forEach((dx) => slab([PIVX - 0.3 + dx, 0.75, -0.98], [0.13, 0.05, 0.13], kerbP)); // two lever panels
  // ENTERPRISE SIGN BOARD on the outboard face, bulb-lit after dark
  slab([PIVX - 0.79, 1.05, -0.05], [0.06, 0.42, 1.5], houseDkP, [0, 0, 0], [1, 4]);
  slab([PIVX - 0.83, 1.05, -0.05], [0.03, 0.3, 1.32], kerbP, [0, 0, 0], [8, 1]);
  // HYDRAULIC POWER PACK: a tank, a motor and pipes, beside the booth
  slab([PIVX + 0.5, 0.55, -0.78], [0.4, 0.46, 0.44], houseDkP, [0, 0, 0], [2, 2]);
  g.add(gilt(cyl(t, 0.11, 0.11, 0.44, BRIGHT, [PIVX + 0.5, 0.86, -0.78], { rotZ: Math.PI / 2, tex: 'metal', metal: 0.8, rough: 0.3, seg: 12 }), 1.1));
  [-1, 1].forEach((zs) => segP(G_ROD, [PIVX + 0.5, 0.62, -0.78 + zs * 0.16], [PIVX + 0.12, 0.52, -0.78 + zs * 0.16], 0.05, steelP));
  // handrail round the back of the pad so the machinery deck reads as a deck
  [-1, 1].forEach((zs) => {
    [-0.6, -0.1, 0.4].forEach((dx) => segP(G_ROD, [PIVX + dx, 0.34, zs * 1.14], [PIVX + dx, 0.86, zs * 1.14], 0.03, railP));
    segP(G_ROD, [PIVX - 0.66, 0.83, zs * 1.14], [PIVX + 0.46, 0.83, zs * 1.14], 0.026, railP);
  });

  // ---- the trunnion the boom swings on -----------------------------------
  slab([PIVX, PIVY - 0.14, 0], [0.56, 0.44, 0.62], steelP, [0, 0, 0], [2, 2]);
  [-1, 1].forEach((zs) => {
    slab([PIVX, PIVY, zs * 0.33], [0.44, 0.44, 0.06], steelP);
    for (let i = 0; i < 6; i += 1) {
      const a = (i / 6) * Math.PI * 2;
      segP(G_ROD, [PIVX + Math.cos(a) * 0.16, PIVY + Math.sin(a) * 0.16, zs * 0.34], [PIVX + Math.cos(a) * 0.16, PIVY + Math.sin(a) * 0.16, zs * 0.4], 0.045, boltP);
    }
  });
  g.add(gilt(cyl(t, 0.085, 0.085, 0.78, CHROME, [PIVX, PIVY, 0], { rotX: Math.PI / 2, metal: 0.9, rough: 0.22, seg: 14 }), 1.2));

  // =======================================================================
  // 2. THE BOOM — a lofted tapered girder on the trunnion
  // =======================================================================
  const armPivot = new t.Group();
  armPivot.position.set(PIVX, PIVY, 0);
  g.add(armPivot);
  const boomP: PartSpec[] = [];
  const boomDkP: PartSpec[] = [];
  const boomBoltP: PartSpec[] = [];
  // the girder runs along local +x, so build it on +y and rotate it into place
  {
    const rows = girder(0.16, 2.62, 0.2, 0.13, 0.15, 0.115, 8);
    const rot = new t.Matrix4().makeRotationZ(-Math.PI / 2);
    rows.forEach((r) => r.forEach((p) => p.applyMatrix4(rot)));
    // ride BEHIND the wheel plane (z −0.26) so the rim/pods never sweep the boom
    rows.forEach((r) => r.forEach((p) => (p.z -= 0.26)));
    armPivot.add(shell(loft(rows, [4, 6]), mat(t, STEELB, { tex: 'metal', metal: 0.4, rough: 0.42, repeat: [1, 1] })));
  }
  // corner flanges + web stiffeners + a bolted root plate
  ([[1, 1], [1, -1], [-1, -1], [-1, 1]] as [number, number][]).forEach(([sy, sz]) => {
    segP(G_BOX, [0.16, sy * 0.2, -0.26 + sz * 0.15], [2.62, sy * 0.13, -0.26 + sz * 0.115], 0.03, boomDkP, 0.032);
  });
  for (let i = 0; i < 7; i += 1) {
    const f = 0.08 + (i / 6) * 0.86;
    const x = 0.16 + 2.46 * f;
    const hy = 0.2 + (0.13 - 0.2) * f;
    const hz = 0.15 + (0.115 - 0.15) * f;
    [-1, 1].forEach((sy) => {
      segP(G_BOX, [x, sy * (hy + 0.012), -0.26 - hz], [x, sy * (hy + 0.012), -0.26 + hz], 0.048, boomP, 0.03);
      [-1, 1].forEach((sz) => segP(G_ROD, [x, sy * (hy + 0.01), -0.26 + sz * hz * 0.7], [x, sy * (hy + 0.032), -0.26 + sz * hz * 0.7], 0.032, boomBoltP));
    });
  }
  slab([0.14, 0, -0.26], [0.06, 0.5, 0.36], boomDkP, [0, 0, 0], [1, 2]);
  [-1, 1].forEach((sy) => [-1, 1].forEach((sz) => segP(G_ROD, [0.1, sy * 0.17, -0.26 + sz * 0.12], [0.19, sy * 0.17, -0.26 + sz * 0.12], 0.045, boomBoltP)));
  // the head bearing at the wheel end
  slab([2.6, 0, -0.16], [0.34, 0.36, 0.34], boomDkP, [0, 0, 0], [2, 2]);
  armPivot.add(mergedParts(t, boomP, mat(t, BRIGHT, { tex: 'metal', metal: 0.5, rough: 0.4, repeat: [1, 1] }), false));
  armPivot.add(mergedParts(t, boomDkP, shiny(0x36485a, 0.55, 0.4), false));
  armPivot.add(mergedParts(t, boomBoltP, shiny(CHROME, 0.9, 0.24), false));

  // ---- THE HYDRAULIC LIFT RAM -------------------------------------------
  // The one piece of machinery that says "Enterprise", and the old build had
  // none. Its barrel is trunnioned on the base and its rod ends on a clevis part
  // way up the boom, so BOTH the aim and the extension change with the boom
  // angle — `update()` re-poses it every frame from the live `armPivot.rotation`.
  const RAM_BASE = new t.Vector3(PIVX + 0.62, 0.42, -0.52); // world anchor on the pad
  const RAM_ARM = new t.Vector3(1.15, -0.2, -0.52); // clevis, in armPivot-local
  const ram = new t.Group();
  g.add(ram);
  const ramBarrel = gilt(cyl(t, 0.085, 0.1, 0.9, 0x3f4a55, [0, 0.45, 0], { tex: 'metal', metal: 0.6, rough: 0.35, seg: 12 }), 0.9);
  ram.add(ramBarrel);
  ram.add(gilt(cyl(t, 0.105, 0.105, 0.09, CHROME, [0, 0.9, 0], { metal: 0.9, rough: 0.2, seg: 12 }), 1.2)); // gland
  ram.add(gilt(cyl(t, 0.11, 0.11, 0.1, 0x3f4a55, [0, 0.05, 0], { metal: 0.6, rough: 0.35, seg: 12 }), 0.9)); // base eye
  const ramRod = gilt(cyl(t, 0.05, 0.05, 1, CHROME, [0, 0.5, 0], { metal: 0.95, rough: 0.15, seg: 10 }), 1.25);
  const ramRodPivot = new t.Group();
  ramRodPivot.position.y = 0.9;
  ramRodPivot.add(ramRod);
  ram.add(ramRodPivot);

  // =======================================================================
  // 3. THE WHEEL — a DISH, not a spider's web
  // =======================================================================
  const wheel = new t.Group();
  wheel.position.set(2.6, 0, 0);
  armPivot.add(wheel);
  const R = 1.5; // pod ring radius — UNCHANGED (seat anchors ride it)
  const RIN = 1.42;
  const ROUT = 1.58;
  const HUBZ = 0.21; // the two hub flanges the spokes spring from — the DISH
  const spokeP: PartSpec[] = [];
  const hubP: PartSpec[] = [];
  const rimPaleP: PartSpec[] = [];
  const rimRedP: PartSpec[] = [];
  const wheelBoltP: PartSpec[] = [];
  const NS = 20;

  // hub drum + two bolted flanges
  wheel.add(gilt(cyl(t, 0.19, 0.19, 0.56, 0x9aa2ab, [0, 0, -0.02], { rotX: Math.PI / 2, tex: 'metal', metal: 0.8, rough: 0.3, seg: 18 }), 1.1));
  [-1, 1].forEach((sz) => {
    hubP.push({ geo: G_DISC, matrix: mtx(t, [0, 0, sz * HUBZ], [Math.PI / 2, 0, 0], [0.62, 0.055, 0.62]) });
    for (let i = 0; i < 10; i += 1) {
      const a = (i / 10) * Math.PI * 2;
      segP(G_ROD, [Math.cos(a) * 0.24, Math.sin(a) * 0.24, sz * (HUBZ - 0.03)], [Math.cos(a) * 0.24, Math.sin(a) * 0.24, sz * (HUBZ + 0.04)], 0.05, wheelBoltP);
    }
  });
  // 20 + 20 TAPERED SPOKES, each from a hub flange out to the rim — this is the
  // whole difference between a dish and 16 coplanar hairlines
  for (let i = 0; i < NS; i += 1) {
    const a = (i / NS) * Math.PI * 2;
    const rx = Math.cos(a);
    const ry = Math.sin(a);
    [-1, 1].forEach((sz) => segP(G_BOX, [rx * 0.3, ry * 0.3, sz * HUBZ], [rx * RIN, ry * RIN, 0], 0.075, spokeP, 0.055));
    // radial rim web + a bolt where each pair lands
    segP(G_ROD, [rx * (RIN - 0.03), ry * (RIN - 0.03), 0], [rx * (RIN + 0.05), ry * (RIN + 0.05), 0], 0.05, wheelBoltP);
  }
  // a TENSION RING at mid-span, tying every spoke pair together
  [-1, 1].forEach((sz) => {
    for (let i = 0; i < NS; i += 1) {
      const a0 = (i / NS) * Math.PI * 2;
      const a1 = ((i + 1) / NS) * Math.PI * 2;
      const rr = 0.82;
      const zz = sz * HUBZ * (1 - (rr - 0.3) / (RIN - 0.3));
      segP(G_ROD, [Math.cos(a0) * rr, Math.sin(a0) * rr, zz], [Math.cos(a1) * rr, Math.sin(a1) * rr, zz], 0.04, spokeP);
    }
  });
  // THE RIM — a box section. `cyl()` builds a SOLID disc and a solid disc used as
  // a rim is a horizontal LID across the whole wheel, so this is two open-ended
  // cylinder WALLS closed by two annulus faces.
  {
    const rim: PartSpec[] = [];
    const HW = 0.095;
    [RIN, ROUT].forEach((r) => rim.push({ geo: new t.CylinderGeometry(r, r, HW * 2, 44, 1, true), matrix: mtx(t, [0, 0, 0], [Math.PI / 2, 0, 0]) }));
    [-1, 1].forEach((sz) => rim.push({ geo: new t.RingGeometry(RIN, ROUT, 44), matrix: mtx(t, [0, 0, sz * HW]) }));
    const m = mergedParts(t, rim, shiny(BRIGHT, 0.6, 0.35, 'metal'));
    m.material.side = t.DoubleSide;
    wheel.add(m);
  }
  // 20 alternating cream / red rim panels, standing just proud of the outer wall
  for (let i = 0; i < NS; i += 1) {
    const a0 = (i / NS) * Math.PI * 2 + 0.02;
    const a1 = ((i + 1) / NS) * Math.PI * 2 - 0.02;
    const into = i % 2 ? rimRedP : rimPaleP;
    for (let k = 0; k < 2; k += 1) {
      const a = a0 + ((a1 - a0) * k) / 2;
      const b = a0 + ((a1 - a0) * (k + 1)) / 2;
      segP(G_BOX, [Math.cos(a) * (ROUT + 0.02), Math.sin(a) * (ROUT + 0.02), 0], [Math.cos(b) * (ROUT + 0.02), Math.sin(b) * (ROUT + 0.02), 0], 0.055, into, 0.15);
    }
  }
  wheel.add(mergedParts(t, spokeP, shiny(BRIGHT, 0.7, 0.33, 'metal'), false));
  wheel.add(mergedParts(t, hubP, shiny(0x9aa2ab, 0.8, 0.3), false));
  wheel.add(mergedParts(t, wheelBoltP, shiny(CHROME, 0.9, 0.22), false));
  wheel.add(mergedParts(t, rimPaleP, mat(t, CREAM, { rough: 0.5 }), false));
  wheel.add(mergedParts(t, rimRedP, mat(t, RED, { rough: 0.5 }), false));

  // ---- night rig: one merged bulb mesh on the rim, hub + base floods -----
  const bulbGeo = new t.SphereGeometry(0.04, 8, 6);
  const bulbMat = new t.MeshStandardMaterial({ color: 0xfff8e0, emissive: 0xffe08a, emissiveIntensity: 0.15, roughness: 0.35 });
  {
    const bs: PartSpec[] = [];
    for (let i = 0; i < NS; i += 1) {
      const a = (i / NS) * Math.PI * 2 + Math.PI / NS;
      [0.135, -0.135].forEach((z) => bs.push({ geo: G_BULB, matrix: mtx(t, [Math.cos(a) * (ROUT - 0.02), Math.sin(a) * (ROUT - 0.02), z], [0, 0, 0], [0.085, 0.085, 0.085]) }));
    }
    const m = mergedParts(t, bs, bulbMat, false);
    m.castShadow = false;
    wheel.add(m);
  }
  const hubLight = new t.PointLight(0xffdf9a, 0, 5, 2);
  hubLight.position.set(2.6, 0, 0.5);
  armPivot.add(hubLight);
  const baseLight = new t.PointLight(0xffc97a, 0, 4, 2);
  baseLight.position.set(PIVX, 1.2, 0);
  g.add(baseLight);
  // bulbs round the sign board (they belong to the STATIONARY group)
  {
    const bs: PartSpec[] = [];
    for (let i = 0; i < 7; i += 1) {
      const z = -0.68 + (i / 6) * 1.26;
      [-0.24, 0.24].forEach((dy) => bs.push({ geo: bulbGeo, matrix: mtx(t, [PIVX - 0.85, 1.05 + dy, z]) }));
    }
    const m = mergedParts(t, bs, bulbMat, false);
    m.castShadow = false;
    g.add(m);
  }

  // =======================================================================
  // 4. TEN PODS — lofted capsules with livery, numbers, hinges and rollers
  // =======================================================================
  for (let i = 0; i < 10; i += 1) {
    const a = (i / 10) * Math.PI * 2;
    const pod = new t.Group();
    pod.position.set(Math.cos(a) * R, Math.sin(a) * R, 0.16);
    pod.rotation.z = a + Math.PI / 2; // wide floor end OUTWARD, riders' heads toward the hub
    wheel.add(pod);
    if (i === 0) vehicle = pod;
    const body = i % 2 ? RED : CREAM;
    const podP: PartSpec[] = [];
    const podDkP: PartSpec[] = [];
    const podChP: PartSpec[] = [];

    // THE SHELL — a lofted body of revolution, tapered and slightly bellied, in
    // place of the plain open-ended cone the old pod used. Local −y is radially
    // OUTWARD, so the wide end is at −y.
    {
      const rows: THREE.Vector3[][] = [];
      const N = 9;
      const M = 12;
      for (let k = 0; k <= N; k += 1) {
        const f = k / N;
        const y = -0.31 + f * 0.42; // floor end −0.31 … roof end +0.11
        const r = 0.185 - 0.05 * f + 0.014 * Math.sin(Math.PI * f); // belly
        const row: THREE.Vector3[] = [];
        // OPEN at the front (+z) so the rider is visible: sweep the closed arc
        for (let j = 0; j <= M; j += 1) {
          const th = 0.9 + (j / M) * (Math.PI * 2 - 1.8);
          row.push(new t.Vector3(Math.cos(th) * r, y, Math.sin(th) * r));
        }
        rows.push(row);
      }
      pod.add(shell(loft(rows, [3, 2]), mat(t, body, { tex: 'plastic', rough: 0.45, repeat: [1, 1] })));
    }
    // floor cap + roof cap + seat disc + cushions (kept dimensions)
    podDkP.push({ geo: G_DISC, matrix: mtx(t, [0, -0.32, 0], [0, 0, 0], [0.38, 0.04, 0.38]) });
    podDkP.push({ geo: G_DISC, matrix: mtx(t, [0, 0.105, 0], [0, 0, 0], [0.28, 0.04, 0.28]) });
    podDkP.push({ geo: G_DISC, matrix: mtx(t, [0, -0.16, 0], [0, 0, 0], [0.31, 0.035, 0.31]) });
    pod.add(cyl(t, 0.12, 0.13, 0.02, 0x24504e, [0, -0.14, 0], { rough: 0.95, seg: 14 })); // padded cushion
    pod.add(box(t, [0.16, 0.18, 0.02], 0x24504e, [0, -0.06, -0.135], { rough: 0.95 })); // back cushion
    // a LIVERY BAND and a numbered door panel on the closed back of the shell
    for (let k = 0; k < 9; k += 1) {
      const th = Math.PI + (k / 8 - 0.5) * 1.5;
      segP(G_BOX, [Math.cos(th) * 0.175, -0.2, Math.sin(th) * 0.175], [Math.cos(th) * 0.175, -0.08, Math.sin(th) * 0.175], 0.055, podChP, 0.05);
    }
    slab([0, -0.245, -0.175], [0.1, 0.1, 0.02], podChP);
    slab([0, -0.245, -0.183], [0.055, 0.055, 0.02], podDkP);
    // CURVED glass canopy over the pod opening — a partial cylinder CONCENTRIC
    // with the shell (arc 1.86 rad lapping the shell's 1.8 rad opening by 0.03
    // each side), so the glass follows the pod's curvature and stays inside its
    // silhouette. A flat plate here had corners outside the shell radius and
    // jutted through the body.
    const glass = new t.Mesh(
      new t.CylinderGeometry(0.144, 0.19, 0.4, 14, 1, true, -0.93, 1.86),
      new t.MeshStandardMaterial({ color: GLASS, metalness: 0.2, roughness: 0.15, transparent: true, opacity: 0.34, side: t.DoubleSide }),
    );
    glass.position.y = -0.1;
    if (env) {
      (glass.material as THREE.MeshStandardMaterial).envMap = env;
      (glass.material as THREE.MeshStandardMaterial).envMapIntensity = 1.1;
    }
    pod.add(glass);
    // CHROME canopy frame: a hood band, a sill band and two side posts, all
    // concentric with the glass so the frame follows it
    [
      [0.15, 0.155, 0.088],
      [0.192, 0.196, -0.29],
    ].forEach(([rt, rb, y]) => {
      const trim = new t.Mesh(new t.CylinderGeometry(rt, rb, 0.032, 14, 1, true, -0.95, 1.9), shiny(CHROME, 0.85, 0.22));
      trim.material.side = t.DoubleSide;
      trim.position.y = y;
      pod.add(trim);
    });
    [-1, 1].forEach((sd) => {
      const th = sd * 0.93;
      segP(G_ROD, [Math.cos(th) * 0.152, 0.09, Math.sin(th) * 0.152], [Math.cos(th) * 0.196, -0.29, Math.sin(th) * 0.196], 0.045, podChP);
    });
    // HINGE YOKE + PIN back onto the rim front face, and a ROLLER at the
    // outboard end (a real Enterprise pod runs its roller on the ring while the
    // wheel is flat)
    [-1, 1].forEach((sd) => segP(G_ROD, [sd * 0.11, 0.12, -0.07], [sd * 0.11, 0.02, -0.02], 0.05, podChP));
    segP(G_ROD, [-0.16, 0.13, -0.06], [0.16, 0.13, -0.06], 0.045, podChP);
    podDkP.push({ geo: G_DISC, matrix: mtx(t, [0, -0.35, -0.06], [0, 0, Math.PI / 2], [0.1, 0.06, 0.1]) });
    // over-shoulder restraint (Enterprise-class): across the chest, arms
    // dropping into the seat disc at both sides
    slab([0, -0.07, 0.06], [0.17, 0.03, 0.03], podDkP);
    [-0.075, 0.075].forEach((x) => slab([x, -0.115, 0.06], [0.025, 0.1, 0.025], podDkP));

    pod.add(mergedParts(t, podP, mat(t, body, { tex: 'plastic', rough: 0.45 }), false));
    pod.add(mergedParts(t, podDkP, shiny(DARK, 0.5, 0.45), false));
    pod.add(mergedParts(t, podChP, shiny(CHROME, 0.85, 0.24), false));

    // pod seat anchor — REAL GameManager guests land here via seatWorld
    const seat = new t.Group();
    seat.position.set(0, -0.26, 0.02); // hips on the seat disc
    pod.add(seat);
    seats.push(seat);
    if (withRiders) {
      const p = buildPeep(t, { skin: SKIN_TONES[i % SKIN_TONES.length], shirt: SHIRTS[i % SHIRTS.length], seated: true });
      p.group.userData.lodDetail = true; // the park runtime sheds riders past NEAR
      p.group.scale.setScalar(0.26);
      seat.add(p.group);
    }
  }

  // ---- flush the stationary batches --------------------------------------
  g.add(mergedParts(t, padP, mat(t, CONCRETE, { tex: 'concrete', rough: 0.92 }), false));
  g.add(mergedParts(t, kerbP, mat(t, HAZARD, { metal: 0.25, rough: 0.55 }), false));
  g.add(mergedParts(t, houseP, mat(t, RED, { tex: 'plastic', rough: 0.6 }), false));
  g.add(mergedParts(t, houseDkP, mat(t, DARK, { tex: 'metal', repeat: [1, 1], metal: 0.3, rough: 0.5 }), false));
  g.add(mergedParts(t, steelP, shiny(BRIGHT, 0.7, 0.33, 'metal'), false));
  g.add(mergedParts(t, boltP, shiny(CHROME, 0.9, 0.24), false));
  g.add(mergedParts(t, railP, shiny(CHROME, 0.8, 0.3), false));
  g.add(mergedParts(t, glassP, mat(t, 0x1d2a2e, { rough: 0.2, metal: 0.4 }), false));

  // ---- the RAM pose, recomputed from the live boom angle -----------------
  const _rb = new t.Vector3();
  const _ra = new t.Vector3();
  const _rdir = new t.Vector3();
  const _rq = new t.Quaternion();
  const poseRam = () => {
    // the clevis point, carried round by the boom
    _ra.copy(RAM_ARM).applyEuler(new t.Euler(0, 0, armPivot.rotation.z));
    _ra.x += PIVX;
    _ra.y += PIVY;
    _rb.copy(RAM_BASE);
    _rdir.copy(_ra).sub(_rb);
    const len = _rdir.length();
    ram.position.copy(_rb);
    _rq.setFromUnitVectors(YA, _rdir.clone().normalize());
    ram.quaternion.copy(_rq);
    // the rod makes up whatever the barrel does not
    const rodLen = Math.max(0.12, len - 0.86);
    ramRod.scale.set(1, rodLen, 1);
    ramRod.position.y = rodLen / 2;
  };

  const update = (time: number, motionK = 1) => {
    // day -> night gate: rim bulbs + hub/base glow rise as it darkens
    const nk = nightKOf(g);
    const ease = nk * nk * (3 - 2 * nk); // smoothstep
    bulbMat.emissiveIntensity = 0.15 + (1.7 - 0.15) * ease;
    hubLight.intensity = ease * 1.3;
    baseLight.intensity = ease * 0.85;
    wheel.rotation.z = time * 1.6;
    const lift = ((Math.sin(time * 0.35) + 1) / 2) * motionK; // 0..1 — settles to the lowest arm angle when parked
    armPivot.rotation.z = 0.62 + lift * 0.85; // raise toward vertical; pod tips (radius 1.81) always >= 0.2 clear of the ground
    poseRam();
  };
  poseRam(); // so the ram is aimed correctly in the built (un-updated) pose too
  // station gate: wheel parked (arm lowered) while guests board/unload;
  // spinDown 0.9 has the arm down before 'unloadingPassengers' begins
  const gate = createMotionGate((tt, k) => update(tt, k), { spinDown: 0.9 });
  return { group: g, update: gate.update, vehicle, seatWorld: makeSeatWorld(three, seats), onStateChange: gate.onStateChange };
}

/** <Enterprise> — composable ride (components/Park/Context.md): mounts the ride
 *  at `position`/`rotation`; inside a <Park>, `register` wires the full
 *  GameManager ride via <ConfigurableRide> — queue HEAD 1.5 out the local +z
 *  front (lane extending +z), exit hut beside it at local [-1.5, 1.35],
 *  boarding at the base. Capacity 10 = the 10 pods: REAL guests ride the pod
 *  seats via `seatWorld` (decorative riders off when registered) and the
 *  wheel is motion-gated — parked with the arm lowered for boarding.
 *  Override with top-level props / `queue`. */
export const Enterprise = composableRide<{ riders?: boolean }>(
  'Enterprise',
  (t, props) => buildEnterpriseScene(t, { riders: props.riders ?? !(props as { register?: unknown }).register }),
  { defaults: { name: 'Enterprise', capacity: 10, rideDuration: 9, intensity: 8, price: 4 } },
);

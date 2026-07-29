// ---------------------------------------------------------------------------
// DragonRoost — Thornwick Glade's giant: a claw-raked crag under a stick nest of glowing eggs.
//
// ONE GIANT SET-PIECE PER WORLD. `fire` always had `<Volcano>` (r 2.75, h 2.55,
// a cone visible from the gate) and the other four worlds had nothing of that
// mass — their biggest pieces were props, so those lands read as a lawn with
// ornaments on it. This is `enchantedForest`'s answer, built to the same class.
//
// Deterministic (hashed jitter only), night-gated through `nightKOf(group)`,
// and it registers a footprint so guests and the OBB sweep route around it.
// Mount it with `<DragonRoost position={[x, z]} />`, or let
// `<WorldLandmark plan={W} />` pick it off the world's theme.
// ---------------------------------------------------------------------------

import * as THREE from 'three';
import { box, cyl, ball, nightKOf, mergedBoxes } from '../Stage';
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

export function buildDragonRoost(t: typeof THREE): LandmarkBuilt {
  const g = new t.Group();
  const ROCK = 0x6a6357;
  const ROCKD = 0x4b463d;
  const MOSS = 0x4e6b39;
  const STICK = 0x5a4632;
  const SHELL = 0xd8cbb0;
  const VEIN = 0x86e06a;

  // ---- the crag: stacked, rotated slabs narrowing to the roost ------------
  const tiers: [number, number, number][] = [
    [2.5, 0.9, 0.0], [2.15, 0.8, 0.5], [1.8, 0.75, 1.1], [1.45, 0.7, 1.7], [1.15, 0.6, 2.3],
  ];
  let y = 0;
  tiers.forEach(([r, h, rot], i) => {
    g.add(cyl(t, r * 0.86, r, h, i % 2 ? ROCK : ROCKD, [0, y + h / 2, 0], {
      tex: 'concrete', rough: 1, seg: 7, rotY: rot,
    }));
    y += h * 0.88;
  });
  // outcrops + a fallen slab at the foot
  for (let i = 0; i < 6; i += 1) {
    const a = (i / 6) * Math.PI * 2 + 0.4;
    const rr = 2.1 + h01(i * 3) * 0.5;
    g.add(box(t, [0.7, 0.45 + h01(i) * 0.5, 0.55], ROCKD, [Math.cos(a) * rr, 0.22, Math.sin(a) * rr], {
      rotY: a, rotZ: (h01(i * 7) - 0.5) * 0.3, tex: 'concrete', rough: 1,
    }));
  }
  // CLAW RAKES — three parallel gouges down one flank, the roost's signature
  [-0.16, 0, 0.16].forEach((o, i) =>
    g.add(box(t, [0.07, 1.7, 0.07], ROCKD, [1.15 + o * 0.3, 1.5, 1.15 + o], {
      rotX: -0.35, rotZ: 0.2, rough: 1,
    })),
  );
  // moss on the shaded north face
  g.add(cyl(t, 1.3, 1.55, 0.14, MOSS, [0, 0.1, 0], { tex: 'grass', rough: 1, seg: 16 }));
  [1.0, 1.9].forEach((yy, i) =>
    g.add(box(t, [0.9, 0.3, 0.18], MOSS, [-0.7 - i * 0.15, yy, -0.85], { rotY: 0.5, tex: 'grass', rough: 1 })),
  );

  // ---- the nest: a WOVEN bowl, not a ring of sticks lying flat -------------
  // The first build placed all 22 sticks with `rotZ: Math.PI/2` — dead
  // horizontal, at three fixed heights — so the nest read as a stack of pencils
  // on a table. A real raptor nest is a BASKET: courses of sticks laid round the
  // rim but each canted, crossing its neighbours, with the inner ones tipped
  // down into the bowl and a few long ones jutting out and up. That needs a
  // stick to point in an arbitrary direction, which `rotX/rotY/rotZ` on a
  // cylinder cannot express — so each stick is placed FROM ITS TWO ENDS: build
  // the rotation that takes local +x onto (b − a) and put it at the midpoint.
  //
  // They are boxes merged into two meshes (one per colour) rather than 60
  // cylinders: 2 draw calls instead of 60, and at 0.08 u thick the square
  // section is indistinguishable from a round one.
  const top = y + 0.15;
  const nest = new t.Group();
  nest.position.set(0, top, 0);
  const XA = new t.Vector3(1, 0, 0);
  const dir = new t.Vector3();
  const mid = new t.Vector3();
  const q = new t.Quaternion();
  const sticks: MergedBoxSpec[][] = [[], []];
  /** one stick from a to b, thickness th, into colour bucket `bkt` */
  const stick = (
    a: [number, number, number], b: [number, number, number], th: number, bkt: number,
  ) => {
    dir.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    const len = dir.length();
    if (len < 1e-4) return;
    mid.set((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2);
    q.setFromUnitVectors(XA, dir.normalize());
    const m = new t.Matrix4().makeRotationFromQuaternion(q);
    m.setPosition(mid);
    sticks[bkt].push({ dims: [len, th, th * 0.92], matrix: m });
  };
  // THREE COURSES round the rim, each rotated off the one below so the sticks
  // cross rather than stack — that crossing is what reads as "woven".
  const RIM = 1.3;
  for (let course = 0; course < 3; course += 1) {
    const n = 16 - course * 2;
    const yy = 0.13 + course * 0.17;
    const lean = 0.20 + course * 0.14;      // each course leans further out
    for (let i = 0; i < n; i += 1) {
      const a0 = (i / n) * Math.PI * 2 + course * 0.42 + h01(i + course * 31) * 0.16;
      const span = (0.62 + h01(i * 7 + course) * 0.5) / (RIM * 0.9); // arc it covers
      const r0 = RIM - 0.06 + h01(i * 13 + course * 5) * 0.14;
      const r1 = r0 + (h01(i * 3 + course) - 0.35) * 0.22;
      // the two ends sit at different angles AND different heights: that tilt is
      // the whole difference from the old flat ring
      const drop = (h01(i * 17 + course * 3) - 0.5) * 0.20;
      stick(
        [Math.cos(a0) * r0, yy - drop, Math.sin(a0) * r0],
        [Math.cos(a0 + span) * r1 * (1 + lean * 0.10), yy + drop + lean * 0.16, Math.sin(a0 + span) * r1 * (1 + lean * 0.10)],
        0.075 + h01(i * 11 + course) * 0.03,
        i % 4 === 0 ? 1 : 0,
      );
    }
  }
  // RADIAL sticks tipped down into the bowl — the lining, and what stops the
  // eye reading the rim as a fence
  for (let i = 0; i < 14; i += 1) {
    const a0 = (i / 14) * Math.PI * 2 + 0.2;
    const r0 = 1.34 + h01(i * 5) * 0.12;
    stick(
      [Math.cos(a0) * r0, 0.30 + h01(i * 9) * 0.16, Math.sin(a0) * r0],
      [Math.cos(a0 + 0.5) * 0.38, 0.06, Math.sin(a0 + 0.5) * 0.38],
      0.06 + h01(i * 3) * 0.02,
      i % 3 === 0 ? 1 : 0,
    );
  }
  // and a handful of long ones JUTTING out and up over the drop — a nest is
  // never tidy at its edge
  for (let i = 0; i < 7; i += 1) {
    const a0 = (i / 7) * Math.PI * 2 + 0.9;
    const r0 = 1.1 + h01(i * 23) * 0.2;
    const out = 0.75 + h01(i * 29) * 0.55;
    const up = 0.25 + h01(i * 31) * 0.5;
    stick(
      [Math.cos(a0) * r0, 0.16 + h01(i * 13) * 0.14, Math.sin(a0) * r0],
      [Math.cos(a0 + 0.22) * (r0 + out), 0.16 + up, Math.sin(a0 + 0.22) * (r0 + out)],
      0.055 + h01(i * 7) * 0.03,
      i % 2 ? 1 : 0,
    );
  }
  nest.add(mergedBoxes(t, sticks[0], STICK, { tex: 'wood', rough: 1 }));
  nest.add(mergedBoxes(t, sticks[1], ROCKD, { tex: 'wood', rough: 1 }));
  // the bowl floor, dished (two courses, the upper one wider) with a moss lining
  nest.add(cyl(t, 1.1, 0.8, 0.14, 0x4a3f2e, [0, 0.08, 0], { tex: 'wood', rough: 1, seg: 14 }));
  nest.add(cyl(t, 0.98, 1.06, 0.05, MOSS, [0, 0.17, 0], { tex: 'grass', rough: 1, seg: 14 }));
  g.add(nest);

  // ---- the clutch: five eggs, one cracked ---------------------------------
  const eggs: THREE.Mesh[] = [];
  const CLUTCH: [number, number, number][] = [
    [0, 0, 0.34], [0.42, 0.3, 0.30], [-0.44, 0.22, 0.31], [0.14, -0.44, 0.29], [-0.2, -0.36, 0.27],
  ];
  CLUTCH.forEach(([ex, ez, r], i) => {
    const e = ball(t, r, SHELL, [ex, top + 0.2 + r * 0.72, ez], { rough: 0.72, emissive: VEIN });
    e.scale.set(1, 1.34, 1); // an EGG, not a marble
    e.rotation.z = (h01(i * 9) - 0.5) * 0.5;
    (e.material as THREE.MeshStandardMaterial).emissiveIntensity = 0;
    eggs.push(e);
    g.add(e);
    // the veins that light up: a couple of thin bands per egg
    [0.25, -0.1].forEach((o, k) =>
      g.add(box(t, [r * 1.35, 0.035, 0.035], VEIN, [ex, top + 0.2 + r * (0.72 + o), ez + r * 0.62], {
        rotY: k * 1.1, emissive: VEIN, rough: 1,
      })),
    );
  });
  // one CRACKED egg — a shell cap tipped off and a shard beside it
  g.add(cyl(t, 0.3, 0.24, 0.12, SHELL, [0.42, top + 0.72, 0.3], { rotZ: 0.55, rough: 0.72, seg: 12 }));
  g.add(box(t, [0.22, 0.05, 0.16], SHELL, [0.95, top + 0.26, 0.62], { rotY: 0.7, rotZ: 0.3, rough: 0.72 }));

  // a shed scale and a gnawed bone at the foot, so the roost reads as OCCUPIED
  [[1.7, 0.12, -1.5, 0.5], [-1.9, 0.1, 1.2, -0.8]].forEach(([sx, sy, sz, rot], i) =>
    g.add(box(t, [0.34, 0.06, 0.24], i ? 0x5f7a48 : 0x6f8a52, [sx, sy, sz], { rotY: rot, rough: 0.5, metal: 0.25 })),
  );

  const update = (time: number) => {
    const k = nightKOf(g);   // nightKOf takes the OBJECT, never the time
    eggs.forEach((e, i) => {
      const m = e.material as THREE.MeshStandardMaterial;
      // a slow heartbeat, each egg out of phase — something is alive in there
      m.emissiveIntensity = (0.15 + 1.25 * k) * (0.45 + 0.55 * Math.pow(Math.sin(time * 1.1 + i * 1.3) * 0.5 + 0.5, 2));
    });
  };
  return { group: g, radius: 2.7, update };
}

/** `<DragonRoost>` — enchantedForest's landmark. */
export const DragonRoost = composable('DragonRoost', (t) => buildDragonRoost(t));

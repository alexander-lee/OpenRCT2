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
import { box, cyl, ball, nightKOf } from '../Stage';
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

  // ---- the nest: a woven ring of sticks on the summit ---------------------
  const top = y + 0.15;
  const nest = new t.Group();
  nest.position.set(0, top, 0);
  for (let i = 0; i < 22; i += 1) {
    const a = (i / 22) * Math.PI * 2;
    const r = 1.28 + h01(i * 11) * 0.16;
    const len = 0.95 + h01(i * 5) * 0.5;
    nest.add(cyl(t, 0.045, 0.06, len, i % 3 ? STICK : ROCKD, [Math.cos(a) * r, 0.16 + (i % 3) * 0.11, Math.sin(a) * r], {
      rotZ: Math.PI / 2, rotY: a + 1.35 + (h01(i) - 0.5) * 0.4, tex: 'wood', rough: 1, seg: 5,
    }));
  }
  // the bowl floor
  nest.add(cyl(t, 1.05, 0.85, 0.16, 0x4a3f2e, [0, 0.1, 0], { tex: 'wood', rough: 1, seg: 14 }));
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

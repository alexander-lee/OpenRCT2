// AUTO-SNAPSHOT of Kit/index.tsx before the 2026-07 fidelity pass — the
// BEFORE side of every kit measurement. Do not edit by hand.
import * as THREE from 'three';
import { box, cyl, ball } from '../../mp3d/components/Stage';

// Shared scenery builders — modelled from RCT2 scenery sprites. Static builders
// return a THREE.Group; animated ones return { group, update }. Deterministic:
// scatter uses a hashed-sine sequence, never Math.random.
export type T = typeof THREE;

const hash01 = (n: number) => {
  const s = Math.sin(n * 12.9898 + 78.233) * 43758.5453;
  return s - Math.floor(s);
};

export function tree(t: T, opts: { shape?: 'round' | 'pine' | 'palm' | 'willow'; scale?: number } = {}) {
  const shape = opts.shape ?? 'round';
  const g = new t.Group();
  const BARK = 0x5a3d22;
  if (shape === 'pine') {
    g.add(cyl(t, 0.1, 0.16, 1.0, BARK, [0, 0.5, 0], { tex: 'wood', repeat: [2, 3], rough: 1 }));
    for (let i = 0; i < 4; i++)
      g.add(cyl(t, 0.02, 0.55 - i * 0.12, 0.5, 0x2f6a34, [0, 0.95 + i * 0.42, 0], { tex: 'leaf', repeat: [3, 2], flat: true, rough: 1, seg: 8 }));
  } else if (shape === 'palm') {
    // first segment reaches below ground so the trunk is always seated
    for (let s = 0; s < 6; s++)
      g.add(cyl(t, 0.08, 0.1, s === 0 ? 0.34 : 0.28, BARK, [0, s === 0 ? 0.12 : 0.15 + s * 0.26, 0], { tex: 'wood', repeat: [1, 1], rough: 1, rotZ: 0.05 * (s % 2 ? 1 : -1) }));
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2;
      // fronds at 1.62: drooping inner ends root inside the coconut crown ball
      const frond = box(t, [0.9, 0.04, 0.22], 0x4f9a3a, [Math.cos(a) * 0.45, 1.62, Math.sin(a) * 0.45], { tex: 'leaf', repeat: [3, 1], flat: true, rough: 1, rotY: -a, rotZ: -0.35 });
      g.add(frond);
    }
    g.add(ball(t, 0.12, 0x7a5a2a, [0, 1.7, 0], { rough: 0.8 }));
  } else if (shape === 'willow') {
    g.add(cyl(t, 0.12, 0.18, 1.0, BARK, [0, 0.5, 0], { tex: 'wood', repeat: [2, 3], rough: 1 }));
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      g.add(cyl(t, 0.04, 0.02, 0.9, 0x7a9a3a, [Math.cos(a) * 0.6, 1.15, Math.sin(a) * 0.6], { tex: 'leaf', repeat: [1, 3], flat: true, rough: 1, seg: 6 }));
    }
    g.add(ball(t, 0.6, 0x86a84a, [0, 1.5, 0], { tex: 'leaf', repeat: [3, 3], flat: true, rough: 1 }));
  } else {
    const greens = [0x6f8f3a, 0x5c7d2e, 0x86a84a, 0x7c9a40];
    g.add(cyl(t, 0.14, 0.2, 1.1, BARK, [0, 0.55, 0], { tex: 'wood', repeat: [3, 3], rough: 1 }));
    ([[0, 1.55, 0, 0.74], [-0.5, 1.36, 0.18, 0.5], [0.5, 1.42, -0.12, 0.55], [0.12, 1.9, 0, 0.5], [-0.2, 1.55, -0.45, 0.45], [0.35, 1.6, 0.4, 0.46]] as number[][]).forEach(
      (b, i) => g.add(ball(t, b[3], greens[i % 4], [b[0], b[1], b[2]], { tex: 'leaf', repeat: [3, 3], flat: true, rough: 1 })),
    );
  }
  if (opts.scale) g.scale.setScalar(opts.scale);
  return g;
}

export function bench(t: T) {
  const g = new t.Group();
  const W = 0x8a5a2a;
  for (let i = 0; i < 3; i++) g.add(box(t, [1.0, 0.04, 0.12], W, [0, 0.4, -0.16 + i * 0.16], { tex: 'wood', repeat: [4, 1], rough: 0.8 }));
  for (let i = 0; i < 3; i++) g.add(box(t, [1.0, 0.12, 0.04], W, [0, 0.55 + i * 0.13, -0.24], { tex: 'wood', repeat: [4, 1], rough: 0.8 }));
  [-0.42, 0.42].forEach((x) => {
    g.add(box(t, [0.06, 0.42, 0.5], 0x2b2b30, [x, 0.2, -0.05], { tex: 'metal', metal: 0.6, rough: 0.5 }));
    g.add(box(t, [0.06, 0.4, 0.06], 0x2b2b30, [x, 0.6, -0.24], { tex: 'metal', metal: 0.6, rough: 0.5 }));
  });
  return g;
}

export function bin(t: T) {
  const g = new t.Group();
  g.add(cyl(t, 0.16, 0.14, 0.5, 0x2f6a34, [0, 0.28, 0], { tex: 'metal', metal: 0.4, rough: 0.6, seg: 16 }));
  g.add(cyl(t, 0.18, 0.18, 0.05, 0x244f27, [0, 0.55, 0], { tex: 'metal', metal: 0.4, rough: 0.6, seg: 16 }));
  g.add(cyl(t, 0.03, 0.03, 0.5, 0x2b2b30, [0, 0.25, 0], { metal: 0.6, rough: 0.5, seg: 8 }));
  return g;
}

export function hedge(t: T, len = 2) {
  const g = new t.Group();
  g.add(box(t, [len, 0.7, 0.5], 0x3c6b2e, [0, 0.35, 0], { tex: 'leaf', repeat: [Math.round(len * 3), 3], flat: true, rough: 1, bump: 0.05 }));
  return g;
}

export function flowerBed(t: T) {
  const g = new t.Group();
  g.add(box(t, [1.2, 0.2, 1.2], 0x6a4a2c, [0, 0.1, 0], { tex: 'wood', repeat: [4, 4], rough: 1 }));
  g.add(box(t, [1.1, 0.08, 1.1], 0x3c6b2e, [0, 0.22, 0], { tex: 'leaf', repeat: [4, 4], flat: true, rough: 1 }));
  const cols = [0xe23a3a, 0xf0d000, 0xe060a0, 0xffffff, 0x7a4de0];
  for (let i = 0; i < 24; i++) {
    const x = (hash01(i * 3 + 1) - 0.5) * 1.0;
    const z = (hash01(i * 3 + 2) - 0.5) * 1.0;
    g.add(cyl(t, 0.005, 0.005, 0.14, 0x2f6a34, [x, 0.32, z], { seg: 5 }));
    g.add(ball(t, 0.05, cols[i % cols.length], [x, 0.4, z], { flat: true, rough: 0.7 }));
  }
  return g;
}

export function rock(t: T, scale = 1) {
  const g = new t.Group();
  const grey = [0x8a8880, 0x76746c, 0x9a988f];
  for (let i = 0; i < 5; i++) {
    const r = 0.25 + hash01(i * 5 + 1) * 0.25;
    // rest height tied to the radius: squashed boulder bottoms sit ~0.18r
    // below ground, so every stone reads as bedded in — never floating
    const b = ball(t, r, grey[i % 3], [(hash01(i * 5 + 2) - 0.5) * 0.5, r * 0.52, (hash01(i * 5 + 3) - 0.5) * 0.5], {
      tex: 'concrete',
      repeat: [2, 2],
      flat: true,
      rough: 1,
    });
    b.scale.set(1, 0.7, 1);
    g.add(b);
  }
  g.scale.setScalar(scale);
  return g;
}

export function statue(t: T, kind: 'obelisk' | 'knight' | 'urn' | 'giraffe' = 'knight') {
  const g = new t.Group();
  const STONE = 0xb9b09a;
  g.add(box(t, [0.9, 0.3, 0.9], STONE, [0, 0.15, 0], { tex: 'concrete', repeat: [3, 1], rough: 0.9 }));
  g.add(box(t, [0.6, 0.4, 0.6], STONE, [0, 0.5, 0], { tex: 'concrete', repeat: [2, 1], rough: 0.9 }));
  if (kind === 'obelisk') {
    g.add(box(t, [0.28, 1.6, 0.28], STONE, [0, 1.5, 0], { tex: 'concrete', repeat: [1, 4], rough: 0.9 }));
    g.add(cyl(t, 0, 0.22, 0.3, 0xe8d070, [0, 2.45, 0], { metal: 0.6, rough: 0.3, seg: 4 }));
  } else if (kind === 'urn') {
    g.add(cyl(t, 0.28, 0.16, 0.5, STONE, [0, 0.95, 0], { tex: 'concrete', repeat: [2, 1], rough: 0.9, seg: 20 }));
    g.add(cyl(t, 0.34, 0.28, 0.14, STONE, [0, 1.25, 0], { tex: 'concrete', rough: 0.9, seg: 20 }));
    g.add(ball(t, 0.28, 0x3c6b2e, [0, 1.45, 0], { tex: 'leaf', repeat: [3, 3], flat: true }));
  } else if (kind === 'giraffe') {
    // slabs bottom out inside the plinth (top 0.7) even with the stagger
    for (let i = 0; i < 4; i++) g.add(box(t, [0.3, 0.9, 0.18], 0xd0d0c4, [(i - 1.5) * 0.16, 1.05 + (i % 2) * 0.05, 0], { tex: 'leaf', repeat: [1, 3], flat: true, rough: 1 }));
  } else {
    // knight-ish figure
    g.add(cyl(t, 0.16, 0.2, 0.6, STONE, [0, 1.0, 0], { tex: 'concrete', rough: 0.9, seg: 16 })); // body
    g.add(ball(t, 0.16, STONE, [0, 1.4, 0], { rough: 0.9 })); // head
    g.add(box(t, [0.08, 0.8, 0.08], STONE, [0.22, 1.1, 0], { rough: 0.9, rotZ: 0.1 })); // spear
    g.add(box(t, [0.32, 0.32, 0.03], STONE, [-0.2, 1.0, 0], { tex: 'concrete', rough: 0.9 })); // shield
  }
  return g;
}

export function foodStall(t: T) {
  const g = new t.Group();
  g.add(box(t, [1.3, 0.7, 0.8], 0xf0e6d0, [0, 0.35, 0], { tex: 'wood', repeat: [4, 2], rough: 0.7 }));
  g.add(box(t, [1.3, 0.1, 0.9], 0x8a2a2a, [0, 0.72, 0], { tex: 'fabric', repeat: [6, 1], rough: 0.7 }));
  // striped awning: back ends embedded in the roof band's front edge, gently
  // sloping OUT and DOWN over the counter — attached, never floating
  for (let i = 0; i < 6; i++) g.add(box(t, [0.2, 0.04, 0.5], i % 2 ? 0xe0e0e0 : 0xd83a3a, [-0.55 + i * 0.22, 0.7, 0.685], { rotX: 0.2, rough: 0.6 }));
  g.add(box(t, [1.2, 0.06, 0.3], 0xc9a24a, [0, 0.62, 0.4], { tex: 'wood', repeat: [4, 1], rough: 0.7 })); // counter
  return g;
}

export function fence(t: T, len = 2) {
  const g = new t.Group();
  for (let x = -len / 2; x <= len / 2; x += 0.5) g.add(cyl(t, 0.04, 0.04, 0.7, 0x8a5a2a, [x, 0.35, 0], { tex: 'wood', repeat: [1, 2], rough: 0.8, seg: 8 }));
  [0.2, 0.5].forEach((y) => g.add(box(t, [len, 0.06, 0.05], 0x8a5a2a, [0, y, 0], { tex: 'wood', repeat: [Math.round(len * 3), 1], rough: 0.8 })));
  return g;
}

export function lamp(t: T) {
  const g = new t.Group();
  const glass = new t.MeshStandardMaterial({ color: 0xfff2c0, emissive: 0xffcc55, emissiveIntensity: 1, roughness: 0.4 });
  g.add(cyl(t, 0.14, 0.18, 0.16, 0x2b2b30, [0, 0.08, 0], { tex: 'metal', metal: 0.5, rough: 0.5, seg: 12 }));
  g.add(cyl(t, 0.05, 0.06, 1.5, 0x2b2b30, [0, 0.83, 0], { tex: 'metal', metal: 0.6, rough: 0.4, seg: 12 }));
  const lantern = new t.Mesh(new t.BoxGeometry(0.24, 0.3, 0.24), glass);
  lantern.position.set(0, 1.7, 0);
  g.add(lantern);
  g.add(box(t, [0.3, 0.06, 0.3], 0x2b2b30, [0, 1.88, 0], { tex: 'metal', metal: 0.6, rough: 0.4 }));
  return { group: g, update: (time: number) => (glass.emissiveIntensity = 0.8 + Math.sin(time * 8) * 0.15 + Math.sin(time * 23) * 0.05) };
}

export function fountain(t: T) {
  const g = new t.Group();
  const STONE = 0xc3b7a0;
  g.add(cyl(t, 1.1, 1.2, 0.4, STONE, [0, 0.2, 0], { tex: 'concrete', repeat: [10, 1], rough: 0.9, seg: 28 }));
  g.add(cyl(t, 1.0, 1.0, 0.08, 0x2a6fb0, [0, 0.42, 0], { emissive: 0x134a78, rough: 0.2, metal: 0.3, seg: 28 })); // pool
  g.add(cyl(t, 0.18, 0.24, 0.9, STONE, [0, 0.85, 0], { tex: 'concrete', repeat: [3, 2], rough: 0.9, seg: 20 })); // pedestal
  g.add(cyl(t, 0.5, 0.4, 0.12, STONE, [0, 1.2, 0], { tex: 'concrete', rough: 0.9, seg: 20 })); // upper bowl
  const jets: THREE.Mesh[] = [];
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const jetGeo = new t.CylinderGeometry(0.02, 0.04, 0.5, 6);
    jetGeo.translate(0, 0.25, 0); // origin at the jet base — scaling grows the spray upward
    const jet = new t.Mesh(jetGeo, new t.MeshStandardMaterial({ color: 0xafe0f5, transparent: true, opacity: 0.7, roughness: 0.2 }));
    jet.position.set(Math.cos(a) * 0.3, 1.24, Math.sin(a) * 0.3); // rooted in the upper bowl
    g.add(jet);
    jets.push(jet);
  }
  return {
    group: g,
    update: (time: number) => jets.forEach((j, i) => (j.scale.y = 0.6 + Math.abs(Math.sin(time * 4 + i)) * 0.9)),
  };
}

// Showcase: EVERY scenery builder together (trees, bench, bin, fence, hedge,
// rock, food stall, both statues, flower bed, lamp, fountain) — the museum
// ring: 13 exhibits on an ellipse around the central fountain, long pieces
// turned tangent to the ring, everything inside the fixed 45° camera frame.
export function buildKitScene(three: typeof THREE): { group: THREE.Group; update?: (time: number) => void } {
  const group = new three.Group();
  const update =
    ((t: typeof THREE, g: THREE.Group) => {
        const A = 4.0; // ellipse half-axis, x
        const B = 2.6; // ellipse half-axis, z
        const ring = (obj: THREE.Object3D, i: number, n: number, tangent = false) => {
          const th = (i / n) * Math.PI * 2;
          obj.position.set(Math.cos(th) * A, 0, Math.sin(th) * B);
          if (tangent) obj.rotation.y = -th; // long pieces lie along the ring
          else obj.rotation.y = Math.PI / 2 - th; // faces turn toward the centre
          g.add(obj);
        };
        const N = 13;
        ring(foodStall(t), 0, N);
        ring(bench(t), 1, N);
        ring(bin(t), 2, N);
        ring(fence(t, 2), 3, N, true);
        ring(rock(t), 4, N);
        ring(statue(t, 'obelisk'), 5, N);
        ring(tree(t, { shape: 'pine' }), 6, N);
        ring(tree(t, { shape: 'palm' }), 7, N);
        ring(flowerBed(t), 8, N);
        ring(statue(t, 'giraffe'), 9, N);
        const l = lamp(t);
        ring(l.group, 10, N);
        ring(tree(t), 11, N);
        ring(hedge(t, 2), 12, N, true);
        const f = fountain(t);
        f.group.position.set(0, 0, 0);
        g.add(f.group);
        return (time) => {
          l.update(time);
          f.update(time);
        };
      })(three, group) || undefined;
  return { group, update };
}


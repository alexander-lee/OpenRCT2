import React from 'react';
import * as THREE from 'three';
import { box, cyl, ball, mat, nightKOf } from '../Stage';
import { composable } from '../Park';

// ---------------------------------------------------------------------------
// SceneryPack — 20 classic RCT2 base-game scenery objects (gardens / walls /
// statues tabs) that the Kit does NOT already cover. Every piece is grounded
// at y=0 on its own origin, deterministic (hashed-sine scatter, never
// Math.random), textured + bump-mapped on large faces, and contact-audited:
// each part's bottom meets (or embeds into) its support — comments carry the
// arithmetic. Animated pieces (TV static, clock hands, pennant, balloon)
// return an optional per-piece `update(time)`.
// ---------------------------------------------------------------------------

export type T = typeof THREE;

const hash01 = (n: number) => {
  const s = Math.sin(n * 12.9898 + 78.233) * 43758.5453;
  return s - Math.floor(s);
};

// palette
const STONE = 0xb9b09a;
const MARBLE = 0xdad6cc;
const IRON = 0x2b2e33;
const WOOD = 0x8a5a2a;
const WOOD_DARK = 0x5f3f1e;
const LEAF = 0x3c6b2e;

/** cylinder rod from `from` to `to` (origin at `from`) — ropes, braces, stays */
function rod(t: T, from: [number, number, number], to: [number, number, number], r: number, color: number, o: Parameters<typeof mat>[2] = {}) {
  const dir = new t.Vector3(to[0] - from[0], to[1] - from[1], to[2] - from[2]);
  const L = dir.length();
  const geo = new t.CylinderGeometry(r, r, L, 6);
  geo.translate(0, L / 2, 0); // pivot at the near end
  const m = new t.Mesh(geo, mat(t, color, o));
  m.position.set(...from);
  m.quaternion.setFromUnitVectors(new t.Vector3(0, 1, 0), dir.normalize());
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

type Built = { group: THREE.Group; update?: (time: number) => void };
type Builder = (t: T, seed: number) => Built;

// ---------------------------------------------------------------------------
// 1. marbleStatue — abstract figure on a two-step plinth
// ---------------------------------------------------------------------------
function marbleStatue(t: T): Built {
  const g = new t.Group();
  // steps: 0→0.24, 0.24→0.54 — each sits flush on the previous
  g.add(box(t, [0.95, 0.24, 0.95], STONE, [0, 0.12, 0], { tex: 'concrete', repeat: [3, 1], rough: 0.9, bump: 0.03 }));
  g.add(box(t, [0.66, 0.3, 0.66], MARBLE, [0, 0.39, 0], { tex: 'concrete', repeat: [2, 1], rough: 0.55 }));
  // figure: legs 0.54→1.04, torso bottom 1.03 (embeds 0.01), head on shoulders
  g.add(cyl(t, 0.1, 0.13, 0.5, MARBLE, [0, 0.79, 0], { tex: 'concrete', rough: 0.5, seg: 14 }));
  g.add(cyl(t, 0.15, 0.11, 0.48, MARBLE, [0, 1.27, 0], { tex: 'concrete', rough: 0.5, seg: 14 })); // torso 1.03→1.51
  g.add(ball(t, 0.13, MARBLE, [0, 1.6, 0], { rough: 0.5 })); // head bottom 1.47 < torso top 1.51 — seated
  // arms: one raised, one down — shoulder ends embed in the torso (torso r≈0.15 at top)
  g.add(box(t, [0.07, 0.42, 0.07], MARBLE, [0.19, 1.55, 0], { rough: 0.5, rotZ: -0.5 }));
  g.add(box(t, [0.07, 0.36, 0.07], MARBLE, [-0.17, 1.32, 0], { rough: 0.5, rotZ: 0.35 }));
  g.add(ball(t, 0.055, 0xd8b54a, [0.31, 1.74, 0], { metal: 0.7, rough: 0.3 })); // gold orb in raised hand
  return { group: g };
}

// ---------------------------------------------------------------------------
// 2. birdbath — fluted column, shallow bowl, still water disc
// ---------------------------------------------------------------------------
function birdbath(t: T): Built {
  const g = new t.Group();
  g.add(cyl(t, 0.28, 0.35, 0.12, STONE, [0, 0.06, 0], { tex: 'concrete', repeat: [4, 1], rough: 0.9, seg: 18 })); // base 0→0.12
  g.add(cyl(t, 0.09, 0.13, 0.6, STONE, [0, 0.42, 0], { tex: 'concrete', repeat: [2, 2], rough: 0.9, seg: 10, flat: true })); // fluted column 0.12→0.72
  g.add(cyl(t, 0.42, 0.14, 0.16, STONE, [0, 0.8, 0], { tex: 'concrete', repeat: [4, 1], rough: 0.9, seg: 20 })); // bowl 0.72→0.88
  g.add(cyl(t, 0.34, 0.34, 0.02, 0x2a6fb0, [0, 0.89, 0], { emissive: 0x134a78, rough: 0.15, metal: 0.3, seg: 20 })); // water ON bowl top (0.88→0.90)
  const lip = new t.Mesh(new t.TorusGeometry(0.4, 0.035, 8, 24), mat(t, STONE, { tex: 'concrete', rough: 0.9 }));
  lip.rotation.x = Math.PI / 2;
  lip.position.y = 0.895; // lip tube bottom 0.86 embeds in the bowl wall
  lip.castShadow = true;
  g.add(lip);
  return { group: g };
}

// ---------------------------------------------------------------------------
// 3. picnicTable — wooden table + benches, striped parasol
// ---------------------------------------------------------------------------
function picnicTable(t: T): Built {
  const g = new t.Group();
  // leg panels 0→0.67 carry the top (bottom 0.67); seat beams top 0.45 carry seats
  [-0.55, 0.55].forEach((x) => {
    g.add(box(t, [0.06, 0.67, 0.6], WOOD_DARK, [x, 0.335, 0], { tex: 'wood', repeat: [1, 2], rough: 0.9 }));
    g.add(box(t, [0.06, 0.06, 1.5], WOOD_DARK, [x, 0.42, 0], { tex: 'wood', repeat: [1, 4], rough: 0.9 })); // beam through the panel
  });
  g.add(box(t, [1.4, 0.06, 0.8], WOOD, [0, 0.7, 0], { tex: 'wood', repeat: [5, 3], rough: 0.85, bump: 0.03 })); // top 0.67→0.73
  [-0.6, 0.6].forEach((z) => g.add(box(t, [1.4, 0.05, 0.26], WOOD, [0, 0.475, z], { tex: 'wood', repeat: [5, 1], rough: 0.85 }))); // seats rest on beams (0.45)
  // parasol: pole 0→2.2 through the table; canopy cone straddles the pole top
  g.add(cyl(t, 0.03, 0.035, 2.2, 0xdfd8c8, [0, 1.1, 0], { tex: 'metal', rough: 0.5, metal: 0.3, seg: 10 }));
  g.add(cyl(t, 0.02, 1.0, 0.45, 0xc23636, [0, 2.0, 0], { tex: 'fabric', repeat: [8, 2], rough: 0.75, seg: 12, flat: true })); // canopy 1.775→2.225
  g.add(ball(t, 0.05, 0xd8b54a, [0, 2.25, 0], { metal: 0.6, rough: 0.35 })); // finial bottom 2.2 = pole top
  return { group: g };
}

// ---------------------------------------------------------------------------
// 4. planterBox — checkerboard-tile planter with a deterministic flower grid
// ---------------------------------------------------------------------------
function planterBox(t: T, seed: number): Built {
  const g = new t.Group();
  g.add(box(t, [1.34, 0.06, 1.34], STONE, [0, 0.03, 0], { tex: 'concrete', repeat: [5, 5], rough: 0.9 })); // slab 0→0.06
  // checker walls: 8 cubes/side × 2 rows of 0.15 cubes on the slab (0.06→0.36)
  const dark = 0x3a3a3e;
  const light = 0xd8d4cc;
  for (let row = 0; row < 2; row++) {
    for (let i = 0; i < 8; i++) {
      const p = -0.525 + i * 0.15;
      const col = (i + row) % 2 ? dark : light;
      const col2 = (i + row) % 2 ? light : dark;
      const y = 0.06 + 0.075 + row * 0.15;
      g.add(box(t, [0.15, 0.15, 0.15], col, [p, y, -0.525], { tex: 'concrete', rough: 0.85 }));
      g.add(box(t, [0.15, 0.15, 0.15], col2, [p, y, 0.525], { tex: 'concrete', rough: 0.85 }));
      g.add(box(t, [0.15, 0.15, 0.15], col2, [-0.525, y, p], { tex: 'concrete', rough: 0.85 }));
      g.add(box(t, [0.15, 0.15, 0.15], col, [0.525, y, p], { tex: 'concrete', rough: 0.85 }));
    }
  }
  g.add(box(t, [0.92, 0.06, 0.92], 0x4a3826, [0, 0.28, 0], { tex: 'asphalt', repeat: [4, 4], rough: 1 })); // soil top 0.31, inside walls
  const cols = [0xe23a3a, 0xf0d000, 0xffffff, 0xe060a0];
  for (let ix = 0; ix < 4; ix++)
    for (let iz = 0; iz < 4; iz++) {
      const x = -0.33 + ix * 0.22 + (hash01(ix * 7 + iz * 3 + seed * 17.13) - 0.5) * 0.06;
      const z = -0.33 + iz * 0.22 + (hash01(ix * 5 + iz * 11 + 4 + seed * 17.13) - 0.5) * 0.06;
      g.add(cyl(t, 0.006, 0.006, 0.16, 0x2f6a34, [x, 0.31 + 0.08, z], { seg: 5 })); // stem roots in soil top
      g.add(ball(t, 0.05, cols[(ix + iz * 4) % 4], [x, 0.31 + 0.18, z], { flat: true, rough: 0.7 })); // head on stem top
    }
  return { group: g };
}

// ---------------------------------------------------------------------------
// 5. topiarySpiral — clipped spiral cone climbing a trunk
// ---------------------------------------------------------------------------
function topiarySpiral(t: T): Built {
  const g = new t.Group();
  g.add(cyl(t, 0.06, 0.09, 1.65, WOOD_DARK, [0, 0.82, 0], { tex: 'wood', repeat: [1, 4], rough: 1, seg: 10 })); // trunk 0→1.65
  const N = 10;
  for (let i = 0; i < N; i++) {
    const f = i / (N - 1);
    const r = 0.34 - f * 0.24; // 0.34 → 0.10
    const a = i * 1.9;
    const off = 0.2 * (1 - f * 0.85);
    // y starts at 0.34 so the fattest ball rests exactly on the ground (0.34 − r₀ = 0)
    const y = 0.34 + i * 0.145;
    g.add(ball(t, r, i % 2 ? 0x35622a : LEAF, [Math.cos(a) * off, y, Math.sin(a) * off], { tex: 'leaf', repeat: [3, 3], flat: true, rough: 1, bump: 0.04 }));
  }
  g.add(ball(t, 0.09, LEAF, [0, 1.72, 0], { tex: 'leaf', repeat: [2, 2], flat: true, rough: 1 })); // tip caps the trunk (bottom 1.63 < 1.65)
  return { group: g };
}

// ---------------------------------------------------------------------------
// 6. topiaryElephant — clipped-leaf elephant on a grass pad
// ---------------------------------------------------------------------------
function topiaryElephant(t: T): Built {
  const g = new t.Group();
  const L = { tex: 'leaf' as const, repeat: [3, 3] as [number, number], flat: true, rough: 1, bump: 0.04 };
  g.add(cyl(t, 0.72, 0.78, 0.15, 0x527a34, [0, 0.075, 0], { tex: 'leaf', repeat: [6, 1], flat: true, rough: 1, seg: 20 })); // pad 0→0.15
  // legs 0.15→0.5; body ball (r0.42, y-scale 0.85) bottom 0.72−0.357=0.363 < 0.5 — sits into the legs
  [
    [0.24, 0.15],
    [0.24, -0.15],
    [-0.26, 0.15],
    [-0.26, -0.15],
  ].forEach(([x, z]) => g.add(cyl(t, 0.09, 0.1, 0.35, LEAF, [x, 0.325, z], { ...L, seg: 10 })));
  const body = ball(t, 0.42, LEAF, [0, 0.72, 0], L);
  body.scale.set(1.15, 0.85, 0.8);
  g.add(body);
  const head = ball(t, 0.26, LEAF, [0.48, 0.95, 0], L); // embeds in the body (body reaches x≈0.48)
  g.add(head);
  // ears: centres 0.216 from the head centre — fully rooted in the head ball (r 0.26)
  [0.2, -0.2].forEach((z) => g.add(box(t, [0.06, 0.3, 0.24], 0x35622a, [0.42, 1.0, z], { ...L, rotY: 0.25 * Math.sign(z) })));
  // trunk: chained segments — each next base sits at the previous tip
  g.add(rod(t, [0.66, 1.0, 0], [0.84, 0.72, 0], 0.06, LEAF, L)); // roots inside the head surface
  g.add(rod(t, [0.84, 0.72, 0], [0.9, 0.45, 0], 0.05, LEAF, L));
  g.add(ball(t, 0.055, LEAF, [0.9, 0.45, 0], L)); // trunk tip
  g.add(rod(t, [-0.46, 0.85, 0], [-0.58, 0.62, 0], 0.025, LEAF, L)); // tail off the body rear
  return { group: g };
}

// ---------------------------------------------------------------------------
// 7. signpost — wooden post with a blank routed board
// ---------------------------------------------------------------------------
function signpost(t: T): Built {
  const g = new t.Group();
  g.add(cyl(t, 0.05, 0.065, 1.5, WOOD_DARK, [0, 0.75, 0], { tex: 'wood', repeat: [1, 4], rough: 0.95, seg: 10 })); // post 0→1.5
  g.add(ball(t, 0.06, WOOD_DARK, [0, 1.51, 0], { tex: 'wood', repeat: [1, 1], rough: 0.95 })); // cap on the post top
  // board back face z=0.02 < post radius 0.05 — embedded, never floating
  g.add(box(t, [0.92, 0.42, 0.06], 0xc9a25a, [0, 1.14, 0.05], { tex: 'wood', repeat: [4, 2], rough: 0.85, bump: 0.03 }));
  // routed frame strips sit proud of the board face (z 0.08 vs board front 0.08)
  [
    [0.92, 0.05, 0.955],
    [0.92, 0.05, 1.325],
  ].forEach(([w, h, y]) => g.add(box(t, [w, h, 0.03], WOOD_DARK, [0, y, 0.085], { tex: 'wood', repeat: [4, 1], rough: 0.9 })));
  [-0.435, 0.435].forEach((x) => g.add(box(t, [0.05, 0.42, 0.03], WOOD_DARK, [x, 1.14, 0.085], { tex: 'wood', repeat: [1, 2], rough: 0.9 })));
  g.add(rod(t, [0, 0.78, 0.03], [0, 0.94, 0.06], 0.02, WOOD_DARK, { rough: 0.9 })); // brace: post → board underside
  return { group: g };
}

// ---------------------------------------------------------------------------
// 8. tvMonitorPost — queue-line CRT on a post; screen static shimmers (animated)
// ---------------------------------------------------------------------------
function tvMonitorPost(t: T): Built {
  const g = new t.Group();
  g.add(cyl(t, 0.16, 0.2, 0.1, IRON, [0, 0.05, 0], { tex: 'metal', metal: 0.5, rough: 0.55, seg: 14 })); // base 0→0.1
  g.add(box(t, [0.08, 1.4, 0.08], IRON, [0, 0.8, 0], { tex: 'metal', metal: 0.55, rough: 0.5 })); // post 0.1→1.5
  g.add(box(t, [0.62, 0.46, 0.4], 0x3a3d42, [0, 1.73, 0], { tex: 'plastic', repeat: [3, 2], rough: 0.6 })); // CRT bottom 1.5 = post top
  const screen = new t.MeshStandardMaterial({ color: 0x0d1f2e, emissive: 0x9fd4e8, emissiveIntensity: 0.55, roughness: 0.25 });
  const sc = new t.Mesh(new t.BoxGeometry(0.5, 0.34, 0.02), screen);
  sc.position.set(0, 1.73, 0.21); // proud of the CRT front face (0.2)
  g.add(sc);
  g.add(box(t, [0.56, 0.05, 0.44], 0x3a3d42, [0, 1.985, 0], { tex: 'plastic', rough: 0.6 })); // visor cap on the CRT top (1.96)
  return {
    group: g,
    update: (time) => {
      const k = nightKOf(g);
      screen.emissiveIntensity = 0.5 + 0.45 * k + Math.sin(time * 17.3) * 0.09 + Math.sin(time * 53.7) * 0.07; // static shimmer
    },
  };
}

// ---------------------------------------------------------------------------
// 9. parkClock — RCT2's little park clock; hands turn (animated)
// ---------------------------------------------------------------------------
function parkClock(t: T): Built {
  const g = new t.Group();
  g.add(cyl(t, 0.18, 0.25, 0.14, IRON, [0, 0.07, 0], { tex: 'metal', metal: 0.5, rough: 0.5, seg: 14 })); // base 0→0.14
  g.add(cyl(t, 0.045, 0.06, 1.9, 0x1f4d33, [0, 1.09, 0], { tex: 'metal', metal: 0.4, rough: 0.5, seg: 12 })); // pole 0.14→2.04
  // drum (axis along z) centre 2.3, r 0.34 — bottom 1.96 overlaps the pole top 2.04
  g.add(cyl(t, 0.34, 0.34, 0.14, 0x1f4d33, [0, 2.3, 0], { tex: 'metal', metal: 0.4, rough: 0.5, seg: 24, rotX: Math.PI / 2 }));
  g.add(ball(t, 0.06, 0xd8b54a, [0, 2.68, 0], { metal: 0.7, rough: 0.3 })); // finial bottom 2.62 < drum top 2.64
  const hands: THREE.Mesh[] = [];
  [0.08, -0.08].forEach((z, fi) => {
    g.add(cyl(t, 0.28, 0.28, 0.02, 0xf2eee2, [0, 2.3, z], { rough: 0.4, seg: 24, rotX: Math.PI / 2 })); // face proud of the drum side (0.07)
    for (let h = 0; h < 12; h++) {
      const a = (h / 12) * Math.PI * 2;
      g.add(box(t, [0.02, 0.05, 0.012], 0x22242a, [Math.cos(a) * 0.235, 2.3 + Math.sin(a) * 0.235, z * 1.2], { rotZ: a })); // hour ticks on the face
    }
    const mk = (len: number, wid: number) => {
      const geo = new t.BoxGeometry(wid, len, 0.012);
      geo.translate(0, len / 2 - 0.02, 0); // pivot at the hub
      const m = new t.Mesh(geo, mat(t, 0x22242a, { rough: 0.4 }));
      m.position.set(0, 2.3, z * 1.32); // in front of the face + ticks
      m.userData.dir = fi === 0 ? -1 : 1; // mirrored so both sides read clockwise
      g.add(m);
      hands.push(m);
      return m;
    };
    mk(0.24, 0.02); // minute
    mk(0.16, 0.028); // hour
  });
  return {
    group: g,
    update: (time) =>
      hands.forEach((h, i) => {
        const minute = i % 2 === 0;
        h.rotation.z = (h.userData.dir as number) * time * (minute ? 0.22 : 0.22 / 12);
      }),
  };
}

// ---------------------------------------------------------------------------
// 10. flagpole — pennant waves via a chained-segment sine (animated)
// ---------------------------------------------------------------------------
function flagpole(t: T): Built {
  const g = new t.Group();
  g.add(cyl(t, 0.14, 0.19, 0.12, STONE, [0, 0.06, 0], { tex: 'concrete', repeat: [3, 1], rough: 0.9, seg: 14 })); // base 0→0.12
  g.add(cyl(t, 0.03, 0.05, 2.9, 0xd8d8dc, [0, 1.57, 0], { tex: 'metal', metal: 0.6, rough: 0.35, seg: 12 })); // pole 0.12→3.02
  g.add(ball(t, 0.07, 0xd8b54a, [0, 3.06, 0], { metal: 0.7, rough: 0.3 })); // gold finial bottom 2.99 < pole top 3.02
  // pennant: 6 hinged segments, each a child of the previous — the chain stays
  // attached whatever the wave phase; heights taper to a point
  const segs: THREE.Group[] = [];
  let parent: THREE.Object3D = new t.Group();
  parent.position.set(0.03, 2.72, 0); // clipped to the pole surface (r 0.03 up top)
  g.add(parent);
  for (let i = 0; i < 6; i++) {
    const holder = new t.Group();
    holder.position.x = i === 0 ? 0 : 0.21;
    const hgt = 0.34 - i * 0.045; // 0.34 → 0.115
    const panel = box(t, [0.22, hgt, 0.016], 0xc23636, [0.11, 0, 0], { tex: 'fabric', repeat: [2, 2], rough: 0.8 });
    holder.add(panel);
    parent.add(holder);
    segs.push(holder);
    parent = holder;
  }
  return {
    group: g,
    update: (time) => segs.forEach((s, i) => (s.rotation.y = Math.sin(time * 3.1 - i * 0.9) * 0.16 * ((i + 2) / 7))),
  };
}

// ---------------------------------------------------------------------------
// 11. ironArchway — wrought-iron garden arch
// ---------------------------------------------------------------------------
function ironArchway(t: T): Built {
  const g = new t.Group();
  [-1, 1].forEach((sx) => {
    g.add(box(t, [0.3, 0.2, 0.3], STONE, [sx, 0.1, 0], { tex: 'concrete', rough: 0.9 })); // plinth 0→0.2 wraps the column base
    g.add(box(t, [0.16, 2.2, 0.16], IRON, [sx, 1.1, 0], { tex: 'metal', metal: 0.6, rough: 0.45 })); // column 0→2.2
    g.add(box(t, [0.26, 0.06, 0.26], IRON, [sx, 2.23, 0], { tex: 'metal', metal: 0.6, rough: 0.45 })); // cap 2.2→2.26
    g.add(ball(t, 0.06, IRON, [sx, 0.9, 0.11], { metal: 0.6, rough: 0.45 })); // scroll bosses on the column faces
    g.add(ball(t, 0.06, IRON, [sx, 1.6, 0.11], { metal: 0.6, rough: 0.45 }));
  });
  // arch: half-torus radius 1.0 — its ends land exactly on the column caps (±1, 2.26)
  const arch = new t.Mesh(new t.TorusGeometry(1.0, 0.07, 10, 32, Math.PI), mat(t, IRON, { tex: 'metal', metal: 0.6, rough: 0.45 }));
  arch.position.y = 2.26;
  arch.castShadow = true;
  g.add(arch);
  g.add(box(t, [2.0, 0.05, 0.05], IRON, [0, 2.285, 0], { tex: 'metal', metal: 0.6, rough: 0.45 })); // tie bar embedded in both caps
  // lattice verticals: tie bar top (2.31) up into the arch's inner face at each x
  [-0.6, -0.3, 0, 0.3, 0.6].forEach((x) => {
    const yArch = 2.26 + Math.sqrt(1 - x * x) - 0.05; // arch centreline − inner tube reach
    g.add(box(t, [0.035, yArch - 2.26, 0.035], IRON, [x, (yArch + 2.26) / 2, 0], { metal: 0.6, rough: 0.45 }));
  });
  g.add(cyl(t, 0.0, 0.05, 0.22, IRON, [0, 3.42, 0], { metal: 0.6, rough: 0.45, seg: 8 })); // spike: base 3.31 < arch crown 3.33
  return { group: g };
}

// ---------------------------------------------------------------------------
// 12. brickWall — low garden wall with stone coping
// ---------------------------------------------------------------------------
function brickWall(t: T): Built {
  const g = new t.Group();
  // fabric texture's woven grid reads as mortar courses over the brick tint
  g.add(box(t, [2.0, 0.8, 0.24], 0x9a4a32, [0, 0.4, 0], { tex: 'fabric', repeat: [10, 5], rough: 0.95, bump: 0.05 })); // wall 0→0.8
  g.add(box(t, [2.08, 0.08, 0.32], STONE, [0, 0.84, 0], { tex: 'concrete', repeat: [8, 1], rough: 0.9 })); // coping seated on the wall top (0.8)
  [-1.0, 1.0].forEach((x) => {
    g.add(box(t, [0.32, 0.96, 0.32], 0x8a4029, [x, 0.48, 0], { tex: 'fabric', repeat: [2, 5], rough: 0.95, bump: 0.05 })); // pillars 0→0.96 wrap the wall ends
    g.add(box(t, [0.4, 0.07, 0.4], STONE, [x, 0.995, 0], { tex: 'concrete', rough: 0.9 })); // pillar cap on 0.96
    g.add(ball(t, 0.09, STONE, [x, 1.1, 0], { tex: 'concrete', rough: 0.9 })); // ball finial bottom 1.01 < cap top 1.03
  });
  return { group: g };
}

// ---------------------------------------------------------------------------
// 13. picketFence — white pickets with pointed tops
// ---------------------------------------------------------------------------
function picketFence(t: T): Built {
  const g = new t.Group();
  const WHT = 0xe8e6df;
  for (let i = 0; i < 9; i++) {
    const x = -0.96 + i * 0.24;
    g.add(box(t, [0.09, 0.75, 0.03], WHT, [x, 0.375, 0], { tex: 'wood', repeat: [1, 3], rough: 0.8 })); // picket 0→0.75
    g.add(cyl(t, 0.0, 0.062, 0.1, WHT, [x, 0.8, 0], { rough: 0.8, seg: 4, rotY: Math.PI / 4 })); // point base 0.75 = picket top
  }
  // rails run behind the pickets: picket back face −0.015, rail spans −0.055→−0.015 — touching
  [0.24, 0.58].forEach((y) => g.add(box(t, [2.06, 0.07, 0.04], WHT, [0, y, -0.035], { tex: 'wood', repeat: [8, 1], rough: 0.8 })));
  [-1.06, 1.06].forEach((x) => {
    g.add(box(t, [0.11, 0.85, 0.11], WHT, [x, 0.425, -0.02], { tex: 'wood', repeat: [1, 3], rough: 0.8 })); // end posts 0→0.85 (rails embed)
    g.add(box(t, [0.15, 0.04, 0.15], WHT, [x, 0.87, -0.02], { rough: 0.8 })); // post cap on 0.85
  });
  return { group: g };
}

// ---------------------------------------------------------------------------
// 14. lionStatue — recumbent stone lion on a plinth
// ---------------------------------------------------------------------------
function lionStatue(t: T): Built {
  const g = new t.Group();
  const C = { tex: 'concrete' as const, rough: 0.9 };
  g.add(box(t, [1.5, 0.12, 0.85], STONE, [0, 0.06, 0], { ...C, repeat: [5, 1] })); // step 0→0.12
  g.add(box(t, [1.35, 0.26, 0.7], STONE, [0, 0.25, 0], { ...C, repeat: [5, 1], bump: 0.03 })); // plinth 0.12→0.38
  const body = ball(t, 0.32, STONE, [-0.08, 0.6, 0], { ...C, repeat: [3, 2] });
  body.scale.set(1.5, 0.75, 0.8); // bottom 0.6−0.24=0.36 — bedded 0.02 into the plinth top 0.38
  g.add(body);
  const mane = ball(t, 0.28, 0xa89f8a, [0.34, 0.72, 0], { ...C, repeat: [2, 2], flat: true });
  g.add(mane); // overlaps the body front
  g.add(ball(t, 0.17, STONE, [0.44, 0.86, 0], C)); // head centre 0.172 from the mane centre < 0.28 — rooted
  g.add(box(t, [0.15, 0.1, 0.13], STONE, [0.56, 0.82, 0], C)); // muzzle embeds in the head (0.126 < 0.17)
  [0.14, -0.14].forEach((z) => {
    g.add(box(t, [0.34, 0.12, 0.12], STONE, [0.42, 0.44, z], C)); // forepaws on the plinth top (0.38)
    g.add(ball(t, 0.16, STONE, [-0.42, 0.54, z], C)); // haunches bottom 0.38 = plinth top
  });
  g.add(rod(t, [-0.52, 0.5, 0.1], [-0.72, 0.4, 0.22], 0.03, STONE, C)); // tail off the haunch, tip resting on the plinth
  return { group: g };
}

// ---------------------------------------------------------------------------
// 15. cactusCluster — saguaro + barrel cactus on a sand bed
// ---------------------------------------------------------------------------
function cactusCluster(t: T): Built {
  const g = new t.Group();
  const GRN = 0x4a7a3a;
  const L = { tex: 'leaf' as const, repeat: [2, 3] as [number, number], rough: 1, bump: 0.05 };
  g.add(cyl(t, 0.85, 0.92, 0.1, 0xd8b878, [0, 0.05, 0], { tex: 'sand', repeat: [5, 1], rough: 1, seg: 22 })); // sand bed 0→0.1
  g.add(cyl(t, 0.11, 0.13, 1.5, GRN, [0.1, 0.85, 0], { ...L, seg: 12, flat: true })); // trunk 0.1→1.6 on the sand
  g.add(ball(t, 0.11, GRN, [0.1, 1.6, 0], L)); // rounded crown caps the trunk
  // left arm: horizontal butts into the trunk (trunk face x≈−0.02), then rises
  g.add(cyl(t, 0.08, 0.08, 0.3, GRN, [-0.13, 0.95, 0], { ...L, seg: 10, rotZ: Math.PI / 2 }));
  g.add(cyl(t, 0.075, 0.08, 0.5, GRN, [-0.28, 1.16, 0], { ...L, seg: 10 })); // vertical bottom 0.91 embeds in the horizontal (r 0.08 @ y 0.95)
  g.add(ball(t, 0.08, GRN, [-0.28, 1.41, 0], L));
  // right arm, lower
  g.add(cyl(t, 0.07, 0.07, 0.26, GRN, [0.33, 0.68, 0], { ...L, seg: 10, rotZ: Math.PI / 2 }));
  g.add(cyl(t, 0.065, 0.07, 0.4, GRN, [0.46, 0.85, 0], { ...L, seg: 10 })); // bottom 0.65 embeds in the horizontal @ 0.68
  g.add(ball(t, 0.07, GRN, [0.46, 1.05, 0], L));
  // barrel cactus: squashed ball bottom 0.26−0.16=0.1 = sand top
  const barrel = ball(t, 0.2, 0x5a8a42, [-0.42, 0.26, 0.38], { ...L, flat: true });
  barrel.scale.set(1, 0.8, 1);
  g.add(barrel);
  g.add(ball(t, 0.055, 0xe060a0, [-0.42, 0.44, 0.38], { flat: true, rough: 0.7 })); // bloom bottom 0.385 < barrel top 0.42
  g.add(ball(t, 0.13, 0x5a8a42, [0.48, 0.2, -0.38], { ...L, flat: true })); // pup, bottom 0.07 bedded in sand
  return { group: g };
}

// ---------------------------------------------------------------------------
// 16. fallenLog — mossy trunk bedded into the grass
// ---------------------------------------------------------------------------
function fallenLog(t: T): Built {
  const g = new t.Group();
  const W = { tex: 'wood' as const, rough: 1 };
  // trunk axis along x at y 0.17, r≈0.2 — underside −0.03, bedded into the ground
  g.add(cyl(t, 0.2, 0.22, 1.8, 0x6a4a2c, [0, 0.17, 0], { ...W, repeat: [6, 2], bump: 0.05, seg: 14, rotZ: Math.PI / 2, flat: true }));
  [-0.905, 0.905].forEach((x) => g.add(cyl(t, 0.19, 0.19, 0.025, 0xc9a25a, [x, 0.17, 0], { ...W, repeat: [2, 2], seg: 14, rotZ: Math.PI / 2 }))); // cut faces proud of the ends
  // root plate: disc r 0.34 at the thick end — underside −0.04, grounded
  const plate = cyl(t, 0.34, 0.34, 0.1, 0x5a3d22, [-0.95, 0.3, 0], { ...W, repeat: [3, 3], seg: 12, rotZ: Math.PI / 2, flat: true });
  g.add(plate);
  g.add(rod(t, [0.35, 0.3, 0.05], [0.55, 0.62, 0.15], 0.05, 0x6a4a2c, W)); // branch stub roots inside the trunk (surface 0.37)
  [
    [-0.3, 0.05],
    [0.15, -0.06],
    [0.62, 0.03],
  ].forEach(([x, z], i) => {
    const moss = ball(t, 0.13 + hash01(i * 9 + 2) * 0.05, LEAF, [x, 0.34, z], { tex: 'leaf', repeat: [2, 2], flat: true, rough: 1 });
    moss.scale.set(1, 0.35, 1); // squashed patches draped on the trunk crown (0.37)
    g.add(moss);
  });
  return { group: g };
}

// ---------------------------------------------------------------------------
// 17. mushroomCluster — five deterministic toadstools
// ---------------------------------------------------------------------------
function mushroomCluster(t: T, seed: number): Built {
  const g = new t.Group();
  for (let i = 0; i < 5; i++) {
    const h1 = hash01(i * 13 + 1 + seed * 17.13);
    const h2 = hash01(i * 13 + 5 + seed * 17.13);
    const r = 0.1 + h1 * 0.12; // cap radius
    const sh = 0.12 + h2 * 0.18; // stem height
    const a = (i / 5) * Math.PI * 2 + h1 * 0.8;
    const d = i === 0 ? 0 : 0.28 + h2 * 0.2;
    const x = Math.cos(a) * d;
    const z = Math.sin(a) * d;
    g.add(cyl(t, 0.3 * r, 0.42 * r, sh, 0xe8dcc2, [x, sh / 2, z], { tex: 'concrete', rough: 0.9, seg: 10 })); // stem 0→sh
    const cap = ball(t, r, 0xc23a2e, [x, sh + 0.32 * r, z], { flat: true, rough: 0.8 });
    cap.scale.set(1, 0.55, 1); // cap underside sh−0.23r — swallows the stem top
    g.add(cap);
    for (let s = 0; s < 3; s++) {
      const sa = s * 2.1 + i;
      g.add(ball(t, 0.022, 0xf2eee2, [x + Math.cos(sa) * r * 0.45, sh + 0.32 * r + r * 0.42, z + Math.sin(sa) * r * 0.45], { rough: 0.8 })); // spots bedded in the cap crown
    }
  }
  return { group: g };
}

// ---------------------------------------------------------------------------
// 18. wishingWell — stone well, gabled roof, crank, hanging bucket
// ---------------------------------------------------------------------------
function wishingWell(t: T): Built {
  const g = new t.Group();
  g.add(cyl(t, 0.5, 0.56, 0.55, STONE, [0, 0.275, 0], { tex: 'concrete', repeat: [6, 2], rough: 0.95, bump: 0.05, seg: 18 })); // drum 0→0.55
  g.add(cyl(t, 0.4, 0.4, 0.02, 0x101418, [0, 0.56, 0], { rough: 1, seg: 18 })); // dark shaft mouth ON the drum top
  g.add(cyl(t, 0.58, 0.58, 0.08, 0xa89f8a, [0, 0.59, 0], { tex: 'concrete', repeat: [7, 1], rough: 0.9, seg: 18 })); // rim 0.55→0.63
  [-0.48, 0.48].forEach((x) => g.add(box(t, [0.09, 1.1, 0.09], WOOD_DARK, [x, 1.18, 0], { tex: 'wood', repeat: [1, 4], rough: 0.95 }))); // posts 0.63→1.73 on the rim
  g.add(box(t, [1.2, 0.07, 0.07], WOOD_DARK, [0, 1.7, 0], { tex: 'wood', repeat: [4, 1], rough: 0.95 })); // crossbeam embedded in the post tops
  g.add(box(t, [0.07, 0.3, 0.07], WOOD_DARK, [0, 1.87, 0], { tex: 'wood', rough: 0.95 })); // king post 1.72→2.02 carries the ridge
  // roof slabs pitch toward z; high edges meet under the ridge cap at y≈2.0
  [-1, 1].forEach((s) => g.add(box(t, [1.3, 0.045, 0.56], 0x7a4a26, [0, 1.86, -0.215 * s], { tex: 'wood', repeat: [5, 2], rough: 0.95, bump: 0.04, rotX: 0.56 * s })));
  g.add(box(t, [1.32, 0.06, 0.14], 0x5a3d22, [0, 2.02, 0], { tex: 'wood', repeat: [5, 1], rough: 0.95 })); // ridge cap over the king post
  g.add(cyl(t, 0.035, 0.035, 1.08, 0x6a4a2c, [0, 1.45, 0], { tex: 'wood', rough: 0.9, seg: 10, rotZ: Math.PI / 2 })); // axle spans into both posts
  g.add(rod(t, [0.56, 1.45, 0], [0.68, 1.3, 0], 0.025, IRON, { metal: 0.5, rough: 0.5 })); // crank arm off the axle end
  g.add(ball(t, 0.04, IRON, [0.68, 1.3, 0], { metal: 0.5, rough: 0.5 })); // crank knob
  g.add(cyl(t, 0.012, 0.012, 0.45, 0xc9b28a, [0, 1.225, 0], { tex: 'fabric', rough: 1, seg: 6 })); // rope: top 1.45 = axle centre, bottom 1.0
  g.add(cyl(t, 0.1, 0.075, 0.16, 0x6a4a2c, [0, 0.92, 0], { tex: 'wood', repeat: [3, 1], rough: 0.9, seg: 12 })); // bucket: rim 1.0 = rope bottom
  return { group: g };
}

// ---------------------------------------------------------------------------
// 19. gazebo — open hexagonal bandstand
// ---------------------------------------------------------------------------
function gazebo(t: T): Built {
  const g = new t.Group();
  const WHT = 0xe8e2d2;
  g.add(cyl(t, 1.3, 1.36, 0.08, 0xa89f8a, [0, 0.04, 0], { tex: 'concrete', repeat: [8, 1], rough: 0.95, seg: 6 })); // step 0→0.08
  g.add(cyl(t, 1.12, 1.16, 0.14, 0xbfb6a0, [0, 0.11, 0], { tex: 'wood', repeat: [8, 1], rough: 0.9, seg: 6 })); // deck 0.04→0.18, seated on the step
  const R = 0.98;
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2 + Math.PI / 6;
    g.add(cyl(t, 0.05, 0.055, 1.66, WHT, [Math.cos(a) * R, 0.18 + 0.83, Math.sin(a) * R], { tex: 'wood', repeat: [1, 4], rough: 0.85, seg: 10 })); // posts 0.18→1.84
  }
  // railings on 5 sides (front side k=0 open): rails span post-to-post
  for (let k = 1; k < 6; k++) {
    const a1 = (k / 6) * Math.PI * 2 + Math.PI / 6;
    const a2 = ((k + 1) / 6) * Math.PI * 2 + Math.PI / 6;
    const mx = ((Math.cos(a1) + Math.cos(a2)) / 2) * R;
    const mz = ((Math.sin(a1) + Math.sin(a2)) / 2) * R;
    const ry = Math.atan2(Math.cos(a1) - Math.cos(a2), Math.sin(a1) - Math.sin(a2)) * -1;
    [0.68, 0.38].forEach((y) => g.add(box(t, [0.98, 0.05, 0.04], WHT, [mx, y, mz], { tex: 'wood', repeat: [4, 1], rough: 0.85, rotY: ry })));
    for (let b = -2; b <= 2; b++) {
      const f = b * 0.18;
      const bx = mx + Math.cos(ry) * f;
      const bz = mz - Math.sin(ry) * f;
      g.add(box(t, [0.03, 0.28, 0.03], WHT, [bx, 0.52, bz], { rough: 0.85 })); // balusters between the rails (0.38→0.68 span 0.405→0.655 + rails)
    }
  }
  g.add(cyl(t, 0.03, 1.38, 0.6, 0x8a4a3a, [0, 1.84 + 0.3, 0], { tex: 'fabric', repeat: [10, 2], rough: 0.85, seg: 6, flat: true, bump: 0.04 })); // roof base 1.84 = post tops
  g.add(cyl(t, 1.39, 1.39, 0.06, WHT, [0, 1.87, 0], { tex: 'wood', repeat: [10, 1], rough: 0.85, seg: 6 })); // fascia ring around the eave
  g.add(ball(t, 0.08, 0xd8b54a, [0, 2.47, 0], { metal: 0.6, rough: 0.35 })); // finial bottom 2.39 < roof tip 2.44
  return { group: g };
}

// ---------------------------------------------------------------------------
// 20. hotAirBalloon — tethered; sways, burner glows at night (animated)
// ---------------------------------------------------------------------------
function hotAirBalloon(t: T): Built {
  const g = new t.Group();
  const sway = new t.Group(); // pivot at ground level → sway rotates about the tether point
  g.add(sway);
  sway.add(box(t, [0.5, 0.4, 0.5], 0x9a7444, [0, 0.2, 0], { tex: 'fabric', repeat: [5, 4], rough: 1, bump: 0.05 })); // wicker basket 0→0.4 resting on the ground
  sway.add(box(t, [0.54, 0.05, 0.54], 0x6a4a2c, [0, 0.42, 0], { tex: 'wood', repeat: [4, 1], rough: 0.9 })); // basket rim on 0.4
  [
    [0.2, 0.2],
    [0.2, -0.2],
    [-0.2, 0.2],
    [-0.2, -0.2],
  ].forEach(([x, z]) => sway.add(cyl(t, 0.018, 0.018, 0.5, IRON, [x, 0.695, z], { metal: 0.5, rough: 0.5, seg: 8 }))); // burner rods 0.445→0.945 off the rim
  sway.add(box(t, [0.18, 0.12, 0.18], IRON, [0, 0.98, 0], { tex: 'metal', metal: 0.6, rough: 0.4 })); // burner 0.92→1.04 clamps the rod tops
  const flameMat = new t.MeshStandardMaterial({ color: 0xffa64d, emissive: 0xff8a2a, emissiveIntensity: 1.2, transparent: true, opacity: 0.85, roughness: 0.3 });
  const flame = new t.Mesh(new t.ConeGeometry(0.05, 0.16, 8), flameMat);
  flame.position.set(0, 1.11, 0); // flame base 1.03 inside the burner top 1.04
  sway.add(flame);
  sway.add(cyl(t, 0.34, 0.2, 0.32, 0xa8302a, [0, 1.12, 0], { tex: 'fabric', repeat: [6, 1], rough: 0.85, seg: 14 })); // throat 0.96→1.28 bridges burner → envelope
  const env = ball(t, 0.95, 0xc23636, [0, 1.95, 0], { tex: 'fabric', repeat: [8, 6], rough: 0.85, bump: 0.04 });
  env.scale.set(1, 1.15, 1); // envelope 0.86→3.04 — bottom overlaps the throat top 1.28
  sway.add(env);
  sway.add(cyl(t, 0.965, 0.965, 0.34, 0xe8c23a, [0, 1.95, 0], { tex: 'fabric', repeat: [10, 1], rough: 0.85, seg: 22 })); // equator band proud of the envelope
  sway.add(cyl(t, 0.3, 0.3, 0.05, 0xe8c23a, [0, 3.05, 0], { tex: 'fabric', rough: 0.85, seg: 14 })); // crown disc caps the top (3.04)
  // load ropes: basket rim corners → envelope skin at y 1.3 (radius there ≈ 0.76)
  [
    [1, 1],
    [1, -1],
    [-1, 1],
    [-1, -1],
  ].forEach(([sx, sz]) => sway.add(rod(t, [0.24 * sx, 0.42, 0.24 * sz], [0.5 * sx, 1.32, 0.5 * sz], 0.008, 0xd8cfb8, { rough: 1 })));
  const lamp = new t.PointLight(0xffa64d, 0.15, 4, 2);
  lamp.position.set(0, 1.7, 0); // inner glow just above the burner
  sway.add(lamp);
  // ground tether: stake beside the pad; rope runs up to the basket rim corner
  g.add(cyl(t, 0.035, 0.05, 0.25, WOOD_DARK, [0.62, 0.1, 0.62], { tex: 'wood', rough: 0.95, seg: 8 })); // stake driven in (0.02 below grade)
  g.add(rod(t, [0.62, 0.2, 0.62], [0.26, 0.38, 0.26], 0.01, 0xd8cfb8, { rough: 1 })); // taut rope: stake top → rim corner
  return {
    group: g,
    update: (time) => {
      sway.rotation.z = Math.sin(time * 0.7) * 0.028;
      sway.rotation.x = Math.cos(time * 0.53) * 0.022;
      const k = nightKOf(g);
      const flick = Math.sin(time * 9.1) * 0.5 + Math.sin(time * 23.7) * 0.3;
      flameMat.emissiveIntensity = 1.1 + 0.9 * k + flick * 0.35;
      flame.scale.y = 0.85 + Math.abs(flick) * 0.5;
      lamp.intensity = 0.12 + k * 1.6 + Math.max(0, flick) * 0.25 * (0.4 + k);
    },
  };
}

// ---------------------------------------------------------------------------
// registry + public API
// ---------------------------------------------------------------------------
const BUILDERS: Record<string, Builder> = {
  marbleStatue: (t) => marbleStatue(t),
  birdbath: (t) => birdbath(t),
  picnicTable: (t) => picnicTable(t),
  planterBox,
  topiarySpiral: (t) => topiarySpiral(t),
  topiaryElephant: (t) => topiaryElephant(t),
  signpost: (t) => signpost(t),
  tvMonitorPost: (t) => tvMonitorPost(t),
  parkClock: (t) => parkClock(t),
  flagpole: (t) => flagpole(t),
  ironArchway: (t) => ironArchway(t),
  brickWall: (t) => brickWall(t),
  picketFence: (t) => picketFence(t),
  lionStatue: (t) => lionStatue(t),
  cactusCluster: (t) => cactusCluster(t),
  fallenLog: (t) => fallenLog(t),
  mushroomCluster,
  wishingWell: (t) => wishingWell(t),
  gazebo: (t) => gazebo(t),
  hotAirBalloon: (t) => hotAirBalloon(t),
};

export const SCENERY_NAMES: string[] = Object.keys(BUILDERS);

export interface SceneryOpts {
  scale?: number;
  seed?: number;
}

/** build a scenery piece with its optional per-frame updater (flag wave, clock hands, TV static, balloon sway) */
export function buildSceneryAnimated(t: T, name: string, opts: SceneryOpts = {}): { group: THREE.Group; update?: (time: number) => void } {
  const builder = BUILDERS[name];
  if (!builder) throw new Error(`SceneryPack: unknown piece "${name}" — valid: ${SCENERY_NAMES.join(', ')}`);
  const built = builder(t, opts.seed ?? 0);
  if (opts.scale) built.group.scale.setScalar(opts.scale); // uniform scale keeps the y=0 ground contact
  return built;
}

/** static build — wraps buildSceneryAnimated and drops the updater */
export function buildScenery(t: T, name: string, opts: SceneryOpts = {}): THREE.Group {
  return buildSceneryAnimated(t, name, opts).group;
}

// ---------------------------------------------------------------------------
// preview: a 5×4 museum of all 20 pieces on a lawn — each on its own concrete
// pad (r 1.2, 3.0-unit grid spacing → 0.6 clearance between pads; widest piece
// is the gazebo eave at r 1.39, still inside its cell)
// ---------------------------------------------------------------------------
export function buildSceneryPackScene(three: typeof THREE): { group: THREE.Group; update?: (time: number) => void } {
  const group = new three.Group();
  const update =
    ((t: typeof THREE, g: THREE.Group) => {
      const updates: ((time: number) => void)[] = [];
      // curated grid: tall centrepieces (balloon, gazebo, arch, flagpole) inboard,
      // low pieces along the edges so nothing hides behind them
      const LAYOUT = [
        'picketFence', 'lionStatue', 'ironArchway', 'brickWall', 'topiarySpiral',
        'mushroomCluster', 'birdbath', 'flagpole', 'marbleStatue', 'cactusCluster',
        'fallenLog', 'wishingWell', 'hotAirBalloon', 'gazebo', 'parkClock',
        'signpost', 'planterBox', 'picnicTable', 'topiaryElephant', 'tvMonitorPost',
      ];
      LAYOUT.forEach((name, i) => {
        const col = i % 5;
        const row = Math.floor(i / 5);
        const x = (col - 2) * 3;
        const z = (row - 1.5) * 3;
        g.add(cyl(t, 1.2, 1.25, 0.06, 0xb6b0a2, [x, 0.03, z], { tex: 'concrete', repeat: [8, 1], rough: 0.95, seg: 24 })); // pad 0→0.06
        const { group: piece, update } = buildSceneryAnimated(t, name);
        piece.position.set(x, 0.06, z); // piece sits ON its pad top
        g.add(piece);
        if (update) updates.push(update);
      });
      return (time: number) => updates.forEach((u) => u(time));
    })(three, group) || undefined;
  return { group, update };
}

/** <SceneryPack> — composable (components/Park/Context.md): the 5x4 museum
 *  grid of all 20 pieces. For ONE piece in a park use <Scenery name> (Park)
 *  or buildScenery/buildSceneryAnimated. */
export const SceneryPack = composable('SceneryPack', (t) => buildSceneryPackScene(t));

// ---------------------------------------------------------------------------
// SceneryPack/piecesA.ts — pieces 1-11: marbleStatue -> ironArchway
//
// SPLIT out of index.tsx (2026-07). `write_design_system_files` replaces WHOLE
// files with no patch API, so a module has to fit in one tool call's output;
// at 94 KB the single file was past the point where that is safe. Three
// modules of ~2/44/44 KB each push independently. Behaviour-neutral: the
// builders are moved verbatim, only `export` is added.
// ---------------------------------------------------------------------------

import * as THREE from 'three';
import { box, cyl, ball, mat, mergedBoxes, mergedParts, mtx, nightKOf, hash01, rod, STONE, MARBLE, IRON, WOOD_DARK, WOOD, LEAF } from './shared';
import type { T, Built, MergedBoxSpec } from './shared';

// ---------------------------------------------------------------------------
// 1. marbleStatue — abstract figure on a two-step plinth
// ---------------------------------------------------------------------------
export function marbleStatue(t: T): Built {
  const g = new t.Group();
  // steps: 0→0.24, 0.24→0.54 — each sits flush on the previous
  g.add(box(t, [0.95, 0.24, 0.95], STONE, [0, 0.12, 0], { tex: 'concrete', repeat: [3, 1], rough: 0.9, bump: 0.03 }));
  g.add(box(t, [0.66, 0.3, 0.66], MARBLE, [0, 0.39, 0], { tex: 'concrete', repeat: [2, 1], rough: 0.55 }));
  // DETAIL: a classical plinth is never a bare cube — a base moulding and an
  // overhanging CORNICE give it the two shadow lines that read as carved stone,
  // and a sunken inscription tablet on the front face gives it a subject.
  g.add(box(t, [0.74, 0.05, 0.74], MARBLE, [0, 0.265, 0], { tex: 'concrete', rough: 0.6 })); // base moulding
  g.add(box(t, [0.76, 0.05, 0.76], MARBLE, [0, 0.525, 0], { tex: 'concrete', rough: 0.6 })); // cornice, overhangs 0.05
  g.add(box(t, [0.4, 0.16, 0.02], 0xc4bfb2, [0, 0.4, 0.335], { tex: 'concrete', rough: 0.7 })); // inscription tablet
  // figure: legs 0.54→1.04, torso bottom 1.03 (embeds 0.01), head on shoulders
  g.add(cyl(t, 0.1, 0.13, 0.5, MARBLE, [0, 0.79, 0], { tex: 'concrete', rough: 0.5, seg: 14 }));
  g.add(cyl(t, 0.15, 0.11, 0.48, MARBLE, [0, 1.27, 0], { tex: 'concrete', rough: 0.5, seg: 14 })); // torso 1.03→1.51
  // DRAPERY: three folds down the torso, each rooted inside its surface — the
  // difference between a marble figure and a stack of primitives
  [
    [0.5, 0.13],
    [2.2, 0.12],
    [4.0, 0.125],
  ].forEach(([a, r]) =>
    g.add(
      box(t, [0.05, 0.44, 0.04], 0xcdc8bc, [Math.cos(a) * r, 1.26, Math.sin(a) * r], { rough: 0.55, rotY: -a, rotZ: 0.06 }),
    ),
  );
  g.add(cyl(t, 0.17, 0.16, 0.05, MARBLE, [0, 1.5, 0], { tex: 'concrete', rough: 0.5, seg: 14 })); // shoulder yoke
  g.add(ball(t, 0.13, MARBLE, [0, 1.6, 0], { rough: 0.5 })); // head bottom 1.47 < torso top 1.51 — seated
  // a LAUREL WREATH on the brow: one small torus, and the head stops being a ball
  const wreath = new t.Mesh(new t.TorusGeometry(0.125, 0.018, 6, 16), mat(t, 0xbfb79f, { rough: 0.7 }));
  wreath.rotation.x = Math.PI / 2;
  wreath.position.set(0, 1.635, 0);
  wreath.castShadow = true;
  g.add(wreath);
  // arms: one raised, one down — shoulder ends embed in the torso (torso r≈0.15 at top)
  g.add(box(t, [0.07, 0.42, 0.07], MARBLE, [0.19, 1.55, 0], { rough: 0.5, rotZ: -0.5 }));
  // The LOWERED arm leaned the wrong way. `rotZ: θ` sends local +Y to
  // (−sin θ, cos θ), so +0.35 on an arm at x −0.17 put its SHOULDER end at
  // x −0.232 (outboard of a torso only 0.13 wide there) and its wrist end at
  // −0.108, i.e. the arm splayed away from the body and the hand at −0.25 hung
  // 0.14 clear of it — a marble ball floating beside the statue.
  g.add(box(t, [0.07, 0.36, 0.07], MARBLE, [-0.17, 1.32, 0], { rough: 0.5, rotZ: -0.35 }));
  g.add(ball(t, 0.045, MARBLE, [0.29, 1.7, 0], { rough: 0.5 })); // the HAND holding the orb
  g.add(ball(t, 0.04, MARBLE, [-0.25, 1.15, 0], { rough: 0.5 })); // …and the lowered one
  g.add(ball(t, 0.055, 0xd8b54a, [0.31, 1.74, 0], { metal: 0.7, rough: 0.3 })); // gold orb in raised hand
  return { group: g };
}

// ---------------------------------------------------------------------------
// 2. birdbath — fluted column, shallow bowl, still water disc
// ---------------------------------------------------------------------------
export function birdbath(t: T): Built {
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
  // DETAIL. The column was a smooth taper called "fluted" in a comment; it is
  // fluted now — eight ribs rooted in its surface — with a moulded collar under
  // the bowl and a base torus, which is the whole vocabulary of a stone
  // pedestal. Then the two things that make a birdbath a birdbath: RIPPLES on
  // the water and a BIRD on the rim.
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    g.add(box(t, [0.028, 0.54, 0.028], 0xc4bca6, [Math.cos(a) * 0.105, 0.42, Math.sin(a) * 0.105], { rough: 0.85, rotY: -a }));
  }
  g.add(cyl(t, 0.17, 0.14, 0.05, STONE, [0, 0.705, 0], { tex: 'concrete', rough: 0.9, seg: 16 })); // collar under the bowl
  const foot = new t.Mesh(new t.TorusGeometry(0.29, 0.045, 6, 18), mat(t, STONE, { tex: 'concrete', rough: 0.92 }));
  foot.rotation.x = Math.PI / 2;
  foot.position.y = 0.12;
  foot.castShadow = true;
  g.add(foot);
  [0.2, 0.31].forEach((r, i) => {
    const rip = new t.Mesh(new t.TorusGeometry(r, 0.008, 5, 20), mat(t, 0x8fc4e0, { emissive: 0x2a6fb0, rough: 0.2 }));
    rip.rotation.x = Math.PI / 2;
    rip.position.y = 0.902 + i * 0.001;
    g.add(rip);
  });
  // a sparrow on the lip: body, head, beak, tail — all rooted in each other
  const bx = Math.cos(-0.7) * 0.4;
  const bz = Math.sin(-0.7) * 0.4;
  const bird = ball(t, 0.07, 0x6a5a48, [bx, 0.975, bz], { rough: 0.85 });
  bird.scale.set(1, 0.9, 1.35);
  g.add(bird);
  g.add(ball(t, 0.045, 0x7a6a54, [bx - 0.02, 1.03, bz - 0.055], { rough: 0.85 })); // head
  g.add(cyl(t, 0.0, 0.014, 0.045, 0xd8a03a, [bx - 0.03, 1.025, bz - 0.095], { rough: 0.6, seg: 6, rotX: -1.4 })); // beak
  g.add(box(t, [0.035, 0.014, 0.09], 0x5a4c3c, [bx + 0.01, 0.965, bz + 0.1], { rough: 0.85, rotX: -0.25 })); // tail
  return { group: g };
}

// ---------------------------------------------------------------------------
// 3. picnicTable — wooden table + benches, striped parasol
// ---------------------------------------------------------------------------
export function picnicTable(t: T): Built {
  const g = new t.Group();
  // leg panels 0→0.67 carry the top (bottom 0.67); seat beams top 0.45 carry seats
  [-0.55, 0.55].forEach((x) => {
    g.add(box(t, [0.06, 0.67, 0.6], WOOD_DARK, [x, 0.335, 0], { tex: 'wood', repeat: [1, 2], rough: 0.9 }));
    g.add(box(t, [0.06, 0.06, 1.5], WOOD_DARK, [x, 0.42, 0], { tex: 'wood', repeat: [1, 4], rough: 0.9 })); // beam through the panel
  });
  // TOP as four PLANKS with shadow gaps between them, not one slab — a picnic
  // table is boards, and the gaps are the whole read from above (which is the
  // angle the park camera looks from)
  [-0.3, -0.1, 0.1, 0.3].forEach((z) =>
    g.add(box(t, [1.4, 0.06, 0.185], WOOD, [0, 0.7, z], { tex: 'wood', repeat: [5, 1], rough: 0.85, bump: 0.03 })),
  );
  [-0.6, 0.6].forEach((z) => g.add(box(t, [1.4, 0.05, 0.26], WOOD, [0, 0.475, z], { tex: 'wood', repeat: [5, 1], rough: 0.85 }))); // seats rest on beams (0.45)
  // cross-brace under the top + bolt heads at the leg joints
  g.add(box(t, [1.16, 0.05, 0.05], WOOD_DARK, [0, 0.64, 0], { tex: 'wood', repeat: [4, 1], rough: 0.9 }));
  [-0.55, 0.55].forEach((x) =>
    [-0.6, 0.6].forEach((z) => g.add(ball(t, 0.022, 0x6a6a66, [x, 0.42, z], { tex: 'metal', metal: 0.6, rough: 0.4 }))),
  );
  // parasol: pole 0→2.2 through the table; canopy cone straddles the pole top
  g.add(cyl(t, 0.03, 0.035, 2.2, 0xdfd8c8, [0, 1.1, 0], { tex: 'metal', rough: 0.5, metal: 0.3, seg: 10 }));
  g.add(cyl(t, 0.02, 1.0, 0.45, 0xc23636, [0, 2.0, 0], { tex: 'fabric', repeat: [8, 2], rough: 0.75, seg: 12, flat: true })); // canopy 1.775→2.225
  // PARASOL RIBS pressing the fabric into panels, and a scalloped VALANCE round
  // the hem — a plain cone reads as a traffic cone, not a parasol.
  //
  // THE RIBS USED TO TILT ABOUT THE WORLD X AXIS. They were boxes carrying both
  // `rotY: -a + π/2` and `rotX: 0.42`, and three.js composes Euler 'XYZ' as
  // Rx·Ry — so the 0.42 downslope was applied AFTER the azimuth, about world X,
  // not about each rib's own tangent. Local +Z came out at
  // (cos a, −sin a·sin 0.42, sin a·cos 0.42): correct only at a = ±π/2. The two
  // ribs at a = 0 and a = π stuck straight out HORIZONTALLY past the hem, and
  // every rib in a ∈ (π, 2π) tilted UP off the canopy into open air.
  //
  // A rib is defined by the two points it joins, so it is built from them now.
  // The count also moved 8 → 12 to match the canopy cone's OWN segment count:
  // `CylinderGeometry(_, _, _, 12)` is a 12-gon whose flat faces dip 3.4% inside
  // the nominal radius, so 8 ribs on a 12-gon had four of them sunk into a facet
  // and the rest riding a fold. Twelve sit one per fold. Both batches merge, so
  // 16 loose boxes became 2 draws — picnicTable is scattered as park dressing.
  const CAN_TOP_Y = 2.225; // canopy cone: r 0.02 at 2.225 → r 1.0 at 1.775
  const CAN_BOT_Y = 1.775;
  const CAN_R = 1.0;
  const canopyY = (r: number) => CAN_TOP_Y - ((r - 0.02) / (CAN_R - 0.02)) * (CAN_TOP_Y - CAN_BOT_Y);
  const RIB_PROUD = 0.012; // rides just above the fabric, so it reads from above
  // CylinderGeometry lays its first vertex at +z and steps by 2π/seg with
  // (r·sin θ, r·cos θ), so fold k is at compass angle a = π/2 − θ.
  const foldA = (k: number) => Math.PI / 2 - (k / 12) * Math.PI * 2;
  const ribGeo = new t.BoxGeometry(0.028, 0.022, 1); // unit length along +Z, scaled per rib
  const ribParts: { geo: THREE.BufferGeometry; matrix: THREE.Matrix4 }[] = [];
  const valance: MergedBoxSpec[] = [];
  for (let k = 0; k < 12; k++) {
    const a = foldA(k);
    const rIn = 0.07;
    const rOut = 1.005; // a whisker past the hem, so the rib tip shows
    const from = new t.Vector3(Math.cos(a) * rIn, canopyY(rIn) + RIB_PROUD, Math.sin(a) * rIn);
    const to = new t.Vector3(Math.cos(a) * rOut, canopyY(rOut) + RIB_PROUD, Math.sin(a) * rOut);
    const dir = to.clone().sub(from);
    const len = dir.length();
    ribParts.push({
      geo: ribGeo,
      matrix: new t.Matrix4().compose(
        from.clone().addScaledVector(dir.clone().normalize(), len / 2),
        new t.Quaternion().setFromUnitVectors(new t.Vector3(0, 0, 1), dir.clone().normalize()),
        new t.Vector3(1, 1, len),
      ),
    });
    // VALANCE: one scallop per BAY (offset half a fold), chorded to span the
    // whole bay so the hem is continuous. The old 8 chords of 0.40 at r 0.95
    // covered 54% of the circumference — detached flaps, not a valance.
    const va = a - Math.PI / 12;
    const rV = 1.01; // AT the hem (fold radius 1.0), not inside it — at 0.97 the
    const half = Math.PI / 12; // fringe hid behind the canopy's own silhouette
    valance.push({
      dims: [2 * rV * Math.sin(half), 0.11, 0.025],
      pos: [Math.cos(va) * rV * Math.cos(half), canopyY(1.0) - 0.05, Math.sin(va) * rV * Math.cos(half)],
      rotY: -va + Math.PI / 2, // tangential: local +X → world (sin va, 0, −cos va)
      repeat: [2, 1],
    });
  }
  g.add(mergedParts(t, ribParts, mat(t, 0xe8e2d2, { rough: 0.7 }), false));
  ribGeo.dispose();
  g.add(mergedBoxes(t, valance, 0xa82c2c, { tex: 'fabric', rough: 0.8 }));
  g.add(cyl(t, 0.05, 0.05, 0.05, 0xdfd8c8, [0, 1.79, 0], { tex: 'metal', metal: 0.4, rough: 0.5, seg: 10 })); // the runner collar
  g.add(ball(t, 0.05, 0xd8b54a, [0, 2.25, 0], { metal: 0.6, rough: 0.35 })); // finial bottom 2.2 = pole top
  return { group: g };
}

// ---------------------------------------------------------------------------
// 4. planterBox — a masonry trough of PLANTS
// ---------------------------------------------------------------------------
// REBUILT (2026-07) after the park render: the piece read as a black-and-white
// CHESSBOARD with coloured lollipops floating over it, and both halves of that
// were literal.
//
//   * The walls were 64 loose 0.15 cubes in 0x3a3a3e / 0xd8d4cc — near-black
//     against near-white, over 100 % of every face. At park-camera distance the
//     checker is the loudest thing in the frame and nothing about it says
//     "planter". It is now built MASONRY: solid walls with corner pilasters and
//     an overhanging coping, and the RCT2 checkerboard survives as ONE inset
//     band of tiles at belt height in two MUTED limestone tones. Same
//     reference, ornament instead of livery.
//   * A "flower" was a 0.006-radius stem — under a pixel at park scale, so
//     invisible — carrying a bare 0.05 ball, 16 of them on a rigid 0.22 grid at
//     one height. That is why they read as floating sweets. A plant is now a
//     visible stem, a FOLIAGE mound of flattened leaves in two greens, and two
//     blossoms sitting ON that foliage, with hashed height, scale and jitter,
//     and a fifth of the slots left empty so the bed is not a lattice. Two
//     trailing sprays spill over the rim.
//
// STILL BATCHED, and to the same budget: 10 merged meshes (stone / soil / two
// tile tones / stems / two foliage greens / three blossom tones) against the 9
// the checker version used. It is the most-placed dressing in the system (every
// FountainPlaza closed side, every <Scenery name="planterBox">), so the merge
// discipline is not optional.
export function planterBox(t: T, seed: number): Built {
  const g = new t.Group();
  const h = (n: number) => hash01(n + seed * 17.13);
  type BoxSpec = { dims: [number, number, number]; pos: [number, number, number]; repeat?: [number, number] };
  type Part = { geo: THREE.BufferGeometry; matrix: THREE.Matrix4 };

  // ---- the trough ---------------------------------------------------------
  // slab 0→0.06 · walls 0.06→0.30 · coping 0.30→0.34 · pilasters 0.06→0.36
  // with their own caps to 0.40. Outer face stays at ±0.60 (the old checker's
  // outer face) so every footprint that was planned around this piece is
  // unchanged, and the slab is the same 1.34.
  const WALL_T = 0.14;
  const OUT = 0.53; // wall centreline: outer face 0.53 + 0.07 = 0.60
  const stone: BoxSpec[] = [
    { dims: [1.34, 0.06, 1.34], pos: [0, 0.03, 0], repeat: [5, 5] }, // slab
  ];
  [-1, 1].forEach((s) => {
    stone.push({ dims: [1.06, 0.24, WALL_T], pos: [0, 0.18, s * OUT], repeat: [4, 1] });
    stone.push({ dims: [WALL_T, 0.24, 1.06], pos: [s * OUT, 0.18, 0], repeat: [1, 4] });
    // coping: overhangs the wall 0.03 each side, which is what throws the
    // shadow line that makes a trough read as built rather than printed
    stone.push({ dims: [1.06, 0.04, WALL_T + 0.06], pos: [0, 0.32, s * OUT], repeat: [4, 1] });
    stone.push({ dims: [WALL_T + 0.06, 0.04, 1.06], pos: [s * OUT, 0.32, 0], repeat: [1, 4] });
  });
  [-1, 1].forEach((sx) =>
    [-1, 1].forEach((sz) => {
      stone.push({ dims: [0.18, 0.3, 0.18], pos: [sx * OUT, 0.21, sz * OUT], repeat: [1, 2] }); // corner pilaster
      stone.push({ dims: [0.22, 0.04, 0.22], pos: [sx * OUT, 0.38, sz * OUT] }); // …and its cap
    }),
  );
  g.add(mergedBoxes(t, stone, STONE, { tex: 'concrete', rough: 0.9, bump: 0.03 }));

  // ---- the inset tile band — the checkerboard, at ornament scale ----------
  const TILE_A = 0x8a8478; // warm grey
  const TILE_B = 0xcfc7b6; // pale limestone
  const tilesA: BoxSpec[] = [];
  const tilesB: BoxSpec[] = [];
  for (let i = 0; i < 7; i++) {
    const p = -0.45 + i * 0.15;
    // proud of the wall face by 0.015, so the band catches its own shadow
    [-1, 1].forEach((s) => {
      (i % 2 ? tilesA : tilesB).push({ dims: [0.14, 0.12, 0.03], pos: [p, 0.18, s * 0.605] });
      (i % 2 ? tilesB : tilesA).push({ dims: [0.03, 0.12, 0.14], pos: [s * 0.605, 0.18, p] });
    });
  }
  g.add(mergedBoxes(t, tilesA, TILE_A, { tex: 'concrete', rough: 0.8 }));
  g.add(mergedBoxes(t, tilesB, TILE_B, { tex: 'concrete', rough: 0.8 }));

  // ---- soil, MOUNDED (a filled bed is not a flat tray) -------------------
  g.add(
    mergedBoxes(
      t,
      [
        { dims: [0.92, 0.08, 0.92], pos: [0, 0.27, 0], repeat: [4, 4] }, // 0.23→0.31, inside the walls
        { dims: [0.74, 0.05, 0.74], pos: [0, 0.335, 0], repeat: [3, 3] }, // mound 0.31→0.36
      ] as BoxSpec[],
      0x3a2c1e,
      { tex: 'asphalt', rough: 1, bump: 0.06 },
    ),
  );

  // ---- the planting ------------------------------------------------------
  const SOIL = 0.36; // mound top: every plant roots here
  const BLOOMS = [0xe23a3a, 0xf0d000, 0xe060a0];
  const stemGeo = new t.CylinderGeometry(0.014, 0.018, 1, 6); // unit height, scaled per plant
  const leafGeo = new t.IcosahedronGeometry(1, 1); // unit radius, scaled per plant
  const bloomGeo = new t.IcosahedronGeometry(0.038, 0);
  const stems: Part[] = [];
  const leafLight: Part[] = [];
  const leafDark: Part[] = [];
  const blooms: Part[][] = [[], [], []];
  for (let ix = 0; ix < 4; ix++)
    for (let iz = 0; iz < 4; iz++) {
      const k = ix * 4 + iz;
      if (h(k * 3.7 + 91) < 0.2) continue; // a fifth left bare — a bed, not a lattice
      const x = -0.33 + ix * 0.22 + (h(ix * 7 + iz * 3) - 0.5) * 0.07;
      const z = -0.33 + iz * 0.22 + (h(ix * 5 + iz * 11 + 4) - 0.5) * 0.07;
      const ht = 0.08 + h(k * 2.3 + 17) * 0.06; // stem 0.08–0.14
      const r = 0.05 + h(k * 5.1 + 29) * 0.022; // foliage 0.050–0.072
      stems.push({ geo: stemGeo, matrix: mtx(t, [x, SOIL + ht / 2, z], [0, 0, 0], [1, ht, 1]) });
      // TWO leaf lobes, offset and flattened — the mound the blossoms sit on,
      // and the reason nothing floats any more
      const lean = h(k * 1.9 + 43) * Math.PI * 2;
      leafDark.push({ geo: leafGeo, matrix: mtx(t, [x, SOIL + ht, z], [0, lean, 0], [r, r * 0.6, r]) });
      leafLight.push({
        geo: leafGeo,
        matrix: mtx(
          t,
          [x + Math.cos(lean) * r * 0.5, SOIL + ht + r * 0.28, z + Math.sin(lean) * r * 0.5],
          [0, lean + 1.2, 0],
          [r * 0.78, r * 0.5, r * 0.78],
        ),
      });
      // blossoms ON the foliage crown, never hovering over it
      const tone = k % 3;
      blooms[tone].push({ geo: bloomGeo, matrix: mtx(t, [x, SOIL + ht + r * 0.55, z]) });
      blooms[(tone + 1) % 3].push({
        geo: bloomGeo,
        matrix: mtx(t, [x + Math.cos(lean + 2.1) * r * 0.45, SOIL + ht + r * 0.42, z + Math.sin(lean + 2.1) * r * 0.45]),
      });
    }
  // TWO TRAILING SPRAYS spilling over the coping — the detail that stops a
  // planter looking like a box with things stuck in it. Each is a three-lobe
  // cascade: a lobe sitting ON the coping (top 0.34) so it is clearly rooted in
  // the bed, then two smaller ones stepping DOWN the outside face. Placed as
  // isolated blobs floating beside the rim (the first attempt) they read as
  // litter, which is worse than no spill at all.
  const spill = (along: number, side: 1 | -1, axis: 'x' | 'z') => {
    const at = (a: number, out: number, y: number): [number, number, number] =>
      axis === 'z' ? [a, y, side * out] : [side * out, y, a];
    const rot = axis === 'z' ? 0 : Math.PI / 2;
    leafDark.push({ geo: leafGeo, matrix: mtx(t, at(along, OUT + 0.02, 0.335), [0, rot, 0], [0.13, 0.045, 0.1]) }); // on the coping
    leafLight.push({ geo: leafGeo, matrix: mtx(t, at(along + 0.05, OUT + 0.08, 0.27), [0, rot + 0.5, 0], [0.085, 0.06, 0.06]) });
    leafDark.push({ geo: leafGeo, matrix: mtx(t, at(along - 0.03, OUT + 0.07, 0.17), [0, rot - 0.4, 0], [0.06, 0.055, 0.05]) });
  };
  spill(0.3, 1, 'z');
  spill(-0.22, -1, 'x');
  g.add(mergedParts(t, stems, mat(t, 0x2f5a2c, { rough: 0.9 }), false));
  g.add(mergedParts(t, leafDark, mat(t, 0x2f5f2a, { flat: true, rough: 0.9 }), false));
  g.add(mergedParts(t, leafLight, mat(t, 0x4a8a3a, { flat: true, rough: 0.9 }), false));
  blooms.forEach((batch, i) => {
    if (batch.length) g.add(mergedParts(t, batch, mat(t, BLOOMS[i], { flat: true, rough: 0.65 }), false));
  });
  stemGeo.dispose();
  leafGeo.dispose();
  bloomGeo.dispose();
  return { group: g };
}

// ---------------------------------------------------------------------------
// 5. topiarySpiral — clipped spiral cone climbing a trunk
// ---------------------------------------------------------------------------
export function topiarySpiral(t: T): Built {
  const g = new t.Group();
  // A CLIPPED SPECIMEN STANDS IN A POT. It used to grow straight out of the
  // lawn, which reads as a shrub someone forgot rather than the trained piece it
  // is: terracotta pot, rolled rim, dark soil and a mulch collar. The pot is
  // deliberately LOW (0→0.20) and the whole plant lifts by exactly its soil
  // level, so the piece grows 0.22 taller and its XZ footprint is unchanged
  // (pot rim r 0.33 against the old fattest ball's 0.34).
  const SOIL = 0.22; // pot soil top — the plant's new ground
  g.add(cyl(t, 0.29, 0.23, 0.2, 0xa8613c, [0, 0.1, 0], { tex: 'concrete', repeat: [6, 1], rough: 0.9, seg: 18 })); // pot 0→0.20
  g.add(cyl(t, 0.33, 0.33, 0.055, 0xb86e44, [0, 0.2, 0], { tex: 'concrete', repeat: [7, 1], rough: 0.88, seg: 18 })); // rolled rim 0.17→0.23
  g.add(cyl(t, 0.26, 0.26, 0.04, 0x3a2c1e, [0, SOIL - 0.02, 0], { tex: 'asphalt', repeat: [3, 3], rough: 1, seg: 16 })); // soil, just under the rim
  g.add(cyl(t, 0.36, 0.36, 0.02, 0x6a5a44, [0, 0.01, 0], { tex: 'sand', repeat: [4, 4], rough: 1, seg: 18 })); // mulch collar on the grass
  g.add(cyl(t, 0.06, 0.09, 1.65, WOOD_DARK, [0, SOIL + 0.82, 0], { tex: 'wood', repeat: [1, 4], rough: 1, seg: 10 })); // trunk SOIL→SOIL+1.65
  // BATCHED. The set-piece plans use `topiarySpiral` as a "planter" species and
  // <Boulevard> plants it down avenues, so it is placed many times per park and
  // every loose primitive is paid per instance (see cactusCluster for the
  // measurement that forced this). Three merged batches — dark tier, light tier,
  // clipped highlight — instead of 21 spheres. 26 meshes → 9.
  type P = { geo: THREE.BufferGeometry; matrix: THREE.Matrix4 };
  const tierA: P[] = []; // LEAF
  const tierB: P[] = []; // darker alternate
  const rims: P[] = [];
  const sph = new t.IcosahedronGeometry(1, 2); // unit ball, scaled per tier
  const N = 10;
  for (let i = 0; i < N; i++) {
    const f = i / (N - 1);
    const r = 0.34 - f * 0.24; // 0.34 → 0.10
    const a = i * 1.9;
    const off = 0.2 * (1 - f * 0.85);
    // y starts at SOIL + 0.34 so the fattest ball rests exactly on the SOIL
    const y = SOIL + 0.34 + i * 0.145;
    const at: [number, number, number] = [Math.cos(a) * off, y, Math.sin(a) * off];
    (i % 2 ? tierB : tierA).push({ geo: sph, matrix: mtx(t, at, [0, a, 0], [r, r, r]) });
    // CLIPPED-EDGE HIGHLIGHT: a thin bright disc on the upper face of each turn.
    // A stack of spheres has no visible spiral from above; the light rim on each
    // tier is what makes the helix read as a helix.
    rims.push({ geo: sph, matrix: mtx(t, [at[0], y + r * 0.55, at[2]], [0, a, 0], [r * 0.82, r * 0.18, r * 0.82]) });
  }
  tierA.push({ geo: sph, matrix: mtx(t, [0, SOIL + 1.72, 0], [0, 0, 0], [0.09, 0.09, 0.09]) }); // tip caps the trunk
  const LF = { tex: 'leaf' as const, repeat: [3, 3] as [number, number], flat: true, rough: 1, bump: 0.04 };
  g.add(mergedParts(t, tierA, mat(t, LEAF, LF), false));
  g.add(mergedParts(t, tierB, mat(t, 0x35622a, LF), false));
  g.add(mergedParts(t, rims, mat(t, 0x6aa04a, { tex: 'leaf', repeat: [2, 2], flat: true, rough: 1 }), false));
  sph.dispose();
  return { group: g };
}

// ---------------------------------------------------------------------------
// 6. topiaryElephant — clipped-leaf elephant on a grass pad
// ---------------------------------------------------------------------------
export function topiaryElephant(t: T): Built {
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
  // TAIL — its root has to be INSIDE the body, and at [-0.46, 0.85] it was not.
  // The body is ball(0.42) scaled (1.15, 0.85, 0.8), i.e. semi-axes 0.483 x /
  // 0.357 y, and that root evaluates to (0.46/0.483)² + (0.13/0.357)² = 1.04 —
  // just outside, so the tail and its tuft hung 0.018 clear of the elephant.
  // Root pulled in to 0.86 of the way out, which leaves the visible length alone.
  g.add(rod(t, [-0.4, 0.87, 0], [-0.58, 0.62, 0], 0.025, LEAF, L)); // tail off the body rear
  // DETAIL — the four things that turn a green blob into an ELEPHANT, all rooted
  // in the head ball (r 0.26 at [0.48, 0.95, 0]):
  [0.11, -0.11].forEach((z) => {
    g.add(cyl(t, 0.0, 0.035, 0.22, 0xe4dcc4, [0.66, 0.86, z], { rough: 0.7, seg: 7, rotZ: -1.15, rotY: z > 0 ? 0.25 : -0.25 })); // TUSK
    g.add(ball(t, 0.028, 0x1f2a18, [0.63, 1.03, z * 1.5], { rough: 0.5 })); // EYE, set into the head
  });
  g.add(ball(t, 0.05, 0x2a4a1f, [-0.58, 0.62, 0], { ...L, flat: true })); // tail TUFT on the tail tip
  // toenails: three per forefoot, bedded in the leg bottoms
  [
    [0.24, 0.15],
    [0.24, -0.15],
  ].forEach(([x, z]) =>
    [-1, 0, 1].forEach((k) => g.add(ball(t, 0.022, 0xd8d0bc, [(x as number) + 0.07, 0.17, (z as number) + k * 0.045], { rough: 0.75 }))),
  );
  // a clipped SADDLE BLANKET across the back — RCT2's topiary elephant is a
  // fairground animal, and the darker patch also breaks up a large single-tone ball
  const saddle = ball(t, 0.3, 0x2a4a1f, [-0.04, 0.98, 0], { ...L, flat: true });
  saddle.scale.set(1.0, 0.34, 0.78);
  g.add(saddle);
  // mulch ring under the pad, so the pad has an edge instead of floating on grass
  g.add(cyl(t, 0.84, 0.88, 0.03, 0x6a5a44, [0, 0.015, 0], { tex: 'sand', repeat: [6, 1], rough: 1, seg: 22 }));
  return { group: g };
}

// ---------------------------------------------------------------------------
// 7. signpost — wooden post with a blank routed board
// ---------------------------------------------------------------------------
export function signpost(t: T): Built {
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
  // DETAIL: a signpost with ONE blank board is a notice board. RCT2's points the
  // way, so it gets two DIRECTIONAL ARMS below the main board — pointed
  // fingerboards on opposite faces at different heights, each with a routed edge
  // and an arrow tip — plus a text bar on the main board and a ground mound.
  [
    [0.72, 1, -0.35],
    [0.5, -1, 0.4],
  ].forEach(([y, dir, yaw]) => {
    const d = dir as number;
    const yy = y as number;
    const a = yaw as number;
    const ax = Math.cos(a);
    const az = -Math.sin(a);
    const mid = 0.3 * d;
    g.add(box(t, [0.56, 0.15, 0.04], 0xc9a25a, [ax * mid, yy, az * mid], { tex: 'wood', repeat: [3, 1], rough: 0.85, rotY: a }));
    g.add(box(t, [0.56, 0.025, 0.05], WOOD_DARK, [ax * mid, yy + 0.062, az * mid], { rough: 0.9, rotY: a })); // routed top edge
    g.add(box(t, [0.56, 0.025, 0.05], WOOD_DARK, [ax * mid, yy - 0.062, az * mid], { rough: 0.9, rotY: a })); // …and bottom
    // the ARROW: a rotated square cone off the far end of the board
    g.add(cyl(t, 0.0, 0.088, 0.14, 0xc9a25a, [ax * mid * 1.93, yy, az * mid * 1.93], { rough: 0.85, seg: 4, rotZ: -Math.PI / 2 * d, rotY: a }));
    g.add(box(t, [0.34, 0.045, 0.01], 0x5a4632, [ax * mid, yy, az * mid + 0.026 * (a > 0 ? 1 : -1)], { rough: 0.8, rotY: a })); // lettering bar
  });
  [1.22, 1.06].forEach((y) => g.add(box(t, [0.62, 0.05, 0.01], 0x5a4632, [0, y, 0.086], { rough: 0.8 }))); // lettering on the main board
  g.add(cyl(t, 0.18, 0.22, 0.06, 0x6a5a44, [0, 0.03, 0], { tex: 'sand', repeat: [3, 1], rough: 1, seg: 12 })); // earth mound at the foot
  return { group: g };
}

// ---------------------------------------------------------------------------
// 8. tvMonitorPost — queue-line CRT on a post; screen static shimmers (animated)
// ---------------------------------------------------------------------------
export function tvMonitorPost(t: T): Built {
  const g = new t.Group();
  g.add(cyl(t, 0.16, 0.2, 0.1, IRON, [0, 0.05, 0], { tex: 'metal', metal: 0.5, rough: 0.55, seg: 14 })); // base 0→0.1
  g.add(box(t, [0.08, 1.4, 0.08], IRON, [0, 0.8, 0], { tex: 'metal', metal: 0.55, rough: 0.5 })); // post 0.1→1.5
  g.add(box(t, [0.62, 0.46, 0.4], 0x3a3d42, [0, 1.73, 0], { tex: 'plastic', repeat: [3, 2], rough: 0.6 })); // CRT bottom 1.5 = post top
  const screen = new t.MeshStandardMaterial({ color: 0x0d1f2e, emissive: 0x9fd4e8, emissiveIntensity: 0.55, roughness: 0.25 });
  const sc = new t.Mesh(new t.BoxGeometry(0.5, 0.34, 0.02), screen);
  sc.position.set(0, 1.73, 0.21); // proud of the CRT front face (0.2)
  g.add(sc);
  g.add(box(t, [0.56, 0.05, 0.44], 0x3a3d42, [0, 1.985, 0], { tex: 'plastic', rough: 0.6 })); // visor cap on the CRT top (1.96)
  // DETAIL: a BEZEL round the screen (a CRT is a tube in a case, not a lit
  // rectangle), a ventilation grille up each flank, a speaker bar under the
  // glass, the CABLE that feeds it clipped down the post, and base bolts.
  [
    [0.56, 0.03, 0.185, 0],
    [0.56, 0.03, -0.185, 0],
    [0.03, 0.4, 0, 0.26],
    [0.03, 0.4, 0, -0.26],
  ].forEach(([w, h, dy, dx]) =>
    g.add(box(t, [w as number, h as number, 0.03], 0x22252a, [dx as number, 1.73 + (dy as number), 0.205], { rough: 0.55 })),
  );
  [-1, 1].forEach((s) =>
    [-0.06, 0, 0.06].forEach((dy) => g.add(box(t, [0.02, 0.02, 0.26], 0x22252a, [s * 0.315, 1.73 + dy, 0], { rough: 0.6 }))),
  );
  g.add(box(t, [0.34, 0.05, 0.02], 0x22252a, [0, 1.56, 0.205], { rough: 0.6 })); // speaker bar
  g.add(box(t, [0.02, 1.3, 0.02], 0x1a1c20, [0.052, 0.8, -0.052], { rough: 0.8 })); // feed cable down the post
  [0.35, 0.85, 1.35].forEach((y) => g.add(box(t, [0.05, 0.02, 0.05], IRON, [0.04, y, -0.04], { tex: 'metal', metal: 0.5, rough: 0.5 }))); // cable clips
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    g.add(ball(t, 0.018, 0x6a6d72, [Math.cos(a) * 0.13, 0.1, Math.sin(a) * 0.13], { tex: 'metal', metal: 0.6, rough: 0.4 })); // base bolts
  }
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
export function parkClock(t: T): Built {
  const g = new t.Group();
  g.add(cyl(t, 0.18, 0.25, 0.14, IRON, [0, 0.07, 0], { tex: 'metal', metal: 0.5, rough: 0.5, seg: 14 })); // base 0→0.14
  g.add(cyl(t, 0.045, 0.06, 1.9, 0x1f4d33, [0, 1.09, 0], { tex: 'metal', metal: 0.4, rough: 0.5, seg: 12 })); // pole 0.14→2.04
  // drum (axis along z) centre 2.3, r 0.34 — bottom 1.96 overlaps the pole top 2.04
  g.add(cyl(t, 0.34, 0.34, 0.14, 0x1f4d33, [0, 2.3, 0], { tex: 'metal', metal: 0.4, rough: 0.5, seg: 24, rotX: Math.PI / 2 }));
  g.add(ball(t, 0.06, 0xd8b54a, [0, 2.68, 0], { metal: 0.7, rough: 0.3 })); // finial bottom 2.62 < drum top 2.64
  // DETAIL: the mouldings a cast-iron street clock is made of — a collar where
  // the pole leaves its base, a swelled band at mid-height, an ogee where the
  // pole meets the drum, and four SCROLL BRACKETS carrying the drum.
  g.add(cyl(t, 0.09, 0.075, 0.07, 0x1f4d33, [0, 0.175, 0], { tex: 'metal', metal: 0.45, rough: 0.5, seg: 12 }));
  g.add(cyl(t, 0.07, 0.07, 0.09, 0x2a6344, [0, 1.1, 0], { tex: 'metal', metal: 0.45, rough: 0.5, seg: 12 })); // swelled band
  g.add(cyl(t, 0.14, 0.07, 0.1, 0x1f4d33, [0, 2.02, 0], { tex: 'metal', metal: 0.45, rough: 0.5, seg: 14 })); // ogee under the drum
  [-1, 1].forEach((sx) =>
    [-1, 1].forEach((sz) =>
      g.add(box(t, [0.03, 0.2, 0.03], 0x1f4d33, [sx * 0.1, 2.03, sz * 0.06], { tex: 'metal', metal: 0.45, rough: 0.5, rotZ: -sx * 0.5 })),
    ),
  );
  const hands: THREE.Mesh[] = [];
  [0.08, -0.08].forEach((z, fi) => {
    g.add(cyl(t, 0.28, 0.28, 0.02, 0xf2eee2, [0, 2.3, z], { rough: 0.4, seg: 24, rotX: Math.PI / 2 })); // face proud of the drum side (0.07)
    // BEZEL: the ring that holds the glass. Without it the face is a white disc
    // stuck on a green drum.
    const bez = new t.Mesh(new t.TorusGeometry(0.285, 0.022, 6, 22), mat(t, 0xd8b54a, { metal: 0.6, rough: 0.35 }));
    bez.position.set(0, 2.3, z * 1.15);
    bez.castShadow = true;
    g.add(bez);
    for (let h = 0; h < 12; h++) {
      const a = (h / 12) * Math.PI * 2;
      const quarter = h % 3 === 0; // the quarters read longer, as on a real dial
      g.add(
        box(t, [quarter ? 0.028 : 0.02, quarter ? 0.08 : 0.05, 0.012], 0x22242a, [Math.cos(a) * (quarter ? 0.222 : 0.235), 2.3 + Math.sin(a) * (quarter ? 0.222 : 0.235), z * 1.2], {
          rotZ: a,
        }),
      ); // hour ticks on the face
    }
    g.add(ball(t, 0.028, 0xd8b54a, [0, 2.3, z * 1.5], { metal: 0.6, rough: 0.35 })); // hub cap over the hand pivots
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
export function flagpole(t: T): Built {
  const g = new t.Group();
  g.add(cyl(t, 0.14, 0.19, 0.12, STONE, [0, 0.06, 0], { tex: 'concrete', repeat: [3, 1], rough: 0.9, seg: 14 })); // base 0→0.12
  g.add(cyl(t, 0.03, 0.05, 2.9, 0xd8d8dc, [0, 1.57, 0], { tex: 'metal', metal: 0.6, rough: 0.35, seg: 12 })); // pole 0.12→3.02
  // DETAIL: the working parts. A flagpole is a TRUCK (the pulley at the top), a
  // HALYARD looped down its length and a CLEAT to tie it off — without them the
  // pennant is glued to a pipe. Plus a stepped base moulding.
  g.add(cyl(t, 0.055, 0.055, 0.05, 0xb8bcc4, [0, 2.98, 0], { tex: 'metal', metal: 0.7, rough: 0.3, seg: 10 })); // truck
  const pulley = new t.Mesh(new t.TorusGeometry(0.028, 0.009, 5, 12), mat(t, 0x8a8f98, { metal: 0.7, rough: 0.35 }));
  pulley.position.set(0.052, 2.96, 0);
  pulley.rotation.y = Math.PI / 2;
  g.add(pulley);
  [-1, 1].forEach((s) => g.add(cyl(t, 0.007, 0.007, 2.1, 0xe4dcc4, [s * 0.048, 1.9, 0], { tex: 'fabric', rough: 1, seg: 5 }))); // halyard, both falls
  g.add(box(t, [0.06, 0.02, 0.02], IRON, [0.045, 0.9, 0], { tex: 'metal', metal: 0.6, rough: 0.45, rotZ: 0.35 })); // cleat
  [-1, 1].forEach((s) => g.add(ball(t, 0.014, IRON, [0.045 + s * 0.026, 0.9 + s * 0.01, 0], { metal: 0.6, rough: 0.45 }))); // …its horns
  g.add(cyl(t, 0.075, 0.075, 0.04, 0xc8c8cc, [0, 0.15, 0], { tex: 'metal', metal: 0.5, rough: 0.4, seg: 12 })); // base moulding
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
// BATCHED (perf wave 12): 18 meshes → 4 (stone plinths, textured ironwork,
// untextured ironwork, the arch torus). Same parts, same places.
export function ironArchway(t: T): Built {
  const g = new t.Group();
  const plinths: { dims: [number, number, number]; pos: [number, number, number] }[] = [];
  const ironBoxes: { dims: [number, number, number]; pos: [number, number, number] }[] = [];
  const ironPlain: { geo: THREE.BufferGeometry; matrix: THREE.Matrix4 }[] = [];
  const bossGeo = new t.IcosahedronGeometry(0.06, 3); // == ball(0.06, …)
  const spikeGeo = new t.CylinderGeometry(0.0, 0.05, 0.22, 8);
  const owned: THREE.BufferGeometry[] = [];
  [-1, 1].forEach((sx) => {
    plinths.push({ dims: [0.3, 0.2, 0.3], pos: [sx, 0.1, 0] }); // plinth 0→0.2 wraps the column base
    ironBoxes.push({ dims: [0.16, 2.2, 0.16], pos: [sx, 1.1, 0] }); // column 0→2.2
    ironBoxes.push({ dims: [0.26, 0.06, 0.26], pos: [sx, 2.23, 0] }); // cap 2.2→2.26
    ironPlain.push({ geo: bossGeo, matrix: mtx(t, [sx, 0.9, 0.11]) }); // scroll bosses on the column faces
    ironPlain.push({ geo: bossGeo, matrix: mtx(t, [sx, 1.6, 0.11]) });
  });
  ironBoxes.push({ dims: [2.0, 0.05, 0.05], pos: [0, 2.285, 0] }); // tie bar embedded in both caps
  // lattice verticals: tie bar top (2.31) up into the arch's inner face at each x
  [-0.6, -0.3, 0, 0.3, 0.6].forEach((x) => {
    const yArch = 2.26 + Math.sqrt(1 - x * x) - 0.05; // arch centreline − inner tube reach
    const geo = new t.BoxGeometry(0.035, yArch - 2.26, 0.035);
    owned.push(geo);
    ironPlain.push({ geo, matrix: mtx(t, [x, (yArch + 2.26) / 2, 0]) });
  });
  ironPlain.push({ geo: spikeGeo, matrix: mtx(t, [0, 3.42, 0]) }); // spike: base 3.31 < arch crown 3.33
  g.add(mergedBoxes(t, plinths, STONE, { tex: 'concrete', rough: 0.9 }));
  g.add(mergedBoxes(t, ironBoxes, IRON, { tex: 'metal', metal: 0.6, rough: 0.45 }));
  g.add(mergedParts(t, ironPlain, mat(t, IRON, { metal: 0.6, rough: 0.45 }), false));
  bossGeo.dispose();
  spikeGeo.dispose();
  owned.forEach((geo) => geo.dispose());
  // arch: half-torus radius 1.0 — its ends land exactly on the column caps (±1, 2.26)
  const arch = new t.Mesh(new t.TorusGeometry(1.0, 0.07, 10, 32, Math.PI), mat(t, IRON, { tex: 'metal', metal: 0.6, rough: 0.45 }));
  arch.position.y = 2.26;
  arch.castShadow = true;
  g.add(arch);
  // DETAIL. A wrought arch is TWO concentric bars with scrollwork between them,
  // and a garden arch has something GROWING on it — the old piece had one bare
  // hoop, which reads as a croquet wicket at park scale.
  const inner = new t.Mesh(new t.TorusGeometry(0.82, 0.035, 8, 26, Math.PI), mat(t, IRON, { tex: 'metal', metal: 0.6, rough: 0.45 }));
  inner.position.y = 2.26;
  inner.castShadow = true;
  g.add(inner);
  // SCROLL VOLUTES in the spandrel between the two bars — small rings, the
  // signature of wrought ironwork
  for (let i = 1; i < 6; i++) {
    const a = (i / 6) * Math.PI;
    const r = 0.91;
    const sc = new t.Mesh(new t.TorusGeometry(0.055, 0.014, 5, 12), mat(t, IRON, { metal: 0.6, rough: 0.45 }));
    sc.position.set(Math.cos(a) * r, 2.26 + Math.sin(a) * r, 0);
    sc.rotation.y = Math.PI / 2;
    g.add(sc);
  }
  // CLIMBING FOLIAGE up both columns and over the crown — deterministic, and the
  // single change that makes this read as a garden arch instead of scaffolding
  const L = { tex: 'leaf' as const, repeat: [2, 2] as [number, number], flat: true, rough: 1 };
  for (let i = 0; i < 16; i++) {
    const f = i / 15;
    const a = f * Math.PI; // sweep the arch left → right
    const r = 1.0;
    const jx = (hash01(i * 3.7) - 0.5) * 0.1;
    const jz = (hash01(i * 5.3 + 2) - 0.5) * 0.16;
    const leaf = ball(t, 0.075 + hash01(i * 7.1 + 5) * 0.05, i % 3 ? LEAF : 0x2f5f2a, [Math.cos(a) * r + jx, 2.26 + Math.sin(a) * r, jz], L);
    leaf.scale.set(1, 0.75, 1);
    g.add(leaf);
  }
  [-1, 1].forEach((sx) =>
    [0.42, 0.86, 1.3, 1.74].forEach((y, k) => {
      const leaf = ball(t, 0.085 + hash01(k * 4.3 + sx * 9) * 0.04, k % 2 ? LEAF : 0x2f5f2a, [sx * (1 + (hash01(k * 2.1) - 0.5) * 0.08), y, (hash01(k * 6.7) - 0.5) * 0.18], L);
      leaf.scale.set(0.8, 0.9, 1);
      g.add(leaf);
    }),
  );
  // …and three roses in it, because a climbing arch in an RCT2 garden is a rose
  // arch. The column one was at x −0.86 against a column that spans −1.08…−0.92
  // (`dims [0.16, 2.2, 0.16]` at sx −1) and whose leaves sit at |x| 0.96–1.04 —
  // so it missed everything by 0.018 and floated beside the arch. Moved onto the
  // column face; the two on the crown already land on the outer bar.
  [
    [0.62, 2.9],
    [-0.97, 1.86],
    [0.2, 3.18],
  ].forEach(([x, y]) => g.add(ball(t, 0.042, 0xd4506a, [x as number, y as number, 0.07], { flat: true, rough: 0.7 })));
  return { group: g };
}

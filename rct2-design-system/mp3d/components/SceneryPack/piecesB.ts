// ---------------------------------------------------------------------------
// SceneryPack/piecesB.ts — pieces 12-20: brickWall -> hotAirBalloon
//
// SPLIT out of index.tsx (2026-07). `write_design_system_files` replaces WHOLE
// files with no patch API, so a module has to fit in one tool call's output;
// at 94 KB the single file was past the point where that is safe. Three
// modules of ~2/44/44 KB each push independently. Behaviour-neutral: the
// builders are moved verbatim, only `export` is added.
// ---------------------------------------------------------------------------

import * as THREE from 'three';
import { box, cyl, ball, mat, mergedBoxes, mergedParts, mtx, nightKOf, hash01, rod, STONE, IRON, WOOD_DARK, LEAF } from './shared';
import type { T, Built } from './shared';

// ---------------------------------------------------------------------------
// 12. brickWall — low garden wall with stone coping
// ---------------------------------------------------------------------------
export function brickWall(t: T): Built {
  const g = new t.Group();
  // fabric texture's woven grid reads as mortar courses over the brick tint
  g.add(box(t, [2.0, 0.8, 0.24], 0x9a4a32, [0, 0.4, 0], { tex: 'fabric', repeat: [10, 5], rough: 0.95, bump: 0.05 })); // wall 0→0.8
  g.add(box(t, [2.08, 0.08, 0.32], STONE, [0, 0.84, 0], { tex: 'concrete', repeat: [8, 1], rough: 0.9 })); // coping seated on the wall top (0.8)
  // DETAIL — real brickwork is COURSED, and the courses that stand out are what
  // you see from a distance: a plinth course proud at the foot, a SOLDIER COURSE
  // (bricks on end) under the coping, and a recessed panel between them. All
  // three throw horizontal shadow lines across what was one flat face.
  g.add(box(t, [2.06, 0.14, 0.3], 0x8a4029, [0, 0.07, 0], { tex: 'fabric', repeat: [10, 1], rough: 0.95, bump: 0.05 })); // plinth course, proud 0.03
  for (let i = 0; i < 14; i++)
    g.add(box(t, [0.13, 0.11, 0.26], i % 2 ? 0xa8543a : 0x8f4530, [-0.91 + i * 0.14, 0.735, 0], { tex: 'fabric', repeat: [1, 1], rough: 0.95 })); // soldier course
  [-1, 1].forEach((s) => g.add(box(t, [1.5, 0.44, 0.02], 0x8f4530, [0, 0.42, s * 0.125], { tex: 'fabric', repeat: [8, 3], rough: 0.95, bump: 0.05 }))); // recessed panel shadow
  [-1.0, 1.0].forEach((x) => {
    g.add(box(t, [0.32, 0.96, 0.32], 0x8a4029, [x, 0.48, 0], { tex: 'fabric', repeat: [2, 5], rough: 0.95, bump: 0.05 })); // pillars 0→0.96 wrap the wall ends
    g.add(box(t, [0.4, 0.1, 0.4], STONE, [x, 0.06, 0], { tex: 'concrete', rough: 0.9 })); // pillar BASE, matching its cap
    g.add(box(t, [0.4, 0.07, 0.4], STONE, [x, 0.995, 0], { tex: 'concrete', rough: 0.9 })); // pillar cap on 0.96
    g.add(cyl(t, 0.075, 0.1, 0.06, STONE, [x, 1.055, 0], { tex: 'concrete', rough: 0.9, seg: 12 })); // finial neck
    g.add(ball(t, 0.09, STONE, [x, 1.14, 0], { tex: 'concrete', rough: 0.9 })); // ball finial bottom 1.05 = neck top
  });
  return { group: g };
}

// ---------------------------------------------------------------------------
// 13. picketFence — white pickets with pointed tops
// ---------------------------------------------------------------------------
// BATCHED (perf wave 12): 24 meshes → 2. Every part is the same white, so the
// wood-textured boxes (pickets, rails, end posts) go into ONE mergedBoxes
// batch with their per-box texture repeats baked into the UVs, and the
// untextured caps + picket points into one mergedParts batch. Same geometry,
// same repeats, same colours.
export function picketFence(t: T): Built {
  const g = new t.Group();
  const WHT = 0xe8e6df;
  const woodBoxes: { dims: [number, number, number]; pos: [number, number, number]; repeat: [number, number] }[] = [];
  const plain: { geo: THREE.BufferGeometry; matrix: THREE.Matrix4 }[] = [];
  const pointGeo = new t.CylinderGeometry(0.0, 0.062, 0.1, 4);
  const capGeo = new t.BoxGeometry(0.15, 0.04, 0.15);
  for (let i = 0; i < 9; i++) {
    const x = -0.96 + i * 0.24;
    woodBoxes.push({ dims: [0.09, 0.75, 0.03], pos: [x, 0.375, 0], repeat: [1, 3] }); // picket 0→0.75
    plain.push({ geo: pointGeo, matrix: mtx(t, [x, 0.8, 0], [0, Math.PI / 4, 0]) }); // point base 0.75 = picket top
    // a BEAD down each picket face: the moulding a turned picket carries, and
    // the thing that stops nine identical flat boards reading as a barcode
    woodBoxes.push({ dims: [0.03, 0.62, 0.012], pos: [x, 0.36, 0.021], repeat: [1, 3] });
  }
  // rails run behind the pickets: picket back face −0.015, rail spans −0.055→−0.015 — touching
  [0.24, 0.58].forEach((y) => woodBoxes.push({ dims: [2.06, 0.07, 0.04], pos: [0, y, -0.035], repeat: [8, 1] }));
  [-1.06, 1.06].forEach((x) => {
    woodBoxes.push({ dims: [0.11, 0.85, 0.11], pos: [x, 0.425, -0.02], repeat: [1, 3] }); // end posts 0→0.85 (rails embed)
    plain.push({ geo: capGeo, matrix: mtx(t, [x, 0.87, -0.02]) }); // post cap on 0.85
    // and a BASE BLOCK, so the post lands on the ground instead of stopping at it
    woodBoxes.push({ dims: [0.15, 0.09, 0.15], pos: [x, 0.045, -0.02], repeat: [1, 1] });
  });
  g.add(mergedBoxes(t, woodBoxes, WHT, { tex: 'wood', rough: 0.8 }));
  g.add(mergedParts(t, plain, mat(t, WHT, { rough: 0.8 }), false));
  pointGeo.dispose();
  capGeo.dispose();
  return { group: g };
}

// ---------------------------------------------------------------------------
// 14. lionStatue — recumbent stone lion on a plinth
// ---------------------------------------------------------------------------
export function lionStatue(t: T): Built {
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
    // TOES on each forepaw + an EAR and a BROW on the head — a guardian lion is
    // recognised by its face, and this one had none
    [-1, 0, 1].forEach((k) => g.add(ball(t, 0.032, 0xb5ac96, [0.57, 0.42, (z as number) + k * 0.036], C)));
    g.add(ball(t, 0.045, 0xa89f8a, [0.36, 1.0, (z as number) * 0.62], { ...C, flat: true })); // ear, rooted in the mane
    g.add(box(t, [0.07, 0.03, 0.05], 0xb5ac96, [0.52, 0.925, (z as number) * 0.42], { ...C, rotZ: -0.2 })); // brow ridge
    g.add(ball(t, 0.022, 0x5a5348, [0.545, 0.9, (z as number) * 0.42], { rough: 0.6 })); // eye
  });
  // MANE LOCKS: six flattened lobes round the mane ball, which is what turns a
  // second sphere into a mane
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const lock = ball(t, 0.1, 0x9d947f, [0.3 + Math.cos(a) * 0.04, 0.72 + Math.sin(a) * 0.24, Math.cos(a) * 0.2], { ...C, flat: true });
    lock.scale.set(0.7, 1, 1);
    g.add(lock);
  }
  g.add(rod(t, [-0.52, 0.5, 0.1], [-0.72, 0.4, 0.22], 0.03, STONE, C)); // tail off the haunch, tip resting on the plinth
  g.add(ball(t, 0.055, 0xa89f8a, [-0.72, 0.4, 0.22], { ...C, flat: true })); // tail TUFT on the tip
  // plinth cornice + a sunken panel on the front face, matching marbleStatue's
  g.add(box(t, [1.41, 0.045, 0.76], STONE, [0, 0.4, 0], { ...C, repeat: [5, 1] }));
  g.add(box(t, [0.7, 0.14, 0.02], 0xb5ac96, [0, 0.25, 0.355], { ...C })); // inscription panel
  return { group: g };
}

// ---------------------------------------------------------------------------
// 15. cactusCluster — saguaro + barrel cactus on a sand bed
// ---------------------------------------------------------------------------
export function cactusCluster(t: T): Built {
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
  // DETAIL — a saguaro is RIBBED, and the ribs are its whole silhouette: ten
  // shallow flutes up the trunk plus areole dots along them. Then a crown of
  // blossoms, desert pebbles on the sand and a bleached dead branch, so the bed
  // is a desert scene rather than a green pipe on a beige disc.
  //
  // ALL OF IT BATCHED, and that is not optional here: `dressing.ts` and the
  // set-piece plans both scatter `cactusCluster`, so every loose primitive is
  // paid once per instance. Detailing it as 33 separate meshes took a measured
  // park from 1148 to 3374 draws — past the Stage's ~3000 budget — which is the
  // whole reason these four buckets exist. 48 meshes → 20.
  type P = { geo: THREE.BufferGeometry; matrix: THREE.Matrix4 };
  const ribs: { dims: [number, number, number]; pos: [number, number, number]; rotY?: number }[] = [];
  const areoles: P[] = [];
  const pebbles: P[] = [];
  const blooms: P[] = [];
  const dotGeo = new t.IcosahedronGeometry(0.014, 0);
  const pebGeo = new t.IcosahedronGeometry(1, 0);
  const bloomGeo = new t.IcosahedronGeometry(1, 0);
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    ribs.push({ dims: [0.026, 1.42, 0.026], pos: [0.1 + Math.cos(a) * 0.115, 0.86, Math.sin(a) * 0.115], rotY: -a });
    if (i % 2 === 0)
      [0.45, 0.85, 1.25].forEach((y) => areoles.push({ geo: dotGeo, matrix: mtx(t, [0.1 + Math.cos(a) * 0.125, y, Math.sin(a) * 0.125]) }));
  }
  [
    [0.06, 1.66, 0.06, 0.038],
    [0.16, 1.63, -0.05, 0.038],
    [0.1, 1.68, 0.0, 0.05],
    [-0.28, 1.46, 0, 0.045],
  ].forEach(([x, y, z, r]) =>
    blooms.push({ geo: bloomGeo, matrix: mtx(t, [x as number, y as number, z as number], [0, 0, 0], [r as number, r as number, r as number]) }),
  );
  [
    [0.55, 0.42, 0.055],
    [-0.62, -0.22, 0.04],
    [0.2, 0.62, 0.035],
    [-0.15, -0.55, 0.045],
    [0.66, -0.12, 0.03],
  ].forEach(([x, z, r]) => {
    const rr = r as number;
    pebbles.push({ geo: pebGeo, matrix: mtx(t, [x as number, 0.1 + rr * 0.55, z as number], [0, 0, 0], [rr, rr * 0.6, rr]) });
  });
  g.add(mergedBoxes(t, ribs, 0x3f6a32, { rough: 1 }));
  g.add(mergedParts(t, areoles, mat(t, 0xd8d0b0, { rough: 0.8 }), false));
  g.add(mergedParts(t, blooms, mat(t, 0xf7f0d8, { flat: true, rough: 0.7 }), false));
  g.add(mergedParts(t, pebbles, mat(t, 0xa89d84, { tex: 'concrete', flat: true, rough: 1 }), false));
  dotGeo.dispose();
  pebGeo.dispose();
  bloomGeo.dispose();
  g.add(rod(t, [-0.66, 0.11, -0.2], [-0.42, 0.3, -0.36], 0.022, 0xc4b48c, { tex: 'wood', rough: 1 })); // bleached branch
  return { group: g };
}

// ---------------------------------------------------------------------------
// 16. fallenLog — mossy trunk bedded into the grass
// ---------------------------------------------------------------------------
export function fallenLog(t: T): Built {
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
  // DETAIL — what makes a fallen log read as ROTTING rather than as a dowel:
  //   * BARK STRIPS peeling along the trunk (four ridges rooted in its surface)
  //   * a dark HOLLOW bored into the cut face at the thin end
  //   * ROOT SPURS radiating off the root plate
  //   * bracket FUNGI stepping up the flank, and leaf litter along the bed line
  [0.6, 1.9, 3.4, 4.9].forEach((a, i) => {
    const rr = 0.205;
    g.add(
      box(t, [1.5 - i * 0.18, 0.035, 0.075], 0x53381f, [(i - 1.5) * 0.12, 0.17 + Math.sin(a) * rr, Math.cos(a) * rr], {
        tex: 'wood',
        repeat: [5, 1],
        rough: 1,
        rotX: -a + Math.PI / 2,
      }),
    );
  });
  g.add(cyl(t, 0.1, 0.1, 0.05, 0x1a120a, [0.9, 0.17, 0], { rough: 1, seg: 12, rotZ: Math.PI / 2 })); // hollow in the cut face
  [
    [-1.1, 0.42, 0.26],
    [-1.05, 0.14, -0.3],
    [-1.14, 0.3, 0.02],
  ].forEach(([x, y, z]) => g.add(rod(t, [-0.95, 0.3, 0], [x as number, y as number, z as number], 0.035, 0x5a3d22, W))); // root spurs
  [
    [-0.5, 0.2, 0.09],
    [-0.36, 0.09, 0.07],
    [0.42, 0.16, 0.075],
  ].forEach(([x, y, r], i) => {
    const br = ball(t, r as number, i === 2 ? 0xc9b088 : 0xd8c49a, [x as number, y as number, 0.19], { tex: 'concrete', flat: true, rough: 0.95 });
    br.scale.set(1.3, 0.32, 1); // bracket fungus shelving off the flank
    g.add(br);
  });
  [
    [-0.7, 0.3],
    [0.25, 0.34],
    [0.8, -0.3],
    [-0.2, -0.33],
  ].forEach(([x, z], i) => {
    const leaf = ball(t, 0.07 + hash01(i * 5 + 7) * 0.04, i % 2 ? 0x8a7a3a : 0x9a6a2a, [x as number, 0.02, z as number], { tex: 'leaf', flat: true, rough: 1 });
    leaf.scale.set(1.4, 0.16, 1.1);
    g.add(leaf);
  });
  return { group: g };
}

// ---------------------------------------------------------------------------
// 17. mushroomCluster — five deterministic toadstools
// ---------------------------------------------------------------------------
// BATCHED (perf wave 12): 25 meshes → 3 (stems, caps, spots) at the same
// hashed positions. The 15 spots were `ball(0.022, …)` at the SMOOTH default
// detail — 320 triangles each for a 22 mm dot, 4 800 of the piece's 5 400
// triangles. They are now detail 1 (80 tris) and still smooth-shaded: at 22 mm
// the silhouette is sub-pixel from any park camera. 5 400 → 1 800 triangles.
export function mushroomCluster(t: T, seed: number): Built {
  const g = new t.Group();
  const stems: { geo: THREE.BufferGeometry; matrix: THREE.Matrix4 }[] = [];
  const caps: { geo: THREE.BufferGeometry; matrix: THREE.Matrix4 }[] = [];
  const spots: { geo: THREE.BufferGeometry; matrix: THREE.Matrix4 }[] = [];
  const gills: { geo: THREE.BufferGeometry; matrix: THREE.Matrix4 }[] = []; // undersides + rings
  const spotGeo = new t.IcosahedronGeometry(0.022, 1);
  const gillGeo = new t.CylinderGeometry(1, 1, 1, 12); // unit, scaled per cap
  const litter: { geo: THREE.BufferGeometry; matrix: THREE.Matrix4 }[] = [];
  const litterGeo = new t.IcosahedronGeometry(1, 0);
  for (let i = 0; i < 5; i++) {
    const h1 = hash01(i * 13 + 1 + seed * 17.13);
    const h2 = hash01(i * 13 + 5 + seed * 17.13);
    const r = 0.1 + h1 * 0.12; // cap radius
    const sh = 0.12 + h2 * 0.18; // stem height
    const a = (i / 5) * Math.PI * 2 + h1 * 0.8;
    const d = i === 0 ? 0 : 0.28 + h2 * 0.2;
    const x = Math.cos(a) * d;
    const z = Math.sin(a) * d;
    stems.push({ geo: new t.CylinderGeometry(0.3 * r, 0.42 * r, sh, 10), matrix: mtx(t, [x, sh / 2, z]) }); // stem 0→sh
    // cap underside sh−0.23r — swallows the stem top
    caps.push({ geo: new t.IcosahedronGeometry(r, 1), matrix: mtx(t, [x, sh + 0.32 * r, z], [0, 0, 0], [1, 0.55, 1]) });
    for (let s = 0; s < 3; s++) {
      const sa = s * 2.1 + i;
      spots.push({ geo: spotGeo, matrix: mtx(t, [x + Math.cos(sa) * r * 0.45, sh + 0.32 * r + r * 0.42, z + Math.sin(sa) * r * 0.45]) }); // spots bedded in the cap crown
    }
    // DETAIL: the GILL disc under the cap and the ANNULUS ring round the stem.
    // A toadstool seen from a park camera is a red dome on a pale stick; the pale
    // underside is what tells you it is a mushroom and not a berry, and it is
    // visible on every one of these because the caps sit low.
    gills.push({ geo: gillGeo, matrix: mtx(t, [x, sh + 0.1 * r, z], [0, 0, 0], [r * 0.88, 0.035, r * 0.88]) });
    gills.push({ geo: gillGeo, matrix: mtx(t, [x, sh * 0.66, z], [0, 0, 0], [r * 0.42, 0.02, r * 0.42]) }); // annulus
  }
  // LEAF LITTER round the cluster — five flat scraps, so the group sits in a
  // woodland floor instead of on a lawn
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + 0.6;
    const d = 0.42 + hash01(i * 7.7 + seed * 17.13) * 0.22;
    litter.push({
      geo: litterGeo,
      matrix: mtx(t, [Math.cos(a) * d, 0.012, Math.sin(a) * d], [0, a, 0], [0.09, 0.012, 0.06]),
    });
  }
  g.add(mergedParts(t, stems, mat(t, 0xe8dcc2, { tex: 'concrete', rough: 0.9 })));
  g.add(mergedParts(t, caps, mat(t, 0xc23a2e, { flat: true, rough: 0.8 })));
  g.add(mergedParts(t, gills, mat(t, 0xf0e4cc, { rough: 0.9 }), false));
  g.add(mergedParts(t, spots, mat(t, 0xf2eee2, { rough: 0.8 }), false));
  g.add(mergedParts(t, litter, mat(t, 0x8a6a34, { flat: true, rough: 1 }), false));
  spotGeo.dispose();
  gillGeo.dispose();
  litterGeo.dispose();
  return { group: g };
}

// ---------------------------------------------------------------------------
// 18. wishingWell — stone well, gabled roof, crank, hanging bucket
// ---------------------------------------------------------------------------
export function wishingWell(t: T): Built {
  const g = new t.Group();
  g.add(cyl(t, 0.5, 0.56, 0.55, STONE, [0, 0.275, 0], { tex: 'concrete', repeat: [6, 2], rough: 0.95, bump: 0.05, seg: 18 })); // drum 0→0.55
  g.add(cyl(t, 0.4, 0.4, 0.02, 0x101418, [0, 0.56, 0], { rough: 1, seg: 18 })); // dark shaft mouth ON the drum top
  g.add(cyl(t, 0.58, 0.58, 0.08, 0xa89f8a, [0, 0.59, 0], { tex: 'concrete', repeat: [7, 1], rough: 0.9, seg: 18 })); // rim 0.55→0.63
  [-0.48, 0.48].forEach((x) => g.add(box(t, [0.09, 1.1, 0.09], WOOD_DARK, [x, 1.18, 0], { tex: 'wood', repeat: [1, 4], rough: 0.95 }))); // posts 0.63→1.73 on the rim
  g.add(box(t, [1.2, 0.07, 0.07], WOOD_DARK, [0, 1.7, 0], { tex: 'wood', repeat: [4, 1], rough: 0.95 })); // crossbeam embedded in the post tops
  g.add(box(t, [0.07, 0.3, 0.07], WOOD_DARK, [0, 1.87, 0], { tex: 'wood', rough: 0.95 })); // king post 1.72→2.02 carries the ridge
  // ---- THE ROOF: a GABLE, and the pitch sign is the whole of it -------------
  // It was a BUTTERFLY (a valley down the middle) until 2026-07. `rotX: θ` maps
  // slab-local (0, 0, f) to world y = −f·sin θ, so with the slab centred OUTBOARD
  // at z = −0.215·s the positive θ = +0.56·s was lifting the OUTER edge and
  // dropping the one at the ridge — the elevation read \/ instead of /\.
  // Sign flipped, and while the frame was being derived rather than typed the
  // slabs were widened to actually shelter the shaft: the old pair spanned
  // z ±0.45 against a 0.58 rim, so rain fell straight down the well.
  const PITCH = 0.56; // rise/run of each slope, radians
  const RIDGE_Z = 0.02; // slabs meet with a hair of overlap under the cap
  const EAVE_Z = 0.66; // past the 0.58 rim, so the roof overhangs the drum
  const RIDGE_Y = 2.005; // top edge, just inside the ridge cap (1.99→2.05)
  const SLAB_D = (EAVE_Z + RIDGE_Z) / Math.cos(PITCH); // slope length, eave→ridge
  const SLAB_CZ = (EAVE_Z - RIDGE_Z) / 2; // |z| of each slab's centre
  const SLAB_CY = RIDGE_Y - (SLAB_D / 2) * Math.sin(PITCH);
  [-1, 1].forEach((s) =>
    g.add(
      box(t, [1.34, 0.045, SLAB_D], 0x7a4a26, [0, SLAB_CY, -SLAB_CZ * s], {
        tex: 'wood',
        repeat: [5, 2],
        rough: 0.95,
        bump: 0.04,
        rotX: -PITCH * s, // NEGATIVE: lifts the edge nearest the ridge
      }),
    ),
  );
  g.add(box(t, [1.36, 0.06, 0.16], 0x5a3d22, [0, 2.02, 0], { tex: 'wood', repeat: [5, 1], rough: 0.95 })); // ridge cap over the king post
  [-1, 1].forEach((s) =>
    g.add(box(t, [1.36, 0.05, 0.05], 0x5a3d22, [0, SLAB_CY - (SLAB_D / 2) * Math.sin(PITCH) - 0.02, -EAVE_Z * s], { tex: 'wood', repeat: [5, 1], rough: 0.95 })),
  ); // fascia board closing each eave
  g.add(cyl(t, 0.035, 0.035, 1.08, 0x6a4a2c, [0, 1.45, 0], { tex: 'wood', rough: 0.9, seg: 10, rotZ: Math.PI / 2 })); // axle spans into both posts
  g.add(rod(t, [0.56, 1.45, 0], [0.68, 1.3, 0], 0.025, IRON, { metal: 0.5, rough: 0.5 })); // crank arm off the axle end
  g.add(ball(t, 0.04, IRON, [0.68, 1.3, 0], { metal: 0.5, rough: 0.5 })); // crank knob
  g.add(cyl(t, 0.012, 0.012, 0.45, 0xc9b28a, [0, 1.225, 0], { tex: 'fabric', rough: 1, seg: 6 })); // rope: top 1.45 = axle centre, bottom 1.0
  g.add(cyl(t, 0.1, 0.075, 0.16, 0x6a4a2c, [0, 0.92, 0], { tex: 'wood', repeat: [3, 1], rough: 0.9, seg: 12 })); // bucket: rim 1.0 = rope bottom
  // DETAIL — the four courses of a working well:
  //   * the ROPE WOUND on the axle (a fatter sleeve), which is where the rope
  //     came from and what the crank is for
  //   * IRON HOOPS and a swing HANDLE on the bucket
  //   * STONE COURSES banding the drum, so it is masonry rather than a tube
  //   * SHINGLE COURSES on the two roof slabs, matching the gazebo's roof
  g.add(cyl(t, 0.055, 0.055, 0.42, 0xbba884, [0, 1.45, 0], { tex: 'fabric', repeat: [6, 2], rough: 1, seg: 10, rotZ: Math.PI / 2 })); // wound rope
  [0.96, 0.87].forEach((y, i) =>
    g.add(cyl(t, 0.101 - i * 0.012, 0.101 - i * 0.012, 0.022, IRON, [0, y, 0], { tex: 'metal', metal: 0.55, rough: 0.5, seg: 12 })),
  ); // bucket hoops
  const bail = new t.Mesh(new t.TorusGeometry(0.095, 0.008, 5, 14, Math.PI), mat(t, IRON, { metal: 0.55, rough: 0.5 }));
  bail.position.set(0, 1.0, 0);
  bail.rotation.y = Math.PI / 2;
  bail.castShadow = true;
  g.add(bail); // swing handle, ends at the rim
  [0.14, 0.3, 0.46].forEach((y) =>
    g.add(cyl(t, 0.515 + (0.55 - y) * 0.06, 0.515 + (0.55 - y) * 0.06, 0.035, 0xa89f8a, [0, y, 0], { tex: 'concrete', repeat: [7, 1], rough: 0.95, seg: 18 })),
  ); // stone courses
  // Each course sits in the SLAB's own tilted frame: the slab is centred at
  // (0, SLAB_CY, −SLAB_CZ·s) with rotX = p, so a point at slab-local (0, up, f)
  // lands at y = SLAB_CY + up·cos p − f·sin p, z = −SLAB_CZ·s + up·sin p + f·cos p.
  // `up` 0.033 puts the course just proud of the 0.045-thick slab's top face.
  // `f` is measured along the slope from the slab centre, so it MUST be re-derived
  // whenever SLAB_D changes — courses pinned to the old 0.56 depth slid off the
  // widened slab and hung in the air past the eave.
  [-1, 1].forEach((s) => {
    const p = -PITCH * s;
    const up = 0.033;
    [-0.34, -0.11, 0.12, 0.33].forEach((u) => {
      const f = u * SLAB_D; // fraction of the slope, so the spacing scales with it
      g.add(
        box(t, [1.35, 0.02, 0.055], 0x5f3a1c, [0, SLAB_CY + up * Math.cos(p) - f * Math.sin(p), -SLAB_CZ * s + up * Math.sin(p) + f * Math.cos(p)], {
          tex: 'wood',
          repeat: [5, 1],
          rough: 0.95,
          rotX: p,
        }),
      );
    });
  }); // shingle courses across each pitch
  return { group: g };
}

// ---------------------------------------------------------------------------
// 19. gazebo — open hexagonal bandstand
// ---------------------------------------------------------------------------
// DETAILED (2026-07) after the park render. The bandstand was structurally
// right and completely undressed: six bare cylinders, a single flat-shaded
// hexagonal cone with nothing on it, and a railing of two thin rails plus five
// chunky balusters per bay — which from above reads as a LADDER laid on its
// side. The additions are the details a real gazebo is recognised by, and each
// one is a merged batch so the piece costs draw calls in the same order it did:
//
//   * roof: HIP CAPS along all six ridges + three stepped SHINGLE COURSES. The
//     park camera looks down on this roof, so its articulation is most of what
//     the piece contributes to a frame; a bare cone contributes nothing.
//   * eaves: a gutter lip under the fascia and a BRACKET over every post.
//   * a fretwork VALANCE hung in each bay — the single most characteristic
//     gazebo detail, and its absence is why the old one read as a bus shelter.
//   * posts: a square base block, a collar and a capital, so they land on the
//     deck and meet the eave instead of just ending.
//   * railings: three rails (cap / mid / bottom) and nine slim balusters per
//     bay instead of two rails and five fat ones.
//   * STEPS at the open bay and a slatted BENCH around the railed ones.
export function gazebo(t: T): Built {
  const g = new t.Group();
  const WHT = 0xe8e2d2;
  const WHT_D = 0xcdc6b4; // shaded trim — brackets, valance, gutter
  const TILE = 0x8a4a3a;
  const TILE_D = 0x6f3a2c; // hip caps + course shadows
  type BoxSpec = { dims: [number, number, number]; pos: [number, number, number]; rotX?: number; rotY?: number; rotZ?: number; repeat?: [number, number] };
  type Part = { geo: THREE.BufferGeometry; matrix: THREE.Matrix4; uv?: [number, number] };
  const trim: BoxSpec[] = []; // WHT joinery batch
  const trimD: BoxSpec[] = []; // WHT_D batch

  g.add(cyl(t, 1.3, 1.36, 0.08, 0xa89f8a, [0, 0.04, 0], { tex: 'concrete', repeat: [8, 1], rough: 0.95, seg: 6 })); // step 0→0.08
  g.add(cyl(t, 1.12, 1.16, 0.14, 0xbfb6a0, [0, 0.11, 0], { tex: 'wood', repeat: [8, 1], rough: 0.9, seg: 6 })); // deck 0.04→0.18, seated on the step

  // BATCHED (perf wave 12): 6 posts + rails + balusters were 41 meshes and 41
  // materials; they are batches (same parts, same places).
  const R = 0.98;
  const ang = (k: number) => (k / 6) * Math.PI * 2 + Math.PI / 6;
  // ---- THE BAY FRAME ------------------------------------------------------
  // Bay k spans the posts at ang(k)…ang(k+1); its chord midpoint sits at the
  // mid-angle, and everything hung in the bay (rails, balusters, valance, bench,
  // steps) is a box whose LONG axis is local +X and which is placed by rotY.
  // rotY = θ sends local +X to world (cos θ, 0, −sin θ). The chord runs along
  // (−sin m, 0, cos m), so cos θ = −sin m and sin θ = −cos m, i.e. θ = −(m + π/2).
  //
  // It was `atan2(cos a1 − cos a2, sin a1 − sin a2) · −1` until 2026-07, which
  // simplifies to m − π. That is not a constant offset from −(m + π/2): the error
  // is 2m − π/2, so EVERY BAY WAS WRONG BY A DIFFERENT ANGLE — the panels sat on
  // the right chord midpoints pointing six different ways, splaying out past the
  // eave and crossing each other. The `f` offsets that step along a bay share the
  // convention (+X is world (cos θ, −sin θ)) and were wrong with it.
  const bayMid = (k: number) => ang(k) + Math.PI / 6; // = (ang(k) + ang(k+1)) / 2
  const bayRotY = (k: number) => -(bayMid(k) + Math.PI / 2);
  /** chord midpoint of bay k, on the post circle's inscribed radius */
  const bayPos = (k: number): [number, number] => {
    const a1 = ang(k);
    const a2 = ang(k + 1);
    return [((Math.cos(a1) + Math.cos(a2)) / 2) * R, ((Math.sin(a1) + Math.sin(a2)) / 2) * R];
  };
  const postGeo = new t.CylinderGeometry(0.05, 0.055, 1.66, 10);
  const posts: Part[] = [];
  for (let k = 0; k < 6; k++) {
    const a = ang(k);
    const px = Math.cos(a) * R;
    const pz = Math.sin(a) * R;
    posts.push({ geo: postGeo, matrix: mtx(t, [px, 0.18 + 0.83, pz]), uv: [1, 4] }); // posts 0.18→1.84
    // BASE block (sits ON the deck top 0.18), a COLLAR above it and a CAPITAL
    // under the eave — a post that just stops at both ends reads as a pipe
    trim.push({ dims: [0.15, 0.07, 0.15], pos: [px, 0.215, pz], rotY: a }); // 0.18→0.25
    trim.push({ dims: [0.13, 0.04, 0.13], pos: [px, 0.275, pz], rotY: a }); // collar
    trim.push({ dims: [0.15, 0.08, 0.15], pos: [px, 1.8, pz], rotY: a }); // capital 1.76→1.84
    // EAVE BRACKET: an angled brace from the post out to the fascia
    trimD.push({ dims: [0.04, 0.3, 0.05], pos: [px * 1.06, 1.66, pz * 1.06], rotZ: 0.5, rotY: a });
  }
  g.add(mergedParts(t, posts, mat(t, WHT, { tex: 'wood', rough: 0.85 }), false));
  postGeo.dispose();

  // ---- railings + valance, per bay ---------------------------------------
  const rails: BoxSpec[] = [];
  const balusters: BoxSpec[] = [];
  const bench: BoxSpec[] = [];
  for (let k = 0; k < 6; k++) {
    const [mx, mz] = bayPos(k);
    const ry = bayRotY(k);
    // inward normal of the bay (toward the gazebo centre), for the bench
    const inx = -mx / Math.hypot(mx, mz);
    const inz = -mz / Math.hypot(mx, mz);
    // THE VALANCE — hung in EVERY bay including the open one, because it is the
    // head of the opening as much as the trim of a railing
    trimD.push({ dims: [0.98, 0.09, 0.03], pos: [mx, 1.7, mz], rotY: ry, repeat: [6, 1] }); // frieze board
    for (let d = -3; d <= 3; d++) {
      const f = d * 0.14;
      trimD.push({ dims: [0.05, 0.11, 0.03], pos: [mx + Math.cos(ry) * f, 1.6, mz - Math.sin(ry) * f], rotY: ry }); // drop
    }
    if (k === 0) continue; // the front bay is the ENTRANCE: no rail, no bench
    // three rails — a CAP rail wider than the others is what a hand rests on,
    // and what stops the assembly reading as a ladder
    rails.push({ dims: [0.98, 0.05, 0.09], pos: [mx, 0.72, mz], rotY: ry, repeat: [5, 1] }); // cap
    rails.push({ dims: [0.98, 0.04, 0.05], pos: [mx, 0.66, mz], rotY: ry, repeat: [5, 1] }); // top rail under the cap
    rails.push({ dims: [0.98, 0.045, 0.05], pos: [mx, 0.34, mz], rotY: ry, repeat: [5, 1] }); // bottom rail
    for (let b = -4; b <= 4; b++) {
      const f = b * 0.105;
      balusters.push({ dims: [0.025, 0.3, 0.025], pos: [mx + Math.cos(ry) * f, 0.5, mz - Math.sin(ry) * f], rotY: ry }); // 0.35→0.65
    }
    // BENCH: a slatted seat on two brackets, tucked inside the railing
    const bx = mx + inx * 0.17;
    const bz = mz + inz * 0.17;
    [-0.045, 0.055].forEach((o) =>
      bench.push({ dims: [0.86, 0.035, 0.09], pos: [bx + inx * o, 0.4, bz + inz * o], rotY: ry, repeat: [5, 1] }),
    );
    [-0.3, 0.3].forEach((f) =>
      bench.push({ dims: [0.05, 0.22, 0.05], pos: [bx + Math.cos(ry) * f, 0.29, bz - Math.sin(ry) * f], rotY: ry }),
    );
  }
  g.add(mergedBoxes(t, rails, WHT, { tex: 'wood', rough: 0.85 }));
  g.add(mergedBoxes(t, balusters, WHT, { rough: 0.85 }));
  g.add(mergedBoxes(t, bench, WHT, { tex: 'wood', rough: 0.85 }));

  // ---- STEPS at the open bay (k = 0) --------------------------------------
  {
    const [mx, mz] = bayPos(0);
    const ry = bayRotY(0);
    const ox = mx / Math.hypot(mx, mz);
    const oz = mz / Math.hypot(mx, mz);
    // The flight has to start where the PLINTH ends, not at a guessed offset.
    // `cyl(1.3, 1.36, 0.08, …, seg 6)` is a hexagon whose VERTICES line up with
    // the posts, so in front of a bay you meet a flat FACE at its apothem
    // 1.36·cos(30°) = 1.178, standing 0.08 proud of grade. The old treads were
    // parked at radius 1.269 and 1.469 with a 0.24 depth: the first was buried
    // inside that plinth and the second was a lone plank on the grass, which is
    // what the render showed. Two treads, butted to the plinth face and to each
    // other, each a block standing off grade so it reads as masonry and not as
    // a board — inner tread flush with the plinth top, outer half its height.
    const FACE = 1.36 * Math.cos(Math.PI / 6); // plinth face in front of the bay
    const TREAD = 0.18;
    [
      [0.075, 0.86], // top 0.075 ≈ plinth top 0.08
      [0.038, 0.92],
    ].forEach(([h, w], i) => {
      const out = FACE - Math.hypot(mx, mz) + TREAD * (i + 0.5);
      trim.push({ dims: [w, h, TREAD], pos: [mx + ox * out, h / 2, mz + oz * out], rotY: ry, repeat: [4, 1] });
    });
  }
  g.add(mergedBoxes(t, trim, WHT, { tex: 'wood', rough: 0.85 }));
  g.add(mergedBoxes(t, trimD, WHT_D, { tex: 'wood', rough: 0.88 }));

  // ---- THE ROOF ----------------------------------------------------------
  // The cone is unchanged (base 1.84 = post tops, tip 2.44). What is new is the
  // articulation ON it. `CylinderGeometry(_, _, _, 6)` puts its first vertex at
  // +z and steps by 60°, i.e. at `(r·sin θ, r·cos θ)` — the SAME six directions
  // the posts stand on, so every hip lands directly above a post.
  g.add(cyl(t, 0.03, 1.38, 0.6, TILE, [0, 1.84 + 0.3, 0], { tex: 'fabric', repeat: [10, 2], rough: 0.85, seg: 6, flat: true, bump: 0.04 }));
  // three SHINGLE COURSES: thin 6-gon rings stepping up the cone, each sitting
  // a whisker proud of the slope so it casts a course line from above
  const courseGeo = (rB: number, rT: number) => new t.CylinderGeometry(rT, rB, 0.03, 6);
  const courses: Part[] = [];
  const courseGeos: THREE.BufferGeometry[] = [];
  [0.22, 0.46, 0.7].forEach((u) => {
    const rB = 1.38 - u * (1.38 - 0.03) + 0.012;
    const rT = 1.38 - (u + 0.02) * (1.38 - 0.03) + 0.012;
    const geo = courseGeo(rB, rT);
    courseGeos.push(geo);
    courses.push({ geo, matrix: mtx(t, [0, 1.84 + u * 0.6, 0]) });
  });
  g.add(mergedParts(t, courses, mat(t, TILE_D, { flat: true, rough: 0.85 }), false));
  courseGeos.forEach((geo) => geo.dispose());
  // HIP CAPS: one capping strip up each of the six ridges, eave corner → apex
  const hipGeo = new t.BoxGeometry(0.07, 0.045, 1);
  const hips: Part[] = [];
  for (let k = 0; k < 6; k++) {
    const th = (k / 6) * Math.PI * 2;
    const ex = Math.sin(th) * 1.38;
    const ez = Math.cos(th) * 1.38;
    const from = new t.Vector3(ex, 1.845, ez);
    const dir = new t.Vector3(-ex, 2.43 - 1.845, -ez);
    const len = dir.length();
    const q = new t.Quaternion().setFromUnitVectors(new t.Vector3(0, 0, 1), dir.clone().normalize());
    hips.push({
      geo: hipGeo,
      matrix: new t.Matrix4().compose(from.clone().addScaledVector(dir.clone().normalize(), len / 2), q, new t.Vector3(1, 1, len)),
    });
  }
  g.add(mergedParts(t, hips, mat(t, TILE_D, { flat: true, rough: 0.8 }), false));
  hipGeo.dispose();
  g.add(cyl(t, 1.39, 1.39, 0.06, WHT, [0, 1.87, 0], { tex: 'wood', repeat: [10, 1], rough: 0.85, seg: 6 })); // fascia ring around the eave
  g.add(cyl(t, 1.42, 1.42, 0.035, WHT_D, [0, 1.825, 0], { tex: 'wood', repeat: [10, 1], rough: 0.9, seg: 6 })); // gutter lip under the fascia
  g.add(cyl(t, 0.045, 0.075, 0.14, WHT, [0, 2.4, 0], { tex: 'wood', rough: 0.85, seg: 8 })); // finial neck on the apex
  g.add(ball(t, 0.08, 0xd8b54a, [0, 2.53, 0], { metal: 0.6, rough: 0.35 })); // ball bottom 2.45 = neck top 2.47
  return { group: g };
}

// ---------------------------------------------------------------------------
// 20. hotAirBalloon — tethered; sways, burner glows at night (animated)
// ---------------------------------------------------------------------------
export function hotAirBalloon(t: T): Built {
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
  // crown disc, SEATED: the envelope's own radius is 0.30 at y 2.987, so a disc
  // spanning 2.97→3.03 is buried at its lower rim and proud at its upper one. At
  // y 3.05 it floated clear of a 0.17-wide crown with its rim in open air.
  sway.add(cyl(t, 0.3, 0.3, 0.06, 0xe8c23a, [0, 3.0, 0], { tex: 'fabric', rough: 0.85, seg: 14 }));
  // load ropes: basket rim corners → envelope skin at y 1.3 (radius there ≈ 0.76)
  [
    [1, 1],
    [1, -1],
    [-1, 1],
    [-1, -1],
  ].forEach(([sx, sz]) => sway.add(rod(t, [0.24 * sx, 0.42, 0.24 * sz], [0.5 * sx, 1.32, 0.5 * sz], 0.008, 0xd8cfb8, { rough: 1 })));
  // DETAIL. An envelope is SEWN FROM GORES, and a smooth two-tone sphere is the
  // one thing a hot-air balloon never looks like: eight seam ribs, four of them
  // carrying a contrast gore, plus a second band low on the envelope.
  //
  // A SEAM ON A SPHERE IS A CURVE, AND IT WAS BUILT AS A STRAIGHT ROD. Until
  // 2026-07 each rib was `cyl(0.02, 0.02, 2.1)` parked at a FIXED radius 0.9 —
  // a vertical stick from y 0.9 to y 3.0. The envelope is only 0.9 wide across a
  // narrow band either side of its equator (at y 3.0 it is 0.26, at y 1.0 it is
  // 0.52), so both ends of all eight ribs stood out in clear air and the piece
  // read as a birdcage around a balloon. They are now TUBES SWEPT ALONG THE
  // MERIDIAN of the envelope's own ellipsoid, which is the only curve that stays
  // on the surface, and merged to one draw call (8 → 1).
  const ENV_RXZ = 0.95; // envelope semi-axes: ball(0.95) scaled y by 1.15
  const ENV_RY = 0.95 * 1.15;
  const PROUD = 1.017; // ribs/gores ride this fraction outside the skin
  // φ measured from the top pole. Stop clear of the crown disc at the top and of
  // the throat at the bottom, so a rib never ends in mid-air.
  const PHI_TOP = Math.asin(0.3 / ENV_RXZ); // where the crown disc (r 0.30) caps it
  const PHI_BOT = 2.62; // y ≈ 0.99, inside the throat's shoulder
  const onEnvelope = (phi: number, a: number, k: number) =>
    new t.Vector3(ENV_RXZ * k * Math.sin(phi) * Math.cos(a), 1.95 + ENV_RY * k * Math.cos(phi), ENV_RXZ * k * Math.sin(phi) * Math.sin(a));
  const ribs: { geo: THREE.BufferGeometry; matrix: THREE.Matrix4 }[] = [];
  const gores: { geo: THREE.BufferGeometry; matrix: THREE.Matrix4 }[] = [];
  const scratch: THREE.BufferGeometry[] = [];
  const I4 = new t.Matrix4();
  // A GORE IS A BAND OF THE SURFACE, so it is built as one — a SphereGeometry
  // sector scaled onto the envelope's ellipsoid. Two earlier shapes were wrong
  // for two different reasons:
  //   * a flattened ball at semi-axes 0.942 / 1.083 against the envelope's
  //     0.95 / 1.093 is strictly INSIDE it at every height, so all four contrast
  //     gores were invisible;
  //   * pushed proud, that same lens meets the envelope along the intersection
  //     of two differently-rotated icospheres, which is a ragged curve — the
  //     stripes came out with wobbly edges.
  // A sector shares the envelope's own parameterisation, so its edges are exact
  // meridians. `SphereGeometry` lays x = −cos φ·sin θ, z = sin φ·sin θ, so a
  // panel centred on compass angle c needs φ = π − c.
  const GORE_HALF = (Math.PI / 8) * 0.31; // 62% of a bay, leaving the seams clear
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    // MID-BAY, not on the seam. A gore is the PANEL BETWEEN two seams; centred
    // on `a` its crest sat directly under the rib at the same azimuth, so the
    // dark rib covered the only part of it that stood proud.
    if (i % 2 === 0) {
      const c = a + Math.PI / 8;
      const k = 1.012; // proud of the skin, but LESS so than the ribs (1.017)
      const geo = new t.SphereGeometry(1, 4, 18, Math.PI - c - GORE_HALF, GORE_HALF * 2, PHI_TOP, PHI_BOT - PHI_TOP);
      geo.applyMatrix4(new t.Matrix4().makeScale(ENV_RXZ * k, ENV_RY * k, ENV_RXZ * k));
      geo.translate(0, 1.95, 0);
      scratch.push(geo);
      gores.push({ geo, matrix: I4 });
    }
    const pts: THREE.Vector3[] = [];
    for (let j = 0; j <= 12; j++) pts.push(onEnvelope(PHI_TOP + (PHI_BOT - PHI_TOP) * (j / 12), a, PROUD));
    const geo = new t.TubeGeometry(new t.CatmullRomCurve3(pts), 12, 0.02, 4, false);
    scratch.push(geo);
    ribs.push({ geo, matrix: I4 });
  }
  sway.add(mergedParts(t, gores, mat(t, 0xe8c23a, { tex: 'fabric', repeat: [2, 6], rough: 0.85 }), false));
  sway.add(mergedParts(t, ribs, mat(t, 0x8a2420, { tex: 'fabric', rough: 0.9 }), false));
  scratch.forEach((geo) => geo.dispose());
  // LOWER BAND — read off the envelope at its own two heights for the same
  // reason: at 0.80/0.72 its top edge was buried 0.02 inside the skin while its
  // bottom edge stood 0.03 out, so the band came out ragged instead of level.
  const envR = (y: number) => ENV_RXZ * Math.sqrt(Math.max(0, 1 - ((y - 1.95) / ENV_RY) ** 2));
  sway.add(cyl(t, envR(1.4) * PROUD, envR(1.2) * PROUD, 0.2, 0xe8c23a, [0, 1.3, 0], { tex: 'fabric', repeat: [10, 1], rough: 0.85, seg: 20 })); // lower band
  // a CROWN LINE ring and the vent lines over the top
  const crownRing = new t.Mesh(new t.TorusGeometry(0.31, 0.016, 5, 18), mat(t, 0x8a2420, { tex: 'fabric', rough: 0.9 }));
  crownRing.rotation.x = Math.PI / 2;
  crownRing.position.y = 3.03; // rings the crown disc's top face (3.03), not 0.04 above it
  sway.add(crownRing);
  // basket DETAIL: wicker weave bands, a padded rim and two fuel cylinders
  [0.1, 0.22, 0.34].forEach((y) => sway.add(box(t, [0.52, 0.03, 0.52], 0x7f5c34, [0, y, 0], { tex: 'fabric', repeat: [6, 1], rough: 1 })));
  sway.add(box(t, [0.56, 0.04, 0.56], 0x4a3520, [0, 0.455, 0], { tex: 'fabric', repeat: [5, 1], rough: 1 })); // padded rim
  [-1, 1].forEach((s) => sway.add(cyl(t, 0.07, 0.07, 0.3, 0xb0b4bc, [s * 0.14, 0.3, -0.14], { tex: 'metal', metal: 0.6, rough: 0.4, seg: 10 }))); // fuel cylinders
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

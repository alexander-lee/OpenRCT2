// ---------------------------------------------------------------------------
// Kit/plants.ts — tree · hedge · flowerBed · rock
//
// SPLIT out of index.tsx (2026-07), the same way SceneryPack was split into
// shared/piecesA/piecesB: `write_design_system_files` replaces WHOLE files with
// no patch API, so a module has to fit in one tool call's output, and the
// detailed Kit was 74 KB in one file. Four modules of ~5/29/36/4 KB each push
// independently. Behaviour-neutral — the builders moved verbatim.
// ---------------------------------------------------------------------------

import * as THREE from 'three';
import { box, cyl, ball, mat, mergedBoxes, mergedParts, mtx, hash01, span, basis, BARK, BARK_LIT, WOOD_DARK } from './shared';
import type { T, V3, Part, MergedBoxSpec } from './shared';

// ---------------------------------------------------------------------------
// tree — four shapes. BOUNDS FROZEN (see the header): every part that defines
// an extreme is kept verbatim from the pre-2026-07 builder and all new detail
// is inside it. Detail is added in MERGED batches only.
// ---------------------------------------------------------------------------
export function tree(t: T, opts: { shape?: 'round' | 'pine' | 'palm' | 'willow'; scale?: number } = {}) {
  const shape = opts.shape ?? 'round';
  const g = new t.Group();
  const ROD = new t.CylinderGeometry(1, 1, 1, 6); // unit rod for span(), 6-gon
  const BLOB = new t.IcosahedronGeometry(1, 0); // unit foliage clump, 20 tris
  const bark: Part[] = [];
  const limbs: Part[] = []; // anything reaching OUT of the trunk (see FOOT below)

  // ---- FOOT: a second frozen quantity, and the one that nearly got away -----
  // `<Placed>` derives a PLANTED FOOTPRINT RADIUS (Park/wrappers.tsx
  // `groundFootprintRadius`) for its wet-cell refusal and for
  // `park.registerPlanted`. That function is PER MESH, not per group: it takes
  // the widest XZ span of the meshes whose own min.y is within 0.45 of the
  // asset's base. So batching changes it even when the group AABB does not —
  // the first draft folded a 0.34 root flare and the willow's 0.44-deep tendril
  // curtain into the same merged mesh as the trunk and the derived radius went
  // 0.20 → 0.355 (round) and 0.18 → 0.635 (willow), which is a silent change to
  // a downstream contract.
  //
  // So the FOOT batch (trunk + flare + buttresses + ridges) is held to each
  // shape's ORIGINAL trunk half-span, and anything wider than that — pine's
  // branch stubs, willow's limbs — goes in a batch whose own min.y is clear of
  // the 0.45 band. The flare still READS because the trunk was slimmed to make
  // room for it inside the same span, rather than the flare being pushed out.
  //   round 0.20 · pine 0.16 · palm 0.12 · willow 0.18
  /** root FLARE + radiating BUTTRESS roots. `reach + thick` must equal the
   *  shape's FOOT budget, and every buttress end stays at y ≥ 0.048 so its
   *  lowest vertex never dips below the frozen y-min. */
  const rootKit = (flareTop: number, flareR: number, trunkR: number, n: number, reach: number, footY: number, thick = 0.045) => {
    bark.push({
      geo: new t.CylinderGeometry(trunkR + 0.02, flareR, flareTop, 12),
      matrix: mtx(t, [0, flareTop / 2, 0]),
    });
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + 0.4;
      bark.push(
        span(
          t,
          ROD,
          [Math.cos(a) * trunkR * 0.5, flareTop + 0.1, Math.sin(a) * trunkR * 0.5],
          [Math.cos(a) * reach, footY, Math.sin(a) * reach],
          thick,
        ),
      );
    }
  };
  /** vertical bark RIDGES rooted in the trunk surface — pure azimuth, no tilt,
   *  so there is no frame to get wrong */
  const ridges = (n: number, r: number, y: number, h: number) => {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      bark.push({ geo: new t.BoxGeometry(0.032, h, 0.032), matrix: mtx(t, [Math.cos(a) * r, y, Math.sin(a) * r], [0, -a, 0]) });
    }
  };

  if (shape === 'pine') {
    // VERBATIM: trunk 0→1.0 pins y-min 0; the four 8-gon cones pin x/z ±0.55
    // (cone 0's rBot) and y-max 2.46 (cone 3's tip at 1.96+0.5).
    // trunk slimmed 0.16 → 0.12 at the foot so the 0.16 flare reads INSIDE the
    // frozen 0.16 FOOT budget (the trunk radius never touched the group AABB —
    // cone 0's rBot 0.55 owns x/z)
    bark.push({ geo: new t.CylinderGeometry(0.08, 0.12, 1.0, 12), matrix: mtx(t, [0, 0.5, 0]) });
    rootKit(0.2, 0.16, 0.12, 5, 0.115, 0.075); // 0.115 + 0.045 = 0.16 exactly
    ridges(6, 0.095, 0.5, 0.92); // trunk r at y 0.5 is 0.10 — bedded, max 0.118
    // DEAD BRANCH STUBS on the bare 0→0.7 of trunk below the lowest tier — the
    // only exposed wood, so the detail that reads at park distance. Their own
    // batch, and no lower than 0.56: reaching 0.328 they would blow the 0.16
    // FOOT budget if they shared the trunk's mesh, and their min.y 0.462 keeps
    // them out of groundFootprintRadius' 0.45 band.
    [0.56, 0.63, 0.69].forEach((y, i) => {
      const a = i * 2.3;
      limbs.push(span(t, ROD, [0, y, 0], [Math.cos(a) * 0.3, y - 0.07, Math.sin(a) * 0.3], 0.028));
    });
    const dark: Part[] = [];
    const lit: Part[] = [];
    for (let i = 0; i < 4; i++) {
      const rBot = 0.55 - i * 0.12;
      dark.push({ geo: new t.CylinderGeometry(0.02, rBot, 0.5, 8), matrix: mtx(t, [0, 0.95 + i * 0.42, 0]) }); // VERBATIM
      // a SECOND, lighter tier nested above each bough: 1.02+0.42i ± 0.15, so
      // the top one reaches 2.43 — inside the frozen 2.46 — and its rBot is
      // 0.7× the bough's, inside the frozen ±0.55.
      lit.push({ geo: new t.CylinderGeometry(0.02, rBot * 0.7, 0.3, 8), matrix: mtx(t, [0, 1.02 + i * 0.42, 0]) });
    }
    g.add(mergedParts(t, dark, mat(t, 0x2b6030, { tex: 'leaf', repeat: [3, 2], flat: true, rough: 1 }), false));
    g.add(mergedParts(t, lit, mat(t, 0x3d7d3a, { tex: 'leaf', repeat: [3, 2], flat: true, rough: 1 }), false));
  } else if (shape === 'palm') {
    // VERBATIM: six trunk segments (segment 0's rotZ −0.05 tilt pins y-min
    // −0.055), the seven frond blades (they pin x −0.84 / 0.88 and z ±0.882)
    // and the crown ball (its top pins y-max 1.82).
    for (let s = 0; s < 6; s++)
      bark.push({
        geo: new t.CylinderGeometry(0.08, 0.1, s === 0 ? 0.34 : 0.28, 10),
        matrix: mtx(t, [0, s === 0 ? 0.12 : 0.15 + s * 0.26, 0], [0, 0, 0.05 * (s % 2 ? 1 : -1)]),
      });
    // boot flare: bottom 0.10 − 0.15 = −0.05, a whisker ABOVE the frozen
    // −0.055, so the tilted first segment still owns y-min. rBot 0.12 is the
    // palm's whole FOOT budget (its old per-mesh footprint radius was the 0.12
    // floor `groundFootprintRadius` clamps to), so there are no buttress roots
    // here — a palm's signature at the base is the boot and the leaf scars, not
    // buttressing, and prop roots reaching 0.30 would have tripled the footprint.
    bark.push({ geo: new t.CylinderGeometry(0.105, 0.12, 0.3, 12), matrix: mtx(t, [0, 0.1, 0]) });
    // RING SCARS at the five segment joints — a palm trunk is a stack of leaf
    // scars, and it is the only thing that tells it apart from a pipe
    [0.28, 0.54, 0.8, 1.06, 1.32].forEach((y, i) =>
      bark.push({ geo: new t.CylinderGeometry(0.113, 0.113, 0.035, 10), matrix: mtx(t, [0, y, 0], [0, 0, 0.02 * (i % 2 ? 1 : -1)]) }),
    );
    const DROOP = -0.35;
    const cd = Math.cos(DROOP);
    const sd = Math.sin(DROOP);
    const blades: Part[] = [];
    const leaflets: Part[] = [];
    const BLADE = new t.BoxGeometry(0.9, 0.04, 0.22);
    const LEAF1 = new t.BoxGeometry(1, 1, 1);
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2;
      const ca = Math.cos(a);
      const sa = Math.sin(a);
      const C: V3 = [ca * 0.45, 1.62, sa * 0.45];
      blades.push({ geo: BLADE, matrix: mtx(t, C, [0, 0, 0]) }); // placeholder, replaced below
      blades[blades.length - 1].matrix = new t.Matrix4().compose(
        new t.Vector3(...C),
        new t.Quaternion().setFromEuler(new t.Euler(0, -a, DROOP, 'XYZ')),
        new t.Vector3(1, 1, 1),
      );
      // THE FROND FRAME, derived rather than typed. The blade carries rotY −a
      // AND rotZ −0.35 and Euler 'XYZ' composes as Ry·Rz here, so its own axes
      // are Ry(−a)·Rz(−0.35) applied to the unit axes. Everything riding ON the
      // blade is placed in THAT basis; an azimuth plus a tilt would land about
      // world X and leave half the leaflets in open air.
      const ex = new t.Vector3(cd * ca, sd, cd * sa); // along the blade, outward
      const ey = new t.Vector3(-sd * ca, cd, -sd * sa); // blade normal, up
      const ez = new t.Vector3(-sa, 0, ca); // across the blade
      const at = (u: number, v: number, w: number): V3 => [
        C[0] + ex.x * u + ey.x * v + ez.x * w,
        C[1] + ex.y * u + ey.y * v + ez.y * w,
        C[2] + ex.z * u + ey.z * v + ez.z * w,
      ];
      // MIDRIB, |u| ≤ 0.40: the blade's own reach along ex is 0.45, so a rib
      // stopping at 0.40 with radius 0.018 tops out at x 0.853 (frond 0) and
      // y 1.800 — both inside the frozen 0.88 / 1.82.
      blades.push(span(t, ROD, at(-0.4, 0.026, 0), at(0.4, 0.026, 0), 0.018));
      // LEAFLETS hanging under the OUTER half only (u 0.02…0.32). Their
      // half-diagonal is 0.083, so the farthest vertex is 0.403 from C along
      // ex — inside the blade's own 0.4296 x-contribution — and they hang
      // BELOW the blade plane, which is what keeps them clear of y 1.82.
      for (let k = 0; k < 4; k++) {
        const u = 0.02 + k * 0.1;
        [-1, 1].forEach((s) => {
          const root = at(u, -0.006, s * 0.05);
          const tip = at(u + 0.055, -0.05, s * 0.135);
          leaflets.push({
            geo: LEAF1,
            matrix: basis(
              t,
              [(root[0] + tip[0]) / 2, (root[1] + tip[1]) / 2, (root[2] + tip[2]) / 2],
              new t.Vector3(tip[0] - root[0], tip[1] - root[1], tip[2] - root[2]),
              ey,
              [0.13, 0.014, 0.09],
            ),
          });
        });
      }
      // DROOPING TIP: the blade ends square; a real frond curls over. Built
      // from its two endpoints, tip 0.42 along ex then 0.16 straight down.
      const tipRoot = at(0.36, 0.0, 0);
      leaflets.push(span(t, ROD, tipRoot, [at(0.42, 0, 0)[0], at(0.42, 0, 0)[1] - 0.16, at(0.42, 0, 0)[2]], 0.02));
    }
    g.add(mergedParts(t, blades, mat(t, 0x4f9a3a, { tex: 'leaf', repeat: [3, 1], flat: true, rough: 1 }), false));
    g.add(mergedParts(t, leaflets, mat(t, 0x3e7d2e, { tex: 'leaf', repeat: [2, 1], flat: true, rough: 1 }), false));
    BLADE.dispose();
    LEAF1.dispose();
    // crown ball VERBATIM (pins y-max 1.82) + a COCONUT cluster under it and
    // the fibrous frond BOOT the blades spring from
    // detail 1, not the old builder's smooth detail 3: an icosahedron reaches
    // its nominal radius at the poles from detail 1 up, so y-max stays exactly
    // 1.82 — and 1280 triangles become 80 on the tree shape that is scattered
    // hardest. Measured, not assumed (probe-kit-cost prints the AABB).
    const husk: Part[] = [{ geo: new t.IcosahedronGeometry(0.12, 1), matrix: mtx(t, [0, 1.7, 0]) }];
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + 0.7;
      husk.push({ geo: BLOB, matrix: mtx(t, [Math.cos(a) * 0.14, 1.6, Math.sin(a) * 0.14], [0, a, 0], [0.075, 0.065, 0.075]) });
    }
    husk.push({ geo: new t.CylinderGeometry(0.16, 0.11, 0.16, 10), matrix: mtx(t, [0, 1.6, 0]) });
    g.add(mergedParts(t, husk, mat(t, 0x7a5a2a, { tex: 'wood', repeat: [2, 1], rough: 0.85 }), false));
  } else if (shape === 'willow') {
    // VERBATIM: trunk 0→1.0 pins y-min; the ten 6-gon tendrils at radius 0.6
    // pin x ±0.635 / z ±0.611; the r 0.6 canopy ball at 1.5 pins y-max 2.1.
    bark.push({ geo: new t.CylinderGeometry(0.1, 0.14, 1.0, 12), matrix: mtx(t, [0, 0.5, 0]) }); // slimmed to make room for the flare
    rootKit(0.2, 0.18, 0.14, 5, 0.135, 0.075); // 0.135 + 0.045 = 0.18 exactly
    ridges(6, 0.11, 0.5, 0.9); // trunk r at y 0.5 is 0.12 — bedded, max 0.133
    // three LIMBS lifting out of the trunk crown into the canopy, each built
    // from the two points it joins (trunk axis → a point inside the ball). Own
    // batch: they reach 0.385, past the 0.18 FOOT budget, and their min.y 0.815
    // is clear of groundFootprintRadius' 0.45 band.
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2 + 0.5;
      limbs.push(span(t, ROD, [0, 0.86, 0], [Math.cos(a) * 0.34, 1.32, Math.sin(a) * 0.34], 0.045));
    }
    const tend: Part[] = [];
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      tend.push({ geo: new t.CylinderGeometry(0.04, 0.02, 0.9, 6), matrix: mtx(t, [Math.cos(a) * 0.6, 1.15, Math.sin(a) * 0.6]) }); // VERBATIM
    }
    // A CURTAIN, not ten sticks: two more rings inside the frozen radius, at
    // hashed lengths. Outermost added ring is at 0.55 + its 0.035 hex radius =
    // 0.585, inside the frozen 0.611 z-min.
    //
    // Each ring is anchored by its TOP and its length capped so the LOWEST
    // tendril bottom is 0.55. Hashing the length about a fixed centre let one
    // reach y 0.398, which put the whole 0.635-radius curtain inside
    // groundFootprintRadius' 0.45 band and took the willow's derived planted
    // footprint from 0.18 to 0.635 — a tree suddenly claiming a 1.27 u circle
    // of dry ground.
    [
      [0.55, 14, 1.58, 0.8, 1.03],
      [0.38, 10, 1.55, 0.7, 0.95],
    ].forEach(([r, n, topY, hMin, hMax], ring) => {
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + 0.31 * (ring + 1);
        const hh = hMin + hash01(i * 7 + ring * 31) * (hMax - hMin);
        tend.push({ geo: new t.CylinderGeometry(0.035, 0.014, hh, 6), matrix: mtx(t, [Math.cos(a) * r, topY - hh / 2, Math.sin(a) * r]) });
      }
    });
    g.add(mergedParts(t, tend, mat(t, 0x7a9a3a, { tex: 'leaf', repeat: [1, 3], flat: true, rough: 1 }), false));
    g.add(ball(t, 0.6, 0x86a84a, [0, 1.5, 0], { tex: 'leaf', repeat: [3, 3], flat: true, rough: 1 })); // VERBATIM
    // CROWN LUMPS. Placed at 0.6 r from the ball centre with their own radius
    // 0.3 r, so 0.6r + 0.3r = 0.9r < r: provably inside the parent sphere, so
    // the frozen ±0.6 / 2.1 cannot move.
    const lumps: Part[] = [];
    for (let i = 0; i < 7; i++) {
      const a = hash01(i * 13 + 2) * Math.PI * 2;
      const p = Math.acos(1 - 2 * (0.15 + hash01(i * 13 + 5) * 0.55));
      lumps.push({
        geo: BLOB,
        matrix: mtx(
          t,
          [Math.sin(p) * Math.cos(a) * 0.36, 1.5 + Math.cos(p) * 0.36, Math.sin(p) * Math.sin(a) * 0.36],
          [0, a, 0],
          [0.18, 0.15, 0.18],
        ),
      });
    }
    g.add(mergedParts(t, lumps, mat(t, 0x9ab857, { tex: 'leaf', repeat: [2, 2], flat: true, rough: 1 }), false));
  } else {
    // ---- round: VERBATIM canopy. The six balls pin every extreme —
    // x −1.0 (B1) / 1.05 (B2), y 2.4 (B3), z −0.9 (B4) / 0.86 (B5) — and the
    // trunk pins y-min 0. They are the SAME six balls, only merged into two
    // tone batches instead of six loose draws.
    const CANOPY: [number, number, number, number][] = [
      [0, 1.55, 0, 0.74],
      [-0.5, 1.36, 0.18, 0.5],
      [0.5, 1.42, -0.12, 0.55],
      [0.12, 1.9, 0, 0.5],
      [-0.2, 1.55, -0.45, 0.45],
      [0.35, 1.6, 0.4, 0.46],
    ];
    bark.push({ geo: new t.CylinderGeometry(0.12, 0.15, 1.1, 12), matrix: mtx(t, [0, 0.55, 0]) }); // slimmed to make room for the flare
    rootKit(0.22, 0.2, 0.15, 5, 0.155, 0.075); // 0.155 + 0.045 = 0.20 exactly
    ridges(6, 0.128, 0.52, 0.95); // trunk r at y 0.52 is 0.136 — bedded, max 0.151
    const shade: Part[] = [];
    const sun: Part[] = [];
    const lumps: Part[] = [];
    CANOPY.forEach(([x, y, z, r], i) => {
      const geo = new t.IcosahedronGeometry(r, 1);
      (i === 0 || i === 1 || i === 4 ? shade : sun).push({ geo, matrix: mtx(t, [x, y, z]) });
      // two FOLIAGE LUMPS per ball at 0.62 r out with radius 0.3 r: 0.92 r < r,
      // so each lump is provably inside its parent sphere and no extreme moves
      for (let k = 0; k < 2; k++) {
        const a = hash01(i * 17 + k * 5 + 1) * Math.PI * 2;
        const p = Math.acos(1 - 2 * (0.2 + hash01(i * 17 + k * 5 + 3) * 0.6));
        lumps.push({
          geo: BLOB,
          matrix: mtx(
            t,
            [x + Math.sin(p) * Math.cos(a) * r * 0.62, y + Math.cos(p) * r * 0.62, z + Math.sin(p) * Math.sin(a) * r * 0.62],
            [0, a, 0],
            [r * 0.3, r * 0.26, r * 0.3],
          ),
        });
      }
    });
    g.add(mergedParts(t, shade, mat(t, 0x5c7d2e, { tex: 'leaf', repeat: [3, 3], flat: true, rough: 1 }), false));
    g.add(mergedParts(t, sun, mat(t, 0x86a84a, { tex: 'leaf', repeat: [3, 3], flat: true, rough: 1 }), false));
    g.add(mergedParts(t, lumps, mat(t, 0x9cba58, { tex: 'leaf', repeat: [2, 2], flat: true, rough: 1 }), false));
  }
  g.add(mergedParts(t, bark, mat(t, BARK, { tex: 'wood', repeat: [3, 3], rough: 1 }), false));
  if (limbs.length) g.add(mergedParts(t, limbs, mat(t, BARK_LIT, { tex: 'wood', repeat: [2, 2], rough: 1 }), false));
  ROD.dispose();
  BLOB.dispose();
  if (opts.scale) g.scale.setScalar(opts.scale);
  return g;
}

// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// hedge — a CLIPPED hedge: woody base course, battered flanks, a rolled crown
// and foliage lumps in three tones. Was one textured box.
// ---------------------------------------------------------------------------
export function hedge(t: T, len = 2) {
  const g = new t.Group();
  const rx = Math.max(2, Math.round(len * 3));
  const dark: MergedBoxSpec[] = [
    { dims: [len, 0.14, 0.5], pos: [0, 0.07, 0], repeat: [rx, 1] }, // base course 0→0.14, the widest band
    { dims: [len, 0.44, 0.46], pos: [0, 0.35, 0], repeat: [rx, 3] }, // body 0.13→0.57, battered in 0.02/side
    { dims: [len, 0.14, 0.38], pos: [0, 0.56, 0], repeat: [rx, 1] }, // crown 0.49→0.63
  ];
  // clipped END faces + the corner returns that stop it looking sawn off
  [-1, 1].forEach((s) => dark.push({ dims: [0.04, 0.5, 0.44], pos: [(s * (len - 0.04)) / 2, 0.3, 0], repeat: [1, 2] }));
  g.add(mergedBoxes(t, dark, 0x2f5624, { tex: 'leaf', repeat: [1, 1], flat: true, rough: 1, bump: 0.06 }));
  // WOODY STEMS visible under the skirt — a hedge grows out of a row of stems
  const stems: Part[] = [];
  const stemGeo = new t.CylinderGeometry(0.022, 0.03, 0.16, 6);
  const n = Math.max(3, Math.round(len / 0.28));
  for (let i = 0; i < n; i++)
    stems.push({ geo: stemGeo, matrix: mtx(t, [-len / 2 + (len * (i + 0.5)) / n, 0.08, (hash01(i * 7 + 3) - 0.5) * 0.22]) });
  g.add(mergedParts(t, stems, mat(t, WOOD_DARK, { tex: 'wood', rough: 1 }), false));
  stemGeo.dispose();
  // FOLIAGE LUMPS on both long faces and the crown, in two greens: the read
  // that turns a green box into clipped box hedge at park distance
  const BLOB = new t.IcosahedronGeometry(1, 0);
  const litA: Part[] = [];
  const litB: Part[] = [];
  const m = Math.max(6, Math.round(len * 7));
  // Each lump is sunk into the mass it grows out of, so the clipped SILHOUETTE
  // survives: a crown lump at y 0.60 with vertical half-extent 0.7 s ≤ 0.10 tops
  // out at exactly 0.70, and a face lump at |z| = 0.20 − 0.45 s reaches at most
  // 0.20 + 0.55 · 0.13 = 0.272 against the 0.25 face — a bulge, not a bush.
  for (let i = 0; i < m; i++) {
    const x = -len / 2 + 0.1 + (len - 0.2) * hash01(i * 11 + 1);
    const face = hash01(i * 11 + 4);
    const s = 0.08 + hash01(i * 11 + 7) * 0.05;
    const pos: V3 =
      face > 0.55
        ? [x, 0.6 - hash01(i * 11 + 9) * 0.03, (hash01(i * 11 + 2) - 0.5) * 0.3]
        : [x, 0.2 + hash01(i * 11 + 9) * 0.32, (face < 0.275 ? -1 : 1) * (0.2 - 0.45 * s)];
    (i % 2 ? litA : litB).push({ geo: BLOB, matrix: mtx(t, pos, [0, hash01(i * 11 + 6) * 3, 0], [s, s * 0.7, s]) });
  }
  g.add(mergedParts(t, litA, mat(t, 0x3c6b2e, { tex: 'leaf', repeat: [2, 2], flat: true, rough: 1 }), false));
  g.add(mergedParts(t, litB, mat(t, 0x527f34, { tex: 'leaf', repeat: [2, 2], flat: true, rough: 1 }), false));
  BLOB.dispose();
  return g;
}

// ---------------------------------------------------------------------------
// flowerBed — a TIMBER SLEEPER bed of real plants.
//
// REBUILT (2026-07): it was 50 meshes of lollipop — a 0.005-radius stem (under
// a pixel at park scale, so invisible) carrying a bare 0.05 ball, 24 of them
// all at exactly y 0.40, which read as sweets floating over a green mat. Same
// defect planterBox had, same fix: a MASONRY-grade frame (sleepers, corner
// posts, capping rail), and a plant that is a visible stem + a FOLIAGE mound +
// blossoms sitting ON that foliage, with hashed height/scale/jitter and a fifth
// of the slots left empty so the bed is not a lattice. 50 meshes → 8 batches.
// ---------------------------------------------------------------------------
export function flowerBed(t: T) {
  const g = new t.Group();
  const timber: MergedBoxSpec[] = [];
  // sleepers 0→0.22 · capping rail 0.22→0.27 (overhangs 0.02) · posts 0→0.30
  [-1, 1].forEach((s) => {
    timber.push({ dims: [1.2, 0.22, 0.14], pos: [0, 0.11, s * 0.53], repeat: [4, 1] });
    timber.push({ dims: [0.14, 0.22, 0.92], pos: [s * 0.53, 0.11, 0], repeat: [3, 1] });
    timber.push({ dims: [1.24, 0.05, 0.18], pos: [0, 0.245, s * 0.53], repeat: [4, 1] });
    timber.push({ dims: [0.18, 0.05, 0.96], pos: [s * 0.53, 0.245, 0], repeat: [3, 1] });
    [-1, 1].forEach((q) => timber.push({ dims: [0.17, 0.3, 0.17], pos: [s * 0.515, 0.15, q * 0.515], repeat: [1, 1] }));
  });
  g.add(mergedBoxes(t, timber, 0x6a4a2c, { tex: 'wood', rough: 1, bump: 0.03 }));
  // post CAPS, chamfered, in one batch
  const capGeo = new t.CylinderGeometry(0.1, 0.125, 0.05, 4);
  const caps: Part[] = [];
  [-1, 1].forEach((s) => [-1, 1].forEach((q) => caps.push({ geo: capGeo, matrix: mtx(t, [s * 0.515, 0.325, q * 0.515], [0, Math.PI / 4, 0]) })));
  g.add(mergedParts(t, caps, mat(t, WOOD_DARK, { tex: 'wood', rough: 0.95 }), false));
  capGeo.dispose();
  g.add(box(t, [0.92, 0.16, 0.92], 0x4a3520, [0, 0.14, 0], { tex: 'concrete', repeat: [4, 4], rough: 1, bump: 0.04 })); // soil 0.06→0.22, under the rail
  const stems: Part[] = [];
  const folA: Part[] = [];
  const folB: Part[] = [];
  const blooms: Part[][] = [[], [], []];
  const BLOB = new t.IcosahedronGeometry(1, 0);
  const BUD = new t.IcosahedronGeometry(1, 1);
  const STEM = new t.CylinderGeometry(1, 1, 1, 5);
  for (let i = 0; i < 25; i++) {
    if (hash01(i * 9 + 31) < 0.2) continue; // a fifth of the slots stay empty
    const gx = (i % 5) - 2;
    const gz = Math.floor(i / 5) - 2;
    const x = gx * 0.19 + (hash01(i * 9 + 1) - 0.5) * 0.11;
    const z = gz * 0.19 + (hash01(i * 9 + 2) - 0.5) * 0.11;
    const h = 0.1 + hash01(i * 9 + 3) * 0.11; // stem 0.22 → 0.22+h
    const s = 0.75 + hash01(i * 9 + 4) * 0.5;
    stems.push({ geo: STEM, matrix: mtx(t, [x, 0.22 + h / 2, z], [0, 0, 0], [0.011, h, 0.011]) });
    // FOLIAGE mound swallowing the stem top, then blossoms sitting ON it
    const fy = 0.22 + h;
    (i % 2 ? folA : folB).push({ geo: BLOB, matrix: mtx(t, [x, fy - 0.01, z], [0, hash01(i * 9 + 5) * 3, 0], [0.075 * s, 0.05 * s, 0.075 * s]) });
    const nb = 1 + (hash01(i * 9 + 6) > 0.45 ? 1 : 0);
    for (let k = 0; k < nb; k++) {
      const a = hash01(i * 9 + 7 + k) * Math.PI * 2;
      const d = k === 0 ? 0 : 0.045;
      blooms[Math.floor(hash01(i * 9 + 11 + k) * 3) % 3].push({
        geo: BUD,
        matrix: mtx(t, [x + Math.cos(a) * d, fy + 0.026 * s, z + Math.sin(a) * d], [0, a, 0], [0.036 * s, 0.03 * s, 0.036 * s]),
      });
    }
  }
  // two TRAILING SPRAYS spilling over the capping rail
  [
    [0.42, 0.42],
    [-0.46, -0.3],
  ].forEach(([x, z], i) => {
    for (let k = 0; k < 4; k++) {
      const f = k / 3;
      folA.push({
        geo: BLOB,
        matrix: mtx(t, [x * (1 + f * 0.22), 0.26 - f * 0.14, z * (1 + f * 0.22)], [0, i * 2 + k, 0], [0.06 - f * 0.02, 0.035, 0.06 - f * 0.02]),
      });
    }
  });
  g.add(mergedParts(t, stems, mat(t, 0x2f6a34, { rough: 0.9 }), false));
  g.add(mergedParts(t, folA, mat(t, 0x3c6b2e, { tex: 'leaf', repeat: [2, 2], flat: true, rough: 1 }), false));
  g.add(mergedParts(t, folB, mat(t, 0x59873a, { tex: 'leaf', repeat: [2, 2], flat: true, rough: 1 }), false));
  [0xe23a3a, 0xf0d000, 0xe060a0].forEach((c, i) => g.add(mergedParts(t, blooms[i], mat(t, c, { flat: true, rough: 0.7 }), false)));
  BLOB.dispose();
  BUD.dispose();
  STEM.dispose();
  return g;
}

// ---------------------------------------------------------------------------
// rock — a bedded boulder group with scree and moss.
// ---------------------------------------------------------------------------
export function rock(t: T, scale = 1) {
  const g = new t.Group();
  const dark: Part[] = [];
  const lit: Part[] = [];
  const crev: MergedBoxSpec[] = [];
  const centres: V3[] = [];
  for (let i = 0; i < 5; i++) {
    const r = 0.25 + hash01(i * 5 + 1) * 0.25;
    // rest height tied to the radius: a boulder squashed to 0.7 with its centre
    // at 0.52 r has its underside at 0.52r − 0.7r = −0.18r, so every stone is
    // bedded IN the ground and never floating
    const c: V3 = [(hash01(i * 5 + 2) - 0.5) * 0.5, r * 0.52, (hash01(i * 5 + 3) - 0.5) * 0.5];
    centres.push(c);
    (i % 2 ? lit : dark).push({
      geo: new t.IcosahedronGeometry(r, 1),
      matrix: mtx(t, c, [0, hash01(i * 5 + 4) * 3, hash01(i * 5 + 6) * 0.3], [1, 0.7, 1]),
    });
    // a CREVICE sliver in the seam between consecutive boulders — the dark line
    // that stops five overlapping spheres reading as one grey blob
    if (i > 0) {
      const p = centres[i - 1];
      crev.push({
        dims: [Math.hypot(c[0] - p[0], c[2] - p[2]) * 0.9, r * 0.5, 0.03],
        pos: [(c[0] + p[0]) / 2, (c[1] + p[1]) / 2, (c[2] + p[2]) / 2],
        rotY: -Math.atan2(c[2] - p[2], c[0] - p[0]),
      });
    }
  }
  // SCREE: eight small angular chips bedded round the feet, so the group sits
  // in scree instead of on a lawn. Centre y = 0.6·r ⇒ underside −0.4·r.
  const chip = new t.IcosahedronGeometry(1, 0);
  const scree: Part[] = [];
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + 0.4;
    const d = 0.42 + hash01(i * 7 + 2) * 0.22;
    const r = 0.05 + hash01(i * 7 + 5) * 0.05;
    scree.push({ geo: chip, matrix: mtx(t, [Math.cos(a) * d, r * 0.6, Math.sin(a) * d], [0, a, 0.2], [r * 1.3, r, r * 1.1]) });
  }
  // MOSS draped on the sunlit crowns — flattened patches, each keyed to a
  // boulder's own top so it lies ON the stone
  const moss: Part[] = [];
  centres.forEach((c, i) => {
    if (i % 2) return;
    const r = 0.25 + hash01(i * 5 + 1) * 0.25;
    for (let k = 0; k < 2; k++) {
      const a = hash01(i * 3 + k * 7 + 1) * Math.PI * 2;
      moss.push({
        geo: chip,
        matrix: mtx(t, [c[0] + Math.cos(a) * r * 0.4, c[1] + r * 0.62, c[2] + Math.sin(a) * r * 0.4], [0, a, 0], [r * 0.42, r * 0.1, r * 0.36]),
      });
    }
  });
  g.add(mergedParts(t, dark, mat(t, 0x76746c, { tex: 'concrete', repeat: [2, 2], flat: true, rough: 1 }), false));
  g.add(mergedParts(t, lit, mat(t, 0x9a988f, { tex: 'concrete', repeat: [2, 2], flat: true, rough: 1 }), false));
  g.add(mergedBoxes(t, crev, 0x4a483f, { rough: 1 }));
  g.add(mergedParts(t, scree, mat(t, 0x8a8880, { tex: 'concrete', flat: true, rough: 1 }), false));
  g.add(mergedParts(t, moss, mat(t, 0x5a7a34, { tex: 'leaf', repeat: [2, 2], flat: true, rough: 1 }), false));
  chip.dispose();
  g.scale.setScalar(scale);
  return g;
}


// ---------------------------------------------------------------------------
// Kit/props.ts — bench · bin · statue · foodStall · fence · lamp · fountain
//
// SPLIT out of index.tsx (2026-07), the same way SceneryPack was split into
// shared/piecesA/piecesB: `write_design_system_files` replaces WHOLE files with
// no patch API, so a module has to fit in one tool call's output, and the
// detailed Kit was 74 KB in one file. Four modules of ~5/29/36/4 KB each push
// independently. Behaviour-neutral — the builders moved verbatim.
// ---------------------------------------------------------------------------

import * as THREE from 'three';
import { box, cyl, mat, mergedBoxes, mergedParts, mtx, hash01, span, basis, STONE, STONE_LIT, MARBLE, IRON, WOOD, WOOD_DARK, LEAF, BRASS } from './shared';
import type { T, V3, Part, MergedBoxSpec } from './shared';

// ---------------------------------------------------------------------------
// bench — cast-iron ends, slatted seat and back. BOUNDS FROZEN
// [-0.5, -0.01, -0.3] → [0.5, 0.87, 0.22]; backrest at −z so the seat looks
// down local +z (SetPieceKit's setPieceBench contract).
// ---------------------------------------------------------------------------
export function bench(t: T) {
  const g = new t.Group();
  const wood: MergedBoxSpec[] = [];
  const iron: MergedBoxSpec[] = [];
  // SEAT: four slats with shadow gaps instead of three fat boards, spanning
  // z −0.22…0.22 — the front slat's front face IS the frozen z-max 0.22.
  [-0.1775, -0.0592, 0.0592, 0.1775].forEach((z) => wood.push({ dims: [1.0, 0.045, 0.085], pos: [0, 0.4, z], repeat: [5, 1] }));
  // BACK: four slats + a moulded top rail whose top face IS the frozen y-max
  // 0.87 (0.835 + 0.035). All at z −0.24, inboard of the frame's −0.30.
  [0.55, 0.635, 0.72].forEach((y) => wood.push({ dims: [1.0, 0.065, 0.04], pos: [0, y, -0.24], repeat: [5, 1] }));
  wood.push({ dims: [1.0, 0.07, 0.05], pos: [0, 0.835, -0.2375], repeat: [5, 1] }); // top rail 0.80→0.87
  wood.push({ dims: [1.0, 0.03, 0.022], pos: [0, 0.79, -0.216], repeat: [5, 1] }); // bead under the rail
  [-0.42, 0.42].forEach((x) => {
    // The end was ONE solid 0.06 × 0.42 × 0.5 black plate — from the side it
    // read as a filing cabinet. It is an open iron frame now, and the union of
    // its legs still owns the frozen z −0.30 (rear leg back face) and
    // y −0.01 (leg bottoms), so nothing moved.
    iron.push({ dims: [0.055, 0.42, 0.075], pos: [x, 0.2, 0.1625] }); // front leg, z 0.125→0.20
    iron.push({ dims: [0.055, 0.42, 0.075], pos: [x, 0.2, -0.2625] }); // rear leg, z −0.30→−0.225
    // FOOT pads, y −0.0095→0.0255 (the legs still own the frozen y-min −0.01).
    // The rear pad is centred at −0.25, not under the leg at −0.2625: a 0.1-deep
    // pad there reached z −0.3125 and MOVED the frozen z-min −0.30.
    iron.push({ dims: [0.09, 0.035, 0.1], pos: [x, 0.008, 0.15] });
    iron.push({ dims: [0.09, 0.035, 0.1], pos: [x, 0.008, -0.25] });
    iron.push({ dims: [0.05, 0.05, 0.5], pos: [x, 0.355, -0.05] }); // seat rail tying the legs
    // DIAGONAL BRACE, rear leg foot (z −0.2625, y 0.06) → front leg head
    // (z 0.1625, y 0.36): dz 0.425, dy 0.30, so L 0.520 and rotX = atan2(dz, dy)
    // = 0.955 (rotX θ sends local +Y to (0, cos θ, sin θ), and it is the ONLY
    // rotation on this part, so there is no azimuth for it to compose against).
    // A 0.16 × 0.16 slab at rotX 0.5 was the first draft and read as a loose
    // black flap hanging inside the frame.
    iron.push({ dims: [0.04, 0.52, 0.04], pos: [x, 0.21, -0.05], rotX: 0.955 });
    iron.push({ dims: [0.05, 0.44, 0.05], pos: [x, 0.6, -0.245] }); // back stile 0.38→0.82
    // ARMREST: a wooden cap on an iron stay, front end over the seat front
    iron.push({ dims: [0.045, 0.13, 0.045], pos: [x, 0.48, 0.145] });
    wood.push({ dims: [0.075, 0.045, 0.42], pos: [x, 0.565, -0.045], repeat: [1, 2] }); // arm 0.5425→0.5875
    wood.push({ dims: [0.075, 0.05, 0.075], pos: [x, 0.6, 0.145], repeat: [1, 1] }); // arm nose knuckle
  });
  g.add(mergedBoxes(t, wood, WOOD, { tex: 'wood', rough: 0.8, bump: 0.03 }));
  g.add(mergedBoxes(t, iron, IRON, { tex: 'metal', metal: 0.6, rough: 0.5 }));
  // BOLT HEADS at the eight frame joints, in one batch of their own
  const boltGeo = new t.IcosahedronGeometry(0.018, 1);
  const bolts: Part[] = [];
  [-0.42, 0.42].forEach((x) => [0.4, 0.6].forEach((y) => [-0.24, 0.16].forEach((z) => bolts.push({ geo: boltGeo, matrix: mtx(t, [x, y, z]) }))));
  g.add(mergedParts(t, bolts, mat(t, 0x6a6a66, { tex: 'metal', metal: 0.6, rough: 0.4 }), false));
  boltGeo.dispose();
  return g;
}

// ---------------------------------------------------------------------------
// bin — a hooped park litter bin on its post. BOUNDS FROZEN
// [-0.18, 0, -0.18] → [0.18, 0.575, 0.18].
// ---------------------------------------------------------------------------
export function bin(t: T) {
  const g = new t.Group();
  const body: Part[] = [];
  const lid: Part[] = [];
  const iron: Part[] = [];
  body.push({ geo: new t.CylinderGeometry(0.16, 0.14, 0.5, 16), matrix: mtx(t, [0, 0.28, 0]) }); // VERBATIM drum 0.03→0.53
  // STAVES + HOOPS: the drum was a bare tapered tube. Twelve staves rooted in
  // its surface and three iron hoops make it a bin. Both are sized so that
  // NOTHING reaches past the drum's own 0.16 — `<Placed>`'s per-mesh
  // `groundFootprintRadius` reads the widest XZ span at the base, and a 0.014
  // hoop tube on the drum surface at y 0.46 took the bin's derived footprint
  // from 0.160 to 0.172. Drum radius r(y) = 0.14 + 0.04·(y − 0.03).
  //   stave: a 0.02 box at r 0.146 has a rotated AABB half-span of 0.0141 → 0.160
  //   hoop:  a 16-gon BAND at exactly 0.16, the drum's own top radius → 0.160
  // The hoops were tori first, and a 14-segment torus riding 0.005 proud of the
  // drum dipped inside it between vertices: the elevations showed three rows of
  // DASHES, not three hoops. A cylinder band at a fixed 0.16 stands proud all
  // the way round (0.017 at y 0.10 down to 0.005 at y 0.40) and is continuous.
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    body.push({ geo: new t.BoxGeometry(0.02, 0.44, 0.02), matrix: mtx(t, [Math.cos(a) * 0.146, 0.28, Math.sin(a) * 0.146], [0, -a, 0]) });
  }
  [0.1, 0.26, 0.4].forEach((y) => iron.push({ geo: new t.CylinderGeometry(0.16, 0.16, 0.022, 16), matrix: mtx(t, [0, y, 0]) }));
  // LID: the frozen r 0.18 × 0.05 disc, plus a domed crown, a drip rim and the
  // APERTURE flap — the one feature that says "litter" rather than "planter".
  lid.push({ geo: new t.CylinderGeometry(0.18, 0.18, 0.05, 16), matrix: mtx(t, [0, 0.55, 0]) }); // VERBATIM, pins y-max 0.575
  lid.push({ geo: new t.CylinderGeometry(0.09, 0.17, 0.045, 16), matrix: mtx(t, [0, 0.55, 0]) }); // crown, inside the disc
  lid.push({ geo: new t.CylinderGeometry(0.165, 0.165, 0.022, 16), matrix: mtx(t, [0, 0.518, 0]) }); // drip rim under the lid
  lid.push({ geo: new t.BoxGeometry(0.17, 0.045, 0.075), matrix: mtx(t, [0, 0.552, 0.055], [0, 0, 0]) }); // flap surround 0.5295→0.5745
  g.add(mergedParts(t, body, mat(t, 0x2f6a34, { tex: 'metal', metal: 0.4, rough: 0.6 }), false));
  g.add(mergedParts(t, lid, mat(t, 0x244f27, { tex: 'metal', metal: 0.4, rough: 0.6 }), false));
  // the dark APERTURE slot, a flat box in the flap surround. It was an upright
  // r 0.062 disc, whose top at 0.618 MOVED the frozen y-max 0.575.
  g.add(box(t, [0.13, 0.028, 0.03], 0x101410, [0, 0.5545, 0.078], { rough: 1 }));
  // POST 0→0.5 pins y-min 0, plus a ground FLANGE and the two BRACKETS that
  // clamp the drum to it (both rooted in the drum wall at x ≈ −0.15).
  iron.push({ geo: new t.CylinderGeometry(0.03, 0.03, 0.5, 8), matrix: mtx(t, [0, 0.25, 0]) }); // VERBATIM
  iron.push({ geo: new t.CylinderGeometry(0.055, 0.075, 0.045, 10), matrix: mtx(t, [0, 0.0225, 0]) }); // flange on grade
  [0.16, 0.4].forEach((y) => iron.push({ geo: new t.BoxGeometry(0.14, 0.03, 0.045), matrix: mtx(t, [0.075, y, 0]) }));
  g.add(mergedParts(t, iron, mat(t, IRON, { tex: 'metal', metal: 0.6, rough: 0.5 }), false));
  return g;
}


// ---------------------------------------------------------------------------
// statue — four kinds on a shared classical PLINTH.
//
// The plinth is marbleStatue's vocabulary: a step, a base moulding, the die, an
// overhanging CORNICE and a sunken inscription tablet — the two shadow lines
// that read as carved stone. Its top stays at 0.70 and its footprint at 0.9,
// exactly where the old bare two-cube plinth put them.
// ---------------------------------------------------------------------------
function plinth(t: T, g: THREE.Group) {
  const s: MergedBoxSpec[] = [
    { dims: [0.9, 0.22, 0.9], pos: [0, 0.11, 0], repeat: [3, 1] }, // step 0→0.22
    { dims: [0.72, 0.06, 0.72], pos: [0, 0.25, 0], repeat: [2, 1] }, // base moulding 0.22→0.28
    { dims: [0.62, 0.36, 0.62], pos: [0, 0.46, 0], repeat: [2, 1] }, // die 0.28→0.64
    { dims: [0.72, 0.06, 0.72], pos: [0, 0.67, 0], repeat: [2, 1] }, // cornice 0.64→0.70, overhangs 0.05
  ];
  g.add(mergedBoxes(t, s, STONE, { tex: 'concrete', rough: 0.9, bump: 0.03 }));
  g.add(box(t, [0.4, 0.16, 0.02], 0xc4bfb2, [0, 0.46, 0.315], { tex: 'concrete', rough: 0.7 })); // inscription tablet on the die
  return 0.7; // plinth top
}

export function statue(t: T, kind: 'obelisk' | 'knight' | 'urn' | 'giraffe' = 'knight') {
  const g = new t.Group();
  const TOP = plinth(t, g);
  const C = { tex: 'concrete' as const, rough: 0.9 };
  const ROD = new t.CylinderGeometry(1, 1, 1, 8);
  if (kind === 'obelisk') {
    const acc: MergedBoxSpec[] = [];
    g.add(box(t, [0.28, 1.6, 0.28], STONE, [0, 1.5, 0], { ...C, repeat: [1, 4] })); // shaft 0.70→2.30
    acc.push({ dims: [0.35, 0.05, 0.35], pos: [0, 0.725, 0], repeat: [2, 1] }); // shaft base moulding on the cornice
    // three HIEROGLYPH bands + four corner CHAMFER strips: an obelisk's whole
    // ornament, and what stops a 1.6 u stick reading as a fencepost
    [1.06, 1.5, 1.94].forEach((y) => acc.push({ dims: [0.295, 0.11, 0.295], pos: [0, y, 0], repeat: [4, 1] }));
    for (let i = 0; i < 4; i++)
      acc.push({ dims: [0.055, 1.56, 0.055], pos: [Math.cos(i * 1.5708 + 0.7854) * 0.14, 1.5, Math.sin(i * 1.5708 + 0.7854) * 0.14], rotY: -i * 1.5708 });
    g.add(mergedBoxes(t, acc, STONE_LIT, { tex: 'concrete', rough: 0.85 }));
    g.add(cyl(t, 0.2, 0.245, 0.06, STONE, [0, 2.33, 0], { ...C, seg: 4, rotY: Math.PI / 4 })); // pyramidion collar 2.30→2.36
    g.add(cyl(t, 0, 0.22, 0.3, 0xe8d070, [0, 2.45, 0], { metal: 0.6, rough: 0.3, seg: 4 })); // gilt cap 2.30→2.60
  } else if (kind === 'urn') {
    const st: Part[] = [];
    st.push({ geo: new t.CylinderGeometry(0.2, 0.26, 0.08, 16), matrix: mtx(t, [0, TOP + 0.04, 0]) }); // foot 0.70→0.78
    st.push({ geo: new t.TorusGeometry(0.22, 0.035, 6, 18), matrix: mtx(t, [0, 0.785, 0], [Math.PI / 2, 0, 0]) }); // base torus
    st.push({ geo: new t.CylinderGeometry(0.3, 0.18, 0.42, 20), matrix: mtx(t, [0, 0.99, 0]) }); // belly 0.78→1.20
    st.push({ geo: new t.CylinderGeometry(0.34, 0.3, 0.1, 20), matrix: mtx(t, [0, 1.25, 0]) }); // shoulder 1.20→1.30
    st.push({ geo: new t.TorusGeometry(0.345, 0.032, 6, 22), matrix: mtx(t, [0, 1.305, 0], [Math.PI / 2, 0, 0]) }); // rim bead
    // TEN FLUTES rooted in the belly + an egg-and-dart course under the rim
    const flute = new t.BoxGeometry(0.03, 0.4, 0.03);
    const egg = new t.IcosahedronGeometry(0.028, 1);
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      // r 0.235: the belly's own radius at y 0.98 is ≈0.24, so a 0.03 flute is
      // mostly BEDDED and reads as a moulding. At 0.26 it stood 0.035 proud and
      // the urn read as a wicker basket.
      st.push({ geo: flute, matrix: mtx(t, [Math.cos(a) * 0.235, 0.98, Math.sin(a) * 0.235], [0, -a, 0]) });
    }
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      st.push({ geo: egg, matrix: mtx(t, [Math.cos(a) * 0.325, 1.255, Math.sin(a) * 0.325]) });
    }
    // two SCROLL HANDLES, each two rods built from the points they join — an
    // azimuth-plus-tilt handle would swing out of the elevation plane
    [-1, 1].forEach((s) => {
      st.push(span(t, ROD, [s * 0.3, 1.27, 0], [s * 0.44, 1.17, 0], 0.028));
      st.push(span(t, ROD, [s * 0.44, 1.17, 0], [s * 0.32, 0.99, 0], 0.026));
    });
    g.add(mergedParts(t, st, mat(t, STONE, { ...C, repeat: [3, 2] }), false));
    flute.dispose();
    egg.dispose();
    // PLANTING: a foliage mound with blossoms and two trailing sprays, not one
    // bare green ball. Mound underside 1.30 = the urn rim, so it is seated.
    const fol: Part[] = [];
    const bl: Part[] = [];
    const BLOB = new t.IcosahedronGeometry(1, 0);
    // Each BLOSSOM is keyed to the mound it sits on — centre y + 0.06 against a
    // mound half-height of 0.1, so it is bedded IN the foliage. Hashing the
    // blossom height independently is what left one of them 0.033 clear of
    // everything, which is exactly what probe-kit-attach reported.
    for (let i = 0; i < 9; i++) {
      const a = hash01(i * 7 + 1) * Math.PI * 2;
      const d = hash01(i * 7 + 2) * 0.26;
      const y = 1.34 + hash01(i * 7 + 3) * 0.2;
      fol.push({ geo: BLOB, matrix: mtx(t, [Math.cos(a) * d, y, Math.sin(a) * d], [0, a, 0], [0.13, 0.1, 0.13]) });
      if (hash01(i * 7 + 9) > 0.25)
        bl.push({ geo: BLOB, matrix: mtx(t, [Math.cos(a) * d, y + 0.06, Math.sin(a) * d], [0, a, 0], [0.045, 0.04, 0.045]) });
    }
    [0, 1, 2, 3].forEach((k) => {
      const a = k * 1.6;
      const f = 0.3 + (k % 2) * 0.25;
      fol.push({ geo: BLOB, matrix: mtx(t, [Math.cos(a) * (0.3 + f * 0.12), 1.3 - f * 0.26, Math.sin(a) * (0.3 + f * 0.12)], [0, a, 0], [0.09, 0.05, 0.09]) });
    });
    g.add(mergedParts(t, fol, mat(t, LEAF, { tex: 'leaf', repeat: [2, 2], flat: true, rough: 1 }), false));
    g.add(mergedParts(t, bl, mat(t, 0xe8608a, { flat: true, rough: 0.7 }), false));
    BLOB.dispose();
  } else if (kind === 'giraffe') {
    // It was four 0.3 × 0.9 slabs in a row, which from any elevation read as a
    // blank stone WALL — there was no giraffe in it. This is a giraffe: four
    // legs standing on the plinth top, a barrel, a neck built from the two
    // points it joins, a head with muzzle, ossicones and ears, a tail, and
    // hashed SPOTS bedded on the hide.
    const hide: Part[] = [];
    const dark: Part[] = [];
    const BLOB = new t.IcosahedronGeometry(1, 1);
    const legs: [number, number][] = [
      [0.2, 0.13],
      [0.2, -0.13],
      [-0.22, 0.12],
      [-0.22, -0.12],
    ];
    legs.forEach(([x, z]) => {
      hide.push(span(t, ROD, [x, TOP - 0.01, z], [x * 0.88, 1.08, z * 0.85], 0.036)); // hoof embeds 0.01 in the plinth
      hide.push({ geo: new t.CylinderGeometry(0.05, 0.055, 0.045, 8), matrix: mtx(t, [x, TOP + 0.022, z]) }); // hoof
      hide.push({ geo: BLOB, matrix: mtx(t, [x * 0.9, 0.99, z * 0.86], [0, 0, 0], [0.055, 0.09, 0.055]) }); // knee swelling
    });
    hide.push({ geo: BLOB, matrix: mtx(t, [0, 1.16, 0], [0, 0, 0.04], [0.3, 0.18, 0.19]) }); // barrel 0.98→1.34
    hide.push({ geo: BLOB, matrix: mtx(t, [0.22, 1.29, 0], [0, 0, 0], [0.15, 0.15, 0.15]) }); // withers, swallows the neck root
    hide.push(span(t, ROD, [0.22, 1.28, 0], [0.44, 1.94, 0], 0.058)); // NECK, from its two points
    hide.push({ geo: BLOB, matrix: mtx(t, [0.5, 2.02, 0], [0, 0, 0.35], [0.11, 0.075, 0.075]) }); // head
    hide.push({ geo: new t.BoxGeometry(0.12, 0.075, 0.075), matrix: mtx(t, [0.59, 1.99, 0], [0, 0, 0.2]) }); // muzzle
    hide.push(span(t, ROD, [-0.28, 1.24, 0], [-0.36, 0.86, 0.03], 0.02)); // tail
    [-1, 1].forEach((s) => {
      hide.push(span(t, ROD, [0.47, 2.07, s * 0.04], [0.455, 2.17, s * 0.055], 0.016)); // ossicone
      hide.push({ geo: BLOB, matrix: mtx(t, [0.455, 2.185, s * 0.057], [0, 0, 0], [0.026, 0.026, 0.026]) }); // its knob
      hide.push({ geo: BLOB, matrix: mtx(t, [0.435, 2.09, s * 0.08], [0, s * 0.5, 0], [0.05, 0.028, 0.028]) }); // ear
      dark.push({ geo: BLOB, matrix: mtx(t, [0.55, 2.03, s * 0.05], [0, 0, 0], [0.02, 0.02, 0.02]) }); // eye
    });
    dark.push({ geo: BLOB, matrix: mtx(t, [-0.375, 0.85, 0.032], [0, 0, 0], [0.045, 0.055, 0.045]) }); // tail tuft
    // MANE along the neck, and SPOTS on barrel + neck. Both are placed at a
    // fraction of the local surface radius so they are bedded IN the hide.
    for (let i = 0; i < 7; i++) {
      const f = i / 6;
      dark.push({ geo: BLOB, matrix: mtx(t, [0.22 + f * 0.22, 1.28 + f * 0.66, 0], [0, 0, 0.32], [0.028, 0.04, 0.022]) });
    }
    for (let i = 0; i < 14; i++) {
      const onNeck = i % 3 === 0;
      const f = hash01(i * 13 + 1);
      const a = hash01(i * 13 + 4) * Math.PI * 2;
      const p: V3 = onNeck
        ? [0.22 + f * 0.2 + Math.cos(a) * 0.045, 1.3 + f * 0.6, Math.sin(a) * 0.05]
        : [(hash01(i * 13 + 7) - 0.5) * 0.48, 1.06 + hash01(i * 13 + 9) * 0.2, Math.cos(a) * 0.165];
      dark.push({ geo: BLOB, matrix: mtx(t, p, [0, a, 0], [0.048, 0.03, 0.048]) });
    }
    g.add(mergedParts(t, hide, mat(t, 0xd8caa4, { tex: 'concrete', repeat: [2, 2], rough: 0.9 }), false));
    g.add(mergedParts(t, dark, mat(t, 0x9a7a46, { tex: 'concrete', flat: true, rough: 0.9 }), false));
    BLOB.dispose();
  } else {
    // knight: it was a cone, a ball and two flat plates. It is a FIGURE now —
    // greaves, tabard, cuirass, pauldrons, a helm with a visor slit and a
    // plume, arms built from shoulder to hand, a spear built from butt to tip
    // and a heater shield with a boss and a cross.
    const st: Part[] = [];
    const acc: Part[] = [];
    const BLOB = new t.IcosahedronGeometry(1, 2);
    [-0.09, 0.09].forEach((x) => {
      st.push({ geo: new t.BoxGeometry(0.11, 0.3, 0.14), matrix: mtx(t, [x, 0.85, 0]) }); // greaves 0.70→1.00
      st.push({ geo: new t.BoxGeometry(0.13, 0.05, 0.19), matrix: mtx(t, [x, 0.715, 0.02]) }); // sabaton on the plinth top
    });
    st.push({ geo: new t.CylinderGeometry(0.17, 0.22, 0.24, 16), matrix: mtx(t, [0, 1.09, 0]) }); // tabard 0.97→1.21
    st.push({ geo: new t.CylinderGeometry(0.185, 0.17, 0.34, 16), matrix: mtx(t, [0, 1.36, 0]) }); // cuirass 1.19→1.53
    st.push({ geo: new t.CylinderGeometry(0.2, 0.2, 0.05, 16), matrix: mtx(t, [0, 1.2, 0]) }); // belt
    st.push({ geo: new t.CylinderGeometry(0.19, 0.175, 0.045, 16), matrix: mtx(t, [0, 1.5, 0]) }); // gorget yoke
    [-1, 1].forEach((s) => {
      st.push({ geo: BLOB, matrix: mtx(t, [s * 0.19, 1.49, 0], [0, 0, 0], [0.095, 0.075, 0.09]) }); // pauldron
      st.push(span(t, ROD, [s * 0.19, 1.47, 0], [s * 0.26, 1.19, 0.05], 0.045)); // arm, shoulder → wrist
      st.push({ geo: BLOB, matrix: mtx(t, [s * 0.27, 1.17, 0.06], [0, 0, 0], [0.05, 0.05, 0.05]) }); // gauntlet
    });
    st.push({ geo: new t.CylinderGeometry(0.07, 0.09, 0.06, 12), matrix: mtx(t, [0, 1.55, 0]) }); // neck
    st.push({ geo: BLOB, matrix: mtx(t, [0, 1.66, 0], [0, 0, 0], [0.13, 0.145, 0.135]) }); // helm 1.515→1.805
    st.push({ geo: new t.CylinderGeometry(0.135, 0.125, 0.035, 14), matrix: mtx(t, [0, 1.58, 0]) }); // helm band
    acc.push({ geo: new t.BoxGeometry(0.17, 0.028, 0.04), matrix: mtx(t, [0, 1.68, 0.116]) }); // visor slit
    acc.push({ geo: new t.BoxGeometry(0.035, 0.13, 0.24), matrix: mtx(t, [0, 1.85, -0.02]) }); // plume crest 1.785→1.915
    // SPEAR from butt to tip: butt 0.68 is 0.02 INSIDE the plinth top, so it
    // stands on it rather than beside it
    st.push(span(t, ROD, [0.3, 0.68, 0.05], [0.235, 1.9, 0.03], 0.024));
    st.push({ geo: new t.CylinderGeometry(0.0, 0.05, 0.19, 6), matrix: mtx(t, [0.232, 2.0, 0.03]) }); // spear head 1.905→2.095
    // SHIELD: inner edge x −0.12 sits inside the cuirass surface (r 0.18 at
    // z 0, 0.143 at z 0.11), so it is carried, not floating beside the arm
    st.push({ geo: new t.BoxGeometry(0.3, 0.26, 0.035), matrix: mtx(t, [-0.27, 1.34, 0.11], [0, 0, 0.12]) });
    st.push({ geo: new t.CylinderGeometry(0.15, 0.0, 0.16, 3), matrix: mtx(t, [-0.29, 1.13, 0.11], [Math.PI / 2, 0, Math.PI / 2]) }); // tapered tip
    acc.push({ geo: BLOB, matrix: mtx(t, [-0.28, 1.33, 0.135], [0, 0, 0], [0.05, 0.05, 0.025]) }); // boss
    acc.push({ geo: new t.BoxGeometry(0.045, 0.24, 0.02), matrix: mtx(t, [-0.275, 1.32, 0.132], [0, 0, 0.12]) }); // cross, upright
    acc.push({ geo: new t.BoxGeometry(0.26, 0.045, 0.02), matrix: mtx(t, [-0.272, 1.37, 0.132], [0, 0, 0.12]) }); // cross, arm
    g.add(mergedParts(t, st, mat(t, MARBLE, { tex: 'concrete', repeat: [2, 2], rough: 0.55 }), false));
    g.add(mergedParts(t, acc, mat(t, 0x9a9284, { tex: 'concrete', rough: 0.7 }), false));
    BLOB.dispose();
  }
  ROD.dispose();
  return g;
}

// ---------------------------------------------------------------------------
// foodStall — a timber-framed kiosk with a striped awning.
//
// The awning used to be six boxes carrying `rotX: 0.2` from a fixed pose, with
// their back ends 0.015 inside the roof band's front edge — from the side they
// read as loose flaps. Each stripe is now built from the two points it joins
// (fascia line → hem line), so it is a real sloping plane bedded in the fascia.
// ---------------------------------------------------------------------------
export function foodStall(t: T) {
  const g = new t.Group();
  const tim: MergedBoxSpec[] = [];
  const pan: MergedBoxSpec[] = [];
  tim.push({ dims: [1.34, 0.08, 0.86], pos: [0, 0.04, 0], repeat: [4, 1] }); // base plinth 0→0.08
  // POSTS RUN FULL HEIGHT, 0.08→1.02, and carry the roof. The first draft
  // stopped them at 0.74 under the counter and hung the roof off a signboard
  // buried at z −0.02: probe-kit-attach reported the whole roof assembly — 25
  // sub-solids including the awning — floating 0.060 above the frame, because
  // nothing at all connected the post tops to it.
  [-1, 1].forEach((s) => [-1, 1].forEach((q) => tim.push({ dims: [0.075, 0.94, 0.075], pos: [s * 0.615, 0.55, q * 0.375], repeat: [1, 3] })));
  // HEADER beams tying the four post tops, 0.91→1.02
  [-1, 1].forEach((s) => {
    tim.push({ dims: [1.32, 0.11, 0.07], pos: [0, 0.965, s * 0.375], repeat: [5, 1] });
    tim.push({ dims: [0.07, 0.11, 0.82], pos: [s * 0.615, 0.965, 0], repeat: [3, 1] });
  });
  pan.push({ dims: [1.24, 0.42, 0.06], pos: [0, 0.29, 0.375], repeat: [4, 1] }); // front panel below the counter
  pan.push({ dims: [1.24, 0.88, 0.05], pos: [0, 0.52, -0.365], repeat: [4, 3] }); // back wall 0.08→0.96, up to the header
  [-1, 1].forEach((s) => pan.push({ dims: [0.05, 0.88, 0.72], pos: [s * 0.6, 0.52, 0], repeat: [3, 3] })); // side walls
  // three recessed panels in the front, the shadow lines that read as joinery
  [-0.4, 0, 0.4].forEach((x) => pan.push({ dims: [0.3, 0.24, 0.02], pos: [x, 0.3, 0.412], repeat: [2, 2] }));
  // the SERVING HATCH's shaded interior: without it you see the cream back wall
  // through the 0.50→0.74 gap and the stall reads as a closed cream box
  g.add(box(t, [1.2, 0.26, 0.04], 0x3a2e22, [0, 0.62, 0.22], { tex: 'wood', repeat: [4, 1], rough: 1 }));
  tim.push({ dims: [1.38, 0.06, 0.36], pos: [0, 0.77, 0.29], repeat: [5, 1] }); // COUNTER 0.74→0.80, overhangs 0.09
  tim.push({ dims: [1.3, 0.05, 0.06], pos: [0, 0.73, 0.4], repeat: [5, 1] }); // counter nosing under it
  // SIGNBOARD on the FRONT face (z 0.40→0.43), lapped over the front header
  // (0.34→0.41) so it is carried and, unlike the buried z −0.02 board it
  // replaces, actually visible.
  tim.push({ dims: [1.16, 0.2, 0.03], pos: [0, 0.9, 0.415], repeat: [5, 1] });
  tim.push({ dims: [1.44, 0.06, 0.94], pos: [0, 1.05, 0], repeat: [5, 3] }); // roof slab 1.02→1.08
  [-1, 1].forEach((s) => {
    tim.push({ dims: [1.46, 0.07, 0.05], pos: [0, 1.005, s * 0.465], repeat: [5, 1] }); // roof fascia trim
    tim.push({ dims: [0.05, 0.07, 0.96], pos: [s * 0.72, 1.005, 0], repeat: [4, 1] });
  });
  g.add(mergedBoxes(t, tim, WOOD, { tex: 'wood', rough: 0.8, bump: 0.03 }));
  g.add(mergedBoxes(t, pan, 0xf0e6d0, { tex: 'wood', rough: 0.7 }));
  // AWNING: eight stripes rooted IN the front roof fascia (its box spans
  // z 0.44→0.49, y 0.97→1.04) and sloping out and DOWN to a hem at
  // (y 0.80, z 0.88) — 0.41 PAST the roof edge. The first pass ran them from
  // z 0.02 to 0.50, entirely under a 0.94-deep roof, so the whole awning was
  // invisible from the front and from above: a striped awning nobody can see is
  // not an awning. Built with basis(), whose local +Z is DERIVED as x × y —
  // makeBasis on a left-handed triple mirrors the part and renders it near-black.
  const stripe = new t.BoxGeometry(1, 1, 1);
  const lite: Part[] = [];
  const drk: Part[] = [];
  const val: Part[] = [];
  for (let i = 0; i < 8; i++) {
    const x = -0.63 + i * 0.18;
    const root: V3 = [x, 0.995, 0.46];
    const hem: V3 = [x, 0.8, 0.88];
    const dir = new t.Vector3(hem[0] - root[0], hem[1] - root[1], hem[2] - root[2]);
    const L = dir.length();
    const m = basis(t, [x, (root[1] + hem[1]) / 2, (root[2] + hem[2]) / 2], dir, new t.Vector3(0, 1, 0), [L, 0.03, 0.17]);
    (i % 2 ? lite : drk).push({ geo: stripe, matrix: m });
    // VALANCE scallop hanging off the hem of each stripe (top 0.815 overlaps it)
    val.push({ geo: stripe, matrix: mtx(t, [x, 0.755, 0.885], [0, 0, 0], [0.165, 0.12, 0.03]) });
  }
  g.add(mergedParts(t, lite, mat(t, 0xe8e8e2, { tex: 'fabric', rough: 0.7 }), false));
  g.add(mergedParts(t, drk, mat(t, 0xc22f2f, { tex: 'fabric', rough: 0.7 }), false));
  g.add(mergedParts(t, val, mat(t, 0xa82424, { tex: 'fabric', rough: 0.8 }), false));
  stripe.dispose();
  // the counter's furniture + the awning's iron stays
  const mtl: Part[] = [];
  const ROD = new t.CylinderGeometry(1, 1, 1, 6);
  [-0.55, 0.55].forEach((x) => mtl.push(span(t, ROD, [x, 0.99, 0.46], [x, 0.81, 0.86], 0.012))); // stays under the awning
  [-0.62, 0.62].forEach((x) => mtl.push(span(t, ROD, [x, 0.74, 0.32], [x, 0.6, 0.41], 0.018))); // counter brackets
  g.add(mergedParts(t, mtl, mat(t, IRON, { tex: 'metal', metal: 0.6, rough: 0.5 }), false));
  ROD.dispose();
  g.add(box(t, [0.9, 0.13, 0.02], 0x3a2a1c, [0, 0.9, 0.435], { rough: 0.9 })); // menu board lapped on the signboard (0.43)
  const jars: Part[] = [];
  const jarGeo = new t.CylinderGeometry(0.05, 0.055, 0.13, 10);
  [-0.42, -0.28, 0.34].forEach((x, i) => jars.push({ geo: jarGeo, matrix: mtx(t, [x, 0.865, 0.24 + i * 0.02]) }));
  g.add(mergedParts(t, jars, mat(t, 0xd8a03a, { rough: 0.4, metal: 0.2 }), false));
  jarGeo.dispose();
  return g;
}

// ---------------------------------------------------------------------------
// fence — rustic post-and-rail. picketFence's idiom: every post lands on a base
// block and is finished with a cap, the rails are LET IN behind the posts, and
// the whole run merges into two batches (was 7 loose meshes).
// ---------------------------------------------------------------------------
export function fence(t: T, len = 2) {
  const g = new t.Group();
  const wood: Part[] = [];
  const caps: Part[] = [];
  const POST = new t.CylinderGeometry(0.038, 0.046, 0.7, 8);
  const BASE = new t.CylinderGeometry(0.062, 0.075, 0.07, 8);
  const CAP = new t.CylinderGeometry(0.02, 0.056, 0.055, 8);
  const xs: number[] = [];
  for (let x = -len / 2; x <= len / 2 + 1e-6; x += 0.5) xs.push(x);
  xs.forEach((x) => {
    wood.push({ geo: POST, matrix: mtx(t, [x, 0.35, 0]) }); // post 0→0.70
    wood.push({ geo: BASE, matrix: mtx(t, [x, 0.035, 0]) }); // base block 0→0.07, so it lands
    caps.push({ geo: CAP, matrix: mtx(t, [x, 0.7275, 0]) }); // cap on the post top (0.70)
  });
  const rails: MergedBoxSpec[] = [];
  [0.22, 0.52].forEach((y) => {
    // rails behind the posts: post back face −0.046, rail spans −0.085→−0.035
    rails.push({ dims: [len, 0.07, 0.05], pos: [0, y, -0.06], repeat: [Math.round(len * 3), 1] });
    rails.push({ dims: [len, 0.022, 0.022], pos: [0, y - 0.045, -0.038], repeat: [Math.round(len * 3), 1] }); // BEAD under each rail
  });
  // two diagonal BRACES, each built from the two points it joins
  const BR = new t.CylinderGeometry(1, 1, 1, 6);
  for (let i = 0; i + 1 < xs.length; i += 2)
    wood.push(span(t, BR, [xs[i] + 0.04, 0.1, -0.06], [xs[i + 1] - 0.04, 0.6, -0.06], 0.022));
  g.add(mergedParts(t, wood, mat(t, WOOD, { tex: 'wood', repeat: [1, 2], rough: 0.85, bump: 0.03 }), false));
  g.add(mergedBoxes(t, rails, WOOD, { tex: 'wood', rough: 0.85, bump: 0.03 }));
  g.add(mergedParts(t, caps, mat(t, WOOD_DARK, { tex: 'wood', rough: 0.9 }), false));
  POST.dispose();
  BASE.dispose();
  CAP.dispose();
  BR.dispose();
  return g;
}

// ---------------------------------------------------------------------------
// lamp — a cast-iron park standard.
//
// This is one of the two builders where the frame traps bite. The lantern's cap
// RIBS and the ladder-bar STAYS are radial AND sloping, so every one of them is
// built from the two points it joins (`span`) instead of an azimuth plus a
// `rotX`: three.js composes Euler 'XYZ' as Rx·Ry, so a tilt written next to an
// azimuth is applied about WORLD X and the ribs would stick out horizontally on
// two sides and tip UP into the air on the other two.
// ---------------------------------------------------------------------------
export function lamp(t: T) {
  const g = new t.Group();
  const glass = new t.MeshStandardMaterial({ color: 0xfff2c0, emissive: 0xffcc55, emissiveIntensity: 1, roughness: 0.4 });
  const iron: Part[] = [];
  const brass: Part[] = [];
  const ROD = new t.CylinderGeometry(1, 1, 1, 6);
  // BASE: a square ground pad, a moulded socle and a torus astragal — a lamp
  // standard sits on masonry, it does not sprout
  iron.push({ geo: new t.BoxGeometry(0.3, 0.06, 0.3), matrix: mtx(t, [0, 0.03, 0]) }); // pad 0→0.06
  // socle 0.06→0.22 · astragal on its top · column 0.20→1.64, so the column
  // foot is 0.02 INSIDE the socle. probe-kit-attach caught the first draft: a
  // socle stopping at 0.18 under a column starting at 0.20 left the whole
  // standard — 22 sub-solids — floating 0.02 above its own base.
  iron.push({ geo: new t.CylinderGeometry(0.15, 0.2, 0.16, 12), matrix: mtx(t, [0, 0.14, 0]) });
  iron.push({ geo: new t.TorusGeometry(0.145, 0.028, 6, 16), matrix: mtx(t, [0, 0.225, 0], [Math.PI / 2, 0, 0]) });
  iron.push({ geo: new t.CylinderGeometry(0.05, 0.078, 1.44, 12), matrix: mtx(t, [0, 0.92, 0]) });
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    iron.push({ geo: new t.BoxGeometry(0.02, 1.2, 0.02), matrix: mtx(t, [Math.cos(a) * 0.058, 0.85, Math.sin(a) * 0.058], [0, -a, 0]) }); // flute
  }
  iron.push({ geo: new t.CylinderGeometry(0.088, 0.095, 0.06, 12), matrix: mtx(t, [0, 1.63, 0]) }); // collar under the lantern
  // LADDER BAR + its two stays, the gaslighter's crossbar
  iron.push({ geo: new t.BoxGeometry(0.4, 0.024, 0.024), matrix: mtx(t, [0, 1.5, 0]) });
  [-1, 1].forEach((s) => iron.push(span(t, ROD, [s * 0.19, 1.5, 0], [s * 0.062, 1.33, 0], 0.011)));
  // LANTERN: a base ring, four glazing bars built corner-to-corner, and a
  // hipped cap with four HIP RIBS + a finial. Cap eave corners sit on the
  // lantern top (1.95); every rib runs eave corner → apex.
  const R = 0.135;
  const Y0 = 1.66;
  const Y1 = 1.95;
  iron.push({ geo: new t.CylinderGeometry(0.16, 0.16, 0.045, 4), matrix: mtx(t, [0, Y0 + 0.0225, 0], [0, Math.PI / 4, 0]) });
  iron.push({ geo: new t.CylinderGeometry(0.155, 0.15, 0.04, 4), matrix: mtx(t, [0, Y1 - 0.02, 0], [0, Math.PI / 4, 0]) });
  const corner = (k: number, y: number): V3 => [Math.cos(k * 1.5708 + 0.7854) * R, y, Math.sin(k * 1.5708 + 0.7854) * R];
  for (let k = 0; k < 4; k++) {
    iron.push(span(t, ROD, corner(k, Y0 + 0.02), corner(k, Y1 - 0.02), 0.016)); // glazing bar
    iron.push(span(t, ROD, corner(k, Y1 + 0.005), [0, 2.09, 0], 0.014)); // HIP RIB, eave → apex
  }
  iron.push({ geo: new t.CylinderGeometry(0.02, 0.2, 0.14, 4), matrix: mtx(t, [0, 2.02, 0], [0, Math.PI / 4, 0]) }); // cap 1.95→2.09
  brass.push({ geo: new t.CylinderGeometry(0.028, 0.048, 0.05, 8), matrix: mtx(t, [0, 2.105, 0]) }); // finial neck 2.08→2.13
  brass.push({ geo: new t.IcosahedronGeometry(0.045, 2), matrix: mtx(t, [0, 2.17, 0]) }); // ball finial, bottom 2.125
  brass.push({ geo: new t.CylinderGeometry(0.0, 0.02, 0.07, 6), matrix: mtx(t, [0, 2.245, 0]) }); // spike
  g.add(mergedParts(t, iron, mat(t, IRON, { tex: 'metal', metal: 0.6, rough: 0.45 }), false));
  g.add(mergedParts(t, brass, mat(t, BRASS, { metal: 0.7, rough: 0.35 }), false));
  ROD.dispose();
  // the GLASS stays a mesh of its own: `update` mutates its emissiveIntensity
  // every frame, and merged parts share one material forever
  const lantern = new t.Mesh(new t.CylinderGeometry(0.125, 0.135, 0.29, 4), glass);
  lantern.rotation.y = Math.PI / 4;
  lantern.position.set(0, 1.805, 0); // glass 1.66→1.95, inside both rings
  g.add(lantern);
  return { group: g, update: (time: number) => (glass.emissiveIntensity = 0.8 + Math.sin(time * 8) * 0.15 + Math.sin(time * 23) * 0.05) };
}

// ---------------------------------------------------------------------------
// fountain — a two-tier stone fountain.
//
// The basin's water disc used to sit 0.06 PROUD of its rim, which in an
// elevation reads as a blue plate resting on a tub; it is inset under the
// coping now. The upper "bowl" was a flat disc with the jets standing on it
// like candles — it is a real bowl with water in it and a cascade curtain
// spilling over its lip, and every cascade sheet is built from the two points
// it joins (lip → pool), not from an azimuth plus a tilt.
// ---------------------------------------------------------------------------
export function fountain(t: T) {
  const g = new t.Group();
  const st: Part[] = [];
  const trim: Part[] = [];
  const wet: Part[] = [];
  const fall: Part[] = []; // the cascade, half-transparent in its own batch
  const ROD = new t.CylinderGeometry(1, 1, 1, 6);
  const SHEET = new t.BoxGeometry(1, 1, 1);
  // ---- basin: base course 0→0.10 · wall 0.10→0.40 · coping RING 0.40→0.49 --
  //
  // THE COPING AND THE RIM ARE RINGS OF MERGED BOXES, not cylinders. A
  // `CylinderGeometry` is a SOLID of revolution — its end cap is a full disc —
  // so a 1.28-radius coping cylinder laid over the basin CAPPED IT, and the
  // pool disc under it was invisible from every camera: the first elevation
  // sheet showed a fountain with no water in it at all. (The old builder only
  // got away with a solid rim because its water sat 0.06 PROUD of it, which is
  // the other half of the same defect — a blue plate resting on a tub.) A ring
  // of tangential boxes leaves the middle open, so the water reads AND is
  // recessed under the rim.
  st.push({ geo: new t.CylinderGeometry(1.24, 1.3, 0.1, 28), matrix: mtx(t, [0, 0.05, 0]) });
  st.push({ geo: new t.CylinderGeometry(1.16, 1.22, 0.3, 28), matrix: mtx(t, [0, 0.25, 0]) }); // solid: its top IS the pool floor
  for (let i = 0; i < 20; i++) {
    const a = (i / 20) * Math.PI * 2;
    st.push({ geo: new t.BoxGeometry(0.24, 0.2, 0.03), matrix: mtx(t, [Math.cos(a) * 1.185, 0.25, Math.sin(a) * 1.185], [0, -a + Math.PI / 2, 0]) }); // rustication
  }
  // 28 coping blocks, r 1.15→1.28 (inner edge overlaps the wall top rim 1.16,
  // so every block is carried). rotY −a+π/2 puts local +X on the tangent and
  // local +Z on the radius — an azimuth-only placement, no tilt to get wrong.
  const COP = new t.BoxGeometry(0.285, 0.09, 0.13);
  for (let i = 0; i < 28; i++) {
    const a = (i / 28) * Math.PI * 2;
    trim.push({ geo: COP, matrix: mtx(t, [Math.cos(a) * 1.215, 0.445, Math.sin(a) * 1.215], [0, -a + Math.PI / 2, 0]) });
  }
  trim.push({ geo: new t.TorusGeometry(1.215, 0.035, 6, 30), matrix: mtx(t, [0, 0.395, 0], [Math.PI / 2, 0, 0]) }); // bead under it
  wet.push({ geo: new t.CylinderGeometry(1.14, 1.14, 0.03, 28), matrix: mtx(t, [0, 0.415, 0]) }); // pool ON the wall top, 0.06 below the coping
  // ---- pedestal 0.40→1.12, fluted -----------------------------------------
  st.push({ geo: new t.CylinderGeometry(0.32, 0.38, 0.1, 20), matrix: mtx(t, [0, 0.45, 0]) });
  st.push({ geo: new t.CylinderGeometry(0.17, 0.23, 0.56, 20), matrix: mtx(t, [0, 0.78, 0]) });
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    st.push({ geo: new t.BoxGeometry(0.03, 0.5, 0.03), matrix: mtx(t, [Math.cos(a) * 0.195, 0.78, Math.sin(a) * 0.195], [0, -a, 0]) });
  }
  trim.push({ geo: new t.CylinderGeometry(0.24, 0.2, 0.06, 20), matrix: mtx(t, [0, 1.09, 0]) }); // collar 1.06→1.12
  // ---- upper bowl 1.12→1.32, with water IN it -----------------------------
  st.push({ geo: new t.CylinderGeometry(0.5, 0.2, 0.14, 22), matrix: mtx(t, [0, 1.19, 0]) }); // underside cone; its top IS the bowl floor
  // bowl RIM: a ring of 22 blocks, r 0.46→0.56, for the same reason the coping
  // is one — a solid disc would hide the bowl's own water
  const RIM = new t.BoxGeometry(0.152, 0.08, 0.1);
  for (let i = 0; i < 22; i++) {
    const a = (i / 22) * Math.PI * 2;
    st.push({ geo: RIM, matrix: mtx(t, [Math.cos(a) * 0.51, 1.3, Math.sin(a) * 0.51], [0, -a + Math.PI / 2, 0]) });
  }
  trim.push({ geo: new t.TorusGeometry(0.555, 0.028, 6, 24), matrix: mtx(t, [0, 1.32, 0], [Math.PI / 2, 0, 0]) }); // lip bead
  wet.push({ geo: new t.CylinderGeometry(0.47, 0.47, 0.03, 22), matrix: mtx(t, [0, 1.275, 0]) }); // bowl water on its floor (1.26), 0.05 under the rim
  // CASCADE: twelve SLIM sheets from the bowl lip (r 0.55, y 1.30) down to the
  // pool (r 0.62, y 0.42), each built from its two endpoints. The first pass
  // used 0.14-wide sheets and in an elevation they read as blue PLANKS propping
  // the bowl up; 0.055 and half-transparent reads as falling water.
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2 + 0.26;
    const top: V3 = [Math.cos(a) * 0.55, 1.3, Math.sin(a) * 0.55];
    const bot: V3 = [Math.cos(a) * 0.62, 0.42, Math.sin(a) * 0.62];
    const dir = new t.Vector3(bot[0] - top[0], bot[1] - top[1], bot[2] - top[2]);
    fall.push({
      geo: SHEET,
      matrix: basis(
        t,
        [(top[0] + bot[0]) / 2, (top[1] + bot[1]) / 2, (top[2] + bot[2]) / 2],
        dir,
        new t.Vector3(-Math.cos(a), 0, -Math.sin(a)),
        [dir.length(), 0.018, 0.055],
      ),
    });
  }
  // SPLASH rings on the pool where the cascade lands
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2 + 0.26;
    wet.push({ geo: new t.TorusGeometry(0.1, 0.012, 5, 12), matrix: mtx(t, [Math.cos(a) * 0.62, 0.435, Math.sin(a) * 0.62], [Math.PI / 2, 0, 0]) });
  }
  g.add(mergedParts(t, st, mat(t, 0xc3b7a0, { tex: 'concrete', repeat: [6, 2], rough: 0.9, bump: 0.04 }), false));
  g.add(mergedParts(t, trim, mat(t, 0xd4c9b2, { tex: 'concrete', repeat: [8, 1], rough: 0.85 }), false));
  g.add(mergedParts(t, wet, mat(t, 0x3f8ec4, { emissive: 0x134a78, rough: 0.18, metal: 0.3, opacity: 0.85 }), false));
  g.add(mergedParts(t, fall, mat(t, 0x9fd4ee, { emissive: 0x2a6fb0, rough: 0.15, opacity: 0.42 }), false));
  ROD.dispose();
  SHEET.dispose();
  // JETS animate, so each is its own mesh. Geometry is built with its origin at
  // the jet BASE so scaling y grows the spray upward, and each carries its own
  // plume head in the same buffer — one mesh, not two.
  const jets: THREE.Mesh[] = [];
  const jetMat = () => new t.MeshStandardMaterial({ color: 0xafe0f5, transparent: true, opacity: 0.7, roughness: 0.2 });
  const makeJet = (h: number, r: number) => {
    const stem = new t.CylinderGeometry(r * 0.45, r, h, 6);
    stem.translate(0, h / 2, 0);
    const head = new t.IcosahedronGeometry(r * 2.1, 0); // the PLUME breaking at the top
    head.translate(0, h, 0);
    return mergedParts(t, [{ geo: stem, matrix: new t.Matrix4() }, { geo: head, matrix: new t.Matrix4() }], jetMat()).geometry;
  };
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const jet = new t.Mesh(makeJet(0.46, 0.026), jetMat());
    jet.position.set(Math.cos(a) * 0.3, 1.275, Math.sin(a) * 0.3); // rooted IN the bowl water (1.26→1.29)
    g.add(jet);
    jets.push(jet);
  }
  const centre = new t.Mesh(makeJet(0.72, 0.034), jetMat());
  centre.position.set(0, 1.275, 0);
  g.add(centre);
  jets.push(centre);
  return {
    group: g,
    update: (time: number) => jets.forEach((j, i) => (j.scale.y = 0.6 + Math.abs(Math.sin(time * 4 + i)) * 0.9)),
  };
}

// Showcase: EVERY scenery builder together (trees, bench, bin, fence, hedge,
// rock, food stall, statues, flower bed, lamp, fountain) — the museum ring:
// 13 exhibits on an ellipse around the central fountain, long pieces turned

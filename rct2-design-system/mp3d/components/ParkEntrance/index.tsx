import React from 'react';
import * as THREE from 'three';
import { box, ball, mat, mergedBoxes, mergedParts, mtx, nightKOf } from '../Stage';
import type { MergedBoxSpec, PartSpec } from '../Stage';
import { buildPeep } from '../Guest';
import { composable } from '../Park';

// ---------------------------------------------------------------------------
// ParkEntrance — the RCT2 PARK entrance gate: two square masonry towers with
// pyramidal slate roofs flanking a wide archway over the path, a deep stone
// beam across the opening carrying a white marquee sign band on BOTH faces,
// ticket booths under striped awnings in the tower fronts, open wrought-iron
// gate leaves folded back against the piers, night-gated lanterns on BOTH tower
// faces and iron fence stubs running outward. Guests stream through the arch:
// the group faces local +z with the park OUTSIDE at +z — new guests appear at
// `spawnPoint` just outside the arch and walk in through `archway` (both
// returned in local coordinates for the GameManager).
//
// DETAILED (2026-07) after fixed-angle ortho elevations (harness
// `shot-views.mjs entrance --comp=ParkEntrance:buildParkEntrance`). The old
// gate read as ONE FLAT GREY BLOB with two bare cones on top, and the reasons
// were specific:
//
//   * the three "stones" (0x9b948a / 0xb3aca0 / 0x837b70) were three
//     near-identical greys, so quoins, cornice and plinth carried NO value
//     contrast and the articulation was invisible at park distance. The light
//     and dark stones are now pulled far apart (0xcfc7b2 / 0x6b6358), and the
//     only saturated colour in the piece — gilt hardware, bottle-green iron, a
//     green-and-cream awning, a red pennant — is put where the eye goes.
//   * the roofs were 4-sided cones with NOTHING on them. The park camera looks
//     DOWN on roofs, so that is where a set-piece earns its frame: they now get
//     the same vocabulary the pack's gazebo and wishingWell got — an eaves
//     course, three stepped SHINGLE COURSES, a HIP CAP up each of the four
//     arrises, an apex cap, a gilt finial and a pennant.
//   * the marquee was 12 identical bars at even spacing, i.e. a BARCODE. It is
//     now two WORD GROUPS of varying stroke widths on a shared baseline, with
//     taller initial caps, inside a gilt frame.
//   * the towers had no mouldings between plinth and cornice: added a plinth
//     cap, a string course, a bed mould, a blind panel on each outer face and a
//     gilt-bossed plaque on each inner face.
//   * there were no gates and no booth. Added open iron gate leaves, a ticket
//     counter on corbels, a striped awning with a scalloped valance and a brass
//     window grille.
//   * the lantern was on the OUTSIDE face only, so the gate went dark from
//     inside the park: mirrored onto the −z face (dimmer, shorter range).
//   * the threshold was one plain rectangle: now flagstone paving with real
//     joints and a lighter edging course, over a dark bedding slab.
//
// DRAW CALLS WENT DOWN, NOT UP. The old gate was 99 unmerged meshes; this one
// is ~21, because everything static is collapsed into one `mergedBoxes` /
// `mergedParts` batch per material. Only the four lantern glasses stay separate
// (they mutate their own material every frame). ParkEntrance is placed ONCE per
// park (`registerParkEntrance` — the sole guest spawn), so triangles are the
// cheap axis here and draw calls are the one worth spending.
//
// CLEARANCE IS A CONTRACT, NOT A HOPE. Nothing added may enter the walkable
// throat. Audited by `harness/mp3d-render/probe-entrance-attach.mjs` at widths
// 1.6 and 2.4: the narrowest clear half-width at guest height ("PINCH") is
// still set by the tower PLINTHS at 0.73 / 1.13 exactly as before — the gate
// leaves stand at 0.75 / 1.15, outboard of them — and headroom under the arch
// is still 1.12 (the haunches). Same probe proves every one of the ~230 added
// parts reaches masonry by exact surface-to-surface distance.
// ---------------------------------------------------------------------------

export interface ParkEntranceOpts {
  /** clear width of the arch opening in x (default 1.6 — two peeps abreast) */
  width?: number;
}

export function buildParkEntrance(
  t: typeof THREE,
  opts: ParkEntranceOpts = {},
): { group: THREE.Group; spawnPoint: [number, number, number]; archway: [number, number, number] } {
  const W = opts.width ?? 1.6; // clear arch opening (x)
  const g = new t.Group();

  // ---- palette -------------------------------------------------------------
  // The three stones are a real VALUE LADDER now (~0.79 / 0.59 / 0.40 relative
  // luminance). The old set was 0xb3aca0 / 0x9b948a / 0x837b70 — a 0.10 spread
  // top to bottom, which is why the elevations read as one grey mass.
  const STONE = 0x9b948a; // warm grey masonry field
  const STONE_LT = 0xcfc7b2; // pale limestone: quoins, mouldings, cornice, coping
  const STONE_DK = 0x6b6358; // dark base course: plinths, haunches, sunk panels
  const ROOF = 0x4f6070; // slate field
  const ROOF_DK = 0x35424e; // slate hips, eaves + shingle courses (the shadow lines)
  const SIGN_BG = 0xf4f2ea; // marquee board
  const LETTER = 0x2a3140; // dark navy "lettering" strokes
  const GILT = 0xb8912f; // brass: sign frame, finials, spear tips, grille, bosses
  const IRON = 0x27342c; // bottle-green wrought iron — park railings are green
  const CANVAS_A = 0x2e6b48; // awning green
  const CANVAS_B = 0xe9e2cc; // awning cream
  const PENNANT = 0xa8392e; // flag red
  const GLASS = 0xffe9a8; // lantern glass
  const PAVE = 0x8e8b7b; // threshold flagstones
  const PAVE_LT = 0xa8a48f; // edging course
  const PAVE_DK = 0x5f5c53; // bedding slab showing in the joints

  const TW = 0.72; // tower plan size (x and z)
  const HW = TW / 2; // 0.36 — tower half-plan, every face offset is measured off this
  const tx = W / 2 + HW; // tower centre |x| (= 1.16 at default width)
  const shaftH = 1.5; // shaft: y 0.12..1.62

  // ---- batches: one merged mesh per material ------------------------------
  const stone: MergedBoxSpec[] = []; // shafts + arch beam
  const stoneL: MergedBoxSpec[] = []; // all pale trim + mouldings
  const stoneD: MergedBoxSpec[] = []; // plinths, haunches, sunk panel fields, post pads
  const iron: MergedBoxSpec[] = []; // gates, fence, lantern brackets + cages, masts
  const gilt: MergedBoxSpec[] = []; // sign frame, window grilles
  const boards: MergedBoxSpec[] = []; // marquee boards
  const letters: MergedBoxSpec[] = []; // marquee lettering
  const panes: MergedBoxSpec[] = []; // booth glazing
  const canvasA: MergedBoxSpec[] = []; // awning stripes + hem
  const canvasB: MergedBoxSpec[] = []; // awning field + scallops + flag stripe
  const pennants: MergedBoxSpec[] = []; // flag cloth
  const paveF: MergedBoxSpec[] = []; // flagstone field
  const paveE: MergedBoxSpec[] = []; // flagstone edging course
  const roofP: PartSpec[] = []; // slate pyramids
  const roofD: PartSpec[] = []; // slate courses, hips, caps
  const giltP: PartSpec[] = []; // gilt cones, balls, discs

  // ---- shared geometries for the merged non-box parts ----------------------
  // Each is used in exactly ONE mergedParts call, so `dispose` can stay on.
  const sq = Math.PI / 4; // a 4-segment cylinder needs 45° to sit square on the tower
  const coneGeo = new t.CylinderGeometry(0.001, 0.68, 0.46, 4); // roof pyramid
  const eaveGeo = new t.CylinderGeometry(0.71, 0.715, 0.05, 4); // eaves course, overhanging
  const hipGeo = new t.BoxGeometry(0.08, 0.05, 1); // hip cap, scaled to length in z
  const apexGeo = new t.CylinderGeometry(0.001, 0.115, 0.1, 4); // cap where the four hips meet
  const neckGeo = new t.CylinderGeometry(0.03, 0.055, 0.1, 8); // roof finial neck
  const knobGeo = new t.IcosahedronGeometry(0.055, 1); // roof finial ball
  const capGeo = new t.CylinderGeometry(0.02, 0.055, 0.055, 8); // lantern drop cap
  const dropGeo = new t.CylinderGeometry(0.022, 0.001, 0.045, 6); // lantern bottom finial
  const finialGeo = new t.IcosahedronGeometry(0.035, 1); // fence post ball
  const spearGeo = new t.CylinderGeometry(0.001, 0.027, 0.055, 4); // fence picket spear
  const gSpearGeo = new t.CylinderGeometry(0.001, 0.026, 0.05, 4); // gate picket spear
  const gCapGeo = new t.CylinderGeometry(0.001, 0.04, 0.07, 4); // gate stile spear
  const bossGeo = new t.CylinderGeometry(0.055, 0.055, 0.03, 12); // plaque boss
  // three SHINGLE COURSES stepping up the pyramid, each a thin 4-gon ring
  // standing 0.014 proud of the slope so it throws a course line from above
  // (the gazebo's roof formula, re-derived for base radius 0.68 / rise 0.46)
  const COURSES = [0.2, 0.44, 0.68].map((u) => ({
    geo: new t.CylinderGeometry(0.68 * (1 - u - 0.05) + 0.014, 0.68 * (1 - u) + 0.014, 0.03, 4),
    y: 1.7 + u * 0.46 + 0.015,
  }));

  // ---- threshold: FLAGSTONE paving over a dark bedding slab ---------------
  // The old threshold was one 0.06 rectangle. Footprint is unchanged (the
  // <Gate> wrapper puts a 3.2 × 1.2 plinth under this, and the park's own path
  // mesh butts it), but the top surface is now laid in flags with real 0.022
  // joints through which the dark bedding shows — which is what the park camera
  // actually looks at on the approach. Flags span y 0.02..0.06, so the walking
  // surface is exactly where it was and nothing rises above it.
  const PD = TW + 0.4; // 1.12 — slab depth in z
  g.add(box(t, [W, 0.045, PD], PAVE_DK, [0, 0.0225, 0], { tex: 'concrete', repeat: [4, 3], rough: 0.96, bump: 0.03 }));
  const NX = Math.max(4, Math.round(W / 0.4)); // 4 flags across at W 1.6, 6 at 2.4
  const NZ = 4;
  const cw = W / NX;
  const cd = PD / NZ;
  for (let i = 0; i < NX; i += 1) {
    for (let k = 0; k < NZ; k += 1) {
      const spec: MergedBoxSpec = {
        dims: [cw - 0.022, 0.04, cd - 0.022],
        pos: [-W / 2 + (i + 0.5) * cw, 0.04, -PD / 2 + (k + 0.5) * cd],
        repeat: [2, 2],
      };
      // perimeter flags are the EDGING course, a shade lighter — an entrance
      // apron laid all one colour is still a grey rectangle from above
      (i === 0 || i === NX - 1 || k === 0 || k === NZ - 1 ? paveE : paveF).push(spec);
    }
  }

  // ---- twin towers --------------------------------------------------------
  [-1, 1].forEach((s) => {
    const cx = s * tx;

    // plinth / shaft / the moulding LADDER between them. A pier with nothing
    // between its base and its cornice is a box; the string course at 0.62 and
    // the bed mould at 1.60 are what make the 1.5 of shaft read as masonry.
    stoneD.push({ dims: [0.86, 0.12, 0.86], pos: [cx, 0.06, 0], repeat: [3, 1] }); // plinth 0…0.12
    stone.push({ dims: [TW, shaftH, TW], pos: [cx, 0.12 + shaftH / 2, 0], repeat: [2, 4] }); // shaft 0.12…1.62
    stoneL.push({ dims: [0.82, 0.05, 0.82], pos: [cx, 0.145, 0], repeat: [3, 1] }); // plinth cap 0.12…0.17
    stoneL.push({ dims: [0.8, 0.055, 0.8], pos: [cx, 0.62, 0], repeat: [3, 1] }); // string course
    stoneL.push({ dims: [0.78, 0.04, 0.78], pos: [cx, 1.6, 0], repeat: [3, 1] }); // bed mould 1.58…1.62
    stoneL.push({ dims: [0.86, 0.09, 0.86], pos: [cx, 1.665, 0], repeat: [3, 1] }); // cornice 1.62…1.71
    // corner quoin strips, centred on the shaft corners so they sit proud
    [-1, 1].forEach((qx) =>
      [-1, 1].forEach((qz) =>
        stoneL.push({ dims: [0.09, shaftH, 0.09], pos: [cx + qx * HW, 0.12 + shaftH / 2, qz * HW], repeat: [1, 5] }),
      ),
    );

    // BLIND PANEL on the OUTER (±x) face — the elevation that was a blank
    // slab. A sunk field 0.015 proud of the wall inside a frame 0.025 proud, so
    // the field reads RECESSED. Both embed 0.005 into the wall; the panel starts
    // at y 0.77, clear of the fence post's finial ball (top 0.713).
    const px = cx + s * (HW + 0.005);
    const fx = cx + s * (HW + 0.01);
    stoneD.push({ dims: [0.02, 0.58, 0.4], pos: [px, 1.1, 0], repeat: [1, 3] }); // field 0.81…1.39
    stoneL.push({ dims: [0.03, 0.05, 0.48], pos: [fx, 0.795, 0], repeat: [2, 1] }); // frame bottom 0.77…0.82
    stoneL.push({ dims: [0.03, 0.05, 0.48], pos: [fx, 1.405, 0], repeat: [2, 1] }); // frame top 1.38…1.43
    [-1, 1].forEach((pz) => stoneL.push({ dims: [0.03, 0.66, 0.05], pos: [fx, 1.1, pz * 0.235], repeat: [1, 3] }));

    // PLAQUE on the INNER (−z) face, i.e. the face you see from inside the
    // park, which had nothing on it at all: the same sunk-panel idiom plus a
    // gilt boss. (The tower's arch-facing ±x inner faces get value contrast
    // from the quoins instead — they are only 0.72 wide between quoins and
    // anything proud there eats arch clearance.)
    stoneD.push({ dims: [0.34, 0.24, 0.02], pos: [cx, 1.02, -(HW + 0.005)], repeat: [2, 2] }); // field 0.90…1.14
    stoneL.push({ dims: [0.42, 0.045, 0.03], pos: [cx, 1.1625, -(HW + 0.01)], repeat: [2, 1] });
    stoneL.push({ dims: [0.42, 0.045, 0.03], pos: [cx, 0.8775, -(HW + 0.01)], repeat: [2, 1] });
    [-1, 1].forEach((ex) => stoneL.push({ dims: [0.045, 0.33, 0.03], pos: [cx + ex * 0.1875, 1.02, -(HW + 0.01)], repeat: [1, 2] }));
    giltP.push({ geo: bossGeo, matrix: mtx(t, [cx, 1.02, -(HW + 0.022)], [Math.PI / 2, 0, 0]) }); // boss, 0.008 into the field

    // ---- THE ROOF ---------------------------------------------------------
    // The pyramid itself is unchanged: a 4-sided cone rotated 45° so its square
    // base aligns with the tower. Radius 0.68 → half-side 0.4808, a real 0.06
    // EAVE OVERHANG past the 0.84 cornice; base seated at 1.70, embedding 0.01
    // into the cornice top (1.71) so no coplanar cap face shimmers.
    //
    // What is new is the ARTICULATION on it, because the park camera looks down
    // and a bare cone contributes nothing to that view: an eaves course, three
    // shingle courses, a hip cap up each of the four arrises, an apex cap over
    // the point where they meet, and a gilt finial carrying a pennant.
    roofP.push({ geo: coneGeo, matrix: mtx(t, [cx, 1.93, 0], [0, sq, 0]) });
    roofD.push({ geo: eaveGeo, matrix: mtx(t, [cx, 1.725, 0], [0, sq, 0]) }); // 1.70…1.75, half-side 0.502
    COURSES.forEach((c) => roofD.push({ geo: c.geo, matrix: mtx(t, [cx, c.y, 0], [0, sq, 0]) }));
    // HIP CAPS. The base corners of a 4-gon of radius 0.68 turned 45° sit at
    // (±0.4808, ±0.4808); the arris runs from there up to the apex at (0, 0).
    // The cap is a box whose local +Z is aimed down that line and scaled to its
    // length, so it straddles the arris — half proud, half buried in the slope.
    [-1, 1].forEach((hx) =>
      [-1, 1].forEach((hz) => {
        const from = new t.Vector3(cx + hx * 0.4808, 1.712, hz * 0.4808);
        const dir = new t.Vector3(-hx * 0.4808, 2.15 - 1.712, -hz * 0.4808);
        const len = dir.length();
        const unit = dir.clone().normalize();
        roofD.push({
          geo: hipGeo,
          matrix: new t.Matrix4().compose(
            from.clone().addScaledVector(unit, len / 2),
            new t.Quaternion().setFromUnitVectors(new t.Vector3(0, 0, 1), unit),
            new t.Vector3(1, 1, len),
          ),
        });
      }),
    );
    roofD.push({ geo: apexGeo, matrix: mtx(t, [cx, 2.145, 0], [0, sq, 0]) }); // 2.095…2.195 over the 2.16 apex
    giltP.push({ geo: neckGeo, matrix: mtx(t, [cx, 2.18, 0]) }); // neck 2.13…2.23, base buried in the apex cap
    giltP.push({ geo: knobGeo, matrix: mtx(t, [cx, 2.265, 0]) }); // ball 2.21…2.32, overlaps the neck top
    iron.push({ dims: [0.02, 0.34, 0.02], pos: [cx, 2.43, 0] }); // mast 2.26…2.60, foot inside the ball
    pennants.push({ dims: [0.24, 0.14, 0.014], pos: [cx + 0.11, 2.52, 0] }); // luff overlaps the mast by 0.02
    canvasB.push({ dims: [0.24, 0.035, 0.018], pos: [cx + 0.11, 2.52, 0] }); // cream band through the flag

    // ---- ticket booth on the OUTSIDE (+z) face ----------------------------
    // The dark pane sits nearly FLUSH (4 mm proud) inside a proud stone
    // surround — jambs + sill + lintel stand off the wall, so the pane reads
    // recessed, never extruded. Added: a brass GRILLE across the pane, a
    // COUNTER on two corbels (this is a booth guests buy tickets at, and it had
    // no counter), and a striped AWNING over it.
    panes.push({ dims: [0.3, 0.28, 0.05], pos: [cx, 1.02, HW - 0.021] }); // pane front at wall +0.004
    [-1, 1].forEach((jx) => stoneL.push({ dims: [0.05, 0.34, 0.06], pos: [cx + jx * 0.175, 1.02, HW + 0.005], repeat: [1, 2] })); // jambs
    stoneL.push({ dims: [0.4, 0.05, 0.09], pos: [cx, 0.855, HW + 0.02], repeat: [2, 1] }); // sill 0.83…0.88
    stoneL.push({ dims: [0.4, 0.06, 0.07], pos: [cx, 1.21, HW + 0.015], repeat: [2, 1] }); // lintel 1.18…1.24
    [0.955, 1.02, 1.085].forEach((by) => gilt.push({ dims: [0.3, 0.014, 0.014], pos: [cx, by, HW + 0.005] })); // grille, 6 mm into the pane
    stoneL.push({ dims: [0.48, 0.045, 0.16], pos: [cx, 0.815, HW + 0.055], repeat: [3, 1] }); // counter, back 0.025 into the wall
    [-1, 1].forEach((bx) => stoneL.push({ dims: [0.06, 0.15, 0.12], pos: [cx + bx * 0.19, 0.725, HW + 0.04], repeat: [1, 1] })); // corbels 0.65…0.80

    // AWNING. Derived from its two ENDPOINTS rather than a typed pitch, because
    // the near end has to land INSIDE the wall: it runs from (z HW−0.02,
    // y 1.335) — 0.02 behind the tower face — down to (z HW+0.36, y 1.175).
    // rotX θ maps slab-local +z to world (0, −sin θ, cos θ), so a POSITIVE θ
    // drops the outboard end, and local +y maps to (0, cos θ, sin θ), which is
    // how the stripes are offset onto the upper surface.
    const az0 = HW - 0.02;
    const ay0 = 1.335;
    const az1 = HW + 0.36;
    const ay1 = 1.175;
    const aLen = Math.hypot(az1 - az0, ay0 - ay1);
    const aTh = Math.atan2(ay0 - ay1, az1 - az0);
    const acz = (az0 + az1) / 2;
    const acy = (ay0 + ay1) / 2;
    canvasB.push({ dims: [0.52, 0.03, aLen], pos: [cx, acy, acz], rotX: aTh, repeat: [4, 3] });
    [-0.2, -0.1, 0, 0.1, 0.2].forEach((sx) =>
      canvasA.push({
        dims: [0.055, 0.012, aLen],
        pos: [cx + sx, acy + Math.cos(aTh) * 0.019, acz + Math.sin(aTh) * 0.019],
        rotX: aTh,
      }),
    ); // stripes, embedded 0.002 in the 0.03 canvas
    canvasA.push({ dims: [0.52, 0.06, 0.022], pos: [cx, ay1 - 0.02, az1 - 0.005] }); // hem valance off the outboard edge
    [-0.195, -0.065, 0.065, 0.195].forEach((sx) =>
      canvasB.push({ dims: [0.09, 0.035, 0.024], pos: [cx + sx, ay1 - 0.06, az1 - 0.005] }),
    ); // scallops, 0.0075 into the valance
    [-1, 1].forEach((bx) => iron.push({ dims: [0.03, 0.11, 0.03], pos: [cx + bx * 0.17, 1.285, HW + 0.015] })); // knee brackets: lintel → canvas

    // ---- lanterns on BOTH tower faces -------------------------------------
    // It used to be +z only, so the gate went dark seen from INSIDE the park at
    // night. Each is a wall plate + bracket arm + gilt drop cap + a caged warm
    // glass ball + a real PointLight (4 in total; the inner pair is dimmer and
    // shorter-range, since it lights a path rather than a facade). The night
    // gate rides on the glass mesh's own onBeforeRender, so buildParkEntrance
    // keeps its { group, spawnPoint, archway } contract with NO update fn and
    // works under any Stage.
    [1, -1].forEach((zs) => {
      const lz = zs * (HW + 0.14);
      iron.push({ dims: [0.09, 0.14, 0.03], pos: [cx, 1.45, zs * (HW + 0.012)] }); // wall plate, 0.008 into the masonry
      iron.push({ dims: [0.05, 0.05, 0.18], pos: [cx, 1.45, zs * (HW + 0.08)] }); // bracket arm, 0.01 into the masonry
      giltP.push({ geo: capGeo, matrix: mtx(t, [cx, 1.408, lz]) }); // drop cap 1.3805…1.4355, into the arm
      [
        [0.048, 0],
        [-0.048, 0],
        [0, 0.048],
        [0, -0.048],
      ].forEach(([rx, rz]) => iron.push({ dims: [0.012, 0.11, 0.012], pos: [cx + rx, 1.345, lz + rz] })); // cage ribs
      giltP.push({ geo: dropGeo, matrix: mtx(t, [cx, 1.2875, lz]) }); // bottom finial 1.265…1.31
      const glass = ball(t, 0.052, GLASS, [cx, 1.345, lz], { emissive: 0x8a6c20, rough: 0.4 });
      // LIGHT BUDGET IS UNCHANGED AT 2, and that is a measured decision, not a
      // guess. Giving the inner pair real PointLights too took the park's light
      // count 24 → 26 and its frame 1658 → 2015 ms (23.4 → 17.4 fps in the
      // harness's software rasteriser) for two lamps nobody stands under — a
      // forward renderer pays for every light in every lit material's shader.
      // The inner lantern is EMISSIVE ONLY: it still reads as a lit lamp from
      // inside the park after dark (which is the whole point — the gate used to
      // have no lamp at all on that face), it just does not illuminate.
      const lamp = zs > 0 ? new t.PointLight(0xffb45e, 0, 3, 2) : null;
      if (lamp) {
        lamp.position.set(cx, 1.32, lz);
        g.add(lamp);
      }
      g.add(glass);
      const gm = glass.material as THREE.MeshStandardMaterial;
      glass.onBeforeRender = () => {
        const k = nightKOf(glass);
        const ease = k * k * (3 - 2 * k); // smoothstep: 0 by day → full at night
        gm.emissiveIntensity = 0.2 + 1.0 * ease;
        if (lamp) lamp.intensity = 0.9 * ease;
      };
    });
  });

  // ---- archway: deep stone beam spanning the towers (ends embed 0.36 into
  // each shaft — inner tower faces at ±W/2, beam half-length (W+TW)/2) ----
  stone.push({ dims: [W + TW, 0.42, 0.62], pos: [0, 1.47, 0], repeat: [7, 1] });
  stoneL.push({ dims: [W + TW, 0.05, 0.66], pos: [0, 1.295, 0], repeat: [7, 1] }); // architrave 1.27…1.32, inside the soffit
  stoneL.push({ dims: [W + TW + 0.04, 0.045, 0.66], pos: [0, 1.665, 0], repeat: [7, 1] }); // frieze band 1.6425…1.6875
  // COPING, LAID IN STONES. The park camera looks straight down on this, and it
  // is the largest single surface in the piece: as one 2.42 × 0.7 slab of pale
  // stone it was the brightest, blankest plane in the top elevation. It is now
  // six coping stones with 0.02 joints through which the darker frieze shows —
  // which is also how a coping is actually built. Each stone laps the frieze
  // (bottom 1.68 against the frieze top 1.6875) and the end ones also lap the
  // tower cornices, so none of them is carried by a joint.
  const CN = Math.max(4, Math.round((W + TW + 0.1) / 0.42));
  const clen = (W + TW + 0.1) / CN;
  for (let i = 0; i < CN; i += 1)
    stoneL.push({
      dims: [clen - 0.02, 0.08, 0.7],
      pos: [-(W + TW + 0.1) / 2 + (i + 0.5) * clen, 1.72, 0],
      repeat: [2, 2],
    });
  // corner haunches soften the opening into an arch (blocky, RCT2-style), now
  // in TWO STEPS so the transition is moulded rather than a single lump. The
  // outer end of each step embeds 0.02 INSIDE the tower face (no coplanar plane
  // at x ±W/2) and the upper step's top embeds 0.01 into the beam soffit
  // (1.26). Both stay at y ≥ 1.12, i.e. clear above every guest.
  [-1, 1].forEach((s) => {
    stoneD.push({ dims: [0.14, 0.07, 0.44], pos: [s * (W / 2 - 0.05), 1.155, 0], repeat: [1, 1] }); // 1.12…1.19
    stoneD.push({ dims: [0.24, 0.085, 0.52], pos: [s * (W / 2 - 0.1), 1.2275, 0], repeat: [1, 1] }); // 1.185…1.27
  });

  // ---- marquee sign band on BOTH beam faces ------------------------------
  // A PARK NAME, not a barcode. The old band was 12 identical 0.05 bars at an
  // even 0.115 pitch, which is exactly what a barcode is. These are two WORD
  // GROUPS of 3 and 5 strokes whose widths vary 1.66× (0.55…0.92 units),
  // separated by letter gaps of 1.15 and a word gap of 3.0, all laid out in
  // abstract units and scaled ONCE to the board — so the lettering fills the
  // band at any `width` instead of sliding off it. Every stroke stands on a
  // shared BASELINE with the initial of each word taller: caps grow upward, and
  // a stroke centred on the band's mid-line reads as a dash.
  //
  // INK COVERAGE IS THE WHOLE GAME AND THE FIRST ATTEMPT GOT IT BACKWARDS. With
  // strokes of 0.68…1.10 against gaps of 0.36 the lettering covered 69% of the
  // band, so the elevation read as a DARK NAVY BAND WITH PALE SLOTS — the same
  // failure as the barcode, just inverted. These gaps are wider than the widest
  // stroke, putting coverage at 38%, which is where bold caps on a signboard
  // actually sit.
  //
  // The band ends at ±(W/2 + 0.08): embedded into the tower inner corners,
  // never reaching the tower fronts as a coplanar board (the old W+0.5 version
  // lay flat on the tower faces and shimmered). The gilt frame's end stiles do
  // land ON the corner quoins, 0.015 proud of them, which is a lap, not a
  // coplanar pair.
  const WORDS = [
    [0.85, 0.6, 0.88],
    [0.78, 0.92, 0.55, 0.86, 0.68],
  ];
  const LGAP = 1.15;
  const WGAP = 3.0;
  let units = 0;
  WORDS.forEach((word, wi) => {
    if (wi) units += WGAP;
    word.forEach((u, li) => {
      if (li) units += LGAP;
      units += u;
    });
  });
  const span = W - 0.06; // usable board width
  const kx = span / units; // abstract letter units → world x
  [-1, 1].forEach((zs) => {
    const bz = zs * 0.3375; // band spans z 0.305…0.37 — back embeds in the beam face (0.31)
    boards.push({ dims: [W + 0.16, 0.34, 0.065], pos: [0, 1.47, bz] });
    [1.6275, 1.3125].forEach((ry) => gilt.push({ dims: [W + 0.2, 0.035, 0.075], pos: [0, ry, bz] })); // frame rails
    [-1, 1].forEach((ex) => gilt.push({ dims: [0.05, 0.34, 0.075], pos: [ex * (W / 2 + 0.055), 1.47, bz] })); // end stiles
    let cur = -span / 2;
    WORDS.forEach((word, wi) => {
      if (wi) cur += WGAP * kx;
      word.forEach((u, li) => {
        if (li) cur += LGAP * kx;
        const bw = u * kx;
        const h = li === 0 ? 0.225 : 0.185; // taller initial cap
        letters.push({ dims: [bw, h, 0.02], pos: [cur + bw / 2, 1.3775 + h / 2, bz + zs * 0.0305] });
        cur += bw;
      });
    });
  });

  // ---- open GATE LEAVES, folded back against the piers -------------------
  // The opening had no gate at all. These are hinged on the tower FRONT corner
  // and swung fully open, so each leaf lies in the plane x = ±(W/2 − 0.02),
  // running outward in +z alongside the path — which is what an open park gate
  // looks like, and costs the throat nothing: the hinge stile's inboard face
  // stands at |x| 0.75 (1.15 at width 2.4), OUTBOARD of the tower plinths at
  // 0.73 / 1.13, so the measured PINCH does not move. A leaf swung to any
  // partly-closed angle would swing its far stile to |x| ≈ 0.44 and block the
  // arch, so it is not an option here.
  //
  // Each leaf's foot is buried in the plinth (stile bottom 0.09, plinth top
  // 0.12) and its hinge stile laps the corner quoin, so the whole leaf hangs
  // off masonry at two places.
  [-1, 1].forEach((s) => {
    const lx = s * (W / 2 - 0.02);
    const hz = HW - 0.03; // hinge stile 0.30…0.36 — inside the tower front
    const fz = HW + 0.56; // far stile 0.89…0.95
    [hz, fz].forEach((z) => {
      iron.push({ dims: [0.06, 1.01, 0.06], pos: [lx, 0.595, z] }); // stile 0.09…1.10
      giltP.push({ geo: gCapGeo, matrix: mtx(t, [lx, 1.13, z], [0, sq, 0]) }); // stile spear 1.095…1.165
    });
    const midZ = (hz + fz) / 2;
    const rLen = fz - hz + 0.06; // rails run 0.03 into both stiles
    [
      [1.035, 0.055],
      [0.62, 0.04],
      [0.185, 0.05],
    ].forEach(([ry, rh]) => iron.push({ dims: [0.055, rh, rLen], pos: [lx, ry, midZ] }));
    for (let i = 1; i <= 7; i += 1) {
      const pz = hz + ((fz - hz) * i) / 8;
      iron.push({ dims: [0.024, 0.99, 0.024], pos: [lx, 0.6, pz] }); // picket 0.105…1.095
      giltP.push({ geo: gSpearGeo, matrix: mtx(t, [lx, 1.115, pz], [0, sq, 0]) }); // spear 1.09…1.14
    }
  });

  // ---- wrought-iron fence stubs running outward from each tower ----------
  // first post embeds its inner half into the shaft (the old 0.05 offset left a
  // 0.015 daylight gap at the tower face) and all three rails run 0.06 INTO the
  // shaft so the stub visibly grows out of the masonry. Added: a continuous
  // DWARF KERB the railing stands on, a cap under every ball finial, a third
  // rail down at 0.09 and a gilt SPEAR on every picket — plain bars stopping in
  // mid-air is exactly what a park railing never does.
  //
  // The kerb was three separate 0.14 post PADS first, and from the top
  // elevation — the view that matters, since this is ground-level dressing —
  // three isolated pale squares on the grass read as litter, not as a base. One
  // run under the whole stub is both one box instead of three and what a park
  // railing is actually bedded into.
  const FL = 0.95; // stub length
  [-1, 1].forEach((s) => {
    const x0 = s * (tx + HW); // tower outer face
    stoneD.push({ dims: [FL + 0.2, 0.055, 0.17], pos: [x0 + s * (FL / 2 - 0.02), 0.0275, 0], repeat: [4, 1] }); // kerb 0…0.055, 0.06 into the plinth
    [0.02, 0.5, 0.95].forEach((d) => {
      const px = x0 + s * d;
      iron.push({ dims: [0.075, 0.62, 0.075], pos: [px, 0.31, 0] }); // post 0…0.62
      iron.push({ dims: [0.1, 0.03, 0.1], pos: [px, 0.635, 0] }); // cap 0.62…0.65
      giltP.push({ geo: finialGeo, matrix: mtx(t, [px, 0.678, 0]) }); // ball 0.643…0.713
    });
    [0.56, 0.28, 0.09].forEach((ry) => iron.push({ dims: [FL + 0.06, 0.045, 0.045], pos: [x0 + s * (FL / 2 - 0.03), ry, 0] }));
    for (let i = 1; i <= 7; i += 1) {
      const px = x0 + s * ((i * FL) / 8);
      iron.push({ dims: [0.025, 0.5, 0.025], pos: [px, 0.32, 0] }); // picket 0.07…0.57
      giltP.push({ geo: spearGeo, matrix: mtx(t, [px, 0.595, 0], [0, sq, 0]) }); // spear 0.5675…0.6225
    }
  });

  // ---- collapse every batch into one mesh per material -------------------
  g.add(mergedBoxes(t, paveF, PAVE, { tex: 'concrete', rough: 0.95, bump: 0.03 }));
  g.add(mergedBoxes(t, paveE, PAVE_LT, { tex: 'concrete', rough: 0.95, bump: 0.03 }));
  g.add(mergedBoxes(t, stone, STONE, { tex: 'concrete', rough: 0.92, bump: 0.035 }));
  g.add(mergedBoxes(t, stoneL, STONE_LT, { tex: 'concrete', rough: 0.9, bump: 0.02 }));
  g.add(mergedBoxes(t, stoneD, STONE_DK, { tex: 'concrete', rough: 0.95, bump: 0.03 }));
  g.add(mergedBoxes(t, iron, IRON, { rough: 0.62, metal: 0.35 }));
  g.add(mergedBoxes(t, gilt, GILT, { rough: 0.38, metal: 0.7 }));
  g.add(mergedBoxes(t, boards, SIGN_BG, { rough: 0.55 }));
  g.add(mergedBoxes(t, letters, LETTER, { rough: 0.5 }));
  g.add(mergedBoxes(t, panes, 0x22262e, { rough: 0.4 }));
  g.add(mergedBoxes(t, canvasA, CANVAS_A, { tex: 'fabric', rough: 0.9 }));
  g.add(mergedBoxes(t, canvasB, CANVAS_B, { tex: 'fabric', rough: 0.9 }));
  g.add(mergedBoxes(t, pennants, PENNANT, { tex: 'fabric', rough: 0.9 }));
  g.add(mergedParts(t, roofP, mat(t, ROOF, { flat: true, rough: 0.85 })));
  g.add(mergedParts(t, roofD, mat(t, ROOF_DK, { flat: true, rough: 0.8 })));
  g.add(mergedParts(t, giltP, mat(t, GILT, { rough: 0.38, metal: 0.7 })));

  return {
    group: g,
    spawnPoint: [0, 0, HW + 0.55], // just OUTSIDE the arch (+z) — guests appear here
    archway: [0, 0, 0], // under the arch at ground level
  };
}

// Preview: the gate on a path stub with two guests walking in through the
// arch on a loop (outside +z → under the arch → into the park at −z).
export function buildParkEntranceScene(three: typeof THREE): { group: THREE.Group; update?: (time: number) => void } {
  const group = new three.Group();
  const update =
    ((t: typeof THREE, g: THREE.Group) => {
        const { group } = buildParkEntrance(t);
        g.add(group);
        // path stub running through the arch (narrower + lower than the
        // threshold slab so no faces are coplanar)
        g.add(box(t, [1.4, 0.05, 6.4], 0x8f8b80, [0, 0.025, 0], { tex: 'concrete', repeat: [3, 12], rough: 0.95 }));

        const peeps = [
          buildPeep(t, { expression: 'happy' }),
          buildPeep(t, { expression: 'happy', female: true, shirt: 0x2f6fd0 }),
        ];
        peeps.forEach((p) => {
          p.group.scale.setScalar(0.5);
          g.add(p.group);
        });

        return (time) => {
          const span = 5.2;
          peeps.forEach((p, i) => {
            const u = (time * 0.22 + i * 0.5) % 1;
            const z = 2.6 - u * span; // outside → through the arch → into the park
            p.walk(time * 1.6, i * 1.9); // walk() sets the bob y — lift onto the path after
            p.group.position.set(i === 0 ? -0.28 : 0.28, 0.06 + p.group.position.y, z);
            p.group.rotation.y = Math.PI; // facing −z, into the park
          });
        };
      })(three, group) || undefined;
  return { group, update };
}

/** <ParkEntrance> — composable (components/Park/Context.md): mounts the scene at
 *  `position`/`rotation`/`scale` inside a <Park> or <ScenePreview>. */
export const ParkEntrance = composable('ParkEntrance', (t) => buildParkEntranceScene(t));

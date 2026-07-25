import React from 'react';
import * as THREE from 'three';
import { box, cyl, ball, nightKOf } from '../Stage';
import { buildPeep } from '../Guest';
import { composable } from '../Park';

// ---------------------------------------------------------------------------
// ParkEntrance — the RCT2 PARK entrance gate: two square masonry towers with
// pyramidal slate roofs flanking a wide archway over the path, a deep stone
// beam across the opening carrying a white marquee sign band ("PARK NAME" as
// dark geometric bar strokes — no text textures) on BOTH faces, ticket-booth
// windows in the tower fronts, wrought-iron fence stubs running outward from
// each tower and night-gated warm lanterns on the tower faces. Guests stream
// through the arch: the group faces local +z with the park OUTSIDE at +z —
// new guests appear at `spawnPoint` just outside the arch and walk in through
// `archway` (both returned in local coordinates for the GameManager).
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

  const STONE = 0x9b948a; // warm grey masonry
  const STONE_LT = 0xb3aca0; // quoins / cornice / coping
  const STONE_DK = 0x837b70; // plinths, haunches
  const ROOF = 0x5f6b74; // slate pyramid roofs
  const SIGN_BG = 0xf4f2ea; // white marquee band
  const LETTER = 0x2a3140; // dark navy "lettering" strokes
  const IRON = 0x33383d; // fence / brackets
  const GLASS = 0xffe9a8; // lantern glass

  const TW = 0.72; // tower plan size (x and z)
  const tx = W / 2 + TW / 2; // tower centre |x| (= 1.16 at default width)
  const shaftH = 1.5; // shaft: y 0.12..1.62

  // paved threshold slab through the arch (the path continues onto it)
  g.add(box(t, [W, 0.06, TW + 0.4], 0x93907f, [0, 0.03, 0], { tex: 'concrete', repeat: [5, 3], rough: 0.95 }));

  // ---- twin towers ----
  [-1, 1].forEach((s) => {
    const cx = s * tx;
    // plinth + shaft (concrete tex + bump on every large face) + cornice
    g.add(box(t, [0.86, 0.12, 0.86], STONE_DK, [cx, 0.06, 0], { tex: 'concrete', repeat: [3, 1], rough: 0.95, bump: 0.03 }));
    g.add(box(t, [TW, shaftH, TW], STONE, [cx, 0.12 + shaftH / 2, 0], { tex: 'concrete', repeat: [2, 4], rough: 0.92, bump: 0.035 }));
    // corner quoin strips, centred on the shaft corners so they sit proud
    [-1, 1].forEach((qx) =>
      [-1, 1].forEach((qz) =>
        g.add(
          box(t, [0.09, shaftH, 0.09], STONE_LT, [cx + qx * (TW / 2), 0.12 + shaftH / 2, qz * (TW / 2)], {
            tex: 'concrete',
            repeat: [1, 5],
            rough: 0.92,
          }),
        ),
      ),
    );
    g.add(box(t, [0.84, 0.09, 0.84], STONE_LT, [cx, 1.665, 0], { tex: 'concrete', repeat: [3, 1], rough: 0.92 })); // cornice
    // pyramidal roof: a 4-sided cone rotated 45° so its square base aligns
    // with the tower. Radius 0.68 → half-side 0.48: a real 0.06 EAVE OVERHANG
    // past the 0.84 cornice; base seated at 1.70, embedding 0.01 into the
    // cornice top (1.71) so no coplanar cap face shimmers.
    g.add(cyl(t, 0.001, 0.68, 0.46, ROOF, [cx, 1.93, 0], { seg: 4, rotY: Math.PI / 4, flat: true, rough: 0.85 }));
    g.add(ball(t, 0.045, IRON, [cx, 2.17, 0], { flat: true, rough: 0.6, metal: 0.4 })); // finial, embedding the apex (2.16)

    // ticket-booth window on the OUTSIDE (+z) face: the dark pane sits nearly
    // FLUSH (4 mm proud) inside a proud stone surround — jambs + sill +
    // lintel stand off the wall, so the pane reads recessed, never extruded
    g.add(box(t, [0.3, 0.28, 0.05], 0x22262e, [cx, 1.02, TW / 2 - 0.021], { rough: 0.4 })); // pane front at wall +0.004
    [-1, 1].forEach((jx) => g.add(box(t, [0.05, 0.34, 0.06], STONE_LT, [cx + jx * 0.175, 1.02, TW / 2 + 0.005], { tex: 'concrete', repeat: [1, 2], rough: 0.92 }))); // jambs
    g.add(box(t, [0.4, 0.05, 0.09], STONE_LT, [cx, 0.855, TW / 2 + 0.02], { tex: 'concrete', repeat: [2, 1], rough: 0.92 })); // sill
    g.add(box(t, [0.4, 0.06, 0.07], STONE_LT, [cx, 1.21, TW / 2 + 0.015], { tex: 'concrete', repeat: [2, 1], rough: 0.92 })); // lintel

    // night-gated lantern on the +z face: iron bracket + drop cap + warm glass
    // ball + a real PointLight. The gate rides on the glass mesh's
    // onBeforeRender so buildParkEntrance keeps its { group, spawnPoint,
    // archway } contract with no update fn — works under any Stage.
    const lz = TW / 2 + 0.14;
    g.add(box(t, [0.05, 0.05, 0.18], IRON, [cx, 1.45, TW / 2 + 0.08], { rough: 0.7, metal: 0.3 }));
    g.add(cyl(t, 0.02, 0.05, 0.05, IRON, [cx, 1.41, lz], { rough: 0.7, seg: 8 }));
    const glass = ball(t, 0.052, GLASS, [cx, 1.345, lz], { emissive: 0x8a6c20, rough: 0.4 });
    const lamp = new t.PointLight(0xffb45e, 0, 3, 2);
    lamp.position.set(cx, 1.32, lz);
    g.add(glass, lamp);
    const gm = glass.material as THREE.MeshStandardMaterial;
    glass.onBeforeRender = () => {
      const k = nightKOf(glass);
      const ease = k * k * (3 - 2 * k); // smoothstep: 0 by day → full at night
      gm.emissiveIntensity = 0.2 + 1.0 * ease;
      lamp.intensity = 0.9 * ease;
    };
  });

  // ---- archway: deep stone beam spanning the towers (ends embed 0.36 into
  // each shaft — inner tower faces at ±0.8, beam half-length 1.16) ----
  g.add(box(t, [W + TW, 0.42, 0.62], STONE, [0, 1.47, 0], { tex: 'concrete', repeat: [7, 1], rough: 0.92, bump: 0.035 }));
  g.add(box(t, [W + TW + 0.1, 0.08, 0.7], STONE_LT, [0, 1.72, 0], { tex: 'concrete', repeat: [7, 1], rough: 0.92 })); // coping
  // corner haunches soften the opening into an arch (blocky, RCT2-style) —
  // 0.20 wide so the outer end embeds 0.01 INSIDE the tower face (no
  // coplanar plane at x ±0.8), top flush under the beam soffit (1.26)
  [-1, 1].forEach((s) => g.add(box(t, [0.2, 0.14, 0.5], STONE_DK, [s * (W / 2 - 0.09), 1.19, 0], { tex: 'concrete', repeat: [1, 1], rough: 0.92 })));

  // marquee sign band on BOTH beam faces: white board, dark trim stripes and
  // 12 dark bar strokes reading as the park name — geometric, no text
  // textures. The band ends at ±(W/2 + 0.08): embedded 0.08 into the tower
  // inner corners, NEVER reaching the tower fronts (z ±0.36) — the old
  // W+0.5 board lay coplanar on the tower faces and shimmered.
  [-1, 1].forEach((zs) => {
    const bz = zs * 0.3375; // band spans z 0.305..0.37 — back embeds in the beam face (0.31), front proud of the towers
    g.add(box(t, [W + 0.16, 0.32, 0.065], SIGN_BG, [0, 1.47, bz], { rough: 0.55 }));
    [1, -1].forEach((s) => g.add(box(t, [W + 0.18, 0.03, 0.069], LETTER, [0, 1.47 + s * 0.135, bz], { rough: 0.55 })));
    for (let i = 0; i < 12; i += 1) {
      g.add(box(t, [0.05, 0.17, 0.02], LETTER, [(i - 5.5) * 0.115, 1.47, bz + zs * 0.0305], { rough: 0.5 }));
    }
  });

  // ---- wrought-iron fence stubs running outward from each tower ----
  // first post embeds its inner half into the shaft (the old 0.05 offset
  // left a 0.015 daylight gap at the tower face) and both rails run 0.06
  // INTO the shaft so the stub visibly grows out of the masonry
  const FL = 0.95; // stub length
  [-1, 1].forEach((s) => {
    const x0 = s * (tx + TW / 2); // tower outer face
    [0.02, 0.5, 0.95].forEach((d) => {
      g.add(box(t, [0.07, 0.62, 0.07], IRON, [x0 + s * d, 0.31, 0], { rough: 0.7, metal: 0.3 }));
      g.add(ball(t, 0.035, IRON, [x0 + s * d, 0.655, 0], { flat: true, rough: 0.6, metal: 0.3 }));
    });
    [0.56, 0.28].forEach((ry) => g.add(box(t, [FL + 0.06, 0.045, 0.045], IRON, [x0 + s * (FL / 2 - 0.03), ry, 0], { rough: 0.7, metal: 0.3 })));
    for (let i = 1; i <= 7; i += 1) {
      g.add(box(t, [0.025, 0.46, 0.025], IRON, [x0 + s * (i * FL) / 8, 0.34, 0], { rough: 0.7, metal: 0.3 }));
    }
  });

  return {
    group: g,
    spawnPoint: [0, 0, TW / 2 + 0.55], // just OUTSIDE the arch (+z) — guests appear here
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

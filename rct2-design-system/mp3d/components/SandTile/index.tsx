import React from 'react';
import * as THREE from 'three';
import { box, cyl, ball } from '../Stage';
import { composable } from '../Park';

// Desert sand tile matched to the RCT2 sand terrain: a bevelled sand slab with
// soft dune mounds, rows of wind ripples that follow the dune curves, sun-
// bleached rocks, a saguaro cactus and a bleached steer skull for character.
export function buildSandTileScene(three: typeof THREE): { group: THREE.Group; update?: (time: number) => void } {
  const group = new three.Group();
  const update =
    ((t: typeof THREE, g: THREE.Group) => {
        const SAND = 0xd9c48f;
        const SAND_D = 0xb59b63;
        const SAND_L = 0xe8d6a4;

        // slab + soil rim
        g.add(box(t, [2.2, 0.26, 2.2], SAND, [0, 0.13, 0], { tex: 'sand', repeat: [4, 4], rough: 1, bump: 0.04 }));
        g.add(box(t, [2.24, 0.14, 2.24], SAND_D, [0, -0.01, 0], { tex: 'sand', repeat: [5, 1], rough: 1 }));

        // soft dune mounds (squashed, sand-textured spheres)
        const dune = (x: number, z: number, r: number, h: number, col: number) => {
          const d = ball(t, r, col, [x, 0.26, z], { tex: 'sand', repeat: [3, 2], rough: 1 });
          d.scale.set(1, h, 1);
          g.add(d);
        };
        dune(-0.45, -0.35, 0.75, 0.42, SAND_L);
        dune(0.55, 0.25, 0.6, 0.36, SAND);
        dune(0.15, -0.7, 0.45, 0.3, SAND_L);
        dune(-0.6, 0.6, 0.4, 0.28, SAND);

        // wind ripples: thin crescents resting ON the sand surface — bottoms
        // flush with the slab top (0.26), crests proud by ~1cm, never floating
        for (let row = 0; row < 7; row++) {
          const z0 = -0.9 + row * 0.3;
          for (let k = 0; k < 4; k++) {
            const x0 = -0.85 + k * 0.5 + (row % 2) * 0.22;
            g.add(
              box(t, [0.4, 0.018, 0.05], SAND_D, [x0, 0.266, z0], {
                rough: 1,
                rotY: 0.35 + Math.sin(row * 1.7 + k) * 0.25,
              }),
            );
          }
        }

        // sun-bleached rocks
        [
          [-0.85, 0.8, 0.11],
          [0.9, -0.75, 0.09],
          [0.8, 0.85, 0.07],
        ].forEach(([x, z, r]) => g.add(ball(t, r as number, 0xa89f8c, [x as number, 0.3, z as number], { tex: 'concrete', repeat: [2, 2], flat: true, rough: 1 })));

        // saguaro cactus: trunk + two elbow arms
        const CAC = 0x4c7a3a;
        g.add(cyl(t, 0.09, 0.11, 0.85, CAC, [-0.75, 0.68, -0.65], { tex: 'leaf', repeat: [2, 3], rough: 0.9, seg: 10 }));
        g.add(cyl(t, 0.055, 0.06, 0.3, CAC, [-0.93, 0.72, -0.65], { tex: 'leaf', rough: 0.9, seg: 8, rotZ: Math.PI / 2 }));
        g.add(cyl(t, 0.055, 0.06, 0.34, CAC, [-1.05, 0.92, -0.65], { tex: 'leaf', rough: 0.9, seg: 8 }));
        g.add(cyl(t, 0.05, 0.055, 0.24, CAC, [-0.58, 0.78, -0.65], { tex: 'leaf', rough: 0.9, seg: 8, rotZ: -Math.PI / 2 }));
        g.add(cyl(t, 0.05, 0.055, 0.26, CAC, [-0.48, 0.95, -0.65], { tex: 'leaf', rough: 0.9, seg: 8 }));

        // bleached steer skull half-buried in the sand
        g.add(ball(t, 0.09, 0xe8e2d2, [0.55, 0.28, -0.5], { flat: true, rough: 0.8 }));
        g.add(box(t, [0.07, 0.04, 0.06], 0xe8e2d2, [0.55, 0.27, -0.42], { rough: 0.8 })); // muzzle, proud of the sand
        [-1, 1].forEach((s) =>
          g.add(cyl(t, 0.012, 0.02, 0.16, 0xdcd4c0, [0.55 + s * 0.11, 0.34, -0.52], { rough: 0.8, seg: 6, rotZ: s * 1.2 })),
        );
      })(three, group) || undefined;
  return { group, update };
}

/** <SandTile> — composable (components/Park/Context.md): mounts the scene at
 *  `position`/`rotation`/`scale` inside a <Park> or <ScenePreview>. */
export const SandTile = composable('SandTile', (t) => buildSandTileScene(t));

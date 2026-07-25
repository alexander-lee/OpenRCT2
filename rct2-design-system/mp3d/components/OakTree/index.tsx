import React from 'react';
import * as THREE from 'three';
import { cyl, ball } from '../Stage';
import { composable } from '../Park';

// An oak tree modelled from the RCT2 scenery sprite: a wood-grain trunk under a
// cluster of chunky, leaf-textured olive/green foliage blobs. Sways gently.
export function buildOakTreeScene(three: typeof THREE): { group: THREE.Group; update?: (time: number) => void } {
  const group = new three.Group();
  const update =
    ((t: typeof THREE, g: THREE.Group) => {
        const BARK = 0x5a3d22;
        const greens = [0x6f8f3a, 0x5c7d2e, 0x86a84a, 0x7c9a40];
        const tree = new t.Group();
        g.add(tree);
        tree.add(cyl(t, 0.14, 0.2, 1.1, BARK, [0, 0.55, 0], { tex: 'wood', repeat: [3, 3], rough: 1 }));
        const blobs: [number, number, number, number, number][] = [
          [0, 1.55, 0, 0.74, greens[0]],
          [-0.52, 1.36, 0.18, 0.52, greens[1]],
          [0.5, 1.42, -0.12, 0.56, greens[2]],
          [0.12, 1.9, -0.05, 0.52, greens[3]],
          [-0.22, 1.58, -0.46, 0.46, greens[1]],
          [0.36, 1.64, 0.42, 0.47, greens[2]],
          [-0.05, 1.28, 0.5, 0.44, greens[0]],
        ];
        blobs.forEach(([x, y, z, r, c]) =>
          tree.add(ball(t, r, c, [x, y, z], { tex: 'leaf', repeat: [3, 3], flat: true, rough: 1 })),
        );
        return (time) => {
          tree.rotation.z = Math.sin(time * 1.1) * 0.025;
          tree.rotation.x = Math.cos(time * 0.9) * 0.02;
        };
      })(three, group) || undefined;
  return { group, update };
}

/** <OakTree> — composable (components/Park/Context.md): mounts the scene at
 *  `position`/`rotation`/`scale` inside a <Park> or <ScenePreview>. */
export const OakTree = composable('OakTree', (t) => buildOakTreeScene(t));

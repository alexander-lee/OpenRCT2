import React from 'react';
import * as THREE from 'three';
import { box, cyl, ball } from '../Stage';
import { buildPeep } from '../Guest';
import { composable } from '../Park';

// Dirt path matched to the RCT2 dirt footpath: a trodden-earth walkway with
// darker worn ruts, embedded pebbles, packed-earth edging (the standard tile
// footprint + kerb cross-section in the dirt palette) and grass tufts on the
// verges. A guest strolls its length on a walk cycle.
export function buildDirtPathScene(three: typeof THREE): { group: THREE.Group; update?: (time: number) => void } {
  const group = new three.Group();
  const update =
    ((t: typeof THREE, g: THREE.Group) => {
        const DIRT = 0x9a7448;
        const DIRT_D = 0x7a5a34;
        // uniform footpath tile: SAME 1.2 x 2.4 footprint and 0.09 surface
        // height as NormalPath, in the dirt palette; carried 0.02 below grade
        g.add(box(t, [1.2, 0.11, 2.4], DIRT, [0, 0.035, 0], { tex: 'sand', repeat: [3, 7], rough: 1, bump: 0.05 }));
        // shared kerb cross-section (0.08 wide, top 0.01 proud) as packed-earth edging
        [-0.62, 0.62].forEach((x) => g.add(box(t, [0.08, 0.12, 2.4], DIRT_D, [x, 0.04, 0], { tex: 'concrete', repeat: [1, 8], rough: 1 })));
        // worn foot ruts + pebbles on the 0.09 surface
        [-0.22, 0.22].forEach((x) => g.add(box(t, [0.07, 0.012, 2.1], DIRT_D, [x, 0.092, 0], { rough: 1 })));
        for (let i = 0; i < 14; i++) {
          g.add(ball(t, 0.02 + (i % 3) * 0.008, 0x8a8072, [Math.sin(i * 2.7) * 0.42, 0.095, -1.05 + i * 0.15], { flat: true, rough: 1 }));
        }
        // grass tufts creeping in from the verges (rooted in the ground at -0.02)
        for (let i = 0; i < 10; i++) {
          const s = i % 2 ? 1 : -1;
          g.add(cyl(t, 0.001, 0.03, 0.09, 0x5c8a3c, [s * (0.68 + (i % 3) * 0.05), 0.025, -1.0 + i * 0.22], { rough: 1, seg: 5 }));
        }
        const p = buildPeep(t, { shirt: 0x2e9e54, expression: 'happy' });
        p.group.scale.setScalar(0.5);
        g.add(p.group);
        return (time) => {
          const z = ((time * 0.35) % 2.2) - 1.1;
          p.walk(time * 2); // walk() sets the bob y — lift onto the trodden surface after
          p.group.position.set(0.1, 0.09 + p.group.position.y, z);
        };
      })(three, group) || undefined;
  return { group, update };
}

/** <DirtPath> — composable (components/Park/Context.md): mounts the scene at
 *  `position`/`rotation`/`scale` inside a <Park> or <ScenePreview>. */
export const DirtPath = composable('DirtPath', (t) => buildDirtPathScene(t));

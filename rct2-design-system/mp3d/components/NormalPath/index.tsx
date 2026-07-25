import React from 'react';
import * as THREE from 'three';
import { box, cyl } from '../Stage';
import { buildPeep } from '../Guest';
import { composable } from '../Park';

// Standard path matched to the RCT2 grey tarmac footpath: a paved walkway with
// pale kerb strips, expansion-joint seams, a litter bin and a bench at the
// verge, and two guests walking opposite directions on walk cycles.
export function buildNormalPathScene(three: typeof THREE): { group: THREE.Group; update?: (time: number) => void } {
  const group = new three.Group();
  const update =
    ((t: typeof THREE, g: THREE.Group) => {
        const PAVE = 0x9a9a96;
        const KERB = 0xb8b8b2;
        // uniform footpath tile: 1.2 x 2.4 slab, surface at H = 0.09, carried
        // 0.02 below grade so there is no air gap over the Stage ground (-0.02)
        g.add(box(t, [1.2, 0.11, 2.4], PAVE, [0, 0.035, 0], { tex: 'asphalt', repeat: [4, 8], rough: 0.95, bump: 0.03 }));
        // shared kerb cross-section (0.08 wide, top 0.01 proud of the slab)
        [-0.62, 0.62].forEach((x) => g.add(box(t, [0.08, 0.12, 2.4], KERB, [x, 0.04, 0], { tex: 'concrete', repeat: [1, 8], rough: 0.9 })));
        // expansion-joint seams every half tile
        for (let z = -1.0; z <= 1.0; z += 0.5) g.add(box(t, [1.2, 0.012, 0.02], 0x77776f, [0, 0.093, z], { rough: 1 }));
        // litter bin (RCT2 black bin with dome lid), base sunk into the grass
        g.add(cyl(t, 0.09, 0.08, 0.26, 0x24282c, [0.85, 0.11, -0.5], { tex: 'metal', repeat: [4, 1], metal: 0.3, rough: 0.6, seg: 12 }));
        g.add(cyl(t, 0.02, 0.095, 0.06, 0x24282c, [0.85, 0.27, -0.5], { metal: 0.3, rough: 0.6, seg: 12 }));
        // wooden bench on the verge (legs run down into the ground)
        g.add(box(t, [0.18, 0.05, 0.5], 0x8a5a28, [-0.9, 0.22, 0.4], { tex: 'wood', repeat: [1, 3], rough: 0.9 }));
        g.add(box(t, [0.05, 0.2, 0.5], 0x8a5a28, [-0.98, 0.3, 0.4], { tex: 'wood', repeat: [1, 3], rough: 0.9 }));
        [-0.18, 0.18].forEach((z) => g.add(box(t, [0.16, 0.22, 0.04], 0x3c4450, [-0.9, 0.09, 0.4 + z], { metal: 0.4, rough: 0.6 })));
        const a = buildPeep(t, { shirt: 0x2f6fd0 });
        const b = buildPeep(t, { shirt: 0xe0a020, expression: 'neutral' });
        [a, b].forEach((p) => { p.group.scale.setScalar(0.5); g.add(p.group); });
        b.group.rotation.y = Math.PI;
        return (time) => {
          const za = ((time * 0.4) % 2.2) - 1.1;
          a.walk(time * 2.2); // walk() sets the bob y — lift onto the slab top after
          a.group.position.set(-0.25, 0.09 + a.group.position.y, za);
          const zb = 1.1 - ((time * 0.35) % 2.2);
          b.walk(time * 2, 1.5);
          b.group.position.set(0.28, 0.09 + b.group.position.y, zb);
        };
      })(three, group) || undefined;
  return { group, update };
}

/** <NormalPath> — composable (components/Park/Context.md): mounts the scene at
 *  `position`/`rotation`/`scale` inside a <Park> or <ScenePreview>. */
export const NormalPath = composable('NormalPath', (t) => buildNormalPathScene(t));

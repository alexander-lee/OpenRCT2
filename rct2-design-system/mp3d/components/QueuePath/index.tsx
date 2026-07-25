import React from 'react';
import * as THREE from 'three';
import { box, cyl } from '../Stage';
import { buildPeep, SHIRTS, SKIN_TONES } from '../Guest';
import { composable } from '../Park';

// Queue line matched to the RCT2 queue path: a NARROW lane sized for exactly
// ONE guest, red pavement with railings down both sides (posts + twin rails)
// and an entrance sign hoop. Guests shuffle forward in single file.
export function buildQueuePathScene(three: typeof THREE): { group: THREE.Group; update?: (time: number) => void } {
  const group = new three.Group();
  const update =
    ((t: typeof THREE, g: THREE.Group) => {
        const PAVE = 0x9e3a34; // red queue pavement
        const RAIL = 0x8a8f98;
        const W = 0.55; // lane width — one guest (shoulders ~0.34 at 0.5 scale)
        // same tile language as NormalPath/DirtPath: 2.4 long, surface at
        // H = 0.09, slab carried 0.02 below grade (no air gap over the ground)
        g.add(box(t, [W, 0.11, 2.4], PAVE, [0, 0.035, 0], { tex: 'asphalt', repeat: [2, 8], rough: 0.95, bump: 0.02 }));
        [-1, 1].forEach((s) => {
          const x = s * (W / 2 - 0.02); // railings stand ON the slab edge, RCT2-style
          for (let z = -1.05; z <= 1.05; z += 0.42) g.add(cyl(t, 0.022, 0.026, 0.42, RAIL, [x, 0.3, z], { tex: 'metal', metal: 0.5, rough: 0.4, seg: 8 })); // post bases on the 0.09 surface
          [0.525, 0.33].forEach((y) => g.add(box(t, [0.03, 0.03, 2.35], RAIL, [x, y, 0], { tex: 'metal', repeat: [1, 10], metal: 0.5, rough: 0.4 }))); // top rail rests exactly on the post tops
        });
        // entrance sign hoop over the lane (posts run down into the ground)
        g.add(box(t, [W + 0.5, 0.16, 0.06], 0xc23434, [0, 0.85, -1.1], { rough: 0.5 }));
        [-1, 1].forEach((s) => g.add(cyl(t, 0.03, 0.035, 0.89, RAIL, [s * (W / 2 + 0.2), 0.425, -1.1], { tex: 'metal', metal: 0.5, rough: 0.4, seg: 8 })));
        // single-file guests shuffling forward
        const peeps = [0, 1, 2].map((i) => {
          const p = buildPeep(t, { skin: SKIN_TONES[i % SKIN_TONES.length], shirt: SHIRTS[(i * 2 + 1) % SHIRTS.length], expression: i === 2 ? 'sad' : 'neutral' });
          p.group.scale.setScalar(0.5);
          g.add(p.group);
          return p;
        });
        return (time) => {
          peeps.forEach((p, i) => {
            const z = ((time * 0.12 + i * 0.28) % 0.84) * 2.4 - 1.0;
            p.walk(time * 1.2, i); // walk() sets the bob y — lift onto the slab top after
            p.group.position.set(0, 0.09 + p.group.position.y, 1.0 - (z + 1.0));
            p.group.rotation.y = Math.PI; // facing the sign hoop
          });
        };
      })(three, group) || undefined;
  return { group, update };
}

/** <QueuePath> — composable (components/Park/Context.md): mounts the scene at
 *  `position`/`rotation`/`scale` inside a <Park> or <ScenePreview>. */
export const QueuePath = composable('QueuePath', (t) => buildQueuePathScene(t));

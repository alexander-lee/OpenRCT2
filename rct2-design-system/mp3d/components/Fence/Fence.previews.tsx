import React from 'react';
import { box, cyl, ball } from '../Stage';
import { ScenePreview } from '../Park';
import { Fence } from './index';

// Preview staging: the three fence styles side by side on a grass verge — a
// wood post-and-rail boundary along the back, a fenced QUEUE lane (metal
// railings down both long sides of a red queue slab, open only at its tail)
// and a clipped hedge loop around a flower bed. The slab, bed and boulders are
// ScenePreview `dress`; every fence is a real <Fence> child.
const hash01 = (n: number) => {
  const s = Math.sin(n * 12.9898 + 78.233) * 43758.5453;
  return s - Math.floor(s);
};

const HEDGE_LOOP: [number, number][] = [
  [1.15, -1.2],
  [3.05, -1.2],
  [3.05, 0.6],
  [1.15, 0.6],
];

const previews = {
  componentName: 'Fence',
  importPath: 'components/Fence',
  previews: [
    {
      name: '3D rig',
      description:
        'RCT2 park fencing in all three styles: a WOOD post-and-rail boundary run (weathered square posts with chamfer caps, two rails per bay), a METAL queue railing flanking both long sides of a queue lane — the style the GameManager rails every ride queue with, so a queue is only enterable at its open tail — and a clipped HEDGE loop around a flower bed (buildFenceLoop/`points`). Every run is batched into one merged mesh per material and registers itself as a guest BLOCKER inside a real <Park>.',
      render: () => (
        <ScenePreview
          distance={6.8}
          targetY={0.4}
          autoRotate={false}
          dress={(t, g) => {
            // the queue lane the metal railings flank (red asphalt slab)
            g.add(box(t, [0.55, 0.09, 3.6], 0x9e3a34, [-1.5, 0.045, 0.1], { tex: 'asphalt', repeat: [2, 12], rough: 0.95, bump: 0.02 }));
            // the flower bed inside the hedge loop: dark soil + hashed blooms
            g.add(box(t, [1.62, 0.06, 1.52], 0x4a3a28, [2.1, 0.03, -0.3], { tex: 'concrete', repeat: [4, 4], rough: 1 }));
            for (let i = 0; i < 14; i++) {
              const bx = 2.1 + (hash01(i * 3.7) - 0.5) * 1.35;
              const bz = -0.3 + (hash01(i * 5.1 + 2) - 0.5) * 1.25;
              g.add(cyl(t, 0.012, 0.012, 0.14, 0x3f6b2c, [bx, 0.13, bz], { rough: 0.9, seg: 5 }));
              g.add(ball(t, 0.045, [0xc8484a, 0xd8b038, 0xc86ea8][i % 3], [bx, 0.21, bz], { flat: true, rough: 0.7 }));
            }
            // a couple of weathered boulders on the verge behind the wood run
            [-3.1, 0.9].forEach((bx, i) => {
              const r = 0.16 + hash01(i + 0.4) * 0.07;
              const st = ball(t, r, 0x837e74, [bx, r * 0.6, -3.1], { tex: 'concrete', repeat: [2, 2], flat: true, rough: 0.95 });
              st.scale.y = 0.7;
              g.add(st);
            });
          }}
        >
          {/* wood post-and-rail boundary across the back */}
          <Fence from={[-4, -2.6]} to={[4, -2.6]} style="wood" />
          {/* the queue lane's metal railings, both long sides, tail open */}
          <Fence from={[-1.8, -1.7]} to={[-1.8, 1.9]} style="metal" />
          <Fence from={[-1.2, -1.7]} to={[-1.2, 1.9]} style="metal" />
          {/* a clipped hedge loop around the flower bed */}
          <Fence points={HEDGE_LOOP} style="hedge" />
        </ScenePreview>
      ),
    },
  ],
};

export default previews;

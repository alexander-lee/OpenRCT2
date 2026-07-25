import React from 'react';
import { cyl, ball } from '../Stage';
import { ScenePreview } from '../Park';
import { Torch } from './index';

// Preview staging: three lit <Torch>es composed around a stone circle — the
// paved plaza disc and weathered boulder ring are ScenePreview `dress`.
const hash01 = (n: number) => {
  const s = Math.sin(n * 12.9898 + 78.233) * 43758.5453;
  return s - Math.floor(s);
};

const torchSpots: [number, number, number][] = [0, 1, 2].map((i) => {
  const th = (i / 3) * Math.PI * 2 + Math.PI / 6;
  return [Math.cos(th) * 1.05, 0.07, Math.sin(th) * 1.05];
});

const previews = {
  componentName: 'Torch',
  importPath: 'components/Torch',
  previews: [
    {
      name: '3D rig',
      description:
        'Three lit torches around a paved stone circle with a boulder ring — rustic wooden poles with leather grip bands, iron sconce baskets and layered buildFire flames. Use the Stage day/night switcher: at night the flickering torch light takes over the scene.',
      render: () => (
        <ScenePreview
          distance={5.6}
          targetY={0.9}
          autoRotate={false}
          dress={(t, g) => {
            // paved stone circle + weathered boulder ring
            g.add(cyl(t, 1.35, 1.45, 0.07, 0x8f8a80, [0, 0.035, 0], { tex: 'concrete', repeat: [10, 1], rough: 0.95, seg: 28 }));
            for (let i = 0; i < 10; i++) {
              const th = (i / 10) * Math.PI * 2 + hash01(i + 0.7) * 0.3;
              const r = 0.1 + hash01(i + 2.3) * 0.06;
              const st = ball(t, r, 0x837e74, [Math.cos(th) * 1.62, r * 0.6, Math.sin(th) * 1.62], { tex: 'concrete', repeat: [2, 2], flat: true, rough: 0.95 });
              st.scale.y = 0.7;
              g.add(st);
            }
          }}
        >
          {torchSpots.map(([x, y, z], i) => (
            <Torch key={i} position={[x, y, z]} />
          ))}
        </ScenePreview>
      ),
    },
  ],
};

export default previews;

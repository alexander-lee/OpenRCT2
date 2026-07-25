import React from 'react';
import { ScenePreview } from '../Park';
import { Volcano } from './index';

const previews = {
  componentName: 'Volcano',
  importPath: 'components/Volcano',
  previews: [
    {
      name: '3D rig',
      description:
        'The volcano landmark by day: an ash-strata cone with a summit crater, a white-hot lava lake, the main flow spilling a rim breach and cooling orange → red → black down the flank into a lava pool, plus an older cooled flow and a glowing ground fissure. Lava reads incandescent in daylight — the glow is never gated off.',
      render: () => (
        <ScenePreview distance={12.6} targetY={0.95} autoRotate={false} ground height={470}>
          <Volcano rotation={1.15} />
        </ScenePreview>
      ),
    },
    {
      name: 'Crater + lava lake',
      description:
        'Close on the summit: dark basalt crust plates with the incandescent crack network between them, the crater wall glowing at depth, the white-yellow lake at ~1100 °C, the ash plume and ember sparks arcing up and cooling to deep red.',
      render: () => (
        <ScenePreview distance={5.1} targetY={1.85} autoRotate={false} ground={false} background="#8fb6c6" height={420}>
          <Volcano rotation={1.15} />
        </ScenePreview>
      ),
    },
    {
      name: 'Night eruption',
      description:
        'The same rig after dark: the crack network is the only light source besides the single warm vent PointLight, so the temperature gradient down the flow reads at its most dramatic.',
      render: () => (
        <ScenePreview distance={12.6} targetY={0.95} autoRotate={false} ground night height={470}>
          <Volcano rotation={1.15} />
        </ScenePreview>
      ),
    },
    {
      name: 'Activity range',
      description:
        'Two cones side by side: a quietly glowing dormant one (activity 0.28 — cracks barely lit, thin plume) and an extinct one (activity 0, no glow, no plume, no light) showing the same crust as plain black basalt scenery.',
      render: () => (
        <ScenePreview distance={13} targetY={0.8} autoRotate={false} ground height={420}>
          <Volcano position={[-3.4, 0]} radius={2.2} height={1.7} activity={0.28} seed={4} />
          <Volcano position={[3.4, 0]} radius={2.2} height={1.7} activity={0} seed={9} />
        </ScenePreview>
      ),
    },
  ],
};

export default previews;

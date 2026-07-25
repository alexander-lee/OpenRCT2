import React from 'react';
import { ScenePreview } from '../Park';
import { ParticleKit } from './index';

const previews = {
  componentName: 'ParticleKit',
  importPath: 'components/ParticleKit',
  previews: [
    {
      name: '3D rig',
      description: 'Four scenes side by side: gravity-pulled water spray, buoyant smoke column, a tri-colour confetti burst firing on a timer, and a layered buildFire campfire (core + outer flame + embers + smoke + flickering light) on a stone ring.',
      render: () => (
        <ScenePreview distance={6.6}
      targetY={0.8}>
          <ParticleKit />
        </ScenePreview>
      ),
    },
  ],
};

export default previews;

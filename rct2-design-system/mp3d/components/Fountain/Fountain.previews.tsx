import React from 'react';
import { ScenePreview } from '../Park';
import { Fountain } from './index';

const previews = {
  componentName: 'Fountain',
  importPath: 'components/Fountain',
  previews: [
    {
      name: '3D rig',
      description: 'Tiered stone fountain: coped basin with real animated water, carved pedestal + two bowls, six arcing jets with droplets, pulsing centre plume.',
      render: () => (
        <ScenePreview distance={7}
      targetY={0.9}
      autoRotate={false}>
          <Fountain />
        </ScenePreview>
      ),
    },
  ],
};

export default previews;

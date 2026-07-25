import React from 'react';
import { ScenePreview } from '../Park';
import { Restroom } from './index';

const previews = {
  componentName: 'Restroom',
  importPath: 'components/Restroom',
  previews: [
    {
      name: '3D rig',
      description: 'RCT2 toilets facility: squat brick 1-tile hut with pitched roof, real door opening, male/female sign and a night-lit occupied lamp; a guest walks in on a loop.',
      render: () => (
        <ScenePreview distance={5}
      targetY={0.7}
      autoRotate={false}>
          <Restroom />
        </ScenePreview>
      ),
    },
  ],
};

export default previews;

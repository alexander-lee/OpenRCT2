import React from 'react';
import { ScenePreview } from '../Park';
import { SpaceRings } from './index';

const previews = {
  componentName: 'SpaceRings',
  importPath: 'components/SpaceRings',
  previews: [
    { name: '3D rig', description: "Space rings: gyroscope rings with a strapped-in rider (SRINGS).", render: () => (
        <ScenePreview distance={5.5}
      targetY={1.1}>
          <SpaceRings />
        </ScenePreview>
      ) },
  ],
};

export default previews;

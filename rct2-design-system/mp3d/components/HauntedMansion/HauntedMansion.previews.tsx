import React from 'react';
import { ScenePreview } from '../Park';
import { HauntedMansion } from './index';

const previews = {
  componentName: 'HauntedMansion',
  importPath: 'components/HauntedMansion',
  previews: [
    { name: '3D rig', description: "A crooked haunted mansion dark ride with flickering windows.", render: () => (
        <ScenePreview distance={9}
      targetY={1.7}
      background="#5a6b86">
          <HauntedMansion />
        </ScenePreview>
      ) },
  ],
};

export default previews;

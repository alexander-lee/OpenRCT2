import React from 'react';
import { ScenePreview } from '../Park';
import { Kit } from './index';

const previews = {
  componentName: 'Kit',
  importPath: 'components/Kit',
  previews: [
    { name: '3D rig', description: "Scenery kit showcase: trees, bench, bin, lamp, fountain, statue and flower bed together.", render: () => (
        <ScenePreview distance={12.5}
      targetY={0.45}
      autoRotate={false}>
          <Kit />
        </ScenePreview>
      ) },
  ],
};

export default previews;

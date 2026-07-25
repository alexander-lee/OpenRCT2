import React from 'react';
import { ScenePreview } from '../Park';
import { SandTile } from './index';

const previews = {
  componentName: 'SandTile',
  importPath: 'components/SandTile',
  previews: [
    { name: '3D rig', description: "A sand land tile with dune ripples from the RCT2 desert surface.", render: () => (
        <ScenePreview distance={4.6}
      targetY={0.35}
      background="#d8ecf4"
      autoRotate={false}>
          <SandTile />
        </ScenePreview>
      ) },
  ],
};

export default previews;

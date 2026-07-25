import React from 'react';
import { ScenePreview } from '../Park';
import { WaterTile } from './index';

const previews = {
  componentName: 'WaterTile',
  importPath: 'components/WaterTile',
  previews: [
    { name: '3D rig', description: "Animated water surface with a custom GLSL wave + Fresnel + sparkle shader.", render: () => (
        <ScenePreview distance={5}
      targetY={0.2}
      background="#bfe6f2"
      ground={false}>
          <WaterTile />
        </ScenePreview>
      ) },
  ],
};

export default previews;

import React from 'react';
import { ScenePreview } from '../Park';
import { PaddleBoats } from './index';

const previews = {
  componentName: 'PaddleBoats',
  importPath: 'components/PaddleBoats',
  previews: [
    { name: '3D rig', description: "Paddle boats: slate hulls with orange planks and churning stern wheels (SPBOAT).", render: () => (
        <ScenePreview distance={6}
      targetY={0.4}
      background="#bfe6f2">
          <PaddleBoats />
        </ScenePreview>
      ) },
  ],
};

export default previews;

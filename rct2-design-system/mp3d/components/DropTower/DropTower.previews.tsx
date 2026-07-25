import React from 'react';
import { ScenePreview } from '../Park';
import { DropTower } from './index';

const previews = {
  componentName: 'DropTower',
  importPath: 'components/DropTower',
  previews: [
    { name: '3D rig', description: "Vertical drop tower: a ring gondola that climbs then drops.", render: () => (
        <ScenePreview distance={9}
      targetY={2.6}>
          <DropTower />
        </ScenePreview>
      ) },
  ],
};

export default previews;

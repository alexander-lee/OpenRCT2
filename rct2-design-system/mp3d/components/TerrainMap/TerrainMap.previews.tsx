import React from 'react';
import { ScenePreview } from '../Park';
import { TerrainMap } from './index';

const previews = {
  componentName: 'TerrainMap',
  importPath: 'components/TerrainMap',
  previews: [
    { name: '3D rig', description: "A generated RCT2-style landscape: stepped grass/sand tiles flooded by the water shader.", render: () => (
        <ScenePreview distance={12}
      targetY={0.4}
      background="#bfe6f2"
      ground={false}
      autoRotate={false}>
          <TerrainMap />
        </ScenePreview>
      ) },
  ],
};

export default previews;

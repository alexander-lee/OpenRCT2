import React from 'react';
import { ScenePreview } from '../Park';
import { TerrainKit } from './index';

const previews = {
  componentName: 'TerrainKit',
  importPath: 'components/TerrainKit',
  previews: [
    { name: '3D rig', description: 'Sculpted deterministic heightfield with hills, a carved lake basin filled by animated water, shoreline sand-to-grass blending, rocky slopes and conforming boulders.', render: () => (
        <ScenePreview distance={13}
      targetY={0.1}
      background="#a8cdd9"
      ground={false}
      autoRotate={false}>
          <TerrainKit />
        </ScenePreview>
      ) },
  ],
};

export default previews;

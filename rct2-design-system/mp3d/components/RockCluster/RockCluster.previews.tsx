import React from 'react';
import { ScenePreview } from '../Park';
import { RockCluster } from './index';

const previews = {
  componentName: 'RockCluster',
  importPath: 'components/RockCluster',
  previews: [
    { name: '3D rig', description: 'A natural rock outcrop: seeded boulders of varied scale and tilt, partially buried, with a small satellite cluster.', render: () => (
        <ScenePreview distance={6.6}
      targetY={0.3}
      autoRotate={false}>
          <RockCluster />
        </ScenePreview>
      ) },
  ],
};

export default previews;

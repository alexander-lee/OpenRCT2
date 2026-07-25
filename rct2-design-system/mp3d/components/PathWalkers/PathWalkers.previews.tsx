import React from 'react';
import { ScenePreview } from '../Park';
import { PathWalkers } from './index';

const previews = {
  componentName: 'PathWalkers',
  importPath: 'components/PathWalkers',
  previews: [
    { name: '3D rig', description: 'Eight guests strolling a tarmac path network, turning at junctions with seeded choices and keeping to their own lanes. Drag to orbit.', render: () => (
        <ScenePreview distance={7.5}
      targetY={0.25}>
          <PathWalkers />
        </ScenePreview>
      ) },
  ],
};

export default previews;

import React from 'react';
import { ScenePreview } from '../Park';
import { Rock } from './index';

const previews = {
  componentName: 'Rock',
  importPath: 'components/Rock',
  previews: [
    { name: '3D rig', description: 'Three deterministic faceted boulders of different seeds and scales in realistic grey-brown concrete-textured tints.', render: () => (
        <ScenePreview distance={4.6}
      targetY={0.3}
      autoRotate={false}>
          <Rock />
        </ScenePreview>
      ) },
  ],
};

export default previews;

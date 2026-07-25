import React from 'react';
import { ScenePreview } from '../Park';
import { FlyingSaucers } from './index';

const previews = {
  componentName: 'FlyingSaucers',
  importPath: 'components/FlyingSaucers',
  previews: [
    {
      name: '3D rig',
      description: 'Electric bumper-saucer pad: six domed saucers drifting over a glowing metallic floor.',
      render: () => (
        <ScenePreview distance={8}
      targetY={0.7}>
          <FlyingSaucers />
        </ScenePreview>
      ),
    },
  ],
};

export default previews;

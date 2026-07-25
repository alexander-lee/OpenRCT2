import React from 'react';
import { ScenePreview } from '../Park';
import { Carousel } from './index';

const previews = {
  componentName: 'Carousel',
  importPath: 'components/Carousel',
  previews: [
    { name: '3D rig', description: "Merry-go-round: spinning horses under a striped canopy, from the RCT2 sprite.", render: () => (
        <ScenePreview distance={6.8}
      targetY={1.05}>
          <Carousel />
        </ScenePreview>
      ) },
  ],
};

export default previews;

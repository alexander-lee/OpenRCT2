import React from 'react';
import { ScenePreview } from '../Park';
import { SwingRide } from './index';

const previews = {
  componentName: 'SwingRide',
  importPath: 'components/SwingRide',
  previews: [
    { name: '3D rig', description: "Chair swing / wave-swinger: chained chairs flung out from a spinning canopy.", render: () => (
        <ScenePreview distance={7.5}
      targetY={1.8}>
          <SwingRide />
        </ScenePreview>
      ) },
  ],
};

export default previews;

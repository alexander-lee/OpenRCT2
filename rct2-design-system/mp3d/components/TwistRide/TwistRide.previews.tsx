import React from 'react';
import { ScenePreview } from '../Park';
import { TwistRide } from './index';

const previews = {
  componentName: 'TwistRide',
  importPath: 'components/TwistRide',
  previews: [
    { name: '3D rig', description: "Twist: three arms with counter-rotating car clusters (TWIST1).", render: () => (
        <ScenePreview distance={6.5}
      targetY={0.7}>
          <TwistRide />
        </ScenePreview>
      ) },
  ],
};

export default previews;

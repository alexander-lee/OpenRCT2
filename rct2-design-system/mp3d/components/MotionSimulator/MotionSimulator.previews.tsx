import React from 'react';
import { ScenePreview } from '../Park';
import { MotionSimulator } from './index';

const previews = {
  componentName: 'MotionSimulator',
  importPath: 'components/MotionSimulator',
  previews: [
    { name: '3D rig', description: "Motion simulator: white pod with pink stripes pitching on hydraulic rams (SIMPOD).", render: () => (
        <ScenePreview distance={5.5}
      targetY={0.9}>
          <MotionSimulator />
        </ScenePreview>
      ) },
  ],
};

export default previews;

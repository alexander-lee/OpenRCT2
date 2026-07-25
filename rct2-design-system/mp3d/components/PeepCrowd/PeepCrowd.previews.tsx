import React from 'react';
import { ScenePreview } from '../Park';
import { PeepCrowd } from './index';

const previews = {
  componentName: 'PeepCrowd',
  importPath: 'components/PeepCrowd',
  previews: [
    { name: '3D rig', description: 'A plaza crowd of ~14 guests (about half female) on a concrete slab — most dancing to a shared beat with hands in the air (bounce, twist, sway, spin-burst), the rest milling about. Drag to orbit.', render: () => (
        <ScenePreview distance={6.5}
      targetY={0.4}>
          <PeepCrowd />
        </ScenePreview>
      ) },
  ],
};

export default previews;

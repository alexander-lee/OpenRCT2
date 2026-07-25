import React from 'react';
import { ScenePreview } from '../Park';
import { Chairlift } from './index';

const previews = {
  componentName: 'Chairlift',
  importPath: 'components/Chairlift',
  previews: [
    { name: '3D rig', description: "Chairlift: orange buckets with flags gliding a cable between pylons (CLIFT1).", render: () => (
        <ScenePreview distance={8.5}
      targetY={1.6}>
          <Chairlift />
        </ScenePreview>
      ) },
    { name: 'Custom circuit (pieces)', description: "Piece-composed HORIZONTAL cable circuit — a rounded triangle of straights and 120° turns; cabins glide a gently sagging rope past cantilever line towers (vertical pieces are stripped — chairlifts never ramp).", render: () => (
        <ScenePreview distance={12}
      targetY={1.4}>
          <Chairlift position={[-3.3, -1.3]} pieces={[
            'station',
            { type: 'turnL', angle: 120, radius: 2.2 },
            { type: 'straight', length: 2.6 },
            { type: 'turnL', angle: 120, radius: 2.2 },
            { type: 'straight', length: 2.6 },
            { type: 'turnL', angle: 120, radius: 2.2 },
          ]} />
        </ScenePreview>
      ) },
  ],
};

export default previews;

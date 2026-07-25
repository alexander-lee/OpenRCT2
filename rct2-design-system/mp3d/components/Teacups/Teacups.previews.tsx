import React from 'react';
import { ScenePreview } from '../Park';
import { Teacups } from './index';

const previews = {
  componentName: 'Teacups',
  importPath: 'components/Teacups',
  previews: [
    { name: '3D rig', description: "Spinning tea-cups flat ride: a turntable of cups that each spin on their own axis.", render: () => (
        <ScenePreview distance={5.8}
      targetY={0.8}>
          <Teacups />
        </ScenePreview>
      ) },
  ],
};

export default previews;

import React from 'react';
import { ScenePreview } from '../Park';
import { BumperCars } from './index';

const previews = {
  componentName: 'BumperCars',
  importPath: 'components/BumperCars',
  previews: [
    { name: '3D rig', description: "Dodgems: a fenced arena with a powered ceiling grid and four darting cars.", render: () => (
        <ScenePreview distance={6.5}
      targetY={0.8}>
          <BumperCars />
        </ScenePreview>
      ) },
  ],
};

export default previews;

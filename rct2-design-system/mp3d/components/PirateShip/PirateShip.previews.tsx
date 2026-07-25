import React from 'react';
import { ScenePreview } from '../Park';
import { PirateShip } from './index';

const previews = {
  componentName: 'PirateShip',
  importPath: 'components/PirateShip',
  previews: [
    { name: '3D rig', description: "Swinging pirate ship on a pivot arm between two towers.", render: () => (
        <ScenePreview distance={8.5}
      targetY={1.7}>
          <PirateShip />
        </ScenePreview>
      ) },
  ],
};

export default previews;

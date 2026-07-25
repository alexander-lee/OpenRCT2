import React from 'react';
import { ScenePreview } from '../Park';
import { MineTrainCar } from './index';

const previews = {
  componentName: 'MineTrainCar',
  importPath: 'components/MineTrainCar',
  previews: [
    { name: '3D rig', description: "Mine-train ore-cart vehicle with iron bands and a prospector.", render: () => (
        <ScenePreview distance={4.2}
      targetY={0.5}>
          <MineTrainCar />
        </ScenePreview>
      ) },
  ],
};

export default previews;

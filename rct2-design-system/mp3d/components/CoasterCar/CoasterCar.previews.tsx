import React from 'react';
import { ScenePreview } from '../Park';
import { CoasterCar, CoasterTrain } from './index';

const previews = {
  componentName: 'CoasterCar',
  importPath: 'components/CoasterCar',
  previews: [
    { name: '3D rig', description: "A single wooden-coaster car with seated riders, modelled from the RCT2 vehicle sprite. Drag to orbit.", render: () => (
        <ScenePreview distance={4.2}
      targetY={0.45}>
          <CoasterCar />
        </ScenePreview>
      ) },
    { name: 'Full train', description: "Front, middle and end cars coupled the way RCT2 trains mix distinct position sprites: nose + headlight up front, plain middle, tail fairing + red tail-light at the back.", render: () => (
        <ScenePreview distance={7} targetY={0.45}>
          <CoasterTrain />
        </ScenePreview>
      ) },
  ],
};

export default previews;

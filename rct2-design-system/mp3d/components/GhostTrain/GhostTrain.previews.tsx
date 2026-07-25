import React from 'react';
import { ScenePreview } from '../Park';
import { GhostTrain } from './index';

const previews = {
  componentName: 'GhostTrain',
  importPath: 'components/GhostTrain',
  previews: [
    {
      name: '3D rig',
      description: 'Ghost train dark ride: cars loop through a spooky show building and dip through a graveyard.',
      render: () => (
        <ScenePreview distance={11}
      targetY={0.75}>
          <GhostTrain />
        </ScenePreview>
      ),
    },
  ],
};

export default previews;

import React from 'react';
import { ScenePreview } from '../Park';
import { LaunchedFreefall } from './index';

const previews = {
  componentName: 'LaunchedFreefall',
  importPath: 'components/LaunchedFreefall',
  previews: [
    {
      name: '3D rig',
      description: 'Launched freefall tower: a 4-seat ring car blasts up on compressed air, floats, then glides down.',
      render: () => (
        <ScenePreview distance={10.5}
      targetY={2.85}>
          <LaunchedFreefall />
        </ScenePreview>
      ),
    },
  ],
};

export default previews;

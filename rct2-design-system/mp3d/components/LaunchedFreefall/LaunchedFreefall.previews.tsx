import React from 'react';
import { ScenePreview } from '../Park';
import { LaunchedFreefall } from './index';

const previews = {
  componentName: 'LaunchedFreefall',
  importPath: 'components/LaunchedFreefall',
  previews: [
    {
      name: '3D rig',
      description:
        'Launched freefall tower: a 4-seat ring car blasts up a red lattice truss on compressed air, floats weightless at the apex, then glides down. Three dished air tanks on saddle legs, a manifold into the launch cylinder, a compressor skid, and a railed machine head with the air receiver.',
      render: () => (
        <ScenePreview distance={13} targetY={3.2}>
          <LaunchedFreefall />
        </ScenePreview>
      ),
    },
    {
      name: 'Night',
      description: 'Dusk: the aviation beacon pulses on the head, the tower marker bulbs and the station lamp come up, and the under-car light washes the striped launch pad.',
      render: () => (
        <ScenePreview distance={8} targetY={1.3} night>
          <LaunchedFreefall />
        </ScenePreview>
      ),
    },
  ],
};

export default previews;

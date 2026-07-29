import React from 'react';
import { ScenePreview } from '../Park';
import { SwingingInverterShip } from './index';

const previews = {
  componentName: 'SwingingInverterShip',
  importPath: 'components/SwingingInverterShip',
  previews: [
    {
      name: '3D rig',
      description:
        'Inverter ship: a lofted gondola tub on a tapered box-girder arm with a bolted counterweight plate stack, slung between two braced lattice A-towers. Swings through full 360° loops.',
      render: () => (
        <ScenePreview distance={9.5} targetY={2.5} ground height={620}>
          <SwingingInverterShip />
        </ScenePreview>
      ),
    },
    {
      name: 'Mid-distance (park view)',
      description: 'The same rig at the distance a guest sees it from across a park — the silhouette check.',
      render: () => (
        <ScenePreview distance={18} targetY={2.2} ground height={620}>
          <SwingingInverterShip />
        </ScenePreview>
      ),
    },
  ],
};

export default previews;

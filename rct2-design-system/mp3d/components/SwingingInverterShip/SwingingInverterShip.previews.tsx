import React from 'react';
import { ScenePreview } from '../Park';
import { SwingingInverterShip } from './index';

const previews = {
  componentName: 'SwingingInverterShip',
  importPath: 'components/SwingingInverterShip',
  previews: [
    {
      name: '3D rig',
      description: 'Inverter ship: a gondola on a massive counterweighted arm that swings through full 360° loops.',
      render: () => (
        <ScenePreview distance={9.5}
      targetY={2.5}>
          <SwingingInverterShip />
        </ScenePreview>
      ),
    },
  ],
};

export default previews;

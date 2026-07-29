import React from 'react';
import { ScenePreview } from '../Park';
import { DropTower } from './index';

const previews = {
  componentName: 'DropTower',
  importPath: 'components/DropTower',
  previews: [
    {
      name: '3D rig',
      description:
        'Roto-drop tower: a lattice truss with X-bracing on all four faces, guide rails, brake calipers and a winch crown, and a ring gondola on live cables that climbs, spins and drops.',
      render: () => (
        <ScenePreview distance={11} targetY={3.0}>
          <DropTower />
        </ScenePreview>
      ),
    },
    {
      name: 'Night',
      description: 'Dusk: the aviation beacon pulses on the finial, the 20-bulb ring under the canopy eave comes up and the canopy ceiling glows over the riders.',
      render: () => (
        <ScenePreview distance={9} targetY={1.4} night>
          <DropTower />
        </ScenePreview>
      ),
    },
  ],
};

export default previews;

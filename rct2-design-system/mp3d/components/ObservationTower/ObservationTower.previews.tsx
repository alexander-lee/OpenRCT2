import React from 'react';
import { ScenePreview } from '../Park';
import { ObservationTower } from './index';

const previews = {
  componentName: 'ObservationTower',
  importPath: 'components/ObservationTower',
  previews: [
    {
      name: '3D rig',
      description:
        'Observation tower (OBS1): a glazed blue cabin with twelve framed windows under a lofted red/cream pinwheel roof, riding a lattice truss with X-bracing on all four faces, a rack-and-pinion drive, a caged service ladder and a railed machine crown.',
      render: () => (
        <ScenePreview distance={12} targetY={3.2}>
          <ObservationTower />
        </ScenePreview>
      ),
    },
    {
      name: 'Night',
      description:
        'Dusk: the twelve windows light from the inside, the ceiling glows over the riders, the 24-bulb eave ring comes up and the aviation beacon pulses on the crown finial.',
      render: () => (
        <ScenePreview distance={7.5} targetY={1.3} night>
          <ObservationTower />
        </ScenePreview>
      ),
    },
  ],
};

export default previews;

import React from 'react';
import { ScenePreview } from '../Park';
import { ObservationTower } from './index';

const previews = {
  componentName: 'ObservationTower',
  importPath: 'components/ObservationTower',
  previews: [
    { name: '3D rig', description: "Observation tower: blue window drum + orange/white pinwheel roof cabin rising a lattice mast (OBS1).", render: () => (
        <ScenePreview distance={9.5}
      targetY={2.6}>
          <ObservationTower />
        </ScenePreview>
      ) },
  ],
};

export default previews;

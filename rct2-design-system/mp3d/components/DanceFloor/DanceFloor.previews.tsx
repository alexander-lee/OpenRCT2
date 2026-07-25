import React from 'react';
import { ScenePreview } from '../Park';
import { DanceFloor } from './index';

const previews = {
  componentName: 'DanceFloor',
  importPath: 'components/DanceFloor',
  previews: [
    { name: '3D rig (standalone staging)', description: 'Beat-synced disco floor: emissive tiles colour-cycling on a 2.2 Hz beat, DJ booth with speaker stacks and a headphoned DJ working the deck, and a slow mirror ball. The dancing crowd here is DECORATIVE preview staging (dancers default ON under <ScenePreview> only). Best at night.', render: () => (
        <ScenePreview distance={8.5}
      targetY={0.9}
      autoRotate>
          <DanceFloor />
        </ScenePreview>
      ) },
    { name: 'As composed in a park (no baked dancers)', description: 'The rig a real <Park> gets: DJ, tiles, lights and booth only — no baked dancers. Pass `register` inside a <Park> and wandering sim guests who cross the floor (happy + energetic enough) stop and dance on the same beat for a hashed 10-30 s.', render: () => (
        <ScenePreview distance={8.5}
      targetY={0.9}
      autoRotate>
          <DanceFloor dancers={false} />
        </ScenePreview>
      ) },
  ],
};

export default previews;

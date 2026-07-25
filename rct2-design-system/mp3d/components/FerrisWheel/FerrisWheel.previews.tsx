import React from 'react';
import { ScenePreview } from '../Park';
import { FerrisWheel } from './index';

const previews = {
  componentName: 'FerrisWheel',
  importPath: 'components/FerrisWheel',
  previews: [
    {
      name: '3D rig',
      description: "Ferris wheel with A-frame supports and gondolas that stay upright as they orbit.",
      render: () => (
        <ScenePreview distance={9} targetY={2.4}>
          <FerrisWheel />
        </ScenePreview>
      ),
    },
  ],
};

export default previews;

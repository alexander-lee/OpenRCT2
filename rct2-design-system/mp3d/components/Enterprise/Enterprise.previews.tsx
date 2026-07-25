import React from 'react';
import { ScenePreview } from '../Park';
import { Enterprise } from './index';

const previews = {
  componentName: 'Enterprise',
  importPath: 'components/Enterprise',
  previews: [
    { name: '3D rig', description: "Enterprise: pink-spoked pod wheel that spins up and lifts toward vertical (ENTERP).", render: () => (
        <ScenePreview distance={10.5}
      targetY={2.3}>
          <Enterprise />
        </ScenePreview>
      ) },
  ],
};

export default previews;

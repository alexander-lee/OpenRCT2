import React from 'react';
import { ScenePreview } from '../Park';
import { OakTree } from './index';

const previews = {
  componentName: 'OakTree',
  importPath: 'components/OakTree',
  previews: [
    { name: '3D rig', description: "An oak tree with chunky foliage that sways, modelled from the RCT2 scenery sprite. Drag to orbit.", render: () => (
        <ScenePreview distance={6}
      targetY={1.2}>
          <OakTree />
        </ScenePreview>
      ) },
  ],
};

export default previews;

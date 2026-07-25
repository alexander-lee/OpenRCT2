import React from 'react';
import { ScenePreview } from '../Park';
import { TopSpin } from './index';

const previews = {
  componentName: 'TopSpin',
  importPath: 'components/TopSpin',
  previews: [
    { name: '3D rig', description: "Top Spin: magenta gondola row somersaulting between swinging arms (TOPSP1).", render: () => (
        <ScenePreview distance={8}
      targetY={1.6}>
          <TopSpin />
        </ScenePreview>
      ) },
  ],
};

export default previews;

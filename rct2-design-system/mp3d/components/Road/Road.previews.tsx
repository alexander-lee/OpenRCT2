import React from 'react';
import { ScenePreview } from '../Park';
import { Road } from './index';

const previews = {
  componentName: 'Road',
  importPath: 'components/Road',
  previews: [
    { name: '3D rig', description: "A paved road tile with kerbs and centre line, modelled from the RCT2 tarmac footpath. Drag to orbit.", render: () => (
        <ScenePreview distance={4.8} targetY={0.3} autoRotate={false}>
          <Road />
        </ScenePreview>
      ) },
  ],
};

export default previews;

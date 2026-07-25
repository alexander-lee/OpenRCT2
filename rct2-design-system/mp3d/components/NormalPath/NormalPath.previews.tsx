import React from 'react';
import { ScenePreview } from '../Park';
import { NormalPath } from './index';

const previews = {
  componentName: 'NormalPath',
  importPath: 'components/NormalPath',
  previews: [
    {
      name: '3D rig',
      description: "The standard RCT2 tarmac footpath tile: paving squares, kerbs and a strolling guest.",
      render: () => (
        <ScenePreview distance={4.8} targetY={0.3} autoRotate={false}>
          <NormalPath />
        </ScenePreview>
      ),
    },
  ],
};

export default previews;

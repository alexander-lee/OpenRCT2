import React from 'react';
import { ScenePreview } from '../Park';
import { GrassTile } from './index';

const previews = {
  componentName: 'GrassTile',
  importPath: 'components/GrassTile',
  previews: [
    {
      name: '3D rig',
      description: "A grass land tile (textured earth slab with tufts) from the RCT2 terrain surface.",
      render: () => (
        <ScenePreview distance={5.2} targetY={0.2} autoRotate={false}>
          <GrassTile />
        </ScenePreview>
      ),
    },
  ],
};

export default previews;

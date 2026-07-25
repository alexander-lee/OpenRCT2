import React from 'react';
import { ScenePreview } from '../Park';
import { StringLights } from './index';

const previews = {
  componentName: 'StringLights',
  importPath: 'components/StringLights',
  previews: [
    { name: '3D rig', description: 'Festival string lights: sagging cables of warm emissive bulbs zig-zagging between iron poles over a concrete plaza, guests strolling underneath. Best at night.', render: () => (
        <ScenePreview distance={13}
      targetY={1}
      autoRotate={false}>
          <StringLights />
        </ScenePreview>
      ) },
  ],
};

export default previews;

import React from 'react';
import { ScenePreview } from '../Park';
import { NeonSign } from './index';

const previews = {
  componentName: 'NeonSign',
  importPath: 'components/NeonSign',
  previews: [
    { name: '3D rig', description: 'Neon tube signage: pink "OPEN" lettering (16-segment vector font) over a dark backboard on posts, plus a cyan SVG-path star on a pole — emissive core + halo tubes with hashed flicker. Best at night.', render: () => (
        <ScenePreview distance={9}
      targetY={1.5}
      autoRotate={false}>
          <NeonSign />
        </ScenePreview>
      ) },
  ],
};

export default previews;

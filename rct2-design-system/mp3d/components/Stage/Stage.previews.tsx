import React from 'react';
import { Stage, box, ball } from './index';

const previews = {
  componentName: 'Stage',
  importPath: 'components/Stage',
  previews: [
    { name: 'Foundation', description: 'Reusable three.js viewport (orbit camera, sun + soft shadows, grass ground). Pass a build(THREE, group) callback.', render: () => (
      <Stage build={(t, g) => { g.add(box(t, [1, 1, 1], 0xdd6633, [0, 0.5, 0])); g.add(ball(t, 0.45, 0x4488cc, [1, 0.45, 0.6])); }} />
    ) },
  ],
};

export default previews;

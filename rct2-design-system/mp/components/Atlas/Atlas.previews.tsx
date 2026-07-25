import React from 'react';
import { AtlasCell } from './index';

const previews = {
  componentName: 'Atlas',
  importPath: 'components/Atlas',
  previews: [
    { name: 'Overview', description: 'Shared atlas + cell slicer (foundation).', render: () => <AtlasCell cell={[0,0,64,64]} scale={2} /> },
  ],
};

export default previews;

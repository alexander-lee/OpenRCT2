import React from 'react';
import { PeepWalker } from './index';

const previews = {
  componentName: 'PeepWalker',
  importPath: 'components/PeepWalker',
  previews: [
    { name: 'Overview', description: 'Reusable primitive.', render: () => <PeepWalker name="Sample" frames={{ '0': [[0,0,13,20]] }} /> },
  ],
};

export default previews;

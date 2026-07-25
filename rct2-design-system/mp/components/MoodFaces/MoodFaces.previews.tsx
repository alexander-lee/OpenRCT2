import React from 'react';
import { MoodFaces } from './index';

const previews = {
  componentName: 'MoodFaces',
  importPath: 'components/MoodFaces',
  previews: [
    { name: 'Overview', description: 'Reusable primitive.', render: () => <MoodFaces faces={[{ name: 'Happy', cell: [0,0,12,12] }]} /> },
  ],
};

export default previews;

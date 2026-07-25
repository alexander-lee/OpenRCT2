import React from 'react';
import { ScenePreview } from '../Park';
import { WoodenCoaster } from './index';

const previews = {
  componentName: 'WoodenCoaster',
  importPath: 'components/WoodenCoaster',
  previews: [
    { name: 'Deprecated → SplineCoaster', description: 'WoodenCoaster is deprecated; it now renders SplineCoaster. Use SplineCoaster (or TrackKit for grid pieces).', render: () => (
        <ScenePreview distance={13} targetY={1.4}>
          <WoodenCoaster />
        </ScenePreview>
      ) },
  ],
};

export default previews;

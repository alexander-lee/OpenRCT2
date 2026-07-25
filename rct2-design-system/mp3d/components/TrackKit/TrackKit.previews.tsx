import React from 'react';
import { ScenePreview } from '../Park';
import { TrackKit } from './index';

const previews = {
  componentName: 'TrackKit',
  importPath: 'components/TrackKit',
  previews: [
    { name: '3D rig', description: "Composable coaster track pieces (RCT2 TrackElemType-style) with spline rails, train-follow and clearance-aware wooden supports.", render: () => (
        <ScenePreview distance={17.5}
      targetY={1.2}>
          <TrackKit />
        </ScenePreview>
      ) },
  ],
};

export default previews;

import React from 'react';
import { ScenePreview } from '../Park';
import { SceneryPack } from './index';

const previews = {
  componentName: 'SceneryPack',
  importPath: 'components/SceneryPack',
  previews: [
    {
      name: '3D rig',
      description: 'Museum grid of all 20 classic RCT2 scenery pieces — statues, topiary, garden walls, wishing well, gazebo and a tethered hot air balloon.',
      render: () => (
        <ScenePreview
          distance={16}
          targetY={0.9}
          dress={(t, g, api) => {
            api.setCameraPose?.([12.5, 7, 12.5], [0, 1.0, 0]); // low museum vantage — whole grid + balloon in frame
          }}
        >
          <SceneryPack />
        </ScenePreview>
      ),
    },
  ],
};

export default previews;

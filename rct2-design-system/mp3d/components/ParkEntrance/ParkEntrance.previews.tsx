import React from 'react';
import { ScenePreview } from '../Park';
import { ParkEntrance } from './index';

const previews = {
  componentName: 'ParkEntrance',
  importPath: 'components/ParkEntrance',
  previews: [
    {
      name: 'Park entrance gate',
      description:
        'The RCT2 park entrance: two square masonry towers with pyramidal slate roofs flanking a wide archway over the path, a deep stone beam carrying a white marquee sign band with dark geometric bar lettering on both faces, ticket-booth windows in the tower fronts, wrought-iron fence stubs each side and night-gated warm lanterns on the towers. Two guests walk in through the arch on a loop.',
      render: () => (
        <ScenePreview distance={7.5}
      targetY={1}>
          <ParkEntrance />
        </ScenePreview>
      ),
    },
  ],
};

export default previews;

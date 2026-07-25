import React from 'react';
import { ScenePreview } from '../Park';
import { BobsleighCar } from './index';

// DEPRECATED component — a single minimal preview, kept only so the component
// trio stays valid and the design system still publishes. See Context.md.
const previews = {
  componentName: 'BobsleighCar',
  importPath: 'components/BobsleighCar',
  previews: [
    {
      name: 'Deprecated alias',
      description:
        'DEPRECATED — removed from the catalog. Use <Bobsleigh> for the ride, or SplineRideKit buildMiniSled as a <TrackRide profile="bobsled"> vehicle. This alias just renders that sled in the old chute.',
      render: () => (
        <ScenePreview distance={4.6} targetY={0.5}>
          <BobsleighCar />
        </ScenePreview>
      ),
    },
  ],
};

export default previews;

import React from 'react';
import { ScenePreview } from '../Park';
import { DiscoBallFloor } from './index';

// Pulse District's GIANT. Preview 0 is the day shot at mounting scale, preview 1
// the night shot. Components never render a <Stage> — every preview wraps them
// in <ScenePreview>.

const previews = {
  componentName: 'DiscoBallFloor',
  importPath: 'components/DiscoBallFloor',
  previews: [
    {
      name: 'DiscoBallFloor — neon',
      description:
        'An Epcot-scale geodesic ball — radius 2.05, 150 facets placed on a Fibonacci sphere so coverage is even instead of clumping at the poles, most mirror-white with magenta, cyan and amber emissive among them — turning on four truss legs above a round dance floor of light tiles. The floor CHASES: a travelling wave across six phase buckets, never a strobe. Facets and tiles are MERGED (150 separate meshes crashed the render browser); the ball still turns as one group. Ground radius 3.3, deliberately within a unit of the other four world giants so no land out-masses its neighbours.',
      render: () => (
        <ScenePreview distance={18} targetY={4} autoRotate={false} ground height={430}>
          <DiscoBallFloor />
        </ScenePreview>
      ),
    },
    {
      name: 'At night',
      description:
        'The same landmark after dark. Every glow is gated on the Stage day/night cycle through `nightKOf(group)` — which takes the OBJECT, never the time; passing a number throws an uncaught page error that blanks the whole park.',
      render: () => (
        <ScenePreview distance={18} targetY={4} autoRotate={false} ground night height={430}>
          <DiscoBallFloor />
        </ScenePreview>
      ),
    },
  ],
};

export default previews;

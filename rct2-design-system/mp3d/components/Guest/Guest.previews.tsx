import React from 'react';
import { ScenePreview } from '../Park';
import { Guest } from './index';

const previews = {
  componentName: 'Guest',
  importPath: 'components/Guest',
  previews: [
    {
      name: 'Animation showcase',
      description:
        'Every peep animation on one slab, grouped by position (two rows). Back row: idle breathing, stroll + brisk walk, seated on a bench, looping anticipation-crouch jumps, and a green-faced sick hunch. Front row: the four dance styles (styles rotate every 8 s; the female style-3 spinner shows the skirt swing + flare), then eat and drink demos with held burger/cup and the lift-to-mouth arm overlay. Male and female variants alternate. Drag to orbit.',
      render: () => (
        <ScenePreview distance={7.2}
      targetY={0.75}
      height={420}
      autoRotate={false}>
          <Guest />
        </ScenePreview>
      ),
    },
  ],
};

export default previews;

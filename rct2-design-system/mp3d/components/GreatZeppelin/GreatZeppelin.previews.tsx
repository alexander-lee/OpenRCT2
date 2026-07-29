import React from 'react';
import { ScenePreview } from '../Park';
import { GreatZeppelin } from './index';

// Brasswork Foundry's GIANT. Preview 0 is the day shot at mounting scale, preview 1
// the night shot. Components never render a <Stage> — every preview wraps them
// in <ScenePreview>.

const previews = {
  componentName: 'GreatZeppelin',
  importPath: 'components/GreatZeppelin',
  previews: [
    {
      name: 'GreatZeppelin — steampunk',
      description:
        'A rigid airship riding at its mooring mast: an 11.5-unit envelope lofted from 22 rings on a real airship profile (blunt nose, fat third, long taper), five brass ring frames, four tail fins, a slung gondola with two engine nacelles and propellers, and guy lines to the ground. She BREATHES at her mooring — a slow yaw, a slight roll and a gentle rise and fall, never a spin. The tallest thing in the catalogue. Ground radius 2.6, deliberately within a unit of the other four world giants so no land out-masses its neighbours.',
      render: () => (
        <ScenePreview distance={20} targetY={5.5} autoRotate={false} ground height={430}>
          <GreatZeppelin />
        </ScenePreview>
      ),
    },
    {
      name: 'At night',
      description:
        'The same landmark after dark. Every glow is gated on the Stage day/night cycle through `nightKOf(group)` — which takes the OBJECT, never the time; passing a number throws an uncaught page error that blanks the whole park.',
      render: () => (
        <ScenePreview distance={20} targetY={5.5} autoRotate={false} ground night height={430}>
          <GreatZeppelin />
        </ScenePreview>
      ),
    },
  ],
};

export default previews;

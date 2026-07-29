import React from 'react';
import { ScenePreview } from '../Park';
import { BeachedGalleon } from './index';

// Tidewater Hollow's GIANT. Preview 0 is the day shot at mounting scale, preview 1
// the night shot. Components never render a <Stage> — every preview wraps them
// in <ScenePreview>.

const previews = {
  componentName: 'BeachedGalleon',
  previews: [
    {
      name: 'BeachedGalleon — pirateBeach',
      description:
        'A whole ship heeled over to port in the sand: an eleven-station lofted hull fat amidships and tapering fore and aft, sheer strakes down both sides with a torn gap where the planking is gone, exposed frames through the tear, stem post and bowsprit, and the mainmast snapped two-thirds up with its topmast lying in the sand beside her. Not the 1.8-unit hull FRAGMENT `<WreckedHull>` gives — this is the ship that fragment came off. Ground radius 3.1, deliberately within a unit of the other four world giants so no land out-masses its neighbours.',
      render: () => (
        <ScenePreview distance={9} targetY={1.6} autoRotate={false} ground height={430}>
          <BeachedGalleon />
        </ScenePreview>
      ),
    },
    {
      name: 'At night',
      description:
        'The same landmark after dark. Every glow is gated on the Stage day/night cycle through `nightKOf(group)` — which takes the OBJECT, never the time; passing a number throws an uncaught page error that blanks the whole park.',
      render: () => (
        <ScenePreview distance={9} targetY={1.6} autoRotate={false} ground night height={430}>
          <BeachedGalleon />
        </ScenePreview>
      ),
    },
  ],
};

export default previews;

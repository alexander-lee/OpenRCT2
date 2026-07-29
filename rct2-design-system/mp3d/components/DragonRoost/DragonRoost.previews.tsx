import React from 'react';
import { ScenePreview } from '../Park';
import { DragonRoost } from './index';

// Thornwick Glade's GIANT. Preview 0 is the day shot at mounting scale, preview 1
// the night shot. Components never render a <Stage> — every preview wraps them
// in <ScenePreview>.

const previews = {
  componentName: 'DragonRoost',
  importPath: 'components/DragonRoost',
  previews: [
    {
      name: 'DragonRoost — enchantedForest',
      description:
        'A crag of five stacked, rotated rock tiers with outcrops at the foot and three parallel CLAW RAKES gouged down one flank, moss on the shaded face. On the summit, a woven ring of twenty-two sticks around a bowl floor holds a clutch of five eggs — one already cracked, its shell cap tipped off beside a shard. A shed scale and a gnawed bone in the moss below say the roost is OCCUPIED, not abandoned. The eggs pulse on a slow out-of-phase heartbeat. Ground radius 2.7, deliberately within a unit of the other four world giants so no land out-masses its neighbours.',
      render: () => (
        <ScenePreview distance={10} targetY={2.6} autoRotate={false} ground height={430}>
          <DragonRoost />
        </ScenePreview>
      ),
    },
    {
      name: 'At night',
      description:
        'The same landmark after dark. Every glow is gated on the Stage day/night cycle through `nightKOf(group)` — which takes the OBJECT, never the time; passing a number throws an uncaught page error that blanks the whole park.',
      render: () => (
        <ScenePreview distance={10} targetY={2.6} autoRotate={false} ground night height={430}>
          <DragonRoost />
        </ScenePreview>
      ),
    },
  ],
};

export default previews;

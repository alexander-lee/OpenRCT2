import React from 'react';
import { ScenePreview } from '../Park';
import { Volcano } from '../Volcano';
import { BeachedGalleon } from '../BeachedGalleon';
import { GreatZeppelin } from '../GreatZeppelin';
import { DragonRoost } from '../DragonRoost';
import { DiscoBallFloor } from '../DiscoBallFloor';

// THE FIVE WORLD GIANTS, side by side. Each is its own component — mount them
// by name (`<GreatZeppelin />`) or let `<WorldLandmark plan={W} />` pick one off
// the world's theme. Components never render a <Stage> of their own.
//
// Each giant has its own previews in its own folder; this file exists to show
// them TOGETHER, because the thing worth checking is that no world out-masses
// its neighbours.

const Row = () => (
  <>
    <Volcano position={[-13, 0]} radius={2.75} />
    <BeachedGalleon position={[-5, 0]} />
    <GreatZeppelin position={[3, 0]} />
    <DragonRoost position={[13, 0]} />
    <DiscoBallFloor position={[21, 0]} />
  </>
);

const previews = {
  componentName: 'WorldLandmark',
  previews: [
    {
      name: 'All five world giants',
      description:
        'One landmark per themed world, at the scale they actually mount: the Volcano (the original, r 2.75 × h 2.55), the Beached Galleon, the Great Zeppelin at its mooring mast, the Dragon Roost and the Disco Ball Floor. Before these existed only `fire` had a landmark and the other four lands read as a lawn with ornaments on it. Ground radii are held within a unit of each other so no world out-masses its neighbours — the zeppelin and the ball deliberately win on HEIGHT, because a skyline is what you see from the gate.',
      render: () => (
        <ScenePreview distance={34} targetY={4} autoRotate={false} ground height={430}>
          <Row />
        </ScenePreview>
      ),
    },
    {
      name: 'The giants at night',
      description:
        'The same row after dark. The dragon eggs pulse on a slow out-of-phase heartbeat — something is alive in there — the disco floor chases under its turning ball, and the volcano does what it always did. Every glow is gated on the Stage day/night cycle through `nightKOf(group)`, which takes the OBJECT and never the time.',
      render: () => (
        <ScenePreview distance={34} targetY={4} autoRotate={false} ground night height={430}>
          <Row />
        </ScenePreview>
      ),
    },
  ],
};

export default previews;

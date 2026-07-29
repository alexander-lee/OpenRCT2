import React from 'react';
import { ScenePreview } from '../Park';
import { Carousel } from './index';

const previews = {
  componentName: 'Carousel',
  importPath: 'components/Carousel',
  previews: [
    { name: '3D rig', description: "Merry-go-round: jumping horses and a chariot under a scalloped canopy, from the RCT2 sprite.", render: () => (
        <ScenePreview distance={7.4}
      targetY={1.35}>
          <Carousel />
        </ScenePreview>
      ) },
    // A SECOND, NIGHT preview. The day shot cannot judge whether the two bulb
    // rows, the crown ring and the lit canopy ceiling come up at dusk — and the
    // old build's night reading was one bulb row and nothing else. `ScenePreview`
    // has no elevation prop, so this is framed a little closer rather than lower;
    // for a true eye-level pass use the render harness's `--elev`.
    { name: 'Night', description: 'Dusk: the two rounding-board bulb rows, the crown ring and the lit canopy ceiling.', render: () => (
        <ScenePreview distance={6.6}
      targetY={1.5}
      height={300}
      night>
          <Carousel />
        </ScenePreview>
      ) },
    // TEMP-INSPECT (removed before the change is finished)
    { name: 'zz-inspect', description: 'scratch', render: () => (
        <ScenePreview distance={2.6} targetY={1.15} height={640} autoRotate={false}>
          <Carousel />
        </ScenePreview>
      ) },
  ],
};

export default previews;

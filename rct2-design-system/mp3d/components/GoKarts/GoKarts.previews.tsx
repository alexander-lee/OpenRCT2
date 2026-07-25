import React from 'react';
import { ScenePreview, Station, Straight, TurnL, TurnR, SBend } from '../Park';
import { GoKarts } from './index';

const previews = {
  componentName: 'GoKarts',
  importPath: 'components/GoKarts',
  previews: [
    { name: '3D rig', description: "Go-kart circuit: an oval asphalt track with four karts racing around it.", render: () => (
        <ScenePreview distance={7.5}
      targetY={0.3}>
          <GoKarts />
        </ScenePreview>
      ) },
    { name: 'Custom course (pieces)', description: "Piece-composed FLAT kart circuit — station straight into a paperclip hairpin, then an S-bend chicane (vertical pieces are stripped; karts never ramp). Gantry, tyre stacks and the fleet follow the new course.", render: () => (
        <ScenePreview distance={15}
      targetY={0.3}>
          <GoKarts position={[2, -2.4]}>
            <Station />
            <Straight length={2.2} />
            <TurnR angle={180} radius={1.1} />
            <Straight length={1.2} />
            <SBend radius={1.4} />
            <TurnL angle={90} radius={1.3} />
          </GoKarts>
        </ScenePreview>
      ) },
  ],
};

export default previews;

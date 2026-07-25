import React from 'react';
import { ScenePreview } from '../Park';
import { RideEntrance } from './index';

const previews = {
  componentName: 'RideEntrance',
  importPath: 'components/RideEntrance',
  previews: [
    {
      name: 'Entrance + exit huts',
      description:
        'The classic RCT2 ride entrance and exit huts side by side: dark wood posts, cream walls, saddle roofs. The entrance gets a taller pitch, a stepped decorated gable and a green marquee sign band; the exit is plainer and flatter with a red band. Both marquees are LED DOT-MATRIX SCREENS (procedural canvas texture, 5×7 pixel glyphs) reading ENTRANCE in green and EXIT in red, recessed flush behind the white frame and gated on nightKOf — a dim printed panel by day, a bright glowing screen after dark. A guest walks through the open entrance doorway on a loop — both huts are pass-throughs. The camera is held LOW and front-on (autoRotate off; drag still orbits) because the marquees are vertical panels: a high three-quarter view foreshortens them until the lettering is unreadable.',
      render: () => (
        <ScenePreview
          distance={3.4}
          targetY={1.15}
          autoRotate={false}
          dress={(t, g, api) => {
            // eye-level, square to the fascias so both LED screens read
            api.setCameraPose?.([0, 1.5, 3.5], [0, 1.12, 0]);
          }}
        >
          <RideEntrance />
        </ScenePreview>
      ),
    },
  ],
};

export default previews;

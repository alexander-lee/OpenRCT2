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
        'The classic RCT2 ride entrance and exit huts side by side — ONE small symmetrical booth, dressed twice. Dark timber corner posts with base blocks and capitals, battened cream walls, framed pass-through doorways under a full-width head beam, and a saddle roof whose ridge runs along the walk axis (so a real gable faces the queue) with a fully symmetric overhang, shingle course lips, eave fascias, proud rake boards and a ridge cap. Both carry the same marquee frame: a timber shelf on knee braces, a scalloped valance and a sign board framed by pilasters under a cornice rail — sized to the BUILDING, topping out at 1.14 against a 1.21 ridge, so the silhouette stays hut-shaped. The ENTRANCE adds a stepped centre crest and a row of nine marquee bulbs behind a GREEN band; the EXIT is the plain sibling with a lower board, a RED band and one small bracket lamp. Both bands are LED DOT-MATRIX SCREENS (procedural canvas texture, 5x7 pixel glyphs) reading ENTRANCE / EXIT, recessed behind the white frame stripes and gated on nightKOf — printed panels by day, glowing screens after dark. A guest walks through the open entrance doorway on a loop; both huts are pass-throughs. The camera is held LOW and front-on (autoRotate off; drag still orbits) because the marquees are vertical panels.',
      render: () => (
        <ScenePreview
          distance={3.5}
          targetY={0.75}
          autoRotate={false}
          dress={(t, g, api) => {
            // eye-level, square to the fascias so both LED screens read
            api.setCameraPose?.([0, 1.05, 3.4], [0, 0.72, 0]);
          }}
        >
          <RideEntrance />
        </ScenePreview>
      ),
    },
    {
      name: 'The pair from the park camera',
      description:
        'The same two huts from the angle a player actually gets: the default orbit pose (~50 degrees elevation, three-quarter view). This is the shot that grades the MASSING rather than the lettering — the roof has to read as a roof from up here, the marquee has to read as attached to the building, and entrance and exit have to read as the same family with the entrance the dressed sibling. Drag to orbit; the huts are deliberately identical below the sign board.',
      render: () => (
        <ScenePreview distance={3.9} targetY={0.62} autoRotate={false}>
          <RideEntrance />
        </ScenePreview>
      ),
    },
  ],
};

export default previews;

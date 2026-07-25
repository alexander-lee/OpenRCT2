import React from 'react';
import { ScenePreview } from '../Park';
import { Bazaar, bazaarPlan } from '../Bazaar';
import { Boulevard, boulevardPlan } from '../Boulevard';
import { FountainPlaza, fountainPlazaPlan } from '../FountainPlaza';
import { PortMarkers, setPiecePaving } from './index';

// ---- the composition an agent writes: three plans, wired PORT to PORT ------
const HUB = fountainPlazaPlan({ id: 'hub', position: [7.2, 0], ports: ['N', 'S', 'W'], seed: 7 });
const MARKET = bazaarPlan({ id: 'market', position: [-7.2, 0], stalls: ['burger', 'soda', 'balloon'], seed: 5 });
// the avenue's ends ARE the neighbours' ports — buildParkNet merges the cells,
// so the three pieces are one connected street net by construction
const AVE = boulevardPlan({ id: 'ave', from: HUB.port('W'), to: MARKET.port('E'), spacing: 2.4, seed: 4 });
const PIECES = [HUB, MARKET, AVE];

const previews = {
  componentName: 'SetPieceKit',
  importPath: 'components/SetPieceKit',
  previews: [
    {
      name: 'Three set-pieces wired port to port',
      description:
        'The contract in action: fountainPlazaPlan / bazaarPlan / boulevardPlan are PURE, so the whole district exists as data before anything mounts. The avenue is planned FROM the plaza\'s W port TO the bazaar\'s E port, buildParkNet fuses the three interior sub-nets into the one graph <Paths> renders (merging the shared port cells, splitting any edge crossed by a node, pruning ports nobody wired), and each component then mounts from the same plan — so ports, footprint OBBs, keepDry cells, stall anchors and the visuals cannot disagree. Guests walking in from the plaza\'s N port can reach every shop counter.',
      render: () => (
        <ScenePreview distance={27} targetY={1.4} height={520} autoRotate dress={setPiecePaving(PIECES)}>
          <FountainPlaza plan={HUB} />
          <Boulevard plan={AVE} />
          <Bazaar plan={MARKET} />
        </ScenePreview>
      ),
    },
    {
      name: 'Ports + footprints made visible',
      description:
        'The same district with the debug overlay: a gold post + outward arrow on every PORT (the named connector cells, already lattice-snapped and always one cell OUTSIDE the piece) and red corner posts on each piece FOOTPRINT — the single OBB registered with the park, which puts the whole set-piece into validatePark\'s footprint sweep and the coaster-corridor SAT sweep, and pulls the terrain guard clamp under it. The boulevard\'s footprint is planning data only (`reserve: false`): a street must stay tailable by queue lanes and branchable by side streets.',
      render: () => (
        <ScenePreview distance={27} targetY={1.4} height={520} autoRotate={false} dress={setPiecePaving(PIECES)}>
          <FountainPlaza plan={HUB} />
          <Boulevard plan={AVE} />
          <Bazaar plan={MARKET} />
          <PortMarkers plans={PIECES} />
        </ScenePreview>
      ),
    },
  ],
};

export default previews;

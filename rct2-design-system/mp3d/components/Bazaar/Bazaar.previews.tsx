import React from 'react';
import { ScenePreview } from '../Park';
import { setPiecePaving } from '../SetPieceKit';
import { Bazaar, bazaarPlan } from './index';

const ROW = bazaarPlan({ id: 'market', position: [0, 0], seed: 5 });
const BIG = bazaarPlan({
  id: 'grand-bazaar',
  position: [0, 0],
  stalls: ['burger', 'hotDog', 'soda', 'cottonCandy', 'balloon', 'soda'],
  seed: 11,
});

const previews = {
  componentName: 'Bazaar',
  importPath: 'components/Bazaar',
  previews: [
    {
      name: 'Four-stall market courtyard',
      description:
        'A paved 7×3-tile courtyard with FOUR catalog stalls (burger, soda, cotton candy, balloons) staggered along the two rows, each planted 1.2 u off the aisle with its serving front toward it — so the GameManager attach point lands ON the walked path and every shop actually sells. Striped canopies hang across the aisle, pennant bunting runs down both rows between real lamp hooks, festival spans frame both entrances, and benches + bins sit on the entrance verges. Two end ports (W/E) sit one lattice cell outside the footprint; the aisle itself is street, contributed to the park graph through buildParkNet.',
      render: () => (
        <ScenePreview distance={18} targetY={1.1} autoRotate dress={setPiecePaving([ROW])}>
          <Bazaar plan={ROW} />
        </ScenePreview>
      ),
    },
    {
      name: 'Six stalls (the widest bazaar)',
      description:
        'The same set-piece scaled to six shops: the aisle grows to 9 tiles so a free end tile still carries the lamps at each entrance, the stalls keep staggering side to side, and repeated kinds get unique registered names ("Grand Bazaar Soda Stand 2") so the manager, ParkInfo and the corridor resolver can tell them apart. Stalls are `pinned` by default — a set-piece is ONE unit, so the settle-time corridor resolver never shuffles a single shop out of the row.',
      render: () => (
        <ScenePreview distance={24} targetY={1.1} autoRotate dress={setPiecePaving([BIG])}>
          <Bazaar plan={BIG} />
        </ScenePreview>
      ),
    },
  ],
};

export default previews;

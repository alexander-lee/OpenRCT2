import React from 'react';
import { ScenePreview } from '../Park';
import { setPiecePaving } from '../SetPieceKit';
import { Boulevard, boulevardPlan } from './index';

const AVE = boulevardPlan({ id: 'ave', from: [0, -8.4], to: [0, 8.4], seed: 4 });
const LONG = boulevardPlan({ id: 'promenade', from: [-12, 0], to: [12, 0], spacing: 3.6, seed: 9 });

const previews = {
  componentName: 'Boulevard',
  importPath: 'components/Boulevard',
  previews: [
    {
      name: 'Approach avenue (16.8 u, lamp pairs every 4.8)',
      description:
        'The long walk between two districts: a straight carriageway on the 1.2 lattice with a port at each end, dressed at regular stations — lamp pairs on the verges, a night-gated string-light span across the avenue on every other pair, street trees between the stations (alternating sides and species), benches facing the street and planters/topiary. Every anchor is ≥ 1.35 u off the centreline, so the slab and its kerbs stay clear and a queue lane can still tail onto any node. The paving is preview staging; in a park the plan feeds buildParkNet → <Paths>.',
      render: () => (
        <ScenePreview distance={20} targetY={1.3} autoRotate dress={setPiecePaving([AVE])}>
          <Boulevard plan={AVE} />
        </ScenePreview>
      ),
    },
    {
      name: 'Grand promenade (24 u, stations every 3.6)',
      description:
        'What makes a size-48 plot read expansive instead of huddled: 24 units of dressed avenue between two ports, tighter lamp spacing, spans on alternating pairs and a tree rhythm down both verges. `avoid` cells (planned queue lanes, exit huts, ride pads) are skipped by construction, so dressing can never collide with the wiring the composing agent solves separately.',
      render: () => (
        <ScenePreview distance={23} targetY={1.3} autoRotate dress={setPiecePaving([LONG])}>
          <Boulevard plan={LONG} />
        </ScenePreview>
      ),
    },
  ],
};

export default previews;

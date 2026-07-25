import React from 'react';
import { ScenePreview } from '../Park';
import { setPiecePaving } from '../SetPieceKit';
import { FountainPlaza, fountainPlazaPlan } from './index';

// the plans are PURE — the same objects wire the street net in a real park
const CROSS = fountainPlazaPlan({ id: 'hub', position: [0, 0], seed: 7 });
const TEE = fountainPlazaPlan({
  id: 'court',
  position: [0, 0],
  tiles: 9,
  ports: ['N', 'E', 'W'],
  stringLights: 'all',
  seed: 3,
});

const previews = {
  componentName: 'FountainPlaza',
  importPath: 'components/FountainPlaza',
  previews: [
    {
      name: '4-way hub plaza (the default)',
      description:
        'A 7×7-tile RCT2 plaza pad with the fountain on its centre tile, a walkable RING around the water (so a guest entering from any port can reach every other — a real junction, never a dead end) and FOUR street ports, each one lattice cell outside the piece footprint. Dressing comes from the plan: four benches facing the water, four lantern lamps on the band diagonals with two night-gated festival spans strung hook-to-hook, topiary pairs flanking every entrance and two bins on the verge. The paving here is preview staging (setPiecePaving) — in a real park the same plan feeds buildParkNet → <Paths>, so the ring is part of the ONE shared graph guests walk.',
      render: () => (
        <ScenePreview distance={17} targetY={0.9} autoRotate dress={setPiecePaving([CROSS])}>
          <FountainPlaza plan={CROSS} />
        </ScenePreview>
      ),
    },
    {
      name: '3-way T plaza, 9 tiles, spans on all four sides',
      description:
        'Configurable port count and radius: a 9×9-tile plaza with ports N/E/W only. The closed side is CLOSED PROPERLY — a marble statue on its band centre and planter boxes flanking it instead of a spur dead-ending in open grass — and the fountain scales up with the pad. Four festival spans ring the band. Deterministic (hashed sine only); every anchor is a lattice multiple, so ports, footprint, keepDry cells and the mounted visual can never disagree.',
      render: () => (
        <ScenePreview distance={19} targetY={1.0} autoRotate dress={setPiecePaving([TEE])}>
          <FountainPlaza plan={TEE} />
        </ScenePreview>
      ),
    },
  ],
};

export default previews;

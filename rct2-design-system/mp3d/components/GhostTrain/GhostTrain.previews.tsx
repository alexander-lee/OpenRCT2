import React from 'react';
import { ScenePreview } from '../Park';
import { GhostTrain } from './index';

const previews = {
  componentName: 'GhostTrain',
  importPath: 'components/GhostTrain',
  previews: [
    {
      name: '3D rig',
      description:
        'Ghost train dark ride: a three-car train loops through a spooky show building and dips out through a graveyard. Three spectres haunt it — one penned behind the bars of the bay window, one wafting up through the roof ridge and a wraith drifting a slow circle between the tombstones.',
      render: () => (
        <ScenePreview distance={11} targetY={1.0}>
          <GhostTrain />
        </ScenePreview>
      ),
    },
    {
      name: 'Facade & spectres (detail)',
      description:
        "Close on the show building's front: the skull-and-crossbones sign (an egg cranium with flattened temples, a brow ridge over SUNK sockets, a triangular nasal hollow, cheekbones and a hinged jaw of individually modelled teeth, mounted over two real bones with knuckle knobs), the flame lanterns at the flap doors, the barred bay window with the display ghost inside it, corner cobwebs and the five staggered courses of slate tabs on the roof.",
      render: () => (
        <ScenePreview
          distance={6}
          targetY={1.5}
          height={420}
          autoRotate={false}
          dress={(_t, _g, api) => api.setCameraPose?.([4.9, 3.1, 1.8], [-0.4, 1.75, 0.5])}
        >
          <GhostTrain />
        </ScenePreview>
      ),
    },
  ],
};

export default previews;

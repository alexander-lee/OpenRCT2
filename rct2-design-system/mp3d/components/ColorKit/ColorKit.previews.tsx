import React from 'react';
import { ScenePreview } from '../Park';
import { ColorKit } from './index';

const previews = {
  componentName: 'ColorKit',
  importPath: 'components/ColorKit',
  previews: [
    {
      name: '3D rig',
      description: "The RCT2 ride-colour system: TRACK_COLOUR_PRESETS swatch wall — rideColourPreset(seed, type) rolls real presets for track main/additional/supports and per-car vehicle schemes.",
      render: () => (
        <ScenePreview distance={10} targetY={1.1}>
          <ColorKit />
        </ScenePreview>
      ),
    },
  ],
};

export default previews;

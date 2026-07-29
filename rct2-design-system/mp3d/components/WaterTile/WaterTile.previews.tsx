import React from 'react';
import { ScenePreview } from '../Park';
import { WaterTile } from './index';

const previews = {
  componentName: 'WaterTile',
  importPath: 'components/WaterTile',
  previews: [
    { name: '3D rig', description: "Animated water surface with a custom GLSL wave + Fresnel + sparkle shader.", render: () => (
        <ScenePreview distance={5}
      targetY={0.2}
      background="#bfe6f2"
      ground={false}>
          <WaterTile />
        </ScenePreview>
      ) },
    { name: 'LAVA — the molten palette', description: "The same wave shader driven by the exported LAVA LiquidPalette, for Emberfall Caldera. Modelled on real basaltic lava rather than red-tinted water, which is why the palette is arranged INVERSELY to water's: a flow is mostly dark chilled crust with incandescence only where the skin is thin or torn, so `deep` (the troughs, most of the surface) is near-black basalt and `shallow` (the crests) is the hot yellow-orange. It is opaque (no read-through), the crests carry extra incandescence, and `glow: 1` makes the sheet self-illuminated — so unlike water, which dims to a cool moonlit blue, lava gets BRIGHTER after dark. Swell is slowed to 0.34 waviness because lava is orders of magnitude more viscous than water, and the basin is re-skinned to scorched basalt (a molten pool sits in a crater, not on a sand beach). Pass `lava` or any `palette`; the default water palette is untouched.", render: () => (
        <ScenePreview distance={5}
      targetY={0.2}
      background="#6b5148"
      ground={false}>
          <WaterTile lava />
        </ScenePreview>
      ) },
  ],
};

export default previews;

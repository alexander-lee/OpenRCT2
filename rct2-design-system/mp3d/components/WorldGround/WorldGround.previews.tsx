import React from 'react';
import { ScenePreview } from '../Park';
import { WorldGround } from './index';
import { WORLD_THEMES, worldPlan } from '../SetPieceKit';
import { fountainPlazaPlan } from '../FountainPlaza';

// The six GROUND DRESSES, one per theme. `<WorldGround>` needs a worldPlan, so
// each preview builds one around the origin and lays that theme's floor across
// it. Components never render a <Stage> — every preview wraps them in
// <ScenePreview>.
//
// The rects are deliberately WIDE (24 x 24). The tone field varies on a ~7 u
// wavelength, so a small swatch shows one flat colour and tells you nothing
// about the thing that was actually fixed.

// ONE REAL PIECE, not `pieces: []`. An empty list is a FATAL plan lint
// (`worldEmpty` — "a world is composed of its set-pieces"), and a fatal thrown
// at module scope does not degrade the preview, it BLANKS it: every one of
// these six swatches rendered nothing. A themed plaza is the cheapest legal
// world and it is dressed by the same theme the ground is, so the swatch still
// shows what it is here to show.
const planFor = (themeId: string) => {
  const theme = (WORLD_THEMES as any)[themeId];
  return worldPlan({
    id: `pv-${themeId}`,
    theme,
    pieces: [fountainPlazaPlan({ id: `pv-${themeId}-hub`, position: [0, 0], theme })],
    include: [[-12, -12], [12, 12]],
  });
};

const shot = (themeId: string, night = false) => () => (
  <ScenePreview distance={34} targetY={0.3} autoRotate={false} ground night={night} height={430}>
    <WorldGround plan={planFor(themeId) as any} />
  </ScenePreview>
);

const previews = {
  componentName: 'WorldGround',
  importPath: 'components/WorldGround',
  previews: [
    {
      name: 'fire — cooled basalt and ash',
      description:
        'The caldera floor: dark basalt mottled with ash grey. Before this existed a volcanic land stood on the same municipal green lawn as everything else — `theme.pathSurface` only re-skins the STREETS, and the ground either side of them was never dressed at all.',
      render: shot('fire'),
    },
    {
      name: 'pirateBeach — wet tide sand',
      description:
        'Pale tide sand darkening into wet sand. This theme swings furthest along the tone ramp (patchiness 0.42), so the beach reads as tidal rather than flat.',
      render: shot('pirateBeach'),
    },
    {
      name: 'steampunk — soot-stained yard',
      description: 'A works yard: packed grey-brown, worn lighter where the traffic runs.',
      render: shot('steampunk'),
    },
    {
      name: 'enchantedForest — deep moss',
      description:
        'Deep moss over shade green — the most broken-up of the six, because a glade floor should never read as mown.',
      render: shot('enchantedForest'),
    },
    {
      name: 'neon — black glass street',
      description:
        'Near-black asphalt with a faint sheen, so the nightclub street reads as wet city surface rather than parkland.',
      render: shot('neon'),
    },
    {
      name: 'default — the Original park lawn',
      description:
        'The classic mown lawn, for the hub and entrance plaza. `default` is a real theme but NOT a preset world — three lands dressed `default` are one place.',
      render: shot('default'),
    },
    {
      name: 'Why it reads as ground and not as a chequerboard',
      description:
        'The first version chose each tile’s tone with an independent hash, and an independent draw per cell on a lattice IS a chequerboard — about two thirds of neighbours differ, so the eye sees the grid and nothing else. Adding tones made it worse: four random tones is a busier chequerboard. Tone is now sampled from SMOOTH value noise in world space (~7 u wavelength, two octaves), so variation arrives as blobs several tiles wide, and it is quantised into an eight-step ramp instead of a hard four-way split. Tiles dropped 2.4 → 1.2 u, because the tile size is the resolution that field is sampled at. Still one draw call per band.',
      render: shot('enchantedForest'),
    },
    {
      name: 'After dark',
      description:
        'The floor carries no light of its own — it takes the Stage day/night cycle like any other surface, so a land goes dark with the park around it.',
      render: shot('fire', true),
    },
  ],
};

export default previews;

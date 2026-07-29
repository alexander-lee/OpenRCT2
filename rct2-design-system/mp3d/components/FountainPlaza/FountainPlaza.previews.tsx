import React from 'react';
import { ScenePreview } from '../Park';
import { ENCHANTED_FOREST, FIRE, NEON_CITY, PIRATE_BEACH, STEAMPUNK, setPiecePaving } from '../SetPieceKit';
import type { WorldTheme } from '../SetPieceKit';
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

// ---- the theme layer --------------------------------------------------------
// Same planner, same tiles, same seed, same three ports: only `theme` differs.
// The S side is left CLOSED on every themed plan on purpose — a closed side is
// where the world's own monument and flanking species stand, so it is the side
// that shows the dress most plainly, and S faces the preview camera.
//
// LAY THEM ON THE ANTI-DIAGONAL, NOT ALONG AN AXIS. The preview camera is a
// fixed three-quarter view, so a line of pieces along +x runs from the top-left
// corner to the bottom-right one and the last plaza falls off the canvas (it
// did: the neon plaza was half out of frame). Stepping (+x, −z) together puts
// them ACROSS the view instead, which is the direction the frame is widest in.
// Steps are lattice multiples (1.2) — the planner snaps, and a position it has
// to snap is a position that no longer matches what you measured.
const themed = (id: string, title: string, at: [number, number], theme: WorldTheme) =>
  fountainPlazaPlan({ id, title, position: at, tiles: 7, ports: ['N', 'E', 'W'], stringLights: 'all', seed: 4, theme });

const GLADE = themed('glade-plaza', 'Glade Plaza', [-4.8, 4.8], ENCHANTED_FOREST);
const TIDE = themed('tide-plaza', 'Tidewater Plaza', [4.8, -4.8], PIRATE_BEACH);

const TRIO = [
  themed('ember-plaza', 'Caldera Plaza', [-9.6, 9.6], FIRE),
  themed('foundry-plaza', 'Foundry Plaza', [0, 0], STEAMPUNK),
  themed('voltage-plaza', 'Voltage Plaza', [9.6, -9.6], NEON_CITY),
];

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
    {
      name: 'One plaza, two WORLDS (the theme layer)',
      description:
        'The same fountainPlazaPlan — same 7 tiles, same three ports, same seed, same footprint and the same walkable ring — dressed for two worlds by passing `theme`. Left: ENCHANTED_FOREST (moss-green paving, topiary-spiral flankers at the three open ports, a mushroom-cluster course closing the S side behind a BIRDBATH, cold pale-green lanterns on mint/lime spans). Right: PIRATE_BEACH (bleached-sand boardwalk paving, planter-box flankers, a fallen-log course closing the S side behind a WISHING WELL, warm lanterns on seafoam spans, verdigris ironwork). The rule those two follow is the whole dressing contract: an OPEN side is flanked by `planting.flanker`, a CLOSED one gets a `planting.hedge` course plus that world\'s `planting.monument`. Nothing structural moves — a `WorldTheme` supplies the paving, the species, the monument, the lantern character, the span bulbs and a seed offset, so two plazas planted from the same seed in different worlds never repeat each other\'s variation. Omit `theme` for DEFAULT_THEME (concrete + topiary + marble statue), which is pixel-identical to the pre-theme plaza.',
      render: () => (
        <ScenePreview distance={30} targetY={1.1} height={480} autoRotate={false} dress={setPiecePaving([GLADE, TIDE])}>
          <FountainPlaza plan={GLADE} />
          <FountainPlaza plan={TIDE} />
        </ScenePreview>
      ),
    },
    {
      name: 'The other three presets (FIRE, STEAMPUNK, NEON_CITY)',
      description:
        'The rest of the shipped vocabulary, so all five presets are visible across these two previews. FIRE: basalt paving, cactus-cluster flankers, a fallen-log course and a LION STATUE closing the S side, live-FLAME lanterns. STEAMPUNK: grey iron-plate paving, planter-box flankers, a BRICK-WALL course and a PARK CLOCK closing it, warm filament lanterns on amber spans. NEON_CITY: near-black violet paving with magenta accents and chrome cable, topiary-spiral flankers, a planter-box course and a TV-MONITOR POST closing it, cold lanterns on magenta/cyan/lime spans. Read them against the DEFAULT plaza in the first preview: the pad, ring, ports and bench spots are the SAME plan in all five — a world changes what the piece is made of, never where a guest can walk. Pick a preset by its plain genre id (`THEME_IDS` = fire · steampunk · pirateBeach · enchantedForest · neon); the five place-name consts (EMBERFALL_CALDERA and friends) still resolve but are deprecated, because a proper noun invites invented lore instead of a choice of LOOK.',
      render: () => (
        <ScenePreview distance={42} targetY={1.1} height={500} autoRotate={false} dress={setPiecePaving(TRIO)}>
          {TRIO.map((plan) => (
            <FountainPlaza key={plan.id} plan={plan} />
          ))}
        </ScenePreview>
      ),
    },
  ],
};

export default previews;

import React from 'react';
import { ScenePreview } from '../Park';
import { ENCHANTED_FOREST, FIRE, NEON_CITY, PIRATE_BEACH, STEAMPUNK, setPiecePaving } from '../SetPieceKit';
import { Bazaar, bazaarPlan } from './index';

const ROW = bazaarPlan({ id: 'market', position: [0, 0], seed: 5 });
const BIG = bazaarPlan({
  id: 'grand-bazaar',
  position: [0, 0],
  stalls: ['burger', 'hotDog', 'soda', 'cottonCandy', 'balloon', 'soda'],
  seed: 11,
});

// the SAME planner + the SAME stalls + the SAME seed, dressed for two WORLDS
const THEME_STALLS = ['burger', 'soda', 'balloon'] as const;
const EMBER_ROW = bazaarPlan({
  id: 'caldera-market',
  title: 'Caldera Market',
  position: [0, -4.8],
  stalls: [...THEME_STALLS],
  seed: 5,
  theme: FIRE,
});
const PULSE_ROW = bazaarPlan({
  id: 'pulse-market',
  title: 'Pulse Market',
  position: [0, 4.8],
  stalls: [...THEME_STALLS],
  seed: 5,
  theme: NEON_CITY,
});

// ---- every preset, stocked with ITS OWN counter -----------------------------
// One row per world, 4.8 u apart (the lattice pitch the planner snaps to), each
// leading with `THEMED_STALL_OF[theme.id]` — the whole reason the themed five
// exist. Two neutral stands fill each row: neutral stock is legal in every
// world, a FOREIGN world's counter is not (see the crossTheme note below).
const PRESET_ROWS = [
  { theme: FIRE, id: 'fire-row', title: 'Cinder Row', z: -9.6, stalls: ['emberRoast', 'burger', 'soda'] as const,
    names: ['Cinder Grill', 'Ashfall Burgers', 'Slagworks Sodas'] },
  { theme: STEAMPUNK, id: 'steam-row', title: 'Foundry Row', z: -4.8, stalls: ['goggles', 'burger', 'cottonCandy'] as const,
    names: ['The Goggle Works', 'Boiler Burgers', 'Cogfloss'] },
  { theme: PIRATE_BEACH, id: 'tide-row', title: 'Dockside Row', z: 0, stalls: ['sushi', 'hotDog', 'soda'] as const,
    names: ['Dockside Sushi', 'Harbour Dogs', 'Ebbtide Sodas'] },
  { theme: ENCHANTED_FOREST, id: 'glade-row', title: 'Glade Row', z: 4.8, stalls: ['honeywitch', 'cottonCandy', 'balloon'] as const,
    names: ['The Honeywitch', 'Mosswood Floss', 'Wisp Balloons'] },
  { theme: NEON_CITY, id: 'neon-row', title: 'Voltage Row', z: 9.6, stalls: ['neonSlush', 'soda', 'balloon'] as const,
    names: ['Neon Slush', 'Voltage Sodas', 'Helium Bar'] },
].map((r) =>
  bazaarPlan({ id: r.id, title: r.title, position: [0, r.z], stalls: [...r.stalls], names: r.names, seed: 5, theme: r.theme }),
);

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
    {
      name: 'One bazaar, two WORLDS (the theme layer)',
      description:
        'The dress layer in isolation: the same bazaarPlan — same three NEUTRAL stalls, same seed, same geometry, same footprint — dressed for two worlds by passing `theme`. Near row: FIRE (ember/oxblood canvas, obsidian ironwork, basalt paving, FLAME lanterns that breathe hard at night). Far row: NEON_CITY (magenta canvas on near-black violet paving, CHROME cable, COLD neon lanterns that barely flicker, magenta/cyan/lime span bulbs). The two entrance markers are the theme\'s own `planting.markers` pair — signpost + flagpole in the fire row, signpost + TV-monitor post in the neon one. Everything structural is untouched: `WorldTheme` only supplies the palette, the planted species, the lamp character, a ride-colour preset hint and a seed offset — and its fingerprint sits in the plan key, so swapping a theme really rebuilds the piece instead of leaving the old palette on screen. Omit `theme` and you get DEFAULT_THEME, whose values ARE the old hard-coded consts.',
      render: () => (
        <ScenePreview distance={22} targetY={1.4} height={520} autoRotate={false} dress={setPiecePaving([EMBER_ROW, PULSE_ROW])}>
          <Bazaar plan={EMBER_ROW} />
          <Bazaar plan={PULSE_ROW} />
        </ScenePreview>
      ),
    },
    {
      name: 'All five presets, each stocked with its own counter',
      description:
        'The five shipped worlds as five rows — FIRE, STEAMPUNK, PIRATE_BEACH, ENCHANTED_FOREST, NEON_CITY (front to back) — and this one is about the STOCK, not just the dress. Every preset ships its own stall, and each row leads with it via `THEMED_STALL_OF[theme.id]`: Ember Roast, The Goggle Works, Dockside Sushi, The Honeywitch, Neon Slush. Before those existed a bazaar could only mount the neutral five, so the market in the caldera, the one on the shipwreck beach and the one in the nightclub street were literally the same three shops. Two rules this preview also demonstrates: a themed counter is coherent ONLY inside its own world (drop `sushi` into the fire row and `auditWorldThemes` reports a `crossTheme` defect — the planner lints it for you), while the NEUTRAL stands are legal anywhere, which is why each row fills out with two of them. `names` gives every shop an authored sign instead of the machine-sounding "Cinder Row Soda Stand" default.',
      render: () => (
        <ScenePreview distance={38} targetY={1.3} height={640} autoRotate={false} dress={setPiecePaving(PRESET_ROWS)}>
          {PRESET_ROWS.map((plan) => (
            <Bazaar key={plan.id} plan={plan} />
          ))}
        </ScenePreview>
      ),
    },
  ],
};

export default previews;

// ---------------------------------------------------------------------------
// theme-regions.tsx — THE THEME ABSTRACTION, demonstrated.
//
// Three worlds on one plot, declared as three rectangles. NOTHING below passes a
// `surfaceZones` prop, a `surface` prop, or a furniture colour: the streets
// through each rectangle pave themselves from that world's `theme.pathSurface`,
// and the benches / litter bins / lamp posts the network plants on those streets
// dress themselves from `theme.furniture` — charred iron and lava lanterns in
// FIRE, black steel and magenta neon in NEON, mossed iron in ENCHANTED FOREST.
//
// The lattice is ONE continuous grid crossing all three regions, so the seam is
// the whole point: the surface changes mid-avenue where a region boundary falls,
// with municipal tarmac on the hub between them.
//
// Deliberately small and sparse. This is a MECHANISM demo — a wide lattice on a
// small plot only picks fights with the terrain's dips (the `causeway` lint,
// correctly), and every extra prop is another chance to stand in a street.
// ---------------------------------------------------------------------------
import React from 'react';
import { Park, Terrain, Paths, ThemeRegion, Gate, GameManager, Scenery } from './components/Park';
import { Carousel } from './components/Carousel';
import { BurgerShop } from './components/BurgerShop';

// A 3x3 grid in the flat forecourt, plus a spine south to the park boundary for
// the gate. Every coordinate is a multiple of 1.2 (the RCT2 tile), which
// `<Paths grid>` lints.
const NODES: [number, number][] = [
  [-7.2, -7.2], [0, -7.2], [7.2, -7.2], // 0 1 2   south row
  [-7.2, 0], [0, 0], [7.2, 0],          // 3 4 5   middle row
  [-7.2, 7.2], [0, 7.2], [7.2, 7.2],    // 6 7 8   north row
  [0, -14.4], [0, -24],                 // 9 10    gate spine (10 sits ON the plot edge)
];
// the cells we STAND STRUCTURES ON — the ride pad and its queue run, the stall,
// the two scenery pads. Guarded for the same reason the lattice is: keepDry
// guarantees dry, flat-ish ground, and a pad on a hill flank is a `terrain`
// failure ("parked on a hill flank"). Guard what you PAVE or BUILD ON, nothing more.
const BUILT: [number, number][] = [
  [-7.2, -12], [-7.2, -10.8], [-7.2, -9.6], [-7.2, -8.4], // Carousel pad + queue
  [3.6, -3.6], [-3.6, 3.6], [3.6, 3.6],                    // stall + scenery
];
const EDGES: [number, number][] = [
  [0, 1], [1, 2], [3, 4], [4, 5], [6, 7], [7, 8], // rows
  [0, 3], [3, 6], [1, 4], [4, 7], [2, 5], [5, 8], // columns
  [1, 9], [9, 10],                                 // the gate approach
];

// THE THREE WORLDS, as rectangles (centre + HALF-extents). `fire` owns the
// west column and the west end of all three rows; `neon` mirrors it east;
// `enchantedForest` takes the middle of the north row.
const WORLDS = [
  { theme: 'fire', position: [-7.2, 0] as [number, number], extent: [3.0, 8.4] as [number, number] },
  { theme: 'neon', position: [7.2, 0] as [number, number], extent: [3.0, 8.4] as [number, number] },
  { theme: 'enchantedForest', position: [0, 7.2] as [number, number], extent: [3.6, 1.8] as [number, number] },
];

export default function ThemeRegions() {
  return (
    <div style={{ width: '100%', height: '100vh', position: 'relative' }}>
      <Park
        seed={3}
        climate="temperate"
        size={48}
        guests={20}
        roster={{ rides: 1, stalls: 1 }}
        onReady={(report: any) => {
          // eslint-disable-next-line no-console
          console.log('[THEME-REGIONS]', report?.ok ? 'ok' : 'FAILURES', report?.failures?.length ?? 0);
        }}
      >
        {/* guard EXACTLY what we pave — the lattice nodes. This is the sanctioned
            use of keepDry (guard what you pave or stand a structure on) — the
            lattice plus BUILT; guarding everything would move the heightfield and
            hide real defects. */}
        <Terrain keepDry={[...NODES, ...BUILT]} />
        {/* declared BEFORE <Paths>: the street network reads the registered
            regions when it builds and derives its own surfaceZones from them */}
        {WORLDS.map((w) => (
          <ThemeRegion key={w.theme} theme={w.theme} position={w.position} extent={w.extent} />
        ))}
        <Paths nodes={NODES} edges={EDGES} />
        <GameManager />
        <Gate position={[0, -24]} />

        {/* everything else sits at a CELL INTERIOR — 3.6 u off every street row,
            well clear of the 1.1 u slab + its patrol margin. The AI still picks
            WHICH pieces suit a world; the region only answers what they look like. */}
        {/* The RIDE sits OUTSIDE the lattice, due south of node 0, so its derived
            queue runs north through open ground to that node instead of across a
            street. A ride parked in a cell INTERIOR cannot do that: a 3.3 u queue
            from the middle of a 7.2 u cell reaches a street whichever way it
            faces, which is the `blockers` failure this layout started with. */}
        <Carousel
          position={[-7.2, -12]}
          register={{ name: 'Fire Carousel', capacity: 4, rideDuration: 8, intensity: 2, price: 3 }}
        />
        <BurgerShop position={[3.6, -3.6]} rotation={-Math.PI / 2} register={{ name: 'Foundry Grill', price: 3, value: 5 }} />
        <Scenery name="cactusCluster" position={[-3.6, 3.6]} />
        <Scenery name="mushroomCluster" position={[3.6, 3.6]} />
      </Park>
    </div>
  );
}

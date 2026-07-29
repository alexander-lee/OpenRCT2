// §0 PRE-FLIGHT (throwaway fixture — counted off THIS file)
//   SEED 7 · CLIMATE temperate · SIZE 48
//   WORLDS: none declared (this is a stall-visibility rig, not a composed park)
//   ROSTER: rides 1 (Scale Wheel) · stalls 4 (Vis Honeywitch / Vis Sushi /
//           Vis Goggles / Vis Roast) · categories 2 (gentle + 4 shops)
//   GATE reach: gate [-12, 21.6] → nearest street node [-12, 12] = 9.6 u,
//           gate → farthest stall [14.4, 1.08] = 33.2 u, inside §0.3's ~75 u
//   LATTICE edge-length classes: 4.8 (x5), 7.2 (x1), 9.6 (x2), 11.8 (x1) — all
//           multiples of the 1.2 cell except the 3→9 spur (12.0)
// THROWAWAY VISUAL FIXTURE — delete after use. NOT a corpus park, never probed
// with --signature. Its only job: put Honeywitch / SushiStall / GoggleWorks /
// EmberRoast in a row on one street of a real <Park>, next to a FerrisWheel for
// scale, and let eval.mjs shoot them from the park's own overhead cameras — the
// distance a guest actually picks a shop from. w33b.tsx (the real sample park
// that mounts all four) could not be used: components/Carousel is mid-edit by
// another session and its syntax error refuses the whole bundle.
import React from 'react';
import { Park, Terrain, Paths, GameManager, Gate } from './components/Park';
import { FerrisWheel } from './components/FerrisWheel';
import { Honeywitch } from './components/Honeywitch';
import { SushiStall } from './components/SushiStall';
import { GoggleWorks } from './components/GoggleWorks';
import { EmberRoast } from './components/EmberRoast';

const NODES: [number, number][] = [
  [-16.8, 2.4],
  [-12, 2.4],
  [-4.8, 2.4],
  [0, 2.4],
  [4.8, 2.4],
  [12, 2.4],
  [16.8, 2.4],
  [-12, 12],
  [-12, 21.6],
  [0, -9.6],
];
const EDGES: [number, number][] = [
  [0, 1],
  [1, 2],
  [2, 3],
  [3, 4],
  [4, 5],
  [5, 6],
  [1, 7],
  [7, 8],
  [3, 9],
];

// pad centre 1.32 u off the walked centreline — the same offset Honeywitch's own
// audit measures as clean against lintPadOffLattice's 1.20 threshold
const SZ = 2.4 - 1.32;

export default function StallVis() {
  return (
    <Park
      seed={7}
      climate="temperate"
      size={48}
      guests={8}
      roster={{ rides: 1, stalls: 4, categories: 2 }}
      fullscreen
      onReady={(r) => {
        (window as unknown as { __parkReport?: unknown }).__parkReport = r ?? { skipped: true };
      }}
    >
      <Terrain />
      <Paths nodes={NODES} edges={EDGES} walkers={4} />
      <GameManager />
      <Gate position={[-12, 21.6]} />
      <FerrisWheel position={[0, -16.8]} rotation={-Math.PI / 2} register={{ name: 'Scale Wheel', capacity: 4, rideDuration: 8, price: 3, intensity: 3 }} />
      <Honeywitch position={[-14.4, SZ]} rotation={0} register={{ name: 'Vis Honeywitch', price: 4, value: 6 }} />
      <SushiStall position={[-4.8, SZ]} rotation={0} register={{ name: 'Vis Sushi', price: 4, value: 6 }} />
      <GoggleWorks position={[4.8, SZ]} rotation={0} register={{ name: 'Vis Goggles', price: 4, value: 6 }} />
      <EmberRoast position={[14.4, SZ]} rotation={0} register={{ name: 'Vis Roast', price: 4, value: 6 }} />
    </Park>
  );
}


import React from 'react';
import {
  Park, Terrain, Paths, GameManager, Gate, Coaster,
  Scenery, Placed, Lights, Neon,
} from './components/Park';
// HARNESS COMPILE FIX (the ONLY edit to the generated source): the artifact
// imported FerrisWheel + Teacups from './Park', which exports neither — rules
// §"Canonical imports" says "NEVER from './Park'". esbuild refused the bundle.
// Specifiers relocated to the components' own folders; nothing else touched.
import { FerrisWheel } from './components/FerrisWheel';
import { Teacups } from './components/Teacups';
import { FountainPlaza } from './components/FountainPlaza';
import { Bazaar } from './components/Bazaar';
import { Boulevard } from './components/Boulevard';
import { Carousel } from './components/Carousel';
import { SwingRide } from './components/SwingRide';
import { DropTower } from './components/DropTower';
import { SodaStand } from './components/SodaStand';
import { tree } from './components/Kit';
import {
  SEED, CLIMATE, SIZE,
  FLAGSHIP_PIECES, FLAGSHIP_START, FLAGSHIP_HEADING, FLAGSHIP_TAIL, FLAGSHIP_EXIT, FLAGSHIP_PTS,
  HUB, MARKET, GATE_AVE, HUB_MARKET_AVE, WEST_AVE, NET,
} from './meadowmere.plan';

/**
 * WILLOWMERE GARDENS — a size-192 temperate family park (seed 1).
 *
 * Streets fused by buildParkNet from a FountainPlaza hub + a Bazaar market +
 * three Boulevards + a 10-node spine (§0.15). Four places: the Grand Green hub
 * by the gate, Fairground Mile (west) with the §4.0-B FAMILY flagship, the
 * Market Walk, and Lakeside Boardwalk on the south shore of the composed lake.
 *
 * §0.16 flagship rating (rateCoaster, §4.0-B, steel, bank 0.7, cars 3):
 *   [thrill] E 5.27 I 6.25 N 2.25  drop 3.58  G +3.51/-1.97  lat 0.27  air 0.56s
 *
 * Intensity spread: Teacups (gentle, I 3) · Carousel + FerrisWheel (gentle) ·
 * SwingRide (moderate, I 4) · DropTower (intense, I 7) · flagship coaster.
 */

export function WillowmerePark() {
  return (
    <Park seed={SEED} climate={CLIMATE} size={SIZE} guests={14}>
      <Terrain keepDry={NET.keepDry} coasterPts={FLAGSHIP_PTS} />
      <Paths
        nodes={NET.nodes}
        edges={NET.edges}
        plazas={NET.plazas}
        bins={NET.bins}
        walkers={7}
      />
      <GameManager />
      <Gate />

      {/* ── set-pieces (after Paths so dressing settles on the paving) ── */}
      <FountainPlaza plan={HUB} />
      <Bazaar plan={MARKET} />
      <Boulevard plan={GATE_AVE} />
      <Boulevard plan={HUB_MARKET_AVE} />
      <Boulevard plan={WEST_AVE} />

      {/* ── FLAGSHIP: §4.0-B FAMILY steel rectangle, Fairground Mile ── */}
      <Coaster
        name="Willowmere Comet"
        pieces={FLAGSHIP_PIECES as any}
        start={FLAGSHIP_START}
        heading={FLAGSHIP_HEADING}
        type="steel"
        bank={0.7}
        cars={3}
        capacity={12}
        rideDuration={10}
        intensity={7}
        price={5}
        queueTailNode={NET.node(FLAGSHIP_TAIL)}
        queueDir={[1, 0]}
      />

      {/* ── gate-side family ride (queue tail ~10 u from the gate, §0.3) ── */}
      <Teacups
        position={[7.2, 82.8]}
        rotation={0}
        register={{ name: 'Bramble Teacups', capacity: 4, rideDuration: 8, intensity: 3, price: 3 }}
        queue={{ anchor: [7.2, 84.09], dir: [0, 1] }}
      />

      {/* ── Fairground Mile spinner (coaster-ring interior meadow) ── */}
      <SwingRide
        position={[-49.2, 47.4]}
        rotation={0}
        register={{ name: 'Meadow Swings', capacity: 8, rideDuration: 8, intensity: 4, price: 3 }}
        queue={{ anchor: [-49.2, 45.69], dir: [0, 1] }}
      />

      {/* ── Lakeside Boardwalk (south shore) ── */}
      <FerrisWheel
        position={[16.8, 32.4]}
        rotation={0}
        register={{ name: 'Willowmere Wheel', capacity: 8, rideDuration: 10, price: 3, intensity: 2 }}
        queue={{ anchor: [16.8, 30.09], dir: [0, 1] }}
      />
      <Carousel
        position={[34.8, 32.4]}
        rotation={0}
        register={{ name: 'Gilded Carousel', capacity: 8, rideDuration: 8, price: 3, intensity: 2 }}
        queue={{ anchor: [34.8, 30.09], dir: [0, 1] }}
      />
      <DropTower
        position={[34.8, 25.2]}
        rotation={Math.PI}
        register={{ name: 'Skyfall Drop', capacity: 10, rideDuration: 10, intensity: 7, price: 4 }}
        queue={{ anchor: [34.8, 27.51], dir: [0, -1] }}
      />

      {/* ── extra shop by the boardwalk hub ── */}
      <SodaStand
        position={[13.2, 38.4]}
        rotation={Math.PI / 2}
        register={{ name: 'Lakeside Soda', price: 2, value: 4 }}
      />

      {/* ── signage + string lights ── */}
      <Neon text="WILLOWMERE" position={[0, 2.0, 88.8]} rotation={Math.PI} scale={0.6} />
      <Neon text="BOARDWALK" position={[16.8, 1.8, 24.0]} rotation={0} scale={0.5} />
      <Lights from={[15.0, 34.8]} to={[36.6, 34.8]} />

      {/* street-frontage planting (dressTerrain covers the far forest) */}
      <WillowmereTrees />
    </Park>
  );
}

/** Street-frontage trees near the built-up middle ground, deterministic
 *  offsets, all west/south of the lake wet box. */
function WillowmereTrees() {
  const spots: { xz: [number, number]; shape: 'round' | 'pine' | 'palm' | 'willow' }[] = [];
  const hub: [number, number][] = [
    [-9.6, 84.0], [9.6, 84.0], [-10.8, 66.0], [10.8, 66.0], [-13.2, 80.4], [13.2, 80.4],
  ];
  hub.forEach((xz) => spots.push({ xz, shape: 'round' }));
  const west: [number, number][] = [
    [-19.2, 76.8], [-24.0, 72.0], [-30.0, 66.0], [-36.0, 62.4],
    [-42.0, 60.0], [-54.0, 56.4], [-58.8, 50.4], [-54.0, 44.4],
    [-45.6, 40.8], [-38.4, 42.0], [-30.0, 44.4], [-22.8, 48.0],
    [-16.8, 60.0], [-19.2, 66.0],
  ];
  west.forEach((xz) => spots.push({ xz, shape: 'pine' }));
  const shore: [number, number][] = [
    [9.6, 27.6], [12.0, 24.0], [21.6, 26.4], [30.0, 24.0],
    [38.4, 26.4], [40.8, 32.4], [40.8, 40.8], [7.2, 33.6],
    [43.2, 36.0], [22.8, 42.0], [30.0, 42.0], [12.0, 43.2],
  ];
  shore.forEach((xz) => spots.push({ xz, shape: 'palm' }));
  const market: [number, number][] = [
    [-8.4, 50.4], [8.4, 50.4], [-8.4, 56.4], [8.4, 56.4],
  ];
  market.forEach((xz) => spots.push({ xz, shape: 'round' }));

  return (
    <>
      {spots.map((s, i) => (
        <Placed key={`tree-${i}`} build={(t: any) => tree(t, { shape: s.shape })} position={s.xz} />
      ))}
    </>
  );
}

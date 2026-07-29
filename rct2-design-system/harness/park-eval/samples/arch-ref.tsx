// REFERENCE PARK 2 — the §4.0-A THRILL archetype at its VERIFIED start, in a
// size-48 park whose street layer follows the round-7 rules: every ride pad on
// a CELL INTERIOR ≥ 1.8 u off every lattice node and edge centreline, only the
// queue lanes touching nodes. Substitute for the lost samples/arch-w6.tsx
// Seed 7 temperate — the seed the archetype's END-TO-END verification used.
// GUARDED probe (probe-seed.mjs with this park's keepDry) says the water
// RE-PICKS to centre (14.7, 14.7), basins (9.6, 9.6) wl-r 4.5 + (10.1, 13.3)
// wl-r 6.1 — NOT the seed table's pre-guard river at (18.1, −5.9). Every node,
// pad and prop below is placed against the PROBED lake, which is exactly the
// round-7 lesson: re-read the composed water, never trust the table.
//
// SEED STABILITY — MEASURED 2026-07-25, DO NOT RE-SEED. At THIS park's size
// (48) seed 7 temperate is `probes 1` unguarded: §1's `probes 18` is the
// size-128 row and `probes` is SIZE-dependent. Under this park's real guards
// (33 keepDry + 164 coasterPts) it probes 64 / 0 violations / 9 clamp discs,
// and 12 realistic one-cell keepDry edits moved the landform 0 times. The
// `probes 1` temperate alternatives (31, 83) measure identically here (64
// probes, 0 moved) and would only move the lake this file is planned against.
import React from 'react';
import {
  Park,
  GameManager,
  Terrain,
  Paths,
  Gate,
  Coaster,
  Fountain,
  Restroom,
  Torch,
  Scenery,
  Lights,
  Placed,
} from './components/Park';
import { compileTrackPieces } from './components/SplineRideKit';
import { Carousel } from './components/Carousel';
import { FerrisWheel } from './components/FerrisWheel';
import { BurgerShop } from './components/BurgerShop';
import { SodaStand } from './components/SodaStand';
import { tree } from './components/Kit';

// §4.0-A THRILL steel rectangle — VERBATIM from rules/park-generation.md
const A_PIECES = [
  'station',
  { type: 'lift', height: 5.5 }, { type: 'straight', length: 4.84 }, { type: 'turnR', angle: 90, radius: 2.5 },
  { type: 'drop', height: 5.5 }, { type: 'hill', height: 1.2 },
  { type: 'lift', height: 5.1 }, { type: 'straight', length: 2.34 }, { type: 'turnR', angle: 90, radius: 2.5 },
  { type: 'drop', height: 5.1 }, { type: 'hill', height: 0.6 }, { type: 'hill', height: 0.6 },
  { type: 'lift', height: 5.1 }, { type: 'turnR', angle: 90, radius: 2.5 },
  { type: 'drop', height: 5.1 }, { type: 'hill', height: 0.6 }, { type: 'hill', height: 0.6 },
  { type: 'lift', height: 5.1 }, { type: 'turnR', angle: 90, radius: 2.5 },
  { type: 'drop', height: 5.1 }, { type: 'straight', length: 1.5 },
] as const;

const START: [number, number, number] = [16.8, 0.55, -3.6];
const COMPILED = compileTrackPieces(A_PIECES as any, { type: 'steel', start: START, heading: 0, bounds: 48 });
const PTS = COMPILED.points as [number, number, number][];

// ---- streets: a SPINE, not a uniform grid. Ride cells are never nodes. ------
const NODES: [number, number][] = [
  [-12, 22.8], //  0 gate (front apron, clear of the ring's north grade band)
  [-12, 15.6], //  1
  [-6, 15.6], //  2 Carousel queue tail
  [0, 15.6], //  3
  [0, 9.6], //  4
  [0, 3.6], //  5 FerrisWheel queue tail
  [0, -3.6], //  6
  [0, -9.6], //  7
  [6, -9.6], //  8
  // the east detour drops to z −13.2 BEFORE crossing the ring's final drop
  // leg (x 16.8): at z −9.6 the track is only 2.18 u up — under the 2.2 u
  // fly-over gate — while at z −13.2 it is ~3.5 u up. Probed, not guessed.
  [6, -13.2], //  9
  [12, -13.2], // 10
  [18, -13.2], // 11
  [22.8, -13.2], // 12
  [22.8, -9.6], // 13
  [22.8, -3.6], // 14 coaster queue tail (start.x + 6.0, same z)
];
const EDGES: [number, number][] = [
  [0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 7], [7, 8], [8, 9], [9, 10], [10, 11], [11, 12], [12, 13], [13, 14],
];
const PLAZA: [number, number, number, number] = [0, 6.6, 3.6, 3.6];
const BINS: [number, number][] = [[0, 9.6], [0, -3.6]];

const KEEP_DRY: [number, number][] = [
  ...NODES,
  [-6, 9.6], [-6, 12.6], // Carousel pad + lane
  [6, 3.6], [3.6, 3.6], // FerrisWheel pad + lane
  [19.2, -3.6], [20.4, -3.6], [19.2, -1.2], [18, -3.6], // coaster queue + exit apron
  [-2.4, 6.6], [2.4, 3.6], [-2.4, 0], [2.4, 6.6], // stalls, restroom, fountain
  [3.6, 9.6], [-3.6, 9.6], [-3.6, -3.6], [3.6, -3.6], [-3.6, 3.6], [4.8, -6.6], // scenery
];

// literal union, not `string` — `tree()` takes exactly these four
// (`node typecheck.mjs`; esbuild strips types without checking them)
const TREES: [number, number, 'round' | 'pine' | 'palm' | 'willow'][] = [
  [-4.8, 19.2, 'round'], [-8.4, 19.2, 'pine'], [-4.8, 12.0, 'pine'], [-9.6, 6.0, 'pine'],
  [-9.6, 0.0, 'round'], [4.8, 0.0, 'round'], [-6.0, -6.0, 'pine'], [6.0, -4.8, 'pine'],
  [-9.6, -9.6, 'pine'], [9.6, -4.8, 'round'], [12.0, -3.6, 'pine'], [-3.6, 13.2, 'round'],
  [-8.4, 8.4, 'pine'], [-13.2, 9.6, 'pine'],
];

export default function ArchRef() {
  return (
    <div style={{ width: '100%', height: '100vh', position: 'relative' }}>
      <Park
        seed={7}
        climate="temperate"
        size={48}
        guests={20}
        roster={{ rides: 3, stalls: 2 }}
        onReady={(report: any) => {
          // eslint-disable-next-line no-console
          console.log('[ARCH-REF]', report?.ok ? 'ok' : 'FAILURES', report?.failures?.length ?? 0, 'warnings', report?.warnings?.length ?? 0);
        }}
      >
        <Terrain keepDry={KEEP_DRY} coasterPts={PTS} />
        <Paths nodes={NODES} edges={EDGES} plazas={[PLAZA]} walkers={5} bins={BINS} />
        <GameManager />
        <Gate position={[-12, 22.8]} />

        {/* FLAGSHIP — §4.0-A, no bank prop, closes itself */}
        <Coaster
          name="Summit Firestorm"
          pieces={A_PIECES as any}
          start={START}
          heading={0}
          type="steel"
          cars={5}
          capacity={4}
          rideDuration={10}
          intensity={7}
          price={6}
          deck={[-2.4, 0]}
          queueTailNode={14}
          queueDir={[1, 0]}
        />

        {/* flats on CELL INTERIORS — 6.0 u off every node, lanes trim onto them */}
        <Carousel
          position={[-6, 9.6]}
          rotation={0}
          register={{ name: 'Alpine Carousel', capacity: 4, rideDuration: 8, intensity: 2, price: 3 }}
        />
        <FerrisWheel
          position={[6, 3.6]}
          rotation={-Math.PI / 2}
          register={{ name: 'Tarn Wheel', capacity: 4, rideDuration: 9, intensity: 3, price: 4 }}
        />

        {/* amenities — all ≥ 1.8 u off the spine */}
        <Fountain position={[2.4, 6.6]} />
        <Restroom position={[-2.4, 0]} rotation={Math.PI / 2} />
        <BurgerShop position={[-2.4, 6.6]} rotation={Math.PI / 2} register={{ name: 'Summit Grill', price: 3, value: 5 }} />
        <SodaStand position={[2.4, 3.6]} rotation={-Math.PI / 2} register={{ name: 'Glacier Soda', price: 2, value: 4 }} />

        <Torch position={[-1.8, 8.4]} />
        <Torch position={[1.8, 8.4]} />
        <Lights from={[-1.8, 11.4]} to={[1.8, 11.4]} />

        <Scenery name="marbleStatue" position={[3.6, 9.6]} />
        <Scenery name="planterBox" position={[-3.6, 9.6]} />
        <Scenery name="topiarySpiral" position={[-3.6, -3.6]} />
        <Scenery name="parkClock" position={[3.6, -3.6]} />
        <Scenery name="signpost" position={[-3.6, 3.6]} />
        <Scenery name="picnicTable" position={[4.8, -6.6]} />

        {TREES.map(([x, z, shape], i) => (
          <Placed key={`t${i}`} build={(t: any) => tree(t, { shape })} position={[x, z]} />
        ))}
      </Park>
    </div>
  );
}

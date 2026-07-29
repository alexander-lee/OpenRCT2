import React from 'react';
import {
  Park,
  GameManager,
  Terrain,
  Paths,
  Gate,
  TrackRide,
  Fountain,
  Restroom,
  Torch,
  Neon,
  Scenery,
  Lights,
  Placed,
} from './Park';
import { FerrisWheel } from './FerrisWheel';
import { Carousel } from './Carousel';
import { Teacups } from './Teacups';
import { DropTower } from './DropTower';
import { GhostTrain } from './GhostTrain';
import { LogFlume } from './LogFlume';
import { EmberRoast } from './EmberRoast';
import { GoggleWorks } from './GoggleWorks';
import { NeonSlush } from './NeonSlush';
import { BurgerShop } from './BurgerShop';
import { SodaStand } from './SodaStand';
import {
  Fumarole,
  BasaltColumns,
  LavaFissure,
  ObsidianShards,
  CharredSnag,
} from './EmberfallScenery';
import {
  GiantGear,
  SteamPipes,
  ClockTower,
  BoilerTank,
  CoalCart,
} from './BrassworkScenery';
import {
  NeonArch,
  SpeakerStack,
  MirrorBallPylon,
  LaserTruss,
  LightTiles,
} from './PulseScenery';
import { tree } from './Kit';

/* ------------------------------------------------------------------ *
 * Street lattice — every node sits on the 1.2 u grid and every edge
 * is axis-aligned (no diagonals). Rides hang their queue off a nearby
 * node; the chassis derives the lane + entrance/exit huts.
 * ------------------------------------------------------------------ */
const NODES: [number, number][] = [
  /* 0  */ [0, 62.4], // under the gate
  /* 1  */ [0, 54.0],
  /* 2  */ [0, 45.6], // hub
  /* 3  */ [0, 36.0],
  /* 4  */ [0, 24.0],
  /* 5  */ [0, 12.0],
  /* 6  */ [0, 0.0], // central crossroads
  /* 7  */ [0, -12.0],
  /* 8  */ [0, -24.0], // emberfall gate
  /* 9  */ [0, -33.6],
  /* 10 */ [12, 0],
  /* 11 */ [24, 0], // pulse plaza
  /* 12 */ [24, 12], // ghost train tail
  /* 13 */ [24, -12], // log flume tail
  /* 14 */ [-12, 0],
  /* 15 */ [-24, 0], // brasswork plaza
  /* 16 */ [-24, 12],
  /* 17 */ [-24, -12],
  /* 18 */ [12, -24], // ember roast tail
  /* 19 */ [-12, -24],
  /* 20 */ [12, -33.6], // teacups-2 tail
  /* 21 */ [-12, -33.6],
  /* 22 */ [7.2, 54.0], // teacups tail (near gate)
  /* 23 */ [-7.2, 54.0], // carousel tail
  /* 24 */ [12, 24.0], // ferris tail
  /* 25 */ [-12, 24.0], // drop tower tail
  /* 26 */ [30, 0],
  /* 27 */ [30, -12],
  /* 28 */ [33.6, -12], // coaster tail spur
];

const EDGES: [number, number][] = [
  // central spine
  [0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 7], [7, 8], [8, 9],
  // near-gate ride spurs
  [1, 22], [1, 23],
  // mid ride spurs
  [4, 24], [4, 25],
  // east / pulse district
  [6, 10], [10, 11], [11, 12], [11, 13], [11, 26], [26, 27], [13, 27], [13, 28],
  // west / brasswork district
  [6, 14], [14, 15], [15, 16], [15, 17],
  // south / emberfall district
  [8, 18], [8, 19], [18, 20], [19, 21],
];

const BINS: [number, number][] = [
  [3.6, 45.6],
  [24, 3.6],
  [-24, 3.6],
  [3.6, -24],
  [0, 8.4],
];

// deterministic tree scatter — clear of streets, pads and water corners
const TREES: { pos: [number, number]; shape: 'pine' | 'round' }[] = [
  // entrance allée
  { pos: [4.2, 58.8], shape: 'pine' }, { pos: [-4.2, 58.8], shape: 'pine' },
  { pos: [4.2, 50.4], shape: 'round' }, { pos: [-4.2, 50.4], shape: 'round' },
  // hub ring
  { pos: [8.4, 42.0], shape: 'round' }, { pos: [-8.4, 42.0], shape: 'round' },
  { pos: [8.4, 49.2], shape: 'pine' }, { pos: [-8.4, 49.2], shape: 'pine' },
  // spine mid
  { pos: [6.0, 33.6], shape: 'round' }, { pos: [-6.0, 33.6], shape: 'round' },
  { pos: [6.0, 15.6], shape: 'pine' }, { pos: [-6.0, 15.6], shape: 'pine' },
  { pos: [7.2, 27.6], shape: 'round' }, { pos: [-7.2, 27.6], shape: 'round' },
  // central crossroads corners
  { pos: [8.4, 8.4], shape: 'pine' }, { pos: [-8.4, 8.4], shape: 'pine' },
  { pos: [8.4, -8.4], shape: 'round' }, { pos: [-8.4, -8.4], shape: 'round' },
  // pulse east belt
  { pos: [18, 8.4], shape: 'round' }, { pos: [30, 8.4], shape: 'pine' },
  { pos: [18, -6.0], shape: 'round' }, { pos: [34.8, -6.0], shape: 'pine' },
  // brasswork west belt
  { pos: [-18, 8.4], shape: 'pine' }, { pos: [-30, 8.4], shape: 'round' },
  { pos: [-18, -6.0], shape: 'pine' }, { pos: [-30, -6.0], shape: 'round' },
  { pos: [-30, 3.6], shape: 'round' }, { pos: [-18, 15.6], shape: 'pine' },
  // emberfall south fringe (charred / sparse)
  { pos: [6.0, -30.0], shape: 'pine' }, { pos: [-6.0, -30.0], shape: 'pine' },
  { pos: [18, -30.0], shape: 'round' }, { pos: [-18, -30.0], shape: 'round' },
  // outer meadow fill
  { pos: [14.4, 33.6], shape: 'round' }, { pos: [-14.4, 33.6], shape: 'round' },
  { pos: [20.4, 20.4], shape: 'pine' }, { pos: [-20.4, 20.4], shape: 'pine' },
];

export function ParkScene() {
  return (
    <Park
      seed={91}
      climate="desert"
      guests={60}
      onReady={(report: any) => {
        // eslint-disable-next-line no-console
        console.log('[ParkScene] validatePark:', report?.ok, report);
      }}
    >
      {/* ---- ground + streets + sim brain + entrance ---- */}
      <Terrain />
      <Paths nodes={NODES} edges={EDGES} bins={BINS} walkers={6} />
      <GameManager />
      <Gate />

      {/* ================= RIDES ================= */}
      {/* Near the gate — gentle */}
      <Teacups
        position={[7.2, 48.0]}
        rotation={0}
        register={{ name: 'Sunspin Teacups', capacity: 4, price: 3 }}
      />
      <Carousel
        position={[-7.2, 48.0]}
        rotation={0}
        register={{ name: 'Golden Gallopers', capacity: 8, price: 3 }}
      />

      {/* Mid-park — a big wheel + a thrill drop */}
      <FerrisWheel
        position={[12, 18.0]}
        rotation={0}
        register={{ name: 'Dune Wheel', capacity: 8, price: 4 }}
      />
      <DropTower
        position={[-12, 18.0]}
        rotation={0}
        register={{ name: 'Skyfall Tower', capacity: 10, price: 6 }}
      />

      {/* Pulse district (east) — dark + water */}
      <GhostTrain
        position={[30, 6.0]}
        rotation={Math.PI}
        register={{ name: 'Neon Nightmare', capacity: 6, price: 5 }}
      />
      <LogFlume
        position={[24, -18.0]}
        rotation={0}
        pieces={['station', { type: 'lift', height: 1.4 }, 'turnR', 'drop', 'sbend', 'turnR']}
        register={{ name: 'Cactus Creek Flume', capacity: 4, price: 5 }}
      />

      {/* Flagship wooden coaster (south-east meadow) */}
      <TrackRide
        profile="coaster"
        type="wooden"
        position={[33.6, -18.0]}
        rotation={0}
        pieces={[
          'station',
          { type: 'lift', height: 1.2 },
          'turnR',
          'drop',
          'turnR',
          { type: 'hill', height: 0.6 },
          'turnR',
          'turnR',
          'straight',
        ]}
        register={{ name: 'Rattlesnake Run', capacity: 4, price: 7 }}
      />

      {/* Emberfall district (south) — a second gentle for the far land */}
      <Teacups
        position={[12, -39.6]}
        rotation={0}
        register={{ name: 'Cinder Cups', capacity: 4, price: 3 }}
      />

      {/* ================= STALLS ================= */}
      {/* neutral hub food + drink */}
      <BurgerShop
        position={[3.6, 44.1]}
        rotation={0}
        register={{ name: 'Oasis Grill', price: 3, value: 5 }}
      />
      <SodaStand
        position={[-3.6, 44.1]}
        rotation={0}
        register={{ name: 'Mirage Sodas', price: 2, value: 4 }}
      />
      {/* themed */}
      <EmberRoast
        position={[12, -25.5]}
        rotation={0}
        register={{ name: 'Caldera Grill', price: 4, value: 6 }}
      />
      <GoggleWorks
        position={[-24, -1.5]}
        rotation={0}
        register={{ name: 'Brasswork Optics', price: 4, value: 6 }}
      />
      <NeonSlush
        position={[24, -1.5]}
        rotation={0}
        register={{ name: 'Bassline Brainfreeze', price: 3, value: 5 }}
      />

      {/* ================= AMENITIES ================= */}
      <Fountain position={[4.8, 4.8]} scale={1.4} />
      <Restroom position={[-4.8, 4.8]} rotation={Math.PI} />

      {/* ================= EMBERFALL SCENERY (south) ================= */}
      <LavaFissure position={[4.8, -28.8]} rotation={2.0} length={2.4} seed={4} />
      <LavaFissure position={[-4.8, -30.0]} rotation={1.2} length={2.0} seed={7} />
      <Fumarole position={[8.4, -27.6]} seed={2} />
      <Fumarole position={[-8.4, -28.8]} seed={5} />
      <BasaltColumns position={[10.8, -30.0]} rotation={0.4} seed={3} />
      <BasaltColumns position={[-10.8, -32.4]} rotation={1.1} seed={6} />
      <ObsidianShards position={[6.0, -33.6]} rotation={0.6} seed={7} />
      <CharredSnag position={[-6.0, -33.6]} rotation={0.9} seed={5} />

      {/* ================= BRASSWORK SCENERY (west) ================= */}
      <GiantGear position={[-27.6, 4.8]} rotation={0.6} seed={1} />
      <SteamPipes position={[-30.0, -3.6]} rotation={-0.8} seed={2} />
      <ClockTower position={[-24, 16.8]} seed={3} />
      <BoilerTank position={[-19.2, -3.6]} rotation={1.35} seed={4} />
      <CoalCart position={[-30.0, 12.0]} rotation={0.4} seed={5} />

      {/* ================= PULSE SCENERY (east) ================= */}
      <NeonArch position={[24, 3.6]} rotation={Math.PI} scale={0.6} />
      <MirrorBallPylon position={[34.8, 3.6]} seed={2} />
      <LaserTruss position={[30, 6.0]} rotation={0} seed={3} />
      <SpeakerStack position={[20.4, 4.8]} seed={4} />
      <SpeakerStack position={[27.6, 4.8]} seed={5} />
      <LightTiles position={[27.6, -6.0]} count={4} />

      {/* ================= SHARED SCENERY (SceneryPack) ================= */}
      <Scenery name="parkClock" position={[2.4, 42.0]} />
      <Scenery name="flagpole" position={[3.6, 40.8]} />
      <Scenery name="flagpole" position={[-3.6, 40.8]} />
      <Scenery name="planterBox" position={[3.6, 30.0]} />
      <Scenery name="planterBox" position={[-3.6, 30.0]} />
      <Scenery name="topiarySpiral" position={[6.0, 6.0]} />
      <Scenery name="topiarySpiral" position={[-6.0, 6.0]} />
      <Scenery name="cactusCluster" position={[9.6, 20.4]} seed={1} />
      <Scenery name="cactusCluster" position={[-9.6, 20.4]} seed={2} />
      <Scenery name="cactusCluster" position={[16.8, -8.4]} seed={3} />
      <Scenery name="cactusCluster" position={[-16.8, -8.4]} seed={4} />
      <Scenery name="signpost" position={[2.4, 51.6]} />
      <Scenery name="picnicTable" position={[-9.6, -3.6]} />
      <Scenery name="picnicTable" position={[9.6, -3.6]} />
      <Scenery name="birdbath" position={[-4.8, 8.4]} />
      <Scenery name="gazebo" position={[-6.0, 30.0]} />
      <Scenery name="hotAirBalloon" position={[-14.4, 27.6]} seed={2} />

      {/* ================= LIGHTING / FLAIR ================= */}
      <Neon text="PULSE" position={[24, 2.4, 9.6]} rotation={0} scale={0.6} />
      <Neon text="BRASSWORK" position={[-24, 2.4, 9.6]} rotation={0} scale={0.5} />
      <Neon text="EMBERFALL" position={[0, 2.4, -18.0]} rotation={0} scale={0.5} />
      <Torch position={[1.8, 46.8]} />
      <Torch position={[-1.8, 46.8]} />
      <Torch position={[1.8, -22.8]} />
      <Torch position={[-1.8, -22.8]} />
      <Lights from={[-1.2, 57.6]} to={[1.2, 57.6]} />
      <Lights from={[-1.2, 39.6]} to={[1.2, 39.6]} />

      {/* ================= TREES ================= */}
      {TREES.map((t, i) => (
        <Placed
          key={i}
          build={(three: any) => tree(three, { shape: t.shape })}
          position={t.pos}
        />
      ))}
    </Park>
  );
}

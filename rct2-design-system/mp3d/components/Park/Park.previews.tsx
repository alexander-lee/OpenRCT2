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
  Neon,
  Scenery,
  Lights,
  Placed,
} from './index';
import { Torch } from '../Torch';
import { FerrisWheel } from '../FerrisWheel';
import { BurgerShop } from '../BurgerShop';
import { tree } from '../Kit';
import { TILE } from '../ParkBuilder';
// the canonical example's tooling (round-7): set-piece plans + the street fuser
import { buildParkNet } from '../SetPieceKit';
import { FountainPlaza, fountainPlazaPlan } from '../FountainPlaza';
import { Bazaar, bazaarPlan } from '../Bazaar';
import { Boulevard, boulevardPlan } from '../Boulevard';
import { Carousel } from '../Carousel';
import { Teacups } from '../Teacups';
import { TwistRide } from '../TwistRide';
import { compileTrackPieces } from '../SplineRideKit';
import type { TrackPiece } from '../SplineRideKit';

// ---------------------------------------------------------------------------
// The JSX-COMPOSED demo park — the same compose-then-validate discipline as
// the imperative worked example (ParkBuilder.previews.tsx), written as React
// components on ONE shared canvas. <Park> owns the Stage, the GameManager,
// the UI windows and the validatePark run; every child below is a thin
// declarative wrapper over the recipe-book builders. Deterministic (seed 7).
// ---------------------------------------------------------------------------

const G = TILE;
const SEED = 7;

// the street skeleton ON the RCT2 lattice: gate street → 3×3 plaza ring →
// a south avenue + fairground spur + a west spur to the coaster queue tail
const NODES: [number, number][] = [
  [0, 5 * G], // 0 gate
  [0, 4 * G], // 1 street
  [0, 3 * G], // 2 plaza N
  [G, 3 * G], // 3 ring NE
  [G, G], // 4 ring SE
  [0, G], // 5 plaza S
  [-G, G], // 6 ring SW
  [-G, 3 * G], // 7 ring NW
  [0, -2 * G], // 8 south avenue end
  [G, -2 * G], // 9 fairground spur
  [-2 * G, G], // 10 west spur
  [-2 * G, 2 * G], // 11 west spur north
  [-3 * G, 2 * G], // 12 coaster queue tail
];
const EDGES: [number, number][] = [
  [0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 7], [7, 2],
  [5, 8], [8, 9],
  [6, 10], [10, 11], [11, 12],
];
const PLAZA: [number, number, number, number] = [0, 2 * G, 3 * G, 3 * G];

// the wooden coaster, authored as [x, yAboveRef, z] — station straight first
// (points 0..2), chain lift up the back edge, ridge run, a wide HIGH (slow)
// home turn, dead-straight dive home. Passes checkCoasterDesign + the 1.5 g
// crash-margin guard (same tuned circuit the recipe book documents).
const COASTER_PTS: [number, number, number][] = [
  [-5.06, 0.6, 2.0],
  [-5.06, 0.6, 0.1],
  [-5.06, 0.6, -2.0],
  // lift + FIRST DROP (retuned): the crest was 1.65 with a 0.79-unit fall —
  // just under checkCoasterDesign's ~0.9 `shortDrop` excitement gate
  // (RideRatings.cpp:1318), which the autofix check treats as FATAL. Crest is
  // now 1.82 into a 0.86 valley (~0.96-unit drop, gate cleared). Three knock-on
  // limits had to be satisfied together: the descent is EASED across p6..p8 so
  // pitch stays under the ~0.55 rad/unit transition rule, `bank` is 0.26 (auto
  // banking amplifies with curvature and lands at wooden's 25° cap — 0.36
  // applied as 33° and tripped bankLimit), and the RETURN LEG below is lifted
  // ~0.05 so the faster train reaches the home turn slower: worst lateral now
  // sits under the 1.27 g derail margin (it was 1.30 g). Do not "widen" that
  // turn by nudging x — that kinked the spline and spiked it to 3.29 g.
  [-5.32, 1.05, -2.89],
  [-6.63, 1.62, -3.44],
  [-7.38, 1.82, -2.89],
  [-7.48, 1.72, -2.01],
  [-7.33, 1.28, -0.78],
  [-7.44, 0.86, 0.58],
  [-7.38, 0.88, 1.81],
  [-7.54, 1.2, 2.7],
  [-7.54, 1.3, 3.62],
  [-7.27, 1.38, 4.2],
  [-6.74, 1.44, 4.57],
  [-6.06, 1.46, 4.65],
  [-5.44, 1.5, 4.38],
  [-5.14, 1.47, 3.98],
  [-5.04, 1.42, 3.55],
  [-5.04, 1.14, 3.02],
  [-5.05, 0.82, 2.52],
];
const DECK: [number, number] = [-4.31, 0];

// deterministic tree spots (clear of paths, pads, water, the coaster strip
// AND the fairground: ferris wheel plane/lane/exit + burger shop)
const TREES: [number, number, number][] = [
  [-2.8, 4.6, 0.55],
  [-0.6, -5.4, 0.2],
  [-1.6, -3.8, 0.7],
  [3.4, -5.2, 0.35],
  [-3.0, -1.7, 0.15],
  [2.5, 5.3, 0.6],
];

// every cell the layout paves or places on — the terrain probe keeps them
// dry and sane (parkComposition guards, recipe §1)
const KEEP_DRY: [number, number][] = [
  ...NODES,
  ...EDGES.map(([a, b]) => [(NODES[a][0] + NODES[b][0]) / 2, (NODES[a][1] + NODES[b][1]) / 2] as [number, number]),
  DECK,
  [3 * G, -5 * G], // arcade marquee pad
  [G, 4 * G], // neon/kiosk cell
  [-G, 4 * G], // restroom cell
  [-3.6, 1.2], // coaster exit hut cell
  [-3.6, 5.53], [-3.6, 3.97], // coaster queue lane (anchor + midpoint)
  [-0.95, -1.2], [0.95, -1.2], // string-light poles
  [2.4, 3.6], // signpost
  [-2.4, -0.6], // wishing well
  [6.69, -2.4], [6.69, -1.2], [6.69, -3.6], // ferris wheel pad (plane spans z -0.9..-3.9)
  [4.89, -2.4], [3.0, -2.4], // ferris queue lane (head + midpoint; tail = node 9)
  [5.34, -3.9], // ferris exit hut cell
  [3.0, -0.5], // burger shop cell
  [4.6, -0.9], // fairground torch
];

// ===========================================================================
// THE CANONICAL WORKED EXAMPLE (round-7) — <DistrictPark>
// ===========================================================================
// Rounds 6-7 every generated park hand-rolled a uniform node/edge lattice on a
// tiny plot, and the honest reason is below: the ONLY worked example the recipe
// book pointed at was <DemoPark>, a size-16 park with a hand-written NODES /
// EDGES array and a points-mode coaster. We documented one discipline and
// demonstrated the opposite. THIS is the example to copy:
//
//   * size 48 — the default plot, laid out as DISTRICTS, not one cluster;
//   * the streets come from `buildParkNet` fusing SET-PIECE sub-nets
//     (<FountainPlaza> hub + <Bazaar> shop cluster + <Boulevard> avenue) with
//     a short hand-authored spine — no uniform grid anywhere;
//   * the flagship is a PIECES-MODE §4.0-A archetype (E ≈ 6.1), not points;
//   * every ride pad sits on a CELL INTERIOR ≥ 1.8 u off every lattice node
//     and edge centreline (§0.14) — only the queue lanes touch nodes;
//   * the east detour crosses the ring's final drop leg at z −13.2, where the
//     track is ~3.5 u up, instead of at z −9.6 where it is 2.18 u (under the
//     2.2 u fly-over gate) — PROBED, not guessed;
//   * the composed water is read from a GUARDED probe, not the seed table:
//     with this keepDry list seed 7's water re-picks to centre (14.7, 14.7)
//     with basins (9.6, 9.6) wl-r 4.5 + (10.1, 13.3) wl-r 6.1, so the whole
//     district lives WEST of x 0 and the flats sit south of the lake.
//
// Verified: `validatePark ok: true`, 0 failures, 0 fatal warnings at size 48.

const HUB = fountainPlazaPlan({ id: 'hub', position: [-6, 7.2], ports: ['N', 'S', 'E'], seed: 7 });
// rotated a quarter turn, so the aisle runs N/S and its 'W' port faces NORTH
const MARKET = bazaarPlan({ id: 'market', position: [-6, -9.6], rotation: Math.PI / 2, stalls: ['burger', 'soda', 'cottonCandy'], seed: 5 });
const AVE = boulevardPlan({ id: 'ave', from: HUB.port('S'), to: MARKET.port('W'), seed: 4 });

// §4.0-A THRILL steel rectangle — VERBATIM from rules/park-generation.md §4.0
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
const A_START: [number, number, number] = [16.8, 0.55, -3.6];
const A_PTS = compileTrackPieces(A_PIECES as unknown as TrackPiece[], {
  type: 'steel',
  start: A_START,
  heading: 0,
  bounds: 48,
}).points as [number, number, number][];

// the hand-authored part of the skeleton: a gate spur + ONE spine east of the
// hub the two flats tail onto, then the probed detour to the coaster apron
const D_NODES: [number, number][] = [
  [-12, 22.8], //  0 gate (west of the ring's north grade band, x −9.6..7.2)
  [-12, 16.8], //  1 fairground spur node (Waltzer queue tail)
  [-12, 12.0], //  2
  [0, 7.2], //  3 hub:E stub + Teacups queue tail
  [0, 1.2], //  4 Carousel queue tail
  [0, -9.6], //  5
  [6, -9.6], //  6
  [6, -13.2], //  7 drop to the row that clears the final drop leg
  [12, -13.2], //  8
  [18, -13.2], //  9
  [22.8, -13.2], // 10
  [22.8, -9.6], // 11
  [22.8, -3.6], // 12 coaster queue tail (start.x + 6.0, same z)
];
const D_NET = buildParkNet({
  nodes: D_NODES,
  edges: [
    [0, 1], [1, 2], [2, 'hub:N'], ['hub:E', 3], [3, 4], [4, 5], [5, 6], [6, 7], [7, 8], [8, 9], [9, 10], [10, 11], [11, 12],
  ],
  pieces: [HUB, MARKET, AVE],
  keepDry: [
    // the flats sit SOUTH of the composed lake ((9.6, 9.6) wl-r 4.5) and are
    // keepDry'd because the Teacups pad is 3.4 u from that basin centre
    [-18, 16.8], [-15.6, 16.8], // Waltzer pad + lane (the gate-side fairground)
    [7.2, 7.2], [4.8, 7.2], // Teacups pad + lane
    [7.2, 1.2], [4.8, 1.2], // Carousel pad + lane
    [19.2, -3.6], [20.4, -3.6], [18, -3.6], [19.2, -1.2], // coaster queue + exit apron
    [-13.2, 1.2], // restroom
    [-13.2, 13.2], [3.6, 13.2], [3.6, -12.0], [-16.8, 7.2], [-2.4, 14.4], [-9.6, 14.4], // scenery
  ],
});

const D_TREES: [number, number, string][] = [
  [-16.8, 12.0, 'pine'], [-16.8, 4.8, 'round'], [-16.8, -2.4, 'pine'], [-13.2, -4.8, 'round'],
  [-16.8, -13.2, 'pine'], [-13.2, -16.8, 'round'], [-9.6, 21.6, 'pine'], [-2.4, 21.6, 'round'],
  [3.6, 21.6, 'pine'], [-16.8, 21.6, 'round'], [3.6, -15.6, 'pine'], [9.6, -9.6, 'round'],
  [-2.4, -16.8, 'pine'], [9.6, 1.2, 'round'],
];

/**
 * THE canonical composition: districts on the default plot, streets fused by
 * `buildParkNet` from set-piece plans, a pieces-mode §4.0 flagship. Copy this
 * shape (not its coordinates — the ANTI-TEMPLATE CLAUSE still applies).
 */
export function DistrictPark({ fullscreen = true }: { fullscreen?: boolean }) {
  return (
    <Park
      seed={7}
      climate="temperate"
      size={48}
      guests={22}
      fullscreen={fullscreen}
      height={fullscreen ? undefined : 560}
      onReady={(report) => {
        // eslint-disable-next-line no-console
        console.log('[DistrictPark]', report?.ok ? 'validatePark ok' : 'FAILURES', report?.failures?.length ?? 0, 'warnings', report?.warnings?.length ?? 0);
      }}
    >
      <Terrain keepDry={D_NET.keepDry} coasterPts={A_PTS} />
      <Paths nodes={D_NET.nodes} edges={D_NET.edges} plazas={D_NET.plazas} bins={D_NET.bins} walkers={6} />
      <GameManager />
      <Gate position={[-12, 22.8]} />

      {/* the three set-pieces — ports, paving, stalls and footprints all from
          the SAME plans buildParkNet fused above */}
      <FountainPlaza plan={HUB} />
      <Boulevard plan={AVE} />
      <Bazaar plan={MARKET} />

      {/* FLAGSHIP — §4.0-A pieces mode, no `bank` prop, closes itself.
          exit/exitDir are OMITTED (RCT2 entrance/exit fix): the chassis takes the
          station-face cell ONE TILE beside the entrance hut, on whichever side its
          exit path reaches the street soonest, facing the same way out. The old
          pinned [19.2, -1.2] / [1, 0] sat 2.4 u along the face with NO street on its
          outward ray: a stranded exit, and since gate check a4 an accessibility FAIL. */}
      <Coaster
        name="Meadow Firestorm"
        pieces={A_PIECES as unknown as TrackPiece[]}
        start={A_START}
        heading={0}
        type="steel"
        cars={5}
        capacity={4}
        rideDuration={10}
        intensity={7}
        price={6}
        deck={[-2.4, 0]}
        queueTailNode={12}
        queueDir={[1, 0]}
      />

      {/* a GENTLE ride beside the gate street: the 60 sim-s smoke run needs a
          guest to reach a queue AND finish a cycle, and on a 48 plot a park
          whose nearest ride is 40 u from the gate cannot do that */}
      <TwistRide
        position={[-18, 16.8]}
        rotation={Math.PI / 2}
        register={{ name: 'Meadow Waltzer', capacity: 4, rideDuration: 8, intensity: 3, price: 3 }}
      />

      {/* flats on CELL INTERIORS, 7.2 u off the spine — lanes run back to it
          (the first one is ~18 u from the gate: the 60 sim-s smoke run needs a
          guest to reach a queue AND finish a cycle, so do not exile every ride
          to the far corner of a 48 plot) */}
      {/* THE taught queue route (§0.4): the tail reach of a compact rig is NOT
          computable from props (`front` is auto-raised to footMaxZ·scale +
          1.27), so pin the HEAD instead —
          anchor = tail − dir·(laneLenOf(capacity) + 0.35)
                 = (0, 7.2) − (−1, 0)·(3.34 + 0.35) = (3.69, 7.2).
          No lane trim, no queueDir flip, no exit relocation. */}
      <Teacups
        position={[7.2, 7.2]}
        rotation={-Math.PI / 2}
        register={{ name: 'Willow Teacups', capacity: 4, rideDuration: 8, intensity: 3, price: 3 }}
        queue={{ anchor: [3.69, 7.2], dir: [-1, 0] }}
      />
      <Carousel
        position={[7.2, 1.2]}
        rotation={-Math.PI / 2}
        register={{ name: 'Meadow Carousel', capacity: 4, rideDuration: 8, intensity: 2, price: 3 }}
        queue={{ anchor: [3.69, 1.2], dir: [-1, 0] }}
      />

      <Restroom position={[-13.2, 1.2]} rotation={Math.PI / 2} />
      <Scenery name="marbleStatue" position={[-13.2, 13.2]} />
      <Scenery name="planterBox" position={[3.6, 13.2]} />
      <Scenery name="topiarySpiral" position={[3.6, -12.0]} />
      <Scenery name="picnicTable" position={[-16.8, 7.2]} />
      <Scenery name="signpost" position={[-2.4, 14.4]} />
      <Scenery name="parkClock" position={[-9.6, 14.4]} />

      {D_TREES.map(([x, z, shape], i) => (
        <Placed key={`dt${i}`} build={(t) => tree(t, { shape: shape as 'round' | 'pine' })} position={[x, z]} />
      ))}
    </Park>
  );
}

/** the COMPACT (size-16) variant — kept as the small-plot reference. NOT the
 *  layout to copy: its lattice is hand-written and its coaster is points mode
 *  (see <DistrictPark> above for the mandated shape). */
export function DemoPark({ fullscreen = true }: { fullscreen?: boolean }) {
  return (
    <Park
      seed={SEED}
      climate="temperate"
      size={16}
      guests={10}
      fullscreen={fullscreen}
      onReady={(report) => {
        // surfaced for harness scripts; Park already console-logs the report
        (window as unknown as { __parkReport?: unknown }).__parkReport = report ?? { skipped: true };
      }}
    >
      <Terrain keepDry={KEEP_DRY} coasterPts={COASTER_PTS} />
      <Paths nodes={NODES} edges={EDGES} plazas={[PLAZA]} walkers={4} bins={[[1.5, 2 * G]]} />
      <GameManager />
      <Gate />
      <Coaster
        name="Timberline Run"
        points={COASTER_PTS}
        type="wooden"
        // the deeper first drop feeds the return curve faster, so bank it
        // harder to soak the lateral G (0.26 rad — auto-banking amplifies with
        // curvature, so this lands right at wooden's 25° applied cap; 0.36 applied
        // as 33° and tripped bankLimit)
        bank={0.26}
        capacity={3}
        rideDuration={9}
        loadTime={2}
        intensity={6}
        price={4}
        queueTailNode={11}
        queueDir={[0, -1]}
        deck={DECK}
      />
      {/* composable catalog rides/stalls: one line each — <ConfigurableRide>/
          <ConfigurableStall> derive the queue/huts/attach from position+rotation.
          The wheel faces -x (yaw -PI/2) so its queue lane runs west and the
          tail lands EXACTLY on street node 9 ([1.2,-2.4]): 1.8 (front) +
          laneLenOf(4)+0.35 (join) = 5.49 from the wheel at x 6.69. */}
      <FerrisWheel
        position={[6.69, -2.4]}
        rotation={-Math.PI / 2}
        register={{ name: 'Grand Wheel', capacity: 4, rideDuration: 8, price: 3, intensity: 3 }}
      />
      <BurgerShop position={[3.0, -0.5]} rotation={-Math.PI / 2} register price={3} value={5} />
      <Fountain />
      <Restroom position={[-G, 4 * G]} rotation={Math.PI / 2} />
      <Torch position={[1.65, 4.05]} />
      <Torch position={[-1.65, 4.05]} />
      <Torch position={[4.6, -0.9]} />
      <Neon text="ARCADE" position={[3 * G, 1.7, -5 * G]} rotation={Math.PI} scale={0.5} color={0xffb43c} secondary={0x35c8c8} />
      <Scenery name="planterBox" position={[1.65, 0.75]} scale={0.85} seed={SEED} />
      <Scenery name="planterBox" position={[-1.65, 0.75]} scale={0.85} seed={SEED + 1} />
      <Scenery name="signpost" position={[2.4, 3.6]} rotation={-Math.PI / 2} />
      <Scenery name="wishingWell" position={[-2.4, -0.6]} scale={0.8} />
      <Lights from={[-0.95, -1.2]} to={[0.95, -1.2]} />
      {TREES.map(([x, z, s], i) => (
        <Placed
          key={i}
          build={(t) => tree(t, { shape: s < 0.4 ? 'pine' : 'round', scale: 0.5 + s * 0.35 })}
          position={[x, z]}
          rotation={s * Math.PI * 2}
        />
      ))}
    </Park>
  );
}

const previews = {
  componentName: 'Park',
  importPath: 'components/Park',
  previews: [
    {
      name: 'District park — THE canonical composition (size 48)',
      description:
        'THE worked example to copy (round-7). A size-48 park laid out as DISTRICTS whose streets are FUSED BY buildParkNet from set-piece plans — a <FountainPlaza> hub, a <Bazaar> shop cluster and a <Boulevard> avenue wired port-to-port — plus a short hand-authored spine and the probed east detour to the coaster apron. NO uniform grid: every ride pad sits on a cell INTERIOR ≥ 1.8 u off every lattice node and edge centreline (§0.14), only the queue lanes touch nodes. The flagship is a PIECES-MODE §4.0-A steel rectangle (E ≈ 6.1, 9 drops, maxLat 0.36 g) whose ring encloses the whole district and flies over it; the detour crosses its final drop leg at z −13.2 where the track is ~3.5 u up, not at z −9.6 where it is 2.18 u (under the 2.2 u fly-over gate). The lake position comes from a GUARDED composition probe, not the seed table (seed 7 re-picks to centre 14.7, 14.7 under this keepDry list) — the round-7 defect this example exists to prevent. validatePark: ok, 0 failures, 0 fatal warnings.',
      render: () => <DistrictPark />,
    },
    {
      name: 'JSX-composed demo park (COMPACT size-16 variant)',
      description:
        'A whole park composed as React components on ONE shared canvas: <Park> renders the single full-screen Stage (autoRotate off, terrain-clamped camera), the explicit <GameManager/> child declares the sim, clickability (ride → RideViewer with onboard cam, guest → GuestInfo) and ParkInfo come for free, and validatePark runs once the children settle (report in the console). Children: <Terrain> (probed temperate landform + lake), <Paths> (lattice street skeleton + fountain plaza + berms + bins), <GameManager/>, <Gate> (sole guest spawn), a wooden <Coaster> with its full queue/hut assembly, a composable <FerrisWheel register> (ConfigurableRide chassis: derived queue/huts, real riders in the gondolas via seatWorld, FSM spin-down on breakdowns, click → RideViewer) and <BurgerShop register> (ConfigurableStall: selling food stall), <Fountain>, <Restroom>, three composable <Torch>es, a night-gated <Neon> arcade marquee, <Scenery> pieces, <Lights> string-light span and <Placed> trees. Deterministic, seed 7.',
      render: () => <DemoPark />,
    },
  ],
};

export default previews;

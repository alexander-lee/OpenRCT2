/*
 * monorail-ref — THE PARK-SPANNING MULTI-STATION MONORAIL, verified end to end.
 *
 * This is the executable copy of `rules/park-generation-rides.md` §4.2: the
 * GRAND CIRCLE, a four-platform transport ride that rings a size-128 plot and
 * carries guests between the four districts it touches. Everything below is the
 * published block, verbatim — the piece list, the start pose, the four station
 * records with their pinned queue arithmetic.
 *
 * WHY IT EXISTS. Two rounds running, the monorail shipped as a ride NOBODY
 * COULD BOARD: its documented starter loop compiled FATAL, and a fatal compile
 * renders translucent red and SKIPS the GameManager registration entirely, so
 * the park's TRANSPORT category read empty with no error anywhere but the
 * console. So the requirement now comes with a measured block and a probe
 * (`harness/park-eval/probe-monorail-grand.mjs`) that re-compiles it.
 *
 * THE FOUR PLATFORMS, and why they sit where they do. The ring is centred on
 * (0, −8.4) rather than the origin so its SOUTH leg comes within 24.0 u
 * (Manhattan, along the streets) of the gate — §3's district-walk budget. The
 * compiler reports one pose per `station` piece and they land one per compass
 * point: W (−42.6, −8.4) · N (0, 34.2) · E (42.6, −8.4) · S (0, −51.0).
 *
 * SEED 91 DESERT, AND THE REASON IS A MEASUREMENT, NOT THE §1 PROBE COUNT.
 * `node harness/park-eval/probe-guard-stability.mjs samples/monorail-ref.tsx`
 * reports, at this park's own size with this park's own guards:
 *   seed 91 desert size 128 · unguarded probes 1 -> GUARDED probes 1 ·
 *   viol 0 · clamps 0+0 · moved 0/12 · plains ts 1186 lake (-52.0, -52.0)
 * `moved 0/12` — none of twelve realistic one-cell `keepDry` edits changes the
 * landform identity — is the number that matters. The §1 `probes` column is an
 * UNGUARDED size-128 figure and predicts guard stability in NEITHER direction
 * (a `probes 1` row can go to GUARDED 64 with its water moved, as `arch-ref`
 * does at size 48; a `probes 17` row can be perfectly stable, as
 * `seedcheck-s1-192` is), so do not copy a seed off that column and assume
 * anything — measure your own seed x climate x SIZE.
 * Seed 91's two bodies — dominant (-50.6, -50.2) 19 x 21, secondary
 * (39.7, 16.3) 9 x 8 — sit UNDER the monorail's west and east legs and clear of
 * every pad, hut, lane and planted cell here; a beam flying over open water is
 * the RCT2 look, and its piers are the only thing that touches it.
 *
 * THE BEAM FLIES. `beamY: 2.6` puts the rail centreline 2.6 u up and the beam
 * SOFFIT 2.45 u up — 2.36 u over a footpath slab, clear of validatePark's 2.2-u
 * overfly gate and of a stall canopy's 2.1-u roof. The gate street crosses
 * UNDER the south leg at (−6, −51.0) on purpose: that crossing is the thing to
 * look at in the render.
 */
import React from 'react';
import { Park, GameManager, Terrain, Paths, Gate, Coaster, Fountain, Restroom, Scenery, Placed } from './components/Park';
import { compileTrackPieces } from './components/SplineRideKit';
import type { TrackPiece } from './components/SplineRideKit';
import { Monorail } from './components/Monorail';
import { Carousel } from './components/Carousel';
import { FerrisWheel } from './components/FerrisWheel';
import { BurgerShop } from './components/BurgerShop';
import { SodaStand } from './components/SodaStand';
import { tree } from './components/Kit';

// ---------------------------------------------------------------------------
// §4.2 THE GRAND CIRCLE — 4 platforms, FLAT, closes itself, nothing synthesized
//
// One number drives it: L, the run of each leg. At size 128,
//   span = lattice(⅔ · 128) = 85.2,  L = span − 2R = 73.2,  R = 6
//   p    = (L − 2.6) / 2 = 35.3      (the straight either side of each deck)
//   tail = p − 0.3      = 35.0       split (33.5, 1.5) — see the note below
// ---------------------------------------------------------------------------
const MONO_PIECES: TrackPiece[] = [
  'station',                                     // platform 0 — W
  { type: 'straight', length: 35.3 },
  { type: 'turnL', angle: 90, radius: 6 },
  { type: 'straight', length: 35.3 },
  'station',                                     // platform 1 — N
  { type: 'straight', length: 35.3 },
  { type: 'turnL', angle: 90, radius: 6 },
  { type: 'straight', length: 35.3 },
  'station',                                     // platform 2 — E
  { type: 'straight', length: 35.3 },
  { type: 'turnL', angle: 90, radius: 6 },
  { type: 'straight', length: 35.3 },
  'station',                                     // platform 3 — S
  { type: 'straight', length: 35.3 },
  { type: 'turnL', angle: 90, radius: 6 },
  // THE TAIL IS TWO PIECES AND THAT IS NOT COSMETIC. compileTrackPieces pops
  // every trailing control point within 0.45 u of the start, then measures
  // `closure.gap` from what is left and calls the ring closed only under 3.3 u.
  // A single 35.0-u tail emits a MIDPOINT (any run > 2.4 u does), the 0.3-u end
  // point is popped, and the gap reads 17.8 u — NOT CLOSED, FATAL. Splitting
  // the last 1.5 u off leaves the final kept point 1.8 u out: closed, nothing
  // synthesized. Do not merge these two straights.
  { type: 'straight', length: 33.5 },
  { type: 'straight', length: 1.5 },
];

// WHERE THE COMPONENT IS MOUNTED, and why it is not the ring's centre.
// <Monorail> always compiles its circuit at the LOCAL origin — `start: [0,
// beamY, 0]` — so the ring's own frame runs local x 0..85.2, z −41.3..43.9 and
// `position` IS the start pose, i.e. the WEST platform's deck START. Put it at
// [−42.6, 0, −9.7] and the four decks land at
//   W (−42.6, −8.4) · N (0, 34.2) · E (42.6, −8.4) · S (0, −51.0),
// which is the ring centred on (0, −8.4). Mounting it at the ring CENTRE
// instead (the intuitive-but-wrong [0, 0, −8.4]) shifts every deck by
// (+42.6, +1.3) and leaves the registered platforms 42 u off the beam.
const MONO_AT: [number, number, number] = [-42.6, 0, -9.7];
const BEAM_Y = 3.6;
// the same pose, for the terrain pre-cap compile below
const MONO_START: [number, number, number] = [-42.6, BEAM_Y, -9.7];
const MONO_COMPILED = compileTrackPieces(MONO_PIECES, { profile: 'monorail', start: MONO_START, heading: 0, bounds: 128 });
const MONO_PTS = MONO_COMPILED.points as [number, number, number][];

// ---- the four platforms' access, from ONE piece of arithmetic ---------------
// capacity 6 ⇒ laneLenOf(6) = max(2.2, 1.1 + 0.56·6) = 4.46, join = 4.81.
// Every platform's queue TAIL lands on a street node; the HEAD (`queueAnchor`)
// is `tail − dir·4.81`; the entrance hut is a further 0.62 back, which leaves
// 0.22 u between its near edge and the deck pad. The EXIT takes the RCT2 cell
// one tile (1.2) along the same face, facing the same way out, and its footpath
// JOINS the queue's own tail node (planExitLane's `join` case).
const JOIN = 4.81;
const DECK_Y = BEAM_Y; // platforms board ON the beam; the huts stand at grade
const MONO_STATIONS = [
  // platform 1 — N: deck (0, 34.2) heading +x, interior is −z
  {
    label: 'North Gate',
    boardPoint: [0, DECK_Y, 34.2] as [number, number, number],
    queueAnchor: [0, 0.05, 27.6 + JOIN] as [number, number, number],
    queueDir: [0, -1] as [number, number],
    exitPoint: [-1.2, 0.05, 27.6 + JOIN + 0.62] as [number, number, number],
    exitDir: [0, -1] as [number, number],
  },
  // platform 2 — E: deck (42.6, −8.4) heading −z, interior is −x
  {
    label: 'East Works',
    boardPoint: [42.6, DECK_Y, -8.4] as [number, number, number],
    queueAnchor: [36.0 + JOIN, 0.05, -8.4] as [number, number, number],
    queueDir: [-1, 0] as [number, number],
    exitPoint: [36.0 + JOIN + 0.62, 0.05, -7.2] as [number, number, number],
    exitDir: [-1, 0] as [number, number],
  },
  // platform 3 — S: deck (0, −51.0) heading −x, interior is +z. THE GATE
  // PLATFORM: 24.0 u along the streets from the turnstile.
  {
    label: 'South Gate',
    boardPoint: [0, DECK_Y, -51.0] as [number, number, number],
    queueAnchor: [0, 0.05, -44.4 - JOIN] as [number, number, number],
    queueDir: [0, 1] as [number, number],
    exitPoint: [1.2, 0.05, -44.4 - JOIN - 0.62] as [number, number, number],
    exitDir: [0, 1] as [number, number],
  },
];

// ---- the §4.0-B FAMILY coaster, translated into the ring's INTERIOR ---------
// VERBATIM piece list; only `start` moves (lattice multiples of 1.2). §4.0-B
// grows WEST from its start and straddles it in z (x −28.92..0, z −13.27..17.15),
// so the start is its EAST edge. At this start the ring occupies
// x −34.92..−6.0, z −43.27..−12.85 — the SOUTH-WEST quarter, entirely inside
// the monorail's ring, with its published corridor bands
// (x −36.0/−34.8: z −36.0..−19.2 · x −28.8..−12.0: z −44.4..−42.0 ·
// x −24.0..−12.0: z −14.4..−12.0 · x −7.2/−4.8: z −37.2..−22.8) clear of every
// street below. The queue tail is `start.x + 6.0`, same z — node 5.
const B_PIECES: TrackPiece[] = [
  'station',
  { type: 'lift', height: 3.6 }, { type: 'straight', length: 2.56 }, { type: 'turnR', angle: 90, radius: 2.5 },
  { type: 'drop', height: 3.6 },
  { type: 'lift', height: 3.2 }, { type: 'straight', length: 5.46 }, { type: 'turnR', angle: 90, radius: 2.5 },
  { type: 'drop', height: 3.2 }, { type: 'hill', height: 0.9 },
  { type: 'lift', height: 3.2 }, { type: 'straight', length: 1.5 }, { type: 'turnR', angle: 90, radius: 2.5 },
  { type: 'drop', height: 3.2 }, { type: 'hill', height: 0.9 },
  { type: 'lift', height: 3.2 }, { type: 'turnR', angle: 90, radius: 2.5 },
  { type: 'drop', height: 3.2 }, { type: 'straight', length: 1.5 },
];
const B_START: [number, number, number] = [-6.0, 0.55, -30.0];
const B_COMPILED = compileTrackPieces(B_PIECES, { type: 'steel', start: B_START, heading: 0, bounds: 128 });
const B_PTS = B_COMPILED.points as [number, number, number][];

// ---- streets: a gate spine, a hub cross row, two arms -----------------------
// EVERY monorail platform's queue tail is a node here. Nothing runs within
// 6.0 u of a monorail deck pad; the gate spine passes UNDER the south beam leg
// at (−6, −51.0), which is exactly the over-fly the elevated beam exists for.
const NODES: [number, number][] = [
  [-6, -62.4], //  0  gate
  [-6, -56.4], //  1  Turnstile Carousel lane tail
  [-6, -44.4], //  2
  [0, -44.4], //  3  monorail SOUTH platform queue tail
  [0, -37.2], //  4
  [0, -30.0], //  5  §4.0-B coaster queue tail (B_START.x + 6.0, same z)
  [0, -25.2], //  6  an intermediate node: the land falls 0.77 u here and a
  //                 single 9.6-u span could not descend it inside the walkable
  //                 grade (§0.6) — the ramp needs somewhere to land
  [0, -20.4], //  7
  [0, -8.4], //  8  the hub row
  [-18, -8.4], //  9
  [-36.0, -8.4], // 10  monorail WEST platform queue tail
  [18, -8.4], // 11
  [36.0, -8.4], // 12  monorail EAST platform queue tail
  [0, 3.6], // 13
  [0, 15.6], // 14
  [0, 27.6], // 15  monorail NORTH platform queue tail
  [12, 15.6], // 16  North Wheel lane tail
];
const EDGES: [number, number][] = [
  [0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 7], [7, 8],
  [8, 9], [9, 10], [8, 11], [11, 12],
  [8, 13], [13, 14], [14, 15], [14, 16],
];
const PLAZA: [number, number, number, number] = [0, -8.4, 3.6, 3.6];
const BINS: [number, number][] = [[0, -20.4], [0, 3.6]];

// 32 trees (§0's count for a 128). Every cell is chosen against FOUR exclusions
// that the guarded composition actually enforces, not against the §1 seed row:
//   · the streets (≥ 4.8 u off every node and edge centreline)
//   · seed 1's DOMINANT corner lake  (x 22..61, z −59..−20)
//   · the NORTH-WEST shoulder where its SECONDARY body lands once the keepDry
//     guard has run (x < −10 with z > 18) — planting there re-picks the body and
//     costs a `waterRePicked` FAIL for cells nothing was even placed against
//   · §4.0-B's published corridor bands, and 4.8 u clear of every monorail leg
const TREES: [number, number, 'round' | 'pine' | 'palm' | 'willow'][] = [
  [-24, -20.4, 'pine'], [-30, -14.4, 'pine'], [-27.6, -24.0, 'pine'], [-33.6, -18.0, 'pine'],
  [-21.6, -28.8, 'pine'], [-27.6, -33.6, 'round'], [-15.6, -24.0, 'round'], [-12, -20.4, 'round'],
  [12, -20.4, 'round'], [18, -14.4, 'pine'], [12, -32.4, 'pine'], [15.6, -36.0, 'pine'],
  [6, -32.4, 'round'], [-9.6, -36.0, 'pine'], [9.6, -14.4, 'round'], [18, -32.4, 'pine'],
  [-24, 3.6, 'pine'], [-30, -2.4, 'pine'], [24, 3.6, 'round'], [30, 9.6, 'round'],
  [-18, 9.6, 'pine'], [-24, 13.2, 'pine'], [18, -2.4, 'round'], [27.6, -2.4, 'pine'],
  [18, 21.6, 'round'], [12, 30.0, 'round'], [21.6, 25.2, 'pine'], [27.6, 19.2, 'pine'],
  [33.6, 25.2, 'round'], [6, 21.6, 'round'], [15.6, 27.6, 'pine'], [9.6, 25.2, 'pine'],
];

const KEEP_DRY: [number, number][] = [
  ...NODES,
  // the four monorail platform pads + their huts, lanes and exit runs
  [-42.6, -8.4], [-41.4, -8.4], [-40.8, -8.4], [-38.4, -8.4], [-41.4, -9.6], [-38.4, -9.6],
  [0, 34.2], [0, 33.0], [0, 32.4], [0, 30.0], [-1.2, 33.0], [-1.2, 30.0],
  [42.6, -8.4], [41.4, -8.4], [40.8, -8.4], [38.4, -8.4], [41.4, -7.2], [38.4, -7.2],
  [0, -51.0], [0, -49.8], [0, -49.2], [0, -46.8], [1.2, -49.8], [1.2, -46.8],
  // coaster station apron + queue
  [-6.0, -30.0], [-4.8, -30.0], [-3.6, -30.0], [-2.4, -30.0], [-4.8, -31.2],
  // flats + their lanes
  [-12.0, -56.4], [-10.8, -56.4], [-8.4, -56.4], [-10.8, -57.6],
  [12.0, 21.6], [12.0, 19.2], [12.0, 18.0], [13.2, 19.2],
  // amenities + scenery
  [3.6, -14.4], [-3.6, -14.4], [2.4, -24.0], [-2.4, -24.0],
  [-6.0, 21.6], [6.0, 9.6], [-6.0, -3.6], [6.0, -3.6], [-12.0, -14.4], [12.0, -14.4],
  // NOTE: THE TREE CELLS ARE DELIBERATELY *NOT* HERE. `keepDry` does two jobs —
  // it guarantees a cell dry AND it MOVES the heightfield to do it
  // (`clampPeaks`/`clampBasins`) — so 32 planted cells sprinkled across the plot
  // flatten the ranges the seed drew: with them listed, this park kept only 68%
  // of seed 1's relief against the 70% floor and failed `terrainFlattened`,
  // naming the range at (34.1, 17.3) cut 3.10 → 0.89 by three tree cells.
  // A tree needs DRY ground, not FLAT ground. Guard only what you PAVE or stand
  // a structure on, and choose planted cells clear of the composed water
  // instead (the four exclusions listed above the TREES table).
];
export default function MonorailRef() {
  return (
    <div style={{ width: '100%', height: '100vh', position: 'relative' }}>
      <Park
        seed={91}
        climate="desert"
        size={128}
        guests={28}
        roster={{ rides: 4, stalls: 2 }}
        onReady={(report: any) => {
          // eslint-disable-next-line no-console
          console.log(
            '[MONORAIL-REF]',
            report?.ok ? 'ok' : 'FAILURES',
            report?.failures?.length ?? 0,
            'warnings',
            report?.warnings?.length ?? 0,
          );
        }}
      >
        {/* coasterPts pre-caps peaks UNDER a circuit so ground clamps cannot kink it.
            The COASTER needs that; the MONORAIL deliberately does NOT get it — its
            beam is 2.45 u up on piers that follow the land, and handing an 85-u ring
            to the terrain guard flattens the whole plot's shoulders. Pass the
            coaster's points only. MONO_PTS is still compiled above, for the §4.2
            arithmetic check, and simply not used as a guard. */}
        <Terrain keepDry={KEEP_DRY} coasterPts={B_PTS} />
        <Paths nodes={NODES} edges={EDGES} plazas={[PLAZA]} walkers={6} bins={BINS} />
        <GameManager />
        <Gate position={[-6, -62.4]} />

        {/* ================= THE REQUIREMENT: the park-spanning monorail =====
            FOUR platforms, one per district, each with its own queue lane,
            entrance hut, exit hut and exit footpath. `pinned` because a
            park-scale circuit must never be nudged by the corridor resolver.
            NO `loopSeconds`: a loop TIME on a 200-u ring asks for ~20 u/s, and
            a monorail is a sightseeing shuttle — the default cruise (0.9 u/s,
            under twice a guest's walking pace) is the point. `trains={4}` puts
            one train at each of the four platforms; they run in parallel round
            the beam, so a guest waiting anywhere always has one arriving. */}
        <Monorail
          position={MONO_AT}
          pieces={MONO_PIECES}
          beamY={BEAM_Y}
          trains={4}
          pinned
          name="Grand Circle Monorail"
          capacity={6}
          rideDuration={12}
          intensity={1}
          price={0}
          queue={{ anchor: [-36.0 - JOIN, -8.4], dir: [1, 0] }}
          register={{
            board: [-42.6, DECK_Y, -8.4],
            stations: MONO_STATIONS,
          }}
        />

        {/* the FLAGSHIP — §4.0-B family rectangle, in the ring's SW quarter */}
        <Coaster
          name="Meadow Flyer"
          pieces={B_PIECES as any}
          start={B_START}
          heading={0}
          type="steel"
          capacity={4}
          rideDuration={10}
          intensity={7}
          price={6}
          queueTailNode={5}
          queueDir={[1, 0]}
        />

        {/* the FIRST QUEUE from the gate — 12.0 u, well inside the budget */}
        <Carousel
          position={[-12.0, -56.4]}
          rotation={Math.PI / 2}
          register={{ name: 'Turnstile Carousel', capacity: 4, rideDuration: 8, intensity: 2, price: 3 }}
        />
        <FerrisWheel
          position={[12.0, 21.6]}
          rotation={Math.PI}
          register={{ name: 'North Wheel', capacity: 4, rideDuration: 9, intensity: 3, price: 4 }}
        />

        {/* amenities on CELL INTERIORS ≥ 3.6 u off every street row */}
        <Fountain position={[3.6, -14.4]} />
        <Restroom position={[-3.6, -14.4]} rotation={Math.PI / 2} />
        <BurgerShop position={[2.4, -24.0]} rotation={-Math.PI / 2} register={{ name: 'Circle Grill', price: 3, value: 5 }} />
        <SodaStand position={[-2.4, -24.0]} rotation={Math.PI / 2} register={{ name: 'Beamline Soda', price: 2, value: 4 }} />

        <Scenery name="parkClock" position={[-6.0, 21.6]} />
        <Scenery name="signpost" position={[6.0, 9.6]} />
        <Scenery name="marbleStatue" position={[-6.0, -3.6]} />
        <Scenery name="planterBox" position={[6.0, -3.6]} />
        <Scenery name="topiarySpiral" position={[-12.0, -14.4]} />
        <Scenery name="picnicTable" position={[12.0, -14.4]} />

        {TREES.map(([x, z, shape], i) => (
          <Placed key={`t${i}`} build={(t: any) => tree(t, { shape })} position={[x, z]} />
        ))}
      </Park>
    </div>
  );
}

// SEED-TABLE VERIFICATION PARK — §1 row "1 temperate" at the wave-8 DEFAULT
// SIZE 192. Its only job is to prove the regenerated §1 table's coordinates
// against a real mounted park: the composed lake, the mountain ranges, the
// beach flank and the flat gate apron must land where the table says.
//
// TABLE ROW UNDER TEST (seed 1, temperate, size 192, unguarded):
//   landform  plains (amp 0.68, wavelength 79.6)
//   water     central lake, centroid (16.3, -11.9), extent 70.8 x 80.4,
//             11.8% of the plot, wet bbox x [-17.4, 53.4] z [-49.8, 30.6]
//   mountains alpine x4 ranges: (-44.9, 36.2) (21.3, -69.0) (28.7, 50.1)
//             (-42.4, -34.4); 12 peaks, tallest 5.4
//   sand      (5.1, 21.8) r 37.4, beachDir (-0.27, 0.96) — the NORTH shore
//   apron     gate cell z 94.8, ground 0.10, |h|max 0.10
//   fields    meadow (71.8, 30.1) r 17.8 (roomiest), (-7.7, -61.5) r 8.6
//
// SO THE WHOLE PARK LIVES NORTH OF z 43 (the lake's north shore is z ~30.6,
// the beach band 4.2 u past that) AND EAST OF x -30 (the tall west range
// (-44.9, 36.2) carries the 5.4-u peaks). Every pad was checked against the
// peak-bump rule: the two mild north-east peaks (29.2, 40.3) h 1.3 r 23 and
// (26.6, 54.0) h 0.9 r 19.1 put a >0.75 bump inside ~10.4 u / ~6.3 u of their
// centres, so no footprint goes there.
//
// SEED STABILITY — MEASURED 2026-07-25, SEED PINNED ON PURPOSE. Seed 1
// temperate at 192 is `probes 17`, and that number is NOT guard fragility
// here: the GUARDED probe (this park's 348 keepDry cells) is ALSO 17 and lands
// on the SAME landform (plains, terrainSeed 16, corner lake (65.9, −65.9)),
// with 0 violations, 0 clamp discs, and 0 of 12 realistic one-cell keepDry
// edits moving it. The 17 rejections are the composition's OWN water/relief
// rules, not the guard list. This park EXISTS to verify the §1 seed-1 row, so
// the seed cannot be swapped — keep re-measuring instead of re-seeding.
import React from 'react';
import { Park, GameManager, Terrain, Paths, Gate, Restroom, Scenery, Placed } from './components/Park';
import { buildParkNet } from './components/SetPieceKit';
import { FountainPlaza, fountainPlazaPlan } from './components/FountainPlaza';
import { Bazaar, bazaarPlan } from './components/Bazaar';
import { Boulevard, boulevardPlan } from './components/Boulevard';
import { Carousel } from './components/Carousel';
import { Teacups } from './components/Teacups';
import { DropTower } from './components/DropTower';
import { SwingRide } from './components/SwingRide';
import { FerrisWheel } from './components/FerrisWheel';
import { tree } from './components/Kit';

type XZ = [number, number];

// ---- queue arithmetic (§0.4): laneLenOf(c) = max(2.2, 0.6 + 0.56·c) --------
const laneLenOf = (c: number) => Math.max(2.2, 0.6 + c * 2 * 0.28 + 0.5);
const join = (c: number) => laneLenOf(c) + 0.35;

// ---- SET-PIECE PLANS (pure data, before anything mounts) ------------------
const HUB = fountainPlazaPlan({ id: 'hub', position: [0, 76.8], ports: ['N', 'S', 'E', 'W'], seed: 1 });
const BAZ = bazaarPlan({ id: 'market', position: [36, 76.8], stalls: ['burger', 'soda', 'cottonCandy'], seed: 3 });
// the two long avenues: hub → market, and the hub → lakeshore promenade
// NOTHING CROSSES THE AVENUE. A spur that crosses it makes buildParkNet split
// the carriageway under the avenue's own lamps/bench/planter → 4 `scenery`
// FAILs (measured). This park keeps its layout OFF the carriageway instead —
// the fairground hangs off the bazaar's EAST port, past the end of it.
// HISTORY (fixed 2026-07-24): `boulevardPlan({ avoid })` used to be unable to
// rescue that case at all, because the plan did `(input.avoid ?? []).map(snapXZ)`
// and Array.map handed the INDEX to snapXZ's optional `cell` argument — the
// first avoid cell snapped to [NaN, NaN] and blocked nothing. `avoid` now
// really does clear the verge (regression probe:
// `node harness/park-eval/probe-boulevard-avoid.mjs`), so a crossing spur CAN
// be rescued with it; this park keeps the off-carriageway layout regardless,
// because that is the pattern the seed-table verification is documenting.
const MKT_AVE = boulevardPlan({ id: 'mktave', from: HUB.port('E'), to: BAZ.port('W'), seed: 6 });
const LAKE_AVE = boulevardPlan({ id: 'lakeave', from: HUB.port('S'), to: [0, 43.2], seed: 4 });

// ---- my own streets: the gate spine, two fairground spurs, the promenade ---
const MY_NODES: XZ[] = [
  [0, 94.8], // 0 gate cell (the composed flat apron)
  [0, 88.8], // 1 Carousel queue tail
  [0, 84], // 2 spine → hub:N (0, 81.6)
  [40.8, 84], // 3 Drop Tower queue tail (east fairground, north off market:E)
  [-14.4, 62.4], // 4 Teacups queue tail (south end of the grove spur)
  [-14.4, 76.8], // 5 west grove junction (off hub:W)
  [-14.4, 69.6], // 6 Swing Ride queue tail
  [-8.4, 43.2], // 7 promenade east (Ferris Wheel queue tail)
  [-16.8, 43.2], // 8 promenade middle
  [-25.2, 43.2], // 9 promenade west end
];

// ---- rides: pad, lane and hut cells all planned on paper ------------------
const RIDES = {
  carousel: { pad: [10.8, 88.8] as XZ, tail: [0, 88.8] as XZ, dir: [-1, 0] as XZ, cap: 8 },
  drop: { pad: [56.4, 84] as XZ, tail: [40.8, 84] as XZ, dir: [-1, 0] as XZ, cap: 10 },
  teacups: { pad: [-24, 62.4] as XZ, tail: [-14.4, 62.4] as XZ, dir: [1, 0] as XZ, cap: 4 },
  swing: { pad: [-26.4, 69.6] as XZ, tail: [-14.4, 69.6] as XZ, dir: [1, 0] as XZ, cap: 8 },
  ferris: { pad: [-8.4, 55.2] as XZ, tail: [-8.4, 43.2] as XZ, dir: [0, -1] as XZ, cap: 8 },
};
/** queue HEAD = tail − dir·join (NEVER the tail — §0.4 `queueAnchorIsHead`) */
const anchorOf = (r: { tail: XZ; dir: XZ; cap: number }): XZ => [
  r.tail[0] - r.dir[0] * join(r.cap),
  r.tail[1] - r.dir[1] * join(r.cap),
];
/** the ride's local +z must point down the lane axis (`dir`) */
const yawOf = (dir: XZ) => Math.atan2(dir[0], dir[1]);

// every pad / lane / hut cell, for keepDry (§0.18)
const RIDE_CELLS: XZ[] = [];
Object.values(RIDES).forEach((r) => {
  const a = anchorOf(r);
  for (const [dx, dz] of [[0, 0], [1.2, 0], [-1.2, 0], [0, 1.2], [0, -1.2], [1.2, 1.2], [-1.2, -1.2], [1.2, -1.2], [-1.2, 1.2]])
    RIDE_CELLS.push([r.pad[0] + dx, r.pad[1] + dz]);
  const steps = Math.round(Math.hypot(r.tail[0] - a[0], r.tail[1] - a[1]) / 1.2) + 1;
  for (let i = -1; i <= steps; i += 1) RIDE_CELLS.push([a[0] + r.dir[0] * 1.2 * i, a[1] + r.dir[1] * 1.2 * i]);
});

const SCENERY: [string, XZ][] = [
  ['parkClock', [4.8, 84]],
  ['signpost', [-4.8, 88.8]],
  ['planterBox', [7.2, 60]],
  ['topiarySpiral', [-7.2, 60]],
  ['picnicTable', [4.8, 48]],
  ['birdbath', [-4.8, 48]],
  ['marbleStatue', [19.2, 90]],
  ['flagpole', [-19.2, 84]],
];
const RESTROOM: XZ = [-4.8, 84];

const TREES: [number, number, string][] = [
  [7.2, 92.4, 'pine'], [-7.2, 92.4, 'round'], [-10.8, 84, 'pine'], [7.2, 78, 'round'],
  [-8.4, 72, 'pine'], [8.4, 66, 'round'], [-8.4, 66, 'pine'], [9.6, 54, 'round'],
  [-14.4, 55.2, 'pine'], [-20.4, 49.2, 'palm'], [-12, 46.8, 'palm'], [-4.8, 39.6, 'palm'],
  [-25.2, 55.2, 'pine'], [-30, 69.6, 'pine'], [20.4, 60, 'round'], [26.4, 84, 'round'],
  [33.6, 92.4, 'pine'], [-19.2, 92.4, 'round'], [48, 79.2, 'round'], [52.8, 90, 'pine'],
  [44.4, 62.4, 'round'], [60, 76.8, 'pine'],
];

const NET = buildParkNet({
  nodes: MY_NODES,
  edges: [
    [0, 1],
    [1, 2],
    [2, 'hub:N'],
    // the bazaar dresses its OWN entrance verges (bench + flagpole at
    // (40.8, 74.4/75.6)), so the fairground spur leaves market:E NORTHWARD only
    ['market:E', 3],
    ['hub:W', 5],
    [5, 6],
    [6, 4],
    ['lakeave:B', 7],
    [7, 8],
    [8, 9],
  ],
  pieces: [HUB, BAZ, MKT_AVE, LAKE_AVE],
  keepDry: [...RIDE_CELLS, ...SCENERY.map(([, at]) => at), RESTROOM, ...TREES.map(([x, z]) => [x, z] as XZ)],
});

export default function SeedCheckS1() {
  return (
    <div style={{ width: '100%', height: '100vh', position: 'relative' }}>
      <Park
        seed={1}
        climate="temperate"
        size={192}
        guests={20}
        roster={{ rides: 5, stalls: 3 }}
        onReady={(report: any) => {
          // eslint-disable-next-line no-console
          console.log(
            '[SEEDCHECK-S1]',
            report?.ok ? 'ok' : 'FAILURES',
            report?.failures?.length ?? 0,
            'warnings',
            report?.warnings?.length ?? 0,
            JSON.stringify(report?.failures ?? []),
          );
        }}
      >
        <Terrain keepDry={NET.keepDry} />
        <Paths nodes={NET.nodes} edges={NET.edges} plazas={NET.plazas} bins={NET.bins} walkers={6} />
        <GameManager />
        <Gate position={[0, 94.8]} />

        <FountainPlaza plan={HUB} />
        <Boulevard plan={MKT_AVE} />
        <Boulevard plan={LAKE_AVE} />
        <Bazaar plan={BAZ} />

        {/* MAIN STREET — the gentle ride the 60 sim-s smoke run can reach */}
        <Carousel
          position={RIDES.carousel.pad}
          rotation={yawOf(RIDES.carousel.dir)}
          register={{ name: 'Lakeshore Carousel', capacity: 8, rideDuration: 8, intensity: 2, price: 2 }}
          queue={{ anchor: anchorOf(RIDES.carousel), dir: RIDES.carousel.dir }}
        />
        {/* FAIRGROUND (east, off the market avenue) */}
        <DropTower
          position={RIDES.drop.pad}
          rotation={yawOf(RIDES.drop.dir)}
          register={{ name: 'Thunderhead Drop', capacity: 10, rideDuration: 7, intensity: 7, price: 4 }}
          queue={{ anchor: anchorOf(RIDES.drop), dir: RIDES.drop.dir }}
        />
        <Teacups
          position={RIDES.teacups.pad}
          rotation={yawOf(RIDES.teacups.dir)}
          register={{ name: 'Willow Teacups', capacity: 4, rideDuration: 8, intensity: 3, price: 3 }}
          queue={{ anchor: anchorOf(RIDES.teacups), dir: RIDES.teacups.dir }}
        />
        {/* WEST GROVE */}
        <SwingRide
          position={RIDES.swing.pad}
          rotation={yawOf(RIDES.swing.dir)}
          register={{ name: 'Cedar Swings', capacity: 8, rideDuration: 8, intensity: 4, price: 3 }}
          queue={{ anchor: anchorOf(RIDES.swing), dir: RIDES.swing.dir }}
        />
        {/* LAKESIDE BOARDWALK — on the composed NORTH beach flank */}
        <FerrisWheel
          position={RIDES.ferris.pad}
          rotation={yawOf(RIDES.ferris.dir)}
          register={{ name: 'Northshore Wheel', capacity: 8, rideDuration: 8, intensity: 3, price: 3 }}
          queue={{ anchor: anchorOf(RIDES.ferris), dir: RIDES.ferris.dir }}
        />

        <Restroom position={RESTROOM} rotation={Math.PI / 2} />
        {SCENERY.map(([name, at], i) => (
          <Scenery key={`s${i}`} name={name as any} position={at} />
        ))}
        {TREES.map(([x, z, shape], i) => (
          <Placed key={`t${i}`} build={(t: any) => tree(t, { shape: shape as any })} position={[x, z]} />
        ))}
      </Park>
    </div>
  );
}

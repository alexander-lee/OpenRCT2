/* ===========================================================================
 * STORMHOLLOW — a large THRILL park (default size 192), coastal climate.
 * ONE fullscreen <Park>, DEFAULT EXPORT. Composed per rules/park-generation.md.
 * ===========================================================================
 *
 * §0 PRE-FLIGHT (static arithmetic)
 * ---------------------------------------------------------------------------
 * PLOT size 192 → x,z ∈ [-96,96]. Gate cell z = 1.2·round((96-0.8)/1.2)=94.8
 *   on the FRONT (+z) edge, facing OUT. Distances measured from [0,94.8].
 *
 * SEED/WATER: seed 7, "coastal". ONE water body composes on the FAR SOUTH-EAST;
 *   the whole build zone is kept to z ≥ 30, and keepDry lists every footprint so
 *   AUTO-keepDry terraforms the ground dry+flat under the park and the lake
 *   re-picks clear of it (§0.17). Nothing is placed at z < 30.
 *
 * FLAGSHIP — §4.0-A THRILL steel rectangle VERBATIM. The compiled circuit grows
 *   +x and +z FROM the start corner, spanning +50.98u in x and z[start-18 …
 *   start+31.4]. Traced cursor (start [-90,0.55,50] heading 0):
 *     ring X -90.0 .. -39.0   Z 32.0 .. 81.4   maxY 5.5  (inside ±96 ✓)
 *   Placed in the WEST so its 51×49 footprint owns an empty quadrant, clear of
 *   the centre hub / east fairground / market.
 *     start [-90,0.55,50] heading 0 "steel" cars5 cap4 dur10 int7.
 *     queueTailNode [-84,54] queueDir[-1,0]; exit [-86.4,55.2] dir[-1,0].
 *   MEASURED at load by rateCoaster (logged; do NOT transcribe rulebook nums).
 *   CORRIDOR (traced low cells, keep streets/pads ≥0.8 off OR fly ≥2.2 over):
 *     west station/return legs x≈-90 & x≈-87.4; east drop leg x≈-39; south
 *     valleys z≈32; top valley z≈81.4 (y≤1.2). Ring INTERIOR center
 *     (x[-84,-42] z[36,78]) is framed by HIGH track — flats sit EAST of the
 *     ring at x≈-33 (≥6u off the x=-39 track column ✓). No street east of x=-30
 *     touches the ring.
 *
 * SPREAD (§0.3): Districts — Gate/Hub (0,72) · Thrill Ridge (coaster west +
 *   flats x≈-33) · Fairground (30,58) · Market/Harborside (-15,58 / -12,44).
 *   Built bbox x[-90,+43]=133u (≥82 ✓) z[32,94.8]=62.8u (≥45 ✓). Four+
 *   populated regions; no empty half.
 *
 * GATE PROXIMITY (§0.3 #1 HARD): FIRST ride HARBOR LOOKOUT (gentle ObsTower)
 *   tail [4.8,88.8]; graph dist from gate [0,94.8] = 4.8 + 6.0 = 10.8u (≤15 ✓).
 *
 * QUEUES (§0.4 PIN THE HEAD): laneLenOf(c)=max(2.2,1.1+0.56c):
 *   (4)=3.34 (6)=4.46 (8)=5.58 (10)=6.70. anchor = tail - dir·(laneLenOf+0.35)
 *   via head() helper. Every tail node is UNIQUE. Pads ≥1.8u off street nodes.
 *
 * ROSTER (10 registered rides; 4+ categories; coaster + monorail(transport) +
 *   flume(water) besides the coaster):
 *   1 Storm Chaser   Coaster §4.0-A int7 INTENSE  station[-90,50] tail[-84,54]
 *   2 Harbor Lookout ObsTower  cap8 int1 GENTLE   pad[8.4,84]   tail[4.8,88.8]
 *   3 Sky Wheel      FerrisWheel cap8 int2 GENTLE pad[16.8,74.4]tail[16.8,80.4]
 *   4 Cyclone        DropTower  cap10 int8 INTENSE pad[-33.6,63.6]tail[-27.6,63.6]
 *   5 Buccaneer      PirateShip cap10 int6 MODER   pad[-33.6,52.8]tail[-27.6,52.8]
 *   6 Carousel Cove  Carousel   cap8 int2 GENTLE   pad[24,64.8]  tail[24,70.8]
 *   7 Wave Swinger   SwingRide  cap8 int4 MODER    pad[36,52.8]  tail[36,46.8]
 *   8 Vortex         Enterprise cap10 int7 INTENSE pad[24,52.8]  tail[24,46.8]
 *   9 Harbor Line    Monorail(loop) cap6 int1 TRANSPORT station[-9.6,42]
 *  10 Timber Falls   LogFlume(pieces) cap4 int5 WATER (own trough,dry)[-27.6,38.4]
 *
 * STALLS (§0.10 ≥5): Bazaar "Tempest Market" 5 kinds + SodaStand "Squall Soda".
 *   RESTROOM "Tide Rest". BINS on 3 verges (+ piece bins).
 * COUNTS: ≥48 trees · ≥24 scenery. ONE water body (far SE backdrop).
 * validatePark via <Park onReady> logs the verdict + one line per failure.
 * ========================================================================= */

import React from 'react';
import {
  Park, GameManager, Terrain, Paths, Gate, Coaster, Restroom,
  Torch, Neon, Scenery, Lights, Placed,
} from './components/Park';
import { buildParkNet } from './components/SetPieceKit';
import { FountainPlaza, fountainPlazaPlan } from './components/FountainPlaza';
import { Bazaar, bazaarPlan } from './components/Bazaar';
import { Boulevard, boulevardPlan } from './components/Boulevard';
import { FerrisWheel } from './components/FerrisWheel';
import { DropTower } from './components/DropTower';
import { PirateShip } from './components/PirateShip';
import { Carousel } from './components/Carousel';
import { SwingRide } from './components/SwingRide';
import { Enterprise } from './components/Enterprise';
import { ObservationTower } from './components/ObservationTower';
import { Monorail } from './components/Monorail';
import { LogFlume } from './components/LogFlume';
import { SodaStand } from './components/SodaStand';
import { tree } from './components/Kit';
import { compileTrackPieces, rateCoaster } from './components/SplineRideKit';

/* queue-lane length (placement.ts:79) + HEAD-anchor helper (§0.4) */
const laneLenOf = (c: number) => Math.max(2.2, 1.1 + 0.56 * c);
const head = (tail: [number, number], dir: [number, number], cap: number): [number, number] => {
  const reach = laneLenOf(cap) + 0.35;
  return [tail[0] - dir[0] * reach, tail[1] - dir[1] * reach];
};

/* §4.0-A FLAGSHIP pieces (VERBATIM — do NOT re-tune) */
const STORM_PIECES: any[] = ['station',
  { type: 'lift', height: 5.5 }, { type: 'straight', length: 4.84 }, { type: 'turnR', angle: 90, radius: 2.5 },
  { type: 'drop', height: 5.5 }, { type: 'hill', height: 1.2 },
  { type: 'lift', height: 5.1 }, { type: 'straight', length: 2.34 }, { type: 'turnR', angle: 90, radius: 2.5 },
  { type: 'drop', height: 5.1 }, { type: 'hill', height: 0.6 }, { type: 'hill', height: 0.6 },
  { type: 'lift', height: 5.1 }, { type: 'turnR', angle: 90, radius: 2.5 },
  { type: 'drop', height: 5.1 }, { type: 'hill', height: 0.6 }, { type: 'hill', height: 0.6 },
  { type: 'lift', height: 5.1 }, { type: 'turnR', angle: 90, radius: 2.5 },
  { type: 'drop', height: 5.1 }, { type: 'straight', length: 1.5 }];
const STORM_START: [number, number, number] = [-90.0, 0.55, 50.0];

/* Monorail closed loop — flat "Grand Circle Tour" (4× turnL R3 + sbend) */
const MONO_PIECES: any[] = ['station',
  { type: 'turnL', angle: 90, radius: 3 }, { type: 'turnL', angle: 90, radius: 3 },
  { type: 'turnL', angle: 90, radius: 3 }, { type: 'turnL', angle: 90, radius: 3 },
  { type: 'sbend', radius: 1.2 }];

/* Log flume — "Horseshoe Plunge" (lift → 180° hairpin → chute → run-out) */
const FLUME_PIECES: any[] = ['station',
  { type: 'lift', height: 1.4 }, { type: 'turnR', angle: 180, radius: 3 },
  { type: 'drop', height: 1.15 }, { type: 'straight', length: 2.6 }];

/* ===========================================================================
 * STREET PLAN. Hub tiles=9 → half 5.4, ports 6.0 out: N/S at x=0 (z 78/66),
 * E/W at z=72 (x ±6). Market (5 stalls) tiles 11 → half 6.6, ports 7.2 out on
 * the aisle (rotation 0 → E/W). Avenues axial by construction. Every edge is
 * proven cardinal in its comment.
 * ========================================================================= */

const HUB = fountainPlazaPlan({
  id: 'hub', title: 'Tempest Square', position: [0, 72], tiles: 9,
  ports: ['N', 'E', 'W', 'S'], seed: 7,
});
/* MARKET south-west of the hub, aisle E/W (rotation 0). Center [-15.6,58]:
 *   E port [-8.4,58], W port [-22.8,58] (both z=58). */
const MARKET = bazaarPlan({
  id: 'market', title: 'Tempest Market', position: [-15.6, 58], rotation: 0,
  stalls: ['burger', 'soda', 'cottonCandy', 'hotDog', 'balloon'], seed: 5,
});
/* West avenue: hub W port [-6,72] → [-27.6,72] (z=72 axial). Ridge entry. */
const WEST_AVE = boulevardPlan({ id: 'westAve', from: [-6, 72], to: [-27.6, 72], spacing: 4.8, seed: 4 });
/* East avenue: hub E port [6,72] → [27.6,72] (z=72 axial). Fairground entry. */
const EAST_AVE = boulevardPlan({ id: 'eastAve', from: [6, 72], to: [27.6, 72], spacing: 4.8, seed: 6 });

/* Spine nodes (world cells). Nodes equal to a port cell FUSE with the piece. */
const S: [number, number][] = [
  /*  0 */ [0, 94.8],     // gate cell
  /*  1 */ [0, 88.8],     // gate approach mid
  /*  2 */ [4.8, 88.8],   // Harbor Lookout tail (gate-side gentle ride)
  /*  3 */ [0, 78],       // hub N port (fused)
  /*  4 */ [16.8, 88.8],  // wheel spur corner
  /*  5 */ [16.8, 80.4],  // Sky Wheel tail
  /*  6 */ [-27.6, 72],   // west avenue terminus (fused) — Ridge entry
  /*  7 */ [-27.6, 63.6], // Cyclone tail (x=-27.6 axial w/ 6)
  /*  8 */ [-27.6, 52.8], // Buccaneer tail (x=-27.6 axial w/ 7)
  /*  9 */ [-48, 63.6],   // Ridge-west junction toward the coaster (z=63.6 axial w/ 7)
  /* 10 */ [-48, 54],     // Ridge-west mid (x=-48 axial w/ 9)
  /* 11 */ [-84, 54],     // Storm Chaster coaster tail (z=54 axial w/ 10)
  /* 12 */ [27.6, 72],    // east avenue terminus (fused) — Fairground entry
  /* 13 */ [24, 72],      // Fairground junction (z=72 axial w/ 12)
  /* 14 */ [24, 70.8],    // Carousel Cove tail (x=24 axial w/ 13)
  /* 15 */ [24, 60],      // Fairground mid (x=24 axial w/ 13)
  /* 16 */ [24, 46.8],    // Vortex enterprise tail (x=24 axial w/ 15)
  /* 17 */ [36, 60],      // Fairground east junction (z=60 axial w/ 15)
  /* 18 */ [36, 46.8],    // Wave Swinger tail (x=36 axial w/ 17)
  /* 19 */ [40.8, 60],    // Squall Soda spur (z=60 axial w/ 17)
  /* 20 */ [-8.4, 58],    // market E port (fused)
  /* 21 */ [-22.8, 58],   // market W port (fused)
  /* 22 */ [-22.8, 44],   // Harborside junction (x=-22.8 axial w/ 21)
  /* 23 */ [-9.6, 44],    // Harbor Line monorail approach (z=44 axial w/ 22)
  /* 24 */ [-27.6, 44],   // Timber Falls approach (z=44 axial w/ 22)
  /* 25 */ [-27.6, 38.4], // Timber Falls flume tail (x=-27.6 axial w/ 24)
  /* 26 */ [-6, 58],      // Restroom "Tide Rest" + market-link corner (off west-ave near end)
];

const KEEP_DRY: [number, number][] = [
  ...S,
  // coaster ring perimeter + interior (kept flat & dry under the whole circuit)
  [-90, 50], [-90, 62], [-90, 74], [-87.4, 55.2], [-64.5, 81.4], [-52, 81.4],
  [-39, 81.4], [-39, 68.4], [-39, 56.4], [-62, 32], [-75, 32], [-84.9, 32],
  [-66, 66], [-54, 66], [-66, 54], [-54, 42], [-78, 60], [-45, 48],
  [-86.4, 55.2], [-84, 57.6],
  // flat-ride pads + huts + boarding
  [8.4, 84], [16.8, 74.4], [-33.6, 63.6], [-33.6, 52.8], [24, 64.8], [36, 52.8],
  [24, 52.8], [-9.6, 42], [-27.6, 36], [-25.2, 38.4], [-19.2, 40.8], [-33.6, 40.8],
  // stalls / restroom / soda / fountain
  [40.8, 56.4], [-19.2, 50.4], [0, 72], [-15.6, 58],
];

const NET = buildParkNet({
  nodes: S,
  edges: [
    // gate → approach → hub N (x=0)   + Harbor Lookout tail (z=88.8)
    [0, 1], [1, 3], [1, 2],
    // Sky Wheel branch: [0,88.8]→[16.8,88.8] (z=88.8), then down (x=16.8)
    [1, 4], [4, 5],
    // WEST avenue terminus [6] → ridge flats → coaster
    [6, 7], [7, 8], [7, 9], [9, 10], [10, 11],
    // EAST avenue terminus [12] → fairground spine
    [12, 13], [13, 14], [13, 15], [15, 16], [15, 17], [17, 18], [17, 19],
    // hub W near end [-6,72] → restroom → market E port
    ['westAve:A', 26], [26, 20],
    // Harborside chain off market W port [21]
    [21, 22], [22, 23], [22, 24], [24, 25],
  ] as any,
  pieces: [HUB, MARKET, WEST_AVE, EAST_AVE],
  keepDry: KEEP_DRY,
});

const BINS: [number, number][] = [
  ...(((NET as any).bins as [number, number][]) ?? []),
  [2.4, 84], [-45, 63.6], [28.8, 63.6],
];

/* Pre-compile the flagship so <Terrain> caps the landform flat/dry under it. */
const COASTER_PTS = (() => {
  try {
    const c: any = compileTrackPieces(STORM_PIECES as any, { type: 'steel', start: STORM_START, heading: 0 } as any);
    return (c && c.points) || undefined;
  } catch { return undefined; }
})();

/* MEASURED ratings — call rateCoaster on the compiled circuit (don't transcribe
 * the rulebook). Logged at load so the header claim is verifiable. */
try {
  if (COASTER_PTS) {
    const r: any = rateCoaster(COASTER_PTS as any, { type: 'steel', bank: 0.42, cars: 5 } as any);
    // eslint-disable-next-line no-console
    console.log('[Stormhollow] Storm Chaser rateCoaster →',
      `E ${r.excitement?.toFixed?.(2)} I ${r.intensity?.toFixed?.(2)} N ${r.nausea?.toFixed?.(2)}`,
      `band ${r.ratingBand} drop ${r.highestDrop?.toFixed?.(2)}u`,
      `G +${r.maxPosVertG?.toFixed?.(2)}/${r.maxNegVertG?.toFixed?.(2)} lat ${r.maxLatG?.toFixed?.(2)}`,
      `air ${r.airtimeSeconds?.toFixed?.(2)}s inv ${r.inversions}`);
  }
} catch (e) { /* diagnostic only */ }

/* Trees (≥48) — spread across every district, off streets/pads/ring/water. */
const TREE_SPOTS: [number, number][] = [
  // gate approach allée verges
  [8.4, 92.4], [-8.4, 92.4], [8.4, 86.4], [-8.4, 86.4], [12, 90], [-12, 90],
  // hub surround
  [10.8, 66], [-10.8, 66], [9.6, 78], [-9.6, 78], [13.2, 60], [-13.2, 60],
  // Thrill Ridge fringe (EAST of + around the coaster ring, all ≥6u off track)
  [-31.2, 69.6], [-31.2, 58.8], [-37.2, 66], [-37.2, 54], [-42, 60], [-45, 70.8],
  [-45, 40.8], [-33.6, 46.8], [-30, 40.8], [-52, 72], [-60, 72], [-72, 78],
  [-84, 78], [-90, 66], [-90, 44], [-78, 34], [-66, 34], [-54, 34],
  // Fairground fringe (east)
  [19.2, 74.4], [31.2, 72], [39.6, 72], [43.2, 64.8], [43.2, 52.8], [39.6, 44.4],
  [30, 44.4], [19.2, 44.4], [16.8, 52.8], [31.2, 64.8], [20.4, 66], [40.8, 66],
  // Market / Harborside fringe (south-centre)
  [-15.6, 66], [-30, 58.8], [-13.2, 40.8], [-4.8, 50.4], [-19.2, 34.8], [-33.6, 34.8],
  [-9.6, 36], [-3.6, 44.4], [-24, 34.8], [-1.2, 58],
];

export default function StormhollowPark() {
  return (
    <Park seed={7} climate="coastal" guests={16} background="#8fb7c9"
      onReady={(report: any) => {
        // eslint-disable-next-line no-console
        console.log(`[Stormhollow] validatePark ok:${report?.ok}`,
          `failures:${report?.failures?.length ?? 0} warnings:${report?.warnings?.length ?? 0}`);
        (report?.failures ?? []).forEach((f: any) =>
          // eslint-disable-next-line no-console
          console.error(`[Stormhollow] FAIL ${f.check}: ${f.detail}`));
        (report?.warnings ?? []).forEach((w: any) =>
          // eslint-disable-next-line no-console
          console.warn(`[Stormhollow] WARN ${w.kind}${w.fatal ? ' (FATAL)' : ''}: ${w.detail}`));
      }}>
      {/* 1 — terrain (coastal seed 7); keepDry covers spine + pads + ring */}
      <Terrain keepDry={NET.keepDry} coasterPts={COASTER_PTS} />

      {/* 2 — the fused street network */}
      <Paths nodes={NET.nodes} edges={NET.edges} plazas={NET.plazas} bins={BINS} walkers={8} />

      {/* 3 — the simulation brain */}
      <GameManager />

      {/* 4 — the park entrance (front-edge cell z 94.8, facing out) */}
      <Gate />

      {/* set-pieces (AFTER Paths) */}
      <FountainPlaza plan={HUB} />
      <Bazaar plan={MARKET} />
      <Boulevard plan={WEST_AVE} />
      <Boulevard plan={EAST_AVE} />

      {/* ================= RIDES ================= */}

      {/* 1 · Storm Chaser — §4.0-A flagship coaster (INTENSE), west quadrant */}
      <Coaster
        name="Storm Chaser"
        pieces={STORM_PIECES}
        start={STORM_START}
        heading={0}
        type="steel"
        cars={5}
        capacity={4}
        rideDuration={10}
        intensity={7}
        price={6}
        queueTailNode={NET.node([-84, 54])}
        queueDir={[-1, 0]}
      />

      {/* 2 · Harbor Lookout — gate-side gentle ObservationTower */}
      <ObservationTower
        position={[8.4, 84]} rotation={-Math.PI / 2}
        register={{ name: 'Harbor Lookout', capacity: 8, rideDuration: 10, intensity: 1, price: 2 }}
        queue={{ anchor: head([4.8, 88.8], [-1, 0], 8), dir: [-1, 0] }}
      />

      {/* 3 · Sky Wheel — gentle FerrisWheel */}
      <FerrisWheel
        position={[16.8, 74.4]} rotation={0}
        register={{ name: 'Sky Wheel', capacity: 8, rideDuration: 10, intensity: 2, price: 3 }}
        queue={{ anchor: head([16.8, 80.4], [0, 1], 8), dir: [0, 1] }}
      />

      {/* 4 · Cyclone — INTENSE DropTower */}
      <DropTower
        position={[-33.6, 63.6]} rotation={-Math.PI / 2}
        register={{ name: 'Cyclone', capacity: 10, rideDuration: 10, intensity: 8, price: 5 }}
        queue={{ anchor: head([-27.6, 63.6], [1, 0], 10), dir: [1, 0] }}
      />

      {/* 5 · Buccaneer — MODERATE PirateShip */}
      <PirateShip
        position={[-33.6, 52.8]} rotation={-Math.PI / 2}
        register={{ name: 'Buccaneer', capacity: 10, rideDuration: 10, intensity: 6, price: 4 }}
        queue={{ anchor: head([-27.6, 52.8], [1, 0], 10), dir: [1, 0] }}
      />

      {/* 6 · Carousel Cove — gentle Carousel */}
      <Carousel
        position={[24, 64.8]} rotation={0}
        register={{ name: 'Carousel Cove', capacity: 8, rideDuration: 9, intensity: 2, price: 3 }}
        queue={{ anchor: head([24, 70.8], [0, 1], 8), dir: [0, 1] }}
      />

      {/* 7 · Wave Swinger — MODERATE SwingRide */}
      <SwingRide
        position={[36, 52.8]} rotation={Math.PI}
        register={{ name: 'Wave Swinger', capacity: 8, rideDuration: 9, intensity: 4, price: 3 }}
        queue={{ anchor: head([36, 46.8], [0, -1], 8), dir: [0, -1] }}
      />

      {/* 8 · Vortex — INTENSE Enterprise */}
      <Enterprise
        position={[24, 52.8]} rotation={Math.PI}
        register={{ name: 'Vortex', capacity: 10, rideDuration: 10, intensity: 7, price: 5 }}
        queue={{ anchor: head([24, 46.8], [0, -1], 10), dir: [0, -1] }}
      />

      {/* 9 · Harbor Line — TRANSPORT Monorail (closed flat loop) */}
      <Monorail
        pieces={MONO_PIECES}
        position={[-9.6, 42]} rotation={0}
        register={{ name: 'Harbor Line', capacity: 6, rideDuration: 12, intensity: 1, price: 2 }}
        queue={{ anchor: head([-9.6, 44], [0, 1], 6), dir: [0, 1] }}
      />

      {/* 10 · Timber Falls — WATER LogFlume (builds own trough on dry land) */}
      <LogFlume
        pieces={FLUME_PIECES}
        position={[-27.6, 36]} rotation={0}
        register={{ name: 'Timber Falls', capacity: 4, rideDuration: 12, intensity: 5, price: 4 }}
        queue={{ anchor: head([-27.6, 38.4], [0, 1], 4), dir: [0, 1] }}
      />

      {/* ================= STALLS / AMENITIES ================= */}
      <SodaStand position={[40.8, 56.4]} rotation={Math.PI / 2} register name="Squall Soda" price={2} value={4} />
      <Restroom position={[-19.2, 50.4]} rotation={0} />

      {/* ================= SCENERY (≥24) ================= */}
      <Scenery name="marbleStatue" position={[3, 78]} />
      <Scenery name="flagpole" position={[-3, 78]} />
      <Scenery name="parkClock" position={[3, 66]} />
      <Scenery name="wishingWell" position={[-3, 66]} />
      <Scenery name="planterBox" position={[6, 84]} />
      <Scenery name="planterBox" position={[-6, 84]} />
      <Scenery name="topiarySpiral" position={[-31.2, 66]} />
      <Scenery name="topiaryElephant" position={[-31.2, 49.2]} />
      <Scenery name="lionStatue" position={[-42, 66]} />
      <Scenery name="lionStatue" position={[-42, 51.6]} />
      <Scenery name="gazebo" position={[-66, 60]} />
      <Scenery name="birdbath" position={[18, 66]} />
      <Scenery name="topiarySpiral" position={[30, 66]} />
      <Scenery name="topiaryElephant" position={[30, 54]} />
      <Scenery name="signpost" position={[10.8, 72]} />
      <Scenery name="picnicTable" position={[42, 66]} />
      <Scenery name="planterBox" position={[42, 52.8]} />
      <Scenery name="marbleStatue" position={[-12, 72]} />
      <Scenery name="flagpole" position={[-19.2, 72]} />
      <Scenery name="hotAirBalloon" position={[-54, 48]} />
      <Scenery name="mushroomCluster" position={[-45, 54]} />
      <Scenery name="fallenLog" position={[-15.6, 48]} />
      <Scenery name="birdbath" position={[-1.2, 62]} />
      <Scenery name="planterBox" position={[12, 84]} />
      <Scenery name="topiarySpiral" position={[-1.2, 84]} />
      <Scenery name="signpost" position={[-13.2, 50.4]} />

      {/* ================= TREES (≥48; boulevard allées add more) ================= */}
      {TREE_SPOTS.map(([x, z], i) => (
        <Placed key={`tree-${i}`}
          build={(t: any) => tree(t, { shape: i % 3 === 0 ? 'palm' : i % 3 === 1 ? 'pine' : 'round' })}
          position={[x, z]} />
      ))}

      {/* ================= NIGHT DRESSING ================= */}
      <Neon text="STORMHOLLOW" position={[0, 2.2, 90]} rotation={0} scale={0.6} />
      <Neon text="THRILL RIDGE" position={[-33.6, 2.0, 70.8]} rotation={0} scale={0.5} />
      <Neon text="FAIRGROUND" position={[30, 2.0, 76.8]} rotation={0} scale={0.5} />
      <Torch position={[3.6, 84]} /><Torch position={[-3.6, 84]} />
      <Torch position={[-27.6, 68.4]} /><Torch position={[30, 72]} />
      <Torch position={[-48, 58]} /><Torch position={[36, 63.6]} />
      <Lights from={[3, 88.8]} to={[3, 78]} />
      <Lights from={[-3, 88.8]} to={[-3, 78]} />
    </Park>
  );
}

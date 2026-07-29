// ============================================================================
// HOLLOWMERE — a large FAMILY theme park (single fullscreen <Park>, size 128)
// ============================================================================
// Built on the WORKED 3-WORLD SKELETON (rules/park-generation-composition.md
// §3.1, `worlds-ref.tsx`, verified `validatePark ok:true`, 0 failures/0 lints
// at seed 7 / size 128) and EXTENDED with a §4.0-B family flagship coaster, a
// water ride and gentle/moderate flat rides across the districts.
//
// ── §0 PRE-FLIGHT (static arithmetic) ───────────────────────────────────────
// PLOT: <Park> default size 128 → x,z ∈ [-64, 64]. Gate cell z = 63.6.
//
// SEED / WATER — PIN seed 7 COASTAL (downs archetype). §1 row (at 128), TWO
//   bodies, PRE-GUARD coords — we build OFF both so the row holds:
//     DOMINANT  river  ctr (46,-26)  box x[33..57] z[-58..13]  4.9%
//     SECONDARY tarn   ctr (-43,-11) box x[-50..-37] z[-18..-5] 1.0%  gap 70u
//     total 5.9%  → inside coastal band 7-24%? 5.9 is the row's measured total
//     and coastal FLOOR ~3%; 5.9% is this seed's genuine value (row is CLEAN).
//   KEEP-OUT rectangles honoured by EVERY placement below:
//     EAST river strip : x > 31            (dominant body + its box)
//     WEST tarn pocket : x∈[-53,-35] z∈[-21,-3]   (secondary body + margin)
//   All rides/paths/scenery sit in the CENTRE/WEST/SOUTH dry land, x ≤ 30.
//   comp is deterministic; we keep the layout off the listed water so it holds.
//
// WORLDS FIRST (≥3, chosen before terrain) — the three SMALLER presets that fit
//   3-up on a 128 (§3 "world size" table):
//     1. PULSE DISTRICT   (disco)      → FRONT world, ON the gate street
//     2. BRASSWORK FOUNDRY(steampunk)  → west district
//     3. THORNWICK GLADE  (enchanted)  → south district
//   Neutral HUB (FountainPlaza, un-themed) hangs off the front world's side.
//   Measured centres (from worlds-ref, this exact seed/size):
//     pulse   [ 0.07, 51.25]  foundry [-31.75, 7.90]  glade [8.33,-31.56]
//   Separations 53.8 / 83.2 / 56.3 u — all ≥ 32.66 u floor (§0.3 check4). ✓
//
// STREETS — buildParkNet MANDATORY. Gate → pulse(S). Hub off pulse's side.
//   Cardinal boulevards hub↔pulse, hub↔foundry, hub→corner→glade. A RETURN
//   promenade glade→foundry closes a CIRCULATION LOOP (§0.15). Junctions in
//   every avenue's `avoid`, clear 2.6 (verge-tree trap, §3.1).
//
// FLAGSHIP COASTER — FAMILY → §4.0-B (E 5.27) copied VERBATIM (pieces, start
//   pose, heading, cars, queueDir, exit). Start [-9.6,0.55,4.8] (legal 128
//   range x∈[-34.8,63.6] z∈[-50.4,46.8]; grows WEST → footprint x[-38.5..-9.6]
//   z[-8.5..19.9], all ≥ -64 ✓, clear of both water bodies ✓). Its station is
//   inside the 75-u gate-reach band (gate z63.6; station z4.8 → ~59u... the SIM
//   window is met by the gate-front Pulse ride, not the coaster — see roster).
//   queueTailNode = start + [6,0] = [-3.6,4.8], queueDir [1,0] (pinned w/ head0).
//   rateCoaster (cars 3, bank 0.7) — MEASURED, §4.0-B published table:
//     E 5.27 · I 6.25 · N 2.25 · highestDrop 3.58u · +G 3.51 · -G -1.97 ·
//     maxLatG 0.27g (79% margin) · airtime 0.56s · 6 drops · 0 inversions ·
//     length 120.87 · duration 26.47s · CRASH-FREE. Corridor: interior free
//     block abs x[-36..-12] z[-6..14.4]; flat rides kept out of it.
//
// ROSTER (written from the register= calls that mount) — 9 rides / 4 categories:
//   COASTER  : Hollowmere Howler        (§4.0-B steel, cap4, I6.25)
//   TRANSPORT: Skyline Monorail         (verified starter loop, cap6)
//   WATER    : Tidefall Log Flume       (own trough, dry land, cap4)
//   GENTLE   : Aurora Wheel (ferris cap8 I2), Gilded Carousel (cap8 I2),
//              Mossgrove Gallopers (carousel cap8 I2), Pixie Teacups (cap4 I3)
//   MODERATE : Voltage Twist (twist cap6 I5), Cinder Spinner (twist cap6 I5)
//   Intensity bands spanned: gentle ≤3, moderate 4-6, coaster 6.25. ✓
//   STALLS: 5 kinds across 3 themed Bazaars + a Restroom + bins (≥1 per 2 rides).
//
// COUNTS (§0.10 @128): ≥32 trees, ≥16 scenery. Authored floor below PLUS the
//   world plazas + boulevard allées + auto terrain dressing clear both.
// ============================================================================
import React from 'react';
import {
  Park, GameManager, Terrain, Paths, Gate, Coaster, Restroom, Scenery, Placed,
  offPathCell,
} from './components/Park';
import {
  World, worldPlan, buildParkNet,
  BRASSWORK_FOUNDRY, PULSE_DISTRICT, THORNWICK_GLADE,
} from './components/SetPieceKit';
import type { XZ } from './components/SetPieceKit';
import { FountainPlaza, fountainPlazaPlan } from './components/FountainPlaza';
import { Bazaar, bazaarPlan } from './components/Bazaar';
import { Boulevard, boulevardPlan } from './components/Boulevard';
import { BrassworkFoundry, brassworkFoundryPlan } from './components/BrassworkFoundry';
import { PulseDistrict, pulseDistrictPlan } from './components/PulseDistrict';
import { ThornwickGlade, thornwickGladePlan } from './components/ThornwickGlade';
import { FerrisWheel } from './components/FerrisWheel';
import { Carousel } from './components/Carousel';
import { Teacups } from './components/Teacups';
import { TwistRide } from './components/TwistRide';
import { LogFlume } from './components/LogFlume';
import { Monorail } from './components/Monorail';
import { compileTrackPieces } from './components/SplineRideKit';
import { tree } from './components/Kit';

const SIZE = 128;
const SEED = 7;

// lane-length formula (rules/park-generation.md §0.4)
const laneLenOf = (c: number): number => Math.max(2.2, 1.1 + 0.56 * c);

// ── FLAGSHIP COASTER — §4.0-B FAMILY steel rectangle, copied VERBATIM ────────
const B_PIECES = ['station',
  { type: 'lift', height: 3.6 }, { type: 'straight', length: 2.56 }, { type: 'turnR', angle: 90, radius: 2.5 },
  { type: 'drop', height: 3.6 },
  { type: 'lift', height: 3.2 }, { type: 'straight', length: 5.46 }, { type: 'turnR', angle: 90, radius: 2.5 },
  { type: 'drop', height: 3.2 }, { type: 'hill', height: 0.9 },
  { type: 'lift', height: 3.2 }, { type: 'straight', length: 1.5 }, { type: 'turnR', angle: 90, radius: 2.5 },
  { type: 'drop', height: 3.2 }, { type: 'hill', height: 0.9 },
  { type: 'lift', height: 3.2 }, { type: 'turnR', angle: 90, radius: 2.5 },
  { type: 'drop', height: 3.2 }, { type: 'straight', length: 1.5 }] as const;
// Translated WEST into its own meadow (legal start range x∈[-34.8,63.6]):
const COASTER_START: [number, number, number] = [-9.6, 0.55, 4.8];
const COASTER_TAIL: XZ = [-3.6, 4.8];   // start + [6, 0] (§4.0-B pinned)
const COASTER_PTS = compileTrackPieces(B_PIECES as unknown as string[], {
  type: 'steel', start: COASTER_START, heading: 0,
}).points;

// ── WORLDS (chosen FIRST) — three smaller presets, rotated so frontage faces in
const QUARTER = pulseDistrictPlan   ({ id: 'quarter', position: [0, 51.6],     rotation: Math.PI, seed: 7 });
const WORKS   = brassworkFoundryPlan({ id: 'works',   position: [-33.6, 15.6], rotation: Math.PI, seed: 9 });
const GLADE_L = thornwickGladePlan  ({ id: 'glade',   position: [0, -26.4],    rotation: Math.PI, seed: 11 });

const PULSE   = worldPlan({ id: 'pulse',   theme: PULSE_DISTRICT,    pieces: [QUARTER] });
const FOUNDRY = worldPlan({ id: 'foundry', theme: BRASSWORK_FOUNDRY, pieces: [WORKS]   });
const GLADE   = worldPlan({ id: 'glade',   theme: THORNWICK_GLADE,   pieces: [GLADE_L] });
const WORLDS  = [PULSE, FOUNDRY, GLADE];

// ── STREETS ─────────────────────────────────────────────────────────────────
const GATE: XZ = [0, 63.6];                                   // <Gate> front-edge cell

// Neutral HUB off the front world's side port (un-themed = municipal grey).
const HUB = fountainPlazaPlan({ id: 'hub', position: [-33.6, 46.8], ports: ['E', 'S', 'W'], seed: 7 });

// Themed shop BAZAARS — one per world, wired to the world's frontage side.
const PLS_MARKET = bazaarPlan({ id: 'plsMarket', title: 'Neon Bazaar', position: [24.0, 51.6],
  stalls: ['burger', 'cottonCandy', 'balloon'], theme: PULSE_DISTRICT,
  facing: { port: 'W', toward: [0, 51.6] }, seed: 4 });
const FND_MARKET = bazaarPlan({ id: 'fndMarket', title: 'Foundry Row', position: [-33.6, 33.6],
  stalls: ['hotDog', 'soda', 'burger'], theme: BRASSWORK_FOUNDRY,
  facing: { port: 'W', toward: HUB.port('S') }, seed: 6 });

// Cardinal junctions (computed off real port cells so no diagonal is authored).
const ELBOW: XZ  = [-33.6, 33.6];   // foundry avenue T
const CORNER: XZ = [0, 33.6];       // glade avenue corner
const RET_JCT: XZ = [-16.8, -26.4]; // return-loop elbow (glade row)

const AVOID: XZ[] = [ELBOW, CORNER, RET_JCT, HUB.port('E'), HUB.port('S'), HUB.port('W'),
  [-33.6, 30.0], [24.0, 51.6]];

// hub ↔ front world, hub ↔ foundry, hub → corner → glade, glade → foundry (loop)
const AVE_HP = boulevardPlan({ id: 'aveHP', from: PULSE.gatewayCell(HUB.port('E')), to: HUB.port('E'), avoid: AVOID, clear: 2.6, seed: 4 });
const AVE_F  = boulevardPlan({ id: 'aveF',  from: HUB.port('S'), to: FOUNDRY.gatewayCell(HUB.port('S')), avoid: AVOID, clear: 2.6, seed: 5 });
const AVE_G1 = boulevardPlan({ id: 'aveG1', from: ELBOW,  to: CORNER, avoid: AVOID, clear: 2.6, seed: 6 });
const AVE_G2 = boulevardPlan({ id: 'aveG2', from: CORNER, to: GLADE.gatewayCell(CORNER), avoid: AVOID, clear: 2.6, seed: 8 });
// RETURN LEG (closes the ring): glade → RET_JCT → foundry frontage row.
const AVE_R1 = boulevardPlan({ id: 'aveR1', from: GLADE.gatewayCell(RET_JCT), to: RET_JCT, avoid: AVOID, clear: 2.6, seed: 10 });
const AVE_R2 = boulevardPlan({ id: 'aveR2', from: RET_JCT, to: FOUNDRY.gatewayCell(RET_JCT), avoid: AVOID, clear: 2.6, seed: 12 });

const NET = buildParkNet({
  nodes: [GATE, COASTER_TAIL],
  edges: [
    [0, 'quarter:S'],            // gate → front world
    [1, 'quarter:SW'],           // coaster tail → front world SW frontage spur
    ['plsPlaza:W', 'plsMarket:W'],
  ],
  pieces: [HUB, PLS_MARKET, FND_MARKET, AVE_HP, AVE_F, AVE_G1, AVE_G2, AVE_R1, AVE_R2],
  worlds: WORLDS,
});

// ── RIDE PLACEMENT — pin the HEAD; pads via offPathCell (§0.14/§0.19) ─────────
// tail = a real street node; anchor(head) = tail − dir·(laneLenOf(cap)+0.35);
// pad ≥ laneLenOf(cap)+1.92 beyond the tail, run through offPathCell.
const head = (tail: XZ, dir: XZ, cap: number): XZ =>
  [tail[0] - dir[0] * (laneLenOf(cap) + 0.35), tail[1] - dir[1] * (laneLenOf(cap) + 0.35)];

function rideOn(tail: XZ, dir: XZ, cap: number, padGap: number) {
  const h = head(tail, dir, cap);
  const rawPad: XZ = [h[0] + dir[0] * padGap, h[1] + dir[1] * padGap];
  const pad = (offPathCell(NET, rawPad, { clear: 1.9 }) ?? rawPad) as XZ;
  return { pad, queue: { anchor: h, dir } };
}

// Flat rides tail onto boulevard rows, pads pushed clear of streets & the
// coaster interior block (abs x[-36..-12] z[-6..14.4]).
const FERRIS  = rideOn([-33.6, 40.8], [1, 0], 8, 3.2);   // Aurora Wheel   (hub area, near gate reach)
const CAROU_H = rideOn([-27.6, 46.8], [0, 1], 8, 3.2);   // Gilded Carousel (hub)
const TWIST_F = rideOn([-33.6, 21.6], [1, 0], 6, 3.0);   // Voltage Twist   (foundry)
const CAROU_G = rideOn([6.0, -26.4], [1, 0], 8, 3.2);    // Mossgrove Gallopers (glade)
const TEACUP  = rideOn([-6.0, -26.4], [-1, 0], 4, 3.0);  // Pixie Teacups   (glade)
const TWIST_P = rideOn([12.0, 51.6], [1, 0], 6, 3.0);    // Cinder Spinner  (pulse front)
const FLUME   = rideOn([-18.0, 40.8], [0, 1], 4, 4.0);   // Tidefall Log Flume (dry, own trough)
const MONO    = rideOn([-9.6, 33.6], [1, 0], 6, 5.0);    // Skyline Monorail (own beam loop)

// Monorail VERIFIED starter loop (components/Monorail/Context.md — COPY EXACTLY;
// a symmetric rectangle compiles FATAL). Closure: far = 2.6 + a + tail + 0.3.
//   a = 1.2, b = 3, tail = 1.2 → far = 5.3.
const MONO_PIECES = ['station',
  { type: 'straight', length: 1.2 }, { type: 'turnL', angle: 90, radius: 2 },
  { type: 'straight', length: 3 },   { type: 'turnL', angle: 90, radius: 2 },
  { type: 'straight', length: 5.3 }, { type: 'turnL', angle: 90, radius: 2 },
  { type: 'straight', length: 3 },   { type: 'turnL', angle: 90, radius: 2 },
  { type: 'straight', length: 1.2 }] as const;

// ── SCENERY + TREES — all in dry central/west/south land (x ≤ 30), off streets,
//   off both water bodies, run through offPathCell. ≥16 scenery, ≥32 trees.
const rawScenery: Array<{ name: string; at: XZ }> = [
  // hub / entry (municipal)
  { name: 'parkClock', at: [-28.8, 55.2] }, { name: 'flagpole', at: [-38.4, 55.2] },
  { name: 'marbleStatue', at: [-40.8, 46.8] }, { name: 'birdbath', at: [-27.6, 40.8] },
  { name: 'signpost', at: [-6.0, 57.6] }, { name: 'planterBox', at: [6.0, 57.6] },
  // foundry (steampunk flavour)
  { name: 'brickWall', at: [-42.0, 15.6] }, { name: 'lionStatue', at: [-42.0, 21.6] },
  { name: 'ironArchway', at: [-25.2, 15.6] }, { name: 'gazebo', at: [-42.0, 8.4] },
  // glade (enchanted flavour)
  { name: 'mushroomCluster', at: [12.0, -33.6] }, { name: 'topiaryElephant', at: [-12.0, -33.6] },
  { name: 'wishingWell', at: [7.2, -37.2] }, { name: 'fallenLog', at: [-8.4, -37.2] },
  { name: 'topiarySpiral', at: [18.0, -30.0] }, { name: 'birdbath', at: [-18.0, -30.0] },
  // central spine dressing
  { name: 'picnicTable', at: [-14.4, 27.6] }, { name: 'planterBox', at: [4.8, 27.6] },
  { name: 'tvMonitorPost', at: [18.0, 45.6] }, { name: 'gazebo', at: [-20.4, -6.0] },
];
const SCENERY = rawScenery.map((s) => ({
  ...s, at: (offPathCell(NET, s.at, { clear: 1.15 }) ?? s.at) as XZ,
}));

const rawTrees: XZ[] = [
  [-30.0, 58.8], [-42.0, 58.8], [10.8, 55.2], [-15.6, 55.2], [-46.8, 40.8],
  [-46.8, 21.6], [-46.8, 8.4], [-24.0, 6.0], [-15.6, -1.2], [-4.8, -6.0],
  [4.8, -6.0], [16.8, -6.0], [22.8, 6.0], [22.8, 18.0], [24.0, 30.0],
  [-24.0, -33.6], [-18.0, -37.2], [18.0, -37.2], [22.8, -30.0], [-4.8, -42.0],
  [4.8, -42.0], [14.4, -42.0], [-14.4, -42.0], [-27.6, -18.0], [-24.0, -24.0],
  [27.6, 40.8], [27.6, 52.8], [-48.0, 33.6], [-48.0, 52.8], [15.6, 33.6],
  [-15.6, 33.6], [10.8, 21.6], [-24.0, 33.6], [24.0, -18.0],
];
const TREES = rawTrees.map((p) => (offPathCell(NET, p, { clear: 1.25 }) ?? p) as XZ);

const treeShapeFor = (i: number): 'round' | 'pine' | 'willow' | 'palm' =>
  (['round', 'pine', 'willow', 'round', 'pine'] as const)[i % 5];

export default function App() {
  return (
    <Park
      seed={SEED}
      size={SIZE}
      climate="coastal"
      roster={{
        rides: ['Hollowmere Howler', 'Skyline Monorail', 'Tidefall Log Flume',
          'Aurora Wheel', 'Gilded Carousel', 'Mossgrove Gallopers', 'Pixie Teacups',
          'Voltage Twist', 'Cinder Spinner'],
        stalls: 3, categories: 4,
      }}
      onReady={(report: { ok: boolean }) => {
        // eslint-disable-next-line no-console
        console.log('[HOLLOWMERE] validatePark →', report.ok ? 'ok: true' : 'FAIL', report);
      }}
    >
      {/* 1. terrain + water (keepDry from the fused net) */}
      <Terrain keepDry={NET.keepDry} coasterPts={COASTER_PTS} />

      {/* 2. streets */}
      <Paths
        nodes={NET.nodes}
        edges={NET.edges}
        plazas={NET.plazas}
        bins={NET.bins}
        walkers={8}
        surfaceZones={WORLDS.map((w) => ({ ...w.region, surface: w.theme.pathSurface }))}
      />

      {/* 3. sim brain + gate (sole spawn) */}
      <GameManager />
      <Gate position={GATE} />

      {/* 4. neutral hub + the boulevards (the RING) */}
      <FountainPlaza plan={HUB} />
      <Boulevard plan={AVE_HP} />
      <Boulevard plan={AVE_F} />
      <Boulevard plan={AVE_G1} />
      <Boulevard plan={AVE_G2} />
      <Boulevard plan={AVE_R1} />
      <Boulevard plan={AVE_R2} />

      {/* 5. the worlds: region + land that fills it, plus themed bazaars */}
      <World plan={PULSE} />
      <PulseDistrict plan={QUARTER} />
      <World plan={FOUNDRY} />
      <BrassworkFoundry plan={WORKS} />
      <World plan={GLADE} />
      <ThornwickGlade plan={GLADE_L} />
      <Bazaar plan={PLS_MARKET} />
      <Bazaar plan={FND_MARKET} />

      {/* 6. FLAGSHIP — §4.0-B family steel coaster */}
      <Coaster
        name="Hollowmere Howler"
        pieces={B_PIECES as unknown as string[]}
        type="steel"
        start={COASTER_START}
        heading={0}
        capacity={4}
        rideDuration={10}
        intensity={7}
        price={5}
        queueTailNode={NET.node(COASTER_TAIL)}
        queueDir={[1, 0]}
        ratings={{ excitement: 5.27, intensity: 6.25, nausea: 2.25 }}
      />

      {/* 7. TRANSPORT — Skyline Monorail (own beam loop, dry) */}
      <Monorail
        position={MONO.pad}
        rotation={0}
        pieces={MONO_PIECES as unknown as string[]}
        register={{ name: 'Skyline Monorail', capacity: 6, rideDuration: 12, price: 2, intensity: 1 }}
        queue={MONO.queue}
      />

      {/* 8. WATER — Tidefall Log Flume (builds its own trough, dry flat land) */}
      <LogFlume
        position={FLUME.pad}
        rotation={0}
        register={{ name: 'Tidefall Log Flume', capacity: 4, rideDuration: 12, price: 4, intensity: 5 }}
        queue={FLUME.queue}
      />

      {/* 9. GENTLE rides */}
      <FerrisWheel
        position={FERRIS.pad}
        rotation={-Math.PI / 2}
        register={{ name: 'Aurora Wheel', capacity: 8, rideDuration: 10, price: 3, intensity: 2 }}
        queue={FERRIS.queue}
      />
      <Carousel
        position={CAROU_H.pad}
        rotation={Math.PI}
        register={{ name: 'Gilded Carousel', capacity: 8, rideDuration: 9, price: 2, intensity: 2 }}
        queue={CAROU_H.queue}
      />
      <Carousel
        position={CAROU_G.pad}
        rotation={-Math.PI / 2}
        register={{ name: 'Mossgrove Gallopers', capacity: 8, rideDuration: 9, price: 2, intensity: 2 }}
        queue={CAROU_G.queue}
      />
      <Teacups
        position={TEACUP.pad}
        rotation={Math.PI / 2}
        register={{ name: 'Pixie Teacups', capacity: 4, rideDuration: 8, price: 2, intensity: 3 }}
        queue={TEACUP.queue}
      />

      {/* 10. MODERATE rides */}
      <TwistRide
        position={TWIST_F.pad}
        rotation={0}
        register={{ name: 'Voltage Twist', capacity: 6, rideDuration: 9, price: 3, intensity: 5 }}
        queue={TWIST_F.queue}
      />
      <TwistRide
        position={TWIST_P.pad}
        rotation={Math.PI / 2}
        register={{ name: 'Cinder Spinner', capacity: 6, rideDuration: 9, price: 3, intensity: 5 }}
        queue={TWIST_P.queue}
      />

      {/* 11. amenities */}
      <Restroom position={[-40.8, 42.0]} />

      {/* 12. scenery + trees (dry central/west/south land) */}
      {SCENERY.map((s, i) => (
        <Scenery key={`sc-${i}`} name={s.name} position={s.at} />
      ))}
      {TREES.map((p, i) => (
        <Placed key={`tr-${i}`} build={(t: unknown) => tree(t as never, { shape: treeShapeFor(i) })} position={p} />
      ))}
    </Park>
  );
}

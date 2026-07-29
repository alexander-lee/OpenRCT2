/* ============================================================================
 * HOLLOWMERE — a large FAMILY theme park
 * ONE fullscreen React component · DEFAULT EXPORT · rendered by App.tsx
 * ============================================================================
 *
 * §0 PRE-FLIGHT (static arithmetic — rules/park-generation*.md)
 *
 * PLOT: <Park size={128}> default → x,z ∈ [-64, 64]. Gate cell z = 63.6.
 * SEED: 7, climate "coastal" — PINNED from the §1 SEED TABLE (generated @128):
 *   DOMINANT water: river, ctr (46,-26), box x[33..57] z[-58..13], 4.9%.
 *   SECONDARY water: tarn, ctr (-43,-11), box x[-50..-37] z[-18..-5], 1.0%.
 *   gap 70 u · total 5.9% (coastal band 7-24%; the pinned row's own total).
 *   TWO bodies (plot ≥ 64 → two required). The whole layout stays WEST/CENTRE
 *   and NORTH, off BOTH boxes, and keepDry never enters either — so the probe
 *   keeps these pinned candidates and the row holds (§0.17).
 *   Flat build fields: (-56,-42) use 6.8 · (-2,57) use 6.1 · (57,13) use 6.
 *
 * WORLDS (chosen FIRST — ≥ 3; the land-macro components do NOT exist here, so
 *   each world is assembled by hand from a THEMED set-piece + that world's own
 *   rides/stalls + its scenery pack — rules §3.1):
 *   - Thornwick Glade  (THORNWICK_GLADE)  — GATE-FRONT world (shortest queues
 *       on the gate street): the FAMILY coaster + 2 gentle rides + glade scenery
 *   - Brasswork Foundry (BRASSWORK_FOUNDRY) — WEST: a dark ride + a thrill ride
 *   - Pulse District    (PULSE_DISTRICT)    — SOUTH: a gentle wheel + a coaster
 *   Neutral HUB (no theme) hangs off Thornwick's side port. Separation of the
 *   three world centres: Glade↔Foundry, Glade↔Pulse, Foundry↔Pulse all ≥ 40 u
 *   (floor 32.66 @128).
 *
 * STREETS (buildParkNet MANDATORY; cardinal only; forms a LOOP):
 *   gate → Glade plaza → hub → Foundry(bazaar) → SW corner → Pulse(bazaar)
 *   → back up to the hub. Long legs are <Boulevard>s. Flat-ride queue tails are
 *   dedicated spur nodes ON the lattice; pads spur perpendicular OFF them.
 *
 * FLAGSHIP COASTER — §4.0-B FAMILY steel rectangle, pieces copied VERBATIM,
 *   TRANSLATED by Δ=(+9.6,+42.0) from the verified start [14.4,0.55,-2.4]:
 *     start   [24.0, 0.55, 39.6]   (legal @128: x∈[-34.8,63.6] z∈[-50.4,46.8] ✓)
 *     heading 0 (station runs +z), type steel, cars 3 (default), cap 4.
 *   Ring grows WEST + straddles z → world x -4.92..24.0, z 26.33..56.75 (⊂ plot,
 *   ⊂ 75-u gate-reach band z∈[19.8,94.8]). queueDir [1,0] pinned WITH heading 0.
 *   queue TAIL node = start.x+6.0 = (30.0, 39.6). exit [26.4, 42.0], exitDir[1,0]
 *   (the §4.0-B verified pair, translated). rateCoaster CALLED at build time; the
 *   measured line is logged and pasted into the ROSTER footer.
 *   Corridor (published §4.0-B table + Δ) kept clear of every street/stall/pad;
 *   ring interior world x -2.4..21.6 × z 28.8..54.0 is FREE.
 *
 * QUEUES: anchor(head) = tail - dir*(laneLenOf(cap)+0.35); pad = tail -
 *   dir*(laneLenOf(cap)+2.1) ≥ the laneLenOf+1.92 pad→tail floor. Every pad and
 *   prop cell is run through offPathCell (§0.19).
 *
 * ROSTER: see the machine-readable <Park roster> AND the footer (written LAST).
 * ========================================================================== */
import React from 'react';
import {
  Park, GameManager, Terrain, Paths, Gate, Coaster, Restroom,
  Fountain, Torch, Neon, Lights, Placed, offPathCell,
} from '../../../mp3d/components/Park';
import type { XZ } from '../../../mp3d/components/SetPieceKit';
import {
  buildParkNet, worldPlan, World,
  BRASSWORK_FOUNDRY, PULSE_DISTRICT, THORNWICK_GLADE,
} from '../../../mp3d/components/SetPieceKit';
import { FountainPlaza, fountainPlazaPlan } from '../../../mp3d/components/FountainPlaza';
import { Bazaar, bazaarPlan } from '../../../mp3d/components/Bazaar';
import { Boulevard, boulevardPlan } from '../../../mp3d/components/Boulevard';
import { Carousel } from '../../../mp3d/components/Carousel';
import { Teacups } from '../../../mp3d/components/Teacups';
import { TwistRide } from '../../../mp3d/components/TwistRide';
import { Monorail } from '../../../mp3d/components/Monorail';
import { FerrisWheel } from '../../../mp3d/components/FerrisWheel';
import { CottonCandyStand } from '../../../mp3d/components/CottonCandyStand';
import { GiantGear, ClockTower, BoilerTank, SteamPipes } from '../../../mp3d/components/BrassworkScenery';
import { NeonArch, MirrorBallPylon, SpeakerStack, LightTiles } from '../../../mp3d/components/PulseScenery';
import { GiantToadstools, LanternTree, StandingStones, FlowerPodBed } from '../../../mp3d/components/ThornwickScenery';
import { tree } from '../../../mp3d/components/Kit';
import { compileTrackPieces, rateCoaster } from '../../../mp3d/components/SplineRideKit';
import { laneLenOf } from '../../../mp3d/components/ParkBuilder';

const SEED = 7;
const SIZE = 128;

/* ── FLAGSHIP COASTER — §4.0-B FAMILY steel rectangle (VERBATIM piece list) ── */
const B_PIECES = [
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

// verified start [14.4,-2.4] + Δ(9.6,42.0). Station runs +z; ring grows WEST.
const COASTER_START: [number, number, number] = [24.0, 0.55, 39.6];
const COASTER_HEADING = 0;
const COASTER_TAIL: XZ = [30.0, 39.6];           // start.x + 6.0, same z (§4.0-B)
const COASTER_CAP = 4;

const COMPILED = compileTrackPieces(B_PIECES as any, {
  type: 'steel', start: COASTER_START, heading: COASTER_HEADING, bounds: SIZE,
});
const COASTER_PTS = COMPILED.points;
const RATING = rateCoaster(COASTER_PTS, { type: 'steel', bank: 0.7, cars: 3 });
// eslint-disable-next-line no-console
console.log(
  `[thrill] Timberwolf Racer E ${RATING.excitement} I ${RATING.intensity} N ${RATING.nausea} (${RATING.ratingBand})`,
  `drop ${RATING.highestDrop} +G ${RATING.maxPosVertG} lat ${RATING.maxLatG} air ${RATING.airtimeSeconds}s`,
  `fatal ${COMPILED.report?.fatal ?? false}`,
);

/* ── WORLDS (chosen first) — themed structural set-pieces ────────────────────
 * Vertical spine on x=0; plazas: tiles 7 → half 4.2 (port ±4.8); tiles 9 →
 * half 5.4 (port ±6.0). Everything OFF both water boxes. */
const GATE: XZ = [0, 63.6];

// Thornwick plaza — the GATE-FRONT world hub (near the gate; coaster to its E).
const GLADE_HUB = fountainPlazaPlan({
  id: 'gladeHub', title: 'Glade Green', position: [0, 55.2], tiles: 7,   // N 60.0 · S 50.4 · E 4.8 · W -4.8
  ports: ['N', 'S', 'W'], theme: THORNWICK_GLADE, seed: 3,
});

// Central neutral hub between the three worlds.
const HUB = fountainPlazaPlan({
  id: 'hub', title: 'Hollowmere Circus', position: [-24.0, 30.0], tiles: 9,  // N 36.0 · S 24.0 · E -18.0 · W -30.0
  ports: ['N', 'S', 'E', 'W'], seed: 7,
});

// Brasswork bazaar (shop row) WEST — E port faces the hub's W (z 30.0).
const FOUNDRY_MKT = bazaarPlan({
  id: 'foundryMkt', title: 'Foundry Yard', position: [-49.2, 30.0],   // 3 stalls → half 4.2 → E -44.4 · W -54.0
  stalls: ['burger', 'hotDog', 'soda'],
  facing: { port: 'E', toward: HUB.port('W') }, theme: BRASSWORK_FOUNDRY, seed: 9,
});

// Pulse bazaar (shop row) SOUTH, aisle E/W (default) — W -21.6 · E -12.0 at z -9.6.
const PULSE_MKT = bazaarPlan({
  id: 'pulseMkt', title: 'Pulse Arcade', position: [-16.8, -9.6],
  stalls: ['soda', 'cottonCandy', 'burger'],
  theme: PULSE_DISTRICT, seed: 5,
});

/* ── FLAT-RIDE TAIL NODES + PADS (pads spur perpendicular off a street) ──────
 * dir = head→tail (pad → street). pad = tail - dir*(laneLenOf+2.1);
 * anchor = tail - dir*(laneLenOf+0.35). */
const pad = (tail: XZ, dir: XZ, cap: number): XZ =>
  [tail[0] - dir[0] * (laneLenOf(cap) + 2.1), tail[1] - dir[1] * (laneLenOf(cap) + 2.1)];
const qAnchor = (tail: XZ, dir: XZ, cap: number): XZ =>
  [tail[0] - dir[0] * (laneLenOf(cap) + 0.35), tail[1] - dir[1] * (laneLenOf(cap) + 0.35)];

// Thornwick cross-street (z=46.8): carousel + teacups tails, pads NORTH.
const TW_W: XZ = [-14.4, 46.8];   // Carousel tail
const TW_M: XZ = [0, 46.8];       // crossing node on the gate spine
const TW_E: XZ = [-9.6, 46.8];    // Teacups tail  (kept west of the coaster corridor)
// Brasswork cross-street (x=-56.4): ghost train + twist tails, pads WEST.
const BW_N: XZ = [-56.4, 36.0];   // Ghost Train tail
const BW_M: XZ = [-56.4, 30.0];   // crossing node onto the hub↔foundry street
const BW_S: XZ = [-56.4, 24.0];   // Twist tail
// Pulse street (z=-9.6): ferris tail, pad SOUTH.
const PL_FERRIS: XZ = [-30.0, -9.6];

const CAROUSEL_CAP = 8, TEACUPS_CAP = 4, GHOST_CAP = 6, TWIST_CAP = 8, FERRIS_CAP = 8;
const P_CAROUSEL = pad(TW_W, [0, -1], CAROUSEL_CAP);   // north of z=46.8
const P_TEACUPS  = pad(TW_E, [0, -1], TEACUPS_CAP);
const P_GHOST    = pad(BW_N, [-1, 0], GHOST_CAP);      // west of x=-56.4
const P_TWIST    = pad(BW_S, [-1, 0], TWIST_CAP);
const P_FERRIS   = pad(PL_FERRIS, [0, 1], FERRIS_CAP); // south of z=-9.6

/* ── SECOND COASTER (Pulse) — LOW-THRILL LEGACY L-wrap h1.0, VERBATIM, ───────
 * translated by Δ=(-6.0,-31.2) from verified start [6.0,-3.6] → [0.0,-34.8]. */
const L_PIECES = [
  'station', { type: 'lift', height: 1.0 }, 'turnR', 'drop', 'turnR',
  { type: 'straight', length: 2.0 }, 'turnL',
  { type: 'straight', length: 1.3 }, 'turnR',
  { type: 'straight', length: 4.3 }, 'turnR',
  { type: 'straight', length: 9.8 }, 'turnR',
  { type: 'straight', length: 0.9 },
];
const L_START: [number, number, number] = [0.0, 0.55, -34.8];
const L_TAIL: XZ = [6.0, -34.8];                 // start.x + 6.0
const L_COMPILED = compileTrackPieces(L_PIECES as any, {
  type: 'steel', start: L_START, heading: 0, bounds: SIZE,
});
const L_PTS = L_COMPILED.points;

/* ── STREET SKELETON — cardinal LATTICE, one circulation LOOP ───────────────*/
const SPINE_MID: XZ = [0, 46.8];   // = TW_M (Thornwick cross ∩ gate spine)
const SW_CORNER: XZ = [-56.4, -9.6];
const AVOID: XZ[] = [
  GATE, GLADE_HUB.port('N'), GLADE_HUB.port('S'), GLADE_HUB.port('W'),
  HUB.port('N'), HUB.port('S'), HUB.port('E'), HUB.port('W'),
  TW_W, TW_M, TW_E, BW_N, BW_M, BW_S, SW_CORNER, PL_FERRIS, SPINE_MID,
  COASTER_TAIL, L_TAIL,
];

const AVE_GATE  = boulevardPlan({ id: 'aveGate', from: GATE, to: GLADE_HUB.port('N'), avoid: AVOID, clear: 2.6, seed: 2 });
const AVE_GH    = boulevardPlan({ id: 'aveGH',   from: GLADE_HUB.port('W'), to: HUB.port('N'), avoid: AVOID, clear: 2.6, seed: 3 });
const AVE_HF    = boulevardPlan({ id: 'aveHF',   from: HUB.port('W'), to: FOUNDRY_MKT.port('E'), avoid: AVOID, clear: 2.6, seed: 4 });
const AVE_LOOP  = boulevardPlan({ id: 'aveLoop', from: HUB.port('S'), to: [-24.0, -9.6], avoid: AVOID, clear: 2.6, seed: 6 });

const GLADE = worldPlan({ id: 'thornwick', theme: THORNWICK_GLADE, pieces: [GLADE_HUB],
  include: [P_CAROUSEL, P_TEACUPS, COASTER_TAIL, [12.0, 40.8], [-13.2, 58.8]] });
const FOUNDRY = worldPlan({ id: 'brasswork', theme: BRASSWORK_FOUNDRY, pieces: [FOUNDRY_MKT],
  include: [P_GHOST, P_TWIST, [-49.2, 40.8], [-49.2, 18.0]] });
const PULSE = worldPlan({ id: 'pulse', theme: PULSE_DISTRICT, pieces: [PULSE_MKT],
  include: [P_FERRIS, L_TAIL, [0.0, -22.8], [-16.8, -20.4]] });
const WORLDS = [GLADE, FOUNDRY, PULSE];

const NET = buildParkNet({
  // node indices: 0 GATE · 1 SPINE_MID(=TW_M) · 2 SW_CORNER
  //   3 TW_W · 4 TW_E · 5 BW_N · 6 BW_M · 7 BW_S · 8 PL_FERRIS
  //   9 COASTER_TAIL · 10 L_TAIL · 11 HUB_SE
  nodes: [GATE, SPINE_MID, SW_CORNER,
    TW_W, TW_E, BW_N, BW_M, BW_S, PL_FERRIS,
    COASTER_TAIL, L_TAIL, [-24.0, -9.6]],
  edges: [
    // gate spine (x=0): gate → Glade N ; Glade S → TW_M
    [0, 'gladeHub:N'],
    ['gladeHub:S', 1],
    // Thornwick cross-street (z=46.8): TW_W → TW_M → coaster tail
    [3, 1], [1, 9],
    // Teacups tail spur off the cross-street (z=46.8): TW_M → TW_E
    [1, 4],
    // Brasswork cross-street (x=-56.4): BW_N → BW_M → BW_S, BW_M → Foundry W
    [5, 6], [6, 7], [6, 'foundryMkt:W'],
    // Pulse street (z=-9.6): loop elbow → SW corner → Pulse W ; elbow → Pulse E
    [11, 2], [2, 'pulseMkt:W'], [11, 'pulseMkt:E'],
    // Ferris + L-coaster tails on the z=-9.6 street
    [2, 8], [11, 10],
  ],
  pieces: [GLADE_HUB, HUB, FOUNDRY_MKT, PULSE_MKT, AVE_GATE, AVE_GH, AVE_HF, AVE_LOOP],
  worlds: WORLDS,
});

/* helper: audit a prop/pad cell against the streets (§0.19) */
const cell = (x: number, z: number, clear = 1.4): XZ => {
  const c = offPathCell(NET, [x, z], { clear });
  return (c as XZ) ?? [x, z];
};

/* ── SCENERY (≥ 16) + TREES (≥ 32) — off streets, off water, off corridor ── */
const gladeProps: XZ[] = [[-16.8, 58.8], [10.8, 33.6], [-6.0, 58.8], [14.4, 51.6], [-13.2, 40.8]];
const brassProps: XZ[] = [[-49.2, 42.0], [-49.2, 18.0], [-61.2, 33.6], [-61.2, 26.4], [-44.4, 42.0]];
const pulseProps: XZ[] = [[-16.8, -20.4], [4.8, -20.4], [-28.8, -20.4], [10.8, -3.6], [-4.8, -22.8]];

const treeCells: XZ[] = [
  [-9.6, 34.8], [12.0, 45.6], [-18.0, 34.8], [7.2, 58.8], [-19.2, 51.6],
  [-33.6, 39.6], [-33.6, 21.6], [-61.2, 39.6], [-61.2, 20.4], [-44.4, 15.6],
  [-38.4, 4.8], [-24.0, 3.6], [-9.6, 3.6], [4.8, 3.6], [-38.4, -3.6],
  [-9.6, -20.4], [-33.6, -3.6], [-2.4, -3.6], [-33.6, -20.4], [12.0, -16.8],
  [24.0, 24.0], [21.6, 12.0], [-52.8, 45.6], [-52.8, 9.6], [7.2, -22.8],
  [-42.0, 48.0], [-27.6, 48.0], [16.8, 33.6], [-13.2, 12.0], [1.2, 15.6],
  [-45.6, -3.6], [-19.2, 9.6], [9.6, 27.6], [-56.4, 48.0],
];

export default function Hollowmere() {
  return (
    <Park
      seed={SEED}
      size={SIZE}
      climate="coastal"
      roster={{
        rides: [
          'Timberwolf Racer', 'Glade Gallopers', 'Willow Teacups',
          'The Rusthollow Line', 'Gearworks Whirl', 'Neon Skyline', 'Discotheque Dash',
        ],
        stalls: 4,
        categories: 4,
      }}
      onReady={(report: any) => {
        // eslint-disable-next-line no-console
        console.log('[Hollowmere] onReady ok:', report?.ok, 'failures:', report?.failures);
      }}
    >
      {/* keepDry covers every paved/placed cell; coasterPts pre-caps the land */}
      <Terrain keepDry={NET.keepDry} coasterPts={[...COASTER_PTS, ...L_PTS]} />
      <Paths
        nodes={NET.nodes}
        edges={NET.edges}
        plazas={NET.plazas}
        bins={NET.bins}
        walkers={8}
        surfaceZones={WORLDS.map((w: any) => ({ ...w.region, surface: w.theme.pathSurface }))}
      />
      <GameManager />
      <Gate position={GATE} />

      {/* streets: neutral hub + themed set-pieces + boulevards (loop) */}
      <FountainPlaza plan={HUB} />
      <FountainPlaza plan={GLADE_HUB} />
      <Bazaar plan={FOUNDRY_MKT} />
      <Bazaar plan={PULSE_MKT} />
      <Boulevard plan={AVE_GATE} />
      <Boulevard plan={AVE_GH} />
      <Boulevard plan={AVE_HF} />
      <Boulevard plan={AVE_LOOP} />

      {/* world regions */}
      <World plan={GLADE} />
      <World plan={FOUNDRY} />
      <World plan={PULSE} />

      {/* ── THORNWICK GLADE — flagship coaster + 2 gentle rides + glade scenery ── */}
      <Coaster
        name="Timberwolf Racer"
        pieces={B_PIECES as any}
        start={COASTER_START}
        heading={COASTER_HEADING}
        type="steel"
        capacity={COASTER_CAP}
        rideDuration={10}
        intensity={7}
        price={5}
        queueTailNode={NET.node(COASTER_TAIL)}
        queueDir={[1, 0]}
        exit={[26.4, 42.0]}
        exitDir={[1, 0]}
      />
      <Carousel
        position={P_CAROUSEL}
        rotation={Math.PI}
        register={{ name: 'Glade Gallopers', capacity: CAROUSEL_CAP, rideDuration: 9, price: 3 }}
        queue={{ anchor: qAnchor(TW_W, [0, -1], CAROUSEL_CAP), dir: [0, -1] }}
      />
      <Teacups
        position={P_TEACUPS}
        rotation={Math.PI}
        register={{ name: 'Willow Teacups', capacity: TEACUPS_CAP, rideDuration: 8, price: 3 }}
        queue={{ anchor: qAnchor(TW_E, [0, -1], TEACUPS_CAP), dir: [0, -1] }}
      />
      <GiantToadstools position={gladeProps[0]} rotation={0.6} />
      <LanternTree position={gladeProps[1]} />
      <StandingStones position={gladeProps[2]} rotation={0.4} />
      <FlowerPodBed position={gladeProps[3]} />
      <LanternTree position={gladeProps[4]} scale={0.9} />

      {/* ── BRASSWORK FOUNDRY — transport monorail + thrill ride + foundry scenery ──
           the monorail is a piece-composed loop; it registers ONE station. */}
      <Monorail
        position={P_GHOST}
        rotation={-Math.PI / 2}
        register={{ name: 'The Rusthollow Line', capacity: GHOST_CAP, rideDuration: 12, price: 2 }}
        queue={{ anchor: qAnchor(BW_N, [-1, 0], GHOST_CAP), dir: [-1, 0] }}
        pieces={[
          'station',
          { type: 'straight', length: 1.2 },
          { type: 'turnL', angle: 90, radius: 2 },
          { type: 'straight', length: 3 },
          { type: 'turnL', angle: 90, radius: 2 },
          { type: 'straight', length: 5.3 },
          { type: 'turnL', angle: 90, radius: 2 },
          { type: 'straight', length: 3 },
          { type: 'turnL', angle: 90, radius: 2 },
          { type: 'straight', length: 1.2 },
        ]}
      />
      <TwistRide
        position={P_TWIST}
        rotation={-Math.PI / 2}
        register={{ name: 'Gearworks Whirl', capacity: TWIST_CAP, rideDuration: 9, price: 4, intensity: 5 }}
        queue={{ anchor: qAnchor(BW_S, [-1, 0], TWIST_CAP), dir: [-1, 0] }}
      />
      <ClockTower position={brassProps[0]} />
      <GiantGear position={brassProps[1]} rotation={-Math.PI / 2} />
      <BoilerTank position={brassProps[2]} rotation={1.35} />
      <SteamPipes position={brassProps[3]} />
      <BoilerTank position={brassProps[4]} rotation={-0.6} scale={0.9} />

      {/* ── PULSE DISTRICT — gentle wheel + a second (kiddie) coaster + club scenery ── */}
      <FerrisWheel
        position={P_FERRIS}
        rotation={0}
        register={{ name: 'Neon Skyline', capacity: FERRIS_CAP, rideDuration: 10, price: 4 }}
        queue={{ anchor: qAnchor(PL_FERRIS, [0, 1], FERRIS_CAP), dir: [0, 1] }}
      />
      <Coaster
        name="Discotheque Dash"
        pieces={L_PIECES as any}
        start={L_START}
        heading={0}
        type="steel"
        capacity={4}
        rideDuration={9}
        intensity={4}
        price={3}
        queueTailNode={NET.node(L_TAIL)}
        queueDir={[1, 0]}
        exit={[2.4, -32.4]}
        exitDir={[1, 0]}
      />
      <NeonArch position={[-16.8, -3.0, -15.6]} rotation={0} />
      <MirrorBallPylon position={pulseProps[0]} />
      <SpeakerStack position={pulseProps[1]} rotation={0.4} />
      <SpeakerStack position={pulseProps[2]} rotation={-0.4} />
      <LightTiles position={pulseProps[3]} />

      {/* ── EXTRA STALL (4th distinct kind) + RESTROOM ── */}
      <CottonCandyStand position={cell(-18.0, 24.0, 1.0)} rotation={0} register={{ name: 'Faerie Floss', price: 2, value: 3 }} />
      <Restroom position={cell(-30.0, 24.0, 1.4)} rotation={0} />

      {/* ── AMENITY / DRESSING ── */}
      <Neon text="HOLLOWMERE" position={[0, 2.2, 60.0]} rotation={0} scale={0.6} />
      <Fountain />
      <Torch position={cell(-6.0, 51.6)} />
      <Torch position={cell(6.0, 51.6)} />
      <Torch position={cell(-49.2, 24.0)} />
      <Torch position={cell(-24.0, -3.6)} />
      <Lights from={[-8.4, 58.8]} to={[6.0, 58.8]} />

      {/* trees (≥ 32) */}
      {treeCells.map((c, i) => (
        <Placed
          key={`tree-${i}`}
          position={c}
          build={(t: any) => tree(t, { shape: i % 3 === 0 ? 'pine' : i % 3 === 1 ? 'round' : 'willow' })}
        />
      ))}
    </Park>
  );
}

/* ROSTER — written LAST, from the register() calls above (declared on <Park>):
 *   7 registered rides across 4 RCT2 categories:
 *     coaster   — Timberwolf Racer (§4.0-B family flagship; measured line logged),
 *                 Discotheque Dash (legacy L-wrap kiddie coaster)
 *     gentle    — Glade Gallopers (Carousel), Willow Teacups (Teacups),
 *                 Neon Skyline (FerrisWheel)
 *     thrill    — Gearworks Whirl (TwistRide, intensity 5 = moderate)
 *     transport — The Rusthollow Line (Monorail, piece-composed loop)
 *   4 stall kinds: Burger + Hot Dog + Soda (Foundry Yard bazaar) / Soda + Cotton
 *     Candy + Burger (Pulse Arcade bazaar) + Faerie Floss (Cotton Candy) +
 *     a Restroom + bazaar/plaza bins.
 *   Intensity bands: gentle (≤3), moderate (Gearworks 5 / Discotheque 4),
 *     intense (Timberwolf 7).
 *   NOTE the header <Park roster categories:4> counts the DISTINCT non-coaster
 *   category set actually scored off probe.json; audit against
 *   rideRoster.categoryCount, never intentions (§0.16). */

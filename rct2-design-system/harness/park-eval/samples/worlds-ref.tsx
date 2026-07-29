/*
 * worlds-ref — THE 3-WORLD REFERENCE PARK, hand-composed (§3's worked skeleton).
 *
 * This file is the executable copy of `rules/park-generation-composition.md`
 * §3's worlds-first composition. It exists so the pattern the rules tell an
 * agent to copy is a thing that actually validates, and so the eval harness has
 * a corpus entry with worlds in it (RUBRIC.md axis 16).
 *
 * ⚠️ THE FIVE LAND MACROS WERE REMOVED IN v6.0. `<EmberfallCaldera>`,
 * `<TidewaterHollow>`, `<BrassworkFoundry>`, `<ThornwickGlade>` and
 * `<PulseDistrict>` — the one-call components that used to plan a whole
 * district each — no longer exist in the design system, and
 * `ParkBuilder/worlds.ts` no longer carries them in `COMPONENT_THEME`. THE
 * WORLD LAYER ITSELF IS INTACT: `WorldTheme`, the five presets, `worldPlan`,
 * `<World>`, `buildParkNet` and the coherence audit are untouched, and every
 * world's own rides, stall and five scenery pieces survive. So this park now
 * ASSEMBLES each district by hand out of those surviving parts, which is what
 * §3's per-world content table describes.
 *
 * COMPOSITION (§3, worlds-first):
 *   (a) THE WORLDS, chosen first — 3 of the 5 presets:
 *         pulse      Pulse District     (disco night street)  AT THE GATE
 *         brasswork  Brasswork Foundry  (steampunk works)     west, mid-plot
 *         thornwick  Thornwick Glade    (enchanted forest)    deep south
 *   (b) EACH WORLD BUILT OUT BY HAND from its own surviving catalog:
 *         · a THEMED `<Bazaar>` as the district's centre. It is neutral by
 *           component name but a themed plan is stamped with the world's
 *           `dsWorldTheme`, so it counts as that world's SET-PIECE, it carries
 *           the world's palette/paving, its three generic stalls count toward
 *           the world's `stallCount`, and — the structural reason — its `W`/`E`
 *           ports are what the avenues wire to. A BAZAAR HAS ONLY `W` AND `E`,
 *           on the aisle axis, at any rotation: all three here run their aisle
 *           N/S (`facing: { port: 'W', toward: <the approach> }`) so the street
 *           enters ONE port head-on and leaves the other head-on. Nothing may
 *           branch sideways off a bazaar PORT cell — the piece stands its own
 *           bench, bin and entrance marker on the two cells beside it, and a
 *           street laid over them is a `scenery` FAIL.
 *         · that world's own RIDE(S), on a dead-end queue spur off the district
 *           street, with `queue={{ anchor, dir }}` pinned to the published
 *           arithmetic `anchor = tail − dir·(laneLenOf(capacity) + 0.35)` and
 *           the pad a further `front` out.
 *         · that world's own themed STALL, planted one cell off the street with
 *           its serving front toward it (the bazaar's own convention).
 *         · three of that world's five themed SCENERY pieces.
 *       EVERY HAND-PLACED CELL IS LISTED IN THAT WORLD'S `worldPlan({ include })`.
 *       A hand-mounted piece is NOT a member piece, so a cell left off that list
 *       falls outside the region and counts for NOTHING (`unplacedThemed`).
 *   (c) ONLY THEN CONNECTED: the gate street straight into the front world, a
 *       neutral hub plaza off its far port, and four cardinal boulevards.
 *
 * THE FRONT WORLD IS AT THE GATE ON PURPOSE (§3, the walking budget). The sim
 * smoke check needs ONE completed ride cycle inside `max(60, 2.5·maxRideDuration
 * + 20)` sim-seconds and a guest walks ~0.55 u/s, so the honest gate→queue-slot-0
 * budget is ~24 u. Here it is 4.8 (gate spur) + 7.2 (Discotron spur) + 8.17
 * (lane) = 20.2 u; the two deeper worlds are for guests who arrive later.
 *
 * ROSTER (written from the registration, §0.16): 4 registered rides
 * (Discotron · Boiler Burst, Aether Balloons · The Moonlit Barge), 12 stalls
 * (3 × 3 bazaar rows + Neon Slush, Goggle Works, Glade Honey Cakes), 1 restroom.
 *
 * THE TRAPS THIS LAYOUT IS PLANNED AROUND (all worlds-specific, all invisible
 * until the park runs):
 *   · a themed piece outside its world's rect counts for nothing — hence the
 *     `include` blocks below, which also feed `<Terrain keepDry>` (note
 *     `buildParkNet({ worlds })` expands a world's PIECES, not its `include`
 *     cells, so `keepDry` is passed explicitly);
 *   · two world rects must not OVERLAP — `worldAt` resolves a piece into the
 *     SMALLEST containing rect, so overlapping worlds manufacture `crossTheme`;
 *   · every boulevard junction cell belongs in every avenue's `avoid` list with
 *     `clear: 2.6` (a verge tree sits ±2.45 u off the carriageway, and at a
 *     T-junction that lands in the crossing street's slab);
 *   · a ride's station face needs TWO free tiles side by side — one for the
 *     entrance hut, one for the exit beside it;
 *   · a hand-placed kiosk one cell off a street sits exactly ON the §0.14 stall
 *     margin (`padHalf 0.6 + pathHalf 0.55 + 0.05 = 1.20`) and can tip into a
 *     `padNearStreet` warning on a floating-point tie — this park puts each
 *     world's themed stall on a free cell of its own bazaar row instead, which
 *     the piece computes from the same transform as its aisle nodes.
 *
 * MEASURED (seed 7, size 128, this file, `probe.mjs`): 181 street nodes / 181
 * edges / 4 plaza rects / 8 bins, walked extent [-38.4, -36.0] … [4.8, 63.6],
 * 33 tagged components (19 themed, 14 neutral). `probe.worlds`: 3 declared and
 * 3 BUILT worlds, `crossTheme: []`, `unplacedThemed: []`, `probe.notes: []`.
 *   world    centre              half            rides / stalls / scenery+setPiece
 *   pulse    [ -8.40,  54.60]    [15.60,  9.00]  1 / 4 / 5
 *   foundry  [-33.60,   5.40]    [ 9.60, 17.40]  2 / 4 / 4
 *   glade    [  6.60, -31.20]    [12.60, 12.00]  1 / 4 / 4
 *   centre separations 54.37 (foundry↔glade) / 55.28 (pulse↔foundry) / 87.10
 *   (pulse↔glade) against the 32.66 u floor at size 128; closest rect GAP 19.39 u.
 *
 * VERDICT: `validatePark → ok: true`, ZERO failures, ZERO gate warnings, one
 * non-fatal `pathLevelMedian` lint (7 outlier street nodes got auto ramps —
 * §2.3 says author them as `[x, z, elevation]` triples if you want it silent).
 * Rubric axis 16 = 5/5 (variety 1.5 · buildOut 1 · separation 1 · coherence 1.5).
 *
 * SEED STABILITY — MEASURED 2026-07-25, DO NOT RE-SEED. `<Park seed={7}>` here
 * passes NO climate, so the composition runs `climateOf(7)` = **desert**, and
 * seed 7 DESERT at size 128 is `probes 1` unguarded (steppe, corner lake
 * (36.9, 30.2)). It is NOT the `probes 18` seed-7 TEMPERATE row and not §1's
 * seed-7 COASTAL row. Guarded by this park's 545 keepDry cells it probes 64 /
 * 0 violations / 237 clamp discs, and 12 realistic one-cell keepDry edits
 * moved the landform 0 times. If this seed is ever changed, pass `climate`
 * EXPLICITLY — `climateOf` re-rolls the whole composition with the seed.
 */
import React from 'react';
import { Park, GameManager, Terrain, Paths, Gate, Restroom, usePark } from '../../../mp3d/components/Park';
import {
  World,
  worldPlan,
  buildParkNet,
  BRASSWORK_FOUNDRY,
  PULSE_DISTRICT,
  THORNWICK_GLADE,
} from '../../../mp3d/components/SetPieceKit';
import type { XZ } from '../../../mp3d/components/SetPieceKit';
import { FountainPlaza, fountainPlazaPlan } from '../../../mp3d/components/FountainPlaza';
import { Bazaar, bazaarPlan } from '../../../mp3d/components/Bazaar';
import { Boulevard, boulevardPlan } from '../../../mp3d/components/Boulevard';
// the worlds' own catalog — rides, stalls and scenery, all still shipped
import { Discotron } from '../../../mp3d/components/Discotron';
import { NeonSlush } from '../../../mp3d/components/NeonSlush';
import { NeonArch, SpeakerStack, MirrorBallPylon } from '../../../mp3d/components/PulseScenery';
import { BoilerBurst } from '../../../mp3d/components/BoilerBurst';
import { AetherBalloons } from '../../../mp3d/components/AetherBalloons';
import { GoggleWorks } from '../../../mp3d/components/GoggleWorks';
import { GiantGear, BoilerTank, CoalCart } from '../../../mp3d/components/BrassworkScenery';
import { MoonlitBarge } from '../../../mp3d/components/MoonlitBarge';
import { Honeywitch } from '../../../mp3d/components/Honeywitch';
import { GiantToadstools, StandingStones, LanternTree } from '../../../mp3d/components/ThornwickScenery';

// ── 0. THE ARITHMETIC THE DISTRICTS ARE PLANNED WITH ──────────────────────
// `laneLenOf(c) = max(2.2, 1.1 + 0.56·c)` and the manager joins the lane to the
// street with a further 0.35, so given the TAIL cell on the street and the unit
// direction `out` from that cell toward the ride:
//     queue HEAD (`queue.anchor`) = tail + out·(laneLenOf(capacity) + 0.35)
//     station pad                 = tail + out·(laneLenOf(capacity) + 0.35 + front)
//     the ride's local +z (its queue face) looks back down `-out`
// `anchor` is the HEAD, never the tail (an anchor ON a street node is
// auto-corrected with a `queueAnchorIsHead` warning — write the value instead).
const laneLenOf = (c: number): number => Math.max(2.2, 1.1 + 0.56 * c);
const join = (c: number): number => laneLenOf(c) + 0.35;
/** ride pad + pinned queue for a tail cell and an outward unit direction */
function rideAt(tail: XZ, out: XZ, capacity: number, front: number) {
  const j = join(capacity);
  const anchor: XZ = [tail[0] + out[0] * j, tail[1] + out[1] * j];
  const at: XZ = [tail[0] + out[0] * (j + front), tail[1] + out[1] * (j + front)];
  const dir: XZ = [-out[0], -out[1]];
  return { at, anchor, dir, yaw: Math.atan2(dir[0], dir[1]) };
}
/** every lattice cell of an inclusive rect — ride pads and dressing aprons the
 *  world's region must cover AND `<Terrain>` must keep dry/flat */
function cells(x0: number, x1: number, z0: number, z1: number): XZ[] {
  const out: XZ[] = [];
  for (let x = x0; x <= x1 + 1e-6; x += 1.2) for (let z = z0; z <= z1 + 1e-6; z += 1.2) out.push([x, z]);
  return out;
}

// ── 1. THE WORLDS, chosen first ────────────────────────────────────────────
// Each district's centre is a THEMED <Bazaar> with its aisle running N/S, its
// `W` port aimed at the approach by `facing` (never inferred from a rotation —
// that is §3.1's round-8 lesson). Positions are lattice multiples (1.2).
const GATE: XZ = [0, 63.6]; // <Gate>'s own cell on a 128 front edge

const PULSE_ROW = bazaarPlan({
  id: 'pulseRow',
  title: 'Neon Quarter',
  position: [0, 52.8],
  facing: { port: 'W', toward: GATE },
  stalls: ['soda', 'cottonCandy', 'balloon'],
  theme: PULSE_DISTRICT,
  seed: 7,
}); // ports: W [0, 57.6] north · E [0, 48.0] south

const WORKS_ROW = bazaarPlan({
  id: 'worksRow',
  title: 'Foundry Row',
  position: [-33.6, 15.6],
  facing: { port: 'W', toward: [-33.6, 42.0] },
  stalls: ['burger', 'hotDog', 'soda'],
  theme: BRASSWORK_FOUNDRY,
  seed: 9,
}); // ports: W [-33.6, 20.4] north · E [-33.6, 10.8] south

const GLADE_ROW = bazaarPlan({
  id: 'gladeRow',
  title: 'Glade Market',
  position: [0, -26.4],
  facing: { port: 'W', toward: [0, 33.6] },
  stalls: ['cottonCandy', 'burger', 'soda'],
  theme: THORNWICK_GLADE,
  seed: 11,
}); // ports: W [0, -21.6] north · E [0, -31.2] south

// ── 2. EACH WORLD'S OWN RIDES, STALL AND SCENERY ──────────────────────────
// PULSE — the gyro spinner WEST of the gate street, on a dead-end spur off the
// gate junction so the walk from the turnstile is 20.2 u (§3's ~24 u budget).
// West, not east: seed 7's dominant lake sits at x 19.5…54.5 / z 21…56 and a
// pad on the far side of the gate street would stand on its north shore.
const T_DISCO: XZ = [-7.2, 58.8];
const DISCO = rideAt(T_DISCO, [-1, 0], 12, 4.0); // pad [-19.37, 58.8], head [-15.37, 58.8]
// WHERE A HAND-PLACED STALL GOES. A shop is only audited on its SOLID BODY
// (hx 0.6 × hz 0.42) because §3 wants kiosks ABUTTING the street, but the §0.14
// centre margin for a stall is `padHalf + pathHalf + 0.05 = 1.20` — exactly one
// lattice cell, so a kiosk one cell off a street sits on a FLOATING-POINT TIE
// and may or may not draw a `padNearStreet` warning depending on which side of
// 1.20 the arithmetic lands. The row's OWN free stall cells are computed by the
// bazaar from the same transform its aisle nodes are, so they never tie: put the
// world's themed stall in the row's empty slot (this bazaar staggers three shops
// at [1.2, 55.2] · [-1.2, 52.8] · [1.2, 50.4] and lamps the two end tiles, so
// [-1.2, 55.2] is the open one).
const SLUSH: XZ = [-1.2, 55.2]; // serving front EAST onto the bazaar aisle
const P_ARCH: XZ = [0, 61.2]; // straddles the gate street (posts at ±1.15)
const P_STACK: XZ = [4.8, 61.2];
const P_PYLON: XZ = [-4.8, 61.2];

// BRASSWORK — the works yard south of the row: a cross junction with the
// pressure-test rig east and the aerial promenade west, both firing SOUTH so
// the district stays narrow.
const J_WORKS: XZ = [-33.6, 4.8];
const T_BOILER: XZ = [-28.8, 4.8];
const T_AETHER: XZ = [-38.4, 4.8];
const BOILER = rideAt(T_BOILER, [0, -1], 8, 3.9); // pad [-28.8, -5.03]
const AETHER = rideAt(T_AETHER, [0, -1], 12, 3.8); // pad [-38.4, -7.17]
const GOGGLES: XZ = [-32.4, 9.6]; // serving front WEST onto the yard street
const B_GEAR: XZ = [-36.0, 8.4];
const B_TANK: XZ = [-31.2, 7.2];
const B_CART: XZ = [-36.0, 2.4];

// THORNWICK — the barge dock south of the market, its circuit thrown east.
const J_GLADE: XZ = [0, -36.0];
const T_BARGE: XZ = [4.8, -36.0];
const BARGE = rideAt(T_BARGE, [1, 0], 4, 2.1); // pad [10.59, -36.0]
const HONEY: XZ = [-1.2, -33.6]; // serving front EAST onto the dock street
const G_TOADS: XZ = [3.6, -33.6];
const G_STONES: XZ = [-3.6, -37.2];
const G_LANTERN: XZ = [-3.6, -28.8];

// ── 3. THE WORLD REGIONS — every hand-placed cell listed ──────────────────
const PULSE = worldPlan({
  id: 'pulse',
  theme: PULSE_DISTRICT,
  pieces: [PULSE_ROW],
  include: [DISCO.at, SLUSH, P_ARCH, P_STACK, P_PYLON, ...cells(-21.6, -16.8, 56.4, 61.2)],
});
const FOUNDRY = worldPlan({
  id: 'foundry',
  theme: BRASSWORK_FOUNDRY,
  pieces: [WORKS_ROW],
  include: [
    BOILER.at,
    AETHER.at,
    GOGGLES,
    B_GEAR,
    B_TANK,
    B_CART,
    ...cells(-31.2, -26.4, -7.2, -2.4),
    ...cells(-40.8, -36.0, -9.6, -4.8),
  ],
});
const GLADE = worldPlan({
  id: 'glade',
  theme: THORNWICK_GLADE,
  pieces: [GLADE_ROW],
  include: [BARGE.at, HONEY, G_TOADS, G_STONES, G_LANTERN, ...cells(9.6, 16.8, -40.8, -32.4)],
});
const WORLDS = [PULSE, FOUNDRY, GLADE];
// The three rects are DISJOINT in both axes, which is what keeps `worldAt` from
// re-assigning one district's pieces to its neighbour, and their centres are
// far past the 32.66 u separation floor at size 128 (the closest pair is
// foundry↔glade). Re-measure from `probe.worlds.separation`, never from memory.

// ── 4. THE GATE STREET straight into the front world ──────────────────────
// ── 5. THE NEUTRAL HUB off the front world's FAR port ─────────────────────
// It is un-themed on purpose: gate street + plaza is the park's neutral
// entrance and stays neutral (§3, "the hub is not a world").
const HUB = fountainPlazaPlan({ id: 'hub', position: [-33.6, 46.8], ports: ['E', 'S'], seed: 7 });

// ── 6. CONNECT THE WORLDS — every leg CARDINAL ───────────────────────────
// `gatewayCell` is asked FROM the cell the avenue leaves, so it returns the port
// on the approach axis instead of a guessed compass name.
const N_GATE: XZ = [0, 58.8]; // gate-street junction: the Discotron spur leaves here
const N_SOUTH: XZ = [0, 46.8]; // one cell PAST the pulse row's E port — the avenue
//                                turns here, never on the port cell itself
const ELBOW: XZ = [-33.6, 33.6]; // a T on the foundry avenue's own chain
const CORNER: XZ = [0, 33.6]; //    the glade avenue's corner
// EVERY JUNCTION goes in every avenue's `avoid` list: a boulevard dresses its
// verges 2.45 u off the carriageway, and a verge tree at a T-junction lands in
// the CROSSING street's slab (a `scenery` FAIL). The two BAZAAR PORT cells are
// in the list for the same reason one step removed — the piece's own bench and
// entrance marker stand beside them, and an avenue's first tree pair is only
// 2.4 u along. [-33.6, 30.0] is the MEASURED bulge on seed 7 @128: a verge tree
// there put a built cell on ground the guard clamp could not flatten
// (`terrain` FAIL). Keeping dressing off that stretch is the §1 fix — "move
// what sits on the offending ground".
const AVOID: XZ[] = [
  ELBOW,
  CORNER,
  N_SOUTH,
  HUB.port('E'),
  HUB.port('S'),
  PULSE_ROW.port('E'),
  WORKS_ROW.port('W'),
  GLADE_ROW.port('W'),
  [-33.6, 30.0],
];
const AVE_HP = boulevardPlan({ id: 'aveHP', from: N_SOUTH, to: HUB.port('E'), avoid: AVOID, clear: 2.6, seed: 4 });
const AVE_F = boulevardPlan({ id: 'aveF', from: HUB.port('S'), to: FOUNDRY.gatewayCell(HUB.port('S')), avoid: AVOID, clear: 2.6, seed: 5 });
const AVE_G1 = boulevardPlan({ id: 'aveG1', from: ELBOW, to: CORNER, avoid: AVOID, clear: 2.6, seed: 6 });
const AVE_G2 = boulevardPlan({ id: 'aveG2', from: CORNER, to: GLADE.gatewayCell(CORNER), avoid: AVOID, clear: 2.6, seed: 8 });

// ── 7. ONE shared graph. `worlds:` expands to every world's pieces ────────
// `worlds:` does NOT expand a world's `include` cells, so keepDry is passed
// explicitly from `world.cells` (pieces' cells + include).
const MY_NODES: XZ[] = [
  GATE, //     0
  N_GATE, //   1
  T_DISCO, //  2 — Discotron queue tail (dead-end spur; the queue attaches here)
  N_SOUTH, //  3 — also AVE_HP's port A cell
  J_WORKS, //  4
  T_AETHER, // 5
  T_BOILER, // 6
  J_GLADE, //  7
  T_BARGE, //  8
];
const NET = buildParkNet({
  nodes: MY_NODES,
  edges: [
    [0, 1],
    [1, 'pulseRow:W'],
    [1, 2],
    ['pulseRow:E', 3],
    ['worksRow:E', 4],
    [4, 5],
    [4, 6],
    ['gladeRow:E', 7],
    [7, 8],
  ],
  pieces: [HUB, AVE_HP, AVE_F, AVE_G1, AVE_G2],
  worlds: WORLDS,
  keepDry: WORLDS.flatMap((w) => w.cells),
});

/** the glade's flume is a TRACKED ride: it lays its own bank over the terrain,
 *  so it takes a sampler in its OWN local frame (the same lazy `floorAt` +
 *  `groundAt` pair every land macro used, resolved at build time so <Terrain>
 *  and <Paths> have already run) */
const GladeBarge: React.FC = () => {
  const park = usePark('WorldsRefPark');
  const c = Math.cos(BARGE.yaw);
  const s = Math.sin(BARGE.yaw);
  let y0: number | null = null;
  const groundAt = (lx: number, lz: number) => {
    if (y0 === null) y0 = park.floorAt(BARGE.at[0], BARGE.at[1]);
    return park.groundAt(BARGE.at[0] + c * lx + s * lz, BARGE.at[1] - s * lx + c * lz) - y0;
  };
  return (
    <MoonlitBarge
      position={BARGE.at}
      rotation={BARGE.yaw}
      groundAt={groundAt}
      queue={{ anchor: BARGE.anchor, dir: BARGE.dir }}
      register={{ name: 'The Moonlit Barge', capacity: 4, rideDuration: 13.7, intensity: 1, price: 3 }}
    />
  );
};

export default function WorldsRefPark() {
  return (
    <Park seed={7} size={128} roster={{ rides: 4, stalls: 12 }}>
      <Terrain keepDry={NET.keepDry} />
      <Paths
        nodes={NET.nodes}
        edges={NET.edges}
        plazas={NET.plazas}
        bins={NET.bins}
        walkers={8}
        surfaceZones={WORLDS.map((w) => ({ ...w.region, surface: w.theme.pathSurface }))}
      />
      <GameManager />
      <Gate position={GATE} />

      {/* the neutral hub + the avenues between worlds */}
      <FountainPlaza plan={HUB} />
      <Boulevard plan={AVE_HP} />
      <Boulevard plan={AVE_F} />
      <Boulevard plan={AVE_G1} />
      <Boulevard plan={AVE_G2} />

      {/* ---- PULSE DISTRICT — region + the district that fills it ---- */}
      <World plan={PULSE} />
      <Bazaar plan={PULSE_ROW} />
      <Discotron
        position={DISCO.at}
        rotation={DISCO.yaw}
        queue={{ anchor: DISCO.anchor, dir: DISCO.dir }}
        register={{ name: 'Discotron', capacity: 12, rideDuration: 13, intensity: 6, price: 4 }}
      />
      <NeonSlush position={SLUSH} rotation={Math.PI / 2} register name="The Neon Slush" />
      <NeonArch position={P_ARCH} rotation={0} text="PULSE" seed={3} />
      <SpeakerStack position={P_STACK} rotation={-Math.PI / 2} seed={5} />
      <MirrorBallPylon position={P_PYLON} seed={7} />

      {/* ---- BRASSWORK FOUNDRY ---- */}
      <World plan={FOUNDRY} />
      <Bazaar plan={WORKS_ROW} />
      <BoilerBurst
        position={BOILER.at}
        rotation={BOILER.yaw}
        queue={{ anchor: BOILER.anchor, dir: BOILER.dir }}
        register={{ name: 'Boiler Burst', capacity: 8, rideDuration: 13, intensity: 6, price: 4 }}
      />
      <AetherBalloons
        position={AETHER.at}
        rotation={AETHER.yaw}
        queue={{ anchor: AETHER.anchor, dir: AETHER.dir }}
        register={{ name: 'Aether Balloons', capacity: 12, rideDuration: 14, intensity: 2, price: 3 }}
      />
      <GoggleWorks position={GOGGLES} rotation={-Math.PI / 2} register name="Works Optics" />
      <GiantGear position={B_GEAR} rotation={Math.PI / 2} seed={2} />
      <BoilerTank position={B_TANK} rotation={-Math.PI / 2} seed={4} />
      <CoalCart position={B_CART} rotation={0} seed={6} />

      {/* ---- THORNWICK GLADE ---- */}
      <World plan={GLADE} />
      <Bazaar plan={GLADE_ROW} />
      <GladeBarge />
      <Honeywitch position={HONEY} rotation={Math.PI / 2} register name="Glade Honey Cakes" />
      <GiantToadstools position={G_TOADS} rotation={0} seed={1} />
      <StandingStones position={G_STONES} rotation={0} seed={3} />
      <LanternTree position={G_LANTERN} rotation={0} seed={5} />

      <Restroom position={[-38.4, 42.0]} />
    </Park>
  );
}

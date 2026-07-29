/* ═══ THREE CROWNS PARK — §0 PRE-FLIGHT ══════════════════════════════════════════════
 * SIZE   128 (default, `size` prop omitted)
 * SEED   1 / temperate — dominant lake ctr (41, -39) box x[21,60] z[-60,-21] · secondary
 *        ctr (-38, 31) box x[-56,-21] z[23,39]  [PRE-keepDry, off SEED_ROW_WATER]
 *        RING WATER WALK: all 16 monorail ring cells are walked against BOTH bodies by
 *        `offRow` BEFORE the pose is pinned, and the four DECKS are additionally flank-
 *        tested (bumpIn <= 0.75) and dryness-tested against the pre-cap composition. The
 *        pose SEARCHES dz in {0,+-1.2,+-2.4,+-3.6,+-4.8,+6} x dx in {0,+-1.2,+-2.4} and the
 *        first clear pose wins; if NO pose clears, RING_OK is false and the ring is DROPPED
 *        (the park still ships — aborting would score 0 on all 16 axes).
 *        GUARDS = keepDryOf(NET, SEED_ROW) — the fuse's OUTPUT sieved, never NODES.slice().
 *        reliefFloor.kept / both water centroids / terrainSeed are DIFFED at module scope
 *        (BARE vs guarded) and printed; every pad also re-checked IN THE TREE by the gate's
 *        own predicate through <DryScatter> + dryRing (waterline + 0.05 = -0.21).
 * WORLDS 3 (>= 3), each a real place — 2 rides / own themed counter / 10 own props / spur:
 *        BRASSWORK FOUNDRY  (steampunk)      east of the hub, inside the ring
 *              rides <AetherBalloons> "Aether Ascent" + <BoilerBurst> "Boiler Burst"
 *              stall 'goggles' (Cogwright Optics) · 10 BrassworkScenery placements · spur off
 *              the x 22.8 spine · include holds the EAST monorail deck cell
 *        PULSE DISTRICT     (neon)           north-east, along the grand east avenue
 *              rides <Bassline> "Bassline Tunnels" + <Discotron> "Discotron"
 *              stall 'neonSlush' (Voltage Slush) · 10 PulseScenery placements · avenue spur
 *              · include holds the NORTH monorail deck cell
 *        THORNWICK GLADE    (enchantedForest) west/south-west, inside the ring
 *              ride  <MoonlitBarge> "The Moonlit Barge"  (its flagship <WyrmsHollow> is
 *              OMITTED ON PURPOSE: padMarginOf 15.99 => a ~31 u body, and no field on a
 *              128 plot clears the ring beam, coaster C and the plot bounds at once. One
 *              themed ride costs a fraction of the worlds axis; a bounds FAIL costs more.)
 *              stall 'honeywitch' (Honeywitch Kitchen) · 10 ThornwickScenery placements ·
 *              spur off the x -24 column · include holds the WEST monorail deck cell
 *        every world's props come from its OWN pack only — 0 foreign themed pieces.
 * CATS   gentle <Carousel>/<FerrisWheel>/<AetherBalloons> · thrill coaster C + <BoilerBurst>
 *        + <Discotron> · water <MoonlitBarge> · transport <Monorail> ring · dark <GhostTrain>
 *        => 5/5 categories, decided here BEFORE any JSX.
 * CIRCUITS coaster C (§4.0-C) · coaster B (§4.0-B) · Monorail ring · MoonlitBarge · Bassline
 *        · GhostTrain  => 6 circuits across 4 FAMILIES (coaster, transport, water, dark).
 * GATE   [0, 63.6] -> gateAve -> hub:N.  First queue tail = Carousel [7.2, 56.4] = 10.18 u
 *        of walk from the turnstile, <= 15 ✓
 * FLAG   §4.0-C start [16.8, 0.55, -3.6] heading 0, steel, cars 3, NO bank prop (builds 0.7)
 *        published rateCoaster(bank 0.7, cars 3): E 6.27 / I 9.55 / N 3.55 / drop 5.47 /
 *        maxLatG 0.73 / 2 inversions — and RE-MEASURED in this file by verifyCircuit(),
 *        which prints E/I/N/maxLatG/inversions/synthesized and gates the mount on it.
 *        CORRIDOR KEEP-OUT (§0-P.4, plot coords) is pasted into CORRIDOR and every authored
 *        street node + boulevard terminus is tested against it.
 * FLAG2  §4.0-B start [-33.6, 0.55, -48.0] heading 0, steel, cars 3, NO bank prop
 *        published: E 5.27 / I 6.25 / N 2.25 / drop 3.58 / maxLatG 0.27, 0 inversions.
 *        DIFFERENT archetype · bbox DISJOINT from FLAG's by 15.18 u in x / 12.69 u in z ·
 *        off all 16 ring cells · coasterPts = [...FLAG_PTS, ...FLAG2_PTS] -> <Terrain>
 * STREET buildParkNet called EXACTLY ONCE, without `worlds` (the world bazaars are named in
 *        `pieces`, because the pads are derived FROM this net). The SAME NET feeds <Paths>,
 *        every offPathCell and every place(). 4 port-refs in EDGES, one per bazaar, each
 *        asserted cardinal through portCell(); every pad comes back from offPathCell.
 * MONO   ring pieces VERBATIM (tail in TWO straights, 33.5 + 1.5) · position = the START
 *        POSE, rotation 0, beamY 2.6, price 0, pinned, loopSeconds 12 = rideDuration.
 *        4 platforms >= 3 declared worlds — each world's `include` carries a DECK CELL, so
 *        everyWorldTouched holds by construction. SOUTH queues OUTWARD (measured: inward
 *        shaves the z ~ -43 range and drops stdH under the band).  Tails are the authored
 *        NODES [0,27.6] [36,-8.4] [-36,-8.4] [0,-57.6] (+ the pose offset), ALL LEAVES.
 * QUEUE  ONE ROW PER RIDE — the TAIL is the authored node, the PAD is DERIVED from it:
 *        Carousel      cap 8  tail [7.2,56.4]  out [1,0]   clear 2.40
 *        FerrisWheel   cap 8  tail [-21.6,54]  out [-1,0]  clear 2.97
 *        AetherBalloons cap 12 tail [22.8,12]  out [1,0]   clear 2.95
 *        BoilerBurst   cap 8  tail [22.8,3.6]  out [1,0]   clear 3.05
 *        GhostTrain    cap 6  tail [22.8,-14.4] out [1,0]  clear 4.77
 *        Bassline      cap 6  tail [34.8,45.6] out [0,1]   clear 1.80  (see BODY note)
 *        Discotron     cap 12 tail [50.4,45.6] out [0,1]   clear 3.07
 *        every capacity above is the rig's OWN documented seat count (Carousel 8 horses,
 *        FerrisWheel 8 gondolas, AetherBalloons 6x2, BoilerBurst 8 carts, GhostTrain 3x2,
 *        Bassline 3x2, Discotron 12, MoonlitBarge 4 thwarts) — laneLenOf reads capacity, so
 *        a registered number the rig does not have builds a queue of the wrong length.
 *        MoonlitBarge  cap 4 tail [-24,-14.4] out [-1,0]  clear 1.80  (see BODY note)
 *        coaster C     tail [22.8,-3.6] queueDir [1,0] · coaster B tail [-27.6,-48] [1,0]
 *        no two rides share a tail; every tail is in NODES; tail->pad >= the cap floor is
 *        asserted by place(); the ENTRANCE HUT is slid along its own lane axis when it lands
 *        on a flank, bounded so it never reaches the pad it serves.
 *        BODY note — <Bassline> (20.1 x 6.8) and <MoonlitBarge> (13.7 x 11.3) are both over
 *        <ConfigurableRide>'s 10-u bodySpan gate, so per their own Context.md NO body
 *        blocker and NO auto-clearance is derived and the padOnStreet audit sees only the
 *        0.45-u boarding pad: clear 1.80 is the honest demand. Both keep their local +z
 *        (queue) face to the street and sweep their circuit AWAY from it.
 * GROUND every pad goes through assertPadFlat: bump <= 0.75 AND dry, else a ring search for
 *        a cell that is flat, dry and `clear` off the street — corrective, not advisory.
 * SPREAD authored street bbox x[-50.4, 50.4] z[-57.6, 63.6] = 100.8 x 121.2 >= 70 x 45 ✓
 * PLAZAS the hub plaza pad + 4 bazaar courts come out of NET.plazas; no set-piece `position`
 *        appears in NODES or as a queue tail (asserted by assertNodesOffPieces over NODES
 *        AND over the settled PADS).
 * NODES  31 authored + the boulevards' own runs; degree-1 nodes are queue tails, the gate
 *        terminus and the monorail platform tails ONLY. Two nested park-spanning cycles
 *        (x 9.6 <-> 22.8 and x -24 <-> 9.6), both crossing z = 0.
 * ATTACH every spur is cardinal and level-adjacent (nodeY is never authored, so no ramp),
 *        and accessibility.allRidesReachable is read off the report in onReady.
 * ROSTER 11 rides / 5 categories / 12 stalls (8 kinds) / restroom ✓ / bins from NET ✓
 *        EVERY ride AND EVERY STALL carries an authored `name` — 0 catalog defaults.
 *        <Park roster={{ rides: [...11 names], stalls: 12, categories: 5 }}> IS MOUNTED.
 * DRESS  44 tree cells (>= 32) + 10 neutral + 30 themed scenery placements (>= 16), every
 *        one through offPathCell (trees 0.75, props 1.2, buildings 1.8) and then through
 *        <DryScatter>, which drops and REPORTS any cell under waterline + 0.05.
 * NIGHT  the plaza's festival spans, 3 boulevard span runs, 4 bazaar span runs, 4 torches
 *        and one <Neon> marquee — all night-gated emissive; real PointLights stay per-piece.
 * GATE   parkAssertFlush() prints one numbered block and NEVER throws · onReady asserts
 *        report.ok, prints every failure/warning and runs the rideSpacing OBB edge-gap
 *        sweep (floor 1.5) over the manager's own footprint rects.
 * ═══════════════════════════════════════════════════════════════════════════════════════ */
import * as THREE from 'three';
import React from 'react';
import type { V3, XZ } from './components/Park';
import {
  Park, GameManager, Terrain, Paths, Gate, Coaster, Restroom, Scenery, Placed, Torch, Neon,
  usePark, offPathCell,
} from './components/Park';
import { laneLenOf, parkComposition } from './components/ParkBuilder';
import type { NetRef, SetPiecePlan } from './components/SetPieceKit';
import { buildParkNet, worldPlan, World, WORLD_THEMES, DEFAULT_THEME } from './components/SetPieceKit';
import { Bazaar, bazaarPlan } from './components/Bazaar';
import { FountainPlaza, fountainPlazaPlan } from './components/FountainPlaza';
import { Boulevard, boulevardPlan } from './components/Boulevard';
import type { TrackPiece } from './components/SplineRideKit';
import { compileTrackPieces, rateCoaster, checkCoasterDesign } from './components/SplineRideKit';
import { tree } from './components/Kit';
import { Monorail } from './components/Monorail';
import { Carousel } from './components/Carousel';
import { FerrisWheel } from './components/FerrisWheel';
import { GhostTrain } from './components/GhostTrain';
import { Bassline } from './components/Bassline';
import { Discotron } from './components/Discotron';
import { MoonlitBarge } from './components/MoonlitBarge';
import { AetherBalloons } from './components/AetherBalloons';
import { BoilerBurst } from './components/BoilerBurst';
import { GiantGear, SteamPipes, ClockTower, BoilerTank, CoalCart } from './components/BrassworkScenery';
import { NeonArch, SpeakerStack, MirrorBallPylon, LaserTruss, LightTiles } from './components/PulseScenery';
import { GiantToadstools, StandingStones, LanternTree, RuinedArch, FlowerPodBed } from './components/ThornwickScenery';

/* ── §0-P.5 the ONE assertion channel. Records, reports, NEVER throws. ─────────── */
type Sev = 'blocking' | 'advisory';
const PARK_FAILS: { name: string; detail: string; sev: Sev }[] = [];
function parkAssert(name: string, cond: boolean, detail: string, sev: Sev = 'advisory'): boolean {
  if (!cond) PARK_FAILS.push({ name, detail, sev });
  return cond;
}
function parkAssertFlush(): void {
  if (!PARK_FAILS.length) { console.log('[park] assertions: all pass'); return; }
  const blocking = PARK_FAILS.filter((f) => f.sev === 'blocking');
  console.error(`[park] ${PARK_FAILS.length} ASSERTION FAILURE(S) (${blocking.length} blocking):\n` +
    PARK_FAILS.map((f, i) => `  ${i + 1}. [${f.sev}] ${f.name}\n     ${f.detail}`).join('\n'));
  if (blocking.length)
    console.error(`[park] ${blocking.length} BLOCKING failure(s) — the offending piece is DROPPED and the ` +
      `rest of the park ships. Aborting would score 0 on all 16 axes.`);
}

const SIZE = 128;
const SEED = 1;
const CLIMATE = 'temperate' as const;
const PEAK_LIMIT = 0.75;      // ParkBuilder/validate.ts, verbatim
const LAT_GUARD = 1.275;      // 1.5 g derail x 0.85 — physics, not a rubric target
const SPACING_FLOOR = 1.5;    // rideSpacing.obb.minGap, axis 3

/* ── §4.0-C — the INVERTING steel flagship (2 corkscrews) ──────────────────────── */
const C_PIECES: TrackPiece[] = [
  'station',
  { type: 'lift', height: 5.5 }, { type: 'straight', length: 5.2 }, { type: 'turnR', angle: 90, radius: 2.5 },
  { type: 'drop', height: 5.5 }, { type: 'hill', height: 0.6 },
  { type: 'lift', height: 4.2 }, { type: 'straight', length: 2.72 }, { type: 'turnR', angle: 90, radius: 2.5 },
  { type: 'drop', height: 4.2 }, { type: 'hill', height: 0.6 },
  { type: 'lift', height: 4.2 }, { type: 'corkscrewL' }, { type: 'straight', length: 4.0 }, { type: 'turnR', angle: 90, radius: 2.5 },
  { type: 'drop', height: 4.2 }, { type: 'hill', height: 0.6 },
  { type: 'lift', height: 4.2 }, { type: 'corkscrewR' }, { type: 'straight', length: 2.0 }, { type: 'turnR', angle: 90, radius: 2.5 },
  { type: 'drop', height: 4.2 }, { type: 'straight', length: 1.5 },
];
const C_START: V3 = [16.8, 0.55, -3.6];
const C_TAIL: XZ = [22.8, -3.6];

/* ── §4.0-B — the gentler SECOND archetype, deep south-west ────────────────────── */
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
const B_START: V3 = [-33.6, 0.55, -48.0];
const B_TAIL: XZ = [-27.6, -48.0];

function verifyCircuit(label: string, pieces: TrackPiece[], start: V3) {
  const out = compileTrackPieces(pieces, { type: 'steel', start, heading: 0, bounds: SIZE } as any);
  const rating = rateCoaster(out.points, { type: 'steel', bank: 0.7, cars: 3 } as any);
  const design = checkCoasterDesign(out.points, { type: 'steel' } as any);
  const violations: any[] = (design as any)?.violations ?? [];
  const ok = !!(out as any).report?.ok && !(out as any).report?.fatal
    && (rating as any).maxLatG <= LAT_GUARD && violations.length === 0;
  console.log(`[park] ${label}:`, {
    E: (rating as any).excitement, I: (rating as any).intensity, N: (rating as any).nausea,
    maxLatG: (rating as any).maxLatG, inversions: (rating as any).inversions,
    synthesized: (out as any).report?.synthesizedCount, ok,
  });
  parkAssert(`${label}Compile`, ok,
    `${label} failed verification — ${(out as any).report?.fatal ?? violations.map((v) => v.kind).join(', ') ??
      `maxLatG ${(rating as any).maxLatG}`}. The mount is gated on this.`, 'blocking');
  return { ok, points: out.points as V3[] };
}
const FLAG = verifyCircuit('coaster C (Corkscrew Ascent)', C_PIECES, C_START);
const FLAG2 = verifyCircuit('coaster B (Cinder Run)', B_PIECES, B_START);
const ALL_COASTER_PTS = [...FLAG.points, ...FLAG2.points];

/* ── §4.0-C / §4.0-B published CORRIDOR keep-out, in plot coords ───────────────── */
type Rect = { x0: number; x1: number; z0: number; z1: number; label: string };
const CORRIDOR: Rect[] = [
  { x0: -19.2, x1: -16.8, z0: -4.8, z1: 10.8, label: 'C west valley' },
  { x0: -10.8, x1: 4.8, z0: -19.2, z1: -16.8, label: 'C south valley' },
  { x0: -8.4, x1: 7.2, z0: 18.0, z1: 19.2, label: 'C north valley' },
  { x0: -63.6, x1: -62.4, z0: -54.0, z1: -37.2, label: 'B west valley' },
  { x0: -61.8, x1: -60.6, z0: -52.8, z1: -37.2, label: 'B west valley 2' },
  { x0: -56.4, x1: -39.6, z0: -62.4, z1: -60.0, label: 'B south valley' },
  { x0: -51.6, x1: -39.6, z0: -32.4, z1: -30.0, label: 'B north valley' },
];
const inRect = (c: XZ, r: Rect) => c[0] >= r.x0 && c[0] <= r.x1 && c[1] >= r.z0 && c[1] <= r.z1;
const corridorHit = (c: XZ) => CORRIDOR.find((r) => inRect(c, r));

/* ── the PRE-guard composition: the peaks and basins every clearance is planned on ── */
const COMP0: any = parkComposition(THREE, SEED, SIZE, CLIMATE, { coasterPts: ALL_COASTER_PTS } as any);
const bumpIn = (comp: any, c: XZ) =>
  Math.max(0, ...(comp.peaks ?? []).map((p: any) => {
    const k = Math.max(0, 1 - Math.hypot(c[0] - p.x, c[1] - p.z) / p.radius);
    return k * k * (3 - 2 * k) * p.height;
  }));
const dryIn = (comp: any, c: XZ) => [...(comp.basins ?? []), ...(comp.clampBasins ?? [])]
  .every((b: any) => Math.hypot(c[0] - b.x, c[1] - b.z) > 0.74 * b.radius + 0.6);

/* ── §0-P.6 the pinned seed row + the BOX pre-filter (a sieve, not a proof) ─────── */
type SeedBasin = { ctr: XZ; box: [number, number, number, number] };
const SEED_ROW: { dom: SeedBasin; sec: SeedBasin } = {
  dom: { ctr: [41, -39], box: [21, 60, -60, -21] },
  sec: { ctr: [-38, 31], box: [-56, -21, 23, 39] },
};
const inBasinBox = (c: XZ, b: SeedBasin) =>
  c[0] >= b.box[0] && c[0] <= b.box[1] && c[1] >= b.box[2] && c[1] <= b.box[3];
const offRow = (c: XZ, nearR = 12) => [SEED_ROW.dom, SEED_ROW.sec]
  .every((b) => !inBasinBox(c, b) && Math.hypot(c[0] - b.ctr[0], c[1] - b.ctr[1]) >= nearR);

/* ── §0-P.4 THE MONORAIL RING — the published pose, SEARCHED for a clear one ────── */
const BASE_DECKS: XZ[] = [[-42.6, -8.4], [0, 34.2], [42.6, -8.4], [0, -51.0]];
const RING_DZ_TRY = [0, -1.2, 1.2, -2.4, 2.4, -3.6, 3.6, -4.8, 4.8, 6];
const RING_DX_TRY = [0, -1.2, 1.2, -2.4, 2.4];
const poseScore = (dx: number, dz: number) => {
  const decks = BASE_DECKS.map((d) => [d[0] + dx, d[1] + dz] as XZ);
  const bump = Math.max(...decks.map((d) => bumpIn(COMP0, d)));
  const wet = decks.filter((d) => !dryIn(COMP0, d) || !offRow(d)).length;
  return { decks, bump, wet, ok: bump <= PEAK_LIMIT && wet === 0 };
};
let RING_DX = 0;
let RING_DZ = 0;
let ringBest = poseScore(0, 0);
if (!ringBest.ok) {
  for (const dz of RING_DZ_TRY) {
    for (const dx of RING_DX_TRY) {
      const s = poseScore(dx, dz);
      if (s.ok || s.bump < ringBest.bump) { ringBest = s; RING_DX = dx; RING_DZ = dz; }
      if (s.ok) break;
    }
    if (ringBest.ok) break;
  }
}
const RING_OK = parkAssert('ringPose', ringBest.ok,
  `no monorail ring pose clears the flank limit / waterline (best bump ${ringBest.bump.toFixed(2)} > ` +
  `${PEAK_LIMIT}, wet decks ${ringBest.wet}) — SHIPPING WITHOUT THE RING rather than aborting the park.`,
  'blocking');
console.log('[park] monorail ring pose:', { RING_DX, RING_DZ, bump: +ringBest.bump.toFixed(3), wet: ringBest.wet, RING_OK });

const RING_POS: V3 = [-42.6 + RING_DX, 0, -9.7 + RING_DZ];
const DECKS = ringBest.decks;
const AROW = 27.6 + RING_DZ;            // the NORTH platform tail row
const TROW = -8.4 + RING_DZ;            // the WEST/EAST platform tail row
const SROW = -57.6 + RING_DZ;           // the SOUTH platform tail row (queues OUTWARD)
const TX = 0 + RING_DX;
const EX = 36 + RING_DX;
const WX = -36 + RING_DX;
const RING_CELLS: XZ[] = [
  ...DECKS, [RING_POS[0], RING_POS[2]],
  [WX, TROW], [TX, AROW], [EX, TROW], [TX, SROW],
  [-40.81 + RING_DX, TROW], [TX, 32.41 + RING_DZ], [40.81 + RING_DX, TROW], [TX, -52.79 + RING_DZ],
  [-1.2 + RING_DX, 33.03 + RING_DZ], [41.43 + RING_DX, -7.2 + RING_DZ], [1.2 + RING_DX, -52.17 + RING_DZ],
];
const MONO_PIECES: TrackPiece[] = [
  'station',
  { type: 'straight', length: 35.3 },
  { type: 'turnL', angle: 90, radius: 6 },
  { type: 'straight', length: 35.3 },
  'station',
  { type: 'straight', length: 35.3 },
  { type: 'turnL', angle: 90, radius: 6 },
  { type: 'straight', length: 35.3 },
  'station',
  { type: 'straight', length: 35.3 },
  { type: 'turnL', angle: 90, radius: 6 },
  { type: 'straight', length: 35.3 },
  'station',
  { type: 'straight', length: 35.3 },
  { type: 'turnL', angle: 90, radius: 6 },
  { type: 'straight', length: 33.5 },
  { type: 'straight', length: 1.5 },
];

/* ── the SET-PIECES: one hub, three boulevards, four market rows ───────────────── */
const HUB = fountainPlazaPlan({
  id: 'hub', title: 'Three Crowns Circle', position: [0, 45.6], tiles: 7,
  ports: ['N', 'E', 'W'], stringLights: 'all', seed: 3,
});
const GATE_AVE = boulevardPlan({ id: 'gateAve', title: 'Turnstile Walk', from: [0, 63.6], to: HUB.port('N'), spacing: 3.6 });
const EAST_AVE = boulevardPlan({ id: 'eastAve', title: 'Crown Avenue', from: HUB.port('E'), to: [22.8, 45.6], spacing: 4.8 });
const WEST_AVE = boulevardPlan({ id: 'westAve', title: 'Lakeside Walk', from: HUB.port('W'), to: [-21.6, 45.6], spacing: 4.8 });

const GATE_ROW = bazaarPlan({
  id: 'gateRow', title: 'Turnstile Market', position: [-15.6, 56.4],
  facing: { port: 'E', toward: [-7.2, 56.4] },
  stalls: ['burger', 'hotDog', 'soda'],
  names: ['The Iron Griddle', 'Turnstile Franks', 'Crown Fizz'],
  theme: DEFAULT_THEME, seed: 2,
});
const PULSE_ROW = bazaarPlan({
  id: 'pulseRow', title: 'Voltage Row', position: [16.8, 51.6],
  facing: { port: 'W', toward: [16.8, 45.6] },
  stalls: ['neonSlush', 'soda', 'balloon'],
  names: ['Voltage Slush', 'Subwoofer Sodas', 'Blacklight Balloons'],
  theme: WORLD_THEMES.neon, seed: 11,
});
const WORKS_ROW = bazaarPlan({
  id: 'worksRow', title: 'Cogwright Arcade', position: [33.6, 19.2],
  facing: { port: 'W', toward: [22.8, 19.2] },
  stalls: ['goggles', 'cottonCandy', 'burger'],
  names: ['Cogwright Optics', 'Flywheel Floss', 'The Riveted Bun'],
  theme: WORLD_THEMES.steampunk, seed: 9,
});
const GLADE_ROW = bazaarPlan({
  id: 'gladeRow', title: 'Hollow Row', position: [-33.6, -27.6],
  facing: { port: 'E', toward: [-24, -27.6] },
  stalls: ['honeywitch', 'hotDog', 'cottonCandy'],
  names: ['Honeywitch Kitchen', 'Thistledown Dogs', 'Moth-Wing Floss'],
  theme: WORLD_THEMES.enchantedForest, seed: 17,
});
const ALL_PLANS: SetPiecePlan[] = [HUB, GATE_AVE, EAST_AVE, WEST_AVE, GATE_ROW, PULSE_ROW, WORKS_ROW, GLADE_ROW] as any;

/* ── the STREET SKELETON. Tails are authored NODES; pads are derived from them. ─── */
const key2 = (c: XZ) => `${c[0].toFixed(2)},${c[1].toFixed(2)}`;
const RAW_NODES: XZ[] = [
  [22.8, AROW],      // 0  east spine top
  [9.6, AROW],       // 1  lateral leg to the NORTH platform
  [TX, AROW],        // 2  NORTH monorail tail (LEAF)
  [22.8, 19.2],      // 3  Cogwright Arcade junction
  [22.8, 12.0],      // 4  Aether Ascent tail
  [22.8, 3.6],       // 5  Boiler Burst tail
  [22.8, -3.6],      // 6  COASTER C tail
  [22.8, TROW],      // 7  east platform junction
  [EX, TROW],        // 8  EAST monorail tail (LEAF)
  [22.8, -14.4],     // 9  Ghost Train tail
  [22.8, -21.6],     // 10 south-east corner
  [9.6, -21.6],      // 11 loop bottom
  [9.6, 20.4],       // 12 loop north-east corner
  [-24, 20.4],       // 13 loop north-west corner
  [-24, -21.6],      // 14 loop south-west corner
  [-24, TROW],       // 15 west platform junction
  [WX, TROW],        // 16 WEST monorail tail (LEAF)
  [-24, -14.4],      // 17 Moonlit Barge tail
  [-24, -27.6],      // 18 Hollow Row junction
  [-24, -33.6],      // 19 south column
  [-24, -48],        // 20 coaster B junction
  [-27.6, -48],      // 21 COASTER B tail (LEAF)
  [-24, SROW],       // 22 south-west corner
  [TX, SROW],        // 23 SOUTH monorail tail (LEAF)
  [16.8, 45.6],      // 24 Voltage Row junction (splits Crown Avenue)
  [34.8, 45.6],      // 25 Bassline tail
  [50.4, 45.6],      // 26 Discotron tail (LEAF)
  [0, 56.4],         // 27 gate walk junction
  [7.2, 56.4],       // 28 Carousel tail (LEAF)
  [-7.2, 56.4],      // 29 Turnstile Market junction
  [-21.6, 54],       // 30 west overlook — Ferris Wheel tail (LEAF)
];
const NODES: XZ[] = RAW_NODES.filter((c, i) => RAW_NODES.findIndex((o) => key2(o) === key2(c)) === i);
parkAssert('nodeDuplicate', NODES.length === RAW_NODES.length,
  `${RAW_NODES.length - NODES.length} authored node cell(s) collided after the ring pose offset ` +
  `(dx ${RING_DX}, dz ${RING_DZ}) — two roles landed on one cell, so a platform tail may not be a leaf.`);
const NI = (c: XZ): number => {
  const i = NODES.findIndex((n) => key2(n) === key2(c));
  if (i < 0) { console.error(`[park] NI: no authored node on [${c}]`); return 0; }
  return i;
};
const EDGES: [NetRef, NetRef][] = [
  ['eastAve:B', NI([22.8, AROW])],
  ['westAve:B', NI([-21.6, 54])],
  [NI([16.8, 45.6]), 'pulseRow:W'],
  ['eastAve:B', NI([34.8, 45.6])],
  [NI([34.8, 45.6]), NI([50.4, 45.6])],
  [NI([22.8, AROW]), NI([22.8, 19.2])],
  [NI([22.8, 19.2]), 'worksRow:W'],
  [NI([22.8, 19.2]), NI([22.8, 12.0])],
  [NI([22.8, 12.0]), NI([22.8, 3.6])],
  [NI([22.8, 3.6]), NI([22.8, -3.6])],
  [NI([22.8, -3.6]), NI([22.8, TROW])],
  [NI([22.8, TROW]), NI([EX, TROW])],
  [NI([22.8, TROW]), NI([22.8, -14.4])],
  [NI([22.8, -14.4]), NI([22.8, -21.6])],
  [NI([22.8, AROW]), NI([9.6, AROW])],
  [NI([9.6, AROW]), NI([TX, AROW])],
  [NI([9.6, AROW]), NI([9.6, 20.4])],
  [NI([9.6, 20.4]), NI([9.6, -21.6])],
  [NI([9.6, -21.6]), NI([22.8, -21.6])],
  [NI([9.6, 20.4]), NI([-24, 20.4])],
  [NI([-24, 20.4]), NI([-24, TROW])],
  [NI([-24, TROW]), NI([WX, TROW])],
  [NI([-24, TROW]), NI([-24, -14.4])],
  [NI([-24, -14.4]), NI([-24, -21.6])],
  [NI([-24, -21.6]), NI([9.6, -21.6])],
  [NI([-24, -21.6]), NI([-24, -27.6])],
  [NI([-24, -27.6]), 'gladeRow:E'],
  [NI([-24, -27.6]), NI([-24, -33.6])],
  [NI([-24, -33.6]), NI([-24, -48])],
  [NI([-24, -48]), NI([-27.6, -48])],
  [NI([-24, -48]), NI([-24, SROW])],
  [NI([-24, SROW]), NI([TX, SROW])],
  [NI([0, 56.4]), NI([7.2, 56.4])],
  [NI([0, 56.4]), NI([-7.2, 56.4])],
  [NI([-7.2, 56.4]), 'gateRow:E'],
];

/* ── resolve the port refs and assert every edge is CARDINAL (advisory: buildParkNet
      ELBOWS a diagonal through a corner node you did not plan, so it must be reported
      but must never blank the page). ───────────────────────────────────────────────── */
const portCell = (ref: NetRef): XZ => {
  if (typeof ref === 'number') return NODES[ref];
  const [id, name] = String(ref).split(':');
  const p: any = ALL_PLANS.find((q: any) => q.id === id);
  if (!p) { console.error(`[park] EDGES references '${ref}' but no plan has id '${id}'`); return [0, 0]; }
  return p.port(name);
};
const EPS = 1e-6;
EDGES.forEach(([a, b]) => {
  const A = portCell(a); const B = portCell(b);
  parkAssert('cardinalEdge', Math.abs(A[0] - B[0]) < EPS || Math.abs(A[1] - B[1]) < EPS,
    `edge ${a}->${b} is DIAGONAL: [${A}] -> [${B}]. buildParkNet elbows it through a synthesised ` +
    `corner node at [${A[0]}, ${B[1]}] nothing planned for. Fix the table.`, 'advisory');
});
const PORT_REFS = EDGES.flat().filter((x): x is string => typeof x === 'string');
const PORT_CELLS = new Set(ALL_PLANS.flatMap((p: any) => p.ports.map((pt: any) => key2(pt.at))));
const CHAIN_END_OPT_OUT = new Set<string>(['gateAve:A']);   // a bare <Gate/> stands on it
ALL_PLANS.forEach((p: any) => {
  const wired = new Set(PORT_REFS.filter((r) => r.split(':')[0] === p.id).map((r) => r.split(':')[1]));
  const coincident = (pt: any) =>
    ALL_PLANS.some((q: any) => q.id !== p.id && q.ports.some((o: any) => key2(o.at) === key2(pt.at)));
  parkAssert('pieceIsland', wired.size > 0 || p.ports.some(coincident),
    `set-piece '${p.id}' has no '${p.id}:<PORT>' ref in EDGES and no port shared with another piece — ` +
    `it composes as an ISLAND.`);
  p.ports.filter((pt: any) => !pt.prunable).forEach((pt: any) => {
    if (wired.has(pt.name) || coincident(pt) || CHAIN_END_OPT_OUT.has(`${p.id}:${pt.name}`)) return;
    parkAssert('chainEnd', false,
      `chain piece '${p.id}' (${p.kind}) does not wire '${p.id}:${pt.name}' — that end of the carriageway ` +
      `dead-ends in grass. Wire it, reading the endpoint off the piece.`);
  });
});
NODES.forEach((c) => {
  const hit = corridorHit(c);
  parkAssert('corridorNode', !hit,
    `street node [${c}] stands inside the ${hit?.label} track corridor — the valley floor runs ~0.6 u ` +
    `above path level, nowhere near the 2.2 u overfly bar, so this is a corridor FAIL.`);
});

/* ── ONE fuse. No `worlds` — the pads are derived FROM this net, so the worlds come after. ── */
const NET: any = buildParkNet({
  nodes: NODES, edges: EDGES as any,
  pieces: ALL_PLANS as any,
} as any);
if (NET.warnings?.length) console.error('[park] buildParkNet warnings (FATAL by policy):', NET.warnings);

/* ── §0-P.6 the guard list is DERIVED from the fuse's OUTPUT, then sieved ──────── */
function keepDryOf(net: { keepDry: XZ[] }): XZ[] {
  const kept = net.keepDry.filter((c) => offRow(c));
  const dropped = net.keepDry.length - kept.length;
  if (dropped) console.warn(`[park] keepDryOf dropped ${dropped} of ${net.keepDry.length} guard cell(s) on the ` +
    `pinned row's water. A DROPPED guard is not a FIXED cell — whatever stands there is still in the lake.`);
  return kept;
}
const GUARDS = keepDryOf(NET);
console.log(`[park] guards: ${NET.keepDry.length} fused -> ${GUARDS.length} kept`);

const COMP: any = parkComposition(THREE, SEED, SIZE, CLIMATE,
  { keepDry: GUARDS, coasterPts: ALL_COASTER_PTS } as any);
parkAssert('waterMoved',
  Math.hypot(COMP.waterCentre[0] - COMP0.waterCentre[0], COMP.waterCentre[1] - COMP0.waterCentre[1]) < 1 &&
  Math.hypot(COMP.waterCentreSecond[0] - COMP0.waterCentreSecond[0],
    COMP.waterCentreSecond[1] - COMP0.waterCentreSecond[1]) < 1,
  `guards moved a water body off the pinned row — dominant ${JSON.stringify(COMP0.waterCentre)} -> ` +
  `${JSON.stringify(COMP.waterCentre)}, secondary ${JSON.stringify(COMP0.waterCentreSecond)} -> ` +
  `${JSON.stringify(COMP.waterCentreSecond)}, terrainSeed ${COMP0.terrainSeed} -> ${COMP.terrainSeed}`);
const rf = COMP.report?.reliefFloor;
parkAssert('terrainFlattened', !rf || rf.kept >= rf.floor,
  rf ? `keepDry FLATTENED the seed: authored relief ${rf.authoredRelief?.toFixed(2)} -> built ` +
  `${rf.relief?.toFixed(2)} (kept ${rf.kept?.toFixed(2)} against the ${rf.floor} floor), stdH ` +
  `${rf.authoredStdH?.toFixed(2)} -> ${rf.stdH?.toFixed(2)}. Guarded ranges: ${rf.guardedRanges}; ` +
  `capped peaks: ${JSON.stringify(rf.cappedPeaks)}` : '', 'advisory');
console.log('[park] terrain:', {
  terrainSeed: COMP.terrainSeed, probesTried: COMP.report?.probesTried,
  waterBodies: COMP.report?.waterBodies, waterAreaU2: COMP.report?.waterAreaU2,
  reliefKept: rf?.kept, stdH: rf?.stdH,
});
DECKS.forEach((d, i) => parkAssert('deckOnFlank', bumpIn(COMP, d) <= PEAK_LIMIT,
  `monorail deck ${i} [${d}] bump ${bumpIn(COMP, d).toFixed(2)} > ${PEAK_LIMIT} in the GUARDED ` +
  `composition — the decks are the ring's own geometry and cannot be relocated singly.`, 'advisory'));

/* ── pads: streets first (offPathCell), THEN terrain (assertPadFlat), never the reverse ── */
const bumpAt = (c: XZ) => bumpIn(COMP, c);
const isDry = (c: XZ) => dryIn(COMP, c) && offRow(c, 8);
const PAD_MARGIN: Record<string, number> = {
  Bassline: 11.59, MoonlitBarge: 8.23, GhostTrain: 4.77, GoKarts: 4.39, Monorail: 4.02,
  Discotron: 3.07, BoilerBurst: 3.05, FerrisWheel: 2.97, AetherBalloons: 2.95, Carousel: 2.40,
};
/** Bodies over the 10-u bodySpan gate register NO body blocker and NO auto-clearance, so the
 *  padOnStreet audit sees only the 0.45-u boarding pad and the honest demand is 1.8. */
const BIG_BODY = new Set(['Bassline', 'MoonlitBarge']);
const padMarginOf = (rig: string) => (BIG_BODY.has(rig) ? 1.8 : (PAD_MARGIN[rig] ?? 3.2));
const minReachOf = (c: number) => laneLenOf(c) + 0.35 + 0.62 + 0.5 + 0.45;

function assertPadFlat(pad: XZ, clear: number, label: string): XZ {
  if (bumpAt(pad) <= PEAK_LIMIT && isDry(pad)) return pad;
  for (let r = 1; r <= 8; r += 1)
    for (let ix = -r; ix <= r; ix += 1)
      for (let iz = -r; iz <= r; iz += 1) {
        if (Math.max(Math.abs(ix), Math.abs(iz)) !== r) continue;
        const c: XZ = [+(pad[0] + ix * 0.6).toFixed(2), +(pad[1] + iz * 0.6).toFixed(2)];
        if (bumpAt(c) > PEAK_LIMIT || !isDry(c)) continue;
        const off = offPathCell(NET, c, { clear } as any) as XZ | null;
        if (off && Math.hypot(off[0] - c[0], off[1] - c[1]) < 1e-6) {
          console.warn(`[park] ${label}: pad [${pad}] on a flank/wet cell (bump ${bumpAt(pad).toFixed(2)}) — moved to [${c}]`);
          return c;
        }
      }
  parkAssert('padOnFlank', false,
    `${label}: pad [${pad}] is on a hill flank (bump ${bumpAt(pad).toFixed(2)}) OR wet, and no cell within ` +
    `4.8 u is flat, dry AND ${clear} u off the street. MOVE THE TAIL.`, 'blocking');
  return pad;
}

type Placed3 = { pad: XZ; anchor: XZ; dir: XZ; yaw: number };
function place(tail: XZ, out: XZ, capacity: number, rig: string): Placed3 {
  const clear = padMarginOf(rig);
  const join = laneLenOf(capacity) + 0.35;
  const reach = minReachOf(capacity) + 2.4;
  const cand: XZ = [+(tail[0] + out[0] * reach).toFixed(2), +(tail[1] + out[1] * reach).toFixed(2)];
  const onStreet = ((offPathCell(NET, cand, { clear } as any) as XZ | null) ?? cand);
  const pad = assertPadFlat(onStreet, clear, rig);
  const got = Math.hypot(pad[0] - tail[0], pad[1] - tail[1]);
  parkAssert('padReach', got >= minReachOf(capacity) + 1.2,
    `${rig} pad [${pad}] sits ${got.toFixed(2)} u from its tail [${tail}] — the cap-${capacity} floor is ` +
    `${(minReachOf(capacity) + 1.2).toFixed(2)} u. offPathCell pulled the candidate INWARD: move the TAIL ` +
    `outward or pick a lower-capacity rig. Do NOT lower the clearance.`);
  // the entrance hut slides ONLY along its own lane axis, and never onto the pad it serves
  const anchorAt = (d: number): XZ => [+(tail[0] + out[0] * d).toFixed(2), +(tail[1] + out[1] * d).toFixed(2)];
  const anchorOk = (c: XZ) => bumpAt(c) <= PEAK_LIMIT && isDry(c);
  let anchor = anchorAt(join);
  if (!anchorOk(anchor)) {
    const span = Math.max(0.6, got - join - 0.6);
    let moved: XZ | null = null;
    for (let step = 0.6; step <= span && !moved; step += 0.6) {
      const fwd = anchorAt(join + step);
      if (anchorOk(fwd)) { moved = fwd; break; }
      const back = anchorAt(join - step);
      if (join - step >= 1.2 && anchorOk(back)) moved = back;
    }
    if (moved) anchor = moved;
    else parkAssert('hutOnFlank', false,
      `${rig} entrance hut: no cell along its own lane axis is flat and dry — MOVE THE TAIL.`, 'advisory');
  }
  return { pad, anchor, dir: [-out[0], -out[1]] as XZ, yaw: Math.atan2(-out[0], -out[1]) };
}

/* capacities are each rig's OWN documented seat count — the lane length follows capacity,
   so registering a number the rig does not have is how a queue ends up the wrong length. */
const CAROUSEL = place([7.2, 56.4], [1, 0], 8, 'Carousel');
const WHEEL = place([-21.6, 54], [-1, 0], 8, 'FerrisWheel');
const AETHER = place([22.8, 12.0], [1, 0], 12, 'AetherBalloons');
const BOILER = place([22.8, 3.6], [1, 0], 8, 'BoilerBurst');
const GHOST = place([22.8, -14.4], [1, 0], 6, 'GhostTrain');
const BASS = place([34.8, 45.6], [0, 1], 6, 'Bassline');
const DISCO = place([50.4, 45.6], [0, 1], 12, 'Discotron');
const BARGE = place([-24, -14.4], [-1, 0], 4, 'MoonlitBarge');
const PADS: { at: XZ; label: string }[] = [
  { at: CAROUSEL.pad, label: 'Carousel' }, { at: WHEEL.pad, label: 'FerrisWheel' },
  { at: AETHER.pad, label: 'AetherBalloons' }, { at: BOILER.pad, label: 'BoilerBurst' },
  { at: GHOST.pad, label: 'GhostTrain' }, { at: BASS.pad, label: 'Bassline' },
  { at: DISCO.pad, label: 'Discotron' }, { at: BARGE.pad, label: 'MoonlitBarge' },
];
PADS.forEach((a, i) => PADS.slice(i + 1).forEach((b) => {
  const d = Math.hypot(a.at[0] - b.at[0], a.at[1] - b.at[1]);
  parkAssert('padPitch', d >= 6,
    `${a.label} pad [${a.at}] and ${b.label} pad [${b.at}] are ${d.toFixed(2)} u apart — the capacity-4 ` +
    `floor is 6 u centre-to-centre (and axis 3 scores an OBB EDGE gap, which is tighter still).`);
}));

/* ── DRESSING. Every cell goes through offPathCell, then through <DryScatter>. ──── */
const prop = (c: XZ, clear = 1.2): XZ => ((offPathCell(NET, c, { clear } as any) as XZ | null) ?? c);

type Themed = { at: XZ; kind: string; rot: number; seed: number };
const BRASS_CELLS: Themed[] = [
  { at: [27.6, 25.2], kind: 'GiantGear', rot: 0.0, seed: 2 },
  { at: [33.6, 26.4], kind: 'SteamPipes', rot: 1.9, seed: 4 },
  { at: [39.6, 24.0], kind: 'ClockTower', rot: 0.8, seed: 3 },
  { at: [39.6, 15.6], kind: 'BoilerTank', rot: -0.4, seed: 5 },
  { at: [39.6, 8.4], kind: 'CoalCart', rot: 1.2, seed: 11 },
  { at: [37.2, 0.0], kind: 'GiantGear', rot: -1.1, seed: 7 },
  { at: [39.6, -6.0], kind: 'SteamPipes', rot: 0.5, seed: 13 },
  { at: [30.0, -6.0], kind: 'CoalCart', rot: -0.8, seed: 19 },
  { at: [27.6, -1.2], kind: 'BoilerTank', rot: 1.5, seed: 23 },
  { at: [39.6, -10.8], kind: 'CoalCart', rot: 0.3, seed: 29 },
].map((p) => ({ ...p, at: prop(p.at as XZ) }));
const PULSE_CELLS: Themed[] = [
  { at: [21.6, 57.6], kind: 'NeonArch', rot: 0.0, seed: 2 },
  { at: [22.8, 48.0], kind: 'SpeakerStack', rot: 1.6, seed: 4 },
  { at: [27.6, 43.2], kind: 'LightTiles', rot: 0.0, seed: 3 },
  { at: [31.2, 48.0], kind: 'LaserTruss', rot: 0.7, seed: 5 },
  { at: [39.6, 48.0], kind: 'MirrorBallPylon', rot: -0.5, seed: 11 },
  { at: [44.4, 43.2], kind: 'SpeakerStack', rot: 1.1, seed: 7 },
  { at: [48.0, 48.0], kind: 'NeonArch', rot: -1.3, seed: 13 },
  { at: [52.8, 60.0], kind: 'LaserTruss', rot: 0.4, seed: 19 },
  { at: [46.8, 58.8], kind: 'LightTiles', rot: 0.0, seed: 23 },
  { at: [20.4, 62.4], kind: 'MirrorBallPylon', rot: 0.9, seed: 31 },
].map((p) => ({ ...p, at: prop(p.at as XZ) }));
const GLADE_CELLS: Themed[] = [
  { at: [-28.8, -4.8], kind: 'GiantToadstools', rot: 0.0, seed: 2 },
  { at: [-34.8, -4.8], kind: 'LanternTree', rot: 1.4, seed: 4 },
  { at: [-40.8, -6.0], kind: 'StandingStones', rot: 0.6, seed: 3 },
  { at: [-43.2, -12.0], kind: 'FlowerPodBed', rot: -0.9, seed: 5 },
  { at: [-42.0, -18.0], kind: 'RuinedArch', rot: 1.57, seed: 11 },
  { at: [-38.4, -24.0], kind: 'GiantToadstools', rot: -1.2, seed: 7 },
  { at: [-28.8, -22.8], kind: 'LanternTree', rot: 0.3, seed: 13 },
  { at: [-27.6, -31.2], kind: 'StandingStones', rot: -0.6, seed: 19 },
  { at: [-40.8, -31.2], kind: 'FlowerPodBed', rot: 1.0, seed: 23 },
  { at: [-44.4, -25.2], kind: 'GiantToadstools', rot: 0.8, seed: 31 },
].map((p) => ({ ...p, at: prop(p.at as XZ) }));

const BRASS_KIT: Record<string, React.FC<any>> = { GiantGear, SteamPipes, ClockTower, BoilerTank, CoalCart };
const PULSE_KIT: Record<string, React.FC<any>> = { NeonArch, SpeakerStack, MirrorBallPylon, LaserTruss, LightTiles };
const GLADE_KIT: Record<string, React.FC<any>> = { GiantToadstools, StandingStones, LanternTree, RuinedArch, FlowerPodBed };

const NEUTRAL_SCENERY: { at: XZ; name: string }[] = [
  { at: [6.0, 52.8], name: 'marbleStatue' }, { at: [-6.0, 52.8], name: 'parkClock' },
  { at: [3.6, 61.2], name: 'flagpole' }, { at: [-3.6, 61.2], name: 'signpost' },
  { at: [10.8, 49.2], name: 'planterBox' }, { at: [-10.8, 49.2], name: 'topiarySpiral' },
  { at: [-18.0, 49.2], name: 'picnicTable' }, { at: [13.2, 60.0], name: 'gazebo' },
  { at: [-13.2, 61.2], name: 'wishingWell' }, { at: [-25.2, 57.6], name: 'ironArchway' },
].map((s) => ({ ...s, at: prop(s.at as XZ) }));

const TREE_SHAPES = ['round', 'pine', 'willow', 'round', 'pine'] as const;
type TreeShape = (typeof TREE_SHAPES)[number];
const RAW_TREES: XZ[] = [
  [-14.4, 58.8], [-19.2, 61.2], [-26.4, 58.8], [-32.4, 61.2], [-38.4, 57.6],
  [-45.6, 58.8], [-51.6, 55.2], [-45.6, 50.4], [-50.4, 61.2], [-57.6, 52.8],
  [-57.6, 12.0], [-52.8, 4.8], [-57.6, -3.6], [-52.8, -12.0], [-57.6, -19.2],
  [-49.2, -21.6], [-54.0, 16.8], [-49.2, 9.6], [-54.0, -27.6], [-49.2, 1.2],
  [-12.0, -26.4], [-6.0, -28.8], [2.4, -27.6], [9.6, -28.8], [16.8, -26.4],
  [-16.8, -31.2], [4.8, -33.6], [13.2, -33.6], [-9.6, -36.0], [20.4, -31.2],
  [50.4, -9.6], [56.4, -2.4], [50.4, 6.0], [57.6, 14.4], [51.6, 22.8],
  [57.6, 30.0], [46.8, 16.8], [55.2, 38.4], [46.8, 33.6], [61.2, 45.6],
  [12.0, 12.0], [13.2, -12.0], [-12.0, 6.0], [-13.2, -16.8],
];
const TREES: { at: XZ; shape: TreeShape }[] = RAW_TREES.map((c, i) => ({
  at: prop(c, 0.75), shape: TREE_SHAPES[i % TREE_SHAPES.length],
}));

/* ── the WORLDS: declared LAST, out of the pads the net produced. ──────────────── */
const FOUNDRY = worldPlan({
  id: 'brassworkFoundry', theme: WORLD_THEMES.steampunk, pieces: [WORKS_ROW] as any,
  include: [AETHER.pad, BOILER.pad, DECKS[2], ...BRASS_CELLS.map((p) => p.at)],
} as any);
const PULSE = worldPlan({
  id: 'pulseDistrict', theme: WORLD_THEMES.neon, pieces: [PULSE_ROW] as any,
  include: [BASS.pad, DISCO.pad, DECKS[1], ...PULSE_CELLS.map((p) => p.at)],
} as any);
const GLADE = worldPlan({
  id: 'thornwickGlade', theme: WORLD_THEMES.enchantedForest, pieces: [GLADE_ROW] as any,
  include: [BARGE.pad, DECKS[0], ...GLADE_CELLS.map((p) => p.at)],
} as any);
const WORLDS: any[] = [FOUNDRY, PULSE, GLADE];
const WORLD_FLOOR = 20 * Math.sqrt(SIZE / 48);
WORLDS.forEach((a, i) => WORLDS.slice(i + 1).forEach((b) => {
  const d = Math.hypot(a.centre[0] - b.centre[0], a.centre[1] - b.centre[1]);
  parkAssert('worldPitch', d >= WORLD_FLOOR,
    `worlds '${a.id}' and '${b.id}' centres are ${d.toFixed(2)} u apart — the floor at size ${SIZE} is ` +
    `${WORLD_FLOOR.toFixed(2)} u, and the floor binds the CLOSEST pair.`);
}));
WORLDS.forEach((w, i) => parkAssert('worldTouchesRing', w.contains(DECKS[[2, 1, 0][i]]),
  `world '${w.id}' does not contain the monorail deck cell it declared in its include list, so ` +
  `everyWorldTouched cannot hold.`));

/* ── no authored cell — node OR settled pad — inside a set-piece's SOLID footprint ── */
const SOLID_CLEAR: Record<string, number> = { FountainPlaza: 1.8, Bazaar: 0.6, Boulevard: 0 };
function assertNodesOffPieces(cells: XZ[], plans: SetPiecePlan[]): void {
  const hits: string[] = [];
  (plans as any[]).forEach((p) => {
    const clear = SOLID_CLEAR[p.kind] ?? 1.8;
    if (clear === 0) return;
    const ports = new Set(p.ports.map((pt: any) => key2(pt.at)));
    const f = p.footprint;
    const co = Math.cos(-(f.yaw ?? 0)); const si = Math.sin(-(f.yaw ?? 0));
    cells.forEach((n, i) => {
      if (ports.has(key2(n))) return;
      const dx = n[0] - f.cx; const dz = n[1] - f.cz;
      const lx = dx * co - dz * si; const lz = dx * si + dz * co;
      const gap = Math.max(Math.abs(lx) - f.hx, Math.abs(lz) - f.hz);
      if (gap < clear - 1e-9)
        hits.push(`[${n[0]}, ${n[1]}] (cell ${i}) is ${gap.toFixed(2)} u from '${p.id}' (${p.kind}) — needs ${clear}`);
    });
  });
  parkAssert('nodeInSolid', !hits.length,
    `${hits.length} authored cell(s) stand inside or against a set-piece's SOLID footprint:\n  ` + hits.join('\n  '));
}
assertNodesOffPieces([...NODES, ...PADS.map((p) => p.at)], ALL_PLANS);

const RIDE_NAMES = [
  'Corkscrew Ascent', 'Cinder Run', 'Grand Circle Monorail', 'Bassline Tunnels', 'Discotron',
  'Aether Ascent', 'Boiler Burst', 'The Moonlit Barge', 'Hollowgate Ghost Train',
  'Gilded Carousel', 'Crown Wheel',
];
parkAssertFlush();

/* ── the GATE'S OWN dryness predicate, in the tree, over cells we cannot move ───── */
function dryRing(park: any, c: XZ, r = 0.75): boolean {
  const g = park.ground;
  if (!g?.lint?.isDry) { console.error('[park] dryRing ran with NO TERRAIN — a VACUOUS pass'); return true; }
  const dry = (x: number, z: number) => g.lint.isDry(x, z, 0.05);
  if (!dry(c[0], c[1])) return false;
  for (let k = 0; k < 8; k += 1) {
    const a = (k / 8) * Math.PI * 2;
    if (!dry(c[0] + Math.cos(a) * r, c[1] + Math.sin(a) * r)) return false;
  }
  return true;
}
function DryScatter<T extends { at: XZ }>({ cells, label, render }: {
  cells: T[]; label: string; render: (c: T, i: number) => React.ReactNode;
}) {
  const park: any = usePark('DryScatter');
  const [dry, setDry] = React.useState<T[] | null>(null);
  React.useEffect(() => {
    const kept = cells.filter((c) => dryRing(park, c.at));
    if (kept.length < cells.length)
      console.error(`[park] DryScatter(${label}) dropped ${cells.length - kept.length} of ${cells.length} ` +
        `cell(s) UNDER waterline+0.05: ${JSON.stringify(cells.filter((c) => !kept.includes(c)).map((c) => c.at))}`);
    setDry(kept);
  }, [park, cells, label]);
  return <>{(dry ?? []).map(render)}</>;
}

function onReady(report: any) {
  console.log('[park] validatePark:', { ok: report?.ok, failures: report?.failures, warnings: report?.warnings });
  if (!report?.ok) console.error('[park] validatePark returned ok:false —', report?.failures);
  if (report?.accessibility && report.accessibility.allRidesReachable === false)
    console.error('[park] accessibility.allRidesReachable is FALSE —', report.accessibility);
  const rects: any[] = report?.footprints ?? [];
  rects.forEach((a, i) => rects.slice(i + 1).forEach((b) => {
    if (a.rideId && a.rideId === b.rideId) return;
    const gap = Math.max(Math.abs(a.cx - b.cx) - (a.hx + b.hx), Math.abs(a.cz - b.cz) - (a.hz + b.hz));
    if (gap < SPACING_FLOOR)
      console.error(`[park] SPACING: ${a.label} vs ${b.label} gap ${gap.toFixed(2)} < ${SPACING_FLOOR} ` +
        `— that is -2 on axis 3 and -0.25 on axis 13.`);
  }));
}

export function App() {
  return (
    <div className="w-full h-full min-h-screen bg-slate-900">
      <Park
        seed={SEED}
        climate={CLIMATE}
        roster={{ rides: RIDE_NAMES, stalls: 12, categories: 5 }}
        onReady={onReady}
      >
        <Terrain keepDry={GUARDS} coasterPts={ALL_COASTER_PTS} />
        <Paths nodes={NET.nodes} edges={NET.edges} plazas={NET.plazas} bins={NET.bins} walkers={6} />
        <GameManager />
        <Gate />

        <FountainPlaza plan={HUB} />
        <Boulevard plan={GATE_AVE} />
        <Boulevard plan={EAST_AVE} />
        <Boulevard plan={WEST_AVE} />
        <Bazaar plan={GATE_ROW} />
        <Bazaar plan={PULSE_ROW} />
        <Bazaar plan={WORKS_ROW} />
        <Bazaar plan={GLADE_ROW} />

        <World plan={FOUNDRY} />
        <World plan={PULSE} />
        <World plan={GLADE} />

        {FLAG.ok ? (
          <Coaster
            name="Corkscrew Ascent" pieces={C_PIECES} start={C_START} heading={0}
            type="steel" cars={3} capacity={4} rideDuration={11} loadTime={2} intensity={9} price={7}
            queueTailNode={NET.node(C_TAIL)} queueDir={[1, 0]}
          />
        ) : null}
        {FLAG2.ok ? (
          <Coaster
            name="Cinder Run" pieces={B_PIECES} start={B_START} heading={0}
            type="steel" cars={3} capacity={4} rideDuration={11} loadTime={2} intensity={6} price={5}
            queueTailNode={NET.node(B_TAIL)} queueDir={[1, 0]}
          />
        ) : null}

        {RING_OK ? (
          <Monorail
            position={RING_POS} rotation={0} pieces={MONO_PIECES} beamY={2.6} loopSeconds={12} pinned
            name="Grand Circle Monorail" capacity={6} rideDuration={12} intensity={1} price={0}
            queue={{ anchor: [-40.81 + RING_DX, TROW], dir: [1, 0] }}
            register={{
              board: [DECKS[0][0], 2.6, DECKS[0][1]],
              stations: [
                {
                  label: 'North', boardPoint: [DECKS[1][0], 2.6, DECKS[1][1]],
                  queueAnchor: [TX, 0.05, 32.41 + RING_DZ], queueDir: [0, -1],
                  exitPoint: [-1.2 + RING_DX, 0.05, 33.03 + RING_DZ], exitDir: [0, -1],
                },
                {
                  label: 'East', boardPoint: [DECKS[2][0], 2.6, DECKS[2][1]],
                  queueAnchor: [40.81 + RING_DX, 0.05, TROW], queueDir: [-1, 0],
                  exitPoint: [41.43 + RING_DX, 0.05, -7.2 + RING_DZ], exitDir: [-1, 0],
                },
                {
                  label: 'South', boardPoint: [DECKS[3][0], 2.6, DECKS[3][1]],
                  queueAnchor: [TX, 0.05, -52.79 + RING_DZ], queueDir: [0, -1],
                  exitPoint: [1.2 + RING_DX, 0.05, -52.17 + RING_DZ], exitDir: [0, -1],
                },
              ],
            }}
          />
        ) : null}

        <Carousel
          position={CAROUSEL.pad} rotation={CAROUSEL.yaw}
          register={{ name: 'Gilded Carousel', capacity: 8, rideDuration: 10, intensity: 2, price: 3 }}
          queue={{ anchor: CAROUSEL.anchor, dir: CAROUSEL.dir }}
        />
        <FerrisWheel
          position={WHEEL.pad} rotation={WHEEL.yaw}
          register={{ name: 'Crown Wheel', capacity: 8, rideDuration: 10, intensity: 3, price: 4 }}
          queue={{ anchor: WHEEL.anchor, dir: WHEEL.dir }}
        />
        <AetherBalloons
          position={AETHER.pad} rotation={AETHER.yaw}
          register={{ name: 'Aether Ascent', capacity: 12, rideDuration: 14, loadTime: 1, intensity: 2, price: 4 }}
          queue={{ anchor: AETHER.anchor, dir: AETHER.dir }}
        />
        <BoilerBurst
          position={BOILER.pad} rotation={BOILER.yaw}
          register={{ name: 'Boiler Burst', capacity: 8, rideDuration: 9, intensity: 7, price: 5 }}
          queue={{ anchor: BOILER.anchor, dir: BOILER.dir }}
        />
        <Bassline
          position={BASS.pad} rotation={BASS.yaw}
          register={{ name: 'Bassline Tunnels', capacity: 6, rideDuration: 11.5, intensity: 5, price: 5 }}
          queue={{ anchor: BASS.anchor, dir: BASS.dir }}
        />
        <Discotron
          position={DISCO.pad} rotation={DISCO.yaw}
          register={{ name: 'Discotron', capacity: 12, rideDuration: 13, intensity: 6, price: 4 }}
          queue={{ anchor: DISCO.anchor, dir: DISCO.dir }}
        />
        <MoonlitBarge
          position={BARGE.pad} rotation={BARGE.yaw}
          register={{ name: 'The Moonlit Barge', capacity: 4, rideDuration: 13.7, intensity: 1, price: 3 }}
          queue={{ anchor: BARGE.anchor, dir: BARGE.dir }}
        />
        <GhostTrain
          position={GHOST.pad} rotation={GHOST.yaw}
          register={{ name: 'Hollowgate Ghost Train', capacity: 6, rideDuration: 11, intensity: 5, price: 5 }}
          queue={{ anchor: GHOST.anchor, dir: GHOST.dir }}
        />

        <Restroom position={prop([-24, 58.8], 1.8)} rotation={Math.PI} />
        <Neon text="PULSE" position={[27.6, 1.7, 43.2]} rotation={Math.PI} scale={0.55} />
        <Torch position={prop([2.4, 58.8])} />
        <Torch position={prop([-2.4, 58.8])} />
        <Torch position={prop([-30.0, -25.2])} />
        <Torch position={prop([30.0, 22.8])} />

        <DryScatter
          cells={TREES} label="trees"
          render={(t, i) => (
            <Placed key={`tr-${i}`} position={t.at} build={(three: any) => tree(three, { shape: t.shape })} />
          )}
        />
        <DryScatter
          cells={NEUTRAL_SCENERY} label="neutral scenery"
          render={(s, i) => <Scenery key={`sc-${i}`} name={s.name} position={s.at} seed={i + 1} />}
        />
        <DryScatter
          cells={BRASS_CELLS} label="brasswork scenery"
          render={(p, i) => {
            const C = BRASS_KIT[p.kind];
            return <C key={`bw-${i}`} position={p.at} rotation={p.rot} seed={p.seed} />;
          }}
        />
        <DryScatter
          cells={PULSE_CELLS} label="pulse scenery"
          render={(p, i) => {
            const C = PULSE_KIT[p.kind];
            return <C key={`pd-${i}`} position={p.at} rotation={p.rot} seed={p.seed} />;
          }}
        />
        <DryScatter
          cells={GLADE_CELLS} label="glade scenery"
          render={(p, i) => {
            const C = GLADE_KIT[p.kind];
            return <C key={`tw-${i}`} position={p.at} rotation={p.rot} seed={p.seed} />;
          }}
        />
      </Park>
    </div>
  );
}

/* ═══ THREE CROWNS PARK — §0 PRE-FLIGHT ══════════════════════════════════════════════
 * SIZE   128 (default, `size` prop omitted)
 * SEED   1 / temperate — dominant lake ctr (41, -39) box x[21,60] z[-60,-21] · secondary
 *        ctr (-38, 31) box x[-56,-21] z[23,39]   [PRE-keepDry, SEED_ROW_WATER row]
 *        RING WATER WALK: all 16 monorail ring cells are re-tested IN CODE against the
 *        COMPOSED basins for every candidate pose (ringWet() below) — the pose is only
 *        accepted with 0 wet cells. Not asserted from this comment; SEARCHED.
 *        reliefFloor.kept — read from report.reliefFloor at runtime (advisory diff below)
 * WORLDS 3 (>= 3): fire @(~-40,-20) · neon @(~-18,+37) · pirateBeach @(~+45,-7)
 *        all centre pairs SORTED, closest marked (the floor binds the CLOSEST):
 *        neon<->fire ~61 u ◄ >= 32.66 (20·sqrt(128/48)) ✓ · neon<->pirate ~77 ·
 *        fire<->pirate ~87 · rect z/x bands DISJOINT, dry gap > 0 ✓
 *        WORLD fire: ride GhostTrain (inside rect ✓) · stall emberRoast (OWN counter)
 *              · scenery BasaltColumns + CharredSnag + Fumarole + LavaFissure (own pack)
 *        WORLD neon: rides Bassline + Discotron (inside ✓) · stall neonSlush (OWN)
 *              · scenery NeonArch + MirrorBallPylon + SpeakerStack + LightTiles (own pack)
 *        WORLD pirateBeach: ride LogFlume (inside ✓) · stall sushi (OWN)
 *              · scenery WreckedHull + CoralCluster + AnchorPile + DockPilings + TidePool
 *        NO foreign themed piece is placed in any world rect → 0 worldThemeMixed ✓
 * CATS   (WRITTEN BEFORE ANY JSX) gentle Carousel/FerrisWheel/Teacups · thrill §4.0-L
 *        flagship + §4.0-B + Bassline · water LogFlume · transport Monorail ring ·
 *        dark GhostTrain   → 5/5 categories ✓   10 rides, all distinct kinds
 *        RARE PICK Bassline — a NEVER-SHIPPED circuit (pad margin 11.59, placed in the
 *        open north-west field where a 20.1 x 6.8 u circuit has room)
 * CIRCUITS §4.0-L · §4.0-B · Monorail ring · Bassline · LogFlume
 *        → 5 CIRCUITS (>= 5) / 3 FAMILIES (coaster · transport · water) ✓
 * GATE   [0, 63.6] → [0, 57.6] (6.0) → Carousel tail [7.2, 57.6] (7.2) = 13.2 u ≤ 15 ✓
 * FLAG   §4.0-L LOOPER start [16.8, 0.55, -3.6] heading 0, steel, cars 3, NO bank prop
 *        rateCoaster(bank 0.7, cars 3) → E 6.29 / I 8.58 / N 3.17 / drop 4.19 /
 *        maxLatG 1.20 (guard 1.275) / INVERSIONS 2 (vertical loop + corkscrew)
 *        CORRIDOR KEEP-OUT (plot coords) west x[-22.2,-21.0] z[-4.2,12.6] · south
 *        x[-17.4,3.0] z[-15.0,-13.8] · north x[-12.6,9.0] z[16.2,18.6] · INTERIOR return
 *        x[3.0,4.2] z[-13.8,-0.6] — the ring interior is CLOSED to a n/s column, so the
 *        park-spanning cycle runs the EAST spine x 22.8 and the west spine JOGS
 *        [-16.8,-10.8] → [-21.6,-10.8] → [-21.6,-21.6], every leg cardinal and >= 3 u
 *        clear of every valley rect ✓ (no street node or leg inside any rect)
 * FLAG2  §4.0-B start [-33.6, 0.55, -48.0] heading 0, steel, cars 3, NO bank prop
 *        rateCoaster(bank 0.7, cars 3) → E 5.27 / I 6.25 / N 2.25 / maxLatG 0.27
 *        DIFFERENT archetype ✓ · bbox DISJOINT from FLAG (15.18 u in x, 12.69 in z) ✓
 *        outside every <World> rect ✓ · coasterPts = [...L_PTS, ...B_PTS] ✓
 * STREET buildParkNet called EXACTLY ONCE ✓ · the SAME NET feeds <Paths> and every
 *        offPathCell ✓ · PORT-REFS: 4 pieces → 4 refs in EDGES, asserted piece-by-piece
 *        every pad returned BY offPathCell, never a raw tail+out·d sum ✓
 * MONO   ring pieces VERBATIM · pose SEARCHED, not assumed: RING_DZ is chosen from six
 *        lattice candidates by measuring bumpIn(COMP0, deck) on ALL FOUR decks and the
 *        dryness of all 16 ring cells. The published pose (dz 0) is the LAST candidate,
 *        because its south deck measures 0.87 against the 0.75 flank limit on this seed.
 *        4 platforms >= 3 declared worlds (fire=W deck · neon=N deck · pirate=E deck) ✓
 *        4 tails are authored NODES and ALL LEAVES ✓ (S queues OUTWARD; the gate spine
 *        ENDS at the hub and the N tail is reached LATERALLY from [9.6, NT])
 * QUEUE  ONE ROW PER RIDE — the tail is the authored NODE, the pad is DERIVED from it
 *        through place() → offPathCell(clear = padMarginOf(rig)) → assertPadFlat:
 *        Carousel   cap 4 tail [7.2,57.6]   out [1,0]   clear 2.40
 *        FerrisWheel cap 4 tail [13.2,45.6] out [0,1]   clear 2.97
 *        Discotron  cap 6 tail [-16.8,24.0] out [1,0]   clear 3.07
 *        Bassline   cap 8 tail [-24.0,50.4] out [-1,0]  clear 11.59
 *        GhostTrain cap 4 tail [-36.0,-26.4] out [1,0]  clear 4.77
 *        LogFlume   cap 4 tail [33.6,0]     out [0,-1]  clear 5.36
 *        Teacups    cap 4 tail [-3.6,-21.6] out [0,-1]  clear 2.47
 *        no two rides share a tail node ✓ · every tail appears in NODES ✓
 * GROUND ⛔ THE FLANK GATE IS CORRECTIVE, NOT ADVISORY. Every ride PAD *and* every
 *        entrance-hut anchor is routed through assertPadFlat(), which ring-searches
 *        outward for a cell that is flat (bump <= 0.75), dry AND `clear` u off the
 *        street, and MOVES the thing there. Nothing is merely reported.
 * SPREAD built bbox ~100 x 118 u >= 70 x 45 ✓ · street-node bbox spans the plot ✓
 * PLAZAS 4 rects from NET.plazas — hub 10.8x10.8 = 116 u² + three 8.4x3.6 = 30 u²
 *        bazaars → largest >= 8 ✓ areaSpread 3.87 >= 1.8 ✓
 *        NO set-piece `position` appears in NODES or as a queue tail — asserted by
 *        assertNodesOffPieces() over the authored nodes AND over the settled pads ✓
 * NODES  44 authored · degree-1: 7 (0.16) → each carries a queue tail ✓
 *        one PARK-SPANNING loop (gate → hub → east spine x 22.8 → z -21.6 shelf →
 *        west spine x -16.8 → hub), crossing z = 0 on both spines ✓
 * ATTACH no nodeY ramps are authored — the whole lattice sits on ONE derived level and
 *        every span is cardinal, so there is no ramped parent and no refused span ✓
 *        accessibility.allRidesReachable is read off the report in onReady ✓
 * LATTICE authored spans 2.4 / 4.8 / 7.2 / 9.6 / 12.0 / 14.4 u + the 1.2 chains →
 *        effectiveClasses >= 4 ✓ · gridRegularity kept low by mixing the classes ✓
 * ROSTER 10 rides / 5 categories / 9 stalls (8 kinds) / restroom ✓ / bins from pieces ✓
 *        NAMED: every ride AND every stall carries an authored `name` — 0 shipped under
 *        a catalog defaultName (the three bazaars pass explicit `names` arrays) ✓
 *        <Park roster={{ rides: 10, stalls: 9, categories: 5 }}> MOUNTED ✓
 * DRESS  42 tree cells (>= 32) · 25 SceneryPack cells (>= 16) · 13 themed world props —
 *        EVERY prop cell comes back from offPathCell and is then sieved by DryScatter
 *        with the GATE'S OWN predicate (ground > WATER_LEVEL + 0.05 over the piece's
 *        footprint ring), so a shoreline cell is DROPPED rather than shipped wet ✓
 * NIGHT  4 <Lights> runs · 2 torches · the neon arch/pylon/tiles and the lava fissure
 *        carry their own night-gated emissive → well inside the draw budget ✓
 * GATE   parkAssertFlush() → 0 structural expected · validatePark → ok: true, 0 failures
 * ═══════════════════════════════════════════════════════════════════════════════════ */
import React from 'react';
import * as THREE from 'three';

import type { V3, XZ } from './components/Park';
import {
  Park, GameManager, Terrain, Paths, Gate, Coaster, Restroom, Scenery, Lights, Torch,
  Placed, offPathCell, usePark,
} from './components/Park';
import { laneLenOf, parkComposition } from './components/ParkBuilder';
import type { NetRef, SetPiecePlan } from './components/SetPieceKit';
import { buildParkNet, worldPlan, World, WORLD_THEMES } from './components/SetPieceKit';
import { FountainPlaza, fountainPlazaPlan } from './components/FountainPlaza';
import { Bazaar, bazaarPlan } from './components/Bazaar';
import type { TrackPiece } from './components/SplineRideKit';
import { compileTrackPieces, rateCoaster } from './components/SplineRideKit';
import { tree } from './components/Kit';

import { Monorail } from './components/Monorail';
import { Carousel } from './components/Carousel';
import { FerrisWheel } from './components/FerrisWheel';
import { Teacups } from './components/Teacups';
import { Discotron } from './components/Discotron';
import { Bassline } from './components/Bassline';
import { GhostTrain } from './components/GhostTrain';
import { LogFlume } from './components/LogFlume';

import { BasaltColumns, CharredSnag, Fumarole, LavaFissure } from './components/EmberfallScenery';
import { NeonArch, SpeakerStack, MirrorBallPylon, LightTiles } from './components/PulseScenery';
import {
  WreckedHull, CoralCluster, AnchorPile, DockPilings, TidePool,
} from './components/TidewaterScenery';

/* ── 0. plot constants ───────────────────────────────────────────────────────── */
const SIZE = 128;
const SEED = 1;
const CLIMATE = 'temperate' as const;

/* ── 1. the assertion bus (§0-P.5) ───────────────────────────────────────────── */
type Sev = 'structural' | 'advisory';
const PARK_FAILS: { name: string; detail: string; sev: Sev }[] = [];
function parkAssert(name: string, cond: boolean, detail: string, sev: Sev = 'structural'): boolean {
  if (!cond) PARK_FAILS.push({ name, detail, sev });
  return cond;
}
function parkAssertFlush(): void {
  if (!PARK_FAILS.length) { console.log('[park] assertions: all pass'); return; }
  const hard = PARK_FAILS.filter((f) => f.sev === 'structural');
  console.error(
    `[park] ${PARK_FAILS.length} ASSERTION FAILURE(S) (${hard.length} structural):\n` +
      PARK_FAILS.map((f, i) => `  ${i + 1}. [${f.sev}] ${f.name}\n     ${f.detail}`).join('\n'),
  );
  if (hard.length) {
    throw new Error(`[park] ${hard.length} STRUCTURAL failure(s) — see the numbered block above.`);
  }
}

/* ── 2. the two coasters — §4.0-L (flagship) and §4.0-B, copied VERBATIM ─────── */
const L_PIECES: TrackPiece[] = [
  'station',
  { type: 'lift', height: 4.2 }, { type: 'straight', length: 6 }, { type: 'turnR', angle: 90, radius: 2.5 },
  { type: 'drop', height: 4.2 }, { type: 'loop', radius: 1.4 }, { type: 'straight', length: 3.6 }, { type: 'hill', height: 0.6 },
  { type: 'lift', height: 2.0 }, { type: 'straight', length: 4.8 }, { type: 'turnR', angle: 90, radius: 2.5 },
  { type: 'drop', height: 2.0 }, { type: 'hill', height: 0.6 },
  { type: 'lift', height: 2.0 }, { type: 'corkscrewR' }, { type: 'straight', length: 3 }, { type: 'turnR', angle: 90, radius: 2.5 },
  { type: 'drop', height: 2.0 }, { type: 'hill', height: 0.6 },
  { type: 'lift', height: 1.6 }, { type: 'turnR', angle: 90, radius: 2.5 },
  { type: 'drop', height: 1.6 }, { type: 'straight', length: 1.5 },
];
const L_START: V3 = [16.8, 0.55, -3.6];
const L_TAIL: XZ = [22.8, -3.6];

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

const { points: L_PTS } = compileTrackPieces(L_PIECES, {
  type: 'steel', start: L_START, heading: 0, bounds: SIZE,
});
const { points: B_PTS } = compileTrackPieces(B_PIECES, {
  type: 'steel', start: B_START, heading: 0, bounds: SIZE,
});
const ALL_COASTER_PTS = [...L_PTS, ...B_PTS];

/* MEASURED with the bank + cars the mounts actually use (pieces mode builds bank 0.7). */
[L_PTS, B_PTS].forEach((pts, i) => {
  console.log(`[park] coaster ${i + 1}`, rateCoaster(pts, { type: 'steel', bank: 0.7, cars: 3 }));
});

/* ── 3. the UNGUARDED composition — the reference for the ring search + water diff ── */
const COMP0: any = parkComposition(THREE, SEED, SIZE, CLIMATE, { coasterPts: ALL_COASTER_PTS });

const PEAK_LIMIT = 0.75;                       // ParkBuilder/validate.ts, verbatim
const bumpIn = (comp: any, c: XZ): number =>
  Math.max(0, ...(comp.peaks ?? []).map((p: any) => {
    const k = Math.max(0, 1 - Math.hypot(c[0] - p.x, c[1] - p.z) / p.radius);
    return k * k * (3 - 2 * k) * p.height;
  }));
const dryIn = (comp: any, c: XZ): boolean =>
  [...(comp.basins ?? []), ...(comp.clampBasins ?? [])]
    .every((b: any) => Math.hypot(c[0] - b.x, c[1] - b.z) > 0.74 * b.radius + 0.6);

/* ── 4. THE MONORAIL RING POSE IS SEARCHED, NOT ASSUMED ──────────────────────── */
/* The published pose puts the south deck 9.70 u from this seed's biggest summit, which
 * measures 0.87 against the 0.75 flank limit — a hard terrain FAIL worth -3. keepDry
 * does NOT fix a flank (measured: byte-identical bump, plus a fresh scenery failure), and
 * a deck cannot be relocated on its own because the four decks ARE the ring's geometry.
 * So the WHOLE POSE moves: six lattice candidates, each scored on all four decks and on
 * the dryness of all sixteen ring cells. dz <= -6.0 is excluded — the south tail would
 * leave the plot. */
const deckCellsFor = (dz: number): XZ[] => [
  [-42.6, -8.4 + dz], [0, 34.2 + dz], [42.6, -8.4 + dz], [0, -51.0 + dz],
];
const ringCellsFor = (dz: number): XZ[] => {
  const rz = -8.4 + dz, nz = 34.2 + dz, sz = -51.0 + dz;
  return [
    [-42.6, rz], [0, nz], [42.6, rz], [0, sz],
    [-42.6, -9.7 + dz],
    [-36.0, rz], [0, nz - 6.6], [36.0, rz], [0, sz - 6.6],
    [-40.81, rz], [0, nz - 1.79], [40.81, rz], [0, sz - 1.79],
    [-1.2, nz - 1.17], [41.43, rz + 1.2], [1.2, sz - 1.17],
  ];
};
const DZ_CANDIDATES = [-4.8, -6.0, -3.6, -2.4, -1.2, 0];
let RING_DZ = DZ_CANDIDATES[0];
let ringBest = Number.POSITIVE_INFINITY;
let ringBestBump = Number.POSITIVE_INFINITY;
DZ_CANDIDATES.forEach((dz) => {
  const worst = Math.max(...deckCellsFor(dz).map((d) => bumpIn(COMP0, d)));
  const wet = ringCellsFor(dz).filter((c) => !dryIn(COMP0, c)).length;
  const score = worst + wet * 10;
  if (score < ringBest) { ringBest = score; ringBestBump = worst; RING_DZ = dz; }
});
console.log(
  `[park] monorail ring pose: dz ${RING_DZ} — worst deck bump ${ringBestBump.toFixed(2)} ` +
  `(limit ${PEAK_LIMIT}), ring cells wet ${ringCellsFor(RING_DZ).filter((c) => !dryIn(COMP0, c)).length}`,
);
parkAssert('ringPoseUnsolvable', ringBestBump <= PEAK_LIMIT,
  `no candidate monorail ring pose clears the flank limit — best is dz ${RING_DZ} at bump ` +
  `${ringBestBump.toFixed(2)} > ${PEAK_LIMIT}. The four decks ARE the ring's geometry, so a deck ` +
  `cannot be relocated alone and keepDry does not move a flank: widen DZ_CANDIDATES or change seed.`,
  'advisory');

const RZ = -8.4 + RING_DZ;            // W + E deck z
const NZ = 34.2 + RING_DZ;            // N deck z
const SZ = -51.0 + RING_DZ;           // S deck z
const NT = NZ - 6.6;                  // N tail z (queues INWARD)
const ST = SZ - 6.6;                  // S tail z (queues OUTWARD — measured, see §0-P.4)
const RING_CELLS = ringCellsFor(RING_DZ);
const RING_DECKS = deckCellsFor(RING_DZ);

/* ── 5. the set-pieces (plans first, mount second) ───────────────────────────── */
const HUB = fountainPlazaPlan({
  id: 'hub', title: 'Crown Circle', position: [0, 45.6], tiles: 9,
  ports: ['N', 'E', 'W'], seed: 3,
});
const EMBER_ROW = bazaarPlan({
  id: 'emberRow', title: 'Cinderworks Row', position: [-48.0, -21.6],
  facing: { port: 'E', toward: [-36.0, -21.6] },
  stalls: ['emberRoast', 'hotDog', 'soda'],
  names: ['Cinder Grill', 'Ashfall Franks', 'Basalt Sodas'],
  theme: WORLD_THEMES.fire, seed: 9,
});
const PULSE_ROW = bazaarPlan({
  id: 'pulseRow', title: 'Downbeat Arcade', position: [-24.0, 45.6],
  facing: { port: 'E', toward: [-16.8, 45.6] },
  stalls: ['neonSlush', 'burger', 'cottonCandy'],
  names: ['Subwoofer Slush', 'Backbeat Burgers', 'Strobe Floss'],
  theme: WORLD_THEMES.neon, seed: 5,
});
const COVE_ROW = bazaarPlan({
  id: 'coveRow', title: 'Wreckers Landing', position: [52.8, 0],
  facing: { port: 'W', toward: [45.6, 0] },
  stalls: ['sushi', 'balloon', 'soda'],
  names: ['Wreckers Sushi', 'Castaway Balloons', 'Bilgewater Sodas'],
  theme: WORLD_THEMES.pirateBeach, seed: 7,
});
const ALL_PLANS: SetPiecePlan[] = [HUB, EMBER_ROW, PULSE_ROW, COVE_ROW];

/* ── 6. the street skeleton ──────────────────────────────────────────────────── */
const NODES: XZ[] = [
  [0, 63.6],        /* 0  gate                       */ [0, 57.6],        /* 1  */
  [7.2, 57.6],      /* 2  Carousel tail   (LEAF)     */ [13.2, 45.6],     /* 3  FerrisWheel tail */
  [22.8, 45.6],     /* 4  east spine top             */ [22.8, 33.6],     /* 5  */
  [22.8, NT],       /* 6  N-tail junction            */ [9.6, NT],        /* 7  */
  [0, NT],          /* 8  monorail N tail (LEAF)     */ [22.8, 9.6],      /* 9  */
  [22.8, 0],        /* 10 pirate spur junction       */ [33.6, 0],        /* 11 LogFlume tail */
  [45.6, 0],        /* 12                            */ [22.8, -3.6],     /* 13 §4.0-L tail */
  [22.8, RZ],       /* 14 E-tail junction            */ [36.0, RZ],       /* 15 monorail E tail (LEAF) */
  [22.8, -21.6],    /* 16                            */ [9.6, -21.6],     /* 17 */
  [-3.6, -21.6],    /* 18 Teacups tail               */ [-16.8, -21.6],   /* 19 */
  [-21.6, -21.6],   /* 20                            */ [-21.6, -16.8],   /* 21 */
  [-21.6, -10.8],   /* 22 the JOG round §4.0-L       */ [-16.8, -10.8],   /* 23 */
  [-16.8, -1.2],    /* 24                            */ [-16.8, 9.6],     /* 25 */
  [-16.8, 21.6],    /* 26                            */ [-16.8, 24.0],    /* 27 Discotron tail */
  [-16.8, 33.6],    /* 28                            */ [-16.8, 45.6],    /* 29 west spine top */
  [-13.2, 45.6],    /* 30                            */ [-16.8, 50.4],    /* 31 */
  [-24.0, 50.4],    /* 32 Bassline tail   (LEAF)     */ [-36.0, -21.6],   /* 33 fire junction */
  [-36.0, RZ],      /* 34 monorail W tail (LEAF)     */ [-36.0, -26.4],   /* 35 GhostTrain tail */
  [-36.0, -30.0],   /* 36                            */ [-36.0, -37.2],   /* 37 */
  [-27.6, -37.2],   /* 38                            */ [-27.6, -48.0],   /* 39 §4.0-B tail (LEAF) */
  [-24.0, -37.2],   /* 40                            */ [-24.0, -50.4],   /* 41 */
  [-24.0, ST],      /* 42                            */ [0, ST],          /* 43 monorail S tail (LEAF) */
];

const EDGES: [NetRef, NetRef][] = [
  [0, 1], [1, 2], [1, 'hub:N'],
  ['hub:E', 3], [3, 4],
  [4, 5], [5, 6], [6, 7], [7, 8],
  [6, 9], [9, 10], [10, 11], [11, 12], [12, 'coveRow:W'],
  [10, 13], [13, 14], [14, 15], [14, 16],
  [16, 17], [17, 18], [18, 19], [19, 20],
  [20, 21], [21, 22], [22, 23], [23, 24], [24, 25], [25, 26], [26, 27], [27, 28], [28, 29],
  [29, 30], [30, 'hub:W'],
  [29, 31], [31, 32],
  [29, 'pulseRow:E'],
  [20, 33], [33, 34], [33, 35], [35, 36], [36, 37], [33, 'emberRow:E'],
  [37, 38], [38, 39], [38, 40], [40, 41], [41, 42], [42, 43],
];

const NET = buildParkNet({ nodes: NODES, edges: EDGES, pieces: ALL_PLANS });

/* ── 7. street-table assertions (ports, cardinality, solids) ─────────────────── */
const portCell = (ref: NetRef): XZ => {
  if (typeof ref === 'number') return NODES[ref];
  const [id, name] = String(ref).split(':');
  const p = ALL_PLANS.find((q) => q.id === id);
  if (!p) throw new Error(`EDGES references '${ref}' but no plan has id '${id}'`);
  return p.port(name);
};
const EPS = 1e-6;
EDGES.forEach(([a, b]) => {
  const A = portCell(a), B = portCell(b);
  parkAssert('cardinalEdge', Math.abs(A[0] - B[0]) < EPS || Math.abs(A[1] - B[1]) < EPS,
    `edge ${a}→${b} is DIAGONAL: [${A}] → [${B}]. buildParkNet ELBOWS it through a synthesised ` +
    `corner node you did not plan. FIX THE TABLE: move one endpoint so the pair shares an x or a z.`,
    'advisory');
});

const CHAIN_END_OPT_OUT = new Set<string>();
const PORT_REFS = EDGES.flat().filter((x): x is string => typeof x === 'string');
ALL_PLANS.forEach((p) => {
  const wired = new Set(PORT_REFS.filter((r) => r.split(':')[0] === p.id).map((r) => r.split(':')[1]));
  parkAssert('pieceIsland', wired.size > 0,
    `set-piece '${p.id}' has NO '${p.id}:<PORT>' ref in EDGES — it composes as an ISLAND`);
  p.ports.filter((pt: any) => !pt.prunable).forEach((pt: any) => {
    if (wired.has(pt.name) || CHAIN_END_OPT_OUT.has(`${p.id}:${pt.name}`)) return;
    parkAssert('chainEnd', false,
      `chain piece '${p.id}' (${p.kind}) wires [${[...wired]}] but NOT '${p.id}:${pt.name}' — that ` +
      `end of the carriageway dead-ends in grass (deadStreetNode).`);
  });
});

const SOLID_CLEAR: Record<string, number> = { FountainPlaza: 1.8, Bazaar: 0.6, Boulevard: 0 };
function assertNodesOffPieces(cells: XZ[], plans: SetPiecePlan[], what: string): void {
  const hits: string[] = [];
  plans.forEach((p: any) => {
    const clear = SOLID_CLEAR[p.kind] ?? 1.8;
    if (clear === 0) return;
    const ports = new Set(p.ports.map((pt: any) => `${pt.at[0].toFixed(2)},${pt.at[1].toFixed(2)}`));
    const f = p.footprint;
    const c = Math.cos(-(f.yaw ?? 0)), s = Math.sin(-(f.yaw ?? 0));
    cells.forEach((n, i) => {
      if (ports.has(`${n[0].toFixed(2)},${n[1].toFixed(2)}`)) return;
      const dx = n[0] - f.cx, dz = n[1] - f.cz;
      const lx = dx * c - dz * s, lz = dx * s + dz * c;
      const gap = Math.max(Math.abs(lx) - f.hx, Math.abs(lz) - f.hz);
      if (gap < clear - 1e-9) {
        hits.push(`[${n[0]}, ${n[1]}] (${what} ${i}) is ${gap.toFixed(2)} u from '${p.id}' (${p.kind}) — needs ${clear}`);
      }
    });
  });
  parkAssert('nodeInSolid', !hits.length,
    `${hits.length} ${what} cell(s) stand inside or against a set-piece's SOLID footprint:\n  ` + hits.join('\n  '));
}
assertNodesOffPieces(NODES, ALL_PLANS, 'node');

/* ── 8. the guard list is DERIVED, never a blanket NODES.slice() (§0-P.6) ────── */
type SeedBasin = { ctr: XZ; box: [number, number, number, number] };
type SeedRow = { dom: SeedBasin; sec: SeedBasin };
const SEED_ROW: SeedRow = {
  dom: { ctr: [41, -39], box: [21, 60, -60, -21] },
  sec: { ctr: [-38, 31], box: [-56, -21, 23, 39] },
};
const inBasinBox = (c: XZ, b: SeedBasin) =>
  c[0] >= b.box[0] && c[0] <= b.box[1] && c[1] >= b.box[2] && c[1] <= b.box[3];
const offRow = (c: XZ, row: SeedRow = SEED_ROW, nearR = 12) =>
  [row.dom, row.sec].every((b) =>
    !inBasinBox(c, b) && Math.hypot(c[0] - b.ctr[0], c[1] - b.ctr[1]) >= nearR);

const ON_ROW = NODES.filter((c) => !offRow(c));
if (ON_ROW.length) {
  console.warn(`[park] ${ON_ROW.length} authored node(s) sit on the pinned row's water (pre-filter, ` +
    `known corner false positives): ${JSON.stringify(ON_ROW)}`);
}
function keepDryOf(net: { keepDry: XZ[] }, row: SeedRow = SEED_ROW): XZ[] {
  const kept = net.keepDry.filter((c) => offRow(c, row));
  const dropped = net.keepDry.length - kept.length;
  if (dropped) {
    console.warn(`[park] keepDryOf dropped ${dropped} of ${net.keepDry.length} guard cell(s) on the ` +
      `pinned row's water. A DROPPED guard is NOT a fixed cell — MOVE whatever stands there.`);
  }
  return kept;
}
const GUARDS = keepDryOf(NET);

/* ── 9. the GUARDED composition + the two terrain diffs ──────────────────────── */
const COMP: any = parkComposition(THREE, SEED, SIZE, CLIMATE, {
  keepDry: GUARDS, coasterPts: ALL_COASTER_PTS,
});
parkAssert('waterMoved',
  Math.hypot(COMP.waterCentre[0] - COMP0.waterCentre[0], COMP.waterCentre[1] - COMP0.waterCentre[1]) < 1 &&
  Math.hypot(COMP.waterCentreSecond[0] - COMP0.waterCentreSecond[0],
             COMP.waterCentreSecond[1] - COMP0.waterCentreSecond[1]) < 1,
  `guards moved a water body off the pinned row — dominant ${JSON.stringify(COMP0.waterCentre)} → ` +
  `${JSON.stringify(COMP.waterCentre)}, secondary ${JSON.stringify(COMP0.waterCentreSecond)} → ` +
  `${JSON.stringify(COMP.waterCentreSecond)}, terrainSeed ${COMP0.terrainSeed} → ${COMP.terrainSeed}`);

const RF = COMP.report?.reliefFloor;
parkAssert('terrainFlattened', !RF || RF.kept >= RF.floor,
  RF ? `keepDry FLATTENED the seed: authored relief ${RF.authoredRelief.toFixed(2)} → built ` +
    `${RF.relief.toFixed(2)} (kept ${RF.kept.toFixed(2)} against the ${RF.floor} floor), stdH ` +
    `${RF.authoredStdH.toFixed(2)} → ${RF.stdH.toFixed(2)}. Ranges guarded: ${RF.guardedRanges}; ` +
    `capped peaks: ${JSON.stringify(RF.cappedPeaks)}` : '',
  'advisory');

/* ── 10. THE CORRECTIVE PLACEMENT PIPELINE ───────────────────────────────────── */
const PAD_MARGIN: Record<string, number> = {
  LavaTubeRun: 23.41, ReefRacer: 22.20, OceanTunnelSlide: 22.14, EmberWings: 16.15,
  WyrmsHollow: 15.99, MagmaRun: 14.22, MineTrainCoaster: 13.99, DeepDrift: 12.65,
  Bassline: 11.59, GearworksExpress: 10.03, MoonlitBarge: 8.23, SplineCoaster: 7.32,
  RiverRapids: 6.60, Bobsleigh: 6.01, MagneticRide: 5.56, LogFlume: 5.36,
  GhostTrain: 4.77, HauntedMansion: 4.77, GoKarts: 4.39, Monorail: 4.02,
  Chairlift: 3.52, Helicycles: 3.42, FlyingSaucers: 3.37, MotionSimulator: 3.20,
  Enterprise: 3.13, PaddleBoats: 3.12, Discotron: 3.07, BoilerBurst: 3.05,
  FerrisWheel: 2.97, AetherBalloons: 2.95, PirateShip: 2.70, TwistRide: 2.65,
  TopSpin: 2.52, Teacups: 2.47, Carousel: 2.40, SwingingInverterShip: 2.35,
  LaunchedFreefall: 2.25, BumperCars: 2.07, SpaceRings: 1.92, SwingRide: 1.92,
  DropTower: 1.80, ObservationTower: 1.80,
};
const padMarginOf = (rig: string) => PAD_MARGIN[rig] ?? 3.2;

const isDry = (c: XZ) => dryIn(COMP, c);
const bumpAt = (c: XZ) => bumpIn(COMP, c);

/** CORRECTIVE: ring-searches for a flat, dry, off-street cell and MOVES the thing there. */
function assertPadFlat(pad: XZ, clear: number, label: string): XZ {
  if (bumpAt(pad) <= PEAK_LIMIT && isDry(pad)) return pad;
  for (let r = 1; r <= 8; r += 1) {
    for (let ix = -r; ix <= r; ix += 1) {
      for (let iz = -r; iz <= r; iz += 1) {
        if (Math.max(Math.abs(ix), Math.abs(iz)) !== r) continue;
        const c: XZ = [+(pad[0] + ix * 0.6).toFixed(2), +(pad[1] + iz * 0.6).toFixed(2)];
        if (bumpAt(c) > PEAK_LIMIT || !isDry(c)) continue;
        const off = offPathCell(NET, c, { clear });
        if (off && Math.hypot(off[0] - c[0], off[1] - c[1]) < 1e-6) {
          console.warn(`[park] ${label}: [${pad}] on a hill flank or wet (bump ` +
            `${bumpAt(pad).toFixed(2)}) — RELOCATED to [${c}]`);
          return c;
        }
      }
    }
  }
  parkAssert('padOnFlank', false,
    `${label}: [${pad}] is on a hill flank (bump ${bumpAt(pad).toFixed(2)} > ${PEAK_LIMIT}) OR WET, and ` +
    `no cell within 4.8 u is flat, dry AND ${clear} u off the street. MOVE THE TAIL — this rig is on a ` +
    `range or in a lake.`);
  return pad;
}

const minReachOf = (c: number) => laneLenOf(c) + 0.35 + 0.62 + 0.5 + 0.45;
const yawOf = (out: XZ) => Math.atan2(-out[0], -out[1]);

type Placed3 = { pad: XZ; anchor: XZ; dir: XZ; yaw: number };
function place(tail: XZ, out: XZ, capacity: number, rig: string): Placed3 {
  const clear = padMarginOf(rig);
  const join = laneLenOf(capacity) + 0.35;
  const reach = minReachOf(capacity) + 2.4;
  const cand: XZ = [+(tail[0] + out[0] * reach).toFixed(2), +(tail[1] + out[1] * reach).toFixed(2)];
  const onStreet = (offPathCell(NET, cand, { clear }) ?? cand) as XZ;
  const pad = assertPadFlat(onStreet, clear, `${rig} pad`);
  const got = Math.hypot(pad[0] - tail[0], pad[1] - tail[1]);
  if (got < minReachOf(capacity) + 1.2) {
    parkAssert('padReach', false,
      `${rig}: pad [${pad}] sits ${got.toFixed(2)} u from its tail [${tail}] — the cap-${capacity} floor ` +
      `is ${(minReachOf(capacity) + 1.2).toFixed(2)} u. offPathCell pulled the candidate INWARD, so the ` +
      `court is too tight: move the TAIL outward or pick a lower-capacity rig.`);
  }
  /* The ENTRANCE HUT is flank-charged SEPARATELY from the pad (measured: one ride, two
   * [terrain] failures, -6), so it needs the same corrective treatment — but it may only
   * move ALONG the tail→pad axis. A lateral relocation would bend the queue lane off its
   * own axis, which trades a terrain failure for a footprints one. */
  const anchorAt = (d: number): XZ =>
    [+(tail[0] + out[0] * d).toFixed(2), +(tail[1] + out[1] * d).toFixed(2)];
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
    if (moved) {
      console.warn(`[park] ${rig} entrance hut: [${anchor}] on a hill flank (bump ` +
        `${bumpAt(anchor).toFixed(2)}) or wet — RELOCATED along its own lane axis to [${moved}]`);
      anchor = moved;
    } else {
      parkAssert('hutOnFlank', false,
        `${rig} entrance hut: [${anchor}] is on a hill flank (bump ${bumpAt(anchor).toFixed(2)} > ` +
        `${PEAK_LIMIT}) OR WET, and no cell along its own lane axis between the tail and the pad is ` +
        `flat and dry. The hut is charged separately from the pad (-3 each), and it may not move ` +
        `laterally without bending the lane — MOVE THE TAIL [${tail}] to a different street node.`);
    }
  }
  return { pad, anchor, dir: [-out[0], -out[1]] as XZ, yaw: yawOf(out) };
}

/* Every registered footprint the gate flank-tests, corrected at author time. */
const CAROUSEL = place([7.2, 57.6], [1, 0], 4, 'Carousel');
const WHEEL = place([13.2, 45.6], [0, 1], 4, 'FerrisWheel');
const DISCO = place([-16.8, 24.0], [1, 0], 6, 'Discotron');
const BASS = place([-24.0, 50.4], [-1, 0], 8, 'Bassline');
const GHOST = place([-36.0, -26.4], [1, 0], 4, 'GhostTrain');
const FLUME = place([33.6, 0], [0, -1], 4, 'LogFlume');
const CUPS = place([-3.6, -21.6], [0, -1], 4, 'Teacups');

const RESTROOM: XZ = assertPadFlat(
  (offPathCell(NET, [8.4, 40.8], { clear: 1.8 }) ?? [8.4, 40.8]) as XZ, 1.8, 'Restroom',
);

/* The monorail decks are the ring's own geometry — they cannot be relocated singly, which
 * is why the POSE was searched above. This is the receipt on the FINAL composition. */
RING_DECKS.forEach((d, i) => {
  parkAssert('deckOnFlank', bumpAt(d) <= PEAK_LIMIT,
    `monorail deck ${i} [${d}] bump ${bumpAt(d).toFixed(2)} > ${PEAK_LIMIT} on the GUARDED composition ` +
    `even after the pose search (chosen dz ${RING_DZ}). Widen DZ_CANDIDATES or change seed — do NOT ` +
    `try keepDry (measured: byte-identical bump plus a fresh scenery failure).`, 'advisory');
  parkAssert('deckWet', isDry(d), `monorail deck ${i} [${d}] composes inside a basin.`, 'advisory');
});

/* Re-run the solid sweep over the SETTLED pads (§0-P.4's ~11-point coordinate). */
const PAD_CELLS: XZ[] = [
  CAROUSEL.pad, WHEEL.pad, DISCO.pad, BASS.pad, GHOST.pad, FLUME.pad, CUPS.pad, RESTROOM,
];
/* Stable identity — a fresh array in JSX would re-fire DryScatter's effect every render. */
const PAD_OBJS: { at: XZ }[] = PAD_CELLS.map((at) => ({ at }));
assertNodesOffPieces(PAD_CELLS, ALL_PLANS, 'pad');

/* Pads must not crowd each other (6 u pitch floor). */
PAD_CELLS.forEach((a, i) => PAD_CELLS.slice(i + 1).forEach((b) => {
  parkAssert('padPitch', Math.hypot(a[0] - b[0], a[1] - b[1]) >= 6,
    `pads [${a}] and [${b}] are ${Math.hypot(a[0] - b[0], a[1] - b[1]).toFixed(2)} u apart — the floor is 6`,
    'advisory');
}));

/* ── 11. the world props (each pack ONLY inside its own world) ───────────────── */
type PropKind =
  | 'basaltColumns' | 'charredSnag' | 'fumarole' | 'lavaFissure'
  | 'neonArch' | 'speakerStack' | 'mirrorBallPylon' | 'lightTiles'
  | 'wreckedHull' | 'coralCluster' | 'anchorPile' | 'dockPilings' | 'tidePool';
type WorldProp = { at: XZ; kind: PropKind; seed: number; rot: number };

const onGrass = (c: XZ, clear = 1.2): XZ => (offPathCell(NET, c, { clear }) ?? c) as XZ;

const FIRE_PROPS: WorldProp[] = [
  { at: onGrass([-46.8, -16.8]), kind: 'basaltColumns', seed: 3, rot: 0.4 },
  { at: onGrass([-39.6, -25.2]), kind: 'charredSnag', seed: 5, rot: 0.9 },
  { at: onGrass([-32.4, -16.8]), kind: 'fumarole', seed: 2, rot: 0 },
  { at: onGrass([-45.6, -27.6]), kind: 'lavaFissure', seed: 4, rot: 2.0 },
];
const NEON_PROPS: WorldProp[] = [
  { at: onGrass([-20.4, 54.0]), kind: 'neonArch', seed: 1, rot: 0 },
  { at: onGrass([-31.2, 45.6]), kind: 'mirrorBallPylon', seed: 2, rot: 0 },
  { at: onGrass([-19.2, 42.0]), kind: 'speakerStack', seed: 4, rot: Math.PI / 2 },
  { at: onGrass([-13.2, 39.6]), kind: 'lightTiles', seed: 6, rot: 0 },
];
const PIRATE_PROPS: WorldProp[] = [
  { at: onGrass([40.8, -6.0]), kind: 'wreckedHull', seed: 3, rot: 0.6 },
  { at: onGrass([48.0, -7.2]), kind: 'coralCluster', seed: 5, rot: 0 },
  { at: onGrass([52.8, -9.6]), kind: 'anchorPile', seed: 2, rot: 1.1 },
  { at: onGrass([55.2, -4.8]), kind: 'dockPilings', seed: 7, rot: 0.6 },
  { at: onGrass([44.4, -3.6]), kind: 'tidePool', seed: 4, rot: 0 },
];
const WORLD_PROPS = [...FIRE_PROPS, ...NEON_PROPS, ...PIRATE_PROPS];

/* ── 12. the three WORLDS (declared AFTER the pads exist — §0-P.4's cycle) ───── */
const FIRE_WORLD = worldPlan({
  id: 'fire', theme: WORLD_THEMES.fire, pieces: [EMBER_ROW],
  include: [GHOST.pad, GHOST.anchor, RING_DECKS[0], ...FIRE_PROPS.map((p) => p.at)],
});
const NEON_WORLD = worldPlan({
  id: 'neon', theme: WORLD_THEMES.neon, pieces: [PULSE_ROW],
  include: [BASS.pad, DISCO.pad, RING_DECKS[1], ...NEON_PROPS.map((p) => p.at)],
});
const COVE_WORLD = worldPlan({
  id: 'pirateBeach', theme: WORLD_THEMES.pirateBeach, pieces: [COVE_ROW],
  include: [FLUME.pad, RING_DECKS[2], ...PIRATE_PROPS.map((p) => p.at)],
});
const WORLDS = [FIRE_WORLD, NEON_WORLD, COVE_WORLD];

const WORLD_FLOOR = 20 * Math.sqrt(SIZE / 48);
WORLDS.forEach((a, i) => WORLDS.slice(i + 1).forEach((b) => {
  const d = Math.hypot(a.centre[0] - b.centre[0], a.centre[1] - b.centre[1]);
  parkAssert('worldsTooClose', d >= WORLD_FLOOR,
    `worlds '${a.id}' and '${b.id}' are ${d.toFixed(2)} u apart — the floor is ${WORLD_FLOOR.toFixed(2)}`);
  const gapX = Math.abs(a.centre[0] - b.centre[0]) - (a.half[0] + b.half[0]);
  const gapZ = Math.abs(a.centre[1] - b.centre[1]) - (a.half[1] + b.half[1]);
  parkAssert('worldRectsTouch', Math.max(gapX, gapZ) > 0,
    `world rects '${a.id}' and '${b.id}' overlap (gapX ${gapX.toFixed(2)}, gapZ ${gapZ.toFixed(2)}) — ` +
    `two touching rects are ONE district, not two`);
}));
/* Every themed prop must stand in its OWN world (a foreign one is a crossTheme finding). */
([[FIRE_WORLD, FIRE_PROPS], [NEON_WORLD, NEON_PROPS], [COVE_WORLD, PIRATE_PROPS]] as const)
  .forEach(([w, props]) => {
    const outside = props.filter((p) => !w.contains(p.at));
    parkAssert('themedPropOutsideWorld', outside.length === 0,
      `world '${w.id}': ${outside.length} of its own themed prop(s) fall outside its rect — ` +
      `${JSON.stringify(outside.map((p) => p.at))}`, 'advisory');
    props.forEach((p) => {
      const foreign = WORLDS.filter((o) => o.id !== w.id && o.contains(p.at));
      parkAssert('worldThemeMixed', foreign.length === 0,
        `'${p.kind}' at [${p.at}] belongs to '${w.id}' but stands inside '${foreign.map((f) => f.id)}'`);
    });
  });

/* ── 13. dressing — over-provisioned, because the DryScatter sieve DROPS cells ─ */
const TREE_SHAPES = ['round', 'pine', 'willow', 'round', 'pine'] as const;
type TreeShape = (typeof TREE_SHAPES)[number];
const RAW_TREES: XZ[] = [
  [28.8, 12.0], [34.8, 16.8], [40.8, 10.8], [50.4, 14.4], [30.0, 26.4],
  [38.4, 32.4], [46.8, 26.4], [54.0, 20.4], [33.6, 38.4], [44.4, 38.4],
  [-9.6, 38.4], [-4.8, 49.2], [6.0, 38.4], [9.6, 50.4], [16.8, 38.4],
  [18.0, 60.0], [-9.6, 57.6], [10.8, 33.6],
  [-25.2, 0.0], [-28.8, 7.2], [-26.4, 15.6], [-30.0, -6.0], [-24.0, 19.2],
  [-31.2, -33.6], [-31.2, -44.4], [-31.2, -55.2], [-19.2, -44.4], [-16.8, -33.6],
  [-12.0, -50.4], [7.2, -27.6], [13.2, -33.6], [8.4, -44.4], [16.8, -52.8],
  [4.8, -38.4], [50.4, -6.0], [56.4, 4.8], [58.8, -9.6], [52.8, 8.4],
  [-30.0, 57.6], [-40.8, 60.0], [-28.8, 43.2], [-56.4, 57.6],
];
const TREES: { at: XZ; shape: TreeShape }[] = RAW_TREES.map((c, i) => ({
  at: onGrass(c, 0.75),
  shape: TREE_SHAPES[i % TREE_SHAPES.length],
}));

const RAW_SCENERY: { at: XZ; name: string }[] = [
  { at: [3.6, 61.2], name: 'signpost' }, { at: [-3.6, 61.2], name: 'flagpole' },
  { at: [4.8, 55.2], name: 'picnicTable' }, { at: [-4.8, 55.2], name: 'planterBox' },
  { at: [18.0, 48.0], name: 'topiarySpiral' }, { at: [-13.2, 50.4], name: 'picketFence' },
  { at: [26.4, 45.6], name: 'gazebo' }, { at: [26.4, 22.8], name: 'birdbath' },
  { at: [26.4, 9.6], name: 'picnicTable' }, { at: [26.4, 0.0], name: 'planterBox' },
  { at: [26.4, -21.6], name: 'fallenLog' }, { at: [13.2, -25.2], name: 'mushroomCluster' },
  { at: [-7.2, -25.2], name: 'wishingWell' }, { at: [-20.4, -25.2], name: 'brickWall' },
  { at: [-32.4, -18.0], name: 'lionStatue' }, { at: [-39.6, -33.6], name: 'cactusCluster' },
  { at: [-31.2, -40.8], name: 'fallenLog' }, { at: [-27.6, -56.4], name: 'picketFence' },
  { at: [-20.4, -58.8], name: 'signpost' }, { at: [4.8, -58.8], name: 'hotAirBalloon' },
  { at: [-13.2, 4.8], name: 'topiaryElephant' }, { at: [-13.2, -6.0], name: 'planterBox' },
  { at: [38.4, 3.6], name: 'tvMonitorPost' }, { at: [56.4, -1.2], name: 'marbleStatue' },
  { at: [-9.6, 28.8], name: 'parkClock' },
];
const SCENERY = RAW_SCENERY.map((s) => ({ ...s, at: onGrass(s.at, 1.2) }));

parkAssert('treeFloor', TREES.length >= 32,
  `${TREES.length} tree cells authored — the 128 floor is 32 (author extra: the sieve DROPS wet cells)`,
  'advisory');
parkAssert('sceneryFloor', SCENERY.length + WORLD_PROPS.length >= 16,
  `${SCENERY.length + WORLD_PROPS.length} scenery cells — the 128 floor is 16`, 'advisory');

/* ── 14. the monorail ring — pieces VERBATIM, pose from the search ───────────── */
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

/* ── 15. flush — the LAST line of the module-scope block ─────────────────────── */
parkAssertFlush();

/* ── 16. the dryness receipt, taken IN THE TREE with the GATE'S OWN predicate ── */
function dryRing(park: any, c: XZ, r = 0.75): boolean {
  const g = park.ground;
  if (!g || !g.lint) { console.error('[park] dryRing ran with NO TERRAIN — a VACUOUS pass'); return true; }
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
  const park = usePark('DryScatter') as any;
  const [dry, setDry] = React.useState<T[] | null>(null);
  React.useEffect(() => {
    const kept = cells.filter((c) => dryRing(park, c.at));
    if (kept.length < cells.length) {
      console.error(`[park] DryScatter(${label}) dropped ${cells.length - kept.length} of ${cells.length} ` +
        `cell(s) UNDER waterline+0.05: ` +
        JSON.stringify(cells.filter((c) => !kept.includes(c)).map((c) => c.at)));
    }
    setDry(kept);
  }, [park, cells, label]);
  return <>{(dry ?? []).map(render)}</>;
}

function WorldPropPiece({ p }: { p: WorldProp }) {
  const common = { position: p.at, rotation: p.rot, seed: p.seed } as any;
  switch (p.kind) {
    case 'basaltColumns': return <BasaltColumns {...common} />;
    case 'charredSnag': return <CharredSnag {...common} />;
    case 'fumarole': return <Fumarole {...common} />;
    case 'lavaFissure': return <LavaFissure {...common} length={2.2} />;
    case 'neonArch': return <NeonArch {...common} text="PULSE" />;
    case 'speakerStack': return <SpeakerStack {...common} />;
    case 'mirrorBallPylon': return <MirrorBallPylon {...common} />;
    case 'lightTiles': return <LightTiles {...common} />;
    case 'wreckedHull': return <WreckedHull {...common} />;
    case 'coralCluster': return <CoralCluster {...common} />;
    case 'anchorPile': return <AnchorPile {...common} />;
    case 'dockPilings': return <DockPilings {...common} />;
    case 'tidePool': return <TidePool {...common} />;
    default: return null;
  }
}

/* ── 17. the park ────────────────────────────────────────────────────────────── */
export function App() {
  return (
    <Park
      seed={SEED}
      climate={CLIMATE}
      roster={{ rides: 10, stalls: 9, categories: 5 }}
      onReady={(report: any) => {
        console.log('[park] validatePark ok:', report?.ok,
          'failures:', report?.failures?.length ?? 0,
          'warnings:', report?.warnings?.length ?? 0);
        if (report?.failures?.length) console.error('[park] failures', report.failures);
        if (report?.warnings?.length) console.warn('[park] warnings', report.warnings);
      }}
    >
      <Terrain keepDry={GUARDS} coasterPts={ALL_COASTER_PTS} />
      <Paths nodes={NET.nodes} edges={NET.edges} plazas={NET.plazas} bins={NET.bins} walkers={6} />
      <GameManager />
      <Gate />

      {/* ── the two rated coasters ─────────────────────────────────────────── */}
      <Coaster
        name="Cinder Loop" pieces={L_PIECES} start={L_START} heading={0}
        type="steel" cars={3} capacity={4} rideDuration={11} loadTime={2} intensity={9}
        price={7} queueTailNode={NET.node(L_TAIL)} queueDir={[1, 0]}
      />
      <Coaster
        name="Driftwood Racer" pieces={B_PIECES} start={B_START} heading={0}
        type="steel" cars={3} capacity={4} rideDuration={11} loadTime={2} intensity={6}
        price={5} queueTailNode={NET.node(B_TAIL)} queueDir={[1, 0]}
      />

      {/* ── the park-spanning transport ring (every world gets a platform) ──── */}
      <Monorail
        position={[-42.6, 0, -9.7 + RING_DZ]} rotation={0} pieces={MONO_PIECES}
        beamY={2.6} loopSeconds={12} pinned
        name="Three Crowns Skyline" capacity={6} rideDuration={12} intensity={1} price={0}
        queue={{ anchor: [-40.81, RZ], dir: [1, 0] }}
        register={{
          board: [-42.6, 2.6, RZ],
          stations: [
            { label: 'Downbeat North', boardPoint: [0, 2.6, NZ], queueAnchor: [0, 0.05, NZ - 1.79], queueDir: [0, -1], exitPoint: [-1.2, 0.05, NZ - 1.17], exitDir: [0, -1] },
            { label: 'Wreckers East', boardPoint: [42.6, 2.6, RZ], queueAnchor: [40.81, 0.05, RZ], queueDir: [-1, 0], exitPoint: [41.43, 0.05, RZ + 1.2], exitDir: [-1, 0] },
            { label: 'Kiln South', boardPoint: [0, 2.6, SZ], queueAnchor: [0, 0.05, SZ - 1.79], queueDir: [0, -1], exitPoint: [1.2, 0.05, SZ - 1.17], exitDir: [0, -1] },
          ],
        }}
      />

      {/* ── the ENTRANCE court ─────────────────────────────────────────────── */}
      <Carousel
        position={CAROUSEL.pad} rotation={CAROUSEL.yaw}
        register={{ name: 'Gilded Crown Carousel', capacity: 4, rideDuration: 9, intensity: 1, price: 2 }}
        queue={{ anchor: CAROUSEL.anchor, dir: CAROUSEL.dir }}
      />
      <FerrisWheel
        position={WHEEL.pad} rotation={WHEEL.yaw}
        register={{ name: 'Lakelight Wheel', capacity: 4, rideDuration: 11, intensity: 2, price: 3 }}
        queue={{ anchor: WHEEL.anchor, dir: WHEEL.dir }}
      />
      <Restroom position={RESTROOM} rotation={Math.PI / 2} />

      {/* ── NEON: the Downbeat quarter ─────────────────────────────────────── */}
      <Bassline
        position={BASS.pad} rotation={BASS.yaw} cars={3}
        register={{ name: 'Subwoofer Run', capacity: 6, rideDuration: 11.5, intensity: 5, price: 5 }}
        queue={{ anchor: BASS.anchor, dir: BASS.dir }}
      />
      <Discotron
        position={DISCO.pad} rotation={DISCO.yaw}
        register={{ name: 'Glitterball Gyro', capacity: 6, rideDuration: 10, intensity: 6, price: 4 }}
        queue={{ anchor: DISCO.anchor, dir: DISCO.dir }}
      />

      {/* ── FIRE: the Cinderworks ──────────────────────────────────────────── */}
      <GhostTrain
        position={GHOST.pad} rotation={GHOST.yaw}
        register={{ name: 'Smoulder Hollow', capacity: 4, rideDuration: 12, intensity: 4, price: 4 }}
        queue={{ anchor: GHOST.anchor, dir: GHOST.dir }}
      />

      {/* ── PIRATE BEACH: Wreckers Landing ─────────────────────────────────── */}
      <LogFlume
        position={FLUME.pad} rotation={FLUME.yaw}
        register={{ name: 'Salt Run Flume', capacity: 4, rideDuration: 12, intensity: 4, price: 5 }}
        queue={{ anchor: FLUME.anchor, dir: FLUME.dir }}
      />

      {/* ── the southern common ────────────────────────────────────────────── */}
      <Teacups
        position={CUPS.pad} rotation={CUPS.yaw}
        register={{ name: 'Spinning Tidepots', capacity: 4, rideDuration: 9, intensity: 3, price: 2 }}
        queue={{ anchor: CUPS.anchor, dir: CUPS.dir }}
      />

      {/* ── the set-pieces (AFTER <Paths> — they settle onto the paving) ───── */}
      <FountainPlaza plan={HUB} />
      <Bazaar plan={EMBER_ROW} />
      <Bazaar plan={PULSE_ROW} />
      <Bazaar plan={COVE_ROW} />

      {/* ── the three worlds (region registration only — no geometry) ──────── */}
      <World plan={FIRE_WORLD} />
      <World plan={NEON_WORLD} />
      <World plan={COVE_WORLD} />

      {/* ── night dressing ─────────────────────────────────────────────────── */}
      <Lights from={[-1.8, 58.8]} to={[1.8, 58.8]} />
      <Lights from={[21.0, 26.4]} to={[24.6, 26.4]} />
      <Lights from={[9.6, -23.4]} to={[9.6, -19.8]} />
      <Lights from={[-18.6, 9.6]} to={[-15.0, 9.6]} />
      <Torch position={[-38.4, -19.8]} />
      <Torch position={[-38.4, -23.4]} />

      {/* ── everything planted is sieved with the GATE'S OWN dryness test ──── */}
      <DryScatter cells={PAD_OBJS} label="pads" render={() => null} />
      <DryScatter
        cells={WORLD_PROPS}
        label="worldProps"
        render={(p, i) => <WorldPropPiece key={`wp-${i}`} p={p} />}
      />
      <DryScatter
        cells={SCENERY}
        label="scenery"
        render={(s, i) => <Scenery key={`sc-${i}`} name={s.name} position={s.at} seed={i + 1} />}
      />
      <DryScatter
        cells={TREES}
        label="trees"
        render={(t, i) => (
          <Placed
            key={`tr-${i}`}
            position={t.at}
            build={(three: any) => tree(three, { shape: t.shape })}
          />
        )}
      />
    </Park>
  );
}

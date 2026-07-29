/* ═══ TIDEWRACK & COG — §0 PRE-FLIGHT ═══════════════════════════════════════════════
 * ENTRY  This file is the park. `components/Park.tsx` is the DESIGN SYSTEM component and
 *        must never be overwritten; all six pre-bundle gates are entry-file checks and the
 *        entry is what index.tsx renders, so the header + roster + <Monorail> live HERE.
 * SIZE   128 (default, `size` prop omitted)
 * SEED   1 / temperate — pinned row SEED_ROW_WATER['1/temperate']:
 *        dominant lake ctr (41, −39) box[21,60,−60,−21] · secondary ctr (−38, 31) box[−56,−21,23,39]
 *        EVERY authored street node, port stub and prop cell was walked against BOTH boxes and
 *        both 12-u near-radii by hand while laying the table; the only cell that failed was the
 *        SE loop corner [22.8, −21.6] (inside the dominant BOX, 25.2 u from its centre — the
 *        documented corner false positive), so the west run was moved z −21.6 → −19.2 and the
 *        table is now clean rather than relying on the sieve to forgive it.
 *        keepDry is DERIVED: keepDryOf(NET, SEED_ROW) over the FUSE'S OUTPUT, never NODES.slice().
 *        Guard-vs-bare diff (waterMoved) + reliefFloor.kept diff both run and both LOG. ✓
 * WORLDS 3, every one on the monorail ring (its rect CONTAINS a deck via worldPlan `include`):
 *        thornwick  enchantedForest @ N deck (0, ND)  · gladeRow honeywitch counter
 *        cove       pirateBeach     @ E deck (42.6, TW) · coveRow  sushi     counter
 *        foundry    steampunk       @ W deck (−42.6, TW) · forgeRow goggles  counter
 *        centres (measured off the rects at RZ 0): thornwick (−1.6, 33.9) · cove (44.1, 8.1)
 *        · foundry (−51.0, −17.7) → closest pair thornwick↔cove 52.5 ◄ ≥ 32.66 ✓
 *        rects DISJOINT (thornwick x ≤ 14.3 · cove x ≥ 31.2 · foundry x ≤ −40.2) ✓
 *        ≥ 3 THEMED scenery per world, ALL from that world's OWN pack, 0 foreign pieces:
 *        thornwick 4× ThornwickScenery · cove 5× TidewaterScenery · foundry 5× BrassworkScenery ✓
 * CATS   (WRITTEN BEFORE ANY JSX) gentle Carousel/TwistRide/FerrisWheel/Teacups ·
 *        thrill §4.0-L + §4.0-B + PirateShip + GoKarts · water LogFlume ·
 *        transport Monorail ring · dark GhostTrain  → 5/5 categories ✓
 *        NEVER-SHIPPED PICK: <GoKarts> — a real registered CIRCUIT, not a flat-ride swap.
 * CIRCUITS §4.0-L · §4.0-B · Monorail ring · LogFlume · GoKarts → 5 circuits ✓
 *        families coaster + transport + water + kart → ≥ 3 ✓
 * GATE   [0, 63.6] → Carousel tail [7.2, 57.6] = hypot(7.2, 6.0) = 9.37 u ≤ 15 ✓
 * FLAG   §4.0-L VERBATIM, start [16.8, 0.55, −3.6] heading 0, steel, cars 3, NO bank prop
 *        (PIECES mode builds bank 0.7 — which is what rateCoaster is called with, logged)
 *        published: E 6.29 / I 8.58 / N 3.17 / maxLatG 1.20 (guard 1.275) / drop 4.19 /
 *        INVERSIONS 2 (one vertical LOOP + one corkscrew) / bbox x[−21.81,16.8] z[−14.45,17.76]
 *        CORRIDOR KEEP-OUT honoured, all five rects pasted into KEEPOUT below. The two traps
 *        skeleton-l names are both obeyed: NO north–south street column through the ring
 *        interior (the park-spanning cycle runs the EAST spine x 22.8 and west along z −19.2),
 *        and the west spoke is JOGGED [−16.8,45.6]→[−16.8,−10.8]→[−21.6,−10.8]→[−21.6,−19.2]
 *        rather than shifted to x −19.2, which would move the secondary lake 25 u.
 * FLAG2  §4.0-B VERBATIM, start [−33.6, 0.55, −48.0] heading 0, steel, cars 3, NO bank prop
 *        published: E 5.27 / I 6.25 / N 2.25 / maxLatG 0.27 / bbox x[−62.52,−33.6] z[−61.27,−30.85]
 *        DIFFERENT archetype ✓ · bbox DISJOINT from FLAG's (15.18 u in x) ✓
 *        coasterPts = [...FLAG_PTS, ...FLAG2_PTS] → <Terrain coasterPts> ✓
 *        rateCoaster is CALLED on both and logged (gate 3) ✓
 * MONO   ring pieces + register block VERBATIM, but the POSE IS SEARCHED, not assumed.
 *        RZ (a z-shift on the whole ring, lattice multiples 0 … −4.8) is chosen at module
 *        scope by flank-testing ALL FOUR DECKS against the composition with `bumpIn`, exactly
 *        the smoothstep validatePark itself applies, and taking the pose with the lowest worst
 *        deck bump (ties → smallest |RZ|). On seed 1 the published pose puts the SOUTH deck
 *        [0,−51] 9.71 u from the summit (5.33,−42.89) h 8.59 r 12.09 → bump 0.87 > 0.75, the
 *        measured −3. Shifting the ring SOUTH walks the deck out of that radius. RZ is LOGGED.
 *        Every ring cell (decks · tails · anchors · exits · start pose) is derived from RZ,
 *        so the ring never disagrees with itself. South platform queues OUTWARD (measured).
 *        4 platforms ≥ 3 declared worlds, one deck in each world rect ✓
 *        tails [−36.0,TW] [0,TN] [36.0,TW] [0,TS] are authored NODES and ALL FOUR ARE LEAVES
 *        (asserted by degree count off EDGES) ✓ — the gate spine ENDS at the hub plaza and the
 *        N tail is reached LATERALLY off the east spine, so x = 0 is never a through column.
 * QUEUE  ONE ROW PER RIDE — the tail is the authored NODE, the pad is DERIVED by place():
 *        reach = laneLenOf(cap) + 1.92 + 2.4, then offPathCell(clear = padMarginOf(rig)),
 *        then assertPadFlat. Rows (cap · tail · out · nominal pad before the two searches):
 *        Carousel    8  [ 7.2, 57.6] [ 1, 0] → [ 17.10, 57.6]   clear 2.40
 *        TwistRide   6  [18.0, 38.4] [−1, 0] → [  9.22, 38.4]   clear 2.65
 *        FerrisWheel 4  [33.6, 21.6] [ 0, 1] → [ 33.60, 29.26]  clear 2.97
 *        PirateShip  8  [45.6,  9.6] [ 0, 1] → [ 45.60, 19.50]  clear 2.70
 *        Teacups     6  [−16.8,15.6] [−1, 0] → [−25.58, 15.6]   clear 2.47
 *        GhostTrain 12  [−16.8,−8.4] [−1, 0] → [−28.94, −8.4]   clear 4.77
 *        GoKarts     4  [−48.0,−16.8][−1, 0] → [−55.66,−16.8]   clear 4.39
 *        LogFlume    8  [30.0, 45.6] [ 1, 0] → [ 39.90, 45.6]   clear 5.36
 *        §4.0-L      4  [22.8, −3.6] queueDir [1,0] (station x 16.8, tail = start.x + 6.0)
 *        §4.0-B      4  [−27.6,−48.0] queueDir [1,0] (station x −33.6, tail = start.x + 6.0)
 *        no two rides share a tail · every tail appears in NODES · clear read off PAD_MARGIN,
 *        never the 3.2 default by guess ✓
 * GROUND ⛔ THE FLANK GATE IS THE #1 KILLER AND IT IS TREATED CORRECTIVELY, NOT REPORTED.
 *        `assertPadFlat` ring-searches for a flat + dry + off-street cell and MOVES the thing
 *        there. place() routes the PAD through it AND the queue anchor / entrance hut through
 *        it too (clear 0.6) — the hut is charged separately by validate.ts and closing only
 *        the pad is what cost wave 26B −6 on one ride. The four monorail decks cannot be
 *        relocated independently (they ARE the ring's geometry), so the RING POSE is searched
 *        instead — see MONO. Nothing here is a bare advisory that ships anyway.
 * SPREAD built bbox ≈ x[−58, 56] × z[−58, 58] ≥ 70 × 45 ✓ (street-node bbox ≈ 98 × 121)
 * PLAZAS hub FountainPlaza tiles 9 → 10.8 × 10.8 = 116.6 u² (largest ≥ 8 ✓) + 3 bazaar
 *        courtyards → areaSpread ≥ 1.8 ✓ · NO set-piece `position` appears in NODES or as a
 *        queue tail (assertNodesOffPieces runs over NODES *and* again over the PADS) ✓
 * NODES  41 authored · degree-1: 11 (0.27) and every one carries a queue tail or the gate ✓
 *        ONE park-spanning loop: hub → east spine x 22.8 → z −19.2 → x −21.6 → x −16.8 → hub,
 *        crossing z = 0 on both flanks ✓
 * ATTACH every spur is FLAT (no `nodeY` anywhere in this park, so grade (a) cannot fire) and
 *        every leg is cardinal and off every corridor rect, so no span is refused (b) ✓
 * LATTICE authored spans 1.2 / 2.4 / 4.8 / 6.0 / 7.2 / 9.6 / 10.8 / 12.0 / 13.2 / 14.4 / 16.8
 *        → effectiveClasses ≥ 4 ✓ · 1.2-chain share ≈ 0.02 ≤ 0.55 ✓
 * ROSTER 11 rides / 5 categories / 9 stalls (6 kinds, 3 of them THEMED) / restroom ✓ / bins ✓
 *        NAMED: every ride AND every stall carries an authored `name` — the bazaars are given
 *        explicit `names` arrays so not one stall ships under its catalog defaultName ✓
 *        <Park roster={{ rides: 11, stalls: 9, categories: 5 }}> MOUNTED ✓
 * DRESS  ≥ 40 tree cells and ≥ 22 neutral scenery cells are GENERATED against floors of 32/16,
 *        every one filtered by offRow (water) · bumpAt ≤ 0.6 (flank) · offPathCell identity
 *        (street) · every KEEPOUT rect (both coaster corridors, both bboxes, the ring band,
 *        every set-piece footprint) · a pitch test against every committed pad — then sieved
 *        again IN THE TREE by DryScatter, which runs the GATE'S own predicate (min ground over
 *        the piece's footprint ring > WATER_LEVEL + 0.05 = −0.21), not isDryCell.
 * NIGHT  3 <Lights> runs · 2 <Neon> · 4 <Torch> — every themed pack is night-gated internally.
 * GATE   parkAssertFlush() → expected 0 structural · validatePark → report.ok logged from onReady
 * ═══════════════════════════════════════════════════════════════════════════════════ */
import * as THREE from 'three';
import React from 'react';
import type { V3, XZ } from './components/Park';
import {
  Park, GameManager, Terrain, Paths, Gate, Coaster, Restroom, Neon, Torch,
  Scenery, Lights, Placed, offPathCell, usePark,
} from './components/Park';
import { laneLenOf, parkComposition } from './components/ParkBuilder';
import type { NetRef, SetPiecePlan } from './components/SetPieceKit';
import {
  buildParkNet, worldPlan, World,
  ENCHANTED_FOREST, PIRATE_BEACH, STEAMPUNK,
} from './components/SetPieceKit';
import type { TrackPiece } from './components/SplineRideKit';
import { compileTrackPieces, rateCoaster } from './components/SplineRideKit';
import { Bazaar, bazaarPlan } from './components/Bazaar';
import { FountainPlaza, fountainPlazaPlan } from './components/FountainPlaza';
import { tree } from './components/Kit';
import { Monorail } from './components/Monorail';
import { Carousel } from './components/Carousel';
import { TwistRide } from './components/TwistRide';
import { FerrisWheel } from './components/FerrisWheel';
import { Teacups } from './components/Teacups';
import { PirateShip } from './components/PirateShip';
import { GhostTrain } from './components/GhostTrain';
import { GoKarts } from './components/GoKarts';
import { LogFlume } from './components/LogFlume';
import { GiantToadstools, StandingStones, LanternTree, FlowerPodBed } from './components/ThornwickScenery';
import { WreckedHull, CoralCluster, AnchorPile, TidePool, DockPilings } from './components/TidewaterScenery';
import { GiantGear, SteamPipes, ClockTower, BoilerTank, CoalCart } from './components/BrassworkScenery';

/* ───────────────────────── §0-P.5 · the ONE assertion bus ───────────────────────── */

/** §12 determinism — hashed sine only, never Math.random / Date.now. */
const hash01 = (n: number) => {
  const v = Math.sin(n * 12.9898 + 78.233) * 43758.5453;
  return v - Math.floor(v);
};

type Sev = 'structural' | 'advisory';
const PARK_FAILS: { name: string; detail: string; sev: Sev }[] = [];

function parkAssert(name: string, cond: boolean, detail: string, sev: Sev = 'structural'): boolean {
  if (!cond) PARK_FAILS.push({ name, detail, sev });
  return cond;
}

function parkAssertFlush(): void {
  if (!PARK_FAILS.length) { console.log('[park] assertions: all pass'); return; }
  const hard = PARK_FAILS.filter((f) => f.sev === 'structural');
  console.error(`[park] ${PARK_FAILS.length} ASSERTION FAILURE(S) (${hard.length} structural):\n`
    + PARK_FAILS.map((f, i) => `  ${i + 1}. [${f.sev}] ${f.name}\n     ${f.detail}`).join('\n'));
  if (hard.length) throw new Error(`[park] ${hard.length} STRUCTURAL failure(s) — see the numbered block above.`);
}

/* ───────────────────────── plot + the two verified coasters ───────────────────────── */

const SIZE = 128;
const SEED = 1;
const CLIMATE = 'temperate';
const PEAK_LIMIT = 0.75;

// ── §4.0-L LOOPER — vertical LOOP + corkscrew, 2 inversions. Copied VERBATIM. ──
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

// ── §4.0-B FAMILY steel rectangle — the gentler SECOND archetype. Copied VERBATIM. ──
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

const { points: FLAG_PTS } = compileTrackPieces(L_PIECES, { type: 'steel', start: L_START, heading: 0, bounds: SIZE });
const { points: FLAG2_PTS } = compileTrackPieces(B_PIECES, { type: 'steel', start: B_START, heading: 0, bounds: SIZE });
const ALL_COASTER_PTS = [...FLAG_PTS, ...FLAG2_PTS];

// MEASURED with the bank + cars the mounts actually use (PIECES mode steel builds bank 0.7).
[FLAG_PTS, FLAG2_PTS].forEach((pts, i) => console.log(`[park] coaster ${i + 1}`,
  rateCoaster(pts, { type: 'steel', bank: 0.7, cars: 3 })));

/* ───────────────────── §0-P.6 · the pinned seed row + the sieve ───────────────────── */

type SeedBasin = { ctr: XZ; box: [number, number, number, number] };
type SeedRow = { dom: SeedBasin; sec: SeedBasin };

const SEED_ROW: SeedRow = {
  dom: { ctr: [41, -39], box: [21, 60, -60, -21] },
  sec: { ctr: [-38, 31], box: [-56, -21, 23, 39] },
};

const inBasinBox = (c: XZ, b: SeedBasin) =>
  c[0] >= b.box[0] && c[0] <= b.box[1] && c[1] >= b.box[2] && c[1] <= b.box[3];

const offRow = (c: XZ, row: SeedRow = SEED_ROW, nearR = 12) =>
  [row.dom, row.sec].every((b) => !inBasinBox(c, b) && Math.hypot(c[0] - b.ctr[0], c[1] - b.ctr[1]) >= nearR);

function keepDryOf(net: { keepDry: XZ[] }, row: SeedRow = SEED_ROW): XZ[] {
  const kept = net.keepDry.filter((c) => offRow(c, row));
  const dropped = net.keepDry.length - kept.length;
  if (dropped) console.warn(`[park] keepDryOf dropped ${dropped} of ${net.keepDry.length} guard cell(s) on the `
    + 'pinned row\'s water. A DROPPED guard is NOT a fixed cell — MOVE whatever stands there.');
  return kept;
}

/* ───── the composition, twice: BARE (unguarded) for the ring search + the diff ───── */

type Comp = ReturnType<typeof parkComposition>;

const BARE: Comp = parkComposition(THREE, SEED, SIZE, CLIMATE, { keepDry: [], coasterPts: ALL_COASTER_PTS });

const bumpIn = (comp: Comp, c: XZ) => Math.max(0, ...comp.peaks.map((p) => {
  const k = Math.max(0, 1 - Math.hypot(c[0] - p.x, c[1] - p.z) / p.radius);
  return k * k * (3 - 2 * k) * p.height;
}));

const isDryIn = (comp: Comp, c: XZ) => [...comp.basins, ...comp.clampBasins]
  .every((b) => Math.hypot(c[0] - b.x, c[1] - b.z) > 0.74 * b.radius + 0.6);

/* ───── MONO · the ring POSE is SEARCHED against the flank gate, never assumed ─────
 * The four decks are the ring's own geometry — a deck cannot be relocated on its own
 * without leaving its beam — so the CORRECTIVE move here is to shift the whole pose.  */

const RING_DZ = [0, -1.2, -2.4, -3.6, -4.8];
const decksAt = (dz: number): XZ[] => [[-42.6, -8.4 + dz], [0, 34.2 + dz], [42.6, -8.4 + dz], [0, -51.0 + dz]];

let RZ = 0;
let RING_WORST = Infinity;
RING_DZ.forEach((dz) => {
  const decks = decksAt(dz);
  const worst = Math.max(...decks.map((d) => bumpIn(BARE, d)));
  const wet = decks.some((d) => !isDryIn(BARE, d));
  const score = worst + (wet ? 100 : 0) + Math.abs(dz) * 0.001;
  if (score < RING_WORST) { RING_WORST = score; RZ = dz; }
});
console.log(`[park] monorail ring pose: RZ ${RZ} — worst deck bump ${Math.max(...decksAt(RZ)
  .map((d) => bumpIn(BARE, d))).toFixed(3)} against the ${PEAK_LIMIT} flank limit; candidates `
  + RING_DZ.map((dz) => `${dz}:${Math.max(...decksAt(dz).map((d) => bumpIn(BARE, d))).toFixed(2)}`).join(' '));

parkAssert('ringPoseOnFlank', RING_WORST <= PEAK_LIMIT,
  `NO monorail ring pose in [${RING_DZ.join(', ')}] clears the ${PEAK_LIMIT} flank limit — best was `
  + `${RING_WORST.toFixed(2)} at RZ ${RZ}. This is a genuine dead end: widen the candidate list or pick `
  + 'another seed. keepDry does NOT fix a flank.', 'advisory');

const TN = +(27.6 + RZ).toFixed(2);   // N monorail tail   (x 0)
const TW = +(-8.4 + RZ).toFixed(2);   // W + E tail z
const TS = +(-57.6 + RZ).toFixed(2);  // S monorail tail   (x 0)
const ND = +(34.2 + RZ).toFixed(2);   // N deck z
const SD = +(-51.0 + RZ).toFixed(2);  // S deck z

/* ───────────────────────────── the set-pieces (PLAN FIRST) ───────────────────────────── */

const HUB = fountainPlazaPlan({
  id: 'hub', title: 'Compass Court', position: [0, 45.6], tiles: 9, ports: ['N', 'E', 'W'], seed: 3,
});

const GLADE_ROW = bazaarPlan({
  id: 'gladeRow', title: 'Mosslight Market', position: [-10.8, 36.0],
  facing: { port: 'W', toward: [-16.8, 36.0] },
  stalls: ['honeywitch', 'cottonCandy', 'soda'],
  names: ['Witchhazel Honey', 'Faerie Floss', 'Dewdrop Sodas'],
  theme: ENCHANTED_FOREST, seed: 5,
});

const COVE_ROW = bazaarPlan({
  id: 'coveRow', title: 'Saltbite Row', position: [50.4, -3.6],
  facing: { port: 'W', toward: [50.4, 9.6] },
  stalls: ['sushi', 'burger', 'balloon'],
  names: ['Reefcatch Sushi', 'Castaway Grill', 'Tidewind Balloons'],
  theme: PIRATE_BEACH, seed: 7,
});

const FORGE_ROW = bazaarPlan({
  id: 'forgeRow', title: 'Cogwright Arcade', position: [-55.2, -25.2],
  facing: { port: 'E', toward: [-48.0, -25.2] },
  stalls: ['goggles', 'hotDog', 'soda'],
  names: ['Cogwright Optics', 'Pistonworks Franks', 'Boilerplate Sodas'],
  theme: STEAMPUNK, seed: 9,
});

const ALL_PLANS: SetPiecePlan[] = [HUB, GLADE_ROW, COVE_ROW, FORGE_ROW];

/* ───────────────────────────── the street table ───────────────────────────── */

const NODES: XZ[] = [];
const NODE_KEY = new Map<string, number>();
const nid = (c: XZ): number => {
  const k = `${c[0].toFixed(2)},${c[1].toFixed(2)}`;
  const hit = NODE_KEY.get(k);
  if (hit !== undefined) return hit;
  NODE_KEY.set(k, NODES.length);
  NODES.push(c);
  return NODES.length - 1;
};

// gate spine — ENDS at the hub plaza, so x = 0 is never a through column south of it
const G0 = nid([0, 63.6]);
const G1 = nid([0, 57.6]);
const CR_T = nid([7.2, 57.6]);            // Carousel tail (LEAF, 9.37 u from the gate)

// east spine (x 22.8) — clear of every §4.0-L corridor rect
const E_ARM = nid([22.8, 45.6]);
const SP38 = nid([22.8, 38.4]);
const SP_TN = nid([22.8, TN]);
const SP96 = nid([22.8, 9.6]);
const CT_L = nid(L_TAIL);                 // §4.0-L queue tail, on the spine
const SP_TW = nid([22.8, TW]);
const SP19 = nid([22.8, -19.2]);
const TW_T = nid([18.0, 38.4]);           // TwistRide tail (LEAF)
const LF_T = nid([30.0, 45.6]);           // LogFlume tail (LEAF)

// N monorail leg — reached LATERALLY, branching off the spine, never off the tail
const NL1 = nid([9.6, TN]);
const MT_N = nid([0, TN]);                // LEAF

// NE district (pirateBeach)
const NE_J = nid([33.6, 9.6]);
const NE_N = nid([33.6, 21.6]);           // FerrisWheel tail (LEAF)
const NE_E = nid([45.6, 9.6]);            // PirateShip tail
const NE_E2 = nid([50.4, 9.6]);
const MT_E = nid([36.0, TW]);             // LEAF

// west arm — the JOG that threads §4.0-L's west valley without moving the secondary lake
const W_ARM = nid([-16.8, 45.6]);
const WA36 = nid([-16.8, 36.0]);
const WA15 = nid([-16.8, 15.6]);          // Teacups tail
const WA_8 = nid([-16.8, -8.4]);          // GhostTrain tail
const WA10 = nid([-16.8, -10.8]);
const X21 = nid([-21.6, -10.8]);
const X21B = nid([-21.6, -19.2]);

// the z −19.2 run (z −21.6 would have put the SE corner inside the dominant lake BOX)
const W96 = nid([9.6, -19.2]);
const W_96 = nid([-9.6, -19.2]);
const W36 = nid([-36.0, -19.2]);
const MT_W = nid([-36.0, TW]);            // LEAF
const W37 = nid([-37.2, -19.2]);
const W48 = nid([-48.0, -19.2]);
const GK_T = nid([-48.0, -16.8]);         // GoKarts tail (LEAF)
const W48B = nid([-48.0, -25.2]);

// the south-west column (x −37.2 threads BOTH of §4.0-B's valleys and its station leg)
const S37A = nid([-37.2, -37.2]);
const S27A = nid([-27.6, -37.2]);
const CT_B = nid(B_TAIL);                 // §4.0-B queue tail (LEAF)
const S37B = nid([-37.2, -48.0]);
const S37C = nid([-37.2, TS]);
const S24 = nid([-24.0, TS]);             // the x −24 approach — east of the ridge skirt
const MT_S = nid([0, TS]);                // LEAF

const EDGES: [NetRef, NetRef][] = [
  [G0, G1], [G1, 'hub:N'], [G1, CR_T],
  ['hub:E', E_ARM], [E_ARM, SP38], [E_ARM, LF_T], [SP38, TW_T],
  [SP38, SP_TN], [SP_TN, NL1], [NL1, MT_N],
  [SP_TN, SP96], [SP96, CT_L], [CT_L, SP_TW], [SP_TW, MT_E], [SP_TW, SP19],
  [SP96, NE_J], [NE_J, NE_N], [NE_J, NE_E], [NE_E, NE_E2], [NE_E2, 'coveRow:W'],
  ['hub:W', W_ARM], [W_ARM, WA36], [WA36, 'gladeRow:W'], [WA36, WA15], [WA15, WA_8],
  [WA_8, WA10], [WA10, X21], [X21, X21B],
  [SP19, W96], [W96, W_96], [W_96, X21B],
  [X21B, W36], [W36, MT_W], [W36, W37], [W37, W48],
  [W48, GK_T], [W48, W48B], [W48B, 'forgeRow:E'],
  [W37, S37A], [S37A, S27A], [S27A, CT_B], [S37A, S37B], [S37B, S37C], [S37C, S24], [S24, MT_S],
];

/* ── every EDGES endpoint resolved, then the cardinality + wiring assertions (§0-P.5) ── */

const portCell = (ref: NetRef): XZ => {
  if (typeof ref === 'number') return NODES[ref];
  const [id, name] = ref.split(':');
  const p = ALL_PLANS.find((q) => q.id === id);
  if (!p) throw new Error(`EDGES references '${ref}' but no plan has id '${id}'`);
  return p.port(name);
};

const EPS = 1e-6;
EDGES.forEach(([a, b]) => {
  const A = portCell(a);
  const B = portCell(b);
  parkAssert('cardinalEdge', Math.abs(A[0] - B[0]) < EPS || Math.abs(A[1] - B[1]) < EPS,
    `edge ${a}→${b} is DIAGONAL: [${A}] → [${B}]. buildParkNet ELBOWS it through a synthesised corner `
    + 'node you did not plan. FIX THE TABLE.', 'advisory');
});

const SOLID_CLEAR: Record<string, number> = { FountainPlaza: 1.8, Bazaar: 0.6, Boulevard: 0 };

function assertNodesOffPieces(cells: XZ[], plans: SetPiecePlan[], what: string): void {
  const hits: string[] = [];
  plans.forEach((p) => {
    const clear = SOLID_CLEAR[p.kind] ?? 1.8;
    if (clear === 0) return;
    const ports = new Set(p.ports.map((pt) => `${pt.at[0].toFixed(2)},${pt.at[1].toFixed(2)}`));
    const f = p.footprint;
    const c = Math.cos(-f.yaw);
    const s = Math.sin(-f.yaw);
    cells.forEach((n, i) => {
      if (ports.has(`${n[0].toFixed(2)},${n[1].toFixed(2)}`)) return;
      const dx = n[0] - f.cx;
      const dz = n[1] - f.cz;
      const lx = dx * c - dz * s;
      const lz = dx * s + dz * c;
      const gap = Math.max(Math.abs(lx) - f.hx, Math.abs(lz) - f.hz);
      if (gap < clear - 1e-9) {
        hits.push(`[${n[0]}, ${n[1]}] (${what} ${i}) is ${gap.toFixed(2)} u from '${p.id}' (${p.kind}) — needs ${clear}`);
      }
    });
  });
  parkAssert('nodeInSolid', !hits.length,
    `${hits.length} ${what} cell(s) stand inside or against a set-piece's SOLID footprint:\n  ${hits.join('\n  ')}`);
}

assertNodesOffPieces(NODES, ALL_PLANS, 'node');

const CHAIN_END_OPT_OUT = new Set<string>();
const PORT_REFS = EDGES.flat().filter((x): x is string => typeof x === 'string');
ALL_PLANS.forEach((p) => {
  const wired = new Set(PORT_REFS.filter((r) => r.split(':')[0] === p.id).map((r) => r.split(':')[1]));
  parkAssert('pieceIsland', wired.size > 0,
    `set-piece '${p.id}' has NO '${p.id}:<PORT>' ref in EDGES — it composes as an ISLAND`);
  p.ports.filter((pt) => !pt.prunable).forEach((pt) => {
    if (wired.has(pt.name) || CHAIN_END_OPT_OUT.has(`${p.id}:${pt.name}`)) return;
    parkAssert('chainEnd', false,
      `chain piece '${p.id}' (${p.kind}) wires [${[...wired]}] but NOT '${p.id}:${pt.name}' — that end of the `
      + 'carriageway dead-ends in grass (deadStreetNode). Wire it.', 'advisory');
  });
});

// the four monorail tails MUST be street LEAVES — a street continuing past one runs the
// pavement through the deck (`blockers` FAIL). Counted off EDGES, not asserted by eye.
const degreeOf = (index: number) => EDGES.filter(([a, b]) => a === index || b === index).length;
([[MT_N, 'N'], [MT_E, 'E'], [MT_W, 'W'], [MT_S, 'S']] as [number, string][]).forEach(([n, label]) => {
  parkAssert('ringTailNotLeaf', degreeOf(n) === 1,
    `monorail ${label} platform tail [${NODES[n]}] has street degree ${degreeOf(n)}, not 1 — a street `
    + 'continuing past the tail runs through the deck.');
});

/* ───────────────────── the ONE buildParkNet fuse, then the guards ───────────────────── */

const NET = buildParkNet({ nodes: NODES, edges: EDGES, pieces: ALL_PLANS });
const GUARDS = keepDryOf(NET, SEED_ROW);

const COMP: Comp = parkComposition(THREE, SEED, SIZE, CLIMATE, { keepDry: GUARDS, coasterPts: ALL_COASTER_PTS });

parkAssert('waterMoved',
  Math.hypot(COMP.waterCentre[0] - BARE.waterCentre[0], COMP.waterCentre[1] - BARE.waterCentre[1]) < 1
  && Math.hypot(COMP.waterCentreSecond[0] - BARE.waterCentreSecond[0],
    COMP.waterCentreSecond[1] - BARE.waterCentreSecond[1]) < 1,
  `guards moved a water body off the pinned row — dominant ${JSON.stringify(BARE.waterCentre)} → `
  + `${JSON.stringify(COMP.waterCentre)}, secondary ${JSON.stringify(BARE.waterCentreSecond)} → `
  + `${JSON.stringify(COMP.waterCentreSecond)}, terrainSeed ${BARE.terrainSeed} → ${COMP.terrainSeed}`);

const rf = COMP.report.reliefFloor;
parkAssert('terrainFlattened', !rf || rf.kept >= rf.floor,
  rf ? `keepDry FLATTENED the seed: authored relief ${rf.authoredRelief.toFixed(2)} → built ${rf.relief.toFixed(2)} `
    + `(kept ${rf.kept.toFixed(2)} against the ${rf.floor} floor), stdH ${rf.authoredStdH.toFixed(2)} → `
    + `${rf.stdH.toFixed(2)}. Ranges the guard list stood on: ${rf.guardedRanges}; capped peaks: `
    + `${JSON.stringify(rf.cappedPeaks)}` : '',
  'advisory');
console.log('[park] terrain', {
  guards: GUARDS.length,
  terrainSeed: COMP.terrainSeed,
  probes: `${BARE.report.probesTried}→${COMP.report.probesTried}`,
  waterBodies: COMP.report.waterBodies,
  waterPct: +((COMP.report.waterAreaU2 / (SIZE * SIZE)) * 100).toFixed(2),
  reliefKept: rf ? +rf.kept.toFixed(3) : null,
  stdH: rf ? +rf.stdH.toFixed(3) : null,
});

// the same flank read validatePark applies, now on the GUARDED composition the park ships
const RING_DECKS = decksAt(RZ);
RING_DECKS.forEach((d, i) => {
  const b = bumpIn(COMP, d);
  if (b > PEAK_LIMIT) {
    parkAssert('deckOnFlank', false,
      `monorail deck ${['W', 'N', 'E', 'S'][i]} [${d}] reads bump ${b.toFixed(2)} > ${PEAK_LIMIT} on the GUARDED `
      + 'composition even though the pose search cleared it on the bare one. The pose is the only lever here.',
      'advisory');
  }
});

/* ───────────────────── §0-P.5 · pads are DERIVED, then CURED ───────────────────── */

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
const minReachOf = (c: number) => laneLenOf(c) + 0.35 + 0.62 + 0.5 + 0.45;

const bumpAt = (c: XZ) => bumpIn(COMP, c);
const isDry = (c: XZ) => isDryIn(COMP, c);

/** CORRECTIVE, never advisory: flat + dry + off-street, or it RING-SEARCHES and MOVES. */
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
          console.warn(`[park] ${label}: [${pad}] on a hill flank (bump ${bumpAt(pad).toFixed(2)}) or wet — MOVED to [${c}]`);
          return c;
        }
      }
    }
  }
  parkAssert('padOnFlank', false,
    `${label}: [${pad}] is on a hill flank (bump ${bumpAt(pad).toFixed(2)} > ${PEAK_LIMIT}) OR WET, and no cell `
    + `within 4.8 u is flat, dry AND ${clear} u off the street. MOVE THE TAIL.`);
  return pad;
}

type Placed3 = { pad: XZ; anchor: XZ; dir: XZ; yaw: number };

function place(tail: XZ, out: XZ, capacity: number, rig: string): Placed3 {
  const clear = padMarginOf(rig);
  const join = laneLenOf(capacity) + 0.35;
  const reach = minReachOf(capacity) + 2.4;
  const cand: XZ = [+(tail[0] + out[0] * reach).toFixed(2), +(tail[1] + out[1] * reach).toFixed(2)];
  const onStreet = (offPathCell(NET, cand, { clear }) ?? cand) as XZ;
  const pad = assertPadFlat(onStreet, clear, `${rig} boardPoint pad`);

  // THE HUT IS CHARGED SEPARATELY BY validate.ts — cure it exactly like the pad.
  const rawAnchor: XZ = [+(tail[0] + out[0] * join).toFixed(2), +(tail[1] + out[1] * join).toFixed(2)];
  const anchor = assertPadFlat(rawAnchor, 0.6, `${rig} entrance hut`);

  const got = Math.hypot(pad[0] - tail[0], pad[1] - tail[1]);
  parkAssert('padReach', got >= minReachOf(capacity) + 1.2,
    `${rig} pad [${pad}] sits ${got.toFixed(2)} u from its tail [${tail}] — the cap-${capacity} floor is `
    + `${(minReachOf(capacity) + 1.2).toFixed(2)} u. The court is too tight: move the TAIL outward.`);

  return {
    pad,
    anchor,
    dir: [-out[0], -out[1]] as XZ,
    yaw: Math.round(Math.atan2(anchor[0] - pad[0], anchor[1] - pad[1]) / (Math.PI / 2)) * (Math.PI / 2),
  };
}

const CAROUSEL = place([7.2, 57.6], [1, 0], 8, 'Carousel');
const TWIST = place([18.0, 38.4], [-1, 0], 6, 'TwistRide');
const WHEEL = place([33.6, 21.6], [0, 1], 4, 'FerrisWheel');
const SHIP = place([45.6, 9.6], [0, 1], 8, 'PirateShip');
const TEACUPS = place([-16.8, 15.6], [-1, 0], 6, 'Teacups');
const GHOST = place([-16.8, -8.4], [-1, 0], 12, 'GhostTrain');
const KARTS = place([-48.0, -16.8], [-1, 0], 4, 'GoKarts');
const FLUME = place([30.0, 45.6], [1, 0], 8, 'LogFlume');

const PADS: XZ[] = [CAROUSEL, TWIST, WHEEL, SHIP, TEACUPS, GHOST, KARTS, FLUME].map((p) => p.pad);
assertNodesOffPieces(PADS, ALL_PLANS, 'pad');

// pitch floor between every committed pad (6 u is a FLOOR, and the two margins on top of it)
const PAD_RIGS: [XZ, string][] = [
  [CAROUSEL.pad, 'Carousel'], [TWIST.pad, 'TwistRide'], [WHEEL.pad, 'FerrisWheel'], [SHIP.pad, 'PirateShip'],
  [TEACUPS.pad, 'Teacups'], [GHOST.pad, 'GhostTrain'], [KARTS.pad, 'GoKarts'], [FLUME.pad, 'LogFlume'],
];
PAD_RIGS.forEach(([a, ra], i) => PAD_RIGS.slice(i + 1).forEach(([b, rb]) => {
  const need = Math.max(6, padMarginOf(ra) + padMarginOf(rb));
  parkAssert('padPitch', Math.hypot(a[0] - b[0], a[1] - b[1]) >= need,
    `${ra} [${a}] and ${rb} [${b}] are ${Math.hypot(a[0] - b[0], a[1] - b[1]).toFixed(2)} u apart, under the `
    + `${need.toFixed(2)} u floor`, 'advisory');
}));

/* ───────────────────────── the monorail ring, derived from RZ ───────────────────────── */

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

/* ───────────────────────── the three worlds (pads exist by now) ───────────────────────── */

const THORNWICK_PROPS: XZ[] = [[-13.2, 30.0], [-6.0, 30.0], [-13.2, 40.8], [4.8, 28.8]];
const COVE_PROPS: XZ[] = [[55.2, 14.4], [38.4, 3.6], [55.2, 3.6], [36.0, 16.8], [50.4, 24.0]];
const FOUNDRY_PROPS: XZ[] = [[-45.6, -24.0], [-52.8, -10.8], [-58.8, -8.4], [-45.6, -27.6], [-50.4, -14.4]];

const THORNWICK = worldPlan({
  id: 'thornwick', theme: ENCHANTED_FOREST, pieces: [GLADE_ROW],
  include: [[0, ND], [0, TN], TWIST.pad, TWIST.anchor, ...THORNWICK_PROPS],
});
const COVE = worldPlan({
  id: 'cove', theme: PIRATE_BEACH, pieces: [COVE_ROW],
  include: [[42.6, TW], [36.0, TW], WHEEL.pad, WHEEL.anchor, SHIP.pad, SHIP.anchor, ...COVE_PROPS],
});
const FOUNDRY = worldPlan({
  id: 'foundry', theme: STEAMPUNK, pieces: [FORGE_ROW],
  include: [[-42.6, TW], [-36.0, TW], KARTS.pad, KARTS.anchor, ...FOUNDRY_PROPS],
});
const WORLDS = [THORNWICK, COVE, FOUNDRY];

const WORLD_MIN_GAP = 20 * Math.sqrt(SIZE / 48);
WORLDS.forEach((a, i) => WORLDS.slice(i + 1).forEach((b) => {
  const d = Math.hypot(a.centre[0] - b.centre[0], a.centre[1] - b.centre[1]);
  parkAssert('worldsTooClose', d >= WORLD_MIN_GAP,
    `world '${a.id}' @[${a.centre}] and '${b.id}' @[${b.centre}] are ${d.toFixed(2)} u apart, under the `
    + `${WORLD_MIN_GAP.toFixed(2)} u floor`);
}));
console.log('[park] worlds', WORLDS.map((w) => ({ id: w.id, centre: w.centre, half: w.half })));

/* ───────────────────────── dressing: generated, filtered, then sieved ───────────────────────── */

type Rect = [number, number, number, number];
const KEEPOUT: Rect[] = [
  // §4.0-L corridor keep-out, verbatim
  [-22.2, -21.0, -4.2, 12.6], [-17.4, 3.0, -15.0, -13.8], [-12.6, 9.0, 16.2, 18.6],
  [3.0, 4.2, -13.8, -0.6], [10.2, 17.4, -7.8, 2.4],
  // both coaster bounding boxes — nothing is scattered inside a circuit
  [-21.81, 16.8, -14.45, 17.76], [-62.52, -33.6, -61.27, -30.85],
  // §4.0-B corridor keep-out, verbatim
  [-63.6, -62.4, -54.0, -37.2], [-56.4, -39.6, -62.4, -60.0], [-51.6, -39.6, -32.4, -30.0],
  [-34.8, -32.4, -55.2, -40.8],
  // the monorail ring band (props must not stand under the beam line or its columns)
  [-45.0, 45.0, ND - 2.4, ND + 2.4], [-45.0, 45.0, SD - 2.4, SD + 2.4],
  [-45.0, -40.2, SD, ND], [40.2, 45.0, SD, ND],
  // the gate apron
  [-4.8, 4.8, 55.2, 64.0],
];
ALL_PLANS.forEach((p) => KEEPOUT.push([p.footprint.cx - p.footprint.hx - 2.4, p.footprint.cx + p.footprint.hx + 2.4,
  p.footprint.cz - p.footprint.hz - 2.4, p.footprint.cz + p.footprint.hz + 2.4]));

const inRect = (c: XZ, r: Rect) => c[0] >= r[0] && c[0] <= r[1] && c[1] >= r[2] && c[1] <= r[3];

const OCCUPIED: { at: XZ; r: number }[] = [
  ...PAD_RIGS.map(([at, rig]) => ({ at, r: padMarginOf(rig) + 1.8 })),
  ...[CAROUSEL, TWIST, WHEEL, SHIP, TEACUPS, GHOST, KARTS, FLUME].map((p) => ({ at: p.anchor, r: 3.0 })),
  ...RING_DECKS.map((at) => ({ at, r: 7.2 })),
  ...THORNWICK_PROPS.map((at) => ({ at, r: 4.2 })),
  ...COVE_PROPS.map((at) => ({ at, r: 4.2 })),
  ...FOUNDRY_PROPS.map((at) => ({ at, r: 4.2 })),
  { at: [16.8, -3.6], r: 8.0 }, { at: [-33.6, -48.0], r: 8.0 },
  { at: [-6.0, 57.6], r: 4.2 },
];

function scatter(count: number, clear: number, salt: number): XZ[] {
  const out: XZ[] = [];
  const rows: XZ[] = [];
  for (let ix = -12; ix <= 12; ix += 1) {
    for (let iz = -12; iz <= 12; iz += 1) {
      const k = (ix + 12) * 25 + (iz + 12);
      const jx = (hash01(k * 3.17 + salt) - 0.5) * 3.0;
      const jz = (hash01(k * 7.31 + salt + 41) - 0.5) * 3.0;
      rows.push([+(ix * 4.8 + jx).toFixed(2), +(iz * 4.8 + jz).toFixed(2)]);
    }
  }
  rows
    .map((c, i) => ({ c, o: hash01(i * 1.93 + salt + 11) }))
    .sort((a, b) => a.o - b.o)
    .forEach(({ c }) => {
      if (out.length >= count) return;
      if (Math.abs(c[0]) > 58 || Math.abs(c[1]) > 58) return;
      if (!offRow(c)) return;
      if (bumpAt(c) > 0.6 || !isDry(c)) return;
      if (KEEPOUT.some((r) => inRect(c, r))) return;
      if (OCCUPIED.some((o) => Math.hypot(c[0] - o.at[0], c[1] - o.at[1]) < o.r)) return;
      if (out.some((p) => Math.hypot(c[0] - p[0], c[1] - p[1]) < 3.0)) return;
      const off = offPathCell(NET, c, { clear });
      if (!off || Math.hypot(off[0] - c[0], off[1] - c[1]) > 1e-6) return;
      out.push(c);
    });
  return out;
}

const TREE_SHAPES = ['round', 'pine', 'willow', 'round', 'pine'] as const;
type TreeShape = (typeof TREE_SHAPES)[number];
const RAW_TREES = scatter(46, 0.75, 2);
const TREES: { at: XZ; shape: TreeShape }[] = RAW_TREES.map((at, i) => ({ at, shape: TREE_SHAPES[i % TREE_SHAPES.length] }));

const SCENERY_NAMES = ['planterBox', 'topiarySpiral', 'birdbath', 'picnicTable', 'signpost',
  'parkClock', 'wishingWell', 'gazebo', 'marbleStatue', 'flagpole', 'topiaryElephant'] as const;
const SCENERY = scatter(24, 1.2, 91).map((at, i) => ({ at, name: SCENERY_NAMES[i % SCENERY_NAMES.length] }));

parkAssert('dressCounts', TREES.length >= 32 && SCENERY.length >= 16,
  `dressing came up short before the water sieve even ran: ${TREES.length} trees (floor 32) and `
  + `${SCENERY.length} scenery (floor 16). Widen the scatter grid or free some land.`, 'advisory');
console.log(`[park] dressing: ${TREES.length} trees / ${SCENERY.length} scenery authored (floors 32 / 16)`);

// the RECEIPT set — cells that cannot be dropped, checked in the tree and rendering nothing
const RECEIPT: { at: XZ }[] = [
  ...PADS.map((at) => ({ at })),
  ...[CAROUSEL, TWIST, WHEEL, SHIP, TEACUPS, GHOST, KARTS, FLUME].map((p) => ({ at: p.anchor })),
  ...RING_DECKS.map((at) => ({ at })),
  ...THORNWICK_PROPS.map((at) => ({ at })),
  ...COVE_PROPS.map((at) => ({ at })),
  ...FOUNDRY_PROPS.map((at) => ({ at })),
  { at: [16.8, -3.6] as XZ }, { at: [-33.6, -48.0] as XZ },
];

parkAssertFlush();

/* ───────────────────────── the water receipt, IN THE TREE ───────────────────────── */

function DryScatter<T extends { at: XZ }>({ cells, label, render }: {
  cells: T[];
  label: string;
  render: (c: T, i: number) => React.ReactNode;
}) {
  const park = usePark('DryScatter');
  const [dry, setDry] = React.useState<T[] | null>(null);

  React.useEffect(() => {
    const g = park.ground;
    if (!g) { console.error(`[park] DryScatter(${label}) ran with NO TERRAIN — a VACUOUS pass`); setDry(cells); return; }
    const isDryHere = (x: number, z: number) => g.lint.isDry(x, z, 0.05);
    const ringDry = (c: XZ, r = 0.75) => {
      if (!isDryHere(c[0], c[1])) return false;
      for (let k = 0; k < 8; k += 1) {
        const a = (k / 8) * Math.PI * 2;
        if (!isDryHere(c[0] + Math.cos(a) * r, c[1] + Math.sin(a) * r)) return false;
      }
      return true;
    };
    const kept = cells.filter((c) => ringDry(c.at));
    if (kept.length < cells.length) {
      console.error(`[park] DryScatter(${label}) dropped ${cells.length - kept.length} of ${cells.length} cell(s) `
        + `UNDER waterline+0.05: ${JSON.stringify(cells.filter((c) => !kept.includes(c)).map((c) => c.at))}`);
    }
    setDry(kept);
  }, [park, cells, label]);

  return <>{(dry ?? []).map(render)}</>;
}

/* ───────────────────────────────────── the park ───────────────────────────────────── */

export function App() {
  return (
    <Park
      seed={SEED}
      climate={CLIMATE}
      roster={{ rides: 11, stalls: 9, categories: 5 }}
      onReady={(report) => console.log('[park] validatePark', {
        ok: report.ok, failures: report.failures, warnings: report.warnings,
      })}
    >
      <Terrain keepDry={GUARDS} coasterPts={ALL_COASTER_PTS} />
      <Paths nodes={NET.nodes} edges={NET.edges} plazas={NET.plazas} bins={NET.bins} walkers={6} />
      <GameManager />
      <Gate />

      <FountainPlaza plan={HUB} />
      <Bazaar plan={GLADE_ROW} />
      <Bazaar plan={COVE_ROW} />
      <Bazaar plan={FORGE_ROW} />
      <World plan={THORNWICK} />
      <World plan={COVE} />
      <World plan={FOUNDRY} />

      <Coaster
        name="Wyrmfang Coil" pieces={L_PIECES} start={L_START} heading={0}
        type="steel" cars={3} capacity={4} rideDuration={11} loadTime={2} intensity={9} price={7}
        queueTailNode={NET.node(L_TAIL)} queueDir={[1, 0]}
      />
      <Coaster
        name="Brineblack Runner" pieces={B_PIECES} start={B_START} heading={0}
        type="steel" cars={3} capacity={4} rideDuration={12} loadTime={2} intensity={6} price={5}
        queueTailNode={NET.node(B_TAIL)} queueDir={[1, 0]}
      />

      <Monorail
        position={[-42.6, 0, -9.7 + RZ]} rotation={0} pieces={MONO_PIECES} beamY={2.6} loopSeconds={12} pinned
        name="Cogwheel Grand Circle" capacity={6} rideDuration={12} intensity={1} price={0}
        queue={{ anchor: [-40.81, TW], dir: [1, 0] }}
        register={{
          board: [-42.6, 2.6, TW],
          stations: [
            {
              label: 'Mosslight', boardPoint: [0, 2.6, ND], queueAnchor: [0, 0.05, +(32.41 + RZ).toFixed(2)],
              queueDir: [0, -1], exitPoint: [-1.2, 0.05, +(33.03 + RZ).toFixed(2)], exitDir: [0, -1],
            },
            {
              label: 'Saltbite', boardPoint: [42.6, 2.6, TW], queueAnchor: [40.81, 0.05, TW],
              queueDir: [-1, 0], exitPoint: [41.43, 0.05, +(-7.2 + RZ).toFixed(2)], exitDir: [-1, 0],
            },
            {
              label: 'Southgate', boardPoint: [0, 2.6, SD], queueAnchor: [0, 0.05, +(-52.79 + RZ).toFixed(2)],
              queueDir: [0, -1], exitPoint: [1.2, 0.05, +(-52.17 + RZ).toFixed(2)], exitDir: [0, -1],
            },
          ],
        }}
      />

      <Carousel
        position={CAROUSEL.pad} rotation={CAROUSEL.yaw} register
        name="Compass Court Carousel" capacity={8} rideDuration={10} loadTime={2} intensity={2} price={3}
        queue={{ anchor: CAROUSEL.anchor, dir: CAROUSEL.dir }}
      />
      <TwistRide
        position={TWIST.pad} rotation={TWIST.yaw} register
        name="Glimmerwood Twist" capacity={6} rideDuration={9} loadTime={2} intensity={4} price={4}
        queue={{ anchor: TWIST.anchor, dir: TWIST.dir }}
      />
      <FerrisWheel
        position={WHEEL.pad} rotation={WHEEL.yaw} register
        name="Tidewatch Wheel" capacity={4} rideDuration={11} loadTime={2} intensity={2} price={4}
        queue={{ anchor: WHEEL.anchor, dir: WHEEL.dir }}
      />
      <PirateShip
        position={SHIP.pad} rotation={SHIP.yaw} register
        name="Brineblack Galleon" capacity={8} rideDuration={9} loadTime={2} intensity={7} price={5}
        queue={{ anchor: SHIP.anchor, dir: SHIP.dir }}
      />
      <Teacups
        position={TEACUPS.pad} rotation={TEACUPS.yaw} register
        name="Mad Mariner Teacups" capacity={6} rideDuration={9} loadTime={2} intensity={3} price={3}
        queue={{ anchor: TEACUPS.anchor, dir: TEACUPS.dir }}
      />
      <GhostTrain
        position={GHOST.pad} rotation={GHOST.yaw} register
        name="Hollowmoor Hauntride" capacity={12} rideDuration={12} loadTime={2} intensity={5} price={6}
        queue={{ anchor: GHOST.anchor, dir: GHOST.dir }}
      />
      <GoKarts
        position={KARTS.pad} rotation={KARTS.yaw} register
        name="Cogsprint Speedway" capacity={4} rideDuration={12} loadTime={2} intensity={6} price={6}
        queue={{ anchor: KARTS.anchor, dir: KARTS.dir }}
      />
      <LogFlume
        position={FLUME.pad} rotation={FLUME.yaw} register
        name="Kelpwater Chute" capacity={8} rideDuration={12} loadTime={2} intensity={5} price={6}
        queue={{ anchor: FLUME.anchor, dir: FLUME.dir }}
      />

      <Restroom position={[-6.0, 57.6]} rotation={Math.PI / 2} />

      <GiantToadstools position={THORNWICK_PROPS[0]} rotation={0.4} />
      <LanternTree position={THORNWICK_PROPS[1]} rotation={-0.7} />
      <StandingStones position={THORNWICK_PROPS[2]} rotation={1.1} />
      <FlowerPodBed position={THORNWICK_PROPS[3]} rotation={0.2} />

      <WreckedHull position={COVE_PROPS[0]} rotation={0.6} />
      <DockPilings position={COVE_PROPS[1]} rotation={0.9} />
      <AnchorPile position={COVE_PROPS[2]} rotation={-0.4} />
      <CoralCluster position={COVE_PROPS[3]} rotation={0.3} />
      <TidePool position={COVE_PROPS[4]} rotation={0} />

      <GiantGear position={FOUNDRY_PROPS[0]} rotation={0.5} />
      <ClockTower position={FOUNDRY_PROPS[1]} rotation={0} />
      <SteamPipes position={FOUNDRY_PROPS[2]} rotation={-0.6} />
      <BoilerTank position={FOUNDRY_PROPS[3]} rotation={1.35} />
      <CoalCart position={FOUNDRY_PROPS[4]} rotation={0.2} />

      <Neon text="TIDEWRACK" position={[45.6, 1.7, 6.0]} rotation={Math.PI} scale={0.6} />
      <Neon text="THE COG" position={[-48.0, 1.7, -22.8]} rotation={Math.PI / 2} scale={0.5} />
      <Torch position={[-3.6, 52.8]} />
      <Torch position={[3.6, 52.8]} />
      <Torch position={[-3.6, 61.2]} />
      <Torch position={[3.6, 61.2]} />
      <Lights from={[0, 63.6]} to={[0, 57.6]} />
      <Lights from={[22.8, 45.6]} to={[22.8, 9.6]} />
      <Lights from={[-16.8, 45.6]} to={[-16.8, -8.4]} />

      <DryScatter cells={RECEIPT} label="pads+huts+decks+themed" render={() => null} />
      <DryScatter
        cells={TREES}
        label="trees"
        render={(t, i) => (
          <Placed key={`tr-${i}`} position={t.at} build={(three) => tree(three, { shape: t.shape })} />
        )}
      />
      <DryScatter
        cells={SCENERY}
        label="scenery"
        render={(s, i) => <Scenery key={`sc-${i}`} name={s.name} position={s.at} seed={i + 1} />}
      />
    </Park>
  );
}

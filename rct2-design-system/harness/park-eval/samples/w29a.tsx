/* ═══ THREE CROWNS PARK — §0 PRE-FLIGHT ══════════════════════════════════════════════
 * SIZE   128 (default, `size` prop omitted)
 * SEED   1 / temperate — pinned row SEED_ROW_WATER['1/temperate']:
 *        dominant ctr (41, -39) box x[21,60] z[-60,-21] · secondary ctr (-38, 31) box
 *        x[-56,-21] z[23,39]  [PRE-keepDry]
 *        RING WATER WALK: all 16 ring cells asserted OFF both boxes and >= 12 u from both
 *        centres by `offRow` at module scope (ringWaterWalk) ✓
 *        GUARDS = keepDryOf(NET, SEED_ROW) — the FUSE'S OUTPUT sieved, never NODES.slice() ✓
 *        re-compose diff: waterMoved (both centroids < 1 u) STRUCTURAL ·
 *        terrainFlattened (report.reliefFloor.kept >= floor) ADVISORY · both printed
 *        every pad + every prop cell re-checked IN THE TREE by the GATE'S OWN predicate
 *        (park.ground.lint.isDry(x, z, 0.05), 8-point ring) through <DryScatter> ✓
 *        reliefFloor.kept TBD (runtime — read the console line)
 * WORLDS 3 (>= 3), each rect holds a MONORAIL DECK and >= 1 REGISTERED RIDE:
 *        pirateBeach 'coveWorld'      ctr ~( 35.0,  -1.0)  deck E (42.6, -8.4)
 *        enchantedForest 'gladeWorld' ctr ~( 15.3,  43.2)  deck N ( 0.0, 34.2)
 *        steampunk 'foundryWorld'     ctr ~(-35.4, -21.0)  deck W (-42.6, -8.4)
 *        centre pairs SORTED, closest marked: cove↔glade 48.4 ◄ >= 32.66 (20·√(128/48)) ·
 *        cove↔foundry 73.2 · glade↔foundry 81.8 ✓ · rects DISJOINT, dry gap > 0 ✓
 *        WORLD coveWorld:    ride LogFlume  @pad (inside rect ✓) · stall 'sushi'      (own)
 *        WORLD gladeWorld:   ride GhostTrain @pad (inside rect ✓) · stall 'honeywitch' (own)
 *        WORLD foundryWorld: ride FerrisWheel @pad (inside rect ✓) · stall 'goggles'   (own)
 *        each bazaar is dressed in ITS OWN theme and stocks ONLY its own counter — no
 *        foreign themed stall, no foreign themed scenery (all scatter is NEUTRAL) ✓
 * CATS   (WRITTEN BEFORE ANY JSX) gentle FerrisWheel/Carousel/Teacups/TwistRide ·
 *        thrill §4.0-L flagship + §4.0-B + GoKarts · water LogFlume ·
 *        transport Monorail ring · dark GhostTrain  → 5/5 categories ✓
 *        RARE PICK GoKarts — from the brief's never-shipped shelf ✓
 * CIRCUITS §4.0-L · §4.0-B · LogFlume · Monorail ring · GhostTrain
 *        → 5 CIRCUITS across 4 FAMILIES (coaster ×2 = ONE family, water, transport, dark) ✓
 * GATE   [0, 63.6] → GoKarts tail [0, 57.6] = 6.0 u  <= 15 ✓ (a NON-monorail ride carries
 *        the smoke cycle; the ring's nearest platform is 24 u of street, past the budget)
 * FLAG   §4.0-L VERBATIM, start [16.8, 0.55, -3.6] heading 0, steel, cars 3, NO bank prop
 *        (PIECES mode builds bank 0.7) — rateCoaster(bank 0.7, cars 3) MEASURED and logged
 *        published: E 6.29 / I 8.58 / N 3.17 / drop 4.19 / maxLatG 1.20 (guard 1.275) /
 *        INVERSIONS 2 (one VERTICAL LOOP + one corkscrew) / 0 synthesized / maxY 4.75
 *        CORRIDOR KEEP-OUT (§4.0-L's five rects incl. the INTERIOR return column
 *        x[3.0,4.2] z[-13.8,-0.6]) pasted into L_CORRIDOR and asserted against every
 *        street node, every set-piece footprint and every ride pad/hut ✓
 *        the ring interior is CLOSED to a north-south column — the park-spanning cycle
 *        runs the EAST spine x 22.8 and returns west along z -18.0 (skeleton-l recipe) ✓
 * FLAG2  §4.0-B VERBATIM, start [-33.6, 0.55, -48.0] heading 0, steel, cars 3, no bank
 *        published: E 5.27 / I 6.25 / N 2.25 / drop 3.58 / maxLatG 0.27 / inversions 0
 *        DIFFERENT archetype ✓ · bbox DISJOINT from FLAG's (15.18 u in x, 12.69 in z) ✓
 *        outside every <World> rect ✓ · coasterPts = [...FLAG_PTS, ...FLAG2_PTS] ✓
 * STREET buildParkNet called EXACTLY ONCE, WITHOUT `worlds:` (the pad→NET→worlds cycle is
 *        broken by ORDER: fuse → place() → declare WORLDS off the real pads) ✓
 *        the SAME NET feeds <Paths>, every offPathCell and every NET.node() ✓
 *        PORT-REFS: 6 pieces → hub:N hub:E hub:W · coveRow:W · gladeRow:E · foundryRow:E
 *        counted + asserted present (pieceIsland) with both ends of every non-prunable
 *        port wired (chainEnd) ✓ · every pad returned BY offPathCell, then by
 *        assertPadFlat ✓
 * MONO   ring pieces VERBATIM (§0-P.4) · pose SEARCHED WIDE over dx,dz ∈
 *        {0, ±1.2, ±2.4, ±3.6, ±4.8, ±6.0} (121 candidates, nearest-first), SCORING ALL
 *        FOUR DECKS against the flank limit 0.75 and TAKING the first clear pose —
 *        the chosen offset is logged and the whole ring (decks, tails, anchors, exits AND
 *        the four authored street leaves) is DERIVED from it, so a shifted pose can never
 *        leave a tail diagonal to its parent ✓
 *        4 platforms >= 3 declared worlds, one deck inside each world rect ✓
 *        tails are authored NODES and ALL FOUR ARE LEAVES (degree 1, asserted off the
 *        authored edge table) ✓ · S queues OUTWARD ([0,-1]) — the measured +1.5 ✓
 *        gate spine ENDS at the hub plaza; the N tail is reached LATERALLY and every
 *        onward street branches off a SPINE JUNCTION, never off a platform tail ✓
 *        the S approach runs down the x -24.0 column and east along z -57.6, passing
 *        UNDER the south beam at [-24, -51] ✓
 * QUEUE  ONE ROW PER RIDE — tail is an authored NODE, pad DERIVED from it by place():
 *        reach = laneLenOf(4) 3.34 + 0.35 + 0.62 + 0.50 + 0.45 + 2.4 = 7.66 u,
 *        floor minReachOf(4) + 1.2 = 6.46 u, so every row clears by 1.20 u ✓
 *        GoKarts     cap 4  tail [  0.0, 57.6]  out [-1, 0] → pad [ -7.66, 57.6]  7.66 ✓
 *        GhostTrain  cap 4  tail [ 22.8, 45.6]  out [ 1, 0] → pad [ 30.46, 45.6]  7.66 ✓
 *        TwistRide   cap 4  tail [ 22.8, 24.0]  out [ 1, 0] → pad [ 30.46, 24.0]  7.66 ✓
 *        LogFlume    cap 4  tail [ 22.8, 12.0]  out [ 1, 0] → pad [ 30.46, 12.0]  7.66 ✓
 *        Carousel    cap 4  tail [-16.8, 18.0]  out [-1, 0] → pad [-24.46, 18.0]  7.66 ✓
 *        Teacups     cap 4  tail [  9.6,-18.0]  out [ 0,-1] → pad [  9.6,-25.66] 7.66 ✓
 *        FerrisWheel cap 4  tail [-36.0,-18.0]  out [ 0,-1] → pad [-36.0,-25.66] 7.66 ✓
 *        §4.0-L      cap 4  tail [ 22.8, -3.6] queueDir [1,0] (published pair)
 *        §4.0-B      cap 4  tail [-27.6,-48.0] queueDir [1,0] (published pair)
 *        no two rides share a tail node ✓ · every tail appears in NODES ✓ · every lane
 *        leaves its tail PERPENDICULAR to the street it hangs off ✓
 *        clear = padMarginOf(rig) off the §0-P.5 table (LogFlume 5.36 · GhostTrain 4.77 ·
 *        GoKarts 4.39 · FerrisWheel 2.97 · TwistRide 2.65 · Teacups 2.47 · Carousel 2.40)
 *        — never the 3.2 default by guess ✓
 * SPACING ⛔ THE ONE DEFECT THAT COST THE LAST PARK 2.25: rideSpacing.obb.minGap.
 *        The ring registers a rect for EVERY SPAN OF ITS BEAM, so the beam is modelled
 *        here as its own 9-segment POLYLINE (legs + corner chords, chords being the
 *        CONSERVATIVE inner approximation of the radius-6 arcs) and every ride pad must
 *        stand padMarginOf(rig) + 2.0 u clear of it (ringBeamClearance). Measured
 *        author-time worst: LogFlume 12.1 vs 7.36 needed · GhostTrain 11.4 vs 6.77 ·
 *        GoKarts 23.4 vs 6.39 · FerrisWheel 6.6 vs 4.97 · TwistRide 11.5 vs 4.65 ·
 *        Carousel 18.0 vs 4.40 · Teacups 25.3 vs 4.47 ✓
 *        AND the same measurement the axis makes — an ORIENTED-BOX EDGE GAP, never a
 *        pad-centre pitch — runs twice: over the committed rects at module scope
 *        (obbSelfCheck, floor 1.5 u) and over report.footprints in onReady, where the
 *        manager's REAL per-span rects exist ✓
 * GROUND every pad AND every entrance-hut anchor routed through the CORRECTIVE
 *        assertPadFlat (bump <= 0.75 AND dry, else ring-search out to 4.8 u and MOVE it) —
 *        the flank gate charges -3 per registered footprint, huts included ✓
 * PLAZAS NET.plazas = hub (9 tiles → 10.8 × 10.8 = 116.6 u²) + 3 bazaar courtyards
 *        (8.4 × 3.6 = 30.2 u² each) → 4 rects, largest 116.6 >= 8 ✓ areaSpread 3.86 >= 1.8 ✓
 *        NO set-piece `position` appears in NODES or as a queue tail (assertNodesOffPieces,
 *        re-run over the settled PADS after the fuse) ✓ every set-piece position is a
 *        multiple of 1.2 (latticePositions) ✓
 * NODES  33 authored · degree-1 leaves: the 4 ring tails + the §4.0-B tail + the gate cell
 *        → every leaf carries a queue tail or the turnstile ✓
 *        one PARK-SPANNING loop: hub → west spoke x -16.8 → z -18.0 shelf → east spine
 *        x 22.8 → hub, crossing z = 0 twice ✓ (not a court-sized cycle)
 * ATTACH every spur is FLAT (no nodeY anywhere, so |Δy|/len = 0 <= 0.417 on every edge)
 *        and no authored span crosses a dip or bank — every leg is cardinal and every
 *        corridor rect is cleared by >= 1.8 u, so <Paths> refuses nothing ✓
 *        accessibility.allRidesReachable MUST come back true — read it in onReady ✓
 * LATTICE authored spans 0.6 / 1.2 / 2.4 / 3.6 / 4.8 / 6.0 / 7.2 / 9.6 / 12.0 / 13.2 /
 *        16.8 / 24.0 / 35.4 / 56.4 u + the fuse's 1.2 chains → effectiveClasses >= 4 ✓
 * ROSTER (WRITTEN LAST, counted off the register calls that actually MOUNT)
 *        10 rides / 5 categories / 9 stalls (7 kinds: sushi honeywitch goggles burger
 *        soda cottonCandy hotDog balloon) / restroom ✓ / bins from NET.bins ✓
 *        NAMED: every ride AND every stall carries an authored themed `name` — the three
 *        bazaars pass `names` positionally, so 0 stalls ship under a catalog defaultName ✓
 *        <Park roster={{ rides: [...10 names], stalls: 9, categories: 5 }}> MOUNTED ✓
 * DRESS  48 tree cells + 26 scenery cells authored against the >= 32 / >= 16 floors (the
 *        DryScatter sieve DROPS, so both are over-provisioned) — every cell taken from
 *        offPathCell(clear 1.2 scenery / 0.75 trees), off every corridor rect, off every
 *        committed rect, off the ring beam band, off the pinned row's water, and finally
 *        re-checked in the tree by the gate's own predicate ✓
 *        water: TWO bodies from the pinned row, temperate band 4-22 % — value TBD (runtime)
 * NIGHT  4 <Lights> runs · 2 <Neon> · 4 <Torch> · real PointLights only inside the
 *        set-pieces' own budget · draws TBD (runtime, budget 3 000)
 * GATE   parkAssertFlush() → 0 structural expected · validatePark → ok: true, 0 failures,
 *        0 warnings. padReach and the flank/beam checks are ADVISORY BY DESIGN: a
 *        structural throw at module scope blanks the park and scores 0 on all 16 axes,
 *        so a rig that will not fit is repaired or omitted, never thrown over.
 * ═══════════════════════════════════════════════════════════════════════════════════ */
import React from 'react';
import * as THREE from 'three';
import type { V3, XZ } from './components/Park';
import {
  Park, GameManager, Terrain, Paths, Gate, Coaster, Restroom, Scenery, Lights, Placed,
  Neon, Torch, usePark, offPathCell,
} from './components/Park';
import { laneLenOf, parkComposition } from './components/ParkBuilder';
import type { NetRef, SetPiecePlan } from './components/SetPieceKit';
import {
  buildParkNet, worldPlan, World,
  TIDEWATER_HOLLOW, THORNWICK_GLADE, BRASSWORK_FOUNDRY,
} from './components/SetPieceKit';
import { Bazaar, bazaarPlan } from './components/Bazaar';
import { FountainPlaza, fountainPlazaPlan } from './components/FountainPlaza';
import type { TrackPiece } from './components/SplineRideKit';
import { compileTrackPieces, rateCoaster } from './components/SplineRideKit';
import { tree } from './components/Kit';
import { Monorail } from './components/Monorail';
import { LogFlume } from './components/LogFlume';
import { GhostTrain } from './components/GhostTrain';
import { GoKarts } from './components/GoKarts';
import { FerrisWheel } from './components/FerrisWheel';
import { Carousel } from './components/Carousel';
import { Teacups } from './components/Teacups';
import { TwistRide } from './components/TwistRide';

const SIZE = 128;
const SEED = 1;
const CLIMATE = 'temperate' as const;
const PEAK_LIMIT = 0.75;          // ParkBuilder/validate.ts flank limit, verbatim
const SPACING_FLOOR = 1.5;        // rideSpacing.obb.minGap, axis 3
const CELL = 1.2;

/* ── §0-P.5 ONE assertion bus: COLLECT, then flush ONCE ───────────────────────────── */
type Sev = 'structural' | 'advisory';
const PARK_FAILS: { name: string; detail: string; sev: Sev }[] = [];
function parkAssert(name: string, cond: boolean, detail: string, sev: Sev = 'structural'): boolean {
  if (!cond) PARK_FAILS.push({ name, detail, sev });
  return cond;
}
function parkAssertFlush(): void {
  if (!PARK_FAILS.length) { console.log('[park] assertions: all pass'); return; }
  const hard = PARK_FAILS.filter((f) => f.sev === 'structural');
  console.error(`[park] ${PARK_FAILS.length} ASSERTION FAILURE(S) (${hard.length} structural):\n` +
    PARK_FAILS.map((f, i) => `  ${i + 1}. [${f.sev}] ${f.name}\n     ${f.detail}`).join('\n'));
  if (hard.length) throw new Error(`[park] ${hard.length} STRUCTURAL failure(s) — see the numbered block above.`);
}
const hash01 = (n: number) => {
  const s = Math.sin(n * 12.9898 + 78.233) * 43758.5453;
  return s - Math.floor(s);
};
const snap = (v: number) => +(Math.round(v / CELL) * CELL).toFixed(4);
const eq = (a: XZ, b: XZ) => Math.abs(a[0] - b[0]) < 1e-6 && Math.abs(a[1] - b[1]) < 1e-6;

/* ── §0-P.4 THE TWO VERIFIED COASTERS, COPIED VERBATIM ────────────────────────────── */
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

const { points: FLAG_PTS } = compileTrackPieces(L_PIECES, {
  type: 'steel', start: L_START, heading: 0, bounds: SIZE,
});
const { points: FLAG2_PTS } = compileTrackPieces(B_PIECES, {
  type: 'steel', start: B_START, heading: 0, bounds: SIZE,
});
const ALL_COASTER_PTS = [...FLAG_PTS, ...FLAG2_PTS];
[FLAG_PTS, FLAG2_PTS].forEach((pts, i) => console.log(`[park] coaster ${i + 1} rating`,
  rateCoaster(pts, { type: 'steel', bank: 0.7, cars: 3 })));

/* ── CORRIDOR KEEP-OUT rects, PLOT coords (§0-P.4, pasted) ────────────────────────── */
type Rect4 = [number, number, number, number];   // x0, x1, z0, z1
const L_CORRIDOR: Rect4[] = [
  [-22.2, -21.0, -4.2, 12.6],     // west valley
  [-17.4, 3.0, -15.0, -13.8],     // south valley
  [-12.6, 9.0, 16.2, 18.6],       // north valley
  [3.0, 4.2, -13.8, -0.6],        // INTERIOR return column — the §4.0-L trap
];
const B_CORRIDOR: Rect4[] = [
  [-63.6, -62.4, -54.0, -37.2], [-61.2, -61.2, -52.8, -37.2],
  [-56.4, -39.6, -62.4, -60.0], [-51.6, -39.6, -32.4, -30.0],
];
const CORRIDOR: Rect4[] = [...L_CORRIDOR, ...B_CORRIDOR];
const inRect = (c: XZ, r: Rect4, pad = 0) =>
  c[0] >= r[0] - pad && c[0] <= r[1] + pad && c[1] >= r[2] - pad && c[1] <= r[3] + pad;
const inCorridor = (c: XZ, pad = 0) => CORRIDOR.some((r) => inRect(c, r, pad));

/* ── §0-P.6 the pinned seed row + the DERIVED guard sieve ─────────────────────────── */
type SeedBasin = { ctr: XZ; box: Rect4 };
type SeedRow = { dom: SeedBasin; sec: SeedBasin };
const SEED_ROW: SeedRow = {
  dom: { ctr: [41, -39], box: [21, 60, -60, -21] },
  sec: { ctr: [-38, 31], box: [-56, -21, 23, 39] },
};
const offRow = (c: XZ, row: SeedRow = SEED_ROW, nearR = 12) =>
  [row.dom, row.sec].every((b) =>
    !inRect(c, b.box) && Math.hypot(c[0] - b.ctr[0], c[1] - b.ctr[1]) >= nearR);
function keepDryOf(net: { keepDry: XZ[] }, row: SeedRow = SEED_ROW): XZ[] {
  const kept = net.keepDry.filter((c) => offRow(c, row));
  const dropped = net.keepDry.length - kept.length;
  if (dropped) console.warn(
    `[park] keepDryOf dropped ${dropped} of ${net.keepDry.length} guard cell(s) on the pinned row's ` +
    `water. A DROPPED guard is NOT a fixed cell — whatever stands there is still in the lake. MOVE it.`);
  return kept;
}

/* ── the UNGUARDED reference composition — the flank + water baseline ─────────────── */
const BARE: any = parkComposition(THREE, SEED, SIZE, CLIMATE, { coasterPts: ALL_COASTER_PTS });
const bumpIn = (comp: any, c: XZ) =>
  Math.max(0, ...comp.peaks.map((p: any) => {
    const k = Math.max(0, 1 - Math.hypot(c[0] - p.x, c[1] - p.z) / p.radius);
    return k * k * (3 - 2 * k) * p.height;
  }));
const isDryIn = (comp: any, c: XZ) => [...comp.basins, ...comp.clampBasins]
  .every((b: any) => Math.hypot(c[0] - b.x, c[1] - b.z) > 0.74 * b.radius + 0.6);

/* ── §0-P.4 THE MONORAIL RING — pose SEARCHED WIDE, all four decks scored ─────────── */
const RING_BASE_POS: XZ = [-42.6, -9.7];
const RING_BASE_DECKS: XZ[] = [[-42.6, -8.4], [0, 34.2], [42.6, -8.4], [0, -51.0]];
const RING_BASE_TAILS: XZ[] = [[-36.0, -8.4], [0, 27.6], [36.0, -8.4], [0, -57.6]];
const RING_BASE_ANCHORS: XZ[] = [[-40.81, -8.4], [0, 32.41], [40.81, -8.4], [0, -52.79]];
const RING_BASE_EXITS: XZ[] = [[-1.2, 33.03], [41.43, -7.2], [1.2, -52.17]];
const POSE_OFFS = [0, -1.2, 1.2, -2.4, 2.4, -3.6, 3.6, -4.8, 4.8, -6.0, 6.0];

const POSE = (() => {
  const cand: { dx: number; dz: number; worst: number }[] = [];
  POSE_OFFS.forEach((dx) => POSE_OFFS.forEach((dz) => {
    const worst = Math.max(...RING_BASE_DECKS.map((d) => bumpIn(BARE, [d[0] + dx, d[1] + dz])));
    cand.push({ dx, dz, worst });
  }));
  cand.sort((a, b) => (Math.abs(a.dx) + Math.abs(a.dz)) - (Math.abs(b.dx) + Math.abs(b.dz)));
  const clear = cand.find((c) => c.worst <= PEAK_LIMIT);
  if (clear) {
    if (clear.dx || clear.dz) console.warn(
      `[park] monorail ring pose SHIFTED to dx ${clear.dx} dz ${clear.dz} — worst deck bump ` +
      `${clear.worst.toFixed(2)} <= ${PEAK_LIMIT} (the pose at [0,0] scored ` +
      `${cand.find((c) => !c.dx && !c.dz)!.worst.toFixed(2)}).`);
    else console.log(`[park] monorail ring pose [0,0] clear — worst deck bump ${clear.worst.toFixed(2)}`);
    return clear;
  }
  const best = cand.slice().sort((a, b) => a.worst - b.worst)[0];
  parkAssert('deckOnFlank', false,
    `NO ring pose in the 121-candidate dx,dz sweep clears the ${PEAK_LIMIT} flank limit — best is ` +
    `dx ${best.dx} dz ${best.dz} at bump ${best.worst.toFixed(2)}. This is a GENUINE DEAD END for ` +
    `this seed: the four decks ARE the ring's geometry, keepDry does not touch a flank, and a moved ` +
    `deck no longer meets its beam. Pick a different seed or a different ring position. Shipping the ` +
    `best pose so the park is still measurable (it will take -3 per charged deck on axis 7).`,
    'advisory');
  return best;
})();
const off = (c: XZ): XZ => [snap(c[0] + POSE.dx), snap(c[1] + POSE.dz)];
const offRaw = (c: XZ): XZ => [+(c[0] + POSE.dx).toFixed(2), +(c[1] + POSE.dz).toFixed(2)];
const RING_POS: V3 = [RING_BASE_POS[0] + POSE.dx, 0, RING_BASE_POS[1] + POSE.dz];
const RING_DECKS = RING_BASE_DECKS.map(off);
const RING_TAILS = RING_BASE_TAILS.map(off);
const RING_ANCHORS = RING_BASE_ANCHORS.map(offRaw);
const RING_EXITS = RING_BASE_EXITS.map(offRaw);
const RING_CELLS: XZ[] = [...RING_DECKS, off(RING_BASE_POS), ...RING_TAILS, ...RING_ANCHORS, ...RING_EXITS];
parkAssert('ringWaterWalk', RING_CELLS.every((c) => offRow(c)),
  `ring cell(s) stand on the pinned row's water: ` +
  `${JSON.stringify(RING_CELLS.filter((c) => !offRow(c)))} — a deck inside a basin is a shrunk lake.`);

/* the BEAM as a POLYLINE — legs + corner CHORDS (the conservative inner approximation of
 * the radius-6 arcs). A ring registers a rect per SPAN, so this loop, not the four decks,
 * is what a ride pad must stand clear of. THIS is the 2.25-point defect. */
const RING_BEAM: [XZ, XZ][] = ([
  [[-42.6, -9.7], [-42.6, 28.2]], [[-42.6, 28.2], [-36.6, 34.2]],
  [[-36.6, 34.2], [36.6, 34.2]], [[36.6, 34.2], [42.6, 28.2]],
  [[42.6, 28.2], [42.6, -45.0]], [[42.6, -45.0], [36.6, -51.0]],
  [[36.6, -51.0], [-36.6, -51.0]], [[-36.6, -51.0], [-42.6, -45.0]],
  [[-42.6, -45.0], [-42.6, -10.0]],
] as [XZ, XZ][]).map(([a, b]) => [offRaw(a), offRaw(b)] as [XZ, XZ]);
const segDist = (c: XZ, a: XZ, b: XZ) => {
  const dx = b[0] - a[0], dz = b[1] - a[1];
  const l2 = dx * dx + dz * dz;
  const t = l2 === 0 ? 0 : Math.max(0, Math.min(1, ((c[0] - a[0]) * dx + (c[1] - a[1]) * dz) / l2));
  return Math.hypot(c[0] - (a[0] + t * dx), c[1] - (a[1] + t * dz));
};
const beamDist = (c: XZ) => Math.min(...RING_BEAM.map(([a, b]) => segDist(c, a, b)));

/* ── §0-P.5 the pad-margin table (a MESH property, never capacity) ────────────────── */
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
const bodyHalfOf = (rig: string) => Math.max(0.9, padMarginOf(rig) - 0.6);
const minReachOf = (c: number) => laneLenOf(c) + 0.35 + 0.62 + 0.5 + 0.45;

/* ── THE HUB + THE THREE THEMED BAZAAR ROWS (positions are 1.2 multiples) ─────────── */
const HUB = fountainPlazaPlan({
  id: 'hub', title: 'Three Crowns Circus', position: [0, 45.6], tiles: 9,
  ports: ['N', 'E', 'W'], seed: 3,
});
const COVE_ROW = bazaarPlan({
  id: 'coveRow', title: 'Castaway Cove Market', position: [30.0, -16.8],
  facing: { port: 'W', toward: [25.2, -16.8] },   // PURE -x: no axis tie for the planner to break
  stalls: ['sushi', 'burger', 'soda'],
  names: ['Reefside Sushi Shack', 'Castaway Galley Burgers', 'Tidewater Sodas'],
  theme: TIDEWATER_HOLLOW, seed: 5,
});
const GLADE_ROW = bazaarPlan({
  id: 'gladeRow', title: 'Thornwick Faire', position: [12.0, 50.4],
  facing: { port: 'E', toward: [16.8, 50.4] },   // PURE +x — [16.8, 45.6] was a 45° TIE
  stalls: ['honeywitch', 'cottonCandy', 'hotDog'],
  names: ['Honeywitch Apothecary', 'Faewisp Floss', 'Greenhollow Griddle'],
  theme: THORNWICK_GLADE, seed: 7,
});
const FOUNDRY_ROW = bazaarPlan({
  id: 'foundryRow', title: 'Brasswork Arcade', position: [-30.0, -33.6],
  facing: { port: 'E', toward: [-24.0, -33.6] },
  stalls: ['goggles', 'soda', 'balloon'],
  names: ['Goggleworks Emporium', 'Boilerplate Sodas', 'Aether Balloon Works'],
  theme: BRASSWORK_FOUNDRY, seed: 9,
});
const ALL_PLANS: SetPiecePlan[] = [HUB, COVE_ROW, GLADE_ROW, FOUNDRY_ROW];
parkAssert('latticePositions',
  ALL_PLANS.every((p) => Math.abs(p.footprint.cx / CELL - Math.round(p.footprint.cx / CELL)) < 1e-6 &&
    Math.abs(p.footprint.cz / CELL - Math.round(p.footprint.cz / CELL)) < 1e-6),
  'a set-piece position is OFF the 1.2 lattice — watch for the [plan] offLattice lint.');
parkAssert('bazaarStallFloor',
  [COVE_ROW, GLADE_ROW, FOUNDRY_ROW].every((b: any) => (b.slots?.length ?? 0) >= 3),
  'a bazaar row mounted under the 3-stall floor.');

/* ── THE STREET TABLE — authored NODES + EDGES (every leg cardinal) ───────────────── */
const NODES: XZ[] = [];
const N = (c: XZ): number => {
  const cell: XZ = [snap(c[0]), snap(c[1])];
  const i = NODES.findIndex((n) => eq(n, cell));
  if (i >= 0) return i;
  NODES.push(cell);
  return NODES.length - 1;
};
const T0 = RING_TAILS[0], T1 = RING_TAILS[1], T2 = RING_TAILS[2], T3 = RING_TAILS[3];

const GATE_CELL: XZ = [0, 63.6];
const CELLS = {
  gate: GATE_CELL, gateS: [0, 57.6] as XZ,
  e456: [22.8, 45.6] as XZ, glade: [16.8, 45.6] as XZ,
  enb: [22.8, T1[1]] as XZ, na: [T1[0] + 9.6, T1[1]] as XZ,
  e24: [22.8, 24.0] as XZ, e12: [22.8, 12.0] as XZ,
  eL: L_TAIL, ee: [22.8, T2[1]] as XZ, e18: [22.8, -18.0] as XZ,
  cove: [25.2, -18.0] as XZ,
  s96: [9.6, -18.0] as XZ, s48: [-4.8, -18.0] as XZ, s24: [-24.0, -18.0] as XZ,
  w456: [-16.8, 45.6] as XZ, w18: [-16.8, 18.0] as XZ, w108: [-16.8, -10.8] as XZ,
  w24: [-24.0, -10.8] as XZ,
  wm: [T0[0], -18.0] as XZ,
  s30: [-24.0, -30.0] as XZ, s336: [-24.0, -33.6] as XZ, s48b: [-24.0, -48.0] as XZ,
  bTail: B_TAIL, s576: [-24.0, T3[1]] as XZ,
};

const EDGES: [NetRef, NetRef][] = [
  // gate spine — ENDS at the hub plaza
  [N(CELLS.gate), N(CELLS.gateS)], [N(CELLS.gateS), 'hub:N'],
  // hub → east, and the N platform tail reached LATERALLY off the spine
  ['hub:E', N(CELLS.glade)], [N(CELLS.glade), N(CELLS.e456)],
  [N(CELLS.e456), N(CELLS.enb)], [N(CELLS.enb), N(CELLS.na)], [N(CELLS.na), N(T1)],
  ['gladeRow:E', N(CELLS.glade)],
  // EAST spine (the park-spanning cycle's east leg) — the ring interior stays closed
  [N(CELLS.enb), N(CELLS.e24)], [N(CELLS.e24), N(CELLS.e12)],
  [N(CELLS.e12), N(CELLS.eL)], [N(CELLS.eL), N(CELLS.ee)],
  [N(CELLS.ee), N(T2)],                       // E platform tail — LEAF
  [N(CELLS.ee), N(CELLS.e18)],
  // south shelf, 3.0 u clear of §4.0-L's south valley
  [N(CELLS.e18), N(CELLS.cove)], ['coveRow:W', N(CELLS.cove)],
  [N(CELLS.e18), N(CELLS.s96)], [N(CELLS.s96), N(CELLS.s48)], [N(CELLS.s48), N(CELLS.s24)],
  // west spoke — the verified x -16.8 column, then the double jog to x -24.0
  ['hub:W', N(CELLS.w456)], [N(CELLS.w456), N(CELLS.w18)], [N(CELLS.w18), N(CELLS.w108)],
  [N(CELLS.w108), N(CELLS.w24)], [N(CELLS.w24), N(CELLS.s24)],
  // W platform tail — LEAF off the z -18.0 shelf
  [N(CELLS.s24), N(CELLS.wm)], [N(CELLS.wm), N(T0)],
  // south spine down the x -24.0 column (the only dry southbound route on this seed)
  [N(CELLS.s24), N(CELLS.s30)], [N(CELLS.s30), N(CELLS.s336)],
  ['foundryRow:E', N(CELLS.s336)],
  [N(CELLS.s336), N(CELLS.s48b)],
  [N(CELLS.s48b), N(CELLS.bTail)],            // §4.0-B queue tail — LEAF
  [N(CELLS.s48b), N(CELLS.s576)], [N(CELLS.s576), N(T3)],   // S platform tail — LEAF
];

/* ── the ONE buildParkNet fuse (no `worlds:` — the pads do not exist yet) ─────────── */
const NET = buildParkNet({
  nodes: NODES, edges: EDGES, pieces: ALL_PLANS,
  keepDry: [...RING_CELLS],
});
const GUARDS = keepDryOf(NET, SEED_ROW);
const COMP: any = parkComposition(THREE, SEED, SIZE, CLIMATE, {
  keepDry: GUARDS, coasterPts: ALL_COASTER_PTS,
});

/* the §5c RE-COMPOSE DIFF — water STRUCTURAL, relief ADVISORY */
parkAssert('waterMoved',
  Math.hypot(COMP.waterCentre[0] - BARE.waterCentre[0], COMP.waterCentre[1] - BARE.waterCentre[1]) < 1 &&
  Math.hypot(COMP.waterCentreSecond[0] - BARE.waterCentreSecond[0],
    COMP.waterCentreSecond[1] - BARE.waterCentreSecond[1]) < 1,
  `guards moved a water body off the pinned row — dominant ${JSON.stringify(BARE.waterCentre)} → ` +
  `${JSON.stringify(COMP.waterCentre)}, secondary ${JSON.stringify(BARE.waterCentreSecond)} → ` +
  `${JSON.stringify(COMP.waterCentreSecond)}, terrainSeed ${BARE.terrainSeed} → ${COMP.terrainSeed}`);
const rf = COMP.report.reliefFloor;
parkAssert('terrainFlattened', !rf || rf.kept >= rf.floor,
  rf ? `keepDry FLATTENED the seed: authored relief ${rf.authoredRelief.toFixed(2)} → built ` +
    `${rf.relief.toFixed(2)} (kept ${rf.kept.toFixed(2)} against the ${rf.floor} floor), stdH ` +
    `${rf.authoredStdH.toFixed(2)} → ${rf.stdH.toFixed(2)}. Ranges guarded: ${rf.guardedRanges}; ` +
    `peaks capped: ${JSON.stringify(rf.cappedPeaks)}` : '', 'advisory');
if (rf) console.log(`[park] reliefFloor kept ${rf.kept.toFixed(2)} (floor ${rf.floor}) · ` +
  `relief ${rf.relief.toFixed(2)} · stdH ${rf.stdH.toFixed(2)} · ok ${rf.ok}`);
console.log(`[park] water: bodies ${COMP.report.waterBodies} · ` +
  `${((COMP.report.waterAreaU2 / (SIZE * SIZE)) * 100).toFixed(1)} % of plot (temperate band 4-22 %) · ` +
  `gap ${COMP.report.waterGap} · probes ${BARE.report.probesTried} → ${COMP.report.probesTried}`);

/* ── CORRECTIVE flatness: ring-search, then MOVE. Never merely report. ───────────── */
function assertPadFlat(pad: XZ, clear: number, label: string): XZ {
  if (bumpIn(COMP, pad) <= PEAK_LIMIT && isDryIn(COMP, pad)) return pad;
  for (let r = 1; r <= 8; r += 1)
    for (let ix = -r; ix <= r; ix += 1)
      for (let iz = -r; iz <= r; iz += 1) {
        if (Math.max(Math.abs(ix), Math.abs(iz)) !== r) continue;
        const c: XZ = [+(pad[0] + ix * 0.6).toFixed(2), +(pad[1] + iz * 0.6).toFixed(2)];
        if (bumpIn(COMP, c) > PEAK_LIMIT || !isDryIn(COMP, c)) continue;
        if (inCorridor(c, 1.2)) continue;
        const o = offPathCell(NET, c, { clear });
        if (o && Math.hypot(o[0] - c[0], o[1] - c[1]) < 1e-6) {
          console.warn(`[park] ${label}: [${pad}] on a hill flank / wet ` +
            `(bump ${bumpIn(COMP, pad).toFixed(2)}) — MOVED to [${c}]`);
          return c;
        }
      }
  parkAssert('padOnFlank', false,
    `${label}: [${pad}] is on a hill flank (bump ${bumpIn(COMP, pad).toFixed(2)} > ${PEAK_LIMIT}) OR ` +
    `WET, and no cell within 4.8 u is flat, dry AND ${clear} u off the street. The rig is on a range ` +
    `or in a lake — its pad and hut will each be charged -3 on axis 7.`, 'advisory');
  return pad;
}

type Placed3 = { pad: XZ; anchor: XZ; dir: XZ; yaw: number; rig: string };
const COMMITTED: { label: string; cx: number; cz: number; hx: number; hz: number }[] = [];
function place(tail: XZ, out: XZ, capacity: number, rig: string): Placed3 {
  const clear = padMarginOf(rig);
  const join = laneLenOf(capacity) + 0.35;
  const reach = minReachOf(capacity) + 2.4;
  const cand: XZ = [+(tail[0] + out[0] * reach).toFixed(2), +(tail[1] + out[1] * reach).toFixed(2)];
  const onStreet = (offPathCell(NET, cand, { clear }) ?? cand) as XZ;
  const pad = assertPadFlat(onStreet, clear, `${rig} boardPoint pad`);
  const rawAnchor: XZ = [+(tail[0] + out[0] * join).toFixed(2), +(tail[1] + out[1] * join).toFixed(2)];
  const anchor = assertPadFlat(rawAnchor, 0.6, `${rig} entrance hut`);
  const got = Math.hypot(pad[0] - tail[0], pad[1] - tail[1]);
  if (got < minReachOf(capacity) + 1.2)
    parkAssert('padReach', false,
      `${rig}: pad [${pad}] sits ${got.toFixed(2)} u from its tail [${tail}] — the cap-${capacity} ` +
      `floor is ${(minReachOf(capacity) + 1.2).toFixed(2)} u. offPathCell pulled the candidate INWARD: ` +
      `move the TAIL outward, open the court, or DROP this one ride. Never throw over it.`, 'advisory');
  // the ring registers a rect per BEAM SPAN — stand clear of the whole loop, not the decks
  const need = clear + 2.0;
  const bd = beamDist(pad);
  parkAssert('ringBeamClearance', bd >= need,
    `${rig}: pad [${pad}] is ${bd.toFixed(2)} u from the monorail BEAM POLYLINE and needs ${need.toFixed(2)} ` +
    `(padMarginOf ${clear} + 2.0). This is the rideSpacing.obb.minGap defect: the ring is a 170-u loop of ` +
    `thin per-span rects, not a point. Move the TAIL — -2 on axis 3 and -0.25 on axis 13.`, 'advisory');
  parkAssert('padInCorridor', !inCorridor(pad, bodyHalfOf(rig)),
    `${rig}: pad [${pad}] (body half ${bodyHalfOf(rig).toFixed(2)}) reaches into a published coaster ` +
    `corridor rect — that is a corridor FAIL on axis 12.`, 'advisory');
  COMMITTED.push({ label: rig, cx: pad[0], cz: pad[1], hx: bodyHalfOf(rig), hz: bodyHalfOf(rig) });
  return { pad, anchor, dir: [-out[0], -out[1]] as XZ, yaw: Math.atan2(-out[0], -out[1]), rig };
}

/* ── THE ROSTER — 10 rides, 5 categories, every tail an authored NODE ─────────────── */
const KARTS = place(CELLS.gateS, [-1, 0], 4, 'GoKarts');          // thrill · gate smoke ride
const GHOST = place(CELLS.e456, [1, 0], 4, 'GhostTrain');         // dark · enchantedForest
const TWIST = place(CELLS.e24, [1, 0], 4, 'TwistRide');           // gentle
const FLUME = place(CELLS.e12, [1, 0], 4, 'LogFlume');            // water · pirateBeach
const CAROUSEL = place(CELLS.w18, [-1, 0], 4, 'Carousel');        // gentle
const CUPS = place(CELLS.s96, [0, -1], 4, 'Teacups');             // gentle
const WHEEL = place(CELLS.wm, [0, -1], 4, 'FerrisWheel');         // gentle · steampunk

ALL_PLANS.forEach((p) => COMMITTED.push({
  label: `${p.id} (${p.kind})`, cx: p.footprint.cx, cz: p.footprint.cz,
  hx: p.footprint.hx, hz: p.footprint.hz,
}));
RING_BEAM.forEach(([a, b], i) => COMMITTED.push({
  label: `ring beam span ${i}`,
  cx: (a[0] + b[0]) / 2, cz: (a[1] + b[1]) / 2,
  hx: Math.abs(b[0] - a[0]) / 2 + 0.6, hz: Math.abs(b[1] - a[1]) / 2 + 0.6,
}));

/* the axis-3 measurement itself: an ORIENTED-BOX EDGE GAP, not a pad-centre pitch */
(function obbSelfCheck() {
  const hits: string[] = [];
  COMMITTED.forEach((a, i) => COMMITTED.slice(i + 1).forEach((b) => {
    if (a.label.startsWith('ring beam') && b.label.startsWith('ring beam')) return;
    const gap = Math.max(Math.abs(a.cx - b.cx) - (a.hx + b.hx), Math.abs(a.cz - b.cz) - (a.hz + b.hz));
    if (gap < SPACING_FLOOR) hits.push(`${a.label} vs ${b.label} gap ${gap.toFixed(2)}`);
  }));
  parkAssert('obbMinGap', !hits.length,
    `${hits.length} pair(s) under the ${SPACING_FLOOR} u OBB EDGE GAP floor — -2 on axis 3 AND -0.25 on ` +
    `axis 13 (its ride-count term is gated on axis 3 being full):\n  ${hits.join('\n  ')}`, 'advisory');
  const worst = COMMITTED.length < 2 ? Infinity : Math.min(...COMMITTED.flatMap((a, i) =>
    COMMITTED.slice(i + 1).map((b) => (a.label.startsWith('ring beam') && b.label.startsWith('ring beam'))
      ? Infinity
      : Math.max(Math.abs(a.cx - b.cx) - (a.hx + b.hx), Math.abs(a.cz - b.cz) - (a.hz + b.hz)))));
  console.log(`[park] author-time OBB minGap ${worst.toFixed(2)} u (floor ${SPACING_FLOOR}) over ` +
    `${COMMITTED.length} committed rects incl. ${RING_BEAM.length} beam spans`);
})();

/* ── §0-P.5 the wiring assertions ────────────────────────────────────────────────── */
const portCell = (ref: NetRef): XZ => {
  if (typeof ref === 'number') return NODES[ref];
  const [id, name] = ref.split(':');
  const p = ALL_PLANS.find((q) => q.id === id);
  if (!p) throw new Error(`EDGES references '${ref}' but no plan has id '${id}'`);
  return p.port(name);
};
const EPS = 1e-6;
EDGES.forEach(([a, b]) => {
  const A = portCell(a), B = portCell(b);
  parkAssert('cardinalEdge', Math.abs(A[0] - B[0]) < EPS || Math.abs(A[1] - B[1]) < EPS,
    `edge ${a}→${b} is DIAGONAL: [${A}] → [${B}]. buildParkNet ELBOWS it through a synthesised corner ` +
    `node you did not plan. Move one endpoint so the pair shares an x or a z.`, 'advisory');
});
const PORT_REFS = EDGES.flat().filter((x): x is string => typeof x === 'string');
console.log(`[park] PORT-REFS: ${ALL_PLANS.length} pieces → ${PORT_REFS.length} refs [${PORT_REFS.join(' ')}]`);
ALL_PLANS.forEach((p) => {
  const wired = new Set(PORT_REFS.filter((r) => r.split(':')[0] === p.id).map((r) => r.split(':')[1]));
  parkAssert('pieceIsland', wired.size > 0,
    `set-piece '${p.id}' has NO '${p.id}:<PORT>' ref in EDGES — it composes as an ISLAND`);
  p.ports.filter((pt: any) => !pt.prunable).forEach((pt: any) => {
    parkAssert('chainEnd', wired.has(pt.name),
      `chain piece '${p.id}' (${p.kind}) wires [${[...wired]}] but NOT '${p.id}:${pt.name}' — that end of ` +
      `the carriageway dead-ends in grass (deadStreetNode).`);
  });
});
const SOLID_CLEAR: Record<string, number> = { FountainPlaza: 1.8, Bazaar: 0.6, Boulevard: 0 };
function assertNodesOffPieces(cells: XZ[], plans: SetPiecePlan[], what: string): void {
  const hits: string[] = [];
  plans.forEach((p) => {
    const clear = SOLID_CLEAR[p.kind] ?? 1.8;
    if (clear === 0) return;
    const ports = new Set(p.ports.map((pt: any) => `${pt.at[0].toFixed(2)},${pt.at[1].toFixed(2)}`));
    const f: any = p.footprint;
    const c = Math.cos(-f.yaw), s = Math.sin(-f.yaw);
    cells.forEach((n, i) => {
      if (ports.has(`${n[0].toFixed(2)},${n[1].toFixed(2)}`)) return;
      const dx = n[0] - f.cx, dz = n[1] - f.cz;
      const lx = dx * c - dz * s, lz = dx * s + dz * c;
      const gap = Math.max(Math.abs(lx) - f.hx, Math.abs(lz) - f.hz);
      if (gap < clear - 1e-9)
        hits.push(`[${n[0]}, ${n[1]}] (${what} ${i}) is ${gap.toFixed(2)} u from '${p.id}' (${p.kind}) — needs ${clear}`);
    });
  });
  parkAssert('nodeInSolid', !hits.length,
    `${hits.length} ${what} cell(s) stand inside or against a set-piece's SOLID footprint:\n  ${hits.join('\n  ')}`);
}
const PADS: XZ[] = [KARTS, GHOST, TWIST, FLUME, CAROUSEL, CUPS, WHEEL].map((r) => r.pad);
const ANCHORS: XZ[] = [KARTS, GHOST, TWIST, FLUME, CAROUSEL, CUPS, WHEEL].map((r) => r.anchor);
assertNodesOffPieces(NODES, ALL_PLANS, 'street node');
assertNodesOffPieces([...PADS, ...ANCHORS], ALL_PLANS, 'ride pad/hut');

/* the four ring tails must be street LEAVES — a street past a tail runs through the deck */
(function ringTailsAreLeaves() {
  const deg = new Map<string, number>();
  EDGES.forEach(([a, b]) => [a, b].forEach((r) => {
    const c = portCell(r); const k = `${c[0].toFixed(2)},${c[1].toFixed(2)}`;
    deg.set(k, (deg.get(k) ?? 0) + 1);
  }));
  RING_TAILS.forEach((t, i) => {
    const d = deg.get(`${t[0].toFixed(2)},${t[1].toFixed(2)}`) ?? 0;
    parkAssert('ringTailLeaf', d === 1,
      `monorail platform ${i} tail [${t}] has degree ${d}, not 1 — a street continuing past a tail runs ` +
      `through the deck (blockers FAIL). Branch every onward street off a SPINE JUNCTION.`);
  });
  const ALL_TAILS: XZ[] = [...RING_TAILS, L_TAIL, B_TAIL,
    CELLS.gateS, CELLS.e456, CELLS.e24, CELLS.e12, CELLS.w18, CELLS.s96, CELLS.wm];
  const onPort = ALL_TAILS.filter((t) =>
    ALL_PLANS.some((p) => p.ports.some((pt: any) => eq(pt.at as XZ, t))));
  parkAssert('tailsOffPorts', !onPort.length,
    `queue tail(s) sit ON a set-piece PORT cell: ${JSON.stringify(onPort)} — a port is a street ` +
    `connector, not a queue anchor.`);
  const dupes = ALL_TAILS.filter((t, i) => ALL_TAILS.findIndex((u) => eq(u, t)) !== i);
  parkAssert('sharedTail', !dupes.length,
    `two rides share a queue tail node: ${JSON.stringify(dupes)}.`);
})();
/* the gate-walk budget: a NON-monorail tail inside 15 u of the turnstile */
parkAssert('gateWalk', Math.hypot(CELLS.gateS[0] - GATE_CELL[0], CELLS.gateS[1] - GATE_CELL[1]) <= 15,
  'no ride tail within 15 u of the gate — the 60 sim-s smoke cycle has nothing to ride.', 'advisory');
/* every street node clear of both coaster corridors */
parkAssert('nodeInCorridor', !NODES.some((c) => inCorridor(c, 1.35)),
  `street node(s) inside a coaster corridor rect: ${JSON.stringify(NODES.filter((c) => inCorridor(c, 1.35)))}`,
  'advisory');

/* ── THE THREE WORLDS — declared AFTER the pads exist, out of the real pads ───────── */
const COVE_WORLD = worldPlan({
  id: 'coveWorld', theme: TIDEWATER_HOLLOW, pieces: [COVE_ROW],
  include: [FLUME.pad, FLUME.anchor, RING_DECKS[2]],
});
const GLADE_WORLD = worldPlan({
  id: 'gladeWorld', theme: THORNWICK_GLADE, pieces: [GLADE_ROW],
  include: [GHOST.pad, GHOST.anchor, RING_DECKS[1]],
});
const FOUNDRY_WORLD = worldPlan({
  id: 'foundryWorld', theme: BRASSWORK_FOUNDRY, pieces: [FOUNDRY_ROW],
  include: [WHEEL.pad, WHEEL.anchor, RING_DECKS[0]],
});
const WORLDS = [COVE_WORLD, GLADE_WORLD, FOUNDRY_WORLD];
(function worldChecks() {
  const FLOOR = 20 * Math.sqrt(SIZE / 48);
  const pairs: string[] = [];
  WORLDS.forEach((a: any, i) => WORLDS.slice(i + 1).forEach((b: any) => {
    const d = Math.hypot(a.centre[0] - b.centre[0], a.centre[1] - b.centre[1]);
    pairs.push(`${a.id}↔${b.id} ${d.toFixed(1)}`);
    parkAssert('worldsTooClose', d >= FLOOR,
      `world centres ${a.id} ↔ ${b.id} are ${d.toFixed(2)} u apart, under the ${FLOOR.toFixed(2)} u floor.`);
    const gapX = Math.abs(a.centre[0] - b.centre[0]) - (a.half[0] + b.half[0]);
    const gapZ = Math.abs(a.centre[1] - b.centre[1]) - (a.half[1] + b.half[1]);
    parkAssert('worldRectsTouch', Math.max(gapX, gapZ) > 0,
      `world rects ${a.id} ↔ ${b.id} touch or overlap (gap ${Math.max(gapX, gapZ).toFixed(2)}) — ` +
      `touching rects are ONE district, not two.`);
  }));
  console.log(`[park] world centre pairs: ${pairs.join(' · ')} (floor ${FLOOR.toFixed(2)})`);
  const decks: [string, XZ][] = [['foundryWorld', RING_DECKS[0]], ['gladeWorld', RING_DECKS[1]], ['coveWorld', RING_DECKS[2]]];
  decks.forEach(([id, d]) => {
    const w: any = WORLDS.find((x: any) => x.id === id);
    parkAssert('worldNotOnRing', !!w && w.contains(d),
      `world '${id}' does not contain its monorail deck [${d}] — everyWorldTouched will read false.`, 'advisory');
  });
  const rides: [string, XZ][] = [['coveWorld', FLUME.pad], ['gladeWorld', GHOST.pad], ['foundryWorld', WHEEL.pad]];
  rides.forEach(([id, p]) => {
    const w: any = WORLDS.find((x: any) => x.id === id);
    parkAssert('worldNotBuiltOut', !!w && w.contains(p),
      `world '${id}' holds NO registered ride pad — [${p}] fell outside its rect.`);
  });
})();

/* ── DRESSING — every cell off the streets, off the rects, off the corridors, off the
 *    beam, off the pinned row's water, then re-checked IN THE TREE by the gate's test ── */
const clearOfCommitted = (c: XZ, need: number) => COMMITTED.every((r) =>
  Math.max(Math.abs(c[0] - r.cx) - r.hx, Math.abs(c[1] - r.cz) - r.hz) >= need);
function freeCells(clear: number): XZ[] {
  const out: XZ[] = [];
  for (let x = -56.4; x <= 56.4; x += 2.4)
    for (let z = -56.4; z <= 56.4; z += 2.4) {
      const c: XZ = [+x.toFixed(2), +z.toFixed(2)];
      if (!offRow(c) || !isDryIn(COMP, c)) continue;
      if (bumpIn(COMP, c) > 3.0) continue;
      if (inCorridor(c, 1.8)) continue;
      if (beamDist(c) < 2.0) continue;
      if (!clearOfCommitted(c, 1.2)) continue;
      const o = offPathCell(NET, c, { clear });
      if (!o || Math.hypot(o[0] - c[0], o[1] - c[1]) > 1e-6) continue;
      out.push(c);
    }
  return out.sort((a, b) => hash01(a[0] * 31 + a[1] * 17 + 5) - hash01(b[0] * 31 + b[1] * 17 + 5));
}
const FREE_PROP = freeCells(1.2);
const FREE_TREE = freeCells(0.75).filter((c) => !FREE_PROP.slice(0, 26).some((p) => eq(p, c)));
const SCENERY_NAMES = ['marbleStatue', 'birdbath', 'picnicTable', 'planterBox', 'topiarySpiral',
  'topiaryElephant', 'signpost', 'parkClock', 'flagpole', 'ironArchway', 'brickWall', 'picketFence',
  'lionStatue', 'fallenLog', 'wishingWell', 'gazebo', 'hotAirBalloon', 'mushroomCluster'] as const;
const SCENERY: { at: XZ; name: string }[] = FREE_PROP.slice(0, 26)
  .map((at, i) => ({ at, name: SCENERY_NAMES[i % SCENERY_NAMES.length] }));
const TREE_SHAPES = ['round', 'pine', 'willow', 'round', 'pine'] as const;
type TreeShape = (typeof TREE_SHAPES)[number];
const TREES: { at: XZ; shape: TreeShape }[] = FREE_TREE.slice(0, 48)
  .map((at, i) => ({ at, shape: TREE_SHAPES[i % TREE_SHAPES.length] }));
parkAssert('dressFloors', TREES.length >= 36 && SCENERY.length >= 20,
  `over-provisioning short: ${TREES.length} tree cells (want >= 36 against the 32 floor) and ` +
  `${SCENERY.length} scenery cells (want >= 20 against the 16 floor) survived the author-time sieve.`,
  'advisory');
console.log(`[park] dress: ${TREES.length} tree cells · ${SCENERY.length} scenery cells authored ` +
  `(floors 32 / 16 after the DryScatter water sieve)`);

const REST_CELL = (offPathCell(NET, [6.0, 57.6], { clear: 1.8 }) ?? [6.0, 57.6]) as XZ;
const LIGHT_RUNS: [XZ, XZ][] = [
  [CELLS.gate, CELLS.gateS], [CELLS.glade, CELLS.e456],
  [CELLS.e18, CELLS.s96], [CELLS.w456, CELLS.w18],
];
const NEON_AT = FREE_PROP.slice(26, 28);
const TORCH_AT = FREE_PROP.slice(28, 32);

const RIDE_NAMES = [
  "Serpent's Coil", 'Gullwing Racer', 'Three Crowns Skyline', 'Saltmarsh Chute',
  'Hollowlamp Halt', 'Cinder Alley Karts', 'Brasswork Big Wheel', 'Driftwood Carousel',
  'Kelpwood Cups', 'Weathervane Whirl',
];
parkAssertFlush();

/* ── the GATE'S OWN dryness predicate, IN THE TREE, over cells that can be dropped ── */
function dryRing(park: any, c: XZ, r = 0.75): boolean {
  const g = park.ground;
  if (!g) { console.error('[park] dryRing ran with NO TERRAIN — a VACUOUS pass'); return true; }
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
  const park = usePark('DryScatter');
  const [dry, setDry] = React.useState<T[] | null>(null);
  React.useEffect(() => {
    const kept = cells.filter((c) => dryRing(park, c.at));
    if (kept.length < cells.length)
      console.error(`[park] DryScatter(${label}) dropped ${cells.length - kept.length} of ${cells.length} ` +
        `cell(s) UNDER waterline+0.05: ${JSON.stringify(cells.filter((c) => !kept.includes(c)).map((c) => c.at))}`);
    else console.log(`[park] DryScatter(${label}): all ${cells.length} cells dry`);
    setDry(kept);
  }, [park, cells, label]);
  return <>{(dry ?? []).map(render)}</>;
}

export function App() {
  const onReady = React.useCallback((report: any) => {
    console.log('[park] validatePark', report?.ok, report);
    const rects: any[] = report?.footprints ?? [];
    const hits: string[] = [];
    rects.forEach((a, i) => rects.slice(i + 1).forEach((b) => {
      if (a.rideId != null && a.rideId === b.rideId) return;
      const gap = Math.max(Math.abs(a.cx - b.cx) - (a.hx + b.hx), Math.abs(a.cz - b.cz) - (a.hz + b.hz));
      if (gap < SPACING_FLOOR) hits.push(`${a.label} vs ${b.label} gap ${gap.toFixed(2)}`);
    }));
    if (hits.length) console.error(`[park] SPACING: ${hits.length} pair(s) under ${SPACING_FLOOR} u — ` +
      `-2 on axis 3, -0.25 on axis 13:\n  ${hits.join('\n  ')}`);
    else console.log(`[park] SPACING clean over ${rects.length} registered rects`);
  }, []);

  return (
    <div className="w-full min-h-full bg-[#3f5a35]">
      <Park
        seed={SEED}
        climate={CLIMATE}
        roster={{ rides: RIDE_NAMES, stalls: 9, categories: 5 }}
        onReady={onReady}
      >
        <Terrain keepDry={GUARDS} coasterPts={ALL_COASTER_PTS} />
        <Paths
          nodes={NET.nodes}
          edges={NET.edges}
          plazas={NET.plazas}
          bins={NET.bins}
          walkers={6}
        />
        <GameManager />
        <Gate />

        <Coaster
          name="Serpent's Coil"
          pieces={L_PIECES}
          start={L_START}
          heading={0}
          type="steel"
          cars={3}
          capacity={4}
          rideDuration={11}
          loadTime={2}
          intensity={9}
          price={7}
          queueTailNode={NET.node(L_TAIL)}
          queueDir={[1, 0]}
        />
        <Coaster
          name="Gullwing Racer"
          pieces={B_PIECES}
          start={B_START}
          heading={0}
          type="steel"
          cars={3}
          capacity={4}
          rideDuration={12}
          loadTime={2}
          intensity={6}
          price={5}
          queueTailNode={NET.node(B_TAIL)}
          queueDir={[1, 0]}
        />

        <Monorail
          position={RING_POS}
          rotation={0}
          pieces={[
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
          ]}
          beamY={2.6}
          loopSeconds={12}
          pinned
          name="Three Crowns Skyline"
          capacity={6}
          rideDuration={12}
          intensity={1}
          price={0}
          queue={{ anchor: RING_ANCHORS[0], dir: [1, 0] }}
          register={{
            board: [RING_DECKS[0][0], 2.6, RING_DECKS[0][1]],
            stations: [
              {
                label: 'North', boardPoint: [RING_DECKS[1][0], 2.6, RING_DECKS[1][1]],
                queueAnchor: [RING_ANCHORS[1][0], 0.05, RING_ANCHORS[1][1]], queueDir: [0, -1],
                exitPoint: [RING_EXITS[0][0], 0.05, RING_EXITS[0][1]], exitDir: [0, -1],
              },
              {
                label: 'East', boardPoint: [RING_DECKS[2][0], 2.6, RING_DECKS[2][1]],
                queueAnchor: [RING_ANCHORS[2][0], 0.05, RING_ANCHORS[2][1]], queueDir: [-1, 0],
                exitPoint: [RING_EXITS[1][0], 0.05, RING_EXITS[1][1]], exitDir: [-1, 0],
              },
              {
                label: 'South', boardPoint: [RING_DECKS[3][0], 2.6, RING_DECKS[3][1]],
                queueAnchor: [RING_ANCHORS[3][0], 0.05, RING_ANCHORS[3][1]], queueDir: [0, -1],
                exitPoint: [RING_EXITS[2][0], 0.05, RING_EXITS[2][1]], exitDir: [0, -1],
              },
            ],
          }}
        />

        <LogFlume
          position={FLUME.pad}
          rotation={FLUME.yaw}
          name="Saltmarsh Chute"
          capacity={4}
          rideDuration={11}
          loadTime={2}
          intensity={5}
          price={4}
          register={{ name: 'Saltmarsh Chute', capacity: 4, price: 4 }}
          queue={{ anchor: FLUME.anchor, dir: FLUME.dir }}
        />
        <GhostTrain
          position={GHOST.pad}
          rotation={GHOST.yaw}
          name="Hollowlamp Halt"
          capacity={4}
          rideDuration={10}
          loadTime={2}
          intensity={4}
          price={4}
          register={{ name: 'Hollowlamp Halt', capacity: 4, price: 4 }}
          queue={{ anchor: GHOST.anchor, dir: GHOST.dir }}
        />
        <GoKarts
          position={KARTS.pad}
          rotation={KARTS.yaw}
          name="Cinder Alley Karts"
          capacity={4}
          rideDuration={11}
          loadTime={2}
          intensity={6}
          price={4}
          register={{ name: 'Cinder Alley Karts', capacity: 4, price: 4 }}
          queue={{ anchor: KARTS.anchor, dir: KARTS.dir }}
        />
        <FerrisWheel
          position={WHEEL.pad}
          rotation={WHEEL.yaw}
          name="Brasswork Big Wheel"
          capacity={4}
          rideDuration={10}
          loadTime={2}
          intensity={2}
          price={3}
          register={{ name: 'Brasswork Big Wheel', capacity: 4, price: 3 }}
          queue={{ anchor: WHEEL.anchor, dir: WHEEL.dir }}
        />
        <Carousel
          position={CAROUSEL.pad}
          rotation={CAROUSEL.yaw}
          name="Driftwood Carousel"
          capacity={4}
          rideDuration={9}
          loadTime={2}
          intensity={1}
          price={2}
          register={{ name: 'Driftwood Carousel', capacity: 4, price: 2 }}
          queue={{ anchor: CAROUSEL.anchor, dir: CAROUSEL.dir }}
        />
        <Teacups
          position={CUPS.pad}
          rotation={CUPS.yaw}
          name="Kelpwood Cups"
          capacity={4}
          rideDuration={9}
          loadTime={2}
          intensity={2}
          price={2}
          register={{ name: 'Kelpwood Cups', capacity: 4, price: 2 }}
          queue={{ anchor: CUPS.anchor, dir: CUPS.dir }}
        />
        <TwistRide
          position={TWIST.pad}
          rotation={TWIST.yaw}
          name="Weathervane Whirl"
          capacity={4}
          rideDuration={10}
          loadTime={2}
          intensity={3}
          price={3}
          register={{ name: 'Weathervane Whirl', capacity: 4, price: 3 }}
          queue={{ anchor: TWIST.anchor, dir: TWIST.dir }}
        />

        <Restroom position={REST_CELL} rotation={Math.PI} />

        <World plan={COVE_WORLD} />
        <World plan={GLADE_WORLD} />
        <World plan={FOUNDRY_WORLD} />
        <FountainPlaza plan={HUB} />
        <Bazaar plan={COVE_ROW} />
        <Bazaar plan={GLADE_ROW} />
        <Bazaar plan={FOUNDRY_ROW} />

        {LIGHT_RUNS.map(([a, b], i) => <Lights key={`lt-${i}`} from={a} to={b} />)}
        {NEON_AT.map((c, i) => (
          <Neon key={`ne-${i}`} text={i === 0 ? 'MIDWAY' : 'THE COVE'}
            position={[c[0], 1.7, c[1]]} rotation={i === 0 ? Math.PI : 0} scale={0.55} />
        ))}
        {TORCH_AT.map((c, i) => <Torch key={`to-${i}`} position={c} />)}

        <DryScatter cells={SCENERY} label="scenery"
          render={(s, i) => <Scenery key={`sc-${i}`} name={s.name} position={s.at} seed={i + 1} />} />
        <DryScatter cells={TREES} label="trees"
          render={(t, i) => (
            <Placed key={`tr-${i}`} position={t.at} build={(three: any) => tree(three, { shape: t.shape })} />
          )} />
        <DryScatter cells={[...PADS, ...ANCHORS, ...RING_DECKS].map((at) => ({ at }))}
          label="pads+huts+decks" render={() => null} />
      </Park>
    </div>
  );
}

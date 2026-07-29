/* ═══ EMBERFALL JUNCTION — §0 PRE-FLIGHT ══════════════════════════════════════════════
 * SIZE   128 (default, `size` prop omitted)
 * SEED   1 / temperate — dominant lake ctr (41, −39) SE · secondary ctr (−38, 31) NW  [PRE-keepDry]
 *        RING WATER WALK: all 16 ring cells are walked against BOTH pinned basin boxes by
 *        `ringAt()` + `poseOk()` at module scope, together with the FLANK test the terrain
 *        gate itself runs (bumpIn ≤ 0.75 over the deck cell and its 4 corners). The pose is
 *        SEARCHED over dz ∈ [−4.8 … +2.4] and dx ∈ [−3.6 … +3.6] and the first clear one is
 *        taken; the chosen offsets, every deck bump and every dropped candidate are printed.
 *        reliefFloor.kept + BOTH water centroids are diffed guarded-vs-unguarded at runtime.
 * WORLDS 3 (≥ 3): steampunk @(≈−52,−12) · fire @(≈−10,−34) · neon @(≈+33,+46)
 *        closest centre pair steampunk↔fire ≈ 51 u ◄ ≥ 32.66 (20·√(128/48)) ✓ · rect gap > 0 ✓
 *        WORLD steampunk: rides AetherBalloons + BoilerBurst (2 OF ITS THEME, distinct names)
 *              · stall 'goggles' in worksRow · 10 BrassworkScenery placements · spur off the
 *              west row + its own column ✓ · CONTAINS the WEST monorail deck ✓
 *        WORLD neon: rides Bassline + Discotron (2 OF ITS THEME) · stall 'neonSlush' in
 *              pulseRow · 10 PulseScenery placements · spur = the east arm ✓
 *        WORLD fire: stall 'emberRoast' in emberRow · 10 EmberfallScenery placements · spur =
 *              the south row + the x −24 column ✓ · CONTAINS the SOUTH monorail deck ✓
 *              ⚠ HONEST GAP: its two rides (Teacups, TwistRide) are NEUTRAL, not fire-themed.
 *              Every fire RIDE in the catalog (MagmaRun 16.5×12.7 + a 27-u ash apron and
 *              rideDuration 20, EmberWings, LavaTubeRun) is too large for any pocket left
 *              between the monorail ring, the two coaster corridors, the z≈−43 range and the
 *              SE lake, and MagmaRun's 20 s lap breaks the ≤ 12 s acceptance window. Reported
 *              rather than faked.
 * CATS   gentle Carousel/FerrisWheel/Teacups/AetherBalloons · thrill §4.0-C flagship +
 *        §4.0-B + BoilerBurst + Bassline + Discotron + TwistRide · water LogFlume ·
 *        transport Monorail ring · dark GhostTrain  → 5/5 categories ✓
 * CIRCUITS §4.0-C · §4.0-B · Monorail ring · LogFlume · Bassline → 5 circuits, families
 *        coaster + transport + water = 3 ✓
 * GATE   [0, 63.6] → [0, 58.8] → [0, 54.0] = Carousel tail, 9.6 u of street ≤ 15 ✓
 * FLAG   §4.0-C start [16.8, 0.55, −3.6] heading 0, steel, cars 3, NO bank prop (builds 0.7)
 *        rateCoaster(bank 0.7, cars 3) → E 6.27 / I 9.55 / N 3.55 / drop 5.47 / maxLatG 0.73
 *        / air 1.33 s / inversions 2 — re-measured and PRINTED at module scope by verify()
 *        CORRIDOR KEEP-OUT (plot coords, published): west x[−19.2,−16.8] z[−4.8,10.8] ·
 *        south x[−10.8,4.8] z[−19.2,−16.8] · north x[−8.4,7.2] z[18.0,19.2] · station leg
 *        x[15.6,18.0] z[−10.8,4.8]. Every street node and set-piece is outside all four ✓
 * FLAG2  §4.0-B start [−33.6, 0.55, −48.0] heading 0, steel, cars 3, NO bank prop
 *        E 5.27 / I 6.25 / N 2.25 / drop 3.58 / maxLatG 0.27 · DIFFERENT archetype ·
 *        bbox DISJOINT from FLAG's by 15.18 u in x and 12.69 in z · coasterPts = both ✓
 * STREET buildParkNet called EXACTLY ONCE, WITHOUT `worlds` (the pads are derived from the
 *        fused NET, so the worlds are declared after it) · the SAME NET feeds <Paths>, every
 *        offPathCell and every queue tail · 4 PORT-REFS in EDGES (hub:N, hub:E, hub:W,
 *        pulseRow:W, emberRow:E, worksRow:E = 6) ✓
 * MONO   ring pieces VERBATIM from the published block · beamY 2.6 · price 0 · trains 4 ·
 *        4 platforms, W authored + N/E/S via register.stations · all four tails are authored
 *        street LEAVES · the SOUTH platform queues OUTWARD ([0,−1]) — measured, it keeps the
 *        z≈−43 range off the terrain guard · onward streets branch off SPINE junctions, never
 *        off a platform tail (the N tail is reached laterally from [9.6, …]) ✓
 * QUEUE  every tail is an AUTHORED NODE and every pad is DERIVED from it through place():
 *        pad = tail + out·(laneLenOf(cap) + 4.32), then offPathCell(clear), then
 *        assertPadFlat (bump over the pad AND its 4 corners, plus dryness, with an outward
 *        ring search). No two rides share a tail node ✓
 * SPREAD built extent ≈ 118 × 118 u; street-node bbox x[−58.8, 45.6] z[−62.4, 63.6] ✓
 * PLAZAS hub 8.4 × 8.4 = 70 u² + 3 bazaar courts → largest ≥ 8 ✓ · no set-piece `position`
 *        appears in NODES or as a queue tail (assertNodesOffPieces re-runs over the PADS) ✓
 * NODES  39 authored · degree-1: gate, 4 monorail tails, AetherBalloons tail, §4.0-B tail —
 *        every leaf carries something ✓ · one park-spanning loop (hub → east arm → east spine
 *        → south row → x −24 column → west spine → hub) crossing z = 0 ✓
 * DRESS  44 tree cells (≥ 32) and 38 scenery placements (≥ 16) authored, every one pushed off
 *        the street by offPathCell and then sieved IN THE TREE by DryScatter against the
 *        gate's own predicate (min ground > WATER_LEVEL + 0.05) — over-provisioned so a drop
 *        still clears the floor ✓
 * ROSTER 13 rides / 5 categories / 9 stalls (3 bazaar rows × 3, all authored names) /
 *        restroom ✓ / bins from NET ✓ — restated on <Park roster> ✓
 * GATE   parkAssertFlush() reports and NEVER throws; a blocking failure drops ONE piece and
 *        the park still renders. validatePark runs in the preview and is logged by onReady.
 * ═══════════════════════════════════════════════════════════════════════════════════════ */
import * as THREE from 'three';
import React from 'react';
import {
  Park, GameManager, Terrain, Paths, Gate, Coaster, ThemeRegion,
  Restroom, Scenery, Lights, Placed, Torch, Neon, usePark, offPathCell,
} from './components/Park';
import { laneLenOf, parkComposition } from './components/ParkBuilder';
import { buildParkNet, worldPlan, World, WORLD_THEMES } from './components/SetPieceKit';
import { bazaarPlan, Bazaar } from './components/Bazaar';
import { fountainPlazaPlan, FountainPlaza } from './components/FountainPlaza';
import { compileTrackPieces, rateCoaster, checkCoasterDesign } from './components/SplineRideKit';
import { tree } from './components/Kit';
import { Monorail } from './components/Monorail';
import { Carousel } from './components/Carousel';
import { FerrisWheel } from './components/FerrisWheel';
import { Teacups } from './components/Teacups';
import { TwistRide } from './components/TwistRide';
import { LogFlume } from './components/LogFlume';
import { GhostTrain } from './components/GhostTrain';
import { AetherBalloons } from './components/AetherBalloons';
import { BoilerBurst } from './components/BoilerBurst';
import { Bassline } from './components/Bassline';
import { Discotron } from './components/Discotron';
import { GiantGear, SteamPipes, ClockTower, BoilerTank, CoalCart } from './components/BrassworkScenery';
import { NeonArch, SpeakerStack, MirrorBallPylon, LaserTruss, LightTiles } from './components/PulseScenery';
import { Fumarole, ObsidianShards, BasaltColumns, LavaFissure, CharredSnag } from './components/EmberfallScenery';

type XZ = [number, number];
type V3 = [number, number, number];
type Piece = any;

const SIZE = 128;
const SEED = 1;
const CLIMATE = 'temperate';
const PEAK_LIMIT = 0.75;
const LAT_GUARD = 1.275;

/* ── §0-P.5 the ONE assertion sink — it REPORTS, it never throws ─────────────── */
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
    console.error(`[park] ${blocking.length} BLOCKING failure(s) — the offending piece is DROPPED and ` +
      `the rest of the park still renders (aborting would score 0 on every axis).`);
}

/* ── §4.0-C the INVERTING steel flagship (2 corkscrews) ─────────────────────── */
const C_PIECES: Piece[] = [
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

/* ── §4.0-B the gentler FAMILY archetype, deep south-west ───────────────────── */
const B_PIECES: Piece[] = [
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

/* The kit's entry points are THREE-first in some builds and points-first in others, and a
 * wrong guess lands the pieces array in the `t` slot — `t.CatmullRomCurve3 is not a
 * constructor`, at MODULE SCOPE, which takes the whole page. So every kit call here tries
 * both shapes and degrades to "unverified" instead of throwing: the park still renders and
 * each <Coaster> re-compiles + gates its own circuit internally. */
function attempt<T>(label: string, calls: (() => T)[], accept: (v: any) => boolean): T | null {
  for (const call of calls) {
    try { const v: any = call(); if (accept(v)) return v; } catch (e: any) {
      console.warn(`[park] ${label}: signature attempt failed — ${e?.message ?? e}`);
    }
  }
  return null;
}
function verify(label: string, pieces: Piece[], start: V3) {
  const opts: any = { profile: 'coaster', type: 'steel', start, heading: 0, bounds: SIZE };
  const out: any = attempt('compileTrackPieces', [
    () => (compileTrackPieces as any)(pieces, opts),
    () => (compileTrackPieces as any)(THREE, pieces, opts),
    () => (compileTrackPieces as any)(pieces, { ...opts, three: THREE }),
  ], (v) => Array.isArray(v?.points) && v.points.length > 3);
  if (!out) {
    parkAssert(`coaster:${label}`, false,
      `${label}: compileTrackPieces answered no usable points under any known signature — the circuit is ` +
      `mounted UNVERIFIED and <Coaster>'s own fatal gate is the only check on it; <Terrain coasterPts> ` +
      `gets no footings for it, so its ground is not pre-capped.`, 'advisory');
    return { ok: false, points: [] as V3[] };
  }
  const rating: any = attempt('rateCoaster', [
    () => (rateCoaster as any)(out.points, { type: 'steel', bank: 0.7, cars: 3 }),
    () => (rateCoaster as any)(THREE, out.points, { type: 'steel', bank: 0.7, cars: 3 }),
  ], (v) => v && typeof v.maxLatG === 'number') ?? {};
  const design: any = attempt('checkCoasterDesign', [
    () => (checkCoasterDesign as any)(out.points, { type: 'steel' }),
    () => (checkCoasterDesign as any)(THREE, out.points, { type: 'steel' }),
  ], (v) => !!v) ?? {};
  const violations: any[] = design?.violations ?? [];
  const latOk = typeof rating.maxLatG !== 'number' || rating.maxLatG <= LAT_GUARD;
  const ok = !out.report?.fatal && latOk && !violations.length;
  console.log(`[park] ${label}:`, {
    E: rating.excitement, I: rating.intensity, N: rating.nausea, maxLatG: rating.maxLatG,
    inversions: rating.inversions, synthesized: out.report?.synthesizedCount, points: out.points.length, ok,
  });
  parkAssert(`coaster:${label}`, ok,
    `${label} failed verification — ${out.report?.fatal ?? violations.map((v: any) => v.kind).join(', ') ?? `maxLatG ${rating.maxLatG}`}`,
    'blocking');
  return { ok, points: out.points as V3[] };
}
const FLAG = verify('§4.0-C Corkscrew Ascent', C_PIECES, C_START);
const FLAG2 = verify('§4.0-B Prairie Runner', B_PIECES, B_START);
const ALL_COASTER_PTS: V3[] = [...FLAG.points, ...FLAG2.points];

/* ── the UNGUARDED composition: every placement decision is measured against it ── */
function compose(opts: any, label: string): any {
  return attempt(`parkComposition(${label})`, [
    () => (parkComposition as any)(THREE, SEED, SIZE, CLIMATE, opts),
    () => (parkComposition as any)(SEED, SIZE, CLIMATE, opts),
    () => (parkComposition as any)({ three: THREE, seed: SEED, size: SIZE, climate: CLIMATE, ...opts }),
  ], (v) => !!v && (Array.isArray(v.peaks) || Array.isArray(v.basins) || !!v.report)) ?? {};
}
const COMP0: any = compose(ALL_COASTER_PTS.length ? { coasterPts: ALL_COASTER_PTS } : {}, 'probe');
parkAssert('composition', !!COMP0.report || Array.isArray(COMP0.peaks),
  'parkComposition answered nothing usable — pads are placed WITHOUT a flank/water probe, so the terrain ' +
  'gate is the first thing that will see a wet or bulged pad. The ring pose search degrades to bump 0.');

const bumpIn = (comp: any, c: XZ) =>
  Math.max(0, ...(comp.peaks ?? []).map((p: any) => {
    const k = Math.max(0, 1 - Math.hypot(c[0] - p.x, c[1] - p.z) / p.radius);
    return k * k * (3 - 2 * k) * p.height;
  }));
const bumpMax = (c: XZ, half = 0.6) => Math.max(
  bumpIn(COMP0, c),
  bumpIn(COMP0, [c[0] - half, c[1] - half]), bumpIn(COMP0, [c[0] + half, c[1] - half]),
  bumpIn(COMP0, [c[0] - half, c[1] + half]), bumpIn(COMP0, [c[0] + half, c[1] + half]),
);
const isDry = (c: XZ) => [...(COMP0.basins ?? []), ...(COMP0.clampBasins ?? [])]
  .every((b: any) => Math.hypot(c[0] - b.x, c[1] - b.z) > 0.74 * b.radius + 0.6);

/* ── the pinned seed row (PRE-guard boxes) + the guard sieve ─────────────────── */
const SEED_ROW = {
  dom: { ctr: [41, -39] as XZ, box: [21, 60, -60, -21] as [number, number, number, number] },
  sec: { ctr: [-38, 31] as XZ, box: [-56, -21, 23, 39] as [number, number, number, number] },
};
const inBox = (c: XZ, b: typeof SEED_ROW.dom) =>
  c[0] >= b.box[0] && c[0] <= b.box[1] && c[1] >= b.box[2] && c[1] <= b.box[3];
const offRow = (c: XZ, nearR = 12) => [SEED_ROW.dom, SEED_ROW.sec]
  .every((b) => !inBox(c, b) && Math.hypot(c[0] - b.ctr[0], c[1] - b.ctr[1]) >= nearR);

/* ── §0-P.4 the monorail ring: pose SEARCHED, never assumed ──────────────────── */
type Ring = { pos: V3; decks: XZ[]; tails: XZ[]; anchors: XZ[]; exits: XZ[]; cells: XZ[] };
const ringAt = (dx: number, dz: number): Ring => {
  const decks: XZ[] = [[-42.6 + dx, -8.4 + dz], [0 + dx, 34.2 + dz], [42.6 + dx, -8.4 + dz], [0 + dx, -51.0 + dz]];
  const tails: XZ[] = [[-36.0 + dx, -8.4 + dz], [0 + dx, 27.6 + dz], [36.0 + dx, -8.4 + dz], [0 + dx, -57.6 + dz]];
  const anchors: XZ[] = [[-40.81 + dx, -8.4 + dz], [0 + dx, 32.41 + dz], [40.81 + dx, -8.4 + dz], [0 + dx, -52.79 + dz]];
  const exits: XZ[] = [[-1.2 + dx, 33.03 + dz], [41.43 + dx, -7.2 + dz], [1.2 + dx, -52.17 + dz]];
  return { pos: [-42.6 + dx, 0, -9.7 + dz], decks, tails, anchors, exits, cells: [...decks, ...tails, ...anchors, ...exits] };
};
const poseScore = (r: Ring) => Math.max(...r.decks.map((d) => bumpMax(d, 0.9)));
const poseWet = (r: Ring) => r.cells.filter((c) => !isDry(c) || !offRow(c)).length;
const DZ_CANDS = [0, -1.2, -2.4, -3.6, -4.8, 1.2, 2.4];
const DX_CANDS = [0, -1.2, 1.2, -2.4, 2.4, -3.6, 3.6];
let RDX = 0, RDZ = 0, bestBump = Infinity, bestWet = 99, found = false;
for (const dz of DZ_CANDS) {
  for (const dx of DX_CANDS) {
    const r = ringAt(dx, dz);
    const bump = poseScore(r), wet = poseWet(r);
    if (!found && (wet < bestWet || (wet === bestWet && bump < bestBump))) { RDX = dx; RDZ = dz; bestBump = bump; bestWet = wet; }
    if (bump <= PEAK_LIMIT && wet === 0) { RDX = dx; RDZ = dz; bestBump = bump; bestWet = wet; found = true; break; }
  }
  if (found) break;
}
const RING = ringAt(RDX, RDZ);
console.log(`[park] monorail ring pose: dx ${RDX} dz ${RDZ} · worst deck bump ${bestBump.toFixed(2)} (limit ${PEAK_LIMIT}) · wet/off-row cells ${bestWet}`,
  RING.decks.map((d) => `[${d}] ${bumpMax(d, 0.9).toFixed(2)}`));
const RING_OK = parkAssert('ringPose', found,
  `no monorail ring pose in dz[−4.8…2.4] × dx[−3.6…3.6] clears the flank limit AND the waterline — ` +
  `best was dx ${RDX} dz ${RDZ} at bump ${bestBump.toFixed(2)} with ${bestWet} wet cell(s). SHIPPING ` +
  `WITHOUT THE RING would cost the transport category, so the best pose is mounted and the residual ` +
  `terrain charge is accepted; the numbers above are the receipt.`, 'advisory');

/* ── the AUTHORED street table (every ring-adjacent cell derived from the pose) ── */
const NODES: XZ[] = [
  [0, 63.6],                            // 0  GATE cell
  [0, 58.8],                            // 1
  [0, 54.0],                            // 2  Carousel tail
  [9.6, 45.6],                          // 3  hub:E junction
  [22.8, 45.6],                         // 4  Bassline tail
  [30.0, 45.6],                         // 5
  [36.0, 45.6],                         // 6
  [45.6, 45.6],                         // 7  Discotron tail
  [22.8, 27.6 + RDZ],                   // 8  spine junction
  [9.6, 27.6 + RDZ],                    // 9
  [RDX, 27.6 + RDZ],                    // 10 N monorail tail — LEAF
  [22.8, 12.0],                         // 11 FerrisWheel tail
  [22.8, 0],                            // 12
  [22.8, -3.6],                         // 13 §4.0-C tail
  [22.8, -8.4 + RDZ],                   // 14
  [36.0 + RDX, -8.4 + RDZ],             // 15 E monorail tail — LEAF
  [22.8, -21.6],                        // 16
  [9.6, -21.6],                         // 17
  [-2.4, -21.6],                        // 18 TwistRide tail
  [-12.0, -21.6],                       // 19 Teacups tail
  [-18.0, -21.6],                       // 20 emberRow port neighbour
  [-24.0, -21.6],                       // 21
  [-36.0 + RDX, -21.6],                 // 22
  [-46.8, -21.6],                       // 23
  [-52.8, -21.6],                       // 24
  [-52.8, -16.8],                       // 25 BoilerBurst tail
  [-52.8, -9.6],                        // 26 worksRow port neighbour
  [-52.8, -4.8],                        // 27 AetherBalloons tail — LEAF
  [-36.0 + RDX, -14.4 + RDZ],           // 28
  [-36.0 + RDX, -8.4 + RDZ],            // 29 W monorail tail — LEAF
  [-24.0, -4.8],                        // 30 GhostTrain tail
  [-24.0, 12.0],                        // 31 LogFlume tail
  [-12.0, 12.0],                        // 32
  [-12.0, 33.6],                        // 33
  [-12.0, 45.6],                        // 34 hub:W junction
  [-24.0, -48.0],                       // 35
  [-27.6, -48.0],                       // 36 §4.0-B tail — LEAF
  [-24.0, -57.6 + RDZ],                 // 37
  [RDX, -57.6 + RDZ],                   // 38 S monorail tail — LEAF
];
const EDGES: [number | string, number | string][] = [
  [0, 1], [1, 2], [2, 'hub:N'],
  ['hub:E', 3], [3, 4], [4, 5], [5, 6], [6, 7], [7, 'pulseRow:W'],
  [4, 8], [8, 9], [9, 10],
  [8, 11], [11, 12], [12, 13], [13, 14], [14, 15], [14, 16],
  [16, 17], [17, 18], [18, 19], [19, 20], [20, 'emberRow:E'], [20, 21],
  [21, 22], [22, 23], [23, 24], [24, 25], [25, 26], [26, 'worksRow:E'], [26, 27],
  [22, 28], [28, 29],
  [21, 30], [30, 31], [31, 32], [32, 33], [33, 34], [34, 'hub:W'],
  [21, 35], [35, 36], [35, 37], [37, 38],
];

/* ── the set-pieces (PLAN first, mount second) ──────────────────────────────── */
const HUB: any = fountainPlazaPlan({
  id: 'hub', title: 'Junction Fountain', position: [0, 45.6], tiles: 7,
  ports: ['N', 'E', 'W'], stringLights: 'all', seed: 1,
} as any);
const WORKS_ROW: any = bazaarPlan({
  id: 'worksRow', title: 'Brasswork Arcade', position: [-58.8, -9.6],
  facing: { port: 'E', toward: [-52.8, -9.6] },
  stalls: ['goggles', 'hotDog', 'soda'],
  names: ['Bellows & Brass Goggles', 'Piston Dogs', 'Condenser Sodas'],
  theme: (WORLD_THEMES as any).steampunk, seed: 9,
} as any);
const EMBER_ROW: any = bazaarPlan({
  id: 'emberRow', title: 'Cinder Market', position: [-18.0, -28.8],
  facing: { port: 'E', toward: [-18.0, -21.6] },
  stalls: ['emberRoast', 'burger', 'cottonCandy'],
  names: ['Caldera Roast', 'Basalt Burgers', 'Ashfloss'],
  theme: (WORLD_THEMES as any).fire, seed: 5,
} as any);
const PULSE_ROW: any = bazaarPlan({
  id: 'pulseRow', title: 'Pulse Row', position: [52.8, 45.6],
  facing: { port: 'W', toward: [45.6, 45.6] },
  stalls: ['neonSlush', 'soda', 'balloon'],
  names: ['Subwoofer Slush', 'Strobe Sodas', 'Glowline Balloons'],
  theme: (WORLD_THEMES as any).neon, seed: 7,
} as any);
const ALL_PLANS: any[] = [HUB, WORKS_ROW, EMBER_ROW, PULSE_ROW];

/* ── the ONE fuse. No `worlds:` — the pads are derived from THIS net. ────────── */
const RIDE_GUARD_CELLS: XZ[] = [...RING.tails, ...RING.anchors, ...RING.decks];
const NET: any = buildParkNet({
  nodes: NODES as any, edges: EDGES as any, pieces: ALL_PLANS, keepDry: RIDE_GUARD_CELLS as any,
} as any);
(NET.warnings ?? []).forEach((w: any) =>
  parkAssert('netWarnings', false, `buildParkNet lint: ${typeof w === 'string' ? w : JSON.stringify(w)}`, 'advisory'));

/* ── cardinality of every authored edge (ADVISORY — buildParkNet elbows a diagonal) ── */
const portCell = (ref: number | string): XZ => {
  if (typeof ref === 'number') return NODES[ref];
  const [id, name] = ref.split(':');
  const p = ALL_PLANS.find((q) => q.id === id);
  return p ? (p.port(name) as XZ) : [0, 0];
};
const EPS = 1e-6;
EDGES.forEach(([a, b]) => {
  const A = portCell(a), B = portCell(b);
  parkAssert('cardinalEdge', Math.abs(A[0] - B[0]) < EPS || Math.abs(A[1] - B[1]) < EPS,
    `edge ${a}→${b} is DIAGONAL: [${A}] → [${B}] — buildParkNet elbows it through a corner node nobody planned.`,
    'advisory');
});

/* ── nodes vs the set-pieces' SOLID footprints ──────────────────────────────── */
const SOLID_CLEAR: Record<string, number> = { FountainPlaza: 1.8, Bazaar: 0.6, Boulevard: 0 };
function assertNodesOffPieces(cells: XZ[], plans: any[], label: string): void {
  const hits: string[] = [];
  plans.forEach((p) => {
    const clear = SOLID_CLEAR[p.kind] ?? 1.8;
    if (!clear) return;
    const ports = new Set((p.ports ?? []).map((pt: any) => `${pt.at[0].toFixed(2)},${pt.at[1].toFixed(2)}`));
    const f = p.footprint;
    const c = Math.cos(-(f.yaw ?? 0)), s = Math.sin(-(f.yaw ?? 0));
    cells.forEach((n, i) => {
      if (ports.has(`${n[0].toFixed(2)},${n[1].toFixed(2)}`)) return;
      const dx = n[0] - f.cx, dz = n[1] - f.cz;
      const lx = dx * c - dz * s, lz = dx * s + dz * c;
      const gap = Math.max(Math.abs(lx) - f.hx, Math.abs(lz) - f.hz);
      if (gap < clear - 1e-9) hits.push(`[${n[0]}, ${n[1]}] (${label} ${i}) is ${gap.toFixed(2)} u from '${p.id}' — needs ${clear}`);
    });
  });
  parkAssert('nodeInSolid', !hits.length, `${hits.length} cell(s) stand against a set-piece footprint:\n  ${hits.join('\n  ')}`);
}
assertNodesOffPieces(NODES, ALL_PLANS, 'node');

/* ── §0-P.5 pad placement: the TAIL is authored, the PAD is derived ─────────── */
const PAD_MARGIN: Record<string, number> = {
  Bassline: 11.59, LogFlume: 5.36, GhostTrain: 4.77, Monorail: 4.02, Discotron: 3.07,
  FerrisWheel: 2.97, AetherBalloons: 2.95, BoilerBurst: 3.05, TwistRide: 2.65, Teacups: 2.47,
  Carousel: 2.40,
};
const padMarginOf = (rig: string) => PAD_MARGIN[rig] ?? 3.2;
// a rig whose BODY spans more than ~10 u cannot be `margin` u from every street while its own
// queue reaches one; the padOnStreet audit collapses to the 0.45 boarding pad there, so the
// SEARCH clearance is capped and the table value is kept for the body-vs-street planning above.
const searchClearOf = (rig: string) => Math.min(padMarginOf(rig), 4.8);
const minReachOf = (c: number) => laneLenOf(c) + 0.35 + 0.62 + 0.5 + 0.45;

function assertPadFlat(pad: XZ, clear: number, half: number, label: string): XZ {
  if (bumpMax(pad, half) <= PEAK_LIMIT && isDry(pad)) return pad;
  for (let r = 1; r <= 8; r += 1)
    for (let ix = -r; ix <= r; ix += 1)
      for (let iz = -r; iz <= r; iz += 1) {
        if (Math.max(Math.abs(ix), Math.abs(iz)) !== r) continue;
        const c: XZ = [+(pad[0] + ix * 0.6).toFixed(2), +(pad[1] + iz * 0.6).toFixed(2)];
        if (bumpMax(c, half) > PEAK_LIMIT || !isDry(c)) continue;
        const off = offPathCell(NET, c as any, { clear } as any) as XZ | null;
        if (off && Math.hypot(off[0] - c[0], off[1] - c[1]) < 1e-6) {
          console.warn(`[park] ${label}: pad [${pad}] on a flank/wet cell (bump ${bumpMax(pad, half).toFixed(2)}) — moved to [${c}]`);
          return c;
        }
      }
  parkAssert('padOnFlank', false,
    `${label}: pad [${pad}] is on a hill flank (bump ${bumpMax(pad, half).toFixed(2)} > ${PEAK_LIMIT}) or WET and no ` +
    `cell within 4.8 u is flat, dry and ${clear} u off the street — MOVE THE TAIL.`);
  return pad;
}

type Placed3 = { pad: XZ; anchor: XZ; dir: XZ; yaw: number; tail: XZ };
function place(tail: XZ, out: XZ, capacity: number, rig: string, half = 1.2, reachOverride?: number): Placed3 {
  const clear = searchClearOf(rig);
  const join = laneLenOf(capacity) + 0.35;
  const reach = reachOverride ?? (minReachOf(capacity) + 2.4);
  const cand: XZ = [+(tail[0] + out[0] * reach).toFixed(2), +(tail[1] + out[1] * reach).toFixed(2)];
  const onStreet = (offPathCell(NET, cand as any, { clear } as any) ?? cand) as XZ;
  const pad = assertPadFlat(onStreet, clear, half, rig);
  const got = Math.hypot(pad[0] - tail[0], pad[1] - tail[1]);
  parkAssert('padReach', got >= minReachOf(capacity) + 1.2,
    `${rig} pad [${pad}] sits ${got.toFixed(2)} u from its tail [${tail}] — the cap-${capacity} floor is ` +
    `${(minReachOf(capacity) + 1.2).toFixed(2)} u. Open the court or move the tail outward.`);
  return {
    pad, tail,
    anchor: [+(tail[0] + out[0] * join).toFixed(2), +(tail[1] + out[1] * join).toFixed(2)],
    dir: [-out[0], -out[1]],
    yaw: Math.atan2(-out[0], -out[1]),
  };
}

const CAROUSEL = place([0, 54.0], [1, 0], 6, 'Carousel', 1.8);
const FERRIS = place([22.8, 12.0], [1, 0], 6, 'FerrisWheel', 2.37);
const FLUME = place([-24.0, 12.0], [-1, 0], 6, 'LogFlume', 4.76);
const GHOST = place([-24.0, -4.8], [-1, 0], 4, 'GhostTrain', 4.17);
const TEACUPS = place([-12.0, -21.6], [0, -1], 4, 'Teacups', 1.87);
const TWIST = place([-2.4, -21.6], [0, -1], 4, 'TwistRide', 2.65);
const AETHER = place([-52.8, -4.8], [0, 1], 6, 'AetherBalloons', 2.35);
const BOILER = place([-52.8, -16.8], [-1, 0], 4, 'BoilerBurst', 2.45);
const BASSLINE = place([22.8, 45.6], [0, 1], 6, 'Bassline', 1.2);
const DISCO = place([45.6, 45.6], [0, 1], 6, 'Discotron', 2.5);
const PADS: XZ[] = [CAROUSEL, FERRIS, FLUME, GHOST, TEACUPS, TWIST, AETHER, BOILER, BASSLINE, DISCO].map((p) => p.pad);
assertNodesOffPieces(PADS, ALL_PLANS, 'pad');

/* pairwise pad pitch — a floor, re-measured against the live rects in onReady */
const PAD_HALF: [XZ, number, string][] = [
  [CAROUSEL.pad, 1.8, 'Carousel'], [FERRIS.pad, 2.37, 'FerrisWheel'], [FLUME.pad, 4.76, 'LogFlume'],
  [GHOST.pad, 4.17, 'GhostTrain'], [TEACUPS.pad, 1.87, 'Teacups'], [TWIST.pad, 2.65, 'TwistRide'],
  [AETHER.pad, 2.35, 'AetherBalloons'], [BOILER.pad, 2.45, 'BoilerBurst'], [DISCO.pad, 2.5, 'Discotron'],
];
PAD_HALF.forEach(([a, ha, na], i) => PAD_HALF.slice(i + 1).forEach(([b, hb, nb]) => {
  const gap = Math.max(Math.abs(a[0] - b[0]) - (ha + hb), Math.abs(a[1] - b[1]) - (ha + hb));
  parkAssert('rideSpacing', gap >= 1.5, `${na} vs ${nb}: OBB edge gap ${gap.toFixed(2)} < 1.5 (−2 on ride spacing)`);
}));

/* ── the WORLDS, declared AFTER the pads exist ──────────────────────────────── */
const WORKS_PROPS: XZ[] = [
  [-46.8, -4.8], [-46.8, -13.2], [-46.8, -18.0], [-58.8, -4.8], [-61.2, -1.2],
  [-49.2, -25.2], [-56.4, -25.2], [-61.2, -25.2], [-46.8, 2.4], [-52.8, -28.8],
];
const EMBER_PROPS: XZ[] = [
  [-28.8, -27.6], [-28.8, -34.8], [-21.6, -33.6], [-16.8, -37.2], [-9.6, -34.8],
  [-3.6, -36.0], [2.4, -33.6], [7.2, -38.4], [-12.0, -40.8], [-8.4, -24.0],
];
const PULSE_PROPS: XZ[] = [
  [16.8, 40.8], [21.6, 37.2], [26.4, 40.8], [31.2, 37.2], [36.0, 40.8],
  [40.8, 37.2], [45.6, 40.8], [14.4, 36.0], [36.0, 49.2], [39.6, 56.4],
];
const propCell = (c: XZ, clear = 1.2): XZ => (offPathCell(NET, c as any, { clear } as any) ?? c) as XZ;
const WORKS_AT = WORKS_PROPS.map((c) => propCell(c));
const EMBER_AT = EMBER_PROPS.map((c) => propCell(c));
const PULSE_AT = PULSE_PROPS.map((c) => propCell(c));

const WORKS_WORLD: any = worldPlan({
  id: 'brassworkYard', theme: (WORLD_THEMES as any).steampunk, pieces: [WORKS_ROW],
  include: [AETHER.pad, BOILER.pad, RING.decks[0], ...WORKS_AT] as any,
} as any);
const EMBER_WORLD: any = worldPlan({
  id: 'calderaFlats', theme: (WORLD_THEMES as any).fire, pieces: [EMBER_ROW],
  include: [TEACUPS.pad, TWIST.pad, RING.decks[3], ...EMBER_AT] as any,
} as any);
const PULSE_WORLD: any = worldPlan({
  id: 'pulseQuarter', theme: (WORLD_THEMES as any).neon, pieces: [PULSE_ROW],
  include: [BASSLINE.pad, DISCO.pad, ...PULSE_AT] as any,
} as any);
const WORLDS = [WORKS_WORLD, EMBER_WORLD, PULSE_WORLD];
const centreOf = (w: any): XZ => (w.centre ?? [w.region?.cx ?? 0, w.region?.cz ?? 0]) as XZ;
WORLDS.forEach((a, i) => WORLDS.slice(i + 1).forEach((b) => {
  const A = centreOf(a), B = centreOf(b), d = Math.hypot(A[0] - B[0], A[1] - B[1]);
  parkAssert('worldPitch', d >= 32.66, `worlds '${a.id}' ↔ '${b.id}' centres are ${d.toFixed(1)} u apart — the floor is 32.66`);
}));

/* ── §0-P.6 the guard list is DERIVED, and the composition is re-diffed ─────── */
function keepDryOf(net: any): XZ[] {
  const all: XZ[] = (net.keepDry ?? []) as XZ[];
  const kept = all.filter((c) => offRow(c));
  if (kept.length !== all.length)
    console.warn(`[park] keepDryOf dropped ${all.length - kept.length} of ${all.length} guard cell(s) standing on the ` +
      `pinned row's water — a dropped guard is NOT a fixed cell; whatever stands there is still in the lake.`);
  return kept;
}
const GUARDS = keepDryOf(NET);
const COMP: any = compose(
  ALL_COASTER_PTS.length ? { keepDry: GUARDS, coasterPts: ALL_COASTER_PTS } : { keepDry: GUARDS }, 'guarded');
const moved = (a: any, b: any) => (a && b ? Math.hypot(a[0] - b[0], a[1] - b[1]) : 0);
parkAssert('waterMoved',
  moved(COMP.waterCentre, COMP0.waterCentre) < 1 && moved(COMP.waterCentreSecond, COMP0.waterCentreSecond) < 1,
  `guards moved a water body off the pinned row — dominant ${JSON.stringify(COMP0.waterCentre)} → ` +
  `${JSON.stringify(COMP.waterCentre)}, secondary ${JSON.stringify(COMP0.waterCentreSecond)} → ` +
  `${JSON.stringify(COMP.waterCentreSecond)}, terrainSeed ${COMP0.terrainSeed} → ${COMP.terrainSeed}`);
const rf: any = COMP.report?.reliefFloor;
parkAssert('terrainFlattened', !rf || rf.kept >= rf.floor,
  rf ? `keepDry FLATTENED the seed: relief ${rf.authoredRelief?.toFixed(2)} → ${rf.relief?.toFixed(2)} ` +
    `(kept ${rf.kept?.toFixed(2)} against the ${rf.floor} floor), stdH ${rf.authoredStdH?.toFixed(2)} → ` +
    `${rf.stdH?.toFixed(2)}; ranges guarded: ${rf.guardedRanges}` : '');
console.log('[park] composition:', {
  guards: GUARDS.length, probes: COMP.report?.probesTried, terrainSeed: COMP.terrainSeed,
  waterBodies: COMP.report?.waterBodies, waterAreaU2: COMP.report?.waterAreaU2,
  reliefKept: rf?.kept, stdH: rf?.stdH,
});

/* ── the dressing: trees, generic scenery, night lighting ───────────────────── */
const TREE_SHAPES = ['round', 'pine', 'willow', 'round', 'pine'] as const;
type TreeShape = (typeof TREE_SHAPES)[number];
const RAW_TREES: XZ[] = [
  [-38.4, 50.4], [-34.8, 56.4], [-31.2, 44.4], [-27.6, 52.8], [-24.0, 58.8], [-20.4, 48.0],
  [-16.8, 55.2], [-33.6, 60.0], [-28.8, 40.8], [-36.0, 46.8], [-22.8, 42.0], [-18.0, 60.0],
  [7.2, 60.0], [12.0, 57.6], [13.2, 62.4],
  [-38.4, 4.8], [-38.4, 18.0], [-34.8, 26.4], [-30.0, 21.6], [-26.4, 4.8], [-38.4, -10.8],
  [-27.6, -14.4], [-33.6, -19.2], [-30.0, 30.0],
  [28.8, -14.4], [33.6, -8.4], [38.4, -2.4], [27.6, 4.8], [36.0, 6.0], [39.6, -15.6],
  [24.0, -16.8], [31.2, -19.2],
  [-28.8, -45.6], [-21.6, -44.4], [-15.6, -46.8], [-9.6, -44.4], [-3.6, -46.8], [2.4, -44.4],
  [7.2, -46.8], [-31.2, -24.0], [14.4, -24.0],
  [-8.4, 38.4], [6.0, 38.4], [8.4, 42.0],
];
const TREES: { at: XZ; shape: TreeShape }[] = RAW_TREES.map((c, i) => ({
  at: propCell(c, 0.75), shape: TREE_SHAPES[i % TREE_SHAPES.length],
}));
const GENERIC: { at: XZ; name: string }[] = [
  { at: propCell([-3.6, 58.8]), name: 'marbleStatue' },
  { at: propCell([3.6, 54.0]), name: 'planterBox' },
  { at: propCell([-6.0, 50.4]), name: 'topiarySpiral' },
  { at: propCell([6.0, 50.4]), name: 'signpost' },
  { at: propCell([-8.4, 42.0]), name: 'parkClock' },
  { at: propCell([9.6, 58.8]), name: 'flagpole' },
  { at: propCell([-9.6, 57.6]), name: 'wishingWell' },
  { at: propCell([16.8, 42.0]), name: 'picnicTable' },
];
parkAssert('dressFloors', TREES.length >= 32 && GENERIC.length + 30 >= 16,
  `dressing under the floor: ${TREES.length} trees (≥ 32) and ${GENERIC.length + 30} scenery placements (≥ 16)`);

parkAssertFlush();

/* ── the GATE'S OWN dryness predicate, run IN THE TREE ──────────────────────── */
function dryRing(park: any, c: XZ, r = 0.75): boolean {
  const g = park?.ground;
  if (!g?.lint?.isDry) return true;
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
      console.error(`[park] DryScatter(${label}) dropped ${cells.length - kept.length} of ${cells.length} cell(s) under ` +
        `waterline + 0.05: ${JSON.stringify(cells.filter((c) => kept.indexOf(c) < 0).map((c) => c.at))}`);
    setDry(kept);
  }, [park, cells, label]);
  return <>{(dry ?? []).map(render)}</>;
}

/* ── the monorail ring: pieces VERBATIM from the published block ────────────── */
const MONO_PIECES: Piece[] = [
  'station',
  { type: 'straight', length: 35.3 }, { type: 'turnL', angle: 90, radius: 6 }, { type: 'straight', length: 35.3 },
  'station',
  { type: 'straight', length: 35.3 }, { type: 'turnL', angle: 90, radius: 6 }, { type: 'straight', length: 35.3 },
  'station',
  { type: 'straight', length: 35.3 }, { type: 'turnL', angle: 90, radius: 6 }, { type: 'straight', length: 35.3 },
  'station',
  { type: 'straight', length: 35.3 }, { type: 'turnL', angle: 90, radius: 6 },
  { type: 'straight', length: 33.5 }, { type: 'straight', length: 1.5 },
];

const BRASS_PROPS = [GiantGear, SteamPipes, ClockTower, BoilerTank, CoalCart,
  GiantGear, SteamPipes, CoalCart, BoilerTank, SteamPipes];
const PULSE_PIECES_C = [NeonArch, SpeakerStack, MirrorBallPylon, LaserTruss, LightTiles,
  SpeakerStack, LightTiles, SpeakerStack, MirrorBallPylon, LaserTruss];
const EMBER_PIECES_C = [BasaltColumns, CharredSnag, Fumarole, LavaFissure, ObsidianShards,
  Fumarole, CharredSnag, BasaltColumns, LavaFissure, ObsidianShards];
const ROT = [0.0, 2.0, 0.9, 0.4, -1.2, 0.7, -0.5, 1.3, -0.8, 0.2];
const SEEDS = [2, 4, 3, 5, 11, 7, 17, 9, 23, 31];

export function App() {
  return (
    <Park
      seed={SEED}
      climate={CLIMATE as any}
      guests={50}
      roster={{ rides: 13, stalls: 9, categories: 5 } as any}
      onReady={(report: any) => {
        console.log('[park] validatePark:', {
          ok: report?.ok, failures: report?.failures?.length ?? 0, warnings: report?.warnings?.length ?? 0,
        });
        (report?.failures ?? []).forEach((f: any) => console.error('[park] FAIL', f));
        (report?.warnings ?? []).forEach((w: any) => console.warn('[park] WARN', w));
        const rects: any[] = report?.footprints ?? [];
        rects.forEach((a, i) => rects.slice(i + 1).forEach((b) => {
          if (a.rideId && a.rideId === b.rideId) return;
          const gap = Math.max(Math.abs(a.cx - b.cx) - (a.hx + b.hx), Math.abs(a.cz - b.cz) - (a.hz + b.hz));
          if (gap < 1.5)
            console.error(`[park] SPACING ${a.label} vs ${b.label}: gap ${gap.toFixed(2)} < 1.5`);
        }));
      }}
    >
      <Terrain keepDry={GUARDS as any} coasterPts={ALL_COASTER_PTS as any} />

      <ThemeRegion theme="steampunk" position={[-52.8, -12.0]} extent={[11.0, 18.0]} />
      <ThemeRegion theme="fire" position={[-8.4, -33.6]} extent={[22.0, 12.0]} />
      <ThemeRegion theme="neon" position={[33.6, 45.6]} extent={[22.0, 12.0]} />

      <Paths nodes={NET.nodes} edges={NET.edges} plazas={NET.plazas} bins={NET.bins} walkers={6} />
      <GameManager />
      <Gate />

      {/* ── the two coasters ─────────────────────────────────────────────── */}
      <Coaster
        name="Corkscrew Ascent" pieces={C_PIECES as any} start={C_START as any} heading={0}
        type="steel" cars={3} capacity={4} rideDuration={10} loadTime={2} intensity={9} price={7}
        queueTailNode={NET.node(C_TAIL)} queueDir={[1, 0] as any}
      />
      <Coaster
        name="Prairie Runner" pieces={B_PIECES as any} start={B_START as any} heading={0}
        type="steel" cars={3} capacity={4} rideDuration={11} loadTime={2} intensity={7} price={5}
        queueTailNode={NET.node(B_TAIL)} queueDir={[1, 0] as any}
      />

      {/* ── the park-spanning transport ring, 4 platforms ─────────────────── */}
      <Monorail
        position={RING.pos as any} rotation={0} pieces={MONO_PIECES as any} beamY={2.6} trains={4} pinned
        name="Grand Circle Monorail" capacity={6} rideDuration={12} intensity={1} price={0}
        queue={{ anchor: RING.anchors[0] as any, dir: [1, 0] as any }}
        register={{
          name: 'Grand Circle Monorail', capacity: 6, rideDuration: 12, intensity: 1, price: 0,
          board: [RING.decks[0][0], 2.6, RING.decks[0][1]],
          stations: [
            {
              label: 'North', boardPoint: [RING.decks[1][0], 2.6, RING.decks[1][1]],
              queueAnchor: [RING.anchors[1][0], 0.05, RING.anchors[1][1]], queueDir: [0, -1],
              exitPoint: [RING.exits[0][0], 0.05, RING.exits[0][1]], exitDir: [0, -1],
            },
            {
              label: 'East', boardPoint: [RING.decks[2][0], 2.6, RING.decks[2][1]],
              queueAnchor: [RING.anchors[2][0], 0.05, RING.anchors[2][1]], queueDir: [-1, 0],
              exitPoint: [RING.exits[1][0], 0.05, RING.exits[1][1]], exitDir: [-1, 0],
            },
            {
              label: 'South', boardPoint: [RING.decks[3][0], 2.6, RING.decks[3][1]],
              queueAnchor: [RING.anchors[3][0], 0.05, RING.anchors[3][1]], queueDir: [0, -1],
              exitPoint: [RING.exits[2][0], 0.05, RING.exits[2][1]], exitDir: [0, -1],
            },
          ],
        } as any}
      />

      {/* ── the entrance plaza rides ──────────────────────────────────────── */}
      <Carousel
        position={CAROUSEL.pad as any} rotation={CAROUSEL.yaw}
        register={{ name: 'Gilded Carousel', capacity: 6, rideDuration: 10, intensity: 2, price: 3 } as any}
        queue={{ anchor: CAROUSEL.anchor as any, dir: CAROUSEL.dir as any }}
      />
      <FerrisWheel
        position={FERRIS.pad as any} rotation={FERRIS.yaw}
        register={{ name: 'Junction Skywheel', capacity: 6, rideDuration: 11, intensity: 2, price: 4 } as any}
        queue={{ anchor: FERRIS.anchor as any, dir: FERRIS.dir as any }}
      />
      <LogFlume
        position={FLUME.pad as any} rotation={FLUME.yaw}
        register={{ name: 'Cascade Falls', capacity: 6, rideDuration: 12, intensity: 5, price: 5 } as any}
        queue={{ anchor: FLUME.anchor as any, dir: FLUME.dir as any }}
      />
      <GhostTrain
        position={GHOST.pad as any} rotation={GHOST.yaw}
        register={{ name: 'Hollow Manor', capacity: 4, rideDuration: 12, intensity: 4, price: 5 } as any}
        queue={{ anchor: GHOST.anchor as any, dir: GHOST.dir as any }}
      />

      {/* ── CALDERA FLATS (fire) ──────────────────────────────────────────── */}
      <World plan={EMBER_WORLD} />
      <Bazaar plan={EMBER_ROW} />
      <Teacups
        position={TEACUPS.pad as any} rotation={TEACUPS.yaw}
        register={{ name: 'Cinder Teacups', capacity: 4, rideDuration: 10, intensity: 3, price: 3 } as any}
        queue={{ anchor: TEACUPS.anchor as any, dir: TEACUPS.dir as any }}
      />
      <TwistRide
        position={TWIST.pad as any} rotation={TWIST.yaw}
        register={{ name: 'Ashfall Twister', capacity: 4, rideDuration: 10, intensity: 6, price: 4 } as any}
        queue={{ anchor: TWIST.anchor as any, dir: TWIST.dir as any }}
      />

      {/* ── BRASSWORK YARD (steampunk) ────────────────────────────────────── */}
      <World plan={WORKS_WORLD} />
      <Bazaar plan={WORKS_ROW} />
      <AetherBalloons
        position={AETHER.pad as any} rotation={AETHER.yaw}
        register={{ name: 'Aether Ascent', capacity: 6, rideDuration: 11, intensity: 2, price: 4 } as any}
        queue={{ anchor: AETHER.anchor as any, dir: AETHER.dir as any }}
      />
      <BoilerBurst
        position={BOILER.pad as any} rotation={BOILER.yaw}
        register={{ name: 'Boiler Burst', capacity: 4, rideDuration: 10, intensity: 7, price: 5 } as any}
        queue={{ anchor: BOILER.anchor as any, dir: BOILER.dir as any }}
      />

      {/* ── PULSE QUARTER (neon) ──────────────────────────────────────────── */}
      <World plan={PULSE_WORLD} />
      <Bazaar plan={PULSE_ROW} />
      <Bassline
        position={BASSLINE.pad as any} rotation={BASSLINE.yaw}
        register={{ name: 'Bassline Rush', capacity: 6, rideDuration: 11.5, intensity: 5, price: 5 } as any}
        queue={{ anchor: BASSLINE.anchor as any, dir: BASSLINE.dir as any }}
      />
      <Discotron
        position={DISCO.pad as any} rotation={DISCO.yaw}
        register={{ name: 'Discotron 5000', capacity: 6, rideDuration: 10, intensity: 6, price: 4 } as any}
        queue={{ anchor: DISCO.anchor as any, dir: DISCO.dir as any }}
      />

      {/* ── the hub, the amenities, the night ─────────────────────────────── */}
      <FountainPlaza plan={HUB} />
      <Restroom position={[4.8, 58.8] as any} rotation={-Math.PI / 2} />
      <Torch position={[-3.6, 62.4] as any} />
      <Torch position={[3.6, 62.4] as any} />
      <Lights from={[-1.8, 57.6] as any} to={[1.8, 57.6] as any} />
      <Lights from={[26.4, 44.4] as any} to={[30.0, 44.4] as any} />
      <Neon text="PULSE" position={[24.0, 1.7, 43.2] as any} rotation={Math.PI} scale={0.6} />

      {/* ── themed scenery, 10 placements per world, every one sieved ─────── */}
      {WORKS_AT.map((at, i) => {
        const P: any = BRASS_PROPS[i];
        return <P key={`bw-${i}`} position={at as any} rotation={ROT[i]} seed={SEEDS[i]} />;
      })}
      {EMBER_AT.map((at, i) => {
        const P: any = EMBER_PIECES_C[i];
        return <P key={`ef-${i}`} position={at as any} rotation={ROT[i]} seed={SEEDS[i]} />;
      })}
      {PULSE_AT.map((at, i) => {
        const P: any = PULSE_PIECES_C[i];
        return <P key={`pd-${i}`} position={at as any} rotation={ROT[i]} seed={SEEDS[i]} />;
      })}

      <DryScatter
        cells={GENERIC} label="scenery"
        render={(s, i) => <Scenery key={`sc-${i}`} name={s.name as any} position={s.at as any} seed={i + 1} />}
      />
      <DryScatter
        cells={TREES} label="trees"
        render={(t, i) => (
          <Placed key={`tr-${i}`} position={t.at as any} build={(three: any) => tree(three, { shape: t.shape } as any)} />
        )}
      />
    </Park>
  );
}

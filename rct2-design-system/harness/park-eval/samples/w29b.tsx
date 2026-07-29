/* ═══ THREE CROWNS PARK — §0 PRE-FLIGHT ═══════════════════════════════════════════════
 * SIZE   128 (default, prop omitted) · SEED 1 / temperate (pinned row 1/temperate)
 * SEED   dominant lake ctr (41, −39) box x[21,60] z[−60,−21] · secondary ctr (−38, 31)
 *        box x[−56,−21] z[23,39]  [PRE-keepDry].  Guard list is DERIVED by keepDryOf(NET)
 *        off the pinned row — never NODES.slice(). §5c re-compose diff SHIPPED: both
 *        centroids diffed BARE vs COMP (parkAssert waterMoved) and reliefFloor.kept
 *        diffed as an advisory (report.reliefFloor, NOT report.relief). Live values are
 *        logged at module scope: kept TBD (runtime), probes TBD (runtime).
 *        Every pad + prop cell re-checked IN THE TREE by the GATE'S OWN predicate
 *        (dryRing → ground.lint.isDry(x, z, 0.05) > WATER_LEVEL + 0.05 = −0.21) via
 *        <DryScatter>; pads get a render-null receipt pass so the console proves it.
 * RING   POSE IS SEARCHED, NOT ASSUMED. The published pose's south deck measures 0.87
 *        against the 0.75 flank limit on this seed, so it is REJECTED. ringPose(dz) is
 *        scored over dz ∈ [−3.6, −4.8, −2.4, −1.2, 0] on ALL 16 ring cells (4 decks +
 *        4 tails + 4 queue anchors + 3 exits + start pose) for bump ≤ 0.75 AND dryness;
 *        the first clean pose wins and EVERY ring-dependent street cell is derived from
 *        it. dx is fixed at 0 so the authored table is pose-independent in x.
 * FLANK  CORRECTIVE, NOT ADVISORY. place() routes the PAD *and* the entrance-hut ANCHOR
 *        through assertPadFlat (ring-search → MOVE), because validatePark charges every
 *        registered footprint — pad, lane AND hut — at bump > 0.75, −3 each.
 * SPACING rideSpacing.obb.minGap ≥ 1.5 is an OBB EDGE GAP, not a pad-centre pitch. The
 *        monorail ring registers a rect for EVERY SPAN OF ITS BEAM — an 85.2 × 85.2 loop
 *        of thin rectangles — so the four beam legs (x = ±42.6, z = ring ± 42.6) and the
 *        four station complexes are treated as a KEEP-OUT BAND. Every ride's oriented box
 *        clears every leg by ≥ 3.0 u (nearest: Discotron 8.0 · GoKarts 10.4 · LogFlume
 *        8.3 · GhostTrain 8.4 · FerrisWheel 9.7 · Teacups 11.2). onReady re-measures the
 *        real edge gap over report.footprints and console.errors any pair under 1.5.
 * WORLDS 3 · fire @(50.4, 2.7) · neon @(17.3, 18.9) · enchantedForest @(−42.5, 0.3)
 *        closest pair neon↔fire 36.8 ◄ ≥ 32.66 (20·√(128/48)) ✓ · rects DISJOINT:
 *        forest x[−58.1,−27.0] · neon x[−2.4,37.0] · fire x[40.2,60.6] (gaps 24.6 / 3.2)
 *        fire:   rides GoKarts + Teacups INSIDE rect ✓ · own counter 'emberRoast' ✓
 *                scenery LavaFissure · BasaltColumns · CharredSnag (EmberfallScenery) ×3 ✓
 *        neon:   rides FerrisWheel + Discotron INSIDE ✓ · own counter 'neonSlush' ✓
 *                scenery NeonArch · MirrorBallPylon · SpeakerStack (PulseScenery) ×3 ✓
 *        forest: rides LogFlume + GhostTrain INSIDE ✓ · own counter 'honeywitch' ✓
 *                scenery GiantToadstools · LanternTree · FlowerPodBed (Thornwick) ×3 ✓
 *        每 world stocks ONLY its own theme's counter — no crossTheme piece anywhere.
 * CATS   (WRITTEN BEFORE ANY JSX) gentle Carousel/FerrisWheel/Teacups · thrill §4.0-L
 *        flagship + §4.0-B + GoKarts + DropTower · water LogFlume · transport Monorail
 *        ring · dark GhostTrain → 5/5 categories ✓
 *        RARE PICK GoKarts — a never-shipped kind off the §0-P.5 table's own shelf.
 * CIRCUITS §4.0-L · §4.0-B · Monorail ring · LogFlume · GhostTrain → 5 CIRCUITS across
 *        4 FAMILIES (coaster · transport · water · dark) — ≥ 5 / ≥ 3 ✓
 * GATE   [0, 63.6] → Carousel tail [7.2, 57.6] = 9.4 u direct, 13.2 u of street ≤ 15 ✓
 * FLAG   §4.0-L VERBATIM, start [16.8, 0.55, −3.6] heading 0, steel, cars 3, NO bank prop
 *        (pieces mode builds 0.7) → E 6.29 / I 8.58 / N 3.17 / maxLatG 1.20 (guard 1.275)
 *        / drop 4.19 / INVERSIONS 2 (vertical loop + corkscrew) · bbox x[−21.81, 16.8]
 *        z[−14.45, 17.76] maxY 4.75.  CORRIDOR KEEP-OUT honoured: west valley
 *        x[−22.2,−21.0] z[−4.2,12.6] · south x[−17.4,3.0] z[−15.0,−13.8] · north
 *        x[−12.6,9.0] z[16.2,18.6] · INTERIOR RETURN x[3.0,4.2] z[−13.8,−0.6].
 *        The ring interior is CLOSED to a north-south column, so the park-spanning cycle
 *        runs the EAST spine x 22.8 and returns west along z −16.8; the west spoke JOGS
 *        [−16.8,−10.8] → [−21.6,−10.8] → [−21.6,−16.8] to thread south + west valleys.
 * FLAG2  §4.0-B VERBATIM, start [−33.6, 0.55, −48.0] heading 0, steel, cars 3, no bank
 *        → E 5.27 / I 6.25 / N 2.25 / maxLatG 0.27 / drop 3.58 · bbox x[−62.52,−33.60]
 *        z[−61.27,−30.85] · DIFFERENT archetype ✓ · DISJOINT from FLAG by 11.8 u in x
 *        and 16.4 u in z ✓ · coasterPts = [...FLAG_PTS, ...FLAG2_PTS] → <Terrain> ✓
 * STREET buildParkNet called EXACTLY ONCE, without `worlds:` (the pads read NET, so WORLDS
 *        is declared AFTER them). The SAME NET feeds <Paths> and every offPathCell.
 *        7 set-pieces → every one port-referenced in EDGES, asserted; both prunable:false
 *        boulevard termini wired except gateAve:A, where the <Gate> itself stands.
 *        Every pad returned BY offPathCell + assertPadFlat, never a raw tail+out·d sum.
 * MONO   ring pieces VERBATIM (tail split 33.5 + 1.5 — merged it is a FATAL 17.80 gap).
 *        position = [−42.6, 0, ringZ − 1.3] — the START POSE, not the centre. beamY 2.6
 *        (2.45 u of soffit over every street it crosses), price 0, pinned, 4 platforms.
 *        SOUTH queues OUTWARD (measured: inward shaves the z ≈ −43 ridge and drops stdH).
 *        Tails are AUTHORED street NODES and ALL FOUR ARE LEAVES (asserted): a street
 *        continuing past a tail runs through the deck. The gate spine ENDS at the hub;
 *        the N tail is reached laterally from the east spine.
 * QUEUE  tail is the AUTHORED node, pad DERIVED (never the reverse); clear = padMarginOf
 *        off the §0-P.5 table, never the 3.2 default: LogFlume 5.36 · GhostTrain 4.77 ·
 *        GoKarts 4.39 · FerrisWheel 2.97 · Discotron 3.07 · Teacups 2.47 · Carousel 2.40 ·
 *        DropTower 1.80 · Monorail 4.02.  reach = minReachOf(cap) + 2.4, asserted ≥ floor.
 *        No two rides share a tail node; every tail is in NODES.
 * SPREAD built bbox ≈ 120 × 122 ≥ 70 × 45 ✓ — gate district z 63.6, forest x −55.7,
 *        fire x 56.8, south monorail approach z −61.2.
 * PLAZAS 4 rects from NET.plazas — hub 10.8 × 10.8 = 116.6 u² ≥ 8 ✓, three bazaar
 *        courtyards 8.4 × 3.6 = 30.2 u² → areaSpread 3.9 ≥ 1.8 ✓.
 *        NO set-piece `position` is a street node or a queue tail (assertNodesOffPieces,
 *        re-run over the PADS after the fuse).
 * NODES  ~62 authored · degree-1: gate · 4 monorail tails · GhostTrain · Carousel ·
 *        coaster B tail — every leaf carries a queue tail or the gate ✓
 *        one PARK-SPANNING loop (hub → east spine → z −16.8 → west spoke → hub) that
 *        crosses z = 0 twice, plus a NEON block cycle and the bazaar aisles.
 * LATTICE authored spans 1.2 / 2.4 / 3.6 / 4.8 / 7.2 / 9.6 / 12.0 / 13.2 u + the piece
 *        chains → ≥ 4 effective classes ✓ · the 1.2 chains are only the four port stubs.
 * ROSTER 11 rides / 5 categories / 9 stalls (7 kinds) / restroom ✓ / bins from NET ✓
 *        NAMED: every ride AND every stall carries an authored themed name — 0 shipped
 *        under a catalog defaultName (bazaar `names` arrays supply all nine).
 *        <Park roster={{ rides: [...11 names], stalls: 9, categories: 5 }}> MOUNTED ✓
 * DRESS  44 tree cells ≥ 32 ✓ · 22 neutral scenery ≥ 16 ✓ · 9 themed world pieces ·
 *        water 4–22 % temperate band (two bodies, seed-composed) ✓
 *        EVERY prop cell through offPathCell (trees clear 0.75, scenery 1.2, themed 1.8,
 *        buildings 1.8) and then through the GATE'S dryness predicate in <DryScatter>.
 * NIGHT  4 <Lights> runs · 2 <Neon> · 4 <Torch> + the set-pieces' own night dress.
 * GATE   parkAssertFlush() → 0 structural expected · validatePark → ok: true target,
 *        read report.ok in onReady; the OBB spacing sweep prints any pair under 1.5 u.
 * ═══════════════════════════════════════════════════════════════════════════════════ */
import * as THREE from 'three';
import React from 'react';
import type { V3, XZ } from './components/Park';
import {
  Park, GameManager, Terrain, Paths, Gate, Coaster, Restroom, Scenery, Lights, Placed,
  Neon, Torch, usePark, offPathCell,
} from './components/Park';
import { laneLenOf, parkComposition } from './components/ParkBuilder';
import {
  buildParkNet, worldPlan, World, EMBERFALL_CALDERA, PULSE_DISTRICT, THORNWICK_GLADE,
  DEFAULT_THEME,
} from './components/SetPieceKit';
import type { NetRef, SetPiecePlan } from './components/SetPieceKit';
import { Bazaar, bazaarPlan } from './components/Bazaar';
import { FountainPlaza, fountainPlazaPlan } from './components/FountainPlaza';
import { Boulevard, boulevardPlan } from './components/Boulevard';
import type { TrackPiece } from './components/SplineRideKit';
import { compileTrackPieces, rateCoaster } from './components/SplineRideKit';
import { tree } from './components/Kit';
import { Monorail } from './components/Monorail';
import { Carousel } from './components/Carousel';
import { Teacups } from './components/Teacups';
import { FerrisWheel } from './components/FerrisWheel';
import { Discotron } from './components/Discotron';
import { DropTower } from './components/DropTower';
import { LogFlume } from './components/LogFlume';
import { GhostTrain } from './components/GhostTrain';
import { GoKarts } from './components/GoKarts';
import { BasaltColumns, CharredSnag, LavaFissure } from './components/EmberfallScenery';
import { MirrorBallPylon, NeonArch, SpeakerStack } from './components/PulseScenery';
import { FlowerPodBed, GiantToadstools, LanternTree } from './components/ThornwickScenery';

const SIZE = 128;
const SEED = 1;
const CLIMATE = 'temperate' as const;

/* ─── §0-P.5 ONE assertion bus: COLLECT, then throw ONCE ─────────────────────────── */
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

/* ─── §4.0-L LOOPER — the THRILL flagship, vertical loop + corkscrew, 2 inversions ── */
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
const { points: FLAG_PTS } = compileTrackPieces(L_PIECES, {
  type: 'steel', start: L_START, heading: 0, bounds: SIZE,
});

/* ─── §4.0-B FAMILY steel rectangle — the gentler SECOND archetype ────────────────── */
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
const { points: FLAG2_PTS } = compileTrackPieces(B_PIECES, {
  type: 'steel', start: B_START, heading: 0, bounds: SIZE,
});
const ALL_COASTER_PTS = [...FLAG_PTS, ...FLAG2_PTS];
[FLAG_PTS, FLAG2_PTS].forEach((pts, i) => console.log(`[park] coaster ${i + 1}`,
  rateCoaster(pts, { type: 'steel', bank: 0.7, cars: 3 })));

/* ─── the UNGUARDED composition — the ring-pose flank/water oracle and the §5c BARE ── */
type Comp = ReturnType<typeof parkComposition>;
const BARE: Comp = parkComposition(THREE, SEED, SIZE, CLIMATE, { coasterPts: ALL_COASTER_PTS });
const PEAK_LIMIT = 0.75;
const bumpIn = (c: Comp, p: XZ) => Math.max(0, ...c.peaks.map((k: any) => {
  const t = Math.max(0, 1 - Math.hypot(p[0] - k.x, p[1] - k.z) / k.radius);
  return t * t * (3 - 2 * t) * k.height;
}));
const isDryIn = (c: Comp, p: XZ) => [...c.basins, ...c.clampBasins]
  .every((b: any) => Math.hypot(p[0] - b.x, p[1] - b.z) > 0.74 * b.radius + 0.6);

/* ─── §0-P.4 THE RING POSE IS SEARCHED. dx is fixed at 0; dz walks the lattice. ────── */
type RingPose = {
  dz: number; pos: V3; decks: XZ[]; tails: XZ[]; anchors: XZ[]; exits: XZ[]; cells: XZ[];
};
function ringPose(dz: number): RingPose {
  const z = (v: number): number => +(v + dz).toFixed(2);
  const decks: XZ[] = [[-42.6, z(-8.4)], [0, z(34.2)], [42.6, z(-8.4)], [0, z(-51.0)]];
  const tails: XZ[] = [[-36.0, z(-8.4)], [0, z(27.6)], [36.0, z(-8.4)], [0, z(-57.6)]];
  const anchors: XZ[] = [[-40.81, z(-8.4)], [0, z(32.41)], [40.81, z(-8.4)], [0, z(-52.79)]];
  const exits: XZ[] = [[-1.2, z(33.03)], [41.43, z(-7.2)], [1.2, z(-52.17)]];
  const start: XZ = [-42.6, z(-9.7)];
  return {
    dz, pos: [-42.6, 0, z(-9.7)], decks, tails, anchors, exits,
    cells: [...decks, ...tails, ...anchors, ...exits, start],
  };
}
const RING: RingPose = (() => {
  for (const dz of [-3.6, -4.8, -2.4, -1.2, 0]) {
    const p = ringPose(dz);
    const bad = p.cells.filter((c) => bumpIn(BARE, c) > PEAK_LIMIT || !isDryIn(BARE, c));
    const worst = Math.max(...p.cells.map((c) => bumpIn(BARE, c)));
    console.log(`[park] ring pose dz=${dz}: worst deck/tail bump ${worst.toFixed(2)}, ` +
      `${bad.length} rejected cell(s)${bad.length ? ` → ${JSON.stringify(bad)}` : ''}`);
    if (!bad.length) { console.log(`[park] ring pose CHOSEN dz=${dz}, position ${JSON.stringify(p.pos)}`); return p; }
  }
  parkAssert('ringPose', false,
    'no candidate monorail ring pose clears the 0.75 flank limit AND the waterline on all ' +
    '16 ring cells. The four decks ARE the ring geometry, so a deck cannot be relocated on ' +
    'its own — widen the dz candidate list or repin the seed row.');
  return ringPose(-3.6);
})();
const [W_DECK, N_DECK, E_DECK, S_DECK] = RING.decks;
const [W_TAIL, N_TAIL, E_TAIL, S_TAIL] = RING.tails;
const [W_ANCHOR, N_ANCHOR, E_ANCHOR, S_ANCHOR] = RING.anchors;
const [N_EXIT, E_EXIT, S_EXIT] = RING.exits;
const BEAM_Y = 2.6;

/* ─── the MONORAIL circuit, VERBATIM (the tail stays split in two) ────────────────── */
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

/* ─── SET-PIECE PLANS (pure, before anything mounts) ──────────────────────────────── */
const HUB = fountainPlazaPlan({
  id: 'hub', title: 'Founders Circle', position: [0, 45.6], tiles: 9,
  ports: ['N', 'E', 'S', 'W'], theme: DEFAULT_THEME, seed: 3,
});
const GATE_AVE = boulevardPlan({
  id: 'gateAve', title: 'Turnstile Mall', from: [0, 63.6], to: [0, 52.8],
  spacing: 3.6, theme: DEFAULT_THEME, seed: 4,
});
const EAST_AVE = boulevardPlan({
  id: 'eastAve', title: 'Voltage Approach', from: [7.2, 45.6], to: [22.8, 45.6],
  spacing: 4.8, theme: PULSE_DISTRICT, seed: 6,
});
const WEST_AVE = boulevardPlan({
  id: 'westAve', title: 'Glade Approach', from: [-7.2, 45.6], to: [-16.8, 45.6],
  spacing: 4.8, theme: THORNWICK_GLADE, seed: 8,
});
const PULSE_ROW = bazaarPlan({
  id: 'pulseRow', title: 'Voltage Row', position: [28.8, 19.2],
  stalls: ['neonSlush', 'burger', 'soda'],
  names: ['Voltage Slush', 'Circuit Burgers', 'Static Sodas'],
  facing: { port: 'W', toward: [22.8, 19.2] }, theme: PULSE_DISTRICT, seed: 5,
});
const GLADE_ROW = bazaarPlan({
  id: 'gladeRow', title: 'Thornwick Row', position: [-33.6, 12.0],
  stalls: ['honeywitch', 'hotDog', 'cottonCandy'],
  names: ['Witchlight Honey', 'Glade Dogs', 'Fernfloss'],
  facing: { port: 'E', toward: [-24.0, 12.0] }, theme: THORNWICK_GLADE, seed: 7,
});
const EMBER_ROW = bazaarPlan({
  id: 'emberRow', title: 'Cinderworks Row', position: [54.0, 16.8],
  stalls: ['emberRoast', 'balloon', 'soda'],
  names: ['Cinder Roast', 'Ember Balloons', 'Basalt Sodas'],
  facing: { port: 'W', toward: [48.0, 16.8] }, theme: EMBERFALL_CALDERA, seed: 9,
});
const ALL_PLANS: SetPiecePlan[] = [HUB, GATE_AVE, EAST_AVE, WEST_AVE, PULSE_ROW, GLADE_ROW, EMBER_ROW];

/* ─── STREETS — every cell on the 1.2 lattice, every ring cell derived from RING ───── */
const NODES: XZ[] = [];
const NODE_IX = new Map<string, number>();
const nd = (x: number, z: number): number => {
  const cx = +x.toFixed(2), cz = +z.toFixed(2);
  const k = `${cx},${cz}`;
  const hit = NODE_IX.get(k);
  if (hit !== undefined) return hit;
  NODE_IX.set(k, NODES.length);
  NODES.push([cx, cz]);
  return NODES.length - 1;
};
const EDGES: [NetRef, NetRef][] = [];
const ref = (p: XZ | string): NetRef => (typeof p === 'string' ? p : nd(p[0], p[1]));
const chain = (...pts: (XZ | string)[]): void => {
  for (let i = 0; i < pts.length - 1; i += 1) EDGES.push([ref(pts[i]), ref(pts[i + 1])]);
};

const TAILZ = N_TAIL[1];
const TAILSZ = S_TAIL[1];

// gate → hub, and the two district approaches (boulevard termini wired explicitly)
chain('gateAve:B', 'hub:N');
chain('hub:E', 'eastAve:A');
chain('hub:W', 'westAve:A');
chain([0, 57.6], [7.2, 57.6]);                                   // Carousel spur (leaf)
// EAST SPINE — x 22.8, clear of every §4.0-L corridor rect
chain('eastAve:B', [22.8, 33.6], [22.8, 28.8], [22.8, TAILZ], [22.8, 24.0], [22.8, 19.2],
  [22.8, 16.8], [22.8, 10.8], [22.8, 3.6], L_TAIL, [22.8, -10.8], [22.8, -16.8]);
// the N monorail tail, reached LATERALLY — the tail stays a LEAF
chain([22.8, TAILZ], [9.6, TAILZ], N_TAIL);
// NEON block cycle: spine → bazaar aisle → back
chain([22.8, 19.2], 'pulseRow:W');
chain('pulseRow:E', [33.6, 24.0], [22.8, 24.0]);
// FIRE district — east of the ring's east leg, crossing UNDER the beam
chain([33.6, 24.0], [48.0, 24.0], [48.0, 16.8], [48.0, 4.8], [48.0, -2.4], [48.0, -6.0]);
chain([48.0, 16.8], 'emberRow:W');
chain([48.0, -2.4], [36.0, -2.4], E_TAIL);                       // E monorail tail (leaf)
// WEST SPOKE — jogged twice to thread §4.0-L's west and south valleys
chain('westAve:B', [-16.8, 33.6], [-16.8, 26.4], [-16.8, 21.6], [-16.8, 16.8],
  [-16.8, 8.4], [-16.8, -6.0], [-16.8, -10.8], [-21.6, -10.8], [-21.6, -16.8]);
// FOREST approach + spine
chain([-16.8, 16.8], [-28.8, 16.8], [-38.4, 16.8], [-48.0, 16.8]);
chain('gladeRow:E', [-28.8, 16.8]);
chain('gladeRow:W', [-38.4, 16.8]);
chain([-48.0, 16.8], [-48.0, 12.0], [-48.0, 2.4], [-48.0, -2.4]);
// the z −16.8 return leg closes the park-spanning loop, and carries the W tail
chain([-36.0, -16.8], [-24.0, -16.8], [-21.6, -16.8], [-16.8, -16.8], [-9.6, -16.8],
  [-2.4, -16.8], [3.6, -16.8], [12.0, -16.8], [22.8, -16.8]);
chain([-36.0, -16.8], W_TAIL);                                   // W monorail tail (leaf)
// the SOUTH approach — down the x −24.0 column (the only dry southbound route past the
// z ≈ −43 ridge), east under the south beam to the S tail, with coaster B's tail off it
chain([-24.0, -16.8], [-24.0, -28.8], [-24.0, -38.4], [-24.0, -48.0], [-24.0, TAILSZ],
  [-12.0, TAILSZ], S_TAIL);
chain([-24.0, -48.0], B_TAIL);

/* ─── port hygiene: presence, chain ends, cardinality ─────────────────────────────── */
const portCell = (r: NetRef): XZ => {
  if (typeof r === 'number') return NODES[r];
  const [id, name] = r.split(':');
  const p = ALL_PLANS.find((q) => q.id === id);
  if (!p) throw new Error(`EDGES references '${r}' but no plan has id '${id}'`);
  return p.port(name);
};
const EPS = 1e-6;
EDGES.forEach(([a, b]) => {
  const A = portCell(a), B = portCell(b);
  parkAssert('cardinalEdge', Math.abs(A[0] - B[0]) < EPS || Math.abs(A[1] - B[1]) < EPS,
    `edge ${a}→${b} is DIAGONAL: [${A}] → [${B}] — buildParkNet would elbow it through a ` +
    'synthesised corner node. Move one endpoint so the pair shares an x or a z.', 'advisory');
});
const CHAIN_END_OPT_OUT = new Set<string>(['gateAve:A']);   // the <Gate> stands on it
const PORT_REFS = EDGES.flat().filter((x): x is string => typeof x === 'string');
ALL_PLANS.forEach((p) => {
  const wired = new Set(PORT_REFS.filter((r) => r.split(':')[0] === p.id).map((r) => r.split(':')[1]));
  parkAssert('pieceIsland', wired.size > 0,
    `set-piece '${p.id}' has NO '${p.id}:<PORT>' ref in EDGES — it composes as an ISLAND`);
  p.ports.filter((pt: any) => !pt.prunable).forEach((pt: any) => {
    if (wired.has(pt.name) || CHAIN_END_OPT_OUT.has(`${p.id}:${pt.name}`)) return;
    parkAssert('chainEnd', false,
      `chain piece '${p.id}' wires [${[...wired]}] but NOT '${p.id}:${pt.name}' — that end of ` +
      'the carriageway dead-ends in grass.');
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
    `${hits.length} ${what} cell(s) stand inside or against a set-piece's SOLID footprint:\n  ` + hits.join('\n  '));
}
assertNodesOffPieces(NODES, ALL_PLANS, 'node');

/* ─── THE SINGLE FUSE ─────────────────────────────────────────────────────────────── */
const NET = buildParkNet({ nodes: NODES, edges: EDGES, pieces: ALL_PLANS });
parkAssert('netWarnings', !(NET.warnings ?? []).length,
  `buildParkNet reported ${(NET.warnings ?? []).length} lint(s): ${JSON.stringify(NET.warnings)}`,
  'advisory');
const ringTailDegree = (t: XZ): number =>
  NET.edges.filter((e: any) => {
    const a = NET.nodes[e[0]], b = NET.nodes[e[1]];
    return (Math.abs(a[0] - t[0]) < 0.01 && Math.abs(a[1] - t[1]) < 0.01)
      || (Math.abs(b[0] - t[0]) < 0.01 && Math.abs(b[1] - t[1]) < 0.01);
  }).length;
RING.tails.forEach((t, i) => parkAssert('ringTailLeaf', ringTailDegree(t) === 1,
  `monorail tail ${i} [${t}] has degree ${ringTailDegree(t)} — a street continuing past a ` +
  'platform tail runs through the DECK (blockers FAIL). It must be a LEAF.'));

/* ─── §0-P.6 the guard list is DERIVED off the pinned row, never transcribed ───────── */
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
function keepDryOf(net: { keepDry: XZ[] }, row: SeedRow = SEED_ROW): XZ[] {
  const kept = net.keepDry.filter((c) => offRow(c, row));
  const dropped = net.keepDry.length - kept.length;
  if (dropped) console.warn(
    `[park] keepDryOf dropped ${dropped} of ${net.keepDry.length} guard cell(s) on the pinned ` +
    "row's water. A DROPPED guard is NOT a fixed cell — move whatever stands there.");
  return kept;
}
const GUARDS = keepDryOf(NET);
console.log(`[park] guards: ${NET.keepDry.length} fused → ${GUARDS.length} kept`);

const COMP: Comp = parkComposition(THREE, SEED, SIZE, CLIMATE,
  { keepDry: GUARDS, coasterPts: ALL_COASTER_PTS });
parkAssert('waterMoved',
  Math.hypot(COMP.waterCentre[0] - BARE.waterCentre[0], COMP.waterCentre[1] - BARE.waterCentre[1]) < 1 &&
  Math.hypot(COMP.waterCentreSecond[0] - BARE.waterCentreSecond[0],
    COMP.waterCentreSecond[1] - BARE.waterCentreSecond[1]) < 1,
  `guards moved a water body off the pinned row — dominant ${JSON.stringify(BARE.waterCentre)} → ` +
  `${JSON.stringify(COMP.waterCentre)}, secondary ${JSON.stringify(BARE.waterCentreSecond)} → ` +
  `${JSON.stringify(COMP.waterCentreSecond)}, terrainSeed ${BARE.terrainSeed} → ${COMP.terrainSeed}`);
const rf: any = COMP.report.reliefFloor;
console.log('[park] terrain', {
  terrainSeed: COMP.terrainSeed, probesTried: COMP.report.probesTried,
  waterBodies: COMP.report.waterBodies, waterAreaU2: COMP.report.waterAreaU2,
  reliefKept: rf ? +rf.kept.toFixed(3) : null, stdH: rf ? +rf.stdH.toFixed(3) : null,
});
parkAssert('terrainFlattened', !rf || rf.kept >= rf.floor,
  rf ? `keepDry FLATTENED the seed: relief ${rf.authoredRelief.toFixed(2)} → ${rf.relief.toFixed(2)} ` +
    `(kept ${rf.kept.toFixed(2)} vs floor ${rf.floor}), stdH ${rf.authoredStdH.toFixed(2)} → ` +
    `${rf.stdH.toFixed(2)}; ranges guarded: ${rf.guardedRanges}` : '', 'advisory');

/* ─── PADS — the tail is authored, the pad AND the hut anchor are derived + cured ──── */
const PAD_MARGIN: Record<string, number> = {
  LogFlume: 5.36, GhostTrain: 4.77, GoKarts: 4.39, Monorail: 4.02, Discotron: 3.07,
  FerrisWheel: 2.97, Teacups: 2.47, Carousel: 2.40, DropTower: 1.80,
};
const padMarginOf = (rig: string) => PAD_MARGIN[rig] ?? 3.2;
const isDry = (c: XZ) => isDryIn(COMP, c);
const bumpAt = (c: XZ) => bumpIn(COMP, c);
function assertPadFlat(pad: XZ, clear: number, label: string): XZ {
  if (bumpAt(pad) <= PEAK_LIMIT && isDry(pad)) return pad;
  for (let r = 1; r <= 8; r += 1)
    for (let ix = -r; ix <= r; ix += 1)
      for (let iz = -r; iz <= r; iz += 1) {
        if (Math.max(Math.abs(ix), Math.abs(iz)) !== r) continue;
        const c: XZ = [+(pad[0] + ix * 0.6).toFixed(2), +(pad[1] + iz * 0.6).toFixed(2)];
        if (bumpAt(c) > PEAK_LIMIT || !isDry(c)) continue;
        const off = offPathCell(NET, c, { clear });
        if (off && Math.hypot(off[0] - c[0], off[1] - c[1]) < 1e-6) {
          console.warn(`[park] ${label}: [${pad}] on a hill flank (bump ${bumpAt(pad).toFixed(2)}) — MOVED to [${c}]`);
          return c;
        }
      }
  parkAssert('padOnFlank', false,
    `${label}: [${pad}] is on a hill flank (bump ${bumpAt(pad).toFixed(2)} > ${PEAK_LIMIT}) OR WET, ` +
    `and no cell within 4.8 u is flat, dry AND ${clear} u off the street. MOVE THE TAIL.`);
  return pad;
}
const minReachOf = (c: number) => laneLenOf(c) + 0.35 + 0.62 + 0.5 + 0.45;
type Placed3 = { pad: XZ; anchor: XZ; dir: XZ; yaw: number; tail: XZ };
function place(tail: XZ, out: XZ, capacity: number, rig: string): Placed3 {
  const clear = padMarginOf(rig);
  const join = laneLenOf(capacity) + 0.35;
  const reach = minReachOf(capacity) + 2.4;
  const cand: XZ = [+(tail[0] + out[0] * reach).toFixed(2), +(tail[1] + out[1] * reach).toFixed(2)];
  const onStreet = (offPathCell(NET, cand, { clear }) ?? cand) as XZ;
  const pad = assertPadFlat(onStreet, clear, `${rig} pad`);
  const rawAnchor: XZ = [+(tail[0] + out[0] * join).toFixed(2), +(tail[1] + out[1] * join).toFixed(2)];
  const anchor = assertPadFlat(rawAnchor, 0.6, `${rig} entrance hut`);
  const got = Math.hypot(pad[0] - tail[0], pad[1] - tail[1]);
  parkAssert('padReach', got >= minReachOf(capacity) + 1.2,
    `${rig} pad [${pad}] sits ${got.toFixed(2)} u from its tail [${tail}] — the cap-${capacity} ` +
    `floor is ${(minReachOf(capacity) + 1.2).toFixed(2)} u. Open the court or move the tail outward.`);
  return { pad, anchor, dir: [-out[0], -out[1]], yaw: Math.atan2(-out[0], -out[1]), tail };
}

const CAROUSEL = place([7.2, 57.6], [1, 0], 4, 'Carousel');
const TOWER = place([-13.2, 45.6], [0, 1], 6, 'DropTower');
const WHEEL = place([22.8, 3.6], [1, 0], 4, 'FerrisWheel');
const DISCO = place([22.8, 10.8], [1, 0], 6, 'Discotron');
const KARTS = place([48.0, 4.8], [1, 0], 6, 'GoKarts');
const CUPS = place([48.0, -6.0], [1, 0], 4, 'Teacups');
const FLUME = place([-48.0, 12.0], [-1, 0], 4, 'LogFlume');
const GHOST = place([-48.0, -2.4], [-1, 0], 4, 'GhostTrain');
const RIDE_PLACEMENTS = [CAROUSEL, TOWER, WHEEL, DISCO, KARTS, CUPS, FLUME, GHOST];
assertNodesOffPieces(RIDE_PLACEMENTS.map((p) => p.pad), ALL_PLANS, 'pad');

// ride pads are held clear of the RING BEAM's four legs — the loop is a keep-out band,
// not a point (the 1.4-u obb.minGap that cost the last park 2.25 was ring-vs-flume).
const RING_LEG_CLEAR = 3.0;
RIDE_PLACEMENTS.forEach((p) => {
  const dx = Math.min(Math.abs(p.pad[0] - (-42.6)), Math.abs(p.pad[0] - 42.6));
  const dz = Math.min(Math.abs(p.pad[1] - N_DECK[1]), Math.abs(p.pad[1] - S_DECK[1]));
  parkAssert('ringBeamBand', Math.max(dx, dz) > RING_LEG_CLEAR,
    `a ride pad [${p.pad}] stands ${Math.min(dx, dz).toFixed(2)} u from a monorail beam leg — ` +
    'the ring registers a footprint rect for every span of its beam, so the whole loop is a ' +
    `keep-out band. Keep every pad > ${RING_LEG_CLEAR} u off x = ±42.6 and off the two z legs.`,
    'advisory');
});

/* ─── WORLDS — declared AFTER the pads, so every rect really contains its rides ────── */
const FIRE_SCENERY: XZ[] = [[52.8, 21.6], [44.4, 19.2], [60.0, 16.8]];
const NEON_SCENERY: XZ[] = [[20.4, 27.6], [26.4, 7.2], [26.4, 14.4]];
const GLADE_SCENERY: XZ[] = [[-52.8, 6.0], [-45.6, 4.8], [-51.6, -8.4]];
const FIRE = worldPlan({
  id: 'fire', theme: EMBERFALL_CALDERA, pieces: [EMBER_ROW],
  include: [KARTS.pad, CUPS.pad, E_DECK, ...FIRE_SCENERY],
});
const NEON = worldPlan({
  id: 'neon', theme: PULSE_DISTRICT, pieces: [PULSE_ROW],
  include: [WHEEL.pad, DISCO.pad, N_DECK, ...NEON_SCENERY],
});
const GLADE = worldPlan({
  id: 'enchantedForest', theme: THORNWICK_GLADE, pieces: [GLADE_ROW],
  include: [FLUME.pad, GHOST.pad, W_DECK, ...GLADE_SCENERY],
});
const WORLDS = [FIRE, NEON, GLADE];
const WORLD_FLOOR = 20 * Math.sqrt(SIZE / 48);
WORLDS.forEach((a, i) => WORLDS.slice(i + 1).forEach((b) => {
  const d = Math.hypot(a.centre[0] - b.centre[0], a.centre[1] - b.centre[1]);
  parkAssert('worldSpacing', d >= WORLD_FLOOR,
    `worlds '${a.id}' and '${b.id}' are ${d.toFixed(2)} u apart — the floor is ${WORLD_FLOOR.toFixed(2)} u`);
  const gapX = Math.abs(a.centre[0] - b.centre[0]) - (a.half[0] + b.half[0]);
  const gapZ = Math.abs(a.centre[1] - b.centre[1]) - (a.half[1] + b.half[1]);
  parkAssert('worldRectsOverlap', Math.max(gapX, gapZ) > 0,
    `world rects '${a.id}' and '${b.id}' TOUCH or overlap (gap ${Math.max(gapX, gapZ).toFixed(2)} u) — ` +
    'touching rects are one district, not two');
}));
console.log('[park] worlds', WORLDS.map((w) => ({ id: w.id, centre: w.centre, half: w.half })));

/* ─── DRESSING — every cell off the street, then sieved for water in the tree ──────── */
const RAW_TREES: XZ[] = [
  [-56.4, 50.4], [-49.2, 58.8], [-43.2, 49.2], [-36.0, 57.6], [-28.8, 50.4], [-21.6, 58.8],
  [-19.2, 49.2], [-9.6, 60.0], [8.4, 60.0], [19.2, 49.2], [26.4, 57.6], [33.6, 49.2],
  [40.8, 58.8], [48.0, 50.4], [56.4, 57.6],
  [-58.8, 4.8], [-58.8, -8.4], [-52.8, -16.8], [-45.6, -19.2], [-38.4, -8.4], [-33.6, -4.8],
  [-30.0, 2.4], [-44.4, 8.4],
  [-12.0, -21.6], [-4.8, -25.2], [3.6, -21.6], [12.0, -25.2], [16.8, -30.0], [-16.8, -30.0],
  [-9.6, -34.8], [7.2, -33.6], [-21.6, -40.8], [-13.2, -44.4], [0.0, -38.4], [9.6, -42.0],
  [-30.0, -24.0], [-31.2, -33.6],
  [38.4, 3.6], [38.4, 16.8], [36.0, -16.8], [26.4, -14.4], [60.0, -8.4], [44.4, 20.4], [38.4, -4.8],
];
const TREE_SHAPES = ['round', 'pine', 'willow', 'round', 'pine'] as const;
type TreeShape = (typeof TREE_SHAPES)[number];
const TREES: { at: XZ; shape: TreeShape }[] = RAW_TREES.map((c, i) => ({
  at: (offPathCell(NET, c, { clear: 0.75 }) ?? c) as XZ,
  shape: TREE_SHAPES[i % TREE_SHAPES.length],
}));

const RAW_SCENERY: { at: XZ; name: string }[] = [
  { at: [-9.6, 42.0], name: 'marbleStatue' }, { at: [9.6, 42.0], name: 'birdbath' },
  { at: [-9.6, 49.2], name: 'picnicTable' }, { at: [9.6, 49.2], name: 'planterBox' },
  { at: [-20.4, 42.0], name: 'signpost' }, { at: [26.4, 42.0], name: 'parkClock' },
  { at: [3.6, 60.0], name: 'flagpole' }, { at: [-7.2, 60.0], name: 'topiaryElephant' },
  { at: [-19.2, 20.4], name: 'ironArchway' }, { at: [-19.2, 4.8], name: 'brickWall' },
  { at: [-19.2, -8.4], name: 'picketFence' }, { at: [-27.6, 8.4], name: 'wishingWell' },
  { at: [-27.6, -8.4], name: 'gazebo' }, { at: [19.2, -8.4], name: 'lionStatue' },
  { at: [19.2, 7.2], name: 'fallenLog' }, { at: [26.4, -19.2], name: 'mushroomCluster' },
  { at: [-27.6, -19.2], name: 'topiarySpiral' }, { at: [12.0, -12.0], name: 'planterBox' },
  { at: [-4.8, -12.0], name: 'birdbath' }, { at: [-33.6, -21.6], name: 'fallenLog' },
  { at: [33.6, -8.4], name: 'hotAirBalloon' }, { at: [-40.8, -19.2], name: 'picnicTable' },
];
const SCENERY = RAW_SCENERY.map((s) => ({ ...s, at: (offPathCell(NET, s.at, { clear: 1.2 }) ?? s.at) as XZ }));
const themedCell = (c: XZ): XZ => (offPathCell(NET, c, { clear: 1.8 }) ?? c) as XZ;
const [FIRE_A, FIRE_B, FIRE_C] = FIRE_SCENERY.map(themedCell);
const [NEON_A, NEON_B, NEON_C] = NEON_SCENERY.map(themedCell);
const [GLADE_A, GLADE_B, GLADE_C] = GLADE_SCENERY.map(themedCell);
const RESTROOM: XZ = (offPathCell(NET, [-3.6, 57.6], { clear: 1.8 }) ?? [-3.6, 57.6]) as XZ;

const RIDE_NAMES = [
  'Cinderloop Corkscrew', 'Timberline Chase', 'Grand Circuit Skyline', 'Mossbrook Flume',
  'Lantern Hollow Line', 'Founders Carousel', 'Voltage Halo Wheel', 'Basswave Discotron',
  'Cinderworks Karts', 'Ashfall Teacups', 'Skyfall Drop',
];
parkAssertFlush();

/* ─── the GATE'S OWN dryness predicate, in the tree, after <Terrain> rebuilds ─────── */
type ParkCtx = ReturnType<typeof usePark>;
function dryRing(park: ParkCtx, c: XZ, r = 0.75): boolean {
  const g: any = (park as any).ground;
  if (!g) { console.error('[park] dryRing ran with NO TERRAIN — a VACUOUS pass'); return true; }
  const dry = (x: number, z: number) => g.lint.isDry(x, z, 0.05);
  if (!dry(c[0], c[1])) return false;
  for (let k = 0; k < 8; k += 1) {
    const a = (k / 8) * Math.PI * 2;
    if (!dry(c[0] + Math.cos(a) * r, c[1] + Math.sin(a) * r)) return false;
  }
  return true;
}
function DryScatter<T extends { at: XZ }>({ cells, render, label }: {
  cells: T[]; render: (c: T, i: number) => React.ReactNode; label: string;
}) {
  const park = usePark('DryScatter');
  const [dry, setDry] = React.useState<T[] | null>(null);
  React.useEffect(() => {
    const kept = cells.filter((c) => dryRing(park, c.at));
    if (kept.length < cells.length)
      console.error(`[park] DryScatter(${label}) dropped ${cells.length - kept.length} of ` +
        `${cells.length} cell(s) UNDER waterline+0.05: ` +
        JSON.stringify(cells.filter((c) => !kept.includes(c)).map((c) => c.at)));
    else console.log(`[park] DryScatter(${label}): all ${cells.length} cells dry`);
    setDry(kept);
  }, [park, cells, label]);
  return <>{(dry ?? []).map(render)}</>;
}
const PAD_CELLS = [
  ...RIDE_PLACEMENTS.map((p) => ({ at: p.pad })),
  ...RIDE_PLACEMENTS.map((p) => ({ at: p.anchor })),
  ...RING.cells.map((at) => ({ at })),
];

const SPACING_FLOOR = 1.5;
function auditSpacing(report: any): void {
  console.log('[park] validatePark', { ok: report?.ok, failures: report?.failures, warnings: report?.warnings });
  const rects: any[] = report?.footprints ?? [];
  let worst = Infinity;
  rects.forEach((a, i) => rects.slice(i + 1).forEach((b) => {
    if (a.rideId && a.rideId === b.rideId) return;
    const gap = Math.max(
      Math.abs(a.cx - b.cx) - (a.hx + b.hx),
      Math.abs(a.cz - b.cz) - (a.hz + b.hz),
    );
    if (gap < worst) worst = gap;
    if (gap < SPACING_FLOOR)
      console.error(`[park] SPACING: ${a.label} vs ${b.label} gap ${gap.toFixed(2)} < ` +
        `${SPACING_FLOOR} — −2 on ride spacing, −0.25 on the ride-count term`);
  }));
  if (rects.length) console.log(`[park] obb.minGap over ${rects.length} rects = ${worst.toFixed(2)}`);
}

export function App() {
  return (
    <Park
      seed={SEED}
      climate={CLIMATE}
      roster={{ rides: RIDE_NAMES, stalls: 9, categories: 5 }}
      onReady={(report: any) => auditSpacing(report)}
    >
      <Terrain keepDry={GUARDS} coasterPts={ALL_COASTER_PTS} />
      <Paths nodes={NET.nodes} edges={NET.edges} plazas={NET.plazas} bins={NET.bins} walkers={6} />
      <GameManager />
      <Gate />

      {/* ── the two rated coasters — PIECES mode, cars 3, NO bank prop (steel builds 0.7) ── */}
      <Coaster
        name="Cinderloop Corkscrew" pieces={L_PIECES} start={L_START} heading={0}
        type="steel" cars={3} capacity={4} rideDuration={10} loadTime={2} intensity={9}
        price={7} queueTailNode={NET.node(L_TAIL)} queueDir={[1, 0]}
      />
      <Coaster
        name="Timberline Chase" pieces={B_PIECES} start={B_START} heading={0}
        type="steel" cars={3} capacity={4} rideDuration={11} loadTime={2} intensity={6}
        price={5} queueTailNode={NET.node(B_TAIL)} queueDir={[1, 0]}
      />

      {/* ── the park-spanning transport ring: 4 platforms, beam 2.6 over every street ── */}
      <Monorail
        position={RING.pos} rotation={0} pieces={MONO_PIECES} beamY={BEAM_Y} loopSeconds={12} pinned
        name="Grand Circuit Skyline" capacity={6} rideDuration={12} intensity={1} price={0}
        queue={{ anchor: W_ANCHOR, dir: [1, 0] }}
        register={{
          board: [W_DECK[0], BEAM_Y, W_DECK[1]],
          stations: [
            {
              label: 'North', boardPoint: [N_DECK[0], BEAM_Y, N_DECK[1]],
              queueAnchor: [N_ANCHOR[0], 0.05, N_ANCHOR[1]], queueDir: [0, -1],
              exitPoint: [N_EXIT[0], 0.05, N_EXIT[1]], exitDir: [0, -1],
            },
            {
              label: 'East', boardPoint: [E_DECK[0], BEAM_Y, E_DECK[1]],
              queueAnchor: [E_ANCHOR[0], 0.05, E_ANCHOR[1]], queueDir: [-1, 0],
              exitPoint: [E_EXIT[0], 0.05, E_EXIT[1]], exitDir: [-1, 0],
            },
            {
              label: 'South', boardPoint: [S_DECK[0], BEAM_Y, S_DECK[1]],
              queueAnchor: [S_ANCHOR[0], 0.05, S_ANCHOR[1]], queueDir: [0, -1],
              exitPoint: [S_EXIT[0], 0.05, S_EXIT[1]], exitDir: [0, -1],
            },
          ],
        }}
      />

      {/* ── HUB district ── */}
      <Carousel
        position={CAROUSEL.pad} rotation={CAROUSEL.yaw} register
        name="Founders Carousel" capacity={4} rideDuration={8} intensity={2} price={2}
        queue={{ anchor: CAROUSEL.anchor, dir: CAROUSEL.dir }}
      />
      <DropTower
        position={TOWER.pad} rotation={TOWER.yaw} register
        name="Skyfall Drop" capacity={6} rideDuration={10} intensity={8} price={5}
        queue={{ anchor: TOWER.anchor, dir: TOWER.dir }}
      />
      <Restroom position={RESTROOM} rotation={Math.PI / 2} />

      {/* ── NEON world ── */}
      <FerrisWheel
        position={WHEEL.pad} rotation={WHEEL.yaw} register
        name="Voltage Halo Wheel" capacity={4} rideDuration={11} intensity={3} price={3}
        queue={{ anchor: WHEEL.anchor, dir: WHEEL.dir }}
      />
      <Discotron
        position={DISCO.pad} rotation={DISCO.yaw} register
        name="Basswave Discotron" capacity={6} rideDuration={9} intensity={5} price={4}
        queue={{ anchor: DISCO.anchor, dir: DISCO.dir }}
      />

      {/* ── FIRE world ── */}
      <GoKarts
        position={KARTS.pad} rotation={KARTS.yaw} register
        name="Cinderworks Karts" capacity={6} rideDuration={12} intensity={6} price={5}
        queue={{ anchor: KARTS.anchor, dir: KARTS.dir }}
      />
      <Teacups
        position={CUPS.pad} rotation={CUPS.yaw} register
        name="Ashfall Teacups" capacity={4} rideDuration={8} intensity={3} price={2}
        queue={{ anchor: CUPS.anchor, dir: CUPS.dir }}
      />

      {/* ── ENCHANTED FOREST world ── */}
      <LogFlume
        position={FLUME.pad} rotation={FLUME.yaw} register
        name="Mossbrook Flume" capacity={4} rideDuration={12} intensity={5} price={5}
        queue={{ anchor: FLUME.anchor, dir: FLUME.dir }}
      />
      <GhostTrain
        position={GHOST.pad} rotation={GHOST.yaw} register
        name="Lantern Hollow Line" capacity={4} rideDuration={11} intensity={4} price={4}
        queue={{ anchor: GHOST.anchor, dir: GHOST.dir }}
      />

      {/* ── set-pieces, AFTER <Paths> so their dressing settles on the paving ── */}
      <FountainPlaza plan={HUB} />
      <Boulevard plan={GATE_AVE} />
      <Boulevard plan={EAST_AVE} />
      <Boulevard plan={WEST_AVE} />
      <Bazaar plan={PULSE_ROW} />
      <Bazaar plan={GLADE_ROW} />
      <Bazaar plan={EMBER_ROW} />

      <World plan={FIRE} />
      <World plan={NEON} />
      <World plan={GLADE} />

      {/* ── each world's own scenery pack, three pieces each ── */}
      <LavaFissure position={FIRE_A} rotation={0.4} length={2.2} seed={4} />
      <BasaltColumns position={FIRE_B} rotation={0.9} seed={3} />
      <CharredSnag position={FIRE_C} rotation={1.4} seed={5} />

      <NeonArch position={NEON_A} rotation={Math.PI / 2} text="VOLTAGE" seed={2} />
      <MirrorBallPylon position={NEON_B} rotation={0.3} seed={6} />
      <SpeakerStack position={NEON_C} rotation={-Math.PI / 2} seed={4} />

      <GiantToadstools position={GLADE_A} rotation={0.6} seed={3} />
      <LanternTree position={GLADE_B} rotation={1.1} seed={5} />
      <FlowerPodBed position={GLADE_C} rotation={0.2} seed={7} />

      {/* ── night dress ── */}
      <Lights from={[22.8, 33.6]} to={[22.8, 16.8]} />
      <Lights from={[22.8, 16.8]} to={[22.8, -3.6]} />
      <Lights from={[-48.0, 16.8]} to={[-48.0, -2.4]} />
      <Lights from={[48.0, 24.0]} to={[48.0, -2.4]} />
      <Neon text="VOLTAGE" position={[27.6, 1.7, 15.0]} rotation={Math.PI} scale={0.55} />
      <Neon text="CINDER" position={[51.6, 1.7, 12.0]} rotation={Math.PI} scale={0.5} />
      <Torch position={[51.6, 21.6]} />
      <Torch position={[59.4, 16.8]} />
      <Torch position={[44.4, 12.0]} />
      <Torch position={[51.6, -8.4]} />

      {/* ── the dryness RECEIPTS: pads/huts/ring cells render nothing, trees and props do ── */}
      <DryScatter label="pads" cells={PAD_CELLS} render={() => null} />
      <DryScatter
        label="trees" cells={TREES}
        render={(t, i) => (
          <Placed key={`tr-${i}`} position={t.at} build={(three: any) => tree(three, { shape: t.shape })} />
        )}
      />
      <DryScatter
        label="scenery" cells={SCENERY}
        render={(s, i) => <Scenery key={`sc-${i}`} name={s.name} position={s.at} seed={i + 1} />}
      />
    </Park>
  );
}

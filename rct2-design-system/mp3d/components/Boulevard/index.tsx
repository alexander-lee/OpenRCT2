import * as THREE from 'three';
import { tree } from '../Kit';
import { reportPlanLint } from '../ParkBuilder';
import { buildSceneryAnimated } from '../SceneryPack';
import {
  CELL,
  hash01,
  makeSetPiecePlan,
  pickSpecies,
  pickTreeShape,
  plantedRadius,
  rotateXZ,
  setPiece,
  setPieceBench,
  setPieceLamp,
  setPieceRegistry,
  setPieceSpan,
  snapXZ,
  themeOf,
  themedSeed,
} from '../SetPieceKit';
import type { SetPiecePlan, SetPieceProps, WorldTheme, XZ } from '../SetPieceKit';
// the STRUCTURAL half of the theme layer — a sibling module of SetPieceKit
// rather than part of its 81 KB index, which is already at the size where a
// whole-file `write_design_system_files` push is the binding constraint
import { dressOf } from '../SetPieceKit/dress';
import type { ParkContextValue } from '../Park';

// ---------------------------------------------------------------------------
// Boulevard — the MACRO SET-PIECE that makes a big plot read as EXPANSIVE
// instead of huddled: a long straight avenue between TWO ports, dressed at
// regular intervals with lamp posts, trees, benches, planters and optional
// string-light spans across the carriageway.
//
// It is a STREET piece, so its contract differs from a land-owning piece in
// exactly one place: `reserve` defaults to FALSE. A boulevard's whole job is
// to be walked and to be tailed onto — ride queue lanes legitimately end on
// its nodes and side streets legitimately branch off it, and both would
// "overlap" a reserved OBB. `plan.footprint` is still computed (the dressed
// verge strip) so the composing agent can space districts, sweep coaster
// corridors and reason about the avenue as one object; pass `reserve` to opt
// in when the avenue really must be exclusive land.
//
// Geometry (world, axis-aligned — `from`/`to` must share an x or a z):
//
//   port A ·──o──────o──────o──────o──────o──────o──· port B     nodes every 1.2
//          T  L  b   L      L  b   L      L  b   L               L lamp pair
//             ·      ·      ·      ·      ·      ·               (± 1.35 verge)
//          T     tree    tree    tree    tree                    (± 2.4 verge)
//
// Every dressing anchor is ≥ 1.35 from the centreline (clear of the 1.1-wide
// slab and its kerbs), junction cells are skipped, and an `avoid` list keeps
// the verge clear of planned queue lanes / exit huts / ride pads.
// Deterministic (hashed sine only); everything settles on `park.floorAt`.
//
// NON-AXIS-ALIGNED ENDPOINTS DEGRADE, THEY DO NOT THROW (wave-9 P0-A). A
// boulevard whose `from`/`to` share neither an x nor a z used to `throw` — at
// MODULE SCOPE, where a park's plans live, so one bad avenue black-framed the
// entire page (no park, no validatePark line, nothing diagnosable). It now
// synthesizes an L-ROUTE through a corner node (the elbow turns on the LONGER
// leg's row, so the avenue still reads as one dominant run) and records a
// §0-FATAL `boulevardDiagonal` plan lint. The park RENDERS and is refused by
// the acceptance gate with a report — which is the whole point.
// ---------------------------------------------------------------------------

export interface BoulevardPlanInput {
  /** unique piece id — port refs read `'<id>:A'` / `'<id>:B'` */
  id: string;
  title?: string;
  /** both ends, lattice cells sharing an x or a z (typically two pieces'
   *  ports: `from: HUB.port('W'), to: MARKET.port('E')`) */
  from: XZ;
  to: XZ;
  /** lamp-pair spacing in units, rounded to the lattice (default 4.8) */
  spacing?: number;
  lamps?: boolean;
  trees?: boolean;
  benches?: boolean;
  planters?: boolean;
  /** string-light spans across the avenue between opposite lamp hooks — on
   *  every OTHER lamp pair (default true) */
  stringLights?: boolean;
  /** cells that must stay clear of dressing (planned queue lanes, exit huts,
   *  ride pads, other pieces) */
  avoid?: XZ[];
  /** clearance radius around each `avoid` cell (default 1.3) */
  clear?: number;
  /** register the footprint — default FALSE (see the header) */
  reserve?: boolean;
  /** the WORLD this avenue is dressed for — its allée species, verge planters,
   *  lantern character and span bulbs come from it. Default `DEFAULT_THEME` =
   *  today's pine/round/willow allée with iron lamps. */
  theme?: WorldTheme;
  seed?: number;
}

export interface BoulevardPlan extends SetPiecePlan {
  kind: 'Boulevard';
  /** centreline length in units (both legs when this is an L-route) */
  length: number;
  /** unit direction the avenue LEAVES port A along (the first leg's axis) */
  axis: XZ;
  /** the L-route elbow cell, when `from`/`to` were not axis-aligned and the
   *  planner had to synthesize a corner (null on a normal straight avenue).
   *  Its presence means a §0-FATAL `boulevardDiagonal` lint was recorded. */
  corner: XZ | null;
  /** the avenue's legs as WORLD waypoint pairs — one entry for a straight
   *  avenue, two for a degraded L-route */
  legs: [XZ, XZ][];
  lampSpots: { at: XZ; light: boolean }[];
  spans: [XZ, XZ][];
  /** `shape` spans the full `pickTreeShape` range — a themed avenue on a
   *  coastal/desert world really does draw `'palm'` (the type used to omit it,
   *  which was a live `tsc` error the esbuild-only pipeline never surfaced) */
  treeSpots: { at: XZ; shape: 'round' | 'pine' | 'palm' | 'willow'; scale: number; yaw: number }[];
  benchSpots: { at: XZ; yaw: number }[];
  props: { at: XZ; name: string; yaw: number; scale: number; seed: number }[];
}

/**
 * Plan a boulevard — PURE. Returns the chain of street nodes (one per lattice
 * cell), the two end ports and every dressing anchor in world coordinates.
 * The end nodes ARE the ports, so when you plan them ON a neighbouring
 * piece's port cell `buildParkNet` merges them and the avenue is connected by
 * construction — no index arithmetic, no dangling stub.
 */
export function boulevardPlan(input: BoulevardPlanInput): BoulevardPlan {
  const id = input.id;
  const title = input.title ?? id.replace(/(^|[\s-_])(\w)/g, (_m, a, b) => `${a ? ' ' : ''}${b.toUpperCase()}`).trim();
  const from = snapXZ(input.from);
  const to = snapXZ(input.to);
  const dx = to[0] - from[0];
  const dz = to[1] - from[1];
  // ---- P0-A: DEGRADE, never throw ------------------------------------------
  // Non-axis-aligned endpoints get an L-ROUTE through a corner node. The elbow
  // turns on the LONGER leg's row, so the avenue keeps one dominant run and
  // the short leg reads as the connecting elbow.
  const diagonal = Math.abs(dx) > 1e-6 && Math.abs(dz) > 1e-6;
  const corner: XZ | null = diagonal ? (Math.abs(dx) >= Math.abs(dz) ? [to[0], from[1]] : [from[0], to[1]]) : null;
  if (corner) {
    // TWO shapes of this defect, one lint. A NEAR MISS (the minor leg is one or
    // two cells — round 8's `x −27.6` spine node against a W port at `x −26.4`)
    // is a mistyped coordinate and the lint names it. A real diagonal is a
    // wiring mistake (a port that does not face this way at all).
    const minor = Math.min(Math.abs(dx), Math.abs(dz));
    const majorIsX = Math.abs(dx) >= Math.abs(dz);
    const nearMiss = minor <= CELL * 2 + 1e-6;
    reportPlanLint(
      'boulevardDiagonal',
      `boulevardPlan(${id}): from [${from}] → to [${to}] is DIAGONAL — an RCT2 avenue runs N/S or E/W. Synthesized an L-ROUTE through the corner cell [${corner}] (both legs cardinal, both endpoints still CONNECTED — snapping the endpoint onto the axis instead would strand the piece's port and cost an accessibility FAIL), and the park renders. ${
        nearMiss
          ? `THIS LOOKS LIKE A MISTYPED COORDINATE: the two ends differ by only ${minor.toFixed(1)} u (${Math.round(
              minor / CELL,
            )} cell) in ${majorIsX ? 'z' : 'x'} — ${majorIsX ? 'z' : 'x'} ${majorIsX ? from[1] : from[0]} vs ${
              majorIsX ? to[1] : to[0]
            }. Read the endpoint OFF the piece (\`to: MARKET.port('W')\`) instead of retyping it, and re-check any hand-authored spine node on that row.`
          : `FIX THE PLAN: either wire two boulevards through that corner node yourself, or (usually the real bug) ask the piece for a port that actually faces this way — a <Bazaar> only has W and E, on its aisle axis, so pick the rotation/port pair with plan.port(...)/plan.portDir(...)/\`facing\` instead of assuming a compass name.`
      }`,
      true,
    );
  }
  const waypoints: XZ[] = corner ? [from, corner, to] : [from, to];
  const legLens = waypoints.slice(1).map((w, i) => Math.hypot(w[0] - waypoints[i][0], w[1] - waypoints[i][1]));
  const length = legLens.reduce((a, b) => a + b, 0);
  const steps = Math.round(length / CELL);
  if (steps < 3)
    reportPlanLint(
      'boulevardTooShort',
      `boulevardPlan(${id}): from [${from}] → to [${to}] is only ${steps} cell(s) long — a boulevard wants ≥ 3 (3.6 u); use a plain street edge instead. Built as-is so the park renders.`,
      true,
    );
  // first-leg axis (the direction the avenue leaves port A along); a degenerate
  // zero-length avenue keeps a legal unit axis so nothing downstream sees NaN
  const leg0Len = legLens[0] ?? 0;
  const axis: XZ =
    leg0Len > 1e-6
      ? [(waypoints[1][0] - from[0]) / leg0Len, (waypoints[1][1] - from[1]) / leg0Len]
      : [0, 1];
  const theme = themeOf(input.theme);
  const seed = themedSeed(theme, input.seed ?? 1);

  // local frame: the avenue runs along local +z from port A (the ORIGIN, so
  // the piece origin is always a lattice cell whatever the length parity) —
  // the plan's rotation carries the direction and every offset stays a simple
  // [lateral, along] pair. An L-route keeps the SAME frame and turns its
  // second leg onto local ±x, so every offset below is still [lateral, along]
  // in that leg's own frame.
  const rotation = Math.atan2(axis[0], axis[1]);
  /** one leg in LOCAL coords: origin, forward unit, lateral (left) unit, yaw */
  interface Leg {
    o: XZ;
    f: XZ;
    n: XZ;
    yaw: number;
    len: number;
    steps: number;
  }
  const legs: Leg[] = [];
  {
    let o: XZ = [0, 0];
    waypoints.slice(1).forEach((w, i) => {
      const len = legLens[i];
      const wf: XZ = len > 1e-6 ? [(w[0] - waypoints[i][0]) / len, (w[1] - waypoints[i][1]) / len] : [0, 1];
      const f = rotateXZ(-rotation, wf); // [0,1] for leg 0 by construction, ±[1,0] for the elbow
      legs.push({ o, f, n: [f[1], -f[0]], yaw: Math.atan2(f[0], f[1]), len, steps: Math.round(len / CELL) });
      o = [o[0] + f[0] * len, o[1] + f[1] * len];
    });
  }
  const localNodes: XZ[] = [[0, 0]];
  const localEdges: [number, number][] = [];
  legs.forEach((lg) => {
    for (let i = 1; i <= lg.steps; i += 1) {
      localEdges.push([localNodes.length - 1, localNodes.length]);
      localNodes.push([lg.o[0] + lg.f[0] * i * CELL, lg.o[1] + lg.f[1] * i * CELL]);
    }
  });
  const lastLeg = legs[legs.length - 1];
  const endNode = localNodes.length - 1;
  /** LOCAL point at distance `d` from port A, offset `lat` onto the verge */
  const legAt = (d: number): Leg => {
    let acc = 0;
    for (const lg of legs) {
      if (d <= acc + lg.len + 1e-6) return lg;
      acc += lg.len;
    }
    return lastLeg;
  };
  const distIn = (d: number, lg: Leg): number => {
    let acc = 0;
    for (const l of legs) {
      if (l === lg) break;
      acc += l.len;
    }
    return d - acc;
  };
  const localAt = (d: number, lat = 0): XZ => {
    const lg = legAt(d);
    const t = distIn(d, lg);
    return [lg.o[0] + lg.f[0] * t + lg.n[0] * lat, lg.o[1] + lg.f[1] * t + lg.n[1] * lat];
  };
  /** the LOCAL yaw of the leg carrying distance `d` (0 on a straight avenue) */
  const legYawAt = (d: number): number => legAt(d).yaw;

  // reserved OBB: a straight avenue keeps the historic [2.4, length/2] rect
  // exactly; an L-route reports the bounding box of both dressed legs
  const half: XZ = [2.4, length / 2];
  const footOffset: XZ = [0, length / 2];
  if (corner) {
    const xs = [-2.4, 2.4];
    const zs = [0, 0];
    legs.forEach((lg) => {
      [
        [lg.o[0], lg.o[1]],
        [lg.o[0] + lg.f[0] * lg.len, lg.o[1] + lg.f[1] * lg.len],
      ].forEach(([px, pz]) => {
        xs.push(px - 2.4, px + 2.4);
        zs.push(pz - 2.4, pz + 2.4);
      });
    });
    const x0 = Math.min(...xs);
    const x1 = Math.max(...xs);
    const z0 = Math.min(...zs);
    const z1 = Math.max(...zs);
    half[0] = (x1 - x0) / 2;
    half[1] = (z1 - z0) / 2;
    footOffset[0] = (x0 + x1) / 2;
    footOffset[1] = (z0 + z1) / 2;
  }

  const base = makeSetPiecePlan({
    kind: 'Boulevard',
    id,
    title,
    position: from,
    rotation,
    localNodes,
    localEdges,
    localPorts: [
      // chain ENDS, not stubs: the carriageway itself terminates here, so
      // buildParkNet must never prune them (a gate/junction may sit on one)
      { name: 'A', node: 0, dir: [0, -1], prunable: false },
      { name: 'B', node: endNode, dir: lastLeg.f, prunable: false },
    ],
    half,
    footOffset,
    reserve: input.reserve ?? false,
    theme,
    // `makeSetPiecePlan` folds `themeKey(theme)` into the remount key this
    // keyData feeds, so re-dressing the avenue for another world rebuilds it
    keyData: [from, to, input.spacing ?? 4.8, input.lamps !== false, input.trees !== false, input.benches !== false, input.planters !== false, input.stringLights !== false, input.avoid ?? null, seed],
  });

  // ---- dressing stations along the avenue ---------------------------------
  const clear = input.clear ?? 1.3;
  // NOTE: `.map((p) => snapXZ(p))`, never `.map(snapXZ)` — Array.map passes
  // (element, index, array), so a bare reference hands the INDEX to snapXZ's
  // optional `cell` argument: index 0 → division by zero → [NaN, NaN] (the
  // first avoid cell blocked nothing) and every later cell snapped to the
  // wrong grid. That made `avoid` a silent no-op.
  const avoid = (input.avoid ?? []).map((p) => snapXZ(p));
  const blocked = (p: XZ) => avoid.some((a) => Math.hypot(a[0] - p[0], a[1] - p[1]) < clear);
  const spacing = Math.max(CELL * 2, Math.round((input.spacing ?? 4.8) / CELL) * CELL);
  const stations: number[] = []; // distance along the avenue from port A
  for (let d = spacing; d <= length - spacing * 0.5; d += spacing) stations.push(d);

  const lampSpots: BoulevardPlan['lampSpots'] = [];
  const spans: [XZ, XZ][] = [];
  const treeSpots: BoulevardPlan['treeSpots'] = [];
  const benchSpots: BoulevardPlan['benchSpots'] = [];
  const props: BoulevardPlan['props'] = [];

  // the avenue's RHYTHM: a lamp PAIR at every station, a tree PAIR at every
  // half-station between them (a real allée, not scattered planting), and a
  // bench or planter alternating on the verge — deliberate, never random.
  stations.forEach((d, si) => {
    // on a straight avenue `legYaw` is 0 and every offset below is exactly the
    // historic `[lateral, along]` pair; on a degraded L-route the elbow leg
    // carries its own +π/2 frame so the verge stays beside ITS carriageway
    const legYaw = legYawAt(d);
    if (input.lamps !== false) {
      const pair: XZ[] = [];
      ([-1, 1] as const).forEach((s) => {
        const at = base.toWorld(localAt(d, s * 1.35));
        if (blocked(at)) return;
        // real PointLights on every OTHER station only: the lanterns all glow
        // emissively at night, but a long avenue must not eat the park's
        // global light budget on its own
        lampSpots.push({ at, light: si % 2 === 0 });
        pair.push(at);
      });
      if (input.stringLights !== false && pair.length === 2 && si % 2 === 0) spans.push([pair[0], pair[1]]);
    }
    // benches face the street, alternating verge, on the odd stations
    if (input.benches !== false && si % 2 === 1) {
      const s = si % 4 === 1 ? 1 : -1;
      const at = base.toWorld(localAt(d, s * 1.7));
      if (!blocked(at)) benchSpots.push({ at, yaw: base.toWorldYaw(legYaw + (s > 0 ? Math.PI / 2 : -Math.PI / 2)) });
    }
    // planter/topiary on the OPPOSITE verge from the bench
    if (input.planters !== false && si % 2 === 1) {
      const s = si % 4 === 1 ? -1 : 1;
      const at = base.toWorld(localAt(d, s * 1.7));
      if (!blocked(at))
        props.push({
          at,
          // the world's verge planting, rolled with the same hashed sine
          // (DEFAULT_THEME's list is ['topiarySpiral', 'planterBox'], so the
          // historic h > 0.5 ? planterBox : topiarySpiral split is preserved)
          name: pickSpecies(theme.planting.planters, hash01(seed * 3 + si), 'planterBox'),
          yaw: base.toWorldYaw(legYaw + (s > 0 ? Math.PI / 2 : -Math.PI / 2)),
          scale: 0.9,
          seed: seed + si * 5,
        });
    }
  });

  // street trees: a PAIR facing each other at every half-station, well off
  // the kerb (canopy over the verge, never over the slab centreline)
  if (input.trees !== false) {
    for (let d = spacing / 2; d <= length - spacing / 2 + 1e-6; d += spacing) {
      const i = Math.round((d - spacing / 2) / spacing);
      const h = hash01(seed * 7 + i * 11);
      // the world's allée species, from the SAME roll (DEFAULT_THEME's weights
      // are 0.3 pine / 0.55 round / 0.15 willow — the historic thresholds)
      const shape = pickTreeShape(theme, h);
      ([-1, 1] as const).forEach((s) => {
        const at = base.toWorld(localAt(d, s * 2.45));
        if (blocked(at)) return;
        treeSpots.push({
          at,
          shape,
          scale: 0.8 + hash01(seed * 13 + i * 5 + (s > 0 ? 1 : 2)) * 0.3,
          yaw: hash01(seed + i * 3 + (s > 0 ? 7 : 11)) * Math.PI * 2,
        });
      });
    }
  }

  // keepDry: the carriageway cells come from the sub-net; add every verge cell
  const cells: XZ[] = [
    ...base.cells,
    ...lampSpots.map((l) => l.at),
    ...treeSpots.map((tr) => tr.at),
    ...benchSpots.map((b) => b.at),
    ...props.map((p) => p.at),
  ];

  return {
    ...base,
    cells,
    kind: 'Boulevard',
    length,
    axis,
    corner,
    legs: waypoints.slice(1).map((w, i) => [waypoints[i], w] as [XZ, XZ]),
    lampSpots,
    spans,
    treeSpots,
    benchSpots,
    props,
  };
}

/**
 * <Boulevard plan={boulevardPlan(...)} /> — mounts the avenue's dressing
 * (lamp pairs, night-gated spans across the carriageway, street trees,
 * benches, planters). The carriageway itself is street: it comes from the
 * plan's nodes/edges through `buildParkNet` → `<Paths>`, so guests walk it,
 * queue tails may land on it and it is bermed/grounded like every other
 * street. Declare it AFTER `<Paths>`.
 */
export const Boulevard = setPiece<BoulevardPlan>('Boulevard', buildBoulevardScene);

/**
 * The avenue's DRESSING, as a plain builder — `<Boulevard>` is this function
 * wrapped in `setPiece`. Exported because a set-piece is the one part of the
 * catalog whose geometry a probe cannot otherwise reach: `setPiece` closes over
 * its builder, so `harness/mp3d-render/probe-setpiece-*.mjs` had no way to
 * count meshes, fingerprint vertices or run the attachment sweep on a themed
 * avenue. Everything a park needs still goes through the component.
 */
/** kerb offset from the carriageway centreline: the slab is 1.1 wide (edge
 *  0.55) and the lamp verge starts at 1.35, so the run sits in the band between
 *  them and no themed kerb ever stands in a walked slab */
const KERB_LAT = 0.82;

export function buildBoulevardScene(t: typeof THREE, plan: BoulevardPlan, park: ParkContextValue) {
  const g = new t.Group();
  const ups: ((time: number) => void)[] = [];
  const floor = (p: XZ) => park.floorAt(p[0], p[1]);

  // round-6 channels: every verge item is a PLANTED footprint (validatePark's
  // `scenery` gate audits it for dryness and for standing in a walked slab).
  // Nothing here is a blocker: thin lamp columns and tree trunks on a 1.35 u
  // verge are things guests brush past, and fencing an avenue would strand it.
  const reg = setPieceRegistry(park, plan);
  // THE WORLD'S STRUCTURAL DRESS, or null. `dressOf` has no entry for
  // DEFAULT_THEME (nor for a hand-rolled theme with an unknown id), so an
  // un-themed avenue never enters the themed branches below and keeps its
  // historic geometry by CONTROL FLOW rather than by promise — which is what
  // makes "identical with no theme" testable in one place instead of five.
  const dress = dressOf(plan.theme);
  const hooks = new Map<string, [number, number, number]>();
  plan.lampSpots.forEach((l) => {
    // the themed standards are oriented ALONG the avenue (a ship's yard and a
    // gaslight ladder-bar both have to face the street, not the compass)
    const lamp = dress
      ? dress.lamp(t, [l.at[0], floor(l.at), l.at[1]], { light: l.light, yaw: plan.rotation })
      : setPieceLamp(t, [l.at[0], floor(l.at), l.at[1]], { light: l.light, theme: plan.theme });
    g.add(lamp.group);
    ups.push(lamp.update);
    hooks.set(`${l.at[0]},${l.at[1]}`, lamp.hook);
    reg.plant('lamp', l.at);
  });
  plan.spans.forEach(([a, b]) => {
    const ha = hooks.get(`${a[0]},${a[1]}`);
    const hb = hooks.get(`${b[0]},${b[1]}`);
    if (!ha || !hb) return;
    // the avenue's spans use TWO of the world's bulb colours — the first and
    // the last, which on DEFAULT_THEME is exactly [0xffd9a0, 0xfff0c8]
    const bulbCols = plan.theme.palette.spanBulbs;
    const span = dress
      ? dress.span(t, ha, hb)
      : setPieceSpan(t, ha, hb, { colors: [bulbCols[0], bulbCols[bulbCols.length - 1]], bulbs: 5 });
    g.add(span.group);
    ups.push(span.update);
  });
  plan.treeSpots.forEach((s) => {
    const tr = tree(t, { shape: s.shape, scale: s.scale });
    tr.position.set(s.at[0], floor(s.at) - 0.05, s.at[1]); // seated, never floating
    tr.rotation.y = s.yaw;
    g.add(tr);
    reg.plant('tree', s.at, plantedRadius('tree') * s.scale);
  });
  plan.benchSpots.forEach((b) => {
    if (dress) {
      const seat = dress.bench(t, [b.at[0], floor(b.at), b.at[1]], b.yaw);
      g.add(seat.group);
      if (seat.update) ups.push(seat.update);
    } else g.add(setPieceBench(t, [b.at[0], floor(b.at), b.at[1]], b.yaw));
    reg.plant('bench', b.at);
  });
  // ONE prop slot becomes the world's own LANDMARK — a real piece out of that
  // world's scenery component (a basalt colonnade, a pile of dock pilings, a
  // giant gear, a toadstool clump, a speaker stack). It takes over the MIDDLE
  // planter slot rather than getting a position of its own on purpose: that
  // slot has already been through the planner's `avoid` filter and is already
  // in `plan.cells`, so the landmark inherits the avenue's keepDry guard and
  // cannot land on a queue lane, an exit hut or a ride pad.
  const lmSlot = dress && plan.props.length ? Math.floor((plan.props.length - 1) / 2) : -1;
  plan.props.forEach((p, i) => {
    if (dress && i === lmSlot) {
      const lm = dress.landmark(t, p.seed);
      // tag the imported piece so `probe-setpiece-attach` grades it as ONE
      // object: its internal part-to-part separations belong to its own
      // component's audit, not to this set-piece's
      lm.group.userData.importedPiece = lm.name;
      lm.group.position.set(p.at[0], floor(p.at), p.at[1]);
      lm.group.rotation.y = p.yaw;
      g.add(lm.group);
      if (lm.update) ups.push(lm.update);
      reg.plant(lm.name, p.at, lm.radius);
      return;
    }
    const built = buildSceneryAnimated(t, p.name, { scale: p.scale, seed: p.seed });
    built.group.position.set(p.at[0], floor(p.at), p.at[1]);
    built.group.rotation.y = p.yaw;
    g.add(built.group);
    if (built.update) ups.push(built.update);
    reg.plant(p.name, p.at, plantedRadius(p.name) * p.scale);
  });
  // ---- the world's EDGE TREATMENT along both verges ------------------------
  // One merged run per verge, however long the avenue is, so the whole edge
  // costs 2-4 draw calls. It is DRESSING, not a blocker and not a planted
  // footprint: an 0.11-tall kerb is something RCT2 guests step over, and
  // registering it would put a strip of scenery inside the walked slab's own
  // audit. It breaks at EVERY lattice node, which is both how a real street
  // handles a crossing and the reason a queue tail or a side street wired onto
  // any node of the carriageway still has a clear kerb-drop to enter through.
  if (dress) {
    plan.legs.forEach(([a, b]) => {
      const dx = b[0] - a[0];
      const dz = b[1] - a[1];
      const len = Math.hypot(dx, dz);
      if (len < CELL * 3) return;
      const ux = dx / len;
      const uz = dz / len;
      const yaw = Math.atan2(ux, uz);
      const cells = Math.round(len / CELL);
      ([-1, 1] as const).forEach((side) => {
        // left normal of the travel direction, scaled to sit clear of the
        // 1.1-wide slab (edge at 0.55) and inboard of the 1.35 lamp verge
        const nx = uz * side * KERB_LAT;
        const nz = -ux * side * KERB_LAT;
        const stations: { at: [number, number, number]; yaw: number }[] = [];
        for (let c = 1; c < cells - 1; c += 1) {
          [0.4, 0.8].forEach((off) => {
            const d = c * CELL + off;
            const x = a[0] + ux * d + nx;
            const z = a[1] + uz * d + nz;
            stations.push({ at: [x, park.floorAt(x, z), z], yaw });
          });
        }
        if (!stations.length) return;
        const run = dress.kerb(t, stations, Math.round(plan.length * 7 + (side > 0 ? 3 : 11)));
        g.add(run.group);
        if (run.update) ups.push(run.update);
      });
    });
  }

  return { group: g, update: (time: number) => ups.forEach((u) => u(time)), dispose: reg.dispose };
}


export type { SetPieceProps };

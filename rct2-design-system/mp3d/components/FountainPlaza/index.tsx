import * as THREE from 'three';
import { box, cyl } from '../Stage';
import { buildFountain } from '../Fountain';
import { reportPlanLint } from '../ParkBuilder';
import { buildSceneryAnimated } from '../SceneryPack';
import {
  CELL,
  makeSetPiecePlan,
  plantedRadius,
  setPiece,
  setPieceBench,
  setPieceLamp,
  setPieceRegistry,
  setPieceSpan,
  themeOf,
  themedSeed,
  yawToward,
} from '../SetPieceKit';
import type { SetPiecePlan, SetPieceProps, WorldTheme, XZ } from '../SetPieceKit';
// the STRUCTURAL half of the theme layer (see SetPieceKit/dress.ts) — kept out
// of SetPieceKit's 81 KB index, which is at the whole-file push ceiling
import { dressOf } from '../SetPieceKit/dress';
import type { ParkContextValue } from '../Park';

// ---------------------------------------------------------------------------
// FountainPlaza — the MACRO SET-PIECE for a park's hub: a fully paved RCT2
// plaza pad with a central fountain, a walkable RING around it and 3 or 4
// STREET PORTS. It is a real JUNCTION, never a dead end: whichever ports you
// wire, guests entering from one can reach every other, because the interior
// ring (not a cross through the fountain) carries the traffic.
//
// The piece is PLAN-FIRST (components/SetPieceKit): `fountainPlazaPlan()` is
// pure and returns every world coordinate — ports, sub-net, paving rect, bins,
// keepDry cells, footprint and each dressing anchor — so the composing agent
// can lay its street skeleton and terrain guards around the plaza BEFORE
// anything mounts, then hand the same plan to `<FountainPlaza plan={…} />`.
//
// Geometry (local frame, +z = the piece's own "N"; `rotation` turns the whole
// thing in quarter turns):
//
//     ┌───────── tiles × 1.2 ─────────┐        p = half + 0.6   (PORT cell,
//     │  T   L········port·N·······L  │        one lattice cell OUTSIDE the
//     │      ·  ┌──ring (r)──┐     ·  │        footprint)
//     │  port·W─┤   fountain │─·port·E     half = tiles × 0.6   (pad + OBB)
//     │      ·  └────────────┘     ·  │        r = half − 1.8   (ring, a
//     │  T   L········port·S·······L  │        square through the 4 mid nodes)
//     └───────────────────────────────┘        L = half − 0.9   (band lamps)
//
//   nodes  4 ring mids (N/E/S/W) + 4 ring corners + one stub node per port
//   dress  fountain at the centre · 4 benches facing it inside the ring ·
//          4 lantern lamps on the band diagonals + 2 (or 4) night-gated
//          festival spans hook-to-hook · topiary pairs flanking every port ·
//          a marble statue closing any side without a port · 2 bins
//
// Deterministic (hashed sine only). Everything settles through `park.floorAt`,
// which returns the plaza surface inside the pad — nothing floats.
// ---------------------------------------------------------------------------

export type PlazaSide = 'N' | 'E' | 'S' | 'W';

const SIDES: PlazaSide[] = ['N', 'E', 'S', 'W'];
// local outward direction per side
const SIDE_DIR: Record<PlazaSide, XZ> = { N: [0, 1], E: [1, 0], S: [0, -1], W: [-1, 0] };
// local along-side direction (for the two flanking prop slots)
const SIDE_TAN: Record<PlazaSide, XZ> = { N: [1, 0], E: [0, -1], S: [-1, 0], W: [0, 1] };

export interface FountainPlazaPlanInput {
  /** unique piece id — port refs read `'<id>:N'` in buildParkNet */
  id: string;
  /** display title (stall/footprint labels); default derived from `id` */
  title?: string;
  /** the plaza centre cell (snapped to the 1.2 lattice) */
  position: XZ;
  /** quarter-turn yaw (default 0) */
  rotation?: number;
  /** pad width in lattice tiles — ODD, 7..13 (default 7 → an 8.4 u square) */
  tiles?: number;
  /** half-extent in units instead of `tiles` (rounded to the lattice) */
  radius?: number;
  /** sides that get a street port (default all four; 3 = a T junction) */
  ports?: PlazaSide[];
  /** fountain scale (default 0.5 on a 7-tile pad, 0.62 from 9 tiles up) */
  fountainScale?: number;
  /** benches facing the fountain, 0..4 (default 4) */
  benches?: number;
  /** band lamps (default true) */
  lamps?: boolean;
  /** festival spans between the lamp hooks: 2 sides (default), all 4, or none */
  stringLights?: boolean | 'all';
  /** planter boxes on the closed sides (default true; false = topiary) */
  planters?: boolean;
  /** register the footprint (default true — the plaza OWNS its land) */
  reserve?: boolean;
  /** the WORLD this plaza is dressed for — paving accents, flanking species,
   *  the closing monument, the lantern character and the span bulbs all come
   *  from it. Default `DEFAULT_THEME` = today's concrete + topiary + marble. */
  theme?: WorldTheme;
  seed?: number;
}

export interface FountainPlazaPlan extends SetPiecePlan {
  kind: 'FountainPlaza';
  tiles: number;
  /** pad half-extent in units */
  half: number;
  /** ring radius (the square the 4 mid nodes sit on) */
  ring: number;
  fountain: { at: XZ; scale: number };
  benchSpots: { at: XZ; yaw: number }[];
  lampSpots: { at: XZ; light: boolean }[];
  spans: [XZ, XZ][];
  props: { at: XZ; name: string; yaw: number; scale: number; seed: number }[];
  openPorts: PlazaSide[];
}

/**
 * Plan a fountain plaza — PURE, so the whole piece exists as data before
 * anything mounts. Feed `plan` to `buildParkNet({ pieces: [plan] })` (its
 * sub-net, paving, bins and keepDry cells join the park's shared graph) and to
 * `<FountainPlaza plan={plan} />` (the visual). Port cells sit one lattice
 * cell OUTSIDE the plaza footprint, so a street — or a ride's queue lane —
 * can meet a port without ever overlapping the piece.
 */
export function fountainPlazaPlan(input: FountainPlazaPlanInput): FountainPlazaPlan {
  const id = input.id;
  const title = input.title ?? id.replace(/(^|[\s-_])(\w)/g, (_m, a, b) => `${a ? ' ' : ''}${b.toUpperCase()}`).trim();
  let tiles = input.tiles ?? (input.radius !== undefined ? 2 * Math.max(3, Math.round(input.radius / CELL)) + 1 : 7);
  if (tiles % 2 === 0) tiles += 1;
  if (tiles < 7) {
    // P0-A: degrade + LINT (never throw at module scope, never silently fix)
    reportPlanLint(
      'plazaTilesClamped',
      `fountainPlazaPlan(${id}): tiles ${tiles} is too small for a walkable ring around the fountain — using 7`,
      false,
    );
    tiles = 7;
  }
  if (tiles > 13) {
    reportPlanLint('plazaTilesClamped', `fountainPlazaPlan(${id}): tiles ${tiles} is past the 13-tile maximum — using 13`, false);
    tiles = 13;
  }
  const half = tiles * 0.6;
  const ring = half - 1.8;
  const stub = half + 0.6;
  const band = half - 0.9;
  const openPorts = (input.ports ?? SIDES).filter((s) => SIDES.includes(s));
  const theme = themeOf(input.theme);
  // the world's seed offset (0 on the default theme) — two worlds planted from
  // the same planner never repeat each other's seeded variation
  const seed = themedSeed(theme, input.seed ?? 1);

  // ---- sub-net: 4 mid nodes + 4 corners (the ring AROUND the fountain) ----
  const localNodes: XZ[] = [
    [0, ring], // 0 N mid
    [ring, ring], // 1 NE
    [ring, 0], // 2 E mid
    [ring, -ring], // 3 SE
    [0, -ring], // 4 S mid
    [-ring, -ring], // 5 SW
    [-ring, 0], // 6 W mid
    [-ring, ring], // 7 NW
  ];
  const localEdges: [number, number][] = [
    [0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 7], [7, 0],
  ];
  const MID: Record<PlazaSide, number> = { N: 0, E: 2, S: 4, W: 6 };
  const localPorts: { name: string; node: number; dir: XZ }[] = [];
  openPorts.forEach((s) => {
    const d = SIDE_DIR[s];
    const node = localNodes.length;
    localNodes.push([d[0] * stub, d[1] * stub]);
    localEdges.push([MID[s], node]);
    localPorts.push({ name: s, node, dir: d });
  });

  const base = makeSetPiecePlan({
    kind: 'FountainPlaza',
    id,
    title,
    position: input.position,
    rotation: input.rotation ?? 0,
    localNodes,
    localEdges,
    localPorts,
    localPlazas: [[0, 0, tiles * CELL, tiles * CELL]],
    localBins: [
      [0.9, ring - 0.75],
      [-0.9, -(ring - 0.75)],
    ],
    half: [half, half],
    reserve: input.reserve ?? true,
    theme,
    // `makeSetPiecePlan` folds `themeKey(theme)` into the same remount key this
    // keyData feeds, so dressing the plaza for another world REBUILDS the piece
    // (a stale palette left on screen is the one failure a theme layer mustn't
    // have). `seed` already carries the world's offset.
    keyData: [tiles, openPorts.join(''), input.benches ?? 4, input.lamps !== false, input.stringLights ?? true, input.planters !== false, seed],
  });

  // ---- dressing, resolved to WORLD coords by the same transform -----------
  const fountainScale = input.fountainScale ?? (tiles >= 9 ? 0.72 : 0.6);
  const benchCount = Math.max(0, Math.min(4, input.benches ?? 4));
  const bOff = ring - 1.05;
  const benchSpots = ([[1, 1], [-1, -1], [1, -1], [-1, 1]] as XZ[]).slice(0, benchCount).map((s) => {
    const at = base.toWorld([s[0] * bOff, s[1] * bOff]);
    return { at, yaw: yawToward(at, base.position) };
  });
  const lampLocals: XZ[] = input.lamps === false ? [] : [[band, band], [band, -band], [-band, -band], [-band, band]];
  const lampSpots = lampLocals.map((l) => ({ at: base.toWorld(l), light: true }));
  const spanMode = input.stringLights ?? true;
  const spanPairs: [number, number][] = spanMode === false ? [] : spanMode === 'all' ? [[0, 3], [1, 2], [0, 1], [2, 3]] : [[0, 3], [1, 2]];
  const spans: [XZ, XZ][] = lampSpots.length === 4 ? spanPairs.map(([a, b]) => [lampSpots[a].at, lampSpots[b].at] as [XZ, XZ]) : [];

  const props: FountainPlazaPlan['props'] = [];
  SIDES.forEach((s, si) => {
    const d = SIDE_DIR[s];
    const tan = SIDE_TAN[s];
    const open = openPorts.includes(s);
    // the world's species: cheeks flanking an open entrance are the theme's
    // `flanker`, a closed side's planter course is its `hedge`
    const name = open ? theme.planting.flanker : input.planters === false ? theme.planting.flanker : theme.planting.hedge;
    [-1, 1].forEach((sgn, k) => {
      const local: XZ = [d[0] * band + tan[0] * 1.8 * sgn, d[1] * band + tan[1] * 1.8 * sgn];
      const at = base.toWorld(local);
      props.push({ at, name, yaw: base.toWorldYaw(Math.atan2(-d[0], -d[1])), scale: 0.9, seed: seed + si * 7 + k });
    });
    if (!open) {
      const at = base.toWorld([d[0] * band, d[1] * band]);
      // the piece that CLOSES a portless side is the world's monument
      props.push({ at, name: theme.planting.monument, yaw: yawToward(at, base.position), scale: 1, seed: seed + si });
    }
  });

  return {
    ...base,
    // wave-11 P0: the basin is SOLID and the mount registers it as a blocker
    // (`reg.blockCircle('fountain basin', …, 1.78 * scale)`). Publishing the
    // SAME circle on the PLAN lets `buildParkNet` refuse a street wired into
    // the plaza's centre instead of into one of its ports, at fuse time —
    // round 10 shipped three of exactly that edge. Keep the two in step.
    solids: [...base.solids, { label: 'fountain basin', at: base.position, r: 1.78 * fountainScale }],
    kind: 'FountainPlaza',
    tiles,
    half,
    ring,
    fountain: { at: base.position, scale: fountainScale },
    benchSpots,
    lampSpots,
    spans,
    props,
    openPorts,
  };
}

/**
 * <FountainPlaza plan={fountainPlazaPlan(...)} /> — mounts the plaza dressing
 * (fountain, benches, lantern lamps, festival spans, topiary/statues) on the
 * paving `<Paths>` renders from the same plan, and registers the piece
 * footprint so validatePark's footprint sweep and the coaster-corridor sweep
 * see the whole plaza as ONE object. Declare it AFTER `<Paths>` (the plaza
 * surface must exist for everything to settle onto it).
 */
export const FountainPlaza = setPiece<FountainPlazaPlan>('FountainPlaza', buildFountainPlazaScene);

/**
 * The plaza's DRESSING, as a plain builder — `<FountainPlaza>` is this function
 * wrapped in `setPiece`. Exported for the same reason as `buildBoulevardScene`:
 * `setPiece` closes over its builder, so no probe could reach a themed plaza's
 * geometry to count meshes or run the attachment sweep.
 */
export function buildFountainPlazaScene(t: typeof THREE, plan: FountainPlazaPlan, park: ParkContextValue) {
  const g = new t.Group();
  const ups: ((time: number) => void)[] = [];
  const floor = (p: XZ) => park.floorAt(p[0], p[1]);

  // ---- paving accents: a fountain apron rosette + a border course, laid
  // 12 mm over the plaza surface <Paths> renders (RCT2 plazas are patterned,
  // never one flat grey field) ----
  const pal = plan.theme.palette;
  // THE WORLD'S STRUCTURAL DRESS, or null for DEFAULT_THEME / an unknown id.
  // See Boulevard's note: the default plaza never enters a themed branch, so
  // its geometry is unchanged by control flow, not by promise.
  const dress = dressOf(plan.theme);
  // the LOCAL outward dirs of the sides that carry a port — the themed paving
  // and the parapet both have to break where a street comes in
  const openDirs = plan.openPorts.map((s) => SIDE_DIR[s]);
  const plazaCtx = { half: plan.half, apron: 1.0 + plan.fountain.scale * 1.4, openDirs, seed: Math.round(plan.fountain.scale * 1000 + plan.tiles * 7) };
  if (dress) {
    // the world's floor PATTERN replaces the default apron rosette + border
    // course wholesale: a caldera floor is a fissure field, a cove is decking,
    // a foundry is riveted plate, a glade is a flagstone spiral, Pulse is
    // concentric light rings — none of which is a bordered municipal square.
    const pave = dress.paving(t, plazaCtx);
    pave.group.position.set(plan.position[0], floor(plan.position) + 0.012, plan.position[1]);
    pave.group.rotation.y = plan.rotation;
    g.add(pave.group);
    if (pave.update) ups.push(pave.update);
    // the plaza RIM, broken at every open port
    const rim = dress.parapet(t, plazaCtx);
    rim.group.position.set(plan.position[0], floor(plan.position), plan.position[1]);
    rim.group.rotation.y = plan.rotation;
    g.add(rim.group);
    if (rim.update) ups.push(rim.update);
    // and the ARMATURE over the water: four legs on the LOCAL AXES at r 1.45,
    // outside the fountain's 1.78 x scale basin blocker and inboard of the ring
    // slab's inner edge, carrying a hub ~3 u up. This is the single biggest
    // silhouette difference between two themed plazas.
    const centre = dress.centrepiece(t, plazaCtx);
    centre.group.position.set(plan.position[0], floor(plan.position), plan.position[1]);
    centre.group.rotation.y = plan.rotation;
    g.add(centre.group);
    if (centre.update) ups.push(centre.update);
  } else {
    const acc = new t.Group();
    acc.position.set(plan.position[0], floor(plan.position) + 0.012, plan.position[1]);
    acc.rotation.y = plan.rotation;
    const apron = 1.0 + plan.fountain.scale * 1.4;
    acc.add(cyl(t, apron, apron, 0.02, pal.pavingLight, [0, 0, 0], { tex: 'concrete', repeat: [8, 8], rough: 0.9, seg: 32 }));
    acc.add(cyl(t, apron - 0.32, apron - 0.32, 0.024, pal.pavingDark, [0, 0.002, 0], { tex: 'concrete', repeat: [6, 6], rough: 0.9, seg: 32 }));
    // border course, broken by an opening at every entrance axis
    const inset = plan.half - 0.45;
    const bw = 0.28;
    const gap = 0.8;
    const seg = inset - gap;
    if (seg > 0.4) {
      ([[0, 1], [0, -1], [1, 0], [-1, 0]] as XZ[]).forEach((d) => {
        [-1, 1].forEach((s) => {
          const off = (inset + gap) / 2;
          const along: XZ = [d[1], -d[0]]; // tangent to the side
          acc.add(
            box(
              t,
              [d[0] === 0 ? seg : bw, 0.02, d[0] === 0 ? bw : seg],
              pal.pavingDark,
              [d[0] * inset + along[0] * off * s, 0, d[1] * inset + along[1] * off * s],
              { tex: 'concrete', repeat: [Math.max(2, Math.round(seg * 1.5)), 1], rough: 0.9 },
            ),
          );
        });
      });
    }
    g.add(acc);
  }

  // central fountain — its basin is SOLID (round-6 blockers channel): guests
  // must walk AROUND it, which is exactly why the sub-net is a RING and not a
  // cross. The ring runs at `plan.ring` (≥ 2.4) from the centre and the basin
  // blocker is 1.78 × scale (≤ 1.28), so no street node of this piece can ever
  // sit inside the water — the defect that fails a hand-laid plaza hub.
  const reg = setPieceRegistry(park, plan);
  const f = buildFountain(t);
  f.group.scale.setScalar(plan.fountain.scale);
  f.group.position.set(plan.fountain.at[0], floor(plan.fountain.at), plan.fountain.at[1]);
  g.add(f.group);
  ups.push(f.update);
  reg.blockCircle('fountain basin', plan.fountain.at, 1.78 * plan.fountain.scale, 'water', 1.4 * plan.fountain.scale);

  // benches facing the water
  plan.benchSpots.forEach((b) => {
    if (dress) {
      const seat = dress.bench(t, [b.at[0], floor(b.at), b.at[1]], b.yaw);
      g.add(seat.group);
      if (seat.update) ups.push(seat.update);
    } else g.add(setPieceBench(t, [b.at[0], floor(b.at), b.at[1]], b.yaw));
    reg.plant('bench', b.at);
  });

  // lantern lamps + festival spans hook-to-hook
  const hooks = new Map<string, [number, number, number]>();
  plan.lampSpots.forEach((l) => {
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
    const span = dress ? dress.span(t, ha, hb) : setPieceSpan(t, ha, hb, { colors: pal.spanBulbs });
    g.add(span.group);
    ups.push(span.update);
  });

  // topiary / planters / closing statues — except that a themed plaza turns the
  // FIRST SIDE'S two flanking slots into the world's own landmark. `SIDES` is
  // walked in a fixed order and each side pushes its two flankers before
  // anything else, so props[0] and props[1] are always side 'N's pair: cells
  // the pure planner already sited, already inside the registered footprint and
  // already covered by its keepDry clamp.
  const lmSlots = dress && plan.props.length >= 2 ? [0, 1] : [];
  plan.props.forEach((p, i) => {
    if (dress && lmSlots.includes(i)) {
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

  return { group: g, update: (time: number) => ups.forEach((u) => u(time)), dispose: reg.dispose };
}

export type { SetPieceProps };

// ---------------------------------------------------------------------------
// ParkBuilder/placement.ts — the reusable PLACEMENT layer
// (rules/park-generation.md §5: place NOTHING without the legality lint):
// the footprint rect shape + obbOverlap SAT test, terrainLint, laneLenOf /
// RideAccess / planRideAccess, and the settle helpers bermNetToGround /
// plinthUnder / groundRideAccess (so nothing ever floats).
//
// Everything here is re-exported by ../ParkBuilder — import from
// '../ParkBuilder', never from this file directly.
// ---------------------------------------------------------------------------

import * as THREE from 'three';
import { box, cyl, mergedBoxes } from '../Stage';
import type { MergedBoxSpec } from '../Stage';
import { scaffoldBay, scaffoldTower, SCAFFOLD_LIFT, SCAFFOLD_WOOD } from '../PathNetwork';
import { WATER_LEVEL, segDist } from './climate';

/** the audited footprint rect shape (GameManager.footprints()) */
export interface ParkFootRect {
  cx: number;
  cz: number;
  hx: number;
  hz: number;
  yaw: number;
  label: string;
  /** OPTIONAL vertical extent, world y. Declare these and the footprint sweep
   *  will let this rect share ground-plan space with another that is cleanly
   *  ABOVE or BELOW it — a coaster flying over a flat ride's pad is a real
   *  layout, not a collision, and until 2026-07-28 it was failed as one because
   *  the sweep was purely 2D. Omit them and the rect is treated as floor-to-sky,
   *  i.e. exactly the old conservative behaviour. */
  y0?: number;
  y1?: number;
}

/** vertical clearance a piece of track must keep when it flies over something
 *  else — the same 2.2 u the published overfly rule uses (guest headroom plus a
 *  train), so "legal to cross" means one thing everywhere. */
export const OVERFLY_CLEAR = 2.2;

/**
 * Are these two rects cleanly separated in HEIGHT?
 *
 * True only when BOTH declare a vertical extent and the gap between them is at
 * least `OVERFLY_CLEAR`. Unknown extent answers false: a rect that has not said
 * how tall it is cannot be assumed short.
 */
export function vertClear(a: ParkFootRect, b: ParkFootRect): boolean {
  if (a.y0 == null || a.y1 == null || b.y0 == null || b.y1 == null) return false;
  const gap = a.y0 >= b.y1 ? a.y0 - b.y1 : b.y0 >= a.y1 ? b.y0 - a.y1 : -1;
  return gap >= OVERFLY_CLEAR;
}

/** 2D OBB overlap via SAT — the same conservative test placeAccess audits
 *  with (exported for the register wrappers' queue-orientation safeguard) */
export function obbOverlap(a: ParkFootRect, b: ParkFootRect): boolean {
  const axes: [number, number][] = [
    [Math.cos(a.yaw), -Math.sin(a.yaw)],
    [Math.sin(a.yaw), Math.cos(a.yaw)],
    [Math.cos(b.yaw), -Math.sin(b.yaw)],
    [Math.sin(b.yaw), Math.cos(b.yaw)],
  ];
  const dx = b.cx - a.cx;
  const dz = b.cz - a.cz;
  for (const [ux, uz] of axes) {
    const ra = a.hx * Math.abs(Math.cos(a.yaw) * ux - Math.sin(a.yaw) * uz) + a.hz * Math.abs(Math.sin(a.yaw) * ux + Math.cos(a.yaw) * uz);
    const rb = b.hx * Math.abs(Math.cos(b.yaw) * ux - Math.sin(b.yaw) * uz) + b.hz * Math.abs(Math.sin(b.yaw) * ux + Math.cos(b.yaw) * uz);
    if (Math.abs(dx * ux + dz * uz) > ra + rb) return false;
  }
  return true;
}

// ---------------------------------------------------------------------------
// PLACEMENT HELPERS — the reusable settle / access-planning layer
// (rules/park-generation.md §5: place NOTHING without the legality lint).
// ---------------------------------------------------------------------------

/** The legality lint over a terrain heightfield: `isDry` (ground safely above
 *  the waterline), `slopeAt` (max axis gradient over ±0.6), `flatEnough`
 *  (< 0.45 for rides, < 0.8 for trees) and `inBounds` (terrain edges taper). */
export function terrainLint(heightAt: (x: number, z: number) => number, size: number, waterLevel = WATER_LEVEL) {
  const half = size / 2;
  const slopeAt = (x: number, z: number): number => {
    const d = 0.6;
    const h = heightAt(x, z);
    return (
      Math.max(
        Math.abs(heightAt(x + d, z) - h),
        Math.abs(heightAt(x - d, z) - h),
        Math.abs(heightAt(x, z + d) - h),
        Math.abs(heightAt(x, z - d) - h),
      ) / d
    );
  };
  return {
    isDry: (x: number, z: number, clearance = 0.12) => heightAt(x, z) > waterLevel + clearance,
    slopeAt,
    flatEnough: (x: number, z: number, max = 0.45) => slopeAt(x, z) < max,
    inBounds: (x: number, z: number, margin = 1.1) => Math.abs(x) < half - margin && Math.abs(z) < half - margin,
  };
}

/** GameManager queue-lane length for a ride capacity (0.28 slot spacing) —
 *  the same formula createGameManager uses internally */
export const laneLenOf = (capacity: number) => Math.max(2.2, 0.6 + capacity * 2 * 0.28 + 0.5);

/** a planned ride-access assembly, GameManager-compatible */
export interface RideAccess {
  hut: [number, number]; // entrance hut centre (head of the lane)
  dir: [number, number]; // lane axis, unit, pointing hut → tail (= queueDir)
  anchor: [number, number]; // queue HEAD (lane runs anchor → tail = registerRide's queueAnchor)
  tail: [number, number]; // queue tail == a street node on the lattice
  tailNode: number; // that node's index (for the routing check)
  exit: [number, number]; // exit hut centre — its own grid cell
  exitDir: [number, number]; // exit doorway facing (axis-aligned)
  capacity: number;
}

/**
 * Plan a ride's access ON the grid (RCT2 RideEntranceExitPlaceAction spirit):
 * the queue lane runs ALONG a lattice axis, its TAIL is planted exactly on a
 * street node (the GameManager's routing.attach lands on that node), the
 * entrance hut sits at the head, and the exit hut takes its own grid cell.
 * The hut's along-axis coordinate is fixed by the manager's lane-length
 * formula (0.62 doorway + laneLen + 0.35 join slot up the axis from the
 * tail). Feed the result to `registerRide` (`queueAnchor: [anchor[0], padTop,
 * anchor[1]]`, `queueDir: dir`, `exitPoint: [exit[0], padTop, exit[1]]`).
 */
export function planRideAccess(
  nodes: [number, number][],
  tailNode: number,
  dir: [number, number],
  capacity: number,
  exit: [number, number],
  exitDir: [number, number],
): RideAccess {
  const [tx, tz] = nodes[tailNode];
  const join = laneLenOf(capacity) + 0.35; // manager: tail = anchor + (laneLen+0.35)·dir
  const anchor: [number, number] = [tx - dir[0] * join, tz - dir[1] * join];
  const hut: [number, number] = [anchor[0] - dir[0] * 0.62, anchor[1] - dir[1] * 0.62];
  return { hut, dir, anchor, tail: [tx, tz], tailNode, exit, exitDir, capacity };
}

// ---------------------------------------------------------------------------
// THE PLACEMENT SUGGESTION API (round-7 safeguard)
// ---------------------------------------------------------------------------
// Round-7's park put every "cell-centre" prop at ±3 / ±9 / ±15 with the street
// rows at ±3.6 / ±9.6 — 0.6 u from the edge CENTRELINE, i.e. half a slab
// INSIDE the walked surface (8 `scenery` FAILs), and its ride pads straight
// ON the lattice nodes (20 `blockers` FAILs + 5 unreachable queues). The
// clearance those checks demand was only ever computed INSIDE the failure
// message, so an author could do nothing but guess again. These two helpers
// are that arithmetic, callable BEFORE anything mounts:
//
//   pathClearance(net, [x, z])            → how far the spot is from the street
//   offPathCell(net, [x, z], { clear })   → the nearest spot that IS clear
//
// Both work on the SAME `{ nodes, edges }` lattice `<Paths>` renders (pass
// `streetNodes` to ignore the GameManager's logical access spurs).

/** the street lattice both suggestion helpers read (`<Paths nodes edges>`) */
export interface StreetLattice {
  nodes: [number, number][];
  edges: [number, number][];
}

export interface PathClearance {
  /** distance to the NEAREST of every street node + edge centreline */
  clearance: number;
  /** index of the closest edge (−1 when the net has none) */
  edge: number;
  /** index of the closest node */
  node: number;
}

/**
 * How far `[x, z]` stands from the street skeleton: the min distance to every
 * lattice NODE and every edge CENTRELINE (rendered street edges only when
 * `streetNodes` is given — logical spur attaches past that index are the
 * sanctioned way in, not streets). A ride pad wants ≥ 1.8; a solid prop wants
 * ≥ `pathWidth/2 + its ground radius` (≈ 1.15 for a planter on a 1.1 slab).
 */
export function pathClearance(net: StreetLattice, at: [number, number], streetNodes?: number): PathClearance {
  const n0 = streetNodes ?? net.nodes.length;
  const out: PathClearance = { clearance: Infinity, edge: -1, node: -1 };
  for (let i = 0; i < Math.min(n0, net.nodes.length); i += 1) {
    const d = Math.hypot(net.nodes[i][0] - at[0], net.nodes[i][1] - at[1]);
    if (d < out.clearance) {
      out.clearance = d;
      out.node = i;
    }
  }
  net.edges.forEach(([a, b], ei) => {
    if (a >= n0 || b >= n0) return;
    const d = segDist(net.nodes[a][0], net.nodes[a][1], net.nodes[b][0], net.nodes[b][1], at[0], at[1]);
    if (d < out.clearance) {
      out.clearance = d;
      out.edge = ei;
      out.node = -1;
    }
  });
  return out;
}

export interface OffPathCellOpts {
  /** required clearance from every node + edge centreline (default 1.8 — the
   *  §0 ride-pad rule: a 2.4-u pad then clears a 1.1-u slab by 0.05) */
  clear?: number;
  /** rendered-street node count (`park.paths.streetNodes`) */
  streetNodes?: number;
  /** legality filter — `terrainLint(...).isDry` / `park.isDry` (and anything
   *  else the caller wants: flatEnough, off another footprint…) */
  isDry?: (x: number, z: number) => boolean;
  /** park size: candidates stay `size/2 − margin` inside the plot */
  size?: number;
  margin?: number;
  /** candidate spacing (default 0.6 = the RCT2 half-cell, so results land on
   *  cell CENTRES as well as lattice nodes) */
  step?: number;
  /** how far out to search, in `step`s (default 8 = 4.8 u) */
  rings?: number;
}

/**
 * The nearest spot to `[x, z]` that is at least `clear` (default 1.8) u from
 * every street node AND edge centreline — the CELL INTERIOR a ride pad, stall
 * or solid prop belongs on (rules/park-generation.md §0.14). Searches the
 * 0.6-u half-cell lattice outward from `[x, z]` and returns the first
 * candidate that clears the streets, is in bounds and passes `isDry`; returns
 * `null` when the requested clearance is impossible nearby (the layout itself
 * is too dense — re-plan the street skeleton, don't shrink the rule).
 *
 * ```ts
 * const spot = offPathCell(NET, [-12, 9.6], { clear: 1.8, streetNodes, isDry: park.isDry });
 * // → [-13.8, 10.8]: park the SwingRide pad there, not on the node
 * ```
 */
export function offPathCell(net: StreetLattice, at: [number, number], opts: OffPathCellOpts = {}): [number, number] | null {
  const clear = opts.clear ?? 1.8;
  const step = opts.step ?? 0.6;
  const rings = opts.rings ?? 8;
  const half = opts.size !== undefined ? opts.size / 2 - (opts.margin ?? 1.2) : Infinity;
  const okAt = (p: [number, number]): boolean => {
    if (Math.max(Math.abs(p[0]), Math.abs(p[1])) > half) return false;
    if (opts.isDry && !opts.isDry(p[0], p[1])) return false;
    return pathClearance(net, p, opts.streetNodes).clearance >= clear;
  };
  if (okAt(at)) return at;
  // ring search on the half-cell lattice, nearest candidate first
  const cands: { p: [number, number]; d: number }[] = [];
  for (let ix = -rings; ix <= rings; ix += 1) {
    for (let iz = -rings; iz <= rings; iz += 1) {
      if (ix === 0 && iz === 0) continue;
      const p: [number, number] = [
        Math.round((at[0] + ix * step) / step) * step,
        Math.round((at[1] + iz * step) / step) * step,
      ];
      cands.push({ p, d: Math.hypot(p[0] - at[0], p[1] - at[1]) });
    }
  }
  cands.sort((a, b) => a.d - b.d || a.p[0] - b.p[0] || a.p[1] - b.p[1]);
  for (const c of cands) if (okAt(c.p)) return [+c.p[0].toFixed(2), +c.p[1].toFixed(2)];
  return null;
}

const EARTH = 0x6d5c43;

/** earth berms under LOW path spans + footings under nodes, so slabs never
 *  float over dips (ONE path level + berms — rules/park-generation.md §2.3).
 *  ONE grounding pass with buildPathNetwork: spans/nodes lifted more than
 *  SCAFFOLD_LIFT (0.35) above the terrain are SKIPPED here — the network's
 *  own RCT2 wooden scaffolds carry those (pass `groundAt` to
 *  buildPathNetwork), so an elevated deck never gets a stretched earth wall.
 *  `nodeY` = the same per-node height offsets the network was built with. */
export function bermNetToGround(
  t: typeof THREE,
  g: THREE.Group,
  net: { nodes: ([number, number] | [number, number, number])[]; edges: [number, number][] },
  pathY: number,
  groundAt: (x: number, z: number) => number,
  nodeY?: number[],
) {
  // heights: explicit nodeY, else the third element of [x, z, elevation] triples
  const nodeYArr = nodeY ?? (net.nodes.some((n) => n.length > 2) ? net.nodes.map((n) => (n[2] as number) ?? 0) : undefined);
  const surfOf = (ni: number) => pathY + (nodeYArr?.[ni] ?? 0);
  // the berm has to reach the ground under the WHOLE slab, not just under its
  // centreline: on a side-slope the downhill kerb hangs half a width further
  // down, and a centreline-deep berm left it visibly floating
  const BERM_HALF = 0.49; // the berm box is 0.98 wide
  net.edges.forEach(([a, b]) => {
    const [ax, az] = net.nodes[a];
    const [bx, bz] = net.nodes[b];
    const len = Math.hypot(bx - ax, bz - az);
    const nx = len > 1e-6 ? -(bz - az) / len : 0;
    const nz = len > 1e-6 ? (bx - ax) / len : 0;
    const lowGround = (x: number, z: number) =>
      Math.min(groundAt(x, z), groundAt(x + nx * BERM_HALF, z + nz * BERM_HALF), groundAt(x - nx * BERM_HALF, z - nz * BERM_HALF));
    let minG = Infinity;
    let maxLift = -Infinity;
    for (let k = 0; k <= 5; k += 1) {
      const u = k / 5;
      const px = ax + (bx - ax) * u;
      const pz = az + (bz - az) * u;
      minG = Math.min(minG, lowGround(px, pz));
      // the berm-vs-scaffold DECISION stays on the centreline, matching
      // buildPathNetwork's own support test — only the berm's DEPTH widens
      maxLift = Math.max(maxLift, surfOf(a) + (surfOf(b) - surfOf(a)) * u - groundAt(px, pz));
    }
    if (maxLift > SCAFFOLD_LIFT) return; // elevated span — scaffolds, not berms
    const sA = surfOf(a);
    const sB = surfOf(b);
    if (Math.abs(sB - sA) > 1e-6) {
      // grounded RAMP: the walking surface is buildPathNetwork's thin inclined
      // ribbon — the berm is an EARTH embankment UNDER it, a tilted slab whose
      // top hugs the ribbon underside (surface − 0.02) at the ramp's constant
      // grade, thick enough to bury into the ground along the whole run
      let deep = 0;
      for (let k = 0; k <= 5; k += 1) {
        const u = k / 5;
        deep = Math.max(deep, sA + (sB - sA) * u - 0.02 - lowGround(ax + (bx - ax) * u, az + (bz - az) * u));
      }
      if (deep <= 0.05) return; // ribbon already hugs the ground
      const h = deep + 0.25;
      const pitch = -Math.atan2(sB - sA, len);
      const yaw = Math.atan2(bx - ax, bz - az);
      const slopeLen = Math.hypot(len, sB - sA);
      const berm = box(t, [0.98, h, slopeLen - 0.2], EARTH, [0, 0, 0], {
        tex: 'concrete',
        repeat: [2, Math.max(2, Math.round(len * 2))],
        rough: 1,
      });
      berm.rotation.order = 'YXZ';
      berm.rotation.set(pitch, yaw, 0);
      const n = new t.Vector3(0, 1, 0).applyEuler(berm.rotation);
      berm.position.set(
        (ax + bx) / 2 - n.x * (h / 2 + 0.02),
        (sA + sB) / 2 - n.y * (h / 2 + 0.02),
        (az + bz) / 2 - n.z * (h / 2 + 0.02),
      );
      g.add(berm);
      return;
    }
    const top = Math.min(sA, sB);
    if (top - minG > 0.07) {
      const h = top - minG + 0.3;
      const berm = box(t, [0.98, h, len], EARTH, [(ax + bx) / 2, top - h / 2, (az + bz) / 2], {
        tex: 'concrete',
        repeat: [2, Math.max(2, Math.round(len * 2))],
        rough: 1,
      });
      berm.rotation.y = Math.atan2(bx - ax, bz - az);
      g.add(berm);
    }
  });
  net.nodes.forEach(([x, z], ni) => {
    const gnd = groundAt(x, z);
    const surf = surfOf(ni);
    if (surf - gnd > SCAFFOLD_LIFT) return; // elevated pad — scaffold tower, not a footing
    if (surf - gnd > 0.07) {
      const h = surf - gnd + 0.3;
      g.add(cyl(t, 0.72, 0.82, h, EARTH, [x, surf - h / 2, z], { tex: 'concrete', repeat: [4, 1], rough: 1, seg: 14 }));
    }
  });
}

/** grounds an off-path footprint (kiosks, restrooms, stands, the park gate)
 *  so a base never floats: an earth plinth from the real ground up to `topY`
 *  for LOW lifts, and — above SCAFFOLD_LIFT (0.35, elevated placements
 *  beside nodeY-ramped paths) — an RCT2 wooden scaffold tower with a plank
 *  DECK whose top lands at `topY + 0.01`, exactly where the plinth top was */
export function plinthUnder(
  t: typeof THREE,
  g: THREE.Group,
  groundAt: (x: number, z: number) => number,
  x: number,
  z: number,
  w: number,
  d: number,
  topY: number,
) {
  const gnd = groundAt(x, z);
  if (topY - gnd <= 0.05) return;
  if (topY - gnd > SCAFFOLD_LIFT) {
    const gLow = Math.min(
      gnd,
      groundAt(x - w / 2, z - d / 2),
      groundAt(x + w / 2, z - d / 2),
      groundAt(x - w / 2, z + d / 2),
      groundAt(x + w / 2, z + d / 2),
    );
    const specs: MergedBoxSpec[] = [];
    scaffoldTower(t, specs, x, z, w, d, topY, gLow, { deck: true, seed: Math.round(x * 7 + z * 13) });
    g.add(mergedBoxes(t, specs, SCAFFOLD_WOOD, { tex: 'wood', rough: 0.85 }));
    return;
  }
  const h = topY - gnd + 0.3;
  g.add(box(t, [w, h, d], EARTH, [x, topY - h / 2 + 0.01, z], { tex: 'concrete', repeat: [3, 2], rough: 1 }));
}

/**
 * Grounds a planned ride-access assembly so nothing floats: hut/exit bases +
 * the queue lane. LOW lifts (≤ SCAFFOLD_LIFT = 0.35) keep the earth plinths
 * and lane berm; ELEVATED lifts (huts beside nodeY-ramped elevated queues)
 * get the RCT2 wooden treatment instead — a scaffold tower + plank deck
 * under each hut footprint and post bays + a deck strip under the lane.
 * `exitXZ` is the AUDIT-RESOLVED exit hut centre from the GameManager
 * (`handle.exitPoint()` — placeAccess may shift the exit along its pad edge);
 * defaults to the planned spot. The EXIT base is deeper and shifted
 * FORWARD: unloading riders re-appear inside the hut and walk OUT through
 * its front doorway apron. Returns obstacle discs (hut/exit/lane) to feed
 * your scenery rejection sampler.
 */
export function groundRideAccess(
  t: typeof THREE,
  g: THREE.Group,
  groundAt: (x: number, z: number) => number,
  acc: RideAccess,
  y: number,
  exitXZ: [number, number] = acc.exit,
  /** the queue lane's TAIL level, when it differs from `y` — the lane itself is
   *  an RCT2 SLOPED PATH from the ride's level down (or up) to the street it
   *  joins (GameManager `buildQueueLane`), so the berm/scaffold that carries it
   *  has to follow the same grade or it stands proud of the slab at one end and
   *  leaves it hanging in the air at the other. Omitted ⇒ level, as before. */
  tailY: number = y,
): { x: number; z: number; r: number }[] {
  (
    [
      [acc.hut, acc.dir, 0.99, 0],
      [exitXZ, acc.exitDir, 1.9, -0.35],
    ] as [[number, number], [number, number], number, number][]
  ).forEach(([p, d, depth, back], pi) => {
    const cx = p[0] - d[0] * back;
    const cz = p[1] - d[1] * back;
    const gnd = Math.min(groundAt(p[0], p[1]), groundAt(cx, cz));
    if (y - gnd <= 0.05) return;
    const yaw = Math.atan2(d[0], d[1]);
    if (y - gnd > SCAFFOLD_LIFT) {
      // elevated hut — scaffold tower + deck (top at y + 0.01, like the plinth)
      const specs: MergedBoxSpec[] = [];
      scaffoldTower(t, specs, cx, cz, 1.14, depth, y, gnd, { deck: true, rotY: yaw, seed: pi * 19 + 3 });
      g.add(mergedBoxes(t, specs, SCAFFOLD_WOOD, { tex: 'wood', rough: 0.85 }));
      return;
    }
    const h = y - gnd + 0.3;
    const plinth = box(t, [1.14, h, depth], EARTH, [cx, y - h / 2 + 0.01, cz], {
      tex: 'concrete',
      repeat: [3, 2],
      rough: 1,
    });
    plinth.rotation.y = yaw;
    g.add(plinth);
  });
  const len = Math.hypot(acc.tail[0] - acc.anchor[0], acc.tail[1] - acc.anchor[1]);
  let minG = Infinity;
  for (let k = 0; k <= 5; k += 1) {
    minG = Math.min(minG, groundAt(acc.anchor[0] + (acc.tail[0] - acc.anchor[0]) * (k / 5), acc.anchor[1] + (acc.tail[1] - acc.anchor[1]) * (k / 5)));
  }
  const laneYaw = Math.atan2(acc.tail[0] - acc.anchor[0], acc.tail[1] - acc.anchor[1]);
  // the lane's own grade: `y` at the anchor (head), `tailY` at the tail
  const rise = tailY - y;
  const lanePitch = -Math.atan2(rise, len || 1); // local +z (the tail) rises with it
  const laneRun = Math.hypot(len, rise); // the carried length ON the slope
  const yHigh = Math.max(y, tailY);
  if (yHigh - minG > SCAFFOLD_LIFT) {
    // elevated queue lane — one wooden post bay per ~1.2 tile + a plank deck
    // strip (top at the lane surface + 0.01), never a stretched berm
    const ux = (acc.tail[0] - acc.anchor[0]) / (len || 1);
    const uz = (acc.tail[1] - acc.anchor[1]) / (len || 1);
    const specs: MergedBoxSpec[] = [];
    const bays = Math.max(1, Math.round(len / 1.2));
    for (let k = 0; k < bays; k++) {
      const u = (k + 0.5) / bays;
      const wx = acc.anchor[0] + (acc.tail[0] - acc.anchor[0]) * u;
      const wz = acc.anchor[1] + (acc.tail[1] - acc.anchor[1]) * u;
      scaffoldBay(t, specs, wx, wz, uz, -ux, 0.24, y + rise * u - 0.03, groundAt(wx, wz), k * 23 + 5);
    }
    const deck = new t.Matrix4().makeRotationFromEuler(new t.Euler(lanePitch, laneYaw, 0, 'YXZ'));
    deck.setPosition(
      (acc.anchor[0] + acc.tail[0]) / 2,
      (y + tailY) / 2 - 0.02,
      (acc.anchor[1] + acc.tail[1]) / 2,
    );
    specs.push({ dims: [0.62, 0.06, laneRun], matrix: deck, repeat: [1, Math.max(2, Math.round(laneRun * 2))] });
    g.add(mergedBoxes(t, specs, SCAFFOLD_WOOD, { tex: 'wood', rough: 0.85 }));
  } else if (yHigh - minG > 0.05) {
    // sized off the HIGH end so an inclined berm still reaches ground at the low one
    const h = yHigh - minG + 0.3;
    const berm = box(t, [0.6, h, laneRun], EARTH, [0, 0, 0], { tex: 'concrete', repeat: [2, 6], rough: 1 });
    berm.rotation.set(lanePitch, laneYaw, 0, 'YXZ');
    berm.position.set((acc.anchor[0] + acc.tail[0]) / 2, (y + tailY) / 2 - h / 2 + 0.01, (acc.anchor[1] + acc.tail[1]) / 2);
    g.add(berm);
  }
  return [
    { x: acc.hut[0], z: acc.hut[1], r: 1.2 },
    { x: exitXZ[0], z: exitXZ[1], r: 1.1 },
    { x: (acc.anchor[0] + acc.tail[0]) / 2, z: (acc.anchor[1] + acc.tail[1]) / 2, r: 1.5 },
  ];
}

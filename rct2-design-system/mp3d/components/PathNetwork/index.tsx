import React from 'react';
import * as THREE from 'three';
import { box, cyl, ball, mergedBoxes, nightKOf } from '../Stage';
import type { MergedBoxSpec } from '../Stage';
import { composable } from '../Park';

// Path NETWORK — a graph of footpath nodes + edges rendered in our RCT2
// tarmac-with-kerbs style (grey 0x9a9a96 asphalt slab, pale concrete kerbs,
// expansion-joint seams). Uniform tile language, like RCT2's footpath
// configurations: every edge slab and junction pad is the SAME width, and
// kerb trim appears ONLY where no neighbouring path continues — a node pad
// grows a kerb strip on each FREE cardinal side (none where an edge
// connects) plus the four kerb corners, so a 4-way node reads as an RCT2
// cross tile, a 3-way as a T, a bend as a corner tile. Junctions (degree
// >= 3) get a lamp post and dead ends a litter bin, both planted in the
// widest angular gap between the approaches (never on a slab).
//
// RCT2 paths live on a TILE GRID: tiles connect only N/S/E/W (no diagonals),
// wide open areas are full "center" tiles (kerb only around the outside), and
// sloped path tiles ramp exactly one height step per tile. `grid` validates
// axis-alignment, `plazas` renders center-tile rectangles, and per-node
// heights (`nodeY`, or `[x, z, elevation]` node triples) turn edges between
// levels into RAMPS: flat inclined RIBBONS at constant grade (path width,
// kerbs and seams following the slope) joined flush at both knuckles — the
// pads at a ramp's ends bevel toward the grade so there is never a step,
// gap or overhang where a slope meets a level span (Paint.Path.cpp's sloped
// path elements). Deterministic — no Math.random.

/** a network node: `[x, z]` or `[x, z, elevation]` (the optional third
 *  element is the node's height offset — same meaning as `nodeY[i]`) */
export type PathNode = [number, number] | [number, number, number];

export interface PathNet {
  nodes: PathNode[];
  edges: [number, number][];
}
export interface PathNetworkOpts {
  width?: number;
  y?: number;
  kind?: 'tarmac' | 'dirt';
  /** ground sampler so verge furniture (lamps/bins) stands on real ground
   *  when the path is raised above terrain (default: furniture at `y`) */
  groundAt?: (x: number, z: number) => number;
  /** RCT2 tile-grid rule: warn about any edge that is not axis-aligned
   *  (|dx| < 0.01 or |dz| < 0.01 required — paths run N/S/E/W only) */
  grid?: boolean;
  /** full-paved plaza rectangles `[centerX, centerZ, width, depth]` rendered
   *  as a flush grid of RCT2 "center" tiles: ONE surface level, kerb only
   *  around the outer boundary (with openings where edges enter), junction
   *  pads/kerbs/furniture suppressed for nodes inside */
  plazas?: [number, number, number, number][];
  /** per-node height offsets (parallel to `nodes`, default 0 = at `y`); edges
   *  between different heights render as flat inclined RIBBONS — RCT2 sloped
   *  path, max 0.5 rise per 1.2 run (one height step per tile), steeper warns.
   *  Prefer `[x, z, elevation]` node triples (used when `nodeY` is absent):
   *  the height travels WITH the node through snapNetToGrid's merging. */
  nodeY?: number[];
}

/** Snap a path net to the RCT2 tile grid: every node rounds to the nearest
 *  multiple of `cell` (default 1.2 = path width), nodes that land on the same
 *  cell are merged, edges are re-indexed, and degenerate/duplicate edges are
 *  dropped. Mutates `net.nodes`/`net.edges` IN PLACE (so a Routing sharing the
 *  arrays stays consistent) and returns the same net. `[x, z, elevation]`
 *  triples keep their elevation through the snap (first node wins on a
 *  merge) — that's why triples beat a parallel `nodeY` array, which would
 *  need re-indexing whenever merging changes node indices (snap FIRST). */
export function snapNetToGrid<T extends { nodes: PathNode[]; edges: [number, number][] }>(net: T, cell = 1.2): T {
  const { nodes, edges } = net;
  const keyToNew = new Map<string, number>();
  const remap: number[] = [];
  const newNodes: PathNode[] = [];
  nodes.forEach((n) => {
    const [x, z] = n;
    const sx = Math.round(x / cell) * cell;
    const sz = Math.round(z / cell) * cell;
    const key = `${sx.toFixed(4)},${sz.toFixed(4)}`;
    let idx = keyToNew.get(key);
    if (idx === undefined) {
      idx = newNodes.length;
      newNodes.push(n.length > 2 ? [sx, sz, n[2] as number] : [sx, sz]);
      keyToNew.set(key, idx);
    }
    remap.push(idx);
  });
  const seen = new Set<string>();
  const newEdges: [number, number][] = [];
  edges.forEach(([a, b]) => {
    const na = remap[a];
    const nb = remap[b];
    if (na === nb) return; // endpoints merged — degenerate edge dropped
    const key = na < nb ? `${na}-${nb}` : `${nb}-${na}`;
    if (seen.has(key)) return; // duplicate edge dropped
    seen.add(key);
    newEdges.push([na, nb]);
  });
  nodes.length = 0;
  nodes.push(...newNodes);
  edges.length = 0;
  edges.push(...newEdges);
  return net;
}

// deterministic pseudo-random from an integer key (hashed sine)
const hash01 = (n: number) => {
  const s = Math.sin(n * 12.9898 + 78.233) * 43758.5453;
  return s - Math.floor(s);
};

// ---------------------------------------------------------------------------
// SCAFFOLDING — RCT2 wooden path supports. OpenRCT2 draws support columns
// under every path element whose base sits above the map surface
// (Paint.Path.cpp ShouldDrawSupports: `surface->getBaseZ() < height` ⇒
// supports), and the wooden support painter stacks repeated post segments
// with a horizontal member every 16 z-units plus special slope-transition
// pieces (WoodenSupports.cpp PathBoxSupportsPaintSetup). The 3D translation:
// square timber posts dropped to the REAL ground, a horizontal rung every
// ~0.55 of drop (our 16-unit segment) and one alternating diagonal brace per
// bay panel. Everything is emitted as MergedBoxSpecs so an entire network's
// scaffolding merges into ONE mesh / one draw call.

/** lift threshold: a span/pad more than this above the terrain gets a wooden
 *  scaffold to the ground (below it: earth berms / low concrete piers) */
export const SCAFFOLD_LIFT = 0.35;
/** weathered support timber (shared by ParkBuilder's grounding helpers) */
export const SCAFFOLD_WOOD = 0x8a6b4a;

const SC_POST = 0.075; // square post section
const SC_RUNG = 0.05; // horizontal member section
const SC_STEP = 0.55; // vertical rung spacing — RCT2's 16-unit support segment

// one diagonal brace across a bay panel (local z = across the bay, tilted in
// the vertical plane); sgn flips the tilt so stacked panels alternate
const diagSpec = (
  t: typeof THREE,
  specs: MergedBoxSpec[],
  cx: number,
  cy: number,
  cz: number,
  yaw: number,
  span: number,
  gap: number,
  sgn: number,
) => {
  const m = new t.Matrix4().makeRotationFromEuler(new t.Euler(-Math.atan2(gap, span) * sgn, yaw, 0, 'YXZ'));
  m.setPosition(cx, cy, cz);
  specs.push({ dims: [0.042, 0.042, Math.hypot(gap, span)], matrix: m });
};

/**
 * One scaffold BAY under a span: a pair of square posts astride the span
 * centreline (`ux/uz` = lateral unit, post centres at ±`halfSpread`), posts
 * from `groundY − 0.06` up to `topY` (pick topY INSIDE the deck/slab above),
 * a rung between them every SC_STEP of drop and an alternating diagonal per
 * panel (hashed on `seed`). Appends MergedBoxSpecs — merge the collected
 * array with `mergedBoxes(t, specs, SCAFFOLD_WOOD, { tex: 'wood' })`.
 */
export function scaffoldBay(
  t: typeof THREE,
  specs: MergedBoxSpec[],
  cx: number,
  cz: number,
  ux: number,
  uz: number,
  halfSpread: number,
  topY: number,
  groundY: number,
  seed: number,
) {
  const yaw = Math.atan2(ux, uz);
  const postH = topY - (groundY - 0.06);
  if (postH <= 0.05) return;
  [-1, 1].forEach((s) => {
    specs.push({
      dims: [SC_POST, postH, SC_POST],
      pos: [cx + ux * s * halfSpread, topY - postH / 2, cz + uz * s * halfSpread],
      rotY: yaw,
      repeat: [1, Math.max(1, Math.round(postH * 2))],
    });
  });
  const span = halfSpread * 2;
  const levels: number[] = [];
  for (let ry = topY - 0.09; ry > groundY + 0.14; ry -= SC_STEP) levels.push(ry);
  levels.forEach((ry) => specs.push({ dims: [SC_RUNG, SC_RUNG, span + SC_POST], pos: [cx, ry, cz], rotY: yaw, repeat: [1, 2] }));
  const panels = [...levels, groundY + 0.02];
  for (let i = 0; i + 1 < panels.length; i++) {
    const hi = panels[i] - SC_RUNG / 2;
    const lo = panels[i + 1] + SC_RUNG / 2;
    if (hi - lo < 0.22) continue;
    const sgn = hash01(seed * 13 + i * 7 + 1) < 0.5 ? 1 : -1;
    diagSpec(t, specs, cx, (hi + lo) / 2, cz, yaw, span, hi - lo, sgn);
  }
}

/**
 * A four-post scaffold TOWER under a rectangular footprint (junction pads,
 * stall/hut decks): posts inset 0.08 from each corner, perimeter rungs every
 * SC_STEP, alternating diagonals on the two long faces, and (with `deck`) a
 * plank deck whose TOP lands at `topY + 0.01` — the same finished level the
 * ParkBuilder earth plinth used, so bases sit flush on it.
 */
export function scaffoldTower(
  t: typeof THREE,
  specs: MergedBoxSpec[],
  x: number,
  z: number,
  w: number,
  d: number,
  topY: number,
  groundY: number,
  opts: { rotY?: number; deck?: boolean; seed?: number } = {},
) {
  const yaw = opts.rotY ?? 0;
  const seed = opts.seed ?? 1;
  const cosY = Math.cos(yaw);
  const sinY = Math.sin(yaw);
  const world = (lx: number, lz: number): [number, number] => [x + lx * cosY + lz * sinY, z - lx * sinY + lz * cosY];
  const hx = Math.max(0.08, w / 2 - 0.08);
  const hz = Math.max(0.08, d / 2 - 0.08);
  const postTop = opts.deck ? topY - 0.04 : topY;
  const postH = postTop - (groundY - 0.06);
  if (postH <= 0.05) return;
  [-1, 1].forEach((sx) =>
    [-1, 1].forEach((sz) => {
      const [wx, wz] = world(sx * hx, sz * hz);
      specs.push({
        dims: [SC_POST, postH, SC_POST],
        pos: [wx, postTop - postH / 2, wz],
        rotY: yaw,
        repeat: [1, Math.max(1, Math.round(postH * 2))],
      });
    }),
  );
  const levels: number[] = [];
  for (let ry = postTop - 0.07; ry > groundY + 0.14; ry -= SC_STEP) levels.push(ry);
  levels.forEach((ry) => {
    [-1, 1].forEach((s) => {
      const [ax, az] = world(s * hx, 0);
      specs.push({ dims: [SC_RUNG, SC_RUNG, hz * 2 + SC_POST], pos: [ax, ry, az], rotY: yaw, repeat: [1, 2] });
      const [bx, bz] = world(0, s * hz);
      specs.push({ dims: [hx * 2 + SC_POST, SC_RUNG, SC_RUNG], pos: [bx, ry, bz], rotY: yaw, repeat: [2, 1] });
    });
  });
  // diagonals on the two x-facing sides (they read from every camera angle)
  const panels = [...levels, groundY + 0.02];
  for (let i = 0; i + 1 < panels.length; i++) {
    const hi = panels[i] - SC_RUNG / 2;
    const lo = panels[i + 1] + SC_RUNG / 2;
    if (hi - lo < 0.22) continue;
    [-1, 1].forEach((s) => {
      const [ax, az] = world(s * hx, 0);
      const sgn = (hash01(seed * 13 + i * 7 + s) < 0.5 ? 1 : -1) * s;
      diagSpec(t, specs, ax, (hi + lo) / 2, az, yaw, hz * 2, hi - lo, sgn);
    });
  }
  if (opts.deck) specs.push({ dims: [w, 0.08, d], pos: [x, topY - 0.03, z], rotY: yaw, repeat: [3, 3] });
}

export function buildPathNetwork(t: typeof THREE, net: PathNet, opts: PathNetworkOpts = {}) {
  const width = opts.width ?? 1.2;
  const y = opts.y ?? 0;
  const dirt = opts.kind === 'dirt';
  const PAVE = dirt ? 0x9a7448 : 0x9a9a96;
  const KERB = dirt ? 0x7a5a34 : 0xb8b8b2;
  const SEAM = dirt ? 0x6a4e2c : 0x77776f;
  const H = 0.09; // base slab thickness — path surfaces sit at ~y + H

  const group = new t.Group();
  const { nodes, edges } = net;

  // DRAW-CALL BATCHING: every static box (slabs, kerbs, seams, pads, plaza
  // tiles, piers, lips) is collected as a MergedBoxSpec and merged into ONE
  // mesh per material bucket at the end — a big network renders in ~5 draw
  // calls (+ shadow passes) instead of hundreds. Texture repeats are baked
  // into UVs by mergedBoxes, so mixed-length parts look identical to the old
  // per-box meshes. Only the lamps/bins (few, cylindrical) stay individual.
  const paveSpecs: MergedBoxSpec[] = []; // PAVE asphalt: slabs + pads + plaza tiles
  const kerbSpecs: MergedBoxSpec[] = []; // KERB concrete: strips + corners + lips
  const seamSpecs: MergedBoxSpec[] = []; // SEAM plain: expansion joints
  const pierSpecs: MergedBoxSpec[] = []; // grey concrete support piers (LOW lifts only)
  const woodSpecs: MergedBoxSpec[] = []; // RCT2 wooden scaffolds under ELEVATED spans/pads

  // per-node height offsets: explicit nodeY, else the third element of any
  // [x, z, elevation] node triples (the convenience form — heights travel
  // WITH the nodes through snapNetToGrid, no parallel array to manage)
  const nodeYArr = opts.nodeY ?? (nodes.some((n) => n.length > 2) ? nodes.map((n) => (n[2] as number) ?? 0) : undefined);
  // per-node WORLD height (base y + offset) — flat networks: yOf == y
  const yOf = (ni: number) => y + (nodeYArr?.[ni] ?? 0);

  // plazas — RCT2 center-tile rectangles, all sharing ONE surface level just
  // above the max jittered slab top (H + 0.0045) so pass-through edge slabs
  // are covered with >= 1.5mm clearance and can never z-fight the plaza
  const plazas = opts.plazas ?? [];
  const plazaTop = H + 0.006;
  const insidePlaza = (x: number, z: number) =>
    plazas.some(([cx, cz, w, d]) => Math.abs(x - cx) <= w / 2 + 0.001 && Math.abs(z - cz) <= d / 2 + 0.001);

  // RCT2 tile-grid rule: paths run N/S/E/W only
  if (opts.grid) {
    edges.forEach(([ai, bi], ei) => {
      const adx = Math.abs(nodes[bi][0] - nodes[ai][0]);
      const adz = Math.abs(nodes[bi][1] - nodes[ai][1]);
      if (adx >= 0.01 && adz >= 0.01) console.warn(`grid mode: edge ${ei} is diagonal — paths must run N/S/E/W`);
    });
  }

  // junction lamp heads + a few real lights, gated by the Stage day/night cycle
  const lampHeadMats: THREE.MeshStandardMaterial[] = [];
  const lampLights: THREE.PointLight[] = [];
  const MAX_LAMP_LIGHTS = 6; // beyond this, lamps glow emissive-only (perf)

  // node degrees (for junction pads / lamps / bins)
  const degree = nodes.map(() => 0);
  edges.forEach(([a, b]) => {
    degree[a] += 1;
    degree[b] += 1;
  });

  const lengths: number[] = [];
  const tops: number[] = []; // per-edge surface offset (surface = node lerp + tops[ei])
  const sq = width + 0.02; // junction pad size — SAME width as the slabs
  // (+0.02 so pad side faces are never coplanar with a passing slab's sides)
  const KW = 0.08; // shared kerb cross-section: 0.08 wide, top 0.01 proud
  const kerbOff = width / 2 + 0.02; // kerb centreline (straddles the slab edge)

  const MAX_SLOPE = 0.5 / 1.2; // RCT2 sloped path: one height step per tile

  // ---- RAMP infrastructure (nodeY / [x, z, elevation] heights) --------------
  const padTop = H + 0.006; // the pads' finished level — RAMP surfaces run at it
  const RTH = H + 0.026; // ramp ribbon/wedge thickness == pad box height
  // unit direction + signed out-grade of every SLOPED edge at each node
  const nodeSlopes: { ex: number; ez: number; s: number }[][] = nodes.map(() => []);
  edges.forEach(([ai, bi]) => {
    const dy = yOf(bi) - yOf(ai);
    if (Math.abs(dy) <= 1e-6) return;
    const [ax, az] = nodes[ai];
    const [bx, bz] = nodes[bi];
    const len = Math.hypot(bx - ax, bz - az) || 1;
    nodeSlopes[ai].push({ ex: (bx - ax) / len, ez: (bz - az) / len, s: dy / len });
    nodeSlopes[bi].push({ ex: (ax - bx) / len, ez: (az - bz) / len, s: -dy / len });
  });
  // a node INSIDE a straight constant-grade run: exactly two sloped edges,
  // opposite directions, continuous grade — it gets NO pad, the ramp ribbons
  // run straight through it (an RCT2 slope has no mid-slope landing)
  const isMidSlope = (ni: number) => {
    const s = nodeSlopes[ni];
    return (
      degree[ni] === 2 &&
      s.length === 2 &&
      s[0].ex * s[1].ex + s[0].ez * s[1].ez < -0.99 &&
      Math.abs(s[0].s + s[1].s) < 1e-4
    );
  };
  // knuckle-pad surface height at a local offset from the node centre: the
  // pad is flat at the node's own level and BEVELS toward each sloped edge
  // along that edge's grade, capping the ramp flush (no step, no overhang)
  const padSurfAt = (ni: number, lx: number, lz: number) => {
    let h = yOf(ni) + padTop;
    nodeSlopes[ni].forEach(({ ex, ez, s }) => {
      const d = lx * ex + lz * ez;
      if (d > 0) h += s * d;
    });
    return h;
  };
  // tilted-box spec whose TOP face lies `proud` above the inclined plane
  // through (cx, cy, cz) — pitch uses the segM convention (-atan2(rise, run))
  const onPlane = (
    specs: MergedBoxSpec[],
    dims: [number, number, number],
    cx: number,
    cy: number,
    cz: number,
    yaw: number,
    pitch: number,
    proud: number,
    repeat?: [number, number],
  ) => {
    const eul = new t.Euler(pitch, yaw, 0, 'YXZ');
    const m = new t.Matrix4().makeRotationFromEuler(eul);
    const n = new t.Vector3(0, 1, 0).applyEuler(eul);
    const off = proud - dims[1] / 2;
    m.setPosition(cx + n.x * off, cy + n.y * off, cz + n.z * off);
    if (repeat) specs.push({ dims, matrix: m, repeat });
    else specs.push({ dims, matrix: m });
  };

  // ---- ramping lint (part of the grid-lint pass composed parks run) --------
  if (nodeYArr && nodeYArr.some((v) => Math.abs(v ?? 0) > 1e-6)) {
    // RCT2 sloped paths run STRAIGHT — slopes meeting at an angle warn
    nodes.forEach((_, ni) => {
      const s = nodeSlopes[ni];
      for (let i = 0; i < s.length; i++)
        for (let j = i + 1; j < s.length; j++)
          if (Math.abs(s[i].ex * s[j].ex + s[i].ez * s[j].ez) < 0.99)
            console.warn(`ramp lint: node ${ni} joins sloped edges at an angle — RCT2 sloped paths run straight (expect a rough knuckle)`);
    });
    // every elevated node needs a WALKABLE-grade route down to the ground
    // network (guests can't climb steeper than one height step per tile)
    const walkOk = edges.map(([ai, bi]) => {
      const [ax, az] = nodes[ai];
      const [bx, bz] = nodes[bi];
      const len = Math.hypot(bx - ax, bz - az);
      return Math.abs(yOf(bi) - yOf(ai)) / Math.max(len, 1e-6) <= MAX_SLOPE + 1e-6;
    });
    const reached = nodes.map((_, ni) => Math.abs(nodeYArr[ni] ?? 0) <= 0.05);
    const stack = nodes.map((_, i) => i).filter((i) => reached[i]);
    while (stack.length) {
      const cur = stack.pop()!;
      edges.forEach(([ai, bi], ei) => {
        if (!walkOk[ei]) return;
        const other = ai === cur ? bi : bi === cur ? ai : -1;
        if (other >= 0 && !reached[other]) {
          reached[other] = true;
          stack.push(other);
        }
      });
    }
    reached.forEach((ok, ni) => {
      if (!ok)
        console.warn(
          `ramp lint: elevated node ${ni} (+${(nodeYArr[ni] ?? 0).toFixed(2)}) has no walkable-grade connection to the ground network — deck unreachable (ramp at most 0.5 rise per 1.2 tile)`,
        );
    });
  }

  edges.forEach(([ai, bi], ei) => {
    const [ax, az] = nodes[ai];
    const [bx, bz] = nodes[bi];
    const dx = bx - ax;
    const dz = bz - az;
    const dy = yOf(bi) - yOf(ai); // rise (0 on flat networks)
    const len = Math.hypot(dx, dz);
    const slopeLen = Math.hypot(len, dy); // == len when flat
    const sloped = Math.abs(dy) > 1e-6;
    lengths.push(slopeLen);
    if (sloped && Math.abs(dy) / Math.max(len, 1e-6) > MAX_SLOPE + 1e-6)
      console.warn(
        `ramp lint: edge ${ei} (node ${ai} -> ${bi}) grade ${(Math.abs(dy) / Math.max(len, 1e-6)).toFixed(2)} exceeds the walkable max ~0.42 — RCT2 ramps one height step per tile (0.5 rise per 1.2 run)`,
      );
    // per-edge slab thickness jitter (1.5–4.5mm) — overlapping slabs at shared
    // nodes are never coplanar, so junction joins can't z-fight. RAMPS are the
    // exception: their surface is the pads' exact finished level (padTop) so
    // colinear ribbons and knuckle bevels join seamlessly.
    const He = H + 0.0015 + 0.003 * hash01(ei * 17 + 5);
    tops.push(sloped ? padTop : He);
    // the old per-edge `seg` group transform (yaw about y, then pitch about
    // the yawed local x), precomposed so slab/kerb/seam boxes can be merged
    const segM = new t.Matrix4().makeRotationFromEuler(
      new t.Euler(-Math.atan2(dy, len), Math.atan2(dx, dz), 0, 'YXZ'),
    );
    segM.setPosition((ax + bx) / 2, (yOf(ai) + yOf(bi)) / 2, (az + bz) / 2);
    const inSeg = (lx: number, ly: number, lz: number) => new t.Matrix4().makeTranslation(lx, ly, lz).premultiply(segM);
    if (!sloped) {
      // flat tarmac slab (carried 0.02 below grade). At a knuckle node whose
      // ramp runs PERPENDICULAR to this edge the slab stops at the pad edge —
      // the knuckle pad's bevel owns that ground, a full-length slab would
      // poke up through the descending wedge.
      const uxF = dx / (len || 1);
      const uzF = dz / (len || 1);
      const perpTrim = (ni: number) => (nodeSlopes[ni].some(({ ex, ez }) => Math.abs(ex * uxF + ez * uzF) < 0.71) ? sq / 2 : 0);
      const tA = perpTrim(ai);
      const tB = perpTrim(bi);
      const slabLen = slopeLen - tA - tB;
      const slabTh = He + 0.02;
      if (slabLen > 0.02)
        paveSpecs.push({ dims: [width, slabTh, slabLen], matrix: inSeg(0, He - slabTh / 2, (tA - tB) / 2), repeat: [4, Math.max(2, Math.round(slabLen * 3.3))] });
    }
    // maps a local-z position on the slab to the world xz under it
    const worldAt = (zz: number, lateral: number): [number, number] => {
      const u = 0.5 + zz / slopeLen;
      return [ax + dx * u + (lateral * dz) / (len || 1), az + dz * u - (lateral * dx) / (len || 1)];
    };
    const crossesPlaza =
      plazas.length > 0 &&
      Array.from({ length: 9 }, (_, s) => s / 8).some((u) => insidePlaza(ax + dx * u, az + dz * u));
    if (!sloped) {
      // pale kerb strips down both sides — trimmed to butt exactly against the
      // node pads' kerb corner blocks (which sit at kerbOff ± KW/2 from a node).
      // Edges touching a plaza lay the kerb in short segments instead, skipping
      // pieces inside the plaza (center tiles carry no internal kerb).
      const kerbLen = slopeLen - width - 0.12;
      if (kerbLen > 0.15) {
        [-1, 1].forEach((s) => {
          if (!crossesPlaza) {
            kerbSpecs.push({ dims: [KW, He + 0.03, kerbLen], matrix: inSeg(s * kerbOff, (He + 0.01) / 2 - 0.01, 0), repeat: [1, Math.max(2, Math.round(kerbLen * 3.3))] });
            return;
          }
          const n = Math.max(1, Math.round(kerbLen / 0.3));
          const pl = kerbLen / n;
          for (let k = 0; k < n; k++) {
            const zz = -kerbLen / 2 + pl * (k + 0.5);
            const [wx, wz] = worldAt(zz, s * kerbOff);
            if (insidePlaza(wx, wz)) continue;
            kerbSpecs.push({ dims: [KW, He + 0.03, pl - 0.02], matrix: inSeg(s * kerbOff, (He + 0.01) / 2 - 0.01, zz), repeat: [1, 2] });
          }
        });
      }
      // expansion-joint seams every half tile (clear of the junction pads and
      // suppressed under plazas so the plaza surface reads as one level)
      for (let zz = -slopeLen / 2 + 0.7; zz <= slopeLen / 2 - 0.7; zz += 0.5) {
        const [wx, wz] = worldAt(zz, 0);
        if (insidePlaza(wx, wz)) continue;
        seamSpecs.push({ dims: [width, 0.012, 0.02], matrix: inSeg(0, He + 0.003, zz) });
      }
    } else if (len > 1e-6) {
      // ---- RAMP: a flat inclined RIBBON at constant grade -----------------
      // The walking surface is ONE tilted plane through both node centres at
      // the pads' finished level (padTop). It spans between the knuckle pads
      // (which bevel toward it — see the node loop) and runs straight through
      // pad-less mid-slope nodes, so every joint shares exact edge heights:
      // no steps, gaps or overhangs, and never a solid berm/wedge under the
      // walkway (grounded ramps get an earth berm from bermNetToGround
      // UNDERNEATH the ribbon; airborne ones ride the wooden scaffolds).
      const ux = dx / len;
      const uz = dz / len;
      const grade = dy / len;
      const yawE = Math.atan2(dx, dz);
      const pitchE = -Math.atan2(dy, len);
      const secS = slopeLen / len; // slope length per unit of horizontal run
      const trimA = isMidSlope(ai) ? 0 : sq / 2;
      const trimB = isMidSlope(bi) ? 0 : sq / 2;
      const ribLen = (len - trimA - trimB) * secS;
      // world point ON the surface plane, `h` horizontal units from the edge
      // midpoint (+ toward b), `lat` lateral units to the left of travel
      const onSurf = (h: number, lat: number): [number, number, number] => [
        (ax + bx) / 2 + ux * h + uz * lat,
        (yOf(ai) + yOf(bi)) / 2 + padTop + grade * h,
        (az + bz) / 2 + uz * h - ux * lat,
      ];
      const hMid = (trimA - trimB) / 2; // ribbon centre (horizontal units)
      if (ribLen > 0.02) {
        const [rx, ry, rz] = onSurf(hMid, 0);
        onPlane(paveSpecs, [width, RTH, ribLen], rx, ry, rz, yawE, pitchE, 0, [4, Math.max(2, Math.round(ribLen * 3.3))]);
        // kerbs follow the grade down both sides, butting the pads' corners
        const kerbLen = ribLen - 0.12;
        if (kerbLen > 0.15)
          [-1, 1].forEach((s) => {
            const [kx, ky, kz] = onSurf(hMid, s * kerbOff);
            onPlane(kerbSpecs, [KW, RTH + 0.01, kerbLen], kx, ky, kz, yawE, pitchE, 0.01, [1, Math.max(2, Math.round(kerbLen * 3.3))]);
          });
        // expansion seams every half tile ON the incline
        for (let d = -ribLen / 2 + 0.35; d <= ribLen / 2 - 0.35; d += 0.5) {
          const [sx2, sy2, sz2] = onSurf(hMid + d / secS, 0);
          onPlane(seamSpecs, [width, 0.012, 0.02], sx2, sy2, sz2, yawE, pitchE, 0.004);
        }
        // RCT2 slope-transition trim: a kerb-coloured strip flush ON the
        // plane at each ribbon end that meets a KNUCKLE pad (the joint where
        // grade meets level) — never mid-run at a pad-less mid-slope node
        [-1, 1].forEach((e) => {
          if ((e < 0 ? trimA : trimB) <= 0) return;
          const [tx2, ty2, tz2] = onSurf(hMid + (e * (ribLen / 2 - 0.09)) / secS, 0);
          onPlane(kerbSpecs, [width, 0.024, 0.13], tx2, ty2, tz2, yawE, pitchE, 0.008);
        });
      }
    }
    // path supports (RCT2 Paint.Path.cpp: a path whose base sits above the
    // surface gets support columns). ONE bay per ~1.2 tile along the span:
    // lifts above SCAFFOLD_LIFT get a wooden scaffold bay dropped to the
    // REAL ground (posts + rungs + alternating diagonals — sloped ramp spans
    // included, like RCT2's slope-transition support pieces); shallow raised
    // FLAT spans (0.12 .. SCAFFOLD_LIFT) keep the low concrete mid-span pier.
    {
      const inv = 1 / (len || 1);
      const bays = Math.max(1, Math.round(slopeLen / 1.2));
      for (let k = 0; k < bays; k++) {
        const u = (k + 0.5) / bays;
        const wx = ax + dx * u;
        const wz = az + dz * u;
        const sy = yOf(ai) + dy * u; // slab base level at this sample
        const gy = opts.groundAt ? opts.groundAt(wx, wz) : y;
        const lift = sy - gy;
        if (lift > SCAFFOLD_LIFT) {
          scaffoldBay(t, woodSpecs, wx, wz, dz * inv, -dx * inv, width / 2 - 0.12, sy + 0.02, gy, ei * 131 + k * 17);
        } else if (lift > 0.12 && (sloped ? true : sy - y > 0.12 && slopeLen > 0.9 && k === (bays - 1) >> 1)) {
          // low concrete pier: mid-span on shallow raised FLAT spans, every
          // bay along the shallow stretch of a grounded RAMP (the thin
          // inclined ribbon never carries a buried wedge any more)
          pierSpecs.push({ dims: [0.16, lift + 0.02, 0.16], pos: [wx, gy + (lift + 0.02) / 2 - 0.02, wz], repeat: [1, 2] });
        }
      }
    }
  });

  // plaza center tiles — flush asphalt grid, everything at ONE level (no
  // per-tile jitter), kerb ONLY around the outer boundary with openings where
  // path edges cross, plus the four RCT2 kerb corner blocks
  const distToAnyEdge = (px: number, pz: number) => {
    let best = Infinity;
    edges.forEach(([a, b]) => {
      const [x1, z1] = nodes[a];
      const [x2, z2] = nodes[b];
      const ex = x2 - x1;
      const ez = z2 - z1;
      const L2 = ex * ex + ez * ez || 1;
      const tt = Math.max(0, Math.min(1, ((px - x1) * ex + (pz - z1) * ez) / L2));
      best = Math.min(best, Math.hypot(px - (x1 + ex * tt), pz - (z1 + ez * tt)));
    });
    return best;
  };
  const nodeKerbHP = H + 0.016; // shared with node pads below
  plazas.forEach(([cx, cz, w, d]) => {
    const cols = Math.max(1, Math.round(w / width));
    const rows = Math.max(1, Math.round(d / width));
    const tw = w / cols;
    const td = d / rows;
    for (let i = 0; i < cols; i++)
      for (let j = 0; j < rows; j++) {
        const tx = cx - w / 2 + tw * (i + 0.5);
        const tz = cz - d / 2 + td * (j + 0.5);
        paveSpecs.push({ dims: [tw, plazaTop + 0.02, td], pos: [tx, y + plazaTop / 2 - 0.01, tz], repeat: [4, 4] });
      }
    // boundary kerb, one segment per tile, skipped where a path edge enters
    const kerbCyP = y + nodeKerbHP / 2 - 0.01;
    for (let i = 0; i < cols; i++) {
      const tx = cx - w / 2 + tw * (i + 0.5);
      [-1, 1].forEach((s) => {
        const kz = cz + s * (d / 2 + 0.02);
        if (distToAnyEdge(tx, kz) < width / 2 + 0.01) return; // path opening
        kerbSpecs.push({ dims: [tw - 0.01, nodeKerbHP + 0.02, KW], pos: [tx, kerbCyP, kz], repeat: [1, 2] });
      });
    }
    for (let j = 0; j < rows; j++) {
      const tz = cz - d / 2 + td * (j + 0.5);
      [-1, 1].forEach((s) => {
        const kx = cx + s * (w / 2 + 0.02);
        if (distToAnyEdge(kx, tz) < width / 2 + 0.01) return; // path opening
        kerbSpecs.push({ dims: [KW, nodeKerbHP + 0.02, td - 0.01], pos: [kx, kerbCyP, tz], repeat: [1, 2] });
      });
    }
    [-1, 1].forEach((sx) =>
      [-1, 1].forEach((sz) =>
        kerbSpecs.push({ dims: [KW, nodeKerbHP + 0.02, KW], pos: [cx + sx * (w / 2 + 0.02), kerbCyP, cz + sz * (d / 2 + 0.02)] }),
      ),
    );
  });

  // SQUARE junction pads at every node, RCT2 tile-configuration style. The
  // pad top (H + 6mm) sits just above every jittered slab top (max H + 4.5mm):
  // overlapping joins with no air seams and no coplanar z-fighting. Kerb trim
  // is placed ONLY on the pad's FREE cardinal sides (no incident edge within
  // 45° of the side normal), plus the four kerb corner blocks that RCT2 keeps
  // even on a cross tile — connected sides stay open so the tarmac continues.
  const NORMALS: [number, number][] = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ];
  const nodeKerbH = H + 0.016; // top 0.01 proud of the pad top (H + 0.006)
  nodes.forEach((node, ni) => {
    const [nx, nz] = node;
    // nodes inside a plaza are part of the ONE plaza surface: no junction pad,
    // no kerbs, no furniture (RCT2 center tiles are open on all four sides)
    if (insidePlaza(nx, nz)) return;
    const yn = yOf(ni); // pad/kerbs/furniture at this node's own height
    const slopes = nodeSlopes[ni];
    if (isMidSlope(ni)) {
      // inside a straight constant-grade run: NO pad — the two ramp ribbons
      // are one continuous plane through this node. Just support the joint.
      const gy = opts.groundAt ? opts.groundAt(nx, nz) : y;
      const lift = yn - gy;
      const { ex, ez } = slopes[0];
      if (lift > SCAFFOLD_LIFT) scaffoldBay(t, woodSpecs, nx, nz, ez, -ex, width / 2 - 0.12, yn + 0.02, gy, ni * 37 + 7);
      else if (lift > 0.12) pierSpecs.push({ dims: [0.16, lift + 0.02, 0.16], pos: [nx, gy + (lift + 0.02) / 2 - 0.02, nz], repeat: [1, 2] });
      return;
    }
    if (slopes.length === 0) {
      paveSpecs.push({ dims: [sq, H + 0.026, sq], pos: [nx, yn + (H + 0.006) / 2 - 0.01, nz], repeat: [4, 4] });
    } else {
      // KNUCKLE pad: flat at the node's own level, BEVELLED toward each
      // sloped edge so the pad cleanly caps the grade — the flat part covers
      // the level connections, and a tilted wedge (coplanar with the ramp
      // ribbon, same thickness) carries the surface from the node centre to
      // the pad edge where the ribbon takes over. Flush everywhere.
      let epx = sq / 2;
      let enx = sq / 2;
      let epz = sq / 2;
      let enz = sq / 2;
      slopes.forEach(({ ex, ez }) => {
        if (ex > 0.7) epx = 0;
        else if (ex < -0.7) enx = 0;
        else if (ez > 0.7) epz = 0;
        else if (ez < -0.7) enz = 0;
      });
      const fw = epx + enx;
      const fd = epz + enz;
      if (fw > 0.02 && fd > 0.02)
        paveSpecs.push({ dims: [fw, H + 0.026, fd], pos: [nx + (epx - enx) / 2, yn + (H + 0.006) / 2 - 0.01, nz + (epz - enz) / 2], repeat: [4, 4] });
      slopes.forEach(({ ex, ez, s }) => {
        if (Math.abs(ex) > 0.01 && Math.abs(ez) > 0.01) return; // diagonal ramp — grid lint already warned
        const run = sq / 2;
        const wLen = Math.hypot(run, s * run);
        onPlane(
          paveSpecs,
          [sq, RTH, wLen],
          nx + (ex * run) / 2,
          yn + padTop + (s * run) / 2,
          nz + (ez * run) / 2,
          Math.atan2(ex, ez),
          -Math.atan2(s, 1),
          0,
          [4, 2],
        );
      });
    }
    // support under a raised pad, to the REAL ground: a four-post wooden
    // scaffold tower above SCAFFOLD_LIFT (RCT2 wooden path supports), the
    // low concrete pier below it. A knuckle pad's tower rises to its LOWEST
    // bevel corner, then per-corner topping posts meet each corner's own
    // underside (never poking through a descending wedge).
    {
      const gy = opts.groundAt ? opts.groundAt(nx, nz) : y;
      const lift = yn - gy;
      if (lift > SCAFFOLD_LIFT) {
        if (slopes.length === 0) scaffoldTower(t, woodSpecs, nx, nz, sq, sq, yn + 0.02, gy, { seed: ni * 29 + 11 });
        else {
          const hp = sq / 2 - 0.08;
          const corners: [number, number][] = [
            [-1, -1],
            [1, -1],
            [-1, 1],
            [1, 1],
          ];
          const cs = corners.map(([sx, sz]) => padSurfAt(ni, sx * hp, sz * hp));
          const base = Math.min(...cs) - RTH + 0.02;
          scaffoldTower(t, woodSpecs, nx, nz, sq, sq, base, gy, { seed: ni * 29 + 11 });
          corners.forEach(([sx, sz], k) => {
            const top = cs[k] - RTH + 0.03;
            if (top - base > 0.015)
              woodSpecs.push({ dims: [0.075, top - base + 0.02, 0.075], pos: [nx + sx * hp, (top + base - 0.02) / 2, nz + sz * hp] });
          });
        }
      } else if (lift > 0.12) pierSpecs.push({ dims: [0.2, lift + 0.02, 0.2], pos: [nx, gy + (lift + 0.02) / 2 - 0.02, nz], repeat: [1, 2] });
    }

    // incident edge unit directions (away from this node), for side tests +
    // furniture placement
    const dirs: [number, number][] = [];
    edges.forEach(([ai, bi]) => {
      if (ai !== ni && bi !== ni) return;
      const [ox, oz] = nodes[ai === ni ? bi : ai];
      const L = Math.hypot(ox - nx, oz - nz) || 1;
      dirs.push([(ox - nx) / L, (oz - nz) / L]);
    });

    // kerb strip on each free side (RCT2 edge trim where no path continues).
    // On a knuckle pad the strip follows the SURFACE: split into two halves —
    // flat over the flat part, tilted (coplanar with the bevel wedge) over a
    // graded half — so ramp-side kerbs never float or sink.
    const kerbCy = yn + nodeKerbH / 2 - 0.01;
    NORMALS.forEach(([ux, uz]) => {
      const connected = dirs.some(([ex, ez]) => ex * ux + ez * uz >= 0.707);
      if (connected) return;
      if (slopes.length === 0) {
        kerbSpecs.push({
          dims: [Math.abs(ux) > 0 ? KW : width - 0.04, nodeKerbH + 0.02, Math.abs(ux) > 0 ? width - 0.04 : KW],
          pos: [nx + ux * kerbOff, kerbCy, nz + uz * kerbOff],
          repeat: [1, 4],
        });
        return;
      }
      const tx = uz; // tangent along the side
      const tz = -ux;
      const L2 = (width - 0.04) / 2;
      [-1, 1].forEach((sgn) => {
        const st = slopes.find(({ ex, ez }) => ex * tx * sgn + ez * tz * sgn > 0.7);
        const mx = nx + ux * kerbOff + (tx * sgn * L2) / 2;
        const mz = nz + uz * kerbOff + (tz * sgn * L2) / 2;
        if (!st) {
          kerbSpecs.push({
            dims: [Math.abs(tx) > 0 ? L2 - 0.01 : KW, nodeKerbH + 0.02, Math.abs(tx) > 0 ? KW : L2 - 0.01],
            pos: [mx, kerbCy, mz],
            repeat: [1, 2],
          });
        } else {
          const wl = Math.hypot(L2, st.s * L2);
          onPlane(kerbSpecs, [KW, RTH + 0.01, wl], mx, yn + padTop + (st.s * L2) / 2, mz, Math.atan2(tx * sgn, tz * sgn), -Math.atan2(st.s, 1), 0.01, [1, 2]);
        }
      });
    });
    // the four kerb corner blocks — present in EVERY RCT2 path configuration.
    // On a knuckle pad each block is planted on the LOCAL bevel surface.
    [-1, 1].forEach((sx) =>
      [-1, 1].forEach((sz) => {
        if (slopes.length === 0) {
          kerbSpecs.push({ dims: [KW, nodeKerbH + 0.02, KW], pos: [nx + sx * kerbOff, kerbCy, nz + sz * kerbOff] });
        } else {
          const hc = padSurfAt(ni, sx * kerbOff, sz * kerbOff);
          kerbSpecs.push({ dims: [KW, 0.13, KW], pos: [nx + sx * kerbOff, hc + 0.01 - 0.065, nz + sz * kerbOff] });
        }
      }),
    );

    // furniture goes in the WIDEST angular gap between the approaches —
    // deterministic and always clear of every slab; bases stand on the REAL
    // ground beside the path (groundAt), sunk 0.02 so they never hover
    let a: number;
    if (dirs.length === 0) a = hash01(ni * 17 + 3) * Math.PI * 2;
    else {
      const angles = dirs.map(([ex, ez]) => Math.atan2(ez, ex)).sort((p, q) => p - q);
      let bestGap = -1;
      let bestMid = 0;
      for (let k = 0; k < angles.length; k++) {
        const a0 = angles[k];
        const a1 = k + 1 < angles.length ? angles[k + 1] : angles[0] + Math.PI * 2;
        if (a1 - a0 > bestGap) {
          bestGap = a1 - a0;
          bestMid = (a0 + a1) / 2;
        }
      }
      a = bestMid;
    }
    const fx = nx + Math.cos(a) * (width * 0.85 + 0.25);
    const fz = nz + Math.sin(a) * (width * 0.85 + 0.25);
    const fy = opts.groundAt ? opts.groundAt(fx, fz) : yn;
    if (yn - fy > 0.6) return; // verge drops away too far — skip the furniture
    if (degree[ni] >= 3) {
      // lamp post at junctions (RCT2 park lamp: dark pole, warm glowing head)
      group.add(cyl(t, 0.05, 0.07, 0.1, 0x3c4450, [fx, fy + 0.03, fz], { metal: 0.4, rough: 0.5, seg: 10 }));
      group.add(cyl(t, 0.022, 0.028, 0.94, 0x3c4450, [fx, fy + 0.54, fz], { tex: 'metal', metal: 0.5, rough: 0.4, seg: 8 }));
      group.add(box(t, [0.12, 0.05, 0.12], 0x3c4450, [fx, fy + 1.03, fz], { metal: 0.4, rough: 0.5 }));
      const head = ball(t, 0.055, 0xffe9a8, [fx, fy + 0.98, fz], { emissive: 0x8a6c20, rough: 0.4 });
      group.add(head);
      lampHeadMats.push(head.material as THREE.MeshStandardMaterial);
      if (lampLights.length < MAX_LAMP_LIGHTS) {
        const pl = new t.PointLight(0xffd98c, 0, 2.4, 2); // off by day, raised at night
        pl.position.set(fx, fy + 0.96, fz);
        group.add(pl);
        lampLights.push(pl);
      }
    } else if (degree[ni] === 1) {
      // litter bin at dead ends (RCT2 black bin with dome lid)
      group.add(cyl(t, 0.09, 0.08, 0.26, 0x24282c, [fx, fy + 0.11, fz], { tex: 'metal', repeat: [4, 1], metal: 0.3, rough: 0.6, seg: 12 }));
      group.add(cyl(t, 0.02, 0.095, 0.06, 0x24282c, [fx, fy + 0.27, fz], { metal: 0.3, rough: 0.6, seg: 12 }));
    }
  });

  // merge every static bucket into one mesh each (see note at the top)
  if (paveSpecs.length) group.add(mergedBoxes(t, paveSpecs, PAVE, { tex: 'asphalt', rough: 0.95, bump: 0.03 }));
  if (kerbSpecs.length) group.add(mergedBoxes(t, kerbSpecs, KERB, { tex: 'concrete', rough: 0.9 }));
  if (seamSpecs.length) group.add(mergedBoxes(t, seamSpecs, SEAM, { rough: 1 }));
  if (pierSpecs.length) group.add(mergedBoxes(t, pierSpecs, 0x8b8b83, { tex: 'concrete', rough: 0.95 }));
  if (woodSpecs.length) group.add(mergedBoxes(t, woodSpecs, SCAFFOLD_WOOD, { tex: 'wood', rough: 0.85 }));

  const pointAt = (edgeIndex: number, u: number) => {
    const [ai, bi] = edges[edgeIndex];
    const [ax, az] = nodes[ai];
    const [bx, bz] = nodes[bi];
    const x = ax + (bx - ax) * u;
    const z = az + (bz - az) * u;
    // exact top of THIS edge's slab, so walkers' feet meet the surface —
    // height lerps along inclined edges (walkers climb ramps automatically),
    // and inside a plaza the (higher) one-level plaza surface wins
    let h = yOf(ai) + (yOf(bi) - yOf(ai)) * u + tops[edgeIndex];
    if (insidePlaza(x, z)) h = Math.max(h, y + plazaTop);
    return new t.Vector3(x, h, z);
  };
  const edgeLength = (edgeIndex: number) => lengths[edgeIndex];

  // WALKING-SURFACE sampler: the path surface height anywhere ON the network
  // — mid-ramp included (heights lerp along inclined edges) — falling back to
  // the base path level (y + H) off-network. Guests/walkers set their feet
  // with this so they climb ramps instead of gliding at one flat laneY.
  // Live view: routing.attach() pushes logical spur nodes/edges into the SAME
  // arrays, so attached stall fronts and queue tails sample correctly too.
  const flatWalkY = y + H;
  const walkYAt = (x: number, z: number) => {
    let best = flatWalkY;
    let bestD = width / 2 + 0.45; // corridor half-width + shoulder slack
    for (let ei = 0; ei < edges.length; ei++) {
      const [ea, eb] = edges[ei];
      const [ax2, az2] = nodes[ea];
      const [bx2, bz2] = nodes[eb];
      const ex2 = bx2 - ax2;
      const ez2 = bz2 - az2;
      const L2 = ex2 * ex2 + ez2 * ez2 || 1;
      const u = Math.max(0, Math.min(1, ((x - ax2) * ex2 + (z - az2) * ez2) / L2));
      const d = Math.hypot(x - (ax2 + ex2 * u), z - (az2 + ez2 * u));
      if (d < bestD) {
        bestD = d;
        best = yOf(ea) + (yOf(eb) - yOf(ea)) * u + H;
      }
    }
    // node pads (covers elevated pads + stall fronts standing just beside
    // one) — an on-corridor edge sample always wins over a nearby pad, so
    // mid-ramp heights never snap to the knuckle's level early
    for (let ni = 0; ni < nodes.length; ni++) {
      const d = Math.max(0, Math.hypot(x - nodes[ni][0], z - nodes[ni][1]) - sq / 2);
      if (d < bestD - 1e-9) {
        bestD = d;
        best = yOf(ni) + H;
      }
    }
    if (insidePlaza(x, z)) best = Math.max(best, y + plazaTop);
    return best;
  };

  // OPTIONAL per-frame hook — gates lamp-head glow by the Stage's day/night
  // cycle (nightKOf returns 0 when the network isn't mounted under a Stage,
  // so a static/unmounted network simply keeps the faint daytime look).
  const update = (_time: number) => {
    const k = nightKOf(group);
    const ease = k * k * (3 - 2 * k); // smoothstep
    const emiss = 0.15 + (1.5 - 0.15) * ease; // faint glass tint by day -> warm glow at night
    lampHeadMats.forEach((m) => (m.emissiveIntensity = emiss));
    lampLights.forEach((pl) => (pl.intensity = ease * 0.85));
  };

  return { group, pointAt, edgeLength, walkYAt, nodes, edges, update };
}

// ---------------------------------------------------------------------------
// ROUTING — an RCT2-style movement layer over the same {nodes, edges} graph.
// Guests in RCT2 travel tile-by-tile along path edges (GuestPathfinding.cpp:202,
// Peep.cpp:295). Aimless wander keeps a 50% straight bias and never reverses
// except at dead ends (GuestPathfinding.cpp:535,1926). Goal-seeking is a greedy
// distance-scored search with a memory of the last 4 thin junctions so recently
// tried edges are avoided (GuestPathfinding.cpp:628,1300). Deterministic — no
// Math.random, no Date.now.

export interface RouteNet {
  nodes: PathNode[]; // [x, z] or [x, z, elevation] — routing itself stays 2D
  edges: [number, number][];
}

export interface RoutingOpts {
  /**
   * BLOCKER GATE (additive): return false for an edge whose span is inside a
   * solid obstacle (GameManager's blocker registry: fountains, ride bodies,
   * fences). `route` then plans AROUND such edges and `wanderNext` never
   * strolls into one. Both fall back to the unfiltered graph when the filter
   * would leave a guest with nowhere to go, so a badly fenced layout degrades
   * to the old behaviour instead of deadlocking (validatePark fails it
   * loudly). Called often — keep it cheap/cached. Omitted = no gate, the
   * classic behaviour.
   */
  edgeAllowed?: (a: number, b: number) => boolean;
}

export interface Routing {
  /** adjacency[nodeIdx] = neighbour node idxs (live — attach() extends it) */
  adjacency: number[][];
  /** edge index joining nodes a and b (either direction), or -1 */
  edgeBetween(a: number, b: number): number;
  /** node index closest to (x, z) */
  nearestNode(x: number, z: number): number;
  /** greedy best-first node path from -> to incl. endpoints; `memory` holds the
   *  last-4 junction node idxs to deprioritize (visited-last, never blocked);
   *  [] if unreachable */
  route(from: number, to: number, memory?: number[]): number[];
  /** aimless-wander step: 50% bias toward the straightest continuation of the
   *  prev->at heading, never back to prevNode unless atNode is a dead end */
  wanderNext(prevNode: number, atNode: number, seed: number): number;
  /** register an off-network attachment (queue tail, stall front): pushes a new
   *  node [x, z] + a LOGICAL edge to the nearest existing node into the SAME
   *  arrays the Routing was built from (updating adjacency) — no visual slab is
   *  added; callers wanting a visible spur add it before building the mesh */
  attach(x: number, z: number): { node: number; x: number; z: number };
}

/** xz interpolation between nodes a and b at parameter u (0 = a, 1 = b) */
export function posOnPath(net: RouteNet, a: number, b: number, u: number): [number, number] {
  const [ax, az] = net.nodes[a];
  const [bx, bz] = net.nodes[b];
  return [ax + (bx - ax) * u, az + (bz - az) * u];
}

export function buildRouting(net: RouteNet, opts: RoutingOpts = {}): Routing {
  const { nodes, edges } = net; // shared references — attach() mutates in place
  const allowed = opts.edgeAllowed;

  const adjacency: number[][] = nodes.map(() => []);
  edges.forEach(([a, b]) => {
    adjacency[a].push(b);
    adjacency[b].push(a);
  });

  const edgeBetween = (a: number, b: number) => {
    for (let ei = 0; ei < edges.length; ei++) {
      const [ea, eb] = edges[ei];
      if ((ea === a && eb === b) || (ea === b && eb === a)) return ei;
    }
    return -1;
  };

  const nearestNode = (x: number, z: number) => {
    let best = 0;
    let bestD = Infinity;
    for (let ni = 0; ni < nodes.length; ni++) {
      const d = (nodes[ni][0] - x) ** 2 + (nodes[ni][1] - z) ** 2;
      if (d < bestD) {
        bestD = d;
        best = ni;
      }
    }
    return best;
  };

  const dist = (a: number, b: number) => Math.hypot(nodes[a][0] - nodes[b][0], nodes[a][1] - nodes[b][1]);

  // Greedy best-first, scored by Euclidean distance to the goal (RCT2's
  // dx + dy + 2dz heuristic without z). Nodes in `memory` (the guest's last-4
  // thin junctions) take a large score penalty so they are expanded LAST,
  // never hard-blocked — a visited set guarantees termination.
  const search = (from: number, to: number, memory: number[], gate: ((a: number, b: number) => boolean) | undefined) => {
    if (from === to) return [from];
    const MEM_PENALTY = 1e6;
    const score = (n: number) => dist(n, to) + (memory.includes(n) ? MEM_PENALTY : 0);
    const visited = new Set<number>([from]);
    const parent = new Map<number, number>();
    // open list kept sorted by (score, nodeIdx) — pop lowest; deterministic
    const open: number[] = [from];
    while (open.length > 0) {
      let pick = 0;
      for (let i = 1; i < open.length; i++) {
        const si = score(open[i]);
        const sp = score(open[pick]);
        if (si < sp || (si === sp && open[i] < open[pick])) pick = i;
      }
      const cur = open.splice(pick, 1)[0];
      if (cur === to) {
        const path = [to];
        let n = to;
        while (n !== from) {
          n = parent.get(n)!;
          path.push(n);
        }
        return path.reverse();
      }
      for (const nb of adjacency[cur]) {
        if (visited.has(nb)) continue;
        if (gate && !gate(cur, nb)) continue; // edge sits inside a blocker
        visited.add(nb);
        parent.set(nb, cur);
        open.push(nb);
      }
    }
    return []; // unreachable
  };

  // blocker-aware first, classic graph as the FALLBACK: a route that only
  // exists through a blocked edge is still walked (never deadlock the sim —
  // validatePark fails the layout instead)
  const route = (from: number, to: number, memory: number[] = []) => {
    if (allowed) {
      const p = search(from, to, memory, allowed);
      if (p.length) return p;
    }
    return search(from, to, memory, undefined);
  };

  // Wander: among neighbours != prevNode pick the straightest continuation of
  // the prev->at heading with probability 0.5 (hashed sine of `seed`), else a
  // hashed uniform choice. Dead ends (only prev available) turn back.
  const wanderNext = (prevNode: number, atNode: number, seed: number) => {
    let candidates = adjacency[atNode].filter((n) => n !== prevNode);
    if (allowed) {
      // never stroll into a blocker; keep the unfiltered set when EVERY
      // continuation is blocked (turning back is handled below)
      const open = candidates.filter((n) => allowed(atNode, n));
      if (open.length) candidates = open;
    }
    if (candidates.length === 0) return prevNode; // dead end — reverse allowed
    if (candidates.length === 1) return candidates[0];
    if (hash01(seed) < 0.5) {
      // straight bias: neighbour whose heading is closest to prev->at
      const hx = nodes[atNode][0] - nodes[prevNode][0];
      const hz = nodes[atNode][1] - nodes[prevNode][1];
      const hl = Math.hypot(hx, hz) || 1;
      let best = candidates[0];
      let bestDot = -Infinity;
      for (const n of candidates) {
        const dx = nodes[n][0] - nodes[atNode][0];
        const dz = nodes[n][1] - nodes[atNode][1];
        const dl = Math.hypot(dx, dz) || 1;
        const dot = (hx * dx + hz * dz) / (hl * dl);
        if (dot > bestDot) {
          bestDot = dot;
          best = n;
        }
      }
      return best;
    }
    return candidates[Math.floor(hash01(seed * 31 + 7) * candidates.length) % candidates.length];
  };

  const attach = (x: number, z: number) => {
    const near = nearestNode(x, z);
    const node = nodes.length;
    nodes.push([x, z]); // same array buildPathNetwork rendered from — logical only
    edges.push([near, node]);
    adjacency.push([near]);
    adjacency[near].push(node);
    return { node, x, z };
  };

  return { adjacency, edgeBetween, nearestNode, route, wanderNext, attach };
}

// An RCT2 tile-grid layout: axis-aligned streets on a 1.2 grid (grid mode
// on), a 2×2 center-tile plaza that two edges run through seamlessly, and a
// ramped edge climbing exactly one height step (0.5 over a 1.2 run) to a
// raised flat spur.
export function buildPathNetworkScene(three: typeof THREE): { group: THREE.Group; update?: (time: number) => void } {
  const group = new three.Group();
  const update =
    ((t: typeof THREE, g: THREE.Group) => {
        const net: PathNet = {
          nodes: [
            [-2.4, 1.2], // 0 main street, west end (dead end — bin)
            [0, 1.2], // 1 main street × plaza approach (T — lamp)
            [2.4, 1.2], // 2 main street, east — the ramp starts here
            [0, 0], // 3 inside the plaza — no pad/kerbs
            [0, -1.2], // 4 inside the plaza — no pad/kerbs
            [-2.4, -1.2], // 5 side street, west end (dead end — bin)
            [3.6, 1.2], // 6 top of the ramp (raised 0.5, bend tile)
            [3.6, 0], // 7 raised spur end (dead end — bin at +0.5)
          ],
          edges: [
            [0, 1],
            [1, 2], // main street (E–W)
            [1, 3], // enters the plaza through a kerb opening
            [3, 4], // fully inside the plaza — seamless, no kerbs
            [4, 5], // exits the plaza west
            [2, 6], // RAMP — climbs 0.5 over 1.2 (RCT2 max slope)
            [6, 7], // raised flat spur
          ],
        };
        const built = buildPathNetwork(t, net, {
          grid: true,
          plazas: [[0.6, -0.6, 2.4, 2.4]], // 2×2 center tiles
          nodeY: [0, 0, 0, 0, 0, 0, 0.5, 0.5],
          groundAt: () => 0, // verge furniture stands on the flat Stage ground
        });
        built.group.position.set(-0.7, 0, -0.5); // recentre the east-heavy layout in frame
        g.add(built.group);
        if (built.update) return built.update;
      })(three, group) || undefined;
  return { group, update };
}

/** <PathNetwork> — composable (components/Park/Context.md): mounts the scene at
 *  `position`/`rotation`/`scale` inside a <Park> or <ScenePreview>. */
export const PathNetwork = composable('PathNetwork', (t) => buildPathNetworkScene(t));

// An RCT2 elevated-walkway demo: ground → two sloped tiles up (one 0.5 step
// per 1.2 tile each) → an elevated straight riding on wooden scaffold bays →
// two sloped tiles back down, plus an elevated side spur to a kiosk that
// stands on its OWN four-post scaffold deck — the RCT2 rule that anything
// beside an elevated path is supported too (never floating, never a berm).
export function buildElevatedWalkwayScene(three: typeof THREE): { group: THREE.Group; update?: (time: number) => void } {
  const t = three;
  const group = new t.Group();
  // nodes as [x, z, elevation] TRIPLES — the elevation-API convenience form
  // (no parallel nodeY array; heights survive snapNetToGrid's merging)
  const net: PathNet = {
    nodes: [
      [-4.8, 0, 0], // 0 west ground dead end (bin)
      [-3.6, 0, 0], // 1 ramp foot (knuckle — bevelled pad)
      [-2.4, 0, 0.5], // 2 mid-ramp — NO pad, the ribbon runs straight through
      [-1.2, 0, 1], // 3 ramp head (knuckle) — elevated deck starts
      [0, 0, 1], // 4 elevated
      [1.2, 0, 1], // 5 elevated (T junction — spur to the kiosk)
      [2.4, 0, 1], // 6 ramp head (knuckle)
      [3.6, 0, 0.5], // 7 mid-ramp down
      [4.8, 0, 0], // 8 east ground dead end (bin)
      [1.2, -1.2, 1], // 9 elevated spur end, facing the kiosk deck
    ],
    edges: [
      [0, 1],
      [1, 2], // RAMP up (0 → 0.5)
      [2, 3], // RAMP up (0.5 → 1.0)
      [3, 4],
      [4, 5], // elevated straight on scaffolds
      [5, 6],
      [6, 7], // RAMP down (1.0 → 0.5)
      [7, 8], // RAMP down (0.5 → 0)
      [5, 9], // elevated side spur
    ],
  };
  const built = buildPathNetwork(t, net, { grid: true, groundAt: () => 0 });
  group.add(built.group);
  // the kiosk deck: a scaffold tower with a plank deck at walkway level,
  // butted against the spur pad (deterministic — fixed seed)
  const specs: MergedBoxSpec[] = [];
  const kx = 1.2;
  const kz = -2.35;
  const deckTop = 1 + 0.1; // walkway surface level (nodeY 1 + slab top ~0.1)
  scaffoldTower(t, specs, kx, kz, 1.35, 1.15, deckTop, 0, { deck: true, seed: 5 });
  group.add(mergedBoxes(t, specs, SCAFFOLD_WOOD, { tex: 'wood', rough: 0.85 }));
  // a hut-like stall box on the deck: body, cantilevered counter shelf and a
  // tilted canopy carried on two front posts (anchored — nothing floats)
  group.add(box(t, [1.0, 0.78, 0.85], 0xb8503c, [kx, deckTop + 0.44, kz - 0.05], { tex: 'wood', rough: 0.8 }));
  group.add(box(t, [1.08, 0.05, 0.2], 0xd9cfb8, [kx, deckTop + 0.66, kz + 0.42], { rough: 0.7 }));
  const awn = box(t, [1.14, 0.04, 0.72], 0xe8e2d2, [kx, deckTop + 0.97, kz + 0.28], { rough: 0.8 });
  awn.rotation.x = 0.3;
  group.add(awn);
  [-1, 1].forEach((s) => group.add(box(t, [0.035, 0.86, 0.035], 0x6f4a34, [kx + s * 0.53, deckTop + 0.43, kz + 0.6], { rough: 0.8 })));
  return { group, update: built.update };
}

/** <ElevatedWalkway> — composable ramped-walkway/scaffold demo scene. */
export const ElevatedWalkway = composable('ElevatedWalkway', (t) => buildElevatedWalkwayScene(t));

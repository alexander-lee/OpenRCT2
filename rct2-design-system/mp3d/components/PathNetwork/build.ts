// ---------------------------------------------------------------------------
// PathNetwork / build.ts — buildPathNetwork: the whole renderer (slabs, kerbs,
// junction pads, seams, ramps, plazas, scaffolds and RCT2 path ADDITIONS).
// Split out of ./index.tsx for FILE SIZE ONLY — Magic Patterns writes WHOLE
// files and this network no longer fits a single write. index.tsx re-exports
// every public name, so `from '../PathNetwork'` is unchanged.
// `buildPathNetwork` is a plain function, so index.tsx re-exports it directly.
// ---------------------------------------------------------------------------

import * as THREE from 'three';
import { box, cyl, ball, mergedBoxes, nightKOf } from '../Stage';
import type { MergedBoxSpec } from '../Stage';
import { SURFACE_TARMAC, SURFACE_DIRT } from './surfaces';
import type { PathSurface, PathSurfaceZone } from './surfaces';
import { DEFAULT_FURNITURE } from './surfaces';
import type { PathFurniture } from './surfaces';
import { PathNet, PathNetworkOpts, PathNode, QCz, QSz, hash01, quarterTurnsLocal } from './core';
import { SCAFFOLD_LIFT, SCAFFOLD_WOOD, scaffoldBay, scaffoldTower } from './scaffold';
// THE CROSS-SECTION, shared with the RIDE ACCESS runs (GameManager/access.ts):
// a queue lane and an exit footpath are pavement on this same datum, laid by
// this same `pathRibbon`. See ./ribbon.ts.
import { PATH_H, PATH_KERB_W, PATH_MAX_GRADE, PATH_PAD_LIP, PATH_SEAM_EVERY, kerbOffsetFor } from './ribbon';

export function buildPathNetwork(t: typeof THREE, net: PathNet, opts: PathNetworkOpts = {}) {
  const width = opts.width ?? 1.2;
  const y = opts.y ?? 0;
  const dirt = opts.kind === 'dirt';
  // an explicit `surface` wins; otherwise `kind` selects the two stock ones,
  // so every existing caller keeps exactly the surface it had
  const surf: PathSurface = opts.surface ?? (dirt ? SURFACE_DIRT : SURFACE_TARMAC);
  const PAVE = surf.pave;
  const KERB = surf.kerb;
  const SEAM = surf.seam;
  const PAVE_TEX = surf.paveTex ?? (dirt ? 'sand' : 'asphalt');
  const KERB_TEX = surf.kerbTex ?? 'concrete';
  const PAVE_ROUGH = surf.rough ?? 0.95;
  const H = PATH_H; // base slab thickness — path surfaces sit at ~y + H

  const group = new t.Group();
  group.name = 'pathNetwork';
  const { nodes, edges } = net;
  const furn =
    opts.furniture === false
      ? null
      : { lampEvery: 7.2, seatEvery: 4.8, bothSides: true, avoid: undefined as ((x: number, z: number) => boolean) | undefined, ...(opts.furniture ?? {}) };

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
  // RCT2 PATH ADDITIONS. Everything a bench/bin/lamp is made of is a BOX, so a
  // street lined with furniture still costs four draw calls instead of one per
  // item: the parts land in these buckets and merge at the end. Lamp GLASS is
  // its own bucket with one shared emissive material, which is also what makes
  // the whole street's lamps glow together on the night gate.
  // ---- THEMED FURNITURE, bucketed PER THEME ------------------------------
  // A merged mesh carries ONE material, so themed furniture cannot share a
  // bucket: a bench in Emberfall and a bench in Pumpkin-default are different
  // colours and therefore different meshes. `opts.themeAt` resolves the theme at
  // a verge position (Park's THEME REGIONS supply it) and every part is filed
  // under that theme's id. With no sampler there is exactly ONE bucket keyed
  // 'default' holding DEFAULT_FURNITURE's colours — byte-identical to the single
  // IRON_C / SLAT_C pair this used to bake in — so an unthemed park is unchanged
  // and a five-world park costs one extra merged mesh per bucket per world.
  type FurnBuckets = { iron: MergedBoxSpec[]; slat: MergedBoxSpec[]; lid: MergedBoxSpec[]; post: MergedBoxSpec[]; glass: MergedBoxSpec[]; f: PathFurniture };
  const furnByTheme = new Map<string, FurnBuckets>();
  /** the buckets for the theme in force at (x, z) */
  const bucketsAt = (x: number, z: number): FurnBuckets => {
    const th = opts.themeAt?.(x, z) ?? null;
    const key = th?.id ?? 'default';
    let b = furnByTheme.get(key);
    if (!b) {
      b = { iron: [], slat: [], lid: [], post: [], glass: [], f: th?.furniture ?? DEFAULT_FURNITURE };
      furnByTheme.set(key, b);
    }
    return b;
  };
  /** place a part given in ITEM space (x right, z forward) at `base`, yawed by
   *  `a` — the furniture is authored facing local −z and rotated to face the
   *  path, so one definition serves both verges */
  const partAt = (
    bucket: MergedBoxSpec[],
    dims: [number, number, number],
    o: [number, number, number],
    base: [number, number, number],
    a: number,
  ) => {
    const ca = Math.cos(a);
    const sa = Math.sin(a);
    bucket.push({ dims, pos: [base[0] + o[0] * ca + o[2] * sa, base[1] + o[1], base[2] - o[0] * sa + o[2] * ca], rotY: a });
  };
  /** EVERY BENCH SEAT on the network, published on the return so the sim can
   *  send a tired guest to one. One entry per SEAT — an RCT2 bench holds two —
   *  carrying the world seat point and the yaw a guest sitting there faces
   *  (out across the path, i.e. the bench's own facing). */
  const benchSeats: { x: number; y: number; z: number; yaw: number }[] = [];
  /** RCT2 BENCH — a slatted seat and back on two cast-iron end frames. Faces
   *  local −z, i.e. it looks at the path it is planted beside. */
  const putBench = (base: [number, number, number], a: number) => {
    // the two seat places, in the same item frame `partAt` maps from: half a
    // seat either side of centre, on top of the 0.035 slats at oy 0.29. A
    // seated guest looks along local −z (the open side), which is `a + π`.
    const ca = Math.cos(a);
    const sa = Math.sin(a);
    [-0.22, 0.22].forEach((ox) =>
      benchSeats.push({ x: base[0] + ox * ca, y: base[1] + 0.31, z: base[2] - ox * sa, yaw: a + Math.PI }),
    );
    const b = bucketsAt(base[0], base[2]); // THEME at this verge point
    [-1, 1].forEach((sx) => {
      partAt(b.iron, [0.05, 0.26, 0.05], [sx * 0.4, 0.13, -0.13], base, a); // front leg
      partAt(b.iron, [0.05, 0.52, 0.05], [sx * 0.4, 0.26, 0.15], base, a); // back leg, up to the backrest
      partAt(b.iron, [0.06, 0.05, 0.36], [sx * 0.4, 0.25, 0.01], base, a); // seat rail
      partAt(b.iron, [0.05, 0.05, 0.05], [sx * 0.4, 0.53, 0.15], base, a); // finial
    });
    [-0.13, 0.0, 0.13].forEach((sz) => partAt(b.slat, [0.88, 0.035, 0.1], [0, 0.29, sz], base, a)); // seat slats
    [0.4, 0.5].forEach((sy) => partAt(b.slat, [0.88, 0.075, 0.03], [0, sy, 0.16], base, a)); // back slats
  };
  /** RCT2 LITTER BIN — a ribbed tapered bin under a domed lid with the posting
   *  slot left open across it. */
  const putBin = (base: [number, number, number], a: number) => {
    const b = bucketsAt(base[0], base[2]);
    partAt(b.iron, [0.21, 0.03, 0.21], [0, 0.015, 0], base, a); // foot
    partAt(b.iron, [0.17, 0.15, 0.17], [0, 0.1, 0], base, a); // lower body (narrower — the taper)
    partAt(b.iron, [0.2, 0.12, 0.2], [0, 0.235, 0], base, a); // upper body
    [-1, 1].forEach((sx) =>
      [-1, 1].forEach((sz) => partAt(b.iron, [0.025, 0.26, 0.025], [sx * 0.088, 0.16, sz * 0.088], base, a)), // corner ribs
    );
    partAt(b.lid, [0.23, 0.03, 0.23], [0, 0.31, 0], base, a); // rim (lid tone)
    [-1, 1].forEach((sz) => partAt(b.lid, [0.19, 0.045, 0.075], [0, 0.34, sz * 0.055], base, a)); // lid, slot between the halves
  };
  /** RCT2 LAMP POST — fluted base, tapered post, collar, and a real LANTERN
   *  (glass box under a cap and a finial) instead of a bare bulb. */
  const putLamp = (base: [number, number, number], a: number) => {
    const b = bucketsAt(base[0], base[2]);
    partAt(b.post, [0.16, 0.05, 0.16], [0, 0.025, 0], base, a); // base plate
    partAt(b.post, [0.11, 0.09, 0.11], [0, 0.09, 0], base, a); // fluted foot
    partAt(b.post, [0.055, 0.86, 0.055], [0, 0.55, 0], base, a); // post
    partAt(b.post, [0.09, 0.04, 0.09], [0, 0.99, 0], base, a); // collar
    partAt(b.glass, [0.13, 0.17, 0.13], [0, 1.1, 0], base, a); // lantern glass
    partAt(b.post, [0.165, 0.035, 0.165], [0, 1.2, 0], base, a); // cap
    partAt(b.post, [0.045, 0.055, 0.045], [0, 1.24, 0], base, a); // finial
  };

  // per-node height offsets: explicit nodeY, else the third element of any
  // [x, z, elevation] node triples (the convenience form — heights travel
  // WITH the nodes through snapNetToGrid, no parallel array to manage)
  const nodeYArr = opts.nodeY ?? (nodes.some((n) => n.length > 2) ? nodes.map((n) => (n[2] as number) ?? 0) : undefined);
  // per-node WORLD height (base y + offset) — flat networks: yOf == y
  const yOf = (ni: number) => y + (nodeYArr?.[ni] ?? 0);

  // ---- PLAZAS: a block of RCT2 CENTRE TILES, each at its own level ---------
  // A plaza used to be ONE surface at the network's global `y`, which sank
  // into every rise it covered. Pinning the whole rectangle to its highest
  // corner instead is no better: on district-ref that pinned four street nodes
  // 1.0 u up and the grade rule propagated the lift a dozen tiles either way —
  // a causeway over flat ground. RCT2 does neither: a plaza is just a lot of
  // ordinary path tiles, and each tile sits on the surface of ITS OWN tile
  // (Footpath.cpp:109-115). So each tile takes the highest ground it actually
  // covers (+ any street node it swallows), and the vertical face between two
  // stepped tiles is paved by the plinth below — the RCT2 stepped-plaza look.
  const plazas = opts.plazas ?? [];
  const plazaTop = H + 0.006;
  const plazaIndexAt = (x: number, z: number) =>
    plazas.findIndex(([cx, cz, w, d]) => Math.abs(x - cx) <= w / 2 + 0.001 && Math.abs(z - cz) <= d / 2 + 0.001);
  const insidePlaza = (x: number, z: number) => plazaIndexAt(x, z) >= 0;
  /** per-plaza tile grid: cols/rows, tile size and the level of every tile */
  const plazaGrid = plazas.map(([cx, cz, w, d], pi) => {
    const cols = Math.max(1, Math.round(w / width));
    const rows = Math.max(1, Math.round(d / width));
    const tw = w / cols;
    const td = d / rows;
    const level: number[] = [];
    const authored = opts.plazaY?.[pi];
    for (let i = 0; i < cols; i += 1)
      for (let j = 0; j < rows; j += 1) {
        const tx = cx - w / 2 + tw * (i + 0.5);
        const tz = cz - d / 2 + td * (j + 0.5);
        let lvl = authored ?? -Infinity;
        // every street node this tile swallows — the slab must not step down
        // into the pavement that runs through it
        nodes.forEach((n, ni) => {
          if (Math.abs(n[0] - tx) <= tw / 2 + 0.001 && Math.abs(n[1] - tz) <= td / 2 + 0.001) lvl = Math.max(lvl, yOf(ni));
        });
        const ga = opts.groundAt;
        if (ga) {
          let g = ga(tx, tz);
          for (let a = -1; a <= 1; a += 1)
            for (let b = -1; b <= 1; b += 1) g = Math.max(g, ga(tx + (a * tw) / 2, tz + (b * td) / 2));
          lvl = Math.max(lvl, g + 0.03);
        }
        level.push(Number.isFinite(lvl) ? lvl : y);
      }
    return { cx, cz, w, d, cols, rows, tw, td, level };
  });
  const plazaTileLevel = (pi: number, x: number, z: number): number => {
    const G = plazaGrid[pi];
    const i = Math.max(0, Math.min(G.cols - 1, Math.floor((x - (G.cx - G.w / 2)) / G.tw)));
    const j = Math.max(0, Math.min(G.rows - 1, Math.floor((z - (G.cz - G.d / 2)) / G.td)));
    return G.level[i * G.rows + j];
  };
  /** the reference (highest) level of each plaza — the store's `plazaY` and
   *  the bins/floorAt fallback still want one number per plaza */
  const plazaBase: number[] = plazaGrid.map((G) => (G.level.length ? Math.max(...G.level) : y));
  const plazaBaseAt = (x: number, z: number) => {
    const pi = plazaIndexAt(x, z);
    return pi < 0 ? null : plazaTileLevel(pi, x, z);
  };

  // only the STREET prefix is built/linted — see `renderEdges`
  const nBuild = Math.min(opts.renderEdges ?? edges.length, edges.length);
  const buildEdges = nBuild === edges.length ? edges : edges.slice(0, nBuild);

  // RCT2 tile-grid rule: paths run N/S/E/W only
  if (opts.grid) {
    buildEdges.forEach(([ai, bi], ei) => {
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
  buildEdges.forEach(([a, b]) => {
    degree[a] += 1;
    degree[b] += 1;
  });

  const lengths: number[] = [];
  const tops: number[] = []; // per-edge surface offset (surface = node lerp + tops[ei])
  const sq = width + 0.02; // junction pad size — SAME width as the slabs
  // (+0.02 so pad side faces are never coplanar with a passing slab's sides)
  const KW = PATH_KERB_W; // shared kerb cross-section: 0.08 wide, top 0.01 proud
  const kerbOff = kerbOffsetFor(width); // kerb centreline (straddles the slab edge)

  const MAX_SLOPE = PATH_MAX_GRADE; // RCT2 sloped path: one height step per tile

  // ---- RAMP infrastructure (nodeY / [x, z, elevation] heights) --------------
  const padTop = H + PATH_PAD_LIP; // pads' + ramps' finished level
  const RTH = H + 0.026; // ramp ribbon/wedge thickness == pad box height
  // unit direction + signed out-grade of every SLOPED edge at each node
  const nodeSlopes: { ex: number; ez: number; s: number }[][] = nodes.map(() => []);
  buildEdges.forEach(([ai, bi]) => {
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
    // `nodes` is LIVE (routing.attach appends spurs after this build), so an
    // index past `nodeSlopes` is normal and means "no slopes, and no pad drawn"
    (nodeSlopes[ni] ?? []).forEach(({ ex, ez, s }) => {
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
    // RCT2 sloped paths run STRAIGHT — a STEEP slope turning a corner warns.
    // Since the network follows the land (solvePathHeights) almost every
    // junction joins two gently graded edges at an angle, and the knuckle pad
    // BEVELS toward each of them (padSurfAt) so the joint is flush: that is
    // normal, not a defect. Only a corner steep enough to read as a step is
    // worth a word, and the report is capped so it can never flood a console.
    const KNUCKLE_GRADE = 0.15; // ~0.18 u of rise over a 1.2 tile
    let knuckles = 0;
    nodes.forEach((_, ni) => {
      const s = nodeSlopes[ni];
      for (let i = 0; i < s.length; i++)
        for (let j = i + 1; j < s.length; j++)
          if (
            Math.abs(s[i].ex * s[j].ex + s[i].ez * s[j].ez) < 0.99 &&
            Math.max(Math.abs(s[i].s), Math.abs(s[j].s)) > KNUCKLE_GRADE
          ) {
            knuckles += 1;
            if (knuckles <= 4)
              console.warn(`ramp lint: node ${ni} turns a STEEP slope (grade ${Math.max(Math.abs(s[i].s), Math.abs(s[j].s)).toFixed(2)}) — RCT2 sloped paths run straight (expect a rough knuckle)`);
          }
    });
    if (knuckles > 4) console.warn(`ramp lint: ${knuckles - 4} more steep sloped corners suppressed`);
    // every elevated node needs a WALKABLE-grade route down to the ground
    // network (guests can't climb steeper than one height step per tile)
    const walkOk = buildEdges.map(([ai, bi]) => {
      const [ax, az] = nodes[ai];
      const [bx, bz] = nodes[bi];
      const len = Math.hypot(bx - ax, bz - az);
      return Math.abs(yOf(bi) - yOf(ai)) / Math.max(len, 1e-6) <= MAX_SLOPE + 1e-6;
    });
    const reached = nodes.map((_, ni) => Math.abs(nodeYArr[ni] ?? 0) <= 0.05);
    const stack = nodes.map((_, i) => i).filter((i) => reached[i]);
    while (stack.length) {
      const cur = stack.pop()!;
      buildEdges.forEach(([ai, bi], ei) => {
        if (!walkOk[ei]) return;
        const other = ai === cur ? bi : bi === cur ? ai : -1;
        if (other >= 0 && !reached[other]) {
          reached[other] = true;
          stack.push(other);
        }
      });
    }
    // REPORT ONLY STREET NODES. `degree` counts `buildEdges`, so `degree[ni] === 0`
    // means NO PAVEMENT touches this node and "deck unreachable" is meaningless
    // there — those are the GameManager's logical access spurs (routing.attach
    // pushes stall fronts / queue tails onto these same arrays so `walkYAt` can
    // sample them; core.ts's `renderEdges` doc: never rendered OR grid-linted as
    // streets). MEASURED on skeleton-l 2026-07-27: all ELEVEN warnings were
    // degree-0 spur endpoints a few cm off datum, zero real, while the park's
    // accessibility graph reached all 130 nodes. It cannot hide a real defect: a
    // genuine elevated deck is BUILT from street edges, so degree >= 1.
    reached.forEach((ok, ni) => {
      if (!ok && degree[ni] > 0)
        console.warn(
          `ramp lint: elevated node ${ni} (+${(nodeYArr[ni] ?? 0).toFixed(2)}) has no walkable-grade connection to the ground network — deck unreachable (ramp at most 0.5 rise per 1.2 tile)`,
        );
    });
  }

  buildEdges.forEach(([ai, bi], ei) => {
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
      for (let zz = -slopeLen / 2 + 0.7; zz <= slopeLen / 2 - 0.7; zz += PATH_SEAM_EVERY) {
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
        for (let d = -ribLen / 2 + 0.35; d <= ribLen / 2 - 0.35; d += PATH_SEAM_EVERY) {
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
    buildEdges.forEach(([a, b]) => {
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
  plazaGrid.forEach(({ cx, cz, w, d, cols, rows, tw, td, level }) => {
    for (let i = 0; i < cols; i++)
      for (let j = 0; j < rows; j++) {
        const tx = cx - w / 2 + tw * (i + 0.5);
        const tz = cz - d / 2 + td * (j + 0.5);
        const py = level[i * rows + j];
        // the tile is DEEPENED to meet the ground under it instead of floating:
        // a paved terrace plinth, the plaza-scale equivalent of the earth berm
        // bermNetToGround puts under a raised span (RCT2 draws supports under
        // any path whose base is above the surface — Paint.Path.cpp:665). It
        // also paves the vertical face where a tile steps down to its
        // neighbour, so a stepped plaza reads as masonry, not as a gap.
        const ga = opts.groundAt;
        let gt = ga
          ? Math.min(
              ga(tx, tz),
              ga(tx - tw / 2, tz - td / 2),
              ga(tx + tw / 2, tz - td / 2),
              ga(tx - tw / 2, tz + td / 2),
              ga(tx + tw / 2, tz + td / 2),
            )
          : py - 0.02;
        for (const [di, dj] of [
          [-1, 0],
          [1, 0],
          [0, -1],
          [0, 1],
        ]) {
          const ni2 = i + di;
          const nj2 = j + dj;
          if (ni2 < 0 || nj2 < 0 || ni2 >= cols || nj2 >= rows) continue;
          gt = Math.min(gt, level[ni2 * rows + nj2] - 0.02);
        }
        const depth = Math.max(0.02, Math.min(2.5, py - gt + 0.06));
        paveSpecs.push({ dims: [tw, plazaTop + depth, td], pos: [tx, py + plazaTop / 2 - depth / 2, tz], repeat: [4, 4] });
      }
    // boundary kerb, one segment per tile, skipped where a path edge enters
    for (let i = 0; i < cols; i++) {
      const tx = cx - w / 2 + tw * (i + 0.5);
      [-1, 1].forEach((s2) => {
        const kz = cz + s2 * (d / 2 + 0.02);
        if (distToAnyEdge(tx, kz) < width / 2 + 0.01) return; // path opening
        const py = level[i * rows + (s2 < 0 ? 0 : rows - 1)];
        kerbSpecs.push({ dims: [tw - 0.01, nodeKerbHP + 0.02, KW], pos: [tx, py + nodeKerbHP / 2 - 0.01, kz], repeat: [1, 2] });
      });
    }
    for (let j = 0; j < rows; j++) {
      const tz = cz - d / 2 + td * (j + 0.5);
      [-1, 1].forEach((s2) => {
        const kx = cx + s2 * (w / 2 + 0.02);
        if (distToAnyEdge(kx, tz) < width / 2 + 0.01) return; // path opening
        const py = level[(s2 < 0 ? 0 : cols - 1) * rows + j];
        kerbSpecs.push({ dims: [KW, nodeKerbHP + 0.02, td - 0.01], pos: [kx, py + nodeKerbHP / 2 - 0.01, tz], repeat: [1, 2] });
      });
    }
    [-1, 1].forEach((sx) =>
      [-1, 1].forEach((sz) => {
        const py = level[(sx < 0 ? 0 : cols - 1) * rows + (sz < 0 ? 0 : rows - 1)];
        kerbSpecs.push({
          dims: [KW, nodeKerbHP + 0.02, KW],
          pos: [cx + sx * (w / 2 + 0.02), py + nodeKerbHP / 2 - 0.01, cz + sz * (d / 2 + 0.02)],
        });
      }),
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
    buildEdges.forEach(([ai, bi]) => {
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
    else if (dirs.length === 1) {
      // A DEAD END HAS NO ANGULAR GAP TO AIM AT, and the general solve below
      // gets it exactly backwards. With one approach at θ the widest gap is the
      // whole remaining circle, so its midpoint is θ + π — pointing STRAIGHT
      // AHEAD, down the path's own centreline, and the furniture lands ~1.19 u
      // past the terminal node IN THE WALKING LINE. Every path stub and every
      // queue-lane tail spur therefore had a litter bin planted in the middle
      // of it. Guests walk exactly on the node-to-node lines (locomotion.ts has
      // no lateral lane offset), so this was furniture in the road, not beside
      // it. Offset PERPENDICULAR instead — the verge beside the end — with the
      // side picked by hash so a row of stubs does not all dress the same way.
      const th = Math.atan2(dirs[0][1], dirs[0][0]);
      a = th + (hash01(ni * 23 + 7) < 0.5 ? Math.PI / 2 : -Math.PI / 2);
    } else {
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
      // lamp post at junctions — the same RCT2 lamp the verges get
      putLamp([fx, fy - 0.02, fz], a);
      if (lampLights.length < MAX_LAMP_LIGHTS) {
        const pl = new t.PointLight(0xffd98c, 0, 2.4, 2); // off by day, raised at night
        pl.position.set(fx, fy + 1.08, fz);
        group.add(pl);
        lampLights.push(pl);
      }
    }
    // NO BIN AT DEAD ENDS. There used to be one at every degree-1 node, which
    // is how the same bin mesh ended up dotted through the park at the end of
    // every stub and every queue-lane spur — reported as "we seem to be placing
    // this mesh everywhere in the middle of roads". The perpendicular offset
    // above now keeps dead-end furniture out of the walking line, but a bin on
    // every terminal node was never right either: RCT2 does not bin each stub,
    // and bins are already placed properly along the VERGE, alternating with
    // benches on the `furn.seatEvery` cadence below. That is the only place a
    // bin comes from now.
  });

  // ---- RCT2 PATH ADDITIONS ALONG THE VERGE --------------------------------
  // RCT2 additions live on path TILES, not on junctions, so a finished street
  // is LINED with benches, bins and lamps down both sides. This walks every
  // built street, steps along it and plants furniture on the verge just
  // outside the kerb, facing the path. Both verges by default. Ends are kept
  // clear of the junction pads (which have their own furniture) so nothing
  // lands on a slab or inside a corner.
  if (furn) {
    const OFF = width * 0.5 + 0.34; // just outside the kerb line
    const END = 0.85; // keep clear of the junction pad at each end
    let seatIx = 0;
    for (let ei = 0; ei < nBuild; ei += 1) {
      const [ai, bi] = edges[ei];
      const [ax, az] = [nodes[ai][0], nodes[ai][1]];
      const [bx, bz] = [nodes[bi][0], nodes[bi][1]];
      const dx = bx - ax;
      const dz = bz - az;
      const len = Math.hypot(dx, dz);
      if (len < 2 * END + 0.5) continue; // too short to line
      const ux = dx / len;
      const uz = dz / len;
      const yaw = Math.atan2(ux, uz); // +z of item space points along the edge
      const sides: number[] = furn.bothSides ? [1, -1] : [1];
      const run = len - 2 * END;
      const place = (every: number, put: (b: [number, number, number], a: number) => void, phase: number, alternate: boolean) => {
        if (every <= 0 || run < 0.5) return;
        // items sit at INTERVAL CENTRES, so a short tile-length street still
        // gets one in the middle instead of being skipped, and a long avenue
        // gets an evenly spaced run that never crowds either junction
        const n = Math.max(1, Math.round(run / every));
        const step = run / n;
        for (let i = 0; i < n; i += 1) {
          const sAlong = END + step * (i + 0.5);
          for (const sd of sides) {
            // an alternating item (bench/bin) swaps kind down the street, so a
            // verge reads as a run of seats punctuated by bins, like RCT2's
            if (alternate && (i + (sd > 0 ? 0 : 1) + phase) % 2 !== 0) continue;
            const px = ax + ux * sAlong - uz * sd * OFF;
            const pz = az + uz * sAlong + ux * sd * OFF;
            const gy = opts.groundAt ? opts.groundAt(px, pz) : yOf(ai);
            if (Math.max(yOf(ai), yOf(bi)) - gy > 0.6) continue; // verge falls away
            if (furn.avoid && furn.avoid(px, pz)) continue; // someone else's footprint
            // a plaza is paved right up to its boundary — no verge to stand on
            if ((opts.plazas ?? []).some(([cx, cz, pw, pd]) => Math.abs(px - cx) < pw / 2 + 0.2 && Math.abs(pz - cz) < pd / 2 + 0.2)) continue;
            // FACE THE PATH: the item is authored looking down its own local
            // −z, and under rotY(a) that direction is world (−sin a, −cos a).
            // The item stands at centreline + (−uz, ux)·sd·OFF, so it has to
            // look back along (uz, −ux)·sd — which needs sin a = −uz·sd and
            // cos a = ux·sd, i.e. `yaw ∓ π/2`. The old `yaw ± π/2` is exactly
            // the negation of both, so every bench on the network sat with its
            // BACKREST to the street, staring into the hedge behind it.
            put([px, gy - 0.02, pz], yaw + (sd > 0 ? -Math.PI / 2 : Math.PI / 2));
          }
        }
      };
      place(furn.lampEvery, putLamp, 0, false);
      place(furn.seatEvery, putBench, seatIx, true);
      place(furn.seatEvery, putBin, seatIx + 1, true);
      seatIx += 1;
    }
  }
  // one merged mesh per bucket PER THEME (see the note at bucketsAt). Every
  // lantern material — one per theme — goes into `lampHeadMats`, so the whole
  // network still lights together on the night gate whatever it is dressed as.
  furnByTheme.forEach((b) => {
    if (b.iron.length) group.add(mergedBoxes(t, b.iron, b.f.benchFrame, { tex: 'metal', metal: 0.35, rough: 0.55 }));
    if (b.slat.length) group.add(mergedBoxes(t, b.slat, b.f.benchSlat, { tex: 'wood', rough: 0.9 }));
    if (b.lid.length) group.add(mergedBoxes(t, b.lid, b.f.binLid, { tex: 'metal', metal: 0.35, rough: 0.55 }));
    if (b.post.length) group.add(mergedBoxes(t, b.post, b.f.lampPost, { tex: 'metal', metal: 0.35, rough: 0.55 }));
    if (b.glass.length) {
      const lanterns = mergedBoxes(t, b.glass, b.f.lantern, { emissive: b.f.lanternGlow, rough: 0.4 });
      group.add(lanterns);
      lampHeadMats.push(lanterns.material as THREE.MeshStandardMaterial);
    }
  });

  // merge every static bucket into one mesh each (see note at the top).
  // With surfaceZones the buckets are split BY SURFACE first — one merged mesh
  // per distinct surface, so a five-world park still costs a handful of draws
  // rather than one per tile.
  const zones = opts.surfaceZones ?? [];
  // NAMED buckets: Stage's `mat()` bakes the colour into the TEXTURE and leaves
  // `material.color` white, so the object graph is the only reliable way for a
  // raycast probe to tell street pavement from a queue slab or a kerb.
  const named = (m: THREE.Mesh, n: string) => {
    m.name = n;
    return m;
  };
  if (zones.length === 0) {
    if (paveSpecs.length) group.add(named(mergedBoxes(t, paveSpecs, PAVE, { tex: PAVE_TEX, rough: PAVE_ROUGH, bump: 0.03 }), 'streetPave'));
    if (kerbSpecs.length) group.add(named(mergedBoxes(t, kerbSpecs, KERB, { tex: KERB_TEX, rough: 0.9 }), 'streetKerb'));
    if (seamSpecs.length) group.add(named(mergedBoxes(t, seamSpecs, SEAM, { rough: 1 }), 'streetSeam'));
  } else {
    // a spec is positioned either by `pos` or by a baked `matrix` (the edge
    // ribbons) — the translation lives in elements 12/14 of a Matrix4
    const specXZ = (sp: MergedBoxSpec): [number, number] => {
      const p = (sp as { pos?: [number, number, number] }).pos;
      if (p) return [p[0], p[2]];
      const m = (sp as { matrix?: THREE.Matrix4 }).matrix;
      if (m) return [m.elements[12], m.elements[14]];
      return [0, 0];
    };
    const surfaceAt = (x: number, z: number): PathSurface => {
      for (const zo of zones) {
        const q = quarterTurnsLocal(zo.yaw ?? 0);
        const dx = x - zo.cx;
        const dz = z - zo.cz;
        // world -> zone-local, same quarter-turn convention as SetPieceKit
        const lx = dx * QCz[q] + dz * QSz[q];
        const lz = -dx * QSz[q] + dz * QCz[q];
        if (Math.abs(lx) <= zo.hx && Math.abs(lz) <= zo.hz) return zo.surface;
      }
      return surf;
    };
    const emit = (
      specs: MergedBoxSpec[],
      pick: (s: PathSurface) => number,
      opt: (s: PathSurface) => Record<string, unknown>,
      tag = 'streetPave',
    ) => {
      const buckets = new Map<string, { s: PathSurface; list: MergedBoxSpec[] }>();
      for (const sp of specs) {
        const [x, z] = specXZ(sp);
        const s = surfaceAt(x, z);
        const k = `${s.pave}|${s.kerb}|${s.seam}|${s.paveTex}|${s.kerbTex}|${s.rough}`;
        const b = buckets.get(k) ?? { s, list: [] };
        b.list.push(sp);
        buckets.set(k, b);
      }
      buckets.forEach(({ s, list }) => group.add(named(mergedBoxes(t, list, pick(s), opt(s)), tag)));
    };
    if (paveSpecs.length)
      emit(paveSpecs, (s) => s.pave, (s) => ({ tex: s.paveTex ?? PAVE_TEX, rough: s.rough ?? PAVE_ROUGH, bump: 0.03 }), 'streetPave');
    if (kerbSpecs.length) emit(kerbSpecs, (s) => s.kerb, (s) => ({ tex: s.kerbTex ?? KERB_TEX, rough: 0.9 }), 'streetKerb');
    if (seamSpecs.length) emit(seamSpecs, (s) => s.seam, () => ({ rough: 1 }), 'streetSeam');
  }
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
    // a spur index (past `renderEdges`) has no built slab: fall back to the
    // plain slab thickness so an attached queue tail still samples sanely
    let h = yOf(ai) + (yOf(bi) - yOf(ai)) * u + (tops[edgeIndex] ?? H);
    const pbH = plazaBaseAt(x, z);
    if (pbH !== null) h = Math.max(h, pbH + plazaTop);
    return new t.Vector3(x, h, z);
  };
  const edgeLength = (edgeIndex: number) => {
    const l = lengths[edgeIndex];
    if (l !== undefined) return l;
    const [ai, bi] = edges[edgeIndex];
    return Math.hypot(nodes[bi][0] - nodes[ai][0], nodes[bi][1] - nodes[ai][1]);
  };

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
    const pbW = plazaBaseAt(x, z);
    if (pbW !== null) best = Math.max(best, pbW + plazaTop);
    return best;
  };

  /** THE RENDERED walked surface — the TOPMOST course that COVERS (x, z), i.e.
   *  what a downward raycast hits, as against `walkYAt`'s nominal sim datum
   *  (`node + H`). They differ by design: a flat span tops out at `tops[ei]`
   *  (jittered), a pad/ramp at `padTop`, and a knuckle pad BEVELS toward its
   *  slopes. A ride ACCESS RUN must land on this or it ends in a step; guests
   *  keep using `walkYAt`. Full note: ./ribbon.ts `PATH_PAD_LIP`. */
  const surfaceYAt = (x: number, z: number) => {
    let cover = -Infinity;
    let near = -Infinity;
    let nearD = Infinity;
    // 1. built span slabs / ramp ribbons — the edge's OWN top
    for (let ei = 0; ei < buildEdges.length; ei++) {
      const [ea, eb] = buildEdges[ei];
      const [ax2, az2] = nodes[ea];
      const [bx2, bz2] = nodes[eb];
      const ex2 = bx2 - ax2;
      const ez2 = bz2 - az2;
      const L2 = ex2 * ex2 + ez2 * ez2 || 1;
      const u = Math.max(0, Math.min(1, ((x - ax2) * ex2 + (z - az2) * ez2) / L2));
      const d = Math.hypot(x - (ax2 + ex2 * u), z - (az2 + ez2 * u));
      const h = yOf(ea) + (yOf(eb) - yOf(ea)) * u + (tops[ei] ?? H);
      if (d <= width / 2 + 1e-6) cover = Math.max(cover, h);
      if (d < nearD) {
        nearD = d;
        near = h;
      }
    }
    // 2. node pads INCLUDING the knuckle bevel. Only nodes that EXISTED at build
    //    time have a pad drawn — `routing.attach` keeps pushing logical spurs
    //    onto this same live array afterwards, and those carry no geometry.
    const built = Math.min(nodes.length, nodeSlopes.length);
    for (let ni = 0; ni < built; ni++) {
      if (insidePlaza(nodes[ni][0], nodes[ni][1]) || isMidSlope(ni)) continue; // no pad there
      const dx = x - nodes[ni][0];
      const dz = z - nodes[ni][1];
      const d = Math.max(0, Math.max(Math.abs(dx), Math.abs(dz)) - sq / 2);
      const h = padSurfAt(ni, dx, dz);
      if (d <= 1e-6) cover = Math.max(cover, h);
      if (d < nearD) {
        nearD = d;
        near = h;
      }
    }
    const pb = plazaBaseAt(x, z);
    if (pb !== null) cover = Math.max(cover, pb + plazaTop);
    if (Number.isFinite(cover)) return cover;
    // off the pavement: the nearest course within reach, else the sim datum
    return nearD <= width / 2 + 0.45 && Number.isFinite(near) ? near : walkYAt(x, z);
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

  return { group, pointAt, edgeLength, walkYAt, surfaceYAt, plazaBase, nodes, edges, benches: benchSeats, update };
}


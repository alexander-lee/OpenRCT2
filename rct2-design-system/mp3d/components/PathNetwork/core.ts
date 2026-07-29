// ---------------------------------------------------------------------------
// PathNetwork / core.ts — the network's shared vocabulary: node/net types, the
// PathNetworkOpts contract, snapNetToGrid, the exact quarter-turn table used to
// rotate surface-zone bounds, and the deterministic hash.
//
// Split out of ./index.tsx for FILE SIZE ONLY — Magic Patterns writes WHOLE
// files and this network no longer fits a single write. index.tsx re-exports
// every public name, so `from '../PathNetwork'` is unchanged.
//
// LEAF MODULE, deliberately: it imports only ./surfaces (itself a leaf). The
// cycle note in ./surfaces.ts applies here too — nothing in this folder may
// import a VALUE back out of ./index.tsx.
// ---------------------------------------------------------------------------

import type { PathFurniture, PathSurface, PathSurfaceZone } from './surfaces';

/** a network node: `[x, z]` or `[x, z, elevation]` (the optional third
 *  element is the node's height offset — same meaning as `nodeY[i]`) */
export type PathNode = [number, number] | [number, number, number];

export interface PathNet {
  nodes: PathNode[];
  edges: [number, number][];
}

/** ONE SEAT on one verge bench, as `buildPathNetwork` publishes it (`benches`).
 *  `x`/`y`/`z` is the seat point (the slat top a guest's hips land on) and
 *  `yaw` the direction a guest sitting there looks — out across the path, the
 *  bench's own facing. The GameManager sends tired guests to these. */
export interface BenchSeat {
  x: number;
  y: number;
  z: number;
  yaw: number;
}
// exact quarter-turn cos/sin, so a rotated surface zone's bounds stay exact
export const QCz = [1, 0, -1, 0];
export const QSz = [0, 1, 0, -1];
export const quarterTurnsLocal = (rot: number): number => ((Math.round(rot / (Math.PI / 2)) % 4) + 4) % 4;

export interface PathNetworkOpts {
  width?: number;
  y?: number;
  kind?: 'tarmac' | 'dirt';
  /** the walked surface's materials — beats `kind` when both are given.
   *  Presets: SURFACE_TARMAC (default) / DIRT / BASALT / BOARDWALK /
   *  IRONPLATE / MOSSFLAG / NIGHTGLASS. */
  surface?: PathSurface;
  /** REGIONAL surfaces. A park has ONE <Paths>, so a single `surface` cannot
   *  give five themed lands five different streets — pass a zone per world
   *  (its `extent` OBB and that world's `theme.pathSurface`) and every path
   *  tile whose centre falls inside a zone is paved with it, while everything
   *  outside (the hub, the connecting avenues) keeps `surface`. Zones are
   *  tested in order; the FIRST match wins, so list any overlap deliberately. */
  surfaceZones?: PathSurfaceZone[];
  /** ground sampler so verge furniture (lamps/bins) stands on real ground
   *  when the path is raised above terrain (default: furniture at `y`) */
  groundAt?: (x: number, z: number) => number;
  /** RCT2 PATH ADDITIONS — benches, litter bins and lamp posts planted along
   *  the verge of every street, on BOTH sides. RCT2 places additions per path
   *  TILE and draws them on that tile's edges, which is why a finished RCT2
   *  street is lined with them rather than having one bin at the end of it.
   *  `false` turns the along-edge pass off (junction lamps and dead-end bins
   *  remain); the numbers are the spacing in units between items of one kind
   *  on ONE side, so the default lays a lamp every 6 tiles and a bench/bin
   *  pair every 4. `bothSides: false` puts them on the left verge only. */
  furniture?:
    | false
    | {
        lampEvery?: number;
        seatEvery?: number;
        bothSides?: boolean;
        /** VETO a verge position. The network knows where its own kerbs are but
         *  nothing about rides, stalls, queue lanes or scenery, so a verge point
         *  can legitimately land inside someone else's footprint. A park passes
         *  its blocker test here and those positions are skipped. */
        avoid?: (x: number, z: number) => boolean;
      };
  /** RCT2 tile-grid rule: warn about any edge that is not axis-aligned
   *  (|dx| < 0.01 or |dz| < 0.01 required — paths run N/S/E/W only) */
  grid?: boolean;
  /** full-paved plaza rectangles `[centerX, centerZ, width, depth]` rendered
   *  as a flush grid of RCT2 "center" tiles: ONE surface level, kerb only
   *  around the outer boundary (with openings where edges enter), junction
   *  pads/kerbs/furniture suppressed for nodes inside */
  plazas?: [number, number, number, number][];
  /** per-plaza WORLD surface base (parallel to `plazas`). A plaza is ONE level
   *  — RCT2 centre tiles are flat — but that level is LOCAL, not the network's
   *  global `y`: a plaza on a rise has to sit on the rise or its slab buries
   *  itself in the hillside. `<Paths>` solves these alongside the node heights
   *  and passes them here. Omitted ⇒ derived from the nodes inside the plaza
   *  (and `groundAt` under its tiles), falling back to `y`. */
  plazaY?: number[];
  /** how many of `edges` are STREET and get BUILT (default: all of them). The
   *  GameManager's `routing.attach()` pushes logical access spurs onto the very
   *  same arrays — deliberately, so `walkYAt`/`pointAt` sample a stall front or
   *  queue tail correctly — but those stubs are not pavement and must never be
   *  rendered (or grid-linted) as streets. Only matters when the network is
   *  REBUILT after attach, i.e. <Paths>'s post-clamp re-settle. */
  renderEdges?: number;
  /**
   * THEME REGIONS — resolve the theme in force at a verge position.
   *
   * `<Paths>` supplies this from the park's registered theme regions, and it is
   * what makes a themed land's FURNITURE follow its roads automatically: the
   * bench, bin and lamp planted on a street inside Emberfall are dressed in
   * Emberfall's tones without the author restating them. Return `null` (or omit
   * the sampler) for the default catalogue.
   *
   * The `id` matters as much as the colours — it is the merge key, so all the
   * furniture of one theme still collapses into one mesh per bucket.
   */
  themeAt?: (x: number, z: number) => { id: string; furniture: PathFurniture } | null;
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
export const hash01 = (n: number) => {
  const s = Math.sin(n * 12.9898 + 78.233) * 43758.5453;
  return s - Math.floor(s);
};

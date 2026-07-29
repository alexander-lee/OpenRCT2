// ---------------------------------------------------------------------------
// PathNetwork / routing.ts — the LOGICAL layer over the same node/edge arrays:
// adjacency, nearest-node snapping, A*-ish routes, guest wandering and the
// access-spur `attach`. Split out of ./index.tsx for FILE SIZE ONLY — Magic Patterns writes WHOLE
// files and this network no longer fits a single write. index.tsx re-exports
// every public name, so `from '../PathNetwork'` is unchanged.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// ROUTING — an RCT2-style movement layer over the same {nodes, edges} graph.
// Guests in RCT2 travel tile-by-tile along path edges (GuestPathfinding.cpp:202,
// Peep.cpp:295). Aimless wander keeps a 50% straight bias and never reverses
// except at dead ends (GuestPathfinding.cpp:535,1926). Goal-seeking is a greedy
// distance-scored search with a memory of the last 4 thin junctions so recently
// tried edges are avoided (GuestPathfinding.cpp:628,1300). Deterministic — no
// Math.random, no Date.now.

import { hash01 } from './core';
import type { PathNode } from './core';

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

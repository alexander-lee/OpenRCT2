import React from 'react';
import * as THREE from 'three';

import { buildPeep, SKIN_TONES, SHIRTS, TROUSERS, HAIRS, Expression } from '../Guest';
import { buildPathNetwork, PathNet } from '../PathNetwork';
import { composable } from '../Park';

// Path WALKERS — guests strolling a buildPathNetwork graph. Each walker is
// OUR buildPeep (varied skin / shirt / trousers / hair / expression) walking
// along edges, turning at nodes with deterministic seeded choices (never
// doubling straight back unless at a dead end), facing its travel direction,
// keeping to its own lane so opposite streams don't stack. No Math.random.

export interface WalkersOpts {
  count?: number;
}

// deterministic pseudo-random from an integer key (hashed sine)
const hash01 = (n: number) => {
  const s = Math.sin(n * 12.9898 + 78.233) * 43758.5453;
  return s - Math.floor(s);
};

const EXPRS: Expression[] = ['happy', 'neutral', 'surprised', 'happy', 'sad', 'neutral'];

export function attachWalkers(
  t: typeof THREE,
  g: THREE.Group,
  net: ReturnType<typeof buildPathNetwork>,
  opts: WalkersOpts = {},
) {
  const count = opts.count ?? 8;
  const { nodes, edges } = net;

  // adjacency: node index -> edge indices touching it
  const adj: number[][] = nodes.map(() => []);
  edges.forEach(([a, b], ei) => {
    adj[a].push(ei);
    adj[b].push(ei);
  });

  interface Walker {
    peep: ReturnType<typeof buildPeep>;
    carrier: THREE.Group;
    edge: number;
    dir: 1 | -1; // 1: a->b, -1: b->a
    d: number; // distance travelled along current edge
    speed: number;
    lane: number; // lateral offset (right of travel)
    phase: number;
    choice: number; // seeded decision counter
    last: number;
  }

  const walkers: Walker[] = [];
  for (let i = 0; i < count; i += 1) {
    const peep = buildPeep(t, {
      skin: SKIN_TONES[Math.floor(hash01(i * 31 + 1) * SKIN_TONES.length)],
      shirt: SHIRTS[Math.floor(hash01(i * 31 + 2) * SHIRTS.length)],
      trousers: TROUSERS[Math.floor(hash01(i * 31 + 3) * TROUSERS.length)],
      hair: HAIRS[Math.floor(hash01(i * 31 + 4) * HAIRS.length)],
      expression: EXPRS[i % EXPRS.length],
    });
    peep.group.scale.setScalar(0.5);
    const carrier = new t.Group();
    carrier.add(peep.group);
    g.add(carrier);
    const edge = i % edges.length;
    walkers.push({
      peep,
      carrier,
      edge,
      dir: i % 2 === 0 ? 1 : -1,
      // spread starts along the edge so walkers don't stack
      d: ((i / count) * 0.8 + 0.1 + hash01(i * 31 + 5) * 0.08) * net.edgeLength(edge),
      speed: 0.28 + hash01(i * 31 + 6) * 0.18,
      lane: 0.1 + hash01(i * 31 + 7) * 0.2,
      phase: hash01(i * 31 + 8) * Math.PI * 2,
      choice: i * 197 + 11,
      last: 0,
    });
  }

  return (time: number) => {
    walkers.forEach((w) => {
      const dt = Math.max(0, Math.min(0.1, time - w.last));
      w.last = time;
      w.d += w.speed * dt;
      let len = net.edgeLength(w.edge);
      // arrived at a node — pick the next edge deterministically
      while (w.d >= len) {
        w.d -= len;
        const [a, b] = edges[w.edge];
        const nodeAt = w.dir === 1 ? b : a;
        const options = adj[nodeAt].filter((ei) => ei !== w.edge);
        const pool = options.length > 0 ? options : adj[nodeAt]; // dead end: turn back
        const next = pool[Math.floor(hash01(w.choice) * pool.length) % pool.length];
        w.choice += 1;
        w.edge = next;
        w.dir = edges[next][0] === nodeAt ? 1 : -1;
        len = net.edgeLength(w.edge);
      }
      const u0 = w.d / len;
      const u = w.dir === 1 ? u0 : 1 - u0;
      const pos = net.pointAt(w.edge, u);
      // travel direction + right-hand lane offset
      const [ai, bi] = edges[w.edge];
      let dx = (nodes[bi][0] - nodes[ai][0]) * w.dir;
      let dz = (nodes[bi][1] - nodes[ai][1]) * w.dir;
      const m = Math.hypot(dx, dz) || 1;
      dx /= m;
      dz /= m;
      w.carrier.position.set(pos.x + dz * w.lane, pos.y, pos.z - dx * w.lane);
      w.carrier.rotation.y = Math.atan2(dx, dz);
      w.peep.walk(time * 2.1, w.phase);
    });
  };
}

// A branching network with ~8 guests strolling it, turning at junctions.
export function buildPathWalkersScene(three: typeof THREE): { group: THREE.Group; update?: (time: number) => void } {
  const group = new three.Group();
  const update =
    ((t: typeof THREE, g: THREE.Group) => {
        const net: PathNet = {
          nodes: [
            [-2, -1.5],
            [0, -1.5],
            [2, -1.5],
            [2, 1],
            [0, 1],
            [-2, 1],
            [0, 2.4],
            [3.3, -1.5],
          ],
          edges: [
            [0, 1],
            [1, 2],
            [2, 3],
            [3, 4],
            [4, 5],
            [5, 0],
            [1, 4],
            [4, 6],
            [2, 7],
          ],
        };
        const built = buildPathNetwork(t, net);
        g.add(built.group);
        return attachWalkers(t, g, built, { count: 8 });
      })(three, group) || undefined;
  return { group, update };
}

/** <PathWalkers> — composable (components/Park/Context.md): mounts the scene at
 *  `position`/`rotation`/`scale` inside a <Park> or <ScenePreview>. */
export const PathWalkers = composable('PathWalkers', (t) => buildPathWalkersScene(t));

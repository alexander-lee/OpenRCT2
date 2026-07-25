import React from 'react';
import * as THREE from 'three';
import { box, cyl, ball, nightKOf } from '../Stage';
import { TILE } from '../ParkBuilder';
import type { ParkFootRect } from '../ParkBuilder';
import { useComposable } from '../Park';
import type { ComposableBuilt, ParkContextValue } from '../Park';
import { buildPathNetwork } from '../PathNetwork';
import { buildStringLights } from '../StringLights';
import { bench as kitBench, bin as kitBin } from '../Kit';

// ---------------------------------------------------------------------------
// SetPieceKit — the PORTS + FOOTPRINT contract every MACRO SET-PIECE speaks.
//
// A set-piece (<FountainPlaza>, <Bazaar>, <Boulevard>, …) is a composite park
// object: several primitives, their interior paths, their stalls and their
// GameManager registrations bundled into ONE correct-by-construction unit.
// The composing agent never hand-computes a set-piece's interior geometry; it
// only wires PORTS.
//
// THE CONTRACT — plan first, mount second:
//
//   1. A PURE PLANNER returns the whole piece as data, BEFORE anything
//      mounts: `fountainPlazaPlan({ id: 'hub', position: [0, 12] })`. The
//      plan carries
//        - `ports`      named connector cells in WORLD coords, already
//                       lattice-snapped, each one lattice cell OUTSIDE the
//                       piece's footprint (so a street/queue lane can meet it
//                       without ever overlapping the piece),
//        - `nodes`/`edges`  the piece's INTERIOR path sub-net in world coords
//                       (cardinal, on the 1.2 lattice) — it becomes part of
//                       the park's ONE shared graph, so guests really walk it
//                       and queue tails may land on it,
//        - `plazas`/`bins`  the paving rects and bin spots <Paths> renders,
//        - `cells`      every cell the piece paves or places on (<Terrain
//                       keepDry>),
//        - `footprint`  ONE OBB (ParkFootRect) covering the whole piece, for
//                       validatePark's footprint sweep + the coaster-corridor
//                       SAT sweep.
//      Because the plan exists before mount, the agent can lay the street
//      skeleton, the keepDry list and the ride queue tails AROUND the piece —
//      the class of defect that used to appear only at settle time.
//
//   2. `buildParkNet({ nodes, edges, pieces })` FUSES the agent's own street
//      nodes with every piece's sub-net into the single `{nodes, edges}`
//      object <Paths> renders and the GameManager routes over. Edges may
//      reference ports BY NAME (`['hub:W', 'ave:A']`), the agent's own node
//      indices are PRESERVED (so `queueTailNode={7}` keeps meaning node 7),
//      long edges are split at any node lying on them (no crossing without a
//      junction), and unconnected port stubs are PRUNED instead of
//      dead-ending in open grass.
//
//   3. The COMPONENT takes the plan and nothing else: `<FountainPlaza
//      plan={HUB} />`. Ports, footprint, keepDry cells, stall anchors and the
//      mounted visual are therefore all derived from the SAME numbers — they
//      cannot disagree.
//
// Everything here is deterministic (hashed sine only — no Math.random /
// Date.now), grounded through `park.floorAt` (plaza level inside a plaza rect,
// terrain outside), and built from catalog builders only.
// ---------------------------------------------------------------------------

export type XZ = [number, number];

/** the RCT2 path lattice cell (1.2) — every port/node coordinate is a multiple */
export const CELL = TILE;

/** snap to the path lattice */
export const snapCell = (v: number, cell = CELL): number => Math.round(v / cell) * cell;
/** snap an `[x, z]` pair to the path lattice */
export const snapXZ = (p: XZ, cell = CELL): XZ => [snapCell(p[0], cell), snapCell(p[1], cell)];

/** quarter turns (0..3) of a yaw — set-piece rotations are always axis-aligned */
export const quarterTurns = (rot: number): number => ((Math.round(rot / (Math.PI / 2)) % 4) + 4) % 4;
/** the quantized yaw a set-piece actually mounts at */
export const quantYaw = (rot: number): number => quarterTurns(rot) * (Math.PI / 2);

// exact quarter-turn cos/sin — keeps rotated lattice coordinates EXACT
const QC = [1, 0, -1, 0];
const QS = [0, 1, 0, -1];

/** rotate a local `[x, z]` by a quarter-turn yaw (three.js Y rotation) */
export function rotateXZ(rot: number, p: XZ): XZ {
  const q = quarterTurns(rot);
  const c = QC[q];
  const s = QS[q];
  return [p[0] * c + p[1] * s, -p[0] * s + p[1] * c];
}

const key2 = (p: XZ): string => `${p[0].toFixed(3)},${p[1].toFixed(3)}`;

/** deterministic 0..1 from an integer key (hashed sine — the fleet PRNG) */
export const hash01 = (n: number): number => {
  const s = Math.sin(n * 12.9898 + 78.233) * 43758.5453;
  return s - Math.floor(s);
};

// ---- the plan --------------------------------------------------------------

/** a named connector cell: WORLD coords, lattice-snapped, one cell OUTSIDE
 *  the piece footprint, with the outward direction it faces */
export interface SetPiecePort {
  name: string;
  at: XZ;
  dir: XZ;
  /** index into the plan's own `nodes` */
  node: number;
  /** may buildParkNet DROP this port when nothing is wired to it? True for a
   *  dedicated stub (a plaza/bazaar entrance that would otherwise dead-end in
   *  open grass); FALSE for a structural chain END (a boulevard terminus is
   *  part of the carriageway — dropping it would shorten the avenue). */
  prunable: boolean;
}

/** the shape EVERY set-piece plan shares (each piece extends it with its own
 *  resolved dressing anchors — see FountainPlaza/Bazaar/Boulevard) */
export interface SetPiecePlan {
  kind: string;
  id: string;
  title: string;
  /** the piece's origin cell (lattice-snapped) */
  position: XZ;
  /** quantized yaw (multiple of π/2) */
  rotation: number;
  /** interior path sub-net, WORLD coords (feed through buildParkNet) */
  nodes: XZ[];
  edges: [number, number][];
  ports: SetPiecePort[];
  /** paving rects `[cx, cz, w, d]` for <Paths plazas> */
  plazas: [number, number, number, number][];
  /** litter-bin spots for <Paths bins> (mesh + manager registration) */
  bins: XZ[];
  /** every cell the piece paves or places on — <Terrain keepDry> */
  cells: XZ[];
  /** ONE OBB covering the piece (validatePark footprint + corridor sweeps) */
  footprint: ParkFootRect;
  /** register `footprint` with the park? (street-like pieces don't reserve) */
  reserve: boolean;
  /** remount key */
  key: string;
  /** a port's world cell (throws on an unknown name) */
  port(name: string): XZ;
  /** a port's outward unit direction */
  portDir(name: string): XZ;
  /** local → world */
  toWorld(local: XZ): XZ;
  /** local yaw → world yaw */
  toWorldYaw(localYaw: number): number;
}

export interface SetPieceSpec {
  kind: string;
  id: string;
  title: string;
  position: XZ;
  rotation: number;
  /** sub-net nodes in LOCAL coords (lattice multiples) */
  localNodes: XZ[];
  localEdges: [number, number][];
  /** ports by name → index into `localNodes`, with the LOCAL outward dir.
   *  `prunable: false` marks a structural chain end (never dropped). */
  localPorts: { name: string; node: number; dir: XZ; prunable?: boolean }[];
  /** paving rects in LOCAL coords `[cx, cz, w, d]` */
  localPlazas?: [number, number, number, number][];
  localBins?: XZ[];
  /** LOCAL half-extents of the reserved footprint */
  half: XZ;
  /** LOCAL offset of the footprint centre from `position` (default [0, 0] —
   *  pieces whose origin is an END, like a boulevard's port A, use it) */
  footOffset?: XZ;
  reserve?: boolean;
  /** extra LOCAL cells to keep dry (prop/stall/verge spots) */
  localCells?: XZ[];
  /** remount key payload */
  keyData?: unknown;
}

/** build the shared half of a set-piece plan (each planner calls this) */
export function makeSetPiecePlan(spec: SetPieceSpec): SetPiecePlan {
  const position = snapXZ(spec.position);
  const rotation = quantYaw(spec.rotation);
  const q = quarterTurns(rotation);
  const toWorld = (local: XZ): XZ => {
    const r = rotateXZ(rotation, local);
    return [position[0] + r[0], position[1] + r[1]];
  };
  const nodes = spec.localNodes.map((n) => snapXZ(toWorld(n)));
  const ports: SetPiecePort[] = spec.localPorts.map((p) => ({
    name: p.name,
    at: nodes[p.node],
    dir: rotateXZ(rotation, p.dir),
    node: p.node,
    prunable: p.prunable ?? true,
  }));
  const plazas = (spec.localPlazas ?? []).map(([cx, cz, w, d]) => {
    const c = toWorld([cx, cz]);
    const swap = q === 1 || q === 3;
    return [c[0], c[1], swap ? d : w, swap ? w : d] as [number, number, number, number];
  });
  const bins = (spec.localBins ?? []).map((b) => toWorld(b));
  // keepDry: every sub-net node, every 1.2 step along every sub-net edge,
  // every paved plaza tile centre and every prop/stall cell the piece owns
  const cells: XZ[] = [];
  const seen = new Set<string>();
  const push = (p: XZ) => {
    const k = key2(p);
    if (seen.has(k)) return;
    seen.add(k);
    cells.push(p);
  };
  nodes.forEach(push);
  spec.localEdges.forEach(([a, b]) => {
    const [ax, az] = nodes[a];
    const [bx, bz] = nodes[b];
    const steps = Math.max(1, Math.round(Math.hypot(bx - ax, bz - az) / CELL));
    for (let i = 1; i < steps; i += 1) push([ax + ((bx - ax) * i) / steps, az + ((bz - az) * i) / steps]);
  });
  plazas.forEach(([cx, cz, w, d]) => {
    const nx = Math.max(1, Math.round(w / CELL));
    const nz = Math.max(1, Math.round(d / CELL));
    for (let i = 0; i < nx; i += 1)
      for (let j = 0; j < nz; j += 1) push([cx - w / 2 + (i + 0.5) * CELL, cz - d / 2 + (j + 0.5) * CELL]);
  });
  (spec.localCells ?? []).forEach((c) => push(snapXZ(toWorld(c))));
  const footCentre = toWorld(spec.footOffset ?? [0, 0]);
  const footprint: ParkFootRect = {
    cx: footCentre[0],
    cz: footCentre[1],
    hx: spec.half[0],
    hz: spec.half[1],
    yaw: rotation,
    label: `${spec.title} ${spec.kind}`,
  };
  const portMap = new Map(ports.map((p) => [p.name, p]));
  const at = (name: string): SetPiecePort => {
    const p = portMap.get(name);
    if (!p)
      throw new Error(
        `<${spec.kind} ${spec.id}>: no port "${name}" — this piece has [${ports.map((pp) => pp.name).join(', ') || 'none'}]`,
      );
    return p;
  };
  return {
    kind: spec.kind,
    id: spec.id,
    title: spec.title,
    position,
    rotation,
    nodes,
    edges: spec.localEdges.map((e) => [e[0], e[1]] as [number, number]),
    ports,
    plazas,
    bins,
    cells,
    footprint,
    reserve: spec.reserve ?? true,
    key: JSON.stringify([spec.kind, spec.id, position, rotation, spec.keyData ?? null]),
    port: (name) => at(name).at,
    portDir: (name) => at(name).dir,
    toWorld,
    toWorldYaw: (localYaw) => localYaw + rotation,
  };
}

// ---- buildParkNet — fuse the agent's streets with every piece's sub-net ----

/** an edge endpoint: an index into YOUR `nodes`, or `'pieceId:PORT'` */
export type NetRef = number | string;

export interface ParkNetInput {
  /** YOUR street nodes — indices are PRESERVED in the result */
  nodes?: XZ[];
  /** street edges; endpoints may be your node indices or `'pieceId:PORT'` */
  edges?: [NetRef, NetRef][];
  pieces?: SetPiecePlan[];
  /** extra bins / plazas / keepDry cells of your own */
  bins?: XZ[];
  plazas?: [number, number, number, number][];
  keepDry?: XZ[];
  /** drop port stubs nobody connected to (default true — a dangling port is
   *  exactly the "spur dead-ending in open grass" defect) */
  prunePorts?: boolean;
  /** suppress the console lint (previews) */
  quiet?: boolean;
}

export interface ParkNetResult {
  /** the shared graph for `<Paths nodes edges>` — already lattice-snapped,
   *  deduped and cardinal, so <Paths>' own snapNetToGrid is a no-op and node
   *  indices stay stable */
  nodes: XZ[];
  edges: [number, number][];
  plazas: [number, number, number, number][];
  bins: XZ[];
  /** `<Terrain keepDry>` — streets, plaza tiles and every piece cell */
  keepDry: XZ[];
  /** node index of a world cell */
  node(at: XZ): number;
  /** node index of `'pieceId:PORT'` */
  port(ref: string): number;
  /** pruned port refs (unconnected stubs) */
  pruned: string[];
  /** lint findings (also console.warn'ed unless `quiet`) */
  warnings: string[];
}

/**
 * Fuse YOUR street lattice with every set-piece's interior sub-net into the
 * ONE `{nodes, edges}` graph `<Paths>` renders and the GameManager routes
 * over. Your node indices are preserved (piece nodes are appended), so
 * `queueTailNode` indices you computed against your own list stay valid.
 * Guarantees, by construction: everything snapped to the 1.2 lattice, no
 * duplicate cells, no duplicate/degenerate edges, every long edge SPLIT at
 * any node lying on it (no crossing without a junction), unconnected port
 * stubs pruned, and a lint pass for diagonal edges + disconnected islands.
 */
export function buildParkNet(input: ParkNetInput): ParkNetResult {
  const warnings: string[] = [];
  const nodes: XZ[] = [];
  const index = new Map<string, number>();
  const add = (p: XZ, label: string, forceNew = false): number => {
    const s = snapXZ(p);
    const k = key2(s);
    const hit = index.get(k);
    if (hit !== undefined && !forceNew) return hit;
    if (hit !== undefined) {
      warnings.push(`${label} lands on the same cell [${s[0]}, ${s[1]}] as node ${hit} — merged`);
      return hit;
    }
    const i = nodes.length;
    nodes.push(s);
    index.set(k, i);
    return i;
  };
  // 1. YOUR nodes first — indices 0..n-1 are preserved exactly
  const own = input.nodes ?? [];
  own.forEach((n, i) => {
    const before = nodes.length;
    const at = add(n, `street node ${i}`);
    if (at !== before) warnings.push(`street node ${i} duplicates node ${at} — your indices past ${i} would shift; give each street node its own cell`);
  });
  // 2. every piece's sub-net, merged by cell
  const portIndex = new Map<string, number>();
  const prunable = new Set<string>();
  const pieceEdges: [number, number][] = [];
  (input.pieces ?? []).forEach((pc) => {
    const map = pc.nodes.map((n, i) => add(n, `${pc.id} node ${i}`));
    pc.edges.forEach(([a, b]) => pieceEdges.push([map[a], map[b]]));
    pc.ports.forEach((p) => {
      portIndex.set(`${pc.id}:${p.name}`, map[p.node]);
      if (p.prunable) prunable.add(`${pc.id}:${p.name}`);
    });
  });
  const port = (ref: string): number => {
    const hit = portIndex.get(ref);
    if (hit === undefined)
      throw new Error(
        `buildParkNet: unknown port "${ref}" — known ports: [${[...portIndex.keys()].join(', ') || 'none'}]${
          ref.includes(':') ? '' : " (refs look like 'pieceId:PORT')"
        }`,
      );
    return hit;
  };
  const resolve = (r: NetRef): number => {
    if (typeof r === 'number') {
      if (!Number.isInteger(r) || r < 0 || r >= own.length)
        throw new Error(`buildParkNet: edge endpoint ${r} is not one of your street nodes (0..${own.length - 1})`);
      return index.get(key2(snapXZ(own[r])))!;
    }
    return port(r);
  };
  const edges: [number, number][] = [...(input.edges ?? []).map(([a, b]) => [resolve(a), resolve(b)] as [number, number]), ...pieceEdges];

  // 3. prune port stubs nobody connected to (a dangling port = a spur
  //    dead-ending in open grass). Piece nodes come AFTER your nodes, so
  //    removing one never shifts a street index.
  const pruned: string[] = [];
  if (input.prunePorts !== false) {
    const drop = new Set<number>();
    portIndex.forEach((ni, ref) => {
      if (!prunable.has(ref)) return; // structural chain end — never dropped
      const deg = edges.filter(([a, b]) => a === ni || b === ni).length;
      if (deg <= 1) {
        drop.add(ni);
        pruned.push(ref);
      }
    });
    if (drop.size) {
      const keep = nodes.map((_, i) => !drop.has(i));
      const remap: number[] = [];
      const kept: XZ[] = [];
      nodes.forEach((n, i) => {
        if (keep[i]) {
          remap[i] = kept.length;
          kept.push(n);
        } else remap[i] = -1;
      });
      const keptEdges = edges.filter(([a, b]) => keep[a] && keep[b]).map(([a, b]) => [remap[a], remap[b]] as [number, number]);
      nodes.length = 0;
      nodes.push(...kept);
      edges.length = 0;
      edges.push(...keptEdges);
      index.clear();
      nodes.forEach((n, i) => index.set(key2(n), i));
      portIndex.forEach((ni, ref) => {
        if (remap[ni] >= 0) portIndex.set(ref, remap[ni]);
        else portIndex.delete(ref);
      });
      if (!input.quiet)
        console.info(
          `[SetPieceKit] buildParkNet pruned ${pruned.length} unconnected port stub(s) — ${pruned.join(', ')} (nothing was wired to them; they would have dead-ended in open grass)`,
        );
    }
  }

  // 4. split every edge at any node lying ON it (a crossing without a
  //    junction is a routing dead end guests can never turn at)
  const split: [number, number][] = [];
  edges.forEach(([a, b]) => {
    const [ax, az] = nodes[a];
    const [bx, bz] = nodes[b];
    const along: { t: number; i: number }[] = [];
    const dx = bx - ax;
    const dz = bz - az;
    const len2 = dx * dx + dz * dz;
    if (len2 > 1e-9) {
      nodes.forEach((n, i) => {
        if (i === a || i === b) return;
        const tt = ((n[0] - ax) * dx + (n[1] - az) * dz) / len2;
        if (tt <= 1e-6 || tt >= 1 - 1e-6) return;
        const px = ax + dx * tt;
        const pz = az + dz * tt;
        if (Math.hypot(n[0] - px, n[1] - pz) > 1e-3) return;
        along.push({ t: tt, i });
      });
    }
    if (!along.length) {
      split.push([a, b]);
      return;
    }
    along.sort((p, q) => p.t - q.t);
    let prev = a;
    along.forEach(({ i }) => {
      split.push([prev, i]);
      prev = i;
    });
    split.push([prev, b]);
  });
  // 5. dedupe + drop degenerates
  const finalEdges: [number, number][] = [];
  const seenE = new Set<string>();
  split.forEach(([a, b]) => {
    if (a === b) return;
    const k = a < b ? `${a}-${b}` : `${b}-${a}`;
    if (seenE.has(k)) return;
    seenE.add(k);
    finalEdges.push([a, b]);
  });

  // 6. lint: cardinal edges + one connected street network
  finalEdges.forEach(([a, b], ei) => {
    const adx = Math.abs(nodes[b][0] - nodes[a][0]);
    const adz = Math.abs(nodes[b][1] - nodes[a][1]);
    if (adx >= 0.01 && adz >= 0.01)
      warnings.push(
        `edge ${ei} (${a}→${b}: [${nodes[a]}]→[${nodes[b]}]) is DIAGONAL — RCT2 paths run N/S/E/W only (validatePark fails 'paths')`,
      );
  });
  if (nodes.length) {
    const adj: number[][] = nodes.map(() => []);
    finalEdges.forEach(([a, b]) => {
      adj[a].push(b);
      adj[b].push(a);
    });
    const seenN = new Uint8Array(nodes.length);
    let islands = 0;
    for (let s = 0; s < nodes.length; s += 1) {
      if (seenN[s]) continue;
      islands += 1;
      if (islands > 1) warnings.push(`node ${s} at [${nodes[s]}] is in a SEPARATE island — no walkable route from the gate street (validatePark fails 'accessibility')`);
      const stack = [s];
      seenN[s] = 1;
      while (stack.length) {
        const c = stack.pop()!;
        adj[c].forEach((n) => {
          if (!seenN[n]) {
            seenN[n] = 1;
            stack.push(n);
          }
        });
      }
    }
  }
  if (warnings.length && !input.quiet) warnings.forEach((w) => console.warn(`[SetPieceKit] buildParkNet: ${w}`));

  // 7. plazas / bins / keepDry
  const plazas = [...(input.plazas ?? []), ...(input.pieces ?? []).flatMap((p) => p.plazas)];
  const bins = [...(input.bins ?? []), ...(input.pieces ?? []).flatMap((p) => p.bins)];
  const keepDry: XZ[] = [];
  const seenK = new Set<string>();
  const pushK = (p: XZ) => {
    const k = key2(p);
    if (seenK.has(k)) return;
    seenK.add(k);
    keepDry.push(p);
  };
  nodes.forEach(pushK);
  finalEdges.forEach(([a, b]) => {
    const [ax, az] = nodes[a];
    const [bx, bz] = nodes[b];
    const steps = Math.max(1, Math.round(Math.hypot(bx - ax, bz - az) / CELL));
    for (let i = 1; i < steps; i += 1) pushK([ax + ((bx - ax) * i) / steps, az + ((bz - az) * i) / steps]);
  });
  (input.pieces ?? []).forEach((p) => p.cells.forEach(pushK));
  (input.keepDry ?? []).forEach(pushK);

  return {
    nodes,
    edges: finalEdges,
    plazas,
    bins,
    keepDry,
    node: (at: XZ) => {
      const i = index.get(key2(snapXZ(at)));
      if (i === undefined) throw new Error(`buildParkNet: no street node on cell [${snapXZ(at).join(', ')}]`);
      return i;
    },
    port,
    pruned,
    warnings,
  };
}

// ---- the mount side -------------------------------------------------------

/** props EVERY set-piece component takes — the plan, and nothing else */
export interface SetPieceProps<P extends SetPiecePlan = SetPiecePlan> {
  /** the plan its pure planner returned (the single source of geometry) */
  plan: P;
  /** override `plan.reserve`: register the piece footprint for validatePark's
   *  footprint + corridor sweeps (land-owning pieces default ON) */
  reserve?: boolean;
}

const isPreview = (park: ParkContextValue): boolean => !!(park as { _previewHost?: boolean })._previewHost;

/**
 * Set-piece component factory. The build runs in WORLD coordinates (the group
 * mounts at the origin) so every item can settle on its own surface through
 * `park.floorAt` — plaza level inside the piece's paving, terrain outside.
 * Inside a real <Park> the plan's footprint is registered (unless
 * `reserve: false`), which puts the WHOLE piece into validatePark's footprint
 * sweep + the coaster-corridor sweep and pulls the terrain guard clamp under
 * it (AUTO-keepDry), so a set-piece can never sit in water or on a bulge.
 */
export function setPiece<P extends SetPiecePlan>(
  displayName: string,
  build: (t: typeof THREE, plan: P, park: ParkContextValue) => THREE.Group | ComposableBuilt,
): React.FC<SetPieceProps<P>> {
  const Component: React.FC<SetPieceProps<P>> = ({ plan, reserve }) => {
    const inScene = useComposable(
      (t, park) => {
        const res = build(t, plan, park);
        const built: ComposableBuilt = (res as THREE.Object3D).isObject3D
          ? { group: res as THREE.Group }
          : (res as ComposableBuilt);
        if ((reserve ?? plan.reserve) && !isPreview(park)) {
          const unregister = park.registerFootprint(plan.footprint);
          const prev = built.dispose;
          built.dispose = () => {
            prev?.();
            unregister();
          };
        }
        return built;
      },
      { position: [0, 0, 0], rotation: 0, deps: [plan.key, reserve] },
    );
    if (!inScene) console.warn(`<${displayName}> must be rendered inside a <Park> or <ScenePreview> — nothing mounted`);
    return null;
  };
  Component.displayName = displayName;
  return Component;
}

// ---- shared dressing builders (one lighting/furniture language) ------------

const IRON = 0x2f2f34;
const LAMP_GLASS = 0xfff2c0;
const LAMP_GLOW = 0xffc85a;

export interface SetPieceLampOpts {
  /** post height (default 2.4) */
  height?: number;
  /** give this lamp a real PointLight (keep 2-4 per piece — the park runtime
   *  admits the nearest `budgets.lights` globally) */
  light?: boolean;
}

/**
 * The family's park lamp: iron post, night-gated lantern head and an optional
 * small PointLight. `hook` is the string-light anchor (RCT2 rule: spans hang
 * hook-to-hook between REAL poles, never in mid-air).
 */
export function setPieceLamp(
  t: typeof THREE,
  at: [number, number, number],
  opts: SetPieceLampOpts = {},
): { group: THREE.Group; hook: [number, number, number]; update: (time: number) => void } {
  const h = opts.height ?? 2.4;
  const g = new t.Group();
  const [x, y, z] = at;
  g.add(cyl(t, 0.13, 0.17, 0.14, IRON, [x, y + 0.07, z], { tex: 'metal', rough: 0.6, metal: 0.5, seg: 12 }));
  g.add(cyl(t, 0.045, 0.06, h, IRON, [x, y + h / 2, z], { tex: 'metal', repeat: [1, 4], rough: 0.55, metal: 0.55, seg: 12 }));
  const glass = new t.MeshStandardMaterial({ color: LAMP_GLASS, emissive: LAMP_GLOW, emissiveIntensity: 0.12, roughness: 0.35 });
  const lantern = new t.Mesh(new t.BoxGeometry(0.24, 0.3, 0.24), glass);
  lantern.position.set(x, y + h + 0.14, z);
  lantern.castShadow = true;
  g.add(lantern);
  // iron cage: four corner ribs + a pyramidal cap
  [-1, 1].forEach((sx) =>
    [-1, 1].forEach((sz) =>
      g.add(box(t, [0.024, 0.32, 0.024], IRON, [x + sx * 0.12, y + h + 0.14, z + sz * 0.12], { tex: 'metal', metal: 0.5, rough: 0.5 })),
    ),
  );
  g.add(cyl(t, 0.02, 0.22, 0.12, IRON, [x, y + h + 0.36, z], { tex: 'metal', metal: 0.5, rough: 0.5, seg: 4 }));
  g.add(ball(t, 0.038, IRON, [x, y + h + 0.45, z], { metal: 0.6, rough: 0.45 }));
  let light: THREE.PointLight | null = null;
  if (opts.light) {
    light = new t.PointLight(LAMP_GLOW, 0, 5.2, 2);
    light.position.set(x, y + h + 0.05, z);
    g.add(light);
  }
  const update = (time: number) => {
    const k = nightKOf(g);
    const ease = k * k * (3 - 2 * k);
    const flicker = 1 + 0.03 * Math.sin(time * 5.3 + x * 1.7 + z * 2.3);
    glass.emissiveIntensity = 0.1 + 1.55 * ease * flicker;
    if (light) light.intensity = 0.9 * ease * flicker;
  };
  return { group: g, hook: [x, y + h + 0.02, z], update };
}

/** a night-gated festival span between two REAL lamp hooks; the bulb count is
 *  capped so one piece never eats the park's whole light budget */
export function setPieceSpan(
  t: typeof THREE,
  from: [number, number, number],
  to: [number, number, number],
  opts: { colors?: number[]; sag?: number; bulbs?: number } = {},
): { group: THREE.Group; update: (time: number) => void } {
  const dist = Math.hypot(to[0] - from[0], to[1] - from[1], to[2] - from[2]);
  const bulbs = opts.bulbs ?? Math.max(5, Math.min(9, Math.round(dist / 0.75)));
  return buildStringLights(t, from, to, { bulbs, sag: opts.sag ?? 0.3 + dist * 0.03, colors: opts.colors });
}

/** a park bench facing `yaw` (its seat looks down local +z, like Kit's) */
export function setPieceBench(t: typeof THREE, at: [number, number, number], yaw: number): THREE.Group {
  const g = kitBench(t);
  g.position.set(at[0], at[1], at[2]);
  g.rotation.y = yaw;
  return g;
}

/** the yaw that makes a prop's local +z look at `target` */
export const yawToward = (from: XZ, target: XZ): number => Math.atan2(target[0] - from[0], target[1] - from[1]);

// ---- round-6 channels: planted footprints + solid blockers ------------------
//
// Set-pieces speak the SAME safeguard channels as the rest of the catalog
// instead of carrying private machinery: `park.registerPlanted` (validatePark's
// `scenery` gate — dryness + never standing in a walked slab; plaza dressing is
// exempt) and `park.registerBlocker` (the GameManager's routing registry +
// validatePark's `blockers` gate — guests walk AROUND solid things). Thin posts
// (lamp columns, flagpoles) are planted but NOT blockers: RCT2 lets guests brush
// past a lamp, and a blocker per lamp would fence a boulevard in.

/** ground-contact radius of the catalog dressing a set-piece plants */
export const PLANTED_RADIUS: Record<string, number> = {
  bench: 0.5,
  lamp: 0.2,
  tree: 0.7,
  planterBox: 0.72,
  topiarySpiral: 0.4,
  topiaryElephant: 0.55,
  marbleStatue: 0.55,
  birdbath: 0.4,
  parkClock: 0.28,
  signpost: 0.3,
  flagpole: 0.22,
  picnicTable: 0.8,
  gazebo: 1.35,
  wishingWell: 0.5,
};
export const plantedRadius = (name: string): number => PLANTED_RADIUS[name] ?? 0.5;

/** collects a set-piece's `registerPlanted` / `registerBlocker` unregisters so
 *  the component can hand ONE `dispose` back to `setPiece` */
export function setPieceRegistry(park: ParkContextValue, plan: SetPiecePlan) {
  const undo: (() => void)[] = [];
  return {
    /** a planted prop (scenery/tree/bench/lamp) with its ground radius */
    plant(name: string, at: XZ, r = plantedRadius(name)) {
      undo.push(park.registerPlanted({ label: `<${plan.kind} ${plan.id}> ${name} at [${at[0].toFixed(1)}, ${at[1].toFixed(1)}]`, x: at[0], z: at[1], r }));
    },
    /** a SOLID circle guests must walk around (fountain basins, planters that
     *  really are walls) — keep the piece's own path nodes clear of it */
    blockCircle(name: string, at: XZ, r: number, kind = 'scenery', height = 1) {
      undo.push(
        park.registerBlocker({
          circle: { cx: at[0], cz: at[1], r },
          label: `<${plan.kind} ${plan.id}> ${name}`,
          kind,
          height,
        }),
      );
    },
    dispose: () => undo.forEach((u) => u()),
  };
}

// ---- preview staging ------------------------------------------------------

/**
 * PREVIEW ONLY: render the paving a real park's `<Paths>` would render for
 * these plans (interior sub-nets, port stubs and plaza rects), so a
 * *.previews.tsx file shows the piece as it composes. Pass the result as
 * `<ScenePreview dress={...}>`. Never use this inside a real <Park> — there
 * `<Paths nodes={NET.nodes} edges={NET.edges} plazas={NET.plazas}>` owns every
 * path surface.
 */
export function setPiecePaving(
  plans: SetPiecePlan[],
  opts: { y?: number; width?: number; bins?: boolean; extraNodes?: XZ[]; extraEdges?: [NetRef, NetRef][] } = {},
): (t: typeof THREE, g: THREE.Group) => (time: number) => void {
  return (t, g) => {
    const net = buildParkNet({
      nodes: opts.extraNodes,
      edges: opts.extraEdges,
      pieces: plans,
      prunePorts: false, // previews SHOW the port stubs
      quiet: true,
    });
    const built = buildPathNetwork(
      t,
      { nodes: net.nodes.map((n) => [n[0], n[1]] as XZ), edges: net.edges.map((e) => [e[0], e[1]] as [number, number]) },
      { width: opts.width ?? 1.1, y: opts.y ?? -0.096, plazas: net.plazas, grid: false },
    );
    g.add(built.group);
    if (opts.bins !== false)
      net.bins.forEach(([x, z]) => {
        const b = kitBin(t);
        b.position.set(x, 0, z);
        g.add(b);
      });
    return built.update;
  };
}

/** PREVIEW/DEBUG: low markers on every port (+ its outward arrow) and posts
 *  at the piece footprint corners — the contract made visible */
export function buildPortMarkers(t: typeof THREE, plans: SetPiecePlan[]): THREE.Group {
  const g = new t.Group();
  const MARK = 0xd8b54a;
  plans.forEach((plan) => {
    plan.ports.forEach((p) => {
      g.add(cyl(t, 0.075, 0.1, 1.1, MARK, [p.at[0], 0.55, p.at[1]], { tex: 'metal', metal: 0.5, rough: 0.5, seg: 10 }));
      g.add(ball(t, 0.16, MARK, [p.at[0], 1.2, p.at[1]], { metal: 0.6, rough: 0.4 }));
      g.add(
        box(t, [0.09, 0.09, 0.8], MARK, [p.at[0] + p.dir[0] * 0.55, 1.0, p.at[1] + p.dir[1] * 0.55], {
          tex: 'metal',
          metal: 0.5,
          rough: 0.5,
          rotY: Math.atan2(p.dir[0], p.dir[1]),
        }),
      );
    });
    const { cx, cz, hx, hz, yaw } = plan.footprint;
    [-1, 1].forEach((sx) =>
      [-1, 1].forEach((sz) => {
        const w = rotateXZ(yaw, [sx * hx, sz * hz]);
        g.add(cyl(t, 0.05, 0.05, 1.5, 0xb03a30, [cx + w[0], 0.75, cz + w[1]], { tex: 'metal', metal: 0.5, rough: 0.5, seg: 8 }));
      }),
    );
  });
  return g;
}

/** DEBUG composable: `<PortMarkers plans={[...]} />` inside a <ScenePreview> */
export const PortMarkers: React.FC<{ plans: SetPiecePlan[] }> = ({ plans }) => {
  const inScene = useComposable((t) => buildPortMarkers(t, plans), {
    position: [0, 0, 0],
    rotation: 0,
    deps: plans.map((p) => p.key).join('|'),
  });
  if (!inScene) console.warn('<PortMarkers> must be rendered inside a <Park> or <ScenePreview> — nothing mounted');
  return null;
};

// ---------------------------------------------------------------------------
// BLOCKER REGISTRY — solid things guests must walk AROUND
//
// RCT2 peeps live on path tiles, so nothing solid is ever walkable. Here
// locomotion is a graph walk plus off-network waypoint hops, so solidity is
// explicit: fountains, ride bodies/pads, shop bodies, restroom huts and every
// <Fence> run register a world-space OBB or circle. Three consumers:
//   1. the ROUTING GATE — `buildRouting({ edgeAllowed })` refuses path edges
//      whose span crosses a blocker, so goal routes plan around them and
//      wandering never strolls into one (spur/access edges are exempt: they
//      ARE the sanctioned way in). Both fall back to the unfiltered graph
//      rather than deadlock; validatePark fails the layout instead.
//   2. `moveToward` — every off-network hop (stall fronts, doorways, bins,
//      queue joins) SLIDES along a blocker's edge instead of entering it, and
//      a guest who somehow starts inside one is pushed straight out.
//   3. `blocked` / `blockerDepth` / `blockers()` — the read side, used by
//      validatePark's street-vs-blocker gate and the harness probes.
//
// Cost: shapes are bucketed into a coarse uniform grid (rebuilt only when the
// registry changes), so a guest's per-step test touches ~0-2 candidates, and
// edge verdicts are memoised per (a, b) until the registry changes.
// ---------------------------------------------------------------------------

import { BLOCKER_PAD } from './types';
import type { BlockerKind, BlockerSpec, BlockerRectSpec, BlockerCircleSpec, BlockerHandle, BlockerInfo } from './types';
import type { SimNet } from './sim';

export interface BlockerRec {
  label: string;
  kind: BlockerKind;
  owner: string | null;
  height: number;
  pad: number;
  circle: boolean;
  cx: number;
  cz: number;
  hx: number;
  hz: number;
  yaw: number;
  cos: number;
  sin: number;
  r: number;
}

export function createBlockerRegistry(net: SimNet | null) {
  const blockerRecs: BlockerRec[] = [];
  let blockerRev = 0;
  const B_CELL = 1.5;
  let blockerGrid: Map<string, BlockerRec[]> | null = null;
  const NO_BLOCKERS: BlockerRec[] = [];
  const bKey = (i: number, j: number) => `${i},${j}`;
  /** world AABB half-extents of a blocker, inflated by its pad */
  const bExtent = (b: BlockerRec): [number, number] =>
    b.circle
      ? [b.r + b.pad, b.r + b.pad]
      : [
          Math.abs(b.cos) * (b.hx + b.pad) + Math.abs(b.sin) * (b.hz + b.pad),
          Math.abs(b.sin) * (b.hx + b.pad) + Math.abs(b.cos) * (b.hz + b.pad),
        ];
  const buildBlockerGrid = () => {
    const g = new Map<string, BlockerRec[]>();
    for (const b of blockerRecs) {
      const [ex, ez] = bExtent(b);
      const i0 = Math.floor((b.cx - ex) / B_CELL);
      const i1 = Math.floor((b.cx + ex) / B_CELL);
      const j0 = Math.floor((b.cz - ez) / B_CELL);
      const j1 = Math.floor((b.cz + ez) / B_CELL);
      for (let i = i0; i <= i1; i += 1)
        for (let j = j0; j <= j1; j += 1) {
          const k = bKey(i, j);
          const list = g.get(k);
          if (list) list.push(b);
          else g.set(k, [b]);
        }
    }
    blockerGrid = g;
  };
  let gridRev = -1;
  const blockersNear = (x: number, z: number): BlockerRec[] => {
    if (!blockerRecs.length) return NO_BLOCKERS;
    if (gridRev !== blockerRev || !blockerGrid) {
      buildBlockerGrid();
      gridRev = blockerRev;
    }
    return blockerGrid!.get(bKey(Math.floor(x / B_CELL), Math.floor(z / B_CELL))) ?? NO_BLOCKERS;
  };
  /** penetration depth of (x, z) into `b` (0 = outside) */
  const bDepth = (b: BlockerRec, x: number, z: number): number => {
    if (b.circle) {
      const d = Math.hypot(x - b.cx, z - b.cz);
      return Math.max(0, b.r + b.pad - d);
    }
    const dx = x - b.cx;
    const dz = z - b.cz;
    const lx = dx * b.cos - dz * b.sin;
    const lz = dx * b.sin + dz * b.cos;
    const ox = b.hx + b.pad - Math.abs(lx);
    if (ox <= 0) return 0;
    const oz = b.hz + b.pad - Math.abs(lz);
    if (oz <= 0) return 0;
    return Math.min(ox, oz);
  };
  /** unit outward normal that pushes (x, z) OUT of `b` the short way */
  const bNormal = (b: BlockerRec, x: number, z: number): [number, number] => {
    if (b.circle) {
      const dx = x - b.cx;
      const dz = z - b.cz;
      const m = Math.hypot(dx, dz);
      return m > 1e-6 ? [dx / m, dz / m] : [1, 0];
    }
    const dx = x - b.cx;
    const dz = z - b.cz;
    const lx = dx * b.cos - dz * b.sin;
    const lz = dx * b.sin + dz * b.cos;
    const ox = b.hx + b.pad - Math.abs(lx);
    const oz = b.hz + b.pad - Math.abs(lz);
    if (ox <= oz) {
      const s = lx >= 0 ? 1 : -1;
      return [b.cos * s, -b.sin * s]; // local +x in world
    }
    const s = lz >= 0 ? 1 : -1;
    return [b.sin * s, b.cos * s]; // local +z in world
  };
  /** the first blocker (x, z) sits inside, skipping `owner`'s own */
  const blockerAt = (x: number, z: number, owner?: string | null): BlockerRec | null => {
    const near = blockersNear(x, z);
    for (let i = 0; i < near.length; i += 1) {
      const b = near[i];
      if (owner && b.owner === owner) continue;
      if (bDepth(b, x, z) > 0) return b;
    }
    return null;
  };
  const registerBlocker = (spec: BlockerSpec): BlockerHandle => {
    const rec: BlockerRec = {
      label: spec.label,
      kind: spec.kind ?? 'scenery',
      owner: spec.owner ?? null,
      height: spec.height ?? 1,
      pad: spec.pad ?? BLOCKER_PAD,
      circle: false,
      cx: 0,
      cz: 0,
      hx: 0,
      hz: 0,
      yaw: 0,
      cos: 1,
      sin: 0,
      r: 0,
    };
    const shape = (s: { rect?: BlockerRectSpec; circle?: BlockerCircleSpec }) => {
      if (s.circle) {
        rec.circle = true;
        rec.cx = s.circle.cx;
        rec.cz = s.circle.cz;
        rec.r = Math.max(0.02, s.circle.r);
      } else if (s.rect) {
        rec.circle = false;
        rec.cx = s.rect.cx;
        rec.cz = s.rect.cz;
        rec.hx = Math.max(0.01, s.rect.hx);
        rec.hz = Math.max(0.01, s.rect.hz);
        rec.yaw = s.rect.yaw ?? 0;
        rec.cos = Math.cos(rec.yaw);
        rec.sin = Math.sin(rec.yaw);
      }
      blockerRev += 1;
    };
    if (!spec.rect && !spec.circle) {
      console.warn(`[GameManager] registerBlocker(${spec.label}): needs a rect or a circle — nothing registered`);
      return { label: spec.label, remove: () => {}, move: () => {}, set: () => {} };
    }
    shape(spec);
    if (!Number.isFinite(rec.cx) || !Number.isFinite(rec.cz)) {
      console.warn(`[GameManager] registerBlocker(${spec.label}): centre [${rec.cx}, ${rec.cz}] is not finite — nothing registered`);
      return { label: spec.label, remove: () => {}, move: () => {}, set: () => {} };
    }
    blockerRecs.push(rec);
    return {
      label: rec.label,
      remove: () => {
        const i = blockerRecs.indexOf(rec);
        if (i >= 0) {
          blockerRecs.splice(i, 1);
          blockerRev += 1;
        }
      },
      move: (dx, dz) => {
        rec.cx += dx;
        rec.cz += dz;
        blockerRev += 1;
      },
      set: shape,
    };
  };
  /** is (x, z) inside a solid object? (`owner` exempts its own blockers) */
  const blocked = (x: number, z: number, o: { owner?: string | null } = {}): BlockerInfo | null => {
    const b = blockerAt(x, z, o.owner);
    return b ? infoOf(b) : null;
  };
  /** how deep (x, z) sits inside the WORST blocker (0 = free) */
  const blockerDepth = (x: number, z: number, o: { owner?: string | null } = {}): number => {
    const near = blockersNear(x, z);
    let worst = 0;
    for (let i = 0; i < near.length; i += 1) {
      const b = near[i];
      if (o.owner && b.owner === o.owner) continue;
      const d = bDepth(b, x, z);
      if (d > worst) worst = d;
    }
    return worst;
  };
  const infoOf = (b: BlockerRec): BlockerInfo => ({
    label: b.label,
    kind: b.kind,
    owner: b.owner,
    height: b.height,
    pad: b.pad,
    ...(b.circle ? { circle: { cx: b.cx, cz: b.cz, r: b.r } } : { rect: { cx: b.cx, cz: b.cz, hx: b.hx, hz: b.hz, yaw: b.yaw } }),
  });
  /** every registered blocker (validatePark's street sweep, harness probes) */
  const blockersList = (): BlockerInfo[] => blockerRecs.map(infoOf);

  // ---- the routing gate: path edges that cross a blocker are not walkable ---
  // ACCESS SPURS ARE EXEMPT: a queue tail / ride exit / stall front / restroom
  // doorway / park-gate spur IS the sanctioned way into its object, so the
  // logical attach edges are always walkable (their objects register their own
  // bodies clear of those approach points).
  const spurNodes = new Set<number>();
  const edgeVerdict = new Map<string, boolean>();
  let verdictRev = -1;
  const edgeAllowed = (a: number, b: number): boolean => {
    if (!blockerRecs.length || !net) return true;
    if (spurNodes.has(a) || spurNodes.has(b)) return true;
    if (verdictRev !== blockerRev) {
      edgeVerdict.clear();
      verdictRev = blockerRev;
    }
    const key = a < b ? `${a}:${b}` : `${b}:${a}`;
    const hit = edgeVerdict.get(key);
    if (hit !== undefined) return hit;
    const [ax, az] = net.nodes[a];
    const [bx, bz] = net.nodes[b];
    const len = Math.hypot(bx - ax, bz - az);
    const steps = Math.max(1, Math.ceil(len / 0.3));
    let ok = true;
    for (let k = 0; k <= steps; k += 1) {
      const u = k / steps;
      if (blockerAt(ax + (bx - ax) * u, az + (bz - az) * u, null)) {
        ok = false;
        break;
      }
    }
    edgeVerdict.set(key, ok);
    return ok;
  };

  return {
    /** the live registry — `recs.length` is locomotion's fast "anything solid?" */
    recs: blockerRecs,
    spurNodes,
    bDepth,
    bNormal,
    blockerAt,
    registerBlocker,
    blocked,
    blockerDepth,
    blockersList,
    edgeAllowed,
  };
}

import React from 'react';
import * as THREE from 'three';
import { mergedBoxes } from '../Stage';
import type { MergedBoxSpec } from '../Stage';
import { composable } from '../Park';
import type { ParkContextValue } from '../Park';

// ---------------------------------------------------------------------------
// Fence — RCT2-style park fencing as RUNS between world xz points. Three
// styles, all built from BOXES and batched with `mergedBoxes` (one draw call
// per material — fences are static dressing, never per-frame animated):
//
//   'wood'   classic post-and-rail: square weathered posts (buried 0.08 for
//            ground contact) with little chamfer caps and TWO horizontal
//            rails per bay, each bay pitched to the ground under it
//   'metal'  the RCT2 queue railing: slim galvanized uprights + a top and a
//            mid rail — thin tubular read at park zoom, the style the
//            GameManager's queue lanes are railed with
//   'hedge'  a clipped privet: one continuous leaf-textured body in short
//            overlapping segments with hashed height/yaw variation and a
//            sprinkle of close-up-only top clumps
//
// Every run FOLLOWS THE TERRAIN through the `groundAt` sampler (posts stand
// on the real ground, rails follow the grade bay by bay) and reports its
// world-space OBB spans as `blockers` — the shape `<Fence>` hands to the
// GameManager blocker registry so guests walk AROUND the fence instead of
// through it. Night-safe: no lights, no updater, no emissive.
// Deterministic — hashed sines only.
// ---------------------------------------------------------------------------

export type XZ = [number, number];

export type FenceStyle = 'wood' | 'metal' | 'hedge';

const hash01 = (n: number) => {
  const s = Math.sin(n * 12.9898 + 78.233) * 43758.5453;
  return s - Math.floor(s);
};

interface StyleSpec {
  /** default fence height above the ground */
  height: number;
  /** post pitch (hedge: segment length) along the run */
  spacing: number;
  /** post cross-section (hedge: body width) */
  sec: number;
  /** rail thickness across the run / rail height */
  railT: number;
  railH: number;
  /** rail heights as fractions of the fence height */
  rails: number[];
  /** post / body colour and rail colour */
  post: number;
  rail: number;
  tex: 'wood' | 'metal' | 'leaf';
  metal: number;
  rough: number;
  /** little post caps (wood) */
  cap: boolean;
  /** blocker half-thickness across the run */
  halfWidth: number;
}

/** the three RCT2 fence styles — muted, realistic park palette */
export const FENCE_STYLES: Record<FenceStyle, StyleSpec> = {
  wood: {
    height: 0.85,
    spacing: 1.2,
    sec: 0.09,
    railT: 0.045,
    railH: 0.115,
    rails: [0.42, 0.78],
    post: 0x8b6a44,
    rail: 0xa07d52,
    tex: 'wood',
    metal: 0,
    rough: 0.9,
    cap: true,
    halfWidth: 0.1,
  },
  metal: {
    height: 0.52,
    spacing: 0.42,
    sec: 0.042,
    railT: 0.032,
    railH: 0.032,
    rails: [0.48, 0.92],
    post: 0x8f959e,
    rail: 0xaab1b9,
    tex: 'metal',
    metal: 0.5,
    rough: 0.42,
    cap: false,
    halfWidth: 0.07,
  },
  hedge: {
    height: 0.72,
    spacing: 0.3,
    sec: 0.38,
    railT: 0,
    railH: 0,
    rails: [],
    post: 0x46662f,
    rail: 0x3b5726,
    tex: 'leaf',
    metal: 0,
    rough: 1,
    cap: false,
    halfWidth: 0.21,
  },
};

/** one straight leg of fencing, in the builder's own xz frame */
export interface FenceRun {
  from: XZ;
  to: XZ;
}

export interface FenceOpts {
  /** 'wood' (default) | 'metal' (queue railing) | 'hedge' */
  style?: FenceStyle;
  /** fence height above the ground (default: the style's) */
  height?: number;
  /** post pitch / hedge segment length (default: the style's) */
  spacing?: number;
  /** terrain sampler the posts stand on (default: flat y = 0) */
  groundAt?: (x: number, z: number) => number;
  /** trim this much off BOTH ends of every run — leaves a gateway/doorway
   *  clear (the blocker spans shrink with the geometry) */
  inset?: number;
  /** hashed-variation salt (hedge) */
  seed?: number;
}

/** a fenced span as a world-space rotated rect — the blocker-registry shape */
export interface FenceBlocker {
  cx: number;
  cz: number;
  hx: number;
  hz: number;
  yaw: number;
}

export interface BuiltFence {
  group: THREE.Group;
  style: FenceStyle;
  height: number;
  /** total fenced length in units (after `inset` trimming) */
  length: number;
  /** post positions in the builder's frame (loop corners included) */
  posts: XZ[];
  /** ONE rotated-rect OBB per fenced span — feed straight to
   *  `registerBlocker({ rect })` (world space when from/to were world xz) */
  blockers: FenceBlocker[];
}

/**
 * Build ANY number of straight fence legs as ONE batched rig (one merged mesh
 * per material). `runs` are straight legs in world xz; the rails follow the
 * ground under each bay through `groundAt`.
 */
export function buildFenceRuns(t: typeof THREE, runs: FenceRun[], opts: FenceOpts = {}): BuiltFence {
  const style = opts.style ?? 'wood';
  const st = FENCE_STYLES[style];
  const H = Math.max(0.18, opts.height ?? st.height);
  const gAt = opts.groundAt ?? (() => 0);
  const spacing = Math.max(0.12, opts.spacing ?? st.spacing);
  const inset = Math.max(0, opts.inset ?? 0);
  const salt = opts.seed ?? 0;

  const bodySpecs: MergedBoxSpec[] = []; // posts (wood/metal) or hedge body
  const railSpecs: MergedBoxSpec[] = [];
  const capSpecs: MergedBoxSpec[] = []; // close-up-only caps / leaf clumps
  const posts: XZ[] = [];
  const blockers: FenceBlocker[] = [];
  let total = 0;
  const eul = new t.Euler(0, 0, 0, 'YXZ');

  runs.forEach((run, ri) => {
    const len0 = Math.hypot(run.to[0] - run.from[0], run.to[1] - run.from[1]);
    if (len0 < 1e-4) return;
    const ux = (run.to[0] - run.from[0]) / len0;
    const uz = (run.to[1] - run.from[1]) / len0;
    const len = len0 - inset * 2;
    if (len < 0.14) return; // trimmed away entirely
    const ax = run.from[0] + ux * inset;
    const az = run.from[1] + uz * inset;
    const yaw = Math.atan2(ux, uz); // local +z runs from → to
    total += len;
    blockers.push({
      cx: ax + ux * (len / 2),
      cz: az + uz * (len / 2),
      hx: st.halfWidth,
      hz: len / 2 + st.halfWidth,
      yaw,
    });

    if (style === 'hedge') {
      // one continuous clipped body: short OVERLAPPING segments so the top
      // line can wobble (hashed) without opening a gap in the hedge
      const n = Math.max(1, Math.round(len / spacing));
      const step = len / n;
      for (let k = 0; k < n; k += 1) {
        const u = (k + 0.5) * step;
        const x = ax + ux * u;
        const z = az + uz * u;
        // CLIPPED: the width stays constant and the yaw barely moves (a hedge
        // is trimmed, not wild) — only the crown height wobbles a little
        const hh = H * (0.965 + hash01(ri * 7.3 + k * 3.7 + salt) * 0.07);
        bodySpecs.push({
          dims: [st.sec, hh + 0.1, step + 0.04],
          pos: [x, gAt(x, z) + hh / 2 - 0.05, z],
          rotY: yaw + (hash01(ri * 4.7 + k * 1.9 + salt) - 0.5) * 0.02,
          repeat: [2, Math.max(2, Math.round(step * 6))],
        });
        // close-up detail: a couple of darker leaf clumps riding the crown
        if (k % 2 === 0) {
          const cu = u + (hash01(ri * 8.1 + k * 2.3 + salt) - 0.5) * step * 0.5;
          const cx = ax + ux * cu;
          const cz = az + uz * cu;
          const lat = (hash01(ri * 6.7 + k * 9.1 + salt) - 0.5) * st.sec * 0.55;
          capSpecs.push({
            dims: [0.17, 0.11, 0.17],
            pos: [cx + uz * lat, gAt(cx, cz) + hh - 0.02, cz - ux * lat],
            rotY: yaw + hash01(ri * 3.3 + k * 7.7 + salt) * 0.8,
            repeat: [1, 1],
          });
        }
      }
      posts.push([ax, az], [ax + ux * len, az + uz * len]);
      return;
    }

    // post-and-rail / railing: posts at an even pitch, one always at each end
    const n = Math.max(1, Math.round(len / spacing));
    const step = len / n;
    for (let i = 0; i <= n; i += 1) {
      const x = ax + ux * (i * step);
      const z = az + uz * (i * step);
      posts.push([x, z]);
      const g0 = gAt(x, z);
      bodySpecs.push({
        dims: [st.sec, H + 0.09, st.sec],
        pos: [x, g0 + H / 2 - 0.045, z],
        rotY: yaw,
        repeat: [1, Math.max(2, Math.round(H * 4))],
      });
      if (st.cap)
        capSpecs.push({
          dims: [st.sec + 0.038, 0.046, st.sec + 0.038],
          pos: [x, g0 + H + 0.016, z],
          rotY: yaw,
          repeat: [1, 1],
        });
    }
    // rails: one pitched bay at a time, so a run over a slope keeps its rails
    // parallel to the ground instead of floating or ploughing into it
    for (let i = 0; i < n; i += 1) {
      const x0 = ax + ux * (i * step);
      const z0 = az + uz * (i * step);
      const x1 = ax + ux * ((i + 1) * step);
      const z1 = az + uz * ((i + 1) * step);
      const g0 = gAt(x0, z0);
      const g1 = gAt(x1, z1);
      for (const r of st.rails) {
        const y0 = g0 + H * r;
        const y1 = g1 + H * r;
        const rl = Math.hypot(step, y1 - y0);
        eul.set(-Math.atan2(y1 - y0, step), yaw, 0);
        const m = new t.Matrix4().makeRotationFromEuler(eul);
        m.setPosition((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
        railSpecs.push({ dims: [st.railT, st.railH, rl], matrix: m, repeat: [1, Math.max(2, Math.round(rl * 3))] });
      }
    }
  });

  const group = new t.Group();
  if (bodySpecs.length)
    group.add(mergedBoxes(t, bodySpecs, st.post, { tex: st.tex, metal: st.metal, rough: st.rough, bump: style === 'hedge' ? 0.05 : 0.02 }));
  if (railSpecs.length) group.add(mergedBoxes(t, railSpecs, st.rail, { tex: st.tex, metal: st.metal, rough: st.rough }));
  if (capSpecs.length) {
    const caps = mergedBoxes(t, capSpecs, st.rail, { tex: st.tex, metal: st.metal, rough: st.rough });
    caps.userData.lodDetail = true; // chamfer caps / leaf clumps: close-up only
    group.add(caps);
  }
  return { group, style, height: H, length: total, posts, blockers };
}

/** ONE straight fence run between two xz points (the common case) */
export function buildFence(t: typeof THREE, opts: FenceOpts & { from: XZ; to: XZ }): BuiltFence {
  return buildFenceRuns(t, [{ from: opts.from, to: opts.to }], opts);
}

/**
 * Fence a POLYGON / polyline: consecutive `points` are joined leg by leg
 * (`closed` — the default — also joins the last point back to the first), and
 * the whole loop is ONE batched rig. Corner posts land exactly on the
 * vertices because every leg plants a post at both of its ends.
 */
export function buildFenceLoop(t: typeof THREE, points: XZ[], opts: FenceOpts & { closed?: boolean } = {}): BuiltFence {
  const closed = opts.closed ?? true;
  const runs: FenceRun[] = [];
  for (let i = 0; i + 1 < points.length; i += 1) runs.push({ from: points[i], to: points[i + 1] });
  if (closed && points.length > 2) runs.push({ from: points[points.length - 1], to: points[0] });
  return buildFenceRuns(t, runs, opts);
}

// ---------------------------------------------------------------------------
// <Fence> — the COMPOSABLE component (components/Park/Context.md convention).
//
// `from`/`to` (or `points`) are WORLD xz — a fence run IS its own position, so
// <Fence> takes no `position` prop: the rig mounts at the world origin and
// every post settles onto the terrain under it via the park's floor sampler.
// Inside a real <Park> each fenced span also REGISTERS as a blocker, so guests
// path around the fence (GameManager.registerBlocker — GameManager/Context.md
// "Blockers"; leave a GATEWAY where a street crosses a boundary or
// validatePark's `blockers` gate fails the layout).
// ---------------------------------------------------------------------------

export interface FenceProps {
  /** run start in world xz (with `to`) */
  from?: XZ;
  /** run end in world xz (with `from`) */
  to?: XZ;
  /** polygon/polyline corners in world xz — an alternative to from/to */
  points?: XZ[];
  /** close a `points` polygon back to its first corner (default true) */
  closed?: boolean;
  /** 'wood' (default) | 'metal' (queue railing) | 'hedge' */
  style?: FenceStyle;
  /** fence height above the ground (default: the style's) */
  height?: number;
  /** post pitch / hedge segment length (default: the style's) */
  spacing?: number;
  /** trim both ends of every leg — leaves a gateway clear */
  inset?: number;
  seed?: number;
  /** register the fenced spans with the GameManager so guests walk AROUND
   *  them (default true; `false` = pure dressing guests may walk through) */
  blocking?: boolean;
  /** blocker label prefix in reports/lints (default 'fence') */
  label?: string;
}

type FenceBuilt = { group: THREE.Group; blockers: FenceBlocker[]; style: FenceStyle; height: number; length: number; posts: XZ[] };

const runsOf = (p: FenceProps): FenceRun[] => {
  if (p.points && p.points.length >= 2) {
    const runs: FenceRun[] = [];
    for (let i = 0; i + 1 < p.points.length; i += 1) runs.push({ from: p.points[i], to: p.points[i + 1] });
    if ((p.closed ?? true) && p.points.length > 2) runs.push({ from: p.points[p.points.length - 1], to: p.points[0] });
    return runs;
  }
  if (p.from && p.to) return [{ from: p.from, to: p.to }];
  console.warn('<Fence> needs either from + to or points (world xz) — nothing mounted');
  return [];
};

const FenceBase = composable<FenceProps, FenceBuilt>(
  'Fence',
  (t, props, park) =>
    buildFenceRuns(t, runsOf(props), {
      style: props.style,
      height: props.height,
      spacing: props.spacing,
      inset: props.inset,
      seed: props.seed,
      groundAt: (x, z) => park.floorAt(x, z),
    }),
  {
    compose: (park: ParkContextValue, { built, props }) => {
      if (props.blocking === false) return;
      const label = props.label ?? `<Fence ${built.style}>`;
      const hs = built.blockers.map((b) =>
        park.registerBlocker({
          rect: b,
          label: `${label} span @[${b.cx.toFixed(1)}, ${b.cz.toFixed(1)}]`,
          height: built.height,
          kind: 'fence',
        }),
      );
      return () => hs.forEach((h) => h());
    },
  },
);

/** RCT2 park fencing: `<Fence from to style height/>` or `<Fence points/>` */
export const Fence: React.FC<FenceProps> = (props) => <FenceBase {...props} position={[0, 0, 0]} />;
Fence.displayName = 'Fence';

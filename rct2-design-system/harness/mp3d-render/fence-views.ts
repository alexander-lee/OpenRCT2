// ---------------------------------------------------------------------------
// fence-views.ts — zero-arg BUILDERS for shot-views.mjs / probe-fence-attach.mjs.
//
// `<Fence>`'s ScenePreview auto-rotates and exposes no camera prop, and
// shot-views.mjs can only call `fn(THREE)`. buildFence needs `from`/`to`, so
// each export here pins ONE short run of ONE style (short so the ortho frame is
// filled by the joinery, not by 12 u of repeat) and returns `{ group }`.
//
//   node shot-views.mjs wood --comp=../../harness/mp3d-render/fence-views:wood
//
// A matching `*Slope` builder puts the same run over a 12% grade, which is where
// pitched rails / planted posts either work or float.
// ---------------------------------------------------------------------------
import * as THREE from 'three';
import { buildFence } from '../../mp3d/components/Fence';
import type { FenceStyle } from '../../mp3d/components/Fence';

type T = typeof THREE;

const run = (t: T, style: FenceStyle, len: number, grade = 0) =>
  buildFence(t, {
    from: [0, -len / 2],
    to: [0, len / 2],
    style,
    seed: 3,
    groundAt: (_x, z) => grade * (z + len / 2),
  });

export const wood = (t: T) => run(t, 'wood', 2.4);
export const woodSlope = (t: T) => run(t, 'wood', 3.6, 0.18);
export const metal = (t: T) => run(t, 'metal', 1.26);
export const metalSlope = (t: T) => run(t, 'metal', 2.1, 0.18);
export const hedge = (t: T) => run(t, 'hedge', 1.2);
export const hedgeSlope = (t: T) => run(t, 'hedge', 2.4, 0.18);
export const picket = (t: T) => run(t, 'picket' as FenceStyle, 2.4);
export const picketSlope = (t: T) => run(t, 'picket' as FenceStyle, 3.6, 0.18);
export const brick = (t: T) => run(t, 'brick' as FenceStyle, 2.4);
export const brickSlope = (t: T) => run(t, 'brick' as FenceStyle, 3.6, 0.18);
// the THEMED queue railing: `color` overrides the tone only (GameManager's
// buildQueueLane passes surface.rail), so this must still read as posts + rails
export const metalThemed = (t: T) =>
  buildFence(t, { from: [0, -0.63], to: [0, 0.63], style: 'metal', color: 0x7a4a2e, seed: 3, groundAt: () => 0 });

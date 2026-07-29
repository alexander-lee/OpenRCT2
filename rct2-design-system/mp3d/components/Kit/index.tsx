// ---------------------------------------------------------------------------
// Kit — shared scenery builders, modelled from RCT2 scenery sprites. Static
// builders return a THREE.Group; animated ones return { group, update }.
// Deterministic: scatter uses a hashed-sine sequence, never Math.random.
//
// DETAILED (2026-07) to SceneryPack's vocabulary — base courses, mouldings,
// cornices, finials, hip caps, root flares, bedded contact everywhere, and
// comments carrying the contact arithmetic. Two hard rules held throughout:
//
//  1. BATCH, don't sprinkle. `tree` is the most-placed asset in the system
//     (ParkBuilder/dressing scatters it by the hundred, Boulevard lines every
//     street, CoasterBuilder wraps every layout), and one mesh is one draw
//     call PER INSTANCE. Detailing SceneryPack's 20 pieces with loose
//     primitives once took a measured park from 1148 → 3374 draws, past the
//     Stage's ~3000 budget. Every repeated part here goes through
//     `mergedBoxes` / `mergedParts`, so the four tree shapes got MORE detail
//     for FEWER draws (7/5/14/12 meshes → 4/3/4/4).
//
//  2. `tree`, `bench` and `bin` are consumed downstream and their BOUNDS ARE
//     FROZEN. dressing.ts sinks trees 0.07 into the grade and reserves a 0.62
//     radius, Boulevard sinks them 0.05, `<Placed>` derives a wet-cell
//     footprint radius from the built group, and SetPieceKit seats kitBench /
//     kitBin on paving. So every part that defines an extreme of those three
//     is kept VERBATIM and all new detail is provably inside it — measured, not
//     asserted (harness/mp3d-render/probe-kit-cost.mjs prints the AABBs):
//        tree round  [-1, 0, -0.9]           → [1.05, 2.4, 0.86]
//        tree pine   [-0.55, 0, -0.55]       → [0.55, 2.46, 0.55]
//        tree palm   [-0.84, -0.055, -0.882] → [0.88, 1.82, 0.882]
//        tree willow [-0.635, 0, -0.611]     → [0.635, 2.1, 0.611]
//        bench       [-0.5, -0.01, -0.3]     → [0.5, 0.87, 0.22]
//        bin         [-0.18, 0, -0.18]       → [0.18, 0.575, 0.18]
//     bench also keeps its ORIENTATION contract: the backrest is at −z, so the
//     seat looks down local +z (SetPieceKit's setPieceBench relies on it).
//
// The builders live in ./plants.ts (tree, hedge, flowerBed, rock) and
// ./props.ts (bench, bin, statue, foodStall, fence, lamp, fountain); this file
// is the single public entry point, so `import { tree, rock } from
// './components/Kit'` keeps working exactly as before.
// ---------------------------------------------------------------------------
import React from 'react';
import * as THREE from 'three';
import { composable } from '../Park';
import { tree, hedge, flowerBed, rock } from './plants';
import { bench, bin, statue, foodStall, fence, lamp, fountain } from './props';

export type { T } from './shared';
export { tree, hedge, flowerBed, rock } from './plants';
export { bench, bin, statue, foodStall, fence, lamp, fountain } from './props';

// Showcase: EVERY scenery builder together (trees, bench, bin, fence, hedge,
// rock, food stall, statues, flower bed, lamp, fountain) — the museum ring:
// 13 exhibits on an ellipse around the central fountain, long pieces turned
// tangent to the ring, everything inside the fixed 45° camera frame.
export function buildKitScene(three: typeof THREE): { group: THREE.Group; update?: (time: number) => void } {
  const group = new three.Group();
  const update =
    ((t: typeof THREE, g: THREE.Group) => {
        const A = 4.0; // ellipse half-axis, x
        const B = 2.6; // ellipse half-axis, z
        const ring = (obj: THREE.Object3D, i: number, n: number, tangent = false) => {
          const th = (i / n) * Math.PI * 2;
          obj.position.set(Math.cos(th) * A, 0, Math.sin(th) * B);
          if (tangent) obj.rotation.y = -th; // long pieces lie along the ring
          // Each front turns radially OUTWARD, not inward: `rotation.y = π/2 − th`
          // sends local +z to (cos th, 0, −sin th)·… i.e. away from the fountain,
          // so a bench's seat and the stall's counter face the visitor walking
          // round the ring rather than the exhibit opposite. (The comment here
          // used to claim "toward the centre", which is the opposite of what the
          // arithmetic does.)
          else obj.rotation.y = Math.PI / 2 - th;
          g.add(obj);
        };
        const N = 13;
        ring(foodStall(t), 0, N);
        ring(bench(t), 1, N);
        ring(bin(t), 2, N);
        ring(fence(t, 2), 3, N, true);
        ring(rock(t), 4, N);
        ring(statue(t, 'obelisk'), 5, N);
        ring(tree(t, { shape: 'pine' }), 6, N);
        ring(tree(t, { shape: 'palm' }), 7, N);
        ring(flowerBed(t), 8, N);
        ring(statue(t, 'giraffe'), 9, N);
        const l = lamp(t);
        ring(l.group, 10, N);
        ring(tree(t), 11, N);
        ring(hedge(t, 2), 12, N, true);
        const f = fountain(t);
        f.group.position.set(0, 0, 0);
        g.add(f.group);
        return (time) => {
          l.update(time);
          f.update(time);
        };
      })(three, group) || undefined;
  return { group, update };
}

/** <Kit> — composable (components/Park/Context.md): mounts the scene at
 *  `position`/`rotation`/`scale` inside a <Park> or <ScenePreview>. */
export const Kit = composable('Kit', (t) => buildKitScene(t));

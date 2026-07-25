import React from 'react';
import * as THREE from 'three';

import { buildRock } from '../Rock';
import { composable } from '../Park';

// Deterministic rock outcrop ported from the reference scenery kit: several
// buildRock boulders scattered over an elliptical footprint with seeded
// pseudo-random positions, per-rock scale variation, free yaw plus a slight
// settle tilt, each partially buried so the group reads as one weathered
// formation grown out of the ground rather than dropped onto it.

// deterministic sequence PRNG (no Math.random / Date.now)
function seeded(seed: number) {
  let i = 0;
  return () => {
    i += 1;
    const v = Math.sin(seed * 127.1 + i * 311.7 + 74.7) * 43758.5453;
    return v - Math.floor(v);
  };
}

const CLUSTER_TINTS = [0x7b786f, 0x6b675c, 0x84796a, 0x736d60];

export interface RockClusterOpts {
  /** number of boulders (default 9) */
  count?: number;
  seed?: number;
  /** footprint extent along x (default 3) */
  width?: number;
  /** footprint extent along z (default 2.2) */
  length?: number;
  /** base boulder radius (default 0.42) */
  size?: number;
  /** 0..1 per-rock scale spread (default 0.45) */
  variation?: number;
  /** base colour override for every rock (defaults to a grey-brown mix) */
  tint?: number;
  /** ground sampler so rocks conform to a terrain heightfield (default flat 0) */
  heightAt?: (x: number, z: number) => number;
}

/** Natural rock outcrop: varied, tilted, partially buried boulders. */
export function buildRockCluster(t: typeof THREE, opts: RockClusterOpts = {}): THREE.Group {
  const count = Math.max(1, Math.min(60, Math.round(opts.count ?? 9)));
  const seed = opts.seed ?? 5;
  const width = opts.width ?? 3;
  const length = opts.length ?? 2.2;
  const size = opts.size ?? 0.42;
  const variation = opts.variation ?? 0.45;
  const ground = opts.heightAt ?? (() => 0);
  const rnd = seeded(seed);

  const root = new t.Group();
  for (let i = 0; i < count; i++) {
    // bias placement toward the centre so the formation has a heart
    const ax = rnd() * 2 - 1;
    const az = rnd() * 2 - 1;
    const px = ax * Math.abs(ax) * width * 0.5;
    const pz = az * Math.abs(az) * length * 0.5;
    const scale = Math.max(0.12, size * (1 + (rnd() * 2 - 1) * variation) * (1 - 0.25 * Math.hypot(ax, az)));
    const tint = opts.tint ?? CLUSTER_TINTS[Math.floor(rnd() * CLUSTER_TINTS.length)];
    const rock = buildRock(t, { scale, seed: seed * 31 + i * 7 + 1, tint });
    // partially buried: sink each boulder a varied fraction of its radius
    rock.position.set(px, ground(px, pz) - scale * (0.1 + rnd() * 0.22), pz);
    rock.rotation.set((rnd() - 0.5) * 0.3, rnd() * Math.PI * 2, (rnd() - 0.5) * 0.24);
    root.add(rock);
  }
  return root;
}

export function buildRockClusterScene(three: typeof THREE): { group: THREE.Group; update?: (time: number) => void } {
  const group = new three.Group();
  const update =
    ((t: typeof THREE, g: THREE.Group) => {
        g.add(buildRockCluster(t));
        // satellite cluster sits along the screen-x diagonal (fixed 45° camera)
        const small = buildRockCluster(t, { count: 4, seed: 21, size: 0.2, width: 1.4, length: 1 });
        small.position.set(1.8, 0, -1.4);
        g.add(small);
      })(three, group) || undefined;
  return { group, update };
}

/** <RockCluster> — composable (components/Park/Context.md): mounts the scene at
 *  `position`/`rotation`/`scale` inside a <Park> or <ScenePreview>. */
export const RockCluster = composable('RockCluster', (t) => buildRockClusterScene(t));

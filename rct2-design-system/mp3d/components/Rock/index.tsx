import React from 'react';
import * as THREE from 'three';
import { mat } from '../Stage';
import { composable } from '../Park';

// Deterministic faceted boulder ported from the reference scenery kit: an
// icosahedron squashed into a natural footprint, every vertex displaced by a
// position-hashed pseudo-random amount (so shared corners stay welded and the
// same seed always yields the same rock), flat shaded and skinned with our
// procedural 'concrete' texture in realistic grey-brown tints.

const ROCK_TINTS = [0x7b786f, 0x6b675c, 0x84796a, 0x736d60, 0x8a8276];

// deterministic sequence PRNG (no Math.random / Date.now)
function seeded(seed: number) {
  let i = 0;
  return () => {
    i += 1;
    const v = Math.sin(seed * 127.1 + i * 311.7 + 74.7) * 43758.5453;
    return v - Math.floor(v);
  };
}

// position hash — duplicated (non-indexed) vertices at the same coordinate get
// the same value, so displacement never cracks the mesh
function hash3(x: number, y: number, z: number, salt: number) {
  const v = Math.sin(x * 127.1 + y * 311.7 + z * 74.7 + salt * 53.13) * 43758.5453;
  return v - Math.floor(v);
}

export interface RockOpts {
  /** overall radius of the boulder, world units (default 0.5) */
  scale?: number;
  /** deterministic variation seed (default 1) */
  seed?: number;
  /** base colour; defaults to a grey-brown picked from the seed */
  tint?: number;
}

/** Single deterministic faceted rock. Group origin sits at ground level. */
export function buildRock(t: typeof THREE, opts: RockOpts = {}): THREE.Group {
  const scale = opts.scale ?? 0.5;
  const seed = opts.seed ?? 1;
  const tint = opts.tint ?? ROCK_TINTS[Math.abs(Math.trunc(seed)) % ROCK_TINTS.length];
  const rnd = seeded(seed);

  const geo = new t.IcosahedronGeometry(scale, 1);
  geo.scale(0.8 + rnd() * 0.35, 0.55 + rnd() * 0.3, 0.8 + rnd() * 0.35);

  // deterministic vertex roughening: radial swell + lateral jitter per vertex
  const pos = geo.getAttribute('position') as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const k = 1 + (hash3(x, y, z, seed) - 0.5) * 0.42;
    const jx = (hash3(x, y, z, seed + 11) - 0.5) * scale * 0.14;
    const jz = (hash3(x, y, z, seed + 23) - 0.5) * scale * 0.14;
    pos.setXYZ(i, x * k + jx, y * k, z * k + jz);
  }
  geo.rotateY(rnd() * Math.PI * 2);
  geo.computeVertexNormals();

  const rock = new t.Mesh(
    geo,
    mat(t, tint, { tex: 'concrete', repeat: [2, 2], flat: true, rough: 1, bump: 0.03 }),
  );
  // rest height chosen so even the shallowest displaced hull (y-squash 0.55,
  // swell 0.79) keeps its lowest vertices at/below ground — never floating,
  // always reading as partially bedded in
  rock.position.y = scale * 0.42;
  rock.castShadow = true;
  rock.receiveShadow = true;

  const root = new t.Group();
  root.add(rock);
  return root;
}

export function buildRockScene(three: typeof THREE): { group: THREE.Group; update?: (time: number) => void } {
  const group = new three.Group();
  const update =
    ((t: typeof THREE, g: THREE.Group) => {
        // spread along the screen-x diagonal for the fixed 45° camera
        const a = buildRock(t, { scale: 0.62, seed: 7 });
        a.position.set(0.1, 0, -0.05);
        g.add(a);
        const b = buildRock(t, { scale: 0.42, seed: 2, tint: 0x84796a });
        b.position.set(-0.95, 0, 0.9);
        g.add(b);
        const c = buildRock(t, { scale: 0.3, seed: 12, tint: 0x6b675c });
        c.position.set(1.05, 0, -0.95);
        g.add(c);
      })(three, group) || undefined;
  return { group, update };
}

/** <Rock> — composable (components/Park/Context.md): mounts the scene at
 *  `position`/`rotation`/`scale` inside a <Park> or <ScenePreview>. */
export const Rock = composable('Rock', (t) => buildRockScene(t));

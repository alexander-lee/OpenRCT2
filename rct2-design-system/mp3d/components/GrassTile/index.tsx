import * as THREE from 'three';
import { box, cyl, ball } from '../Stage';
import { composable } from '../Park';

// A grass land tile modelled from the RCT2 terrain surface: a textured earth
// slab topped with grass, plus tufts, wild daisies and pebbles for detail.
export function buildGrassTile(t: typeof THREE): { group: THREE.Group } {
  const g = new t.Group();
  g.add(box(t, [2, 0.28, 2], 0x6f9e54, [0, 0.14, 0], { tex: 'grass', repeat: [3, 3], rough: 1, bump: 0.04 }));
  g.add(box(t, [2.02, 0.16, 2.02], 0x6a4a2c, [0, -0.02, 0], { tex: 'wood', repeat: [4, 1], rough: 1 })); // soil rim
  // outer + inner rings of grass tufts (bottoms rooted in the slab top 0.28)
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    g.add(box(t, [0.05, 0.14, 0.05], 0x5f8f3a, [Math.cos(a) * 0.7, 0.34, Math.sin(a) * 0.7], { rotZ: 0.2, rough: 0.9 }));
  }
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + 0.55;
    g.add(box(t, [0.04, 0.11, 0.04], 0x6f9e46, [Math.cos(a) * 0.38, 0.325, Math.sin(a) * 0.38], { rotZ: -0.25, rough: 0.9 }));
  }
  // wild daisies: thin stems rooted in the turf, petal heads on top
  const petals = [0xffffff, 0xf0d000, 0xe060a0];
  for (let i = 0; i < 6; i++) {
    const a = i * 2.4; // deterministic spiral spread
    const r = 0.22 + 0.12 * (i % 3);
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    g.add(cyl(t, 0.005, 0.005, 0.1, 0x4c7a3a, [x, 0.33, z], { seg: 5 }));
    g.add(ball(t, 0.028, petals[i % 3], [x, 0.39, z], { flat: true, rough: 0.7 }));
  }
  // pebbles half-bedded in the turf
  g.add(ball(t, 0.09, 0x9a9a92, [0.3, 0.32, -0.2], { tex: 'concrete', repeat: [2, 2], flat: true }));
  g.add(ball(t, 0.05, 0x8a8a82, [-0.55, 0.3, -0.45], { tex: 'concrete', repeat: [2, 2], flat: true }));
  g.add(ball(t, 0.04, 0xa5a59c, [0.62, 0.3, 0.5], { tex: 'concrete', repeat: [2, 2], flat: true }));
  return { group: g };
}

/** <GrassTile> — composable (components/Park/Context.md): mounts one tile at
 *  `position`/`rotation`/`scale` in a <Park> or <ScenePreview>. */
export const GrassTile = composable('GrassTile', (t) => buildGrassTile(t).group);

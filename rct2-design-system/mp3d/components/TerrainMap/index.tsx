import React from 'react';
import * as THREE from 'three';
import { box } from '../Stage';
import { buildWater } from '../WaterTile';
import { composable } from '../Park';

// A generated RCT2-style landscape: a grid of stepped land tiles (discrete
// heights like the game's terrain tool) textured grass on high ground and sand
// at the shoreline, flooded by the animated water shader at sea level. The
// heightfield is deterministic (summed sines) so it renders the same each time.
export function buildTerrainMapScene(three: typeof THREE): { group: THREE.Group; update?: (time: number) => void } {
  const group = new three.Group();
  const update =
    ((t: typeof THREE, g: THREE.Group) => {
        const N = 14;
        const cs = 0.62;
        const sea = 0.5;
        const height = (i: number, j: number) => {
          let h =
            0.55 +
            0.42 * Math.sin(i * 0.55) * Math.cos(j * 0.48) +
            0.28 * Math.sin((i + j) * 0.38) +
            0.18 * Math.cos(i * 0.9 - j * 0.7);
          h = Math.max(0.12, h);
          return Math.round(h / 0.22) * 0.22; // discrete land steps
        };
        // mud base slab seals the seams between tiles and the map underside
        g.add(box(t, [N * cs + 0.02, 0.12, N * cs + 0.02], 0x6d5c43, [0, -0.04, 0], { tex: 'concrete', repeat: [8, 8], rough: 1 }));
        for (let i = 0; i < N; i++) {
          for (let j = 0; j < N; j++) {
            const x = (i - (N - 1) / 2) * cs; // grid centred on the origin
            const z = (j - (N - 1) / 2) * cs;
            const h = height(i, j);
            const sand = h <= sea + 0.16;
            g.add(
              box(t, [cs * 0.98, h, cs * 0.98], sand ? 0xd9c48f : 0x6f9e54, [x, h / 2, z], {
                tex: sand ? 'sand' : 'grass',
                repeat: [1, 1],
                rough: 1,
                bump: 0.03,
              }),
            );
          }
        }
        // sea-level water sheet kept just inside the tile footprint, so its
        // edge always rests over land/base — never hanging in the air
        const water = buildWater(t, N * cs - 0.15, 120);
        water.mesh.position.y = sea;
        g.add(water.mesh);
        return (time) => water.update(time);
      })(three, group) || undefined;
  return { group, update };
}

/** <TerrainMap> — composable (components/Park/Context.md): mounts the scene at
 *  `position`/`rotation`/`scale` inside a <Park> or <ScenePreview>. */
export const TerrainMap = composable('TerrainMap', (t) => buildTerrainMapScene(t));

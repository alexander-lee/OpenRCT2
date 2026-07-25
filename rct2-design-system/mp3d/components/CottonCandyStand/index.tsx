import React from 'react';
import * as THREE from 'three';
import { box, cyl, ball, nightKOf } from '../Stage';
import { buildPeep } from '../Guest';
import { composableStall } from '../Park';

// Cotton candy stand matched to the RCT2 CNDYF stall: the building is a GIANT
// fluffy pink-white candy-floss cloud on a stick stump, with a serving hatch
// tucked into the fluff, a counter, and display cones of floss beside it.
export function buildCottonCandyStandScene(three: typeof THREE, opts: { withGuest?: boolean } = {}): { group: THREE.Group; update?: (time: number) => void } {
  const group = new three.Group();
  const update =
    ((t: typeof THREE, g: THREE.Group) => {
        const PINKS = [0xf2c4d4, 0xf7d7e2, 0xecb0c8, 0xfae6ee];
        // stick stump + main cloud of overlapping fluff balls
        g.add(cyl(t, 0.18, 0.22, 0.5, 0xe8e2d2, [0, 0.25, 0], { tex: 'plastic', repeat: [4, 2], rough: 0.7, seg: 12 }));
        const blobs: [number, number, number, number][] = [
          [0, 1.05, 0, 0.85],
          [-0.55, 0.85, 0.25, 0.5],
          [0.55, 0.9, -0.2, 0.55],
          [0.15, 1.55, 0.1, 0.55],
          [-0.35, 1.4, -0.35, 0.45],
          [0.4, 1.35, 0.4, 0.42],
          [-0.15, 0.75, -0.55, 0.42],
        ];
        blobs.forEach(([x, y, z, r], i) => g.add(ball(t, r, PINKS[i % PINKS.length], [x, y, z], { tex: 'leaf', repeat: [2, 2], flat: true, rough: 0.95 })));
        // wispy strands — centres inside the cloud so only the tips poke out
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2;
          const rr = 0.78 - (i % 3) * 0.08;
          g.add(cyl(t, 0.015, 0.03, 0.3, 0xf7d7e2, [Math.cos(a) * rr, 0.95 + (i % 3) * 0.25, Math.sin(a) * rr], { rough: 0.95, seg: 6, rotZ: Math.cos(a), rotX: Math.sin(a) }));
        }
        // serving hatch nestled in the fluff + counter
        g.add(box(t, [0.55, 0.45, 0.2], 0x3a2030, [0, 0.75, 0.78], { rough: 0.9 }));
        g.add(box(t, [0.7, 0.06, 0.26], 0xd88ab0, [0, 0.52, 0.9], { tex: 'plastic', repeat: [3, 1], rough: 0.6 }));
        // display floss cones on the counter
        [-0.2, 0.2].forEach((x, i) => {
          g.add(cyl(t, 0.015, 0.04, 0.22, 0xf0e6d0, [x, 0.65, 0.92], { rough: 0.7, seg: 8 })); // base sunk 0.01 into the counter
          g.add(ball(t, 0.09, PINKS[i * 2], [x, 0.82, 0.92], { tex: 'leaf', repeat: [2, 2], flat: true, rough: 0.95 }));
        });
        // queue guest holding a floss
        if (opts.withGuest) {
          const p = buildPeep(t, { shirt: 0x8e44ad, expression: 'happy' });
          p.group.scale.setScalar(0.5);
          p.group.position.set(0.45, 0, 1.35);
          p.group.rotation.y = Math.PI;
          g.add(p.group);
        }
        const held = new t.Group();
        held.position.set(0.355, 0.28, 1.35); // gripped through the right hand
        g.add(held);
        held.add(cyl(t, 0.012, 0.03, 0.22, 0xf0e6d0, [0, 0.08, 0], { rough: 0.7, seg: 8 })); // gripped low: the tip stays above the thigh at both lean extremes
        held.add(ball(t, 0.07, 0xecb0c8, [0, 0.16, 0], { tex: 'leaf', repeat: [2, 2], flat: true, rough: 0.95 }));
        // night lighting: pink-warm bulbs across the hatch face (backs at
        // z 0.86 embed in the front at 0.88, y 0.93 clear of the fluff blob
        // surface at distance 0.92 > r 0.85) + a soft counter light
        const bulbMat = new t.MeshStandardMaterial({ color: 0xffe4ee, emissive: 0xff9ec4, emissiveIntensity: 0.15, roughness: 0.35 });
        const bulbGeo = new t.SphereGeometry(0.03, 10, 8);
        [-0.18, -0.06, 0.06, 0.18].forEach((x) => {
          const bulb = new t.Mesh(bulbGeo, bulbMat);
          bulb.position.set(x, 0.93, 0.89);
          g.add(bulb);
        });
        const counterLight = new t.PointLight(0xffd0e0, 0, 3, 2);
        counterLight.position.set(0, 1.0, 1.05);
        g.add(counterLight);
        return (time) => {
          // day -> night gate: candy-pink sign bulbs + counter glow after dark
          const nk = nightKOf(g);
          const ease = nk * nk * (3 - 2 * nk); // smoothstep
          bulbMat.emissiveIntensity = 0.15 + (1.25 + 0.1 * Math.sin(time * 2.8) - 0.15) * ease;
          counterLight.intensity = ease * 0.8;
          held.rotation.z = 0.65 + Math.sin(time * 2) * 0.05; // leaned outboard, clear of the arm
        };
      })(three, group) || undefined;
  return { group, update };
}

/** <CottonCandyStand> — composable stall (components/Park/Context.md): mounts the stall
 *  at `position`/`rotation`; inside a <Park>, `register` (+ `name`/`price`/
 *  `value`) registers a selling stall — the serving front faces local +z. */
export const CottonCandyStand = composableStall<{ withGuest?: boolean }>(
  'CottonCandyStand',
  (t, { withGuest = false }) => buildCottonCandyStandScene(t, { withGuest }),
  {name: 'Cotton Candy',item: 'food',price: 2,value: 4},
);

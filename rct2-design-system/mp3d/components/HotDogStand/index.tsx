import React from 'react';
import * as THREE from 'three';
import { box, cyl, ball, mat, nightKOf } from '../Stage';
import { buildPeep } from '../Guest';
import { composableStall } from '../Park';

// Hot dog stand matched to the RCT2 HOTDS stall: a little fieldstone kiosk
// with a BLUE/WHITE striped awning roof and a GIANT HOT DOG (bun, sausage,
// mustard squiggle) lying along the ridge. Serving hatch + counter in front.
export function buildHotDogStandScene(three: typeof THREE, opts: { withGuest?: boolean } = {}): { group: THREE.Group; update?: (time: number) => void } {
  const group = new three.Group();
  const update =
    ((t: typeof THREE, g: THREE.Group) => {
        const STONE = 0xb6ac98;
        const BLUE = 0x3a6fc0;
        // fieldstone kiosk
        g.add(box(t, [1.5, 1.0, 1.2], STONE, [0, 0.5, 0], { tex: 'concrete', repeat: [6, 4], rough: 0.95, bump: 0.04 }));
        // stepped stone gable fillers so the pitched roof sits ON the kiosk
        // (roof underside: 1.159 at z 0.4, 1.257 at z 0.22 — tops clear both)
        g.add(box(t, [1.46, 0.16, 0.8], STONE, [0, 1.07, 0], { tex: 'concrete', repeat: [6, 1], rough: 0.95, bump: 0.04 }));
        g.add(box(t, [1.46, 0.11, 0.44], STONE, [0, 1.195, 0], { tex: 'concrete', repeat: [6, 1], rough: 0.95, bump: 0.04 }));
        // pitched striped awning roof
        for (let i = 0; i < 8; i++) {
          const col = i % 2 ? 0xffffff : BLUE;
          g.add(box(t, [0.22, 0.05, 0.85], col, [-0.77 + i * 0.22, 1.22, 0.34], { rough: 0.6, rotX: 0.5 })); // slopes down-outward, meets at the ridge
          g.add(box(t, [0.22, 0.05, 0.85], col, [-0.77 + i * 0.22, 1.22, -0.34], { rough: 0.6, rotX: -0.5 }));
        }
        g.add(box(t, [1.7, 0.06, 0.12], BLUE, [0, 1.42, 0], { rough: 0.6 })); // ridge cap
        // scalloped awning skirt over the hatch
        for (let i = 0; i < 6; i++) g.add(ball(t, 0.09, i % 2 ? 0xffffff : BLUE, [-0.6 + i * 0.24, 0.98, 0.64], { flat: true, rough: 0.6 }));
        // GIANT hot dog on the ridge: rounded bun halves + a plump CAPSULE
        // sausage bowed like a banana + a continuous wavy mustard ribbon
        [-1, 1].forEach((s) => {
          const bun = cyl(t, 0.18, 0.18, 1.5, 0xd9a04c, [0, 1.52, s * 0.12], { tex: 'sand', repeat: [6, 1], rough: 0.8, seg: 20, rotZ: Math.PI / 2 });
          g.add(bun);
          [-0.75, 0.75].forEach((bx) => g.add(ball(t, 0.18, 0xd9a04c, [bx, 1.52, s * 0.12], { tex: 'sand', repeat: [3, 3], rough: 0.8 }))); // rounded bun ends
        });
        // sausage: TubeGeometry along a gentle upward banana arc (capsule read
        // — hemisphere end caps below), radius 0.15, 24 radial segments
        const SAUS = 0xa84222;
        const sausR = 0.15;
        const bow = (x: number) => 1.64 + 0.07 * (1 - (x / 0.78) * (x / 0.78)); // sausage centreline
        const sausPts: import('three').Vector3[] = [];
        for (let i = 0; i <= 8; i++) {
          const x = -0.78 + (i / 8) * 1.56;
          sausPts.push(new t.Vector3(x, bow(x), 0));
        }
        const sausCurve = new t.CatmullRomCurve3(sausPts);
        const saus = new t.Mesh(new t.TubeGeometry(sausCurve, 24, sausR, 24), mat(t, SAUS, { tex: 'plastic', repeat: [8, 2], rough: 0.5 }));
        saus.castShadow = true;
        g.add(saus);
        [-1, 1].forEach((e) => {
          const cap = ball(t, sausR, SAUS, [e * 0.78, bow(e * 0.78), 0], { tex: 'plastic', repeat: [3, 3], rough: 0.5 });
          cap.scale.x = 1.25; // stretched along the axis: plump rounded tip
          g.add(cap);
        });
        // mustard: ONE continuous glossy ribbon — a tube following a sine
        // zig-zag along the sausage top, flattened in y (classic squiggle)
        const mustPts: import('three').Vector3[] = [];
        for (let i = 0; i <= 40; i++) {
          const x = -0.64 + (i / 40) * 1.28;
          const z = 0.06 * Math.sin((i / 40) * Math.PI * 9);
          // ride the sausage surface: top of the bowed tube, dipping with |z|
          const y = bow(x) + Math.sqrt(Math.max(0.001, sausR * sausR - z * z)) - 0.012;
          mustPts.push(new t.Vector3(x, (y - 1.8) / 0.62, z)); // pre-divide: mesh scale.y flattens back
        }
        const must = new t.Mesh(new t.TubeGeometry(new t.CatmullRomCurve3(mustPts), 120, 0.032, 10), mat(t, 0xe8b414, { rough: 0.22 }));
        must.position.y = 1.8;
        must.scale.y = 0.62; // flattened ribbon cross-section
        must.castShadow = false;
        g.add(must);
        // hatch + counter + queue guest
        g.add(box(t, [0.6, 0.45, 0.1], 0x241812, [0, 0.62, 0.62], { rough: 0.9 }));
        g.add(box(t, [0.75, 0.07, 0.26], 0x8a5a28, [0, 0.42, 0.72], { tex: 'wood', repeat: [3, 1], rough: 0.8 }));
        if (opts.withGuest) {
          const p = buildPeep(t, { shirt: 0xe0a020, expression: 'neutral' });
          p.group.scale.setScalar(0.5);
          p.group.position.set(-0.3, 0, 1.15);
          p.group.rotation.y = Math.PI;
          g.add(p.group);
        }
        // night lighting: warm bulbs nestled between the awning scallops
        // (backs at z 0.595 embed in the kiosk wall front at 0.6) + a counter
        // light over the hatch
        const bulbMat = new t.MeshStandardMaterial({ color: 0xfff3c0, emissive: 0xffcc55, emissiveIntensity: 0.15, roughness: 0.35 });
        const bulbGeo = new t.SphereGeometry(0.035, 10, 8);
        for (let i = 0; i < 5; i++) {
          const bulb = new t.Mesh(bulbGeo, bulbMat);
          bulb.position.set(-0.48 + i * 0.24, 0.98, 0.63);
          g.add(bulb);
        }
        const counterLight = new t.PointLight(0xffc97a, 0, 3, 2);
        counterLight.position.set(0, 0.95, 0.85);
        g.add(counterLight);
        return (time) => {
          // day -> night gate: sign bulbs + counter glow after dark
          const nk = nightKOf(g);
          const ease = nk * nk * (3 - 2 * nk); // smoothstep
          bulbMat.emissiveIntensity = 0.15 + (1.2 + 0.1 * Math.sin(time * 3.4) - 0.15) * ease;
          counterLight.intensity = ease * 0.8;
        };
      })(three, group) || undefined;
  return { group, update };
}

/** <HotDogStand> — composable stall (components/Park/Context.md): mounts the stall
 *  at `position`/`rotation`; inside a <Park>, `register` (+ `name`/`price`/
 *  `value`) registers a selling stall — the serving front faces local +z. */
export const HotDogStand = composableStall<{ withGuest?: boolean }>(
  'HotDogStand',
  (t, { withGuest = false }) => buildHotDogStandScene(t, { withGuest }),
  {name: 'Hot Dogs',item: 'food',price: 3,value: 5},
);

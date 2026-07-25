import React from 'react';
import * as THREE from 'three';
import { box, cyl, nightKOf } from '../Stage';
import { buildWater } from '../WaterTile';
import { buildPeep, SKIN_TONES } from '../Guest';
import { composableRide } from '../Park';

// Paddle boats matched to the RCT2 SPBOAT sprite: a dark slate-teal hull with
// ORANGE plank stripes across the deck, a churning red paddle wheel at the
// stern and two peeps pedalling around a pond.
export function buildPaddleBoatsScene(three: typeof THREE): { group: THREE.Group; update?: (time: number) => void } {
  const group = new three.Group();
  const update =
    ((t: typeof THREE, g: THREE.Group) => {
        const HULL = 0x2e4444; // (sprite #203030/#304040)
        const ORANGE = 0xe8e2d2; // cream deck planks (realistic)
        // pond: sandy bank + the SHARED animated water shader (WaterTile),
        // radius-clipped to the pond circle
        g.add(cyl(t, 2.5, 2.6, 0.16, 0x9a8a5f, [0, 0.02, 0], { tex: 'sand', repeat: [12, 1], rough: 1, seg: 36 }));
        g.add(cyl(t, 2.42, 2.42, 0.06, 0x1e83c4, [0, 0.08, 0], { rough: 0.5, seg: 36 })); // pond bed — bright aqua so read-through stays blue, never slate
        // build the sheet OVERSIZED in local units then scale it down 2.4x:
        // the shader's wave/colour pattern lives in LOCAL space, so this packs
        // ~2.4x more wave cycles across the pond — colour reads as ripples
        // instead of two giant deep/shallow patches. amp 0.1 calms the world
        // swell to ±0.013 (waterline 0.13, troughs 0.117) so the sheet never
        // dips below the pond bed top (0.11) — the old full swell punched
        // through and showed flat bed patches; colour/foam keep full range
        const water = buildWater(t, 12, 120, 5.76, undefined, 0.1);
        water.mesh.scale.setScalar(2.4 / 5.76);
        water.mesh.position.y = 0.13;
        g.add(water.mesh);
        // night lighting (minimal — boat ponds close at dusk): one shore lamp
        // post on the bank at radius 2.30 (boat sweep max ~2.15), its glow
        // reflecting off the water
        const lampMat = new t.MeshStandardMaterial({ color: 0xfff3c0, emissive: 0xffcc55, emissiveIntensity: 0.15, roughness: 0.35 });
        g.add(cyl(t, 0.03, 0.04, 1.1, 0x2c2c30, [1.78, 0.6, 1.78], { metal: 0.5, rough: 0.5, seg: 8 })); // 0.05..1.15, base in the SAND ring (r 2.52 — dry, past the 2.4 water edge)
        const lampHead = new t.Mesh(new t.SphereGeometry(0.06, 10, 8), lampMat);
        lampHead.position.set(1.78, 1.18, 1.78); // bottom 1.12 embeds in the pole top
        g.add(lampHead);
        const shoreLight = new t.PointLight(0xffc97a, 0, 5, 2);
        shoreLight.position.set(1.78, 1.12, 1.78);
        g.add(shoreLight);
        const boats: { grp: THREE.Group; wheel: THREE.Group; ph: number }[] = [];
        for (let i = 0; i < 2; i++) {
          const boat = new t.Group();
          g.add(boat);
          // hull with orange plank stripes
          boat.add(box(t, [0.6, 0.16, 1.15], HULL, [0, 0.06, 0], { tex: 'plastic', repeat: [2, 3], rough: 0.5 }));
          for (let k = 0; k < 5; k++) boat.add(box(t, [0.62, 0.03, 0.1], ORANGE, [0, 0.15, -0.4 + k * 0.2], { rough: 0.5 }));
          boat.add(box(t, [0.5, 0.2, 0.25], HULL, [0, 0.22, -0.28], { tex: 'plastic', rough: 0.5 })); // seat block
          boat.add(box(t, [0.44, 0.14, 0.22], HULL, [0, 0.21, -0.08], { tex: 'plastic', rough: 0.5 })); // pedal console under the riders' feet
          // stern paddle wheel: blades (radius 0.11) proud of the hub discs and churning
          // the 0.13 waterline, tips clear of the hull stern (-0.575) and of the pond bed
          // (0.11) at the bob minimum; carried on a static axle + two stern support arms
          const wheel = new t.Group();
          wheel.position.set(0, 0.1, -0.7);
          boat.add(wheel);
          for (let k = 0; k < 6; k++) wheel.add(box(t, [0.5, 0.02, 0.22], 0xa8322a, [0, 0, 0], { rough: 0.55, rotX: (k / 6) * Math.PI }));
          [-0.26, 0.26].forEach((x) => wheel.add(cyl(t, 0.085, 0.085, 0.03, 0xb03030, [x, 0, 0], { rotZ: Math.PI / 2, rough: 0.55, seg: 12 })));
          boat.add(cyl(t, 0.02, 0.02, 0.68, 0x2c2c30, [0, 0.1, -0.7], { rotZ: Math.PI / 2, metal: 0.6, rough: 0.4, seg: 8 })); // axle through the hub discs
          [-0.3, 0.3].forEach((x) => boat.add(box(t, [0.04, 0.04, 0.26], 0x2c2c30, [x, 0.1, -0.62], { metal: 0.5, rough: 0.45 }))); // support arms hull -> axle ends, outboard of the spinning discs
          // padded bench: cushions + backrest with back pads, and a grab rail
          // (water-ride restraint) spanning the console at the riders' hands
          boat.add(box(t, [0.5, 0.14, 0.05], HULL, [0, 0.39, -0.425], { tex: 'plastic', rough: 0.5 })); // backrest board
          boat.add(cyl(t, 0.012, 0.012, 0.36, 0x2c2c30, [0, 0.44, -0.17], { rotZ: Math.PI / 2, metal: 0.6, rough: 0.35, seg: 8 })); // grab rail
          [-0.15, 0.15].forEach((x) => boat.add(cyl(t, 0.01, 0.01, 0.17, 0x2c2c30, [x, 0.365, -0.17], { metal: 0.6, rough: 0.35, seg: 6 }))); // rail stems off the console
          // two pedalling peeps on visible cushions
          [0.13, -0.13].forEach((x, pi) => {
            boat.add(box(t, [0.16, 0.04, 0.18], 0x7a4a28, [x, 0.335, -0.28], { tex: 'fabric', repeat: [2, 1], rough: 0.95 })); // seat cushion (top 0.355)
            boat.add(box(t, [0.16, 0.1, 0.03], 0x7a4a28, [x, 0.41, -0.395], { tex: 'fabric', repeat: [2, 1], rough: 0.95 })); // back pad on the backrest
            const p = buildPeep(t, { skin: SKIN_TONES[(i + pi * 2) % SKIN_TONES.length], shirt: pi ? 0xe0a020 : 0x18a0a0, seated: true });
            p.group.scale.setScalar(0.34);
            p.group.position.set(x, 0.19, -0.28); // hip underside 0.343 settles into the cushion, hands at the rail
            boat.add(p.group);
          });
          boats.push({ grp: boat, wheel, ph: i * Math.PI });
        }
        return (time) => {
          // day -> night gate for the shore lamp
          const nk = nightKOf(g);
          const ease = nk * nk * (3 - 2 * nk); // smoothstep
          lampMat.emissiveIntensity = 0.15 + (1.15 - 0.15) * ease;
          shoreLight.intensity = ease * 1.0;
          water.update(time);
          boats.forEach(({ grp, wheel, ph }) => {
            const a = time * 0.35 + ph;
            grp.position.set(Math.cos(a) * 1.5, 0.14 + Math.sin(time * 2.2 + ph) * 0.015, Math.sin(a) * 1.5); // hull bottom 0.12 sits at the 0.13 waterline, clear of the pond bed (0.11)
            grp.rotation.y = -a; // bow along travel
            wheel.rotation.x = time * 4;
          });
        };
      })(three, group) || undefined;
  return { group, update };
}

/** <PaddleBoats> — composable ride (components/Park/Context.md): mounts the ride
 *  at `position`/`rotation`; inside a <Park>, `register` wires the full
 *  GameManager ride via <ConfigurableRide> — queue HEAD 1.5 out the local +z
 *  front (lane extending +z), exit hut beside it at local [-1.5, 1.35],
 *  boarding at the base. Override with top-level props / `queue`. */
export const PaddleBoats = composableRide(
  'PaddleBoats',
  (t) => buildPaddleBoatsScene(t),
  { defaults: { name: 'Paddle Boats', capacity: 4, rideDuration: 12, intensity: 1, price: 2 } },
);

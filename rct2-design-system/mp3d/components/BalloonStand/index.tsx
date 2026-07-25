import React from 'react';
import * as THREE from 'three';
import { box, cyl, ball, nightKOf } from '../Stage';
import { buildPeep } from '../Guest';
import { composableStall } from '../Park';

// ---------------------------------------------------------------------------
// BalloonStand — the RCT2 balloon stall: a small colourful kiosk with a
// red/white striped pitched canopy on corner poles, a serving hatch and
// counter, a tether pole holding a bunch of 7 helium balloons (emissive-
// tinted balls on thin string cylinders, swaying gently) plus two single
// balloons tied to the counter. Balloon geometry/colours are deterministic
// (index math only); the sway is animation, and since the contract carries
// no update fn it is driven per-balloon via onBeforeRender + an internal
// THREE.Clock (the same time source the Stage itself animates from).
// ---------------------------------------------------------------------------

const RED = 0xb03a2a;
const CREAM = 0xf5f0e6;
const CANOPY_RED = 0xd03030;
export const BALLOON_COLS = [0xd23c32, 0xe8b020, 0x3f8fd2, 0x3f9e4d, 0xe07020, 0xd268a8, 0x7a4fb0];

// dim a colour for a soft self-lit balloon tint
const dim = (c: number, f: number) =>
  (((((c >> 16) & 255) * f) | 0) << 16) | (((((c >> 8) & 255) * f) | 0) << 8) | (((c & 255) * f) | 0);

/**
 * Contract (GameManager agents code against this): `front` is where a buying
 * guest stands, at ground level in the group's local space — [0, 0, 1.05].
 */
export function buildBalloonStand(t: typeof THREE): { group: THREE.Group; front: [number, number, number] } {
  const g = new t.Group();
  const clk = new t.Clock(); // drives sway only (contract has no update fn)

  // base slab + kiosk body (0.08..0.88) + wood counter + dark serving hatch
  g.add(box(t, [1.24, 0.08, 1.04], 0x9a978e, [0, 0.04, 0], { tex: 'concrete', repeat: [4, 3], rough: 0.95 }));
  g.add(box(t, [1.1, 0.8, 0.9], RED, [0, 0.48, 0], { tex: 'plastic', repeat: [4, 3], rough: 0.6, bump: 0.02 }));
  g.add(box(t, [0.6, 0.35, 0.08], 0x241812, [0, 0.62, 0.46], { rough: 0.9 })); // hatch, 0.05 proud of the body face (0.45)
  g.add(box(t, [1.2, 0.07, 0.3], 0x8a5a28, [0, 0.5, 0.55], { tex: 'wood', repeat: [4, 1], rough: 0.8 })); // counter over the body edge

  // corner poles (0.08..1.09) — tops stop just under the canopy underside
  // (y_u = 1.154 + (0.3 − |z|)·tan(0.5) ≈ 1.10 at |z| = 0.4)
  [
    [-1, -1], [1, -1], [-1, 1], [1, 1],
  ].forEach(([sx, sz]) => g.add(cyl(t, 0.03, 0.03, 1.01, 0x8a8f96, [sx * 0.5, 0.585, sz * 0.4], { tex: 'metal', repeat: [1, 4], rough: 0.4, metal: 0.6, seg: 10 })));

  // striped pitched canopy: 8 alternating red/cream slabs per slope (rotX
  // ±0.5, half-span 0.375): outer eave edge y 1.0, inner ridge edge y 1.36
  for (let i = 0; i < 8; i++) {
    const col = i % 2 ? CREAM : CANOPY_RED;
    [-1, 1].forEach((s) =>
      g.add(box(t, [0.16, 0.045, 0.75], col, [-0.56 + i * 0.16, 1.18, s * 0.3], { rough: 0.6, rotX: s * 0.5 })),
    );
  }
  g.add(box(t, [1.36, 0.06, 0.12], CANOPY_RED, [0, 1.38, 0], { rough: 0.6 })); // ridge cap over the 1.36 inner edges
  // scalloped skirt hanging from the front eave (eave edge y 1.0, z 0.63)
  for (let i = 0; i < 8; i++) g.add(ball(t, 0.07, i % 2 ? CREAM : CANOPY_RED, [-0.56 + i * 0.16, 0.98, 0.64], { flat: true, rough: 0.6 }));

  // one balloon: a pivot Group at the tether point; thin string cylinder +
  // emissive-tinted ball at the far end, whole pivot sways via onBeforeRender
  const up = new t.Vector3(0, 1, 0);
  const addBalloon = (tether: [number, number, number], dir: THREE.Vector3, len: number, col: number, phase: number, r = 0.11) => {
    const pivot = new t.Group();
    pivot.position.set(...tether);
    dir.normalize();
    const str = new t.Mesh(
      new t.CylinderGeometry(0.007, 0.007, len, 6),
      new t.MeshStandardMaterial({ color: 0xd8d8d0, roughness: 0.9 }),
    );
    str.position.copy(dir).multiplyScalar(len / 2);
    str.quaternion.setFromUnitVectors(up, dir);
    pivot.add(str);
    pivot.add(ball(t, 0.02, dim(col, 0.7), dir.clone().multiplyScalar(len).toArray() as [number, number, number], { rough: 0.5 })); // knot
    const b = ball(t, r, col, dir.clone().multiplyScalar(len + r * 0.9).toArray() as [number, number, number], {
      tex: 'plastic', repeat: [2, 2], rough: 0.25, emissive: dim(col, 0.22),
    });
    b.scale.set(1, 1.15, 1); // slightly egg-shaped
    b.onBeforeRender = () => {
      const time = clk.getElapsedTime();
      pivot.rotation.x = Math.sin(time * 0.9 + phase) * 0.06;
      pivot.rotation.z = Math.cos(time * 0.7 + phase * 1.7) * 0.06;
    };
    pivot.add(b);
    g.add(pivot);
  };

  // tether pole beside the stand (base disc 0..0.06, pole 0.06..0.96)
  g.add(cyl(t, 0.09, 0.11, 0.06, 0x777d84, [0.78, 0.03, 0.15], { tex: 'metal', repeat: [2, 1], rough: 0.5, metal: 0.6, seg: 12 }));
  g.add(cyl(t, 0.022, 0.028, 0.9, 0x8a8f96, [0.78, 0.51, 0.15], { tex: 'metal', repeat: [1, 4], rough: 0.4, metal: 0.6, seg: 10 }));
  // the bunch: 7 balloons fanning out from the pole top, varied lengths
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    const tilt = 0.32 + 0.06 * (i % 2);
    const len = 0.55 + 0.09 * (i % 3);
    addBalloon(
      [0.78, 0.94, 0.15],
      new t.Vector3(Math.sin(tilt) * Math.cos(a), Math.cos(tilt), Math.sin(tilt) * Math.sin(a)),
      len,
      BALLOON_COLS[i],
      i * 0.9,
    );
  }
  // two single balloons tied to the counter top corners (counter top y 0.535)
  addBalloon([-0.42, 0.54, 0.62], new t.Vector3(0.12, 1, 0.1), 0.38, BALLOON_COLS[1], 4.1, 0.09);
  addBalloon([0.42, 0.54, 0.62], new t.Vector3(-0.1, 1, 0.14), 0.44, BALLOON_COLS[2], 5.3, 0.09);

  // night lighting: three warm hatch-face bulbs (backs at z 0.48 embed in the
  // hatch face 0.50) + ONE counter light, gated by nightKOf via onBeforeRender
  // (the { group, front } contract carries no update fn)
  const bulbMat = new t.MeshStandardMaterial({ color: 0xfff3c0, emissive: 0xffcc55, emissiveIntensity: 0.15, roughness: 0.35 });
  const bulbGeo = new t.SphereGeometry(0.03, 10, 8);
  let gateBulb: THREE.Mesh | null = null;
  [-0.2, 0, 0.2].forEach((x) => {
    const bulb = new t.Mesh(bulbGeo, bulbMat);
    bulb.position.set(x, 0.75, 0.51);
    g.add(bulb);
    gateBulb = bulb;
  });
  const counterLight = new t.PointLight(0xffc97a, 0, 2.8, 2);
  counterLight.position.set(0, 0.95, 0.85);
  g.add(counterLight);
  if (gateBulb) {
    (gateBulb as THREE.Mesh).onBeforeRender = () => {
      const k = nightKOf(g);
      const ease = k * k * (3 - 2 * k); // smoothstep
      bulbMat.emissiveIntensity = 0.15 + 1.25 * ease;
      counterLight.intensity = ease * 0.85;
    };
  }

  return { group: g, front: [0, 0, 1.05] };
}

// Preview: the stall plus a guest at `front` holding a bought balloon —
// armR raised past vertical, the string and balloon parented to the armR
// pivot so they track the hand exactly.
export function buildBalloonStandScene(three: typeof THREE): { group: THREE.Group; update?: (time: number) => void } {
  const group = new three.Group();
  const update =
    ((t: typeof THREE, g: THREE.Group) => {
        const s = buildBalloonStand(t);
        g.add(s.group);
        const p = buildPeep(t, { shirt: 0x2f6fd0, expression: 'happy' });
        p.group.scale.setScalar(0.5);
        p.group.position.set(0, 0, 1.05); // the documented `front` point
        p.group.rotation.y = Math.PI; // facing the counter
        g.add(p.group);
        p.armR.rotation.x = -2.9; // arm raised past vertical: local −y ≈ world up
        // hand ball sits at armR-local [0, −0.32, 0]; string continues along
        // −y (world up) 0.5 further, balloon centre 0.14 past the string end
        const strM = new t.MeshStandardMaterial({ color: 0xd8d8d0, roughness: 0.9 });
        const str = new t.Mesh(new t.CylinderGeometry(0.008, 0.008, 0.5, 6), strM);
        str.position.set(0, -0.32 - 0.25, 0);
        p.armR.add(str);
        const bal = ball(t, 0.15, 0xd23c32, [0, -0.32 - 0.5 - 0.14, 0], { tex: 'plastic', repeat: [2, 2], rough: 0.25, emissive: 0x2e0d0b });
        bal.scale.set(1, 1.15, 1);
        p.armR.add(bal);
        return (time) => {
          p.armR.rotation.z = 0.12 + Math.sin(time * 1.1) * 0.06; // gentle held-balloon sway
          p.group.position.y = Math.abs(Math.sin(time * 2)) * 0.01; // idle shuffle
        };
      })(three, group) || undefined;
  return { group, update };
}

/** <BalloonStand> — composableStall (components/Park/Context.md): mounts the
 *  kiosk at `position`/`rotation`/`scale` inside a <Park> or <ScenePreview>.
 *  Pass `register` inside a real <Park> to make it SELL — item 'balloon',
 *  price 2, value 3 (RCT2 balloon stall pricing): guests route to the counter
 *  front (+z), buy, walk off with the balloon swaying above a relaxed hand,
 *  and eventually it flies away (the GameManager accessory lifecycle). */
export const BalloonStand = composableStall('BalloonStand', (t) => buildBalloonStand(t), {
  name: 'Balloon Stand',
  item: 'balloon',
  price: 2,
  value: 3,
});

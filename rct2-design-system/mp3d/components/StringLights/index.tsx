import React from 'react';
import * as THREE from 'three';
import { box, cyl, ball, nightKOf } from '../Stage';
import { buildPeep, SKIN_TONES, SHIRTS, TROUSERS, HAIRS, Expression } from '../Guest';
import { composable } from '../Park';

// ---------------------------------------------------------------------------
// StringLights — festival string lights strung between poles. A parabolic-sag
// cable (TubeGeometry along a sampled curve) carries evenly spaced emissive
// bulbs; every 4th bulb also gets a small real PointLight so the plaza glows
// under the Stage night toggle without tanking performance. Bulb materials
// twinkle gently in update(time) using deterministic per-bulb phases.
// ---------------------------------------------------------------------------

export interface StringLightOpts {
  /** number of bulbs on the span (default derived from span length) */
  bulbs?: number;
  /** cable sag depth at mid-span in metres (default 0.35) */
  sag?: number;
  /** bulb colours — warm white by default; pass several for a festival cycle */
  colors?: number[];
  /** cable + socket colour (default near-black rubber) */
  wireColor?: number;
}

const WARM_WHITE = 0xffd9a0;

export function buildStringLights(
  t: typeof THREE,
  from: [number, number, number],
  to: [number, number, number],
  opts: StringLightOpts = {},
): { group: THREE.Group; update: (time: number) => void } {
  const group = new t.Group();
  const a = new t.Vector3(...from);
  const b = new t.Vector3(...to);
  const dist = a.distanceTo(b);
  const sag = opts.sag ?? 0.35;
  const bulbs = opts.bulbs ?? Math.max(5, Math.round(dist / 0.45));
  const colors = opts.colors && opts.colors.length ? opts.colors : [WARM_WHITE];
  const wireColor = opts.wireColor ?? 0x26262c;

  // deterministic per-span phase seeded from the anchor coordinates
  const seed = (from[0] * 3.1 + from[2] * 5.7 + to[0] * 1.9 + to[2] * 7.3) % (Math.PI * 2);

  // parabolic sag: y dips by sag * 4u(1-u), deepest at mid-span
  const sagPoint = (u: number) => {
    const p = new t.Vector3().lerpVectors(a, b, u);
    p.y -= sag * 4 * u * (1 - u);
    return p;
  };

  // cable — a thin tube along the sampled sag curve
  const samples: THREE.Vector3[] = [];
  for (let k = 0; k <= 24; k++) samples.push(sagPoint(k / 24));
  const curve = new t.CatmullRomCurve3(samples);
  const wireMat = new t.MeshStandardMaterial({ color: wireColor, roughness: 0.9, metalness: 0.1 });
  const wire = new t.Mesh(new t.TubeGeometry(curve, 32, 0.012, 5, false), wireMat);
  wire.castShadow = true;
  group.add(wire);

  // shared geometry; one material per colour "slot" so neighbours twinkle
  // out of phase (a single-colour string still gets 3 phase slots)
  const bulbGeo = new t.SphereGeometry(0.05, 10, 8);
  const socketGeo = new t.CylinderGeometry(0.02, 0.026, 0.05, 6);
  const socketMat = new t.MeshStandardMaterial({ color: wireColor, roughness: 0.85 });
  const slotCount = colors.length === 1 ? 3 : colors.length;
  const bulbMats: THREE.MeshStandardMaterial[] = [];
  for (let s = 0; s < slotCount; s++) {
    bulbMats.push(
      new t.MeshStandardMaterial({
        color: colors[s % colors.length],
        emissive: colors[s % colors.length],
        emissiveIntensity: 1.1,
        roughness: 0.35,
      }),
    );
  }

  const lights: THREE.PointLight[] = [];
  for (let i = 0; i < bulbs; i++) {
    const u = (i + 1) / (bulbs + 1);
    const p = sagPoint(u);
    const socket = new t.Mesh(socketGeo, socketMat);
    socket.position.set(p.x, p.y - 0.03, p.z);
    group.add(socket);
    const bulb = new t.Mesh(bulbGeo, bulbMats[i % slotCount]);
    bulb.position.set(p.x, p.y - 0.09, p.z);
    group.add(bulb);
    // only a few REAL lights per span — every 4th bulb, small and short-range
    if (i % 4 === 1) {
      const pl = new t.PointLight(colors[i % colors.length], 0.5, 2.8, 2);
      pl.position.set(p.x, p.y - 0.12, p.z);
      group.add(pl);
      lights.push(pl);
    }
  }

  const update = (time: number) => {
    // day/night gate — 0 when the span isn't mounted under a Stage (daytime look)
    const k = nightKOf(group);
    const ease = k * k * (3 - 2 * k); // smoothstep
    bulbMats.forEach((m, s) => {
      // faint daytime glass tint -> full glow + twinkle at night
      const glow = 1.05 + 0.3 * Math.sin(time * 2.1 + seed + s * 2.4);
      m.emissiveIntensity = 0.15 + (glow - 0.15) * ease;
    });
    lights.forEach((pl, li) => {
      pl.intensity = ease * (0.45 + 0.12 * Math.sin(time * 2.1 + seed + li * 1.7));
    });
  };

  return { group, update };
}

/** A dark park light pole with a small finial hook; anchor spans at `hook`. */
export function buildLightPole(
  t: typeof THREE,
  pos: [number, number, number],
  opts: { height?: number } = {},
): { group: THREE.Group; hook: [number, number, number] } {
  const height = opts.height ?? 2.6;
  const IRON = 0x2f2f34;
  const group = new t.Group();
  group.add(cyl(t, 0.09, 0.13, 0.12, IRON, [pos[0], pos[1] + 0.06, pos[2]], { tex: 'metal', rough: 0.6, metal: 0.5 }));
  group.add(cyl(t, 0.035, 0.05, height, IRON, [pos[0], pos[1] + height / 2, pos[2]], { tex: 'metal', repeat: [1, 4], rough: 0.55, metal: 0.55 }));
  group.add(ball(t, 0.055, IRON, [pos[0], pos[1] + height + 0.03, pos[2]], { rough: 0.5, metal: 0.5 })); // finial hook
  return { group, hook: [pos[0], pos[1] + height, pos[2]] };
}

// Festival plaza: four spans zig-zagging between iron poles over a concrete
// slab, with guests strolling underneath. Toggle the Stage to night to see
// the warm bulbs and their pooled light take over.
export function buildStringLightsScene(three: typeof THREE): { group: THREE.Group; update?: (time: number) => void } {
  const group = new three.Group();
  const update =
    ((t: typeof THREE, g: THREE.Group) => {
        // concrete plaza slab
        g.add(box(t, [7.6, 0.12, 5.4], 0x9a978e, [0, 0.06, 0], { tex: 'concrete', repeat: [6, 5], rough: 0.95 }));

        // poles staggered along both long edges -> zig-zag spans
        const left: [number, number, number][] = [
          [-3.2, 0.12, -2.1],
          [-3.2, 0.12, 0],
          [-3.2, 0.12, 2.1],
        ];
        const right: [number, number, number][] = [
          [3.2, 0.12, -1.05],
          [3.2, 0.12, 1.05],
        ];
        const hooks: [number, number, number][] = [];
        [...left, ...right].forEach((p) => {
          const pole = buildLightPole(t, p);
          g.add(pole.group);
        });
        [left[0], right[0], left[1], right[1], left[2]].forEach((p) => hooks.push([p[0], p[1] + 2.6, p[2]]));

        const updaters: ((time: number) => void)[] = [];
        const festival = [WARM_WHITE, 0xf2d98c, 0xd8b46a]; // warm amber mix
        for (let i = 0; i < hooks.length - 1; i++) {
          const span = buildStringLights(t, hooks[i], hooks[i + 1], {
            sag: 0.42,
            colors: i % 2 === 0 ? undefined : festival,
          });
          g.add(span.group);
          updaters.push(span.update);
        }

        // guests strolling under the lights
        const exprs: Expression[] = ['happy', 'neutral', 'happy'];
        const peeps = exprs.map((expression, i) => {
          const p = buildPeep(t, {
            skin: SKIN_TONES[i % SKIN_TONES.length],
            hair: HAIRS[(i + 1) % HAIRS.length],
            shirt: SHIRTS[(i + 2) % SHIRTS.length],
            trousers: TROUSERS[i % TROUSERS.length],
            expression,
          });
          // wrapper keeps the peep on the slab — walk() animates group.position.y
          const seat = new t.Group();
          seat.position.set(i * 1.6 - 1.6, 0.12, (i % 2) * 1.4 - 0.7);
          seat.rotation.y = 0.6 + i * 1.9;
          seat.add(p.group);
          g.add(seat);
          return p;
        });

        return (time) => {
          updaters.forEach((u) => u(time));
          peeps.forEach((p, i) => p.walk(time, i * 1.7));
        };
      })(three, group) || undefined;
  return { group, update };
}

/** <StringLights> — composable (components/Park/Context.md): mounts the scene at
 *  `position`/`rotation`/`scale` inside a <Park> or <ScenePreview>. */
export const StringLights = composable('StringLights', (t) => buildStringLightsScene(t));

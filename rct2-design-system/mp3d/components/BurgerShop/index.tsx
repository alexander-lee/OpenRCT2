import * as THREE from 'three';
import { box, cyl, ball, nightKOf } from '../Stage';
import { buildPeep } from '../Guest';
import { composableStall } from '../Park';

// Burger shop matched to the RCT2 BURGB stall: the building IS a giant burger
// — sesame-dome top bun, lettuce ruffle, patty and cheese layers, bottom bun —
// with a serving hatch cut into the front (local +z), a counter, a lit menu
// board and (optionally) a queueing guest.

export interface BurgerShopOpts {
  /** add the decorative queueing guest (preview flavour — in a composed park
   *  the GameManager's real guests walk up instead; default false) */
  withGuest?: boolean;
}

export function buildBurgerShop(t: typeof THREE, opts: BurgerShopOpts = {}): { group: THREE.Group; update: (time: number) => void } {
  const g = new t.Group();
  const BUN = 0xc9903c;
  const BUN_D = 0xa8722a;
  const LETTUCE = 0x5c9e2e;
  const PATTY = 0x5a3520;
  const CHEESE = 0xe8b020;
  // bottom bun + patty + cheese + lettuce + top bun dome
  g.add(cyl(t, 0.95, 1.05, 0.35, BUN_D, [0, 0.175, 0], { tex: 'sand', repeat: [8, 1], rough: 0.8, seg: 28 })); // 0..0.35 on the ground
  g.add(cyl(t, 1.02, 1.0, 0.18, PATTY, [0, 0.44, 0], { tex: 'asphalt', repeat: [6, 1], rough: 0.95, seg: 28 })); // 0.35..0.53
  g.add(cyl(t, 1.05, 1.02, 0.07, CHEESE, [0, 0.565, 0], { tex: 'plastic', repeat: [8, 1], rough: 0.5, seg: 28 })); // 0.53..0.60
  // lettuce ruffle tucked UNDER the top-bun rim: dome underside at radius
  // 0.99, y 0.575 sits at 1.031, so each r-0.12 ball peeks ~0.08 (33%)
  // radially and its top (0.695) stays inside the dome — nothing floats
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2;
    if (Math.sin(a) > 0.85 && Math.abs(Math.cos(a)) < 0.5) continue; // gap for the serving hatch
    g.add(ball(t, 0.12, LETTUCE, [Math.cos(a) * 0.99, 0.575, Math.sin(a) * 0.99], { tex: 'leaf', repeat: [2, 2], flat: true, rough: 0.9 }));
  }
  const dome = ball(t, 1.05, BUN, [0, 0.72, 0], { tex: 'sand', repeat: [6, 3], rough: 0.75 });
  dome.scale.set(1, 0.72, 1);
  g.add(dome);
  // sesame seeds
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2 + (i % 2) * 0.2;
    const r = 0.45 + (i % 3) * 0.2;
    const s = ball(t, 0.045, 0xf0e2b8, [Math.cos(a) * r, 0.72 + Math.sqrt(Math.max(0, 1 - (r / 1.05) ** 2)) * 0.756, Math.sin(a) * r], { rough: 0.6 }); // 0.756 = 1.05 * 0.72 y-scale, so seeds sit ON the dome surface
    s.scale.set(1, 0.5, 1.4);
    g.add(s);
  }
  // serving hatch set into the patty/cheese band (top 0.585 stays below the
  // bun rim at 0.60 so no dark corners poke through the dome) + counter
  g.add(box(t, [0.66, 0.25, 0.16], 0x241812, [0, 0.46, 0.96], { tex: 'wood', repeat: [3, 1], rough: 0.9 }));
  g.add(box(t, [0.8, 0.07, 0.3], 0x8a5a28, [0, 0.34, 1.08], { tex: 'wood', repeat: [3, 1], rough: 0.8 })); // counter
  // night lighting: warm sign-band bulbs on the hatch face (backs at
  // z 1.015 embed in the face at 1.04, proud of the cheese r 1.05) +
  // a counter light and a small menu-board lamp
  const bulbMat = new t.MeshStandardMaterial({ color: 0xfff3c0, emissive: 0xffcc55, emissiveIntensity: 0.15, roughness: 0.35 });
  const bulbGeo = new t.SphereGeometry(0.035, 10, 8);
  [-0.22, 0, 0.22].forEach((x) => {
    const bulb = new t.Mesh(bulbGeo, bulbMat);
    bulb.position.set(x, 0.56, 1.05);
    g.add(bulb);
  });
  const counterLight = new t.PointLight(0xffc97a, 0, 3, 2);
  counterLight.position.set(0, 0.85, 1.15);
  g.add(counterLight);
  // framed menu board on a wooden post beside the queue, clear of the burger
  const menu = new t.Group();
  menu.position.set(1.3, 0, 0.78);
  menu.rotation.y = -0.5;
  menu.add(cyl(t, 0.03, 0.04, 0.78, 0x6a4a22, [0, 0.39, 0], { tex: 'wood', repeat: [1, 3], rough: 0.9, seg: 10 })); // post
  menu.add(box(t, [0.44, 0.36, 0.05], 0x6a4a22, [0, 0.95, 0], { tex: 'wood', repeat: [2, 2], rough: 0.85 })); // frame
  menu.add(box(t, [0.38, 0.3, 0.02], 0xf5efe0, [0, 0.95, 0.02], { rough: 0.6 })); // white face, 0.005 proud of the frame
  menu.add(box(t, [0.34, 0.05, 0.008], 0xc0392b, [0, 1.06, 0.033], { rough: 0.6 })); // red header stripe
  [0.99, 0.92, 0.85].forEach((y, ri) => menu.add(box(t, [0.3 - ri * 0.04, 0.025, 0.008], 0x5a4632, [-ri * 0.02, y, 0.033], { rough: 0.6 }))); // menu text rows
  // menu-board lamp on the frame top (frame top 1.13; bulb bottom 1.12)
  const menuLamp = new t.Mesh(new t.SphereGeometry(0.04, 10, 8), bulbMat);
  menuLamp.position.set(0, 1.16, 0);
  menu.add(menuLamp);
  const menuLight = new t.PointLight(0xffc97a, 0, 2, 2);
  menuLight.position.set(0, 1.1, 0.25);
  menu.add(menuLight);
  g.add(menu);
  // optional decorative queueing guest
  let peep: ReturnType<typeof buildPeep> | null = null;
  if (opts.withGuest) {
    peep = buildPeep(t, { shirt: 0x2f6fd0, expression: 'happy' });
    peep.group.scale.setScalar(0.5);
    peep.group.position.set(0.35, 0, 1.5);
    peep.group.rotation.y = Math.PI;
    g.add(peep.group);
  }
  const update = (time: number) => {
    // day -> night gate: sign bulbs + counter/menu lights after dark
    const nk = nightKOf(g);
    const ease = nk * nk * (3 - 2 * nk); // smoothstep
    bulbMat.emissiveIntensity = 0.15 + (1.2 - 0.15) * ease;
    counterLight.intensity = ease * 0.8;
    menuLight.intensity = ease * 0.5;
    if (peep) peep.group.position.y = Math.abs(Math.sin(time * 2)) * 0.01; // idle shuffle
  };
  return { group: g, update };
}

export interface BurgerShopProps {
  /** decorative queueing guest (preview flavour) */
  withGuest?: boolean;
}

/** <BurgerShop> — composable stall (components/Park/Context.md): mounts the
 *  burger building at `position`/`rotation`; inside a <Park>, `register`
 *  (+ optional `name`/`price`/`value`) registers a selling food stall with
 *  the GameManager — the serving hatch faces local +z, so aim `rotation` at
 *  the path the customers should approach from. */
export const BurgerShop = composableStall<BurgerShopProps>(
  'BurgerShop',
  (t, { withGuest = false }) => buildBurgerShop(t, { withGuest }),
  { name: 'Burger Bar', item: 'food', price: 3, value: 5 },
);

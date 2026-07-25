import * as THREE from 'three';
import { box, cyl, ball, nightKOf } from '../Stage';
import { buildPeep } from '../Guest';
import { composableStall } from '../Park';

// Soda stand matched to the RCT2 DRNKS stall: a cluster of GIANT SODA CANS
// with REAL can proportions (height ≈ 1.85× diameter), neck taper + bottom
// inset, crisp silver tops with offset stay-tabs and printed two-tone labels
// with a geometric logo mark — one can carrying the serving hatch and
// counter, plus a bendy straw.

export interface SodaStandOpts {
  /** add the decorative queueing guest (preview flavour — in a composed park
   *  the GameManager's real guests walk up instead; default false) */
  withGuest?: boolean;
}

export function buildSodaStandScene(t: typeof THREE, opts: SodaStandOpts = {}): { group: THREE.Group; update: (time: number) => void } {
  const g = new t.Group();
  const cans: [number, number, number, number, number][] = [
    // x, z, radius, height (= 1.85 × diameter), colour — neighbours
    // kiss (overlap <= 0.04), never merge
    [0, 0.15, 0.5, 1.85, 0xc42a2a],
    [-0.66, -0.38, 0.38, 1.4, 0x2e8e3a],
    [0.64, -0.38, 0.36, 1.33, 0x2e8e3a],
    [0.05, -0.72, 0.28, 1.04, 0xc42a2a],
  ];
  cans.forEach(([x, z, r, h, col], ci) => {
    const dark = col === 0xc42a2a ? 0x8a1a1a : 0x1a5e24;
    // body wall (semi-gloss printed plastic, low bump) between the
    // bottom inset and the neck taper
    g.add(cyl(t, r, r, h - 0.19, col, [x, 0.05 + (h - 0.19) / 2 + 0.05, z], { tex: 'plastic', repeat: [6, 2], rough: 0.35, bump: 0.01, seg: 26 }));
    // bottom inset: taper down to a narrower dark foot rim
    g.add(cyl(t, r, r * 0.88, 0.08, col, [x, 0.06, z], { tex: 'plastic', rough: 0.35, seg: 26 }));
    g.add(cyl(t, r * 0.88, r * 0.86, 0.025, dark, [x, 0.012, z], { rough: 0.5, seg: 26 }));
    // neck taper: body chamfers in to the silver rim
    g.add(cyl(t, r * 0.82, r, 0.1, col, [x, h - 0.09, z], { tex: 'plastic', rough: 0.35, seg: 26 }));
    // crisp silver top: seam rim ring + slightly dished lid disc.
    // Metalness stays LOW — the Stage has no environment map, so high
    // metalness renders near-black; low metal + low rough reads silver.
    const rim = new t.Mesh(new t.TorusGeometry(r * 0.8, 0.022, 10, 30), new t.MeshStandardMaterial({ color: 0xdde1e7, metalness: 0.35, roughness: 0.28 }));
    rim.rotation.x = -Math.PI / 2;
    rim.position.set(x, h - 0.03, z);
    g.add(rim);
    g.add(cyl(t, r * 0.78, r * 0.8, 0.035, 0xdde1e7, [x, h - 0.045, z], { metal: 0.3, rough: 0.3, seg: 26 }));
    // offset STAY-TAB: finger ring + tab plate, off-centre, hashed yaw
    const tabA = ci * 2.4 + 0.7; // deterministic per-can orientation
    const tx2 = x + Math.cos(tabA) * r * 0.24;
    const tz2 = z - Math.sin(tabA) * r * 0.24;
    const ringM = new t.Mesh(new t.TorusGeometry(r * 0.13, 0.018, 8, 18), new t.MeshStandardMaterial({ color: 0xc4c9d0, metalness: 0.35, roughness: 0.3 }));
    ringM.rotation.x = -Math.PI / 2;
    ringM.position.set(tx2, h - 0.008, tz2);
    g.add(ringM);
    g.add(box(t, [r * 0.34, 0.016, r * 0.13], 0xc4c9d0, [x + Math.cos(tabA) * r * 0.1, h - 0.014, z - Math.sin(tabA) * r * 0.1], { metal: 0.35, rough: 0.3, rotY: tabA }));
    // printed label: white main band + DARK accent band + thin dark
    // stripe (stepped radii — nothing coplanar, strong two-tone read)
    g.add(cyl(t, r + 0.012, r + 0.012, h * 0.34, 0xf2f0ea, [x, h * 0.56, z], { tex: 'plastic', repeat: [6, 1], rough: 0.4, bump: 0.008, seg: 26 }));
    g.add(cyl(t, r + 0.016, r + 0.016, h * 0.1, dark, [x, h * 0.415, z], { tex: 'plastic', rough: 0.4, seg: 26 }));
    g.add(cyl(t, r + 0.02, r + 0.02, 0.04, dark, [x, h * 0.72, z], { rough: 0.4, seg: 26 }));
    // geometric logo mark on the outward label face: disc + swoosh bar,
    // embedded 5 mm into the band so it hugs the curve
    const la = Math.atan2(x, 1.4 - z) * 0.6; // roughly camera-side (+z), fanned per can
    const lx = x + Math.sin(la) * (r + 0.012 - 0.005);
    const lz = z + Math.cos(la) * (r + 0.012 - 0.005);
    const disc = cyl(t, r * 0.22, r * 0.22, 0.018, dark, [lx, h * 0.6, lz], { rough: 0.35, seg: 20, rotX: Math.PI / 2 });
    disc.rotation.order = 'YXZ';
    disc.rotation.y = la;
    g.add(disc);
    g.add(box(t, [r * 0.62, 0.05, 0.014], dark, [lx, h * 0.49, lz], { rough: 0.35, rotY: la }));
  });
  // bendy straw out of the big can's lid, beside the stay-tab: white
  // riser, ribbed elbow ball hiding the joint, red angled top
  g.add(cyl(t, 0.045, 0.045, 0.6, 0xf0f0f0, [0.13, 2.1, 0.13], { rough: 0.5, seg: 12 }));
  g.add(ball(t, 0.052, 0xf0f0f0, [0.13, 2.4, 0.13], { rough: 0.5 })); // elbow
  g.add(cyl(t, 0.045, 0.045, 0.42, 0xc42a2a, [0.259, 2.525, 0.13], { rough: 0.5, seg: 12, rotZ: -0.8 }));
  // hatch + counter in the big red can + queue guest (can front z 0.65)
  g.add(box(t, [0.5, 0.42, 0.14], 0x241812, [0, 0.62, 0.63], { rough: 0.9 }));
  g.add(box(t, [0.6, 0.06, 0.24], 0x8a5a28, [0, 0.42, 0.7], { tex: 'wood', repeat: [3, 1], rough: 0.8 })); // back corners embedded in the can curve
  // optional decorative queueing guest
  let peep: ReturnType<typeof buildPeep> | null = null;
  if (opts.withGuest) {
    peep = buildPeep(t, { shirt: 0x18a0a0, expression: 'happy' });
    peep.group.scale.setScalar(0.5);
    peep.group.position.set(0.4, 0, 1.2);
    peep.group.rotation.y = Math.PI;
    g.add(peep.group);
  }
  // night lighting: sign-band bulbs along the hatch top (hatch top 0.83;
  // bulb bottoms 0.82 embed) + a counter light over the serving window
  const bulbMat = new t.MeshStandardMaterial({ color: 0xfff3c0, emissive: 0xffcc55, emissiveIntensity: 0.15, roughness: 0.35 });
  const bulbGeo = new t.SphereGeometry(0.03, 10, 8);
  [-0.18, -0.06, 0.06, 0.18].forEach((x) => {
    const bulb = new t.Mesh(bulbGeo, bulbMat);
    bulb.position.set(x, 0.85, 0.71);
    g.add(bulb);
  });
  const counterLight = new t.PointLight(0xffc97a, 0, 3, 2);
  counterLight.position.set(0, 0.9, 0.9);
  g.add(counterLight);
  const update = (time: number) => {
    // day -> night gate: sign bulbs + counter glow after dark
    const nk = nightKOf(g);
    const ease = nk * nk * (3 - 2 * nk); // smoothstep
    bulbMat.emissiveIntensity = 0.15 + (1.2 + 0.1 * Math.sin(time * 3.1) - 0.15) * ease;
    counterLight.intensity = ease * 0.8;
    if (peep) peep.group.position.y = Math.abs(Math.sin(time * 2)) * 0.01; // idle shuffle
  };
  return { group: g, update };
}

export interface SodaStandProps {
  /** decorative queueing guest (preview flavour) */
  withGuest?: boolean;
}

/** <SodaStand> — composable stall (components/Park/Context.md): mounts the
 *  giant-can cluster at `position`/`rotation`; inside a <Park>, `register`
 *  (+ optional `name`/`price`/`value`) registers a selling drink stall with
 *  the GameManager — the serving hatch faces local +z (attach 0.72 out), so
 *  aim `rotation` at the path the customers should approach from. */
export const SodaStand = composableStall<SodaStandProps>(
  'SodaStand',
  (t, { withGuest = false }) => buildSodaStandScene(t, { withGuest }),
  { name: 'Soda Stand', item: 'drink', price: 2, value: 4 },
);

// ---------------------------------------------------------------------------
// DiscoBallFloor — Pulse District's giant: an Epcot-scale mirror ball over a chasing dance floor.
//
// ONE GIANT SET-PIECE PER WORLD. `fire` always had `<Volcano>` (r 2.75, h 2.55,
// a cone visible from the gate) and the other four worlds had nothing of that
// mass — their biggest pieces were props, so those lands read as a lawn with
// ornaments on it. This is `neon`'s answer, built to the same class.
//
// Deterministic (hashed jitter only), night-gated through `nightKOf(group)`,
// and it registers a footprint so guests and the OBB sweep route around it.
// Mount it with `<DiscoBallFloor position={[x, z]} />`, or let
// `<WorldLandmark plan={W} />` pick it off the world's theme.
// ---------------------------------------------------------------------------

import * as THREE from 'three';
import { box, cyl, ball, nightKOf, mergedBoxes } from '../Stage';
import { composable } from '../Park';

/** what each landmark builder returns */
export interface LandmarkBuilt {
  group: THREE.Group;
  /** the ground radius guests must walk around */
  radius: number;
  update?: (time: number) => void;
}

/** deterministic 0..1 — hashed, never Math.random, so a remount is identical */
const h01 = (n: number) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

/** local mirror of Stage's MergedBoxSpec (a second `import type` line from the
 *  same module tripped the design-system resolver) */
type MergedBoxSpec = {
  dims: [number, number, number];
  pos?: [number, number, number];
  rotX?: number; rotY?: number; rotZ?: number;
  matrix?: THREE.Matrix4;
  repeat?: [number, number];
};

export function buildDiscoBallFloor(t: typeof THREE): LandmarkBuilt {
  const g = new t.Group();
  const BLACK = 0x14141a;
  const STEEL = 0x3a3a46;
  const MAG = 0xd6338c;
  const CYAN = 0x18c4d8;
  const AMBER = 0xf2b134;

  // ---- THE DANCE FLOOR — a 7 x 7 chequer of light tiles, 5.6 u across ----
  const N = 7;
  const TW = 0.8;
  // The floor CHASES, so its tiles must animate — but one Mesh per tile is what
  // killed the first build. Tiles are grouped into SIX PHASE BUCKETS and merged
  // per bucket: six materials to drive instead of forty, and the travelling
  // wave still reads because the buckets are assigned by ring distance.
  const PHASES = 6;
  const dark: MergedBoxSpec[] = [];
  const phaseSpecs: MergedBoxSpec[][] = Array.from({ length: PHASES }, () => []);
  const phaseCol: number[] = [];
  for (let i = 0; i < N; i += 1)
    for (let j = 0; j < N; j += 1) {
      const x = (i - (N - 1) / 2) * TW;
      const z = (j - (N - 1) / 2) * TW;
      if (Math.hypot(x, z) > 2.95) continue;            // round the floor off
      const spec: MergedBoxSpec = { dims: [TW - 0.05, 0.09, TW - 0.05], pos: [x, 0.05, z] };
      if ((i + j) % 2 !== 0) { dark.push(spec); continue; }
      const ph = Math.min(PHASES - 1, Math.floor((Math.hypot(x, z) / 3.0) * PHASES));
      phaseSpecs[ph].push(spec);
      phaseCol[ph] = ph % 2 === 0 ? MAG : CYAN;
    }
  if (dark.length) g.add(mergedBoxes(t, dark, BLACK, { rough: 0.35, metal: 0.2 }));
  const tiles: THREE.Mesh[] = [];
  phaseSpecs.forEach((specs, ph) => {
    if (!specs.length) return;
    const c = phaseCol[ph] ?? CYAN;
    const m = mergedBoxes(t, specs, c, { emissive: c, rough: 0.35, metal: 0.2 }) as THREE.Mesh;
    tiles.push(m);
    g.add(m);
  });
  g.add(cyl(t, 3.15, 3.3, 0.12, STEEL, [0, 0.02, 0], { tex: 'metal', metal: 0.6, rough: 0.5, seg: 26 })); // rim

  // ---- FOUR LEGS to the collar ------------------------------------------
  const LEG = 4.4;
  [0, 1, 2, 3].forEach((i) => {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    g.add(box(t, [0.18, LEG, 0.18], STEEL, [Math.cos(a) * 2.35, LEG / 2 + 0.1, Math.sin(a) * 2.35], {
      rotX: Math.sin(a) * 0.30, rotZ: -Math.cos(a) * 0.30, tex: 'metal', metal: 0.7, rough: 0.35,
    }));
  });
  // OPEN RINGS, not discs. These were `cyl(r, r, 0.07)` — which is a solid
  // PLATE, so the landmark rendered as two big black tables stacked over the
  // dance floor and hid the ball completely. A torus is the ring it was always
  // meant to be, and you can see the sky through it.
  const ringMat = new t.MeshStandardMaterial({ color: STEEL, metalness: 0.7, roughness: 0.35 });
  [[1.7, 1.95], [3.2, 1.55]].forEach(([y, rad]) => {
    const ring = new t.Mesh(new t.TorusGeometry(rad, 0.055, 8, 32), ringMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = y;
    ring.castShadow = true;
    g.add(ring);
  });

  // ---- THE BALL — geodesic, Epcot-scale (r 2.05, crown near 8 u) ---------
  const ballG = new t.Group();
  const R = 2.05;
  ballG.position.set(0, LEG + 0.15 + R * 0.86, 0);
  ballG.add(ball(t, R * 0.985, 0x9aa0ab, [0, 0, 0], { metal: 1, rough: 0.18, flat: true }));
  // The geodesic skin: 150 facets on a FIBONACCI sphere, so coverage is even
  // instead of clumping at the poles like a random scatter.
  //
  // MERGED INTO FOUR MESHES, ONE PER COLOUR — not 150 separate ones. The first
  // version mounted a Mesh per facet and the probe's browser frame DETACHED
  // (and a push OOM-killed); `mergedBoxes` is the design system's own rule for
  // exactly this (Stage: "use for static dressing built from many small box()
  // calls"). The facets never move relative to the ball, so merging costs
  // nothing — the whole ball still turns as one group.
  const GOLD = Math.PI * (3 - Math.sqrt(5));
  const buckets = new Map<number, MergedBoxSpec[]>();
  for (let i = 0; i < 150; i += 1) {
    const y = 1 - (i / 149) * 2;
    const rr = Math.sqrt(Math.max(0, 1 - y * y));
    const th = GOLD * i;
    const pos = new t.Vector3(Math.cos(th) * rr * R, y * R, Math.sin(th) * rr * R);
    const hue = i % 7;
    const c = hue === 0 ? MAG : hue === 1 ? CYAN : hue === 2 ? AMBER : 0xe8ecf2;
    // lie the facet flat on the sphere: orient +z outward from the centre
    const m = new t.Matrix4().lookAt(pos, new t.Vector3(0, 0, 0), new t.Vector3(0, 1, 0));
    m.setPosition(pos);
    if (!buckets.has(c)) buckets.set(c, []);
    buckets.get(c)!.push({ dims: [0.3, 0.3, 0.05], matrix: m });
  }
  buckets.forEach((specs, c) =>
    ballG.add(mergedBoxes(t, specs, c, { metal: 0.95, rough: 0.12, ...(c === 0xe8ecf2 ? {} : { emissive: c }) })),
  );
  g.add(ballG);
  // the spindle it hangs from
  // the yoke the ball hangs from: four short arms meeting over the centre,
  // then a spindle down to the ball — without this the ball floated unattached
  [0, 1, 2, 3].forEach((i) => {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    g.add(box(t, [0.1, 0.1, 1.9], STEEL, [Math.cos(a) * 0.85, LEG + 0.34, Math.sin(a) * 0.85], {
      rotY: a, tex: 'metal', metal: 0.75, rough: 0.3,
    }));
  });
  g.add(cyl(t, 0.09, 0.11, 0.42, STEEL, [0, LEG + 0.12, 0], { tex: 'metal', metal: 0.8, seg: 10 }));

  // ---- eight spotlights on the collar, aimed inward ---------------------
  const lamps: THREE.Mesh[] = [];
  for (let i = 0; i < 8; i += 1) {
    const a = (i / 8) * Math.PI * 2;
    const col = i % 3 === 0 ? MAG : i % 3 === 1 ? CYAN : AMBER;
    const l = cyl(t, 0.08, 0.12, 0.26, col, [Math.cos(a) * 1.9, 1.55, Math.sin(a) * 1.9], {
      emissive: col, rotX: Math.cos(a) * 0.55, rotZ: Math.sin(a) * 0.55, seg: 8,
    });
    lamps.push(l);
    g.add(l);
  }

  const update = (time: number) => {
    ballG.rotation.y = time * 0.28;
    const k = nightKOf(g);   // nightKOf takes the OBJECT, never the time
    // the floor CHASES — a travelling wave, not a strobe
    tiles.forEach((m, i) => {
      const mat = m.material as THREE.MeshStandardMaterial;
      mat.emissiveIntensity = (0.2 + 1.6 * k) * (0.35 + 0.65 * (0.5 + 0.5 * Math.sin(time * 2.4 - i * 0.55)));
    });
    lamps.forEach((l, i) => {
      const mat = l.material as THREE.MeshStandardMaterial;
      mat.emissiveIntensity = (0.3 + 1.7 * k) * (0.5 + 0.5 * Math.sin(time * 3.0 + i * 0.8));
    });
  };
  return { group: g, radius: 3.3, update };
}

/** `<DiscoBallFloor>` — neon's landmark. */
export const DiscoBallFloor = composable('DiscoBallFloor', (t) => buildDiscoBallFloor(t));

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

// ---------------------------------------------------------------------------
// THE MIRROR-BALL ENVIRONMENT — drawn once, cached, and it is what makes the
// facets a MIRROR instead of a paint job.
//
// The first build gave every facet an `emissive` in magenta / cyan / amber, so
// the ball GLOWED in flat colour: a beach ball, not a mirror ball — "a fake
// reflection effect", exactly as reported. A mirror is not a colour, it is
// whatever is around it, so the facets now get metalness 1, roughness 0.05 and
// an `envMap` to reflect. There is no scene-wide environment in this design
// system and a live CubeCamera would cost a full extra render pass every frame
// (see Stage/darkLights.ts on what a park's frame can afford), so the
// environment is a 256x128 equirectangular CANVAS: sky above, dark ground below,
// a horizon band, one sun blob and a scatter of neon spots. Facet normals sweep
// across it as the ball turns, which is a real reflection of a fake world rather
// than a fake reflection of a real one.
// ---------------------------------------------------------------------------
let _envTex: THREE.Texture | null = null;
function ballEnv(t: typeof THREE): THREE.Texture | null {
  if (_envTex) return _envTex;
  if (typeof document === 'undefined') return null;   // SSR / node bundling
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 128;
  const x = c.getContext('2d');
  if (!x) return null;
  const sky = x.createLinearGradient(0, 0, 0, 64);
  sky.addColorStop(0, '#1b2a4a');
  sky.addColorStop(0.72, '#4d6f9c');
  sky.addColorStop(1, '#a9c2d8');
  x.fillStyle = sky;
  x.fillRect(0, 0, 256, 64);
  const gnd = x.createLinearGradient(0, 64, 0, 128);
  gnd.addColorStop(0, '#4a4a52');
  gnd.addColorStop(1, '#141419');
  x.fillStyle = gnd;
  x.fillRect(0, 64, 256, 64);
  // the horizon, and the neon glow of the floor just below it
  x.fillStyle = '#cfd8e2';
  x.fillRect(0, 62, 256, 3);
  const spots: [number, number, number, string][] = [
    [60, 30, 15, '#fffdf2'],      // the sun
    [150, 70, 11, '#d6338c'],
    [206, 74, 9, '#18c4d8'],
    [22, 76, 8, '#f2b134'],
    [104, 80, 7, '#18c4d8'],
    [240, 46, 6, '#ffffff'],
  ];
  for (const [cx, cy, r, col] of spots) {
    const gr = x.createRadialGradient(cx, cy, 0, cx, cy, r);
    gr.addColorStop(0, col);
    gr.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = gr;
    x.beginPath();
    x.arc(cx, cy, r, 0, Math.PI * 2);
    x.fill();
  }
  const tex = new t.CanvasTexture(c);
  (tex as unknown as { mapping: number }).mapping = (t as unknown as { EquirectangularReflectionMapping: number }).EquirectangularReflectionMapping;
  (tex as unknown as { colorSpace: string }).colorSpace = (t as unknown as { SRGBColorSpace: string }).SRGBColorSpace;
  _envTex = tex;
  return tex;
}

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
  const env = ballEnv(t);
  // the core under the facets: dark, so the GAPS between mirrors read as gaps
  ballG.add(ball(t, R * 0.985, 0x2b2d34, [0, 0, 0], { metal: 0.6, rough: 0.5, flat: true }));
  // The geodesic skin: 150 facets on a FIBONACCI sphere, so coverage is even
  // instead of clumping at the poles like a random scatter.
  //
  // MERGED INTO FOUR MESHES, ONE PER COLOUR — not 150 separate ones. The first
  // version mounted a Mesh per facet and the probe's browser frame DETACHED
  // (and a push OOM-killed); `mergedBoxes` is the design system's own rule for
  // exactly this (Stage: "use for static dressing built from many small box()
  // calls"). The facets never move relative to the ball, so merging costs
  // nothing — the whole ball still turns as one group.
  // 340 facets now, not 150 — a mirror ball's read is the DENSITY of small
  // mirrors, and at 150 on a 4.1 u ball the gaps were wider than the tiles.
  // Three tints, none of them emissive: silver, and a few faintly warm/cool ones
  // so the surface is not one dead grey. The colour work at night is done by the
  // floor and the collar lamps, which are the things that actually emit.
  const GOLD = Math.PI * (3 - Math.sqrt(5));
  const buckets = new Map<number, MergedBoxSpec[]>();
  const FACETS = 340;
  for (let i = 0; i < FACETS; i += 1) {
    const y = 1 - ((i + 0.5) / FACETS) * 2;
    const rr = Math.sqrt(Math.max(0, 1 - y * y));
    const th = GOLD * i;
    const pos = new t.Vector3(Math.cos(th) * rr * R, y * R, Math.sin(th) * rr * R);
    const hue = i % 11;
    const c = hue === 0 ? 0xd9dde6 : hue === 1 ? 0xeef3ff : 0xe8ecf2;
    // lie the facet flat on the sphere: orient +z outward from the centre
    const m = new t.Matrix4().lookAt(pos, new t.Vector3(0, 0, 0), new t.Vector3(0, 1, 0));
    m.setPosition(pos);
    if (!buckets.has(c)) buckets.set(c, []);
    buckets.get(c)!.push({ dims: [0.33, 0.33, 0.035], matrix: m });
  }
  const facetMats: THREE.MeshStandardMaterial[] = [];
  buckets.forEach((specs, c) => {
    const mesh = mergedBoxes(t, specs, c, { metal: 1, rough: 0.05 }) as THREE.Mesh;
    const mm = mesh.material as THREE.MeshStandardMaterial;
    if (env) {
      mm.envMap = env;
      mm.envMapIntensity = 1.3;
      mm.needsUpdate = true;
    }
    facetMats.push(mm);
    ballG.add(mesh);
  });
  // the equator and two tropic bands the mirrors are strung on — a real ball is
  // built on hoops, and they catch the light differently from the mirrors
  const hoopMat = new t.MeshStandardMaterial({ color: 0x8f96a3, metalness: 0.9, roughness: 0.3 });
  [[0, R * 1.002], [R * 0.62, R * 0.79], [-R * 0.62, R * 0.79]].forEach(([hy, hr]) => {
    const hoop = new t.Mesh(new t.TorusGeometry(hr, 0.018, 6, 40), hoopMat);
    hoop.rotation.x = Math.PI / 2;
    hoop.position.y = hy;
    ballG.add(hoop);
  });
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
    // the mirrors reflect HARDER after dark, when the lamps are what is lighting
    // them — the ball is never emissive, so this is the only night response it
    // has, and it keeps it from going a flat grey when the sun is off
    facetMats.forEach((m) => { m.envMapIntensity = 1.3 + 0.7 * k; });
  };
  return { group: g, radius: 3.3, update };
}

/** `<DiscoBallFloor>` — neon's landmark. */
export const DiscoBallFloor = composable<Record<string, never>, LandmarkBuilt>(
  'DiscoBallFloor',
  (t) => buildDiscoBallFloor(t),
  {
    // REGISTER THE MASS. This header has always claimed the giant "registers a
    // footprint so guests and the OBB sweep route around it" and it did not:
    // `composable()` was called with no `compose` cfg, so nothing was declared
    // and guests walked straight THROUGH the hull / the mooring mast / the nest.
    // MEASURED 2026-07-28: of the five world giants only <Volcano> registered a
    // blocker (3 calls); these four registered none. The builder already returns
    // the `radius` guests are meant to walk around — it was simply never used.
    compose: (park, { built, position, rotation, scale }) => {
      void rotation;
      const [wx, , wz] = position;
      const un = park.registerBlocker({
        circle: { cx: wx, cz: wz, r: built.radius * scale },
        label: '<DiscoBallFloor>',
        height: 1.2 * scale,
        kind: 'scenery',
      });
      return () => un();
    },
  },
);

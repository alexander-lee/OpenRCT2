import React from 'react';
import * as THREE from 'three';
import { cyl, ball, nightKOf } from '../Stage';
import { composable } from '../Park';

// ---------------------------------------------------------------------------
// ParticleKit — the shared particle-emitter primitive for every effect in the
// design system (fountain spray, crash smoke + sparks, kart exhaust, chimney
// wisps, vomit bursts, flume/rapids splashes...). One draw call per emitter:
// a THREE.Points over a fixed-capacity ring buffer with a soft round dot
// CanvasTexture sprite (never squares), per-particle age-driven size / colour
// / alpha lerps and gravity integration. FULLY DETERMINISTIC: emission and
// per-particle variance come from a hashed-sine sequence keyed on a
// monotonically increasing spawn counter — no Math.random anywhere, so two
// runs with the same dt sequence are byte-identical.
//
// CONTRACT (other components code against this exact shape — do not change):
//   buildEmitter(t, opts) → {
//     points,                      // add to your scene/group (local space)
//     update(time, dt?),           // every frame; dt derived from consecutive
//                                  // times when omitted, clamped ≤ 0.1
//     burst(n, origin?),           // one-shot burst (origin does NOT persist)
//     setOrigin(x, y, z),          // continuous-emission origin (local space)
//     setRate(r),                  // particles/second (0 = burst-only)
//     dispose(),                   // frees geometry + material (texture is shared)
//   }
//
// Per-particle size and alpha ride custom attributes injected into the stock
// PointsMaterial via onBeforeCompile (vertex colours carry the RGB lerp, size
// attenuation stays on) — so fog/tonemapping keep working and it is still a
// plain PointsMaterial to three. Budget guidance: keep every component at
// ≤ 300 live particles total (a few small emitters, not one huge one).
// ---------------------------------------------------------------------------

export interface EmitterOpts {
  /** ring-buffer capacity (default 128) — the hard particle cap */
  max?: number;
  /** continuous emission, particles/second (default 10; 0 = burst-only) */
  rate?: number;
  /** mean particle lifetime, seconds (default 1.2) */
  life?: number;
  /** ± lifetime variance, seconds (default 0) */
  lifeVar?: number;
  /** mean launch velocity, local units/s (default [0, 1, 0]) */
  velocity?: [number, number, number];
  /** ± per-axis hashed velocity jitter, units/s (default 0.3) */
  spread?: number;
  /** downward acceleration, units/s² (negative = buoyant rise; default 0) */
  gravity?: number;
  /** world-ish particle diameter at birth (default 0.08) */
  size?: number;
  /** diameter at end of life (default: same as size) */
  sizeEnd?: number;
  /** particle colour at birth (required) */
  color: number;
  /** colour at end of life (default: same as color) */
  colorEnd?: number;
  /** peak alpha (default 1) — fades in fast, out over the lifetime */
  opacity?: number;
  /** additive blending for fire/sparks/glows (default normal blending) */
  additive?: boolean;
}

export interface Emitter {
  points: THREE.Points;
  update(time: number, dt?: number): void;
  burst(n: number, origin?: [number, number, number]): void;
  setOrigin(x: number, y: number, z: number): void;
  setRate(r: number): void;
  dispose(): void;
}

// deterministic pseudo-random from a float key (hashed sine — DS convention)
const hash01 = (n: number) => {
  const s = Math.sin(n * 12.9898 + 78.233) * 43758.5453;
  return s - Math.floor(s);
};

// shared soft round dot sprite (radial gradient) — one texture for every
// emitter, cached module-wide; guarded so headless (node) smoke tests run
let _dot: THREE.CanvasTexture | null = null;
function dotTexture(t: typeof THREE): THREE.CanvasTexture | null {
  if (_dot) return _dot;
  if (typeof document === 'undefined') return null;
  const S = 64;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const x = c.getContext('2d')!;
  const g = x.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.35, 'rgba(255,255,255,0.9)');
  g.addColorStop(0.7, 'rgba(255,255,255,0.35)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g;
  x.fillRect(0, 0, S, S);
  _dot = new t.CanvasTexture(c);
  return _dot;
}

let _emitterN = 0; // distinct hashed sequences per emitter, still deterministic

// GLOBAL PARTICLE BUDGET — capacity is capped across ALL live emitters, not
// just per effect. Every buildEmitter allocation counts against the pool and
// dispose() returns it; once the pool is exhausted new emitters get their
// ring buffers clamped (still functional, just sparser) and one console
// warning points at the offender count. Default 4000 ≈ 13 components at the
// ≤300-per-component guidance — far more than any composed park should carry.
let _particleBudget = 4000;
let _particlesLive = 0;
let _budgetWarned = false;

/** override the global cross-emitter particle-capacity budget (default 4000) */
export function setParticleBudget(n: number) {
  _particleBudget = Math.max(0, Math.floor(n));
}

/** current global particle-capacity usage `{ live, budget }` */
export function particleBudget() {
  return { live: _particlesLive, budget: _particleBudget };
}

export function buildEmitter(t: typeof THREE, opts: EmitterOpts): Emitter {
  let max = Math.max(4, Math.floor(opts.max ?? 128));
  const room = Math.max(4, _particleBudget - _particlesLive);
  if (max > room) {
    if (!_budgetWarned) {
      _budgetWarned = true;
      console.warn(
        `ParticleKit: global particle budget reached (${_particlesLive}/${_particleBudget} allocated) — new emitters are clamped. Fewer/smaller emitters, or setParticleBudget(n). SETUP.md §13.`,
      );
    }
    max = room;
  }
  _particlesLive += max;
  let rate = opts.rate ?? 10;
  const life0 = opts.life ?? 1.2;
  const lifeVar = opts.lifeVar ?? 0;
  const vel0 = opts.velocity ?? [0, 1, 0];
  const spread = opts.spread ?? 0.3;
  const grav = opts.gravity ?? 0;
  const size0 = opts.size ?? 0.08;
  const size1 = opts.sizeEnd ?? size0;
  const c0 = new t.Color(opts.color);
  const c1 = new t.Color(opts.colorEnd ?? opts.color);
  const op0 = opts.opacity ?? 1;
  const seedBase = (_emitterN += 1) * 1000.61;

  // ring-buffer state (fixed capacity — zero allocation after build)
  const pos = new Float32Array(max * 3);
  const col = new Float32Array(max * 3);
  const sizeA = new Float32Array(max);
  const alphaA = new Float32Array(max);
  const vel = new Float32Array(max * 3);
  const birth = new Float32Array(max).fill(-1e9);
  const life = new Float32Array(max); // 0 = slot never spawned
  const bright = new Float32Array(max); // per-particle brightness variation

  const geo = new t.BufferGeometry();
  geo.setAttribute('position', new t.BufferAttribute(pos, 3));
  geo.setAttribute('color', new t.BufferAttribute(col, 3));
  geo.setAttribute('aSize', new t.BufferAttribute(sizeA, 1));
  geo.setAttribute('aAlpha', new t.BufferAttribute(alphaA, 1));

  const material = new t.PointsMaterial({
    size: 1, // per-particle aSize carries the real diameter
    vertexColors: true,
    sizeAttenuation: true,
    transparent: true,
    depthWrite: false,
    blending: opts.additive ? t.AdditiveBlending : t.NormalBlending,
  });
  const dot = dotTexture(t);
  if (dot) material.map = dot; // absent only in headless (node) smoke tests
  // inject per-particle size + alpha into the stock points shader
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = `attribute float aSize;\nattribute float aAlpha;\nvarying float vAlpha;\n${shader.vertexShader
      .replace('#include <color_vertex>', '#include <color_vertex>\n\tvAlpha = aAlpha;')
      .replace('gl_PointSize = size;', 'gl_PointSize = size * aSize;')}`;
    shader.fragmentShader = `varying float vAlpha;\n${shader.fragmentShader.replace(
      '#include <color_fragment>',
      '#include <color_fragment>\n\tdiffuseColor.a *= vAlpha;',
    )}`;
  };

  const points = new t.Points(geo, material);
  points.frustumCulled = false; // particles roam far from the geometry origin
  points.name = 'emitter';

  const origin = [0, 0, 0];
  let head = 0; // ring write index (oldest particle is recycled first)
  let spawnN = 0; // deterministic spawn counter — sole source of variance
  let emitAcc = 0;
  let now = 0; // internal clock (sum of clamped dts)
  let lastTime: number | null = null;

  const spawn = (ox: number, oy: number, oz: number) => {
    const i = head;
    head = (head + 1) % max;
    spawnN += 1;
    const h = (k: number) => hash01(seedBase + spawnN * 17.31 + k * 7.7);
    pos[i * 3] = ox;
    pos[i * 3 + 1] = oy;
    pos[i * 3 + 2] = oz;
    vel[i * 3] = vel0[0] + (h(1) - 0.5) * 2 * spread;
    vel[i * 3 + 1] = vel0[1] + (h(2) - 0.5) * 2 * spread;
    vel[i * 3 + 2] = vel0[2] + (h(3) - 0.5) * 2 * spread;
    birth[i] = now;
    life[i] = Math.max(0.05, life0 + (h(4) - 0.5) * 2 * lifeVar);
    bright[i] = 0.85 + h(5) * 0.3;
    col[i * 3] = c0.r * bright[i];
    col[i * 3 + 1] = c0.g * bright[i];
    col[i * 3 + 2] = c0.b * bright[i];
    sizeA[i] = size0;
    alphaA[i] = 0; // fades in on the first updates (no pop)
  };

  const flag = () => {
    (geo.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    (geo.attributes.color as THREE.BufferAttribute).needsUpdate = true;
    (geo.attributes.aSize as THREE.BufferAttribute).needsUpdate = true;
    (geo.attributes.aAlpha as THREE.BufferAttribute).needsUpdate = true;
  };

  const update = (time: number, dtOpt?: number) => {
    let dt = dtOpt;
    if (dt == null) {
      dt = lastTime == null ? 1 / 60 : time - lastTime;
      lastTime = time;
    }
    if (!(dt > 0)) dt = 1 / 60;
    dt = Math.min(dt, 0.1);
    now += dt;
    // continuous hashed emission at `rate`/s from the current origin
    emitAcc += rate * dt;
    let n = Math.floor(emitAcc);
    emitAcc -= n;
    if (n > max) n = max;
    for (let k = 0; k < n; k += 1) spawn(origin[0], origin[1], origin[2]);
    // integrate + age-lerp every slot (dead slots collapse to alpha/size 0)
    for (let i = 0; i < max; i += 1) {
      const L = life[i];
      const age = now - birth[i];
      if (L <= 0 || age >= L) {
        alphaA[i] = 0;
        sizeA[i] = 0;
        continue;
      }
      vel[i * 3 + 1] -= grav * dt;
      pos[i * 3] += vel[i * 3] * dt;
      pos[i * 3 + 1] += vel[i * 3 + 1] * dt;
      pos[i * 3 + 2] += vel[i * 3 + 2] * dt;
      const u = age / L;
      const br = bright[i];
      col[i * 3] = (c0.r + (c1.r - c0.r) * u) * br;
      col[i * 3 + 1] = (c0.g + (c1.g - c0.g) * u) * br;
      col[i * 3 + 2] = (c0.b + (c1.b - c0.b) * u) * br;
      sizeA[i] = size0 + (size1 - size0) * u;
      const fade = u < 0.12 ? u / 0.12 : (1 - (u - 0.12) / 0.88) ** 1.4;
      alphaA[i] = op0 * Math.max(0, fade);
    }
    flag();
  };

  const burst = (n: number, o?: [number, number, number]) => {
    const bx = o ? o[0] : origin[0];
    const by = o ? o[1] : origin[1];
    const bz = o ? o[2] : origin[2];
    const m = Math.min(Math.max(0, Math.floor(n)), max);
    for (let k = 0; k < m; k += 1) spawn(bx, by, bz);
    flag();
  };

  return {
    points,
    update,
    burst,
    setOrigin(x: number, y: number, z: number) {
      origin[0] = x;
      origin[1] = y;
      origin[2] = z;
    },
    setRate(r: number) {
      rate = Math.max(0, r);
    },
    dispose() {
      _particlesLive = Math.max(0, _particlesLive - max); // return capacity to the global pool
      geo.dispose();
      material.dispose(); // the dot sprite is shared — never disposed here
    },
  };
}

// ---------------------------------------------------------------------------
// buildFire — the shared LAYERED realistic fire effect (campfires, torches,
// coaster-crash wrecks, braziers). Composed from four buildEmitter layers plus
// one flickering warm PointLight:
//   (a) additive CORE: fast buoyant bright particles, white-yellow → deep red
//       through orange, shrinking as they rise (tight spread)
//   (b) additive OUTER FLAME: slower, wider, orange fading to transparent
//   (c) EMBER SPARKS: occasional fast tiny bright dots on gravity arcs
//   (d) SMOKE above the flame tips: dark grey, growing, long-life, normal blend
// The light flickers on hashed sines (deterministic — per-fire counter seed)
// and brightens at night via nightKOf(group) (one cheap parent walk / frame).
// ~128 particles at intensity 1; setIntensity retunes every layer's rate and
// the light so a fire can burn down to embers (or 0 = out).
// ---------------------------------------------------------------------------

export interface FireOpts {
  /** overall size multiplier — flame height ≈ 1.1·scale units (default 1) */
  scale?: number;
  /** initial intensity, 0..1+ (default 1) — see setIntensity */
  intensity?: number;
}

export interface Fire {
  group: THREE.Group;
  update(time: number, dt?: number): void;
  /** 1 = full blaze, 0.15 ≈ smoulder, 0 = out (rates + light track it) */
  setIntensity(k: number): void;
  dispose(): void;
}

let _fireN = 0; // deterministic per-fire flicker phase

export function buildFire(t: typeof THREE, opts: FireOpts = {}): Fire {
  const s = opts.scale ?? 1;
  let inten = Math.max(0, opts.intensity ?? 1);
  const seed = (_fireN += 1) * 3.7;
  const group = new t.Group();
  group.name = 'fire';

  // base emission rates per layer (scaled by intensity)
  const R_CORE = 56;
  const R_OUTER = 26;
  const R_EMBER = 5;
  const R_SMOKE = 8;

  // (a) core: hot, fast, tight — white-yellow through orange to deep red
  const core = buildEmitter(t, {
    max: 44, rate: R_CORE * inten, life: 0.55, lifeVar: 0.16,
    velocity: [0, 1.7 * s, 0], spread: 0.16 * s, gravity: -1.5 * s,
    size: 0.24 * s, sizeEnd: 0.06 * s, color: 0xffefa8, colorEnd: 0x8c1602, opacity: 0.95, additive: true,
  });
  core.setOrigin(0, 0.08 * s, 0);
  // (b) outer flame: slower, wider, orange → transparent (alpha eases out)
  const outer = buildEmitter(t, {
    max: 30, rate: R_OUTER * inten, life: 0.75, lifeVar: 0.2,
    velocity: [0, 1.05 * s, 0], spread: 0.32 * s, gravity: -0.55 * s,
    size: 0.36 * s, sizeEnd: 0.16 * s, color: 0xff8a28, colorEnd: 0x6e1400, opacity: 0.5, additive: true,
  });
  outer.setOrigin(0, 0.06 * s, 0);
  // (c) embers: occasional fast tiny bright dots arcing under gravity
  const embers = buildEmitter(t, {
    max: 14, rate: R_EMBER * inten, life: 1.15, lifeVar: 0.4,
    velocity: [0, 2.6 * s, 0], spread: 0.9 * s, gravity: 3.0,
    size: 0.055 * s, sizeEnd: 0.022 * s, color: 0xffe090, colorEnd: 0xff4a10, opacity: 1, additive: true,
  });
  embers.setOrigin(0, 0.15 * s, 0);
  // (d) smoke: starts above the flame tips, grows and greys out (normal blend)
  const smoke = buildEmitter(t, {
    max: 40, rate: R_SMOKE * inten, life: 2.6, lifeVar: 0.8,
    velocity: [0.06 * s, 0.55 * s, 0], spread: 0.14 * s, gravity: -0.05,
    size: 0.26 * s, sizeEnd: 0.85 * s, color: 0x3d3a37, colorEnd: 0x8c8c88, opacity: 0.32,
  });
  smoke.setOrigin(0, 0.95 * s, 0);
  const layers = [core, outer, embers, smoke];
  layers.forEach((e) => group.add(e.points));

  // (e) one flickering warm point light, night-aware via nightKOf
  const light = new t.PointLight(0xff8c3a, 0, 4.5 * s + 1.2, 2);
  light.position.set(0, 0.55 * s, 0);
  group.add(light);

  const update = (time: number, dt?: number) => {
    layers.forEach((e) => e.update(time, dt));
    // hashed-sine flicker (deterministic), brighter at night
    const fl = 0.82 + 0.13 * Math.sin(time * 11.3 + seed) + 0.06 * Math.sin(time * 23.7 + seed * 1.7);
    const nk = nightKOf(group);
    light.intensity = inten * fl * (0.9 + 1.3 * nk) * (0.6 + 0.7 * s);
  };

  return {
    group,
    update,
    setIntensity(k: number) {
      inten = Math.max(0, k);
      core.setRate(R_CORE * inten);
      outer.setRate(R_OUTER * inten);
      embers.setRate(R_EMBER * inten);
      smoke.setRate(R_SMOKE * inten);
    },
    dispose() {
      layers.forEach((e) => e.dispose());
      light.dispose();
    },
  };
}

// ---------------------------------------------------------------------------
// Preview: four scenes side by side — a water spray, a smoke column, a
// tri-colour confetti burst firing on a timer, and a campfire (buildFire) on
// a stone ring. Small stone pads ground the first three.
// ---------------------------------------------------------------------------
export function buildParticleKitScene(three: typeof THREE): { group: THREE.Group; update?: (time: number) => void } {
  const group = new three.Group();
  const update =
    ((t: typeof THREE, g: THREE.Group) => {
        // four scenes on a 2x2 diamond (rotation-proof for the orbit camera):
        // spray / smoke / confetti on stone pads, campfire on a stone ring
        const P: [number, number][] = [[-1.5, -1.5], [1.5, -1.5], [-1.5, 1.5], [1.5, 1.5]];
        P.slice(0, 3).forEach(([x, z]) => g.add(cyl(t, 0.3, 0.36, 0.12, 0x9b968c, [x, 0.06, z], { tex: 'concrete', repeat: [4, 1], rough: 0.95, seg: 18 })));

        // water spray: dense, gravity-pulled, cool blue-white
        const spray = buildEmitter(t, {
          max: 140, rate: 110, life: 0.85, lifeVar: 0.25,
          velocity: [0, 2.9, 0], spread: 0.6, gravity: 6.5,
          size: 0.1, sizeEnd: 0.05, color: 0xcdeef6, colorEnd: 0x6db8d6, opacity: 0.9,
        });
        spray.setOrigin(P[0][0], 0.18, P[0][1]);

        // smoke: slow, buoyant, growing and greying out
        const smoke = buildEmitter(t, {
          max: 70, rate: 15, life: 3.4, lifeVar: 0.9,
          velocity: [0.08, 0.55, 0], spread: 0.11, gravity: -0.03,
          size: 0.16, sizeEnd: 0.62, color: 0x5c5a58, colorEnd: 0x9c9c9a, opacity: 0.42,
        });
        smoke.setOrigin(P[1][0], 0.2, P[1][1]);

        // confetti: three overlaid burst-only emitters (red / blue / gold)
        const confetti = [0xd23a3a, 0x2f6fd0, 0xe0a020].map((color) =>
          buildEmitter(t, {
            max: 40, rate: 0, life: 2.4, lifeVar: 0.4,
            velocity: [0, 3.0, 0], spread: 0.85, gravity: 3.2,
            size: 0.13, sizeEnd: 0.1, color, opacity: 1,
          }),
        );

        // campfire on a stone ring: 8 hashed granite stones, 3 crossed logs,
        // a glowing coal bed and the layered buildFire on top
        const [FX, FZ] = P[3];
        for (let i = 0; i < 8; i++) {
          const th = (i / 8) * Math.PI * 2 + hash01(i + 0.3) * 0.4;
          const r = 0.07 + hash01(i + 1.7) * 0.04;
          const st = ball(t, r, 0x8a857c, [FX + Math.cos(th) * 0.44, r * 0.62, FZ + Math.sin(th) * 0.44], { tex: 'concrete', repeat: [2, 2], flat: true, rough: 0.95 });
          st.scale.y = 0.75;
          g.add(st);
        }
        for (let i = 0; i < 3; i++) {
          const th = (i / 3) * Math.PI * 2 + 0.5;
          const lg = cyl(t, 0.045, 0.055, 0.52, 0x5a3d22, [FX + Math.cos(th) * 0.1, 0.08, FZ + Math.sin(th) * 0.1], { tex: 'wood', repeat: [2, 3], rotX: Math.PI / 2 - 0.35, rotY: th, seg: 10, rough: 0.95 });
          g.add(lg);
        }
        const coals = ball(t, 0.13, 0x241812, [FX, 0.05, FZ], { flat: true, emissive: 0xb03a08, rough: 1 });
        coals.scale.y = 0.45;
        g.add(coals);
        const fire = buildFire(t, { scale: 0.75 });
        fire.group.position.set(FX, 0.07, FZ);
        g.add(fire.group);

        const all = [spray, smoke, ...confetti];
        all.forEach((e) => g.add(e.points));

        let nextBurst = 0.8;
        return (time) => {
          if (time >= nextBurst) {
            confetti.forEach((e) => e.burst(26, [P[2][0], 0.4, P[2][1]]));
            nextBurst = time + 2.2;
          }
          all.forEach((e) => e.update(time));
          fire.update(time);
          (coals.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.55 + 0.25 * Math.sin(time * 9.1);
        };
      })(three, group) || undefined;
  return { group, update };
}

/** <ParticleKit> — composable (components/Park/Context.md): mounts the scene at
 *  `position`/`rotation`/`scale` inside a <Park> or <ScenePreview>. */
export const ParticleKit = composable('ParticleKit', (t) => buildParticleKitScene(t));

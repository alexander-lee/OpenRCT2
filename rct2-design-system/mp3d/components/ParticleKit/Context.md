# ParticleKit

**CANONICAL IMPORT — copy exactly:** `import { ParticleKit } from './components/ParticleKit';`
*(never from `'./Park'`: only the `<Park>` wrappers + track-piece JSX live there. A wrong
specifier makes esbuild refuse the WHOLE bundle — the round-8 black-page failure.)*

The shared particle-emitter primitive (`buildEmitter`) plus the layered realistic fire effect (`buildFire`) for every effect in the design system — fountain spray, crash smoke + sparks, kart exhaust, chimney wisps, vomit bursts, flume/rapids splash droplets. One draw call per emitter: a `THREE.Points` over a **fixed-capacity ring buffer** with a soft round dot CanvasTexture sprite (never squares), per-particle age-driven size / colour / alpha lerps and gravity integration.

## Contract (STABLE — other components code against this exact shape)

```ts
buildEmitter(t: typeof THREE, opts: {
  max?: number;        // ring capacity / hard cap (default 128)
  rate?: number;       // particles per second (default 10; 0 = burst-only)
  life?: number;       // mean lifetime s (default 1.2)
  lifeVar?: number;    // ± lifetime variance s (default 0)
  velocity?: [number, number, number]; // mean launch vel (default [0,1,0])
  spread?: number;     // ± per-axis hashed velocity jitter (default 0.3)
  gravity?: number;    // downward accel; negative = buoyant (default 0)
  size?: number;       // diameter at birth (default 0.08)
  sizeEnd?: number;    // diameter at death (default = size)
  color: number;       // birth colour (required)
  colorEnd?: number;   // death colour (default = color)
  opacity?: number;    // peak alpha (default 1)
  additive?: boolean;  // additive blending for fire/sparks (default normal)
}) → {
  points: THREE.Points,               // add to your scene/group (LOCAL space)
  update(time: number, dt?: number),  // every frame; dt self-derived if omitted (clamped ≤ 0.1)
  burst(n: number, origin?: [x,y,z]), // one-shot burst (origin does not persist)
  setOrigin(x, y, z),                 // continuous-emission origin
  setRate(r: number),                 // retune emission (0 stops it)
  dispose(),                          // frees geometry + material (dot sprite is shared)
}
```

## buildFire — layered realistic fire (STABLE)

```ts
buildFire(t: typeof THREE, opts?: {
  scale?: number;      // size multiplier — flame height ≈ 1.1·scale (default 1)
  intensity?: number;  // initial intensity (default 1)
}) → {
  group: THREE.Group,               // add to your scene (fire base at local origin)
  update(time: number, dt?: number),// every frame — drives all layers + light flicker
  setIntensity(k: number),          // 1 blaze … 0.15 smoulder … 0 out (rates + light)
  dispose(),                        // frees all four emitters + the light
}
```

Five deterministic layers: additive CORE (fast buoyant particles, white-yellow → orange → deep red, shrinking, tight spread), additive OUTER flame (slower/wider, orange → transparent), EMBER sparks (occasional tiny bright dots on gravity arcs), SMOKE above the flame tips (dark grey, growing, long life, normal blend), and one flickering warm `PointLight` (hashed-sine flicker, brighter at night via `nightKOf(group)`). ~128 particles at intensity 1. Used by the campfire preview, `Torch`, and `SplineRideKit.crashTrain` burning wrecks.

## Implementation notes

- **Deterministic**: emission variance is hashed-sine keyed on a monotonic spawn counter (per-emitter base seed) — no `Math.random`. Same dt sequence ⇒ identical runs.
- Per-particle **size + alpha** ride custom `aSize`/`aAlpha` attributes injected into the stock `PointsMaterial` via `onBeforeCompile`; RGB rides standard vertex colours, so size attenuation, fog and tonemapping keep working.
- `points.frustumCulled = false` (particles roam far from the geometry origin); `depthWrite` off; alpha fades in fast (~12 % of life) and eases out.
- The dot sprite is a module-cached 64 px radial-gradient CanvasTexture (guarded for headless/node runs).

## Budget

Keep each component at **≤ 300 live particles total** — a few small emitters read better than one big one. Reference budgets: Fountain ~204, crash ~136/car, GoKarts 128, HauntedMansion 40.

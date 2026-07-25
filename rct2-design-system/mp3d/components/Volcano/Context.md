# Volcano

A park-scenery **landmark**: a basalt/ash cinder cone with a summit crater, a lava lake, two active flows down one flank, an older cooled flow, a lava pool at the base and a lava-filled ground fissure draining out of it.

The look is modelled on the real thing, and the real thing is mostly BLACK: cooled pahoehoe crust is near-black basalt, and all the light comes out of the CRACKS between crust plates where the incandescent interior shows through. No mesh in this component is a uniformly glowing orange blob — every lava surface is a near-black albedo with an emissive **crack map**, so only the fissure network lights up, over a real white-yellow → orange → deep-red → black temperature gradient down each flow. Unlike every lamp in this design system, the glow is **day-and-night**: `nightKOf` lerps the emissive multiplier between a daylight value and a (stronger) night value — it never gates to zero, because lava glows in daylight too.

## Procedural textures (module-cached, shared across every Volcano instance)

- **Crust field** (`crustCanvases`, 256²): a 6×6 jittered-grid Voronoi diagram (36 sites, toroidally wrapped so it tiles) baked to TWO canvases — a dark plate/groove **albedo** (also used as the bump map, so cracks are recessed) and a black-with-bright-cracks **emissive** map. `d2 − d1` (second-nearest minus nearest site distance) is 0 exactly on a plate boundary and grows inward, so `exp(-(d2-d1)/w)` gives a soft-shouldered crack line — a narrow hot core (~1.8 px) plus a short glow shoulder (~5 px), deliberately narrow so the plates (the bulk of the surface) stay black. Per-edge hashing makes some cracks run hotter than others, and a few plates get a hot "incipient breakout" centre.
- **Ash/tephra texture** (`ashCanvas`, 192²): 11 horizontal strata beds (alternating fine-ash / coarse-scoria tone and grain, wavy periodic-in-x boundaries so the texture tiles around the cone, a faint bedding-plane shadow line) plus sparse vertical erosion gullies. Kept deliberately subtle — more contrast reads as a striped circus tent, not a cinder cone.
- Both are procedural `HTMLCanvasElement`s built the way Stage's `drawTexture` does; every jitter is a hashed sine (`hash01`/`hash2`), never `Math.random`.

## The temperature ramp

`HEAT`, 7 stops from `t=0` (vent, ~1100 °C) to `t=1` (cold basalt): white-yellow `0xfff0c0` @ 1.85 intensity → yellow `0xffd166` @ 1.45 → orange `0xff9422` @ 1.08 (~950 °C) → orange-red `0xf05a12` @ 0.78 → deep red `0xcb2807` @ 0.46 (~800 °C) → dull red `0x8a1403` @ 0.22 (~700 °C) → black crust `0x280502` @ 0.035. Colour AND intensity fall off together — since there's no tone mapping, intensity > 1 clips the hottest channels toward white, which is physically the right direction. The crust albedo cools alongside it, from warm dark grey near the vent to near-black at the toe (never a void — a flow's cold end must never read as a hole in the cone).

## Footprint & shape

Default **`radius = 2.75`** world units/tiles → **5.5 tiles across**; **`height = 2.55`** (a ~53° cone at the default radius — near the natural angle of repose, ~48°, with only a slight concave flare into the basal apron). Everything is authored at `R = 2.75` and scaled by `S = R / 2.75` for other radii. One shared height field (`coneShape`) drives the flank mesh, the flow paths and the scattered basalt blocks, so nothing ever floats or sinks: `rRim = 0.8·S`, crater depth `0.52·S`, lava-lake radius `0.46·S`. Flank lumpiness is **azimuthal** (radial rills/buttresses down the slope), not radial waves — radial waves would read as concentric pancake terraces, so the strata banding is carried entirely by the ash texture, not the geometry. Three notches cut into the rim wall where each flow spills its breach.

Registered blockers (composable `compose`, only when `blocking !== false`): a circle at the cone (`r = builtRadius × scale × 0.96`, `height = (props.height ?? 2.4) × scale`, kind `scenery`) and a second circle at the base lava pool (`r = (poolR + 0.18) × scale`, default `poolR = 0.5 × S` ⇒ 0.68 at default scale), rotated into world space with the mount's rotation.

## Flows, lake, pool & fissure

Three `FlowSpec` ribbons (`buildRibbon`, three-column cross-section — left levee / raised centre / right levee — for a rounded profile, arc-length UVs so the crack pattern is continuous and a v-offset crawl runs downhill, cut into per-segment materials for the gradient):

| flow | az | heat0→heat1 | segs | reads as |
| --- | --- | --- | --- | --- |
| main | 0.62 rad | 0.03 → 0.66 | 8 | spills the rim breach, runs all the way to the base pool |
| secondary | 2.45 rad | 0.09 → 0.86 | 6 | stalls on the lower flank as a cooled black toe |
| old | −1.45 rad | 0.86 → 1.0 | 3 | cold end of the ramp only — black crust, a whisper of dull red deep in the cracks |

Plus a **crater lava lake** (`blobDisc`, hashed lobed outline, u = 0.05 — the hottest surface in the scene), a **base lava pool** the main flow drains into (u = 0.42, offset 0.34·S past the flow's toe along its exit azimuth) with broken-basalt lips shoved up either side, and a **ground fissure** (4-segment ribbon, u 0.2 → 0.72, narrow so its incandescent interior is what reads) meandering out of the pool.

## Scattered debris

Two batched (`mergedBoxes`) block fields keyed off the same height field, skipping any point that lands on a flow: 18 chunky basalt blocks (always visible) and 46 fine rubble pieces (tagged `userData.lodDetail` — shed at NEAR range by the park runtime).

## Effects & light budget

**Exactly ONE real light**: `vent` (`THREE.PointLight`, `0xff6a1e`, range `R × 2.3`, decay 2), positioned in the crater. Everything else — flow segment materials, the lava lake, the crater wall — is emissive-material only, updated per-frame from `flowSegs`/`lakeMat`/`wallMat`.

Three `ParticleKit` emitters, ≤ **250 particles** total (inside the shared ≤ 300/component budget):

| emitter | max | gated by | reads as |
| --- | --- | --- | --- |
| `plume` | 150 | `plume` opt AND `activity > 0.02` | a dense, fairly opaque pale grey-white ash column off the summit (tight + opaque on purpose — `PointsMaterial` is unlit, so a thin puff simply vanishes in daylight) |
| `embers` | 44 | same as `plume` | sparks launched white-hot (`0xffe2a0`), arcing on gravity 1.5 and cooling to deep red (`0xc42604`) as they fall |
| `haze` | 56 | always present; rate scales with `max(0.15, activity)` | heat-shimmer/dust drifting off the base pool — not smoke, low-opacity (0.15) warm dust |

## `activity` (0 → 1, default 1)

Scales the emissive glow multiplier, the vent light intensity and the plume/ember emission rate. `activity > 0.02` is required for the plume/embers to exist at all; `plume: false` also suppresses them regardless of activity. `activity = 0` → **extinct**: zero glow (materials still render, just fully dark basalt), zero vent light, no plume/embers — a plain black basalt cone with only the residual `haze` emitter ticking over at its floor rate. `activity ≈ 0.3` → **dormant**: cracks barely lit, a thin plume — verified in the "Activity range" preview (0.28 vs 0 side by side).

## Motion & determinism

`update(time)` is a slow-motion effect on purpose — real lava creeps: one ~15 s breathing pulse across the whole crack network (`breathe = 1 + 0.11·sin(time·0.42+0.7)`), a slow surge travelling DOWN each flow (phase offset by the segment's position `u`), and a ~0.02 u/s crawl of every flow/lake/pool/fissure crust texture's `offset.y` downhill (the lake's crust+crack also drift `offset.x` for its lobed convection look). `GLOW_DAY = 1.0`, `GLOW_NIGHT = 1.85` — day glow is real, night glow is dramatic, neither is zero. Everything is hashed-sine deterministic (`hash01`/`hash2`); no `Math.random`/`Date.now`.

## Exports

- **`buildVolcano(t, opts?: VolcanoOpts) → VolcanoBuilt`** — the imperative builder. `VolcanoOpts`: `radius` (default 2.75), `height` (default 2.55), `seed` (default 1), `activity` (default 1; 0 = extinct, ~0.3 = dormant), `plume` (default true). `VolcanoBuilt` extends `ComposableBuilt` with `group`, `update(time)`, `dispose()`, `radius` (for blocker sizing), `pool: [x, z]` (local, rotate by the mount rotation) and `poolR`.
- **`<Volcano position rotation scale radius height seed activity plume blocking>`** — the composable component (`components/Park/Context.md`). Mounts inside a `<Park>` or `<ScenePreview>`; y settles onto the plaza/terrain; registers the cone + lava-pool blockers unless `blocking={false}`.

## Previews (`Volcano.previews.tsx`)

1. **3D rig** — the volcano by day: full cone, flows, pool and fissure, glow visible in daylight.
2. **Crater + lava lake** — close on the summit: crust plates + crack network, crater wall glow, the lake at its hottest, plume + embers.
3. **Night eruption** — the same rig after dark, where the crack network + single vent light carry the most dramatic read.
4. **Activity range** — two cones side by side, `activity={0.28}` (dormant, barely-lit cracks + thin plume) vs `activity={0}` (extinct: no glow, no plume, no light — plain black basalt).

## Verification (this pass)

Re-rendered after the reboot wiped `/tmp` (harness rebuilt at `/tmp/mp3d-render`, and a stray 0-byte `.!16775!index.tsx` temp file left over from the crash was deleted from this directory). `check-all.mjs` bundles clean; day, crater close-up, night (`--night --nightwait=15000`), an alternate low/side angle and the activity-range preview all confirm: dark near-black crust with the crack network clearly glowing, a real white→orange→red→black gradient down each flow, the glow reads in daylight and goes dramatic at night, the ash plume and cooling embers are visible, and `activity=0` renders a genuinely dark, glow-free cone next to the lit `activity=0.28` one. Nothing clipped or missing; no code changes were needed.

# Volcano

**CANONICAL IMPORT — copy exactly:** `import { Volcano } from './components/Volcano';`
*(never from `'./Park'`: only the `<Park>` wrappers + track-piece JSX live there. A wrong
specifier makes esbuild refuse the WHOLE bundle — the round-8 black-page failure.)*

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

**Up to TWO real lights**: `vent` (`THREE.PointLight`, `0xff6a1e`, range `R × 2.3`, decay 2), positioned in the crater — always present, intensity 0 is fine, it never gets removed — plus an eruption `flash` (`0xff7a22`, range `R × 3.4`, decay 2), positioned just above the rim so its top-down light sells the blast on the OUTER flanks in daylight (the vent alone is buried inside the crater). `flash` is only ever allocated when `canErupt` is true (`eruptEvery > 0 && activity > 0.02`) — a dormant/extinct cone or one built with `eruptEvery={0}` costs exactly one light, matching the pre-eruption budget. Everything else — flow segment materials, the lava lake, the crater wall — is emissive-material only, updated per-frame from `flowSegs`/`lakeMat`/`wallMat`.

**Five** `ParticleKit` emitters, **298 particle capacity total** (inside the shared ≤ 300/component budget) — three always-on idle emitters plus two eruption-only ones that are only built when `canErupt`:

| emitter | max | gated by | reads as |
| --- | --- | --- | --- |
| `plume` | 128 | `plume` opt AND `activity > 0.02` | a dense, fairly opaque pale grey-white ash column off the summit (tight + opaque on purpose — `PointsMaterial` is unlit, so a thin puff simply vanishes in daylight); rate ramps up through build-up and blast |
| `embers` | 48 | same as `plume` | sparks launched white-hot (`0xffe2a0`), arcing on gravity 1.5 and cooling to deep red (`0xc42604`) as they fall; rate spikes hard during `env` |
| `haze` | 22 | always present; rate scales with `max(0.15, activity)` | heat-shimmer/dust drifting off the base pool — not smoke, low-opacity (0.15) warm dust |
| `ash` | 52 | only when `canErupt`; `rate = 0` at idle | the eruption ash column proper: huge (1.25 u → 3.4 u) soft billows launched from the RIM (not the crater floor, or the near rim hides them from the DS's high 3/4 camera), far taller/faster than the idle plume wisp |
| `bombs` | 48 | only when `canErupt`; `rate = 0` at idle | lava bombs — big, fat (0.7 u), additive, genuinely ballistic ejecta (vy 3.3–7.1 u/s against gravity 6.0, ±1.9 u/s lateral spread) thrown clear out over the flanks, cooling from incandescent orange to deep red as they fall |

The idle three were rebalanced DOWN from an earlier 150/44/56 to make room for the eruption pair (128+48+22 = 198 idle + 52+48 = 100 eruption = 298 ≤ 300). The blast itself costs **no extra capacity**: instead of raising `rate`, the discrete `PULSES` table below calls `emitter.burst(n)`, which spawns directly into each emitter's existing fixed-size ring buffer. Measured live-particle count (`/tmp/mp3d-render/volc-probe.mjs`, stepping `update()` 0→80 s at dt 1/30 with `eruptEvery={40}, seed=3`): **~155 alive at idle → peak 297** (right at the 298 capacity / ≤300 budget ceiling), then back down through decay.

## `activity` (0 → 1, default 1)

Scales the emissive glow multiplier, the vent light intensity and the plume/ember emission rate. `activity > 0.02` is required for the plume/embers to exist at all; `plume: false` also suppresses them regardless of activity. `activity = 0` → **extinct**: zero glow (materials still render, just fully dark basalt), zero vent light, no plume/embers — a plain black basalt cone with only the residual `haze` emitter ticking over at its floor rate. `activity ≈ 0.3` → **dormant**: cracks barely lit, a thin plume — verified in the "Activity range" preview (0.28 vs 0 side by side).

## Motion & determinism

`update(time)` is a slow-motion effect on purpose — real lava creeps: one ~15 s breathing pulse across the whole crack network (`breathe = 1 + 0.11·sin(time·0.42+0.7)`), a slow surge travelling DOWN each flow (phase offset by the segment's position `u`), and a ~0.02 u/s crawl of every flow/lake/pool/fissure crust texture's `offset.y` downhill (the lake's crust+crack also drift `offset.x` for its lobed convection look). `GLOW_DAY = 1.0`, `GLOW_NIGHT = 1.85` — day glow is real, night glow is dramatic, neither is zero. Everything is hashed-sine deterministic (`hash01`/`hash2`); no `Math.random`/`Date.now`.

## The eruption cycle

On top of the idle creep above, the cone can run a periodic eruption: `eruptEvery` seconds between blasts (prop/opt, **default 120**; **`0` disables it entirely** — just the calm idle volcano, no flash light, no ring, no tremor, no `ash`/`bombs` emitters allocated at all). `canErupt = eruptEvery > 0 && activity > 0.02` — a dormant cone (`activity` at or below its 0.02 floor) or an `eruptEvery={0}` cone never erupts, full stop; that guard is checked once at build time and gates every eruption-only allocation (the `flash` light, the `ash`/`bombs` emitters, the base-surge ring mesh) as well as the runtime cycle math.

**One period, in order** (constants are the source-of-truth `BUILD_T`/`BLAST_T`/`TAIL_T`/`RING_T` at the top of `index.tsx`; `s` = seconds since onset, `s = 0` at the start of the blast):

| phase | window | what happens |
| --- | --- | --- |
| calm | most of the period | idle creep only — `breathe`/`wave`/crawl exactly as in Motion & determinism above |
| build-up | `BUILD_T = 6.0 s` before onset (`bld` ramps `0→1` as `((s−(period−BUILD))/BUILD)²`) | thickening plume (rate ×`1+0.9·bld`), the vent brightening (`×1+1.1·bld`), flow-segment glow warming toward the hot end, and the cone starting to shudder (tremor `0.006·bld·S`) |
| blast | `BLAST_T = 2.8 s` after onset, `env = 1` for the whole window | full-strength: flow glow surge, vent + flash lights near peak, plume/embers/ash/bombs rates all spike, the base-surge ring launches, the tremor is at its strongest |
| tail / decay | `TAIL_T = 12.2 s` after the blast ends, `env = (1−k)^1.8` easing to 0 | a long, deliberately slow ease back to idle — nothing snaps off |

So a period must be at least `BUILD_T+BLAST_T+TAIL_T = 21.0 s` to fit one full event; at the **120 s default** that is ~21 s of event to ~99 s of calm. Every one of those four window constants is scaled by `EW = min(1, eruptEvery/40)` (never above 1), so a short demo period (the "Eruption cycle" preview uses `eruptEvery={40}` ⇒ `EW = 1`, i.e. unscaled) still returns to a real idle state instead of erupting continuously; only periods **under 40 s** actually get squeezed.

Within the blast/decay window, five **discrete pulses** (`PULSES`, `[secondsAfterOnset, bombs, embers, ash]`) each call `burst()` on the `bombs`/`embers`/`ash`/`plume` ring buffers exactly once as the frame crosses that instant (a `0 < te−lastTe < 0.5 s` guard skips a stalled tab instead of dumping every missed pulse at once):

| # | s after onset | bombs | embers | ash |
| --- | --- | --- | --- | --- |
| 1 | 0.0 | 34 | 30 | 22 |
| 2 | 0.85 | 16 | 13 | 9 |
| 3 | 1.9 | 12 | 10 | 7 |
| 4 | 3.2 | 9 | 8 | 5 |
| 5 | 4.7 | 7 | 6 | 4 |

Note the last two pulses (3.2 s, 4.7 s) land after `BLAST_T = 2.8 s`, i.e. during the early decay tail, not the full-strength blast window — the discrete ejecta pulses trail slightly behind the continuous `env` falloff.

**Seed-hashed phase offset**: `phase0 = hash01(seed·7.13 + R·1.37 + H·2.71 + 2.9) × eruptEvery`, and the cycle runs on `te = time + phase0` (`s = te mod eruptEvery`). This is a pure function of `seed`/`radius`/`height`/`eruptEvery` — no build counter, no wall-clock — so the same volcano always erupts at the same absolute times and two differently-seeded/sized volcanoes in one park desync instead of blasting in lockstep. **Render-timing gotcha**: because the offset is hashed, the blast does NOT land at `t = 0`, `eruptEvery`, `2×eruptEvery`, … — with the demo preview's `eruptEvery={40}, seed=3` the blasts land at **t ≈ 9 s and t ≈ 49 s**, not t = 0/40/80. A naive screenshot script that does `--wait 40000` expecting to catch the blast at the period boundary will miss it entirely; step through the full period (or probe `update()` directly, as `/tmp/mp3d-render/volc-probe.mjs` does) to find the actual onset for a given seed before trying to render it.

**What it looks like**: the vent + flash `PointLight`s flare from a **~0.5 daytime baseline to a measured peak of ~9.9**, then ease back down over the tail; the ash column and lava-bomb ballistic arcs use the `ash`/`bombs` emitters described above; an expanding **base-surge ring** (`RING_T = 2.6 s` life, `EW`-scaled) — a single unlit `MeshBasicMaterial` conical skirt, not particles, so it costs zero particle budget and still reads at night — sweeps out from the rim down over the flanks and fades; and the whole `body` group (everything solid — meshes only, not the lights or particles, which stay on the outer `group` so airborne ash never jitters with the rock) **shudders** by a couple of centimetres (`quake = (0.006·bld + 0.024·env·…) × S`) during build-up and blast.

## Exports

- **`buildVolcano(t, opts?: VolcanoOpts) → VolcanoBuilt`** — the imperative builder. `VolcanoOpts`: `radius` (default 2.75), `height` (default 2.55), `seed` (default 1), `activity` (default 1; 0 = extinct, ~0.3 = dormant), `plume` (default true), `eruptEvery` (default 120 seconds between eruptions; `0` = never erupts, just the calm idle volcano; needs `activity > 0.02`, see "The eruption cycle" above). `VolcanoBuilt` extends `ComposableBuilt` with `group`, `update(time)`, `dispose()`, `radius` (for blocker sizing), `pool: [x, z]` (local, rotate by the mount rotation) and `poolR`.
- **`<Volcano position rotation scale radius height seed activity plume eruptEvery blocking>`** — the composable component (`components/Park/Context.md`). Mounts inside a `<Park>` or `<ScenePreview>`; y settles onto the plaza/terrain; registers the cone + lava-pool blockers unless `blocking={false}`.

## Previews (`Volcano.previews.tsx`)

1. **3D rig** — the volcano by day, default `eruptEvery` (120 s): full cone, flows, pool and fissure, glow visible in daylight.
2. **Crater + lava lake** — close on the summit: crust plates + crack network, crater wall glow, the lake at its hottest, plume + embers.
3. **Night eruption** — the same rig after dark, where the crack network + vent `PointLight` carry the most dramatic read.
4. **Activity range** — two cones side by side, both built with **`eruptEvery={0}`** (cycle fully off — no bursts, no flash light, no ring, no tremor): `activity={0.28}` (dormant — cracks barely lit, thin plume) vs `activity={0}` (extinct — no glow, no plume, no light, reads as plain black basalt scenery).
5. **Eruption cycle** — a single cone on a deliberately short **`eruptEvery={40}`** demo period (`seed={3}`), framed wider (`distance={16.5}`, `targetY={2.8}`) to keep the full blast in shot: one period runs ~19 s of the calm cone, the 6 s build-up (thickening plume, brightening vent, the first tremor), the blast (lava bombs on ballistic arcs, the surging ash column, the ember spray, the expanding base-surge ring, the daylight-readable light flare), then a 12 s decay back to the idle wisp.

## Verification (this pass)

Confirmed the eruption code (already built and verified working by a prior pass) against the actual constants in `index.tsx` before writing this doc, and re-ran `/tmp/mp3d-render/volc-probe.mjs` — which steps `buildVolcano(THREE, { eruptEvery: 40, seed: 3 }).update(time)` from `time = 0` to `80` at `dt = 1/30` and counts live particles / max `PointLight` intensity twice a second — to get real numbers rather than re-deriving them from the source alone:

| measurement | idle | peak | notes |
| --- | --- | --- | --- |
| live particles | ~155 | **297** | against a 298-capacity / ≤300-per-component budget; the blast reaches this via `burst()` into the existing `plume`/`embers`/`ash`/`bombs` ring buffers, not by adding capacity |
| `PointLight` intensity (vent, and flash once `canErupt`) | 0.5 (daytime baseline) | **9.9** | eases back down over the `TAIL_T = 12.2 s` decay, not a hard cutoff |
| blast timing | — | t ≈ 9 s and t ≈ 49 s | for `eruptEvery=40, seed=3` — the seed-hashed `phase0` offset means the blast does NOT land on the 0/40/80 s period boundary (see the render-timing gotcha above) |

Also re-confirmed `emitters` went from 3 → **5** (`plume`, `embers`, `haze` idle + `bombs`, `ash` eruption-only), and that the only `Math.random` occurrence anywhere in `index.tsx` is a comment forbidding its use — determinism is intact.

Screenshots at idle, peak and mid-decay (`eruptEvery={40}` demo preview, timed off the probe's t ≈ 9 s onset) confirm the visual read matches the code: **idle** — the calm cone exactly as in the pre-eruption verification (dark near-black crust, crack network glowing, gradient down each flow, ash plume + cooling embers, no bombs/flash). **Peak (blast)** — a visibly glowing crater, lava bombs on clear ballistic arcs out over the flanks, a tall ash column and an ember spray, the flanks lit by the rim flash but NOT washed out (the flash's daylight floor and falloff keep the crust legible, not blown to white). **Decay** — a tall drifting ash column still climbing while the bomb count thins out and the vent/flash light eases back toward the 0.5 baseline. `check-all.mjs` bundles clean; nothing clipped or missing; no code changes were needed for this documentation pass.

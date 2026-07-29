# EmberRoast

**CANONICAL IMPORT — copy exactly:** `import { EmberRoast } from './components/EmberRoast';`
*(never from `'./Park'`: only the `<Park>` wrappers + track-piece JSX live there. A wrong
specifier makes esbuild refuse the WHOLE bundle — the round-8 black-page failure.)*

**"Ember Roast" — the EMBERFALL CALDERA world's food stall: a volcanic-stone SKEWER GRILL.** Rough basalt block counter under a slate top, an iron grate over a bed of glowing coals sunk into it, three skewers turning on the fire, a soot-blackened chimney breast and banded stack, an iron rack of spare skewers, a scorched-sailcloth valance in the world's own canopy colours, a slate chalk menu board on a basalt post, and — RCT2-style, the building says what it sells — a **GIANT charred skewer** as the sign, lifted clear above the stack so it silhouettes against sky rather than against basalt.

Serving front faces local **+z**; the GameManager attach point sits **0.72 u** out that way. Sized against a 0.5-scale park guest like the four catalog shops: counter top y 0.46, grate 0.58, stack top 1.66.

## Exports

- `<EmberRoast position rotation scale withGuest effects register pinned name price value>` — built on `<ConfigurableStall>` via `composableStall`. Inside a `<Park>`, `register` registers a selling FOOD stall with the GameManager (defaults: **Ember Roast, price 4, value 6**): guests hunger-seek it, buy, eat a real skewer and bin/litter the container. `withGuest` adds the decorative queueing peep (preview flavour; default off). `effects` (default true) toggles the smoke/spark emitters.
- `buildEmberRoast(t, { withGuest?, effects? }) → { group, update, dispose }` — the imperative builder.
- `buildHeldSkewer(t) → THREE.Group` — the held item recipe (below).

**NAME IT** (round-7, same as the other stalls): `register={{ name: 'Caldera Grill', price: 4, value: 6 }}` — the manager keys `moveStall` and the corridor resolver on the name, so shipping the catalog default twice makes it measure the wrong shop.

## The lava language — the coals glow BY DAY

The ember bed is **not an orange blob**: it is near-black basalt crust with an emissive CRACK network, built from EmberfallScenery's shared helpers (`crustCanvases`, `emberfallLavaMat`, `emberfallHeatAt`) so a skewer grill standing beside a `<LavaFissure>` or a `<Volcano>` is the same temperature of fire. Bed floor at ramp key `u = 0.10` (white-yellow cracks), coals split between `u = 0.18` (hot) and `u = 0.42` (cooling), with cold cinder lumps heaped in among them for the contrast that stops the pit reading as a light box.

Per the house rule for anything molten, `nightKOf` only **lerps** the emissive multiplier (`GLOW_DAY 1.0 → GLOW_NIGHT 1.85`) and the ember PointLight keeps a real daylight floor (`0.35 + 1.15·nk`) — the fire is never gated to zero. The two gaslights hung off the lintel are ordinary lamps and DO stay dark until night.

The crust/crack texture repeats are deliberately LOW (bed 1.4 × 0.5, coals 1 × 1): at 3× the crack network on a 0.38-deep plate is sub-pixel at park zoom and the fire reads as a hole.

## The held SKEWER (`buildHeldSkewer`)

`buildHeldSkewer(t) → THREE.Group` is the grill's own 3D item, registered on the stall descriptor as GameManager's `StallConfig.heldItem`: every guest who buys HERE walks off eating THIS skewer — a 0.3-long hardwood stick with a charred point, three seared meat chunks (hashed-jittered, charcoal caps on the undersides) and two scorched pepper slices threaded on it — instead of the manager's generic burger puck. Same recipe (`skewerProp`) as the ones sizzling on the grate, the spares in the rack and the giant sign, at three different scales.

**The offsets, and why.** The hand hold spot sits 0.15 FORWARD of the fist ball (arm-local `[0, −0.32, 0]`) because it is sized for a fat burger, so a slim item left near the origin floats a clear 0.1 in front of the hand — the first profile render showed exactly that (the floss-cone lesson, harder). Solving the tilted frame for "the stick passes through the ball centre" gives:

```
position (0, 0.03, −0.15)   rotation.x 0.4   inner stick centre y 0.15   foodShift +0.045
```

which threads the STICK THROUGH THE FIST: the bare handle pokes out below the little finger, the lowest meat chunk sits right on top of the grip, and the food still clears the forearm and — at full bite lift — the hair. `skewerProp`'s `foodShift` slides the threaded food toward the point, which is what leaves that handle bare on a short stick. Verified with profile + body close-ups of real sim buyers (`/tmp/mp3d-render/shots/closeup-skewer*.png`).

Override per placement with `register={{ heldItem }}`. See components/GameManager/Context.md → "Per-stall held items".

## Budgets

2 real PointLights (the day-floored ember bounce + the night-gated counter gaslight), 62 particles (38 smoke off the grate + 24 additive sparks off the coals, both walking their origin along the fire), every static repeat batched through `mergedBoxes` (two stone-tone block facings, rivets, grate bars, soot streaks, chalk rows, cinder litter), fine detail tagged `userData.lodDetail`. Deterministic — hashed sines only; the updater takes ABSOLUTE time.

## Previews

1. **Selling skewers (live sim)** — a miniature `createGameManager` on a path loop with the stall registered at the counter front (anchor `[0, 0, 0.1]`, front z 0.82), pre-warmed 78 sim-s so the crowd is already hungry, then 2× time: guests walk up, buy, and stroll off eating the skewer until only a container is left to bin.
2. **3D rig** — `<EmberRoast withGuest>` in `<ScenePreview distance={4.4} targetY={0.8} autoRotate={false}>`.

## Modelling note

The first pass put a square flue hood over the coals and an iron awning over the counter: at the isometric camera elevation the stall rendered as a closed dark box with the entire point of it hidden. The flue is now a canted chimney BREAST at the back and the gantry is a beam, not a canopy — nothing sits over the fire.

## The world's paving, in the sim preview

The live-sim preview builds its own `buildPathNetwork`, and it was laying stock
municipal tarmac under a volcanic stall. It now passes
`surface: SURFACE_BASALT` — Emberfall Caldera's own `theme.pathSurface`
(`components/PathNetwork` → `PathSurface`), the same surface the land hands
`<Paths>`. This preview is the only place the stall is shown standing on a path,
so it is the only place that could get it wrong.

## Audit — 2026-07-25, 100/100

| Dimension | Score | Notes |
|---|---|---|
| Mesh richness & count | 15/15 | 167 meshes / 10 236 tris for a stall; two stone-tone block facings, rivets, grate bars, soot streaks, chalk rows and cinder litter all `mergedBoxes`; 4 `lodDetail` groups |
| Detail | 15/15 | basalt block counter, slate top, iron grate, banded stack, canted chimney breast, iron skewer rack, scorched valance, chalk menu board, heroic skewer sign; 2 PointLights (ember bed day-floored at 0.35 + 1.15·nk, counter gaslight night-gated) |
| Cohesion | 20/20 | nothing over the fire (the flue is a BREAST at the back, the gantry a beam) — verified from --elev=50 and a 26° front close-up; the ember bed's crust sits inside its own pit; no z-fighting on the coplanar slate/soot courses |
| Guest comfort | 15/15 | held skewer probed in the ARM-LOCAL frame: stick axis passes **0.031** from the fist-ball centre (r 0.05 → inside), handle **0.020 proud below the fist**, back end **not** in the forearm box, food clear of the torso by 0.036; visually checked at carry bend −0.55, mid-lift and the full −1.85 bite from three angles |
| Guest location | 15/15 | behaviour probe, 318 sim-s sampled every 150 ms of SIM time: **8/8 guests reached the serving front** (min distance 0.000-0.78 u), the `buying` state was entered (24 samples) and the manager logged *"This food from Ember Roast is really good value"* by name, and the worst still-while-`walking` streak is **2.55 sim-s** against validatePark's 25 s pin gate |
| Aesthetic | 20/20 | reads instantly as a skewer grill (the building says what it sells); the fire reads as a hot bed from the park camera; night = brighter coals + a lit counter lamp |
| **Total** | **100/100** | |

Probes: `/tmp/mp3d-render/ember-probe.tsx` (`skewer` block — arm-local geometry),
`aud-skewer.mjs` (three-angle visual on a real `buildPeep` at GameManager's exact
hold transform), `aud-roast-behaviour.mjs` (the sim-clock behaviour probe above —
note it runs fixed 1/30 substeps and samples SIM time, because under SwiftShader
wall-clock and sim-clock differ by ~25x). Shots: `shots/AUD7-EmberRoast-front.png`,
`FINAL-EmberRoast-el50.png`, `FINAL-EmberRoast-night.png`,
`AUD2-EmberRoast-1-az115.png`, `AUD8-skewer-{front,profile,high}.png`.

Fixed this pass:
- the valance's scalloped hem was full **spheres** of r 0.052 and read as a row of
  red baubles from the park camera; they are squashed to (1, 0.62, 0.45) so they
  read as half-rounds of cloth;
- the sim preview's path now uses the world's `SURFACE_BASALT`.

Measured note: 0.11 of the skewer's stick lies inside the forearm box between the
wrist and the fist. That is the GRIP, not burial — the rubric's test is "axis
inside the fist ball, back lip not in the sleeve", and both pass; the visible
handle end pokes out 0.020 below the little finger.

# BrassworkScenery

**CANONICAL IMPORT — copy exactly:** `import { GiantGear, SteamPipes, ClockTower, BoilerTank, CoalCart, BRASSWORK } from './components/BrassworkScenery';`
*(never from `'./Park'`: only the `<Park>` wrappers + track-piece JSX live there. A wrong
specifier makes esbuild refuse the WHOLE bundle — the round-8 black-page failure.)*

The five scenery pieces of the **Brasswork Foundry** world — a steampunk industrial quarter. Per-world scenery, not an extension of the shared `SceneryPack`: one component folder exporting five imperative builders plus five composable components, so the whole yard dressing set arrives (and versions) together. Same shape as `components/EmberfallScenery` and `components/TidewaterScenery`; the world's stall is `components/GoggleWorks`.

| piece | reads as | default footprint | blocks? | moves? |
| --- | --- | --- | --- | --- |
| **`<GiantGear>`** | an oversized cast-iron gear on a bearing pedestal, teeth worn and one broken off, driving a pinion and a drive shaft | r 0.64, 1.10 tall | yes (circle) | **both gears turn**, geared 24 : 10 |
| **`<SteamPipes>`** | a tangle of riveted plumbing: flanged risers, elbows over the top, valve handwheels, live gauges, two puffing relief vents | r 0.46, 1.08 tall | yes (circle) | steam, needles, wheel creep |
| **`<ClockTower>`** | a slender riveted octagonal tower, four working clock faces, copper spire, belfry bell | r 0.32, **2.63 tall** | yes (circle) | hands, bell, night dial |
| **`<BoilerTank>`** | a horizontal riveted boiler set in brick, firebox glowing, gauge glass, smoking chimney | 1.16 × 0.70, 1.20 tall | yes — rotated **RECT** (it is long) | fire breath, needle, smoke |
| **`<CoalCart>`** | a narrow-gauge tipper heaped with coal on spiked track with sleepers and ballast | track 1.5 long; **wagon** 0.42 × 0.52, 0.63 tall | **the WAGON only** (rect) — never the track | no |

Palette: `BRASSWORK`, exported as data — muted brass, oxidised copper weeping verdigris, soot-grey iron in three values, coal black, rust, cinder, creosoted timber, enamel dial. **No shiny gold anywhere.**

## Two rules that shaped every surface in this folder

**1. METALNESS IS CAPPED AT 0.34** (the `surface()` helper enforces it). A `MeshStandardMaterial` at metalness ≥ 0.6 with no environment map renders near-black — metals are lit only by reflections, and this Stage has a sun and nothing to reflect. The lesson came from `GoggleWorks`; every metal here sits in 0.18–0.34 and gets its brass from **colour plus texture**. If a future piece needs real gloss it needs an env map first (see Emberfall's obsidian for how).

**2. A GRIME MAP MULTIPLIES, SO IT HAS TO START BRIGHT.** Both local canvases are **luminance maps centred near white** (0.88 / 0.91), not coloured textures, so ONE canvas serves brass, copper, iron and firebrick — the palette entry sets the hue and the canvas only supplies grime, wear and relief. The first pass sat at 0.80 with heavy soot blotches and, multiplied into a brown-olive iron, collapsed the entire yard into one indistinguishable brown mass. Which is also why **`BRASSWORK.iron` is a neutral warm grey (0x615c53) and not the theme's 0x554533**: that value is right on a stall's small parts and wrong on a 1 u boiler barrel.

## Local procedural canvases

Both module-cached, both built the way Stage's own `drawTexture` builds its textures (2D canvas, per-stroke variation) but with `hash01` instead of `Math.random`, so screenshots are byte-identical run to run:

- **`grimeCanvas()`** — 190 fine tooling streaks, **14** soft soot blotches, 12 warm rust weeps, 900 grit/pit specks and 9 pale wear scuffs where hands and chains polish metal back. Map **and** bump. (It was 22 blotches at up to 0.44 alpha; over a 128² tile on the boiler barrel that read as **leopard skin**, then as **pinecone scales** when the repeat was too tight. Blotch count and repeat are both load-bearing.)
- **`tarnishCanvas()`** — 20 **green-shifted** tarnish blooms (on copper these *are* the verdigris), 10 soot films, 90 polish streaks, pits and 7 rubbed highlights. Map **and** bump. This is what makes brass read as brass at metalness 0.32.

## Rivets: the textbook `mergedBoxes` case

Four ring/row helpers (`rivetsXY`, `rivetsAxisX`, `rivetsAxisY`, `rivetRow`, plus `shift`) emit `MergedBoxSpec[]`, so each piece's rivets — 130 on the boiler, ~120 up the tower's eight seams, 60 on the wagon — collapse into **one mesh**, tagged `userData.lodDetail`.

Two calibration notes worth keeping:

- **Size.** 0.019 u heads read as a string of **yellow beads** on every piece. 0.012–0.016 reads as a dotted seam at park zoom and as ironmongery close up.
- **Tone is per-background.** On the tower, the wagon and the pipes the heads are `brassDark`; on the boiler's **pale** barrel `brassDark` vanished and they are `brass` — a warm bronze dot on grey iron. Rivets have to contrast with what they are sitting on, not with the palette.

`mergedParts` / `mtx` / `alongDir` are the non-box counterparts (cylinders, tori, squashed icosahedra), imported from Stage. They used to be a third independently-reimplemented copy in the fleet (Emberfall, Tidewater, here); once this pack made it three, they were consolidated into `Stage` next to `mergedBoxes` and this folder now imports them — see Stage/Context.md.

## LYING A PATCH ON A CYLINDER — get the rotation right

Rust, soot and patina patches are boxes laid on curved surfaces, and the rotation that puts a box's face on the surface depends on how you wrote its position. A box rotated about X by θ sends its local **+y** to `(0, cos θ, −sin θ)`:

- position written as `(x, CY + R·cos a, R·sin a)` → outward radial is `(0, cos a, sin a)` → **`rotX = −a`**
- position written as `(x, CY + R·sin φ, R·cos φ)` → outward radial is `(0, sin φ, cos φ)` → **`rotX = φ − π/2`**

The boiler's first pass used `a + π/2`, which is the **tangent**, and every rust patch stood off the barrel as a red plate sticking out sideways. On the tower's octagonal spire there is a second trap: the octagon's flat faces are inset by `cos 22.5° = 0.924`, so streaks placed at the circumscribed radius **float clear of the metal** — they read as turquoise dashes hovering over the cap until they were pulled in to `0.93 r` and darkened to `0x36483a`.

## 1. `<GiantGear>` — the gear train

The teeth are the piece: **24** of them, tangential width `0.46 P` (the rest is backlash), standing `0.15 R` proud of a rim built from 24 bolted arc segments with the **six spokes visible through it** — a solid disc is a wheel, not a gear. Three hashed teeth are worn round (threshold 0.86 — at 0.74 a quarter of the rim was worn and it read as *ragged* rather than *used*) and one is **broken clean off**, leaving a chipped stump.

**The pinion mesh is exact, not eyeballed.** It carries the same circular pitch, so 24 : 10 = 2.4, and starts half a tooth off the line of centres: every `2π/24` the big gear turns, the pinion turns exactly one of its own teeth, so the interleave holds forever at any time value. `ω = 0.135 rad/s` (≈ 46 s per revolution) off absolute time.

Two things exist purely for camera robustness, and both were added after looking at renders:

- the pedestal stands **behind** the gear plane (z < 0) so it never hides the spokes;
- the gear is `0.30 R` **thick** and the pinion drives a **shaft on a plummer block running out of the plane**. A gear train is coplanar by definition, so orbit the park camera round to its edge and the whole piece was a paper sliver. Aim `rotation` to present the face; the shaft and pedestal carry the edge-on view.

## 2. `<SteamPipes>` — the tangle

"Tangle" needs three things a neat pipe stack does not: **different depths** (a run at ankle height crosses toward the viewer — without it the cluster is a flat facade), real **elbows** (quarter tori; a pipe that turns a corner by intersecting another pipe reads as scaffolding) and **flanged joints with rivet rings**, because that is where the eye looks for plumbing. Then the ironmongery that says *pressure*: an octagonal stop-valve casting, two handwheels, a drain cock, two live gauges with a red danger arc, two relief vents.

- **Elbow orientation.** An unrotated `TorusGeometry` quarter joins a vertical leg on its **right** to a horizontal leg running **−X**; `rotY π` mirrors that (vertical leg left, top run leaving **+X**). For a **horizontal-plane** elbow, `rotX(−π/2)` then `rotY(π)` turns a run arriving in +Z into one leaving in +X — and note `mtx` uses Euler order `'YXZ'`, which applies the X term first, which is exactly what makes that composition work.
- **Handwheels are FAT and NEARLY FLAT.** At rim tube `r·0.16` the rim went to 0.013 u and vanished at park zoom (now `r·0.23`), and a wheel standing dead **vertical** is edge-on to a ~50° isometric camera and reads as a brass sliver, so both wheels lie within 0.25 rad of horizontal. Placement took three passes: on the back riser the second wheel was occluded first by its own gauge bracket and then by the copper line, so it now sits on a **standpipe off the low cross run**, in the clear foreground — which also puts a third element at a third depth, where the tangle wants it.
- **The vents PUFF, but something is always blowing.** Two hashed lift cycles: the copper line's valve always bleeds (rate 9) and surges to 24, the top vent pops intermittently. The first pass gated **both** to zero between lifts and there were frames — including the screenshot frame — with no steam anywhere, which fails the brief.
- The plinth is **grey concrete with an 'asphalt' kerb**: `IRON_D` under the `'concrete'` texture, and `'metal'`'s fine parallel streaks stretched over a 0.78 u slab, both read unmistakably as **wooden decking**.

## 3. `<ClockTower>` — the four faces

**Reading the time at park zoom is a contrast problem, not a detail problem.** Brass hands on a brass dial are invisible at any resolution. So: the dial is the palest surface in the world (`dial 0xe8e0cc`), the hands are near-black (`0x231e1a`), the numerals are `brassDark` — twelve, long bars at the quarters — and the numeral mesh is deliberately **NOT** `lodDetail`, because the numerals *are* the read. After dark the dial goes emissive (gas-lit dials are historically right) and the hands silhouette against it.

All four faces run off ONE absolute-time clock: minute hand 150 s per revolution, hour hand 12× that, starting at **10:10** — the classic display time, which keeps the hands apart and off the numerals. Each face is a yaw sub-group, so `rotation.z = −angle` is clockwise on all four alike; the four dials, four bezels and 48 numerals are merged into one mesh apiece by composing the face transform with the local one.

Proportion notes: the shaft is **slender on purpose** (0.26 across under 2.63 u — a fat tower at this height reads as a chimney), and the head went through two passes. The first eaves were r 0.38 over a 0.13 shaft: a **mushroom cap**, and its overhang **hid the bell completely** — at a ~50° camera elevation an overhang occludes everything within ~1.2× itself below it. Now: eaves r 0.21 (0.075 past the belfry posts), a taller belfry, and **louvres on the two far sides** so the brass bell has a dark ground to read against.

The bell rings on the hour: a 48 s cycle with a ~6 s exponentially-decaying strike at ±0.34 rad, and a 0.012 rad idle sway otherwise. An always-swinging bell reads as a toy.

## 4. `<BoilerTank>` — the pressure vessel

The read comes from four things, in this order:

1. **the circumferential seams and their rivet rings** — a smooth cylinder is a water tank. The end plates and the three seam bands live in their **own darker material**: merged into the barrel's pale iron they were invisible, and the seams are the whole read;
2. **the firebox** under the barrel with a glowing door — a boiler needs a fire or it is a barrel on legs;
3. **the chimney**;
4. the ironmongery on top: safety valve with its weight lever, bolted manhole, gauge glass on stand-off cocks with the water level showing dark in the bottom half, live pressure gauge.

It is **set in brick** rather than propped on two cradles, which is what a stationary boiler actually did: the brick setting carries the firebox half (the barrel sinks 0.04 into it) and a single iron cradle carries the smokebox end. The fire **never gates to zero by day** — a lit fire is lit, Emberfall's rule — and breathes on two hashed sines; only the `PointLight` is night-weighted (0.07 floor → 0.49). Soot patches are `0x3a332c`, not the palette's true `soot`: a 14%-albedo patch on a pale barrel reads as a torn **hole** in the plate.

Blocker: a rotated **rect** (`hx = length/2`, `hz = 0.35`) — a circle over a 1.16 u boiler would fence off half a tile of clear yard.

## 5. `<CoalCart>` — track and wagon

Two independent reads.

**Track** is a layer cake: cinder ballast with sloped shoulders, ten creosoted sleepers each hashed off square in yaw, roll and sink (identical square sleepers read as a **ladder**), a real rail section of **foot, web and head** (a single box is a plank), 40 spikes at the chairs, a bolted fishplate at the joint. Flat, and **never a blocker** — it is meant to run past paths and lawns, and fencing off rails would carve holes in the walk network.

**Wagon** reads from the **flare** and the **load**:

- the body is four **separately tilted plates** (±0.166 rad) plus a floor, not one tapered prism, which gives real corner seams to strap and rivet;
- the **rim band and corner straps are pale iron in their own mesh**. Merged into the sooty body plate the wagon was one dark value on a dark track and the flare could not be read at all; a bright band round the mouth outlines the shape and is what says *tipper*;
- the **coal** is ~28 rounded flat-shaded lumps in **two tones** heaped above the rim. Pitched up off pure black (`0x302e36` / `0x393742`) because a 3%-albedo heap reads as a hole in the frame, and left slightly glossy (roughness 0.52) because anthracite has a real sheen. The filler ellipsoid under the lumps is kept **small and low**: at 0.055 half-height its smooth surface read straight through the lumps as a dark **disc** — a manhole cover, not coal. `coalFace` is barely brighter than `coal` on purpose; at `0x413f4a` the facets read as chips of **ice**;
- flanged wheels sit **on** the rail head, with pin-and-link coupling hooks at both ends and a loose link hanging off one.

Blocker: a rect over the **wagon only**, centred at `cartAt` along the track's local +Z rotated into world space (`local +z = [sin yaw, cos yaw]`).

## Budgets

- **3 PointLights** (budget 4): the clock tower's dial gaslight — under the clock stage, never inside it, because a PointLight in a closed box lights nothing — its bracket lantern, and the boiler's firebox. All night-gated on `nightKOf` smoothstep; the firebox keeps a 0.07 ember floor.
- **74 particles** (budget 300): steam 28 + 20 at the pipe vents, chimney smoke 26. The smoke is a **light** grey at 0.42 opacity: `PointsMaterial` is unlit, and dark smoke over dark iron is nothing.
- **Nine updaters, all absolute-time**: two gear rotations, two steam duty cycles, three gauge needles, two handwheel creeps, eight clock hands, one bell strike, one fire breath, one smoke.
- Draw calls: gear 7, pipes 11, tower 12, boiler 12, cart 9. Static repeats go through `mergedBoxes` (rivets, ticks, spikes, patina, soot, rust) or `mergedParts`, one mesh per material; rivet heads, dial ticks, track spikes, patina, soot, rust and cinder litter carry `userData.lodDetail`.
- Deterministic: hashed sines only, never `Math.random` / `Date.now`.

## Composing a yard

All five take `position` / `rotation` / `scale`, settle onto terrain via `park.floorAt`, and report their footprint (`radius`, `length`/`halfWidth`, `cartHalfX`/`cartHalfZ`/`cartAt`, `height`) so a layout can size its own clearances.

**Laying out a row is not a matter of world x.** This Stage's default camera sits at an azimuth where *both* +x and +z come toward the viewer, so a row along world x stacks diagonally and half of it leaves the frame. Measured off the render harness at `distance 7.4`: **100 px right ≈ (+0.76, −0.58)** in (x, z) and **100 px down ≈ (+0.85, +0.64)**. A left-to-right row is therefore a line of *increasing x and decreasing z* — which is exactly what `BrassworkScenery.previews.tsx`'s `Yard` does.

Aim `rotation` deliberately: the gauges and valve wheels face local **+z**, the gear presents its **face** along +z, the boiler's barrel runs along local **x** with its firebox door on the **−x** end (previews use `rotation ≈ 1.35` so the glowing door faces the camera), and the cart's rails run along local **z**.

## Audit — 2026-07-25, 100/100

| Dimension | Score | Notes |
|---|---|---|
| Mesh richness & count | 15/15 | gear **12 / 2 896 tris**, pipes **28 / 4 288**, tower **40 / 6 076**, boiler **25 / 4 544**, cart **15 / 3 432** — **120 meshes / 21 236 tris for the whole pack**, comfortably inside the 8-48 draws a scenery piece is budgeted; 27 `lodDetail` meshes; rivets, ticks, spikes, patina, soot, rust and cinder litter all through `mergedBoxes`/`mergedParts`; determinism MATCH on all five |
| Detail | 15/15 | both local canvases are luminance maps near white (0.88 / 0.91) so ONE canvas serves brass, copper, iron and firebrick as map AND bump; nine absolute-time updaters (two gear rotations, two steam duty cycles, three needles, two handwheel creeps, eight clock hands, bell strike, fire breath, smoke); 3 PointLights, 3 emitters / 74 particles; **max metalness 0.33** across all five |
| Cohesion | 20/20 | **`seed-sweep BrassworkScenery` CLEAN over 4 400 builds** — the regression guard the pack was given after `<TidePool>`, still green. Every piece's declared footprint matches its real mesh extent (heights 1.11 / 1.06 / 2.63 / 1.17 / 0.62 against declared 1.10 / 1.08 / 2.63 / 1.20 / 0.63) and **every base reaches y ≤ 0**, so nothing floats: gear −0.09 (ballast mound), pipes −0.02, tower −0.03, boiler −0.29 (set IN brick), cart −0.03. In the live world all 14 placed pieces clear `validatePark`'s blocker and footprint sweeps with **0 warnings** |
| Guest comfort | 15/15 | n/a by construction and confirmed: nothing here is sat in, stood on, worn or carried — all five are blockers a guest walks around (and the cart's TRACK is deliberately not a blocker, so it can run past a path) |
| Guest location | 15/15 | the pack contributes only blockers; the world park probe records **0 pins** (longest still-while-walking over 58 guests: none) and no `padOnStreet` / `padNearStreet` / `causeway` against any scenery rect |
| Aesthetic | 20/20 | all five read from the real 50° park camera (`shots/aud/BS-set-e50.png`, `[harness] camera … "el":50`): the clock face is legible at that distance, the gear reads as a gear through its spokes, the tangle reads as plumbing at three depths, the boiler reads as a fired pressure vessel and the tipper reads from its flare and its two-tone heap. Night: the dial goes emissive and the firebox glows — you navigate by the tower |
| **Total** | **100/100** | |

Probes: `/tmp/mp3d-render/aud-scen.tsx` (per-piece census + meshes-only extents vs declared
footprints), `aud-brass-facts.tsx` (budgets, determinism, metalness), `tools/seed-sweep.mjs`.
Shots: `shots/aud/BS-set-{day,a115,e50}.png`, `BS-night.png`, `BS-{gear,pipes,tower,boiler,cart}.png`.

**Nothing in this folder needed changing.** Everything above is a measurement, not a fix — which is
worth writing down, because the two rides and the stall in the same world all did need one.

### One number to know before you place a gear

`<GiantGear>`'s **mesh** reaches x +0.92 while its **blocker** is r 0.64: the pinion's drive shaft and
plummer block run 0.28 u outside the blocked circle by design (they exist so the piece is not a paper
sliver edge-on). The shaft is at 0.6-0.9 above ground, so it overhangs rather than obstructs, and the
world's own pre-flight checks scenery meshes against streets separately. Same shape of gap on
`<SteamPipes>` (mesh 0.65 vs r 0.46) and `<BoilerTank>` (mesh 0.87 vs a 0.58 half-length + 0.35
half-width rect). If a composing layout ever puts one of these hard against a walked slab, check the
MESH extent, not the reported radius.

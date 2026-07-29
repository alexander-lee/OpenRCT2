# EmberfallScenery

**CANONICAL IMPORT — copy exactly:** `import { buildFumarole, buildObsidianShards, buildBasaltColumns, buildLavaFissure } from './components/EmberfallScenery';`
*(never from `'./Park'`: only the `<Park>` wrappers + track-piece JSX live there. A wrong
specifier makes esbuild refuse the WHOLE bundle — the round-8 black-page failure.)*

The five scenery pieces of the **Emberfall Caldera** world — per-world scenery, not an extension of the shared `SceneryPack`: one component folder exporting five imperative builders plus five composable components, so the whole volcanic dressing set arrives (and versions) together.

| piece | reads as | default footprint | blocks? | glows? |
| --- | --- | --- | --- | --- |
| **`<Fumarole>`** | a cracked rock vent hissing a steam/gas plume out of a glowing throat | r 0.40, throat lip 0.13 | yes (circle r × 1.05) | emissive throat, day + night |
| **`<ObsidianShards>`** | a cluster of angular volcanic-glass blades — the one glossy surface in the world | r 0.34, tallest 0.80 | yes (circle r + 0.08) | no (it *reflects*) |
| **`<BasaltColumns>`** | a Giant's-Causeway colonnade of hexagonal columns at varying heights | spread 0.62, tallest 1.35 | yes (circle = outermost column) | no |
| **`<LavaFissure>`** | a flat ground crack with magma glowing inside | 1.8 long × ~0.6 wide × 0.09 tall | **NO** (opt-in) | yes — the hero glow, day + night |
| **`<CharredSnag>`** | a dead, burnt tree: blackened trunk, broken limbs, no foliage | r 0.15, height 1.35 | yes (circle r × 1.7) | no |

Palette: basalt greys and blacks, ash, scorched brown, a bloom of pale ochre sulfur. **The only saturated colour in the world is the lava itself** (`EMBERFALL`, exported as data).

## The lava language is Volcano's

Anything incandescent here follows `components/Volcano` (and its Context.md "The temperature ramp") exactly:

- **Near-black basalt crust + an emissive CRACK NETWORK**, never a uniformly glowing orange blob. `crustCanvases()` bakes a 5×5 jittered-grid Voronoi over a 192² torus (25 plates, toroidally wrapped so it tiles) into two canvases: a dark plate/groove **albedo** (also the bump map, so cracks are recessed) and a black-with-bright-cracks **emissive** map. `d2 − d1` is 0 exactly on a plate boundary, so `exp(-(d2-d1)/w)` gives a narrow hot core (~1.7 px) plus a short glow shoulder — deliberately narrow, because the plates are the bulk of the surface and they are black.
- **The same 7-stop temperature ramp** (`emberfallHeatAt`): white-yellow `0xfff0c0` @ 1.85 → yellow → orange `0xff9422` @ 1.08 → orange-red → deep red `0xcb2807` @ 0.46 → dull red → black crust `0x280502` @ 0.035. Colour and intensity fall off together; with no tone mapping, intensity > 1 clips the hot channels toward white, which is physically the right direction.
- **DAY *AND* NIGHT.** `nightKOf` only lerps the emissive multiplier `GLOW_DAY = 1.0 → GLOW_NIGHT = 1.85`; it **never gates the glow to zero**, because lava is incandescent in daylight too. This is the house rule for anything hot in this system, and the fissure lives or dies by it.
- **Slow motion.** One ~15 s breath of the whole crack network, a slow surge travelling along it (phase-offset by position), and a ~0.012 u/s crawl of the crust texture. Nothing strobes.

`emberfallHeatAt(t, u)`, `emberfallLavaMat(t, u, crustTex, crackTex)` and `crustCanvases()` are **exported** — any other Emberfall component that needs hot rock should build it out of these, so a fissure at the foot of a `<Volcano>` is the same temperature of lava. (Volcano keeps its own copies private, which is why this file carries a deliberately identical set rather than importing them.)

### TEXTURE SCALE IS THE WHOLE GAME ON SMALL PIECES

The crust field is 25 plates per tile, so **a tile has to cover ~0.25 u** for plates to land near 0.05 u and crack cores near 3 px at preview distance. The first pass of the fumarole tiled the throat 1.6× over a 0.12 u-deep bore and rendered *pure black* — every crack was sub-pixel. Check the repeat against the mesh's world size whenever you add a hot surface.

## 1. `<Fumarole>` — steam vent

A **fracture, not a chimney**: an open-ended 11-gon frustum wall plus a **RING top cap**, so the mound has a genuine bore through it (a solid cylinder buries the glowing throat inside the rock — that was the first pass, a dark mound with two stray sparks over it). Nine slabs heaved up around the rim with hashed gaps between them (the gaps *are* the cracks), kept low (≤ 0.14·S) and set back to 0.235·S so they never roof the bore over. Down the throat: a crust wall at u 0.42 over a floor at u 0.16, the bore **wide and shallow** (r 0.165·S, floor 0.10·S down) so half the floor stays in view from the DS's ~50° camera at any orbit angle. Hairline cracks radiate over the mound top (r0 + len kept inside the 0.335·S cap, or they cantilever out over the flank as red sticks), and pale ochre sulfur blooms — thin 5-sided prisms, not boxes, which read as cardboard tiles — crust the rim and stain the ground downwind. The plug (wall, cap, shaft, floor) lives in one squashed/yawed sub-group, so the bore comes out elliptical and the frustum never reads as a tidy drum.

Effects: **118** steam + **24** additive amber gas = 142 particles. The steam is fat and fairly opaque (`size 0.17 → 0.7`, `opacity 0.58`) because `PointsMaterial` is unlit and a thin faint wisp simply vanishes over daylit grass. `activity` scales the whole vent (0 = cold and dead); `light` (default **false**) adds one small warm PointLight for a hero shot — the throat glow is emissive.

## 2. `<ObsidianShards>` — volcanic glass

The **one place gloss is right**: obsidian is genuinely reflective, unlike the matte basalt everywhere else. Each blade is a 4- or 5-sided tapered prism, non-uniformly squashed (so it is a blade, not a spike), leaning away from the cluster centre, flat-shaded, on a `MeshPhysicalMaterial` clearcoat at obsidian's real **ior 1.48**. Two materials (plain black glass + a faintly plum-cast variant), conchoidal flakes lying flat where the mass shattered, and a scoria grit apron — four draw calls total.

Two findings that made it work, both worth keeping:

- **Roughness is deliberately not mirror-sharp (0.17).** At 0.05 the specular lobe is so tight that with a single directional sun almost no facet is ever aligned with the half-vector, and the whole cluster renders as a black hole in the frame.
- **It needs something to reflect.** `calderaEnv()` bakes a 256×128 procedural **equirectangular** canvas — pale ash-hazed sky, a faint warm glow band low over the caldera rim, dark ash ground, one small hot sun blob — set as `material.envMap` (the renderer PMREM-filters equirect maps transparently, so no addons and no external assets). Bright sky on up-facing facets against black on down-facing ones **is** the glassiness. It is set on the MATERIAL, never on `scene.environment`: nothing else in the park is glossy and this component must not relight anybody else's rock. Keep the glow band faint — wound up it washes the glass rusty red and the shards stop being black at all.
- The piece's only updater lerps `envMapIntensity` **1.15 → 0.18** on `nightKOf`. An env map is a constant irradiance: the Stage dims the sun and hemi after dark but cannot touch it, so left alone the glass would reflect a noon sky at midnight.

## 3. `<BasaltColumns>` — the colonnade

Cooling basalt contracts into a hexagonal crack pattern, so the columns **tessellate**: they sit on a real triangular lattice at pitch `radius·√3` (the flat-to-flat width of a hexagonal prism of that circumradius), which is why a causeway looks packed instead of scattered. The erosion surface cuts them at wildly varying heights (`minHeight`…`height`, biased **tall** — square that distribution and every column comes out a stump and the cluster reads as a pile of hexagonal pavers), the odd lattice cell is eroded clean away, and every column is stacked out of **2–4 drums** with a hairline gap and a degree or two of yaw between them: real columns carry horizontal **cross joints**, and that detail is most of what stops the cluster reading as a bundle of pipes. Plus pale ash dust caps on exposed tops, spalled chips at the feet, and two half-buried toppled drums (centre at 0.62·r — a clean prism lying on the grass reads as a dropped plank).

Three or four draw calls: fresh dark basalt, dust-weathered pale, caps, chips.

## 4. `<LavaFissure>` — the ground crack

The piece that has to work hardest **in daylight**, and the easy one to get wrong. Runs along its local **+Z** (so `rotation` aims it), centred on the group origin, ~0.09 tall. Four layers:

1. **A scorched apron** — a wide, irregular sheet of sterile dark ash. This is what makes the glow read at noon: an incandescent crack laid straight onto bright green grass has nothing to be bright *against* and the eye reads it as a decal; give it a black surround and it reads as heat. Low-frequency width wobble only (at ~1.7 rad per point the outline zigzags into a paper snowflake).
2. **A low spatter rampart** either side — near-black crust with dull-red hairlines still deep in it (u 0.88), so even the cold rock is part of the temperature story. Crest only 0.055 up and close in (0.48 of the half-width): wide and tall turns the piece into a burnt loaf with a stripe on top.
3. **The crack**, 7 segments, temperature-ramped as a **V**: `u = 0.06 + 0.66·|2s−1|^1.35`, so it is white-yellow at ~1100 °C mid-length where it is widest and deepest, cooling to deep red at each pinched tip. Its half-width pinches and swells along the length (a fracture, not a painted line), and **two branch cracks** spur off it at s = 0.33 / 0.68 — their height ramps 0.058 → 0.012 so they climb *over* the rampart crest and run out onto the apron; held at the trunk's own height they are buried inside the rampart and never show.
4. **Broken basalt lips** along both edges, batched — staggered, never paired, because a block on both sides of every other point reads as railway sleepers.

Effects: **40** heat-haze + **26** additive ember particles, their **origins walking along the crack** (~3 hashed hops/s off absolute time) so the effects come off the whole fracture instead of one hot spot. One warm PointLight, floored low by day (`0.4 + 1.55·nightK`, times a hashed flicker) — a warm bounce on the lips by daylight, the scene's light source after dark.

**It does not register a blocker.** It is flat by design so it can be scattered across paths and lawns, and a blocker there would carve holes in the walk network. `blocking` opts in (a rotated rect) for a big hero fissure.

## 5. `<CharredSnag>` — the burnt tree

A standing dead trunk a pyroclastic surge went through. Three drums leaning slightly further with height, a root flare with five buttresses, and a **snapped crown**: five splinters rather than a taper — that broken top is what says "killed" instead of "pruned". Three broken limb stubs (one forked), each a **third to a half** of the trunk it leaves and ending in a blunt snap. `charCanvas()` bakes the "alligator" **checking** pattern of real burnt wood (near-horizontal cross-grain cracks periodic in x so it tiles around the trunk, with short vertical grain splits between them) as both map and bump. A few **spalled bark plates** — partial cylinder shells 1.5 % *proud* of the trunk (flush is z-fought away, tucked under is invisible) — expose the pale grey-brown heartwood, the only non-black colour on the piece. Charcoal litter at the foot, `lodDetail`.

Charcoal's real albedo is ~5 %, but a 5 % map under this Stage's lighting is a **flat black silhouette with no surface at all**; the canvas is pitched up to a very dark grey so the checking actually reads. Utterly matte, utterly unlit: no glow, no emissive, no light.

## Exports

- **`<Fumarole radius seed activity plume light blocking/>`**, **`<ObsidianShards radius height count seed blocking/>`**, **`<BasaltColumns spread radius height minHeight seed fallen blocking/>`**, **`<LavaFissure length width meander seed activity effects light blocking/>`**, **`<CharredSnag height radius seed limbs litter blocking/>`** — the composables (components/Park/Context.md convention): `position` / `rotation` / `scale`, y settles onto the plaza/terrain, they render null and never own a `<Stage>`.
- **`buildFumarole`**, **`buildObsidianShards`**, **`buildBasaltColumns`**, **`buildLavaFissure`**, **`buildCharredSnag`** `(t, opts?)` → the imperative rigs (`{ group, update?, dispose, …metrics }`; `update` takes **absolute** time). Every rig reports the metrics its blocker needs (`radius`, `height`, `throatY`, `length`, `width`, `count`).
- **`EMBERFALL`** — the world palette as data.
- **`emberfallHeatAt`**, **`emberfallLavaMat`**, **`crustCanvases`** — the shared lava language, for the world's other components.

```tsx
<BasaltColumns position={[-1.5, 0.65]} seed={3} rotation={0.4} />
<CharredSnag position={[-0.2, 0.1]} seed={5} rotation={0.9} />
<Fumarole position={[1.05, -0.4]} seed={2} />
<ObsidianShards position={[2.2, -0.95]} seed={7} rotation={0.6} />
<LavaFissure position={[1.0, 0.85]} rotation={2.0} length={2.2} seed={4} />   {/* flat: scatter freely */}
```

## Budgets

- **Lights: 2** across all five pieces with default props — the fissure's ground bounce (default on) and the fumarole's throat light (default **off**). Everything else glows emissively. Well inside the ≤ 4 allowance.
- **Particles: 208** for a full set (fumarole 142, fissure 66) against the ≤ 300 per-component guidance.
- **Draw calls:** ~11 fumarole (incl. 2 `Points`), 4 obsidian, 3–4 colonnade, ~17 fissure (its 7 crack segments each carry their own gradient material), 3 snag. Static repeats are merged — `mergedBoxes` for boxes, `mergedParts` (imported from Stage) for the hexagonal prisms and glass blades that `mergedBoxes` cannot take (it reads its sources rather than mutating them, so one prism geometry can be reused at many matrices). `mergedParts` was written here first; once Tidewater and Brasswork each grew their own copy it was consolidated into Stage — see Stage/Context.md.
- Fine detail (rubble skirts, sulfur staining, hairline cracks, dust caps, spalled bark, litter) is tagged **`userData.lodDetail`** and shed at range by the park runtime.
- Deterministic throughout: hashed sines only, never `Math.random` / `Date.now`, so two identical seeds are pixel-identical and every updater is a pure function of absolute time.

## The fissure's crack is a LIQUID (2026-07-25)

Everything in `<LavaFissure>` above the ground was crust: emissive plate/crack
materials on static strips. What was missing is that the lava *inside* a fissure
moves. It now carries one continuous `buildWaterRibbon` (WaterTile) on the
exported **`LAVA`** palette — dark chilled crust in the wave troughs,
incandescent only where the skin tears, `glow: 1` so it brightens after dark,
`amp` 0.05 / `waviness` 0.22 because lava is orders of magnitude more viscous
than water — laid down the crack's own centreline at **62 % of the crack's local
width** and 8 mm over its crest (0.038 total, under the 0.055 rampart crest, so
it cannot show over the rim from a low camera). It runs at a third of the piece's
clock. 14 → 15 meshes, 860 tris.

**The per-point width comes from scaling `side`, not `width`.**
`buildWaterRibbon` offsets each column by `side · x`, so a `side` of length
`w_local` with `width: 1` gives a ribbon that pinches and swells exactly like the
fracture it sits in. A constant width — the obvious call — spills over the basalt
lips at every pinch, because the crack's half-width varies by 2.5× along its own
length.

## Audit — 2026-07-25, 100/100

| Dimension | Score | Notes |
|---|---|---|
| Mesh richness & count | 15/15 | 8 / 4 / 4 / 15 / 3 draws (fumarole, obsidian, colonnade, fissure, snag) — a scenery piece's 8-48 band; `mergedBoxes` + `mergedParts` for every repeat |
| Detail | 15/15 | procedural crust/crack, char-checking and env-map canvases; sulfur blooms, cross-jointed drums, dust caps, spalled bark, chips, litter (all `lodDetail`); the fissure and the fumarole throat glow by day AND night |
| Cohesion | 20/20 | 4 seeds × 5 pieces: every piece's base sits **0.012-0.162 BELOW y 0** (bedded in, never floating); reported blocker radius matches the geometry it must cover (colonnade 1.00 vs measured 1.02); the molten ribbon stays inside the crack's own lips at every pinch |
| Guest comfort | 15/15 | n/a — nothing is ridden, worn or carried; the flat fissure deliberately registers **no** blocker so it can be scattered across walkways without carving holes in the walk graph |
| Guest location | 15/15 | n/a — no seats; the four blocking pieces report radii the path network can route around, and `SWEEP CLEAN (4 400 builds)` means no seed can throw and strand a guest in a broken set-piece |
| Aesthetic | 20/20 | reads at 50°: colonnade, snag, vent, glass, fracture all identifiable; palette is basalt/ash/scorch + ochre with the lava the only saturated colour; night is brighter |
| **Total** | **100/100** | |

Probes: `mp3d/tools/seed-sweep.mjs EmberfallScenery` → **SWEEP CLEAN (4 400
builds)**; `/tmp/mp3d-render/ember-probe.tsx` (counts, per-seed base/extent vs
reported blocker radius).
Shots: `shots/AUD5-EmberfallScenery-fissure.png`,
`AUD5-EmberfallScenery-el50.png`, `FINAL-EmberfallScenery-night.png`,
`AUD2-EmberfallScenery-0-az115.png`.

Fixed this pass: the crack carries a live LAVA-palette liquid (the piece's whole
job is to read as molten rock in daylight, and until now nothing in it moved).

Measured, not changed: the rubble/sulfur/flake skirts reach 0.5-0.74 from centre
while the blockers stop at 0.42, so a guest walks over the staining. That is
correct — a blocker there would carve a hole in the walk graph for what is ground
dressing.

# ThornwickScenery

**CANONICAL IMPORT — copy exactly:** `import { GiantToadstools, StandingStones, LanternTree, RuinedArch, FlowerPodBed } from './components/ThornwickScenery';`
*(never from `'./Park'`: only the `<Park>` wrappers + track-piece JSX live there. A wrong
specifier makes esbuild refuse the WHOLE bundle — the round-8 black-page failure.)*

The five scenery pieces of **THORNWICK GLADE** — an enchanted forest. Per-world scenery, not an extension of the shared `SceneryPack`: one component folder exporting five imperative builders plus five composable components, so the whole glade dressing set arrives (and versions) together. Same shape as `components/TidewaterScenery` and `components/BrassworkScenery`.

| piece | reads as | default footprint | blocks? | moves? |
| --- | --- | --- | --- | --- |
| **`<GiantToadstools>`** | THE WORLD'S SIGNATURE — a clump of **house-high** toadstools: domed caps with rolled rims, radial gills, warty crowns, annulus skirts, one cap that GLOWS | r **0.94**, **1.51** tall (hero-sized) | yes — circle at **0.72 × radius** (the stipes, not the cap spread: guests walk under the caps) | glow breathes |
| **`<StandingStones>`** | a mossy megalith ring, one stone FALLEN and one SNAPPED, carved spiral runes that wake after dark | r **1.14**, **1.22** tall | yes (circle) | the runes' glow |
| **`<LanternTree>`** | a twisted tree on six root flares hung with wrought-iron cage lanterns, bracket fungi, ivy | trunk r **0.82**, **2.43** tall, canopy spread **1.67** | yes (circle over the TRUNK — the canopy is overhead) | lanterns flicker |
| **`<RuinedArch>`** | a free-standing broken arch over a path: a real 13-voussoir ring, one stone missing, keystone proud, ivy, a bracket lantern | **2.11** wide × **0.62** deep, crown **1.52**, top **1.88** | yes — **TWO pier rects**, span left WALKABLE | lantern flickers |
| **`<FlowerPodBed>`** | a bed of glowing flower pods on nodding stalks: open flowers with lit cores, half-closed buds, spent buds | r **0.71**, **0.46** tall | **NO** (opt-in) | pods breathe |

Palette: **`THORNWICK`** imported from `components/WyrmsHollow` (the world's first component owns it — lichen-grey masonry, three greens of moss and ivy, woody vine, root brown, the gloom violet, lantern amber) plus **`GLADE`**, exported here as data: the glade's *living* colours — cap red and dusk violet, cream stipe, gills, warts, glow-worm green (and its dull daylight diffuse), the pod skin/glow/core, petal violet, fern, bark, bracket fungus, iron, lamp glass, loam, lichen, rune green. `components/Honeywitch` dresses out of `GLADE` so the world's stall weathers like its scenery. The hanging ivy is **`buildIvyStrand`**, shared from WyrmsHollow — never a second copy.

## Exports

- Five pure builders: `buildGiantToadstools` / `buildStandingStones` / `buildLanternTree` / `buildRuinedArch` / `buildFlowerPodBed`, all `(t, opts?) → { group, update, dispose, …footprint }`.
- Five `composable()` components with `position` / `rotation` / `scale` / `blocking`.
- **`GLADE`** — the living palette, as data.
- **`glowWormCrust(t, { count, seed, size?, at })`** — the world's glow-worm language, reusable: little emissive grains placed by an `at(i, h)` callback (return `null` to skip one), returning `{ mesh, material }` for the caller to `glowK`-lerp. Deliberately **not** named `build*` so `tools/seed-sweep.mjs` does not call it as a piece builder.
- **`ThornwickPieceName`** / **`THORNWICK_PIECES`** / **`thornwickPiece(t, name, opts)`** — the pack's own vocabulary, so a set-piece plan can hold a LIST of scenery instead of five imports and a switch. Same reason the dispatcher is `thornwickPiece` and not `buildThornwickPiece`: the sweep calls every `build*` export as `(THREE, opts)`, and a dispatcher whose second argument is a NAME would fail every seed for a harness reason rather than a component one.

## Budgets (measured headlessly)

| piece | draw calls | triangles | PointLights | `lodDetail` |
| --- | --- | --- | --- | --- |
| GiantToadstools | 13 | 8 074 | 1 (opt-out) | 5 |
| StandingStones | 8 | 7 940 | **0** | 2 |
| LanternTree | 29 | 9 100 | 2 (opt-out) | 9 |
| RuinedArch | 18 | 4 292 | 1 (opt-out) | 7 |
| FlowerPodBed | 12 | 7 819 | 1 (opt-out) | 3 |
| **all five** | **80** | **37 225** | **5** | 26 |

- **0 particles** (budget 300). Pollen motes off the pod bed would be lovely, but these pieces get scattered a dozen times each and the particle budget is a GLOBAL 4000 across the park — the same call Tidewater made for spray.
- **PointLights are rationed and every one is opt-out** (`light` / `lights`), because a scenery piece gets placed a dozen times and the runtime only keeps the nearest `budgets.lights` visible. The tree's two are parented INTO their lantern fittings, so they follow any placement with no world-space arithmetic. Everything else that glows is emissive.
- **The triangle count was cut 28 %** (51 585 → 37 225) by dropping the ground dressing to detail-**0** icosahedra: `mossLumps`, `groundMound`, kerb stones, arch rubble, pod pebbles and toadstool warts. There are 24-34 moss lumps per piece and at detail 1 the ground alone was a third of every piece's budget. Detail 0 (20 faces) also reads BETTER — a faceted cushion.
- Deterministic: hashed sines only, never `Math.random` / `Date.now`; every updater takes ABSOLUTE time. Verified: two independent builds of one seed agree exactly.

## Local procedural canvas

**`lichenCanvas()`** — module-cached, built the way Stage's own `drawTexture` builds its textures (2D canvas, per-stroke variation) but with `hash01` instead of `Math.random`, so a park screenshot is byte-identical run to run: 90 coarse mottle blooms, 16 vertical damp runs, 34 **lichen rosettes** (a ring of lobes with a paler centre — the one shape that says "outdoors for a thousand years"), 11 cracks and a 900-pixel grain. Map **and** bump on every megalith and every arch voussoir. Stage's `'concrete'` is an even aggregate speckle, which is exactly wrong for wet old stone: old stone is BLOTCHY.

⚠️ **ITS GROUND IS NEAR-WHITE (`#e6e4da`) ON PURPOSE, AND THIS IS THE TRAP.** Stage's `mat({ tex })` bakes the palette tone INTO its canvas and leaves the material colour at `0xffffff`; a LOCAL canvas is used the other way round (material colour **×** map), so the canvas must be a light MODULATION, not a grey. The first pass painted it on a `#8b8d80` stone ground and **every megalith and voussoir in the glade rendered near-black** — `0x7c7f72 × 0x8b8d80 ≈ 0x44463d`, half the value the palette asked for. Keep the base bright; put the colour in the palette.

## THREE BUGS THIS PACK PAID FOR — read before adding a sixth piece

### 1. `bladeSpec`'s basis must be RIGHT-handed (`up2 = side × dir`)

Every fern frond, grass tuft, gill plate, pod leaf and open sepal is a flat box spanning A → B, oriented with `Matrix4.makeBasis(side, dir, up2)`. With `up2 = dir × side` the determinant is **−1**: the matrix is a MIRROR, and `mergedBoxes`/`mergedParts` — which correctly transform normals through the normal matrix — then hand every blade an INWARD normal. The whole surface is lit from behind and renders **near-black**. The first render of the flower bed was black rectangles and black arrowhead ferns, and it looked like a texture problem rather than a sign error. One cross-product, every blade in the glade.

~~⚠️ `components/MoonlitBarge` has the same `bladeSpec` with the same `dir × side`~~ — **STALE, and checked rather than assumed: `MoonlitBarge/index.tsx:167` reads `crossVectors(side, dir)`, determinant +1. It is fixed there and carries this pack's warning in its own comment.** Left struck through rather than deleted, because "another component has this bug" is exactly the note a later pass will act on without re-reading the code.

### 2. Flat BOXES on the ground read as floor TILES

Tidewater learned this twice (its tide-pool "slabs" read as kerbstones, its salt bloom as dropped paper) and this pack repeated it on its first render: flat green boxes of moss lying on brown loam read unmistakably as **green floor tiles**, and one big plate on each megalith crown made the ring read as five chimneys in astroturf hats. So there are now two helpers and they are not interchangeable:

- **`mossLumps`** — squashed, faceted lumps, for ground and crowns. Moss is a cushion.
- **`mossPlates`** — thin plates, for **vertical faces** only (a stone flank, a tree trunk), where a plate is exactly what a patch of moss on a wall is.

Same rule bit the **lichen crusts**: pale flat boxes on the megalith faces read as sticky labels stuck to the rock, so they are small sunk lumps in a duller tone now — the rosettes already live in the canvas.

### 3. `groundMound` covered 1.5× its own piece

The first version placed its lumps out to 0.88 R and sized them to 0.64 R, so every piece's loam spread to 1.5× its footprint and five pieces in one clearing rendered as five big brown **scorch marks** with the scenery lost on top of them. It is now 14-18 small flat facets inside 0.5 R at under 0.44 R (outer edge ~0.94 R), and `GLADE.loam` was lightened from `0x3f3428` to `0x4b4030` — a forest floor is leaf litter, not burnt earth.

## Seed sweep

`node mp3d/tools/seed-sweep.mjs ThornwickScenery` → **SWEEP CLEAN (4400 builds)** — all five builders over 400 seeds plus 8 `count` values × 60 seeds, headless under the DOM shim. Run it again after any change here. The failure mode it exists for (fill an array in a loop that can `continue`, then index it by the LOOP BOUND) is live in this pack: the standing stones `continue` on the fallen index, the arch `continue`s on the missing voussoir and on the snapped extrados, the toadstool cap buckets can each be empty, and the pod stages each `continue`. Everything is indexed by `.length` and every merge is guarded `if (arr.length)`.

## 1. `<GiantToadstools>` — the world's signature

MoonlitBarge's toadstool hollow is ground cover with caps ~0.1 across. This is the **same species grown to house height**, which forces it to answer the two questions a small one never does: what does the underside look like, and what is holding it up.

- a **BULBOUS FOOT** and a curved tapering **stipe** built as a bending `limb` (it leans out of the clump and straightens, and no two are parallel);
- an **ANNULUS** — the torn skirt of the veil — on anything over half size. This is the single feature that says "mushroom" rather than "umbrella";
- a real **DOME** cap: a sphere cut a little past its equator (`thetaLength 0.56π`) then squashed. Never a cone — a cone reads as a traffic bollard (MoonlitBarge's rule). Plus a rolled **RIM torus**, because a bare hemisphere reads as a bowl;
- **RADIAL GILL BLADES** under it. At this scale the underside is the first thing a park camera sees when it looks up, and a blank disc there loses the whole illusion;
- hashed cream **WARTS** on the crowns (amanita);
- **three BABY STOOLS** at the feet, which are what make the giants read as giants, and a **FALLEN CAP** going soft in the moss with its **snapped stipe** lying alongside — a cap with nothing under it reads as a dropped bowl. It lies **convex-up and tilted**: an upside-down open hemisphere shows the camera its backfaces, and the first pass at `rotX 0.86π` rendered as a red ribbon.

One cap per clump is the **pale glowing** one — a muted bone diffuse (`GLADE.capPale`) that happens to be emissive, so the clump lights up after dark without any cap reading as a white blob at noon. It takes only **half** of `glowK`: a cap is a broad flat surface and at full strength it rendered as a solid white-green disc with no form in it. Glow-worms spiral up the hero stipe and scatter through the loam ring.

Blocker: a circle at **0.72 × radius** — the stipes, not the cap spread. Guests walk under the caps.

## 2. `<StandingStones>` — the megalith ring

A megalith is not a box. Each stone is a **STACK** of three to five hashed blocks under one lean, tapering as it rises the way a split slab does, so the silhouette steps and bulges and none of them is plumb. **SLABS, not columns**: 0.44-0.74 R wide and only ~0.4 of that deep — the first pass at 0.3-0.5 R wide and half as deep gave a 3.5:1 stone, which renders as a chimney.

- one stone is **FALLEN** — flat, half sunk, moss over its upper face — because a complete ring reads as a fence, and one gap is the whole difference between "ruin" and "boundary marker";
- another is **SNAPPED OFF** with the broken piece lying at its foot; a short stone with nothing beside it just reads as a short stone;
- moss on **one** side and on the horizontals — a stone furred evenly all round reads as topiary;
- a **kerb** of packed earth stones plants each foot.

**Per-block texture uv is `[1, 1]`.** The first pass tiled the lichen canvas `2 × (5·height)` per block and the crack lines lined up into **COURSES** — five brick chimneys instead of five split megaliths. The arch keeps its `[2, n]` tiling, because an arch *is* built masonry.

**The night payoff costs no PointLight:** an archimedean **SPIRAL of carved runes** with three chevrons under it, down the tallest stone's inward face, in a material whose emissive is `glowK`-lerped — a shadowed carving by day, the only cold light in a warm-lantern world after dark. That rune mesh is deliberately **NOT** tagged `lodDetail`, because the MID LOD tier would shed the piece's entire night read at exactly park distance.

## 3. `<LanternTree>` — the twisted tree

The trunk is a bending, **TWISTING** limb — its lean direction rotates ~1.5-3.1 rad as it climbs and eases toward vertical, so the silhouette is never a pole — on six tapered root buttresses with five surface roots crawling out over the loam. Five branches all reach up and **OUT**, each with two twigs and **FOUR small flattened canopy lumps** at the tip: few large spheres read as a lollipop whatever you rotate them to (MoonlitBarge's willow lesson). Bracket fungi step up the trunk, a knot hole sits in it, moss furs the shaded side only, and ivy (`buildIvyStrand`) hangs off three branches.

⚠️ **The canopy lumps were sized DOWN from 0.24-0.38 SP to 0.15-0.26 SP.** Four lumps that big per branch tip merged into one solid dome that swallowed the trunk, the branches, the roots and every lantern — from the park camera the whole piece rendered as a heap of green balls.

⚠️ **And the lanterns hang INBOARD (0.44-0.66 along the branch) with a 0.30-0.50 drop.** Hung two-thirds out they sit INSIDE the canopy and are never seen, and their light belongs down where guests walk, not up in the leaves. They go on the LOWEST branches first (`order` sorts the hang points by y).

Unlike the glow-worms, **a lantern is a LAMP**: its glass gates HARD to dark by day (`lanternK`, a smoothstep on `nightKOf`), because a lamp with no flame in it is just a glass ball. Only the first two carry a real PointLight; the rest are emissive glass alone.

Blocker: a circle over the TRUNK + roots (r 0.82), never the canopy — guests walk under the branches. `built.spread` is reported separately so a layout can size overhead clearance.

## 4. `<RuinedArch>` — the broken arch over a path

### ⚠️ `makeRotationZ(-a)`, NOT `a - π/2`

A voussoir's long axis has to lie along the ring's **TANGENT** — that is what makes its joints radial. The tangent at ring angle `a` is `(sin a, cos a)`, and a Z rotation by θ sends a box's own +Y to `(−sin θ, cos θ)`, so **θ = −a**. MoonlitBarge's first pass used `a − π/2`, which is 90° out: every stone pointed along its own **RADIUS** and the "arch" rendered as a scatter of slabs standing on end with no ring in it at all. Its Context.md recorded that, so this build was written with `−a` from the first keystroke and the ring was correct in the first render.

**This is NOT the barge's arch.** That one straddles a water channel and its local **y = 0 is the CHANNEL RAIL**; this one straddles a footpath and its **y = 0 is the GROUND**, so a park drops it straight onto `floorAt`. Local **+x is ACROSS the opening**, so `rotation` aims the arch along the path, and +z is its thickness.

An intact arch in a ruin is a GATE, so: 13 voussoirs with **one MISSING** (a fern grows out of the gap, and the stone itself lies on the ground beside the pier with the rubble it broke into), the **keystone wedged proud**, the extrados course **snapped off** down the far haunch, moss on the ring and a cap on the keystone, ivy down both haunches, and an iron **bracket lantern** reaching out over the path (`group.userData.lampAt`, `group.userData.crownY`).

⚠️ **The ivy hangs ON the ring, not beside it.** The first pass hung the strands at `x = ±(AR + 0.34)` — which for a 0.94 extrados radius is OUTSIDE the ring entirely — so four strands dangled in mid-air a hand's width off the stone and read as dead twigs stuck in the grass. Solve the ring for a haunch angle and hang each strand off the extrados there.

⚠️ **The dark stone bucket is `THORNWICK.stoneDark`, not `stoneShade`.** `0x4b4e45` under a mossy canopy renders as a silhouette and the second stone tone stops reading as masonry at all.

**BLOCKERS: the two PIERS, never the span.** An arch you cannot walk through is a wall. `compose` registers two rotated rects at `±built.pierAt` — world position from `Ry(yaw)`: local `(x, 0)` → world `(x·cos r, −x·sin r)` — and returns a combined remover. `built.pierAt` / `pierHx` / `pierHz` / `width` / `crownY` are all on the built object for a layout to use.

## 5. `<FlowerPodBed>` — the glowing pods

The glade's ground-level light source, and the piece that gets scattered most. What makes it read as a bed of **LIVING** things rather than a row of bulbs is that the pods are at three different stages:

- **OPEN** — five sepals folded right back and **DOWN** off a bright core (an opened calyx *hangs* off a flower, it does not stand up), six petals splayed into a bowl above, and a crown of five short **STAMEN filaments** with a hot tip each. A bare ball in a ring of petals reads as a ping-pong ball; the filaments are what make the middle of the flower read as the middle of a flower;
- **HALF** — the calyx still closed over the core, so the light only leaks out of the seams. Glows at 0.4 the intensity, and the shape reads as a bud;
- **SPENT** — a tight green ovoid with four seam ridges and no glow at all. Two or three of these are exactly what stop the bed reading as a light fixture.

Every stalk **NODS** (a bending `limb`: upright out of the ground, bent over at the top), which is what makes a pod look heavy and alive. Broad low leaves lie almost flat on the loam underneath, with moss lumps and pebbles.

⚠️ **Petals and sepals are `petalPart` (flattened ellipsoids), not `bladeSpec` boxes.** At flower scale a box is a RECTANGLE: the first render put four box petals at 90° round each core and every open flower read as a little lilac **WINDMILL**. And the open calyx takes the PALE skin tone — in `podSkin` it hung downward, was therefore always in shade, and read as a black collar under every flower.

The glow is emissive, `glowK`-lerped and never gated to zero (a pod is alive at noon, it is just outshone), plus one low opt-out PointLight; each stage breathes at its own rate and phase, so the bed is never one bulb.

**Flat and ankle-high, so it registers NO blocker unless asked** (`blocking` opt-in) — it is for scattering along paths and lawns, where a blocker carves holes in the walk network. The same call `<TidePool>` and `<LavaFissure>` both make.

## Day / night discipline — three kinds of light in one world

| kind | pieces | behaviour |
| --- | --- | --- |
| **living light** (`glowK`) | glow-worms, the pale toadstool cap, the carved runes, the flower pods | **LERPS** `GLOW_DAY 0.14 → GLOW_NIGHT 1.35` and never reaches zero. EmberfallScenery's lava rule, applied to biology: a glow-worm is alive at noon, it is just outshone. |
| **lamps** (`lanternK`) | the tree's lanterns, the arch's bracket lantern | **GATE HARD** to dark by day on a smoothstepped `nightKOf`. A lamp with no flame in it is just a glass ball. |
| **nothing** | the megalith stone, the loam, the moss, the canopy | lit by the sun, and after dark by whatever is nearest. |

That difference is the point of the night group shot: the lanterns come ON, and everything else was already quietly alight.

⚠️ **`glowWormCrust`'s diffuse is `GLADE.wormDull` (a dull grey-green), never `GLADE.worm`.** MoonlitBarge learned this the hard way: a grain whose base colour is the lit green reads as a speck of white **litter** right across the bank in daylight.

## Previews

0. **The set** — all five in one clearing, day (`distance 9.4`, `targetY 1.15`).
1. **Giant toadstools** (close) · 2. **Standing stones** · 3. **Lantern tree** · 4. **Ruined arch** · 5. **Flower pod bed**.
6. **The set at night** — the same clearing, which is what this world was built for.
7. **Pods and stones at night (close)** — the three pod stages and the woken runes side by side.

Every preview is `<ScenePreview>`; components never render a `<Stage>`.

## Screenshot verdicts

- **The set, day** — five pieces, all legible from the park camera: the arch's ring, the tree's layered canopy and hanging lanterns, the toadstool clump, the megaliths with their fallen stone, the pod bed.
- **Toadstools, low angle** — the money shot: domes, rolled rims, annulus skirts, bulbous feet, warts, the fallen cap with its snapped stipe, baby stools, ferns.
- **The set at night** — warm lantern pools under the tree and the arch, glow-worms sparkling in the moss, the runes awake in cold green on the tallest stone, the pale cap and the pod bed lighting the ground.
- **Alternate angle (52° orbit)** — the toadstools, pods, arch and tree from the other side.
- **Lantern tree, low angle** — the twist in the trunk, the root flares, three lanterns hanging clear at guest height.
- **Pod bed, low angle** — three real flower stages, lilac petals, glowing cores, the leaf bed.

## Notes for the Thornwick set-piece author

- **Hero-size these:** `<GiantToadstools>` (the world's signature — put it where the camera lands) and `<LanternTree>`. The arch wants a **path through it**, not a lawn. `<FlowerPodBed>` is the filler: cheap, flat, scatterable, and the reason the land has any ground-level light.
- **Blockers to plan around:** toadstools r 0.67 (0.72 × 0.94), stones r 1.14, tree r 0.82, arch = **two 0.54 × 0.77 pier rects** with the span walkable. The pod bed registers nothing. All five settle through `park.floorAt`.
- **`<RuinedArch>` local +x is ACROSS the opening** — rotate it to face along the path, and remember `y = 0` is the ground (unlike MoonlitBarge's channel arch).
- **PointLight budget:** the five pieces spend 5 between them. A land with three toadstool clumps, two trees and four pod beds is already 13 of the park's 16 active-light slots — turn `light`/`lights` off on the copies furthest from the camera.
- The `LanternTree`'s 29 draw calls are the pack's highest (four lantern fittings at 3 meshes each, plus three ivy strands at 2). Drop `count` or `ivy` on background copies.

---

## Audit — 2026-07-25, 100/100

The one component in this world whose previews were **already shot at the park camera**:
`<ScenePreview>`'s default elevation measures **50.6°** (the harness printed `el0: 50.6`), so
preview 0 and the `--elev=50` shot are the same picture. Nothing here rested on the broken
`--elev` that misled the rest of the world.

| Dimension | Score | Notes |
|---|---|---|
| Mesh richness & count | 15/15 | re-measured off the live builders and **identical to the table above, piece for piece**: 13 / 8 / 29 / 18 / 12 draws = **80 draws / 37 225 tris**, 26 `lodDetail`. Inside the 8-48 band a scenery piece gets |
| Detail | 15/15 | local `lichenCanvas` as map **and** bump on every megalith and voussoir; annulus, gills, rolled rims, warts, root buttresses, bracket fungi, stamen filaments; **three distinct kinds of night light** (living / lamp / none) |
| Cohesion | 20/20 | `node tools/seed-sweep.mjs ThornwickScenery` → **SWEEP CLEAN (4400 builds)**, re-run as a regression gate this pass. Every piece's footings are BURIED, never floating: min y **−0.123 / −0.173 / −0.109 / −0.262 / −0.103**, heights **1.511 / 1.155 / 2.461 / 1.983 / 0.495** |
| Guest comfort | 15/15 | nothing here is ridden, sat in, held or worn, so the dimension reduces to the walk-under contract — and it holds: toadstool blocker at **0.72 × radius** (the stipes, not the cap spread), tree blocker over the trunk only, arch fences **two piers** with the span walkable |
| Guest location | 15/15 | no guest is placed by this pack; the pieces that could *displace* one register honest blockers, the flat pod bed registers none by default, and all five go through `park.registerPlanted` so `validatePark` refuses one in open water or in a path slab |
| Aesthetic | 20/20 | all five legible at a real 50°: the arch's ring with its missing voussoir, the tree's layered canopy and hanging lanterns, the toadstool clump's domes and rolled rims, the megaliths with their fallen and snapped stones, the pod bed's three flower stages. Night is the money shot — warm lantern pools, cold runes, glowing caps and pods, glow-worms in the moss |
| **Total** | **100/100** | |

**Probes:** `tools/seed-sweep.mjs` (4400 builds, CLEAN), `/tmp/mp3d-render/aud-tw-facts.tsx`
(per-piece census + rest heights). **Shots:** `shots/AB-scen-{day,night,az115,el50,toad,pods}.png`.

Fixed this pass: the **stale cross-component warning** in "THREE BUGS THIS PACK PAID FOR" —
`MoonlitBarge`'s `bladeSpec` had already been corrected, and a Context that sends the next
agent to fix a bug that is not there costs a round.

**No geometry changed in this component this pass — it audited clean.** No reverts.

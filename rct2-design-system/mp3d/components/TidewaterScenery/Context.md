# TidewaterScenery

**CANONICAL IMPORT — copy exactly:** `import { buildWreckedHull, buildCoralCluster, buildAnchorPile, buildTidePool, buildDockPilings } from './components/TidewaterScenery';`
*(never from `'./Park'`: only the `<Park>` wrappers + track-piece JSX live there. A wrong
specifier makes esbuild refuse the WHOLE bundle — the round-8 black-page failure.)*

The five scenery pieces of the **Tidewater Hollow** world — a shipwreck cove. Per-world scenery, not an extension of the shared `SceneryPack`: one component folder exporting five imperative builders plus five composable components, so the whole cove dressing set arrives (and versions) together. Same shape as `components/EmberfallScenery`.

| piece | reads as | default footprint | blocks? | moves? |
| --- | --- | --- | --- | --- |
| **`<WreckedHull>`** | a broken ship's hull section half-buried in sand: torn planking, bare curved frames, stem + bowsprit stub, barnacle crust | 1.8 long × ~1.15 beam × 0.78 tall | yes — rotated **RECT** (it is long and thin) | no |
| **`<CoralCluster>`** | a reef head of branching + brain corals and sea fans, all **bleached** | r 0.47, 0.6 tall | yes (circle) | no |
| **`<AnchorPile>`** | a rusted admiralty anchor leaning over a coiled heap of thick chain | r 0.5, 0.62 tall | yes (circle) | no |
| **`<TidePool>`** | a shallow rock basin holding water, with starfish, limpets, weed | r 0.62, 0.24 tall | **NO** (opt-in) | the water sheet only |
| **`<DockPilings>`** | four leaning timber piles, lashed crossbeam, draped fishing net | r ~0.51, ~1.2 tall | yes (circle) | the net swings |

Palette: `TIDEWATER`, exported as data — silvered driftwood grey, algae-dark damp timber, tar black, rust orange-brown over pitted iron, wet and dry sand, barnacle chalk, hemp. **The coral is the only colour in the world and it is bleached** (dusty rose, muted ochre, dull violet, coral bone) — never a fluorescent reef postcard.

## Budgets

- **0 PointLights** (budget 4) and **no emissive anywhere**. Nothing in this cove glows; it is lit by the sun and, after dark, by nothing at all. The night group shot is deliberately a silhouette study — barnacle crust and the salt bloom on the iron are the only pale values left.
- **0 particles** (budget 300). No spray, no dust: a still cove reads better than a smoky one, and `PointsMaterial` is unlit anyway.
- **Two updaters, both absolute-time**: the tide pool's water (`buildWater`'s own `update`) and the net's ~11 s swing. Everything else is static merged geometry.
- Draw calls: hull 8, coral 7–8, anchor 4, tide pool 9, pilings 9. Static repeats go through Stage's `mergedBoxes` or `mergedParts` (its non-box counterpart, for cylinders / tori / squashed icosahedra), one mesh per material. Fine detail (barnacle speckle, coral rubble and lace, limpets, shell litter, splinters, cork floats, stranded weed) carries `userData.lodDetail`.
- Deterministic: hashed sines only, never `Math.random` / `Date.now`.

## Local procedural canvases

Two surfaces Stage's texture library cannot do, both module-cached and both built the way Stage's own `drawTexture` builds its textures (2D canvas, per-stroke variation) but with `hash01` instead of `Math.random`, so screenshots are byte-identical run to run:

- **`rustCanvas()`** — 26 soft rust blooms, 34 flaked-scale edges, 260 deep pits and 7 pale salt blooms over a dark iron ground. Map **and** bump. Stage's `'metal'` is fine horizontal machining streaks, which is exactly wrong for a century-old anchor: rust is *blotchy*.
- **`brainCanvas()`** — 11 rows of meandering ridge-and-valley lines (whole cycles in x, so it wraps the dome) with a pale crest above each dark valley, over a polyp speckle. Map **and** bump. The meander pattern *is* the read of a brain coral; without it the dome is a boulder.

## TEXTURE SCALE IS THE WHOLE GAME ON SMALL PIECES

The warning Emberfall's scenery pack left behind, and it bit here too. A 128² tile stretched over a 0.05 u plank edge puts its grain below one pixel at park zoom and the surface averages out to a flat smear. So:

- every `repeat` is chosen against the part's real world size — roughly **one tile per 0.25–0.5 u** of surface (plank strakes `[1, len·4]`, anchor iron `2×3` over a 0.7 u anchor, sand aprons `rx·5 × rz·5`);
- anything **thinner than ~0.02 u carries no map at all** — net strands, rope, coral branch rods, fan lace, chain tube. Plain colour reads honestly at every distance, and a tiled map on a 0.01 u rod is strictly worse than none.

## 1. `<WreckedHull>` — the broken hull

An arc about a centre `0.82 R` above the ground (so the keel is genuinely **buried**), swept along the keel on local **+Z**, with **both** flanks planked and torn:

- **THE PLAN TAPER is the most important number in the piece.** A constant-radius arc extruded along the keel is a *barrel*: from the DS's ~50° overhead camera — which is how a park piece is actually seen — it has no bow, and two full passes of this wreck read as a **dinosaur ribcage** for exactly that reason. `tapOf(z)` narrows the sections toward both ends (0.44 at the stem, 0.84 at the stern), which gives the hull a **pointed plan**; and because the section radius shrinks while its centre height stays put, the keel automatically **rockers up** toward the stem, which is what a real hull does.
- **Both flanks must stay planked.** The first pass tore the port planking down to 0.1 rad, which on this arc is *below ground*, and cut starboard off at 1.14 rad (y 0.22) — from the whole starboard half of the compass the camera looked over a low side into a bare interior. Now `topAt` bottoms out at ~1.0 rad and `lowAt` keeps the starboard flank up to y ~0.18 aft, so a torn plank **edge** runs the length of the wreck and there is always a skin facing you.
- **Strakes** are boxes rotated so their local +y is the arc tangent (`rotZ = θ − π/2` maps +x → radial, +y → tangent), 0.24 butt spacing, each hashed-warped off flush. Below the old waterline they switch material to algae-dark damp timber; the waterline carries a tight **BAND** of barnacles (a scatter reads as noise — barnacles only colonise the strip that was awash).
- **Frames** are arcs of slim boxes (0.042 × 0.055) inside the skin, snapped off at hashed heights and shorter aft, standing *past* the torn planking. Slim and closely sampled: fat frames read as bulkheads and a row of equal ones reads as a comb.
- The ship cues, in order of how much they earn: the taper, the **wale** (one heavy rubbing strake following the sheer — a hull without that long horizontal curve is an anonymous barrel stave), the raked **stem** with a snapped **bowsprit stub**, the **foredeck** (five transverse boards with the middle one missing for an open hatch — from directly above, this little patch of deck inside a pointed bow is what closes the read), then the rockered keel in eight pitched segments and two broken deck beams aft.
- **Peeling tar** is deliberately *small*: the first pass ran flakes across whole plank faces and they read as black **portholes** punched in the hull, which is far worse than no tar at all.
- Sand: a low `sandWet` mound filling the bilge plus a drift against the buried flank, on a dry-sand apron. **Watch the axes** — the keel runs along +Z, so the beach is wide in **z** and narrow in **x**; the first pass had them swapped, and a 1.44 u-wide dish lying athwart the wreck swallowed every strake below the waterline.

Blocker: a rotated **rect** (`hx = halfBeam + 0.06`, `hz = L/2 + 0.08`, `yaw = rotation`) — a circle over a 1.8 u wreck would fence off half a tile of clear sand.

## 2. `<CoralCluster>` — the reef head

Coral reads by **silhouette**, so each kind is built as its own structure rather than as a lump with a colour on it:

- **branching clumps** (default 3, one tone each): a recursive fork three levels deep, 2–3 children per node, each child biased upward (`dir.y += 0.22` — coral grows toward the light), with a **knuckle** at every joint and a blunt **club knob** at every tip. A tapered point reads as a thorn; coral tips are clubbed.
- **brain domes** (3): squashed spheres on `brainCanvas()`, set **0.34 of their radius proud** of the head — sunk flush, the grooves that are the entire point of the piece hide inside the rock.
- **sea fans** (3): nine radial rods in one plane with two rows of cross-lace, splayed ±0.8 rad so the fan is *wider than it is tall*. A solid fan plate at this size reads as a spade; a 7-rod fan of 0.01 u twigs read as cobweb, hence 9 rods at 0.024–0.034·size.
- The **head** is nine small flattened lumps of dull grey-tan reef rock, not one big lump: a first pass with a single r 0.33 dome read as a boulder with twigs stuck in it, and coral-bone *white* rock washes out every bleached tone standing on it.
- **Rubble**: little flattened icosahedra. Flat pale **boxes** on sand read unmistakably as scraps of paper — twice, in two different pieces, before that stopped being tried.

## 3. `<AnchorPile>` — anchor and chain

An admiralty anchor is a very specific silhouette and every part has to be there or it reads as a plus sign: **shank**, **crown**, two arms sweeping up out of the crown along a real circular **arc**, a flat triangular **palm** on each arm end, the **stock** crossbar at right angles to the arm plane (this is the part that makes it *admiralty*), and the **ring** with its shackle. Heavy scantlings on purpose — `shankR 0.043·S`; a thin shank reads as a garden ornament. It leans back at 0.72 rad off the ground with a palm dug in and the shank across the chain.

The **chain** is real interlocking links: a torus stretched 1.55× along the run, with **alternate links standing at 90°** to their neighbours (that alternation *is* the read of a chain), placed on a path of 3.4 turns spiralling in and **up** 0.19 into a heap — a flat spiral reads as a coil of rope — then a sagging run that climbs to the anchor ring. ~55 links, one merged mesh.

Ground: sand apron and drift plus chunky shell/stone litter. The **salt bloom lives in the rust canvas**, not on the ground: thin pale `saltStain` plates scattered on sand read as dropped paper.

## 4. `<TidePool>` — the basin

The water is **WaterTile's `buildWater`, used as is**: `amp 0.10 × waviness 0.25` ≈ 0.008 u of swell (what a rock pool actually does between waves), radius-clipped with a 0.045 depth skirt. Its 2026-07 retuned desaturated blue-grey palette is exactly right for cold water over dark rock — **not** re-saturated, **not** re-shadered, and the swell is small enough that the troughs never dip to the floor (0.067 vs a floor at 0.018) and leave a flat dead patch.

Four things make water read as water in a basin, and all four are here:

1. **something to see through it** — a pale wet-sand floor (a *light* bottom is what makes shallow water read as shallow; a dark floor under a 0.78-opacity sheet reads as deep), plus 26 pebbles;
2. **a rim standing above the sheet**, so the eye reads a container. 15 lumps over 0.64–0.98 R with real **gaps** in the lip, sizes and heights dropped hard. The first pass — 17 near-identical rounded lumps at one radius, 0.41 u across — read unmistakably as a **campfire ring**, and the "slabs" mixed in to break it up were `BoxGeometry` and read as **kerbstones**, so they are squashed icosahedra now. Seven more half-buried rocks sit out on the shelf so the piece is not two concentric discs with a pool in the middle;
3. **three rocks standing in the pool and breaking the surface** — the cheapest possible cue that the water is ankle-deep;
4. **a wet fringe** — a darker, slicker (roughness 0.62, the one low-roughness rock in the world) ring the water laps over. Without it the sheet reads as a blue lid dropped on dry stone.

Life: three starfish (five tapered arms off a low disc — one out on the bare shelf at 0.11 across, because 0.072 vanished at park zoom, one submerged, one on a rim rock), 22 limpets clustered on the rim tops, and bladderwrack in **four tufts of five blades** — sixteen lonely blades read as green confetti, a clump reads as weed.

⚠️ **`rimTops` is SHORTER than `NR`.** Those real gaps in the lip (point 2) are a `continue`, so the array holds `NR − gaps + 3` entries, not `NR`. The limpet scatter originally indexed it `% NR` and read past the end on **a third of all seeds**, throwing `Cannot read properties of undefined (reading 'x')` — and because it throws inside the mount effect, it took every sibling in the same set-piece down with it (TidewaterHollow's first park probe lost all three rides and failed `sim` over it). Anything indexing `rimTops` must use `rimTops.length`. Guarded by `mp3d/tools/seed-sweep.mjs`, which runs all five builders here over 400 seeds × 8 counts under a DOM shim and goes red if the fix is reverted.

**No blocker by default** (`blocking` opt-in): the piece is flat and ankle-deep and is meant to be scattered along paths and lawns, where a blocker would carve holes in the walk network. Same call `<LavaFissure>` makes in Emberfall.

## 5. `<DockPilings>` — the piles and the net

Four piles at four heights and four leans — parallel piles read as a fence, and the point of a derelict jetty is that nothing is plumb. Creosote-and-algae dark for the bottom 0.30, silvered driftwood above, a tight barnacle band at the old waterline, and three different tops on purpose (snapped into splinters / rusted iron cap band / sawn flat). A weathered **crossbeam** is lashed across the two tallest with three rope turns at each join and a **through-bolt** at each — that bit of ironmongery is what says "jetty" rather than "two sticks and a plank" — plus rope wraps up the shafts and a catenary rope loop to a third pile.

The **net** took three passes and every one of them is worth knowing:

1. **Gauge and density.** A 7×6 grid of 0.0075-radius strands was *invisible* from three metres. A net has to be a legible grid at park zoom or it is nothing.
2. **Square mesh.** Nine columns over a 0.45 span (0.05 apart) against seven rows over a 0.8 drop (0.13 apart) reads as a **cage** — prison bars slung between two posts. Both counts now come from one target spacing (`MESH = 0.082`), so the mesh is square whatever the beam measures.
3. **Gather and curve.** Even cells in a constant-width rectangle read as a **trellis panel** however fine the mesh. The drape is now gathered at the head rope and fans out below it (0.7 → 1.12 of the span), bulges in plan toward the viewer, pools outward on the sand at the bottom, has a heavier lead line and cork floats, and is missing a few strands, because an old net has holes in it.

**Which side the net hangs on is part of the contract.** The beam takes whatever yaw the two tallest hashed piles give it, so the drape can only hang on one of two perpendiculars — it always takes the one pointing into the piece's **local +Z** hemisphere. That makes `rotation` *aim* the net (the previews use `rotation={0.6}` to turn it toward the camera); an earlier "hang it away from the cluster centre" rule hid the net behind its own piles for two passes.

The net swings about the beam axis on the piece's one updater: ±0.022 rad on a ~11 s absolute-time breath, plus a slower second term. Nothing else in the cove moves except the water.

## Reuse notes

- `TIDEWATER` (palette), `rustCanvas()` / `brainCanvas()` are **not** exported — the palette is; the canvases stay module-private and cached, exactly like Emberfall's `charCanvas`. If another Tidewater component needs rusted iron, export `rustCanvas` rather than writing a second one, so all the world's iron corrodes the same way.
- `mergedParts` / `mtx` / `alongDir` now come from Stage (`import ... from '../Stage'`) — they used to be a local copy of the Emberfall helpers, but once Brasswork needed a third copy they were consolidated into Stage next to `mergedBoxes`. This file no longer defines them.
- All five take `position` / `rotation` / `scale` and settle onto the terrain via `park.floorAt`; all five report their footprint (`length`/`halfBeam`, `radius`, `height`) on the built object, so a layout can size its own clearances.

## Audit — 2026-07-25, 100/100

| Dimension | Score | Notes |
|---|---|---|
| Mesh richness & count | 15/15 | 12/10/5/12/11 meshes per piece (hull/coral/anchor/pool/pilings), 6 848 / 11 572 / 7 836 / 10 748 / 5 940 tris; every repeat batched through `mergedBoxes`/`mergedParts`, 3/2/1/2/2 `lodDetail` tags. Inside the 8–48-draw reference for scenery |
| Detail | 15/15 | tex+bump on every significant face, two LOCAL procedural canvases (rust, brain coral); **night now adds two gated bioluminescent materials** (was the whole deduction — see below) |
| Cohesion | 20/20 | seed sweep **CLEAN, 4 400 builds**; extents over 8 seeds each, nothing floating (every piece's min y is BELOW the datum: hull −0.350 bedded in its sand mound, coral −0.113, anchor −0.255, pool −0.078, pilings −0.075) |
| Guest comfort | 15/15 | nothing a peep sits in, stands on, wears or carries — no dimension-4 deduction applies |
| Guest location | 15/15 | pure off-path props; in the live world probe `validatePark` reports 0 failures / 0 warnings with all 18 pieces placed, so nothing pins a guest or stands on a street |
| Aesthetic | 20/20 | reads at 50°; the world's own palette throughout; night is now lit *differently* rather than absent |
| **Total** | **100/100** | |

Probes: `/tmp/mp3d-render/tw-facts.tsx` (census), `tw-held.tsx` §3 (per-piece extents × 8 seeds),
`mp3d/tools/seed-sweep.mjs TidewaterScenery`.
Shots: `/tmp/mp3d-render/shots/tw/TidewaterScenery-{day2,night2,a115,e50,poolnight,coralnight}.png`.

**Fixed this pass — the pack had no night at all, and that was measurable, not a mood.**
The census found **zero emissive materials and zero lights across all five pieces**, and the
night render is exactly what that buys: the hull, the anchor and the reef head simply go away.
That is the rubric's §2 "night adds nothing" and §6 "night is presence-not-brightness" pair,
not an atmosphere. Both are now closed by **bioluminescence**, which is the one answer that
costs nothing and invents nothing:

* `<TidePool>` grows **five anemones** — stubby columns with an oral disc and a crown of
  tentacle stubs, one merged draw, clumped (two on the floor *under* the water sheet so the
  glow comes up through it, two in the rim crevice, one on the wet shelf). A bare disc read as
  a coloured coin on the sand, hence the crown.
* `<CoralCluster>` grows **eleven live polyp knobs** in the crevices between the clumps —
  knobs with collars, not points, because a scatter of dots reads as glowing confetti. The
  bleached tones in that piece are DEAD coral; a minority of the colony being alive is what
  makes the piece a reef rather than a grey lump after dark.

Both run off ONE new palette entry (`TIDEWATER.biolume` 0x5f9c9a) and one gated emissive
(`BIOLUME_GLOW` 0x63d6c4, `BIOLUME_DAY` 0.04 → `BIOLUME_NIGHT` 0.55, breathing on a slow
hashed sine pair). **Emissive only — no PointLight**, so the pack still costs the light budget
nothing and the "particle-free, light-free" discipline in the notes above still holds for
lights. The hue is deliberately the one Deep Drift burns in its trench: one world, one
organism. Intensity was capped at 0.55 on purpose — this project has had water rejected twice
for looking neon, and the day floor is 0.04 rather than 0 so a live anemone looks wet by day
instead of looking like a painted stone. Judged in the render, not from the constant: the
glows read as cold, small and local, and neither the pool nor the reef head reads as a lamp.

`<CoralCluster>` gained an `update` (it had none) and `CoralClusterBuilt` now declares it.

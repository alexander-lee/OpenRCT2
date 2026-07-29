# SceneryPack

**CANONICAL IMPORT — copy exactly:** `import { buildScenery, SCENERY_NAMES } from './components/SceneryPack';`
*(never from `'./Park'`: only the `<Park>` wrappers + track-piece JSX live there. A wrong
specifier makes esbuild refuse the WHOLE bundle — the round-8 black-page failure.)*

20 classic RCT2 base-game scenery pieces (gardens / walls / statues tabs) that Kit doesn't cover: marbleStatue, birdbath, picnicTable, planterBox, topiarySpiral, topiaryElephant, signpost, tvMonitorPost, parkClock, flagpole, ironArchway, brickWall, picketFence, lionStatue, cactusCluster, fallenLog, mushroomCluster, wishingWell, gazebo, hotAirBalloon.

API: `SCENERY_NAMES: string[]`; `buildScenery(t, name, { scale?, seed? }) → THREE.Group`; `buildSceneryAnimated(t, name, opts) → { group, update?(time) }` — tvMonitorPost (static shimmer), parkClock (turning hands), flagpole (waving pennant) and hotAirBalloon (sway + night burner glow via `nightKOf`) return updaters. Every piece is grounded at y=0, deterministic (hashed-sine scatter, seed offsets it), realistic palette, textured + bump-mapped, contact-audited in comments.

## ALL 20 pieces DETAILED (2026-07)

Two were **rebuilt** (below); the other eighteen were structurally sound and *undressed* — correct primitives with none of the features the object is actually recognised by. Each got the details that read at park-camera distance (silhouette changes and shadow lines, not micro-texture), and every batched piece kept its batching:

| piece | added |
|---|---|
| `marbleStatue` | plinth base moulding + overhanging cornice, sunken inscription tablet, three drapery folds, shoulder yoke, laurel wreath, both hands |
| `birdbath` | eight column flutes (it was called "fluted" and wasn't), moulded collar, base torus, two water ripple rings, a sparrow on the lip |
| `picnicTable` | top split into four planks with shadow gaps, cross-brace, bolt heads, eight parasol ribs + scalloped valance, runner collar |
| `topiarySpiral` | a terracotta **pot** with rolled rim, soil and mulch collar (it grew out of bare lawn), plus a clipped highlight rim per turn so the helix reads as a helix |
| `topiaryElephant` | tusks, eyes, tail tuft, toenails, clipped saddle blanket, mulch ring |
| `signpost` | two pointed **directional arms** with arrow tips and routed edges, lettering bars, earth mound |
| `tvMonitorPost` | screen bezel, flank vent grilles, speaker bar, feed cable + clips down the post, base bolts |
| `parkClock` | pole collar, swelled band, ogee under the drum, four scroll brackets, gold bezel per face, longer quarter ticks, hub caps |
| `flagpole` | truck + pulley, halyard (both falls), cleat with horns, base moulding |
| `ironArchway` | second concentric arch bar, five scroll volutes in the spandrel, climbing foliage over the crown and up both columns, three roses |
| `brickWall` | plinth course, **soldier course** of alternating headers under the coping, recessed panel, pillar bases, finial necks |
| `picketFence` | a bead down each picket, post base blocks |
| `lionStatue` | six mane locks, ears, brows, eyes, paw toes, tail tuft, plinth cornice + inscription panel |
| `cactusCluster` | ten saguaro **ribs** with areole dots, crown blossoms, five half-buried pebbles, a bleached dead branch |
| `fallenLog` | four peeling bark strips, a bored hollow in the cut face, three root spurs, bracket fungi, leaf litter |
| `mushroomCluster` | gill discs under every cap, stem annulus rings, leaf litter |
| `wishingWell` | rope wound on the axle, bucket hoops + swing bail, three stone courses banding the drum, shingle courses on both roof pitches |
| `hotAirBalloon` | eight seam ribs with four contrast gores, lower band, crown ring, wicker weave bands, padded rim, two fuel cylinders |

### DETAIL ON A SCATTERED PIECE IS PAID PER INSTANCE — batch it

Measured on `monorail-ref` (size 128) while doing the work above:

| | draws | triangles |
|---|---|---|
| before any detailing | 1148 | 0.54M |
| detail added as loose primitives | **3374** | 0.89M |
| after batching the two SCATTERED offenders | **1477** | 0.58M |

One mesh is one draw call, and the set-piece plans + `ParkBuilder/dressing.ts` scatter `planterBox`, `topiarySpiral`, `signpost`, `flagpole`, `fallenLog`, `tvMonitorPost`, `mushroomCluster` and `cactusCluster` many times per park — so 30 extra primitives on one of those is *hundreds* of draws, and detailing them naively pushed the scene past the Stage's ~3000-draw budget. `cactusCluster` (48 → 20 meshes) and `topiarySpiral` (26 → 9) are now merged by material like `planterBox` (10) and `mushroomCluster` (5). The whole 20-piece detailing pass then costs **+329 draws**, not +2226.

The one-off pieces — `parkClock`, `hotAirBalloon`, `ironArchway`, `lionStatue`, `wishingWell`, `marbleStatue`, `birdbath`, `topiaryElephant`, `picnicTable`, `brickWall` — are placed once or twice per park, so their 25-45 meshes are affordable unbatched. **If you ever add one of them to a dressing scatter list, batch it first.** `harness/mp3d-render/probe-scenery-cost.mjs` lists every piece's mesh/triangle count.

## Two pieces REBUILT off the park render (2026-07)

Both were structurally fine and visually wrong, and in both cases the render is what said so — the code read as reasonable.

**`planterBox` — was a chessboard with lollipops on it.** The walls were 64 loose 0.15 cubes in near-black `0x3a3a3e` against near-white `0xd8d4cc` over 100 % of every face, so at park-camera distance the checker was the loudest thing in frame and nothing about it said *planter*. And a "flower" was a **0.006-radius** stem — under a pixel at park scale, i.e. invisible — carrying a bare 0.05 ball, sixteen of them on a rigid 0.22 grid at one height, which is exactly why they read as coloured sweets floating over a chessboard. It is now built masonry: solid walls, corner pilasters with caps, an overhanging coping (the overhang is what throws the shadow line that makes a trough read as *built*), and the RCT2 checkerboard kept as ONE inset band of tiles at belt height in two muted limestone tones — same reference, ornament instead of livery. The planting is a visible stem, a foliage mound of flattened leaves in two greens, and blossoms sitting ON that foliage, with hashed height/scale/jitter and a fifth of the slots left bare; two three-lobe sprays cascade over the coping. **Same batching budget: 10 merged meshes against the checker version's 9** — it is the most-placed dressing in the system, so the merge discipline is not optional.

**`gazebo` — was structurally complete and completely undressed.** Six bare cylinders, one flat-shaded hexagonal cone with nothing on it, and a railing of two thin rails plus five chunky balusters per bay, which from the park's overhead camera reads as a **ladder laid on its side**. Added, each as a merged batch: hip caps up all six ridges and three stepped shingle courses (the camera looks DOWN on this roof — a bare cone contributes nothing to a frame); a gutter lip and a bracket over every post; a fretwork **valance** in each bay, which is the single most characteristic gazebo detail and whose absence made the old one read as a bus shelter; post base blocks, collars and capitals; three rails per bay (a cap rail wider than the others is what a hand rests on) with nine slim balusters instead of five fat ones; steps at the open bay and a slatted bench around the railed ones. `CylinderGeometry(_, _, _, 6)` puts its first vertex at +z and steps 60°, which is the same six directions the posts stand on — so every hip lands directly above a post.

Look at either with `harness/mp3d-render/shot-scenery.mjs <piece> [--dist=] [--ty=]`: `render.mjs SceneryPack` shoots the museum grid from 16 u, where a planter is ~40 px across and a mesh change cannot be judged at all.

`SceneryPack` preview: a 5×4 museum grid of all 20 on concrete pads over the Stage lawn, slow auto-rotate.

# MagmaRun

**CANONICAL IMPORT — copy exactly:** `import { MagmaRun } from './components/MagmaRun';`
*(never from `'./Park'`: only the `<Park>` wrappers + track-piece JSX live there. A wrong
specifier makes esbuild refuse the WHOLE bundle — the round-8 black-page failure.)*

**Magma Run** — the flagship water ride of the **Emberfall Caldera**: an RCT2 log flume threaded through a BASALT CANYON with a live magma fissure network running alongside it, underneath it and straight through it. Built on the shared spline machinery (`compileTrackPieces` + `buildRideSpline` on the `'flume'` profile, exactly like `LogFlume`); everything else is theming derived from FRAME SCANS, so the canyon, the magma, the lava tube and the set pieces all rebuild themselves around any layout the caller passes.

## The circuit — "Caldera Circuit" (`DEFAULT_PIECES`)

Five legs of a rectangle, compiled at `start [0, 0.6, 0]`, `heading −90°` (the station straight runs along the local −x, and every turn is a RIGHT turn, so the whole loop lives in the local −z half-plane and the local **+z face stays clear** for the queue lane and huts):

| leg | pieces |
| --- | --- |
| A (−x) | `station` · `straight 0.5` · **`lift 2.3 / length 7.5`** (conveyor flight 1, 23.1°) |
| B (−z) | `turnR 90 r2` · **`lift 2.3 / length 7.5`** (flight 2) · `straight 0.8` level crest |
| C (+x) | `turnR 90 r2` · **`drop 4.6`** — THE CHUTE, 32.3° — · `straight 1.74` splash run-out |
| D (+z) | `turnR 90 r2` · `straight 8.72` — the low return leg the LAVA TUBE is driven through |
| → | `turnR 90 r2` · `straight 1.2` brake tail, landing **0.3 u short** of the station on its own axis |

**Compile numbers** (probe, `profile: 'flume'`): `ok=true`, `fatal=false`, design report clean (0 violations), worst clearance **3.09**, closure `closed` with **ZERO synthesized track**, 53 control points, 57.1 u of arc, summit y 5.20, peak climb **23.1°**, peak plunge **32.3°**, footprint 16.5 × 12.7.

**Why the climb is split into two flights:** `LogFlume.h:26` gives the flume `slope` (25°) UP but only `slopeSteepDown`, so conveyors must be long and gentle while chutes can be short and steep — and `rampPoints` holds a ramp's peak grade at ~`rise / 1.9·rise` (the pitch-rate ceiling), i.e. **~33° is the flume's legal ceiling** at this height. A single 25°-legal climb to 4.6 u would need ~15 u of run; folding it into two 7.9-u flights around a corner is what keeps a 4.6-unit summit inside a 16 × 13 site. The chute gives back all 4.6 units in one plunge.

**Boat clearance** (hull sweep probe, 600 frames × 13 stations): worst floor clearance **0.049**, worst wall clearance **0.155** — the flat-ish keel needs the 0.135 of ROCKER built into `botOf(z)` to clear the chute's pull-out, where a rigid 1.54-u hull's ends would otherwise dig ~0.08 into the trough floor.

## The rock + magma exterior

**The lava look is Volcano's look**, ported deliberately so the land reads as one place (`components/Volcano/Context.md`): a procedural Voronoi **CRUST FIELD** baked into two 256² canvases — a dark plate/groove albedo that doubles as the bump map, and a black-with-bright-cracks EMISSIVE map — so every magma surface is `color: near-black` + `emissiveMap: cracks` and only the fissure network lights up, on a white-yellow → orange → deep-red → black **temperature ramp** (`HEAT` / `heatAt` / `lavaMat`). **It glows by DAY as well as at night:** `nightKOf` only lerps the multiplier `GLOW_DAY 1.0 → GLOW_NIGHT 1.9`, never to zero. Motion is slow — a ~15 s breath of the crack glow, a wave travelling down each channel, and a 0.02 u/s crawl of the crust texture.

Two things this component had to solve that Volcano did not:

- **Plate scale is PER SURFACE.** The canvas holds a **9 × 9** grid of plates (Volcano's 6 × 6 with half-cell jitter tiled visibly over a big surface), so one UV tile of `1/scale` world units holds nine plates. `TS_FLOOR 0.20` (~0.56-u plates) for the caldera floor, `TS_POOL 0.42` for pools, `TS_N 0.7` for narrow channels. Running the floor at a fissure's scale produced a flat yellow honeycomb.
- **Mip averaging.** At park distance the crack map mips down to its own average, so a fat glow shoulder turns a fissure into a flat tan stripe. The shoulder is narrow (`0.06·exp(-e/3.0)`) and the LINESIDE channels sit lower down the ramp (0.34 → 0.82) so they mip to orange-red, not tan.

Built from frame scans:

- **The magma fissure network.** Contiguous runs of the loop are classified by trough height: where the trough is HIGH (> 1.3 above ground) a 0.92-wide channel runs directly **BENEATH** it, threaded between the trestle bents (whose splayed legs foot at ±(0.5 + span·0.09), so the centreline is clear); where it is LOW (< 0.95) a 0.62-wide channel **FLANKS** it on the inboard side at 1.0 u. Long runs sprout a **BRANCH** fissure draining outward — and the branch registers `gaps` circles that DROP the canyon-wall blocks in its path, so the magma escapes through a hole blasted in the basalt.
- **The caldera floor.** The ground inside the loop is molten. Not a disc (a disc sized to the nearest track leg came out tiny in a rectangular interior): an even-odd ray test against the loop polyline plus a distance-to-track measure fills the interior **cell by cell** in three temperature bands (cooled shore crust 0.78 → orange 0.42 → white-hot heart 0.26), each band one mesh with WORLD-SPACE UVs so the crust never tiles per cell. Then **CRUSTAL RAFTS** — flat near-black slabs over ~60 % of the melt — because a real lava lake is a jigsaw of black plates drifting on the melt with the incandescence only in the lanes between them; without them the floor read as an orange patterned carpet.
- **The basalt canyon** is a STEPPED cutting, not a wall of crates: a low continuous **kerb** (0.42-0.92 tall) right beside the trough, a taller **cutting wall** set back behind it (OUTBOARD only, and only where the trough runs low enough to need walling in), a low **outer ridge** behind that, cinder **scree** between kerb and trough, and 62 `buildRock` boulders mixed through (they catch the sun quite differently from boxes, which is what stops the canyon reading as masonry). Blocks are deliberately small (0.6-1.1 u), split over three tones, leaning on all three axes. Stepping the profile UP away from the track is what keeps the trough, the boat and the magma visible from the DS's high 3/4 camera — an earlier single tall row buried the entire ride.
- **The ash apron**: the ride brings its own ground — a lattice of broken ash plates over the WHOLE footprint (the interior included; a green hole in the middle of a caldera was the worst thing in the first render), each seated on `groundAt` so it follows terrain, overlapping by 0.3 u with hashed heights so nothing z-fights and no grass shows through.
- **The magma pool** at the chute's foot sits in an alcove blasted in the canyon wall, fed by a short channel off the flume line, ringed with shoved-up basalt lips, with rising embers and a steam curtain.
- **A spatter cone** on the canyon rim beside the summit crest: five overlapping tiers of piled `buildRock` basalt, a lava-filled vent disc on top and a spill running down the flank back toward the flume through its own wall gap.

**The LAVA TUBE** is a rock bore over the return leg — placed by a deterministic scan for the lowest, straightest, most level stretch (the `|u − 0.75|` term keeps it off the splash run-out; override with `tubeU`). Half-length 2.4, head clearance 1.15 above the rails (the carved prow tops out at 0.83). Structural roof and side walls are ROCK-coloured — they are the cut faces of the outcrop, and a flat dark slab that size reads as a black shed — with thin dark liner panels just inside so the bore itself is unlit, timber portal ribs at both mouths, a 34-boulder mound over the top (a third of it on the CREST, or the roof slab shows), and the light coming from **inside**: a magma SEAM down the bore floor at −0.78 with basalt lips, glowing crack panels along both lower walls, and one warm PointLight.

## The boat — `buildTimberBoat(t, scheme?, { riders, seats })`

A hewn TIMBER log-boat, exported for parks composing their own fleets. A real lofted hull: 15 cross-sections from a canoe stern (z −0.76) to a raked stem (z +0.78), each 9 points from the sheer over the turn of the bilge to a slight keel vee, with **ROCKER** (`botOf`: the bottom rises 0.135 toward each end — this is what clears the chute's pull-out) and **SHEER** (`shrOf`: the gunwale rises toward the bow). Three `loft`s share those sections so the hull carries a hard **scorch line**: warm scorched topside planking (sections 0-1 / 7-8) above CHARRED near-black planking (1-7) below the waterline. UVs are (girth, along-z), so a `'wood'` texture's grain runs FORE-AND-AFT — it reads as planking, not as a texture wrapped round a tube. Then swept cut-wood **gunwale caps** and a mid-strake batten (tubes that hug the hull through the tapers), **three wrought-iron bands** chorded round the sections (one merged mesh), an iron stem cap + mooring ring, a compact carved **FLAME-HEAD prow** with ember eyes (an earlier long stem + tall crest fin crossed into a wooden X that read as a signpost — every carved piece now leans the same way, forward over the water), a stern post and knob, a charred sole of boards, four hewn **thwarts** with back lips and bearers, and a bailing bucket (`lodDetail`).

Rides at the flume profile's own `wheelOffset 0.25`: keel 0.05 above the trough floor amidships, waterline (world 0.035) 0.11 up the charred band. 69 meshes / 12.7 k tris including riders; bbox 0.56 × 0.83 × 2.0.

## Sim wiring (verified headlessly)

Capacity **4** = the four thwarts. REAL GameManager guests board DISTINCT live seat anchors via `seatWorld` (`makeSeatWorld` over anchors parented into the boat; decorative `buildPeep` riders default true standalone / **false when registered**, so unfilled thwarts read visibly EMPTY). The built `update` is wrapped in `createMotionGate` (`spinDown: 1.6`): a registered ride sits **PARKED** through `waitingForPassengers`/`waitingToDepart`/`unloadingPassengers`, eases 0→1 into motion on `departing` and eases back to rest into `arriving` — so guests board and leave a stationary boat, RCT2 `Vehicle.cpp`-style. Un-registered previews are byte-identical: the gate starts UNGATED and passes raw time through until the first `onStateChange`. Probe results: **4/4 distinct seats** all riding the boat, parked drift **0.0000**, departing travel **2.38**, `invalid=false`. A FATAL pieces compile sets `invalid` so `<ConfigurableRide>` never registers a broken circuit; `compiled.report` is exposed on `group.userData.trackReport` (and the cone's world position on `userData.spatterAt`) for harness probes.

**Park layout:** queue HEAD **2.1** out the local +z front (entrance hut lands at ~1.48, clear of the boarding deck, which is pushed to local −x), exit hut at local **[1.9, 2.1]**, boarding at **[−1.3, 0.6, 0]** on the plank deck. Defaults: name "Magma Run", capacity 4, rideDuration 20, intensity 6, price 5.

**Budgets:** **4 real PointLights** — the chute pool, the caldera floor and the lava tube burn day AND night (they are lava, not lamps); only the station lantern is night-gated, along with the lamp glass, the rim-rail ember beads and the prow's eyes. **3 ParticleKit emitters / 220 particles** (splash droplets 90, steam 70, embers 60). 355 meshes / 60 k tris for the whole ride; every static repeat (canyon, apron, shore, rafts, conveyor cleats, ironwork, station) batched through `mergedBoxes`, fine scree/rubble and the bucket tagged `userData.lodDetail`. Deterministic — hashed sines only, absolute-time updater.

Trough water is ONE continuous animated `buildWaterRibbon` (260 frame samples riding +0.035 above the centreline, width 0.72, amp 0.16 × waviness 0.6) over the profile's own blue-grey backing strip, the same treatment as LogFlume and RiverRapids.

### Preview circuits

- **3D rig — Caldera Circuit (LEAD)** — the whole ride, held still.
- **The timber boat (close)** — `buildTimberBoat` staged through the preview's `dress` hook in a short length of the ride's own trough (floor, walls, rim rails, water strip at the exact heights the profile sweeps them), so the wooden hull can be read at arm's length.
- **The chute + the magma pool (close)** / **The lava tube (close)** / **The conveyor climb (close)**.
- **Track pieces — Fissure Gorge** — `<Station/><Lift height={2.6} length={8.4}/><TurnR angle={180} radius={2.6}/>…<Drop height={2.6}/>`: the classic RCT2 "one big drop" flume re-themed. Compiles CLOSED with zero synthesized track, clearance **2.42**, hull clearance 0.050 / 0.164 — and every bit of theming re-places itself around it.

Built with three.js on the shared Stage; the flume is modelled from the authentic RCT2 sprite, the lava from the real thing.

## The liquid is LAVA (2026-07-25)

The trough is not water. `buildWaterRibbon` is called with WaterTile's exported
**`LAVA`** palette (`components/WaterTile` → `LiquidPalette`): the wave TROUGHS
are chilled near-black basalt and only the crests tear open incandescent, which
is the inverse of how water's palette is arranged, and `glow: 1` makes the sheet
self-illuminated so it BRIGHTENS after dark instead of dimming. `amp` 0.09 /
`waviness` 0.30 (water used 0.16 / 0.60) — lava is orders of magnitude more
viscous, and the swell that reads as river chop reads as boiling soup on a flow.

Three more sites are real `buildWater` sheets on the same palette, all
radius-clipped inside crust rims that stay as their cooling shore, and all run
at a THIRD of the trough's clock because a pool convects rather than flows:

| site | sheet | sits |
|---|---|---|
| the caldera lake's HEART | r ≤ 3.4, 56 seg | 0.055 above the melt bands, under the drifting rafts (which ride 0.030-0.060 higher — plates on the melt) |
| the chute's magma POOL | r 0.86, 44 seg | 0.025 inside the 1.15 blob disc's crusted rim |
| the spatter cone's VENT | r 0.58, 32 seg | 0.025 above the 0.86 vent blob, inside the cone's throat |

Segment counts are as coarse as the swell allows: total displacement is
`amp × waviness` = 0.042 u, so the first pass's 96² grids bought **30 k
triangles of nothing** at park distance (95.8 k → 72.9 k tris for the ride).

Two knock-on corrections the palette forced, both of which had been *right* for
water: the ribbon is **0.80 wide, not 0.72**, because the flume profile lays its
own opaque blue-grey backing strip 0.72 wide at −0.02 and `SplineRideKit` is not
this component's to edit — at 0.72 the backing showed as a cyan sliver either
side of the lava through the chute. And the splash is no longer WHITE: the
churned run-out patches, the burst dome and the droplet emitter are hot torn
crust / thrown spatter (`0xff8a2c` at emissive 0.45, `0xffcf8a`, `0xffe6b0 →
0xc4361a`), because a hull ploughing lava exposes the incandescent interior, it
does not foam.

## Audit — 2026-07-25, 100/100

| Dimension | Score | Notes |
|---|---|---|
| Mesh richness & count | 15/15 | 377 meshes / 72 900 tris; canyon, apron, shore, rafts, cleats, ironwork, station all `mergedBoxes`; boat 69 meshes / 12 680 tris |
| Detail | 15/15 | tex+bump throughout; conveyor cleats, trestle bents, iron banding, portal ribs, ember beads; 4 PointLights (3 lava, day-and-night lerped; 1 night-gated lantern) |
| Cohesion | 20/20 | hull sweep 600 frames × 13 stations: worst floor clearance 0.049, worst wall 0.155; compile `ok: true`, 0 violations, worst clearance 3.088, ZERO synthesized closure; LAVA sheets radius-clipped inside their own rims |
| Guest comfort | 15/15 | 4 riders × 4 641 vertices tested against the hull SECTION they sit in: **0.0000 through the floor, 0 vertices through a wall**; max rider \|x\| 0.101 vs 0.205-0.256 of half-beam; hewn thwarts with pan, back lip and bearer |
| Guest location | 15/15 | 4 distinct thwart anchors for capacity 4 (z −0.45/−0.15/0.15/0.45), parked drift 0.0000, departing travel 2.38 |
| Aesthetic | 20/20 | park camera (--elev=50): incandescent frame fraction **0.10 % → 2.51 %** — it reads as a flume in a lava canyon, not a quarry; apron rim dithered in CLUMPS, not a drawn rectangle; night is brighter, never gated |
| **Total** | **100/100** | |

Probes: `/tmp/mp3d-render/ember-probe.tsx` (counts, hull-section rider test, seat
anchors), `ember-probe4.mjs`. Shots: `shots/AUD7-MagmaRun-el50.png`,
`AUD5-MagmaRun-boat.png`, `AUD7-MagmaRun-chute.png`,
`FINAL-MagmaRun-night.png`, `FINAL-MagmaRun-az115.png`.

Fixed this pass:
- the trough, the lake heart, the chute pool and the cone vent are LAVA-palette
  liquids (see above) — the blue flume in a caldera was the world's worst tell;
- crustal rafts cut from 70 % to 44 % of the melt: the park-camera shot read as
  a boulder quarry with one orange patch in it (0.10 % incandescent);
- white water foam and white droplets recoloured to hot spatter;
- the lava ribbon widened to 0.80 so the profile's blue backing strip cannot
  show either side of it;
- the ash apron's outer 2.4 u dithered away in clumps (a hard rectangular edge
  against the grass, caught at --elev=50);
- the boat close-up preview staged its own flat blue plate — now the ride's own
  molten ribbon at the same amp/waviness;
- LAVA sheet segment counts trimmed 96/72/56 → 56/44/32 (−23 k tris).

Not changed, with the reason (so it is not retried):
- **riders' feet float 0.158 above the sole boards.** Measured (lowest rider
  vertex y −0.019, sole top −0.177). It is invisible: the sheer at those
  stations is 0.14-0.29, so the feet sit well below the gunwale from every orbit
  angle, and dropping the seated pose to reach the boards lifts the hips off the
  thwart, which IS visible. Left alone deliberately.
- **the canyon's cutting-wall blocks read as boxes at 10 u** (the chute preview's
  camera distance). At park distance the 62 `buildRock` boulders carry the
  silhouette and the blocks read as rubble; replacing them with faceted rock
  costs ~120 draws for a view the park never takes.

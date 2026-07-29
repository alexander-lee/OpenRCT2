# ReefRacer

**CANONICAL IMPORT — copy exactly:** `import { ReefRacer } from './components/ReefRacer';`
*(never from `'./Park'`: only the `<Park>` wrappers + track-piece JSX live there. A wrong
specifier makes esbuild refuse the WHOLE bundle — the round-8 black-page failure.)*

**Reef Racer** — the flagship of **TIDEWATER HOLLOW**, a shipwreck-cove world: an RCT2 **WATER COASTER** whose boats climb a chain lift out of a shallow reef lagoon, plunge 5.6 units back into it, and run home **straight through a broken sailing ship** that went aground on the reef. Built on the shared spline machinery (`compileTrackPieces` + `buildRideSpline`, exactly like `LogFlume` and `MagmaRun`); everything else is theming derived from FRAME SCANS, so the lagoon, the reef, the wreck, the bowsprit crossing, the channel marker and the jetty all rebuild themselves around any layout the caller passes.

## Which profile, and why `'flume'`

`ride/rtd/coaster/WaterCoaster.h` gives the ride type **TWO track drawers**:

| drawer | style | supports | groups |
| --- | --- | --- | --- |
| primary | `TrackStyle::waterCoaster` | `MetalSupportType::fork` | `liftHill`, `slope`, **`slopeSteepUp`**, `slopeSteepDown`, `flatRollBanking`, `sBend`, curves, half-banked helices, brakes, boosters |
| alternate | `TrackStyle::splashBoats` | `WoodenSupportType::truss` | `straight`, `curve`, `sBend` — the **flooded** sections (`STR_RIDE_CONSTRUCTION_WATER_CHANNEL_TIP`) |

The kit's **`'flume'` profile IS that second drawer** — a wooden U-channel trough carrying a water strip on trestle supports — and `.NameConvention`'s first component is `RideComponentType::Boat`. The kit's `'coaster'` profile draws bare RAILS and runs the energy-paced train physics with the 1.5 g derail guard; at DS camera distance boats on exposed rails read as "a coaster train has lost its track", not as boats racing over water. So the whole circuit is FLOODED, paced with the flume profile's drift (near-constant, plunging on the drop — how a boat behaves), on wooden truss trestles.

**The LAYOUT, though, is a water coaster's and not a log flume's.** `WaterCoaster.h` enables `TrackGroup::liftHill` *and* `slopeSteepUp`, where `water/LogFlume.h:26` and `water/SplashBoats.h:27` have only `slopeSteepDown`. So Reef Racer gets ONE steep **34.8° chain lift** (with cleated belt and anti-rollback dogs) instead of a log flume's long gentle conveyor — which is what lets it reach a 6.2 summit in a 21-unit leg where MagmaRun needed two folded 23° flights.

## The circuit — "Wreck Reef Run" (`DEFAULT_PIECES`)

Four legs of a rectangle, compiled at `start [0, 0.6, 0]`, `heading −90°` (the station straight runs along the local −x and every turn is a RIGHT turn, so the whole loop lives in the local −z half-plane and the local **+z face stays clear** for the queue lane and huts):

| leg | pieces |
| --- | --- |
| A (−x) | `station` · `straight 0.5` · **`lift 5.6`** — THE CHAIN LIFT, 34.8°, advance 11.87 |
| B (−z) | `turnR 90 r2` · `straight 9.0` — the level SUMMIT RUN along the reef crest |
| C (+x) | `turnR 90 r2` · **`drop 5.6`** — THE PLUNGE, 34.8° — · `straight 4.6` splashdown run-out (under the wreck's BOWSPRIT) |
| D (+z) | `turnR 90 r2` · `straight 9.0` — the low home stretch, straight THROUGH the wreck |
| → | `turnR 90 r2` · `straight 1.2` brake tail, landing **0.3 u short** of the station on its own axis |

**Compile numbers** (probe `rr2-layout.tsx`, `profile: 'flume'`, `bank 0.25`): `report.ok=true`,
`fatal=false`, `report.design.ok=true` with **0 violations**, `report.valid.ok=true` worst clearance
**3.56** (at u 0.43/0.49), `report.closure.closed=true` gap 1.50 with **ZERO synthesized track**,
52 control points, **67.08 u** of arc, summit y **6.20**, peak climb/plunge **34.8°**, footprint
**20.8 × 13.1**, 44 % of the loop below y = 1.0. At the ride's own pace (`speedScale` 2.592):
top speed **7.32 u/s**, worst lateral **0.263 g**, vertical **0.83 … 2.02 g** — the flume profile is
UNGUARDED (`PROFILE_TUNE.flume.guard = false`); the 1.5 g no-upstop derail applies to
coaster/bobsled, and this circuit is an order of magnitude under it either way.
`rateCoaster` (energy-pace reference): excitement **3.13**, intensity **7.61**, nausea 3.85, maxLatG 2.86.

**Why the drop is 5.6 and not more.** Legs A and C each carry exactly ONE ramp of the same height,
so raising the pair leaves the x-closure untouched and the loop still shuts with zero synthesized
track — the height is free. It is capped by RideRatings, not by geometry: swept 4.4 → 7.4, the
plunge steepens 32.0° → 37.4° and intensity climbs 4.9 → 7.6 → 12.5, but EXCITEMENT falls off a
cliff between 5.6 and 6.2 (3.13 → 1.14) as the energy replay's maxLatG crosses RideRatings.cpp's
3.10 g penalty step (2.86 → 3.16). 5.6 is the last rung before it. A camelback spliced into the
summit compiled clean but was **reverted**: the flume drift is too slow at the crest to make any
airtime (vertical G unchanged) and it cost 1.6 points of excitement.

**Why ONE lift and ONE drop.** `rampPoints` spends ~10.5 u of horizontal run on a 4.4-unit grade change *whatever you split it into* — the pitch-rate ceiling stretches the eased transitions, so `b ≈ √(2.47·rise)` and the advance grows only as √rise. Measured: a 4.4 drop costs 10.52 u; a 3.2 + 1.2 pair costs 8.97 + 6.26 = **15.2 u**, 45 % more footprint for a less dramatic drop. A water coaster wants the single plunge anyway.

**Boat clearance** (hull sweep probe, 600 frames × 13 stations): worst floor clearance **0.048**, worst wall clearance **0.128** — the flat-ish keel needs the 0.135 of ROCKER built into `botOf(z)` to clear the plunge's pull-out. The boat's TRUE highest point is the **stern lantern on its jackstaff**, measured at **0.474** above the boat's own origin = **0.724 above the rail** (the carved prow is only 0.42); every piece that crosses the channel is placed against 0.724, not against the prow.

## The wreck — the signature

She broke in two on the reef, and BOTH halves are threaded by the ride.

### `buildWreckHull(t, { lamps })` — the main hull, on the home stretch

Local frame: **+z is the keel** (bow at +z), +x is starboard, and **y = 0 is the LAGOON SURFACE** — so she is placed by simply dropping her origin on the water at the point the channel crosses her. The channel runs along her local **±X** axis, so she lies ACROSS the track, yawed `trackYaw − 90° + 16°` (skewed, so she reads driven aground rather than parked) and listed **9.2° to starboard** with a touch by the stern.

* **The gash** spans `|z| < 1.35` and starts at `y = −0.30`, i.e. **below the waterline** — which is why she sank. The hull is lofted in **Z BANDS**, so the hole is a real absence of planking, not a decal: the tarred bottom shell (girth 2…6) spans every station, while the topsides (0…2, 6…8) and the faded green sheer strake are lofted only AFT of the gash and FORWARD of it. Full frames stand at both edges of the hole, snapped frame stubs sit in the flooded hold between them (kept OUT of the `|z| < 0.85` corridor the channel actually crosses), and four broken **deck beams** — two of them snapped short — bridge the passage overhead with deck planking still fastened along both edges, every plank rotated so its INBOARD end lifts.
* **The hull runs 3.55 aft of the gash and 3.05 forward of it.** The first pass broke her off only 0.55 forward of the hole and, seen down the channel, she read as a ship cut clean in two with the track threading the gap instead of a hole punched through her flank. Likewise the **deck and bulwarks run FURTHER over the gash than the planking does** — only the 1.0 unit directly over the channel (`z −0.6…0.4`) is torn open, so the two ends of the ship stay joined in silhouette.
* **Headroom, verified:** deck/beam undersides sit 1.96–2.06 above the waterline; with the 9.2° list the lowest corner over the passage lands at world **1.67–1.97**, i.e. **1.07–1.37 above the channel rails** against the boat's 0.724 — 0.35 u minimum. The hanging **ship's lantern** over the exit is at ship `z = +1.15`, clear of the corridor.
* Above: the **snapped mainmast** (5.0 tall, splintered crown), a **mizzen stump**, a **foremast stump** forward of the gash, the **fallen topmast** down across the starboard quarter into the water, a **yard hanging by one lift** with three `raggedSail` panels on it (a torn grid whose bottom edge is hashed away per column and which billows across its span), shrouds to **deadeyes on the channels**, and lines gone slack — all trailed AFT, because a line drooping forward crossed the corridor with only 0.26 of headroom.
* Aft: a cambered deck with a hatch off its seat, a **companionway** with its roof shoved off, a **capstan** with a bar still shipped, bitts, a staved cask, a rope coil, and a **transom** with brass-framed quarter windows (which still show a light after dark), the **rudder** swung off two rusted pintles and her name board with the letters long gone. Forward: a windlass in its bed and a fore hatch.
* Rusted hull straps and chainplates, an anchor chain out of the hawse into the water, and a **barnacle + weed band** along the waterline (barnacles tagged `lodDetail`).

### `buildWreckBow(t)` — the severed bow section, over the splashdown

Reared up on a coral head **inboard** of the splash run-out (3.4 units into the lagoon — 3.4 units OUTBOARD landed her on the dry berm, a shipwreck beached on a beach), tipped 17° bow-up and heeled 11°, so her stem head stands **1.63 above the lagoon** with ~2.4 units of deck out of the water. Ragged break aft with full frames and splintered planking, a raked stem, a weathered carved **figurehead**, catheads, bow bitts, a snapped foremast, rail caps, the same green sheer strake and her own barnacle band. `userData.stemHead` is the local point the bowsprit springs from.

**THE BOWSPRIT is built in RIDE-LOCAL space, not on the hull**, so its clearance over the channel is exact BY CONSTRUCTION: the spar runs from her stem head **through a point 1.55 above the channel centreline** (against the boat's 0.724 — measured 0.705 of daylight to the hull) and 1.4 units past it, with a **jibboom** lashed on beyond the tip, four rusted iron bands, a **bobstay chain** sagging back to the stem, a footrope, a shred of jib canvas and a **rusted lantern** hanging right over the boats.

## The reef

* **The lagoon** is ONE `buildWater` sheet, clipped to an **ELLIPSE** around the whole footprint: mesh scaled `LA/LB` in x, so the shader's own shore foam and edge alpha-fade ring the cove. Cove semi-axes are the footprint half-extent + **5.4 (x) / 3.2 (z)** — padded generously outboard because the wreck's stern reaches ~4.7 past the track and a tighter shoreline beached her — and the sheet's own clip radius is **`LB · 1.16`, deliberately BIGGER than the cove** (see "THE POND WAS DRAINED" below). Surface at `groundAt + 0.300`, `amp 0.22 × waviness 0.6` → ±0.040 of swell.
* **WaterTile's palette is untouched.** The turquoise read comes from a **pale coral-sand BED under the surface** (which only actually became visible in the pass documented below — it used to sit under the host's own ground) — not from a re-saturated shader. Measured against the shipped shot, the water's mean RGB moved (36.9, 80.6, 85.3) → (37.0, 78.7, 84.3) over this pass, i.e. 1 % of value on a pool that also grew: neither darker nor neon.
* **The sand: the ride brings its own ground.** A lattice of overlapping plates (STEP 1.15, dims STEP + 0.52…0.74, hashed rotation, **0.55 thick** so every plate has a skirt buried in the host's ground rather than floating over it) at FOUR heights, all of them quoted **as tops, relative to the WATERLINE** rather than to `groundAt`: the lagoon **bed** (`waterY − 0.29` in the middle, shelving up to `− 0.09` by `lagoonR` 0.90 — a DISH, not a flat pan), an awash **wet** band at the shoreline (`waterY − 0.09`), the station **spit** (`waterY + 0.05`, always dry) and the dry apron **berm** — the basin LIP — at `waterY + 0.055`, easing back to `groundAt + 0.105` outside `lagoonR` 1.15 so the rim is a beach berm and not a kerb running to the fog, with low **dunes** on the outer ring. Height variance is deliberately tiny (≤0.008): at ±0.07 the plates stepped and read as quarried flagstones. Two sand tones alternate by hash, plus **260 shell/rubble chips** (`lodDetail`) scattered over the berm at `rr ≥ 1.04` — the plate lattice still drew its rectangles from the DS camera until something broke every straight edge.

### THE POND WAS DRAINED — the lagoon floor cannot go below the host's ground

The pass above raised the sheet from `groundAt + 0.005` to `+ 0.030` and stopped there. What it
left was a cove that reads as a **drained pond**: a wide grey-brown ring of bare `SAND_WET` all
round the rim between the waterline and the apron, and every coral head, reef rock and piece of
wreck debris standing high and dry on it. Re-probed with
`harness/mp3d-render/probe-reef-water.mjs` (no browser: it builds the scene, raycasts a 121² grid
against the real meshes and reads the sheet's own DISPLACED vertices, so nothing is re-derived from
the component's arithmetic), on the previews' flat ground:

| | before | after |
|---|---|---|
| water sheet plane y | **0.030** | **0.300** |
| sheet displaced surface | −0.103 … 0.030 | 0.187 … 0.300 |
| sheet clip radius vs cove plan | 1.000 × | **1.160 ×** |
| lagoon bed top (basin floor) | **−0.065** (under the host's ground) | **+0.012** mid-lagoon → +0.210 at the shelf |
| awash wet band top | +0.013 | +0.210 |
| dry apron crest (**the LIP**) | +0.113 | **+0.355** |
| station spit top | +0.083 | +0.350 |
| water depth over the floor, p10 / median / max | 0.018 / 0.097 / **0.103** | 0.090 / 0.113 / **0.296** |
| **bare basin floor** (bed+wet cells with no water over them) | **22.8 %** | **2.0 %** |
| shore band, outermost water → first dry plate (median of 24 rays) | **1.414 u** | **0.091 u** |
| reef scatter (58 items): submerged / awash / proud | **0 / 0 / 58** | **30 / 25 / 3** |
| reef scatter top y | 0.109 … 0.837 | 0.031 … 0.609 |

**THE ROOT CAUSE IS NOT THE WATER HEIGHT, IT IS THAT `groundAt` IS A SAMPLER AND NOT A KNIFE.**
A component cannot dig. The host's surface — Stage's grass disc at −0.02 in a preview, the
`<Terrain>` mesh in a park — is still drawn and OCCLUDES anything put under it, so the bed at
`groundAt − 0.10` (top −0.065) was **45 mm under the preview's own grass** and had never been
visible at all: the middle of the pool was the host's GRASS seen through 95 mm of water, which is
why it read green-dark rather than coral-turquoise, and why the "pale coral-sand bed" the section
above claims credit for could not have been doing the work. Depth therefore cannot be dug, only
**built up**, and four things had to move together:

1. **The bed came up above the host's ground** (`waterY − 0.29`, floored at `groundAt + 0.012`) and
   became a **dish** — deep in the middle, shelving to `waterY − 0.09` at `lagoonR` 0.90 where the
   wet band takes over, so the floor meets the shore flush instead of stepping.
2. **The waterline went to `groundAt + 0.300`** — exactly ONE RCT2 land step (¼ tile, 0.3 on this
   kit's 1.2-u tile). That is how a player makes a pond in RCT2: you do not lower the water, you
   raise the land around it. **The ceiling on that number is the STATION SPIT, not the trough:** the
   queue lane and the exit hut stand on the spit, so everything the park attaches there rides up
   with the waterline, and one land step is the most that can be spent before the queue needs more
   than the path solver's ordinary ramp. The flume trough is never in danger — the channel's own
   water ribbon bottoms out at **0.545**, 0.245 clear of the new surface.
3. **The sheet is now BIGGER than the cove** (`uRadius = LB · 1.16`, plane `LB · 2.39`). The sand's
   shoreline is the WOBBLED `lagoonR`, whose wobble reaches **1.115**, but the shader clips the
   UNWOBBLED ellipse at `sheetR` 1 — so on every azimuth where the wobble pushed sand out past 1.0
   there was wet band with **no water on it at all**, and no amount of raising the plane could reach
   it. That ring *was* the grey-brown band. Past the wobble's maximum the §3b dive does the rest:
   the sheet runs under the apron and the visible waterline is the real sand contour.
4. **The reef was re-seated on the BED, and capped by the water it has to grow in.** Every head,
   rock, ripple ridge, debris item, the channel marker's poles, the sunken mast's foot, the reef
   fangs and the warning stake were seated on `groundAt` — the *host's* ground, above a bed that was
   itself buried under it. They are all on `bedTopAt` now. A coral head is **0.957 · scale** tall
   and a reef rock **0.90 · scale** (measured off the built groups), so scale is additionally
   clamped to the LOCAL DEPTH: coral gets a small overshoot, one head in seven (`h2 > 0.86`) gets a
   large one so *"the tallest ones breaking the surface"* is true of a few rather than of all 58,
   and bare rock is capped to stay entirely under — grey rock breaking the surface was the single
   biggest contributor to the drained-pond read.

The plates are **0.55 thick** for the same reason: seated by their tops above the host's ground, a
0.07 tile would float with daylight under its edges (the old dry berm already did — top
`groundAt + 0.113`, bottom `+ 0.035`, over a grass disc at −0.02). A box is 12 triangles whatever
its height and they are all in one merged mesh, so the skirt is free.

**Two things are deliberately unchanged.** The **sand banks** were already seated off `waterY`, so
they still "just break the surface" and are the one part of the reef meant to. The **wreck** is
water-relative too: the broken hull's origin IS the waterline, and the severed bow section moved
from `groundAt − 0.30` to `waterY − 0.33` — the same offset it always had against the old surface —
so her measured read is preserved exactly (stem head 1.63 above the lagoon, ~2.4 units of deck out
of the water) while the deeper basin only puts more water under her keel.

`g.userData.lagoon` publishes `{ x, z, a, b, waterY, bedFloorY, bedShelfY, lipY, spitY,
sheetRadius }` and every sand mesh carries `userData.sand`, every scatter item `userData.reef`, so
this is a READ for a probe rather than a re-derivation. `probe-reef-water.mjs` ends in **9
assertions** (water below the lip, water above the floor, floor above the host's ground, spit dry,
trough not flooded, basin floor covered, scatter mostly submerged, some scatter breaking the
surface, wreck breaking the surface); all 9 pass, and **4 of them fail** when the probe is pointed
at a reconstructed pre-change copy with `--src=`, so the gate is known to be able to go red.

### THE WATER USED TO CLIP THROUGH THE GROUND — where, and what fixed it

Probed (`rr2-water3/5.tsx`: a polar sweep of the sheet's own clip ellipse, raycast against each
sand class separately, then against the sheet's REAL displaced surface). On **flat** ground, before:
**9.4 %** of the sheet's interior had ground standing above its wave crest, the sheet's own rim was
buried in proud sand in **32 of 72 azimuths**, and **99.8 %** of the station apron under the sheet
stood proud of it — the water plane ran **6.27 u inside its own rim**, straight across the dry
apron and the jetty. On a ±0.35 plot it was **56.5 %**. Three distinct causes, all fixed:

1. **The plate lattice bled across its own class boundaries.** dims are `STEP + 0.52…0.74` on a
   1.15 lattice, so a plate reaches up to **1.29 u past its own centre** — and every plate was
   classified by its CENTRE. Dry berm (top `groundAt + 0.113`) therefore stood inside a sheet at
   `groundAt + 0.005`. **Fix:** a plate is DRY only when ALL FOUR of its rotated corners clear both
   the sheet ellipse and the wobbled shoreline. That is also why the wobble is now kept OUT of the
   sheet's own plan-form: `sheetR` (plain ellipse, exactly what the shader discards on) governs
   what may be dry, `lagoonR` (wobbled) only shapes the sand outside it.
2. **The sheet is a disc and the cove is not.** The station SPIT is a rectangle carved out of
   `isWater`, but nothing carved it out of the MESH. **Fix, and it is not a hole:** a per-vertex
   **DIVE** is baked into the plane — wherever `sandTopAt(x, z)` stands above the water plane the
   vertex is pushed 0.05 UNDER the sand and hidden by it, then max-plus (cone) dilated at slope
   0.30 over 3 vertices so the plate rectangles smooth into a shoreline and the dive can only ever
   deepen. `vLocal` is `position.xy`, which a height-only displacement does not touch, so the
   shader's rim fade and shore foam are untouched. Deepest tuck: 0.133 flat, 0.635 on the ±0.35
   plot. The visible waterline is now the real sand surface.
3. **A level pond over sloping ground.** `waterY` is ONE constant while every plate sat on the
   local `groundAt`. **Fix:** the BED and the ripple ridges are clamped `Math.min(gy, waterY)` —
   a carved, level basin — the station apron is clamped `Math.max(gy, waterY)` (built-up ground:
   a plot that dips must not drown the queue lane), and the sand banks are seated off `waterY`
   rather than off `groundAt`, so "just breaking the surface" means what it says.
   *(Superseded by "THE POND WAS DRAINED" above: every sand level is expressed relative to the
   waterline now and floored at `groundAt + …`, which subsumes both clamps.)*

**The waterline moved UP, from `groundAt + 0.005` to `+ 0.030` in this pass — and to `+ 0.300` in
the one documented above — and that is only safe because of the dive.** The old three-millimetre surface existed because raising it flooded the apron. With
the tuck in place there is room: `+0.030` puts the awash wet band's top 0.017 UNDER the water
(inside the swell) while leaving it 0.033 clear of Stage's grass disc at −0.02. The first cut of
this fix SANK the wet band instead and a ring of grass came up between the water and the berm —
reverted.

After, same probes: **0** samples of sand standing through the open lagoon, apron **0 of 578** on
the sloping plot and **13 of 578** on flat (all on the apron's own water-facing edge, which is a
beach), rim buried in **5–7 of 72** azimuths instead of 32–63.
* **The shoreline is a wobbled ellipse MINUS a dry SPIT** (`x ∈ (−4.8, 2.6)`, `z ∈ (−2.7, 7.4)`) around the station and its queue lane, because paths need dry ground. No convex shape centred in the loop can both reach the wreck leg and exclude the station corner, so the spit is carved out explicitly.
* **`buildCoralHead(t, seed, scale)`** — a small mostly-buried rock knuckle crusted with a bushy colony: 8–12 chorded stems in TWO tints, each forking twice, plus sea fans on the big colonies only. The first pass sat coral on a full-size boulder and the lagoon read as a rockery; coral now outnumbers bare reef rock 2:1 and rock scale falls off within 2.2 of the channel.
* Plus **sand banks** just breaking the surface (in the WET tone — pale slabs read as paper floating on the lagoon), bed **ripple ridges**, **wreck debris** (broken planking, staved barrels, fallen spars, rusted anchors with one fluke in the air), bleached **driftwood** trunks and **8 living palms** on the berm. Palm fronds are FLAT `bladeSpec` blades: square-section fronds read as green joists, and a radial starburst of them read as a dead spider, so each crown droops one way.
* Nothing is ever placed within **1.15–1.6** of the channel centreline (`distToTrack`), and the whole scatter is skipped inside the spit.

## The near misses — what makes it read as dangerous

Speed is not the lever here: the flume drift tops out at 7.32 u/s and the worst lateral is 0.263 g.
What is dangerous is what the boats pass THROUGH, and how close. Everything below is built in
RIDE-LOCAL space off the frames — like the bowsprit, so the clearance is exact by construction —
and then **re-measured against the boat's real swept envelope** (`rr2-clear.tsx`: two-way
vertex→triangle minimum, riders ON, 1400-sample lap sweep).

**The boat's envelope, measured, not assumed:** half-beam **0.280**, highest point **0.474** above
its own origin — the STERN LANTERN on its jackstaff, not the carved prow (0.42). At
`wheelOffset 0.25` that is **0.724 above the rail**, and every overhead crossing is placed against
0.724. (The previous pass could not close this number and said so; it is closed now.)

| near miss | measured clearance |
| --- | --- |
| the hanging **YARD** over the summit crest | **0.303** |
| the **REEF FANGS** at the splashdown | **0.406** |
| the **BOWSPRIT** over the run-out | **0.705** |
| the **SHARK** in the splashdown pool | **0.898** (single lap) / **0.968** (4.3 laps) |

* **The leaning mast and its yard.** A second, older wreck the reef swallowed: nothing left but her
  mainmast, 9 units of it standing out of the lagoon 2.9 outboard of the summit run, with a
  splintered crown, shrouds down to deadeyes on the reef, two torn topsail panels hung OUTBOARD of
  the channel, and a **level YARD hanging by one lift** slung across the channel 0.6 u before the
  boats tip into the plunge. **The yard is horizontal on purpose.** A raked mast crossing overhead
  gives a perpendicular clearance of only `vertical · cos(rake)`; at the 64° a mast standing that
  far out has to take, a 0.48 vertical gap measures **0.11** to the spar's surface — a hit, not a
  miss. A level yard's perpendicular distance IS its vertical distance, so the gap you place is the
  gap you get: axis at rail + 1.10, radius 0.075, measured 0.303.
* **Three reef fangs** flank the splashdown run-out, leaning IN, base 1.12 off the centreline and
  tip **0.75** — the closest solid thing to the hull anywhere on the circuit, at the fastest point
  on it, each with a coral crust round its foot so it reads as reef rather than a rock somebody
  stood beside the track.
* **A shark** works the pool on the SEA clock (the lagoon is not motion-gated, so a parked ride
  still has something in the water with it). Her circle's RADIUS IS SOLVED, not chosen: shrunk
  until every point of her **2.2-unit body** — not just the path it follows — is ≥ 1.25 from the
  channel centreline. Published as `userData.sharkPath` = `{ r: 2.60, minDistToTrack: 1.289 }`. A
  hand-picked 2.9 measured **0.054** to the hull on the home stretch: a hit, on the leg nobody was
  looking at.
* **Warning signage** — `hazardBoard()`, a bleached plank with a red diagonal stripe and a painted
  skull over crossed bones, all box geometry (the design system has no text pipeline and a blurred
  glyph texture reads worse than a symbol). One lashed to the mast at eye level from the summit and
  squared to the boats; one on a leaning stake in the shallows off the run-out.
* **The splashdown.** Droplet rate 130 → **190** and mist 31 → **43** at full proximity, foam blobs
  25 % larger, all still inside the 2-emitter / 150-particle budget. And the skiff now **WALLOWS**
  out of the landing: a 0.14 rad roll + 0.077 rad pitch decaying at 0.55/s, driven by proximity to
  the landing (so it is exactly zero on the jetty and parked drift stays 0.0000), with **0.06·rock
  of lift** applied along the frame's up BEFORE the rock. The lift is not decoration: the keel
  clears the trough floor by only 0.030 sitting level, and rolling her 0.14 rad drops the low bilge
  0.0365 of that. With the lift, the worst floor clearance across the whole rock envelope is
  **0.0300** — the same as level — and the worst wall clearance **0.2015** (`rr2-hullsweep.tsx`).

**One number this pass did NOT close, and it is not new.** A triangle-level probe of the hull
against the SWEPT CHANNEL MESH (`rr2-trough.tsx`, 26 304 channel triangles) reads **0.0000** at
**t = 11.50 s** — on the summit run, where `rock` is exactly 0, so it is not the wallow. It is the
flume profile's own `wheelOffset 0.25` seating: the skiff floats in its trough with the keel
grazing it somewhere on the sweep, which is pre-existing and unchanged by this pass. The
better-posed test is the analytic one above (`rr2-hullsweep.tsx`, the profile's floor at −0.10 and
walls at ±0.50): floor **0.0300**, wall **0.2015**, and — the point of the lift — those are the
figures at rock 0 AND at full rock, so the wallow costs nothing. If a future pass wants the true
hull-to-trough minimum, write it against the swept mesh at a rock-free pose and decide whether a
boat touching its own channel floor is a defect at all; do not read the 0.0000 as a wallow bug.

**Rider clip is ZERO.** `rr2-strict.tsx` sweeps 1200 poses with riders ON and tests every static
vertex outside the ride's own channel against the boat's **analytic elliptical section**
(`hwOf`/`botOf`/`shrOf`) rather than its bounding box: **0 vertices inside the solid**. The box
test still reports 37 153 — all of them at the box's corners beside a canoe's narrow keel (the
chain-lift cleats, the bowsprit's iron bands), which is exactly the false positive the fleet's
rubric warns about. The ONE real clip this found was the wreck's **barnacle crust**: it ran the
full length of the hull including across the gash, and the 9.2° list carried its top to a measured
+0.562 in the heeled frame — 2 mm inside the skiff's keel line where the channel crosses.
Barnacles grow on planking and there is none in a hole, so the band now skips `|z| < 1.5`.

## The boat — `buildReefBoat(t, scheme?, { riders, seats })`

A clinker-built **reef skiff**, four abreast on hewn thwarts. The lofted-hull recipe (and the exact rocker/section maths) is the one verified for the flume profile: 15 cross-sections from a canoe stern (z −0.74) to a raked stem (z +0.76), 9 points each from the sheer over the turn of the bilge to a slight keel vee, with **ROCKER** (`botOf`, +0.135 toward each end — what clears the plunge's pull-out) and **SHEER** (`shrOf`). Three lofts share those sections so the hull carries a hard **boot-top line**: brine-green painted topsides above TARRED near-black planking. UVs are (girth, along-z), so the grain runs FORE-AND-AFT — it reads as planking, not as a texture wrapped round a tube. Then swept cut-wood gunwale caps and a tarred boot-top batten, two bronze bands chorded round the **tarred bottom only** (on the painted topsides their metal highlight blew out to near-white and read as sticking plaster), a brass stem cap and mooring ring, a small carved **marlin prow** (head block, bill, dorsal, lower jaw — an earlier long bill crossed by broad pectorals read as a white crucifix bolted to the bow), a tarred sole, four thwarts at `hwOf(z) × 1.70` (1.92 put the widest thwart ends 0.0007 THROUGH the planking, showing as pale patches on the topsides), a rope coil (`lodDetail`) and a brass **stern lantern** on a jackstaff.

Rides at the flume profile's own `wheelOffset 0.25`: keel 0.05 above the channel floor amidships.

## Sim wiring (verified headlessly)

Capacity **4** = the four thwarts. REAL GameManager guests board DISTINCT live seat anchors via `seatWorld` (`makeSeatWorld` over anchors parented into the boat; decorative `buildPeep` riders default true standalone / **false when registered**, so unfilled thwarts read visibly EMPTY). The built `update` wraps the boat, the channel water and the splash in `createMotionGate` (`spinDown: 1.6`) — a registered ride sits PARKED through `waitingForPassengers`/`waitingToDepart`/`unloadingPassengers`, eases 0→1 on `departing` and eases back to rest into `arriving`. **The SEA is NOT gated:** the lagoon and the night lamps run off the REAL clock outside the gate, so a parked ride is not a frozen ocean. Un-registered previews are byte-identical: the gate starts UNGATED until the first `onStateChange`.

Probe results: **4/4 distinct seats** all riding the boat, parked drift **0.0000**, **18.74 u** of travel in the 10 s from dispatch, `invalid=false`, and the whole build logs **ZERO console warnings**. A FATAL pieces compile sets `invalid` so `<ConfigurableRide>` never registers a broken circuit; `compiled.report` is exposed on `group.userData.trackReport`, and `userData.wreckAt` / `bowspritAt` / `bowAt` carry the set-piece world positions for harness probes.

**Park layout:** queue HEAD **2.1** out the local +z front (the dry sand spit the lagoon is carved around; entrance hut lands at ~1.48, clear of the jetty), exit hut at local **[1.9, 2.1]**, boarding at **[−1.3, 0.6, 0]** on the jetty deck. Defaults: name "Reef Racer", capacity 4, rideDuration 22, **intensity 8**, price 5.

**Budgets:** **4 real PointLights, all night-gated** — the station jetty, the wreck's hanging passage lantern, the bowsprit lantern and the summit channel-marker beacon (plus emissive-only lamp glass, quarter windows and the boat's stern lantern, all guttering on a shared hashed flicker). **2 ParticleKit emitters / 150 particles** (splash droplets 90, drifting mist 60). **495 meshes / 114 k tris** for the whole cove; every static repeat (sand apron, dunes, litter, reef, coral colonies, hull ironwork, ribs, beams, rigging blocks, deck fittings, palm fronds, jetty) batched through `mergedBoxes`, and fine litter, barnacles, small coral and the rope coils tagged `userData.lodDetail`. Deterministic — hashed sines only, one absolute-time updater.

Channel water is ONE continuous animated `buildWaterRibbon` (260 frame samples riding +0.035 above the centreline, width 0.72, amp 0.16 × waviness 0.6) over the profile's own blue-grey backing strip, the same treatment as LogFlume, RiverRapids and MagmaRun.

## Preview circuits

- **3D rig — Wreck Reef Run (LEAD)** — the whole cove, held still.
- **Through the wreck (close)** — looking down the home stretch into the gash, 22° off the channel axis: hull on both sides, deck bridging above, the channel running in.
- **Under the bowsprit (close)** — the splashdown, the severed bow section and the bowsprit spearing across the channel with its lantern.
- **The reef skiff (close)** — `buildReefBoat` staged through the preview's `dress` hook in a short length of the ride's own channel (floor, walls, rim rails and water strip at the exact heights the profile sweeps them).
- **The plunge + the lagoon (close)** — the 34.8° drop, the trestles standing in the water like pilings, and the clearest look at the reef.
- **Track pieces — Coral Cut** — `<Station/><Lift height={3.2}/><TurnR angle={180} radius={5.6}/>…<Drop height={3.2}/>`: a long out-and-back instead of the stock rectangle. The wreck leg length is not free — the two closing 90° turns must give back exactly `2·5.6 − 2·2.0 = 7.2` units of z, which is what makes it close with **zero synthesized track** (worst clearance **3.19**, hull clearance 0.050 / 0.137).

Built with three.js on the shared Stage; the flooded channel is modelled from the authentic RCT2 Water Coaster sprite, the ship from the real thing.

## Audit — 2026-07-25 (second pass), 100/100

| Dimension | Score | Notes |
|---|---|---|
| Mesh richness & count | 15/15 | 499 meshes / 108 568 tris / 4 lights / 2 emitters, 48 `lodDetail`; sand apron, dunes, litter, reef, coral, fangs, hull ironwork, ribs, beams, rigging blocks, deck fittings, palm fronds, the mast's shrouds and the jetty all batched |
| Detail | 15/15 | tex+bump throughout; the chain lift's cleated belt and anti-rollback dogs; 4 night-gated PointLights + 10 emissive materials on a shared hashed flicker; the new mast carries splinters, shrouds, two torn topsails and a painted hazard board |
| Cohesion | 20/20 | 1400-sample lap sweep for the near-misses, 1200-sample sweep for the clip test against the boat's ANALYTIC section: **0 static vertices inside the hull**, and the one real clip found (the barnacle band across the gash) is fixed |
| Guest comfort | 15/15 | 4/4 distinct seat anchors, parked drift **0.0000**, 18.74 u of travel in the 10 s from dispatch, `invalid=false`; the wallow lift keeps the keel's floor clearance at 0.0300 through the rock |
| Guest location | 15/15 | **the boat now parks on its own jetty at every frame rate** — see below |
| Aesthetic | 20/20 | the waterline is a clean shore instead of a sawtooth of sand rectangles; the plunge is 27 % deeper and dominates the 50° park camera; night lights the transom, the passage lantern, the bowsprit lantern and the jetty against water that measured 1 % of value away from the shipped palette |
| **Total** | **100/100** | |

Probes (all in `/tmp/mp3d-render/`): `rr2-water3.tsx` / `rr2-water5.tsx` (the water/ground seam,
before and against the sheet's REAL displaced surface), `rr2-layout.tsx` (compile-only layout
sweep — THREE is the first argument, no renders), `rr2-cycle.tsx` (gate surplus + per-cycle
boarding at four frame times), `rr2-clear.tsx` (near-miss clearances), `rr2-strict.tsx` (rider
clip against the analytic section), `rr2-hullsweep.tsx` (hull vs the channel profile across the
rock envelope), `rr2-boat.tsx` (the boat's true envelope), `rr2-final.tsx` (census + seats).
Shots: `shots/rr2/{BEFORE-lagoon, AFTER-lagoon, crop-before, crop-after-final, AFTER-lead,
AFTER-lead-el50, AFTER-crest, AFTER-bowsprit, AFTER-night}.png`.

### Fixed this pass 1: the water really was clipping through the ground

See **THE WATER USED TO CLIP THROUGH THE GROUND** above for the three causes and the three fixes.
The short version: it was an ORDERING and MARGIN problem, exactly as suspected — the sheet was a
plain ellipse, the sand was classified by plate CENTRE on a lattice whose plates overrun 1.29 u,
and the whole station apron sat inside the disc. Raising the sheet was the wrong instinct on its
own and the right one once the sheet learned to tuck under its own basin.

### Fixed this pass 2: the cycle was STILL creeping, and the old fix hid it at 1/60

The previous pass derived `LAP_SCALE` from a measured gate surplus of **1.291 s**. That number was
measured with `loadTime` **1.0**; `configurableRide.tsx:1141` defaults it to **1.6**. Re-measured
against the real FSM sequence, one dispatch hands the runner

| dt | 1/60 | 1/30 | 1/20 | 1/10 |
|---|---|---|---|---|
| clock per dispatch | 23.891 | 23.894 | 23.897 | **23.906** |

i.e. `rideDuration + 1.89`, against the 23.23 s lap that scale produced — **0.66 s ≈ 1.3 u of
overshoot every cycle.** Distance from `board` at the moment guests board, BEFORE:

| cycle | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 |
|---|---|---|---|---|---|---|---|---|---|
| dt 1/60 | 0.44 | 1.74 | 3.09 | 4.33 | 5.62 | 6.94 | 8.28 | 9.62 | **11.01** |
| dt 1/30 | 0.42 | 1.73 | 3.08 | 4.33 | 5.62 | 6.95 | 8.30 | 9.65 | 11.05 |
| dt 1/20 | 0.39 | 1.70 | 3.07 | 4.33 | 5.63 | 6.97 | 8.32 | 9.69 | 11.10 |
| dt 1/10 | 0.25 | 13.02 | 13.98 | 5.80 | **18.46** | 6.98 | 11.39 | 16.64 | 0.29 |

The 1/10 row is a different sequence entirely — `makeGuardedRun` clamps its OWN dt to 0.06, so a
0.1-s frame advances the boat 0.06 and under swiftshader it covers ~60 % of the clock it is
handed. Cycle 5 boarded four guests **18 u** away; cycle 2 at y **5.25**, the top of the chain lift.
A `speedScale` tuned at one frame time is an artefact of that frame time.

AFTER — station lock + runner substepping + a derived, deliberately-overshooting scale:

| cycle | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 |
|---|---|---|---|---|---|---|---|---|---|
| dt 1/60 | 0.30 | 0.26 | 0.25 | 0.25 | 0.26 | 0.25 | 0.26 | 0.25 | 0.25 |
| dt 1/30 | 0.30 | 0.28 | 0.26 | 0.27 | 0.26 | 0.27 | 0.26 | 0.27 | 0.26 |
| dt 1/20 | 0.30 | 0.29 | 0.28 | 0.27 | 0.26 | 0.26 | 0.29 | 0.26 | 0.25 |
| dt 1/10 | 0.30 | 0.28 | 0.30 | 0.26 | 0.28 | 0.30 | 0.26 | 0.28 | 0.29 |

Boat y is **0.85 every cycle at every frame time** — rail 0.6 + `wheelOffset` 0.25 — and 0.25 of
that 0.26 mean IS the wheel offset: the horizontal distance from `board` never exceeds **0.17**.
Three parts, §15 in the source:
* **SUBSTEP** — rail time reaches `run()` in ≤ 50 ms slices, so the integration is identical at
  every frame time. **And the brake is tested inside that loop, not once a frame:** tested per
  frame it resolved closest approach only to one frame of travel and the parked pose slid
  0.30 → 0.45 across a 1/10-s run.
* **STATION LOCK** — rail time freezes on the slice after the boat passes closest approach to a
  parked pose DERIVED from the `board` the composable publishes, and resumes on dispatch. The
  pose is PRIMED at build time by walking the same substepped runner forward, because
  `makeGuardedRun` starts the vehicle at the chain-lift base (`u0 = liftStart/N`), 3.1 u past the
  jetty. `registered` is threaded from `<ReefRacer register>` so the boat is held from frame 0 —
  `registerRide` constructs the record already in `movingToEndOfStation` without calling
  `setState`, so the gate's own handler cannot learn it in time.
* **`LAP_SCALE` targets `rideDuration + GATE_SURPLUS − 0.7`**, deliberately landing the dispatch
  PAST the parked pose so the brake has something to absorb. Tuned to land exactly, the boat stops
  short. `rideDuration` stays **22**: the world's acceptance window is `max(60, 2.5·maxDur + 20)`
  and Deep Drift's 47 s owns it.

### The clock trap, one level below the one the rubric already documents

The rubric warns that wall-clock is not sim-clock. There is a second layer: **`createMotionGate`
clamps its internal `dt` to 0.1 s and `makeGuardedRun` clamps its own to 0.06 s.** A sweep that
steps the updater at 0.25 s therefore advances the RIDE by 0.1 and grades a pose the ride never
holds. Sweep the POSE on the UNGATED build (before any `onStateChange` the gate is a pass-through
and `update(t)` is exact) and step the GATE tests at 1/60 s. The 0.06 clamp is also the whole
reason §15 substeps.

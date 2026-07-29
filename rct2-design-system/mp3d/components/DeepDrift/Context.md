# DeepDrift

**CANONICAL IMPORT — copy exactly:** `import { DeepDrift } from './components/DeepDrift';`
*(never from `'./Park'`: only the `<Park>` wrappers + track-piece JSX live there. A wrong
specifier makes esbuild refuse the WHOLE bundle — the round-8 black-page failure.)*

**Deep Drift** — attraction **2** of **TIDEWATER HOLLOW** (the shipwreck cove whose flagship is `components/ReefRacer` and whose dressing set is `components/TidewaterScenery`): a slow boat ride in **TWO ACTS**.

| | |
| --- | --- |
| **ACT 1** | the boats **drift through sea caves** — a level channel winding under a free-standing rock arch, then a long collapsed overhang, then a second arch. Dripping water, kelp, hanging jellies, the first faint bioluminescence crusting the wet rock. **No drops at all.** |
| **ACT 2** | the boat drifts into an iron **LOCK HOUSE** straddling a fissure, onto the removable section of channel the bell carries, and a riveted **DIVING BELL** takes it — boat, riders and all — **3.6 units down through a MOON POOL cut in the trough** and into the TRENCH, where the walls are alight with anemones, polyp patches and jellies and the bell's portholes catch the glow. Then the hoist brings it back up and the boat drifts home. |

Built on the **shared spline machinery** like every tracked ride in the design system: `compileTrackPieces` compiles the circuit and `buildRideSpline({ profile: 'flume' })` sweeps it — the flooded U-channel trough with a water strip on wooden truss trestles, which is what a boat ride runs in. No forked track code, no bespoke water shader, and the boat is `buildReefBoat` **imported from ReefRacer**.

## The layout — "Bell Trench Drift" (`DEFAULT_PIECES`)

Compiled at `start [0, 0.6, 0]`, `heading −90°` (the station straight runs along local −x and every turn is a RIGHT turn, so the whole loop lives in the local −z half-plane and the local **+z face stays clear** for the queue lane and the huts):

| leg | pieces |
| --- | --- |
| A (−x) | `station` · `straight 2.6` — out toward the cave mouth |
| B (−z) | `turnR 90 r2.4` · `straight 6.6` — **THE SEA CAVES** |
| C (+x) | `turnR 90 r2.4` · `straight 6.7` — the ledge leg, **LOCK HOUSE + TRENCH at its middle** |
| D (+z) | `turnR 90 r2.4` · `straight 6.6` — the home reach |
| → | `turnR 90 r2.4` · `straight 1.2` brake tail, landing **0.3 u short** of the station on its own axis |

**THERE IS NOT ONE `lift` OR `drop` IN IT.** The whole circuit sits at y 0.60 and the only vertical move on the ride is the bell. That is the point: a cave drift is atmosphere, not gradient, and spending the layout's footprint on a hill would have bought a worse ride *and* a smaller cove.

**Compile numbers** (probe, `profile: 'flume'`): `ok=true`, `fatal=false`, worst clearance **2.46**, closure **closed with ZERO synthesized track**, **23** control points, **41.65 u** of arc, footprint **11.5 × 11.4**, and **zero console warnings**. The design report carries exactly one line and it is informational: `shortDrop:warn` — RCT2's excitement stat gate complaining that the first drop after the lift is 0.00 units, which is meaningless on a ride with no drops. The flume profile does not enforce `checkCoasterDesign` and nothing is logged.

## How the two acts are stitched — the ACT MACHINE

The bell descent is a **scripted, motion-gated stage, not spline geometry**, and it has to be: a spline cannot stop, and a Catmull-Rom taken 3.6 units straight down and back would fail the pitch-rate, slope and clearance checks the kit runs on every layout. So the geometry, the frames, the trough, the trestles and the closure legality are all the shared kit's, and the boat is paced by an **analytic piecewise map from the gated clock to arc length**:

```
drift out   s = clock·V                          0 … sBell        (V = 1.25 u/s)
THE BELL    s = sBell,  depth 0 → 3.6 → 0        a 13.8 s stage
                        (3.6 s down, 6.6 s held in the trench, 3.6 s up, smoothstepped)
drift home  s = sBell + (clock − …)·V            sBell … total
```

`LAP = total/V + BELL_T` = **47.12 s** (33.3 s of drift + 13.8 s in the bell), which is what `rideDuration: 47` is set from, so a registered ride completes exactly one lap per dispatch.

**Analytic, not dt-integrated, on purpose.** The kit's own `ride.run` integrates `dt` and has no notion of a stage that stops; a hand-rolled integrator would have made the pose depend on the frame history, so two screenshots of the same clock would differ. The map above is a pure function of the gated clock, which makes renders reproducible and gives the previews the `phase0` prop — **seconds to advance the machine at t = 0** — so a preview can open straight into the trench. Measured on an ungated build: the lead rider's seat sits at y 0.68 through act 1, reaches **y −2.92** in the hold, and is back at 0.68 in act 2.

`bellU` (where the dock goes) is scanned, not hard-coded: the contiguous **straight + level runs** are collected and the machine takes the **MIDPOINT** of whichever long-enough run lies farthest from the station — 0.5437 on the stock layout, i.e. the middle of the far ledge leg. Scoring individual samples instead of runs picked the far END of the run and put half the lock house in the turn. Override with `bellU`.

## THE DIVING BELL — `buildDivingBell(t, opts)`

Local frame: **+z along the channel** (the arches face ±z), and **y = 0 is the CHANNEL RAIL**, so the caller hangs it straight off a spline frame and simply moves it down in y.

* **Plate staves, not a lathed cone.** 30 riveted iron plates round the circumference with three rust-strapped bands each. A `CylinderGeometry` cannot have a hole in it, and the bell needs a real **arched opening at each end** because the boat drifts in and out through it. Plate-and-rivet construction is also the whole read of a Victorian salvage bell.
* **`ARCH_HALF = 0.85` rad (48.7°) is not a styling choice.** The fissure is skewed 45° to the channel (below), so the one camera that can see down the fissure is 45° off the arch normal — at ±0.62 the opening was still edge-on from there and the riders were invisible at the bottom of the stage. At ±0.85 the opening is wider than the view angle.
* Stepped iron **lintels** and jamb blocks over each opening, a **domed crown** with a brass-covered hatch and six dogs, a crossed **lifting yoke** with four eyes **on the quarters** (a cable dropping to an eye on the channel axis had to slant right across the headframe to reach its sheave), an interior lamp in the crown, and a barnacle crust along its own old waterline.
* **Four brass-ringed viewing PORTS** with eight bolts each, on the two surviving plate quarters — square across the channel, since the widened arches now occupy the old ±45° positions. The ring lies FLAT round the glass (`rotation.y = π/2 − a`, because a torus's axis is +z): the old triple rotation left it standing edge-on like a hoop 0.23 proud of the plate, which reached radius 1.41 and took a 0.09 bite out of the lock house's bottom flange on the way down.
* **THE CRADLE PAN** is the mechanism, and it is a PLUG, not a lift floor. A shallow iron caisson with coamings, transverse ribs and its own strip of water, **2.72 units long (`PAN_HZ` 1.36) against the moon pool's 2.92**, so it seats with a 0.10 joint at each end and the channel reads continuous when the hoist is up. It is **0.86 wide, not 1.10** — that number is now a styling choice rather than a clearance one (the pool is 2.8 wide), but a pan wider than the channel would still read wrong where it seats.
* **TWO GUIDE SHOES per rail** (`GUIDE_R` 1.42), forked brackets on the 135°/315° quarters — one off the lifting yoke, one off the arch plate at mid-height — running on the shaft's two fixed rails. A bell on four cables alone swings; a bell on guides is machinery running in a shaft. The quarters are not free choice: the fissure is skewed 45° to the channel, so those two are its own centreline, the only vertical members that cannot get between the trench camera and the open arch. Their arms are offset to the cheeks' tangential line, **not** run down the centre — a centred arm ends exactly where the rail web is and drove 0.28 through it.
* **A SHALLOW domed crown.** The cap used to be a full-radius sphere segment whose rim sat 0.24 ABOVE the top of the staves — an open slot right round the crown — rising to y 3.06, which swallowed the brass hatch and put 2.32 units of dome through the lock house roof. Squashed to 0.42 and seated so its rim lands on `BELL_TOP`, it closes the crown, the hatch sits on it, and the whole crown fits the hoist well.

## THE MOON POOL — the opening the bell goes down through

**The bug this fixes:** *"the diving bell is weird in that when the bell goes down the track containing the ride is still there so it looks like the bell clips through the track."* It did, and not slightly. The kit sweeps ONE continuous trough and the old answer was to **hide** the offending span behind the lock house's roof and walls — but hiding it does not stop the cradle pan, the boat and four riders passing bodily through a wooden floor, its ribs, its rim rails and a trestle bent, and from any camera low enough to see under the house that is exactly what you saw. Measured over the full 13.8-second stage: **every one of 38 samples clipped, up to 1 348 intersecting triangle pairs at once, worst penetration 3.31 u.**

**A real diving bell descends through an OPENING, so this one does.** The trough is CUT — `cutOpening` drops every triangle of the swept mesh with a vertex inside a dock-local box, leaving a genuine moon pool **2.92 long × 2.80 wide** (`POOL_HZ` 1.46, `POOL_HX` 1.40).

**Why the pool is that big, and why doors were the wrong answer.** Doors were the tempting option — a pair of trough-floor leaves parting as the bell arrives, which would also explain the water — but **the bell is 2.5 units across and the channel is 1.0**. Its shell reaches 1.25 from the axis, its lifting yoke 1.22, its arch lintels z ±1.26; a leaf that opens *within* the trough can never let any of that through, and a leaf big enough IS a moon pool with extra steps. Fading the span was cheaper still and a track that vanishes reads as a bug too. And the pool needs no door anyway, because **the cradle pan is the plug**: 2.72 against the pool's 2.92, seating with a 0.10 joint at each end, carrying its own strip of water.

**Any-vertex, not centroid.** The cut drops a triangle if ANY of its vertices is inside. With a centroid test the surviving quad still reaches a whole frame into the opening (frames are 0.13 u apart on the stock layout, 0.17 on the Kelp Gallery), so the pan-to-trough clearance would depend on how long the author's circuit happens to be. Any-vertex guarantees the trough starts at or beyond the edge on **every** layout; the cut simply runs up to one frame long the other way, which the head castings cover.

**Two traps in the surgery, both of which bite.** `box()`/`cyl()` hand out CACHED, SHARED geometries keyed by their dimensions (Stage `getGeo`) — the trough's transverse ribs are all one BoxGeometry, shared with every other component in the design system, so cutting in place would punch a hole in half the park; every geometry is **cloned** first. And a cut geometry keeps its old bounding box and sphere, so both are recomputed.

**Six authored members put an engineered edge on the hole**, so it reads as a fabricated shaft head and never as a gap where the track should be:

| | |
| --- | --- |
| **head castings** | a pair of iron jambs, a head band under the floor and a **nosing** at each end. The nosing goes UNDER the floor, not over it: the swept floor is a zero-thickness ribbon at −0.10 and the dive skiff's keel line rides at −0.07, so a proud plate has nowhere to go (a first pass put its top at −0.07 and the hull cleared it by **0.1 mm**). |
| **the kerb** | a raised riveted coaming down both long sides, standing on the lock house's own bottom flanges, with bolt heads — the rim. |
| **head beams** | two transverse plate beams hung off those flanges, carrying the cut trough ends where the trestle bent used to stand. Both sit OUTSIDE the pool: **nothing spans the opening.** |
| **the throat** | riveted plate down the top 1.5 units of both fissure walls, with a ring beam under the lip, a hoop strap and weed. It follows the WALL (`|lz| = riftHZ(lx) − 0.12`), so it costs the bell no clearance at all. |
| **guide rails** | two T-rails from the headgear down to the trench floor with wall stays, on the fissure's own centreline. The bell's four shoes run on them. |
| **the hoist well** | the roof used to be three plated bays with two 0.33 cable slots, and the bell's 2.32-wide crown went straight through it (2 236 pairs). A headgear over a shaft has an open WELL under its sheaves: |x| ≤ 1.32, |z| ≤ 1.34, kerbed all round. What the overhead view sees through it is the crown filling it when the hoist is up and the lit shaft when it is down — never a length of bare trough, which is what the roof was for. |

**The trestle bent had to go too.** `addSplineSupports` foots its splayed legs 0.67 out from the centreline and lands them on the ground datum — and at the dock there IS no ground, only the fissure. So the cut window is wider than the pool itself (1.62 vs 1.40), and what carries the trough there now is the lock house.

**THE FISSURE WAS TOO NARROW FOR THE BELL, which is the same bug one layer down.** A 2.9-wide slot and a 2.5-wide bell leave 0.2 of annulus, and the wall courses step IN as they descend (`hz = riftHZ(lx) − fy·0.3`) — so over the whole of its travel the bell ploughed through nine courses of rock, the boulders jammed in them and the colonies growing on them (10 754 pairs against the wall mesh alone, 6 844 against the boulders). Two changes: the mouth is **BULGED** where the bell passes (`SHAFT_BULGE` 0.7, dying away over 2.6 units — everything that follows `riftHZ`, the lip rock, the weed, the bed, the ledge cut-out and the published `riftRect`, widens with it for free), and a **`SHAFT_R` 1.72 guard** is a hard backstop: wall courses are pushed radially clear of it, and loose things — boulders, colonies, jellies — are DROPPED rather than shoved off the wall they are supposed to be growing on. Colony/boulder/jelly counts were raised (26→33, 16→21, 9→13, 10→13) to put the density back.

## THE TRENCH, and the two geometry problems it took to make it readable

The fissure and the lock house share one origin but live in **separate frames**, and both facts were forced by what a camera can actually see.

1. **The fissure is skewed 45° to the channel.** The bell's arches face along the channel — that is how the boat gets in — so a fissure running square across the channel can only be looked into from a direction in which the bell shows its blank side. At 45° a camera on the open arm looks down the fissure *and* 45° into the arch. The lock house stays square to the channel, so `rift` is yawed `dockYaw − 45°` and `dockGrp` is yawed `dockYaw`.
2. **The fissure is NOT a constant slot.** A 2.9-wide slot 4.35 deep can only be seen into from within ~17° of its own axis; from every normal DS camera the bell was in a letterbox. The **seaward arm opens out** (`riftHZ(lx)` widens toward +x, the lip reaches 4.7) and its floor **ramps up** — steeply near the lip (`^2.4`), so it stays deep where the bell hangs — which reads as a chasm that collapsed open on one side and lets a ~35-40° camera on that side look straight in.

Then: nine stacked rock courses down both walls (following the widening plan), with **boulders jammed into them** because nine even courses read as a staircase; the landward end closed off and the seaward end open; a plated bed on `floorAt`; fallen blocks; a broken **rock lip** all round the opening (the plate lattice is held **0.78** clear of the hole — at 0.42 a 1.6-wide plate still overhung it by a third of its width); and weed over the edge.

**THE LIFE is the point of the trench.** Three silhouettes, because "a glow" is not a creature: `bioAnemones` (dark stalks with lit crowns), `bioPatch` (a flat crust of glowing polyps), `bioJelly` (a lit bell with four trailing tentacles, which drifts and pulses on the ride's one absolute-time term). 26 colonies down the walls, 10 on the floor, 9 jellies hanging in the middle, plus patches in the sea caves — which is why act 2 is not a non-sequitur: the caves in act 1 carry the first faint crust of the same stuff.

### The lock house, and why it exists

It used to exist to HIDE the trough — see the moon pool above; that was the bug, not the fix. What it exists for now is what a lock house is actually for: it carries the channel over the fissure and it carries the hoist. A **roof** with the hoist well in it, **riveted plate walls** to 1.72 (which are also the girders that hold up the cut trough ends), and a hanging **portcullis** at each end. Above 1.72 the walls are open **lattice**, because 4.5 units of solid plate reads as a windowless shed dropped on the reef. Through that lattice band you can catch the channel running in, which is the correct read anyway.

**THE WALLS ARE THE GIRDERS.** The first pass slung two lattice cross girders under the house and, from the one camera angle that can see into the trench, they crossed the frame in front of the bell like a footbridge. Each side wall is now a 4.5-unit **plate girder** with a heavy bottom flange, carried on **four masonry piers** standing on solid ledge just beyond the skewed fissure's lips — so nothing at all spans the opening the bell comes down through. The house also stands **0.68 clear** of the ledge on those piers, which is what lets a 40° camera see under it; daylight under a building that straddles a chasm is honest anyway, and it costs nothing: a ray that comes in under the wall passes *below* the trough and out the far side, so the gap reveals the trough's underside, never its interior.

On top: an A-frame **headgear** with four sheave wheels directly over the bell's corner eyes and four **hoist cables** re-stretched every frame between sheave and eye. On the ledge beside it: the **AIR PUMP** house with its flywheel, the hose running up to the headframe, a coil of spare hose, a stack of lead weights — a bell has to breathe — and, bolted to the outside of the plate, a **boiler** with its gauges and a ladder to the roof, because 4.5 units of riveted wall is a slab until something hangs off it.

**`group.userData.riftRect`** (`{ cx, cz, hx, hz, yaw, depth }`) is published because a park needs it: the fissure is the ONE thing on the ride that goes **below the ground datum** — it needs 4.35 units of depth under a channel that sits only 0.60 above the ground — so a composition that wants the trench to read must depress its terrain over that rect, exactly the contract a coaster tunnel has with its hill. Under `<ScenePreview>` pass `ground={false}` (every preview here does): a flat grass disc at y = 0 lids the fissure like a manhole cover.

## The sea caves

`caveSpan(ua, ub, seed)` lays rock along a stretch of channel; `caveArch(u, seed)` puts a free-standing arch across it. Both hold their undersides at **CAVE_CLEAR 1.62** above the rails and cut every stalactite off at **1.24**, against a boat whose carved prow tops out **0.67** above its own rail and a seated rider's head at about **0.80**.

**THE CAVE IS AN OVERHANG, NOT A TUBE**, and that is the difference between a shot and no shot. A roof carried on rock *both* sides encloses the channel completely, and a covered channel can only be looked into from within a few degrees of its own axis — every camera outside that read as a pile of boulders. So the wall rock stands on the **OUTBOARD** side only (`outSign`), the roof slab is offset 0.62 outboard and cantilevers over the water from it, and the inboard flank keeps only low knuckles: the boats run under a ledge of rock and a normal DS camera from inside the loop looks straight in under it. Every roof slab is hashed in height, thickness **and yaw** (a row of axis-aligned slabs read as stacked concrete lintels) and **boulders are piled over it**, so what the camera sees from above is a rock mass and never the flat top of a merged box.

## The reef ledge

Tidewater Hollow's other two attractions stand in open lagoon; Deep Drift stands on the cove's **rock ledge** — and that is a consequence, not a preference. WaterTile's sheet is ~80 % opaque, so a trench under open water would have veiled the bell to a fifth of its contrast; the ledge is what a 4.35-unit fissure can be cut into and still be seen.

* A lattice of overlapping rock plates (STEP 1.1, hashed rotation and size) at four heights — wet band, two dry tones, a raised shelf — plus **sand patches** (`h1 > 0.66`, in TidewaterScenery's `sandWet`/`sandDry` on the 'sand' texture), because a whole apron of `rockDry` read as one muddy grey mass and the pale patches are also the tie to Reef Racer's coral-sand beach on the other side of the cove.
* **TIDE POOLS: WaterTile used exactly as it comes** — `buildWater(…, 0.14, 0.12, 0.3)`, ≈0.010 of swell (what a rock pool does between waves) with a shallow depth skirt so a side-on view reads a volume of water, over a **pale** wet-rock basin floor (a light bottom is what makes shallow water read as shallow). The palette is WaterTile's own retuned desaturated blue-grey: not re-saturated, not re-shadered. **The pools are chosen BEFORE the plates and the lattice is cut out of them** — the first pass laid the plates over the whole ledge and all five pools sat *under* them, invisible.
* **Things standing on it**: 78 hashed items — rock knuckles, kelp clumps, bleached driftwood, staved casks, mooring bollards — because a plate lattice reads as a quarry floor whatever you do to the plate sizes. Nothing is placed within 1.0 of the channel, inside the fissure or in a pool.
* Channel water is ONE animated `buildWaterRibbon` (300 samples, width 0.72, amp 0.14 × waviness 0.5) walked from the far lip of the **moon pool** right round to the near one, so the **gap at the dock is real** — the pan carries its own water — and the wave field is still continuous everywhere the boat can see it.

## The vehicle — the dive skiff

**`buildReefBoat` from `components/ReefRacer`**, in an iron-and-brass livery (`body 0x2c4a4c` / `trim 0xb3aa90` / `tertiary 0x94793f`) with a brass **bow lamp** on a short staff added on top. Reusing the hull is deliberate: the rocker, the thwart heights and the `HIP_RISE` the seat anchors are built off are numbers already verified against this exact trough, and the two rides' fleets should be the same boats. Capacity **4** = the four thwarts.

## Sim wiring (verified headlessly)

REAL GameManager guests board **4/4 distinct** live seat anchors through `seatWorld` (`makeSeatWorld` over the anchors `buildReefBoat` parents into the hull; decorative riders default true standalone / **false when registered**, so empty thwarts read visibly empty). The boat, the bell carriage, the cables and the bubbles are wrapped in `createMotionGate` (`spinDown: 1.6`): parked drift **0.0000** through `waitingForPassengers`, **4.53** units of travel on `departing`, `invalid=false`. **The SEA and the BIOLUMINESCENCE are NOT gated** — the channel water, the tide pools, the jellies and the lamps run off the real clock outside the gate, so a parked ride is not a frozen ocean. Un-registered previews are byte-identical: the gate starts ungated until the first `onStateChange`.

**Park layout:** queue HEAD **2.1** out the local +z front, exit hut at local **[1.9, 2.1]**, boarding at **[−1.3, 0.6, 0]** on the landing stage. Defaults: name "Deep Drift", capacity 4, rideDuration 47, intensity 3, price 4.

## Budgets (measured headlessly)

**527 meshes / 75,423 tris**, **4 PointLights**, **3 ParticleKit emitters / 230 particles** (cave drips 60, marine snow rising out of the trench 90 — additive, so it reads as motes catching the light rather than smoke — and 80 bubbles off the bell's skirt while it is submerged). Every static repeat batched through `mergedBoxes`; fine detail (rivets, crust, litter, weed fringes, small rock, coils, the ladder) tagged `userData.lodDetail`. Deterministic — hashed sines only, one absolute-time updater.

**The light budget, and the one rule it bends.** Two **trench bioluminescence** lights are **day-and-night LERPED** (`1.15 + 1.15·nightK`, breathing) and never gate to zero — the LavaTubeRun rule, and the justification is stronger here than there: a fissure 4.35 units under a rock ledge is dark at noon, so gating the glow to zero by day would have left the trench a black slot in every daylight shot and made act 2 invisible for half the day-night cycle. The **bell's interior lamp** comes up with `max(smoothstep(depth), nightK)` — it lights as the bell submerges, and again after dark at the surface. Only the **headframe lantern** is purely night-gated, plus emissive-only lamp glass on the station and the boat.

## Preview circuits

- **3D rig — Bell Trench Drift (LEAD)** — the whole cove from the seaward diagonal: the level loop, the caves, the lock house and the glowing fissure beside it.
- **The diving bell in the TRENCH (close)** — `phase0={5}`, rendered at ~18.5 s of elapsed clock so both the day and the `--night --nightwait=15000` shot land inside the hold. Camera `[6.0, 3.4, −10.7] → [0, −2.0, −5.7]`: **threaded between the piers** (a first pass put the ray through the pier at dock-local (1.5, 2.9) and the bell was behind it).
  **DO NOT SHOOT THIS ONE ON A `--wait`.** The descent is 3.7 s out of a 48 s cycle, so a wall-clock wait lands wherever the page happened to be. Shoot on the PHASE: the act machine publishes `group.userData.bellDepth` and `actStage`, and the Stage puts its scene on `canvas.__stageApi`, so a harness can poll for `actStage === 'bell' && bellDepth ∈ [lo, hi]` and fire the screenshot exactly there (`/tmp/mp3d-render/dd-shot.mjs`). It also prints the camera pose it actually achieved, which is the other thing a `--wait` shot silently gets wrong.
- **The lock house + the bell at the surface (close)** — `phase0={13.5}`, the hoist up and the boat still drifting in.
- **The sea caves (close)** — a low 22° camera from inside the loop, in under the overhang, with the boat and its four riders in frame.
- **The diving bell (close)** — `buildDivingBell` staged through the preview's `dress` hook in a short length of the ride's own channel, at the exact heights the flooded profile sweeps it.
- **Track pieces — Kelp Gallery** — a bigger, rounder LEVEL circuit through JSX piece children (53.0 u of arc, worst clearance 3.12, zero synthesized closure). The rule for authoring your own: keep it **level**, and leave one straight of at least ~4.6 units for the lock house to straddle.

## Screenshot verdicts

* **Lead, day** — reads as one place: the level channel on its trestles, the cave rock piled over the far reach, the iron lock house with its headgear, the fissure glowing teal below it, the landing stage and the ledge with its pools, sand patches and driftwood.
* **Lead, night (`--nightwait=15000`)** — the headframe lantern lights the house warm, the trench and the cave patches burn teal, and the difference from the day shot is *brightness*, not presence.
* **Alternate angle (55° orbit)** — the house head-on with the fissure and its life in front of it; both acts in one frame.
* **The trench** — the bell 3.6 units down in the fissure with the boat inside it, its ports and crown lamp lit, a jelly drifting under it and colonies on both walls.
* **MID-DESCENT, before and after** (same camera, same phase, `[6.6, 3.0, −13.6] → [−0.2, −0.5, −6.4]`, `bellDepth` 0.48 / 0.36) — *before*: the green wooden channel runs straight in through the bell's flank, its water strip and floor cutting across the interior with the boat and a rider sitting behind them; the bell is skewered on the track it is supposed to be leaving. *After*: the channel stops dead at an iron head casting on each side of a clean rectangular opening and the bell hangs free in it on two guide rails, nothing at all passing through it. It reads as a bell going down a shaft.
* **Hoist up** — the crown comes up through the well in the roof and reads as a cupola on the house; the pan is flush and the channel runs continuous through it.
* **The sea caves** — the four riders clearly visible in the boat, drifting under the rock overhang past hanging jellies, trestles below.

Built with three.js on the shared Stage; the bell is modelled on a Victorian salvage bell, the channel on the RCT2 water-ride sprite.

## Audit — 2026-07-25 (moon-pool pass), 100/100

| Dimension | Score | Notes |
|---|---|---|
| Mesh richness & count | 15/15 | 527 meshes / 75 423 tris / 4 lights / 3 emitters, **74 `lodDetail`**; the diving bell alone is 26 meshes / 3 952 tris of riveted staves, bands, dogs, ports and guide shoes |
| Detail | 15/15 | tex+bump throughout; **188 emissive materials** (the trench's anemones, polyp patches and jellies, lerped between a daylight and a night value and never gated to zero — a fissure 4.35 u under a rock ledge is dark at noon); the hoist's headframe, sheaves, cables, guide rails, handwheels and gauges mean the mechanism is fully modelled, and the moon pool's head castings, kerb, nosings, head beams and plated throat mean the OPENING is too |
| Cohesion | 20/20 | **exact triangle–triangle sweep of the whole 13.8-second bell stage at 0.1 s (150 samples): ZERO intersecting pairs, worst clearance 0.0614** — the guide shoes' running fit on their rails. Same on the Kelp Gallery layout (85 samples) and over a full 322-sample lap (worst clearance 0.0107, boat to lip rock; boat-in-water excluded, because a boat floating is not a clip). Was 38/38 samples clipping at up to 1 348 pairs and 3.31 u of penetration |
| Guest comfort | 15/15 | 4/4 distinct seat anchors along the thwarts, parked drift **0.0000**, 9.65 u of travel in 10 s of `departing`, `invalid=false`; the riders ride the bell down with the boat |
| Guest location | 15/15 | **boards 0.54 u from the `boardPoint` on every one of six cycles, creep 0.00 u/cycle** — unchanged, `rideDuration` 47 and `CYCLE_SCALE` untouched |
| Aesthetic | 20/20 | reads as sea caves and an iron lock house over a lit trench, and now the descent reads as machinery: the channel stops on an iron head casting either side of a kerbed opening, the bell runs down two guide rails into a plated throat, and its crown rises through the hoist well when the hoist is up |
| **Total** | **100/100** | |

Probes: `/tmp/mp3d-render/aud-dd-clip.tsx` (+ `aud-dd.mjs`) — exact Möller triangle–triangle intersection and exact triangle–triangle distance, no Box3 anywhere; `tw-dd2.tsx` / `tw-dd3.tsx` (census, seats, gate, six-cycle drift); `tw-cycletrue.tsx`.
Shots: `/tmp/mp3d-render/shots/dd/{B,A}-{mid,hold,up}.png` (before/after at the same camera and the same phase), `A-bell.png`, `A-house.png`, `A-lead.png`.

### The probe that found it, and the one that would not have

The clip probe pulls the MOVING set (bell, pan, cables, boat, riders) in local space ONCE and re-transforms it by each sample's live world matrix, then tests exact triangles both ways. **No `Box3.setFromObject` anywhere**, deliberately: it reads each geometry's CACHED `boundingBox`, so a mesh rebuilt per frame reports identical numbers at every sample and you "prove" a fix that did nothing — and an AABB test on an open tub reports a rider correctly seated in it as a clip. The clearance number is a true surface-to-surface distance (9 edge/edge + 6 vertex/triangle cases), not a vertex sample.

The reversal was checked, not assumed: the before/after shots were taken by reverse-patching every edit and re-running the probe, which reproduced the original numbers to the digit (1 348 pairs, 3.3065 u) before the before-shots were taken.

### Fixed this pass: the act machine wrapped on the wrong period

The lap was already honest — measured **47.04 s** against a registered 47 — which is why this
ride passed the naive check and Reef Racer did not. But `rideDuration` is not the period the
ride is actually driven over. `createMotionGate` advances its clock during `departing` (eased
0→1 over spinUp 0.8) and `arriving` (eased 1→0 over spinDown 1.6), and the FSM counts neither
as ride time: measured against a bare gate driven through the real state sequence
(`rideFsm.ts:124-195`), **one cycle hands the runner 1.291 s more clock than `rideDuration`**.

`actAt` wraps on `LAP`, so that surplus was never absorbed and the error accumulated. Probed
over six cycles the boat boarded **0.5 → 1.0 → 2.5 → 4.0 → 5.3 → 6.3 u** from the `boardPoint`
— by the sixth load the boat was out on the channel and the landing stage was decorative.

One divide fixes it: `CYCLE_SCALE = LAP / (47 + 1.291)`, applied to the clock handed to
`actAt`. The pace table, the act boundaries and their ratios are all untouched; the ride simply
runs 2.7 % slower, which stretches the bell's 6.6-second hold to 6.8 s. Boarding is now exactly
0.54 u every cycle.

**`rideDuration` is unchanged at 47 and was deliberately not touched.** This world's acceptance
window is `max(60, 2.5·maxDur + 20)` and this ride's 47 s owns it (`TidewaterHollow/Context.md`);
the whole point of scaling the clock instead is that the registration, the window and the park's
`simSeconds 138` are all left exactly as they were. If you ever *do* need to change the lap,
change `CYCLE_SCALE`'s divisor, not the registration.

### The clock trap that nearly hid this

`createMotionGate` clamps its internal `dt` to 0.1 s. Any sweep that steps the updater more
coarsely than that advances the RIDE more slowly than the clock and grades a pose the ride never
holds. Sweep the POSE on the UNGATED build (`update(t)` is an exact pass-through before the
first `onStateChange`) and step GATE / FSM tests at 1/60 s.

# MoonlitBarge

**CANONICAL IMPORT — copy exactly:** `import { MoonlitBarge } from './components/MoonlitBarge';`
*(never from `'./Park'`: only the `<Park>` wrappers + track-piece JSX live there. A wrong
specifier makes esbuild refuse the WHOLE bundle — the round-8 black-page failure.)*

**The Moonlit Barge** — attraction **2** of **THORNWICK GLADE** (the enchanted forest whose flagship is `components/WyrmsHollow`, from which this file imports the shared `THORNWICK` palette and `buildIvyStrand`): a **slow lantern-lit boat drift** with **no drops, no lift and no thrill in it at all**. The charm is the atmosphere.

A lantern-hung barge leaves a timber landing stage and drifts a still, stone-lined channel at **1.75 units a second** — out past a ruined wall with a real arched window, along the **WILLOW REACH** where twisted trees lean right out over the water, through the **BROKEN ARCH** straddling the far reach, past three leaning statue plinths, and home through the **TOADSTOOL HOLLOW** where the banks are crusted with glow-worms. Motes drift up off the water; a low mist lies on it.

Built on the **shared spline machinery** like every tracked ride in the system: `compileTrackPieces` compiles the circuit and `buildRideSpline({ profile: 'flume' })` sweeps it — the flooded U-channel trough with its water strip, which is what a boat ride runs in. No forked track code, no bespoke water shader.

## The layout — "The Lantern Round" (`DEFAULT_PIECES`)

Compiled at `start [0, 0.6, 0]`, `heading −90°` (the station straight runs along local −x and every turn is a RIGHT turn, so every compiled point has z ≤ 0 and the local **+z face stays clear** for the queue lane, the huts and the street):

| leg | pieces |
| --- | --- |
| A (−x) | `station` · `straight 1.2` — out of the landing stage, past the ruined wall |
| B (−z) | `turnR 90 r1.6` · `straight 2.85` — **THE WILLOW REACH** |
| C (+x) | `turnR 90 r1.6` · `straight 5.3` — the far reach, **BROKEN ARCH at its middle** |
| D (+z) | `turnR 90 r1.6` · `straight 2.85` — **THE TOADSTOOL HOLLOW** |
| → | `turnR 90 r1.6` · `straight 1.2` tail, landing **0.3 u short** of the station on its own axis |

**THERE IS NOT ONE `lift` OR `drop` IN IT.** Measured level **0.000** — every compiled point sits at y 0.60. A gentle boat ride's whole budget goes on the glade, not on a gradient.

**Compile numbers** (compile-only probe, `profile: 'flume'`): `ok=true`, `fatal=false`, **22** control points, **26.33 u** of arc, worst clearance **1.56**, footprint **8.50 × 6.05**, closure **CLOSED with ZERO synthesized track**, **zero warnings**. The design report carries exactly one line and it is informational: `shortDrop:warn` — RCT2's excitement stat gate noting the first drop after the lift is 0.00 units, which is meaningless on a ride with no drops and no lift. The flume profile does not enforce `checkCoasterDesign` and nothing is logged.

**The arithmetic, for authoring your own.** A four-corner circuit has exactly two degrees of freedom, and the last authored piece has to land **0.3 u short of the station ON its axis** or `compileTrackPieces` closes the loop with a Dubins return leg through the track. With the station 2.6 u long that is:

```
A(2.6 + lead) + tail + 0.3 = C        B = D
```

Verified against DeepDrift's own shipped circuit through the same probe: identical closure signature (`closed: true`, `synthesized: []`), which is how this layout was known-good before a single pixel was rendered.

**Keep it LEVEL, keep the arc near 26.** The lap is `arc ÷ DRIFT_V`, so a longer circuit desynchronises `rideDuration`. Leave one straight of ≥ ~2 u for the arch to straddle.

## The cycle — why it is SHORT

`DRIFT_V = 1.75 u/s`, so `LAP = 26.33 / 1.75 =` **15.046 s** (re-measured off the live builder: `g.userData.lap` = **15.0455**).

### ⚠️ AND `rideDuration` IS **NOT** THAT LAP — THE STATION LOCK (§13)

This shipped as `rideDuration: 15` "so a registered ride completes exactly one circuit per dispatch". **It does not.** `createMotionGate` keeps integrating its clock through the spin-**up** of `departing` — whose length is `loadTime`, which `configurableRide.tsx:907` defaults to **1.6**, not the FSM's bare 1.0 — and through the eased brake of `arriving`, so the advance per dispatch is `1.2 + rideDuration + 0.67`, i.e. **rideDuration + 1.87**. At 15 that is 16.9 s of a 15.05 s lap, and the barge parked somewhere new every time. Measured with the real FSM state sequence driven into `onStateChange`, the nearest SEAT's distance from the ride's own `board` point over 8 cycles:

```
0.5 · 2.4 · 4.5 · 6.5 · 5.9 · 6.4 · 5.2 · 3.4   u
```

— right round the 26 u channel, so a guest boarded a barge that was not at the landing stage. (Tidewater's audit found the same class of bug from the other end: a ride registered at 22 s against a 57 s lap.)

Correcting `rideDuration` alone is not enough either: the best single value still creeps **0.065 u a cycle** (unbounded — 1.0 u by cycle 12). So the barge **COMES ALONGSIDE AND STAYS THERE**: the drift arc is clamped so it can never pass the parked pose while the FSM is braking it in, and resumes only on dispatch. Because the drift is *analytic* (`s = clock·V mod total`) that clamp is exact.

The pose is DERIVED, not guessed — the arc of the point nearest the `board` the composable publishes (`stopS` = **1.316**, published as `g.userData.stationStop`), which centres the hull on the pad so both benches are equidistant. Measured **14 cycles at five frame times**:

| dt | worst nearest-seat distance from `board` | spread |
|---|---|---|
| 1/60 | **0.632** | 0.001 |
| 1/30 | **0.632** | 0.001 |
| 1/20 | **0.632** | 0.001 |
| 1/10 | **0.632** | 0.001 |
| 1/30 ±40 % jitter | **0.632** | 0.001 |

Byte-identical at every frame time, which is what "exact" means here. 0.632 is the seat's own offset in the hull; the hull itself lands on the pad.

`rideDuration` is therefore **13.7**: 13.7 + 1.87 = 15.57 carries the hull 0.52 s PAST the stage and the clamp absorbs it. **Do not raise it back toward the lap** — the lock needs that overshoot, and undershooting parks the barge short of the stage where the clamp cannot help.

The short cycle is deliberate — the world's set-piece has to pass `validatePark`'s `sim` gate, and long cycles have cost this project park failures. 1.75 u/s is about **three times a strolling guest's** 0.55 u/s: a drift, not a dash, and the slowest thing on rails in the glade.

The drift is an **analytic** map from the gated clock to arc length (`s = clock·V mod total`), never a dt integration, so a given clock always produces the same pose and screenshots are reproducible. `phase0` advances that clock at t = 0; **`still`** freezes it there — a reproducible STILL, because a 15-second lap means a moving barge is somewhere different in every screenshot and a documented close-up could otherwise never be re-shot. Under `still` the water, the mist, the lanterns and the glow-worms all keep running, so a still frame is not a dead one.

## THE BARGE — `buildMoonlitBargeBoat(t, scheme?, opts?)`

Local frame: **+z is the bow, y = 0 is the hull bottom**, so the caller drops it on the water surface with a 0.03 draught (`f.p + up·(−0.03)`).

* **Built the way a punt is built: VERTICAL SIDES on a flat bottom.** The hull wall is an `ExtrudeGeometry` of the PLAN OUTLINE with the interior as a real **HOLE** — an extruded shape-with-hole is a hollow tube, open top and bottom, which is exactly a hull wall and, unlike a lofted shell, cannot leave a seam. The bottom is a second, thinner extrusion of the inner plan; the **gunwale is one tube swept along the outer plan**, so the rim reads rounded from every angle (a box rim reads as a picture frame). Half-beam `hwOf(z)` stays full amidststream and tapers LATE to a squared **swim end** at each extremity, clamped at 0.085 so the ends are blunt like a real punt.
* Length **2.30**, beam **0.84** in a swept trough 0.90 wide — 0.03 of clearance each side, the way a flume boat sits.
* External ribs and a **rubbing strake chorded to the taper** (short chords, not one straight plank), raked stem/stern plates with post heads, mooring rings, and the glade's own motif carved on the prow: a **FERN SPIRAL** with two small leaves.
* **Interior:** sole boards, **two benches at z ±0.62** → **four seats** at x ±0.185 (a 2 × 2, spread far enough apart that the hull does not read half-empty), a coil of rope and a punt pole lashed along the side.
* **THE LANTERN HOOP** is the signature: two iron ribs across the beam at z ±1.02, a ridge spar joining their crowns at **y 0.90**, and **three lanterns hanging down the centre line** at y ≈ 0.70 (globe r 0.045-0.052).
  **PROBED (`aud-tw-hoop.tsx`), and the earlier wording was wrong.** A seated 0.5-scale rider's head tops out at **0.576** boat-local, and the three globes sit at `(0, 0.70, −1.02)`, `(0, 0.68, 0)` and `(0, 0.70, 1.02)` — i.e. one in the aisle BETWEEN THE TWO BENCHES and one outboard of each, *not* between the two riders of a bench (that gap is only 0.13 u and could not hold a globe). Worst 3-D box gap from any globe to any rider: **0.283 / 0.497 / 0.286** — nothing comes near a face, and the reason is better than the one that was written down.
* Seat anchors are parented into the hull at `SEAT_TOP − HIP_RISE` where `HIP_RISE = 0.45 × 0.5` — the fleet's seated-peep number at the **GameManager's own 0.5 guest scale**, so a real rider and a decorative one sit at exactly the same height.

## THE BROKEN ARCH — `buildRuinArch(t, opts?)`

Exported so a park can dress its own glade waterway. Local frame: **+x is ACROSS the channel** (the piers stand at ±1.06, clear of the 0.45 half-width channel and its trough walls), +z is the channel direction, and **y = 0 is the CHANNEL RAIL** — so the caller hangs it straight off a spline frame with no extra arithmetic. Springing **+0.55**, inner crown **+1.45**; the underside at |x| = 0.45 is **1.33**, against a barge whose lantern hoop tops out 0.93 over the water and a seated rider's head at 0.66.

* Piers of stacked blocks hashed in size and yaw, footing buried 0.62, with an impost course the ring springs from.
* **A real RING of 13 voussoirs on a real circle** with a keystone wedged proud of it — and one voussoir **MISSING** (a fern grows out of the gap it left; the stone itself lies on the bank beside the pier), with the extrados course **snapped off down one haunch**. An intact arch in a ruin is a gate.
* **`makeRotationZ(-a)`, not `a − π/2`.** A voussoir's long axis has to lie along the ring's TANGENT — that is what makes its joints radial. The tangent at angle `a` is `(sin a, cos a)` and a Z rotation by θ sends the box's own +Y to `(−sin θ, cos θ)`, so **θ = −a**. The first pass used `a − π/2`, 90° out: every stone pointed along its own radius and the "arch" rendered as a scatter of slabs standing on end with no ring in it at all. It took a render to see and one line to fix.
* Moss on every horizontal, ivy down both haunches (`buildIvyStrand`, shared from WyrmsHollow), and an iron **bracket lantern** reaching out over the water off the near pier. `userData.lampAt` is where the caller hangs a real PointLight; `userData.crownY` is the inner crown height.

## The glade

* **THE BANK: the ride brings its own ground.** The flume profile stands the trough on trestles 0.60 above the ground, but a glade canal is CUT INTO the earth — so the ride lays overlapping loam / moss / stone plates (STEP 0.95, hashed size and yaw) that **RISE toward the channel**, which both hides the trestles and makes the water read as sunk between banks.
  ⚠️ **AND ITS FOUR TONES MUST CLUMP.** Picking between four tones with four independent per-cell hashes on a 0.95-u lattice is *uniformly random*, and uniformly random on a lattice is exactly what the eye reads as a **CHEQUER BOARD** from the park's ~50° camera — the same defect `ThornwickGlade`'s court and forest floor both had. A smooth low-frequency field carries the choice now and the hash only ragged-edges it (and the yaw scatter is opened from ±0.35 to ±0.65 rad), so the bank reads as DRIFTS of leaf litter with moss and old stone breaking through. **Grade a lattice dither by its ADJACENT-DIFFER fraction, not by its share table.**
  ⚠️ **`LOAM` is OLIVE (0x4b4632), not warm brown (0x4a3c2c).** Against `THORNWICK.mossDeep` the old tone was the SAME VALUE (luma 62 vs 71 — a fifth of a stop, which is why it passed review) but sat at the OPPOSITE HUE at equal saturation (32° orange vs 92° green), and over a bank this wide maximum hue contrast reads exactly like maximum value contrast. Measured in `ThornwickGlade`'s own render, pulling the litter to olive took the worst hue gap between major ground tones from **56° to 16°**. The land holds these two tones in common with this ride, so they move together. The **+z front is cut off at z 1.7** (`FRONT_CUT`), so the ride's own local +z face stays clear ground for the queue lane, the huts and the street.
* **ONE settling function.** `bankY(x, z)` is the walkable top of the bank at a point, and **every single thing planted on it** — trees, toadstools, ferns, boulders, lantern posts, the ruined wall, the plinths, the fallen voussoir — is settled with it. Nothing floats and nothing sinks on any compiled layout or any graded terrain.
* **THE REVETMENT** is what makes the channel read as a built canal rather than a flume in a field: a run of hashed masonry blocks at ±0.66 off the centreline, topped at rail level with a moss course hanging into the water.
  ⚠️ **ITS TONE RUNS IN COURSES, NOT PER STONE.** A per-block `h > 0.55` roll put light and dark blocks in an even alternation the whole way round 26 u of channel, and from 50° that is not masonry — it is a **DASHED KERB**, a zebra edging round a pond (Emberfall's oxblood stripe and Brasswork's first grate bars are the same failure in other shapes). The roll is a low-frequency function of the arc parameter now, hash-ragged at the joins. The moss course went the same way: `i % 3 === 0` is a hard three-block rhythm and reads as dashes of its own.
* **TWISTED TREES** (5): a trunk of tapered segments that lean and twist as they climb, root flares, spreading roots, five branches that all reach the SAME way — out over the water — and a canopy of **three smaller flattened lumps per spot** rather than two big spheres (few large spheres read as a lollipop whatever you rotate them to). Every tree stands on the **OUTBOARD** bank, so a camera from inside the loop looks in UNDER the branches instead of at a wall of leaves (DeepDrift's cave-overhang rule), and every canopy is held **1.2 above the RAIL** with `clear` solved per tree against its own footing. Trees within 0.14 of `archU` are **skipped**: the first pass planted one whose crown sat in front of the arch's crown from the only camera that can look down the reach at it, and the arch simply vanished behind a tree.
* **TOADSTOOLS**: clusters of 4-7 with leaning tapered stipes, real **DOME** caps (a sphere cap, never a cone — a cone reads as a traffic bollard), gills under the wide ones, hashed white spots, in a muted deep red and a dusk violet. One cap per cluster is **emissive**, so a fairy ring lights up after dark without costing a PointLight.
* **GLOW-WORMS**: little emissive grains scattered round whatever landed on the bank. Their **BASE colour is a dull grey-green, not the glow colour** — a lit-colour diffuse made every grain read as a white speck of litter across the whole bank by day. The glow is entirely emissive: damp specks at noon, the ride's ground-level light after dark.
* **THE WATER is RE-TINTED, not re-shadered.** `buildWaterRibbon` ships the lagoon blue-grey the seaside worlds use, and against moss and violet stone it read as a swimming pool cut through a forest. The material exposes its three ramp colours as uniforms, so the glade writes its own into them (`uShallow 0x4e5f4a`, `uMid 0x2b3a30`, `uDeep 0x18231c`) over a **dark liner strip** on the trough floor — a dark bottom is what makes water read as bottomless, the inverse of the tide-pool rule. Everything else (the swell octaves, the night dim, the fog sync) is the kit's, unchanged. amp 0.06 × waviness 0.22 ≈ 0.013 of swell: a sheltered channel on a windless night.
* **The landing stage:** a plank deck on piles with a shingled saddle roof on carved brackets and a moss course along its ridge, a guard rail on the OUTER edge only (the channel side stays open — that is where the barge comes alongside), three steps down to the bank, mooring bollards with a sagging rope loop, a notice board, crates of spare lamp glass, and the **ferryman's kit** (spare punt poles leaning in the corner, a hooped lamp-oil barrel). There is deliberately **no second barge**: a spare hull cannot lie in the channel (that is where the live one parks when the motion gate closes) and hauled out on the bank it read as a second live boat adrift inside the loop.

## Sim wiring (verified headlessly)

`node mb-sim.mjs` — a compile-and-run probe, no browser:

| check | result |
| --- | --- |
| track | `ok=true fatal=false clearance=1.56 closed=true synthesized=[] warnings=[]` |
| lap vs registration | **15.046 s** against `rideDuration: 15` |
| `seatWorld` | **4 / 4 DISTINCT** anchors, all 0.647 from the barge origin — real GameManager guests ride the benches |
| motion gate | parked drift **0.0000** through `waitingForPassengers`; **6.12 u** of travel on `departing` (`spinDown: 1.6`) |
| determinism | two independent builds agree on all four seats to 1e-9 |
| FATAL guard | a runaway layout → `invalid=true`, `fatal=true` ("the synthesized closure is 30.1 u — 127 % of the 23.7 u authored"), so a broken circuit never registers |

Decorative riders default **true** standalone / **false when registered**, so empty benches read visibly empty. The barge, the motion gate and the drift are wrapped in `createMotionGate`; **the WATER, the MIST, the GLOW-WORMS and every LANTERN are NOT gated** — they run off the real clock outside the gate, so a parked barge is not a frozen glade. Un-registered previews are byte-identical: the gate starts ungated until the first `onStateChange`.

**Park layout:** queue HEAD **2.1** out the local +z front, exit hut at local **[1.9, 2.1]**, boarding at `BOARD` = **[−1.3, 0.6, 0]** (mid-station, alongside the deck — a module constant, because §13's station lock has to park the hull on the same point the composable hands the GameManager). Defaults: name "The Moonlit Barge", capacity **4**, rideDuration **13.7** (NOT the 15.05 s lap — see "the cycle"), intensity **1** (there is nothing to be frightened of), price 3. The ride's own footprint spans **13.7 × 11.3** with the bank, which is over `<ConfigurableRide>`'s 10-unit `bodySpan` gate — so no body blocker and no auto-clearance is derived, and the layout numbers above hold exactly as written.

## Budgets (measured headlessly)

**346 meshes / 67,147 tris** built (402 / 78,291 with the previews' staging), **4 PointLights**, **2 ParticleKit emitters / 220 particles** (120 additive motes drifting up off the water, 100 of low non-additive mist lying on it — mist has to occlude), **81** objects tagged `userData.lodDetail`. Every static repeat batched through `mergedBoxes` / `mergedParts`. Deterministic — hashed sines only, one absolute-time updater, no `Math.random` / `Date.now`.

**The light budget.** Four PointLights and not one more, and **every one of them is night-gated**, because this is a night-forward ride and the difference between its day and night shots should be that the lanterns come ON. They are placed one per leg so the whole circuit is covered: the **arch's bracket lantern** (added as a CHILD of the arch group at its own `lampAt`, so it follows any layout with no world-space arithmetic), the **willow-reach lantern post** (likewise a child of the post), the **landing stage's**, and the **barge's own** — the only one that moves. Every other lantern on the ride is emissive glass only. The glow-worms and the glowing toadstool caps are lerped between a day and a night value and never gate to zero (LavaTubeRun's lava rule): a glow-worm is alive at noon, it is just outshone.

## Preview circuits

- **3D rig — The Lantern Round (LEAD, night)** — the whole glade from the stage-side diagonal: the level loop, the arch, the trees, the hollow, the landing stage.
- **The broken arch (close)** — camera threaded **21° off the channel axis** so it looks nearly straight down the far reach and THROUGH the arch's opening, with `phase0={8.19} still` freezing the barge exactly under it. The arch is published at ride-local `[−1.13, 0.6, −6.05]`, i.e. world `[0.07, 0.6, −2.85]` at the previews' mount.
- **The landing stage + the barge alongside (close)** — `phase0={0.74} still` puts the barge on the ride's own `board` point.
- **The barge (close)** — `buildMoonlitBargeBoat` staged through the preview's `dress` hook in a short length of the ride's own channel, at the exact heights the flooded profile sweeps it.
- **The ruin arch (close, standalone)** — `buildRuinArch` on its own at `y = 0.6` (local y = 0 IS the rail).
- **Track pieces — The Long Reach** — a longer, rounder LEVEL circuit through JSX piece children (28.31 u of arc, worst clearance 1.70, footprint 9.70 × 6.10, level 0.000, zero synthesized closure; it laps in 16.2 s).

Every preview runs `ground={false}` with a **glade floor** disc of leaf litter and moss patches instead: the ride lays its own bank but stops at the rim, and against bare `<ScenePreview>` grass that rim read as a berm on a lawn.

## Screenshot verdicts

* **Lead, day** — reads as one place: the level channel sunk between stone-revetted mossy banks, the arch across the far reach, five twisted trees leaning over the water, the toadstool hollow, the roofed landing stage with the barge alongside.
* **Lead, night (`--nightwait=15000`)** — warm pools under the stage roof, the arch lantern and the barge's three hanging lanterns; glow-worms sparkle right across both banks and the toadstool rings light up. The difference from the day shot is that the lanterns come ON.
* **Alternate angle (70° orbit)** — the far reach and the arch head-on with the hollow in front of it.
* **The arch, night — THE HERO SHOT.** The barge, its four riders and its three lit lanterns drifting under the lamp-lit ruin arch, glowing toadstools on both banks, glow-worms in the grass, the next lantern post away down the reach.
* **The barge (close)** — the punt hull, the swept gunwale, the two benches of two with real riders, the lantern hoop, the fern-spiral prow.

Built with three.js on the shared Stage; the channel is the RCT2 water-ride sprite's trough, the hull a Thames punt, and the palette Thornwick Glade's own (`THORNWICK`, imported from `components/WyrmsHollow`).

---

## Audit — 2026-07-25, 100/100

| Dimension | Score | Notes |
|---|---|---|
| Mesh richness & count | 15/15 | **454 meshes / 88 291 tris** built with riders (hull alone **84 / 15 688**, the ruin arch **16 / 2 136**), 81 `lodDetail`, every static repeat merged |
| Detail | 15/15 | tex+bump throughout; 4 night-gated PointLights one per leg, plus lerped glow-worms and glowing toadstool caps that never gate to zero. Re-tinted water (`uShallow/uMid/uDeep`) over a dark liner |
| Cohesion | 20/20 | 72-frame sweep of a 20-s window with an explicit `computeBoundingBox()`: min rider-to-rider gap **+0.061** moving / **+0.13** static; ONE `bankY` settles every planted thing. The `bladeSpec` handedness bug `ThornwickScenery` warns about is **already fixed here** (`up2 = side × dir`, determinant +1) |
| Guest comfort | 15/15 | 4/4 distinct bench anchors at (±0.185, 0.015, ±0.62); rider head tops at **0.576** boat-local against three lantern globes whose worst 3-D gap to any rider is **0.283 / 0.497 / 0.286** |
| Guest location | 15/15 | **the headline fix.** Nearest seat **0.632 u** of the boarding pad on every cycle, spread **0.001 u**, identical at dt 1/60, 1/30, 1/20, 1/10 and ±40 % jitter over 14 cycles — against **6.5 u** as shipped |
| Aesthetic | 20/20 | at a real **50°** reads as a stone-lined canal cut into a mossy wood: the arch across the far reach, willows leaning out, the toadstool hollow, the barge alongside its roofed stage. Bank chequer and dashed kerb both fixed; night is the lanterns coming ON |
| **Total** | **100/100** | |

**Probes:** `aud-tw-cycle{,2,3,4,5}.tsx`, `aud-tw-lock.tsx`, `aud-tw-facts.tsx`,
`aud-tw-hoop.tsx`, `mb-sim.mjs` (regression).
**Shots:** `shots/AB-barge-{day,night,az115,boat,arch-night}.png`, `AG-barge-el50.png`
(every one with its achieved camera pose printed — the old `--elev` silently did nothing).

Fixed this pass:
* **`rideDuration` 15 → 13.7 + the STATION LOCK** — the barge parked up to 6.5 u from its own
  stage, anywhere round the channel, every dispatch.
* **The bank's four-tone chequer** — a smooth field carries the tone now, the hash only
  ragged-edges it; yaw scatter doubled.
* **The revetment's dashed kerb** and its `i % 3` moss rhythm — both run in courses now.
* **`LOAM` / `LOAM_D` pulled to olive** — same value as the moss all along, but the opposite
  hue at equal saturation, which at bank scale reads the same as a value clash.
* **The previews' glade floor** — 260 flat 0.05-thick BOXES lying on the disc, which at 50°
  read as brown and green FLOOR TILES: `ThornwickScenery`'s own second documented bug, hiding
  in preview staging. Squashed detail-0 icosahedra, clumped six to a patch, on a mossy-olive
  disc rather than bare earth.

No reverts this pass.

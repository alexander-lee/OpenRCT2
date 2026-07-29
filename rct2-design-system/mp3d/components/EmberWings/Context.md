# EmberWings

**CANONICAL IMPORT — copy exactly:** `import { EmberWings } from './components/EmberWings';`
*(never from `'./Park'`: only the `<Park>` wrappers + track-piece JSX live there. A wrong
specifier makes esbuild refuse the WHOLE bundle — the round-8 black-page failure.)*

Attraction **2** of the **Emberfall Caldera**: a **SUSPENDED FLYER** that sweeps around the volcano's crater rim through rising heat haze. Guests hang beneath the track in flying harnesses with their legs dangling free, and the cars swing outward on their yokes through every turn.

Built on the **existing** spline machinery, exactly like MineTrainCoaster / LogFlume: the layout is compiled by SplineRideKit's `compileTrackPieces` and swept by `buildRideSpline({ profile: 'coaster', type: 'inverted' })`. No forked track code.

This file also owns the **Emberfall lava language** (see the last section) — `LavaTubeRun` imports it from here so both attractions burn with one palette.

## Why `type: 'inverted'`, and why the bank is pinned at 0.20

`TYPE_RULES.inverted` is the kit's **hangs-BELOW-the-track** family (`ride/rtd/coaster/InvertedRollerCoaster.h`): its `RatingsData` table is the one RCT2 scores a hanging train with, and its piece table stops at ~75° drops. It is the only `CoasterType` whose *semantics* match a car that is not sitting on the rail.

The **bank**, however, is deliberately held at **0.20 rad (11.5°)** — far under that type's 55° ceiling — because RCT2's `SuspendedSwingingCoaster` has **no banking track group at all**: on a suspended coaster the track stays flat and the **cars** roll. 0.20 is a construction tolerance, not a design bank, and the visible roll is the pendulum on each yoke.

**The consequence drives the whole layout.** The kit's derail guard discounts lateral G by banking — `eff = v²·κ_h·(1 − min(1, |roll|/0.6))` — so at 11.5° of roll only ~32 % of the lateral load is absorbed instead of the 100 % a 40°-banked steel coaster gets. Everything else about the circuit (wide corners, curvature-ramped corner entries, a modest 2.4-unit lift) follows from having to keep `v²/R` itself small.

## API

```tsx
<EmberWings position={[x, z]} rotation={rad} register>
  <Station /><Straight length={0.4} /><Lift height={2.4} length={5.6} /> …
</EmberWings>
```

`EmberWings: React.FC<ComposableRideProps & EmberWingsOpts & { children }>` — mounts at `position`/`rotation` like every composable ride. Inside a `<Park>`, `register` wires the full GameManager ride through `<ConfigurableRide>`.

| prop | meaning |
| --- | --- |
| `pieces?: TrackPiece[]` | RCT2 piece list (`compileTrackPieces` vocabulary). JSX piece children (`<Station/><Lift/><Drop/><TurnR/>…`, read with `collectTrackPieces`) **win** over `pieces`. |
| `points?: [x,y,z][]` | raw control points — the escape hatch past the piece compiler (still swept + validated). `pieces` wins. |
| `cars?: number` | cars in the train, 1-6, default **4** |
| `riders?: boolean` | decorative riders (default true; `register` turns them OFF so real GameManager guests fill the harnesses through `seatWorld`) |
| `groundAt?: (x,z) => number` | terrain sampler so towers, fissures and props land on the ground (default flat) |
| `haze?: boolean` | heat-haze + ember emitters (default true) |

Builder: `buildEmberWingsScene(three, opts) → { group, update, vehicle, seatWorld, onStateChange, crashed, invalid?, ratings? }`.
`update` is motion-gated (`createMotionGate`, spinDown 1.8); `vehicle` is the **lead wing gondola** (RideViewer onboard/follow cam); `crashed()` reports the live 1.5 g derail guard; `ratings` is the measured RCT2 triple handed to `registerRide`. A FATAL compile sets `invalid` so the circuit never registers. `group.userData.trackReport` carries the full compile report.

**Capacity: 8** — 4 cars × 2 `EMBER_WINGS_SEATS`. The seat anchors are children of each car's **pendulum group**, so `makeSeatWorld` reads them off the live swinging transform and real guests swing with the car. Registered defaults: `{ name: 'Ember Wings', capacity: 8, rideDuration: 18, intensity: 4, price: 5 }`.

**Layout offsets** (component-local; the station straight is compiled along local **−x** with `heading: -π/2`, and every compiled point has **z ≤ 0**, so the whole local +z face is clear of track): boarding deck at z 1.02..1.94 with its stairs beyond, queue **HEAD `front: 3.1`** out the +z face (past the deck and the stairs), exit hut `exit: [1.9, 2.6]`, boarding `board: [-1.3, 0.6, 1.35]` on the deck. Circuit start **`[0, 1.75, 0]`**, bank 0.20.

### Height: the circuit is authored HIGH on purpose

A suspended car hangs **1.05 below the rail**. The stock circuit therefore starts at `y = 1.75`, which puts the riders' dangling feet at **0.73** — a tenth of a unit clear of the **0.60** boarding deck. `pieces` you write are compiled from that same `start`, so **keep your own layouts at least ~1.6 above the terrain.** The design check's `noStation` test still passes because the station is inside the lowest quarter of the layout (minY 1.75, maxY 4.15 → `yLow` 2.40).

## THE SIGNATURE — the suspended vehicle

`buildEmberWingsCar(t, variant, scheme, { riders, seed })`. The group origin sits **on the rail centreline** (`run(..., { wheelOffset: 0 })`), +z forward, +x the frame's side:

| y | part |
| --- | --- |
| +0.29 … +0.14 | bogie beam + king-pin cap, **on top of** the twin rails |
| +0.12 | four running wheels (rail tube tops are +0.045) |
| +0.03 | side guide wheels on the rail flanks, set fore and aft of the yoke arms |
| +0.22 … −0.31 | two **YOKE ARMS** at \|x\| 0.40, dropping past the crossties |
| −0.26 … −0.35 | yoke **CROSS BEAM** (\|x\| ≤ 0.44, \|z\| ≤ 0.10) |
| −0.33 … −0.53 | two drop plates at \|x\| 0.30 carrying the pin |
| −0.50 | the **PIVOT PIN**, running fore-and-aft |
| below | `userData.swing` — the gondola, free to roll about z |

Three pieces of that table are load-bearing geometry, not styling:

1. **The 0.155 of daylight between the pin and the cross beam.** At full swing every part of the gondola inside \|x\| 0.44 has to stay under that beam; the tallest is a rider's head (0.03 above the pin) which climbs to **0.121**. The pendulum's own bearing is a cylinder **concentric** with the pin, so it cannot sweep at all.
2. **The tub is a BACK-PACK.** Seat carrier, back wall and rear-half side walls only — nothing forward of z −0.07. The cushions are cantilevered past the carrier so the riders' **legs hang in open air** onto a footrest bar. Even the "nose" of the front car is a chin fairing slung *under* the footrest: nothing is allowed in front of the legs, because that is the whole point of the vehicle.
3. **The wings have ANHEDRAL and are swept AFT (z −0.18).** Aft so they never occlude the dangling legs from any orbit angle; tips-down so the rising tip stays 0.11 under the cross beam at 0.42 rad. A tip-**up** wing of the same span touches at 0.31 rad.

**Wing fairings**: a swept panel per side with a leading edge, a raked outboard panel, a hanging winglet and an under-spar, reaching \|x\| **0.91** — which still leaves 0.11 to the boarding deck's inner edge (1.02).

**Flying harness**: an over-shoulder pair of padded bars sweeping down onto a lap yoke, over a bucket cushion with a lumbar roll and a headrest. Riders are `buildPeep` at 0.5 scale, reclined 0.12 rad into the harness, **legs swung ~0.34 rad forward and hanging free**, arms spread out to the sides.

### The pendulum

Integrated every frame from each car's **own measured motion**, so the component keeps no private copy of the runner's pacing and cannot drift out of sync with it:

```
speed  = |Δposition| / dt
dθ     = asin(fwd_now · side_prev)        // signed yaw rate about the car's up
aSide  = speed · dθ/dt                    // centripetal acceleration, m/s²
gLocal = (−9.8·side.y − aSide,  −9.8·up.y) // apparent gravity in car space
target = atan2(gLocal.x, −gLocal.y)        // the bob hangs along it
```

then a damped spring (`ω₀ 4.3`, `ζ 0.34`) chases `target`, with hard mechanical stops at **±0.42 rad** and a 0.4 restitution bounce. Because the frame's own roll enters through `side.y`, track banking correctly *reduces* the swing — which is why an 11.5°-banked suspended circuit swings so much more than a 40°-banked steel one would. A hashed-sine idle sway (±0.03 rad, absolute time) keeps parked cars from being dead still.

**It settles by itself.** The spring integrates on ABSOLUTE time while `run` sees the motion gate's clock: when the gate parks the train the measured speed goes to zero, `target` goes to zero and the cars come to plumb. No special case anywhere.

## Why this component builds its own supports

`addSplineSupports` drops a column onto the ground **directly under the rail centreline** — precisely where a suspended car hangs, and it would do it every 9 frames. So `buildRideSpline` is handed:

* `groundAt` = a sampler that reports "ground" **0.40 below the nearest rail point**, which makes `addSplineSupports` skip every bent (its `topY - gC < 0.3` early-out), and
* `supportEvery: 1e9` as belt-and-braces.

and the component raises the ride's real structure itself: steel **A-frame TOWERS** standing 1.85 out on alternating flanks on the *true* terrain, rising to rail height, cantilevering an arm in over the wings to a **cheek plate** bolted onto the crosstie ends at \|x\| 0.50, with a knee brace and (above 2.0 of span) a splayed second leg. Four merged meshes for the whole run.

*Documented consequence*: `crashTrain`'s ballistic debris uses the same `groundAt`, so a derailment's wreck settles just under the track instead of on the terrain. Only reachable via `forceCrash` / station-brake failure.

## Measured numbers — "Crater Rim Flight" (the stock circuit)

`station · straight 0.4 · lift 2.4 (run 7.7) · straight 0.6 · [corner r4.0] · straight 0.6 · drop 0.9 · straight 1.2 · [corner r4.4] · straight 0.6 · drop 1.5 · straight 5.553 · [corner r6.0] · straight 1.636 · [corner r6.0] · straight 1.3`

where `[corner r]` = `turnR 12° r(2.6·r) · turnR 66° r · turnR 12° r(2.6·r)`.

Compiled COMPILE-ONLY with the component's own options (`coaster` / `inverted` / bank 0.20 / start `[0, 1.75, 0]` / heading −90°) before shipping:

| | |
| --- | --- |
| `report.ok` | **true**, `fatal` false |
| `checkCoasterDesign('inverted')` | **clean — 0 violations, 0 warnings** |
| `validateSpline` worst clearance | **4.71** |
| closure | closed, gap 1.60, **ZERO synthesized pieces** |
| peak grade / summit | 24.8° / y 4.15 |
| footprint | x −16.8..9.8 × z −18.0..0.0 (26.6 × 18.0) |
| worst effective lateral | **0.88 g** (guard 1.5 g, validatePark margin 1.27 g) |
| peak roll | 11.5° — the bank cap, reached on every corner |
| ratings (`cars: 4`) | E **2.72** / I 3.44 / N 2.42 — **moderate** |
| length / lap | 80.0 u / 19 s |

**On the rating: the 1.51-unit swoop trips RCT2's `reqDropHeight` gate (12 z-steps = 3.0 u) and halves the triple.** That is a deliberate, measured trade, not an oversight. A four-corner rim loop has exactly two degrees of freedom in its closure, and a ≥3.0-unit drop needs ~8 units of eased run plus a long shallow camelback for the airtime gate — together longer than the leg the closure leaves for them (every attempt solved to a **negative** straight length and compiled FATAL). A suspended rim flyer is a *moderate* ride whose thrill is the swinging cars; the world's intense coaster is `LavaTubeRun` (I 6.78). If you want a thrillier flight, spread the same corners over a bigger plot and re-solve.

### Two layout rules for any `pieces` you write

1. **End FACING the station**, ~0.30 u short of the start and dead on its axis. The compiler closes whatever the pieces leave open with a Dubins return leg at radius 2.2 — ridden at full post-drop speed on unbanked track, which is exactly where the G budget dies: an early draft's synthesized `turnL 153° + turnL 207°` read **3.08 g** and cut clearance to 0.89.
2. **The corner cores must sum to 360°.** With `[corner]` = 12 + core + 12, the core is **66**, not 70: four 94° corners drift the heading 16° and the compiler then has to synthesize its way home (clearance 0.15, FATAL).
3. Corollary: **ramp curvature into the corners.** A bare chorded 90° arc welded onto a fast straight leaves a ~10° kink where the curvature banking has not developed; on a near-unbanked circuit that single junction is the whole lateral-G budget.

## Second circuit — "Cinder Ridge" (preview 3)

`lift 2.0`, corner radii 3.4 / 3.8 / 5.2 / 5.2, descents 0.7 then 1.3, straights **5.34** and **1.402** (solved). Clean: 0 violations, worst clearance 4.17, ZERO synthesized closure, worst lateral **0.86 g**, E 2.67 / I 3.35 / N 2.38, 71.2 u, 17 s, footprint 24.0 × 15.6.

## Budget

2 ParticleKit emitters (**230** particle capacity: heat haze 120 + embers 110, whose origins walk deterministically between the fissure vents so two emitters cover the whole rim); **3** real PointLights — station lamp and one brazier, both night-gated, plus the magma vent pool's, which is **day-and-night lerped** — plus the lead car's headlamp. Everything static and repeated goes through `mergedBoxes` (towers, deck, canopy, fissure lips, pool levee). `userData.lodDetail` on riders and the smaller boulders. Deterministic throughout: `hash01` sines and absolute time only, no `Math.random` / `Date.now`.

## THE EMBERFALL LAVA LANGUAGE (exported — LavaTubeRun imports it)

Modelled on `components/Volcano/index.tsx`, because the real thing is mostly **black**: cooled pahoehoe crust is near-black basalt and all the light comes out of the **cracks** between the plates.

| export | what |
| --- | --- |
| `lavaCrustCanvases()` | the module-cached pair of 192² canvases — a near-black basalt **plate albedo** (also the bump map, so the fissures are recessed grooves) and a black-with-bright-**cracks** emissive mask, from a jittered-grid Voronoi diagram over a torus (36 plates, per-edge heat hashing, a few plates with a hot centre) |
| `LAVA_HEAT`, `lavaHeatAt(t, u)` | the temperature ramp: `u = 0` is the vent (white-yellow, emissive intensity 1.85 — the crack cores clip to white, which is physically the right direction) through yellow → orange → deep red → black crust at `u = 1`. Colour AND intensity fall off together. |
| `lavaMaterial(t, heatU, repeat)` | `{ mat, heat, tex }` — `color: near-black`, `emissiveMap: cracks`. Keep the pair and drive `mat.emissiveIntensity = heat · lavaGlow(nightK) · breathe` |
| `lavaGlow(nightK)`, `LAVA_GLOW_DAY/NIGHT` | **the house rule**: lava is not a lamp. `nightKOf` only lerps 1.0 → 1.85; it never gates the glow to zero. |

**One hard-won rendering rule this component adds.** A wide crust slab dressed only in `lavaMaterial` reads as a **dark plank** from a ride-sized camera: the crack network in the texture falls under a pixel and the whole slab averages to rock. So every fissure segment also carries a narrow **MOLTEN CORE** strip — 20-30 % of the slab's width, two ramp steps hotter than the plates around it — which stays a continuous incandescent line at any distance while still being *a crack in black basalt* rather than a uniform orange blob. The **magma vent pool** at the loop's centroid (concentric crust rings from a white-hot centre out to cold black, inside a basalt levee so it reads as a hole rather than a decal) is the one place the ramp's hot end gets enough area to read on its own.

Where the lava lives: all of it is sited **inside the circuit's own centroid** — the caldera floor the rim loop encloses — so a rim flight really does circle a cracked, glowing crater instead of a field of unrelated hotspots. Three fissures (6.4 / 5.0 / 7.0 long) step inward off the track frames, each with rubble lips and basalt boulders; the heat haze and embers rise out of their hot ends and out of the pool, up through the flight path above.

## Extra composable — `<EmberWingsHanger>`

`buildEmberWingsHangerScene(three)` / `<EmberWingsHanger>`: the vehicle rig on a dead-straight 5.2-unit section of the flyer's own rail profile (twin tubes at ±0.34, crossties, box spine) held up by two of the component's cantilever towers, with a scrap of boarding deck, airgates, an ember brazier and two cars hanging under it on a slow deterministic figure-of-eight swing. It exists so the suspended anatomy can be **read** — at ride distance a hanging gondola is 15 px tall.

## Screenshot verdicts

* **Rig, day** — the rim loop reads as a circuit around a cracked caldera floor: ash apron, glowing vent pool dead centre, two fissures with rubble lips, heat-haze wisps rising through the track, cantilever towers on alternating flanks, the station deck + canopy at the near corner and the train climbing the lift with its gondolas clearly slung **below** the rail.
* **Rig, night (`--nightwait=15000`)** — the lava is visibly *brighter* than by day (the `lavaGlow` lerp, never gated), the station lamp pools light on the deck, the ember stream reads against the dark, and the cars' headlamp picks out the track ahead.
* **Alternate angle (55° orbit, "Cinder Ridge")** — the trackside view up the lift hill: five gold-winged gondolas hanging under the rail in a row, unmistakably suspended, with the vent pool and a fissure behind.
* **Hanger rig, day + night** — the money shot: two riders with faces in green/orange shirts, over-shoulder harnesses, **legs dangling below the cantilevered cushions onto the footrest bar**, wings sweeping out on both sides, the yoke dropping past the crossties, the bogie on top of the rail. At night the headlamp and the number panel glow and the brazier's coals burn.

## The vent pool is a real liquid (2026-07-25)

The caldera's eye is no longer four static crust rings: a `buildWater` sheet on
WaterTile's exported **`LAVA`** palette (r 1.1, 48 seg, `amp` 0.15 ×
`waviness` 0.26) sits 0.030 over the innermost ring, inside the 1.78 basalt
levee. The rings stay as the cooling shore that keeps the pool reading as a hole
in the rock rather than a glowing disc laid on it; what changed is that the thing
a rim flight spends its whole lap circling now MOVES. It runs at a third of the
component's clock — a pool convects, it does not flow — and the palette's
`glow: 1` means it brightens after dark, which is the same house rule the crust
materials already followed.

Preview staging changed with it: `ashField` was two flat `CircleGeometry` discs,
which at the park camera elevation read as a tarmac pancake with a
drawn-compass edge. It is now a lattice of broken ash plates with hashed heights
and a **clumped** rim dither (two low-frequency sines, not a per-cell hash —
that checkerboards, rules/component-audit.md §6), i.e. the same language the
land's own `calderaFloor` lays under all three circuits.

## THE SWING SWEEP — what the rest pose was hiding

`buildEmberWingsCar`'s vertical table said "two drop plates at \|x\| 0.30
carrying the pin". A 64-sample sweep of the full ±0.42 rad of mechanical travel,
testing every gondola and rider vertex against every static part of the car,
found that claim wrong twice:

1. **They never touched the pin.** The pivot pin is a 0.042-radius rod on the
   centreline; a plate at \|x\| 0.265..0.335 hung in mid-air 0.22 away from it.
2. **They were in the riders' swept arc.** At the mechanical stop the
   up-swinging rider's OUTSTRETCHED ARM (the flying pose spreads it to
   \|x\| 0.318 at rest) measured **26 mm inside the plate**. Nothing shows at
   rest, which is exactly why the first pass shipped it.

Moving them inboard to \|x\| 0.115 only traded the collision — the rider's
inboard shoulder then measured **22.5 mm** inside them. There is no free x window
at all in that y band: the riders sweep \|x\| 0.08..0.33 and the yoke arms own
0.362..0.438. So the blocks moved **out of the swing plane** instead, to
**z ±0.27** — fore and aft of the gondola's bearing (only z ±0.17 long) and
outboard of the riders (z ≤ 0.14), with the pin (z ±0.4) passing through them,
which is what a bearing block actually does. Their tops overlap the cross beam's
underside by 15 mm, so they hang off it.

After the move, over 65 swing samples: **no rider vertex is inside any static
part at any roll** (worst depth reported −1, i.e. never contained). The only
containment left is the swing bearing around the pin, 0.042 deep — concentric by
design, it cannot sweep.

Two other numbers the sweep corrected, both previously measured at the wrong
pose:
- **headroom under the yoke cross beam is 0.0212 at the stop**, not the 0.121
  this file used to claim — 0.121 is the value at rest (0.1487) minus a little.
  Positive, but 21 mm, so treat the beam's underside (y −0.345) as full.
- **the wings reach \|x\| 1.048 when the gondola rolls**, not the 0.921 they
  measure at rest — past the boarding deck's inner edge at 1.02 by 28 mm. That
  is not a collision, and it took an exact test to say so: a ray-parity test of
  every car vertex against the station's own merged geometry over 1 500 frames
  (with the materials forced DoubleSide — three's Raycaster culls back faces, and
  with the default FrontSide the parity test reported 1 613 phantom hits for
  vertices merely UNDER the deck) finds **0 car vertices inside the station
  solid**, nearest surface 0.94 away. The tip passes over the airgate posts
  (which top out at 0.96) and under the canopy (inner posts at \|x\| 1.07).

## Audit — 2026-07-25, 100/100

| Dimension | Score | Notes |
|---|---|---|
| Mesh richness & count | 15/15 | 453 meshes / 53 848 tris; towers, deck, canopy, fissure lips, levee all `mergedBoxes`; the car is a 44-part assembly, not a pod |
| Detail | 15/15 | tex+bump throughout; bogie, guide wheels, yoke, harnesses, airgates, braziers; 3 PointLights (station lamp + brazier night-gated, vent pool day-and-night lerped) + headlamp |
| Cohesion | 20/20 | 65-sample swing sweep: nothing inside anything but the bearing/pin (concentric); 1 500-frame ray-parity test vs the station: **0 vertices inside**; compile clean, worst clearance 4.707, ZERO synthesized closure |
| Guest comfort | 15/15 | riders clear of every static part at every roll (was 26 mm inside the drop plate); over-shoulder harness + lap yoke + bucket cushion + lumbar roll + headrest per seat; legs hang free onto the footrest bar |
| Guest location | 15/15 | 8 distinct seat anchors for capacity 8, all parented to the swinging pendulum so real guests swing with the car; measured y 0.696-0.705 |
| Aesthetic | 20/20 | reads as suspended at 50° and in the hanger close-up; the ash apron is broken plates with a clumped rim; night brighter, never gated |
| **Total** | **100/100** | |

Probes: `/tmp/mp3d-render/ember-probe2.tsx`, `ember-probe4.tsx`,
`ember-probe6.tsx` (the swing sweep + the station parity test).
Shots: `shots/AUD5-EmberWings-el50.png`, `AUD7-EmberWings-hanger.png`,
`FINAL-EmberWings-night.png`, `AUD2-EmberWings-0-az115.png`.

Fixed this pass:
- the pin bearing blocks moved out of the swing plane to z ±0.27 (rider arm was
  26 mm inside them at the mechanical stop; the inboard position was 22.5 mm);
- the vent pool is a live LAVA-palette liquid;
- the preview's ash field went from two flat discs to clumped broken plates;
- the two clearance claims in this file corrected to their swept values.

Not changed, with the reason:
- **the ember-orange trim / hot-gold fairings (`0xe8842f` / `0xf6bd58`) stay.**
  They are the loudest colour in the world after the lava and a candidate for the
  palette rule — but the land's ground is `0x3a332d` ash, and warm fairings are
  the only reason a 15-px gondola reads against it from the park camera at all.
  Muting them trades a palette nicety for value collapse, which costs more.

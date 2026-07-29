# GearworksExpress

**CANONICAL IMPORT — copy exactly:** `import { GearworksExpress } from './components/GearworksExpress';`
*(never from `'./Park'`: only the `<Park>` wrappers + track-piece JSX live there. A wrong
specifier makes esbuild refuse the WHOLE bundle — the round-8 black-page failure.)*

The **DARK RIDE** of the **BRASSWORK FOUNDRY**: small brass-nosed cars winding slowly through a hall of **working machinery**. Built on the **existing** spline machinery like every tracked ride in the design system — the layout is compiled by SplineRideKit's `compileTrackPieces` and swept by `buildRideSpline({ profile: 'coaster', type: 'steel' })`. No forked track code.

The palette is the world's, value for value: aged brass, oxidised copper weeping verdigris, soot-grey iron, rust, coal, gaslight — the same numbers `components/GoggleWorks` and `components/BrassworkScenery` use. **METALNESS CAUTION:** a `MeshStandardMaterial` at metalness 0.6+ with no environment map renders almost **black** in this Stage (metals are lit only by reflections). Every metal here sits in the **0.2-0.35** band and the brass reads through colour, texture and rivet detail. Nothing is gold.

## Why `type: 'steel'` at bank 0.18 and `speedScale` 0.70

`type: 'steel'` is the modern piece table (the rule set a small tracked dark ride is built with) but the **bank is pinned near flat at 0.18 rad**: a dark-ride car does not lean, and a tiny roll keeps the compiler's `bankRate` gate trivially legal on all four corners. The runner then gets `speedScale: 0.70` — 41.3 u of circuit at 0.70 is a **14.3 s lap**, which is what keeps `rideDuration` inside the **12-16 s** band the park's `sim` gate wants. (A stock 18-20 s cycle is what failed in the volcanic world.) Raise the scale and it stops being a dark ride; raise the bank and it stops being one too.

## The machinery IS the show

Two machine bays are placed **off the compiled spline**, so a custom `pieces` list gets them as well:

* **THE GEAR GALLERY** — on the longest level LOW run, **1.25** from the rail:
  * a **four-gear train** (22 / 11 / 16 / 9 teeth) on ONE circular pitch. Two spur gears mesh iff they share the pitch and their axles sit exactly `pitchR(a) + pitchR(b)` apart, so the teeth engage **by construction**; and each wheel's phase is solved from its neighbour's *live* angle every frame —
    `φB = θ + π + π/Nb − (Na/Nb)·(φA − θ)` (θ = the line of centres) — which differentiates to the gear law `ωB = −(Na/Nb)·ωA`, so the interleave can never drift.
  * a spoked **flywheel** turning at **1.25 rad/s** (a 5 s revolution: a big low-speed mill engine). Everything else is geared or belted off that ONE clock.
  * a horizontal **steam cylinder** on an exact slider-crank (`crankSlider`: rigid rod, crosshead solved on the cylinder axis) whose **piston rod really slides into the gland** (a unit cylinder scaled on y).
  * an overhead **line shaft** with pulleys, driven by flat leather **belts**. Each belt carries its **one laced splice**, and the splice travels the loop at the belt's real linear speed — that travelling joint is what makes a belt read as *running*, because Stage's canvas textures are **globally cached** (`_texCache`) and must never have their offsets scrolled.
  * three live pressure gauges on the bed, facing the riders, and a night-gated gaslight.
* **THE ENGINE BAY** — on the longest level HIGH run, **1.6** from the rail, crankshaft **0.25 below rail height**: three vertical cylinders on a **three-throw crankshaft at 120°** (2.1 rad/s, a 3 s stroke), rigid connecting rods swinging on their pins, crossheads solved on the bores, brass lagging bands, relief valves that puff. From a seat the rods are at eye level.
  * The crank chain, the rods and the bores share **one plane**. The first pass put the crank 0.24 behind the cylinders and the barrels masked the entire stroke.
* **THE PLANT**, at the circuit's centroid: a lagged copper boiler on firebrick saddles with an **open firebox on its −z face** (the side the gallery — and the isometric camera — looks at), a tall brick stack up the back trailing steam, a coal heap and shovel, and an iron column/truss **gantry**.

### It is a dark ride, and it is NOT a box

The house preference is exteriorly readable attractions, and this world's stall already learned the lesson: a full roof reads as a closed lid at the isometric camera and hides everything under it. So there are **no walls** — every machine stands in an open iron frame that reads from both faces, the gantry roof is sheeted over the **back third only**, the back "wall" is a **waist-high dado on piers** (at full height it read as one brown slab filling the middle of the build), and two riveted **pipe arches** straddle the track so the cars visibly run *through* the works.

One more render lesson baked in: the structural ironwork is `IRON_P` (0x8a8378, "cast iron catching sky"), not the theme's darker iron — at 0x615c53 under this Stage's sun the whole works collapsed into a single brown mass at park zoom.

## API

```tsx
<GearworksExpress position={[x, z]} rotation={rad} register>
  <Station /><Straight length={0.4} /><Lift height={1.0} length={4.0} /> …
</GearworksExpress>
```

`GearworksExpress: React.FC<ComposableRideProps & GearworksExpressOpts & { children }>` — mounts at `position`/`rotation` like every composable ride. Inside a `<Park>`, `register` wires the full GameManager ride through `<ConfigurableRide>`.

| prop | meaning |
| --- | --- |
| `pieces?: TrackPiece[]` | RCT2 piece list (`compileTrackPieces` vocabulary). JSX piece children (`<Station/><Straight/><Lift/><Drop/><TurnR/>…`, read with `collectTrackPieces`) **win** over `pieces`. |
| `points?: [x,y,z][]` | raw control points — the escape hatch past the piece compiler (still swept + validated). `pieces` wins. |
| `cars?: number` | cars in the train, 1-6, default **3** |
| `riders?: boolean` | decorative riders (default true; `register` turns them OFF so real GameManager guests fill the train through `seatWorld`) |
| `groundAt?: (x,z) => number` | terrain sampler so the bays, supports and plant land on the ground (default flat) |
| `galleryU?: number` | loop parameter of the GEAR GALLERY bay (default **auto** — the longest level LOW run) |
| `engineU?: number` | loop parameter of the ENGINE BAY (default **auto** — the longest level HIGH run) |
| `effects?: boolean` | steam / spark emitters (default true) |

Builder: `buildGearworksExpressScene(three, opts) → { group, update, vehicle, seatWorld, onStateChange, crashed, invalid?, ratings? }`.
`update` is motion-gated (`createMotionGate`, spinDown 1.8 — the train parks in the station while guests board, and **the whole factory winds down with it**); `vehicle` is the **lead car** (RideViewer onboard/follow cam); `crashed()` reports the live derail guard; `ratings` is the measured RCT2 triple handed to `registerRide`. A FATAL compile sets `invalid` so the circuit never registers.
`group.userData.trackReport` carries the compile report; `group.userData.gallery` / `.engine` = `{ u, at: [x,y,z], yaw }`, the bays' component-local poses (introspection, and for authors framing a shot on the machinery).

Also exported: `buildGearworksCar(t, variant, scheme, { riders })` and `GEARWORKS_CAR_SEATS` — the car is a riveted iron tub with a brass boiler nose whose wheel bottoms sit at −0.15, so the runner's `wheelOffset` 0.195 drops them onto the 0.045 rail tops and `gateCarLights` (CoasterCar) drives its headlamp unchanged.

**Capacity: 6** — 3 cars × 2 `GEARWORKS_CAR_SEATS`, read off the live car transform by `makeSeatWorld`, so **real guests ride**. Registered defaults: `{ name: 'Gearworks Express', capacity: 6, rideDuration: 14, intensity: 2, price: 4 }`.

**Layout offsets** (component-local; the station straight is compiled along local **−x** with `heading: -π/2` and every compiled point has **z ≤ 0**, so the local +z face is clear of track): queue **HEAD `front: 2.0`** out the +z face, exit hut `exit: [1.6, 1.9]`, boarding `board: [-1.3, 0.6, 0]` on the iron deck at rail level. Circuit start `[0, 0.55, 0]`, bank 0.18.

## The stock circuit — "the Gear Gallery"

A rounded rectangle: a 1.0-unit chain hoist out of the station into the gallery, a slow corner, the level **engine-bay leg** at y 1.55, a corner, the 1.0 back down through the press hall, the long low **gear-gallery straight**, and two wider low corners home. The two straights are **solved**: a four-corner circuit has exactly two degrees of freedom, and a piece list that does not END FACING THE STATION makes `compileTrackPieces` synthesize a closing piece straight through the track. The last authored piece lands **0.30 u short** of the station on its own axis.

Verified COMPILE-ONLY before shipping (`checkCoasterDesign` / `validateSpline` / `rateCoaster`, THREE first):

| | stock "Gear Gallery" | preview "Machine Shop" |
| --- | --- | --- |
| design violations | **0** | **0** |
| worst clearance | **2.39** | 2.53 |
| synthesized closure | **none** | **none** |
| peak grade | 18.1° | 18.1° |
| worst lateral | 1.16 g (guard 1.5) | 1.15 g |
| track length | **41.3 u** | 44.5 u |
| lap at `speedScale` 0.70 | **14.3 s** | 15.4 s |
| ratings | E 1.11 / I 1.03 / N 0.35 — **gentle** | E 1.11 / I 1.03 / N 0.35 |

Runtime: **405 meshes, 4 real PointLights** (firebox — day-AND-night lerped, it is a fire; gallery gaslight + station gaslight — night-gated; plus the lead car's headlamp through `gateCarLights`), **3 emitters / 186 particles** (chimney steam 90, relief-valve puffs 60, gear-mesh sparks 36). Every static repeat goes through `mergedBoxes` (gear rims and teeth, trusses, rivets, clinker) and fine detail carries `userData.lodDetail`. Deterministic throughout — hashed sines only, no `Math.random` / `Date.now`, and every updater takes ABSOLUTE time.

## Scale

Sized against the 0.5-scale park guest (≈ 0.55 u tall): car 0.9 long with a 0.435 cushion top, gears 0.6-1.5 across, hall columns 2.5, gantry 2.9, stack topping out at 3.7. Two components in this world were first modelled at ~2× and had to be rebuilt — check a gear against a guest, not against the track.

## Placing it in a park

Give the +z face a street: the queue lane runs out of it. The machinery faces **outward from the loop interior** on the low and high legs, so if you want the works to face a path or the camera, turn the ride — the previews mount it `rotation={Math.PI}`, which puts both machine fronts on the +z / +x side (the faces the isometric camera sees). A custom circuit wants **one long flat straight** and **one long high one**; without them both bays fall back to the best available run and may overhang a corner.

## Audit — 2026-07-25, 100/100

| Dimension | Score | Notes |
|---|---|---|
| Mesh richness & count | 15/15 | **405 meshes / 49 008 tris** with decorative riders, **327 / 34 368** registered; 21 `lodDetail`; gear rims/teeth, trusses, rivets and clinker all through `mergedBoxes`; determinism MATCH over two builds driven 16 s |
| Detail | 15/15 | tex+bump throughout; the mechanism IS the show (four-gear train, flywheel, slider-crank, line shaft + belts, 3-throw crank at 120°, plant, gantry); 4 real PointLights (firebox lit day AND night, gallery + station gaslights night-gated, car headlamp via `gateCarLights`), 3 emitters / 186 particles |
| Cohesion | 20/20 | `trackReport` on the shipped circuit: design **0 violations**, worst clearance **2.3888**, closure closed with **0 synthesized** pieces; 24-phase lap sweep with `computeBoundingBox()` before every `Box3` read finds no rider-vs-part clip beyond cushion contact |
| Guest comfort | 15/15 | **6/6 distinct** seat anchors, min separation 0.420; measured on one car — hips **15 mm** into the 70-mm cushion (the documented settle), thighs land **3 mm clear** of the tub floor top (0.380), shoes **6.2 mm** into a 160-mm floor plate; lap bar clear of the torso |
| Guest location | 15/15 | **the pass's real fix** — see below. The train now parks **1.012–1.228 u** from `board` on all 7 FSM cycles (spread 0.216) at station rail height y 0.75, where it used to walk out to 11.2 u and 1.14 u up the high leg |
| Aesthetic | 20/20 | reads as an open, roofless machine hall with a track running through it from the real 50° park camera (`shots/aud/GX2-rig-e50.png`, `[harness] camera … "el":50`); night is the firebox, the gallery gaslight and the lead car's headlamp against a dark yard |
| **Total** | **100/100** | |

Probes: `/tmp/mp3d-render/aud-brass-facts.tsx` (census + 7-cycle FSM boarding position),
`aud-brass-geom.tsx` (ungated lap, metalness census), `aud-brass-gate.tsx` (gate surplus),
`aud-brass-clip.tsx` (exact-primitive rider clip), `aud-brass-seats.tsx`, `aud-gxcar.tsx`.
Shots: `shots/aud/GX2-rig-{day,e50,a115,night}.png`, `GX2-gallery.png`, `GX-engine.png`, `GX-shop.png`.

### Fixed this pass: the lap and the cycle disagreed, so the train boarded guests mid-circuit

`SPEED_SCALE` 0.70 was tuned to `rideDuration`, not to the cycle. `createMotionGate` stops the
runner's clock wherever the train is, so the mismatch accumulated. Driven through the real state
sequence (`rideFsm.ts:124-195`) at 1/60 s:

| cycle | 1 | 2 | 3 | 4 | 5 | 6 | 7 |
|---|---|---|---|---|---|---|---|
| u from `board`, BEFORE | 1.48 | 6.00 | 9.04 | 10.28 | **11.24** | 9.38 | 7.45 |
| u from `board`, AFTER | 1.21 | 1.22 | 1.23 | 1.17 | 1.12 | 1.06 | 1.01 |

At cycle 5 the guests loaded at 1.74 u — a metre above the station deck, on the far corner of the
loop. The station was decorative. (1.2 u is *correct*, not residual error: with 3 cars at 1.15
spacing the boarding pad at x −1.3 serves the MIDDLE car, so the lead car sits ~1.2 u past it.)

The arithmetic is Reef Racer's, re-measured for this gate. `spinDown` here is **1.8**, and one FSM
cycle hands the runner **15.326 s** of clock for `rideDuration` 14 — a surplus of **1.326 s**
(`aud-brass-gate.tsx` reproduces Reef Racer's published 1.291 for spinDown 1.6 as its control). The
scale had to be **solved** rather than divided, because this kit's pace is not exactly `1/scale`:
measured 0.7000 → 13.925 s and 0.63601 → 15.200 s, fitting `lap = 8.871/scale + 1.252`.
**`SPEED_SCALE` 0.6303 gives a measured lap of 15.333 s against a 15.326 s target — a 7 ms miss.**

`rideDuration` was deliberately left at 14. The Brasswork Foundry's acceptance window is
`max(60, 2.5·maxDur + 20)` sitting on its **60-s floor** with all three cycles at 13-14 s, so
raising a registration would move the whole land's window. Bring the LAP to the cycle.

Side effect, and an acceptable one: the train is now ~10 % slower (mean 2.70 u/s over 41.4 u).
A dark ride is supposed to crawl; the ratings triple is unchanged because it is computed from the
compiled geometry, not the pace.

### The one number that is NOT in this component's 0.2-0.35 band, and why it is not a deduction

The material census finds **39 meshes at metalness 0.60-0.80**: two `TubeGeometry` rails at 0.80,
one spine tube at 0.70 and 36 support-post cylinders at 0.60. **Every one of them comes from the
shared `TrackKit`** (`TrackKit/index.tsx:230, 305`) and from `SplineRideKit`'s rail tubes — not from
this file, which is clean at ≤ 0.35. They were checked in the render rather than assumed: the rails
read as **pale grey tubes** (`shots/aud/GX2-gallery.png`), because `mat()` bakes the tone into the
canvas and leaves the colour white, so the map still carries the value. If the fleet ever wants
those in band it is a one-line change in `TrackKit`, and it affects every tracked ride at once.

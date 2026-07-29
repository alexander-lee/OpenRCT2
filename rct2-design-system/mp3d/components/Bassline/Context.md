# Bassline

**CANONICAL IMPORT — copy exactly:** `import { Bassline } from './components/Bassline';`
*(never from `'./Park'`: only the `<Park>` wrappers + track-piece JSX live there. A wrong
specifier makes esbuild refuse the WHOLE bundle.)*

The **PULSE DISTRICT**'s neon **coaster**. A compact steel circuit that spends most of its lap inside **pulsing light tunnels** — gloss-black open-topped bores lined with neon hoops that chase on the district's beat and *flare* as the train punches through them — with free-standing hoop gates strung along the open track between them. The station is a club front: gloss platform, slatted steel canopy with a neon lip, speaker stacks, control cabin and the BASSLINE marquee.

Companion pieces: **`components/Discotron`** (the district's gyro spinner — same beat, same `PULSE_PALETTE`), **`components/DanceFloor`** (the centrepiece the beat comes from), **`components/NeonSign`** (the marquee is a real `buildNeonSign`).

## Built on the shared spline machinery

Exactly like every other tracked ride in the fleet:

1. `compileTrackPieces(pieces, { profile: 'coaster', type: 'steel', bank: 0.24, start: [0, 0.55, 0], heading: −π/2 })` walks the piece list and closes the circuit;
2. `buildRideSpline(t, points, { profile: 'coaster', type: 'steel', bank: 0.24, groundAt, colours, vehicleSchemes })` sweeps the track, supports and physics;
3. `computeSplineFrames(t, points, { bank: 0.24 })` — the **same** bank — re-samples the frames the hoops and tunnels are placed on, so every ring sits exactly on the rails.

`pieces` / piece children (`<Station/><Lift/><HelixR/>…`, children win via `collectTrackPieces`) or a raw `points` array replace the default. The compiled report is attached at `group.userData.trackReport`; a FATAL compile sets `invalid: true` and `<ConfigurableRide>` never registers it.

## The default circuit — "Sub Bass Circuit"

```
station                                  2.6
straight 0.6
lift    height 1.6  length 7.82          chain lift
straight 0.8                             level crest
helixR  180° radius 3.4 height −1.0      DESCENDING BANKED turnaround
straight 1.4                             tunnel entry
drop    height 0.6  length 3.94          the plunge into the long tunnel
straight 6.38                            TUNNEL — the long low straight
straight 1.6                             tunnel exit
turnR   180° radius 3.4                  bottom turnaround
straight 1.2                             brake tail, on the station axis
```

**Measured with a COMPILE-ONLY probe** (never a render — the fast loop the fleet's spline lessons prescribe): closed with **ZERO synthesized pieces**, `design.ok`, worst clearance **2.91**, worst effective lateral **1.10 g** (the crash gate's margin is 1.27), vertical **+2.68 / −0.27 g**, **48.3 u** lap, extent **20.1 × 6.8 u**, crest 2.15 u, E 2.30 / I 2.36 / N 0.78. The whole loop hangs off local −z (`zmax 0.0`), so the local **+z face is clear** for the queue lane and huts.

**The LAP IS 12.742 s, not the 12.9 s this file used to claim** — measured by running the rig ungated and watching for the lead seat anchor to come back (`/tmp/mp3d-render/aud-pd-cycle.tsx`, dt 1/120, closest approach 0.392 u). The difference is small and it mattered: see the STATION LOCK below.

Three things that cost real iterations and are worth keeping:

* **A piece list must END FACING THE STATION** or the compiler synthesizes a closing U-turn straight through the track. The arithmetic that works for an out-and-back oval: two 180° turns of the same radius cancel in x, so **leg B = leg A + 1.5 u** and the list finishes with a **1.2 u brake tail** on the station axis, landing 0.3 u short of the start (a residual under 0.5 u synthesizes nothing). Ending mid-curve instead earns a *"lands on the station from a curve"* warning.
* **`lift` / `drop` runs AUTO-EXTEND.** `rampPoints` holds the pitch-rate rule at ~0.5 rad/unit, which forces its transition length `b = π·g`, so the real advance is `max(run, 2·a + 2·b + mid)` — a modest **1.6 u lift eats 7.82 u** of ground, and a 2.2 u lift asked for over 4.4 u actually advances 7.70. Plan closure against the REAL advance; the piece `length`s above are written as their settled values so the arithmetic in the comments is checkable. (`hill` is the same trick: its run is `max(L, 3.6, 6.3·√h)`.)
* **A 360° helix costs the cursor nothing** — it returns to the same point and heading — so it is the one element that buys length and height without moving the layout. It is not used in the shipped circuit (it pushed the lap to ~18 s, outside the sim budget) but it is the tool to reach for when a custom circuit needs more ride in the same footprint. Its `height` must be ≥ ~0.95 or its own entry and exit passes fail the clearance check.
* The elevated turnaround is a **descending banked helix, not a flat turn**: identical cursor cost, one extra drop.

## The light tunnels

**Auto-placed, not hardcoded.** The frames are scanned for runs that are both straight in plan (`bend < 0.004` over a ±3-frame window) and near-level (`|fwd.y| < 0.3`), outside the station and brake tail; adjacent spans separated by ≤3 frames are stitched (one kinked frame used to split a run in two), and the **two longest** become tunnels. On the stock circuit that is the 11.9-u drop-and-straight run and the 6-u chain-lift climb — so a custom circuit gets its own tunnels for free.

Each tunnel is built from `openRibbon`, a local **open** quad-strip sweep. SplineRideKit's own `ribbon` closes the loop (`frames[i % n]`), which is right for a full-circuit trough and wrong for a sub-range: it welds the tunnel's last rib back to its first and drags one enormous quad across the park.

**The tunnels are OPEN-TOPPED, and that is load-bearing.** The first cut roofed them solid and the night hero shot came back with two black voids exactly where the ride's whole idea was: from a park camera you cannot see into a closed bore. Now:

| part | detail |
| --- | --- |
| valance walls | gloss-black, `±TUN_W` 1.02, only `TUN_H` 0.62 tall — deliberately BELOW the train, so the cars and their riders show above them; the hoop crowns stand **0.58 proud** of them |
| roof ribs | graphite bars every 5 frames, cantilevered in from each wall top and **stopping at `RIB_IN` 0.36** so a 0.72-u slot runs down the bore for the train (batched) |
| wall-top caps | a graphite capping strip down each wall top |
| portal fascias | a taller frame round each mouth so the bore reads as a portal (batched); header bottom 1.27 above the rail |
| neon strips | one down each wall base INSIDE the bore, one along each wall top OUTSIDE it, so the tunnel glows from the park side too |
| haze | one 60-particle additive emitter per tunnel (120/300) so the hoop light has something to bite on |

**Hoops.** A half-torus (`TorusGeometry(HOOP_R, 0.07, 6, 20, π)`) laid in the frame's side/up plane at `basisOf(f, HOOP_Y)`, plus two batched struts down past the rail onto the tie line so nothing floats. Inside a tunnel: one every 4 frames (~0.6 u), each **numbered** so it can chase. Outside: free-standing gates every ~4.5 u, never within 6 frames of a mouth. Each hoop owns its material (that is the price of a per-hoop chase and flare).

### ⚠️ THE TRAIN DID NOT FIT THE BORE — the audit's biggest find

This file used to say *"bore radius 0.9 clears the train (half-width 0.33, roof 0.72 over the rails)"*, with the arch laid at `basisOf(f, −0.1)`. **Both halves of that sentence were wrong**, and the two errors compounded:

* the roof figure was measured in the **car's own frame**, but `run()` seats each car `wheelOffset` **0.195 ABOVE** the frame point, and
* it ignored the **RIDERS**, who are the tallest thing on the train.

Measured (`/tmp/mp3d-render/aud-pd-bore.tsx` — every vertex of every car, riders included, walked into each hoop's own basis) the real envelope above the RAIL LINE is

```
y 0.00-0.30  halfW 0.335   |  y 0.60-0.78  halfW 0.23
y 0.30-0.42  halfW 0.32    |  y 0.78-0.84  halfW 0.12
y 0.42-0.60  halfW 0.33    |  y 0.84-0.96  halfW 0.23   <- shoulders
                           |  y 0.96-1.02  halfW 0.12   <- HEADS, top 1.017
```

so the worst car vertex sat at radius **1.121** about an arch centre 0.1 below the rail, against a clear bore of 0.83 — **0.291 u outside it.** The EXACT torus-tube test (distance to the tube's centre circle — not an AABB, which is how Brasswork's audit manufactured an 81 mm phantom "clip") counted **234 836 vertex-samples inside the tube over 36.2 M tested, worst penetration 0.069 of a 0.07 tube**: dead centre through the neon. A ray-parity sweep against the static geometry (`aud-pd-tunnel.tsx`) found the same for the tunnels' own **roof ribs** (2 088 samples inside, worst depth 0.221) and **portal headers**. The riders' heads went through all 39 hoops and every rib, once a lap, and no render had ever caught it because every shot happened to have the train in the station or on the turnaround.

**The fix is derived from that profile.** Raising the arch CENTRE is worth far more than widening it, because the binding vertex is nearly on the bore axis — the worst radius falls 1.121 → 0.823 as the centre goes −0.10 → +0.20:

| arch centre above rail | worst car-vertex radius |
|---|---|
| −0.10 (shipped) | 1.121 |
| 0.00 | 1.022 |
| +0.10 | 0.922 |
| +0.20 | 0.823 |
| +0.25 | 0.773 |

So `HOOP_Y` = **+0.22** and `HOOP_R` = **0.98** (0.9 → 0.98 also lands the feet 0.04 INSIDE the valance walls instead of on them, so the tube never grazes the wall plane), the roof ribs become a **pair** cantilevered in from the wall tops to `RIB_IN` 0.36, and the portal frame tracks the arch (`HOOP_Y + HOOP_R + 0.18`). Re-measured over a whole lap:

```
hoops        0 vertices inside the tube of 35.3 M tested   worst clearance 0.100
static solids the train passes through:  only TubeGeometry(5120 tris), 109 of
             201 696 samples, worst depth 0.020, culprit CylinderGeometry
             y=-0.15 x=-0.335  ->  A WHEEL ON A RAIL, which is what
             SplineRideKit's wheelOffset is for. Not a clip.
```

**The visible consequence is deliberate and better**: the crowns now stand 0.58 proud of the low walls instead of 0.18, so the hoops read as rings the train goes THROUGH rather than as rings buried in the trough. `TRAIN_TOP` (1.017) and `TRAIN_HALF_W` (0.335) are named constants in the file now, so the next aperture is checked against the train instead of against a remembered number.

## The beat

`BEAT_HZ = 2.2` — the same clock `<DanceFloor>` flashes its tiles to and `<Discotron>`'s mirror ball scintillates on, over the same cool palette subset (magenta `0xd815b8`, cyan `0x18c8d8`, violet `0x7b3fe4`, blue `0x1858e0`).

* **Hoop colour STEPS on the beat** (`paletteAt(step + seq)`), so inside a tunnel the colours *slide* one hoop along per beat — the light visibly runs down the bore.
* **Hoop brightness chases**: within a tunnel one hoop in four is at full gain, the rest sit low.
* **Train flare**: `exp(−1.6·d²)` off the lead car's live world position pushes a hoop's emissive toward white and adds up to +2.6 intensity — the ring the train is inside BLAZES.
* Wall base strips, the canopy lip, the platform edge strip, the cabin glass and the canopy downlights all breathe on `beatPulse`; the speaker cones thump on `beatKick`.

**TWO CLOCKS.** `update(time)` runs `gate.update(time)` **first** (so the flare reads the train's fresh position) and then `lighting(time)` on **absolute** time. Only the TRAIN is gated: `createMotionGate({ spinDown: 1.6 })` parks it in the station for boarding while the tunnels keep pulsing, because a nightclub does not go dark when a ride stops. Probe: 78/81 emissive materials still animating while `waitingForPassengers`.

## Train and sim wiring

3 × `buildCoasterCar` (front / middle / end) on the `CAR_LIVERY` scheme — gloss-black tub, chrome waist trim, magenta nose and tail fairings. `COASTER_CAR_SEATS` anchors are parented into each car, so **capacity 6 = 3 cars × 2 REAL seats**: sunk cushions with welded bucket backs, lumbar rolls and lap bars, and real guests ride them via `seatWorld` (decorative riders off when registered). `cars[0]` is the ride `vehicle` (RideViewer onboard cam); `crashed` reports the coaster profile's live 1.5 g derail guard; `gateCarLights` night-gates the headlamp and tail lamp. Run spacing 1.15, `wheelOffset` 0.195.

`<Bassline>` is a `composableRide` with layout:

```
front: 2.2            // queue HEAD out the local +z front (the face the circuit keeps clear)
exit:  [1.7, 1.9]     // exit hut beside the brake tail
board: BOARD          // [-1.3, 0.6, 0] — the platform, at station rail level
defaults: { name: 'Bassline', capacity: 6, rideDuration: 11.5, intensity: 5, price: 5 }
```

The built footprint is 20.1 × 6.8 u, i.e. over the 10-u "compact ride" threshold, so `<ConfigurableRide>` leaves the authored `front`/`exit` alone (sprawling circuits keep their station-local layout) — these numbers are used as written.

### ⚠️ `rideDuration` IS NOT THE LAP — §8b, THE STATION LOCK

This shipped at **13**, "matched to the measured 12.9 s lap, on purpose", on the reasoning that one dispatch should be one circuit. **It is not, and the train parked somewhere new every single time.** Two independent errors:

**1. The gate clock advances more than `rideDuration`.** `createMotionGate` keeps integrating through the spin-**up** of `departing` — whose length is `loadTime`, which `configurableRide.tsx:907` defaults to **1.6**, not the FSM's bare 1.0 — and through the eased brake of `arriving` (1.0 s) **and** of `movingToEndOfStation` (1.0 s), which is also a target-0 *eased* state, not a hard park. Measured advance per dispatch at `rideDuration` 13:

```
dt 1/60  14.891      dt 1/20  14.897        i.e. rideDuration + 1.894
dt 1/30  14.894      dt 1/10  14.906        against a 12.742 s lap
```

2.15 s of overshoot = **8.2 u of track every dispatch.** The nearest seat anchor's distance from the ride's own `board` point over 9 cycles, driving the REAL FSM state sequence:

```
dt 1/30   1.04 · 3.97 · 7.14 · 14.07 · 7.14 · 5.03 · 0.38 · 3.14 · 6.16  u
```

— guests boarded a train up to **14.07 u away**, out in the light tunnels, while the platform stood empty.

**2. The error is frame-rate dependent.** `makeGuardedRun` clamps its OWN dt to 0.06, so handing it one 0.1-s frame advances the train 0.06 — under swiftshader (the manager clamps dt to 0.1) the train covers ~60 % of what the clock says. The same 9 cycles at dt = 1/10 came back as `0.83 · 6.82 · 10.95 · 3.31 · 1.89 · 11.25 · 6.16 · 1.11 · 6.96` — a completely different sequence, so **any `rideDuration` tuned at one frame time is an artefact of that frame time.** (`WyrmsHollow` §8b found both halves first; this is the same fix.)

**THE FIX, four parts, all inside this file:**

* **SUBSTEP THE RUNNER** — rail time reaches `run()` in ≤ 50 ms slices, so the integration is identical at every frame time.
* **THE TRAIN BRAKES INTO ITS STATION AND HOLDS** — rail time stops advancing on the frame *after* the lead car passes closest approach to the parked pose (holding on first contact with a threshold ball would stop it a whole car short), and resumes only on dispatch. The tunnels and every other emissive keep running on absolute time, so a held train reads as a train that has arrived.
* **THE PARKED POSE IS DERIVED** — scan the circuit for the arc nearest the `board` the composable publishes, then LEAD it by the seat band's mean offset behind the lead car (`(cars−1)/2 · spacing − mean COASTER_CAR_SEATS.z` = 1.13 for the stock 3-car train) so the whole train straddles the platform instead of the head alone sitting on it. The build then **primes** rail time by walking that same substepped runner forward to the pose — `makeGuardedRun` starts the train at the CHAIN-LIFT base (`u0 = liftStart/N`) when the lift is long enough, which on this circuit is 0.6 u past the station, not on it.
* **`registered`** (new opt, set by `<Bassline register>`) — a registered train starts HELD. `registerRide` constructs its rec already in `movingToEndOfStation` **without** calling `setState`, so no `onStateChange` fires until that timer expires and the gate free-runs until then; unheld, the first parked pose measured 1.18 u / mean 2.49 from `board` where every later one measures 0.42 / 0.95. A preview has no FSM and must keep running, so this cannot be inferred inside the builder.

`rideDuration` is now **11.5**: 11.5 + 1.894 = 13.39 against a 12.742 s lap, i.e. **0.65 s past the parked pose** for the brake to absorb. **Do not raise it back toward the lap** — the lock needs that overshoot at every dt.

Measured after the fix, 9 cycles, nearest seat from `board`:

| dt | per cycle | worst | spread | mean seat |
|---|---|---|---|---|
| 1/60 | 0.405 0.424 0.426 0.423 0.424 0.425 0.424 0.421 0.419 | **0.426** | 0.021 | 0.948 |
| 1/30 | 0.405 0.418 0.417 0.416 0.413 0.409 0.425 0.409 0.423 | **0.425** | 0.020 | 0.948 |
| 1/20 | 0.405 0.397 0.407 0.413 0.397 0.415 0.403 0.394 0.392 | **0.415** | 0.023 | 0.949 |
| 1/10 | 0.405 0.423 0.370 0.408 0.368 0.387 0.379 0.378 0.378 | **0.423** | 0.055 | 0.951 |
| 1/30 ±40 % jitter | 0.405 0.415 0.418 0.407 0.425 0.423 0.405 0.426 0.411 | **0.426** | 0.021 | 0.949 |

0.37-0.43 u at every frame time, against a 0.392 u floor set by the board pad's own height offset. `g.userData.stationStop` / `stationHold` / `stationPrimedT` / `railT` publish the live values so a probe asserts on the real thing.

**A LAND MUST MIRROR THE 11.5.** `PulseDistrict`'s ride table hardcoded 13; a set-piece that keeps the old number re-breaks the ride it is composing.

## Lights and day/night

**THREE real `PointLight`s** (budget ≤4): the lead car's headlamp (from `buildCoasterCar`), one station canopy light, and the one inside `buildNeonSign`. Everything else is night-gated emissive on `nightKOf`, `gain = 0.35 + 1.25·nk`.

**Daytime read**: the tunnels are real structures — graphite portal frames, valance walls, roof ribs, capping strips — lined with hoops that read as *painted* rings at noon, so the ride is legible without a single lit pixel. Two colour notes learned in the harness: the platform deck is `GRAPHITE_D`, not `GLOSS` (a pure-gloss deck under one light read as a hole in the ground and the platform vanished), and the canopy/masts are `STEEL 0x6e737d` (graphite at `metal 0.3` goes near-black in this Stage).

**Metals: this file's OWN materials all sit 0.22-0.35, but the BUILT GROUP does not.** The audit's census found six materials at 0.6-0.8 and every one of them comes from a SHARED builder — `SplineCoaster`'s rail tubes (0.8), spine tube (0.7) and tie plates (0.6), and `CoasterCar`'s chassis/wheels (0.6-0.9). They are fleet-wide, identical on every tracked ride in the catalog, and they render as intended because they are all thin `tex: 'metal'` tubes rather than broad plates — so this is recorded, not "fixed" here. Do not repeat the old claim that the whole rig is inside the band.

The station canopy is **slatted, over the outer half of the deck only**. A solid roof hid the deck, the downlights and the parked train from every park camera — the same lesson `MagneticRide`'s station learned.

## Props

| prop | default | meaning |
| --- | --- | --- |
| `pieces` | Sub Bass Circuit | compileTrackPieces layout (piece children win over the array) |
| `points` | — | raw control points, past the compiler |
| `cars` | 3 | cars in the train (clamped 1-6) — capacity follows at 2 seats each |
| `riders` | `true` standalone, `false` when `register`ed | decorative peeps |
| `groundAt` | flat | terrain sampler for supports and footings |
| `registered` | set by `<Bassline register>` | THE STATION LOCK holds the train on its platform until the first dispatch. Never set it by hand on a preview — the train would never move |
| + all `ComposableRideProps` | — | `position` / `rotation` / `scale` / `register` / `queue` / … |

## Previews

`Bassline.previews.tsx` (4, all inside `<ScenePreview>` — a component never renders a `<Stage>`): the daytime rig, the **night hero** (pulsing light tunnels), the station + marquee turned square to the Stage's fixed 45° camera, and a custom circuit proving the tunnels auto-fit a different layout. Every one renders with a completely clean console — no `warning`, no `FATAL`, no `self-inter`, no `design violation`.

## Audit — 2026-07-25, /100

| Dimension | Score | Notes |
|---|---|---|
| Mesh richness & count | 15/15 | **240 meshes / 46 248 tris** registered (336 / 61 560 with decorative riders), 110 merged batches, 210 materials. Inside the fleet's tracked-ride band; every static repeat (tunnel ribs, portal fascias, hoop struts, canopy slats, cabinet furniture) goes through `mergedParts`/`mergedBoxes`. Deterministic: two identical builds agree exactly |
| Detail | 15/15 | tex+bump on every opaque structural surface — the 47-of-77 "untextured" the first census reported were all NEON (hoop half-tori and the tunnels' wall strips, areas 1.9-14.1, `em 0.2`), which must not carry a concrete texture. 84 of 243 emissive intensities change day→night (maxDelta 2.976); 3 PointLights; mechanism modelled (chain-lift strip, brake tail, portal frames, cabin, woofer cones on `beatKick`). Metals: this file's own materials 0.22-0.35; six at 0.6-0.8 all come from the SHARED `SplineCoaster` rails/spine/ties and `CoasterCar` — fleet-wide, recorded not "fixed" |
| Cohesion | **20/20** | **The audit's biggest find, and it is closed.** Exact torus-tube test over a whole lap: hoops **234 836 vertex-samples inside the tube → 0 of 35.3 M**, worst clearance now **0.100**. Ray-parity sweep vs every static solid: roof ribs and portal headers **2 088 samples inside → 0**; the only residual is `TubeGeometry(5120 tris)`, 109 of 201 696 samples at 0.020 depth, culprit `CylinderGeometry y=−0.15 x=−0.335` — **a wheel on a rail**, which is what `wheelOffset` is for |
| Guest comfort | 15/15 | 6 real `COASTER_CAR_SEATS` places (sunk cushion, welded bucket back, lumbar roll, lap bar). Riders no longer pass through the neon: that was the −6 "head through a canopy" and it is measured closed above. Riders frozen while parked (drift **0.0000** over 2 s of frames), moving while travelling |
| Guest location | 15/15 | capacity 6 = **6/6 distinct seat anchors**; **station lock** puts the nearest seat **0.368-0.426 u** from `board` on all 9 cycles at dt 1/60, 1/30, 1/20, 1/10 and 1/30 ±40 % jitter (spread ≤ 0.055, mean seat 0.948-0.958) against a 0.392 floor — it was **1.04-14.07 u**, frame-rate-dependent, before |
| Aesthetic | 20/20 | Reads as a neon light-tunnel coaster at the park camera (50.5°), at 115° and at night; the raised hoops read as rings the train goes THROUGH. Cool palette only. Night is lit, not dark: hoops chase and flare, station lip + BASSLINE marquee blaze, free-standing gates mark the open track |
| **Total** | **100/100** | |

Probes: `/tmp/mp3d-render/aud-pd-cycle.tsx` (lap, clock advance, per-cycle board distance × 5 frame times), `aud-pd-bore.tsx` (envelope profile + exact torus-tube test), `aud-pd-tunnel.tsx` (ray parity vs every static solid), `aud-pd-facts.tsx` (census, metals, night delta, determinism), `aud-pd-clash.tsx` (seat anchors, parked drift).
Shots: `shots/aud/FIX-Bassline-{day,night,station,custom,elev50}.png`, `shots/aud/Bassline-{day,night,elev50,a115}.png` (pre-fix, kept for the comparison).
Fixed this pass: the train passed through all 39 hoops, every roof rib and both portal headers (raised + widened the arch, split the ribs, re-solved the portal); `rideDuration` 13 → 11.5 with a substepped runner + station lock + a primed/held parked pose; the `registered` opt.

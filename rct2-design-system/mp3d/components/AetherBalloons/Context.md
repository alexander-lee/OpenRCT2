# AetherBalloons

**CANONICAL IMPORT — copy exactly:** `import { AetherBalloons } from './components/AetherBalloons';`
*(never from `'./Park'`: only the `<Park>` wrappers + track-piece JSX live there. A wrong
specifier makes esbuild refuse the WHOLE bundle — the round-8 black-page failure.)*

**"Aether Balloons" — the BRASSWORK FOUNDRY world's stately family flat ride.** Six ornate brass-and-glass **gondolas** on a spider of riveted arms **rotate around a square lattice hoisting mast WHILE they rise**, hold at the top, and settle back onto the boarding deck. Slow, high, scenic — a Victorian "aerial promenade", not a thrill ride (intensity 2).

The world is about **exposed working machinery**, so the whole drive train is modelled and every part of it moves off the same clock. See "The mechanism" below.

## Exports

- `<AetherBalloons position rotation scale riders effects register pinned name capacity rideDuration loadTime intensity price queue>` — built on `<ConfigurableRide>` via `composableRide`. Register defaults: **Aether Balloons, capacity 12, rideDuration 14, intensity 2, price 3**. `riders` defaults to true standalone and **false when registered** (real guests take the seats). `effects` (default true) toggles the winch's relief-valve steam.
- `buildAetherBalloonsScene(t, { riders?, effects? }) → { group, update, vehicle, seatWorld, onStateChange, dispose }` — the imperative builder. Group origin on the ground at the mast centre; the **boarding side (the railing gap) faces local +z**.
- `buildAetherGondola(t, { riders? }) → THREE.Group` — ONE gondola on a stub arm end, for close-ups.

## Access geometry (`layout`, local frame, yaw = `rotation`)

| | |
|---|---|
| queue HEAD | **3.7** out the local **+z** front — which is where the deck railing's 60° **boarding gap** and its raked handrails are |
| exit hut | local **[-2.95, 1.4]** (auto-flushed to the −x pad edge by `registerComposedRide`) |
| boarding | local **[0, 0.30, 1.1]** — on the deck inside the gap |

The apron reaches radius 2.39, so the chassis' compact-ride auto-clearance would raise `front` to 3.66 by itself; 3.7 is written down so the number is visible. Lane length always follows `capacity` (`laneLenOf(12) = 7.82`) — place the ride so the lane TAIL lands on a street node.

## Dimensions (scale-checked against Carousel / Teacups)

Boarding deck radius **1.90**, top **y 0.26**, on two ring ledges (0.10 / 0.19) that ARE the stair. Gondola pivots at radius **1.42**; gondola floor **0.34 docked**, **1.44 lifted** (hoist travel 1.10). Arm plane 1.19 → 2.29. Mast crown 2.90, crown beams 2.95, aether globe 3.11, weathervane 3.28. A park guest is ≈ 0.55 tall, so a lifted gondola floor stands two and a half guests off the ground — the ride reads as "up" without becoming a tower.

## The mechanism (all of it geared off ONE cycle phase)

- **Lattice mast** — four riveted posts, six bays of crossed bracing on all four faces, horizontal ties and gusset rivets at every bay line, on a bolted plinth. The whole mast is **one** `mergedBoxes` mesh.
- **Carriage sleeve** — a square tube of four plates (0.66 across the flats) sliding up the mast's four face rails on **eight guide rollers**. Its own corners land at radius 0.506, which is what sets `R_SLEW = 0.56`: a rotating ring any tighter would saw through them.
- **Slew drive** — a brass gearbox bolted to the sleeve with a vertical **pinion** at radius 0.46 engaging the **toothed inner face of the slew ring** (0.52 : 0.058 → 8.97 pinion turns per revolution of the arms). The gearbox rides the sleeve, the ring turns with the spider: that is what "the arms rotate at every height" means mechanically.
- **Hoist ropes + counterweights** — two ropes off the sleeve's top lugs at **x ±0.40**, up over two **crown sheaves** (centre ±0.265, r 0.135, so its two tangents ARE the rope lines: 0.40 out, 0.13 in) and back **down inside the lattice** to two cast-iron **counterweights** on their own guide rails, which **descend as the gondolas rise**. Both spans are live every frame (`spanCable`), and the sheaves turn at exactly the rope speed (`travel / sheaveR`).
- **Hoist line shaft** — up the middle of the lattice in three bearing brackets to the crown bevel gear, so the sheaves are visibly *driven*. Its brackets tie to the ±z ties only: the counterweights ride the ±x lines and need a clear bore.
- **Base winch** — engine bed, rope drum with real wraps, drum pinion into a 0.20 spur gear (**exact 0.06 : 0.20**), spoked flywheel, spinning ball governor, a live pressure gauge and the relief valve that wisps steam.
- **Sway** — each gondola hangs on a fore-and-aft **pivot pin** in brass bearings and gets a small outward lean from the rotation (centrifugal, ∝ ω²) plus a gentle hashed tangential rock. Both fade with the motion envelope, so a parked gondola hangs dead level.

**The cycle** (`riseProfile`, period 15 s = loadTime 1 + rideDuration 14): docked 1.5 s → 4.8 s rise → 4.2 s hold at the top → 3.6 s descent → docked again ~0.9 s BEFORE the cycle ends, so the gondolas are already home when the FSM parks.

## RCT2 station behaviour (motion gate) + real seats

Capacity **12** = 6 gondolas × 2 places. REAL GameManager guests board DISTINCT live seat anchors through `seatWorld` (decorative riders default true standalone / **false when registered** — unfilled gondolas must read as empty). The updater is wrapped in `createMotionGate` with **`spinDown: 1.8`** so the arriving gondolas *settle* onto the deck instead of dropping onto it: the ride sits **PARKED** (docked, level, still) through `waitingForPassengers` / `waitingToDepart` / `unloadingPassengers`, eases 0→1 into rotation and lift on `departing`, and eases back to rest into `arriving`. The gate's eased factor also scales the hoist travel and the sway, which is what makes "parked" mean *docked* and not *frozen mid-air*. Un-registered previews are byte-identical: the gate starts UNGATED.

**Seats are REAL seats.** Moulded iron pan → buttoned oxblood leather cushion with its **top exactly 0.225 above the gondola floor** → leaning backrest with its own cushion, brass divider rail, lap bar on two uprights, footrest bar. 0.225 is arithmetic: a park guest is `GUEST_SCALE` 0.5 and a peep's hips sit at peep-local 0.45, so an anchor **on the floor** lands a rider's hips ON the cushion and their feet ON the floor — whether the manager seats them (legs down, arms folded onto the lap bar) or a decorative `seated` peep takes the place.

## Palette + budgets

The Brasswork Foundry values (BrassworkScenery's `BRASSWORK`, the same brass/copper/iron GoggleWorks uses): muted brass `0xb2913f` / `0xd0b26a` / `0x86682f`, oxidised copper `0x96603a` weeping verdigris `0x36483a`, soot-grey iron `0x615c53` / `0x38342e` / `0x8a8378`, oxblood leather, pale grey-blue glazing, galvanised rope `0x9a958c`.

**Metalness ceiling 0.34.** A `MeshStandardMaterial` at metalness ≥ 0.6 with no environment map renders NEAR-BLACK — metals are lit only by reflections and this Stage has a sun and nothing to reflect. Every metal here sits in the 0.2–0.34 band and gets its brass from colour + texture + rivets. No shiny gold anywhere.

**2 real PointLights** (crown aether globe + the yard gaslight, both night-gated) — the eleven railing bulbs and the six gondola lamps are ONE shared emissive material each, not lights. **24 particles** (the relief valve). The mast, every rivet ring, the gondola ribs, the gear teeth and the deck seams are batched through `mergedBoxes`; rivets / gauge ticks / patina / engraving / splines / guide shoes are tagged `userData.lodDetail`. ≈546 meshes / 52 k tris with all 12 decorative riders, far fewer registered. Deterministic — hashed sines only, no `Math.random` / `Date.now`; the updater takes ABSOLUTE time.

## Modelling notes (things that were wrong first)

- **The winch was invisible.** At azimuth `π·1.18` (behind the mast) nothing of the machinery showed at the isometric camera. It now sits on the mast's **+x flank** at radius 0.62, reaching 0.91 — inside the docked gondolas' inner face (1.046) and well under the arm plane (1.19).
- **The riser rope was inside the mast.** At `LUG_X` 0.31 it ran through the corner posts' outer face (0.30) and the face rails (0.307) and simply vanished. 0.40 stands it proud of the posts and the sleeve (0.355) and inside everything that rotates (0.52+). The rope is also **pale** (`ROPE`) while the face rails were darkened to `IRON`, so a glance can tell rope from rail.
- **No cap plate on the crown.** A lid over the sheaves hides them completely at the isometric camera elevation (the same lesson GoggleWorks' roof taught): two spanning beams at z ±0.26 carry the sheave cheeks and leave the rope wheels in plain sight.
- **Nothing may stand on the deck inside radius 1.79 at gondola height** — that annulus is the docked gondolas' own sweep. The gaslight standard therefore lives OFF the deck, at radius 2.29 on the clinker apron.

## Previews

1. **3D rig — the aerial promenade at work** (`<ScenePreview distance={7} targetY={1.5}>` over a sooted flagstone yard).
2. **Gondola rig** — `buildAetherGondola` close up: bench, glazing, ornament, yoke.
3. **Mechanism** — a low, close camera on the mast, sheaves, counterweights and base winch.

## Audit — 2026-07-25, 100/100

| Dimension | Score | Notes |
|---|---|---|
| Mesh richness & count | 15/15 | **568 meshes / 53 616 tris** with all 12 decorative riders, **404 / 21 568** registered; **64 `lodDetail`**; the whole lattice mast is ONE `mergedBoxes` mesh, as are the rivet rings, gondola ribs, gear teeth and deck seams; determinism MATCH |
| Detail | 15/15 | tex+bump throughout; the drive train is modelled AND measured visible (below); 2 night-gated PointLights, eleven railing bulbs + six gondola lamps on shared emissive materials, 24 particles at the relief valve |
| Cohesion | 20/20 | **60-sample sweep over 2 full cycles**, `computeBoundingBox()` before every `Box3` read: gondola→mast/lattice **0.4664**, gondola→gondola **0.7015**, lowest gondola vertex **0.2833** against a deck plate top of 0.26. Before this pass that last number was **0.2588** — 1.2 mm INSIDE the deck |
| Guest comfort | 15/15 | **12/12 distinct** anchors, min separation 0.230; hips settle **3.7 mm** into the 40-mm cushion; and the rider's fist is now **clear of the yoke stay** — it used to be **28.5 mm inside it**, on both outer seats, in every pose |
| Guest location | 15/15 | anchors ride the live gondolas; the vehicle is **docked at y 0.34 on all 7** measured boarding moments and parked drift is 0; in the live park the ride reaches a queue and `waitingForPassengers` |
| Aesthetic | 20/20 | reads as a Victorian aerial promenade at the 50° park camera; night is the crown aether globe, the deck flood, eleven railing bulbs and six gondola lamps — lit, not absent |
| **Total** | **100/100** | |

Probes: `/tmp/mp3d-render/aud-brass-sweep.tsx` (cycle sweep), `aud-brass-clip.tsx` (exact-primitive
rider clip + the deck-dip diagnostic), `aud-brass-cart.tsx` (yoke stay vs fist),
`aud-brass-vis.tsx` (mechanism occlusion), `aud-brass-gate.tsx`, `aud-brass-facts.tsx`,
`aud-brass-seats.tsx`. Shots: `shots/aud/AB2-rig-{day,e50,a115,night}.png`, `AB-mech2.png`,
`AB-mech-cw.png`, `AB2-gondola.png`, `AB2-docked.png`.

### Fixed this pass — three, and two of them were invisible in the rest pose

**1. The rider's fist was 28.5 mm inside the yoke's diagonal stay.** Exactly the Emberfall
yoke-plate defect, in an actual yoke. The seats sit at z ±0.115 and a peep's arm pivot is 0.0975 off
its own centre-line, so each outer rider's outboard fist lands at z ±0.2125, y 0.334-0.401 — and the
stay, leaning DOWN AND IN from z ±0.27 to a centre of ±0.20, swept z 0.226-0.262 straight across that
height. The stay now leans the other way (centre z ±0.30, tip −0.253, shortened to 0.18 so its foot
lands ON the rim moulding instead of running down through the glazing), which clears the fist by
**25.6 mm** and is also what a brace to a rim actually does. Probe: `0 stay hit(s)` on all four fists.

**2. The docked gondolas dipped 1.2 mm into their own deck.** The hoist is home from p 0.94 to p 0.10
but the arms are still turning, so the lean and the tangential rock stayed live at the one moment the
pan is closest to the plate: swept over the cycle, the pan's outer bottom edge reached y **0.2588**
against a deck top of 0.26. There are only 30 mm under a docked pan and a 0.08-rad tilt on a 0.32
radius eats 29 of them. Two changes: the scrollwork brackets came up from −0.030 to −0.020, and the
sway is now scaled by the RISE as well as by the motion gate (`swayK = motionK · (0.15 + 0.85·rp)`),
so the gondolas are settled while they are near the plate and lively while they are up. Measured
clearance **23.3 mm**, and it reads better — arriving gondolas settle instead of rocking on the deck.

**3. `PERIOD` was 15, and one FSM cycle is 15.326 s.** The gate advances the clock through
`departing` and `arriving` too and the FSM counts neither as ride time, so the hoist profile slid
**+0.326 s of phase per cycle** against the station. Nothing was ever caught mid-air (the gate scales
the travel to zero the instant the ride parks — that safety net is why this survived) but by cycle 5
`departing` began at p 0.109 instead of 0, and 23 cycles in it begins at the TOP of the hold, where
the gondolas would shoot 1.1 u in the gate's 0.8-s spin-up. `PERIOD` is now phase-locked to the
cycle. `rideDuration` was NOT touched: this world's window is on its 60-s floor.

### The mechanism reads — measured, not eyeballed

This ride's whole value is visible working machinery, so "visible" was raycast rather than judged:
27 sample points per mesh, from three cameras, counting the fraction where the part itself is the
first thing hit (≈50 % is the ceiling for a solid, since half the samples are on its far side).

| part | mechanism preview | lead preview | PARK 50°, d 13 |
|---|---|---|---|
| crown sheaves | 30 % / 17 % | 15 % / 17 % | 31 % / 41 % |
| hoist ropes | 41 % / 24 % | 29 % / 6 % | 26 % / 11 % |
| counterweights | 17 % / 21 % | 17 % / 12 % | 12 % / 6 % |
| winch drum | 26 % / 19 % | 26 % / 19 % | 30 % / 7 % |

(two figures per cell: gondolas DOCKED / gondolas at the TOP.) The counterweights are the faintest
element and they do read — pale `IRON_P` slabs behind dark bracing, plainly identifiable at azimuth
90° where their 0.30 face is presented through the ±z lattice (`shots/aud/AB-mech-cw.png`). Their
travel was confirmed to be the exact inverse of the gondolas': centre y **0.840 ↔ 2.190**.

**The "Mechanism" preview was reframed, because it did not show the mechanism.** Its camera was at
`[3.4, 1.75, 3.9]` on a 1.35 target — 4.4° of elevation — which cropped everything above the arm
plane: the crown sheaves, the bevel gear and the aether globe were off the top of the frame and the
shot was a base winch and a dark lattice. It is 5.5 u to the weathervane; the camera now stands back
and looks up the mast.

### Measured and deliberately NOT changed

The parked gondola is **docked and still every cycle**, but its AZIMUTH is arbitrary — 0.32 to 2.29 u
from `board` across 7 cycles. That is correct for a rotational flat ride and is the whole fleet's
convention: `seatWorld` hands the manager the real live anchor, so a guest is seated in a real seat
wherever the spider stopped. Only a ride whose vehicle must return to a *place* (the dark ride) needs
its clock tuned to the cycle.

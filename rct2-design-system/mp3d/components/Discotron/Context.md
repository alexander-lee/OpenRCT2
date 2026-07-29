# Discotron

**CANONICAL IMPORT — copy exactly:** `import { Discotron } from './components/Discotron';`
*(never from `'./Park'`: only the `<Park>` wrappers + track-piece JSX live there. A wrong
specifier makes esbuild refuse the WHOLE bundle.)*

The **PULSE DISTRICT**'s mirror-ball **gyro spinner** — a FLAT ride (no track compilation). A giant faceted mirror ball turns on a chrome-banded graphite mast in the middle of a two-tier black-gloss stage; six sweep arms radiate from the rotor below it, each carrying a two-seat pod on its own slew-ring turntable. The rotor spins, the arms **rise and fall** (a gyro sweep, twice per revolution) and every pod turns slowly on its ring, so riders face a different part of the club every second. A circular **laser truss** on four legs rings the stage overhead with four heads trained on the ball's facets, and the DISCOTRON neon marquee hangs under its front.

Companion pieces in the same world: **`components/DanceFloor`** (the district's centrepiece — Discotron imports its `DISCO_PALETTE` and shares its beat), **`components/Bassline`** (the district's coaster), **`components/NeonSign`** (the marquee is a real `buildNeonSign`).

## The beat — the district's one clock

`BEAT_HZ = 2.2` — the **same** beat `<DanceFloor>` flashes its tiles to and the Guest pose layer's `dance` state uses. Three helpers drive everything:

| helper | shape | used by |
| --- | --- | --- |
| `beatStep(t, off)` | integer beat index — colours **step** once per beat | facet shells, shard-rig tints, laser lenses, rim/truss LED chase |
| `beatPulse(t, ph)` | 0.55…1 bloom that **dips exactly on the colour change** (DanceFloor's own curve) | shard bloom, pod trim, gate crown, rim LEDs, ball wash light |
| `beatKick(t, ph)` | sharp spike, 1 on the beat decaying across it | laser beams, console LEDs, speaker-cone thump |

Beat-locked effects: 4 mirror-ball facet shells (hashed per-shell beat offsets), 3 shard rigs (each its own palette slot + sweep rate), 4 laser beams, a 4-step stage-rim LED chase, a 2-group truss-ring LED alternation, 6 pod trim strips, the gate crown, the console LEDs, 4 speaker woofer groups — **and the arm sweep itself**: one full rise-and-fall takes exactly 8 beats (`w = 2π·BEAT_HZ/8`, applied at `×2` so it happens twice per rotor revolution).

**TWO CLOCKS, deliberately.** `update(time)` calls `lighting(time)` on **absolute** time and only then `gate.update(time)`. A nightclub's light show and a mirror ball do not stop when the ride parks for boarding — but the rotor must. So the whole light rig keeps running off the raw Stage clock while `createMotionGate` freezes the ride motion. (Chain order matters: lighting first, so a frozen gate can never stall the district's beat.)

**Palette:** `PULSE_PALETTE` (exported) = the **cool subset** of DanceFloor's `DISCO_PALETTE` — magenta `0xd815b8`, cyan `0x18c8d8`, violet `0x7b3fe4`, blue `0x1858e0`. The floor may flash amber and lime; a mirror ball throwing amber and lime shards read as a fairground carousel in the harness, and this world's brief is magenta/cyan/violet on graphite. The beat and the palette family stay shared, the two warm slots are dropped.

## Dimensions (world units — a guest is ~0.55 tall)

| constant | value | meaning |
| --- | --- | --- |
| `APRON_R` / `APRON_H` | 2.2 / 0.145 | outer concrete apron |
| `STAGE_R` / `STAGE_H` | 1.98 / 0.4 | raised gloss stage disc (the deck the shards rake) |
| `HUB_Y` | 0.58 | sweep-arm plane; arm underside 0.53 = 0.13 over the deck |
| `ARM_IN` → `ARM_OUT` | 0.32 → 1.32 | arm root → turntable centre |
| swept envelope | 1.89 | `ARM_OUT` + a pod's 0.574 half-diagonal — inside `STAGE_R` |
| `TILT_MAX` | 0.42 rad | arms sweep 0 → 0.42; they **never dip below parked** |
| `BALL_Y` / `BALL_R` | 2.6 / 0.44 | mirror-ball centre / radius |
| `TRUSS_R` / `TRUSS_Y` | 2.3 / 3.0 | truss ring + its four legs (clear of apron and pods) |
| built footprint | x ±2.40, y 0…3.07, z −2.49…2.69 | measured; drives the `front 4.0` layout |

Checked against `components/Enterprise` (5.21 × 3.55 × 2.40) — same family, deliberately a touch wider because the stage is a real dance floor.

## Pods (6 × 2 seats = capacity 12)

**PEDESTAL-MOUNTED, and that is load-bearing.** The first build hung each pod under its arm on a yoke; a hanging pod puts its headrests — and the riders' heads — at the arm's own height, so the arm cut straight through the tub and through the riders, and no yoke length fixes it while the pod still clears the deck. Pods now stand on a slew-ring turntable **on top** of the arm (which is also how RCT2 builds its spinning flat rides) and every rider has an unobstructed view of the ball.

Pod local origin = the slew-ring top, `+z` = the direction the riders face. `FLOOR = 0.11` is the tub floor above that origin.

**REAL SEATS** (this fleet has had several rides fixed for bare-cylinder seating): per seat — a chrome seat frame, a moulded graphite pan, a **fabric cushion** sunk into it (top `FLOOR + 0.245`), a shell backrest with its own fabric back pad biting the cushion, a fabric lumbar roll sitting *on* the cushion, a headrest cap, and a padded lap bar on a chrome stem out of the cushion. Around them: gloss tub walls + front lip, a four-bar capping **rim** (never a lid — the first cut used one 0.94 × 0.66 slab and every pod read as a black box), a chequer-plate footwell, a boarding step and two grab handles on the front face, a painted accent chevron and a beat-pulsed neon trim strip.

`seatWorld` anchors sit at `[±0.22, FLOOR + 0.005, −0.01]`: a `buildPeep` group's hip line is 0.24 above its origin at `GUEST_SCALE` 0.5, so a real guest's hips land exactly **on** the cushion top. Decorative riders (also scale 0.5, so they match real guests) fill the seats when `riders` is true — default standalone, forced OFF when the ride is `register`ed. Probe: 12/12 distinct anchors.

`arms[0].podYaw` is the ride's `vehicle` (RideViewer onboard/follow cam).

**Draw calls:** every static pod part is batched by material family (`mergedBoxes` / `mergedParts`) — 7 meshes per pod instead of ~35. Unbatched, six pods plus the four speaker stacks and four truss legs put the ride at 428 meshes unregistered, 2.4× Enterprise's 175; batched it is **204 unregistered / 372 with decorative riders**.

## The light show

* **Mirror ball** — a dark seam core plus **128** mirror tiles on a Fibonacci sphere (≈90% coverage; 48 tiles left it reading as a spotty dark sphere), split into 4 shells so the facets scintillate independently. Facet tint is pulled **halfway to white** (`.lerp(WHITE, 0.55)`): at full palette saturation the four shells turned the ball into a rainbow beach ball, where a mirror ball is silver glass *catching* a colour. A soft additive bloom shell (radius `BALL_R × 1.5`) anchors the shafts to their source. The ball turns at 0.5 rad/s with a faint wobble on its pin, on the absolute clock.
* **Shard rigs (the signature)** — 3 rigs × (6 tapered light shafts + 6 elongated floor patches), each rig **merged into two additive meshes** and spun at its own rate (0.34/0.43/0.52 rad/s) with its own palette slot (adjacent slots, so magenta + cyan + violet shards rake the floor at once — offsets of 2 on a 4-slot palette had two rigs sharing a colour and the night shot went monochrome). Shaft elevations are hashed 0.88…1.32 rad, chosen so every shard lands **inside** the stage disc: that keeps the measured footprint (and therefore the queue geometry) compact instead of smearing additive glow across the surrounding park.
* **Laser truss** — 4 heads on the ring `lookAt` the ball, each with an emissive lens and a hair-thin additive beam rod to the ball's skin; both punch on the downbeat.
* **LEDs** — 32 stage-rim lamps in 4 chase groups (one step per beat, so the ring walks round) and 32 truss-ring nodes in 2 alternating groups. Both are `mergedParts` batches, one draw call and one animated material per group.
* **Haze** — two stage vents, 70 particles each (140/300 budget), pale violet additive, so the shafts have something to bite on.

Additive materials are `color: 0x000000` + emissive tint + `AdditiveBlending` + `depthWrite: false`, i.e. pure light that is never lit by the scene, with `renderOrder` 2/3/4 (halo/shafts/patches).

## Lights and day/night

**THREE real `PointLight`s** (budget ≤4): the ball wash (`ballLight`, tinted to the beat's dominant colour, range 6.5), the boarding gate (`gateLight`, `0xdfe6ff`, range 4) and the one inside `buildNeonSign`. Everything else is night-gated emissive on `nightKOf` with `gain = 0.35 + 1.25·nk`.

**Daytime read** is designed, not inherited: a dark club exterior in daylight is the real risk. Form and materials carry it — concrete apron, a `DECK` (`0x21232a`) that is deliberately a shade off pure black so pods, riders and shard patches stay legible, painted magenta/cyan radial inlays inside three chrome inlay rings, a chrome-banded mast, real speaker stacks with inset woofer cones and dust caps, and `STEEL` (`0x6e737d`) for the truss: graphite at `metal 0.3` went near-black against grass and the ring read as coaster track. Metals stay in the 0.22–0.35 band (≥0.6 renders near-black in this Stage with no env map).

## Sim wiring

`buildDiscotronScene(three, { riders })` returns `{ group, update, vehicle, seatWorld, onStateChange }`.

`<Discotron>` is a `composableRide` with layout:

```
front: 4.0            // queue HEAD out the local +z front — the boarding-gate face
exit:  [-3.15, 1.3]   // exit hut, flush on the −x edge
board: [0, 0.4, 1.4]  // boarding on the raised stage disc
defaults: { name: 'Discotron', capacity: 12, rideDuration: 13, intensity: 6, price: 4 }
```

`front 4.0` clears the apron (2.2), the perimeter railing and the two gate-flanking speaker stacks; `<ConfigurableRide>`'s own auto-clearance would raise anything under 3.96 anyway, so the number is written down rather than discovered.

**`rideDuration` is 13 s on purpose.** A world's set-piece has to pass `validatePark`'s `sim` gate, and stock 18-20 s cycles have already failed a world by ~2 s. Keep it in 12-16.

### `rideDuration` IS NOT THE CYCLE — and for a spinner that turns out not to matter. MEASURED.

`createMotionGate` keeps integrating through the spin-**up** of `departing` (length = `loadTime`, which `configurableRide.tsx:907` defaults to **1.6**, not 1.0) and through the eased brake of `arriving` **and** `movingToEndOfStation`, so the real advance per dispatch is `rideDuration + 1.72` — measured **14.719 / 14.722 / 14.725 / 14.733 s** at dt 1/60 · 1/30 · 1/20 · 1/10. On `<Bassline>` the same surplus was a genuine bug (its train parked up to 14 u from the platform — see `Bassline/Context.md` §8b). **On this ride it is bounded by the rotor's own 6-fold symmetry and is not one**, and that is a measurement, not an assumption. Driving the real FSM for 9 dispatches and reading the nearest of the 12 seat anchors from the ride's own `board` point `[0, 0.4, 1.4]`:

| dt | nearest seat, per cycle | worst | spread |
|---|---|---|---|
| 1/60 | 0.437 0.364 0.626 0.679 0.410 0.369 0.493 0.682 0.396 | **0.682** | 0.318 |
| 1/30 | 0.428 0.365 0.631 0.676 0.410 0.369 0.489 0.693 0.400 | **0.693** | 0.328 |
| 1/20 | 0.420 0.366 0.636 0.674 0.410 0.369 0.486 0.704 0.405 | **0.704** | 0.338 |
| 1/10 | 0.399 0.373 0.651 0.666 0.410 0.369 0.476 0.736 0.422 | **0.736** | 0.367 |
| 1/30 ±40 % jitter | 0.428 0.365 0.632 0.674 0.408 0.369 0.490 0.689 0.398 | **0.689** | 0.324 |

**Worst 0.74 u at any frame time, and the MEAN seat is a rock-steady 1.80 u** (1.793-1.810 across every cycle and every dt). That 0.74 is the arithmetic ceiling, not a drift: the pods sit on a 1.32 radius and the board pad on 1.40, so a rotor parked at the worst 30° offset puts the nearest pod `hypot(1.32·sin30°, 1.40 − 1.32·cos30°)` = 0.71 u away. A guest is never *placed* at `board` anyway — `seatWorld` seats all twelve in real cushions, and a 6-pod spinner boards all the way round its disc, which is what the 1.80 mean is.

**So no station lock, deliberately.** The rotor's parked azimuth does walk ~45.6° per dispatch (14.72 s × 1.05 rad/s, modulo the 60° arm pitch) and a lock could pull the worst case to ~0.08, but it would buy nothing a guest or a probe can see and it would risk the one thing that IS load-bearing here: `k` is a hard 0 while parked, so `tilt` is exactly 0 and `podYaw` holds its hashed build value — **the arms are level and the pods face a fixed way for boarding at every dt.** Parked drift over 2 s of frames: **0.0000**. Recorded here so the next audit does not re-derive it.

**Motion gating:** `createMotionGate({ spinUp: 1.1, spinDown: 1.5 })`. Parked (`waitingForPassengers` / `waitingToDepart` / `unloadingPassengers`) the eased speed is a hard 0, so `tilt = k · TILT_MAX · (…)` is exactly 0 — the arms sit **level** and the rotor angle is frozen for boarding. Because `TILT_MAX` is applied as `(0.5 − 0.5·cos …)`, the arms only ever rise from the parked plane; they never dip toward the deck.

## Props

| prop | default | meaning |
| --- | --- | --- |
| `riders` | `true` standalone, `false` when `register`ed | decorative peeps in the pods |
| + all `ComposableRideProps` | — | `position` / `rotation` / `scale` / `register` / `name` / `capacity` / `rideDuration` / `queue` / … |

## Previews

`Discotron.previews.tsx` (4, all inside `<ScenePreview>` — a component never renders a `<Stage>`): the daytime rig, the **night hero** (mirror ball + light shards), the marquee/boarding face turned square to the Stage's fixed 45° camera (`rotation={Math.PI/4}`, `autoRotate={false}`), and a pod close-up for the seating.

## Audit — 2026-07-25, /100

| Dimension | Score | Notes |
|---|---|---|
| Mesh richness & count | 15/15 | **205 meshes / 28 548 tris** registered (373 / 61 980 with decorative riders), **101 merged batches**, 183 materials, 2 particle emitters (140/300). Inside the fleet's 120-210 flat-ride band and 1.2× `Enterprise`'s 175 for a rig that carries six two-seat pods. `lodDetail` is thin (1 registered / 13 with riders) but nothing here is over budget, so it costs nothing; the fine repeats (32 rim LEDs, 32 truss nodes, 128 facets) are already ONE draw per animated group, which is the cheaper answer. Deterministic |
| Detail | 15/15 | tex+bump on every opaque surface — the 22 of 73 "untextured" are all additive light (shard shafts, floor patches, laser rods, the ball's bloom shell), which must not be textured. **59 of 208 emissive intensities change day→night, maxDelta 2.218**; 3 PointLights (ball wash, boarding gate, the marquee's own); metalness **0 materials ≥ 0.6**. Mechanism modelled: rotor bearing housing, six tilt trunnions, a hydraulic ram per arm, slew-ring turntables, chrome mast bands, inset woofer cones with pale dust caps |
| Cohesion | **20/20** | 96-sample sweep over 3 arm periods (8 beats each) at full gate speed, with an explicit per-mesh `computeBoundingBox()`. **Swept envelope 4.803 × 3.350 × 5.092 against a rest envelope of 4.803 × 3.260 × 5.092** — the cycle adds 0.09 in Y and *nothing* in X or Z, so the moving rig never leaves the footprint the queue geometry is planned against. Exact ray-parity clash sweep (516 672 moving-vertex samples against 100 static solids): **FIXED this pass — all six hydraulic rams were ploughing a circle through the STATIC stage disc** (2 842 + 4 192 samples inside the two deck cylinders, 0.06 u deep, invisible because the deck is opaque and the rams sit behind the pods). After raising and shortening them the only parity hits left are the **tilt trunnion inside the rotor bearing housing** — a pin in its own bearing, which is what a bearing is |
| Guest comfort | 15/15 | Per seat: chrome frame, moulded pan, sunk fabric cushion, shell backrest with its own pad, lumbar roll, headrest cap, padded lap bar on a chrome stem, chequer footwell, boarding step, two grab handles. Riders sit ON the cushion (hip line 0.24 at `GUEST_SCALE` 0.5 lands on cushion top `FLOOR + 0.245`) and no rider vertex is inside any pod shell over the whole sweep. Pods are PEDESTAL-mounted, so nothing passes over a rider's head |
| Guest location | 15/15 | capacity 12 = **12/12 distinct seat anchors**; **parked drift 0.0000** over 2 s of frames (hard `k = 0` → `tilt` exactly 0, arms level, `podYaw` on its hashed build value); seats travel **2.974 u** while `travelling`, Y band 0.745-1.187. Parked pod-to-`board` distance measured at **0.364-0.736 u worst at every dt from 1/60 to 1/10** (mean seat 1.793-1.810) — the arithmetic ceiling of a 6-pod disc, not a drift; see the `rideDuration` section for why no station lock |
| Aesthetic | 20/20 | Reads as a mirror-ball gyro spinner at the park camera (its own preview pose is already 50.6°) and at 115°. Day is carried by FORM: concrete apron, `DECK 0x21232a` a shade off black, painted magenta/cyan radial inlays in chrome rings, banded mast, real PA cabinets, `STEEL` truss. Night is the hero — 3 shard rigs raking the deck in three different palette slots, 4 laser beams on the downbeat, the DISCOTRON marquee. Cool palette only (the two warm `DISCO_PALETTE` slots are deliberately dropped) |
| **Total** | **100/100** | |

Probes: `/tmp/mp3d-render/aud-pd-cycle.tsx` (per-cycle parked pose × 5 frame times), `aud-pd-clash.tsx` (seat anchors, parked drift, swept vs rest envelope), `aud-pd-clash2.tsx` (exact ray-parity clash sweep), `aud-pd-facts.tsx` (census, metals, night delta, determinism).
Shots: `shots/aud/Discotron-{day,night,elev50,a115}.png`, `Discotron-p2-marquee.png`, `Discotron-p3-pod.png`, `FIX2-Discotron-{day,pod,night}.png`.
Fixed this pass: the six hydraulic rams were 0.06 u inside the static stage disc and swept a circle through it all cycle.

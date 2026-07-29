# BoilerBurst

**CANONICAL IMPORT — copy exactly:** `import { BoilerBurst } from './components/BoilerBurst';`
*(never from `'./Park'`: only the `<Park>` wrappers + track-piece JSX live there. A wrong
specifier makes esbuild refuse the WHOLE bundle — the round-8 black-page failure.)*

**"Boiler Burst" — the BRASSWORK FOUNDRY world's spinner, themed as the foundry's PRESSURE-TEST RIG.** Eight riveted test carts circle a live boiler on a turntable, each cart spinning on its own valve hub, while the boiler winds itself up and **VENTS** — four brass nozzles blowing steam across the ride. Intensity 6, 13-second cycle.

## Exports

- `<BoilerBurst position rotation scale riders effects register pinned name capacity rideDuration loadTime intensity price queue>` — built on `<ConfigurableRide>` via `composableRide`. Register defaults: **Boiler Burst, capacity 8, rideDuration 13, intensity 6, price 4**. `riders` defaults to true standalone and **false when registered**. `effects` (default true) toggles the vent bursts + chimney wisp.
- `buildBoilerBurstScene(t, { riders?, effects? }) → { group, update, vehicle, seatWorld, onStateChange, dispose }` — the imperative builder. Group origin on the ground at the boiler's axis; the **boarding side faces local +z**.
- `buildBoilerCart(t, { riders? }) → THREE.Group` — ONE cart on its slew hub, for close-ups.
- `BOILER_BURST_CAPACITY` (= 8) — capacity IS the seat count, one per cart, so `makeSeatWorld`'s modulo can never double two riders into one cushion.

## The vent — a FIXED period on the ABSOLUTE clock, and it is TELEGRAPHED

```
vent index = floor(time / VENT_PERIOD)      VENT_PERIOD = 3.6 s
jet        = max(0, 1 − (time − index·VENT_PERIOD) / VENT_JET)      VENT_JET = 0.9 s
```

A burst fires on the frame the index changes, and the jet decays from **`index · VENT_PERIOD`** — the ideal vent instant, *not* the frame time — so the rhythm is frame-rate independent and bit-identical run to run. No `Math.random`, no `Date.now`. `userData.ventPeriod` / `userData.ventCount` expose it to probes (`/tmp/mp3d-render/brass-flat-sim.tsx` asserts vents at 0.00 / 3.60 / 7.20 / 10.80 / …).

**Telegraphed:** the big gauge is bolted to the boiler's **+z face — the one the QUEUE looks at**. Its needle sweeps −1.45 → +1.45 rad as `p^1.4` (so it *accelerates* into the red danger arc that starts at 1.05 rad), and at the top:

- all four nozzles blow (rate opens to 22/s for 0.9 s on top of a 13-particle burst),
- the **safety-valve lever** pops (`lever.rotation.z = jet · 0.5`),
- the **red pressure lamp** flashes (`0.25 + jet·2.1 + p²·0.5`),
- the **whistle** throws an 8-particle burst (the chimney emitter's `burst(n, origin)` one-shot origin — no fifth emitter),
- the boiler **shudders** by a hashed ±0.005 for the length of the jet,
- at night a vent-flash PointLight lights the steam from inside.

Then the needle drops to zero and starts climbing again. **The nozzles also LEAK 6 particles/s between vents**: the blast is only a quarter of the period, and a still frame at a random phase must still read as "venting".

**`ventUpdate` sits OUTSIDE the motion gate.** A pressure rig vents whether or not the carts are turning — and the night lights must not freeze with a parked ride either, so the emissives/lights live in the absolute-time half too. Only `motionUpdate` (turntable, cart spin, drive train) is gated.

## Access geometry (`layout`, local frame, yaw = `rotation`)

| | |
|---|---|
| queue HEAD | **3.9** out the local **+z** front — the fence gap, and the face the big gauge is on |
| exit hut | local **[-3.15, 1.4]** |
| boarding | local **[0, 0.32, 1.05]** — on the turntable inside the gap |

Measured footprint: x ±2.53, z −2.48…2.58, so the chassis' compact-ride rule wants `front ≥ 2.58 + 1.27 = 3.85` and the exit flush at x ≤ −3.15. Both are written down rather than left to the auto-correction. Lane length follows `capacity` (`laneLenOf(8) = 5.58`).

## Dimensions (scale-checked against Teacups / Carousel)

Static base radius **2.05** (ring + ledge), rotating turntable radius **1.90** with its top at **y 0.28**, cart hubs at radius **1.35**, cart floors **0.34**, cart rims 0.60, riders' heads ≈ 0.90. Boiler: plinth 0.28–0.44, firebrick firebox 0.44–0.74, riveted barrel 0.74–1.60 (tapering 0.52 → 0.46), copper shoulder and dome to 1.885, safety valve 2.04, whistle 2.14, offset chimney cap **2.19**.

**The sweep budget:** hub spacing is `2 · 1.35 · sin(π/8) = 1.033`, so a *spinning* cart may not reach past **0.516** from its own axis or neighbours collide. The first pass' handwheel (r 0.13 centred at 0.40 → reach 0.53) did exactly that; it is now r 0.105 at 0.32 (reach 0.45).

## The machinery (this world is about exposed working parts)

- **Turntable** — a full disc, not an annulus: it is *concentric* with the boiler plinth standing on it, so the overlap can never show (a rotating ring would be three more meshes and look identical). Checker plate, radial seams, a rivet ring and a **44-tooth ring gear** on the skirt.
- **Perimeter drive unit** (static) — motor housing, a **spur pinion into that ring gear** (1.935 : 0.09 → the pinion turns 21.5× the turntable), a spoked flywheel and a starting lever with a brass knob.
- **Cart hubs** — a toothed brass slew hub under every cart; the carts spin at hashed rates in **alternating directions** (waltzer-style: no two neighbours in step) and the handwheel spins with the cart.
- **The boiler** — firebrick firebox with a grate and a swung-open brass door (with a coal heap and a shovel beside it), four brass hoop bands with rivet rings, oxidised copper shoulder + dome weeping verdigris, a sooted chimney offset to **−z on purpose so it never hides the safety valve**, whistle, weighted safety-valve lever, inspection ladder up the −z flank, two small flanking gauges, the pressure lamp, and four **vent nozzles** (flange → elbow → cone → mouth ring) pointing outward and 35° up. Each jet's origin AND velocity are computed from its own nozzle mouth, so the steam really does come out of the nozzle it is drawn on — and it blows across the carts.

## RCT2 station behaviour (motion gate) + real seats

Capacity **8** = one seat per cart. REAL GameManager guests board DISTINCT live seat anchors through `seatWorld` (decorative riders off when registered) and **the anchors ride the cart's own spin**, so a rider goes round twice: once about the boiler, once about their own hub. `createMotionGate` (spinDown 1.4) parks the turntable dead still through `waitingForPassengers` / `waitingToDepart` / `unloadingPassengers` and eases 0→1 into rotation on `departing`; probe-measured parked drift is **0.0000** and travelling motion **2.49**. Un-registered previews are byte-identical (the gate starts UNGATED).

**Seats are REAL seats:** moulded iron pan → buttoned leather cushion with its **top exactly 0.225 above the cart floor** → leaning backrest with its own cushion, lap bar on two uprights, footrest bar. 0.225 is arithmetic: a park guest is `GUEST_SCALE` 0.5 and a peep's hips sit at peep-local 0.45, so an anchor **on the floor** lands the hips ON the cushion and the feet ON the floor.

## Palette + budgets

The Brasswork Foundry values (BrassworkScenery's `BRASSWORK`): muted brass `0xb2913f` / `0xd0b26a` / `0x86682f`, oxidised copper `0x96603a` + verdigris `0x36483a`, soot-grey iron `0x615c53` / `0x38342e` / `0x8a8378`, rust, sooted firebrick, oxblood leather, one red (`0x8c2318`) for needles and danger marks.

**Metalness ceiling 0.34** — a `MeshStandardMaterial` at metalness ≥ 0.6 with no environment map renders NEAR-BLACK (metals are lit only by reflections and this Stage has a sun and nothing to reflect). The brass comes from colour + texture + rivets. No shiny gold.

**3 real PointLights**: the firebox (which keeps a **0.28 ember floor by DAY** — a lit fire is lit), a night-gated deck flood and the night-gated vent flash. The eleven fence bulbs share ONE emissive material; the firebox fire and the pressure lamp have their own. **140 particles** (4 nozzles × 30 + a 20-particle chimney wisp). Rivets, gauge ticks, ring-gear/pinion/hub teeth, rust weeps, soot, the ladder and the stencils are batched through `mergedBoxes` and tagged `userData.lodDetail`. ≈527 meshes / 49 k tris with all 8 decorative riders, fewer registered.

## Modelling notes (things that were wrong first)

- **The jets threw the plumes clean off the ride** at 2.1 u/s with buoyant gravity: the steam appeared as disconnected puffs in the sky. 1.15 u/s with gravity −0.05 keeps the plumes on the nozzles and drifting over the carts, and the particles were enlarged (0.12 → 0.56) because at park zoom a 0.4 puff is a scatter of dots, not steam.
- **The big gauge at r 0.26 was as tall as a guest** — r 0.20 reads as a gauge instead of a clock face.
- **The barrel at r 0.55 under a 0.4 dome read as a brick kiln.** It is now tall and tapered (0.52 → 0.46 over 0.86) under a 0.33 dome, with the taper in ONE place (`barrelR(y)`) so the hoop bands and rivet rings follow it.
- **The handwheel's lean needs a YXZ euler.** With the default XYZ order the x-tilt is applied about the axis the wheel's own axis already lies on and does nothing at all; in YXZ the yaw runs first and the tilt then leans the wheel back toward the rider's hands.

## Previews

1. **3D rig — the pressure-test rig venting** (`<ScenePreview distance={7} targetY={1.1}>` over a sooted flagstone yard).
2. **Cart rig** — `buildBoilerCart` close up: tub, seat, handwheel, relief loop.
3. **Boiler** — a low, close camera on the gauge, firebox, nozzles and crown.

## Audit — 2026-07-25, 100/100

| Dimension | Score | Notes |
|---|---|---|
| Mesh richness & count | 15/15 | **527 meshes / 48 676 tris** with all 8 decorative riders, **419 / 27 772** registered; **66 `lodDetail`**; ring-gear/pinion/hub teeth, rivets, deck seams, ladder, stencils, rust weeps all merged; determinism MATCH |
| Detail | 15/15 | tex+bump throughout; the drive train is modelled (44-tooth ring gear, spur pinion 1.935 : 0.09, flywheel, starting lever, eight toothed slew hubs); 3 real PointLights (firebox with a 0.28 ember floor by DAY, night-gated deck flood, night-gated vent flash), 5 emitters / 140 particles, vent on a fixed 3.6-s absolute-clock period |
| Cohesion | 20/20 | **48-sample sweep over 3 cycles**, `computeBoundingBox()` before every read: max reach from a cart's own hub **0.4045** against the neighbour budget of **0.5166** (hub spacing 1.0332), min vertex distance between ADJACENT carts **0.2509**. The relief loop's cap no longer floats — see below |
| Guest comfort | 15/15 | **8/8 distinct** anchors (capacity IS the seat count), separation 0.834, parked drift **0.0000**; hips land **exactly ON** the cushion top (0.0 mm); no rider clip anywhere except soft contact with cushion and pan |
| Guest location | 15/15 | anchors ride the cart's own spin as well as the turntable; turntable dead still through `waitingForPassengers`; in the live park Boiler Burst is the ride that fills first (peak queue **3** of the three attractions) |
| Aesthetic | 20/20 | reads instantly as a pressure-test rig at the 50° park camera — eight riveted test carts round a lit boiler with the gauge facing the queue; night is the best of the three rides (eleven fence bulbs, firebox washing the deck, lit dial, red pressure lamp) |
| **Total** | **100/100** | |

Probes: `/tmp/mp3d-render/aud-brass-sweep.tsx` (cart reach + neighbour sweep),
`aud-brass-clip.tsx` (exact-primitive rider clip), `aud-brass-cart.tsx` (the cap diagnostic),
`aud-brass-gate.tsx`, `aud-brass-facts.tsx`, `aud-brass-seats.tsx`.
Shots: `shots/aud/BB3-rig-{day,e50}.png`, `BB-rig-night.png`, `BB-rig-a115.png`,
`BB3-cart.png`, `BB2-boiler.png`.

### Fixed this pass: "a copper relief loop arching over the back of the tub" was not an arch

`rotation.set(π/2, 0, π/2)` in Euler XYZ maps a torus's own ring plane onto the world **x–z** plane, so
the half-ring was **HORIZONTAL** — it lay across the open mouth of the tub at a constant y 0.243-0.277,
sweeping from (x −0.15, z +0.15) round through x −0.30 and back, with its outermost point buried inside
the rim moulding's own tube (0.283-0.323 radial, y 0.24-0.28). Two consequences, both measured:

* the cap that was meant to sit on its apex was written at `[−0.15, 0.42, 0]` and therefore floated
  **0.1203 u above the pipe with nothing between it** — verified on all eight carts, identical gap;
* sitting directly behind the rider's head, it passed clean through the **back hair of every female
  rider** — 24.0 mm of hair-ball penetration on carts 2 and 5.

`rotation.set(0, −π/2, 0)` puts the ring in y–z, which is the arch that was always described: feet on
the tub wall at (x −0.26, z ±0.15, radius 0.30 — exactly where the shell and the rim moulding meet, so
they JOIN), rising over the back to an apex at y 0.41 with the cap ON it (measured gap now **−4.7 mm**,
i.e. seated 4.7 mm into the pipe). Pushed out to x −0.26 it clears the backrest shell by 8.4 mm and
the widest hair by 50 mm, reaches only **0.296** from the cart's own hub (budget 0.5166), and — since
local −x is radially INWARD here — stands 0.354 u off the boiler plinth it faces. At the 50° camera the
eight arches now read as a ring of pipe hoops with brass caps round the boiler, which is a straight gain
(`shots/aud/BB3-rig-e50.png`); before, the loop was invisible inside the rim and the cap was a brass
cylinder hanging in the air.

### Measured and NOT changed

* **The handwheels are still inside budget.** They were shrunk once already (r 0.13 at 0.40 → r 0.105
  at 0.32) after a real collision. The sweep confirms the worst reach over three cycles is 0.4045,
  and the widest thing on the cart is a handwheel cylinder — 0.112 u of margin on the neighbour budget.
* **The gate hands this runner 1.245 s of surplus per cycle**, and unlike the balloons this ride has no
  cycle-phase profile to lock — the turntable is a continuous rotation and the vent runs on the
  ABSOLUTE clock by design — so there is nothing to correct. Recorded so the next pass does not re-derive it.
* **Decorative riders' feet do not reach the cart floor** (shoes bottom out 0.18 above it). That is the
  shared `buildPeep({ seated: true })` pose, which folds the legs forward; the load-bearing claim —
  hips ON the cushion — measures 0.0 mm, and the feet are inside a closed tub. Not this file's to fix.
* **The steam is the weakest element at park distance.** Close up the four jets read unambiguously as
  steam off their own nozzles (`BB2-boiler.png`); at 50° they are clusters of pale dots. They are
  clustered rather than uniform, so they read as wisps and not as confetti, but this is the number to
  watch if the particle size is ever revisited — it has already been raised 0.12 → 0.56 once.

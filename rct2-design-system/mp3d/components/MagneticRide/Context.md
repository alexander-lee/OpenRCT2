# MagneticRide

**CANONICAL IMPORT — copy exactly:** `import { MagneticRide } from './components/MagneticRide';`
*(never from `'./Park'`: only the `<Park>` wrappers + track-piece JSX live there. A wrong
specifier makes esbuild refuse the WHOLE bundle — the round-8 black-page failure.)*

A **MAGLEV GLIDER** — the trackless-dark-ride idea (slow, poised, cinematic pods drifting past a show scene) built as an OPEN-AIR attraction on purpose: there is no show building, so the whole circuit — guideway, pods and every effect — reads from outside the plot. The vocabulary is deliberately not coaster: no ties, no rails, no wheels. A slim graphite induction beam on single elegant pylons carries a polished levitation rail, glowing coil strips down both flanks, coil ribs, cable conduits and painted travel chevrons. Four pod-shaped vehicles hover a VISIBLE gap above the rail crown and glide at a constant walking pace, banking gently through the sweeps with a slow hashed yaw/pitch/roll drift for the cinematic feel. The show piece the pods circle — a hexagonal monolith with three magnetically suspended rings — stands in the open, in the middle of the ring.

Palette: graphite/steel shell and pylons (`0x3e444d`/`0x2c313a`/`0x9aa2ab`/`0x6d757e`), deep navy pod bodies (`0x2c3e5a`), concrete footings/deck, restrained cyan accents (`0x9fe9f4`/`0x2fb6cf`) and violet beacon glass (`0xb9a6ff`/`0x6a4fd0`) — no neon plastic.

## The guideway

The circuit is a closed `compileTrackPieces` layout on the level `'monorail'` profile (SplineRideKit), resampled through `computeSplineFrames` — the same spline machinery every tracked ride uses. A gentle two-crest **levitation wave** (`WAVE = 0.32`, max gradient ≈ 4.4° on the default lap) is added to the compiled control-point heights afterward — zero value AND slope at the station (u = 0) so boarding stays dead level — so the beam breathes over its pylons instead of reading as a flat ring. This is a pure height offset; the horizontal layout the compiler's validators checked is untouched.

The beam section (built as ribbons/rail-tubes along the spline frames) is: graphite top/underside/flank shell, a polished-steel levitation rail crown, two cable-conduit rail tubes, a navy cable tray, cyan coil-strip ribbons down both flanks, batched coil ribs every 5th frame and batched painted travel chevrons every 15th frame. Pylons (single tapered masts + head collar + footing pad/pedestal + beam cradle, batched) plant every 32nd frame and each carries one violet beacon on the cradle's outboard tip.

**Default circuit**: a hexagonal ring — `station` + 6× (`turnL 60°/r1.9` + `straight 2.6`) — chosen because it closes on the station EXACTLY with nothing synthesized (`synth: []`, worst clearance 1.66, zero compiler warnings, 26.4 u lap). The station piece is the ring's first straight, so the boarding platform gets a full 2.6 u level run. `START = [-1.3, BEAM_Y, -0.5]`, `HEADING = π/2` (station runs along local +x); the ring hangs off the station's local −z, so the +z face (queue side) stays clear of the guideway.

Callers may override the circuit with a `pieces` array or `<Station>/<Straight>/<TurnL>/…` piece children (children win, via `collectTrackPieces`) — any `compileTrackPieces` circuit on the level `'monorail'` profile. A FATAL compile sets `invalid: true` on the builder's return (and the illegal circuit never registers as a real ride via `<ConfigurableRide>`); the compiled report is also attached at `group.userData.trackReport`.

## Heights (world units)

| constant | value | meaning |
| --- | --- | --- |
| `BEAM_Y` | 1.15 | beam centreline height above the pad (pylons make up the rest) |
| `HOVER` | 0.36 | pod levitation plane above the beam centreline (plate underside) |
| rail crown | 0.175 | polished levitation rail's top, relative to the beam centreline |
| **hover gap** | **0.185** | clear air between the pod's induction plate and the rail crown — nothing the pod carries ever touches the rail; it floats |
| `DECK_OVER` | 0.39 | station deck top above the pod floor plate, so guests step in level |
| `WAVE` | 0.32 | levitation-wave amplitude (max grade ≈ 4.4°) |

## Pods (4 × 2-seat tandem = capacity 8)

Each pod (`buildPod`) is an open cinematic 2-seater with no wheels or bogie: a flat induction plate, three downward-facing levitation coils (glowing cyan, night-gated) with housings, a soft under-pod glow disc, and two guide fins that skim down alongside the beam flanks with clear air on both sides — the fins are short in z so the levitation gap stays wide open mid-pod; they *guide*, they never *support*. The hull is a navy tub with brushed-steel shoulder deck, a raked nose with a sleek blistered cap, a tail fairing, cyan roof spine + sill pinstripes, a raked cyan windscreen, a roll hoop and a violet tail marker lamp. Two tandem bucket seats (cushion + back pad + hinged lap restraint) each carry a `seatWorld` anchor (cushion top at local y 0.20 = anchor 0.044 + peep scale 0.34 × 0.46) plus a footwell light strip that glows from inside at night. Decorative riders (`buildPeep`, alternating skin/shirt/expression/gender) fill both seats when `riders` is true (default standalone; forced off when the ride is `register`ed so real GameManager guests fill the pods instead via `seatWorld`).

`pods[0]` is the lead pod and is the ride's `vehicle` (RideViewer onboard/follow cam). It alone carries the one pod-side real light (`podLight`, `0x7fe3f2`, range 2.4). The four pods are evenly spaced around the lap (`SPACING = fb.total / PODS`) and glide at a constant `V = 0.85` units/s. Each pod also vents a small ion-mist wake from its tail while gliding (see Particles below).

## The show monolith

A stepped-plinth hexagonal graphite prism at the ring's centroid, with three cyan/violet emissive seam lines, an octahedral cyan tip, and three torus rings (radii 0.4–0.66) that spin slowly at different rates/tilts and float on a sine bob — all emissive-only, no extra real lights. A 56-particle ion-haze emitter vents up from the plinth.

## The station

An elevated concrete-and-steel boarding platform on the outward side of the station straight: deck slab + fascias/kerb (batched), deck columns, a cyan platform-edge light strip with three painted boarding-bay stop lines/ticks, outer + end steel railings (the beam side stays open for boarding), an 8-tread/8-riser stair flight with sloped stringers, handrails and balusters off the far end, and a slatted (not solid) cantilevered canopy over the outer half of the deck — the boarding edge stays open to the sky. Two canopy downlight bulbs (emissive) plus the station's one real `PointLight` (`stationLight`, `0xdfe9ff`, range 5) light the platform at night. Two holographic departure-board panels (cyan/violet emissive glass with two "scrolling schedule" lines) sit on the outer railing, faces turned in over the platform.

## Effects & night gating

Everything is deterministic (hashed sine off the updater's absolute time, `hash(n)`; no `Math.random`) and every light effect is gated on `nightKOf(g)` with a smoothstep ease — emissive materials do the work, and only **2 real PointLights** exist in the whole scene:

| light | colour | range | gates to |
| --- | --- | --- | --- |
| `podLight` (lead pod only) | `0x7fe3f2` | 2.4 | `ease × 0.5` + a small sine ripple |
| `stationLight` | `0xdfe9ff` | 5 | `ease × 0.85` |

Night-gated emissive materials: flank coil strips (breathing, phase-offset per side), the 10 travelling coil-pulse groups (see below), platform edge strip + canopy lip, 2 holographic panels (each with its own sine flicker), 2 canopy downlight bulbs, pod cabin/sill glass + tail lamps + footwell strips, pod levitation coils + under-pod glow discs (breathing), pylon violet beacons (a runway-style chase — one sharp exponential flash per pylon, phase offset by pylon index), and the show monolith's seam lines / tip / three rings.

**Travelling coil pulses** — the effect that sells "magnetic": 10 small pulse groups (one shared material, so the whole effect costs one night-gated emissive update per frame) ride the beam's spline frames ~2.6× faster than the pods and in the same direction of travel.

**Ion/mist wakes** — one small `ParticleKit` emitter per pod, venting from the tail only while the pod is actually gliding (`rate = 3 + 15·motionK`, so wakes cut off when motion-gated to a stop). 4 × 48 = **192 particle capacity**, plus the monolith's 56-particle haze emitter = **248 particles total**, inside the shared ≤ 300/component budget (ParticleKit's `Context.md`).

## Determinism & motion gate

The whole scene is pose-from-absolute-time: `update(time, motionK)` recomputes every material's `emissiveIntensity`, the monolith rings' spin/float, the coil-pulse frame positions and each pod's spline position + hashed drift (`rotateY`/`rotateX`/`rotateZ` by small hashed-phase sines) from `time` alone — same `time` in ⇒ identical frame out. The exported `update` is wrapped in `createMotionGate` (`spinDown: 1.4`, `spinUp: 1.2`) — a registered ride's pods PARK on the beam (still levitating/breathing through the frozen clock's last pose) while guests board/unload, then ease into the long, smooth magnetic glide to speed.

## Exports

- **`buildMagneticRideScene(three, opts?: { pieces?: TrackPiece[]; riders?: boolean }) → { group, update(time), vehicle, seatWorld(seat), onStateChange(state), invalid? }`** — the imperative builder. `invalid: true` when the (possibly overridden) `pieces` compile FATAL.
- **`<MagneticRide position rotation pieces riders children register name capacity rideDuration price intensity queue>`** — the composable-ride component (`composableRide` factory, `components/Park/Context.md`). Access geometry: queue **HEAD** 2.7 out the local +z front, exit hut at local `[-2.6, 1.5]`, boarding at `[0, BEAM_Y + DECK_OVER, 0.35]` (on the elevated deck). Defaults: `{ name: 'Maglev Glider', capacity: 8, rideDuration: 22, intensity: 2, price: 3 }`. `pieces` (prop or piece children, children win) replaces the default hexagonal ring. `riders` decorative-rider toggle defaults to `!register` (on standalone, off when registered so real guests show through `seatWorld`).

## Previews (`MagneticRide.previews.tsx`)

1. **3D rig** — the day ring: guideway, 4 hovering pods, coil pulses, station, monolith.
2. **Night (coil pulses + beacons)** — the same ring after dark: coil strips, chasing coil pulses, the pylon beacon chase, pod lift-coil breathing, cabin glass, platform edge/lip/holo panels all lit — driven by exactly the 2 real lights above plus emissive materials.
3. **Station close-up** — boarding detail: the deck-to-pod-floor step, the edge light strip, the stair flight, and the guide fins skimming past the beam flanks without touching.
4. **Custom circuit (pieces)** — a long stadium sweep with an `<SBend/>`, proving the `pieces`/children override on a non-default, still-level circuit.

## Verification (this pass)

Re-rendered after the reboot wiped `/tmp` (harness rebuilt at `/tmp/mp3d-render`): `check-all.mjs` bundles clean; day, night (`--night --nightwait=15000`), station close-up and an alternate low-angle render all confirm the pods float above the beam with a clearly visible gap and shadow (see a tight crop on the station pod), the coil-pulse chevrons and pylon beacons read at night, and the circuit sits fully in frame with nothing clipping. No code changes were needed.

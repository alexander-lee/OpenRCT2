# Monorail

## LIVERY: the train is WHITE (2026-07)

The ride matched the RCT2 MONO1 sprite literally — `#f07020` orange body, `#401000` frames. It is now a **white** transit livery: `BODY` `0xf4f2ec` (warm white, never pure `#fff`, which clips in sun), `BODY_D` `0xd8d5cc` for the skirt and roof, and the sprite's magenta kept as the SINGLE accent line at the belt and skirt — a white body with no stripe reads as unpainted plastic. The platform canopies, their fascia stripe and the station elevator all take the same three colours, so the ride reads as one fleet instead of a white train parked under an orange roof.

**The car is BATCHED BY MATERIAL, which is what paid for the detail.** It used to be ~22 loose meshes each with its own `MeshStandardMaterial` — fine for one shuttle, ruinous once `trains` can put four three-car trains on a beam. Every part is a box, so they collect into six buckets and merge into six meshes per car: **~264 draws for a full fleet became ~96**. The saloon panes are now ONE emissive mesh per car rather than ten, so the day→night gate updates one material per car instead of ten. Only the head/tail lamps stay separate (own emissive materials, driven individually).

Added with the room that bought: guide-wheel housings on the skirt (a straddle bogie has to read as GRIPPING the beam, not hovering beside it), a belt stripe under the glass, window pillars between the panes, a proper door frame with jambs/head/threshold step, a number plate, roof walkway rails, a shrouded AC package, a cab windscreen with wipers, a lit destination board, a nose bumper, tail lamps and an aerial.

**The roof plant is deliberately LIGHT.** The first pass used a dark steel AC box and two full-width dark grilles, and the park camera looks down on this train: the render came back with a white body under a near-black roof. The shroud is shaded white like the rest of the roof and only its grille is steel.

**CANONICAL IMPORT — copy exactly:** `import { Monorail } from './components/Monorail';`
*(never from `'./Park'`: only the `<Park>` wrappers + track-piece JSX live there. A wrong
specifier makes esbuild refuse the WHOLE bundle — the round-8 black-page failure.)*

Elevated monorail beam on piers with a streamlined gliding train.

**THIS IS A LARGE, PARK-SCALE TRANSPORT RIDE — run it AROUND YOUR ENTIRE PARK.**
It is not a plot attraction to drop in a corner beside a spinner. Like RCT2's own
monorail, its job is to ring the park: a long elevated circuit that passes over
paths and between lands, giving guests a view and a way across the site. Size the
circuit to the park, not to a ride pad — the legs below are a *starter* loop, and
a real installation scales them up until the beam encloses the developed area.
Because the beam is elevated on piers it may fly over paths and plazas that a
ground-level ride could never cross, which is exactly what makes a park-wide
route practical.

Built with three.js on the shared Stage; modelled from the authentic RCT2 sprite.

## MULTI-STATION: this is a REAL TRANSPORT RIDE, not a scenic loop

**A park-spanning monorail is a STANDING REQUIREMENT** for every generated park
(`rules/park-generation.md` §0 checklist item 10 + pre-flight check 21,
`rules/park-generation-composition.md` §3(d)), and the VERIFIED COPY-PASTE
BLOCK lives in **`rules/park-generation-rides.md` §4.2** — start pose, heading,
growth direction, legal start range, corridor cells, per-platform `queueDir`,
and every measured number. Copy it; do not improvise a circuit.

**AUTHOR ONE `station` PIECE PER PLATFORM.** Extra `station` pieces are legal on
the monorail profile and on nothing else, because that is RCT2: a `Ride` owns an
ARRAY of stations (`std::array<RideStation, Limits::kMaxStationsPerRide>`,
`ride/Ride.h:404`; 255 slots, and the legacy RCT1/RCT2 save format caps it at 4,
`rct12/Limits.h:21`) and `ride/rtd/transport/Monorail.h:19-84` sets NEITHER
`RtdFlag::hasOneStation` nor `hasSinglePieceStation`, so the monorail's station
count is unlimited. Only GoKarts and MiniGolf carry `hasOneStation`
(`ride/RideData.h:437`). `compileTrackPieces` reports one **`TrackStationPose`**
per deck in `report.stations` (`{ idx, piece, start, center, end, length, yaw,
dir, left }`), the component draws a platform island — deck, kerb, yellow edge
line, back + end railings, canopy on four posts, stair tower to grade **and a
working ELEVATOR** (see below) — at each one, and `buildMonorailScene` returns
the poses as `stationPoses` so a park can check its authored platform
coordinates against the compiler's.

**REGISTER ONE GameManager STATION PER DECK.** `register.stations` (a
`RideStationConfig[]`) adds the extra platforms; station 0 stays derived from
`position`/`queue` as always. Each gets its OWN queue lane, entrance hut, exit
hut, exit footpath, routing spurs and blockers, individually gated. Pass
`register.board` for the ELEVATED deck's boarding anchor — a local
`layout.board` offset frozen at `composableRide()` time cannot describe a
platform whose height is an instance prop.

**THE TRAIN STOPS AT EVERY PLATFORM, AND EVERY RIDER GETS OFF THERE.** That is
RCT2 exactly, not a simplification: any track piece carrying a station index
raises `VEHICLE_UPDATE_MOTION_TRACK_FLAG_3`
(`ride/Vehicle.TrackMotion.cpp:433`), `UpdateTravelling` turns that
unconditionally into `Status::arriving` (`ride/Vehicle.Station.cpp:1503-1511`),
`UpdateArriving` brakes and ends in `unloadingPassengers` (`:1720-1724`), and
`UpdateUnloadingPassengers` pushes EVERY guest off (`:974-981`) before the cycle
restarts at `waitingForPassengers` (`:449`). So a guest boards at platform *i*
and walks out of platform *i+1*'s exit — a genuine transfer, counted as
`handle.transfers()` / `mgr.stats().transfers`. The trains themselves are NOT
driven by that FSM — they run their own constant-speed timetable and dwell at
every deck (see *Pacing* below, and the table there for why): the FSM cycles on
a `rideDuration` timer no park-scale circuit can match, and driving the fleet
off it left every train standing still 70% of the time.

**THE HONEST LIMIT — do not oversell it.** Guests do not PLAN a journey.
`Peep::CurrentRideStation` (`entity/Peep.h:343`) is OVERWRITTEN with the
vehicle's station the instant the guest disembarks (`entity/Guest.cpp:4192` +
`:4226`), so an RCT2 peep forgets where it boarded; ride choice is "highest
excitement within 10 tiles" (`GuestFindBestRideToGoOn`,
`entity/Guest.cpp:1943-1970`); and `peep/GuestPathfinding.cpp:813-815` still
carries the original *"The rideIndex will be useful for adding transport rides
later."* The only two places the whole game reads
`RtdFlag::isTransportRide` are cosmetic exceptions for a **FREE** transport
ride: a guest leaving the park will still board one (`entity/Guest.cpp:1989-1998`)
and the rating/price/crash/weather checks are skipped (`:2048-2053`). Hence
`price: 0`. Our sim matches all of this; the district a guest ends up in is an
emergent effect of where the platforms are, not a modelled intention.

**MEASURED** (`node harness/park-eval/probe-monorail-transfer.mjs`, the real
`createGameManager` headless for 600 sim-s with 24 guests on the reference
park's street graph): 4 platforms, every one queue-attached with a 6.01-u exit
footpath, the train stopping 9 times at each, **34 rides of which 34 were
TRANSFERS** (first at 86.6 sim-s), boarded→left matrix South→West 26 ·
West→North 5 · North→East 1 · East→South 2 — the circuit order, every rider off
at the next platform. `node harness/park-eval/probe-monorail-grand.mjs` is the
geometry half. The whole thing runs end to end in
`harness/park-eval/samples/monorail-ref.tsx` at `validatePark → ok: true`.

## `beamY` — fly the beam over the streets

`beamY` is the rail centreline in LOCAL units; the beam soffit is `beamY − 0.15`
and the piers auto-extend to grade.

**The default is now 3.6 for a piece-composed circuit** (the SHUTTLE — no
`pieces` — keeps 1.2). A circuit IS the park-spanning ride, and at 1.2 its
soffit sits 1.05 u up: below `validatePark`'s 2.2-u overfly gate, so the beam
BLOCKED every street it crossed. The old advice was to pass `beamY: 2.6`
by hand, which most parks did and none should have had to.

3.6 is also **higher than that advice**, because 2.6 was scraping:

| soffit clears… | at `beamY` 2.6 | at `beamY` 3.6 | gate |
|---|---|---|---|
| a footpath slab (top 0.09) | 2.36 | **3.36** | ≥ 2.2 (`validatePark` overfly) |
| a stall canopy (top 2.10) | 0.35 | **1.35** | ≥ 0.3 (strict re-audit) |
| an entrance hut (top 1.50) | 0.95 | **1.95** | ≥ 0.3 |

At 2.6 a stall canopy passed by 0.05 u. RCT2's own monorail tops out at height
8 (`ride/rtd/transport/Monorail.h`), so 3.6 is nowhere near a ceiling. Measured
by `harness/park-eval/probe-monorail-grand.mjs`.

## Pacing and where the train stops

**The trains run a TIMETABLE, not the ride FSM.** This is the single most
important thing on this page, because the alternative shipped for two rounds and
looked like a broken ride. Each train used to wait for a `departing` edge from
the GameManager, run one leg on the motion gate's *gated* clock, and park until
the next edge. Measured on the reference park's four-platform ring
(`harness/park-eval/probe-monorail-timetable.mjs`, 300 sim-s, 24 guests):

| | FSM-driven (before) | timetable (now) |
|---|---|---|
| fraction of time moving | **30.3 %** | **99.6 %** |
| longest standstill | **30.8 s** | **2.5 s** (the platform dwell) |
| mean speed | 0.226 u/s | 0.753 u/s |
| distance in 300 s | 67.7 u | 231.0 u |
| speed CoV between platforms | 1.60 | 0.037 |

The FSM cycles on its own `rideDuration` timer — 12 s for a whole circuit — while
one real 82-u leg at a walking-ish cruise takes ~92 s. Those two clocks cannot
agree, so within the first minute the ride's idea of which platform it was at
had drifted free of where the train actually was. A monorail is a **transport
ride**: RCT2 circulates it whether or not anyone is waiting (`Vehicle.Station.cpp:598-605`
departs an empty platform on the max-wait timer alone). So the fleet runs its own
**rail clock** — dwell `DWELL` 2.4 s at a platform, run the leg at the constant
cruise, repeat — and the FSM keeps what it is actually good at: queues, boarding,
unloading, breakdowns.

**One thing still stops the fleet: a BREAKDOWN.** The FSM never says so out loud
— `breakDown()` parks the ride in `movingToEndOfStation` and then returns early
for 18 s without emitting another state, and `brokenDown`/`beingRepaired` live
only on `handle.status()`. A *normal* `movingToEndOfStation` lasts exactly 1.0 s,
so one that outlives 2.5 s is a breakdown. The fleet then eases to a stand over
0.9 s and eases back out when the ride reopens.

**`speed` (default 0.9 u/s) is the cruise, and it is a VELOCITY, not a loop time.** It used to be `total / (loopSeconds · 0.8)`, which makes the speed a function of how long the circuit happens to be: measured on the shipped 4-platform ring that came out at **12.2 u/s** — twenty to forty times a guest's 0.3-0.65 walking pace — and two monorails of different sizes ran at completely different speeds. A monorail is a transport ride and RCT2 paces it by velocity, so it holds a flat cruise on every circuit. The only speed variation is the deliberate `RAMP` at each end of a leg — a smoothstepped pull-away and brake, at most 1.2 s each.

**And the cruise is SLOW.** 2.0 u/s was the first fix and it was still four times a guest's walking pace — a train being fired between platforms rather than a sightseeing shuttle idling across the park. The default is now **0.9 u/s**, a shade under twice walking pace: quick enough to be transport, slow enough to follow a car with your eye the whole way. `loopSeconds` is still honoured for layouts tuned against it but is **CLAMPED at 1.6 u/s with a console.warn** naming the circuit length and the speed it asked for — a short loop time on a park-spanning circuit is exactly how the original bug came back. Prefer `speed` when you want to set the velocity.

**Trains are positioned by ARC LENGTH, not by curve parameter.** `computeSplineFrames`
samples through `CatmullRomCurve3.getPointAt`, whose arc-length table is built at
three.js's default 200 divisions while the frames are 320 — so the sample spacing
is uniform only to a few percent. Advancing `u` at a constant rate therefore gave
a cruise that *breathed* between **0.853 and 0.950 u/s** round a lap: constant in
intent, visibly not constant on the beam. A cumulative chord table over the frames
actually drawn (`cum[]` / `uOfArc`) is exact, and the flat-running spread drops to
**0.018 u/s** (0.882-0.900 — the residual is the geometric fact that the middle of
a train on a radius-6 turn covers slightly less ground than its railhead). The same
table fixes the car `SPACING`, which was also a `u` step pretending to be a distance.

**The train parks CENTRED on its platform.** The head car leads and the other two trail it at `SPACING` (1.25) each, so parking the HEAD on the platform centre left two thirds of the train hanging off the approach end — the "stops a little ahead" read. The head now parks half a train-length past the centre. Measured on the 4-platform ring by `harness/mp3d-render/probe-monorail-motion.mjs`: train-centre offset **1.43 u → 0.18 u** (the deck is 2.6 long) and cruise **12.20 → 1.99 → 0.90 u/s**. That probe measures the TRAIN CENTRE off `userData.trainCars`, not the head car — measuring the head car is what hid this for so long.

## A FLEET on one beam (`trains`)

**`trains` puts N trains on the circuit at once, and the DEFAULT is now a fleet.**
RCT2 runs several per ride (`ride.numTrains`) and spaces them round it so a guest
at any platform has one coming; with one train and four platforms three of them
are always empty, and one visible train on a ring that laps in six minutes reads
as a broken ride. So the default is the **platform count, up to 4** (a
single-platform circuit gets 2 if it is at least 40 u round, else 1). The hard
cap is 6.

Trains are spaced in **TIME** on one shared timetable — train *k* reads it
`k · cycleT / n` seconds ahead — so the spacing is exact and permanent, and there
is no inter-train logic at all. That is also why **the old "never more trains than
platforms" clamp is gone**: two trains dwelling at the same platform at the same
moment is impossible by construction. What *is* possible is packing them tightly
enough to rear-end a dwelling leader, so the cap is a real **headway**: a train
length plus 1.5 u of clear beam, plus the dwell. Over that, `trains` is clamped
with a warn naming the lap time and the headway.

Seat anchors go in TRAIN ORDER, six per train. Riders resolve into the **latched
boarding train** — the one with the shortest forward run to the platform the FSM
is at, "the next one in" — latched only while the vehicle is empty, so nobody's
seat jumps between cars mid-ride. A park that raises `capacity` past six spills
the extra riders into the next train rather than double-seating this one.
`userData.trainCars` is still train 0 (the numeric-probe hook);
`userData.monorailTrains` is the whole fleet; `userData.monorailTimetable`
publishes `{ cycleT, cruise, dwell, stops, trains, length }` for the probes.

Measured by `harness/mp3d-render/probe-monorail-fleet.mjs` on the 4-platform
ring with `trains={4}`: **4 trains, minimum centre-to-centre gap 22.9 u** over
two full laps (a 3-car train is 2.5 u long).

## The station ELEVATORS — TWO per platform, and where they stand

Every platform deck carries **three vertical cores**: a stair core, an ENTRANCE
lift and an EXIT lift. Stairs alone are not how a guest gets from a ground-level
ride entrance onto an elevated platform, and the platform was otherwise the one
place in the park a guest arrived at by teleport. Shaft: four steel columns,
three glazed faces (the deck side is the open boarding face, and the landing
bridge passes through it), a winch house on top in the canopy's white/magenta
livery, a concrete lobby pad with a call post at the foot. The car is a
monorail-liveried box with an amber cabin light, built about its own FLOOR so
its height is driven directly.

**WHERE THEY STAND IS NOT DERIVABLE AT BUILD TIME, and pretending it was is what
put the single old lift in the QUEUE LANE MOUTH.** `buildStationDeck` only knows
the compiled deck pose. The huts come from the PARK's authored `queueAnchor` /
`exitPoint`, resolved by the GameManager and possibly auto-shifted again by the
access audit. Placing the lift from the deck pose alone put it at **across 1.97**
from the beam centreline — with the queue HEAD at 1.79 and the entrance hut at
1.17. It capped the lane and stood squarely in front of the ENTRANCE sign, and
the exit had no lift at all. (Measured by
`harness/park-eval/probe-monorail-access.mjs`, which reads the cores out of the
scene graph by `userData.monorailCore` rather than re-deriving their offsets —
re-deriving is exactly how the old placement went unnoticed, because the probe
repeated the bug's own arithmetic.)

So the build contract runs **backwards** for this one thing:
`buildMonorailScene` returns `onAccessPlaced(stations)`, `<ConfigurableRide>` calls
it straight after `registerRide` with each platform's entrance hut
(`queueAnchor − 0.62·queueDir`, GameManager/registry.ts:155) and exit hut
(`exitAt`, post-audit) in WORLD xz, and the cores are re-posed on the first tick
— deferred, because at registration time there is no promise the group is
mounted, and `worldToLocal` on an unmounted group silently returns world
coordinates unchanged.

**The slots, in the deck frame** (`along` down the deck from its centre,
`across` out along `left` toward the ring interior from the beam centreline):

| | along | across |
|---|---|---|
| beam centreline | — | 0 |
| deck island (0.9 wide, 4.8 long) | 0 | 0.62 |
| entrance hut | 0 | 1.17 |
| exit hut | ±1.20 | 1.17 |
| queue HEAD (lane runs OUTWARD from here) | 0 | 1.79 |
| **entrance lift** | hutMid + 1.5 | **1.35** |
| **exit lift** | hutMid − 1.5 | **1.35** |
| stair core | deck end, entrance side | 0.62 |

The huts land at across 1.17 — pressed under the deck overhang, with the
island's own outboard edge at 1.07 — so there is **no clear ground directly
behind a hut**. What there is, is the deck's back SHOULDER at 1.35: tangent to
the island, and inboard of the queue head, so a core there is out of the lane.

**THE TWO LIFTS ARE MIRROR IMAGES** about the midpoint of the hut pair — same
across, same distance out, `hutMid ± 1.5`. Measured on all four reference
platforms: entrance lift `along −0.90`, exit lift `along +2.10`, both at across
1.35, each **0.92 u from the hut it serves**. That symmetry is what the deck
**overrun going 1.2 → 2.2** buys (island 3.8 → 4.8 long): at ±1.5 each shaft
clears its hut by 0.08 u and both still land on the island. An earlier pass put
the entrance lift on the shoulder and shunted the exit lift onto a deck END —
it cleared everything and mirrored nothing.

Motion is a pure function of the scene clock — dwell 3.4 s, rise 4.3 s, dwell,
descend, smoothstepped at both ends — and it runs on the **RAW** clock, NOT the
motion gate's. That is deliberate and was a real bug when it was not: the gate
holds the clock dead while a train is parked at a platform, so a gate-driven
lift froze exactly while guests were boarding.

**Batched.** Each core is built about its own origin (so it can be re-posed) and
merged by material: a lift is 10 meshes, a stair core 3, against the 21 + 9 the
old loose-mesh pair cost. That is what pays for there being two lifts: the whole
4-platform ring went **326 → 306 meshes** while gaining four extra lifts, and
`monorail-ref` measured **1352 → 1347 draws**.

Measured by `probe-monorail-fleet.mjs`: **12 cores (4 stair + 8 lift), 8 cars
each travelling 2.135 u** (lobby pad 0.09 → landing 2.225) on a `beamY` 2.6 ring;
and by `probe-monorail-access.mjs`: every core clear of both hut rects and of
the queue lane, each lift within 1.3 u of the hut it serves.

## Track pieces

Optional `pieces` array or JSX piece children (children win) turn the classic shuttle into a closed-LOOP elevated beam circuit (compileTrackPieces on the 'monorail' profile; swept concrete beam + piers follow the spline, the train becomes three articulated cars; report on the group's `userData.trackReport`). The beam is FLAT-only — legal pieces: `station` / `straight` (`flat`) / `turnL` / `turnR` / `sbend` / height-less helixes. Vertical pieces are STRIPPED with a console.warn naming the piece: `lift`/`drop`/`hill` are removed outright and a helix loses any `height` — monorails never ramp up and down. Defaults (the back-and-forth shuttle) are untouched when no pieces are given.

### The starter circuit — a DISTRICT loop, not the park-spanning one

For the required park-spanning ring, use **§4.2-A** (four platforms, 85.2 ×
85.2 at size 128, `beamY: 2.6`, measured clearance 16.66, nothing synthesized,
0 warnings — `node harness/park-eval/probe-monorail-grand.mjs`). The loop below
is the small single-platform circuit, kept because it is the smallest legal
`pieces` list and its closure algebra is the same one §4.2 generalises.

```jsx
<Monorail pieces={[
  'station',                                  // the 2.6-u boarding deck
  { type: 'straight', length: 1.2 },          // near leg  a
  { type: 'turnL', angle: 90, radius: 2 },
  { type: 'straight', length: 3 },            // cross leg b
  { type: 'turnL', angle: 90, radius: 2 },
  { type: 'straight', length: 5.3 },          // far leg = 2.6 + a + tail + 0.3
  { type: 'turnL', angle: 90, radius: 2 },
  { type: 'straight', length: 3 },            // cross leg b again (must MATCH)
  { type: 'turnL', angle: 90, radius: 2 },
  { type: 'straight', length: 1.2 },          // tail — lands 0.3 u short of the station
]} />
```

**VERIFIED** (`harness/park-eval/probe-monorail-loop.mjs`, the real
`compileTrackPieces` on `profile: 'monorail'`, `start: [0, 1.2, 0]`):
`report.valid.worst` **1.75** (minimum 0.9), `report.closure.closed` **true**,
`report.closure.gap` **1.50** u with `report.closure.synthesized` **empty**
(the cursor lands 0.3 u short of the station already facing it, so the compiler
synthesizes NOTHING; the 1.50 is just the last control point left after the
0.45-u start dedupe), `report.fatal` **unset**, **0 compiler warnings**.
Footprint **7.0 × 9.3** u (x 0.0..7.0, z −3.5..5.8) — a district, not a park.

**WHY those leg lengths — the closure algebra.** Four 90° arcs contribute
*nothing* to the net displacement (they cancel: 2·r·(d₁+d₂+d₃+d₄) = 0), so a
station + 4-turn circuit closes iff (a) the two CROSS legs are EQUAL and (b) the
far along-axis leg is longer than the near one by exactly **the 2.6-u station
deck + the tail**: `far = 2.6 + a + tail + 0.3`. Scale it by moving `a`, `b`,
`radius` and `tail` and re-deriving `far` — measured over 1008 such circuits,
**all 1008 are legal** (clearance 1.25–2.58, nothing synthesized, zero compiler
warnings — radius 1.5–3, legs 0.8–4.2). A NAIVE
SYMMETRIC rectangle (equal opposite legs) is the trap: it looks right on paper
and **0 of 540 are legal** — it always ends 2.6 + tail u PAST the station, so
the compiler bends a loop-back over the beam (clearances down to 0.00).

**A fatal compile is NOT a registered ride.** When `report.fatal` is set,
`<Monorail>`/`<TrackRide>` renders translucent red and SKIPS the GameManager
registration entirely — no station, no queue, no boarding, and the park's
TRANSPORT category stays EMPTY with no error anywhere but the console. Never
ship a monorail without reading `userData.trackReport`.

### Preview circuits (RCT2 archetypes)

Three archetype circuits ship as previews, all FLAT and all closing on their own approach straight (nothing synthesized, validateSpline clean). Every number below is from `harness/park-eval/probe-monorail-loop.mjs`, which re-compiles all three:

- **Custom loop (pieces)** — the starter circuit documented above, byte-identical: worst clearance **1.75**, closure gap 1.50, nothing synthesized, not fatal.
- **Grand Circle Tour** — four radius-3 `turnL` sweeps + one `sbend`: the park-ringing stadium oval. Monorail.h:26 is the only whitelist here with `curveLarge`, and the ride's rating asks for open air (`RequirementUnsheltered` 4), so the game genuinely rewards the big outdoor circle. Worst clearance **2.15**, gap 1.70, nothing synthesized; 8.4 × 12.3 u.
- **Plaza Circuit** — an L-wrap that steps out twice (five `turnL` + one reverse `turnR` notch, 360° total) and runs one long 7.8-u beam home: the monorail threaded BETWEEN buildings rather than around them. Worst clearance **2.22**, gap 1.30, nothing synthesized; 11.4 × 10.5 u.

FIXED (was a real defect): the 'Custom loop (pieces)' list this file used to document turned only 180° in total, so `compileTrackPieces` synthesized **8.3 u of loop-back — 52% of the 16.0 u authored, over the 40% limit — and reported FATAL**. A park that copied it shipped a monorail nobody could board. Re-measure any hand-authored list before documenting it.

## RCT2 station behaviour (motion gate) + real seats

Capacity **6** = 3 enclosed cabins × 2 interior anchors (was 8; riders sit behind the amber window band). REAL GameManager guests board DISTINCT live seat anchors via `seatWorld` (decorative riders default true standalone / **false when registered** — unfilled seats read visibly EMPTY). The built `update` is wrapped in `createMotionGate` (GameManager): a registered ride sits **PARKED** through `waitingForPassengers`/`waitingToDepart`/`unloadingPassengers`, eases 0→1 into motion on `departing` (~0.8 s) and eases back to rest into `arriving` — so guests board and leave a stationary vehicle, RCT2 Vehicle.cpp-style. Breakdown spin-downs compose with the gate (the FSM parks in `movingToEndOfStation` while broken). Un-registered previews are byte-identical: the gate starts UNGATED and passes raw time through until the first `onStateChange`. The shuttle glide follows the gate envelope and parks at the beam CENTRE (the station); the piece-composed loop glider simply stops where its gated clock rests.

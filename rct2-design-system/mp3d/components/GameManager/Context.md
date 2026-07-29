# GameManager

**CANONICAL IMPORT — copy exactly:** `import { createGameManager } from './components/GameManager';`
*(never from `'./Park'`: only the `<Park>` wrappers + track-piece JSX live there. A wrong
specifier makes esbuild refuse the WHOLE bundle — the round-8 black-page failure.)*

The park SIMULATION brain, rebuilt around REAL OpenRCT2 guest logic. `createGameManager(t, { groundAt?, net?, laneY?, bins?, arrivals? })` → `{ group, registerRide, registerStall, registerBin, registerRestroom, registerParkEntrance, spawnGuests, update, stats, guests, rides, accessPoints, footprints, stalls, accessAudit, entrancePoints }` (`stalls()` = registered stalls' `{ name, anchor, dir }` — validatePark's track-corridor sweep audits their footprints) (`rides()` rows carry `rideDuration`; `accessAudit()` = residual placeAccess collisions; `entrancePoints()` = resolved gate spawn/arch world points — all consumed by ParkBuilder's `validatePark`). Add `group` to your scene, register rides/stalls/bins/restrooms and (ideally) a park entrance, spawn the OPENING population, call `update(time, dt)` every frame — after which guests keep ARRIVING through that entrance on RCT2's own guest-generation curve (see "The gate stream") (dt clamped ≤ 1/15 s). Fully deterministic — hashed-sine randomness keyed by guest index + counters; no `Math.random` / `Date.now`. Every rule below cites its OpenRCT2 source (file:line).

## Time scale

1 RCT2 game tick = 1/160 s of sim time: `TICKS_PER_SEC = 160`, `T(ticks) = ticks / TICKS_PER_SEC` (both exported). All RCT2 tick counts are converted through `T()` — e.g. the needs cadence "every 128 ticks" runs every `T(128)` = 0.8 s, queue misery starts at `T(2000)` = 12.5 s.

## Locomotion — ON the path network

Pass `net: { nodes, edges }` (the same graph you gave `buildPathNetwork`) and the manager builds a `buildRouting` layer from PathNetwork over it. ALL guest movement then happens on the network: a guest is `fromNode → toNode` at parameter `u`. At each node, aimless guests take `wanderNext` (50 % straight-bias, no reversing except dead ends — GuestPathfinding.cpp:535,1926); goal-seeking guests follow `route(from, to, memory)` with a per-guest memory of their **last 4 thin junctions** (GuestPathfinding.cpp:628,1300). `registerRide`/`registerStall` call `routing.attach(x, z)` to add LOGICAL spur nodes at the queue tail, ride exit and stall front so guests can seek them (add a drawn spur to the net before `buildPathNetwork` if you want the walk to be on a visible slab). NaN GUARD: every attach goes through a finiteness check — a registration built from a bad anchor (e.g. a 2-element `[x, z]` where a world `[x, y, z]` is expected, or a doorway derived from a failed placement) used to push a NaN node into the SHARED net and corrupt the whole graph; it now console.warns and skips the attach instead (the ride's queueNode stays −1, so validatePark's accessibility check fails it explicitly). `laneY` (default 0.09) is the path-slab walking height. Without `net`, a minimal direct-walk fallback keeps the sim alive on open ground.

## Blockers — guests do NOT walk through solid objects (round-6)

RCT2 peeps only ever occupy path tiles, so a fountain, a ride body or a fence simply cannot be walked through. This sim walks a graph plus short off-network hops, so solidity is EXPLICIT: every solid object registers a world-space rotated rect (OBB) or circle with the **blocker registry**, and three consumers respect it.

- **`registerBlocker({ rect | circle, label, kind?, owner?, pad?, height? })` → `{ label, remove(), move(dx, dz), set(shape) }`** — `rect` is `{ cx, cz, hx, hz, yaw? }` in the SAME convention as the audited footprints (local +z = `[sin yaw, cos yaw]`), `circle` is `{ cx, cz, r }`. `pad` (default `BLOCKER_PAD` = 0.13, a 0.5-scaled peep's body half-width) inflates the shape for the walk test so nobody clips a rail with their shoulder. `owner` is a DEADLOCK SAFETY VALVE: a guest whose current interaction is with that ride/stall/restroom ignores its blockers (every other guest is still blocked) — the geometry keeps each sanctioned approach (queue tail, hut doorway, serving front 0.72 out, restroom doorway 0.72 out) outside its own blocker anyway. The handle is relocatable because the `<Park>` corridor auto-resolver moves rigs AFTER they registered.
- **AUTO-REGISTERED:** `registerRide` blocks the ride's 0.9-u `boardPoint` pad (guests are SEATED there, they never walk to it) and **both** queue-lane fence railings; `registerStall` blocks the shop body (`hx 0.6 × hz 0.42` at the anchor — the serving front stays walkable). Park's wrappers add the ride BODY (the built visual's own footprint), `<Fountain>` (a circle at the basin radius), `<Restroom>` (the hut, doorway clear) and every `<Fence>` run. `moveRide`/`moveStall`/`resizeRideLane` keep them in lockstep.
- **1. the ROUTING GATE.** The manager builds `buildRouting(net, { edgeAllowed })`: an edge whose span (sampled every ~0.3 u) crosses a blocker is not walkable, so `route()` plans around it and `wanderNext` never strolls into one. **Access spurs are exempt** — a queue-tail / ride-exit / stall-front / restroom-doorway / park-gate spur IS the sanctioned way in. Both fall back to the unfiltered graph when the filter would leave a guest with nowhere to go, so a badly fenced layout degrades to the old behaviour instead of deadlocking; `validatePark`'s `blockers` gate fails it loudly instead.
- **2. `moveToward` SLIDES.** Every off-network hop (stall fronts, hut doorways, bins, queue joins, the balk back out) tries the straight step, then a slide along the offending blocker's edge (the tangent that still makes progress), then a push out along its normal; a guest who somehow starts inside one is pushed straight out first. A waypoint that landed inside a blocker is nudged to the nearest free spot once, so a walk can always complete.
- **3. the READ side.** `blockers()` → every registered blocker as `{ label, kind, owner, height, pad, rect | circle }`; `blocked(x, z, { owner? })` → the first blocker containing the point (or null); `blockerDepth(x, z, { owner? })` → its penetration depth; `edgeWalkable(a, b)` → the routing gate's verdict for a path edge. `validatePark` uses the last two for its `blockers` check.

Cost: shapes are bucketed into a coarse 1.5-u uniform grid (rebuilt only when the registry changes), so a guest's per-step test touches ~0–2 candidates, and edge verdicts are memoised per `(a, b)` until the registry changes.

## Queue lanes are FENCED (round-6)

`buildQueueLane` rails both long sides of every registered ride's queue with the Fence `'metal'` style (`buildFenceRuns` — two merged meshes instead of ~18 loose posts and rails) and registers both sides as blockers. The railings stop 0.14 short of the tail — the queue's open **MOUTH** — so a queue is only enterable at its TAIL and guests must path to the tail node instead of stepping in sideways. The railings carry NO `owner`: the whole queue walk runs down the lane CENTRE, a clear 0.12 u inside both padded rails.

### …and they RAMP to the street (2026-07)

A queue lane is pinned at BOTH ends and the two are almost never level. The HEAD stands on the ride's own pad (`groundAt(ride) + 0.22`, higher again on an elevated deck); the TAIL has to land on a street the height solver put at `pathY + nodeY + 0.09`. The lane used to be one flat slab at the head's level, so the whole difference collected as a **STEP at the mouth of the queue** — measured on `monorail-ref`, the Meadow Flyer's lane sat at 0.732 while the street it joined was at 0.203, a 0.53 u cliff — and `slotPos` handed every slot the same flat `laneY`, so queuing guests stood in the air at the tail end and knee-deep in the slab at the head.

It is now an RCT2 **sloped path**: `buildQueueLane` takes `tailY` (the walking surface at the tail, sampled with `s.walkY`) and lays the slab as an inclined ribbon; the railings walk the grade with it (`buildFenceRuns` pitches each bay off a lane-local `groundAt`); `RideStationRec.laneTailY` records the far level and `slotPos` interpolates each slot's height along the run; `groundRideAccess` grades the berm/scaffold underneath to the same two ends. The exit path does the same through `buildExitLane`'s `endY`. Measured by `harness/park-eval/probe-access-grade.mjs`, which rays into the BUILT meshes: **worst step at the street 0.021 u across all 14 access runs** on `monorail-ref` (a slab is 0.09 thick).

Steeper than RCT2's one-step-per-tile limit (0.5 / 1.2) is a LAYOUT defect, not something a ramp fixes — the ramp is still built (it beats a step) and `console.warn`s with the grade and the run length.

## Guest states — RCT2 `PeepState` subset (entity/Peep.h:47)

`walking, queuing, queuingFront, enteringRide, onRide, leavingRide, buying, sitting, watching, usingBin, usingRestroom, leavingPark`. Balking is a TRANSITION out of queuing back to walking, not a state. Dancing and resting-style fidgets are one-shot ACTIONS layered inside walking/sitting (`dance`, `wow`, `checkTime`, `staggerStop`).

## Needs — 0–255 values chasing targets (Guest.cpp:769-921, 3089)

Six needs per guest: happiness (+target), hunger, thirst, energy (+target), nausea, toilet. **Spawn stats (hashed per guest index):** fresh arrivals enter at 80–100 % energy and happiness (204–255), 0–30 % hunger/thirst/toilet NEED (hunger/thirst stored INVERTED like RCT2 — 255 = sated, so stored 178–255; toilet stored 0–77) and nausea 0. Cash: RCT2's four discrete tiers (below).

### The TWO cadences (RCT2's 128- and 512-tick cycles)

`tick128UpdateGuest` is entered every 128 ticks, but its first line returns early to `updateConsumptionMotives()` unless `(index & 0x1FF) == (currentTicks & 0x1FF)` — "the effect of masking with 0x1FF here vs mask 0x7F … is to reduce how often the content in this conditional is executed to once every four calls" (Guest.cpp:924-937). So RCT2 has TWO rates, and this sim now has both (`NEEDS_SLOW_EVERY = 4`, `types.ts`).

Every `T(128)` = 0.8 s (RCT2's `updateConsumptionMotives`, Guest.cpp:815-921):

- energy and happiness chase their targets by ±4 (RCT2 steps ±2 on its 32..128 energy scale; we run ±4 on 0..255); nausea decays −4
- the scheduled bite/sip of a meal in progress, if one is due

Every FOURTH needs tick = `T(512)` = 3.2 s (everything below RCT2's 0x1FF gate):

- hunger −2, toilet +2 (`GuestUpdateHunger`, Guest.cpp:3089-3098 — RCT2's toilet step is +1; doubled here so a 0–77 bladder can still reach `TOILET_SEEK` 200 inside a guest's few-minute visit)
- thirst −2 (`GuestDecideWhetherToLeavePark`, :3113 — RCT2 drops thirst by 1 and only when the weather is warm; this sim has no weather model and every park in the fleet is warm, so it matches hunger's step)
- energyTarget −2 (:3110, guests tire over the day, floor 32)
- energy ≤ 50 → happinessTarget −2 (:779); hunger < 10 → −1 (:785); thirst < 10 → −1 (:790); toilet ≥ 195 → −1 (:795)
- queuing past `QUEUE_UNHAPPY_AT` → happinessTarget −4 (:1240)
- the leave-the-park roll (:3145) — 5 % when energy < 55, happiness < 45 OR cash < 12 (RCT2's `cashInPocket >= 5.00_GBP` stay clause, :3138)
- the appetite thought triggers, rate-limited further by the 20 s ambient thought gate

**This is the fix for "they go hungry all the time":** every one of those 512-tick steps used to run on the 128-tick cadence — a 4× error that took a fresh guest from sated to starving in ~98 s. Measured on the bench park it is now ~358 s (median first `hunger ≤ 10`), with the food-stall impulse band (`hunger ≤ 75`) first entered at ~232 s.

**Meals:** a MEAL lasts 1.6–3.2 sim-minutes — 12–16 hashed bites/sips, one every 8–12 hashed s (RCT2 nibbles on a schedule via `timeToConsume`, Guest.cpp:815-854 `updateConsumptionMotives`, paused while `onRide`). Relief is PROGRESSIVE and now RCT2-exact per bite: food is hunger +7, thirst −3, toilet +2 (:829-834); each sip is thirst +7. Passive decay of the need being consumed AND the `energyTarget` day-clock decay pause during the meal (a meal would otherwise out-decay itself / outlast the guest's park stay). After the last bite the guest is left `holding = 'container'`.

Thought triggers (Guest.cpp:1085-1131, on the slow cadence): energy ≤ 70 and happiness < 128 → "I'm tired"; hunger ≤ 10 with nothing in hand → thought + seek the nearest FOOD stall; thirst ≤ 25 with nothing in hand → thought + nearest DRINK stall; toilet ≥ 160 → "I need to go to the toilet"; toilet ≥ 200 → seek the nearest registered restroom (see Restrooms below — with none reachable, the need clamps at 255 until the poop fallback fires). The passing stall impulse uses RCT2's own counter thresholds (`hunger ≤ 75` / `thirst ≤ 75`, Guest.cpp:1574-1582) so a guest never walks up only to be told "I'm not hungry".

### Staging a cohort's starting needs — `spawnGuests(count, area?, stats?)` (round 9, ADDITIVE)

The RCT2-faithful 512-tick clock above is correct *and* it makes a fresh arrival useless to a PREVIEW. A guest spawns at hunger 177–255 (inverted: 255 = sated) and the counter refuses food above `hunger > 75`, so the earliest legal burger is **~163 sim-s** after the gate — longer than any preview vignette runs. Every stall preview in the fleet showed guests walking past an idle shop, which is exactly the "guests don't buy anything" report.

The fix belongs in the STAGING, not the rates. `spawnGuests`' optional third argument overrides the fresh-arrival roll per stat, each as a fixed value or a `[min, max]` band drawn off the same hashed guest index as everything else:

```ts
mgr.spawnGuests(8, undefined, { hunger: [4, 48] });   // food stall preview
mgr.spawnGuests(8, undefined, { thirst: [4, 48] });   // drink stall preview
```

Fields: `hunger`, `thirst`, `toilet`, `energy`, `happiness`, `cash`, `intensityTolerance` (`GuestSpawnStats`, exported). `energy` and `happiness` set their chase TARGET too, or the guest would just climb straight back. Values clamp to 0–255. **Remember the inversion** — "spawn them hungry" is a LOW `hunger`.

Two guarantees, both asserted offline (64-guest cohort, every stat compared against the pre-change formulas): omitting the argument — or passing `{}`, or naming only one stat — leaves every other stat's RCT2 roll **byte-identical**, because the extra band draws use their own hash seeds (31+) off the pure `hash01(index, salt)` generator, which has no cursor to shift. And a seeded cohort is as deterministic as an unseeded one.

The band is wide on purpose in the stall previews: the hungriest of the eight buy during the pre-warm and are eating on frame 1, the rest cross the counter gate while the preview plays, so sales keep landing on screen instead of all happening before it. Each of those previews also hangs a `g.userData.stallProbe = () => ({ simT, stalls, guests })` accessor on its dress group, so a headless run can ASSERT `sold > 0` and items in hands rather than trusting a screenshot.

### Starting cash — RCT2's four tiers (`Guest::generate`, Guest.cpp:7362-7381)

`cash = guestInitialCash + ((rand & 3) · £10) − £10`, so the £50 scenario default yields £40 / £50 / £60 / £70 — four DISCRETE tiers, not a smooth spread (`money64` is in units of 10p, `1.00_GBP == 10`, core/Money.hpp:27). This sim's prices put one coin at about £0.40 (a snack is 3 here against RCT2's £1.20 burger), so the tiers are **100 / 125 / 150 / 175 coins** (`GUEST_CASH_BASE` / `_STEP` / `_TIERS`), replacing the old smooth 40–130.

## Queuing (Guest.cpp:5774-5837, 7535, 1980-2042)

Join checks at the queue entrance (`ShouldGoOnRide`), any refusal → happinessTarget −8 + a thought that NAMES THE RIDE (RCT2 passes `ride.id` to every one of them):

- ride == lastRide within `T(128·25)` ≈ 20 s → silent refusal (RCT2 `previous_ride` + `previous_ride_time_out`)
- empty pocket → "I've spent all my money" (`spentMoney`, :2069); cash < ride price → "I can't afford Bassline" (`cantAffordRide`, :2073)
- queue full (all lane slots taken) → "The queue for Bassline is too long" (SIM-ONLY: RCT2 records `RideFlag::queueFull` and walks on with NO thought, `GuestTriedToEnterFullQueue` :2461)
- intensity outside the guest's window: each `RideConfig` has `intensity` 1–10 and each guest a hashed `intensityTolerance` (2–9); accepted when `|ride.intensity − tolerance| ≤ 2 + happiness/32` — happier guests are braver (simplified from RCT2's min/max intensity range). The two SIDES of that window are different thoughts, as in RCT2: too intense → "Boiler Burst looks too intense for me" (`intense`, :2483), too tame → "I want to go on something more thrilling than Boiler Burst" (`moreThrilling`, :2141)

### Queue patience — RCT2's tick counts on the REAL clock

`timeInQueue` counts ONE PER GUEST UPDATE TICK in RCT2 (Guest.cpp:7537), so its 2000 / 3500 / 4300 thresholds are 50 / 87.5 / 107.5 seconds of play at RCT2's 40 ticks/s. This sim runs the tick clock at 160/s (4× — see "The two clocks" in `types.ts`), and those thresholds used to be read on THAT clock: 12.5 / 21.9 / 26.9 s, compared against ride cycles that are authored in real seconds (13–47 s of `rideDuration` across the fleet). A guest therefore soured before the train they were waiting for had come back — the "they get angry too quickly" complaint. They are now read with `TR()` at RCT2's own rate:

- `QUEUE_UNHAPPY_AT` = `TR(2000)` = **50 s** → happinessTarget −4, once per 512-tick cycle (3.2 s), not per 0.8 s (Guest.cpp:1200-1240)
- `QUEUE_AGES_AT` = `TR(3500)` = **87.5 s** → thought "I've been queuing for Wyrm's Hollow for ages" (:5782)
- `QUEUE_BALK_AT` = `TR(4300)` = **107.5 s** and happiness ≤ 65 → 3.3 % hashed chance PER SECOND to abandon the queue (turn around, thought "I'm fed up of queuing for Wyrm's Hollow — I'm leaving", back to walking) (:5827)

Together those two changes cut the happiness cost of a 40-second wait from −140 to nothing, and of a 90-second wait from −340 to −50. Congested parks still complain: on the bench park at 90 guests over 2 rides the census shows 34 `queuingAges`, 36 `queueFull` and 14 balks, every one naming its ride.

Single-file advance only when the slot ahead frees, 0.28 slot spacing; the slot-0 guest is `queuingFront`. Riders pay the ride price when admitted through the entrance hut.

**Queue orientation (audited):** the lane extends `queueAnchor → +queueDir` with slot i at `anchor + (0.45 + i·0.28)·dir`, so slot 0 — the HEAD — is the anchor end, on the RIDE side. The entrance hut + sign stand just beyond the head at `anchor − 0.62·dir` facing `+dir`, putting the hut doorway at `anchor + 0.04·dir`, directly in front of slot 0; guests join from past the TAIL spur at `anchor + (laneLen + 0.35)·dir` and file toward the hut.

## THE EXIT PATH — the OTHER half of the station (2026-07)

> Layout rules and the authoring contract: **rules/park-generation.md §0.4b**.
> Gate policy: `validatePark` check **a4** (ParkBuilder/validate.ts).

**The exit path is a ROAD, not a tongue of tarmac.** RCT2 hands the exit an ORDINARY FOOTPATH — the same tile the streets are made of — and in this design system a street is three courses, not one: `buildPathNetwork` lays a pave slab, pale KERB strips straddling both edges 0.01 proud, and expansion-joint SEAMS every half tile. The exit run had only the slab, so every ride ended in a flat grey tongue that plainly was not the road it joined. `buildExitLane` now lays the same three courses in the same cross-section (`KW` 0.08 kerbs at `W/2 + 0.02`, seams every 0.5), on the inclined plane of each leg, so the join at the street is invisible. `RideConfig.exitSurface` widened from `{ pave, paveTex?, rough? }` to the full street palette (`kerb?`, `seam?`, `kerbTex?` as well), so a themed land passes its `theme.pathSurface` straight through and gets a themed kerb too; both fall back to `SURFACE_TARMAC`'s.

Measured by `probe-access-grade.mjs`'s lateral profile (a cross-section rayed at three longitudinal offsets, because a seam spans the full width and would otherwise mask the lip): **every exit path reads a 0.01 kerb lip on both sides**, and 0 of 7 do when the kerb block is removed.

## MULTI-STATION RIDES — `RideConfig.stations` (ADDITIVE)

An RCT2 `Ride` owns an **ARRAY** of stations — `std::array<RideStation,
Limits::kMaxStationsPerRide> stations` (`ride/Ride.h:404`;
`kMaxStationsPerRide = 255`, `Limits.h:19`, with the legacy RCT1/RCT2 save
format capped at 4, `rct12/Limits.h:21`) — reached through
`Ride::getStation(StationIndex)` / `getStations()` (`ride/Ride.h:414-417`) and
counted by `numStations` (`:263`). The TRANSPORT rides are why it exists:
`ride/rtd/transport/Monorail.h:19-84` sets neither `RtdFlag::hasOneStation`
(`ride/RideData.h:437`, only GoKarts + MiniGolf) nor `hasSinglePieceStation`
(`:342`, flat rides), so its station count is unlimited.

`registerRide`'s own `queueAnchor`/`queueDir`/`boardPoint`/`exitPoint`/`exitDir`
still describe **station 0**, unchanged, so every single-station ride in the
catalogue registers on exactly the path it always did. Each entry in
**`cfg.stations: RideStationConfig[]`** adds another PLATFORM built by the same
code: its own queue lane, entrance hut, exit hut, exit footpath, routing spurs,
pad blocker and lane railings, its own placement audit, and its own
`STR_EXIT_NOT_CONNECTED` check. `RideRec.stations[]` is the live array —
`stations[0]` is a VIEW over the ride's own fields (the same objects, delegated
by accessor), which is why `rec.queue` / `rec.dir` / `rec.exitPos` still mean
"the platform the FSM is working with".

**THE CYCLE.** `RideRec.atStation` is RCT2's `Vehicle::current_station`
(`ride/Vehicle.h:198`). The train visits platforms in ARRAY ORDER and STOPS AT
EVERY ONE — that is not a choice: a station-indexed track piece raises
`VEHICLE_UPDATE_MOTION_TRACK_FLAG_3` (`ride/Vehicle.TrackMotion.cpp:433`),
`UpdateTravelling` converts it unconditionally to `Status::arriving`
(`ride/Vehicle.Station.cpp:1503-1511`), `UpdateArriving` brakes into
`unloadingPassengers` (`:1720-1724`), `UpdateUnloadingPassengers` pushes EVERY
guest off (`:974-981`), and `movingToEndOfStation` → `waitingForPassengers`
(`:1003`, `:449`) reopens the doors. So `arriving` advances `atStation`, unloads
through THAT platform's exit and loads THAT platform's queue. `rideDuration` is
the FULL CIRCUIT and each leg gets `rideDuration / nStations` — RCT2 stores
exactly that per station as `SegmentTime`, *"Time for train to reach the next
station from this station"* (`ride/Ride.h:175`). A transport ride also departs
an EMPTY platform once `minWait` expires (RCT2's max-wait timer runs whether or
not anyone boarded, `ride/Vehicle.Station.cpp:598-605`) — a rider-less
one-station ride still waits indefinitely. Everything else about the departure
is the BOARDING-QUIET WINDOW below, which is shared by both.

**THE TRANSFER, and what it is not.** A rider leaves through the exit of the
platform the train is AT, never the one it boarded from — RCT2 overwrites the
peep's own index with the vehicle's (`CurrentRideStation = ride_station;`,
`entity/Guest.cpp:4192` + `:4226`) and then reads `station.Exit` off THAT
station (`:4236`). We keep `SimGuest.boardStation` purely so the A→B case is
COUNTABLE (`RideRec.transfers`, `handle.transfers()`,
`mgr.stats().transfers`) — it changes no behaviour, and RCT2 stores no such
thing. **There is no guest transport ROUTING in RCT2 and none here.** Ride
choice is `GuestFindBestRideToGoOn` — highest excitement within 10 tiles
(`entity/Guest.cpp:1943-1970`) — and `peep/GuestPathfinding.cpp:813-815` still
carries the original *"The rideIndex will be useful for adding transport rides
later."* The only two reads of `RtdFlag::isTransportRide` in the whole game are
cosmetic exceptions for a FREE one: a guest LEAVING the park will still board it
(`entity/Guest.cpp:1989-1998`) and the rating/price/crash/weather checks are
skipped (`:2048-2053`). Register transport rides at `price: 0`.

Our one addition beyond RCT2 is navigational and small: an aimless guest heading
for a multi-station ride aims at its NEAREST platform rather than always
platform 0, because a park-spanning ring is only useful if the guest walks to
the station in the district it is standing in.

**KNOWN LIMIT — THE MOVERS ONLY MOVE PLATFORM 0.** `moveRide` / `moveRideExit` /
`resizeRideLane` / `relocateExitLane` (access.ts) and the settle-time corridor
auto-resolver all operate on `RideRec`'s own fields, i.e. on **`stations[0]`**.
They are how a *compact* rig is nudged out of a coaster corridor; a
park-spanning transport circuit must not be nudged at all, and its extra
platforms therefore have no auto-fix path. **Register a multi-station ride
`pinned`** and place its platforms correctly up front (the §4.2 block publishes
the arithmetic). A platform whose queue or exit does not reach the street is
reported, not repaired.

**WHAT TO GATE ON.** `handle.stations()` / `accessPoints().rides[i].stations[]`
publish per-platform `{ idx, label, boardPoint, queueAnchor, queueDir,
queueNode, exitAt, exitDir, exitNode, exitLaneLen }`. **Every** platform needs
`queueNode >= 0` and `exitLaneLen > 0`, exactly like a single-station ride —
a platform guests cannot reach is not a station. `handle.stationCount()`,
`handle.currentStation()` and `handle.transfers()` complete the picture, and
`rides()` rows carry `stationCount` + `transfers`.

RCT2 gives a ride **two** path connections of two different kinds, and until now `registerRide` built only one of them. The entrance takes a QUEUE (`FootpathChainRideQueue`, Footpath.cpp:794-921). The exit takes an **ORDINARY FOOTPATH**, and that is a mechanic, not decoration: a guest finishing a ride is put down on the tile immediately OUTSIDE the exit (`updateRidePrepareForExit`, Guest.cpp:4412-4452 → `updateRideLeaveExit`, :5092-5140); with no path there `Peep::UpdateFalling` drops them onto the bare terrain (Peep.cpp:781-890) or DROWNS them over water (:831-854), and the park carries a recurring red `STR_EXIT_NOT_CONNECTED` — *"has no path leading from its exit! Construct a path from the ride exit"* — for as long as the ride is open (Ride.cpp:2076, test Ride.cpp:2035 → Map.cpp:707-741).

- **`RideConfig.exitDir?: [number, number]`** (ADDITIVE) — the exit hut's **OUTWARD** doorway facing, unit and axis-aligned. RCT2 stores the element `direction` pointing INWARD at the station and attaches both paths on the reverse side (`kEntranceDirections` = 4, EntranceElement.cpp:22-26 + Footpath.cpp:118-121); this is that reverse, the sense of the UI's `gRideEntranceExitPlaceDirection` (openrct2-ui/ride/Construction.cpp:479-483). **Pass it.** Omitted, the facing falls back to the legacy `boardPoint → exitPoint` vector — which is only axis-aligned when the exit sits square off the pad, and the RCT2 layout puts the exit ADJACENT to the entrance on the same face, making that vector diagonal and skewing the hut off the cardinal grid (measured yaws like `[-0.47, -0.89]` before the fix).
- **`RideConfig.exitSurface?`** (ADDITIVE) — what the exit path is paved with; default `SURFACE_TARMAC`, municipal grey. Never the red queue. A themed land passes its own `theme.pathSurface`, the way the queue lane takes `queueSurface`.
- **`planExitLane` / `buildExitLane`** (access.ts) — the run is cast from `exitPoint + 0.62·exitDir` (the doorway apron, mirroring the entrance hut's 0.62 behind the queue head), **cardinal only, at most two legs**, and it is UNFENCED: a queue must only be enterable at its open tail, so its sides are railed and blocker-registered, whereas a footpath is walkable from any side, which is what a leaving guest needs. Two cases, shorter wins:
  * **THE RAY** — one straight leg along `exitDir` to the first street NODE on it (±0.45 lateral) or street EDGE it crosses, within 9 u. With the RCT2 layout that ray runs parallel to the queue lane one tile over and meets the CROSS-STREET through the queue's own tail node, so the exit path is the same `laneLenOf(capacity) + 0.35` the queue is.
  * **THE JOIN** — out level with the queue tail, then ONE TILE across onto it. This is the dead-end-court-spur case: no cross-street for the ray to meet, so it would otherwise sail past and run to the next street (measured on `worlds-ref`: 6.1-8.3 u runs across three set-piece quarters, and twice nothing at all inside 9 u). The join is the move a player makes — the exit path runs alongside the queue and meets the same footpath at its end.
  Only rendered STREET nodes/edges count as targets (`Sim.coreNodeCount`, snapshotted before any `routing.attach` spur is pushed onto the shared arrays).
- **Audited like the queue lane.** Both legs are registered footprints — `<name> exit lane`, `<name> exit lane join` — so the OBB sweep, `bounds`, the wet-pad guard, AUTO-keepDry and the track-corridor sweep all see them. `auditExitLane` records a crossing as an `accessAudit` residual (no safe auto-fix: the run is pinned at both ends). EXEMPT: the ride's own exit hut (the path abuts its doorway apron by design, as the entrance hut abuts the head of its queue lane) and its own queue lane/entrance hut (the JOIN leg lands on the queue's own tail — one rig, one plan).
- **`replanExitLane`.** Unlike the queue lane, which is pinned only at its head and travels with a shifted rig, the exit path is pinned at BOTH ends. `moveRide`, `moveRideExit` and `resizeRideLane` therefore RE-CAST it in place — mesh rebuilt at the new length, footprints replaced, routing spur pulled onto the new end.
- **`exitAttach` is now the point where the path MEETS THE STREET**, not a bare 1.5 u step out. `rideFsm.unloadRiders` already walked riders `exitDoor → exitAttach`, so the whole walk out is on paving; the 1.5 u fallback only survives for the no-path case.
- **Exposed:** `handle.exitLane()` → `{ len, dir, end }` (`len: 0` = the `STR_EXIT_NOT_CONNECTED` state) and, on `accessPoints().rides[]`, `entranceAt`/`entranceDir`/`exitAt`/`exitDir`/`exitLaneLen`/`exitLaneEnd` — what `validatePark` check a4 audits.

## Ride FSM — RCT2 `Vehicle::Status` (Vehicle.h:123)

`movingToEndOfStation → waitingForPassengers → waitingToDepart → departing → travelling → arriving → unloadingPassengers → movingToEndOfStation`. `waitingForPassengers` admits up to `capacity` guests one at a time; `travelling` lasts `rideDuration`.

#### THE DEPARTURE RULE — the BOARDING-QUIET WINDOW (2026-07-28)

**A ride does not wait for a full vehicle.** Once the first guest is seated the platform holds the doors open `quietWait` seconds (`BOARD_QUIET_SECS` = 10, per-ride override on `RideConfig`) for the NEXT guest; every boarding restarts that window; when it runs out with anyone aboard, the ride leaves. A FULL vehicle skips the rest of the window (it has nothing left to wait for), and the dwell is capped at `maxWait` measured **from the first boarding**. The whole rule, verbatim:

```ts
if (st.entering.length === 0) {
  if (
    (laden && ((full && r.timer >= r.minWait) || quietOut || capped || (r.timer >= r.minWait && st.queue.length === 0))) ||
    (!laden && nStations > 1 && r.timer >= r.minWait && st.queue.length === 0)
  ) setState(r, 'waitingToDepart', 0.6);
}
```

Three things make it work, and each of them was a defect before:

1. **A BOARDING is a rider ARRIVING, not the queue moving.** `queue.shift()` only moves a guest into `st.entering` — mid-doorway, and `drainRide` can still send them back out — so the window is measured off `riders.length` growing past `RideRec.boardedSeen`, which is exactly when `guestPass.ts` pushes a guest onto `riders`. `boardAt` / `lastBoardAt` stamp `r.timer` at the first and the most recent boarding; all three reset on entry to `waitingForPassengers`.
2. **`maxWait` is anchored on the first BOARDING, not on the train's arrival.** Anchored on arrival (RCT2's own `time_waiting`) the ceiling had usually expired *before anyone sat down*, so the ride bolted the instant the first guest was seated: measured behind a 30 u queue lane, **2.00 riders per departure with 25 guests still queuing**, and a median first-boarding→departure of **0.03 s**. A ceiling on a dwell is only meaningful once the dwell is productive.
3. **`doorsClosing` stops admitting once the ride has decided to leave.** `st.entering.length === 0` is the invariant that outranks every timer — departing on top of a guest walking through the entrance hut would strand them in `enteringRide` with no vehicle — but admitting the next queue head the moment the last one sat down keeps that set non-empty, so without this the departure is unreachable behind a busy queue and the vehicle can only ever leave FULL. Anyone already in the doorway still boards; the queue waits for the next train.

A transport ride also departs an EMPTY platform once `minWait` expires (RCT2's max-wait timer runs whether or not anyone boarded, `ride/Vehicle.Station.cpp:598-605`) — that clause is untouched, and it is still the ONLY way a rider-less vehicle departs: a single-station flat ride waits indefinitely for its first guest.

**MEASURED, before → after** (`node harness/park-eval/probe-board-quiet.mjs [--legacy]` — the real `createGameManager`, headless, 1800 sim-s per scenario at dt = 1/30; `--legacy` restores the old condition in memory so the A/B stays reproducible). Capacity 8, `rideDuration` 12 s, `quietWait` 10 s, `maxWait` 12 s:

| | flat, trickle | flat, 24 at once | flat, 60 at once | flat, 30 u queue lane | 4-platform monorail |
|---|---|---|---|---|---|
| first boarding → departure, median | 9.12 → **12.40 s** | 8.98 → **12.08 s** | 8.93 → **12.07 s** | 0.03 → **12.07 s** | 3.88 → **1.70 s** |
| riders per departure | 4.38 → **5.14** | 4.33 → **4.68** | 4.15 → **5.03** | 2.00 → **3.21** | 2.75 → **2.97** |
| riders BOARDED / sim-min | 5.83 → **6.00** | 6.07 → **5.93** | 5.67 → **6.03** | 1.27 → **1.50** | 3.67 → **3.67** |
| riders SERVED / sim-min | 5.33 → 4.77 | 5.60 → 4.80 | 4.63 → 4.63 | 1.07 → 1.07 | 3.20 → **3.37** |
| departed with a guest mid-doorway | 0 → **0** | 0 → **0** | 0 → **0** | 0 → **0** | 0 → **0** |

Read that honestly, because two of the numbers are not wins:

* **The 10 s quiet window is almost never the deadline that fires.** Measured inter-boarding gaps are a median **1.8–2.0 s**, five times shorter than the window, so on a busy platform it re-arms continuously and the **`maxWait` cap ends 29–34 of ~36 departures**; the quiet window itself ends 2, and 6 of 14 in the long-queue case. The rule as asked for ("wait 10 s for no guest to go in") therefore behaves, on any ride with a queue, as *"load for up to `maxWait` seconds from the first boarding"*. Lower `maxWait` to make rides leave sooner; `quietWait` only governs a platform that goes quiet.
* **Riders SERVED per sim-minute fell ~10 % on two scenarios while riders BOARDED rose.** The gap was riders lost to a breakdown *while loading* (`drainRide` unloads them as `notSafe` and credits nobody): 15 → 37 and 14 → 34 lost per 1800 s. A longer dwell is longer exposure at a mean breakdown interval of ~40–95 s. It was a property of the breakdown schedule, not of the departure rule — **and that schedule has since been removed outright** (see "NO RIDE CAN BREAK DOWN" below), so this cost is now structurally zero and BOARDED equals SERVED. The two figures above are kept as the historical measurement that identified the cause; do not re-measure them expecting the same gap.
* **Every first cycle lands ~6–13 s later.** That broke `validatePark`'s sim-smoke window, so **the window moved with the rule: `SIM_SMOKE_SECONDS` 60 → 85** (`ParkBuilder/validate.ts`). See the next section — do not put it back.

#### THE ACCEPTANCE GATE MOVED WITH THIS RULE — DO NOT "OPTIMISE" IT BACK

Two numbers in `ParkBuilder/validate.ts` were calibrated against the OLD departure rule and both had to move. Neither is a preference; both are measured, and both have their derivation in the source comment beside them.

| | was | now | why |
|---|---|---|---|
| `SIM_SMOKE_SECONDS` | 60 | **85** | A ride used to bolt the instant its first guest sat down (arrival-anchored `maxWait` had already expired on an empty platform), so first cycles were as fast as the sim allowed. `riddenTotal < 1` is a hard `sim` FAILURE, and at 60 s the 15 u queue-tail floor that `rules/park-generation-checks.md` §0.3 *publishes* now measures 62.0 s — a compliant park would fail. |
| `stallSecs` | `max(30, maxDur + 15)` | **`max(45, round(0.75·secs))`** | The old threshold was meant to bound ONE ride cycle and did not: measured, the longest legitimate queue hold at `rideDuration` 12 is 42.5 s single-station and 51.5 s on a 4-platform ride — **already over 30 s under the OLD rule** (33.5 s / 43.5 s), it just never got observed because the 60 s window ended first. Raising the window exposed it as a false `sim` FAIL on the reference park `arch-ref` ("Tarn Wheel: its queue held for >30 sim-s"). |

**The crowd measurement is the one that set 85 s, not the 12-guest sweep**, because a crowd now makes the gate HARDER — every boarding re-arms the quiet window, so more guests means a longer dwell. `probe-gate-stream.mjs gate --guests=12,22,50,75,100 --d=6,15,18,20,24`, worst cell per distance: 6 u **55.5 s**, 15 u **73.5 s**, 18 u **74.5 s**, 20 u **77.5 s**, 24 u **82.0 s**. At 85 s the published 15 u floor keeps **11.5 s** of margin and the 20 u practical limit **7.5 s**; at 80 s the floor would keep only 6.5 s, and the observed chaotic spread at a FIXED distance across crowd sizes is ~10 s (15 u reads 60.0/72.0/73.5/63.0/72.0), so anything under that spread is not a margin. Under the OLD rule at 60 s that same floor measured 60.0 s at 22 guests — **0.0 s of margin**, i.e. §0.3's floor was knife-edge before any of this.

Cost of the wider window, measured with `probe-perf.mjs` off `<Park>`'s own `[Park] perf: … validate` figure: `demo-ref` 84 → **105 ms**, `arch-ref` (128 plot) 114 → **171 ms**. A 42 % longer headless loop is ~57 ms on the priciest reference park, against a false FAIL that costs a whole park round. `demo-ref`, `arch-ref`, `setpiece-ref` and `district-ref` all return `validatePark ok: true` with 0 failures afterwards.

`onStateChange(state, occupancy?)` fires on every transition — the second argument is ADDITIVE (`{ riders, capacity, occupied }`, exported as `RideOccupancy`), so existing single-arg callbacks keep working.

### `createMotionGate(update, { spinUp?, spinDown? })` — station behaviour for ride VISUALS

RCT2 vehicles WAIT in the station while guests board and stop again to unload, but catalog ride visuals animate on an absolute clock. `createMotionGate` wraps such an updater with an internal gated clock (dt clamped ≤ 0.1): the clock only advances while the FSM says the vehicle is in motion — speed eases 0→1 over `spinUp` (0.8 s) on `departing`/`travelling`, eases 1→0 over `spinDown` (1.2 s) into `arriving`/`movingToEndOfStation`/`brokenDown`/`beingRepaired`/`crashed` (the graceful spin-down. The FSM never EMITS the two mechanic states — no ride can break down — so those two arms only fire when a park drives a visual through them by hand; they are kept because that is still a legal thing to ask for), and is a HARD 0 in `waitingForPassengers`/`waitingToDepart`/`unloadingPassengers`. Returns `{ update, onStateChange, speed(), clock() }` — wire `update` as the built result's updater and CHAIN `onStateChange` before the ride's own handler (compose, don't replace a ride's own spin-down). CRITICAL: the gate starts **UNGATED** — raw time passes straight through until the first `onStateChange`, so un-registered previews are byte-identical. The wrapped updater receives the eased speed (0..1) as a second argument: oscillating rides use it as an amplitude envelope (`× motionK`) so ships/arms/towers SETTLE level or at the base instead of freezing mid-swing; cycle rides key their phase off `clock()` captured at `departing` so every run starts from zero. Fleet-wide exceptions: **Chairlift** (real chairlifts circulate — guests board moving chairs) and **HauntedMansion** (walkthrough — nothing to park).

### `makeSeatWorld(t, seats)` — the standard seatWorld factory

Builds a `RideConfig.seatWorld` from an array of anchor `Group`s parented into the MOVING vehicle parts: seat index → live world `[x, y, z, yaw]`. Register rides with `capacity === seats.length` (RCT2: a ride's capacity IS its seats) so distinct riders always land in distinct anchors and a partial load leaves visibly EMPTY seats. The `registerRide` handle exposes `seatAt(k)` (the live transform, `null` without seatWorld) so harness probes can assert riders sit in distinct seats.

## Boarding — RCT2 `PeepRideSubState` (entity/Peep.h:81); guests NEVER walk on the ride

- **atEntrance → inEntrance:** the queue-front guest is admitted, pays, and walks doorway → hut INTERIOR — the waypoint chain ends INSIDE the entrance hut, where the guest is hidden for a 0.35 s dwell. They never walk toward `boardPoint`.
- **seated (`onRide`):** the ride then SEATS them — they re-appear ON the vehicle, visible occupancy. Each rider takes the seat matching its position in the ride's rider list: `RideConfig.seatWorld?(seat) → [x, y, z, yaw]` (guest group origin/feet, called per frame — attach riders to a live spinning rotor) or, without it, a compact ring around `boardPoint` (radius 0.3, sunk 0.12 so the lower legs read as inside the vehicle body). Seated pose: pose-layer `idle` with the bob flattened, arms folded to a lap bar through an eased envelope when `buildPeep` exposes `armL`/`armR` (feature-detected).
- **leaveVehicle → inExit → leaveExit:** on unload, riders teleport INSIDE the exit hut (hidden, staggered 0.6 s apart), then re-appear walking OUT through its front doorway — apron, 'wow' hop there (~60 %), then the exit attach node and back onto the network (`leavingRide → walking`), with RCT2 ride satisfaction: happinessTarget +40, thought "Wyrm's Hollow was great!" (`wasGreat` carries the ride id in RCT2 too, Guest.cpp:1836 — the thought NAMES the ride they just rode), nausea gain scaled by ride intensity.

### KNOWN (pre-existing, NOT fixed here): `moveRide` double-shifts exit-lane rects

`moveRide` shifts `accessG`, calls `replanExitLane` — which removes the old
`… exit lane` / `… exit lane join` footprints and re-adds them **at the new
world position** — and only THEN walks `allFootprints` shifting every
`${name} ` rect by the same `(dx, dz)`. The freshly-correct exit-lane rects get
the move applied a second time, so after any corridor auto-resolve the audited
rect sits one move-delta off its own mesh. Surfaced by
`probe-access-grade.mjs`'s `drift` column: on `r16a` the Glimmerwake exit lane's
rect is **2.4 u** from where the ride reports its run ends (every other run
reads 0.00). The mesh and the routing are right; only the collision audit reads
the wrong rectangle. The fix is to reorder those two steps, but it moves an
audit that `validatePark` gates on, so it is reported rather than changed as a
side-effect of unrelated work.

## Entrance/exit placement audit — `placeAccess`

`registerRide` runs a deterministic footprint audit before building anything: conservative oriented rectangles (2D SAT) for the entrance hut (0.55 × 0.5 half-extents), exit hut, queue lane (0.36 × laneLen/2), the EXIT PATH's one or two legs (0.30 × len/2 each) and the `boardPoint` pad (0.45 square), checked against each other (the entrance hut/lane abutment is exempt — by design) AND every previously registered ride's footprints. Any entrance/lane collision is `console.warn`ed with specifics (no safe auto-fix — adjust `queueAnchor`/`queueDir`). An exit-hut collision is auto-fixed: the exit slides along its pad edge (the tangent ⟂ to its `boardPoint → exitPoint` facing), first non-colliding offset in `0, ±0.1 … ±0.8`, warned with the applied shift. The ride handle exposes the result: `exitPoint()` (resolved centre) and `exitShift`. RESIDUAL collisions (the no-auto-fix entrance/lane overlaps, and an exit hut still colliding after the ±0.8 search) are also recorded and exposed via `accessAudit()` — ParkBuilder's `validatePark` promotes every residual its own OBB sweep didn't already fail on into a hard `footprints` failure, so an access overlap can never remain a console-only warn.

**Crashes:** `RideConfig.vehicleHandle?: { crashed?(): boolean }` — when it reports true the ride enters `crashed`: the queue is emptied (thought "it isn't safe", happinessTarget −30, guests walk away), anyone aboard escapes via the exit with the same penalty, and the ride never admits again.

## Purchases (Guest.cpp:1529 `DecideAndBuyItem`)

`registerStall({ name, item, price, value, anchor, dir, heldItem? })` builds NOTHING visual — only a logical attach point 0.72 u in front of the stall (shop meshes are separate components; ParkBuilder places them). `item` is a `StallItemKind` (exported): CONSUMABLES `'food' | 'drink'` and ACCESSORIES — `'balloon'` (held in a hand, flies away) and `'wearable'` (worn on the head, kept for the visit) — and the union stays OPEN (`string & {}`) so future kinds (RCT2 ShopItem, Guest.cpp:6928-6941) are additive. `heldItem` is the stall's OWN 3D item for its customers (see "Per-stall held items" below). A guest in `buying` walks to the counter and transacts for 1.2 s.

**Two-hand gate first (see Hand slots below):** no free hand → "My hands are full" (`handsFull`, SIM-ONLY — the two-hand registry is this sim's addition); a consumable while a consumable chain is still active → "I haven't finished my drink yet" (`haventFinished` — RCT2 passes the ShopItem ALREADY IN HAND, not the shop's, Guest.cpp:1546-1553). Then the classic refusals for consumables: nausea ≥ 145 ("I feel sick"), food while hunger > 75 ("I'm not hungry"), drink while thirst > 75; and for everything: empty pocket → "I've spent all my money" (:1598), cash < price → "I can't afford food from Ember Roast" (:1603), overpay tolerance `price − value ≤ hashed(0..7)` DOUBLED at happiness ≥ 128 (the halved-penalty rule) → "I'm not paying that much for the drink from Soda Stand" (:1625). Good value → happinessTarget += 4·(value − price) + "This drink from Soda Stand is really good value" (:1640).

**Shop thought subjects.** RCT2's shop strings pair an item noun with the SHOP's name — "This burger from Chuck's Burger Bar is really good value" (STR_1524), "I'm not paying that much for a burger from …" (STR_1558). This sim's stalls carry a name and an item KIND but no per-item string table, so the subject is composed as `<noun> from <stall>` with noun ∈ food / drink / balloon / souvenir. The shop is always named. A successful consumable purchase sets `holding = item` in the chosen hand and starts the ~6.4 s consumption above; a successful BALLOON purchase adds +12 happinessTarget (RCT2 cheap-joy item) and puts a held balloon in the free hand (see below). Guests seek food/drink stalls when hungry/thirsty as before; accessory stalls are JOY buys — a 30 % passing impulse (6 % once they already hold a balloon — and a both-hands-full guest still occasionally steps up and collects the visible `handsFull` refusal) plus an aimless-wander goal chance.

A `'wearable'` purchase skips the hand gate entirely (it goes on the HEAD): the only gate is "am I already wearing something?" → `alreadyWearing` ("I've already got one of those"). Wearable stalls are JOY buys like balloons — a hashed passing impulse on the aimless-wander roll, once per guest.

## Per-stall held items (`StallConfig.heldItem`) — a stall's OWN 3D item

A stall may ship the actual 3D object its customers walk away with, so a park is not full of guests eating the same generic burger: `heldItem?: StallItemBuilder` where `StallItemBuilder = (t: typeof THREE) => THREE.Group` (both exported). Contract:

- The builder returns a FRESH group built around ITS OWN origin in PEEP-LOCAL units (head r 0.12, fist ball r 0.05 — the 0.5 `GUEST_SCALE` is applied by the guest rig, so never pre-scale for it). Fist-to-head sizing is what reads at park zoom.
- It is called ONCE per stall; the manager `clone()`s that prototype per purchase (geometries/materials are SHARED with the prototype — that is also why nothing is disposed when an item leaves a hand: the clone's wrappers are garbage, the shared resources are not). So a builder must be deterministic and allocation-light.
- The manager parents the clone under an anchor that already carries the tuned attach transform: for consumables the HAND hold spot (arm-local `(±0.03, −0.37, 0.15)`, drinks pulled in to z 0.115) with the carry-bend clamp and the bite/sip lift; for `'wearable'` the peep's `headSlot` (crown of the skull, +z = face).
- Whatever `position`/`rotation` the builder sets on the group IT returns is an OFFSET from that anchor — a floss cone tips itself forward and pulls itself back into the fist, goggles drop to the brow line — so a recipe can fine-tune its own fit without touching sim geometry.
- Omit it and consumable buyers keep the generic burger / cup. The eaten-down CONTAINER stage is untouched either way: when the meal runs out the themed mesh leaves the hand and the generic crumpled container takes over, so the bin/litter lifecycle is unchanged.

The four catalog shops each export their recipe and register it: `buildHeldBurger` (BurgerShop), `buildHeldHotDog` (HotDogStand), `buildHeldSoda` (SodaStand — a mini can), `buildHeldFloss` (CottonCandyStand). Through `<Park>` the descriptor carries it (`composableStall(..., { …, heldItem })`) and a placement can override it with `register={{ heldItem }}`.

## Wearables — the HEAD slot (`item: 'wearable'`)

Beside the two hands there is a THIRD attachment slot: `buildPeep`'s `headSlot` (see components/Guest). A `'wearable'` stall's `heldItem` mesh is parented there on purchase — same purchase→attach lifecycle as a balloon (+12 happinessTarget, the cheap-joy bump), but WORN: no eat/drink cycle, no container, no litter, no fly-away and NO drop schedule. It is kept for the REST OF THE VISIT, which also means it survives boarding a ride, the entrance-hut hide/unhide and every pose overlay for free — the rig carries it, so there is no per-frame work and nothing to lose. One head, one item. `guests()`/`recordOf` report it additively as `worn: string | null` (the name of the stall that sold it).

## Hand slots — two hands, max ONE item per hand

Each guest has a LEFT and RIGHT hand slot (plus the HEAD slot for wearables, above). Consumables (food/drink → container) occupy `eatHand` — RIGHT preferred, falling back to the left when the right is taken (the eat/drink overlay, fling and container flow all follow the hand). Accessories (balloons) take WHICHEVER hand is free, LEFT preferred so the right stays available for snacks — so `balloon + drink` is a common sight, and two balloons (one per hand) is possible but rare. A purchase that finds no free hand refuses with the `handsFull` thought. `guests()`/`recordOf` expose the registry additively: `hands: { left, right }` with `HeldItemKind | null` (`'food' | 'drink' | 'container' | 'balloon'`), and the head slot as `worn: string | null`.

## Held items + eat/drink animation

A consumable purchase puts a VISIBLE item in the guest's eat hand, parented to that arm pivot at the hand position (arm-local `[0, −0.34, 0.03]`) so it tracks every swing. Food = a sesame-crowned burger (3 merged meshes: bun crown + heel with same-tint seed bumps, an uneven grilled patty overhanging the bun, and a lettuce frill in the seam); drink = a lidded red soda cup (2 merged meshes: tapered body with a rolled rim, base ring and printed band, plus a cream lid + straw) — unless the selling stall supplied its own (`StallConfig.heldItem`, above), which stands in for these while the meal lasts; when consumption ends (`holding = 'container'`) the item swaps to a crushed grey carton (1 merged mesh: a stamped-flat base with two collapsed leaves folded over it) until it's binned or dropped (the existing litter/bin flow, unchanged). The three meshes are built ONCE per guest PER HAND on first use and only shown/hidden after — no per-frame allocation. While `holding = 'food'`: an eat cycle every ~1.6 s — the eat arm eases up to ≈ −2.2 rad (hand at the mouth) over 0.35 s and back down over 0.35 s, with a tiny head nod into each bite. While drinking: longer swigs, less frequently — a ~1.2 s raised hold every ~3.4 s with a slight extra arm tilt (−2.35) and the head tipping back. The override composes ON TOP of the pose layer through an eased envelope (`eatK`) and a final eat-arm slew guard — starting or finishing a snack mid-cycle never snaps the arm — and is suppressed while seated on a ride (the lap-bar pose wins). Deterministic (time + guest phase).

## Balloons — hold, DROP, fly-away (RCT2 Guest.cpp:6939-6963, Balloon.cpp:33-71)

A bought balloon is a TWO-MESH rig on the free hand's pivot: a thin string straight UP from the fist (0.55 local), and one merged balloon body — pear-shaped, with a tapered NECK and the tied knot at its tip, which lands exactly on the string's top end — in a colour hashed deterministically per guest+hand from `BALLOON_COLS` (RCT2 assigns `balloonColour` at purchase, Guest.cpp:1682). The ARM STAYS RELAXED — a per-frame counter-rotation keeps the string world-up over the swinging hand with a gentle hashed sway, sampled after every arm overlay so it rides the final pose. The hold lasts a hashed **60–120 sim-s** per guest (RCT2 instead rolls a ~0.5 %/tick blow-away chance, Guest.cpp:6951 — same expected fate, deterministic here); ride exits add a 12 % hashed slip chance and the post-ride 'wow' hop a 15 % one (earlier `dropAt`). On the DROP the rig detaches exactly at the ball's world position and becomes an airborne balloon (pooled, cap 10, oldest slot reused): ACCELERATING buoyant climb (0.25 u/s + 0.15 u/s² — RCT2 balloons climb steadily until they pop at altitude, Balloon.cpp:33-71), hashed wind sway + drift, a slow spin, then it shrinks/fades out above ~8 u of climb and frees its slot. The ex-owner loses 4 happiness (value and target) and glances UP sadly for ~1.6 s (head-tilt overlay). Drops are deferred while hidden or seated (`onRide` — the lap bar pins the hands).

## Restrooms + the poop fallback

`registerRestroom({ anchor, yaw? })` or `registerRestroom({ doorway })` — LOGIC only; the caller places the `buildRestroom` hut mesh. With `anchor`/`yaw` the manager derives the world doorway from the buildRestroom contract (`anchor + rotY(yaw)·[0, 0, 0.72]`, walk-in height +0.08 = the apron top); a world `doorway` point is accepted directly. The doorway gets a routing attach spur. Returns `{ uses() }`.

- toilet ≥ 200 (walking, aimless) → goal-seek the NEAREST restroom via the routing net; on arriving at its attach node the guest walks through the doorway, is hidden 2 s (`usingRestroom`, "relieving"), then toilet resets to 40, happinessTarget +10, and they rejoin the network at the doorway spur.
- **Poop fallback:** if toilet reaches 255 and NO restroom is registered/REACHABLE (checked over the routing graph from the guest's current node), a small discreet poop mesh (ONE merged mesh: a tapering coil of three squashed rings on a ground smear, capped with a soft peak — the RCT2 silhouette) is dropped at the guest's verge position — capped at 8 meshes, oldest reused — toilet resets to 30, thought "Oh no... how embarrassing!" and happiness −20 (value AND target). Nearby guests treat poop like litter in the existing ≥3-within-1.2 u blight check, with each poop counting DOUBLE. With a reachable restroom the need simply clamps at 255 while the guest seeks it — no poop.

## Guest event animations (throw trash / throw up / poop squat)

Three visible one-shot events, all deterministic and composed OVER the pose layer:

- **Throw trash:** when the litter chance fires, the guest plays a 0.65 s eat-arm FLING (wind-up back, sweep forward with release at 0.28 s, recover — a pure additive offset that is 0 at both ends and peaks at ~7.8 rad/s, under the pose layer's 8.5 rad/s continuity limit) and the scrap mesh ARCS from the hand to its ground spot on a 0.5 s parabolic tween (+0.3 lob over the chord, tumbling), landing in the normal litter ring (cap 40, oldest reused). The held container vanishes at release.
- **Throw up:** a walking guest with nausea ≥ 200 has a 20 %/s hashed chance to stop for 2.6 s (`'vomit'` action): eased hunch (torso pitch + head down through the slew-chased slump/tilt channels), face turns GREEN via `buildPeep().setSick(true)` (green-tinted grimace face — its own texture-cache key), and at the deepest point (1.1 s) a 12-droplet green ParticleKit burst fires at mouth height plus a splat decal ahead of the guest (ONE merged mesh: a wet puddle with three splash lobes creeping out of it and two chunks; own 8-slot ring, reusing the litter machinery; counts DOUBLE in the blight check like poop). Effects: nausea −130, happiness −12 (value and target), thought "I feel sick". The normal face is restored ~4 s after onset.
- **Poop squat:** the no-restroom fallback now plays a 0.8 s SQUAT first (walking guests only — hidden/stationary guests keep the instant drop): legs fold +1.15 rad, body drops, slight forward pitch, and the female skirt flares to cover; the poop mesh, toilet reset, −20 happiness and the "how embarrassing" thought all land as the guest stands, followed by the usual unhappy walk-off.

One shared burst-only vomit emitter (`ParticleKit.buildEmitter`, max 48) lives on the manager group; `update` also drives the thrown-litter flights.

## Litter + bins (Guest.cpp:5534-6256)

`registerBin(x, z)` (or `bins: [x,z][]` in opts) tracks LOGIC only — capacity 3 each; bin meshes are placed by the caller/ParkBuilder. A guest `holding = 'container'`: passing within 0.6 u of a non-full bin → `usingBin` (walk over, 0.8 s, deposit, count +1, then resume the exact edge position); otherwise each edge traversed carries a 6 % hashed chance to DROP litter, and a PATIENCE CAP guarantees disposal: ~30–45 hashed s after finishing (5–9 s for guests already walking OUT — the classic RCT2 exit-path litter) the container is thrown at the next stride — a litter pile spawns at their feet: ONE merged mesh per pile, drawn from 6 hashed variants of 2–3 pieces of recognisable rubbish (a crushed cup with its rolled rim, a scrunched foil wrapper, an emptied carton with the lid flap open, a dropped straw and lid) in a hashed tint — capped at 40 meshes, oldest reused. Guests passing ≥ 3 litter pieces within 1.2 u: happinessTarget −17 + thought "The litter here is really bad" (rate-limited per guest).

## Guests TRY THE WHOLE ROSTER (2026-07)

A guest's ride appetite was one 10 % roll per aimless junction that picked a **single** ride uniformly at random and then threw the roll away if that ride happened to be closed, unreachable, or the one they had just got off. That samples with replacement, so the attractions nearest the gate took the traffic and a guest who had already done everything nearby was as likely to re-pick it as to walk somewhere new. Three changes, all aimed at coverage:

- **Eligible list first.** `seekRide` builds the candidates (open, reachable, not the `LAST_RIDE_TIMEOUT` repeat) and draws from *that*, so an ineligible ride never wastes the decision.
- **NOVELTY FIRST.** `SimGuest.riddenIds` is the set of rides a guest has completed (`rideFsm` adds to it beside `g.ridden += 1`). The pool splits into unridden vs ridden and draws from the unridden one whenever it is non-empty. This is the whole "try them all" behaviour.
- **More appetite while anything is new.** `RIDE_SEEK_NEW` 0.45 with something unridden left, dropping to `RIDE_SEEK_REPEAT` 0.12 once they have done everything reachable — roughly the old rate, so a park still settles instead of every guest riding forever. Rides also moved to their **own** hashed draw: the sit/watch/balloon whims keep their original `p` windows, because folding rides into the same cascade would have handed their 10 % to the REST branch and made guests sit down *more*.

Two supporting changes: walking past a ride's own queue node steps up at **0.9** for an unridden ride (0.5 for one they have done, the old flat rate); and the intensity window is now **asymmetric** — see `joinRefusal`. One window meant a thrill-seeker *refused* the carousel, closing every gentle ride to every high-tolerance guest, so the tame side gets `TAME_SLACK` (4) extra and `moreThrilling` only fires when the ride is far below tolerance *and* the guest is already unhappy.

Measured on `monorail-ref` (100 guests, 600 sim-s) by `harness/park-eval/probe-ride-coverage.mjs`:

| | rides taken | spread | per guest | unridden |
|---|---|---|---|---|
| old flat 10 % | 91 | 32 / 26 / 19 / 14 | 0.91 | 0 |
| novelty-first | **120** | **38 / 34 / 25 / 23** | **1.20** | 0 |

**+32 % more rides taken and a visibly flatter spread** (the gap between best- and worst-attended ride closes from 32-vs-14 to 38-vs-23). Two new read-only accessors made this measurable at all: `rides()[].total` (per-ride lifetime rides — `stats().riddenTotal` is the sum and hides a park where two attractions take every rider) and `stats().simTime`.

> **Harness note, learned the hard way:** a script that steps the sim MUST start from `stats().simTime`. The first version of the coverage probe stepped `update(t, dt)` from `t = 0` on a page that had already been rendering, which sends the clock **backwards** — every FSM deadline landed in the future and it reported 0 rides taken while guests had visibly ridden 1.35 each.

## Benches — guests REST on them (RCT2 `PeepState::Sitting`)

`benches: { x, y, z, yaw }[]` in opts registers BENCH SEATS — logic only, exactly like `bins`; `<Paths>` publishes them off `buildPathNetwork`'s own `benches` (one entry per seat, two per bench) and `<Park>` forwards the list. A seat holds ONE guest (`BenchRec.taken`).

Before this the rest stop was a coin-flip that froze the guest standing wherever they happened to be, with the park's benches unused a metre away — RCT2's `Guest::UpdateWalking` (entity/Guest.cpp:2790-2860) picks a free bench addition on the tile and walks the peep ONTO it, and `UpdateSitting` (:2900-2990) runs the dwell and the energy recovery. Now:

- **THREE ways in, and the third is the one that matters.** On a node arrival: the standing 16 % whim anyone takes, and a WORN-OUT guest (energy ≤ 110) actively looking, which keeps rolling out to 0.30. But the decisive one is **walking PAST a seat** — checked in `guestPass`'s walking branch beside the litter-bin check, for a tired guest (energy ≤ 130) on a 35 %-of-seconds hashed coin with a 25 s bar after the last sit (`g.benchT`). RCT2 puts this in `Guest::UpdateWalking` too, and the difference is not cosmetic: verge furniture is planted at interval CENTRES and deliberately kept 0.85 clear of the junction pads, so a decision taken only on arrival at a node finds a bench on hardly any lattice. **Measured on r16a: 0 of 7 rests over 300 sim-seconds landed on a seat with 194 of them in the park; with the walk-past check, 13 guests seated at peak and 39 distinct seats used in 200 s.**
- **Reached like a litter bin, not like a stall.** `claimBench(g, reach)` takes the nearest free seat (2.6 u from a node decision, 1.25 u when walking past — a seat sits `width/2 + 0.34` ≈ 0.89 off the centreline, so anything tighter can never trigger); the guest keeps their edge position in `g.resume` and walks the last couple of metres off-network. **No routing spur per bench** — a lined street carries one every ~4.8 u on both verges, so a park-scale lattice publishes hundreds and that many logical nodes would swamp the routing graph.
- **A real sit-down.** 7-14 hashed seconds (against 3-6 for the standing pause), settled onto the seat point facing the way the bench faces, `energyTarget` climbing +9/s while sat and a +4 happiness lift on standing. Then back onto the edge the detour left from.
- **The pose.** `g.sitW` is an eased 0..1 envelope — the same shape as the lap-bar `lapW` — folding the legs to −1.5 and the arms to −1.1 and damping the idle bob, closing only once the walk to the seat has finished. `SIT_DROP` (`0.46 · GUEST_SCALE`) is the hip-pivot height that puts the thighs ON the slats.
- **The seat is never leaked.** `updateGuest` releases any bench held by a guest who is not in `sitting` (or is `gone`) as a per-frame invariant, so a maxed toilet, `beginLeaving` or a crash drain cannot permanently occupy one.
- **`mgr.setBenches(list)`** replaces the registered seats — `<Paths>` calls it when an AUTO-keepDry re-settle rebuilds the network under a manager that already read the old list. Anyone sat is stood back up first.

Measured by `harness/park-eval/probe-access-grade.mjs`: `monorail-ref` 60 seats / 13 seated at peak / 36 distinct seats used, `r16a` 194 seats / 13 / 39, both over 200 sim-seconds. Bench FACING (they all pointed away from the street) is a PathNetwork fix — see its Context.md.

## Attention zones — `registerDanceZone` / `registerWatchZone`

One rectangle shape, two sets of defaults. A wandering guest standing inside a registered zone takes a **0.35/s hashed chance** to stop and do something there, then walks on.

```ts
register{Dance,Watch}Zone({
  center, halfW, halfD, rotation?,   // world xz rect, rotated in <Park>'s local frame
  faceAt?,                           // world xz the guest TURNS TO FACE while latched
  linger?,                           // hashed dwell [min, max] seconds
  cooldown?,                         // PER-GUEST seconds after a dwell before this zone may latch them again
  gate?,                             // { happiness?, energy? } need floors to latch
})
```

| | `registerDanceZone` → `{ dancers(), cooldown() }` | `registerWatchZone` → `{ watchers(), cooldown() }` |
| --- | --- | --- |
| what the guest does | `action { kind: 'dance' }` — the pose sequencer's 2.2 Hz beat, beat-locked to a DanceFloor's tiles (both run off the same Stage clock). State stays `'walking'`. | `state = 'watching'` — RCT2 `PeepState::Watching`, standing still and facing `faceAt`. The same three fields (`state`/`timer`/`yaw`) `navigation.ts`'s "watch a nearby ride" sets, so no new pose or dispatch plumbing. |
| `linger` default | `[10, 30]` | `[4, 10]` — a glance, not a residency |
| `gate` default | `{ happiness: 160, energy: 129 }` — only a happy, energetic guest dances | none — anybody may look at a thing |
| `cooldown` default | **30 s** | **30 s** |

**The cooldown is not optional tuning — it is the fix for a measured deadlock.** Before it existed, the latch simply re-fired on a guest whose dwell expired while they were still inside the rectangle, and since escaping a ~2.3 u zone at ~0.55 u/s takes ~4 s the expected number of re-latches before escape was about five. On a dance floor that reads as a party; on a prop beside a street it is a permanent stop — MagicMirror's behaviour park pinned one guest **44.5 s of a 70 s run**, left **3 of 6 guests never resuming**, and failed `validatePark`'s `sim` gate (*"guest 1 stood still >25 sim-s while walking — stuck off the graph?"*). 30 s was chosen because it comfortably exceeds the time to walk clear of any plausible zone (a 5 u floor at the slowest tired/hungry walk speed is under ~12 s), it is long enough that a guest doing laps of a plaza ring does not stop at the same prop every lap, and it is **per guest AND per zone** — so a crowd is unaffected and a floor still shows dancers continuously; only the SAME guest cannot re-latch.

Prefer a **watch zone** for anything that is not literally a dance floor. Besides facing the thing, `'watching'` is a stationary STATE, which `validatePark`'s stuck detector and the "worn out → leave the park" roll both already understand; a `'dance'` action is taken while the guest is nominally still `'walking'`, which is what trips the 25-sim-s gate.

## Animation — everything through the Guest POSE LAYER

All guest animation now runs on `buildPeep`'s pose controller (`pose.setState` + `pose.update` — see Guest/Context.md), so every transition CROSSFADES (~0.25 s, slew-limited) and nothing snaps:

- **standing** (queue slots, sitting, watching, buying, staggering pauses) → pose `idle`: breathing + slow weight shift — queued guests do NOT loop a walk cycle. A small `rotation.z` fidget overlay grows with queue misery.
- **walking** → pose `walk` with the cadence solved from the guest's ACTUAL displacement each frame (`cadenceForSpeed(v, 0.5)`) — limb cadence always matches ground speed, no foot skating.
- **walk speeds scale with needs:** `walkMult` = 0.75× (hungry / low-energy) … 1.15× (fresh and fed), on a hashed per-guest ±10 % base variance, multiplied into `speedOf` — the cadence follows automatically.
- **dancing** (very happy near another walker) → pose `dance` (2.2 Hz, hashed style), `pose.spinYaw` added to the facing.
- **the 'wow' after a great ride is a real pose-layer JUMP** — anticipation crouch, parabolic arc with tucked legs, landing recovery — fired once on the exit apron (`hopArmed`).
- **seated (`onRide`)**: pose `idle` flattened; arms fold onto the lap bar through an eased envelope (`lapW`, 0.33 s in/out) so boarding/leaving never snaps.
- **eat/drink arm overlay** composes ON TOP of the pose: an eased envelope (`eatK`) plus a final armR slew guard keep the right arm under the pose layer's own continuity limit even when a snack starts/ends mid-cycle.

## Mood is POSTURE — no orb

RCT2 renders nothing over a guest's head (Paint.Guest.cpp:60); the floating mood orb is gone. Mood reads from the body (Guest.cpp:6960): happiness < 96 → slower walk, head tilted down (`head.rotation.x`, added to the pose's own nod), slight forward slump (`group.rotation.x`, YXZ order); energy ≤ 64 → head-down slow shuffle (flattened bob); nausea > 140 → lateral sway + occasional hashed 1 s stops; toilet > 220 → hurried gait (faster stride); happiness > 180 → springy bounce (amplified bob). One-shot actions: `checkTime` (pause, head down 0.5 s) in long queues, the `wow` jump after rides, spontaneous dancing when very happy near another walker.

## Thoughts & stats

Per-guest ring buffer of 5 thoughts `{ type, text, subject, t }` (RCT2 `kPeepMaxThoughts = 5`), fresh duplicates suppressed.

**Every thought carries a SUBJECT.** RCT2's `insertNewThought` is overloaded on a `RideId` / a `ShopItem` (Guest.cpp:7077-7098) and the window formatter substitutes it into the string's `{STRINGID}` slot (`PeepThoughtSetFormatArgs` :7050) — which is why real RCT2 guests say "**Wyrm's Hollow** was great" and not "That ride was great". `pushThought(g, type, subject?)` takes that argument, `THOUGHT_TEXT` holds RCT2's own strings with the slot written `{}`, and `thoughtText(type, subject)` renders the finished line stored in `Thought.text`; `Thought.subject` keeps the raw name. A template with no `{}` ignores the subject — exactly how RCT2's un-argumented thoughts (hungry / thirsty / toilet / tired, STR_1499-1502) work. The freshness gate keys on (type, subject), so "Wyrm's Hollow was great!" never suppresses "The Moonlit Barge was great!".

Thoughts that NAME something (every one is RCT2-argumented unless marked): `wasGreat` STR_1497, `queuingAges` STR_1498, `notSafe` STR_1510, `tooIntense` STR_1485, `moreThrilling` STR_1484, `cantAfford` STR_1480/1492, `notWorthIt` STR_1488/TooMuchThought, `goodValue` STR_1490/GoodValueThought, `alreadyWearing` STR_1491, `haventFinished` STR_1486, `cantFind` STR_1503, plus two SIM-ONLY lines that name a ride because we have one to name: `fedUp` (RCT2 balks silently) and `queueFull` (RCT2 emits no thought). Subjectless, as in RCT2: `hungry` STR_1500, `thirsty` STR_1501, `toilet` STR_1502, `tired` STR_1499, `sick` STR_1482, `spentMoney` STR_1481, `notHungry` STR_1493, `notThirsty` STR_1494, `badLitter` STR_1506, `goHome` STR_1489, and the sim-only `handsFull` / `embarrassed`.

**Cadence gate:** the AMBIENT need-driven generators (`hungry`, `thirsty`, `toilet`, `tired`, `queuingAges`, `badLitter` — they re-test every needs tick) may append at most one new thought per guest every 20 sim-s (`lastThoughtAt`); urgent EVENT thoughts (ride reactions, purchase refusals, sickness, `goHome`, ...) still append immediately and also reset the gate. NO visual bubbles and no logging — read them via `stats()`, which returns `{ avgHappiness, riddenTotal, queued, riding, litterCount, balloonsSold, balloonsFlown, balloonsAirborne, thoughts, rides }` plus the GATE-STREAM block `{ parkRating, guestGenerationProbability, arrivalsPerMinute, suggestedGuestMaximum, guestCap, arrivals, gateStream }` (`thoughts` = the 10 newest across all guests; `rides` = per-ride occupancy summary `{ name, state, queue, riders, capacity, occupied }`; the balloon counters are additive — sold, flown away, and currently mid-air).

## Park entrance — the sole spawn/despawn point

`registerParkEntrance(pe, opts?)` — `pe` is a `buildParkEntrance` return (or any `{ group?, spawnPoint, archway }` with the LOCAL contract points, +z = outside) and `opts` is `{ yaw?, position? }`, the transform the CALLER placed the gate group at (read straight off `pe.group` when omitted). The manager stores the WORLD spawn/arch points (returned as `{ spawnPoint, archway }`), attaches the archway to the routing net and makes the gate the SOLE spawn:

- `spawnGuests(count, area?)` — `area` becomes optional: every guest appears at `spawnPoint`, walks in THROUGH the archway onto the network, and only then wanders normally. The cohort files in one at a time, **0.85 s apart up to 23 guests**; past that the gap compresses to `20 / count` so even a 130-guest opening is all inside within 20 sim-s instead of trickling for two minutes.
- **They keep coming.** Registering an entrance also switches on the GATE STREAM — see below.
- `leavingPark` guests route to the archway attach node, step out under the arch to `spawnPoint` and despawn there.
- Without a registered entrance the old behaviour remains: guests spawn distributed along network edges (or the `area` disc) and despawn at the node nearest `area`.

## The gate stream — guests keep ARRIVING while the park is doing well

Register a park entrance and the park is no longer a closed population: new guests walk in through the archway for as long as the park deserves them. This is OpenRCT2's own guest generation, ported in `arrivals.ts`.

**The loop** (`Park::Update`, `src/openrct2/world/Park.cpp:320-354`). Every 512 ticks (~13 s of play) RCT2 recomputes the park rating and the generation probability; every tick it rolls `ScenarioRand() & 0xFFFF < guestGenerationProbability` and, on a hit, calls `GenerateGuest()` — which places the peep AT A PEEP SPAWN in state `enteringPark` and lets it walk in (`:537-555`). Same here, on the same cadences: an arrival is a plain `spawnGuests(1)`, so it appears at the gate's `spawnPoint`, walks under the arch and joins the path network exactly like an opening guest. **Nothing is ever placed inside the park.**

**The rate** (`calculateGuestGenerationProbability`, `Park.cpp:168-218`):

```
probability = 50 + clamp(rating - 200, 0, 650)          // 50 .. 700 out of 0xFFFF
if (guestsInPark > suggestedGuestMaximum) probability /= 4
```

so the PARK RATING is the whole gate, and the rating's guest half is dominated by HAPPINESS (`CalculateParkRating`, `Park.cpp:388-422`): a flat −500 bought back at `2·min(250, happyGuests·300/N)`, where "happy" is RCT2's own `happiness > 128` (`:404`). Nobody happy keeps the −500; five guests in six happy earns all of it back. Measured on a 50-guest park whose rides are open and paths clean:

| happy (happiness > 128) | 0 % | 25 % | 50 % | 70 % | ≥ 83 % |
| --- | --- | --- | --- | --- | --- |
| park rating | 204 | 360 | 504 | 624 | 704 |
| probability / 0xFFFF | 54 | 210 | 354 | 474 | 554 |
| **arrivals / min** | **2.0** | **7.7** | **13.0** | **17.4** | **20.3** |

A miserable park therefore takes in ~2 guests a minute while its own leave roll (5 % per 512-tick cycle for anyone worn out, sad or broke — see "Leaving the park") empties it far faster: the population drains. A happy one fills.

**Which clock.** The generation roll is authored per RCT2 tick, so it is read at RCT2's REAL 40 ticks/s (`TR`), NOT the 4×-compressed appetite clock — see "THE TWO CLOCKS". That asymmetry is deliberate and is what makes the gate bite: arrivals run at RCT2's pace while a soured park's departures run compressed.

**The rest of the rating** is ported term for term off what the sim actually keeps: the guest-count slope (`:391`), ride UPTIME, which is 100 for every ride that has not CRASHED and 0 for one that has (`:441-445`; no ride can break down, so RCT2's broken-down 25 never occurs — see "NO RIDE CAN BREAK DOWN" below), RCT2's two excitement-intensity terms for rides that carry MEASURED `cfg.ratings` (`:449-471`; RCT2's own `RideHasRatings` gate means an unrated ride still costs the park the −100/−200 baselines, so `rateCoaster`-measured coasters really do draw a bigger crowd), and the litter penalty (`:475-483`). Not modelled: the lost-guest penalty (needs `guestIsLostCountdown`) and `ratingCasualtyPenalty`. This sim's litter carries no age, so ALL of it counts where RCT2 only counts litter over ~5 min old; the `LITTER_CAP` pool bounds that penalty at 160 points.

**Two ceilings.**

- RCT2's own SOFT cap, `suggestedGuestMaximum` = Σ `BonusValue` over open rides — here, every ride that has not crashed (`Park.cpp:107-140`) — exceeding it quarters the probability. RCT2 reads `BonusValue` off the ride type descriptor; this sim has no RCT2 ride type, so the three bands are the medians of the real tables (`src/openrct2/ride/rtd/**`): intensity ≥ 7 → 90 (coasters, 50-120), ≥ 4 → 50, else 40 (gentle, 22-50). A one-ride park is throttled to a quarter rate from ~40 guests up, exactly as RCT2 would.
- A HARD cap, `arrivals.cap` — a PERFORMANCE guard, not an RCT2 mechanic. Arrivals stop while `activeGuests >= cap` and resume the instant a `leavingPark` guest despawns, so the population breathes at the ceiling instead of ratcheting. `<Park>` wires `guestCapForSize(size)` = **2× the opening population, clamped to [24, 160]** — 26 on a 16, 52 on a 48, 100 on a 128, 132 on a 192.

**Knobs.** `createGameManager(t, { arrivals: { enabled?, cap? } })`; `enabled: false` gives the old fixed-population behaviour for a preview or probe that must hold an exact roster. Fully deterministic: each roll is `hash01(rollN·7.13 + 37.77)`, keyed on a monotonic roll counter, and the accumulator is driven by the clamped `dt`, so validatePark's 1/30 smoke loop and a variable-rate render loop admit the same guests after the same elapsed sim time.

## Leaving the park (Guest.cpp:3106)

Every `T(128)`, a guest with energy < 55 or happiness < 45 has a 5 % hashed chance to enter `leavingPark`: they route to the despawn point — the park-entrance archway when one is registered (walking out under the arch to `spawnPoint`), else the network node nearest the spawn area passed to `spawnGuests(count, area)` — and despawn there (hidden, slot freed). A freed slot is immediately available to the GATE STREAM, so a park sitting at its hard ceiling keeps turning its crowd over instead of freezing.

## NO RIDE CAN BREAK DOWN — the machinery is REMOVED, not disarmed

**A DELIBERATE DIVERGENCE FROM RCT2.** RCT2 breaks rides down on a reliability
roll and sends a mechanic (`RideFlag::brokenDown`; `Ride::formatStatusTo` draws
"Broken down", `src/openrct2/ride/Ride.cpp:528-564`). This design system does
not, in any circumstance. These parks are LOOKED AT, not managed: there is no
mechanic to dispatch, no maintenance decision to make and nothing a viewer can
do about a stopped ride, so a breakdown was pure downtime.

`handle.status()` therefore answers **`'open'`, or `'closed'` for a crashed
ride, and nothing else**. There is no third state and no way to ask for one.

### What was removed, and from where

| gone | was in |
|---|---|
| `breakIntervalOf()` (the hashed 40–95 s schedule) | `access.ts` |
| `breakDown()`, the schedule block in `updateRide`, the 18 s repair countdown | `rideFsm.ts` |
| `RideRec.brokenAt` / `.breakN` / `.nextBreak` | `types.ts` |
| `BREAK_DOWN_SECS` (12) / `REPAIR_SECS` (6) | `types.ts` |
| `statusOf`'s `'brokenDown'` / `'beingRepaired'` arms | `access.ts` |
| `joinRefusal`'s broken-ride `notSafe` refusal | `needs.ts` |
| `seekRide`'s broken-ride skip | `navigation.ts` |
| the park-rating `uptime = 25` arm and `suggestedGuestMaximum`'s broken-ride skip | `arrivals.ts` |

REMOVED rather than parked at a never-reached value, because a schedule that
merely never fires is one edit away from firing again, and every downstream
`brokenAt >= 0` branch would have stayed live-looking and untestable. With the
FIELDS gone there is no state left to re-arm by accident: `updateRide` has
exactly one way to stop serving guests and it is a CRASH.

### `cfg.breakdownEvery` is IGNORED, and says so

The field is still DECLARED (existing callers must keep type-checking — three
`*.previews.tsx` files pass it) and is marked `@deprecated`. `registerRide`
raises one `console.warn` naming it and exits. Ignoring it silently would leave
an author wondering why their ride never stops; honouring it would contradict
the rule.

### A CRASH IS A DIFFERENT MECHANISM AND STILL WORKS

`cfg.vehicleHandle.crashed()` — a coaster derailing, owned by the ride's own
vehicle model, not by the manager — still drives `crashRide`: the ride enters
`'crashed'`, `drainRide` empties every platform (queuers and enterers walk off
thinking `notSafe`, anyone aboard leaves via the exit hut), guests stop treating
it as a goal, and `status()` reports `'closed'`. It is permanent: nothing repairs
a wreck. Do not "tidy" this away with the breakdown model — it is the only
remaining out-of-service path and it is deliberate.

### Measured (`harness/park-eval/probe-no-breakdown.mjs`, 1800 sim-s per scenario, `handle.status()` sampled every 1/30 s)

`--breakdowns` restores the old schedule IN MEMORY at bundle time (esbuild
`onLoad`, seven asserted anchors across five modules — nothing under `mp3d/` is
written), so the A/B is one command and the zero is falsifiable:

| | out of service | riders served / sim-min | transfers |
|---|---|---|---|
| flat ride, no knob — **old hashed schedule** | 252.0 s (**14.00 %**) | 3.50 | — |
| flat ride, no knob — **now** | **0.0 s (0.00 %)** | 3.40 | — |
| flat ride, `breakdownEvery: 30` — **old** | 616.4 s (**34.24 %**) | **0.03** (1 rider in 30 min) | — |
| flat ride, `breakdownEvery: 30` — **now** | **0.0 s** | **3.40** | — |
| 4-platform monorail, `breakdownEvery: 30` — **old** | 616.4 s (**34.24 %**) | 0.47 | 14 |
| 4-platform monorail, `breakdownEvery: 30` — **now** | **0.0 s** | **2.43** (**5.2×**) | **73** |

Read it honestly: the ride that opted IN is where the win is enormous (a ride
broken a third of the time loses nearly every loading cycle to `drainRide`,
which credits nobody), and the monorail gains 5.2× because a frozen fleet
carries no one. The **no-knob flat ride is a wash — 3.50 → 3.40, −2.9 %** — and
that is not a regression to chase: in a ONE-RIDE park the 20 s previous-ride
refusal (`LAST_RIDE_TIMEOUT`) throttles re-rides, while a drained guest never
rode and so may re-queue at once, and the legacy half also churned its crowd
faster (11 vs 26 guests still in the park at the end). At ±3 % over a chaotic
1800 s trajectory that is noise, not a mechanism.

`probe-monorail-timetable.mjs` now FAILS the run on any out-of-service step
rather than excusing it as maintenance: measured 0.0 s of 1800 s, four trains at
97.4 % duty, 102 riders and 102 transfers.

## UI accessors (additive — feed the window suite)

- `guests()` — live records for GuestInfo: `{ id, name ('Guest N'), state,
  happiness, hunger, thirst, energy, nausea, toilet, cash, ridden,
  thoughts: string[], thoughtSubjects: (string | null)[],
  position: [x, y, z], hidden, gone }[]` for every non-despawned guest (RCT2
  guest-window data: stats-tab bars `openrct2-ui/windows/Guest.cpp:146-159`,
  thoughts tab `:172,827-848`; `hidden` = inside a hut / not yet through the
  gate). `cash` / `ridden` are RCT2's "Cash in pocket" and "No. of rides" lines;
  `thoughtSubjects` is the ring's thought ARGUMENTS, index-aligned with
  `thoughts`, so a window can link a thought to the ride it names.
- `rides()` — roster for ParkInfo: `{ name, status, state, queue,
  boardPoint }[]`.
- `stalls()` — `{ name, anchor, dir, sold }[]` (`sold` = lifetime items sold).
- ride handles additionally expose `status()`, `totalRides()` (riders served)
  and `boardPoint()` (camera aim point for RideViewer / ParkInfo teleports).

## Clickability + validation accessors (additive)

- **Every sim guest's visual group is tagged** `peep.group.userData.guestRef
  = () => liveRecord` at spawn — Stage `onPick` raycasts clicks up to the
  tagged group, so clicking a guest can open a LIVE GuestInfo (poll the
  accessor ~4×/s; it reports `gone` when the guest despawns). Rides are
  tagged by the CALLER: set `rideVisualGroup.userData.rideRef = the
  registerRide handle` (+ `userData.rideVehicle` for RideViewer's onboard
  cam) — ParkBuilder does this for every generated ride.
- `accessPoints()` → `{ entranceNode, rides: [{ name, queueNode,
  exitNode }] }` — the routing attach nodes, for `validatePark`'s
  gate→queue accessibility audit.
- `footprints()` → every audited `placeAccess` rect (`{ cx, cz, hx, hz,
  yaw, label }[]`) — for validatePark's OBB overlap sweep and
  hills-clear-of-structures check.
- The PREVIEW demonstrates the full wiring: `autoRotate` off with a
  `setCameraPose` framing, `onPick` → RideViewer (ride) / live GuestInfo
  (guest), one floating window at a time (rules/ui.md).

## API summary

- `registerRide(cfg)` — v1 fields unchanged (`name, capacity, rideDuration, loadTime?, queueAnchor, queueDir, entrance?, boardPoint, exitPoint, onStateChange?`; `loadTime` now times the `departing` phase) plus `intensity?` (1–10, default 4), `price?` (default 0), `minWait?`/`maxWait?`/`quietWait?` (seconds — see THE DEPARTURE RULE above: `maxWait` is now anchored on the first BOARDING, and `quietWait` defaults to `BOARD_QUIET_SECS` = 10), `vehicleHandle?` (the CRASH hook — still live), `seatWorld?` (per-seat rider transform, see Boarding), `breakdownEvery?` (**IGNORED and warned about — no ride can break down**), and `laneLen?` (round-2, ADDITIVE: explicit queue-lane length in world units, min 1.2; default stays the capacity formula `max(2.2, 0.6 + capacity·2·0.28 + 0.5)` — Park's register wrappers pass a trimmed value so the derived tail spur at `queueAnchor + (laneLen + 0.35)·queueDir` lands ON the street node the layout planned). Still builds the red QueuePath-style lane + entrance/exit huts (exit possibly audit-shifted) and returns `{ name, state(), queueLength(), occupancy(), exitPoint(), exitShift, status(), totalRides(), boardPoint(), seatAt(k) }` — `occupancy()` = `{ riders, capacity, occupied }`, `seatAt(k)` the live per-seat transform (ADDITIVE; `null` without `seatWorld`).
- `registerStall(cfg)` → `{ name, sold() }`; `registerBin(x, z)` → `{ count() }`; `setBenches(list)` replaces the registered bench seats (see "Benches").
- `createGameManager(t, opts)` takes `benches?: { x, y, z, yaw }[]` — bench SEATS a tired guest walks to and sits on. Logic only; the meshes are PathNetwork's. Omit it and the rest stop stays the in-place pause it always was.
- `registerRestroom({ anchor?, yaw?, doorway?, owner? })` → `{ uses() }` (logic only — place the `buildRestroom` mesh yourself; `owner` ties the registration to the hut's own blocker so a guest walking to THIS doorway is never blocked by it).
- `registerDanceZone(cfg)` → `{ dancers(), cooldown() }`; `registerWatchZone(cfg)` → `{ watchers(), cooldown() }` — see "Attention zones" above. Round-8 ADDITIVE on the dance zone: the optional `faceAt` / `linger` / `cooldown` / `gate` fields, and a **default 30 s per-guest cooldown** so no zone can pin a guest indefinitely. Registrations are permanent (remount the `<Park>` to change them).
- `registerParkEntrance(pe, { yaw?, position? })` → `{ spawnPoint, archway }` in WORLD coords — makes the gate the sole spawn/despawn point.
- `createGameManager(t, opts)` additionally takes `arrivals?: { enabled?: boolean; cap?: number }` — the GATE STREAM (see its section): default on whenever a park entrance is registered, `cap` default 120 (`<Park>` passes `guestCapForSize(size)`).
- `spawnGuests(count, area?, stats?)` — deterministic varied peeps (`buildPeep`, 0.5 scale). With a registered park entrance they arrive staggered through the gate (`area` optional, used only as the fallback wander home); without one they distribute along network edges (or the home disc without a net) as before. **Round-9 ADDITIVE `stats?: GuestSpawnStats`** — see "Staging a cohort's starting needs" above; omit it and the roll is bit-identical to before it existed.
- `stats()` additionally reports `activeGuests`, `poopCount`, `vomitCount` and `restroomUses`.
- **Round-5 relocation + corridor tooling (additive; call BEFORE guests spawn — `<Park>`'s corridor auto-resolver does):** `moveRide(name, dx, dz)` translates a registered ride's whole rig in lockstep (queue anchor/board/exit points, doorway/hut/exit waypoints, hut+lane meshes — each ride's access meshes live in one per-ride subgroup — routing spur nodes and audited footprints; the ride's MAIN visual is the caller's to move by the same delta); `moveRideExit(name, dx, dz)` relocates just the exit hut (mesh, exit points, spur, footprint); `resizeRideLane(name, len)` SHORTENS a queue lane (≥ 1.2 — rebuilt mesh, shrunk footprint, fewer slots, tail spur pulled in); `moveStall(name, dx, dz)` moves a stall's anchor/front/spur. All of them re-audit `accessAudit()` so a relocation that RESOLVED a registration-time placeAccess collision drops the stale residual. `corridorCells(name?)` → the 1.2-grid cells within 1.6 u of a registered circuit's polyline where the rails run < 2.2 u over the cell ground (needs the `circuits` opt — a live accessor `<Park>` wires from its registered coasters) — plan streets/stalls off these cells by construction.

- **Round-6 blocker registry (additive):** `registerBlocker(spec)` → a relocatable handle, plus the read side `blockers()` / `blocked(x, z, opts?)` / `blockerDepth(x, z, opts?)` / `edgeWalkable(a, b)`. See "Blockers" above; `BLOCKER_PAD` (0.13) is exported too.

## Module layout (implementation detail — ALWAYS import from `'../GameManager'`)

`index.tsx` is a thin barrel: it re-exports the public vocabulary and holds `createGameManager`, which builds ONE shared `Sim` context (`sim.ts`) and installs each subsystem onto it. Subsystems call each other LATE-BOUND through that context (`s.needs.…`, `s.nav.…`), so the mutually recursive seams — needs ↔ navigation, ride FSM ↔ queue drain, registration ↔ occupancy — are unchanged and the sim still behaves as one closure. Nothing outside this folder may import a sibling directly.

| module | contents |
| --- | --- |
| `types.ts` | the shared vocabulary: tick scale, state unions, config/record interfaces, tuning constants, thought table, `createMotionGate` / `makeSeatWorld` |
| `sim.ts` | the `Sim` type — immutable wiring, shared collections, shared MUTABLE scalars (`simTime`, `riddenTotal`, `spawnPt`, `parkEntrance`, balloon counters — never destructure these) and the subsystem slots |
| `blockers.ts` | the blocker registry, its uniform grid and the routing `edgeAllowed` gate |
| `guestFx.ts` | thoughts, the hashed per-guest `draw`, litter/vomit/poop pools, the two-hand registry, held items (generic + per-stall `heldItem` clones), head-slot wearables, held + flown balloons and their per-frame tweens |
| `access.ts` | queue lane + slot geometry, `placeAccess` audit, RCT2 status line (open/closed only), NaN-guarded attach, relocation accessors, `corridorCells` |
| `registry.ts` | `register{Ride,Stall,Bin,Restroom,DanceZone,WatchZone,ParkEntrance}` and the handles they return |
| `spawn.ts` | `spawnGuests` — rig build, hashed appearance, fresh-arrival stat block, click proxy |
| `arrivals.ts` | THE GATE STREAM — RCT2's park rating + guest-generation probability, the per-RCT2-tick roll, the soft (`suggestedGuestMaximum`) and hard (`cap`) ceilings |
| `locomotion.ts` | blocker-aware `moveToward` (with its byte-identical no-blockers fast path), needs-driven speed, waypoint runner |
| `needs.ts` | the Tick128 needs clock, queue join/balk, the shop counter |
| `navigation.ts` | network walk, node-arrival decisions, direct-walk fallback |
| `rideFsm.ts` | the ride state machine, exit-hut unload, shared queue drain |
| `guestPass.ts` | the per-frame guest pass: state dispatch + the whole pose/overlay stack |
| `queries.ts` | `stats` / guest records / ride roster / the validatePark accessors |

Original three.js composition on the shared Stage; behaviour ported from OpenRCT2 (`src/openrct2/entity/Guest.cpp`, `Peep.h`, `ride/Vehicle.h`, `peep/GuestPathfinding.cpp`), realistic palette only.

## Ride access runs are PAVEMENT (`access.ts`)

`buildQueueLane` and `buildExitLane` no longer draw bespoke slabs: both emit
through `PathNetwork`'s shared `pathRibbon`, so a queue lane and an exit footpath
carry the same slab datum (`PATH_H` surface, `PATH_SLAB` thick), kerb
cross-section, half-tile expansion seams and inclined-frame ramping as any street
span, and each is batched into ~3 merged meshes instead of ~26 loose boxes.

* **Kerbs** are laid on the exit footpath (it IS an ordinary RCT2 footpath) and
  are OPT-IN on a queue (`QueueSurface.kerb`) — RCT2 edges a queue with its
  railing. Both take `seam` from their surface.
* **The hut apron** (`RideEntrance`'s `HUT_APRON_Y`) is the same `PATH_H` course,
  so a queue meets its entrance hut and an exit path leaves its exit hut flush.
  It was 0.08 against the paths' 0.09 — a 1 cm lip at every ride in the park.
* **Grade to the DRAWN surface, not the datum.** `tailY` / `endY` take
  `paths.surfaceYAt(...)` sampled where the slab PHYSICALLY ENDS, never
  `walkYAt`: the pavement drawn at a node stands `PATH_PAD_LIP` above the walk
  datum and a knuckle pad bevels on top of that. `laneTailY` stays the walk datum
  because every queue SLOT height (`slotPos`) hangs off it.
* Measured with `harness/mp3d-render/probe-lane-joins.mjs` (six rides on
  undulating ground): every join — queue↔hut, queue↔street, exit↔hut,
  exit↔street — within 2.4 mm, from +7 to +12.5 mm before.

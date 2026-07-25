# GameManager

The park SIMULATION brain, rebuilt around REAL OpenRCT2 guest logic. `createGameManager(t, { groundAt?, net?, laneY?, bins? })` → `{ group, registerRide, registerStall, registerBin, registerRestroom, registerParkEntrance, spawnGuests, update, stats, guests, rides, accessPoints, footprints, stalls, accessAudit, entrancePoints }` (`stalls()` = registered stalls' `{ name, anchor, dir }` — validatePark's track-corridor sweep audits their footprints) (`rides()` rows carry `rideDuration`; `accessAudit()` = residual placeAccess collisions; `entrancePoints()` = resolved gate spawn/arch world points — all consumed by ParkBuilder's `validatePark`). Add `group` to your scene, register rides/stalls/bins/restrooms and (ideally) a park entrance, spawn guests, call `update(time, dt)` every frame (dt clamped ≤ 1/15 s). Fully deterministic — hashed-sine randomness keyed by guest index + counters; no `Math.random` / `Date.now`. Every rule below cites its OpenRCT2 source (file:line).

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

## Guest states — RCT2 `PeepState` subset (entity/Peep.h:47)

`walking, queuing, queuingFront, enteringRide, onRide, leavingRide, buying, sitting, watching, usingBin, usingRestroom, leavingPark`. Balking is a TRANSITION out of queuing back to walking, not a state. Dancing and resting-style fidgets are one-shot ACTIONS layered inside walking/sitting (`dance`, `wow`, `checkTime`, `staggerStop`).

## Needs — 0–255 values chasing targets (Guest.cpp:769-921, 3089)

Six needs per guest: happiness (+target), hunger, thirst, energy (+target), nausea, toilet. **Spawn stats (hashed per guest index):** fresh arrivals enter at 80–100 % energy and happiness (204–255), 0–30 % hunger/thirst/toilet NEED (hunger/thirst stored INVERTED like RCT2 — 255 = sated, so stored 178–255; toilet stored 0–77) and nausea 0. Every `T(128)` s:

- hunger −2, thirst −2, toilet +1
- energy and happiness chase their targets by ±4 (RCT2 steps ±2 on its 32..128 energy scale; we run ±4 on 0..255)
- energy ≤ 50 → happinessTarget −2; hunger < 10 or thirst < 10 → happinessTarget −1
- nausea decays −4; energyTarget −1 per tick (guests tire over the day, floor 32)
- while eating/drinking: a MEAL lasts 2–4 sim-minutes — 12–16 hashed bites/sips, one every 10–15 hashed s (RCT2 nibbles on a schedule via `timeToConsume`, Guest.cpp:815-854 `updateConsumptionMotives`, paused while `onRide`). Relief is PROGRESSIVE: each food bite is hunger +4, thirst −1, toilet +1 (:829-834); each sip thirst +4. Passive decay of the need being consumed AND the `energyTarget` day-clock decay pause during the meal (on this compressed clock the meal would otherwise out-decay itself / outlast the guest's park stay). After the last bite the guest is left `holding = 'container'`

Thought triggers (Guest.cpp:1093): hunger ≤ 10 → thought + seek the nearest FOOD stall; thirst ≤ 25 → thought + nearest DRINK stall; toilet ≥ 160 → thought "I need the toilet"; toilet ≥ 200 → seek the nearest registered restroom (see Restrooms below — with none reachable, the need clamps at 255 until the poop fallback fires).

## Queuing (Guest.cpp:5774-5837, 7535, 1980-2042)

Join checks at the queue entrance (`ShouldGoOnRide`), any refusal → happinessTarget −8 + a thought:

- ride == lastRide within `T(128·25)` ≈ 20 s → silent refusal (RCT2 `previous_ride` + `previous_ride_time_out`)
- cash < ride price → "I can't afford that"
- queue full (all lane slots taken) → "The queue is too long"
- intensity outside the guest's window: each `RideConfig` has `intensity` 1–10 and each guest a hashed `intensityTolerance` (2–9); accepted when `|ride.intensity − tolerance| ≤ 2 + happiness/32` — happier guests are braver (simplified from RCT2's min/max intensity range)

In the queue `timeInQueue` runs: ≥ `T(2000)` → happinessTarget −4 per `T(128)` (Guest.cpp:7535); ≥ `T(3500)` → thought "I've been queuing for ages"; ≥ `T(4300)` and happiness ≤ 65 → 3.3 % hashed chance PER SECOND to abandon the queue (turn around, thought "I'm fed up of waiting", back to walking). Single-file advance only when the slot ahead frees, 0.28 slot spacing; the slot-0 guest is `queuingFront`. Riders pay the ride price when admitted through the entrance hut.

**Queue orientation (audited):** the lane extends `queueAnchor → +queueDir` with slot i at `anchor + (0.45 + i·0.28)·dir`, so slot 0 — the HEAD — is the anchor end, on the RIDE side. The entrance hut + sign stand just beyond the head at `anchor − 0.62·dir` facing `+dir`, putting the hut doorway at `anchor + 0.04·dir`, directly in front of slot 0; guests join from past the TAIL spur at `anchor + (laneLen + 0.35)·dir` and file toward the hut.

## Ride FSM — RCT2 `Vehicle::Status` (Vehicle.h:123)

`movingToEndOfStation → waitingForPassengers → waitingToDepart → departing → travelling → arriving → unloadingPassengers → movingToEndOfStation`. `waitingForPassengers` admits up to `capacity` guests one at a time and honours `minWait`/`maxWait` (defaults `T(32·10)` / `T(32·60)`): departs when full after minWait, when the queue is empty after minWait, or at maxWait. `travelling` lasts `rideDuration`. `onStateChange(state, occupancy?)` fires on every transition — the second argument is ADDITIVE (`{ riders, capacity, occupied }`, exported as `RideOccupancy`), so existing single-arg callbacks keep working.

### `createMotionGate(update, { spinUp?, spinDown? })` — station behaviour for ride VISUALS

RCT2 vehicles WAIT in the station while guests board and stop again to unload, but catalog ride visuals animate on an absolute clock. `createMotionGate` wraps such an updater with an internal gated clock (dt clamped ≤ 0.1): the clock only advances while the FSM says the vehicle is in motion — speed eases 0→1 over `spinUp` (0.8 s) on `departing`/`travelling`, eases 1→0 over `spinDown` (1.2 s) into `arriving`/`movingToEndOfStation`/`brokenDown`/`beingRepaired`/`crashed` (the graceful spin-down; a mid-motion breakdown parks the FSM in `movingToEndOfStation`, so it rides the same easing), and is a HARD 0 in `waitingForPassengers`/`waitingToDepart`/`unloadingPassengers`. Returns `{ update, onStateChange, speed(), clock() }` — wire `update` as the built result's updater and CHAIN `onStateChange` before the ride's own handler (compose, don't replace breakdown spin-downs). CRITICAL: the gate starts **UNGATED** — raw time passes straight through until the first `onStateChange`, so un-registered previews are byte-identical. The wrapped updater receives the eased speed (0..1) as a second argument: oscillating rides use it as an amplitude envelope (`× motionK`) so ships/arms/towers SETTLE level or at the base instead of freezing mid-swing; cycle rides key their phase off `clock()` captured at `departing` so every run starts from zero. Fleet-wide exceptions: **Chairlift** (real chairlifts circulate — guests board moving chairs) and **HauntedMansion** (walkthrough — nothing to park).

### `makeSeatWorld(t, seats)` — the standard seatWorld factory

Builds a `RideConfig.seatWorld` from an array of anchor `Group`s parented into the MOVING vehicle parts: seat index → live world `[x, y, z, yaw]`. Register rides with `capacity === seats.length` (RCT2: a ride's capacity IS its seats) so distinct riders always land in distinct anchors and a partial load leaves visibly EMPTY seats. The `registerRide` handle exposes `seatAt(k)` (the live transform, `null` without seatWorld) so harness probes can assert riders sit in distinct seats.

## Boarding — RCT2 `PeepRideSubState` (entity/Peep.h:81); guests NEVER walk on the ride

- **atEntrance → inEntrance:** the queue-front guest is admitted, pays, and walks doorway → hut INTERIOR — the waypoint chain ends INSIDE the entrance hut, where the guest is hidden for a 0.35 s dwell. They never walk toward `boardPoint`.
- **seated (`onRide`):** the ride then SEATS them — they re-appear ON the vehicle, visible occupancy. Each rider takes the seat matching its position in the ride's rider list: `RideConfig.seatWorld?(seat) → [x, y, z, yaw]` (guest group origin/feet, called per frame — attach riders to a live spinning rotor) or, without it, a compact ring around `boardPoint` (radius 0.3, sunk 0.12 so the lower legs read as inside the vehicle body). Seated pose: pose-layer `idle` with the bob flattened, arms folded to a lap bar through an eased envelope when `buildPeep` exposes `armL`/`armR` (feature-detected).
- **leaveVehicle → inExit → leaveExit:** on unload, riders teleport INSIDE the exit hut (hidden, staggered 0.6 s apart), then re-appear walking OUT through its front doorway — apron, 'wow' hop there (~60 %), then the exit attach node and back onto the network (`leavingRide → walking`), with RCT2 ride satisfaction: happinessTarget +40, thought "That ride was great!", nausea gain scaled by ride intensity.

## Entrance/exit placement audit — `placeAccess`

`registerRide` runs a deterministic footprint audit before building anything: conservative oriented rectangles (2D SAT) for the entrance hut (0.55 × 0.5 half-extents), exit hut, queue lane (0.36 × laneLen/2) and the `boardPoint` pad (0.45 square), checked against each other (the entrance hut/lane abutment is exempt — by design) AND every previously registered ride's footprints. Any entrance/lane collision is `console.warn`ed with specifics (no safe auto-fix — adjust `queueAnchor`/`queueDir`). An exit-hut collision is auto-fixed: the exit slides along its pad edge (the tangent ⟂ to its `boardPoint → exitPoint` facing), first non-colliding offset in `0, ±0.1 … ±0.8`, warned with the applied shift. The ride handle exposes the result: `exitPoint()` (resolved centre) and `exitShift`. RESIDUAL collisions (the no-auto-fix entrance/lane overlaps, and an exit hut still colliding after the ±0.8 search) are also recorded and exposed via `accessAudit()` — ParkBuilder's `validatePark` promotes every residual its own OBB sweep didn't already fail on into a hard `footprints` failure, so an access overlap can never remain a console-only warn.

**Crashes:** `RideConfig.vehicleHandle?: { crashed?(): boolean }` — when it reports true the ride enters `crashed`: the queue is emptied (thought "it isn't safe", happinessTarget −30, guests walk away), anyone aboard escapes via the exit with the same penalty, and the ride never admits again.

## Purchases (Guest.cpp:1529 `DecideAndBuyItem`)

`registerStall({ name, item, price, value, anchor, dir })` builds NOTHING visual — only a logical attach point 0.72 u in front of the stall (shop meshes are separate components; ParkBuilder places them). `item` is a `StallItemKind` (exported): CONSUMABLES `'food' | 'drink'` and ACCESSORIES — `'balloon'` today, and the union stays OPEN (`string & {}`) so future accessory kinds (hats, sunglasses — RCT2 ShopItem, Guest.cpp:6928-6941) are additive. A guest in `buying` walks to the counter and transacts for 1.2 s.

**Two-hand gate first (see Hand slots below):** no free hand → "My hands are full" (`handsFull`); a consumable while a consumable chain is still active → "I haven't finished yet" (`haventFinished`, RCT2 Guest.cpp:1546-1553). Then the classic refusals for consumables: nausea ≥ 145 ("I feel sick"), food while hunger > 75 ("I'm not hungry"), drink while thirst > 75; and for everything: cash < price, overpay tolerance `price − value ≤ hashed(0..7)` DOUBLED at happiness ≥ 128 (the halved-penalty rule). Good value → happinessTarget += 4·(value − price) + "What good value!". A successful consumable purchase sets `holding = item` in the chosen hand and starts the ~6.4 s consumption above; a successful BALLOON purchase adds +12 happinessTarget (RCT2 cheap-joy item) and puts a held balloon in the free hand (see below). Guests seek food/drink stalls when hungry/thirsty as before; accessory stalls are JOY buys — a 30 % passing impulse (6 % once they already hold a balloon — and a both-hands-full guest still occasionally steps up and collects the visible `handsFull` refusal) plus an aimless-wander goal chance.

## Hand slots — two hands, max ONE item per hand

Each guest has a LEFT and RIGHT hand slot. Consumables (food/drink → container) occupy `eatHand` — RIGHT preferred, falling back to the left when the right is taken (the eat/drink overlay, fling and container flow all follow the hand). Accessories (balloons) take WHICHEVER hand is free, LEFT preferred so the right stays available for snacks — so `balloon + drink` is a common sight, and two balloons (one per hand) is possible but rare. A purchase that finds no free hand refuses with the `handsFull` thought. `guests()`/`recordOf` expose the registry additively: `hands: { left, right }` with `HeldItemKind | null` (`'food' | 'drink' | 'container' | 'balloon'`).

## Held items + eat/drink animation

A consumable purchase puts a VISIBLE item in the guest's eat hand, parented to that arm pivot at the hand position (arm-local `[0, −0.34, 0.03]`) so it tracks every swing. Food = a small light-brown burger puck; drink = a small red cup with a straw stub; when consumption ends (`holding = 'container'`) the item swaps to a crumpled grey container until it's binned or dropped (the existing litter/bin flow, unchanged). The three meshes are built ONCE per guest PER HAND on first use and only shown/hidden after — no per-frame allocation. While `holding = 'food'`: an eat cycle every ~1.6 s — the eat arm eases up to ≈ −2.2 rad (hand at the mouth) over 0.35 s and back down over 0.35 s, with a tiny head nod into each bite. While drinking: longer swigs, less frequently — a ~1.2 s raised hold every ~3.4 s with a slight extra arm tilt (−2.35) and the head tipping back. The override composes ON TOP of the pose layer through an eased envelope (`eatK`) and a final eat-arm slew guard — starting or finishing a snack mid-cycle never snaps the arm — and is suppressed while seated on a ride (the lap-bar pose wins). Deterministic (time + guest phase).

## Balloons — hold, DROP, fly-away (RCT2 Guest.cpp:6939-6963, Balloon.cpp:33-71)

A bought balloon is a string + ball rig on the free hand's pivot: thin string straight UP from the fist (0.55 local), knot, and an egg-shaped ball in a colour hashed deterministically per guest+hand from `BALLOON_COLS` (RCT2 assigns `balloonColour` at purchase, Guest.cpp:1682). The ARM STAYS RELAXED — a per-frame counter-rotation keeps the string world-up over the swinging hand with a gentle hashed sway, sampled after every arm overlay so it rides the final pose. The hold lasts a hashed **60–120 sim-s** per guest (RCT2 instead rolls a ~0.5 %/tick blow-away chance, Guest.cpp:6951 — same expected fate, deterministic here); ride exits add a 12 % hashed slip chance and the post-ride 'wow' hop a 15 % one (earlier `dropAt`). On the DROP the rig detaches exactly at the ball's world position and becomes an airborne balloon (pooled, cap 10, oldest slot reused): ACCELERATING buoyant climb (0.25 u/s + 0.15 u/s² — RCT2 balloons climb steadily until they pop at altitude, Balloon.cpp:33-71), hashed wind sway + drift, a slow spin, then it shrinks/fades out above ~8 u of climb and frees its slot. The ex-owner loses 4 happiness (value and target) and glances UP sadly for ~1.6 s (head-tilt overlay). Drops are deferred while hidden or seated (`onRide` — the lap bar pins the hands).

## Restrooms + the poop fallback

`registerRestroom({ anchor, yaw? })` or `registerRestroom({ doorway })` — LOGIC only; the caller places the `buildRestroom` hut mesh. With `anchor`/`yaw` the manager derives the world doorway from the buildRestroom contract (`anchor + rotY(yaw)·[0, 0, 0.72]`, walk-in height +0.08 = the apron top); a world `doorway` point is accepted directly. The doorway gets a routing attach spur. Returns `{ uses() }`.

- toilet ≥ 200 (walking, aimless) → goal-seek the NEAREST restroom via the routing net; on arriving at its attach node the guest walks through the doorway, is hidden 2 s (`usingRestroom`, "relieving"), then toilet resets to 40, happinessTarget +10, and they rejoin the network at the doorway spur.
- **Poop fallback:** if toilet reaches 255 and NO restroom is registered/REACHABLE (checked over the routing graph from the guest's current node), a small discreet poop mesh (2 tiny stacked brown flattened balls) is dropped at the guest's verge position — capped at 8 meshes, oldest reused — toilet resets to 30, thought "Oh no... how embarrassing!" and happiness −20 (value AND target). Nearby guests treat poop like litter in the existing ≥3-within-1.2 u blight check, with each poop counting DOUBLE. With a reachable restroom the need simply clamps at 255 while the guest seeks it — no poop.

## Guest event animations (throw trash / throw up / poop squat)

Three visible one-shot events, all deterministic and composed OVER the pose layer:

- **Throw trash:** when the litter chance fires, the guest plays a 0.65 s eat-arm FLING (wind-up back, sweep forward with release at 0.28 s, recover — a pure additive offset that is 0 at both ends and peaks at ~7.8 rad/s, under the pose layer's 8.5 rad/s continuity limit) and the scrap mesh ARCS from the hand to its ground spot on a 0.5 s parabolic tween (+0.3 lob over the chord, tumbling), landing in the normal litter ring (cap 40, oldest reused). The held container vanishes at release.
- **Throw up:** a walking guest with nausea ≥ 200 has a 20 %/s hashed chance to stop for 2.6 s (`'vomit'` action): eased hunch (torso pitch + head down through the slew-chased slump/tilt channels), face turns GREEN via `buildPeep().setSick(true)` (green-tinted grimace face — its own texture-cache key), and at the deepest point (1.1 s) a 12-droplet green ParticleKit burst fires at mouth height plus a splat decal ahead of the guest (own 8-slot ring, reusing the litter machinery; counts DOUBLE in the blight check like poop). Effects: nausea −130, happiness −12 (value and target), thought "I feel sick". The normal face is restored ~4 s after onset.
- **Poop squat:** the no-restroom fallback now plays a 0.8 s SQUAT first (walking guests only — hidden/stationary guests keep the instant drop): legs fold +1.15 rad, body drops, slight forward pitch, and the female skirt flares to cover; the poop mesh, toilet reset, −20 happiness and the "how embarrassing" thought all land as the guest stands, followed by the usual unhappy walk-off.

One shared burst-only vomit emitter (`ParticleKit.buildEmitter`, max 48) lives on the manager group; `update` also drives the thrown-litter flights.

## Litter + bins (Guest.cpp:5534-6256)

`registerBin(x, z)` (or `bins: [x,z][]` in opts) tracks LOGIC only — capacity 3 each; bin meshes are placed by the caller/ParkBuilder. A guest `holding = 'container'`: passing within 0.6 u of a non-full bin → `usingBin` (walk over, 0.8 s, deposit, count +1, then resume the exact edge position); otherwise each edge traversed carries a 6 % hashed chance to DROP litter, and a PATIENCE CAP guarantees disposal: ~30–45 hashed s after finishing (5–9 s for guests already walking OUT — the classic RCT2 exit-path litter) the container is thrown at the next stride — a little crumpled 2–3-box scrap mesh with deterministic tint spawns at their feet (capped at 40 meshes, oldest reused). Guests passing ≥ 3 litter pieces within 1.2 u: happinessTarget −17 + thought "The litter here is really bad" (rate-limited per guest).

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

Per-guest ring buffer of 5 thoughts `{ type, text, t }` (RCT2 `kPeepMaxThoughts = 5`), fresh duplicates suppressed. **Cadence gate:** the AMBIENT need-driven generators (`hungry`, `thirsty`, `toilet`, `queuingAges`, `badLitter` — they re-test every needs tick) may append at most one new thought per guest every 20 sim-s (`lastThoughtAt`); urgent EVENT thoughts (ride reactions, purchase refusals, sickness, `goHome`, ...) still append immediately and also reset the gate. NO visual bubbles and no logging — read them via `stats()`, which returns `{ avgHappiness, riddenTotal, queued, riding, litterCount, balloonsSold, balloonsFlown, balloonsAirborne, thoughts, rides }` (`thoughts` = the 10 newest across all guests; `rides` = per-ride occupancy summary `{ name, state, queue, riders, capacity, occupied }`; the balloon counters are additive — sold, flown away, and currently mid-air).

## Park entrance — the sole spawn/despawn point

`registerParkEntrance(pe, opts?)` — `pe` is a `buildParkEntrance` return (or any `{ group?, spawnPoint, archway }` with the LOCAL contract points, +z = outside) and `opts` is `{ yaw?, position? }`, the transform the CALLER placed the gate group at (read straight off `pe.group` when omitted). The manager stores the WORLD spawn/arch points (returned as `{ spawnPoint, archway }`), attaches the archway to the routing net and makes the gate the SOLE spawn:

- `spawnGuests(count, area?)` — `area` becomes optional: every guest appears at `spawnPoint` (staggered 0.85 s apart), walks in THROUGH the archway onto the network, and only then wanders normally.
- `leavingPark` guests route to the archway attach node, step out under the arch to `spawnPoint` and despawn there.
- Without a registered entrance the old behaviour remains: guests spawn distributed along network edges (or the `area` disc) and despawn at the node nearest `area`.

## Leaving the park (Guest.cpp:3106)

Every `T(128)`, a guest with energy < 55 or happiness < 45 has a 5 % hashed chance to enter `leavingPark`: they route to the despawn point — the park-entrance archway when one is registered (walking out under the arch to `spawnPoint`), else the network node nearest the spawn area passed to `spawnGuests(count, area)` — and despawn there (hidden, slot freed).

## Breakdowns — deterministic, hashed per-ride reliability (additive)

Every ride carries a hashed reliability fixing its mean time between failures
(~40–95 s, or `cfg.breakdownEvery` seconds); breakdowns fire on a schedule
(no run-time randomness), last 12 s `'brokenDown'` + 6 s `'beingRepaired'`
(~18 s total, `BREAK_DOWN_SECS`/`REPAIR_SECS`) and then the ride reopens with
the next failure rearmed. On breakdown the FSM parks at
`movingToEndOfStation` (state callbacks fire, e.g. spin-down) and PAUSES — no
admissions — while the queue drains through the shared crash-ish path
(`drainRide`: queuers/enterers walk off thinking `notSafe`, anyone aboard
leaves via the exit hut). `joinRefusal` refuses broken rides and aimless
guests skip them as goals. The handle's `status()` reports the RCT2
ride-window status line (`Ride::formatStatusTo`,
`src/openrct2/ride/Ride.cpp:528-564`): `'open' | 'closed' (crashed) |
'brokenDown' | 'beingRepaired'`.

## UI accessors (additive — feed the window suite)

- `guests()` — live records for GuestInfo: `{ id, name ('Guest N'), state,
  happiness, hunger, thirst, energy, nausea, toilet, thoughts: string[],
  position: [x, y, z], hidden, gone }[]` for every non-despawned guest (RCT2
  guest-window data: stats-tab bars `openrct2-ui/windows/Guest.cpp:146-159`,
  thoughts tab `:172,827-848`; `hidden` = inside a hut / not yet through the
  gate).
- `rides()` — roster for ParkInfo: `{ name, status, state, queue,
  boardPoint }[]`.
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

- `registerRide(cfg)` — v1 fields unchanged (`name, capacity, rideDuration, loadTime?, queueAnchor, queueDir, entrance?, boardPoint, exitPoint, onStateChange?`; `loadTime` now times the `departing` phase) plus `intensity?` (1–10, default 4), `price?` (default 0), `minWait?`/`maxWait?` (seconds), `vehicleHandle?`, `seatWorld?` (per-seat rider transform, see Boarding), `breakdownEvery?` (mean seconds between deterministic breakdowns), and `laneLen?` (round-2, ADDITIVE: explicit queue-lane length in world units, min 1.2; default stays the capacity formula `max(2.2, 0.6 + capacity·2·0.28 + 0.5)` — Park's register wrappers pass a trimmed value so the derived tail spur at `queueAnchor + (laneLen + 0.35)·queueDir` lands ON the street node the layout planned). Still builds the red QueuePath-style lane + entrance/exit huts (exit possibly audit-shifted) and returns `{ name, state(), queueLength(), occupancy(), exitPoint(), exitShift, status(), totalRides(), boardPoint(), seatAt(k) }` — `occupancy()` = `{ riders, capacity, occupied }`, `seatAt(k)` the live per-seat transform (ADDITIVE; `null` without `seatWorld`).
- `registerStall(cfg)` → `{ name, sold() }`; `registerBin(x, z)` → `{ count() }`.
- `registerRestroom({ anchor?, yaw?, doorway?, owner? })` → `{ uses() }` (logic only — place the `buildRestroom` mesh yourself; `owner` ties the registration to the hut's own blocker so a guest walking to THIS doorway is never blocked by it).
- `registerParkEntrance(pe, { yaw?, position? })` → `{ spawnPoint, archway }` in WORLD coords — makes the gate the sole spawn/despawn point.
- `spawnGuests(count, area?)` — deterministic varied peeps (`buildPeep`, 0.5 scale). With a registered park entrance they arrive staggered through the gate (`area` optional, used only as the fallback wander home); without one they distribute along network edges (or the home disc without a net) as before.
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
| `guestFx.ts` | thoughts, the hashed per-guest `draw`, litter/vomit/poop pools, the two-hand registry, held items, held + flown balloons and their per-frame tweens |
| `access.ts` | queue lane + slot geometry, `placeAccess` audit, RCT2 status line, breakdown interval, NaN-guarded attach, relocation accessors, `corridorCells` |
| `registry.ts` | `register{Ride,Stall,Bin,Restroom,DanceZone,ParkEntrance}` and the handles they return |
| `spawn.ts` | `spawnGuests` — rig build, hashed appearance, fresh-arrival stat block, click proxy |
| `locomotion.ts` | blocker-aware `moveToward` (with its byte-identical no-blockers fast path), needs-driven speed, waypoint runner |
| `needs.ts` | the Tick128 needs clock, queue join/balk, the shop counter |
| `navigation.ts` | network walk, node-arrival decisions, direct-walk fallback |
| `rideFsm.ts` | the ride state machine, exit-hut unload, shared queue drain |
| `guestPass.ts` | the per-frame guest pass: state dispatch + the whole pose/overlay stack |
| `queries.ts` | `stats` / guest records / ride roster / the validatePark accessors |

Original three.js composition on the shared Stage; behaviour ported from OpenRCT2 (`src/openrct2/entity/Guest.cpp`, `Peep.h`, `ride/Vehicle.h`, `peep/GuestPathfinding.cpp`), realistic palette only.

# TwistRide

**CANONICAL IMPORT — copy exactly:** `import { TwistRide } from './components/TwistRide';`
*(never from `'./Park'`: only the `<Park>` wrappers + track-piece JSX live there. A wrong
specifier makes esbuild refuse the WHOLE bundle — the round-8 black-page failure.)*

Twist: three arms with counter-rotating car clusters (TWIST1). Original three.js model; proportions and palette referenced from the RCT2 asset library.

Fully composable ride on the `<ConfigurableRide>` chassis (FerrisWheel pattern):

- `<TwistRide position rotation scale riders register name capacity rideDuration price intensity queue>` — inside a `<Park>` with `register` it wires the full GameManager ride: queue HEAD 3.5 out the local +z front (clear of the 2.25 car sweep; lane tail at `3.5 + laneLenOf(capacity) + 0.35` — plant it on/near a street node), exit hut at local `[-2.8, 1.5]`. REAL guests ride the 6 tubs (`seatWorld`), the rotor spins down while brokenDown/beingRepaired (`onStateChange`), clicking opens the RideViewer (tub onboard cam). `riders` (decorative peeps, `lodDetail`-tagged) defaults true standalone / false when registered. Defaults: capacity 6, duration 8, intensity 5, price 3.
- `buildTwistRideScene(t, { riders? }) → { group, update, seatWorld(seat), vehicle, onStateChange }` — the imperative builder.

Night: amber arm/hub accent bulbs + 2 real PointLights (hub + pad flood), `nightKOf`-gated. Previews wrap it in `<ScenePreview distance={6.5} targetY={0.7}>`.

## RCT2 station behaviour (motion gate) + real seats

Each tub is a low flared orange bucket (maroon rim ring, dark cockpit floor) holding a REAL upholstered seat — dark moulded pan + backrest shells with burgundy fabric cushions and a headrest pad (the CoasterCar/FlyingSaucers upholstery pattern) — plus a lap bar over the thighs. The seat anchor keeps the hip convention: hip underside ≈ 0.45·scale above the anchor lands on the pan-cushion top (car-local 0.25).

Capacity **6** = 3 arms × 2 tub cars. REAL GameManager guests board DISTINCT live seat anchors via `seatWorld` (decorative riders default true standalone / **false when registered** — unfilled seats read visibly EMPTY). The built `update` is wrapped in `createMotionGate` (GameManager): a registered ride sits **PARKED** through `waitingForPassengers`/`waitingToDepart`/`unloadingPassengers`, eases 0→1 into motion on `departing` (~0.8 s) and eases back to rest into `arriving` — so guests board and leave a stationary vehicle, RCT2 Vehicle.cpp-style. Breakdown spin-downs compose with the gate (the FSM parks in `movingToEndOfStation` while broken). Un-registered previews are byte-identical: the gate starts UNGATED and passes raw time through until the first `onStateChange`.

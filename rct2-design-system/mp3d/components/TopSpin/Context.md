# TopSpin

Top Spin: royal-blue gondola row somersaulting between swinging arms (TOPSP1). Original three.js model; proportions and palette referenced from the RCT2 asset library.

Fully composable ride on the `<ConfigurableRide>` chassis (FerrisWheel pattern):

- `<TopSpin position rotation scale riders register name capacity rideDuration price intensity queue>` — inside a `<Park>` with `register` it wires the full GameManager ride: queue HEAD 3.5 out the local +z front (clear of the ~2.1 fore/aft gondola swing; lane tail at `3.5 + laneLenOf(capacity) + 0.35` — plant it on/near a street node), exit hut at local `[-2.3, 1.5]` (outside the swing envelope and tower pads). REAL guests ride the 8-seat row (`seatWorld`), the swing/somersault amplitudes ease to rest while brokenDown/beingRepaired (`onStateChange`), clicking opens the RideViewer (gondola onboard cam). `riders` (decorative peeps, `lodDetail`-tagged) defaults true standalone / false when registered. Defaults: capacity 8, duration 8, intensity 8, price 4.
- `buildTopSpinScene(t, { riders? }) → { group, update, seatWorld(seat), vehicle, onStateChange }` — the imperative builder.

Night: gondola accent bulbs + tower beacons with 2 real PointLights, `nightKOf`-gated. Previews wrap it in `<ScenePreview distance={8} targetY={1.6}>`.

## RCT2 station behaviour (motion gate) + real seats

Capacity **8** = 2 back-to-back rows × 4 seats. REAL GameManager guests board DISTINCT live seat anchors via `seatWorld` (decorative riders default true standalone / **false when registered** — unfilled seats read visibly EMPTY). The built `update` is wrapped in `createMotionGate` (GameManager): a registered ride sits **PARKED** through `waitingForPassengers`/`waitingToDepart`/`unloadingPassengers`, eases 0→1 into motion on `departing` (~0.8 s) and eases back to rest into `arriving` — so guests board and leave a stationary vehicle, RCT2 Vehicle.cpp-style. Breakdown spin-downs compose with the gate (the FSM parks in `movingToEndOfStation` while broken). Un-registered previews are byte-identical: the gate starts UNGATED and passes raw time through until the first `onStateChange`. The swing/somersault amplitudes follow the gate's eased speed (spinDown 0.9) so the gondola settles hanging LEVEL for boarding.

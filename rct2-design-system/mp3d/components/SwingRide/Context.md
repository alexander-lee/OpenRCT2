# SwingRide

Chair swing / wave-swinger: chained chairs flung out from a spinning striped canopy, mirrored centre column, rim lamps that glow at night. Modelled from the authentic RCT2 sprite.

Fully composable ride on the `<ConfigurableRide>` chassis (FerrisWheel pattern):

- `<SwingRide position rotation scale riders register name capacity rideDuration price intensity queue>` — inside a `<Park>` with `register` it wires the full GameManager ride: queue HEAD 2.0 out the local +z front (only the 0.72 base pad obstructs at ground level — the chairs fly at y ≈ 2.6+; lane tail at `2.0 + laneLenOf(capacity) + 0.35` — plant it on/near a street node), exit hut at local `[-1.5, 1.35]`. REAL guests fly on the 8 chairs (`seatWorld`), the canopy spins down (chairs settle inward) while brokenDown/beingRepaired (`onStateChange`), clicking opens the RideViewer (chair onboard cam). `riders` (decorative peeps, `lodDetail`-tagged) defaults true standalone / false when registered. Defaults: capacity 8, duration 8, intensity 4, price 3.
- `buildSwingRideScene(t, { riders? }) → { group, update, seatWorld(seat), vehicle, onStateChange }` — the imperative builder.

Night: 12 rim lamps twinkling + 3 real PointLights pooling warm light below, `nightKOf`-gated. Previews wrap it in `<ScenePreview distance={7.5} targetY={1.8}>`.

## RCT2 station behaviour (motion gate) + real seats

Capacity **8** = the 8 flying chairs. REAL GameManager guests board DISTINCT live seat anchors via `seatWorld` (decorative riders default true standalone / **false when registered** — unfilled seats read visibly EMPTY). The built `update` is wrapped in `createMotionGate` (GameManager): a registered ride sits **PARKED** through `waitingForPassengers`/`waitingToDepart`/`unloadingPassengers`, eases 0→1 into motion on `departing` (~0.8 s) and eases back to rest into `arriving` — so guests board and leave a stationary vehicle, RCT2 Vehicle.cpp-style. Breakdown spin-downs compose with the gate (the FSM parks in `movingToEndOfStation` while broken). Un-registered previews are byte-identical: the gate starts UNGATED and passes raw time through until the first `onStateChange`. The outward fling follows the gate's eased speed (spinDown 0.9) so the chairs settle inward when parked.

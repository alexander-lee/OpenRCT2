# FerrisWheel

**CANONICAL IMPORT — copy exactly:** `import { FerrisWheel } from './components/FerrisWheel';`
*(never from `'./Park'`: only the `<Park>` wrappers + track-piece JSX live there. A wrong
specifier makes esbuild refuse the WHOLE bundle — the round-8 black-page failure.)*

Ferris wheel matched to the RCT2 FWH1 sprite: red wheel steel with lattice cross-bracing between paired rings, cream rim, slate A-frame lattice supports and 8 upright bench gondolas. Night: 32 instanced rim bulbs (one draw call) + two hub PointLights, all `nightKOf`-gated. Perf-merged (`mergedBoxes` for supports, wheel lattice and gondola shells).

**THE composable-ride exemplar** (components/Park/Context.md → "The composable convention"). Exports:

- `<FerrisWheel position rotation scale riders register name capacity rideDuration price intensity queue>` — renders the `<ConfigurableRide>` chassis DIRECTLY (not the `composableRide` factory: that strips `register` from the props it hands the builder, so the riders-off-when-registered default needs the component to close over `register` itself). Inside a `<Park>` with `register` (true or `{ name, capacity, rideDuration, price, intensity }`) it registers the full GameManager ride: queue HEAD 1.8 out the local +z front (lane extending +z — plant the TAIL, `1.8 + laneLenOf(capacity) + 0.35`, on/near a street node), exit hut at local `[-1.5, 1.35]`, boarding at the wheel base; REAL guests ride the gondolas (`seatWorld`), the wheel spins down while brokenDown/beingRepaired (`onStateChange`), and clicking it opens the RideViewer (gondola onboard cam). `riders` defaults true standalone / false when registered.
- `buildFerrisWheel(t, { riders? }) → { group, update, seatWorld(seat), vehicle, onStateChange }` — the imperative builder.

Previews wrap the component in `<ScenePreview distance={9} targetY={2.4}>` — components never render a Stage.

## RCT2 station behaviour (motion gate) + real seats

Capacity **8** = the 8 bench gondolas (seatWorld anchors; was 4). REAL GameManager guests board DISTINCT live seat anchors via `seatWorld` (decorative riders default true standalone / **false when registered** — unfilled seats read visibly EMPTY). The built `update` is wrapped in `createMotionGate` (GameManager): a registered ride sits **PARKED** through `waitingForPassengers`/`waitingToDepart`/`unloadingPassengers`, eases 0→1 into motion on `departing` (~0.8 s) and eases back to rest into `arriving` — so guests board and leave a stationary vehicle, RCT2 Vehicle.cpp-style. Breakdown spin-downs compose with the gate (the FSM parks in `movingToEndOfStation` while broken). Un-registered previews are byte-identical: the gate starts UNGATED and passes raw time through until the first `onStateChange`.

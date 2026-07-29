# Teacups

**CANONICAL IMPORT — copy exactly:** `import { Teacups } from './components/Teacups';`
*(never from `'./Park'`: only the `<Park>` wrappers + track-piece JSX live there. A wrong
specifier makes esbuild refuse the WHOLE bundle — the round-8 black-page failure.)*

Spinning tea-cups flat ride (COFFEECU): a wooden turntable with a coffee-grinder centrepiece and four tilted white/pink cups that each spin on their own axis while the deck rotates. Modelled from the authentic RCT2 sprite.

Each cup is a real ride car: an outer white wall with a gold lip torus, a PINK inner liner 0.03 inside it (the cup's wall thickness — it meets the lip's inner surface exactly), a floor pan 0.20 down in the cup, and a **20-segment upholstered bench ring** around the interior (dark moulded shell + claret fabric cushion, top y 0.30, + leaning backrest; batched with `mergedBoxes`, 2 draw calls per cup) with an 80° step-in gap on the outward side. The cup HANDLE is a C-shaped partial torus tilted 0.337 rad to follow the wall flare, so both roots bury 0.014 inside the 0.03 wall thickness (nothing shows inside the cup) and the top of the arc stays 0.044 under the gold lip.

Fully composable ride on the `<ConfigurableRide>` chassis (FerrisWheel pattern):

- `<Teacups position rotation scale riders register name capacity rideDuration price intensity queue>` — inside a `<Park>` with `register` it wires the full GameManager ride: queue HEAD 3.2 out the local +z front (clear of the 1.95 base ring; lane tail at `3.2 + laneLenOf(capacity) + 0.35` — plant it on/near a street node), exit hut at local `[-2.5, 1.35]`. REAL guests ride the cups (`seatWorld`, one per cup), the deck/crank/cups spin down while brokenDown/beingRepaired (`onStateChange`), clicking opens the RideViewer (cup onboard cam). `riders` (decorative peeps, `lodDetail`-tagged) defaults true standalone / false when registered. Defaults: capacity 4, duration 8, intensity 3, price 3.
- `buildTeacupsScene(t, { riders? }) → { group, update, seatWorld(seat), vehicle, onStateChange }` — the imperative builder.

Night: 12 rail bulbs riding the deck + centre glow + pad flood (2 real PointLights), `nightKOf`-gated. Previews wrap it in `<ScenePreview distance={5.8} targetY={0.8}>`.

## RCT2 station behaviour (motion gate) + real seats

Capacity **4** = the 4 cups (one seat anchor each, at cup-local `(-0.22, 0.129, 0)` facing radially outward — hips `0.129 + 0.45·0.38 = 0.30` land ON the bench cushion top). REAL GameManager guests board DISTINCT live seat anchors via `seatWorld` (decorative riders default true standalone / **false when registered** — unfilled seats read visibly EMPTY). The built `update` is wrapped in `createMotionGate` (GameManager): a registered ride sits **PARKED** through `waitingForPassengers`/`waitingToDepart`/`unloadingPassengers`, eases 0→1 into motion on `departing` (~0.8 s) and eases back to rest into `arriving` — so guests board and leave a stationary vehicle, RCT2 Vehicle.cpp-style. Breakdown spin-downs compose with the gate (the FSM parks in `movingToEndOfStation` while broken). Un-registered previews are byte-identical: the gate starts UNGATED and passes raw time through until the first `onStateChange`.

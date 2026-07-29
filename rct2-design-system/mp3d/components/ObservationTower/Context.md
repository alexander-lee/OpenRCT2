# ObservationTower

**CANONICAL IMPORT — copy exactly:** `import { ObservationTower } from './components/ObservationTower';`
*(never from `'./Park'`: only the `<Park>` wrappers + track-piece JSX live there. A wrong
specifier makes esbuild refuse the WHOLE bundle — the round-8 black-page failure.)*

Observation tower: blue window drum + orange/white pinwheel roof cabin rising a lattice mast (OBS1).

Original three.js model on the shared Stage (day/night lighting); proportions and palette referenced from the RCT2 asset library.

## RCT2 station behaviour (motion gate) + real seats

Capacity **8** = the 8 cabin window spots (anchors around the floor ring). REAL GameManager guests board DISTINCT live seat anchors via `seatWorld` (decorative riders default true standalone / **false when registered** — unfilled seats read visibly EMPTY). The built `update` is wrapped in `createMotionGate` (GameManager): a registered ride sits **PARKED** through `waitingForPassengers`/`waitingToDepart`/`unloadingPassengers`, eases 0→1 into motion on `departing` (~0.8 s) and eases back to rest into `arriving` — so guests board and leave a stationary vehicle, RCT2 Vehicle.cpp-style. Breakdown spin-downs compose with the gate (the FSM parks in `movingToEndOfStation` while broken). Un-registered previews are byte-identical: the gate starts UNGATED and passes raw time through until the first `onStateChange`. The mast height follows the gate's eased speed and each 'departing' restarts the climb — the cabin is parked at the base for boarding/unloading.

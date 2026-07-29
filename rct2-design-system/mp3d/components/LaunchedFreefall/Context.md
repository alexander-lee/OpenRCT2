# LaunchedFreefall

**CANONICAL IMPORT — copy exactly:** `import { LaunchedFreefall } from './components/LaunchedFreefall';`
*(never from `'./Park'`: only the `<Park>` wrappers + track-piece JSX live there. A wrong
specifier makes esbuild refuse the WHOLE bundle — the round-8 black-page failure.)*

Launched freefall tower: a tall pale square lattice tower (red diagonal chords, hex cap cone, head bearing drum) over a concrete base station with a compressed-air launch plant — three domed tanks with pressure bands, a manifold, feed pipes, compressor skid and gauge. The 4-seat ring car (collar frame, canopy plate, guide bushes) launches up hard on a ParticleKit air-blast burst, floats weightless at the apex — riders' arms rise and wave — then glides down; deterministic 12 s cycle. Seats have blue cushions + headrests with over-shoulder restraints, chest pads and lap bars; legs dangle. Optional ColorKit `scheme` recolours tower/accents/car. Night: pulsing red aviation beacon, warm under-car light and one station mast light (3 real PointLights), plus tower marker bulbs.

Built with three.js on the shared Stage; modelled on the RCT2 Launched Freefall silhouette.

## RCT2 station behaviour (motion gate) + real seats

Capacity **4** = the 4-seat ring car (was 6). REAL GameManager guests board DISTINCT live seat anchors via `seatWorld` (decorative riders default true standalone / **false when registered** — unfilled seats read visibly EMPTY). The built `update` is wrapped in `createMotionGate` (GameManager): a registered ride sits **PARKED** through `waitingForPassengers`/`waitingToDepart`/`unloadingPassengers`, eases 0→1 into motion on `departing` (~0.8 s) and eases back to rest into `arriving` — so guests board and leave a stationary vehicle, RCT2 Vehicle.cpp-style. Breakdown spin-downs compose with the gate (the FSM parks in `movingToEndOfStation` while broken). Un-registered previews are byte-identical: the gate starts UNGATED and passes raw time through until the first `onStateChange`. The flight height follows the gate's eased speed and each 'departing' restarts the 12 s launch cycle — the car is parked at the station for boarding/unloading. The arm-raise overlay only animates the decorative riders (skipped when registered).

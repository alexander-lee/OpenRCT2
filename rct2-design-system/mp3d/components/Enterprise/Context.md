# Enterprise

**CANONICAL IMPORT — copy exactly:** `import { Enterprise } from './components/Enterprise';`
*(never from `'./Park'`: only the `<Park>` wrappers + track-piece JSX live there. A wrong
specifier makes esbuild refuse the WHOLE bundle — the round-8 black-page failure.)*

Enterprise: pink-spoked pod wheel that spins up and lifts toward vertical (ENTERP).

Each pod's **glass cover is a CURVED canopy** — a partial cylinder concentric with the pod shell (radii +0.004, arc 1.86 rad lapping the shell's 1.8 rad opening by 0.03 on each side) with dark hood/sill trim bands above and below it, so the glass follows the pod's curvature and stays inside its silhouette (the old flat 0.2 × 0.3 plate had corners at radius 0.172, outside the 0.14 shell top radius, and jutted through the pod body).

Original three.js model on the shared Stage (day/night lighting); proportions and palette referenced from the RCT2 asset library.

## RCT2 station behaviour (motion gate) + real seats

Capacity **10** = the 10 pods (was 8; one seat anchor per pod). REAL GameManager guests board DISTINCT live seat anchors via `seatWorld` (decorative riders default true standalone / **false when registered** — unfilled seats read visibly EMPTY). The built `update` is wrapped in `createMotionGate` (GameManager): a registered ride sits **PARKED** through `waitingForPassengers`/`waitingToDepart`/`unloadingPassengers`, eases 0→1 into motion on `departing` (~0.8 s) and eases back to rest into `arriving` — so guests board and leave a stationary vehicle, RCT2 Vehicle.cpp-style. Breakdown spin-downs compose with the gate (the FSM parks in `movingToEndOfStation` while broken). Un-registered previews are byte-identical: the gate starts UNGATED and passes raw time through until the first `onStateChange`. The arm lift follows the gate's eased speed (spinDown 0.9): the wheel parks lowered/flat for boarding.

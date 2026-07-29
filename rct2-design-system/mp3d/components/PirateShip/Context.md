# PirateShip

**CANONICAL IMPORT — copy exactly:** `import { PirateShip } from './components/PirateShip';`
*(never from `'./Park'`: only the `<Park>` wrappers + track-piece JSX live there. A wrong
specifier makes esbuild refuse the WHOLE bundle — the round-8 black-page failure.)*

Swinging pirate ship on a pivot arm between two towers.

Built with three.js on the shared Stage; modelled from the authentic RCT2 sprite.

## RCT2 station behaviour (motion gate) + real seats

Capacity **10** = 5 rider rows × 2 bench spots (was 8). REAL GameManager guests board DISTINCT live seat anchors via `seatWorld` (decorative riders default true standalone / **false when registered** — unfilled seats read visibly EMPTY). The built `update` is wrapped in `createMotionGate` (GameManager): a registered ride sits **PARKED** through `waitingForPassengers`/`waitingToDepart`/`unloadingPassengers`, eases 0→1 into motion on `departing` (~0.8 s) and eases back to rest into `arriving` — so guests board and leave a stationary vehicle, RCT2 Vehicle.cpp-style. Breakdown spin-downs compose with the gate (the FSM parks in `movingToEndOfStation` while broken). Un-registered previews are byte-identical: the gate starts UNGATED and passes raw time through until the first `onStateChange`. The swing amplitude follows the gate's eased speed (spinDown 0.9) so the boat hangs LEVEL for boarding — a half-full boat visibly shows empty bench spots.

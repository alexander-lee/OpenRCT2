# DropTower

Vertical drop tower: a ring gondola that climbs then drops.

Built with three.js on the shared Stage; modelled from the authentic RCT2 sprite.

## RCT2 station behaviour (motion gate) + real seats

Capacity **10** = the 10 outward-facing gondola ring seats (was 6). REAL GameManager guests board DISTINCT live seat anchors via `seatWorld` (decorative riders default true standalone / **false when registered** — unfilled seats read visibly EMPTY). The built `update` is wrapped in `createMotionGate` (GameManager): a registered ride sits **PARKED** through `waitingForPassengers`/`waitingToDepart`/`unloadingPassengers`, eases 0→1 into motion on `departing` (~0.8 s) and eases back to rest into `arriving` — so guests board and leave a stationary vehicle, RCT2 Vehicle.cpp-style. Breakdown spin-downs compose with the gate (the FSM parks in `movingToEndOfStation` while broken). Un-registered previews are byte-identical: the gate starts UNGATED and passes raw time through until the first `onStateChange`. The climb height follows the gate's eased speed and each 'departing' restarts the climb from the base — the gondola is parked at the bottom for boarding/unloading.

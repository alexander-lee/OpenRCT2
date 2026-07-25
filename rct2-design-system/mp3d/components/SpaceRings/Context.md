# SpaceRings

Space rings: gyroscope rings with a strapped-in rider (SRINGS).

Original three.js model on the shared Stage (day/night lighting); proportions and palette referenced from the RCT2 asset library.

## RCT2 station behaviour (motion gate) + real seats

Capacity **1** = the single gyroscope harness. REAL GameManager guests board DISTINCT live seat anchors via `seatWorld` (decorative riders default true standalone / **false when registered** — unfilled seats read visibly EMPTY). The built `update` is wrapped in `createMotionGate` (GameManager): a registered ride sits **PARKED** through `waitingForPassengers`/`waitingToDepart`/`unloadingPassengers`, eases 0→1 into motion on `departing` (~0.8 s) and eases back to rest into `arriving` — so guests board and leave a stationary vehicle, RCT2 Vehicle.cpp-style. Breakdown spin-downs compose with the gate (the FSM parks in `movingToEndOfStation` while broken). Un-registered previews are byte-identical: the gate starts UNGATED and passes raw time through until the first `onStateChange`. The rock amplitude follows the gate speed and the tumble settles to the NEAREST upright turn — the guest is strapped in/released standing up.

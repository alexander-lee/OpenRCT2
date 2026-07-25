# GhostTrain

Ghost train dark ride: a dark stepped-gable show building (geometric skull-and-crossbones sign, flame lanterns, blood-red flap doors placed exactly where the spline pierces the wall) on a closed CatmullRom circuit that runs through the building and dips outdoors through a mini graveyard — original tombstones, a leaning cross, a dead tree and a rusty iron fence arc. A 3-car train (2-seat cars with cushioned benches + shared lap bars, lamp and skull emblem on the lead car) rides the twin tube rails via a minimal local spline runner. A white ghost sheet bobs deterministically behind a barred window. Night is eerie green: interior door-glow, graveyard wash and the gated head-lamp (3 real PointLights) plus flickering green panes.

Built with three.js on the shared Stage; modelled on the RCT2 Ghost Train silhouette.

## RCT2 station behaviour (motion gate) + real seats

Capacity **6** = 3 two-seat cars (was 4). REAL GameManager guests board DISTINCT live seat anchors via `seatWorld` (decorative riders default true standalone / **false when registered** — unfilled seats read visibly EMPTY). The built `update` is wrapped in `createMotionGate` (GameManager): a registered ride sits **PARKED** through `waitingForPassengers`/`waitingToDepart`/`unloadingPassengers`, eases 0→1 into motion on `departing` (~0.8 s) and eases back to rest into `arriving` — so guests board and leave a stationary vehicle, RCT2 Vehicle.cpp-style. Breakdown spin-downs compose with the gate (the FSM parks in `movingToEndOfStation` while broken). Un-registered previews are byte-identical: the gate starts UNGATED and passes raw time through until the first `onStateChange`. The train's crawl clock is gated: it stands parked on the loop for boarding/unloading.

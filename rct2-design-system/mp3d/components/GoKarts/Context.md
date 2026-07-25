# GoKarts

Go-kart circuit rebuilt on SplineRideKit ('gokart' profile — RCT2 tracks go-karts as a real tracked ride): a closed flat asphalt course with two straights, an S-bend of esses and a tight hairpin, kerbed in red/white. Four orange karts with seated guest drivers race their own lanes and throttles (laneOffset/speedScale) so they overtake; start gantry + chequered line sit on the spline's start frame, tyre stacks guard the hairpin, headlights come on at night. Each kart trails tiny ParticleKit exhaust puffs (grey-blue, buoyant, growing) whose emission rate is THROTTLE-SYNCED to the kart's time-warp surge — 4 × 32 = 128 particles, origins chasing the tailpipes in world space.

Built with three.js on the shared Stage; modelled from the authentic RCT2 sprite. Layout passes validateSpline.

## Track pieces

Optional `pieces` array or JSX piece children (children win) replace the stock circuit with a compileTrackPieces course on the same 'gokart' profile (auto-closed; closure + clearance report lands on the group's `userData.trackReport`). Kart courses are FLAT — legal pieces: `station` / `straight` (`flat`) / `turnL` / `turnR` / `sbend` / height-less helixes. Vertical pieces are STRIPPED with a console.warn naming the piece: `lift`/`drop`/`hill` are removed outright and a helix loses any `height` (its flat arc is kept) — karts never ramp. All the dressing follows a custom course: the start gantry plants on the new start frame, the tyre stacks find the tightest turn by a deterministic curvature scan, and the kart fleet / exhausts / headlights are unchanged. Defaults are untouched when no pieces are given.

```jsx
<GoKarts>
  <Station />
  <Straight length={2.2} />
  <TurnR angle={180} radius={1.1} />
  <Straight length={1.2} />
  <SBend radius={1.4} />
  <TurnL angle={90} radius={1.3} />
</GoKarts>
```

## RCT2 station behaviour (motion gate) + real seats

Capacity **4** = the 4 karts (one driver each). REAL GameManager guests board DISTINCT live seat anchors via `seatWorld` (decorative riders default true standalone / **false when registered** — unfilled seats read visibly EMPTY). The built `update` is wrapped in `createMotionGate` (GameManager): a registered ride sits **PARKED** through `waitingForPassengers`/`waitingToDepart`/`unloadingPassengers`, eases 0→1 into motion on `departing` (~0.8 s) and eases back to rest into `arriving` — so guests board and leave a stationary vehicle, RCT2 Vehicle.cpp-style. Breakdown spin-downs compose with the gate (the FSM parks in `movingToEndOfStation` while broken). Un-registered previews are byte-identical: the gate starts UNGATED and passes raw time through until the first `onStateChange`. The whole race clock is gated: the pack stands on the circuit while guests board and rolls to a stop for unloading.

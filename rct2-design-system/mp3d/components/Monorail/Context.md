# Monorail

Elevated monorail beam on piers with a streamlined gliding train.

Built with three.js on the shared Stage; modelled from the authentic RCT2 sprite.

## Track pieces

Optional `pieces` array or JSX piece children (children win) turn the classic shuttle into a closed-LOOP elevated beam circuit (compileTrackPieces on the 'monorail' profile; swept concrete beam + piers follow the spline, the train becomes three articulated cars; report on the group's `userData.trackReport`). The beam is FLAT-only — legal pieces: `station` / `straight` (`flat`) / `turnL` / `turnR` / `sbend` / height-less helixes. Vertical pieces are STRIPPED with a console.warn naming the piece: `lift`/`drop`/`hill` are removed outright and a helix loses any `height` — monorails never ramp up and down. Defaults (the back-and-forth shuttle) are untouched when no pieces are given.

```jsx
<Monorail pieces={[
  'station',
  { type: 'straight', length: 1.6 },
  { type: 'turnR', angle: 90, radius: 1.8 },
  { type: 'straight', length: 2.4 },
  { type: 'turnR', angle: 90, radius: 1.8 },
  { type: 'sbend', radius: 1.2 },
]} />
```

### Preview circuits (RCT2 archetypes)

Two archetype circuits ship as previews, both FLAT and both closing on their own approach straight (nothing synthesized, validateSpline clean):

- **Grand Circle Tour** — four radius-3 `turnL` sweeps + one `sbend`: the park-ringing stadium oval. Monorail.h:26 is the only whitelist here with `curveLarge`, and the ride's rating asks for open air (`RequirementUnsheltered` 4), so the game genuinely rewards the big outdoor circle.
- **Plaza Circuit** — an L-wrap that steps out twice (five `turnL` + one reverse `turnR` notch, 360° total) and runs one long 7.8-u beam home: the monorail threaded BETWEEN buildings rather than around them.

NOTE (pre-existing): the older 'Custom loop (pieces)' preview list only turns 180° in total, so `compileTrackPieces` has to synthesize 52% of the authored length to close it and reports **FATAL** in the console. Left byte-identical on purpose — it needs two more turns (or the Grand Circle list) to be legal.

## RCT2 station behaviour (motion gate) + real seats

Capacity **6** = 3 enclosed cabins × 2 interior anchors (was 8; riders sit behind the amber window band). REAL GameManager guests board DISTINCT live seat anchors via `seatWorld` (decorative riders default true standalone / **false when registered** — unfilled seats read visibly EMPTY). The built `update` is wrapped in `createMotionGate` (GameManager): a registered ride sits **PARKED** through `waitingForPassengers`/`waitingToDepart`/`unloadingPassengers`, eases 0→1 into motion on `departing` (~0.8 s) and eases back to rest into `arriving` — so guests board and leave a stationary vehicle, RCT2 Vehicle.cpp-style. Breakdown spin-downs compose with the gate (the FSM parks in `movingToEndOfStation` while broken). Un-registered previews are byte-identical: the gate starts UNGATED and passes raw time through until the first `onStateChange`. The shuttle glide follows the gate envelope and parks at the beam CENTRE (the station); the piece-composed loop glider simply stops where its gated clock rests.

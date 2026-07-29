# BumperCars

**CANONICAL IMPORT — copy exactly:** `import { BumperCars } from './components/BumperCars';`
*(never from `'./Park'`: only the `<Park>` wrappers + track-piece JSX live there. A wrong
specifier makes esbuild refuse the WHOLE bundle — the round-8 black-page failure.)*

Dodgems: a fenced arena with a powered ceiling grid and four cars that ACTUALLY bump. The cars run a deterministic rink sim — hashed-sine waypoint steering, clamped-dt (≤0.1) velocity integration, wall reflection (restitution 0.55) and circle-circle impulses (radius 0.41, restitution 0.65) — so they deflect off each other with a jolt: body-tilt kick, driver whiplash, bumper-skirt + pole-contact flash. Fully composable ride: `register` inside a `<Park>` wires the GameManager (queue HEAD 2.6 out local +z, exit hut at [-2.1, 2.0]); real guests ride the bumping cars via `seatWorld` (static drivers hide, FerrisWheel-style), `vehicle` (car 0) feeds the onboard cam, and `onStateChange` glides the cars to a stop on breakdown. Ceiling string lights + two PointLights night-gate via nightK.

Built with three.js on the shared Stage; modelled from the authentic RCT2 sprite.

## Detail pass

The car is a MOULDED SHELL, not a box on a disc. Two numbers are owned by the sim and everything is built around them — collision radius **0.41** (the rubber bumper's outer edge: a torus of major 0.35 + tube 0.06, so the visual footprint IS the collision footprint) and the seat anchor **(0, 0.16, −0.02)**, which the decorative rider and `seatWorld` share. On top of that: the coloured skirt band that flashes on every hit, a flared egg-shaped fibreglass tub under a chrome cockpit rim, a rounded nose cowl with a chrome nose bar and two lamp studs, a tall curved back panel carrying a number roundel and twin tail lamps, a bucket seat with side piping and a headroll, a dash with a chrome strip, a real spoked steering wheel on a raked column, and a sprung pole — foot plate, coil, mast, diagonal brace, contact shoe — up to the live grid.

The arena: steel floor plates with bolted seams and a painted centre ring (merged, one draw call), fat rubber rub rails along the wall tops, hazard chevrons proud of the walls' OUTER faces (inset even a centimetre and they bury themselves in the wall), corner bollards, a ceiling grid that runs slats BOTH ways, and the striped facia valance every fairground dodgem hangs off its roof edge. The roof panel is 0.55 opacity on purpose: the live grid is a mesh, not a lid, so the rink stays visible from above and the bulbs glow through it at night.

## RCT2 station behaviour (motion gate) + real seats

Capacity **4** = the 4 cars (one driver each). REAL GameManager guests board DISTINCT live seat anchors via `seatWorld` (decorative riders default true standalone / **false when registered** — unfilled seats read visibly EMPTY). The built `update` is wrapped in `createMotionGate` (GameManager): a registered ride sits **PARKED** through `waitingForPassengers`/`waitingToDepart`/`unloadingPassengers`, eases 0→1 into motion on `departing` (~0.8 s) and eases back to rest into `arriving` — so guests board and leave a stationary vehicle, RCT2 Vehicle.cpp-style. Breakdown spin-downs compose with the gate (the FSM parks in `movingToEndOfStation` while broken). Un-registered previews are byte-identical: the gate starts UNGATED and passes raw time through until the first `onStateChange`. The rink sim's internal clock (already clamped-dt) is fed the GATED clock and its cruise speed target follows the gate envelope — cars sit parked while guests board and drift to a stop for unloading, unified with the breakdown drift.

# CoasterCar

**CANONICAL IMPORT — copy exactly:** `import { CoasterCar } from './components/CoasterCar';`
*(never from `'./Park'`: only the `<Park>` wrappers + track-piece JSX live there. A wrong
specifier makes esbuild refuse the WHOLE bundle — the round-8 black-page failure.)*

A single wooden-coaster car with seated riders, modelled from the RCT2 vehicle sprite. Drag to orbit.

Built with three.js on top of the shared `Stage` component. The geometry is hand-modelled to match the colours and proportions of the authentic RollerCoaster Tycoon 2 sprite (its 4 rotations were used as reference).

## Seats

Each rider gets one WELDED bucket seat, so no part of it floats: the fabric cushion is sunk 0.03 into the interior well floor (top 0.46), the dark back **shell** rises straight out of that cushion (bottom 0.415 — *inside* the cushion; front face 0.01 inside the cushion's rear edge), the fabric back pad and a **lumbar roll** are proud of the shell and also bite into the cushion top, and a headrest caps the shell. Every junction interpenetrates by ≥ 0.005, so there is no gap from any orbit angle. The previous build parked a tall back slab at y 0.48–0.76, floating 0.08 above the well floor and 0.02 behind the cushion's rear edge — visibly detached.

`COASTER_CAR_SEATS` moved with the geometry: the seat pitch is now **0.44** (front `z 0.24`, rear `z −0.20`, both at `y 0.22`), which is what keeps the rear rider's folded legs clear of the seat back in front of them. Park's `trainSeatWorld` (Park/pieces.tsx) reads the exported constant, so REAL boarded guests still land hips-on-cushion. `riders: false` leaves the seats empty for registered trains.

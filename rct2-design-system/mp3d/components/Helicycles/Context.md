# Helicycles

**CANONICAL IMPORT — copy exactly:** `import { Helicycles } from './components/Helicycles';`
*(never from `'./Park'`: only the `<Park>` wrappers + track-piece JSX live there. A wrong
specifier makes esbuild refuse the WHOLE bundle — the round-8 black-page failure.)*

Helicycles: single-seat helicopters circling a concrete ride pad (HELICAR).

Original three.js model on the shared Stage (day/night lighting); proportions and palette referenced from the RCT2 asset library.

## The foundation (a real flat-ride pad, not a lawn)

The ride sits on a poured **concrete plinth** 2.58 u across (`tex: 'concrete'` + bump) with a flush deck slab, an **asphalt apron ring** straddling the flight line (`tex: 'asphalt'` + bump) and a concrete inner island. Repeated static dressing is batched with `mergedBoxes` — **one draw call each** for: 40 **kerb blocks** round the rim, all the **painted markings** (40 chord segments forming the circle on the flight line, 8 radial guide stripes, the helipad "H"), 24 hazard blocks edging the **boarding island**, 16 steel **rail shoes** and 28 **safety-fence posts**. A bolted **steel guide rail** (torus, crowning at 0.33) hoops the flight line at radius 1.4 — parked, it runs BETWEEN each heli's skids (skids at ±0.23, hoop half-width 0.035) and 0.026 under the hull; in flight the skids ride 0.09+ clear of it. Two steel fence rings + posts ring the pad at 2.36, and a machinery cabinet with a louvred vent stands on the grass outside. Whole scene: ~294 draw calls / 33 k triangles per frame.

## The flyers

Each of the two pods is a real helicopter: drooped rounded **nose** with a landing-light lens, raked tinted **cockpit glass** in a painted frame with A-pillars, an **open coamed cockpit bay** (floor pan, gunwales, padded coaming lip, rear bulkhead) holding an **upholstered bucket seat** so the rider is plainly visible, a livery flash down each flank, a tapering **tail boom** with fin, fin flash, tailplane and a spinning two-blade **TAIL ROTOR** on its gearbox, and a full **MAIN ROTOR** — transmission pylon, mast, swashplate, hub + cap and three grip-mounted blades with painted tips (radius 1.11) — over sprung **SKID gear** (two tubes with upturned toes on four struts). Muted steel-teal / graphite / brick-red livery. Rotor spins at 14 rad/s, tail rotor at 30.

## RCT2 station behaviour (motion gate) + real seats

Capacity **2** = the 2 single-seat helicopters (was 4). REAL GameManager guests board DISTINCT live seat anchors via `seatWorld` (decorative riders default true standalone / **false when registered** — unfilled seats read visibly EMPTY). The built `update` is wrapped in `createMotionGate` (GameManager): a registered ride sits **PARKED** through `waitingForPassengers`/`waitingToDepart`/`unloadingPassengers`, eases 0→1 into motion on `departing` (~0.8 s) and eases back to rest into `arriving` — so guests board and leave a stationary vehicle, RCT2 Vehicle.cpp-style. Breakdown spin-downs compose with the gate (the FSM parks in `movingToEndOfStation` while broken). Un-registered previews are byte-identical: the gate starts UNGATED and passes raw time through until the first `onStateChange`. Flight height/bob/tilt follow the gate's eased speed (spinDown 0.9): the helis LAND on the CONCRETE PAD for boarding/unloading (parked skid bottoms rest exactly on the deck at y 0.22). The cockpit anchor sits at `0, −0.045, 0.03` — hips 0.005 into the seat cushion top.

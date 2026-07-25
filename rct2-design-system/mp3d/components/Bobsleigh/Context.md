# Bobsleigh

Full bobsled ride built on SplineRideKit's `'bobsled'` profile: a closed Catmull-Rom spline swept as an icy pale-blue half-pipe chute (flat floor + steeply angled side plates, chrome edge rails) that banks hard through every curve, carried on a steel spine, crossribs and ground columns. The layout runs downhill from a top station through sweeping banked curves to a low hairpin, then a chain lift climbs the return leg.

A 2-sled train runs energy-paced via `buildRideSpline(...).run()` — constant crawl on the lift, gravity speed through the valleys. Each sled is a compact pod in a realistic livery (steel-blue/gunmetal hull, silver nose cowl, chrome runners) with two `buildPeep` riders; the profile's default `wheelOffset` puts the runner bottoms exactly on the chute floor.

Track pieces: `pieces` prop or JSX piece children compile via `compileTrackPieces` on the guarded 'bobsled' profile (bank 0.55) — tall lifts and stepped drops are legal, ENERGY-paced (crawl up, gravity speed down), 1.5 g derail physics stay live; a FATAL compile marks the build `invalid`. Sim extras: the lead sled is the ride `vehicle` and the derail state is wired as `crashed` (registerRide vehicleHandle). Park layout: queue front 4.6 / exit [-2.0, 4.2] clear the chute.

### Preview circuits (RCT2 archetypes)

`BobsleighCoaster.h:26` whitelists half-banked helixes UP and DOWN and flat-banked curves but **no steep slopes at all** (25° ceiling) and grades the ride on lateral Gs, not drop height (`RequirementLateralGs` 1.20) — so an authentic bobsled layout twists and banks instead of plunging.

- **3D rig — Summit Chute (LEAD)** — the biggest plunge a bobsled can legally
  take. With no steep pieces at all, height is bought with LENGTH: a 12-unit belt
  `{ type: 'lift', height: 3.6, length: 12 }` hauls the sleds 3.6 units to the
  summit at **23.9°**, the level summit hairpin turns them over the edge and all
  3.6 units come back in ONE unbroken 12-unit **23.9°** plunge (9× the old
  two-stage run's 0.4 step), then a 2.2 climb to a second HIGH hairpin — slow up
  there, which is the point — and a drop home into the station. Every fast metre
  is dead straight and every turn sits at an apex, which is how it keeps the live
  1.5 g derail guard happy: **480 simulated seconds crash-free**, peak grade
  **24.0°** of the 25° ceiling, bank 31.5°, ZERO synthesized closure,
  `validateSpline` worst clearance **3.59**. Held still at 23° camera elevation
  (`dress`/`setCameraPose`) so the plunge reads.

Two more archetype previews:

- **Alpine Spiral** — a hexagonal mountain circuit (six 60° `turnL`) whose finale is a full descending `helixL` (360°, radius 2.4, −1.15) spiralling INSIDE the loop, framed by a 0.2 settling crest drop and a 0.15 step.
- **Chicane Descent** — lift, 180° summit hairpin, then a chicane down (0.4 drop, `sbend` kink, 0.3 camelback `hill`, 0.5 finale drop) into a tight two-turn U at the base and a long 4.75-u brake run past the station.

Both close with nothing synthesized and run 480 simulated seconds crash-free under the live derail guard (worst clearance 1.15 / 2.15).

(BobsleighCar, the old single-vehicle rig, is DEPRECATED — this component models its own pod and shared sleds come from SplineRideKit's `buildMiniSled`.) Original three.js model on the shared Stage; deterministic, proportions referenced from the RCT2 asset library.

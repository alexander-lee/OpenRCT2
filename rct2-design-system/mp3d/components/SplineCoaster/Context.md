# SplineCoaster

Freeform coaster built straight from 3D control points — a sibling of TrackKit (which uses an RCT2 piece vocabulary). A closed centripetal Catmull-Rom spline is sampled into parallel-transport frames (up-vector never flips over crests/drops; loop-closure twist is distributed), then auto-banked from horizontal curvature (leans into turns, clamped, box-smoothed). Rendered with twin metal-textured rail tubes, crossties, a steel spine or wooden stringers, a chain strip up the tallest climb, and supports dropped to y=0 (steel columns + concrete footers, or splayed wooden trestle bents with ledgers and X-bracing) — skipped where the track is near ground or heavily banked.

`buildSplineCoaster(t, controlPoints, opts?)` → `{ group, curve, frameAt(u), run(cars, opts?) }`. Opts: `wood`, `railColor`, `bank` (max bank rad), `supportEvery`. `run` attaches +z-facing car groups (use `buildCoasterCar` from CoasterCar) spaced by arc length, energy-paced (fast in valleys, slow over crests, constant crawl on the lift) — deterministic, driven only by the Stage clock.

### Preview circuits

- **3D rig — Vertical Plunge (LEAD)** — the rig on the steepest circuit the steel
  rules allow: 55° chain lift to a 6.4-unit crest, a LEVEL apex hairpin taken at
  chain speed, then a **72.6° / 5.7-unit near-vertical plunge**, a dead-straight
  valley, a 67° climb to a second HIGH hairpin and a second 67° drop home. Steel
  is allowed 90° (`TYPE_RULES.steel`), so the binding limit is the **pitch-RATE**
  rule (RCT2 steps slope through one-tile transition pieces, ~0.55 rad/unit):
  this layout runs **0.44** and that is what caps the plunge at ~73°. Both turns
  sit AT an apex, so every fast metre is straight — worst lateral **0.66 g**
  against the 1.5 g derail guard, +7.2 g in the valley, 1.33 s airtime,
  `checkCoasterDesign('steel')` clean with ZERO violations, `validateSpline`
  worst clearance **3.23**, bank 31.5° of the 55° steel limit. Framing: the
  Stage's default 50° camera flattens a big drop, so this preview is held still
  (`autoRotate={false}` — dragging still orbits) with the pose dropped to 23°
  elevation via `dress`/`setCameraPose`, where 1 unit of fall reads 0.92 screen
  units instead of 0.64.
- **Out-and-Back** — the gentler RCT2 archetype (3.6 crest, twin drops).

`<SplineCoaster/>` with no `points` still builds the stock circuit
(`SPLINE_COASTER_LAYOUT`, crest 3.05) — unchanged, so parks and the deprecated
`WoodenCoaster` keep their verified footprint.

Original three.js model on the shared Stage (day/night lighting); proportions and palette referenced from the RCT2 asset library.

# CoasterBuilder

A demo coaster COMPOSED from TrackKit grid pieces (chain lift, drops, corkscrew, closing turns) with a peep-filled train. Shows the RCT2 piece-composition workflow. **For park scenes and freeform layouts, prefer SplineCoaster** — the primary coaster system with spline rails, banking and terrain-aware supports.

## Preview circuits (RCT2 archetypes)

`<CoasterBuilder>` takes NO layout prop — its `LAYOUT` piece list is hard-coded in `index.tsx` — so every alternate circuit in the previews, INCLUDING the lead one, is authored with `<TrackRide profile="coaster">` (the piece-composed spline chassis) instead. The bare `<CoasterBuilder/>` rig is preview #2.

- **Twin-Apex Plunge (LEAD, `type="steel"`)** — the biggest drop the piece
  grammar can build. A chain `lift 5.5` climbs 5.5 units, the LEVEL 180° apex
  hairpin (radius 2.5) turns the train at the top and it plunges the full 5.5
  back down at **34.2°** nominal (34.6° measured on the compiled spline) — the steepest grade `rampPoints` will build at that
  height, since RCT2 steps slope through one-tile transition pieces and a TALLER
  drop is what buys a steeper one (h 1.0 → 18.0°, 3.6 → 29.5°, 5.5 → **34.2°**,
  asymptote ~37.6°). Then a 3.6 climb to a second apex hairpin and a second
  29.5° drop into the station. Every turn sits at an apex where the energy pacing
  is slow, so the whole fast half is straight: `rateCoaster` reads **excitement
  5.28 (thrilling)**, intensity 7.26, highest drop 5.47, +6.34 g, worst lateral
  **0.96 g** against the 1.275 g crash gate, **480 simulated seconds
  crash-free**, ZERO synthesized closure, design + clearance clean (worst
  **3.89**). 30.5 × 5.0 footprint, maxY 6.05 — under half the land §4.0-B needs
  for a comparable rating. Held still at 23° camera elevation
  (`dress`/`setCameraPose`) so the plunge reads as a plunge.

- **Out-and-Back Woodie** (`type="wooden"`) — chain lift, the full first drop down the out leg, then TWO camelback `hill` bumps (0.45 / 0.35) on the return and a straight brake run: `WoodenRollerCoaster.h:85` asks a woodie for ≥2 drops (`RequirementNumDrops` 2, `RequirementDropHeight` 12) plus airtime (`RequirementNegativeGs` 0.10), and wooden banking saturates at ~25°.
- **Corkscrew Twister** (`type="steel"`) — the verified L-WRAP skeleton from `rules/park-generation.md` §4 (lift 1.0 → c 2.0, d 1.3, e 4.3, f 9.8 + the 1.2-u brake tail) with an inverting `corkscrewR` spliced mid-course. Inversions are steel-only; the wooden piece table has no corkscrew group (`WoodenRollerCoaster.h:26`).

Both compile with zero synthesized closure, pass checkCoasterDesign + validateSpline, and run 480 simulated seconds crash-free under the 1.5 g derail guard.

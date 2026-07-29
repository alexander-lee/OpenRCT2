# SplineCoaster

**CANONICAL IMPORT — copy exactly:** `import { SplineCoaster } from './components/SplineCoaster';`
*(never from `'./Park'`: only the `<Park>` wrappers + track-piece JSX live there. A wrong
specifier makes esbuild refuse the WHOLE bundle — the round-8 black-page failure.)*

Freeform coaster built straight from 3D control points — a sibling of TrackKit (which uses an RCT2 piece vocabulary). A closed centripetal Catmull-Rom spline is sampled into parallel-transport frames (up-vector never flips over crests/drops; loop-closure twist is distributed), then auto-banked from horizontal curvature (leans into turns, clamped, box-smoothed). Rendered with twin metal-textured rail tubes, crossties, a steel spine or wooden stringers, a chain strip up the tallest climb, and supports dropped to y=0 (steel columns + concrete footers, or splayed wooden trestle bents with ledgers and X-bracing) — skipped where the track is near ground or heavily banked.

`buildSplineCoaster(t, controlPoints, opts?)` → `{ group, curve, frameAt(u), run(cars, opts?) }`. Opts: `wood`, `railColor`, `bank` (max bank rad), `supportEvery`, `roll` (inversions — below). `run` attaches +z-facing car groups (use `buildCoasterCar` from CoasterCar) spaced by arc length, energy-paced (fast in valleys, slow over crests, constant crawl on the lift) — deterministic, driven only by the Stage clock.

### Inversions — the ROLL CHANNEL (`roll`), STEEL ONLY

Everything else here derives the frame from the points alone: parallel transport pins the frame up to ONE degree of freedom — the roll about the tangent — and curvature banking spends it leaning into turns. A full 360° rotation about the travel axis is therefore **not expressible by any set of control points**, because the path a barrel roll follows is a dead straight line. `roll` is that missing channel.

**RCT2 draws the same distinction.** `TrackElemType::leftBarrelRollUpToDown = 174` and its three siblings (`ride/ted/TrackElemType.h:192-195`) are described at `TrackData.cpp:8633` as `{ TrackGroup::barrelRoll, TrackPitch::none, TrackPitch::none, TrackRoll::upsideDown, TrackRoll::none, 0 }` with `pieceLength = 96` — a **straight, level, un-turned three-tile element whose only change is roll**, `none → upsideDown` and back. So a full roll is 6 tiles = **7.2 units** at this kit's 1.2 u/tile, and that is the channel's default `span`. (The tighter bound is RCT2's half `corkscrew`, `TED.Corkscrew.h:411`, `pieceLength = 55` ≈ 2.1 u per 180° — a corkscrew also turns 90° and climbs, so build one as this roll channel *plus* a rising, laterally-stepping point path.)

**API** — a list of ELEMENTS, `roll?: SplineRoll[]` where `SplineRoll = { atPoint?, at?, turns?, dir?, span? }`. `atPoint` is a *fractional control-point index* (the element's centre), so it moves with the layout and reads off the author's own points array; `at` is the same thing as a loop parameter u for callers that only have arc fractions. Rejected alternatives: a 4th component on the control points (would tie roll to point SPACING — a long straight has few points and could not roll — and would change the type of the exported `SPLINE_COASTER_LAYOUT`), and a raw `roll: (u) => number` callback (nothing could then check the closure rule, and it does not serialise).

**The closure rule is the load-bearing part.** `computeSplineFrames` interpolates its sampled frames CYCLICALLY (`i1 = (i0 + 1) % N`), so the roll profile must be periodic **mod 2π** or the frame tears at the seam. Each element ramps 0 → 2π·turns on a **smoothstep in arc length** (zero roll RATE at both ends) and then HOLDS, which reduces the requirement to: *the signed turns must sum to a whole number*. A non-integer total is **refused with a warning** rather than tearing the seam — the same reason RCT2 ships the barrel roll as a PAIR (`…DownToUp` + `…UpToDown`). Verified by deliberately disabling the guard: a lone half turn puts a **π discontinuity in one sample step** (probe-cork's seam-tear check, `max step 3.1416` vs `0.31` legitimate).

**It does NOT touch the loop-closure twist correction.** That correction reads the PURE transported ups, measures the residual twist and spreads it as `err·i/(N−1)`, all *before* banking. Roll is applied where banking is, and both are rotations about the same axis `T[i]`, so they commute and simply ADD to the frame's roll angle. Measured: with no roll spec the output is **bit-identical** (frames, every geometry, every mesh matrix and the lead car's matrix over a 1441-step animation schedule, on all three shipped layouts plus `wood: true`); with the roll on, `frameAt(1)` still meets `frameAt(0)` to **7.4e-11**.

**Roll and curvature bank are the same degree of freedom**, so a roll element belongs on straight, level track — exactly where RCT2's own element lives. Measured under the shipped one: **0.09° of pitch, 0.00° of auto-bank**.

**Steel only.** The wooden RTD's `enabledTrackGroups` (`ride/rtd/coaster/WoodenRollerCoaster.h:26`) lists `TrackGroup::verticalLoop` but neither `corkscrew` nor `barrelRoll`; the steel tables carry both (`TwisterRollerCoaster.h:27`, plus Corkscrew/Looping/Giga/Hyper/…). A wooden build DROPS the roll with a warning — the gate lives in `buildSplineCoaster` (which knows `type`), not in `computeSplineFrames` (the leaf, which knows nothing about coaster types; SplineRideKit owns the rule tables). Note `checkCoasterDesign` recomputes frames from POINTS when you do not pass `opts.frames`, and the roll is not in the points — **always pass the rolled `frames`** when you check a rolled layout, as the probe and the preview numbers do.

Probe: `harness/mp3d-render/probe-cork.mjs` (33 assertions; `--baseline` captures the regression fingerprint). Fixed-angle ortho elevations of the element, rolled vs unrolled A/B: `harness/mp3d-render/shot-roll.mjs` — the end-on slab view is the decisive one, the rails must sweep a true CIRCLE around the centreline (a skewed ellipse there means a non-orthonormal or left-handed basis).

### The chain lift — `buildLiftChain(t, frames, opts)`

The lift hill is the most obviously ENGINEERED part of a coaster, and it used to be ONE smooth `TubeGeometry` painted `metal: 0.6` — "a random black rail in the middle". Both halves of that were wrong: this Stage carries **no environment map**, so a PBR material past metalness ~0.5 has nothing to reflect (measured on an identical tube, same lighting: `0x3a3d42` at metalness 0.6 renders as RGB **(26,27,27)**, at 0.3 as **(34,35,35)** — the fleet's documented 0.2-0.35 band is +31% brighter), and the base colour `0x3a3d42` was itself near-black before shading. Now `0x50545a` at metalness 0.30 → **(47,48,49)**, **+81%** on the original.

`buildLiftChain` is **shared by every profile** (SplineRideKit's flume/rapids/bobsled lifts call the same function) and models: **roller chain** — alternating wide/narrow link plates and a roller at each joint, 0.10 pitch, over a plain core strand that survives the LOD drop; the **chain trough** the strand runs in (the slack RETURN run lives inside it, between the crossties — never visible at one-unit-per-tile, so the channel is what gets modelled); **side guide rollers** on vertical axles every 0.8; the **anti-rollback RATCHET RACK** — rail plus pawl teeth every 0.115, the thing that does the clanking; **sprockets** at both ends, recessed so their teeth crest exactly at the strand top; the **motor, gearbox, bed plate, fan cowl and drive shaft** at the top (drive) end; and a **maintenance catwalk** with toe board, mid rail and handrail on brackets off the track structure.

**THE ENVELOPE INVARIANT.** The driven strand keeps exactly the line and radius it had before (`sides`/`h`/`r` are the caller's own numbers) and **nothing added rises above that strand's own top, `h + r`** — so no profile's vehicle margin can move by construction. Measured by sweeping each profile's real vehicle over the real assembly in the frame cross-section (`harness/mp3d-render/probe-lift-clearance.mjs`, `OLD=1` for the before column), worst surface gap, OLD smooth tube → NEW assembly:

| profile | vehicle | OLD | NEW | what sets it |
|---|---|---|---|---|
| coaster | CoasterCar (wheelOffset 0.195) | 0.065 | **0.060** | chain top +0.055 vs the chassis at +0.115 on the centreline. The whole 0.005 delta is the old 6-sided tube not reaching its own nominal radius at the crown (0.866·r) — the nominal envelope is unchanged |
| flume | MiniLog (0.16) | 0.077 | **0.054** | the trough's inner plate reaches to \|x\| 0.257 vs the log hull at (0.212, +0.018) |
| bobsled | MiniSled (0.2) | 0.201 | **0.157** | the newly added ratchet rack, teeth crest −0.002 at x 0.15, sled floor +0.155 |
| rapids | raft (−0.075) | **−0.029** | **−0.035** | **PRE-EXISTING, not caused by this work**: the centreline belt (top −0.042) is inside the raft's tyre-tube bottom (−0.075) whenever the raft is not bobbing. RiverRapids' own +0.01..+0.035 bob is what clears it (tube bottom −0.065..−0.040). The belt line and radius are untouched; the 0.006 difference is the same tube-faceting artefact. |

No anti-rollback rack on flume/rapids — a water lift is a belt conveyor and has none, and the rack would foul the log's hull at \|x\| 0.15. Twin-strand lifts (flume, bobsled) put their guide rollers **outboard only** and drive **only the strand on the motor's side** — an inboard roller ate 0.023 off the log's margin and a cross shaft ran straight through the hull.

**Budget** (13-unit climb, measured): **8-9 draw calls and 7 100-14 400 triangles** per lift hill, against 1-2 draws / 936-1 872 tris before. Everything repeated goes through `mergedBoxes`/`mergedParts`, two batches carry all the small bright-steel parts, and the links, rollers, rack teeth and sprocket teeth are tagged `userData.lodDetail` so the park runtime drops them past NEAR. For scale, one coaster's two rail tubes are already ~10 000 triangles. Deterministic — no `Math.random`/`Date.now`; `detectLiftHill` and the `liftV` pacing are untouched (this is a purely visual change).

### Preview circuits

- **Loop Royale (LEAD)** — the demo circuit for SplineRideKit's new `loop`
  piece: a 2.9 chain lift, a level 180° apex hairpin, the full drop, and the
  **360° vertical loop** in the valley where the speed is, then a 1.9 lift to a
  second apex hairpin and home. Compiles with **zero synthesized closure**,
  design clean, `validateSpline` worst **1.08** (at the crossing under the
  loop), worst lateral **0.62 g**, **+5.04 g** at the loop's bottom and
  **+1.50 g** over the inverted crest. See SplineRideKit's Context for the
  piece's geometry and the honest limitations.
- **Barrel Roll** — the demo for the `roll` channel: a STADIUM (two parallel
  lanes, two LEVEL 180° hairpins of radius 2.8 at the ends — the apex trick, so
  every fast metre is dead straight), with a 26° chain lift to a 3.60 crest on
  one lane and drop → long level valley → climb on the other. The **360° barrel
  roll** sits at `atPoint: 41.5`, the middle of the valley, at the default 7.2-u
  span. Measured: track reaches **up.y = −1.0000** at u 0.7094 and passes through
  banked-90 at |up.y| **0.00038**; the channel adds **exactly −1.000000 turns**;
  `checkCoasterDesign('steel')` clean with ZERO violations on the ROLLED frames
  (`'wooden'` reports `inversion`); `validateSpline` worst **4.063**; worst
  lateral **0.734 g** against the 1.275 g derail gate; supports planted under the
  inverted section clear the rails by **0.147**. Through the whole 24 s cycle
  every car basis stays right-handed (det +1), car up == frame up to 1.000000,
  the wheel offset holds 0.195 to 0.000000, and at the apex the lead car hangs at
  y 0.505 with both riders at 0.285 under a centreline at 0.700. 75.8 u, 19.4 s a
  lap, E 4.83 / I 5.09 / N 1.71, one inversion.
- **3D rig — Vertical Plunge** — the rig on the steepest circuit the steel
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

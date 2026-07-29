# Park scoring rubric (1–100)

Score an arbitrary mp3d park from the 8 screenshots in `shots/<name>/` +
`probe.json` + `console.log`. **Sixteen weighted axes summing to 100**
(weights table below).

## Pipeline

```sh
node rct2-design-system/harness/park-eval/preflight.mjs <parkFile.tsx>                         # FAST import/cast/ratings lint — RUN THIS FIRST (milliseconds)
node rct2-design-system/harness/park-eval/typecheck.mjs <parkFile.tsx>                         # STATIC type gate — run SECOND (seconds)
node rct2-design-system/harness/park-eval/eval.mjs      <parkFile.tsx> [--name=X] [--wait=ms]  # 8 PNGs + console.log
node rct2-design-system/harness/park-eval/probe.mjs     <parkFile.tsx> [--name=X] [--wait=ms]  # probe.json (also stdout)
node rct2-design-system/harness/park-eval/score-park.mjs <park|probe.json> [--parkType=thrill] # THE 16-AXIS SCORE -> shots/<park>/score.json
node rct2-design-system/harness/park-eval/score-park.selftest.mjs                              # prove the scorer can FAIL (mutation suite)
node rct2-design-system/harness/park-eval/calibrate.mjs [--save] [--matrix]                    # axes 15 + 16 over the corpus
node rct2-design-system/harness/park-eval/check-weights.mjs                                    # assert the 16 weights sum to 100
node rct2-design-system/harness/park-eval/w7-check.mjs  <parkFile.tsx> …                       # verdict + lints only, no screenshots
```

**Step -1 — PRE-FLIGHT LINT THE PARK (wave-10), before you even type-check.**
A round was lost when a generated park imported `BrassworkFoundry`,
`PulseDistrict` and `ThornwickGlade` — three of the five prefab "land macro"
components deleted in v6.0. esbuild refused the whole bundle: 0 screenshots,
no `probe.json`, no `validatePark` line — the round scored 0/100 by ABSENCE OF
EVIDENCE, and the raw esbuild dump took a human-visible chunk of time to
diagnose. `preflight.mjs` resolves every local component import (park file +
any sibling plan module) against the components that ACTUALLY EXIST under
`mp3d/components/` **on disk, right now** — never a hard-coded list — and
fails fast with a one-line-per-problem report naming the missing component,
the importing line, and a remedy (the five deleted lands get a specific one:
build the world from a themed set-piece plan + that world's own rides/stalls
+ its surviving `*Scenery` pack, rules §3.1). It also flags two other cheap
defects that separately cost rounds: a `<Coaster>`/`<TrackRide>` `pieces` prop
smuggled through `as unknown as string[]` (pieces is `TrackPiece[]`; plain
`as any` is NOT flagged — several clean reference parks use it harmlessly),
and an authored `ratings={{ ... }}` with no `rateCoaster(` call anywhere in
the file (transcribed-from-the-rulebook numbers presented as measured).
`eval.mjs` and `probe.mjs` both run this BEFORE bundling and refuse to launch
esbuild/a browser on failure, printing the lint instead of a raw esbuild
dump; `typecheck.mjs` runs it per-file before `tsc` for the same reason.
Standalone: `node preflight.mjs <parkFile.tsx>` (exit 0 clean, 1 = problems).

**Step 0 — TYPE-CHECK THE PARK (wave-9).** esbuild strips types without
checking them, so a park can ship a whole broken data structure and render
"fine": round 8 declared `TREE_SPOTS: Array<{ position, shape }>` and filled it
with 48 TUPLES, giving every tree `position: undefined`. `typecheck.mjs` runs
`tsc --noEmit` over the park + its plan module and reports only diagnostics in
the park's OWN files. **Type errors are DEFECTS — score them as such** (they
belong to the axis whose data they corrupt: planting, layout, roster …), and
they are worth catching before a browser run that costs minutes.

**FOUR harness truths a scorer must know before blaming a park.**
1. A missing `[Park] validatePark → …` line means the run never reached the
   settle effect. `<Park>` always emits that line otherwise (wave-9), including
   when there is no GameManager to validate.
2. Headless chromium's frame scheduler can stall COMPLETELY on this machine
   (measured: `rafTicks: 0` over 2 s with a healthy WebGL2 context). Everything
   in the design system is rAF-driven, so the park mounts, prints its build
   lints and never validates — indistinguishable from a broken park. Both page
   openers now install a `setTimeout` frame backstop (`FRAME_SHIM`,
   `lib.mjs` / `evaltags.mjs`); if you see a park with 0 draws and no verdict,
   suspect the browser first.
3. **`Page.captureScreenshot` CAN TIME OUT AND PRODUCE ZERO PNGs, AND IT IS NOT
   ABOUT COMPETING CHROMIUM RUNS** (corrected wave-18 — the old note here blamed
   two overlapping runs; round 14 hit it TWICE on an otherwise idle machine).
   The real trigger is **any park at size ≥ 128 with ~130+ ACTIVE LIGHTS**: the
   scene renders at well under 1 fps under SwiftShader and the capture exceeds
   puppeteer's default `protocolTimeout`. A run that dies this way looks exactly
   like a broken park — no shots, a ProtocolError, nothing to score.
   `eval.mjs` now (a) captures through a CDP session with a 15-minute
   per-command timeout, (b) falls back to `page.screenshot`, and (c)
   auto-retries the MISSING poses through `shot-fallback.mjs --scale=0.5`
   (`protocolTimeout: 1800000`), which captured all nine poses in 80 s when it
   was run by hand. **A park's `[Park] perf:` line reports `N active lights` —
   read it before blaming the park for a failed run.**
4. **A DARK SHOT 01–06b IS *NOT* THE DAY/NIGHT CLOCK. CHECK `day-shot nightK`
   FIRST** (added wave-18). `eval.mjs` now logs `[eval] day-shot nightK=…`
   BEFORE the first shot as well as after the night click, precisely so this is
   decidable from `console.log`. **MEASURED on round 14's park B: `day-shot
   nightK = 0` — the day/night button still shows the SUN in shot 01, the SKY is
   full daylight blue and the TerrainKit backdrop skirt is fully lit — and the
   park's own terrain plate is BLACK.** `nightK` cannot do that (it darkens the
   sky and the backdrop too). So a black plate under a bright sky is a
   LIGHTING/RENDER defect in the scene, not a clock artefact — that park carried
   **157 active lights** at **0.5 fps**. Score it as a render defect, and see
   truth 3.
   The clock has its own, separate defect: at 0.5 fps the night lerp needs ~49
   RENDERED FRAMES (≈ 98 s) to reach 0.95, so the old fixed 18-second poll
   captured shot 07 at **nightK 0.773** — a dusk shot filed as the night shot.
   The poll budget is now DERIVED from the measured frame interval (capped at
   180 s) and a short capture is reported as `WARNING: … this is DUSK, not
   night`. `--nightK=<0..1>` pins the target; `--nightK=off` skips the switcher
   entirely and shoots 07 in daylight, which is what you want when diagnosing a
   dark park.

Required import shape for park files: design-system imports must name the
component folder — any of `'./components/Park'`, `'../components/Torch'`,
`'components/Kit'`, `'@mp3d/components/ParkBuilder'`, or bare `'../FerrisWheel'`
(the preprocessor rewrites all of these to the local repo). `react`/`three`
stay bare. The park component must be the **default export** or an exported
uppercase function (one matching `/park/i` wins).

Shots (EIGHT, not seven — `05b` and `06b` were added 2026-07 and this line
still said seven): `01–04` overviews at azimuth 45/135/225/315 (34° elev),
`05` top-down (81°, whole plot, fog lifted), **`05b` nadir** (elevation 89 /
azimuth 0, so world +x is screen RIGHT and +z screen DOWN — the shot to check
COMPOSED COORDINATES against), `06` ground level (8°), **`06b` ground-close**
(radius ~22 u, elevation 4 — the only shot that judges ground MATERIALS rather
than the middle distance), `07` night at the main angle.

Probe heuristics (best-effort; injected at bundle time, repo untouched):
rides = `userData.rideRef`/`evalRide` groups; stalls = `ConfigurableStall`
tags; trees = Kit `tree()`; scenery = SceneryPack pieces + a `composables`
tally; water = tagged `buildWater`/`buildWaterRibbon` meshes plus the terrain
sheet's flood-filled wet area; gate/restrooms = tagged wrappers.
New in **v4**:

* `rides[].kind` / `rideRoster` — the catalog COMPONENT kind behind every
  registered ride (`evalRideKind` from the `composableRide` factory, the
  chassis `layout.defaults.name`, or `<Coaster>`/`<TrackRide>`), joined to the
  live catalog enumeration in `catalog.mjs`.
* `stalls[].kind` / `stallRoster` — stall kind, catalog default name, and
  whether the shipped name is THEMED (≠ the catalog default).
* `setPieces[]` — every `setPiece()` macro piece by plan kind
  (FountainPlaza / Bazaar / Boulevard).
* `rideSpacing.obb` — the validator's own oriented-box registries
  (`footprints()` + `blockers()`), which supersede the old AABB gaps.
* `layoutRaw` + `layout` — the layout-uniqueness metrics (axis 15), computed
  by `layout.mjs` from the raw street net so the axis can be recalibrated
  offline with `calibrate.mjs`.
* `signatures/<name>.json` — the cross-park corpus behind the two novelty
  points (axes 13 and 15).

New in **v5** (WORLDS):

* `worlds` — the whole of axis 16, lifted verbatim off the design system's own
  settle-time audit (`ParkBuilder/worlds.ts: auditWorldThemes`, on the store as
  `_worldAudit`). `declared` / `presets` / `presetCount` / `unusedPresets` (which
  preset worlds the park contains), `worlds[]` (per-world `themeId`, bounds,
  `rideCount`/`rideKinds`/`stallCount`/`sceneryCount`/`setPieceCount` and the
  `built` verdict), `crossTheme[]` (every themed piece inside a foreign world,
  with its coordinates), `unplacedThemed[]`, `separation` (world-centre pairs +
  the size-derived floor) and `score` (`score-worlds.mjs`'s output).
* `themedPieces[]` inside `worlds` — every tagged component that HAS a theme,
  with the world it stands in. Neutral pieces are counted (`neutralCount`), not
  listed: they are legal everywhere by design.
* The design system now stamps its OWN component tags (`userData.dsComponent` /
  `dsClass` / `dsWorldTheme`, written by `composable`/`composableRide`/
  `composableStall`/`setPiece` — see `Park/composable.tsx: tagComponent`), so
  the world audit works in a plain build and not only under `evaltags.mjs`.

Parks not composed via `<Park>` degrade to raw scene stats (see `notes`).

## Weights table — 16 axes, total 100

| #  | Axis                          | Weight |
|----|-------------------------------|-------:|
| 1  | Cleanliness                   | 5      |
| 2  | Good use of paths             | 8      |
| 3  | Ride spacing                  | 8      |
| 4  | Entrance/exit usage           | 7      |
| 5  | Food stalls                   | 4      |
| 6  | Park entrance                 | 4      |
| 7  | Terrain normality             | **9**  |
| 8  | Water usage                   | 6      |
| 9  | Scenery decoration            | 5      |
| 10 | Trees / natural mountains     | 4      |
| 11 | Creativity                    | 3      |
| 12 | Accessibility                 | **10** |
| 13 | Ride roster                   | 7      |
| 14 | Thrill                        | 8      |
| 15 | Layout uniqueness             | 7      |
| 16 | Worlds                        | 5      |
|    | **Total**                     | **100**|

Arithmetic: 5+8+8+7+4+4+9+6+5+4 = **60**; 3+10+7+8+7 = **35**; 60 + 35 + 5
= **100**. ✓ (`node check-weights.mjs` asserts it.)

Cleanliness (8→5), Food stalls (5→4), Park entrance (5→4), Trees (5→4) and the
old Ride count (7) were trimmed because every park in the campaign already
maxed them — they no longer discriminate. The freed weight went to the two
discriminating axes **Ride roster** (which measures WHAT was picked, not how
many) and **Layout uniqueness**.

**Where axis 16's 5 points came from — and where they did NOT.** Worlds are now
the organising principle of a park (`rules/park-generation-composition.md` §3
composes worlds FIRST, then connects them), so they get a real axis rather than
a footnote inside Creativity. All 5 points come out of **Creativity, 8 → 3**,
and that is a genuine de-duplication: Creativity's three thirds were themed
ride NAMES, scenery VARIETY and *"cohesive per-zone theming in shots 01–05"* —
the third one is exactly what axis 16 now measures mechanically, and it was
always the third a scorer had to eyeball. Creativity keeps naming + scenery
flavour.

*Layout uniqueness was NOT trimmed, deliberately, against the first
instinct.* Its 1-pt "districts separated" test looked like the same
measurement, so it was checked: axis 15 clusters **registered ride positions**
at `districtClusterCut` and is theme-blind, while axis 16 measures **declared
world regions** and their build-out. The two come apart in both directions — 3
worlds packed 12 u apart pass axis 15's ride clustering and fail axis 16's
separation; one sprawling world with three ride clusters does the reverse — so
they are weakly correlated, not redundant. Moving the point would also have
invalidated axis 15's published sub-scores, its executable scorer
(`score-layout.mjs`) and its corpus calibration table below, for no analytical
gain. Both axes therefore keep their own separation test, measured over
different objects.

Score each axis 0..weight (halves fine); charge each `validatePark FAIL` 2–5
pts against its matching axis ONCE (don't double-charge a corridor fail on
both spacing and accessibility, a coaster fail on both spacing and thrill, or a
`crossTheme` warning on both Worlds and Creativity — coherence is axis 16's).

## The 16 axes

1. **Cleanliness (5)** — `probe.sim`: `litterCount`/`poopCount`/`vomitCount`
   after the sim smoke run (0 of each = clean), `paths.bins ≥ 1`,
   `restrooms ≥ 1`, `avgHappiness` (~150+ is happy). Full = zero litter, bins
   + restroom present; −1.5/axis item missing, −1 per few litter pieces.
2. **Good use of paths (8)** — shot 05 (top-down) is the primary read: a
   coherent skeleton (loop/ring, no dead stubs, no orphan islands), plus
   `probe.paths` (edges ≥ nodes−1, cycles good; plazas ≥ 1). Grid-lint
   warnings deduct. This axis is path QUALITY; pure reachability is axis 12
   and DISTINCTIVENESS is axis 15.

   **`extentFractionOfPark` is a FLOOR, not a band (fixed 2026-07-26 — was
   contradicting axis 15).** This line used to read "~0.2–0.6 healthy",
   which put a CEILING on the same measurement axis 15's plot-utilisation
   term rewards with a FLOOR only (`pathExtentFraction/0.55`, capped at 1 —
   no penalty for going higher). A verified skeleton (`samples/skeleton-b.tsx`,
   `validatePark → ok: true`, 0 failures, 0 orphan islands, axis 15 = 7.0/7)
   measures **0.81**, so the old text scored it down here for the exact
   property axis 15 was giving it full marks for — no park could satisfy
   both, which silently capped every park's reachable total.

   Re-measured across the corpus (`shots/*/probe.json`, 2026-07-26) to find
   out which end of the range huddling actually lives at:

   | park | extentFractionOfPark | gridRegularity | orphanIslands | note |
   |---|---:|---:|---:|---|
   | seedcheck-s1-192 | 0.09 | 0.596 | 0 | huddled (size 192, plotUtilisation 0.28) |
   | briarwood | 0.10 | – | – | low end |
   | setpiece-ref | 0.20 | 0.697 | 0 | low end, still a clean reference |
   | demo-ref | 0.22 | 0.737 | 0 | low end (size 16) |
   | voltmoor | 0.23 | – | – | low end |
   | worlds-ref | 0.26 | 0.635 | 0 | low end |
   | coolpark / -a / -b | 0.33–0.40 | – | – | mid |
   | stormhollow | 0.43 | – | – | mid |
   | hollowmere2 | 0.52 | 0.555 | 0 | high, clean |
   | arch-ref / -legacy | 0.54 | 0.655 | 0 | high, clean |
   | district-ref | 0.55 | 0.576 | 0 | high, clean, best real-park axis-15 score (6.75) |
   | r13a | 0.59 | 0.514 | 1 | high, low grid — orphan is a SEPARATE defect |
   | r12a | 0.60 | 0.526 | 2 | high, low grid — orphans are a SEPARATE defect |
   | r13b | 0.61 | 0.506 | 0 | high, clean, low grid |
   | cinder-peak | 0.66 | 0.774 | 2 | high AND a lattice AND 40 validatePark failures — fails on those, not on extent |
   | skeleton-b | 0.81 | 0.512 | 0 | highest measured, clean, lowest grid — the verified skeleton above |

   There is no point in this corpus where a HIGH extent correlates with a
   worse park by itself: the parks above the old 0.6 ceiling that are bad
   (`cinder-peak`) are bad for orphan islands, a lattice-shaped net and gate
   failures — defects this axis and axis 15 already charge — while the
   parks above 0.6 that are clean (`r13b`, `skeleton-b`) have the LOWEST
   `gridRegularity` in the table, i.e. the least lattice-like, most
   distinctive nets. Huddling shows up at the LOW end instead
   (`seedcheck-s1-192` at 0.09, `briarwood` at 0.10) alongside a low
   `plotUtilisation`. **Resolution: this axis now scores
   `extentFractionOfPark` as a FLOOR ONLY, matching axis 15's own formula —
   ≥ 0.2 healthy, < 0.15 is the huddling failure this axis punishes (network
   clustered near the gate), and there is NO upper penalty for using the
   whole plot.** A park that reads as one coherent skeleton in shot 05 is not
   marked down here for its extent, however large; a sprawled-looking but
   DISCONNECTED net is still caught by "no dead stubs / no orphan islands"
   above, which is a structural test, not an extent one. See axis 15's
   "plot actually used" test below for the matching floor-only formula and
   the corpus evidence this shares.
3. **Ride spacing (8)** — **read `probe.rideSpacing.obb`, not the AABB gaps.**

   | source | field | how to read it |
   |--------|-------|----------------|
   | authoritative | `rideSpacing.obb.overlappingPairs` | oriented-box SAT over the manager's own `footprints()` + `blockers()` rect registries — the SAME test `validatePark`'s footprint sweep runs. Each overlapping pair −3. |
   | authoritative | `rideSpacing.obb.minGap` | ≥ ~1.5 u comfortable, ≥ 3 generous. |
   | gate | `consoleSummary.footprintFails` / `corridorFails` | −1 each, cap the axis at 0. |
   | advisory | `rideSpacing.minGap` / `touchingPairs` | AABB gaps with CONTAINMENT exempted. |
   | advisory | `rideSpacing.rawMinGap` / `rawTouchingPairs` / `aabbContainedPairs` | the uncorrected numbers. |

   **AABB containment is NOT overlap.** A ring-shaped coaster's axis-aligned
   bounding box encloses its own infield, so any flat ride standing legitimately
   INSIDE the ring used to report `gapXZ: 0` and lose 3 points for a collision
   that does not exist. Pairs where one box lies wholly inside the other are
   listed in `aabbContainedPairs` and excluded from the corrected
   `touchingPairs`; never charge them. Only charge a touch when the OBB pass or
   a validator FAIL confirms it. (Caveat: the OBB registries cover ride pads,
   huts, queue lanes and registered ride BODIES — a coaster's flying TRACK is
   policed by the corridor sweep, so `corridorFails` still matters.)
4. **Entrance/exit usage (7)** — **REWRITTEN 2026-07-25: this axis predated the
   EXIT LANE and could not tell a connected exit from a stranded one.** It used
   to read only `queueNode ≠ -1` and `exitNode ≠ -1`, and `exitNode ≠ -1` is
   satisfied by an exit spur that attached to an ORPHAN component of the path
   graph — a ride a guest can board and never leave. The manager now publishes
   the whole RCT2 pair on `accessPoints().rides[]` and the probe passes it
   through verbatim in `probe.entrance.rideAccessNodes`
   (`entranceAt`/`entranceDir`/`exitAt`/`exitDir`/`exitLaneLen`/`exitLaneEnd`),
   with reachability in `probe.accessibility.perRideReachable[]`
   (`queueReachable` / `exitReachable`). Score per registered ride, out of 7
   pro-rated across the roster:

   | pts | test | field |
   |----:|------|-------|
   | 2 | **queue attached** — a queue tail on the graph, routable from the gate | `queueNode ≥ 0` AND `perRideReachable[].queueReachable`. −2 per ride that fails. |
   | 2 | **EXIT LANE EXISTS** — the exit hut has paving on its outward ray | `exitLaneLen > 0`. `exitLaneLen === 0` is RCT2's `STR_EXIT_NOT_CONNECTED` and is already a hard `accessibility` FAIL in the gate (validate.ts check a4) — charge it here ONCE, −2 per ride, and do not also charge axis 12. |
   | 2 | **EXIT NOT STRANDED** — that lane reaches the rest of the park | `exitNode ≥ 0` AND `perRideReachable[].exitReachable`. An exit spur on an orphan component reads `exitNode ≥ 0` and used to score FULL marks here; it is worth −2 per ride. |
   | 1 | **guests actually use them** | `sim.queued` / `sim.riding` > 0, or `sim.rides[].state` off `movingToEndOfStation`. **This is a SNAPSHOT** — the probe samples the sim once, and a healthy 128 park with a happiness-gated arrival stream routinely reads `queued: 0, riding: 0` at that instant (measured: `worlds-ref` and `seedcheck-s1-192` both do, with 66 / 36 active guests and avgHappiness 233+). Do not charge this point unless `activeGuests` is also 0. |

   `exitNotAdjacent` (entrance and exit not one tile apart on the same station
   face) is a validatePark **WARNING**, not a failure — RCT2 keeps the two
   `TileCoordsXYZD` independent and never compares them. Note it, −0.5, do not
   fail the axis for it.

   Measured on the seven reference parks (2026-07-25): every registered ride on
   every one has `exitLaneLen` in **1.93–9.37 u** with `exitReachable: true` and
   `orphanIslands: 0`, so the axis currently pays all of them — it discriminates
   only against a park that gets the exit wrong, which is the intent.
5. **Food stalls (4)** — no longer a head-count; it is VARIETY and NAMING.
   Read `probe.stallRoster`.

   | pts | test | field |
   |----:|------|-------|
   | 1 | at least 2 registered stalls | `stallRoster.registeredCount ≥ 2` (0 stalls = 0 for the whole axis) |
   | 1.5 | ≥ 3 DISTINCT catalog stall kinds, spanning food AND drink | `stallRoster.distinctKinds ≥ 3` and `stalls[].item` covers both `food` and `drink`. 0.75 for 2 kinds. `balloon` and `wearable` stalls are a BONUS, not a substitute for the drink. |
   | 1 | every stall is THEMED, not shipping its catalog default name | `stallRoster.allThemed` (`themedNameCount / registeredCount`). Pro-rate; `defaultNamed` lists the offenders (e.g. a stall still called "Burger Bar"). |
   | 0.5 | placed on traffic (plaza/junction/midway), visible in shot 05 | `stalls[].at` against `layout.openSpace.spaces` + the net |

   **The catalog ships 10 stall kinds (`stallRoster.catalogSize`), not 5** —
   re-counted 2026-07-25 against `node usage.mjs`; this line said 5 and named
   only the original five, which is what the catalog looked like before the
   world build:

   | kind | item | catalog default name |
   |---|---|---|
   | BurgerShop | food | Burger Bar |
   | HotDogStand | food | Hot Dogs |
   | CottonCandyStand | food | Cotton Candy |
   | SodaStand | drink | Soda Stand |
   | BalloonStand | balloon | Balloon Stand |
   | EmberRoast (emberfall) | food | Ember Roast |
   | SushiStall (tidewater) | food | Dockside Sushi |
   | Honeywitch (thornwick) | food | The Honeywitch |
   | NeonSlush (pulse) | drink | Neon Slush |
   | GoggleWorks (brasswork) | wearable | The Goggle Works |

   `stallRoster.corpusKindFrequency` / `catalogNeverUsed` show which of them the
   campaign has never once reached for. **NO LIST IS FROZEN HERE — run
   `node usage.mjs --never`.** (The old text named `EmberRoast` and `SushiStall`
   as never-reached and both have since shipped; see "NO FROZEN USAGE LISTS"
   under axis 13.)
6. **Park entrance (4)** — `probe.entrance`: `gateMeshes ≥ 1` and
   `attachedToPathNode: true`; gate on the park edge with a path leading in.
   No gate = 0; unattached gate ≤ 1.5.
7. **Terrain normality (9)** — `probe.terrain`: `lint` empty, no spikes, no
   floating/buried structures. **THE HEIGHT BANDS ARE SIZE-DEPENDENT and were
   re-measured at 128 (2026-07, RE-VERIFIED 2026-07-25 — every figure below
   reproduced exactly).** The old "`minH`/`maxH` roughly −3..+3, `stdH` 0.3–1.0,
   > 1.5 chaotic" figures were fitted to a size-16 park and would mark down
   every park on the current default plot for the relief the composition now
   deliberately draws.
   - **size 16–48**: the old band stands — `minH`/`maxH` ≈ −3..+3, `stdH`
     0.3–1.0. Nothing about the ≤48 landform changed. (Measured on the reference
     parks: demo-ref 0.33, district-ref 0.38, arch-ref 0.51, arch-ref-legacy
     0.61, setpiece-ref 0.70 — all inside it.)
   - **size ≥ 64**: measured over the 16 published §1 rows at 128
     (`node harness/park-eval/seed-table.mjs --size=128 --json`): total
     **relief 8.15–16.6 u** (p50 10.495), **`stdH` 0.76–1.45** (p50 1.13),
     summits to **h 12.2** (`maxPeakH`, range 3.1–12.2). So on a 128 plot
     **`stdH` 0.75–1.5 is NORMAL** (the band said 0.8 and the pinned §1 row
     seed 91/desert measures 0.76 — the published band excluded one of its own
     rows; widened 2026-07-25), `stdH` < 0.5 is the DEAD-FLAT failure this axis
     should be punishing, and > 2.0 is chaotic. Judge `maxH` against the
     composition's own `terrain.peaks`, not against ±3. Over the wider 24-seed ×
     4-climate sweep the same statistic runs 0.67–2.19 (p50 1.135), so a park
     just outside 0.75–1.5 is unusual, not wrong.

     **THE 0.75 FLOOR STANDS — IT WAS RE-DERIVED FROM THE COMPOSER, AND OUR OWN
     PARKS GENUINELY LOSE THE POINT (2026-07-26).** Three campaign parks read
     `stdH` **0.73 / 0.71 / 0.73** (`skeleton-a` / `skeleton-b` / `r15a`), all
     within 0.04 of the floor, and the standing proposal was to move the floor
     to **0.67** — the sweep minimum — which would have handed all three the
     full 3 pts. **That proposal is REFUSED. Lowering a bar because our parks
     keep missing it is grade inflation, and the terrain data says the parks are
     what is wrong.** Re-measured over a fresh 24-seed × 4-climate × 3-size
     sweep of the real composer (`parkComposition` + `buildTerrain` + the design
     system's own `measurePlotRelief`, n = 288, 0 errors):

     | size | n | min | p5 | p25 | **p50** | p75 | p95 | max |
     |--:|--:|--:|--:|--:|--:|--:|--:|--:|
     | **128** | 96 | 0.67 | 0.83 | 0.99 | **1.135** | 1.29 | 1.71 | 2.19 |
     | **192** | 96 | 0.73 | 0.78 | 0.99 | **1.12** | 1.22 | 1.68 | **2.31** |
     | **64** | 96 | 0.58 | 0.62 | 0.73 | **0.845** | 0.97 | 1.16 | 1.38 |

     per climate at 128 — and note the answer is two-sided: **desert is the
     gentlest by MEDIAN but has the HIGHEST floor** (the narrowest envelope of
     the four), while the genuinely flattest individual plots are coastal and
     temperate:

     | climate @128 | min | p50 | max |
     |---|--:|--:|--:|
     | temperate | 0.71 | 1.19 | 2.12 |
     | desert | **0.76** | **1.02** | 1.21 |
     | alpine | 0.88 | 1.36 | 2.19 |
     | coastal | **0.67** | 1.14 | 1.52 |

     `stdH` tracks the **landform ARCHETYPE** better than the climate:
     `plains` 0.67–1.26 (p50 0.93) · `steppe` 0.86–1.42 · `hollows` 0.78–1.72 ·
     `downs` 0.71–1.29 · `badlands` 1.00–1.45 · `ridges` **1.05–2.19**.

     **What 0.75 actually excludes at 128/192: 3 of 96 compositions (3%).** It
     sits just under p5 (0.83), so it is well-calibrated against the composer.
     **0.67 is real and reproducible — seed 91 / coastal, the `plains`
     archetype at amplitude 0.93, composing clean with 0 violations and 0 clamp
     discs — and it is exactly what "the land is naturally gentle here" looks
     like.** Seeds 91 and 2 are the flat seeds at every size and climate.

     **AND THAT IS WHY IT MUST NOT BE THE FLOOR: our three parks are FLATTENED,
     not gentle.** All three pin `seed=1 climate="temperate" size=128`, a
     MID-distribution row (7th of the 16 by `stdH`) for which the composer draws
     **`stdH` 1.09 / relief 12.13**. Their own `probe.json`
     `validation.warnings[terrainFlattened]` blocks record what they BUILT:

     | park | probe `stdH` | built `stdH` (48-grid) | built relief | composer draws | `keptStdH` | `keptRelief` |
     |---|--:|--:|--:|--:|--:|--:|
     | skeleton-a | 0.73 | 0.74 | 8.31 | **1.09 / 12.13** | **74%** | 79% |
     | skeleton-b | 0.71 | 0.72 | 8.31 | **1.09 / 12.13** | **73%** | 79% |
     | r15a | 0.73 | 0.75 | 8.31 | **1.09 / 12.13** | **74%** | 79% |

     Each threw away about a quarter of the relief its own seed drew, and the
     gate names the culprits identically in all three: the range at
     **(5.3, −42.9) cut from h 8.59 → 0.83** and **(−5.8, −43.6) cut 5.93 →
     1.50**, by guard cells planted at z ≈ −43 right on top of the seed's two
     biggest ranges. They clear the design system's own 70% self-inflicted floor
     (`RELIEF_FLOOR_FRAC`) and so only WARN — but they land under the published
     band, and the band is right. **VERDICT: 0.75 stands at 128/192, the three
     parks genuinely lose 1.5 pts each, and the fix is to move the guard cells
     off the summits — not to move the floor.**

     Three corrections that fall out of the same sweep:

     * **"> 2.19 has no precedent" was a 128-ONLY figure and is now retired.**
       At 192 the composer reaches **2.31** (seed 53 / alpine). Read the
       no-precedent ceiling as **> 2.19 at 128, > 2.31 at 192**.
     * **THE "size ≥ 64" GROUPING IS WRONG AT 64 ITSELF, and this is a KNOWN
       OPEN DEFECT rather than something this revision changes.** At size 64 the
       composer's own median is **0.845** and **30 of 96 compositions (31%) fall
       below 0.75** (min 0.58) — a 64 park scored against a 0.75 floor is being
       punished for the composer's behaviour, not for flattening. The floor at
       64 should be near **0.58–0.60**. It is left unchanged here **only**
       because every calibration park is at 128 and loosening a threshold is a
       separate decision that needs its own evidence review; **do not quote
       axis 7 for a `size={64}` park without reading this paragraph.**
     * **`probe.terrain.stdH` and this band are measured on DIFFERENT GRIDS.**
       The band comes from `measurePlotRelief`'s fixed **48×48 lattice of cell
       CENTRES** (`RELIEF_GRID`, deliberately size-independent, and the same
       function backing `validatePark`'s `terrainFlattened` gate); `probe.mjs`
       samples a **65×65 lattice of CORNERS**. Measured over all 288
       compositions the probe reads consistently LOWER: mean |Δ| **0.012**, max
       **0.050**. So a `probe.json` 0.73 is ≈ 0.74–0.75 on the band's own grid —
       which is why the three parks above sit exactly on the boundary. Do not
       resolve a park to better than ±0.05 on this statistic.
     * **`stdH` ALONE CANNOT SEPARATE "flattened" from "gentle seed", and no
       floor can.** The populations overlap: skeleton-a's *flattened* 0.74 sits
       ABOVE seed 91 coastal's *honest* 0.67. The statistic that does separate
       them is per-seed and already published —
       `report.reliefFloor.keptStdH` / `kept` against `RELIEF_FLOOR_FRAC = 0.70`,
       which `validate.ts` already models correctly (warn on either, fail on the
       conjunction of below-floor AND below-band). **RECOMMENDED NEXT CHANGE
       (not applied here): score the KEPT RATIO and demote absolute `stdH` to a
       band.** That would make this axis measure the defect instead of a proxy,
       and it would tighten the axis rather than loosen it — the three parks
       above sit at 73–74% against a 70% floor.
   - **`maxSlope` IS NOW MEASURED ON A FIXED 0.6-u PITCH, and the old "under ~3"
     figure was meaningless (fixed 2026-07-25).** The probe used to difference
     heights on its own `S/64` statistics grid, so the stencil was 0.25 u at
     size 16, 0.75 at 48, **2.0 at 128 and 3.0 at 192** — a big plot averaged
     its own mountain flanks flat and a small one resolved every step.
     `demo-ref` (16, mild terrain) read **3.10** while `seedcheck-s1-192` (192,
     far stronger relief) read **0.95**, i.e. the number ran BACKWARDS against
     the thing it claims to measure. `probe.terrain.maxSlope` is now sampled at
     a fixed 0.6 u (the half lattice cell a pad or path slab actually stands
     on) and `probe.terrain.slopePitch` publishes it; the old size-relative
     number is kept as `maxSlopeCoarse` so older `probe.json`s stay readable.
     **New band, measured across the reference corpus at the fixed pitch:
     ≤ 3 flat-to-normal, 3–6 strong relief (expected on ≥ 64 with the current
     mountains), > 8 suspect a spike — and read it together with
     `terrain.lint.slopeAt`/`flatEnough`, which are what actually police the
     PADS.** A high whole-plot `maxSlope` with an empty `lint` is a mountain,
     not a defect.
   - what has NOT moved: the **entrance apron** (|h| ≤ 0.18 measured, against a
     0.45 composition / 0.5 gate budget) and the **buildable core** — 86–98% of
     the plot is still slope-flat on 13 of the 16 rows. A park whose PADS sit on
     slopes is still failing; a park whose HORIZON is flat is failing too.
8. **Water usage (6)** — `probe.water.terrainWater`. **TWO BODIES since
   2026-07, on every plot ≥ 64** (`waterBodyTarget(size)`; a park pinning
   ≤ 48 still wants exactly ONE and scores by the old rule). The composition
   composes a DOMINANT body plus a SECONDARY one — lake + river inlet, lake +
   tarn — and the anti-scatter intent is unchanged: a handful of ponds is still
   the failure this axis punishes, it is just no longer the case that a second
   body IS scatter.
   - `bodyCount` **exactly 2** = full marks on the count. **1 = ≤ 3 pts** (the
     park either built its terrain from a hand-written basin list instead of
     `comp.basins`, or a guard clamp filled the secondary body dry — either way
     three quarters of the map has no water story). **3+ = ≤ 2 pts**: scatter.
   - **THE GATE IS AUTHORITATIVE ON THE COUNT, NOT THE PROBE (2026-07-25).**
     `validatePark`'s terrain check floods the same field on the design
     system's own `waterGridStep(S)` grid (1.0 u at 128) and FAILS anything but
     `waterBodyTarget(size)`; the probe floods a 96² grid, whose CELL is 1.78 u²
     at 128 and 4.0 u² at 192. The probe's minimum-body filter was a flat
     0.5 u² fitted when the default plot was 16 (cell 0.028 u²), so a
     SINGLE-CELL speck counted as a whole water body: `worlds-ref` reported
     `bodyCount: 3` with areas `[261.3, 112.0, 1.78]` — a clean two-body park
     one probe cell away from losing 4 points — while `validatePark` passed it.
     The filter is now `max(0.5, 2 · cellArea)` (a body must be resolvable by
     the grid measuring it) and the probe publishes `bodyCountRaw`,
     `gridCellArea` and `minBodyArea` beside it. **If `bodyCount` and a clean
     `validatePark → ok: true` disagree, believe the gate and note the
     quantisation.**
   - the SECONDARY body must be a BODY, not a puddle: area ≥ **16%** of the
     dominant one (`SECOND_WATER_MIN_FRAC`), and ≥ **`max(5, 0.055·size)` u**
     of dry ground between the two waterlines (7.04 u on the 128 default) — two
     lobes joined by an isthmus are one lake. Either miss = −2. Measured over
     the 96-row sweep at 128: `secondFrac` p5/p50/p95 **0.17 / 0.32 / 0.87**
     (one row of 96, seed 13 coastal, comes in at 0.04 and is the sweep's only
     unclean row), gap **9.4–97 u** against the 7.04 u rule — so a rule-following
     park clears both comfortably and the test bites only on real pond-scatter.
   - `fractionOfPark` is now the TOTAL over both bodies, and the bands are
     re-measured at 128 with two bodies over the 24-seed × 4-climate sweep
     (min–max / p5–p95 / median) — **RE-MEASURED 2026-07-25, every figure
     reproduced exactly, and all 96 rows compose exactly 2 bodies**:
     **temperate 3.1–24.3 / 3.9–21.8 / 11.1%**,
     **desert 1.4–8.1 / 2.4–7.6 / 5.7%**, **alpine 1.4–10.8 / 2.3–10.4 / 5.6%**,
     **coastal 5.9–24.8 / 7.3–24.3 / 14.0%**. Score against the park's OWN
     climate band, not one global figure: a coastal park at 22% is normal and a
     desert park at 22% is not. −1 per ~0.05 outside the climate's p5–p95.
     `probe.terrain.climate` names the band to use (published 2026-07-25 — the
     probe used to make you guess).
   - **THOSE BANDS ARE COMPOSITION FIGURES; `<Terrain keepDry>` SHRINKS THE
     BUILT WATER.** The sweep measures the terrain the composer draws; the probe
     measures the terrain the park BUILT, after every `keepDry` cell has been
     lifted out of the water. A park with a large keepDry mask legitimately
     reads well under its climate band — `worlds-ref` (seed 7, **desert**, 128)
     measures **2.3%** where the seed-7/desert composition draws **4.9%**
     (desert p5 is 2.4%), because its three worlds' footprints are all keepDry.
     Charge the shortfall only when the park has NOT paid for it with built-out
     land.
   - Decorative water (`buildWater`/`buildWaterRibbon` fountains, troughs,
     flume channels) is still a plus on top.
9. **Scenery decoration (5)** — `probe.scenery` + `composables` + night
   dressing in shot 07. ~1 piece per 25 u² of pathed area is lively. Bare
   plazas ≤ 2. (Quantity here; VARIETY on axis 11, LANDMARK variety on 15.)
10. **Trees / natural mountains (4)** — `probe.trees.count` (≥ 4 on size 16,
    mixed `byShape` better) spread across the map; `terrain.peaks ≥ 1`.
    Treeless + flat = ≤ 1.5.
11. **Creativity (3)** — NAMING and SCENERY FLAVOUR only. 1.5 for themed ride
    and stall names (`probe.rideNames`, `probe.stallRoster.themedNameCount`),
    1.5 for scenery variety/flavour (`probe.sceneryVariety.varietyIndex` ≥ 6
    rich, ≤ 2 monotone; `flavourItems`). **Per-zone theme COHESION moved to
    axis 16** (it is measured, not eyeballed, now) — do not score it twice.
12. **Accessibility (10)** — `probe.accessibility`: `allRidesReachable` and
    `allStallsReachable` true (each false −2); `orphanIslands` = 0 (each −2);
    `nodesReachableFromGate/nodesTotal` = 1.0. **Ramping** —
    `probe.rampObservations`: `causewayEdges` (> 0.8 u over ground) and
    `steepEdges` (grade > 0.6 u/u) should be empty; cross-check
    `consoleSummary.rampSignals`. −1..2 per causeway/steep edge.
13. **Ride roster (7)** — replaces the old "ride count". A park is no longer
    rewarded for four rides; it is rewarded for a roster that is BALANCED,
    reaches beyond the same five flat rides every park uses, and is not a
    re-run of an earlier park's selection. All evidence in
    `probe.rideRoster` (`rides[]` carries `kind`/`category`/`tracked`).

    | pts | test | read it off probe.json |
    |----:|------|------------------------|
    | 2 | **count** — 4 registered rides baseline, 5+ full | `rideRoster.registeredCount`: 5+ = 2, 4 = 1.75, 3 = 1, 2 = 0.5, ≤ 1 = 0. Full only if spacing (axis 3) holds. |
    | 1.5 | **distinct KINDS** — no duplicate-kind padding, **less the coaster duplicates axis 14 MANDATES** | Count duplicates PER KIND off `rideRoster.rides[]` (what registered), subtract the mandated coaster duplicates (next paragraph), then: 0 chargeable duplicates = 1.5, one = 1, two+ = 0.5. **`distinctKinds` counts `rideRoster.kinds`, which is the UNION of what registered and what the park FILE mentions (`sourceHits`), so it can exceed `registeredCount` — `worlds-ref` reads 6 against 4 registered because its source also names `<Coaster>`/`<TrackRide>`. When they disagree, count distinct kinds off `rideRoster.rides[]` (what registered) and treat the surplus as a documentation signal, not extra variety.** |

    **THE MANDATED-COASTER EXEMPTION — THIS ROW USED TO PENALISE OBEYING AXIS 14
    (fixed 2026-07-26).** §4.0-E and axis 14 REQUIRE a second rated coaster
    (*"A ONE-COASTER PARK CANNOT TAKE FULL MARKS"*), and both coasters register
    as the SAME kind `Coaster`, so a park that obeys the mandate manufactures
    exactly the duplicate this row calls "padding". **Measured on `r15a` and
    `skeleton-a`: `distinctKinds` 8 against `registeredCount` 9, the sole
    duplicate being the mandated second coaster — the row paid 1.0 instead of
    1.5, a 0.5 pt fine for following the rules.** The row now DISCOUNTS the
    duplicates the mandate makes, so a park is **neither rewarded nor punished**
    for the mandate: full marks are reachable with one coaster or with two, and
    no credit is created by adding one.

    The exemption is deliberately narrow, so it cannot become the padding
    loophole this row exists to close:

    * **capped at TWO duplicates** (the second AND third coaster). A **FOURTH**
      coaster is padding again and is docked.
    * **bounded by `thrill.ratedCount − 1`, not by how many coaster components
      the park mounted.** Axis 14's mandate is literally `thrill.ratedCount ≥ 2`,
      so only a coaster that actually RATED buys an exemption; three copies of a
      fatal or unrated coaster buy nothing (`fatalCoasters` never registers with
      the sim). If `thrill.ratedCount` is absent the exemption is **ZERO** — the
      strict pre-fix reading. A missing input never buys credit here.
    * **coaster-family kinds only** (`circuitFamilyOf(kind) === 'coaster'` off
      the live `catalog.mjs` table). Duplicates are counted PER KIND, so a park
      with 2 `Coaster` + 2 `Carousel` exempts the coaster pair and is **still
      docked in full for the Carousel**.

    `score-park.selftest.mjs` carries three mutations proving each bound bites:
    a duplicate non-coaster kind, a fourth rated coaster, and padding with
    unrated coaster copies.
    | 1.5 | **category BALANCE** — **all 5** RCT2 groups (gentle / thrill / water / transport / dark), because SETUP.md §0-P.4 mandates 5 | `rideRoster.categoryCount` (`categoriesRepresented`): **5 = 1.5**, 4 = 1, 3 = 0.75, 2 = 0.5, 1 = 0. |

    **FULL MARKS START AT FIVE (aligned 2026-07-26).** This row banded `>= 4` at
    1.5, so `r16b` shipped **four** categories, declared `categories: 4` honestly
    on its `<Park roster>` prop, was correctly measured `overstated: false` — and
    **lost nothing**. SETUP.md §0-P.4 ("THE BUILD MANDATES — state them
    positively, because they are unconditional") reads *">= 8 rides, all distinct
    kinds, across **5 categories**"*, so an unconditional build mandate was
    unenforced by the yardstick that decides whether the build met it. The bands
    below 5 are **re-spaced, not lowered wholesale** — the row stays strictly
    monotone and a 4-category park is charged 0.5, the same size of charge this
    axis already levies for one duplicate kind.

    **The 5th category is reachable, and that is measured, not assumed.** `r16a`
    (same wave as the 4-category park) imported `GhostTrain` and shipped `dark`;
    `r15a` shipped `GhostTrain` + `ObservationTower`; `skeleton-a` shipped
    `HauntedMansion`. A claim that the generation environment offers no 5th
    category was investigated and **refuted** — the full catalog is offered — and
    `r16b`'s own header comment *"dark + tower rides are absent from this catalog
    build"* is a confabulation, not an availability fact. **No "unobtainable
    category" exemption exists here on purpose**: it would institutionalise a
    scoring excuse for a park that simply used fewer categories than required.
    | 1 | **CIRCUIT ROSTER** — how many rides RUN A VEHICLE ALONG A TRACK, besides the flagship coaster (**graded 2026-07-26; was a yes/no speciality test**) | `rideRoster.circuitsBesidesFlagship` (registered circuits − 1) with `rideRoster.circuitFamilyCount` over the five families `coaster / water / transport / dark / tower`: **≥ 4 circuits AND ≥ 3 families → 1**; 3 circuits and ≥ 2 families → 0.75; 2 circuits → 0.5; 1 → 0.25; 0 → 0. One coaster plus eight flat spinners measures `circuitCount: 1` and scores **0**. The old yes/no `hasSpeciality` / `specialityKinds` fields are still published and still mean "a TRACKED speciality besides the coaster", but they are no longer what this row scores — at the 2026-07-26 snapshot 20 of 20 probed parks would have passed the yes/no version while 16 of them ran a single coaster (**a dated snapshot of a moving corpus; re-derive with `node usage.mjs` before quoting — see "NO FROZEN USAGE LISTS" below**). |
    | 1 | **selection NOVELTY** — the kind set differs from every prior park, and reaches the never-used shelf | `rideRoster.novelty.distance` (Jaccard over `rideKinds` vs `signatures/`): ≥ 0.4 = 1, 0.25–0.4 = 0.5, < 0.25 = 0 (a re-run). `novelty.nearest` names the park it copies. **CAP AT 0.5 when `rideRoster.firstUseKinds` is empty** — a park that ships nothing the corpus has never seen is recombining, not exploring. **THE NEVER-USED SHELF IS DERIVED, NEVER LISTED HERE — see "NO FROZEN USAGE LISTS" below.** Every kind on it ships a WORKING DEFAULT (see the note under axis 14). |

    **NO FROZEN USAGE LISTS IN THIS DOCUMENT (2026-07-26).** This row used to
    name a hard-coded 14-kind "never shipped" list. **It was stale within hours
    of being written**: it named `Helicycles`, `HauntedMansion`, `MagneticRide`
    and `MotionSimulator`, and `skeleton-a` ships **all four**. A frozen list in
    prose cannot survive the corpus it describes, and a future reader who
    trusted it would score a park's novelty against a fiction. **It is deleted,
    not corrected**, because correcting it just restarts the clock.

    **Derive it instead — the shelf is recomputed at SCORING time, per park:**

    ```sh
    node usage.mjs            # both catalogs, per-kind park counts, NEVER USED lists
    node usage.mjs --never    # just the never-used shelves
    ```

    `usage.mjs` reads `signatures/*.json` through `corpus.mjs`
    (`loadCorpus` + `usageTable`) — the SAME pair `score-park.mjs` uses to
    recompute `firstUseKinds` / `firstUseCircuits`, with **the park's own
    signature excluded** and **the corpus size stamped on the result**. The
    values baked into a `probe.json` were computed against the corpus *as of
    that probe run*, which is not the corpus at scoring time, so
    `score-park.mjs` reports the stored value only when it differs and never
    scores off it. `rideRoster.corpusKindFrequency` / `catalogNeverUsed` (and
    `stallRoster`'s pair) carry the same table inside every `probe.json`.

    **The same rule applies to every usage or frequency figure below.** Any
    such number in this file is a DATED SNAPSHOT of a moving corpus, is marked
    as one, and must be re-derived before it is quoted. Anything that reads like
    a standing fact about what the campaign has or has not built is a bug in
    this document.
    | **−1** | **DEDUCTION — the park-spanning MONORAIL is REQUIRED** (rules §0 checklist, §3/§3.1, the verified block in §4.2). Absent, unregistered, or not passing every declared world. | `probe.monorail`: **−1** if `present` is false; **−1** if `present` but `registered` is false OR `fatal` is true OR `circuitClosed` is false (a fatal compile renders translucent red and never registers — the ride exists on screen and not in the sim, which is the exact defect this deduction is for); **−0.5** if it registers but `everyStationExitConnected` / `everyStationQueued` is false (a platform guests cannot reach is not a station); **−0.5** if `worldsDeclared > 0` and `everyWorldTouched` is false (`worldsTouched` names how many it does reach). |

    **The two probes behind that column.**
    `node probe-monorail-grand.mjs [--size=N] [--sweep]` re-compiles the §4.2
    block through the REAL `compileTrackPieces` and prints closure, clearance,
    bounds, the legal-start range, the station poses and the scaling sweep;
    `node probe-monorail-transfer.mjs [--secs=N] [--guests=N] [--stations=N]`
    runs the real `createGameManager` headlessly and prints the
    **boarded→left matrix** — the only evidence that the transport ride actually
    transports. On the reference park (`samples/monorail-ref.tsx`) they read
    4 platforms, clearance 16.66, gap 1.800, nothing synthesized, 0 warnings,
    every platform queue-attached with `exitLaneLen` 6.01, and **34 of 34 rides
    were A→B transfers** (first at 86.6 sim-s). A park whose monorail registers
    but whose queues stay empty is a `sim` problem, not a compile problem —
    check the gate-walk distance to the nearest platform.

    **The deduction does NOT change the axis weight — axis 13 is still 7, and
    the total is still exactly 100 (`node check-weights.mjs`).** It is applied
    after the five sub-tests and the axis **floors at 0**, never below. Cap the
    total deduction at −1: a park missing the monorail loses one point here, not
    two and a half. Score it off `probe.monorail`, never off the park's §0
    header claim — a header that says "monorail" while `registered: false`
    is the `rosterOverstated` documentation defect, reported separately.

    **`rideRoster.headerClaim` (wave-10) — score the PARK, then check the
    HEADER.** Every §0.16 header publishes a roster line, and until wave 10
    nothing compared it with the registry: round 9's park A claimed *"9
    registered rides, 5 categories"* against a measured **8 rides / 3
    categories**, with `/* Monorail dropped from the roster … */` still in the
    file. The probe now lifts that claim out of the park's own §0 header comment
    (`{ line, claimedRides, claimedCategories, registeredRides,
    representedCategories, overstated, detail }`; `null` when the header makes
    no claim), and `<Park roster={…}>` makes `validatePark` raise
    `rosterOverstated` for the same thing. **`overstated: true` is a
    DOCUMENTATION DEFECT: score every axis off what REGISTERED, note the
    overstatement in the report, and never let the claim stand in for the
    measurement.** A common cause is a FATAL compile — a coaster or monorail
    whose `compileTrackPieces` report is fatal renders translucent red and never
    registers, so the category the header counts is empty (see `thrill.fatalCoasters`).

    The catalog ships **44** registerable ride kinds (`rideRoster.catalogSize`,
    enumerated live from `components/` by `catalog.mjs` — anything new shows up
    under `unclassifiedKinds` instead of scoring silently). **This line said 31
    until 2026-07-25; the v6.0 world build added 13 (one flagship plus two or
    three attractions per preset) and DELETED the five one-call land macros,
    which were never registerable rides and never counted here.**
    `rideRoster.corpusKindFrequency` and `catalogNeverUsed` are the campaign
    frequency table: the kinds no park has EVER used.

    **THE CATEGORY-BALANCE AND SPECIALITY TESTS HAD STOPPED DISCRIMINATING FOR
    WORLDS PARKS, and it was a harness bug (fixed 2026-07-25).** All 13 new ride
    kinds were missing from `catalog.mjs`'s `RIDE_CATEGORY`, so they reported
    `category: 'unclassified'` — which is not one of the five scoring groups.
    A park built exactly the way §3 mandates, out of its worlds' own rides,
    therefore measured `categoryCount: 1` and `hasSpeciality: false` however
    varied its roster was: **`worlds-ref` read 1 category (thrill) off
    AetherBalloons + BoilerBurst + Discotron + MoonlitBarge + a TrackRide and
    scored 0/1.5 + 0/1**. All 13 are now classified from their own component
    headers and `defaults.intensity` (gentle: AetherBalloons · thrill: Bassline,
    BoilerBurst, Discotron, EmberWings, LavaTubeRun, WyrmsHollow · water:
    DeepDrift, MagmaRun, MoonlitBarge, OceanTunnelSlide, ReefRacer · dark:
    GearworksExpress), and `unclassifiedKinds` is empty again. Re-scored,
    `worlds-ref` reads **3 categories** (gentle + thrill + water) and
    `hasSpeciality: true` — 1/1.5 + 1/1. If `unclassifiedKinds` is ever
    non-empty again, the CATALOG TABLE is stale, not the park: fix
    `RIDE_CATEGORY` before scoring.
14. **Thrill (8)** — does the park actually give guests a RIDE**S**? Scored
    relative to the park's type (thrill vs family), which is **MEASURED, not
    declared and not defaulted** — see the next paragraph. Evidence in
    `probe.coasters[]` + `probe.thrill`.

    **THE PARK TYPE IS DERIVED FROM THE PARK'S OWN RATINGS (fixed
    2026-07-26).** This line used to read *"the park's DECLARED type … when
    ambiguous score as family"*, and **nothing anywhere declares one**:
    `probe.json` has no park-type field and no §0 header in `samples/` writes
    one (checked across the corpus — headers publish SEED / SHAPE / CATS /
    CIRCUITS and never a type). So EVERY park was "ambiguous" and EVERY park
    took the FAMILY branch, whose targets are lower on three of the six
    sub-tests (**E 5.0 vs 6.0, +G 1.8 vs 2.5, drop 1.2 vs 2.0**). That is not a
    tie-break — it is a systematic discount, and it is always the branch that
    scores higher. **The type is now a measurement**, computed with no reference
    to what it would score, from these signals in order of authority:

    1. **THE FLAGSHIP'S OWN RCT2 INTENSITY** — `max(coasters[].intensity)` over
       the rated coasters, the same number `thrill.ratedCoasters[].intensityBand`
       bands. Cut points are not invented here: they are the **same > 6 / ≤ 3
       cuts `probe.mjs` already uses** to band `thrill.intensityMix` into
       intense / moderate / gentle, which are RCT2's own rating bands.
       **intensity > 6 → THRILL**; **≤ 3 → FAMILY**; the moderate band in
       between decides nothing.
    2. **THE REGISTERED ROSTER'S INTENSITY MIX** — `thrill.intensityMix`, banded
       off every registered ride's authored `intensity`. **`intense ≥ gentle`
       (and `intense > 0`) → THRILL**; **zero intense rides against ≥ 1 gentle →
       FAMILY**; anything else decides nothing.
    3. **NEITHER DECIDES → the STRICTER (thrill) branch**, flagged
       `parkTypeBasis.assumptionBased: true` in `score.json`, named in axis 14's
       `reason`, and pushed to `notes` as *"its score is a LOWER BOUND, not a
       measurement of the intended type"*. **The old "score as family" tie-break
       is deliberately NOT followed**: it hands the generous branch to every park
       whose evidence is thin, which is the defect being fixed.

    You cannot claim to be "just a family park" while shipping an
    intensity-9.55 hypercoaster, and **a park cannot lower its own bar by
    declining to declare**. `--parkType=` remains available but is **strict-only**:
    `--parkType=thrill` is accepted over a measured `family`, while
    `--parkType=family` over a measured `thrill` is **REFUSED** and the refusal is
    recorded in `parkTypeBasis.override`. `score.json` always carries the full
    `parkTypeBasis` — `{ type, source, evidence[], assumptionBased, override }` —
    so the branch is auditable.

    **THE AXIS SCORES A ROSTER, NOT A FLAGSHIP (reworked 2026-07-26).** Until
    now the headline test was `thrill.flagshipExcitement` — ONE field, off ONE
    coaster — so **a park with one excellent coaster scored exactly the same as
    a park with three, and nothing anywhere asked for a second.** SNAPSHOT
    2026-07-26, 20 probed parks (`node probe-tracked-roster.mjs`; **re-derive
    before quoting — see "NO FROZEN USAGE LISTS" under axis 13**): **16
    registered exactly one coaster, 3 registered none, and exactly one
    (`hollowmere2`) registered two.** The rework has since moved that number —
    re-measured over the 28-park `signatures/` corpus the same day, **3 parks
    register 2+ rated coasters, 14 exactly one and 5 none** — which is the
    intended effect, not a contradiction. That was not authors being lazy — every
    §4.0 archetype block and this axis were written in the singular, so the
    rules never asked. Real RCT2 parks run several circuits; that is the whole
    point of publishing a coaster shelf.

    | pts | test | read it off probe.json |
    |----:|------|------------------------|
    | 3 | **flagship excitement** ≥ 6.0 thrill / ≥ 5.0 family | `thrill.flagshipExcitement`. Pro-rate: full at target, 1.5 at ~60%, 0 below ~25%. |
    | **1.5** | **COASTER + CIRCUIT ROSTER** (new) — see the breakdown below | `thrill.ratedCoasters[]`, `thrill.secondCoaster`, `thrill.secondDistinctArchetype`, `thrill.intensitySpread`, `rideRoster.circuitCount` / `circuitFamilies` / `firstUseCircuits`. |
    | **1** | **force envelope** — peak positive vertical G ≥ 2.5 g thrill / ≥ 1.8 g family AND lateral G under the 1.27 g margin (**was 2**) | `thrill.peakPosVertG` vs `thrill.lateralSafe`/`worstLateralG`. **Score 0** if `thrill.coasterGateOk` is false or `fatalCoasters > 0` — **and see "AN ILLEGAL COASTER BANKS NO THRILL" below: that condition now forfeits four MORE rows, not just this one.** 0.5 if only one test passes. |
    | 1 | **highest drop** ≥ 2.0 u thrill / ≥ 1.2 family with a credible top speed | `thrill.bestHighestDrop` + `coasters[].maxSpeed` (a 2 u drop should read ≳ 6 u/s). Half for the drop without the speed. |
    | **0.5** | **airtime** (**was 1**) | `thrill.bestAirtimeSeconds > 0` and/or `bestNegVertG ≤ −0.1`; ≥ 0.2 s reads as sustained. |
    | 1 | **park thrill MIX** — gentle + moderate + intense all present | `thrill.mixComplete`. Half for two of three. |

    (3 + 1.5 + 1 + 1 + 0.5 + 1 = **8**; `node check-weights.mjs` asserts it.)

    **THE ROSTER TERM, 1.5 pts, all three parts measured off `probe.thrill` /
    `probe.rideRoster`:**

    | pts | test | threshold |
    |----:|------|-----------|
    | 0.75 | a **SECOND rated coaster from a DIFFERENT §4.0 archetype**, and a real ride rather than a filler | `thrill.ratedCount ≥ 2` AND `thrill.secondCoasterQualifies` (the second coaster's own `excitement ≥ 4.0`) AND `thrill.secondDistinctArchetype` → 0.75; qualifying but the SAME archetype → 0.5; **a second coaster under E 4.0 → 0.25**; `ratedCount < 2` → **0**. `thrill.ratedCoasters[].archetype` names the shelf (`4.0-A` / `4.0-B` / `4.0-C` / `custom`, fingerprinted on `(inversions, dropCount, length)`). **The 4.0 floor sits in an empty gap in the published shelves — the LOW-THRILL legacy shapes top out at E 1.11 and §4.0 floors at E 5.27 — so it is measured, not invented. Without it `hollowmere2`, the only corpus park with two coasters, would collect the full 0.75 for a legacy filler rating E 1.1**, which is the padding this term exists to refuse. |
    | 0.5 | the **CIRCUIT roster spans the plot** | `rideRoster.circuitCount ≥ 5` AND `circuitFamilyCount ≥ 3` → 0.5; 4 circuits / ≥ 2 families → 0.25; else 0. Families: `coaster / water / transport / dark / tower`. |
    | 0.25 | at least one circuit off the **never-used shelf** | `rideRoster.firstUseCircuits` non-empty. |

    **A ONE-COASTER PARK CANNOT TAKE FULL MARKS.** With `ratedCount: 1` the
    0.75 second-coaster point is unreachable, so the axis caps at **7.25/8**;
    one coaster plus flat rides only caps at **6.5/8**. That is deliberate and
    it is the point of the rework.

    **AN ILLEGAL COASTER BANKS NO THRILL — THE AXIS CAPS AT 1.75/8 (fixed
    2026-07-26).** `thrill.coasterGateOk: false` / `fatalCoasters > 0` used to
    zero the 1-pt force row **only**, so a coaster the game refuses to open
    still collected the 3-pt excitement rating, the 1-pt drop and the 0.5-pt
    airtime — **4.5 points of thrill off geometry `validatePark` rejects**.
    HANDOFF.md §3 states the intent: *"thrill must never come from
    illegality."*

    **Which rows forfeit, read off what the check actually covers.**
    `coasterGateOk` is `consoleSummary.coasterFails.length === 0`
    (`probe.mjs`), i.e. `validatePark`'s `check: 'coaster'` block — *"coaster
    legality: design rules + clearance + CRASH-FREE guard"* — which fires on
    exactly five things: a **FATAL compiled track**; a non-warning
    `checkCoasterDesign` violation (`slope` / `pitchRate` / `inversion` /
    `bankLimit` / `bankRate` / `noStation`); the track leaving the **plot
    bounds**; `validateSpline` **self-clearance under 0.9 u**; and the **derail
    guard** — `replayCoasterForces().worstLatAccel > 1.275 g`, *"the train
    would crash"*. `rateCoaster()` runs **that same `replayCoasterForces`
    pass** (`SplineRideKit/ratings.ts`: *"there is exactly ONE physics model in
    the kit"*), and the replay has no early exit, so an illegal coaster still
    yields internally-consistent numbers — they simply describe a lap that in
    the live sim ends in `crashTrain` and is never completed. **The numbers are
    not corrupt; they are UNEARNED.** So every row measured off that track or
    that replay forfeits:

    | forfeit | row | why |
    |--:|---|---|
    | 3 | flagship excitement | replay speed/G + the rejected track's geometry |
    | 0.75 | second rated coaster | a rated-coaster credit |
    | 1 | force envelope | the derail guard IS this row (was already 0) |
    | 1 | highest drop | the drop of a track the gate rejects |
    | 0.5 | airtime | the same replay's vertG dwell |

    and only the rows that are **not coaster-derived** survive — **circuit span
    (0.5)** and **never-used shelf (0.25)**, which read
    `rideRoster.circuitCount` / `circuitFamilyCount` / `firstUseCircuits` and
    are roster COMPOSITION facts true whether or not the flagship is legal; and
    the **park thrill MIX (1)**, which bands every registered ride's *authored*
    `intensity` prop (flat rides included, via the GameManager registry) and
    touches no coaster physics at all. **So an illegal-coaster park caps at
    1.75/8.**

    **The whole axis is deliberately NOT zeroed.** Zeroing the mix and circuit
    rows would charge the illegality to measurements it never touched — a legal
    flat-ride roster is still a legal flat-ride roster. 1.75/8 is a cap as well
    as a per-row forfeiture, so no row added to this axis later can leak thrill
    credit past it without someone deciding to raise the number.

    **Attribution caveat, published rather than papered over.**
    `coasterGateOk` is **park-wide and not attributable to one coaster**:
    `registerCoaster` is also called for a **FATAL `<TrackRide>` of any
    profile**, so a broken log flume flips it false and forfeits the block. That
    is still a real defect a 100/100 park must not ship, so the forfeiture
    stands and the scorer's `reason` string names the cause. Two adjacent things
    are NOT in `coasterGateOk` and must not be read into it: the **corridor
    sweep** (it fails under `check: 'corridor'`, charged on axis 3) and the
    `shortDrop` rating-halving gate (it fails under `check: 'autofix'`).

    **WHERE THE 1.5 CAME FROM — corpus data, not invention.** SNAPSHOT
    2026-07-26 over the 15 corpus parks with a rated coaster (**a moving figure;
    re-derive before quoting — see "NO FROZEN USAGE LISTS" under axis 13**):
    **force envelope passed 15/15 on BOTH halves** (`+G ≥ 2.5` 15/15,
    `latG < 1.27` 15/15 — the §4.0 shelf clears the gate by 29–79 %), and
    **airtime > 0 passed 15/15** (≥ 0.2 s: 14/15). Neither test discriminates
    any more, exactly like the axes trimmed in the original reweighting, so
    force envelope went 2 → 1 and airtime 1 → 0.5. The two tests that still
    discriminate keep their weight: flagship excitement (10/15 clear the thrill
    target, 14/15 the family one) and the thrill mix (11/15). **No 17th axis, and
    the 16 still sum to exactly 100.**

    RE-DERIVED the same day over the 28-park `signatures/` corpus — **17 parks
    with a rated coaster: `+G ≥ 2.5` 17/17, `lateralSafe` 17/17, airtime > 0
    17/17 (≥ 0.2 s: 16/17), `E ≥ 6.0` 12/17, `E ≥ 5.0` 16/17, `mixComplete`
    13/17.** The *conclusion* held under re-measurement (the two force halves
    and airtime still do not discriminate; excitement and mix still do), which
    is the only reason the weights above are unchanged. The counts themselves
    moved, as they always will.

    **WHY A SECOND CIRCUIT IS CHEAP — the finding that makes this affordable.**
    Only `<Coaster>` / `<TrackRide>` / `<SplineCoaster>` REQUIRE a `pieces`
    array. Every other circuit either guards the call (`if (opts.pieces)` —
    `LogFlume`, `RiverRapids`, `Chairlift`, `Bobsleigh`, `GoKarts`, `Monorail`:
    with no `pieces` prop `compileTrackPieces` is **never invoked**, so there is
    no closure report and no closure risk) or compiles its OWN shipped default
    (`opts.pieces ?? DEFAULT_PIECES` — `Bassline`, `DeepDrift`, `EmberWings`,
    `GearworksExpress`, `LavaTubeRun`, `MagmaRun`, `MagneticRide`,
    `MineTrainCoaster`, `MoonlitBarge`, `OceanTunnelSlide`, `ReefRacer`,
    `WyrmsHollow`). **All twelve defaults were compiled through the real
    `compileTrackPieces` on 2026-07-26 (`probe-tracked-roster.mjs`) and all
    twelve read `ok`, `closed: true`, 0 synthesized, 0 warnings**, with track
    spans 8.5 × 6.1 u (MoonlitBarge) to 27.3 × 25.6 u (LavaTubeRun) — every one
    of them SMALLER than the smallest §4.0 archetype (28.9 × 30.4). So five or
    six circuits cost five or six lines, and only the flagship coaster(s) need
    the §4.0 shelf treatment. `rideRoster.noCompileCircuits` lists the
    zero-risk ones a park actually shipped.

    **NAUSEA GUARD — cap the axis at 5/8** when `thrill.nauseaExtreme` is true.
15. **Layout uniqueness (7)** — is this park's SHAPE its own, or the same
    lattice again? Everything is in `probe.layout`; the scorer is executable
    (`score-layout.mjs`, thresholds in `THRESHOLDS`) so two scorers reach the
    same number. `layout.gridRegularity` ∈ [0,1] is the headline —
    **higher = more lattice-like = worse** — and is a fixed weighted sum of
    five published terms (`layout.gridTerms`, `layout.gridWeights`):

    ```
    gridRegularity = 0.25·axisAlignedFraction     (all-cardinal streets)
                   + 0.25·(1 / effectiveLengthClasses)   (one block size only)
                   + 0.15·min(1, 2 / effectiveBearingBins) (only the 2 cardinals)
                   + 0.20·latticeNodeShare        (nodes on a col-line AND a row-line)
                   + 0.15·pitchUniformity         (a single spacing per axis)
    ```

    **The grid/lattice/curve metrics measure the AUTHORED STREET NET only.**
    `<Paths>` records `streetNodes`; every node past that index is a queue/exit
    access spur the GameManager appended, and those stubs are short, odd-length
    and sometimes oblique. Including them flatters a monotonous lattice — Cinder
    Peak reads `gridRegularity` **0.573 with spurs vs 0.774 without** — so they
    are excluded (`layout.net.streetNodes` / `streetEdges` /
    `accessSpursExcluded`). validatePark makes the same distinction: its
    `gridNodeCount` exempts spur attaches from the N/S/E/W rule. District, plot
    and open-space metrics use the WHOLE net, and districts cluster on each
    ride's FOOTPRINT CENTRE (a `<Coaster>` group's origin is its mount
    transform `[0, 0]`, not where the ride stands).

    `effectiveLengthClasses`/`effectiveBearingBins` are PERPLEXITIES
    (`exp(H)` of the edge-length / 15°-bearing histogram): a uniform grid with
    one edge length gives 1, five evenly used classes give ~5. A GRID LINE is a
    coordinate value shared by ≥ 3 nodes; `pitchUniformity` = mean of
    1/(distinct spacings) per axis.

    **SET-PIECE MEMBER EDGES ARE ALSO EXCLUDED, but from the LENGTH histogram
    only (wave-12 P0).** A `<Boulevard>`/`<Bazaar>` is authored as a chain of
    1.2 u lattice cells (one node per cell) and a `<FountainPlaza>`'s ring is a
    handful of fixed-length legs — the design system's OWN macro geometry, not
    a block-size choice the author made. Round 11's park routed seven
    boulevards exactly as this file's §3 advises and measured
    `effectiveClasses 1.96` / `modalShare 0.857` with 132 of 154 edges at
    1.2 u — LOSING the 0.75-pt block-size-variety term for following the
    rules. `layout.mjs` now reads `raw.setPieces[].bbox` (the piece's own
    mounted dressing group's world bbox — a proxy for its footprint, since the
    carriageway slab itself is drawn by the shared `<Paths>` component) and
    excludes any edge whose BOTH endpoints fall inside a piece's bbox from the
    length-class histogram that drives `edgeLengths.effectiveClasses` /
    `modalShare` / `cv` / `distinctClasses` / `byClass` **and** `gridRegularity`'s
    `lengthUniformity` term (`g2`, the SAME `effectiveClasses` number — see the
    formula above). The pre-fix numbers are kept alongside for audit as
    `effectiveClassesRaw` / `modalShareRaw` / `cvRaw` / `distinctClassesRaw` /
    `byClassRaw` and `layout.gridRegularityRaw`; `layout.net.setPieceMemberEdges`
    reports how many edges the exclusion removed. On `coolpark-a` (the round-11
    evidence park, re-measured 2026-07-25): `effectiveClasses 1.96 → 4.21`,
    `modalShare 0.857 → 0.588`, `gridRegularity 0.608 → 0.54` (crossing the
    0.55 full-credit floor) — axis 15's total moved **5.32 → 6.5 / 7**. This is
    a proxy, not a byte-exact membership tag: it is a no-op for a park with no
    `raw.setPieces` at all, so hand-chaining uniform edges without ever using a
    macro piece still earns no exclusion.

    | pts | test | fields + numeric thresholds |
    |----:|------|-----------------------------|
    | 1.5 | **not a lattice** | `layout.gridRegularity`: ≤ **0.55** → full 1.5; ≥ **0.75** → **0**; linear between. |
    | 0.75 | **block-size variety** | `layout.edgeLengths.effectiveClasses` (set-piece member edges excluded — see below) ≥ **3** → 0.75; ≥ 2 → 0.375; else 0. |
    | 0.75 | **block irregularity** | `layout.lattice.latticeNodeShare` ≤ **0.5** OR `layout.edgeBearings.obliqueEdgeFraction` ≥ **0.15** → 0.75; `latticeNodeShare` ≤ 0.7 OR `layout.curves.hasCurveOrDiagonal` → 0.375; else 0. |
    | 1 | **districts separated** | `layout.districts.count` ≥ **2** AND `maxSeparation` ≥ `separationTarget` → 1; ≥ 2 clusters but none of them that far apart → 0.5; 1 cluster → 0. Clusters are single-link over registered ride positions at `cutDistance`. **Both numbers come from ONE published source, `districtSeparationFloor`/`districtClusterCut` in `layout.mjs`, shared with `rules/park-generation.md` §0.3 check 4 / §0.15: floor `20·√(size/48)` = **20 u @48, 32.66 u @128 (the current default), 40 u @192**, cut `0.6·floor` = **12 u @48, 19.6 u @128, 24 u @192**.** They are FOOTPRINT-derived, not plot fractions — the pre-wave-10 `0.25·size` cut (48 u @192) merged whole parks into one district and the `20·size/48` target (80 u @192) asked for double the rulebook figure, so a rule-following 192 park scored 0 for having districts. Measurement: `node probe-layout-thresholds.mjs` (`--size=` defaults to 128 since 2026-07-25 — sections 2 and 3 were hardcoded to the retired 192 default). **RE-VERIFIED AT 128 (2026-07-25): the cut still RESOLVES districts and does not collapse them.** `worlds-ref`'s merge ladder is `[9.8, 53.7, 64.5]` — the 19.6 u cut sits above its one intra-district gap and far below both inter-district jumps, giving 3 clusters at `maxSeparation` 101.7 / `minSeparation` 57.0 against the 32.66 floor (natural cut 31.7). Feasibility at 128: inside §0.3's gate-reach band with a 15 u half-footprint the largest mutual separation is **66.5 u at k=3, 55.6 at k=4, 49.2 at k=5**, so the 32.66 floor leaves 16–23 u of slack at every district count §3 asks for. The scored test is POSITIVE (the WIDEST pair clears the floor); a park whose CLOSEST pair is under it gets an advisory note, not a second deduction. |
    | 1 | **plot actually used** | `layout.plot.plotUtilisation` ≥ **0.7** → 1; ≥ **0.45** → 0.5; else 0. It is `0.4·min(1, pathExtentFraction/0.55) + 0.3·min(1, occupancyFraction/0.35) + 0.3·quadrantSpread`, where `occupancyFraction` is the share of an 8×8 grid over the plot holding any feature and `quadrantSpread = (1 − maxQuadrantShare)/0.75`. **This is where "everything huddled in one quadrant" loses.** A FEATURE is a street node, a ride, a stall or a plaza rect — trees and scenery do NOT move this number. **THE 0.722 CEILING WAS A 192-ONLY ARTEFACT AND DOES NOT APPLY AT THE 128 DEFAULT (re-measured 2026-07-25, `probe-layout-thresholds.mjs --plot --size=128`).** The gate stands at `z = 1.2·round((S/2 − 0.8)/1.2)` and §0.3's reach is a fixed ~75 u of walking, so on a **192** the band stops at z = 19.8, north of the mid-line, two quadrants are empty by construction and the ceiling is **0.722** (0.68 realistic) — but on a **128** the gate is at z = 63.6 and the band runs to **z = −11.4, PAST the mid-line**: all four quadrants are reachable and the ceiling is **0.930** (0.88 realistic, 0.51 for a park that fills only the gate end). At 48 it is 0.997. **So at the current default the 0.70 threshold is comfortably attainable inside §0.3 and what still loses the point is HUDDLING, not the band** — `seedcheck-s1-192` reads 0.28 and `worlds-ref` 0.636 on plots they could have covered. Keep the 192 ceiling in mind only when scoring a park that pins `size={192}`. **`pathExtentFraction` itself is FLOOR-ONLY here (`min(1, pathExtentFraction/0.55)` — no term in this formula ever penalises a value above 0.55), and axis 2 was fixed 2026-07-26 to match: it used to cap "healthy" at 0.2–0.6, which fought this term over the exact same measurement (`extentFractionOfPark` in `probe.paths` and `pathExtentFraction` here are the SAME bounding-box-of-nodes/plot-area computation — compare `probe.mjs`'s `extentFractionOfPark` with `layout.mjs`'s `pathExtentFraction`, both `((maxX−minX)·(maxZ−minZ))/(S·S)` over the same node set). See axis 2 above for the corpus measurements that resolved it.** |
    | 1 | **open-space variety** | `layout.openSpace`: `count` ≥ **2** AND `areaSpread` ≥ **1.8** AND `largestArea` ≥ **8 u²** → 1; ≥ 2 spaces only → 0.5; a single space ≥ 8 u² → 0.25; else 0. Touching plaza rects are MERGED first, so a fountain court paved from nine 1.2 u cells counts as ONE space. |
    | 1 | **cross-park novelty** | `layout.novelty.distance` ≥ **0.08** → 1; **0.04**–0.08 → 0.5; < 0.04 → 0. Mean per-dimension distance between this park's 29-dim `layout.signature` and the nearest prior park in `signatures/` (`novelty.nearest`, `nearestThree`). |

    (1.5 + 0.75 + 0.75 = 3 anti-lattice, 1 + 1 = 2 districts/plot, 1 open
    space, 1 novelty = **7**.)

    The SIGNATURE is not a hash: 29 scale-normalised shape statistics
    (`SIG_DIMS` in `layout.mjs`) — bearing/length uniformity, lattice share,
    degree mix, cycle ratio, path density, extent/occupancy/spread, district
    count and separation, open-space count/area, curved runs, and a 5-bin
    bearing histogram — so similar-looking parks land close together and
    `sigDistance` is a real novelty measure.

    Also reported, not directly scored: `layout.landmarks`
    (`setPieceKinds` — FountainPlaza / Bazaar / Boulevard — plus
    `landmarkSceneryKinds` and `landmarkVariety`) feeds the theming third of
    axis 11, and `layout.curves.obliqueJunctions`/`curvedRuns` document HOW a
    park earned its block-irregularity point. Note that `validatePark` FAILS
    any rendered street edge that runs diagonally (RCT2 paths are N/S/E/W), so
    a legal park earns block irregularity through irregular BLOCKS, not
    diagonal streets.

16. **Worlds (5)** — is this park composed of WORLDS, and does each world stay
    in its own vocabulary? `rules/park-generation-composition.md` §3 inverted
    park composition: an author picks **≥ 3 of the 5 shipped presets**
    (`fire`, `pirateBeach`, `steampunk`, `enchantedForest`, `neon`), builds each
    one out as a self-contained district — its own rides, stalls, scenery,
    palette and planting — and only then connects them with pathing. This axis
    scores that, and it charges the theme break the rules exist to prevent:
    a lava fissure standing in the disco street.

    **THE THEME ABSTRACTION — ONE ID SPACE (2026-07-27).** There are **six**
    themes: the five PRESET WORLDS above, plus **`default`, the Original
    theme** — the classic un-themed RCT2 dress the hub, entrance plaza and
    midway are built in. Original is a real theme, not an absence, but it is
    **not a preset world**: three lands dressed `default` are one place, so it
    never counts toward the "≥ 3" above.

    The five presets each own **3 rides, 1 stall and 5–7 scenery pieces** —
    run `node themes.mjs` for the authoritative table, which is PARSED from
    `ParkBuilder/worlds.ts: COMPONENT_THEME` at load time and asserted against
    `SetPieceKit` so the rubric can never grade a park against a catalog the
    generator cannot build from.

    Each preset also answers to a LEGACY place name — `emberfall` = `fire`,
    `tidewater` = `pirateBeach`, `brasswork` = `steampunk`, `thornwick` =
    `enchantedForest`, `pulse` = `neon` — because the design system renamed
    them to plain genres (a proper noun invites a generator to invent matching
    lore instead of picking the LOOK it wants). **Everything in the rubric
    folds through `themes.mjs: canonicalPresets` before comparison**, on both
    sides: the corpus records on disk (all still place names) and the subject
    park (genre ids).

    That fold was missing until 2026-07-27 and it made the CHOICE term below
    **unearnable by any park written after the rename**: `corpus.mjs` kept a
    hard-coded place-name list and `presetFrequency`'s `if (p in freq)`
    silently dropped every canonical-id build. MEASURED: `skeleton-l` builds
    `pirateBeach` — which IS `tidewater`, the rarest preset in the corpus at
    **2 of 30** — and scored CHOICE **0 of 0.5**. The park did exactly what the
    term pays for and the rubric could not see it.

    Everything is in `probe.worlds`, which is lifted VERBATIM off the design
    system's own settle-time audit (`ParkBuilder/worlds.ts: auditWorldThemes`,
    published on the store by `<Park>` as `_worldAudit`). `validatePark`'s
    `crossTheme` warnings come from the SAME function, so the gate and the
    rubric can never disagree about which piece is in the wrong world. The
    scorer is executable (`score-worlds.mjs`, thresholds in `THRESHOLDS`, and
    `probe.worlds.score` carries its output) so two scorers reach the same
    number.

    | pts | test | fields + numeric thresholds |
    |----:|------|-----------------------------|
    | 1.5 | **WORLD VARIETY = COUNT (1) + CHOICE (0.5)** — ≥ 3 preset worlds really built, **and not the same three every park picks** (split 2026-07-26) | **COUNT, 1 pt:** distinct `themeId`s among `worlds.worlds[]` entries with `built: true` (`score.builtPresets`): ≥ **3** → 1; 2 → 0.5; 1 → 0.2; 0 → 0. Counted over BUILT worlds, not `worlds.declared`: a declared rect with nothing in it is a label, not a place. **CHOICE, 0.5 pt:** `worlds.presetUsage` (= `underusedPresets(corpus)`, recomputed from `signatures/` on every probe) splits the five presets on their corpus BUILD count's median. ≥ 1 built preset strictly BELOW the median → **0.5**; ≥ 1 at the median and none below → 0.25; all above → **0**. `score.varietyTerms` publishes the two halves separately, and `worlds.unusedPresets` names the presets the park skipped. If `presetUsage` is absent (an old probe.json) the CHOICE term is reported **UNSCORED**, never docked. |
    | 1 | **each world is a self-contained district WITH ITS OWN RIDES** = DISTRICTS (0.5) + OWN CONTENT (0.5) (split 2026-07-27) | **DISTRICTS, 0.5 pt:** share of `worlds.worlds[]` with `built: true`, pro-rated. `built` = ≥ 1 registered ride AND ≥ 1 stall AND ≥ 1 scenery-piece-or-set-piece inside the world's bounds (`rideCount` / `stallCount` / `sceneryCount` + `setPieceCount`) — UNCHANGED, and still the same test the gate's `worldNotBuiltOut` warning uses. **OWN CONTENT, 0.5 pt:** share of the BUILT worlds holding ≥ 1 of their OWN themed **ride or stall** (`worlds.themedPieces[]` whose `world` is this world and whose `themeId` canonicalises to the world's own — `themes.mjs: isOwnHeadlineContent`). `score.buildOutTerms` publishes the two halves. **SCENERY IS DELIBERATELY EXCLUDED** — see below. |
    | 1 | **worlds read as separate places** | `worlds.separation.minCentre` ≥ `worlds.separation.floor` → 1; ≥ 0.6·floor → 0.5; else 0. Single world → 0. The floor is `districtSeparationFloor(size)` — **the same published number axis 15 and rules §0.3 check 4 use** (20 u @48, 32.66 @128, 40 @192). Scored on the CLOSEST pair, because every adjacent pair of worlds owes it: one well-separated pair must not excuse two worlds fused into a continuous fairground. |
    | 1.5 | **THEME COHERENCE** — no themed piece in a foreign world | `worlds.crossTheme` empty → 1.5; **−0.5 per offending piece** (`worlds.crossThemeCount`), floored at 0. Each finding names the piece, its theme, its coordinates and the world it landed in. |

    ((1 + 0.5) + (0.5 + 0.5) + 1 + 1.5 = **5**.)

    **WHY OWN CONTENT, AND WHY SCENERY DOES NOT BUY IT.** `built` counts
    pieces, not provenance, so three worlds can all pass it while being the
    same park three times with different shrubbery — which is precisely what
    the corpus was doing. MEASURED on `skeleton-l` (2026-07-27), a 3-world park
    that scored the full 1.0 for build-out: its `neon` and `pirateBeach` worlds
    held themed SCENERY and a generic `Bazaar`, and their rides were a renamed
    `HauntedMansion` and a `Monorail`. Only `enchantedForest` held a ride of its
    own (`MoonlitBarge`). The park read as fully built out and was, in the way
    that matters, one place wearing three hats.

    Dressing a stock Carousel with giant toadstools is not an enchanted forest;
    `WyrmsHollow` is. So the term counts **rides and stalls only**. Every preset
    ships three rides and a stall of its own, so each world has **four** ways to
    earn it and no theme is structurally excluded — the same standard the CHOICE
    term is held to. Effect on the references: `skeleton-a` 4.75 → **4.42**,
    `skeleton-l` 4.5 → **4.67** (both gain the newly-reachable CHOICE 0.5;
    both lose on worlds stocked generic).

    **WHY CHOICE, AND WHY IT IS NOT A PENALTY FOR AVOIDING A BROKEN PRESET.**
    The rules said ">= 3 worlds" and stopped, and the measurement shows exactly
    what that produced. **The live figure is `worlds.presetUsage`
    (= `underusedPresets(corpus)`, recomputed from `signatures/` on every probe)
    — that is what the 0.5 is scored off, and no list here is frozen; see
    "NO FROZEN USAGE LISTS" under axis 13.** SNAPSHOT at the time the split was
    designed, over the 10 corpus parks that declared any world: BUILT presets
    **brasswork 7 · pulse 7 · thornwick 5 · emberfall 3 · tidewater 2**, `pulse`
    DECLARED by **10 of 10**. RE-DERIVED 2026-07-26 over 28 signatures / 14
    world-parks: **brasswork 10 · pulse 10 · thornwick 9 · emberfall 5 ·
    tidewater 2** (median 9, so `tidewater` + `emberfall` are the underused pair
    and `thornwick` sits AT the median). The shape of the finding survived; the
    counts did not, which is exactly why the row scores the derivation and not
    these numbers. Three separate parks
    (`coolpark`, `r12a`, `worlds-ref`) built the identical brasswork + pulse +
    thornwick trio and all three scored a full 1.5 for "variety". Under the
    split they read **1.25**, while `r13a` / `r13b` / `r14a` — which reached for
    tidewater or emberfall — hold 1.5, and `voltmoor` GAINS 0.25. **No preset is
    structurally unusable and none is exempt: all five have been BUILT at least
    twice, all five still ship their own rides, stall and five scenery pieces
    (audited 2026-07-25), and `tidewater` — the rarest at 2 — is the one whose
    world rides are the biggest circuits in the catalog (`ReefRacer` 29.6 × 43.4
    u mounted, `OceanTunnelSlide`, `DeepDrift`).** The credit is deliberately
    relative to the corpus, not a fixed list, so once tidewater is common the
    0.5 moves to whatever is rare then and this row never needs re-editing.

    **THE AXIS SURVIVED THE v6.0 LAND-MACRO REMOVAL UNCHANGED.** The five
    one-call land components (`<EmberfallCaldera>`, `<TidewaterHollow>`,
    `<BrassworkFoundry>`, `<ThornwickGlade>`, `<PulseDistrict>`) were deleted
    from the design system. **No part of this axis depended on them.** Every
    input is a `probe.worlds` field produced by `auditWorldThemes`, which reads
    `<World>` regions and `dsComponent`/`dsWorldTheme` tags — none of which the
    macros owned. All five PRESETS remain buildable and therefore scoreable:
    each still ships its own rides, its own stall and its own five scenery
    pieces (audited 2026-07-25: all 47 surviving `COMPONENT_THEME` keys resolve
    to a component that still exists, zero phantoms). What changed is only HOW a
    district is assembled — by hand from a themed structural set-piece plus that
    world's themed content, instead of from one macro call. **No preset is
    marked unavailable, and the 5 points remain fully attainable.**

    **WHAT IS AND IS NOT A THEME BREAK.** Only THEMED pieces are constrained.
    The catalog's `COMPONENT_THEME` table (`ParkBuilder/worlds.ts`) is the
    machine-readable theme tag: 47 components whose subject matter belongs to
    one world (`LavaFissure`, `CoralCluster`, `MirrorBallPylon`, each world's
    own ride, stall and scenery pack). **Everything absent from that
    table is NEUTRAL and legal in every world** — benches, bins, paths, the
    gate, generic trees and `SceneryPack` pieces, `Torch`/`StringLights`, every
    stock RCT2 flat ride and coaster, and the structural set-pieces
    `FountainPlaza`/`Bazaar`/`Boulevard` (those are classified by the `theme`
    their PLAN was dressed for, so an Emberfall-dressed plaza inside the Pulse
    District *is* a finding, while an un-dressed one is not). `DanceFloor`,
    `NeonSign` and `BalloonStand` are deliberately neutral: §3 uses the dance
    terrace and neon marquee as generic boardwalk flavour, and tagging them
    `pulse` would make the rulebook's own advice a defect.

    **A themed piece OUTSIDE every declared world is NOT charged** — it is
    reported as `worlds.unplacedThemed` and noted. A caldera's flume circuit
    legitimately sprawls past the rect an author drew, and charging for it
    would push authors toward drawing worlds so large they overlap.

    **Severity in the gate:** `crossTheme` is a validatePark **WARNING**, never
    a failure — the park still opens, the sim still runs, RCT2 legality still
    holds, and the defect is already charged here (the rubric's own
    don't-double-charge rule). Two structural mistakes ARE fatal because they
    make the audit meaningless rather than reporting a bad placement: a
    duplicate world id (`worldIdReused`) and a world declared with no preset
    theme (`worldUnthemed`).

    **Parks that predate the world layer score 0 on this axis** — `declared: 0`
    → all four tests 0, including coherence (awarding the coherence points
    "because nothing is wrong" would pay a park for having no worlds). That is
    the intended reading, not a bug; see the axis-16 calibration table.

**Grand total = sum of the 16 axes (max 100).** Sanity-check
`consoleSummary.validatorLine` (`ok: true` expected) and
`consoleSummary.pageErrors`: **a genuine render/page failure caps the total at 40.**

**THE CAP FIRES ON A PARK THAT FAILED TO RENDER, AND ON NOTHING ELSE (narrowed
2026-07-26).** It used to be applied off `consoleSummary.errors`, which probe.mjs
filled with `^\[(pageerror|error)\]` — **any** `console.error`. Those are not the
same set. Measured on `r16a`: **ten "errors", zero page errors** — eight
`[error] [plan] FATAL …` lines from `buildParkNet`'s degrade path (which SETUP.md
§0-P.5 describes as *"those DEGRADE and record a plan lint by design"*, i.e. the
mechanism that stops a bad plan taking the page at all) plus two
`[error] [Coaster] … FATAL track`. The park rendered completely, the gate spoke,
and **every one of the ten was already charged on its own axis** —
`latticeInWater` → 2, `padOnStreet` → 3, the fatal coasters → 14. The cap charged
them a second time and pinned a 56.55 at 40, which is exactly the double-charge
the cross-axis rule below forbids. `probe.mjs` now SPLITS the classes at capture:

| field | shape | capped? |
|---|---|---|
| `consoleSummary.pageErrors` | `[pageerror] …`; `[error] JSHandle@error` (react-dom 18.3.1 production's `logCapturedError` does a **bare** `console.error(err)` for an uncaught render with no boundary — the only marker on the parks that rendered nothing); `[error] Uncaught…` | **YES** |
| `consoleSummary.componentErrors` | `[error] [plan]`, `[error] [Coaster]`, `[error] [TrackRide:coaster]`, `[error] [<ParkName>]` — the design system reporting a defect it SURVIVED | no — charged on its own axis |
| `consoleSummary.unclassifiedErrors` | anything else | neither: reported **unmeasured**, so the verdict is never guessed |

`consoleSummary.errors` is still published as the union of all three, so nothing
that reads it breaks — but it is no longer what the cap reads.

**DO NOT SCORE THIS BY HAND — THE WHOLE RUBRIC IS EXECUTABLE (2026-07-26).**
`node score-park.mjs <park>` reads `shots/<park>/probe.json`, applies all 16
axes and writes `shots/<park>/score.json` with a per-axis
`{ axis, name, weight, score, max, inputs, reason }` — `inputs` records the
probe fields actually read and `reason` names the threshold that decided the
score. `eval.mjs` runs it automatically at the end of a pass. It reuses
`scoreLayout` for axis 15 and the embedded `probe.worlds.score` for axis 16, and
parses the weights table above rather than re-declaring the weights.

**A MISSING INPUT IS `unmeasured`, NEVER A PASS AND NEVER A ZERO.** If an axis's
input is absent (or `null`, which is what `probe.mjs` writes when a measurement
could not be obtained) the axis reports `unmeasured`, its weight LEAVES the
denominator, the total is printed as `X / Y MEASURED ***INCOMPLETE***`, and the
process exits non-zero. A park with any unmeasured axis **has no /100 score at
all** — do not quote a pro-rated one. `score-park.selftest.mjs` is the mutation
suite that proves the scorer takes points off; the ambiguities the scorer had to
resolve to be executable are listed in its `AMBIGUITIES` export and copied into
every `score.json`, so the reading is auditable rather than invisible.

---


## Where the measurement data went

Two sections were split out because they are **volatile** — they are rewritten
whenever the corpus is re-measured, while everything above is a stable
definition. Welded together, a single re-measurement rewrote all 74.6 KB.

- **`RUBRIC-baseline.md`** — the reference-park baseline table (was 22% of this file)
- **`RUBRIC-calibration.md`** — calibration for axis 15 (layout) and axis 16 (WORLDS)

Read them only when you need the numbers. `check-weights.mjs` parses the weights
table in THIS file and is unaffected.


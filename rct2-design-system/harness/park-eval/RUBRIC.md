# Park scoring rubric (1–100)

Score an arbitrary mp3d park from the 7 screenshots in `shots/<name>/` +
`probe.json` + `console.log`. **Fifteen weighted axes summing to 100**
(weights table below).

## Pipeline

```sh
node rct2-design-system/harness/park-eval/eval.mjs      <parkFile.tsx> [--name=X] [--wait=ms]  # 7 PNGs + console.log
node rct2-design-system/harness/park-eval/probe.mjs     <parkFile.tsx> [--name=X] [--wait=ms]  # probe.json (also stdout)
node rct2-design-system/harness/park-eval/calibrate.mjs [--save] [--matrix]                    # axis 15 over the corpus
```

Required import shape for park files: design-system imports must name the
component folder — any of `'./components/Park'`, `'../components/Torch'`,
`'components/Kit'`, `'@mp3d/components/ParkBuilder'`, or bare `'../FerrisWheel'`
(the preprocessor rewrites all of these to the local repo). `react`/`three`
stay bare. The park component must be the **default export** or an exported
uppercase function (one matching `/park/i` wins).

Shots: `01–04` overviews at azimuth 45/135/225/315 (34° elev), `05` top-down
(81°), `06` ground level (8°), `07` night at the main angle.

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

Parks not composed via `<Park>` degrade to raw scene stats (see `notes`).

## Weights table — 15 axes, total 100

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
| 11 | Creativity                    | 8      |
| 12 | Accessibility                 | **10** |
| 13 | Ride roster                   | 7      |
| 14 | Thrill                        | 8      |
| 15 | Layout uniqueness             | 7      |
|    | **Total**                     | **100**|

Arithmetic: 5+8+8+7+4+4+9+6+5+4 = **60**; 8+10+7+8+7 = **40**;
60 + 40 = **100**. ✓

Cleanliness (8→5), Food stalls (5→4), Park entrance (5→4), Trees (5→4) and the
old Ride count (7) were trimmed because every park in the campaign already
maxed them — they no longer discriminate. The freed weight went to the two new
discriminating axes: **Ride roster** (which now measures WHAT was picked, not
how many) and **Layout uniqueness**.

Score each axis 0..weight (halves fine); charge each `validatePark FAIL` 2–5
pts against its matching axis ONCE (don't double-charge a corridor fail on
both spacing and accessibility, or a coaster fail on both spacing and thrill).

## The 15 axes

1. **Cleanliness (5)** — `probe.sim`: `litterCount`/`poopCount`/`vomitCount`
   after the sim smoke run (0 of each = clean), `paths.bins ≥ 1`,
   `restrooms ≥ 1`, `avgHappiness` (~150+ is happy). Full = zero litter, bins
   + restroom present; −1.5/axis item missing, −1 per few litter pieces.
2. **Good use of paths (8)** — shot 05 (top-down) is the primary read: a
   coherent skeleton (loop/ring, no dead stubs, no orphan islands), plus
   `probe.paths` (edges ≥ nodes−1, cycles good; `extentFractionOfPark`
   ~0.2–0.6 healthy; plazas ≥ 1). Grid-lint warnings deduct. This axis is
   path QUALITY; pure reachability is axis 12 and DISTINCTIVENESS is axis 15.
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
4. **Entrance/exit usage (7)** — `probe.entrance.rideAccessNodes`: every ride
   needs `queueNode ≠ -1` AND `exitNode ≠ -1`; `sim.queued`/`riding` > 0
   proves guests use them. −2 per unattached ride.
5. **Food stalls (4)** — no longer a head-count; it is VARIETY and NAMING.
   Read `probe.stallRoster`.

   | pts | test | field |
   |----:|------|-------|
   | 1 | at least 2 registered stalls | `stallRoster.registeredCount ≥ 2` (0 stalls = 0 for the whole axis) |
   | 1.5 | ≥ 3 DISTINCT catalog stall kinds, spanning food AND drink | `stallRoster.distinctKinds ≥ 3` and `stalls[].item` covers both `food` and `drink`. 0.75 for 2 kinds. |
   | 1 | every stall is THEMED, not shipping its catalog default name | `stallRoster.allThemed` (`themedNameCount / registeredCount`). Pro-rate; `defaultNamed` lists the offenders (e.g. a stall still called "Burger Bar"). |
   | 0.5 | placed on traffic (plaza/junction/midway), visible in shot 05 | `stalls[].at` against `layout.openSpace.spaces` + the net |

   The catalog ships **5** stall kinds (`stallRoster.catalogSize`):
   BurgerShop, HotDogStand, SodaStand, CottonCandyStand, BalloonStand.
   `stallRoster.corpusKindFrequency` / `catalogNeverUsed` show which of them the
   campaign has never once reached for.
6. **Park entrance (4)** — `probe.entrance`: `gateMeshes ≥ 1` and
   `attachedToPathNode: true`; gate on the park edge with a path leading in.
   No gate = 0; unattached gate ≤ 1.5.
7. **Terrain normality (9)** — `probe.terrain`: `minH`/`maxH` roughly −3..+3 on
   a size-16 park, `maxSlope` under ~3, `stdH` 0.3–1.0 (dead-flat is dull,
   > 1.5 chaotic); `lint` empty. No spikes, no floating/buried structures.
8. **Water usage (6)** — `probe.water.terrainWater`: `bodyCount ≥ 1` required
   (0 = ≤ 2 pts); LESS is better beyond that — `fractionOfPark` ≈ 0.03–0.12
   ideal, −1 per ~0.05 above 0.15. Decorative water is a plus.
9. **Scenery decoration (5)** — `probe.scenery` + `composables` + night
   dressing in shot 07. ~1 piece per 25 u² of pathed area is lively. Bare
   plazas ≤ 2. (Quantity here; VARIETY on axis 11, LANDMARK variety on 15.)
10. **Trees / natural mountains (4)** — `probe.trees.count` (≥ 4 on size 16,
    mixed `byShape` better) spread across the map; `terrain.peaks ≥ 1`.
    Treeless + flat = ≤ 1.5.
11. **Creativity (8)** — themed ride names (`probe.rideNames`), scenery
    variety/flavour (`probe.sceneryVariety.varietyIndex` ≥ 6 rich, ≤ 2
    monotone), and cohesive per-zone theming in shots 01–05.
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
    | 1.5 | **distinct KINDS** — no duplicate-kind padding | `rideRoster.distinctKinds` vs `registeredCount`: all distinct = 1.5, one duplicate = 1, two+ = 0.5. |
    | 1.5 | **category BALANCE** — ≥ 3 of the 5 RCT2 groups (gentle / thrill / water / transport / dark) | `rideRoster.categoryCount` (`categoriesRepresented`): 4–5 = 1.5, 3 = 1, 2 = 0.5, 1 = 0. |
    | 1 | **speciality** — at least one TRACKED / water / transport / dark ride BESIDES the coaster | `rideRoster.hasSpeciality` / `specialityKinds` (LogFlume, RiverRapids, PaddleBoats, Monorail, Chairlift, MagneticRide, GhostTrain, HauntedMansion, Bobsleigh, GoKarts, MotionSimulator, Helicycles, ObservationTower, MineTrainCoaster, TrackRide). Five flat rides + one coaster = 0. |
    | 1 | **selection NOVELTY** — the kind set differs from every prior park | `rideRoster.novelty.distance` (Jaccard over `rideKinds` vs `signatures/`): ≥ 0.4 = 1, 0.25–0.4 = 0.5, < 0.25 = 0 (a re-run). `novelty.nearest` names the park it copies. |

    The catalog ships **31** registerable ride kinds (`rideRoster.catalogSize`,
    enumerated live from `components/` by `catalog.mjs` — anything new shows up
    under `unclassifiedKinds` instead of scoring silently).
    `rideRoster.corpusKindFrequency` and `catalogNeverUsed` are the campaign
    frequency table: the kinds no park has EVER used.
14. **Thrill (8)** — does the park actually give guests a RIDE? Scored
    relative to the park's DECLARED type (thrill vs family; when ambiguous
    score as family). Evidence in `probe.coasters[]` + `probe.thrill`.

    | pts | test | read it off probe.json |
    |----:|------|------------------------|
    | 3 | **flagship excitement** ≥ 6.0 thrill / ≥ 5.0 family | `thrill.flagshipExcitement`. Pro-rate: full at target, 1.5 at ~60%, 0 below ~25%. |
    | 2 | **force envelope** — peak positive vertical G ≥ 2.5 g thrill / ≥ 1.8 g family AND lateral G under the 1.27 g margin | `thrill.peakPosVertG` vs `thrill.lateralSafe`/`worstLateralG`. **Score 0** if `thrill.coasterGateOk` is false or `fatalCoasters > 0`. 1 pt if only one test passes. |
    | 1 | **highest drop** ≥ 2.0 u thrill / ≥ 1.2 family with a credible top speed | `thrill.bestHighestDrop` + `coasters[].maxSpeed` (a 2 u drop should read ≳ 6 u/s). Half for the drop without the speed. |
    | 1 | **airtime** | `thrill.bestAirtimeSeconds > 0` and/or `bestNegVertG ≤ −0.1`; ≥ 0.2 s reads as sustained. |
    | 1 | **park thrill MIX** — gentle + moderate + intense all present | `thrill.mixComplete`. Half for two of three. |

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

    | pts | test | fields + numeric thresholds |
    |----:|------|-----------------------------|
    | 1.5 | **not a lattice** | `layout.gridRegularity`: ≤ **0.55** → full 1.5; ≥ **0.75** → **0**; linear between. |
    | 0.75 | **block-size variety** | `layout.edgeLengths.effectiveClasses` ≥ **3** → 0.75; ≥ 2 → 0.375; else 0. |
    | 0.75 | **block irregularity** | `layout.lattice.latticeNodeShare` ≤ **0.5** OR `layout.edgeBearings.obliqueEdgeFraction` ≥ **0.15** → 0.75; `latticeNodeShare` ≤ 0.7 OR `layout.curves.hasCurveOrDiagonal` → 0.375; else 0. |
    | 1 | **districts separated** | `layout.districts.count` ≥ **2** AND `maxSeparation` ≥ `separationTarget` (= **20 u** at size 48, scaled `20·size/48`) → 1; ≥ 2 clusters but too close → 0.5; 1 cluster → 0. Clusters are single-link over registered ride positions at cut = **0.25·size** (12 u at 48). |
    | 1 | **plot actually used** | `layout.plot.plotUtilisation` ≥ **0.7** → 1; ≥ **0.45** → 0.5; else 0. It is `0.4·min(1, pathExtentFraction/0.55) + 0.3·min(1, occupancyFraction/0.35) + 0.3·quadrantSpread`, where `occupancyFraction` is the share of an 8×8 grid over the plot holding any feature and `quadrantSpread = (1 − maxQuadrantShare)/0.75`. **This is where "everything huddled in one quadrant" loses.** |
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

**Grand total = sum of the 15 axes (max 100).** Sanity-check
`consoleSummary.validatorLine` (`ok: true` expected) and `errors`:
`[pageerror]`/render errors cap the total at 40.

---

## Calibration — axis 15 across the corpus

`node calibrate.mjs` (pure node, no browser). `grid` = `gridRegularity`,
`effL` = effective edge-length classes, `obl%` = non-cardinal edges,
`dist`/`sep` = district count / max separation, `plot` = `plotUtilisation`,
`open`/`sprd` = open-space count / area spread, `novl` = nearest-signature
distance.

| park | grid | effL | obl% | dist | sep | plot | open | sprd | novl | **score** |
|------|-----:|-----:|-----:|-----:|----:|-----:|-----:|-----:|-----:|----------:|
| ctrl-organic  | 0.131 | 4.12 | 90 | 2 | 32.7 | 0.884 | 3 | 6.25 | 0.281 | **7.0** |
| ctrl-setpiece | 0.656 | 3.88 |  0 | 3 | 40.8 | 0.882 | 2 | 1.50 | 0.201 | **5.71** |
| arch-ref      | 0.655 | 2.80 |  0 | 1 |  0.0 | 0.830 | 1 | 1.00 | 0.132 | **4.09** |
| **cinder-peak** (LIVE probe) | **0.774** | **2.07** | **0** | 2 | 13.2 | 0.982 | 1 | 1.00 | 0.111 | **3.13** |
| ctrl-lattice  | 1.000 | 1.00 |  0 | 6 | 42.4 | 0.882 | 1 | 1.00 | 0.091 | **3.25** |
| ctrl-huddle   | 1.000 | 1.00 |  0 | 1 |  0.0 | 0.150 | 1 | 1.00 | 0.177 | **1.0** |

Both failure modes are caught at opposite ends: the monotonous lattice
(cinder-peak, ctrl-lattice) scores **0/3** on the anti-lattice points, and the
one-quadrant huddle (ctrl-huddle, round 6's failure) scores **0/2** on
districts/plot AND 0/3 on anti-lattice. The set-piece park and the organic park
— the two that read well by eye in shot 05 — score 5.71 and 7.

**Cinder Peak, axis 15 = 3.13/7** (live probe, `shots/cinder-peak/probe.json`,
`notes: []`):

| part | score | the numbers |
|------|------:|-------------|
| anti-lattice | **0.38 / 3** | `gridRegularity` **0.774** ≥ 0.75 → **0/1.5**; terms: `axisAligned` **1.0** (every street edge cardinal), `lengthUniformity` 0.483, `bearingUniformity` **1.0** (only the 2 cardinal bearings), `latticeNodeShare` **0.951**, `pitchUniformity` 0.417. `effectiveClasses` **2.07** → lengthVariety 0.38/0.75. `latticeNodeShare` 0.951 > 0.7 and `obliqueEdgeFraction` **0** → blockIrregularity **0/0.75**. |
| districts | 1.5 / 2 | 2 clusters but `maxSeparation` **13.2** < target **20** → 0.5/1; `plotUtilisation` 0.982 → 1/1 (a full lattice genuinely does cover the plot — its badness is charged on the anti-lattice points, by design). |
| open space | 0.25 / 1 | ONE plaza, 12.96 u² (3.6 × 3.6), `areaSpread` 1.0. |
| novelty | 1 / 1 | nearest signature **0.111** — and that nearest neighbour is `ctrl-lattice`, the pure 6 × 6 grid. Any future grid park now fails this point against Cinder Peak itself. |

Street net: 41 street nodes / 61 street edges (58 / 78 including the 17 access
spur nodes), one x-pitch pair `[10.8, 6.0]` and z-pitches `[4.8, 6.0, 7.2]`.

Pairwise signature distances confirm the fingerprint discriminates:

|               | organic | setpiece | lattice | cinder | huddle |
|---------------|--------:|---------:|--------:|-------:|-------:|
| ctrl-organic  |    –    |  0.281   |  0.401  | 0.343  | 0.461  |
| ctrl-setpiece |  0.281  |    –     |  0.221  | 0.201  | 0.237  |
| ctrl-lattice  |  0.401  |  0.221   |    –    | **0.091** | 0.177 |
| cinder-peak   |  0.343  |  0.201   | **0.091** |   –    | 0.193  |
| ctrl-huddle   |  0.461  |  0.237   |  0.177  | 0.193  |   –    |

### Corpus status (2026-07-24)

The `/tmp` harness was wiped by a machine reboot mid-wave: `samples/` (15 park
files), `shots/` and `node_modules` were lost. The corpus behind the novelty
points is currently `cinder-peak` (live probe, reconstructed source) plus four
reference controls (`fixtures.mjs`: `ctrl-lattice`, `ctrl-huddle`,
`ctrl-organic`, `ctrl-setpiece` — the last rebuilt from `setpiece-demo.tsx`'s
plans). Re-seed with `node probe.mjs samples/<park>.tsx` per park as the sample
parks are restored.

**Corpus hygiene:** `signatures/` is additive and keyed by `--name`, and a park
is excluded from its OWN novelty comparison by that name. Always probe a park
under its own name — probing `cinder-peak.tsx --name=live-cp` leaves two
signatures for one park and drives both novelty distances to ~0.

`node usage.mjs` prints the catalog-vs-corpus usage table and the NEVER-USED
lists (axes 13 and 5). It is only as complete as `signatures/`.

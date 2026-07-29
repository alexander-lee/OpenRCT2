# Reference-park baseline table

> **SPLIT OUT OF `RUBRIC.md` — the VOLATILE measurement data.**
>
> These numbers are re-measured against the corpus; the rubric that scores them is not.
> Keeping it welded to the rubric meant every re-measurement rewrote the whole
> 74.6 KB file. The stable half (Pipeline, the weights table, the 16 axis
> DEFINITIONS) lives in `RUBRIC.md` and rarely changes; this file is the part
> that changes when the corpus is re-measured. `check-weights.mjs` parses only
> the weights table, so it is unaffected by this split.

## REFERENCE-PARK BASELINE TABLE (re-measured 2026-07-25)

**This is the ground truth a scoring round is measured against. Every row was
re-probed on this date** (`node probe.mjs samples/<park>.tsx --wait=20000`,
verdicts cross-checked with `node w7-check.mjs`); the previous baselines
predated the 192 → 128 rescale, the two-water-body composition, the stronger
relief and the mandatory exit lane. All eight report `notes: []` and
`validatePark → ok: true` EXCEPT `cinder-peak`, which has regressed (below).

**EVERY ROW NAMES ITS SEED AND ITS `probes` NOW (2026-07-25, second pass).** A
baseline that does not say which seed × climate × size it was measured on cannot
tell a real regression from a re-composed landform, which is how the seed-7
scare below stayed invisible. `probes` is `comp.report.probesTried`:
`un` = UNGUARDED at **this park's own size** (NOT the §1 table's 128 row —
`probes` is SIZE-dependent), `gd` = under this park's REAL `<Terrain>`
guards, `mv` = how many of 12 realistic one-cell `keepDry` edits MOVE the
landform identity (terrainSeed / archetype / water centroid). `mv 0/12` is the
column that actually means "guard-stable"; a high `un` does not. All three are
regenerated per park by **`node probe-guard-stability.mjs samples/<park>.tsx`**
(add `--seeds=`/`--climates=` to shop for a better row before you re-seed) —
hand-maintaining this column is what let the scare below go unmeasured.
`gd 64` = every candidate × every terrain-noise seed was tried, so no candidate
satisfies the guard list outright and the guard CLAMP finishes the job
(`clamps` = `clampPeaks`+`clampBasins`) — legal, deterministic, and still
`mv 0/12`.

| park | size | seed × climate | `probes` un / gd (clamps) | `mv` | verdict | lints (kind × n) | gate warnings | draws | tris | ax15 | ax16 |
|------|-----:|---------|---|---|---------|------------------|---------------|------:|-----:|-----:|-----:|
| `demo-ref` | 16 | **7** temperate | **1** / 64 (1) | 0/12 | ok, 0 fail | `pathLevelMedian` ×1, `laneTrim` ×1 | – | 2 417 | 394 110 | 3.60 | 0 |
| `district-ref` | 48 | **7** temperate | **1** / 64 (10) | 0/12 | ok, 0 fail | `pathLevelMedian` ×1, `laneTrim` ×1 | – | 3 280 | 591 478 | 6.75 | 0 |
| `setpiece-ref` | 48 | **7** temperate | **1** / **1** (0) | 0/12 | ok, 0 fail | `pathLevelMedian` ×1 | – | 2 925 | 517 638 | 4.02 | 0 |
| `arch-ref` | 48 | **7** temperate | **1** / 64 (9) | 0/12 | ok, 0 fail | `pathLevelMedian` ×1, `laneTrim` ×1 | – | 2 547 | 544 570 | 4.09 | 0 |
| `arch-ref-legacy` | 48 | **5** alpine | **1** / 64 (11) | 0/12 | ok, 0 fail | `laneTrim` ×1 | – | 2 530 | 545 170 | 3.09 | 0 |
| `seedcheck-s1-192` | 192 | **1** temperate | **17** / **17** (0) | 0/12 | ok, 0 fail | `pathLevelMedian` ×1 | `deadStreetNode` ×1 | 2 875 | 1 056 478 | 4.78 | 0 |
| `worlds-ref` | 128 | **7** → `climateOf(7)` = desert | **1** / 64 (237) | 0/12 | ok, 0 fail | `pathLevelMedian` ×1, `pathClipping` ×1 | – | 4 423 | 814 070 | 5.11 | **5.0** |
| `cinder-peak` | 48 | **7** temperate | **1** / 64 (12) | 0/12 | **ok: FALSE, 40 failures** (REGRESSION FIXTURE — not re-run, not re-seeded) | `pathLevelMedian` ×1, `latticeInWater` ×4, `queueAnchorIsHead` ×5, `padOnStreet` ×5, `plantedInWater` ×1 | `deadStreetNode` ×1 | 3 652 | 627 750 | 2.63 | 0 |

**NOTHING WAS RE-SEEDED, AND THE MEASUREMENTS ARE WHY.** The corpus was audited
on 2026-07-25 against the claim that four samples sit on the fragile
`seed 7 temperate probes 18` row. They do not:

* `probes` is **SIZE-dependent**. `seed 7 temperate` is `probes 18` **at size
  128** and `probes 1` at 48 and at 16. `arch-ref`, `setpiece-ref`,
  `district-ref` and `cinder-peak` are all size-**48** parks, and `demo-ref` is
  16 — none of them is on the 128 row.
* `worlds-ref` passes **no `climate`**, so it composes `climateOf(7)` =
  **desert**, which is `probes 1` at 128 (`steppe`, corner lake (36.9, 30.2)).
  Neither the `probes 18` temperate figure nor §1's `probes 7` seed-7 COASTAL
  row is this park's row. Any future seed change here MUST also pass `climate`
  explicitly, or the climate re-rolls with the seed.
* **A high `probes` is not the same thing as guard fragility.**
  `seedcheck-s1-192` is `probes 17`, but its GUARDED probe is also 17 and lands
  on the SAME landform (plains, terrainSeed 16) with 0 clamp discs: the
  rejections are the composition's own water/relief rules, not the guard list.
  Every park in the corpus measures `mv 0/12`.
* Re-seeding would have been a strict downgrade in the cases checked:
  `setpiece-ref` on seed 7 is the cleanest composition in the corpus
  (`gd 1`, 0 clamps) against `gd 35` on 31 temperate and `gd 2` on 83;
  `arch-ref-legacy` on 17 alpine leaves a residual violation under its exact
  guard list. Every alternative also moves the water these files are
  hand-planned against.
* The 2026-07-25 `worlds-ref`/`district-ref` red/green flicker was therefore
  NOT terrain. `parkComposition` is a pure function of (seed, size, climate,
  guards) and re-measured bit-identically; the flicker is the harness settle
  window (`lib.mjs`'s rAF-stall note + the multi-park-per-process flake) —
  **run reference parks ONE PER PROCESS with a generous `W7_WAIT`**.

Verdicts above were re-verified one park per process on 2026-07-25
(`W7_WAIT=25000` at ≤48, 90 s at 128, 400 s at 192). `draws`, `tris`, `ax15`
and `ax16` are carried over from the same day's `probe.mjs` runs — only header
comments changed in the samples, so no geometry moved.

**LINT DRIFT SINCE THE FIRST PASS THIS DAY, and it is not seed-related:**
`demo-ref`, `district-ref` and `seedcheck-s1-192` each gained a non-fatal
`pathLevelMedian`, `setpiece-ref` went from clean to one `pathLevelMedian`, and
`worlds-ref` gained a `pathClipping`. All five remain `ok: true` with 0
failures, and `cinder-peak`'s composition is unchanged (`1` / `64`, `mv 0/12`)
— its 40 failures are the water-vs-`keepDry` regression already reported below,
not a seed. These
appeared while `mp3d/ParkBuilder` terrain-floor work (the `terrainFlattened`
gate) was landing, on unchanged park geometry — record them as the new
baseline, and blame path levelling, not the seeds.

Per-axis inputs, same runs:

| park | stdH | maxSlope (0.6 u) | peaks | water bodies | water % | rides / distinct / cats | speciality | stalls / distinct | orphans | exit lanes (u) |
|------|-----:|-----------------:|------:|-------------:|--------:|------------------------|------------|------------------:|--------:|----------------|
| `demo-ref` | 0.33 | 2.46 | 5 | 1 (want 1) | 4% | 2 / 2 / 2 | – | 1 / 1 | 0 | 1.93, 4.70 |
| `district-ref` | 0.38 | 1.82 | 7 | 1 (want 1) | 3% | 4 / 4 / 2 | – | 3 / 3 | 0 | 3.69, 2.50, 3.69, 3.69 |
| `setpiece-ref` | 0.70 | 2.21 | 7 | 1 (want 1) | 11% | 2 / 2 / 1 | – | 3 / 3 | 0 | 3.98, 4.07 |
| `arch-ref` | 0.51 | 1.82 | 7 | 1 (want 1) | 3% | 3 / 3 / 2 | – | 2 / 2 | 0 | 3.69, 2.87, 4.01 |
| `arch-ref-legacy` | 0.61 | 4.92 | 7 | 1 (want 1) | 3% | 3 / 3 / 2 | – | 2 / 2 | 0 | 3.69, 2.87, 4.01 |
| `seedcheck-s1-192` | 0.97 | 0.99 | 12 | 2 (want 2) | 10% | 5 / 5 / 2 | – | 3 / 3 | 0 | 5.93, 7.05, 3.69, 5.93, 5.93 |
| `worlds-ref` | 1.67 | 4.48 | 9 | 2 (want 2, raw 3) | 2% | 4 / 6 / **3** | `MoonlitBarge` | 12 / 8 | 0 | 9.37, 5.93, 8.17, 4.89 |
| `cinder-peak` | 0.37 | 2.74 | 7 | 1 (want 1) | 3% | 6 / 6 / 2 | – | 3 / 3 | **2** | 3.69, 7.05, 1.05, 5.93, 1.05, 5.93 |

Notes a scorer needs off this table:

* **`arch-ref` carries 2 lints, not the 3 this document claimed.** Two causes,
  both intended: the RCT2 exit-lane work (validate.ts check a4) means the
  chassis now DERIVES the exit hut instead of relocating a hand-placed one, and
  `samples/arch-ref.tsx` was updated to drop its explicit `exit`/`exitDir` from
  the §4.0-A coaster and let the chassis place it. What remains is
  `pathLevelMedian` + `laneTrim`. This is not a regression.
* **`worlds-ref` is NOT mid-edit and its axis-16 row is exact.** Re-probed at
  13:53 against `samples/worlds-ref.tsx` as last written (13:13): 3 declared /
  3 built presets (pulse, brasswork, thornwick), `crossTheme: []`, world-centre
  separations 54.37 / 55.28 / 87.10 against the 32.66 floor — **axis 16 = 5.0**,
  byte-for-byte what the axis-16 calibration table says.
* **`worlds-ref`'s roster changed because the CATALOG TABLE was fixed, not the
  park**: it now reads 3 categories and `hasSpeciality: true` where it used to
  read 1 and false (see axis 13).
* `arch-ref-legacy` is `alpine`, and its `maxSlope` **4.92** on the fixed pitch
  is the highest of any ≤48 park — a deep alpine basin (`minH` −7.26), with an
  EMPTY `terrain.lint`. Judge it as terrain, not as a defect.
* `demo-ref` is the only park in the corpus whose stalls are not all themed
  (`allThemed: false`), and the only one that catches guests mid-ride at probe
  time (`queued: 2, riding: 2`). Every other park reads `queued: 0, riding: 0`
  with 34–66 active guests and `avgHappiness` 232.7–235.6 — see axis 4.

### `cinder-peak` HAS REGRESSED — a DESIGN-SYSTEM issue, reported not fixed

`cinder-peak` used to be the clean live-probe calibration row. It now reports
**`validatePark → ok: false` with 40 failures** (`blockers` ×16, `autofix` ×10,
`scenery` ×7, `footprints` ×7) and 2 orphan path islands. The head of the chain
is `latticeInWater` ×4: **the composed water body has MOVED under a park whose
`<Paths>` lattice and `keepDry` list were hand-authored against the older
composition**, e.g. *"`<Paths>` edge 8 (4→5) crosses WATER — ground −0.91 near
[8.5, 15.6] is below waterline+0.05"*. Four spans were refused, which stranded
two path islands, which is what left five queue anchors on heads and five pads
on streets. **Nothing in the harness caused this and nothing here can fix it**:
either the park source needs re-planning against the current composition
(re-read `usePark().terrain.water` / `park.isDry(cell)` AFTER composition, as
the lint itself says), or the composition's size-48 water placement changed in a
way the design system should look at. Until then `cinder-peak` is a REGRESSION
FIXTURE, not a reference park — its numbers stay in the tables above so the next
reader can see the delta, and it must not be used as a clean baseline.

### Corpus status (2026-07-25, post wave-12 de-duplication)

`signatures/` holds **19 parks**: `arch-ref`, `briarwood`, `cinder-peak`,
`coolpark`, `coolpark-a`, `coolpark-b`, `demo-ref`, `district-ref`,
`hollowmere2`, `monorail-ref`, `seedcheck-s1-192`, `setpiece-ref`,
`stormhollow`, `voltmoor`, `worlds-ref` plus the four synthetic controls
(`fixtures.mjs`: `ctrl-lattice`, `ctrl-huddle`, `ctrl-organic`,
`ctrl-setpiece`). Re-seed a stale one with `node probe.mjs samples/<park>.tsx`.

**DE-DUPLICATION POLICY (wave-12 P0).** `signatures/` had grown to **54
entries** — one real park per distinct source file, plus **35 near-identical
scratch copies** accumulated across four testing waves (`w11-*`, `w11b-*`,
`w11c-*`, `w11e-*`, `w11f-*` name prefixes, and one `-diag` tag), all pointing
at the SAME `samples/*.tsx` files as an existing canonical entry:
`worlds-ref` alone had five copies (`worlds-ref` + `w11-worlds-ref` +
`w11b-worlds-ref` + `w11c-worlds-ref` + `w11f-worlds-ref`), all four
`w11*-arch-ref-legacy` copies existed despite `arch-ref-legacy.json` being
**deliberately absent** by policy (see below), and `voltmoor`/`hollowmere2`
each measured their OWN novelty against a scratch clone of themselves
(distance ~0.01-0.02) instead of against the rest of the corpus. Round 11's
park measured `layout.novelty.distance 0.053` against the 0.08 floor with all
three `nearestThree` entries the SAME park at an identical distance — the
scratch clones made the axis unwinnable by faking neighbour diversity.

**THE POLICY, decided and now enforced:**
1. **One signature per distinct park.** Identity is the resolved `park`
   source-file path (`corpus.mjs`), never the `name` a `--name=` flag happened
   to use — two files with different names but the same `park` are the SAME
   entry.
2. **Prefer the newest VERIFIED run** when more than one exists for a source
   file, unless a canonical (non-scratch-tagged) name already exists for it —
   the canonical name wins regardless of timestamp, because it is the
   intentional identity, not an accident of when someone last re-probed it.
3. **Drop scratch/experiment tags** — any `name` carrying a wave-testing
   prefix (`w11`, `w11b`, `w11c`, `w11e`, `w11f`, …) or a `-pre` / `-diag` /
   `-check` suffix is scratch data, not a corpus entry, even when (as with
   `meadowmere-diag`) there is no canonical counterpart to de-duplicate
   against.
4. **A reference park never appears more than once**, including under an
   abbreviated alias (`hollowmere2` vs `w11f-hm2` are the same park).
5. **An ALTERNATE-SEED TWIN is still a duplicate for novelty purposes:**
   `arch-ref-legacy` is `arch-ref`'s street net at a different seed, so their
   signatures are identical and keeping both zeroes the novelty point for
   BOTH — `signatures/arch-ref-legacy.json` stays deliberately absent.

**THE WRITER NOW ENFORCES #1 MECHANICALLY** (`corpus.mjs: saveSignature`):
before writing, it scans `signatures/` for an existing entry whose `park`
already matches, and if one exists it OVERWRITES that file in place (under
its established name) instead of creating a new one under whatever `--name`
was passed, logging that it did so. Probing `cinder-peak.tsx --name=live-cp`
now refreshes `cinder-peak.json`, not a second file — the corpus can no
longer re-pollute itself the way it did across wave 11.

**AND #1's CONVERSE, SINCE 2026-07-27** (`corpus.mjs: signatureConflict` /
`shotsConflict`): the rule above only fires when the PARK already has an entry.
When it does not, `--name` used to decide the filename unopposed — so
`probe.mjs samples/zzbase-a.tsx --name=skeleton-a` wrote a throwaway baseline
copy's numbers into `skeleton-a`'s corpus entry and over
`shots/skeleton-a/probe.json`, destroying the real measurement. `probe.mjs` now
REFUSES, before bundling, when `--name` would write over a measurement whose
recorded source is a different file, and `node corpus.mjs --audit` reports any
entry already in that state. `--reassign-signature` / `--reassign-shots` are the
deliberate opt-outs, and a reassigned entry is stamped `reassignedFrom`. This is
what makes rule 3 (drop scratch tags) enforceable rather than a convention: a
`zzbase*` / `_scratch*` / `*-diag` source in `signatures/` is now an audit ERROR.

**Measured before/after (2026-07-25, `layout.mjs`'s `sigDistance`, corpus
excludes the probed park itself):**

| park | before (54-entry corpus) | after (19-entry corpus) |
|---|---|---|
| `voltmoor` | `0.018`, nearest **`w11-voltmoor`** (its own scratch clone) | `0.094`, nearest `hollowmere2` — a REAL neighbour |
| `hollowmere2` | `0.008`, nearest **`w11f-hm2`** (its own scratch clone) | `0.067`, nearest `coolpark-a` |
| `coolpark-a` | `0.06`, nearest `w11f-hm2`; `nearestThree` included two identical `worlds-ref` clones | `0.063`, nearest `worlds-ref`; `nearestThree` is three genuinely distinct parks |
| `briarwood` | `0.042`, `nearestThree` had `seedcheck-s1-192` tied with two of its own scratch clones at the identical distance | `0.042` (unchanged nearest), `nearestThree` now three distinct parks |
| `coolpark-b` | `0.086`, nearest `monorail-ref` (never polluted) | `0.086` — unaffected, confirming the fix only touches contaminated comparisons |

`voltmoor` and `hollowmere2` were the worst-hit: comparing a park against ITS
OWN clone scored axis 15's novelty point at **0** (below the 0.04 floor)
before the cleanup, and **1.0** / **0.5** respectively after — the corpus
pollution was not a cosmetic problem, it was silently failing the novelty
point for any park whose scratch twin outranked its real neighbours.

`node usage.mjs` prints the catalog-vs-corpus usage table and the NEVER-USED
lists (axes 13 and 5); re-run it after any corpus change, since the table
below predates this cleanup.

### Calibration — the COASTER / CIRCUIT ROSTER (measured 2026-07-26)

`node probe-tracked-roster.mjs`. This is the measurement that produced axis
14's roster term and axis 13's graded circuit row, and it is the reason both
existed as single-flagship tests until now.

**COASTERS PER PARK, off `probe.thrill` (20 probed parks):**

| coasters registered | parks |
|---:|---|
| 0 | 3 — `seedcheck-s1-192`, `setpiece-ref`, `worlds-ref` |
| **1** | **16** |
| 2 | 1 — `hollowmere2` |

**Re-measured the same day against the corpus as it then stood at 27 parks
(three w18 parks added mid-session): `0: 3 · 1: 19 · 2: 1`.** The three new parks
each shipped one coaster, so the finding got stronger, not weaker — `hollowmere2`
is still the only park in the campaign with two. **Every figure in this section is
stamped with its corpus size on purpose; re-run `probe-tracked-roster.mjs` rather
than trusting the counts.** Preset frequency moved too — at corpus 27 it reads
`brasswork 9 · thornwick 8 · pulse 8 · emberfall 5 · tidewater 2`, median 8, and
`tidewater` + `emberfall` are STILL the two under-used presets, which is why axis
16 reads the split off `probe.worlds.presetUsage` instead of a literal list.

`ratedCount` (a coaster `rateCoaster` actually measured) is 1 in 14 parks, 2 in
one, 0 in five. And the flagship figures cluster on two values because everybody
copies the same two shelves: **`E 6.06` in 10 parks (§4.0-A mounted), `E 5.27`
in 4 (§4.0-B), `E 0.63` in one legacy park. `inversions` is 0 in ALL 15 rated
parks — §4.0-C has never shipped.**

**CIRCUITS vs FLAT RIDES, registered, at size 128 (13 parks):** circuit count
distribution `1:3 · 2:3 · 3:2 · 4:2 · 5:2 · 7:1`, median **4**, max **8**
(`r13b`: Coaster + Chairlift + GhostTrain + PaddleBoats + Bobsleigh +
EmberWings + ReefRacer across all five families, `validatePark` clean). Four
parks already clear the "≥ 5 circuits, ≥ 3 families" bar (`r12a`, `r13a`,
`r13b`, `r14a`), so the threshold is one above the corpus median and two below
its maximum — demonstrated, not aspirational.

**MOUNTED FOOTPRINTS, largest instance of each circuit seen in any probe**
(`rides[].bbox`, so dressing included — this is the arithmetic behind "a
multi-circuit park fits"):

| circuit | span X × Z | area | circuit | span X × Z | area |
|---|---|---:|---|---|---:|
| Monorail (Grand Circle) | 86.1 × 86.1 | 7416 u² (a RING — interior free) | Bobsleigh | 8.7 × 11.0 | 95 u² |
| Coaster (§4.0 archetype) | 39.8 × 39.8 | 1586 u² | RiverRapids | 8.8 × 7.1 | 62 u² |
| ReefRacer | 29.6 × 43.4 | 1283 u² | GhostTrain | 4.5 × 8.5 | 39 u² |
| EmberWings | 24.2 × 31.3 | 755 u² | Chairlift | 6.1 × 6.2 | 38 u² |
| LogFlume | 15.6 × 15.0 | 234 u² | PaddleBoats | 5.2 × 5.2 | 27 u² |
| MoonlitBarge | 12.7 × 15.4 | 195 u² | ObservationTower | 2.9 × 2.9 | 8 u² |

For scale, the largest FLAT ride in the corpus is `FlyingSaucers` at 5.7 × 5.7
= 32 u². `r13b` carried **3823 u² of ride bbox — 23 % of a 128 plot — and
passed the gate**, so plot AREA is not what limits a circuit roster.

**WHAT DOES LIMIT IT: `coasterPts` terrain pre-capping, not geometry.** A
`<Coaster>` in `pieces` mode must feed `<Terrain coasterPts>`, and that caps
every peak the circuit passes over — which pushes the composed relief toward
`terrainFlattened` (FATAL when kept < 0.70 **and** stdH < 0.76). Nine candidate
second-circuit placements were measured on `samples/skeleton-b.tsx` through
`probe-skeleton.mjs`; **three were FATAL and two moved a water body 25–77 u
(`waterRePicked`, also FATAL)**:

| second §4.0 circuit @ start | relief kept (floor 0.70) | stdH | water centroid moved | verdict |
|---|---:|---:|---|---|
| *(baseline — flagship only)* | 0.73 | 0.72 | 0 / 0 | — |
| **A @ [−2.4, −38.4]** | **0.73** | 0.72 | 0 / 0 | **clean — published slot** |
| **C @ [−2.4, −38.4]** | **0.73** | 0.72 | 0 / 0 | **clean — published slot** |
| B @ [−1.2, −33.6] | 0.72 | 0.72 | 0 / 0 | clean |
| B @ [33.6, 28.8] | 0.73 | 0.72 | 0 / 0 | clean geometry, but sits on skeleton-b's Chairlift pad |
| C @ [33.6, 31.2] | 0.72 | 0.72 | 0 / 0 | clean |
| B @ [−2.4, 30.0] | 0.70 | 0.70 | **secondary 24.98 u** | REJECT (`waterRePicked`) |
| B @ [−1.2, 31.2] | 0.73 | 0.73 | **secondary 24.98 u** | REJECT (`waterRePicked`) |
| B @ [33.6, −36.0] | 0.90 | 0.81 | **77.26 / 64.06 u** | REJECT (+ 4 hard cells in composed water) |
| B @ [33.6, −33.6] | **0.63** | 0.65 | 0 / 0 | REJECT (`terrainFlattened`) |
| B @ [−21.6, 21.6] | **0.61** | 0.64 | 0 / 0 | REJECT (`terrainFlattened`) |

THREE §4.0 circuits (flagship + B @ [−1.2, −33.6] + B @ [33.6, 28.8]) also
measured clean on this seed — kept 0.72, centroids 0/0, worst span lift 0.53 —
but the relief margin is **0.02**, and it needs two flat rides relocated. So
the rules require **two** coasters and call a third optional. One seed, one
size: this is the strongest claim the offline loop supports.

### Catalog usage — NEVER USED (re-measured 2026-07-26, 24-park corpus)

`node usage.mjs`: **17 of 44 rides** and **0 of 10 stalls** have never shipped.
Every stall is now used; the ride shelf is still half untouched.

| category | never used (24-park corpus) |
|---|---|
| gentle (2) | Helicycles\*, SpaceRings |
| thrill (8) | Bassline\*, GoKarts\*, LaunchedFreefall, LavaTubeRun\*, MineTrainCoaster\*, MotionSimulator\*, SplineCoaster, SwingingInverterShip, WyrmsHollow\* |
| water (3) | DeepDrift\*, MagmaRun\*, OceanTunnelSlide\* |
| transport (1) | MagneticRide\* |
| dark (2) | GearworksExpress\*, HauntedMansion\* |

Cross-referenced against the CIRCUIT classification, **14 of the catalog's 27
circuits have never shipped** — five coaster-family (`Bassline`, `LavaTubeRun`,
`MineTrainCoaster`, `SplineCoaster`, `WyrmsHollow`), three water (`DeepDrift`,
`MagmaRun`, `OceanTunnelSlide`), two transport (`MagneticRide`, `GoKarts`), two
dark (`GearworksExpress`, `HauntedMansion`) and two tower (`Helicycles`,
`MotionSimulator`). **Twelve of them compile their own DEFAULT_PIECES clean and
the other two never call the compiler at all** (`probe-tracked-roster.mjs`), so
the never-used shelf is not a shelf of risky components — it is a shelf of
one-line rides nobody has reached for.

### Catalog usage — NEVER USED (2026-07-25, 14-park corpus, PRE-DEDUPLICATION — superseded by the table above)

The catalog is **44 registerable rides / 10 stalls** and the corpus has never
placed **27 rides** or **2 stalls**. `*` = the TRACKED / water / transport /
dark speciality that earns axis 13's speciality point.

| category | never used |
|---|---|
| gentle (4) | BumperCars, FlyingSaucers, Helicycles\*, SpaceRings |
| thrill (12) | Bassline\*, Bobsleigh\*, EmberWings\*, GoKarts\*, LaunchedFreefall, LavaTubeRun\*, MineTrainCoaster\*, MotionSimulator\*, SplineCoaster, SwingingInverterShip, TopSpin, WyrmsHollow\* |
| water (6) | DeepDrift\*, MagmaRun\*, OceanTunnelSlide\*, PaddleBoats\*, ReefRacer\*, RiverRapids\* |
| transport (2) | Chairlift\*, MagneticRide\* |
| dark (3) | GearworksExpress\*, GhostTrain\*, HauntedMansion\* |
| stalls (2) | EmberRoast, SushiStall |

Used at least once (17 rides): Carousel 10, Coaster 9, FerrisWheel 9,
DropTower 7, Teacups 6, SwingRide 5, LogFlume 3, Enterprise 2, PirateShip 2,
TwistRide 2, and one park each for AetherBalloons, BoilerBurst, Discotron,
Monorail, MoonlitBarge, ObservationTower, TrackRide. Stalls: BurgerShop 11,
SodaStand 10, CottonCandyStand 9, BalloonStand 3, HotDogStand 3, and
worlds-ref alone for GoggleWorks, Honeywitch, NeonSlush.

**The shortlist an author should raid.** Every EMBERFALL and TIDEWATER ride is
unused (`MagmaRun`, `LavaTubeRun`, `EmberWings`; `ReefRacer`, `DeepDrift`,
`OceanTunnelSlide`) because no sample park has built those two worlds — the same
reason `EmberRoast` and `SushiStall` are the only unused stalls. The whole DARK
category is unused. Six of the eight water rides are unused, and water +
transport + dark is where the axis-13 category-balance point is cheapest to
win.


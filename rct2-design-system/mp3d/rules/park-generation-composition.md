# Composing parks — §1 (climate, the seed table, the ring-clearance table)

Part of the recipe book, and the FIRST thing to read after §0: you pin a seed
before you lay a node. `rules/park-generation.md` has the intro, §0.0 and §0.0b;
`-checks.md` + `-checks-b.md` have the 27 pre-flight checks; **`-worlds.md` has
§2-§3; `-skeletons.md` §3.1 + **§3.1-A**; `-tree-skeleton.md` **§3.1-B**;
`-rides.md` §4; `-validation.md` §5-§7.
One document, seven files.

## 1. Pick the park's CLIMATE and composition first

Climate is one word that re-seeds everything downstream — terrain palette,
water story, sand coverage, scenery species and land names:

| climate | water story | ground | scenery | zone flavour |
|---|---|---|---|---|
| `temperate` | one big lake (or lazy river), beach flank | green lawns | rounds + pines, palms at the shore | Main Street / Lakeside Boardwalk / Alpine Frontier / Fairground |
| `desert` | ONE small oasis | sand almost everywhere, dune patches on the flats | palms AT the water only, cactus clusters + rock out on the flats | Oasis Boardwalk / Mesa Frontier / Dune Fairground |
| `alpine` | a small dark tarn, NO beach | darker grass, snow-capped summits, extra rock outcrops | pines everywhere | Tarn Promenade / Summit Frontier / Meadow Fairground |
| `coastal` | the biggest water — a lagoon chain or bay hugging one flank, a WIDE palm beach | lush green | palms + rounds | Boardwalk Bay / Headland Frontier / Seaside Fairground |

`parkComposition(t, seed, size, climate?, guards?)` composes an
RCT2-scenario-style landform under these rules and PROBES terrain-noise
seeds until they hold (climate hashed from the seed when omitted —
`climateOf(seed)`). `guards` is YOUR layout: pass `keepDry` (every world
cell you will pave or place on — street nodes + edge midpoints, pads, huts,
lanes) and `coasterPts` (planned control points `[x, yAboveRef, z]`) so the
probe rejects any terrain seed that would sink, drown or bulge under what
you are about to build, and hill peaks are pre-capped clear of your track:

- **Mostly gentle, buildable terrain** — low amplitude (~0.38), broad scale,
  and a FIRM SHORE (`buildTerrain firmShore: true`): outside the authored
  basins the ground never dips to the water table, so raw noise can never
  pool stray puddles. Relief is AUTHORED, never uniform noise.
- **Seeded MOUNTAIN RANGES, an archetype per seed** (`comp.mountainStyle`):
  `'alpine'` one dominant 4-6-peak ridge, `'rolling'` 2-4 low broad hill
  ranges, `'sentinel'` mostly flat with one steep landmark peak, `'twin'`
  2-3 medium ranges — placed on seeded edge/corner slots, never over the
  water and never burying the forecourt (peaks are capped under the apron,
  under every `keepDry` cell and — `capPeakForCoaster` — under a planned
  track profile). Drama scales with the plot: the default **128**-park earns
  4-9 ranges carrying 9-21 peaks (`landformAmplitudeK` 1.9), a 48-park earns
  2-5 ranges, a 16-park gets proportional hills.
- **ONE dominant water body whose CHARACTER varies per seed**
  (`comp.waterStyle`): a big `'central'` lake, a `'corner'` lagoon hugging a
  beach, a winding `'river'` inlet chain or the classic NE `'flank'` lake —
  flood-filled and enforced: exactly one connected below-waterline region,
  never a scatter of ponds. Candidates are probed in seeded preference order
  and the first whose rules fully hold under YOUR guards wins, so a guarded
  layout is never composed under water.
- **Themed terrain SECTIONS** — `comp.landZones` (`{ kind, center, radius }`:
  sand always adjoining the water, forest discs, one mountain zone per
  range, a representative meadow) + the `comp.zoneAt(x, z)` classifier.
  `tintTerrainForClimate(..., comp)` paints them (cream/gold sand, saturated
  meadow, darker forest floor, grey-brown rock above `comp.treeline`, snow
  above that on alpine) and `dressTerrain(t, comp, heightAt, { obstacles })`
  plants them — forest tree clusters, mountain outcrops + scree, beach
  dunes/palms, meadow loners — deterministically, clear of `keepDry` cells,
  the coaster envelope and your obstacle discs. `<Terrain>` runs BOTH
  automatically; imperative parks call them in step §2.1.
- **A sand/beach flank** adjoining the water on the boardwalk side (climate
  scaled: coastal wide, desert everywhere, alpine none).
- **A FLAT front apron** (relief suppressed ~3 cells deep) with the park gate
  CENTRED on it and the main street aimed straight at the plaza hub.
- **Guards are POST-ENFORCED** — when no probed seed fully satisfies the
  rules, the composition CLAMPS the terrain instead of merely warning:
  blend-radius discs raise every wet guarded cell dry (`clampPeaks`) and
  shave bulges flat under guarded footprints/coaster footings
  (`clampBasins`). `comp.report.violations` reflects the POST-CLAMP ground
  (empty = clean); `report.clampedCells` says how much clamping was needed.
- **WATER-FRACTION GUARD (round-5)** — guard clamping is never allowed to
  starve the park's water below the climate ideal (≥ ~3% of the plot /
  the climate's minimum): wet guarded cells now raise on TIGHT steep-bank
  discs (the berm costs less water than the old wide blend), and when
  filled-back severed lobes still leave the body too small, the composition
  GROWS it back with probed edge basins on its open side — still exactly
  one body, never under your guarded cells, the coaster or the forecourt.
- **AUTO-keepDry (round-5) — your `keepDry` list is a HINT, not a
  requirement.** After every `<Park>` child has mounted, the runtime
  collects EVERY registered footprint from the GameManager — pads, huts,
  queue lanes, EXIT PATHS, stalls, including the derived/trimmed/flipped/auto-shifted
  rigs no static plan could predict — plus the as-built coaster polylines,
  and re-runs the guard clamp over them (`reclampTerrain`): wet samples are
  raised into dry banks, bulges shaved, the body-COUNT and water-fraction
  rules re-enforced, and ground can never bury built rails. `<Terrain>`
  then rebuilds the mesh/colours/heightAt in place before `validatePark`
  reads anything. Still pass an honest `keepDry`: the runtime self-heal
  reads as landscaped berms, but a layout that NEEDED it was mis-planned
  (the `[Park] AUTO-keepDry` console line tells you it fired).
- **GUARD TIGHTLY — A FAT GUARD LIST FLATTENS THE PARK, AND NOW IT IS GATED.**
  `keepDry` and `coasterPts` do not merely *inform* the composer; every guarded
  cell is a place the clamp is allowed to raise or shave, so an over-broad guard
  list quietly irons the landform flat and there was nothing to tell you.
  **Measured: the same seed, climate and size composed `stdH` 1.04 with a tight
  guard list and 0.61 with a loose one** — the second is below every published
  §1 band and below axis 7's `stdH ≥ 0.75` floor, i.e. a dead-flat park scored
  as a defect. A **`terrainFlattened`** gate now catches it. So:
  * list the cells you actually PAVE OR PLACE ON, not the rectangles they sit in;
  * **keep guards OFF the peaks** — a guarded cell on a range shaves the range;
  * where you only need BARE ground rather than FLAT ground, prefer **`noDress`**
    to a `keepDry` entry (it stops the planting without touching the relief).

  **A STREET NODE IS NOT AUTOMATICALLY A `keepDry` CELL, AND NEITHER IS EVERY CELL
  `buildParkNet` PUT IN `NET.keepDry`** (the fuse merges every set-piece and world
  cell in: 22 authored → **552** guards, MEASURED). `KEEP_DRY = [...NODES]`
  is the concrete shape this defect ships in — round 13's park B wrote exactly
  that line, guarded all 29 nodes including the far-corner ones that exist only to
  spread the street bbox, and guarded none of the pads, huts, lanes or prop cells
  it actually placed on. **Guard what you PAVE**, then run §1-W's
  `assertKeepDryOffRow` over the result.

### Seed table — PIN a seed, place around the KNOWN water (regenerated at SIZE 128, TWO bodies, 2026-07)

> **THIS TABLE IS GENERATED AT SIZE 128 — the current `<Park size>` default.
> PINNING ONE OF THESE SEEDS AT A DIFFERENT SIZE GIVES DIFFERENT COORDINATES —
> nothing here transfers.** It was regenerated wholesale in 2026-07 for two
> changes at once:
>
> 1. **THE PLOT SHRANK 192 → 128** (a third off every edge; 44% of the old
>    ground). Every coordinate in the old table moved — `parkComposition` scales
>    the water radii with the plot (`u = S/16`), grows the range/forest/meadow
>    counts with its AREA (`areaK`) and multiplies the landform archetype by
>    `landformAmplitudeK(S)`. The gate cell moved from `z 94.8` to **`z 63.6`**
>    (`1.2·round((64 − 0.8)/1.2)`) on every row.
> 2. **EVERY PARK NOW COMPOSES TWO WATER BODIES, NOT ONE** — see the block
>    below. Each row therefore pins TWO centroids, two boxes and two fractions.
>
> **THE TWO-BODY RULE (this REVERSES the long-standing exactly-ONE rule).** A
> plot of `TWO_WATER_MIN_SIZE` = **64** or more composes a **DOMINANT** body
> plus a **SECONDARY** one — a lake with a river inlet across the map, a lake
> with a back tarn. One body on an expansive plot left three quarters of the map
> with no water story at all. Plots of **48 and under keep exactly ONE body**,
> bit-identically (that is where the reference parks and every pinned 16-u park
> live). `waterBodyTarget(size)` is the single place that decision is made and
> the composer, both guard-clamp passes, `expandWaterBody` and `validatePark`
> all read it — exactly as they all read `waterGridStep` for the sampling pitch.
>
> **THE ANTI-SCATTER INTENT IS UNCHANGED.** Two bodies is not "some ponds":
> - **3+ bodies still FAIL** `validatePark`'s terrain gate, with the same
>   message about building with `firmShore: true` and passing `comp.basins`.
> - the SECONDARY body must be a BODY: area ≥ **16%** of the dominant one
>   (`SECOND_WATER_MIN_FRAC`). A lake plus a puddle FAILS.
> - the two must be **NON-ADJACENT**: ≥ `waterBodyGapMin(size)` =
>   `max(5, 0.055·size)` u — **7 u on a 128 plot** — of dry ground between the
>   waterlines. Two lobes of one lake split by a one-cell isthmus FAILS. The 16
>   rows below measure **48-95 u** of gap, so the rule is a floor, not a target.
>
> `comp.basins` now holds **BOTH bodies' bowls** (the secondary's are also
> published separately as `comp.basinsSecond`), and there is a
> `comp.waterCentreSecond` / `comp.waterStyleSecond` (`'inlet'` | `'tarn'`)
> beside the dominant body's. Build from `comp.basins` — a hand-written basin
> list is how you end up failing the body-count gate.
>
> **REGENERATE IT (do this, never retype numbers from memory):**
>
> ```sh
> cd rct2-design-system/harness/park-eval && node seed-table.mjs        # the 16 published rows at 128
> node seed-table.mjs --size=48                                        # the same rows at any other size (one body below 64)
> node seed-table.mjs --sweep --json                                   # the wide candidate sweep (24 seeds × 4 climates)
> node seed-table.mjs --seeds=13,29 --climates=alpine                  # one ad-hoc row
> ```
>
> It runs the REAL `parkComposition`, builds the REAL terrain from
> `comp.landform` + the composed peaks/basins exactly as `<Terrain>` does, and
> measures the wet region by flood-filling the BUILT heightfield — so the
> numbers are what the park has, not what the basin discs imply. It reports
> every body (`water.all`, biggest first), the measured `water.gap` between the
> two biggest, the `secondFrac` ratio and the `totalPct` both bodies add up to.

> **THESE COORDINATES ARE PRE-`keepDry` (round-7 warning, still true — and now
> a BUILD FAILURE).** Every row is composed UNGUARDED. Say it the blunt way:
> **the §1 table is what the seed composes with NO `keepDry` list at all**, and
> the list you actually build with changes the answer. Three rounds running have
> been lost to this one trap, most recently round 10 — the park pinned seed 7's
> dominant body, the composer re-picked it TWICE, the real lake landed under the
> east grove, and twelve scenery pieces were REFUSED for standing in open water
> with a ride canopy visibly on the waterline. So:
>
> 1. **`waterRePicked` is a §0-FATAL gate finding since wave 11**, not a
>    warning. It names the `keepDry` cells that sit inside the row's wet radius.
> 2. **Every hand-placed cell must be re-checked with `park.isDryCell()` AFTER
>    composition** — not against the row, against the composed body. A cell that
>    was dry on paper is not dry because the table said so.
> 3. **DO NOT WALK EITHER OF THOSE ON PAPER. §1-W below ships both as code:**
>    `SEED_ROW_WATER` (every row's two basin boxes and centroids, as a const) plus
>    `assertKeepDryOffRow(KEEP_DRY, SEED_ROW)`, which throws and names the
>    offending cells, and a `<DryScatter>` sieve that drops a wet planting cell
>    instead of having it REFUSED. Copy them; the paper walk has been attempted
>    and got it wrong every round it was tried.
> The probe picks the first water candidate that keeps
> YOUR `keepDry` cells dry, so the moment your layout overlaps the listed water
> the composition RE-PICKS and the body moves somewhere else entirely — round 7
> laid a lattice and planted a tree into exactly such a re-picked lake. Either
> keep your layout OFF the listed water (then the listed candidate wins and the
> row holds), or re-probe WITH your guards and place against the result (§0.17):
>
> ```ts
> const comp = parkComposition(THREE, seed, 128, climate, { keepDry, coasterPts });
> comp.waterCentre; comp.waterCentreSecond;   // the two bodies' representative centres
> comp.basins;                                 // BOTH bodies' bowls (waterline ≈ 0.74 · radius)
> comp.basinsSecond;                           // just the secondary body's
> comp.landform;                               // PASS THIS TO buildTerrain (see below)
> ```
>
> At runtime the same truth is on the Park context: `usePark().terrain.water`,
> `park.isDry(cell)`, `park.isDryCell(cell)`.
>
> **AND THE GATE TELLS YOU WHEN IT HAPPENED — FOR BOTH BODIES (wave-9, extended
> 2026-07).** These 16 rows are pinned in code (`SEED_TABLE_128` /
> `seedTableRow`, `ParkBuilder/composition.ts`); `<Park>` hands the row for its
> own (seed, climate) at size 128 to `validatePark` as a LIST of expected
> bodies, dominant first. The gate flood-fills the BUILT heightfield and raises
> **`waterRePicked`** when a measured centroid is > 10 u off its row entry (or
> **`waterShrunk`** at < 75% of that entry's area, or **`waterGrew`** at > 133%
> — log-symmetric, ×0.75 and ×1.333). Expected and measured bodies are paired by
> NEAREST CENTROID over both possible pairings, not by rank, so a seed whose two
> bodies merely swap which is bigger between an unguarded row and a guarded
> build is not reported as a re-pick. The warning names which body moved
> ("DOMINANT water body" / "SECONDARY water body").
>
> Measured evidence that the gate does not cry wolf: a park that keeps its
> layout off the listed water reads **0.99-1.00×** its row (the composition is
> deterministic — there is no noise floor), while round 9's park A read
> **1.79×**, doubling row 83's lake silently because one body inside the §0.10
> budget broke no other rule. Round 8 planned a "Lakeside Boardwalk" against
> row 1 and composed a lake 50 u away. **Re-probe with your guards and place
> against the result** (§0.17); do not plan a shoreline off an unguarded row you
> then build into.

> **AND THE SAME IS TRUE OF THE LAND: A BIG OR BADLY-PLACED GUARD LIST FLATTENS
> YOUR OWN TERRAIN (2026-07-25).** The `relief` figure in the "mountain ranges"
> column below (and the `relief` / `stdH` pinned beside every row in
> `SEED_TABLE_128`, plus the `SEED_TABLE_128_BAND` those rows span) is
> PRE-`keepDry` too, and for the same reason the water moves: `parkComposition`
> CAPS every hill peak your layout stands on (`capPeakForCells` for `keepDry`
> cells, `capPeakForCoaster` for `coasterPts`) so aprons stay flat, pads stay off
> slopes and rails never get buried. Guard a large fraction of the plot — or guard
> exactly where the seed drew its ranges — and those caps do not "shave" the
> mountains, they **erase** them.
>
> Measured, and this is not hypothetical. Two round-10 parks composed the SAME
> seed, climate and size (**7, coastal, 128**) and differed ONLY in their guard
> lists:
>
> | | peaks | max peak h | relief | stdH |
> |---|---|---|---|---|
> | UNGUARDED (the row below) | 7 | 6.10 | **10.54** | **0.85** |
> | `voltmoor`'s guards | 11 | 8.02 | 11.26 | 1.04 |
> | `hollowmere2`'s guards | 7 | 3.14 | **5.50** | **0.62** |
>
> `hollowmere2` crushed FOUR of its seven peaks to the cap's 0.35-u terminal and
> quartered their radii, landing **below every published 128 row** (the band is
> relief **8.15-16.60**, stdH **0.76-1.45**) — its horizon read as a flat green
> field. Nothing failed, because the composition was internally perfectly legal.
>
> **HOW TO CHECK IT.**
>
> 1. **The gate says so at build time.** `validatePark` raises
>    **`terrainFlattened`** (check b1) when the BUILT relief/stdH falls below the
>    published band, and it NAMES THE GUARD CELLS the way `waterRePicked` names
>    the cell that displaced the water — *"the range at (−20.1, 18.2) was cut h
>    6.1 → 0.35 by [−21.6, 16.8], [−22.6, 19.2], …"*. It is **§0-FATAL** only on
>    the conjunction: the park kept < **70%** of the character its OWN seed drew
>    (`comp.report.reliefFloor`) **AND** the result is below the published band.
>    Either alone is a non-fatal warning — a big layout legitimately has to
>    flatten its own pads, and a `plains` seed at amplitude 0.93 is legitimately
>    gentle (the message tells you which of the two you are looking at).
> 2. **Probe it BEFORE you commit to a layout:**
>    ```sh
>    cd rct2-design-system/harness/park-eval
>    node probe-relief-floor.mjs samples/yourpark.tsx          # the BUILT ground + the floor audit
>    node probe-relief-floor.mjs --seed=7 --climate=coastal --size=128 \
>         --keepDry='[[0,63.6],…]' --coasterPts='[[24,0.55,39.6],…]'   # guarded vs unguarded
>    ```
> 3. **Read it off the composition yourself:** `comp.report.reliefFloor` —
>    `{ relief, stdH, authoredRelief, authoredStdH, kept, floor, ok,
>    guardedRanges, cappedPeaks: [{ at, authoredH, keptH, culprits }] }`. It is
>    `null` on an unguarded composition and on any plot ≤ 48 (neither composes
>    differently). A `[ParkBuilder] landform-character floor MISSED` console line
>    fires the moment `kept` drops under the floor.
>
> **HOW TO AVOID IT.**
>
> - **GUARD TIGHTLY.** `keepDry` is the cells you really pave or place on —
>   street nodes, edge midpoints, pads, huts, lanes. It is not "the district",
>   and it is not a way to reserve elbow room. Every cell you add is a cell some
>   mountain may not exist near. **`KEEP_DRY = [...NODES]` is not tight**, it is
>   the whole node list with the actual placement cells left out; build the union
>   of what you pave and then run **§1-W's `assertKeepDryOffRow`** over it.
> - **KEEP GUARDS OFF THE PEAKS.** Probe UNGUARDED first and read `comp.peaks`
>   (or the row's "mountain ranges" column below), then put your districts in the
>   gaps. The composer helps — since 2026-07-25 it places its ranges on slots
>   clear of your guard cloud before falling back to the old walk — but it can
>   only move a range to ground you left free.
> - **PREFER `noDress` WHERE YOU ONLY NEED BARE GROUND.** This is the one that
>   catches people. `keepDry` guarantees dry, walkable, FLAT-ish ground, so it
>   MOVES THE HEIGHTFIELD (caps peaks, adds clamp discs). `noDress` only stops
>   the auto-dressing from planting there and touches the ground not at all. If
>   what you actually wanted was "no trees on my lawn", use
>   `<Terrain keepDry={GUARDS} noDress={LAND.noDress} />` — not a bigger `keepDry`.
>   (`GUARDS = keepDryOf(NET, SEED_ROW)`; **never `NET.keepDry` raw** — the fuse
>   merges every set-piece cell into it — MEASURED on §3.1-A, 30 authored → 650 guards.)
> - **SIZE-GATED, so nothing below 48 changed.** Guard-aware range placement and
>   the floor audit only engage past the classic 48 and only with a non-empty
>   guard list: every ≤48 composition and every UNGUARDED composition at any size
>   — the 16 rows below included — is bit-identical to before.

Composed headlessly from `parkComposition(THREE, seed, 128, climate)` — the
DEFAULT plot, UNGUARDED. **All 16 rows compose CLEAN at 128:** zero
`report.violations`, zero guard-clamp discs (`report.clampedCells` 0), **exactly
TWO** flood-filled bodies with the secondary at **17-92%** of the dominant and
**48.4-94.9 u** of dry ground between them, and a gate apron of |h|max
**0.10-0.18** against the 0.45 composition / 0.5 `validatePark` budget — the gate cell is `z 63.6` on
every one of them. PIN one and lay your park around the listed water instead of
guessing.

**THE LAND IS GENUINELY MOUNTAINOUS NOW (2026-07).** The old 192 table's rows
carried 2-4 u of landform relief across 192 u of ground — a 1-2% grade, which is
why the renders read as "nearly flat, gentle swells, no silhouette". Three
size-gated changes fixed it, and NONE of them touches a plot of 48 or under:
- `landformAmplitudeK` reaches **2.9 by 128** (it used to reach 1.9, and only at
  192);
- each archetype carries a **`drama`** multiplier applied past 48 — `ridges`
  ×1.6, `steppe`/`badlands` ×1.5, `hollows` ×1.22, `downs` ×1.18, `plains` ×1;
- the firm shore's mirrored rise became **amplitude-relative** past 48. This one
  mattered most: the shore floors every cell below `waterLevel + 0.34`, which on
  a real landform is close to half the plot, and it used to map all of it into
  one 0.5-u band — a dead-flat lowland plane wrapping every lake, with the whole
  lower half of the archetype's relief thrown away.
- `hScale` climbs past 48 too, so the authored ranges' summits reach **h 3.1-12.2**
  instead of topping out at ~5.4. `capPeakForCells`/`capPeakForCoaster` still
  shave any peak that would reach the layout or the apron, so the extra height
  lands only where nothing is built.
Measured over the 16 rows: **total relief 8.15-16.60 u** (was 2-4), **86-98% of
the plot still slope-flat on 13 of the 16 rows**; the three that are not are the
two `badlands` alpine seeds (5 → 63%, 42 → 65%) and 19 desert (`badlands`, 70%),
which is the archetype doing what its name says — their build fields are still
`use` 8-10 u. The apron is unchanged at |h| ≤ 0.18 against a 0.45 gate. `reliefBias` was
rebalanced at the same time (`inner` 0.32 → **0.18**, full amplitude by 0.36·S):
the CORE gains only ~1.35× its old relief, so streets, ramps and the path-level
median still work, while the FLANKS gain ~2.4×.

**THE LANDFORM ARCHETYPE IS THE OTHER VARIETY AXIS** (`comp.landform.style`,
from `CLIMATE_TERRAIN_STYLES`). Each climate draws from its OWN 6-slot
weighting, so an archetype is not available in every climate: temperate →
downs/hollows/ridges/steppe/plains, **desert → badlands/steppe/plains/hollows
only** (never downs or ridges), alpine → ridges/downs/badlands/hollows/steppe
(never plains), **coastal → hollows/downs/plains/steppe only**. The 16 rows below
cover all six archetypes (plains ×2, downs ×4, hollows ×3, ridges ×3, steppe ×1,
badlands ×3), all four DOMINANT water styles (corner ×10, river ×3, flank ×2,
central ×1) and both SECONDARY styles (inlet ×8, tarn ×8). `λ` is the noise
wavelength in units — a `ridges`/`badlands` seed at λ 5-18 is corrugated
country, a `plains`/`hollows` seed at λ 40-57 is broad swells.

**HOW TO READ THE WATER COLUMNS.** `ctr` is the measured centroid of each wet
region (not `comp.waterCentre` — that is the primary BASIN centre and can sit
several units off). A `box` is the flood-filled region's **bounding box, not its
shape** — a `river`/`inlet` row's box spans 70-80 u of z because the chain
snakes, and plenty of cells inside the box are dry land. Treat a box as "keep out
unless you have probed it" and re-probe `comp.basins` for real geometry
(waterline ≈ 0.74 · radius). `total` is both bodies' area over plot area,
against §0.10's per-climate band — re-measured at 128 with two bodies.

**HOW TO READ THE BUILD-FIELD COLUMN.** These are `comp.landZones` meadow discs,
sorted by USABLE radius = the listed radius clipped at the plot rim, because the
meadow sampler pushes fields out toward ±60 (the centre is full of water, ranges
and forest) and a listed `r 30` disc can have only 6 u of it inside the plot.
`use` is what you can actually build on. Forest discs are NOT obstacles — they
are dressing, so the land between the listed meadows is buildable too; the
meadows are just where the composition guarantees open, flat ground.

### `probes` — WHAT IT IS, AND WHAT IT IS NOT

**`probes` is how many landform candidates the composition REJECTED before one
satisfied its rules** (`comp.report.probesTried`), measured **UNGUARDED at SIZE
128**. Two things follow, and the second one is the correction to an earlier
draft of this section that claimed the opposite:

- **IT IS A PROPERTY OF (seed × climate × SIZE), NOT OF THE SEED.** The column
  below is a 128 measurement and does not transfer. Seed 7 temperate is
  **`probes 18` at 128 but `probes 1` at 48 and at 16** — so a size-48 park is
  simply not on the 128 row, and quoting "seed 7 is probes 18" at it is a
  category error. Re-measure at YOUR size.
- **IT DOES NOT PREDICT GUARD STABILITY. IN EITHER DIRECTION.** Measured:
  * a **`probes 1`** row gives NO guard immunity — `arch-ref` (seed 7 temperate,
    size 48) goes **unguarded `probes 1` → GUARDED `probes 64`**, and its water
    moves from the seed's river at (18.1, −5.9) to a lake at (13.8, 11.3). That
    park's own header already documents the moved water.
  * a **high `probes`** is not fragility — `seedcheck-s1-192` measures
    **`probes 17` both guarded AND unguarded**, lands on the SAME landform
    (`plains`, terrainSeed 16), needs **zero** clamp discs, and **0 of 12**
    realistic one-cell `keepDry` edits move it. Those 17 rejections are the
    composition's own water/relief rules doing their job.

  A high probe count means the composer worked hard to satisfy its rules. It says
  nothing about whether YOUR guards will move the result.

**ALSO: A PARK THAT PASSES NO `climate` DOES NOT GET `temperate`.** It composes
`climateOf(seed)`. `<Park seed={7}>` with no `climate` prop composes **desert**,
which is how `worlds-ref` was found to be a desert park while being read as a
temperate one. Pass `climate` explicitly, or read the one you actually got.

### MEASURE GUARD STABILITY DIRECTLY — there is a tool for it

The question an author actually has is *"will a guard-list edit move my
terrain?"*, and that is measurable rather than inferrable:

```
node harness/park-eval/probe-guard-stability.mjs samples/<your-park>.tsx
```

It reads the park's OWN `<Terrain keepDry/coasterPts>` (no browser), re-composes
with them at the park's OWN size, and prints:

| field | what it tells you |
|---|---|
| **unguarded probes** | the §1-table number, at your size |
| **GUARDED probes** | the same count WITH your guards. `64` = every candidate × every terrain-noise seed was tried, so no candidate satisfies the guards outright and the guard CLAMP finishes the job — legal and deterministic, but the land is now guard-shaped, not seed-shaped |
| **viol / clamps** | post-clamp violations `validatePark` will receive, and `clampPeaks + clampBasins` — how hard the guards fought the land |
| **moved** | of 12 realistic one-cell `keepDry` edits, how many change the landform IDENTITY (terrainSeed / archetype / water centroid). **THIS is the stability number.** `moved 0/12` is a guard-stable park |
| **climate** | the climate actually composed (see the `climateOf(seed)` trap above) |

`monorail-ref` measures `seed 91 desert size 128 · unguarded 1 → GUARDED 1 ·
viol 0 · clamps 0+0 · **moved 0/12**` — that, not its probe count, is why it is
quoted as the stable example.

### WHAT ACTUALLY KEEPS TERRAIN STABLE

This advice holds regardless of probe count, and it is where the effort belongs:

- **GUARD TIGHTLY** — only the cells you really pave or stand a structure on, not
  whole districts. Every guarded cell is a cell the composer must make dry and
  flat-ish, and it pays for that by moving the heightfield.
- **KEEP GUARDS OFF THE PEAKS the seed drew** — probe UNGUARDED first and read
  `comp.peaks` / the row's "mountain ranges" column, then place around them.
  Guarding a range is how a park loses its silhouette and trips
  `terrainFlattened`. **Probe the GUARDED composition too: a dense layout can push
  the primary range into a guard-blind fallback slot the unguarded row does not
  show (§1's pinned-row note), and `≥ 10.62 u` is the clearance a guard cell needs
  from a summit to cost that peak nothing.**
- **USE `noDress` WHEN YOU NEED BARE GROUND, NOT FLAT GROUND.** `noDress`
  suppresses planting and touches the heightfield not at all; `keepDry` moves it.
  A tree needs dry ground, not flat ground.
- **RE-VERIFY AFTER ANY GUARD-LIST CHANGE.** Re-run the gate, and re-read the
  composed water with `park.isDryCell()` rather than the pre-guard table row.
  This is the one that would have caught every case above.
- **THE LIST MUST COVER THE DRESSING TOO — AND THAT IS IN TENSION WITH "GUARD
  TIGHTLY". BOTH FAILURES ARE REAL AND BOTH COST POINTS.** Round 12's park B hit
  both ends in one file:
  * **too little:** `keepDry` listed street nodes and ride pads only, so the
    composer re-picked the body straight into the quadrant where a **gazebo, a
    picnic table and a tree** already stood — all three REFUSED as
    **`plantedInWater`**, §0-FATAL. **Every hand-sited `<Scenery>` / `<Placed>`
    cell belongs in `keepDry`** — or must be re-checked with
    **`park.isDryCell([x, z])` AFTER composition** and moved if it comes back wet.
  * **too much:** the over-broad guard elsewhere left the park at **2 % water
    against the temperate 4-22 % band**, so the **`terrain` check FAILED** for a
    body too small to dominate its flank (axis 8 also wants the secondary at
    ≥ 16 % of the dominant). **Claiming cells SHRINKS the water** — `keepDry` does
    not dodge the body, it pushes it out.
  The resolution is not a compromise: guard **cells you pave or stand something
  on** (never rectangles), use **`noDress`** where you only wanted bare ground,
  site the districts clear of BOTH published bodies in the first place, and then
  read the composed water percentage back against the climate band. **Guard your
  dressing; do not claim the plot.**

**Keeping the column honest.** `node harness/park-eval/seed-table.mjs --md`
emits these rows with `probes` measured live plus a stability summary comment, so
the column is regenerated rather than hand-maintained. Its output is
column-for-column the same shape but terser than the curated table below (it
omits the water `box x[…] z[…]` spans and lists ranges in composition order
rather than biggest-first); take `probes` from `--md` and the long-form detail
from the plain `node seed-table.mjs` run, whose `report probes N` line is the
same number. Both are UNGUARDED, at 128.


| seed × climate | `probes`<br>(unguarded, @128) | landform archetype | DOMINANT water body | SECONDARY water body | mountain ranges (biggest 3) | flat build fields (`use` = radius clipped at the plot rim) | sand flank |
|---|---:|---|---|---|---|---|---|
| **1** temperate | 17 | `plains` amp 1.04 λ 53.1 | corner lake ctr (41, −39), box x[21…60] z[−60…−21], **6.8%** | inlet ctr (−38, 31), box x[−56…−21] z[23…39], **2.6%** · gap 68.6 u · total **9.4%** | alpine ×4 (6, −49) r34 (−51, 7) r24 (29, 13) r22 · 12 peaks, max h 8.6 · relief 12.13 | (54, 56) use 6.9 + (−58, −34) use 5.2 + (−48, 58) use 5.1 | sand (33, −27) r 20 |
| **31** temperate | 1 | `downs` amp 3.71 λ 35.4 | corner lake ctr (−40, −38), box x[−64…−16] z[−63…−8], **13.1%** | inlet ctr (17, 40), box x[5…30] z[18…63], **4.8%** · gap 51.6 u · total **17.8%** | alpine ×4 (−38, 10) r35 (44, −6) r24 (15, −21) r22 · 12 peaks, max h 9.1 · relief 11.38 | (53, −36) use 8.2 + (−50, 48) use 7.3 + (−5, −39) use 7.1 | sand (−31, −23) r 22 |
| **83** temperate | 1 | `hollows` amp 4.88 λ 39.6 | corner lake ctr (41, −42), box x[26…57] z[−59…−26], **4.9%** | inlet ctr (−12, 40), box x[−29…6] z[29…53], **1.8%** · gap 73.7 u · total **6.7%** | sentinel ×6 (−28, 7) r24 (−27, −35) r24 (5, −45) r24 · 14 peaks, max h 7.6 · relief 9.33 | (−54, −55) use 7.6 + (−25, 51) use 7 + (57, 54) use 6.1 | sand (35, −30) r 19 |
| **71** temperate | 8 | `ridges` amp 7.67 λ 16.2 | river river ctr (−30, 0), box x[−40…−20] z[−14…16], **2.3%** | tarn ctr (38, −23), box x[32…45] z[−29…−17], **0.8%** · gap 57.5 u · total **3.1%** | rolling ×3 (31, 33) r28 (37, 3) r28 (6, −31) r25 · 9 peaks, max h 3.1 · relief 8.65 | (−53, 1) use 10 + (−58, 49) use 4.4 + (−59, 19) use 4 | sand (−33, −11) r 13 |
| **3** desert | 2 | `steppe` amp 4.36 λ 9.6 | corner lake ctr (43, −45), box x[28…60] z[−63…−28], **4%** | tarn ctr (−39, 20), box x[−45…−34] z[13…27], **0.9%** · gap 80.9 u · total **4.8%** | twin ×6 (−19, 26) r25 (−31, −32) r23 (28, 21) r22 · 16 peaks, max h 6.1 · relief 10 | (25, −51) use 8.4 + (19, 55) use 7.6 + (−56, 7) use 6.6 | sand (41, −37) r 15 |
| **19** desert | 6 | `badlands` amp 6 λ 6.8 | corner lake ctr (46, −49), box x[31…64] z[−64…−30], **4.9%** | tarn ctr (−26, 34), box x[−36…−17] z[26…45], **1.1%** · gap 79.9 u · total **6.1%** | rolling ×6 (−13, −45) r26 (21, 46) r25 (31, 7) r23 · 14 peaks, max h 3.4 · relief 10.45 | (−52, 54) use 8.6 + (52, −22) use 8.6 + (−18, 55) use 8.2 | sand (43, −39) r 13 |
| **37** desert | 1 | `hollows` amp 4.09 λ 40 | corner lake ctr (−47, −47), box x[−54…−41] z[−54…−41], **0.8%** | inlet ctr (11, 42), box x[3…19] z[34…49], **0.7%** · gap 93.4 u · total **1.4%** | twin ×6 (25, 21) r24 (45, 0) r19 (−28, 38) r19 · 13 peaks, max h 5.3 · relief 9 | (−11, 56) use 6.9 + (−1, −54) use 6.4 + (−57, 13) use 6 | sand (−44, −41) r 13 |
| **91** desert | 1 | `plains` amp 0.93 λ 56.6 | corner lake ctr (−51, −50), box x[−61…−42] z[−61…−40], **2%** | tarn ctr (40, 16), box x[36…45] z[13…21], **0.4%** · gap 94.9 u · total **2.4%** | twin ×6 (−16, 33) r25 (−28, −34) r24 (33, −20) r22 · 16 peaks, max h 4.4 · relief 8.15 | (−45, 51) use 11.4 + (54, 45) use 8.7 + (17, 4) use 8.1 | sand (−46, −43) r 11 |
| **5** alpine | 2 | `badlands` amp 6.17 λ 5.1 | flank lake ctr (42, 34), box x[20…57] z[14…53], **3.8%** | tarn ctr (−17, −41), box x[−26…−9] z[−49…−33], **1.3%** · gap 70 u · total **5.1%** | alpine ×5 (23, −22) r29 (−34, −26) r24 (−26, 16) r23 · 15 peaks, max h 12.2 · relief 16.6 | (−18, −53) use 8 + (−47, 56) use 6.6 + (58, 20) use 5 | sand (24, 30) r 14 |
| **8** alpine | 1 | `ridges` amp 7.97 λ 17.7 | corner lake ctr (48, 48), box x[38…59] z[38…60], **2%** | tarn ctr (−9, −48), box x[−19…−2] z[−58…−39], **1.7%** · gap 88.2 u · total **3.7%** | alpine ×7 (−34, 3) r32 (−20, 31) r22 (17, 29) r20 · 17 peaks, max h 11.7 · relief 12.17 | (12, −17) use 8.6 + (−2, 52) use 7.3 + (−56, 38) use 6.7 | sand (37, 44) r 14 |
| **17** alpine | 1 | `ridges` amp 9.24 λ 14.4 | flank lake ctr (37, 34), box x[19…57] z[13…52], **5.8%** | tarn ctr (−15, −46), box x[−23…−8] z[−56…−37], **1.4%** · gap 72.6 u · total **7.3%** | rolling ×3 (24, −23) r27 (−41, −1) r25 (−8, −26) r24 · 7 peaks, max h 3.4 · relief 9.11 | (50, 50) use 8 + (−55, 59) use 4.3 + (59, −58) use 4.1 | sand (25, 30) r 16 |
| **42** alpine | 20 | `badlands` amp 6.71 λ 6.1 | corner lake ctr (−45, −43), box x[−64…−24] z[−64…−24], **7.6%** | inlet ctr (26, 34), box x[5…48] z[23…45], **3.3%** · gap 64.1 u · total **10.8%** | rolling ×6 (35, −36) r29 (−30, −9) r28 (−2, −40) r25 · 15 peaks, max h 3.7 · relief 11.12 | (−51, 53) use 10.3 + (12, 45) use 9.1 + (40, 55) use 8.1 | sand (−39, −34) r 16 |
| **7** coastal | 7 | `downs` amp 2.8 λ 30.2 | river river ctr (46, −26), box x[33…57] z[−58…13], **4.9%** | tarn ctr (−43, −11), box x[−50…−37] z[−18…−5], **1%** · gap 70 u · total **5.9%** | twin ×3 (−22, 16) r23 (−23, −15) r21 (5, −28) r16 · 7 peaks, max h 6.1 · relief 10.54 | (−56, −42) use 6.8 + (−2, 57) use 6.1 + (57, 13) use 6 | sand (42, −12) r 13 |
| **23** coastal | 18 | `hollows` amp 5.61 λ 42.6 | corner lake ctr (−24, −46), box x[−50…4] z[−61…−31], **7.5%** | inlet ctr (30, 32), box x[14…47] z[15…50], **4.9%** · gap 55.5 u · total **12.3%** | sentinel ×5 (36, −34) r23 (−26, 37) r23 (37, 2) r20 · 11 peaks, max h 11.1 · relief 13.6 | (−57, −36) use 5.5 + (−41, 15) use 5.2 + (58, −55) use 5 | sand (19, 33) r 23 |
| **73** coastal | 1 | `downs` amp 3.18 λ 32.9 | corner lake ctr (29, 34), box x[5…54] z[12…56], **9.3%** | inlet ctr (−6, −42), box x[−30…19] z[−60…−24], **5.1%** · gap 48.4 u · total **14.4%** | alpine ×4 (25, −23) r40 (−20, 13) r21 (−34, −7) r21 · 12 peaks, max h 8.3 · relief 10.33 | (−21, −53) use 9.9 + (−45, 55) use 7.8 + (55, 13) use 7.4 | sand (16, 32) r 25 |
| **53** coastal | 1 | `downs` amp 3.51 λ 33.6 | river river ctr (−46, −24), box x[−60…−28] z[−63…18], **8.6%** | inlet ctr (39, 22), box x[29…49] z[11…33], **1.4%** · gap 61.1 u · total **10%** | alpine ×5 (36, −13) r34 (−24, 26) r25 (16, 17) r23 · 15 peaks, max h 10.7 · relief 12.96 | (−13, −55) use 7.6 + (−2, 46) use 6.1 + (−58, 48) use 5.3 | sand (−42, −12) r 13 |

**Also true at 128, and not obvious from the numbers:**

- **The two bodies land on OPPOSITE SIDES of the plot, but not mechanically so.**
  The secondary body is anchored on a jittered ring ordered farthest-from-the-
  dominant-body first, with a seeded rotation through the roomiest handful — so
  it is reliably across the map (measured gap 48-95 u) without every seed putting
  it in the exactly diametric corner. Read the row, do not assume "mirror".
- **The secondary body is DEEPER than the dominant one's bowls** (2.9-3.0 against
  2.2-2.3). It is anchored geometrically, before any heightfield exists, so its
  bowls can land on ground a metre or two above the water table; at the dominant
  body's depth such a bowl floods only a sliver and trips the "secondary is a
  pond" rule. Measured on the 24-seed × 4-climate sweep: **95 of 96 pairs compose
  CLEAN at 128** with exactly two bodies. The one that does not is **13 coastal**
  (secondary at 4% of a very large dominant body) — the composition reports it as
  a violation rather than shipping it, which is the intended behaviour, but do
  not pin that pair.
- **Seeds DROPPED from the candidate sweep, and why.** Nothing was dropped for
  violations, clamp discs, stray bodies or a rough apron — 95/96 are clean. The
  published 16 were chosen for full archetype + water-style coverage with one row
  per seed number.
- **The peak-bump rule binds long before the range centre does**, and it binds
  HARDER now that summits reach h 12. A footprint fails `validatePark` at a peak
  contribution > 0.75, which for a peak of height h and radius r means staying
  outside the radius where `h·k²(3−2k) = 0.75, k = 1 − d/r`. Probe the peaks
  (`comp.peaks`), not the ranges.
- **Temperate and coastal carry a lot of water — and two bodies raised the total.**
  See §0.10 for the re-measured per-climate bands at 128. If you pin a temperate
  or coastal seed that is NOT in this table, measure its water fraction and check
  it against that band.
- Compact size-16 parks keep composing EXACTLY as before, bit-identical to the
  classic table (seed 1 temperate → lake ~(1.2, −1.1)) — `TERRAIN_STYLE_MIN_SIZE`
  keeps them on the flat `TERRAIN_BASE` lawn, and `waterBodyTarget` keeps them on
  ONE water body. **Everything in the 2026-07 rescale is size-gated above 48**:
  the amplitude rise, the archetype `drama`, the `hScale` climb, the `reliefBias`
  rebalance, the firm-shore change and the second water body. A ≤48 park composes
  the ground it always composed.

### §1-W THE ROW'S WATER AS A CONST, AND THE ASSERTION THAT WALKS YOUR GUARDS

**The paper walk is retired. Copy these two blocks instead.** The table above is
prose, and every round asked to "walk it on paper" got it wrong. Round 13's park B
did not walk it at all — it wrote the CONCLUSION into its header,
`SEED seed=1 climate="temperate" (verified ring-clean; both water bodies stay
put)`, and then `const KEEP_DRY: XZ[] = [...NODES]`: all 29 street nodes
unfiltered, two of them inside this row's published boxes. **A claim in a header
comment is not a check, and nothing could tell the two apart.** It cost **−3
(`waterRePicked`, the secondary centroid moved 27.1 u)** plus two
`plantedInWater` refusals, **−2 scenery and −2 trees**: **−7 for one line.** The
cardinal-edge assertion (§0.15) gets copied and honoured every round, because it
is a `throw` you can paste and it cannot be satisfied by a sentence. So here is
the water walk in the same form.

**BLOCK 1 — the row you pinned, as data.** Boxes are `[x0, x1, z0, z1]`, the
bounding box of that body's basin CHAIN; centroids are the row's published
centres. Copy the ONE line for the pair you pinned (or the whole record — it is
inert data).

```ts
export type SeedBasin = { ctr: XZ; box: [number, number, number, number] };
export type SeedRow = { dom: SeedBasin; sec: SeedBasin };

// rules/park-generation-composition.md §1, PRE-guard, generated at size 128.
export const SEED_ROW_WATER: Record<string, SeedRow> = {
  '1/temperate':  { dom: { ctr: [ 41, -39], box: [ 21,  60, -60, -21] }, sec: { ctr: [-38,  31], box: [-56, -21,  23,  39] } },
  '31/temperate': { dom: { ctr: [-40, -38], box: [-64, -16, -63,  -8] }, sec: { ctr: [ 17,  40], box: [  5,  30,  18,  63] } },
  '83/temperate': { dom: { ctr: [ 41, -42], box: [ 26,  57, -59, -26] }, sec: { ctr: [-12,  40], box: [-29,   6,  29,  53] } },
  '71/temperate': { dom: { ctr: [-30,   0], box: [-40, -20, -14,  16] }, sec: { ctr: [ 38, -23], box: [ 32,  45, -29, -17] } },
  '3/desert':     { dom: { ctr: [ 43, -45], box: [ 28,  60, -63, -28] }, sec: { ctr: [-39,  20], box: [-45, -34,  13,  27] } },
  '19/desert':    { dom: { ctr: [ 46, -49], box: [ 31,  64, -64, -30] }, sec: { ctr: [-26,  34], box: [-36, -17,  26,  45] } },
  '37/desert':    { dom: { ctr: [-47, -47], box: [-54, -41, -54, -41] }, sec: { ctr: [ 11,  42], box: [  3,  19,  34,  49] } },
  '91/desert':    { dom: { ctr: [-51, -50], box: [-61, -42, -61, -40] }, sec: { ctr: [ 40,  16], box: [ 36,  45,  13,  21] } },
  '5/alpine':     { dom: { ctr: [ 42,  34], box: [ 20,  57,  14,  53] }, sec: { ctr: [-17, -41], box: [-26,  -9, -49, -33] } },
  '8/alpine':     { dom: { ctr: [ 48,  48], box: [ 38,  59,  38,  60] }, sec: { ctr: [ -9, -48], box: [-19,  -2, -58, -39] } },
  '17/alpine':    { dom: { ctr: [ 37,  34], box: [ 19,  57,  13,  52] }, sec: { ctr: [-15, -46], box: [-23,  -8, -56, -37] } },
  '42/alpine':    { dom: { ctr: [-45, -43], box: [-64, -24, -64, -24] }, sec: { ctr: [ 26,  34], box: [  5,  48,  23,  45] } },
  '7/coastal':    { dom: { ctr: [ 46, -26], box: [ 33,  57, -58,  13] }, sec: { ctr: [-43, -11], box: [-50, -37, -18,  -5] } },
  '23/coastal':   { dom: { ctr: [-24, -46], box: [-50,   4, -61, -31] }, sec: { ctr: [ 30,  32], box: [ 14,  47,  15,  50] } },
  '73/coastal':   { dom: { ctr: [ 29,  34], box: [  5,  54,  12,  56] }, sec: { ctr: [ -6, -42], box: [-30,  19, -60, -24] } },
  '53/coastal':   { dom: { ctr: [-46, -24], box: [-60, -28, -63,  18] }, sec: { ctr: [ 39,  22], box: [ 29,  49,  11,  33] } },
};
```

**BLOCK 2 — the assertion. It goes beside the cardinal-edge `throw`, before the
fuse, and it is copied verbatim.**

```ts
const inBasinBox = (c: XZ, b: SeedBasin) =>
  c[0] >= b.box[0] && c[0] <= b.box[1] && c[1] >= b.box[2] && c[1] <= b.box[3];

/** THROWS, NAMING EVERY OFFENDING CELL, when a guarded cell falls inside either
 *  published basin box of the pinned row, or within `nearR` of either centroid.
 *  Same shape and same position in the file as the cardinal-edge assertion:
 *  a design-time tripwire that must be resolved before the park ships. */
export function assertKeepDryOffRow(cells: XZ[], row: SeedRow, nearR = 12): void {
  const hits: string[] = [];
  for (const c of cells) {
    for (const [name, b] of [['DOMINANT', row.dom], ['SECONDARY', row.sec]] as const) {
      if (inBasinBox(c, b))
        hits.push(`[${c[0]}, ${c[1]}] is INSIDE the ${name} box x[${b.box[0]}…${b.box[1]}] z[${b.box[2]}…${b.box[3]}]`);
      else if (Math.hypot(c[0] - b.ctr[0], c[1] - b.ctr[1]) < nearR)
        hits.push(`[${c[0]}, ${c[1]}] is within ${nearR} u of the ${name} centroid (${b.ctr[0]}, ${b.ctr[1]})`);
    }
  }
  if (hits.length)
    throw new Error(
      `keepDry overlaps the pinned row's published water — ${hits.length} cell(s). keepDry does not AVOID water, it ` +
        `LIFTS the ground and pushes that body out, so each of these is a waterRePicked/waterShrunk finding (§0-FATAL):\n  ` +
        hits.join('\n  ') +
        `\nFix ONE of three ways: move the cell off the bowl; stop guarding it (guard only what you PAVE); or pin a row ` +
        `whose bodies your skeleton misses. Do NOT widen the tolerance.`,
    );
}

// …beside the cardinal-edge assertion, before buildParkNet:
const SEED_ROW = SEED_ROW_WATER['1/temperate'];   // the pair you pinned
assertKeepDryOffRow(KEEP_DRY, SEED_ROW);
```

**GUARD ONLY WHAT YOU PAVE — A STREET NODE IS NOT AUTOMATICALLY A `keepDry`
CELL.** `KEEP_DRY = [...NODES]` / `NODES.slice()` is not a shortcut, it is the
defect — and it shipped AGAIN in round 14 (dominant body **74.5 u** off its row,
secondary **70.2 u**, both areas roughly halved, −3.5). Use
`keepDryOf(NET, SEED_ROW)`. It guards
every node the layout happens to contain, including the far-corner ones that
exist to spread the street bbox and are the ones most likely to sit on a bowl,
and it guards nothing you actually place on (pads, huts, lanes, stall anchors,
scenery are all missing from it). Build `KEEP_DRY` as the UNION of the cells you
pave and stand something on, then run the assertion, then move or drop whatever
it names. On **seed 1 / temperate** the two cells this assertion catches are
`[22.8, −27.6]` (dominant box) and `[−31.2, 30.0]` (secondary box) — **and those
were literally the OLD §3.1-A table's node 8 and node 16.** It shipped VERIFIED with
both in water for three waves, because it was checked under a blanket
`NODES.slice()` guard list, which LIFTS the ground and makes a wet node read dry.
§3.1-A was repaired on 2026-07-26; the lesson is the sieve, not the coordinates.

**THE PINNED ROW'S WET EXTENTS, MEASURED OFF THE BUILT HEIGHTFIELD (seed 1
temperate, size 128, UNGUARDED)** — use these to place, and §5c's re-compose to
verify:

- **NW inlet:** `x[−56.2, −20.2]` `z[+23.0, +38.0]`. So any north-south column at
  x ≈ −31 crosses it for **15 u**. Centroid `(−33.7, 28.1)`.
- **SE lake:** `x ≥ 20.6` for `z[−21, −37]`, and `x ≥ 29.0` for `z[−38, −60]`.
  Centroid `(43.4, −43.4)`.
- **The four ranges no guarded cell may stand on (h > 0.8):** west
  `x[−56, −39] z[−4, +18]` · east `x[+26.6, +48.2] z[+7, +25]` · south-west
  `x[−19, −2.2] z[−36, −48]` · south-centre `x[+12.2, +33.8] z[−37, −52]`.

**⚠ THOSE FOUR BOXES ARE THE *UNGUARDED* COMPOSITION AND YOU MUST NOT PLAN A
CLEARANCE OFF THEM — THE RANGE A DENSE 128 LAYOUT ACTUALLY GETS IS SOMEWHERE
ELSE.** With a dense guard cloud no slot in `composeHills`' jittered ring can offer
the **19.2 u** guard-free disc the primary range wants at `GUARD_SLOT_K`
(`rangeR 31.0`), so the primary alpine range falls through to a **phase-1 fallback
walk that is guard-BLIND** — it lands in the same place whatever you author. On
seed 1 temperate that is a **FIVE-PEAK RIDGE along z ≈ −43**: summit
**(5.33, −42.89) h 8.59 r 12.09**, peaks at **x −13.8 / −5.8 / +5.3 / +19.2 /
+29.9**, **byte-identical in two published parks with completely different guard
clouds.** Two consequences, both measured:

1. **You cannot move this ridge by authoring around it.** The gap the four boxes
   leave at `x ≈ 0, z ≈ −43` is exactly where the summit lands, so "keep clear of
   the published boxes" walks you straight into it.
2. **Its skirt is CONTINUOUS from `x −23` to `x +38.6`.** The only dry southbound
   corridors on this row are therefore `x ≤ −23` and `x ≥ +38.6` — and the second
   is the SE lake. **Route south down `x ≤ −23`**, which is what both repaired
   skeletons do to reach the ring's South platform.

**AND THE COST FUNCTION, so you can size a clearance instead of guessing:**
`capPeakForCells(p, keep, 0.35)` shaves a peak to `0.35 / s(d)`, so **a guard cell
must stand ≥ 10.62 u from a summit to cost that peak nothing at all.**

**WHAT THE ASSERTION IS AND IS NOT.** It is a SIEVE, not the authority: `box` is
the basin chain's bounding box, so a cell in a box CORNER may be dry, and a
`throw` there costs you one coordinate move you did not strictly owe. That is the
right trade — the failure it prevents is §0-FATAL and the false positive costs a
cell. **The authority is still the mechanical re-compose diff below** (unguarded
vs guarded `terrainSeed` / `waterCentre` / `waterCentreSecond` / `probesTried`);
the assertion is what makes the cheap check impossible to skip.

**AND IT FAILS IN THE OTHER DIRECTION TOO — THE PUBLISHED BOXES ARE NARROWER THAN
THE REAL BASINS, SO A CLEAN SIEVE IS NOT A PASS (measured wave 17).** A box is the
flood-filled *region's* bounding box; the BOWLS that make the region are wider.
Seed 1 temperate's secondary box is `x[−56…−21] z[23…39]`, but its bowls reach
**`x −18.1`** — 2.9 u outside the box's east wall. So a street column at
**`x −19.2` crossing `z 23…39`** clears `assertKeepDryOffRow` completely, throws
nothing, and still **moves the secondary body 25 u** (`waterRePicked`, §0-FATAL).
**Wherever this sieve appears, read it as a fast PRE-FILTER: the §5c re-compose is
the authority, and it is the check that must actually pass.** The sieve's job is
to catch the cheap 90 % at module-parse time so the re-compose has less to find;
it is not a substitute for running it, and a park that ships the sieve without the
re-compose has not checked its water.

**AND SIEVE THE PLANTING RATHER THAN LET THE GATE REFUSE IT.** A wet `<Scenery>`
or `<Placed>` cell is not skipped, it is **REFUSED** — the prop never mounts and
you take a §0-FATAL `plantedInWater` for it. Drop the cell yourself instead:

```tsx
/** Mounts only the cells the COMPOSED water left dry. This must be a CHILD, not
 *  module scope: `park.isDryCell` needs `<Terrain>`'s effect to have run, and at
 *  module scope there is no `park` at all (`isDryCell` on an unmounted park
 *  answers `true` for everything, which is a vacuous pass, not a check). */
function DryScatter<T extends { at: XZ }>({ cells, render }: {
  cells: T[]; render: (c: T, i: number) => React.ReactNode;
}) {
  const park = usePark('DryScatter');
  const [dry, setDry] = React.useState<T[] | null>(null);
  React.useEffect(() => {
    const kept = cells.filter((c) => park.isDryCell(c.at));
    if (kept.length < cells.length)
      console.warn(`[park] DryScatter dropped ${cells.length - kept.length} wet cell(s) of ${cells.length}`);
    setDry(kept);
  }, [park, cells]);
  return <>{(dry ?? []).map(render)}</>;
}

// …last in the tree, after <Terrain> and <Paths>:
<DryScatter cells={TREES}   render={(t, i) => <Placed key={`tr-${i}`} position={t.at} build={(three) => tree(three, { shape: t.shape })} />} />
<DryScatter cells={SCENERY} render={(s, i) => <Scenery key={`sc-${i}`} name={s.name} position={s.at} seed={i + 1} />} />
```

**A SIEVE DROPS THINGS, SO OVER-PROVISION THE LISTS.** The counts on a 128 plot
are floors (≥ 32 trees, ≥ 16 scenery with `varietyIndex` ≥ 6), and they are
counted on what MOUNTED. Author ~40 tree cells and ~20 scenery cells so the floor
still clears after the sieve, and read the `DryScatter dropped N` console line as
the number to check against your margin. A sieve that drops nothing on a park
whose `keepDry` assertion also passed is the expected outcome, not a sign the
sieve is broken — but a sieve that drops nothing on a park with wet cells means
it ran before `<Terrain>` did, so check its position in the tree.

### WALK THE MONORAIL RING'S CELLS AGAINST THE ROW *BEFORE* YOU PIN THE SEED

**Every park ships the §4.2-A ring (§0.0 step 10), so every park brings 16 fixed
ground cells with it — and the row above cannot tell you whether they are dry
until you check.** This is not a hypothetical: it is our own two published
artefacts colliding, and it made `ok: true` unreachable for a whole round.

```
decks          [−42.6, −8.4]   [0, 34.2]    [42.6, −8.4]   [0, −51.0]
start pose     [−42.6, −9.7]
queue tails    [−36.0, −8.4]   [0, 27.6]    [36.0, −8.4]   [0, −57.6]
queue anchors  [−40.81, −8.4]  [0, 32.41]   [40.81, −8.4]  [0, −52.79]
exit huts      [−1.2, 33.03]   [41.43, −7.2]  [1.2, −52.17]
```

**W/N/E queue INWARD; the SOUTH platform queues OUTWARD (`queueDir [0, −1]`), so
its tail is 6.6 u SOUTH of its deck.** That asymmetry is measured, not stylistic —
see the SOUTH-QUEUE note under the ring-clearance table.

**THE PAPER CHECK.** For each cell and each basin in the row, `d = |cell − basin
centre|` against the basin's **waterline ≈ 0.74 · radius**. Any `d < waterline`
and that cell is WET — and a wet `keepDry` cell does not get skipped, it gets
LIFTED, which **pushes the water body out and shrinks it.**

**THE MECHANICAL CHECK, and it is the authority** (the 0.74 waterline is an
estimate; the composition is not): re-compose with **only the ring's cells** and
diff the result against the unguarded row —

```ts
const u = parkComposition(THREE, seed, 128, climate);
const g = parkComposition(THREE, seed, 128, climate, { keepDry: RING_CELLS });
// same terrainSeed? same waterCentre? same waterCentreSecond? same probesTried?
// AND: is every DECK CELL still above the waterline?  ← 53 coastal fails only here
```

If all four match AND the four decks are dry, the ring costs this seed nothing. If
they don't, the ring ALONE has re-picked a body and you have not pinned a seed yet
— you have pinned a `waterRePicked` finding. (The table below was re-measured in
wave 17 with **all 16** cells guarded; an earlier run used 15, dropping the start
pose because it sits 1.3 u from deck W and inside that deck's own guard disc. The
verdicts are the same on every row; the per-row displacement magnitudes quoted
below come from the 15-cell run.)

**AND THE FOUR QUEUE TAILS ARE DEAD ENDS BY CONSTRUCTION.** A tail sits 6.6 u from
its own deck along the lane axis, so a street that continues one more cell past
`[−36, −8.4]`, `[36, −8.4]` or `[0, −57.6]` runs straight through the platform pad
6.6 u further on: *`blockers`: street edge runs THROUGH … pad* — r12a's exact
failure. Author
those three as **leaves** — W and E from the ring's INTERIOR, **SOUTH from
OUTSIDE, laterally along z −57.6**. **The NORTH tail
`[0, 27.6]` is the only through node available:** its deck is at `z 34.2` with the
beam overhead, so a street row along `z 27.6` passes UNDER the beam and misses the
pad. Skeleton B's east arterial and its whole north promenade depend on that one
asymmetry, so keep it in mind when you mirror or rotate a table — mirroring in x
preserves it, rotating the ring's compass assignment does not.

**THE §1 RING-CLEARANCE TABLE — ALL 16 ROWS, RE-MEASURED AT SIZE 128 IN WAVE 17,
UNGUARDED vs GUARDED WITH ONLY THE RING'S 16 CELLS.** This is the table to pin a
seed from. **Three rows — 1 temperate, 31 temperate and 91 desert — are the only
ones that are fully ring-clean WITH DRY DECKS.**

| row | ring-only re-compose | relief / stdH with the ring (band 8.15-16.6 / 0.76-1.45) | water total (climate band) · `secondFrac` (floor 0.16) | verdict |
|---|---|---|---|---|
| **1 temperate** | **bit-identical** — probes 17→17, terrainSeed 16, viol 0, clamps 0+0 | 12.13 / 1.09 unguarded → **10.23 / 1.03**, in band | 9.4 % (4-22) · **0.38** | **RING-CLEAN.** The default pin. It used to pay a non-fatal `terrainFlattened`; that was the SOUTH queue side, not the row — see the note below |
| **31 temperate** | **bit-identical** — probes 1→1, terrainSeed 406 | 11.38 / 1.29 unguarded → **12.02 / 1.32, ABOVE the band** | 17.8 % (4-22) · 0.36 | **RING-CLEAN, and THE ROW TO PREFER FOR A NEW SKELETON.** Above the band means `terrainFlattened` **cannot fire at all**, and its **13 % SW lake** forces a genuinely different plan |
| **91 desert** | **bit-identical** — probes 1→1, terrainSeed 1186, viol 0, clamps 0+0 | 8.15 / 0.76 → **0.63 stdH** (below band, non-fatal) | 2.4 % (2-8) · 0.22 | **RING-CLEAN.** What `samples/monorail-ref.tsx` ships; the flattest of the three |
| 53 coastal | centroids hold — probes 1→1, terrainSeed 692 | 12.96 / 1.25 | 10 % (7-24) · **0.17** | **UNUSABLE FOR A RING PARK — the WEST DECK IS WET (`h −0.06`).** It passes the centroid diff and still drowns a platform, and `secondFrac` is 0.01 over the floor besides |
| the other 12 | **NINE of them MOVE A WATER BODY — 24–117 u in the wave-17 16-cell run.** Per-body magnitudes from the earlier 15-cell run (one reading, 7 coastal's secondary, is below that range there): dominant — 42 alpine **117.1** · 71 temperate **96.4** · 3 desert **62.5** · 7 coastal **60.9** · 8 alpine **55.8**; secondary — 71 temperate **90.5** · 42 alpine **84.7** · 8 alpine **70.7** · 19 desert **61.6** · 23 coastal and 73 coastal **25.0** · 3 desert **24.2** · 7 coastal **18.9**. The remaining three hold their centroids and still change: LANDFORM identity on 83 temperate (`terrainSeed` 1082→2052, probes 1→11) and 37 desert (484→581); **90+** and **36** clamp discs on 5 alpine and 17 alpine, 5 alpine with 2 post-clamp violations | — | — | **REFUSE ALL TWELVE for a ring park** |

**READ THE DECK HEIGHTS, NOT ONLY THE CENTROIDS.** 53 coastal is the row that
teaches this: nothing about its water MOVES, and its West deck still stands at
`h −0.06` — below the waterline. A re-compose diff on `waterCentre` /
`waterCentreSecond` / `terrainSeed` / `probesTried` is necessary and not
sufficient. **The check that catches it is a height read on all four deck cells
after composition**, and the tool that runs the whole audit for you is
`node harness/park-eval/probe-guard-stability.mjs samples/<your-park>.tsx`.

**PIN `seed 1 / temperate`** for mid-band ground and water with real headroom
(`secondFrac` 0.38 is 2.4× the floor), **`seed 31 / temperate`** when you are
deriving a NEW skeleton, or **`seed 91 / desert`** — what the verified ring
reference `samples/monorail-ref.tsx` ships — when you want the whole layout
bit-identical (`unguarded 1 → GUARDED 1 · viol 0 · clamps 0+0 · moved 0/12` with
its real 64-cell list). Then **walk your own street nodes too**: on seed 1
the SE corner lake reaches `[22.8, −27.6]` and the NW inlet chain reaches
`[−31.2, 30.0]`, and adding just those two to the ring's cells moves the dominant
body **77.3 u**.

> ## THE SOUTH-QUEUE NOTE: THAT `terrainFlattened` WAS A LAYOUT DEFECT, NOT THE ROW
>
> **THIS DOCUMENT USED TO SAY "ANY SEED-1-TEMPERATE RING PARK PAYS A NON-FATAL
> `terrainFlattened`, AND THERE IS NO LAYOUT FIX". BOTH HALVES WERE WRONG.** The
> cause was the SOUTH platform's QUEUE SIDE, and there is a layout fix. **Never
> accept a `terrainFlattened` as "the documented seed-1-temperate ring warning"
> again — on both repaired reference skeletons it does not fire at all**
> (`consoleSummary.gateWarningKinds` is `{}`).
>
> On seed 1 temperate the tallest range sits at ≈**(5, −43)** with **h 8.59**.
> Queued INWARD, the South tail `[0, −44.4]` and the street column paved down to it
> stand **5.3–5.8 u** from that summit and the guard list cut it to **h 0.83** — for
> `reliefFloor.kept` 0.74 / 0.73 and `terrain.stdH` 0.73 / 0.71, under axis 7's
> **0.75** floor, **−1.5 points**. **Queued OUTWARD** (tail `[0, −57.6]`,
> `queueDir [0, −1]`, approached from outside along `z −57.6`) the same pose
> measures `stdH` **0.73 → 0.81** and **0.71 → 0.79**, `reliefFloor.kept`
> **0.74 → 0.82** and **0.73 → 0.81**, axis 7 **7.5/9 → 9/9**, totals
> **96.18 → 97.68** and **91.90 → 93.40**, every other axis unchanged.
>
> **THE CLEARANCE THAT MAKES IT REUSABLE: `capPeakForCells(p, keep, 0.35)` shaves a
> peak to `0.35 / s(d)`, so a guard cell must stand ≥ 10.62 u from a summit to cost
> that peak NOTHING.** The South deck `[0, −51.0]` is **9.70 u** out and §4.2-A
> fixes it, so **3.45 of the 8.59 still goes — that is this pose's ceiling and it is
> enough.** Do NOT shift the ring west to recover the rest: that drops the West deck
> 4.2 u inside a world rect and trades `crossThemeCount 0` for terrain. And
> **31 temperate** remains the row to prefer for a NEW skeleton, whose guarded
> relief 12.02 / stdH 1.32 sits ABOVE the band so the finding is unreachable there.

**DO NOT PIN SEED 7 FOR A RING PARK, IN ANY CLIMATE.** Seed 7 draws a west tarn
right under the West deck every time — temperate `(−48.6, −11.3) r 12.6` (the deck
is **6.66 u** from the centre, **2.64 u inside** the 9.3-u waterline), desert
`(−48.6, −11.3) r 7.8`, coastal `(−41.1, −9.6) r 7.5` (deck **1.92 u** from the
centre). That is exactly what round 12 shipped: the tarn shrank **405 → 144 u²**,
`secondFrac` fell **0.53 → 0.15** against the 0.16 floor, and the park took **two
`terrain` FAILs** on a layout with nothing else wrong with its water. And on 7
coastal translation cannot save it — the east river chain's basins cover deck-E
`z ∈ (−34.1, 23.5)`, which contains the **whole** legal start range
`z ∈ [−21.5, 21.7]`.

**IF A BASIN COLLIDES, MOVE THE RING — IT TRANSLATES RIGIDLY.** `position` is free
anywhere in §4.2-B's published legal start range (x ∈ [−63.6, −21.6],
z ∈ [−22.8, 20.4] at 128) and all 16 cells plus the corridor table shift by the
same offset in lattice multiples of 1.2. Translating the ring is one line;
re-pinning the seed is one line; **shrinking a water body is neither.**

Build the real terrain from the winning seed — `buildTerrain` with the composed
`peaks + clampPeaks` / `basins + clampBasins` **AND the whole of
`comp.landform`** (`amplitude`, `scale`, `octaves`, `roughness`, `reliefBias`,
`flatSpots`); `<Terrain>` does all of it for you. **Passing the old constants
instead of `comp.landform` is now a real bug, not a shortcut:** the base field
is a per-seed archetype, so `amplitude: 0.38, scale: size * 0.52` samples a
heightfield the park does not have, and every ground height you probe off it is
wrong (this exact mistake was live in the harness's own `probe-seed.mjs`). Then
add ONE `buildWater` sheet at the water level — one SHEET still covers both
bodies, since it is a single plane at `WATER_LEVEL` and the basins are what make
water visible — and treat `terrain.heightAt(x, z)` as the single source of ground
truth for every later placement. If you compose terrain manually instead, you
still owe the same rules — validatePark flood-fills your heightfield.


---

## §2, §3 AND §3.1 ARE IN `rules/park-generation-worlds.md`

Split because this file outgrew a single design-system write; nothing was cut.
**`rules/park-generation-worlds.md` carries §2 the build order, §3 WORLDS (chosen
FIRST) and §3.1 SET-PIECES — how a world is actually assembled, including the
verified worked skeletons.** Read it before composing.

---
name: park-composition
description: "Use whenever the request is to build, compose, generate, design, lay out or extend a theme park, amusement park or fairground scene with the mp3d rigs - anything producing a <Park> with terrain, paths, a gate, worlds, rides, stalls and scenery. Owns the LAYOUT: the composition order; the World -> pad -> NET circular dependency; buildParkNet as the ONLY street network, called EXACTLY ONCE (worlds optional, the PIECE SET is not); the <World> region layer, the FountainPlaza/Bazaar/Boulevard set-pieces and the plaza mix; the mandatory <Monorail> ring and its costs (position/rotation, NEVER start/heading); guard-what-you-pave keepDry; the queue built from the tail outward, every pad from offPathCell at padMarginOf(rig); and the plot-utilisation floors. The paste-able code it names - parkAssert, place, assertPadFlat, portCell, the seed rows, keepDryOf, DryScatter, the water/reliefFloor diffs, the ring JSX, the header and the gates - is in rules/setup.md section 0-P, always delivered. Skeletons: see park-skeletons."
---


# Composing a park — the layout is the hard part

**The coaster is not where parks fail.** Measured parks scored 8/8 on Thrill
(verbatim archetype copies) and 1.5-2.5 / 8 on Paths with 0-3 / 10 on
Accessibility. The rule that follows: **you do not compute path geometry. The kit
does.** Every time you hand-roll node arithmetic you re-enter the exact failure
mode that has cost every park half its score.

**Scale facts, all at the default `<Park size>` = 128** (`parkRoot.tsx:137` —
**omit the `size` prop**): plot `x, z ∈ [−64, 64]` · footprint bounds ±63.95 ·
bare `<Gate/>` snaps to **`[0, 63.6]`** (`1.2·round((size/2 − 0.8)/1.2)`) · mesh
budget `2500·(size/16)²` = **160 000** · gate-edge tolerance
`max(1.25, size·0.025)` = **3.2 u** · opening crowd **50**.

> ## ⚠ THIS FILE HAS NO FILESYSTEM BEHIND IT. THE PASTE-ABLE CODE IS IN `rules/setup.md` §0-P.
>
> You receive loaded SKILL BODIES and `rules/setup.md` — **not a checkout, and not the
> other `rules/*.md` files, which are NEVER delivered.** A park searched for
> `monorail-ref` and `park-generation-rides.md`, found neither, reported *"the rules
> files and reference samples aren't in the project"*, then improvised the mandatory
> monorail from memory and wrote two props that do not exist.
>
> **So a pointer is not a delivery — with ONE exception.** `rules/setup.md` (disk copy
> `mp3d/SETUP.md`) **is delivered on 100 % of rounds, whatever skills load**, and its
> leading **§0-P PARK MANDATES** carries every paste-able block a park needs, in full:
> **§0-P.1** the §0 header template · **§0-P.2** the `<Park roster>` prop · **§0-P.3**
> all six pre-bundle gates · **§0-P.4** build at 128, `MONO_PIECES` + the whole
> `<Monorail>` tag, two coasters, >= 3 worlds, the `worldPlan` → pad → `NET` cycle ·
> **§0-P.5** `parkAssert`/`parkAssertFlush`, `PAD_MARGIN`/`padMarginOf`, `PEAK_LIMIT`,
> `bumpAt`, `assertPadFlat`, `minReachOf`, `place()`, `assertNodesOffPieces`/
> `SOLID_CLEAR`, `portCell` + the 1e-6 cardinal assertion and the port-ref/chain-end
> audit · **§0-P.6** all sixteen `SEED_ROW_WATER` rows, `inBasinBox`, `offRow`,
> `assertKeepDryOffRow`, `keepDryOf`, the §5c water diff, the `report.reliefFloor` diff
> with its null guard, the `report.*` field whitelist and `DryScatter`.
>
> **THIS file owns the LAYOUT: the composition order, the World → pad → NET cycle, the
> one-fuse rule, the `<World>` layer, the set-pieces, the plaza mix, the queue geometry
> and the plot floors.** Where it names a §0-P block, go and paste that block — do not
> reconstruct it from memory, which is exactly how the `start`/`heading` failure
> happened. Any OTHER path or `§x.y` here is **PROVENANCE**, where the number was
> measured, and never an instruction to fetch anything.

## The composition order — mount order IS build order

Sibling effects run in JSX order. Declare exactly this:

```
<Terrain> → <Paths> → <GameManager/> → <Gate> → coaster → monorail → flat rides
          → stalls / <Restroom> → SET-PIECES + <World> → scenery
```

Set-pieces, `<World>` and dressing must come **after `<Paths>`** — their dressing
settles onto the paving through `park.floorAt`. Wrappers throw a named error when
a prerequisite is missing.

But the *planning* order is the reverse: **plans first, JSX last.** Everything in
steps 1-6 is pure data, computed at module scope before any component mounts.

> **PLAN BUILDERS DEGRADE, THEY NEVER THROW.** Your plans and `buildParkNet` run
> at module scope, before React mounts, so a `throw` there takes the WHOLE PAGE.
> Since wave 9 every plan builder DEGRADES and records a §0-FATAL plan lint
> instead (`ParkBuilder/planLints.ts`): a diagonal `boulevardPlan` is re-routed as
> an L, an unknown port falls back to a real one, a bad edge endpoint is dropped,
> a missing `NET.node` cell resolves to the nearest node. **The park you shipped
> is then not the park you designed — fix the coordinate, don't accept the
> degraded shape.**

### YOUR OWN ASSERTIONS ARE A DIFFERENT CASE, AND THE ANSWER IS `parkAssert`

**THAT NOTE ABOVE IS ABOUT PLAN *BUILDERS*, NOT ABOUT YOUR CHECKS — AND READING IT AS
"NEVER THROW" COST FIVE POINTS.** Two parks read it beside *"ship guards, not advice"*,
concluded the two were in conflict, and downgraded **every** assertion to
`console.warn` — one wrote *"a slip becomes a console warning, never a black page"* —
after which nothing stopped a single one of its six hard failures. **A warn-only check is
worse than no check: `<Park>` renders anyway, `validatePark` reports the defect anyway,
and you are scored on it anyway.**

The resolution is to separate the COLLECT from the THROW. Never write a bare `throw`
inside a check — the first one hides the other nineteen numbers, which is what the warn
version was rightly afraid of.

> **PASTE `parkAssert` / `parkAssertFlush` FROM `rules/setup.md` §0-P.5** (which always
> arrives, whatever loads here). `parkAssert(name, cond, detail, sev)` pushes onto
> `PARK_FAILS` and returns `cond`; `parkAssertFlush()` is the **LAST line of the
> module-scope block, before the mount** — it prints ONE numbered block and throws only
> if a `'structural'` entry is in it. Every check in this skill routes through it.

**STRUCTURAL checks THROW** (cardinal edges · port refs · facing-vs-wired ·
`assertNodesOffPieces` · ring tails are leaves · tails off ports · the §5c water
diff · the pad reach floor · the bazaar stall floor · ≥ 3 scenery per world).
**ADVISORY checks are printed and never fatal** (`assertKeepDryOffRow`, which is a
box pre-filter with known false positives · the relief diff · the self-score
floors). And `probe-skeleton.mjs` rewrites module-scope throws to lints, so the
offline loop still shows you all twenty numbers at once.

### THE WORLD → PAD → NET CIRCULAR DEPENDENCY, NAMED

**`worldPlan({ rides: [{ at }] })` needs the PAD · the pad comes out of
`offPathCell(NET, …)` so it needs `NET` · `buildParkNet({ worlds })` needs the
WORLDS.** That is a real cycle in the published composition order and it has cost a
point in each of the last two rounds. Round 14 B broke it by ESTIMATING the pad to
within 0.04 u — and the audit still read **0 rides** for that world
(`worldNotBuiltOut`, −1.08), because a world is built only when a REGISTERED
position falls inside the rect and 0.04 u of drift across a rect edge is enough.

**THE ESCAPE HATCH, and it is cheap:** keep the estimate out of `rides:` entirely. Put
it in **`include:`** with a margin of **≥ 2 lattice cells (2.4 u)**, and let the real
pad — derived after the fuse — fall inside the rect the estimate widened:

```ts
// BEFORE the fuse: a deliberately GENEROUS estimate, in `include`, never `rides`.
const PAD_EST: XZ = [22.8 + 8.4, -27.6];            // tail + a reach you over-state
const PULSE = worldPlan({ id: 'pulse', theme: WORLD_THEMES.pulse, pieces: [PULSE_ROW],
  include: [PAD_EST, [PAD_EST[0] + 2.4, PAD_EST[1] + 2.4], [PAD_EST[0] - 2.4, PAD_EST[1] - 2.4],
            ...PULSE_SC] });                        // ± 2 cells: the rect now tolerates drift
// `worlds: WORLDS` IS legal HERE and only here — the hatch removed the pad from
// `worldPlan`, so WORLDS exists before the fuse. Take the real pads in `rides:`
// instead (skeleton A does) and it is not: use `pieces: ALL_PLANS`, see below.
const NET = buildParkNet({ nodes: NODES, edges: EDGES, pieces: PIECES, worlds: WORLDS, keepDry });
const TEACUPS = place([22.8, -27.6], [0, -1], 4, 'Teacups');   // the REAL pad, after NET
// …and CONFIRM, don't hope: the world audit is a containment test, so test it.
parkAssert('rideInWorld', PULSE.contains(TEACUPS.pad),
  `the real pad [${TEACUPS.pad}] fell OUTSIDE world 'pulse' — widen include, do not nudge the pad`);
```

> **DESIGN-SYSTEM IMPROVEMENT, LOGGED:** if `<World plan>` resolved its world rides
> from REGISTERED NAMES at settle time, the cycle would not exist. Until then,
> `include` + a 2-cell margin + the containment assert is the published answer.

---

## Step 1 — WORLDS FIRST, then seed + climate

**A park IS its worlds.** Pick **≥ 3** of the five `WORLD_THEMES` presets before you
look at a terrain seed (`emberfall` · `tidewater` · `brasswork` · `thornwick` ·
`pulse`; the per-world ride/stall/scenery rows are in **ride-and-stall-roster**).

### WHICH three is scored too — do NOT default to the same trio

"≥ 3" used to be the whole rule, and every worlds park in the corpus declares
exactly 3, so the count stopped discriminating. **RE-MEASURED 2026-07-27 at
corpus 30 (16 worlds parks) — median usage 11. STAMPED, because a frozen usage
list has already rotted twice here** (once claiming the whole DARK category was
never built when `GhostTrain` was in 12 parks), **and because this very table used
to read `brasswork 7 · pulse 7 · thornwick 5 · emberfall 3 · tidewater 2` against
10 worlds parks:**

| preset | parks that BUILT it | axis-16 CHOICE |
|---|---:|---|
| `brasswork` | **12** | over median → **0** |
| `pulse` | **12** | over median → **0** |
| `thornwick` | 11 | AT the median → 0.25 |
| `emberfall` | 5 | below → **full 0.5** |
| `tidewater` | **2** | below → **full 0.5** |

Three separate parks built the *identical* `brasswork + pulse + thornwick` trio
and each took full marks for "world variety". **Axis 16 splits that 1.5 into
COUNT (1) + CHOICE (0.5): at least one of your three must be a preset the corpus
UNDER-uses** — `tidewater` or `emberfall` for `choiceFull` **0.5**, `thornwick`
(at the median) for `choiceHalf` **0.25**, the top two for **0**. The split is the
corpus median, recomputed on every probe, so it follows the campaign — **so
re-derive it rather than trusting the table above:**
`underusedPresets(loadCorpus())` in `harness/park-eval/corpus.mjs` prints
`frequency`, `median`, `underused`, `atMedian`, `overused`, `corpusSize`.
**Worth +0.25 to a park already on `thornwick` (skeleton A's trio), +0.5 to one on
`brasswork + pulse` alone; skeleton B scores 5/5 on axis 16 this way.**

**No preset is unusable and none is exempt** — all five have BUILT at least
twice, all five still ship their own rides, stall and five scenery pieces. The
rarest, `tidewater`, owns the biggest circuits in the catalog (`ReefRacer` mounts
29.6 × 43.4 u, plus `OceanTunnelSlide` and `DeepDrift`), so budget its rect for
them rather than skipping the world. **And every preset owns ≥ 1 circuit nobody
has ever built** — emberfall `MagmaRun`/`LavaTubeRun`, tidewater
`DeepDrift`/`OceanTunnelSlide`, brasswork `GearworksExpress`, thornwick
`WyrmsHollow`, pulse `Bassline`; all seven compile their own `DEFAULT_PIECES`
clean, so each is one JSX tag with no `pieces` array. One under-used preset pays
axis 16's CHOICE half AND axis 13's selection novelty AND a circuit toward the
five §4.0-E wants.

> **THE FIVE PREFAB LAND MACROS AND `GrandPark` WERE DELETED (v6.0).** Never
> import `<EmberfallCaldera>` / `<TidewaterHollow>` / `<BrassworkFoundry>` /
> `<ThornwickGlade>` / `<PulseDistrict>` (the *components*) or `GrandPark`. The
> import alone makes esbuild refuse the whole bundle — a black page and a total
> loss. The `WorldTheme` PRESET CONSTANTS of the same names are fine and are what
> you pass as `theme:`; only the district-in-one-call components are gone. You
> now assemble each district yourself out of a themed set-piece + that world's
> own ride, stall and scenery.

### `<World>`'s only prop is `plan` — and skipping it is worth −5.0

The audit reads `<World>` REGIONS, not your themed content. One park built three
coherent themed districts — 22 themed components, `crossTheme: []` — and scored
**0 / 5** for `declared: 0`, purely for never mounting the region.

```tsx
const PULSE_ROW = bazaarPlan({ id: 'pulseRow', position: [43.2, 16.8], theme: PULSE_DISTRICT,
                               stalls: ['soda', 'cottonCandy'], seed: 7 });
const PULSE = worldPlan({
  id: 'pulse', theme: PULSE_DISTRICT, pieces: [PULSE_ROW],   // pieces MUST NOT be empty
  rides:   [{ at: [49.2, 8.4], name: 'Discotron' }],         // PAD centres
  include: [SLUSH, P_ARCH, P_STACK, P_PYLON],                // every other hand-placed cell
});
<World plan={PULSE} />
```

**A world is BUILT only when a REGISTERED ride's REGISTERED POSITION falls inside
the rect** — plus ≥ 1 stall and ≥ 1 scenery/set-piece. Two traps, each of which
has cost a park most of the axis:

- **`include` must list the ride's PAD cell, not its tail.** A tail is 3-7 u
  UPSTREAM of the pad, so a world whose `include` lists tails reads
  `rideCount: 0` → `worldNotBuiltOut`. Better: use `rides: [{ at: PAD, name }]`.
- **A `<Coaster>` registers at its FOOTPRINT CENTRE, not at `start`** — §4.0-A
  registers about **(−18.8, +3.1)** from `start`, nearly 19 u away and usually in
  the district next door. See the **coaster-pieces** skill for all three offsets.

Keep the rects from OVERLAPPING (`worldAt` resolves into the SMALLEST containing
region and manufactures `crossTheme` out of correct content), and keep every pair
of world CENTRES ≥ **32.66 u** apart at 128 (`20·√(size/48)`) with a **non-zero
rect-to-rect dry gap** — two rects that touch are ONE district to the scorer,
whatever the centres measure. List all `k(k−1)/2` pairs as `√(Δx²+Δz²)`, sorted,
closest marked.

**AND EVERY RECT MUST REACH THE MONORAIL'S BEAM CORRIDOR, OR `everyWorldTouched`
IS FALSE (measured wave 17).** The probe computes it by walking the monorail
group's bounding-box **PERIMETER** and asking which world rects it crosses, so a
world built entirely outside `x ±44` / `z −52.8…36` reads **`worldsTouched: 1`**
however grand it is — the ring is there, the world is there, and the audit says
they never meet. **The fix is ONE `include` cell aimed at the ring** (skeleton B
uses `[-38.4, 33.6]`, `[44.4, 33.6]`, `[-43.2, -28.8]`). An `include` cell is an
input to the rect UNION only: nothing is built on it, it never enters `keepDry`,
it is never guarded, so it cannot move your water or cap a peak. **It costs
nothing** — which makes a false `everyWorldTouched` the cheapest avoidable loss in
the book.

### Seed, climate and the two water bodies

Pin a seed + climate from the sixteen rows below (all measured at 128, all clean).
Four things about them that break parks:

1. **EVERY ROW PINS *TWO* WATER BODIES** — a DOMINANT one plus a SECONDARY. Plan
   around BOTH. The gate wants exactly `waterBodyTarget` bodies, the secondary
   ≥ **16 %** of the dominant, with ≥ `max(5, 0.055·size)` = **7.04 u** of dry ground
   between the waterlines. 3+ bodies FAILS; zero fails. Total coverage bands at 128
   are per-climate (desert 2-8 %, alpine 2-11 %, temperate 4-22 %, coastal 7-24 %) —
   **a coastal seed at 22 % water is NORMAL, not a defect.**
2. **THE ROW IS PRE-`keepDry`, AND OVERLAPPING IT IS §0-FATAL — SO DO NOT WALK IT
   ON PAPER, PASTE THE ASSERTION.** One guarded cell inside a published box — or
   within ~12 u of a centroid — RE-PICKS that body and raises **`waterRePicked`**.
   The paper walk has been asked for three times and got it wrong every time: one
   park transcribed a box into its own header and then put 16 guard cells inside it
   (body moved **70.7 u**); another wrote `const KEEP_DRY: XZ[] = [...NODES]` and
   shipped **−7 across three axes** (Step 2). **Copy the row you pinned and this
   function; put the call beside the cardinal-edge assertion, before the fuse.**

   > **PASTE `SEED_ROW_WATER` (ALL SIXTEEN ROWS), `SeedBasin`/`SeedRow`, `inBasinBox`
   > and `assertKeepDryOffRow` FROM `rules/setup.md` §0-P.6**, which always arrives.
   > The rows are per-seed DATA — never retype one from memory. Copy the ONE pair you
   > pinned into `const SEED_ROW`, and call `assertKeepDryOffRow(KEEP_DRY, SEED_ROW)`
   > **beside the cardinal-edge assertion, before the fuse.** It is ADVISORY, and its
   > tolerance is the published `box` plus **`nearR = 12` u** of either centroid.
   > §0-P.6 also carries the three rows a RING park may pin — `1/temperate`,
   > `31/temperate`, `91/desert` — and the cautionary `53/coastal`, whose WEST DECK
   > stands at h −0.06. **`<Park seed={7}>` with no `climate` composes `climateOf(7)`
   > = DESERT**, so always pass `climate` explicitly.

   **It is a SIEVE, not the authority.** `box` is the basin chain's BOUNDING BOX, so
   it both false-positives in a corner (costing you one coordinate move you did not
   owe — a good trade against a §0-FATAL worth ~3 points) **and lets things through,
   which is the half that costs points.** The boxes are narrower than the real basins:
   seed 1's secondary box is `x[−56…−21]`, but its bowls reach **`x −18.1`**, 2.9 u
   past the wall, so a street column at **`x −19.2` crossing `z 23…39`** clears this
   assertion silently and still moves that body **25 u**. **The re-compose diff (item
   3) is the AUTHORITY; this is the fast pre-filter. Ship both, in that order, every
   time** — and re-check every hand-placed cell with `park.isDryCell()` AFTER
   composition (Step 2 has that sieve).
3. **WALK THE MONORAIL RING'S 16 GROUND CELLS AGAINST THE ROW *BEFORE* YOU PIN THE
   SEED.** Every park ships §4.2-A, so every park brings these fixed cells with it,
   and `keepDry` does not dodge water — it **pushes the body out of every cell you
   claim**, so a deck inside a basin is a SHRUNK LAKE:

   ```
   decks          [−42.6, −8.4]   [0, 34.2]      [42.6, −8.4]   [0, −51.0]
   start pose     [−42.6, −9.7]
   queue tails    [−36.0, −8.4]   [0, 27.6]      [36.0, −8.4]   [0, −57.6]
   queue anchors  [−40.81, −8.4]  [0, 32.41]     [40.81, −8.4]  [0, −52.79]
   exit huts      [−1.2, 33.03]   [41.43, −7.2]  [1.2, −52.17]
   ```

   **W/N/E queue INWARD; the SOUTH platform queues OUTWARD (`queueDir [0, −1]`), so
   its tail is 6.6 u SOUTH of its deck** — measured, not stylistic; see the
   SOUTH-QUEUE note below.

   Paper check: `|cell − basin centre|` vs the basin's waterline (≈ `0.74·radius`),
   for BOTH bodies. **Mechanical check, and it is the authority:** re-compose with
   only the ring's `keepDry` cells and diff `terrainSeed` / `waterCentre` /
   `waterCentreSecond` / `probesTried` against the unguarded row — **and read the
   four DECK HEIGHTS as well, because one row passes the diff and still drowns a
   platform.**

   **AND DIFF THE *RELIEF*, NOT ONLY THE WATER — §5c WAS HALF A CHECK.** A park ran
   the centroid diff faithfully, it PASSED, and the gate then charged it a
   `terrainFlattened` for a landform its own `keepDry` had flattened: three guard
   cells `[0, −43.2] [0, −42.0] [0, −44.4]` — the INWARD SOUTH platform tail and its
   approach column — cut a range from **h 8.59 to 0.83**. **−1.5**, and the fix is the
   OUTWARD south queue below, not acceptance. The gate measures a
   CHARACTER floor as well as a POSITION one, and on an OFF-TABLE seed it is the ONLY
   terrain check you have (`expectWater` is undefined, so `waterRePicked` cannot fire).

   ⚠ **THE FIELD IS `report.reliefFloor`. `report.relief` AND `report.stdH` DO NOT
   EXIST** — reading them throws `TypeError: Cannot read properties of undefined
   (reading 'toFixed')` **at MODULE SCOPE**, i.e. a BLANK PAGE. It is
   `ReliefFloorReport | null`, **null on an UNGUARDED composition and on any plot
   ≤ 48** (`guardAware = size > 48 && guards.length > 0`) — so `BARE.report.reliefFloor`
   is ALWAYS null and there is nothing to diff against; it already carries the ratio, as
   `kept = min(relief/authoredRelief, stdH/authoredStdH)` against
   `floor = RELIEF_FLOOR_FRAC` = **0.70**. §0-P.6 lists its eleven fields.
   **THE NULL GUARD IS NOT DECORATION.**

   > **PASTE THE `terrainFlattened` DIFF, AND THE `report.*` FIELD WHITELIST IT DEPENDS
   > ON, FROM `rules/setup.md` §0-P.6** — both are there in full and it always arrives.
   > `const rf = COMP.report.reliefFloor;` then
   > `parkAssert('terrainFlattened', !rf || rf.kept >= rf.floor, …, 'advisory')`. The
   > GATE's FATAL test is the CONJUNCTION `kept < 0.70` AND `stdH < 0.76`; either alone
   > is a warning. Anything not on §0-P.6's whitelist is `undefined` on `report`, and
   > `undefined.toFixed()` is a black page.

   **THE RING-CLEARANCE VERDICT — all sixteen rows measured at size 128, unguarded vs
   guarded with ONLY the ring's 16 ground cells (15 distinct guards; the start pose
   dedupes into deck W's disc). This is the whole decision:
   THREE rows are RING-CLEAN WITH DRY DECKS — `1 temperate` (probes 17→17,
   `terrainSeed` 16, relief 12.13/1.09 → 10.23/1.03 in band, water 9.4 %,
   `secondFrac` 0.38; it USED to pay a non-fatal `terrainFlattened` — that was the
   SOUTH queue side, and it is fixed),
   `31 temperate` (probes 1→1, `terrainSeed` 406, relief 12.02/1.32 ABOVE the band so
   `terrainFlattened` cannot fire at all, 17.8 % water — THE ROW TO PREFER FOR A NEW
   LAYOUT, and its 13 % SW lake forces a different plan, which is novelty for free)
   and `91 desert` (probes 1→1, `terrainSeed` 1186, stdH falls to 0.63, below band and
   non-fatal).** `53 coastal` is **UNUSABLE** — it passes the whole centroid diff and
   its **WEST DECK STANDS AT h −0.06, in the water**, which is why the deck-height
   read is not optional. **REFUSE the other twelve:** nine move a water body 24–117 u,
   three hold their centroids and change the landform identity or pay 36–90+ clamp
   discs. Check any row yourself:
   `node harness/park-eval/probe-guard-stability.mjs samples/<park>.tsx`.

   > **THE SOUTH-QUEUE NOTE — AND IT REPLACES A CLAIM THIS SKILL USED TO MAKE.** This
   > page said *"any seed-1-temperate ring park trips a non-fatal `terrainFlattened`,
   > the cause is the mandatory ring, there is no layout fix."* **All three were
   > wrong.** The cause was the SOUTH platform's QUEUE SIDE. On that row the tallest
   > range sits at ≈**(5, −43) h 8.59**; queued INWARD, the tail `[0, −44.4]` and the
   > column paved to it stand **5.3–5.8 u** off the summit and cut it to **0.83**.
   > **Queued OUTWARD** (tail `[0, −57.6]`, approached from outside along `z −57.6`)
   > both reference skeletons measure `terrain.stdH` **0.73 → 0.81** and
   > **0.71 → 0.79**, `reliefFloor.kept` **0.74 → 0.82** and **0.73 → 0.81**, axis 7
   > **7.5/9 → 9/9**, totals **96.18 → 97.68** and **91.90 → 93.40**, and the warning
   > **does not fire at all** (`gateWarningKinds {}`). **So never accept this finding
   > as "documented".** The reusable arithmetic: `capPeakForCells(p, keep, 0.35)`
   > shaves a peak to `0.35 / s(d)`, so **a guard cell needs ≥ 10.62 u of clearance
   > from a summit to cost that peak nothing.** The South deck `[0, −51.0]` is 9.70 u
   > out and §4.2-A fixes it, so 3.45 of the 8.59 still goes — this pose's ceiling, and
   > enough. **Do NOT shift the ring west** (it drops the West deck 4.2 u inside a
   > world rect and trades `crossThemeCount 0` for terrain). **31 temperate** remains
   > the row to prefer for a NEW layout: above the band, so the finding is unreachable.
   >
   > **AND ANY PUBLISHED RANGE / PEAK BOX FOR A ROW IS THE *UNGUARDED* COMPOSITION —
   > NEVER PLAN A CLEARANCE OFF IT.** With a dense 128 layout no slot in
   > `composeHills`' jittered ring offers the 19.2 u guard-free disc the primary range
   > wants, so it falls through to a **guard-BLIND phase-1 fallback walk.** On seed 1
   > temperate that is a FIVE-PEAK RIDGE along **z ≈ −43**, summit **(5.33, −42.89)
   > h 8.59 r 12.09**, peaks at x −13.8 / −5.8 / +5.3 / +19.2 / +29.9,
   > **byte-identical in two parks with different guard clouds.** You cannot author
   > around it — the gap the published boxes leave at x ≈ 0 is exactly where the summit
   > lands — and its skirt is CONTINUOUS from **x −23 to x +38.6**, so the only dry
   > southbound corridors are `x ≤ −23` and `x ≥ +38.6` (the second is the SE lake).
   > **Route south down `x ≤ −23`.**

   **PIN `seed={1} climate="temperate"`**, `seed={31} climate="temperate"` for a new
   layout, or `seed={91} climate="desert"` (what the verified ring reference
   `samples/monorail-ref.tsx` ships) if you want the whole layout bit-identical. **DO NOT PIN SEED 7 FOR A RING PARK IN ANY CLIMATE** — it
   draws a west tarn under the `[−42.6, −8.4]` deck every time (temperate
   `(−48.6, −11.3) r 12.6`, deck **6.66 u** from the centre and **2.64 u inside** the
   9.3-u waterline; desert `r 7.8`; coastal `(−41.1, −9.6) r 7.5`, deck **1.92 u**
   out). Round 12 did: the tarn shrank **405 → 144 u²**, `secondFrac` fell
   **0.53 → 0.15** against the 0.16 floor, **two `terrain` FAILs**, and `ok: true`
   became unreachable. On 7 coastal no legal start clears it either — the east river
   chain covers deck-E `z ∈ (−34.1, 23.5)`, the whole legal range.

   **If a basin collides, TRANSLATE THE RING** — `position` is free anywhere in
   §4.2-B's legal start range (x ∈ [−63.6, −21.6], z ∈ [−22.8, 20.4] at 128) and all
   16 cells plus the corridor table move with it in lattice multiples of 1.2. And
   walk **your own street nodes** too: on seed 1, adding just `[22.8, −27.6]` and
   `[−31.2, 30.0]` to the ring's cells moves the dominant body **77.3 u**.

4. **THE FOUR QUEUE TAILS IN THAT CELL LIST ARE DEAD ENDS BY CONSTRUCTION.** Each
   tail sits 6.6 u from its deck along the lane axis, so a street continuing one more
   cell past `[−36, −8.4]`, `[36, −8.4]` or `[0, −57.6]` runs through the platform pad:
   *`blockers`: street edge runs THROUGH … pad* (r12a's exact failure).
   Author those three as **leaves** — W and E from the ring's INTERIOR, **SOUTH from
   OUTSIDE, laterally along z −57.6**. **Only the
   NORTH tail `[0, 27.6]` can be a through node** — its deck is at `z 34.2` with the
   beam overhead, so a street row along `z 27.6` passes under the beam and misses
   the pad. Plan the street net around that asymmetry from the start; discovering it
   after you have drawn a ring road costs you the ring road.

```tsx
const park = usePark();          // only inside a <Placed build> / usePark() child
park.terrain?.water              // { x, z, r } — the ACTUAL body, POST-guard
park.isDryCell([9, 12])          // the whole 1.2 cell: centre + 8 ring samples
```

---

## Step 2 — `keepDry` MOVES THE HEIGHTFIELD. `noDress` does not.

This is the single most misunderstood prop in the kit. `keepDry` does TWO jobs:
it guarantees a cell dry **and it CAPS every hill peak near it** to do so
(`capPeakForCells`; `coasterPts` does the same via `capPeakForCoaster`). A fat or
badly-placed guard list therefore does not shave the mountains, it **erases**
them — and the park reads as a flat green field.

Measured: two parks on the SAME seed 7 / coastal / 128, differing ONLY in their
guard lists, composed relief **11.26** and **5.50** (`stdH` 1.04 and 0.62). The
second fell below every published 128 row (band: relief 8.15-16.60, stdH
0.76-1.45) and below axis 7's `stdH ≥ 0.75` floor. Nothing failed — the
composition was internally legal — it just scored as a defect.

The **`terrainFlattened`** gate now catches it, and it NAMES the guard cells and
the range each one cut. It is §0-FATAL only on the CONJUNCTION "kept < 70 % of
what the seed drew (`comp.report.reliefFloor`) AND below the published band";
either alone is a non-fatal warning.

### `KEEP_DRY = [...NODES]` IS THE DEFECT, NOT THE SHORTCUT — AND IT HAS SHIPPED THRICE

`const KEEP_DRY: XZ[] = [...NODES];` — or `NODES.slice()` — is wrong in **both directions
at once**, and it has cost **−7** in one round and **−3.5** in another, the second written
by a park that had read this section:

- **too much.** Street nodes land inside the pinned row's published basin boxes: on seed
  1, `[22.8, −27.6]` sits in the dominant box and `[−31.2, 30.0]` in the secondary. The
  composer re-picks — **`waterRePicked`, a centroid 27.1 u off its row, −3** — and in the
  −3.5 round both bodies came off the row (dominant **74.5 u**, secondary **70.2 u**,
  both areas roughly halved) for two §0-FATALs.
- **too little.** Not one ride pad, hut, queue-lane cell, stall anchor or prop cell is in
  it, so the dressing is cleared for STREET clearance (`offPathCell`) and never for
  WATER: **two `plantedInWater` REFUSALS, −2 scenery and −2 trees.**

The −7 park's own header read `SEED seed=1 climate="temperate" (verified ring-clean; both
water bodies stay put)`. That is the CONCLUSION of the check, written where the check
should have been, and nothing in the pipeline can tell the two apart. **A claim in a
comment is not a check.** It keeps shipping because the anti-pattern is a paragraph while
everything around it is paste-able code — so here is the code.

**GUARD WHAT YOU PAVE. A STREET NODE IS NOT AUTOMATICALLY A `keepDry` CELL.**
Build the list as the UNION of the cells you pave or stand something on, then run
Step 1's `assertKeepDryOffRow(KEEP_DRY, SEED_ROW)` over it, then move or drop
whatever it names.

**AND SIEVING `NODES` IS NOT ENOUGH: `buildParkNet` MERGES EVERY SET-PIECE AND WORLD CELL
INTO `NET.keepDry`** — plaza pad cells, bazaar aisle and verge cells, port stubs. MEASURED
on the repaired skeleton A, **30 authored cells fuse to 638 paved cells and 650 guard
cells.** So sieve the FUSE'S OUTPUT, and `<Terrain keepDry>` gets the sieved list, never
`NET.keepDry` raw.

> **PASTE `offRow` AND `keepDryOf` FROM `rules/setup.md` §0-P.6**, which always
> arrives. `offRow(cell, row, nearR = 12)` is `inBasinBox` plus the 12-u centroid
> radius, for BOTH bodies; `keepDryOf(NET, SEED_ROW)` filters `NET.keepDry` through it,
> warns with the dropped count, and **its return value — not `NET.keepDry` raw — is what
> `<Terrain keepDry>` gets:** `const GUARDS = keepDryOf(NET, SEED_ROW);`

**`keepDryOf` DROPS RATHER THAN FIXES, so READ THE `dropped` WARNING AS A WORK ITEM.** A
dropped guard is a cell still in the lake — a non-zero count means MOVE THE THING. §0-P.6
carries the measurement both ways on skeleton A / seed 1: `NODES.slice()` moves the
dominant body **77.3 u** and the secondary **69.4 u** and takes `terrainSeed` 16 → 501,
probes 17 → 64; `keepDryOf` holds **both at 0.0 u** over **650 guards**, 0 clamp discs, 0
guarded cells wet — and made that park's **13 genuinely wet cells visible** (a whole
district, a ride's pad and anchor, three bazaar stalls, two scenery cells).
Guarding them was hiding them; moving them is the actual work.

### AND SIEVE THE PLANTING — A WET CELL IS REFUSED, NOT SKIPPED

`<Scenery>` and `<Placed>` do not relocate a wet cell; they **refuse to mount**
it, and you take a §0-FATAL `plantedInWater` AND come up short on the ≥ 32 tree /
≥ 16 scenery counts. Drop the cell yourself:

The one thing you must not get wrong: **it MUST be a CHILD, not module scope.**
`park.isDryCell` needs `<Terrain>`'s effect to have run; on an unmounted park it answers
`true` for everything, which is a vacuous pass, not a check.

> **PASTE `DryScatter` FROM `rules/setup.md` §0-P.6** — a generic
> `<DryScatter cells={…} render={…} />` that filters on `park.isDryCell(c.at)` in an
> effect and warns with the dropped count. Mount it **LAST in the tree, after
> `<Terrain>` and `<Paths>`**, once for the trees and once for the scenery.

**AND THE CELLS YOU HAND IT MUST ALREADY BE OFF THE STREET — INCLUDING THE TREES.**
`<DryScatter>` only sieves for WATER. Both published skeletons handed the tree scatter
over as a raw hand-authored array, a park copied that, five trees landed **0.00 u** from
a street edge, and the `scenery` gate returned five FAILs — **axis 9 floored to 0/5,
−5.0, and it was our own template.** Build the array like this, and type the shape off
the tuple (`shape: string` is a TS2322 against `tree()`'s union, and `typecheck.mjs` is
part of the gate — `Kit` exports the FUNCTION, not the union, so index the tuple):

> The `TREE_SHAPES` / `TREES` construction — `offPathCell(NET, c, { clear: 0.75 })` per
> cell, shape indexed off an `as const` tuple — is in `rules/setup.md` §0-P.6.

**A sieve drops things, so OVER-PROVISION.** Author ~40 tree cells and ~20 scenery
cells against floors of 32 and 16, and read the `DryScatter dropped N` line as the
number to check against that margin. `offPathCell` and `isDryCell` are two
different questions — street clearance and dryness — and every hand-sited cell
owes both.

**BUT `<DryScatter>` ONLY COVERS WHAT YOU HAND IT, AND IT RUNS TOO LATE TO STOP
ANYTHING.** It is a mount-time filter on a scatter list. It cannot see a ride pad,
a hut, a stall anchor or the restroom, and by the time it runs the seed is pinned
and the terrain is built. Round 13's park A had no wet-cell problem in its
dressing at all — its `waterRePicked` came from `NET.keepDry`, which `<DryScatter>`
never touches. **So ALSO derive the predicate at module scope, from the composed
basins, and route EVERY authored cell through it:**

```ts
import * as THREE from 'three';
import { parkComposition } from './components/ParkBuilder';   // NOT the Park barrel
// POSITIONAL, and `size` DEFAULTS TO 48 — pass 128. There is NO `comp.isDry`.
const COMP = parkComposition(THREE, 1, 128, 'temperate', { keepDry: GUARDS, coasterPts: FLAG_PTS });
// THREE BASIN LISTS, NOT TWO. `COMP.clampBasins` — the shave discs the guard clamp
// digs — are ABSENT from `COMP.basins`, and <Terrain> builds its water from
// `[...comp.basins, ...comp.clampBasins]` (`-validation.md` §7). Omit the third list
// and a cell reads `dry: true` here and composes **3.9 u UNDER water.**
const isDry = (c: XZ, margin = 1.2) =>                        // 0.74·r is the waterline
  [...COMP.basins, ...COMP.basinsSecond, ...(COMP.clampBasins ?? [])].every(
    (b) => Math.hypot(c[0] - b.x, c[1] - b.z) > 0.74 * b.radius + margin);
const dry = (c: XZ): XZ => {                                  // HARD cells THROW
  if (!isDry(c)) throw new Error(`cell [${c}] is inside the COMPOSED waterline`);
  return c;
};
```

`dry(...)` for pads, huts, stall anchors and the restroom; `.filter(isDry)` for the
scatter lists. `<DryScatter>` then becomes belt-and-braces rather than the only
check — and the module-scope version needs no park, so it runs before anything
mounts. The full walk, plus the centroid-diff that catches `waterRePicked` itself,
is assertion (3b)/(3c) in the worked skeleton.

So, four habits:

- **GUARD ONLY WHAT YOU PAVE OR STAND A STRUCTURE ON** — street nodes, edge
  midpoints, pads, huts, lanes, exit runs, stall anchors, the restroom. Not "the
  district", never as a way to reserve elbow room, and never `[...NODES]`.
- **KEEP GUARDS OFF THE PEAKS.** Read the row's "mountain ranges" column (or
  `comp.peaks` unguarded) and put the districts in the gaps. The composer places
  its ranges clear of your guard cloud where it can, but it can only move a range
  to ground you left free.
- **A TREE NEEDS DRY GROUND, NOT FLAT GROUND.** Where you only want the ground
  left BARE, use **`<Terrain noDress={LAND.noDress} />`** — it suppresses the
  auto-planting and touches the heightfield not at all. Measured on the reference
  park: adding its 32 PLANTED cells to `keepDry` cut one range 3.10 → 0.89 and
  left it keeping 68 % of the relief against the 70 % floor. Dropping them
  cleared it.
- **A PARK THAT SHIPS `<Terrain />` BARE HAS NOT DONE THE GROUND CHECK.** With no
  guard list there is nothing to walk, so the check is vacuously satisfied while
  the ground under the rides is whatever the seed drew.

### The per-ride GROUND check — and it charges ONE FAIL PER RECT

For **every ride** read the ground at the **pad, BOTH huts, the queue tail, the
queue lane and the exit join** (six cells) and require that no two differ by more
than the walkable grade — **0.5 u of rise per 1.2 u**. Then confirm every one of
those cells is OUTSIDE every §1 peak disc `(x, z) h R`. The terrain gate charges
one FAIL PER RECT, so a single ride dropped inside a published peak is not one
failure but about eleven: one park put a teacups rig inside seed 91's peak
(15.2, −41.3) h 4.3 r 13.8 and collected **11 `terrain` FAILs** and `ok: false`.

`causewayEdges` must be **EMPTY** — each one is −1.0 and reads as "deck
unreachable", i.e. a ride that was built, rated and unridable.

---

## Step 3 — the street FOLLOWS THE LAND

`<Paths>` no longer lays one flat sheet. It solves a **per-node surface** that
clears the ground across the FULL slab width and ramps between nodes inside the
walkable grade. Four consequences you must author for:

- **Route ALONG contours, not across them.** Where a run must climb, give it
  INTERMEDIATE NODES so each 1.2-u step stays inside the grade.
- **Burying the walked surface is §0-FATAL.** `pathClipping` fires when the
  walked surface sits more than **0.25 u UNDER the terrain** or more than **1 %**
  of the corridor is buried. The remedy is to REROUTE along the contour or add
  nodes — **never to loosen the tolerance.**
- **Real cut-and-fill shows.** Under 0.35 u of float a span gets an earth berm;
  above it, RCT2 wooden scaffolds. A street crossing a dip legitimately reads as
  a TRESTLE — that is the intended look.
- **Plazas level TILE BY TILE**, so a plaza on a rise STEPS rather than terracing
  as one pad. **Put plazas on the flat.**

Path level hugs the **MEDIAN** ground under your nodes, not the max:

| condition | what happens |
|---|---|
| node-ground spread ≤ 0.35, or you passed `nodeY` / `[x, z, elevation]` triples | level = **max** ground + 0.03 |
| spread > 0.35 | level = **median** + 0.03; every outlier gets an AUTO ramp — non-fatal `pathLevelMedian` |
| an auto-ramp over the grade | **CLAMPED to 0.20 u** (a later 0.48-u access spur is the binding term) |
| the clamp still leaves the node > 0.35 u off its ground | §0-FATAL **`rampRefused`** |
| level > median + 0.8, or any span > 1.0 u over its ground | §0-FATAL `causeway` |
| any span > **2.0 u** up, or a span whose ground dips below the waterline | **THE EDGE IS NOT BUILT** — §0-FATAL `causewayRefused` / `latticeInWater` |

**Read the REFUSED cases as one causal chain:** a refused span leaves a HOLE in the
graph, so the next thing you see is `accessibility` / `blockers`-unreachable for
everything behind it. Fix the span and they vanish. **`causewayEdges` must be EMPTY.**

---

## Step 4 — `buildParkNet` is MANDATORY, and it feeds `<Paths>` DIRECTLY

These are **ONE composition path, not two rival ones.** One park read them as
rivals (*"`<Paths>` needs me to hand a graph, and set-pieces go through
`buildParkNet`, which `<Paths>` may or may not accept… I'll SKIP the set-pieces"*)
and dropped the mandate for "reliability", costing ~5 points. There is nothing to
decide: **`buildParkNet` RETURNS the arrays `<Paths>` takes.**

```tsx
import type { V3, XZ } from './components/Park';                        // ONE canonical line for both
import type { NetRef, SetPiecePlan } from './components/SetPieceKit';   // net refs + the plan type

const CHAIN_END_OPT_OUT = new Set<string>([/* 'ave:B' — ONLY when something real
  stands on that terminus, e.g. a bare <Gate> on it */]);
const PIECES = [HUB, VIEWPOINT, ...AVENUES];        // the explicit ones
// NAME THE WORLD ROWS. NOT `...WORLDS.flatMap((w) => w.pieces)` — `WORLDS` reads the
// PADS, the pads read `NET`, so `WORLDS` does not exist yet and the flatMap spelling
// is a `const` TDZ ReferenceError at module scope (a blank page).
const ALL_PLANS: SetPiecePlan[] = [...PIECES, PULSE_ROW, WORKS_ROW, GLADE_ROW];
```

**(1)-(4) THE FOUR PRE-FUSE ASSERTIONS — PASTE THEM FROM `rules/setup.md` §0-P.5**,
which always arrives whatever else loads. Author them in this order, all BEFORE the
fuse, all routed through `parkAssert`:

1. **`portCell(ref)`** resolves a `NetRef`: a `NODES` index, or `'<planId>:<PORT>'`
   looked up on `ALL_PLANS` and read through `p.port(name)`. An older form said "port
   refs are strings, so SKIP them", which made the cardinal check **blind by design on
   exactly the edges most likely to be diagonal** — a park shipped `['pulseRow:W', 6]`
   running `[43.2, 8.4] → [22.8, -8.4]` and the synthesised elbow became a dead stub.
2. **The CARDINAL assertion over every `EDGES` pair, with `EPS = 1e-6` — and NEVER
   `!==`.** Port cells are COMPUTED as `tiles·0.6 + 0.6`, and `7·0.6 + 0.6` is
   `4.799999999999999` in binary, so a strict compare against an authored `4.8` throws a
   FALSE diagonal and blacks the page on a LEGAL park. 1e-6 is four orders under the 1.2
   lattice, so it cannot hide a real one.
3. **The PORT-REF AUDIT** — `pieceIsland` (every plan owns at least one
   `'<id>:<PORT>'` ref in `EDGES`) and `chainEnd` (every port with `prunable: false` is
   wired), with `CHAIN_END_OPT_OUT` for a terminus that really carries something. Read
   the flag off the piece, never off a list of kinds. The two sections below are the
   losses it defends against.
4. **`SOLID_CLEAR` + `assertNodesOffPieces(NODES, ALL_PLANS)`** — the margins are
   `FountainPlaza: 1.8` (pathWidth/2 0.55 + pad half 1.2 + 0.05) · `Bazaar: 0.6` (its
   footprint hz is 1.8, so 2.4 u off the AISLE) · `Boulevard: 0` (its carriageway IS a
   street), anything else **1.8**. **A set-piece's `position` is its SOLID CENTRE, never
   a street node and never a queue tail** — the most expensive single coordinate in the
   corpus, **~11 points**. **RUN IT AGAIN over the PADS** once they come out of the fuse.

```tsx
// ── EXACTLY ONE FUSE. This NET is the only one in the file. ─────────────────
const NET = buildParkNet({
  nodes: NODES,                    // XZ[] — your indices are PRESERVED (piece nodes appended)
  edges: EDGES,                    // [NetRef, NetRef][] — index ↔ index, or 'hub:N' by NAME
  pieces: ALL_PLANS,               // EVERY plan: plazas, bazaars, boulevards AND world rows
  keepDry: KEEP_DRY,
  bins: [[1.5, 12.0]],
});
// NO `worlds:` HERE, and that is not an omission — see the note under this block.

// …and inside <Park> (GUARDS, never NET.keepDry raw — see Step 2):
<>
  <Terrain keepDry={GUARDS} noDress={NO_DRESS} coasterPts={ALL_COASTER_PTS} />
  <Paths nodes={NET.nodes} edges={NET.edges} plazas={NET.plazas} bins={NET.bins} walkers={8}
         surfaceZones={WORLDS.map((w) => ({ ...w.region, surface: w.theme.pathSurface }))} />
</>
```

### `worlds:` IS OPTIONAL. THE PIECE SET IS NOT

`ParkNetInput.worlds?:` is optional in the type (`SetPieceKit/index.tsx:745`) and its
only behaviour is the flatten at `index.tsx:825` —
`[...worlds.flatMap(w => w.pieces), ...pieces]`, deduped — so **a world's row listed
in `pieces:` is fused, port-keyed, `keepDry`-merged and `gateway()`-resolvable
exactly as if it had arrived via `worlds:`** (`gateway()` builds its ref off the
world's own piece ports, `index.tsx:1485`; it never reads `input.worlds`). What is
fatal is a world piece that reaches NEITHER — round 13's park B built `WORLDS`,
mounted three `<World>`s, and handed the fuse only its explicit plazas, so the
port-ref audit and the graph described different parks.

**And a skeleton-A-shaped park CANNOT pass `worlds:`.** The cycle above is real:
`worldPlan({ rides })` reads the pads · the pads come out of `place()` · `place()`
reads `NET`. `harness/park-eval/samples/skeleton-a.tsx` — the park that passes the
gate — therefore omits `worlds:` (`:560-563`), names the three rows in `pieces:`
(`:374`), and declares `WORLDS` at `:663` out of the finished pads. The `include:`
hatch above does not change this: it widens a RECT so a later pad still lands
inside, it does not let a `worldPlan` reading a real pad exist before the pad.

### EVERY SET-PIECE MUST APPEAR IN `EDGES` — and the check is a COUNT

**N pieces ⇒ at least N entries of the form `'<id>:<PORT>'`. Count them before you
ship.** `pieces:` and `worlds:` bring a piece's INTERIOR sub-net into the graph and
join it to NOTHING; only a port-ref in `EDGES` connects it to your streets.

**A piece passed only via `pieces:` or `worlds:` is DECORATION, not a place** — its
stalls are unreachable, its plaza is not on the walk, and it composes as an orphan
island. This was the **single biggest loss of round 12, ~9 points**: `EDGES` referenced
`hub:N`, `hub:E`, `hub:W` and nothing else, leaving `pulseRow`, `worksRow`, `gladeRow`
and `viewpoint` with zero refs — **2 orphan islands · gate-reach 103/127 = 0.811 · three
Bazaar stalls no guest could reach · one `edgeThroughSolid` · accessibility 1/10.** And
an edge into a piece's **position** is not a port-ref: wiring a node that *is* a plaza's
centre drives the street through the fountain basin and `buildParkNet` cuts and reties it
as a §0-FATAL `edgeThroughSolid`. Write the port string yourself.

### BUT A COUNT PASSES A HALF-WIRED CHAIN PIECE — `<Boulevard>` OWES *BOTH* ENDS

**One ref satisfies a presence count, and that is exactly how a park passed this
assertion and still shipped a `deadStreetNode`:** `EDGES` held `['ave:A']` and never
`'ave:B'`. Both of `<Boulevard>`'s ports carry **`prunable: false`** — a structural
chain end, which `buildParkNet` never prunes and never shortens — so the avenue was
paved to full length and **stopped 7.2 u short of the plaza, in open grass.** Two fixes,
and take both: (1) the `p.ports.filter((pt) => !pt.prunable)` half of the audit above,
reading the flag off the plan so any future chain piece is covered, with the named
opt-out set for a terminus that really carries something (a bare `<Gate>` may stand on
one); and (2) **read the endpoint OFF the neighbouring piece, never retype it** —
`boulevardPlan({ id: 'ave', from: HUB.port('W'), to: MARKET.port('E') })`. The avenue's
end nodes then ARE its neighbours' port cells, `buildParkNet` MERGES them, and the 7.2 u
gap is not something you can typo into existence. That park wrote `to: [-13.2, 45.6]` by
hand against a `hub:W` port at `[-4.8, 45.6]` (`tiles: 7` ⇒ `half + 0.6` = 4.8).

### CALL `buildParkNet` EXACTLY ONCE — this is a prohibition

**One fuse, one `NET`. Declare every piece — including the plaza you think of last — in
that single `pieces:` array, and give `offPathCell` the SAME net `<Paths>` gets.** A park
built `NET` (no viewpoint plaza) and `NET2` (with it), fed every `offPathCell` from `NET`
and `<Paths>` from `NET2`: the restroom, all the scenery and all 34 tree cells were
cleared against a graph missing a **116 u²** plaza, so "clear" meant nothing there.
`validatePark` cannot see this — it audits the one graph `<Paths>` handed it — and a
second fuse pays the whole composition cost twice.

What it guarantees by construction: your node indices survive; everything is
lattice-snapped to 1.2, deduped and cardinal; **every long edge is SPLIT at any node
lying on it** (a crossing without a junction is a dead end guests can never turn at, and
a large part of the missing Accessibility score); unconnected port stubs are PRUNED; and
`NET.warnings` reports diagonals and islands before you mount. Lookups:
`NET.node([x, z])`, `NET.port('hub:E')`, `NET.pruned`.

### `<Paths plazas>` IS NOT OPTIONAL — omitting it costs −2.75

`NET.plazas` is where **every open space in the park comes from.** A park that
omits the prop measures `openSpace.count 0` / `plazaRects 0` and scores zero on
axis 15's open-space point AND axis 2's plaza point, however many plazas it
*looks* like it has. Ship **≥ 2 plaza rects, the largest ≥ 8 u², with DIFFERING
areas** (`areaSpread ≥ 1.8` — two identical squares fail the spread). A
`<FountainPlaza>` publishes its own rect for free, so two plaza set-pieces of
DIFFERENT `tiles` satisfies this by construction.

**AND `<Bazaar>` ROWS ARE PLAZA RECTS TOO, WHICH IS THE TRAP: THREE SAME-SIZE ROWS
SCORE `areaSpread` EXACTLY 1.0.** Skeleton B has no `<FountainPlaza>` at all, so a
park built on it has only equal-sized bazaar rects and takes **0.5/1** on the
open-space term (−0.5). A bazaar row's rect is `tiles × 1.2` by `3.6` where
`tiles = 2·stalls + 1`, so:

| piece | rect | area |
|---|---|--:|
| `fountainPlazaPlan({ tiles: 7 })` | 8.4 × 8.4 | **70.6 u²** |
| `fountainPlazaPlan({ tiles: 9 })` | 10.8 × 10.8 | **116.6 u²** |
| 2-stall row (padded to 3 → tiles 7) | 8.4 × 3.6 | 30.2 u² |
| 4-stall row (tiles 9) | 10.8 × 3.6 | 38.9 u² |

**Ship the MIX:** one 7-tile fountain plaza + a 3-stall row + a 4-stall row clears
the floor comfortably; skeleton A's hub 7 + viewpoint 9 + three 3-stall rows
measures **`areaSpread` 3.86**. A plaza is a scored term, not decoration.

### THREE AUTO-CORRECTIONS — all of them still FAIL the park

| authored mistake | what the chassis does | severity |
|---|---|---|
| a pad inside a street slab | **MOVED to `offPathCell`'s own answer**, and the move is reported | `padOnStreet`, §0-FATAL |
| a DIAGONAL edge in `buildParkNet({ edges })` | **AUTO-ELBOWED** into two cardinal legs through a synthesised corner node | §0-FATAL plan lint |
| an edge crossing a set-piece's own SOLID | **CUT and re-tied through that piece's PORTS** | §0-FATAL plan lint |

So the park RENDERS and is diagnosable instead of going black — **but a §0-FATAL
lint still fails `validatePark`. This is a safety net, not a licence.**

### Set-piece wiring rules that bite

- **Wire by PORT, never by position.** At `rotation: 0` the port names ARE world
  axes: `'N'` = +z, `'S'` = −z, `'E'` = +x, `'W'` = −x, each one lattice cell
  OUTSIDE the footprint. **Port names are LOCAL, so a ROTATED plan breaks that
  table** — read `plan.portDir('W')` / `world.gateway(toward)`, or let the plan
  aim itself with `facing: { port: 'E', toward: HUB.port('S') }`. Never infer a
  compass direction from a rotation.
- **`<FountainPlaza>` has all four ports. `<Bazaar>` has ONLY `W` and `E`** (the
  aisle axis), at any rotation. `<Boulevard>` has `A` (its `from`) and `B`.
- **An avenue leaving a port must run AWAY from the piece:**
  `sign(to − port) === sign(port − pieceCentre)`. A leg arriving from +z wires to
  `'N'`, NEVER to `'S'` — wiring the far port paves the carriageway straight
  through the piece. **A `<FountainPlaza>`'s centre 3×3 is a SOLID BASIN**
  (`r 1.78·scale`), so a carriageway across it earns **one `blockers` FAIL PER
  CROSSED CELL**. One park wired both of its N/S avenues to opposite ports and
  paved four edges across the basin.
- **Ask for only the ports you will wire** (`ports: ['N','E','W']`). An unwired
  port is PRUNED and the prune is reported.
- **Every `boulevardPlan` needs `avoid` covering EVERY street node its
  carriageway meets — its own TWO ENDPOINTS included — at `clear: 2.6`.** A
  boulevard plants verge trees at ±2.45 u; where another slab runs under one that
  is a hard `scenery` FAIL naming the boulevard's own tree. (2.4 misses the trees
  by 5 cm.) `from`/`to` must share an x or a z and be ≥ 3 cells apart.
- **Never author a spine node within 2.4 u of a `<Bazaar>`'s stall rows** — wire
  to its `W`/`E` ports only. **AND ENTER THAT PORT *ALONG THE AISLE*: the row's
  DRESSING HALO is ≥ 2.4 u each side of the aisle at BOTH port cells.**
  `bazaarPlan` emits a bench at local `(±stub, ±1.2)` and an entrance marker at
  `(±stub, ±2.4)` — offsets that appear nowhere in the plan you wrote, on the port
  cell's column, PERPENDICULAR to the aisle. A street running THROUGH a port cell
  across the aisle puts both of them **0.00 u** from its centreline: two `scenery`
  FAILs, −2 (round 14 B). `<Bazaar>` now sieves its own dressing through
  `offPathCell` at mount and warns when it moves something — **but that warning
  means your street is standing in the row's entrance, and the layout is still
  wrong.** Same root cause as its `footprints` FAIL: node 8 was simultaneously the
  Teacups queue tail and `pulseRow:W`'s port cell, so the derived exit lane went
  one cell over and landed inside the aisle. `assertTailsOffPorts` catches that.
- **A `<Bazaar>`'s OWN STALLS LINT `padNearStreet` AGAINST ITS OWN AISLE. IT IS NOT
  YOUR DEFECT AND NO CONFIGURATION CLEARS IT — REPORT THE COUNT AND MOVE ON.** The
  aisle is PAVED into the fused net and every stall anchor sits **1.2 u** off it,
  against §0.14's **1.2 u** margin, so the test is `1.20 < 1.20` on a float and which
  rows trip is decided by float rounding in the `facing` quarter-turn. `validatePark`
  still reads `ok: true` over it, and the printed remedy is unavailable. **Never
  disable `pinStalls` to silence it.** (Full sweep and the logged design-system
  defect: **ride-and-stall-roster**, "TWO THINGS ABOUT A BAZAAR THE AUTHOR CANNOT
  SEE".)
- **AND `bazaarPlan` SILENTLY CLAMPS AT 6 STALLS** — `stalls.slice(0, 6)`, no lint.
  Ask for 7 or 8 and you get **6 slots and 13 tiles**, so a `stalls:` count written
  from the array you TYPED is a `rosterOverstated` failure. Use `plan.slots.length`.
- **NAME THE STALLS: pass `names`.** Without it every stall is auto-named
  `'<title> <CatalogDefault>'` — *"EmberRow Soda Stand"* — which satisfies a
  mechanical themed-name check and reads as machine output (−0.5).
  `bazaarPlan({ …, names: ['Cinder Grill', 'Slagworks Sodas', 'Ashfloss'] })`;
  positional, one per entry in `stalls`, short arrays fall back per slot.
- **Count degree-1 nodes BEFORE you mount.** Tally degrees straight off `EDGES`,
  and for every degree-1 node NAME the thing it exists for (queue tail, stall,
  restroom, plaza, gate) within 2.4 u. An empty one is a `deadStreetNode`, **−2.0
  in aggregate**, and a `d1` share above ~0.2 reads as a star of spurs. Put the
  thing on the spur, or delete the spur.
- **CLOSE A PARK-SPANNING CIRCULATION LOOP**, not a star of radial avenues — and
  not a closed triangle inside one court. The loop leaves the hub, reaches every
  district, **crosses z = 0** and returns. That one edit buys axis 2's skeleton
  point, carries the street net out of the gate-reach band, and is the cheapest
  novelty move there is.

### The anti-lattice arithmetic — the 3-point block, in numbers

`gridRegularity` is a published weighted sum, and **it cannot fall below 0.40**
in any legal park here (streets are cardinal-only, so `axisAligned` 1.000 × 0.25
and `bearingUniformity` 1.000 × 0.15 are pinned). The ≤ 0.55 full-credit line
leaves you a budget of exactly **0.15** across the other three terms:

| term | weight | lever |
|---|--:|---|
| `lengthUniformity` = 1/effectiveClasses | 0.25 | ≥ 4 distinct authored span lengths, aim 5 |
| `latticeNodeShare` | 0.20 | share of nodes on BOTH a column and a row line (a line = ≥ 3 nodes sharing a coordinate) |
| `pitchUniformity` = mean of 1/nPitches per axis | 0.15 | ≥ 4 different spacings between consecutive grid lines, per axis |

**"Win the block on `effectiveClasses`" IS FALSE and was worth −2.05.** One park
measured `effectiveClasses` **3.17** (a clean pass) and still scored 0.2/1.5 on
`gridRegularity` **0.724**, because its other two terms were maximal: 29 nodes on
5 column lines and 7 row lines with a single 12.0-u x-pitch. All three must move.

**AND `<Boulevard>` DOES NOT BUY LENGTH VARIETY.** It paves its carriageway as a
**1.2-u CHAIN**, so it buys ZERO edge-length classes: a park that handed every long leg
to a boulevard — seven of them — measured **132 of 154 street edges at 1.2 u,
`effectiveClasses` 1.96**, worse than one that chained its own spines. Boulevards buy
VERGE TREES, LAMPS and a dressed carriageway, and §0.15 forbids hand-rolling an avenue —
**but it does not oblige you to HAVE one.** Skeleton B ships **zero boulevards and zero
plazas** and measures axis 15 **7.0/7** precisely because every long run is a single
authored edge. **Length variety comes only from long SINGLE AUTHORED EDGES** — two nodes
in your own `NODES` list 12-49 u apart, wired as ONE edge, routed where nothing else is
(`buildParkNet` splits an edge at any node ON it, so a 26-u span drawn down a
boulevard's carriageway comes back as ~22 edges of 1.2 u).

**The trade-off, in numbers.** The 1.2-u chain share is what decides this, and
every chain source pushes it up: a `tiles: 7` `<FountainPlaza>`'s own walkable
ring is ~24 chain edges; a 25-u boulevard is ~21. Worked, for the skeleton below
(23 long authored edges + one `tiles: 7` plaza + one 12-u boulevard ≈ 34 chain
edges, 57 total):

```
lengthUniformity 1/2.6   → 0.25 · 0.383 = 0.0958
latticeNodeShare 0.15    → 0.20 · 0.150 = 0.0300
5 x-pitches, 7 z-pitches → 0.15 · 0.171 = 0.0257
                            total 0.1515 → gridRegularity 0.552 ≈ the 0.55 line
```

So, concretely: **≥ 20 long single-span authored edges, ONE plaza set-piece kept
small, and at most one or two SHORT boulevards.** Pay for every boulevard with a
long authored span, and **never let three nodes share an x or a z unless you MEAN
a grid line** — offsetting each district's court a cell or two off the spine's
columns collapses the whole 0.2-weight `latticeNodeShare` term, and it is the
cheapest of the three and the one every park forgets.

**DO NOT CONFUSE THIS BLOCK WITH THE NOVELTY POINT — DIFFERENT TESTS, AND THE NOVELTY
ONE IS ABOUT YOUR BUDGET, NOT YOUR DRAWING.** `gridRegularity` is the weighted sum
above; `novelty.distance` is a distance over a 29-dim vector of SHAPE STATISTICS that
contains those terms **plus the density ones** (node/path density, mean edge length,
open-space count/area/`areaSpread`, bearing mix, quadrant spread, degree shares).
Measured: a park built to be deliberately different from skeleton B — different gate
rim, LADDER topology with a real cycle where B is a pure tree, different worlds,
different roster — still measured **0.031 against it** (a derivative, under the 0.04
floor) with **21 of 29 dimensions inside 0.05**, because it spent the SAME budget: ~54
nodes, ~400 u of street, 3 bazaars, the same plaza areas and edge mix. **Topology
contributes almost nothing; the scalars do.** So pick a DENSITY CLASS in the header and
commit — SPARSE long-run (~55 nodes / ~410 u / mean edge 7.5 u) or DENSE short-block
(**~120 nodes / ~1200 u / 3-4 u**). A ~120/~1200 park cannot land near a ~55/~410 one
however similar its topology, and vice versa. **Change the class, then draw whatever you
like inside it.** (Full treatment: the **park-skeletons** skill.)

---

## Step 5 — pads OFF the lattice, tails ON it, exits DERIVED

### (a) EVERY pad, building and prop cell comes from `offPathCell` — run it

A hand-derived placement coordinate is a DEFECT, not a shortcut. `offPathCell`
computes exactly the clearance the fatal lints measure, so a cell it returns
cannot be the one that fails. **"1.5 u off a node" READS SAFE AND IS 0.00 u FROM
THE EDGE SLAB** — the slab is 1.1 wide, so its centreline owns ±0.55 and a pad
half-width of 1.2 reaches 0.05 u past it at 1.5 u out. One park authored all
three themed stalls at exactly 1.5 u and needed a `padOnStreet` auto-move on
every one.

```tsx
import { offPathCell, pathClearance } from './components/Park';
pathClearance(NET, [-12, 9.6]).clearance    // 0 → that cell IS a street node
offPathCell(NET, [-12, 9.6], { clear: 1.8 })// → [-13.8, 10.8] — USE THIS NUMBER
// THE FOUR VALUES (wave-18: there is a FOURTH, and the first one is a FUNCTION):
//   clear: padMarginOf(rig) — a RIDE PAD, and NOT a constant. The validator's number
//                 is max(1.8, padHalf + pathWidth/2 + 0.05) off the rig's RENDERED
//                 footprint (`lintPadOffLattice`), so it is a MESH property and
//                 **capacity never enters it**: two capacity-6 rides can want 1.8 and
//                 4.77. Flats run 2.95-4.77, TRACKED spans to **8.4**
//                 (<GearworksExpress>). 3.2 is only the COMPACT-FLAT default, and the
//                 12-row PAD_MARGIN table is pasted just below. One park used 1.8 on
//                 all seven pads (9 padOnStreet, 6 footprints FAILs); another used the
//                 published constant 3.2 on a <GhostTrain>, landed 4.42 against 4.77,
//                 and took a padNearStreet IT HAD EARNED BY FOLLOWING US.
//   clear: 1.8  — a BUILDING (restroom / hut / hand-placed stall / kiosk)
//   clear: 1.2  — any <Scenery>/<Placed> prop (pathWidth/2 + ground radius)
//   clear: 0.75 — the TREE SCATTER. Yes, that too: five trees handed through raw landed
//                 0.00 u from a street edge — five `scenery` FAILs, axis 9 floored to
//                 0/5, −5.0. NO cell that mounts geometry is exempt from this call.
// Defaults: step 0.6 (half-cell), rings 8 (4.8 u search), margin 1.2.
// Opts: { streetNodes, isDry, size }.
```

Two limits: it audits the STREETS plus dryness and bounds and **does NOT know
about your other pads, stalls or scenery** — check its answer against your
committed footprints (pitch ≥ 6 u). And **`null` means RE-PLAN THE STREETS**, not
shrink the rule.

**THE HELPER'S LAST LINE IS THE CALL — A DERIVED PAD IS NOT A LEGAL PAD.** A
`place(tail, out, cap, front)` that derived the pad tail-first **correctly** and
returned the raw sum needed a `padOnStreet` auto-move on 3 of 6 pads, and one auto-move
landed a ghost train on top of a spinner: 1 OBB overlap, **5 `footprints` FAILs**,
spacing 0/8. Getting the formula right is not the point; making the call is. **Three
facts `place` enforces**, so you know what you are pasting:

1. **`front` IS NOT YOURS TO INVENT.** It is `layout.front`, frozen into the component
   at `composableRide()` time (default 1.8; `<Discotron>` 4.0, `<BumperCars>` 2.6) and
   unreadable while authoring. One park invented a per-ride `front` column. It does not
   appear in the reach arithmetic and must not.
2. **AUTHOR `minReach + 2.4` — TWO lattice cells, not one — AND ASSERT AT `+ 1.2`.** A
   `composableRide`'s `boardPoint` sits NEARER the tail than `position` (1.40 u on a
   `<Discotron>`), and one cell left a cap-12 rig 9.54 u out against the 9.74 u floor.
3. **`clear` IS `padMarginOf(rig)`** — the fourth ARGUMENT of `place` exists for it, and
   it is neither 1.8 nor a hard-coded 3.2.

```ts
// MEASURED margins, straight out of the lint text ("inside the §0.14 margin of N"):
const PAD_MARGIN: Record<string, number> = {
  GhostTrain: 4.77, HauntedMansion: 4.77, PaddleBoats: 3.12, Discotron: 3.07,
  FerrisWheel: 2.97, AetherBalloons: 2.95,
  // MEASURED track spans → padHalf + 0.55 + 0.05, rounded UP to the 1.2 lattice:
  GearworksExpress: 8.4,   // 15.1 × 7.4  → padHalf 7.55
  RiverRapids: 6.6,        // a flume basin; a generous clear only pushes the pad
  //                          FURTHER from the street, and the reach floor still holds
  MagneticRide: 5.4,       //  9.0 × 8.3  → padHalf 4.5
  MoonlitBarge: 4.8,       //  8.5 × 6.05 → padHalf 4.25
  Helicycles: 3.2,         //  ~5.2 round
  MotionSimulator: 3.2,    //  2.2 × 2.2 base plate
};
const padMarginOf = (rig: string) => PAD_MARGIN[rig] ?? 3.2;
// Off-table rig: take the default, probe ONCE, and read the exact margin AND the
// legal cell out of the lint — it prints both.
```

**KEEP THE TABLE, PASTE THE REST.** `PEAK_LIMIT`, `bumpAt`, `assertPadFlat`,
`minReachOf` and `place` are in `rules/setup.md` §0-P.5 in full, verbatim, and it always
arrives. What they are, so you know what you are pasting:

- **`const PEAK_LIMIT = 0.75;`** — `ParkBuilder/validate.ts`, verbatim. `bumpAt(cell)`
  is the smoothstep peak contribution summed over `COMP.peaks`; anything over the limit
  is a hill flank and a hard `terrain` FAIL. Round 14 B's one hand-derived pad put a
  `boardPoint` on a flank at contribution **2.25** against the **0.75** limit: **−2.5**,
  invisible to every street check in this file.
- **`assertPadFlat(pad, clear, label)`** returns a pad that is BOTH under `PEAK_LIMIT`
  AND `isDry`, searching outward ring-by-ring at step 0.6 to r = 8 (4.8 u) and failing
  `padOnFlank` if nothing qualifies. It is the LAST line of `place`, because
  **`offPathCell` is street-aware and TERRAIN-BLIND.**
- **`const minReachOf = (c) => laneLenOf(c) + 0.35 + 0.62 + 0.5 + 0.45;`** — and
  `laneLenOf` is **IMPORTED from `./components/ParkBuilder`** (it is NOT on the
  `./components/Park` barrel). Never re-implement it.
- **`place(tail, out, capacity, rig)`** — tail is the AUTHORED street node, `out` the
  unit direction from tail toward the ride, and **the 4th argument is the RIG NAME,
  which is what feeds `padMarginOf`**. It returns **`{ pad, anchor, dir }`**: the ride's
  `position`, the queue head, and `queue.dir` (= `−out`). It authors at
  `minReachOf(capacity) + 2.4` and asserts `padReach` at `+ 1.2`. **Declare it AFTER the
  single `buildParkNet` fuse** — it reads `NET`.
- `bumpAt` / `assertPadFlat` / `place` read `COMP`, `isDry` and `NET`, all declared
  LOWER DOWN. That is legal and deliberate: `function` declarations are HOISTED and
  these are only ever CALLED after all three exist. Do NOT "fix" it by moving the fuse
  up — `place()` needs the fuse AND the composed heightfield — and a `const` arrow
  instead of `function` WOULD be a TDZ.

`offPathCell` at these margins searches `rings 8 × step 0.6` = 4.8 u, so a tight
court returns `null` or a cell under the floor — both of which now go through
`parkAssert` as **BLOCKING for that one rig** instead of shipping it on a bad cell.
**That is the point — and it drops the RIG, never the park.** `null` and a short reach
both mean RE-PLAN THE STREETS or OMIT THAT RIDE; never relax the number, and never
abort the module (that scores 0 on all 16 axes).

The only two exemptions in the whole park are the PUBLISHED POSES whose clearances
are already measured: a §4.0 archetype's `start` and §4.2-A's monorail `position`.

Two cells are a `scenery` FAIL by definition, and both are what hand-typing
produces: a cell that **reuses ANY street node's coordinate** (even just one of
the two — typing a prop at your street row's own `z` puts it on the centreline;
one park hand-typed 18 props, six on street axis values, for six FAILs), and a
cell **lying on an authored edge's centreline**. **A BUILDING IS NOT A PROP** —
and an avenue's ENDPOINT *is* a street node, as is every cell along its 1.2-u
carriageway chain. One park put `<Restroom position={[-8.4, 16.8]}>` on a
boulevard's carriageway node and paid **2 `blockers` FAILs and `restroomUses 0`**.

A SHOP is the documented exception: kiosks belong on cells **abutting** the
street with the serving front toward it (counter 0.42 out, guest attach 0.72
out), so a stall only has to keep its SOLID BODY (hx 0.6, hz 0.42) out of the
slab — which is why a `<Bazaar>`'s stalls may flank its own aisle.

### (b) THE QUEUE IS CONSTRUCTED FROM THE TAIL OUTWARD — never fitted to the pad

**Plant the TAIL first**, as a real authored street node, and derive everything
else FROM it, with `out` = the unit direction from the TAIL toward the ride:

```
pad    = tail + out·(minReach(c) + 2.4)             // the ride's `position` — an OUTPUT
anchor = tail + out·(laneLenOf(c) + 0.35)           // the queue HEAD
dir    = −out                                       // `queue.dir` runs head → tail
laneLenOf(c) = max(2.2, 0.6 + 0.56·c + 0.5)         // placement.ts:79
minReach(c)  = laneLenOf(c) + 0.35 + 0.62 + 0.50 + 0.45
                                                    // assert got >= minReach(c) + 1.2
```
**`front` DOES NOT APPEAR IN THAT ARITHMETIC AND MUST NOT.** It is the component's
own frozen `layout.front`, not a number you supply — inventing one is how round 13
landed a pad 4.43 u from a tail whose floor was 9.74.

**NEVER COMPUTE `anchor` FROM THE PAD.** That single inversion is the biggest
scored loss in the corpus. One park set `queue={{ anchor: pad − out·3.51 }}` on
all six flat rides; the tails the manager then derived landed **0.18-3.46 u from
the pad centre** — **nine `footprints` FAILs and axis 3 capped at 0/8**, on a park
whose own header quoted the right formula.

**THE FLOORS, off that arithmetic** — `MIN = laneLenOf(c) + 1.92` (0.35 join + 0.62 hut
offset + 0.50 hut half-depth + 0.45 pad half): cap **4 → 5.26** · **6 → 6.38** ·
**8 → 7.50** · **10 → 8.62** · **12 → 9.74**. **ASSERT** at MIN + 1.2, **AUTHOR** at
MIN + 2.4 (7.66 … 12.14). Both the LANE *and* the entrance HUT are SAT-ed against the pad
and SAT counts TOUCHING as a collision.

**AUTHOR **TWO** CELLS OVER THE FLOOR, NOT ONE — MEASURED WAVE 17.** The floor is
enforced against the **`boardPoint` pad**, and on a `composableRide` that pad is
NOT at `position`: it sits at `position` + the rotated **`layout.board`**, whose
local +z is the face the queue runs into — so it lands **nearer the tail** than
`position` does. `<Discotron>` ships `board: [0, STAGE_H, 1.4]`, so `MIN + 1.2` =
10.94 put its boardPoint **9.54 u** from the tail against the **9.74 u** floor and
took a `footprints` FAIL, *"entrance hut overlaps boardPoint pad"* — on arithmetic
that read as correct in the header. Like `front`, `board` is frozen into the
component and unreadable while authoring, so **buy two cells and assert one.**
Write **one row per ride in the §0 header, and let `place`'s assertion prove it**
rather than trusting the header.

**AND THE LANE ITSELF IS A SOLID — KEEP EVERY STREET ≥ 2.4 u OFF IT.** The lane
occupies `[tail − dir·(laneLenOf(c) + 0.35), tail]` and it is RAILED on both long
sides, enterable only at the tail. A lane laid ACROSS a street cost **six**
failures in one measured park: **2 `blockers` on its own railings PLUS 4 more** —
every ride downstream of it reported *"reachable only THROUGH a solid object"*,
because the railing severed the single route past it. On a tree-shaped street net
there is no second route, so the multiplier is however many rides sit beyond the
cut. **Compute the span, then hang the tail off a junction as a STUB** rather than
putting it on a through street.

**THE CAP-12 ROW IS THERE BECAUSE IT IS THE ONE THAT FAILED.** `<Discotron>` and
`<AetherBalloons>` both default to capacity 12, and 9.74 u is nearly double the
cap-4 floor — a court sized for a Carousel will not hold either of them.

- **If a ride's tail is not a cell listed in `NODES`, NO QUEUE WAS PLACED.** The
  lane is RAILED on both long sides and enterable only at the tail, so when the
  derived tail lands in open ground the manager attaches a SPUR ONTO THE PAD — a
  `footprints` FAIL, plus a `blockers` one, plus a queue no guest can join. Grep
  every tail coordinate against `NODES` before you ship.
- **On `<Coaster>` / `<FlatRide>` / `<TrackRide>` don't do the arithmetic at
  all:** `queueTailNode={NET.node([22.8, -3.6])} queueDir={[1, 0]}`. **Catalog
  rides (`<Carousel>`, `<Teacups>`, …) do NOT accept `queueTailNode`** — their
  only queue prop is `queue={{ anchor, dir }}`, so name the tail as one
  `const … : XZ` used in BOTH `NODES` and the anchor expression.
- **Pinning `queue.anchor` opts you out** of the auto-`front`, the lane trim, the
  `queueDir` flip and the derived-exit snap — you own the geometry. Its floor is
  **1.57 u** pad → head; 1.8 is the conventional value and lands the pad exactly
  on the AUTHOR column.
- **If you leave `queue` OFF, the reach is NOT COMPUTABLE.** The chassis
  auto-raises `front` to `min(6.5, footMaxZ·scale + 1.27)` on any COMPACT rig
  (span ≤ 10 u — every catalog flat ride), and `footMaxZ` is a property of the
  BUILT MESH (3.13 Carousel, 3.50 TwistRide) you cannot read while authoring.
- **No two rides share a tail node** (`queueTailShared`, §0-FATAL). Two
  capacity-4 rides on the same street clear each other only at centre-to-centre
  pitch **≥ 6 u**; stagger opposite sides to pack tighter.
- An explicit `anchor` sitting ON a street node is now AUTO-CORRECTED to
  `node − dir·(laneLenOf(c) + 0.35)` with a `queueAnchorIsHead` warning. **Write
  the corrected number into the park** — the fix does not move your pad off the
  street.

### (c) A ride has TWO path connections. OMIT `exit` and `exitDir`.

Before the 2026-07 fix, 25 of 26 rides across the reference parks had their exit
standing on bare grass, up to 14.4 u from paving. **`exit`/`exitDir` are OPTIONAL
on `<Coaster>`, `<FlatRide>` and every catalog ride — leave them unset.** The
chassis knows the RESOLVED queue direction and ray-casts both candidate cells
against the real lattice; you cannot beat it.

```
entrance hut = tail − queueDir·(laneLenOf(c) + 0.35 + 0.62)
exit hut     = entrance hut ± 1.2·[−queueDir.z, queueDir.x]   // ONE TILE along the face
exitDir      = queueDir                                        // both doorways face OUT
```

The exit PATH is cast from `exit + 0.62·exitDir`, cardinal, in at most two legs:
the **RAY** (one leg along `exitDir` to the first street node/edge within 9 u) or
the **JOIN** (out level with the queue tail, then one tile across onto it).
Whichever is shorter wins. **A missing or unroutable exit path is a HARD
`accessibility` FAIL** (gate check a4 — RCT2's own `STR_EXIT_NOT_CONNECTED`),
and every platform of a multi-station ride is gated individually by **a4b**.

So the binding layout requirement is that the station face the queue comes off
has **TWO FREE TILES SIDE BY SIDE** — budget the rig `2·0.55 + 1.2 = 2.30 u`
across the face, not one hut's 1.09. Where both cells are illegal the chassis
records `exitFaceBlocked` and does NOT repair onto another face. **Prefer a tail
node that is a JUNCTION**: the exit path then meets the cross-street in the same
`laneLenOf(c) + 0.35` the queue takes, instead of running the lane's length and
turning (measured: 3.7 u vs 3.7-8.2 u on dead-end court spurs).

Keep **`rideDuration` ≤ 12** — the acceptance sim runs
`max(85, ⌈2.5·maxDur + 20⌉)` sim-s (`SIM_SMOKE_SECONDS` was 60 until 2026-07-28)
and needs one full cycle.

---

## Step 6 — the required rides, the roster and the crowd

**A PARK-SPANNING MULTI-STATION MONORAIL, EVERY TIME — `preflight.mjs` REFUSES TO
BUNDLE WITHOUT ONE (gate 6 above).** Its circuit passes each declared world with a
PLATFORM in each. It is VERIFIED (4 platforms, worst clearance 16.66, `closure.gap`
1.800, nothing synthesized, `fatal` unset, 0 compiler warnings), so mounting it is a
ZERO-RISK action and NOT mounting it is the only move with a cost: −1.0, an empty
TRANSPORT category, the roster-novelty floor — and the bundle, so the whole round.

**DO NOT IMPROVISE IT — you have no filesystem while authoring.** A park went looking
for the reference `monorail-ref`, could not find it, and wrote
`<Monorail start={[-42.6,2.6,-14.4]} heading={0}>`. **Neither prop exists.** `<Monorail>`
is a `composableRide`: its transform props are `position` and `rotation`, and it always
compiles its own track from the local origin `[0, beamY, 0]`. Both invented props were
swept into `...rest` and dropped, the ring mounted **at the park origin**, and the park
measured `worldsTouched: 0` against 3 declared — off a *perfect* compile report, which is
the signature of this bug. There is no error message for it.

**COPY THE BLOCK; DO NOT IMPROVISE IT — `MONO_PIECES` AND THE WHOLE `<Monorail>` TAG,
ALL FOUR STATIONS, ARE IN `rules/setup.md` §0-P.4 VERBATIM**, and that file always
arrives whatever else loads. The ring is four `'station'` pieces separated by
`straight 35.3 · turnL 90° r 6 · straight 35.3`, mounted
`position={[-42.6, 0, -9.7]} rotation={0} beamY={2.6} loopSeconds={12} pinned price={0}`
with `queue={{ anchor: [-40.81, -8.4], dir: [1, 0] }}` for deck 0 and the other three in
`register.stations`. Three things no error message will tell you:

- **The tail is TWO straights, `33.5` + `1.5`.** Merged into one 35.0-u piece it emits a
  midpoint, the end point is popped, and `closure.gap` measures **17.80 — FATAL.**
- **`MONO_PIECES` is a real `TrackPiece[]` with NO cast.** A cast hides a misspelt
  `type`; the compile turns fatal, the ride renders translucent red and SKIPS
  registration, and TRANSPORT then reads empty.
- **Do not annotate the opening tag with `{/* … */}` between attributes.** A JSX opening
  tag accepts only attributes and spreads, so esbuild fails with
  `Expected "..." but found "}"` and the park is a blank page. Put notes in prose, or on
  `//` lines INSIDE `register={{ … }}`.

**`register.queueAnchor` IS NOT A FIELD, AND THIS ONE TYPECHECK-FAILS.** `RideRegisterProps`
is exactly `{ name, capacity, rideDuration, loadTime, intensity, price, queueSurface,
exitSurface, board, stations }`. Station 0's lane is **`queue={{ anchor, dir }}` at the TOP
level**; `queueAnchor` / `queueDir` exist only *inside* a `register.stations[]` entry, a
different type. Two homes, two spellings, and mixing them loses the lane.

`price: 0`, `pinned` and `loopSeconds` matching `rideDuration` are all deliberate and
§0-P.4 says why. Pass the compiled points to `<Terrain coasterPts>` so the ground under
the piers is pre-capped.

> **THE PROSE ABOVE HAS FAILED TWICE, SO IT IS A GATE NOW** — gate 6 of the six
> pre-bundle gates above. **A park with no `<Monorail>` is refused before esbuild
> runs** — exit 1, no page, no `validatePark` line, no evidence. Round 12 dropped the
> ring; round 13's park B dropped it again and wrote its reasoning down: *"Given the
> accumulated complexity and one-shot constraint, I'll make pragmatic simplifications…
> use flat/self-contained rides where possible."* Every clause of that was already
> answered in this file. **Paste the block: the "complexity" is one paste and the cost
> of not doing it is the whole round.**
> **AND DO NOT GO LOOKING FOR A PLOT SIZE OUT OF THE GATE'S SCOPE** — see §0-P.4.
> **Build at size 128, omit the `size` prop, and ship the ring.**

At 128 its four decks sit at **(−42.6, −8.4) · (0, 34.2) · (42.6, −8.4) · (0, −51.0)**
and its `position` is the **START POSE `[-42.6, 0, -9.7]`, not the ring centre** —
mounting it at the intuitive `[0, 0, -8.4]` leaves the registered platforms 42 u off the
beam.

Four things this changes about the LAYOUT:

- **Put the worlds ON the ring** — choose >= 3 of those four compass points as your
  world centres' neighbours and each world gets a platform for free. A world in a plot
  corner, off the ring, cannot have one. **And the ring must pass through EVERY declared
  world, not most of them:** four decks and three worlds is not a pass by arithmetic —
  the test is whether each world's RECT contains a deck, and round 12 mounted all four
  platforms and still measured `everyWorldTouched` **2 of 3**. Read
  `probe.monorail.worldsTouched` against `worldsDeclared` (both COUNTS), find the missing
  name in **`worldsTouchedIds`**, then **move that WORLD's rect** — the decks are fixed.
- **WALK THE FOUR DECKS AGAINST YOUR SEED'S WATER BASINS BEFORE YOU PIN THE SEED** —
  Step 1 has the 16-cell list and the seed shortlist. A deck inside a basin shrinks
  that body and fails `terrain`.
- **Each platform needs an AUTHORED street node for its queue tail** at
  `deck ± left·6.6` (`[−36.0, −8.4]` · `[0, 27.6]` · `[36.0, −8.4]` · `[0, −57.6]`), with
  **NOTHING within 6.0 u of the deck pad itself** and its own connected exit lane.
  `queueDir === left` (the ring INTERIOR) for W/N/E; **SOUTH takes `−left` = `[0, −1]`,
  OUTWARD** — Step 1's SOUTH-QUEUE note has the measurement.
- **THE RING DOES NOT SATISFY THE GATE-WALK BUDGET.** Even its closest platform is 24.0 u
  of street from the turnstile, past the 20-u practical maximum, so **pair it with a
  separate NON-monorail ride whose queue tail is inside 15 u of the gate** to carry the
  smoke cycle. And do not claim guests "travel" on it: RCT2 has no transport routing, and
  `probe.sim.transfers` is the only number you may claim. Do NOT drop the ring to dodge a
  lake — the beam flies 2.45 u of soffit over water, streets and stalls alike.

**WRITE THE FIVE CATEGORY NAMES IN THE HEADER BEFORE ANY JSX.** Category coverage
is decided at planning time and cannot be repaired at the end — a park that
mounts rides first and counts categories afterwards lands on 3. Fill it in this
order and it fills itself: **transport = the monorail ring you already ship**,
**thrill = the §4.0 flagship**, then pick **water** and **dark** off the
never-used table (the entire DARK category — `GearworksExpress`, `GhostTrain`,
`HauntedMansion` — has never been built by anybody), then **gentle** last from
whatever the worlds want. Ship **≥ 8 rides** (the axis pays full count marks at
5, which is why parks stop there and lose three other sub-tests), all DISTINCT
kinds, and take ≥ 2 off the never-used list. See **ride-and-stall-roster**.

The roster line is **written LAST, counted off the `register={{…}}` calls that
actually mount**, and restated machine-readably so the gate can check it:
`<Park roster={{ rides: ['Timberline Racer', …], stalls: 4, categories: 5 }}>` —
otherwise `rosterOverstated`. A FATAL compile is the trap that makes this bite:
an unregistered ride's category reads empty.

### `preflight.mjs` HAS **SIX** PRE-BUNDLE GATES, NOT TWO — and one is the §0 HEADER

`preflightCheck` runs five checks and `checkPreflightHeader` emits **two** problems, so
there are six ways to be refused, and `eval.mjs` exits 1 on any of them. **No esbuild,
no browser, no screenshot, no `validatePark` line — the round scores 0 by absence of
evidence and the symptom looks like a harness bug.**

**ALL SIX ARE ENUMERATED, WITH A FIX EACH, IN `rules/setup.md` §0-P.3, AND THE §0 HEADER
FILL-IN TEMPLATE IS IN §0-P.1 — both always arrive.** One line each: `checkImports` (a
relative import naming a component that is not a directory under `mp3d/components/`,
checked across EVERY local file, not just the entry) · `checkPiecesCast`
(`pieces={… as string[]}` on a ride tag) · `checkRatingsWithoutMeasurement` (an authored
`ratings={{…}}` with no `rateCoaster(` call anywhere in the file) · **no §0 header** ·
**no `roster=` prop on `<Park>`** (the header COMMENT does not substitute; round 12
shipped exactly that pair) · **no `<Monorail>`** (no in-file marker and no prop value
suppresses it — paste the Step 6 ring).

Two facts out of §0-P.1 worth restating because they each cost a whole round: the header
must be the file's **LEADING comment, physically ABOVE the imports** — one `import` line
above it makes the inspected block empty and the gate fires with the header right there
in the file — and it must be **>= 200 characters** AND hit one of the thirteen
`HEADER_KEYWORDS`. FORM is not policed, PRESENCE is. **Write it FIRST, at the top, and
finish it LAST, every number COUNTED off the file you are shipping.**

Run `node preflight.mjs samples/<park>.tsx` FIRST, every time — it costs milliseconds.
Two more that look like a pass and are not: a **nonexistent entry file** and a walk that
**collected zero source files** both report *"nothing was linted (this is not clean)"*.
`[preflight] <file>: clean` is the only green line.

**Counts on a 128 plot:** ≥ **32 trees** (MIXED shapes) · ≥ **16 scenery** with
`varietyIndex` ≥ 6 · ≥ 1 stall per 2 rides and ≥ **3 DISTINCT stall kinds
spanning FOOD *and* DRINK**, every one themed-named · ≥ 1 `<Restroom>` · `bins`
at 2-3 junction verges · ≥ 1 `<Lights>` RUN PER DISTRICT laid ALONG the street
(a 2.4-u stub between two adjacent nodes is not a run) · under ~**3 000 draw
calls** · under **160 000** meshes.

**THE CROWD SIZES ITSELF — do NOT pass `guests`.** `<Park guests>` defaults to
`guestsForSize(size)` = `clamp(round(50·(size/128)^(2/3)), 6, 80)` — **50 at 128**
(hard ceiling 100), 26 at 48, 13 at 16. Every big-plot park that hand-wrote
`guests={18..20}` renders as an empty green field with a few figures on it. And
they keep arriving: with a `<Gate>` mounted, RCT2's own generation streams guests
in, gated on park rating, which is dominated by the share over `happiness > 128`
— measured **20.3 arrivals/min at ≥ 83 % happy, 2.0/min at 0 %**. Two planning
consequences: RCT2's soft cap (Σ ride BonusValue) QUARTERS the arrival rate once
population passes it, so give the crowd somewhere to go (measured: 6 rides + 3 stalls
grew 50 → 120 in 240 sim-s; 1 ride crawled 50 → 73 then drained to 48); and pasting a
real **measured** `rateCoaster` triple into `register={{ ratings }}` raises the rating
AND the crowd, because an unrated ride still costs the −100/−200 baseline. **Do not
author `ratings` without a `rateCoaster(` call in the file — that is pre-bundle gate 3.**

---

## The plot-utilisation floors — what actually binds at 128

The old "3 of 4 quadrants hold something" check is **RETIRED on plots > 48**:
measured over all 16 published rows at 128, every one of the four 64 × 64
quadrants has 34.5-94.5 % of itself buildable on every row, so the check is
satisfied by three benches. What binds is WALKING DISTANCE and SPREAD:

1. **GATE PROXIMITY.** The NEAREST ride's queue TAIL — whichever queue is closest
   to the gate, not every ride — within **15 u** of the gate cell by street
   distance; 20 u practical max. Re-measured 2026-07-28 against the BOARDING-QUIET
   departure rule and the 85 sim-s window it raised (`SIM_SMOKE_SECONDS` 60 → 85):
   15 u completes its first cycle at 62.0 sim-s, 20 u at 68.5 s, 30 u at 82.5 s,
   **32 u at 87.0 s which FAILS the 85 sim-s window.** Each extra unit of walk
   costs 1.52 sim-s (fixed overhead 37.5 s), and **past ~72 u no window length
   rescues it** — guests run out of patience before arriving. A CROWD now makes
   this harder, not easier (every boarding re-arms the quiet window, so the dwell
   stretches): at 15 u the worst cell over 12/22/50/75/100 guests is 73.5 s, still
   inside 85 s. Other queues may sit at 40-70 u and still pass.
2. **THE GATE-REACH BAND CONSTRAINS RIDES, NOT THE PARK.** Everything a guest
   visits inside the smoke run lies within ~75 u of the gate: at 128 that is
   `x ∈ [−64, 64], z ∈ [−11.4, 63.6]`. Put every ride station, queue tail, the
   hub and the stalls IN it. **It is a floor on what must be inside, never a
   ceiling on what may be outside** — one park hard-coded the band into its
   scatter guard and landed `plotUtilisation 0.302`, `pathExtentFraction 0.131`,
   two dead quadrants. Deliberately OUTSIDE the band: secondary districts,
   boulevards, satellite attractions (a viewpoint, a bandstand, a shoreline
   promenade with a stall), plazas, and the street LOOP that reaches them. A
   satellite needs only a path and a plaza to score.
3. **SPREAD.** The bounding box of everything you BUILD spans **≥ 70 u in x and
   ≥ 45 u in z**. That is a floor on the RIDES, not a target: the thing axis 15
   measures is the **STREET-NODE bbox** — `pathExtentFraction ≥ 0.55`,
   `occupancyFraction ≥ 0.35`, `quadrantSpread ≥ 0.75`, `plotUtilisation ≥ 0.70`.
   A FEATURE is a street node, ride, stall or plaza rect — **trees and scenery do
   not count**, so "I dressed the south with a grove" moves nothing.
4. **FILL THE SOUTH.** The loss is always the same shape: one park measured
   `quadrantCounts [1, 4, 57, 63]` with its whole street net in z ∈ [−3.6, 63.6]
   and `plotUtilisation 0.679`, just under the line, for want of one leg. **The
   loop's return leg must CROSS z = 0** and put real features in at least THREE
   quadrants — no quadrant under ~10 features.
5. **DISTRICT SEPARATION ≥ 32.66 u** at 128 (aim 40), and remember anything under
   `0.6 ×` the floor (**19.6 u**) is not a near miss but a MERGE — two rides that
   close are ONE district to the scorer, however you label them.


---

**For the two verified worked node-table skeletons, their required anti-template
transformations, and the axis-15 novelty/density-class findings, see the
companion skill `park-skeletons`.**

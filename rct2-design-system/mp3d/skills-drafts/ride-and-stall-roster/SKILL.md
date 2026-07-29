---
name: ride-and-stall-roster
description: "Use whenever a park needs its ride line-up or its shops chosen and placed with the mp3d rigs - picking rides beyond the coaster, covering the five ride categories, filling a world or district, adding a transport, water or dark ride, deciding whether to pass pieces, or placing stalls, restrooms and the <Bazaar>. Gives the catalog inventory with per-ride layout numbers (board, capacity, footprint, siting), the never-used shelf that wins category and novelty points, the multi-station monorail as copy-paste JSX - which preflight.mjs REFUSES TO BUNDLE without at size 64 or above, and which takes position/rotation and NEVER start/heading - the tail-first queue arithmetic per ride including the cap-12 9.74 u pad floor and padMarginOf(rig), the terrain-blindness of offPathCell and the assertPadFlat that closes it, the <Bazaar> 3-6 stall floor, the 2.4 u row offset the plan does not apply, its dressing halo, the intrinsic padNearStreet that is NOT an author defect, the names prop, and the roster assertions."
---

# The ride and stall roster — pick for CATEGORIES, then place

Agent parks keep shipping the same six spinners while most of the catalog sits
unused, then lose points for a thin line-up. The catalog is **44 rides / 10
stalls**, and across the whole sample corpus **25 of the 44 rides have NEVER been
used** — including the entire **DARK category, all three of its rides, never built
by anybody** (`cd harness/park-eval && node usage.mjs` prints the live list).

The default plot is **128** (omit `<Park size>`). Targets: **≥ 8 registered
rides** (the axis pays full COUNT marks at 5, which is exactly why parks stop
there and lose three other sub-tests), **all FIVE categories**, all DISTINCT
kinds, **≥ 2 rides off the never-used table below**, **≥ 1 stall per 2 rides**
with **≥ 3 distinct stall kinds spanning FOOD *and* DRINK**, and rides spanning
the intensity bands: gentle (≤ 3), moderate (4-6), intense (≥ 7). **Those three
bands are the PARK MIX (`probe.thrill.intensityMix`, computed off the REGISTERED
`intensity` prop of every ride) and the gentle and moderate ones can ONLY come from
the FLAT/TRACKED roster — every §4.0 coaster archetype rates `I > 6`. The
COASTER-vs-COASTER band test is a different field, `rateCoaster`'s own `ratingBand`:
see the box below.**

> ## AND COUNT THE **CIRCUITS**, NOT JUST THE CATEGORIES — 2 COASTERS, 5 CIRCUITS
>
> The `CATS` row below can read a clean 5/5 off a park that is **one coaster and
> four flat spinners**, and that is exactly what the corpus shipped: **16 of 20
> probed parks registered exactly ONE coaster, 3 registered none, one registered
> two.** Nothing asked for a second, because every rule and the whole Thrill axis
> were written around a singular flagship. Fixed 2026-07-26. At size 128:
>
> | | requirement |
> |---|---|
> | **coasters** | **2**, from DIFFERENT §4.0 archetypes, on **DIFFERENT `rateCoaster` `ratingBand`s** — A I 9.32 *intense* · B I 6.25 ***thrilling*** · C I 9.55 *intense* → **A+B or C+B, never A+C**. **DO NOT hand-roll the split:** all three rate `I > 6`, so the `≤3 / ≤6 / >6` PARK-MIX bands put every coaster in one band and can never separate two of them (a published defect — `probe.thrill.secondDistinctBand` reads `false` on a CORRECT A+B park, and nothing was ever scored off it). Read `ratedCoasters[].ratingBand`. |
> | **circuits, total** | **5**, across **≥ 3** of the five circuit families `coaster / water / transport / dark / tower`. The monorail ring is one. |
> | **novelty** | ≥ 1 circuit off the never-used shelf — **14 of the catalog's 27 CIRCUITS have never shipped** |
>
> **A CIRCUIT is a ride that runs a vehicle along a track.** Flat spinners do
> not count, and this is a different test from the old `hasSpeciality` yes/no:
>
> | family | rides |
> |---|---|
> | **coaster** | `Coaster` `TrackRide` `SplineCoaster` `MineTrainCoaster` `Bobsleigh` `Bassline` `EmberWings` `LavaTubeRun` `WyrmsHollow` `ReefRacer` |
> | **water** | `LogFlume` `RiverRapids` `DeepDrift` `OceanTunnelSlide` `MagmaRun` `MoonlitBarge` `PaddleBoats` |
> | **transport** | `Monorail` `Chairlift` `MagneticRide` `GoKarts` |
> | **dark** | `GhostTrain` `HauntedMansion` `GearworksExpress` |
> | **tower** | `ObservationTower` `Helicycles` `MotionSimulator` |
>
> **NOT circuits** (however good they are): `Carousel` `FerrisWheel` `Teacups`
> `SpaceRings` `TwistRide` `BumperCars` `FlyingSaucers` `AetherBalloons`
> `DropTower` `Enterprise` `LaunchedFreefall` `PirateShip`
> `SwingingInverterShip` `SwingRide` `TopSpin` `BoilerBurst` `Discotron`.
>
> **AND FIVE CIRCUITS COST FIVE LINES.** Only `<Coaster>`, `<TrackRide>` and
> `<SplineCoaster>` need a `pieces` array. Every other circuit either guards the
> call (`LogFlume` `RiverRapids` `Chairlift` `Bobsleigh` `GoKarts` `Monorail` —
> `compileTrackPieces` is **never invoked** without `pieces`) or compiles its own
> shipped default (the twelve themed circuits — **all twelve verified `ok`,
> `closed: true`, 0 synthesized, 0 warnings on 2026-07-26**). See Step 2.
>
> Measured footprints, so the arithmetic is in front of you: a §4.0 archetype
> coaster mounts **39.8 × 39.8 u**; `ReefRacer` 29.6 × 43.4; `EmberWings`
> 24.2 × 31.3; `LogFlume` 15.6 × 15.0; `MoonlitBarge` 12.7 × 15.4; `Bobsleigh`
> 8.7 × 11.0; `RiverRapids` 8.8 × 7.1; `GhostTrain` 4.5 × 8.5; `Chairlift`
> 6.1 × 6.2; `PaddleBoats` 5.2 × 5.2; `ObservationTower` 2.9 × 2.9. `r13b`
> carried **7 circuits, 3823 u², 23 % of a 128 plot, and passed the gate** — plot
> AREA is not what limits a circuit roster.

> ## ⚠ THIS FILE HAS NO FILESYSTEM BEHIND IT. EVERY BLOCK YOU NEED IS INLINE.
>
> You receive injected rule TEXT and loaded SKILL BODIES — not a checkout. Round 13's
> park A searched the project for `monorail-ref` and for `park-generation-rides.md`,
> found neither, and reported *"the rules files and reference samples aren't in the
> project (they live in the design system bundle)."* It then improvised the mandatory
> monorail from memory and wrote `start` / `heading`, two props that do not exist.
>
> So a pointer is not a delivery. A file path or a `§x.y` in this skill is
> **PROVENANCE** — where the number was measured — and **never an instruction to go
> and fetch anything.** The ring's full JSX is in Step 3 of this file, the corrected
> `place()` is in Step 4, and the naming and roster assertions are in Steps 1b and
> the roster section. **If a block is not here, it does not exist — do not
> reconstruct it from memory.**

The always-on checklist was written in `rules/park-generation.md` §0 and the catalog
rows in its inventory and `-composition.md` §3's world table — **cited purely for
provenance: neither file is ever delivered into a generation.** The checklist that
DOES arrive with every request is **`rules/setup.md` §0-P** (published from
`mp3d/SETUP.md`): the six pre-bundle gates, the §0 header template and the mandates.
This skill carries the per-ride numbers, the picking procedure and the copy-paste JSX.

## Step 1 — WRITE THE FIVE CATEGORY NAMES BEFORE ANY JSX

Category coverage is decided at planning time and **cannot be repaired at the
end** — a park that mounts rides first and counts categories afterwards lands on
3. Fill the line in this order and it fills itself:

```
 * CATS   gentle <ride> · thrill <ride> · water <ride> · transport <ride> · dark <ride>   → 5/5
 *        never-used picks: <ride>, <ride>  (≥ 2, off the table below) ✓
 * CIRCUITS  <5 named>   families: coaster+water+transport(+dark/tower)  → 5 / 3 fam ✓
 *        coasters: <name> §4.0-A E _._ I _._  ·  <name> §4.0-B E _._ I _._   (2, DIFFERENT archetypes) ✓
```

1. **transport = the §4.2-A monorail ring you are already required to ship.**
2. **thrill = the TWO §4.0 coasters** — different archetypes, different intensity
   bands (coaster-pieces skill, Step 0).
3. **water and dark off the never-used table** — both categories are mostly or
   entirely unbuilt, so both picks double as roster novelty, and both are
   CIRCUITS, so they count toward the five.
4. **gentle last**, from whatever the worlds want.
5. **Then count the CIRCUITS row.** If it reads fewer than 5, or fewer than 3
   families, add another one-line no-`pieces` circuit — do not add a spinner.

| category | never used yet |
|---|---|
| **dark** (0 of 3 EVER used) | `GearworksExpress`, `GhostTrain`, `HauntedMansion` |
| transport (2/3) | `Chairlift`, `MagneticRide` |
| water (5/8) | `PaddleBoats`, `ReefRacer`, `DeepDrift`, `OceanTunnelSlide`, `MagmaRun` |
| thrill (11/20) | `Bobsleigh`, `GoKarts`, `MotionSimulator`, `LaunchedFreefall`, `SwingingInverterShip`, `Bassline`, `EmberWings`, `LavaTubeRun`, `MineTrainCoaster`, `WyrmsHollow`, `SplineCoaster` |
| gentle (4/10) | `BumperCars`, `FlyingSaucers`, `Helicycles`, `SpaceRings` |
| stalls (1/10) | `EmberRoast` |

**One dark ride + one transport ride + one unused water ride wins axis 13's
category-balance (1.5) AND most of its CIRCUIT row (1) AND clears the 0.4
roster-novelty floor in a single decision** — all three of those picks are
circuits, so the same decision moves the Thrill axis's roster term too. Measured cost of not doing it: a
park with 6 rides, transport EMPTY, and 5 of its 7 kinds shared with the
reference park scored roster novelty **0.375** against the 0.4 floor — half
credit, on a park that had already reached for a dark ride.

Each of the ≥ 3 declared WORLDS must mount at least one ride **from its own row**
(`-composition.md` §3): emberfall → `MagmaRun`/`EmberWings`/`LavaTubeRun`/
`Volcano`; tidewater → `ReefRacer`/`DeepDrift`/`OceanTunnelSlide`; brasswork →
`GearworksExpress`/`AetherBalloons`/`BoilerBurst`; thornwick →
`WyrmsHollow`/`MoonlitBarge`/`MagicMirror`; pulse → `Bassline`/`Discotron`. The
Emberfall and Tidewater worlds are unused *entirely* — building either is the
cheapest novelty in the book.

## Step 1b — EVERY REGISTERED RIDE NEEDS A THEMED NAME, AS HARD AS EVERY STALL

**The stall naming rule is stated three times in this file and parks now get 9/9
on it. There was no equivalent line for rides, and parks get 8/10.** Round 13's
park B themed eight of ten — "Thunderhead", "Skyline Chairlift", "Haunted Hollow",
"Alpine Bobsleigh", "Skyward Tower", "Ember Wings", "Reef Racer", "Tidewater
Paddle Boats" — and then shipped `<Carousel register={{ name: 'Carousel' }}>` and
`<Discotron register={{ name: 'Discotron' }}>`. A ride called "Carousel" reads
exactly as unfinished as a shop called "Soda Stand", and it is the same fix: one
string.

**THE MECHANICAL FORM — pair every name with the COMPONENT it mounts on, and
assert.** Most catalog defaults are the component's own name, either verbatim
(`Carousel`, `Discotron`, `Teacups`, `Bassline`, `Bobsleigh`, `Chairlift`,
`Enterprise`, `Helicycles`, `Monorail`) or de-camel-cased (`FerrisWheel` → "Ferris
Wheel", `GhostTrain` → "Ghost Train", `ReefRacer` → "Reef Racer", `EmberWings` →
"Ember Wings", `PaddleBoats` → "Paddle Boats", `ObservationTower` → "Observation
Tower"). So both forms are checkable in three lines:

```tsx
const deCamel = (s: string) => s.replace(/([a-z0-9])([A-Z])/g, '$1 $2');

// [component kind, THEMED name] — one entry per REGISTERED ride, written FIRST.
const RIDE_ENTRIES: [string, string][] = [
  ['Coaster',          'Thunderhead'],
  ['Monorail',         'Willowmere Skyline'],
  ['Carousel',         'Willowmere Gallopers'],   // NOT 'Carousel'
  ['Discotron',        'Bassline Ballroom'],      // NOT 'Discotron'
  ['ReefRacer',        'Coralbreak Run'],         // NOT 'Reef Racer'
  ['EmberWings',       'Cinderhawk'],             // NOT 'Ember Wings'
  ['GhostTrain',       'Haunted Hollow'],
  ['Chairlift',        'Skyline Chairlift'],
  ['Bobsleigh',        'Alpine Bobsleigh'],
  ['ObservationTower', 'Skyward Tower'],
  /* …one row per register={{ name }} that actually mounts */
];
RIDE_ENTRIES.forEach(([kind, name]) => {
  if (name === kind || name === deCamel(kind))
    throw new Error(`ride '${name}' IS <${kind}>'s catalog default name — theme it, exactly as you theme a stall`);
});
const RIDE_NAMES = RIDE_ENTRIES.map(([, n]) => n);   // ← the roster prop reads THIS

<Carousel position={CAROUSEL.pad} register={{ name: RIDE_ENTRIES[2][1], capacity: 8, /* … */ }} />
<Park roster={{ rides: RIDE_NAMES, stalls: STALL_COUNT, categories: 5 }}>
```

Run against round 13's park B this throws on **four** rides, not the two the axis
happened to name: `Carousel` and `Discotron` are equal to their kinds, and its
"Reef Racer" and "Ember Wings" are `ReefRacer`'s and `EmberWings`'s defaults
verbatim.

**AND THERE IS NO "IT ALREADY SOUNDS LIKE A NAME" EXEMPTION.** This is the one both
graded parks granted themselves, in both rounds. Round 13's park A themed eight rides
and then shipped `register={{ name: 'Discotron' }}` — the catalog default — and put
"Discotron" in the roster prop, because *Discotron* reads as flavourful in a way that
*Carousel* does not. **The axis does not care how flavourful the default sounds; it
compares the string to the component's own default and 8/10 is 8/10.** A world's
flagship is exactly the ride a guest reads the sign on, so it is the LAST one to
leave unnamed:

| component | catalog default | a PARK name |
|---|---|---|
| `Discotron` | "Discotron" | "The Bassline Ballroom" |
| `AetherBalloons` | "Aether Balloons" | "Zephyr Ascent" |
| `Honeywitch` | "Honeywitch" | "Mother Thornwick's Kettle" |
| `Bassline` | "Bassline" | "Subwoofer Six" |
| `MoonlitBarge` | "The Moonlit Barge" | "Glimmerwake" |
| `Monorail` | "Monorail" | "Grand Circle Monorail" |

**Every registered ride in the park is a row in `RIDE_ENTRIES`, including the ring
and including each world's flagship** — the assertion is only as complete as the
array, so build the array first and read `register={{ name }}` out of it. That is
also what makes `rosterOverstated` impossible.

**SEVEN CATALOG DEFAULTS ARE HAND-PICKED AND THE `deCamel` TEST CANNOT SEE THEM** —
`MagneticRide` → "Maglev Glider", `MineTrainCoaster` → "Mine Train",
`MoonlitBarge` → "The Moonlit Barge", `OceanTunnelSlide` → "Deepwater Chute",
`SplineCoaster` → "Coaster", `TwistRide` → "Twist", `GoKarts` → "Go-Karts". If you
mount one of those seven, check its name by eye against this list.

> ### ⚠ AND THIS IS STILL COSTING THE REFERENCE PARK POINTS TODAY (2026-07-27)
>
> **`samples/skeleton-a.tsx` — the worked two-coaster skeleton — loses 0.07 on axis
> 11 for exactly one string:** it registers `<MagneticRide name="Maglev Glider">`,
> and "Maglev Glider" IS that rig's catalog default
> (`mp3d/components/MagneticRide/index.tsx`: `defaults: { name: 'Maglev Glider',
> capacity: 8, rideDuration: 22, intensity: 2, price: 3 }`). It sits in the
> hand-picked seven above, it sounds bespoke, and it survived every review.
>
> **SO DO NOT CHECK BY EYE — CHECK AGAINST THE RIG.** The `deCamel` assertion above
> catches the mechanical cases; the complete test is **compare each registered
> `name` against that component's own `defaults.name` and require a difference.**
> Every catalog rig exports its `defaults` block, so this is readable, not
> remembered. Run it over ALL of them, including the ring and each world's flagship —
> a flavourful default is precisely the one you will miss.

Two more reasons beyond the axis: **names are the manager's PRIMARY KEY**, so a
duplicate makes the corridor resolver move the wrong ride; and the roster prop is
audited against what registered, so building the prop out of the same array the
`register` calls read from is what makes `rosterOverstated` impossible.

## Step 2 — THE `pieces` DECISION, and it is usually "don't"

This is the rule that saves the most rides, and it is one prop SHORTER than the
failure. **It is also what makes the five-circuit roster affordable: only THREE
components in the whole catalog require a `pieces` array.** Verified 2026-07-26
by compiling every shipped default through the real `compileTrackPieces`
(`harness/park-eval/probe-tracked-roster.mjs`):

| mode | rides | with NO `pieces` prop |
|---|---|---|
| **REQUIRED** | `<Coaster>` `<TrackRide>` `<SplineCoaster>` | nothing renders — copy §4.0-A/B/C (or §4.2-A for the ring) |
| **GUARDED** — `if (opts.pieces) {…}` | `<LogFlume>` `<RiverRapids>` `<Chairlift>` `<Bobsleigh>` `<GoKarts>` `<Monorail>` | **`compileTrackPieces` IS NEVER CALLED.** No closure report, no `report.fatal`, no synthesized leg. `<LogFlume position={…} register={{…}} />` is a registered, rated WATER ride with **zero closure risk**. (`<Monorail>` without `pieces` is the legacy district shuttle — the park-spanning ring still needs §4.2-A.) |
| **OWN DEFAULT** — `opts.pieces ?? DEFAULT_PIECES` | `<Bassline>` `<DeepDrift>` `<EmberWings>` `<GearworksExpress>` `<LavaTubeRun>` `<MagmaRun>` `<MagneticRide>` `<MineTrainCoaster>` `<MoonlitBarge>` `<OceanTunnelSlide>` `<ReefRacer>` `<WyrmsHollow>` | the component's own circuit compiles. **All twelve: `ok`, `closed: true`, 0 synthesized, 0 warnings.** Track spans 8.5 × 6.1 u (MoonlitBarge) → 27.3 × 25.6 u (LavaTubeRun) — all smaller than §4.0-B's 28.9 × 30.4. |
| **own rig** | `<PaddleBoats>` `<GhostTrain>` `<HauntedMansion>` `<ObservationTower>` `<Helicycles>` `<MotionSimulator>` | no `pieces` prop exists — builds its own geometry |

**So the ONLY `pieces` arrays a compliant park writes are: the two §4.0 coasters
and the §4.2-A monorail ring. Three arrays, all copied verbatim.** Everything
else on the five-circuit roster is a one-line element, and none of the
no-`pieces` circuits feeds `<Terrain coasterPts>`, so none of them costs the park
any composed relief.

**AUTHOR YOUR OWN CIRCUIT — AND VERIFY IT.** Every spline rig below accepts a
`pieces` array, and shipping without one means your `<LogFlume>` is the *same
flume* as in every other park that ever mounted it. **The one exception is
`<Monorail>`: use the published four-platform ring VERBATIM** (a hand-authored
list once synthesized 52 % of its arc and shipped an unboardable ride).

The risk is real and so is the cure. An improvised list does not fail loudly: the
compiler SYNTHESIZES a Dubins return leg, and a synthesized closure over **40 % of
the authored length is FATAL** — translucent red, NEVER registered, no station, no
queue, and the category you thought you filled reads EMPTY. Measured: one park lost
BOTH tracked rides that way in one file.

**So compile and check it at module scope, where you can still act on the answer:**

```ts
const out = compileTrackPieces(MY_PIECES, { profile: 'flume', start: [0, 0.6, 0], bounds: SIZE });
console.log('[park] flume', { ok: out.report.ok, fatal: out.report.fatal,
  synthesized: out.report.synthesizedCount, arc: out.report.arcLength });
```

Land the last authored piece **~0.3 u short of the start, on the station axis**, and
the closure has almost nothing to invent. If it still fails, fall back to the stock
layout by dropping the `pieces` prop — a stock ride that registers beats a custom one
that renders red.

<!-- retained detail --> An improvised
list does not fail loudly: the compiler SYNTHESIZES a Dubins return leg, and a
synthesized closure over **40 % of the authored length is FATAL** — translucent
red, NEVER registered, no station, no queue, and the category you thought you
filled reads EMPTY with nothing in the report but a console line. Measured: one
park lost BOTH tracked rides this way in one file — `<TrackRide>` closed with
20.7 u synthesized against 31.1 u authored (66 %) and `<LogFlume>` with 19.2 u
against 25.5 u (75 %) — **−7.0 on thrill, −0.5 on roster, and an empty WATER
category, from two hand-written arrays.** A verified custom `<LogFlume>` circuit
is commissioned and pending; until it appears in §4.0-D there is nothing to copy
and therefore nothing to author.

Note that a `Context.md` illustration is NOT a published block — `<Chairlift>`'s
documented triangle in particular is an illustration and is not gate-verified.
And `<Chairlift>`/`<GoKarts>` do **not** mark themselves invalid on a FATAL
compile; they just stash the report, so a broken circuit there is silent.

## Step 3 — the multi-station MONORAIL is a PRE-BUNDLE GATE, not a requirement

> **`harness/park-eval/preflight.mjs` REFUSES TO BUNDLE a park that mounts no
> `<Monorail>`.** Exit 1, no esbuild, no page, no `validatePark` line, no
> evidence — the same class of gate as a missing `<Park roster>` prop.
>
> **It became a gate because this section, written as advice, failed twice.**
> Round 12 dropped the ring. Round 13's park B dropped it again and left the
> reasoning in the transcript: *"Given the accumulated complexity and one-shot
> constraint, I'll make pragmatic simplifications… use flat/self-contained rides
> where possible."* The ring IS self-contained — it is a verbatim paste with a
> verified compile — so the sentence was false as well as expensive. **There is no
> trade-off to weigh and no version of the park that ships without it.**
>
> **AND DO NOT GO LOOKING FOR A WAY OUT OF THE GATE'S SCOPE. There isn't one, and
> hunting for one is how a round was lost:** a park chose a smaller plot
> specifically to get out of scope of the mandatory-monorail and two-water-body
> rules, and paid for it with the ring, all three worlds, its second coaster and a
> water body. **Build at size 128 — omit the `size` prop — unless the user asked
> for something else, and ship the ring.** There is also deliberately no in-file
> marker that suppresses this check.

**`<Monorail>` IS MULTI-STATION.** RCT2's own transport rides are built for it
(`ride/rtd/transport/Monorail.h:19-84` sets neither `RtdFlag::hasOneStation` nor
`hasSinglePieceStation`; the legacy save format caps it at **4** platforms,
`rct12/Limits.h:21`). It is VERIFIED (4 platforms, worst clearance 16.66,
`closure.gap` 1.800, nothing synthesized, 0 compiler warnings, `validatePark →
ok: true`), so mounting it is a zero-risk action and skipping it is a guaranteed
−1.0 plus an empty TRANSPORT category plus the roster-novelty floor — and the
whole round, because the bundle is refused.

### THE RING, AS COPY-PASTE JSX. IT IS HERE. DO NOT GO LOOKING FOR IT.

> **THIS SECTION USED TO SAY "paste §4.2-A verbatim from
> `rules/park-generation-rides.md`". THAT IS A DEAD POINTER AND IT COST A ROUND.**
> The park author receives injected rule text and loaded skill bodies — **not a
> filesystem.** Round 13's park A searched for `monorail-ref` and for
> `park-generation-rides.md`, found NEITHER, and reported *"the rules files and
> reference samples aren't in the project (they live in the design system
> bundle)."* It then improvised the ring from memory and wrote
> `<Monorail start={[-42.6, 2.6, -14.4]} heading={0}>`.
>
> **`<Monorail>` HAS NO `start` AND NO `heading`.** It is a `composableRide`: its
> transform props are `position` and `rotation` (radians), exactly like every other
> catalog ride, and it ALWAYS compiles its own track from the local origin
> `[0, beamY, 0]`. Both invented props were silently dropped — no error, no lint —
> the entire ring mounted **at the park origin**, and the park measured
> `worldsTouched: 0` against 3 declared, one dead street node, and a degenerate
> 1.2-u spur reading a **1.57e14** grade.

```ts
// THE 17-PIECE MONORAIL RING — one canonical copy lives in `rules/setup.md` §0-P.4
// (and in rules/park-generation-monorail.md). It was duplicated in SIX files; five
// copies could drift and none was authoritative. COPY IT FROM THERE, VERBATIM —
// the monorail is the ONE ride you must not re-author (a hand-written list once
// synthesized 52 % of its arc and shipped an unboardable ride).
const MONO_PIECES: TrackPiece[] = [ /* see rules/setup.md §0-P.4 */ ];
```

**`register.queueAnchor` IS NOT A FIELD, AND THIS ONE TYPECHECK-FAILS.**
`RideRegisterProps` is exactly
`{ name, capacity, rideDuration, loadTime, intensity, price, queueSurface, exitSurface, board, stations }`
— nothing else. Round 13's park A wrote
`register={{ name: 'Skyline Monorail', capacity: 6, …, queueAnchor: [-35.44, -8.4], queueDir: [1, 0] }}`.
**There are TWO homes for a lane and they are different types.** Station 0's lane is
`queue={{ anchor, dir }}` at the **top level** of the component; platforms 1-3 carry
`queueAnchor` / `queueDir` **inside a `stations[]` entry** (a `GMRideStationConfig`).
Put a `queueAnchor` on `register` itself and platform 0 has no lane at all.

`price: 0` is deliberate and it is RCT2's own rule — `Guest::shouldGoOnRide` skips
the rating / price / crash / weather checks for a FREE transport ride and lets even a
guest who is LEAVING THE PARK board one (`entity/Guest.cpp:1989-1998`). Charge for it
and it stops being infrastructure. `pinned` because an 85-u circuit must never be
nudged by the settle-time corridor resolver. `loopSeconds` matches `rideDuration` so
the glider reaches each platform just before the FSM's `arriving`. Pass the compiled
points to `<Terrain coasterPts>` so the ground under the piers is pre-capped.

What you must get right around it:

| | value at 128 |
|---|---|
| `position` | **`[-42.6, 0, -9.7]` — the START POSE, not the ring centre.** The ring grows EAST and centres on (0, −8.4); mounting it at `[0, 0, -8.4]` leaves the registered platforms 42 u off the beam |
| props | `beamY={2.6}` (the **1.2 default BLOCKS every street it crosses**; 2.6 gives a 2.45-u soffit = 2.36 u over a slab vs the 2.2 gate), `loopSeconds={12}`, `pinned`, `price={0}`, `capacity 6`, `rideDuration 12`, `intensity 1` |
| the tail | **TWO straights `(33.5, 1.5)`. Merging them reads `closure.gap` 17.80 and is FATAL** — measured both ways |
| decks | W `[-42.6, 2.6, -8.4]` · N `[0, 2.6, 34.2]` · E `[42.6, 2.6, -8.4]` · S `[0, 2.6, -51.0]` |
| queue tails (AUTHOR each as a street node, at `deck ± left·6.6`) | `[-36.0, -8.4]` · `[0, 27.6]` · `[36.0, -8.4]` · `[0, -57.6]` |
| `queueDir` | W/N/E take **`left` = the ring INTERIOR**: `[1,0]` · `[0,-1]` · `[-1,0]`. **SOUTH takes `[0,-1]` — OUTWARD**, so its tail is 6.6 u SOUTH of its deck (see below: measured, not stylistic). A `queueDir` along the deck axis spears the platform and is auto-flipped (§0-FATAL); PERPENDICULAR is legal in either sign |
| queue anchors (the HEADS) | `[-40.81, -8.4]` · `[0, 32.41]` · `[40.81, -8.4]` · `[0, -52.79]` |
| exit huts (platforms 1-3) | `[-1.2, 33.03]` · `[41.43, -7.2]` · `[1.2, -52.17]` |
| clearance | **NOTHING within 6.0 u of a deck pad** |

**WHY THE SOUTH PLATFORM QUEUES OUTWARD — AND DO NOT "TIDY" IT BACK.** Inward, its
tail `[0, −44.4]` and the street column paved down to it stand **5.3–5.8 u** from the
summit of seed 1 temperate's biggest range: the guard list FLATTENS it
(**h 8.59 → 0.83**), `terrainFlattened` fires and `stdH` drops under axis 7's **0.75**
floor. Outward, measured on BOTH reference skeletons: `terrain.stdH` **0.73 → 0.81**
and **0.71 → 0.79**, `reliefFloor.kept` **0.74 → 0.82** and **0.73 → 0.81**, the
warning **GONE from both**, axis 7 **7.5/9 → 9/9**, totals **96.18 → 97.68** and
**91.90 → 93.40**, every other axis unchanged. The POSE is unchanged; one station's
queue side flips. **A guard cell must stand ≥ 10.62 u from a summit to cost that peak
nothing** (`capPeakForCells(p, keep, 0.35)` shaves to `0.35 / s(d)`); the deck
`[0, −51.0]` is 9.70 u out and §4.2-A fixes it, so 3.45 of the 8.59 survives — this
pose's ceiling, and enough. **Do NOT shift the ring west** to recover the rest: it
drops the West deck 4.2 u inside a world rect and trades `crossThemeCount 0` for
terrain. Route the approach down the ONE dry corridor, **x ≤ −23**.

**THOSE 16 CELLS GO IN `keepDry`, SO WALK THEM AGAINST YOUR SEED ROW'S WATER BASINS
BEFORE THE SEED IS PINNED.** `keepDry` does not dodge water — it **pushes the body
out of every cell you claim** — so a deck inside a basin is not a wet ride, it is a
SHRUNK LAKE, and it fails `terrain` on a park whose water is otherwise fine.
Measured: round 12 pinned **seed 7 temperate**, whose secondary tarn
`(−48.6, −11.3) r 12.6` sits **6.66 u** from the West deck — **2.64 u inside** the
9.3-u waterline. The tarn shrank **405 → 144 u²**, `secondFrac` fell **0.53 →
0.15** against the 0.16 floor, and the park took **two `terrain` FAILs**, which made
`ok: true` unreachable. Seed 7 draws that tarn under the West deck in every climate
(desert `r 7.8`; coastal `(−41.1, −9.6) r 7.5`, deck 1.92 u out), so **do not pin
seed 7 for a ring park at all.**

**THE VERIFIED PINS, measured by re-composing with only the ring's cells and
diffing against the unguarded §1 row. THREE rows are ring-clean WITH DRY DECKS:
1 temperate, 31 temperate and 91 desert.** Pin **`seed={1} climate="temperate"`**
(relief 12.13 / stdH 1.09, water 9.4 %, `secondFrac` 0.38 — all mid-band),
**`seed={31} climate="temperate"`** for a NEW layout (guarded relief **12.02 /
stdH 1.32, ABOVE the band**, so `terrainFlattened` cannot fire, and its 13 % SW
lake forces a different plan), or **`seed={91} climate="desert"`**, which is what
the verified reference park `samples/monorail-ref.tsx` ships. **`53 coastal` LOOKS
clean and is not: its centroids never move and its WEST DECK stands at `h −0.06`,
in the water** — so read the four DECK HEIGHTS after composition, not only the
centroids. Of the remaining twelve rows, **nine move a water body 24–117 u** (per-body magnitudes from the earlier 15-cell run: 42
alpine **117.1**, 71 temperate **96.4**, 3 desert **62.5**, 19 desert **61.6**, 7
coastal **60.9**, 8 alpine **55.8**, 23 / 73 coastal **25.0**, 3 desert's secondary
**24.2**) and the other three change the landform identity or pay 36-90+ clamp
discs — refuse all twelve. Full table: `-composition.md` §1's ring-clearance table.

**AND THE FOUR QUEUE TAILS ARE DEAD ENDS BY CONSTRUCTION — DO NOT RUN A STREET PAST
ONE.** Each tail sits 6.6 u from its deck along the lane axis, so a street continuing
one more cell past `[−36, −8.4]`, `[36, −8.4]` or `[0, −57.6]` runs through the platform
pad: *`blockers`: street edge runs THROUGH … pad*. **Author those three as leaves** —
W and E from the ring's INTERIOR, **SOUTH from OUTSIDE, laterally along z −57.6.**
The one exception: **the NORTH tail
`[0, 27.6]` may be a through node**, because its deck is at `z 34.2` with the beam
overhead and a street row along `z 27.6` passes under the beam and misses the pad.

**AND THE RING MUST PASS THROUGH *EVERY* DECLARED WORLD.** Four decks and three
worlds is not a pass by arithmetic. Round 12 mounted all four platforms and measured
`everyWorldTouched` **2 of 3**. Read `probe.monorail.worldsTouched` against
`probe.monorail.worldsDeclared` — **both are COUNTS** (`probe.mjs:907-908`), and
`everyWorldTouched` IS that equality; the NAMES are in the sibling
**`worldsTouchedIds`**. **The test is a PERIMETER walk, not a deck test:**
the probe walks the monorail group's bounding-box perimeter and asks which world
rects it crosses, so a world entirely outside `x ±44` / `z −52.8…36` reads
`worldsTouched: 1` however grand it is. **FIX: one `include` cell aimed at the ring**
(e.g. `[-38.4, 33.6]`). An `include` cell is an input to the rect union only —
nothing is built on it, it is never guarded — so this costs nothing, and it is far
cheaper than relocating a district.

**Every platform needs its OWN queue tail AND its OWN connected exit lane**, gated
individually by check **`a4b`** — three of four boarding points used to go
unaudited entirely. Platform 0's exit is left to the chassis (omit
`exit`/`exitDir`); platforms 1-3 go through `register.stations` and DO carry
`exitPoint`/`exitDir` verbatim, because no local frame can describe a platform
80 u from the component origin. Their footpaths reach the street through
`planExitLane`'s **join** case, ~6.0 u each.

Two honest limits to respect: **the ring does NOT satisfy the gate-walk budget** —
even its closest platform is 24.0 u of street from the turnstile, past the 20-u
practical max — so pair it with a separate NON-monorail ride whose queue tail is
inside 15 u of the gate. And **guests do not PLAN a journey**: RCT2 has no
transport routing, a disembarking peep's station index is overwritten, so do not
write a header claiming guests "travel" anywhere. `probe.sim.transfers` is the
only number you may claim — measured on the reference park, **34 rides, 34 of them
TRANSFERS**, the train stopping 9 times at each platform, every rider getting off
at the NEXT one, which is what RCT2 does.

**Do not drop the ring to dodge a lake.** The beam flies 2.45 u of soffit over
water, streets and stalls alike and the piers auto-extend to grade. What water asks
of the ring is that its 16 GROUND cells above sit dry — the four decks and the four
tails especially. If any lands wet, **translate the ring RIGIDLY** inside the
published legal start range (**x ∈ [−63.6, −21.6], z ∈ [−22.8, 20.4]** at 128): all
16 cells and the corridor table move by the same offset in lattice multiples of 1.2.
One line. Re-pinning the seed is also one line. Never drop the ride, and never
accept a shrunk water body instead. (Translation is not always enough — on seed 7
coastal the east river chain covers deck-E `z ∈ (−34.1, 23.5)`, which contains the
whole legal range, so that pair simply cannot carry the ring.)

If a park somehow arrives at the end without the ring, it does not ship — see the
gate at the top of this section. A `<Chairlift>` spanning two worlds fills the
TRANSPORT category but is **not** a substitute for the ring and will not satisfy
`preflight`. Read the costs honestly: skipping the ring = −1 plus a refused
bundle; skipping it AND leaving TRANSPORT empty = that plus a category and the
roster-novelty floor.

## Step 4 — the two rules that decide whether a ride works at all

### (a) The pad goes on a CELL INTERIOR — ask `offPathCell`, don't guess

```tsx
import { offPathCell, pathClearance } from './components/Park';
offPathCell(NET, [x, z], { clear: padMarginOf(rig) })  // a RIDE PAD — a FUNCTION, not 3.2
offPathCell(NET, [x, z], { clear: 1.8 })   // a BUILDING: restroom / hut / hand-placed stall
offPathCell(NET, [x, z], { clear: 1.2 })   // any <Scenery>/<Placed> prop
offPathCell(NET, [x, z], { clear: 0.75 })  // the TREE SCATTER — yes, that too
```

**THE RIDE-PAD MARGIN IS NOT A CONSTANT, AND WE PUBLISHED IT AS ONE.** The
validator computes `need = max(1.8, bodyHalf + pathWidth/2 + 0.05)` where
`bodyHalf` is the largest half-extent of the rig's **RENDERED footprint**
(`Park/configurableRide.tsx` `lintPadOffLattice`). **`capacity` never enters it** —
two capacity-6 rides can want 1.8 and 4.77. `3.2` is the number for a COMPACT flat
(`bodyHalf 2.6`), and round 14's park B put a `<GhostTrain>` through it, landed
**4.42 u** against a required **4.77 u**, and collected a `padNearStreet` **it had
earned by following our published number.** Seven `padNearStreet` in that park.

```ts
// MEASURED, read out of the validator's own lint text ("inside the §0.14 margin
// of N u"). Keyed on the COMPONENT, because bodyHalf is a mesh property.
// ALL TWELVE ROWS. The six TRACKED spans are the ones that hurt: a
// <GearworksExpress> given the 3.2 default is 5.2 u short of its real demand.
const PAD_MARGIN: Record<string, number> = {
  // the six FLATS
  GhostTrain: 4.77, HauntedMansion: 4.77, PaddleBoats: 3.12, Discotron: 3.07,
  FerrisWheel: 2.97, AetherBalloons: 2.95,
  // the six TRACKED spans — measured (probe-tracked-roster.mjs) as
  // padHalf + 0.55 + 0.05, rounded UP to the 1.2 lattice
  GearworksExpress: 8.4,   // 15.1 × 7.4  → padHalf 7.55
  RiverRapids: 6.6,        // a flume basin; a generous clear only pushes the pad
  //                          FURTHER from the street, and the reach floor still holds
  MagneticRide: 5.4,       //  9.0 × 8.3  → padHalf 4.5
  MoonlitBarge: 4.8,       //  8.5 × 6.05 → padHalf 4.25
  Helicycles: 3.2,         //  ~5.2 round
  MotionSimulator: 3.2,    //  2.2 × 2.2 base plate
};
/** 3.2 is the COMPACT-FLAT default (Teacups, Carousel, TwistRide, SwingRide,
 *  TopSpin, FlyingSaucers, SpaceRings). For a rig not in the table: take the
 *  default, probe ONCE, and read the exact margin out of the padNearStreet lint —
 *  it prints both the number AND the legal cell. One iteration, not a re-plan. */
const padMarginOf = (rig: string) => PAD_MARGIN[rig] ?? 3.2;
```

`PAD_OFF_LATTICE = 1.8`; the real threshold is
`max(1.8, padHalf + pathWidth/2 + 0.05)`. Slab clearance under `pathWidth/2` is a
**§0-FATAL `padOnStreet`** (the pad is AUTO-MOVED to `offPathCell`'s own answer
and the park still FAILS); inside the margin it is a non-fatal `padNearStreet`.
**"1.5 u off a node" reads safe and is 0.00 u from the slab** — the slab is 1.1
wide so its centreline owns ±0.55, and a 1.2 pad half reaches 0.05 u past it at
1.5 u out. `null` means RE-PLAN THE STREETS.

**AND IF A HELPER DERIVES YOUR PADS, THE HELPER'S LAST LINE IS THE CALL — A DERIVED
PAD IS NOT A LEGAL PAD.** Round 12's `place(tail, out, cap, front)` did the
tail-first arithmetic **correctly** and returned the raw sum, so three of six pads
needed a `padOnStreet` auto-move and one auto-move landed the ghost train **on top
of the spinner**: one OBB overlap, **5 `footprints` FAILs**, ride spacing 0/8.

**AND THE HELPER MUST NOT HAND-ROLL ARITHMETIC THE RULES ALREADY FIX.** The version
published through wave 15 got three things wrong at once and round 13's park A copied
all three: `clear: 1.8` on rigs that need 3.2, an **invented per-ride `front`
parameter**, and **no check against the lane minimum** — the Discotron's pad ended
**4.43 u** from its tail against an audited **9.74 u** floor. Nine `padOnStreet`
lints, 6 `footprints` FAILs. Here is the corrected helper.

```tsx
// `front` IS NOT YOURS TO INVENT. It is `layout.front`, frozen into the component at
// composableRide() time (default 1.8; <Discotron> 4.0, <BumperCars> 2.6,
// <FerrisWheel> 1.8) and unreadable while authoring. What you CAN compute is the
// FLOOR the validator measures:
//
//   laneLenOf(c) = max(2.2, 0.6 + 0.56·c + 0.5)         ParkBuilder/placement.ts:79
//   minReach(c)  = laneLenOf(c) + 0.35 + 0.62 + 0.50 + 0.45
//                  │             │      │      │      └ boardPoint pad half
//                  │             │      │      └ entrance-hut half-depth
//                  │             │      └ hut set-back from the lane HEAD
//                  │             └ the manager's lane→street join
//                  └ the lane itself
//   cap 4 → 5.26 · cap 6 → 6.38 · cap 8 → 7.50 · cap 10 → 8.62 · cap 12 → 9.74
//   WORKED, the one that failed: cap 12 (a <Discotron>) ⇒
//     laneLenOf(12) = 0.6 + 0.56·12 + 0.5 = 7.82
//     minReach      = 7.82 + 0.35 + 0.62 + 0.50 + 0.45 = 9.74 u
//   Both the LANE and the entrance HUT are SAT-ed against the pad and SAT counts
//   TOUCHING as a collision, which is why the floor exceeds the lane length.
//   <Discotron> and <AetherBalloons> BOTH default to capacity 12, so a court sized
//   for a Carousel (5.26) will not hold either of them.
//
// `laneLenOf` is IMPORTED from './components/ParkBuilder' — it is NOT on the
// './components/Park' barrel. Do not re-implement it.
import { laneLenOf, offPathCell } from './components/ParkBuilder';
const minReachOf = (c: number) => laneLenOf(c) + 0.35 + 0.62 + 0.5 + 0.45;

// declare AFTER the single buildParkNet call — it reads NET. NO `front` PARAMETER.
// It DOES take the RIG NAME, because the pad margin is a property of the rig's mesh.
function place(tail: XZ, out: XZ, capacity: number, rig: string) {
  const clear = padMarginOf(rig);
  const join = laneLenOf(capacity) + 0.35;
  // TWO lattice cells past the floor, not one: the floor is enforced against the
  // BOARD PAD, and a composableRide's boardPoint sits at `position` + the rotated
  // `layout.board`, whose local +z faces the QUEUE — i.e. NEARER the tail than
  // `position` is (1.40 u on a <Discotron>). MEASURED: one cell left the cap-12 rig
  // 0.20 u short of 9.74 and took a `footprints` FAIL.
  const reach = minReachOf(capacity) + 2.4;
  const cand: XZ = [tail[0] + out[0] * reach, tail[1] + out[1] * reach];
  const onStreet = (offPathCell(NET, cand, { clear }) ?? cand) as XZ;   // streets…
  const pad = assertPadFlat(onStreet, clear, rig);                     // …THEN terrain
  const got = Math.hypot(pad[0] - tail[0], pad[1] - tail[1]);
  parkAssert('padReach', got >= minReachOf(capacity) + 1.2,
    `pad [${pad}] sits ${got.toFixed(2)} u from its tail [${tail}] — the cap-${capacity} floor is ` +
      `${(minReachOf(capacity) + 1.2).toFixed(2)} u (the ${minReachOf(capacity).toFixed(2)} u board-pad floor ` +
      `plus one cell for the rig's own board offset). offPathCell's ring search pulled the candidate INWARD, so ` +
      `the court is too tight: move the TAIL outward, open the court, or pick a lower-capacity rig. Do NOT lower ` +
      `the clearance and do NOT shorten the reach — that is the 4.43-vs-9.74 defect.`);
  return { pad, anchor: [tail[0] + out[0] * join, tail[1] + out[1] * join] as XZ,
           dir: [-out[0], -out[1]] as XZ };
}
```

**AND THE LAST LINE IS `assertPadFlat`, NOT `offPathCell` — BECAUSE `offPathCell`
IS STREET-AWARE AND TERRAIN-BLIND.** It knows nodes and edge centrelines and
nothing at all about the land. Round 14 B's one hand-derived pad put a `boardPoint`
on a hill flank at **peak contribution 2.25** against `validate.ts`'s **0.75**
limit: a hard `terrain` FAIL, −2.5, invisible to every street check on this page.
The helper is in the `park-skeletons` skill (`bumpAt` over `COMP.peaks`, the same
smoothstep sum the validator uses, ring-searching the 0.6 lattice for a cell that
is flat AND off the street AND dry). **Paste it and end `place()` with it.**

At these margins the ring search covers `rings 8 × step 0.6` = 4.8 u, so a tight
court returns `null` or a cell under the floor — and both now go through
`parkAssert` as **BLOCKING for that one rig** instead of shipping it on a bad cell.
**That is the point — and it drops the RIG, never the park.** Either answer means
RE-PLAN THE STREETS or OMIT THAT RIDE; never relax the number, and never abort the
module (that scores 0 on all 16 axes).

The only two exemptions in the park are the PUBLISHED POSES whose clearances are
already measured: a §4.0 archetype's `start` and §4.2-A's monorail `position`.
`offPathCell` also needs **the same `NET` `<Paths>` gets** — `buildParkNet` is called
**exactly once**, and a second fuse means your clearances were computed against a
graph the park does not have.

The same audit runs on **stall bodies**.

### (b) THE QUEUE IS BUILT FROM THE TAIL OUT — the pad is an OUTPUT

```
tail   = an AUTHORED street node, in NODES before the ride exists
out    = unit direction TAIL → ride, cardinal
pad    = tail + out·(laneLenOf(c) + 0.35 + front)     // the ride's `position`
anchor = tail + out·(laneLenOf(c) + 0.35)             // the queue HEAD
dir    = −out                                          // runs head → tail
laneLenOf(c) = max(2.2, 1.1 + 0.56·c)                  // placement.ts:79
//  c=2 → 2.22 · c=4 → 3.34 · c=6 → 4.46 · c=8 → 5.58 · c=10 → 6.70
```

**NEVER compute `anchor` from the pad.** One park set
`queue={{ anchor: pad − out·3.51 }}` on all six flat rides; the derived tails
landed 0.18-3.46 u from the pad centres — **nine `footprints` FAILs and ride
spacing capped at 0/8.**

| capacity | `laneLenOf` | **MIN tail → pad centre** | assert ≥ (MIN + 1.2) | **AUTHOR this** (MIN + 2.4) | slots |
|---:|---:|---:|---:|---:|---:|
| 4 | 3.34 | **5.26** | 6.46 | **7.66** | 10 |
| 6 | 4.46 | **6.38** | 7.58 | **8.78** | 14 |
| 8 | 5.58 | **7.50** | 8.70 | **9.90** | 18 |
| 10 | 6.70 | **8.62** | 9.82 | **11.02** | 22 |
| **12** | **7.82** | **9.74** | 10.94 | **12.14** | 26 |

**THE AUTHOR COLUMN IS TWO CELLS OVER THE FLOOR, NOT ONE, AND THAT IS MEASURED.**
The floor is enforced against the **`boardPoint` pad**, which on a `composableRide`
is at `position` + the rotated **`layout.board`** — and local +z is the face the
queue runs into, so the boardPoint sits **nearer the tail** than `position`.
`<Discotron>` ships `board: [0, STAGE_H, 1.4]`, so `MIN + 1.2` = 10.94 put its
boardPoint **9.54 u** from the tail against the **9.74 u** floor: a `footprints`
FAIL, *"entrance hut overlaps boardPoint pad"*. `board` is as unreadable while
authoring as `front` — **buy two cells and assert one.**

**AND KEEP EVERY STREET ≥ 2.4 u OFF THE LANE SPAN `[tail − dir·(laneLenOf(c) +
0.35), tail]`.** The lane is railed both sides and enterable only at the tail: it is
a SOLID. A lane laid across a street cost one measured park **six** failures — 2
`blockers` on its own railings plus 4 rides downstream reporting *"reachable only
THROUGH a solid object"*, because the railing severed the single route past it.
Hang the tail off a junction as a **stub**; do not put it on a through street.

**`front` defaults to 1.8** — every ride's own doc comment says 1.5; the code says
1.8, and several rides override it (tables below). Worse for planning: **on a
compact rig (built span ≤ 10 u — every catalog flat ride) `front` is AUTO-RAISED**
to `min(6.5, footMaxZ·scale + 1.27)`, and `footMaxZ` is a property of the BUILT
MESH (3.13 Carousel, 3.50 TwistRide) you cannot read while authoring. So there are
exactly two reliable ways to wire a queue:

```tsx
// (a) EXACT — pin the lane in world space. Opts you out of the auto-front, the
//     lane trim, the queueDir flip and the derived-exit snap: you own the geometry.
const TAIL: XZ = [9.6, 4.8];                    // a real member of NODES
const OUT:  XZ = [0, -1];                       // tail → ride
const JOIN = Math.max(2.2, 1.1 + 0.56 * 4) + 0.35;      // 3.69
<SwingRide position={[TAIL[0] + OUT[0] * (JOIN + 1.8), TAIL[1] + OUT[1] * (JOIN + 1.8)]}
  rotation={0}
  register={{ name: 'Sky Swings', capacity: 4, rideDuration: 9, intensity: 5, price: 3 }}
  queue={{ anchor: [TAIL[0] + OUT[0] * JOIN, TAIL[1] + OUT[1] * JOIN], dir: [-OUT[0], -OUT[1]] }} />
// pad lands 5.49 u from the tail — the AUTHOR column ✓

// (b) NODE-INDEXED — <Coaster>/<FlatRide>/<TrackRide> only. Don't do the arithmetic:
//     queueTailNode={NET.node(TAIL)} queueDir={[1, 0]}
//     CATALOG rides (<Carousel>, <Teacups>, <FerrisWheel>, …) do NOT accept
//     queueTailNode — their only queue prop is queue={{ anchor, dir }}.
```

Name the tail as one `const … : XZ` used in BOTH `NODES` and the anchor
expression, and let that const be the single source of truth. **A tail that is
not a cell in `NODES` means NO QUEUE WAS PLACED** — the lane is railed on both
long sides and enterable only at the tail, so the manager attaches a SPUR ONTO
THE PAD instead: a `footprints` FAIL, a `blockers` FAIL, and a queue no guest can
join. **Never let two rides share a tail node** (`queueTailShared`, §0-FATAL).

If you leave `queue` off entirely, the derived lane is TRIMMED to whatever node
sits on its axis short of the default reach (within 0.3 u laterally, along-axis
distance in `[front + 1.55, reach + 0.05]`), reporting a non-fatal `laneTrim`
that names the real `front` — correct when the plot leaves no room, but it starves
queue slots.

Two capacity-4 rides on the same street clear each other only at centre-to-centre
pitch **≥ 6 u**; stagger opposite sides to pack tighter. Keep every
**`rideDuration` ≤ 12.**

### (c) OMIT `exit` and `exitDir` on every ride

The chassis derives the RCT2 pair — exit hut ONE TILE along the same station
face, `exitDir = queueDir`, path cast from `exit + 0.62·exitDir` as the RAY (to
the first street within 9 u) or the JOIN (out level with the tail, then one tile
across), whichever is shorter. It knows the RESOLVED queue direction and
ray-casts both candidate cells against the real lattice; you cannot beat it. A
hand-pinned pair that is not adjacent-and-outward is HONOURED and reported as
`exitNotAdjacent`.

**A missing or unroutable exit path is a HARD `accessibility` FAIL** (check a4).
So the binding requirement is that the station face the queue comes off has **TWO
FREE TILES SIDE BY SIDE** — budget the rig `2·0.55 + 1.2 = 2.30 u` across the
face, not one hut's 1.09. Where both are illegal, `exitFaceBlocked` fires and the
chassis does NOT repair onto another face: move the ride. **Prefer a tail node
that is a JUNCTION** — the exit then meets the cross-street in the same
`laneLenOf(c) + 0.35` the queue takes, instead of running the lane's length and
turning (3.7 u vs 3.7-8.2 u measured on dead-end court spurs).

**Never mount a `build<Name>Scene` builder in a park.** Most rides export one —
it is preview staging and ships its own ground (the floating-oval failure). Mount
the component.

---

## The tracked rides — profiles, layouts, and where they go

All five below ship a working stock layout; **pass no `pieces`.** Every number is
read out of the source. `front`/`exit` are their `RideLayout`; the tail reach is
`front + laneLenOf(capacity) + 0.35` at the catalog capacity, and it applies only
if you let the lane be derived — pin it and you own the gap (floor 1.57 u).

### LogFlume — `profile: 'flume'`, the WATER category, E-rated

| fact | value |
|---|---|
| profile / start | `'flume'`, `start: [0, 0.6, 0]` — only if `pieces` is passed |
| whitelist (if you ever get a published block) | everything except inversions; `corkscrewL/R` auto-replaced by an `sbend`. **25° up / steep-60° down only** — climb LONG, chute SHORT; practical ceiling 33.1°. `sBend` + `curveSmall`; no helix, no banked turns, bank capped 0.25 rad |
| `layout` | `front: 4.4`, `exit: [-1.9, 4.0]` |
| defaults | `name: 'Log Flume', capacity: 4, rideDuration: 12, intensity: 5, price: 4` |
| derived tail reach @ cap 4 | 4.4 + 3.34 + 0.35 = **8.09 u** out +z |
| footprint (stock) | x −3.7..3.7, z −2.7..3.05; trough rim reaches z 3.55 |
| water | **BUILDS ITS OWN** — a `buildWaterRibbon` trough, 0.72 wide inside walls at ±0.45. Goes on **DRY FLAT LAND** |

```tsx
import { LogFlume } from './components/LogFlume';
<LogFlume position={PAD} rotation={Math.PI * 0.75}
  register={{ name: 'Timber Chute', capacity: 4, rideDuration: 12, intensity: 5, price: 4 }}
  queue={{ anchor: HEAD, dir: DIR }} />
```

Thematically wants the shoreline; use `rideColourPreset(seed + zone, 'water')`.

### RiverRapids — `profile: 'rapids'`, the narrowest vocabulary in the catalog

| fact | value |
|---|---|
| profile / start | `'rapids'`, `start: [0, 0.3, 0]` |
| whitelist | **`curveVerySmall` quarter-turns and 25° slopes ONLY** — no s-bends, no helix, no steep pieces. 25° is a hard ceiling BOTH ways; bank capped 0.2 rad |
| `layout` | `front: 4.4`, `exit: [-1.7, 4.2]` |
| defaults | `name: 'River Rapids', capacity: 6, rideDuration: 12, intensity: 5, price: 4` |
| derived tail reach @ cap 6 | 4.4 + 4.46 + 0.35 = **9.21 u** |
| footprint (stock) | ≈ 7 × 4.5, min bend radius 1.11; boarding deck reaches z ≈ 3.65 |
| water | **BUILDS ITS OWN** channel + splash pond. Dry flat land. (Passing `pieces` also SKIPS the tuned splash pond) |

### Bobsleigh — `profile: 'bobsled'`, energy-paced, crash-guarded

`BobsleighCar` is DEPRECATED — never import it.

| fact | value |
|---|---|
| profile / start | `'bobsled'`, `bank: 0.55`, `start: [0, 0.6, 0]` |
| whitelist | tall lifts, stepped drops, half-banked helixes up AND down, sbend. **25° absolute ceiling — no steep slopes at all** |
| graded on | lateral Gs (`RequirementLateralGs` 1.20), not drop height. Bank 0.55 rad = 31.5° measured. The 1.5 g derail guard is wired as its `vehicleHandle` |
| `layout` | `front: 4.6`, `exit: [-2.0, 4.2]` |
| defaults | `name: 'Bobsleigh', capacity: 4, rideDuration: 10, intensity: 6, price: 4` |
| derived tail reach @ cap 4 | 4.6 + 3.34 + 0.35 = **8.29 u** |
| footprint (stock) | x −5.5..3.4, z −3.2..3.2; chute rim reaches z 3.98 |

Alpine climates and hill flanks favour it. On the never-used thrill list.

### Monorail — `profile: 'monorail'`, FLAT-ONLY, MULTI-STATION

| fact | value |
|---|---|
| profile / start | `'monorail'`, `start: [0, beamY, 0]` |
| whitelist | `station`, `straight`/`flat`, `turnL`, `turnR`, `sbend`, **height-less** helixes. **`lift`/`drop`/`hill` are STRIPPED with a warn** (a §0-FATAL warning); helix `height` stripped; corkscrews become an sbend. The only whitelist with `curveLarge`; bank capped 0.08 rad |
| defaults | `name: 'Monorail', capacity: 6, rideDuration: 12, intensity: 1, price: 2` — **override `price` to 0** |
| stations | up to **4** (RCT1/RCT2 save-format cap); past that the compiler warns |
| stock rig | a 7-u shuttle beam along local z, 0.42 wide, piers every 1.6 u, `beamY` **1.2**. Its span > 10 u so it gets NO compact-rig hut auto-clearance and **registers no body blocker** — plan the pathing around it yourself |

The park-spanning ring is Step 3. `<Monorail>`'s own documented starter loop is a
district-scale illustration whose turns summed to only 180° — it synthesized 52 %
of the authored length and shipped FATAL for two rounds. **Turns summing to 360°
is not sufficient either: the list must END FACING the station.**

### Chairlift — horizontal only; it compiles on the `'monorail'` profile

| fact | value |
|---|---|
| profile / start | `'monorail'`, `start: [0, 2.32, 0]` (the cable line) |
| whitelist | **`station`, `flat`/`straight`, `turnL`, `turnR`, `sbend` and nothing else.** `lift`/`drop`/`hill`/helix/corkscrew stripped with a warn |
| `layout` | chassis defaults — `front: 1.8`, `exit: [-1.5, 1.35]` |
| defaults | `name: 'Chairlift', capacity: 6, rideDuration: 10, intensity: 2, price: 3` |
| motion | the fleet-wide **motion-gate EXCEPTION**: the cable never stops and guests board moving chairs |
| capacity | 6 = the stock loop's bucket count. A piece-composed course sizes its fleet from circuit length (4-14 buckets) — keep `capacity` ≤ that count |
| footprint | stock loop is a 6.4-u run between bullwheel pylons, cable at y 2.4, the whole rig yawed +45° internally → box ≈ 5.6 × 5.6 on the diagonal |

ONE station — the out-and-back cable is internal geometry, not two districts.
Reads best up a hill flank. On the never-used transport list, and the TRANSPORT
floor if the ring is somehow missing.

### GoKarts — `profile: 'gokart'`, FLAT-ONLY

| fact | value |
|---|---|
| profile / start | `'gokart'`, `start: [0, 0.02, 0]` — kerb height, the course is dead flat |
| whitelist | `station`, `straight`/`flat`, `turnL`, `turnR`, `sbend`, height-less helixes. `lift`/`drop`/`hill` REMOVED with a warn; bank capped 0.02 rad |
| `<TrackRide>` | **excludes `'gokart'`** — `<GoKarts>` is the ONLY route to a kart course |
| `layout` | chassis defaults — `front: 1.8`, `exit: [-1.5, 1.35]` |
| defaults | `name: 'Go-Karts', capacity: 4, rideDuration: 12, intensity: 5, price: 4` |
| footprint (stock) | a flat ≈ 6 × 4 asphalt oval; min turn radius 0.63 against a 0.55 ribbon half-width |
| cost | 128 exhaust particles against the 4000 global budget |

`rideColourPreset(seed + zone, 'kart')`. Desert parks favour kart energy.

Any `pieces`-mode ride registers a CIRCUIT, so it is subject to the 1.6-u
corridor sweep and the crash replay exactly like a coaster — budget its footprint
with the run-length table in **coaster-pieces**.

---

## The flat rigs — one line each

All take `position`, `rotation`, `register` and a queue, and that is the whole
placement. They are plain `composableRide`s: no `pieces` prop exists.

| ride | cat | cap | dur | int | price | land footprint | notes |
|---|---|---:|---:|---:|---:|---|---|
| **GhostTrain** | **dark** | 6 | 11 | 5 | 4 | ≈ 4.7 × 2.6 | a BUILDING — show building on the −x half, graveyard dip on +x. Extra prop `riders?`. **A flat rig, NOT a pieces ride.** Never built by anybody |
| **PaddleBoats** | **water** | 4 | 12 | 1 | 2 | ≈ 5.2 × 5.2 (round) | **builds its OWN pond** — see below. Never used |
| **MotionSimulator** | thrill | 4 | 7 | 6 | 3 | 2.2 × 2.2 base plate | pod at y 1.05 on a hexapod; fits a plaza edge. Never used |
| **ObservationTower** | gentle | 8 | 10 | 1 | 2 | ≈ 2 × 2 base — but **5.9 u TALL** | a LANDMARK. Mast top 5.7, beacon 5.86: check a coaster's 2.2-u corridor clearance VERTICALLY here. Extra prop `riders?` |
| **Helicycles** | gentle | **2** | 8 | 2 | 2 | ≈ 5.2 × 5.2 (round) | flight circle r 1.4, fence rings at 2.36. `laneLenOf(2) = 2.22`, the shortest lane in the catalog — so pair it with a REAL gentle ride. Never used |

All use the chassis `exit: [-1.5, 1.35]`, `board: [0, 0.25, 0]` and
`loadTime: 1.6`. The six over-used spinners — Carousel, FerrisWheel, Teacups,
DropTower, SwingRide and a coaster — are all `register`-ready too; nine parks in
a row shipped exactly that set, so reach past them.

> **EVERY RIDE AND STALL IN THE CATALOG IS `register`-READY.**
> `components/Park/Context.md` still carries a stale line claiming preview-only
> rides must be composed via `<Placed>` + `usePark().manager()`. **It is FALSE.**
> FerrisWheel, Carousel, Teacups, DropTower, GhostTrain and all four food shops
> register normally. Do not compose a catalog ride through `<Placed>`, and do not
> cut your roster over that sentence — one park nearly dropped to four rides
> reasoning about it.

### ⚠ The water rides do NOT need the water body — and must NOT be on it

This is the opposite of the intuition and of some older guidance:

- **PaddleBoats builds its own pond**: a sandy bank cylinder r 2.5→2.6 (0.16
  tall), a pond bed disc r 2.42, and a scaled WaterTile sheet at waterline y 0.13
  with a shore lamp post at local (1.78, 1.78).
- **LogFlume** carries its own `buildWaterRibbon` trough.
- **RiverRapids** carries its own channel and splash pond.

All three go on **DRY, FLAT LAND.** On the composed lake they trip the **WET-PAD
guard** — any audited footprint cell with ground below `waterLevel + 0.05` is a
hard `terrain` failure, charged ONE PER RECT. What the water body buys is
*thematic adjacency*: put them in the waterside district, near the shore, with
`rideColourPreset(…, 'water')` and palms — every footprint cell dry and in
`keepDry`. Same for a world: `tidewater` reads coastal, so place it NEAR the
shore, not on it.

---

## Stalls

```tsx
import { BurgerShop } from './components/BurgerShop';
import { HotDogStand } from './components/HotDogStand';
import { SodaStand } from './components/SodaStand';
import { CottonCandyStand } from './components/CottonCandyStand';
import { BalloonStand } from './components/BalloonStand';
```

| component | item | price | value | default name |
|---|---|---:|---:|---|
| BurgerShop | `food` | 3 | 5 | Burger Bar |
| HotDogStand | `food` | 3 | 5 | Hot Dogs |
| SodaStand | **`drink`** | 2 | 4 | Soda Stand |
| CottonCandyStand | `food` | 2 | 4 | Cotton Candy |
| BalloonStand | `balloon` | 2 | 3 | Balloon Stand |

The other five are the worlds' own stalls (`EmberRoast`, `SushiStall`,
`GoggleWorks`, `Honeywitch`, `NeonSlush`) — one per world row, and a themed
`bazaarPlan` brings a world's generic stalls with it.

**≥ 3 DISTINCT KINDS SPANNING FOOD *AND* DRINK.** `SodaStand` is the only generic
`drink`, so a park of three food shops fails axis 5 however many it has.

Props on every one: `position`, `rotation`, `scale`, `register` (boolean or
`{ name, price, value, item }`), plus top-level `name`/`price`/`value` overrides
that win over `register`. The four food shops also take `withGuest?: boolean`
(a decorative queuing peep, default off).

**The serving-front rule: the front faces LOCAL +z and the manager's attach point
sits 0.72 u out that way. Aim `rotation` at the customers' path.** A shop whose
front faces a hedge sells nothing. The registered footprint is a 1.3 × 2.02 rect
centred 0.36 u forward of the anchor, so it includes the apron; the SOLID body is
hx 0.6 × hz 0.42 on the anchor, and only that body has to stay out of the slab —
which is why kiosks belong on cells **abutting** the street and why a `<Bazaar>`'s
stalls may flank its own aisle.

**Always pass a themed `name`.** `register` alone ships the catalog default, and
**names are the manager's PRIMARY KEY** — duplicates make the corridor resolver
move the wrong shop. A park shipping "Burger Shop", "Soda Stand", "Balloon
Stand" reads unfinished and loses the axis. **The identical rule binds on RIDES —
see Step 1b.**

```tsx
<BurgerShop position={offPathCell(NET, [7.8, 8.4], { clear: 1.8 })} rotation={-Math.PI / 2}
  register name="Lakeside Burger Bar" price={3} value={5} />
```

**Prefer the `<Bazaar>` set-piece over hand-placing a row.** It plants 3-6 catalog
stalls at pitch 2.4 along a paved aisle that IS a street in the shared graph, each
1.2 u off it with its front turned toward it, so every attach point lands 0.48 u
from the centreline — on the path. It names them `"<title> <Label>"` with a
trailing number from the second of a kind (`"Commons Market Soda Stand 2"`), and
`pinStalls` defaults true so the corridor resolver cannot break the row.

```tsx
const MARKET = bazaarPlan({ id: 'market', title: 'Commons Market',
  position: [-9.6, 12.0], theme: PULSE_DISTRICT,          // omit `theme` for a neutral hub row
  stalls: ['burger', 'soda', 'cottonCandy', 'balloon'],     // 3-6 of
  // 'burger' | 'hotDog' | 'soda' | 'cottonCandy' | 'balloon'
  names: ['Ironhearth Grill', 'Voltage Sodas', 'Neon Floss', 'Skyline Balloons'] });
```

**PASS `names`. THE AUTO-NAME PASSES THE CHECK AND STILL READS AS MACHINE OUTPUT.**
Without it each stall is `'<title> <CatalogDefault>'` — *"EmberRow Soda Stand"* —
which satisfies a mechanical `themedName` test and costs the roster axis 0.5 anyway.
`names` is positional, one per entry in `stalls`; short arrays fall back per slot.

**AND TWO THINGS ABOUT A BAZAAR THE AUTHOR CANNOT SEE:**

- **THE DRESSING HALO IS ≥ 2.4 u EACH SIDE OF THE AISLE, AT BOTH PORT CELLS.**
  `bazaarPlan` emits a bench at local `(±stub, ±1.2)` and an entrance marker at
  `(±stub, ±2.4)` — on the PORT CELL's column, PERPENDICULAR to the aisle, at
  offsets that appear nowhere in the plan. Enter the port ALONG the aisle and they
  all clear. Run a street THROUGH the port cell across the aisle — cardinal, legal,
  and exactly what a north-south spine past an east-west row looks like — and the
  bench and marker land **0.00 u** from its centreline: two `scenery` FAILs, −2
  (round 14 B). `<Bazaar>` now sieves its own dressing through `offPathCell` and
  warns when it moves something, **but the warning means your street is standing in
  the row's entrance, and the layout is still wrong.**
- **A BAZAAR'S OWN STALLS LINT `padNearStreet` AGAINST ITS OWN AISLE. THAT IS
  EXPECTED, IT IS NOT AN AUTHOR DEFECT, AND IT IS NOW QUANTIFIED.** The aisle is PAVED
  into the fused net and every stall anchor sits **1.2 u** off it, against §0.14's
  **1.2 u** stall margin. MEASURED by running `bazaarPlan` in isolation over row sizes
  3, 4, 5, 6, 7 and 8 and taking each slot's distance to the nearest aisle node:
  **stall → aisle street is EXACTLY 1.2000 u in ALL SIX** (tiles 7 · 9 · 11 · 13 · 13
  · 13). The test is `1.20 < 1.20` on a float, so **WHICH rows trip is decided by
  rounding in the `facing` quarter-turn, not by anything you chose: 6/3/3 → 6 lints ·
  4/4/4 → 8 · published skeleton C → 5. CHANGING ROW SIZES ONLY CHANGES THE COUNT** —
  no configuration clears it, and `validatePark` still reads `ok: true` over it. The
  printed remedy ("move the pad to …") is **unavailable**: the pads live inside the
  set-piece and `pinStalls` defaults true to keep them there. **Report the count, do
  not chase it, and never disable `pinStalls`.** *(Design-system defect, logged: either
  the stall offset or the §0.14 margin should move by one lattice cell, or
  `padNearStreet` should exempt a pad and a node from the SAME set-piece.)*

`tiles = 2k + 1` for k stalls (4 stalls → 9 tiles, `half = 5.4`); pad depth is 3
tiles (±1.8); ports **`W` and `E` ONLY — never N/S, at any rotation** — at
`position ± (half + 0.6)` along the aisle.

### THE ROW OFFSET IS THE AUTHOR'S JOB — `bazaarPlan` DOES NOT DO IT

**A bazaar's `position` is its AISLE CENTRE, and the plan does NOT offset its own
rows.** The stall anchors sit at `side · CELL` = **±1.2 u** across the aisle
(`Bazaar/index.tsx:234`) with the solid body `hz 0.42` on the anchor. Relative to the
bazaar's OWN aisle that is by design — the aisle is a street in the shared graph and
each attach point lands 0.48 u from its centreline, on the path. **Relative to any
OTHER street it is exactly the 1.20-u margin**, i.e. `padNearStreet` on every stall
in the row. Round 13 tripped it on **6 of 10 stalls, one of them fatal**, by putting a
plan's `position` on a street node.

**THE NUMBER.** A row's outer solid edge is `1.2 + 0.42 = 1.62` u from the aisle, so
an external slab needs its centreline at `1.62 + 0.55 + 0.05 = 2.22` → **2.4 u on the
lattice.** So:

```tsx
// WRONG — the plan sits ON the node it serves; both rows land at the 1.20 margin
const ROW = bazaarPlan({ id: 'pulseRow', position: [0, 52.8], /* … */ });   // [0,52.8] ∈ NODES
// RIGHT — 2.4 u OFF the node, ACROSS the aisle, and the NODE is wired to the PORT
const ROW = bazaarPlan({ id: 'pulseRow', position: [2.4, 52.8], /* … */ });
// EDGES: ['pulseRow:W', <the node index>]     ← never [node, ROW.position]
```

Never author a spine node within 2.4 u of a bazaar's aisle, and **never within 1.8 u
of a `<FountainPlaza>`'s paved pad at all** — a plaza's `position` is a SOLID CENTRE,
not a connector. `park-composition`'s `assertNodesOffPieces` is the module-scope
`throw` that enforces both, with `SOLID_CLEAR = { FountainPlaza: 1.8, Bazaar: 0.6 }`
(0.6 off Bazaar's `footprint.hz` of 1.8 = the 2.4 u above). Paste it.

> **DESIGN-SYSTEM DEFECT, LOGGED.** `bazaarPlan` should offset its own rows off any
> external street it is wired to, or at minimum publish a `rowClear` the caller can
> assert against — the caller currently has to know that `side · CELL` is 1.2 and
> that the solid body is 0.42 deep. Until the component does it, the 2.4 u is the
> author's, and `assertNodesOffPieces` is what makes forgetting it impossible.

### THE 3-6 STALL FLOOR IS ENFORCED BY `bazaarPlan`, AND THE PADDING MOVES YOUR PADS

**TWO SEPARATE CLAMPS, AND ONLY ONE OF THEM LINTS.** Anything **UNDER 3 IS
AUTO-PADDED TO 3 with a `'balloon'`** (`Bazaar/index.tsx:172`) and that DOES raise a
non-fatal `bazaarStallCount` plan lint. But **anything OVER 6 IS SILENTLY TRUNCATED —
`stalls.slice(0, 6)`, `Bazaar/index.tsx:184`, WITH NO LINT AT ALL.** Ask for 7 or 8
and you get **6 slots and 13 tiles**, so a `roster={{ stalls }}` count written from the
array you TYPED is a `rosterOverstated` FAILURE on a park that looks fine.
**AND NEITHER CLAMP IS COSMETIC, because `k` is what sizes the whole piece:**

| declared | k after padding | `tiles = 2k+1` | `half = 0.6·tiles` | ports at `±(half+0.6)` |
|--:|--:|--:|--:|--:|
| 2 | **3** | 5 → **7** | 3.0 → **4.2** | ±3.6 → **±4.8** |
| 3 | 3 | 7 | 4.2 | ±4.8 |
| 4 | 4 | 9 | 5.4 | ±6.0 |
| **7 or 8** | **6 — SILENTLY CLAMPED, NO LINT** | 13 | 7.8 | ±8.4 |

So under-declaring silently moves both port cells 1.2 u outward and re-lays every
stall anchor **underneath the arithmetic you wrote for the smaller `k`**. Round
13's park B declared 2 stalls in each of three bazaars, wrote
`// tiles 5, half 3.0, ports ±3.6` in its header, and shipped **three
`padNearStreet` lints at 1.20 u** plus a **`rosterOverstated`** warning:
`roster={{ stalls: 6 }}` against **9** stalls actually registered.

**Declare 3-6, and count the roster off `plan.slots.length` — the POST-padding
list — never off the array you typed.** Paste this beside the other module-scope
assertions:

```ts
const BAZAARS = [PULSE_ROW, WORKS_ROW, GLADE_ROW];
const DECLARED: Record<string, number> = { pulseRow: 3, worksRow: 3, gladeRow: 4 };  // what you TYPED
BAZAARS.forEach((b) => {
  if (b.slots.length < 3 || b.slots.length > 6)
    throw new Error(`bazaar '${b.id}': ${b.slots.length} stalls — the floor is 3-6`);
  if (b.slots.length !== DECLARED[b.id])
    throw new Error(
      `bazaar '${b.id}': you declared ${DECLARED[b.id]} stalls but the plan holds ${b.slots.length} — bazaarPlan ` +
        `AUTO-PADDED to the 3-stall floor, so your tiles/half/port arithmetic AND your roster count are both stale`,
    );
});

// the roster's `stalls` is COUNTED, never estimated:
const STALL_COUNT = BAZAARS.reduce((n, b) => n + b.slots.length, 0) + HAND_PLACED_STALLS.length;
// …then: <Park roster={{ rides: [...], stalls: STALL_COUNT, categories: 5 }}>
```

**AND THE FREE WAY TO REACH THE FLOOR IS A THEMED WORLD STALL.** `bazaarPlan` only
takes the five generic kinds, so the third slot it pads with is a duplicate
`BalloonStand` — a stall that buys you nothing. Hand-place a themed one beside the
bazaar instead and it pays three times: it clears the floor, it adds a stall KIND,
and it is roster novelty. Read `probe.stallRoster.catalogNeverUsed` and take from
it — for round 13's park that list held **`NeonSlush`** (the only themed **drink**
besides `SodaStand`), **`SushiStall`** (food) and **`EmberRoast`** (food), one per
world row (pulse / tidewater / emberfall), each a single JSX line:

```tsx
<NeonSlush position={offPathCell(NET, [46.8, -12.0], { clear: 1.8 })} rotation={-Math.PI / 2}
  register name="Neon Slush Cart" price={2} value={4} />
```

### `<Stall>` and `<Restroom>` — two traps

- **`<Stall kind>` accepts `'balloon'` and nothing else**, and it takes **`sell`**,
  not `register`: `sell` (kind defaults) or
  `sell={{ name, item, price, value }}`. The four food shops are their own catalog
  components — mount those directly.
- **There are TWO components called `Restroom`.** Import it from
  **`./components/Park`** — that one registers with the manager, registers its
  blocker (hx 0.72, hz 0.55, doorway kept clear) and plinths its cell.
  `./components/Restroom` is a bare `composable` around the preview staging
  builder: NOT registered, must not be used in a park.
  `<Restroom position rotation elevation>`; doorway at local `[0, 0, 0.72]` (+z),
  footprint ≈ 1.44 × 1.24, ridge 1.45. **It is a BUILDING, so
  `offPathCell(…, { clear: 1.8 })`** — and never a cell that is also a
  `boulevardPlan`'s `from`/`to`, or any cell along its 1.2-u carriageway chain.
  One park put a restroom on a boulevard carriageway node and paid 2 `blockers`
  FAILs and `restroomUses 0`.

Both auto-deck-match a nearby elevated path node within 1.75 u (explicit
`elevation` overrides), and a lift > 0.35 gets an RCT2 wooden scaffold + plank
deck. A park with no restroom or no bin loses 3 points for two lines of JSX.

---

## A worked 10-ride roster at 128 — 5/5 categories, 3 worlds, 2 coasters, 5 circuits

| slot | ride | cat | circuit family | int | district |
|---|---|---|---|---:|---|
| flagship coaster | `<Coaster>` §4.0-A (or C) | thrill | **coaster** | 7 | the plot CORE |
| **SECOND coaster** | `<Coaster>` §4.0-B — DIFFERENT archetype, `ratingBand` ***thrilling*** where A/C are *intense* | thrill | **coaster** | 6 | a measured slot, z-separated from the flagship (coaster-pieces Step 0) |
| **transport** | `<Monorail>` §4.2-A, 4 platforms | transport | **transport** | 1 | rings the park, a platform per world |
| near-gate smoke ride | `<Carousel>` or `<Teacups>`, cap 4 | gentle | — (flat) | 2 | ON the gate street, tail ≤ 15 u |
| **dark** | `<GearworksExpress>` ⭐ or `<GhostTrain>` ⭐ | dark | **dark** | 5 | brasswork / main street |
| **water** | `<MagmaRun>` ⭐ / `<DeepDrift>` ⭐ / `<LogFlume>` (all: no `pieces`) | water | **water** | 1 / 5 | waterside, on DRY land |
| landmark | `<ObservationTower>` | gentle | **tower** | 1 | the hub, where the skyline reads |
| world ride 1 | `<Discotron>` / `<Bassline>` ⭐ | thrill | — / **coaster** | — | pulse |
| world ride 2 | `<MoonlitBarge>` / `<AetherBalloons>` | water / gentle | **water** / — | — | thornwick / brasswork |

⭐ = off the never-used table. **That roster reads 6 circuits across 5 families
and 2 coasters** — the §4.0-E requirement is 5 / 3 / 2, so there is one circuit
of slack. A FAMILY park swaps the pair to §4.0-B (flagship) + §4.0-A or C as the
second, and trades a spinner for `<Helicycles>` ⭐ or `<MotionSimulator>` ⭐ (both
tower circuits, both never used), keeping one intense ride so the bands are still
spanned.

**A MEASURED 9-RIDE ROSTER THAT SHIPPED, for comparison** — the verified skeleton B
(`harness/park-eval/samples/skeleton-b.tsx`; `ok: true`, 0 failures, 5/5 categories,
`distinctKinds` 9, three never-used kinds, flagship E 5.27 *thrilling*):

| ride | kind | category | cap | tail / start |
|---|---|---|---:|---|
| Wolds Runner | `<Coaster>` §4.0-B | thrill | 4 | start `[15.6, 0.55, −2.4]`, tail `[21.6, −2.4]` |
| Grand Circle Monorail | `<Monorail>` §4.2-A | transport | 6 | published pose, 4 platforms |
| Promenade Carousel | `<Carousel>` | gentle | 8 | `[−14.4, 57.6]`, out `[1, 0]` — 6.0 u from the gate |
| Saucer Glade | `<FlyingSaucers>` ⭐ | gentle | 8 | `[−43.2, 50.4]`, out `[0, 1]` |
| Discotron | `<Discotron>` | thrill | **12** | `[57.6, 33.6]`, out `[0, −1]` |
| Ridgeline Chairlift | `<Chairlift>` ⭐ | transport | 6 | `[24.0, 27.6]`, out `[1, 0]` |
| Hollow Paddle Boats | `<PaddleBoats>` ⭐ | water | 4 | `[12.0, −19.2]`, out `[0, −1]` |
| Ghost Train | `<GhostTrain>` ⭐ | dark | 6 | `[−24.0, −19.2]`, out `[0, −1]` |
| Caldera Enterprise | `<Enterprise>` | thrill | 8 | `[−48.0, −30.0]`, out `[−1, 0]` |

Two transport rides is not a waste: the monorail is the required ring and the
chairlift is a second never-used kind for one mount. **But do not transcribe this
list either** — roster novelty is a Jaccard distance over KINDS, so reusing all nine
is the same defect as transcribing a node table.

**AND NOTE WHAT THAT SHIPPED ROSTER IS MISSING, because it is the whole point of
§4.0-E: it has ONE coaster.** Skeleton B registers 5 circuits (Coaster, Monorail,
Chairlift, PaddleBoats, GhostTrain) across 4 families, which clears the circuit
row — but with `ratedCount: 1` it forfeits the 0.75 second-coaster point and caps
the Thrill axis at **7.25/8**. The published fix is a §4.0-C at
`[−2.4, 0.55, −38.4]` with tail `[3.6, −38.4]` (measured PRE-repair: relief kept 0.73
vs the 0.70 floor, water centroids moved 0/0 — the one-coaster baseline is now kept
0.81, so re-measure), which also needs `Ghost Train` moved off
`[−24, −27.98]`. Both verified skeletons ship one coaster and both under-deliver
against §4.0-E — say so if you copy one unchanged.

Count the `register={{…}}` calls that actually MOUNT, write the header roster line
from THAT, and restate it machine-readably —
`<Park roster={{ rides: […names…], stalls: 5, categories: 5 }}>` — or the gate
raises `rosterOverstated`. A FATAL compile is the trap that makes this bite: an
unregistered ride's category reads empty, and one park shipped
`ROSTER (9 rides, 5 categories)` with eight rides in three.

**THE OTHER TRAP IS THE COUNT ITSELF, AND IT HAS NOW MISSED IN BOTH DIRECTIONS.**
`rosterOverstated` fires on any mismatch, over or under.

* **Round 13's park B OVERSTATED by auto-padding.** It counted off its three
  `stalls: [...]` arrays (2 each → 6); `bazaarPlan` padded each row to 3, so **9**
  registered against a claimed 6.
* **Round 13's park A UNDERSTATED by counting ROWS.** Three bazaars, each with three
  slots, plus one hand-placed `<BalloonStand>` — **10 registered** — and it wrote
  `stalls: 5`. It had counted the shopping *rows* and a couple of stands, not the
  shops.

**SO WRITE THE ARITHMETIC OUT, FROM THE REGISTRATION.** Rides are counted off the
`register` calls that actually mount; stalls are:

```
stalls = Σ over bazaar rows of plan.slots.length     ← POST-padding. NEVER the
                                                       `stalls: [...]` array you typed,
                                                       and NEVER the number of rows.
       + the standalone stands you mount by hand     ← <BalloonStand>, <NeonSlush>, …
```

**WORKED, on round 13's park A:** `3 rows × 3 slots = 9`, `+ 1 <BalloonStand> = 10`.
Not 3 (rows), not 5 (what it shipped). And derived in code, never transcribed:

```ts
const BAZAARS = [PULSE_ROW, WORKS_ROW, GLADE_ROW];
const HAND_STALLS: XZ[] = [BALLOON_CELL, SLUSH_CELL];      // one entry per standalone mount
const STALL_COUNT = BAZAARS.reduce((n, b) => n + b.slots.length, 0) + HAND_STALLS.length;
<Park roster={{ rides: RIDE_NAMES, stalls: STALL_COUNT, categories: 5 }}>
```

A `console.log({ STALL_COUNT, rows: BAZAARS.map((b) => b.slots.length) })` beside it
costs one line and shows the padding as it happens.

**AND THE `roster` PROP IS A HARD STOP-CHECK, NOT A NICETY — WITHOUT IT NOTHING
RENDERS AT ALL.** `harness/park-eval/preflight.mjs` prints *"1 problem(s) …
refusing to bundle: `<Park>` has no `roster={{ rides, stalls, categories }}` prop"*
and exits 1: no bundle, no page, no `validatePark` line, no evidence. Round 12's
park wrote a correct §0 header **and** a correct roster line in the comment block
and then never wired the attribute — the round's entire evidence trail was lost to
one missing prop. **The comment is not the prop. Mount it.**

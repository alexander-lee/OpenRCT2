---
name: coaster-pieces
description: "Use whenever a generation involves a roller coaster, a tracked ride, or a `pieces` list with the mp3d rigs — a <Coaster>, <TrackRide>, or the `pieces` prop on Monorail/LogFlume/RiverRapids/Bobsleigh/Chairlift/GoKarts — and whenever you must decide HOW MANY coasters and circuits a park needs, design an exciting circuit, close a circuit, decide whether to pass `pieces` at all, place a coaster's queue tail, or fix a coaster failure (FATAL compile, >40% synthesized closure, shortDrop, lateral G / crash replay, corridor, bounds, queueDirFlip, translucent red track). Carries the full TrackPiece vocabulary (including the vertical `loop`), worked example archetypes, their measured LEGAL START ranges at size 128, the corridor cell tables, the run-length table, the rateCoaster self-check, and the TWO-COASTER / FIVE-CIRCUIT roster requirement with the measured second-circuit slot."
---

# Coasters: DESIGN one, then verify it in the park

Every number here was measured headlessly through the FULL `validatePark` gate.

**⛔ THIS FILE USED TO SAY "COPY an archetype, don't design one" — AND THAT IS WHY
EVERY PARK SHIPS THE SAME RIDE.** All four published archetypes (§4.0-A/-B/-C/-L)
are the *identical* closed rectangle: `station`, then four corners of
`lift → straight → turnR 90° radius 2.5 → drop`. They differ only in what is
threaded between the corners. Fifteen corpus parks, one silhouette.

**So: design your own circuit. It MUST contain at least one inversion, and a
vertical `loop` is the one to reach for.** There are no excitement, intensity or
nausea targets any more — build something that looks exciting to ride.

The old rule existed for a real reason — you cannot run code while authoring, and
a hand-rolled circuit once shipped at 1.64 g and 1.96 g against the 1.275 g derail
guard. **The answer is to VERIFY, not to abstain:** `compileTrackPieces`,
`rateCoaster` and `checkCoasterDesign` are all importable *inside the park*, so
compile your candidate at module scope, print its numbers, and gate the mount on
the result (see "Verify what you design" in `rules/setup.md` §0-P.4). If a design
fails, iterate; if you run out of ideas, fall back to a worked array. A rectangle
that works beats a novel circuit that renders translucent red.

**The archetypes below are WORKED EXAMPLES.** Read them for the idiom — how a lift
pays for a drop, where an inversion sits in the energy curve — then write your own.

**Scale facts this file is written at** (`<Park size>` default **128**,
`Park/parkRoot.tsx:137`): plot `x, z ∈ [−64, 64]`, footprint bounds
`±(size/2 − 0.05)` = **±63.95**, coaster TRACK bounds `±(size/2 + 0.3)` =
**±64.3**, bare `<Gate/>` at **`[0, 63.6]`**. On the 128 plot **bounds are almost
never what constrains an archetype** — the whole flagship shelf fits inside a
fifth of the plot's width. What constrains it is the LEGAL START range (the rings
grow WEST) and the corridor keep-out.

> ## ⚠ THIS FILE HAS NO FILESYSTEM BEHIND IT. THE ARCHETYPES ARE INLINE.
>
> You receive injected rule TEXT and loaded SKILL BODIES — not a checkout. Round 13's
> park A searched the project for `rules/park-generation-rides.md` and for
> `monorail-ref`, found neither, reported *"the rules files and reference samples
> aren't in the project"*, and improvised the mandatory monorail from memory with two
> props that do not exist. **A `§x.y` or a file path in this skill is PROVENANCE —
> where a number was measured — never an instruction to fetch anything.** The three
> flagship shelves, their legal start ranges, their corridor tables and the monorail's
> 17-piece list are all in THIS file. If a block is not in front of you, **use only
> what is** — a verified archetype you can see beats an invented circuit.

The archetype measurements were taken in `rules/park-generation-rides.md` §4 and the
always-on checklist was written in `rules/park-generation.md` §0 — **both cited purely
for provenance: neither file is ever delivered into a generation.** THIS FILE IS THE
AUTHORITY for everything it states. The one other document that always arrives is
`rules/setup.md` (published from `mp3d/SETUP.md`), whose §0-P carries the pre-bundle
gates and the mandates.

## Step 0 — A PARK NEEDS **TWO** COASTERS AND **FIVE** CIRCUITS. Read this first.

**Everything below this line used to be written in the singular — "THE
flagship" — and that was a real defect, not a style choice.** The rubric scored
one field (`thrill.flagshipExcitement`) off one ride, so a park with one
excellent coaster scored *exactly the same* as a park with three, and nothing
ever asked for a second. **Measured over the 24-park corpus: 16 of 20 probed
parks registered exactly ONE coaster, 3 registered none, one registered two.
`inversions` is 0 in all 15 rated parks — §4.0-C has never shipped.**

At `size 128` (the default), ship:

| | requirement |
|---|---|
| **coasters** | **2**, from **DIFFERENT** §4.0 archetypes, on **DIFFERENT `rateCoaster` `ratingBand`s** (A I 9.32 *intense* · B I 6.25 ***thrilling*** · C I 9.55 *intense*) → **A + B** or **C + B**, never A + C. **Do NOT hand-roll the band split** — all three archetypes rate `I > 6`, so the `≤3 / ≤6 / >6` bands used for the PARK MIX can never separate two of them; read `ratedCoasters[].ratingBand`. Each `rateCoaster`-measured, each line pasted into the §0 header, each with its OWN corridor keep-out rect in PLOT coordinates. |
| **circuits, total** | **5**, spanning **≥ 3** of the five families `coaster / water / transport / dark / tower`. The §4.2 monorail ring is one of them. |
| **novelty** | **≥ 1** circuit off the never-used shelf (14 of the catalog's 27 circuits have never shipped: `Bassline` `LavaTubeRun` `MineTrainCoaster` `SplineCoaster` `WyrmsHollow` `DeepDrift` `MagmaRun` `OceanTunnelSlide` `MagneticRide` `GoKarts` `GearworksExpress` `HauntedMansion` `Helicycles` `MotionSimulator`). |
| **flat spinners** | do **NOT** count. A Carousel, DropTower or Discotron is not a circuit. One coaster plus eight spinners measures `circuitCount: 1`. |

**Scoring consequence: one coaster caps the Thrill axis at 7.25/8; one coaster
plus flat rides only caps it at 6.5/8.** At `size ≤ 48` two §4.0 rings do not fit
(§4.0-A alone spans 37.6 × 37.6 of a 48-u plot) — ship ONE archetype plus three
or four no-compile circuits, and say so in the header.

**WHERE THE SECOND COASTER GOES IS MEASURED, NOT CHOSEN.** Both coasters must
feed `<Terrain coasterPts>`, which caps every peak they cross, which drives the
composed relief toward `terrainFlattened` (FATAL when kept < 0.70 **and** stdH
< 0.76). `skeleton-b` shipped that search at **kept 0.73 against the 0.70 floor — 0.03 of
headroom**; the SOUTH-QUEUE repair has since taken its baseline to **kept 0.81**, so
re-measure before publishing a start. Nine candidates were measured; **three came
out `terrainFlattened`-FATAL and two moved a water body 25–77 u
(`waterRePicked`)**:

```
 archetype @ start        kept  stdH   water moved   verdict
 (flagship only)          0.73  0.72   0 / 0         baseline
 §4.0-A @ [−2.4, −38.4]   0.73  0.72   0 / 0         CLEAN  ← published slot
 §4.0-C @ [−2.4, −38.4]   0.73  0.72   0 / 0         CLEAN  ← published slot (prefer C)
 §4.0-B @ [−1.2, −33.6]   0.72  0.72   0 / 0         clean
 §4.0-B @ [−1.2,  31.2]   0.73  0.73   secondary 25  REJECT waterRePicked
 §4.0-B @ [33.6, −36.0]   0.90  0.81   77 / 64       REJECT + 4 cells in water
 §4.0-B @ [33.6, −33.6]   0.63  0.65   0 / 0         REJECT terrainFlattened
 §4.0-B @ [−21.6, 21.6]   0.61  0.64   0 / 0         REJECT terrainFlattened
```

**The five geometric rules for the second circuit**, in the order they bite:
its bounding box **disjoint** from the first one's (both grow WEST only and
straddle the start in z, so separate them in **z**, not x); **off all 16 monorail
ground cells** (avoid `x ∈ [−1.2, 1.2]` and `z = −8.4` at the published ring
start — the beam flies at 2.6 u and may be crossed, the platforms may not);
**outside every `<World>` rect**; **not on a flank** (`reliefBias inner` 0.18, so
flanks carry ~2.4× the relief); and **its own keep-out rect published** in the
§0 header.

## Step 1 — pick the two shelves from the park's declared type

| park type | archetype | excitement | intensity band | footprint (w × d) | share of a 128 plot |
|---|---|---:|---|---|---:|
| THRILL flagship | **§4.0-A** steel rectangle | **6.12** | I 9.32 — `ratingBand` *intense* | 37.6 × 37.6 | 8.6% of area |
| THRILL flagship, highest | **§4.0-C** inverting, 2 corkscrews | **6.27** | I 9.55 — `ratingBand` *intense* | 35.2 × 36.8 | 7.9% |
| FAMILY flagship **/ the SECOND coaster of a thrill park** | **§4.0-B** steel rectangle | **5.27** | I 6.25 — `ratingBand` ***thrilling*** | 28.9 × 30.4 | 5.4% |
| a kiddie circuit only | legacy rect h1.0 | 0.63 wooden / 1.11 steel | — | 5.0 × 17.8 | — |
| a filler on a cramped plot (size ≤ 20) | legacy L-wrap h1.0 | 0.62 / 1.10 | — | 12.8 × 12.3 | — |

**A park whose BEST coaster comes from the legacy shelf fails the Thrill axis
no matter how tidy the layout is** — and the legacy shelf is no longer the answer
for a second coaster either: §4.0-B rates 5.27 for the same transcription effort
that a legacy rect spends on 1.11. **Pick TWO rows from the top three, on
different `ratingBand`s.**

> ## ⚠ THE BAND SPLIT IS `rateCoaster`'s OWN `ratingBand`, NEVER A HAND-ROLLED
> THRESHOLD — AND THE OLD CLAUSE WAS UNSATISFIABLE.
>
> §4.0-E used to say *"the two coasters in DIFFERENT intensity bands (`≤ 3` gentle /
> `≤ 6` moderate / `> 6` intense)"* and then cite §4.0-B as *"I 6.25 moderate"* — but
> **6.25 > 6, so B is `intense` under the very bands the clause defines.** Re-measured
> through the real `rateCoaster` on 2026-07-26: **§4.0-A I 9.32 · §4.0-B I 6.25 ·
> §4.0-C I 9.55 — ALL THREE are `> 6`. No pair of §4.0 coasters could ever satisfy
> it**, and `probe.mjs:363` hard-codes the same split, so on a correct A+B park
> `thrill.secondDistinctBand` reads **false** and `thrill.coasterIntensityBands` reads
> **`["intense"]`**. It was a permanent fail with no legal move.
>
> **NOTHING WAS EVER SCORED OFF IT.** RUBRIC.md's axis-14 park-thrill-MIX point reads
> `thrill.mixComplete` and the roster term reads `thrill.intensitySpread` (max − min
> over the RATED coasters) — **neither one reads `secondDistinctBand`.** It was
> unachievable advice, not a lost point.
>
> **THE FIELD THAT WORKS IS `ratingBand`**, the RCT2 ride-window word
> (`SplineRideKit/ratings.ts:174`, `floor(rating·100 / 256)` into **gentle < 2.56 ·
> moderate 2.56-5.11 · thrilling 5.12-7.67 · intense 7.68-10.23 · extreme ≥ 10.24**).
> On that scale the archetypes DO separate: **§4.0-B is `thrilling` (6.25) while
> §4.0-A (9.32) and §4.0-C (9.55) are `intense`.** So the old conclusion survives its
> broken premise — **pair A+B or C+B, never A+C** — and the check is
> `ratedCoasters[0].ratingBand !== ratedCoasters[1].ratingBand`, never a threshold you
> wrote yourself.

At 128 an archetype **OWNS A DISTRICT, not the park** — 37.6 × 37.6 was the whole
old 48 plot and is under a third of this one's width. Run that district's streets
and 2-4 more rides in the RING'S INTERIOR, and build the park's other districts
BESIDE the ring.

**AND THE PARK'S INTENSITY SPREAD COMES FROM THE FLAT/TRACKED ROSTER, NOT FROM THE
COASTERS.** `probe.thrill.intensityMix` is computed off the **registered `intensity`
prop of every ride** (`probe.mjs:330-337`), and its bands are `gentle ≤ 3 · moderate
4-6 · intense > 6`. **Every §4.0 archetype rates `I > 6`, so no coaster can supply the
gentle or the moderate band** — a carousel, a wheel, a barge, a chairlift or the
monorail supplies gentle; a dark ride, a rapids or a simulator at `intensity={5}`/`{6}`
supplies moderate. Ship all three and `thrill.mixComplete` reads true. **The
COASTER-vs-COASTER test is a DIFFERENT field: see the box under Step 1's table.**

## Step 2 — read the worked block, then write your own

Shared rules for all three. **Do not vary any of these:** `type="steel"`,
`heading: 0`, **no `bank` prop** (the pieces-mode default 0.7 saturates at the
steel 55° cap and is what soaks the lateral G — a lower bank re-opens the
1.27 g gate), `capacity: 4`, `rideDuration: 10`, `intensity: 7`,
`queueDir: [1, 0]`, queue tail node at **`[start.x + 6.0, start.z]`**, and
**`exit`/`exitDir` OMITTED** (Step 3).

Declare each array as a real **`TrackPiece[]`** with **no `as` / `as const` /
`as any` cast** — a cast suppresses exactly the misspelt `type` or missing
`height` that makes `compileTrackPieces` FATAL, and a fatal compile renders
translucent red and NEVER REGISTERS: no station, no queue, and the thrill axis
and the ride slot both read empty.

### A — THRILL flagship, E 6.12

```tsx
const A_PIECES: TrackPiece[] = [ /* WORKED EXAMPLE — the one canonical copy is in
  `rules/setup.md` §0-P.4. It was published in THREE files that did not even agree on
  which three archetypes existed. Read it for the idiom, then AUTHOR YOUR OWN circuit
  with at least one inversion and verify it (§4.0). */ ];
const A_START: V3 = [16.8, 0.55, -3.6];   // the VERIFIED reference start
```

Measured (`cars: 5`, bank 0.7): E **6.12** / I 9.32 / N 3.43, highest drop
5.47 u, 9 drops, +G 6.26, −G −3.86, **maxLatG 0.36 g**, airtime 1.06 s,
length 158.63, duration 24.59 s. Footprint at that start X −20.81..16.80,
Z −19.33..18.28, maxY 6.05.

### B — FAMILY flagship, E 5.27, gentle forces

```tsx
const B_PIECES: TrackPiece[] = [ /* WORKED EXAMPLE — the one canonical copy is in
  `rules/setup.md` §0-P.4. It was published in THREE files that did not even agree on
  which three archetypes existed. Read it for the idiom, then AUTHOR YOUR OWN circuit
  with at least one inversion and verify it (§4.0). */ ];
const B_START: V3 = [14.4, 0.55, -2.4];
```

Measured (`cars: 3` — the default, pass no `cars` prop): E **5.27** / I **6.25**
(`ratingBand` ***thrilling*** — the ONLY §4.0 archetype that is not *intense*) /
N 2.25, highest drop 3.58 u, 6 drops, +G 3.51, −G −1.97, **maxLatG 0.27 g**,
airtime 0.56 s, length 120.87. Footprint X −14.52..14.40, Z −15.67..14.75,
maxY 4.15.

### C — INVERTING flagship, E 6.27 (highest rated)

```tsx
const C_PIECES: TrackPiece[] = [ /* WORKED EXAMPLE — the one canonical copy is in
  `rules/setup.md` §0-P.4. It was published in THREE files that did not even agree on
  which three archetypes existed. Read it for the idiom, then AUTHOR YOUR OWN circuit
  with at least one inversion and verify it (§4.0). */ ];
const C_START: V3 = [16.8, 0.55, -3.6];
```

Measured (`cars: 3` default), **RE-MEASURED 2026-07-26**: E **6.27** / I **9.55**
(`ratingBand` *intense*) / N 3.55, highest drop **5.47 u**, total drop 19.87,
**7 drops**, **maxLatG 0.73 g** (43 % margin), **2 inversions**, length 152.17,
turns `banked[3] = 4` + `sloped[1] = 5`, `sloped[2] = 1`. Footprint X −18.42..16.80,
Z −18.16..18.64, maxY 6.05.

> **THIS LINE USED TO READ E 6.31 / I 9.64 / N 3.60 / maxLatG 0.90 AND NO LONGER
> REPRODUCES** — the ratings kit moved under it. §4.0-A (E 6.12 / I 9.32 / N 3.43 /
> latG 0.36) and §4.0-B (E 5.27 / I 6.25 / N 2.25 / latG 0.27) both reproduce
> EXACTLY, so the drift is specific to the corkscrew geometry, which only C has.
> Nothing about the archetype's legality changed: it still clears the 1.275 g lateral
> gate by **43 %** (it was 29 %), and it is still the highest-rated shelf. **Take
> these figures, and if you need them to the cent, re-run `rateCoaster`.**

**Why the corkscrews sit exactly there:** a corkscrew reads ~0.21 effective
curvature, so at grade (v ≈ 10.9) it measures **2.35 g** and is FATAL. It must
be ridden within ~2.5 u of the apex, but it is also LEVEL and rises ~1.13 u,
so straight after the lift hill its top becomes the global maximum,
`detectLiftHill` swallows it and the train crawls through the inversion at
chain speed. Hence `H1 = 5.5` on the station leg and `Hn = 4.2` elsewhere,
corkscrews on the leg-3 and leg-4 climb tops (4.75 + 1.13 = 5.88 < the 6.05
apex). **Do not move them, do not deepen `Hn`, do not raise `H1`.**
(`Hn = 4.6` puts a corkscrew top above the apex; three corkscrews reach
1.06 g; every mid-slope placement breaches 1.275 g.)

**Re-tune them freely — then verify.** RCT2 cuts excitement 25 % per band once
intensity reaches 10.00 and A/C already sit at 9.32/9.55 — a deeper lift or an
extra corkscrew LOWERS the score.

**PUBLISHED STATS ARE ±0.1 AND TERRAIN-DEPENDENT.** The figures above are
`rateCoaster` on the compiled points in isolation; mounted on composed ground
§4.0-A measures **E 6.06** where the table says 6.12. So **CALL `rateCoaster`
and paste ITS line into your §0 header — never hard-code a `ratings=` prop off
this table.** And the same archetype at the same start is not clean on every
landform: on seed 5 alpine, whose SW peak cluster sits under the ring, §4.0-A
fails `checkCoasterDesign` with `pitchRate 0.59` (limit ~0.55). If it violates,
MOVE THE RING to flatter ground rather than re-tuning it.

## Step 3 — the full wiring, copy-paste

```tsx
import type { V3, XZ } from './components/Park';   // ONE canonical line — BOTH come from here
import type { TrackPiece } from './components/SplineRideKit';
import { Park, Terrain, Paths, GameManager, Gate, Coaster } from './components/Park';
import { compileTrackPieces, rateCoaster } from './components/SplineRideKit';
import { buildParkNet } from './components/SetPieceKit';

const START: V3 = [16.8, 0.55, -3.6];                      // A_START
const TAIL: XZ = [START[0] + 6.0, START[2]];               // [22.8, -3.6] — an AUTHORED node

// Compile ONCE, up front. DESTRUCTURE the report — do NOT cast it: the kit
// already types `points` as V3[], and a cast re-widens it to number[][] which
// is not assignable to <Terrain coasterPts>.
const { points, report } = compileTrackPieces(A_PIECES, {
  profile: 'coaster', type: 'steel', start: START, heading: 0,
});
const FLAG_PTS: V3[] = points;          // feeds <Terrain coasterPts> so hill peaks
                                        // are pre-capped under the circuit (skip it and
                                        // ground clamps kink the profile into pitchRate
                                        // violations). Read report.fatal /
                                        // report.closure.synthesized here, don't hope.
const RATING = rateCoaster(FLAG_PTS, { type: 'steel', bank: 0.7, cars: 5 });
console.log('[thrill]', RATING.excitement, RATING.intensity, RATING.nausea,
  'drop', RATING.highestDrop, 'lat', RATING.maxLatG, 'air', RATING.airtimeSeconds);
// ↑ paste THAT line into the §0 header.

// … NET = buildParkNet({ nodes: [...NODES /* TAIL is one of them */], … }) …
// ONE fuse for the whole park (§0.15) — this is the same NET every offPathCell
// call and <Paths> receive. `start` below is one of the only TWO coordinates in
// the park exempt from offPathCell (the other is §4.2-A's monorail `position`):
// it is a PUBLISHED POSE with measured clearances. Every pad you site yourself,
// including one correctly derived from a tail, still goes through the call.

// BOTH coasters' points, ALWAYS (§4.0-E): passing only the flagship's leaves the
// ground under the second ring uncapped. And keepDry gets the SIEVED list — never
// `NET.keepDry` raw, which merges every set-piece cell and re-picks the water (−7).
<Terrain keepDry={GUARDS} coasterPts={[...FLAG_PTS, ...FLAG2_PTS]} />
<Coaster
  name="Thunderhead"     /* MANDATORY: the corridor gate exempts a ride's own access
                            rects BY NAME, so an unnamed circuit makes the whole
                            ride-footprint sweep SKIP — you lose the check, not pass it */
  pieces={A_PIECES}
  start={START}          /* accepts [x, y, z] — the y is ignored */
  heading={0}
  type="steel"
  cars={5}               /* A only; B and C use the default 3 — omit the prop */
  capacity={4}
  rideDuration={10}      /* ≤ 12 or the 60 sim-s acceptance run can't complete a cycle */
  loadTime={2}
  intensity={7}
  price={6}
  queueTailNode={NET.node(TAIL)}   /* the chassis derives head, hut, lane AND exit */
  queueDir={[1, 0]}
  deck={[START[0], START[2] + 1.2]}
/>
```

### THE EXIT IS DERIVED — omit `exit` and `exitDir`

**The archetypes' old pinned `exit: [start.x + 2.4, start.z + 2.4]`,
`exitDir: [1, 0]` is WITHDRAWN.** That cell was 2.4 u along the station face and
0.71 u out of it — not the RCT2 adjacency — and it sat on whichever side the
layout happened to leave empty, with no street on its outward ray: on three
reference parks the ride got NO EXIT PATH at all, which is now a hard
`accessibility` FAIL. `exit`/`exitDir` are OPTIONAL on `<Coaster>`. **Leave them
unset.** The chassis knows the RESOLVED queue direction and ray-casts both
candidate cells against the real lattice; you cannot beat it.

What it derives, if you want it on paper (capacity 4 ⇒ `laneLenOf(4)` 3.34,
join 3.69, hut offset 0.62):

| | value | derivation |
|---|---|---|
| queue tail node | `[start.x + 6.0, start.z]` | authored |
| queue head (`anchor`) | `[start.x + 2.31, start.z]` | tail − dir·3.69 |
| entrance hut | `[start.x + 1.69, start.z]` | anchor − dir·0.62 |
| **exit hut** | **`[start.x + 1.69, start.z ± 1.2]`** | entrance hut ± ONE TILE along the face |
| **`exitDir`** | **`[1, 0]` — the SAME as `queueDir`** | both doorways face out |

The sign is the part you cannot pin blind — it is whichever side has a street on
its ray. Measured on the reference parks: exit `[18.49, −4.8]` facing `[1, 0]`,
**3.69 u** of exit path onto the spine at x 22.8. Both huts clear the station
straight (its no-go rect reaches `start.x + 0.55`, hut half-depth 0.50 → near
edge at `start.x + 1.19`), and the 1.2 pitch leaves 0.1 u between the two
1.09-wide huts — the tightest legal RCT2 pitch, SAT-clean.

**So the binding layout requirement is: the station face the queue comes off
needs TWO FREE TILES SIDE BY SIDE.** Where both adjacent cells are illegal the
chassis records `exitFaceBlocked` and does NOT repair onto another face.

## Step 4 — queueDir and the tail distance are part of the archetype

**`queueDir: [1, 0]` is verified only TOGETHER WITH `heading: 0`.** The station
straight runs **+z** at heading 0, so the only lane orientation that does not
spear the station is ±x. `[0, ±1]` is auto-FLIPPED and the flip is a §0-FATAL
`queueDirFlip` lint. At any other heading, rotate BOTH or re-derive both.

**`[1, 0]` alone is not enough — the tail DISTANCE is part of the archetype.**
The manager plans the head at `tail − dir·(laneLenOf(capacity) + 0.35)` and the
entrance hut a further 0.62 back, with
`laneLenOf(c) = max(2.2, 1.1 + 0.56·c)` (`ParkBuilder/placement.ts:79`). The
station straight's own no-go rect reaches `start.x + 0.55`, so at capacity 4
(`laneLenOf` 3.34) the hut's inner edge lands at `tail − 4.91` and the tail must
satisfy

```
tailX ≥ start.x + laneLenOf(capacity) + 2.12    →  capacity 4: start.x + 5.46
```

A tail at `start.x + 4.8` FLIPS (verified). **Every archetype is published with
its tail at exactly `start.x + 6.0`, same `start.z`, and ran unflipped and
untrimmed. Use 6.0. Do not re-derive it.**

That tail cell must be a **real authored street node** in the graph `<Paths>`
renders — a member of your own `NODES` list, looked up with `NET.node(TAIL)`.
Queue lanes are railed on both sides and enterable ONLY at the tail, so a tail
that is not on a walked node makes the ride permanently unreachable. **Prefer a
tail node that is a JUNCTION** (a street crossing it perpendicular to the lane):
the derived exit path then meets the cross-street in the same 3.69 u the queue
takes, instead of running the length of the lane and turning.

**BUT KEEP THE LANE ITSELF CLEAR OF EVERY STREET — A LANE LAID ACROSS A STREET
COSTS SIX FAILURES, NOT ONE (measured wave 17).** The lane is a SOLID: railed both
sides, enterable only at the tail. At capacity 4 it occupies
`[start.x + 2.31, start.x + 6.0]` at `z = start.z` — i.e.
`[tail − dir·(laneLenOf(4) + 0.35), tail]`. Run a street through that span and you
get **2 `blockers` findings on the lane's own railings PLUS one per ride whose tail
is now "reachable only THROUGH a solid object"** — 4 more in the measured case,
because the railing severed the single route to the far half of the park. On a
tree-shaped street net there is no second route at all. So the junction you prefer
must be the tail's **cross**-street, not a street running ALONG the lane axis:
**compute the span and keep every street node and edge ≥ 2.4 u off it.** Skeleton B
hangs its tail `[21.6, −2.4]` off the junction at `[24.0, −2.4]`, giving a lane
`x 17.9 … 21.6` that clears the arterial at `x 24.0` by exactly 2.4 u.

## Step 5 — translate rigidly, in lattice multiples of 1.2

The compiled geometry is **start-relative and size-independent** (verified:
`compileTrackPieces` output is bit-identical at bounds 16, 48 and 128). Shift
`start` by lattice multiples of 1.2 and **everything shifts rigidly with it** —
footprint extents, the corridor cell table, the tail, the deck.

**THE RINGS GROW WEST. The start is the EASTmost point** and z straddles it, so
*a start near the −x (WEST) edge is THE failure mode* — §4.0-A at `start.x = −90`
on a 192 plot reached ±127.6 u, `report.fatal` fired and the ride never
registered. Use the MEASURED legal ranges
(`harness/park-eval/probe-archetype-bounds.mjs`), never a hand derivation:

| archetype | local bbox (closure included) | LEGAL START @ **128**, on the 1.2 lattice |
|---|---|---|
| **A** | x −37.61..0.00, z −15.73..21.88 | **x ∈ [−26.4, 63.6], z ∈ [−48.0, 42.0]** |
| **B** | x −28.92..0.00, z −13.27..17.15 | **x ∈ [−34.8, 63.6], z ∈ [−50.4, 46.8]** |
| **C** | x −35.22..0.00, z −14.56..22.24 | **x ∈ [−28.8, 63.6], z ∈ [−49.2, 42.0]** |

(At 192: A x ∈ [−57.6, 96.0] z ∈ [−80.4, 74.4] · B x ∈ [−67.2, 96.0]
z ∈ [−82.8, 78.0] · C x ∈ [−60.0, 96.0] z ∈ [−81.6, 73.2]. At 48 they collapse
to a ~10-u window each, which is why the verified starts are 16.8/14.4/16.8.)

**AND INSIDE THAT RANGE, PICK THE PLOT *CORE* — A FLANK START IS A FATAL
`terrainFlattened` (measured wave 17).** `coasterPts` caps every hill peak along
the whole circuit (`capPeakForCoaster`), and the composition anchors its mountain
ranges **on the FLANKS**: `reliefBias inner` is **0.18**, so the core is gentle by
construction while the flanks carry ~2.4× the relief. A circuit out there crushes
several ranges at once. Measured on one park, moving ONLY the flagship:

| flagship position | kept (floor 70 %) | `stdH` (floor 0.76) | verdict |
|---|--:|--:|---|
| on a FLANK | **69 %** | **0.69** | both halves of the conjunction → **§0-FATAL `terrainFlattened`** |
| in the plot CORE | **73 %** | in band | non-fatal warning |

A ~30 × 30 u circuit in the gentle centre costs almost no relief. The verified
skeleton B keeps a free plot centre `x[−14.4..16.8] z[−16.8..15.6]` for exactly
this and puts §4.0-B's start at `[15.6, 0.55, −2.4]`. **Do not try to rescue a
flank flagship by trimming `keepDry` — move the circuit.**

On top of the range keep **`start.x ≤ size/2 − 6`** so the queue tail at
`start.x + 6.0` lands on the plot too, and translate all four together:

```
offset (dx, dz), both multiples of 1.2
start   → [START.x + dx, 0.55, START.z + dz]
tail    → [START.x + 6.0 + dx, START.z + dz]
deck    → [START.x + dx, START.z + 1.2 + dz]
corridor cells → every listed cell + (dx, dz)
```

### The registered position is the FOOTPRINT CENTRE, not `start`

This is what breaks `worldPlan({ include })`. A world is BUILT only when a
registered ride's **registered position** falls inside the rect, and a `<Coaster>`
registers at its footprint centre — up to 19 u from `start`, usually in the
district next door. Compute it from the local bbox:

| archetype | registered position, relative to `start` |
|---|---|
| A | **(−18.81, +3.08)** |
| B | **(−14.46, +1.94)** |
| C | **(−17.61, +3.84)** |

So A at `start [16.8, −3.6]` registers at ≈ **(−2.0, −0.5)**. List THAT cell in
the world's `include` (or better, `rides: [{ at: THAT, name }]`), never `start`.

## Step 6 — the corridor cell tables (copy, never derive)

A 1.6-u-wide corridor is swept along the compiled polyline. No street edge,
stall, or other ride's pad/hut/lane may sit in it unless the track is **≥ 2.2 u
above** the obstacle there. The ride's OWN access assembly is exempt, matched by
ride NAME.

Every cell below is an **offset from `start`**, in the compiled frame (heading 0,
station running +z), and the tables are size-independent and
translation-invariant. A row `x −4.8: z −3.6..15.6` means the cells
`(start.x − 4.8, start.z − 3.6) … (start.x − 4.8, start.z + 15.6)` at 1.2 steps.

**A (175 cells)** — the apex legs FLY (rails 2.2-6.05 u up), so only the four
valley floors and the station leg obstruct at grade; the whole 30 × 30 middle of
the ring is FREE:

```
x −38.4/−37.2:  z −7.2..13.2        ← west leg valley + hills
x −28.8..−8.4:  z −16.8..−14.4      ← south leg valley + hills
x −26.4..−9.6:  z  20.4..22.8       ← north leg valley + hill
x −1.2/+1.2:    z −7.2..7.2         ← station leg (own ride: exempt)
x   0.0:        z −7.2..8.4
```
Build in `x −36.0..−2.4 × z −13.2..19.2` (the interior) or the east apron
`x ≥ +2.4`.

**B (160 cells)** — interior free block `x −26.4..−2.4 × z −10.8..14.4`:

```
x −30.0/−28.8:  z −6.0..10.8
x −27.6:        z −4.8..10.8
x −22.8..−6.0:  z −14.4..−12.0
x −18.0..−6.0:  z  15.6..18.0
x −1.2/+1.2:    z −7.2..7.2
x   0.0:        z −7.2..8.4
```

**C (149 cells)** — interior free block `x −32.4..−2.4 × z −12.0..20.4`:

```
x −36.0:         z  0.0..14.4
x −34.8:         z −1.2..14.4
x −33.6:         z  0.0..14.4
x −27.6..−12.0:  z −15.6..−13.2
x −25.2..−9.6:   z  21.6..22.8
x −1.2/+1.2:     z −7.2..7.2
x   0.0:         z −7.2..8.4
```

Rows are rounded OUTWARD by at most one cell at each end — erring toward
"blocked" is always safe. At runtime `manager().corridorCells(name?)` returns the
live list.

### PUBLISH THE KEEP-OUT IN PLOT COORDINATES IN YOUR §0 HEADER

The tables are offsets; the thing you check streets against is a rect in the
plot's own frame. Add your start and write it down — for A at `[16.8, −3.6]`:

```
 * CORRIDOR KEEP-OUT (§4.0-A @ start [16.8, −3.6], PLOT coords):
 *   west valley  x[−21.6..−20.4] z[−10.8..9.6]
 *   south valley x[−12.0..8.4]   z[−20.4..−18.0]
 *   north valley x[−9.6..7.2]    z[16.8..19.2]
 *   station leg  x[15.6..18.0]   z[−10.8..4.8]   (own ride — exempt)
 *   every street node + every boulevard leg outside all four ✓
```

**THE VALLEY LEGS DO NOT FLY, so "it crosses the ring" is never OK.** The four
valley floors and the station leg run **~0.6 u above path level** — under a
third of the 2.2-u overfly gate — so a street crossing one is a grade crossing,
full stop, and grade crossings are NEVER auto-fixed. A street may cross only
under a LIFT/HILL measuring ≥ 2.2 u there, which on A means the apex legs and
nothing else. Practically: enter the ring's interior on a column just OUTSIDE a
valley band — for A at `start [16.8, −3.6]` the north band stops at x 7.2, so a
north-south street at **x 9.6** runs from the north apron clean through the
interior to the south apron, crossing nothing.

**AND IF THE HUB AXIS INTERSECTS THE RING, MOVE THE RING — not the street.** The
flagship owns a district; the hub axis is the park's circulation spine with every
other district hanging off it. Relocating the ring is one lattice translation and
the corridor table moves rigidly with it.

**Legacy shelf corridor tables** (for a second small coaster):
*rect h1.0 @ `[2.4, 0.55, −6.0]`* (103 cells, whole circuit below 2.2 u):
```
x −6.0: z −2.4..14.4
x −4.8: z −3.6..15.6
x −3.6: z −3.6..15.6
x −2.4: z −3.6..−1.2, 14.4..15.6    ← the alley between the two legs
x −1.2: z −3.6..15.6
x  0.0: z −3.6..15.6
x  1.2: z −2.4..14.4
```
The alley (x −2.4, z 0.0..13.2) is clear but fenced in on both sides — put
nothing there that needs street access.
*L-wrap h1.0 @ `[6.0, 0.55, −3.6]`* (113 cells): clear pockets are the band
`x −6.0..−2.4 × z 0.0..7.2` inside the wrap and everything at `x ≥ 2.4` or
`z ≤ −4.8`.

## Step 7 — self-check against the published numbers

| target | THRILL park | FAMILY park |
|---|---:|---:|
| flagship `excitement` | ≥ 6.0 | ≥ 5.0 |
| `maxPosVertG` | ≥ 2.5 g | ≥ 1.8 g |
| `highestDrop` | ≥ 2.0 u | ≥ 1.2 u |
| `maxLatG` | **< 1.27 g** — the crash gate, non-negotiable either way | |
| `airtimeSeconds` | > 0 on at least one crest | |
| `nausea` | < 8.0 (past that, extreme nausea caps the whole axis at 5/8) | |

If you copied verbatim and translated rigidly, A/C clear every THRILL row and B
clears every FAMILY row. **If you edited a piece list, you no longer know the
numbers and cannot claim them.**

## Legacy shelf — the second, small coaster

Both end with a 1.2-u brake tail landing 0.9 (= g − 0.3) short of the start.
Lift **1.0** is mandatory: lifts 0.6/0.7 are RETIRED because their first drop
measures 0.70/0.79 u, under RCT2's 0.9-u `shortDrop` gate — which HALVES all
three ratings and is a FATAL `coaster:shortDrop` lint (the one kind the gate
promotes to fatal by itself, `FATAL_LINT_KINDS`).

```tsx
// compact rectangle + tail, h 1.0 — span 5.0 × 17.8
const RECT: TrackPiece[] = ['station', { type: 'lift', height: 1.0 }, 'drop', 'turnR',
  { type: 'straight', length: 2.0 }, 'turnR',
  { type: 'straight', length: 14.8 }, 'turnR',   // = 2.6 + 2×5.5 + 1.2
  { type: 'straight', length: 2.0 }, 'turnR',
  { type: 'straight', length: 0.9 }];
// VERIFIED start [2.4, 0.55, -6.0], heading 0 → X -2.60..2.40, Z -8.74..9.06,
// maxY 1.55, closure synthesizes NOTHING.
// wooden: E 0.63 / I 0.86 / N 0.38, drop 1.00, +G 1.98, lat 0.99 g, len 43.27
// steel:  E 1.11 / I 1.02 / N 0.32, +G 2.41, lat 0.59 g

// L-wrap + tail, h 1.0 — span 12.8 × 12.3, fits a compact size 16
const LWRAP: TrackPiece[] = ['station', { type: 'lift', height: 1.0 }, 'turnR', 'drop', 'turnR',
  { type: 'straight', length: 2.0 }, 'turnL',
  { type: 'straight', length: 1.3 }, 'turnR',
  { type: 'straight', length: 4.3 }, 'turnR',
  { type: 'straight', length: 9.8 }, 'turnR',
  { type: 'straight', length: 0.9 }];
// VERIFIED start [6.0, 0.55, -3.6], heading 0 → X -6.78..6.02, Z -6.32..5.98
// wooden: E 0.62 / I 0.84 / N 0.39, lat 1.01 g · steel: E 1.10, lat 0.79 g
```

Same wiring rules: `heading: 0`, `queueDir: [1, 0]`, tail at `start.x + 6.0`,
exit/exitDir OMITTED, no `bank` prop. `coaster:shortLength` is reported and NOT
fatal (a short circuit is a deliberate kiddie-coaster choice).

## Only if you must author your own circuit

Do this only for `<Coaster>`/`<TrackRide>`, and only when the brief demands a
shape no archetype provides. You are then responsible for every number.

**RUN-LENGTH TABLE** — walk the cursor on paper with THESE advances. The cursor
starts at the local origin heading +z; every piece starts and ends level.

| piece | cursor advance |
|---|---|
| `station` (FIRST piece) | 2.6 (default length) |
| `flat`/`straight` | its `length` (default 1.3) |
| `lift`/`drop` h | **≈ 1.6 + 3.9×h** — auto-extended for pitch legality, a shorter `length` is IGNORED. h 0.6 → 3.9, 0.9 → 5.1, 1.0 → **5.5**, 1.2 → 6.3, 1.5 → 7.4, 1.8 → 8.0, 2.0 → 7.9; past 2.0 it grows ~1.3/unit: 3.2 → 8.9, 3.6 → **9.49**, 4.2 → **10.27**, 5.1 → **11.43**, 5.5 → **11.94**, 6.0 → 12.6 |
| `hill` h | max(`length`, 3.6, 6.3×√h) — h 0.6 → 4.88, 0.9 → **5.98**, 1.2 → 6.90 |
| `turnL`/`turnR` 90° | R along the OLD heading + R along the NEW (default R 1.5, keep ≥ 1.5); heading ±90°; arc length 2.36 |
| `helixL`/`helixR` 360° | returns to its ENTRY point (net zero advance), ±`height`; sweeps a ~3 u circle to the side |
| `corkscrewL/R` (STEEL only) | forward max(`length`, 4R) — default **2.40**, level, rises ~1.13 u |
| `sbend` | forward max(2.4, `length`, default 3.6); lateral `radius` (default 1.2, +ve left) |

So `station + lift h + drop` = `2.6 + 2×(1.6 + 3.9h)` of dead-straight run:
13.6 u at h 1.0, 15.1 at h 1.2, 26.5 at h 5.5. Budget the land BEFORE picking
heights.

**Closure is HEADING ALIGNMENT, not aim.** The compiler auto-closes onto the
START POSE — the station start point AND the heading you left it on — via an
eased ramp plus the shortest arc–straight–arc (closure radius **2.2** for
coasters, 1.5 other profiles) landing through a synthesized 1.2-u brake tail.
The last authored piece must leave the cursor (a) heading within **~30°** of the
station ENTRY heading and (b) within **~3 u** of the start.

**A synthesized closure over 40 % of the authored length is FATAL** —
translucent red track, NEVER REGISTERED, no station, no queue, and the category
you thought you filled is EMPTY, with nothing in the report but a console line.
"Pointing at the station" from mid-park is ~180° off: the compiler synthesizes a
long return loop (verified: `turnR 4°, straight 8.0, turnR 176°`). Measured
cost: one park lost BOTH tracked rides this way — 20.7 u synthesized against
31.1 u authored (66 %) and 19.2 u against 25.5 u (75 %) — **−7.0 on thrill,
−0.5 on roster, and an empty WATER category, from two hand-written arrays.**

**LAND STRAIGHT, and land SHORT.** When your own pieces reach the start (gap
≤ 0.5, nothing synthesized), the final authored piece must be a straight brake
tail ≥ ~1.2 u along the station axis, landing ~0.3 u short. A turn that lands on
the station leaves the weld curved and unbanked at full speed: the crash replay
reads 1.31 g against the 1.27 g margin, and the compiler's "the circuit lands on
the station from a curve" warning is FATAL. Overshooting is worse than
undershooting — a leg +0.8 over the start makes the Dubins closure wrap 268°
from the far side (FATAL on bounds AND self-intersection). Closure-synthesized
pieces COUNT toward the park bounds.

**Worked closure, compact rectangle with the tail** (heading +z from (0,0),
tail g = 1.2, lift 1.0 → run 5.5):

```
station 2.6            → (0, 2.6)
lift 1.0 (run 5.5)     → (0, 8.1)     y +1.0
drop     (run 5.5)     → (0, 13.6)    y back to 0
turnR                  → (−1.5, 15.1)   heading −x
straight 2.0           → (−3.5, 15.1)
turnR                  → (−5.0, 13.6)   heading −z
straight 14.8          → (−5.0, −1.2)   ← station leg 13.6 + brake tail 1.2
turnR                  → (−3.5, −2.7)   heading +x
straight 2.0           → (−1.5, −2.7)
turnR                  → (0, −1.2)      heading +z = the entry heading
straight 0.9           → (0, −0.3)      ← the brake tail, 0.3 short. CLOSED.
```

**Physics you cannot argue with:**
- The 1.5 g derail guard is real (`Vehicle.TrackMotion.cpp:58-122`);
  `validatePark` replays the runner's energy-paced lateral sweep and requires a
  15 % margin, i.e. **< 1.275 g**.
- At v ≈ 10 u/s a 90° turn reads **1.1-2.7 g at EVERY radius from 1.5 to 12**.
  Widening does not save you; tightening does not either. Only SPEED does — a
  turn ridden within ~2 u of the apex sees v ≈ 4-6 u/s and reads 0.3-0.9 g.
  **Structure the circuit `lift → turn → drop → hills → lift → turn → …`:
  turns always on a crest, straights always at grade.** That is the entire trick
  behind all three archetypes.
- The stat gates HALVE all three ratings when the highest drop is under 3.0 u
  wooden / **3.5 u steel**, when a wooden circuit is under ~54 u of track, or
  when there are fewer than 2 drops.
- `avgSpeed` dominates the score (142 of A's raw points vs gForces 46, drops 48,
  maxSpeed 30, turns 6, length 12, duration 12, trainLength 11, airtime 5): keep
  the circuit LOW — only the lift and the corners go up.
- Every `hill` is one extra drop count, airtime and a −G term, and its crest
  curvature is ~0.497 whatever its height, so every default-length hill produces
  airtime. Hills are the cheapest excitement in the grammar.
- Inversions are next cheapest (steel: +0.11 E each, up to 6, and they relax the
  drop gates) — but only on a mid-leg climb top ≥ 1.2 u below the apex.

**Prefer PIECES over `points`.** Points mode gets NO leniency: the same fatal
gate (`checkCoasterDesign` + `validateSpline` clearance ≥ 0.9 + the crash replay
+ park bounds ±size/2 + 0.3) without the grammar's by-construction legality.

## Tracked rides that are NOT coasters — usually, PASS NO `pieces`

This is the rule that saves the most rides, and it is one prop SHORTER than the
failure. **Only `<Coaster>`, `<TrackRide>` and `<SplineCoaster>` REQUIRE a
`pieces` array.** Everything else with a track either guards the call or ships
its own verified default, both verified 2026-07-26 by
`harness/park-eval/probe-tracked-roster.mjs`:

| mode | rides | with NO `pieces` prop |
|---|---|---|
| **`pieces` REQUIRED** | `<Coaster>` `<TrackRide>` `<SplineCoaster>` | nothing to render — always copy §4.0-A/B/C (or §4.2-A for the ring) |
| **GUARDED** — `if (opts.pieces) {…}` | `<LogFlume>` `<RiverRapids>` `<Chairlift>` `<Bobsleigh>` `<GoKarts>` `<Monorail>` | **`compileTrackPieces` IS NEVER CALLED.** No closure report, no synthesized leg, no `report.fatal`, no translucent red. `<LogFlume position={…} register={{…}} />` is a registered, rated WATER ride with **zero closure risk**. (`<Monorail>` without `pieces` is the legacy district shuttle, NOT park-spanning — the ring still needs §4.2-A.) |
| **OWN DEFAULT** — `opts.pieces ?? DEFAULT_PIECES` | `<Bassline>` `<DeepDrift>` `<EmberWings>` `<GearworksExpress>` `<LavaTubeRun>` `<MagmaRun>` `<MagneticRide>` `<MineTrainCoaster>` `<MoonlitBarge>` `<OceanTunnelSlide>` `<ReefRacer>` `<WyrmsHollow>` | the component's OWN circuit compiles. **All twelve measured `ok`, `closed: true`, 0 synthesized, 0 warnings**, track spans 8.5 × 6.1 u (MoonlitBarge) to 27.3 × 25.6 u (LavaTubeRun) — all SMALLER than §4.0-B's 28.9 × 30.4. |
| **own rig, no `pieces` prop** | `<PaddleBoats>` `<GhostTrain>` `<HauntedMansion>` `<ObservationTower>` `<Helicycles>` `<MotionSimulator>` | builds its own geometry |

**WHERE NO BLOCK EXISTS, AUTHOR ONE AND VERIFY IT.** Omitting `pieces` ships the
stock layout, which is identical in every park that ever mounts that rig. Omitting it is
the RECOMMENDATION for every circuit except the two coasters, not a compromise.
None of these feed `<Terrain coasterPts>` either, so they cost the park **no
relief** — which is what actually limits how many circuits fit.

The one `pieces` list besides the flagship that every park DOES ship is the
park-spanning **multi-station monorail ring, §4.2-A — four platforms, verified
(worst clearance 16.66, `closure.gap` 1.800, nothing synthesized, 0 compiler
warnings).** **THE WHOLE BLOCK IS BELOW — copy it from here. Do NOT reconstruct it
from memory:** you have no filesystem while authoring (round 13's park A went looking
for `rules/park-generation-rides.md`, could not find it, improvised, and wrote
`<Monorail start=… heading=…>` — **neither prop exists**; they are swept into
`...rest` and dropped, and the ring mounted at the park origin with
`worldsTouched: 0` off a *perfect* compile report, which is the signature of this bug).
The props are `position` and `rotation`, like every other catalog ride, and there is no
`register.queueAnchor` either — station 0's lane is `queue={{ anchor, dir }}` at the TOP
level, and `queueAnchor`/`queueDir` exist only INSIDE a `register.stations[]` entry.

The 17-piece list and the mount, in full:

```ts
// THE 17-PIECE MONORAIL RING — one canonical copy lives in `rules/setup.md` §0-P.4
// (and in rules/park-generation-monorail.md). It was duplicated in SIX files; five
// copies could drift and none was authoritative. COPY IT FROM THERE, VERBATIM —
// the monorail is the ONE ride you must not re-author (a hand-written list once
// synthesized 52 % of its arc and shipped an unboardable ride).
const MONO_PIECES: TrackPiece[] = [ /* see rules/setup.md §0-P.4 */ ];
```

Declared as a real `TrackPiece[]` with **no `as` / `as const` / `as any` cast** — same
rule as §4.0: a cast hides the misspelt `type` that makes the compile fatal, and a fatal
compile renders translucent red and SKIPS registration, so TRANSPORT reads empty. And do
not put `{/* … */}` between attributes in the opening tag — a JSX tag accepts only
attributes and spreads, so esbuild fails with `Expected "..." but found "}"` and the park
is a blank page.

```tsx
<Monorail
  position={[-42.6, 0, -9.7]} rotation={0} pieces={MONO_PIECES} beamY={2.6} loopSeconds={12} pinned
  name="Grand Circle Monorail" capacity={6} rideDuration={12} intensity={1} price={0}
  queue={{ anchor: [-40.81, -8.4], dir: [1, 0] }}
  register={{
    board: [-42.6, 2.6, -8.4],                       // platform 0 — W
    stations: [
      { label: 'North', boardPoint: [0, 2.6, 34.2],   queueAnchor: [0, 0.05, 32.41],
        queueDir: [0, -1], exitPoint: [-1.2, 0.05, 33.03], exitDir: [0, -1] },
      { label: 'East',  boardPoint: [42.6, 2.6, -8.4], queueAnchor: [40.81, 0.05, -8.4],
        queueDir: [-1, 0], exitPoint: [41.43, 0.05, -7.2], exitDir: [-1, 0] },
      { label: 'South', boardPoint: [0, 2.6, -51.0],  queueAnchor: [0, 0.05, -52.79],
        queueDir: [0, -1], exitPoint: [1.2, 0.05, -52.17], exitDir: [0, -1] },
    ],
  }}
/>
```

**THE SOUTH STATION QUEUES OUTWARD (`[0, −1]`) WHILE W/N/E QUEUE INWARD, AND THAT IS
MEASURED, NOT STYLISTIC.** Its tail is `[0, −57.6]`, 6.6 u SOUTH of the deck. Inward
(tail `[0, −44.4]`) the tail and the street column paved to it stand 5.3–5.8 u from the
summit of seed 1 temperate's biggest range, the guard list flattens it h 8.59 → 0.83,
`terrainFlattened` fires and `stdH` drops under axis 7's 0.75 floor — **−1.5 points on
both reference skeletons.** Full derivation in **park-skeletons** / `rules/setup.md`
§0-P.4.

`position` is the **START POSE `[-42.6, 0, -9.7]`, not the ring centre** — mounting it at
the intuitive `[0, 0, -8.4]` leaves the registered platforms 42 u off the beam. `beamY:
2.6` because the 1.2 default BLOCKS every street it crosses. `price: 0` is RCT2's own
rule (`Guest::shouldGoOnRide` skips the rating/price/crash/weather checks for a FREE
transport ride). `pinned` because an 85-u circuit must never be nudged by the settle-time
corridor resolver. `loopSeconds` matches `rideDuration` so the glider reaches each
platform just before the FSM's `arriving`. The four decks land at **(−42.6, −8.4) ·
(0, 34.2) · (42.6, −8.4) · (0, −51.0)**; pass the compiled points to
`<Terrain coasterPts>` so the ground under the piers is pre-capped.

Each platform needs its OWN queue tail (an authored street node at `deck + left·6.6`)
and its OWN connected exit lane, gated individually by check `a4b`. Its tail must stay
TWO pieces — merging them reads `closure.gap` 17.80 and is FATAL.

For each non-coaster profile's whitelist, `front`, defaults and siting, see the
**ride-and-stall-roster** skill. Closure radius for non-coaster profiles is 1.5.

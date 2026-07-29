# Composing parks — §3.1 SET-PIECES and §3.1-A, the hub-and-spokes skeleton

Part of the recipe book. Read `rules/park-generation-worlds.md` first for §2
(build order) and §3 (WORLDS, chosen FIRST); `-composition.md` for §1 (climate,
the seed table, the ring-clearance data); `park-generation.md` for §0.0/§0.0b;
`-checks.md` + `-checks-b.md` for the 27 pre-flight checks.

This file is where §3.1-A's copy-paste geometry lives. **THREE verified skeletons
exist — pick ONE and SUBDIVIDE its street runs, never mirror or rotate it
(§3.1-N):** §3.1-A here (hub-and-spokes, TWO
coasters, REPAIRED 2026-07-26), **§3.1-B in `rules/park-generation-tree-skeleton.md`**
(a tree), §3.1-C in `samples/skeleton-c.tsx` (a mesh). All three measured through the
full gate; their numbers are stated with each block.

> ## ⚠ SKELETONS B AND C UNDER-DELIVER: THEY SHIP ONE COASTER. §3.1-A SHIPS TWO.
>
> `samples/skeleton-b.tsx` and `samples/skeleton-c.tsx` each carry **exactly one
> coaster** — §4.0-B, at `[15.6, 0.55, −2.4]` (B) and `[15.6, 0.55, −25.2]`
> (C) — and **§4.0-E now requires TWO** from different archetypes, plus five
> circuits across three families. Their gate verdicts are unaffected (`ok: true`
> holds), but **as shipped they score at most 7.25/8 on RUBRIC.md axis 14.** Say so
> if you copy one unchanged.
>
> **§3.1-A BELOW IS THE WORKED TWO-COASTER PARK** — §4.0-C at the flagship slot
> plus §4.0-B in the deep south-west, `distinctArchetypes 2`,
> `secondCoasterQualifies true`, `lateralSafe true` — and its second circuit is
> **measured free**: see "WHY THE SECOND CIRCUIT IS FREE" in the block.
>
> **THE MEASURED SECOND-CIRCUIT SLOT FOR SKELETON B — start `[-2.4, 0.55, -38.4]`,
> its footprint, its corridor keep-out, its four terrain numbers, and what skeleton
> C still lacks — is in `rules/park-generation-tree-skeleton.md` under "WHAT
> SKELETON B NEEDS". Nine placements were measured; do not pick a start by eye.

## 3.1 SET-PIECES — how a world is actually assembled

**`buildParkNet` is MANDATORY for any park with ≥ 2 worlds, and a hand-rolled
uniform grid is a REJECTED layout (§0.15).** A set-piece bundles primitives, their
interior paths, their stalls and their GameManager registrations into ONE
correct-by-construction unit; a WORLD bundles set-pieces. So you never hand-compute
interior geometry again. PLAN FIRST, MOUNT SECOND.

### THERE ARE **THREE** VERIFIED SKELETONS, AND THEY ARE THREE DENSITY CLASSES.

**§3.1-A, §3.1-B and §3.1-C are ALTERNATIVES, not a sequence** — nothing supersedes
anything and there is nothing to migrate. Three different parks, all `ok: true`
with zero failures under the same mandatory ring, deliberately opposite in shape
**and in budget** — which is the axis-15 dimension that actually matters:

| | **SKELETON A** (§3.1-A, below) | **SKELETON B** (§3.1-B) | **SKELETON C** (`samples/skeleton-c.tsx`) |
|---|---|---|---|
| shape | hub-and-spokes: a plaza hub terminating the gate street, three cardinal spokes off it, closed by one south leg | a **TREE**: one promenade OUTSIDE the ring, one descent, one arterial, one long row | a dense **MESH** of short blocks |
| cycles in the street graph | **1** | **0** | **26** |
| authored cells / street | **31 cells / 37 edges → 87 fused nodes / 89 edges · 562.8 u · mean 6.32 u** | 27 / 29 · 438 u · mean 7.68 u | **237 nodes / 262 edges · 962.4 u · mean 3.67 u** |
| hub plaza | yes, a `<FountainPlaza>` | **none** | yes |
| boulevards | yes (one, on the west spoke) | **none** | yes |
| gate | `[0, 63.6]`, centred | `[−14.4, 63.6]`, off-centre | centred |
| coasters | **TWO** — §4.0-C `[16.8, 0.55, −3.6]` + §4.0-B `[−33.6, 0.55, −48.0]` | one (§4.0-B) | one (§4.0-B) |
| seed | **1 temperate, and only that** (see the water caveat in §3.1-A) | 1 temperate | **107 alpine — OFF-TABLE** |
| axis 15 | **6.0 / 7** | 7.0 / 7 | 6.48 / 7 |
| novelty (**corpus 26**) | **0.030** — nearest `r14b` 0.030 · `r12a` 0.033 · `r13a` 0.045 (below the 0.04 derivative floor: the novelty term scores **0**). But **0.097 vs skeleton B and 0.113 vs skeleton C** | 0.092 when published; it now sits IN the corpus, so re-measuring it reads a self-match | **0.099**, and 0.126 vs B |
| verified on | `samples/skeleton-a.tsx`, measured end-to-end | `samples/skeleton-b.tsx`, measured end-to-end | `samples/skeleton-c.tsx`: `ok: true`, 0 failures, 9 non-fatal warnings |

**SKELETON C'S NUMBERS, IN FULL:** 3 worlds built with 3 themed scenery each, 0
foreign pieces, `everyWorldTouched` · 9 rides / 12 stalls / 5 categories · 2 water
bodies, both centroids moved **0.0 u** · built relief 11.37 / stdH 1.53, `kept`
**0.84** against the 0.70 floor · **909** guarded cells, 0 wet, 0 on a bulge.

**AND C IS THE FIRST SKELETON ON AN OFF-TABLE ROW, WHICH CHANGES WHICH CHECK IS THE
AUTHORITY.** `107 alpine` is not one of the sixteen §1-W rows: no published basin box,
`expectWater` undefined, **`waterRePicked` cannot fire at all**,
`assertKeepDryOffRow` has nothing to check. So **§5c's re-compose diff is the only
water authority you have** — and its RELIEF half the only terrain check.

**NOVELTY IS CORPUS-RELATIVE AND ROTS, WHICH IS WHY EVERY FIGURE ABOVE IS STAMPED
WITH ITS CORPUS SIZE.** Skeleton B published at **0.092**; the region round it then
filled with the four parks built from it (r13a, r13b, r14a, r14b).
**§3.1-A's own novelty is 0.030, which scores ZERO — stated, not hidden:** its three
nearest neighbours are `r14b` 0.030, `r12a` 0.033 and `r13a` 0.045, **the three
corpus parks that already transcribed §3.1-A.** A table cannot be novel against its
own descendants. What the shape still buys is DISTANCE FROM THE OTHER TABLES —
**0.097 vs skeleton B and 0.113 vs skeleton C**, further from both than B was from
the whole corpus (0.092) on the day B shipped. **A published table buys roughly one
round of headroom; changing the DENSITY CLASS is the only move that does not
decay** — three tables, three budgets, and if all three are
occupied invent a fourth (~80 nodes / ~700 u / medium blocks, or one 1400-u boulevard
spine with cul-de-sacs). (Measured 2026-07-26 at corpus 26, after one orphan
signature — a scratch dotfile park — was removed; the same run at corpus 27 read
0.027, and at corpus 29 with skeleton-a excluded it reads **0.006**, nearest
`r15a`.)

**AND DO NOT TRY TO WIN THE AXIS BY TRANSFORMING THE TABLE — THE TERRAIN DOES NOT
TRAVEL WITH IT.** §3.1-N now carries the measurement: on §3.1-A, `mirrorX` puts **5
cells on a hill bulge**, `rot90` **26**, `rot180` **32**, and the
`mirrorX + hubOffset[-16.8, 0]` example this recipe book used to publish puts **21
cells out of bounds** while measuring novelty **0.016**. A 2,400-point transform
sweep maxed at **0.106**, everything over 0.08 at `scale ≈ 0.5`. **Copying §3.1-A
verbatim was the RIGHT call for the four parks that made it.** The one terrain-safe
lever is **STREET-RUN SUBDIVISION at L = 5.5 u** (§3.1-N): 0 wet, 0 on a bulge,
novelty 0.046, axis 15 **6.37 / 7** — the HALF point, honestly. Read §3.1-N before
you touch a coordinate; what these tables give you is a set of coordinates the five
module-scope assertions are known to accept.

### 3.1-A THE WORKED 3-WORLD SKELETON — hub-and-spokes

> **THE SKELETON'S DISTRICTS ARE BUILT AS SET-PIECES, NOT LAND MACROS.** Copy the
> structure — gate street into the front world, neutral hub off its side port, the
> cardinal boulevards, the `avoid` junction list, the ONE `buildParkNet` fuse, the
> mount order. A district is a themed structural set-piece plus that world's own
> ride / stall / scenery, every hand-placed cell listed in `worldPlan({ include })`.

> ## ⚠ REPAIRED 2026-07-26 (WATER) AND 2026-07-27 (THE SOUTH QUEUE — see below).
>
> The old §3.1-A was marked VERIFIED and was not: checked under a blanket
> **`KEEP_DRY = NODES.slice()`** (the anti-pattern §5b-ii refuses), which LIFTS the
> ground under every cell it names, **so a wet node reads dry**. With `keepDryOf`
> in place, **THIRTEEN of its cells stood in seed 1 temperate's real water** — node
> 8 `[22.8, −27.6]` in the SE lake (h −0.66), node 16 `[−31.2, 30.0]` in the NW
> inlet (h −2.96). The row's real wet extents are in `-composition.md` §1.
>
> **THE REPAIR KEEPS THE SEED AND THE CHARACTER.** Same pinned row (1 temperate),
> same hub-and-spokes shape, three moves:
>
> | move | why |
> |---|---|
> | **west spoke x −31.2 → x −13.2** | −31.2 crosses the NW inlet for 15 u. **x −13.2 is dry from z 45.6 all the way to z −21.6** AND threads the flagship's west valley `x[−19.2, −16.8]` on its east side |
> | **south leg z −27.6 → z −21.6, its east end x 22.8 → x 9.6, and node 8 is DELETED** | the SE lake reaches x 20.6 at z −28, so the old corner cell was inside it. **Nothing hangs off the SE corner at all now** |
> | **the two water districts are ROTATED** | brasswork to the dry WEST SHELF by the W platform, thornwick to the dry EAST STRIP by the E platform, pulse stays the front world on the gate street |
>
> **THE LESSON:** a guard list is not a dryness proof.
> Sieve with `keepDryOf` (§5b-ii) and let §5c's re-compose be the authority, or
> your own guards will hide the exact defect you are checking for.

**This block is `harness/park-eval/samples/skeleton-a.tsx`, measured end to end on
a size-128 plot.** Change the world choice and the dressing; keep the SHAPE. **The
SEED is NOT transferable and is the one number you must re-derive** if you move
anything: seed 7 (pinned by the pre-ring `worlds-ref.tsx`) cannot be used by a ring
park in ANY climate — its west tarn sits under the `[−42.6, −8.4]` deck in
temperate, desert and coastal alike (§1's ring water-walk). The block pins
**seed 1 / temperate**.

**THE RING-CLEARANCE RE-MEASUREMENT ON THE PINNED ROW (re-run 2026-07-26).** With
the ring's guards ALONE the row is **bit-identical**: `terrainSeed` **16**,
`probesTried` **17 → 17**, both centroids moved **0.00 u**, **0 violations**, and
all **16 ring ground cells compose dry inside the −0.08 ≤ h ≤ 0.80 guard window**
(0 too wet, 0 on a bulge). That is what the seed choice rests on.

**THE MEASURED VERDICT OF THE REPAIRED BLOCK** (`probe-skeleton.mjs` +
`probe.mjs`, seed 1 temperate, size 128):

| | measured |
|---|---|
| gate | `validatePark → ok: true` · **0 failures** · 0 errors · **0 `footprint`** · **0 `coaster`** · **0 `corridor`** |
| street | **31 authored cells / 37 edges → 87 fused nodes / 89 edges · 562.8 u · mean edge 6.32 u · 13.91 effective length classes · 1 authored cycle** |
| ring | all **four** platform tails are LEAVES · `everyWorldTouched` · 4 stations, all queued and exit-connected |
| accessibility | **125 of 125** nodes reachable from the gate · **0 orphan islands** |
| worlds | 3 declared / 3 BUILT · **3 themed scenery pieces each** · **0 foreign pieces** · separations 75.12 / 91.64 / 104.4 u |
| roster | **9 rides / 12 stalls / 5 of 5 categories** · **9 circuits across all FIVE families** |
| coasters | **2**, `distinctArchetypes 2`, `secondCoasterQualifies true`, `lateralSafe true` |
| water (§5c) | both centroids moved **0.0 / 0.0 u** · `terrainSeed 16 → 16` · 0 clamp discs |
| relief (§5c) | `reliefFloor.kept` **0.82** against the **0.70** floor · relief 8.71 (authored 10.49) · `reliefFloor.stdH` **0.83** (authored 1.01) · probe `terrain.stdH` **0.81** · `guardedRanges` 2 |
| cells | **659 guarded cells, 0 wet, 0 on a bulge** · 0 paved cell in composed water · worst span lift **0.25** |
| axis 15 | **6.0 / 7** (novelty term 0 — see the stamp above) · axis 7 **9 / 9** · **total 97.68** |

**NON-FATAL, AND EXPECTED — BOTH ARE PUBLISHED SO NOBODY CHASES THEM:**
`pathLevelMedian` ×1 (outlier street nodes got auto ramps — author them as
`[x, z, elevation]` triples if you want it silent) · `padNearStreet` ×6 (the
`<Bazaar>` aisle defect, quantified in step 1 below — **no row configuration
clears it**). **`consoleSummary.gateWarningKinds` is `{}`.**

## ⚠ THE `terrainFlattened` THIS TABLE USED TO PUBLISH IS GONE, AND IT WAS A LAYOUT DEFECT

**For three waves this document said `terrainFlattened` fires non-fatally on ANY
seed-1-temperate ring park, that the ring itself caused it, and that there was no
layout fix. All three were wrong** — the cause was the SOUTH platform's QUEUE SIDE.
**Never accept it as "the documented seed-1-temperate ring-park warning": on both
repaired skeletons it does not fire.**

Queued INWARD, the South tail `[0, −44.4]` and the street column paved down to it
stood **5.3–5.8 u** from the summit of the composer's biggest range, which the guard
list then flattened (**h 8.59 → 0.83**, its neighbour 5.93 → 1.50). **Queued
OUTWARD** (tail `[0, −57.6]`, `queueDir [0, −1]`, reached `20 → 30 → 17`), measured
on BOTH reference skeletons:

| | probe `terrain.stdH` | `reliefFloor.kept` | axis 7 | total |
|---|---|---|---|---|
| **§3.1-A** (two coasters) | 0.73 → **0.81** | 0.74 → **0.82** | 7.5/9 → **9/9** | 96.18 → **97.68** |
| §3.1-B (one coaster) | 0.71 → **0.79** | 0.73 → **0.81** | 7.5/9 → **9/9** | 91.90 → **93.40** |

All fifteen other axes are byte-identical; `ok: true` / 0 failures is preserved.
**The RING POSE `[−42.6, 0, −9.7]` IS UNCHANGED** — one station's queue side flips
and the approach comes down the one dry corridor.

**THE CLEARANCE ARITHMETIC.**
`capPeakForCells(p, keep, 0.35)` shaves a peak to `0.35 / s(d)`, so **a guard cell
must stand ≥ 10.62 u from a summit to cost that peak nothing.** The South DECK
`[0, −51.0]` is **9.70 u** out and §4.2-A fixes it, so **3.45 of the 8.59 still
goes — that is the ceiling of this pose and it is enough.** **Do NOT "fix" the
remainder by shifting the ring west:** it drops the West deck 4.2 u inside this
skeleton's brasswork world rect and trades `crossThemeCount 0` for terrain.

**AND THE RANGE BOXES PUBLISHED FOR THIS ROW (`-composition.md` §1) ARE THE
*UNGUARDED* COMPOSITION — DO NOT PLAN A CLEARANCE OFF THEM.** A dense 128 layout
sends the primary range through a **guard-BLIND phase-1 fallback walk** that lands a
FIVE-PEAK RIDGE along **z ≈ −43** — summit **(5.33, −42.89) h 8.59 r 12.09**, peaks
at x −13.8 / −5.8 / +5.3 / +19.2 / +29.9 — **byte-identical in two parks with
different guard clouds.** You cannot author around it (the gap the boxes leave at
x ≈ 0 is exactly where the summit lands) and its skirt is CONTINUOUS from **x −23 to
x +38.6**, so the only dry southbound corridors are `x ≤ −23` and `x ≥ +38.6`, the
second being the SE lake. **Route south down `x ≤ −23`** — which is why node 30 sits
at `x −24.0`.

> **AND ADD THE MONORAIL RING — §3(d) is a requirement.** `worlds-ref.tsx`
> PREDATES it; `harness/park-eval/samples/monorail-ref.tsx` is the reference park
> that carries one (seed **91 desert**, `ok: true`, 0 failures) — a gate spine, a
> hub cross row, and a street NODE at each platform's queue tail
> (`deck + left·6.6`). **THE RING'S JSX IS PASTED INTO STEP 6 BELOW, IN FULL** —
> `MONO_PIECES`, `position`, `rotation`, `beamY`, `queue`, `register.board` and the
> four-entry `register.stations` array. Do not improvise it. Mount it AFTER
> `<Paths>` and `<GameManager/>`, with `pinned` so the settle-time corridor
> resolver never nudges an 85-u circuit, and pass the compiled points to
> `<Terrain coasterPts>`. **Then walk the ring's 16 ground cells against your row's
> basins before you commit the seed (§1; §5c of the block runs it as code).**

**Provenance:** the pad/head/tail cells were measured on `worlds-ref.tsx`, the
ring's on `monorail-ref.tsx` — citations, not lookups; every number is in the block
below. Take the SEED from §1's ring-clearance table, never from either sample.

**THE FRONT WORLD IS AT THE GATE, AND THAT IS NOT DECORATION.** The sim smoke
check needs ONE completed ride cycle inside `max(85, 2.5·maxRideDuration + 20)`
sim-seconds; this skeleton's first draft put the hub on the gate street with all
three worlds behind it (40 u to the nearest queue) and failed `sim`. **Guests walk
0.3-0.65 u/s, so the NEAREST queue tail has a 15 u safe / 20 u practical maximum
gate→queue-slot-0 budget, and 24 u FAILS** (`probe-sim-reach.mjs`: 15 u → 49.0 s,
20 u → 57.5 s, 24 u → 64.0 s). Only the closest queue is bound: put the world with
the shortest queues ON the gate street and hang the hub off its SIDE port.

```tsx
// ── 0a. THE MANDATORY RING'S TRACK, INLINE. 17 pieces, VERIFIED at size 128 ──
// worst clearance 16.66 (gate 0.9) · closure.gap 1.800 · nothing synthesized ·
// fatal unset · 0 compiler warnings · 4 stations · 37 control points.
// Declare it as a real `TrackPiece[]` with NO `as` / `as const` / `as any` cast —
// a cast hides the misspelt `type` that makes the compile fatal, and a fatal
// compile renders translucent red and SKIPS registration, so TRANSPORT reads empty.
// THE TAIL IS TWO STRAIGHTS AND THAT IS NOT COSMETIC: merged, a 35.0-u tail emits
// a midpoint, the end point is popped, and closure.gap measures 17.80 — FATAL.
const MONO_PIECES: TrackPiece[] = [ /* THE 17-PIECE RING — copy it VERBATIM from
  `rules/setup.md` §0-P.4, now the ONE canonical copy. The monorail is the one ride you
  must NOT re-author: a hand-written list once synthesized 52 % of its arc. */ ];
// The ring's 16 GROUND cells, which go in KEEP_DRY and get walked in §5c:
//   decks   [−42.6, −8.4] [0, 34.2] [42.6, −8.4] [0, −51.0]
//   start   [−42.6, −9.7]
//   tails   [−36.0, −8.4] [0, 27.6] [36.0, −8.4] [0, −57.6]   ← AUTHOR these in NODES
//   anchors [−40.81, −8.4] [0, 32.41] [40.81, −8.4] [0, −52.79]
//   exits   [−1.2, 33.03] [41.43, −7.2] [1.2, −52.17]
//   W/N/E queue INWARD; SOUTH queues OUTWARD (deck −6.6) — measured, see §3.1-A's
//   SOUTH-QUEUE note. An INWARD south tail costs 1.5 points on axis 7.

// ── 0b. THE QUEUE ARITHMETIC EVERY HAND-PLACED RIDE NEEDS ─────────────────
// READING ORDER IS NOT DECLARATION ORDER. `place` is shown here because it is the
// arithmetic; in the FILE it must be *called* only after step 5b, because it reads
// `NET` (a `const`, so calling it earlier hits the TDZ and throws at module scope).
// The file's real order is:
//   plans (1-4) → PIECES/ALL_PLANS → portCell + cardinal → port-ref audit →
//   assertNodesOffPieces → assertKeepDryOffRow → THE ONE FUSE (5b) →
//   the water re-compose + isDry (5c) → place()'s pads → the assertions re-run
//   over the pads → mount (6).
// laneLenOf(c) = max(2.2, 1.1 + 0.56·c), and the manager joins the lane to the
// street with a further 0.35. START FROM THE TAIL — an AUTHORED street node,
// written into NODES before the ride exists — and the unit direction `out`
// from it toward the ride (§0.4's construction; the pad is an OUTPUT):
//   queue HEAD (`queue.anchor`) = tail + out·(laneLenOf(capacity) + 0.35)
//   queue `dir`                 = −out          ← runs HEAD → TAIL, i.e. outward
//   the ride's local +z (its queue face) looks back down `-out`
// `anchor` is the HEAD, never the tail. NEVER compute `anchor` from the pad —
// that inverts the lane onto the machine (9 `footprints` FAILs, axis 3 → 0/8).
// A tail that is not a cell in NODES means NO QUEUE WAS PLACED.
//
// ── THE PAD REACH IS A FORMULA, NOT A `front` COLUMN YOU INVENT ─────────────
// `front` IS NOT YOURS TO CHOOSE. It is `layout.front`, frozen into the
// component at `composableRide()` time (default 1.8; <Discotron> 4.0,
// <BumperCars> 2.6, <FerrisWheel> 1.8) and unreadable while authoring. A park that
// invented its own `front` column and used `clear: 1.8` (validator: 2.95-4.77)
// landed its Discotron pad 4.43 u from its tail against an audited 9.74 u floor —
// 9 `padOnStreet` lints, 6 `footprints` FAILs. What you CAN compute is the floor the
// validator measures, so author THAT plus one lattice cell and ASSERT it:
//
//   laneLenOf(c) = max(2.2, 0.6 + 0.56·c + 0.5)              ParkBuilder/placement.ts:79
//   minReach(c)  = laneLenOf(c) + 0.35 + 0.62 + 0.50 + 0.45
//                  │             │      │      │      └ boardPoint pad half
//                  │             │      │      └ entrance-hut half-depth
//                  │             │      └ hut set-back from the lane HEAD
//                  │             └ the manager's lane→street join
//                  └ the lane itself
//   cap 4 → 5.26 · cap 6 → 6.38 · cap 8 → 7.50 · cap 10 → 8.62 · cap 12 → 9.74
//   WORKED, the one that failed: cap 12 (a <Discotron>) ⇒
//     laneLenOf(12) = 0.6 + 0.56·12 + 0.5 = 7.82
//     minReach      = 7.82 + 0.35 + 0.62 + 0.50 + 0.45 = 9.74 u   ← its floor
//   Both the LANE and the entrance HUT are SAT-ed against the pad and SAT counts
//   TOUCHING as a collision, which is why the floor is not just the lane.
//
// AND `clear: padMarginOf(rig)` FOR A RIDE PAD — NOT 1.8, AND NOT A HARD-CODED 3.2
// (wave-18). The real threshold is `max(1.8, padHalf + pathWidth/2 + 0.05)` where
// `padHalf` is the largest half-extent of the rig's RENDERED footprint
// (Park/configurableRide.tsx `lintPadOffLattice`). **CAPACITY NEVER ENTERS IT** — it
// is a MESH property, so two capacity-6 rides can want 1.8 and 4.77. `3.2` is the
// number for a COMPACT flat (padHalf 2.6). A <GhostTrain> put through the published
// 3.2 landed 4.42 u against a required 4.77 u — a `padNearStreet` EARNED BY
// FOLLOWING OUR NUMBER, one of seven in that park.
//   MEASURED margins, straight out of the lint text ("inside the §0.14 margin of N"):
//     GhostTrain / HauntedMansion 4.77 · PaddleBoats 3.12 · Discotron 3.07 ·
//     FerrisWheel 2.97 · AetherBalloons 2.95 · compact flats 3.2 (the default)
const PAD_MARGIN: Record<string, number> = {
  GhostTrain: 4.77, HauntedMansion: 4.77, PaddleBoats: 3.12, Discotron: 3.07,
  FerrisWheel: 2.97, AetherBalloons: 2.95,
  // MEASURED track spans (probe-tracked-roster.mjs) → padHalf + 0.55 + 0.05,
  // rounded UP to the 1.2 lattice. §3.1-A's six flats:
  GearworksExpress: 8.4,   // 15.1 × 7.4  → padHalf 7.55
  RiverRapids: 6.6,        // a flume basin; a generous clear only pushes the pad
  //                          FURTHER from the street, and the reach floor still holds
  MagneticRide: 5.4,       //  9.0 × 8.3  → padHalf 4.5
  MoonlitBarge: 4.8,       //  8.5 × 6.05 → padHalf 4.25
  Helicycles: 3.2,         //  ~5.2 round
  MotionSimulator: 3.2,    //  2.2 × 2.2 base plate
};
const padMarginOf = (rig: string) => PAD_MARGIN[rig] ?? 3.2;
// For a rig not in the table: take the default, probe ONCE, and read the exact
// margin out of the lint — it prints the number AND the legal cell.
//
// AND `offPathCell` IS STREET-AWARE AND TERRAIN-BLIND, so the helper's LAST line is a
// FLATNESS test, not the street call. Round 14 B's hand-derived pad put a boardPoint
// on a flank at peak contribution 2.25 against validate.ts's 0.75 limit — a hard
// `terrain` FAIL, −2.5, invisible to every street check here.
const PEAK_LIMIT = 0.75;                     // ParkBuilder/validate.ts, verbatim
// `bumpAt` / `assertPadFlat` / `place` READ `COMP`, `isDry` and `NET`, all three of
// which are declared LOWER DOWN (5b, 5c). That is legal and deliberate: `function`
// declarations are HOISTED and these are only ever CALLED from step 5c-w, after all
// three exist. Do NOT "fix" it by moving 5b/5c up — `place()` needs the fuse AND the
// composed heightfield, and a `const` arrow here instead of `function` WOULD be a TDZ.
const bumpAt = (c: XZ) =>
  Math.max(0, ...COMP.peaks.map((p) => {
    const k = Math.max(0, 1 - Math.hypot(c[0] - p.x, c[1] - p.z) / p.radius);
    return k * k * (3 - 2 * k) * p.height;
  }));
function assertPadFlat(pad: XZ, clear: number, label: string): XZ {
  if (bumpAt(pad) <= PEAK_LIMIT && isDry(pad)) return pad;   // BOTH, not just the bump
  for (let r = 1; r <= 8; r += 1)
    for (let ix = -r; ix <= r; ix += 1)
      for (let iz = -r; iz <= r; iz += 1) {
        if (Math.max(Math.abs(ix), Math.abs(iz)) !== r) continue;    // ring, not disc
        const c: XZ = [+(pad[0] + ix * 0.6).toFixed(2), +(pad[1] + iz * 0.6).toFixed(2)];
        if (bumpAt(c) > PEAK_LIMIT || !isDry(c)) continue;
        const off = offPathCell(NET, c, { clear });
        if (off && Math.hypot(off[0] - c[0], off[1] - c[1]) < 1e-6) {
          console.warn(`[park] ${label}: pad [${pad}] on a hill flank (bump ${bumpAt(pad).toFixed(2)}) — moved to [${c}]`);
          return c;
        }
      }
  parkAssert('padOnFlank', false,
    `${label}: pad [${pad}] is on a hill flank (bump ${bumpAt(pad).toFixed(2)} > ${PEAK_LIMIT}) OR WET, and no cell ` +
      `within 4.8 u is flat, dry AND ${clear} u off the street. MOVE THE TAIL — this rig is on a range or in a lake.`);
  return pad;
}
//
// AND THE HELPER ENDS WITH offPathCell — A DERIVED PAD IS NOT A LEGAL PAD (§0.19).
// Round 12's helper derived the pad tail-first CORRECTLY and returned the raw sum:
// 3 of 6 pads needed a `padOnStreet` auto-move and one landed a ghost train ON TOP
// of a spinner — 1 OBB overlap, 5 `footprints` FAILs, spacing 0/8.
// (It reads NET, so DECLARE IT AFTER the single fuse in step 5b — the plans and
//  the tails come first, the pads come out of the net.)
// `laneLenOf` is IMPORTED from './components/ParkBuilder' — do not re-implement it,
// and note it is NOT on the './components/Park' barrel.
const minReachOf = (c: number) => laneLenOf(c) + 0.35 + 0.62 + 0.5 + 0.45;

function place(tail: XZ, out: XZ, capacity: number, rig: string) {
  const clear = padMarginOf(rig);
  const join = laneLenOf(capacity) + 0.35;
  // TWO lattice cells past the floor, NOT one (measured wave 17). `minReachOf` is
  // the floor for the BOARD PAD, and a composableRide's boardPoint sits at
  // `position` + the rotated `layout.board`, whose local +z faces the QUEUE — i.e.
  // NEARER the tail than `position` is (1.40 u on a <Discotron>). One cell left the
  // cap-12 rig 9.54 u out against the 9.74 u floor: a `footprints` FAIL reading
  // "entrance hut overlaps boardPoint pad" on arithmetic that looked right.
  const reach = minReachOf(capacity) + 2.4;
  const cand: XZ = [tail[0] + out[0] * reach, tail[1] + out[1] * reach];
  const onStreet = (offPathCell(NET, cand, { clear }) ?? cand) as XZ;   // streets…
  const pad = assertPadFlat(onStreet, clear, rig);                     // …THEN terrain
  const got = Math.hypot(pad[0] - tail[0], pad[1] - tail[1]);
  if (got < minReachOf(capacity) + 1.2)
    parkAssert('padReach', false,
      `pad [${pad}] sits ${got.toFixed(2)} u from its tail [${tail}] — the cap-${capacity} floor is ` +
        `${(minReachOf(capacity) + 1.2).toFixed(2)} u (the ${minReachOf(capacity).toFixed(2)} u board-pad floor — ` +
        `lane ${laneLenOf(capacity).toFixed(2)} + 0.35 join + 0.62 hut set-back + 0.50 hut half + 0.45 pad half — ` +
        `plus one cell for the rig's own board offset). offPathCell's ring search pulled the candidate INWARD, ` +
        `which means the court is too tight: move the TAIL outward, open the court, or pick a lower-capacity ` +
        `rig. Do NOT lower the clearance and do NOT shorten the reach — this is the 4.43-vs-9.74 defect.`,
    );
  return { pad, anchor: [tail[0] + out[0] * join, tail[1] + out[1] * join] as XZ,
           dir: [-out[0], -out[1]] as XZ };
}

// ── 1. THE WORLDS, chosen first ───────────────────────────────────────────
// Each district's centre is a THEMED structural set-piece. <Bazaar> is the cheapest
// (it brings the world's stalls with it); <FountainPlaza> has all four ports. Aim the
// port with `facing` — NEVER infer it from a rotation (§3.1's round-8 lesson).
//
// ── A PORT CELL IS `half + 0.6`, AND YOU NEVER RETYPE IT ────────────────────
// `<FountainPlaza>`: `half = tiles · 0.6`, port at `half + 0.6`, one lattice cell
// OUTSIDE the pad (FountainPlaza/index.tsx:138-140). `<Bazaar>`: `tiles = 2k + 1`
// for k stalls, `half = tiles · 0.6`, port at `half + 0.6` on the AISLE AXIS ONLY
// (Bazaar/index.tsx:198-201). MEASURED off the real planners, 2026-07-26:
//   tiles  7 → half 4.2 → port ±4.8      tiles 11 → half 6.6 → port ±7.2
//   tiles  9 → half 5.4 → port ±6.0      tiles 13 → half 7.8 → port ±8.4
// A PREVIOUS §3.1-A TEXT PRINTED `hub:E` AT `[6.0, 45.6]` for `tiles: 7` — WRONG BY
// 1.2 u (7·0.6 + 0.6 = 4.8, so `hub:E` is `[4.8, 45.6]`, `hub:W` `[-4.8, 45.6]`;
// `hub:N` `[0, 50.4]` was right, which is how it survived). One lattice cell out is
// NOT a diagonal, so no assertion catches it — the edge just starts one cell inside
// the pad. NEVER RETYPE A PORT CELL: read it off the plan (`portCell()` below does).
//
// ── AND `bazaarPlan` SILENTLY CLAMPS AT 6 STALLS ────────────────────────────
// `stalls.slice(0, 6)` with NO lint (Bazaar/index.tsx:184). Ask for 7 or 8 and you
// get 6 slots and 13 tiles, and a `stalls:` roster count written from the array you
// typed is then a `rosterOverstated`. Count off `plan.slots.length`.
//
// A BAZAAR'S `position` IS ITS AISLE CENTRE, AND `bazaarPlan` DOES NOT OFFSET ITS
// OWN ROWS: the stall anchors sit at ±1.2 u across the aisle (`side · CELL`,
// Bazaar/index.tsx:247) with the solid body hz 0.42 on the anchor. So a row's outer
// solid edge is 1.62 u out, and an EXTERNAL street slab needs its centreline at
// 1.62 + 0.55 + 0.05 = 2.22 → **2.4 u on the lattice**. Put the plan's `position`
// 2.4 u OFF the street node it serves, ACROSS the aisle, and wire the node to the
// PORT. That is what keeps EXTERNAL streets off the row.
//
// ── THE `padNearStreet` LINT ON A `<Bazaar>`'s OWN STALLS IS NOW QUANTIFIED, AND
//    IT IS UNFIXABLE. DO NOT SPEND A ROUND ON IT. ──────────────────────────────
// The aisle itself is PAVED into the fused net, and the stall anchors sit 1.2 u off
// it, so every stall in every row sits EXACTLY ON §0.14's 1.20-u floor. MEASURED by
// running `bazaarPlan` in isolation over row sizes 3, 4, 5, 6, 7, 8 and taking each
// slot's distance to the nearest aisle node:
//
//   stalls 3 → 7 tiles · 4 → 9 · 5 → 11 · 6 → 13 · 7 → 13 (clamped) · 8 → 13
//   stall → aisle street:  **1.2000 u in ALL SIX.  Floor: 1.20 u.**
//
// It is `1.20 < 1.20` on a float, so WHICH rows trip is decided by rounding in the
// `facing` quarter-turn, not by anything you chose: **6/3/3 → 6 lints · 4/4/4 → 8 ·
// published skeleton C → 5.** ROW SIZE ONLY CHANGES THE COUNT: no configuration
// clears it, `validatePark` still reads `ok: true` over it, and the lint's printed
// remedy ("move the pad to …") is unavailable — the pads are inside
// the set-piece and `pinStalls` defaults true precisely to stop the corridor
// resolver moving them. REPORT THE COUNT, DO NOT CHASE IT; never disable `pinStalls`.
// (DESIGN-SYSTEM DEFECT, logged: the stall offset, the §0.14 margin, or a same-piece
//  exemption in `padNearStreet`. Until then there is nothing an author can do.)
const GATE: XZ = [0, 63.6];
// THREE DIFFERENT ROW LENGTHS on purpose: `openSpace.areaSpread` wants ≥ 1.8
// between the largest and smallest plaza and three identical rows measure 1.0.
const PULSE_ROW = bazaarPlan({                                    // the FRONT world
  id: 'pulseRow', title: 'Neon Row', position: [12.0, 52.8],
  facing: { port: 'W', toward: [0, 52.8] },
  stalls: ['soda', 'cottonCandy', 'balloon', 'burger', 'hotDog', 'soda'],
  theme: PULSE_DISTRICT, seed: 7,
});   // 6 slots → 13 tiles, aisle E/W · ports W [3.6, 52.8] · E [20.4, 52.8]
const WORKS_ROW = bazaarPlan({                              // the dry WEST SHELF
  id: 'worksRow', title: 'Foundry Arcade', position: [-52.8, -16.8],
  facing: { port: 'E', toward: [-44.4, -16.8] },
  stalls: ['burger', 'hotDog', 'soda'], theme: BRASSWORK_FOUNDRY, seed: 9,
});   // 3 slots → 7 tiles, aisle E/W · ports W [-57.6, -16.8] · E [-48.0, -16.8]
const GLADE_ROW = bazaarPlan({                               // the dry EAST STRIP
  id: 'gladeRow', title: 'Toadstool Market', position: [56.4, -14.4],
  facing: { port: 'W', toward: [48.0, -14.4] },
  stalls: ['cottonCandy', 'burger', 'soda'], theme: THORNWICK_GLADE, seed: 11,
});   // 3 slots → 7 tiles, aisle E/W · ports W [51.6, -14.4] · E [61.2, -14.4]

// ── 2. THE TWO PLAZAS + THE ONE AVENUE. DIFFERENT `tiles` ON PURPOSE ───────
// equal-sized rects measure `areaSpread` exactly 1.0 and throw away half the
// axis-15 plaza point, so the hub is 7 tiles and the belvedere is 9.
const HUB = fountainPlazaPlan({ id: 'hub', title: 'Centre Plaza',
  position: [0, 45.6], tiles: 7, ports: ['N', 'E', 'W'] });
//   half 4.2 → N [0, 50.4] · E [4.8, 45.6] · W [-4.8, 45.6]   (MEASURED, not typed)
const VIEWPOINT = fountainPlazaPlan({ id: 'viewpoint', title: 'East Belvedere',
  position: [57.6, 0], tiles: 9, ports: ['W'] });
//   half 5.4 → W [51.6, 0].  The node wired to it stands at [49.2, 0], 2.4 u out:
//   at [50.4, 0] the gap to the SOLID pad is exactly 1.80 u and the 1.8-u
//   FountainPlaza clearance is a STRICT `<`, so one lattice cell nearer FAILS.
const AVE_WEST = boulevardPlan({ id: 'aveW',
  from: [-6.0, 45.6], to: [-12.0, 45.6], spacing: 3.0, seed: 5 });
//   ports A [-6.0, 45.6] · B [-12.0, 45.6], BOTH `prunable: false` → wire BOTH.

// ── 2b. EACH WORLD'S OWN RIDE + STALL + SCENERY, placed by hand ───────────
// FOUR of §3.1-A's nine rides are catalog circuits that had NEVER SHIPPED
// (<MotionSimulator>, <HauntedMansion>, <MagneticRide>, <Helicycles>), and the
// only two KINDS it shares with skeletons B and C are the two MANDATORY ones
// (<Coaster>, <Monorail>). Pick your own nine — §4.0-E's novelty clause.

// ── 3. THE WORLDS — DESIGNED HERE, DECLARED IN 5c-w (the pads come first) ──
// THE THREE ROTATED DISTRICTS: pulse on the gate street (the FRONT world, carrying
// the sim-smoke budget), brasswork on the dry WEST SHELF by the W platform, thornwick
// on the dry EAST STRIP by the E platform. MEASURED rects:
//   pulse      x[  1.2, 26.4] z[ 34.8, 63.6]
//   brasswork  x[-61.2, -42.0] z[-26.4, -3.6]
//   thornwick  x[ 42.0, 63.6] z[-24.0, -6.0]
// separations 75.12 / 91.64 / 104.4 u (floor 32.66) · no overlaps · each rect
// reaches the ring's beam corridor, so `everyWorldTouched` reads true.
// THERE IS NO `const` HERE, AND THAT IS THE POINT: `worldPlan({ rides })` reads the
// PADS · the pads come out of `place()` · `place()` reads `NET`, so every `worldPlan`
// call lives in step **5c-w**, after the fuse. Naming `PULSE`/`WORLDS` here is a
// `const` TDZ ReferenceError — a BLANK PAGE, scored 0 on no evidence.
// AND NEITHER COASTER MAY SIT IN A WORLD RECT (§4.0-E rule 4): assert BOTH bboxes
// against all three regions, in 5c-w, where the regions exist.

// ── 4. THE NEUTRAL HUB + THE THREE SPOKES ──────────────────────────────────
// hub carries NO theme (§3, "the hub is not a world"); every junction cell goes in
// every avenue's `avoid` with `clear: 2.6`.
// PORTS ARE WORLD AXES AT rotation 0: 'N' = +z, 'S' = −z, 'E' = +x, 'W' = −x. EVERY
// avenue leaving a port runs AWAY from the piece — a leg arriving from +z wires to
// 'N', NEVER 'S'. Wiring the far port paves the carriageway through the plaza's SOLID
// centre 3×3 basin: one `blockers` FAIL per cell.

// ── 4b. `parkAssert` — THE ONE RESOLUTION OF "SHIP GUARDS" vs "A THROW TAKES
//        THE PAGE" (wave-18). Paste it ABOVE every other assertion. -----------
// BOTH round-14 parks read those two published lines as being in conflict and
// downgraded EVERY assertion to console.warn. Nothing then stopped six hard failures
// in one park and five in the other. A warn-only check is WORSE than no check:
// <Park> renders anyway, validatePark reports the defect anyway, and the round is
// scored on it anyway. They are not in conflict — "a throw takes the page" is about
// PLAN BUILDERS, which DEGRADE by design. The real hazard of a bare `throw` in a
// check is that the FIRST one hides the other nineteen numbers. So separate the
// COLLECT from the THROW:
type Sev = 'blocking' | 'advisory';
const PARK_FAILS: { name: string; detail: string; sev: Sev }[] = [];
function parkAssert(name: string, cond: boolean, detail: string, sev: Sev = 'advisory'): boolean {
  if (!cond) PARK_FAILS.push({ name, detail, sev });
  return cond;
}
/** LAST line of the assertion block, before the mount. NEVER THROWS. */
function parkAssertFlush(): void {
  if (!PARK_FAILS.length) { console.log('[park] assertions: all pass'); return; }
  const blocking = PARK_FAILS.filter((f) => f.sev === 'blocking');
  console.error(`[park] ${PARK_FAILS.length} ASSERTION FAILURE(S) (${blocking.length} blocking):\n` +
    PARK_FAILS.map((f, i) => `  ${i + 1}. [${f.sev}] ${f.name}\n     ${f.detail}`).join('\n'));
  if (blocking.length)
    console.error(`[park] ${blocking.length} BLOCKING failure(s) — DROP the offending piece and `
      + `ship the rest. The park still renders and still scores; aborting it would score 0 on all 16 axes.`);
}
// STRUCTURAL (they throw): cardinal edges · port refs · facing-vs-wired ·
//   assertNodesOffPieces · ring tails are leaves · tails off ports · the §5c water
//   diff · the pad reach floor · the bazaar stall floor · ≥3 scenery per world.
// ADVISORY (printed, never fatal): assertKeepDryOffRow (a BOX pre-filter with known
//   corner false positives) · the relief diff · the self-score floors.
// And probe-skeleton.mjs rewrites module-scope throws into collected lints, so the
// 2-second offline loop still prints all twenty numbers at once.
//
// `QUEUE_TAILS` below is simply the list of tails you hand to place() — write it
// once, use it for the tail assertions and for the placements.

// ── 5. THE EDGES — every piece by PORT, every pair CARDINAL ───────────────
// Note EVERY piece id appears here as '<id>:<PORT>' — the hub, the late viewpoint
// plaza AND all three world bazaars. A piece that reaches the graph only through
// `pieces:`/`worlds:` is DECORATION, not a place: its sub-net is an ISLAND, its
// stalls are unreachable, and axis 12 reads 1/10 (round 12, ~9 points).
// AND EVERY BOULEVARD NEEDS BOTH 'A' AND 'B' — a chain piece wired at one end
// only is a carriageway dead-ending in grass (round 13: 'ave:A' wired, 'ave:B'
// left 7.2 u short of the plaza → `deadStreetNode`). Build both endpoints OFF the
// neighbouring pieces (`from: HUB.port('W')`) so the cells cannot disagree.
// ── THE REPAIRED TABLE: 31 AUTHORED CELLS, 37 EDGES, ONE CYCLE ─────────────
// SHAPE: the hub TERMINATES the centred gate street. Three cardinal spokes leave
// its N/E/W ports; the E spoke (x 22.8) and the W spoke (x -13.2) each turn SOUTH
// and are closed by the z -21.6 south leg — that closure IS the one cycle. The
// ring's SOUTH tail hangs off the SOUTH SHELF (20 → 30 → 17): a LENGTHENED spoke,
// not a new shape — no new cycle and no new bearing.
// THE TABLE FIXES THE TAILS, NOT THE RIDES: every entry records its
// OUT-DIRECTION and the CAPACITY the reach arithmetic needs, and nothing else,
// because printing the ride kinds is what made round 14's park A score 0/1 on
// selection novelty. Pick your nine from §2/§3's roster tables.
const NODES: XZ[] = [
  /*  0 */ GATE,             // [0, 63.6]  +z rim, CENTRED — skeleton A's signature
  /*  1 */ [0, 58.8],        // gate-street junction, 4.8 u from the turnstile
  /*  2 */ [9.6, 58.8],      // NEAR-GATE TAIL (out [1,0], cap 4) — LEAF.
  //                            4.8 + 9.6 = 14.4 u of street ≤ the 15 u sim budget ✓
  /*  3 */ [22.8, 45.6],     // east apron   ← wired from 'hub:E' [4.8, 45.6]
  /*  4 */ [22.8, 27.6],     // east spine north — crosses UNDER the N beam (z 34.2)
  /*  5 */ [9.6, 27.6],      // ring-ENTRY column head. x 9.6 is EAST of the
  //                            flagship's north valley (x ≤ 7.2) and south (x ≤ 4.8)
  /*  6 */ [0, 27.6],        // RING NORTH platform tail — LEAF (deck [0, 34.2])
  /*  7 */ [22.8, 0],        // east-spine junction — the satellite branch leaves HERE
  /*  8 */ [22.8, -3.6],     // FLAGSHIP queue TAIL (= C_START.x + 6.0) — LEAF
  /*  9 */ [22.8, -8.4],     // east junction
  /* 10 */ [36.0, -8.4],     // RING EAST platform tail — LEAF. NOTHING continues
  //                            east: x 42.6 is the deck (the old table's `7 → 20`)
  /* 11 */ [22.8, -14.4],    // south-east corner + TAIL (out [0,-1], cap 2)
  /* 12 */ [48.0, -14.4],    // thornwick court   ← wires 'gladeRow:W' [51.6, -14.4]
  /* 13 */ [48.0, -19.2],    // TAIL (out [1,0], cap 4) — LEAF
  /* 14 */ [49.2, 0],        // belvedere approach, OUTSIDE the ring band. 2.4 u off
  //                            'viewpoint:W' [51.6, 0] — 1.2 u nearer FAILS (§2)
  /* 15 */ [9.6, -21.6],     // ring interior spine, south end + TAIL (out [0,-1],
  //                            cap 6). The whole 49.2 u leg is corridor-clear + dry
  /* 16 */ [0, -21.6],       // south leg junction     ← was [-31.2, 30.0], IN WATER
  /* 17 */ [0, -57.6],       // RING SOUTH platform tail — LEAF (deck [0, -51.0], and
  //                            the queue faces OUT, so the tail is SOUTH of it).
  //                            REACHED 20 → 30 → 17, down x -24.0 and east along
  //                            z -57.6 — the ONE dry corridor. A column at x 0 from
  //                            node 16 shaves the seed's summit 8.59 → 0.83 (see the
  //                            SOUTH-QUEUE note above): that is −1.5 on axis 7.
  /* 18 */ [-13.2, -21.6],   // south-west junction — the foot of the WEST spoke
  /* 19 */ [-24.0, -21.6],   // south-west corner
  /* 20 */ [-24.0, -48.0],   // SECOND-COASTER stub junction
  /* 21 */ [-27.6, -48.0],   // SECOND COASTER queue TAIL (= B_START.x + 6.0) — LEAF.
  //                            Its lane runs WEST of the tail while the stub 20-21
  //                            runs EAST, so they cannot overlap.
  /* 22 */ [-13.2, -16.8],   // west leg head
  /* 23 */ [-36.0, -16.8],   // west leg mid — 8.4 u SOUTH of the W platform pad
  /* 24 */ [-36.0, -8.4],    // RING WEST platform tail — LEAF (deck [-42.6, -8.4])
  /* 25 */ [-44.4, -16.8],   // brasswork court  ← wires 'worksRow:E' [-48.0, -16.8]
  /* 26 */ [-44.4, -21.6],   // TAIL (out [-1,0], cap 6) — LEAF
  /* 27 */ [-13.2, 45.6],    // north-west corner  ← 'aveW:B' [-12.0, 45.6]
  /* 28 */ [-13.2, 21.6],    // west column mid + TAIL (out [-1,0], cap 8)
  /* 29 */ [0, 52.8],        // gate-street mid    ← wires 'pulseRow:W' [3.6, 52.8]
  /* 30 */ [-24.0, -57.6],   // SOUTH SHELF corner — the elbow of the ring's S approach.
  //                            x -24.0 is the SAME column as 19/20, so it adds NO new
  //                            bearing; degree 2; 10.2 u from the ridge's west peak
  //                            (-13.8, -42.0) r 9.25, i.e. just clear of its skirt.
];
const EDGES: [NetRef, NetRef][] = [
  [0, 1], [1, 29], [29, 'hub:N'], [1, 2],            // gate spine + near-gate tail
  ['pulseRow:W', 29],                                // the front world's row
  ['hub:E', 3], [3, 4], [4, 5], [5, 6],              // the EAST spoke + the ring N tail
  [4, 7], [7, 8], [8, 9], [9, 10],                   // east spine + flagship tail + E tail
  [9, 11], [11, 12], ['gladeRow:W', 12], [12, 13],   // the EAST STRIP + thornwick
  [7, 14], [14, 'viewpoint:W'],                      // the satellite branch, off the SPINE
  [5, 15], [15, 16],                                 // the ring interior spine
  [16, 18], [18, 19], [19, 20], [20, 21],            // the SOUTH leg + coaster-2 stub
  [20, 30], [30, 17],                                // the SOUTH SHELF → the ring S tail
  [18, 22], [22, 23], [23, 24],                      // the WEST spoke foot + the W tail
  [23, 25], ['worksRow:E', 25], [25, 26],            // the WEST SHELF + brasswork
  ['aveW:A', 'hub:W'], ['aveW:B', 27], [27, 28], [28, 22],   // the WEST spoke, both chain ends
];   // 37 edges · 9 port-refs over 6 piece ids · both chain ends of the avenue ✓
     //  (never `[n, VIEWPOINT.position]` — that is an edge through a plaza's
     //   solid basin: §0-FATAL `edgeThroughSolid`)
// FUSES TO: 87 nodes / 89 edges / 562.8 u / mean 6.32 u / 14.29 length classes.
// 30 is an ELBOW, not a shape change: no new cycle (17 stays a leaf, 30 is degree 2
// on the x -24.0 column 19 → 20 already runs down) and no bearing 19/20 lacked.
// AND EVERY ONE OF THE FOUR RING TAILS (6, 10, 17, 24) HAS DEGREE 1. The old
// table shipped `7 → 20`, a street continuing east past the East tail straight
// through the deck at x 42.6: a park that built it took a `blockers` FAIL,
// `nodesReachableFromGate` 87/97 and a stranded plaza — −3.5.

// ── 5a. BOTH COASTERS (§4.0-E wants TWO, from DIFFERENT archetypes) ────────
// §4.0-C INVERTING rectangle at the flagship slot, and §4.0-B FAMILY rectangle in
// the deep SOUTH-WEST. Piece lists verbatim from §4.0-C / §4.0-B — do not retype
// them; `cars` IS NOT OPTIONAL despite its default — omit it and the component
// returns `ratings: null`, so probe.json reads `thrill.ratedCount 0`,
// `archetypes []` and `secondCoasterQualifies false`. MEASURED through the real
// `rateCoaster` on 2026-07-26:
//
//   §4.0-C "the flagship"  start [16.8, 0.55, -3.6]  cars 3, bank 0.7
//     E 6.27 · I 9.55 (`ratingBand` INTENSE) · N 3.55 · maxLatG 0.73 (43 % margin)
//     **INVERSIONS 2** — the archetype NO corpus park had ever mounted; every one
//     of the fifteen rated corpus parks reads `inversions: 0`.
//     footprint x[-18.42, 16.80] z[-18.16, 18.64] — the dry plot CORE.
//     queue tail [22.8, -3.6] = start.x + 6.0, same z (node 8), queueDir [1, 0].
//   §4.0-B "the second"    start [-33.6, 0.55, -48.0]  cars 3, bank 0.7
//     E 5.27 · I 6.25 (`ratingBand` THRILLING) · N 2.25 · maxLatG 0.27 · inversions 0
//     footprint x[-62.52, -33.60] z[-61.27, -30.85] — the deep SOUTH-WEST.
//     queue tail [-27.6, -48.0] (node 21), queueDir [1, 0].
//   The two bboxes are DISJOINT by 15.18 u in x and 12.69 u in z (§4.0-E rule 2),
//   and neither contains any of the ring's 16 ground cells (rule 3) or overlaps
//   any world rect (rule 4). `distinctArchetypes 2` · `secondCoasterQualifies
//   true` (E 5.27 ≥ the 4.0 floor) · `lateralSafe true` (worst 0.73 < 1.275).
//
// ── WHY THE SECOND CIRCUIT IS FREE, AND IT IS A MEASUREMENT, NOT A HOPE ─────
// The constraint that actually binds a second §4.0 ring is `<Terrain coasterPts>`:
// every point pre-caps the peaks it passes over (`capPeakForCoaster`), which drives
// composed relief toward the `terrainFlattened` conjunction. Skeleton B ships with
// 0.03 of headroom, and three of nine candidate placements measured FATAL on it.
// So the four-number loop was run BOTH ways on this row and it came out IDENTICAL
// with and without the second circuit. On the REPAIRED table that loop now reads
// `kept` **0.82**, `reliefFloor.stdH` **0.83**, water centroids moved **0 / 0**,
// worst span lift **0.25**. THE REASON the second ring is free, measured directly on
// the unguarded composition of seed 1 temperate:
//
//   max PEAK CONTRIBUTION over §4.0-B's footprint x[-62.52,-33.60] z[-61.27,-30.85]
//     = **0.0000**.  Nearest peak (-22.8, -21.1) r 13.1 — its disc stops 14.59 u
//     SHORT of the rect. Nearest basin edge is 58.9 u away, so it is dry too.
//   max PEAK CONTRIBUTION over §4.0-C's footprint, for contrast = **1.91**.
//
// i.e. the deep SW block composes UNIFORMLY FLAT AND DRY on this row, so
// `capPeakForCoaster` has NOTHING TO CAP there. The flagship pays; the second is
// free BECAUSE OF WHERE IT STANDS. **Move it and that stops being true** — re-run
// the four numbers, do not reason from this paragraph.
const C_START: V3 = [16.8, 0.55, -3.6];      // §4.0-C, `C_PIECES` from §4.0-C
const B_START: V3 = [-33.6, 0.55, -48.0];    // §4.0-B, `B_PIECES` from §4.0-B
const { points: FLAG_PTS } = compileTrackPieces(C_PIECES, { type: 'steel', start: C_START, heading: 0, bounds: SIZE });
const { points: FLAG2_PTS } = compileTrackPieces(B_PIECES, { type: 'steel', start: B_START, heading: 0, bounds: SIZE });
/** BOTH point sets feed the terrain pre-cap — §4.0-E, and NOT optional. Passing
 *  only the flagship's leaves the ground under the second ring uncapped. */
const ALL_COASTER_PTS = [...FLAG_PTS, ...FLAG2_PTS];
// CORRIDOR KEEP-OUT, in PLOT coords = each archetype's §4 offset table + its own
// start. Check every street NODE and every street EDGE against BOTH (the sample
// walks each edge at 0.6-u steps). The valleys run ~0.6 u up, nowhere near the
// 2.2 u overfly gate, so a street at grade through one is a hard corridor FAIL.
//   §4.0-C @ [16.8, -3.6]:  west  x[-19.2, -16.8] z[-4.8, 10.8]
//                           south x[-10.8,   4.8] z[-19.2, -16.8]
//                           north x[ -8.4,   7.2] z[ 18.0,  19.2]
//                           station leg x[15.6, 18.0] z[-10.8, 4.8]  (own — exempt)
//   §4.0-B @ [-33.6, -48.0]: west  x[-63.6, -62.4] z[-54.0, -37.2]
//                            west  x[-61.2]        z[-52.8, -37.2]
//                            south x[-56.4, -39.6] z[-62.4, -60.0]
//                            north x[-51.6, -39.6] z[-32.4, -30.0]
//                            station leg x[-34.8, -32.4] z[-55.2, -40.8] (own)
// NOTE the west spoke at x -13.2: it threads §4.0-C's west valley (x[-19.2,-16.8])
// on the valley's EAST side. That is the second reason -13.2 was chosen over -31.2.

// ── THE PIECE LIST COMES FIRST, because the next two assertions RESOLVE against it
const PIECES: SetPiecePlan[] = [HUB, VIEWPOINT, AVE_WEST];   // late plazas HERE
const ALL_PLANS: SetPiecePlan[] = [...PIECES, PULSE_ROW, WORKS_ROW, GLADE_ROW];

// ── RESOLVE PORT REFS. DO NOT SKIP THEM. ────────────────────────────────────
// The old published form said "PORT refs are strings, so SKIP them", which made
// this assertion BLIND BY DESIGN on exactly the edges most likely to be diagonal.
// Round 13's park A copied it faithfully and shipped `['pulseRow:W', 6]` running
// [43.2, 8.4] → [22.8, −8.4]: a diagonal, unseen, elbowed by `buildParkNet`, and
// the synthesised elbow node became a dead stub. A port cell is READABLE — ask
// the plan for it. Four lines, and they are the difference between a check and a
// comment.
const portCell = (ref: NetRef): XZ => {
  if (typeof ref === 'number') return NODES[ref];
  const [id, name] = ref.split(':');
  const p = ALL_PLANS.find((q) => q.id === id);
  if (!p) throw new Error(`EDGES references '${ref}' but no plan with id '${id}' is in PIECES or WORLDS`);
  return p.port(name);                              // SetPiecePlan.port(name) → XZ
};

// ASSERT CARDINAL on the RESOLVED cells. **USE A TOLERANCE, NOT `!==`.** Port
// cells are COMPUTED (`tiles · 0.6 + 0.6`), and 7 · 0.6 + 0.6 is 4.799999999999999
// in binary, so a strict `!==` against an authored 4.8 throws a FALSE diagonal and
// blacks the page on a legal park. 1e-6 is four orders of magnitude under the
// 1.2-u lattice, so it cannot hide a real one.
const EPS = 1e-6;
EDGES.forEach(([a, b]) => {
  const A = portCell(a), B = portCell(b);
  if (Math.abs(A[0] - B[0]) > EPS && Math.abs(A[1] - B[1]) > EPS)
    throw new Error(
      `diagonal edge ${a}→${b}: [${A[0].toFixed(2)}, ${A[1].toFixed(2)}] → [${B[0].toFixed(2)}, ${B[1].toFixed(2)}]. ` +
        `buildParkNet repairs it with an ELBOW through a synthesised corner you did not plan (edgeDiagonal, plus a ` +
        `dead stub, plus a cell a pad or a corridor sweep can then land on). Read the port cell off the plan and ` +
        `move the NODE onto its row or column — never retype a coordinate.`,
    );
});

// ── A SET-PIECE'S `position` IS ITS SOLID CENTRE. NEVER A NODE. NEVER A TAIL. ─
// Round 13's park A used ONE cell as a `fountainPlazaPlan({ position })`, a NODES
// entry AND two rides' queue tail: `edgeThroughSolid` ×2 (§0-FATAL), a DROPPED edge,
// 1 orphan island, the `accessibility` FAIL and 5 of 6 `footprints` FAILs — ~11 pts.
// A plaza is a PAVED SOLID BASIN. Its connectors are its PORTS, one lattice cell
// OUTSIDE the footprint: wire `'viewpoint:W'` and stand the node outside. A queue
// tail is a STREET node, so the same rule binds it.
const SOLID_CLEAR: Record<string, number> = {
  FountainPlaza: 1.8,   // pathWidth/2 0.55 + a pad half 1.2 + 0.05, off the paved pad
  Bazaar: 0.6,          // footprint hz is 1.8, so 1.8 + 0.6 = 2.4 u off the AISLE — see below
  Boulevard: 0,         // its carriageway IS a street; a node may stand on it
};
function assertNodesOffPieces(nodes: XZ[], plans: SetPiecePlan[]): void {
  const hits: string[] = [];
  plans.forEach((p) => {
    const clear = SOLID_CLEAR[p.kind] ?? 1.8;
    if (clear === 0) return;
    const ports = new Set(p.ports.map((pt) => `${pt.at[0].toFixed(2)},${pt.at[1].toFixed(2)}`));
    const f = p.footprint;                                   // { cx, cz, hx, hz, yaw }
    const c = Math.cos(-f.yaw), s = Math.sin(-f.yaw);
    nodes.forEach((n, i) => {
      if (ports.has(`${n[0].toFixed(2)},${n[1].toFixed(2)}`)) return;      // a PORT is legal
      const dx = n[0] - f.cx, dz = n[1] - f.cz;
      const lx = dx * c - dz * s, lz = dx * s + dz * c;       // into the piece's own frame
      const gap = Math.max(Math.abs(lx) - f.hx, Math.abs(lz) - f.hz);     // < 0 ⇒ INSIDE
      if (gap < clear)
        hits.push(`[${n[0]}, ${n[1]}] (cell ${i}) is ${gap.toFixed(2)} u from '${p.id}' (${p.kind}) — needs ${clear}`);
    });
  });
  if (hits.length)
    throw new Error(
      `${hits.length} authored cell(s) stand inside or against a set-piece's SOLID footprint:\n  ` +
        hits.join('\n  ') +
        `\nA piece's position IS its solid centre, not a connector. Wire '<id>:<PORT>' and put the node ` +
        `OUTSIDE. If the cell is a ride's queue TAIL, move the tail — a tail on a plaza is edgeThroughSolid ` +
        `plus footprints plus an orphan island.`,
    );
}
assertNodesOffPieces(NODES, ALL_PLANS);
// …and run it again over the PADS once they exist (they come out of the fuse):
// assertNodesOffPieces([DISCO.pad, AETHER.pad, /* … */], ALL_PLANS);

// PORT-REF AUDIT — PRESENCE for every piece, and BOTH ENDS for a CHAIN piece.
// Audit the WORLD bazaars too: `worlds:` expands to them and buildParkNet keys
// their ports as `<planId>:<PORT>` exactly like an explicit piece's.
// A port with `prunable: false` is a STRUCTURAL CHAIN END — buildParkNet drops a
// dedicated stub nobody wired, but it NEVER shortens a carriageway, so an unwired
// chain end is a paved slab dead-ending in open grass (`deadStreetNode`).
// <Boulevard>'s 'A' and 'B' are BOTH prunable:false. Read the flag off the piece;
// never maintain a list of kinds.
const CHAIN_END_OPT_OUT = new Set<string>([/* 'ave:B' — ONLY when something real
  stands on that terminus, e.g. a bare <Gate> on it (Boulevard/Context.md) */]);
const PORT_REFS = EDGES.flat().filter((x): x is string => typeof x === 'string');
ALL_PLANS.forEach((p) => {          // ← PIECES / ALL_PLANS were declared above, for portCell
  const wired = new Set(PORT_REFS.filter((r) => r.split(':')[0] === p.id).map((r) => r.split(':')[1]));
  if (!wired.size)
    throw new Error(`set-piece '${p.id}' has NO '${p.id}:<PORT>' ref in EDGES — it composes as an ISLAND`);
  p.ports.filter((pt) => !pt.prunable).forEach((pt) => {
    if (wired.has(pt.name) || CHAIN_END_OPT_OUT.has(`${p.id}:${pt.name}`)) return;
    throw new Error(
      `chain piece '${p.id}' (${p.kind}) wires [${[...wired]}] but NOT '${p.id}:${pt.name}' — a prunable:false port is a ` +
        `structural carriageway END, so this avenue dead-ends in grass (deadStreetNode, −2.0 in aggregate). Wire it, and ` +
        `READ THE ENDPOINT OFF THE PIECE: boulevardPlan({ from: HUB.port('W'), to: MARKET.port('E') }) — never retype the cell.`,
    );
  });
});

// EVERY MONORAIL PLATFORM TAIL IS A LEAF — wave-18, and this was OUR OWN defect.
// The OLD §3.1-A shipped `7 → 20`: a street CONTINUING past the East platform tail
// [36, -8.4] straight through the deck at x 42.6. Round 14's park B built it
// faithfully and took a `blockers` FAIL, `nodesReachableFromGate` 87/97 and a
// stranded 9-tile plaza — −3.5. The repaired table above makes all four tails
// leaves (nodes 6, 10, 17, 24). Five lines refuse a regression offline:
const RING_TAILS: XZ[] = [[36.0, -8.4], [0, 27.6], [-36.0, -8.4], [0, -57.6]];  // E N W S
RING_TAILS.forEach((c) => {
  const i = NODES.findIndex((n) => Math.hypot(n[0] - c[0], n[1] - c[1]) < 1e-6);
  if (i < 0) return;
  const deg = EDGES.filter(([a, b]) => a === i || b === i).length;
  parkAssert('tailIsLeaf', deg <= 1,
    `street node ${i} [${c}] is a monorail platform tail with degree ${deg}. A tail sits 6.6 u off a deck, so ` +
      `anything continuing past it runs THROUGH the platform pad. Hang the branch off the SPINE instead.`);
});

// NO QUEUE TAIL IS ALSO A SET-PIECE PORT CELL — wave-18. `assertNodesOffPieces`
// PASSES this: a PORT is legally OUTSIDE the footprint. Round 14 B made node 8 both
// the Teacups queue tail AND `pulseRow:W`'s port, so the chassis derived the exit
// lane one cell over and landed it inside the bazaar aisle — `footprints` FAIL, −1.
const PORT_CELLS = ALL_PLANS.flatMap((p) => p.ports.map((pt) => ({ id: p.id, name: pt.name, at: p.port(pt.name) as XZ })));
QUEUE_TAILS.forEach((t) => {
  const hit = PORT_CELLS.find((q) => Math.hypot(q.at[0] - t[0], q.at[1] - t[1]) < 1.2 - 1e-6);
  parkAssert('tailOffPort', !hit,
    hit ? `queue tail [${t}] is (or abuts) '${hit.id}:${hit.name}'s port cell [${hit.at}] — the derived exit lane ` +
      `leaves from the cell NEXT to the tail, which is inside the piece.` : '');
});

// `facing` AND THE WIRED PORT AGREE — wave-18. A `facing: { port: 'E' }` against
// EDGES wiring ':W' makes buildParkNet PRUNE the facing port and dead-end the wired
// one: `deadStreetNode`, −1.0 — and the port-ref COUNT audit above passes it.
ALL_PLANS.forEach((p) => {
  const wired = PORT_REFS.filter((r) => r.startsWith(`${p.id}:`));
  const f = (p as { facing?: { port: string } }).facing;
  parkAssert('facingWired', !f || wired.includes(`${p.id}:${f.port}`),
    `'${p.id}' declares facing.port '${f?.port}' but EDGES wires [${wired.join(', ')}]`);
});

// THE THREE WORLDS' HAND-PLACED SCENERY CELLS — three per world, the audited floor.
// LITERALS, declared HERE (above KEEP_DRY) because STRUCTURAL guard-seed cells cannot
// come out of `offPathCell(NET, …)`: `NET` does not exist yet. Choose them 1.2 u clear
// by construction; both confirmations run in 5c-w.
const PULSE_SC: XZ[] = [[24.0, 55.2], [24.0, 49.2], [16.8, 61.2]];
const WORKS_SC: XZ[] = [[-58.8, -8.4], [-58.8, -24.0], [-49.2, -6.0]];
const GLADE_SC: XZ[] = [[52.8, -8.4], [61.2, -8.4], [48.0, -10.8]];

// THE FUSE'S INPUTS. `KEEP_DRY` is what you PAVE OR STAND STRUCTURES ON — the ring's
// 16 ground cells plus the three worlds' nine hand-placed scenery cells. NODES are NOT
// in it: `<Paths>` already paves them and the fuse folds them in, and guarding them
// wholesale is the defect §5b-ii refuses. `BINS` are bin cells, not guards.
const KEEP_DRY: XZ[] = [...RING_CELLS, ...PULSE_SC, ...WORKS_SC, ...GLADE_SC];
const BINS: XZ[] = [[-2.4, 56.4], [22.8, 33.6], [1.2, -18.0], [-15.6, -14.4], [46.8, -11.6]];

// WALK THE GUARDS AGAINST THE PINNED ROW — §1-W's `SEED_ROW_WATER` +
// `assertKeepDryOffRow`, both pasted into THIS file (inert data plus one pure
// function; nothing to import). ADVISORY: the published BOXES are the basin chain's
// bounding box, so it has known false positives in the corners.
assertKeepDryOffRow(KEEP_DRY, SEED_ROW_WATER['1/temperate']);

// ── 5b. ONE shared graph — buildParkNet is called EXACTLY ONCE ────────────
// THE ONE RULE IS ABOUT THE PIECE SET, NOT WHICH KEYWORD YOU TYPE: every piece's
// sub-net must be in the ONE fuse, and every piece id must have a `'<id>:<PORT>'` ref
// in EDGES. **`worlds:` IS OPTIONAL AND ALWAYS WAS** (`ParkNetInput.worlds?:`). Its
// ONLY behaviour is a dedup flatten, `[...worlds.flatMap(w => w.pieces), ...pieces]`,
// so a world row listed in `pieces:` is fused, port-keyed, keepDry-merged and
// `gateway()`-resolvable identically (`gateway()` builds its ref off the world's OWN
// piece ports; it never reads `input.worlds`). Two spellings, one invariant:
//   `worlds: WORLDS` saves listing a world's pieces twice — ONLY if the worlds are
//     declarable BEFORE the fuse.
//   `pieces: ALL_PLANS` lists every piece explicitly. **§3.1-A MUST use this, and so
//     does any park that passes the gate**: `worldPlan({ rides })` reads the PADS ·
//     the pads come out of `place()` · `place()` reads `NET`. `WORLDS` does not exist
//     yet (5c-w declares it) so naming it here is a `const` TDZ ReferenceError at
//     module scope, and `include:` does NOT rescue it — that widens a RECT, it cannot
//     let a `worldPlan` reading a real pad exist before the pad. **So `ALL_PLANS`
//     NAMES THE ROWS; never `WORLDS.flatMap(w => w.pieces)`, same TDZ one line up.**
// Either way it is the SAME piece set the port-ref audit above iterated. Pass
// `pieces: PIECES` (the plazas + avenue, without the bazaar rows) and every
// `'<bazaarId>:<PORT>'` ref is DROPPED as an unknown port — MEASURED: 3 FATAL
// `unknownPort` lints and three orphan islands.
// Declare late plazas in PIECES above, never in a second fuse: round 12 built NET (no
// viewpoint) and NET2 (with it), cleared every pad/prop/tree against NET, paved NET2.
const NET = buildParkNet({ nodes: NODES, edges: EDGES, pieces: ALL_PLANS, keepDry: KEEP_DRY, bins: BINS });

// ── 5b-ii. `keepDryOf` — THE FUSE'S OUTPUT IS NOT A GUARD LIST YET (wave-18) ─
// `buildParkNet` MERGES EVERY SET-PIECE AND WORLD CELL INTO `NET.keepDry` — plaza
// pad cells, bazaar aisle and verge cells, port stubs. MEASURED on the repaired
// §3.1-A: **31 AUTHORED cells fuse to 647 paved cells and 659 guard cells.** So
// `<Terrain keepDry>` must NOT receive `NET.keepDry` raw, and sieving `NODES` alone
// is not enough either.
// `KEEP_DRY = NODES.slice()` has now shipped in THREE consecutive rounds; round 14 B
// wrote it and took both bodies off the row (dominant 74.5 u, secondary 70.2 u, areas
// roughly halved, two §0-FATAL `waterRePicked`, −3.5). IT IS ALSO WHAT HID THE
// THIRTEEN WET CELLS IN THE OLD §3.1-A TABLE — a blanket guard list LIFTS the ground,
// so a wet node reads dry and the check meant to catch it passes. It keeps shipping
// because the anti-pattern is PROSE while everything around it is code. Here is code.
const offRow = (c: XZ, row = SEED_ROW_WATER['1/temperate'], nearR = 12) =>
  [row.dom, row.sec].every((b) =>
    !(c[0] >= b.box[0] && c[0] <= b.box[1] && c[1] >= b.box[2] && c[1] <= b.box[3]) &&
    Math.hypot(c[0] - b.ctr[0], c[1] - b.ctr[1]) >= nearR);
function keepDryOf(net: { keepDry: XZ[] }, row = SEED_ROW_WATER['1/temperate']): XZ[] {
  const kept = net.keepDry.filter((c) => offRow(c, row));
  const dropped = net.keepDry.length - kept.length;
  if (dropped) console.warn(
    `[park] keepDryOf dropped ${dropped} of ${net.keepDry.length} guard cell(s) on the pinned row's water. ` +
      `A DROPPED guard is NOT a fixed cell — whatever you meant to build there is still in the lake. MOVE it.`);
  return kept;
}
const GUARDS = keepDryOf(NET);        // ← this, not NET.keepDry, is what <Terrain> gets
// MEASURED, the OLD §3.1-A on seed 1: a blanket guard list moved the dominant body
// 77.3 u and the secondary 69.4 u, terrainSeed 16 → 501, probes 17 → 64.
// MEASURED, the REPAIRED §3.1-A on the same row: keepDryOf → 659 guards, BOTH
// bodies moved 0.0 u, terrainSeed 16 → 16, probes 17 → 17, 0 clamp discs,
// 0 of 659 guarded cells wet, 0 on a bulge.
// NOTE `keepDryOf` DROPS rather than fixes. A dropped guard is a cell still in the
// lake — if it prints a non-zero drop count, MOVE the thing, do not ship it.

// ── 5c. COMPOSE THE WATER TWICE AND REFUSE TO SHIP IF IT MOVED ────────────
// `assertKeepDryOffRow` is a SIEVE against PUBLISHED boxes. This is the AUTHORITY,
// and since wave 16 it is EXECUTABLE at module scope rather than advice. Round 13's
// park A passed `keepDry: []`, let `NET.keepDry` fill itself from the piece cells,
// dropped guard cells into seed 1's SECONDARY waterline, and took a fatal
// `waterRePicked` — the secondary centroid moved 70.7 u — plus one refused tree.
//
// `parkComposition(t, seed, size, climate, guards)` is POSITIONAL and PURE.
// TWO TRAPS: `size` DEFAULTS TO 48, so pass 128 or you audit a different park;
// and there is NO `comp.isDry` — the dryness predicate is the basin walk below.
// (`t` is accepted and unused, so the `THREE` namespace import costs nothing.)
const SEED = 1, CLIMATE = 'temperate' as const, SIZE = 128;
const BARE = parkComposition(THREE, SEED, SIZE, CLIMATE);
const COMP = parkComposition(THREE, SEED, SIZE, CLIMATE, { keepDry: GUARDS, coasterPts: ALL_COASTER_PTS });
const moved = (a: XZ | null, b: XZ | null) =>
  a && b ? Math.hypot(a[0] - b[0], a[1] - b[1]) : a === b ? 0 : Infinity;
([['DOMINANT', BARE.waterCentre, COMP.waterCentre],
  ['SECONDARY', BARE.waterCentreSecond, COMP.waterCentreSecond]] as const).forEach(([n, a, b]) => {
  const d = moved(a as XZ | null, b as XZ | null);
  if (d > 6)
    throw new Error(
      `your guard list MOVED the ${n} water body ${d === Infinity ? '— it VANISHED' : `${d.toFixed(1)} u`} ` +
        `(terrainSeed ${BARE.terrainSeed} → ${COMP.terrainSeed}). keepDry does not AVOID water, it LIFTS the ` +
        `ground and pushes the body out: this is a §0-FATAL waterRePicked/waterShrunk. Guard ONLY what you pave ` +
        `and stand on, or pin a row whose bodies this layout misses (1 temperate · 31 temperate · 91 desert).`,
    );
});

// AND DIFF THE *RELIEF*, NOT ONLY THE WATER (wave-18). A park ran the centroid diff
// faithfully, PASSED, and was still charged a `terrainFlattened` for a landform its
// own keepDry had flattened: three guard cells [0,-43.2] [0,-42.0] [0,-44.4] — the
// INWARD SOUTH tail and its approach column — cut a range from h 8.59 to 0.83.
// −1.5, and THE FIX IS THE OUTWARD SOUTH QUEUE ABOVE, not acceptance. On an
// OFF-TABLE seed (§3.1-C's 107 alpine) this is the
// ONLY terrain check there is, because `expectWater` is undefined and
// `waterRePicked` cannot fire at all.
//
// ⚠ THE FIELD IS `report.reliefFloor`. **`report.relief` AND `report.stdH` DO NOT
// EXIST**, and this block used to read them. Copied verbatim it threw
// `TypeError: Cannot read properties of undefined (reading 'toFixed')` **at module
// scope** — a BLANK PAGE, not a soft failure, on every park that pasted it.
// `report.reliefFloor` is `ReliefFloorReport | null` and it is **`null` on an
// UNGUARDED composition and on any plot ≤ 48** (`guardAware = size > 48 &&
// guards.length > 0`, ParkBuilder/composition.ts:1111) — so `BARE.report.reliefFloor`
// is ALWAYS null and diffing the two compositions is the wrong shape anyway. It
// already carries the ratio. **These are the fields it has, and there are no
// others:** `relief` `stdH` `authoredRelief` `authoredStdH` `kept` `keptRelief`
// `keptStdH` `floor` `ok` `guardedRanges` `cappedPeaks[]`, where
// `kept = min(relief/authoredRelief, stdH/authoredStdH)` and `floor` is
// `RELIEF_FLOOR_FRAC` = **0.70**.
// THE NULL GUARD IS NOT DECORATION: without it a size-48 park crashes on the FIX.
{
  const rf = COMP.report.reliefFloor;            // NOT COMP.report.relief — no such field
  parkAssert('terrainFlattened', !rf || rf.kept >= rf.floor,
    rf ? `keepDry FLATTENED the seed: authored relief ${rf.authoredRelief.toFixed(2)} → built ` +
      `${rf.relief.toFixed(2)} (kept ${rf.kept.toFixed(2)} against the ${rf.floor} floor), stdH ` +
      `${rf.authoredStdH.toFixed(2)} → ${rf.stdH.toFixed(2)}. Guarding a cell does not dodge the land, it ` +
      `LIFTS it — a tail or a deck on a range SHAVES the range. Ranges this guard list stood on: ` +
      `${rf.guardedRanges}; peaks it took ≥ 25 % of, with the culprit cells: ` +
      `${JSON.stringify(rf.cappedPeaks)}` : '',
    'advisory');   // ADVISORY: the GATE's fatal test is the CONJUNCTION kept < 0.70
                   // AND stdH < 0.76, and a big layout must flatten its own pads.
}
// THE OTHER `report.` FIELDS THAT EXIST on a `parkComposition` result, checked
// against the return type on 2026-07-26 — anything else you write is `undefined`
// and `undefined.toFixed()` is a black page: `probesTried` · `violations` (string[],
// POST-clamp) · `clampedCells` · `waterBodies` · `waterAreaU2` · `waterAreas[]` ·
// `waterGap` · `waterFracEastHalf` · `waterFracNEQuad` · `apronMaxAbs` ·
// `reliefFloor`. (`terrainSeed`, `basins`, `basinsSecond`, `clampBasins`, `peaks`,
// `waterCentre`, `waterCentreSecond` are on the COMPOSITION, not on `.report`.)
// The `report.valid` / `report.fatal` / `report.closure` / `report.stations` fields
// named elsewhere in these rules belong to `compileTrackPieces`, a DIFFERENT type.

// THE DRYNESS PREDICATE, from the COMPOSED basins. The waterline is 0.74·radius —
// the same constant `ParkBuilder/dressing.ts` sieves the dressing with. Route EVERY
// hand-placed cell through it: pads, huts, stall anchors, the restroom, trees,
// scenery. `park.isDryCell` is the mount-time version and needs <Terrain>'s effect
// to have run; at module scope on an unmounted park it answers `true` for
// everything, which is a vacuous pass, not a check.
// THREE BASIN LISTS, NOT TWO. `COMP.clampBasins` — the shave discs the guard clamp
// digs — are ABSENT from `COMP.basins`, and <Terrain> builds its water from
// `[...comp.basins, ...comp.clampBasins]` (§7's reference sketch,
// `-validation.md`). Omit the third list and a cell reads `dry: true` here and
// composes **3.9 u UNDER water**. Use this as the fast module-scope sieve, then
// confirm with `park.isDryCell()` after mount (or `probe-skeleton.mjs`'s `wet`
// column, which reads the BUILT heightfield).
const isDry = (c: XZ, margin = 1.2) =>
  [...COMP.basins, ...COMP.basinsSecond, ...(COMP.clampBasins ?? [])].every(
    (b) => Math.hypot(c[0] - b.x, c[1] - b.z) > 0.74 * b.radius + margin);
const dry = (c: XZ): XZ => {
  if (!isDry(c)) throw new Error(`cell [${c}] is inside the COMPOSED waterline — move it, do not guard it`);
  return c;
};
// hard cells THROW; scattered dressing SIEVES (a sieve DROPS, so over-provision:
// ~40 tree cells for the 32 floor, ~20 scenery cells for the 16).
//
// AND `TREE_CELLS` IS NOT A RAW ARRAY — THE SCATTER GOES THROUGH `offPathCell` TOO
// (wave-18). Both published skeletons ran ride pads through offPathCell and world
// scenery through clear 1.2, then handed the <Placed build={tree}> scatter over as a
// HAND-AUTHORED LIST. Round 14's park A copied that faithfully, five trees landed
// 0.00 u from a street edge, and the `scenery` gate returned five FAILs: **axis 9
// floored to 0/5, −5.0, the largest single item of the wave, off OUR template.** A
// tree plants a 0.7-u footprint; the floor is `pathWidth/2 + min(r, 0.6) − 0.1`.
// THE RULE HAS NO EXCEPTIONS: **every authored cell that mounts geometry ends
// through `offPathCell`** — pad, queue anchor, restroom, stall anchor, themed world
// scenery, AND the tree scatter.
// Type the shape off the tuple, too: `shape: string` is a TS2322 against `tree()`'s
// union and `typecheck.mjs` is part of the gate. `Kit` exports the FUNCTION, not the
// union, so there is no `TreeShape` to import — index the `as const` tuple.
const TREE_SHAPES = ['round', 'pine', 'willow', 'round', 'pine'] as const;
type TreeShape = (typeof TREE_SHAPES)[number];
const TREE_CELLS: { at: XZ; shape: TreeShape }[] = RAW_TREES.map((c, i) => ({
  at: (offPathCell(NET, c, { clear: 0.75 }) ?? c) as XZ,   // 0.55 slab + 0.6 blockR − 0.1 kerb
  shape: TREE_SHAPES[i % TREE_SHAPES.length],
}));
const TREES_DRY = TREE_CELLS.filter((t) => isDry(t.at));
const SCENERY_DRY = SCENERY_CELLS.filter((s) => isDry(s.at));

// ── 5c-w. THE PADS, THEN THE WORLDS. THIS IS THE ONLY LEGAL ORDER ──────────
// `place()` reads NET (5b) *and* the COMPOSED heightfield through `assertPadFlat`
// (5c), so the six calls cannot run before this line. §3's rects were DESIGNED
// above; they are DECLARED here, out of the pads. Same order as
// harness/park-eval/samples/skeleton-a.tsx (fuse 560 → pads 634 → worlds 648).
const SIM     = place(NODES[2],  [ 1,  0], 4, 'MotionSimulator');  // pulse, near the gate
const MANSION = place(NODES[26], [-1,  0], 6, 'HauntedMansion');   // brasswork, west shelf
const BARGE   = place(NODES[13], [ 1,  0], 4, 'MoonlitBarge');     // thornwick, east strip
const MAGLEV  = place(NODES[28], [-1,  0], 8, 'MagneticRide');     // the west column's meadow
const HELI    = place(NODES[11], [ 0, -1], 2, 'Helicycles');       // the south-east apron
const DRIFT   = place(NODES[15], [ 0, -1], 6, 'RiverRapids');      // the ring's interior south
const PADS = [SIM, MANSION, BARGE, MAGLEV, HELI, DRIFT];
assertNodesOffPieces(PADS.map((p) => p.pad), ALL_PLANS);      // the §5b promise at 783
assertNodesOffPieces(PADS.map((p) => p.anchor), ALL_PLANS);   // kept, now that they exist
// `include` IS NOT OPTIONAL: a hand-mounted ride/stall/scenery is not a member
// plan, so without its cell here it falls OUTSIDE the region and counts for
// nothing (`built` stays false, the piece is reported as `unplacedThemed`).
// Include the RING-REACH cell too, or `everyWorldTouched` reads false for free.
const PULSE   = worldPlan({ id: 'pulse',     theme: PULSE_DISTRICT,    pieces: [PULSE_ROW],
  rides: [{ at: SIM.pad, name: 'Pulse Simulator' }],  include: [...PULSE_SC, /* reach cells */] });
const FOUNDRY = worldPlan({ id: 'brasswork', theme: BRASSWORK_FOUNDRY, pieces: [WORKS_ROW],
  rides: [{ at: MANSION.pad, name: 'Foundry Mansion' }], include: [...WORKS_SC, /* … */] });
const GLADE   = worldPlan({ id: 'thornwick', theme: THORNWICK_GLADE,   pieces: [GLADE_ROW],
  rides: [{ at: BARGE.pad, name: 'Toadstool Barge' }],   include: [...GLADE_SC, /* … */] });
const WORLDS  = [PULSE, FOUNDRY, GLADE];
// CONFIRM containment, do not hope: the world audit is a rect test.
WORLDS.forEach((w, i) => parkAssert('rideInWorld', w.contains([SIM, MANSION, BARGE][i].pad),
  `world '${w.id}' does not CONTAIN its own ride pad — widen include, never nudge the pad`));
// ≥ 3 NAMED THEMED SCENERY PIECES PER WORLD, INSIDE ITS RECT, and each cell 1.2 u off
// the street (`unmoved` is the re-check the literals above deferred to here). Round 13
// reported `sceneryCount: 0` on all three worlds. Trees are NOT scenery.
const unmoved = (c: XZ, clear: number) => {
  const o = offPathCell(NET, c, { clear });
  return !!o && Math.abs(o[0] - c[0]) < 1e-6 && Math.abs(o[1] - c[1]) < 1e-6;
};
([['pulse', PULSE_SC], ['brasswork', WORKS_SC], ['thornwick', GLADE_SC]] as const)
  .forEach(([id, cells]) => {
    const w = WORLDS.find((x) => x.id === id)!;
    cells.forEach((c) => parkAssert('sceneryOffStreet', unmoved(c, 1.2),
      `world '${id}' scenery cell [${c}] is inside the 1.2 u street margin — MOVE it`));
    parkAssert('worldScenery', cells.filter((c) => w.contains(c)).length >= 3,
      `world '${id}' has under 3 scenery cells INSIDE its rect — a cell outside it is 'unplacedThemed' ` +
        `and counts for NOTHING: add it to that world's worldPlan({ include }).`);
  });

// ── 5d. `export function __netdump()` IS PART OF THE FILE SKELETON (wave-18) ─
// NOT an optional extra — a REQUIRED export. Without it `probe-skeleton.mjs` exits
// with "exports no `__netdump()`" and the whole ~2-second offline loop is gone:
// layout metrics + novelty, the §5c water diff, the BUILT ground under every cell you
// pave, the peak bump at every pad, the <Paths> height solve. Round 14 B shipped
// without it and paid a ~7-MINUTE BROWSER ROUND TRIP PER ITERATION for numbers that
// are pure functions of its own module scope. Put it in the FIRST draft:
//   export function __netdump() {
//     return { seed, size, climate, keepDry: GUARDS, coasterPts: ALL_COASTER_PTS,
//              hardCells: [...NODES, ...RING_CELLS, ...pads, ...anchors, ...stallAts],
//              layoutRaw: { size, streetNodes, nodes, edges, plazas, bins,
//                           rides, stalls, setPieces, sceneryByName, trees },
//              regions: WORLDS.map((w) => ({ id: w.id, ...w.region })) };
//   }
// Copy the worked shape from samples/skeleton-b.tsx.
parkAssertFlush();        // ← the LAST line of the assertion block

// ── 6. MOUNT. Terrain → Paths → GameManager → Gate → hub → worlds ────────
// SEED: 1 / temperate. MEASURED — the §4.2-A ring's 15 DISTINCT guard cells (the 16
// GROUND cells above, start pose deduped into deck W's disc) leave this row
// BIT-IDENTICAL (probes 17→17, terrainSeed 16, waterCentre and waterCentreSecond
// unmoved, 0 clamps). Seed 7 is NOT usable for a ring park in any climate: its
// west tarn sits under the West deck every time (§1's ring water-walk).
// `size` OMITTED — the default IS 128 (§0.0 step 1). `roster` is MANDATORY:
// without the PROP, preflight.mjs prints "refusing to bundle" and nothing renders.
//
// THE ROSTER IS ARITHMETIC, WRITTEN FROM THE REGISTRATION. Round 13's park A wrote
// `stalls: 5` against 10 registered — it counted bazaar ROWS (`rosterOverstated`,
// understated direction, same warning). The count is:
//   stalls = Σ over bazaar rows of plan.slots.length   (POST-padding, never the
//                                                       `stalls: [...]` array you typed)
//          + the standalone stands you mount by hand
// WORKED, THIS SKELETON: 6 + 3 + 3 = **12** slots and no hand stalls.
// NOT 3 rows = 3, and NOT the 12 kinds you typed if a row asked for more than 6.
const STALL_COUNT = [PULSE_ROW, WORKS_ROW, GLADE_ROW].reduce((n, b) => n + b.slots.length, 0);
const RIDE_NAMES = [        // 9 registered rides over 5 categories, 9 circuits
  'Corkscrew Ascent', 'Foundry Flyer', 'Grand Circle Monorail', /* …and the six flats */
];

<Park seed={SEED} climate={CLIMATE} size={SIZE}
      roster={{ rides: RIDE_NAMES, stalls: STALL_COUNT, categories: 5 }}>
  <Terrain keepDry={GUARDS} coasterPts={ALL_COASTER_PTS} />
  <Paths nodes={NET.nodes} edges={NET.edges} plazas={NET.plazas} bins={NET.bins} walkers={8}
         surfaceZones={WORLDS.map((w) => ({ ...w.region, surface: w.theme.pathSurface }))} />
  <GameManager />
  <Gate position={GATE} />

  {/* ── THE MANDATORY RING, INLINE. `<Monorail>` HAS NO `start` AND NO `heading`. ──
      It is a `composableRide`: `position` + `rotation` (radians), and it compiles its
      track from the local origin. `start`/`heading` are SILENTLY DROPPED and the ring
      mounts at the park origin (`worldsTouched: 0`, a perfect compile, no error) —
      `-monorail.md` has the incident. `rotation` STAYS 0: the four decks below are
      published in the WORLD frame at this pose, so rotating invalidates every one of
      them plus the corridor table plus the 16 keepDry cells. Translate, never rotate. */}
  <Monorail
    position={[-42.6, 0, -9.7]} rotation={0} pieces={MONO_PIECES} beamY={2.6} loopSeconds={12} pinned
    name="Grand Circle Monorail" capacity={6} rideDuration={12} intensity={1} price={0}
    queue={{ anchor: [-40.81, -8.4], dir: [1, 0] }}
    register={{
      board: [-42.6, 2.6, -8.4],                        // platform 0 — W (station 0 is DERIVED)
      stations: [                                       // platforms 1-3, WORLD frame, verbatim
        { label: 'North', boardPoint: [0, 2.6, 34.2],    queueAnchor: [0, 0.05, 32.41],
          queueDir: [0, -1], exitPoint: [-1.2, 0.05, 33.03], exitDir: [0, -1] },
        { label: 'East',  boardPoint: [42.6, 2.6, -8.4], queueAnchor: [40.81, 0.05, -8.4],
          queueDir: [-1, 0], exitPoint: [41.43, 0.05, -7.2], exitDir: [-1, 0] },
        { label: 'South', boardPoint: [0, 2.6, -51.0],   queueAnchor: [0, 0.05, -52.79],
          queueDir: [0, -1], exitPoint: [1.2, 0.05, -52.17], exitDir: [0, -1] },
      ],
    }}
  />
  {/* `register.queueAnchor` IS NOT A FIELD and typecheck-FAILS: station 0's lane is
      `queue={{ anchor, dir }}` at the TOP level, and `queueAnchor`/`queueDir` exist
      only INSIDE a `stations[]` entry. Full field list in `-monorail.md`. */}

  {/* ── BOTH COASTERS. `cars` IS NOT OPTIONAL (see step 5a): omit it and the
      component returns `ratings: null`, so §4.0-E's "each rateCoaster-measured"
      clause silently reads as UNMET on a park whose coasters are both fine.
      `queueTailNode={NET.node(tail)}` resolves the AUTHORED tail out of the ONE
      fused net — never a raw coordinate. */}
  <Coaster name="Corkscrew Ascent" pieces={C_PIECES} start={C_START} heading={0}
    type="steel" cars={3} capacity={4} rideDuration={10} loadTime={2} intensity={9} price={7}
    queueTailNode={NET.node([22.8, -3.6])} queueDir={[1, 0]} />
  <Coaster name="Foundry Flyer" pieces={B_PIECES} start={B_START} heading={0}
    type="steel" cars={3} capacity={4} rideDuration={10} loadTime={2} intensity={6} price={5}
    queueTailNode={NET.node([-27.6, -48.0])} queueDir={[1, 0]} />

  <FountainPlaza plan={HUB} /> <FountainPlaza plan={VIEWPOINT} />
  <Boulevard plan={AVE_WEST} />

  {/* Each world: its rect, its shop row, its OWN ride, its OWN stall, and THREE
      NAMED THEMED SCENERY PIECES. Round 13 shipped `sceneryCount: 0` on all three
      because no `*Scenery` pack was imported — trees are NOT scenery. A THEMED
      circuit standing OUTSIDE every <World> rect is a `themedPieceOutsideWorlds`
      warning, so the three NEUTRAL flats here are untextured kinds on purpose. */}
  <World plan={PULSE}   /> <Bazaar plan={PULSE_ROW} />
  <NeonArch position={dry(PULSE_SC[0])} /> <SpeakerStack position={dry(PULSE_SC[1])} />
  <MirrorBallPylon position={dry(PULSE_SC[2])} />
  <World plan={FOUNDRY} /> <Bazaar plan={WORKS_ROW} />
  <GiantGear position={dry(WORKS_SC[0])} /> <SteamPipes position={dry(WORKS_SC[1])} />
  <ClockTower position={dry(WORKS_SC[2])} />
  <World plan={GLADE}   /> <Bazaar plan={GLADE_ROW} />
  <GiantToadstools position={dry(GLADE_SC[0])} /> <StandingStones position={dry(GLADE_SC[1])} />
  <LanternTree position={dry(GLADE_SC[2])} />

  {/* dressing LAST, sieved */}
  {TREES_DRY.map((t, i) => <Placed key={`tr-${i}`} position={t.at} build={(three) => tree(three, { shape: t.shape })} />)}
</Park>
```

**THE WORLD SCENERY STANZA, AND ITS ASSERTION.** Every `*Scenery` component is a
plain `composable`, so its props are `position` / `rotation` / `scale` plus its own
options — there is no `register`, no `name` and no plan. **The five packs' complete
export lists** (the only names that exist) are tabulated twice already in
always-injected rules: `-checks-b.md` check 25 and `-worlds.md` §3's preset table.

**THE CELLS AND THEIR TWO ASSERTIONS ARE IN THE BLOCK ABOVE, NOT HERE:**
`PULSE_SC` / `WORKS_SC` / `GLADE_SC` are LITERALS just above `KEEP_DRY` (structural
guard-seed cells cannot come out of `offPathCell(NET, …)` — `NET` does not exist
yet), and step **5c-w** carries the street re-check and the ≥ 3-inside-the-rect
assertion, where `NET` and `WORLDS` both exist. **Three per world, each ALSO in that
world's `worldPlan({ include })`** — a cell outside the rect is `unplacedThemed`.

> ## ⚠ YOU CANNOT OPEN OUR FILES — `park-generation.md` §0.0-F, always injected.
> The consequence HERE: **every code block this skeleton depends on is pasted INTO
> it.** A `§` or a file path is **PROVENANCE**, never a fetch instruction.

Imports, exactly (a wrong specifier makes esbuild refuse the whole bundle —
the round-8 black page). This is `samples/skeleton-a.tsx`'s real list:

```tsx
import * as THREE from 'three';                           // for parkComposition's inert first arg
import type { V3, XZ } from './components/Park';          // ONE canonical line for both
import type { NetRef, SetPiecePlan } from './components/SetPieceKit';   // net refs + the plan type
import type { TrackPiece } from './components/SplineRideKit';
import { Park, GameManager, Terrain, Paths, Gate, Coaster, Restroom, Scenery, Lights, Placed, offPathCell } from './components/Park';
// parkComposition and laneLenOf are NOT on the Park barrel — they live one level out
import { laneLenOf, parkComposition } from './components/ParkBuilder';
import { buildParkNet, worldPlan, World, BRASSWORK_FOUNDRY, PULSE_DISTRICT, THORNWICK_GLADE } from './components/SetPieceKit';
import { compileTrackPieces } from './components/SplineRideKit';   // for BOTH coasters' points
import { FountainPlaza, fountainPlazaPlan } from './components/FountainPlaza';
import { Bazaar, bazaarPlan } from './components/Bazaar';
import { Boulevard, boulevardPlan } from './components/Boulevard';
import { Monorail } from './components/Monorail';         // MANDATORY — preflight gate at size ≥ 64
import { tree } from './components/Kit';                  // the FUNCTION; there is no TreeShape union
// the six flats — FOUR of these had NEVER SHIPPED in the corpus. Pick your own.
import { MagneticRide } from './components/MagneticRide';
import { HauntedMansion } from './components/HauntedMansion';
import { RiverRapids } from './components/RiverRapids';
import { MoonlitBarge } from './components/MoonlitBarge';
import { Helicycles } from './components/Helicycles';
import { MotionSimulator } from './components/MotionSimulator';
// each world's THREE named themed scenery pieces
import { NeonArch, SpeakerStack, MirrorBallPylon } from './components/PulseScenery';
import { GiantGear, SteamPipes, ClockTower } from './components/BrassworkScenery';
import { GiantToadstools, StandingStones, LanternTree } from './components/ThornwickScenery';
```

**The verdict is the measured table at the top of §3.1-A** — `ok: true`, 0 failures,
TWO expected non-fatal warnings, `gateWarningKinds {}`, and nothing else. Do not
re-derive it from this prose; re-run `probe-skeleton.mjs` over YOUR cells, because it
is your layout the §5c re-compose knows about, not ours.

**THE THREE FAILURES THIS SKELETON WAS DEBUGGED THROUGH** — all three
worlds-specific, all three invisible until you run the park:

| FAIL | cause | fix |
|---|---|---|
| `sim` "no guest completed a ride cycle in 85 sim-s" | hub-first layout put the nearest queue 40 u from the gate; the budget is 15 u target / 20 u practical max (32 u FAILS outright, ~24 u once a crowd stretches the dwell) | front world ON the gate street, hub off its side port |
| `scenery` "verge tree stands IN the street" | a boulevard T-junction: the crossing avenue's slab runs under this avenue's ±2.45 u verge trees | every junction cell in `avoid`, `clear: 2.6` (2.4 misses the trees by 5 cm) |
| `terrain` "built cell on a bulge" | a verge tree's keepDry cell landed on ground no probed seed could flatten | that cell in `avoid` too — or re-seed; do NOT widen the plot and hope |

## §3.1-B (SKELETON B, THE TREE) IS IN `rules/park-generation-tree-skeleton.md`

All rules files are injected, so it is already in front of you: B's node table, its
measured numbers, its placement slots, its declaration order. **A DIFFERENT file
from `rules/park-generation-skeletons-b.md`.**

## §3.1-N, §3.1-Y, §3.1-Z AND THE SET-PIECE CONTRACT ARE IN `rules/park-generation-skeletons-b.md`

Also in front of you, and three of its sections are worth points on THIS table:

- **§3.1-N** — the measured terrain/novelty verdict on transforming a published
  table (don't), and **STREET-RUN SUBDIVISION at L = 5.5 u**, the only terrain-safe
  way to move axis 15 (0 wet, 0 on a bulge, novelty 0.046, **6.37 / 7**).
- **§3.1-Y THE ATTACH-POINT RULE — a free +1.00 on axis 12.** Every queue tail,
  exit lane, stall front and restroom must attach to a street node whose solved
  `|nodeY| <= 0.05`. §3.1-A's unsafe nodes are exactly **{10, 11, 13, 26, 80, 82,
  84}**; **61 of its 87** are safe. Only the attach point moves.
- **§3.1-Z** — never ship a ride under its catalog `defaultName` (§3.1-A loses 0.07
  on axis 11 to `name="Maglev Glider"`); build one `tidewater` or `emberfall` world
  for **+0.25** on axis 16.

Plus the set-piece contract (`<FountainPlaza>`/`<Bazaar>`/`<Boulevard>` +
`buildParkNet`).

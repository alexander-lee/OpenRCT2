# Composing parks — §3.1-B SKELETON B, the TREE density class

Part of the recipe book, split off `rules/park-generation-skeletons.md` (which
carries §3.1, the three-skeleton comparison table and **§3.1-A, the hub-and-spokes**
table) because that file outgrew a single design-system write. Nothing was cut.
**This file is ONLY skeleton B.** Do not confuse it with
`rules/park-generation-skeletons-b.md`, which carries §3.1-N (why transcribing a
table cannot score) and the set-piece contract — every rules file is injected
together, so both are already in front of you.

**§3.1-A and §3.1-B are ALTERNATIVES, not a sequence.** Read the comparison table in
`-skeletons.md` first and pick ONE. **DO NOT "apply §3.1-N's transformations" — that
pointer is STALE.** Mirroring or rotating a published table is triple-fatal: the terrain
does not travel with it (measured 0.016 novelty, 21 out-of-bounds cells, 3 wet, 2 on a
bulge). §3.1-N now exists to say so. The one terrain-safe novelty lever is street-run
SUBDIVISION of the table you picked.
**Skeleton B ships ONE coaster and §4.0-E now requires two.** §3.1-A ships two; the
measured slot for skeleton B's second circuit is the FIRST section of this file.

## WHAT SKELETON B AND SKELETON C STILL NEED — THE SECOND COASTER

**WHAT SKELETON B NEEDS — measured, not proposed** (nine candidate placements
run through `probe-skeleton.mjs`; the table is in
`harness/park-eval/RUBRIC-baseline.md`):

| | value |
|---|---|
| archetype | **§4.0-C** (preferred) or §4.0-A — either is a different archetype from the shipped §4.0-B, and C's I 9.55 (`ratingBand` *intense*) pairs with B's I 6.25 (*thrilling*) — the DIFFERING-BAND test is `ratingBand`, never a hand-rolled threshold (§4.0-E) |
| `start` | **`[−2.4, 0.55, −38.4]`**, `heading: 0`, `type="steel"`, no `bank` prop |
| queue tail | `[3.6, −38.4]` (`start.x + 6.0`, same z) — **hang it off a junction as a STUB**, never on a through street. **APPROACH IT PERPENDICULAR TO ITS OWN LANE**, i.e. along x = 3.6 from the north/south — never along z = −38.4 from the west. The lane is collinear with the tail on the queue axis (`[tail − dir·(laneLenOf(cap) + 0.35), tail]`; at cap 6 that is `laneLenOf(6) 4.46 + 0.35 = 4.81`, so x[−1.21, 3.6] at z −38.4), and Rule 3 keeps every street ≥ 2.4 u off it — so a westward approach crosses the ride's own queue and a perpendicular one does not. Wave 18A read this row as unsatisfiable and took 2 `blockers` for it; it is satisfiable, the approach BEARING is the constraint. x 3.6 is clear of the station-leg keep-out x[−3.6, −1.2] |
| footprint | C: `x[−37.62, −2.40] z[−52.96, −16.16]` · A: `x[−40.01, −2.40] z[−54.13, −16.52]` |
| corridor keep-out (PLOT coords, §4.0-C table + start) | `x[−38.4, −36.0] z[−38.4, −24.0]` west valley · `x[−30.0, −14.4] z[−54.0, −51.6]` south valley · `x[−27.6, −12.0] z[−16.8, −15.6]` north valley · `x[−3.6, −1.2] z[−45.6, −31.2]` station leg (own ride, exempt) — re-derive from the §4.0-C offsets, publish it in the §0 header, and check every street node against it |
| terrain | `coasterPts={[...FLAG_PTS, ...FLAG2_PTS]}` — **both** sets. Measured: `reliefFloor.kept` **0.73** vs the 0.70 floor, `stdH` 0.72, water centroids moved **0 / 0**, no hard cell in composed water, worst span lift 0.35. **These nine placements were measured BEFORE the SOUTH-QUEUE REPAIR below, when the one-coaster baseline was kept 0.73; it is now kept 0.81 / `reliefFloor.stdH` 0.81, so re-run the four-number loop on the repaired table before you publish a start** — the ranking of the nine will hold, the absolute numbers will not |
| also required | **move `GHOST.pad` off `[−24, −27.98]`** — it stands inside the new rect; prefer §4.0-C over §4.0-A because A clears the `emberfall` world rect by only 0.79 u where C clears it by 3.18 u |
| still missing after that | skeleton B registers 4 circuits (Coaster, Monorail, Chairlift, PaddleBoats, GhostTrain = 5 with Ghost) — add **one never-used circuit** (`MagmaRun`, `GearworksExpress` and `Bassline` all belong to worlds skeleton B already builds, and all three compile their own default clean) to satisfy §4.0-E's novelty clause |

**WHAT SKELETON C NEEDS.** Its flagship sits at `[15.6, 0.55, −25.2]`, ~23 u
south of skeleton B's, so **the slot above is NOT transferable** — its
footprint `x[−13.32, 15.60] z[−38.47, −8.05]` already covers most of the south
block. The free blocks are the NORTH band (`z ≳ 20`) and the WEST band, and
**neither has been measured**: run the same four-number loop
(`reliefFloor.kept`, `stdH`, `centroid MOVED`, `in composed water`) on seed
107 alpine before publishing a start. Do not copy skeleton B's `[−2.4, −38.4]`
into skeleton C — different seed, different water, different flagship
position, and two of the nine placements measured on skeleton B failed on
water alone.

### 3.1-B SKELETON B — "THE NORTH PROMENADE AND THE THREE OUTER COURTS" (a TREE)

**THE SECOND VERIFIED TABLE. IT IS AN ALTERNATIVE TO §3.1-A, NOT ITS SUCCESSOR.**
Source: `harness/park-eval/samples/skeleton-b.tsx`, measured end to end.

**Its shape in one line:** a **NORTH PROMENADE OUTSIDE the ring**, **ONE descent
under the north beam**, **ONE east arterial**, and **ONE long west row** — a TREE
with **zero cycles**, the flagship standing in the free plot CENTRE those three
runs enclose. **No hub plaza. No cardinal avenues. No boulevards.** Every other
street is a short spur off one of those runs.

**MEASURED (seed 1, temperate, size 128):**

| | |
|---|---|
| gate | `validatePark → ok: true`, **0 failures**, **ONE non-fatal warning** (`pathLevelMedian` lint). `consoleSummary.gateWarningKinds` is **`{}`** — the `terrainFlattened` this table used to publish as unavoidable is **GONE**, see THE SOUTH TAIL note at the end |
| pipeline | `preflight.mjs` clean, `typecheck.mjs` clean |
| axis 15 layout uniqueness | **7.0 / 7** |
| novelty | `layout.novelty.distance` **0.092** (floor 0.08), nearest **r13b**, corpus 22 |
| axis 16 worlds | **5 / 5** — 3 declared / **3 BUILT**, 3 themed scenery pieces each, `crossTheme: []`, min centre separation 89.03 u (floor 32.66) |
| monorail | `everyWorldTouched: **true**`, 4 stations, **all queued and exit-connected**, `closureGap` 1.800, nothing synthesized |
| water | dominant and secondary centroids moved **0.0 u** from the pinned seed-1-temperate row |
| roster | **9 rides** / 12 stalls / 5 of 5 categories |
| terrain | axis 7 **9 / 9** — `terrain.stdH` **0.79** (size-128 band 0.75–1.5) · `reliefFloor.kept` **0.81** / `stdH` 0.81 / relief 8.71 against the 0.70 floor · `guardedRanges` 3 · total **93.40** |
| accessibility | `orphanIslands 0`, **96 / 96 nodes reachable** from the gate |
| shape scalars | **58** street nodes · **57** street edges · **438 u** of street · mean edge **7.68 u** · `gridRegularity` 0.51 · `effectiveClasses` 12.51 · `latticeNodeShare` 0.138 · 3 open spaces, `areaSpread` 1.86 · `quadrantSpread` 0.867 · `plotUtilisation` 0.96 |

**WHAT IT DELIBERATELY DOES NOT WIN.** A tree has `edges === nodes − 1` exactly
(95 / 96), so axis 2's *"cycles good"* read is not earned — skeleton B trades that
for axis 15. If you want both, add **one** cycle somewhere that does **not** run
past a monorail queue tail (see the dead-end rule below); the west row back up to
the promenade is the obvious place, and it costs one edge.

```tsx
// ── SEED, and the pinned row (§1: 1 temperate is RING-CLEAN, bit-identical) ──
const SEED = 1; const CLIMATE = 'temperate' as const; const SIZE = 128;

// ── THE GATE: OFF-CENTRE, which is itself part of the shape ─────────────────
const GATE: XZ = [-14.4, 63.6];        // not [0, 63.6] — §3.1-A's cell
//  nearest queue tail [-14.4, 57.6] = 6.0 u from the turnstile (budget 15 u safe)

// ── THE THREE THEMED BAZAARS (three DIFFERENT lengths, on purpose) ──────────
// `openSpace.areaSpread` wants ≥ 1.8 between the largest and smallest plaza;
// three identical 7-tile rows measure 1.0 and throw away half the axis-15 point.
const GLADE_ROW = bazaarPlan({
  id: 'gladeRow', title: 'Toadstool Market', position: [-52.8, 45.6],
  facing: { port: 'E', toward: [-43.2, 45.6] },
  stalls: ['cottonCandy', 'burger', 'soda'], theme: THORNWICK_GLADE, seed: 11,
});   // 3 slots → 7 tiles, aisle E/W · ports W [-57.6, 45.6] · E [-48.0, 45.6]
const PULSE_ROW = bazaarPlan({
  id: 'pulseRow', title: 'Neon Row', position: [57.6, 55.2],
  facing: { port: 'W', toward: [57.6, 45.6] },
  stalls: ['soda', 'cottonCandy', 'balloon', 'burger', 'hotDog', 'soda'],
  theme: PULSE_DISTRICT, seed: 7,
});   // 6 slots → 13 tiles, aisle N/S · ports W [57.6, 46.8] · E [57.6, 63.6]
const EMBER_ROW = bazaarPlan({
  id: 'emberRow', title: 'Caldera Market', position: [-48.0, -49.2],
  facing: { port: 'W', toward: [-48.0, -38.4] },
  stalls: ['hotDog', 'burger', 'soda'], theme: EMBERFALL_CALDERA, seed: 3,
});   // 3 slots → 7 tiles, aisle N/S · ports W [-48.0, -44.4] · E [-48.0, -54.0]

// ── THE STREET SKELETON — 27 authored cells, 29 edges, ZERO cycles ──────────
// THE TABLE FIXES THE *TAILS*, NOT THE *RIDES* (wave-18). Every entry used to name
// the ride KIND at its tail, so transcribing the table transcribed the ride
// SELECTION too — round 14's park A did exactly that and scored 0/1 on selection
// novelty, nine of nine kinds shared with another published skeleton. What a tail
// actually constrains is its OUT-DIRECTION and the CAPACITY the reach arithmetic
// needs, so that is all it records. Pick the rides from §2/§3's roster tables and
// check `catalogNeverUsed`: both published tables own their own 9-kind sets.
const NODES: XZ[] = [
  // ── the NORTH PROMENADE, OUTSIDE the ring (z 45.6, x −60 … +58) ──
  /*  0 */ GATE,            // [-14.4,  63.6]  +z rim, OFF-CENTRE
  /*  1 */ [-14.4, 57.6],   // TAIL (out +x, cap 8) — 6.0 u from the gate
  /*  2 */ [-14.4, 45.6],   // promenade × gate spine
  /*  3 */ [-43.2, 45.6],   // NW court (thornwick) — wires gladeRow:E
  /*  4 */ [-43.2, 50.4],   // TAIL (out +z, cap 8)
  /*  5 */ [24.0, 45.6],    // the ONE descent head
  /*  6 */ [57.6, 45.6],    // NE court (pulse) — wires pulseRow:W
  /*  7 */ [57.6, 33.6],    // TAIL (out -z, cap 12)
  // ── the EAST ARTERIAL (x 24.0), crossing UNDER the north beam 24 u clear
  //    of the North platform pad; node 8 is the ramp landing §0.6 wants ──
  /*  8 */ [24.0, 36.0],    // descent mid
  /*  9 */ [24.0, 27.6],    // arterial head — TAIL (out +x, cap 6)
  /* 10 */ [0.0, 27.6],     // RING NORTH queue tail — DEAD END, deck 6.6 u north
  /* 11 */ [24.0, 12.0],    // arterial mid — a SECOND ramp landing (the land dips
  //                           at z 27.6 and one 30-u span cannot descend it
  //                           inside the walkable grade — §0.6)
  /* 12 */ [24.0, -2.4],    // coaster tail junction
  /* 13 */ [21.6, -2.4],    // coaster queue tail = A_START.x + 6.0, same z
  /* 14 */ [24.0, -8.4],    // ring-east spur junction
  /* 15 */ [36.0, -8.4],    // RING EAST queue tail — DEAD END
  /* 16 */ [24.0, -19.2],   // the arterial's foot — the LONG WEST ROW starts here
  // ── the LONG WEST ROW (z −19.2), 2.4 u clear of the flagship's south valley
  //    and crossing UNDER the west beam 10.8 u clear of its pad ──
  /* 17 */ [12.0, -19.2],   // TAIL (out -z, cap 4)
  /* 18 */ [0.0, -19.2],    // west-row cell. THE OLD RING-SOUTH SPUR LEFT FROM HERE
  //                           and that is exactly what flattened the seed — a column
  //                           down x 0 crosses the composer's biggest ridge. Node 18
  //                           is now a plain degree-2 cell.
  /* 19 */ [0.0, -57.6],    // RING SOUTH queue tail — DEAD END. The South platform
  //                           queues OUTWARD, so the tail is 6.6 u SOUTH of the deck
  //                           [0, -51.0], and it is reached from 26 along the SOUTH
  //                           SHELF (z -57.6), never from node 18. See the note below.
  /* 20 */ [-24.0, -19.2],  // TAIL (out -z, cap 6)
  /* 21 */ [-36.0, -19.2],  // ring-west spur junction
  /* 22 */ [-36.0, -8.4],   // RING WEST queue tail — DEAD END
  /* 23 */ [-48.0, -19.2],  // west row end
  /* 24 */ [-48.0, -30.0],  // TAIL (out -x, cap 8)
  /* 25 */ [-48.0, -38.4],  // SW court (emberfall) — wires emberRow:W
  /* 26 */ [-48.0, -57.6],  // SOUTH SHELF head, off emberRow:E [-48.0, -54.0]. The
  //                           market's SECOND port was left as an UNWIRED STUB in the
  //                           published table; wiring it turns the aisle into the
  //                           through-street it was drawn as and costs no junction.
];
const EDGES: [NetRef, NetRef][] = [
  [0, 1], [1, 2],                                    // the gate spine
  [2, 3], ['gladeRow:E', 3], [3, 4],                 // NW promenade + glade row + spur
  [2, 5], [5, 6], ['pulseRow:W', 6], [6, 7],         // promenade east + pulse row + spur
  [5, 8], [8, 9],                                    // the descent under the north beam
  [9, 10],                                           // west to the ring N tail
  [9, 11], [11, 12], [12, 13], [12, 14], [14, 15],   // arterial + coaster tail + E tail
  [14, 16],
  [16, 17], [17, 18],                                // the west row
  [18, 20], [20, 21], [21, 22],                      // west row + the ring W tail
  [21, 23], [23, 24], [24, 25], ['emberRow:W', 25],  // west row end + SW court
  ['emberRow:E', 26], [26, 19],                      // the SOUTH SHELF -> the ring S tail
];
// bins: [[-15.6, 46.8], [22.8, 14.4], [-1.2, -20.4], [-46.8, -31.2]]

// ── THE FLAGSHIP: §4.0-B FAMILY rectangle, IN THE PLOT CORE ─────────────────
const A_START: V3 = [15.6, 0.55, -2.4];
const A_TAIL:  XZ = [21.6, -2.4];       // start.x + 6.0, same z — node 13 above
// queueDir [1, 0].  The circuit stands in the free PLOT CENTRE the three long
// runs enclose: x[-14.4..16.8] z[-16.8..15.6].
// CORRIDOR KEEP-OUT (§4.0-B at start [15.6, -2.4], PLOT coords) — every street
// node and every street EDGE is outside all five rects:
//   west valley  x[-14.4..-13.2] z[-8.4..8.4]
//   west valley  x[-12.0]        z[-7.2..8.4]
//   south valley x[-7.2..9.6]    z[-16.8..-14.4]
//   north valley x[-2.4..9.6]    z[13.2..15.6]
//   station leg  x[14.4..16.8]   z[-9.6..4.8]     (own ride — exempt)

// ── THE THREE WORLDS. Every rect REACHES THE BEAM CORRIDOR (see below) ──────
const GLADE_SC: XZ[] = [[-48.0, 52.8], [-56.4, 52.8], [-38.4, 52.8]];
const PULSE_SC: XZ[] = [[51.6, 51.6], [51.6, 60.0], [45.6, 52.8]];
const EMBER_SC: XZ[] = [[-54.0, -34.8], [-54.0, -42.0], [-43.2, -34.8]];
const cellsOf = (x0: number, x1: number, z0: number, z1: number): XZ[] => {
  const out: XZ[] = [];
  for (let x = x0; x <= x1 + 1e-6; x += 1.2) for (let z = z0; z <= z1 + 1e-6; z += 1.2) out.push([x, z]);
  return out;
};
const GLADE = worldPlan({
  id: 'thornwick', theme: THORNWICK_GLADE, pieces: [GLADE_ROW],
  rides: [{ at: SAUCERS.pad, name: 'Flying Saucers' }],
  include: [...GLADE_SC, ...cellsOf(-57.6, -38.4, 45.6, 56.4), [-38.4, 33.6], [-45.6, 33.6]],
});                                       //                     ↑ the reach cells
const PULSE = worldPlan({
  id: 'pulse', theme: PULSE_DISTRICT, pieces: [PULSE_ROW],
  rides: [{ at: DISCO.pad, name: 'Discotron' }],
  include: [...PULSE_SC, ...cellsOf(51.6, 62.4, 24.0, 61.2), [44.4, 33.6], [44.4, 24.0]],
});
const EMBER = worldPlan({
  id: 'emberfall', theme: EMBERFALL_CALDERA, pieces: [EMBER_ROW],
  rides: [{ at: ENTER.pad, name: 'Enterprise' }],
  include: [...EMBER_SC, ...cellsOf(-57.6, -43.2, -52.8, -28.8), [-43.2, -28.8]],
});
```

**THE PLACEMENT SLOTS (9 rides, 12 stalls, 5/5 categories). THE TABLE FIXES THE
TAILS, NOT THE RIDES.** Each flat ride is placed by the same `place` helper as
§3.1-A — the **`+ 2.4`** version above (skeleton B passes `NET` as an explicit first
argument instead of closing over it; either is fine, as long as it is the ONE fused
net) — off the tail named in the node table.

> **THIS TABLE USED TO PRINT THE 9 RIDE KINDS AND THEIR NAMES, AND THAT COST A
> POINT.** Transcribing it transcribed the ride SELECTION as well as the shape:
> round 14's park A did exactly that and scored **0/1 on selection novelty**, nine
> of nine kinds shared with another published skeleton. **Both published tables own
> their own 9-kind sets, and neither set is yours.** Pick from §2/§3's roster
> tables — deliberately including the never-used shelf — and check
> `catalogNeverUsed`. What the table below constrains is the TAIL, the
> OUT-DIRECTION and the CAPACITY the reach arithmetic needs.

| slot | category to fill | tail | `out` | cap |
|---|---|---|---|---:|
| flagship | thrill | node 13 `[21.6, −2.4]` (§4.0-B) | `queueDir [1,0]` | 4 |
| the ring | transport | `[−36, −8.4]` + 3 stations (§4.2-A) | published | 6 |
| near-gate | gentle | node 1 | `[1, 0]` | 8 |
| NW court | gentle | node 4 | `[0, 1]` | 8 |
| NE court | thrill | node 7 | `[0, −1]` | **12** |
| arterial head | transport / gentle | node 9 | `[1, 0]` | 6 |
| west row (shore) | **water** | node 17 | `[0, −1]` | 4 |
| west row (mid) | **dark** | node 20 | `[0, −1]` | 6 |
| SW court | thrill | node 24 | `[−1, 0]` | 8 |

**DECLARATION ORDER, which is not the reading order.** `place` reads `NET`, and
`worldPlan({ rides })` reads the pads `place` returns, so the file runs:

```
bazaar plans → ALL_PLANS → portCell + the cardinal throw → the port-ref/chain audit
  → assertNodesOffPieces → assertKeepDryOffRow → ONE buildParkNet
  → place() × 7 (the pads) → assertNodesOffPieces over the PADS
  → worldPlan × 3 (with the pads) → the ≥ 3-scenery-cells-per-world assert
  → §5c re-compose + the isDry/dry predicates → mount
```

**Skeleton B passes its three bazaars to `buildParkNet({ pieces: ALL_PLANS })` and
does NOT pass `worlds:`** — which satisfies the same requirement by the other
route: what matters is that every piece's interior sub-net is in the ONE fuse and
that every piece id has a `'<id>:<PORT>'` ref in `EDGES` (all three do). Use
`worlds:` when the world owns pieces you would otherwise have to list twice; use
`pieces:` when, as here, the world's only piece is already in `ALL_PLANS`. What is
NOT optional either way: **one fuse, and the same `NET` to `offPathCell` and
`<Paths>`.**

**THE FIVE MODULE-SCOPE ASSERTIONS ARE THE SAME FIVE AS §3.1-A** — `portCell` +
cardinal · the port-ref/chain audit · `assertNodesOffPieces` ·
`assertKeepDryOffRow` + the §5c re-compose · `place`'s reach check. Copy them from
§3.1-A; skeleton B ships them verbatim, in that order, with `buildParkNet` called
exactly once and `KEEP_DRY = [...RING_CELLS, ...GLADE_SC, ...PULSE_SC, ...EMBER_SC]`
(the ring, the world scenery and the amenity cells — **not** the node list).

**THE SIX SHAPE CONSTRAINTS THIS TABLE IS BUILT AROUND. Every one is measured, and
every one binds on your own table too.**

1. **THE RING'S FOUR QUEUE TAILS ARE DEAD ENDS BY CONSTRUCTION.** A street that
   continues one more cell along the lane axis past `[−36, −8.4]`, `[36, −8.4]` or
   `[0, −57.6]` runs through
   the platform pad 6.6 u further on — *`blockers`: street edge runs THROUGH …
   pad*, which is exactly how r12a failed. **Only the NORTH tail `[0, 27.6]` can be
   a through node**, because its deck is at `z 34.2` and a row along `z 27.6` passes
   under the beam and misses it. Skeleton B approaches W/N/E from the ring's
   INTERIOR and the SOUTH tail from OUTSIDE, along the south shelf, and terminates
   three of them.
2. **PUT THE FLAGSHIP IN THE PLOT CORE, NOT ON A FLANK.** The composition anchors
   its ranges on the FLANKS (`reliefBias inner` **0.18**), so `coasterPts` on a
   flank crushed three ranges at once: **kept 69 %** against the 70 % floor **AND**
   **stdH 0.69 < 0.76** → the CONJUNCTION fires and `terrainFlattened` is **FATAL**.
   Moving the circuit to the centre took kept to **73 %** and demoted the finding to
   a warning. A flagship in the gentle core costs almost no relief; a flagship on a
   flank costs the park.
3. **A COASTER QUEUE *LANE* LAID ACROSS A STREET COSTS SIX FAILURES, NOT ONE.** A
   lane running through the arterial at `x 24.0` produced **2 `blockers` on its own
   railings PLUS 4 more** — every downstream ride's tail *"reachable only THROUGH a
   solid object"* — because the railing severed the single route to the whole south
   half. The lane is a SOLID, not a path. **RULE: compute the lane span
   `[tail − dir·(laneLenOf(cap) + 0.35), tail]` and keep every street ≥ 2.4 u off
   it.** Skeleton B's coaster lane runs `x 17.9 … 21.6`, i.e. 2.4 u clear of the
   arterial at `x 24.0` — which is *why* the tail is a stub off node 12 rather than
   a node on the arterial itself.
4. **`reach = minReachOf(cap) + 1.2` IS NOT ENOUGH — AUTHOR `+ 2.4`.** At cap 12
   the pad landed **9.54 u** from its tail against the audited **9.74 u** floor and
   took *`footprints`: entrance hut overlaps boardPoint pad*. A `composableRide`'s
   boardPoint sits at `position` + rotated **`layout.board`**, and local +z is the
   face the queue runs into — i.e. it sits **nearer the tail** than `position` does
   (1.40 u for `<Discotron>`). Author `minReachOf(cap) + 2.4` and
   `assert(got >= minReachOf(cap) + 1.2)`; the code is in §0.0 step 7.
5. **`assertKeepDryOffRow` IS A SIEVE, NOT THE AUTHORITY.** The published basin
   BOXES are narrower than the real basins: seed 1's secondary box is
   `x[−56…−21]`, but its bowls reach **`x −18.1`**, so a column at `x −19.2`
   crossing `z 23…39` clears the sieve, throws nothing, and still moves the body
   **25 u** (`waterRePicked`). **The §5c re-compose is the authority; the sieve is a
   fast pre-filter.** Ship both.
6. **EVERY WORLD RECT MUST REACH THE BEAM CORRIDOR.** `probe.mjs` walks the
   monorail group's bounding-box **PERIMETER**, so a world entirely outside
   `x ±44` / `z −52.8…36` reads `worldsTouched: 1` however grand it is. Fix: **one
   `include` cell aimed at the ring** (e.g. `[-38.4, 33.6]`). `include` cells are
   not placements, nothing is built on them and they are **not guarded**, so this
   costs nothing at all — see the three `include` lists above.

> ## THE SOUTH TAIL IS OUTSIDE THE RING, AND THAT IS THE WHOLE `terrainFlattened` FIX
>
> **THIS TABLE USED TO PUBLISH A NON-FATAL `terrainFlattened` AS UNAVOIDABLE ON
> SEED 1 TEMPERATE. THAT WAS WRONG AND IT IS NOW FIXED — do not "restore" the old
> spur, and do not accept the warning as "the documented ring-park warning".**
>
> The old table hung the South tail INWARD at `[0, −44.4]` off node 18, so the spur
> `18 → 19` paved `[0, −42.0]` and `[0, −43.2]` on its way down — **5.3–5.8 u** from
> the summit of the composer's biggest range. The guard list flattened it
> (**h 8.59 → 0.83**, its neighbour 5.93 → 1.50), which is `reliefFloor.kept`
> **0.73** and `terrain.stdH` **0.71** — under axis 7's **0.75** floor, for
> **1.5 points**.
>
> **THE REPAIR: the SOUTH platform queues OUTWARD** (tail `[0, −57.6]`,
> `queueDir [0, −1]`) and is reached `emberRow:E → 26 → 19`, through the Caldera
> Market aisle at `x −48.0` and east along the SOUTH SHELF at `z −57.6`. Every cell
> of that approach is **≥ 14.7 u** off the summit, it never crosses the beam (the
> aisle is WEST of the ring's west side and the shelf is SOUTH of its south side),
> and the tree stays a tree: still exactly `n − 1` (**58 / 57**), zero cycles, node
> 18 simply drops to degree 2. **MEASURED: `terrain.stdH` 0.71 → 0.79,
> `reliefFloor.kept` 0.73 → 0.81, relief **8.71** (authored 10.49), the warning GONE
> (`gateWarningKinds {}`), axis 7 7.5/9 → 9/9, total 91.90 → 93.40**, all fifteen
> other axes unchanged and `ok: true` / 0 failures preserved.
>
> **THE RESIDUE, AND WHY IT IS THE CEILING.** `capPeakForCells(p, keep, 0.35)`
> shaves a peak to `0.35 / s(d)`, so **a guard cell must stand ≥ 10.62 u from a
> summit to cost that peak nothing.** The ring's own South deck `[0, −51.0]` is
> **9.70 u** out and the pose is published, so **3.45 of the 8.59 still goes** —
> that is this pose's ceiling and it is enough. **Do NOT chase the remainder by
> shifting the ring west:** it drops the West deck 4.2 u inside a world rect and
> trades "0 foreign pieces" for terrain.
>
> **AND THE PUBLISHED RANGE BOXES FOR THIS ROW ARE THE *UNGUARDED* COMPOSITION —
> NEVER PLAN A CLEARANCE OFF THEM.** With a dense 128 layout no slot in
> `composeHills`' jittered ring can offer the 19.2 u guard-free disc the primary
> range wants, so it falls through to a **guard-BLIND phase-1 fallback walk**: a
> FIVE-PEAK RIDGE along **z ≈ −43**, summit **(5.33, −42.89) h 8.59 r 12.09**,
> peaks at x −13.8 / −5.8 / +5.3 / +19.2 / +29.9, **byte-identical in two parks
> with completely different guard clouds.** You cannot move it by authoring around
> it — the gap the boxes leave at x ≈ 0 is exactly where the summit lands — and its
> skirt is CONTINUOUS from **x −23 to x +38.6**, so the only dry southbound
> corridors are `x ≤ −23` and `x ≥ +38.6`, the second being the SE lake.
> **Route down x ≤ −23**, which is what the `x −48.0` market aisle does.
>
> If you would rather not think about any of this, pin **31 temperate** (§1's
> ring-clearance table): its guarded relief 12.02 / stdH 1.32 sits ABOVE the
> published band, so `terrainFlattened` cannot fire there at all — and its 13 % SW
> lake forces a different plan, which is novelty you were going to have to find
> anyway.


---


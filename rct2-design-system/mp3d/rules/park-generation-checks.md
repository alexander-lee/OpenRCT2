# Composing parks — §0 PRE-FLIGHT CHECKLIST

> **⚠ A `§` OR A FILE PATH HERE IS PROVENANCE, NOT A LOOKUP — §0.0-F.** You have no
> filesystem while authoring; round 13's park A searched for these very files, found
> nothing, and improvised the mandatory monorail with two props that do not exist.
> Every block a park needs is inlined at its point of use. **If a block is not in
> front of you, use only what is — never reconstruct one from memory.**

Part of the recipe book. Read `rules/park-generation.md` FIRST for §0.0 (the
one-line brief) and §0.0b (what "cool" means as numbers); this file is the
arithmetic those steps must satisfy. **Checks 15-27 continue in
`-checks-b.md`.** `-composition.md` carries §1 (the seed table and the
ring-clearance table), `-worlds.md` §2-§3.1 (including **both** verified
skeletons), `-rides.md` §4, `-validation.md` §5-§7. One document, seven files.

**Do every check below before you call a park finished.** Each one exists
because a generated park lost measurable points by skipping it.

## 0. PRE-FLIGHT CHECKLIST (do this arithmetic before finishing)

You cannot run code or read the console — every check here is STATIC: do it
on paper BEFORE you call the park done. **FATAL-WARNINGS POLICY: any
`validatePark` failure, guard-probe rejection, grid warning, closure warning
or `placeAccess` warning is FATAL — re-lay the layout on ANY of them. Never
ship over a warning, never rationalise one.**

**AND "FATAL" IS A POINT COST, NOT A THREAT — HERE IS THE PRICE LIST.** The word
FATAL is routinely disbelieved because the runtime contradicts it: the page still
renders, the park still opens, so an author concludes the policy is advisory.
Round-11's park B wrote it down: *"the rules say warnings are 'fatal by policy'
but the actual runtime still renders… I'll accept the tool renders regardless."*
It rendered, and it scored **68.7**. The renderer is not the scorer. **MEASURED
costs, out of 100:**

| what you shipped over | what it cost |
|---|--:|
| **an INVALID PROP VALUE on a ride** (e.g. `colours="fire"`) — throws inside the Stage build callback | **THE WHOLE PARK: ~−40, a 15/100.** No `__stageApi`, no `validatePark` line, nothing registered, nothing rendered (check 22) |
| a FATAL coaster/flume compile (translucent red, never registers) | **−7.0** on thrill, **−0.5** on roster, plus its whole category |
| `declared: 0` worlds — themed content, no `<World>` region mounted | **−5.0** |
| `<Paths>` with no `plazas` | **−2.75** |
| `deadStreetNode`s (a star of degree-1 spurs) | **−2.0** |
| each `causewayEdge` ("deck unreachable") | **−1.0 each** |
| no monorail | **−1.0** + an empty TRANSPORT category — **and at size >= 64 `preflight.mjs` refuses to bundle at all**, so the real cost is the whole round |
| a `footprints`/`corridor` FAIL anywhere | **caps ride spacing at 0/8** |
| each `crossTheme` piece | **−0.5 each** |

Warnings are fatal because they are EXPENSIVE, and the price is paid whether or
not the frame looks fine.

> ### RULE ZERO — SHIP A WHOLE PARK, THEN REFINE IT
> **Write the COMPLETE park file first — every district, every ride, every
> stall, the JSX and the plan module — and only then go back over this
> checklist.** A shipped park with a flaw is scorable and fixable; an
> unshipped perfect plan scores ZERO. Round 8 burned two full generation turns
> re-deriving corridor clearances and reading docs, and left the app as a
> placeholder: no park, no report, no score. Budget your effort as
> *draft the park → run the checklist → fix what it names*, in that order.
>
> ### PLAN BUILDERS DEGRADE — THEY NEVER THROW (wave-9)
> Your set-piece plans and your `buildParkNet` call run at MODULE SCOPE, before
> React mounts anything, so a `throw` there takes the WHOLE PAGE with it: both
> round-8 parks died exactly that way (one diagonal avenue each → black frame,
> no `validatePark` line, unscoreable, 3.5/100). Every plan builder now
> DEGRADES and records a §0-FATAL **plan lint** instead
> (`components/ParkBuilder/planLints.ts`): a diagonal `boulevardPlan` is
> re-routed as an L through a corner node, an unknown port falls back to a real
> one, a bad edge endpoint is dropped, a missing `NET.node` cell resolves to the
> nearest node. `<Park>` replays those lints into `validatePark`, so the park
> still RENDERS and still FAILS — with a diagnosable report. **A plan lint in
> your console output means the park you shipped is not the park you designed:
> fix the coordinate, don't accept the degraded shape.**

1. **Bounds** — sum piece lengths and placements on paper USING THE RUN-LENGTH
   TABLE (§4): every coaster piece, pad, hut and queue lane inside ±size/2
   (the DEFAULT plot is **128** since 2026-07 → x,z ∈ [-64, 64]; wave 8's 192 →
   [-96, 96]; the old 48
   default → [-24, 24]; a compact size-16 park → [-8, 8]). Lifts/drops run FAR
   longer than they look (≈ 1.6 + 3.9×height — round-2 parks underestimated
   ~1.5× and broke). On the default plot bounds are almost NEVER the binding
   constraint — the whole §4.0 flagship shelf fits inside a fifth of the plot's
   width — the binding constraints are SPREAD and WALKING DISTANCE (§0.3).
2. **Closure = HEADING ALIGNMENT, not aim** — the LAST authored piece must
   leave the cursor (a) heading within ~30° of the STATION ENTRY STRAIGHT's
   heading (the direction you LEFT the station on) AND (b) within ~3 u of the
   station start. Merely POINTING at the station from mid-park is wrong —
   your heading is then ~180° off, the compiler synthesizes a long Dubins
   return loop (radius 2.2 for coasters), and a synthesized closure over 40%
   of the authored length is FATAL (translucent red track, no registration).
   Worked example + verified archetypes: §4.
3. **Ride pitch + USE THE LAND** — footprint table below: capacity-4 rides
   on adjacent street nodes need centre-to-centre ≥ 6 units (the MINIMUM,
   unchanged at any size). But the default plot is EXPANSIVE (**128** — 64
   16-parks of area, `(128/16)²`; it was 192/144 until the 2026-07 rescale,
   which took a THIRD off every edge because the land read as an empty field): don't huddle at the minimum pitch around
   one plaza. Lay out DISTRICTS (3-5 themed lands + the hub, §3) linked by
   long approach boulevards, give every ride breathing room, and put the
   coaster out in its own meadow. **8+ rides are expected on a default plot**
   — a 3-ride cluster reads abandoned, not cosy. (Derivation, not a guess: the
   old "4+" floor was set against a 48 plot's whole 2 304 u². On a 128 the
   land a guest will actually reach inside the acceptance sim — see the
   GATE-REACH BAND below — measures **4 368-7 271 u², p50 6 633**
   (`harness/park-eval/probe-buildable.mjs --size=128`), i.e. ~2.9× the ENTIRE
   old plot. 8+ rides is therefore still a LOWER density than the old floor.)

   **DISTRICT OCCUPANCY — the static check (round-7, RE-DERIVED for 128 in
   2026-07).** The old check was "draw the four quadrants (each 24 × 24 on a
   48) and require at least 3 of the 4 to hold something built". **That check
   is retired on plots > 48, because it no longer discriminates.** Measured
   over all 16 published §1 rows at 128
   (`node harness/park-eval/probe-buildable.mjs --size=128`): **49.3-85.4% of
   the plot (p50 76.8%) passes the dry + `flatEnough` + peak-keep-out tests, and
   every one of the four 64 × 64 quadrants has 34.5-94.5% of ITSELF buildable on
   every row (16/16 rows have all four quadrants open).** The floor dropped from
   77% to 49% with the 2026-07 relief work — the three `badlands` seeds (5 alpine,
   42 alpine, 19 desert) are genuinely steep country now — but all four quadrants
   are still open on every row, which is the only thing this check ever tested. So "3 of 4 quadrants
   hold something" is satisfied by three benches and cannot fail a park that
   deserves to fail. Water and mountains never take a quadrant off the table
   at 128 — they only move where INSIDE it you build.

   What DOES bind at 128 is WALKING DISTANCE, and it binds hard. Use these
   four checks instead:

   1. **GATE PROXIMITY (the hard one).** This binds the NEAREST ride's queue
      TAIL only — whichever queue is closest to the gate, the one that has to
      carry the **85-s** smoke window — not every ride in the park. A park may
      have queues sitting at 40-70 u elsewhere and still pass `sim` (round-9
      and round-10 both shipped exactly that), PROVIDED the nearest one clears
      this floor. That nearest queue TAIL must sit **within 15 u of the gate
      cell**, street-graph distance. **RE-MEASURED 2026-07-28** for the
      BOARDING-QUIET departure rule (`GameManager/Context.md` "THE DEPARTURE
      RULE": a ride now holds the doors ~10-12 s for a second guest instead of
      bolting the instant the first one sits down, so every first cycle lands
      ~13 s later) and for `SIM_SMOKE_SECONDS` 60 → **85**, which was raised off
      these same numbers. `node harness/park-eval/probe-sim-reach.mjs`
      (capacity 8, `rideDuration` 10, 12 guests, the real GameManager):

      | gate→tail | first cycle | margin in the 85-s window |
      |---|---|---|
      | 6 u | 46.0 s | +39.0 s |
      | 12 u | 55.0 s | +30.0 s |
      | **15 u (this floor)** | **62.0 s** | **+23.0 s** |
      | 18 u | 64.5 s | +20.5 s |
      | 20 u | 68.5 s | +16.5 s |
      | 24 u | 74.0 s | +11.0 s |
      | 30 u | 82.5 s | +2.5 s |
      | 32 u | 87.0 s | **FAILS** |

      Every extra unit of walk costs **1.52 sim-s** (fixed overhead 37.5 s).
      The old figures this table replaces — 49.0 s at 15 u, 57.5 s at 20 u,
      64.0 s at 24 u, 2.68 s/u, all against a 60-s window — described the
      pre-2026-07-28 departure rule and are dead. **Keep the 15 u floor**: it
      now carries 23 s of margin at 12 guests and 11.5 s in its worst crowd
      (below), which is the first time this floor has had real margin at all.
      This is still a HARD floor, not a preference: **past ~72 u no window
      length rescues it** — at 72 u/80 u/96 u every guest ends in
      `leavingPark` and `riddenTotal` stays **0 even at 600 sim-s**, with a
      burger stand, a soda stand and a restroom on the route (they run out of
      patience before they arrive). So you cannot buy your way out by making
      the sim longer; put a real ride beside the gate.

      **A BIGGER CROWD NOW MAKES THIS HARDER, NOT EASIER — this reversed on
      2026-07-28.** It used to relax the bound (more guests reach the queue
      sooner). Under the boarding-quiet rule every boarding RE-ARMS the quiet
      window, so a crowd stretches the dwell to its `maxWait` cap and the first
      cycle lands LATER. Re-measured (`node
      harness/park-eval/probe-gate-stream.mjs gate --guests=12,22,50,75,100
      --d=6,15,18,20,24`, 6 rides, `rideDuration` 10) — first completed cycle,
      worst cell per distance across 12/22/50/75/100 guests, arrivals off and on:

      | gate→tail | 12 | 22 | 50 | 75 | 100 | worst |
      |---|---|---|---|---|---|---|
      | 6 u | 42.0 | 51.0 | 55.5 | 54.0 | 53.0 | 55.5 s |
      | **15 u** | 60.0 | 72.0 | 73.5 | 63.0 | 72.0 | **73.5 s** |
      | 18 u | 63.0 | 74.0 | 68.0 | 66.0 | 74.5 | 74.5 s |
      | 20 u | 66.5 | 77.5 | 71.0 | 69.5 | 71.0 | 77.5 s |
      | 24 u | 74.0 | 82.0 | 76.0 | 74.0 | 75.5 | 82.0 s |

      Every cell passes the 85-s window. **This crowd table, not the 12-guest
      sweep, is what set `SIM_SMOKE_SECONDS`** — at the old 60 s the 15-u floor
      measured 60.0 s at 22 guests, i.e. exactly 0.0 s of margin, so the floor
      this document published was already knife-edge before the rule changed.
      The 15-u rule stands unchanged; it is set by WALKING SPEED, and the crowd
      only decides how much of the window the DWELL then eats.
   2. **THE GATE-REACH BAND — IT CONSTRAINS *RIDES*, NOT THE PARK.**
      Everything a guest visits inside the smoke run lies within ~75 u of the
      gate. The gate sits on the +z edge at
      `z = 1.2·round((size/2 − 0.8)/1.2)` = **63.6 on a 128**, so that band is
      the 75-u disc clipped to the plot: **x ∈ [−75, 75], z ∈ [19.8, 94.8] —
      150 u wide × 75 u deep.** Put every RIDE STATION and QUEUE TAIL, your hub,
      your first ride and your stalls IN IT, so the sim can complete a cycle.

      **DO NOT READ THAT BAND AS A BUILD ENVELOPE. It is a floor on what must
      be inside, never a ceiling on what may be outside**, and treating it as a
      hard envelope is worth about −3 points across axes 2 and 15. Round 9's
      park A hard-coded `if (pz < 24 || pz > 92) return false` into its scatter
      guard, so *nothing at all* — not one tree, not one path node — landed
      south of z ≈ 24 on a 192 plot (that park predates the 128 rescale). It scored `quadrantCounts [0, 0, 20, 114]`,
      `plotUtilisation 0.302`, `pathExtentFraction 0.131`: two dead quadrants
      and 13% of the plot, on a park that had obeyed every sentence above.

      **The numbers you are actually aimed at** (`layout.plot` in
      `probe.json`; scorer `harness/park-eval/score-layout.mjs`; measurement
      `node harness/park-eval/probe-layout-thresholds.mjs --plot`):

      | metric | full credit | half | briarwood shipped |
      |---|---|---|---|
      | `plotUtilisation` | **≥ 0.70** | ≥ 0.45 | 0.302 |
      | `pathExtentFraction` (street-node bbox area / size²) | ≥ **0.55** | — | 0.131 |
      | `occupancyFraction` (8×8 coarse grid, 24-u cells) | ≥ **0.35** | — | 0.172 |
      | `quadrantSpread` = (1 − biggest quadrant share)/0.75 | ≥ **0.75** | — | 0.199 |

      `plotUtilisation = 0.4·min(1, ext/0.55) + 0.3·min(1, occ/0.35) + 0.3·quadrantSpread`.
      A FEATURE is a **street node, ride, stall or plaza rect — trees and
      scenery do not count**, so "I dressed the south with a grove" moves
      nothing. Measured: a park confined to the band tops out at
      **plotUtilisation 0.722** in the degenerate limit where its street net
      spans the band exactly edge to edge, and **~0.66** in practice, because
      the band starts at z = 19.8 and two of the four quadrants are empty by
      construction (`quadrantSpread ≤ 0.667`). Push the street net down to
      z = 0 and it reads **0.78**; to z = −40 and it reads **0.96**.

      So, deliberately, OUTSIDE the band: **secondary districts, boulevards,
      satellite attractions (a viewpoint, a bandstand, a shoreline promenade
      with a stall on it), plazas and the street LOOP that reaches them.** A
      satellite district only needs a path and a plaza to score; it does not
      need a ride, and a ride out there would break check 1. Anchor them on the
      composed BUILD FIELDS of the seed row you shipped — §1's **"flat build
      fields"** column, the `comp.landZones` meadow discs with `use` = the
      radius actually inside the plot — rather than on empty coordinates.
      Round 9's park B abandoned its whole southern half to dodge seed 7
      coastal's river, and TWO of that row's three published build fields
      ((−85.6, −86.0) and (−86.0, −22.7)) sit in the half it abandoned.
   3. **SPREAD, measured on the band (this replaces the quadrant check).**
      Take the bounding box of everything you BUILD — pads, plazas, street
      nodes, queue lanes. It must span **≥ 70 u in x and ≥ 45 u in z** on a
      128. (Derivation: ≥ 55% of the band's width and ≥ 60% of its 75-u depth.
      The band is ±75 u of gate reach, so on a 192 plot it is 150 u wide and the
      floor was 82 u; on a **128 plot the band CLIPS TO THE PLOT** — 128 u wide —
      and 55% of that is 70 u. The z floor does not move: the band's 75-u depth
      is a walking bound, not a plot fraction. A 3-ride huddle measures ~30 × 25 and fails both; a hub + three
      districts + a coaster meadow clears both easily.) Also keep **no single
      district holding more than half your rides** — unchanged, it never
      depended on the plot size.

      **70 × 45 IS A FLOOR ON THE RIDES, NOT A TARGET FOR THE PARK.** It is
      derived from the band, so clearing it and stopping there is exactly the
      round-9 failure: park A measured 113 × 75, passed this check twice over,
      and still scored `plotUtilisation 0.302` because the STREET-NODE bbox —
      the thing axis 15 measures — was only 78 × 62 (`pathExtentFraction`
      0.131 against a 0.55 target). Clear 82 × 45 with the rides, then aim the
      street net at check 2's table.
   4. **DISTRICT SEPARATION — ≥ 32.7 u between district centres on a 128**
      (**≥ 20 u on a 48**; the general form is **`20·√(size/48)`**).
      **Do NOT read the old "≥ 20 u" as a plot fraction and multiply it by 4.**
      It was never a fraction: it came from district FOOTPRINTS. Two adjacent
      districts are each ~30 u across at 128 (the §4.0-A flagship ring alone is
      37.6 × 37.6; a hub + 3 flats is ~25-30 u; MEASURED district diameters in
      the sample corpus run 19.4-23.0 u), so the centres must clear 15 + 15 u of
      footprint plus a real approach boulevard (≥ 8 lattice cells ≈ 9.6 u) →
      **≥ 40 u**. The old ≥ 20 u is the SAME arithmetic with a 48 plot's ~16-u
      districts. A blind ×4 to ≥ 80 u is REFUTED BY MEASUREMENT
      (`node harness/park-eval/probe-layout-thresholds.mjs --feasible`): inside
      the 75-u gate-reach band, once each centre is given its own footprint, the
      largest MUTUAL separation three centres can reach is **75.0 u**, four
      **60.2 u** and five **54.1 u** — so an 80-u rule would mandate a park the
      acceptance sim cannot ride. At 40 u a four-district park still has 20 u of
      slack.

      **THIS IS THE FIGURE THE SCORER USES, and it is now the same number in
      both places.** `harness/park-eval/layout.mjs` publishes
      `districtSeparationFloor(size)` = `20·√(size/48)` (**32.66 u @128**, 40 @192) and
      `districtClusterCut(size)` = `0.6·floor` (**19.6 u @128**, 24 @192) — the distance below
      which two rides count as the SAME district — and `score-layout.mjs` /
      `RUBRIC.md` axis 15 read them from there. Two consequences for you:
      *  Two rides **less than 19.6 u apart at 128 are ONE district** to the
         scorer, however you label them in your header. A "district" whose
         nearest neighbour ride belongs to the district next door is not one.
      *  The scored test is the WIDEST pair of district centres against the
         40-u floor, so obeying this rule cannot cost you the point — but the
         report also prints an advisory when your CLOSEST pair is under the
         floor. Check EVERY pair, not just each district against the hub:
         round 9's park A checked all four districts against the hub (42/43/40 u,
         all fine) and never noticed that its WEST and SOUTH lands were 24 u
         apart at the rides.

      **SO LIST ALL k(k−1)/2 PAIRS, SORTED, AND MARK THE CLOSEST — THE FLOOR
      APPLIES TO THAT ONE.** Three districts is THREE pairs, four is SIX, five is
      TEN; a header carrying fewer numbers than pairs has not done this check.
      Each pair is written as the actual distance `√(Δx² + Δz²)` — not as an axis
      difference, and not as a claim. Wave-12's six-word-brief park wrote
      *"centre separation 51 / 65 / 69 u ✓"* and its real `minCentre` was
      **17.28 u**: two of its three worlds were ONE district to the scorer
      (17.28 < the 19.6-u cluster cut), which is most of a 5-point axis.

      **AND CENTRES APART IS NOT ENOUGH — THE RECTS NEED A NON-ZERO DRY GAP.**
      Two world/district RECTS that TOUCH are one place, whatever their centres
      measure: the same park shipped `minGap 0`, rects sharing an edge, and
      `worldAt` then resolves pieces into whichever rect is smaller and
      manufactures `crossTheme` findings out of correct content (§3). So compute
      the rect-to-rect gap as well — `max(0, |Δcentre| − half_a − half_b)` on each
      axis — require it **> 0 on at least one axis for every pair** (aim ≥ 2.4 u,
      two lattice cells, so the margin the planners add cannot close it), and put
      the minimum in the header beside the pair list.

   On plots **≤ 48** the classic quadrant check still applies unchanged — the
   whole plot is inside the 75-u gate-reach band there, so quadrant occupancy
   and walking distance say the same thing (`<DistrictPark>`, the size-48
   worked example, keeps a gentle flat ~7 u off the gate street for exactly
   this reason).
4. **Queue tail — YOU CONSTRUCT IT, YOU DO NOT VERIFY IT AFTERWARDS.** The tail
   is an AUTHORED STREET NODE that exists before the ride does, and the pad is
   DERIVED FROM IT — see **THE CONSTRUCTION**, below, which is the operative rule
   of this whole check; everything before it is the arithmetic it is built on. The
   reach
   is **`front + laneLenOf(capacity) + 0.35`** where
   **`laneLenOf(c) = max(2.2, 1.1 + 0.56·c)`** and `front` = 1.8 by default
   (`RideLayout.front`, auto-raised to `padFront + 1.27` on a compact rig, cap
   6.5). **THE CODE IS TRUTH** — `ParkBuilder/placement.ts:79`. The old
   documented `1.8 + 0.35·c + 0.35` was WRONG and under-reported the reach by
   up to 3 u, which is why round-7 planned 6.0-u tails for capacity-10 rides
   and collected a `laneTrim` warning on every one of them.

   | capacity | `laneLenOf` | tail reach at `front` 1.8 | MIN tail → pad centre | slots |
   |---|---|---|---|---|
   | 4 | 3.34 | **5.49** | **5.26** | 10 |
   | 6 | 4.46 | 6.61 | 6.38 | 14 |
   | 8 | 5.58 | 7.73 | 7.50 | 18 |
   | 10 | 6.70 | **8.85** | **8.62** | 22 |

   **THE TAIL → PAD MINIMUM — the constant this section documented for the HEAD
   and never for the PAD.** The reach column is measured from the ride ORIGIN, and
   the origin coincides with the `boardPoint` pad centre **only while `layout.board`
   is the default `[0, 0.25, 0]`** — several rigs override it (`<Discotron>` ships
   `board: [0, STAGE_H, 1.4]`), and then the pad the validator SATs sits
   `board.z` NEARER the tail than `position`, because local +z is the face the queue
   runs into. So those numbers are the DEFAULT, not the floor, and the floor is
   enforced against the boardPoint, not against your `position`. The floor
   `placeAccess` enforces is:

   ```
   tail → pad centre  >  laneLenOf(capacity) + 0.35 + 0.62 + 0.50 + 0.45
                       =  laneLenOf(capacity) + 1.92        // the MIN column
   //  0.35  join      — tail = anchor + dir·(laneLenOf(capacity) + 0.35)
   //  0.62  entrance-hut offset BEHIND the head  (registry.ts: anchor − 0.62·dir)
   //  0.50  hut half-depth                       (hutRect hz, access.ts:115)
   //  0.45  audited boardPoint pad half          (padRect hx = hz = 0.45)
   ```

   — equivalently **pad → `anchor` (the head) ≥ 1.57 u**, which the default
   `front` 1.8 clears by 0.23. Both the LANE *and* the entrance HUT are SAT-ed
   against the pad, so every term is load-bearing, and SAT counts TOUCHING as a
   collision. **`MIN + 0.05` IS NOT AN ACCEPTABLE MARGIN — author `MIN + 2.4`** (the
   AUTHOR column below) and assert `MIN + 1.2`: `offPathCell` can pull the candidate
   inward by a whole cell, and the rig's own `board` offset eats another 1.4 u on a
   `<Discotron>`.

   **THE HEAD-ANCHOR FORMULA PLACES THE LANE ONLY; IT DOES NOT PROTECT THE PAD.**
   `anchor = tail − dir·(laneLenOf(capacity) + 0.35)` says nothing whatever about
   where the machine stands. Worked example, capacity 10 (wave-10's Stormhollow,
   which used the head formula correctly): `laneLenOf(10)` = 6.70, so lane + join
   own the first **7.05 u** off the tail — and the park put its pad **6.0 u** out,
   1.05 u INSIDE its own lane, on every ride. **10 `footprints` FAILs**, one per
   ride, every one "its own queue lane overlaps its own boardPoint pad", and 0/8
   on ride spacing.

   ##### THE CONSTRUCTION — build the queue from the TAIL out. This is not a check.

   Everything above is arithmetic you can pass and still fail, because it is
   phrased as something to VERIFY once the ride is placed. Do it the other way
   round. **The tail is a design decision you make FIRST**, and every other
   number falls out of it:

   ```tsx
   // 1. THE TAIL IS AN AUTHORED STREET NODE. It goes in NODES before the ride exists.
   const TC_TAIL: XZ = [0, 7.2];                    // ← a real member of NODES
   const OUT:     XZ = [1, 0];                      // unit dir TAIL → ride, cardinal
   // 2. DERIVE, in this order. laneLenOf(4) = 3.34 → join 3.69.
   //    anchor = TAIL + OUT·(laneLenOf(c) + 0.35)          = [3.69, 7.2]
   //    pad    = the CANDIDATE below, PUT THROUGH offPathCell — never the raw sum:
   const CAND: XZ = [TC_TAIL[0] + OUT[0] * (laneLenOf(4) + 0.35 + 1.8),   // front 1.8
                     TC_TAIL[1] + OUT[1] * (laneLenOf(4) + 0.35 + 1.8)];  // = [5.49, 7.2]
   const TC_PAD = offPathCell(NET, CAND, { clear: padMarginOf(rig) }) ?? CAND;  // ← USE THE RESULT
   // (a null return means the skeleton is too dense there — RE-PLAN the streets,
   //  §0.19; the ?? fallback exists so the module still evaluates while you do)
   //    dir    = −OUT                                      = [-1, 0]
   <Teacups position={TC_PAD} rotation={-Math.PI / 2}
            register={{ name: 'Willow Teacups', capacity: 4, rideDuration: 8 }}
            queue={{ anchor: [3.69, 7.2], dir: [-1, 0] }} />
   ```

   **THE PAD IS NOT `tail + dir·laneLenOf(cap)`, AND IT IS NOT THE RAW SUM
   EITHER.** `tail + dir·laneLenOf(cap)` keeps the pad **on the tail's own lattice
   column — i.e. ON the street you just hung the tail off**; even the correct
   `+ 0.35 + front` sum is only a CANDIDATE, because the tail's cross-street, a
   boulevard chain or a plaza sub-net may run through the cell it lands in.
   Compute the candidate, then **ALWAYS pass it through clearance and use the
   RESULT:**

   ```tsx
   const pad = offPathCell(NET, [tail[0] + dir[0] * laneLenOf(cap),
                                 tail[1] + dir[1] * laneLenOf(cap)], { clear: padMarginOf(rig) });
   ```

   **Only the queue LANE may touch a node; the PAD may not** (§0.14). Round 12's
   park B shipped the bare `tail + dir·laneLenOf(cap)` form and landed **four pads
   at 0.00 u from the slab** — four lints, ~4-5 points — with `offPathCell`
   appearing **nowhere in the file**, even though every lint printed the exact call
   and the answer it would have returned. Moving the pad FURTHER from the tail is
   always safe (§0.4's `front` note); leaving it on the street never is.

   **NEVER COMPUTE `anchor` FROM THE PAD.** Say it as a rule with no exceptions:
   the pad appears in the arithmetic only as an OUTPUT. Every park that inverted
   it lost the whole ride-spacing axis. Wave-12's six-word-brief park set
   `queue={{ anchor: pad − out·3.51 }}` on all SIX of its flat rides; the tails
   the manager then derived landed **0.18-3.46 u from the pad centre** against
   minima of 5.26 / 6.38 / 7.50 u — **nine `footprints` FAILs and axis 3 capped
   at 0/8**, on a park whose own header quoted the right formula.

   **THE AUDITED TAIL → PAD-CENTRE ROW. Write it per ride in the §0 header:**

   | capacity | `laneLenOf` | **MIN tail → pad centre** | assert ≥ (MIN + 1.2) | **AUTHOR this** (MIN + 2.4) |
   |---:|---:|---:|---:|---:|
   | 4 | 3.34 | **5.26** | 6.46 | **7.66** |
   | 6 | 4.46 | **6.38** | 7.58 | **8.78** |
   | 8 | 5.58 | **7.50** | 8.70 | **9.90** |
   | 10 | 6.70 | **8.62** | 9.82 | **11.02** |
   | **12** | **7.82** | **9.74** | 10.94 | **12.14** |

   **WHY THE AUTHOR COLUMN IS *TWO* LATTICE CELLS OVER THE FLOOR, NOT ONE (measured
   wave 17).** The MIN is enforced against the **`boardPoint` pad**, and on a
   `composableRide` that pad is not at `position`: it sits at `position` + the
   rotated **`layout.board`** offset, and local **+z is the face the queue runs
   into** — so the boardPoint sits **NEARER the tail** than `position` does.
   `<Discotron>` ships `board: [0, STAGE_H, 1.4]`, so a cap-12 pad authored at
   `minReachOf(12) + 1.2` = 10.94 put its boardPoint **9.54 u** from the tail
   against the **9.74 u** floor: a `footprints` FAIL, *"entrance hut overlaps
   boardPoint pad"*, on header arithmetic that read as correct. `board` is frozen
   into the component exactly like `front` and is equally unreadable while
   authoring — **so author the +2.4 column and assert the +1.2 one** (§0.0 step 7's
   `place`, and check 25).
   **`<Discotron>` and `<AetherBalloons>` both default to capacity 12**, so the
   cap-12 row is not an edge case.

   **AND IF A RIDE'S TAIL IS NOT A CELL LISTED IN `NODES`, NO QUEUE WAS PLACED.**
   There is no such thing as a queue onto a coordinate: the tail must be a real
   street node, because the lane is RAILED on both long sides and enterable only
   at the tail (§5). When the derived tail lands in open ground beside the pad,
   what the manager attaches is a SPUR ONTO THE PAD — and a spur onto a pad is a
   `footprints` FAIL (plus a `blockers` one, plus a queue no guest can join).
   So the last line of the construction is a lookup, not a hope: **every tail
   coordinate you wrote must appear verbatim in `NODES` (or be a set-piece
   PORT).** Check it by grep before you ship, and list them in the header.

   ##### THE QUEUE LANE IS A SOLID. A LANE LAID ACROSS A STREET COSTS **SIX** FAILURES, NOT ONE.

   **Measured, wave 17.** A coaster queue lane run through a street at `x 24.0`
   produced **2 `blockers` findings on its own railings PLUS 4 more** — every
   *downstream* ride's tail reported *"reachable only THROUGH a solid object"* —
   because the lane's railing **severed the one route** to the whole far side of
   the park. That is the shape of this failure: the lane costs 2, and the graph
   cut costs one per ride behind it. On a tree-shaped street net there is no
   second route, so the multiplier is however many rides sit beyond the cut.

   The lane is **RAILED on both long sides and enterable only at the tail** (§5),
   so it is a solid the length of the whole lane — not a path, not a crossing.
   **THE RULE, and it is one line of arithmetic:**

   ```ts
   // the lane occupies the segment from the tail BACK toward the ride:
   const laneSpan = [
     [tail[0] - dir[0] * (laneLenOf(cap) + 0.35), tail[1] - dir[1] * (laneLenOf(cap) + 0.35)],
     tail,
   ];                       // `dir` is queue.dir — it runs HEAD → TAIL, i.e. outward
   // KEEP EVERY STREET NODE **AND EVERY STREET EDGE** ≥ 2.4 u OFF THAT SEGMENT.
   ```

   Worked, from skeleton B (§3.1-B): cap 4, tail `[21.6, −2.4]`, `dir [1, 0]` ⇒
   the lane runs `x 17.9 … 21.6` at `z −2.4`, and the arterial it parallels is at
   `x 24.0` — **2.4 u clear**. Note what that forced: the tail is a STUB hanging
   off the arterial junction at `[24.0, −2.4]`, not a node ON the arterial. **If
   your lane and a street want the same ground, move the TAIL, not the street** —
   the street is load-bearing for accessibility and the tail is one cell.

   **AND ON `<Coaster>` / `<FlatRide>` / `<TrackRide>`, DON'T DO THE ARITHMETIC AT
   ALL.** Those wrappers take the tail as a NODE INDEX and derive the whole
   assembly with `planRideAccess` — the same idiom §4.0's archetypes ship:

   ```tsx
   queueTailNode={NET.node([22.8, -3.6])}  queueDir={[1, 0]}
   ```

   `NET.node(cell)` resolves a cell to its street-node index (and a miss degrades
   to a `noNodeOnCell` plan lint naming the cell — which is exactly the "my tail
   is not a node" error, caught for you). **Catalog rides (`<Carousel>`,
   `<Teacups>`, `<FerrisWheel>`, …) do NOT accept `queueTailNode`** — their only
   queue prop is `queue={{ anchor, dir }}` — so for those, name the tail as a
   `const … : XZ` used in BOTH `NODES` and the anchor expression, and let the one
   const be the single source of truth. A pad-relative anchor literal is the
   defect; a tail-relative one cannot be.

   **WHICH `front` GOES IN THE CONSTRUCTION — and why the DERIVED reach is not
   computable.** If you leave `queue` OFF, the chassis auto-raises `front` to
   `min(6.5, footMaxZ·scale + 1.27)` on any COMPACT rig (built span ≤ 10 u — every
   catalog flat ride) so the entrance hut can never sink into the pad; `footMaxZ`
   is a property of the BUILT MESH (3.13 Carousel, 3.50 TwistRide — not 1.8) and
   you cannot read it while authoring. **PINNING `queue.anchor` OPTS YOU OUT OF
   THAT ENTIRELY** — you own the geometry, the auto-`front` never runs, and the
   `front` term in the construction is simply the pad → head gap YOU choose. Its
   floor is **1.57 u** (`0.62` hut offset + `0.50` hut half + `0.45` pad half);
   **1.8 is the conventional value and lands the pad exactly on the AUTHOR column
   above.** For a wide-bodied rig, spend more: pushing the pad FURTHER from the
   tail is always safe, pulling it nearer never is.

   `anchor` is the queue **HEAD** (the hut end), NEVER the tail — round-7's
   park passed the tail node as `anchor` on five rides, which ran every lane
   backwards down the street it was supposed to meet. **Since wave 9 that
   mistake is AUTO-CORRECTED:** an explicit `anchor` sitting on a street node
   is moved to `node − dir·(laneLenOf(capacity) + 0.35)` and reported as a
   `queueAnchorIsHead` WARNING naming the value it used (round 8 collected the
   old fatal lint on two rides, kept the broken lanes anyway, and paid 5
   `footprints` + 3 `padOnStreet` + 8 `blockers` FAILs and a DEAD sim —
   `queued 0 / riding 0`). The auto-correction is not a licence: **write the
   corrected number into the park** and re-check that the PAD is ≥ 1.8 u off
   every lattice node and edge centreline (§0.14) — the anchor fix does not
   move your pad off the street. Keep the pad ≥ **1.57 u** (`0.62` + hut half
   `0.50` + pad half `0.45`) from the anchor AND ≥ **`laneLenOf(capacity) +
   1.92`** from the TAIL — the MIN column above (a 6.0-7.2 u pad-to-node gap
   works for every capacity-4 catalog flat, whose minimum is 5.26), and
   note that explicit `queue` also opts you out of the lane trim, the queueDir
   flip and the exit snap — you own the geometry.

   If you leave `queue` off, the DERIVED lane is trimmed so its tail lands on
   whatever node sits on its axis short of the default reach, and reports a
   (non-fatal) `laneTrim` lint naming the real `front` and reach. That is the
   correct outcome when the ring/plot leaves no room for a full-length lane —
   `<DistrictPark>`'s gate-side Waltzer ships exactly that way — but a trim
   below `capacity` slots starves the queue, so read the slot count it prints.

   And since round 7 `queue`, `capacity`, `name`, `intensity`, `price`,
   `rideDuration` and `loadTime` are actually FORWARDED by the catalog ride
   factory; before that `composableRide` swept them into the visual builder's
   props and they were silently ignored on every catalog ride.

   #### §0.4b THE OTHER HALF OF THE STATION — THE EXIT AND ITS PATH

   **A ride has TWO path connections, not one.** Until 2026-07 this section
   documented only the QUEUE arithmetic, and the code matched: a ride got a queue
   lane INTO its entrance and nothing whatever out of its exit. Measured across
   the seven reference parks before the fix: **26 rides, ZERO entrance/exit pairs
   in the RCT2 arrangement, and 25 exits standing on bare grass** up to 14.4 u
   from the nearest paving, several of them at diagonal yaws RCT2 cannot even
   represent (an `EntranceElement` direction is one of four).

   **WHAT RCT2 ENFORCES, AND WHAT IT ONLY CONVENTIONALISES.** Both matter, and
   they carry different severities here.

   | | RCT2 | here |
   |---|---|---|
   | entrance/exit on a tile ADJACENT TO THE STATION, on a side the track allows | ENFORCED — the tool refuses any other tile (`openrct2-ui/ride/Construction.cpp:449-487`) and `Ride::validateStations` DELETES one that stops qualifying (`RideConstruction.cpp:1557-1592`, the relative-direction test at **:1584**) | the huts are derived from the station frame, so this holds by construction |
   | the doorway facing is one of FOUR cardinal directions, pointing INWARD, with the path attaching on the REVERSE side | ENFORCED (`kEntranceDirections` = 4, `EntranceElement.cpp:22-26` + `Footpath.cpp:118-121`) | `exitDir` IS that reverse — the OUTWARD facing, the sense of the UI's own `gRideEntranceExitPlaceDirection` (`Construction.cpp:479-483`). Always axis-aligned |
   | a QUEUE runs into the entrance | ENFORCED to EXIST before the ride can open (`RideCheckForEntranceExit`, `Ride.cpp:2366-2412` → `STR_ENTRANCE_NOT_YET_BUILT`) | hard `accessibility` FAIL |
   | an ORDINARY FOOTPATH runs out of the exit | flagged, not blocked: a recurring red news item for as long as the ride is open — `STR_EXIT_NOT_CONNECTED`, *"<ride> has no path leading from its exit! Construct a path from the ride exit"* (`Ride.cpp:2076`; test `Ride.cpp:2035` → `Map.cpp:707-741`) | hard `accessibility` FAIL — see the severity note below |
   | entrance and exit ADJACENT ON THE SAME FACE | **NOT enforced.** `RideStation` holds two independent `TileCoordsXYZD` (`Ride.h:172-173`) and NO code compares them; each is validated only against the station track. A long station with the entrance at one end and the exit at the other is authentic | `exitNotAdjacent` **WARNING** (§0 still makes it fatal to ship) |

   **WHY THE UNPATHED EXIT IS A FAILURE HERE WHEN IT IS ONLY A NEWS ITEM IN
   RCT2.** In RCT2 a guest put down off the paving enters `PeepState::falling`
   and `Peep::UpdateFalling` lands them on the TERRAIN — they walk on, lost and
   unhappy (`Guest.cpp:5092-5140` → `Peep.cpp:781-890`), or DROWN if the tile is
   water (`Peep.cpp:831-854`). This sim has no terrain-walking `falling` state,
   so a guest whose exit spur never reached the network is left standing
   off-graph — which the `sim` gate already reported as a stuck walker, two
   checks later and without naming the cause. Gate check **a4** now fails it by
   name, with the arithmetic, exactly as check a already does for a queue tail
   the gate cannot route to.

   **THE SHAPE TO BUILD — and the arithmetic for BOTH lanes.**

   ```
   entrance hut  =  tail − queueDir·(laneLenOf(capacity) + 0.35 + 0.62)
   exit hut      =  entrance hut  ±  1.2·[−queueDir.z, queueDir.x]   // ONE TILE along the face
   exitDir       =  queueDir                                          // both doorways face OUT
   ```

   Both huts stand at the SAME depth off the station face, so the exit clears the
   ride body by exactly the 1.27 u the entrance hut does — nothing to clamp. The
   1.2 pitch leaves 0.1 u between two 1.09-wide huts, which is the tightest legal
   RCT2 pitch and SAT-clean.

   The EXIT PATH is then cast from `exit + 0.62·exitDir` (the doorway apron, the
   mirror of the entrance hut's 0.62 offset behind the queue head) and is
   **cardinal only, in at most two legs**:

   | | run | where it ends |
   |---|---|---|
   | **THE RAY** (preferred) | one straight leg along `exitDir` | the first street NODE on the ray (±0.45 lateral) or street EDGE it crosses, up to **9 u**. With the adjacent layout the ray runs parallel to the queue lane one tile over and meets the CROSS-STREET through the queue's own tail node — so the exit path is the same length as the queue lane, `laneLenOf(capacity) + 0.35` |
   | **THE JOIN** (fallback) | out level with the queue tail, then ONE TILE across | the queue's own tail node. This is the case for a tail node that is a DEAD-END SPUR poked into a themed court: the ray has no cross-street to meet, sails past and runs on to the next street — measured on `worlds-ref`, 6.1-8.3 u runs cutting across three set-piece quarters and twice nothing at all inside 9 u. The join is what a player actually builds: the exit path runs alongside the queue and meets the same footpath at its end |

   Whichever is SHORTER wins. `<Coaster>`/`<FlatRide>`/every catalog ride pick
   between the TWO adjacent cells on the same test, preferring the one whose exit
   path is shortest — that is the derived-exit rule, and it replaces the old
   "nearest legal pad-edge cell, never the queue's own side" snap that put the
   exit on the OPPOSITE face by design.

   **THE TAIL → PAD MINIMUM APPLIES TO BOTH LANES.** The `laneLenOf(capacity) +
   1.92` floor tabulated above is a QUEUE figure, derived from the entrance hut's
   0.62 offset + 0.50 half-depth + the 0.45 pad half. The exit hut is the SAME
   1.09 × 0.94 building at the SAME depth one tile over, so it needs the SAME
   clearance from the pad, and its path needs the same room to run: budget the
   MIN column for a **1.2-u-wider** face — the pad must clear a rig
   `2 × 0.55 + 1.2 = 2.30 u` across, not `1.09`. In practice the binding
   requirement is simply that the station face the queue comes off has **TWO free
   tiles side by side**: one for the entrance, one for the exit. Where it does
   not, both adjacent cells are illegal and the chassis records an
   `exitFaceBlocked` lint rather than repairing it onto another face — that
   repair is what produced the stranded exits.

   **AUTHORING.** `exit`/`exitDir` are OPTIONAL on `<Coaster>`, `<FlatRide>` and
   every catalog ride — **omit them.** The chassis cannot be beaten at this,
   because it knows the RESOLVED queue direction (the orientation resolver may
   flip it) and it ray-casts both candidate sides against the real lattice. A
   hand-pinned pair that is not adjacent-and-outward is HONOURED and reported as
   an `exitNotAdjacent` lint naming the cell that would have worked. Catalog
   components' `RideLayout.exit` is now only a SIDE HINT: all the chassis reads
   off it is the sign of its local x.
5. **rideDuration ≤ 12** unless you have a reason. The acceptance sim runs
   `max(SIM_SMOKE_SECONDS, ⌈2.5·maxRideDuration + 20⌉)` sim-s — **85 s for any
   ride ≤ 26 s** (`SIM_SMOKE_SECONDS` was 60 until 2026-07-28; it was raised
   with the BOARDING-QUIET departure rule, which puts ~13 s of extra dwell in
   front of every first cycle) — and needs ONE FULL cycle: gate→queue walk +
   queue shuffle + load + rideDuration + unload ≤ that window. **The walk is the
   part you control**: measured, the fixed overhead (spawn stagger, boarding, a
   10-s cycle, unload) is ~37.5 s and each unit of gate→tail walk costs a further
   **1.52 sim-s**, so the 85 s window buys about **30 u** of walk (24 u once a
   crowd stretches the dwell). See §0.3's GATE PROXIMITY check — the window is
   not raised further ON PURPOSE, because past ~72 u guests leave the park before
   riding and no window length helps.
6. **THE STREET FOLLOWS THE LAND — ROUTE ALONG THE CONTOUR.** A street is no
   longer one flat sheet at one level. `<Paths>` solves a **per-node surface**
   that clears the ground across the FULL slab width and ramps between nodes
   inside the walkable grade (**0.5 u of rise per 1.2-u tile**), reporting
   `pathLevelMedian` when it engages. Three consequences you must author for:

   * **Route along contours, not across them.** Do not plan a network on the
     assumption that it lands flat; pick node cells that follow the ground, and
     where a run must climb, give it INTERMEDIATE NODES so each 1.2-u step stays
     inside the grade.
   * **Burying the walked surface is a HARD failure.** `pathClipping` is
     §0-FATAL when the walked surface sits **more than 0.25 u under the terrain**
     or **more than 1% of the corridor is buried**. The remedy is to REROUTE
     along the contour or add nodes — **never to loosen the tolerance.**
   * **Real cut-and-fill now shows.** Under 0.35 u of float a span gets an earth
     berm; above it, RCT2 wooden support scaffolds. So a street crossing a dip
     legitimately reads as a TRESTLE — that is the intended look, not a defect.
   * **Plazas are levelled TILE BY TILE**, so a plaza on a rise STEPS rather than
     terracing as one pad. Put plazas on the flat.
   * `<Terrain>`'s AUTO-keepDry pass re-settles the street afterwards
     (`store._resettlePaths`) with `pathY` pinned — the surface you validated is
     the surface that ships.

   **Path level hugs the MEDIAN ground under your nodes**, never the max —
   check node ground heights FIRST; a node sitting on a 2-3 u bulge means
   MOVE the node or give that one spur a `nodeY` ramp. Never hoist the whole
   street onto berms (the "causeway" failure). Since round 7 `<Paths>` derives
   the level this way ITSELF and the thresholds are mechanical:

   | condition | what happens |
   |---|---|
   | node-ground spread ≤ 0.35, or you passed `nodeY`/`[x, z, elevation]` triples | level = **max** ground + 0.03 (the legacy behaviour, bit-identical) |
   | spread > 0.35 | level = **median** + 0.03 and every outlier node gets an AUTO `nodeY` ramp — non-fatal `pathLevelMedian` lint listing them |
   | an auto-ramp over the walkable grade | **CLAMPED to 0.20 u** and named in the same lint (wave-10) |
   | the clamp leaves the node > 0.35 u off its ground | §0-FATAL **`rampRefused`** lint — the auto-fix refuses (wave-10) |
   | level > median + 0.8 | §0-FATAL `causeway` lint |
   | any span > 1.0 u over the ground beneath it | §0-FATAL `causeway` lint |
   | any span > **2.0 u** up, or any span whose ground dips below the waterline | the EDGE IS NOT BUILT — §0-FATAL `causewayRefused` / `latticeInWater` |

   An auto-ramp is not a licence to keep a bad node, and **since wave 10 it is
   also AUDITED — an auto-fix is not allowed to create a fresh violation.**
   Round 9's park A took a +0.36 auto-ramp on a street node, the GameManager
   then attached a stall's guest point 0.48 u away as a logical access spur, and
   that stub inherited the un-ramped level: a **0.74 grade** against the 0.42
   walkable maximum, on an edge `buildPathNetwork`'s ramp lint never sees
   (it runs before the spur exists). So every auto-ramp is now capped by the
   grade budget of the shortest edge that can meet the node — including a later
   **0.48 u access spur**, which is the binding term and caps ANY auto-ramp at
   `0.42 × 0.48 =` **0.20 u**. Beyond that the fix refuses (`rampRefused`,
   §0-FATAL) instead of inventing a steep stub: author the ramp as an
   `[x, z, elevation]` triple spread over a STRAIGHT multi-node run, or move the
   node. **And read the
   REFUSED cases as one causal chain:** a refused span leaves a HOLE in the
   street graph, so the next thing you see is `accessibility` /
   `blockers`-unreachable failures for everything behind that hole. Those are
   not a separate bug — fix the refused span and they go with it.

   **THE PER-RIDE GROUND CHECK — the ramp budget as pre-flight arithmetic.** The
   table above is about STREETS; the failure it keeps producing is about RIDES,
   because a ride brings five more cells that must all sit at compatible levels.
   So, **for every ride, read the ground at the PAD, BOTH HUTS, the QUEUE TAIL and
   the EXIT JOIN** (five cells; six with the exit hut) and require that **no two
   of them differ by more than 0.5 u of rise per 1.2 u of separation** — the
   walkable grade. Where they do, MOVE THE RIG to flatter ground; do not hope the
   auto-ramp covers it, because the auto-ramp is capped at 0.20 u and then
   REFUSES. **`causewayEdges` must be EMPTY, and each one is −1.0** — round-11's
   park B shipped **5**, reported as "deck unreachable", i.e. rides that were
   built, rated and unridable.

   > **⚠ BUT MOST OF THESE LINTS ARE A LINT ARTEFACT, AND THE FIX IS THE ATTACH
   > POINT — worth a full +1.00 on axis 12 to EVERY park scored so far.** Mechanism,
   > validated node-for-node: `Park/wrappersLand.tsx:641` passes
   > `renderEdges: bEdges.length`, so `PathNetwork/build.ts:177` builds and lints
   > **only the STREET prefix** — access-spur edges never enter `buildEdges`.
   > `build.ts:301`'s deck-reachability BFS then seeds at `Math.abs(nodeY) <= 0.05`
   > and traverses only those built edges. And a spur node INHERITS its parent street
   > node's `nodeY` (`wrappersLand.tsx:626-632`), so **if that parent solved above
   > 0.05 the spur is never seeded, nothing can reach it, and it is reported
   > `deck unreachable` at a measured walkable grade of 0.00.**
   >
   > Evidence across `skeleton-a` / `skeleton-b` / `r16b` / `r15a`: **100 % of the
   > flagged indices are `>= streetNodes`** — every one a spur, never a street node;
   > `maxGrade` **0.03** against the `MAX_SLOPE` cap **0.4167** (`0.5 / 1.2`,
   > `build.ts:208`); gate reachability **100 % with 0 orphans** in all four. On
   > `skeleton-a` the street nodes solving `|nodeY| > 0.05` are exactly
   > **{10, 11, 13, 26, 80, 82, 84}** — precisely the 7 parents of its 11 lints — and
   > all 19 other spur hosts produced zero.
   >
   > **THE RULE: every ride queue tail, exit lane, stall front and restroom must
   > attach to a street node whose solved `|nodeY| <= 0.05`.** Only the ATTACH POINT
   > moves — not the ride, not the pad. It is nearly free: **`skeleton-a` has 61 of
   > its 87 street nodes lint-safe, `skeleton-b` 41 of 58.** Find them OFFLINE with
   > `probe-skeleton.mjs`, which replays the `<Paths>` height solve on the guarded
   > ground and prints per-node ramps in **~2 s** (2.375 s measured on
   > `samples/skeleton-a.tsx`). **DO NOT ASSUME MARGIN:** nodes 10, 11, 26, 80, 82 and
   > 84 all sit within **0.031** of the 0.05 threshold, so a seed change, a `keepDry`
   > edit or one new guard cell can flip a safe attach point unsafe — re-probe after
   > any terrain change. (A genuinely steep spur is still a real `causewayEdge`: the
   > two are told apart by `maxGrade` against the 0.4167 cap.)
7. **Gate ON the front-edge apron** — within ~1 unit of the park edge,
   facing OUTWARD. A gate 3+ units inside the park is wrong.
8. **Imports match the canonical block below.** NEVER mount a
   `build<Name>Scene` preview builder inside a park (it ships its own
   staging — the floating-oval failure); use the component
   (`<LogFlume pieces={...}/>`) or its plain `build<Name>` builder.
9. **Neon scale 0.4-0.7** for park signage — the default auto-scale is
   giant. The backboard hugs the text bounds automatically — never build a
   placard/panel behind a sign.
10. **Counts** — on the default **128** plot: **≥ 32 trees** and **≥ 16
    scenery pieces** (the old ≥ 12 / ≥ 6 were set against a 48 plot; these are
    ×2.7 — the plot edge ratio — NOT ×7.1, the area ratio — planting reads per-street-frontage, not per-acre, and
    auto-dressing's forest/beach/meadow planting already scales with `areaK`,
    so ×4 is what you must add near the streets yourself; plant **MIXED shapes**
    and keep the scenery's `varietyIndex` ≥ 6, i.e. ≥ 6 different
    `SCENERY_NAMES`), ≥ 1 stall per 2 rides and **≥ 3 DISTINCT stall kinds
    spanning FOOD *and* DRINK, every one themed-named, plus at least one
    `<Restroom>` and `bins` at 2-3 junction verges** (§0.0b axes 1 and 5 —
    a park with no restroom or no bin loses 3 points for two lines of JSX),
    **≥ 1 `<Lights>` RUN PER DISTRICT, laid ALONG the street** (a 2.4-u stub
    between two adjacent nodes is not a run — span the block, hook to hook; two
    neon signs and four torches leave the night shot reading BLACK, which is a
    scored frame), while keeping the whole scene under **~3 000 draw calls**
    (round-11's park B pushed 3 660 with ~70 active lights — dress the streets,
    not every verge),
    EXACTLY 2 water bodies (§1: a dominant one + a secondary; ONE on a plot ≤ 48) inside the **WATER BUDGET** below, gentle
    normal terrain (no moonscape, no billiard table). Mesh budget scales with
    plot AREA: `2500·(size/16)²` — **default 128 → 160 000** (192 → ~360 000, the
    old 48 → ~22 500) — exceeding it is a validator WARNING (§6), and warnings are
    FATAL (§0).

    **WATER BUDGET — per climate, TWO BODIES, re-measured at 128 (2026-07).**
    Two things changed at once: the default plot went 192 → 128, and every plot
    of 64 or more now composes **TWO** water bodies (a DOMINANT one plus a
    SECONDARY — §1). Two bodies raise total coverage, so the old bands are void.
    Measured over the full 24-seed × 4-climate sweep at 128
    (`node harness/park-eval/seed-table.mjs --sweep --json`, wet area
    flood-filled off the BUILT heightfield, TOTAL over both bodies):

    | climate | total water % at 128 (min / p5 / p50 / p95 / max) | dominant | secondary | band |
    |---|---|---|---|---|
    | desert | 1.4 / 2.4 / 5.7 / 7.6 / 8.1 | 0.8-5.9% | 0.4-3.0% | **2-8%** |
    | alpine | 1.4 / 2.3 / 5.6 / 10.4 / 10.8 | 0.9-7.7% | 0.4-3.4% | **2-11%** |
    | temperate | 3.1 / 3.9 / 11.1 / 21.8 / 24.3 | 2.1-17.6% | 0.8-8.7% | **4-22%** |
    | coastal | 5.9 / 7.3 / 14.0 / 24.3 / 24.8 | 4.8-20.0% | 0.6-7.2% | **7-24%** |
    | all 96 pairs | 1.4 / 2.4 / 8.0 / 22.4 / 24.8 | — | — | — |

    The bands are the p5-p95 range rounded outward, per climate. So: **a coastal
    seed at 22% total water is NORMAL and is not a defect**, and a desert seed at
    22% is. Only a body outside its climate's band, the WRONG NUMBER of bodies,
    or a secondary body under 16% of the dominant one, is a fault. The floor
    still matters — §1's climate ideal of **≥ ~3% of the plot** is what keeps a
    park from reading waterless, and desert/alpine seeds legitimately sit under
    it (1.4% at the extreme: two small pools in a dry country). The designed
    water FRACTION is size-invariant by construction (`parkComposition` derives
    every radius from `u = S/16` and clamps against `half`); **no lake radius
    needs re-tuning** — only the measured band above does.

11. **TRACK CORRIDOR (round-4 gate) — PUBLISH THE KEEP-OUT IN PLOT COORDINATES
    IN YOUR HEADER, THEN LAY THE STREETS OUTSIDE IT.** Do not walk the polyline
    and hope. Every §4.0 archetype ships its corridor as a CELL TABLE of offsets
    from the reference `start`; **translate that table by your own start and write
    the result into the §0 header as a rect in PLOT coordinates**
    (`CORRIDOR KEEP-OUT x[…] z[…]`), then check **every street node and every
    boulevard leg** against it. A street edge, stall, or another ride's pad / hut
    / lane inside that corridor is a `corridor` FAIL naming the offender, unless
    the track there is **≥ 2.2 u above** the path level. The ride's OWN
    station/pad/lane is exempt.

    **THE VALLEY LEGS DO NOT FLY, SO "IT CROSSES THE RING" IS NEVER OK.** The
    four valley floors and the station leg of a §4.0 rectangle run **~0.6 u above
    path level** — under a THIRD of the 2.2-u overfly requirement — so a street
    crossing one is a grade crossing, full stop. **A street may cross ONLY under a
    LIFT or HILL piece measuring ≥ 2.2 u there**, which on §4.0-A means the apex
    legs and nothing else (the whole 30 × 30 interior is free, and crossing under
    an apex leg is a good shot, not a defect).

    **AND IF THE HUB AXIS INTERSECTS THE RING, MOVE THE RING — NOT THE STREET.**
    The flagship owns a district and has a whole plot to sit in; the hub axis is
    the park's circulation spine and every other district hangs off it. Wave-12's
    park DETECTED the crossing in its own reasoning and shipped anyway (−0.5, and
    it was one lattice translation away from clean). Relocating the archetype is a
    single translation in lattice multiples of 1.2 — carry the corridor table with
    it and re-check the LEGAL START range (§4.0).
12. **THRILL target for the park's declared type (§4.0/§4.1)** — the flagship
    coaster MUST come from the HIGH-THRILL shelf (§4.0: A E 6.12 / B E 5.27 /
    C E 6.27). The small legacy rect/L-wrap shapes rate 0.6-1.1 and are
    FILLERS only. A legal circuit is not automatically a RIDE.
    Decide THRILL vs FAMILY, then aim the
    flagship coaster at the §4.1 numbers (excitement ≥ 6.0 / ≥ 5.0, peak
    +vertical ≥ 2.5 g / ≥ 1.8 g, highest drop ≥ 2.0 u / ≥ 1.2 u, lateral
    always < 1.27 g, some airtime, nausea < 8.0) and CHECK it with
    `rateCoaster` — never guess. Also span the intensity bands: a gentle
    (≤ 3), a moderate (4-6) and an intense (≥ 7) ride alongside it.

12b. **TWO COASTERS AND FIVE CIRCUITS — THE ROSTER, NOT THE FLAGSHIP (§4.0-E,
    added 2026-07-26).** Check 12 above is written in the singular and that was
    the whole defect: **measured over the 24-park corpus, 16 of 20 probed parks
    registered exactly ONE coaster, 3 none, one two** — because no check ever
    asked for a second. At size 128 count, on paper, before the JSX:

    * **2 coasters**, from **DIFFERENT §4.0 archetypes**, on **different
      `rateCoaster` `ratingBand`s** — measured 2026-07-26: **A I 9.32 *intense* ·
      B I 6.25 *thrilling* · C I 9.55 *intense*** — so A+B or C+B, not A+C. Each
      `rateCoaster`-measured, each line pasted into the §0 header (`FLAG` and
      `FLAG2` rows), each with its OWN corridor keep-out rect published in PLOT
      coordinates. **DO NOT hand-roll the band split.** All three archetypes rate
      `I > 6`, so the `≤3 / ≤6 / >6` bands this checklist uses for the PARK MIX
      (check 12, and `probe.thrill.intensityMix`) put every coaster in one band
      and can never separate two of them — that was a published defect, fixed in
      §4.0-E. Read `ratedCoasters[].ratingBand`. And **the park's gentle and
      moderate bands come from the FLAT/TRACKED roster, never from a coaster.**
    * **5 circuits total**, spanning **≥ 3 of the five families** `coaster /
      water / transport / dark / tower`. The monorail is one. **Flat spinners
      are not circuits** — a park of one coaster plus eight spinners measures
      `rideRoster.circuitCount: 1`.
    * **≥ 1 circuit off the never-used shelf** (14 of the catalog's 27 circuits
      have never shipped).
    * **BOTH coasters' points go into `<Terrain coasterPts>`**, and the pair must
      still clear the relief floor. Measured on `skeleton-b`: kept **0.73**
      against the 0.70 floor with one coaster — **0.03 of headroom** — and 3 of
      9 candidate second-circuit placements came out `terrainFlattened`-FATAL
      while 2 more moved a water body 25-77 u (`waterRePicked`). **So the second
      coaster's start is MEASURED with `probe-skeleton.mjs`, never chosen by
      eye**: read `reliefFloor.kept`, `reliefFloor.stdH`, `centroid MOVED` and
      `in composed water`, all four, in ~2.3 s.
    * **Only the two coasters need a `pieces` array.** Every other circuit
      either guards the call (`LogFlume`, `RiverRapids`, `Chairlift`,
      `Bobsleigh`, `GoKarts`, `Monorail` — `compileTrackPieces` is never invoked
      without `pieces`) or compiles its own verified default (the twelve themed
      circuits, all measured `ok` / `closed` / 0 synthesized / 0 warnings).
      **Authoring `pieces` is the DEFAULT; omitting it ships the stock layout,
      identical in every park that mounts that rig. Verify what you author
      (`report.fatal`, synthesized < 40 %). `<Monorail>` is the exception — its
      published ring goes in verbatim.**

    At size ≤ 48 two §4.0 rings do not fit (§4.0-A alone spans 37.6 × 37.6):
    ship one archetype plus three or four no-compile circuits instead, and say
    so in the header.

13. **SOLID OBJECTS (round-6 gate)** — guests cannot walk through anything
    solid. Walk every street edge on paper: it must stay **≥ 1.2 u from a
    fountain centre**, off every ride pad/body and shop body, and out of every
    `<Fence>` run. Fencing a boundary a street crosses? Author TWO runs with a
    **gateway gap** (or `<Fence inset>`). Queue lanes are railed on both sides
    and only enterable at the TAIL, so the tail must land on a real street
    node (item 4). A street through a blocker is a `blockers` FAIL (§6).

14. **RIDE PADS GO ON CELL INTERIORS (round-7 gate — the single biggest
    defect of round 7).** A ride pad must sit **≥ 1.8 u from EVERY lattice
    node and every edge centreline** (1.8 = a 2.4-u pad half-width 1.2 + the
    1.1-u slab half-width 0.55 + 0.05). **Only the queue lane may touch a
    node.** Round-7's park put five flat-ride pads straight ON its lattice
    nodes — `COLS = [−18,−12,−6,0,6,12]` × `ROWS = [15.6,9.6,3.6,−3.6,…]`,
    every "nice" ride cell being a junction — and collected **25 of its 34
    failures** from that one mistake: 20 `blockers` FAILs (streets running
    through the machines) plus 5 queue tails "only reachable through a solid
    object". A pad in a slab now raises a §0-FATAL **`padOnStreet`** lint at
    MOUNT time, and one that merely sits inside the 1.8 margin a
    `padNearStreet` warning. Both print the nearest legal cell.

    **THREE SAFETY NETS NOW AUTO-CORRECT — AND ALL THREE STILL FAIL THE PARK.**

    | authored mistake | what the chassis does | severity |
    |---|---|---|
    | a pad inside a street slab | **MOVED to the legal cell** — `offPathCell`'s own answer — and the move is reported | `padOnStreet`, §0-FATAL |
    | a DIAGONAL edge in `buildParkNet({ edges })` | **AUTO-ELBOWED** into two cardinal legs through a synthesised corner node | §0-FATAL plan lint |
    | an edge crossing a set-piece's own SOLID | **CUT and re-tied through that piece's PORTS** | §0-FATAL plan lint |

    So the park RENDERS and is diagnosable instead of going black — **but a
    §0-FATAL lint still fails `validatePark`, so this is a safety net, not a
    licence.** Wire ports correctly, keep every edge cardinal, and run every pad
    through `offPathCell`, and none of the three ever fires.

    **Ask, don't guess** — and §0.19 makes that call MANDATORY for every pad
    and every prop cell, not merely available:

    ```tsx
    import { offPathCell, pathClearance } from './components/Park';
    pathClearance(NET, [-12, 9.6]).clearance          // 0 → that cell IS a node
    offPathCell(NET, [-12, 9.6], { clear: 1.8 })      // → [-13.8, 10.8]
    ```

    `offPathCell` audits the STREETS plus dryness and bounds — it does NOT
    know about your other pads, stalls or scenery, so check its answer against
    your own committed footprints (pitch ≥ 6 u, footprint table) before
    committing. If it returns `null`, the skeleton itself is too dense there:
    re-plan the streets (or use a set-piece, §3.1) rather than shrinking the
    rule — that is exactly what a 6-u uniform grid does to a capacity-10 rig.

    A SHOP is the exception §3 already states: kiosks belong on cells
    **abutting** the street with the serving front toward it (the counter
    reaches 0.42 out, the guest attach point 0.72 out), so a stall only has to
    keep its SOLID BODY (hx 0.6, hz 0.42 on the anchor) out of the slab —
    which is why a `<Bazaar>`'s stalls may flank its own aisle. Same fatal
    lint if a street crosses the body.

    **AND THE SAME CALL IS MANDATORY FOR DRESSING — EVERY HAND-PLACED
    `<Scenery>` / `<Placed>` CELL COMES FROM `offPathCell`.** Not "check it if it
    looks close": **run it**, at `{ clear: 1.2 }` (path half 0.55 + a prop's
    ground radius, capped — §5's `pathWidth/2 + min(groundRadius, 0.6)`), and
    write the number it returns. Two things are a `scenery` FAIL by definition:
    * a cell that **reuses any street node's coordinate** — including one
      coordinate of it. Typing a prop at your street row's own `z` puts it on the
      centreline, and half a slab of a statue inside the paving is the failure.
      Wave-12's park hand-typed 18 props and put **six of them on street axis
      values, four at `z = 45.6`** — its own ring's north edge — for six FAILs.
    * a cell **lying on an authored edge centreline** between two nodes, which is
      the same mistake with the node one cell further away.

    **BUILDINGS ARE NOT STREET NODES — AND AN AVENUE'S ENDPOINT *IS* A STREET
    NODE.** A `<Restroom>`, a hut or a hand-placed stall is a SOLID with a
    doorway, so it needs the ride-pad clearance, not the prop clearance:
    **`offPathCell(NET, cell, { clear: 1.8 })`, and never a coordinate that also
    appears as a `boulevardPlan`'s `from` or `to`.** Remember a `<Boulevard>`
    paves its carriageway as a 1.2-u CHAIN, so **every cell along the leg is a
    street node**, not just the two ends. Wave-12 put
    `<Restroom position={[-8.4, 16.8]}>` on a boulevard's own carriageway node and
    paid **2 `blockers` FAILs and `restroomUses 0`** — a restroom no guest could
    reach, which is also most of a cleanliness axis.

---

## CHECKS 15-27 ARE IN `rules/park-generation-checks-b.md`

This file was split because it outgrew a single design-system write. Nothing was
cut. **Checks 15 through 27 — the set-piece/`buildParkNet` mandate, the water
re-read, `keepDry` discipline, `offPathCell`, the crowd, the monorail gate, the
prop-shape gates, set-piece centres, pad reach, world scenery and the roster
arithmetic — plus the footprint table, the canonical imports and the catalog
inventory — are in `rules/park-generation-checks-b.md`. Do all 27.**

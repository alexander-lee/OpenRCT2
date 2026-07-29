---
name: park-troubleshooting
description: "Load ALONGSIDE park-composition while WRITING an mp3d park, not only after something breaks - it opens with the PRE-SHIP CHECKLIST of defects a park cannot see in itself, to run before the first line of JSX and again before calling the park finished. Covers the blanket KEEP_DRY guard and keepDry={NET.keepDry}, assertions downgraded to console.warn instead of parkAssert, a street CONTINUING past a monorail platform tail, a queue tail on a set-piece PORT cell, a raw tree scatter with no offPathCell, a <Boulevard> port-referenced at one end only, a bazaarPlan under the 3-stall floor, rides left on catalog default names, buildParkNet called twice or never passed worlds, a hard-coded pad clearance instead of padMarginOf(rig), and props that silently do nothing. Then use it as the failure catalogue for any validatePark check (accessibility, terrain, paths, footprints, coaster, corridor, blockers, scenery, bounds, autofix, sim) or lint kind, each with its threshold, its fix and its measured point cost."
---

# Park failure catalogue — every defect that has actually shipped

Look your failure up by `check` or by lint `kind`. Each entry gives the exact
condition, the threshold in the code, and the fix. Written at the default
`<Park size>` = **128**: footprint/access bounds **±63.95** (`size/2 − 0.05`),
coaster TRACK bound **±64.3** (`size/2 + 0.3`), gate cell **`[0, 63.6]`**, mesh
budget **160 000** (`2500·(size/16)²`), gate-edge tolerance **3.2 u**
(`max(1.25, size·0.025)`), opening crowd **50**.

> ## ⚠ THIS FILE HAS NO FILESYSTEM BEHIND IT. EVERY BLOCK YOU NEED IS INLINE.
>
> You receive loaded SKILL BODIES and `rules/setup.md` — **not a checkout, and not the
> other `rules/*.md` files, which are NEVER delivered.** One park searched for
> `monorail-ref` and `park-generation-rides.md`, found neither, and improvised the
> mandatory ring from memory with two props that do not exist. **A `§x.y` or a file path
> here is PROVENANCE — where a number was measured — never an instruction to fetch
> anything.** Where a fix needs code, the code is in this file, in
> **park-composition** / **ride-and-stall-roster**, or in `rules/setup.md` §0-P.

The gate behaviour below was measured in `rules/park-generation-validation.md` §5-§6
and `rules/park-generation.md` §0 — **cited purely for provenance: neither file is ever
delivered into a generation.** THIS FILE IS THE AUTHORITY for everything it states. The
one other document that always arrives is `rules/setup.md` (published from
`mp3d/SETUP.md`), whose §0-P carries the pre-bundle gates and the mandates.

---

## THE PRE-SHIP CHECKLIST — run it WHILE WRITING, not after it breaks

**Every item below is either a paste-able guard or a one-line grep on your own source.
None needs a report to run, and each one cost a measured, named number.**

| # | grep your own file for | why it costs | the guard |
|--:|---|---|---|
| 1 | `KEEP_DRY = [...NODES]` / `NODES.slice()` / any `keepDry` built from the node list — **AND `keepDry={NET.keepDry}` HANDED STRAIGHT TO `<Terrain>`** | **−7** — `waterRePicked` (−3; one park moved the dominant body **74.5 u** and the secondary **70.2 u**, both areas roughly halved) + two `plantedInWater` refusals (−2 scenery, −2 trees). `buildParkNet` MERGES every set-piece cell into `NET.keepDry`, so skeleton A's 31 authored cells arrive as **659 guards** | `const GUARDS = keepDryOf(NET, SEED_ROW)` and `<Terrain keepDry={GUARDS}>` — **park-composition** Step 2. MEASURED on skeleton A: `NODES.slice()` moved the dominant body **77.3 u** (`terrainSeed` 16 → 501); `keepDryOf` → **659 guards, both bodies 0.0 u**, 0 wet |
| 2 | a `boulevardPlan` id appearing ONCE in `EDGES` | **−2.0** `deadStreetNode` — the carriageway is built to full length and stops in grass | extend the port-ref loop with `p.ports.filter((pt) => !pt.prunable)`; build endpoints as `HUB.port('W')` |
| 3 | `stalls: [` with fewer than 3 entries | **−0.25** `padNearStreet` ×3 + `rosterOverstated` — `bazaarPlan` pads to 3 and every pad moves | declare 3-6; `roster.stalls` from `plan.slots.length` |
| 4 | a `register={{ name: '<the component's own name>' }}` | **−0.5** on the roster axis (8/10 not 10/10) | the `deCamel` assertion in **ride-and-stall-roster** Step 1b |
| 5 | `<Monorail` — is it there at all? | **the whole round**: `preflight.mjs` refuses to bundle without it | paste the ring block verbatim (**ride-and-stall-roster** Step 3, **park-composition** Step 6, or `rules/setup.md` §0-P.4) |
| 6 | `roster={{` on the `<Park>` tag | **the whole round**: same gate | pass the prop; the header comment is not the prop |
| 7 | `buildParkNet(` — one call, and EVERY plan in its piece set (world rows too)? | ~−1 for two fuses; a blind world audit if a row reaches neither `pieces:` nor `worlds:` | one fuse, `pieces: ALL_PLANS` naming the rows (`worlds:` is optional), same `NET` to `<Paths>` and every `offPathCell` |
| 8 | any pad written as `tail + out·d` without a wrapping `offPathCell` | **~−3.5** + ride spacing capped 0/8 | the helper's LAST TWO lines are `offPathCell(NET, pad, { clear: padMarginOf(rig) })` **then `assertPadFlat(...)`** |
| 9 | **`<Monorail start=` or `heading=`** | **~−4**: the ring mounts AT THE ORIGIN, `worldsTouched 0`, a dead node, a 1.57e14-grade spur — and NO error | `position={[-42.6, 0, -9.7]} rotation={0}`; see "`<Monorail start=…>`" below |
| 10 | **`queueAnchor`** appearing directly inside a `register={{…}}` | a TYPECHECK failure, and station 0 gets no lane | `queue={{ anchor, dir }}` at top level; `queueAnchor` only inside a `stations[]` entry |
| 11 | a `fountainPlazaPlan`/`bazaarPlan` `position` that also appears in `NODES` (grep the literal both ways) | **~−11**: `edgeThroughSolid` ×2, a dropped edge, an orphan island, `accessibility` FAIL, 5 `footprints` FAILs | `assertNodesOffPieces(NODES, ALL_PLANS)` — **park-composition** Step 4 |
| 12 | `clear: 1.8` on a RIDE pad | nine `padOnStreet` lints; the auto-moves then stack rides | **`padMarginOf(rig)`**, never 1.8 — and never a hard-coded 3.2 either |
| 12b | **`clear: 3.2` on a BIG rig** (`<GhostTrain>` `<HauntedMansion>` `<PaddleBoats>` `<Discotron>` `<FerrisWheel>` `<AetherBalloons>`) | **−0.5 each** `padNearStreet`; one park took **seven** having followed our published constant | `padMarginOf(rig)` — GhostTrain **4.77**, PaddleBoats 3.12, Discotron 3.07, FerrisWheel 2.97, AetherBalloons 2.95. The margin is `max(1.8, bodyHalf + 0.60)` from the rig's MESH; **capacity is irrelevant** |
| 12c | a pad with NO flatness test | **−2.5** `terrain` — a pad sat at peak contribution **2.25** against the 0.75 limit | `assertPadFlat(pad, clear, rig)` as `place()`'s last line — `offPathCell` is street-aware and TERRAIN-BLIND |
| 12d | a street CONTINUING past a monorail platform tail (grep `EDGES` for a second edge on `[36,-8.4]` `[-36,-8.4]` `[0,-57.6]` `[0,27.6]`) | **−3.5** — one `blockers` FAIL per edge, `nodesReachableFromGate` 87/97, everything behind it stranded. **This was in OUR skeleton A as `7 → 20`** | `assertTailsAreLeaves(EDGES, RING_TAILS)` — **park-skeletons** |
| 12e | a queue tail that is ALSO a set-piece PORT cell | **−1.0** `footprints`: the derived exit lane leaves from the cell NEXT to the tail, which is inside the piece. `assertNodesOffPieces` PASSES it — a port is legally outside the footprint | `assertTailsOffPorts(NODES, QUEUE_TAILS, ALL_PLANS)` |
| 12f | a RAW tree scatter — `RAW_TREES` used without `offPathCell` | **−5.0**: five `scenery` FAILs floor axis 9 at **0/5**. The single largest item of wave 18, and it was OUR template | `.map((c) => offPathCell(NET, c, { clear: 0.75 }) ?? c)` — EVERY authored cell that mounts geometry, scatter included |
| 12g | `facing: { port: 'E' }` while `EDGES` wires `':W'` | **−1.0** `deadStreetNode` — the facing port is PRUNED and the wired one dead-ends. The port-ref COUNT assertion passes it | the `facingWired` assert — **park-skeletons** |
| 12h | `shape: string` on the tree array | a **TS2322**; `typecheck.mjs` is part of the gate | `const TREE_SHAPES = [...] as const; type TreeShape = (typeof TREE_SHAPES)[number]` — `Kit` exports the FUNCTION, not the union |
| 12i | **every check written as `console.warn`** | **~−5**: nothing stopped six hard failures in a park that downgraded them all on purpose | `parkAssert` + one `parkAssertFlush()`: collect all, print one numbered block, throw once — **park-composition** |
| 12j | no `export function __netdump()` | no offline loop — **~7 min of browser per iteration** instead of 2.2 s | copy it from `samples/skeleton-b.tsx` into the FIRST draft |
| 13 | a pad whose tail distance is under `laneLenOf(cap) + 1.92` (cap 12 ⇒ **9.74 u**) | `footprints`, spacing 0/8 | `place()`'s reach assertion — **park-composition** Step 5(a) |
| 14 | no `*Scenery` import at all | `sceneryCount: 0` on every world | three named themed pieces per world, inside its rect, in `include` |
| 15 | `roster={{ stalls: N }}` where N is the number of bazaar ROWS | `rosterOverstated` (understated direction) | `Σ plan.slots.length + standalone stands` |
| 16 | `reach = minReachOf(cap) + 1.2` (the OLD published value) | `footprints`: *"entrance hut overlaps boardPoint pad"* — the boardPoint sits `layout.board` NEARER the tail than `position` (1.40 u on a `<Discotron>`), so cap 12 lands 9.54 vs 9.74 | author **`+ 2.4`**, assert **`+ 1.2`** |
| 17 | a street node or edge within 2.4 u of any queue LANE span `[tail − dir·(laneLenOf(cap)+0.35), tail]` | **six** failures from one lane: 2 `blockers` on its own railings + one per ride cut off behind it | move the TAIL to a stub off a junction, never the street |
| 18 | a street continuing one cell past `[−36,−8.4]`, `[36,−8.4]` or `[0,−57.6]` along the lane axis | `blockers` — it runs through the platform pad (r12a) | those three ring tails are LEAVES (W/E approached from INSIDE the ring, SOUTH from OUTSIDE); only the NORTH tail `[0, 27.6]` may be a through node |
| 19 | a world rect that never reaches `x ±44` / `z −52.8…36` | `everyWorldTouched: false` with all four platforms mounted — the probe walks the ring's bbox PERIMETER | ONE `include` cell aimed at the ring (never guarded, costs nothing) |
| 20 | a `coasterPts` circuit out on a FLANK | **FATAL** `terrainFlattened` — kept 69 % AND stdH 0.69 (both halves); the same circuit in the CORE reads kept 73 % and a warning | put the flagship in the plot CORE; `reliefBias inner` 0.18 puts the ranges on the flanks |

**AND THE LESSON THIS TABLE IS BUILT ON.** A park **copied and honoured the
cardinal-edge rule** — it ships as a `throw` you can paste — and **ignored the `keepDry`
water walk** from the same document, which even named the offending cell in prose. **A
guard gets obeyed; a paragraph gets rationalised.** When you find a defect in your own
park, write the assertion that makes it impossible and put it at module scope beside the
cardinal-edge check.

## First: read the report correctly

```ts
// report = { ok, failures: [{ check, detail }], warnings: [{ kind, detail, fatal }], simSeconds }
```

**`report.ok === true` is NOT the bar — an empty `report.warnings` array is.** Every
fatal lint is promoted into `failures` with check `'autofix'`.

**And FATAL is a POINT COST, not a threat — the renderer is not the scorer.** A park
that reasoned *"the runtime still renders, so I'll accept that"* did render, and
scored **68.7**. The measured price list, out of 100:

| what you shipped over | what it cost |
|---|--:|
| a FATAL coaster/flume compile (translucent red, never registers) | **−7.0** thrill, −0.5 roster, plus its whole category |
| `declared: 0` worlds — themed content, no `<World>` region mounted | **−5.0** |
| `<Paths>` with no `plazas` | **−2.75** |
| `deadStreetNode`s (a star of degree-1 spurs) | **−2.0** in aggregate |
| each `causewayEdge` ("deck unreachable") | **−1.0 each** |
| no monorail | **−1.0** + an empty TRANSPORT category — **and `preflight.mjs` refuses to bundle at all**, so the real cost is the whole round |
| a `footprints` / `corridor` FAIL anywhere | **caps ride spacing at 0/8** |
| each `crossTheme` piece | **−0.5 each** |
| pinning `exit`/`exitDir` yourself | **−2 per ride** on axis 4 |
| a set-piece with NO `'<id>:<PORT>'` ref in `EDGES` (orphan island) | **~−9** in aggregate — accessibility 1/10 |
| a pad that skipped `offPathCell` (`padOnStreet` auto-move → stacked rides) | **~−3.5**, and `footprints` caps spacing at 0/8 |
| a monorail deck inside a seed's water basin (shrunk body) | **−2.5** — two `terrain` FAILs, `ok: true` unreachable |
| each diagonal `EDGES` pair (auto-elbow + an unplanned node) | **−1.5** for four of them |
| `buildParkNet` called twice (clearances asked of the wrong graph) | **~−1** + a doubled composition cost |
| **`KEEP_DRY = [...NODES]`** — a blanket guard, un-walked, with no water sieve on the dressing | **−7** — `waterRePicked` −3 (centroid 27.1 u off row), `plantedInWater` ×2 for −2 scenery and −2 trees |
| a `<Boulevard>` port-referenced at ONE end (the count assertion passes it) | **−2.0** `deadStreetNode` |
| a `bazaarPlan` under the 3-stall floor — auto-padded, so every pad moves | **−0.25** `padNearStreet` ×3, plus a `rosterOverstated` warning |
| a ride left on its catalog default name (`register={{ name: 'Carousel' }}`) | **−0.5** on the roster axis |

**BEFORE ANY OF THAT: IF THERE IS NO REPORT AT ALL, IT IS ONE OF `preflight.mjs`'s
SIX PRE-BUNDLE GATES — SIX, NOT TWO.** `preflightCheck` (`preflight.mjs:436-456`)
runs five check functions; `checkPreflightHeader` emits **two** problems, so there are
six ways to be refused. Each prints *"N problem(s) in … — refusing to bundle: …"* and
`eval.mjs:48-49` exits 1. **Nothing is compiled, nothing renders, there is no
`validatePark` line to triage** — the symptom looks like a harness failure and is a
one-line omission. **Run `node preflight.mjs samples/<park>.tsx` FIRST, every time.**
All six, in the order they fire:

1. **`checkImports`** (`:400`) — a relative `import` naming a component not in
   `mp3d/components/`: a deleted land macro or a typo. Checked in EVERY local file.
2. **`checkPiecesCast`** (`:410`) — `pieces={… as string[]}` on a ride tag. `pieces`
   is `TrackPiece[]`; fix the type mismatch instead of casting it away.
3. **`checkRatingsWithoutMeasurement`** (`:422`) — an authored `ratings={{ … }}` with
   **no `rateCoaster(` call anywhere in the file.** Call it on the compiled points.
4. **NO §0 PRE-FLIGHT HEADER** (`checkPreflightHeader`, `:388`) — **a MACHINE CHECK,
   not process discipline.** `hasPreflightHeader` (`:373-376`) reads the file's LEADING
   comment block — a `/* … */` block or a contiguous run of `//` lines starting at the
   **first non-whitespace character**; put an `import` above it and the block is `''` and
   you FAIL — and demands BOTH **`length >= 200` chars** (`HEADER_MIN_LEN`, `:344`) AND
   **one `HEADER_KEYWORDS` hit** (`:339-343`):
   `§0` · `PRE-FLIGHT` · `SEED` · `SIZE` · `WORLDS?` · `ROSTER` · `GATE` · `FLAG` ·
   `QUEUE` · `LATTICE` · `SPREAD` · `DRESS` · `MONO(RAIL)?` (all case-insensitive
   except `§0`). Form is not policed; presence is. The §0.0-H template clears it
   easily, so **write the header FIRST and put it at the top of the file.**
5. **`<Park>` has no `roster={{ rides, stalls, categories }}` prop** (`:390`). A correct
   roster line in the §0 header COMMENT does not count; a park shipped exactly that pair
   and lost the round's evidence.
6. **`park mounts NO <Monorail>`** (`checkMonorail`, `:307`). Paste the ring block
   verbatim — **ride-and-stall-roster** Step 3, **park-composition** Step 6, or
   `rules/setup.md` §0-P.4. It became a gate because the prose failed twice, and **there
   is deliberately no marker and no prop value that suppresses it. Build at size 128
   (omit the `size` prop) unless asked otherwise, and ship the ring.**

**The verdict line is not optional and `<Park>` always emits it.** The harness greps for
exactly `[Park] validatePark → ok: true` and `[Park] validatePark FAIL [<check>] …`. A
park relied on `<Park onReady>` alone, produced NEITHER, and was unscoreable. If you
compose imperatively, log those exact strings yourself.

Failures come out in a fixed order, which tells you where you broke something:
**autofix → budget/determinism → accessibility → bounds → paths → terrain →
scenery → footprints → coaster → corridor → blockers → sim.**

Four things that will mislead you:

- **`'budget'` is declared but never emitted.** Over-budget is a `console.warn`
  only — still fatal under §0's policy.
- **`determinism` can never fire from `<Park>`** (it never passes `rebuild`). It is
  still a real rule: hashed-sine PRNGs only, never `Math.random` / `Date.now`.
- **`blockers` is SKIPPED entirely when `manager.blockers()` is empty**, and the
  `corridor` ride-footprint sweep is SKIPPED when a registered coaster has no
  `name`. **Always pass `name` to `<Coaster>`** or you lose the check rather than
  pass it. `paths` only runs when `gridNodeCount` was passed — `<Park>` always does.
- **A passing `accessibility` is NOT evidence your queues are sane** — see below.

---

## `blockers` — guests cannot walk through solid objects

> `street edge 12 (4→5) runs THROUGH Grand Wheel body near (6.2, -3.0) —
> guests cannot walk through solid objects: reroute the street or move the ride`

Every rendered street edge is sampled every **~0.3 u, endpoints included**, and tested
against every registered blocker: ride bodies + boarding pads, stall bodies,
`<Fountain>` basins (a circle), `<Restroom>` huts, **both queue-lane railings**, and
every `<Fence>` run. One failure per edge. Logical access spurs (queue tail, ride exit,
stall front, doorway, gate) are exempt — they ARE the sanctioned way in.

The gate's sweep uses the **raw** shape; the runtime routing layer inflates every blocker
by `BLOCKER_PAD = 0.13`, so an edge grazing within 0.13 u passes the geometric sweep and
is unwalkable at runtime — surfacing as the second half of this check:

> `the Sky Swings queue tail is only reachable THROUGH a solid object (a blocker
> sits across every route from the gate)`

**THE TWO MEASURED CAUSES THAT ARE NOT ABOUT FOUNTAINS OR FENCES — read these
first if your park carries the mandatory ring.**

**(1) A STREET RUN PAST A MONORAIL QUEUE TAIL.** Each tail sits **6.6 u from its deck
along the lane axis**, so a street continuing one more cell past `[−36, −8.4]`,
`[36, −8.4]` or `[0, −57.6]` runs through the platform pad: *`blockers`: street
edge runs THROUGH … pad*. **Those three tails are DEAD ENDS by construction** — author
them as leaves; W and E are approached from the ring's INTERIOR, **SOUTH from OUTSIDE
along z −57.6.** **Only the NORTH tail `[0, 27.6]` may be a through node**, because its
deck is at `z 34.2` with the beam overhead and a row along `z 27.6` passes under it.
r12a failed exactly here.

**(2) A QUEUE LANE LAID ACROSS A STREET — AND IT COSTS SIX FAILURES, NOT ONE.** The lane
is RAILED on both long sides and enterable only at the tail: it is a SOLID. Measured: a
coaster lane run through a street at `x 24.0` produced **2 `blockers` on its own railings
PLUS 4 more** — every ride DOWNSTREAM reported *"reachable only THROUGH a solid object"*,
because the railing severed the single route past it. On a tree-shaped net there is no
second route, so the count is however many rides sit beyond the cut, and the symptom
looks like an accessibility problem elsewhere. **Diagnose by computing the lane span
`[tail − dir·(laneLenOf(cap) + 0.35), tail]` for every ride and checking every street
node AND edge is ≥ 2.4 u off it.** Fix by moving the TAIL (a stub off a junction), never
the street.

Fixes:
- Keep street edges **≥ 1.2 u from a fountain centre**. **A `<FountainPlaza>`'s
  centre 3×3 IS a solid basin** (`r 1.78·scale`), so a carriageway wired to the
  plaza's FAR port crosses it and earns **one FAIL PER CROSSED CELL** — one park
  wired both N/S avenues to opposite ports and paved four edges across the basin.
  Wire the port on the side the traffic comes from.
- Never lay a street across a ride pad or a shop body (see `padOnStreet`), or across a
  `<Restroom>` — and remember **a `<Boulevard>` paves its carriageway as a 1.2-u CHAIN,
  so every cell along the leg is a street node.** One park put a restroom on a boulevard
  carriageway node: 2 `blockers` FAILs and `restroomUses 0`.
- Fencing a boundary a street crosses? **Author TWO runs with a gateway gap** (or
  `<Fence inset>`). A fence across a street is a hard FAIL, not a lint.

```tsx
// ✗ WRONG — one continuous run seals the district off
<Fence from={[-18, 6]} to={[6, 6]} style="hedge" />
// ✓ RIGHT — a gateway where the street at x = -6 crosses
<Fence from={[-18, 6]} to={[-7.2, 6]} style="hedge" />
<Fence from={[-4.8, 6]} to={[6, 6]} style="hedge" />
```

---

## `console.warn` IS NOT A GUARD — `parkAssert`, and why both round-14 parks were wrong

**BOTH ROUND-14 PARKS DOWNGRADED EVERY ASSERTION TO `console.warn` ON PURPOSE** — one
wrote *"a slip becomes a console warning, never a black page"* — after reading *"ship
guards, not advice"* beside *"a `throw` at module scope takes the WHOLE PAGE"*. Nothing
then stopped six hard failures in one park and five in the other. **A warn-only check is
worse than no check: `<Park>` renders anyway, `validatePark` reports the defect anyway,
and the round is scored on it anyway.**

The two lines are about different things. *"A throw takes the page"* is about **PLAN
BUILDERS** (`bazaarPlan`, `boulevardPlan`, `buildParkNet`), which DEGRADE by design.
*"Ship guards"* is about **YOUR OWN CHECKS**, whose hazard is that the FIRST bare
`throw` hides the other nineteen numbers — so separate the collect from the throw:

```ts
// THE ASSERTION BUS — one canonical copy lives in `rules/setup.md` §0-P.5.
// It was published in FOUR files; when the flush was changed to NEVER THROW, all
// four had to be edited in lockstep or a park would paste a stale fatal version.
// PASTE IT FROM THERE: parkAssert(name, cond, detail, sev = 'advisory') collects,
// parkAssertFlush() prints ONE numbered block and RETURNS — it never throws.
```

You get the **full** diagnosis every time, and a structural defect still stops the page
instead of shipping something the gate will charge for. **STRUCTURAL:** cardinal edges ·
port refs · facing-vs-wired · `assertNodesOffPieces` · ring tails are leaves · tails off
ports · the §5c water diff · the pad reach floor · the bazaar stall floor · ≥ 3 scenery
per world. **ADVISORY:** `assertKeepDryOffRow` (a box pre-filter with known false
positives) · the relief diff · the self-score floors. And `probe-skeleton.mjs` rewrites
module-scope throws into collected lints, so the offline loop still prints all twenty.

## `padOnStreet` / `padNearStreet` — pads ON the lattice

**Historically the single biggest defect: ride pads placed straight ON the street
nodes → 20 `blockers` failures and 5 unreachable queues from one mistake.** The
mount-time lint measures the worst pad-rect-to-street clearance over every
rendered node and every edge sampled at ~0.3 u, and needs

```
need = max(PAD_OFF_LATTICE 1.8, padHalf + pathWidth/2 + 0.05)
```

- slab clearance ≤ `pathWidth/2` → **`padOnStreet`, §0-FATAL**. The pad is
  **AUTO-MOVED to `offPathCell`'s own answer** — and the park still FAILS. The auto-move
  is not a rescue; it moves to the number `offPathCell` would have handed you free.
- inside the margin but off the slab → `padNearStreet`, non-fatal.

**`padHalf` IS A MESH PROPERTY, NOT A CAPACITY, AND WE PUBLISHED IT AS A CONSTANT.**
It is the largest half-extent of the rig's RENDERED footprint, so the margin differs
per COMPONENT and `capacity` never enters it. MEASURED demands: `<GhostTrain>` /
`<HauntedMansion>` **4.77** · `<PaddleBoats>` 3.12 · `<Discotron>` 3.07 ·
`<FerrisWheel>` 2.97 · `<AetherBalloons>` 2.95 · compact flats **3.2**. Round 14's
park B put a `<GhostTrain>` through the published `clear: 3.2`, landed **4.42 u**
against a required **4.77 u**, and earned a `padNearStreet` by following our number.
Use `padMarginOf(rig)`; for a rig not in the table take 3.2, probe once and read the
exact margin out of the lint — **it prints the number and the legal cell.**

**AND A `<Bazaar>`'s OWN STALLS LINT `padNearStreet` AGAINST ITS OWN AISLE. EXPECTED,
NOT YOUR DEFECT, PRINTED FIX UNAVAILABLE — REPORT THE COUNT AND MOVE ON.** The aisle is
PAVED into the fused net and every stall anchor sits **1.2 u** off it against §0.14's
**1.2 u** margin, measured **EXACTLY 1.2000 u over row sizes 3-8**, so the test is
`1.20 < 1.20` on a float and which rows trip is float rounding in the `facing`
quarter-turn (6/3/3 → 6 lints · 4/4/4 → 8 · skeleton C → 5). **No configuration clears
it**, `validatePark` still reads `ok: true`, and you cannot "move the pad": the pads are
inside the set-piece and `pinStalls` defaults true. **Never turn `pinStalls` off.** (Full
sweep and the logged design-system defect: **ride-and-stall-roster**, "TWO THINGS ABOUT
A BAZAAR THE AUTHOR CANNOT SEE".)

**AND THE COMMONEST BAZAAR CAUSE IS AUTO-PADDING, NOT A COORDINATE YOU TYPED.**
`bazaarPlan` clamps `stalls` to 6 and **pads anything under 3 up to 3 with a
`'balloon'`** (non-fatal `bazaarStallCount`). `k` sizes the whole piece —
`tiles = 2k + 1`, `half = 0.6·tiles`, ports at `±(half + 0.6)` — so 2 → 3 stalls takes a
row from `tiles 5 / half 3.0 / ports ±3.6` to `tiles 7 / half 4.2 / ports ±4.8`,
**moving both ports 1.2 u out and re-laying every stall anchor.** A park that declared 2
stalls in each of three bazaars and wrote the k = 2 arithmetic in its header collected
**three `padNearStreet` lints at 1.20 u** plus a `rosterOverstated` (`stalls: 6` claimed,
**9** registered). **Fix: declare 3-6 explicitly** — reach the floor with a themed world
stall beside the row
(`NeonSlush` / `SushiStall` / `EmberRoast`, which also buys a kind and novelty),
not with the duplicate BalloonStand the padding gives you — **and count
`roster.stalls` off `plan.slots.length`, the POST-padding list.**

**"1.5 u off a node" READS SAFE AND IS 0.00 u FROM THE SLAB.** The slab is 1.1 wide, so
its centreline owns ±0.55, and a pad half-width of 1.2 reaches 0.05 u past it at 1.5 u
out. A park that authored all three themed stalls at exactly 1.5 u needed the auto-move
on every one.

```tsx
import { offPathCell, pathClearance } from './components/Park';
pathClearance(NET, [9.6, 4.8]).clearance         // 0 → that cell IS a street node
offPathCell(NET, [9.6, 4.8], { clear: 1.8 })     // → [11.4, 4.8] — USE THIS NUMBER
// THE FOUR VALUES, and there are only four. ONE of them is not a constant:
//   clear padMarginOf(rig) — a RIDE PAD. `max(1.8, padHalf + pathWidth/2 + 0.05)` on
//                the rig's RENDERED half-span: a MESH property, capacity never enters
//                it. 3.2 is ONLY the compact-flat default; audited demands run 2.95 u
//                (<AetherBalloons>) to 8.4 u (<GearworksExpress>). NEVER 1.8 and never
//                a hard-coded 3.2. 12-row PAD_MARGIN: park-composition, or setup §0-P.5
//   clear 1.8  — a BUILDING (restroom / hut / hand-placed stall / kiosk)
//   clear 1.2  — any <Scenery>/<Placed> prop
//   clear 0.75 — the TREE SCATTER (wave-18; the scatter is not exempt either)
// Defaults: step 0.6 (half-cell), rings 8 (4.8 u search), margin 1.2.
```

`offPathCell` audits the STREETS plus dryness and bounds and **does NOT know about
your other pads, stalls or scenery** — check its answer against your committed
footprints (pitch ≥ 6 u). **`null` means RE-PLAN THE STREETS** (use a set-piece),
never shrink the rule — that is exactly what a 6-u uniform grid does to a
capacity-10 rig.

### THE AUTO-MOVE IS WHERE `padOnStreet` TURNS INTO `footprints`

**The second failure is the expensive one.** The auto-move sends the pad to the nearest
STREET-clear cell, and `offPathCell` does not know about your other rides, so that cell
can be occupied: one auto-moved ghost train landed **on top of a spinner** for an OBB
overlap, **5 `footprints` FAILs**, and axis 3 capped at **0/8.** One skipped call, two
failure families.

### AND THE CAUSE IS USUALLY A HELPER THAT RETURNS THE RAW SUM

**A DERIVED PAD IS NOT A LEGAL PAD.** This is the version of the mistake that
survives review, because the arithmetic looks right and *is* right:

```tsx
// WRONG — three defects, and round 13's park A shipped all three at once
function place(tail: XZ, out: XZ, capacity: number, front: number) {   // ← invented `front`
  const join = Math.max(2.2, 1.1 + 0.56 * capacity) + 0.35;
  const pad: XZ = [tail[0] + out[0] * (join + front), tail[1] + out[1] * (join + front)];
  return { pad, /* … */ };            // ← the candidate, escaping as a pad
}
//   (1) no offPathCell → padOnStreet auto-moves, and the auto-move STACKS rides
//   (2) clear: 1.8, or a CONSTANT 3.2, instead of padMarginOf(rig) → padNearStreet
//   (3) no check against the LANE MINIMUM → the Discotron's pad ended 4.43 u from its
//       tail against a 9.74 u floor: 9 padOnStreet lints, 6 footprints FAILs
//   (4) no FLATNESS test → a boardPoint on a hill flank at bump 2.25 against
//       validate.ts's 0.75 limit: a hard `terrain` FAIL, −2.5

// RIGHT — `place(tail, out, capacity, rig)`: FOUR arguments, the 4th being the
// COMPONENT NAME that keys padMarginOf. offPathCell THEN assertPadFlat as the last
// two lines, and the reach ASSERTED through parkAssert:
const minReachOf = (c: number) => laneLenOf(c) + 0.35 + 0.62 + 0.5 + 0.45;
//   cap 4 → 5.26 · cap 6 → 6.38 · cap 8 → 7.50 · cap 10 → 8.62 · cap 12 → 9.74
  const clear = padMarginOf(rig);                                  // NOT 1.8, NOT 3.2
  const onStreet = (offPathCell(NET, cand, { clear }) ?? cand) as XZ;
  const pad = assertPadFlat(onStreet, clear, rig);                 // ← terrain, not streets
  parkAssert('padReach', Math.hypot(pad[0] - tail[0], pad[1] - tail[1]) >= minReachOf(capacity) + 1.2, /* … */);
```

**`front` IS NOT A PARAMETER.** It is `layout.front`, frozen into the component at
`composableRide()` time (default 1.8; `<Discotron>` 4.0, `<BumperCars>` 2.6) and
unreadable while authoring. **The whole corrected helper — `PAD_MARGIN` (12 rows),
`padMarginOf`, `PEAK_LIMIT` + `bumpAt`, `assertPadFlat`, `minReachOf` and
`place(tail, out, capacity, rig)` — is paste-able in the `park-composition` skill's
pad section and in `rules/setup.md` §0-P.5, which arrives with every request.** Copy
it from either; pads are `park-composition`'s subject and a third copy would push this
skill past its size ceiling.

The pad derived from a tail is a **CANDIDATE**; `offPathCell` is what turns it into
a pad. Only two coordinates in the whole park are exempt, both published poses with
measured clearances: a §4.0 archetype's `start` and the monorail's `position`.

### AND A SET-PIECE'S `position` IS NOT A NODE AND NOT A QUEUE TAIL — ~11 POINTS

**The most expensive single coordinate in the corpus.** A park wrote
`fountainPlazaPlan({ id: 'viewpoint', position: [50.4, −8.4], tiles: 9 })`, put
`[50.4, −8.4]` in `NODES` as index 20, AND used it as the queue tail of BOTH the
Sunspire Tower and the Discotron. One cell, three roles: **`edgeThroughSolid` ×2**
(§0-FATAL) · a **DROPPED edge** · **1 orphan island** · the **`accessibility` FAIL** ·
the tower **unreachable** · **5 of 6 `footprints` FAILs**.

A plaza is a **paved SOLID basin**. Its connectors are its **PORTS**, one lattice cell
outside the footprint: wire `'viewpoint:W'` and stand the node outside. An edge aimed at
the piece's `position` is an edge through solid paving, which the fuse DROPS — taking the
satellite's whole sub-net with it.

**GREP FOR IT:** take each `plan({ position: [x, z] })` literal and search your own
`NODES` array and every `queueTailNode` / tail const for the same pair. Then paste
`assertNodesOffPieces(NODES, ALL_PLANS)` (**park-composition** Step 4) so it cannot
recur; its clearances are `FountainPlaza: 1.8` off the paved pad, `Bazaar: 0.6` off
the `footprint.hz` of 1.8 (= 2.4 u off the aisle, which is what the stall rows at
±1.2 need), `Boulevard: 0` because its carriageway IS a street.

### AND CHECK WHICH `NET` YOU ASKED

**`buildParkNet` must be called EXACTLY ONCE.** If your file has two nets, every
`offPathCell` answer is only as good as the net it was asked. Round 12 fused `NET`
(without a late viewpoint plaza) and `NET2` (with it), asked `NET` for every pad,
prop and tree cell and paved from `NET2` — so a **116 u²** plaza was invisible to
every clearance in the park. `validatePark` cannot report this: it audits the one
graph `<Paths>` gave it. Declare every piece in one `pieces:` array, fuse once, and
pass that `NET` to both.

---

## `accessibility` — BOTH SIDES of every station

Since 2026-07 this check has two halves, and the second one is new:

| detail | condition | fix |
|---|---|---|
| `no registered park entrance` | no `registerParkEntrance` | mount `<Gate/>` |
| `X: queue tail never attached to the path graph` | the anchor was non-finite | a real number for every queue coordinate |
| `gate cannot route to the X queue tail` | no path in the graph | the graph is disconnected — see below |
| **`X has no path leading from its exit`** (check **a4**) | `exitLaneLen === 0`, or its spur does not route back to the gate | RCT2 blocks `Ride::open` on a MISSING exit and red-flags an UNPATHED one (`STR_EXIT_NOT_CONNECTED`, Ride.cpp:2076). Here it is a hard FAIL because this sim has no terrain-walking `falling` state — the guest is left OFF-GRAPH |
| **each PLATFORM of a multi-station ride** (check **a4b**) | walks `accessPoints().rides[i].stations[]` and fails each on its own routable `queueNode` and its own `exitLaneLen > 0` | **a monorail platform guests cannot walk to is not a station.** Three of four boarding points used to go entirely unaudited |
| `park gate spawn sits N u inside the terrain edge` | `size/2 − max(\|x\|,\|z\|) > max(1.25, size·0.025)` — **3.2 u at 128** | leave `<Gate/>` bare (it snaps to `[0, 63.6]`) and put a street node under that cell |

**THERE IS NO ATTACH-DISTANCE TOLERANCE.** `routing.attach` links a logical node to the
*nearest* street node at ANY distance, so a queue tail 20 u out in the grass still
"attaches" and still routes. The defect then surfaces as `bounds`, `laneTrim`,
`footprints` or `blockers` instead. **A passing `accessibility` is not evidence that your
queues are sane.**

Disconnected graphs come from four sources. **The first is by far the most expensive
defect in the corpus** — it cost round 12 about **9 points on its own**:

0. **A SET-PIECE WITH NO PORT-REF IN `EDGES`.** `pieces:` and `worlds:` put a piece's
   INTERIOR sub-net into the graph and join it to **nothing**; only an `EDGES` entry
   `'<id>:<PORT>'` connects it. **A piece passed only via `pieces:`/`worlds:` is
   DECORATION, not a place** — an orphan island, unreachable stalls, a plaza off the
   walk.
   * **Symptom:** `netWarnings: node [x,z] is in a SEPARATE island — no walkable route
     from the gate street`, a low `gateReach` fraction, stalls with zero uses, and
     **`accessibility` 1/10** even though every ride is fine.
   * **Measured:** `EDGES` referenced `hub:N`, `hub:E`, `hub:W` and nothing else —
     `pulseRow`, `worksRow`, `gladeRow` and `viewpoint` had ZERO refs. Result:
     **2 orphan islands · gate-reach 103/127 = 0.811 · three Bazaar stalls
     unreachable · one `edgeThroughSolid` · accessibility 1/10.**
   * **FIX — a COUNT for every piece, and BOTH ENDS for a chain piece, before the
     fuse.** The bare count is what one park passed while still shipping a
     `deadStreetNode`: it referenced `'ave:A'` and never `'ave:B'`, and because both of
     `<Boulevard>`'s ports are **`prunable: false`** (`buildParkNet` prunes an unwired
     STUB but never SHORTENS an avenue), the avenue paved to full length and stopped
     **7.2 u short of the plaza, in grass.** Read `pt.prunable` off the plan, never a
     kind list. **And `ALL_PLANS` must NAME the world bazaar rows**, never
     `...WORLDS.flatMap(w => w.pieces)` — `WORLDS` reads the pads and is declared BELOW
     the fuse, so that spelling is empty here.

     ```ts
     const CHAIN_END_OPT_OUT = new Set<string>([/* 'ave:B' — ONLY when something real
       stands on that terminus, e.g. a bare <Gate> on it */]);
     const PORT_REFS = EDGES.flat().filter((x): x is string => typeof x === 'string');
     ALL_PLANS.forEach((p) => {
       const wired = new Set(PORT_REFS.filter((r) => r.split(':')[0] === p.id).map((r) => r.split(':')[1]));
       parkAssert('pieceIsland', wired.size > 0,
         `set-piece '${p.id}' has NO '${p.id}:<PORT>' ref in EDGES — it composes as an ISLAND`);
       p.ports.filter((pt) => !pt.prunable).forEach((pt) => {     // READ THE FLAG off the
         if (wired.has(pt.name) || CHAIN_END_OPT_OUT.has(`${p.id}:${pt.name}`)) return;
         parkAssert('chainEnd', false,                            // plan, never a kind list
           `chain piece '${p.id}' (${p.kind}) wires [${[...wired]}] but NOT '${p.id}:${pt.name}' — that end ` +
             `of the carriageway dead-ends in grass (deadStreetNode). Wire it, and READ THE ENDPOINT OFF ` +
             `THE PIECE: boulevardPlan({ from: HUB.port('W'), to: MARKET.port('E') }) — never retype the cell.`);
       });
     });
     ```
   * **Build a chain piece's ENDPOINTS off its neighbours, not by hand.**
     `boulevardPlan({ from: HUB.port('W'), to: MARKET.port('E') })` makes the avenue's
     end nodes BE its neighbours' port cells, which `buildParkNet` MERGES, so the 7.2 u
     gap cannot be typed into existence. A park wrote `to: [-13.2, 45.6]` against a
     `hub:W` port at `[-4.8, 45.6]`.
   * **An edge into a piece's POSITION is not a port-ref.** Wiring a node that *is* a
     `<FountainPlaza>`'s centre drives the street through its solid 3×3 basin;
     `buildParkNet` cuts and reties it to the port and records a §0-FATAL
     `edgeThroughSolid`. Write `'viewpoint:W'`, never `viewpoint.position`.
1. **A crossing that is not a junction.** Two edges crossing with no node there is a
   dead end guests can never turn at. `buildParkNet` **splits every edge at any node
   lying on it**.
2. **A pruned port.** `buildParkNet` drops any prunable port with degree ≤ 1 (its own
   interior edge counts as 1). If you wanted a queue tail there, run a street edge off
   it first — and ask only for the ports you will wire.
3. **An edge a fatal lint DELETED** — `latticeInWater`/`causewayRefused`, below.

**AND A DIAGONAL `EDGES` PAIR MANUFACTURES A NODE YOU DID NOT PLAN.** `buildParkNet`
repairs it with an ELBOW through a synthesised corner, which a hand-sited pad can land on
and a corridor sweep can cross — one bad coordinate becoming `edgeDiagonal` +
`padNearStreet` + a corridor FAIL. One park shipped **four**; another shipped one the
check could not see.

**DO NOT SKIP THE `NetRef` STRINGS — RESOLVE THEM.** An older form said "PORT refs are
strings, so SKIP them", making the check **blind by design on exactly the edges most
likely to be diagonal** — a port cell is *computed*, so it is the endpoint you cannot
eyeball. A park copied that skip and shipped `['pulseRow:W', 6]` running
`[43.2, 8.4] → [22.8, −8.4]`: diagonal, unseen, elbowed, and the synthesised elbow node
became a dead stub.

```ts
const portCell = (ref: NetRef): XZ => {
  if (typeof ref === 'number') return NODES[ref];
  const [id, name] = ref.split(':');
  const p = ALL_PLANS.find((q) => q.id === id);
  if (!p) throw new Error(`EDGES references '${ref}' but no plan has id '${id}'`);
  return p.port(name);
};
const EPS = 1e-6;   // four orders of magnitude under the 1.2 lattice — it cannot hide a real one
EDGES.forEach(([a, b]) => {
  const A = portCell(a), B = portCell(b);
  parkAssert('cardinalEdge', Math.abs(A[0] - B[0]) < EPS || Math.abs(A[1] - B[1]) < EPS,
    `edge ${a}→${b} is DIAGONAL: [${A}] → [${B}]. buildParkNet ELBOWS it through a synthesised ` +
      `corner node you did not plan. FIX THE TABLE: move one endpoint to share an x or a z.`,
    'advisory');   // ADVISORY ON PURPOSE — buildParkNet REPAIRS this, so the park still renders
});
```

**THE TOLERANCE IS LOAD-BEARING.** Port cells are computed as `tiles · 0.6 + 0.6`, and in
binary `7 * 0.6 + 0.6` is `4.799999999999999`, so a strict `!==` against an authored `4.8`
throws a FALSE diagonal and blacks the page on a legal park — the very failure the "skip
the strings" advice was written to dodge.

`NET.warnings` reports islands and diagonals before you mount anything, and every entry
is a §0-FATAL **`netWarnings`** plan lint, so `validatePark` cannot return `ok` over one.

---

## `paths`, `causeway`, `causewayRefused`, `latticeInWater`, `pathClipping`, `rampRefused`

**The street now FOLLOWS THE LAND.** `<Paths>` solves a **per-node surface** that
clears the ground across the FULL slab width and ramps between nodes inside the
walkable grade (**0.5 u of rise per 1.2-u tile**, grade ≈ 0.42). Level selection:

```
nodeGrounds  = every node's groundAt
medianGround = sorted[floor(n/2)]           // upper median
spread       = maxGround − medianGround
LEVEL_SPREAD = 0.35
if (author gave nodeY / [x,z,elev] triples || spread <= 0.35)  pathY = maxGround + 0.03
else  pathY = medianGround + 0.03, and every node > 0.35 off gets an AUTO RAMP
plazaY = pathY + 0.096
```

| lint | condition | fatal | effect |
|---|---|---|---|
| `pathLevelMedian` | the median rule engaged; outlier nodes got auto ramps | no | author them as `[x, z, elevation]` triples to silence it |
| **`pathClipping`** | the walked surface sits > **0.25 u UNDER the terrain**, or > **1 %** of the corridor is buried | **yes** | **REROUTE along the contour or add intermediate nodes — never widen the tolerance** |
| **`rampRefused`** | an auto-ramp, CLAMPED to 0.20 u, still leaves the node > 0.35 u off its ground | **yes** | author the ramp as a triple over a STRAIGHT multi-node run, or move the node |
| `causeway` (node) | `pathY > medianGround + 0.8` | yes | one node on a rise lifted the whole net |
| `causeway` (span) | worst span lift > `CAUSEWAY_LIFT 1.0` and ≤ 2.0 | yes | built, on a viaduct |
| `causewayRefused` | a span's lift > `CAUSEWAY_HARD 2.0` | yes | **the edge is NOT BUILT** |
| `latticeInWater` | any of 13 samples along a span has ground `< waterLevel + 0.05` | yes | **the edge is NOT BUILT** |
| `paths` FAIL | a diagonal edge survived into the rendered net | yes | every edge cardinal; `buildParkNet` auto-elbows one, and the elbow is itself §0-FATAL |

**The auto-ramp cap is 0.20 u and it is not arbitrary.** A +0.36 auto-ramp on a street
node let a stall's guest point 0.48 u away inherit the un-ramped level — a **0.74
grade** against the 0.42 maximum, on an edge the ramp lint never sees. So every
auto-ramp is capped by the grade budget of the shortest edge that can meet the node,
and a 0.48-u access spur is the binding term: `0.42 × 0.48 = 0.20 u`.

**READ THE REFUSALS AS ONE CAUSAL CHAIN.** A deleted or refused span leaves a HOLE in
the graph, so the next failures are `accessibility` and `blockers`-unreachable for
everything behind it. Those are DOWNSTREAM — fix the span and they vanish.
**`causewayEdges` must be EMPTY, and each one is −1.0**; one park shipped 5, i.e. rides
that were built, rated and unridable.

> ### ⚠ FIRST: MOST "deck unreachable" LINTS ARE AN ARTEFACT — **+1.00** ON AXIS 12
>
> `wrappersLand.tsx:641` passes `renderEdges: bEdges.length`, so `build.ts:177` lints
> **only the STREET prefix**; `build.ts:301`'s BFS seeds at `|nodeY| <= 0.05` over those
> edges only; a spur INHERITS its parent's `nodeY` (`wrappersLand.tsx:626-632`). **So a
> spur off a parent above 0.05 reads unreachable at a measured grade of 0.00** — across
> `skeleton-a`/`skeleton-b`/`r16b`/`r15a`, **100 % of flagged indices were
> `>= streetNodes`** (all spurs), `maxGrade` **0.03** vs the `MAX_SLOPE` cap **0.4167**.
> **FIX: attach every queue tail, exit lane, stall front and restroom to a street node
> with solved `|nodeY| <= 0.05`.** `skeleton-a`'s unsafe nodes are exactly
> **{10, 11, 13, 26, 80, 82, 84}** — **61 of 87 safe**, `skeleton-b` 41 of 58, listed by
> `probe-skeleton.mjs` in ~2 s. Six of the seven sit within **0.031** of the threshold —
> re-probe after any terrain edit. Near the 0.4167 cap it IS a real `causewayEdge`.

Fixes, in order of preference:
1. **Get the whole SPINE into `keepDry`** — every 1.2 step along every edge, not
   just the nodes. `buildParkNet` builds exactly that list; use `NET.keepDry`. A
   nodes-only list is what lets a span cross an unguarded river bank.
2. **Reroute along the contour**, or add an intermediate node on the bank so the
   span is short.
3. **Ramp to it** with an `[x, z, elevation]` triple — but note that giving ANY
   node an explicit height switches `pathY` back to the max-based rule, so do it
   deliberately. Sloped runs go STRAIGHT: no bends or junctions mid-slope, and
   every elevated node needs a walkable route down.

Expect visible cut-and-fill: under 0.35 u of float a span gets an earth berm,
above it RCT2 wooden trestles. **That is the intended look, not a defect.** And
**plazas level TILE BY TILE**, so a plaza on a rise STEPS — put plazas on the flat
(`plazaTilesClamped` if you don't).

---

## `terrain` — and it charges ONE FAIL PER RECT

| detail | condition | fix |
|---|---|---|
| `N water bodies below the waterline (the composition demands exactly 2)` | flood fill on a 0.45 grid, 4-neighbour, `heightAt < waterLevel`. **`waterBodyTarget` is TWO — a dominant body plus a secondary.** The secondary must be ≥ **16 %** of the dominant and ≥ `max(5, 0.055·size)` = **7.04 u** clear of it at 128 | your `keepDry` list severed or merged a body — re-route around it. 3+ is a scatter FAIL; zero also fails |
| `X is parked on a hill flank (peak contribution 0.9)` | smoothstep peak contribution at the footprint **centre** > 0.75 | move the footprint off the peak's radius |
| `X stands in the water` | min of centre + 4 corners of the yawed rect below `waterLevel + 0.05` | keepDry that cell and move the rig onto dry land |
| `entrance apron dips below the waterline` | any apron sample `< wl + 0.1` | apron rect is `x ±2.2, z size/2−3.6 … size/2−0.4` |
| `entrance apron relief 0.71 > 0.5` | max **absolute** height over the apron > 0.5 | keep the forecourt flat; no peak near the gate |
| `composition probe unsatisfied` | probe violations survived clamping | move what sits on the offending ground; trim the keepDry list |

**ONE FAIL PER RECT is what makes this expensive.** A ride brings a pad, two huts, two
lane rects, two exit rects and two joins — one teacups rig inside seed 91's published
peak (15.2, −41.3) h 4.3 r 13.8 collected **11 `terrain` FAILs** and `ok: false` from
that single placement. So walk **every built cell** (pad · BOTH huts · queue tail ·
queue lane · exit join) against the row's peak discs `(x, z) h R` BEFORE you mount, and
require no two of them differ by more than the walkable grade.

### `waterRePicked` / `waterShrunk` / `waterGrew` — the seed table is PRE-`keepDry`

`waterRePicked` is a **§0-FATAL gate finding**, and it NAMES the `keepDry` cells
that sit inside the row's wet radius. The composer probes candidates and re-picks
the body the moment your guard list overlaps the listed disc: one cell inside a
published box — or within ~12 u of a centroid — moves that body.

**DO NOT WALK IT ON PAPER. THE PAPER WALK HAS BEEN ASKED FOR THREE TIMES AND NEVER ONCE
DONE CORRECTLY.** One park transcribed `secondary inlet box x[−56..−21] z[23..39]` into
its own header and then put 16 guard cells at x −28.8, z 28.8-33.6 — *inside the box it
had just written down* — moving the body **70.7 u**. Another skipped the walk and wrote
its CONCLUSION into the header instead (*"verified ring-clean; both water bodies stay
put"*) over a `const KEEP_DRY: XZ[] = [...NODES];` of which `[22.8, −27.6]` sits in
seed 1's dominant box and `[−31.2, 30.0]` in its secondary: **secondary centroid 27.1 u
off the row, −3.** **A claim in a comment is indistinguishable from a check that ran; an
assertion is not.** **park-composition** Step 1 (and `rules/setup.md` §0-P.6) ship the
row table as `SEED_ROW_WATER` and the walk as
**`assertKeepDryOffRow(KEEP_DRY, SEED_ROW)`**, which names every offending cell.

**AND THE SIEVE IS NOT THE AUTHORITY — THE RE-COMPOSE IS, AND SINCE WAVE 16 IT IS
EXECUTABLE AT MODULE SCOPE.** `assertKeepDryOffRow` tests PUBLISHED bounding boxes, so
it can miss a cell and can false-positive in a box corner. **Measured wave 17: the boxes
are narrower than the real basins.** Seed 1's secondary box is `x[−56…−21]`, but its
bowls reach **`x −18.1`** — 2.9 u outside the wall — so a street column at **`x −19.2`
crossing `z 23…39`** clears the assertion silently and still moves that body **25 u**.
If you are staring at a `waterRePicked` on a park whose `assertKeepDryOffRow` passes,
**that is what happened; the sieve was only ever a pre-filter.** Compose the water
twice, with and without your guard list, and diff the centroids:

```ts
import * as THREE from 'three';
import { parkComposition } from './components/ParkBuilder';   // NOT the Park barrel
// TWO TRAPS: the signature is POSITIONAL — (t, seed, size, climate, guards) — and
// `size` DEFAULTS TO 48, so pass 128 or you audit a different park. There is NO
// `comp.isDry`. (`t` is accepted and unused, so the namespace import is free.)
const BARE = parkComposition(THREE, 1, 128, 'temperate');
const COMP = parkComposition(THREE, 1, 128, 'temperate',
  { keepDry: GUARDS, coasterPts: ALL_COASTER_PTS });    // GUARDS = keepDryOf(NET, SEED_ROW),
                                                        // NEVER NET.keepDry raw
const moved = (a: XZ | null, b: XZ | null) =>
  a && b ? Math.hypot(a[0] - b[0], a[1] - b[1]) : a === b ? 0 : Infinity;
// > 6 u on EITHER body is the §0-FATAL waterRePicked. And the dryness predicate for
// every hand-placed cell comes from the COMPOSED basins, at the 0.74·radius waterline
// `ParkBuilder/dressing.ts` itself sieves with (full block: §5c of the rules).
// THREE BASIN LISTS, NOT TWO: `COMP.clampBasins` — the shave discs the guard clamp
// digs — are ABSENT from `COMP.basins`, and <Terrain> builds its water from
// `[...comp.basins, ...comp.clampBasins]` (`-validation.md` §7). Omit the third list
// and a cell reads `dry: true` here and composes **3.9 u UNDER water.**
const isDry = (c: XZ, margin = 1.2) =>
  [...COMP.basins, ...COMP.basinsSecond, ...(COMP.clampBasins ?? [])].every(
    (b) => Math.hypot(c[0] - b.x, c[1] - b.z) > 0.74 * b.radius + margin);
```

**`park.isDryCell` is the MOUNT-TIME version and a vacuous pass at module scope** — on
an unmounted park it answers `true` for everything, so a sieve built on it that drops
nothing has not run. The basin walk above needs no park. A park passed `keepDry: []`, let
`NET.keepDry` fill itself from the piece cells, and shipped guards into seed 1's
secondary waterline anyway: fatal `waterRePicked`, **centroid moved 70.7 u**, one refused
tree.

**And `KEEP_DRY = [...NODES]` is the shape to grep for.** Wrong in both directions: it
guards far-corner nodes that exist only to spread the street bbox (the ones most likely
to sit on a bowl) and none of the pads, huts, lanes, stall anchors or prop cells you
actually place. **Guard what you PAVE**, and **if a district must live on a bowl, pin a
different seed row** — do not "plan around the shoreline" of a body your guards will
move. `waterShrunk` fires under 75 % of the row's area, `waterGrew` over 133 %; a park
that keeps clear reads 0.99-1.00× (the composition is deterministic), one that did not
read **1.79×**.

Then re-check every hand-placed cell against the COMPOSED body — and **sieve the list
rather than lose the props** (a wet cell is REFUSED, not moved, so you pay the lint AND
come up short on the count):

```tsx
const park = usePark();
park.terrain?.water          // { x, z, r } — the ACTUAL body, post-guard
park.isDryCell([x, z])       // whole 1.2 cell: centre + 8 ring samples
// in a CHILD mounted after <Terrain>:
const dry = CELLS.filter((c) => park.isDryCell(c.at));
```

**THE CELLS THAT DO THIS MOST OFTEN ARE NOT YOURS — THEY ARE THE MONORAIL RING'S.**
Every park ships §4.2-A, which contributes **16 fixed ground cells** to `keepDry`
(4 decks, the start pose, 4 queue tails, 4 queue anchors, 3 exit huts), sitting in the
outer third of the plot where seeds put their secondary bodies. Measured: on **seed 7
temperate** the West deck `[−42.6, −8.4]` sits **6.66 u** from the secondary tarn's basin
centre `(−48.6, −11.3) r 12.6` — **2.64 u inside** the 9.3-u waterline. `keepDry` lifted
it, the tarn shrank **405 → 144 u²**, `secondFrac` fell **0.53 → 0.15** against the 0.16
floor, and the park took **two `terrain` FAILs** with nothing else wrong with its water.
Seed 7 draws that tarn under the West deck in every climate.

**THE CHECK, and run it BEFORE pinning the seed:** re-compose with **only** the ring's
cells as `keepDry`, diff `terrainSeed` / `waterCentre` / `waterCentreSecond` /
`probesTried` against the unguarded row, **and read the four DECK HEIGHTS.** Measured
over all 16 published rows, **THREE are ring-clean with DRY decks — 1 temperate,
31 temperate, 91 desert.** **`53 coastal` passes the whole diff and is still unusable:
its WEST DECK stands at `h −0.06`, in the water.** Of the other twelve, **nine move a
water body 24–117 u** (worst: 42 alpine **117.1**) and three change the landform identity
or pay 36-90+ clamp discs — **refuse all twelve.** Pin `seed 1 / temperate` (mid-band
relief, water, `secondFrac` 0.38), `seed 31 / temperate` (relief 12.02 / stdH 1.32 ABOVE
the band, so `terrainFlattened` cannot fire) or `seed 91 / desert` (what the verified ring
reference ships), and **if a basin collides, translate the ring rigidly** inside its legal
start range (x ∈ [−63.6, −21.6], z ∈ [−22.8, 20.4] at 128) — all 16 cells move with it.
Re-check any row: `node harness/park-eval/probe-guard-stability.mjs samples/<park>.tsx`.

### `terrainFlattened` — your own guard list erased the mountains

`keepDry` does TWO jobs: it guarantees a cell dry **and it CAPS every hill peak near
it** to do so (`coasterPts` likewise). Measured: two parks on the SAME seed 7 / coastal
/ 128, differing ONLY in guard lists, composed relief **11.26** and **5.50** (`stdH`
1.04 and 0.62) — the second below every published 128 row (band: relief 8.15-16.60,
stdH 0.76-1.45) and below axis 7's `stdH ≥ 0.75` floor.

The gate names the guard cells and the range each cut. It is §0-FATAL only on the
CONJUNCTION **`reliefFloor.kept` < 0.70 AND `reliefFloor.stdH` < 0.76** — read both off
`comp.report.reliefFloor`; either alone is non-fatal, because a big layout must flatten
its own pads and a `plains` seed is legitimately gentle. **AND THE CLEARANCE THAT MAKES
IT PLANNABLE: `capPeakForCells(p, keep, 0.35)` shaves a peak to `0.35 / s(d)`, so a
guard cell must stand ≥ 10.62 u from a summit to cost that peak NOTHING.**

Fixes: **guard only what you PAVE or stand a structure on**; **keep guards OFF the
peaks** the seed drew; and where you only want bare ground, use **`<Terrain noDress>`**
(suppresses planting, touches the heightfield not at all). Measured: adding a reference
park's 32 PLANTED cells to `keepDry` cut one range 3.10 → 0.89 and left it keeping 68 %
against the 70 % floor. **A tree needs DRY ground, not FLAT ground.** Check up front
with `node harness/park-eval/probe-relief-floor.mjs`.

**AND NEVER PLAN A CLEARANCE OFF A PUBLISHED RANGE/PEAK BOX — THOSE ARE THE *UNGUARDED*
COMPOSITION.** A dense 128 layout can push the primary range into a **guard-BLIND
phase-1 fallback slot** the unguarded row does not show. On seed 1 temperate that is a
five-peak ridge along **z ≈ −43**, summit **(5.33, −42.89) h 8.59 r 12.09**,
byte-identical in two parks with different guard clouds, with a CONTINUOUS skirt from
**x −23 to x +38.6** — so the only dry southbound corridors are `x ≤ −23` and
`x ≥ +38.6` (the latter is the SE lake). Probe the GUARDED composition, not the row.

**AND TWO MORE CAUSES THAT ARE NOT ABOUT `keepDry` AT ALL — CHECK BOTH BEFORE YOU
START MOVING GUARD CELLS.**

**(1) THE FLAGSHIP IS ON A FLANK. That is the FATAL version.** `coasterPts` caps
peaks along the whole circuit, and the composition anchors its ranges **on the
FLANKS** — `reliefBias inner` is **0.18**, so the core is gentle by construction and
the flanks carry ~2.4× the relief. Measured on one park, moving ONLY the flagship:
**flank → kept 69 % (floor 70 %) AND stdH 0.69 (floor 0.76) — both halves of the
conjunction, §0-FATAL. Plot CORE → kept 73 %, and the same finding demotes to a
warning.** A ~30 × 30 u circuit in the gentle centre costs almost no relief. **Put
the flagship in the core; do not shave guard cells trying to rescue a flank.**

**(2) THE RING'S SOUTH QUEUE ON SEED 1 TEMPERATE — AND IT IS *NOT* IRREDUCIBLE, WHICH IS
THE OPPOSITE OF WHAT THIS PAGE USED TO SAY.** The tallest range sits at ≈**(5, −43)
h 8.59**, inside the SOUTH platform's INWARD approach: the tail `[0, −44.4]` and the
column paved to it stand **5.3–5.8 u** off the summit and cut it to **0.83** — `kept`
0.74 / 0.73, `terrain.stdH` 0.73 / 0.71, under axis 7's 0.75 floor, **−1.5**. **QUEUE
THE SOUTH PLATFORM OUTWARD** (tail `[0, −57.6]`, `queueDir [0, −1]`, approached from
OUTSIDE along `z −57.6`, down the `x ≤ −23` corridor) and both reference skeletons read
`stdH` **0.81** / **0.79**, `kept` **0.82** / **0.81**, axis 7 **9/9**, totals
**97.68** / **93.40**, and `gateWarningKinds` **`{}`** — GONE. **So do NOT accept this
finding on a seed-1-temperate ring park as "the documented ring-park warning": check
the South queue side first.** The South DECK is 9.70 u from the summit against the
10.62 u free-clearance floor and cannot move, so 3.45 of the 8.59 still goes — this
pose's ceiling. **Do NOT shift the ring west** to chase the rest (it drops the West deck
inside a world rect). Or **pin 31 temperate**: guarded relief **12.02 / stdH 1.32**,
ABOVE the band, so the finding cannot fire at all.

---

## `scenery` / `plantedInWater` / `plantedWetCell`

Every `<Scenery>` and `<Placed>` registers its **ground-contact** footprint (the
XZ extent within 0.45 u of its base — a tree canopy may overhang a path, its trunk
may not). Two tests:

- **Dryness**: centre + 8 ring samples at radius `r`; fail when the min ground is
  `< waterLevel + 0.05`.
- **In the street**: fail when `distanceToEdge + 0.1 < pathWidth/2 + min(r, 0.6)`.
  With the default 1.1 slab that is 1.05 u for anything with a 0.6-u base — **use
  1.2 u (one cell) and stop thinking about it.** Plaza interiors are exempt. One
  failure per piece. `<Park>` never passes `pathWidth`, so the check always assumes
  1.1 even if you set `<Paths width>` differently.

**EVERY hand-placed cell comes from `offPathCell(NET, cell, { clear: 1.2 })`** —
not the ones that look close, all of them. Two cells are a FAIL by definition, and
both are what hand-typing produces:

- **a cell that reuses ANY street node's coordinate, even just one of the two.**
  Typing a prop at a street row's own `z` puts it on that row's centreline. One
  park hand-typed 18 props and put **six on street axis values, four at z = 45.6**
  — its own ring's north edge — for six FAILs it could have avoided with six
  function calls.
- **a cell lying on an authored edge's centreline** between two nodes.

**AND A BUILDING IS NOT A PROP.** A `<Restroom>`, a hut or a hand-placed stall is
a SOLID with a doorway: `{ clear: 1.8 }`, and **never a coordinate that is also a
`boulevardPlan`'s `from`/`to`, or any cell along its 1.2-u carriageway.**

Also: **a `<Boulevard>` plants its own verge trees at ±2.45 u**, so every street
node its carriageway meets — **its own TWO ENDPOINTS included, not just
T-junctions** — must be in that plan's `avoid` at **`clear: 2.6`** (2.4 misses the
trees by 5 cm). Otherwise the crossing slab runs under the boulevard's own tree
and the FAIL names it.

At mount time the wrapper also refuses wet plantings: `≥ wl + 0.05` passes;
between `wl − 0.4` and `wl + 0.05` is a non-fatal `plantedWetCell` (the settle-time
AUTO-keepDry pass raises a dry bank under it); deeper is a **§0-FATAL
`plantedInWater`** and the piece is not mounted at all.

And colours: `<Neon color>` and every `colours` field are typed `number`, so
**`0xffcf6b`, never the CSS string `"#ffcf6b"`** — a type error at the call site.
Take the value from a ColorKit preset or `RCT2_COLOURS` instead.

---

## `corridor` — the tracked ride's 1.6-u corridor

```
CORR_HALF   = 0.8    // the corridor is 1.6 u wide
CLEAR       = 2.2    // vertical clearance needed to fly OVER
STRICT_HALF = 1.1    // the 2.2-u keep-clear re-sweep
ROOF_CLEAR  = 0.3    // clearance over the obstacle's own roof
```

Roof heights used by the strict re-sweep: entrance/exit hut **1.5**, queue lane
**0.45**, boardPoint pad **0.6**, stall **2.1** (canopy), anything else 1.2.

| detail | fix |
|---|---|
| `the 1.6-u track corridor runs through <label> with only X u of clearance (flying over needs ≥ 2.2)` | move the object out of the listed cells |
| `<label> sits under/beside the rails` | a relocated/derived hut is NOT exempt — re-plan the cell |
| `the <name> stall sits under/beside the rails` | stalls are never exempt by owner; move the stall |
| `street edge N crosses the track corridor at grade near (x, z)` | **reroute the street or MOVE THE RING. Street grade crossings are NEVER auto-fixed.** |

**THE VALLEY LEGS DO NOT FLY, so "it crosses the ring" is never OK.** The four valley
floors and the station leg of a §4.0 rectangle run **~0.6 u above path level** — under a
third of the 2.2-u gate. A street may cross ONLY under a LIFT/HILL measuring ≥ 2.2 u there
(the apex legs, rails 2.2-6.05 u). **And if the hub axis intersects the ring, MOVE THE
RING, not the street** — one lattice translation, and the corridor table moves rigidly
with it.

**Copy the published corridor cell tables** (coaster-pieces skill), add your `(dx, dz)`
offset, **and write the result into your §0 header as a rect in PLOT coordinates** — then
check every street node and every boulevard leg against it. The tables are
size-independent and translation-invariant. At runtime, `manager().corridorCells(name?)`
returns the live list.

The ride's OWN access assembly is exempt, matched **by ride name** — which is why an
unnamed `<Coaster>` skips the whole ride-footprint sweep. The monorail ring's own 836
corridor cells are all **2.45 u up**, so none is in the LOW corridor; they are only where
the PIERS land, so a street may cross a leg but must not run ALONG one.

If the settle-time resolver moved something for you, that is `corridorShift` /
`corridorExitRelocated` / `corridorLaneTrim` / `corridorPinned` /
`corridorUnresolved` — **all fatal. A self-heal is a report, not a pass.**

---

## PROPS THAT SILENTLY DO NOTHING — the failure with no lint and no error

**A prop name the chassis does not recognise is swept into `...rest` and dropped.**
There is no warning, no red mesh, no `validatePark` entry and no console line: the
component simply uses its default and the park is wrong somewhere else. These are
the two that have actually shipped.

### `<Monorail start={…} heading={…}>` silently does nothing — use `position`

**`<Monorail>` HAS NO `start` AND NO `heading`.** It is a `composableRide`, so its
transform props are the same two every catalog ride takes — **`position`** (`[x, z]`
or `[x, y, z]`) and **`rotation`** (a yaw in RADIANS) — and it always compiles its
own track from the local origin `[0, beamY, 0]`. `start` / `heading` belong to
`compileTrackPieces`, which the component calls for you; passing them to the JSX
sets nothing.

Round 13's park A wrote `<Monorail start={[-42.6, 2.6, -14.4]} heading={0} …>`. Both
props were dropped, `position` defaulted, and the **entire 85-u ring mounted at the
park origin** — with no error anywhere: `monorail.worldsTouched` **0** against 3
declared (every deck 40+ u from where its registered platform said it was), one **dead
street node** (the West tail, now serving nothing), and a degenerate **1.2-u spur**
whose grade measured **1.57e14**.

**THE FIX, and it is a copy-paste:** `position={[-42.6, 0, -9.7]} rotation={0}` —
the START POSE, not the ring centre (the ring grows EAST and centres on (0, −8.4)).
The full block, with `MONO_PIECES`, `beamY`, `queue` and all four platforms, is in
**ride-and-stall-roster** Step 3, **park-composition** Step 6, and `rules/setup.md`
§0-P.4 (that one always arrives). Keep `rotation` at
0: the published deck table, the corridor table and the 16 `keepDry` cells are all
in the WORLD frame at that pose, so rotating invalidates them. **Translate the ring
(x ∈ [−63.6, −21.6], z ∈ [−22.8, 20.4] at 128, in lattice multiples of 1.2); never
rotate it.**

**HOW TO RECOGNISE IT FROM THE REPORT:** `monorail.registered true`,
`circuitClosed true`, `worstClearance 16.66` — the compile is perfect — and yet
`worldsTouched` (a COUNT) is short of `worldsDeclared` — read the missing names off
`worldsTouchedIds` — and there is a spur with an absurd grade.

### `register.queueAnchor` is not a field — use `queue={{anchor,dir}}` or `stations[]`

`RideRegisterProps` is exactly
`{ name, capacity, rideDuration, loadTime, intensity, price, queueSurface, exitSurface, board, stations }`.
There is no `queueAnchor` and no `queueDir` on it. Round 13's park A wrote
`register={{ name: 'Skyline Monorail', capacity: 6, …, queueAnchor: [-35.44, -8.4], queueDir: [1, 0] }}`
and it **typecheck-failed** (which is the good outcome — `esbuild` strips types, so
had it been a looser shape it would have shipped as a ride with no lane).

**There are TWO homes for a lane, and they are different types:**

| what | where | shape |
|---|---|---|
| station 0's lane | the **component's own top-level prop** | `queue={{ anchor: XZ, dir: XZ }}` |
| platforms 1-3 of a multi-station ride | inside a **`register.stations[]` entry** | `{ label, boardPoint, queueAnchor, queueDir, exitPoint, exitDir }` |

So `queueAnchor` is a real name — just never on `register` itself. Station 0 is
DERIVED from `position` / `rotation` / `queue`; the extra platforms are passed to
`registerRide` verbatim in WORLD coordinates, because a circuit 80 u across has no
local frame that could derive them. And remember `anchor` is the **HEAD**, never the
tail: `anchor = tail − dir·(laneLenOf(capacity) + 0.35)`.

## The queue lints

### `queueDirFlip` / `queueDirUnfixable` (fatal)

The lane hangs off the FIXED tail node, so a `queueDir` aimed along the ride's own
axis spears its pad/station. `resolveQueueOrientation` builds, for each candidate
direction, the lane rect (`hx 0.36`, `hz laneLen/2`), the entrance hut (`hx 0.55`,
`hz 0.5`, 0.62 back from the anchor) and the derived tail, then requires **all
corners inside `size/2 − 0.05`** and no overlap with the ride's own rects. It tries
the authored `dir`, then `−dir`, then the two perpendiculars, preferring one that
also clears the planned exit hut. A replacement found → `queueDirFlip`, fatal;
nothing clean → `queueDirUnfixable`, fatal, and the authored direction is KEPT (so
the ride ships broken).

Fix: for a coaster at `heading: 0` the station straight runs **+z**, so the lane
must be on the ±x axis. **`queueDir: [1, 0]` with the tail at
`[start.x + 6.0, start.z]`** is the published, verified pairing for every
archetype; `[0, ±1]` always flips, and a tail at `start.x + 4.8` flips too. On the
monorail, `queueDir === left` (the ring interior) per platform. `queueDir` is
quantised to the ride's four local sides before the resolve, with a `console.info`
when your vector is > ~6° off an axis.

### `queueTailShared` (fatal) — one tail node per ride

Give each ride its own tail cell; extend the street by a cell or two, or stagger
the rides on opposite sides so their lanes tail onto different nodes.

### `queueAnchorIsHead` (non-fatal, AUTO-CORRECTED)

`anchor` is the queue **HEAD** (the hut end), NEVER the tail. An explicit `anchor`
sitting on a street node is now moved to `node − dir·(laneLenOf(c) + 0.35)` and
reported. **Write the corrected number into the park** — the fix does not move your
PAD off the street, and the park that kept its broken lanes anyway paid 5
`footprints` + 3 `padOnStreet` + 8 `blockers` FAILs and a DEAD sim.

### `laneTrim` (non-fatal) — and the formula that is wrong in the old docs

```ts
laneLenOf(capacity) = Math.max(2.2, 1.1 + 0.56 * capacity)   // placement.ts:79
defaultReach        = front + laneLenOf(capacity) + 0.35      // from the ride ORIGIN
```

> The **`1.8 + 0.35×capacity + 0.35 = 3.55`** figure in the older rules text is
> WRONG and under-reported the reach by up to 3 u. Capacity 4 with `front` 1.8
> gives **5.49**, not 3.55.

If a street node lies within **0.3 u** of the lane axis at an along-axis distance in
`[front + 1.55, defaultReach + 0.05]`, the nearest such node wins and the lane is
**trimmed** to land on it:

```
laneLen = alongDistance − front − 0.35        // minimum 1.2 u
slots   = max(2, floor((laneLen − 0.45) / 0.28))
```

It never extends. Non-fatal, but it starves queue slots. Passing **either**
`queue.anchor` or `queue.dir` opts out. `<Coaster>` never trims (its tail node is
authored), so a coaster whose tail is at the wrong distance gets a `queueDirFlip`
instead.

### The construction that prevents all three

**BUILD THE QUEUE FROM THE TAIL OUT. The pad is an OUTPUT.**

```
pad    = tail + out·(laneLenOf(c) + 0.35 + front)
anchor = tail + out·(laneLenOf(c) + 0.35)
dir    = −out
```

| capacity | `laneLenOf` | **MIN tail → pad centre** | AUTHOR this |
|---:|---:|---:|---:|
| 4 | 3.34 | **5.26** | **5.49** |
| 6 | 4.46 | **6.38** | **6.61** |
| 8 | 5.58 | **7.50** | **7.73** |
| 10 | 6.70 | **8.62** | **8.85** |

**NEVER compute `anchor` from the pad.** A park set `queue={{ anchor: pad − out·3.51 }}`
on all six flat rides; the derived tails landed **0.18-3.46 u from the pad centre** —
**nine `footprints` FAILs, axis 3 capped at 0/8** — on a park whose own header quoted the
right formula. Another used the HEAD formula correctly but put its capacity-10 pads 6.0 u
out when lane + join own the first 7.05 u: **10 `footprints` FAILs, one per ride.**

**And if a tail is not a cell in `NODES`, NO QUEUE WAS PLACED.** The lane is railed on
both long sides and enterable only at the tail, so the manager attaches a SPUR ONTO THE
PAD — a `footprints` FAIL plus a `blockers` FAIL plus a queue no guest can join. Grep
every tail against `NODES`. On `<Coaster>`/`<FlatRide>`/`<TrackRide>` skip the
arithmetic: `queueTailNode={NET.node(TAIL)}`. **Catalog rides do NOT accept it.**

One more thing you cannot compute: with `queue` OFF, `front` is auto-raised to
`min(6.5, footMaxZ·scale + 1.27)` on any COMPACT rig (span ≤ 10 u — every catalog flat
ride), and `footMaxZ` is a BUILT-MESH property (3.13 Carousel, 3.50 TwistRide). Pin
`queue.anchor` when it must be exact.

---

## The exit lints — `exitSnapped` is RETIRED

- **`exitHutRelocated` / `exitHutUnfixable`** (fatal): the planned exit hut overlapped
  the (possibly re-oriented) lane, the entrance hut, or the boarding pad. The search
  tries `exitDir`, `−exitDir`, then both perpendiculars, at 0.6 / 1.2 / 1.8 / 2.4,
  rejecting anything past `size/2 − 0.6`. **The fix is to OMIT `exit`/`exitDir` —
  optional on `<Coaster>`, `<FlatRide>` and every catalog ride.** The archetypes' old
  pinned `exit: [start.x + 2.4, start.z + 2.4]`, `exitDir: [1, 0]` is WITHDRAWN: 2.4 u
  along the station face instead of one tile, with no street on its outward ray.
- ~~**`exitSnapped`**~~ — **RETIRED 2026-07.** Ignore it: it put the exit on a DIFFERENT
  face with `exitDir = −queueDir`. **The layout now is exit hut ONE TILE along the SAME
  face, `exitDir = queueDir`, both doorways facing out**, with three NON-FATAL lints:
  * **`exitNotAdjacent`** — an AUTHORED pair that is not one tile along the same
    face facing the same way out. It is HONOURED, and the lint names the cell that
    would have worked. RCT2 does not enforce adjacency (`RideStation` holds two
    independent `TileCoordsXYZD`, Ride.h:172-173, and no code compares them), so a
    long station with the entrance at one end and the exit at the other is
    authentic. **Omit the props.**
  * **`exitFaceBlocked`** — NEITHER adjacent cell is legal (out of bounds, wet or
    occupied). The exit stands on the hinted one facing outward and is **NOT
    repaired onto another face.** Move the ride so the queue's face has **TWO FREE
    TILES SIDE BY SIDE** — budget the rig `2·0.55 + 1.2 = 2.30 u` across the face,
    not one hut's 1.09.
  * **`exitLaneUnreachable`** — no street on the exit's outward ray inside 9 u AND
    no queue tail to join. **This also produces a HARD `accessibility` FAIL**
    (check a4).

**Prefer a tail node that is a JUNCTION** — a street crossing it perpendicular to
the queue. The exit path then meets the cross-street directly in the same
`laneLenOf(c) + 0.35` the queue takes; off a dead-end court spur it must run the
lane's length and turn (measured on the reference park: 3.7-8.2 u where a junction
would have given 3.7 u every time, and twice nothing at all inside 9 u).

---

## `footprints`

- `A overlaps B` — an OBB SAT sweep over every audited rect, and **since 2026-07 that
  includes the EXIT PATH's one or two legs** (`<ride> exit lane`, `<ride> exit lane
  join`). Respace: two capacity-4 rides on one street need centre-to-centre **≥ 6 u**
  (pad 2.4 × 2.4, lane out the queue face, exit hut ~1 × 1 one tile along that face).
  **SAT counts TOUCHING as a collision**, which is why you author
  `minReachOf(cap) + 2.4`, not the bare minimum.
- **Exempt by design** are a ride's own abutting pairs: entrance hut × queue lane, exit
  hut × exit path, and — when the path JOINS the queue's own tail node rather than a
  cross-street — exit path × queue lane / entrance hut.
- `placeAccess residual: …` — the manager's registration-time search (tangent shifts 0,
  ±0.1 … ±0.8) could not place a hut/lane cleanly. **Respace the rides; do not fight it
  with a bigger shift.**
- **`entrance hut overlaps boardPoint pad` WITH ARITHMETIC THAT LOOKS RIGHT — the
  `layout.board` trap (wave 17).** The floor is enforced against the **`boardPoint`
  pad**, which on a `composableRide` is NOT at `position`: it sits at `position` + the
  rotated **`layout.board`**, and local **+z is the face the queue runs into**, so the
  boardPoint lands **NEARER the tail**. `<Discotron>` ships `board: [0, STAGE_H, 1.4]`,
  so a cap-12 pad at the documented `minReachOf(12) + 1.2` = 10.94 u put its boardPoint
  **9.54 u** from the tail against the audited **9.74 u** floor — a `footprints` FAIL on
  a header whose numbers were all correct. **FIX: author `minReachOf(cap) + 2.4` and
  assert `got >= minReachOf(cap) + 1.2`.** Do not try to read `board`; like `front` it is
  frozen into the component.

---

## `bounds`

```
edge = size/2 − 0.05        // 63.95 at 128
```

Tested: **all four swept corners** of every audited footprint, and **every derived
queue-tail / exit access node.**

> `Sky Swings: its queue tail access node sits at (65.2, -3.6) — OUTSIDE the
> ±64 u plot; guests would walk off the map (re-aim queueDir / move the ride)`

Coaster **track** gets a looser gate — `max(|x|,|z|) > size/2 + 0.3`, i.e. **±64.3** —
and **closure-synthesized pieces COUNT.** At 128 bounds almost never constrain an
archetype; the binding constraint is the LEGAL START range, because **the §4.0 rings
grow WEST and the start is the EASTmost point.** §4.0-A at `start.x = −90` on a 192
plot reached ±127.6 u, `report.fatal` fired and the ride never registered — ~10 points.
Legal starts at 128: **A x ∈ [−26.4,
63.6] z ∈ [−48.0, 42.0]** · **B x ∈ [−34.8, 63.6] z ∈ [−50.4, 46.8]** · **C
x ∈ [−28.8, 63.6] z ∈ [−49.2, 42.0]**, plus `start.x ≤ size/2 − 6` so the tail at
`start.x + 6.0` lands on the plot. The monorail ring is the MIRROR image: it grows
EAST, so its legal start at 128 is **x ∈ [−63.6, −21.6], z ∈ [−22.8, 20.4]**.

---

## `coaster`

| detail | fix |
|---|---|
| `FATAL compiled track — …` | the compile itself failed: design checks, closure > **40 %** of authored length, or out of bounds. **The track renders translucent red and is NOT registered** — no station, no queue, and the category you counted on is EMPTY. Re-copy an archetype |
| `design violation [kind] …` | a non-warning `checkCoasterDesign` violation — usually `pitchRate` or `bankLimit`. **Do not hand-tune. If the archetype violates on YOUR seed, MOVE THE RING to flatter ground** (measured: §4.0-A reads `pitchRate 0.59` against ~0.55 on seed 5 alpine's peak cluster, and passes with room on seed 7 temperate) |
| `track reaches ±65.1 u — outside the ±64 u park bounds` | translate the archetype back; the closure-synthesized pieces count |
| `spline clearance 0.71 < 0.9 (self-intersection risk)` | the pieces need spreading out |
| `worst lateral 1.34 g … (must stay under 1.27 g)` | you passed a low `bank`, or a turn is at grade. **Pass no `bank` prop** and put every turn at an apex |
| `[coaster:shortDrop] …` (autofix) | first drop under RCT2's 0.9-u gate — it HALVES excitement, intensity AND nausea. **lift ≥ 1.0 is mandatory.** The one kind the gate promotes to fatal by itself (`FATAL_LINT_KINDS`) |

`coaster:shortLength` is reported and NOT fatal (a short circuit is a deliberate
kiddie-coaster choice).

**The same 40 % rule binds EVERY `pieces` list, not just the flagship.** Measured: one
park lost BOTH tracked rides in one file — `<TrackRide>` 20.7 u synthesized against
31.1 u authored (66 %) and `<LogFlume>` 19.2 u against 25.5 u (75 %) — **−7.0 thrill,
−0.5 roster, an empty WATER category.** The fix is one prop shorter than the failure:
**`<LogFlume>`, `<RiverRapids>`, `<Chairlift>`, `<Bobsleigh>` and `<GoKarts>` only call
`compileTrackPieces` IF YOU PASS `pieces`, and none has a published circuit — so OMIT
`pieces` and ship the verified stock layout.** `<Chairlift>`/`<GoKarts>` do not mark
themselves invalid on a fatal compile; they stash the report.

The monorail's one specific trap: **its tail must stay TWO straights.** Merging them
emits a midpoint, the end point is popped, and `closure.gap` measures **17.80 u — NOT
CLOSED, FATAL.** Measured both ways.

---

## The plan lints (all §0-FATAL) — the park renders and still fails

Plans run at module scope, before React mounts, so a `throw` there takes the whole page
(two parks died that way: black frame, no `validatePark` line, unscoreable, **3.5/100**).
So every plan builder DEGRADES instead (`ParkBuilder/planLints.ts`). **A plan lint means
the park you shipped is not the park you designed — fix the coordinate, don't accept the
degraded shape.** (That is plan BUILDERS. **Your own checks are the opposite case** —
`parkAssert`, above.)

| kind | what degraded |
|---|---|
| the auto-elbow lint | a DIAGONAL authored edge was elbowed into two cardinal legs through a synthesised corner node |
| the port-retie lint | an edge crossing a set-piece's own SOLID was CUT and re-tied through that piece's PORTS (`buildParkNet` also REFUSES an edge wired into a plaza's centre) |
| `boulevardDiagonal` / `boulevardTooShort` | `boulevardPlan` endpoints not axis-aligned (L-routed for you) / under 3 cells |
| `unknownPort` / `badEdgeEndpoint` / `noNodeOnCell` | a port/edge/cell that does not exist — `noNodeOnCell` IS the "my tail is not a node" error, caught for you |
| `netWarnings` | `buildParkNet` reported a diagonal edge or a separate island |
| `worldEmpty` | `worldPlan` with no `pieces` — no region to audit. One themed `bazaarPlan` or `fountainPlazaPlan` is enough |
| `worldIdReused` / `worldUnthemed` | two worlds sharing an `id` / a world declared with `DEFAULT_THEME` — fatal because they make the whole audit meaningless |

### The WORLDS findings that are not fatal but are expensive

- **`declared: 0` is −5.0** — themed content with no `<World plan>` mounted. A park
  built three coherent districts (22 themed components, `crossTheme: []`) and scored
  0/5. `<World>`'s ONLY prop is `plan`; it builds no geometry and touches no street
  graph, so it works with plain `<Paths>` as well as `buildParkNet`.
- **`worldNotBuiltOut`** — a world is BUILT only with ≥ 1 ride AND ≥ 1 stall AND ≥ 1
  scenery/set-piece **whose REGISTERED POSITION falls inside the rect.** Two killers:
  `include` listing TAILS instead of PADS (a tail is 3-7 u upstream), and **a
  `<Coaster>` registering at its FOOTPRINT CENTRE, not `start`** (§4.0-A about
  (−18.8, +3.1) off the start, usually in the next district). Use
  `rides: [{ at: PAD, name }]`. A park listed cells *near* its rides and gave the
  coaster's `start`: two of three worlds registered ZERO rides, 2.08/5.
- **`crossTheme` is −0.5 each** — a themed piece resolved into another world's region,
  usually because two rects TOUCH (`minGap 0`) and `worldAt` resolves into the SMALLEST
  containing region, manufacturing findings out of correct content. Keep centres
  ≥ **32.66 u** apart at 128, rects ≥ 2.4 u clear.
- `themedPieceOutsideWorlds` / `unplacedThemed` is reported and **not charged** —
  but it does not COUNT toward anything either. Grow `margin` or `include` the cell.
- **`everyWorldTouched: false` / `worldsTouched: 1` WITH ALL FOUR PLATFORMS MOUNTED —
  the PERIMETER trap (wave 17).** `probe.mjs` walks the monorail group's **bounding-box
  PERIMETER** and asks which world rects it crosses, so a world built entirely outside
  `x ±44` / `z −52.8…36` reads `worldsTouched: 1` however grand it is. **FIX: one
  `include` cell aimed at the ring** (skeleton B uses `[-38.4, 33.6]`, `[44.4, 33.6]`,
  `[-43.2, -28.8]`). An `include` cell is an input to the rect UNION only — nothing is
  built on it, it never enters `keepDry` — so it cannot move water or cap a peak.
  **The cheapest fix in the catalogue: do not relocate a district for it.**
- `rosterOverstated` — the header/`<Park roster>` claims more rides or categories than
  registered. **Count the `register={{…}}` calls that actually mount.** One park shipped
  `ROSTER (9 rides, 5 categories)` with eight rides in three. **It also fires the other
  way, on a count you derived honestly:** a park claimed `stalls: 6` off its three
  `stalls: [a, b]` arrays and registered **9**, because `bazaarPlan` padded each row to
  the 3-stall floor. **Stalls are counted off `plan.slots.length`** — the post-padding
  list — not off the array you typed.
- `deadStreetNode` — a street node of degree ≤ 1 with no ride/stall/restroom/gate
  within 2.4 u. **−2.0 in aggregate**; one park shipped 12 of 29 nodes at degree 1,
  five of them empty. Put the thing on the spur, or delete the spur.
  **AND THE OTHER CAUSE IS A HALF-WIRED CHAIN PIECE, which no degree tally on your own
  `NODES` can see:** a `<Boulevard>` with only `'<id>:A'` in `EDGES`. Both its ports are
  `prunable: false`, so the unwired end is BUILT rather than pruned and the carriageway
  dead-ends in grass, 7.2 u short of the plaza. The port-ref assertion must check
  `p.ports.filter((pt) => !pt.prunable)`, not just presence, and endpoints should be
  read off the neighbouring pieces (`to: HUB.port('W')`) so they merge in the fuse.
- **A ride still carrying its CATALOG DEFAULT name** is not a lint at all — it is a
  silent roster deduction. A park that themed eight of ten rides and shipped
  `<Carousel register={{ name: 'Carousel' }}>` took **8/10** where its stalls took 9/9
  off an identically-worded rule. The `deCamel` assertion is in
  **ride-and-stall-roster** Step 1b.

---

## `sim`

```
secs      = max(85, ceil(2.5 × maxRideDuration + 20))    // 85 s for any ride ≤ 26 s
stallSecs = max(45, round(0.75 × secs))                  // 64 s at the 85 s default
dt        = 1/30, sampled every 0.5 s
```

**`SIM_SMOKE_SECONDS` is 85 at EVERY plot size on purpose** (it was 60 until
2026-07-28 — raised with the BOARDING-QUIET departure rule, which holds the doors
~10-12 s for a second guest and so puts ~13 s in front of every first cycle;
`GameManager/Context.md` "THE DEPARTURE RULE" has the measurements). The window
buys ~30 u of gate→tail walk (24 u once a crowd stretches the dwell), and past
~72 u guests leave the park before riding, so a longer window cannot rescue a
far-gate layout — **fix the LAYOUT, not the window.**

| detail | condition | fix |
|---|---|---|
| `no guest completed a ride cycle in N sim-s` | `riddenTotal < 1` | **`rideDuration` ≤ 12**, and the NEAREST queue tail within **15 u** of the gate (20 u practical max). Re-measured 2026-07-28: 15 u → first cycle at 62.0 sim-s, 20 u → 68.5 s, 30 u → 82.5 s, **32 u → 87.0 s which FAILS.** Each extra unit costs 1.52 sim-s (fixed overhead 37.5 s) |
| `guest N stood still >25 sim-s while "walking"` | displacement ≤ 0.06 u for > 25 s in state `walking`/`leavingPark` | boxed in by blockers, or on an island, or off-graph behind a stranded exit — fix the graph |
| `X: its queue held for >N sim-s without ever advancing` | the queue never advanced once it formed, for `stallSecs` = 3/4 of the whole smoke run | the ride is unreachable or never departs. **The threshold was `max(30, maxRideDuration + 15)` until 2026-07-28 and was mis-calibrated** — a legitimate hold is one full ride CYCLE (dwell + 0.6 + `loadTime` + travel + 1 + unload + 1, ×`stationCount` on a transport ride), measured at 42.5 s single-station / 51.5 s on a 4-platform ride at `rideDuration` 12, i.e. already over 30 s. It only stopped firing because the 60 s window ended first; the 85 s window turned it into a false FAIL on the reference park `arch-ref` |

**Only the NEAREST queue is bound** — a park may have queues at 40-70 u elsewhere
and still pass, and the mandatory monorail ring never carries the smoke cycle (its
closest platform is 24.0 u of street from the turnstile). Ship a separate
non-monorail ride beside the gate. **A bigger opening crowd now makes this HARDER,
and that reversed on 2026-07-28**: every boarding re-arms the boarding-quiet
window, so a crowd stretches the dwell to its `maxWait` cap. At a 15-u tail the
first cycle is 60.0 s with 12 guests but **72.0 s with 22, 73.5 s with 50, 72.0 s
with 100** — all inside the 85 s window, none inside the old 60 s one.

Also: the smoke run is 85 s of REAL sim, so the **GATE STREAM runs inside it** — a park
opens on `guests` and the first frame already carries the arrivals that walked in during
validation (measured: a pinned 18 became 34, 20 became 36). Expected, and it makes the
gate EASIER. It fast-forwards the manager's sim clock, so keep render time monotonic
afterwards by adding `report.simSeconds`.

---

## Not a gate failure, but it costs the most points

The gate cannot fail you for building three rides in one corner of a 128 plot; the score
will. **The floors, the anti-lattice arithmetic and the spread targets are carried in
full by park-composition. The roll-call, so nothing on it surprises you:**
ride/stall/category counts · ≥ 3 BUILT worlds at 32.66 u separation · the built-bbox and
`pathExtentFraction` / `plotUtilisation` / `gridRegularity` floors · the `plazas` and
`areaSpread` floors · the 32-tree / 16-scenery / `varietyIndex` counts · a HIGH-THRILL
flagship with a CALLED `rateCoaster` · and **do NOT pass `guests`** (it defaults to 50 at
128; every park that hand-wrote 18-20 rendered as an empty field).

## The escalation order when a park will not go green

0. **Is there a report at all?** If not, run `node preflight.mjs <park>.tsx` — **SIX**
   answers, not two (enumerated at the top of this skill): a bad import · a
   `pieces as string[]` cast · `ratings` with no `rateCoaster` · **no §0 PRE-FLIGHT
   header** (leading comment, ABOVE the imports, ≥ 200 chars, one `HEADER_KEYWORDS`
   hit) · no **`<Park roster={{…}}>`** prop · no **`<Monorail>`** ring.
1. **Fix every FATAL lint first** — `padOnStreet`, `pathClipping`, `causeway*`,
   `latticeInWater`, `rampRefused`, `queueDir*`, `queueTailShared`, `exitHut*`,
   `corridor*`, `plantedInWater`, `waterRePicked`, `terrainFlattened`, the plan lints,
   `coaster:shortDrop`. They are CAUSES, and several **delete edges**, manufacturing
   accessibility failures downstream.
2. **Then the GRAPH, and count before you read:** `buildParkNet` called **exactly
   once**, with **EVERY** plan in its piece set — each world's own row included (by
   `pieces:` or `worlds:`; equivalent)? every set-piece id present in `EDGES` as
   `'<id>:<PORT>'` (N pieces ⇒ ≥ N refs), **and both ends of every chain piece**? every
   authored pair cardinal? Then read `NET.warnings` — islands and diagonals are
   reported there before mount.
3. **Then GEOMETRY:** every pad, building and prop cell **returned by**
   `offPathCell` — asked of the SAME net `<Paths>` got, and if a helper derives the
   pads, the call is the helper's LAST LINE; every queue rebuilt FROM ITS TAIL; every
   `exit`/`exitDir` deleted.
4. **Then the WORLDS:** `<World plan>` mounted, `include` listing PAD cells, the
   coaster's registered CENTRE listed rather than its `start`.
5. **Then the COASTER:** re-copy the archetype verbatim rather than tuning it — and
   if it still violates on your seed, move the ring, not the pieces.
6. **Re-run and require `failures: []` AND `warnings: []`.** An auto-fix must never
   silently rescue a design you were supposed to re-plan.

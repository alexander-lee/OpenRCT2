# Composing parks — §3.1-N why transcribing loses · the SET-PIECE CONTRACT

Part of the recipe book, split off `rules/park-generation-skeletons.md` (which
carries §3.1 and **§3.1-A**; **§3.1-B now lives in
`rules/park-generation-tree-skeleton.md`** — a DIFFERENT file from this one).
Every rules file is injected together, so read those for the node tables and this
one for what you must change about them and how set-pieces fuse into the net.

### 3.1-N TRANSCRIBING **EITHER** SKELETON CANNOT SCORE — the shape is a scored axis

**READ THIS BEFORE YOU COPY EITHER NODE TABLE.** This applies to **§3.1-A and
§3.1-B equally** — picking the newer one is not a way round it. Following the rules
above and copying a table verbatim is a LOSING move, and we made it one. Round 13's
park A wrote, in its own trace: *"Rather than re-derive coordinates (the #1 failure
mode), I'll transcribe the verified worked skeleton almost verbatim."* Every
geometry check passed. It then scored **`novelty.distance` 0.023 against a 0.04
floor**, and its nearest neighbour in the corpus was **r12a — which had done exactly
the same thing.** Obeying us was self-defeating on axis 15, and that is our defect,
not the author's.

**AXIS 15 MEASURES THE SHAPE.** `novelty.distance` is computed over the STREET-NODE
geometry, the degree mix, the edge-length classes, the quadrant occupancy and where
the flagship sits relative to the hub. It does NOT read your theme names, your ride
names, your colours or your prose. So renaming three worlds moves it by zero, and
**there is no number of dressing changes that rescues a transcribed table.** And —
the wave-17 correction, in full at the end of this section — **it barely reads your
TOPOLOGY either. It reads your BUDGET.**

**WHAT MAKES A TABLE SHIPPABLE IS NOT THAT WE VERIFIED IT — IT IS THAT THE FIVE
MODULE-SCOPE ASSERTIONS PASS ON IT.** `portCell` + cardinal · the port-ref/chain
audit · `assertNodesOffPieces` · `assertKeepDryOffRow` + the §5c re-compose ·
`place`'s reach check. Those five are what turn coordinates into a verified layout,
and they run on YOUR coordinates exactly as well as on ours. **Derive your own
table and let the assertions verify it.** That is the whole point of §0.

### ⚠ THE TERRAIN DOES **NOT** TRAVEL WITH THE NODE TABLE — NO TRANSFORM OF A PUBLISHED SKELETON IS SHIPPABLE

**TERRAIN IS COMPOSED FROM THE SEED. A TRANSFORM SLIDES THE STREET NET ACROSS A
FIXED LANDFORM.** Mirror, rotate or offset the table and every cell lands on
ground that did not move with it. MEASURED **2026-07-27** on §3.1-A against its
own composed, guarded ground:

| transform | wet | on a bulge (> 0.75 = hard `terrain` FAIL) | out of bounds | worst bump |
|---|--:|--:|--:|--:|
| identity (as built) | 0 | 0 | 1 (gate rim, expected) | 0.07 |
| `mirrorX` | 1 | **5** | 1 | 2.43 |
| `rot90` | 1 | **26** | 1 | 5.46 |
| `rot180` | 0 | **32** | 1 | 4.93 |
| `mirrorX` + `hubOffset [-16.8, 0]` | 3 | 2 | **21** | 1.98 |

**AND THE NOVELTY HALF OF THE RATIONALE FAILS TOO.** `mirrorX` alone measures
`novelty.distance` **0.008**; `rot90` **0.034**; `mirrorX + hubOffset[-16.8, 0]`
**0.016** — all three under the 0.04 DERIVATIVE floor, never mind the 0.08 distinct
one. A **2,400-point sweep** over `mirrorX × rot90 × scale(0.5–2.0) × hub(±24)`
**maxed at 0.106**, and every point above 0.08 sat at `scale ≈ 0.5–0.55` — a
half-size park, which is not a park. **No transform of a published skeleton clears
0.08, and every transform that clears even 0.04 breaks the terrain gate.**

> **THE `transformTable(WORKED_A, { mirrorX: true, hubOffset: [-16.8, 0] })` CALL
> THIS FILE USED TO SHIP AS "the published minimum" IS DELETED, AND IT WAS
> TRIPLE-FATAL:** `novelty.distance` **0.016** (below even the 0.04 half-point
> floor) **AND 21 street cells out of bounds, 3 wet, 2 on a hill bulge** — a hard
> `terrain` gate failure on a 128 plot. **Do not reconstruct it from these words.**

**FOUR CONSECUTIVE PARKS CHOSE TO TRANSCRIBE RATHER THAN TRANSFORM, AND THEY WERE
RIGHT.** Round 14 B's trace — *"the pragmatic choice per Rule Zero is: build the
VERIFIED skeleton A faithfully, accept the novelty penalty on one axis"* — and the
sharper version, *"transform and risk a FATAL water/relief failure I can't
verify"*, are exactly what the table above measures. **Transcription is not the
defect; it is the correct read of an unsafe lever.** The safe lever is STREET-RUN
SUBDIVISION, next.

### STREET-RUN SUBDIVISION — the ONE terrain-safe novelty lever

Insert intermediate street nodes on runs that are **already paved and already
guarded**: split every street edge longer than `L` into equal collinear sub-runs.
**Terrain-neutral by construction** — a new node lands on ground you already
composed, guarded and measured, and it adds no new paved cell that the old run did
not already cover. MEASURED at every threshold from **24 u down to 2.4 u**: **0
wet, 0 on a bulge, worst bump ≤ 0.344.**

Scoring sweep on §3.1-A (axis 15 baseline **6.00 / 7**):

| `L` (u) | new nodes | `novelty.distance` | axis 15 |
|--:|--:|--:|---|
| 7.0 | 42 | 0.036 | 6.00 — still under the 0.04 floor, no gain |
| 6.5 | 47 | 0.041 | 6.41 — the peak, on **0.001** of margin |
| **5.5** | **55** | **0.046** | **6.37** ← **PUBLISH/SHIP THIS ONE** |
| 4.8 | 72 | 0.054 | 6.24 |
| 4.0 | 87 | 0.060 | 5.94 — loses more on `lengthVariety` than the novelty pays |

**`L = 5.5 u` IS THE ROBUST CHOICE. 6.5 IS NOT**, even though it scores 0.04
higher: it clears the 0.04 derivative floor by **0.001**, so one corpus entry
lands it back under and the novelty term returns to 0. 5.5 clears the floor by
**15 %**. And do not push past 4.8: the runs go uniform and `lengthVariety` gives
back more than the extra novelty earns.

**BE HONEST ABOUT THE CEILING: THIS BUYS THE HALF POINT (the 0.04 derivative
floor), NOT THE FULL ONE (0.08).** The terrain-safe ceiling for axis 15 on a
skeleton-A layout is **6.37–6.41 of 7**. The full novelty point needs a different
DENSITY CLASS — a table you author and then probe end-to-end — not a transform of
ours.

**`transformTable()` STILL SHIPS, FOR ONE USE ONLY:** as a coordinate helper while
you derive a table you will then re-check through `probe-skeleton.mjs`
end-to-end (~2 s), water and relief included. It is not a novelty strategy.

```ts
/** COORDINATE HELPER ONLY — read the terrain table above before you use it.
 *   mirrorX   negate x            hubOffset slide the WHOLE table
 *   scale     block size — the density-class lever */
function transformTable(
  table: readonly XZ[],
  { mirrorX = false, hubOffset = [0, 0] as XZ, scale = 1 }: { mirrorX?: boolean; hubOffset?: XZ; scale?: number } = {},
): XZ[] {
  const snap = (v: number) => +(Math.round(v / 1.2) * 1.2).toFixed(2);    // stay ON the lattice
  return table.map(([x, z]) => [snap((mirrorX ? -x : x) * scale + hubOffset[0]), snap(z * scale + hubOffset[1])] as XZ);
}
// NO WORKED TRANSFORM IS PUBLISHED HERE. Every one that was measured either fails
// the terrain gate or scores under the novelty floor — see the table above. If you
// output a transformed table anyway, `probe-skeleton.mjs` is MANDATORY before you
// build on it: wet cells, bulge cells, out-of-bounds cells, relief and novelty.
```

**T1/T2/T3 WERE DELETED (2026-07-28).** They were self-labelled *"REFERENCE, NOT
RECIPES (superseded 2026-07-27)"* and told you not to ship them — 268 lines of
transformations nobody was allowed to use. `mirrorX` alone measures 0.008 novelty on a
bulge, which is why they were superseded: the density-class move is the answer that
does not decay. Author your own street table instead.

### The set-piece contract BOTH skeletons rely on

- **`<FountainPlaza>` for a plaza hub**, **`<Bazaar>` for a shop cluster**,
  **`<Boulevard>` for a long dressed avenue** — **whichever of those things your park
  contains, it uses the set-piece; hand-rolling one is a REJECTED layout (§0.15).**
  Read that as a prohibition on hand-rolling, **not as a requirement to include all
  three**: skeleton B ships **no plaza hub and no boulevard at all** and measures
  `ok: true` with **axis 15 7.0/7 and axis 16 5/5**, because its shop clusters are
  `<Bazaar>`s and its long runs are single AUTHORED edges (which is also where its
  edge-length variety comes from — a boulevard would have paved them as 1.2-u
  chains). What every park does need is **≥ 1 open space with `areaSpread ≥ 1.8`**,
  and three `<Bazaar>` rows of DIFFERENT lengths satisfy that without a plaza.
  Ports are named connector cells one lattice cell OUTSIDE the piece
  footprint, so a street — or a ride's queue lane — meets a port without ever
  overlapping the piece (`plan.port('W')`, `plan.portDir('W')`).
- **A port nobody wires is PRUNED** ("a spur dead-ending in grass"), so if a
  ride's queue tail is meant to land on a port, wire that port to something.
  Ask for the ports you will actually use (`ports: ['N', 'S', 'E']`).
- **AND A *PIECE* NOBODY PORT-REFERENCES IS DECORATION — this is the harder version
  of the rule above and it is worth ~9 points.** `pieces:` and `worlds:` put a
  piece's INTERIOR sub-net into the graph and join it to NOTHING. **Every
  `bazaarPlan` / `fountainPlazaPlan` / `boulevardPlan` id in the park must appear at
  least once in `EDGES` as `'<id>:<PORT>'`, and the check is a COUNT: N pieces ⇒
  ≥ N port-refs. Count them before you ship.** Round 12's park referenced
  `hub:N`, `hub:E`, `hub:W` and nothing else, leaving four pieces unwired, and paid
  **2 orphan islands · gate-reach 103/127 = 0.811 · three Bazaar stalls no guest
  could reach · one `edgeThroughSolid` · accessibility 1/10.** The assertion is four
  lines and it is in the skeleton above.
- **AND A COUNT IS NOT ENOUGH FOR A *CHAIN* PIECE: A `<Boulevard>` NEEDS *BOTH*
  `A` AND `B` WIRED.** The presence count passes at one ref per piece, which is
  exactly how round 13's park B shipped a `deadStreetNode`: `EDGES` held
  `['ave:A']` and never `'ave:B'`, and because **both** of `<Boulevard>`'s ports are
  marked **`prunable: false`** (structural chain ends — `buildParkNet` prunes an
  unwired dedicated STUB but never SHORTENS a carriageway), the avenue was paved to
  its full length and stopped **7.2 u short of the plaza**, in grass. The fix is
  mechanical and it is in the skeleton above: iterate `p.ports.filter((pt) =>
  !pt.prunable)` and require each name in the wired set, with a named opt-out set
  for a terminus that really does carry something (a bare `<Gate>` standing on it).
  **Read the flag off the piece, never a list of kinds** — and **read the ENDPOINT
  off the neighbour** (`boulevardPlan({ from: HUB.port('W'), to: MARKET.port('E') })`,
  the shape `Boulevard/Context.md` opens with) rather than retyping a coordinate
  that can be 7.2 u wrong. Endpoints built from ports MERGE with the neighbour's
  port cell in the fuse, so the two cannot disagree.
- **`buildParkNet` IS CALLED EXACTLY ONCE.** Every piece — including a plaza you
  add at the end — goes in that one `pieces:` array, and the net `offPathCell`
  receives must be the net `<Paths>` receives. Round 12 fused twice and cleared its
  restroom, all its scenery and all 34 tree cells against a net missing a 116 u²
  plaza. It also pays the fuse cost twice.
- **A ride needs TWO paths, so plan the STATION FACE, not just the tail node**
  (§0.4b). Beside the queue INTO the entrance, every ride now builds an ordinary
  footpath OUT of its exit — RCT2's *"Construct a path from the ride exit"*
  (`Ride.cpp:2076`) — and the exit hut stands ONE TILE along the same station
  face as the entrance, facing the same way out. Two consequences for a district
  skeleton:
  * the face a ride's queue comes off needs **TWO free tiles side by side**, so
    budget the rig `2 × 0.55 + 1.2 = 2.30 u` wide across the face rather than one
    hut's 1.09. Where both cells are blocked the chassis records an
    `exitFaceBlocked` lint and does NOT move the exit onto another face;
  * a tail node that is a **DEAD-END SPUR** into a court is still fine — the exit
    path then runs out beside the queue and turns one tile onto that same tail
    node (the JOIN case). But a tail node that is a **JUNCTION** — a street
    crossing it perpendicular to the queue — is better: the exit path then meets
    the cross-street directly, in the same `laneLenOf(capacity) + 0.35` the queue
    takes, instead of running the length of the queue and turning. Measured on
    `worlds-ref`, whose lands all use dead-end court spurs: exit paths of 3.7-8.2 u
    where a junction would have given 3.7 u every time.
- **EVERY PIECE'S PORT SET IS FIXED, AND ONLY `<FountainPlaza>` HAS FOUR.**
  Know them before you wire:

  | piece | ports | where they face |
  |---|---|---|
  | `<FountainPlaza>` | `N` `E` `S` `W` (ask for the subset you use) | the four sides of the pad |
  | `<Bazaar>` | **`W` and `E` ONLY — never N/S, at any rotation** | both on the AISLE axis; the two stall rows close the other sides |
  | `<Boulevard>` | `A` (the `from` end) and `B` (the `to` end) | along the carriageway, outward |

  (The five land macros used to appear here with their own `S`/`SE`/`SW`/`NE`
  frontage ports. They were removed in v6.0 — a hand-composed district's ports
  are whatever its structural set-piece provides, i.e. the three rows above.)

  **THE PORT COMPASS, DEFINED. AT `rotation: 0` THE NAMES *ARE* WORLD AXES:**

  | port | direction | world axis |
  |---|---|---|
  | `'N'` | `[0, +1]` | **+z** |
  | `'S'` | `[0, −1]` | **−z** |
  | `'E'` | `[+1, 0]` | **+x** |
  | `'W'` | `[−1, 0]` | **−x** |

  (`FountainPlaza`'s `SIDE_DIR`, and the same convention throughout the kit. A
  port cell sits ONE lattice cell outside the piece's footprint along that
  direction, so `HUB.port('S')` is `[hubX, hubZ − half − 0.6]`.) This is what
  "aim the port with `facing`" was always referring to and what the rules never
  said out loud — **and `rotation: 0` is the default, which is what a hub plaza
  should always be.**

  Port names are still **LOCAL, so a ROTATED plan breaks the table above**: a
  `bazaarPlan` with `rotation: Math.PI / 2` runs its aisle N/S and its `'W'` port
  then faces NORTH; a piece rotated `Math.PI` puts its `'S'` port on its NORTH
  edge. So the table is a *guarantee at rotation 0* and a *reminder to read the
  data otherwise* — **never infer a direction from a rotation** (`plan.portDir('W')`,
  `plan.portNames`, `plan.portDirs`, `plan.aisleAxis`,
  `world.gateway(toward)`), or let the plan aim itself: `bazaarPlan({ …,
  facing: { port: 'E', toward: HUB.port('S') } })`. Round 8 assumed "its E port
  faces the hub after the default rotation", wired a DIAGONAL avenue, and threw
  at module scope — a black page and a 3.5/100.

  **AND AN AVENUE LEAVING A PORT MUST RUN *AWAY* FROM THE PIECE.** A
  `boulevardPlan` whose `from` is a port and whose `to` lies on the FAR side wires
  the carriageway straight back THROUGH the piece. The test, on the axis the leg
  moves along:

  ```
  sign(to − port)  ===  sign(port − pieceCentre)      // else you are paving inward
  ```

  In words: **a leg arriving from +z wires to `'N'`, never to `'S'`.** Take the
  port on the side the traffic comes from, and let the piece's own sub-net carry
  it across.

  **A `<FountainPlaza>`'s CENTRE IS A SOLID BASIN — the middle 3×3 CELLS.** The
  plan publishes `solids: [{ label: 'fountain basin', at: centre, r: 1.78·scale }]`
  and the mount registers it as a blocker, so **every cell within ±1.8 u of the
  plaza centre is unwalkable**. A carriageway wired to the far port crosses it and
  earns **one `blockers` FAIL PER CROSSED CELL** — the guests cannot walk through
  a fountain, and the gate says so cell by cell. Wave-12's park wired BOTH of its
  north-south avenues to the plaza's opposite ports (`from: [12, 45.6]` → `port('S')`
  at `[12, 10.8]`, and `port('N')` → `[12, −12]`) and `buildParkNet` paved **four
  edges across the basin** — a defect that is free to avoid and expensive to
  ship. (`buildParkNet` now REFUSES an edge wired into a plaza's centre at fuse
  time and records the plan lint, which is still §0-FATAL: the safety net does not
  give the points back.)
- `NET.warnings` reports diagonal edges and disconnected islands; `NET.pruned`
  lists what it dropped. Both are FATAL under §0's warnings policy — and since
  wave 9 that is MECHANICAL, not advisory: every `NET.warnings` entry is
  recorded as a §0-FATAL `netWarnings` plan lint, so `validatePark` cannot
  return `ok` over one (round 8 shipped two diagonal street edges past this
  exact sentence and collected 2 `paths` FAILs for them).

  **SO ASSERT CARDINALITY BEFORE THE FUSE — the three lines are in
  `park-generation.md` §0.15, and they belong in every park file.** A diagonal
  pair is not just a lint: `buildParkNet` repairs it by **inserting an ELBOW — a
  NEW node you did not plan** — and round 12's park B then hand-sited a pad onto
  that node and ran a corridor sweep across it, turning one bad coordinate into a
  FATAL `edgeDiagonal` plus a `padNearStreet` plus a corridor FAIL. Check the
  authored pairs yourself (`A[0] !== B[0] && A[1] !== B[1]` ⇒ diagonal, numeric
  endpoints only — PORT refs resolve inside the fuse) and fix the coordinate.
- **A hand-authored spine node with NOTHING on it is a defect.**
  `buildParkNet` prunes unwired PORTS, but it cannot prune a node you wrote
  yourself; `validatePark` now raises a `deadStreetNode` warning for every
  street node of degree ≤ 1 with no ride/stall/restroom/gate within 2.4 u.
  Round 8 shipped a "restroom spur" and an "observation-tower spur" with
  nothing whatever on them — and no restroom in the park at all. Put the thing
  on the spur, or delete the spur.
- Declare set-pieces, lands and `<World>` AFTER `<Paths>` (their dressing
  settles onto the paving).

## 3.1-Y THE ATTACH-POINT RULE — a free **+1.00** on axis 12, and it is a LINT ARTEFACT

**EVERY PARK SCORED SO FAR LOSES 1 POINT ON AXIS 12 TO A `deck unreachable` LINT ON
RIDES THAT ARE PERFECTLY WALKABLE.** The mechanism, validated node-for-node:

1. `Park/wrappersLand.tsx:641` passes `renderEdges: bEdges.length`, so
   `PathNetwork/build.ts:177` builds and lints **only the STREET prefix** —
   access-spur edges never enter `buildEdges` at all.
2. `build.ts:301`'s deck-reachability BFS seeds at `Math.abs(nodeY) <= 0.05` and
   then traverses **only those built edges**.
3. A spur node INHERITS its parent street node's `nodeY`
   (`wrappersLand.tsx:626-632`). If that parent solved above 0.05, the spur is
   never seeded and there is no built edge that can reach it — so it is reported
   `deck unreachable` at a **measured walkable grade of 0.00**.

Evidence across `skeleton-a` / `skeleton-b` / `r16b` / `r15a`: **100 % of the
flagged indices are `>= streetNodes`** — every one a spur, never a street node;
`maxGrade` is **0.03** against the `MAX_SLOPE` cap of **0.4167** (`0.5 / 1.2`,
`build.ts:208`); gate reachability is **100 % with 0 orphans** in all four. On
skeleton-a the street nodes solving `|nodeY| > 0.05` are exactly
**{10, 11, 13, 26, 80, 82, 84}** — precisely the 7 parents of its 11 lints — and
all 19 other spur hosts produced zero.

> **THE RULE: every ride queue tail, exit lane, stall front and restroom must
> attach to a street node whose solved `|nodeY| <= 0.05`.** Only the ATTACH POINT
> moves — the ride does not, the pad does not, the theming does not.

**IT IS NEARLY FREE: skeleton-a has 61 of its 87 street nodes lint-safe, skeleton-b
41 of 58.** Find them OFFLINE before you build: `probe-skeleton.mjs` replays the
`<Paths>` height solve on the guarded ground and reports the per-node ramps in
**~2 s** (measured 2.375 s on `samples/skeleton-a.tsx`). Do not discover this in the
browser.

**DO NOT ASSUME A COMFORTABLE MARGIN.** Nodes **10, 11, 26, 80, 82 and 84** all sit
within **0.031** of the 0.05 threshold, so a seed change, a `keepDry` edit or a new
guard cell can flip a safe attach point unsafe. Re-probe after any terrain change.

## 3.1-Z TWO CHEAP CERTAIN POINTS

**NEVER SHIP A RIDE UNDER ITS CATALOG `defaultName`.** §3.1-A loses **0.07 on axis
11** for exactly one reason: its `<MagneticRide>` registers `name="Maglev Glider"`,
and that IS the rig's catalog default (`MagneticRide/index.tsx`:
`defaults: { name: 'Maglev Glider', capacity: 8, … }`). It sounds bespoke, which is
why it survived. **THE CHECK: for every registered ride, compare your `name` against
the rig's `defaults.name` and require a difference** — run it over all of them, not
just the ones that sound generic.

**BUILD ONE `tidewater` OR `emberfall` WORLD — worth +0.25 on axis 16's CHOICE
term.** `scoreWorlds` pays `choiceFull` **0.5** for any built preset strictly BELOW
the corpus median usage and `choiceHalf` **0.25** for one AT it. **MEASURED
2026-07-27, corpus 30 (16 worlds parks), median usage 11:**

| preset | parks using it | CHOICE credit |
|---|--:|---|
| `tidewater` | **2** | below median → **0.5** |
| `emberfall` | **5** | below median → **0.5** |
| `thornwick` | 11 | AT median → 0.25 |
| `brasswork` | 12 | over → 0 |
| `pulse` | 12 | over → 0 |

§3.1-A builds `pulse + brasswork + thornwick` and therefore takes the HALF credit;
swapping one world to `tidewater` or `emberfall` is **+0.25**. A park on
`brasswork + pulse` alone scores 0 and gains the whole **+0.5**. §3.1-B already
scores **5/5** on axis 16 this way.

**THOSE FIGURES ARE STAMPED WITH THE CORPUS SIZE AND THE DATE BECAUSE A FROZEN
USAGE LIST HAS ALREADY ROTTED TWICE HERE** — once claiming the whole DARK category
had never been built when `GhostTrain` was already in 12 parks. **Re-derive before
you trust it:** `underusedPresets(loadCorpus())` in `harness/park-eval/corpus.mjs`
prints `frequency`, `median`, `underused`, `atMedian`, `overused` and `corpusSize`.

The smaller worked example is `<DistrictPark>` (`components/Park/Park.previews.tsx`,
preview 1): three pieces + a 13-node spine on a size-48 plot, `ok: true` — the
un-themed ancestor of the skeleton above.

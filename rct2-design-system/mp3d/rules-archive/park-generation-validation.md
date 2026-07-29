# Composing parks — §5-§7 legality lint, validatePark, triage, reference sketch

> **⚠ A `§` OR A FILE PATH HERE IS PROVENANCE, NOT A LOOKUP — §0.0-F.** You have no
> filesystem while authoring; round 13's park A searched for these very files, found
> nothing, and improvised the mandatory monorail with two props that do not exist.
> Every block a park needs is inlined at its point of use. **If a block is not in
> front of you, use only what is — never reconstruct one from memory.**

The last of seven. See `rules/park-generation.md` for the intro and §0.0;
`-checks.md` + `-checks-b.md` for the §0 PRE-FLIGHT CHECKLIST (1-14, 15-27);
`-composition.md` for §1 (seeds and the ring-clearance table); `-worlds.md` for
§2-§3.1 (including **both** verified skeletons); `-rides.md` for §4. One document.

## 5. Legality lint (place NOTHING without it)

`terrainLint(heightAt, size)` (ParkBuilder) gives you `isDry(x,z)` (ground >
waterLevel + ~0.15), `slopeAt` / `flatEnough` (slope < ~0.45 for rides, ~0.8
for trees) and `inBounds` with a margin (terrain edges taper to 0). If a
spot fails, settle it — never just drop the object.

- Never float, never bury: settle to `heightAt` (trees sink ~0.04-0.08,
  rocks partially buried, podiums/berms/plinths bridge from below ground).
- Trees ≥ 1.25 from edge centrelines (canopy over guests' heads), ≥ 1.6
  from the coaster plan polyline, obstacle radius + 0.6; prune rock-cluster
  boulders that land within 1.25 of an edge or inside a committed footprint.
- **SOLID PROPS NEED `pathHalf + groundRadius` OF CLEARANCE, AND THE CALL IS
  MANDATORY, NOT AVAILABLE (round-7, hardened wave-12).** A `<Scenery>`/`<Placed>`
  piece whose ground footprint eats into a rendered slab is a `scenery` FAIL.
  Required clearance is `pathWidth/2 + min(groundRadius, 0.6)` (≈ 1.03 for a
  statue on a 1.1 slab), and the API computes it for you:
  `offPathCell(NET, [3, 3], { clear: 1.2 })` → the nearest legal cell;
  `pathClearance(NET, [3, 3]).clearance` → what you actually have.

  **EVERY hand-placed `<Scenery>` / `<Placed>` CELL COMES FROM
  `offPathCell(NET, cell, { clear: 1.2 })`.** Not the ones that look close — all
  of them. Two cells are a `scenery` FAIL by definition, and both are what
  hand-typing produces:
  * **a cell that reuses ANY street node's coordinate**, even just one of the
    two. Typing a prop at a street row's own `z` puts it on that row's
    centreline. Wave-12's park hand-typed 18 props and put **six on street axis
    values, four of them at `z = 45.6`** — its own ring's north edge — for six
    FAILs it could have avoided with six function calls;
  * **a cell lying on an authored edge's centreline** between two nodes — the
    same mistake with the nearest node one cell further away.

  **AND A BUILDING IS NOT A PROP.** A `<Restroom>`, a hut or a hand-placed stall
  is a SOLID with a doorway and needs the ride-pad clearance:
  **`offPathCell(NET, cell, { clear: 1.8 })`, and NEVER a coordinate that also
  appears as a `boulevardPlan`'s `from` or `to`.** A `<Boulevard>` paves its
  carriageway as a 1.2-u CHAIN, so **every cell along the leg is a street node**,
  not just the two ends — an avenue's endpoint most certainly is one. Wave-12 put
  `<Restroom position={[-8.4, 16.8]}>` on a boulevard's own carriageway node and
  collected **2 `blockers` FAILs and `restroomUses 0`**: a restroom no guest could
  reach, which also costs most of the cleanliness axis.

  Round 7's version of the same defect: eight props on "cell centres" at
  ±3 / ±9 / ±15 while its street rows ran at ±3.6 / ±9.6 — 0.6 u from the
  centreline, half a slab INSIDE the street. Plaza interiors are exempt (planters
  on a forecourt are RCT2 dressing).
- **NOTHING IS PLANTED IN THE WATER (round-7).** `<Scenery>`/`<Placed>` now
  sample the ground before mounting: a spot in OPEN water (more than 0.4 u
  below the waterline) is REFUSED — the piece is not built and a §0-FATAL
  `plantedInWater` lint names the dry-cell query that would have prevented
  it. A marginal SHORELINE cell is kept and the settle-time AUTO-keepDry pass
  raises a dry bank under it (non-fatal `plantedWetCell`) — planted
  footprints join that sweep now, so a shoreline dip is landscaped rather
  than merely detected. Neither is a licence to guess: query
  `park.isDryCell([x, z])` against the COMPOSED water (§0.17).

  **AND SIEVE THE LIST RATHER THAN LOSE THE PROP.** A refused prop is not a
  skipped prop — it does not mount, so the count you owe (≥ 32 trees, ≥ 16
  scenery) is short as well as fatal. Round 13's park B took a
  `plantedInWater` refusal for a scenery piece AND one for a tree (**−2 and −2**)
  because its cells were filtered for STREET clearance (`offPathCell`) and never
  for WATER. Filter for both: `-composition.md` §1-W ships the `<DryScatter>`
  child that runs `cells.filter((c) => park.isDryCell(c.at))` after `<Terrain>`
  has composed, logs how many it dropped, and mounts the survivors. It must be a
  CHILD — at module scope there is no `park`, and `isDryCell` on an unmounted park
  answers `true` for everything.
- **SOLID means solid (round-6).** Guests walk the path graph plus short
  sanctioned hops, and the sim now refuses to route through a registered
  BLOCKER (fountain basins, ride bodies/pads, shop bodies, restroom huts,
  queue railings, `<Fence>` runs — see GameManager/Context.md "Blockers").
  So: keep street edges ≥ 1.2 u from a fountain centre, never lay a street
  across a ride pad, and when you fence a boundary that a street crosses,
  author TWO runs with a gateway gap (or `<Fence inset>`). Registration is
  automatic for rides/stalls/`<Fountain>`/`<Restroom>`/`<Fence>`; custom
  solid dressing calls `usePark().registerBlocker({ rect | circle, label })`.
  A street through a blocker is a hard `validatePark` FAIL (§6), not a lint.
- **Queue lanes are FENCED** — every registered ride's queue is railed down
  both long sides (Fence `'metal'`) and is only enterable at its open TAIL,
  so the tail node must sit on a real street node (§0.4) or guests can never
  join. Never plan a layout that expects guests to step into a lane sideways.
- Lights OFF until dark: every PointLight/emissive gates on `nightKOf`.
- Mood is POSTURE — no overhead UI over guests, ever.
- Keep the realistic palette (muted brick red, forest green, navy, cream,
  grey-brown — no orange/pink plastic) — ride colours come from ColorKit
  presets, never invented mid-park.
- **COLOUR PROPS TAKE A NUMERIC HEX — `0xffcf6b`, NEVER THE CSS STRING
  `"#ffcf6b"`.** `<Neon color secondary>`, and every `colours` field the kit
  exposes, are typed `number` (three.js colour ints), so a quoted CSS string is a
  type error at the call site — one of the two that shipped in wave-12's park
  (`<Neon color="#ffcf6b">`). The only string-valued colour props in a park are
  `<Park background>` and the CSS-facing UI props. When in doubt, take the value
  from a **ColorKit preset or `RCT2_COLOURS`** instead of writing a literal —
  which §5 already asks of you for palette reasons, and which is also always the
  right type.
- **AND A RIDE'S `colours` PROP IS NOT A COLOUR — IT IS A `RideColourScheme`
  OBJECT `{ track, vehicles }`. OMIT IT.** The chassis presets it
  (`rideColourPreset(park.seed + 2, type)`); if you must pin one, pass that
  helper's RESULT. A name string (`colours="fire"`) or a bare hex there **throws
  inside the Stage build callback and zeroes the entire park** — no `__stageApi`,
  no verdict line, nothing registered (§6.1 triage; `park-generation.md` §0
  check 22).
- Deterministic only: hashed-sine PRNGs; no `Math.random` / `Date.now`.
  Whole park well under the AREA-SCALED mesh budget (`2500·(size/16)²` —
  **160 000 on the default 128**, ~22 500 on a 48; §6).

## 6. validatePark — the acceptance gate

```ts
import { validatePark } from './components/ParkBuilder';
const report = validatePark(t, {
  net: parkNet,               // the SHARED graph (manager attach nodes included)
  manager: mgr,               // needs accessPoints()/footprints() (GameManager has them)
  terrain: { heightAt, waterLevel: WL, size: S, peaks: comp.peaks },
  coasters: [{ points: coasterPts, type: 'wooden', bank: 0.2 }],
  group: g,                   // mesh budget + determinism hash
  rebuild: () => buildAgainWithValidateFalse(), // optional determinism check
});
// report = { ok, failures: [{ check, detail }] }
```

The checks — a failure on ANY of them is FATAL (§0): the park is re-planned,
not shipped:

- **accessibility** — BOTH SIDES OF EVERY STATION (check a4, 2026-07):
  * the registered gate routes to EVERY ride's queue tail (as before), **and**
  * every ride has an **EXIT PATH** (`exitLaneLen > 0`) whose spur routes back to
    the gate. RCT2 blocks `Ride::open` outright on a MISSING exit
    (`RideCheckForEntranceExit`, Ride.cpp:2366-2412) and permanently red-flags an
    UNPATHED one — `STR_EXIT_NOT_CONNECTED`, *"has no path leading from its exit!
    Construct a path from the ride exit"* (Ride.cpp:2076). Here it is a hard FAIL
    rather than a news item because this sim has no terrain-walking
    `PeepState::falling`: where RCT2 would drop the guest on the grass to wander
    off lost (Guest.cpp:5092-5140 → Peep.cpp:781-890), a guest whose exit spur
    never reached the network is simply left OFF-GRAPH — which the `sim` gate
    already failed as a stuck walker, two checks later and without naming the
    cause. Exactly symmetric with "gate cannot route to the `<ride>` queue tail".
  * entrance and exit not ADJACENT on the same outward face is an
    **`exitNotAdjacent` WARNING**, not a failure. RCT2 does not enforce it —
    `RideStation` holds two independent `TileCoordsXYZD` (Ride.h:172-173) and no
    code anywhere compares them; each is validated only against the station track
    (RideConstruction.cpp:1584). A long station with the entrance at one end and
    the exit at the other is authentic, so failing it would condemn legal
    layouts. §0's FATAL-WARNINGS POLICY still means a park carrying one is
    re-planned before it ships.
  * **EVERY PLATFORM of a MULTI-STATION ride, individually (check a4b).** An
    RCT2 `Ride` owns an ARRAY of stations (`std::array<RideStation,
    kMaxStationsPerRide>`, ride/Ride.h:404) and the transport rides are why
    (`ride/rtd/transport/Monorail.h:19-84` sets neither `RtdFlag::hasOneStation`
    nor `hasSinglePieceStation`). a3/a4 above audit the ride's OWN fields, i.e.
    platform 0 — so on the four-platform park-spanning monorail §0 now REQUIRES
    (rules/park-generation-rides.md §4.2), three of four boarding points went
    completely unaudited. a4b walks `accessPoints().rides[i].stations[]` and
    fails each platform on its own `queueNode` (attached AND routable from the
    gate) and its own `exitLaneLen > 0` + routable `exitNode`. **A platform
    guests cannot walk to is not a station**, and an unreachable one is the
    "transport ride nobody can board" defect in a subtler costume. Measured on
    `samples/monorail-ref.tsx`: four platforms, four distinct queue/exit spur
    node pairs, `exitLaneLen` 6.01 u on all four.
- **terrain** — exactly `waterBodyTarget(size)` flood-filled water bodies:
  **TWO** on any plot ≥ 64 (a dominant one plus a secondary at ≥ 16% of its area
  and ≥ `max(5, 0.055·size)` u clear of it), ONE below 64. 3+ is still a scatter
  FAIL. The entrance apron flat
  (relief ≤ 0.5) and dry; no structure footprint parked on a hill flank.
- **footprints** — OBB SAT sweep over every audited rect: no overlaps. Since
  2026-07 that includes the EXIT PATH's one or two legs (`<ride> exit lane`,
  `<ride> exit lane join`). Exempt, by design, are a ride's own abutting pairs:
  entrance hut × queue lane, exit hut × exit path, and — when the path JOINS the
  queue's own tail node rather than a cross-street — exit path × queue lane /
  entrance hut. One ride's access rig, built by one function from one plan.
- **coaster** — `checkCoasterDesign` clean + `validateSpline` ok + CRASH-FREE
  (worst lateral G under 1.5 g × 0.85, replaying the real runner's pacing).
- **corridor** (round-4) — a 1.6-u-wide corridor swept along every registered
  circuit (segment OBBs over the sampled polyline) must be CLEAR of stall
  footprints, OTHER rides' pads/huts/lanes, and street edges at grade.
  Flying OVER is legal only with ≥ 2.2 u of clearance above the
  obstacle/path level — grade crossings and roof-skims FAIL, naming the
  offender. The ride's own access assembly is exempt (match by ride name).
- **blockers** (round-6) — **guests cannot walk through solid objects.** No
  RENDERED street edge may pass through a registered blocker (sampled every
  ~0.3 u): fountain basins, ride bodies + boarding pads, shop bodies,
  restroom huts, queue railings and every `<Fence>` run. Logical access
  spurs (queue tail, ride exit, stall front, doorway, gate) are exempt — they
  ARE the sanctioned way in. Every ride's queue tail must also stay
  REACHABLE from the gate once the blockers are respected. Practically:
  keep streets ≥ 1.2 from a fountain centre and off ride pads, and fence a
  boundary with a **GATEWAY** where a street crosses it (two `<Fence>` runs
  with a gap, or `<Fence inset>`).
- **autofix** (round-6) — the FATAL-WARNINGS POLICY (§0) made mechanical.
  Every build-time lint / auto-fix event the wrappers recorded via
  `park.reportLint` is echoed in **`report.warnings: { kind, detail, fatal }[]`**,
  and the fatal ones become hard `autofix` FAILURES. The COMPLETE list as of
  round 7:

  | §0-FATAL kind | what it means |
  |---|---|
  | `causeway` | level > median + 0.8, or a span > 1.0 u over its ground |
  | `causewayRefused` | a span > 2.0 u up — **the edge was NOT built** |
  | `latticeInWater` | a span whose ground dips under the waterline — **NOT built** |
  | `padOnStreet` | a ride/shop pad INTERSECTS a street slab — **AUTO-MOVED to `offPathCell`'s legal cell**, still fatal (§0.14) |
  | `pathClipping` | the walked surface is > **0.25 u UNDER the terrain**, or > **1 %** of the corridor is buried — REROUTE along the contour or add intermediate nodes; never widen the tolerance (§0.6) |
  | `terrainFlattened` | the park's own `keepDry`/`coasterPts` guard list ironed the landform below its published §1 band — guard TIGHTLY, keep guards off peaks, prefer `noDress` (§1). NAMES the guard cells and the range each one cut, `waterRePicked`-style. FATAL only on the CONJUNCTION "kept < 70% of what the seed drew (`comp.report.reliefFloor`) AND below the published band"; either alone is a non-fatal warning, because a big layout must flatten its own pads and a `plains` seed is legitimately gentle. **TWO MEASURED CAUSES WORTH KNOWING BEFORE YOU HUNT IT: (1) THE FLAGSHIP ON A FLANK** — `reliefBias inner` is 0.18, so the ranges live on the flanks; a `coasterPts` circuit out there took one park to kept **69 %** AND stdH **0.69**, i.e. both halves of the conjunction and §0-FATAL, while the same circuit in the plot CORE read kept 73 % and a warning. **(2) A RING'S SOUTH QUEUE ON SEED 1 TEMPERATE** — the tallest range sits at ≈(5, −43) h 8.59 and an INWARD South queue (tail `[0, −44.4]` plus the column paved to it, 5.3–5.8 u out) cut it to 0.83, for kept 0.73 and `stdH` 0.71. **This was published for three waves as "any seed-1-temperate ring park pays this, there is no layout fix" and BOTH halves were false: queue the SOUTH platform OUTWARD (tail `[0, −57.6]`) and the warning does not fire on either reference skeleton** (kept 0.82 / 0.81, `stdH` 0.81 / 0.79, `gateWarningKinds {}`, axis 7 9/9). **So never accept this finding as "documented" — a guard cell needs ≥ 10.62 u of clearance from a summit to cost that peak nothing, and that is an arithmetic you can author to.** Or pin **31 temperate**, whose guarded relief 12.02 / stdH 1.32 sits ABOVE the band so the finding cannot fire (§1's ring-clearance table) |
  | the auto-elbow / port-retie plan lints | a DIAGONAL authored edge was elbowed into two cardinal legs through a synthesised corner, or an edge crossing a set-piece's solid was cut and re-tied through that piece's PORTS — the park renders, and still fails (§0.14) |
  | `boulevardDiagonal` / `boulevardTooShort` | a PLAN LINT: `boulevardPlan` endpoints not axis-aligned (L-routed for you) / under 3 cells |
  | `unknownPort` / `badEdgeEndpoint` / `noNodeOnCell` | PLAN LINTs: a port/edge/cell that does not exist — degraded, the park still renders |
  | `netWarnings` | a PLAN LINT: `buildParkNet` reported a diagonal edge or a separate island (§3.1). **The commonest cause is a SET-PIECE WITH NO PORT-REF IN `EDGES`** — `pieces:`/`worlds:` inserts the piece's sub-net and joins it to nothing, so it composes as an island whose stalls no guest can reach. Every `bazaarPlan`/`fountainPlazaPlan`/`boulevardPlan` id needs at least one `'<id>:<PORT>'` entry; N pieces ⇒ ≥ N refs, and you count them (§0.15) |
  | `edgeDiagonal` | an authored `EDGES` pair with neither coordinate shared — **auto-ELBOWED through a synthesised corner node you did not plan**, which a hand-sited pad or a corridor sweep then lands on. The three-line cardinal assertion in §0.15 catches it for free, and it must SKIP `NetRef` string endpoints (`typeof x !== 'number'`) or it throws at module scope on a legal park |
  | `edgeThroughSolid` | an edge wired into a piece's POSITION rather than its PORT — most often a `<FountainPlaza>`'s centre, whose middle 3×3 is a solid basin. **CUT and re-tied through the piece's ports**, still fatal. `'viewpoint:W'`, never `viewpoint.position` |
  | `queueTailShared` | two rides attach their queue tails to the SAME node |
  | `plantedInWater` | a prop in open water — **not planted** |
  | `queueDirFlip` / `queueDirUnfixable` | the derived lane speared the ride's own pad |
  | `exitHutRelocated` / `exitHutUnfixable` | the exit hut had to be moved off the lane |
  | the `corridor*` family | a settle-time shift out of a track corridor |
  | `coaster:shortDrop` | first drop under the 0.9-u stat gate — promoted by the gate itself (`FATAL_LINT_KINDS`), since `<Coaster>` cannot know the policy |

  Reported but NOT fatal: `laneTrim`, `exitNotAdjacent` / `exitFaceBlocked` /
  `exitLaneUnreachable` (the RCT2 entrance/exit layout — §0.4b; adjacency is
  player convention, not a rule RCT2 enforces), `pathLevelMedian`,
  `padNearStreet`, `plantedWetCell`, `coaster:shortLength`,
  `queueAnchorIsHead` (**auto-corrected** since wave 9 — §0.4),
  `deadStreetNode` (a spur with nothing on it — §3.1; **and the commonest cause
  is now a CHAIN piece wired at one end only** — both of `<Boulevard>`'s ports are
  `prunable: false`, so an unwired end is BUILT, not pruned, and the carriageway
  dead-ends in grass. §0.15's assertion covers it by reading `pt.prunable` off the
  plan),
  (but **`rampRefused`** IS fatal — §0.6),
  `waterRePicked` / `waterShrunk` / `waterGrew` (the composed water moved off
  its pinned §1 row — §1; the mechanical prevention is §1-W's
  `assertKeepDryOffRow(KEEP_DRY, SEED_ROW)`, not a paper walk — **but that
  assertion is a SIEVE, not the authority.** Its boxes are the flood-filled
  regions' bounding boxes and the BOWLS are wider: seed 1's secondary box ends at
  `x −21`, its bowls reach `x −18.1`, so a column at `x −19.2` crossing `z 23…39`
  clears the sieve and still moves that body **25 u**. **The §5c unguarded-vs-guarded
  re-compose is the authority; ship both**),
  `rosterOverstated` (the header claims more rides or
  categories than the park registered — §0.16), `plazaTilesClamped`,
  `bazaarStallCount` (**a `bazaarPlan` declared fewer than 3 stalls and was
  AUTO-PADDED to 3 with a `BalloonStand`** — `Bazaar/index.tsx:172`. Never
  cosmetic: `k` drives `tiles = 2k + 1` and `half = 0.6·tiles`, so the padding
  moves both port cells and re-lays every stall anchor under arithmetic you wrote
  for the smaller `k`. Round 13's park B took **three `padNearStreet` lints at
  1.20 u** plus a `rosterOverstated` (`stalls: 6` claimed, **9** registered) from
  three 2-stall bazaars. Declare 3-6, and count the roster off
  **`plan.slots.length`** — the POST-padding list). **They are still
  warnings, and warnings are FATAL under §0** — a clean park has NONE.

  **ONE EXCEPTION, AND IT IS NOW QUANTIFIED: A `<Bazaar>`'s OWN STALLS LINT
  `padNearStreet` AGAINST ITS OWN AISLE, AT EXACTLY 1.200 u, AND NO AUTHOR CAN FIX
  IT AT ANY ROW SIZE.** `bazaarPlan` plants each stall **1.2 u** off the aisle
  (`side · CELL`, Bazaar/index.tsx:247), the aisle itself is PAVED into the fused
  net, and §0.14's stall margin is `padHalf + pathWidth/2 + 0.05` = **1.20 u** for a
  stall body — so the test is `1.20 < 1.20` on a float. **MEASURED 2026-07-26 by
  running `bazaarPlan` in isolation at every row size and taking each slot's
  distance to the nearest aisle node:**

  | stalls asked | tiles | slots | stall → aisle street |
  |---:|---:|---:|---:|
  | 3 | 7 | 3 | **1.2000 u** |
  | 4 | 9 | 4 | **1.2000 u** |
  | 5 | 11 | 5 | **1.2000 u** |
  | 6 | 13 | 6 | **1.2000 u** |
  | 7 | 13 | **6** (clamped) | **1.2000 u** |
  | 8 | 13 | **6** (clamped) | **1.2000 u** |

  **It is 1.2000 u at every size, against a 1.20 u floor. NO ROW CONFIGURATION
  CLEARS IT.** Which rows then trip is decided by rounding in the `facing`
  quarter-turn, not by anything you chose: **6/3/3 → 6 lints · 4/4/4 → 8 lints ·
  published skeleton C → 5.** So **changing row sizes only changes the COUNT** —
  there is no tuning move here and you must not spend a round looking for one.
  `validatePark` still returns `ok: true` over them (§3.1-A ships 6 and reads
  `ok: true`, 0 failures), and the printed remedy ("move the pad to …") is
  UNAVAILABLE: the pads are inside the set-piece and `pinStalls` defaults true
  precisely to stop the corridor resolver moving them. **Report the count, do not
  chase it, and never disable `pinStalls` to silence it.**
  *(Design-system issue, logged: either the stall offset or the §0.14 margin should
  move by one lattice cell, or `padNearStreet` should exempt a pad and a node that
  belong to the SAME set-piece. Note also that the 6-stall clamp above is SILENT —
  `stalls.slice(0, 6)` raises no lint — so asking for 7 makes a `stalls:` roster
  count taken from your own array a `rosterOverstated`. Count `plan.slots.length`.)*

  **AND THE `padNearStreet` LINTS THAT ARE REAL CARRY THE NUMBER YOU NEED.** The
  margin is `max(1.8, bodyHalf + pathWidth/2 + 0.05)` from the rig's RENDERED
  footprint — **not from its capacity** — so it is a per-COMPONENT constant:
  `<GhostTrain>`/`<HauntedMansion>` **4.77** · `<PaddleBoats>` 3.12 ·
  `<Discotron>` 3.07 · `<FerrisWheel>` 2.97 · `<AetherBalloons>` 2.95 · compact
  flats 3.2. Round 14's park B used the published constant 3.2 on a `<GhostTrain>`
  and collected the lint at 4.42 vs 4.77. Read the number off the lint and pin it.

  **READ THE REFUSALS AS A CHAIN.** `latticeInWater` and `causewayRefused`
  DELETE the offending edge, so the very next failures you see are
  `accessibility` (a ride's queue no longer routes from the gate) and
  `blockers`-unreachable for everything that sat behind the hole. Those are
  DOWNSTREAM of the refusal, not separate bugs: fix the span and they vanish.

  **An auto-fix must never silently rescue a design you were supposed to
  re-plan — an EMPTY `warnings` array is the only truly clean result.**

  **TWO DEFECTS THE GATE CANNOT NAME, SO CHECK THEM YOURSELF (wave-14).** Both
  cost round 12 real points and neither produces a lint of its own:
  * **`buildParkNet` called TWICE.** The gate audits one graph — whichever
    `<Paths>` got — and cannot see that your `offPathCell` calls were resolved
    against a different one. Round 12's `NET` omitted a late 116 u² plaza that
    `NET2` had, so the restroom, all the scenery and all 34 tree cells were
    "cleared" against a net that did not describe the park. **Call it EXACTLY ONCE,
    declare every piece in that one `pieces:` array, and pass the same `NET` to
    both** (§0.15).
  * **A pad that never went through `offPathCell`.** You will see this only as
    downstream `padOnStreet` + `footprints` FAILs. A helper that derives the pad
    tail-first and returns the raw sum is the trap — round 12's did, three of six
    pads needed the auto-move, and one auto-move stacked two rides for **5
    `footprints` FAILs** and ride spacing 0/8. The helper's last line is
    `return assertPadFlat(offPathCell(NET, pad, { clear: padMarginOf(rig) }) ?? pad, …)` (§0.19)
    — **`padMarginOf(rig)`, not 1.8 and not a constant 3.2:**
    1.8 is the BUILDING value and is under every flat-ride rig in the catalog. And the
    helper must ASSERT the reach: `minReach(c) = laneLenOf(c) + 1.92`, cap 12 ⇒ 9.74 u,
    which is the floor round 13's Discotron pad missed by 5.31 u.

  <a id="pre-bundle-gates"></a>
  **AND THE SIX THAT STOP THE PARK BEING BUNDLED AT ALL — `preflight.mjs`'s
  PRE-BUNDLE GATES. THERE ARE SIX, NOT TWO.** `preflightCheck` (`preflight.mjs:436-456`)
  runs five check functions over the entry file and its local sibling modules;
  `checkPreflightHeader` emits **two** distinct problems, so the count of ways to be
  refused is **six**. `eval.mjs:48-49` exits 1 on ANY of them: no esbuild, no browser,
  no page, no screenshot, no `validatePark` line, **no evidence at all** — the round
  scores 0 and the symptom looks like a harness failure. **Run
  `node preflight.mjs samples/<park>.tsx` FIRST, every time.** It takes milliseconds.

  | # | gate (`preflight.mjs`) | what refuses the bundle |
  |---|---|---|
  | 1 | `checkImports` (`:400`) | a relative `import` naming a component that is **not in `mp3d/components/`** — a deleted land macro or a misspelling. Every file, not just the entry. |
  | 2 | `checkPiecesCast` (`:410`) | `pieces={… as string[]}` (or `as unknown as string[]`) on a ride tag. `pieces` is `TrackPiece[]`; the cast hides a real type mismatch. |
  | 3 | `checkRatingsWithoutMeasurement` (`:422`) | an authored `ratings={{ … }}` on any ride while the file contains **no `rateCoaster(` call anywhere**. Transcribed ratings, not measured ones. |
  | 4 | `checkPreflightHeader` a (`:388`) | **no §0 PRE-FLIGHT header.** A MACHINE-CHECKED GATE — see below. |
  | 5 | `checkPreflightHeader` b (`:390`) | `<Park>` with **no `roster={{ rides, stalls, categories }}` prop.** A correct roster line in the §0 header COMMENT does not substitute for the PROP; round 12 shipped exactly that pair and lost the round's evidence. |
  | 6 | `checkMonorail` (`:307`) | **no `<Monorail>` on a plot at `size >= 64`** (wave-15). Round 12 dropped the ring; round 13's park B dropped it again, in writing, as a *"pragmatic simplification"*. Skips only: a file that authors no `<Park>` of its own, any plot under 64, and a CLOSED list of pinned pre-mandate fixtures. **No in-file marker suppresses it.** Paste §4.2-A. |

  **GATE 4 IS THE ONE NOBODY KNEW WAS A GATE, AND IT IS MECHANICAL.** The §0 header
  is not process discipline — `hasPreflightHeader` (`preflight.mjs:373-376`) reads the
  file's **LEADING comment block** (a `/* … */` block, or a contiguous run of `//`
  lines, starting at the first non-whitespace character — anything else, including an
  `import`, means the leading block is `''` and the gate FAILS) and requires **BOTH**:

  1. **`block.length >= 200` characters** (`HEADER_MIN_LEN`, `:344`). A one-line
     docstring does not clear it.
  2. **at least one `HEADER_KEYWORDS` match** (`:339-343`), the list verbatim:
     `/§0/` · `/PRE-FLIGHT/i` · `/\bSEED\b/i` · `/\bSIZE\b/i` · `/\bWORLDS?\b/i` ·
     `/\bROSTER\b/i` · `/\bGATE\b/i` · `/\bFLAG\b/i` · `/\bQUEUE\b/i` ·
     `/\bLATTICE\b/i` · `/\bSPREAD\b/i` · `/\bDRESS\b/i` · `/\bMONO(?:RAIL)?\b/i`.

  The check is deliberately **tolerant of FORM and strict about PRESENCE** — it does
  not police §0.0-H's row labels or banner glyphs (`samples/coolpark-a.tsx`'s shorter
  block counts) — so the §0.0-H template clears it with room to spare and there is no
  reason to ship without one. **THE HEADER MUST BE THE FIRST THING IN THE FILE.** Put
  an `import` above it and the park loses the round with zero evidence.
- **sim** — steps `manager.update` at fixed dt for
  `max(SIM_SMOKE_SECONDS, ⌈2.5·maxRideDuration + 20⌉)` sim-s (**60 s** for any
  registered ride ≤ 16 s; the window only widens for long rides, NOT for large
  plots): at least one completed ride cycle, no visible walker frozen >25 s, no
  queue that holds >`max(30, maxRideDuration + 15)` s without ever advancing.
  **`SIM_SMOKE_SECONDS` is 60 at every plot size on purpose** — see §0.3 check
  1: the window buys ~20 u of gate→tail walk, and past ~72 u guests leave the
  park before riding, so a longer window cannot rescue a far-gate layout, it can
  only slow every acceptance run down. Fix the LAYOUT, not the window. NOTE:
  this fast-forwards the manager's sim clock — keep render time monotonic
  afterwards (add the report's `simSeconds`, or `SIM_SMOKE_SECONDS`, to your
  updater clock, as the worked example does).
  ALSO NOTE: the smoke run is 60 s of REAL sim, so the GATE STREAM runs inside
  it — a park opens on `guests` and the first frame you see already carries the
  arrivals that walked in during validation (measured: setpiece-ref's pinned 18
  became 34, seed-1's 20 became 36). That is expected, it makes the sim gate
  EASIER not harder (§0.3 check 1 has the re-measured numbers), and the run
  itself costs 0.2-0.7 s of wall time depending on the crowd.
- **budget + determinism** — mesh count against the AREA-SCALED budget
  (`2500·(size/16)²`; **160 000 on the default 128**, ~22 500 on a 48):
  exceeding it is
  a `console.warn`, NOT a hard fail — LOD tiers + culling fog keep big
  parks drawable — but warnings are FATAL under §0, so treat it as one.
  With `rebuild`, a double-build scene hash must match exactly.

Run it as the LAST build step and log the report (console.warn per failure)
— the worked example (`buildExamplePark`, ParkBuilder preview) does exactly
this and ships with `ok: true`. A park is not done until its own run says
the same.

**THE VERDICT LINE IS NOT OPTIONAL, AND `<Park>` NOW ALWAYS EMITS IT.** The
scoring harness greps for exactly

```
[Park] validatePark → ok: true          # or the JSON failure list
[Park] validatePark FAIL [<check>] …    # one line per failure
```

A round-8 park relied on `<Park onReady>` alone and produced NEITHER line, so
it was unscoreable: "no validatePark output within settle window". If you
compose with `<Park>` you get the line for free — **including when the park is
too broken to validate**: with no `<GameManager>`/`<Gate>`/rides mounted,
`<Park>` now prints the verdict with an `accessibility` failure rather than
silently skipping the gate. If you compose imperatively, call `validatePark`
yourself and log those exact strings. Never assume the gate ran.

## 6.1 TRIAGE — THE PARK RENDERED NOTHING AND THERE IS NO VERDICT LINE

The most expensive failure in the corpus produces **no report at all**, so it
cannot be diagnosed from the failure list — there isn't one. Match the symptom
here first.

| symptom | first suspect | what it is NOT |
|---|---|---|
| **no `validatePark` line anywhere** in the page log, `probe.json` carries **`notes: ["no __stageApi — not a Stage scene"]`**, most probe sections missing, a **`[pageerror]`** in the log, an empty/black frame | **AN INVALID PROP VALUE ON A RIDE.** It threw inside the **Stage build callback**, so `canvas.__stageApi` was never published — and then nothing downstream ran: no `validatePark`, no `registerRide`/`registerStall`, no meshes | **not** a harness stall, **not** a settle-window timeout, **not** a bundling problem. Do not re-run it hoping for a different frame |

**Round 12's park B, measured: 15/100 from one word** — `<Coaster … colours="fire">`.
`colours` is typed `RideColourScheme` = `{ track, vehicles }`, an OBJECT;
`Park/pieces.tsx:285` takes `props.colours ?? rideColourPreset(park.seed + 2, type)`
so a string passes straight through, and `:400` then reads `scheme.vehicles[0]` →
**"Cannot read properties of undefined (reading '0')"**. `typecheck` reports it
(TS2322) but **esbuild strips types**, so the bundle the harness runs still
contains it.

**HOW TO TELL IT APART FROM A FRAME-SCHEDULER STALL** — the other way a park
comes back with no picture:

| | invalid prop value | frame-scheduler stall |
|---|---|---|
| `[pageerror]` in the log | **YES — read it, it names the property** | none |
| draw calls | sections missing entirely (no `__stageApi` to ask) | **0 draws** reported |
| lints / warnings | present (module-scope plan lints already recorded) | present |
| `validatePark` line | **absent** | absent |

So: **lints AND a `[pageerror]` ⇒ an invalid prop value. 0 draws WITH lints and
no `[pageerror]` ⇒ a scheduler stall.**

**THE FIX, in order:** read the `[pageerror]` message → it names the property that
was `undefined` → find the ride prop that fed it → **delete the prop** (the
chassis presets `colours` for you) or pass a value of the declared TYPE
(`colours={rideColourPreset(7, 'steel')}`). Then re-check every ride against the
published wiring block in `park-generation-rides.md` §4.0: **pass only the props
that block shows.** The general rule and the price list are `park-generation.md`
§0 check 22 — an invalid prop VALUE on a ride silently zeroes the whole park, so
it is worth more than every other item on that checklist combined.

## 7. Reference sketch (compose your OWN structure on top)

```tsx
const SIZE = 128;                                                             // ALWAYS pass it: parkComposition's own default is still 48
const comp = parkComposition(t, seed, SIZE, climate, { keepDry, coasterPts }); // probed landform (§1)
const terrain = buildTerrain(t, { size: SIZE, seed: comp.terrainSeed, ...comp.landform, waterLevel: -0.26,
  peaks: [...comp.peaks, ...comp.clampPeaks], basins: [...comp.basins, ...comp.clampBasins], firmShore: true });
// ^ SPREAD `comp.landform` — never the old `amplitude: 0.38, scale: size * 0.52`
//   constants. The base field is a per-seed ARCHETYPE since wave 8, so the
//   constants sample a heightfield the park does not have (see §1).
tintTerrainForClimate(t, terrain.mesh, comp.climate, comp.basins, comp); // climate bias + section zone paint
const dressed = dressTerrain(t, comp, terrain.heightAt); g.add(dressed.group); // sections dress themselves
g.add(terrain.mesh);
const water = buildWater(t, SIZE * 0.995, 120); water.mesh.position.y = -0.26; g.add(water.mesh); // 127.36 at SIZE 128 — ONE sheet still covers BOTH water bodies
const parkNet = snapNetToGrid({ nodes, edges }, 1.2); // YOUR lattice skeleton — nodes may be [x, z, elevation] triples (ramps)
const net = buildPathNetwork(t, parkNet, { width: 1.1, y: pathY, groundAt, grid: true, plazas: [PLAZA] });
const walk = attachWalkers(t, g, net, { count: 6 }); // BEFORE the manager
bermNetToGround(t, g, parkNet, pathY, groundAt); // low spans bermed (inclined embankment under grounded ramps); elevated spans ride buildPathNetwork's wooden scaffolds
const gate = buildParkEntrance(t); // centred on the apron, +z outside
const coaster = buildRideSpline(t, pts, { profile: 'coaster', type: 'wooden', groundAt, colours, vehicleSchemes });
const run = coaster.run(cars, { spacing: 1.2 });
const mgr = createGameManager(t, { groundAt, net: parkNet, laneY: pathY + 0.09, bins });
mgr.registerParkEntrance(gate);
const acc = planRideAccess(parkNet.nodes, tailNode, dir, 3, exitCellXZ, exitDir);
const h = mgr.registerRide({ ...cfg, queueAnchor: [acc.anchor[0], padTop, acc.anchor[1]], queueDir: acc.dir,
  exitPoint: [acc.exit[0], padTop, acc.exit[1]], vehicleHandle: { crashed: () => coaster.crashed() } });
groundRideAccess(t, g, groundAt, acc, padTop, [h.exitPoint()[0], h.exitPoint()[2]]);
coaster.group.userData.rideRef = h; coaster.group.userData.rideVehicle = cars[0]; // clickability
mgr.spawnGuests(10);
const report = validatePark(t, { net: parkNet, manager: mgr, terrain: {...}, coasters: [...], group: g });
// report.ok MUST be true before the park opens — log it.
```

The complete runnable version of this sketch is the ParkBuilder preview
(`components/ParkBuilder/ParkBuilder.previews.tsx`); the JSX composition to
start from is **`<DistrictPark>`** (`components/Park/Park.previews.tsx`,
preview 1 — set-pieces + `buildParkNet` + a pieces-mode §4.0 flagship at size
48). Drop to this imperative layer only where the wrappers don't reach. Full end-to-end manual (Stage api, windows,
day/night, catalogs, validators, determinism): **SETUP.md** at the
design-system root.

---
name: park-troubleshooting
description: Use whenever an mp3d park reports a validatePark failure or warning, or whenever you are reviewing/fixing a park layout before shipping it — blockers, accessibility, causeway, corridor, scenery, bounds, terrain, footprints, coaster, autofix, sim failures, or the lints padOnStreet, queueDirFlip, laneTrim, exitSnapped, queueTailShared, latticeInWater, plantedInWater, coaster:shortDrop. Gives the measured failure catalogue from rounds 6-7 with the exact fix, threshold and wrong-vs-right code for each.
---

# Park failure catalogue — every defect that has actually shipped

Look your failure up by `check` or by lint `kind`. Each entry gives the exact
condition, the threshold in the code, and the fix.

## First: read the report correctly

`report.ok === true` is **not** the bar. **An empty `report.warnings` array is.**

```ts
// report = { ok, failures: [{ check, detail }], warnings: [{ kind, detail, fatal }], simSeconds }
```

Failures come out in a fixed order, which tells you where in the pipeline you
broke something: **autofix → budget/determinism → accessibility → bounds →
paths → terrain → scenery → footprints → coaster → corridor → blockers → sim.**

Two things that will mislead you:

- **`'budget'` is declared but never emitted.** Over-budget is a `console.warn`
  only. Budget = `2500 × max(1, size²/256)` meshes → 2500 at size 16,
  **22 500 at size 48**.
- **`determinism` can never fire from `<Park>`** (it never passes `rebuild`).
  It is still a real rule: hashed-sine PRNGs only, never `Math.random` /
  `Date.now`.

Some checks silently skip rather than pass:

- `blockers` is skipped entirely when `manager.blockers()` is empty.
- The `corridor` ride-footprint sweep is skipped when a registered coaster has
  no `name`. **Always pass `name` to `<Coaster>`** or you lose the check.
- `paths` (diagonal edges) only runs when `gridNodeCount` was passed — `<Park>`
  always passes it.

---

## `blockers` — guests cannot walk through solid objects

> `street edge 12 (4→5) runs THROUGH Grand Wheel body near (6.2, -3.0) —
> guests cannot walk through solid objects: reroute the street or move the ride`

Every rendered street edge is sampled every **~0.3 u, endpoints included**, and
tested against every registered blocker: ride bodies + boarding pads, stall
bodies, `<Fountain>` basins (a circle), `<Restroom>` huts, **both queue-lane
railings**, and every `<Fence>` run. One failure per edge. Logical access spurs
(queue tail, ride exit, stall front, doorway, gate) are exempt — they ARE the
sanctioned way in.

The gate's sweep uses the **raw** shape; the runtime routing layer inflates
every blocker by `BLOCKER_PAD = 0.13`. So an edge grazing within 0.13 u passes
the geometric sweep but is unwalkable at runtime — it then surfaces as the
second half of this check instead:

> `the Sky Swings queue tail is only reachable THROUGH a solid object (a blocker
> sits across every route from the gate)`

Fixes:
- Keep street edges **≥ 1.2 u from a fountain centre**.
- Never lay a street across a ride pad or a shop body. Pads live in the middle
  of blocks (see `padOnStreet` below).
- Fencing a boundary a street crosses? **Author TWO runs with a gateway gap**
  (or `<Fence inset>`). A fence laid across a street is a hard FAIL, not a lint.

```tsx
// ✗ WRONG — one continuous run seals the district off
<Fence from={[-18, 6]} to={[6, 6]} style="hedge" />
// ✓ RIGHT — a gateway where the street at x = -6 crosses
<Fence from={[-18, 6]} to={[-7.2, 6]} style="hedge" />
<Fence from={[-4.8, 6]} to={[6, 6]} style="hedge" />
```

---

## `padOnStreet` / `padNearStreet` (fatal / non-fatal lint) — pads ON the lattice

**This is the biggest single round-7 defect: ride pads placed straight ON the
street nodes → 20 `blockers` failures and 5 unreachable queues.**

The mount-time lint measures the worst pad-rect-to-street clearance over every
rendered node and every edge sampled at ~0.3 u, and needs

```
need = max(PAD_OFF_LATTICE 1.8, padHalf + pathWidth/2 + 0.05)
```

- pad slab clearance ≤ `pathWidth/2` → **`padOnStreet`, FATAL**;
- inside the margin but off the slab → `padNearStreet`, non-fatal.

The same audit runs on **stall bodies**.

```tsx
// ✗ WRONG — "the cell centre" was ±3 / ±9 / ±15 with street rows at ±3.6/±9.6:
//   0.6 u from the edge CENTRELINE = half a slab inside the walked surface
<SwingRide position={[9.6, 4.8]} … />      // straight on a street node
<Scenery name="planterBox" position={[3.0, 9.6]} />   // 0.6 u off the centreline

// ✓ RIGHT — ask the lattice where a pad may stand
import { offPathCell, pathClearance } from './components/Park';
const spot = offPathCell(NET, [9.6, 4.8], { clear: 1.8, size: 48, isDry: park.isDry });
// → e.g. [11.4, 4.8]. null means the street skeleton itself is too dense here:
//   RE-PLAN the streets, never shrink the rule.
pathClearance(NET, spot).clearance   // ≥ 1.8 ✔
```

`offPathCell` defaults: `clear` 1.8, `step` 0.6 (half-cell, so results land on
cell centres too), `rings` 8 (4.8 u search), `margin` 1.2.

For solid dressing the number is smaller but stricter in practice: a prop wants
`pathWidth/2 + its ground radius` — ≈ **1.15 u** for a planter on a 1.1 slab.

---

## `accessibility` — the gate must route to every queue tail

Four distinct failures:

| detail | condition | fix |
|---|---|---|
| `no registered park entrance` | no `registerParkEntrance` | mount `<Gate/>` |
| `X: queue tail never attached to the path graph` | the anchor was non-finite | a real number for every queue coordinate |
| `gate cannot route to the X queue tail` | no path in the graph | the graph is disconnected — see below |
| `park gate spawn sits N u inside the terrain edge` | `size/2 − max(\|x\|,\|z\|) > max(1.25, size×0.025)` — **1.25 u on a 48 plot** | leave `<Gate/>` bare (it snaps to z 22.8 on a 48) and put a street node under that cell |

**There is no attach-distance tolerance.** `routing.attach` links a logical node
to the *nearest* street node at ANY distance, so a queue tail 20 u out in the
grass still "attaches" and still routes. That means accessibility will happily
pass a layout whose queues are nowhere near the paving — the defect then
surfaces as `bounds`, `laneTrim`, `exitSnapped` or `blockers` instead. **Do not
use a passing `accessibility` check as evidence that your queues are sane.**

Disconnected graphs come from three sources, in order of likelihood:

1. **A crossing that is not a junction.** Two edges crossing without a node
   there is a dead end guests cannot turn at. `buildParkNet` **splits every
   edge at any node lying on it** — this is one of the main reasons to use it.
2. **A pruned port.** `buildParkNet` drops any prunable port with degree ≤ 1
   (its own interior edge counts as 1), because a dangling port IS the
   "spur dead-ending in grass" defect. If you wanted a queue tail there, run a
   street edge off it first.
3. **An edge the causeway lint DELETED** — see below.

`buildParkNet` reports islands and diagonals in `NET.warnings` before you ever
mount anything. Read it.

---

## `causeway` / `causewayRefused` / `latticeInWater` (fatal lints)

`<Paths>` picks ONE path level. Since round 7 it is **median-based**:

```
nodeGrounds = every node's groundAt
medianGround = sorted[floor(n/2)]          // upper median
spread = maxGround − medianGround
LEVEL_SPREAD = 0.35
if (author gave nodeY / [x,z,elev] triples || spread <= 0.35)  pathY = maxGround + 0.03
else  pathY = medianGround + 0.03, and every node more than 0.35 off gets an
      AUTO RAMP (a non-fatal `pathLevelMedian` lint)
plazaY = pathY + 0.096
```

Then two tests:

| lint | condition | fatal | effect |
|---|---|---|---|
| `causeway` (node test) | `pathY − medianGround > 0.8` | yes | one node on a rise lifted the whole net |
| `latticeInWater` | any of 13 samples along a span has ground `< waterLevel + 0.05` | yes | **the edge is DELETED from the net** |
| `causewayRefused` | a span's lift over the ground `> CAUSEWAY_HARD 2.0` | yes | **the edge is DELETED from the net** |
| `causeway` (span test) | worst span lift `> CAUSEWAY_LIFT 1.0` and ≤ 2.0 | yes | built, on a viaduct |

**A deleted edge cascades into `accessibility` failures.** If you see
accessibility failures you did not expect, look for `latticeInWater` /
`causewayRefused` above them in the warnings.

Fixes, in order of preference:
1. **Get the whole spine into `keepDry`** — every 1.2 step along every edge, not
   just the nodes. `buildParkNet` builds exactly this list; use `NET.keepDry`.
   A nodes-only keepDry list is what lets a span cross an unguarded river bank.
2. **Reroute the edge** onto buildable ground, or add an intermediate node on
   the bank so the span is short.
3. **Ramp down to it** with an `[x, z, elevation]` triple — but note that giving
   ANY node an explicit height switches `pathY` back to the max-based rule, so
   do it deliberately. Ramp rules: max one 0.5 step per 1.2 tile (grade ≈ 0.42),
   sloped runs go STRAIGHT (no bends or junctions mid-slope), every elevated
   node needs a walkable route down.

```tsx
// ✗ WRONG
const KEEP_DRY = [...NODES];                    // nodes only → spans unguarded
// ✓ RIGHT
const NET = buildParkNet({ nodes: MY, edges: MY_EDGES, pieces: [...] });
<Terrain keepDry={NET.keepDry} coasterPts={COMPILED.points} />
```

---

## `scenery` / `plantedInWater` / `plantedWetCell` — props in slabs and water

Every `<Scenery>` and `<Placed>` registers its **ground-contact** footprint
(the XZ extent within 0.45 u of its base — a tree canopy may overhang a path,
its trunk may not). Two tests:

- **Dryness**: centre + 8 ring samples at radius `r`; fail when the min ground
  is `< waterLevel + 0.05`.
- **In the street**: fail when `distanceToEdge + 0.1 < pathWidth/2 + min(r, 0.6)`.
  With the default 1.1 slab that means a piece with `r ≥ 0.6` must stand
  **≥ 1.05 u from the edge centreline**; use **1.2 u (one cell)** and stop
  thinking about it. Plaza dressing is exempt (a piece inside a plaza rect
  skips the path test). One failure per piece.

`<Park>` never passes `pathWidth`, so the check always assumes 1.1 — even if
you set `<Paths width>` differently.

At mount time the wrapper also refuses wet plantings: `≥ wl + 0.05` passes;
between `wl − 0.4` and `wl + 0.05` is a non-fatal `plantedWetCell`; deeper is a
**fatal `plantedInWater`** and the piece is not mounted at all.

**Do not plant against the seed table's water coordinates** — they are
PRE-GUARD and the composition re-picks the body when your `keepDry` overlaps
them. Query the real thing after `<Terrain>` mounts:

```tsx
const park = usePark();
park.terrain?.water          // { x, z, r } — the ACTUAL body
park.isDryCell([x, z])       // whole 1.2 cell: centre + 8 ring samples
```

---

## `corridor` — the coaster's 1.6-u track corridor

```
CORR_HALF   = 0.8    // the corridor is 1.6 u wide
CLEAR       = 2.2    // vertical clearance needed to fly OVER
STRICT_HALF = 1.1    // the 2.2-u keep-clear re-sweep
ROOF_CLEAR  = 0.3    // clearance over the obstacle's own roof
```

Roof heights used by the strict re-sweep: entrance/exit hut **1.5**, queue lane
**0.45**, boardPoint pad **0.6**, stall **2.1** (canopy), anything else 1.2.

Four ways to fail:

| detail | fix |
|---|---|
| `the 1.6-u track corridor runs through <label> with only X u of clearance (flying over needs ≥ 2.2)` | move the object out of the listed cells |
| `<label> sits under/beside the rails — the track passes at y=X while the structure's roof reaches Y` | a relocated/derived hut is NOT exempt — re-plan the cell |
| `the <name> stall sits under/beside the rails` | stalls are never exempt by owner; move the stall |
| `street edge N crosses the track corridor at grade near (x, z) — track is only X u above path level` | **reroute the street or raise the track. Street grade crossings are never auto-fixed.** |

**Copy the published corridor cell tables** (coaster-pieces skill), add your
`(dx, dz)` offset, and lay streets/stalls/pads off those cells by construction.
They are size-independent and translation-invariant. At runtime,
`manager().corridorCells(name?)` returns the live list.

The ride's OWN access assembly is exempt, matched **by ride name** — which is
why an unnamed `<Coaster>` skips the whole ride-footprint sweep.

If the settle-time resolver moved something for you, that is `corridorShift` /
`corridorExitRelocated` / `corridorLaneTrim` / `corridorPinned` /
`corridorUnresolved` — **all fatal**. A self-heal is a report, not a pass.

---

## `queueDirFlip` / `queueDirUnfixable` (fatal lints)

The lane hangs off the FIXED tail node, so a `queueDir` aimed along the ride's
own axis spears its pad/station. `resolveQueueOrientation` builds, for each
candidate direction, the lane rect (`hx 0.36`, `hz laneLen/2`), the entrance hut
(`hx 0.55`, `hz 0.5`, 0.62 back from the anchor) and the derived tail, then
requires **all corners inside `size/2 − 0.05`** and no overlap with the ride's
own rects. It tries the authored `dir`, then `−dir`, then the two
perpendiculars, remembering the first clean one but preferring one that also
clears the planned exit hut.

- A replacement found → `queueDirFlip`, **fatal**.
- Nothing clean → `queueDirUnfixable`, **fatal**, and the authored direction is
  kept (so the ride ships broken).

Fix: for a coaster at `heading: 0` the station straight runs **+z**, so the lane
must be on the ±x axis. **`queueDir: [1, 0]` with the tail at
`[start.x + 6.0, start.z]`** is the published, verified pairing for every
archetype. `[0, ±1]` always flips.

`queueDir` is also quantised to the ride's four local sides before the resolve
runs, with a `console.info` when your vector is more than ~6° off an axis.

---

## `laneTrim` (non-fatal) — and the formula that is wrong in the old docs

```ts
laneLenOf(capacity) = Math.max(2.2, 1.1 + 0.56 * capacity)
defaultReach        = front + laneLenOf(capacity) + 0.35   // from the ride origin
```

> The **`1.8 + 0.35×capacity + 0.35 = 3.55`** figure in the older rules text is
> WRONG. The code's own lint message says so. Capacity 4 with `front` 1.8 gives
> **5.49**, not 3.55.

If a street node lies within **0.3 u** of the lane axis and at an along-axis
distance in `[front + 1.55, defaultReach + 0.05]`, the nearest such node wins
and the lane is **trimmed** to land on it:

```
laneLen = alongDistance − front − 0.35        // minimum 1.2 u
slots   = max(2, floor((laneLen − 0.45) / 0.28))
```

It never extends. `laneTrim` is reported, `fatal: false` — but it starves queue
slots, so it is still evidence the tail was planned at the wrong distance.
Passing **either** `queue.anchor` or `queue.dir` opts out.

`<Coaster>` never trims (its tail node is authored), so a coaster whose tail is
at the wrong distance gets a `queueDirFlip` instead.

**Two reliable ways to wire a queue** — and one of them is exact:

```tsx
// (a) EXACT: pin the lane. anchor = tail − dir·(laneLenOf(capacity) + 0.35)
const TAIL: [number, number] = [9.6, 4.8];        // a real street node
const DIR:  [number, number] = [0, 1];
const JOIN = Math.max(2.2, 1.1 + 0.56 * 4) + 0.35;   // 3.69
<GhostTrain position={[9.6, -1.2]} rotation={0}
  register={{ name: 'Haunted Hollow', capacity: 4, rideDuration: 11, intensity: 5 }}
  queue={{ anchor: [TAIL[0] - DIR[0] * JOIN, TAIL[1] - DIR[1] * JOIN], dir: DIR }} />

// (b) DERIVED: put a node on the axis and accept a possible trim.
//     Necessary caution: on a COMPACT rig (span ≤ 10 u) `front` is auto-raised
//     to min(6.5, footMaxZ × scale + 1.27), so you cannot compute the reach
//     from the documented `front` at all. Use (a) when it must be exact.
```

---

## `queueTailShared` (fatal lint) — one tail node per ride

Two rides pointed at the same street node. Give each ride its own tail cell;
if the street is short, extend it by a cell or two, or stagger the rides on
opposite sides so their lanes tail onto different nodes.

---

## `exitHutRelocated` / `exitHutUnfixable` (fatal) · `exitSnapped` (non-fatal)

- **`exitHutRelocated`**: the planned exit hut overlapped the (possibly
  re-oriented) lane, the entrance hut, or the boarding pad. The search tries
  axes `exitDir`, `−exitDir`, then both perpendiculars, at distances
  0.6 / 1.2 / 1.8 / 2.4, rejecting anything past `size/2 − 0.6`. Fatal.
  Fix the authored `exit` / `exitDir` so nothing moves. For the coaster
  archetypes that is `exit: [start.x + 2.4, start.z + 2.4]`,
  `exitDir: [1, 0]`.
- **`exitHutUnfixable`**: nothing legal within ±2.4 u — the rig is boxed in.
  Respace the district.
- **`exitSnapped`** (non-fatal): a derived exit was re-picked among the ride's
  four flush pad-edge cells because one was **≥ 1.2 u (one tile) nearer the
  paving** and still dry, in bounds and clear. Derived exits used to land 3.9-4.8 u
  out in the grass. Passing `queue.anchor` opts out.

---

## `bounds` — everything inside ±size/2 − 0.05

```
edge = size/2 − 0.05        // 23.95 on a 48 plot
```

Two things tested: **all four swept corners** of every audited footprint, and
**every derived queue-tail / exit access node**.

> `Sky Swings: its queue tail access node sits at (25.2, -3.6) — OUTSIDE the
> ±24 u plot; guests would walk off the map (re-aim queueDir / move the ride)`

Coaster **track** gets a looser gate: `size/2 + 0.4`. So the binding constraint
on a big archetype is usually the queue tail, not the rails — the archetype A/C
tail already sits at 22.8, which is why they cannot be translated eastward.
Legal lattice nodes on a 48 plot top out at **22.8**.

---

## `terrain`

| detail | condition | fix |
|---|---|---|
| `composition probe unsatisfied: no terrain seed met the rules` | probe violations survived clamping | move what sits on the offending ground; trim the keepDry list |
| `N water bodies below the waterline (the composition demands exactly 1)` | flood fill on a 0.45 grid, 4-neighbour, `heightAt < waterLevel` | your keepDry list severed the body — re-route around it. Zero bodies also fails |
| `entrance apron dips below the waterline` | any apron sample `< wl + 0.1` | apron default rect is `x ±2.2, z size/2−3.6 … size/2−0.4` |
| `entrance apron relief 0.71 > 0.5` | max **absolute** height over the apron `> 0.5` | keep the forecourt flat; do not put a peak near the gate |
| `X is parked on a hill flank (peak contribution 0.9)` | smoothstep peak contribution at the footprint **centre** `> 0.75` | move the footprint off the peak's radius |
| `X stands in the water (ground … below waterline+0.05)` | min of centre + 4 corners of the yawed rect | keepDry that cell and move the rig onto dry land |

---

## `footprints`

- `A overlaps B` — an OBB SAT sweep over every audited rect. Respace: two
  capacity-4 rides on the same street need centre-to-centre **≥ 6 u** (pad
  2.4 × 2.4, lane out +z, exit hut ~1 × 1 at local `[-1.5, 1.35]`).
- `placeAccess residual: …` — the manager's own registration-time search
  (tangent shifts 0, ±0.1 … ±0.8) could not place a hut/lane cleanly. Respace
  the rides; do not fight it with a bigger shift.

---

## `coaster`

| detail | fix |
|---|---|
| `FATAL compiled track — …` | the compile itself failed: checks, closure > 40 % of authored length, or out of bounds. The track renders translucent red and is NOT registered. Re-copy an archetype |
| `design violation [kind] …` | a non-warning `checkCoasterDesign` violation — usually pitchRate or bankLimit. Do not hand-tune; copy an archetype |
| `track reaches ±25.1 u — outside the ±24 u park bounds (+0.4 margin)` | translate the archetype back; remember the closure-synthesized pieces count |
| `spline clearance 0.71 < 0.9 (self-intersection risk)` | the pieces need spreading out |
| `worst lateral 1.34 g at u=0.62 breaches the 1.5 g derail guard margin (must stay under 1.27 g)` | you passed a low `bank`, or a turn is at grade. **Pass no `bank` prop** and put every turn at an apex |
| `[coaster:shortDrop] …` (autofix) | first drop under RCT2's 0.9-u gate — it HALVES excitement, intensity AND nausea. **lift ≥ 1.0 is mandatory.** This is the one kind the gate promotes to fatal by itself |

`coaster:shortLength` is reported and NOT fatal (a short circuit is a
deliberate kiddie-coaster choice).

---

## `sim`

```
secs      = max(60, ceil(2.5 × maxRideDuration + 20))
stallSecs = max(30, maxRideDuration + 15)
dt        = 1/30, sampled every 0.5 s
```

| detail | condition | fix |
|---|---|---|
| `no guest completed a ride cycle in N sim-s` | `riddenTotal < 1` | **`rideDuration ≤ 12`** (a `maxDur > 14` also prints a warning); the gate→queue walk must be short enough — put the hub near the gate |
| `guest N stood still >25 sim-s while "walking" — stuck off the graph?` | displacement ≤ 0.06 u for > 25 s in state `walking`/`leavingPark` | a guest is boxed in by blockers or on an island; fix the graph |
| `X: its queue held for >N sim-s without ever advancing` | the queue never advanced once it formed | the ride is unreachable or never departs |

---

## Not a gate failure, but it costs the most points: a half-empty plot

The gate cannot fail you for building three rides in one corner of a 48 plot,
and the score will. Before you stop, check:

- **≥ 4 registered rides** (6 is good on 48), **≥ 1 stall per 2 rides**;
- the bounding box of everything you built spans **≥ 32 u in BOTH axes**, and
  **no quadrant of the plot is empty**;
- **≥ 3 districts plus the hub**, joined by `<Boulevard>`s — the single cheapest
  way to make a big plot read as designed rather than sparse;
- **≥ 12 trees**, **≥ 6 scenery pieces**;
- rides spanning the intensity bands: gentle (≤ 3), moderate (4-6), intense (≥ 7);
- the flagship coaster from the HIGH-THRILL shelf (E ≥ 6.0 thrill / ≥ 5.0
  family). A best-coaster excitement of 0.6 fails the Thrill axis however tidy
  the park is.

## The escalation order when a park will not go green

1. Fix every **fatal lint** first (`padOnStreet`, `causeway*`,
   `latticeInWater`, `queueDir*`, `exitHut*`, `corridor*`, `queueTailShared`,
   `coaster:shortDrop`) — they are causes, and several of them **delete edges**,
   which manufactures accessibility failures downstream.
2. Then the **graph**: replace any hand-rolled lattice with `buildParkNet` and
   read `NET.warnings`. Islands and diagonals are reported there before mount.
3. Then **geometry**: pads off the lattice via `offPathCell`, tails on real
   nodes at the `laneLenOf` reach (or pinned with `queue.anchor`), scenery
   ≥ 1.2 u off every centreline.
4. Then the **coaster**: re-copy the archetype verbatim rather than tuning it.
5. Re-run and require `failures: []` **and** `warnings: []`.

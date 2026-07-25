# Composing parks — the recipe book

YOU (the agent) are the park designer. The design system provides the
BUILDING BLOCKS (terrain, paths, rides, amenities, the GameManager sim, the
UI windows), the PHYSICS (coaster construction rules + crash physics) and the
VALIDATORS. It does NOT provide "the park" — there is NO park generator;
every brief deserves its own composition.

**The primary composition surface is the React API (`components/Park`,
SETUP.md §5):** declare the whole park as JSX children of ONE `<Park>` —
`<Terrain>` → `<Paths>` → `<Gate>` → `<Coaster>`/`<FlatRide>` → amenities →
`<Scenery>`/`<Placed>` — on one shared canvas. `<Park>` owns the Stage, the
one GameManager, the UI windows and the `validatePark` run; the wrappers
execute EXACTLY the recipes below, so everything in this book (climate
first, the build order, themed lands, rideability, the legality lint, the
acceptance gate) governs the JSX composition too — the wrapper props ARE
these recipes' parameters.

**THE WORKED EXAMPLE IS `<DistrictPark>`** — `components/Park/Park.previews.tsx`,
the FIRST Park preview: a size-48 park whose streets are fused by
`buildParkNet` from a `<FountainPlaza>` + `<Bazaar>` + `<Boulevard>` plus a
13-node spine, with a PIECES-MODE §4.0-A flagship and every ride pad on a cell
interior. `validatePark ok: true`, 0 failures. **Read it before you compose.**
(Round-7 honesty note: until this wave the book pointed at `DemoPark`, a
size-16 park with a hand-written lattice and a points-mode coaster — we
documented one discipline and demonstrated the opposite, and every park in
rounds 6-7 copied the example rather than the prose. `DemoPark` is still there
as the COMPACT small-plot variant; it is NOT the layout to copy.) The
ParkBuilder preview (`components/ParkBuilder/ParkBuilder.previews.tsx`,
`buildExamplePark`) is the same discipline written imperatively — the
lower-level path for layouts the wrappers don't express. Study them, don't
clone them.

**THE ANTI-TEMPLATE CLAUSE.** If your park could pass for the worked example
with different colours, change the street skeleton, the land line-up, the
ride mix and the water story until it can't. Two different briefs must
produce two structurally different parks. What is NOT negotiable: the
pre-flight checklist (§0), the composition rules (§2), the legality lint
(§5) and `validatePark` (§6) — a park that fails them is not finished,
whatever it looks like.

## 0. PRE-FLIGHT CHECKLIST (do this arithmetic before finishing)

You cannot run code or read the console — every check here is STATIC: do it
on paper BEFORE you call the park done. **FATAL-WARNINGS POLICY: any
`validatePark` failure, guard-probe rejection, grid warning, closure warning
or `placeAccess` warning is FATAL — re-lay the layout on ANY of them. Never
ship over a warning, never rationalise one.**

1. **Bounds** — sum piece lengths and placements on paper USING THE RUN-LENGTH
   TABLE (§4): every coaster piece, pad, hut and queue lane inside ±size/2
   (the DEFAULT plot is now 48 → x,z ∈ [-24, 24]; a compact size-16 park →
   [-8, 8]). Lifts/drops run FAR longer than they look (≈ 1.6 + 3.9×height —
   round-2 parks underestimated ~1.5× and broke). On the default plot bounds
   are rarely the binding constraint — SPREAD is (see §0.3).
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
   unchanged at any size). But the default plot is EXPANSIVE (48 — nine
   16-parks of area): don't huddle at the minimum pitch around one plaza.
   Lay out DISTRICTS (2-4 themed lands + the hub, §3) linked by long
   approach boulevards, give every ride breathing room, and put the coaster
   out in its own meadow. **4+ rides are expected on a default plot** —
   a 3-ride cluster in one corner of 48 units reads abandoned, not cosy.

   **DISTRICT OCCUPANCY — the static check (round-7).** Draw the four
   quadrants of your plot (on 48: x ≶ 0 × z ≶ 0, each 24 × 24) and list what
   each one contains. Rules: **at least 3 of the 4 quadrants hold something
   built** (a district, the coaster ring, the water body's shore treatment or
   a real planted grove — not one lonely bench), **no quadrant holds more
   than half your rides**, and **district centres are ≥ 20 u apart**. A park
   that fails this reads as a small park on a big empty field, whatever its
   validator score. Also mind the SIM: the nearest ride queue must be
   reachable from the gate well inside the 60 sim-s smoke run, so do not
   exile every attraction to the far corner (`<DistrictPark>` keeps a gentle
   flat ~7 u off the gate street for exactly this reason).
4. **Queue tail** — the tail lands ON (or near) a street node, and the reach
   is **`front + laneLenOf(capacity) + 0.35`** where
   **`laneLenOf(c) = max(2.2, 1.1 + 0.56·c)`** and `front` = 1.8 by default
   (`RideLayout.front`, auto-raised to `padFront + 1.27` on a compact rig, cap
   6.5). **THE CODE IS TRUTH** — `ParkBuilder/placement.ts:79`. The old
   documented `1.8 + 0.35·c + 0.35` was WRONG and under-reported the reach by
   up to 3 u, which is why round-7 planned 6.0-u tails for capacity-10 rides
   and collected a `laneTrim` warning on every one of them.

   | capacity | `laneLenOf` | tail reach at `front` 1.8 | slots |
   |---|---|---|---|
   | 4 | 3.34 | **5.49** | 10 |
   | 6 | 4.46 | 6.61 | 14 |
   | 8 | 5.58 | 7.73 | 18 |
   | 10 | 6.70 | **8.85** | 22 |

   **BUT THE REACH IS NOT COMPUTABLE FROM YOUR PROPS.** For any COMPACT rig
   (built span ≤ 10 u — every catalog flat ride) the chassis auto-raises
   `front` to `min(6.5, footMaxZ·scale + 1.27)` so the entrance hut can never
   sink into the pad. `footMaxZ` is a property of the BUILT MESH, which you
   cannot read while authoring. The measured values are 3.13 (Carousel), 3.50
   (TwistRide) — not 1.8. **So do not compute the tail: PIN THE HEAD.**

   ```tsx
   // tail = the street node you want the queue to open onto
   // anchor = tail − dir·(laneLenOf(capacity) + 0.35)
   // capacity 4 → laneLenOf = 3.34 → join = 3.69
   <Teacups position={[7.2, 7.2]} rotation={-Math.PI / 2}
            register={{ name: 'Willow Teacups', capacity: 4, rideDuration: 8 }}
            queue={{ anchor: [3.69, 7.2], dir: [-1, 0] }} />   // tail (0, 7.2)
   ```

   `anchor` is the queue **HEAD** (the hut end), NEVER the tail — round-7's
   park passed the tail node as `anchor` on five rides, which ran every lane
   backwards down the street it was supposed to meet. That mistake now raises
   a §0-FATAL `queueAnchorIsHead` lint printing the head coordinate you
   should have used. Keep the pad ≥ `front + 0.62 + hutHalf` from the anchor
   (a 6.0-7.2 u pad-to-node gap works for every capacity-4 catalog flat), and
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
5. **rideDuration ≤ 12** unless you have a reason. The acceptance sim runs
   60 sim-s and needs ONE FULL cycle: ~20 s gate→queue walk + load +
   rideDuration + unload ≤ 60 — durations of 16-26 s FAIL the sim check.
6. **Path level hugs the MEDIAN ground under your nodes**, never the max —
   check node ground heights FIRST; a node sitting on a 2-3 u bulge means
   MOVE the node or give that one spur a `nodeY` ramp. Never hoist the whole
   street onto berms (the "causeway" failure). Since round 7 `<Paths>` derives
   the level this way ITSELF and the thresholds are mechanical:

   | condition | what happens |
   |---|---|
   | node-ground spread ≤ 0.35, or you passed `nodeY`/`[x, z, elevation]` triples | level = **max** ground + 0.03 (the legacy behaviour, bit-identical) |
   | spread > 0.35 | level = **median** + 0.03 and every outlier node gets an AUTO `nodeY` ramp — non-fatal `pathLevelMedian` lint listing them |
   | level > median + 0.8 | §0-FATAL `causeway` lint |
   | any span > 1.0 u over the ground beneath it | §0-FATAL `causeway` lint |
   | any span > **2.0 u** up, or any span whose ground dips below the waterline | the EDGE IS NOT BUILT — §0-FATAL `causewayRefused` / `latticeInWater` |

   An auto-ramp is not a licence to keep a bad node: it is un-audited against
   the ramp-grade rules (max 0.5 per 1.2 tile, straight runs), so author the
   ramp as an `[x, z, elevation]` triple or move the node. **And read the
   REFUSED cases as one causal chain:** a refused span leaves a HOLE in the
   street graph, so the next thing you see is `accessibility` /
   `blockers`-unreachable failures for everything behind that hole. Those are
   not a separate bug — fix the refused span and they go with it.
7. **Gate ON the front-edge apron** — within ~1 unit of the park edge,
   facing OUTWARD. A gate 3+ units inside the park is wrong.
8. **Imports match the canonical block below.** NEVER mount a
   `build<Name>Scene` preview builder inside a park (it ships its own
   staging — the floating-oval failure); use the component
   (`<LogFlume pieces={...}/>`) or its plain `build<Name>` builder.
9. **Neon scale 0.4-0.7** for park signage — the default auto-scale is
   giant. The backboard hugs the text bounds automatically — never build a
   placard/panel behind a sign.
10. **Counts** — ≥ 12 trees (auto-dressing's forest/beach/meadow planting
    counts; add your own near the streets), ≥ 6 scenery pieces, ≥ 1 stall
    per 2 rides, EXACTLY 1 water body covering ≤ ~12% of the park area,
    gentle normal terrain (no moonscape, no billiard table). Mesh budget
    scales with plot AREA: ~2500 per 16² of land (default 48 → ~22 500) —
    exceeding it is a validator WARNING (§6), and warnings are FATAL (§0).
11. **TRACK CORRIDOR (round-4 gate)** — walk your compiled coaster polyline
    on paper and list every cell within **0.8 u** of it (a 1.6-u-wide
    corridor): NO street edge, stall, or another ride's pad/hut/lane may sit
    in that corridor unless the track is **≥ 2.2 u above** the path/obstacle
    level there. Flying OVER a street on a high leg is the RCT2 look and
    passes; a grade crossing or a roof-skim FAILs `validatePark` with a
    `corridor` failure naming the offender. The ride's OWN station/pad/lane
    is exempt.
12. **THRILL target for the park's declared type (§4.0/§4.1)** — the flagship
    coaster MUST come from the HIGH-THRILL shelf (§4.0: A E 6.12 / B E 5.27 /
    C E 6.31). The small legacy rect/L-wrap shapes rate 0.6-1.1 and are
    FILLERS only. A legal circuit is not automatically a RIDE.
    Decide THRILL vs FAMILY, then aim the
    flagship coaster at the §4.1 numbers (excitement ≥ 6.0 / ≥ 5.0, peak
    +vertical ≥ 2.5 g / ≥ 1.8 g, highest drop ≥ 2.0 u / ≥ 1.2 u, lateral
    always < 1.27 g, some airtime, nausea < 8.0) and CHECK it with
    `rateCoaster` — never guess. Also span the intensity bands: a gentle
    (≤ 3), a moderate (4-6) and an intense (≥ 7) ride alongside it.

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
    **Ask, don't guess:**

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
15. **USE THE SET-PIECES — `buildParkNet` is MANDATORY for any park with ≥ 2
    zones (round-7 gate).** A HAND-ROLLED UNIFORM GRID IS A REJECTED LAYOUT.
    Round 7 had `buildParkNet`, `<FountainPlaza>`, `<Bazaar>`, `<Boulevard>`
    and `rateCoaster` live in the artifact and still hand-wrote a 6×6 grid of
    nodes — tools that prevent defects are worth nothing if the composition
    doesn't reach for them. Required, not optional:
    - **plaza hub → `<FountainPlaza>`**, **shop cluster → `<Bazaar>`**,
      **long avenue between districts → `<Boulevard>`**;
    - fuse every street with **`buildParkNet({ nodes, edges, pieces, keepDry })`**
      and feed its `nodes` / `edges` / `plazas` / `bins` / `keepDry` straight
      into `<Terrain>` and `<Paths>` (see §3.1);
    - your own hand-authored nodes are for SPINES and SPURS between pieces —
      a dozen nodes, not a lattice.
    Districts must READ as separate places: **≥ 20 u between district centres
    on a size-48 plot** (§0.3).
16. **THE §0 HEADER IN YOUR FILE MUST CONTAIN A PASTED `rateCoaster` RESULT
    LINE for the flagship** — excitement / intensity / nausea / highest drop /
    maxLatG / airtime, copied from the measured output, not retyped from this
    book and not predicted. If you cannot produce that line, you have not
    measured the ride and the park is not finished (§4.1). Ride and shop names
    must be THEMED too: a park shipping "Burger Shop", "Soda Stand" and
    "Balloon Stand" reads unfinished — `register={{ name: 'Cinder Soda' }}`.
17. **RE-READ THE COMPOSED WATER AFTER COMPOSITION.** The §1 seed table lists
    **PRE-GUARD** coordinates: `parkComposition`'s guards RE-PICK the water
    body whenever your `keepDry` list overlaps the listed disc, and the new
    lake can land anywhere. Round 7 planned around a river at (18.1, −5.9)
    while the lake actually settled at ~(9, 12…15), then bridged it on stilts
    and planted a tree in it. Either probe it headlessly WITH your guards
    (`parkComposition(THREE, seed, 48, climate, { keepDry, coasterPts })` →
    `comp.waterCentre` / `comp.basins`, waterline ≈ 0.74·radius) or query it
    at runtime from a `usePark()` child:

    ```tsx
    const park = usePark();
    park.terrain?.water        // { x, z, r } — the ACTUAL body, post-guard
    park.isDry([9, 12])        // false — that "meadow" is the lake now
    park.isDryCell([9, 12])    // the whole 1.2-u cell, not just its centre
    ```

    A lattice span over water is REFUSED (§0.6) and a prop planted in open
    water is REFUSED (§5) — both §0-FATAL.
18. **`keepDry` covers the WHOLE SPINE, not just the nodes.** List every
    street node AND every edge midpoint, every ride pad / queue-lane cell /
    hut cell, every stall and every scenery cell. The runtime AUTO-keepDry
    pass (§2) will re-clamp under the registered footprints and the planted
    scenery, but a layout that NEEDED the self-heal was mis-planned.

### Footprint table — ride spacing you can compute on paper

Each registered ride occupies roughly (local frame, +z = queue face):

| part | extent | source |
|---|---|---|
| pad | ~2.4 × 2.4 around the position (the BODY blocker is the built mesh's own box) | `registerComposedRide` |
| queue lane | out the queue face: **`laneLenOf(capacity) = max(2.2, 1.1 + 0.56·capacity)`**, starting at `front` and + 0.35 to its street node | `placement.ts:79` |
| `front` | 1.8 by default, but auto-raised to `min(6.5, footMaxZ·scale + 1.27)` for any rig spanning ≤ 10 u — i.e. NOT knowable from props (§0.4) | `configurableRide.tsx` |
| exit hut | ~1×1 at local `[-1.5, 1.35]`, auto-flushed to the −x pad edge and re-picked toward the nearest street node (`exitSnapped`) | `registerComposedRide` |
| stall | solid body hx 0.6 × hz 0.42 on the anchor; audited apron hz 1.01; guest attach 0.72 out the serving front | `GameManager/registry.ts:210` |

Worked example, two capacity-4 rides on the same street: `laneLenOf(4)` =
3.34, so the tail node sits `front + 3.69` out (5.49 with the 1.8 default,
6.82 for a Carousel whose real `front` is 3.13); pad half-width 1.2 plus the
exit hut reaching to local x ≈ −2.0. Two such footprints only clear each
other at centre-to-centre pitch **≥ 6 units** (5 lattice steps of 1.2) —
closer and the SAT sweep collides. Stagger rides on opposite street sides to
pack tighter, and keep every pad ≥ 1.8 u off the lattice itself (§0.14).

### Canonical imports (copy exactly — wrong sources broke round-1 parks)

```tsx
import { Park, GameManager, Terrain, Paths, Gate, Coaster, TrackRide,
         FlatRide, Stall, Restroom, Fountain, Neon, DanceFloorR, Scenery,
         Lights, Placed, usePark,
         offPathCell, pathClearance,          // the §0.14 placement API
         Station, Straight, Lift, Drop, Hill, TurnL, TurnR, HelixL, HelixR,
         Corkscrew, SBend } from './components/Park';
// SET-PIECES — mandatory for any park with ≥ 2 zones (§0.15, §3.1)
import { buildParkNet } from './components/SetPieceKit';
import { FountainPlaza, fountainPlazaPlan } from './components/FountainPlaza';
import { Bazaar, bazaarPlan } from './components/Bazaar';
import { Boulevard, boulevardPlan } from './components/Boulevard';
import { FerrisWheel } from './components/FerrisWheel'; // NEVER from './Park'
import { BurgerShop } from './components/BurgerShop';
import { Torch } from './components/Torch';
import { Fence } from './components/Fence';   // park fencing / queue railings
import { LogFlume } from './components/LogFlume';
import { RiverRapids } from './components/RiverRapids';
import { Monorail } from './components/Monorail';
import { Bobsleigh } from './components/Bobsleigh';
import { Stage, box, cyl, ball, mat, mergedBoxes } from './components/Stage';
// utilities — these sources are EXACT (round-2 broke on a wrong one):
import { rideColourPreset, RCT2_COLOURS, shade } from './components/ColorKit'; // NEVER from SplineRideKit
import { compileTrackPieces } from './components/SplineRideKit'; // the piece compiler (piece JSX is from Park)
import { buildScenery, SCENERY_NAMES } from './components/SceneryPack';
import { tree, rock } from './components/Kit';
```

Only the Park wrappers + track-piece JSX come from `./components/Park`;
every catalog ride/stall/prop imports from its OWN folder
(`./components/<Name>`). `rideColourPreset` lives in ColorKit ONLY —
SplineRideKit consumes it, it does not export it.

### Catalog inventory — if it exists, USE it (reinventing is a defect)

A round-2 park hand-built a "carousel", "teacups" and trees out of raw
primitives — black blobs and crashes. Custom one-off ride/tree/prop builders
are a DEFECT, not creativity: **if it's in the catalog, use the component.**
What exists (each in `./components/<Name>`, composable, `register`-ready):

- **Rides**: Carousel, Teacups, FerrisWheel, DropTower, SwingRide,
  PirateShip, Enterprise, TopSpin, TwistRide, SpaceRings, MotionSimulator,
  BumperCars, HauntedMansion, GhostTrain, FlyingSaucers, LaunchedFreefall,
  SwingingInverterShip, ObservationTower, GoKarts, Helicycles, PaddleBoats,
  Chairlift, Monorail, Bobsleigh, LogFlume, RiverRapids — plus `<Coaster>` /
  `<TrackRide>` (from `./components/Park`) for anything track-shaped, and
  `<FlatRide>` for a genuinely new flat ride with a documented builder.

  **THE UNDER-USED HALF OF THE SHELF (round-7).** Every generated park so far
  drew from the same six spinners. These are `register`-ready components with
  their own catalog defaults — a park with 4+ rides should reach past the
  spinners for at least one of them. `pieces` takes the same
  `compileTrackPieces` vocabulary as `<Coaster>`:

  | component | mode | catalog defaults (name / cap / dur / int / price) | siting |
  |---|---|---|---|
  | `<Monorail pieces>` | piece-composed, `profile: 'monorail'`; vertical pieces are STRIPPED | Monorail / 6 / 12 / 1 / 2 | the best plot-spanning device there is: a long circuit that RIDES OVER the districts. It registers ONE station, so put that station on the hub street |
  | `<Chairlift pieces riders>` | piece-composed, `profile: 'monorail'` on a flattened profile | Chairlift / 6 / 10 / 2 / 3 | ONE station; the out-and-back cable is internal geometry, not two districts. Reads best up a hill flank |
  | `<LogFlume pieces>` | piece-composed, `profile: 'flume'` | Log Flume / 4 / 12 / 5 / 4 | **builds its OWN water** (the trough ribbon). Wants DRY FLAT LAND — the composed lake is thematic adjacency only |
  | `<RiverRapids pieces>` | piece-composed, `profile: 'rapids'` | River Rapids / 6 / 12 / 5 / 4 | **builds its OWN channel + splash pond.** Dry flat land |
  | `<PaddleBoats>` | flat rig | Paddle Boats / 4 / 12 / 1 / 2 | **builds its OWN pond** (sandy bank r 2.5→2.6, bed r 2.42). Put it on DRY GROUND — on the real lake it trips the wet-pad guard |
  | `<Bobsleigh pieces>` | piece-composed, `profile: 'bobsled'`, bank 0.55 | Bobsleigh / 4 / 10 / 6 / 4 | alpine/frontier hill flank; a real tracked circuit (corridor + crash checks apply) |
  | `<GoKarts pieces riders>` | piece-composed, `profile: 'gokart'`; vertical pieces STRIPPED | Go-Karts / 4 / 12 / 5 / 4 | FLAT ground only — it is a ground-level track |
  | `<GhostTrain riders>` | flat rig (dark ride) | Ghost Train / 6 / 11 / 5 / 4 | a building: fairground or main street |
  | `<MotionSimulator>` | flat rig | Motion Simulator / 4 / 7 / 6 / 3 | small footprint, fits a plaza edge |
  | `<ObservationTower riders>` | flat rig | Observation Tower / 8 / 10 / 1 / 2 | a landmark — put it where the skyline reads |
  | `<Helicycles riders>` | flat rig | Helicycles / 2 / 8 / 2 / 2 | kiddie corner; capacity 2, so pair it with a real gentle ride |

  Any `pieces`-mode ride registers a CIRCUIT with `validatePark`, so it is
  subject to the 1.6-u corridor sweep and the crash replay exactly like a
  coaster (§0.11) — budget its footprint with the run-length table.
- **Stalls**: BurgerShop, HotDogStand, SodaStand, CottonCandyStand,
  BalloonStand — all `composableStall` components taking
  `register={{ name, price, value }}`. **Vary them:** three shops from the
  same two components is a smell; a park with ≥ 4 rides wants ≥ 3 DIFFERENT
  shop kinds (food + drink + a treat), each with a themed name, plus a
  `<Bazaar>` when they cluster. The generic `<Stall kind>` wrapper is a
  DIFFERENT contract: it only knows `kind="balloon"` and it takes **`sell`**,
  not `register` (`<Stall kind="balloon" sell={{ name: 'Cinder Balloons' }}/>`).
  Note also that `components/Restroom` exports a BUILDER + a preview
  composable — the registering component is the Park wrapper `<Restroom>`.
- **Amenities/dressing** (Park wrappers): Restroom, Fountain, Torch, Neon,
  DanceFloorR, Scenery, Lights, Placed — plus **Fence**
  (`./components/Fence`): `<Fence from to style="wood"|"metal"|"hedge"/>` or
  `<Fence points/>` for a polygon. World xz, no `position`; every run is a
  guest BLOCKER, so leave a GATEWAY where a street crosses a boundary.
- **SceneryPack names** (`<Scenery name>` / `buildScenery(t, name)`):
  marbleStatue, birdbath, picnicTable, planterBox, topiarySpiral,
  topiaryElephant, signpost, tvMonitorPost, parkClock, flagpole, ironArchway,
  brickWall, picketFence, lionStatue, cactusCluster, fallenLog,
  mushroomCluster, wishingWell, gazebo, hotAirBalloon.
- **Kit props**: `tree(t, { shape: 'round'|'pine'|'palm'|'willow' })` and
  `rock(t, scale)` (+ RockCluster) — the ONLY trees/rocks a park plants.

## 1. Pick the park's CLIMATE and composition first

Climate is one word that re-seeds everything downstream — terrain palette,
water story, sand coverage, scenery species and land names:

| climate | water story | ground | scenery | zone flavour |
|---|---|---|---|---|
| `temperate` | one big lake (or lazy river), beach flank | green lawns | rounds + pines, palms at the shore | Main Street / Lakeside Boardwalk / Alpine Frontier / Fairground |
| `desert` | ONE small oasis | sand almost everywhere, dune patches on the flats | palms AT the water only, cactus clusters + rock out on the flats | Oasis Boardwalk / Mesa Frontier / Dune Fairground |
| `alpine` | a small dark tarn, NO beach | darker grass, snow-capped summits, extra rock outcrops | pines everywhere | Tarn Promenade / Summit Frontier / Meadow Fairground |
| `coastal` | the biggest water — a lagoon chain or bay hugging one flank, a WIDE palm beach | lush green | palms + rounds | Boardwalk Bay / Headland Frontier / Seaside Fairground |

`parkComposition(t, seed, size, climate?, guards?)` composes an
RCT2-scenario-style landform under these rules and PROBES terrain-noise
seeds until they hold (climate hashed from the seed when omitted —
`climateOf(seed)`). `guards` is YOUR layout: pass `keepDry` (every world
cell you will pave or place on — street nodes + edge midpoints, pads, huts,
lanes) and `coasterPts` (planned control points `[x, yAboveRef, z]`) so the
probe rejects any terrain seed that would sink, drown or bulge under what
you are about to build, and hill peaks are pre-capped clear of your track:

- **Mostly gentle, buildable terrain** — low amplitude (~0.38), broad scale,
  and a FIRM SHORE (`buildTerrain firmShore: true`): outside the authored
  basins the ground never dips to the water table, so raw noise can never
  pool stray puddles. Relief is AUTHORED, never uniform noise.
- **Seeded MOUNTAIN RANGES, an archetype per seed** (`comp.mountainStyle`):
  `'alpine'` one dominant 4-6-peak ridge, `'rolling'` 2-4 low broad hill
  ranges, `'sentinel'` mostly flat with one steep landmark peak, `'twin'`
  2-3 medium ranges — placed on seeded edge/corner slots, never over the
  water and never burying the forecourt (peaks are capped under the apron,
  under every `keepDry` cell and — `capPeakForCoaster` — under a planned
  track profile). Drama scales with the plot: a 48-park earns real ranges, a
  16-park gets proportional hills.
- **ONE dominant water body whose CHARACTER varies per seed**
  (`comp.waterStyle`): a big `'central'` lake, a `'corner'` lagoon hugging a
  beach, a winding `'river'` inlet chain or the classic NE `'flank'` lake —
  flood-filled and enforced: exactly one connected below-waterline region,
  never a scatter of ponds. Candidates are probed in seeded preference order
  and the first whose rules fully hold under YOUR guards wins, so a guarded
  layout is never composed under water.
- **Themed terrain SECTIONS** — `comp.landZones` (`{ kind, center, radius }`:
  sand always adjoining the water, forest discs, one mountain zone per
  range, a representative meadow) + the `comp.zoneAt(x, z)` classifier.
  `tintTerrainForClimate(..., comp)` paints them (cream/gold sand, saturated
  meadow, darker forest floor, grey-brown rock above `comp.treeline`, snow
  above that on alpine) and `dressTerrain(t, comp, heightAt, { obstacles })`
  plants them — forest tree clusters, mountain outcrops + scree, beach
  dunes/palms, meadow loners — deterministically, clear of `keepDry` cells,
  the coaster envelope and your obstacle discs. `<Terrain>` runs BOTH
  automatically; imperative parks call them in step §2.1.
- **A sand/beach flank** adjoining the water on the boardwalk side (climate
  scaled: coastal wide, desert everywhere, alpine none).
- **A FLAT front apron** (relief suppressed ~3 cells deep) with the park gate
  CENTRED on it and the main street aimed straight at the plaza hub.
- **Guards are POST-ENFORCED** — when no probed seed fully satisfies the
  rules, the composition CLAMPS the terrain instead of merely warning:
  blend-radius discs raise every wet guarded cell dry (`clampPeaks`) and
  shave bulges flat under guarded footprints/coaster footings
  (`clampBasins`). `comp.report.violations` reflects the POST-CLAMP ground
  (empty = clean); `report.clampedCells` says how much clamping was needed.
- **WATER-FRACTION GUARD (round-5)** — guard clamping is never allowed to
  starve the ONE water body below the climate ideal (≥ ~3% of the plot /
  the climate's minimum): wet guarded cells now raise on TIGHT steep-bank
  discs (the berm costs less water than the old wide blend), and when
  filled-back severed lobes still leave the body too small, the composition
  GROWS it back with probed edge basins on its open side — still exactly
  one body, never under your guarded cells, the coaster or the forecourt.
- **AUTO-keepDry (round-5) — your `keepDry` list is a HINT, not a
  requirement.** After every `<Park>` child has mounted, the runtime
  collects EVERY registered footprint from the GameManager — pads, huts,
  queue lanes, stalls, including the derived/trimmed/flipped/auto-shifted
  rigs no static plan could predict — plus the as-built coaster polylines,
  and re-runs the guard clamp over them (`reclampTerrain`): wet samples are
  raised into dry banks, bulges shaved, the one-body and water-fraction
  rules re-enforced, and ground can never bury built rails. `<Terrain>`
  then rebuilds the mesh/colours/heightAt in place before `validatePark`
  reads anything. Still pass an honest `keepDry`: the runtime self-heal
  reads as landscaped berms, but a layout that NEEDED it was mis-planned
  (the `[Park] AUTO-keepDry` console line tells you it fired).

### Seed table — PIN a seed, place around the KNOWN lake (round-5)

> **ROUND-7 WARNING — THESE COORDINATES ARE PRE-GUARD.** The table below was
> composed UNGUARDED. The probe picks the first water candidate that keeps
> YOUR `keepDry` cells dry, so the moment your layout overlaps the listed
> disc the composition RE-PICKS and the lake moves somewhere else entirely.
> Measured example: seed 7 lists a river at (18.1, −5.9) wl-r 4.3; with a
> keepDry list covering an east-apron coaster queue the water re-picks to
> **centre (14.7, 14.7)** with basins (9.6, 9.6) wl-r 4.5 + (10.1, 13.3)
> wl-r 6.1 — the OPPOSITE CORNER. Round 7 laid its lattice and a tree into
> exactly that re-picked lake. Either keep your layout off the listed disc
> (then the listed candidate wins and the table holds), or re-probe WITH your
> guards and place against the result (§0.17):
>
> ```ts
> const comp = parkComposition(THREE, seed, 48, climate, { keepDry, coasterPts });
> comp.waterCentre; comp.basins;   // waterline radius ≈ 0.74 · basin.radius
> ```
>
> At runtime the same truth is on the Park context: `usePark().terrain.water`,
> `park.isDry(cell)`, `park.isDryCell(cell)`.

Composed headlessly from `parkComposition(THREE, seed, 48, climate)` (the
DEFAULT size 48, unguarded — recomputed 2026-07 for the expansive-plot
rework; all 8 seeds compose with zero violations). PIN one of these and lay
your park around the listed water disc instead of guessing where the lake
will land. IMPORTANT: the probe picks the first water candidate that keeps
YOUR `keepDry` cells dry — keep your layout OFF the listed water disc and
the same candidate wins; pave over it and the composition re-picks (a
different lake spot than listed). `wl-r` is the approximate waterline
radius around the listed centre. Note the DISTRICT-sized numbers: lakes are
now 8-16 u across and every seed offers big flat build fields — most seeds
list TWO distinct meadows (size ≥ 32 plots compose multiple flat zones);
spread your lands across them.

| seed × climate | water | mountains | flat build zones | put the coaster |
|---|---|---|---|---|
| 1 temperate | lake ~(3.7, −3.3) wl-r 8.1, 12% | alpine ×2 ~(−12.4, −15.3) + (2.1, −16.2) | ~(−20.5, 18.5) r 13.8 + ~(17.0, −18.6) r 8.3 | back-east meadow |
| 7 temperate | river ~(18.1, −5.9) wl-r 4.3, 10% | twin ×3 ~(−17.4, −3.3) + (−17.7, 12.0) + (−14.1, −15.4) | ~(9.3, 19.2) r 12.1 + ~(−9.1, 20.3) r 5.5 | centre-west |
| 31 temperate | lake ~(−14.7, −14.7) wl-r 7.3, 9% | alpine ×2 ~(−15.8, 9.7) + (14.9, 8.6) | ~(17.0, −16.3) r 6.9 + ~(−4.7, −19.8) r 6.0 | back-east |
| 2 coastal | river ~(−12.7, −5.9) wl-r 4.3, 11% | rolling ×3 ~(16.4, −3.6) + (16.3, 9.5) + (−0.9, −16.4) | ~(−8.7, 15.7) r 10.3 + ~(14.2, −15.7) r 4.4 | front-west field |
| 11 coastal | river ~(−13.4, −5.9) wl-r 4.3, 10% | sentinel ×3 ~(0.1, −17.8) + (15.3, −13.5) + (15.0, 10.4) | ~(−14.1, 20.5) r 7.5 + ~(−18.9, −18.7) r 5.1 | front-west field |
| 3 desert | lake ~(17.3, −17.3) wl-r 4.8, 4% | twin ×4 (back + west + east flanks) | ~(−5.6, −5.7) r 5.3 + ~(−17.6, −5.8) r 5.3 | centre/west flats |
| 5 alpine | tarn ~(14.0, 12.1) wl-r 4.6, 4% | alpine ×2 ~(−12.0, −16.0) + (12.9, −14.3) | ~(−16.1, 19.4) r 19.3 + ~(8.0, 21.0) r 5.0 | huge front-west meadow |
| 42 alpine | tarn ~(3.6, 1.4) wl-r 5.7, 5% | rolling ×4 (all four flanks) | ~(−1.6, 16.6) r 5.3 | front, wrap a flank |

(Compact size-16 parks keep composing EXACTLY as before — bit-identical to
the old table, e.g. seed 1 temperate still puts its lake at ~(1.2, −1.1) —
so existing 16-parks are untouched; re-derive with the same headless probe
if you pin a non-default size.)

Build the real terrain from the winning seed (`buildTerrain` with the
composed `peaks + clampPeaks` / `basins + clampBasins` — `<Terrain>` does
this for you), add ONE `buildWater` sheet at the water level, and treat
`terrain.heightAt(x, z)` as the single source of ground truth for every
later placement. If you compose terrain manually instead, you still owe
the same rules — validatePark flood-fills your heightfield.

## 2. The build order (always the same, whatever the layout)

**Step 0 — PLAN THE DISTRICTS AS SET-PIECES (§3.1) and fuse them with
`buildParkNet` BEFORE you write any JSX.** The plans are pure, so the street
graph, the paving rects, the bins and the keepDry list all exist as data
before the first component mounts — which is why the pieces, the terrain
guard and the queue tails cannot disagree. On a park with ≥ 2 zones this step
is mandatory (§0.15).

1. **Terrain + climate** — `parkComposition` (with your `guards`) →
   `buildTerrain` (peaks + clampPeaks, basins + clampBasins, `firmShore:
   true`) → `buildWater` (§1). Bias the vertex palette with
   `tintTerrainForClimate(t, terrain.mesh, climate, comp.basins, comp)` — it
   recolours the stock shoreline-sand band toward the climate grass, keeps a
   real beach ring around the composed basins, snows above the alpine
   snowline, and (given `comp`) paints the terrain SECTIONS: gold sand,
   saturated meadow, darker forest floor, bare rock above `comp.treeline`.
   Then `dressTerrain(t, comp, terrain.heightAt, { obstacles })` — the
   sections' forest clusters, mountain outcrops + scree and beach
   dunes/palms plant themselves (deterministic, budget-aware; feed its
   returned `obstacles` into your scenery sampler so later planting never
   overlaps). `<Terrain>` does ALL of this automatically in JSX parks.
2. **Park entrance** — `buildParkEntrance(t)` at the gate node CENTRED on
   the flat apron and ON the front edge (within ~1 u of it), +z (outside)
   facing OUT of the park — never several units inside. Add the group AND
   `registerParkEntrance` it with the GameManager later — once registered it
   is the SOLE spawn/despawn point. In JSX, a bare `<Gate/>` defaults to
   exactly this: the lattice cell hugging the front edge — z =
   `1.2·round((size/2 − 0.8)/1.2)`, i.e. **z 22.8 on the default 48** (7.2
   on a compact 16, 46.8 on 96) — facing out; put a street node under that
   cell.
3. **Path skeleton** — YOUR layout decision (spine, fan, figure-eight,
   double loop, hub-and-spoke…), but always ON the RCT2 tile lattice:
   nodes at multiples of 1.2, edges N/S/E/W only. `snapNetToGrid(net, 1.2)`
   as the safety pass, render with `buildPathNetwork(t, net, { width: 1.1,
   y: pathY, groundAt, grid: true, plazas: [[cx, cz, w, d]] })` — a
   composed park must produce ZERO grid warnings (warnings are FATAL, §0).
   Check node ground heights FIRST, then pick ONE path level hugging the
   MEDIAN ground under your nodes (+0.03) — a node on a bulge gets moved or
   its own elevation ramp, never a street-long berm. **Elevation API**: give
   an elevated/ramped node its height as an `[x, z, elevation]` TRIPLE
   (preferred — the height travels with the node through `snapNetToGrid`
   merging; a parallel `nodeY` array still works). Everything follows
   automatically: the sloped edges render as flat inclined RIBBONS at
   constant grade (kerbs/seams on the slope, knuckle pads bevelled flush —
   never a solid wedge), elevated spans/pads grow RCT2 wooden scaffolds,
   guests walk UP the ramps (`park.paths.walkYAt` feeds the GameManager),
   and `<Stall>`/`<Restroom>` deck-match a nearby elevated node (within
   1.75 u; explicit `elevation` prop overrides) onto a scaffold + plank
   deck. Ramp rules (console lint — warnings are FATAL, §0): max one 0.5
   step per 1.2 tile (grade ≈ 0.42), sloped runs go STRAIGHT (no bends or
   junctions mid-slope), and every elevated node needs a walkable-grade
   ramp route down to the ground network (an unreachable deck warns).
   Close gaps with `bermNetToGround(t, g, net, pathY, groundAt, nodeY?)`
   (earth berms under LOW spans + footings under nodes; a grounded ramp
   gets an inclined embankment UNDER its ribbon — anything lifted > 0.35
   above the terrain is skipped because `buildPathNetwork`, given
   `groundAt`, plants RCT2 wooden support scaffolds under those spans/pads
   itself) and `plinthUnder` beneath off-path bases (above the same 0.35
   lift it plants a wooden scaffold tower + plank deck instead of an earth
   plinth, and `groundRideAccess` does the same for huts/lanes beside
   elevated queues). Give the plaza its centre-tile rectangle; queue
   tails land exactly ON street nodes.
4. **Themed lands** (§3) — 2-4 zones + the hub; place rides/stalls/scenery
   in-zone with the legality lint (§5).
5. **Simulation wiring** — ONE `createGameManager(t, { groundAt, net, laneY,
   bins })` given the SAME `{nodes, edges}` object the network rendered
   (network first; `attachWalkers` before the manager). `registerRide` /
   `registerStall` / `registerRestroom` / `registerParkEntrance`, then
   `spawnGuests(n)` with no area. Tag every ride's visual group
   `userData.rideRef = handle` (+ `userData.rideVehicle = a train car` where
   one exists) — guests are tagged by the manager automatically — so
   Stage `onPick` clickability works (rules/ui.md; SETUP.md §7).
6. **One combined updater** — collect every sub-updater (water, lights,
   walkers, crowd, coaster run, rotors, `manager.update`) and return a single
   `(time) => void`.
7. **`validatePark` MUST pass before the park "opens"** (§6).

## 3. Themed lands — zones give parks their identity

Partition the buildable land around the composition (2-4 lands + the hub).
On the default 48 plot the lands are REAL DISTRICTS: anchor each one on a
different composed flat field (the seed table lists two meadows per seed),
link them with long approach boulevards off the hub, and let the walk
between lands breathe — trees, torches and scenery line the avenue, not
another ride crammed against the last one. Each land decides ride
ASSIGNMENT, scenery SPECIES and COLOURS:

- **The hub / Main Street** — gate street + plaza: fountain on the plaza's
  centre tile, kiosks on cells ABUTTING the street (serving front toward
  it), balloon stand, light poles + string lights (`buildStringLights` only
  between real `buildLightPole` hooks), the plaza crowd.
- **The waterside land** (Lakeside Boardwalk / Oasis / Bay) — the
  water-flavoured ride by the shore + sand; `rideColourPreset(seed + zone,
  'water')` (LogFlume/RiverRapids naturals). Boardwalk flavour: a
  `buildDanceFloor` terrace and/or a `buildNeonSign` marquee on a plaza or
  stall front (both night-gated already) — flavour, not clutter: one of
  each per park at most.
- **The hills land** (Alpine/Mesa/Summit/Headland Frontier) — the coaster
  hugging the hill cluster's foothills, rock outcrops on the park-side
  flank; `rideColourPreset(seed + zone, 'wooden')` threaded through
  `buildRideSpline({ colours, vehicleSchemes })` AND `buildCoasterCar`.
- **The open fairground** — flat rides on podium cylinders sunk to the
  ground, centred on grid cells; `rideColourPreset(seed + zone, 'steel')`
  (karts take `'kart'`).
- **Scenery species follow the climate** (§1 table) with a per-zone mix —
  pines cluster at hills, palms at water, cacti on desert flats
  (`buildScenery(t, 'cactusCluster')`), rounds in the open. Seeded rejection
  sampling; never on water, steep rock, paths, pads, poles or the coaster
  envelope. NOTE: `dressTerrain` (§2.1 — automatic under `<Terrain>`)
  already covers the terrain sections (forest/mountain/beach/meadow); YOUR
  planting pass dresses the built-up middle ground near streets and rides —
  don't double-plant the forest discs.

Which rides fit which zone/climate: coasters want the hill flank (wooden
reads alpine/frontier, steel reads fairground/coastal); spinners/scramblers/
drop-type flats want the open fairground; a Ferris wheel or carousel reads
boardwalk. Desert parks favour mine-train/kart energy; alpine favours
bobsled/wooden; coastal favours the wheel + water rides. **The water rides do
NOT go in the water:** LogFlume, RiverRapids and PaddleBoats each BUILD their
own water (trough ribbon, channel + splash pond, and a whole pond with a
sandy bank) and need dry flat land — put them NEAR the lake for the theme,
never on it, or the wet-pad guard fails the park.

## 3.1 SET-PIECES — the mandated way to build a district (round-7)

**`buildParkNet` is MANDATORY for any park with ≥ 2 zones, and a hand-rolled
uniform grid is a REJECTED layout (§0.15).** A set-piece bundles several
primitives, their interior paths, their stalls and their GameManager
registrations into ONE correct-by-construction unit, and the whole point is
that you never hand-compute interior geometry again. PLAN FIRST, MOUNT
SECOND:

```tsx
// 1. PURE plans — the whole district exists as data before anything mounts
const HUB    = fountainPlazaPlan({ id: 'hub', position: [-6, 7.2], ports: ['N', 'S', 'E'], seed: 7 });
const MARKET = bazaarPlan({ id: 'market', position: [-6, -9.6], rotation: Math.PI / 2,
                            stalls: ['burger', 'soda', 'cottonCandy'], seed: 5 });
const AVE    = boulevardPlan({ id: 'ave', from: HUB.port('S'), to: MARKET.port('W'), seed: 4 });

// 2. FUSE the streets: your own spine nodes keep their indices, piece
//    sub-nets are appended, port cells merge, crossed edges split, dangling
//    ports are pruned
const NET = buildParkNet({
  nodes: MY_SPINE,                                   // a dozen nodes, not a lattice
  edges: [[0, 1], [1, 'hub:N'], ['hub:E', 2], …],    // endpoints: index OR 'pieceId:PORT'
  pieces: [HUB, MARKET, AVE],
  keepDry: [...RIDE_PAD_AND_LANE_CELLS],
});

// 3. ONE graph into the park, then the pieces mount from the SAME plans
<Terrain keepDry={NET.keepDry} coasterPts={PTS} />
<Paths nodes={NET.nodes} edges={NET.edges} plazas={NET.plazas} bins={NET.bins} walkers={6} />
<FountainPlaza plan={HUB} /> <Boulevard plan={AVE} /> <Bazaar plan={MARKET} />
```

- **`<FountainPlaza>` for a plaza hub**, **`<Bazaar>` for a shop cluster**,
  **`<Boulevard>` for a long avenue between districts** — required, not
  optional. Ports are named connector cells one lattice cell OUTSIDE the
  piece footprint, so a street or a queue lane meets a port without ever
  overlapping the piece (`plan.port('W')`, `plan.portDir('W')`).
- **A port nobody wires is PRUNED** ("a spur dead-ending in grass"), so if a
  ride's queue tail is meant to land on a port, wire that port to something.
  Ask for the ports you will actually use (`ports: ['N', 'S', 'E']`).
- Rotations are quarter turns: a `bazaarPlan` with `rotation: Math.PI / 2`
  runs its aisle N/S, and its `'W'` port then faces NORTH — ask the plan
  (`plan.port(...)`), don't assume compass names.
- `NET.warnings` reports diagonal edges and disconnected islands; `NET.pruned`
  lists what it dropped. Both are FATAL under §0's warnings policy.
- Declare set-pieces AFTER `<Paths>` (their dressing settles onto the paving).

The worked example is `<DistrictPark>` (`components/Park/Park.previews.tsx`,
preview 1): three pieces + a 13-node spine on a size-48 plot, `ok: true`.

## 4. Rides are RIDEABLE or they don't exist

- **Every tracked ride goes through `buildRideSpline` (SplineRideKit)** —
  `checkCoasterDesign` (per-type slope/bank whitelists, windowed pitch-rate,
  bank-rate, a real station flat) must report NO failing violations, and
  `validateSpline` clearance ≥ 0.9. Ride the control points on ONE ground
  reference plane (80th-percentile ground along the circuit), not per-point
  terrain. TrackKit/CoasterBuilder are for grid-piece demos only;
  `WoodenCoaster` is deprecated.
- **The 1.5 g derail guard is real** — an unbanked fast hairpin WILL crash
  the train (Vehicle.TrackMotion.cpp:58-122). Default parks must NEVER
  crash: validatePark replays the runner's energy-paced lateral-G sweep and
  requires a 15% margin under 1.5 g. Design wide, ride your fast turns high
  (slow) or banked, and give the station approach a dead-straight tail. Wire
  `vehicleHandle: { crashed: () => handle.crashed() }` anyway — if a custom
  layout is forced past the limit the SIM must know.
- **Prefer PIECES over raw control points** — `compileTrackPieces`
  (SplineRideKit) is the piece grammar behind `<Coaster pieces|children>`,
  the generic `<TrackRide profile>` and the `pieces` prop on LogFlume /
  RiverRapids / Monorail / Bobsleigh. Vocabulary: `station` (FIRST piece,
  flat boarding straight), `flat`/`straight`, `lift`/`drop` (rampPoints-eased
  — pitch-legal by construction), `hill`, `turnL`/`turnR` (`angle`, `radius`
  ≥ 1.5 in parks), `helixL`/`helixR`, `corkscrewL`/`corkscrewR` (STEEL
  coasters only), `sbend`. Both syntaxes work: a `pieces` array
  (`['station', { type: 'lift', height: 2 }, 'turnR', 'drop']`) or JSX piece
  children (`<Station/><Lift height={2}/><TurnR/><Drop/>` — children win).
  Composing tips for the agent:
  - **RUN-LENGTH TABLE (verified against the compiler) — do the closure
    arithmetic on paper with THESE numbers**, not by eye:

    | piece | cursor advance |
    |---|---|
    | `station` | 2.6 straight (default length) |
    | `flat`/`straight` | its `length` (default 1.3) |
    | `lift`/`drop` h | **≈ 1.6 + 3.9×h** (h ≤ ~1.5) — auto-extended for pitch legality; a shorter `length` is IGNORED. h 0.6 → 3.9, 0.9 → 5.1, 1.0 → **5.5**, 1.2 → 6.3, 1.5 → 7.4, 1.8 → 8.0, 2.0 → 7.9. Past 2.0 it grows ~1.3/unit: 3.2 → 8.9, 3.6 → 9.5, 4.2 → 10.27, 5.1 → 11.43, 5.5 → **11.94**, 6.0 → 12.6 |
    | `hill` h | max(`length`, 3.6, 6.3×√h) — default h 0.9 → **6.0** |
    | `turnL`/`turnR` 90° | cursor moves R along the OLD heading + R along the NEW (R default 1.5); heading ±90°; arc length 2.36 |
    | `helixL`/`helixR` 360° | returns to its ENTRY point (net zero advance), ±`height`; sweeps a ~3 u circle to the side |
    | `corkscrewL/R` | forward max(`length`, 4R) — default **2.4** (R 0.6), level |
    | `sbend` | forward max(2.4, `length`, default 3.6); lateral `radius` (default 1.2, +ve left) |

    So station + lift h + drop = `2.6 + 2×(1.6 + 3.9h)` of dead-straight
    run — 13.6 u at h 1.0 (the shallowest lift that clears the `shortDrop`
    stat gate), 15.1 u at h 1.2, 26.5 u at h 5.5. A lift-1.0 rectangle circuit
    spans 5.0 × 17.8 u; the §4.0 lift-5.5 rectangle spans 37.6 × 37.6 — budget
    the land BEFORE picking heights.
  - The compiler AUTO-CLOSES the circuit (eased ramp home + shortest
    arc–straight–arc; closure radius **2.2 for coasters**, 1.5 other
    profiles) onto the START POSE — the station start point AND the heading
    you left it on. Coaster closures land via a synthesized **1.2-u straight
    brake tail** before the station (round-4: an arc welded directly onto
    the station concentrated the spline's curvature at the weld — the
    fastest, least-banked track — and the crash replay read a lateral-G
    spike there). **The ~30° rule is HEADING ALIGNMENT (§0.2)**: end
    within ~30° of the station ENTRY heading and within ~3 u of the start.
    A synthesized closure over 40% of the authored length is FATAL — the
    ride renders translucent red and is NOT registered. "Pointing at the
    station" from mid-park fails exactly this way (verified: it synthesizes
    `turnR 4°, straight 8.0, turnR 176°` → fatal).
  - **LAND STRAIGHT, not from a curve**: when YOUR OWN last pieces reach the
    start (gap ≤ 0.5, so the compiler synthesizes nothing), the final
    authored piece must be a **straight brake tail ≥ ~1.2 u along the
    station axis, landing ~0.3 u short** — a turn that lands directly on
    the station leaves the weld curved and unbanked at full speed and the
    crash replay FAILS it (verified: the old un-tailed L-wrap read 1.31 g
    against the 1.27 g margin at u = 1.00; the compiler now WARNS "the
    circuit lands on the station from a curve" — that warning is FATAL,
    §0). The re-verified archetypes below all end with this tail.
  - **Closure-synthesized pieces COUNT toward the park bounds.** Land the
    final authored leg **~0.3 u SHORT of the start** — a leg that OVERSHOOTS
    the start pose makes the Dubins closure loop around from the far side
    (verified on the L-wrap: f-leg +0.4 over is still fine, +0.8 over
    synthesizes a 268° wrap that reaches ±10.8 u and is FATAL twice over —
    bounds + self-intersection). Short is safe: the closing arcs stay inside
    the authored span.
  - **Worked example — compact rectangle WITH the brake tail, the arithmetic
    shown** (heading starts +z at (0,0); tail g = 1.2; lift **1.0** — the
    shallowest lift that clears the `shortDrop` stat gate, see below):

    ```
    station 2.6            → (0, 2.6)
    lift 1.0 (run 5.5)     → (0, 8.1)    y +1.0
    drop     (run 5.5)     → (0, 13.6)   y back to 0
    turnR                  → (−1.5, 15.1)  heading −x
    straight 2.0           → (−3.5, 15.1)
    turnR                  → (−5.0, 13.6)  heading −z
    straight 14.8  ← station leg 13.6 + brake tail 1.2
                           → (−5.0, −1.2)
    turnR                  → (−3.5, −2.7)   heading +x
    straight 2.0           → (−1.5, −2.7)
    turnR                  → (0, −1.2)  heading +z = the entry heading
    straight 0.9           → (0, −0.3) — the brake tail, 0.3 short. Closed.
    ```
  - **PICK THE RIGHT SHELF FIRST.** There are two shelves of verified
    archetypes and choosing the wrong one is the single most common
    park-composition defect:

    | shelf | shapes | excitement | use it for |
    |---|---|---:|---|
    | **LOW-THRILL LEGACY** | compact rectangle h1.0, L-wrap h1.0 | **0.6 – 1.1** | a SECOND/THIRD small coaster, a kiddie circuit, a filler on a cramped plot (size ≤ 20). **NEVER a flagship.** |
    | **HIGH-THRILL (§4.0)** | apex-turn rectangle A / B / C | **5.3 – 6.3** | the FLAGSHIP of any park. A + C for a THRILL park, B for a FAMILY park. |

    A park whose best coaster rates 0.6 excitement fails the rubric's Thrill
    axis no matter how tidy it is. If your park has ONE coaster, it must come
    from the HIGH-THRILL shelf.
  - **LOW-THRILL LEGACY archetypes** (RE-VERIFIED 2026-07 round-6 END-TO-END
    through the FULL `validatePark` gate — accessibility, terrain, footprints,
    coaster legality + clearance + the crash replay, corridor, bounds,
    scenery, autofix and the sim smoke — in a real minimal size-48 park, on
    wooden AND steel, **at lift 1.0**, `<Coaster>`'s pieces-mode bank
    (wooden 0.42 / steel 0.7). Both end with the **1.2-u brake tail landing
    0.9 (= g − 0.3) short of the start** — the round-4 fix for the
    station-weld lateral-G spike. `run(1.0)` per the table: 5.5.
    **LIFT 0.6 AND 0.7 ARE RETIRED**: their first drop measures 0.70/0.79 u,
    under RCT2's 0.9-u `shortDrop` stat gate — a `shortDrop` warning is FATAL
    (§0), and the gate HALVES all three ratings anyway. Lift 1.0 is the
    SHALLOWEST legal lift for these two shapes (0.95 also clears, 1.0 is the
    published value). The verified starts below are REFERENCE placements —
    the compiled geometry is start-relative and size-independent, so on the
    default 48 plot translate `start` (+ the corridor table) by lattice
    multiples of 1.2 into whichever district the coaster owns):
    - *Compact rectangle + tail, h 1.0* (span 5.0 × 17.8; needs size ≥ 20 at
      the reference start below, or any district of a 48):
      ```
      ['station', { type: 'lift', height: 1.0 }, 'drop', 'turnR',
       { type: 'straight', length: 2.0 }, 'turnR',
       { type: 'straight', length: 14.8 }, 'turnR',
       { type: 'straight', length: 2.0 }, 'turnR',
       { type: 'straight', length: 0.9 }]
      ```
      Return straight = station leg + the tail = 2.6 + 2×5.5 + 1.2 = **14.8**.
      VERIFIED start `[2.4, 0.55, −6.0]`, `heading: 0` → X −2.60..2.40,
      Z −8.74..9.06, maxY 1.55, closure synthesizes NOTHING.
      **wooden**: E 0.63 / I 0.86 / N 0.38, first drop 1.00 u, +G 1.98,
      worst lateral **0.99 g**, length 43.27, clearance 2.31.
      **steel**: E 1.11 / I 1.02 / N 0.32, +G 2.41, lateral **0.59 g**.
    - *L-wrap + tail, h 1.0* (5 turnR + 1 turnL + tail; span 12.8 × 12.3 —
      still fits a compact size 16):
      ```
      ['station', { type: 'lift', height: 1.0 }, 'turnR', 'drop', 'turnR',
       { type: 'straight', length: 2.0 }, 'turnL',
       { type: 'straight', length: 1.3 }, 'turnR',
       { type: 'straight', length: 4.3 }, 'turnR',
       { type: 'straight', length: 9.8 }, 'turnR',
       { type: 'straight', length: 0.9 }]
      ```
      Parameterize (a = station leg 2.6 + run(h) = 8.1, b = drop run 5.5,
      c = 2.0, d = 1.3, g = 1.2): closure needs `c + e = a − 3 + g` →
      **e = 4.3**, and `f = 3 + b + d` → **f = 9.8**; the 0.9 tail then lands
      0.3 u short of the start. VERIFIED start `[6.0, 0.55, −3.6]`,
      `heading: 0` → X −6.78..6.02, Z −6.32..5.98, maxY 1.55, closure
      synthesizes NOTHING.
      **wooden**: E 0.62 / I 0.84 / N 0.39, first drop 0.99 u, +G 1.98,
      worst lateral **1.01 g**, length 46.54, clearance 2.47.
      **steel**: E 1.10 / I 1.02 / N 0.35, +G 2.39, lateral **0.79 g**.
      The old UN-TAILED L-wrap (f = 3 + b + d − 0.3, no tail) stays RETIRED:
      its final turn landed on the station from a curve and the crash replay
      read 1.31 g at the weld against the 1.27 g margin.

  - **CORRIDOR CELL TABLES (round-5) — copy, don't derive. They are
    SIZE-INDEPENDENT.** For each verified archetype × reference start,
    these are the 1.2-grid cells inside the RUNTIME-DERIVED track corridor
    (within 1.6 u of the compiled polyline where the rails run < 2.2 u up —
    computed headlessly from `compileTrackPieces` + the same sweep
    `validatePark` runs; identical for wooden and steel). Lay streets,
    stalls and flat-ride rigs OFF these cells BY CONSTRUCTION — every
    listed cell is a guaranteed corridor FAIL for anything at grade.
    **Size-independence (verified headlessly 2026-07):** the corridor
    depends ONLY on the compiled polyline — pieces + `start` + `heading` —
    never on the park size (`compileTrackPieces` output is bit-identical at
    bounds 16 vs 48, and the swept cell set is identical clipped at ±24,
    ±48 or unclipped). **Translation-invariant too:** shift `start` by
    lattice MULTIPLES OF 1.2 and every cell shifts rigidly with it
    (verified) — so one table serves any placement on any plot.
    **FRAME (round-6, unambiguous):** every cell below is an **offset from
    the reference `start`**, in the compiled frame (heading 0, station
    straight running +z). A row `x −4.8: z −3.6..15.6` means the cells
    `(start.x − 4.8, start.z − 3.6) … (start.x − 4.8, start.z + 15.6)` at
    1.2 steps. The round-5 tables for lift 0.6/0.7 are DELETED with those
    lifts (§4 retired them).
    - *legacy rect h 1.0 @ start `[2.4, 0.55, −6.0]`* (103 cells; the whole
      circuit is below 2.2 u so nothing over-flies anything):
      ```
      x −6.0: z −2.4..14.4
      x −4.8: z −3.6..15.6
      x −3.6: z −3.6..15.6
      x −2.4: z −3.6..−1.2, 14.4..15.6      ← the alley between the two legs
      x −1.2: z −3.6..15.6
      x  0.0: z −3.6..15.6
      x  1.2: z −2.4..14.4
      ```
      The alley (x −2.4, z 0.0..13.2) is CLEAR but fenced in on both sides —
      don't put anything needing street access there.
    - *legacy L-wrap h 1.0 @ start `[6.0, 0.55, −3.6]`* (113 cells):
      ```
      x −14.4: z 0.0, 2.4
      x −13.2: z −3.6..4.8
      x −12.0: z −3.6..6.0
      x −10.8: z −3.6..−1.2, 3.6..6.0
      x  −9.6: z −3.6..−1.2, 3.6..9.6
      x  −8.4: z −3.6..−1.2, 3.6..10.8
      x  −7.2: z −3.6..−1.2, 4.8..10.8
      x  −6.0: z −3.6..−1.2, 8.4..10.8
      x  −4.8: z −3.6..−1.2, 8.4..10.8
      x  −3.6: z −3.6..−1.2, 8.4..10.8
      x  −2.4: z −3.6..−1.2, 8.4..10.8
      x  −1.2: z −3.6..10.8
      x   0.0: z −3.6..9.6
      x   1.2: z −2.4..9.6
      ```
      Clear pockets: the whole band x −6.0..−2.4 × z 0.0..7.2 (inside the
      wrap) and everything at x ≥ 2.4 or z ≤ −4.8.
    - *§4.0-A THRILL rect @ start `[16.8, 0.55, −3.6]`* (175 cells). The
      apex legs FLY (rails 2.2–6.05 u up), so only the four valley floors and
      the station leg obstruct anything at grade — **the whole 30 × 30 middle
      of the ring is free**:
      ```
      x −38.4/−37.2: z −7.2..13.2          ← west leg valley + hills
      x −28.8..−8.4: z −16.8..−14.4        ← south leg valley + hills
      x −26.4..−9.6: z  20.4..22.8         ← north leg valley + hill
      x −1.2/+1.2:   z −7.2..7.2           ← station leg (own ride: exempt)
      x   0.0:       z −7.2..8.4
      ```
      (the north band starts at x −26.4 and the south at x −28.8; both stop
      one cell before the west/east columns because the ramps are already
      above 2.2 there.) Streets, stalls and flat rides go in
      `x −36.0..−2.4 × z −13.2..19.2` (the interior) or on the east apron
      `x ≥ +2.4`, and may cross UNDER the apex legs freely.
    - *§4.0-B FAMILY rect @ start `[14.4, 0.55, −2.4]`* (160 cells):
      ```
      x −30.0/−28.8: z −6.0..10.8
      x −27.6:       z −4.8..10.8
      x −22.8..−6.0: z −14.4..−12.0
      x −18.0..−6.0: z  15.6..18.0
      x −1.2/+1.2:   z −7.2..7.2
      x   0.0:       z −7.2..8.4
      ```
      Interior free block: `x −26.4..−2.4 × z −10.8..14.4`.
    - *§4.0-C INVERTING rect @ start `[16.8, 0.55, −3.6]`* (149 cells):
      ```
      x −36.0:       z  0.0..14.4
      x −34.8:       z −1.2..14.4
      x −33.6:       z  0.0..14.4
      x −27.6..−12.0: z −15.6..−13.2
      x −25.2..−9.6: z  21.6..22.8
      x −1.2/+1.2:   z −7.2..7.2
      x   0.0:       z −7.2..8.4
      ```
      Interior free block: `x −32.4..−2.4 × z −12.0..20.4`.
    The §4.0 band rows are rounded OUTWARD by at most one cell at each end
    (the generated per-column table is one cell narrower on the two extreme
    columns of each valley band) — erring towards "blocked" is always safe.
    On the default 48 plot, TRANSLATE an archetype into its district — e.g.
    the size-48 reference park `broadmoor` runs the legacy rect h 1.0 shifted
    by (+12.0, −14.4) into the back-east meadow, full gate green — and carry
    the cell table along with the same offset.
  - **VERIFIED queueDir (round-6 — re-derived, the round-5 note was
    incomplete).** Every reference start above leaves the station straight
    running **+z**, so the lane the resolver keeps is perpendicular:
    **`queueDir [1, 0]` pinned TOGETHER WITH `heading: 0`** (the pair is what
    was verified; at any other heading, re-derive or rotate both). A
    `[0, ±1]` queueDir spears the station straight and WILL be auto-flipped
    (a §0-FATAL `queueDirFlip` lint).
    **But `[1, 0]` alone is not enough — the TAIL NODE distance is part of
    the archetype.** The manager plans the queue HEAD at
    `tail − dir·(laneLenOf(capacity) + 0.35)` and the entrance hut a further
    0.62 back, and `laneLenOf(c) = max(2.2, 1.1 + 0.56·c)`. The station
    straight's own no-go rect reaches `start.x + 0.55`, so with capacity 4
    (`laneLenOf = 3.34`) the hut's inner edge lands at `tail − 4.91` and the
    tail must satisfy
    **`tailX ≥ start.x + 5.46`** (in general `start.x + laneLenOf(capacity) + 2.12`).
    Round-6 verified: a tail at `start.x + 4.8` (only 1.2 u east of the
    station in the old round-5 parks) FLIPS — `[1,0] → [−1,0]` or `[0,−1]` —
    and that flip is now a FATAL `autofix` lint. **Every §4/§4.0 archetype
    is published with its tail node at exactly `start.x + 6.0`, same
    `start.z`, and ran unflipped and untrimmed.** Publish-and-copy — don't
    re-derive.
  - It always runs `checkCoasterDesign` + `validateSpline`; every warning is
    FATAL (§0) — a self-intersecting compile means the pieces need spreading
    out; re-lay, don't ship.
  - For a park `<Coaster>`, compile ONCE up front —
    `compileTrackPieces(pieces, { type, start: [sx, 0.55, sz], heading })`
    (from `./components/SplineRideKit`) — and hand the points to
    `<Terrain coasterPts>` (peaks pre-capped under the circuit) + `keepDry`,
    then give `<Coaster>` the SAME `pieces`/`start`/`heading` (`start`
    accepts the same `[x, y, z]` tuple — the y is ignored). Skipping the
    terrain pre-cap lets ground clamps kink the compiled profile into
    pitchRate violations.
  - **Prefer PIECES mode; points mode gets NO leniency** — a raw `points`
    circuit faces the SAME fatal gate (design/clearance/closure checks +
    park bounds; translucent red, never registered) as compiled pieces,
    without the pieces grammar's by-construction legality.
  - **Banking SATURATES at the type's bankLimit** (`coasterBankCap`: wooden
    25°, steel/inverted 55°) — geometry, design check and validatePark's
    re-check all build with the same clamped cap, so the DEFAULT bank (no
    `bank` prop) is always legal, on wooden too. Auto-banking is what soaks
    the lateral G through the compiled turns — don't fight it with a low
    `bank`. Modest lifts (≤ ~1.4) keep the closing-leg speed comfortably
    under the crash margin at ANY turn placement; past that, the turns have
    to be ridden HIGH (§4.0) — validatePark replays the sweep either way.
- **Every ride registers with the ONE GameManager**: entrance/exit huts on
  pad edges adjacent to the platform at platform height, entrance doorway
  facing the path spur, queue lane along a lattice axis with its TAIL on a
  street node. Catalog rides + `<FlatRide>` AUTO-DERIVE queue/boarding/exit
  from `position`+`rotation` — never hand-build huts; override only via the
  `register`/`queue` props. A WET pad fails validation: any audited
  footprint cell with ground < waterLevel + 0.18 is a violation — `keepDry`
  SHOULD cover every pad, hut and lane cell (round-5: the AUTO-keepDry
  settle pass re-clamps the terrain under whatever footprints actually
  registered, so a derived/trimmed/shifted rig no longer sinks a park — but
  plan honestly; the self-heal is a safety net, not a design tool). Plan the assembly with `planRideAccess(nodes, tailNode, dir,
  capacity, exit, exitDir)` (ParkBuilder — applies the manager's lane-length
  formula) and settle it with `groundRideAccess(t, g, groundAt, acc, padTop,
  resolvedExit)` after registering (pass `handle.exitPoint()`, the
  audit-resolved spot). The manager's `placeAccess` audit SAT-checks
  hut/lane/pad footprints and auto-shifts a colliding exit; its warnings are
  FATAL (§0) — respace the rides. **Queue-orientation safeguard (round-4):**
  `<Coaster>` and the register wrappers now pick a sane lane orientation UP
  FRONT — a derived/authored `queueDir` whose lane or entrance hut would
  spear the ride's own boardPoint pad/station (or leave the park) is
  auto-FLIPPED to the first clean orientation of dir/−dir/perpendiculars,
  and the exit hut is relocated if the re-oriented lane runs over its cell.
  Every choice is `console.warn`ed and those warnings are FATAL (§0): the
  auto-fix keeps the park functional, but a layout that NEEDED it was
  mis-planned — fix the `queueDir`/`rotation`/exit so the warning goes
  away. **Corridor auto-resolution (round-5):** at settle time — every
  child mounted, every circuit registered — `<Park>` sweeps the coasters'
  1.6-u track corridors over every MOVABLE object (stalls + flat-ride rigs;
  never streets or the coasters themselves) and self-heals the collisions
  no static plan could predict: an exit hut alone in the corridor is
  relocated by itself; a whole rig shifts outward along the least-move axis
  to the first clear cell (≤ 4 cells, dry preferred, never onto another
  footprint); a derived queue lane too long to fit anywhere is trimmed
  (fewer slots) as a last resort. Every fix is `console.warn`ed with the
  exact move; pass `pinned` on a ride/stall to opt out (it will then FAIL
  where it stands); street grade crossings are never auto-fixed — reroute
  the street or raise the track. Plan against
  `manager().corridorCells(name?)` — the 1.2-grid cells inside the LOW
  corridor of the registered circuits — or copy the §4 cell tables so the
  resolver has nothing to do. Keep `rideDuration ≤ 12` (§0.5) or the
  60 sim-s acceptance run cannot complete a cycle.
- Stalls sell (`registerStall({ item: 'food'|'drink', price, value, anchor,
  dir })`), restrooms work (`registerRestroom({ anchor, yaw })`), bins at
  2-3 junction verges (`bins`), and guests walk ONLY on the shared graph.

### 4.0 HIGH-THRILL archetypes — the FLAGSHIP shelf (round-6)

Copy one of these VERBATIM. They are the only shapes in the catalogue that
clear the §4.1 thrill targets. **All three are the same discovery**: RCT2's
stat gates only pay for a BIG first drop (steel wants ≥ 14 z-steps = 3.5 u)
and ≥ 2 drops, but the 1.27 g lateral margin then forbids fast turns — so put
**every turn AT THE APEX**, where the energy-paced speed is 1.4–4.8 u/s, and
spend the whole ground level on straight drops and camelbacks. The shape is a
RECTANGLE with a 90° turn at each corner, each corner ridden at the top of a
lift, each leg carrying one drop → hills → climb excursion to grade. Worst
lateral comes out **0.27–0.90 g** — a 30–70 % margin under the gate, not the
2 % the old wide-ground-turn layouts ran.

**PUBLISHED STATS ARE ±0.1, AND CLEANLINESS IS TERRAIN-DEPENDENT (round-7).**
The excitement/intensity/nausea figures below come from `rateCoaster` on the
compiled points in isolation. Mounted in a real park the station sits on the
composed ground, so the numbers shift slightly — §4.0-A measures **E 6.06**
where this table says 6.12. Treat every published figure as ±0.1 and paste
YOUR measured line into the §0 header (§0.16). More important: the same
archetype at the same verified start is NOT clean on every landform — on
seed 5 alpine, whose SW quadrant carries a 4.7-6.7 u peak cluster under the
ring, §4.0-A fails `checkCoasterDesign` with `pitchRate 0.59 rad/unit`
(limit ~0.55), while on seed 7 temperate it passes with room to spare. So:
VERIFY the flagship on the seed you actually ship, and if it violates, move
the ring to flatter ground rather than re-tuning the archetype.

RE-VERIFIED 2026-07 round-6 END-TO-END through the FULL `validatePark` gate
(accessibility, terrain, footprints, coaster design + clearance + crash
replay, corridor, bounds, scenery, autofix, sim smoke) in a real **size-48**
park: `ok: true`, `warnings: []` — zero lints, no queueDir flip, no exit
relocation, no lane trim, no corridor shift. `type="steel"` and
`<Coaster>`'s default pieces-mode bank (0.7, saturating at the steel 55° cap)
for all three: **do not pass a `bank` prop** — a lower bank re-opens the
lateral-G gate.

Evidence: `/tmp/park-eval/samples/arch-w6.tsx` cycles all three plus both
corrected legacy shapes (× wooden/steel) through `<Park validate>` at size 48;
`node eval.mjs samples/arch-w6.tsx` prints `ok:true (FULL gate) warnings=[]`
for **all seven** combos.

**Shared rules for all three (do not vary these):**

- `heading: 0` (station straight runs **+z**), `type="steel"`, no `bank` prop.
- `queueDir: [1, 0]` and the queue TAIL NODE **exactly 6.0 u EAST of the
  station column** (`start.x + 6.0`, same z as `start.z`) — see the
  "VERIFIED queueDir" bullet in §4 above for why 6.0 and not less.
- Exit hut at `[start.x + 2.4, start.z + 2.4]`, `exitDir: [1, 0]`.
- `capacity: 4`, `rideDuration: 10` (§0.5), `intensity: 7`.
- The circuit closes ITSELF: the final `{ type: 'straight', length: 1.5 }`
  brake tail lands at `(start.x, start.z − 0.3)` — 0.3 u short, heading +z.
  `report.closure.synthesized` is **empty** for all three.

#### 4.0-A THRILL steel rectangle — E 6.12 (flagship of a THRILL park)

```tsx
const A_PIECES = ['station',
  { type: 'lift', height: 5.5 }, { type: 'straight', length: 4.84 }, { type: 'turnR', angle: 90, radius: 2.5 },
  { type: 'drop', height: 5.5 }, { type: 'hill', height: 1.2 },
  { type: 'lift', height: 5.1 }, { type: 'straight', length: 2.34 }, { type: 'turnR', angle: 90, radius: 2.5 },
  { type: 'drop', height: 5.1 }, { type: 'hill', height: 0.6 }, { type: 'hill', height: 0.6 },
  { type: 'lift', height: 5.1 }, { type: 'turnR', angle: 90, radius: 2.5 },
  { type: 'drop', height: 5.1 }, { type: 'hill', height: 0.6 }, { type: 'hill', height: 0.6 },
  { type: 'lift', height: 5.1 }, { type: 'turnR', angle: 90, radius: 2.5 },
  { type: 'drop', height: 5.1 }, { type: 'straight', length: 1.5 }];
// VERIFIED: start [16.8, 0.55, -3.6], heading 0, type "steel", cars 5,
// capacity 4, queueTailNode at [22.8, -3.6], queueDir [1, 0],
// exit [19.2, -1.2], exitDir [1, 0].
```

- **rateCoaster (cars 5, bank 0.7):** excitement **6.12**, intensity 9.32
  (*intense*), nausea 3.43 (*moderate*), highest drop **5.47 u**, total drop
  24.30, **9 drops**, +G **6.26**, −G −3.86, **maxLatG 0.36 g** (limit 1.275 —
  71 % margin), airtime **1.06 s**, inversions 0, length 158.63, duration
  24.59 s, vmax 10.91, vavg 7.76, turns `banked[3] = 4`.
- **Footprint (at the verified start):** X −20.81..16.80, Z −19.33..18.28,
  maxY 6.05 — worst |coord| **20.81** on a ±24 plot. This archetype OWNS a
  48 plot: it is a 37.6 × 37.6 ring around the park with a clear middle. Run
  the streets and the other rides in the RING'S INTERIOR (the whole centre is
  outside the low corridor, see the table below) and along the east apron.
- **Closure arithmetic** (local frame, start (0,0), heading +z; advances from
  the run-length table: lift/drop 5.5 → 11.94, 5.1 → 11.43, hill 1.2 → 6.90,
  hill 0.6 → 4.88, turnR 90 R2.5 → 2.5 along the old heading + 2.5 along
  the new):

  ```
  station 2.6         → (0, 2.6)
  lift 5.5   (11.94)  → (0, 14.54)      y +5.5   ← the lift hill
  straight 4.84       → (0, 19.38)
  turnR R2.5          → (−2.50, 21.88)  heading −x   ← corner 1, AT the apex
  drop 5.5   (11.94)  → (−14.44, 21.88) y back to 0  ← the 5.47-u first drop
  hill 1.2   (6.90)   → (−21.34, 21.88)              ← airtime crest
  lift 5.1   (11.43)  → (−32.77, 21.88) y +5.1
  straight 2.34       → (−35.11, 21.88)
  turnR R2.5          → (−37.61, 19.38) heading −z   ← corner 2, at the apex
  drop 5.1   (11.42)  → (−37.61, 7.96)
  hill 0.6   (4.88)   → (−37.61, 3.08)
  hill 0.6   (4.88)   → (−37.61, −1.80)
  lift 5.1   (11.43)  → (−37.61, −13.23)
  turnR R2.5          → (−35.11, −15.73) heading +x  ← corner 3, at the apex
  drop 5.1            → (−23.68, −15.73)
  hill 0.6            → (−18.80, −15.73)
  hill 0.6            → (−13.92, −15.73)
  lift 5.1            → (−2.50, −15.73)
  turnR R2.5          → (0, −13.23)      heading +z  ← corner 4, at the apex
  drop 5.1            → (0, −1.80)
  straight 1.5        → (0, −0.30) — brake tail, 0.3 short. CLOSED.
  ```

#### 4.0-B FAMILY steel rectangle — E 5.27, gentle forces (flagship of a FAMILY park)

```tsx
const B_PIECES = ['station',
  { type: 'lift', height: 3.6 }, { type: 'straight', length: 2.56 }, { type: 'turnR', angle: 90, radius: 2.5 },
  { type: 'drop', height: 3.6 },
  { type: 'lift', height: 3.2 }, { type: 'straight', length: 5.46 }, { type: 'turnR', angle: 90, radius: 2.5 },
  { type: 'drop', height: 3.2 }, { type: 'hill', height: 0.9 },
  { type: 'lift', height: 3.2 }, { type: 'straight', length: 1.5 }, { type: 'turnR', angle: 90, radius: 2.5 },
  { type: 'drop', height: 3.2 }, { type: 'hill', height: 0.9 },
  { type: 'lift', height: 3.2 }, { type: 'turnR', angle: 90, radius: 2.5 },
  { type: 'drop', height: 3.2 }, { type: 'straight', length: 1.5 }];
// VERIFIED: start [14.4, 0.55, -2.4], heading 0, type "steel", cars 3 (the
// default — no `cars` prop needed), capacity 4, queueTailNode at
// [20.4, -2.4], queueDir [1, 0], exit [16.8, 0.0], exitDir [1, 0].
```

- **rateCoaster (cars 3, bank 0.7):** excitement **5.27**, intensity **6.25**
  (*thrilling* — the moderate/family band, not *intense*), nausea 2.25
  (*gentle*), highest drop **3.58 u**, total drop 14.95, **6 drops**,
  +G **3.51** (vs A's 6.26 — this is the "gentler forces" archetype),
  −G −1.97, **maxLatG 0.27 g** (79 % margin), airtime 0.56 s, inversions 0,
  length **120.87** (well past the wooden 54-u length gate too), duration
  26.47 s, vmax 9.05, vavg 5.98, turns `banked[3] = 4`.
- **Footprint:** X −14.52..14.40, Z −15.67..14.75, maxY 4.15 — worst |coord|
  **15.67**. 28.9 × 30.4: it fits inside HALF a 48 plot, so a family park can
  still fit a hub, a boulevard and 3-4 flat rides beside it.
- **Closure arithmetic** (advances: lift/drop 3.6 → 9.49, 3.2 → 8.97,
  hill 0.9 → 5.98):

  ```
  station 2.6         → (0, 2.6)
  lift 3.6   (9.49)   → (0, 12.09)      y +3.6   ← the lift hill
  straight 2.56       → (0, 14.65)
  turnR R2.5          → (−2.50, 17.15)  heading −x   ← corner 1, at the apex
  drop 3.6   (9.49)   → (−11.99, 17.15) y back to 0  ← the 3.58-u first drop
  lift 3.2   (8.97)   → (−20.96, 17.15) y +3.2
  straight 5.46       → (−26.42, 17.15)
  turnR R2.5          → (−28.92, 14.65) heading −z   ← corner 2, at the apex
  drop 3.2   (8.97)   → (−28.92, 5.68)
  hill 0.9   (5.98)   → (−28.92, −0.30)
  lift 3.2            → (−28.92, −9.27)
  straight 1.5        → (−28.92, −10.77)
  turnR R2.5          → (−26.42, −13.27) heading +x  ← corner 3, at the apex
  drop 3.2            → (−17.45, −13.27)
  hill 0.9            → (−11.47, −13.27)
  lift 3.2            → (−2.50, −13.27)
  turnR R2.5          → (0, −10.77)      heading +z  ← corner 4, at the apex
  drop 3.2            → (0, −1.80)
  straight 1.5        → (0, −0.30) — brake tail, 0.3 short. CLOSED.
  ```

#### 4.0-C INVERTING steel rectangle — E 6.31, TWO corkscrews (highest rated)

```tsx
const C_PIECES = ['station',
  { type: 'lift', height: 5.5 }, { type: 'straight', length: 5.2 }, { type: 'turnR', angle: 90, radius: 2.5 },
  { type: 'drop', height: 5.5 }, { type: 'hill', height: 0.6 },
  { type: 'lift', height: 4.2 }, { type: 'straight', length: 2.72 }, { type: 'turnR', angle: 90, radius: 2.5 },
  { type: 'drop', height: 4.2 }, { type: 'hill', height: 0.6 },
  { type: 'lift', height: 4.2 }, { type: 'corkscrewL' }, { type: 'straight', length: 4.0 }, { type: 'turnR', angle: 90, radius: 2.5 },
  { type: 'drop', height: 4.2 }, { type: 'hill', height: 0.6 },
  { type: 'lift', height: 4.2 }, { type: 'corkscrewR' }, { type: 'straight', length: 2.0 }, { type: 'turnR', angle: 90, radius: 2.5 },
  { type: 'drop', height: 4.2 }, { type: 'straight', length: 1.5 }];
// VERIFIED: start [16.8, 0.55, -3.6], heading 0, type "steel" (corkscrews are
// STEEL-ONLY), cars 3 (default), capacity 4, queueTailNode at [22.8, -3.6],
// queueDir [1, 0], exit [19.2, -1.2], exitDir [1, 0].
```

- **rateCoaster (cars 3, bank 0.7):** excitement **6.31**, intensity 9.64
  (*intense*), nausea 3.60 (*moderate*), highest drop **5.47 u**, total drop
  19.87, **7 drops**, +G 5.41, −G −4.00, **maxLatG 0.90 g** (29 % margin),
  airtime **1.71 s**, **inversions 2**, length 152.17, duration 22.72 s,
  vmax 10.91, vavg 7.78, turns `banked[3] = 4` + `sloped[1] = 5`,
  `sloped[2] = 1`.
- **Footprint:** X −18.42..16.80, Z −18.16..18.64, maxY 6.05 — worst |coord|
  **18.64**. 35.2 × 36.8.
- **WHY THE CORKSCREWS SIT WHERE THEY DO** — a corkscrew's own curvature
  reads ~0.21 effective κ, so at grade (v ≈ 10.9) it measures **2.35 g** and
  is FATAL. It must be ridden within ~2.5 u of the apex. It is also LEVEL and
  rises ~1.13 u above its entry, so if you put it straight after the lift hill
  its top becomes the global maximum, `detectLiftHill` swallows it and the
  train CRAWLS through the inversion at chain speed. Hence: `H1 = 5.5` on the
  station leg and `Hn = 4.2` on the others, corkscrews on the leg-3 and leg-4
  climb tops (4.75 + 1.13 = 5.88 < the 6.05 apex). **Do not move them, do not
  deepen `Hn`, do not raise `H1`.** (Verified: `Hn = 4.6` puts a corkscrew top
  at 6.28 > the apex; three corkscrews reach 1.06 g; the mid-slope placements
  all breach 1.275 g.)
- **Closure arithmetic** (advances: lift/drop 5.5 → 11.94, 4.2 → 10.27,
  hill 0.6 → 4.88, corkscrew → 2.40 level):

  ```
  station 2.6         → (0, 2.6)
  lift 5.5   (11.94)  → (0, 14.54)       y +5.5  ← the lift hill (the apex)
  straight 5.2        → (0, 19.74)
  turnR R2.5          → (−2.50, 22.24)   heading −x  ← corner 1, at the apex
  drop 5.5   (11.94)  → (−14.44, 22.24)  y back to 0 ← the 5.47-u first drop
  hill 0.6   (4.88)   → (−19.32, 22.24)
  lift 4.2   (10.27)  → (−29.59, 22.24)  y +4.2
  straight 2.72       → (−32.31, 22.24)
  turnR R2.5          → (−34.81, 19.74)  heading −z  ← corner 2
  drop 4.2   (10.26)  → (−34.81, 9.48)
  hill 0.6            → (−34.81, 4.60)
  lift 4.2            → (−34.81, −5.66)
  corkscrewL (2.40)   → (−34.81, −8.06)  ← INVERSION 1, ridden at v ≈ 6
  straight 4.0        → (−34.81, −12.06)
  turnR R2.5          → (−32.31, −14.56) heading +x  ← corner 3
  drop 4.2            → (−22.04, −14.56)
  hill 0.6            → (−17.16, −14.56)
  lift 4.2            → (−6.90, −14.56)
  corkscrewR (2.40)   → (−4.50, −14.56)  ← INVERSION 2
  straight 2.0        → (−2.50, −14.56)
  turnR R2.5          → (0, −12.06)      heading +z  ← corner 4
  drop 4.2            → (0, −1.80)
  straight 1.5        → (0, −0.30) — brake tail, 0.3 short. CLOSED.
  ```

**Do NOT re-tune these three.** Every number was searched against
`rateCoaster` + the crash replay under the ±24 bounds; the intensity sits at
9.32/6.25/9.64 and RCT2 cuts excitement by 25 % per band once intensity
reaches 10.00, so a deeper lift or an extra corkscrew LOWERS the score.
Translate them (lattice multiples of 1.2), recolour them, rename them — but
do not edit the piece list.

### 4.1 Hit a THRILL target — measure it, don't guess it

A legal circuit is not automatically a RIDE. Decide the park's type up front
and aim at the matching numbers, then check them with `rateCoaster(points,
{ type, bank, cars })` (SplineRideKit) BEFORE you ship — it re-measures the
compiled points through the SAME energy-paced replay the crash gate uses and
runs RCT2's RideRatings.cpp chain over the result:

```ts
const r = rateCoaster(COMPILED.points, { type: 'wooden', bank: 0.42, cars: 3 });
console.log(`[thrill] E ${r.excitement} I ${r.intensity} N ${r.nausea} (${r.ratingBand})`,
  `drop ${r.highestDrop} G +${r.maxPosVertG}/${r.maxNegVertG} lat ${r.maxLatG} air ${r.airtimeSeconds}s`);
```

| target | THRILL park | FAMILY park |
|---|---:|---:|
| flagship `excitement` | ≥ 6.0 | ≥ 5.0 |
| `maxPosVertG` | ≥ 2.5 g | ≥ 1.8 g |
| `highestDrop` | ≥ 2.0 u | ≥ 1.2 u |
| `maxLatG` | **< 1.27 g** (the crash gate — non-negotiable either way) | |
| `airtimeSeconds` | > 0 on at least one crest | |
| `nausea` | **< 8.0** — past that most guests are made sick | |

**THE SHORT ANSWER: copy §4.0.** `4.0-A` (E 6.12) or `4.0-C` (E 6.31) clears
every THRILL-park row; `4.0-B` (E 5.27, +G 3.51, lat 0.27 g) clears every
FAMILY-park row with room to spare. Nothing else in §4 does — the LOW-THRILL
legacy shapes top out at **1.11**.

Why, given the physics: the RCT2 stat gates HALVE all three ratings when the
highest drop is under 12/14 height steps (3.0 u wooden / **3.5 u steel**),
when the circuit is short (wooden needs ~54 u of track; steel has no length
gate) or when there are fewer than 2 drops — a `lift 0.7` rectangle is a
kiddie coaster and rates ~0.6 excitement however tidy it is. But a bigger lift
means more speed at the bottom, and speed squares into the lateral G that the
1.27 g gate watches. So buy the drop and PAY for it with geometry:

- **PUT EVERY TURN AT THE APEX** (§4.0's whole trick). The bank the kit builds
  is `atan(1.9·κ)` box-smoothed over ~2 u, so the discount LAGS the curvature
  and the peak lateral lands at the turn ENTRY, where roll is still ~half.
  Measured: at v ≈ 10 u/s a 90° turn reads **1.1–2.7 g at EVERY radius from
  1.5 to 12** — widening the turn does not save you, and neither does
  tightening it. What saves you is speed: a turn ridden within ~2 u of the
  apex sees v ≈ 4–6 u/s and reads 0.3–0.9 g. Structure the circuit as
  `lift → turn → drop → hills → lift → turn → …` so the turns are always on a
  crest and the straights always at grade.
- **Ride the fast turns HIGH.** Speed is a function of height only, so a
  `lift` back up before the turn section slows it for free.
- **Give it crests.** Each `hill` (camelback) is one extra `dropCount`, the
  airtime bonus AND the −G term of `BonusGForces`; a hill's crest curvature is
  ~0.497 whatever its height, so every default-length hill produces airtime.
  Hills are the cheapest excitement per unit of track in the whole grammar.
- **Two drops minimum, then the brake tail** (§4's closure rules still apply).
- **What the score is actually made of** (steel, `rateCoaster` raw units, from
  §4.0-A's breakdown): base 300, **avgSpeed 142**, gForces 46, drops 48,
  maxSpeed 30, turns 6, length 12, duration 12, trainLength 11, airtime 5.
  `avgSpeed` dominates — keep the circuit LOW (only the lift and the four
  corners go up) or you throw the score away. And watch intensity: RCT2 cuts
  excitement 25 % per band once intensity ≥ 10.00, so more drop is not always
  more score.
- **Inversions are the cheapest excitement left** (steel: +0.11 E each, up to
  6, and they RELAX the drop-height/drop-count gates) — but a `corkscrew` at
  grade reads **2.35 g** and is fatal. §4.0-C shows the only verified
  placement: on a mid-leg climb top, ≥ 1.2 u below the global apex.

Also spread the park across the BANDS: RCT2 guests demand variety, so ship a
gentle ride (`intensity ≤ 3` — carousel/wheel), a moderate one (4-6) and an
intense one (≥ 7) alongside the coaster. `<Coaster>`/`<TrackRide>` register
their measured triple automatically (`handle.ratings()`, `mgr.rides()[i].ratings`).

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
- **SOLID PROPS NEED `pathHalf + groundRadius` OF CLEARANCE, AND YOU CAN ASK
  FOR IT (round-7).** A `<Scenery>`/`<Placed>` piece whose ground footprint
  eats into a rendered slab is a `scenery` FAIL. Round 7 put eight props on
  "cell centres" at ±3 / ±9 / ±15 while its street rows ran at ±3.6 / ±9.6 —
  0.6 u from the centreline, half a slab INSIDE the street. Required
  clearance is `pathWidth/2 + min(groundRadius, 0.6)` (≈ 1.03 for a statue on
  a 1.1 slab), and the API computes it for you:
  `offPathCell(NET, [3, 3], { clear: 1.15 })` → the nearest legal cell;
  `pathClearance(NET, [3, 3]).clearance` → what you actually have. Plaza
  interiors are exempt (planters on a forecourt are RCT2 dressing).
- **NOTHING IS PLANTED IN THE WATER (round-7).** `<Scenery>`/`<Placed>` now
  sample the ground before mounting: a spot in OPEN water (more than 0.4 u
  below the waterline) is REFUSED — the piece is not built and a §0-FATAL
  `plantedInWater` lint names the dry-cell query that would have prevented
  it. A marginal SHORELINE cell is kept and the settle-time AUTO-keepDry pass
  raises a dry bank under it (non-fatal `plantedWetCell`) — planted
  footprints join that sweep now, so a shoreline dip is landscaped rather
  than merely detected. Neither is a licence to guess: query
  `park.isDryCell([x, z])` against the COMPOSED water (§0.17).
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
- Deterministic only: hashed-sine PRNGs; no `Math.random` / `Date.now`.
  Whole park well under the AREA-SCALED mesh budget (~2500 per 16² of
  plot — ~22 500 on the default 48; §6).

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

- **accessibility** — the registered gate routes to EVERY ride's queue tail.
- **terrain** — exactly ONE flood-filled water body; the entrance apron flat
  (relief ≤ 0.5) and dry; no structure footprint parked on a hill flank.
- **footprints** — OBB SAT sweep over every audited rect: no overlaps.
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
  | `padOnStreet` | a ride/shop pad INTERSECTS a street slab (§0.14) |
  | `queueAnchorIsHead` | explicit `queue.anchor` was given a street NODE, i.e. used as if it were the tail (§0.4) |
  | `queueTailShared` | two rides attach their queue tails to the SAME node |
  | `plantedInWater` | a prop in open water — **not planted** |
  | `queueDirFlip` / `queueDirUnfixable` | the derived lane speared the ride's own pad |
  | `exitHutRelocated` / `exitHutUnfixable` | the exit hut had to be moved off the lane |
  | the `corridor*` family | a settle-time shift out of a track corridor |
  | `coaster:shortDrop` | first drop under the 0.9-u stat gate — promoted by the gate itself (`FATAL_LINT_KINDS`), since `<Coaster>` cannot know the policy |

  Reported but NOT fatal: `laneTrim`, `exitSnapped`, `pathLevelMedian`,
  `padNearStreet`, `plantedWetCell`, `coaster:shortLength`.

  **READ THE REFUSALS AS A CHAIN.** `latticeInWater` and `causewayRefused`
  DELETE the offending edge, so the very next failures you see are
  `accessibility` (a ride's queue no longer routes from the gate) and
  `blockers`-unreachable for everything that sat behind the hole. Those are
  DOWNSTREAM of the refusal, not separate bugs: fix the span and they vanish.

  **An auto-fix must never silently rescue a design you were supposed to
  re-plan — an EMPTY `warnings` array is the only truly clean result.**
- **sim** — steps `manager.update` ~60 sim-s at fixed dt: at least one
  completed ride cycle, no visible walker frozen >25 s, no queue that holds
  >30 s without ever advancing. NOTE: this fast-forwards the manager's sim
  clock — keep render time monotonic afterwards (add `SIM_SMOKE_SECONDS` to
  your updater clock, as the worked example does).
- **budget + determinism** — mesh count against the AREA-SCALED budget
  (~2500 per 16² of plot area; ~22 500 on the default 48): exceeding it is
  a `console.warn`, NOT a hard fail — LOD tiers + culling fog keep big
  parks drawable — but warnings are FATAL under §0, so treat it as one.
  With `rebuild`, a double-build scene hash must match exactly.

Run it as the LAST build step and log the report (console.warn per failure)
— the worked example (`buildExamplePark`, ParkBuilder preview) does exactly
this and ships with `ok: true`. A park is not done until its own run says
the same.

## 7. Reference sketch (compose your OWN structure on top)

```tsx
const comp = parkComposition(t, seed, 48, climate, { keepDry, coasterPts }); // probed landform (§1)
const terrain = buildTerrain(t, { size: 48, seed: comp.terrainSeed, amplitude: 0.38, scale: 48 * 0.52, waterLevel: -0.26,
  peaks: [...comp.peaks, ...comp.clampPeaks], basins: [...comp.basins, ...comp.clampBasins], firmShore: true });
tintTerrainForClimate(t, terrain.mesh, comp.climate, comp.basins, comp); // climate bias + section zone paint
const dressed = dressTerrain(t, comp, terrain.heightAt); g.add(dressed.group); // sections dress themselves
g.add(terrain.mesh);
const water = buildWater(t, 47.8, 120); water.mesh.position.y = -0.26; g.add(water.mesh); // size × 0.995
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

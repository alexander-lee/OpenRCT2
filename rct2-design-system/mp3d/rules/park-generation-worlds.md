# Composing parks — §2 build order · §3 WORLDS · §3.1 SET-PIECES

Part of the recipe book. `rules/park-generation-composition.md` carries §1
(climate, the seed table and the ring-clearance data) — read it FIRST, because
you pin a seed before you lay a node. §0.0 and §0.0b are in
`rules/park-generation.md`; the 27 pre-flight checks are in
`rules/park-generation-checks.md` and `-checks-b.md`.

## 2. The build order (always the same, whatever the layout)

**Step 0 — CHOOSE THE PARK'S WORLDS (§3), PLAN THEM AS SET-PIECES (§3.1) and
fuse them with `buildParkNet` BEFORE you write any JSX.** Which worlds the park
contains is the FIRST decision, before terrain seeds and before pathing — a
park is its worlds (§3). The plans are pure, so the street graph, the paving
rects, the bins and the keepDry list all exist as data before the first
component mounts — which is why the pieces, the terrain guard and the queue
tails cannot disagree. On any park with ≥ 2 worlds this step is mandatory
(§0.15).

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
   `1.2·round((size/2 − 0.8)/1.2)`, i.e. **z 63.6 on the default 128**
   (`1.2·round((96 − 0.8)/1.2) = 1.2·79`; 7.2 on a compact 16, 22.8 on a 48,
   46.8 on a 96, 94.8 on a 192) — facing out; put a street node under that cell. **On a 128
   this cell is the anchor of every distance in §0.3**: the first ride's queue
   tail belongs within 15 u of it, and the gate-reach band is the 75-u disc
   around it.
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

   **THE STREET FOLLOWS THE LAND (§0.6).** `<Paths>` solves a PER-NODE surface
   that clears the ground across the full slab and ramps between nodes inside
   the walkable grade, so ROUTE ALONG THE CONTOUR and add intermediate nodes on
   a climb rather than assuming a flat sheet. A walked surface more than 0.25 u
   UNDER the terrain — or more than 1 % of the corridor buried — is the §0-FATAL
   **`pathClipping`** lint: reroute or add nodes, never widen the tolerance.
   Expect visible cut-and-fill (berms under 0.35 u of float, wooden trestles
   above it) where a street crosses a dip — that is the RCT2 look, not a defect.
   **Plazas level TILE BY TILE**, so a plaza on a rise STEPS: put plazas on flat
   ground.
4. **The WORLDS** (§3) — mount each world's themed structural set-piece
   (`<Bazaar>`/`<FountainPlaza>` dressed with that world's theme; the five
   one-call land macros were REMOVED in v6.0) + its own rides, stalls,
   scenery and planting, and `<World plan={…}>` beside it. The worlds were
   CHOSEN and PLANNED in step 0; nothing about them is decided here. Any
   remaining loose rides/props go in-world with the legality lint (§5).
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

## 3. WORLDS — a park IS its worlds, and they are chosen FIRST

**THE COMPOSITION ORDER IS INVERTED FROM WHAT IT USED TO BE.** A park is no
longer "terrain, then paths, then rides, with themed lands as advice at the
end". A park is **THREE OR MORE THEMED WORLDS**, and they are the first thing
you decide:

  **(a) CHOOSE THE WORLDS — AND DO NOT DEFAULT TO THE SAME THREE.** Pick **at
  least 3** of the five shipped presets (table below) before you look at a
  terrain seed. This is a design decision about what the park IS, and **BOTH
  halves of it are scored** (`harness/park-eval/RUBRIC.md` axis 16 — world
  variety = COUNT + CHOICE).

  **WHICH THREE IS NOW SCORED, BECAUSE THE COUNT ALONE STOPPED
  DISCRIMINATING.** This rule said "≥ 3" and stopped, and the measurement shows
  what that produced. Across the 24-park corpus, over the 10 parks that declare
  any world at all (`node -e` over `signatures/*.json`, `worlds.builtPresets`):

  | preset | parks that BUILT it |
  |---|---:|
  | `brasswork` | **7** |
  | `pulse` | **7** (and DECLARED by **10 of 10**) |
  | `thornwick` | 5 |
  | `emberfall` | 3 |
  | `tidewater` | **2** |

  Three separate parks (`coolpark`, `r12a`, `worlds-ref`) built the *identical*
  brasswork + pulse + thornwick trio and every one of them took a full 1.5 for
  "world variety". **Axis 16 now splits that 1.5 into COUNT (1) and CHOICE
  (0.5), and the CHOICE half pays for building a preset the corpus UNDER-uses**
  — the split is the corpus median, recomputed on every probe
  (`corpus.mjs: underusedPresets`), so it follows the campaign instead of naming
  favourites. As of 2026-07-26 that means **`tidewater` or `emberfall` earns the
  full 0.5, `thornwick` earns 0.25, and brasswork + pulse + anything earns 0**.
  Re-scored: those three identical parks read 4.75/5 where `r13a` / `r13b` /
  `r14a` — which reached for tidewater or emberfall — hold 5.0.

  **NO PRESET IS UNUSABLE AND NONE IS EXEMPT.** All five have been BUILT at
  least twice, all five still ship their own rides, stall and five scenery
  pieces (audited 2026-07-25: 47/47 `COMPONENT_THEME` keys resolve), and the
  rarest of them, `tidewater`, owns the biggest circuits in the catalog
  (`ReefRacer` mounts 29.6 × 43.4 u, plus `OceanTunnelSlide` and `DeepDrift`) —
  which is a reason to build it, not to avoid it. If you skip a preset, skip it
  because the park is not about that, and expect to be 0.25–0.5 down for it.
  **And the two rarest presets are exactly where the never-used ride shelf is
  concentrated** (§4.0-E: `DeepDrift`, `OceanTunnelSlide`, `MagmaRun`,
  `LavaTubeRun` have never shipped), so one choice pays twice — axis 16's
  CHOICE half and axis 13's selection novelty.

  **(b) BUILD EACH WORLD OUT AS A SELF-CONTAINED DISTRICT.** Every world gets
  its OWN rides, its OWN food, its OWN scenery, its OWN palette and its OWN
  planting. A world with one ride dropped in a rectangle is a label, not a
  place, and the gate says so (`worldNotBuiltOut`).

  **(c) ONLY THEN CONNECT THEM WITH PATHING.** The hub plaza + boulevards
  between world PORTS, fused by `buildParkNet` (§3.1). Pathing is the LAST
  layout decision, not the first.

  **(d) AND RING THEM WITH THE MONORAIL — A PLATFORM PER WORLD (REQUIRED).**
  The streets connect the worlds on foot; the MONORAIL connects them as a ride.
  **Every park ships one park-spanning monorail whose circuit passes each
  declared world, with a boarding PLATFORM in each** — §0's checklist item 10
  and pre-flight check 21, built from the verified block in
  `park-generation-rides.md` **§4.2**. This is a STANDING requirement, not a
  flourish, and it is measured: `probe.monorail.worldsTouched` against
  `worldsDeclared` — **both COUNTS** (`probe.mjs:907-908`; the names are in
  `worldsTouchedIds`) — plus `everyStationQueued` / `everyStationExitConnected` per
  platform, and `harness/park-eval/RUBRIC.md` axis 13 carries an explicit
  deduction when it is absent, unregistered or missing a world.
  **§4.2-A is VERIFIED — pasting it carries no risk, and it is inlined in §0.0
  step 10 so you never have to leave the checklist to copy it.** Do not drop the
  ring to dodge a lake: `beamY: 2.6` flies the beam over water, streets and
  stalls alike. And whatever else happens, **the TRANSPORT category must never be
  empty** — a park that arrives at the end without the ring still mounts a
  `<Chairlift>` between two worlds (§0.0 step 10's floor clause), which costs the
  monorail deduction but not the whole category.

  Practically, this constrains the world LAYOUT, so decide it here rather than
  discovering it later:
  - **PUT THE WORLDS ON THE RING.** The §4.2-A circuit at size 128 has its four
    decks at (−42.6, −8.4) · (0, 34.2) · (42.6, −8.4) · (0, −51.0) — WEST, NORTH,
    EAST and SOUTH of a ring centred on (0, −8.4). Choose ≥ 3 of those four as
    your world centres' neighbours and each world gets a platform for free. A
    world placed in a corner of the plot, off the ring, cannot have one.
  - **THE PLATFORM FACES THE WORLD.** Every deck's queue, entrance hut, exit hut
    and exit footpath sit on the ring's INTERIOR side (`report.stations[i].left`),
    because the districts are inside the ring. An outward-facing platform serves
    the apron.
  - **THE BEAM FLIES OVER THE BOULEVARDS.** At `beamY: 2.6` the soffit clears a
    footpath by 2.36 u against validatePark's 2.2-u overfly gate, so a boulevard
    may run UNDER a leg — that crossing is a good shot, not a defect. What it
    must not do is run *along* a leg: keep streets off the §4.2-A corridor cell
    columns.
  - **DISTRICT SEPARATION STILL APPLIES** (§0.3 check 4): the ring does not
    excuse two worlds fused into one fairground.
  - **SAY WHAT IT DOES, AND NO MORE.** Guests board a platform because it is
    there and free, and get off at the next one — a real transfer across the
    park. They do NOT plan a journey: RCT2 has no transport routing at all
    (`peep/GuestPathfinding.cpp:813-815` still carries the original
    *"The rideIndex will be useful for adding transport rides later."*), and a
    disembarking peep's own station index is overwritten with the vehicle's
    (`entity/Guest.cpp:4192` + `:4226`), so it forgets where it boarded. Write
    the header accordingly: the monorail's platforms are what make each world
    boardable, and `probe.sim.transfers` is the only "guests travelled between
    worlds" number you may claim.

### THE THREE LINES THAT SCORE THIS AXIS — `<World>` needs NOTHING but a plan

**THE AUDIT READS `<World>` REGIONS, NOT YOUR THEMED CONTENT.** This is the
cheapest 5 points in the book and the one most often left on the floor, because
everything below is written alongside `buildParkNet` and an author on the plain
`<Paths>` route concludes the world layer belongs to the other composition
route. **It does not.** `<World>` builds no geometry, touches no street graph and
takes exactly one prop: it registers a RECT so the gate and the probe can see it.
Round-11's park B built three coherent themed districts — `EmberRoast` + 5
emberfall pieces, `GoggleWorks` + 5 brasswork, `NeonSlush` + 6 pulse, 22 themed
components, `crossTheme: []` — and scored **0 / 5** on this axis, for
`declared: 0`, purely for never mounting the region.

```tsx
// 1. ONE themed set-piece gives the world its shape (a bazaar also brings its stalls).
//    DECLARE 3-6 STALLS. Fewer is AUTO-PADDED to 3 with a BalloonStand, which
//    changes `tiles`, `half`, both port cells and every stall pad under you.
const PULSE_ROW = bazaarPlan({ id: 'pulseRow', position: [43.2, 16.8], theme: PULSE_DISTRICT,
                               stalls: ['soda', 'cottonCandy', 'balloon'], seed: 7 });
// 2. THE PLAN. `rides` takes PAD centres; `include` takes every other hand-placed cell.
const PULSE = worldPlan({
  id: 'pulse', theme: PULSE_DISTRICT, pieces: [PULSE_ROW],
  rides:   [{ at: [49.2, 8.4], name: 'Discotron' }],
  include: [SLUSH, P_ARCH, P_STACK, P_PYLON],
});
// 3. MOUNT IT — with plain <Paths> above it, or with buildParkNet; <World> does not care.
<Paths nodes={NODES} edges={EDGES} plazas={PLAZAS} />
<World plan={PULSE} />
<Bazaar plan={PULSE_ROW} />        {/* + the world's ride, stall and scenery */}
```

Three notes that are the whole contract:
* **`<World>`'s ONLY prop is `plan`** — `id` and `theme` live in `worldPlan`, not
  on the component. `<Worlds plans={[PULSE, FOUNDRY, GLADE]} />` mounts several.
  **And `<World>` regions are SIZE-INDEPENDENT: nothing on this axis reads
  `size`.** A small plot exempts nothing — `worlds.declared: 0` is **0 / 5** at 48
  exactly as at 128. Round 12's park B pinned `size={48}` and declared zero worlds
  on the reasoning that it *"needs no monorail/3-world machinery to score"*; it
  scored 0/5 here and lost the monorail deduction on top (the ring is required at
  every size — §4.2-B scales the radius). Shrink the rects to taste; do not drop
  the layer.
* **`pieces` must not be empty.** `worldPlan` with no pieces raises a §0-FATAL
  `worldEmpty` lint — a world with no set-piece has no region to audit. One
  themed `bazaarPlan` or `fountainPlazaPlan` is enough.
* **Themed content without a declared region is worth NOTHING on this axis** —
  not toward `rideCount`, `stallCount`, `sceneryCount` or `built`. It is reported
  as `unplacedThemed`, which is not even charged: it simply does not count.

**`buildParkNet` is still MANDATORY (§0.15) — for the STREETS.** These are
different jobs: `buildParkNet` fuses the path graph, `<World>` declares a region.
Doing one does not excuse the other, and skipping either loses points the other
cannot recover.

> ### ⚠️ THE FIVE LAND MACROS WERE REMOVED IN v6.0
>
> `<EmberfallCaldera>`, `<TidewaterHollow>`, `<BrassworkFoundry>`,
> `<ThornwickGlade>` and `<PulseDistrict>` — the one-call components that used
> to plan a whole district each — **no longer exist in the design system.**
> Importing any of them makes esbuild refuse the whole bundle (the black page).
> `ParkBuilder/worlds.ts` no longer carries them in `COMPONENT_THEME`, and
> `WORLD_LAND_COMPONENT` is gone with them.
>
> **THE WORLD LAYER ITSELF IS INTACT AND ALL FIVE PRESETS ARE STILL FULLY
> BUILDABLE.** `WorldTheme`, the five presets, `worldPlan`, `<World>`,
> `buildParkNet` and the whole theme-coherence audit are untouched in
> `SetPieceKit` / `ParkBuilder`, and every world's own RIDES, STALL and five
> SCENERY pieces survive. What changed is only that you now assemble a district
> yourself out of those parts instead of getting it from one call — see the
> per-world content table below and the worked skeleton in §3.1.

### The five preset WORLDS — and what each one is BUILT FROM

The preset (`theme`) is the DRESS. The rest of the row is the world's own
surviving catalog: pick at least one RIDE, the STALL and a couple of the
SCENERY pieces, place them, and list every hand-placed cell in that world's
`worldPlan({ include })` so the region actually covers them (a piece outside
the rect counts for nothing — see `built`, below).

| theme id | preset const | character | its RIDES | its STALL | its SCENERY (5) |
|---|---|---|---|---|---|
| `emberfall` | `EMBERFALL_CALDERA` | volcanic caldera, basalt + live FLAME lanterns | `MagmaRun`, `EmberWings` (+`EmberWingsHanger`), `LavaTubeRun`, `Volcano` | `EmberRoast` | `Fumarole`, `ObsidianShards`, `BasaltColumns`, `LavaFissure`, `CharredSnag` |
| `tidewater` | `TIDEWATER_HOLLOW` | shipwreck cove, bleached sand + boardwalk | `ReefRacer`, `DeepDrift`, `OceanTunnelSlide` | `SushiStall` | `WreckedHull`, `CoralCluster`, `AnchorPile`, `TidePool`, `DockPilings` |
| `brasswork` | `BRASSWORK_FOUNDRY` | steampunk works, soot flag + gaslight | `GearworksExpress`, `AetherBalloons`, `BoilerBurst` | `GoggleWorks` | `GiantGear`, `SteamPipes`, `ClockTower`, `BoilerTank`, `CoalCart` |
| `thornwick` | `THORNWICK_GLADE` | enchanted forest, moss + faerie-cold light | **only 2:** `WyrmsHollow`, `MoonlitBarge` | `Honeywitch` | `GiantToadstools`, `StandingStones`, `LanternTree`, `RuinedArch`, `FlowerPodBed`, `MagicMirror` (walk-on, NOT a ride) |
| `pulse` | `PULSE_DISTRICT` | disco night street, black glass + neon | `Bassline`, `Discotron` (+`BigPiano`, walk-on, not a ride) | `NeonSlush` | `NeonArch`, `SpeakerStack`, `MirrorBallPylon`, `LaserTruss`, `LightTiles` |

**EVERY WORLD IN THAT TABLE OWNS AT LEAST ONE CIRCUIT NOBODY HAS EVER BUILT**
(measured 2026-07-26, `node harness/park-eval/probe-tracked-roster.mjs`):
`emberfall` → `MagmaRun`, `LavaTubeRun`; `tidewater` → `DeepDrift`,
`OceanTunnelSlide`; `brasswork` → `GearworksExpress`; `thornwick` →
`WyrmsHollow`; `pulse` → `Bassline`. **All seven compile their own
`DEFAULT_PIECES` clean** — `ok`, `closed: true`, 0 synthesized, 0 warnings — so
each is a one-line element with no `pieces` array to author (§4.0-E). Building a
world and NOT taking its circuit is leaving both axis-13 novelty and axis-14
roster credit on the table for the sake of one JSX tag.

Each world's scenery lives in its `…Scenery` component
(`components/PulseScenery`, `components/BrassworkScenery`,
`components/ThornwickScenery`, `components/EmberfallScenery`,
`components/TidewaterScenery`), which exports the five pieces as ordinary
composables. **This table IS `COMPONENT_THEME`** (`ParkBuilder/worlds.ts`) —
those names are exactly the tags the coherence audit matches on, so a piece
from one row standing inside another row's world is the `crossTheme` defect.

**THE STRUCTURAL SET-PIECES ARE HOW A DISTRICT GETS ITS SHAPE.** `<Bazaar>`,
`<FountainPlaza>` and `<Boulevard>` are NEUTRAL by component name but each
planner takes `theme?: WorldTheme`, and a themed one is stamped with that
world's `dsWorldTheme` — so it counts as the world's own set-piece, gets its
palette and paving, and gives you the PORTS an avenue wires to. A themed
`bazaarPlan` is the cheapest way to give a world a centre, a set-piece and its
stalls in one call (its `stalls` are the generic kinds
`'burger' | 'hotDog' | 'soda' | 'cottonCandy' | 'balloon'`, which are neutral
but still count toward the world's `stallCount`). Remember **`<Bazaar>` has
only `W` and `E` ports, never N/S, at any rotation.**

The presets themselves live in `components/SetPieceKit`
(`WORLD_THEMES`, `EMBERFALL_CALDERA`, `TIDEWATER_HOLLOW`, `BRASSWORK_FOUNDRY`,
`THORNWICK_GLADE`, `PULSE_DISTRICT`) and carry the palette, the planting
species, the lantern CHARACTER (warm bulb / cold light / live flame), the
`ridePreset` family and the `pathSurface`. Hand the SAME theme object to every
generic set-piece inside the world (`fountainPlazaPlan({ …, theme:
PULSE_DISTRICT })`) and the plaza is re-skinned to match; hand it to none and
the piece stays municipal grey, which reads as concrete infrastructure dropped
into a caldera.

**A WORLD IS AS BIG AS YOU BUILD IT — and that is now your problem, not the
macro's.** Since v6.0 the region is derived from whatever you actually put in
the world, so size, shape and separation are all author-controlled. Plan
around these, do not discover them:
* **A world's REGION comes from its member PIECES plus `rides` plus `include`.**
  `worldPlan` unions its `pieces`' `extent`/`footprint` and adds `margin`
  (default 2.4). **Anything you mount by hand — a ride pad, the stall, a
  scenery piece — is NOT a member piece**, so unless its cell is listed it falls
  outside the rect and counts for NOTHING: not toward
  `rideCount`/`stallCount`/`sceneryCount`, and therefore not toward `built`.
  It is reported as `unplacedThemed` instead. Listing the cells is the single
  most common thing to get wrong when hand-composing a district.

  **AND "DECLARED" IS NOT "BUILT". A WORLD IS BUILT ONLY WHEN A REGISTERED RIDE'S
  OWN REGISTERED POSITION FALLS INSIDE THE RECT.** Not a cell near the ride, not
  the ride's queue tail, not "the district obviously contains it" — the audit
  resolves each REGISTERED PIECE by its REGISTERED POSITION and asks which region
  contains that point. Two corollaries, each of which has cost a park most of
  this axis:
  * **`include` must list the ride's PAD cell.** A tail is 3-7 u UPSTREAM of the
    pad it serves, so a world whose `include` lists tails stops short of its own
    attractions and reads `rideCount: 0` → `worldNotBuiltOut`. **Better: list the
    ride in `rides: [{ at: PAD, name }]`** and let the planner add the pad apron
    for you — that field exists for exactly this mistake.
  * **A `<Coaster>` REGISTERS AT ITS FOOTPRINT CENTRE, NOT AT `start`.** The
    §4.0 rectangles grow WEST and straddle the start in z, so §4.0-A's registered
    position sits about **(−18.8, +3.1) from `start`** — nearly 19 u away, usually
    in a different district than the one whose `include` lists the start cell.
    Compute the centre from the archetype's published LOCAL bbox
    (x −37.61..0.00, z −15.73..21.88 for §4.0-A) and list THAT.

  Wave-12's six-word-brief park listed `include` cells *near* its rides and gave
  the coaster's `start`: **two of its three worlds registered ZERO rides** and the
  axis scored **2.08 / 5** on a park that had built all three districts.

* **A THEMED `<Bazaar>` ALONE EARNS 1 OF 5.** `built` wants a ride AND a stall AND
  a scenery/set-piece inside the bounds, so **each of your ≥ 3 worlds must mount
  at least one RIDE FROM THAT WORLD'S OWN ROW in the table above AND at least one
  piece from its `*Scenery` pack** — a bazaar brings the stall and the set-piece
  and nothing else. And write it down, one line per world, in the §0 header:

  ```
   * WORLD <id>: ride <X> @[x,z] (inside rect ✓) · stall <Y> · scenery <Z> ×n
  ```

  If you cannot write that line for a world, that world is not built.
* **Keep the regions from OVERLAPPING.** `worldAt` resolves a piece into the
  SMALLEST region containing it, so two overlapping rects quietly reassign
  each other's pieces and manufacture `crossTheme` findings.
* **≥ 3 worlds needs the plot.** A hand-composed district built around a
  themed `<Bazaar>` plus a ride and a few scenery pieces is far smaller than
  the old 50-70 u land macros, so three of them fit a 128 comfortably — but
  they still each need their own room to clear the separation floor.
* **Worlds must read as separate places, and the test is the CLOSEST PAIR.** Keep
  every pair of world CENTRES at least `20·√(size/48)` apart — the same published
  floor §0.3 check 4 uses (20 u @48, **32.66 @128**, 40 @192). It is scored
  (axis 16) and the probe measures it (`probe.worlds.separation`).
  **List all k(k−1)/2 pairs as `√(Δx² + Δz²)`, sorted, with the closest marked** —
  three worlds is three numbers, four is six — and remember that anything under
  `0.6 ·` the floor (**19.6 u @128**) is not a near miss but a MERGE: the scorer
  reads those two worlds as one district. **And the RECTS need a non-zero DRY GAP,
  not merely centres apart:** two rects that touch (`minGap 0`) are one place, and
  `worldAt` will start reassigning their pieces to each other and manufacturing
  `crossTheme` findings out of correct content. Wave-12's park published
  *"separation 51 / 65 / 69 u ✓"* against a measured `minCentre` of **17.28 u**
  with `minGap 0` — two worlds fused, and every number in the claim invented.
* **Aim the district's frontage at the approach.** There is no longer a land
  macro with a fixed `S` frontage, so the rule is the generic set-piece one:
  read the port as DATA (`plan.port('W')`, `plan.portDir('W')`,
  `world.gateway(toward)` / `gatewayCell(toward)`) or let the plan aim itself
  (`bazaarPlan({ …, facing: { port: 'E', toward: HUB.port('S') } })`). **Never
  infer a compass direction from a rotation** — that is §3.1's round-8 lesson
  and it is unchanged.
* **ONE WORLD GOES ON THE GATE STREET — the walking budget makes it mandatory.**
  The sim smoke gate needs one completed ride cycle inside `max(85,
  2.5·maxRideDuration + 20)` sim-s (`SIM_SMOKE_SECONDS` was 60 until 2026-07-28 —
  raised with the BOARDING-QUIET departure rule), guests walk 0.3-0.65 u/s, and the
  measured gate→queue-slot-0 budget — for the NEAREST queue tail only, the one that
  has to carry the smoke window, not every ride — is **15 u safe target, 20 u
  practical maximum** (`harness/park-eval/probe-sim-reach.mjs`, re-measured
  2026-07-28: 15 u completes a cycle at 62.0 sim-s, 20 u at 68.5 s, 30 u at 82.5 s,
  32 u at 87.0 s past the 85 sim-s window; a crowd stretches the dwell, which pulls
  the practical maximum back to ~24 u). Other worlds' queues may sit much farther out — this
  only binds whichever one is closest. Run that probe rather than trusting a
  per-land note — the five lands' Context.md files went with the macros in
  v6.0. Mind
  `laneLenOf(capacity)`, the term nobody was looking at: it is the queue LANE,
  so a big-capacity ride pushes slot 0 further from the tail than you think.
  A worlds park CANNOT afford hub-first: put the world with the
  shortest queues directly on the gate street with 2-5 u of spine and hang the
  neutral hub off its SIDE port. §3.1's skeleton failed exactly once, on `sim`,
  before this was understood.

### `worldPlan` — the world-level PURE PLANNER

```ts
const PULSE_ROW = bazaarPlan({
  id: 'pulseRow', position: [0, 52.8], facing: { port: 'W', toward: GATE },
  stalls: ['soda', 'cottonCandy', 'balloon'], theme: PULSE_DISTRICT, seed: 7,
});
const PULSE = worldPlan({
  id: 'pulse',                      // what crossTheme findings + probe.worlds name
  theme: PULSE_DISTRICT,            // the world IS its theme
  pieces: [PULSE_ROW],              // the world's generic set-piece(s), dressed for this theme
  include: [DISCO.at, SLUSH, P_ARCH, P_STACK, P_PYLON],  // every hand-placed ride/stall/scenery cell
  // margin: 2.4,                   // apron around the union (default two cells)
});
```

Same contract as every set-piece planner: **PURE, returns before anything
mounts**, so `<Terrain keepDry>` and `<Paths>` can be declared first. It reads
its member plans' `extent`/`footprint` and gives you the world as data:

| field | what it is |
|---|---|
| `region`, `centre`, `half`, `bounds` | the world's rect — what `<World>` registers and every positional theme check measures against |
| `ports` | every member piece's port as a `buildParkNet` ref (`'quarter:S'`) |
| `gateway(toward)` / `gatewayCell(toward)` | **the way worlds are connected.** The port nearest `toward` that actually faces it — pass the ELBOW CELL the avenue leaves from, not the hub, and you get the port on the approach axis. Never infer a compass name (§3.1's round-8 lesson) |
| `rideSlots` / `stallSlots` | the attractions and shop spots the land already planned (name, cell, yaw, queue tail) |
| `cells` | every cell the world paves or places on — feed to `<Terrain keepDry>` |
| `pieces` | pass the whole world to `buildParkNet({ worlds: [...] })` and its pieces join the shared graph automatically |
| `contains(at)` | is this cell in the world? |

Mount `<World plan={PULSE} />` beside the land, after `<Paths>`. It builds no
geometry — it registers the region so the gate and the probe can see it. Skip
it and the park has no worlds as far as any check is concerned.

**EVERY WORLD RECT MUST REACH THE MONORAIL'S BEAM CORRIDOR, AND `include` IS HOW
YOU DO IT FOR FREE (measured wave 17).** `probe.mjs` computes `worldsTouched` by
walking the monorail group's bounding-box **PERIMETER** and asking which world
rects it crosses. A world built entirely outside `x ±44` / `z −52.8…36` therefore
reads **`worldsTouched: 1`** however grand it is — the ring is *there*, the world is
*there*, and the audit says they never meet. The fix is **one `include` cell aimed
at the ring** (skeleton B uses `[-38.4, 33.6]`, `[44.4, 33.6]`, `[-43.2, -28.8]`).
Remember what an `include` cell is: **an input to the rect union only.** Nothing is
built on it, it is not a placement, it does not enter `keepDry`, and it is not
guarded — so it cannot move your water or cap a peak. It costs nothing.

### THEME COHERENCE IS ENFORCED, NOT SUGGESTED

**A themed piece belongs to its OWN world.** A lava fissure in the disco street
is a defect, and it is now detected by POSITION: every catalog component stamps
its own kind (`Park/composable.tsx: tagComponent`), `ParkBuilder/worlds.ts`'s
`COMPONENT_THEME` maps ~50 themed components to their world, and
`auditWorldThemes` resolves each one against the declared regions at settle
time. `validatePark` reports each hit as a **`crossTheme` warning** (a warning,
not a failure — the park still opens and the rubric charges it once, on axis 16
at −0.5 per piece), and `probe.worlds.crossTheme` lists them with coordinates.

**Only THEMED pieces are constrained. Everything else is legal anywhere:**
benches, bins, litter, paths, the gate, fences, generic trees and `SceneryPack`
pieces, `Torch`/`StringLights`/`Fountain`, every stock RCT2 flat ride and
coaster, and `DanceFloor`/`NeonSign`/`BalloonStand` (this file uses the dance
terrace and the neon marquee as generic boardwalk flavour, so they stay
neutral). The structural set-pieces `<FountainPlaza>`/`<Bazaar>`/`<Boulevard>`
are classified by the `theme` their PLAN was dressed for — un-dressed they are
neutral, Emberfall-dressed inside the Pulse District they are a finding.

Two structural mistakes ARE fatal, because they make the audit meaningless
rather than reporting a bad placement: **two worlds sharing an `id`**
(`worldIdReused`) and **a world declared with `DEFAULT_THEME`** (`worldUnthemed`).

A themed piece standing OUTSIDE every declared world is reported
(`themedPieceOutsideWorlds` / `probe.worlds.unplacedThemed`) and **not charged**
— a caldera's flume legitimately sprawls past the rect you drew. If it was not
deliberate, grow `margin` or `include` the cells.

### The HUB is not a world

Gate street + plaza is the park's neutral entrance, and it stays neutral: the
fountain on the plaza's centre tile, kiosks on cells ABUTTING the street
(serving front toward it), a balloon stand, light poles + string lights
(`buildStringLights` only between real hooks), the plaza crowd. Give it a
`<FountainPlaza>` with no `theme`, or a `<Bazaar>` with none. Keep the worlds
inside §0.3's gate-reach band — a world nobody reaches is scenery, not a world.

### Per-world path SURFACES

The recurring failure was a costume over municipal infrastructure: grey
concrete running through a caldera and a nightclub alike. Every theme carries
its own `pathSurface`, and `<Paths>` takes both a default and per-region
overrides:

```tsx
<Paths
  nodes={NET.nodes} edges={NET.edges} plazas={NET.plazas} bins={NET.bins} walkers={8}
  surfaceZones={WORLDS.map((w) => ({ ...w.region, surface: w.theme.pathSurface }))}
/>
```

Pick the surface against the world's OWN GROUND, never in the abstract: the two
live failure modes are a surface landing on the same VALUE as the terrain under
it (the court loses its edge) and a pale course reading as municipal concrete
in a wood.

### Scenery species follow the world, then the climate

You scatter each world's own five-piece scenery set inside its court by hand
(§3's per-world table; list every cell in `worldPlan({ include })` or it
counts for nothing).
YOUR planting pass dresses the ground BETWEEN worlds — and there the
species follow the CLIMATE (§1 table) and the world's own
`theme.planting.trees` weights (`pickTreeShape(theme, h)`), by seeded rejection
sampling; never on water, steep rock, paths, pads, poles or a coaster envelope.
`dressTerrain` (§2.1, automatic under `<Terrain>`) already covers the terrain
SECTIONS — don't double-plant the forest discs.

**The water rides do NOT go in the water.** LogFlume, RiverRapids and
PaddleBoats each BUILD their own water and need dry flat land — put them NEAR
the lake for the theme, never on it, or the wet-pad guard fails the park. Same
for a world: `tidewater` reads coastal, so place it near the shore, not on it.


---

## §3.1 SET-PIECES AND THE THREE VERIFIED SKELETONS ARE IN THREE SISTER FILES

Split because these files outgrew a single design-system write; nothing was cut.
Every rules file is injected together, so all three are already in front of you:

- **`rules/park-generation-skeletons.md`** — §3.1 (how a world is assembled), the
  three-skeleton comparison table, and **§3.1-A, the hub-and-spokes skeleton**,
  REPAIRED 2026-07-26 and the only published table that ships **two coasters**.
- **`rules/park-generation-tree-skeleton.md`** — **§3.1-B**, the promenade-and-
  arterial TREE, with its measured numbers and placement slots.
- **`rules/park-generation-skeletons-b.md`** — **§3.1-N** (why transcribing a table
  cannot score) and the set-piece contract.

You cannot lay a node without them.

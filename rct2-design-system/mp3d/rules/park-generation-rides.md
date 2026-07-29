# Composing parks — §4 RIDES and the coaster archetypes

> **⚠ A `§` OR A FILE PATH HERE IS PROVENANCE, NOT A LOOKUP — §0.0-F.** You have no
> filesystem while authoring; round 13's park A searched for these very files, found
> nothing, and improvised the mandatory monorail with two props that do not exist.
> Every block a park needs is inlined at its point of use. **If a block is not in
> front of you, use only what is — never reconstruct one from memory.**

Part of the recipe book. See `rules/park-generation.md` for the intro and §0.0;
`-checks.md` + `-checks-b.md` for the 27 pre-flight checks; `-composition.md` for
§1 (seeds and the ring-clearance table); `-worlds.md` for §2-§3.1 and the two
verified skeletons; `-validation.md` for §5-§7. One document, seven files.

**THE TWO COPY-PASTE SHELVES IN HERE, AND BOTH ARE REQUIRED.**
**§4.0** is the COASTER shelf (three verified archetypes — copy one
verbatim). **§4.2** is the PARK-SPANNING MULTI-STATION MONORAIL, a standing
requirement for every park (§0 checklist item 10 + pre-flight check 21, and
`-composition.md` §3(d)): a four-platform transport ring whose circuit passes
each declared world. Neither is a suggestion and neither should be improvised —
every number on both shelves is measured by a probe in `harness/park-eval/`.

**AND A PARK IS A ROSTER OF CIRCUITS, NOT ONE BIG COASTER — see §4.0-E.** This
document used to say "THE flagship" everywhere, in the singular, and the
rubric's Thrill axis scored a single `flagshipExcitement` field. **Measured over
the 24-park corpus (`harness/park-eval/probe-tracked-roster.mjs`): 16 of 20
probed parks registered exactly ONE coaster, 3 registered none, and exactly one
registered two.** That was the rules' fault, not the authors': nothing here ever
asked for a second circuit, so nobody built one. **§4.0-E is now a requirement —
at size 128, TWO coasters from DIFFERENT archetypes and FIVE circuits total
across at least three families.** Read it before you place your first ride,
because the second coaster's position is not a free choice.

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
  coasters only), **`loop`/`loopL`/`loopR` — a 360° VERTICAL LOOP, STEEL only,
  `radius` is HALF-HEIGHT (default 1.8, clamped 0.7–2.6), `offset` is the lateral
  step (default 1.2, floored at 1.0), `angle` is ignored with a warn** — and
  `sbend`. **`loop` was missing from this list until 2026-07-28, which is why no
  generated park had ever built one.** Both syntaxes work: a `pieces` array
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
    | **LOW-THRILL LEGACY** | compact rectangle h1.0, L-wrap h1.0 | **0.6 – 1.1** | a kiddie circuit or a filler on a cramped plot (size ≤ 20). **NEVER a flagship, and no longer the answer for a second coaster either** — §4.0-E's second coaster comes off the HIGH-THRILL shelf or off the themed-default shelf, both of which rate far better for the same effort. |
    | **HIGH-THRILL (§4.0)** | apex-turn rectangle A / B / C | **5.3 – 6.3** | **BOTH coasters of a size-128 park.** A or C for the thrill flagship, B for the family second (or the reverse for a family park). A park needs TWO of these from DIFFERENT archetypes — see §4.0-E. |

    A park whose best coaster rates 0.6 excitement fails the rubric's Thrill
    axis no matter how tidy it is. **And a park with ONE coaster now caps at
    7.25/8 on that axis however good that coaster is** (RUBRIC.md axis 14's
    roster term) — one coaster plus flat rides only caps at 6.5/8.
  - **THE TWO LOW-THRILL LEGACY ARCHETYPES WERE DELETED (2026-07-28).** They rated
    0.6-1.1 excitement, this file already called them *"NEVER a flagship, and no longer
    the answer for a second coaster either"*, and their piece lists plus a 103-cell and a
    113-cell corridor table filled 54 lines nobody was permitted to use. Author your own
    circuit and verify it (§4.0) — that is now the recommended path for every coaster.


  - **DERIVE YOUR CORRIDOR FROM YOUR OWN COMPILED POLYLINE — the hardcoded cell
    tables were DELETED (2026-07-28).** They listed the 1.2-grid cells inside the
    corridor of §4.0-A/B/C at three fixed start poses: 6.6 KB of coordinates that
    are only correct for a circuit you copied verbatim at exactly that start.
    **Now that you author your own track, no published table can describe it.**

    The rule is unchanged — **lay streets, stalls and ride pads OFF any cell within
    1.6 u of the compiled polyline where the rails run < 2.2 u above ground** — but
    you compute it, from the points you already have:

    ```ts
    const { points } = compileTrackPieces(MY_PIECES, { type: 'steel', start, heading: 0, bounds: SIZE });
    /** every 1.2-lattice cell your streets must avoid */
    const corridor = new Set<string>();
    points.forEach((p) => {
      if (p[1] >= 2.2) return;                    // the track flies over — no keep-out
      for (let dx = -1.6; dx <= 1.6; dx += 1.2)
        for (let dz = -1.6; dz <= 1.6; dz += 1.2)
          corridor.add(`${Math.round((p[0] + dx) / 1.2) * 1.2},${Math.round((p[2] + dz) / 1.2) * 1.2}`);
    });
    const clearOfTrack = (c: XZ) => !corridor.has(`${c[0]},${c[1]}`);
    ```

    Publish the resulting bounding rects in your §0 header in PLOT coordinates, and
    check **every street node and every boulevard leg** against `clearOfTrack`.

    it anyway for −0.5.
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
  85 sim-s acceptance run cannot complete a cycle.
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

**THE `<Coaster>` WIRING BLOCK — THESE PROPS, AND NO OTHERS.** Copy the shape,
substitute your own start/name/tail; every prop a flagship needs is here.

```tsx
const { points, report } = compileTrackPieces(A_PIECES, { type: 'steel', start: A_START, heading: 0 });
const FLAG_PTS: V3[] = points;                 // → <Terrain coasterPts>, rateCoaster

<Coaster
  name="Meadow Firestorm"                      // ← FLAT props: <Coaster> has NO `register` prop
  pieces={A_PIECES}                            // §4.0-A/B/C, VERBATIM, TrackPiece[], no casts
  start={A_START} heading={0} type="steel"     // no `bank` prop — the 0.7 default is the verified one
  cars={5} capacity={4} rideDuration={10} intensity={7} price={6}
  deck={[-2.4, 0]}
  queueTailNode={NET.node([22.8, -3.6])} queueDir={[1, 0]}
/>
// exit / exitDir: OMITTED (derived).   colours: OMITTED (preset for you).
// (catalog flats — <Teacups>, <TwistRide>, … — are the OTHER shape: those DO take
//  `register={{ name, capacity, rideDuration, intensity, price }}` and `queue={{…}}`,
//  and they do NOT accept `queueTailNode`. §0.4.)
```

**PASS ONLY THE PROPS SHOWN IN THIS BLOCK. `colours` IS A `RideColourScheme`
OBJECT, NEVER A NAME STRING — OMIT IT.** The chassis calls
`rideColourPreset(park.seed + 2, type)` for you (`Park/pieces.tsx:285`), or you
pass the helper's RESULT: `colours={rideColourPreset(7, 'steel')}`. A STRING here
(`colours="fire"`) **throws inside the Stage build callback and takes the ENTIRE
park to zero: no `__stageApi`, no `validatePark` line, no registrations, no
render** — `:285` accepts the string via `??`, `:400` reads `scheme.vehicles[0]`,
and "Cannot read properties of undefined (reading '0')" ends the build. Round
12's park B scored **15/100** on that one word. `typecheck` catches it (TS2322);
**esbuild strips types**, so the bundle does not.

**THE GENERAL FORM, because the next invented prop will be a different one: an
invalid prop VALUE on a ride throws inside the Stage build callback and silently
zeroes the park.** No lint, no red mesh, no failure line — the report is simply
absent. **If your probe shows `no __stageApi — not a Stage scene` with a
`[pageerror]`, that is THIS, not a harness stall** (triage:
`park-generation-validation.md` §6.1; the price list: `park-generation.md` §0,
check 22).

**Shared rules for all three (do not vary these):**

- **Copy the `_PIECES` array VERBATIM** — every piece, in order, with its
  numbers. Declare it as a real **`TrackPiece[]`** and use **NO `as` /
  `as const` / `as any` cast**: a cast suppresses the misspelt `type` or missing
  `height` that makes `compileTrackPieces` FATAL, and a fatal compile renders
  translucent red and never registers the ride. **Then CALL `rateCoaster` on the
  compiled points and paste its line into the §0 header — never hard-code a
  `ratings=` prop from the table below** (the published figures are ±0.1 and
  shift on real ground, see the note above).
- `heading: 0` (station straight runs **+z**), `type="steel"`, no `bank` prop.
- `queueDir: [1, 0]` and the queue TAIL NODE **exactly 6.0 u EAST of the
  station column** (`start.x + 6.0`, same z as `start.z`) — see the
  "VERIFIED queueDir" bullet in §4 above for why 6.0 and not less.
- **AND KEEP EVERY STREET ≥ 2.4 u OFF THE LANE SPAN. A LANE LAID ACROSS A STREET
  COSTS SIX FAILURES (measured wave 17).** The lane is RAILED on both long sides
  and enterable only at the tail — it is a SOLID, not a crossing. At capacity 4 it
  occupies `[tail − dir·(laneLenOf(4) + 0.35), tail]` = `[start.x + 2.31,
  start.x + 6.0]` at `z = start.z`. Run a street through that and you get **2
  `blockers` on the lane's own railings PLUS one per ride whose tail is now
  *"reachable only THROUGH a solid object"*** — 4 more in the measured case,
  because the railing severed the single route to the far half of the park. On a
  tree-shaped street net there is no second route, so the count is however many
  rides sit beyond the cut. **Hang the tail off a junction as a STUB; do not put it
  on a through street** (skeleton B: tail `[21.6, −2.4]`, lane `x 17.9 … 21.6`,
  arterial at `x 24.0` — 2.4 u clear).
- **OMIT `exit`/`exitDir`. The published pair was WRONG and is now optional.**
  These archetypes used to pin `exit: [start.x + 2.4, start.z + 2.4]`,
  `exitDir: [1, 0]`. That cell is **2.4 u along the station face and 0.71 u out
  of it** — not the RCT2 adjacency (one tile along, flush) — and, worse, it sat
  on whichever side of the face the layout happened to leave empty, with NO
  street on its outward ray: on `district-ref`/`arch-ref`/`cinder-peak` the ride
  got NO EXIT PATH at all and, since gate check a4, an `accessibility` FAIL.
  `<Coaster>`'s `exit`/`exitDir` are now OPTIONAL: omit them and the chassis
  takes the RCT2 cell on whichever side its exit path reaches the street
  soonest, which is what all five reference parks now ship.

  **The numbers, for a park that wants them on paper (§0.4b arithmetic, capacity
  4 ⇒ `laneLenOf(4)` = 3.34, join 3.69, hut offset 0.62):**

  | | value | derivation |
  |---|---|---|
  | queue tail node | `[start.x + 6.0, start.z]` | unchanged |
  | queue head (`anchor`) | `[start.x + 2.31, start.z]` | tail − dir·3.69 |
  | **entrance hut** | `[start.x + 1.69, start.z]` | anchor − dir·0.62 |
  | **exit hut** | **`[start.x + 1.69, start.z ± 1.2]`** | entrance hut ± one tile along the face |
  | **`exitDir`** | **`[1, 0]`** — the SAME as `queueDir` | both doorways face out |

  The sign is the part you cannot pin blind: it is whichever side has a street
  on its ray, and on `district-ref` (spine node 11→12 running N/S at x 22.8,
  z −9.6..−3.6) that is **−1.2**, i.e. `[start.x + 1.69, start.z − 1.2]` with a
  **3.69 u** exit path meeting the spine at x 22.8. The old published `+2.4`
  picked the other side. MEASURED on the shipped parks: `district-ref` /
  `arch-ref` / `arch-ref-legacy` Firestorm exit `[18.49, −4.8]` facing `[1, 0]`,
  exit path **3.69 u**, adjacency along 1.2 / across 0.00.

  Both huts clear the station straight: its no-go rect reaches `start.x + 0.55`
  and the hut half-depth along the face axis is 0.50, so the near edge lands at
  `start.x + 1.19`. The 1.2 pitch leaves 0.1 u between the two 1.09-wide huts —
  the tightest legal RCT2 pitch, and SAT-clean.
- `capacity: 4`, `rideDuration: 10` (§0.5), `intensity: 7`.
- The circuit closes ITSELF: the final `{ type: 'straight', length: 1.5 }`
  brake tail lands at `(start.x, start.z − 0.3)` — 0.3 u short, heading +z.
  `report.closure.synthesized` is **empty** for all three.
- **THE RING GROWS AWAY FROM THE START CORNER — WEST.** All three run local x
  from 0 down to −28.9/−35.2/−37.6 (the start IS the EASTmost point) and
  straddle the start in z, so **a start near the −x (WEST) edge is THE failure
  mode**: §4.0-A at `start.x = −90` on a 192 reached ±127.6 u against the ±96
  bound, `report.fatal` fires and `<Coaster>` never registers the ride (a real
  ~10-point loss, round-10). Paste the **LEGAL START** block published under
  each archetype below — measured by `harness/park-eval/probe-archetype-bounds.mjs`,
  never re-derived by hand — and keep `start.x ≤ size/2 − 6` on top of it so the
  queue tail at `start.x + 6.0` lands on the plot as well.
- **PUT THE CIRCUIT IN THE PLOT *CORE*, NOT ON A FLANK — A FLANK FLAGSHIP IS A
  FATAL `terrainFlattened` (measured wave 17).** `coasterPts` caps every peak the
  track passes over (`capPeakForCoaster`), and the composition anchors its mountain
  ranges **on the FLANKS**: `reliefBias inner` is **0.18**, so the core is gentle by
  construction and the flanks carry ~2.4× the relief. A circuit on a flank therefore
  crushes several ranges at once. Measured, same park, same seed, moving only the
  flagship: **on a flank — kept 69 % against the 70 % floor AND `stdH` 0.69 < 0.76,
  i.e. BOTH halves of the conjunction, so `terrainFlattened` is §0-FATAL. In the
  centre — kept 73 %, and the finding demotes to a non-fatal warning.** A ~30 × 30 u
  circuit in the gentle core costs almost no relief; the same circuit on a flank
  costs the park. This is also the cheapest way to earn a distinctive layout: the
  three long runs of `park-generation-worlds.md` §3.1-B exist partly to leave a free
  plot centre `x[−14.4..16.8] z[−16.8..15.6]` for the flagship to stand in.

#### 4.0-A THRILL steel rectangle — E 6.12 (flagship of a THRILL park)

```tsx
const A_PIECES: TrackPiece[] = [ /* WORKED EXAMPLE — the one canonical copy is in
  `rules/setup.md` §0-P.4. It was published in THREE files that did not even agree on
  which three archetypes existed. Read it for the idiom, then AUTHOR YOUR OWN circuit
  with at least one inversion and verify it (§4.0). */ ];
// VERIFIED: start [16.8, 0.55, -3.6], heading 0, type "steel", cars 5,
// capacity 4, queueTailNode at [22.8, -3.6], queueDir [1, 0].
// exit/exitDir OMITTED (§4.0 shared rules): derived on the RCT2 cell
// [start.x + 1.69, start.z - 1.2] = [18.49, -4.8], exitDir [1, 0], 3.69 u of
// exit path onto the spine at x 22.8.
```

- **rateCoaster (cars 5, bank 0.7):** excitement **6.12**, intensity 9.32
  (*intense*), nausea 3.43 (*moderate*), highest drop **5.47 u**, total drop
  24.30, **9 drops**, +G **6.26**, −G −3.86, **maxLatG 0.36 g** (limit 1.275 —
  71 % margin), airtime **1.06 s**, inversions 0, length 158.63, duration
  24.59 s, vmax 10.91, vavg 7.76, turns `banked[3] = 4`.
- **Footprint (at the verified start):** X −20.81..16.80, Z −19.33..18.28,
  maxY 6.05 — worst |coord| **20.81**, comfortably inside the default ±64
  bounds (it used to be 87% of a ±24 plot's half-extent). It is a 37.6 × 37.6
  ring with a clear middle: on the old 48 that ring spanned the whole park, but
  on a **128 it is 8.6% of the plot area — it OWNS A DISTRICT, not the park.**
  Run that district's streets and 2-4 more rides in the RING'S INTERIOR (the
  whole centre is outside the low corridor, see the table below), and build the
  park's other districts BESIDE the ring, not inside it.
- **BOUNDS — GROWTH DIRECTION + LEGAL START** (measured, not derived:
  `harness/park-eval/probe-archetype-bounds.mjs`). x **grows WEST (−x) ONLY —
  the start is the EASTmost point**; z **straddles the start** (21.88 u north of
  it, 15.73 u south). Measured LOCAL bbox, closure points included: **x
  −37.61..0.00, z −15.73..21.88, maxY 6.05** (37.61 × 37.61). The guard is
  `max(|x|,|z|)` over ALL points `> size/2 + 0.3`, so at **size 128 the legal
  start is x ∈ [−26.69, 64.30], z ∈ [−48.57, 42.42]** — on the 1.2-u lattice
  **x ∈ [−26.4, 63.6], z ∈ [−48.0, 42.0]**. (192: x ∈ [−57.6, 96.0],
  z ∈ [−80.4, 74.4].) The 128 rescale cost this archetype most of its western
  latitude: 37.6 u of ring growing WEST out of a 64-u half-plot leaves only 26 u
  of legal start west of the origin. At size 48 it collapses to
  x ∈ [13.31, 24.30], z ∈ [−8.57, 2.42] (lattice x ∈ [14.4, 24.0],
  z ∈ [−8.4, 2.4]) — which is why the VERIFIED start is [16.8, −3.6].
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
const B_PIECES: TrackPiece[] = [ /* WORKED EXAMPLE — the one canonical copy is in
  `rules/setup.md` §0-P.4. It was published in THREE files that did not even agree on
  which three archetypes existed. Read it for the idiom, then AUTHOR YOUR OWN circuit
  with at least one inversion and verify it (§4.0). */ ];
// VERIFIED: start [14.4, 0.55, -2.4], heading 0, type "steel", cars 3 (the
// default — no `cars` prop needed), capacity 4, queueTailNode at
// [20.4, -2.4], queueDir [1, 0]. exit/exitDir OMITTED — derived on
// [start.x + 1.69, start.z ± 1.2] = [16.09, -1.2] or [16.09, -3.6], exitDir [1, 0].
```

- **rateCoaster (cars 3, bank 0.7):** excitement **5.27**, intensity **6.25**
  (*thrilling* — the moderate/family band, not *intense*), nausea 2.25
  (*gentle*), highest drop **3.58 u**, total drop 14.95, **6 drops**,
  +G **3.51** (vs A's 6.26 — this is the "gentler forces" archetype),
  −G −1.97, **maxLatG 0.27 g** (79 % margin), airtime 0.56 s, inversions 0,
  length **120.87** (well past the wooden 54-u length gate too), duration
  26.47 s, vmax 9.05, vavg 5.98, turns `banked[3] = 4`.
- **Footprint:** X −14.52..14.40, Z −15.67..14.75, maxY 4.15 — worst |coord|
  **15.67**. 28.9 × 30.4: about **one district** of the default 128 — ~5.4% of
  its area, and 30.4 u is under a quarter of the plot's width (on the old 48 the
  same ring filled half the plot). So a family park at 128 fits this flagship
  PLUS a hub, boulevards and 6-8 more flat rides across 3-4 further districts —
  budget for that, not for "3-4 flat rides beside it".
- **BOUNDS — GROWTH DIRECTION + LEGAL START** (measured, not derived:
  `harness/park-eval/probe-archetype-bounds.mjs`). x **grows WEST (−x) ONLY —
  the start is the EASTmost point**; z **straddles the start** (17.15 u north,
  13.27 u south). Measured LOCAL bbox, closure points included: **x
  −28.92..0.00, z −13.27..17.15, maxY 4.15** (28.92 × 30.42). At **size 128 the
  legal start is x ∈ [−35.38, 64.30], z ∈ [−51.03, 47.15]** — on the 1.2-u
  lattice **x ∈ [−34.8, 63.6], z ∈ [−50.4, 46.8]**. (192: x ∈ [−67.2, 96.0],
  z ∈ [−82.8, 78.0].) At size 48:
  x ∈ [4.62, 24.30], z ∈ [−11.03, 7.15] (lattice x ∈ [4.8, 24.0],
  z ∈ [−10.8, 6.0]) — the VERIFIED start [14.4, −2.4] sits inside both.
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

#### 4.0-C INVERTING steel rectangle — E 6.27, TWO corkscrews (highest rated)

```tsx
const C_PIECES: TrackPiece[] = [ /* WORKED EXAMPLE — the one canonical copy is in
  `rules/setup.md` §0-P.4. It was published in THREE files that did not even agree on
  which three archetypes existed. Read it for the idiom, then AUTHOR YOUR OWN circuit
  with at least one inversion and verify it (§4.0). */ ];
// VERIFIED: start [16.8, 0.55, -3.6], heading 0, type "steel" (corkscrews are
// STEEL-ONLY), cars 3 (default), capacity 4, queueTailNode at [22.8, -3.6],
// queueDir [1, 0]. exit/exitDir OMITTED — derived on
// [start.x + 1.69, start.z ± 1.2] = [18.49, -2.4] or [18.49, -4.8], exitDir [1, 0].
```

- **rateCoaster (cars 3, bank 0.7), RE-MEASURED 2026-07-26:** excitement **6.27**,
  intensity **9.55** (`ratingBand` *intense*), nausea 3.55 (*moderate*), highest
  drop **5.47 u**, total drop 19.87, **7 drops**, **maxLatG 0.73 g** (43 % margin),
  **inversions 2**, length 152.17, turns `banked[3] = 4` + `sloped[1] = 5`,
  `sloped[2] = 1`.
  **THIS LINE USED TO READ E 6.31 / I 9.64 / N 3.60 / maxLatG 0.90 AND NO LONGER
  REPRODUCES** — the ratings kit moved under it. §4.0-A (E 6.12 / I 9.32 / N 3.43 /
  latG 0.36) and §4.0-B (E 5.27 / I 6.25 / N 2.25 / latG 0.27) both reproduce
  EXACTLY, so the drift is specific to the corkscrew geometry, which only C has.
  Nothing about the archetype's legality changed: it still clears the 1.275 g
  lateral gate by 43 % (it was 29 %), and it is still the highest-rated shelf.
  **Take these figures, and if you need them to the cent, re-run `rateCoaster`.**
- **Footprint:** X −18.42..16.80, Z −18.16..18.64, maxY 6.05 — worst |coord|
  **18.64**. 35.2 × 36.8.
- **BOUNDS — GROWTH DIRECTION + LEGAL START** (measured, not derived:
  `harness/park-eval/probe-archetype-bounds.mjs`). x **grows WEST (−x) ONLY —
  the start is the EASTmost point**; z **straddles the start** (22.24 u north,
  14.56 u south). Measured LOCAL bbox, closure points included: **x
  −35.22..0.00, z −14.56..22.24, maxY 6.05** (35.22 × 36.81 — note local
  x reaches −35.22, 0.41 u past the −34.81 corner in the closure table below,
  because the sampled arcs overshoot their corner nodes). At **size 128 the
  legal start is x ∈ [−29.08, 64.30], z ∈ [−49.74, 42.06]** — on the 1.2-u
  lattice **x ∈ [−28.8, 63.6], z ∈ [−49.2, 42.0]**. (192: x ∈ [−60.0, 96.0],
  z ∈ [−81.6, 73.2].) At size 48:
  x ∈ [10.92, 24.30], z ∈ [−9.74, 2.06] (lattice x ∈ [12.0, 24.0],
  z ∈ [−9.6, 1.2]) — which is why the VERIFIED start is [16.8, −3.6].
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
`rateCoaster` + the crash replay under a ±24 bounds check (all three clear the
default ±96 by a wide margin — bounds are not what constrains them); the
intensity sits at
9.32/6.25/9.55 and RCT2 cuts excitement by 25 % per band once intensity
reaches 10.00, so a deeper lift or an extra corkscrew LOWERS the score.
Translate them (lattice multiples of 1.2), recolour them, rename them — but
do not edit the piece list.

#### 4.0-D WHICH RIDES HAVE A PUBLISHED CIRCUIT — and what to do about the rest

**EVERY `pieces` LIST IN A PARK IS COPIED FROM A PUBLISHED BLOCK.** This is not a
flagship rule; it is a `compileTrackPieces` rule, and it binds every ride that
takes `pieces`. An improvised list does not fail loudly — the compiler
SYNTHESIZES a Dubins return leg, and a synthesized closure over **40 % of the
authored length is FATAL**: translucent red, never registered, no station, no
queue, and the category empty. Round-11's park B lost BOTH of its tracked rides
this way in one file: `<TrackRide profile="coaster">` closed with **20.7 u
synthesized against 31.1 u authored (66 %)** and `<LogFlume>` with **19.2 u
against 25.5 u (75 %)** — **−7.0** on thrill, −0.5 on roster, and an empty WATER
category.

| ride | published `pieces` block | with NO `pieces` prop |
|---|---|---|
| `<Coaster>` / `<TrackRide>` | **§4.0-A / B / C** (flagship shelf) + the two LOW-THRILL legacy shapes in §4 | `<Coaster>` requires a circuit — always copy one |
| `<Monorail>` | **§4.2-A** (128), §4.2-B (48/64/96/160/192) | the legacy district shuttle — NOT park-spanning |
| `<LogFlume>` | **NONE YET — NOT PUBLISHED** | **the stock preset loop, and `compileTrackPieces` is never called** |
| `<RiverRapids>` | **NONE YET** | the stock channel + splash pond, no compile |
| `<Chairlift>` | **NONE YET** (its Context.md triangle is an illustration, not gate-verified) | the stock circulating loop, no compile |
| `<Bobsleigh>` / `<GoKarts>` | **NONE YET** | the stock circuit, no compile |
| the twelve **themed** circuits — `Bassline`, `DeepDrift`, `EmberWings`, `GearworksExpress`, `LavaTubeRun`, `MagmaRun`, `MagneticRide`, `MineTrainCoaster`, `MoonlitBarge`, `OceanTunnelSlide`, `ReefRacer`, `WyrmsHollow` | **NONE NEEDED** — each ships its OWN `DEFAULT_PIECES` | the component's own circuit compiles. **All twelve verified 2026-07-26 through the real `compileTrackPieces`: `ok`, `closed: true`, 0 synthesized, 0 warnings** (`node harness/park-eval/probe-tracked-roster.mjs`). |

**AUTHOR YOUR OWN CIRCUIT — AND VERIFY IT.** Every spline rig below accepts a
`pieces` array, and shipping without one means your `<LogFlume>` is the *same
flume* as in every other park that ever mounted it. **The one exception is
`<Monorail>`: use the published four-platform ring VERBATIM** (a hand-authored
list once synthesized 52 % of its arc and shipped an unboardable ride).

The risk is real and so is the cure. An improvised list does not fail loudly: the
compiler SYNTHESIZES a Dubins return leg, and a synthesized closure over **40 % of
the authored length is FATAL** — translucent red, NEVER registered, no station, no
queue, and the category you thought you filled reads EMPTY. Measured: one park lost
BOTH tracked rides that way in one file.

**So compile and check it at module scope, where you can still act on the answer:**

```ts
const out = compileTrackPieces(MY_PIECES, { profile: 'flume', start: [0, 0.6, 0], bounds: SIZE });
console.log('[park] flume', { ok: out.report.ok, fatal: out.report.fatal,
  synthesized: out.report.synthesizedCount, arc: out.report.arcLength });
```

Land the last authored piece **~0.3 u short of the start, on the station axis**, and
the closure has almost nothing to invent. If it still fails, fall back to the stock
layout by dropping the `pieces` prop — a stock ride that registers beats a custom one
that renders red.

The two call-site mechanisms, both verified 2026-07-26: Two mechanisms, both
verified 2026-07-26, and neither needs anything authored:

- **GUARDED** (`LogFlume`, `RiverRapids`, `Chairlift`, `Bobsleigh`, `GoKarts`,
  `Monorail`) — the call site is `if (opts.pieces) { … }`, so with no `pieces`
  prop `compileTrackPieces` is **never invoked at all**. `<LogFlume position={…}
  register={{…}} />` is a registered, rated, WATER-category ride with **zero
  closure risk**. A verified custom `<LogFlume>` circuit is *commissioned and
  pending* — until it appears here, there is nothing to copy.
- **OWN DEFAULT** (the twelve themed circuits above) — the call site is
  `opts.pieces ?? DEFAULT_PIECES`, so the compile runs on the component's own
  list, and every one of those lists was measured clean.

**This is what makes §4.0-E's five-circuit roster affordable**: five or six
circuits cost five or six one-line elements, and only the two coasters need the
§4.0 treatment.

If you want a water ride with no track at all, **`<PaddleBoats>`** is a flat rig
that builds its own pond (bank r 2.5, bed r 2.42) and is on the never-used list,
so it pays novelty too. All three of `LogFlume` / `RiverRapids` / `PaddleBoats`
**build their own water and go on DRY FLAT LAND** — never on the composed lake,
or the wet-pad guard fails the park (§3).

**THE PAPER CHECK for any `pieces` list you were about to write anyway:** sum the
authored run lengths from §4's run-length table, walk the cursor, and ask whether
the LAST piece leaves it **heading within ~30° of the station entry straight and
within ~3 u of the start**. If it does not, the closure will exceed 40 % and the
ride will not register. Pointing AT the station from mid-park is ~180° wrong
(§0 check 2) and is how both of the failures above were authored.

#### 4.0-E THE CIRCUIT ROSTER — how many tracked rides, and where they go

**WHY THIS SECTION DID NOT EXIST UNTIL 2026-07-26, because the cause matters.**
Every block above is written in the singular — "*THE* flagship", "*the* ring",
"*the* coaster" — and RUBRIC.md's Thrill axis scored one field,
`thrill.flagshipExcitement`, off one ride. So a park with one excellent coaster
scored *exactly the same* as a park with three, and no rule, checklist item or
axis ever asked for a second circuit. **Measured, 24-park corpus
(`node harness/park-eval/probe-tracked-roster.mjs`):**

- **16 of 20 probed parks registered exactly ONE coaster.** 3 registered none.
  Exactly one (`hollowmere2`) registered two.
- The flagship figures cluster on two numbers, because everyone copies the same
  two shelves: **E 6.06 in ten parks (§4.0-A mounted), E 5.27 in four (§4.0-B).**
  **`inversions` is 0 in all fifteen rated parks — §4.0-C has never shipped.**
- Registered CIRCUITS at size 128: median **4**, max **8** (`r13b`).
- **14 of the catalog's 27 circuits have NEVER shipped.**

**THE REQUIREMENT, at size 128.**

| | required | measured basis |
|---|---|---|
| **coasters** | **2**, from **DIFFERENT §4.0 archetypes**, each `rateCoaster`-measured with its line pasted into the §0 header, and **the second one must itself rate E ≥ 4.0** | two §4.0 circuits measured clean end-to-end offline on `skeleton-b`'s row; a third also measured clean but with only **0.02** relief margin. The E 4.0 floor sits in the empty gap between the legacy shelf's ceiling (**1.11**) and §4.0's floor (**5.27**) — `hollowmere2` is the only corpus park with two coasters and its second is a legacy filler at **E 1.1**, which does not count |
| **total circuits** | **5**, spanning **≥ 3** of the five families `coaster / water / transport / dark / tower` (the monorail is one of them) | four corpus parks already do it (`r12a` 5/4, `r13a` 6/5, `r13b` 8/5, `r14a` 5/4) — one above the corpus median of 4, two under its max of 8 |
| **novelty** | **≥ 1** circuit off the never-used shelf | 14 of 27 circuits unused; all 14 ship a working default |
| **intensity spread** | **the PARK spans all three of `probe.thrill.intensityMix` (`mixComplete: true`), and the two coasters differ on `rateCoaster`'s own `ratingBand`** | see the rewritten clause below — the two halves come from different places and neither is optional |

**THE INTENSITY-SPREAD CLAUSE, REWRITTEN 2026-07-26 — THE OLD ONE WAS
UNSATISFIABLE AND WE SHOULD HAVE CAUGHT IT ON THE ARITHMETIC IN ITS OWN CELL.**
It read *"the two coasters in DIFFERENT intensity bands (`≤ 3` gentle / `≤ 6`
moderate / `> 6` intense)"* and then cited §4.0-B as *"I 6.25 moderate"* — but
**6.25 > 6, so B is `intense` under the very bands the clause defines.** Re-measured
through the real `rateCoaster` on 2026-07-26 (cars per each archetype's VERIFIED
line, bank 0.7): **§4.0-A I 9.32 · §4.0-B I 6.25 · §4.0-C I 9.55 — all three are
`> 6`.** Every §4.0 archetype is. **So no pair of §4.0 coasters could ever satisfy
it**, and `probe.mjs` says so: it hard-codes the same `≤3 / ≤6 / >6` split at
`probe.mjs:363`, so on a correct A+B park `thrill.secondDistinctBand` reads
**false** and `thrill.coasterIntensityBands` reads **`["intense"]`**. The clause was
a permanent fail with no legal move. **THE SPREAD MUST COME FROM SOMEWHERE ELSE,
AND IT DOES — from two different places, so say which:**

| band | WHERE IT COMES FROM | how it is measured |
|---|---|---|
| **gentle** `I ≤ 3` | **the FLAT/TRACKED roster.** A carousel, a wheel, a barge, a chairlift, the monorail itself — the `intensity={n}` you REGISTER, `n ≤ 3`. **No coaster can supply this band.** | `probe.thrill.intensityMix.gentle > 0` |
| **moderate** `I 4-6` | **also the flat/tracked roster** — a dark ride, a rapids, a simulator at `intensity={5}`/`{6}`. §4.0-B is the only coaster anywhere near it and it is not in it | `intensityMix.moderate > 0` |
| **intense** `I > 6` | **the COASTERS, and that is their job.** Any §4.0 archetype lands here on its own | `intensityMix.intense > 0` |

**`intensityMix` IS COMPUTED OFF THE REGISTERED `intensity` PROP OF EVERY RIDE, NOT
OFF `rateCoaster`** (`probe.mjs:330-337`), which is exactly why the roster can supply
bands a coaster cannot. RUBRIC.md's axis-14 *"park thrill MIX"* point (1 pt) reads
`thrill.mixComplete`, and the ROSTER term reads `thrill.intensitySpread` (max − min
over the RATED coasters) — **neither one reads `secondDistinctBand`, so nothing was
ever scored off the broken clause; it was only unachievable advice.**

**AND THE TWO COASTERS DO STILL HAVE TO DIFFER, ON THE FIELD THAT WORKS.**
`rateCoaster` publishes `ratingBand`, the RCT2 ride-window word
(`SplineRideKit/ratings.ts:174`, `floor(rating·100 / 256)` into
gentle / moderate / thrilling / intense / extreme — i.e. **gentle < 2.56 ·
moderate 2.56-5.11 · thrilling 5.12-7.67 · intense 7.68-10.23 · extreme ≥ 10.24**).
On that scale the archetypes DO separate: **§4.0-B is `thrilling` (6.25) while
§4.0-A (9.32) and §4.0-C (9.55) are `intense`.** So the old conclusion survives its
broken premise — **pair A+B or C+B, never A+C** — and the check is
`ratedCoasters[0].ratingBand !== ratedCoasters[1].ratingBand`, never a hand-rolled
threshold. WORKED, §3.1-A: `intensityMix` gentle 4 / moderate 4 / intense 1 →
`mixComplete: true`, and C `intense` vs B `thrilling` → two `ratingBand`s. Both
halves, from where each one actually comes from.

At size 48 the plot cannot hold two §4.0 rings (§4.0-A alone spans 37.6 × 37.6
of a 48-u plot): ship ONE §4.0 archetype plus **three or four no-compile
circuits**, which is the whole point of the next block.

**THE SECOND COASTER IS THE ONLY EXPENSIVE ONE. EVERYTHING ELSE IS ONE LINE.**
Only `<Coaster>`, `<TrackRide>` and `<SplineCoaster>` REQUIRE a `pieces` array.
Every other circuit in the catalog either **guards the call** or **compiles its
own shipped default**, and both were verified on 2026-07-26:

| mode | rides | what happens with NO `pieces` prop |
|---|---|---|
| **guarded** (`if (opts.pieces)`) | `LogFlume`, `RiverRapids`, `Chairlift`, `Bobsleigh`, `GoKarts`, `Monorail` | **`compileTrackPieces` IS NEVER CALLED.** No closure report, no synthesized Dubins leg, no `report.fatal`, no translucent red. `<LogFlume position={…} register={{…}} />` is a registered, rated WATER ride. **ZERO closure risk.** |
| **own default** (`opts.pieces ?? DEFAULT_PIECES`) | `Bassline`, `DeepDrift`, `EmberWings`, `GearworksExpress`, `LavaTubeRun`, `MagmaRun`, `MagneticRide`, `MineTrainCoaster`, `MoonlitBarge`, `OceanTunnelSlide`, `ReefRacer`, `WyrmsHollow` | the compile runs on the component's OWN list. **All twelve were compiled through the real `compileTrackPieces`: all twelve `ok`, `closed: true`, 0 synthesized, 0 warnings**, track spans 8.5 × 6.1 u (MoonlitBarge) to 27.3 × 25.6 u (LavaTubeRun) — every one SMALLER than §4.0-B's 28.9 × 30.4. |
| **own rig** (no `pieces` prop at all) | `PaddleBoats`, `GhostTrain`, `HauntedMansion`, `ObservationTower`, `Helicycles`, `MotionSimulator` | builds its own geometry. Nothing to author. |

**OMITTING `pieces` IS THE SAFE DEFAULT AND THE CHEAP ONE.** It is not a
compromise, it is the recommendation for every circuit except the two coasters.
None of these feed `<Terrain coasterPts>` either, so they cost the park **no
relief** — which is the constraint that actually binds (below). Reach for the
never-used shelf first: `MineTrainCoaster`, `LavaTubeRun`, `WyrmsHollow`,
`Bassline` (coaster); `DeepDrift`, `MagmaRun`, `OceanTunnelSlide` (water);
`MagneticRide`, `GoKarts` (transport); `GearworksExpress`, `HauntedMansion`
(dark); `Helicycles`, `MotionSimulator` (tower).

**PLOT AREA IS NOT WHAT LIMITS THE ROSTER — `coasterPts` IS.** `r13b` carried
**3823 u² of ride bounding box, 23 % of a 128 plot, across 7 circuits, and
passed the gate.** What limits the number of §4.0 *archetype* circuits is that
each one must feed `<Terrain coasterPts>`, which caps every peak it passes over,
which drives the composed relief toward the `terrainFlattened` conjunction
(kept < 0.70 **AND** stdH < 0.76 — both halves, §0). `skeleton-b` shipped that search at
**kept 0.73 against the 0.70 floor: 0.03 of headroom** — the SOUTH-QUEUE repair has
since taken its one-coaster baseline to **kept 0.81**, so the RANKING of the nine below
holds but the absolute numbers do not: re-measure before you publish a start. Nine
candidate second-
circuit placements were measured through `probe-skeleton.mjs`, and **three were
`terrainFlattened`-FATAL while two moved a water body 25–77 u
(`waterRePicked`, also FATAL)**:

```
 archetype @ start        kept  stdH   water moved   verdict
 (flagship only)          0.73  0.72   0 / 0         baseline
 §4.0-A @ [−2.4, −38.4]   0.73  0.72   0 / 0         CLEAN  ← published slot
 §4.0-C @ [−2.4, −38.4]   0.73  0.72   0 / 0         CLEAN  ← published slot
 §4.0-B @ [−1.2, −33.6]   0.72  0.72   0 / 0         clean
 §4.0-C @ [33.6,  31.2]   0.72  0.72   0 / 0         clean
 §4.0-B @ [−1.2,  31.2]   0.73  0.73   secondary 25  REJECT waterRePicked
 §4.0-B @ [33.6, −36.0]   0.90  0.81   77 / 64       REJECT + 4 cells in water
 §4.0-B @ [33.6, −33.6]   0.63  0.65   0 / 0         REJECT terrainFlattened
 §4.0-B @ [−21.6, 21.6]   0.61  0.64   0 / 0         REJECT terrainFlattened
```

**So the second circuit's position is MEASURED, never chosen by eye.** The loop
is `node harness/park-eval/probe-skeleton.mjs samples/<park>.tsx` (~2.3 s) with
BOTH point sets in `coasterPts`, and you read four lines: `reliefFloor.kept`,
`reliefFloor.stdH`, `centroid MOVED`, and `in composed water`. It is not the
gate — finish with `probe.mjs` — but it is what tells you a placement is dead
before you spend two minutes finding out.

**THE FIVE GEOMETRIC RULES FOR A SECOND CIRCUIT**, in the order they bite:

1. **PUBLISH ITS CORRIDOR KEEP-OUT IN PLOT COORDINATES, exactly as §4's
   keep-out block requires for the first one.** Two circuits means two rects in
   the §0 header, each `= archetype table offsets + its own start`, and every
   street node and boulevard leg checked against BOTH.
2. **THE TWO BOUNDING BOXES MUST BE DISJOINT.** Rings are hollow, but the
   `footprints` SAT check is not, and nothing offline can confirm an overlap is
   safe. Both archetypes grow **WEST (−x) only** and straddle the start in z, so
   two circuits at the same `start.z` collide unless their starts are ≥ 30 u
   (B) / ≥ 38 u (A) apart in x — which usually does not fit. **Separate them in
   z instead**, which is what the published slot does.
3. **STAY OFF THE MONORAIL'S 16 GROUND CELLS** (§4.2-A's table: four deck pads,
   four queue tails, four anchors, three exit huts, the start pose). The beam
   itself flies at 2.6 u and may be crossed; the platforms may not. At the
   published ring start the two columns to avoid are **x ∈ [−1.2, 1.2]** (the
   N and S platforms) and **z = −8.4** (the E and W platforms).
4. **STAY OUT OF EVERY `<World>` RECT.** A circuit through a world's rect is a
   near-miss at best and a `crossTheme`/`worldNotBuiltOut` argument at worst.
5. **NEITHER CIRCUIT MAY SIT ON A FLANK** — `reliefBias inner` is 0.18, so the
   flanks carry ~2.4× the relief and a ring there crushes several ranges at
   once. This is the same rule as §4.0's "put the circuit in the plot CORE", and
   with two circuits the core is not big enough for both: the second one goes in
   the **mid-band between core and flank**, and you prove it with the four
   numbers above rather than by argument.

**THE PUBLISHED SECOND-CIRCUIT SLOT for `samples/skeleton-b.tsx`** (seed 1
temperate, size 128, flagship §4.0-B at `[15.6, 0.55, −2.4]`):

```tsx
// §4.0-A (or §4.0-C) as the SECOND coaster — the thrill flagship of the pair
const B2_START: V3 = [-2.4, 0.55, -38.4];
const B2_TAIL: XZ  = [3.6, -38.4];              // start.x + 6.0, same z
const { points: FLAG2_PTS } = compileTrackPieces(A_PIECES_40A, {
  type: 'steel', start: B2_START, heading: 0, bounds: SIZE,
});
// BOTH point sets go into the terrain pre-cap — this is not optional
<Terrain keepDry={GUARDS} coasterPts={[...FLAG_PTS, ...FLAG2_PTS]} />
```

- **footprint** §4.0-A: `x[−40.01, −2.40] z[−54.13, −16.52]`; §4.0-C:
  `x[−37.62, −2.40] z[−52.96, −16.16]`. Both inside ±63.3.
- **disjoint** from the flagship's `x[−13.32, 15.60] z[−15.67, 14.75]` by
  **0.85 u** in z (A) / **0.49 u** (C).
- **clear of the monorail**: max x −2.40 vs the S-platform column at x 0..1.2.
- **clear of the `emberfall` world** `x[−62.7, −40.8]` by 0.79 u (A) /
  3.18 u (C) — **prefer §4.0-C for that margin**, and C also earns the
  inversions no corpus park has ever shipped.
- **measured**: `reliefFloor.kept` **0.73** (= the one-coaster baseline) against
  the 0.70 floor, `stdH` 0.72, water centroids moved **0 / 0**, no hard cell in
  composed water, worst span lift **0.35**.
- **still to do in the park file**: `GHOST.pad` at `[−24, −27.98]` stands inside
  that rect and must move; the new queue tail at `[3.6, −38.4]` needs a street
  STUB off a junction (never a through street — §4.0's lane rule); and the
  keep-out rect belongs in the §0 header.

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

**THE SHORT ANSWER: copy §4.0.** `4.0-A` (E 6.12) or `4.0-C` (E 6.27) clears
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



---

## §4.2 THE PARK-SPANNING MONORAIL IS IN `rules/park-generation-monorail.md`

Split because this file outgrew a single design-system write; nothing was cut.
Rules files are ALL injected, so that file is already in front of you.
**EVERY PARK SHIPS A MONORAIL. `rules/park-generation-monorail.md` carries §4.2,
the verified §4.2-A GRAND CIRCLE (17 pieces, 4 platforms, size 128) and §4.2-B
the scaling rule with its second verified variant.** It is not optional reading.

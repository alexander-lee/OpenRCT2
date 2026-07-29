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
(`DemoPark` is still there as the COMPACT small-plot variant; it is NOT the
layout to copy.) **WAVE-8
SCALE NOTE: `<DistrictPark>` is pinned `size={48}`, so it is a QUARTER of the
default plot's width and a SIXTEENTH of its area.** Copy its DISCIPLINE — plans
before mounts, `buildParkNet` fusing set-piece sub-nets, pads on cell interiors,
a pieces-mode flagship — but do NOT copy its distances: on the default 128 every
spread figure in §0.3 is different, and its whole footprint would sit inside one
district.

**THE DEFAULT-SIZE WORKED EXAMPLE IS `harness/park-eval/samples/worlds-ref.tsx`**
— a size-**128** three-world park, `validatePark → ok: true`, zero failures,
5/5 on the Worlds axis (§3.1). When a distance, a separation or a spread figure
is in question, read THAT file, not `<DistrictPark>`'s 48-u numbers. The
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

## 0.0 THE ONE-LINE BRIEF — "make me a cool theme park"

**Assume you will be given NOTHING but that sentence.** No seed, no size, no
roster, no archetype, no queue arithmetic. **This book is the brief**, and a
prompt that spells any of it out is only repeating what is already here. Work
this order; every step names the section that governs it, and none of it is
optional or needs to be asked for.

> ### ⚠ 0.0-F YOU HAVE NO FILESYSTEM. A `§` OR A FILE PATH IS PROVENANCE, NOT A LOOKUP.
>
> **You receive injected rule TEXT and loaded SKILL BODIES — not a checkout of this
> repository.** Round 13's park A searched the project for `monorail-ref` and for
> `park-generation-rides.md`, found NEITHER, and reported: *"The rules files and
> reference samples aren't in the project (they live in the design system bundle)."*
> It then improvised the mandatory monorail from memory and wrote
> `<Monorail start=… heading=…>`, two props that do not exist.
>
> Two consequences, and they bind on the AUTHOR of these documents as much as the
> reader:
>
> 1. **Every code block a park needs must appear in the text you were given.** If a
>    block is only reachable by cross-reference — "see §4.2-A of
>    `park-generation-rides.md`" — then for you it does not exist, and you must
>    **NOT reconstruct it from memory.** That is exactly how `start`/`heading`
>    happened. The blocks that matter are inlined at their point of use: §3.1's
>    skeleton carries the ring's full JSX, the five assertions, `place`, the
>    `*Scenery` export table and the roster arithmetic.
> 2. **Cite a file path only as evidence.** `harness/park-eval/samples/*.tsx`,
>    `probe-*.mjs` and `components/**` line numbers say *where a number was
>    measured*. They are never an instruction to open anything.
>
> If you find yourself needing a block that is not in front of you, the correct move
> is to **use only what is** — a smaller verified park beats an improvised prop.

**STOP-CHECK ZERO — BEFORE ANY OTHER LINE, INCLUDING THE HEADER.** Write down,
in prose, **your three `WORLD_THEMES` presets and their three `<World>` rects**
(id, centre, half-extents). Three presets, three rects, on the page, before you
plan a street or pick a seed. A park that reaches its first JSX line without
those six facts written down ships `worlds.declared: 0` and loses 5 points it
can never recover at the end (§3, axis 16). This costs one sentence.

**THE SKILLS ARE A DEEP REFERENCE, NOT A DEPENDENCY — THESE RULES STAND ALONE.**
This design system ships five skills (`park-composition`, `park-skeletons`,
`coaster-pieces`, `ride-and-stall-roster`, `park-troubleshooting`). Read them if
your harness surfaces them: `park-skeletons` before you author a NODES table,
`coaster-pieces` before any `pieces` array, `ride-and-stall-roster`
when you pick the line-up, `park-troubleshooting` when `validatePark` reports
anything. **But do not plan on them loading, and never treat a missing skill as
permission to improvise.** Round 12's park B was told to load all four; its own
tool trace shows **27 tool actions and ZERO skill loads** — the narration said
"the rules say" and never named a skill, and five turns went on hunting for
source files a loaded skill would have handed over. Every skill-unique behaviour
was missing from the park. So everything that must not be got wrong is inlined
HERE — the §4.2-A monorail block (§0.0 step 10), the archetype rules (§4.0), the
prop-value ban (§0 check 22), the queue construction (§0.4). **If a rule and a
skill ever disagree, the rule in these `park-generation*.md` files wins.**

1. **`<Park>` AT THE DEFAULT SIZE — omit the `size` prop** (it is **128**).
   Never shrink the plot to make a layout easy: every threshold in this book is
   quoted at 128, `<DistrictPark>`'s 48 is the COMPACT variant, and a 48 park
   shipped against a 128 rubric loses on spread, roster and world count at once.

   **A SMALLER PLOT IS NOT A SAFE HARBOUR — IT EXEMPTS NOTHING.** Round 12's
   park B pinned `size={48}` and licensed itself, in its own header, to skip the
   transport ring — *"monorail is the 128 requirement"* — and then declared ZERO
   worlds because it *"needs no monorail/3-world machinery to score"*. Both
   claims are false, and they cost 5 points plus the monorail deduction plus the
   whole TRANSPORT category:
   * **`<World>` regions are SIZE-INDEPENDENT.** A world is a rect with a theme,
     a ride, a stall and a scenery piece inside it; nothing in axis 16 reads
     `size`. `worlds.declared: 0` is **0/5** at 48 exactly as at 128.
   * **The monorail ring is required at EVERY size.** §4.2-B's scaling rule gives
     the radius for size N — there is a verified variant for 48/64/96/160/192, so
     "the block is written for 128" is a lookup, not an exemption.
   * A small plot **forfeits** worlds, the ring and plot-utilisation headroom
     while making nothing safer: every clearance, closure, queue-reach and
     terrain rule is unchanged, and the spread floors get HARDER to clear because
     the same rides must fit a sixteenth of the area.
   So: **omit the `size` prop — the default is 128** — and if you ever ship a
   smaller plot, ship it with the same three worlds and the same ring.
2. **Write the §0 HEADER COMMENT and do its arithmetic BEFORE the first line of
   JSX** — template below. The header is where you catch the bounds, the
   separation, the queue reach and the gate walk while they are still cheap.
3. **PIN a seed + climate from the §1 table** (§1). Every row lists **TWO water
   bodies** — plan around BOTH, and the table is **PRE-`keepDry`**: the guards
   re-pick the water, so **re-check every hand-placed cell with
   `park.isDryCell()` AFTER composition** (§0.17).
   **AND DO NOT WALK THAT ON PAPER — PASTE THE ASSERTION.** §1-W publishes every
   row's two basin boxes and centroids as the const **`SEED_ROW_WATER`** and ships
   **`assertKeepDryOffRow(KEEP_DRY, SEED_ROW)`**, which THROWS and names every
   offending cell, in the same form and the same place in the file as the
   cardinal-edge assertion. It also ships the **`<DryScatter>`** planting sieve, so
   a wet prop cell is DROPPED rather than §0-FATAL-REFUSED. Copy both. A single
   guarded cell inside either box — or within ~12 u of either centroid — RE-PICKS
   that water body and is §0-FATAL (`waterRePicked`); the paper walk has been
   attempted every round it was asked for and got it wrong every time, most
   recently round 13's park B, whose whole guard list was
   `const KEEP_DRY: XZ[] = [...NODES]` / `NODES.slice()` (**−7** across three axes,
   and it shipped again in round 14: dominant 74.5 u, secondary 70.2 u). Use
   `const GUARDS = keepDryOf(NET, SEED_ROW)` and pass GUARDS, never `NET.keepDry`.
   **GUARD ONLY WHAT YOU PAVE — a street node is not automatically a `keepDry`
   cell.** The first one-line-brief park transcribed
   `secondary inlet box x[−56..−21] z[23..39]` into its own header and then put
   16 `keepDry` cells at x −28.8, z 28.8-33.6 — *inside the box it had just
   written down* — moving the secondary body 70.7 u and failing the gate. If a
   district must live there, **pin a different seed row** whose boxes are clear
   of it; do not "plan around the shoreline" of a body your guards will move.
   **THE SAME LIST FLATTENS YOUR LAND, NOT JUST YOUR WATER.** Every `keepDry`
   cell and every `coasterPts` point CAPS the hill peaks near it, so a fat or
   badly-placed guard list ERASES the ranges the seed drew: two round-10 parks
   on the SAME seed 7 / coastal / 128 measured relief **11.26** and **5.50**
   purely on the difference between their guard lists, and the flat one read as
   a green field. Walk the row's "mountain ranges" column the same way you walk
   its water boxes, keep the guards out of those discs, and use **`noDress`**
   (which touches nothing) rather than `keepDry` (which MOVES the heightfield)
   where all you wanted was bare ground. The gate reports it as
   **`terrainFlattened`** and names the guard cells; check it up front with
   `node harness/park-eval/probe-relief-floor.mjs` or read
   `comp.report.reliefFloor` (§1).
   **AND WALK EVERY BUILT CELL AGAINST THE ROW'S `peaks`, NOT JUST YOUR
   `keepDry` LIST.** The two are different checks and only one of them is about
   guards: this one asks whether the GROUND under each structure is buildable at
   all. For **every ride: the pad, BOTH huts, the queue tail, the queue lane and
   the exit join** — plus every stall anchor and the restroom — read the §1 row's
   peak discs `(x, z) h R` and confirm the cell is outside every one. **The
   terrain gate charges ONE FAIL PER RECT**, so a single ride dropped inside a
   peak is not one failure but about eleven: round-11's park B put one teacups rig
   inside seed 91's published peak (15.2, −41.3) h 4.3 r 13.8 and collected
   **11 `terrain` FAILs** from that one placement (hut ×2, lane ×2, pad, exit hut
   ×2, exit lane ×2, join ×2) — and `ok: false`.
   **A PARK THAT SHIPS `<Terrain />` BARE HAS NOT DONE THIS CHECK.** With no
   `keepDry` list there is nothing to walk, so the check above is VACUOUSLY
   satisfied while the ground under the rides is whatever the seed drew. `keepDry`
   is not optional dressing — it is the list that says "I looked at the ground
   here". Guard what you PAVE or stand a structure on (§4.2's tight-list rule),
   and let that list BE the walk.
   **AND THE LIST MUST COVER THE DRESSING, NOT JUST THE NODES AND THE PADS —
   WHILE STILL NOT CLAIMING THE PLOT. Both halves, and they pull opposite ways
   (§0.18 has the full statement):** every `<Scenery>` / `<Placed>` cell you
   hand-site belongs in `keepDry` too — or must be re-checked with
   `park.isDryCell([x, z])` AFTER composition and MOVED if it comes back wet.
   Round 12's park B guarded nodes and pads only; the composer re-picked the body
   into the quadrant where a gazebo, a picnic table and a tree already stood, and
   all three were REFUSED as `plantedInWater`. But its over-broad guard elsewhere
   left the park at **2 % water against the temperate 4-22 % band**, so `terrain`
   FAILED as well, for a body too small to dominate its flank. **Guard your
   dressing; do not claim the plot.**
4. **WORLDS FIRST (§3).** Pick **≥ 3** presets from `WORLD_THEMES`. Build each
   as a self-contained district — a THEMED structural set-piece plus that
   world's OWN ride(s), stall and scenery from the §3 table — list every
   hand-placed cell in `worldPlan({ include })`, mount `<World plan>`, and only
   THEN connect them. **The five prefab LAND MACROS were REMOVED in v6.0:**
   never import `BrassworkFoundry` / `PulseDistrict` / `ThornwickGlade` /
   `EmberfallCaldera` / `TidewaterHollow` — the import alone is a black page.
5. **STREETS: `buildParkNet` is MANDATORY** (§0.15, §3.1) — **and it feeds
   `<Paths>` DIRECTLY; they are the SAME composition path, not two rival ones.**
   Copy this and the question never arises (the full block with ports is in
   §0.15):

   ```tsx
   // PIECES FIRST — the cardinal assertion RESOLVES port refs against it (§0.15).
   const PIECES = [HUB, VIEWPOINT, ...AVENUES];                 // the explicit ones
   // NAME THE WORLD ROWS, never `...WORLDS.flatMap((w) => w.pieces)`: `WORLDS` reads
   // the pads, the pads read `NET`, so it is declared BELOW the fuse and the flatMap
   // spelling is a `const` TDZ ReferenceError at module scope (skeleton-a.tsx:374).
   const ALL_PLANS: SetPiecePlan[] = [...PIECES, PULSE_ROW, WORKS_ROW, GLADE_ROW];
   const portCell = (ref: NetRef): XZ => {
     if (typeof ref === 'number') return NODES[ref];
     const [id, name] = ref.split(':');
     const p = ALL_PLANS.find((q) => q.id === id);
     if (!p) throw new Error(`EDGES references '${ref}' but no plan has id '${id}'`);
     return p.port(name);
   };

   // ASSERT CARDINAL EDGES on the RESOLVED cells, before the fuse. DO NOT SKIP THE
   // STRING REFS — the pre-wave-16 form did, which made it blind on exactly the
   // edges with a computed endpoint (round 13: ['pulseRow:W', 6] ran a diagonal).
   // AND USE A TOLERANCE: port cells are `tiles·0.6 + 0.6`, and 7*0.6+0.6 is
   // 4.799999999999999 in binary, so `!==` throws a FALSE diagonal on a legal park.
   const EPS = 1e-6;
   EDGES.forEach(([a, b]) => {
     const A = portCell(a), B = portCell(b);
     if (Math.abs(A[0] - B[0]) > EPS && Math.abs(A[1] - B[1]) > EPS)
       throw new Error(`diagonal edge ${a}→${b}: [${A}] → [${B}]`); });

   // A SET-PIECE'S `position` IS ITS SOLID CENTRE — never a node, never a queue
   // tail. One shared coordinate cost round 13 ~11 points (edgeThroughSolid ×2, a
   // dropped edge, an orphan island, accessibility, 5 footprints FAILs).
   // Full assertion: §3.1's skeleton, `assertNodesOffPieces`.
   assertNodesOffPieces(NODES, ALL_PLANS);

   // PORT-REFS: every piece id — from `pieces:` AND from `worlds:` — must appear
   // in EDGES as '<id>:<PORT>'; and a CHAIN piece (a port with prunable:false,
   // i.e. both of <Boulevard>'s) owes BOTH of its ends or it dead-ends in grass.
   const PORT_REFS = EDGES.flat().filter((x): x is string => typeof x === 'string');
   ALL_PLANS.forEach((p) => {
     const wired = new Set(PORT_REFS.filter((r) => r.split(':')[0] === p.id).map((r) => r.split(':')[1]));
     if (!wired.size) throw new Error(`set-piece '${p.id}' has NO port-ref in EDGES — it is DECORATION`);
     p.ports.filter((pt) => !pt.prunable).forEach((pt) => { if (!wired.has(pt.name))
       throw new Error(`chain piece '${p.id}' has no '${p.id}:${pt.name}' ref — that end of the carriageway dead-ends in grass`); });
   });

   // WALK THE GUARDS AGAINST THE PINNED SEED ROW — §1-W ships the const and the fn
   assertKeepDryOffRow(KEEP_DRY, SEED_ROW_WATER['1/temperate']);

   // `pieces: ALL_PLANS` — EVERY plan, world rows included. `worlds:` is OPTIONAL
   // (SetPieceKit/index.tsx:745) and unavailable here anyway: WORLDS reads the pads,
   // the pads read NET. What is mandatory is the PIECE SET, not the keyword (§0.15).
   const NET = buildParkNet({ nodes: NODES, edges: EDGES, pieces: ALL_PLANS, keepDry: KEEP_DRY });
   <Paths nodes={NET.nodes} edges={NET.edges} plazas={NET.plazas} bins={NET.bins} walkers={8} />
   ```

   That assertion is the ONE diagonal check that runs before the damage: a
   diagonal `edges` pair is a FATAL `edgeDiagonal` plan lint, and **the elbow
   `buildParkNet` inserts to repair it is a NEW node you did not plan — any pad or
   queue you sited by hand can land on it, and a corridor sweep can cross it.**
   That is what happened in round 12: one diagonal pair, one synthesised corner,
   then a hand-sited pad on top of it and a corridor FAIL through it — ~2 points
   and a cascade, from a coordinate a three-line assertion names for free. (It
   throws, and §0's "plan builders never throw" still holds: it can only fire on a
   park carrying a §0-FATAL lint you were required to re-lay anyway. **Fix the
   coordinate — never delete the assertion to get the page back.**)

   **STOP-CHECK — COUNT THE PORT-REFS. EVERY SET-PIECE PLAN MUST APPEAR IN `EDGES`,
   AND THE COUNT IS THE CHECK: you have N pieces, so `EDGES` needs at least N
   entries of the form `'<id>:<PORT>'`. Count them before you ship.** This is not
   the `<Boulevard>` rule restated — it binds **every** `bazaarPlan`,
   `fountainPlazaPlan` and `boulevardPlan` id in the park, including a plaza you
   add late and the world bazaars that came in through `worlds:`.

   **AND THE COUNT ALONE IS NOT ENOUGH FOR A CHAIN PIECE.** A presence count of
   ≥ 1 per piece PASSES on a `<Boulevard>` wired at one end only — round 13's park
   B referenced `'ave:A'` and never `'ave:B'`, and since **both** Boulevard ports
   are `prunable: false` (a structural carriageway end, which `buildParkNet` will
   never shorten), the avenue was built to full length and stopped **7.2 u short of
   the plaza**, in grass: `deadStreetNode`. The assertion above reads
   `pt.prunable` off the plan, so it covers any future chain piece for free. And
   **build both endpoints OFF the neighbours** —
   `boulevardPlan({ from: HUB.port('W'), to: MARKET.port('E') })` — so the cells
   MERGE in the fuse and cannot be 7.2 u apart in the first place.

   **A PIECE PASSED ONLY VIA `pieces:` OR `worlds:` IS DECORATION, NOT A PLACE.**
   `pieces:`/`worlds:` gets the piece's own interior sub-net into the graph; it does
   NOT connect that sub-net to your streets. Nothing joins them but a port-ref in
   `EDGES`, so an unreferenced piece composes as an ISLAND: its stalls are
   unreachable, its plaza is not on the walk, and the gate says
   `netWarnings: node … is in a SEPARATE island — no walkable route from the gate
   street`. **This was round 12's single biggest loss, ~9 points.** That park's
   `EDGES` referenced `hub:N`, `hub:E`, `hub:W` and **nothing else** — four pieces
   (`pulseRow`, `worksRow`, `gladeRow`, `viewpoint`) had zero port-refs — and the
   consequence chain was: **2 orphan islands · gate-reach 103/127 = 0.811 · three
   Pulse Market stalls no guest could reach · one `edgeThroughSolid` · and
   accessibility 1/10.**

   And note what "wire by PORT" excludes: **an edge into a piece's POSITION is not
   a port-ref.** That park's one attempt at wiring its second plaza was
   `[10, 27]` where node 27 *was* `viewpoint`'s own centre — straight through the
   fountain basin — which `buildParkNet` cut and retied to `'viewpoint:W'` as a
   §0-FATAL `edgeThroughSolid`. Write `'viewpoint:W'` yourself.

   **AND CALL `buildParkNet` EXACTLY ONCE. Two fuses is a prohibition, not a
   style.** Declare EVERY piece — including the plaza you thought of last — in that
   single `pieces:` array, and pass the SAME net to `offPathCell` that `<Paths>`
   receives. Round 12 built `NET` (no viewpoint plaza) and `NET2` (with it), fed
   every `offPathCell` call from `NET` and `<Paths>` from `NET2`: the restroom and
   **every scenery and tree cell in the park** were cleared against a net missing a
   116 u² plaza, so "clear" meant nothing there. It also pays the whole composition
   cost twice — a second fuse over a 27-node graph with four set-pieces is a
   measurable settle delay for zero benefit. One fuse, one `NET`, everywhere.

   A hand-rolled NODES/EDGES lattice is a REJECTED layout. Wire set-pieces by
   **PORT** (`facing: { port, toward }`), never by position or centre; `<Bazaar>`
   has **only W and E** ports (the aisle axis). Boulevards run **N/S or E/W
   only**. Close a **circulation LOOP**, not a star of spurs.

   **AND `<Paths>` MUST CARRY `plazas` — the one absent prop cost 2.75 points.**
   `NET.plazas` is where every open space in the park comes from: a park that
   omits it measures `openSpace.count 0` / `plazaRects 0` and scores **zero on
   axis 15's open-space point AND axis 2's plaza point**, however many plazas it
   *looks* like it has. Ship **≥ 2 plaza rects, the largest ≥ 8 u², with
   DIFFERING areas** (`areaSpread ≥ 1.8` — two identical squares fail the
   spread), count them in the header's `PLAZAS` line, and remember that a
   `<FountainPlaza>` publishes its own rect into `NET.plazas` for free, so two
   plaza set-pieces of different `tiles` satisfies this by construction.

   Three more things that cost the first one-line-brief park real points, all
   avoidable on paper:
   * **EVERY `boulevardPlan` needs `avoid` covering EVERY street node its
     carriageway meets — its own TWO ENDPOINTS included, not just T-junctions —
     at `clear: 2.6`.** A `<Boulevard>` plants its own verge trees at ±2.45 u;
     where another slab (or the gate spur) runs under one, that is a hard
     `scenery` FAIL naming the boulevard's own tree. The first park lost it on
     `gateAve`'s node 0, the gate cell itself.
   * **Never author a spine node within 2.4 u of a `<Bazaar>`'s stall rows** —
     wire to its `W`/`E` PORTS only. Two `padNearStreet` lints in that park were
     a hand-authored node landing beside the bazaar's own stalls.
   * **Ask for only the ports you will wire** (`ports: ['N','E','W']`). An
     unwired port is PRUNED and the prune is reported.
6. **ENTRANCE/EXIT: leave `exit`/`exitDir` UNSET** on every ride so the chassis
   derives the RCT2 pair (§0.4b). A missing or unroutable exit path is a HARD
   `accessibility` failure.
7. **QUEUES ARE CONSTRUCTED FROM THE TAIL OUTWARD — NEVER FITTED TO THE PAD
   (§0.4).** **PLANT THE TAIL FIRST**, as a real authored street node (a member
   of your `NODES` list or a set-piece PORT), and derive everything else FROM it,
   in this order — with `out` = the unit direction from the TAIL toward the ride:

   ```
   pad    = assertPadFlat(offPathCell(NET, tail + out·(minReach(c) + 2.4), { clear: padMarginOf(rig) }))
                                                      // the ride's `position` — the RESULT, always
            //  minReach(c) = laneLenOf(c) + 0.35 + 0.62 + 0.50 + 0.45; `front` is NOT yours
            //  cap 4 → 5.26 · 6 → 6.38 · 8 → 7.50 · 10 → 8.62 · 12 → 9.74, and ASSERT it
            //  TWO lattice cells, not one — see the boardPoint note under step 7 below
   anchor = tail + out·(laneLenOf(c) + 0.35)           // the queue HEAD
   dir    = −out                                       // `queue.dir` runs head → tail
   ```

   **THE PAD IS NOT `tail + dir·laneLen`.** That is the candidate, and it lands on
   the street you hung the tail off — the tail's own lattice column. Round 12's
   park B shipped exactly that expression and put **four pads at 0.00 u from the
   slab** (four `padNearStreet`/`padOnStreet` lints, ~4-5 points), while
   `offPathCell` appeared NOWHERE in the file even though every lint printed the
   call AND the answer it would have returned. **Only the queue LANE may touch a
   node; the PAD may not.** (Two exemptions, both because the geometry is already
   verified: a §4.0 archetype's `start` pose and the §4.2-A monorail's `position`
   are PUBLISHED POSES with their tails and clearances measured — copy those
   verbatim and do NOT put them through `offPathCell`. Everything you site
   yourself — every flat-ride pad, stall anchor, restroom and prop — goes through
   the call.)

   **NEVER compute `anchor` from the pad.** That single inversion is the biggest
   scored loss in the corpus: it lands the derived TAIL on top of the machine and
   caps ride spacing at **0/8**. Audited tail → pad-centre minima —
   **cap 4 → 5.26 · cap 6 → 6.38 · cap 8 → 7.50 · cap 10 → 8.62 · cap 12 → 9.74 u**
   (author MIN + **TWO** lattice cells: 7.66 / 8.78 / 9.90 / 11.02 / 12.14; assert
   at MIN + one: 6.46 / 7.58 / 8.70 / 9.82 / 10.94) — and **write
   the row per ride in the §0 header** (§0.0-H) *and* assert it in `place`, because
   round 13 wrote the header and shipped a 4.43-u reach anyway. **`<Discotron>` and
   `<AetherBalloons>` both default to capacity 12,** so a court sized for a Carousel
   holds neither. On `<Coaster>`/`<FlatRide>` skip the arithmetic
   altogether: pass `queueTailNode={NET.node(TAIL)}`. **No two rides share a
   tail node**, and a tail that is not a cell in `NODES` means NO QUEUE WAS
   PLACED (§0.4).

   **AND IF YOU WRITE A HELPER FOR THIS, THE HELPER MUST END WITH `offPathCell` —
   A DERIVED PAD IS NOT A LEGAL PAD.** This is the round-12 version of the mistake
   and it is subtler than getting the formula wrong: that park's helper derived the
   pad tail-first, **correctly**, and then returned the raw sum. Three of its six
   pads therefore needed a `padOnStreet` auto-move, and the auto-moved Hollow Hall
   landed **on top of Pulse Spinner** — the park's single OBB overlap and **5
   `footprints` FAILs**, i.e. ride spacing capped at 0/8. Write the helper so the
   call cannot be forgotten:

   ```tsx
   // `front` IS NOT A PARAMETER — it is the component's frozen `layout.front`
   // (default 1.8; <Discotron> 4.0, <BumperCars> 2.6), unreadable while authoring.
   // ASSERT THE FLOOR INSTEAD. And the RIDE-PAD clearance is `padMarginOf(rig)`,
   // NEVER a constant: `max(1.8, padHalf + pathWidth/2 + 0.05)` on the rig's
   // RENDERED half-span, so it is a MESH property and capacity never enters it.
   // 3.2 is ONLY the compact-flat default (padHalf 2.6 ⇒ 2.6+0.55+0.05); the
   // audited demands run 2.95-8.4 u, and `rig` is why `place` takes four
   // arguments. The 12-row table is `-skeletons.md` §3.1-A step 5 (`PAD_MARGIN` /
   // `padMarginOf`) — paste it above this helper.
   // laneLenOf is imported from './components/ParkBuilder', NOT the Park barrel.
   const minReachOf = (c: number) => laneLenOf(c) + 0.35 + 0.62 + 0.5 + 0.45;
   //  cap 4 → 5.26 · 6 → 6.38 · 8 → 7.50 · 10 → 8.62 · **12 → 9.74**
   //  WORKED: cap 12 ⇒ laneLenOf 7.82; 7.82+0.35+0.62+0.50+0.45 = 9.74 u.
   //  Round 13's Discotron pad ended 4.43 u from its tail against that floor:
   //  9 padOnStreet lints, 6 footprints FAILs, spacing 0/8.
   // FOUR ARGUMENTS — `rig` is the COMPONENT NAME ('HauntedMansion'), and it is
   // what `padMarginOf` is keyed on. Dropping it is a ReferenceError at module
   // scope, i.e. a blank page. Identical signature in `-skeletons.md` §3.1-A.
   function place(tail: XZ, out: XZ, capacity: number, rig: string) {
     const clear = padMarginOf(rig);                    // NOT 1.8, NOT a flat 3.2
     const join = laneLenOf(capacity) + 0.35;
     const reach = minReachOf(capacity) + 2.4;          // the FLOOR + TWO lattice cells
     const cand: XZ = [tail[0] + out[0] * reach, tail[1] + out[1] * reach];
     const onStreet = (offPathCell(NET, cand, { clear }) ?? cand) as XZ;
     const pad = assertPadFlat(onStreet, clear, rig);   // ← THE LAST LINE
     const got = Math.hypot(pad[0] - tail[0], pad[1] - tail[1]);
     if (got < minReachOf(capacity) + 1.2)
       throw new Error(`pad [${pad}] sits ${got.toFixed(2)} u from its tail — the cap-${capacity} floor is ` +
         `${(minReachOf(capacity) + 1.2).toFixed(2)} u (the ${minReachOf(capacity).toFixed(2)} u board-pad floor plus ` +
         `one cell for the rig's own board offset). Move the TAIL outward or open the court.`);
     return { pad, anchor: [tail[0] + out[0] * join, tail[1] + out[1] * join] as XZ,
              dir: [-out[0], -out[1]] as XZ };
   }
   ```

   **`minReachOf(cap) + 1.2` IS NOT ENOUGH — AUTHOR `+ 2.4` AND ASSERT AT `+ 1.2`
   (measured wave-17).** The floor is enforced against the **`boardPoint` pad**, and
   on a `composableRide` that pad is NOT at `position`: it sits at `position` +
   rotated **`layout.board`**, and `layout.board` points out the rig's local **+z**,
   which is the face the queue runs into — i.e. **back toward the tail.** So the
   distance the validator measures is `tail→position − board.z`, always SHORTER than
   the reach you authored. `<Discotron>` ships `board: [0, STAGE_H, 1.4]`
   (`components/Discotron/index.tsx`), so at cap 12 a `reach = minReachOf(12) + 1.2`
   = 10.94 pad put the boardPoint **9.54 u** from its tail against the audited
   **9.74 u** floor and took a `footprints` FAIL — *"entrance hut overlaps
   boardPoint pad"* — on arithmetic that looked correct in the header. `board` is
   frozen into the component exactly as `front` is and is equally unreadable while
   authoring, so **do not look it up: author two cells of slack and assert one.**
   (Skeleton B, below, ships this `place` verbatim.)

   `offPathCell` audits the streets, not your other rides, so still check the
   returned pads against each other at pitch ≥ 6 u (§0.14). The two exemptions are
   unchanged and are the ONLY two: a §4.0 archetype's `start` pose and §4.2-A's
   monorail `position`, both published poses with measured clearances.

   **STEP 7b — EVERY PAD, STALL ANCHOR AND PROP CELL GOES THROUGH `offPathCell`,
   one call, not an eyeballed margin** (§0.14, §0.19):
   `offPathCell(NET, [x, z], { clear: 1.2 })` for a prop, **`{ clear: 1.8 }`** for a
   BUILDING, **`{ clear: 0.75 }`** for the TREE SCATTER, and **`{ clear: padMarginOf(rig) }`**
   for a RIDE PAD (`max(1.8, bodyHalf + 0.55 + 0.05)`; 3.2 is only the compact-flat default —
   1.8 is under every flat-ride rig in the catalog, whose audited demand is 2.95-4.77 u). **"1.5 u off a node" READS SAFE AND IS 0.00 u FROM
   THE EDGE SLAB** — the slab is 1.1 wide, so its centreline owns ±0.55 and a pad
   half-width of 1.2 reaches 0.05 u past it at 1.5 u out. Round-11's park B
   authored all three themed stalls at exactly 1.5 u and needed a `padOnStreet`
   auto-move on every one; the auto-move is §0-FATAL and the number it moved them
   to is the number `offPathCell` would have returned for free.
8. **SIM (§0.3).** The NEAREST ride's queue tail — whichever queue is closest
   to the gate, the one that has to carry the smoke window, NOT every ride —
   sits within **15 u** of the gate cell (`[0, 63.6]` at 128), 20 u absolute
   maximum; other rides may sit much farther out. A ride's hut must not
   overlap its own pad.
9. **FLAGSHIP COASTER: copy a §4.0 archetype VERBATIM** — pieces, start pose,
   `heading`, the corridor table, and `queueDir` pinned to that heading.
   **THE ARCHETYPE ARRAYS, THE LEGAL START RANGES AT 128 AND THE `<Coaster>`
   WIRING BLOCK ARE ALL IN §4.0 OF `park-generation-rides.md` — copy from THERE.**
   (The `coaster-pieces` skill is the same material in more depth; read it if it
   loads, but §4.0 is sufficient on its own and is what you are scored against.)
   The
   archetypes **grow WEST; the start is the EASTmost point**, so respect the
   published LEGAL START range for the size you shipped. **ANNOTATE, DON'T
   CAST** — see §0.0-T below; an un-annotated array literal is 6 type errors.
   **CALL `rateCoaster` and paste its line into the header — never hard-code a
   `ratings=` prop** and never retype a figure from this book (§0.16, §4.1).

   **AND THIS RULE IS NOT ABOUT THE FLAGSHIP — IT IS ABOUT EVERY `pieces` LIST IN
   THE PARK.** `<Coaster>`, `<TrackRide>`, `<LogFlume>`, `<RiverRapids>`,
   `<Monorail>`, `<Chairlift>`, `<Bobsleigh>`, `<GoKarts>` — every
   ride that takes `pieces` compiles through the SAME `compileTrackPieces` gate
   with the SAME closure rule, so **every `pieces` list you ship is COPIED FROM A
   PUBLISHED BLOCK IN §4.** An improvised list does not fail loudly: the compiler
   SYNTHESIZES a Dubins return leg to close the circuit, and **a synthesized
   closure over 40 % of the authored length is FATAL — translucent red, NEVER
   REGISTERED, no station, no queue, and the CATEGORY YOU THOUGHT YOU FILLED IS
   EMPTY** with nothing in the report but a console line. Round-11's park B lost
   BOTH of its tracked rides exactly this way: `<TrackRide>` closed with **20.7 u
   of synthesized return against 31.1 u authored (66 %)** and `<LogFlume>` with
   **19.2 u against 25.5 u (75 %)** — −7 on thrill, −0.5 on roster, and an empty
   WATER category, from two hand-written arrays.

   **THE PAPER CHECK, before you mount anything with `pieces`:** sum the authored
   run lengths from §4's run-length table and walk the cursor; **if the LAST piece
   does not leave the cursor pointing back at the station straight (within ~30°
   of the heading you left the station on, and within ~3 u of the start), the
   closure WILL exceed 40 % and the ride will not register.** Pointing AT the
   station from mid-park is the classic version of this mistake and is ~180° wrong
   (§0 check 2).

   **AUTHOR `pieces` FOR THESE — THE STOCK LAYOUT IS THE SAME IN EVERY PARK.** `<LogFlume>`,
   `<RiverRapids>`, `<Chairlift>`, `<Bobsleigh>` and `<GoKarts>` each ship a
   working stock layout and only call `compileTrackPieces` **if you pass
   `pieces`** — so `<LogFlume position={…} register={{…}} />` is a registered,
   rated WATER ride with zero closure risk, and there is **no published flume
   circuit to copy** (§4.0-D has the table of what is and is not published). Only
   `<Coaster>`/`<TrackRide>` always need a circuit, and §4.0 has three.
10. **A PARK-SPANNING MONORAIL, EVERY TIME (§4.2) — THE BLOCK IS INLINED HERE SO
    COPYING IS CHEAPER THAN REASONING.** The §4.2-A four-platform block, the
    deck/tail/`queueDir` table and the per-platform a4b gate are all below and in
    `park-generation-rides.md` §4.2 — you need no skill to ship the ring.
    (`ride-and-stall-roster` covers the same ground plus the catalog; read it if it
    loads.) Every park ships one transport ring
    whose circuit passes EACH declared world, with a PLATFORM in each
    (§3/§3.1). **Do not weigh it, do not audit it, do not call it "the riskiest
    piece" and ship without it** — that is what the six-word-brief park did, and
    it cost the ride, the TRANSPORT category and a point of roster novelty at
    once.

    **AND IT IS NOW A PRE-BUNDLE GATE, BECAUSE THE PROSE FAILED TWICE.**
    `harness/park-eval/preflight.mjs` REFUSES TO BUNDLE a park at `size >= 64`
    with no `<Monorail>` — same class of gate as the missing `<Park roster>` prop,
    exit 1, no page, no `validatePark` line, no evidence. Round 13's park B
    reached for *"pragmatic simplifications… flat/self-contained rides where
    possible"* and dropped the ring after being told twice in this book that
    pasting §4.2-A is zero-risk. There is now no version of the park that ships
    without it. Paste this, at size 128, exactly:

    ```tsx
    const MONO_PIECES: TrackPiece[] = [ /* THE 17-PIECE RING — copy it VERBATIM from
      `rules/setup.md` §0-P.4, which is now the ONE canonical copy. It was duplicated in
      SIX files; five could drift and none was authoritative. The monorail is the one ride
      you must NOT re-author: a hand-written list once synthesized 52 % of its arc and
      shipped an unboardable ride. */ ];

    <Monorail
      position={[-42.6, 0, -9.7]} pieces={MONO_PIECES} beamY={2.6} loopSeconds={12} pinned
      name="Grand Circle Monorail" capacity={6} rideDuration={12} intensity={1} price={0}
      queue={{ anchor: [-40.81, -8.4], dir: [1, 0] }}
      register={{
        board: [-42.6, 2.6, -8.4],                       // platform 0 — W
        stations: [
          { label: 'North', boardPoint: [0, 2.6, 34.2],   queueAnchor: [0, 0.05, 32.41],
            queueDir: [0, -1], exitPoint: [-1.2, 0.05, 33.03], exitDir: [0, -1] },
          { label: 'East',  boardPoint: [42.6, 2.6, -8.4], queueAnchor: [40.81, 0.05, -8.4],
            queueDir: [-1, 0], exitPoint: [41.43, 0.05, -7.2], exitDir: [-1, 0] },
          { label: 'South', boardPoint: [0, 2.6, -51.0],  queueAnchor: [0, 0.05, -52.79],
            queueDir: [0, -1], exitPoint: [1.2, 0.05, -52.17], exitDir: [0, -1] },
        ],
      }}
    />
    ```

    The four platforms, and the STREET NODE each queue tail needs (capacity 6 ⇒
    `laneLenOf(6)` 4.46, join **4.81**). **W/N/E use `queueDir === left` = the ring
    INTERIOR; the SOUTH platform is the one exception and queues OUTWARD** — see
    "WHY THE SOUTH PLATFORM QUEUES OUTWARD" below, it is measured, not stylistic:

    | platform | deck centre | heading | `queueDir` | tail NODE (author it) | `queueAnchor` (the HEAD) |
    |---:|---|---:|---|---|---|
    | 0 W | [−42.6, 2.6, −8.4] | 0° | **[1, 0]** | [−36.0, −8.4] | [−40.81, −8.4] |
    | 1 N | [0, 2.6, 34.2] | 90° | **[0, −1]** | [0, 27.6] | [0, 32.41] |
    | 2 E | [42.6, 2.6, −8.4] | 180° | **[−1, 0]** | [36.0, −8.4] | [40.81, −8.4] |
    | 3 S | [0, 2.6, −51.0] | 270° | **[0, −1]** OUTWARD | [0, −57.6] | [0, −52.79] |

    **THE RING'S 16 GROUND CELLS — WALK THEM AGAINST YOUR SEED ROW'S WATER BASINS
    *BEFORE* YOU PIN THE SEED (§1).** These are the cells the ring puts in
    `keepDry`, and `keepDry` does not dodge water, it **pushes the body out of
    every cell you claim** — so one deck inside a basin shrinks that body and can
    fail `terrain` on a park where nothing else is wrong:

    ```
    decks          [−42.6, −8.4]  [0, 34.2]  [42.6, −8.4]  [0, −51.0]
    start pose     [−42.6, −9.7]
    queue tails    [−36.0, −8.4]  [0, 27.6]  [36.0, −8.4]  [0, −57.6]
    queue anchors  [−40.81, −8.4] [0, 32.41] [40.81, −8.4] [0, −52.79]
    exit huts      [−1.2, 33.03]  [41.43, −7.2]  [1.2, −52.17]
    ```

    **MEASURED, AND THIS IS OUR OWN TWO ARTEFACTS COLLIDING.** On **seed 7
    temperate** the West deck `[−42.6, −8.4]` sits **6.66 u** from the secondary
    tarn's basin centre `(−48.6, −11.3) r 12.6` — i.e. **2.64 u inside its 9.3-u
    waterline**. `keepDry` lifted it, the tarn shrank **405 → 144 u²**, `secondFrac`
    fell to **0.15 against the 0.16 floor**, and round 12 collected **two `terrain`
    FAILs** — which made `ok: true` unreachable. Seed 7 puts a tarn under that deck
    in **every** climate that draws one: temperate `(−48.6, −11.3) r 12.6`, desert
    `(−48.6, −11.3) r 7.8`, coastal `(−41.1, −9.6) r 7.5` (deck **1.92 u** from the
    centre). **Do not pin seed 7 for a park that carries the ring, in any climate.**
    On seed 7 coastal there is no rescue by translation either: the east river chain
    covers deck-E z ∈ (−34.1, 23.5), which contains the whole legal start range.

    **THE VERIFIED PINS, MEASURED — re-compose with ONLY the ring's `keepDry`
    cells and compare `waterCentre` / `waterCentreSecond` / `terrainSeed` /
    `probesTried` with the unguarded §1 row. THREE of the sixteen published rows
    are fully RING-CLEAN WITH DRY DECKS. The full table is in §1
    (`park-generation-composition.md`); the headline is:**

    | row | ring-only re-compose | verdict |
    |---|---|---|
    | **1 temperate** | bit-identical — probes 17→17, terrainSeed 16, viol 0, clamps 0+0; relief 12.13 / stdH 1.09 unguarded → 10.23 / 1.03 with the ring, **in band**; water 9.4 % (4-22), `secondFrac` **0.38** | **RING-CLEAN.** The default pin. It used to be published as paying an "unavoidable" non-fatal `terrainFlattened`; that was the SOUTH platform's queue side, it is FIXED, and the warning fires on neither reference skeleton — see the SOUTH-QUEUE note in §1 |
    | **31 temperate** | bit-identical — probes 1→1, terrainSeed 406; **relief 12.02 / stdH 1.32 with the ring, ABOVE the band**, so `terrainFlattened` cannot fire at all; water 17.8 %, `secondFrac` 0.36 | **RING-CLEAN, and the row to PREFER for a NEW skeleton** — its **13 % SW lake** occupies the whole south-west and forces a different plan, which is novelty for free |
    | **91 desert** | bit-identical — probes 1→1, terrainSeed 1186, viol 0, clamps 0+0; 8.15 / 0.76 → **0.63 stdH** with the ring (below band, non-fatal); water 2.4 %, `secondFrac` 0.22 | **RING-CLEAN.** What `samples/monorail-ref.tsx` ships |
    | 53 coastal | centroids hold — probes 1→1, terrainSeed 692 — **but the WEST DECK STANDS IN WATER (`h −0.06`)** | **UNUSABLE for a ring park.** A stable water centroid is not the same as a dry deck; this row passes the re-compose diff and still cannot carry the ring |
    | *the other 12* | **NINE move a water body 24–117 u**; the remaining three hold their centroids while changing the landform identity (83 temperate `terrainSeed` 1082→2052, 37 desert 484→581) or paying 36-90+ clamp discs (17 alpine, 5 alpine — the latter with 2 post-clamp violations) | **REFUSE all twelve.** Magnitudes from the 15-cell run: 42 alpine **117.1 u** · 71 temperate **96.4 u** · 3 desert **62.5 u** · 19 desert **61.6 u** · 7 coastal **60.9 u** · 8 alpine **55.8 u** · 23 coastal and 73 coastal **25.0 u** · 3 desert's secondary **24.2 u** |

    **PIN `seed={1} climate="temperate"`** for mid-band ground and water with real
    headroom, **`seed={31} climate="temperate"`** if you are deriving a NEW skeleton
    (its relief sits above the band, so the one warning skeleton B cannot shake is
    unreachable there), or **`seed={91} climate="desert"`** to match the reference
    park. **Check any row yourself with
    `node harness/park-eval/probe-guard-stability.mjs`** — and read the DECK
    HEIGHTS, not just the centroids, because 53 coastal is exactly the row that
    passes a centroid diff and drowns a platform. Either way **walk YOUR OWN street
    nodes too**: seed 1's SE corner lake reaches `[22.8, −27.6]` and its NW inlet
    chain reaches `[−31.2, 30.0]`, and the same re-compose with those two added
    moves the dominant body **77.3 u**.

    **THE FOUR QUEUE TAILS ARE DEAD ENDS BY CONSTRUCTION — DO NOT RUN A STREET PAST
    ONE.** Each tail sits 6.6 u from its deck along the lane axis, so a street that
    continues one more cell
    past `[−36, −8.4]`, `[36, −8.4]` or `[0, −57.6]` runs through the platform pad
    6.6 u further on and the gate says *`blockers`: street edge runs THROUGH … pad*
    — which is precisely how r12a failed. Author each of the three as a **leaf**:
    W and E approached from the ring's INTERIOR, **SOUTH from OUTSIDE, laterally
    along z −57.6**. **The NORTH tail `[0, 27.6]` is the one
    exception and the only one:** its deck is at `z 34.2` with the beam overhead, so
    a street row along `z 27.6` passes under the beam and misses the pad — the north
    tail may be a through node. Skeleton B relies on exactly this.

    **WHY THE SOUTH PLATFORM QUEUES OUTWARD — AND DO NOT "TIDY" IT BACK.** Inward,
    its tail `[0, −44.4]` and the street column paved down to it stand **5.3–5.8 u**
    from the summit of the composer's biggest range on seed 1 temperate: the guard
    list FLATTENS it (**h 8.59 → 0.83**), `terrainFlattened` fires and `stdH` drops
    under axis 7's **0.75** floor. Outward, measured on BOTH reference skeletons:
    `terrain.stdH` **0.73 → 0.81** and **0.71 → 0.79**, `reliefFloor.kept`
    **0.74 → 0.82** and **0.73 → 0.81**, the warning **GONE from both**, axis 7
    **7.5/9 → 9/9**, totals **96.18 → 97.68** and **91.90 → 93.40**, all fifteen
    other axes byte-identical, `ok: true` / 0 failures preserved. **The POSE is
    unchanged** — only this station's queue side flips.
    `capPeakForCells(p, keep, 0.35)` shaves a peak to `0.35 / s(d)`, so **a guard
    cell must stand ≥ 10.62 u from a summit to cost that peak nothing**; the deck
    `[0, −51.0]` is 9.70 u out and cannot move, so 3.45 of the 8.59 survives — this
    pose's ceiling, and enough. **Do NOT shift the ring west to recover the rest**
    (it drops the West deck 4.2 u inside a world rect and trades `crossThemeCount 0`
    for terrain). Bring the approach down the ONE dry corridor, **x ≤ −23** — the
    ridge's skirt is continuous from x −23 to x +38.6 and the far side is the SE
    lake (§1's pinned-row note).

    **AND `everyWorldTouched` IS MEASURED ON THE MONORAIL GROUP'S BOUNDING-BOX
    PERIMETER.** `probe.mjs` walks that perimeter and asks which world rects it
    crosses, so a world entirely outside `x ±44` / `z −52.8…36` reads
    `worldsTouched: 1` however grand it is. The fix costs nothing: give that world
    **one `include` cell aimed at the ring** (e.g. `[-38.4, 33.6]`). `include` cells
    are not placements — nothing is built on them, they are not guarded, and they
    only widen the rect the audit reads.

    **AND THE RING MAY BE TRANSLATED RIGIDLY IF A BASIN COLLIDES.** `position` is
    free anywhere in §4.2-B's published legal start range — x ∈ [−63.6, −21.6],
    z ∈ [−22.8, 20.4] at 128 — and every one of the 16 cells above, plus the
    corridor table, moves with it by the same offset in lattice multiples of 1.2.
    Translating the ring is a one-line edit and re-pinning the seed is a one-line
    edit; **shrinking a water body is neither.**

    **§0 STOP-CHECK — answer THREE, in writing, before you call the park
    finished:** *`<Monorail>` mounted?* · *does every declared world have a
    platform in it — i.e. platform count ≥ declared world count, and
    `probe.monorail.everyWorldTouched: true`?* · *do all 16 ring cells above clear
    both of your seed row's water bodies?* **If the answer to any is no, the park
    is not finished.** (Station count is free up to 4, so a 3-world park
    either keeps the 4th platform for the hub or drops one `station` back to
    `{ type: 'straight', length: 2.6 }` without touching the closure — §4.2-B.)

    **THE RING MUST PASS THROUGH *EVERY* DECLARED WORLD, NOT MOST OF THEM.** Four
    platforms and three worlds is not automatically a pass: the check is whether
    each world's RECT contains a deck, and round 12 shipped `everyWorldTouched`
    **2 of 3** with all four platforms mounted, because one world's rect sat off the
    ring. **`worldsTouched` IS A COUNT, NOT A LIST** (`probe.mjs:908` —
    `touched.length`): compare it to `monorail.worldsDeclared`, or just read the
    boolean `everyWorldTouched`, and take the NAMES out of the sibling
    `monorail.worldsTouchedIds`. If a world is missing, move that WORLD's rect onto
    the ring — the four deck cells are fixed by the block. The cheapest way to move
    a rect is the `include` cell above, not a relocated district.

    **§0 STOP-CHECK — `<Park roster={{…}}>` MOUNTED?** This sits beside the
    monorail check because it costs the same way: **without the prop
    `harness/park-eval/preflight.mjs` REFUSES TO BUNDLE the park, so nothing
    renders and there is no evidence at all.** Round 12's park wrote a correct §0
    header AND a correct roster line in the comment block and then never wired the
    prop — the round's whole evidence trail was lost to one missing attribute. It is
    `<Park roster={{ rides: [...names], stalls: N, categories: N }}>` (§0.16), and
    the names are counted off the `register={{…}}` calls that actually mount.

    **THE FALLBACK IS A FLOOR, NOT AN OPTION — the TRANSPORT category must never
    be empty.** The ring is the requirement, and dropping it costs axis 13's
    monorail deduction whether or not you replace it. This clause exists only so
    that a park which somehow arrives at the end without one does not ALSO lose a
    whole category: mount **`<Chairlift>` spanning two worlds** (piece-composed,
    `profile: 'monorail'`, one station, catalog defaults 6 / 10 / 2 / 3, reads best
    up a hill flank — and its `pieces` come from a published block like every
    other tracked ride). Read the two costs honestly: **skipping the ring = −1;
    skipping the ring AND leaving TRANSPORT empty = −1 and a category and the
    roster-novelty floor.** Neither is the plan. Paste §4.2-A.

    `beamY: 2.6` (the beam must fly **≥ 2.2 u** over the streets it crosses, and
    the 1.2 default does not), `price: 0`, `pinned`. **`position` is the START
    POSE, not the ring centre** — the ring grows **EAST** from it.

    **§4.2-A IS VERIFIED, SO PASTING IT IS A ZERO-RISK ACTION.** Measured:
    4 platforms, worst clearance **16.66** (gate 0.9), `closure.gap` **1.800**,
    **nothing synthesized**, `fatal` unset, **0 compiler warnings**, and
    `validatePark → ok: true` on the reference park. There is no risk to weigh
    here and no audit to run: **not** pasting it is the only move with a cost —
    a guaranteed **−1** plus an **empty TRANSPORT category** plus the roster-
    novelty floor. (What *was* fatal, twice, is IMPROVISING a circuit — see the
    §4.2 footnote. That has nothing to do with copying the verified block.)

    **AND THE RING NEVER CONFLICTS WITH A SEED'S WATER, SO DO NOT DROP IT TO
    DODGE A LAKE.** `beamY: 2.6` flies the beam over everything — streets, water,
    stalls — and the piers auto-extend to grade. Round-11's park B talked itself
    out of the ride with *"rather than fight seed-91's water intersecting the
    monorail ring, I'll DROP the monorail (transport category optional)"*: both
    premises are false — the water does not intersect an elevated beam, and the
    category is not optional. The only thing a lake asks of you is that the four
    platform QUEUE TAILS (ground-level street nodes) sit on dry cells.

    Check `probe.monorail`: `registered: true`, `circuitClosed: true`,
    `synthesizedCount: 0`, `everyStationQueued`/`everyStationExitConnected`
    `true`, `everyWorldTouched: true`. §4.2-B has the one-number scaling rule for
    any other plot size. **THE RING DOES NOT SATISFY THE GATE-WALK BUDGET** —
    even its closest platform sits 24 u from the turnstile, past the 20-u
    practical maximum, so pair it with a separate NON-monorail ride whose queue
    tail is inside 15-20 u of the gate to carry the smoke cycle (§0.3 check 1,
    §4.2). Do NOT claim in the header that guests "travel" on it to
    anywhere — RCT2 has no transport routing (§4.2's honest-limit note); claim
    only what `probe.sim.transfers` measures.
11. **Fill the ROSTER and the DRESSING to the §0.0b targets** — ride count,
    category spread, stalls, scenery, trees, spread. They are numbers, not
    aspirations.
12. **`validatePark` runs as the LAST build step** and its verdict plus one line
    per failure is logged (§6). **The measured failure catalogue with the exact
    fix per check is `park-generation-validation.md` §6, and §6.1 triages the case
    where there is NO verdict line at all** (`park-troubleshooting` is the same
    catalogue as a skill; read it if it loads). `ok: true`,
    **ZERO failures, ZERO fatal warnings**, coaster crash-free — or the park is
    not finished.

#### §0.0-T ANNOTATE EVERY TOP-LEVEL ARRAY — DON'T CAST, AND DON'T LEAVE IT BARE

TypeScript widens a bare array literal, so `[[0, 63.6], [6, 56.4]]` infers as
`number[][]` and **is not assignable to `XZ[]`**. Casting it (`as XZ[]`,
`as any`) silences the checker and hides real typos; leaving it bare is a type
error. **Annotate the declaration instead** — it type-checks AND still catches
the typo. This is not optional polish: the first one-line-brief park shipped
**6 type errors, every one of them a bare literal**, on a file whose own header
claimed "copied VERBATIM (no casts)".

```tsx
import type { V3, XZ } from './components/Park';          // ONE canonical line for both
import type { NetRef } from './components/SetPieceKit';   // net edge endpoints only
import type { TrackPiece } from './components/SplineRideKit';

const A_PIECES: TrackPiece[]        = ['station', { type: 'lift', height: 5.5 }, /* … */];
const A_START:  V3                 = [16.8, 0.55, -3.6];   // 3-tuple, not number[]
const GATE:     XZ                 = [0, 63.6];
const NODES:    XZ[]               = [[0, 63.6], [6, 56.4], /* … */];
const EDGES:    [NetRef, NetRef][] = [[0, 1], ['pulseRow:E', 2], /* … */];
const KEEP_DRY: XZ[]               = [[13.73, 56.4], /* … */];
```

Rule of thumb: **anything you hand to a design-system API gets a type
annotation on its `const`.** `as const` is acceptable where a literal must stay
narrow, but the annotation is preferred because it is checked in both
directions. `as any` / `as unknown as X` is never acceptable.

**AND NEVER CAST — OR SLICE — A `V3` INTO AN `XZ`.** `keepDry`, `NODES`,
`offPathCell` and every net API take `XZ` = **TWO numbers, `[x, z]`**; a start
pose is `V3` = `[x, y, z]`. So the guarded cell under a station is
**`[START[0], START[2]]`** — never `START.slice(...)`, never a cast. Round 12's
park B wrote `A_START.slice(0, 3) as unknown as XZ`, which type-checked itself
into silence and guarded **`[x, y]`** — the wrong cell entirely, at z = 0.55.
`slice` returns `number[]`, which is why the cast was needed at all: **the cast
is the tell.** Write the pair out.

```tsx
const FLAG_CELL: XZ = [A_START[0], A_START[2]];   // ✓ the station cell
// const BAD = A_START.slice(0, 2) as unknown as XZ;   ✗ [x, y] — guards nothing
```

**AND THE NO-CAST BAN COVERS THE COMPILE REPORT, WHICH IS WHERE IT KEEPS GETTING
BROKEN.** `compileTrackPieces` already returns `points: [number, number, number][]`
— i.e. `V3[]`, exactly what `<Terrain coasterPts>` and `rateCoaster` want. Casting
its report to a hand-written shape THROWS THAT AWAY and re-widens the points to
`number[][]`, which is not assignable to `V3[]`: one cast, one type error, and a
`coasterPts` prop the checker can no longer verify. The wave-12 park wrote

```tsx
// WRONG — the cast re-widens points to number[][] and breaks coasterPts
const FLAG_PTS = (FLAG_COMPILE && (FLAG_COMPILE as { points?: number[][] }).points) || undefined;
```

**DESTRUCTURE THE REPORT INSTEAD** — no cast, no re-declaration of a type the
kit already exports:

```tsx
const { points, report } = compileTrackPieces(FLAG_PIECES, { type: 'steel', start: FLAG_START, heading: 0 });
const FLAG_PTS: V3[] = points;          // typed, checked, ready for <Terrain coasterPts>
// and read `report.fatal` / `report.closure.synthesized` here rather than hoping
```

#### §0.0-H THE HEADER BLOCK — write it first, finish it last

```tsx
/* ═══ <PARK NAME> — §0 PRE-FLIGHT ═══════════════════════════════════════════════════════════
 * SIZE   128 (default, prop omitted)
 * SEED   1 / temperate — §1 row: corner lake ctr (41, −39) 6.8% · NW inlet ctr (−38, 31) 2.6%  [PRE-keepDry]
 *        RING WATER WALK (§0.0 step 10): all 16 §4.2-A ring cells vs BOTH bodies' waterlines —
 *        tightest = tail E [36.0,−8.4] → 24.93 u from (37.2,−33.3) wl 15.0 = 9.93 u dry ✓ (none wet)
 *        ring-only re-compose: probes 17→17, terrainSeed 16 unchanged, water BIT-IDENTICAL ✓
 *        re-checked post-composition with park.isDryCell(): all pads/props dry ✓
 * WORLDS 3: pulse @(x,z) · brasswork @(x,z) · thornwick @(x,z)
 *        ALL k(k−1)/2 centre pairs as √(Δx²+Δz²), SORTED, closest marked — the floor applies to the CLOSEST:
 *        pulse↔brass 38.4 ◄ CLOSEST ≥ 32.66 (20·√(128/48)) ✓ · brass↔thorn 41.0 · pulse↔thorn 44.2
 *        DRY GAP between world RECTS (not centres): min 4.8 u > 0 ✓  (touching rects = minGap 0 = one district)
 *        WORLD pulse: ride Discotron @[43.2,28.8] (inside rect ✓) · stall NeonSlush · scenery NeonArch ×3
 *        WORLD brasswork: ride AetherBalloons @[−33.6,15.6] (inside rect ✓) · stall GoggleWorks · scenery GiantGear ×2
 *        WORLD thornwick: ride MoonlitBarge @[6,−26.4] (inside rect ✓) · stall Honeywitch · scenery LanternTree ×3
 * CATS   (WRITTEN BEFORE ANY JSX) gentle Carousel · thrill §4.0-A flagship · water PaddleBoats
 *        · transport Monorail ring · dark GhostTrain   → 5/5, two off the never-used table ✓
 * CIRCUITS  §4.0-A coaster · §4.0-B coaster · Monorail ring · MagmaRun (water, never used)
 *        · GearworksExpress (dark, never used)   → 5 circuits / 4 families ✓  (§4.0-E)
 *        flat rides beside them: Carousel, Discotron, Enterprise (NOT counted as circuits)
 * GATE   [0, 63.6] → first queue tail [x, z] = 12.4 u  ≤ 15 ✓
 * FLAG   §4.0-A start [16.8, 0.55, −3.6] heading 0, steel, no bank prop
 *        legal start @128: x ∈ [−26.4, 63.6], z ∈ [−48.0, 42.0] ✓
 *        rateCoaster → E 6.06 / I 9.31 / N 3.44 / drop 5.47 u / maxLatG 0.36 / air 1.06 s   ← MEASURED, pasted
 *        CORRIDOR KEEP-OUT in PLOT coords (§4.0 table + start): x[−21.6..18.0] z[−20.4..19.2] valley bands
 *        every street node + every boulevard leg OUTSIDE it ✓ (no leg crosses at grade)
 * FLAG2  §4.0-B start [−2.4, 0.55, −38.4] heading 0, steel, no bank prop   ← the SECOND coaster (§4.0-E)
 *        rateCoaster → E 5.27 / I 6.25 / N 2.25 / drop 3.58 u / maxLatG 0.27 / air 0.56 s   ← MEASURED, pasted
 *        DIFFERENT archetype ✓ · intensity band moderate vs the flagship's intense ✓
 *        CORRIDOR KEEP-OUT in PLOT coords: x[−32.4..−3.6] z[−52.8..−20.4] valley bands
 *        bbox DISJOINT from FLAG's ✓ · off all 16 monorail ring cells ✓ · outside every <World> rect ✓
 *        coasterPts = [...FLAG_PTS, ...FLAG2_PTS] → reliefFloor.kept 0.__ ≥ 0.70 ✓, water moved 0/0 ✓
 * PROPS  every ride's props copied from its §4 block · NO invented prop VALUE anywhere ✓
 *        `colours` OMITTED on every ride (chassis presets it) — never a name string (§0 check 22)
 *        EDGES asserted cardinal before buildParkNet ✓ (no auto-elbow, no unplanned node)
 * STREET buildParkNet called EXACTLY ONCE ✓ · the SAME NET feeds <Paths> and every offPathCell ✓
 *        PORT-REFS: 5 pieces (hub · pulseRow · worksRow · gladeRow · viewpoint) → 5 refs in EDGES,
 *        counted: 'hub:N' 'hub:E' 'hub:W' 'pulseRow:W' 'worksRow:E' 'gladeRow:E' 'viewpoint:W' = 7 ≥ 5 ✓
 *        every pad returned BY offPathCell (never a raw tail+out·d sum) ✓ · 0 padOnStreet auto-moves ✓
 * MONO   §4.2-A verbatim · start [−42.6, 0, −9.7] · 4 platforms ≥ 3 declared worlds (one each + hub) ✓
 *        probe.monorail.worldsTouched 3 = worldsDeclared 3 → everyWorldTouched true ✓
 *        worldsTouchedIds [pulse, brasswork, thornwick] ← the NAMES live here, not above
 *        platform tails [−36.0,−8.4] · [0,27.6] · [36.0,−8.4] · [0,−57.6] all authored NODES ✓
 *        (S queues OUTWARD — measured; see the ring section)
 * QUEUE  ONE ROW PER RIDE — tail is an authored NODE, pad DERIVED from it (never the reverse):
 *        Carousel      cap 4  tail [0,56.4]    out [1,0]  → pad [7.2,56.4]   tail→pad 7.20 ≥ 5.26 ✓
 *        GhostTrain    cap 6  tail [36.0,40.8] out [1,0]  → pad [43.2,40.8]  tail→pad 7.20 ≥ 6.38 ✓
 *        DropTower     cap 8  tail [36.0,4.8]  out [1,0]  → pad [44.4,4.8]   tail→pad 8.40 ≥ 7.50 ✓
 *        <Coaster>     cap 4  queueTailNode NET.node([22.8,−3.6]) — chassis derives the lane ✓
 *        no two rides share a tail node ✓ · every tail listed above appears in NODES ✓
 * GROUND per ride, the 5 cells (pad · hut · hut · tail · exit join) all within the 0.5/1.2 grade ✓
 *        every one of them outside every §1 peak disc ✓ · causewayEdges EMPTY ✓
 * SPREAD built bbox 104 × 71 ≥ 70 × 45 ✓ · street-node bbox 112 × 88 → pathExtent 0.60 ≥ 0.55 ✓
 * PLAZAS 3 rects from NET.plazas: 12.0 / 7.8 / 5.8 u² → largest ≥ 8 ✓ areaSpread 2.1 ≥ 1.8 ✓
 * NODES  17 authored · degree-1: 4 (0.24) → each carries: queue tail · stall · restroom · gate ✓
 *        one PARK-SPANNING loop, crosses z = 0 ✓ (not a court-sized cycle)
 * LATTICE authored spans 26.4 / 21.6 / 14.4 / 9.6 u + the 1.2 chains → effectiveClasses 4.6 ≥ 4 ✓
 *        1.2-u chain share 0.48 ≤ 0.55 ✓ · pitches/axis x 4, z 4 · latticeNodeShare 0.15
 *        → gridRegularity 0.52 ≤ 0.55 ✓ (floor is 0.40 — see §0.0b)
 * ROSTER (WRITTEN LAST, counted off the register calls, and restated on <Park roster>)
 *        9 rides / 5 categories / 5 stalls (4 kinds) / restroom ✓ / bins ✓
 *        <Park roster={{ rides: [...9 names], stalls: 5, categories: 5 }}> MOUNTED ✓
 *        ← without the PROP, preflight.mjs prints "refusing to bundle" and NOTHING renders
 * DRESS  41 trees ≥ 32 ✓ · 38 scenery ≥ 16 ✓ · water 11.1% (temperate band 4-22%) ✓
 *        EVERY prop cell from offPathCell(clear 1.2); buildings from clear 1.8 ✓
 *        no prop cell reuses a street node coordinate or sits on an edge centreline ✓
 * NIGHT  3 <Lights> runs (one per district, along the street) + 2 neon + 6 torches · draws ~2 600 ≤ 3 000 ✓
 * GATE   validatePark → ok: true, 0 failures, 0 warnings
 * ═════════════════════════════════════════════════════════════════════════════════════ */
```

**EVERY NUMBER IN THAT HEADER IS COUNTED FROM THE FILE, NOT INTENDED.** The
first one-line-brief park wrote `Published rate: E 6.12 … (rateCoaster logs
live)` — and never imported `rateCoaster`, let alone called it; the measured
excitement was **6.06**. It wrote `36 trees · 16 scenery` where its own arrays
held 35 and 10. A parenthetical promise is not a measurement. So:
`import { rateCoaster } from './components/SplineRideKit'`, call it on the
compiled points, log it, and paste THAT line; and count the trees, the scenery,
the stalls and the `register={{…}}` calls out of the file you are shipping.

**AND THE SEPARATION LINE IS THE ONE MOST OFTEN FICTION.** The wave-12
six-word-brief park wrote `centre separation 51 / 65 / 69 u ✓` — three numbers
for three worlds, none of them a measured pair. Its real closest pair was
**17.28 u** and the two rects **TOUCHED** (`minGap 0`), i.e. the scorer read two
of its three "worlds" as ONE district. So write **every** pair, `√(Δx²+Δz²)`,
sorted ascending, with the CLOSEST marked — the floor applies to that one — and
write the RECT-to-RECT dry gap beside it (§0.3 check 4). Three worlds is three
pairs, four worlds is six; there is no version of this check that has fewer
numbers than pairs.

## 0.0b WHAT "COOL" MEANS — the quality target, as numbers

A one-line prompt states no standard, so the standard lives here. The park is
scored out of 100 on **16 axes** (`harness/park-eval/RUBRIC.md` is the
authority; these are its thresholds). Aim at the FULL-CREDIT column — every one
of them is reachable by construction, and most of them are decided before you
write any JSX.

| # | axis | pts | FULL credit — aim here | scores ZERO if |
|---|---|--:|---|---|
| 1 | Cleanliness | 5 | ≥ 1 restroom, ≥ 1 bin, no litter | no restroom + no bin |
| 2 | Paths | 8 | a coherent **LOOP/ring**, no dead stubs, no orphan islands, ≥ 1 plaza, `extentFractionOfPark` 0.2-0.6 (RUBRIC's "healthy" guidance — **do not shrink the net to hit it**: axis 15 wants `pathExtentFraction ≥ 0.55` and the two verified skeletons read 0.57 and **0.81**) | a star of dead-ended spurs |
| 3 | Ride spacing | 8 | **0** overlapping OBB pairs, min gap ≥ 1.5 u (≥ 3 u generous) | any `footprints`/`corridor` FAIL caps it at 0 |
| 4 | Entrance/exit | 7 | per ride: queue attached + reachable, `exitLaneLen > 0`, exit not stranded | pinning `exit`/`exitDir` yourself (−2 per ride) |
| 5 | Food stalls | 4 | ≥ 2 registered, **≥ 3 distinct kinds spanning FOOD *and* DRINK**, all themed names, on traffic | zero stalls; catalog default names |
| 6 | Park entrance | 4 | `<Gate>` on the plot edge, attached to a path node | no gate |
| 7 | Terrain | **9** | at 128: relief 8-17 u, **`stdH` 0.75-1.5**, flat entrance apron | `stdH < 0.5` — a dead-flat billiard table |
| 8 | Water | 6 | **EXACTLY 2 bodies** at 128; secondary ≥ 16% of the dominant; ≥ 7.04 u of dry gap; total % inside the climate band (§0.10) | 1 body caps at 3 pts, 3+ caps at 2 |
| 9 | Scenery | 5 | ~**1 piece per 25 u² of pathed area** (and never below §0.10's ≥ 16 at 128) | bare plazas |
| 10 | Trees / mountains | 4 | ≥ 32 trees at 128, **MIXED shapes**, spread; ≥ 1 terrain peak | treeless and flat |
| 11 | Creativity | 3 | themed ride + stall names; scenery `varietyIndex` **≥ 6** | ≤ 2 distinct scenery kinds; default names |
| 12 | Accessibility | **10** | every ride and stall reachable, 0 orphan islands, 0 causeway/steep edges | a refused span leaving a hole in the graph |
| 13 | Ride roster | 7 | **≥ 5 rides** (target 8+, §0.3), all DISTINCT kinds, **4-5 of the 5 categories**, **≥ 4 CIRCUITS besides the flagship across ≥ 3 circuit families** (§4.0-E — was "≥ 1 tracked ride besides the coaster"), roster Jaccard ≥ 0.4 vs prior parks AND ≥ 1 kind no prior park shipped | 3 categories → 1/1.5; 2 → 0.5. **A park with one coaster and eight flat spinners measures `circuitCount: 1` and scores 0 on the circuit row**; zero first-use kinds caps novelty at 0.5 |
| 14 | Thrill | **8** | **TWO rated coasters from DIFFERENT §4.0 archetypes in different intensity bands** (1.5 pts, §4.0-E). THRILL park: flagship **E ≥ 6.0**, peak +vert ≥ 2.5 g, drop ≥ 2.0 u. FAMILY park: **E ≥ 5.0**, ≥ 1.8 g, ≥ 1.2 u. Both: lateral < 1.27 g, airtime > 0, and a gentle + a moderate + an intense ride alongside | a FATAL coaster compile → 0 on the force test; extreme nausea caps the whole axis at 5/8. **ONE coaster caps the axis at 7.25/8; one coaster + flats only caps it at 6.5/8** |
| 15 | Layout uniqueness | 7 | see the block below | a monotonous lattice |
| 16 | Worlds | 5 | **≥ 3 BUILT preset worlds** (a world is BUILT only with ≥ 1 ride AND ≥ 1 stall AND ≥ 1 scenery/set-piece inside its bounds), **≥ 1 of them a preset the corpus UNDER-uses** — `tidewater` (2 builds) or `emberfall` (3) as of 2026-07-26, vs `brasswork` 7 / `pulse` 7 — centres ≥ 32.66 u apart, `crossTheme` empty | `declared: 0` → 0/5. **brasswork + pulse + thornwick, the trio three corpus parks already shipped, costs 0.25** |

**A NOTE ON AXIS 2's "LOOP" AND "DEAD STUBS", because the two verified skeletons
differ on it.** Skeleton A closes a park-spanning loop; **skeleton B is a pure TREE
(`edges === nodes − 1`, zero cycles) and still ships `ok: true` with axis 15 7.0/7
and 94/94 nodes reachable.** A tree is not the zero case: the zero case is *empty*
spurs (`deadStreetNode` — degree-1 nodes with nothing within 2.4 u). Every leaf in
skeleton B carries something — a ride's queue tail, a monorail platform, the gate.
So: **a cycle earns axis 2's loop read and is worth having; the absence of one is
not a failure**, and it must never be bought by running a street past a monorail
queue tail (§3.1-B constraint 1 — that is a `blockers` FAIL).

**AXIS 15 IN FULL — this is where parks quietly lose the most.**

| sub | pts | full credit | half |
|---|--:|---|---|
| plot utilisation | 1 | `plotUtilisation ≥ **0.70**` (`pathExtentFraction ≥ 0.55`, `occupancyFraction ≥ 0.35`, `quadrantSpread ≥ 0.75`) | ≥ 0.45 |
| districts | 1 | ≥ 2 clusters **and** widest centre pair ≥ **32.66 u** at 128 | ≥ 2 but too close |
| open space | 1 | ≥ 2 open spaces, `areaSpread ≥ 1.8`, largest ≥ 8 u² | ≥ 2 spaces only |
| **anti-lattice** | 3 | `gridRegularity ≤ **0.55**`, ≥ 3 effective edge-length classes, `latticeNodeShare ≤ 0.5` or ≥ 15% oblique edges | — |
| novelty | 1 | `layout.novelty.distance ≥ **0.08**` against every prior park | 0.04-0.08 |

**ANTI-LATTICE AND NOVELTY ARE TWO DIFFERENT SUB-TESTS FED BY THE SAME SCALARS.**
`gridRegularity` is a weighted sum of five terms (below); `novelty.distance` is a
distance over a 29-dim vector that CONTAINS those terms plus the density ones. So
the levers below win the 3-point anti-lattice block, and the DENSITY-CLASS
decision at the end of this section is what wins the novelty point. Do both — a
park that varies its edge lengths inside somebody else's budget passes
anti-lattice and still measures as a derivative.

**`gridRegularity ≥ 0.75` SCORES ZERO on the whole 3-point anti-lattice block.**
A uniform grid of same-length axis-aligned edges on one pitch measures **1.000**.
Beat it the same way a real park does: **vary the block sizes**, mix short court
spurs with long single-span avenues (≥ 3 distinct edge lengths), let the ring
bulge round the terrain, and hang courts off the boulevards at different depths.
This is measured on your AUTHORED street net only — access spurs are excluded, so
you cannot dress your way out of it.

**THE FLOOR IS 0.40 AND ONLY THREE OF THE FIVE TERMS ARE YOURS.** Stop treating
`gridRegularity` as a mood. It is a published weighted sum
(`harness/park-eval/layout.mjs`, `gridWeights`):

| term | weight | with CARDINAL-ONLY streets | controllable? |
|---|--:|---|---|
| `axisAligned` | 0.25 | **1.000 — pinned by §0.6** | NO → costs 0.250 |
| `bearingUniformity` = 2/effectiveBins | 0.15 | **1.000 — only 2 bearings exist** | NO → costs 0.150 |
| `lengthUniformity` = 1/effectiveClasses | 0.25 | 1/eff | YES |
| `latticeNodeShare` | 0.20 | share of nodes on BOTH a col and a row line (a line = ≥ 3 nodes sharing a coordinate) | YES |
| `pitchUniformity` = mean of 1/nPitches per axis | 0.15 | distinct spacings between consecutive grid lines, per axis | YES |

So **`gridRegularity` CANNOT fall below 0.40** in any legal park here, and the
≤ 0.55 full-credit line leaves you a budget of exactly **0.15** to spend across
the other three. **"Win the block on `effectiveClasses`" — what this section used
to say — IS FALSE AND WAS WORTH −2.05 ON ITS OWN.** Round-11's park B did exactly
as told, measured `effectiveClasses` **3.17** (a clean pass against the ≥ 3
target) and still scored **0.2 / 1.5** on `gridRegularity` **0.724**, because its
other two terms were maximal: **29 nodes sitting on 5 column lines and 7 row
lines, with a single 12.0-u x-pitch.** No number of edge-length classes survives
that. All THREE controllable terms have to move together:

```
effectiveClasses  5     → 0.25 · 0.200 = 0.0500
4 pitches per axis      → 0.15 · 0.250 = 0.0375
latticeNodeShare  0.15  → 0.20 · 0.150 = 0.0300
                            total 0.1175 → gridRegularity 0.518 ✓
```

And note how little slack there is: `effectiveClasses` 3 costs 0.0833 and
3 pitches cost 0.0500, which together leave **0.017** for `latticeNodeShare` —
i.e. under 0.09 — so the old "≥ 3 classes" advice is not a target, it is the
edge of infeasibility. Concretely, three habits:

* **≥ 4 distinct authored span lengths** (`effectiveClasses` ≥ 4, aim 5).
* **≥ 4 different spacings per axis.** Pitches are the gaps between consecutive
  GRID LINES, so a spine on 12 / 12 / 12 u is ONE pitch class however many nodes
  it has; 12 / 18 / 9.6 / 26.4 is four.
* **Never let three nodes share an x or a z coordinate unless you MEAN a grid
  line.** Three is the threshold that creates a line (`lineMap … >= 3`), and
  `latticeNodeShare` counts only nodes sitting on both a column AND a row line —
  so offsetting each district's court by a cell or two from the spine's columns
  collapses that whole 0.2-weight term almost to zero. This is the cheapest of
  the three and the one every park forgets.

**EDGE-LENGTH VARIETY IS THE ONLY ANTI-LATTICE LEVER YOU ACTUALLY HAVE.** Every
edge here is cardinal by rule, so `obliqueEdgeFraction` is **0** and
`hasCurveOrDiagonal` is **false** in every legal park — those sub-tests are
unreachable and you must win the block on `effectiveClasses` instead. **Aim at
≥ 3 effective edge-length classes and keep the modal share under ~0.55.** The
trap: a long avenue built as a CHAIN of 1.2-u lattice steps counts as dozens of
1.2-u edges, not one long one.

**AND `<Boulevard>` DOES NOT FIX THIS — THE OLD ADVICE HERE WAS SELF-DEFEATING.**
This paragraph used to say "route long legs as `<Boulevard>`s"; a `<Boulevard>`
**paves its carriageway as a 1.2-u CHAIN**, so it buys **ZERO** edge-length
classes. The wave-12 park followed that advice to the letter — seven boulevards,
every long leg handed over — and measured **132 of 154 street edges at 1.2 u,
`effectiveClasses` 1.96**, i.e. WORSE than the park that chained its own spines.
So, corrected:

* **`<Boulevard>` buys VERGE TREES, LAMPS and a dressed carriageway** — real
  scenery and a real street, and it is the right component for an avenue between
  worlds **if you build one**: §0.15 forbids hand-rolling an avenue, it does not
  oblige you to have one. (Skeleton B ships **zero** boulevards and zero plazas and
  measures axis 15 **7.0/7** — its long runs are single authored edges, which is
  exactly why.) It does **not** buy length variety.
* **Length variety comes ONLY from long SINGLE-SPAN authored edges** — two nodes
  in your own `NODES` list **12-28 u apart**, wired as ONE edge in `EDGES`.
  `buildParkNet` keeps that edge whole, with ONE proviso it will enforce on you:
  **it splits every edge at any node lying ON it** (no crossing without a
  junction — `SetPieceKit`, "long edges are split at any node lying on them"). So
  a 26-u span drawn straight down a boulevard's carriageway comes back as ~22
  edges of 1.2 u. Route the long spans where nothing else is: keep them clear of
  boulevard chains, plaza sub-nets and each other except at their endpoints.
* **Target ≥ 3 distinct authored span lengths — aim at 4-5** (e.g.
  9.6 / 14.4 / 21.6 / 26.4 u) **and keep the 1.2-u chain share under ~0.55** of
  all street edges. Every boulevard you add pushes that share UP, so pay for each
  one with a long authored span. Three classes is the edge of feasibility, not the
  target — the weight arithmetic under the anti-lattice table above shows why.

**FILL THE SOUTH — the plot-utilisation loss is always the same shape.** The
first one-line-brief park measured `quadrantCounts [1, 4, 57, 63]`: two
quadrants held **five features between them**, its whole street net lived in
z ∈ [−3.6, 63.6], and `pathExtentFraction` came out **0.33** against the 0.55
target — `plotUtilisation 0.679`, just under the 0.70 line, for want of one leg.
So, concretely, on top of §0.3 check 3's floors: **the circulation loop's return
leg must CROSS z = 0 and put real features (nodes, a plaza, a satellite
attraction) in at least THREE of the four quadrants** — no quadrant under ~10
features. §0.3 check 2 names what legitimately goes down there.

**NOVELTY IS SCORED AGAINST THE SAMPLES YOU WERE TOLD TO READ.** `worlds-ref` /
`hollowmere2` are the SHAPE, and a park that reproduces their signature scores
as a derivative: the first one-line-brief park landed
`layout.novelty.distance 0.071` against the 0.08 floor, nearest neighbour
`hollowmere2`, because it repeated that file's arrangement — **three themed
`<Bazaar>`s in a row on one east-west line at z ≈ 44, a neutral hub between
them, the coaster ring due south.** Do not build that arrangement. Move at
least three of these away from the reference: the number of cycles in the
street graph, the degree mix (`d2` was **0.855** — a park of corridors), the
quadrant occupancy, the edge-length classes, and where the flagship ring sits
relative to the hub.

**AND NOW THE CORRECTION THAT MATTERS MOST, MEASURED IN WAVE 17: TOPOLOGY
CONTRIBUTES ALMOST NOTHING TO THE SIGNATURE. THE SCALARS DO.** The verifier built
a full third table specifically to be *different* — a different gate rim, a
**LADDER** topology with a real cycle where skeleton B is a pure tree, different
worlds, a different roster — and it measured **`novelty.distance` 0.031 against
skeleton B**, i.e. a DERIVATIVE by our own 0.04 floor. **21 of the 29 signature
dimensions were within 0.05 of each other.** The cause was not the drawing; it
was that both parks spent the **same budget**: ~54 street nodes, ~400 u of street,
3 bazaars, the same plaza areas, the same edge mix. `layout.signature`
(`harness/park-eval/layout.mjs`) is a vector of *normalised shape statistics* —
node density, path density, mean edge length, open-space count and area,
`areaSpread`, the bearing mix, quadrant spread, `latticeNodeShare`, the degree
shares. Redraw the graph at the same budget and every one of those holds still.

**SO: TO BE DISTINCT, CHANGE THE DENSITY CLASS — NOT THE PICTURE.** Pick a budget
that is a different *kind* of park and commit to it, in the header, before the
first node:

| class | street nodes | total street | mean edge | reads as |
|---|--:|--:|--:|---|
| SPARSE long-run (skeleton B) | ~55 | ~410 u | **7.5 u** | few long arterials, deep spurs |
| DENSE short-block | **~120** | **~1200 u** | ~3-4 u | a gridded downtown of small courts |
| anything between | — | — | — | expect to land on a neighbour |

A ~120-node / ~1200-u short-block park cannot be near a ~55-node / ~410-u one in
that space no matter how similar its topology is, and a ~55-node / ~400-u park is
a derivative of skeleton B no matter how novel its topology is. The three moves
that actually shift the vector are **the node count, the total paved length and
the open-space budget** (count *and* area *and* `areaSpread`); cycles, ladders,
loops and tree-vs-mesh are worth roughly nothing on their own. Change the class
FIRST, then draw whatever you like inside it.

**THE CORPUS CAVEAT, STATED HONESTLY.** Two things follow and both bind on us as
much as on the author:

1. **A PUBLISHED SKELETON MUST NEVER BE PROBED INTO THE SIGNATURE CORPUS.** If
   skeleton A or B ever gets a `signatures/*.json` entry, every park an author
   derives from it measures against the table itself and scores 0.0-something by
   construction. Neither is in the corpus today (`layout.novelty.corpusSize` 22,
   and skeleton B is not one of the 22) and neither may be added.
2. **EACH TABLE BURNS OUT.** As parks built from a published table enter the
   corpus, the region around it fills up. **A published skeleton buys roughly ONE
   ROUND of novelty headroom**, and the second park off the same table is
   competing with the first. That is why there are now two alternatives and why
   the density-class move above is the durable answer: it is the only one that
   does not decay as the corpus grows.

**REACH PAST THE SAME SIX SPINNERS — variety is a stated goal, not a hope.**
The catalog is **44 rides / 10 stalls**. Across the whole sample corpus **25 of
the 44 rides have NEVER been used**, and the entire **DARK category — every one
of its three rides — has never been built by anybody**
(`cd harness/park-eval && node usage.mjs` prints the live list). Nine parks in a
row shipped Carousel + FerrisWheel + Teacups + DropTower + SwingRide + a coaster.

| category | never used yet |
|---|---|
| **dark** (0/3 ever used) | `GearworksExpress`, `GhostTrain`, `HauntedMansion` |
| transport (2/3) | `Chairlift`, `MagneticRide` |
| water (5/8) | `PaddleBoats`, `ReefRacer`, `DeepDrift`, `OceanTunnelSlide`, `MagmaRun` |
| thrill (11/20) | `Bobsleigh`, `GoKarts`, `MotionSimulator`, `LaunchedFreefall`, `SwingingInverterShip`, `Bassline`, `EmberWings`, `LavaTubeRun`, `MineTrainCoaster`, `WyrmsHollow`, `SplineCoaster` |
| gentle (4/10) | `BumperCars`, `FlyingSaucers`, `Helicycles`, `SpaceRings` |
| stalls (1/10) | `EmberRoast` |

**One dark ride + one transport ride + one unused water ride wins axis 13's
category-balance (1.5) AND its speciality point (1) AND clears the 0.4 roster-
novelty floor in a single decision.** The Emberfall and Tidewater worlds are
unused *entirely* — building either one is the cheapest novelty in the book.

**THE ROSTER FLOOR IS NOT THE ROSTER TARGET.** Axis 13 pays full count marks at
5 rides, so a park built to the rubric stops at 5-6 and leaves points on three
other sub-tests. **Ship ≥ 8 rides (§0.3), cover ALL FIVE categories, and take
at least TWO rides off the never-used table above.** Measured on the first
one-line-brief park: 6 rides, **transport EMPTY** (4 of 5 categories), and 5 of
its 7 kinds shared with `w11-worlds-ref` → roster novelty **0.375** against the
0.4 floor, i.e. half credit, on a park that had already reached for a dark ride.
The missing transport ride — `<Monorail>` (§4.2's verified circuit) or
`<Chairlift>` — would have fixed the category count AND the novelty in one mount.
Note `LogFlume` / `RiverRapids` / `PaddleBoats` **build their own water** and
therefore go on DRY FLAT LAND, never on the composed lake (§3).

**SO WRITE THE FIVE CATEGORY NAMES IN THE HEADER, WITH THE RIDE FILLING EACH,
BEFORE YOU TYPE ANY JSX.** Category coverage is decided at planning time and
cannot be repaired at the end — a park that mounts its rides first and counts
categories afterwards lands on 3. The wave-12 six-word-brief park did exactly
that: `categoryCount 3`, **no water ride and no transport ride**, on a catalog
where **23 of the 44 kinds are unused**. It is one line of header, and it is
mandatory (§0.0-H's `CATS` row):

```
 * CATS   gentle <ride> · thrill <ride> · water <ride> · transport <ride> · dark <ride>   → 5/5
 *        never-used picks: <ride>, <ride>  (≥ 2, off the table above) ✓
 * CIRCUITS  <5+ named>  families: coaster+water+transport(+dark/tower)  → 5 / 3 fam ✓
 *        coasters: <name> §4.0-A E _._ I _._  ·  <name> §4.0-B E _._ I _._   (2, DIFFERENT archetypes) ✓
```

Fill it in this order and it fills itself: **transport = the §4.2 monorail ring
you are already required to ship** (§0.0 step 10), **thrill = the two §4.0
coasters** (§4.0-E — two, from different archetypes, in different intensity
bands), then pick **water** and **dark** off the never-used table (both
categories are mostly or entirely unbuilt, so both picks double as roster
novelty), and **gentle** last from whatever the worlds want. If a category has
no ride beside its name, you have not finished planning — do not start the JSX.

**AND COUNT THE CIRCUITS, NOT THE RIDES.** The `CATS` row can read 5/5 off a
park that is one coaster and four flat spinners, which is exactly what 16 of 20
corpus parks shipped. The `CIRCUITS` row above is the fix: **≥ 5 rides that run
a vehicle along a track, spanning ≥ 3 of the five families** `coaster / water /
transport / dark / tower`. Every circuit except the two coasters costs one JSX
element with **no `pieces` prop** — that is the safe form, not a shortcut
(§4.0-E's mode table).


---

## THE PRE-FLIGHT CHECKLIST IS IN `rules/park-generation-checks.md`

§0's **27** numbered checks — the arithmetic you must do before finishing, and the
one place every measured threshold lives — were split into their own files
because this one outgrew a single design-system write. Nothing was cut.

**Read the checklist before you finish a park.** Steps above tell you what to
build; the checks tell you the numbers it must hit.

| file | contents |
|---|---|
| `rules/park-generation.md` (this file) | intro · §0.0 THE ONE-LINE BRIEF · §0.0b what "cool" means |
| `rules/park-generation-checks.md` | §0 PRE-FLIGHT CHECKLIST, checks **1-14** |
| `rules/park-generation-checks-b.md` | §0 PRE-FLIGHT CHECKLIST, checks **15-27** · footprint table · canonical imports · catalog inventory |
| `rules/park-generation-composition.md` | §1 climate & seeds · the ring-clearance table |
| `rules/park-generation-worlds.md` | §2 build order · §3 worlds |
| `rules/park-generation-skeletons.md` | §3.1 set-pieces · **§3.1-A, hub-and-spokes, the only table with TWO coasters** |
| `rules/park-generation-tree-skeleton.md` | **§3.1-B, the tree** |
| `rules/park-generation-skeletons-b.md` | **§3.1-N** why transcribing cannot score · the set-piece contract |
| `rules/park-generation-rides.md` | §4 rides · §4.0 coaster archetypes · §4.2 the monorail ring |
| `rules/park-generation-validation.md` | §5 legality lint · §6 validatePark · §6.1 triage · §7 sketch |

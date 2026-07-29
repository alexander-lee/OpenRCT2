# Composing parks — §0 PRE-FLIGHT CHECKLIST, checks 15-27

Part of the recipe book. Checks **1-14** are in `rules/park-generation-checks.md`
— do those too; the numbering is continuous across the two files. §0.0 (the
one-line brief) and §0.0b (what "cool" means) are in `rules/park-generation.md`.

This half carries the set-piece/`buildParkNet` mandate, the post-composition
water re-read, `keepDry` discipline, `offPathCell`, crowd sizing, the monorail
gate, the prop-shape gates, set-piece centres, pad reach, per-world scenery and
the roster arithmetic — then the footprint table, the canonical import block and
the catalog inventory.

15. **USE THE SET-PIECES — `buildParkNet` is MANDATORY for any park with ≥ 2
    zones (round-7 gate).** A HAND-ROLLED UNIFORM GRID IS A REJECTED LAYOUT.
    Round 7 had `buildParkNet`, `<FountainPlaza>`, `<Bazaar>`, `<Boulevard>`
    and `rateCoaster` live in the artifact and still hand-wrote a 6×6 grid of
    nodes — tools that prevent defects are worth nothing if the composition
    doesn't reach for them. Required, not optional:
    - **plaza hub → `<FountainPlaza>`**, **shop cluster → `<Bazaar>`**,
      **long avenue between districts → `<Boulevard>`**;
    - fuse every street with
      **`buildParkNet({ nodes, edges, pieces, keepDry })`** — where `pieces` is
      **EVERY** plan including each world's own, see the block below — and feed its
      `nodes` / `edges` / `plazas` / `bins` / `keepDry` straight into `<Terrain>` and
      `<Paths>` (see §3.1);
    - your own hand-authored nodes are for SPINES and SPURS between pieces —
      a dozen nodes, not a lattice.

    **`buildParkNet` AND `<Paths>` ARE ONE PATH, NOT TWO — the whole wiring, to
    copy.** Round-11's park B read these as rival composition routes (*"`<Paths>`
    needs me to hand a graph, and set-pieces go through `buildParkNet`, which
    `<Paths>` may or may not accept… to keep it clean and reliable, I'll SKIP the
    macro set-pieces"*) and dropped the mandate for RELIABILITY, costing ~5 points
    across axes 2 and 15. There is nothing to decide: `buildParkNet` RETURNS the
    arrays `<Paths>` takes.

    ```tsx
    // ── module scope: plans first, all pure, nothing mounted yet ──────────────
    // AN EXCERPT, NOT A FILE. Assumed declared above: HUB / GATE_AVE / VIEWPOINT /
    // PULSE_ROW / WORKS_ROW / GLADE_ROW (the plans), KEEP_DRY, FLAG_PTS / FLAG2_PTS,
    // THREE, and SEED_ROW_WATER + assertKeepDryOffRow + assertNodesOffPieces +
    // keepDryOf (all four pasted verbatim from §3.1-A). WORLDS is declared BELOW the
    // fuse, in §3.1-A step 5c-w. The paste-able whole file is `-skeletons.md` §3.1-A.
    const GATE: XZ  = [0, 63.6];
    const NODES: XZ[] = [GATE, [0, 51.6], [-24, 51.6], [24, 51.6] /* … a dozen, not a lattice */];
    const EDGES: [NetRef, NetRef][] = [
      [0, 1],                    // plain node → node (your own indices, PRESERVED)
      [1, 'hub:N'],              // node → PORT of a set-piece, by NAME
      ['pulseRow:E', 3],         // PORT → node — this is the NetRef form
    ];

    // ── ONE PIECES ARRAY, DECLARED ONCE — AND IT COMES FIRST, because the
    //    cardinal assertion RESOLVES port refs against it.
    const PIECES = [HUB, GATE_AVE, VIEWPOINT];      // the explicit ones; late plazas HERE
    // NAME THE WORLD ROWS, NOT `WORLDS.flatMap(w => w.pieces)`: `WORLDS` is declared
    // AFTER the fuse (it reads the pads), so the flatMap spelling is a `const` TDZ.
    const ALL_PLANS: SetPiecePlan[] = [...PIECES, PULSE_ROW, WORKS_ROW, GLADE_ROW];

    // ── ASSERT EVERY EDGE IS CARDINAL, BEFORE THE FUSE. Copy verbatim ──────────
    // **RESOLVE THE PORT REFS. DO NOT SKIP THEM.** The form published through wave
    // 15 skipped every string endpoint, which made this check BLIND BY DESIGN on
    // exactly the edges with a computed endpoint — the ones you cannot eyeball.
    // Round 13's park A copied the skip and shipped ['pulseRow:W', 6] running
    // [43.2, 8.4] → [22.8, −8.4]: a diagonal, unseen, elbowed by buildParkNet, and
    // the synthesised elbow became a dead stub.
    const portCell = (ref: NetRef): XZ => {
      if (typeof ref === 'number') return NODES[ref];
      const [id, name] = ref.split(':');
      const p = ALL_PLANS.find((q) => q.id === id);
      if (!p) throw new Error(`EDGES references '${ref}' but no plan has id '${id}'`);
      return p.port(name);
    };
    // USE A TOLERANCE, NOT `!==`: port cells are `tiles·0.6 + 0.6`, and in binary
    // 7*0.6 + 0.6 is 4.799999999999999, so strict equality against an authored 4.8
    // throws a FALSE diagonal and blacks the page on a legal park. 1e-6 is four
    // orders of magnitude under the 1.2 lattice, so it cannot hide a real one.
    const EPS = 1e-6;
    EDGES.forEach(([a, b]) => {
      const A = portCell(a), B = portCell(b);
      if (Math.abs(A[0] - B[0]) > EPS && Math.abs(A[1] - B[1]) > EPS)
        throw new Error(`diagonal edge ${a}→${b}: [${A}] → [${B}]`);
    });

    // ── EVERY ID PORT-REFERENCED IN EDGES ─────────────────────────────────────
    // Audit the WORLD ROWS too — that is why the loop runs over ALL_PLANS and not
    // PIECES. buildParkNet keys their ports as `<planId>:<PORT>` exactly like an
    // explicit piece's, whether they arrived via `pieces:` or `worlds:`.
    // PRESENCE for every piece, and BOTH ENDS for a CHAIN piece: a port with
    // `prunable: false` is a structural carriageway END (buildParkNet drops an
    // unwired STUB but never SHORTENS an avenue), so leaving one unwired paves a
    // slab that dead-ends in grass. <Boulevard>'s 'A' and 'B' are both
    // prunable:false. READ THE FLAG OFF THE PIECE — never a list of kinds.
    const CHAIN_END_OPT_OUT = new Set<string>([/* 'gateAve:B' — ONLY when something
      real stands on that terminus, e.g. a bare <Gate> on it */]);
    const PORT_REFS = EDGES.flat().filter((x): x is string => typeof x === 'string');
    ALL_PLANS.forEach((p) => {      // PIECES / ALL_PLANS declared above, for portCell
      const wired = new Set(PORT_REFS.filter((r) => r.split(':')[0] === p.id).map((r) => r.split(':')[1]));
      if (!wired.size)
        throw new Error(`set-piece '${p.id}' has NO '${p.id}:<PORT>' ref in EDGES — it composes as an ISLAND`);
      p.ports.filter((pt) => !pt.prunable).forEach((pt) => {
        if (wired.has(pt.name) || CHAIN_END_OPT_OUT.has(`${p.id}:${pt.name}`)) return;
        throw new Error(
          `chain piece '${p.id}' (${p.kind}) wires [${[...wired]}] but NOT '${p.id}:${pt.name}' — that end of the ` +
            `carriageway dead-ends in grass (deadStreetNode). Wire it, and READ THE ENDPOINT OFF THE PIECE: ` +
            `boulevardPlan({ from: HUB.port('W'), to: MARKET.port('E') }) — never retype the cell.`,
        );
      });
    });

    // ── NO AUTHORED CELL INSIDE A SET-PIECE'S SOLID FOOTPRINT ─────────────────
    // A plaza's `position` is its SOLID CENTRE, never a street node and never a
    // queue tail. Round 13 shared ONE coordinate three ways — a plaza position,
    // node 20, and two rides' queue tails — for edgeThroughSolid ×2, a dropped
    // edge, an orphan island, the accessibility FAIL and 5 footprints FAILs.
    // Full function: `-composition.md` §3.1's skeleton, `assertNodesOffPieces`.
    assertNodesOffPieces(NODES, ALL_PLANS);

    // ── WALK THE GUARDS AGAINST THE PINNED SEED ROW (§1-W, copied verbatim) ────
    // The paper walk has been tried and got it wrong every round. This throws and
    // NAMES the offending cells. `KEEP_DRY = [...NODES]` is what it is here to stop.
    assertKeepDryOffRow(KEEP_DRY, SEED_ROW_WATER['1/temperate']);

    // ── CALL buildParkNet EXACTLY ONCE. This NET is the only one, AND IT COMES
    //    BEFORE THE WATER RE-READ, because that re-read needs the guard list.
    //    ORDER IS LOAD-BEARING: `NET` is a `const`, so a line above this one that
    //    names it is a ReferenceError at module scope — a BLANK PAGE, not a lint.
    const NET = buildParkNet({
      nodes: NODES, edges: EDGES,
      pieces: ALL_PLANS,                     // EVERY plan: plazas, bazaars, boulevards,
      //                                        AND each world's own pieces (see below)
      keepDry: KEEP_DRY,
    });

    // ── THE GUARD LIST IS DERIVED, NOT `NET.keepDry` RAW. Declare it HERE ──────
    // `buildParkNet` MERGES every set-piece and world cell into NET.keepDry (30
    // authored cells → 650 guards, MEASURED on §3.1-A), so it is re-sieved against
    // the pinned row before anything reads it (§3.1 step 5b-ii). Handing the fuse's
    // raw output to <Terrain> — or to parkComposition — is the same −3.5 defect as
    // `KEEP_DRY = NODES.slice()`, one level up. `keepDryOf` is in §3.1-A step 5b-ii.
    const GUARDS = keepDryOf(NET, SEED_ROW_WATER['1/temperate']);

    // ── AND THE AUTHORITY: COMPOSE THE WATER TWICE AND DIFF THE CENTROIDS ─────
    // The `assertKeepDryOffRow` line above is a sieve against PUBLISHED boxes; this
    // one knows about YOUR cells. `parkComposition` is POSITIONAL and `size`
    // DEFAULTS TO 48 — pass 128. It has NO `isDry`; the predicate is the
    // 0.74·radius basin walk (§3.1 §5c). Feed it GUARDS, never NET.keepDry.
    const BARE = parkComposition(THREE, 1, 128, 'temperate');
    const COMP = parkComposition(THREE, 1, 128, 'temperate', { keepDry: GUARDS, coasterPts: FLAG_PTS });
    // then: |BARE.waterCentre − COMP.waterCentre| ≤ 6 and the same for
    // waterCentreSecond, or throw. Round 13 moved a secondary centroid 70.7 u.

    // ── inside <Park>: hand the fused graph over, and hand over GUARDS ─────────
    <>
      <Terrain keepDry={GUARDS} coasterPts={[...FLAG_PTS, ...FLAG2_PTS]} />{/* BOTH coasters — §4.0-E */}
      <Paths nodes={NET.nodes} edges={NET.edges} plazas={NET.plazas} bins={NET.bins} walkers={8}
             surfaceZones={WORLDS.map((w) => ({ ...w.region, surface: w.theme.pathSurface }))} />
    </>
    ```

    **EVERY SET-PIECE ID MUST APPEAR IN `EDGES` AS `'<id>:<PORT>'` — AND THE CHECK
    IS A COUNT.** N pieces ⇒ at least N port-refs; count them before you ship.
    `pieces:` and `worlds:` bring a piece's INTERIOR sub-net into the graph and
    connect it to nothing: **a piece with no port-ref is DECORATION, not a place.**
    Its stalls are unreachable, its plaza is not on the walk, and `NET.warnings`
    reports the island. Round 12 referenced only `hub:N/E/W` — `pulseRow`,
    `worksRow`, `gladeRow` and `viewpoint` had ZERO refs — and paid **2 orphan
    islands, gate-reach 0.811, three unreachable stalls, one `edgeThroughSolid` and
    accessibility 1/10**: about **9 points** for four missing strings.

    **AND A COUNT IS NOT ENOUGH FOR A CHAIN PIECE — A `<Boulevard>` OWES *BOTH*
    `A` AND `B`.** The presence count is satisfied by one ref, which is exactly how
    round 13's park B passed the assertion and still shipped a `deadStreetNode`:
    `EDGES` held `['ave:A']` and never `'ave:B'`, so the avenue was paved to its
    full authored length and stopped **7.2 u short of the plaza**, in grass. Both
    of `<Boulevard>`'s ports carry **`prunable: false`** — `buildParkNet` prunes an
    unwired dedicated STUB, but it will never SHORTEN a carriageway — so an unwired
    chain end is built, not pruned. The extension is the same loop (above) reading
    `pt.prunable` off the plan. Belt and braces: **build both endpoints OFF the
    neighbouring pieces** — `boulevardPlan({ from: HUB.port('W'), to: MARKET.port('E') })`
    — because port-built endpoints MERGE with the neighbour's port cell in the fuse
    and therefore cannot be 7.2 u wrong.

    **EVERY WORLD PIECE GOES IN THE FUSE — BY EITHER SPELLING.** What is mandatory
    is the PIECE SET, not the keyword. `worlds:` is genuinely optional
    (`ParkNetInput.worlds?:`, `SetPieceKit/index.tsx:745`) and its only behaviour is
    the flatten at `index.tsx:825` — `[...worlds.flatMap(w => w.pieces), ...pieces]`,
    deduped — so a world's row listed in `pieces:` is fused, port-keyed,
    `keepDry`-merged and `gateway()`-resolvable exactly as if it had come through
    `worlds:`. **What is fatal is a world piece that reaches NEITHER.** Round 13's
    park B built `WORLDS`, mounted all three `<World>`s and handed the fuse only its
    three explicit plazas: the port-ref audit iterated world pieces the fuse was
    never told about, the assertion and the graph described different parks, and the
    world layer was audited blind.
    **AND `worlds: WORLDS` IS UNAVAILABLE TO A SKELETON-A-SHAPED PARK.** `worldPlan({
    rides })` reads the PADS · the pads come out of `place()` · `place()` reads `NET`
    — so `WORLDS` does not exist at fuse time. `harness/park-eval/samples/skeleton-a.tsx`,
    the park that passes the gate, therefore omits `worlds:` (`:560-563`) and names
    `PULSE_ROW, WORKS_ROW, GLADE_ROW` in `pieces:` (`:374`), declaring `WORLDS` at
    `:663` out of the finished pads. Use `worlds:` only when your worlds are
    declarable BEFORE the fuse, and **never write
    `ALL_PLANS = [...PIECES, ...WORLDS.flatMap(w => w.pieces)]` above the fuse** —
    that spelling reintroduces the same TDZ one line higher up.

    **AND CALL `buildParkNet` EXACTLY ONCE — THIS IS A PROHIBITION.** One fuse, one
    `NET`, and `offPathCell` must receive the SAME net `<Paths>` receives. Round 12
    fused twice (`NET` without its late viewpoint plaza, `NET2` with it), cleared
    every pad, prop and tree against `NET` and paved from `NET2`: every clearance in
    the park was computed against a graph missing a 116 u² plaza. A second fuse also
    pays the whole composition cost again for nothing.

    Your node INDICES survive the fuse (piece nodes are appended after yours), so
    a `queueTailNode={7}` or `NET.node([x, z])` computed against your own list
    keeps meaning what you wrote.
    Districts must READ as separate places: **≥ 32.66 u between district centres
    on the default size-128 plot — aim at 40 u, which a 4-district park clears
    with slack** (≥ 20 u on a 48 — `20·√(size/48)`, from
    district FOOTPRINTS, not from a fraction of the plot; §0.3 check 4, which is
    also the number `score-layout.mjs` scores).

    **AND THE SKELETON MUST CLOSE A CIRCULATION LOOP — a hub with radial spurs
    is not a park layout.** Wire the districts into a RING (hub → district A →
    district B → … → back to the hub, or an outer promenade the boulevards hang
    off), not a star of dead-ended avenues. One edit buys three things:
    * axis 2 reads shot 05 for "a coherent skeleton (loop/ring, no dead stubs)"
      and `probe.paths` for cycles — a pure star has one cycle at most (its
      plaza) and reads as a stub farm;
    * the loop's return leg is what carries the street net out of the
      gate-reach band (§0.3 check 2) and lifts `pathExtentFraction` /
      `quadrantSpread`;
    * it is the cheapest NOVELTY move there is. Round 9's park A landed
      `novelty.distance 0.025` against the `seedcheck-s1-192` reference —
      under the 0.04 floor, i.e. scored as a derivative — because both are the
      same single-hub-plus-radial-spurs signature. Two of the 29 signature
      dimensions are the cycle ratio and the degree mix; a ring moves both.
    A loop also has to obey §0.6: it is still cardinal-only and still on lattice
    multiples of 1.2, and its inter-district legs are `<Boulevard>`s — for the
    verge trees, the lamps and the dressed carriageway. **Do not expect those
    boulevards to buy edge-length variety: a `<Boulevard>` paves a 1.2-u CHAIN, so
    the ≥ 3 (aim 4-5) distinct span lengths axis 15 wants come from LONG SINGLE
    AUTHORED EDGES elsewhere in the ring** (§0.0b).

    **AND ONE SMALL CYCLE IN ONE DISTRICT IS NOT A CIRCULATION LOOP.** The loop
    the axis is looking for encircles the PARK — it leaves the hub, reaches every
    district and returns, crossing z = 0 on the way (§0.0b's "fill the south"). A
    closed triangle of three nodes inside one court satisfies the letter of "has a
    cycle" and none of the point of it.

    **COUNT YOUR DEGREE-1 NODES BEFORE YOU MOUNT — this is pre-flight arithmetic,
    not a gate warning.** Tally the degree of every node in your own `NODES` array
    straight off `EDGES` (each endpoint occurrence = +1). Then, **for every
    degree-1 node, name the thing it exists for**: a queue tail, a stall, a
    restroom, a plaza or the gate, within 2.4 u. A degree-1 node with nothing on it
    is a `deadStreetNode` warning each and **−2.0 in aggregate**; round-11's park B
    shipped **12 of 29 nodes at degree 1, five of them empty**. As a shape test:
    **a `d1` share above ~0.2 reads as a star of spurs**, not a network — and the
    degree mix is one of the 29 novelty signature dimensions, so it is scored
    twice. Put the thing on the spur, or delete the spur.
16. **THE §0 HEADER IN YOUR FILE MUST CONTAIN A PASTED `rateCoaster` RESULT
    LINE for the flagship** — excitement / intensity / nausea / highest drop /
    maxLatG / airtime, copied from the measured output, not retyped from this
    book and not predicted. If you cannot produce that line, you have not
    measured the ride and the park is not finished (§4.1). **CALL `rateCoaster`
    — never hard-code a `ratings=` prop off an archetype's published table.**
    Those figures are ±0.1 and shift on real ground (§4.0), so a pasted constant
    is a claim, not a measurement. And pass `pieces` as a real `TrackPiece[]`
    with **NO `as` / `as const` / `as any` casts**: a cast suppresses exactly the
    typo (a misspelt `type`, a missing `height`) that makes `compileTrackPieces`
    FATAL — and a fatal compile renders translucent red and never registers, so
    the category and the flagship you counted on are both empty.

    **EVERY REGISTERED RIDE AND EVERY STALL NEEDS A THEMED `name`, AND THE RULE
    BINDS ON RIDES EXACTLY AS HARD AS ON SHOPS.** A park shipping "Burger Shop",
    "Soda Stand" and "Balloon Stand" reads unfinished — `register={{ name: 'Cinder
    Soda' }}` — and so does one shipping `<Carousel>` as "Carousel". Round 13's
    park B themed eight of ten rides and left `Carousel` and `Discotron` on their
    catalog defaults; the shop rule was stated and got 9/9, the ride rule was not
    and got 8/10. The mechanical form: **the name is a required argument, so write
    it into `roster.rides` FIRST and then pass each entry to the ride's
    `register={{ name }}`.** If a name in `roster.rides` equals the component's own
    name, it has not been themed. (Names are also the manager's PRIMARY KEY, so
    duplicates make the corridor resolver move the wrong ride.)

    **AND THE HEADER'S ROSTER LINE IS WRITTEN LAST, FROM THE REGISTRATION —
    then DECLARED so the gate can check it (wave-10).** The roster line is the
    one claim a reader trusts and cannot verify, and it is written from the PLAN,
    which then changes. Round 9's park A shipped `ROSTER (9 registered rides, 5
    categories …)` with EIGHT rides in THREE categories — and the dropped ride's
    own comment was still in the file two lines down (`/* Monorail dropped from
    the roster to keep the corridor sweep trivial */`). Nothing caught it, and
    every roster-scored axis (ride count, category balance, speciality) is scored
    off what REGISTERED, not off the header.

    So: count the `register={{…}}` calls that actually mount, write the line from
    THAT, and restate it machine-readably on `<Park>`:

    ```tsx
    <Park roster={{ rides: ['Timberline Racer', 'Briarwood Gallopers', /* …every one */ ],
                    stalls: 4, categories: 3 }}>
    ```

    `validatePark` warns **`rosterOverstated`** when the park registers fewer
    than you claimed — and if you pass NAMES rather than counts it names the
    ride that never registered. **Categories are only sanity-bounded by the
    gate** (you cannot have more categories than rides): the RCT2
    gentle/thrill/water/transport/dark map lives in the eval harness
    (`harness/park-eval/catalog.mjs`), not in the design system, so audit the
    category claim against `probe.json`'s `rideRoster.categoryCount` and never
    against your intentions. A fatal COMPILE is the trap that makes this bite: a
    coaster or monorail whose `compileTrackPieces` report is fatal renders in
    translucent red and is never registered, so the category you thought it
    filled is empty (§4.0, §4.2).
17. **RE-READ THE COMPOSED WATER AFTER COMPOSITION.** The §1 seed table lists
    **PRE-GUARD** coordinates: `parkComposition`'s guards RE-PICK the water
    body whenever your `keepDry` list overlaps the listed disc, and the new
    lake can land anywhere. Round 7 planned around a river at (18.1, −5.9)
    while the lake actually settled at ~(9, 12…15), then bridged it on stilts
    and planted a tree in it. Either probe it headlessly WITH your guards
    (`parkComposition(THREE, seed, YOUR_SIZE, climate, { keepDry, coasterPts })`
    — the §1 table is generated at the DEFAULT **128**, and the same seed at a
    different size composes different coordinates — →
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
18. **`keepDry` covers the WHOLE SPINE, not just the nodes — AND ONLY WHAT YOU
    PAVE. `KEEP_DRY = [...NODES]` / `NODES.slice()` / `keepDry={NET.keepDry}` IS THE
    DEFECT, NOT THE SHORTCUT — use `keepDryOf(NET, SEED_ROW)`.** List every
    street node AND every edge midpoint, every ride pad / queue-lane cell /
    hut cell, every stall and every scenery cell. The runtime AUTO-keepDry
    pass (§2) will re-clamp under the registered footprints and the planted
    scenery, but a layout that NEEDED the self-heal was mis-planned.

    **THE ONE-LINE VERSION OF BOTH HALVES OF THIS RULE: a street node is not
    automatically a `keepDry` cell.** Round 13's park B wrote
    `const KEEP_DRY: XZ[] = [...NODES];` — all 29 nodes, unfiltered — which is
    simultaneously TOO MUCH (it guards the far-corner nodes that exist only to
    spread the street bbox, two of them inside the pinned row's published basin
    boxes) and TOO LITTLE (not one pad, hut, lane, stall anchor or prop cell is in
    it). It cost **−3 `waterRePicked`** with the secondary centroid **27.1 u** off
    its row, plus two `plantedInWater` refusals for **−2 scenery and −2 trees**:
    **−7 for one line.** Build the list as the UNION of the cells you pave and
    stand something on, and then run the two mechanical guards §1-W ships —
    **`assertKeepDryOffRow(KEEP_DRY, SEED_ROW)`**, which throws naming every
    offending cell, and the **`<DryScatter>`** sieve, which drops a wet planting
    cell instead of letting the gate REFUSE it. Both are copy-paste blocks; neither
    is advice.

    **AND "EVERY SCENERY CELL" MEANS THE DRESSING TOO — IT IS THE HALF THAT GETS
    DROPPED.** Every hand-sited `<Scenery>` and `<Placed>` cell belongs in
    `keepDry` **or** must be re-checked with **`park.isDryCell([x, z])` AFTER
    composition** and moved if it comes back wet (§0.17 — the §1 table is
    PRE-guard, so "it was on grass in the seed row" proves nothing). Round 12's
    park B listed nodes and pads only; the composer then re-picked the body into
    the quadrant where a gazebo, a picnic table and a tree already stood and
    REFUSED all three as **`plantedInWater`** — three props gone, three §0-FATAL
    lints, and a bare corner where a district's dressing was supposed to be.

    **BUT CLAIMING TOO MUCH SHRINKS THE WATER AND FAILS `terrain` — STATE THE
    TENSION AND SIZE THE LIST TO IT.** `keepDry` does not merely *avoid* water, it
    **pushes the body out of every cell you claim**, so an over-broad list leaves
    a lake too small to be a lake: the same park ended at **2 % water against the
    temperate 4-22 % band**, `terrain` FAILED, and its secondary body was too
    small to dominate its own flank (axis 8 also wants secondary ≥ 16 % of the
    dominant). The two halves pull opposite ways, and the resolution is not a
    compromise but a discipline:
    * guard **what you pave or stand a structure or a prop on** — cells, not
      regions, and never a rectangle "to be safe";
    * use **`noDress`** (which moves nothing) where all you wanted was bare
      ground, not `keepDry` (which moves the heightfield AND the water);
    * **plan the districts around BOTH published bodies** (§0.0 step 3) so the
      dressing never needs to sit where the water wants to be;
    * then check the total: the climate band is in §0.10 / §1 and the number lands
      in the header's `DRESS` line. **Guard your dressing; do not claim the plot.**
19. **ASK `offPathCell` FOR EVERY PAD AND EVERY PROP CELL — a hand-derived
    placement coordinate is a DEFECT (wave-10 gate).** Every ride pad, every
    stall anchor and every scenery / prop / fountain cell must be RUN THROUGH
    `offPathCell` (or justified against `pathClearance`) before it is written
    into the park — **including the ones you derived correctly from a queue tail:
    `tail + out·(laneLen + 0.35 + front)` is a CANDIDATE, and the call is what
    turns it into a pad** (§0.4's construction). The two exemptions are the
    PUBLISHED POSES whose clearances are already measured: a §4.0 archetype's
    `start` and §4.2-A's monorail `position`, both copied verbatim.

    **SO IF YOU FACTOR THE DERIVATION INTO A HELPER, THE HELPER'S LAST LINE IS THE
    CALL: `return assertPadFlat(offPathCell(NET, pad, { clear: padMarginOf(rig) }) ?? pad, …)`. A DERIVED PAD IS
    NOT A LEGAL PAD.** Round 12's `place(tail, out, cap, front)` got the tail-first
    arithmetic exactly right and then returned the raw sum, so three of its six pads
    needed a `padOnStreet` auto-move — and the auto-move for Hollow Hall put it **on
    top of Pulse Spinner**: the park's only OBB overlap, **5 `footprints` FAILs**,
    ride spacing 0/8. The formula being correct is not the point; the call is the
    point, and a helper is exactly where it goes so it cannot be skipped per-ride.
    The helpers ship with the placement API and are already in
    the canonical import block below:

    ```tsx
    import { offPathCell, pathClearance } from './components/Park'; // §0.14 API

    pathClearance(NET, [-12, 9.6]).clearance       // 0 → that cell IS a street node
    offPathCell(NET, [-12, 9.6], { clear: 1.8 })   // → [-13.8, 10.8] — USE THIS NUMBER
    // THE FOUR VALUES, and there are only four. ONE of them is not a constant:
    //   clear: padMarginOf(rig) — a RIDE PAD. max(1.8, padHalf + 0.55 + 0.05) on the
    //                 rig's RENDERED half-span, so it is a MESH property and capacity
    //                 never enters it. 3.2 is only the COMPACT-FLAT default. Flats:
    //                 GhostTrain/HauntedMansion 4.77, PaddleBoats 3.12, Discotron 3.07,
    //                 FerrisWheel 2.97, AetherBalloons 2.95. TRACKED spans go MUCH
    //                 higher: GearworksExpress 8.4, RiverRapids 6.6, MagneticRide 5.4,
    //                 MoonlitBarge 4.8, Helicycles/MotionSimulator 3.2. NOT 1.8, and
    //                 NOT a constant: round 13 shipped 1.8 on all seven of its pads for
    //                 nine `padOnStreet` lints and 6 `footprints` FAILs, and round 14 B
    //                 shipped the flat 3.2 for a `padNearStreet` on every big rig.
    //                 Full 12-row table: `-skeletons.md` §3.1-A step 5 (`PAD_MARGIN`).
    //   clear: 1.8  — a BUILDING (restroom / hut / hand-placed stall / kiosk)
    //   clear: 1.2  — any <Scenery>/<Placed> prop (pathWidth/2 + ground radius,
    //                 ≈ 1.15 for a planter on a 1.1 slab — 1.2 is the lattice step)
    //   clear: 0.75 — the TREE SCATTER. It is the fourth value, it is easy to forget,
    //                 and forgetting it is what floored axis 9 to 0/5 in round 14 A.
    // Opts: { streetNodes, isDry, size }.
    ```

    These are not convenience tooling, they are the ONLY sanctioned way to
    produce those coordinates: they compute exactly the clearance the fatal
    lints measure, so a cell they return cannot be the one that fails. Wave-10's
    Stormhollow hand-computed every pad instead and paid **4 fatal
    `padOnStreet` + 6 `blockers` + 3 scenery-in-the-street FAILs** for cells
    `offPathCell` would have handed it — the call it never made was one line
    above in its own import block. §0.14 states the rule the `clear` value comes
    from; heed the two limits it also documents: `offPathCell` audits the
    STREETS plus dryness and bounds and **does NOT know about your other pads,
    stalls or scenery**, so check its answer against your committed footprints
    (pitch ≥ 6 u, footprint table) — and a **`null` return means RE-PLAN THE
    STREETS** (the skeleton is too dense there; use a set-piece, §3.1), never
    shrink the clearance.

20. **THE CROWD SIZES ITSELF — do NOT hand-pick `guests` (2026-07 gate).**
    `<Park guests>` now DEFAULTS to `guestsForSize(size)` and a park that
    over-rides it usually gets it wrong: every big-plot park in the corpus
    hand-wrote `guests={18..20}` and every one of them renders as an empty green
    field with a few figures on it. Omit the prop unless the park must open on an
    exact roster.

    | `size` | 16 | 32 | 48 | 64 | 96 | **128** | 160 | 192 |
    | --- | --- | --- | --- | --- | --- | --- | --- | --- |
    | opening population | 13 | 20 | 26 | 31 | 41 | **50** | 58 | 66 |
    | hard ceiling | 26 | 40 | 52 | 62 | 82 | **100** | 116 | 132 |

    `guests(size) = clamp(round(50·(size/128)^(2/3)), 6, 80)` — the crowd grows
    with the CUBE ROOT OF PLOT AREA, the exponent fitted to the only two counts
    the corpus ever validated by eye (16 → 10, 48 → 21 mean) and re-anchored on
    50 at the 128 default.

    **And they keep arriving.** With a `<Gate>` mounted, guests stream in through
    the archway for as long as the park deserves them — RCT2's own guest
    generation (`Park.cpp:168-231`), gated on the park rating, which on this
    fleet is dominated by the share of guests over `happiness > 128`. Measured on
    a 50-guest park: **20.3 arrivals/min at ≥ 83 % happy, 2.0/min at 0 %**, so a
    well-run park fills to its ceiling in a few minutes and a mobbed or filthy
    one drains. Two consequences for planning:

    - **Give the crowd somewhere to go.** RCT2's soft cap
      (`suggestedGuestMaximum` = Σ ride BonusValue) quarters the arrival rate
      once the population passes it, so a park with ONE ride throttles itself to
      a quarter rate from ~40 guests up. Measured: 6 rides + 3 stalls grew
      50 → 120 in 240 sim-s; 1 ride crawled 50 → 73 and then drained back to 48.
    - **Ride ratings pay twice.** An unrated ride still costs the park RCT2's
      −100/−200 rating baselines (`RideHasRatings`, `Park.cpp:435`), so pasting a
      real `rateCoaster` triple into `register={{ ratings }}` (§0.16) raises the
      rating AND the crowd.

    Cost, measured (`probe-gate-stream.mjs perf`, `probe-gate-live.mjs` on the
    seed-1 192 reference park): **13 draw calls / 2 440 tris and ~0.9 µs of
    sim per guest per frame.** Opening 20 → 66 on the same park is +507 draws,
    +0.10 M tris and −7 % fps; running at the 132 ceiling is +1 157 draws,
    +0.22 M tris and −18 % fps, i.e. ~1 % of the area-scaled mesh budget. The
    smoke run itself costs 218 → 697 ms. Guests are frustum-culled per rig but
    the ride runtime's LOD tiers do NOT reach them (the whole crowd is ONE
    park-spanning runtime entry, which always classifies NEAR) — so keep the
    ceiling in mind before raising `guests` by hand.

21. **THE PARK-SPANNING MONORAIL — MANDATORY, AND NOW GATED BEFORE THE BUNDLE.**

    > **THIS IS NO LONGER A STOP-CHECK YOU CAN TALK YOURSELF PAST.**
    > `harness/park-eval/preflight.mjs` REFUSES TO BUNDLE a park at
    > `size >= 64` that mounts no `<Monorail>`, in the same class of gate as the
    > missing `<Park roster>` prop: no esbuild, no page, no `validatePark` line, no
    > evidence, exit code 1. It was made a gate because the prose failed TWICE.
    > Round 12 dropped the ring; round 13's park B dropped it again and wrote the
    > reasoning down — *"Given the accumulated complexity and one-shot constraint,
    > I'll make pragmatic simplifications… use flat/self-contained rides where
    > possible"* — on a park that had already been told, in this file and in two
    > skills, that pasting §4.2-A is ZERO-RISK and that skipping it is the only
    > move with a cost. **Paste the block. There is nothing to weigh.**
    >
    > (The gate skips a file that authors no `<Park>` of its own, any plot under
    > 64, and a closed list of pinned pre-mandate reference fixtures. There is
    > deliberately no in-file marker that suppresses it.)

    > **THEN ANSWER ALL THREE, in writing, before you call the park
    > finished:** *`<Monorail>` mounted?* · *a platform in every declared world
    > (count ≥ world count, and **`probe.monorail.worldsTouched` ===
    > `probe.monorail.worldsDeclared`** — BOTH ARE COUNTS, `probe.mjs:907-908`; the
    > NAMES are in `worldsTouchedIds`, and `everyWorldTouched: true` IS that
    > equality)?* · *do the ring's 16
    > ground cells clear both of your §1 row's water bodies (§0.0 step 10)?*
    > **If any answer is no, the park is not finished.** Round 12 shipped
    > `everyWorldTouched` **2 of 3** with all four platforms mounted — one world's
    > rect simply sat off the ring — and put the West deck inside seed 7's tarn.
    > §4.2-A is
    > VERIFIED (clearance 16.66, gap 1.800, nothing synthesized, 0 warnings), it
    > is inlined verbatim in §0.0 step 10, and its beam flies 2.45 u over water,
    > streets and stalls alike — **there is no risk to weigh here.** Not shipping
    > it is a guaranteed −1 plus an empty TRANSPORT category.

    Every park carries one, so check it here like any other ride:
    - the piece list is §4.2-A **verbatim**, declared `TrackPiece[]`, no casts,
      and the TAIL IS TWO STRAIGHTS (merging them reads `closure.gap` 17.80 and
      is FATAL — measured);
    - `position` is the **START POSE**, not the ring centre. At 128 that is
      `[−42.6, 0, −9.7]`, which centres the ring on (0, −8.4). The ring grows
      **EAST (+x)** and straddles the start in z, so the LEGAL START at 128 is
      x ∈ [−63.6, −21.6], z ∈ [−22.8, 20.4] on the lattice;
    - `beamY: 2.6` — beam soffit 2.45 u, i.e. **2.36 u over a footpath slab**
      against the 2.2-u overfly gate (check 11). The 1.2 default BLOCKS streets;
    - the four deck centres are `[−42.6, 2.6, −8.4]` · `[0, 2.6, 34.2]` ·
      `[42.6, 2.6, −8.4]` · `[0, 2.6, −51.0]` at that start. Each one needs a
      street node for its queue TAIL at `deck ± left·6.6` and NOTHING within
      6.0 u of the deck pad itself (check 14). **W/N/E take `+left` (the ring
      interior); the SOUTH platform takes `−left`, so its tail is `[0, −57.6]`,
      `queueDir [0, −1]`** — an INWARD south queue costs axis 7 1.5 points on seed 1
      temperate (`-monorail.md`, "WHY THE SOUTH PLATFORM QUEUES OUTWARD");
    - **AND THOSE FOUR TAILS ARE DEAD ENDS BY CONSTRUCTION — DO NOT RUN A STREET
      PAST ONE.** The tail sits 6.6 u from its deck along the lane axis, so a street
      continuing one more cell past `[−36, −8.4]`, `[36, −8.4]` or `[0, −57.6]` runs
      through the
      platform pad 6.6 u further on: *`blockers`: street edge runs THROUGH … pad*,
      which is r12a's exact failure. Author those three as **leaves** — W and E from
      the ring's INTERIOR, SOUTH from OUTSIDE along z −57.6.
      **The NORTH tail `[0, 27.6]` is the ONE exception:**
      its deck is at `z 34.2` with the beam overhead, so a row along `z 27.6` passes
      under the beam and misses the pad — that tail, and only that tail, may be a
      through node (skeleton B's east arterial does exactly this);
    - **`everyWorldTouched` IS MEASURED ON THE MONORAIL GROUP'S BOUNDING-BOX
      PERIMETER**, so a world rect that never reaches `x ±44` / `z −52.8…36` reads
      `worldsTouched: 1` however grand the world is. Give each world **one
      `include` cell aimed at the ring** (e.g. `[-38.4, 33.6]`) — `include` cells
      are not placements, are never guarded and cost nothing;
    - **the four deck CELLS `[±42.6, −8.4]` · `[0, 34.2]` · `[0, −51.0]` — plus the
      four tails, four queue anchors and three exit huts — are walked against BOTH
      of the §1 row's water basins BEFORE the seed is pinned** (§0.0 step 10 has the
      cell list, the measured seed shortlist and the two verified pins). A deck
      inside a basin is not a wet ride, it is a SHRUNK LAKE: `keepDry` lifts the
      cell and pushes the body out, and round 12's West deck took seed 7 temperate's
      tarn from 405 → 144 u², `secondFrac` 0.53 → **0.15** against the 0.16 floor,
      for two `terrain` FAILs. If a basin collides, **translate the ring rigidly**
      inside the legal start range above — the whole cell table and corridor table
      move with it — or pin another seed;
    - `queueDir === left` (the ring INTERIOR) on every platform, paired with
      that platform's heading — the §4.2-A table. A `queueDir` along the deck
      axis spears the platform and is auto-flipped (§0-FATAL);
    - **THE RING DOES NOT SATISFY THE GATE-WALK BUDGET BY DESIGN** — a ring that
      has to reach every district cannot also hug the gate. Centring it on
      (0, −8.4) rather than the origin gets the SOUTH platform as close as the
      ring geometry allows, but that is still **24.0 u along the streets from
      the turnstile — past the 20-u practical maximum, and 24 u FAILS the smoke
      window on its own** (§0.3 check 1). The monorail does NOT satisfy the
      gate-walk budget: ship a separate NON-monorail ride with its queue tail
      inside 15-20 u of the gate to carry the smoke cycle;
    - `price: 0`. RCT2 waives the rating/price/crash/weather checks only for a
      FREE transport ride (`entity/Guest.cpp:2048-2053`), and only a free one
      will be boarded by a guest already leaving the park (`:1989-1998`).

22. **PASS ONLY PROPS THAT EXIST, WITH VALUES OF THE RIGHT SHAPE — AN INVALID
    PROP VALUE ON A RIDE ZEROES THE ENTIRE PARK.** This is the single most
    expensive line you can write in a park file, and it costs more than every
    other item on this list combined.

    **What happens, mechanically.** A ride wrapper builds inside the **Stage
    build callback**. A throw in there means the callback never finishes, so
    `canvas.__stageApi` is **never published** — and then: no `validatePark` run,
    **no `[Park] validatePark → …` line**, no `registerRide`/`registerStall`
    calls, no meshes, an empty frame. Every axis scores off registrations and the
    probe, so the park scores as if it did not exist. Round 12's park B scored
    **15/100** on one word.

    **The word was `colours="fire"`.** `colours` is typed
    **`RideColourScheme` = `{ track, vehicles }`** — an OBJECT, never a name
    string. `Park/pieces.tsx:285` does
    `const scheme = props.colours ?? rideColourPreset(park.seed + 2, type)`, so a
    string sails past that line and `:400` then reads `scheme.vehicles[0]` →
    **"Cannot read properties of undefined (reading '0')", thrown inside the
    build**. `typecheck` DOES catch it (TS2322) — but **esbuild strips types**, so
    the bundle the harness runs contains the bug regardless. A green typecheck you
    did not run is not a guard.

    * **OMIT `colours`.** The chassis calls
      `rideColourPreset(park.seed + 2, type)` for you and every reference park
      ships without it. If you must pin one, pass the helper's RESULT:
      `colours={rideColourPreset(7, 'steel')}`.
    * **Pass ONLY the props a published block in §4 shows.** An invented prop
      name is usually harmless (ignored); an invented prop VALUE is not.
    * **The general form, because the next invented prop will be a different
      one: an invalid prop VALUE on a ride throws inside the Stage build callback
      and SILENTLY ZEROES THE PARK.** There is no lint, no failure line, no red
      mesh — the report is simply absent.
    * **HOW TO RECOGNISE IT:** if the probe says
      **`notes: ["no __stageApi — not a Stage scene"]`**, most sections missing,
      and there is a **`[pageerror]`** in the page log with **no `validatePark`
      line anywhere**, that is THIS — an invalid prop value on a ride — **not a
      harness stall**. Read the `[pageerror]` message: it names the property.
      Triage table: `park-generation-validation.md` §6.1.

23. **AND THE MIRROR-IMAGE FAILURE: A PROP THAT DOES NOT EXIST IS SILENTLY
    DROPPED.** Item 22 is an invalid prop VALUE, which throws. An invalid prop
    NAME does not throw — the chassis sweeps it into `...rest`, the component uses
    its default, and the park is wrong somewhere else with no lint, no error and no
    console line. **Two have shipped:**

    * **`<Monorail start={…} heading={…}>`.** `<Monorail>` is a `composableRide`,
      so its transform props are `position` and `rotation` (RADIANS) like every
      catalog ride; it always compiles from its own local origin `[0, beamY, 0]`.
      `start`/`heading` belong to `compileTrackPieces`, which it calls internally.
      Round 13's park A passed both: the whole 85-u ring mounted **at the park
      origin**, `monorail.worldsTouched` **0** against 3 declared, one dead street
      node and a 1.2-u spur measuring a **1.57e14** grade — with `registered true`,
      `circuitClosed true` and `worstClearance 16.66`. **A correct compile in the
      wrong place is always a transform-prop bug.** Correct:
      `position={[-42.6, 0, -9.7]} rotation={0}`, and keep `rotation` at 0 — the
      published deck/corridor/keepDry tables are all in the WORLD frame at that
      pose. **Translate the ring; never rotate it.**
    * **`register.queueAnchor`.** `RideRegisterProps` is exactly
      `{ name, capacity, rideDuration, loadTime, intensity, price, queueSurface,
      exitSurface, board, stations }`. Station 0's lane is `queue={{ anchor, dir }}`
      at the component's TOP level; `queueAnchor`/`queueDir` exist only INSIDE a
      `register.stations[]` entry. Same word, two types, and putting it on
      `register` leaves platform 0 with no lane.

    **THE GENERAL RULE: pass only props a published block in these documents
    actually shows.** If you are writing a prop name from memory rather than
    copying it, stop — §0.0-F.

24. **A SET-PIECE'S `position` IS ITS SOLID CENTRE — NEVER A STREET NODE, NEVER A
    QUEUE TAIL.** This is the single most expensive coordinate in the corpus,
    **~11 points.** Round 13's park A wrote
    `fountainPlazaPlan({ id: 'viewpoint', position: [50.4, −8.4], tiles: 9 })`, put
    `[50.4, −8.4]` in `NODES` as index 20, **and** used it as the queue tail of both
    the Sunspire Tower and the Discotron. That one cell produced
    **`edgeThroughSolid` ×2** (§0-FATAL) · a **DROPPED edge** · **1 orphan island** ·
    the **`accessibility` FAIL** · the tower **unreachable** · **5 of 6 `footprints`
    FAILs**.

    A plaza is a paved SOLID basin; its connectors are its **PORTS**, one lattice
    cell outside the footprint. Wire `'viewpoint:W'` and put the node OUTSIDE. Ship
    `assertNodesOffPieces(NODES, ALL_PLANS)` at module scope (§3.1's skeleton) with
    `SOLID_CLEAR = { FountainPlaza: 1.8, Bazaar: 0.6, Boulevard: 0 }`, and run it
    again over the pads once they come out of the fuse. **And grep it by hand too:**
    every `plan({ position: [x, z] })` literal against `NODES` and every tail const.

25. **THE PAD REACH IS A FORMULA AND `clear: padMarginOf(rig)`, NOT AN INVENTED `front` AND NOT
    1.8.** `front` is `layout.front`, frozen into the component at
    `composableRide()` time (default 1.8; `<Discotron>` 4.0, `<BumperCars>` 2.6) and
    unreadable while authoring — **do not put it in a helper signature.** Author the
    floor plus **TWO** lattice cells and ASSERT one:

    ```
    laneLenOf(c) = max(2.2, 0.6 + 0.56·c + 0.5)        (ParkBuilder/placement.ts:79)
    minReach(c)  = laneLenOf(c) + 0.35 + 0.62 + 0.50 + 0.45
                   lane        join   hut   hut½   pad½
    cap 4 → 5.26 · 6 → 6.38 · 8 → 7.50 · 10 → 8.62 · 12 → 9.74
    WORKED: cap 12 ⇒ laneLenOf 7.82 ⇒ 7.82+0.35+0.62+0.50+0.45 = 9.74 u

    reach  = minReach(c) + 2.4            ← AUTHOR this (7.66 / 8.78 / 9.90 / 11.02 / 12.14)
    assert  got >= minReach(c) + 1.2      ← and REFUSE below this (6.46 / 7.58 / 8.70 / 9.82 / 10.94)
    ```

    **`+ 1.2` IS NOT ENOUGH, MEASURED WAVE 17 — AND THE REASON IS A SECOND FROZEN
    FIELD.** The floor is enforced against the **`boardPoint` pad**, which on a
    `composableRide` is NOT at `position`: it sits at `position` + the rotated
    **`layout.board`**, and local +z is the face the queue runs into, so the
    boardPoint sits **nearer the tail** than `position` does. `<Discotron>` ships
    `board: [0, STAGE_H, 1.4]`, so `reach = minReach(12) + 1.2` = 10.94 put the
    boardPoint **9.54 u** from its tail against the **9.74 u** floor →
    `footprints` FAIL, *"entrance hut overlaps boardPoint pad"*. Like `front`,
    `board` is unreadable while authoring, so **do not look it up — buy two cells
    of slack and assert one.**

    Round 13's park A used `clear: 1.8` with per-ride invented `front` values and
    checked nothing: the Discotron's pad landed **4.43 u** from its tail against that
    **9.74 u** floor — **nine `padOnStreet` lints and 6 `footprints` FAILs.**
    `clear: padMarginOf(rig)` is the RIDE-PAD value — `max(1.8, bodyHalf + 0.55 + 0.05)`,
    of which 3.2 is only the COMPACT-FLAT default (a `<GhostTrain>` wants **4.77**); 1.8
    is for BUILDINGS and 1.2 for props. `<Discotron>` and `<AetherBalloons>` both
    default to capacity **12**, so a court sized for a Carousel holds neither.
    `laneLenOf` imports from `./components/ParkBuilder`, **not** the Park barrel.

    **AND THE LANE THE PAD SITS BEHIND IS A SOLID: KEEP EVERY STREET ≥ 2.4 u OFF
    THE SEGMENT `[tail − dir·(laneLenOf(c) + 0.35), tail]`.** A lane laid across a
    street cost **six** failures in one park — 2 `blockers` on its own railings plus
    4 downstream rides *"reachable only THROUGH a solid object"*, because the
    railing severed the single route past it. Full statement in check 4.

26. **EVERY WORLD CARRIES ≥ 3 NAMED THEMED SCENERY PIECES, INSIDE ITS RECT — AND
    TREES DO NOT COUNT.** Round 13's park A scattered 34 trees and reported
    **`sceneryCount: 0` on all three worlds**, because it imported **no `*Scenery`
    pack at all.** The five packs and their only exports:

    | pack | exports |
    |---|---|
    | `PulseScenery` | `NeonArch` `SpeakerStack` `MirrorBallPylon` `LaserTruss` `LightTiles` |
    | `BrassworkScenery` | `GiantGear` `SteamPipes` `ClockTower` `BoilerTank` `CoalCart` |
    | `ThornwickScenery` | `GiantToadstools` `StandingStones` `LanternTree` `RuinedArch` `FlowerPodBed` |
    | `EmberfallScenery` | `Fumarole` `ObsidianShards` `BasaltColumns` `LavaFissure` `CharredSnag` |
    | `TidewaterScenery` | `WreckedHull` `CoralCluster` `AnchorPile` `TidePool` `DockPilings` |

    Each is a plain `composable`: `position` / `rotation` / `scale` plus its own
    options — no `register`, no `name`, no plan. Every cell goes through
    `offPathCell(NET, c, { clear: 1.2 })`, through the dryness predicate, **and into
    that world's `worldPlan({ include })`** — a cell outside the rect is
    `unplacedThemed` and counts for nothing. Assert it: `w.contains(c)` for ≥ 3 cells
    per world.

26b. **WHICH THREE PRESETS — NOT JUST HOW MANY (added 2026-07-26).** "≥ 3 worlds"
    was the whole rule and every worlds park in the corpus declares exactly 3, so
    the count stopped discriminating. **Measured over the 10 corpus parks that
    declare any world (`signatures/*.json` → `worlds.builtPresets`): brasswork
    **7** · pulse **7** (DECLARED by 10 of 10) · thornwick **5** · emberfall
    **3** · tidewater **2**.** Three separate parks — `coolpark`, `r12a`,
    `worlds-ref` — built the *identical* brasswork + pulse + thornwick trio.

    **So: at least ONE of your three worlds must be a preset the corpus
    under-uses.** As of 2026-07-26 that is `tidewater` (2) or `emberfall` (3) for
    the full 0.5 of axis 16's CHOICE term, `thornwick` (5, at the median) for
    0.25, and brasswork + pulse + anything for **0**. The threshold is the corpus
    MEDIAN, recomputed on every probe (`probe.worlds.presetUsage`), so re-read it
    rather than trusting this paragraph's numbers after a few more parks.

    **No preset is unusable and there is no structural excuse.** All five have
    BUILT at least twice, all five still ship their own rides, stall and five
    scenery pieces (47/47 `COMPONENT_THEME` keys resolve, audited 2026-07-25).
    The rarest, `tidewater`, owns the largest circuits in the catalog
    (`ReefRacer` mounts 29.6 × 43.4 u, `OceanTunnelSlide`, `DeepDrift`) — budget
    the rect for them, do not skip the world. **And every preset has ≥ 1 circuit
    nobody has ever built** (emberfall `MagmaRun`/`LavaTubeRun`, tidewater
    `DeepDrift`/`OceanTunnelSlide`, brasswork `GearworksExpress`, thornwick
    `WyrmsHollow`, pulse `Bassline` — all seven compile their own default clean),
    so the under-used preset pays axis 16's CHOICE and axis 13's novelty at once.

27. **THE ROSTER'S `stalls` IS ARITHMETIC WRITTEN FROM THE REGISTRATION, AND IT HAS
    NOW MISSED IN BOTH DIRECTIONS.** `rosterOverstated` fires on any mismatch.
    Round 13's park B *over*stated (it counted its `stalls: [...]` arrays, 2 each →
    6, and `bazaarPlan` padded each row to 3 ⇒ 9). Round 13's park A *under*stated:
    it counted shopping **ROWS** and wrote `stalls: 5` against **10** registered.

    ```
    stalls = Σ over bazaar rows of plan.slots.length   ← POST-padding; never the
                                                         array you typed, never the
                                                         number of rows
           + the standalone stands you mount by hand
    WORKED (round 13's park A): 3 rows × 3 slots = 9, + 1 <BalloonStand> = 10.
    ```

    Derive it in code — `BAZAARS.reduce((n, b) => n + b.slots.length, 0) +
    HAND_STALLS.length` — and build `rides` out of the same `RIDE_ENTRIES` array the
    `register={{ name }}` calls read from. **And there is no "it already sounds
    flavourful" exemption on a ride name:** round 13's park A themed eight rides and
    shipped `register={{ name: 'Discotron' }}` — the catalog default — because
    *Discotron* reads better than *Carousel*. The axis compares the string to the
    component's default and does not care. Every registered ride, including each
    world's flagship and the ring, is a row in `RIDE_ENTRIES`.

### Footprint table — ride spacing you can compute on paper

Each registered ride occupies roughly (local frame, +z = queue face):

| part | extent | source |
|---|---|---|
| pad | ~2.4 × 2.4 around the position (the BODY blocker is the built mesh's own box) | `registerComposedRide` |
| queue lane | out the queue face: **`laneLenOf(capacity) = max(2.2, 1.1 + 0.56·capacity)`**, starting at `front` and + 0.35 to its street node | `placement.ts:79` |
| `front` | 1.8 by default, but auto-raised to `min(6.5, footMaxZ·scale + 1.27)` for any rig spanning ≤ 10 u — i.e. NOT knowable from props (§0.4) | `configurableRide.tsx` |
| exit hut | ~1×1 (slab 1.09 × 0.94) ONE TILE along the queue face from the entrance hut, `exitDir = queueDir` — the RCT2 pair (§0.4b). `RideLayout.exit` is only a SIDE HINT | `registerComposedRide` |
| EXIT PATH | out the SAME face as the queue, one tile over: the RAY to the first street on it, else the JOIN — out level with the queue tail then one tile onto it. So budget `laneLenOf(capacity) + 0.35` again, and TWO free tiles side by side on the face (§0.4b) | `GameManager/access.ts planExitLane` |
| stall | solid body hx 0.6 × hz 0.42 on the anchor; audited apron hz 1.01; guest attach 0.72 out the serving front | `GameManager/registry.ts:210` |

Worked example, two capacity-4 rides on the same street: `laneLenOf(4)` =
3.34, so the tail node sits `front + 3.69` out (5.49 with the 1.8 default,
6.82 for a Carousel whose real `front` is 3.13); pad half-width 1.2 plus the
exit hut one tile off the entrance on the SAME face. Two such footprints only clear each
other at centre-to-centre pitch **≥ 6 units** (5 lattice steps of 1.2) —
closer and the SAT sweep collides. Stagger rides on opposite street sides to
pack tighter, and keep every pad ≥ 1.8 u off the lattice itself (§0.14).

### Canonical imports (copy exactly — wrong sources broke round-1 parks)

**THE TYPE LINE IS ONE LINE AND `./components/Park` IS ITS SOURCE.** `V3` *and*
`XZ` are both re-exported from the Park barrel (`components/Park/index.tsx`), so
there is no reason to reach into `SetPieceKit` for a coordinate type. `NetRef`
still lives in `SetPieceKit` because it is a net concept, and `TrackPiece` in
`SplineRideKit`:

```tsx
import type { V3, XZ } from './components/Park';          // ← the canonical line for BOTH
import type { NetRef } from './components/SetPieceKit';   // net edge endpoints only
import type { TrackPiece } from './components/SplineRideKit';
```

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

**EVERY component's `Context.md` now opens with its own exact import line**
(`**CANONICAL IMPORT — copy exactly:**`) — copy it from there instead of
guessing, and never merge two components into one specifier. A round-8 park
wrote `import { FerrisWheel, Teacups } from './Park'`: Park exports neither,
esbuild refused the WHOLE bundle, and the page rendered black for a 3.5/100.
A wrong import is not a small mistake — it is a total loss.

### Catalog inventory — if it exists, USE it (reinventing is a defect)

A round-2 park hand-built a "carousel", "teacups" and trees out of raw
primitives — black blobs and crashes. Custom one-off ride/tree/prop builders
are a DEFECT, not creativity: **if it's in the catalog, use the component.**
What exists (each in `./components/<Name>`, composable, `register`-ready):

> **EVERY RIDE AND STALL BELOW IS `register`-READY. IF A `Context.md` SAYS
> OTHERWISE, THIS FILE WINS.** `components/Park/Context.md` still carries a stale
> line — *"Preview-only rides have no builders yet (FerrisWheel, Carousel, the four
> food shops…): compose them via `<Placed>` + `usePark().manager()` today"* — which
> is **FALSE and has been for several waves**: FerrisWheel, Carousel, Teacups,
> DropTower, GhostTrain and all four food shops register normally, and multiple
> shipped sample parks prove it. Do not compose a catalog ride through `<Placed>`,
> and do not cut your roster over that sentence (round-11's park B nearly dropped
> to four rides reasoning about it). Mount the component with `register`.

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
  | `<Monorail pieces>` | piece-composed, `profile: 'monorail'`; vertical pieces are STRIPPED | Monorail / 6 / 12 / 1 / 2 | the best plot-spanning device there is: a long circuit that RIDES OVER the districts. It is MULTI-STATION — the verified block ships FOUR platforms, one per district — and each platform needs its OWN queue plus its OWN connected exit lane, individually gated by check `a4b`. **Use the VERIFIED four-platform block in §4.2 VERBATIM — COPY IT, DO NOT IMPROVISE A CIRCUIT.** Pasting it is a ZERO-RISK action (worst clearance 16.66, gap 1.800, nothing synthesized, 0 warnings, measured by `harness/park-eval/probe-monorail-grand.mjs`); what was fatal for two rounds was IMPROVISING — Monorail's own documented starter loop is a district-scale illustration only, not the park-spanning circuit — a hand-authored beam loop that compiles FATAL is not a registered ride at all (no station, no queue, and the transport slot you thought you filled is empty). **THE RING ALSO DOES NOT SATISFY THE GATE-WALK BUDGET** — pair it with a separate near-gate ride (§4.2) |
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
  coaster (§0.11) — budget its footprint with the run-length table. **And `pieces`
  is OPTIONAL on every row above except `<Monorail>`'s park-spanning ring: omit
  it and the component ships its verified stock layout with no
  `compileTrackPieces` call at all.** Pass `pieces` ONLY when you are copying a
  published block (§4.0-D lists which rides have one — the flume, rapids,
  chairlift, bobsleigh and kart courses do NOT yet).
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

  **A `<Bazaar>` HAS A 3-6 STALL FLOOR, AND UNDER-DECLARING IT MOVES YOUR PADS.**
  `bazaarPlan` clamps `stalls` to 6 and **AUTO-PADS anything under 3 with a
  `'balloon'`** (`Bazaar/index.tsx:172`, non-fatal `bazaarStallCount` lint). The
  padding is not cosmetic: `k` decides `tiles = 2k + 1` and `half = 0.6·tiles`, so
  2 → 3 stalls takes the row from `tiles 5 / half 3.0` to `tiles 7 / half 4.2`,
  moves BOTH port cells 1.2 u outward and re-lays every stall anchor. Round 13's
  park B declared 2 stalls in each of three bazaars, wrote the `tiles 5 / half 3.0 /
  ports ±3.6` arithmetic for k = 2 in its header, and shipped **three
  `padNearStreet` lints at 1.20 u** plus a `rosterOverstated` warning
  (`roster={{ stalls: 6 }}` against **9** registered). **Declare 3-6 explicitly,
  and count the roster off `plan.slots.length` — the POST-padding list — never off
  the array you typed.** The copyable assertion is in the ride-and-stall-roster
  skill; the free way to reach the floor is a themed world stall
  (`NeonSlush` drink, `SushiStall` food, `EmberRoast` food), which also buys a
  stall kind and roster novelty.
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


---

## THIS RECIPE BOOK IS ELEVEN FILES

Read ALL ELEVEN before composing a park; they are one document.

| file | sections |
|---|---|
| `rules/park-generation.md` | intro · §0.0 THE ONE-LINE BRIEF · §0.0b what "cool" means |
| `rules/park-generation-checks.md` | **§0 PRE-FLIGHT CHECKLIST, checks 1-14** |
| `rules/park-generation-checks-b.md` (this file) | **§0 PRE-FLIGHT CHECKLIST, checks 15-27** · footprint table · canonical imports · catalog inventory |
| `rules/park-generation-composition.md` | §1 climate & seed table + **the ring-clearance table** and the ring water-walk |
| `rules/park-generation-worlds.md` | §2 build order · §3 themed lands |
| `rules/park-generation-skeletons.md` | §3.1 SET-PIECES · the three-skeleton comparison table · **§3.1-A, the hub-and-spokes skeleton — REPAIRED 2026-07-26, and the only table that ships TWO coasters** |
| `rules/park-generation-tree-skeleton.md` | **§3.1-B, the promenade-and-arterial TREE** — its node table, measured numbers and placement slots |
| `rules/park-generation-skeletons-b.md` | **§3.1-N why transcribing a table cannot score** (read it BEFORE you copy one) · the set-piece contract |
| `rules/park-generation-rides.md` | §4 rides, the §4.0 coaster archetypes and their bounds, **§4.0-E the CIRCUIT ROSTER (two coasters)** |
| `rules/park-generation-monorail.md` | §4.2 the mandatory monorail ring |
| `rules/park-generation-validation.md` | §5 legality lint · §6 validatePark · **§6.1 TRIAGE: no verdict line / nothing rendered** · §7 reference sketch |

**These files STAND ALONE.** The five published skills (`park-composition`,
`park-skeletons`, `coaster-pieces`, `ride-and-stall-roster`,
`park-troubleshooting`) are the deep
reference and may or may not load in your harness — round 12's generation loaded
NONE of them across 27 tool actions. Everything a park must not get wrong is
inlined here; **where a rule and a skill disagree, the rule wins** (§0.0).

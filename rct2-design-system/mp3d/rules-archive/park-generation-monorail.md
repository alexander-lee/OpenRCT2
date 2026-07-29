# Composing parks — §4.2 THE PARK-SPANNING MONORAIL

Part of the recipe book, split off `rules/park-generation-rides.md` (which
carries §4 rides, §4.0 the coaster archetypes A/B/C, §4.0-E the circuit roster
and §4.1 thrill targets). Every rules file is injected together.

**EVERY PARK SHIPS ONE MONORAIL, and it is what connects the worlds.** Its
stations are transfer points — multiple platforms, each serving a world.

### 4.2 THE PARK-SPANNING MONORAIL — REQUIRED, and here is the verified block

**EVERY PARK SHIPS ONE.** A park-spanning monorail whose circuit passes each
declared world is a STANDING REQUIREMENT (§0 checklist; §3/§3.1 for the
world-by-world rule). It is not decoration and not optional: it is the ride
that ties the districts together, and RCT2's own transport rides are built for
exactly that — `ride/rtd/transport/Monorail.h:19-84` sets neither
`RtdFlag::hasOneStation` nor `hasSinglePieceStation`, so a monorail may own as
many stations as the ride array holds (`std::array<RideStation,
kMaxStationsPerRide>`, `ride/Ride.h:404`, 255 slots — the legacy RCT1/RCT2 save
format caps it at **4**, `rct12/Limits.h:21`, which is why the block below ships
four platforms and the compiler warns past that).

**COPY THE BLOCK. PASTING §4.2-A IS A ZERO-RISK ACTION.** It is VERIFIED end to
end: 4 platforms, worst clearance **16.66** against the 0.9 gate, `closure.gap`
**1.800**, **nothing synthesized**, `fatal` unset, **0 compiler warnings**, and
`validatePark → ok: true` on `samples/monorail-ref.tsx`. There is nothing here to
weigh, audit or de-risk — the measurements are below. **The only risky move is
NOT pasting it**, which costs a point, the TRANSPORT category and the roster
novelty that came with it.

> **AND SINCE WAVE 15 IT IS A PRE-BUNDLE GATE, BECAUSE THE PARAGRAPH ABOVE FAILED
> TWICE.** `harness/park-eval/preflight.mjs` REFUSES TO BUNDLE a park at
> `size >= 64` that mounts no `<Monorail>` — exit 1, no esbuild, no page, no
> `validatePark` line, no evidence, exactly like a missing `<Park roster>` prop.
> Round 12 dropped the ring for "reliability". Round 13's park B dropped it again
> and recorded why: *"Given the accumulated complexity and one-shot constraint,
> I'll make pragmatic simplifications… use flat/self-contained rides where
> possible."* Every clause of that was already answered here — the ring IS
> self-contained, and its compile IS verified — so the sentence was false as well
> as expensive. **The trade-off no longer exists.** (The gate skips a file that
> authors no `<Park>` of its own, any plot under 64, and a closed list of pinned
> pre-mandate reference fixtures. There is deliberately no in-file marker that
> suppresses it.)

> **FOOTNOTE — what was actually fatal was IMPROVISING.** `<Monorail>`'s own
> documented *starter loop* (a district-scale illustration, not a park-spanning
> circuit) blew the 40 % synthesized-closure limit and shipped fatal for two
> rounds, and **a fatal compile is not a registered ride**: the component renders
> translucent red and SKIPS GameManager registration entirely, so the TRANSPORT
> category reads EMPTY with no error anywhere but the console. That is an argument
> for copying the verified block, not for skipping the ride — and it applies to
> every hand-written `pieces` list on every tracked ride (§0.0 step 9), not to
> this one.

**THE RING DOES NOT SATISFY THE GATE-WALK BUDGET — PAIR IT WITH A NEAR-GATE
RIDE.** Its platforms have to reach every district, so by design they sit out
toward the plot's edges (`span = ⅔·size`): even the CLOSEST platform in the
reference park is 24.0 u of street from the turnstile — past the 20-u
practical maximum, so 24 u FAILS the smoke window on its own (§0.3 check 1: 15
u safe / 20 u practical max / 24 u FAILS). The mandatory monorail is never the
ride that carries the sim smoke cycle: ship a separate, non-monorail
attraction with its queue tail inside 15-20 u of the gate to do that job.

#### 4.2-A GRAND CIRCLE — 4 platforms, size 128 (the default plot)

```tsx
const MONO_PIECES: TrackPiece[] = [
  'station',                                     // platform 0 — WEST
  { type: 'straight', length: 35.3 },
  { type: 'turnL', angle: 90, radius: 6 },
  { type: 'straight', length: 35.3 },
  'station',                                     // platform 1 — NORTH
  { type: 'straight', length: 35.3 },
  { type: 'turnL', angle: 90, radius: 6 },
  { type: 'straight', length: 35.3 },
  'station',                                     // platform 2 — EAST
  { type: 'straight', length: 35.3 },
  { type: 'turnL', angle: 90, radius: 6 },
  { type: 'straight', length: 35.3 },
  'station',                                     // platform 3 — SOUTH
  { type: 'straight', length: 35.3 },
  { type: 'turnL', angle: 90, radius: 6 },
  { type: 'straight', length: 33.5 },            // ── the tail, in TWO pieces
  { type: 'straight', length: 1.5 },             //    (see "the tail" below)
];
```

Declare it as a real **`TrackPiece[]`** with **no `as` / `as const` / `as any`
cast** — same rule as §4.0: a cast hides the misspelt `type` that makes the
compile fatal.

- **⚠ THE PROPS ARE `position` AND `rotation`. THERE IS NO `start` AND NO
  `heading`.** `<Monorail>` is a `composableRide` — `ComposableRideProps extends
  ComposableProps`, whose transform fields are exactly `position` (`[x, z]` or
  `[x, y, z]`), `rotation` (a yaw in **radians**), `scale` and `deps`. `start` and
  `heading` belong to `compileTrackPieces`, which the component calls INTERNALLY,
  always from its own local origin `[0, beamY, 0]`. **Pass them to the JSX and they
  are swept into `...rest` and dropped — no warning, no lint, no error.**
  Round 13's park A wrote `<Monorail start={[-42.6, 2.6, -14.4]} heading={0}>`. The
  whole 85-u ring mounted **at the park origin**: `monorail.worldsTouched` **0**
  against 3 declared, one dead street node (the West tail, now serving nothing), and
  a degenerate 1.2-u spur that measured a **1.57e14** grade. The compile itself was
  perfect — `registered true`, `circuitClosed true`, `worstClearance 16.66` — which
  is the signature of this bug: **a correct compile in the wrong place is always a
  transform-prop problem.**
  **CORRECT:** `<Monorail position={[-42.6, 0, -9.7]} rotation={0} beamY={2.6}
  loopSeconds={12} pieces={MONO_PIECES} pinned />` — the first station deck runs
  **+z**, which is what `rotation: 0` means.
  **AND KEEP `rotation` AT 0.** The four decks, the corridor table and the 16
  `keepDry` cells below are all published in the WORLD frame at this pose, so
  rotating the ring invalidates every one of them. If a cell lands wet, TRANSLATE —
  `position` is free anywhere in the legal start range and all 16 cells shift
  rigidly in lattice multiples of 1.2. Translate; never rotate.
  **`position` IS THE START POSE, NOT THE RING CENTRE.** The ring's frame is local
  **x 0..85.2, z −41.3..43.9**, so `position` is the WEST platform's deck START.
  Mounting it at the intuitive-but-wrong ring centre `[0, 0, −8.4]` shifts every deck
  by (+42.6, +1.3) and leaves the registered platforms 42 u off the beam — the beam
  and the boarding huts end up in different districts.
- **GROWTH DIRECTION, in words.** From the start the ring grows **EAST (+x)
  ONLY — the start is the WESTmost point** — and **straddles the start in z**
  (43.9 u north of it, 41.3 u south). So *a start near the +x (EAST) edge is
  THE failure mode*, the mirror image of §4.0's westward rings.
- **LEGAL START at size 128** (measured, `probe-monorail-grand.mjs`):
  **x ∈ [−64.30, −20.90], z ∈ [−23.00, 20.40]** — on the 1.2-u lattice
  x ∈ [−63.6, −21.6], z ∈ [−22.8, 20.4]. The published `[−42.6, −9.7]` sits
  inside both and centres the ring on (0, −8.4).
- **THE FOUR DECKS, one per compass point** (`report.stations`, world frame at
  the published start):

  | platform | deck centre | heading | `dir` | `left` (= ring INTERIOR) |
  |---:|---|---:|---|---|
  | 0 | **[−42.6, 2.6, −8.4]** | 0° (+z) | [0, 1] | [1, 0] |
  | 1 | **[0, 2.6, 34.2]** | 90° (+x) | [1, 0] | [0, −1] |
  | 2 | **[42.6, 2.6, −8.4]** | 180° (−z) | [0, −1] | [−1, 0] |
  | 3 | **[0, 2.6, −51.0]** | 270° (−x) | [−1, 0] | [0, 1] |

  `left` always points at the ring interior, which is where the platform deck,
  its canopy and its stair tower go. The QUEUE and EXIT follow `left` for W/N/E —
  the districts are inside the ring, so an outward queue there serves the apron —
  **but the SOUTH platform queues OUTWARD on the verified pose, because the seed's
  biggest range sits directly inside its interior approach.** See "WHY THE SOUTH
  PLATFORM QUEUES OUTWARD" below before you "tidy" it back.
- **THE RING'S 16 GROUND CELLS — AND YOU WALK THEM AGAINST THE §1 ROW'S WATER
  BASINS *BEFORE* YOU PIN THE SEED.** These are the cells the ring contributes to
  `keepDry`, and `keepDry` does not avoid water, it **pushes the body out of every
  cell you claim.** So a deck inside a basin is not a wet ride — it is a shrunk
  lake, and it fails `terrain` on a park with nothing else wrong with its water.

  | role | cells (at the published start) |
  |---|---|
  | deck pads | `[−42.6, −8.4]` · `[0, 34.2]` · `[42.6, −8.4]` · `[0, −51.0]` |
  | start pose | `[−42.6, −9.7]` |
  | queue tails (authored NODES) | `[−36.0, −8.4]` · `[0, 27.6]` · `[36.0, −8.4]` · `[0, −57.6]` |
  | queue anchors (the HEADS) | `[−40.81, −8.4]` · `[0, 32.41]` · `[40.81, −8.4]` · `[0, −52.79]` |
  | exit huts (platforms 1-3) | `[−1.2, 33.03]` · `[41.43, −7.2]` · `[1.2, −52.17]` |

  **THE SOUTH TAIL IS *OUTSIDE* THE RING (`[0, −57.6]`, `queueDir [0, −1]`) AND
  THAT IS MEASURED, NOT STYLISTIC — see "WHY THE SOUTH PLATFORM QUEUES OUTWARD"
  below.** W/N/E queue inward. The pose itself is unchanged.

  **4 + 1 + 4 + 4 + 3 = 16.** That is the count, and
  `harness/park-eval/samples/skeleton-a.tsx` ships exactly these sixteen as
  `RING_CELLS`. **You will also see the number 15 in the ring-clearance measurement,
  and it is not a contradiction:** the re-compose diff guards 15 DISTINCT cells,
  because the start pose `[−42.6, −9.7]` sits inside deck W's own guard disc and
  dedupes into it. **Walk all 16. Measure with 15.**

  **DO NOT DO THE PAPER CHECK BY HAND — `-composition.md` §1-W SHIPS IT AS CODE.**
  Paste `SEED_ROW_WATER` (every row's two basin boxes and centroids as a const) and
  `assertKeepDryOffRow(KEEP_DRY, SEED_ROW)`, which throws and NAMES the offending
  cells, and run it over the ring's cells together with your own street nodes and
  pad cells — one list, one call. On seed 1 / temperate all **16** ring cells produce
  **zero hits**, which is what "bit-identical" looks like from the sieve's side.
  For reference, the arithmetic it replaces is `|cell − basin centre|` against each
  basin's waterline (≈ `0.74 · radius`) for BOTH bodies of your row.
  **THE MECHANICAL CHECK, which is
  the authority,** is to re-compose with the ring's **15 distinct** `keepDry` cells
  (the 16 above, with the start pose deduped into deck W's guard disc) and diff
  `terrainSeed` / `waterCentre` / `waterCentreSecond` / `probesTried` against the
  unguarded row — see `-composition.md` §1's ring-clearance table, which publishes
  the measurement for all 16 rows. **THREE rows are ring-clean WITH DRY DECKS:
  1 temperate, 31 temperate and 91 desert.** 53 coastal holds its centroids and is
  still unusable — its **WEST DECK stands at `h −0.06`, in the water** (and its
  `secondFrac` 0.17 is 0.01 over the floor besides), which is why the deck-height
  read is part of the check and not an extra. **Of the other twelve, NINE move a
  water body 24–117 u** — 42 alpine dominant **117.1**, 71 temperate **96.4**,
  3 desert **62.5**, 19 desert **61.6**, 7 coastal **60.9**, 8 alpine **55.8** —
  and the remaining three change the landform identity or pay 36-90+ clamp discs.
  Refuse all twelve. **31 temperate is the row to prefer for a NEW layout**: its
  guarded relief **12.02 / stdH 1.32** sits ABOVE the published band, so
  `terrainFlattened` cannot fire on it at all.

  **MEASURED FAILURE, ours, twice over.** Seed 7 draws a west tarn under the West
  deck in every climate that draws one: temperate `(−48.6, −11.3) r 12.6` — the deck
  is **6.66 u** from the centre and **2.64 u inside** the 9.3-u waterline — desert
  `(−48.6, −11.3) r 7.8`, coastal `(−41.1, −9.6) r 7.5` (deck **1.92 u** out).
  Round 12 pinned 7 temperate: `keepDry` lifted the deck, the tarn shrank **405 →
  144 u²**, `secondFrac` fell **0.53 → 0.15** against the 0.16 floor, and the park
  took **two `terrain` FAILs** — which is what made `ok: true` unreachable.
  **Do not pin seed 7 for a ring park in any climate.** On 7 coastal translation
  cannot rescue it either: the east river chain's basins cover deck-E
  `z ∈ (−34.1, 23.5)`, and the whole legal start range is inside that.

  **IF A BASIN COLLIDES, TRANSLATE THE RING — IT MOVES RIGIDLY.** `position` is free
  anywhere in the legal start range above, and all 16 cells plus the corridor table
  shift by the same offset in lattice multiples of 1.2. One line. Re-pinning the
  seed is also one line. **Shrinking a water body is neither.**
- **MEASURED COMPILE** (`node harness/park-eval/probe-monorail-grand.mjs`, the
  real `compileTrackPieces` on `profile: 'monorail'`):
  `report.valid.worst` **16.66** (gate 0.9), `valid.ok` **true**,
  `closure.closed` **true**, `closure.gap` **1.800**,
  `closure.synthesized` **EMPTY**, `report.fatal` **unset**,
  **0 compiler warnings**, 37 control points, `report.stations.length` **4**.
  Bounding box **x −42.60..42.60, z −42.60..42.60, maxY 2.60** (85.2 × 85.2 —
  **44 % of a 128 plot's area**, i.e. it really does ring the park), worst
  |coord| **42.60** against the ±64 bound.
  `rateCoaster(points, { bank: 0.08 })` — the monorail's own `designBank` —
  reads **maxLatG 0.190 g** against the 1.275 g margin (**85 % under**),
  length 330.4, 0 drops, 0 inversions. The beam is FLAT, which is what the
  profile demands: `Monorail`'s whitelist is `station` / `straight` (`flat`) /
  `turnL` / `turnR` / `sbend` / height-less helixes, and `lift`/`drop`/`hill`
  are STRIPPED with a `console.warn` (a §0-FATAL warning) if you author them.
- **THE TAIL IS TWO PIECES AND THAT IS NOT COSMETIC.** `compileTrackPieces`
  POPS every trailing control point within 0.45 u of the start (so the closed
  CatmullRom's wrap cannot kink), then measures `closure.gap` from whatever
  point is left and calls the circuit closed only under `2·TURN_RADIUS·1.1` =
  **3.3 u**. A single 35.0-u tail straight emits a MIDPOINT (every run > 2.4 u
  does), the 0.3-u end point is popped, and the gap is then measured from that
  midpoint: **17.80 u — NOT CLOSED, FATAL.** Splitting the last 1.5 u off leaves
  the final kept point 1.8 u out. Measured both ways. Do not merge them.
- **THE CLOSURE ALGEBRA** (so the shape can be re-derived, not guessed). `turnL`
  advances R along the OLD heading and R along the NEW one, and four 90° turns
  cancel in displacement, so a four-legged ring closes on TOTAL LEG RUNS alone:

  ```
  leg A (start, +z) = station 2.6 + straight a       =: A
  leg B (+x)        = straight p + station 2.6 + p   =: L
  leg C (−z)        = straight p + station 2.6 + p   =: L
  leg D (−x)        = straight p + station 2.6 + p   =: L
  tail  (+z)        = straight e

  final = (L − L, A − L + e) = (0, A − L + e)
     ⇒ CLOSES iff  L = A + e + 0.3          (0.3 u short, already facing home)
  ```

  With `a = p` on the station leg and `e = p − 0.3`, both conditions collapse to
  **one number**:

  ```
  span = the 1.2-lattice value nearest ⅔ · size    (⅙ · size of apron each edge)
  L    = span − 2R          R = 6
  p    = (L − 2.6) / 2      the straight either side of every deck
  a    = p                  tail = p − 0.3, SPLIT as (p − 1.8, 1.5)
  start = [−span/2, 2.6, −1.3 + ringCentreZ]
  ```

  At 128: span 85.2, L 73.2, p **35.3**, tail **35.0** → (33.5, 1.5). ✔
- **CORRIDOR CELLS** (1.6-u sweep, 836 cells, measured — `probe-monorail-grand.mjs`).
  The whole circuit is **2.45 u up**, so on flat grade NOTHING is in
  validatePark's LOW corridor — but these are still the cells a street must not
  be laid *down the middle of*, because that is where the piers land.
  **THE TABLE IS FOR THE RING CENTRED ON (0, 0)** — i.e. `start [−42.6, 2.6,
  −1.3]`. Add your ring-centre offset to every z (the published park centres it
  on (0, −8.4), so subtract 8.4 from each z there); the cells shift RIGIDLY
  with `start`, in lattice multiples of 1.2.

  ```
  x −43.2:  z −40.8..40.8      ← WEST leg (the beam + its pier line)
  x −42.0:  z −42.0..42.0
  x −40.8:  z −43.2..43.2
  x −39.6:  z −43.2..−39.6, 39.6..43.2      ← the two west corner arcs
  x −37.2:  z −43.2..−40.8, 40.8..44.4
  …  (the 62 columns between are the four CORNER ARCS only) …
  x  36.0:  z −43.2..−40.8, 40.8..44.4
  x  39.6:  z −43.2..−39.6, 39.6..43.2
  x  40.8:  z −43.2..−37.2, 36.0..42.0
  x  42.0:  z −42.0..42.0      ← EAST leg
  x  43.2:  z −40.8..39.6
  x  44.4:  z −37.2..37.2
  ```

  Read the same shape rotated for the two along-x legs: **NORTH is the three
  rows z 41.4 / 42.6 / 43.8 across x −40.8..40.8**, **SOUTH the rows
  z −41.4 / −42.6 / −43.8**. Everything else — the whole **76 × 76 middle** and
  the apron outside the ring — is free, and a street may cross UNDER any leg.
- **THE BEAM FLIES OVER STREETS. THAT IS THE POINT.** `beamY: 2.6` puts the rail
  centreline 2.6 u up and the beam SOFFIT at **2.45 u**, measured:
  **2.36 u over a footpath slab** (validatePark's overfly gate is **≥ 2.2**),
  0.35 u over a stall canopy (strict re-audit needs ≥ 0.3), 0.95 u over an
  entrance hut. `beamY` DEFAULTS TO 1.2 for the legacy shuttle — **pass 2.6 or
  the beam blocks every street it crosses**. Piers auto-extend to grade.
- **`queueDir` WITH ITS HEADING, per platform.** W/N/E run their lane from the
  deck INWARD along `left`, so for those three `queueDir === left` and the tail
  lands on a street node inside the ring; **the SOUTH platform is the one
  exception and runs OUTWARD (`−left`).** Capacity 6 ⇒ `laneLenOf(6) = max(2.2,
  1.1 + 0.56·6) = 4.46`, join = **4.81**. Given the tail node, the pinned
  arithmetic is `queueAnchor = tail − queueDir·4.81` and the entrance hut is a
  further 0.62 back, which leaves **0.22 u** between its near edge and the 0.9-u
  deck pad:

  | platform | heading | `queueDir` | tail node | `queueAnchor` (the HEAD) |
  |---:|---:|---|---|---|
  | 0 W | 0° | **[1, 0]** | [−36.0, −8.4] | [−40.81, −8.4] |
  | 1 N | 90° | **[0, −1]** | [0, 27.6] | [0, 32.41] |
  | 2 E | 180° | **[−1, 0]** | [36.0, −8.4] | [40.81, −8.4] |
  | 3 S | 270° | **[0, −1]** (OUTWARD) | [0, −57.6] | [0, −52.79] |

  A `queueDir` along the deck axis spears the platform and WILL be auto-flipped
  (a §0-FATAL `queueDirFlip` lint) — the pair `(heading, queueDir)` above is
  what was verified. **`queueDir` PERPENDICULAR to the deck axis is legal in
  EITHER sign; the sign is a terrain decision, not a chassis one.**
- **THOSE FOUR TAIL NODES ARE DEAD ENDS BY CONSTRUCTION, AND ONLY THE NORTH ONE
  ISN'T (measured wave 17).** Every tail sits 6.6 u from its own deck along the
  lane's axis, so a street that continues past `[−36, −8.4]`, `[36, −8.4]` or
  `[0, −57.6]` — i.e. one more cell along that axis, on the DECK's side — runs
  straight through the platform pad and the gate reports
  *`blockers`: street edge runs THROUGH … pad* — which is exactly how r12a failed.
  **Author those three as LEAVES.** W and E are approached from the ring's
  INTERIOR; **SOUTH is approached from OUTSIDE, laterally along z −57.6.** The
  exception, and it is the only one: **the NORTH tail `[0, 27.6]` may be a through
  node**, because its deck is at `z 34.2` with the beam overhead — a street row
  along `z 27.6` passes UNDER the beam and misses the pad entirely. Skeleton B
  (`park-generation-worlds.md` §3.1-B) builds its whole east arterial on that one
  asymmetry. Note it survives a MIRROR in x and does NOT survive rotating which
  world/street pattern sits on which compass point.
- **WHY THE SOUTH PLATFORM QUEUES OUTWARD — AND DO NOT "TIDY" IT BACK.** Inward,
  its tail `[0, −44.4]` and the street column paved down to it stand **5.3–5.8 u**
  from the summit of the composer's biggest range on seed 1 temperate, so the
  terrain guard FLATTENS that range (**h 8.59 → 0.83**), `terrainFlattened` fires
  and `stdH` falls under axis 7's **0.75** floor. Outward, measured on BOTH
  reference skeletons: `terrain.stdH` **0.73 → 0.81** and **0.71 → 0.79**,
  `reliefFloor.kept` **0.74 → 0.82** and **0.73 → 0.81**, the warning **GONE from
  both**, axis 7 **7.5/9 → 9/9**, totals **96.18 → 97.68** and **91.90 → 93.40**,
  with all fifteen other axes byte-identical and `validatePark ok: true` /
  0 failures preserved. The ring POSE `[−42.6, 0, −9.7]` is UNCHANGED; only this
  one station's queue side flips.

  **THE CLEARANCE NUMBER, because it is what makes this reusable:
  `capPeakForCells(p, keep, 0.35)` shaves a peak to `0.35 / s(d)`, so a guard cell
  must stand ≥ 10.62 u from a summit to cost that peak NOTHING.** The South deck
  `[0, −51.0]` is **9.70 u** out and cannot move, so **3.45 of the 8.59 survives —
  that is the ceiling of this pose, and it is enough.** **Do NOT recover the
  remainder by shifting the ring west:** it drops the West deck 4.2 u inside
  skeleton A's brasswork world rect and trades `crossThemeCount 0` for terrain.

  **AND ANY PUBLISHED RANGE / PEAK BOX FOR THIS ROW IS THE *UNGUARDED*
  COMPOSITION — NEVER PLAN A CLEARANCE OFF IT.** With a dense 128 layout no slot
  in `composeHills`' jittered ring can offer the 19.2 u guard-free disc the primary
  range wants, so it falls through to a **guard-BLIND phase-1 fallback walk** that
  lands a FIVE-PEAK RIDGE along **z ≈ −43** — summit **(5.33, −42.89) h 8.59
  r 12.09**, peaks at x −13.8 / −5.8 / +5.3 / +19.2 / +29.9 — **byte-identical in
  two parks with different guard clouds.** So you cannot move it by authoring
  around it (the gap the published boxes leave at x ≈ 0 is exactly where the
  summit lands), and its skirt is CONTINUOUS from **x −23 to x +38.6**: the only
  dry southbound corridors are `x ≤ −23` and `x ≥ +38.6`, and the second is the SE
  lake. **Route the approach down x ≤ −23** — the verified one runs
  `[−24, −48] → [−24, −57.6] → [0, −57.6]`, passing UNDER the south beam at
  `[−24, −51]`, 24 u clear of the deck pad.
- **LEAVE THE EXIT TO THE CHASSIS for platform 0.** Do NOT author
  `exit`/`exitDir` there: `<Monorail>`'s chassis takes the RCT2 cell one tile
  (1.2 u) along the same station face, facing the same way out, and picks
  whichever of the two adjacent cells has a reachable path — which is what all
  the reference parks now ship. Platforms 1..3 go through `register.stations` and
  DO carry an `exitPoint`/`exitDir`, because `registerRide` takes those verbatim
  (there is no local frame that could derive a platform 80 u from the component
  origin). Their footpaths reach the street through `planExitLane`'s **join**
  case: the run goes out level with the queue's own tail and turns one tile onto
  it, ~6.0 u, exactly the RCT2 move.
- **HOW TO REGISTER ALL FOUR.** `register.stations` is the extra-platform array
  (station 0 stays derived from `position`/`queue` as always), and
  `register.board` is the WORLD boarding anchor — needed because an ELEVATED
  deck cannot be described by the local `layout.board` offset frozen into
  `composableRide()`:

  **AND `register.queueAnchor` DOES NOT EXIST.** `RideRegisterProps` is exactly
  `{ name, capacity, rideDuration, loadTime, intensity, price, queueSurface,
  exitSurface, board, stations }` — nothing else. Round 13's park A wrote
  `register={{ name, capacity, …, queueAnchor: [-35.44, -8.4], queueDir: [1, 0] }}`
  and typecheck-failed on it. **There are TWO homes for a lane and they are
  different types:** station 0's is `queue={{ anchor, dir }}` at the component's
  TOP level; `queueAnchor` / `queueDir` exist only *inside* a `register.stations[]`
  entry (`GMRideStationConfig`). Put one on `register` itself and platform 0 gets no
  lane at all.

  **DO NOT ANNOTATE THE BLOCK BELOW WITH `{/* … */}` INSIDE THE OPENING TAG.** This
  copy used to carry `queue={{ … }}  {/* ← station 0's lane, TOP level */}` and that
  is a SYNTAX ERROR — a JSX opening tag accepts only attributes and spreads, so
  esbuild fails with `Expected "..." but found "}"` and the park is a blank page.
  It also silently desynced this copy from the two in `park-generation.md` and
  `-skeletons.md`, which the ring is supposed to match byte-for-byte. Put notes in
  prose above the fence (as here) or on `//` lines INSIDE the `register={{ … }}`
  object, never between attributes.

  ```tsx
  <Monorail
    position={[-42.6, 0, -9.7]} rotation={0} pieces={MONO_PIECES} beamY={2.6} loopSeconds={12} pinned
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

  `price: 0` is deliberate and it is RCT2's own rule: `Guest::shouldGoOnRide`
  skips the rating / price / crash / weather checks for a **FREE transport
  ride** and lets even a guest who is LEAVING THE PARK board one
  (`entity/Guest.cpp:1989-1998`, `:2048-2053` — the only two places
  `RtdFlag::isTransportRide` is read in the whole game). Charge for it and it
  stops being infrastructure.
  `pinned` because a park-scale circuit must never be nudged by the settle-time
  corridor resolver. `loopSeconds` should match `rideDuration` (both 12): the
  glider walks one full circuit in that much GATED clock, so it reaches each
  platform just before the FSM's `arriving` and waits there.
- **WHAT THE STATIONS ACTUALLY DO — and the honest limit.** The train stops at
  every platform in circuit order, unloads EVERY rider there and loads that
  platform's queue. That is RCT2 exactly: any track piece carrying a station
  index raises `VEHICLE_UPDATE_MOTION_TRACK_FLAG_3`
  (`ride/Vehicle.TrackMotion.cpp:433`), `UpdateTravelling` turns that
  unconditionally into `Status::arriving`
  (`ride/Vehicle.Station.cpp:1503-1511`), and `UpdateUnloadingPassengers` pushes
  every guest off (`:974-981`). A guest therefore boards at platform *i* and
  walks out of platform *i+1*'s exit, into that district — a real transfer.
  **THE HONEST LIMIT: guests do not PLAN it.** RCT2 has no transport routing at
  all — `Peep::CurrentRideStation` is overwritten with the vehicle's station the
  moment the guest disembarks (`entity/Guest.cpp:4192` + `:4226`), so a peep
  literally forgets where it got on, ride choice is "highest excitement within
  10 tiles" (`GuestFindBestRideToGoOn`, `entity/Guest.cpp:1943-1970`), and
  `peep/GuestPathfinding.cpp:813-815` still carries the 25-year-old comment
  *"The rideIndex will be useful for adding transport rides later."* Our sim
  matches that and does not pretend otherwise: guests ride the monorail because
  it is there and free, and the district they end up in is an emergent effect of
  where the platforms are. Do NOT write a header claiming guests "use the
  monorail to travel to" anywhere. What IS measurable is
  `probe.sim.transfers` — guests who boarded at one platform and got off at
  another — and per-platform reachability in `probe.monorail.stations[]`.
- **MEASURED, END TO END** (`harness/park-eval/samples/monorail-ref.tsx`, the
  reference park for this block — `validatePark → ok: true`, **0 failures**, 2
  non-fatal warnings on a size-128 **seed 91 / desert** plot, which is the pin its
  own header measures as guard-stable):

  | probe field | measured |
  |---|---|
  | `monorail.registered` / `circuitClosed` / `fatal` | **true** / **true** / **false** |
  | `monorail.worstClearance` / `closureGap` / `synthesizedCount` / `compilerWarnings` | **16.66** / **1.8** / **0** / **0** |
  | `monorail.deckCount` / `stationCount` | **4** / **4** |
  | `monorail.everyStationQueued` / `everyStationExitConnected` | **true** / **true** |
  | `monorail.worldsTouched` / `everyWorldTouched` | **3** (= `worldsDeclared`) / **true** |
  | every platform's `exitLaneLen` | **6.01 u** — `planExitLane`'s `join` case, all four |
  | platform queue/exit spur nodes | 18/19 · 20/21 · 22/23 · 24/25 — four distinct pairs |

  **`everyWorldTouched` IS A SEPARATE CHECK FROM `deckCount`, AND IT IS THE ONE
  THAT GETS MISSED.** Four decks and three worlds does not pass it by arithmetic:
  the test is whether each declared world's RECT contains a deck. Round 12 mounted
  all four platforms and still measured **`everyWorldTouched` 2 of 3**, because one
  world's rect sat off the ring entirely.
  **READ THE RIGHT FIELD — `worldsTouched` IS A NUMBER.** `probe.mjs:908` sets it to
  `touched.length`; the NAMES are in the sibling **`probe.monorail.worldsTouchedIds`**
  (`:909`). So the comparison is `monorail.worldsTouched` vs
  **`monorail.worldsDeclared`** (`:907`) — two counts — or just read the boolean
  `everyWorldTouched` (`:910`), which is that comparison. `probe.worlds.declared`
  (`probe.mjs:734`) is ALSO a count, so it can be compared but never "covered".
  Then take the missing name out of `worldsTouchedIds`, and **move that WORLD's rect
  onto its compass point**: the four deck cells are fixed by this block, so the world
  is the thing that moves.

  And BEHAVIOURALLY, from `node harness/park-eval/probe-monorail-transfer.mjs`
  (the real `createGameManager`, headless, 600 sim-s, 24 guests, on the reference
  park's own street graph): **34 rides, 34 of them TRANSFERS**, the first at
  **86.6 sim-s**, the train stopping **9 times at each of the four platforms**.
  The boarded→left matrix is exactly the circuit order — South→West 26,
  West→North 5, North→East 1, East→South 2 — i.e. every rider gets off at the
  NEXT platform, which is what RCT2 does. **A monorail that runs EMPTY passes
  every compile check and fails the point of the ride**, so run that probe, not
  only the gate.
- **DOES IT ACTUALLY EXTEND A GUEST'S REACH? YES, MEASURABLY.** The busiest leg
  measured above is **South → West, 26 of the 34 rides**. On `monorail-ref.tsx`'s
  graph the South platform is the CLOSEST of the four to the gate and is still
  **24.0 u of street from
  the turnstile — past the 20-u practical maximum, so the ring does NOT satisfy
  the gate-walk budget on its own** (a separate non-monorail ride's queue has
  to carry that; §0.3 check 1); with the repaired OUTWARD south queue it is the
  FARTHEST, which only makes that rule harder, never softer. The South platform
  delivers guests to the WEST district regardless. On foot that same trip is
  **106.8 u of street** (measured on `samples/skeleton-a.tsx`'s own EDGES,
  `[0, −57.6] → [−24, −57.6] → [−24, −21.6] → [−13.2, −16.8] → [−36, −8.4]`),
  which at the
  sim's 0.3–0.65 u/s guest walk (`GameManager/locomotion.ts` `speedOf`) is
  **164–356 sim-s**; the ride is one 3.0-s leg plus its dwell, ~10 s. So the
  monorail moves a guest across half the plot an order of magnitude faster than
  walking, which is exactly the reason a 128-u plot wants one: the walking
  budget for the NEAREST queue is 15 u safe / 20 u practical max from the gate
  (§0.3), and without a transport ring the far districts are reached only by
  guests who have already spent most of their energy getting there.

- **THE RING DOES NOT CONFLICT WITH A SEED'S WATER — DO NOT DROP IT TO DODGE A
  LAKE.** The beam is **2.45 u of soffit above grade all the way round** and the
  piers auto-extend to whatever ground they land on, so a leg crossing a lake, a
  river or a mountain flank is not a collision, it is the shot. Round-11's park B
  reasoned *"rather than fight seed-91's water intersecting the monorail ring,
  I'll DROP the monorail (transport category optional)"* and lost the ride, the
  category and the point: both premises were false. **The only thing water asks of
  the ring is that the four platform QUEUE TAILS — ground-level street nodes at
  `deck + left·6.6` — sit on dry cells**, which is four `park.isDryCell` checks,
  not a re-plan. If one lands wet, move the RING CENTRE in z (§4.2-B: `start` is
  free inside the published legal range) rather than dropping the ride.
  **AND READ THE FOUR DECK CELLS' HEIGHTS TOO, NOT ONLY THE WATER CENTROIDS.**
  `53 coastal` is the row that teaches this: its centroids do not move at all
  under the ring's guards — it passes the whole re-compose diff — and its **WEST
  DECK still stands at `h −0.06`, below the waterline.** A stable centroid is not
  a dry deck. Four `heightAt` reads after composition, and §1's ring-clearance
  table has the verdict for all 16 published rows.
- **KEEP THE GUARD LIST TIGHT — a ring puts FOUR platforms out near the edge.**
  Each platform needs about six `keepDry` cells (deck pad, entrance hut, lane,
  exit hut, exit run), and at `span = ⅔·size` those clusters sit in the outer
  third of the plot, which is exactly where a seed tends to draw its mountain
  ranges. `keepDry` does two jobs — it guarantees a cell dry AND it MOVES the
  heightfield to do it (`clampPeaks`/`clampBasins`) — so an over-broad list
  flattens the landform and fails `terrainFlattened`. Measured on the reference
  park: listing its 32 PLANTED cells as well left it keeping only **68 %** of its
  seed's relief against the **70 %** floor, with the range at (34.1, 17.3) cut
  3.10 → 0.89 by three tree cells alone. Dropping the planted cells cleared that
  check, and the shipped park keeps them out of `keepDry`.
  Measured for the ring on its own, at 128: **the 15 ring cells cost seed 1
  temperate relief 12.13 → 10.23 and stdH 1.09 → 1.03 (both still inside the
  8.15-16.6 / 0.76-1.45 band, character kept 99 %), and cost seed 91 desert
  stdH 0.76 → 0.63 (below the band, non-fatal, because 91 is the flattest published
  row to begin with).** So the ring is affordable; a fat list around it is not.
  **Guard only what you PAVE or stand a structure on.** A tree needs DRY ground,
  not FLAT ground — pick its cell clear of the composed water instead, and use
  `<Terrain noDress>` when you only want ground left BARE (it suppresses
  planting without touching the heightfield).

  **AND MEASURE YOUR SEED'S GUARD STABILITY — do not read a number off the §1
  table.** Because the ring makes the guard list big, it matters whether a
  guard-list edit MOVES the landform, and that is measured, not inferred:
  `node harness/park-eval/probe-guard-stability.mjs samples/<park>.tsx` prints
  unguarded vs GUARDED probes, violations, clamp discs, the climate actually
  composed, and `moved N/12` — how many realistic one-cell `keepDry` edits change
  the landform identity. **`moved 0/12` is what you want.** The §1 `probes`
  column is an UNGUARDED measurement at SIZE 128 and predicts this in NEITHER
  direction: a `probes 1` row can go to GUARDED `probes 64` with its water moved
  (measured on `arch-ref` at size 48), and a `probes 17` row can be completely
  stable (measured on `seedcheck-s1-192`: same landform guarded and unguarded,
  0 clamps, 0/12 moved). The reference park pins seed 91 desert because it
  measures `unguarded 1 → GUARDED 1 · viol 0 · clamps 0+0 · moved 0/12` at its
  own size — not because of the number 1.

#### 4.2-B THE SCALING RULE — and a second verified variant

The whole shape is one number, so it re-derives at any plot size. `R` stays 6.
Verified with `node probe-monorail-grand.mjs --sweep` — every row below reads
`closure.gap 1.800`, `synthesized 0`, `fatal false`, **0 warnings**, 4 stations:

| size | span | `L` | `p` | tail | start x | worst clearance | worst \|coord\| |
|---:|---:|---:|---:|---:|---:|---:|---:|
| 48 | 32.4 | 20.4 | 8.9 | 8.6 → (7.1, 1.5) | −16.2 | 6.93 | 16.2 |
| 64 | 43.2 | 31.2 | 14.3 | 14.0 → (12.5, 1.5) | −21.6 | 8.99 | 21.6 |
| 96 | 63.6 | 51.6 | 24.5 | 24.2 → (22.7, 1.5) | −31.8 | 12.79 | 31.8 |
| **128** | **85.2** | **73.2** | **35.3** | **35.0 → (33.5, 1.5)** | **−42.6** | **16.66** | **42.6** |
| 160 | 106.8 | 94.8 | 46.1 | 45.8 → (44.3, 1.5) | −53.4 | 20.49 | 53.4 |
| **192** | **128.4** | **116.4** | **56.9** | **56.6 → (55.1, 1.5)** | **−64.2** | **24.31** | **64.2** |

The **192** row is the SECOND VERIFIED VARIANT: same 17-piece list with `p`
56.9 and the tail split (55.1, 1.5), `position [−64.2, 0, −1.3 + ringCentreZ]`.
The corner radius is free — `R` 2..10 all compile clean at L 73.2 (clearance
14.23..19.03, gap 1.800, nothing synthesized) — so widen the corners for looks,
but re-derive `L = span − 2R` when you do.

**Station count is free up to 4.** 1, 2, 3 and 4 platforms all compile
identically (clearance 16.66, gap 1.800, nothing synthesized, 0 warnings) — drop
a `station` back to `{ type: 'straight', length: 2.6 }` to remove a platform
without touching the closure. Past 4 the compiler warns (the RCT2 save-format
cap), and a §0-FATAL warning is a §0-FATAL warning.

---
name: coaster-pieces
description: Use whenever a generation involves a roller coaster, a tracked ride or a track-piece list with the mp3d rigs — a <Coaster>, <TrackRide>, or the `pieces` prop on LogFlume/RiverRapids/Monorail/Bobsleigh/Chairlift/GoKarts — and whenever you must hit a thrill/excitement target, close a circuit, place a queue tail on a coaster, or fix a coaster failure (closure, shortDrop, lateral G / crash replay, corridor, bounds, queueDirFlip, translucent red track). Provides the verbatim verified archetypes, the pin-don't-derive wiring, the run-length table and the rateCoaster self-check.
---

# Coasters: COPY an archetype, don't design one

Four agent-generated parks in a row scored 8/8 on Thrill because they copied a
published archetype **verbatim** and re-measured to the published numbers.
Nothing you invent will beat that. **Your job on the coaster is transcription,
not design.**

You cannot run code or read the console during authoring. Every number below
was measured headlessly through the FULL `validatePark` gate. Copy them.

## Step 1 — pick the shelf from the park's declared type

| park type | archetype | excitement | footprint (w × d) | worst \|coord\| |
|---|---|---:|---|---:|
| THRILL (flagship) | **§4.0-A** steel rectangle | **6.12** | 37.6 × 37.6 | 20.81 |
| THRILL (flagship, highest) | **§4.0-C** inverting, 2 corkscrews | **6.31** | 35.2 × 36.8 | 18.64 |
| FAMILY (flagship) | **§4.0-B** steel rectangle | **5.27** | 28.9 × 30.4 | 15.67 |
| a SECOND/THIRD small coaster only | legacy rect h1.0 | 0.63 wooden / 1.11 steel | 5.0 × 17.8 | — |
| a filler on a cramped plot (size ≤ 20) | legacy L-wrap h1.0 | 0.62 / 1.10 | 12.8 × 12.3 | — |

**A park whose BEST coaster comes from the legacy shelf fails the Thrill axis
no matter how tidy the layout is.** If the park has one coaster, it is A, B or C.

Also span the intensity bands with the rest of the roster: a gentle ride
(intensity ≤ 3 — carousel / wheel / observation tower), a moderate one (4-6),
and an intense one (≥ 7) alongside the coaster.

## Step 2 — copy the block VERBATIM

Shared rules for all three. **Do not vary any of these:** `type="steel"`,
`heading: 0`, **no `bank` prop** (the pieces-mode default 0.7 saturates at the
steel 55° cap and is what soaks the lateral G — a lower bank re-opens the
1.27 g gate), `capacity: 4`, `rideDuration: 10`, `intensity: 7`,
`queueDir: [1, 0]`, queue tail node at **`[start.x + 6.0, start.z]`**, exit at
**`[start.x + 2.4, start.z + 2.4]`** with `exitDir: [1, 0]`.

### A — THRILL flagship, E 6.12

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
const A_START: [number, number, number] = [16.8, 0.55, -3.6];   // reference
```

Measured (`cars: 5`, bank 0.7): E **6.12** / I 9.32 / N 3.43, highest drop
5.47 u, 9 drops, +G 6.26, −G −3.86, **maxLatG 0.36 g**, airtime 1.06 s,
length 158.63, duration 24.59 s. Footprint X −20.81..16.80, Z −19.33..18.28,
maxY 6.05.

### B — FAMILY flagship, E 5.27, gentle forces

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
const B_START: [number, number, number] = [14.4, 0.55, -2.4];   // reference
```

Measured (`cars: 3` — the default, pass no `cars` prop): E **5.27** / I 6.25 /
N 2.25, highest drop 3.58 u, 6 drops, +G 3.51, −G −1.97, **maxLatG 0.27 g**,
airtime 0.56 s, length 120.87. Footprint X −14.52..14.40, Z −15.67..14.75,
maxY 4.15.

### C — INVERTING flagship, E 6.31 (highest rated)

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
const C_START: [number, number, number] = [16.8, 0.55, -3.6];   // reference
```

Measured (`cars: 3` default): E **6.31** / I 9.64 / N 3.60, highest drop
5.47 u, 7 drops, +G 5.41, −G −4.00, **maxLatG 0.90 g**, airtime 1.71 s,
2 inversions, length 152.17. Footprint X −18.42..16.80, Z −18.16..18.64,
maxY 6.05.

**Why the corkscrews sit exactly there:** a corkscrew reads ~0.21 effective
curvature, so at grade (v ≈ 10.9) it measures **2.35 g** and is FATAL. It must
be ridden within ~2.5 u of the apex, but it is also LEVEL and rises ~1.13 u,
so straight after the lift hill its top becomes the global maximum,
`detectLiftHill` swallows it and the train crawls through the inversion at
chain speed. Hence `H1 = 5.5` on the station leg and `Hn = 4.2` elsewhere.
**Do not move them, do not deepen `Hn`, do not raise `H1`.** (`Hn = 4.6` puts
a corkscrew top above the apex; three corkscrews reach 1.06 g; every mid-slope
placement breaches 1.275 g.)

**Do NOT re-tune any of the three.** Every number was searched against
`rateCoaster` + the crash replay. RCT2 cuts excitement 25 % per band once
intensity reaches 10.00 and A/C already sit at 9.32/9.64 — a deeper lift or an
extra corkscrew LOWERS the score.

## Step 3 — the full wiring, copy-paste

```tsx
import { Park, Terrain, Paths, GameManager, Gate, Coaster } from './components/Park';
import { compileTrackPieces, rateCoaster } from './components/SplineRideKit';
import { buildParkNet } from './components/SetPieceKit';

const START: [number, number, number] = [16.8, 0.55, -3.6];      // A_START
const TAIL: [number, number] = [START[0] + 6.0, START[2]];       // [22.8, -3.6]
const EXIT: [number, number] = [START[0] + 2.4, START[2] + 2.4]; // [19.2, -1.2]

// compile ONCE, up front — the points feed <Terrain> so hill peaks are
// pre-capped under the circuit (skip this and ground clamps kink the profile
// into pitchRate violations) and rateCoaster so the numbers are in the log.
const COMPILED = compileTrackPieces(A_PIECES, {
  profile: 'coaster', type: 'steel', start: START, heading: 0,
});
const RATING = rateCoaster(COMPILED.points, { type: 'steel', bank: 0.7, cars: 5 });
console.log('[thrill]', RATING.excitement, RATING.intensity, RATING.nausea,
  'drop', RATING.highestDrop, 'lat', RATING.maxLatG, 'air', RATING.airtimeSeconds);

// … NET = buildParkNet({ … }) with a street node ON the TAIL cell …

<Coaster
  name="Thunderhead"
  pieces={A_PIECES}
  start={START}          /* accepts [x, y, z] — the y is ignored */
  heading={0}
  type="steel"
  cars={5}               /* A only; B and C use the default 3 — omit the prop */
  capacity={4}
  rideDuration={10}      /* ≤ 12 or the 60 sim-s acceptance run can't complete a cycle */
  loadTime={2}
  intensity={7}
  price={6}
  queueTailNode={NET.node(TAIL)}
  queueDir={[1, 0]}
  exit={EXIT}
  exitDir={[1, 0]}
  deck={[START[0], START[2] + 1.2]}
/>
```

`<Terrain keepDry={NET.keepDry} coasterPts={COMPILED.points} />` — pass the
compiled points, always.

## Step 4 — queueDir and the tail are part of the archetype

**`queueDir: [1, 0]` is verified only TOGETHER WITH `heading: 0`.** The station
straight runs **+z** at heading 0, so the only lane orientation that does not
spear the station is ±x. `[0, ±1]` is auto-FLIPPED and the flip is a FATAL
`queueDirFlip` lint (a hard `autofix` FAILURE). At any other heading, rotate
BOTH or re-derive both.

**`[1, 0]` alone is not enough — the tail DISTANCE is part of the archetype.**
The manager plans the queue head at `tail − dir·(laneLenOf(capacity) + 0.35)`
and the entrance hut a further 0.62 back, with
`laneLenOf(c) = max(2.2, 1.1 + 0.56·c)`. The station straight's own no-go rect
reaches `start.x + 0.55`, so at capacity 4 (`laneLenOf = 3.34`) the hut's inner
edge lands at `tail − 4.91` and the tail must satisfy

```
tailX ≥ start.x + laneLenOf(capacity) + 2.12    →  capacity 4: start.x + 5.46
```

A tail at `start.x + 4.8` FLIPS (verified in round-6). **Every archetype is
published with its tail at exactly `start.x + 6.0`, same `start.z`, and ran
unflipped and untrimmed. Use 6.0. Do not re-derive it.**

That tail cell must be a real street node in the graph `<Paths>` renders — add
it to your `buildParkNet` nodes and look the index up with `NET.node(TAIL)`.
Queue lanes are railed on both sides and enterable ONLY at the tail, so a tail
that is not on a walked node makes the ride permanently unreachable
(`accessibility` FAIL).

## Step 5 — translate, rigidly, in lattice multiples of 1.2

The compiled geometry is **start-relative and size-independent** (verified:
`compileTrackPieces` output is bit-identical at bounds 16 and 48). Shift
`start` by lattice multiples of 1.2 and **everything shifts rigidly with it** —
footprint extents, the corridor cell table, the tail, the exit, the deck.

Translate ALL FIVE together or the ride breaks:

```
offset (dx, dz), both multiples of 1.2
start   → [16.8 + dx, 0.55, -3.6 + dz]
tail    → [22.8 + dx, -3.6 + dz]
exit    → [19.2 + dx, -1.2 + dz]
deck    → [16.8 + dx, -2.4 + dz]
corridor cells → every listed cell + (dx, dz)
```

**The legal offsets are narrow on a 48 plot, because A and C nearly fill it.**
Track must stay inside ±24; the tail/exit attach nodes must be lattice nodes
inside ±24, so the largest usable is 22.8:

| archetype | legal `dx` | legal `dz` | why |
|---|---|---|---|
| A | **0, −1.2, −2.4** | −3.6 … +3.6 | tail is already at 22.8; west leg reaches −20.81 |
| C | **0, −1.2, −2.4, −3.6, −4.8** | −4.8 … +4.8 | tail 22.8; west leg −18.42 |
| B | −8.4 … **+2.4** | −7.2 … +8.4 | small footprint, tail only at 20.4 |

Worked example — moving A one cell west and two north:
`dx = −1.2, dz = +2.4` → `start [15.6, 0.55, −1.2]`, `tail [21.6, −1.2]`,
`exit [18.0, 1.2]`, `deck [15.6, 0.0]`; track X −22.01..15.60 (inside ±24 ✔),
Z −16.93..20.68 (✔); every corridor cell shifts by (−1.2, +2.4).

**A and C at their reference start OWN a 48 plot: they are a 37.6 × 37.6 ring
around the whole park with a clear middle.** That is not a problem — it is the
layout. Run the streets, the hub and the other rides **in the ring's
interior** (the whole centre is outside the low corridor because the apex legs
fly 2.2-6.05 u up) and cross UNDER the apex legs freely.

## Step 6 — the corridor cell tables (copy, never derive)

A 1.6-u-wide corridor is swept along the compiled polyline. No street edge,
stall, or other ride's pad/hut/lane may sit in it unless the track is **≥ 2.2 u
above** the obstacle there. The ride's OWN access assembly is exempt.

Every cell below is an **offset from `start`**, in the compiled frame
(heading 0, station running +z). A row `x −4.8: z −3.6..15.6` means the cells
`(start.x − 4.8, start.z − 3.6) … (start.x − 4.8, start.z + 15.6)` at 1.2 steps.

**A (175 cells)** — only the four valley floors and the station leg obstruct at
grade; the whole 30 × 30 middle of the ring is FREE:

```
x −38.4/−37.2:  z −7.2..13.2        ← west leg valley + hills
x −28.8..−8.4:  z −16.8..−14.4      ← south leg valley + hills
x −26.4..−9.6:  z  20.4..22.8       ← north leg valley + hill
x −1.2/+1.2:    z −7.2..7.2         ← station leg (own ride: exempt)
x   0.0:        z −7.2..8.4
```
Build in `x −36.0..−2.4 × z −13.2..19.2` (the interior) or the east apron
`x ≥ +2.4`.

**B (160 cells)** — interior free block `x −26.4..−2.4 × z −10.8..14.4`:

```
x −30.0/−28.8:  z −6.0..10.8
x −27.6:        z −4.8..10.8
x −22.8..−6.0:  z −14.4..−12.0
x −18.0..−6.0:  z  15.6..18.0
x −1.2/+1.2:    z −7.2..7.2
x   0.0:        z −7.2..8.4
```

**C (149 cells)** — interior free block `x −32.4..−2.4 × z −12.0..20.4`:

```
x −36.0:         z  0.0..14.4
x −34.8:         z −1.2..14.4
x −33.6:         z  0.0..14.4
x −27.6..−12.0:  z −15.6..−13.2
x −25.2..−9.6:   z  21.6..22.8
x −1.2/+1.2:     z −7.2..7.2
x   0.0:         z −7.2..8.4
```

Rows are rounded OUTWARD by at most one cell at each end — erring toward
"blocked" is always safe. At runtime `manager().corridorCells(name?)` returns
the live list for any registered circuit.

**Legacy shelf corridor tables** (for a second small coaster):
*rect h1.0 @ `[2.4, 0.55, −6.0]`* (103 cells, whole circuit below 2.2 u):
```
x −6.0: z −2.4..14.4
x −4.8: z −3.6..15.6
x −3.6: z −3.6..15.6
x −2.4: z −3.6..−1.2, 14.4..15.6    ← the alley between the two legs
x −1.2: z −3.6..15.6
x  0.0: z −3.6..15.6
x  1.2: z −2.4..14.4
```
The alley (x −2.4, z 0.0..13.2) is clear but fenced in on both sides — put
nothing there that needs street access.
*L-wrap h1.0 @ `[6.0, 0.55, −3.6]`* (113 cells): clear pockets are the band
`x −6.0..−2.4 × z 0.0..7.2` inside the wrap and everything at `x ≥ 2.4` or
`z ≤ −4.8`.

## Step 7 — self-check against the published numbers

You cannot read the console at authoring time, so the check is: **the numbers
you must see are the numbers above.** Include the `rateCoaster` call anyway (it
surfaces in the park's own log and in `handle.ratings()` /
`mgr.rides()[i].ratings`), then verify on paper:

| target | THRILL park | FAMILY park |
|---|---:|---:|
| flagship `excitement` | ≥ 6.0 | ≥ 5.0 |
| `maxPosVertG` | ≥ 2.5 g | ≥ 1.8 g |
| `highestDrop` | ≥ 2.0 u | ≥ 1.2 u |
| `maxLatG` | **< 1.27 g** — the crash gate, non-negotiable either way | |
| `airtimeSeconds` | > 0 on at least one crest | |
| `nausea` | < 8.0 | |

If you copied verbatim and translated rigidly, A/C clear every THRILL row and
B clears every FAMILY row. **If you edited a piece list, you no longer know the
numbers and cannot claim them.**

## Legacy shelf — the second, small coaster

Both end with a 1.2-u brake tail landing 0.9 (= g − 0.3) short of the start.
Lift **1.0** is mandatory: lifts 0.6/0.7 are RETIRED because their first drop
measures 0.70/0.79 u, under RCT2's 0.9-u `shortDrop` gate — which HALVES all
three ratings and is a FATAL `coaster:shortDrop` lint.

```tsx
// compact rectangle + tail, h 1.0 — span 5.0 × 17.8
const RECT = ['station', { type: 'lift', height: 1.0 }, 'drop', 'turnR',
  { type: 'straight', length: 2.0 }, 'turnR',
  { type: 'straight', length: 14.8 }, 'turnR',   // = 2.6 + 2×5.5 + 1.2
  { type: 'straight', length: 2.0 }, 'turnR',
  { type: 'straight', length: 0.9 }];
// VERIFIED start [2.4, 0.55, -6.0], heading 0 → X -2.60..2.40, Z -8.74..9.06,
// maxY 1.55, closure synthesizes NOTHING.
// wooden: E 0.63 / I 0.86 / N 0.38, drop 1.00, +G 1.98, lat 0.99 g, len 43.27
// steel:  E 1.11 / I 1.02 / N 0.32, +G 2.41, lat 0.59 g

// L-wrap + tail, h 1.0 — span 12.8 × 12.3, fits a compact size 16
const LWRAP = ['station', { type: 'lift', height: 1.0 }, 'turnR', 'drop', 'turnR',
  { type: 'straight', length: 2.0 }, 'turnL',
  { type: 'straight', length: 1.3 }, 'turnR',
  { type: 'straight', length: 4.3 }, 'turnR',
  { type: 'straight', length: 9.8 }, 'turnR',
  { type: 'straight', length: 0.9 }];
// VERIFIED start [6.0, 0.55, -3.6], heading 0 → X -6.78..6.02, Z -6.32..5.98
// wooden: E 0.62 / I 0.84 / N 0.39, lat 1.01 g · steel: E 1.10, lat 0.79 g
```

Same wiring rules: `heading: 0`, `queueDir: [1, 0]`, tail at `start.x + 6.0`,
exit at `start.x + 2.4 / start.z + 2.4`. `<Coaster>`'s pieces-mode default bank
(wooden 0.42 / steel 0.7) — again, no `bank` prop.

## Only if you must author your own circuit

Do this only when the brief explicitly demands a shape no archetype provides.
You are then responsible for every number.

**RUN-LENGTH TABLE** — walk the cursor on paper with THESE advances. The cursor
starts at the local origin heading +z; every piece starts and ends level.

| piece | cursor advance |
|---|---|
| `station` (FIRST piece) | 2.6 (default length) |
| `flat`/`straight` | its `length` (default 1.3) |
| `lift`/`drop` h | **≈ 1.6 + 3.9×h** — auto-extended for pitch legality, a shorter `length` is IGNORED. h 0.6 → 3.9, 0.9 → 5.1, 1.0 → **5.5**, 1.2 → 6.3, 1.5 → 7.4, 1.8 → 8.0, 2.0 → 7.9; past 2.0 it grows ~1.3/unit: 3.2 → 8.9, 3.6 → **9.49**, 4.2 → **10.27**, 5.1 → **11.43**, 5.5 → **11.94**, 6.0 → 12.6 |
| `hill` h | max(`length`, 3.6, 6.3×√h) — h 0.6 → 4.88, 0.9 → **5.98**, 1.2 → 6.90 |
| `turnL`/`turnR` 90° | R along the OLD heading + R along the NEW (default R 1.5, keep ≥ 1.5); heading ±90°; arc length 2.36 |
| `helixL`/`helixR` 360° | returns to its ENTRY point (net zero advance), ±`height`; sweeps a ~3 u circle to the side |
| `corkscrewL/R` (STEEL only) | forward max(`length`, 4R) — default **2.40**, level, rises ~1.13 u |
| `sbend` | forward max(2.4, `length`, default 3.6); lateral `radius` (default 1.2, +ve left) |

So `station + lift h + drop` = `2.6 + 2×(1.6 + 3.9h)` of dead-straight run:
13.6 u at h 1.0, 15.1 at h 1.2, 26.5 at h 5.5. Budget the land BEFORE picking
heights.

**Closure is HEADING ALIGNMENT, not aim.** The compiler auto-closes onto the
START POSE — the station start point AND the heading you left it on — via an
eased ramp plus the shortest arc–straight–arc (closure radius **2.2** for
coasters, 1.5 other profiles) landing through a synthesized 1.2-u straight
brake tail. The last authored piece must leave the cursor (a) heading within
**~30°** of the station ENTRY heading and (b) within **~3 u** of the start.
"Pointing at the station" from mid-park is ~180° off: the compiler synthesizes
a long return loop (verified: `turnR 4°, straight 8.0, turnR 176°`) and a
synthesized closure over **40 %** of the authored length is FATAL — translucent
red track, no registration, hard `validatePark` failure.

**LAND STRAIGHT, and land SHORT.** When your own pieces reach the start (gap
≤ 0.5, nothing synthesized), the final authored piece must be a straight brake
tail ≥ ~1.2 u along the station axis, landing ~0.3 u short. A turn that lands
on the station leaves the weld curved and unbanked at full speed: the crash
replay reads 1.31 g against the 1.27 g margin, and the compiler's "the circuit
lands on the station from a curve" warning is FATAL. Overshooting is worse than
undershooting — a leg +0.8 over the start makes the Dubins closure wrap 268°
around from the far side (FATAL on bounds AND self-intersection). Short is safe:
the closing arcs stay inside the authored span.

**Worked closure, compact rectangle with the tail** (heading +z from (0,0),
tail g = 1.2, lift 1.0 → run 5.5):

```
station 2.6            → (0, 2.6)
lift 1.0 (run 5.5)     → (0, 8.1)     y +1.0
drop     (run 5.5)     → (0, 13.6)    y back to 0
turnR                  → (−1.5, 15.1)   heading −x
straight 2.0           → (−3.5, 15.1)
turnR                  → (−5.0, 13.6)   heading −z
straight 14.8          → (−5.0, −1.2)   ← station leg 13.6 + brake tail 1.2
turnR                  → (−3.5, −2.7)   heading +x
straight 2.0           → (−1.5, −2.7)
turnR                  → (0, −1.2)      heading +z = the entry heading
straight 0.9           → (0, −0.3)      ← the brake tail, 0.3 short. CLOSED.
```

**Physics you cannot argue with:**
- The 1.5 g derail guard is real (`Vehicle.TrackMotion.cpp:58-122`);
  `validatePark` replays the runner's energy-paced lateral sweep and requires a
  15 % margin, i.e. **< 1.275 g**.
- At v ≈ 10 u/s a 90° turn reads **1.1-2.7 g at EVERY radius from 1.5 to 12**.
  Widening does not save you; tightening does not either. Only SPEED does — a
  turn ridden within ~2 u of the apex sees v ≈ 4-6 u/s and reads 0.3-0.9 g.
  **Structure the circuit `lift → turn → drop → hills → lift → turn → …`:
  turns always on a crest, straights always at grade.** That is the entire
  trick behind all three archetypes.
- The stat gates HALVE all three ratings when the highest drop is under 3.0 u
  wooden / **3.5 u steel**, when a wooden circuit is under ~54 u of track, or
  when there are fewer than 2 drops.
- `avgSpeed` dominates the score (142 of A's raw points vs gForces 46, drops
  48): keep the circuit LOW — only the lift and the corners go up.
- Every `hill` is one extra drop count, airtime and a −G term, and its crest
  curvature is ~0.497 whatever its height, so every default-length hill
  produces airtime. Hills are the cheapest excitement in the grammar.
- Inversions are next cheapest (steel: +0.11 E each, up to 6, and they relax
  the drop gates) — but only on a mid-leg climb top ≥ 1.2 u below the apex.

**Prefer PIECES over `points`.** Points mode gets NO leniency: the same fatal
gate (`checkCoasterDesign` + `validateSpline` clearance ≥ 0.9 + the crash
replay + park bounds ±size/2 + 0.4) without the grammar's by-construction
legality.

## Tracked rides that are NOT coasters

`LogFlume`, `RiverRapids`, `Monorail`, `Bobsleigh`, `Chairlift`, `GoKarts` take
the same `pieces` grammar through their OWN profile, with per-profile
whitelists — a coaster piece list is not portable to them. See the
**ride-and-stall-roster** skill for each one's profile, legal pieces and
published example circuit. Closure radius for non-coaster profiles is 1.5.

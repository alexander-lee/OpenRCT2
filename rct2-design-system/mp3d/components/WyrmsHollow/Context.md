# WyrmsHollow

**CANONICAL IMPORT — copy exactly:** `import { WyrmsHollow } from './components/WyrmsHollow';`
*(never from `'./Park'`: only the `<Park>` wrappers + track-piece JSX live there. A wrong
specifier makes esbuild refuse the WHOLE bundle — the round-8 black-page failure.)*

The **dragon family coaster** of the **THORNWICK GLADE** enchanted-forest world, and the
world's FIRST component — so the glade's palette and its moss/ivy/root masonry helpers are
exported from here for the rest of Thornwick to share (`THORNWICK`, `WYRM`,
`buildIvyStrand`), exactly the way `EmberWings` owns the Emberfall lava language.

Built on the **existing** spline machinery like every tracked ride in the design system: the
layout is compiled by SplineRideKit's `compileTrackPieces` and swept by
`buildRideSpline({ profile: 'coaster', type: 'steel' })`. No forked track code.

---

## THE WYRM — `buildWyrmDragon(t, opts)`

**The beast IS the train.** Not a themed car: eleven independent `THREE.Group` segments are
handed straight to `buildRideSpline(...).run(segments, { spacing: 0.56, wheelOffset: 0.2 })`,
which places segment *i* at `uHead − i·spacing/total`. Every segment therefore sits on its
OWN spline frame, so the creature is posed by the track itself and genuinely bends through
the layout — **the tail is still coming out of the last bend as the head enters the next
one**. That is the justification for the whole design: riders sit in saddles along its back,
so the flex is the ride, and it costs nothing but the runner the kit already has.

```ts
const wyrm = buildWyrmDragon(three, { riders: false });   // 11 segments, 8 saddles
const run  = ride.run(wyrm.segments, { spacing: 0.56, wheelOffset: 0.2 });
wyrm.breathPoints.forEach((p) => rideGroup.add(p));       // static host, see below
// per frame:
run(clock);                       // the SPLINE poses the body
wyrm.update(clock, speed, nightK) // the wave, the wings, the jaw, the glow, the breath
```

`WyrmDragonBuilt` = `{ group, segments, seatAnchors, nostrils, headLight, breathPoints,
dispose, update(clock, speed, nightK, chained?) }`.

* `segments[0]` is the HEAD and the ride's `vehicle` (RideViewer follow cam).
* `group` holds the beast posed nose-to-tail for standalone use; `run()` re-parents the
  segments onto the ride and three removes them from it automatically.
* `chained: true` re-poses the segments as a FREE serpentine chain (the close-up previews):
  the same travelling wave is integrated into real segment poses because no ride runner is
  placing them. **This is also how you sanity-check the flex without a track.**
* `breathPoints` MUST be parented to something STATIC (the ride group / the preview root),
  never to the head — particles have to be left behind in the world. `update` converts the
  nostril pose into whatever space you parented them into (`points.parent.worldToLocal`).

### How the flex is driven

Two layers, and they are deliberately different:

1. **The track frames** (the real one). `run()` gives each segment its own `frameAt(u)`
   position + basis. All of the body's large-scale bending — through corners, over the
   camelback, down the descent — comes out of the SPLINE, for free, and is therefore always
   consistent with the rails the riders are on.
2. **A travelling serpentine wave** laid on top in each segment's own frame:
   `rotateY/rotateZ/rotateX` + a small `translateX/Y`, phase-lagged `i·0.72` rad down the
   body at `W = 1.9 rad/s` (one undulation ≈ 3.3 s), amplitude `0.075·(0.4 + 0.6·speed)`
   weighted by `FLEX_W = [1.15, 1.0, 0.8, 0.3, 0.22, 0.22, 0.3, 0.75, 1.1, 1.4, 1.7]` — the
   **neck weaves and the tail whips while the four RIDDEN segments stay composed** (nobody
   wants to be thrashed, and it keeps the saddle anchors sane for `seatWorld`).
   Amplitudes are kept small on purpose: each barrel is `0.56 × 1.24` long against a 0.56
   spacing, so the 0.13 of overlap plus the joint ball at every segment origin means the
   body can never open a seam.

### How the wing beat is driven

A REAL bone chain per wing — `shoulder → humerus (0.56) → elbow → forearm (0.52) → wrist →
four fingers of two phalanges each (0.52/0.48 … 0.34/0.26)` — every joint a `Group`, and the
**membrane is rebuilt every frame** as a 14-triangle `BufferGeometry` from the live bone
tips (`o.matrixWorld` × `inv(root.matrixWorld)`), with the inner vertices sagged by a
phase-dependent `bag` so it **bags on the downstroke and pulls taut on the up**. Nothing
about the membrane is pre-baked; it stretches and creases because it is literally hung off
the bones.

The beat is `2.6 s` a cycle and every joint **lags** the one before it — shoulder leads,
elbow −0.9 rad, wrist −1.4, fingers −1.8 (and −0.16 each, so the fingers ripple) — which is
the whole difference between a wing and a rigid flap. On top of that:

* **a GULL WING, and the droop is tied to the dihedral.** The shoulder is carried steeply up
  (`0.85` rad, beating `±0.40`) and the elbow gives back `0.52` of whatever the shoulder is
  holding while the wrist gives back another `0.34`, which leaves the OUTER panel — where
  nearly all of the membrane area is — within ~0.15 rad of level at every point of the
  stroke. That is the only pose that works from both of the park's angles at once: a hard
  raised-shoulder silhouette from the side, and the full broad planform turned flat on to the
  default ~50° three-quarter looking down. Round 8 held ONE 0.46 dihedral all the way out the
  chain (a straight board: a plank from the side, edge-on from above); round 9's first try
  simply raised that to 0.78 and the whole wing stood up and read as two brown flags. It also
  buys CLEARANCE — the tip of a drooped wing off a high shoulder sits lower than a straight
  wing at the same dihedral, and the tip is what has to pass the tower breach.
* **a SHAPED stroke, not a sine.** `sign(sin) · |sin|^1.6`, so the beat DWELLS at the spread
  mid-pose and passes quickly through the extremes. A plain sine spends half of every cycle
  near an extreme, and near the top of the stroke a wing is edge-on — for half the time the
  beast read as two folded sails. This is also what a big slow soaring flap actually does.
  The port wing runs `0.3` rad (5% of a cycle) behind the starboard one: imperceptible in
  motion, but it means a still frame always has at least one wing well spread.
* **effort**: `climb = segments[0].matrix.elements[9]` — the y component of the head
  segment's own forward axis, i.e. *is the beast climbing?* (a park yaw cannot change it).
  The stroke deepens on the lift and eases on the descent, `0.85 + 2.4·climb`, clamped
  `0.55…1.5`. **This is the ride's lift hill**: see "no chain" below.
* **furl**: `1 − speed` from the motion gate. Parked in the station the wings FOLD against
  the flank, the jaw closes and the breath dies back; the beast wakes up as it departs.

### The rest of the beast

| part | how |
| --- | --- |
| **head** | `scale 1.62` (round 8's 1.32 was a dark green thumb on the end of a hose at park distance): cranium + occiput + a **tapering** snout — round 8 hung a straight `0.222 × 0.36` SLAB under it for the gum line and a rectangular prism is exactly what made the muzzle read as a box with panels glued on — plus a faceted nasal bridge, a maxilla ridge, brow ridges, a bony crown crest, a five-spine neck frill, cheek + jaw spikes. The muzzle, cheek and maxilla are `WYRM.muzzle`, deliberately the LIGHTEST hide on the beast: round 8 built them out of `flank` (0x36432f) and the whole front of the skull — its most characterful part — fell into shadow whenever the sun was off to one side. The brow is a **hood canted hard over the socket**, not a shelf: built long and set inboard (round 9's first try) it fused with the crown crest into one pale plank laid across the head. |
| **horns** | five tapering **faceted** (5-segment, flat-shaded — keratin, not pipe) cylinders per side, every joint bending the SAME way as the root tilt so they arc up and BACK over the neck, plus a smaller second pair |
| **jaw** | a hinged `Group` at the skull base: a DEEP jaw bar (0.92 of its own radius, not round 8's 0.72 strap), a **mandible angle** flaring either side to carry the bite muscle — without it a dragon's profile has no chin — throat plate + chin barbels, breathing open ~0.17 rad and gaping to ~0.49 on the roar; **14 upper + 14 lower teeth** in opposed rows |
| **eyes** | amber, emissive, `r 0.036` PROUD of a PALE bone socket with an eyelid hood over it and a vertical **slit pupil**; `0.95 + 1.85·nightK + 0.9·roar` — day AND night, never gated to zero. Round 8's daylight floor was `0.35`, barely above ambient: the eyes only read after dark, so by day the most characterful part of the beast had nothing lit on it. **Lerp, never gate.** |
| **neck** | a **five**-bone riser on the lead segment (0.175 each, every joint −0.27 rad) that arcs the skull **0.57** up and 0.55 forward of the segment origin, carrying the dorsal ridge and oxblood throat scutes. Round 8's four 0.15 bones at −0.22 carried it only 0.30 up, and from the park's ~50° camera the beast read as a low WYVERN with its chin on the rails. This is the single biggest change to the silhouette from above; `HEAD_PITCH` (1.47) cancels the accumulated −1.35 so the muzzle still comes out just nose-down of level. |
| **hide** | per segment: a tapering barrel, a joint ball, **3 raked dorsal spikes** (tallest over the shoulders — the "sail", `1.55×`), **10 overlapping flank shingles** (merged, `lodDetail`) and **3 oxblood belly scutes**. The ridge is a PALE centre spike (`WYRM.bone`) between darker flankers: from the park's ~50° camera the ridge is one of only three things you can see of the beast, and round 8's `0x4a4c46` keratin over `0x3f5330` moss was the same VALUE as the ground, so it simply vanished. Same reason the horns run pale at the root and the whole hide was lifted a step (`back` 0x435434 → 0x4e5f39, `shingle` 0x5c6d43 → 0x6b7a48). |
| **chest** | segments 3-4 carry a **keel** mass under the barrel + a breast plate of big oxblood scutes: a uniform barrel reads as a pipe with legs |
| **limbs** | four legs (hip → knee → ankle), each with a foot, **three claws** and a rear spur, tucked and slowly paddling |
| **tail** | four tapering segments and a **spade**: a flattened blade, a barb and two side fins |
| **breath** | 2 ParticleKit emitters, **180 particles** — buoyant grey smoke + additive embers on gravity arcs, origins riding the two nostrils, rates driven by the roar, the gate speed and `nightK` |

**Scale.** One guest is 0.55 tall (`buildPeep` at `scale 0.5`). The wyrm's barrel is ~0.65
across — **about one guest thick** — it is a little over 6 units nose to spade, its skull now
rides ~1.8 above the rails and its wingspan is ~2.9 at the widest point of the beat. The dragon-close-up previews put a real `buildPeep` on the ground beside
it, which is the only honest way to show that.
**Why a narrow wing on a long body:** this is a WYRM. The span has to pass the tower breach
(half-width 1.5) and the ruined arches (half-width 1.7) at every point of the beat, and a
bat-proportioned wing would either clip the masonry or force the openings so wide that the
ruin stopped reading as a ruin.

**Colour.** Muted creature colours — mossy green back/flank, `0x6b7a48` shingles, oxblood
belly, slate horn, `WYRM.bone` (0x9a9a88) for the brow/crest/ridge and `WYRM.muzzle`
(0x6f7a4a) for the snout plating, warm `0x9c6a4e` membrane. **The GLOW is the eyes and the
breath, never the body.** Every value here is set against the GROUND it will be seen over,
not in isolation: the park's default camera looks down at mossy green from ~50°, and anything
at the same value as that moss is invisible whatever its hue.

**CLEARANCE — measure it after any silhouette change.** The tower breach is `CLEAR = 1.95`
above the rails and the arches spring at 2.0 to a 2.50 crown, so the whole beast has to live
inside that. Round 9's numbers, measured off the live rig: skull + horns **1.798** above
segment 0's origin (round 8: 1.479 — the arch cost 0.32 and the bigger skull more, which is
why the main horns are now raked to `−0.62` at the root instead of `−0.42`; upright horns put
the tips straight through the breach lintel), wingtip peak **2.23** and worst wing half-span
**2.06** — both of those slightly BETTER than round 8's 2.27 / 2.15, because a gull wing tips
lower and narrower than a straight one.

---

## THE RIDE

### Why `type: 'steel'`

A family coaster is RCT2's Junior/Mini-coaster niche and rides on steel rules
(`ride/rtd/coaster/LoopingRollerCoaster.h` is the ratings table `rateCoaster` scores it
against). Nothing inverts and nothing is steep — peak grade 21°, highest drop 2.81 — but the
layout does want the **40° auto-bank** the steel cap allows: at `bank: 0.70` the three low
corners hold **0.96 g** of effective lateral, and at `bank: 0.55` the same corners read
**1.09 g** against validatePark's 1.27 g margin. Do not lower it.

### There is NO chain lift, on purpose

`detectLiftHill` resamples the climb to 2 samples on this circuit (the level crest after the
lift is the resampled maximum, so the walk-back stops immediately), so the kit renders no
chain/belt strip and the runner does not crawl the hill at `liftV` — **the lap measures
13.6 s instead of 18.1 s**, which is what keeps the ride inside the 12-16 s window the
world's `sim` gate needs. That reading is also the better fiction and it is wired into the
animation: **the wyrm climbs under its own power and its wing beat deepens on the way up**
(the `effort` term above). If you ever want the chain, lengthen the lift run to 9.0 — the
climb is then detected, and the lap goes to ~18 s.

### Measured numbers — "Wyrm's Coil" (the stock circuit)

`station · straight 0.6 · lift 2.8 (run 7.4) · straight 0.8 · [crest corner r3.0] ·
straight 0.8 · drop 2.8 (run 7.4) · straight 1.6 · [easy corner r3.0] · straight 13.330 ·
[easy corner r3.0] · hill 0.8 (run 8) · straight 2.030 · [easy corner r3.0] · straight 1.4`

where `[crest corner r]` = `turnR 12° r(2.6r) · 66° r · 12° r(2.6r)` and `[easy corner r]` =
`turnR 6° r12 · 12° r7 · 54° r · 12° r7 · 6° r12`. Each fragment sums to exactly **90°**, so
four of them bring the beast home on the station heading.

Verified COMPILE-ONLY with the component's own options (`coaster` / `steel` / bank 0.70 /
start `[0, 0.55, 0]` / heading −90°):

| | |
| --- | --- |
| `report.ok` | **true**, `fatal` false |
| `checkCoasterDesign('steel')` | **clean — 0 violations, 0 warnings** |
| `validateSpline` worst clearance | **4.54** |
| closure | closed, **ZERO synthesized pieces** (last authored piece lands 0.30 u short of the station, dead on its axis) |
| peak grade / summit | 21° / y 3.35 |
| footprint | x −16.6..6.7 × z −20.0..0.0 (23.3 × 20.0) |
| worst effective lateral | **0.96 g** (guard 1.5 g, validatePark margin 1.27 g) |
| max +G / −G | +3.18 / **−0.29** |
| drops / highest drop | 2 / **2.81** (past the 0.9 `shortDrop` gate) |
| air time | 0.21 s |
| length / lap | 81.3 u / **13.6 s** |
| ratings (`cars: 4`, `sceneryScore: 26`) | E **2.56** / I 2.78 / N 0.86 — **moderate**, the family band |

**Why the camelback is 8 units long.** RCT2 halves the whole rating triple four ways
(`RideRatings.cpp:2091-2140`) and a single-drop layout trips `reqNumDrops` AND
`reqNegativeGs`. One long shallow hill fixes both: the kit's camelback crest curvature is
`2π²h/L²`, so 0.8 over **8** units reads **−0.29 g** (real airtime, family forces) and its
descent counts as the second drop.

### Layout rules for any `pieces` you write

1. **End FACING the station**, ~0.30 u short of the start and dead on its axis, or
   `compileTrackPieces` closes the loop with a Dubins return leg (radius 2.2) straight
   through the circuit.
2. **The corner fragments must sum to 360° in total.**
3. A four-corner circuit has exactly **two degrees of freedom** — the two free straights.
   They are SOLVED, not guessed: walk the compiler's own `straight`/`arc`/`hill`/`rampPoints`
   advance in 2D, and the closure is linear in the two lengths, so two finite differences
   give the exact pair (13.330 / 2.030 here; 14.078 / 2.778 for the preview's radius-2.6
   variant).
4. **Ramp the curvature into every corner.** A bare chorded arc welded onto a fast straight
   leaves a ~10° kink where the auto-bank has not developed, and that junction is the whole
   G budget (the MineTrainCoaster lesson).
5. **Leave one long, level straight** for the tower to be driven through — it is placed on
   the straightest, most level stretch clear of the station (or pin it with `towerU`).

---

## THE MOSSY RUIN

Every feature is parented at a spline frame and yawed onto the track, so its local **+z runs
ALONG the rails, +x is the track's side and y is measured from the RAIL CENTRELINE** (the
ground therefore sits at a negative `gy`).

* **The broken tower the track threads.** 19 courses × 30 slots of masonry on a 2.95 ring,
  staggered half a slot per course, with a **collapsed BREACH** through each side (half-width
  **1.5**, clear height **1.95** — it has to pass a beating wing, which is exactly why it is
  built as a collapse and not a doorway), voussoirs stepped over each opening on jamb stubs
  that reach the springing line, the ruined **spiral stair** still clinging to the inside, a
  broken **window arch** high on the surviving flank, an inner shadow-stone course so the
  wall has thickness, moss on every block with sky over it, 5 root tendrils splitting the
  base, 9 ivy strands, rubble heaped where the breach came out, and a **lantern** on a timber
  bracket inside — after dark it is the light the wyrm comes through.
* **Crumbling arches over the rails** (`arches`, default 3, placed on the next-best straight
  stretches): two ragged piers at |x| 1.7, a nine-voussoir ring landing ON the pier tops, a
  keystone cap, moss, ivy, a root at each pier foot, fallen blocks clear of the corridor —
  and **one of them (index 1) is snapped clean off** above the springing. Arch 0 carries the
  trackside **brazier**.
* **The station**: a moss-decked stone platform on dry-stone piers, a low ruined wall down
  the outside, a timber canopy with mossy shingles and ivy down the posts, a lantern over the
  boarding edge, and a weathered **wyrm-head boss** (with two small glowing eyes) over the
  gate as the ride sign.
* **The glade**: moss-grown boulders, fallen columns half sunk in the moss, `fallenLog`s and
  `mushroomCluster`s from SceneryPack, and a merged scatter of mossy kerb stones marking the
  old road the ride runs along.

### Three hard-won rules baked into the masonry

1. **Break a wall with a per-slot BREAK HEIGHT, not a per-block coin flip** — and vary that
   height SMOOTHLY around the ring (`0.44 + 0.2·sin 2a + 0.14·sin 3.3a`). A per-block skip
   leaves single blocks floating; a per-slot hash leaves single-slot-wide columns standing,
   and because the courses are staggered by half a slot those columns zigzag and read as a
   chimney of floating bricks.
2. **An arch ring must LAND ON ITS JAMBS.** The first draft sprang the ring 0.16 above the
   pier tops (and the tower's breach arch a whole unit above its jamb stubs) and the
   voussoirs hung in mid-air. Only the SPRINGING blocks of an intact ring may ever be
   missing — a hash-skipped voussoir in the middle of a ring leaves its neighbours hanging.
3. **Moss is a TINT on a boulder, not a cap slab.** A flat quad laid on `buildRock`'s
   squashed icosahedron (which tops out well under `scale`) floats, and at ride distance it
   reads as a paving slab hanging in the air.

### THE WING TUCK — how the beast fits through its own breach

The polished wing sweeps **2.31 high × 2.11 half-span**; the breach is **1.95 × 1.50**. So at
the extremes of the beat a wing passed straight **through** the masonry.

Two fixes were tried. **Widening the opening was rendered and reverted**: 2.3 × 2.5 with `R`
grown to 3.55 to hold the proportion does clear the wing, but at that ratio the drum reads as
scattered pillars and the arch stops registering — a coherent breached tower is worth more
than the intersection costs. Shortening the wing would undo the whole polish pass.

So the beast **folds its wings to get through the hole**, which is what an animal does. §8
measures the *wing-bearing* segment (3 — not the head, which clears a body-length early)
against the stashed `g.userData.ruinTower` in **world** space (`run()` re-parents the segments
onto the ride, so they are not siblings of the tower), and smoothsteps a `tuck` into the
beast's updater. `furl = max(1 − speed, tuck)` — a **max, never a sum**, or a parked beast
standing in the breach drives the shoulder past its fold and inverts the wing.

The ramp is set off the **wall**, not the tower centre: `TUCK_FAR 4.7 → TUCK_NEAR 3.05`, so the
fold completes just outside `R` 2.95. A first pass ramped to full at 1.9 and the wing was still
**78 % open where it actually hits stone** — the tuck looked implemented and did nothing.

Measured (`/tmp/mp3d-render/wyrmtuck-*`): tuck 0.5 → 1.83 × 0.89, tuck 1 → 1.83 × 0.67, both
inside the window. Live-circuit assertion: `maxTuck 1.0`, `minTuck 0.0`, **folded 7 % of the
lap, fully open 91.7 %** — about a second, at the tower, and nowhere else.

⚠️ **Measuring this needs `computeBoundingBox()` first.** The membrane is rebuilt every frame
but only recomputes its bounding *sphere*, so `Box3.setFromObject` reads a stale cached box —
the first measurement returned **identical extents for every tuck level** and looked like a
saturating fold rather than a broken probe. `g.userData.wingTuck` is exposed per frame so the
assertion is on the real value, not on a still frame that happens to look right.

---

## API

```tsx
<WyrmsHollow position={[x, z]} rotation={rad} register>
  <Station /><Straight length={0.6} /><Lift height={2.8} length={9} /> …
</WyrmsHollow>
```

| prop | meaning |
| --- | --- |
| `pieces?: TrackPiece[]` | RCT2 piece list (`compileTrackPieces` vocabulary). JSX piece children (`<Station/><Lift/><Drop/><Hill/><TurnR/>…`, read with `collectTrackPieces`) **win** over `pieces`. |
| `points?: [x,y,z][]` | raw control points — the escape hatch past the compiler (still swept + validated). `pieces` wins. |
| `riders?: boolean` | decorative riders in the saddles (default true; `register` turns them OFF so real GameManager guests ride through `seatWorld`) |
| `groundAt?: (x,z) => number` | terrain sampler so the ruin, supports and props land on the ground |
| `towerU?: number` | loop parameter of the broken tower (default **auto** — the straightest, most level stretch clear of the station) |
| `arches?: number` | ruined arches over the rails (default 3, max 5) |
| `breath?: boolean` | nostril smoke + embers (default true) |

Builder: `buildWyrmsHollowScene(three, opts) → { group, update, vehicle, seatWorld,
onStateChange, crashed, invalid?, ratings? }`. `update` is motion-gated
(`createMotionGate`, spinDown 2.0 — the beast settles and furls in the station while guests
board); `vehicle` is the **head segment**; `crashed()` reports the live 1.5 g derail guard;
`ratings` is the measured RCT2 triple handed to `registerRide`. A FATAL compile sets
`invalid` so the circuit never registers. `group.userData.trackReport` carries the compile
report and `group.userData.ruin` = `{ towerU, archUs }`.

**Capacity: 8** — the TRUE seat count: 4 ridden segments (shoulders, barrel, loins, haunch)
× 2 saddles either side of the dorsal ridge, read off the live segment transforms by
`makeSeatWorld`. Registered defaults:
`{ name: "Wyrm's Hollow", capacity: 8, rideDuration: 12.2, intensity: 4, price: 5 }`.

### ⚠️ `rideDuration` IS NOT THE LAP — §8b, THE STATION LOCK

This shipped as `rideDuration: 14` against a measured 13.6 s lap, on the reasoning that
one dispatch should be one circuit. **It is not, and the beast parked somewhere new every
time.** `createMotionGate` keeps integrating its clock through the spin-**up** of
`departing` — whose length is `loadTime`, which `configurableRide.tsx:907` defaults to
**1.6**, not the FSM's bare 1.0 — and through the eased brake of `arriving`, so the clock
advance per dispatch is

```
loadTime integral (1.2) + rideDuration + arriving integral (0.75)  =  rideDuration + 1.95
```

At 14 that is 15.95 s of a 13.53 s lap: **1.18 laps every dispatch.** Measured with the real
FSM state sequence driven into `onStateChange`, the nearest SADDLE's distance from the ride's
own `board` point over 8 cycles was

```
1.2 · 11.2 · 16.4 · 21.5 · 17.3 · 4.4 · 5.5 · 13.7  u
```

— i.e. anywhere on the 23 × 20 u circuit, with guests seated into saddles on the far side of
the ruin while the station platform stood empty. (Tidewater's audit found the same class of
bug from the other end: a ride registered at 22 s with a 57 s lap.)

**Correcting `rideDuration` alone is NOT the fix.** The gate's ramp integrals carry O(dt)
error and `makeGuardedRun` clamps its *own* dt to 0.06, so the value that locks at dt = 1/30
still creeps 4.0 u over 12 cycles at dt = 1/20 and, at dt = 1/10 (the manager's clamp, i.e.
what a swiftshader park actually runs at), the train covers only ~60 % of its lap and never
comes home at all. Two things fix it, both inside this file:

* **SUBSTEP THE RUNNER.** Rail time is handed to `run()` in ≤ 50 ms slices, so the
  integration is frame-rate independent. `run()` is still called at least once per frame even
  while parked, because `wyrm.update`'s serpentine wave is applied with **cumulative**
  `rotateY/Z/X` on top of the pose `run()` writes — skip it and the body corkscrews apart.
* **THE BEAST BRAKES INTO ITS STATION AND HOLDS.** Rail time stops advancing on the frame
  *after* the head passes closest approach to the parked pose (holding on first contact with
  a threshold ball would stop it a whole radius early), and resumes only on dispatch. The
  CREATURE keeps running on the gate clock, so its wings still beat while it is held — a
  frozen animal reads as a dropped frame, not as a train that has arrived.

The parked pose is **derived, not guessed**: scan the circuit for the arc nearest `BOARD`,
then lead it by the saddle band's mean offset (`SADDLE_MID_OFFSET` = 4.5 × 0.56) so the four
ridden segments straddle the pad. Solved: `u` **0.0476**, head at local
**[−3.876, 0.546, 0]**, nearest saddle **0.38** u from the pad and mean 0.99, against
**3.03 / 3.84** at the raw build pose (head alone on the pad).

Measured after the fix, 14 cycles at four frame times:

| dt | worst nearest-saddle distance from `board` | spread over cycles 1-13 |
|---|---|---|
| 1/60 | **0.41** | 0.01 |
| 1/30 | **0.42** | 0.03 |
| 1/20 | **0.46** | 0.07 |
| 1/10 | **0.48** | 0.09 |
| 1/30 ±40 % jitter | **0.43** | 0.05 |

`g.userData.stationStop` publishes the pose and `g.userData.stationHold` the live flag, so
the assertion is on the real value. **Do not raise `rideDuration` back toward the lap:** the
lock needs the dispatch to land just PAST the parked pose so the brake has something to
absorb. 12.2 + 1.95 = 14.15 against a 13.53 s lap is 0.62 s of overshoot — enough at every
dt above, small enough that the held dwell falls inside `arriving`, where the gate is already
easing the beat down.

**Layout offsets** (component-local; the station straight is compiled along local **−x** with
`heading: −π/2`, so every compiled point has **z ≤ 0** and the local +z face is clear of
track): queue **HEAD `front: 2.0`** out the +z face, exit hut `exit: [1.7, 1.9]`, boarding
`board: [-1.3, 0.75, 0]` on the mossy platform at saddle height.

## THE NIGHT READ — living light, for no PointLight

The audit's night shot was decisive and bad: outside the three lantern pools the **entire
23 × 20 u circuit went black**, which is the rubric's "presence, not brightness" failure and a
real one on a night-forward world. Measured over the land window of the rig shot, the whole
ride carried **1** connected lit point (luma > 70) and 0.02 % of its pixels above luma 40.

The light budget was already spent (the land owes 19 before gate and path furniture), so the
answer is **emissive only** — and in the world's own language rather than in lamps it cannot
afford. `livingMats` collects them and the updater lerps `GLOW_DAY 0.14 → GLOW_NIGHT 1.35` on
the raw `nightK`, never gating to zero, each material breathing on its own phase:

* **glow-worms** (`glowGrains`, local — this file is the world's first component and
  `ThornwickScenery` imports its palette FROM here, so reaching back for `glowWormCrust` would
  close an import cycle): the tower's rubble and root splits, both feet of every arch, the
  station's mossy boarding edge, and 16 clumps down the old road. **Diffuse is a dull
  grey-green, never the lit green** — MoonlitBarge's rule; a grain coloured like its glow reads
  as a speck of white litter at noon.
* **carved runes** (`carvedRunes`) — a spiral of chevron strokes, the glade's stone-circle
  motif, so the coaster's ruin and the megalith ring read as the work of the same hands. ⚠️
  **On the OUTER skin.** The first pass cut them into the wall's inner face, the one surface in
  the tower nothing outside the drum can see, and the render came back with no runes in it.
* **two pale glowing toadstool caps** on the far side of the circuit from the station, at
  **half** strength (a broad flat emissive at full glow renders as a solid white-green disc
  with no form in it — ThornwickScenery's number and its reason), and **7 clumps of glowing
  flower pods** on nodding stalks, which is the one device that puts colour at eye level.

Measured after, same window: **26** connected lit points and **8×** the pixels above luma 70,
with mean luma unchanged (8.8 vs 9.5, dominated by the beat phase). Which is the point — the
circuit is now *marked* after dark, not brightened.

## Budget

**2** ParticleKit emitters (**180** particles — nostril smoke 110 + embers 70, and they live
in the RIDE's space so the smoke is left behind). **4** PointLights and not one more: the
tower lantern, the arch brazier and the station lantern (all night-gated) plus the beast's own
amber head glow (day-AND-night lerped — it is the eyes and the breath, so it never gates to
zero). Everything above under "the night read" is emissive and costs none. Every
static repeat goes through `mergedBoxes` (tower courses / inner face / moss / rubble / stair /
window, arch piers + rings + fallen blocks, station piers + wall + canopy + roof + shingles,
kerb scatter, per-segment spine·shingle·belly batches, ivy stems + leaves). `lodDetail` on the
flank shingles, decorative riders, ivy, roots, small boulders, logs, mushrooms and the kerb
scatter. Deterministic throughout: `hash01` sines only, no `Math.random` / `Date.now`;
absolute-time updaters. Console verified **clean** across all five previews — no `warning`,
no `FATAL`, no `self-inter`, no `design violation`.

## Screenshot verdicts

* **THE WYRM (preview 0)** — the money shot, shot from a ~30° three-quarter (round 8 shot it
  from 26° almost down the beast's own AXIS, which foreshortens both wings into slivers — the
  one thing the money shot has to show). Both wings spread and fanned between visible finger
  bones with the vein network and the scalloped trailing edge reading across them, the neck
  reared and the skull carried level and high, the horns raking back over it, the amber eye
  lit by DAY, a pale dorsal ridge marching down the back into the tail spade, the oxblood belly
  line, claws under the chest, eight riders in the saddles, and the blue-shirted guest on the
  ground for scale.
  **Sample the beat before you judge a still.** Rendering preview 0 at four waits a quarter
  period apart (`--wait=4000/4650/5300/5950`) is the honest test: three of the four read as a
  spread membranous wing and one catches the top of the stroke, where any wing is edge-on.
* **THE HEAD (preview 1)** — horns, hooded brow, pale socket, slit-pupil glow, the tooth rows,
  the tapering muzzle with its rounded nose and nasal bridge, the neck's dorsal spikes and
  throat scutes, and the spread wings behind carrying their vein map. The muzzle no longer
  falls into shadow — it is the lightest hide on the animal on purpose.
* **Rig, day (preview 2)** — the whole circuit fits: the ruin complex and its tower on the far
  side, three arches over the rails, the station and canopy across the back, oak trees round
  the glade, fallen columns and mushroom clusters in the grass, and the wyrm mid-lap.
* **THE TOWER (preview 3)** — a genuinely round broken tower with the track running through
  the breach, moss on every surviving course, ivy down the outside, the stair inside, rubble
  at the foot, and an arch further round the circuit for depth.
* **Night (`--night --nightwait=9000`)** — three lantern pools (tower, station, brazier), the
  beast's eyes and breath the only glow on it, and its spread wings catching the brazier.
* **Flex sanity** — the same preview rendered at t=4.0 s and t=9.5 s shows the beast at
  different points of the circuit with a visibly different body pose (through a corner vs
  along the straight), which is the point of driving the segments off the spline frames.

---

## Audit — 2026-07-25, 100/100

⚠️ **EVERY HIGH-ANGLE VERDICT ABOVE THIS LINE WAS TAKEN AT 17.8°, NOT 50°.** `render.mjs`'s
`--angle`/`--elev` used to synthesize a mouse drag that never reached the Stage on a heavy
page, and preview 2's own `setCameraPose` puts the rig camera at **17.8°** — so "reads fine
from above" was said about pictures that were not from above. The harness now drives
`StageApi.setCameraPose` and PRINTS the pose achieved; every shot below carries one. Note
that `<ScenePreview>`'s DEFAULT elevation is **50.6°**, i.e. the park camera — it is only
this component's previews, which set their own pose, that shoot low.

| Dimension | Score | Notes |
|---|---|---|
| Mesh richness & count | 15/15 | **860 meshes / 131 928 tris** built (beast alone **405 / 44 336**), 67 `lodDetail`, every static repeat merged |
| Detail | 15/15 | tex+bump throughout; 4 PointLights (3 night-gated + the day-lerped head glow) **plus a whole emissive living-light layer** — 26 lit points after dark against 1 before |
| Cohesion | 20/20 | 96-sample × 3-beat sweep at 3 tuck levels with an explicit `computeBoundingBox()`: tuck 1 → **1.834 × 0.674** inside the breach's 1.95 × 1.50. Live tuck assertion re-run after the station-lock rewrite: maxTuck **1.0**, minTuck **0.0**, folded **7 %** of the lap, fully open **91.7 %** |
| Guest comfort | 15/15 | 8 real `buildPeep`s in the 8 live saddle anchors, swept 72 frames of a 14-s window: min gap **across the ridge +0.027**, **to the rider in front +0.132** — positive at every phase, which is the check Emberfall's audit found NEGATIVE at 26 mm |
| Guest location | 15/15 | **the headline fix.** 8/8 distinct anchors; nearest saddle **0.41-0.48 u** of the boarding pad on every cycle at dt 1/60, 1/30, 1/20, 1/10 and ±40 % jitter, over 14 cycles — against **21.5 u** as shipped |
| Aesthetic | 20/20 | reads unmistakably as a ridden dragon at a real **50°** (full wing planform, veins, finger bones, pale ridge, lit eye, 8 riders); the tower reads as a round breached drum with the track through it at 50°; night is *marked*, not brightened |
| **Total** | **100/100** | |

**Probes** (all new, all in `/tmp/mp3d-render`): `aud-tw-cycle{,2,3,4,5}.tsx` (the gate
surplus and the rideDuration sweep), `aud-tw-station.tsx` (the parked-pose scan),
`aud-tw-lock.tsx` (the lock across dt), `aud-tw-facts.tsx` (census + tuck sweep + rider
cohesion), `wyrmtuck-live.mjs` (regression), `aud-night.mjs` (night presence).
**Shots:** `shots/AB-wyrm-{day,night,az115,el50,head,tower}.png`,
`AD-wyrm-night.png`, `AE-wyrm-beast-el50.png`, `AF-wyrm-tower-el50.png`.

Fixed this pass:
* **`rideDuration` 14 → 12.2 + the STATION LOCK + runner substepping** — the beast parked up
  to 21.5 u from its own boarding pad, on a different part of the circuit every dispatch, and
  at a swiftshader frame time it never completed a lap at all. See §8b.
* **The night read** — 26 lit points against 1, for zero extra PointLights: glow-worms,
  carved runes (on the OUTER skin, after the first pass cut them where nothing can see),
  two half-strength glowing caps and 7 clumps of glowing pods.
* **The preview kerb** — 16 identical blocks at even angular spacing read as a ring of grey
  cubes on the grass at 50°. Now a broken run: hashed size, yaw and tip, two tones, one stone
  in four missing.

No reverts this pass. The ruin breach stays **1.5 × 1.95** — widening it was tried, rendered
and reverted in an earlier round and that verdict stands; the wing tuck is what fits the beast
through it.

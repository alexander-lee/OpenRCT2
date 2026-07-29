# Component audit — the /100 rubric

The repeatable internal audit for every component that draws into a Stage.
`asset-testing.md` says *that* an asset must score 100/100 before it ships;
**this document is the rubric it scores against**, the exact shots to take,
and — the part that matters — **how to MEASURE each dimension instead of
eyeballing it**.

> Written because this project kept re-deriving the same judgement calls, and
> because a confident "looks good" has been wrong here more than once. Every
> measurable check below exists because something shipped without it.

---

## 0. The one rule that makes this worth doing

**A claim you did not measure is not a score.**

The single most expensive pattern in this project has been an agent (or me)
declaring a thing fixed from a still frame that happened to look right. Three
worked examples, all real:

- A wing "tucked" through a ruin. The fold was implemented, engaged, and
  **78 % open at the exact point it hits stone** — the ramp was measured to the
  tower's centre, not to its wall.
- The first attempt to measure that fold reported **identical extents at every
  fold level**. The membrane rebuilds each frame but only recomputes its
  bounding *sphere*, so `Box3.setFromObject` was reading a stale cached box.
- A `<TidePool>` crash was "worked around" with a 6-seed allow-list. The real
  bug threw on **a third of all seeds** and took every sibling in the
  set-piece down with it.

So: for each dimension below, prefer the probe. Screenshots grade *aesthetics*;
probes grade *geometry*.

---

## 1. The shots (mandatory, before scoring anything)

```sh
cd /tmp/mp3d-render
node render.mjs <Name> --wait=6000                      # day, lead preview
node render.mjs <Name> --night --nightwait=15000        # night
node render.mjs <Name> --angle=115 --wait=6000          # alternate silhouette
node render.mjs <Name> --elev=50  --wait=6000           # the PARK camera (~50°)
node render.mjs <Name> --preview=N                      # every other preview
```

Four rules learned the hard way:

1. **The ~50° elevation shot is not optional.** It is the angle the park
   actually uses. A dragon that read fine at 26° read as a low wyvern from
   above; the fix only became obvious in the high shot.
2. **Night needs `--nightwait=15000`.** The light lerp is slow; a short wait
   grades a half-lit scene.
3. **Cyclic effects need a timed shot.** An eruption, a vent, a beat or a
   fly-through only exists for part of its period — a naive `--wait` misses it.
   Compute the phase and render *at* it.
4. **Read the screenshot.** Actually open it. Do not grade from the fact that
   the render command exited 0.

---

## 2. The rubric — 100 points

| # | Dimension | Points |
|---|---|---|
| 1 | Mesh richness & count | 15 |
| 2 | Detail | 15 |
| 3 | Cohesion — spacing, gaps, interpenetration | 20 |
| 4 | Guest comfort | 15 |
| 5 | Guest location | 15 |
| 6 | Aesthetic | 20 |

**Ship only at 100.** A dimension is scored down to whatever the worst
surviving defect costs; partial credit is fine, silent rounding-up is not.

---

### 1. Mesh richness & count — 15

*Is the thing built, or is it a box with a texture on it?*

| Deduct | For |
|---|---|
| −8 | A major part is a single primitive that should be an assembly (a "seat" that is one box, a "tower" that is one cylinder) |
| −5 | Static repeats not batched — N `box()` calls where `mergedBoxes`/`mergedParts` would give one draw |
| −4 | Over budget: the part count buys nothing at park distance and no `userData.lodDetail` is set on the fine stuff |
| −3 | Silhouette collapses at distance — nothing reads once the detail LODs out |

**Measure it:**
```js
let meshes = 0, tris = 0;
group.traverse(o => { if (o.isMesh) { meshes++; tris += o.geometry.index
  ? o.geometry.index.count / 3 : o.geometry.attributes.position.count / 3; } });
```
Record both. Reference points from shipped components: a flat ride 120–210
meshes, a scenery piece 8–48 draws, a dressed world set-piece ~2 900 draw calls
in a live park. Park-wide budget is `2500·(size/16)²` meshes.

---

### 2. Detail — 15

*The small stuff that makes it look made rather than blocked out.*

| Deduct | For |
|---|---|
| −5 | No procedural texture + bump on significant surfaces (flat untextured slabs) |
| −4 | Missing the expected furniture: bolts, trims, signage, lamps, rails, steps, kerbs |
| −3 | Mechanism not modelled — a ride that moves with no visible drive, gear, rope or motor |
| −3 | Night adds nothing: no emissive, no gated lamp, the piece just goes dark |

**Two traps that cost real rounds:**
- **`metalness ≥ 0.6` renders near-black** — this Stage has no env map. Keep
  metals 0.2–0.35.
- **A local procedural canvas must have a NEAR-WHITE ground.** `mat({tex})`
  bakes tone into the canvas and leaves colour white; a *local* canvas
  multiplies. A `#8b8d80` lichen canvas turned every megalith near-black.

---

### 3. Cohesion — 20 (spacing, gaps, interpenetration)

*The dimension most often failed, and the one you cannot eyeball.*

| Deduct | For |
|---|---|
| −8 | Interpenetration: two parts occupy the same space, or a part passes through a wall/floor it should meet |
| −6 | A visible gap where two parts should join — daylight between a leg and its foot, a roof and its wall |
| −5 | Floating: a piece not resting on its ground/`heightAt`/parent surface |
| −4 | Moving parts collide over their range — fine in the rest pose, fouling mid-cycle |
| −3 | Z-fighting between coplanar faces |

**Measure it — the rest pose is not the test:**

```js
// sweep the whole animation, not one frame
for (let i = 0; i < 64; i++) {
  const clock = (i / 64) * PERIOD * 3;
  update(clock, 1, 0.2);
  group.updateMatrixWorld(true);
  // ⚠️ geometries rebuilt per frame often recompute only the bounding SPHERE.
  group.traverse(o => { if (o.isMesh && o.geometry) o.geometry.computeBoundingBox(); });
  const b = new THREE.Box3().setFromObject(group);   // now valid
  // ...record max extents, compare against the aperture/neighbour it must clear
}
```

- **Sweep the cycle.** A neighbour clash at the extreme of a beat is invisible
  in the rest pose. One ride's handwheels collided only mid-sweep.
- **Clearances are measured against the *thing*, not its centre.** A wall sits
  at radius `R`; ramping a fold to the *centre* leaves it open where it hits.
- **Settling ≠ paving.** `useComposable` settles on TERRAIN, but `<Paths>` lays
  a 0.09 u slab on top — a walk-on piece needs a `flush` lift or it sinks.

---

### 4. Guest comfort — 15

*Applies to anything a peep sits in, stands on, wears or carries.*

| Deduct | For |
|---|---|
| −6 | Rider clips the vehicle — body through a wall, arm through a bar, head through a canopy |
| −4 | No visible cushioning: a "seat" with no pan, cushion or backrest |
| −4 | No believable restraint (lap bar, harness, rail) on anything that moves fast or inverts |
| −3 | Held item wrong: floating ahead of the fist, buried in the sleeve, or sized for a different item |

**Measure it — the held-item probe, in the ARM-LOCAL frame:**
the fist ball centres at `(0, −0.32, 0)` with r 0.05; the forearm box is
`|z| < 0.055`. An item passes when its axis at the grip is **inside the fist
ball** and its back lip is **not buried in the sleeve**.

> The shared hold spot is sized for a fat burger, so slim items (skewer, floss,
> sushi, candied apple, cup) float unless they carry **their own self-offset**.
> Tilt is structural, not styling: the candied apple needed 0.6 rad where the
> skewer needed 0.4 — at 0.4 only 0.03 of stick showed and it read as a
> floating apple.

Seat anchors: assert **N distinct anchors for capacity N**, that riders are
**frozen while `waitingForPassengers`** (parked drift `0.0000`) and **move
while `travelling`**.

---

### 5. Guest location — 15

*Is the peep where the sim thinks it is, and where a person would be?*

| Deduct | For |
|---|---|
| −6 | Capacity ≠ real visible seats (a ride claiming 16 with 8 places) |
| −5 | Guests sunk into or hovering above the seat/floor surface |
| −4 | Empty ride runs with no one aboard, or moves before loading completes |
| −4 | A guest can be **pinned** — enters a zone and never resumes walking |
| −3 | Visible seats never fill: riders should occupy real places with empty ones showing |

**Measure it:** a behaviour probe in a real `<Park>` + GameManager, sampling
every ~150 ms. Assert guests arrive, interact, **and resume walking**.

Three ways this measurement lies, all encountered:
- **`'watching'` is also the sim's watch-a-ride state** — a guest watching a
  coaster 25 u away faked a *239-second* pin.
- **Wall-clock is the wrong clock.** Dwell runs on frame `dt`, `simTime` on the
  absolute clock; under SwiftShader's ~1.3 fps they differ by ~25×.
- **The gated stat is *still-while-`walking`***, not total stop time.
  `validatePark` fails at >25 sim-s. A stationary *state* resets its detector;
  an *action* taken while still `'walking'` does not — which is why a walk-on
  attraction must use `registerWatchZone`, not `registerDanceZone`.

---

### 6. Aesthetic — 20

*Does it read, instantly, as the thing it is meant to be?*

| Deduct | For |
|---|---|
| −6 | Doesn't read as its subject from the park camera |
| −5 | Colour outside the palette — no orange/pink plastic; muted brick red, forest green, navy, cream, silver, grey-brown |
| −4 | Value collapse: the piece is the same VALUE as its ground and vanishes from above |
| −3 | Night is presence-not-brightness — half the piece disappears instead of being lit differently |
| −2 | Repetition artefacts: a regular lattice reading as a checkerboard, scatter reading as confetti |

**The recurring aesthetic failures, so you don't rediscover them:**
- **Flat boxes on the ground read as floor tiles.** Split into squashed lumps
  (horizontals) and thin plates (vertical faces only).
- **Scatter reads as confetti; clumps read as the thing.** Four tufts of five
  blades beat sixteen lonely blades.
- **A land-scale dither must clump** — per-cell hash on a regular lattice
  checkerboards once the band is more than a few units wide.
- **The floor question is not light-vs-dark paving**, it is "which tone is 2+
  stops off MY OWN ground" — and it goes both ways: a foundry needed
  pale-majority, a wood needed the opposite because pale read as municipal
  concrete.
- **Prop-sized ≠ hero-sized.** A 1.8 u wreck blown to 4.9 u in an 18 u court
  read as a ribcage until it was rigged with a mast.
- **A symmetrical roof buries its own counter** — stalls need an asymmetric
  catslide.

---

## 3. The scorecard

Record the result in the component's `Context.md` under `## Audit`, so the
next pass starts from the last one:

```markdown
## Audit — YYYY-MM-DD, /100

| Dimension | Score | Notes |
|---|---|---|
| Mesh richness & count | 15/15 | 146 meshes / 23 251 tris, batched |
| Detail | 15/15 | tex+bump throughout; 2 night-gated lamps |
| Cohesion | 20/20 | 64-sample cycle sweep, no clash; settles flush |
| Guest comfort | 15/15 | held item probed in arm-local frame |
| Guest location | 15/15 | 8/8 anchors, parked drift 0.0000 |
| Aesthetic | 20/20 | reads at 50°; night is lit, not dark |
| **Total** | **100/100** | |

Probes: <paths>. Shots: <paths>.
Fixed this pass: <one line per deduction closed>
```

---

## 4. Running an audit

```sh
# 1. structural gates first — a component that throws cannot be graded
node check-all.mjs                         # every preview bundles
node validate-react-park.mjs               # ok: true
node ../rct2-design-system/mp3d/tools/seed-sweep.mjs <Name>   # SWEEP CLEAN

# 2. shots
node render.mjs <Name> --wait=6000
node render.mjs <Name> --night --nightwait=15000
node render.mjs <Name> --angle=115
node render.mjs <Name> --elev=50

# 3. probes for dimensions 3-5, then score, fix, re-render
```

**Order matters.** Run `seed-sweep` before anything visual: a builder that
throws on some seeds takes every sibling in its set-piece down with it, and the
resulting render looks like a broken *land*, not a broken *prop*.

**Iterate to 100.** Every deduction gets a concrete fix and a fresh
render/probe. If a deduction cannot be closed, it is not "100 with a caveat" —
it is a score below 100 with a named blocker, reported as such.

**Reverting is a valid outcome.** A change that measurably fixes one dimension
while visibly damaging another should be reverted and recorded, with the
reason, so it is not retried. The ruin breach was widened to clear a wingtip,
rendered, judged worse, and reverted — the comment in that code exists so the
next person doesn't repeat it.

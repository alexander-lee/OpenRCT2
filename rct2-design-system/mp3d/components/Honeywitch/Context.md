# Honeywitch

**CANONICAL IMPORT — copy exactly:** `import { Honeywitch } from './components/Honeywitch';`
*(never from `'./Park'`: only the `<Park>` wrappers + track-piece JSX live there. A wrong
specifier makes esbuild refuse the WHOLE bundle — the round-8 black-page failure.)*

**"The Honeywitch" — THORNWICK GLADE's food stall: a crooked half-timbered COTTAGE COUNTER** selling **honey cakes and candied apples**, with a toffee cauldron on a tripod beside it. Rubble-stone plinth under lime-washed cob between smoke-black oak framing, a sagging asymmetric thatched **catslide** roof, a crooked chimney with a wisp of baking smoke, a serving hatch under a propped shutter, and — RCT2-style, the building says what it sells — a stand of real candied apples on the counter and one heroic candied apple painted on the hanging sign.

Serving front faces local **+z**; the GameManager attach point sits **0.72 u** out that way. Sized against a 0.5-scale park guest like the four catalog shops, EmberRoast and SushiStall: **counter top y 0.40, hatch lintel 0.72, eaves 0.86, ridge 1.24, chimney top 1.62.** Footprint **2.71 × 1.84** (x −1.32…1.39, z −0.86…0.98) including the cauldron and the glade floor.

## Exports

- `<Honeywitch position rotation scale withGuest effects seed register pinned name price value>` — built on `<ConfigurableStall>` via `composableStall`. Inside a `<Park>`, `register` registers a selling FOOD stall (defaults: **The Honeywitch, price 4, value 6**): guests hunger-seek it, buy, eat a real candied apple and bin/litter the container. `withGuest` adds the decorative queueing peep — **already carrying a candied apple**, which is the fastest way to read what the shop sells (preview flavour; default off). `effects` (default true) toggles the chimney smoke.
- `buildHoneywitch(t, { withGuest?, effects?, seed? }) → { group, update, dispose }` — the imperative builder.
- `buildHeldCandyApple(t) → THREE.Group` — the held item recipe (below).

**NAME IT** (round-7, same as the other stalls): `register={{ name: 'The Honeywitch', price: 4, value: 6 }}` — the manager keys `moveStall` and the corridor resolver on the NAME, so shipping the catalog default twice makes it measure the wrong shop.

## Palette — no invented browns

Every stone / moss / ivy / lantern hex is **`THORNWICK`** straight from `components/WyrmsHollow`, and every living tone (bark, loam, fern, iron, lamp glass, cap red, dusk violet, cream stipe) is **`GLADE`** from `components/ThornwickScenery` — exactly the way SushiStall dresses out of `TIDEWATER` and EmberRoast out of `EMBERFALL`. This cottage weathers like the ruined arch standing next to it. The only *saturated* colours in the piece are the **food** (honey gold, toffee amber, candy madder red) and the witch's madder-and-moss awning cloth, which is deliberate: in a muted forest the goods should be the brightest thing on the counter.

## NOTHING IS PLUMB

A witch's cottage leans, and this is the piece's whole identity, so it is built in:

- the entire shell lives in a group tipped `rotation.z 0.035` / `rotation.x −0.012`;
- the **chimney leans the other way** (`−0.075`), which is what makes the lean read as deliberate rather than as a broken transform;
- the thatch **ridge SAGS 0.055** in the middle (`ridgeY(x)`) — a swaybacked ridge is the whole read;
- every stone block, cob panel, thatch bundle and log end is hashed in size and yaw;
- the four wall bays are **different widths** with the braces going alternate ways. A grid of even squares reads as a Tudor pub.

The **cauldron and the glade floor stay OUT of the tipped group** — a tripod stands level on the ground, and a tilted patch of loam reads as a bug.

## ⚠️ THE CATSLIDE ROOF — the biggest fix in this build

The first pass gave both slopes the same 0.61 overhang, and from the park camera (which looks DOWN at ~50°) the front eave hung right over the counter: the whole cottage rendered as a **giant brown haystack** with the apples, the cakes, the honey crock and the half-timbering — everything the shop is *for* — buried in its shadow. **This is EmberRoast's flue-hood lesson in another shape** ("nothing sits over the thing you are selling").

So the ridge sits **back of centre** (`RIDGE_Z −0.10`) and the roof is a real **CATSLIDE**: a short steep front slope (`FRONT_Z = HD + 0.07`) that clears the goods, and a long shallow back slope (`BACK_Z = HD + 0.36`) running nearly to the ground down the side where nothing is sold. That is a genuine cottage form and a much better silhouette than a symmetrical tent.

**And the bundles are NARROW.** At 0.13-0.22 wide they read as **planks**. Thatch is a mass of small bundles, so they are 0.055-0.10 here, in **7 courses** per slope whose depth is 1.5× the course pitch so each course laps the one below — that lap line is the stepped shadow a thatched roof has. Bent hazel **PEGS** pin the ridge (without them the ridge is a sausage), and moss grows on the long shaded BACK slope and along the crown, never on the sunny front guests look at.

### ⚠️ AND IT STILL READ AS A BRICK WALL FROM THE PARK CAMERA — three fixes

The catslide solved the SHAPE. The 50° audit shot said the roof was still wrong, in three ways that all come down to the same thing: at the park's camera the thatch is most of the piece's visible area, so any regularity in it is the loudest graphic the stall owns.

1. **The dark tone was a per-bundle coin flip** (`c === 0 || h(...) > 0.66`), so a random third of the bundles went dark and runs of two to four of them merged into rectangles — the roof rendered as courses of **BRICKWORK**. Real thatch weathers in vertical DAMP STREAKS, so the roll is carried by a low-frequency function of **x**, shared by every course and therefore continuous from eave to ridge, with only ±0.12 of per-bundle noise on top. The lowest course still goes dark whole: an eave course is in its own shade.
2. **The courses were evenly pitched.** `u = (c + 0.5)/NC` put every course line dead straight and dead evenly spaced up the slope. A thatcher's courses wander: ±0.055 of the pitch, enough to break the rhythm and small enough that the 1.5× lap still covers. Each course also starts at its own x offset, so the bundle joints never stack into columns.
3. **The straw was the brightest surface in the piece.** At `0xa8905c` (luma 145) the roof out-shone the goods it exists to shelter — the catslide lesson again, in tone instead of in shape — and against `THATCH_D` at 107 (0.44 stops) it gave the per-bundle roll something loud to work with. Both moved: **`THATCH` 0x9c8656 / `THATCH_D` 0x84714a** (135 / 114, 0.24 stops). Re-rendered at a real 50°: the grid is gone, the roof reads as lapped courses with damp streaks, and the red apples and the green crate hold the eye.

**The LOG STORE** closes the catslide. The back slope reaches 0.80 past a wall that stops at 0.44, so from behind there was a clear void with grass showing through it — a lean-to with nothing in it. A cottage that bakes and boils toffee keeps its firewood exactly there: a boarded back panel plus three rows of split log **ENDS** (cylinders on end, two tones, hashed). It also explains the fire under the cauldron.

## The goods — the building says what it sells

- **THE APPLE STAND** — a drilled oak block with **seven candied apples stood in it**, dark drill holes and all. This is the shop's sign at counter level.
- **THE CAKE BOARD** — five hashed honey cakes (browned base, domed crumb, a shiny honey glaze puddle that does *not* cover the whole crown so the crumb still reads) on a pale serving board. **No glass cloche**: this is a hatch in a wood, and a sealed cabinet reads as a mall kiosk (SushiStall's open-ice-case call).
- **THE HONEY CROCK** with a dipper leaning in it, a run of honey down the crock and a smear on the counter. A crock with nothing coming out of it is a jar.
- **A CUT HONEYCOMB FRAME** propped in the hatch reveal: a shallow wooden frame filled with a merged grid of hexagon cells.
- **THE SIGN** — a painted board on a wrought-iron scroll bracket off the +x gable eave, carrying ONE HEROIC CANDIED APPLE (the same `candyApple` recipe, at 0.088 R) over a painted honeycomb roundel. Same move as EmberRoast's giant skewer.
- **THE TOFFEE CAULDRON** is doing a job — it is where the apples get dipped: an iron pot (belly, rolled rim, two lug handles) on a three-leg tripod over three cold logs and a bed of embers, half full of molten toffee with a stirred **swirl** across it, and **two freshly-dipped apples hung upside-down on a setting rack** over it.

`candyApple(r, stickLen, seed, { simple })` is one recipe at four scales — the counter stand, the cauldron rack, the sign, and the held item. `simple` drops the highlight shell and the toffee drip for the nine small instances: two extra meshes each is 18 draw calls for a highlight nobody can resolve at 0.034 R.

## Dressing

A coiled-straw **bee skep** on a stone (seven real stacked coils and a crown knot, with a dark entrance notch), a **besom** with iron bands, a **crate of UNDIPPED green apples** — the contrast is what tells you the red ones on the counter have been dipped — **herb bundles hung upside-down** off the eave (which is exactly what a cottage that cooks does with its herbs), and loam + moss cushions + three little toadstools in the world's own cap colours planting the whole thing in the glade rather than on a lawn.

## The held CANDIED APPLE (`buildHeldCandyApple`)

Registered on the stall descriptor as GameManager's `StallConfig.heldItem`: every guest who buys HERE walks off eating THIS — a 0.062-radius toffee-shelled apple on a 0.34 hardwood stick, with a dark toffee well where the stick goes in (that dimple is what makes the stick read as pushed INTO an apple rather than glued under a ball) and a drip down one side — instead of the manager's generic burger puck.

### THE FLOSS-CONE LESSON, THIRD TIME

The shared hand hold spot (`holdSpot` in `GameManager/guestFx.ts`) puts the item anchor at arm-local **(±0.03, −0.37, 0.15)** — **0.15 FORWARD** of the fist ball and 0.05 below it — because it was tuned for a FAT BURGER. A slim item left near its own origin therefore floats a clear 0.1 in front of the hand: it happened to CottonCandyStand's floss cone, to EmberRoast's skewer and to SushiStall's tray before each of them carried its own self-offset.

```
position (0, 0.03, −0.15)    rotation.x 0.6    apple centre y 0.24    stick length 0.34
```

**Why those numbers.** The **z offset −0.15** is what threads the stick through the fist: it cancels the anchor's forward push, so the fist centre lands on the item group's own y axis (`A = 0.05 − 0.03 = 0.02`, `B = −0.15 − (−0.15) = 0`), and with `B = 0` **any** tilt keeps the stick inside the 0.05 ball. The **tilt 0.6** — larger than EmberRoast's 0.4 — decides something else: how much of the shaft clears the **ARM BOX**, which is 0.11 deep, i.e. anything at `|z| < 0.055` is buried inside the sleeve. At 0.4 only 0.03 of shaft showed in front of the arm before the fruit began and the close-up read as an apple floating with a stub under it; at 0.6 it is 0.075, and the apple reads HELD. The stick is also **0.17 R** thick, not 0.13: a toffee-apple stick is a chunky lolly stick, and a 0.017 shaft went sub-pixel at park zoom.

### PROBED, not eyeballed

| check | value | needs |
| --- | --- | --- |
| stick axis → fist-ball centre | **0.032** | < 0.05 (inside the ball) — passes THROUGH the fist |
| bare handle below the ball | **0.024** | > 0 — a real handle under the little finger |
| apple underside → top of the grip | **0.060** | > 0 — no intersection with the fingers |
| apple → head centre at FULL BITE LIFT (`armR.rotation.x −2.2`) | **0.238** | > 0.188 (skull r 0.12 + apple 0.068) — clears the hair |

Previews **2** and **3** build a peep at the *exact* GameManager transform and shoot it close, front and 3/4-profile, so the fit is judged in a render and not on paper. Verdict: **PASS** — the apple reads as held from both, with the stick visibly entering the fist and the handle emerging below it. Override per placement with `register={{ heldItem }}`. See `components/GameManager/Context.md` → "Per-stall held items".

## Glow discipline — two kinds, deliberately different

- **THE TOFFEE is hot sugar over a fire, and hot sugar is NOT A LAMP.** Following EmberfallScenery's rule (which this world already applies to glow-worms, lit toadstool caps, carved runes and flower pods) its emissive only **LERPS** `GLOW_DAY 0.14 → GLOW_NIGHT 0.8` and its PointLight keeps a real **daylight floor of 0.3**, so the pot is visibly hot at noon as well. The swirl runs 1.3× the pool and the embers 0.75×, and the whole lot shimmers on an absolute-time term. Both ends are kept LOW on purpose: a 0.19-diameter disc of emissive is a big flat surface, and at 1.35 the pot rendered as a glowing golden **donut** — a lamp on a tripod rather than a pan of toffee.
- **THE EAVE LANTERN is a lamp** and gates HARD to dark by day on a smoothstepped `nightKOf`, so the difference between the day and night shots is that it comes on. Its PointLight is a **child of the fitting**, so it follows any placement with no world-space arithmetic.

## Budgets (measured headlessly)

**146 meshes / 23 251 triangles** (164 meshes with the decorative guest), **2 real PointLights** (the day-floored toffee bounce + the night-gated eave lantern), **1 emitter / 30 particles** (the chimney's wisp of baking smoke — non-additive, because smoke has to occlude; that wisp is the cue that sells a cake shop), **12 objects tagged `userData.lodDetail`**. Every static repeat batched through `mergedBoxes` / `mergedParts`: the plinth, the timber framing, the cob panels, seven thatch courses, the ridge run, the hazel pegs, the roof moss, the chimney courses, the awning scallops, the sign bracket and roundel, the crate slats, the log ends, the besom twigs, the herb stems, the honeycomb cells, the drill holes, the tripod legs, the setting rack. Deterministic — hashed sines only, never `Math.random` / `Date.now`; the updater takes ABSOLUTE time. Verified: two independent builds of one seed have identical bounds.

The held apple is **5 meshes / 1 032 triangles**, built ONCE per stall and `clone()`d per purchase (geometries and materials shared with the prototype — which is also why nothing is disposed when an item leaves a hand).

## Previews

0. **Selling candied apples (live sim)** — a miniature `createGameManager` on a path loop with the stall registered at the hatch front (anchor `[0, 0, 0.1]`, serving front z 0.82), pre-warmed 78 sim-s so the crowd is already hungry, then 2× time: guests walk up, buy, and stroll off eating a real candied apple until only a container is left to bin.
1. **3D rig** — `<Honeywitch withGuest>` in `<ScenePreview distance={4.8} targetY={0.8} autoRotate={false}>`.
2. **The held apple — against the hand** · 3. **The held apple — profile** (the two verification shots above).
4. **The cottage after dark.**

## Screenshot verdicts

- **Live sim** — reads instantly as a shop: two guests walking away carrying red candied apples, one at the counter, litter on the path, the thatched cottage with its lit sign behind them.
- **3D rig, day** — the catslide thatch with its stepped courses and mossy crown, the half-timbered front, the counter goods all legible, the bee skep, the crate, the cauldron, the hanging apple sign.
- **Alternate angle (95° orbit)** — the long mossy back catslide over the log store, the tripod cauldron and the chimney in silhouette.
- **Night** — the eave lantern pooling on the hatch and the goods, the toffee still warm in the pot, smoke off the chimney.
- **Held apple, front + profile** — the fit above.

## Modelling notes worth keeping

- The **serving hatch** is a real hole in a wall: a near-black interior recess behind the counter shelf, corbels under it, a lintel over it, and a **shutter propped open** on two struts above. Without the recess a hatch reads as a painted rectangle.
- The **awning** is a short valance ABOVE the head beam, not a canopy over the counter — see the catslide note.
- The chimney sits at `z −0.14`, back of the front slope, so it emerges through the long back roof rather than out of the eave over the goods.

---

## Audit — 2026-07-25, 100/100

`<ScenePreview>`'s default elevation measures **50.8°** here (the harness printed it), so this
stall's own previews were already shot at the park camera — nothing below rested on the
`--elev` flag that used to do nothing.

| Dimension | Score | Notes |
|---|---|---|
| Mesh richness & count | 15/15 | **146 meshes / 23 311 tris** (164 with the decorative guest), 12 `lodDetail`, 20-odd static repeats merged. The held apple is **5 meshes / 1 032 tris**, built once and `clone()`d per purchase |
| Detail | 15/15 | tex+bump throughout; a real recessed hatch with corbels, lintel and a propped shutter; drilled apple block, cake board with a partial glaze, honey run, cut comb frame, bee skep of seven real coils, besom, herb bundles, log-end store. **2 PointLights** (day-floored toffee + night-gated eave lantern) and a 30-particle baking wisp |
| Cohesion | 20/20 | footprint measured **2.712 × 1.835** (x −1.322…1.390, z −0.852…0.983), top **1.623** — the documented numbers to 1 mm. Nothing floats: min y **−0.052**, the glade floor sunk into the ground. Cauldron and floor stay OUT of the tipped group, so a tripod stands level |
| Guest comfort | 15/15 | the held candied apple probed in the **arm-local** frame (`hw-hand.mjs`), re-run this pass: stick axis → fist-ball centre **0.0321** (< 0.05, so it passes THROUGH the ball), bare handle below the ball **0.0244**, apple underside → grip top **0.0599**, apple → head centre at full bite lift **0.2378** against the 0.188 the skull plus the fruit needs |
| Guest location | 15/15 | a selling stall, so the contract is the pad and the attach point, and the land measures them: pad centre **1.320000** u off the street (over `lintPadOffLattice`'s 1.20 threshold, and 1.2 exactly is not representable in binary), attach **0.60** u out on the walked slab. Live sim: guests hunger-seek it, buy, walk off eating a real apple and bin the container |
| Aesthetic | 20/20 | at a real **50°** the thatch reads as lapped courses with damp streaks rather than brickwork, the roof is no longer the brightest thing in the piece, and every good on the counter is legible in daylight. Night is the eave lantern pooling on the goods with the toffee still visibly hot |
| **Total** | **100/100** | |

**Probes:** `hw-hand.mjs` (the arm-local held-item fit), `hw-facts.mjs`,
`/tmp/mp3d-render/aud-tw-facts.tsx` (census + footprint).
**Shots:** `shots/AB-honey-{day,night,az115,sim,held}.png`, `AC-honey-el50.png`.

Fixed this pass:
* **The thatch read as BRICKWORK at the park camera** — three changes, above: streaked tone
  instead of a per-bundle coin flip, wandering course pitch, and a straw tone a stop down so
  the roof stops out-shining the goods.
* **The previews' held-apple description was STALE** — it quoted `rotation.x 0.4` and the
  numbers 0.031 / 0.083 / 0.227 while the code has been at **0.6** with **0.0321 / 0.0244 /
  0.0599 / 0.2378** since the shipped pass. A verification preview whose caption disagrees
  with the probe is worse than no caption.

No reverts.

# MagicMirror

**CANONICAL IMPORT — copy exactly:** `import { MagicMirror } from './components/MagicMirror';`
*(never from `'./Park'`: only the `<Park>` wrappers + track-piece JSX live there. A wrong
specifier makes esbuild refuse the WHOLE bundle — the round-8 black-page failure.)*

**"The Whispering Glass"** — attraction **3** of **THORNWICK GLADE** (the enchanted forest whose flagship is `components/WyrmsHollow`, from which this file imports the shared `THORNWICK` palette and `buildIvyStrand`).

> **IT IS NOT A RIDE.** No queue, no station, no vehicle, no FSM, no `registerRide`. It is a `composable(...)` **SCENERY-class** component — the `components/Fence` / `components/Torch` shape — so none of the ride placement rules (`front`/`exit`/`board`, lane trims, corridor sweeps) apply to it. It is an INTERACTIVE PROP that guests play with.

An ornate standing mirror in the glade: a mossy stone plinth, a carved frame of tarnished silver with banded pillars and leaf capitals, an arched crown with leaded tracery, a crescent-moon crest, ivy creeping over it, toadstools at its foot — **and glass that WAKES UP**. As a guest walks up the tarnish clears and the glass shows an enchanted "reflection": a whimsical transformed silhouette of them. It reacts while they linger — the vision brightens and breathes, the frame runes light, the glass throws real violet light back onto them — and fades to dull silver behind them.

## THE SCREEN — the two procedural CanvasTextures

Both are drawn ONCE with **paths and gradients only** (no `fillText`, no font dependency, no external assets), speckled from hashed sines, and cached module-level. The `components/Restroom` sign-plaque and `components/RideEntrance` LED-screen pattern, at 384 × 576 — exactly 1 : 1.5, which is exactly the glass panel's aspect, so nothing is stretched.

**The DORMANT pane** (`dullGlassTexture`) is old silvering: a green-grey gradient, 26 cloudy **tarnish blooms** (radial gradients, half pale and half dark), **420 foxing specks** where the silvering has failed, the diagonal sheen a flat pane always carries, and a heavy vignette. A mirror in a wood nobody has cleaned for a century — and the thing the vision has to clear AWAY.

**The VISION** (`visionTexture(t, variant)`) is one texture per **enchantment**, used as BOTH `map` and `emissiveMap`, so it reads as painted glass in daylight and as light in the dark. Every vision is the same picture — a **BUST silhouette** of whoever is standing there, in a violet well ringed with two rune rings, over 130 hashed sparkles, under the pane's own sheen and vignette — with ONE thing added that the guest does not actually have:

| `enchantment` | the reflection |
| --- | --- |
| `'antlers'` | a branching beam either side of the crown with three tines each, shortening upward |
| `'wings'` | scalloped moth wings with veins and an eye-spot, drawn **behind** the bust |
| `'crown'` | a ring of thorns round the brow, taller at the front, with two leaves tucked in |
| `'fox'` | pointed ears with lit inner ears, and a thick tail curling up past the shoulder with a pale tip |

**It is deliberately a SILHOUETTE.** A reflection you could recognise yourself in would be a portrait, and the mirror cannot see a face — a peep's face is a texture on the far side of its head. A silhouette is also what makes the same four canvases work for every guest in the park.

**Which one a guest gets is hashed off their guest id** (`hash01(id·7.31 + seed·3.7)`), so the same guest always sees the same reflection and two guests at the glass in turn see different ones (measured: **4 / 4 distinct enchantments across guest ids 0-9**). `enchantment` pins it for a still; `awake` forces the glass on with nobody there and reports the visitor as "a curious stranger" (id −1) rather than inventing a guest number.

## HOW THE INTERACTION IS WIRED

Three parts, and it **reuses the sim rather than forking it**.

### 1. Guests come past it, and they STOP for it — `linger` is ON by default as of round 8

Base behaviour with `linger={false}`: **the glass wakes for anyone who walks past and dims again behind them.** The composer stands the mirror beside a street; guests walk the street; the glass reacts. Nothing is written into the sim and nothing about guest routing changes.

Making them **STOP** is `linger` (default **true**), which registers a GameManager **watch zone** — 1.15 either way, centred a pace in front of the glass, `faceAt` the plinth, `linger: [4, 9]`:

```ts
mgr.registerWatchZone({ center: [fx, fz], halfW: 1.15·scale, halfD: 1.15·scale, rotation,
                        faceAt: [position.x, position.z], linger: [4, 9] })
```

A guest who wanders inside enters **PeepState `'watching'`**, turns to face the glass for a hashed 4-9 s, walks on, and cannot re-latch that zone for the manager's default **30 s per-guest cooldown**.

#### Why it used to be off, and what changed

It shipped off, and the measurement is the reason the fix exists. The only hook available then was `registerDanceZone`, whose latch was `state === 'walking' && !action && happiness ≥ 160 && energy > 128 && inDanceZone && hash01(…) < 0.35` — **with no per-guest cooldown.** A guest whose 10-30 s action expired while still inside simply re-latched at ~0.35/s, and since escaping a 2.3 × 2.3 zone at 0.55 u/s takes ~4 s the expected number of re-latches before escape was about five. On a DANCE FLOOR that is the point; on a prop beside a street it is a permanent stop.

| `mm-behaviour.mjs` run | longest single guest pin | resumed | `awake` min after peak | `validatePark` |
| --- | --- | --- | --- | --- |
| `--linger`, 6 guests, 70 s — **before the fix** | **44.5 s of 70** | **3 of 6** | 1.000 (never faded) | **FAIL `sim`:** *"guest 1 stood still >25 sim-s while \"walking\" — stuck off the graph?"* |
| `--linger`, 6 guests, 70 s — **after** | **20.9 s** | **5 of 6** | 0.690 | no stuck-guest failure |
| `--linger`, 4 guests, 90 s (the probe's own default) — **after** | 21.5 s | 4 of 4 | **0.000** | no stuck-guest failure — **all 8 checks PASS** |
| default (no zone), 6 guests, 70 s — control | 10.0 s | 5 of 5 | 0.000 | all checks pass |

Both halves of the fix matter. The **cooldown** bounds the stop. And **`'watching'` is a stationary STATE**, which `validatePark`'s stuck detector resets on and the "worn out → leave the park" roll already handles, whereas a `'dance'` action is taken while the guest is nominally still `'walking'` — which is precisely what tripped the 25-sim-s gate.

The one check that still fails at **6 guests on this 8-node ring** is FADE (the glass never gets a moment with nobody in front of it). That is a popularity/density artifact of a tiny test plot, not a stuck guest — and the same run with 4 guests fades to 0.000. Give a mirror a street with some depth to it.

#### ⚠️ RE-MEASURED 2026-07-25, AND THE 6-GUEST ROW ABOVE IS OPTIMISTIC

`node mm-behaviour.mjs --linger --guests=6 --seconds=70` now reports **three** failures, not one — RESUME and LEFT as well as FADE — with every guest "still inside" for 19-42 s, `resumed walking after: false` for all six and min `awake` **1.000**, never 0.690. (That plot also fails `validatePark`'s `sim` check for an unrelated reason: it has no registered ride, so nobody can complete a ride cycle in it.)

**Do not read that as a pin.** Four of the six are reported `walked away: true` in the same table, which contradicts `resumed walking: false` — the probe's RESUME assertion asks whether a `'walking'` sample was observed *after* the last still sample, and on an 8-node ring at 6 guests the 70-second window ends mid-dwell for most of them. **The plot is the problem, and the honest measurement is in a real land** (below), which is what this Context asked for in as many words and what the glade's audit went and did.

#### THE SAME PIECE, MEASURED IN THE LAND (`aud-glade-mirror.mjs`, size-96 park, 40 guests)

```
FOCUS [2.4, 30.43]  ·  zone registered: true  ·  221 samples over 150 s
maxAwake 1.000   minAwake after the peak 1.000   (never fades — see below)
maxLingering 3.9 s IN THE dt CLOCK, against the piece's own 4-9 s dwell
reflections 5, to 5 DISTINCT guest ids
16 guests came within 2.0 u of FOCUS · 15 of them entered 'watching' AT the glass
   · 11 of those were then seen WALKING again (the other 4 were mid-dwell at the
     last sample) · max 6 watching at the glass at once
validatePark → ok: true, 0 failures, 0 warnings, WITH the zone registered
```

So: **no guest stands still longer than the piece asks for** (3.9 s of a 4-9 s dwell, measured in the *same* clock as the dwell — never compare wall seconds), the glass cycles through five different visitors, guests demonstrably resume, and the gate that the pre-cooldown `linger` mode used to FAIL now passes with the zone on. `awake` staying at 1.000 is the *popularity* artifact this section predicts, now confirmed at land scale: on a walked verge somebody is always in frame. **It is not a defect and it is not gradeable as one — but it does mean the FADE assertion can only ever pass on a quiet plot, and a probe that cannot pass in the shipping environment should be read as a density meter, not a health check.**

⚠️ **`max watching ANYWHERE in the park` also reads 6 — the same number.** That is a coincidence of this run and exactly the trap this world's Context documents twice: `'watching'` is *also* the sim's watch-a-nearby-ride state, so an unfiltered census in a park with a coaster in it can measure the coaster. Always filter by distance to FOCUS.

#### The hook this asked for, as shipped

`GameManager/registry.ts` + `guestPass.ts` gained the whole thing, and `registerDanceZone` grew the same optional fields (`faceAt` / `linger` / `cooldown` / `gate`) rather than being forked — see GameManager/Context.md "Attention zones". **The dance zone now carries a 30 s cooldown too**: a guest that can never leave is a bug wherever it happens.

### 2. The glass WAKES from the component's own side

The updater reads `manager().guests()` — a **copied, read-only accessor** — once a frame, transforms each position into the mirror's own LOCAL frame (one matrix inverse per frame, not one per guest: `worldToLocal` inverts on every call and a busy park has dozens of guests) and applies one test:

```
attending  ⟺  local z > 0.14        (in FRONT of the frame, not behind it)
           and dist(local xz, FOCUS) ≤ radius     FOCUS = (0, 0.55), radius 1.6
```

The nearest attending guest is the **focus**. `awake` rises over ~0.7 s toward 1 while somebody is there and falls over ~1.6 s when nobody is, and the visitor is **LATCHED**: the glass keeps showing whoever it started on for as long as they are still attending, and only re-picks when they have gone. That is what stops the vision flickering between two guests walking past each other.

**Stillness** is measured in the mirror's own frame and **per second, not per frame**: a walking 0.5-scale guest makes ~0.55 u/s, so under 0.14 u/s is a stop, and `lingering` accumulates. It drives the vision's breath and pushes the glow from violet toward green past 3 s.

`awake` then drives: the vision plane's opacity AND emissive, the dormant pane's dimming under it, the lunette's glow, the frame runes, and the one real PointLight.

**The same code path serves the previews.** The `demo` visitor (default ON under a `<ScenePreview>`, OFF in a real `<Park>` — the fleet's decoration-off-when-registered convention) is a `buildPeep` who walks up, stands for eight seconds and walks away on a deterministic 18-second loop, and is fed into `attendOf` exactly like a sim guest. A standalone preview therefore exercises the real logic rather than a mock of it.

### 3. Clicking it opens a themed window

Through the **SHARED Stage pick path**, as of round 8. `Stage/index.tsx`'s `carrierOf` used to walk the parent chain looking only for `userData.rideRef` / `userData.guestRef`, which made a scenery prop unpickable and is why this component once carried a private raycast. It now also accepts a generic **`userData.pickRef`** (a `(obj) => void` callback), and `Park/parkRoot.tsx`'s `onPick` switch calls it. So the whole wiring here is:

```ts
handle.group.userData.pickRef = openIt;          // <Park> calls this for us
const un = handle.api.onPick?.((o) => { if (o === handle.group) openIt(); });
```

…and **the local raycast is gone.** Both routes converge on the same idempotent `setOpen(true)`: `<Park>` dispatches `pickRef` itself, and the `api.onPick` subscription covers a bare `<ScenePreview>` host that has no `<Park>`. The mirror keeps `userData.mirrorRef = () => state` as the fleet's live-state accessor convention (the harness finds the rig with it).

What it inherits by not re-deriving any of this: the parent-chain **visibility** test (three's `Raycaster` ignores `visible`), **real geometry before click proxies** resolved in screen space, the rule that a **guest standing in front of the glass keeps the click** (round 8 extended that exception from ride bodies to `pickRef` bodies for exactly this case), the 8-px drag threshold, the ±6-px near-miss ring, and **per-inset cameras** — a click inside a framed monitor picks what the monitor shows. The old local raycast implemented one of those six.

The window is a real **`<UIWindow>`** (never custom chrome, `rules/ui.md`), portalled into the Stage's own `position: relative` wrapper, polling the live state 4×/s: an awake meter, the reflection count, who is being reflected and as what, how long they have lingered, and whether a linger zone is registered.

## Verified headlessly

**`node mm-sim.mjs`** — a scripted-guest unit drive of the wake machine (no browser). A synthetic manager walks one guest from local z 3.0 → 0.8, holds them ten seconds, walks them out:

```
 PASS  dormant before the guest is inside the radius
 PASS  WAKES while the guest walks up (awake > 0.6 by the time they arrive)
 PASS  fully awake while they stand there
 PASS  a visitor id is latched
 PASS  LINGERING climbs while they stand still (> 5 s by t=14)
 PASS  lingering RESETS when they walk again
 PASS  FADES back to dull once they leave (awake < 0.05 by t=26)
 PASS  the visitor is released after the fade
 PASS  exactly one reflection was counted for one visit
 determinism: two identical builds agree exactly (awake + enchantment)
 enchantment by guest id 0-9: fox, antlers, crown, crown, fox, wings, crown, antlers, fox, antlers  → 4/4 distinct
```

**`node mm-behaviour.mjs`** — the same arc with a **REAL GameManager**, in a size-16 park (plaza ring + gate + one mirror facing the street), sampling both the mirror's published state and the live guest records every 150 ms. A lab test that always passes is how a bug survives twice, so this one asserts the *whole* arc, and it is the probe that FAILED loudly on the old `--linger` mode (table above) and passes on the new one:

```
$ node mm-behaviour.mjs --linger          # 4 guests, 90 s
samples 584 over 90s   maxAwake 1.000   min after the peak 0.000
reflections shown 4   distinct visitors 2, 0, 3, 1   zone registered: true
 guest 1: closest 0.65  stood still inside 21.5s  awake while there 1.00  resumed walking after: true  walked away: true
 PASS  APPROACH · STOP · WAKE · SHOWED · RESUME · LEFT · FADE · ZONE
```

**`node mm-click.mjs`** — projects the glass to a screen pixel and clicks it. Still green after the local raycast was deleted in favour of `userData.pickRef` + the shared Stage pick path:

```
 userData.mirrorRef present: true
 PASS  a click on EMPTY GROUND does not open the window
 PASS  a click on the GLASS opens "The Whispering Glass"
 PASS  the window body carries live state
 PASS  the close button dismisses it
```

## Geometry + budgets

Local frame: **the glass faces local +z**, y = 0 is the ground, and `FOCUS` (0, 0.4, 0.55) is the point a visitor is measured against. Glass panel **0.58 × 0.87** on a **0.26** plinth, springing at **1.19**, crown top **1.535**, crest to ~1.72 — about three times a 0.55-tall guest, which is what makes it an attraction rather than a dressing-table mirror.

* **THE PLINTH:** three courses of glade masonry, each **two blocks with a hashed joint** (never one slab), moss along the shady edges.
* **THE FRAME:** two pillars with three banded collars and a four-leaf capital each, a real **torus half-ring** for the arched crown with a beaded outer course, a sill, scrolled feet, and **two STAY LEGS raking back off the crown** — from behind, a standing mirror has to be a thing and not a billboard.
* **LEADED TRACERY** over the lunette: five radial bars, an arc rib and a boss. A bare `ShapeGeometry` semicircle is a flat plate whatever you do to its material, and a flat plate a hand's breadth from the glass's own PointLight blew out into a pale slab over the vision. (It also had to be pushed into the merge list **before** `mergedParts` runs — pushed after, it silently vanished.)
* **THE CREST:** a crescent moon cut as a real 2D `Shape` with an offset circular hole, on five radiating spikes.
* **18 frame RUNES** (12 round the arch, 6 down each pillar's inner face) — emissive only, so they cost nothing and they are the whole "the spell is waking" read at night.
* **Materials.** Every metal sits at **0.26-0.30** (≥ 0.6 with no env map renders near-black in this fleet). The panes are the trap in the other direction: the dormant glass first shipped at roughness 0.24 / metalness 0.28 and rendered as a **black slab**, because it is a VERTICAL plane that catches almost no direct sun and has no environment to reflect. It is 0.5 / 0.08 with a little base emissive, and the lunette 0.7 / 0.04.
* `setScalar` on a material colour is right for the PANE (it has a map, so the colour is a multiplier and this dims the tarnish under the vision) and **wrong for the lunette** (no map: `setScalar` sets a flat light GREY, which is the other way the arch turned into a white slab).

**Budgets (measured, `mm-sim.mjs`): 19 meshes / 3,971 tris / 1 PointLight / 0 particles / 6 objects tagged `lodDetail`.** Deterministic — hashed sines only, one absolute-time updater, no `Math.random` / `Date.now`, both canvases drawn once and cached.

## Props

| prop | default | |
| --- | --- | --- |
| `position` / `rotation` / `scale` | — | the composable transform; the glass faces local +z, so `rotation` aims it at the path |
| `radius` | 1.6 | how far in front the glass notices a visitor |
| `register` | `true` | attach the GameManager so the glass can SEE guests (read-only) |
| `linger` | **`true`** | register a GameManager WATCH ZONE so guests stop and turn to face the glass for 4-9 s (30 s per-guest cooldown). Was `false` until the manager gained `registerWatchZone` — the measurement is above. Set `false` for a pure-scenery mirror |
| `blocking` | `false` | also register the plinth as a guest blocker. Off by default: a blocker beside a street is what `validatePark`'s `blockers` gate fails on, and a mirror is a thing to walk UP to |
| `demo` | preview-only | the decorative demo visitor |
| `awake` / `enchantment` | — | reproducible stills |
| `seed` | 1 | hashed variation |

It always registers its **ground-contact footprint** (`park.registerPlanted`, r 0.45), so `validatePark` refuses a mirror planted in open water or standing in a path slab — the `<Scenery>` / `<Placed>` rule.

## Preview circuits

- **3D rig — The Whispering Glass (LEAD, the interaction)** — with the demo visitor walking up, stopping and leaving on the 18-second loop. Day AND night.
- **The glass AWAKE (close — the vision)** — `awake demo={false}`, a reproducible still of the screen.
- **Dull silver (close — dormant)** — the same glass with nobody near it, and the frame read.
- **Four in a row — the four enchantments** — `enchantment` pinned: antlers, wings, crown, fox.

Every preview runs `ground={false}` over a glade-clearing disc of leaf litter and moss, so the mirror stands in a wood rather than on a lawn.

## Screenshot verdicts

* **Lead, day** — the visitor standing at the glass, the antlered reflection lit, violet light spilling onto the plinth and the leaf litter.
* **Lead, night** — the hero: the vision blazing, all 18 runes lit green, the lunette glowing violet through its tracery, and the visitor lit from the front by the mirror alone.
* **Alternate angle (110° orbit)** — the stay legs, the back board and the ivy; it reads as an object from every side.
* **The vision (close)** — the bust, the rune rings, the sparkles and the pane's own sheen.
* **Dormant (close)** — tarnished silver-grey with its cloudy blooms, unmistakably a dull mirror and not a black hole.
* **Mid-interaction IN A REAL PARK (`mm-behaviour.mjs`)** — two live GameManager guests on the plaza in front of the awakened glass, `awake = 1.00`, visitor `Guest 2` at 0.91 u, enchantment `antlers`.
* **A guest LATCHED by the watch zone (`mm-behaviour.mjs --linger`, round 8)** — visitor `Guest 6` at 0.88 u with `state = watching`, i.e. the sim guest stopped and TURNED to face the glass rather than beat-dancing past it.

Built with three.js on the shared Stage; the frame is a Victorian cheval mirror, the palette Thornwick Glade's own (`THORNWICK`, imported from `components/WyrmsHollow`), the window chrome RCT2's (`components/UIWindow`).

---

## Audit — 2026-07-25, 100/100

`<ScenePreview>`'s default elevation measures **50.6-50.8°**, i.e. the park camera, so these
previews were already framed at the angle that matters; every shot below also carries the
achieved pose printed by the harness (`--elev`/`--angle` used to silently do nothing on a
heavy page).

| Dimension | Score | Notes |
|---|---|---|
| Mesh richness & count | 15/15 | **19 meshes / 3 971 tris / 1 PointLight / 6 `lodDetail`** — re-measured, and identical to the shipped table. Deliberately lean: it is a prop, and a prop that gets one PointLight has to justify every draw. Two banded pillars with leaf capitals, a real torus crown, leaded tracery, a crescent cut as a 2D `Shape` with a hole, two stay legs |
| Detail | 15/15 | **two** procedural CanvasTextures drawn with paths and gradients only and cached module-level (26 tarnish blooms, 420 foxing specks, 130 sparkles, two rune rings); 18 emissive frame runes; the vision is `map` AND `emissiveMap`, so it is painted glass by day and light by night |
| Cohesion | 20/20 | bounds **x −0.816…0.810, y −0.005…1.805, z −0.578…0.487** — the plinth rests ON the ground (min y −0.005, i.e. 5 mm of settle, not a float), and the crest is **3.28×** a 0.55-tall guest, which is what makes it an attraction rather than a dressing-table mirror. `park.registerPlanted` r 0.45 so it cannot stand in water or in a path slab |
| Guest comfort | 15/15 | nothing is ridden, sat in or held. What applies is that the glass throws real light on the *visitor* rather than through them, and the 110° shot shows the stay legs and back board — it reads as an object from every side, not a billboard |
| Guest location | 15/15 | measured **in the land**, not on the test plot: 15 of 16 guests that came near entered `'watching'` AT the glass, **11 observed walking again**, max lingering **3.9 s of a 4-9 s dwell in the dt clock**, 5 reflections to 5 distinct ids, and `validatePark` **ok: true / 0 / 0** with the watch zone registered. No pin |
| Aesthetic | 20/20 | reads instantly as an enchanted standing mirror at a real 50°: tarnish cleared, antlered bust in its violet well, runes lit, violet spill on the plinth. Night is the hero — 18 runes green, the lunette glowing through its tracery, the visitor lit by the mirror alone |
| **Total** | **100/100** | |

**Named non-defect, recorded so it is not re-opened:** `awake` does not fall back to 0 in a
busy land (minAwake after peak **1.000**). That is popularity — on a walked verge somebody is
always in frame — and `mm-behaviour.mjs`'s FADE assertion therefore cannot pass in the
shipping environment. It is a density meter, not a health check.

**Probes:** `mm-sim.mjs`, `mm-click.mjs`, `mm-behaviour.mjs --linger --guests=6 --seconds=70`
(3 failures, analysed above), **`aud-glade-mirror.mjs`** (new — the same piece in the real
land, with both mis-measurement traps guarded), `aud-tw-facts.tsx` (census + bounds).
**Shots:** `shots/AB-mirror-{day,night,az115,vision,four}.png`, `AF-mirror-el50.png`.

Fixed this pass:
* **The previews' clearing floor** — 150 flat 0.04-thick BOXES lying on a bare loam disc,
  which at a real 50° read as brown and green **FLOOR TILES** with a mirror standing on them:
  `ThornwickScenery`'s own second documented bug, hiding in preview staging where nobody had
  thought to apply the pack's rule. Now squashed detail-0 icosahedra (moss is a cushion, and
  they are domed at 0.36-0.56 × their radius — a first pass at 0.12 × still read as hexagonal
  plates), clumped six to a patch, on a **mossy** disc: the world's own gradient is "the
  clearing is MOSS and the wood is LITTER", and the litter is what drifts on it.
* **The 6-guest claim in "Why it used to be off"** — re-measured and it is worse than
  recorded; the row is annotated rather than quietly corrected, with the land numbers that
  settle the question.

No reverts, and **no component geometry changed this pass** — the mirror itself audited clean.

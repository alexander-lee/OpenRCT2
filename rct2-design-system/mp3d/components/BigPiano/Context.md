# BigPiano

**CANONICAL IMPORT — copy exactly:** `import { BigPiano } from './components/BigPiano';`
*(never from `'./Park'`: only the `<Park>` wrappers + track-piece JSX live there. A wrong
specifier makes esbuild refuse the WHOLE bundle — the round-8 black-page failure.)*

**"The Big Piano"** — attraction **3** of the **PULSE DISTRICT** (the disco quarter whose centrepiece is `components/DanceFloor`, whose spinner is `components/Discotron` and whose coaster is `components/Bassline`). An oversized **walk-on keyboard** laid into the promenade: guests step across the keys and every key their ground position crosses **depresses, lights up and sounds a note** — a felt hammer swings back into the strings, the note lamp for that pitch class fires, the strings shimmer and the house lights re-tint to the note. There is no audio in this system, so the "note" is entirely a visual event.

> **IT IS NOT A RIDE.** No queue, no station, no hut, no vehicle, no FSM, no `registerRide`. It is a `composable(...)` **SCENERY-class** component — the `components/MagicMirror` / `components/Fence` shape — so none of the ride placement rules (`front`/`exit`/`board`, lane trims, corridor sweeps) apply to it. It is an INTERACTIVE prop that guests play with.

## THE KEYS RESPOND TO REAL GUESTS — per-key hit detection

The whole point is that a key goes down under a **specific guest's foot**. The updater reads `manager().guests()` (a copied, read-only accessor) once a frame and resolves the key under each of them:

```
ONE matrix inverse per FRAME          inv = group.matrixWorld.invert()
per guest:  lp = worldPos · inv       (one Vector3 transform)
            z outside [−0.67, +0.71] or |x| > halfW+0.05  →  no key
            z ≤ HINGE_Z + BLACK_LEN   →  blackAt[⌊(x+halfW)/0.02⌋]     (one array read)
            otherwise                →  ⌊(x + halfW) / WHITE_PITCH⌋    (one division)
```

**Per-frame cost: 1 matrix inverse + 1 transform and O(1) index arithmetic per visible guest + one 25-entry key pass** (press envelope, hinge rotation, hammer angle, colour) + 12 note lamps. There is **no per-key loop per guest** and **no `worldToLocal` per guest** — that helper inverts the matrix on *every* call and a busy park has dozens of guests. `blackAt` is a 250-entry `Int16Array` lattice at 0.02 u built from the same list the sharp meshes are built from, so the lookup and the geometry cannot drift apart.

Nothing is ever written back into the sim.

**The press envelope:** attack `1/0.09 s` (a step reads on the frame it lands), release `1/0.3 s` (a key falling back behind a walker still reads as a key). A key crossing `press > 0.5` upward is a **strike**: `notesPlayed++`, `lastNote`/`lastKey`/`lastPlayer` latch, the pitch-class lamp fires, a note bloom is assigned. While a key is HELD it re-trills on the beat instead of sitting flat.

**A pressed key ROTATES about its back edge** — a pure vertical translation of the same distance did not read at park zoom; a hinge rotation does, because the key tilts relative to its neighbours.

**THE STROKE RUNS UP → LEVEL, NOT LEVEL → DOWN.** A key at REST is tilted **tip-up** by `REST_TILT`, and a fully pressed key is **level and flat**, settling the last 2 mm onto its balance rail (`KEY_TRAVEL` 0.042 at a natural's tip, `BLACK_LEN·REST_TILT + settle` ≈ 0.027 at a sharp's — a shorter lever travels less, like the real thing).

This is not a stylistic choice, it is the fix for *"when a guest steps on a key it clips with the ground"*, and it is forced by arithmetic. The rig is FLUSH-MOUNTED: a guest's feet stay on the path/plaza surface, so **the key under them has to end its stroke at that surface**. A key that is level at rest and rotates DOWN spends its whole stroke *below* the paving — measured in a live park, the old `PRESS_TILT` 0.055 put the top face of a fully pressed natural **51.7 mm UNDER the plaza slab** (a sharp 22.1 mm): the key vanished into the pavement and only its note bloom marked the spot. And of its nominal 71.5 mm of travel only the first 14 mm was ever above ground — **80 % of the press was invisible.**

For any flush-mounted key the geometry is a hard identity:

```
resting tip height above the floor  =  visible travel  +  clearance
```

so the only way to buy visible travel is to let the tip REST proud and come down to meet the paving. 42 mm entirely in the open air beats 71.5 mm of which 57 mm was underground, and a pressed key ends **dead level with the ground the guest is standing on**, which is what "the key stops at the floor" looks like. `KEY_TRAVEL` is held at 42 mm rather than pushed higher because the resting tip lip must stay under `WHITE_H` (0.055) or an un-pressed key's front lifts clear off the ground and shows daylight underneath.

## USE `registerWatchZone`, NOT `registerDanceZone`

`linger` (default **true**) registers a GameManager **watch zone** over the keybed:

```ts
mgr.registerWatchZone({ center: [x, z], halfW: 2.48·scale, halfD: 0.72·scale, rotation,
                        faceAt: [caseX, caseZ], linger: [5, 11] })
```

A guest who steps onto the keys enters **PeepState `'watching'`**, turns to face the case (and the marquee) for a hashed 5-11 sim-s with their weight on a key, then walks on, and cannot re-latch for the manager's **30 s per-guest cooldown**.

**This is not a style preference.** A dance dwell is a hashed **10-30 s** and `'dance'` is an *action* taken while the state is still `'walking'`, so a long dance accumulates against `validatePark`'s **"stood still > 25 sim-s while walking"** stuck-guest gate on its own — reproduced identically at `cooldown = 0` and `cooldown = 30`, i.e. **not fixable with the cooldown**. `'watching'` is a stationary STATE, and the validator's stuck detector *resets* its anchor on any non-`walking` state (`ParkBuilder/validate.ts:1175`), which is exactly why the watch zone is safe over a street. See GameManager/Context.md → "Attention zones".

## FLUSH-MOUNTING — the fix that made it a floor piano

`useComposable` settles every composable onto `park.floorAt(x, z)`, i.e. **the terrain**. But `<Paths>` renders a **0.09 u slab** on top of that terrain and guests walk on the slab, so a piano settled on the terrain has its 0.083 u of key **buried**: the first real-park render showed bare grey paving where the keyboard should have been, with only the case and the hammers standing above the kerb.

`flush` (default **true**) therefore lifts the rig in the compose hook:

```ts
lift = walkYAt(x, z) + PRESS_CLEAR·scale − KEY_SURFACE_Y·scale − settledY   // PRESS_CLEAR = 0.020
```

which lands a **fully PRESSED natural 20 mm proud of the paving** and a pressed sharp 40 mm proud (steppable, not a trip hazard), and puts a real guest's feet ON the key they are standing on instead of ankle-deep in it. A pressed key is the only pose their key is ever in, which is why the mount is referenced to it. Some clearance matters at all because at *exactly* level the naturals are coplanar with the path slab and the paving simply won — the second render showed sharps standing on bare stone with no white keys at all.

**`PRESS_CLEAR` is 20 mm and not 14 for a measured reason:** `walkYAt` returns `pathY + 0.09`, but `<PathNetwork>` draws a **plaza** top at `pathY + 0.096`. On a plaza the mount therefore lands 6 mm lower than it thinks it does, and 14 mm of nominal clearance was really 8. 20 mm keeps a pressed key **+12 mm over a plaza slab** and +18 mm over plain paving.

A key at REST sits higher still — its tip is up by `KEY_TRAVEL` and comes DOWN to the paving as it is pressed (see above). That is the whole mechanism, not a mounting error.

`KEY_SURFACE_Y` (0.083, unchanged) is **exported** for the set-piece author who would rather raise the two `<Paths>` nodes at the keybed ends instead (`[x, z, elevation]` triples). It now means *the top of a key when that key is fully pressed* — the level pose.

**`flush={false}`** stands the piano on open ground on its own plinth; nothing clips there either (naturals keep **+78.9 mm** at full press, sharps +98.8 mm, and the key body no longer digs into the turf: worst vertex **+23.9 mm**, was −48.8 mm).

## Geometry + budgets

Local frame: **x is the KEY RUN**, the case is at **−z**, the player's side is **+z**, y = 0 is the ground.

| | |
| --- | --- |
| naturals | 15 (`count`, 7…15) × `WHITE_PITCH` 0.32, body 0.29 × 0.055 × 1.30, hinged at their back edge |
| sharps | 10, 0.185 × 0.80, a raised **panel** on the back half of the naturals standing only `BLACK_RISE` 0.02 proud — this is a floor a guest walks over, so a real keyboard's tall sharps are deliberately flattened |
| notes | C3 → C5 (`count` 15). `keyInfo()` names every key; the note colour is `paletteAt(pitchClass)` |
| built footprint | **x ±2.52, y 0…1.94, z −1.88…+0.75** (measured) — 5.04 × 2.63 |
| walk-on surface | `built.half` = **[2.48, 0.72]**, i.e. 4.96 × 1.44 |
| `count` 7 | 12 keys, x ±1.24, height 1.72 (the marquee scales with it) |

* **THE KEYBED** — a `DECK`-grey base plate the keys hinge to (the gaps read as grout), a concrete pad tucked under it so a dark keybed never reads as a hole on grass, the key-slip **felt** strip along the back, and a chrome **KEYSLIP** on the three OPEN sides only (the −z side is the case). The keyslip rises from the base plate to `SLIP_TOP` / `SLIP_END_TOP` rather than sitting 22 mm proud of a plate that is itself buried: under a flush mount the plate, the pad and the old bead were *all* under the paving, so the keybed had no visible frame at all and the keys read as loose slabs dropped on the pavement. At these heights it stands **≈33 mm (front) / 25 mm (±x ends)** above the walked surface — a real piano's keyslip, and the thing that occludes the bottom of the key stroke and the few mm of air under a resting key's raised tip. The ends stay the LOWER of the two because those are the walk-on edges.
* **THE CASE** (all of it at −z, off the walked surface) — base rail, two gloss **cheek blocks**, a deliberately LOW fallboard so the action stays visible, and a chrome nameboard cap carrying **12 chromatic note lamps** (one per pitch class, so a sounded note still reads when the key that sounded it is under somebody's foot).
* **THE EXPOSED ACTION** — a chrome hammer rail on two standards with **one felt hammer per key**: `0.30 − press·0.85` rad, so it swings off its rest back into the strings. One mesh each, two cached geometries, `lodDetail`-tagged.
* **THE HARP** — a `0.34` rad leaning soundboard strung with **29 chrome wires** (one merged mesh, one material — they shimmer together on a strike), a tuning-pin bar, a hitch bar, and an **LED chord bar** along the top on the beat.
* **THE BACK POSTS** — five posts and two cross rails in the lighter `STEEL` tone. The alternate-angle render is why they exist: from behind, the harp plate and the marquee backboard were two flat black rectangles. A real upright piano's back *is* a frame of heavy posts (the same call MagicMirror's stay legs make).
* **THE MARQUEE** — a real `buildNeonSign({ text: 'BIG PIANO', color: MAGENTA, secondary: CYAN, scale: 0.3 })` on two chrome posts with concrete footings, behind the harp (a post inside the 4.84 u harp width would spear it). The built group is **rescaled to fit** `field − 0.5`: `buildNeonSign` auto-caps its own width at 2.5 u, which is right for 15 keys and far too wide for 7 — at `count` 7 the piano wore a marquee wider than itself.
* **Materials.** Keys are matte-ish acrylic (roughness 0.5) and every metal sits at **0.22-0.32** — ≥ 0.6 renders near-black with no env map on this Stage.

**Budgets (measured, `bp-facts.mjs`): 120 meshes / 12,522 tris / 3 PointLights / 0 particles / 38 objects tagged `lodDetail`.** Two house lights are the piano's own (over the keybed, re-tinted to the note that just sounded and hot on a strike); the third is inside `buildNeonSign`. Everything else — key emissive, the 12 note lamps, the chord bar, the string shimmer, the two note blooms and the keybed bloom plate — is emissive material or additive mesh.

## The light show

`BEAT_HZ = 2.2` — the **same** clock `<DanceFloor>` flashes its tiles to, `<Discotron>`'s ball scintillates on and the Guest pose layer's `dance` state uses; `beatStep` / `beatPulse` / `beatKick` are re-declared here exactly as `<Bassline>` and `<PulseScenery>` do (they are module-private in Discotron). **`PULSE_PALETTE` is imported from `components/Discotron`** and never re-derived — the cool subset (magenta / cyan / violet / blue); DanceFloor's amber and lime read as a fairground rather than a nightclub.

**ONE CLOCK, ABSOLUTE.** The light show runs on the raw Stage clock, exactly as Discotron's does — a club never stops. The piano has **no motor and no ride FSM**, so nothing here sits behind a `createMotionGate` at all; the only non-lighting motion is the keys and the hammers, and those are driven by real guest positions.

**The idle attract pattern** (so a still frame is never a dead grey slab): a **glissando wave** walks the run at 2.2 keys/s, the whole board breathes on `beatPulse`, and every fourth bar a **hashed triad** flashes. `gain = 0.4 + 1.1·nightK` — DanceFloor's own day/night ramp.

**Two colour lessons, both from renders:**

1. The board shares **ONE dominant palette colour per beat** and only a PRESSED key blends to its own note colour. The first cut gave every key its own independently stepping hue and the keyboard rendered as a **pastel rainbow floor** in which you could not tell a sharp from a natural, let alone which key somebody was standing on.
2. Naturals pull their emissive **halfway to white** (Discotron's mirror-ball trick): an ivory key lit by a magenta club is ivory *catching* magenta, not a magenta key. The pressed key drops that pull, so the note colour lands full strength on exactly one key. Sharps take **less** attract than naturals (0.45 vs 0.42 of a bigger base), because at 0.8 the near-black gloss washed violet in daylight and the keyboard lost its black-and-white read.

The pressed term tops out near 2.0 with the strike spike — it peaked at 4.2 in the first night render and the key under the guest **clipped to pure white**, losing the note colour that is the whole point.

**Note blooms:** two additive patches, moved to the key that just sounded and faded out (two draw calls instead of one per key). They lie **FLAT on the key**, sized to it (a sharp is 0.185 × 0.8, a natural 0.29 × 1.3). A vertical additive quad read as a violet paper CARD beside the guest for three consecutive render rounds; flat on the key its edges fall on the lit key itself, which is how `<LightTiles>`' bloom plate reads correctly too. Its falloff texture is drawn in **opaque greyscale** — three's `alphaMap` samples the GREEN channel, and a canvas gradient that fades only its ALPHA leaves green at 255 everywhere.

## Verified headlessly

**`node bp-facts.mjs`** — a scripted-guest unit drive of the key machine plus the budget census (no browser). A synthetic manager walks one guest across the keyboard through the REAL updater:

```
count=15  keys 25  meshes 120  tris 12522  PointLights 3  Points(particles) 0  lodDetail 38
          bbox x -2.52…2.52  y 0.00…1.94  z -1.88…0.75   walk half [2.48, 0.72]
count=7   keys 12  meshes  94  tris 11798  PointLights 3  Points(particles) 0  lodDetail 25
determinism: two identical builds agree exactly: true
 PASS  no key is down with nobody on the keyboard          PASS  and no note has sounded
 PASS  the key under the guest is DOWN (key 7 = C4)        PASS  and its NEIGHBOURS are not
 PASS  exactly ONE note sounded for one key                PASS  the note is named for that key
 PASS  the sounding guest is credited                      PASS  one player is on the keys
 PASS  HELD climbs while they stand on it (2.47 s)         PASS  and it did not re-sound while held
 PASS  a SHARP resolves on the back half (key 20 = C♯4)
 PASS  the same x on the FRONT half is a NATURAL, not the sharp
 PASS  every key RELEASES once they walk off
 PASS  a walk across the run sounded a note per key (15 notes over 15 white keys)
 PASS  and they sounded in ASCENDING order — C3 D3 E3 F3 G3 A3 B3 C4 D4 E4 F4 G4 A4 B4 C5
 PASS  the IDLE board is lit (51 materials over 0.02 emissive with nobody on it)
 PASS  and it MOVES half a beat later (27 materials changed)
 PASS  `chord` presses keys with no guests and no manager
all 20 unit checks pass
```

**`node bp-behaviour.mjs [--seconds=100] [--guests=4] [--nolinger]`** — the same arc with a **REAL GameManager** in a size-16 park (a 7.2 × 4.8 plaza ring whose long sides run along world x, a gate spur, and ONE `<BigPiano>` on the bottom side with `rotation={0}`), sampling the piano's per-key state and the live guest records every 150 ms. **A lab test that always passes is how a bug survives twice**, so this one pairs each pressed key against the guest's OWN local x — a piano that lit a random key fails it — and it failed loudly four separate times during this build (see "What the probe caught"). Give it **≥ 90 s**: at 45 s the guests have not reached the piano yet.

```
$ node bp-behaviour.mjs --seconds=100 --guests=4
samples 645 over 100s   notes played 51   zone registered: true
render 11.3 fps → sim/wall clock factor 0.75 (manager dt clamp 1/15)
paired key-under-guest samples 665   mismatched 0   deepest paired press 1.00
 guest 0: longest single stop 18.4s  key-under samples 230  maxPress 1.00  notes [C5 B4 A♯4 … A3]  resumed true
 guest 2: longest single stop 16.3s  key-under samples 193  maxPress 1.00  notes [C3 C♯3 … A♯3]   resumed true
 guest 3: longest single stop 12.0s  key-under samples 242  maxPress 1.00  notes [25 distinct]     resumed true  left true
LONGEST SINGLE GUEST STOP: 18.4s wall ≈ 13.9s sim (of 100s)    resumed: 3/3
LONGEST STILL-WHILE-'walking' (the validator's 25 s gate): 2.9s wall ≈ 2.2s sim
validatePark: ok=false   failures 1   warnings 0   stuck-guest failures 0
   FAILURE  no guest completed a ride cycle in 60 sim-s      ← the plot has NO RIDE on purpose
 PASS  WALK ON · KEY DOWN · NOT A RANDOM KEY · SOUNDED · SEVERAL KEYS · LINGER · RESUME
 PASS  NO PIN · TRAFFIC (empty 27 % of samples) · RELEASE · ATTRACT · ZONE · STUCK GATE · VALIDATE · LINTS
```

**The control, `--nolinger`** (no zone registered) asserts the OPPOSITE of the LINGER check, and the contrast is what proves the zone does the work:

```
notes played 25   zone registered: false   longest single stop 2.5s   keybed empty 58 % of samples
 guest 3: 24 distinct notes in one crossing — C5 B4 A♯4 G♯4 … D♯3 D3 C♯3 C3   (a full glissando, walked)
 PASS  NO LINGER (control) — without the zone nobody stands on the keys > 4 s
```

**WALL vs SIM seconds.** The manager clamps its own dt at **1/15 s** (`GameManager/index.tsx:154`), so on a headless SwiftShader page (~11 fps) every guest timer runs at ~0.75× the wall clock this probe samples on — a 5-11 sim-s dwell takes 7-24 s of wall time. `validatePark`'s smoke run steps a fixed 1/30, i.e. factor 1, so **sim** seconds are the number to compare against its 25 s gate.

### What the probe caught (all four were probe or plot bugs, and each one first looked like a deadlock)

| symptom | cause |
| --- | --- |
| "longest stop 51.9 s, 1 of 5 resumed" | the probe SUMMED every short stop instead of measuring the longest CONTIGUOUS one, and tested RESUME only while the guest was off the keybed — but the keybed IS 4.96 u of the street, so a guest walking on it never entered that branch |
| "still-while-walking 62 s" | `<Paths>` REFUSED the ring's east span (it crossed water), so the ring became two dead ends and a guest was pinned at one. `keepDry` now samples every edge's whole polyline, not just its midpoint |
| "still-while-walking 43 s on EVERY guest" | the probe compared CONSECUTIVE samples, which calls a 0.3 u/s walk "still" at 150 ms sampling. The validator's test is an **anchor** test (reset when the guest is 0.06 u from where the anchor was set, and on any non-`walking` state) — ported line for line, the real figure is **2.9 s** |
| "RELEASE / ATTRACT fail" | plot density: on the first 4.8 × 2.4 ring the keybed was a fifth of the whole network and two guests kept it permanently occupied — the same artifact MagicMirror's probe hit at 6 guests on an 8-node ring |

## Props

| prop | default | |
| --- | --- | --- |
| `position` / `rotation` / `scale` | — | the composable transform. **Lay the KEY RUN (local x) along the street** |
| `count` | 15 | naturals in the run (7…15; 7 = one octave). Footprint, strings, hammer rail and marquee all scale with it |
| `register` | `true` | attach the GameManager so the keys can SEE the guests walking over them (read-only) |
| `linger` | **`true`** | register the WATCH ZONE so guests stop and play. `false` = pure scenery: the keys still light for anyone who walks across |
| `lingerFor` | `[5, 11]` | the hashed dwell, seconds |
| `flush` | **`true`** | flush-mount the keybed into the walked surface, so a fully PRESSED key lands `PRESS_CLEAR` (20 mm) proud of it (see above). `false` stands the piano on open ground on its own plinth |
| `blocking` | `false` | also register the CASE as a guest blocker. **The keybed is never blocked** — it is the walking surface |
| `chord` | — | force keys down for a reproducible still: an index list, or `true` for a hashed triad |
| `demo` | preview-only | the decorative demo player |
| `seed` | 1 | hashed variation |

It always registers its ground-contact footprint — **the CASE, not the keybed** (`park.registerPlanted`, r 0.42 at local z −1.08). The keys are meant to be laid across a walked surface and `validatePark`'s planted-scenery gate fails a footprint that intrudes into a path slab, so what is registered is the solid body behind them, which is the piano's real ground contact anyway. That footprint needs **≥ 0.97 u** from a street centreline (`pathWidth/2 + min(r, 0.6)`); at 1.08 it clears by 0.11.

Clicking it opens a themed **`<UIWindow>`** ("The Big Piano" — keys down, notes played, players on the keys, the last note and who played it, how long it has been held) through the **shared Stage pick path**: the root group carries `userData.pickRef`, which `Stage`'s `carrierOf` and `<Park>`'s `onPick` both dispatch. **No local raycast** — that path already gets the parent-chain visibility test, real-geometry-before-click-proxy ordering, the 8 px drag threshold and per-inset cameras right. The fleet's live-state accessors are `userData.pianoRef()` (state + the whole `press` array) and `userData.pianoKeys()` (each key's x / black / note) — the behaviour harness finds the rig with them.

## For the Pulse District set-piece author

* **Footprint** 5.04 × 2.63 (x ±2.52, z −1.88…+0.75 at `count` 15, `scale` 1), height **1.94** — a mid-height landmark, well under `<Discotron>`'s 3.07 and `<NeonArch>`'s 3.21.
* **Walk-on edges: BOTH ±x ends and the +z front.** The only closed side is −z (the case). The cheek blocks sit on the case side deliberately: a 0.3-tall cheek across the key run's ends would fence off the whole point of the piece.
* **Lay the key run ALONG the street** (`rotation` aims local +x down the path) so a guest crosses key after key — that is the money shot, and the behaviour probe's plot is the minimal example. A street running the other way crosses one key.
* **Blockers:** none by default. `blocking` adds ONE rect over the case (`2.54 × 0.84`, height 1.6) — keep it ≥ 1 u off any street centreline or `validatePark`'s `blockers` gate will fail the street laid past it.
* **Reserve 1.4 u of clear ground behind the case** for the harp, the marquee posts and their footings (z −1.88 is the post line).
* It is **not** a ride, so it contributes nothing to the land's acceptance-sim cycle budget and needs no queue tail outside the reserved court.

## Preview circuits

- **3D rig — The Big Piano (LEAD, the interaction)** — the demo player striding across the keys on the deterministic 18-second loop, stopping mid-run to dance on the beat, walking off; fed through exactly the same hit detection a live GameManager guest goes through.
- **Night (the keyboard lit)** — the hero.
- **A chord held down (close — the keys)** — `chord demo={false}`, a reproducible still of three keys depressed and lit.
- **One octave + the action (`count` 7)** — the case read: fallboard, note lamps, hammer rail, harp, chord bar, cheek blocks.

**`node bp-clip.mjs --mode=flush|bare --drive=none|some|chord|demo`** — THE GROUND-CLIP PROBE, in a live `<Park>`. For every key at every sampled point of the press envelope it takes five stations along the key's TOP FACE, raycasts straight down with **every mesh of the piano excluded**, and reports the margin between the key surface and whatever real ground is under it (terrain, path slab, plaza, kerb). `--drive=demo` sweeps the envelope through the component's own detection path (25 distinct press values over an 18 s demo loop, attack *and* release); `--drive=chord` pins every key at `press = 1`.

```
                      released          full press        whole sweep min
flush   naturals      +24.0 mm          +12.0 mm          +12.0 mm
        sharps        +40.1 mm          +32.0 mm          +32.0 mm
bare    naturals      +80.8 mm          +78.9 mm          +78.9 mm
        sharps       +100.8 mm          +98.8 mm          +98.8 mm
```

Before the fix, the same probe: `flush` naturals **−51.7 mm** at full press (sharps −22.1), `bare` naturals +6.2 mm with the key body 48.8 mm into the turf.

Two ways to get a wrong answer out of this probe, both hit for real: (a) leave the piano's own **bloom plate and note blooms** in the raycast target set and every margin comes back as a tidy −0.014; (b) **sort the key meshes by x** to pair them with `press()` — child order already IS `press()` order, and sorting reported resting keys at pressed heights.

Every preview runs `ground={false}` over a dark asphalt forecourt with a pale **promenade running straight across the keys**, because "the street runs along the key run" is the placement rule and a preview on a lawn hides it.

## Screenshot verdicts

* **Lead, day** — unmistakably a giant piano: ivory naturals, dark sharps, 25 felt hammers, a strung harp, the neon marquee, the note lamps lit, and a violet glow under the demo player with the key below them down.
* **Lead, night** — the hero: the marquee blazing, the strings glowing magenta, the whole keyboard bathed in violet on the beat and one key blazing white-violet under the player.
* **Alternate angle (125° orbit)** — the five back posts and two cross rails; it reads as an object from behind instead of two flat black rectangles.
* **A chord (close)** — the pressed keys sit visibly LOWER and flatter than their neighbours, lit pink and blue, with a clean step at every boundary.
* **Mid-step IN A REAL PARK (`bp-behaviour.mjs`)** — a live sim guest mid-stride with the key under their foot fully depressed and blazing, its bloom on the key, `press = 1.00` paired to that guest's own local x. **Before the ground-clip fix that key was simply GONE** — swallowed whole by the paving, with only its violet bloom marking where it should have been; the guest read as standing on bare pavement. After: the full length of the key is there, recessed one clear step below the un-pressed keys either side.
* **Grazing low angle in a real park (`bp-shot.mjs`, camera 0.78 u)** — at rest the key tips stand above the chrome keyslip; with the chord held they sit down flush with it. No daylight under any key tip, and nothing pokes below the paving.

Built with three.js on the shared Stage; the beat and palette are the Pulse District's own (`PULSE_PALETTE`, imported from `components/Discotron`), the window chrome RCT2's (`components/UIWindow`).

## Audit — 2026-07-25, /100

| Dimension | Score | Notes |
|---|---|---|
| Mesh richness & count | 15/15 | **120 meshes / 12 522 tris** at `count` 15 (94 / 11 798 at 7), 95 materials, 32 merged batches, **38 objects `lodDetail`-tagged** — the best-tagged rig in the district. A scenery-class piece at 120 draws against the rubric's 8-48 band for a *prop*, which is right: this is a 5-u landmark with 25 hinged keys, 25 felt hammers and a strung harp, not a bollard. Deterministic: two identical builds agree exactly |
| Detail | 15/15 | tex+bump on every opaque surface (1 of 11 large surfaces untextured — the harp's additive string sheet). **73 of 123 emissive intensities change day→night, maxDelta 2.163**; 3 PointLights; the MECHANISM is the piece — one felt hammer per key on a chrome rail, `0.30 − press·0.85` rad, plus 29 strung wires, a tuning-pin bar, a hitch bar, 12 chromatic note lamps and 5 back posts. Metalness: **0 materials ≥ 0.6** |
| Cohesion | 20/20 | Exact ray-parity clash sweep with a held `chord`: **NONE over the whole sweep** — no hinged key or swinging hammer is inside any static solid. **Re-audited 2026-07-25 against the GROUND as well** (`bp-clip.mjs`, see below) after the user reported a pressed key clipping the floor, which the old sweep could not see because it only tested the piano against ITSELF. Now, over the whole press envelope in a live park: `flush` naturals **+12.0 mm** at full press / +24.0 released, sharps **+32.0 / +40.1**; `flush={false}` naturals **+78.9 / +80.8**, sharps +98.8 / +100.8. Guests' feet land ON the keys (13 224 of 13 426 key-under-guest samples had a key DOWN). Case footprint 1.08 u off the promenade centreline against the 0.97 u the planted gate needs |
| Guest comfort | n/a → 15/15 | Nothing is ridden, worn or carried, so the four deductions cannot apply; what CAN is "is the walk-on surface actually steppable", and it is: `BLACK_RISE` 0.02 keeps the sharps flat enough to walk over, the nosing is on the three OPEN sides only, and the cheeks are on the closed −z case side so no fence crosses the key run |
| Guest location | 15/15 | 20/20 unit checks re-pass (`bp-facts.mjs`): the key under a guest is DOWN paired against **that guest's own local x**, its neighbours are not, one note per key, ascending C3→C5 across the run, held keys re-trill without re-sounding, every key releases. In the live park (150.5 dt-clock sim-s, 82 guests): **44 guests on the keybed, 42 LATCHED / 46 latches, longest single latch 10.6 s of a 5-11 s window, 41/42 resumed walking, 842 notes**, and **0 of 11 476 pressed-key samples was a random key**. Longest still-while-`walking` **3.6 sim-s** of validatePark's 25 |
| Aesthetic | 20/20 | Unmistakably a giant piano at the park camera, at 115° (the five back posts do their job) and at night. Ivory naturals, dark-indigo sharps, chrome-framed neon marquee, note lamps, and one key blazing under the player's foot with its bloom flat ON the key |
| **Total** | **100/100** | |

⚠️ **A 20/20 COHESION SCORE HID A REAL GROUND CLIP FOR A WHOLE AUDIT.** The clash sweep that earned it was a *self*-clash sweep: it asked "is a hinged key inside one of the piano's own static solids", never "is a hinged key inside the FLOOR". A pressed natural was 51.7 mm under the plaza slab the entire time, in the default mounting mode, and the audit called it clean. **Any rig with moving parts near the ground must sweep against the surface it is standing on** — raycast down from the moving geometry with the rig's own meshes excluded (the first cut of `bp-clip.mjs` forgot to exclude them, hit the piano's own bloom plate and reported a tidy −0.014 for every key, pressed or not).

⚠️ **THE PROBE WAS WRONG BEFORE THE COMPONENT WAS.** The first re-run of `pd-behaviour.mjs` FAILED *"no pressed key is a RANDOM key"* at 12 of 11 062 samples with a worst gap of **4.55 u** — a key at one end of the run down with the nearest counted guest at the other end. It was the probe's keybed rect: it used `built.half` (|lx| ≤ 2.48, |lz| ≤ 0.72) where the component's own per-guest hit test is **`|x| > halfW + 0.05` → no key** and `z outside [−0.67, +0.71]` → no key. A guest 2.48-2.53 out along the run still presses a key while the probe had stopped counting them as on the keys. Rect corrected to the component's: **12 → 0 of 11 476, worst n/a.** Recorded so the next audit does not "fix" the piano.

Probes: `/tmp/mp3d-render/bp-facts.mjs` (20 unit checks, all pass), `pd-behaviour.mjs` (rendered-frame, per-key pairing), `pd-zones.mjs` (validatePark's fixed dt = 1/30), `aud-pd-facts.tsx`, `aud-pd-clash2.tsx`.
Shots: `shots/aud/BigPiano-{day,night,elev50,a115}.png`, `BigPiano-p2-chord.png`.
Fixed this pass: nothing in the component — the one failure was the probe's own rect, corrected in `pd-behaviour.mjs`.

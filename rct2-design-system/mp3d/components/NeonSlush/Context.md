# NeonSlush

**CANONICAL IMPORT — copy exactly:** `import { NeonSlush } from './components/NeonSlush';`
*(never from `'./Park'`: only the `<Park>` wrappers + track-piece JSX live there. A wrong
specifier makes esbuild refuse the WHOLE bundle — the round-8 black-page failure.)*

The **PULSE DISTRICT**'s stall: a **GLOWING SLUSHIE BAR**. A black-gloss club-front counter on a concrete plinth with a chrome kick rail and a beat-pulsed neon lip trim, carrying **three real slush machines** — transparent polycarbonate bowls of luminous magenta / cyan / violet slush with chrome **augers turning inside them**, chrome lids, spigots and drip trays — under a neon **fascia** whose LED bars chase three-to-the-bar and a chrome-framed **SLUSH** marquee (a real `buildNeonSign`). Plus a nested cup tower, a straw caddy, a syrup pump rack, an LED price panel and the rubber wet-zone mat every drinks stall has.

It sells a **DRINK**, and its buyers walk away carrying a **tall lidded cup of glowing slush with a straw** (`heldItem`: `buildHeldSlush`) — not the manager's generic red cup.

Composable stall on the `BurgerShop` / `SushiStall` pattern (components/Park/Context.md → "The composable convention"). Exports:

- `<NeonSlush position rotation scale withGuest text register name price value>` — built on `<ConfigurableStall>` via `composableStall`. Inside a `<Park>`, `register` registers a selling DRINK stall with the GameManager (defaults: **Neon Slush, item `'drink'`, price 3, value 5**): guests thirst-seek it, buy, sip and litter. **The serving front faces local +z** — the attach point sits 0.72 u out that way, so aim `rotation` at the customers' path.
- `buildNeonSlush(t, { withGuest?, text? }) → { group, update, dispose }` — the imperative builder. Group origin on the ground at the counter's centre.
- `buildHeldSlush(t) → THREE.Group` — the held cup (below).

**NAME IT.** `register` on its own ships the catalog default name, and the GameManager keys `moveStall` / the corridor resolver on the NAME, so duplicates make it measure the wrong shop:

```tsx
<NeonSlush position={[-3, 6.6]} rotation={Math.PI / 2}
  register={{ name: 'Bassline Brainfreeze', price: 3, value: 5 }} />
```

## Measured facts

| | |
| --- | --- |
| footprint (x × z) | **1.97 × 1.24** (x −1.11…0.86 — the price panel sticks out to −x; z −0.45…0.79 — the rubber mat) |
| height | **1.52** (marquee top) |
| draw calls | **80** — cf. `SushiStall` 94, `EmberRoast` 167 |
| triangles | 8 728 |
| PointLights | **2** (budget 4) |
| particles | **0** (budget 300) |
| counter top | y 0.39 · machine lids 0.85 · fascia 0.95-1.12 · marquee 1.18-1.52 |

The bulk of the mesh count is `buildNeonSign`'s tube pairs (one core + one halo per stroke) and the three machines' per-bowl transparent/emissive parts, which cannot batch because each needs its own animated material.

## The shared beat

`BEAT_HZ`, `beatStep`, `beatPulse`, `beatKick` and `paletteAt` are all **imported from `components/PulseScenery`** — the district's one 2.2 Hz clock, the same one `<DanceFloor>` flashes its tiles to, `<Discotron>`'s mirror ball scintillates on and `<Bassline>`'s tunnel hoops chase to. This stall pulses on the same FRAME as the floor. **32 of the stall's 80 emissive intensities change over a half beat** (headless probe, `t = 3.0` vs `3.2273`, nightK 0), deterministic.

The material greys are `PULSE` straight from `components/PulseScenery`, exactly as `components/SushiStall` takes its timbers from `TIDEWATER` — this stall weathers like the speaker stacks parked beside it instead of inventing its own greys.

**One thing deliberately does NOT step on the beat: the slush COLOUR.** A magenta machine turning cyan on the downbeat reads as a bug, not a light show. What beats is the bowls' BRIGHTNESS, so the three flavours throb together and stay themselves.

**Absolute clock, no gate.** The augers turn on raw Stage time (each at its own rate, and the middle one turns the other way, because nobody plumbs three machines the same). A club never stops.

## The HELD CUP (`buildHeldSlush`) — and the arithmetic behind it

The 3D drink a buyer walks away with, registered on the stall descriptor as GameManager's `StallConfig.heldItem` (see components/GameManager/Context.md → "Per-stall held items"). Peep-local units — head radius 0.12, closed fist ball radius 0.05 centred at arm-local `(0, −0.37+0.05, 0)`; the park's 0.5 `GUEST_SCALE` is applied by the guest rig, so nothing is pre-scaled.

Nine meshes, 710 triangles: a translucent tapered wall, a base disc, a printed label band, a rolled lip, a **domed lid** with a boss, the **glowing slush charge** with a **mound above the fill line** (a flat fill line reads as a cup of cordial), and a straw.

### The hold-spot offset — the third time this project has paid for it

The manager parents the group at the DRINK hand hold spot, arm-local **`(±0.03, −0.37, 0.115)`**: 0.05 **below** the fist centre and 0.115 **in front** of it, because the spot is sized for a fat burger. The generic 0.06-radius cup only just grazes the fist; anything slimmer plainly hovers, which is what cost the floss cone and the sushi tray a round each. So the cup carries its own offset:

```
g.position = (−0.01, −0.069, −0.115)      g.rotation.x = 0.5
```

Probed in the arm-local frame (fist centre `(0, −0.32, 0)`, r 0.05; forearm box x ±0.045, y −0.32…0, **z ±0.055**):

| point | arm-local | verdict |
| --- | --- | --- |
| cup BASE centre | `(0.02, −0.439, 0.000)` | **0.069 hangs below the fist** — a real carried drink |
| cup axis at GRIP height | `(0.02, −0.325, 0.062)` | wall at z 0.015 → **INSIDE the 0.05 fist ball**: gripped, not floating |
| rim centre | `(0.02, −0.277, 0.089)` | clear |
| rim BACK lip | `(0.02, −0.252, 0.043)` | 0.012 inside the sleeve = **0.006 world at GUEST_SCALE** — invisible |
| lid top | `(0.02, −0.229, 0.115)` | clear of the forearm's 0.055 front face |

**The 0.5 rad tilt is structural, not styling.** The forearm box runs z ±0.055 over the arm's *whole* length, directly above the fist — so a plumb-vertical cup this tall cannot both touch the fist and clear the sleeve. The trade was probed at three tilts: at **0.2 rad** the rim clears (z 0.070) but the cup has to sit at z 0.11 and floats 0.013 ahead of the fist; at **0.3 rad** the back lip drives 0.028 into the sleeve; at **0.5 rad** you get grip contact *and* a 0.012 residual. **And the tilt is why the LID is not optional** — an open cup carried at 29° is spilling. The straw counter-tilts −0.38 inside the cup frame so it stands roughly plumb in the world.

### The close-up verdict — PASS

Rendered on a real `buildPeep` at `GUEST_SCALE` 0.5 with the manager's exact attach transform, from a low camera (`--elev=6`), front / profile / sip-lift, plus a single-guest **fist-detail** frame at distance 0.62:

- **Carry pose: PASS.** The skin fist ball is visibly on the cup wall at roughly 70 % up the body, the printed label band sits under it and the base ring shows clear below the hand. No air gap. Nothing intersects the sleeve visibly.
- **Sip pose: acceptable, and inherited.** At the manager's drink lift (`−2.0` rad + the `−0.4` inward shoulder tilt) the hold anchor lands at peep-local **y 1.13**, which is *above the top of the head* (1.11) — that is true of the generic cup and every other `heldItem` in the fleet, not of this recipe, and the pose is "cup tipped up at a head tipped back". The cup's own +0.5 tilt nets to about −1.5 rad there, i.e. tipped toward the mouth. The domed lid is what keeps that reading as drinking rather than pouring; without it this pose would look like a spill.

### The glow, with no PointLight per guest

The slush emissive sits at ~1.3 behind a 0.42-opacity wall: the cup reads as **lit** at night from three metres with no light source anywhere near it. Verified in the night live-sim preview — guests walk the path carrying visibly glowing cups while only two PointLights exist in the whole frame.

**And they pulse.** The manager builds one prototype per stall and every purchase is a `clone()` that **SHARES its materials**, so `buildHeldSlush` registers its emissive materials in a module-level `HELD_GLOW` set and the STALL's own updater writes them once per frame — every slushie in the park beat-pulses with the machines it came out of, for the cost of three property writes. (Probed: 4 of the cup's 9 emissive intensities change over a half beat, driven entirely by the stall's updater.) Materials are never disposed by the manager — its own documented contract, the reason nothing is freed when an item leaves a hand — and writing `emissiveIntensity` on a disposed material is harmless, so the set cannot dangle.

Override the recipe per placement with `register={{ heldItem }}`.

## Notes from the build

- **`gloss` is for SMALL panels.** The counter TOP slab started as `PULSE.deck` and the chrome nosing started as a full 1.64 × 0.92 plate over it. A sun-facing plane that size took the light and read as a **pale grey concrete counter** covering the whole bar. The slab is now `gloss` at roughness 0.30 and the nosing is a thin four-bar FRAME. Same family of error as the `PulseScenery` speaker stack, which is why that pack's palette carries a `caseBlack` entry.
- **The augers have to be visible or they are wasted.** At opacity 1 the slush charge completely hid them, throwing away the one detail that says "slush machine" instead of "jar of jam". The charge is now 0.84 opacity and the blades sweep at radius 0.072 inside a 0.105 bowl — where a real auger scrapes the ice off the glass, and the only radius at which they glint through.
- **Recessed front panels** run down the counter face for the same reason: one 1.5 × 0.3 slab of `gloss` is a void.
- The marquee is **framed in chrome**, exactly as `<NeonArch>` frames its own: `buildNeonSign`'s board is `0x1d1e22` and its tubes only glow at ~12 % by day, so an unframed marquee reads as a black rectangle at noon.
- The decorative `withGuest` peep **bobs on the district beat** rather than on an unrelated sine.

## Previews

`NeonSlush.previews.tsx` (5, all inside `<ScenePreview>` — a component never renders a `<Stage>`):

0. **Selling slush (live sim)** — a miniature deterministic GameManager on a path loop, pre-warmed and run at 2× so walk-up → buy → sip → bin fits one viewing, with the stall's own `heldItem` in the buyers' hands.
1. **The held cup, close up** — three guests at `GUEST_SCALE` with the real cup at the manager's exact attach transform: front, PROFILE (the view that catches a floating item), and full sip lift.
2. **The fist, in detail** — one guest at distance 0.62, close enough to see the fingers on the wall. *This is the frame that decides whether a held item ships.*
3. **3D rig** — the bar with a queueing guest.
4. **After dark** — the live sim at night: bowls throbbing, fascia chasing, marquee lit, and glowing cups walking away down the path.

Original three.js model on the shared Stage (day/night lighting); the world is documented in `components/PulseScenery/Context.md` and `components/Discotron/Context.md`.

## Audit — 2026-07-25, /100

| Dimension | Score | Notes |
|---|---|---|
| Mesh richness & count | 15/15 | **80 meshes / 8 728 tris**, 67 materials, 29 merged batches, 18 objects `lodDetail`-tagged, 2 PointLights, 0 particles. Against `SushiStall` 94 and `EmberRoast` 167 for the same class. The count is dominated by `buildNeonSign`'s tube pairs and the three machines' per-bowl transparent/emissive parts, which cannot batch because each needs its own animated material. Held cup: 9 meshes / 710 tris. Both deterministic |
| Detail | 15/15 | **0 of 6 large opaque surfaces lack tex+bump** — the best coverage in the district. **34 of 82 emissive intensities change day→night, maxDelta 2.237.** Metalness: **0 materials ≥ 0.6**. Mechanism modelled and *visible*: three chrome augers turning at radius 0.072 inside 0.105 bowls behind a 0.84-opacity charge (at opacity 1 they were invisible, which threw away the one detail that says "slush machine"), plus spigots, drip trays, lids, syrup pumps, a cup tower, a straw caddy and an LED price panel |
| Cohesion | 20/20 | Exact ray-parity clash sweep over the augers' cycle: **NONE over the whole sweep** — no auger blade is inside a bowl wall, a lid or the counter. Swept envelope 1.965 × 1.517 × 1.396 against a static 1.965 × 1.517 × 1.235 (the decorative guest's bob). No roof to bury the counter: the piece is a bar with a backlit fascia, so the whole serving front reads from the park camera |
| Guest comfort | 15/15 | **The held cup re-probed in the ARM-LOCAL frame by EXACT VERTEX, not AABB** (760 vertices): grip contact **−0.0182** (the cup wall is 18 mm INSIDE the 0.05 fist ball — gripped, not floating), base hangs **0.138** below the fist, deepest sleeve penetration **0.0202 arm-local = 0.0101 world at `GUEST_SCALE` 0.5**. The 0.5 rad tilt is structural (a plumb cup this tall cannot both touch the fist and clear the sleeve) and the domed lid is what keeps a 29° carry reading as carried rather than spilled. The fist-detail frame at distance 0.62 — *the frame that decides whether a held item ships* — shows fingers on the wall, the label band under them and the base ring clear below: **PASS** |
| Guest location | 15/15 | Serving front faces local +z with the manager's attach point 0.72 u out that way; in the shipped district the pad clears the frontage walk by **1.320000** and the `SE` port arm by **1.44** against the 1.20 u `lintPadOffLattice` audits (the 0.12 in the land's offset is the binary-representation safeguard). Guests thirst-seek, buy, sip and litter/bin in the live sim, and every buyer walks away carrying the stall's own `heldItem` |
| Aesthetic | 20/20 | Reads as a glowing slushie bar at the park camera (its own preview pose is 23.1° — the `--elev=50` shot is the one that counts, and it holds), at 115° (rear connector detail) and at night (bowls throbbing, fascia chasing three-to-the-bar, marquee lit, glowing cups walking away). The slush COLOUR deliberately does not step on the beat — only its brightness — because a magenta machine turning cyan on the downbeat reads as a bug. `PULSE` greys imported from `PulseScenery`, never re-derived |
| **Total** | **100/100** | |

**32 of 80 stall emissives change over a half beat** and **4 of the cup's 9** do too, driven entirely by the stall's updater through the module-level `HELD_GLOW` shared-material set — so every slushie in the park pulses with the machines it came out of, for three property writes a frame. Re-verified deterministic.

Probes: `/tmp/mp3d-render/slush-facts.mjs` (census, hold-spot arithmetic, beat sync, shared-material glow), `aud-pd-clash.tsx` → `heldCup` (exact-vertex arm-local grip/sleeve test), `aud-pd-facts.tsx`, `aud-pd-clash2.tsx`.
Shots: `shots/aud/NeonSlush-{day,night,elev50,a115}.png`, `NeonSlush-p1-held.png`, `NeonSlush-p2-fist.png`.
Fixed this pass: nothing — the stall came in clean. The one number that moved is the sleeve residual (0.006 → 0.0101 world) because the audit measured every vertex instead of the rim's centre point; still invisible at `GUEST_SCALE`, and the fist frame confirms it.

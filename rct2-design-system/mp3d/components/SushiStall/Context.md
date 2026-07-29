# SushiStall

**CANONICAL IMPORT — copy exactly:** `import { SushiStall } from './components/SushiStall';`
*(never from `'./Park'`: only the `<Park>` wrappers + track-piece JSX live there. A wrong
specifier makes esbuild refuse the WHOLE bundle — the round-8 black-page failure.)*

**Tidewater Hollow's food stall: a weathered DOCKSIDE SUSHI COUNTER** — driftwood-grey plank cladding rope-lashed to two gantry posts, a cold slate top, an OPEN ice case (a fishmonger's chilled tray, not a sealed glass cabinet — this is a shipwreck cove, not a mall) holding a row of nigiri and a few stood maki rolls, a short brine-teal noren strip, a swag of cork/glass fishing floats, a slate chalk menu on its own post, one paper lantern, and — standing on a driftwood trestle behind the counter — a **GIANT NIGIRI** (1.8 u wide, ~15× the case pieces: a salmon slice with a nori band over a cream rice pillow) so the stall says what it sells from the park camera and not only from the counter. Salt-weathered and maritime, not neon-Tokyo — the brief was "stall should just be sushi" for a world that already has `<TidewaterScenery>` (the wreck, the reef, the anchor, the tide pool, the pilings) and `<ReefRacer>` (the flagship water coaster) beside it, so this sits on the same shelf as those, not on its own.

Serving front faces local **+z**; the GameManager attach point sits **0.72 u** out that way. Sized against a 0.5-scale park guest like the four catalog shops and EmberRoast: counter top y 0.39–0.42, ice-case roof ~0.63, gantry lintel 1.05, overall envelope 1.09 tall (measured bbox) — the same order of magnitude as HotDogStand's ridge (1.42) and EmberRoast's stack (1.66), not a doubled-up building.

## Exports

- `<SushiStall position rotation scale withGuest register pinned name price value>` — built on `<ConfigurableStall>` via `composableStall`. Inside a `<Park>`, `register` registers a selling FOOD stall with the GameManager (catalog defaults: **Dockside Sushi, price 4, value 6** — the same tier as EmberRoast, top of the "2-4 / 4-6" range the other food stalls sit in). `withGuest` adds the decorative queueing peep (preview flavour, default off).
- `buildSushiStall(t, { withGuest? }) → { group, update, dispose }` — the imperative builder.
- `buildHeldSushiTray(t) → THREE.Group` — the held-item recipe (below).

**NAME IT** (round-7, same as every other stall): `register={{ name: 'Reef Rolls', price: 4, value: 6 }}` — the manager keys `moveStall` and the corridor resolver on the name, so shipping the catalog default twice makes it measure the wrong shop.

## Palette discipline — nothing invented

Every timber/rope/rust/barnacle hex is `TIDEWATER`, imported straight from `components/TidewaterScenery` (`driftwood`, `driftwoodPale`, `timberWet`, `rope`, `barnacle`, `rust`) — this counter weathers exactly like the wreck, the anchor and the piles beside it, not its own invented grey. The counter/menu stone is a cold wet-slate blue-grey (`0x53545a`), deliberately NOT the warm concrete-tan the land-world stalls use. The gantry's one splash of colour — the noren and its head-band — reuses Tidewater Hollow's own canopy pair (SetPieceKit `TIDEWATER_HOLLOW`: cream `0xe4e0cc` / brine-teal `0x1f6b6a`), hardcoded locally exactly the way EmberRoast hardcodes `EMBERFALL_CALDERA`'s scorched-sailcloth pair, so this file has no import-time dependency on SetPieceKit. The sushi itself (rice, salmon, tuna, tamago, ebi, nori, wasabi, ginger, ice) is the only OTHER saturated colour in the piece.

## The sushi props — one recipe, two scales

`nigiriPiece(t, s, topping, seed, { nori? })` (an oval rice pillow + a draped, hashed-jittered topping slice) and `makiRoll(t, r, h, fill, seed)` (a nori-wrapped cylinder stood on its cut face, with a pale rice ring and a coloured filling dot) serve BOTH the case display (7 nigiri across 4 toppings + 3 stood maki, the sign of what this stall sells) and the held tray — the same "one recipe, several scales" convention as EmberRoast's `skewerProp`. Since 2026-07-28 `nigiriPiece` also serves a **third** scale: the GIANT hero piece at `s = 1.55` (see below).

## The held sushi tray (`buildHeldSushiTray`)

`buildHeldSushiTray(t) → THREE.Group` is the stall's OWN 3D item, registered on the descriptor as GameManager's `StallConfig.heldItem`: every guest who buys HERE walks off carrying THIS tray — a small pale-driftwood board with a shade-darker grip strip along the near edge, a pair of nigiri (salmon + tuna) and a dab of wasabi + a curl of pickled ginger tucked at the near corners — instead of the manager's generic burger puck.

**The floss-cone lesson, flat.** The hand hold spot sits 0.15 FORWARD of the fist ball (arm-local `[0, -0.32, 0]` off the anchor — EmberRoast's solved numbers, GameManager Context.md § "Per-stall held items"), so a flat board left at the anchor's default z floats a clean gap ahead of the fist exactly like the floss cone and the skewer did. The fix, in the same coordinate arithmetic EmberRoast used for its stick:

```
position (0, 0.06, -0.145)   rotation.x -0.3
```

Pulling the group's own origin back onto the fist centre and tipping the board back lets the NEAR (handle) edge rest on the fist while the FAR edge — carrying the food — lifts into view instead of drooping into the forearm. Verified with CLOSE-UP renders of real sim buyers, not just the numbers: front + profile shots of a guest carrying the tray (`/tmp/mp3d-render/shots/closeup-sushi.png`, `closeup-sushi-side.png`), and six more samples across the idle/carry pose (`closeup-sushi-mid0..5.png`, `closeup-sushi-fine0..9.png`) all show the tray sitting steady at the fist with both nigiri visible and no clipping into the torso.

Override per placement with `register={{ heldItem }}`. See `components/GameManager/Context.md` → "Per-stall held items".

## Budgets

**1 real PointLight** — the paper lantern, gated FULLY TO ZERO by day (`nightKOf`, no floor): a paper lantern with nothing burning inside is just a paper ball in daylight, the opposite of EmberRoast's lava rule ("lava is not a lamp, it never gates to zero") — a lantern IS a lamp, and lamps go dark. **0 particles** (budget 300): a still dockside counter, matching TidewaterScenery's own "no smoke, no spray" discipline for the cove. 111 meshes / ~10.4k tris for the whole rig (probe, `withGuest: true`; it was 107 / ~10.2k before the giant nigiri — meshes-only, no guest: **98 / 7 936**, up from 94 / 7 728); static repeats (plank cladding front+sides, chalk menu lines, barnacle fleck, **and the hero's whole trestle — two posts plus a cross-rail in one mesh**) batched through `mergedBoxes`; fine detail (barnacle fleck, chalk lines) tagged `userData.lodDetail`. Deterministic — hashed sines only, never `Math.random`/`Date.now`; the updater takes ABSOLUTE time.

## Previews

1. **Selling sushi (live sim)** — a miniature `createGameManager` on a path loop with the stall registered at the counter front (anchor `[0, 0, 0.28]`, front z 1.0), pre-warmed 32 sim-s so the crowd is already hungry, then 2× time: guests walk up, buy, and stroll off carrying the tray until only a container is left to bin.
2. **3D rig** — `<SushiStall withGuest>` in `<ScenePreview distance={6.2} targetY={1.15} autoRotate={false}>` (reframed 2026-07-28 to get the giant nigiri in shot; it was 4.8 / 0.75).

## Verification

- `node check-all.mjs` — all previews bundle, including `SushiStall`.
- `node validate-react-park.mjs` — unaffected, still `ok: true`.
- A dedicated real-sim probe (modelled on the fleet's `held-probe.tsx`) ran 105 purchases: every buyer carried a mesh matching `buildHeldSushiTray`'s own geometry+colour signature (never the generic burger), 8 guests reached the eaten-down container stage, litter/bin flow unaffected. `ok: true`.
- Rendered day, night (lantern glow only — `0.0` day / `0.88` night PointLight intensity, confirmed via a headless probe), and an alternate orbit angle, plus close, controlled-camera inspection shots of the counter (ice case, gantry, net floats, noren) and of real sim buyers carrying the tray.

## Modelling notes

- The first pass gave each gantry post a single full-length diagonal brace (`rotX ±0.55` on a 0.34-long plank) — at the render angle it read as a loose board leaning against the post, not a built joint. Replaced with a short stubby knee-brace near the lintel.
- Crushed ice: flattened, hashed icosahedra (angular, unlike beach rubble — real crushed ice IS faceted) at a cool blue-white (`0xcfe7ec`) and low roughness (0.12) for a wet sheen; a flat pale shape read as gravel until the colour/roughness were pushed cooler and glossier.
- The ice case is deliberately OPEN (no glass shell): a sealed cabinet reads as a restaurant kiosk, and this stall is dockside dressing beside a shipwreck, not a mall unit. The noren hangs off only ONE side of the gantry (not across the whole front) so it dresses the stall without curtaining off the ice case guests are there to see; the net-float swag balances it on the other side.

## Audit — 2026-07-25, 100/100

| Dimension | Score | Notes |
|---|---|---|
| Mesh richness & count | 15/15 | 94 meshes / 7 728 tris / 1 light; plank cladding, barnacle flecks, lantern ribs and the chalk lines all batched through `mergedBoxes`, 2 `lodDetail` |
| Detail | 15/15 | tex+bump on counter, cladding, slate, gantry, noren; rope rings, net floats, spare boards, coiled rope, slate chalk menu; **night is the stall's best frame** — the paper lantern lights the counter, the sushi and the noren warm, and gates fully to zero by day |
| Cohesion | 20/20 | lowest point **y = −0.0000** (sits exactly on its datum, neither sunk nor floating); 64-sample cycle sweep y −0.0000…1.0850 — nothing moves but the lantern's glow and the peep's idle, so no mid-cycle clash exists; the serving front leaves **0.25 u** between the counter's slab lip (z 0.470) and the manager's attach point (z +0.72), so a buyer stands clear |
| Guest comfort | 15/15 | held tray probed IN THE ARM-LOCAL FRAME — see below |
| Guest location | 15/15 | sells through a real `GameManager` in the lead preview (walk-up → buy → eat → bin); in the live world probe it registers as `'<title> Reef Rolls'` on the frontage decking and `validatePark` returns 0 failures / 0 warnings, so its body and attach point are on the walked slab and off every street |
| Aesthetic | 20/20 | reads as a dockside counter from the 50° park camera; every timber/rope/rust/barnacle hex is `TIDEWATER`; the dark slate top against pale decking is 3+ stops of separation, i.e. the opposite of value collapse; no repetition artefact |
| **Total** | **100/100** | |

Probes: `/tmp/mp3d-render/tw-held.tsx` (§1 held item, §2 stall extents), `tw-facts.tsx` (census).
Shots: `/tmp/mp3d-render/shots/tw/SushiStall-{day,night,a115,e50}.png`, and the stall in situ in
`shots/tw/park-SURFACE.png`.

**The held-item probe, measured rather than eyeballed.** `guestFx.ts:218` puts a food item's
hold spot at arm-local **(±0.03, −0.37, 0.15)** while the FIST BALL centres at **(0, −0.32, 0)
with r 0.05** and the forearm box is **|z| < 0.055**. Parenting `buildHeldSushiTray` there and
reading every vertex back in arm-local space:

| check | measured | verdict |
|---|---|---|
| grip (the tray's own origin) | (0.030, −0.310, 0.005) | **0.0320 u** from the fist centre — INSIDE the r 0.05 ball |
| back lip | z **−0.040** | clear of the sleeve plane at −0.055 |
| vertices behind the forearm | **0 / 1 488** | nothing buried |
| vertices inside the fist ball | **252** | genuinely gripped, not floating ahead of it |
| size | 0.185 × 0.079 × 0.107 | fist-to-head sized against head r 0.12 |

Both hands mirror identically. This is the case the rubric warns about — the shared hold spot
is sized for a fat burger and a flat slim board floats ahead of the fist unless it carries its
own self-offset — and the builder's own `position (0, 0.06, −0.145)` + `rotation.x −0.3` is
that offset. It measures correct; **nothing was changed.**

Nothing was changed in this component at all this pass: no deduction in the rubric's tables
applied. Two things were considered and rejected rather than done, recorded so they are not
retried:

* **A roof.** §6 says a symmetrical roof buries its own counter and needs an asymmetric
  catslide — but this stall has no roof by design, and EmberRoast's notes give the reason in
  one line ("an awning plate here reads as a lid from above"). Adding one to satisfy a rule
  about roofs would have hidden the ice case that is the whole read.
* **A hero sign prop** (a giant nigiri, the HotDogStand move). The stall is 1.5 u wide on a
  frontage row between two lanterns and a bin; a prop big enough to read from the park camera
  would have been out of scale with its own row and with the cove's understated dressing.
  **⚠️ THIS CALL WAS REVERSED ON 2026-07-28 — see the section below. It was wrong.**

---

## ⚠️ THE GIANT NIGIRI — the rejected hero prop, built (2026-07-28)

**The audit above rejected a hero sign prop and the overhead shot says that was wrong on the thing that matters most.** From a high park camera this stall was a **GREY SLAB with a line of coloured confetti on it**: the ice case — the entire read — is 0.1 u pieces on a 1.6 u slate top, and slate is the same value as tarmac, asphalt paths and wet rock. Nothing about it said *food*, let alone *sushi*. The "out of scale with its own row" reasoning was about how the stall sits next to a lantern and a bin; the actual question is whether a guest can tell what the shop sells from where they choose a shop, and the answer was no. `CottonCandyStand` and `BurgerShop` are legible from any distance for one reason: **THE SHOP IS THE ITEM** at ~2 u across, so the silhouette carries the message with no detail needing to resolve.

So: **ONE nigiri at `s = 1.55`** — a 1.69 × 1.00 rice pillow under a 1.83-wide salmon slice, ~15× the case pieces — **stood on two driftwood posts BEHIND the counter**, plus one nori band. Same `nigiriPiece` recipe as the case and the held tray, a third scale, no new vocabulary. The salmon orange `0xe8916a` against slate, driftwood grey and grass is the highest-chroma thing for 20 u in any direction.

### What it must not do, and how that was solved

| decision | why |
|---|---|
| **BEHIND the counter (`SZ = −0.62`), not on the gantry** | on the lintel (z 0.38) a 1.33-deep nigiri spans z −0.29…1.05 and sits directly over the **OPEN ICE CASE**, which is this stall's whole reason to exist — the same "no roof, no awning" rule this component already lives by (*"an awning plate here reads as a lid from above"*). Behind the counter it grows only the **BACK** of the envelope (to z ≈ −1.3), the safe direction: guests approach from +z, the registered body is a fixed `hx 0.6 / hz 0.42` on the anchor, and the 0.72 u attach point and the counter lip at z 0.470 are untouched. The serving side stays completely open |
| **tipped forward 0.60 rad** | left plumb, a ~50° park camera looks almost straight down onto the salmon slice: the topping hides the rice and the prop reads as an **orange TABLETOP on two legs**. A nigiri's identity is its SIDE profile. **0.30 was tried first and was not enough** (still a tabletop). At 0.60 the topping's lower front corner is at y 1.02 / z −0.18 — which is why `SZ` moved back from −0.45 to −0.62: from ~50° above and in +z an object there occludes ground only past z ≈ 0.68, so the ice case at z 0.02 (±0.22) stays clear |
| **no `nori: true`** | that option belts ONE hashed side of the pillow — right for a 0.1 u case piece where it is a dark accent, but at s 1.55 it is a 0.22 × 0.62 × 1.18 **black box** hanging off one end with no visible pillow behind it. It read as an unexplained crate |
| **ONE nori band across the middle instead** | a big orange oval on two posts still read as a **parasol**. One black strap over the crown and down both flanks (the unagi/tamago wrap, a single box, 1.36 deep against the topping's 1.33 so it stands a hair proud at both edges and reads as *wrapped* rather than painted) makes it a shape nobody misreads: orange slice, black belt, cream pillow. One draw |
| **`castShadow = false` on the hero** | it is 1.55 u up and behind, so a cast shadow would only fall across the counter goods. The trestle still casts (it is structure) |
| **night-gated emissive, no new light, TINTED PER PART** | the paper lantern is the stall's ONE light, gates fully to zero and reaches 1.8 u — the hero is 1.55 u up and 0.9 u behind it, so after dark the thing that makes the stall findable would be the darkest surface in frame. `mat()` never shares a material instance, so an emissive on the hero's own materials costs no light and no draw. **The first night render used a single warm `0xffb07a` at 0.28 and the sign washed out to a FLAT CREAM BLOB** — the nori band glowed as brightly as the rice and vanished, the salmon lost its hue: bright but no longer *readable*, which is the opposite of the point. It is `emissive.copy(material.color)` at **0.20** now, so the pillow glows cream, the slice salmon, the band black. All three parts are untextured, so `material.color` is the real colour; a mapped material would need `emissiveMap` because `mat()` bakes the colour into the texture and leaves `color` white. **The lantern still gates to zero** — this is a painted sign catching the lantern, not a second lamp |

**MEASURED COST: +4 colour draws, +1 shadow draw, +208 triangles.** 94 → **98 meshes**, 92 → **93** shadow-casting meshes, 7 728 → **7 936** tris (probe: mesh/shadow/triangle census of the built group, working tree vs `3f9e83c461`, `withGuest: false`). The one extra shadow-caster is the merged trestle; the hero itself casts nothing.

The 3D-rig preview was reframed **distance 4.8 → 6.2 / targetY 0.75 → 1.15**: at the old pose the hero's crown (y ≈ 2.3) was cropped off the canvas, which is the one thing that preview now exists to judge.

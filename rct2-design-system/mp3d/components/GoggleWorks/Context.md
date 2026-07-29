# GoggleWorks

**CANONICAL IMPORT — copy exactly:** `import { GoggleWorks } from './components/GoggleWorks';`
*(never from `'./Park'`: only the `<Park>` wrappers + track-piece JSX live there. A wrong
specifier makes esbuild refuse the WHOLE bundle — the round-8 black-page failure.)*

**"The Goggle Works" — the BRASSWORK FOUNDRY world's steampunk optician, and the fleet's first real WEARABLE shop** (GameManager `item: 'wearable'`): customers walk away with a pair of brass aviator goggles ON THEIR HEAD, worn for the rest of the visit.

The building is a riveted brass-and-copper panel kiosk on a soot-iron carcass: a verdigris-patinated copper roof over the back half, a treadle-driven **lens-grinding wheel** turning on the counter behind its flat leather belt, a patinated copper **boiler** venting steam through the roof, three live **pressure gauges** bolted to the front panel, a felt tray of lens blanks, a display **rack of finished goggles** hanging under the roof edge, a brass **gaslight** on a curved bracket, an engraved nameplate, and — on the roof — a **GIANT pair of goggles** as the shop sign.

Serving front faces local **+z**; the GameManager attach point sits **0.72 u** out that way. Sized against a 0.5-scale park guest like the four catalog shops: counter top y 0.50, roof plate 0.98, **giant sign topping out at ~2.10**.

## ⚠️ THE GIANT GOGGLES — 2.2× was not a hero prop (2026-07-28)

At scale 2.2 the roof sign was ~**0.56 u wide on a 1.84 u roof** and topped out at 1.33: from a high park camera it read as **two brass buttons on a brown plate**, the same value as the copper roof they stand on, and this shop's whole identity — *you can see what you buy* — was unreadable at exactly the distance a guest picks a shop from. (The 2026-07-25 aesthetic pass passes on a 26° close-up of the SERVING FRONT; nothing in it measured the overhead read.)

Goggles are the luckiest article in the catalog for the `BurgerShop` / `CottonCandyStand` treatment: **TWO BIG CIRCLES SIDE BY SIDE** is an unmistakable silhouette with zero detail resolved, and the pale grey-blue lens glass `0x86aab4` is the one COOL colour in a shop made entirely of warm brass, copper and soot — so it separates from its own building by hue as well as by size.

```
scale 2.2 → 6.4        (1.64 u wide, spanning the roof plate almost exactly; lens discs 0.55 across)
position (0, 1.22, −0.18) → (0, 1.48, −0.55)      rotation.x 0 → −0.50
stand posts: x ±0.16 → ±0.34,  0.12 long → 0.46 long
```

- **THE TILT IS THE WHOLE TRICK.** `gogglesMesh`'s lens faces look down local +z and a park camera looks DOWN at ~50°, so a sign left plumb shows the camera its brass rims **edge-on**. Tipped back 0.50 rad the two lens discs face it nearly square. (Verified: the 26° preview shows the cups from below, the 50° park shot shows two full lens discs — the park camera is the one that matters.)
- **IT STILL DOES NOT COVER THE SHOP.** After the tilt the lens centres land near y 1.80 / z 0.03, the pair occupies y 1.37…2.10, and the front-most geometry stops near z 0.2 — just past the roof fascia at 0.16 and well short of the counter nosing at z 0.50. Nothing new hangs over the grinder, the gauges or the lens tray, which is this component's founding rule (*"a full-depth roof turns the whole shop into a lid"*) applied to its own sign. Footprint x ±0.82 is inside the measured ±0.95; the registered body (`hx 0.6 / hz 0.42`), the queue and the 0.72 u attach point are untouched.
- **`castShadow = false`** — a 1.6 u prop 1.7 u up would stripe the counter, and it saves 16 shadow-pass draws.
- **night-gated emissive, no new light.** Both PointLights here are at y ≤ 0.8 with a 2.2–2.8 range and BOTH gate fully to zero by day (this shop has no fire in it), so after dark the sign 1.8 u up gets almost nothing and the one thing that makes the shop findable would be the darkest object in frame. `mat()` never shares a material instance, so an emissive on the sign's own materials costs no light and no draw, on the same `ease` as the two lamps — **nothing here glows at noon.** **Tinted per part, not one warm hex:** a flat `0xffb050` on all 16 materials turned the sign into two plain yellow discs at night, brass/glass distinction gone. `mat()` bakes the colour into the texture and leaves `material.color` white, so a MAPPED material (all the brass) needs `emissiveMap = map` with a white emissive to glow in its own tint, while the unmapped lens glass copies its colour. Same texture object, so it costs nothing. Peak **0.22**.

**MEASURED COST: +0 colour draws, −16 shadow draws, +0 triangles.** 172 → **172 meshes**, 171 → **155** shadow-casting meshes, 9 752 → **9 752** tris — the same 16-mesh `gogglesMesh` recipe as the worn pair and the three display pairs, a fourth scale, only the numbers changed, and turning the sign's shadow off makes the shop CHEAPER than before (probe: mesh/shadow/triangle census of the built group, working tree vs `3f9e83c461`, `withGuest: false`).

## Exports

- `<GoggleWorks position rotation scale withGuest effects register pinned name price value>` — built on `<ConfigurableStall>` via `composableStall`. Inside a `<Park>`, `register` registers a selling `'wearable'` stall with the GameManager (defaults: **The Goggle Works, price 4, value 6**). `withGuest` adds a decorative browsing peep — already wearing a pair, mounted on the same `headSlot` the manager uses. `effects` (default true) toggles the relief-valve steam.
- `buildGoggleWorks(t, { withGuest?, effects? }) → { group, update, dispose }` — the imperative builder.
- `buildWornGoggles(t) → THREE.Group` — the worn item recipe (below).

**NAME IT:** `register={{ name: 'Brasswork Optics', price: 4, value: 6 }}` — the manager keys `moveStall`/the corridor resolver on the name.

## The WORN goggles (`buildWornGoggles`) — head slot, not hands

`buildWornGoggles(t) → THREE.Group` is the shop's own 3D item, registered as `StallConfig.heldItem` on an `item: 'wearable'` stall. The manager parents the clone to the peep's **`headSlot`** (Guest/Context.md — a group on the CROWN of the skull, head-local `(0, 0.10, 0)`, `+z` = the face, skull r 0.12), so it rides every nod, mood tilt and head bob, cannot be lost when the guest is hidden in a hut or seated on a ride, and costs nothing per frame. A wearable is never eaten, never binned, never littered, never flown away: +12 happiness at purchase (cheap-joy, like a balloon) and then it is simply KEPT.

The mesh: two domed glass lenses in stepped brass rims with polished bezels, leather face gaskets, a riveted nose bridge, a brass focus knob per cup, leather side tabs with brass buckle plates and pins, and a leather strap around the skull with its brass adjuster slider.

**The offsets, and why.** Goggles sit on the BROW, not on the crown, so the recipe carries its own offset (`BROW_DROP`):

```
position (0, −0.068, 0.012)   rotation.x −0.08
```

which puts the lens centres near head-local y 0.03, z 0.10 — the skull surface at that height is z ≈ 0.116, so the leather gaskets press into the face and the bezels stand just proud of it: on the brow, not through the skull, not hovering.

**The strap needs its own frame.** A band centred on the *goggles* is not concentric with the *head*: at 0.118 radius it disappeared inside the skull entirely in the first pass. It now lives in a sub-group pushed back up to the SKULL CENTRE (`STRAP_TO_HEAD`, the exact inverse of `BROW_DROP`, so the two can never drift), as a **partial torus** (radius 0.126, arc 4.4 rad) whose `rotation.z` spins the gap round to the face where the cups are, with a small x-tilt so the band rides up over the back of the skull. The adjuster slider sits in a second skull-centred sub-group at head-local `(0, 0.02, −0.126)` — placed inside the strap group's offset frame it flew off the back of the head.

Verified on real sim wearers, front/profile/body (`/tmp/mp3d-render/shots/closeup-goggles-real*.png`), including one who kept the pair through a ride. See components/GameManager/Context.md → "Wearables" and "Per-stall held items".

**One recipe, four scales.** `gogglesMesh` builds the goggles once (peep-local units, origin between the lenses, `+z` = face) and is reused for the worn pair, the three hanging display pairs (~2× the worn size) and the roof sign (**6.4×** since 2026-07-28; it was 2.2× — see below) — so the shop is literally displaying the article it sells.

## Palette

SetPieceKit's `BRASSWORK_FOUNDRY` theme: soot-grey iron `0x554533`, muted brass `0xa8863f` / `0xc7a962` / `0x7a6030`, oxidised copper `0x7d4a2e`, verdigris `0x3f6050`, oiled leather, warm gaslight `0xfff0cc` / glow `0xffb050`. **No garish gold** — brass reads as metal through roughness and rivet detail, not saturation.

**Metalness caution (learned in the harness):** a `MeshStandardMaterial` at metalness 0.6+ with no env map renders almost black, because metals are lit only by reflections. Every metal here sits in the 0.2–0.35 band; the first pass at 0.55–0.72 rendered the brass as dark brown.

## Budgets

2 real PointLights (the gaslight + a counter fill, both night-gated — this shop has no molten anything, so both go fully dark by day), 26 particles (the relief valve's steam, released ABOVE the roof so it does not puff into the underside of the plate), rivets/gauge ticks/patina/engraving batched through `mergedBoxes` and tagged `userData.lodDetail`. Deterministic — hashed sines only; the updater takes ABSOLUTE time and drives the grinding wheel (geared 3.2 : 1 to its flywheel, with a slow hashed duty cycle), the three gauge needles and the swing of the display pairs.

## Previews

1. **Selling goggles (live sim)** — a miniature `createGameManager` on a path loop with the stall registered at the counter front (anchor `[0, 0, 0.1]`, front z 0.82), pre-warmed 90 sim-s so several pairs are already being worn on the first frame, then 2× time: the wearable joy-buy impulse fires on aimless wanderers, they step up, buy, and keep walking with the goggles on.
2. **3D rig** — `<GoggleWorks withGuest>` in `<ScenePreview distance={4.4} targetY={0.8} autoRotate={false}>`.

## Modelling note

The roof deliberately covers only the BACK of the counter (z −0.56 … 0.16). A full-depth roof turns the whole shop into a lid at the isometric camera elevation and the grinder, gauges and lens tray vanish underneath it — which is also why the gauges moved off the back bracket onto the front panel.

## Audit — 2026-07-25, 100/100

| Dimension | Score | Notes |
|---|---|---|
| Mesh richness & count | 15/15 | **172 meshes / 9 752 tris** (203 / 13 592 with the browsing guest); the worn item is **18 meshes / 1 400 tris**; 21 `lodDetail`; rivets, gauge ticks, patina and engraving batched; determinism MATCH |
| Detail | 15/15 | tex+bump throughout; the mechanism is modelled and visible (treadle-driven grinding wheel geared 3.2 : 1 to its flywheel behind a flat leather belt, three live gauges, a venting boiler); 2 night-gated PointLights, 26 particles released ABOVE the roof; **max metalness now 0.34** — it was 0.75 (below) |
| Cohesion | 20/20 | the kiosk's footprint is x ±0.95, y 0..1.35, z −0.59..0.53 measured meshes-only; in the live world its pad sits at 1.32 u off the walked centreline and clears `lintPadOffLattice`'s 1.20 margin — **no `padNearStreet`, no `padOnStreet`** in the park probe |
| Guest comfort | 15/15 | the WEARABLE probed in the peep's own head-local frame — 77 % of 2 939 goggles vertices proud of BOTH the skull sphere and the hair ellipsoid, strap **147/147** proud, adjuster **24/24** proud, and **zero** vertices inside the nose ball, the female back hair or the ponytail. Full table below |
| Guest location | 15/15 | in the live world park **10-11 of 58 guests are wearing "Brasswork Foundry Optics" goggles** at any moment, they keep walking afterwards (longest still-while-walking: none), and the pair rides the head slot through a ride |
| Aesthetic | 20/20 | reads as a steampunk optician at the 50° park camera and on the world's frontage (`shots/aud/BF3-park-close.png`); the 3D-rig preview was reframed so the shop is no longer its own roof (below); night lights the counter and the gaslight and goes fully dark elsewhere, which is right — this shop has no fire in it |
| **Total** | **100/100** | |

Probes: `/tmp/mp3d-render/aud-brass-worn.tsx` (the wearable, in head-local space, over six poses),
`aud-brass-geom.tsx` (metalness census, meshes-only footprint), `aud-brass-facts.tsx`,
`aud-brass-park.mjs` (worn count in a live 58-guest park).
Shots: `shots/aud/GW3-rig-day.png`, `GW2-rig-night.png`, `GW-rig-{a115,e50}.png`, `GW2-sim.png`.

### The wearable, measured

`buildWornGoggles` was parented to a REAL `buildPeep().headSlot` and every vertex of every part was
pushed into head-local space and tested against the skull (r 0.12 at the origin), the hair ellipsoid
(r 0.128 scaled 1.02 / 0.72 / 1.02 at (0, 0.04, −0.012)), the nose ball and — for a female peep — the
back-hair ball and the ponytail:

| part | verts | proud of skull+hair | inside the skull | deepest |
|---|---|---|---|---|
| lenses (Icosahedron r 0.043) | 960 ×2 | 776 (81 %) | 107 | 6.5 mm |
| bezel rings | 88 ×2 | 78 (89 %) | 6 | 5.2 mm |
| cup barrels | 88 ×2 | 48 | 36 | 29.7 mm |
| leather gaskets | 88 ×2 | 24 | 60 | 41.8 mm |
| nose bridge | 24 | 6 | 12 | 21.4 mm |
| **strap (Torus r 0.126)** | 147 | **147 (100 %)** | 0 | 0.0 mm |
| **adjuster slider** | 24 | **24 (100 %)** | 0 | 0.0 mm |
| buckle plates / tabs / focus knobs | 24-88 each | 18-78 | 3-6 | 0.5-6.1 mm |

That is the intended reading, not a compromise: the **gaskets and the inboard half of each cup are
supposed to be buried** (a gasket presses into the face — its deep vertices are the ring's inboard
edge, at radius 0.081), and everything a viewer sees — lenses, bezels, knobs, buckles, strap, slider —
stands proud. **Nothing enters the nose, the back hair or the ponytail on any pose.**

The numbers are **identical under nod +0.25 / −0.20, mood tilt 0.18 and a 0.6-rad head turn**, because
the item is parented to the head: one measurement covers every pose, which is the point of the head
slot. Confirmed live: 10-11 wearers on the paths of the world's own 58-guest park, all still walking.

### Fixed this pass

**1. Two meshes were at metalness 0.75, in a file whose own rule is 0.2-0.35.** `gogglesMesh`'s brow
rivets + buckle pins and the nameplate engraving. This Stage has no env map, so 0.6+ renders
near-black — and because `gogglesMesh` is the one recipe behind the worn pair, the three display pairs
and the roof sign, the near-black was on the shop's signature article. Both are now **0.33**, matching
the bezel ring next to them. Census after: **max metalness 0.34, clean**. Found by measuring every
material in the built group, not by looking — the affected meshes are 6-14 mm across.

**2. The 3D-rig preview showed the roof.** With no `dress` it took `ScenePreview`'s default pose,
measured at **50.8° of elevation and 4.44 u** out, and from up there the shop is its own back-half
roof plate: the grinding wheel, the three front gauges, the lens tray and the counter — everything the
"Modelling note" above exists to keep visible — were a sliver under the eaves, and the kiosk stood on
open grass. The preview now sets **26°** on the serving front and stages the same sooted foundry apron
`AetherBalloons` and `GearworksExpress` use. All of it reads in one frame: `shots/aud/GW3-rig-day.png`.

**…and then pulled BACK on 2026-07-28 for the hero sign** (`distance 3.5 → 4.7`, `targetY 0.55 → 0.9`,
camera `[1.55, 2.05, 2.75] → [2.1, 2.9, 3.75]`). The 26° pose is kept — it is the only shot that gets
under the roof line — but at 3.5 u out the giant goggles (1.64 wide, topping out at y 2.10) were cropped
off the canvas. The camera moves straight out along the same ray, so the elevation is unchanged at ~25°
and the grinder, the gauges, the lens tray and the counter are all still in shot.

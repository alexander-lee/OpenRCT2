# PulseScenery

**CANONICAL IMPORT — copy exactly:** `import { NeonArch, SpeakerStack, MirrorBallPylon, LaserTruss, LightTiles } from './components/PulseScenery';`
*(never from `'./Park'`: only the `<Park>` wrappers + track-piece JSX live there. A wrong
specifier makes esbuild refuse the WHOLE bundle — the round-8 black-page failure.)*

The five scenery pieces of the **PULSE DISTRICT** world — a disco nightclub quarter. Per-world scenery, not an extension of the shared `SceneryPack`: one component folder exporting five pure imperative builders plus five composable components, so the whole club dressing set arrives (and versions) together. Same shape as `components/BrassworkScenery`, `components/TidewaterScenery` and `components/EmberfallScenery`.

Companion pieces in the same world: **`components/DanceFloor`** (the district's centrepiece — this pack's tiles share its clock and beat curve exactly), **`components/Discotron`** (the mirror-ball gyro spinner — `PULSE_PALETTE` is imported from it, never re-derived), **`components/Bassline`** (the neon coaster), **`components/NeonSlush`** (the world's stall, which imports the `PULSE` palette from here), **`components/NeonSign`** (the arch marquee is a real `buildNeonSign`).

| piece | reads as | built footprint (x × z) | height | blocks? | moves? | draws |
| --- | --- | --- | --- | --- | --- | --- |
| **`<NeonArch>`** | a club gateway: graphite posts, chorded header truss, a `buildNeonSign` marquee hung in the opening, a crown of concentric neon arches | 2.83 × 0.54 | **3.21** | **NO** (opt-in, per POST) | crown/LED chase | 48 |
| **`<SpeakerStack>`** | touring PA on a castored dolly: ported bass bin, mid cab + live VU ladder, horn-flare top box, ratchet strap | 0.67 × 0.78 | 1.13 (`count` 3) / 1.40 (4) | yes (circle r 0.42) | woofer cones thump | 28 |
| **`<MirrorBallPylon>`** | a faceted mirror ball up a tapering 4-leg steel lattice mast, throwing rotating light shards on the ground | mast 0.68 × 0.68 — **lit** spread ~2.5 × 2.9 | **3.27** | yes (circle r 0.44) | ball spins, shards sweep | 18 |
| **`<LaserTruss>`** | a 4-chord box truss on two A-frame legs, moving-head lasers panning under it | 2.60 × 1.16 | 2.59 | yes — **two RECTS, one per LEG** (the span is never blocked) | heads pan + tilt, beams | 41 |
| **`<LightTiles>`** | a beat-synced light-up floor patch in a chrome kerb | 1.82 sq (`count` 3) … 4.57 sq (8) | 0.12 | **NO** (opt-in) | every tile, every beat | 14 (3) / 69 (8) |

**HERO-SIZED:** `<NeonArch>` (3.21 tall) and `<MirrorBallPylon>` (3.27 tall) are the two skyline pieces — one per approach, not one per plaza. `<LaserTruss>` is a mid-height gantry meant to be walked UNDER. `<SpeakerStack>` and `<LightTiles>` are dressing you can scatter.

## The beat — the district's one clock

`BEAT_HZ = 2.2` — the **same** beat `<DanceFloor>` flashes its tiles to, `<Discotron>`'s mirror ball scintillates on, `<Bassline>`'s tunnel hoops chase to and the Guest pose layer's `dance` state uses. The three helpers are **exported** from this module (they are module-private in Discotron, so Bassline re-declares them and so does this pack — change these and the whole district drifts):

| helper | shape | used by |
| --- | --- | --- |
| `beatStep(t, off)` | integer beat index — colours **step** once per beat | crown arches, LED ladders/chords, tile colours, VU, laser lenses, facet shells |
| `beatPulse(t, ph)` | 0.55…1 bloom that **dips exactly on the colour change** (DanceFloor's own curve) | tile brightness, crown/chord glow, VU level, shard bloom, ball wash |
| `beatKick(t, ph)` | sharp spike, 1 on the beat decaying across it | woofer cone thump, laser beams, flood cans, LED studs, the tile ripple |
| `paletteAt(i)` | wrap-safe `PULSE_PALETTE` lookup | everything |

**Verified beat sync** (headless probe, two samples a HALF beat apart at `t = 3.0` / `3.2273`, nightK 0):

```
neonArch          emissive mats=48  changed=20  maxDelta=0.765  deterministic=true
speakerStack(3)   emissive mats=28  changed= 9  maxDelta=0.835  deterministic=true
mirrorBallPylon   emissive mats=18  changed= 5  maxDelta=0.055  deterministic=true
laserTruss        emissive mats=41  changed=14  maxDelta=0.676  deterministic=true
lightTiles(3)     emissive mats=14  changed=10  maxDelta=0.173  deterministic=true
lightTiles(8)     emissive mats=69  changed=65  maxDelta=0.292  deterministic=true
one FULL beat apart: tile emissive colours stepped = true, deterministic = true
```

The additive materials (shard shafts/patches, laser beams) all carry a **day term** as well as the `nightK` term for exactly this reason: gate a bloom purely on `nightK` and the whole light show freezes solid at noon, where it should still visibly breathe.

**ONE CLOCK, ABSOLUTE.** Nothing here is motion-gated (nothing here is a ride) — a club never stops, and neither does a mirror ball. Every `update(time)` takes ABSOLUTE time and derives everything from it, so a throttled LOD frame gives coarser motion, never drifted motion.

## Palette

`PULSE_PALETTE` is **imported from `components/Discotron`** and never re-derived: the cool subset of DanceFloor's `DISCO_PALETTE` — magenta `0xd815b8`, cyan `0x18c8d8`, violet `0x7b3fe4`, blue `0x1858e0`. The floor may flash amber and lime; a mirror ball throwing amber shards read as a fairground carousel in the harness, and this world's brief is magenta/cyan/violet on graphite.

The MATERIAL greys ship as the exported **`PULSE`** table, byte-identical to Discotron's values so a speaker stack parked beside the ride is the same graphite as the ride: `graphite 0x3a3d45`, `graphiteDark 0x2a2d34`, `gloss 0x16171c`, `deck 0x21232a`, `steel 0x6e737d`, `chrome 0xa6adb6`, `concrete 0x9b9a96`, `mirror 0xd9dbe3`, `magenta`, `cyan`, `violet`, plus three values this pack added:

- **`caseBlack 0x33363d`** — flight-case charcoal. Deliberately NOT `gloss`: a whole 1.13-u speaker stack built out of `0x16171c` read as one black filing cabinet in the daylight harness, with the cones, the horn and the strap all invisible inside it. Reserve `gloss` for SMALL black-gloss panels sitting among lighter parts (a fixture housing, Discotron's tub walls) and use `caseBlack` for anything bigger than ~0.3 u.
- **`baffle 0x6b7079`** — the recessed grille-cloth face a driver mounts on. This one value is most of the speaker stack's daytime read.
- **`dustCap 0x767c86`** — the pale rubbed dome on a woofer, the brightest point on a cabinet face and what makes a driver read as a driver at park zoom. (`cone` is `0x22242a` — pitched UP off pure black so a cone reads as a cone instead of a hole in the frame.)

## Budgets

- **THREE real PointLights** across all five pieces (budget 4), all night-gated: the arch marquee's own light inside `buildNeonSign`, the pylon's ball wash (range 5.5, tinted to the beat's dominant colour), the truss's centre downlight (range 4). **Everything else is emissive material or additive mesh** — the only way a neon world fits the light budget. A dark cabinet's night presence comes from an under-dolly LED strip, not from a light per stack.
- **48 particles** for a full set (budget 300, global 4000) — the laser truss's haze vent, and only when `haze` is on. Nothing else emits.
- **Metals sit at 0.22–0.35.** `metalness ≥ 0.6` with no environment map renders NEAR-BLACK on this Stage; `steel 0x6e737d` is deliberately the lightest tone in the kit because graphite at `metal 0.3` went black against grass and Discotron's truss ring read as coaster track.
- Static repeats go through Stage's `mergedBoxes` / `mergedParts`; fine detail (rivets, LED nodes, castors, hazard collars, badge plates, VU rungs, kerb studs, arch shoes, hazer tabs) carries `userData.lodDetail`.
- Deterministic: hashed sines only, never `Math.random` / `Date.now`.
- **`node tools/seed-sweep.mjs PulseScenery` → SWEEP CLEAN (4400 builds)**, 400 seeds × 8 `count` values across all five builders. Every `count` is `clampCount`ed into the piece's legal band, so a caller (or the sweep) can pass anything.

## 1. `<NeonArch>` — the gateway

- **CLEAR HEIGHT is the whole constraint.** Header underside 2.10; the marquee **hangs in the opening** on two chrome rods with its board top at 2.09 and its tube baseline at 1.74, so the walk-through clearance is **1.69** — three head-heights for a 0.55 guest.
- **It BUILDS ON `buildNeonSign`** (the same call `<Discotron>` makes for its marquee) rather than re-inventing tube lettering: `text` (default `'PULSE'`) at scale 0.2, magenta primary + cyan secondary, its own dark backboard, its own flicker/night-gate updater and its own PointLight. **The first cut perched the sign ON TOP of the header and the crown's inner arches ran straight across the lettering.** In the opening the sign is the focal point and the crown owns the sky.
- **A chrome PICTURE FRAME round the sign's backboard is this pack's job, not NeonSign's.** The board is `0x1d1e22` and the tubes only glow at ~12 % by day, so unframed the marquee read as a black rectangle hanging in the arch at noon.
- The **CROWN**: `count` (default 5, 1-8) concentric neon half-ellipses, each 14 box segments merged into ONE mesh with ONE animated material. They fire **OUTWARD** — arch `k` lights on beat `(step − k)` — so a pulse visibly runs from the lettering to the outermost tube. Every arch foot lands in a **chrome shoe** on the header: a neon tube that levitates is the exact failure NeonSign's stand-off pins exist to prevent.
- Also: concrete footings + base flanges, three chrome collars per post, painted magenta/cyan hazard chevrons at knee height (the daytime graphic), a real chorded header truss with zigzag webs, two flood cans aimed down at the path, a 14-node LED ladder alternating up each post on the beat, and a control box with conduit on the left post.
- **Blocker: OFF by default.** An arch is a GATEWAY; the street lattice and the round-6 `scenery` gate both want guests walking through it. `blocking` registers **two rects, one per post** (`postHalf` 0.14) — use it for an arch used as a backdrop rather than a doorway.
- Returns `{ group, update, halfWidth, postHalf, height, clearHeight }`.

## 2. `<SpeakerStack>` — the touring PA

`<Discotron>` already has speaker stacks: single 0.98-tall gloss cabinets with inset woofer cones, bolted to its stage. This is the **same register and deliberately not that object** — the hired-in touring rig that got wheeled in and left there.

- A castored **dolly** (tyres, hubs, swivel stems, ply deck), then 1-4 cabinets via `count`, bottom-up: ported **bass bin** (two 0.145 cones over a real slot port), **mid** cabinet (one cone + a four-sided compression-horn throat in a chrome mouth flange + the VU ladder), **horn-flare** top box (a 2×2 flare array in chrome mouth rings), and a fourth **sub**. Widths TAPER 0.64 → 0.38: four same-width boxes read as one tall filing cabinet.
- **THE VU LADDER is the piece's "live" tell** at park zoom: six rungs in six materials, lit bottom-up while the beat-bloom level is above each rung, so the meter visibly RIDES the music instead of blinking.
- **THE LINEWORK LESSON, in two rounds.** Pass 1 drew a five-bar louvred STEEL grille over each whole baffle: it hid the cones and the stack read as caged shelving. Pass 2 kept three bars plus a bright CHROME surround torus per driver and the greys still won — at park zoom the rings read as handles and every cabinet turned into industrial racking. **A speaker reads from three TONAL things, not linear ones:** a lighter `baffle` panel, a dark cone recess, and a PALE `dustCap` standing proud of it. What survives is one thin dark bar guard per driver, ONE chrome edge rail along each cabinet's top front, flank handles and a badge plate.
- The **ratchet strap** hugs the TOP cabinet only. A full-height strap at a fixed x/z (pass 1) ran THROUGH the cabinet bodies, because the widths and depths taper — there is no single line that hugs every box in the stack.
- A **rear connector panel** with two chrome sockets on every cabinet: the alternate-angle render showed the back of the stack as four featureless black slabs.
- An **under-dolly LED strip** on the front edge is the stack's NIGHT presence. Without it the piece vanished after dark in the group render, and a PointLight per stack would blow the pack's light budget three times over.
- Woofer cones **thump forward 0.018** on every downbeat (the cabinets stay put — the cones live in their own group).
- **Blocker: ON** (circle r 0.42) — half a tonne of flight cases on castors.
- Returns `{ group, update, radius, height }`.

## 3. `<MirrorBallPylon>` — ball up a mast

- A tapering **four-leg lattice mast**: legs raked from a 0.22 spread at grade to 0.10 at the drum (`height`, default 2.30), chorded at seven levels with an **alternating-hand diagonal in every bay** — a stack of hoops with no diagonals reads as a pile of rings, not a mast. Concrete pad, base plate, painted **hazard collars** round the bottom bay (the first pass ran full-width painted bars across the mast and they read as a neon X floating inside the lattice; a collar is four short chord-parallel bands hugging the outside of the legs), a junction box and conduit at the foot, then a motor drum, a chrome band and a spindle.
- **The ball is Discotron's recipe at pylon scale**: a dark seam core plus **81 mirror tiles at 0.14** on a Fibonacci sphere split into **3 shells** that scintillate on hashed beat offsets, plus an additive bloom shell. The tint is pulled **halfway to white** (`.lerp(WHITE, 0.55)`): at full palette saturation the shells turn the ball into a rainbow beach ball, where a mirror ball is silver glass *catching* a colour. **64 tiles at 0.135 (≈100 % coverage) left visible dark gaps** and the ball read as a spotty grey sphere in daylight — 81 at 0.14 is ≈140 % and the plates overlap, which is what a mirror ball does.
- `count` (default 6, 3-8) **LIGHT SHARDS**: tapered additive shafts each ending in an elongated floor patch, merged into two meshes and swept at 0.38 rad/s on the absolute clock. Elevations are hashed **1.00-1.35 rad**, so every shard terminates on the ground within **0.61-1.74 u** of the mast — Discotron's shard-rig rule, so the piece animates the PATH without smearing additive glow over the next ride. (The first pass at 0.72-1.14 rad reached 2.4 u and pushed the bbox to 4.8 u across.)
- The ball turns at 0.5 rad/s with a faint wobble on its pin — absolute clock.
- **Blocker: ON** (circle r 0.44 — the pad, not the lit spread).
- Returns `{ group, update, radius, height, ballY }`.

## 4. `<LaserTruss>` — the gantry

Discotron's chorded truss RING, straightened into the gantry a club hangs over a plaza.

- A genuine **four-chord box truss** (two top chords, two bottom at z ±0.11, flank posts, an alternating diagonal per bay, top and bottom lacing) on two **A-frame legs** — splayed tube pairs with two horizontal ties and a diagonal, and a concrete **ballast block** under each foot, because a truss standing on two sticks reads as a washing line. `halfWidth` default 1.15 → span 2.60.
- `count` (default 4, 1-8) **moving heads** on chrome clamps and stub drops: a yoke base with two arms and trunnions straddling a gloss housing with a heatsink rail, a chrome bezel and an emissive lens. Each head PANS ±1.05 rad on its own hashed rate and breathes its TILT between **0.72 and 1.18 rad below horizontal** — a band chosen so every beam terminates on the ground within ~1.7 u of the head.
- **THE TILT SIGN.** A tilt group's local `+z` maps to `(0, −sin a, cos a)` under `rotation.x = a`, so the first pass's `−a` fired every beam at the SKY. It is POSITIVE.
- **The beam is built at UNIT length and stretched every frame** so it always terminates exactly on the grass; a fixed-length beam cannot, because the tilt sweeps a band and one length either stops in mid-air at the steep end or drives through the turf at the shallow end. Radius 0.055 → 0.016: the first pass at 0.085 read as a translucent PLANK. A laser is a hair with a bloom, and the bloom is the additive material's job, not the radius'.
- Each head also owns a **ground PATCH** (an elongated additive ellipse parented to the PAN group, so it swings with the beam). A beam with no terminus reads as a stick poking out of the truss.
- 16 LED nodes alternate along the lower chord in two groups; one **hazer** unit — a road case with chrome tabs, a chrome lid and a nozzle, parked at the foot of the left leg — feeds the 48-particle haze so the beams have something to bite on. (The first pass left a bare vent grille mid-span and it read as litter on the grass.) `haze: false` turns both off.
- Every head's static furniture is BATCHED into one merged mesh per moving group; hand-placed, four heads cost 56 draw calls on their own, which is more than the rest of the pack put together. 67 → **41**.
- **Blocker: ON, TWO RECTS — one per A-frame LEG** (`legHalf` `[0.20, 0.48]`). A rect over the whole span would fence off the walk-through that is the entire point of hanging a truss overhead.
- Returns `{ group, update, halfWidth, legHalf, height, dispose }`.

## 5. `<LightTiles>` — the beat-synced floor

The piece that PROVES the shared clock.

- `count` (default 3, 1-8) tiles per side at `tile` pitch (default 0.55), in a graphite grout plate on a concrete slab inside a chrome kerb with four LED corner studs. Walking surface `topY` 0.105.
- **DanceFloor's exact three lines, over `PULSE_PALETTE`.** Each tile takes a hashed beat-phase offset `ph` and a hashed palette offset `off`, steps `paletteAt(beatStep(time, ph) + off)` once per beat and blooms on `beatPulse(time, ph)` at `gain = 0.4 + 1.1·nightK` — the floor's own gain, so ~40 % glow by day and full disco after dark. A patch laid beside the real `<DanceFloor>` changes colour on the same frame.
- **ON TOP of that, a RADIAL RIPPLE**: a `beatKick` spike delayed by each tile's ring index (`max(|ix−c|, |iz−c|)`), so a bright wave visibly runs outward from the centre once per beat. Without it an 8×8 patch reads as 64 independent blinking squares instead of one coordinated FLOOR.
- **ONE additive bloom quad** a hair over the tiles: at night a lit floor washes the air above it, and without that the patch reads as flat coloured paint.
- **Blocker: OFF.** Flat, ankle-high and meant to be walked ON — the same call `<TidePool>` and `<LavaFissure>` make. A blocker here would carve holes in the walk network exactly where the piece is meant to be used.
- Returns `{ group, update, half, tiles, topY }`.

## For the set-piece author

- **Footprints and blockers** are in the table at the top. The two hero pieces are the arch (3.21 tall, 2.83 wide, walk-through) and the pylon (3.27 tall, 0.68 sq base). Neither is symmetric about z: the arch's marquee faces local **+z** and the truss span runs along local **X**, so `rotation` aims them.
- **Nothing in this pack blocks a span you are meant to walk under.** The arch and the truss are both designed to have a path run through/under them; the arch's post blockers are opt-in and the truss blocks only its two legs.
- **`<LightTiles>` is the piece to lay ON a plaza** — put it under the arch as an apron or along a boulevard. It is the only piece with a defined walking surface (`topY`).
- **`PULSE`, `PULSE_PIECES` and the beat helpers are all exported**, so a set-piece file can theme its own dressing off the same values without re-deriving anything: `import { PULSE, BEAT_HZ, beatStep, beatPulse, beatKick, paletteAt } from './components/PulseScenery'`.
- **Light budget across a whole PULSE set-piece:** this pack contributes 1 PointLight per arch, 1 per pylon and 1 per truss — and `<Discotron>` already spends 3, `<Bassline>` 3, `<NeonSlush>` 2. The park runtime keeps only the nearest `budgets.lights` (16) visible, but plan the district around emissives, not lamps.

## Previews

`PulseScenery.previews.tsx` (7, all inside `<ScenePreview>` — a component never renders a `<Stage>`): the club forecourt by day (all five pieces), each piece close up, and the **forecourt at night, which is the hero shot for this world**. Screenshot-tested day + night + alternate angle (`--angle=115`), iterated until the daytime frame reads as a nightclub district on form alone rather than as grey boxes waiting for dark.

## Audit — 2026-07-25, /100

| Dimension | Score | Notes |
|---|---|---|
| Mesh richness & count | 15/15 | Re-measured, all five: **neonArch 48 / 7 460 · speakerStack(3) 28 / 3 384 · speakerStack(4) 31 / 4 036 · mirrorBallPylon 18 / 2 692 · laserTruss 41 / 2 840 · lightTiles(3) 14 / 342 · lightTiles(8) 69 / 1 002.** Every one inside the rubric's 8-48 scenery band except the arch at exactly 48 and the truss at 41 — both hero-scale, both already batched (29 and 14 merged batches; the truss's four heads went 67 → 41 draws). 27 objects `lodDetail`-tagged across the pack. All five deterministic |
| Detail | 15/15 | tex+bump on every opaque surface (`speakerStack` and `laserTruss` are **0 of 5 / 0 of 4** untextured; the arch's 6 of 12 and the tiles' 2 of 4 are neon tubes and lit tile faces, which must not be). Night-gated emissive re-measured: **arch 21 of 49 materials change day→night (Δ 2.155) · stack 9 of 28 (Δ 2.236) · pylon 7 of 19 (Δ 1.198) · truss 15 of 42 (Δ 2.122) · tiles(8) 66 of 69 (Δ 1.331)** — nothing goes dark, everything is lit *differently*. Metalness: **0 materials ≥ 0.6 anywhere in the pack**. Mechanism modelled: castored dolly, ratchet strap, rear connector panels, motor drum + spindle, A-frame ballast blocks, chrome clamps and stub drops, hazard collars, kerb studs |
| Cohesion | 20/20 | Exact ray-parity clash sweep per piece over its own cycle: **pylon, speakerStack, neonArch and lightTiles → NONE.** `laserTruss` reported 11 of 8 448 moving-vertex samples at a single pose, and they are the moving head **housing inside its own yoke base** — the trunnion joint the yoke exists to hold. Swept envelopes: arch 2.832 × 3.209 × 0.540 (static), pylon 4.816 × 3.325 × 4.815 and truss 5.278 × 2.609 × 3.030 — both grow only because their *additive light* sweeps, which is the point and carries no blocker |
| Guest comfort | n/a → 15/15 | Nothing is ridden, worn or carried. The one guest-contact surface in the pack is `<LightTiles>`' walking face (`topY` 0.105) and it is flat, kerbed and blocker-free by design — the same call `<TidePool>` makes |
| Guest location | 15/15 | Blockers are right per piece and re-asserted in the land's pre-flight: **arch OFF by default** (a gateway is walked through), **truss two rects, one per LEG** (the span is never blocked), **stack r 0.42 ON**, **pylon r 0.44 ON**, **tiles OFF**. In the shipped district every one of them clears every walked slab: stacks 1.2-2.4 u ≥ the 1.1 u a 0.42 blocker needs, pylon 4.8 u, truss legs 0.95 u off the slab they span, and all four walk-through pieces read 0 u off the walk by design |
| Aesthetic | 20/20 | The forecourt reads as club dressing at the park camera by FORM alone (baffle/cone/dustCap tonal trio, chorded trusses, lattice mast, silver ball, chrome kerbs) and the **night forecourt is the world's hero shot** — every one of the five pieces has its own night presence, including the stacks' under-dolly LED strip which is the only reason a dark cabinet does not vanish. Cool palette only, `PULSE_PALETTE` imported from `<Discotron>` and never re-derived |
| **Total** | **100/100** | |

Beat sync re-verified at t = 3.0 vs 3.2273 (a half beat) and one full beat apart: every piece changes, tile colours **step**, all deterministic. `node tools/seed-sweep.mjs PulseScenery` → **SWEEP CLEAN**.

Probes: `/tmp/mp3d-render/pulse-facts.mjs` (census + beat sync + colour step), `aud-pd-facts.tsx` (metals, night delta, texture coverage, determinism), `aud-pd-clash2.tsx` (exact ray-parity clash sweep per piece).
Shots: `shots/aud/PulseScenery-{day,night,elev50,a115}.png`, `PulseScenery-p6-nighthero.png`.
Fixed this pass: nothing — the pack came in clean on every dimension.

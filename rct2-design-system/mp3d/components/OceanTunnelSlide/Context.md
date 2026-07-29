# OceanTunnelSlide

**CANONICAL IMPORT — copy exactly:** `import { OceanTunnelSlide } from './components/OceanTunnelSlide';`
*(never from `'./Park'`: only the `<Park>` wrappers + track-piece JSX live there. A wrong
specifier makes esbuild refuse the WHOLE bundle — the round-8 black-page failure.)*

**Deepwater Chute** — attraction **3** of **TIDEWATER HOLLOW** (flagship `components/ReefRacer`, boat ride `components/DeepDrift`, dressing set `components/TidewaterScenery`): a **RAFT SLIDE down a translucent TUBE that runs through the lagoon**.

The station is at the **TOP** of the launch tower — you do not ride a slide from the bottom — so the queue climbs a switchback stair to the **launch deck**, boards there, and the raft goes straight into the tube: 4.4 units at 31.8° inside a glass shell on iron hoop ribs, clean through a **REEF BASIN** standing in the lagoon (water 2.2 deep, shoals of fish and kelp in it, god-rays coming down through the surface), out through the broken seaward wall where the pool spills into the sea, and down to the splash run-out. Then the **haul-back belt** takes the empty raft back up to the deck.

Built on the **shared spline machinery** like every tracked ride here: `compileTrackPieces` compiles the circuit, `buildRideSpline({ profile: 'flume' })` sweeps the flooded channel the raft actually runs in, and the tube is a **shell swept over the kit's own frames** — theming around the channel, not a second track system. The lagoon and the pool are both `buildWater` from `components/WaterTile` used exactly as it comes.

## The layout — "Deepwater Chute" (`DEFAULT_PIECES`)

Compiled at `start [0, 4.95, 0]` — **the tower head** — `heading −90°`, so the station straight runs along local −x and every compiled point has z ≤ 0, leaving the local **+z face** clear for the queue lane and both huts:

| piece | |
| --- | --- |
| `station` · `straight 0.4` | the LAUNCH TROUGH on the deck, y 4.95 |
| **`drop 4.4`** | **THE TUBE** — 31.8°, advance 10.52 |
| `straight 3.2` | the splash run-out, awash in the lagoon |
| `turnR 180 r3.4` | the turn at the foot of the tower |
| `straight 7.7` | the low return reach, back across the lagoon |
| **`lift 4.4`** | **THE HAUL-BACK BELT** — cleats and rollers, 31.8° |
| `turnR 180 r3.4` · `straight 1.2` | round the tower head and onto the station axis, landing **0.3 u short** |

**Compile numbers** (probe, `profile: 'flume'`): `ok=true`, `fatal=false`, design report **CLEAN — 0 violations**, worst clearance **3.53**, closure **closed with ZERO synthesized track**, 46 control points, **60.04 u** of arc, footprint **25.0 × 6.8**, summit y 4.95, base 0.55, peak plunge **32.0°** on the swept spline, and **zero console warnings**.

**Why an out-and-back and not a rectangle.** A slide is one long plunge and a way back up, so the layout only has two legs; the two 180° turns at r 3.4 put the return channel 6.8 units off the tube, which is what leaves room in between for the reef basin (radius 3.5) without either fouling the other.

## Pacing — the PACE TABLE

`t(u)` is built once from the profile's own pace (`1.15 + 3.4·max(0, −fwd.y)` free-running, **1.6** on the belt), then inverted by bisection, so the raft's pose is read straight off the gated clock. **`LAP = 45.09 s`**, which is what `rideDuration: 45` is set from.

The kit's own `run` is deliberately **not** used here, and the reason is specific: `makeGuardedRun` starts the vehicle at the FOOT of a long lift (`u0 = liftStart/N` whenever the lift is ≥ 8 frames). On this layout the lift is the LAST leg, so a registered ride would have parked its raft — and its four boarding guests — at the far end of the lagoon instead of on the launch deck. The table is also pure: the same clock always gives the same pose, which is what makes the screenshots reproducible and gives the previews `phase0`.

## THE TUBE — the signature

A shell swept over the spline frames (`buildTubeShell`): for each frame, a ring of 18 vertices about a point **0.30 above the channel centreline**, radius **0.82**. The trough floor is at −0.10 and its walls reach +0.18, so the shell clears the channel by 0.28 at the sides; a rider's head tops out about 0.80 above the rail against an inner crown at 1.12. It is placed off the **DESCENT WINDOW** — the last level frame before the plunge to the first level frame after it, plus 2.6 units of run-out — so any layout gets its tube in the right place.

**MATTE, and drawn LAST WITHOUT WRITING DEPTH.** Two decisions carry the whole picture:

1. **Matte** — roughness 0.55, metalness 0, no environment map. This system has de-glossed its water twice; a mirror-bright tube would have undone both passes in one component.
2. **`depthWrite = false`, `renderOrder = 4`** — a transparent shell that writes depth puts its NEAR wall in the depth buffer and everything inside the tube is then depth-rejected. The first pass had a beautiful empty tube and an invisible raft. The layering that works is:

| order | |
| --- | --- |
| 1 | the water sheets (`buildWater`, `depthWrite` off by design) |
| 2 | the swept channel and **the raft with its riders** |
| 3 | the tube's ironwork, the **fish** and the **kelp** |
| 4 | **the glass shell** and the god-rays |

so the shell TINTS what is inside it instead of hiding it.

Then: **hoop ribs** every ~1.45 units (16 merged plates each), four longitudinal rails (crown, keel and both quarters), and a **brass collar** at each mouth — the detail that says "you go in here".

## THE ONE RENDERING DECISION WORTH KNOWING — `drawAfterWater`

WaterTile's sheet is **~80 % opaque** by design and is drawn in the transparent pass, which means every OPAQUE object is drawn *before* it and gets veiled to a fifth of its contrast the moment it goes under the surface. The first pass put the fish, the kelp, the channel and the raft inside the water and lost all four.

`drawAfterWater(root, order)` flips them into the transparent pass at **full opacity** (`transparent` with `opacity 1` renders identically, just later; `depthWrite` stays on so the parts still sort against each other). It is applied to the swept channel, the tube's ironwork, the raft and its riders; the fish and kelp carry it themselves. **The water is untouched** — no re-saturation, no second shader, no gloss.

## THE REEF BASIN — the water the tube dives through

A rock pool **standing in the lagoon**: wall to ~2.9, water surface at `yBot + 0.45·(yTop − yBot)` = **2.53**, floor **2.2 units** under it, radius 3.5, placed on whichever frame of the plunge sits at that height (so it follows any layout). The tube enters through the air above the surface, runs ~3.5 units **through the water**, and leaves through the seaward wall **below the waterline**, where the wall is broken and the pool spills into the sea.

The pool's **floor is a tile grid**, not the smooth disc it started as, and the reason is in *Fixed 4* below: the tube dips under the floor's own level two units before it reaches the wall, and a disc cannot be cut.

## THE BORE — the hole through the reef

**`BORE_R = TUBE_R + 0.75`.** The reef is genuinely *bored*, and the opening is derived from the tube, never hard-coded twice: the shell (0.95), its hoop ribs (1.013) and the iron mouth ring (1.16) all clear it, and if the raft ever forces `TUBE_R` wider again the hole widens with it.

**The clearance is set by what a RIDER SEES, not by what fits — and that is the second time this bore has been rebuilt.** `TUBE_R + 0.30` fit, and it passed its own audit: worst rock-to-axis over the crossing **1.233** against the 1.25 invariant, nothing inside the bore, no rider point closer than 0.70 to rock. It still read as blocked. The shell is 40 % transparent, so reef standing 0.28 off the glass is drawn *through* the tunnel wall at full size and fills the view down the chute — from the raft the slide ran into a rock face and the riders looked like they were inside it. At **0.75** there is visible air all round the glass, the far end of the bore is open, and the reef reads as a tunnel cut through it instead of a plug resting on the tube (measured after: worst rock-to-axis **1.679**, and rock no longer appears in the rider-clearance list at all).

**Two probes own this, both in `harness/mp3d-render/`.** `probe-ots-profile.mjs` walks the crossing and reports the nearest rock station by station; `probe-ots-bore.mjs` sweeps the whole lap and measures every rider point against every mesh. Both use point-to-**triangle** distance, and both recover the axis from **the shell's own ring centroids** — `buildTubeShell` emits rings of `seg+1` vertices at exactly `TUBE_R` about the axis, so the centroids *are* the axis and the probe cannot drift from the component. Do not measure against the raft's path: it floats ~0.2 BELOW the axis, which quietly shifts every clearance by that much. The preview **“Down the chute (rider's eye)”** is the visual half of the same check — re-shoot it whenever the reef moves.

**The cut is by construction, not by inspection.** The wall, the pool's lining and the pool's floor are all rings/grids of merged boxes, so there is no boolean to subtract with — instead every box that comes near the tube is re-emitted by `cutColumns` as a 3 × 3 grid of columns, each keeping only the runs of height whose eight corners and centre are all clear of the tube's real axis polyline. Nothing emitted can reach inside `BORE_R`; the 0.11-unit slabs also leave the cut stepped and ragged, which is what broken rock round a bore looks like. Loose pieces (rim boulders, spoil) are tested **vertex by vertex** and dropped rather than nudged.

**The portal is what makes it read**, and all five parts are at BOTH ends of the pass-through:

| | |
| --- | --- |
| **throat** | a sleeve of the darkest rock in the palette, inner skin hashed 0.03–0.14 outside `BORE_R` so the bore is scalloped like something drilled |
| **cut rim** | 14 blocks of the *palest* rock, standing proud of each face |
| **arch** | five voussoirs and a keystone carrying the wall over the opening |
| **spoil** | boulders and rubble heaped at the foot of each mouth, thrown sideways, never in front |
| **mouth ring** | iron at `TUBE_R + 0.16` — glass → iron → a 0.09 shadow gap → cut rock, so the tube visibly *enters* |

**The mouth is read as a VALUE STEP.** At the park camera the whole portal is forty pixels across. The first tint pair (throat 0x554a3c, rim 0xa1957a) sat within a shade of the weathered reef around it and the hole simply vanished at distance; the shipped pair (**0x39312a** and **0xc0b498**) is deliberately the darkest and the palest rock in the component.

**The wall STANDS UP at the portal** — to the bore's crown + 1.10, ~0.9 above the pool's surface — and falls away to the broken lip beyond 2.6, so the pool still spills either side and the crossing reads as a headland with a hole driven through it. At +0.55 it topped out 0.12 above the waterline and read as a submerged shelf.

Everything in the portal is `drawAfterWater(…, 2)`: the pool-side mouth is 1.5 units under the surface and the seaward one stands in the lagoon shallows, and an 80 %-opaque sheet would have veiled the whole thing to a fifth of its contrast — the same failure that lost the fish and the raft in the first pass.

**2.2 deep is not a decoration.** The tube crosses at 31.8°, so every 0.1 of pool depth buys only 0.16 of submerged run: a shallow "shelf pool" gave the tube barely a unit inside the water, and there was no shot in it. Depth is the only lever.

The **SPILL straddles the portal**: the tube leaves through the same seaward arc the pool spills over, and six strands on the centreline hung a curtain of water straight down the face of the mouth. They now fall in two clusters 1.5–2.2 either side, off the broken lip the buttress rises out of, and the spray emitter sits at the left-hand cluster (still one emitter — the budget is 3).

**THE VIEWING SIDE IS LOW**, and that is the second hard-won number. A rock wall all the way round a 3.5-unit pool hides the water and the tube inside it from every camera that is not directly overhead (the same lesson DeepDrift's sea caves taught). The local **+z arc** — the queue and beach side — is capped level with the water, with small faceted rock along the lip because a kerb of flat-topped merged boxes reads as masonry; the rest of the ring stands 0.2–0.5 proud with 32 `buildRock` boulders over it.

Inside: a **pale** wet-sand floor (a light bottom is what makes water read as water), a rock lining, 9 kelp clumps standing on the floor and **breaking the surface**, and 2 fish shoals. **GOD-RAYS**: 8 additive shafts at opacity 0.06 — *narrow*, because the first pass used 1-unit-wide panels and they read as sheets of glass standing in the pool. The **SPILL** is six narrow strands over the broken lip plus a spray emitter, not three big sheets.

## Fish — `buildFishShoal(t, seed, opts)`

A shoal is **ONE merged mesh** and each fish is **three boxes** — body, tail fin, dorsal — because three parts is the minimum that reads as a fish rather than as a floating pill, and one shoal is one draw call. The shoal **GROUP** is what swims: a slow hashed circle about its own centre with a bank in the turn, on one absolute-time term, so nothing is skinned. Five shoals (2 in the basin, 3 in the open lagoon just under the surface), 13 fish each = **65 fish** in 5 draw calls, all drawn after the water sheet.

Liveries are natural — silver-blue `0x7b8f9b` and olive-gold `0x87794f`. The first pass at 0.2 units on pale colours read as a scatter of white bricks from above.

## The launch tower

Placed on the station frame, so it follows the layout. **LOCAL FRAME: +z is the direction the raft travels, +x is the queue side** — which means the deck runs **BACK** from the station, not forward. The first pass ran it 7.6 units forward and buried the whole tube and the top of the drop under a deck and its bracing.

* a plank **launch deck** (3.2 × 4.8) just under the rails, on joists and six braced legs, with **one** diagonal per bay on the two long faces and a sill beam across each leg pair — a full cage of diagonals under a 3-unit deck read as scaffolding and buried the stair behind it;
* railings all round except the **launch gate**, which is an iron frame with a lantern either side;
* the **dispatch hut**, and a painted **depth board** facing the queue;
* **THE STAIR** — four switchback flights and four landings up the queue face at local x ≈ 2.75, deliberately clear of the ride's own entrance hut (which stands on the sand at local x ≈ 0), with raked handrails and its own legs;
* a stack of spare rafts at the foot.

## Sim wiring (verified headlessly)

Capacity **4** = the four seat pads, set evenly round the raft's ring so riders face outward, which is what a round raft does. REAL GameManager guests board **4/4 distinct** live anchors through `seatWorld` (`makeSeatWorld` over anchors parented into the raft; decorative riders default true standalone / **false when registered**). The raft, the channel water, the basin water and the splash are wrapped in `createMotionGate` (`spinDown: 1.6`): parked drift **0.0000** through `waitingForPassengers`, **4.28** units of travel on `departing`, `invalid=false`. **The SEA is NOT gated** — the lagoon, the waterfall and the shoals run off the real clock outside the gate, so a parked ride is not a frozen ocean. Un-registered previews are byte-identical: the gate starts ungated until the first `onStateChange`.

**Park layout** (`ACCESS`, declared at the TOP of `index.tsx` and published on the group as `userData.access`): queue HEAD **7.0** out the local +z face, exit hut **derived** one 1.2 u tile along that face from the entrance hut (`layout.exit` is a SIDE HINT only — `[2.0, 2.2]` just means "the −x cell first"), boarding at **[−1.3, 5.0, 0]** — on the LAUNCH DECK. An elevated boarding anchor is legal because GameManager *seats* guests at the boardPoint and they never walk to it (`GameManager/registry.ts:76`, `rideFsm.ts:160`); the lane, both huts and the boardPoint's own footprint pad all stay on the ground. Defaults: name "Deepwater Chute", capacity 4, rideDuration 45, intensity 6, price 5.

**`front` is 7.0 where the catalog runs 2.1–4.4, and that is not a typo — see “Fixed 5” below.** This ride brings its own sea, and <ConfigurableRide> seats the lane and both huts on the PARK's terrain, so the access has to start out past the lagoon's shoreline. It cannot go much further either: past the dry spit (`z ≤ 9.0`) the apron crest climbs to `SEA + 0.055` and would bury a hut.

## Budgets (measured headlessly)

**235 meshes / 119,476 tris**, **2 PointLights** (of the 4 allowed — the deck and the stair, **both night-gated**, plus emissive-only lantern glass), **3 ParticleKit emitters / 240 particles** (splashdown 100, drifting mist 70, waterfall spray 70). Every static repeat batched through `mergedBoxes` (sand apron, dunes, litter, basin wall, lining and floor, the bore's throat, rim, arch and spoil, tube ribs and rails, tower frame, deck, railings, stair, cleats and rollers) and the two mouth rings through `mergedParts`; fine detail (litter, small reef rock, lip rock, spoil, raft lashing, kelp) tagged `userData.lodDetail` — **44** tags. The basin's rock carries `userData.reefRock` so the bore audit can tell rock from theming: Stage's `mat` bakes the colour into the texture and leaves `material.color` white, so the palette is not recoverable from the material and guessing by triangle count is how a probe silently stops testing the thing it was written to test. Deterministic — hashed sines only, one absolute-time updater.

The lagoon is ONE `buildWater` sheet round the footprint (`amp 0.22 × waviness 0.85` → ±0.056 of swell), surface at **groundAt + 0.62** so the run-out trough is genuinely awash and the raft floats out of the tube into open sea. Its turquoise read comes from a **pale coral-sand bed** under the surface, exactly as in ReefRacer — WaterTile's palette is untouched. Channel water is one continuous animated `buildWaterRibbon` (280 samples, width 0.72, amp 0.16 × waviness 0.6) at renderOrder 2. **See "THE LAGOON" below — the cove was rebuilt in 2026-07 and every number in that paragraph moved.**

## THE LAGOON — rebuilt 2026-07 ("the water reads as FAKE")

**The complaint:** one flat, uniform, almost matte teal disc; shallows and deep water the same colour; a hard cut from teal straight to sand; no surface life; the rocks, piers and tube pasted on top of a decal. **Every cause was structural, not tonal**, and all five were measured with `harness/mp3d-render/probe-ots-water.mjs` (no browser; raycasts the built scene against the sheet's own displaced surface, classifies sand off `userData.sand`, previews' flat ground) before anything was changed:

| | BEFORE | AFTER |
| --- | --- | --- |
| bed top vs the HOST's own surface | **−0.065** (BURIED — invisible) | **+0.012 … +0.573** (visible) |
| depth spread over the floor, p90 − p10 | **0.0815** (flat to 12 % — a painted disc) | **0.5091** (p10 0.090 → p90 0.599) |
| the sheet's own surface | one plane, 0.620 | **−0.050 … 0.620** (a baked shore dive) |
| clip ellipse vs the cove's plan | **1.000** — the waterline WAS the clip | **1.160** — the waterline is the sand |
| shore band, last water → first dry plate | median 0.29 u, **11 of 24 azimuths NEGATIVE** (dry sand inside the water) | median **0.18 u**, min 0.05, every azimuth positive |
| sheet painted over the ride's DRY land | **579 spit cells @ 0.568 deep + 187 apron cells** | 451 of 500 / 395 of 397 now **hidden under their own sand** |
| the ride's OWN access, vs the sheet's clip | queue head plan r **0.854**, entrance hut 0.790, exit cells 0.751 / 0.834 — **all four inside the water** | **1.372 / 1.300 / 1.276 / 1.327** — worst **+1.10 u outside the clip**, +3.49 u outside the waterline (`front` 2.4 → 7.0, "Fixed 5") |
| reef items standing PROUD of the water | **8 of 24** (kelp tops to 1.25 vs a 0.62 waterline) | **4 of 24, all kelp** — which is the one thing meant to break the surface |
| dry apron crest | groundAt + 0.113, i.e. **0.507 UNDER the waterline** | `SEA + 0.055` — a beach that crosses the waterline |
| meshes / triangles | 232 / 119,044 | **235 / 119,476** (+3 draws, +432 tris) |

**What was actually wrong.** The pale bed that the docs said "makes the turquoise read" was seated at `groundAt − 0.10`, **65 mm under the host's own opaque surface**, so it was never visible: what showed through the sheet was the host's grass/terrain, at ONE constant 0.62 depth over the whole pool. That is the entire explanation for "no depth gradient" — and it is the same defect, from the same cause, that ReefRacer's §2a fixed. Depth here cannot be DUG (the host's surface occludes anything below it); it can only be BUILT UP.

**The five moves.**

1. **The bed is a DISH, above the host's ground** — `bedTopAt` runs from `max(groundAt + 0.012, SEA − 0.62)` in the middle up to `SEA − 0.12` at the rim, so the pool is 0.61 deep in the channel and 0.12 on the shelf. It is pushed back down to `yBot − 0.22` within 1.8 u of the track and eased out by 3.0 u, because the dish's rim shelf (0.50) would otherwise have stood ABOVE the flume trough's own floor (0.45) where the circuit reaches plan radius ~0.86 — the raft runs in a dredged channel through the shoals now.
2. **The bed's COLOUR carries the gradient**, because nothing else can: WaterTile's alpha is `mix(0.78, 0.9, …vH…)` — driven by **wave height, not depth** — so a single-tone bed shows through at one strength wherever it is, however carefully the floor is shelved. Three merged meshes by local depth (`SAND_DEEP` 0x62705f / `SAND_BED` / `SAND_SHOAL` 0xdccfa6), +2 draws. The class boundary is **hash-dithered ±0.09** of depth: classified on raw depth it drew clean contours across a lattice of hard rectangles and the first render came back reading as a **tiled swimming-pool floor** (shoal was 0xe6dcbc then — too near white, maximum contrast on every plate edge).
3. **A real shore transition.** Wet band at `SEA − 0.09` (a submerged strip, 0.034 under the swell's own trough), dry apron crest at `SEA + 0.055`, dunes behind it.

   > **⚠️ PARK AUTHORS, READ THIS ONE — THE COVE RIM STANDS PROUD**
   >
   > **Anything a park places within `lagoonR` 1.75 of this cove rides UP with the rim.** The rim crest is `SEA + 0.055` ≈ **0.675 above the surrounding terrain** (two-and-a-bit RCT2 land steps), it holds that height out to `lagoonR` 1.20, and it eases back to `groundAt + 0.07` by **1.75** — which on this ellipse is a **4–9 u** run outside the waterline, i.e. a 0.07–0.15 gradient. Nothing beyond 1.75 is touched at all.
   >
   > So: a bench, a bin, a stall or a path laid inside that band sits on a dune face, and one laid inside 1.20 sits 0.675 up. **That trade is deliberate and it stays** (see below — `SEA` is pinned by the ride, so the beach has to climb to meet the water), but it is a fact about this component, not a surprise: place scenery outside `lagoonR` 1.75, or accept the slope. The ride's OWN access is inside the band and is handled — it stands on the SPIT, the one sand level that is pinned to the host's ground (`ACCESS`, "Fixed 5").

   **This is the one cost of the fix and it cannot be avoided while `SEA` is pinned by the ride:** the flume trough bottoms out at 0.55 and its walls reach +0.18, so the run-out only reads as awash for `SEA` in ~0.55…0.73 — the waterline is 0.62 above the host's ground, so the rim of this cove stands ~0.675 above the terrain around it, two-and-a-bit RCT2 land steps where ReefRacer spent one. Only the RIM: outside `lagoonR` 1.20 the lift eases back to `groundAt + 0.07` by 1.75, a 0.07–0.15 gradient over 4–9 u, and nothing beyond 1.75 is touched. `THK` went 0.07 → **0.85** because a 0.07 tile seated 0.675 above the host's ground floats with daylight under its edges.
4. **The waterline is the SAND, not the clip ellipse** — ReefRacer's §3b dive, baked into the plane's own vertices: wherever sand stands above the water the sheet slides 0.05 under it and is hidden. `uRadius` goes to `LB · 1.16` (past the wobble's own 1.115 maximum) and the plane grows 2.06 → 2.39 with it. **Plus one thing ReefRacer does not need:** the SPIT cannot be raised — §8 stands the launch tower, its switchback stair and its raft stack on `groundAt` and measures the deck up from there — so it can never occlude a sheet 0.62 above it. So the dive is driven by a MASK as well as by sand height: over the spit, past 1.6 u in from its water-facing edges, the sheet is pushed below the host's ground, where the host's own opaque surface depth-rejects it. The cone dilation turns that boundary into a ~2 u ramp of thinning water instead of a cut. **This mask is NOT what keeps the ride's huts dry — that was a `layout` defect, and it is fixed in `layout`. See “Fixed 5”, which also measures what deleting the mask costs.**
5. **Contact, and surface life.** The reef, the kelp and the shoals are seated on `bedTopAt`, not on `groundAt` — rock is capped to stay entirely under (bare rock reads DRY the instant it breaks the surface), kelp is capped to the local depth plus an overshoot with one in five standing clear, and a shoal is clamped 0.16 off the bed and 0.20 under the surface (a fixed −0.24…−0.38 swam shoals through the sand out on the shelf). Ripple ridges and 150 shell/rubble chips lie on the bed in the same merged mesh — sand bars under clear water, and they lie ACROSS the plate seams, which is the other half of why they are there. Waviness 0.6 → **0.85**: in WaterTile that one knob scales the fragment stage's ripple-normal wobble, the crest foam and the twinkle as well as the swell, so it buys the surface movement without a single new mesh, and the troughs still clear the rim shelf by 0.064.

**Draw cost, measured with `probe-perf-budget.mjs`** on a throwaway `<Park><Terrain/><OceanTunnelSlide/></Park>` fixture (the only sample park that mounts this ride, `w33a`, currently fails its own circuit verification for unrelated reasons and never reaches the verdict line, so the gate cannot read it): **436 draws before, 436 after**, triangles 493,456 → **490,252** (fewer — the scale-capped reef), visible mesh nodes 1400 → **1403**. All six assertions hold both sides.

⚠️ **A park draw count is FIXTURE-BOUND — do not compare across throwaways.** Most of the count is the host park (terrain, dressing, guests) and it is FRUSTUM-CULLED, so the number moves with the plot size and the camera pose, not just with this ride. Rebuilt from the same one-line description ("Fixed 5", 2026-07-28) the same probe reads **371 draws / 0.48 M tris / 1445 mesh nodes**, all six assertions pass — a different fixture, not a regression. The number that IS comparable is the component's own census off its built group: **119,476 triangles**, bit-identical across both passes.

## Preview circuits

- **3D rig — Deepwater Chute (LEAD)** — the whole ride: tube, basin, tower, return and haul-back over the lagoon.
- **Through the water (close)** — the money shot, at ~45° elevation looking down into the basin: the raft and its four riders **inside** the glass as it drops through the pool, fish and kelp around it. Rendered at ~5.5 s of clock (`--wait=6100`); the raft crosses the pool at 2.7 u/s, so the window is about a second wide — `phase0` shifts it if you need another moment.
- **The launch tower (close)** — deck, stair, hut, depth board, launch gate, and the turnaround running round the tower head at deck height.
- **The splash run-out (close)** — the raft coming out of the brass-collared mouth into the lagoon (`--wait=9500`).
- **The raft + a shoal (close)** — `buildTubeRaft` and `buildFishShoal` staged through the preview's `dress` hook in a length of the ride's own channel, with a water sheet at renderOrder 1 behind the shoal to demonstrate the read-through.
- **Track pieces — Long Chute** — a longer run-out and wider turnarounds through JSX piece children (68.65 u of arc, worst clearance 4.05, ZERO synthesized closure). Rules for authoring your own: the station must be the **HIGH** end, the first piece after it a `drop`, and the last leg a `lift` back to station height landing ~0.3 u short on the station axis.

## Screenshot verdicts

* **Lead, day** — the whole ride reads: the glass tube plunging out of the tower through the reef basin, the splash run-out, the return channel and the haul-back's trestles standing in the lagoon, the beach ringing all of it.
* **Through the water** — the raft and its riders are unmistakably INSIDE the tube, the pool's water is all round it, a shoal swims below the glass and kelp breaks the surface beside it. This is the shot the whole component is arranged for.
* **The splash run-out** — the raft emerging from the brass collar into open water with the tube's glass shell clearly reading as glass.
* **Night (`--nightwait=15000`)** — the deck and stair lamps light the tower warm against a moonlit lagoon; the difference from the day shot is *brightness*, not presence.
* **Alternate angle (52° orbit)** — the far turnaround, the haul-back's trestles and the kelp in the lagoon from the seaward side.
* **The rider's approach, before and after** (same pose both times, eye on the tube's axis at the pool's near edge) — before: the channel runs ahead and ends in a flat wash of blue-green, no opening, a dead end. After: an arched stone mouth with a dark throat, the channel visibly continuing into it and the raft framed in the opening.
* **Queue side, 50° elevation** — the tube runs into the headland, the headland stands between the two visible lengths of tube, and the tube comes out the far side and on to the brass-collared run-out. You can follow it through.
* **The park camera at 50°, at 35 units** — honestly, the portal is not legible from there: it is forty pixels wide, under water, on the far side of the pool, and the tube itself is nearly end-on to that camera. What the distance shot shows is the crossing, not the mouth; the mouth is a queue-and-raft-distance detail and it is built to read at 5–18 units.

Built with three.js on the shared Stage; the channel is the RCT2 water-ride sprite's flooded trough, the tube an oceanarium tunnel.

## Audit — 2026-07-25 (second pass), 100/100

| Dimension | Score | Notes |
|---|---|---|
| Mesh richness & count | 15/15 | 232 meshes / 119 280 tris / 2 lights / 3 emitters (240 particles), 44 `lodDetail`; basin wall, lining and floor, the bore's throat/rim/arch/spoil, tube ribs and rails, tower frame, deck, railings, stair, cleats and rollers all batched; 65 fish in 5 draws |
| Detail | 15/15 | tex+bump throughout; hoop ribs, four longitudinal rails, brass mouth collars (now correctly oriented — below), depth board, launch gate, switchback stair; the haul-back belt is a visible drive; the tube has night presence; **the reef now has a bored portal at both ends of the pass-through** |
| Cohesion | 20/20 | the raft was passing through the glass — found, fixed and re-measured (below); **the tube was passing through solid rock** — found, cut and re-measured (Fixed 4) |
| Guest comfort | 15/15 | 4/4 distinct seat anchors set round the raft's ring so riders face outward, parked drift **0.0000**, 15.75 u of travel in 10 s of `departing`, `invalid=false`; the raft clears the glass by **0.176** and the rock by **0.516** |
| Guest location | 15/15 | boards 0.56 u from the `boardPoint` on every one of six cycles, creep 0.00 u/cycle (below) |
| Aesthetic | 20/20 | the tube reads as translucent-under-water from the 50° camera; **and from the raft it now runs into a rock portal instead of into a flat wall of water** |
| **Total** | **100/100** | |

Probes: `/tmp/mp3d-render/tw-clash.tsx` (tube ↔ raft), `tw-sweep2.tsx` (pose sweep + tube
clearance + gate), `tw-cycletrue.tsx` (per-cycle boarding), `tw-facts.tsx`;
`aud-ots-bore.tsx` (the bore), `aud-ots-raft.tsx` (raft ↔ glass ↔ rock over a lap),
`aud-ots-facts.tsx` (census, seats, gate), run through `aud-ots.mjs`.
Shots: `shots/tw/OceanTunnelSlide-{day2,night2,a115,e50}.png`,
`shots/ots/{BEFORE,AFTER}-{rider,approach,queue50,park50,basin50}.png`.

### Fixed 5 (2026-07-28): the ride's own ACCESS stood INSIDE its own lagoon

> "inside a `<Park>`, the entrance hut, queue lane and exit hut stand in a hole punched in the
> ride's hero water."

Correct, and the water rebuild had left it that way: the cove was fixed, the ride's `layout`
was not. `front` was **2.4**, which on this ellipse is *inside the cove* — and the only thing
keeping the huts out of the sea was the §5b spit mask, i.e. a water-side workaround for a
layout-side defect.

**`front` is the only lever, and BOTH exit cells have to clear it.** `layout.exit` has been a
SIDE HINT since the RCT2 adjacency rework (`configurableRide.tsx:1007`): the exit hut is
DERIVED one 1.2 u tile along the station face from the entrance hut, on whichever side the
park's streets favour, so the binding anchor is the **−x** cell — the deeper of the two into
the cove. (The earlier note's "exit hut at plan radius 0.904" measured the *old absolute*
`layout.exit` offset `[2.0, 2.2]`, a cell the chassis has not placed a hut on for two versions;
the hut was really at **0.751**. `probe-ots-water.mjs` now imports `adjacentExitCells` and
`laneLenOf` from the chassis so it cannot make that mistake again.)

**Two contours, and the difference between them is the whole point.** Measured with
`probe-ots-water.mjs` (no browser — it reports the ACCESS ANCHORS block last), plan radii, and the margin converted to world
units along each anchor's own azimuth:

| | plan r before (`front` 2.4) | plan r after (`front` 7.0) | outside the WATERLINE | outside the CLIP |
|---|---|---|---|---|
| queue head | 0.854 | **1.372** | +6.32 u | **+2.03 u** |
| entrance hut | 0.790 | **1.300** | +6.07 u | **+1.37 u** |
| exit cell −x (hinted) | 0.751 | **1.276** | +4.67 u | **+1.10 u** |
| exit cell +x (alt) | 0.834 | **1.327** | +7.51 u | **+1.66 u** |
| lane tail | 1.226 | **1.769** | +7.69 u | **+5.44 u** |

*WATERLINE* is the outermost radius on that azimuth where water actually stands over sand — what
you see. On these particular azimuths that edge is the **spit's own edge** (plan r 0.57–0.90),
because the §5b mask is what ends the sheet there, which is why those margins are 4.7–7.7 u.
*CLIP* is the sheet's own `uRadius` (plan **1.16**), the last radius at which a fragment of water
can be drawn **at all** — and with the mask deleted the waterline becomes exactly the clip on
every one of these anchors, which is why the clip column is the number that matters: it means the
huts are dry **whatever the water does next**. Every anchor lands on
`spit` sand at **+0.016 vs the host's ground**, so nothing is buried either — and that is the
other bound on `front`: past the spit rectangle (`z ≤ 9.0`) the apron crest climbs to
`SEA + 0.055` and a hut seated on the park's terrain would be buried to its windows.

**AND THE SPIT MASK STAYS — it was never the huts' workaround.** Tested by deleting the line
and re-measuring the same way: **every access anchor is still dry, worst margin +1.10 u** (the
anchor fix does not depend on the mask, which is the property it was worth moving `front` 4.6 u
to get) — but **734 spit cells flood to a median 0.603** (0.028 with the mask), and the render
shows what that is: the launch tower's six legs, the whole bottom flight of the switchback stair
and the stack of spare rafts standing in the lagoon, with the waterline lapping a metre behind
the entrance hut. The mask's real cause is **§8's tower**, which is seated on `groundAt` and
measures its deck, legs and stair up from there, and that cause has not gone anywhere. The
comment at the mask now says so, with these numbers, so the next person to read it is not
looking at an unexplained workaround.

Shots (`shots/ots-water/`): `fix-mask-{park,access,towerfoot}.png` — the two huts and a full
queue lane on dry sand with the cove behind them, the tower's foot dry, the whole ride from the
park camera — against `nomask-{park,access,towerfoot}.png`, the same three with the mask
deleted. Fixture: a throwaway `<Park size=64>` + `<Terrain keepDry>` + `<Paths>` + `<Gate>` +
`<OceanTunnelSlide register>` (the huts and the lane exist ONLY when the ride is registered —
they come from <ConfigurableRide>, not from the visual builder, which is why no preview can
show this defect and why it survived the water pass).

### Fixed 4: the tube was BURIED in the reef, not bored through it

> "deep water chute does not show a tunnel through the rocks so it looks blocked"

Correct, and worse than it looked. The seaward wall was **notched** — its top dropped to
`basinY − 0.55`, a hair above the tube's crown — so the wall came down *to* the tube and then
closed over it. Measured along the tube's own axis (recovered from the shell's swept ring
centres, so the probe cannot drift out of sync with `TUBE_R`), at 401 stations, with exact
point-to-**triangle** distances and a ray-parity inside-solid test:

| | worst clear radius | stations inside solid rock | stations under the required 1.07 | axial-ray hits in the bore |
|---|---|---|---|---|
| before | **0.00** (worst intrusion 1.07 — total blockage) | **30 of 401** | **120 of 401** | **1 214**, closest at **0.019** from the axis |
| after | **1.2325** | **0** | **0** | **0** of 48 400 |

The axial rays are fired **in 400 short overlapping sections** along the axis, not end to end:
the axis is a 32° plunge that levels out at both ends, and one long ray is not the bore at all —
the first cut of the probe did exactly that and reported a clean 1.25 while the point-to-triangle
test was finding rock at 0.50. Three separate bodies of rock were in the hole: the wall, the
pool's **closed lining ring**, and — the largest of them — the pool's **floor**, because the tube
dips below the floor's own level two units before it reaches the wall. The floor is now a cut
tile grid; the wall and lining are cut by `cutColumns`; and the portal (throat, rim, arch, spoil,
mouth ring) is what makes the hole read as a bore rather than as a gap.

**The raft still clears.** Swept over a full ungated lap at 1 400 samples, every raft and rider
vertex against the shell's recovered axis and against every reef triangle within 3 u (exact
point-to-triangle through a spatial hash — no AABBs):

| | worst clearance |
|---|---|
| raft → glass | **+0.1755** (max vertex radius 0.7745 against `TUBE_R` 0.95) |
| raft → rock | **+0.5158** |

The rock figure is exactly the construction guarantee — `BORE_R + 0.04 − 0.7745 = 0.5155` — which
is the point: nothing can creep into the bore because every piece is *placed* outside it and
every loose piece is rejected if it is not.

Two corrections to the earlier audit fell out of this. The raft's worst radius is **0.7745, not
0.880**: the raft is seated `up · 0.20` and the shell's axis is `up · 0.30`, so its ring plane
rides **0.10** below the axis, not the 0.41 the previous note assumed. `TUBE_R = 0.95` is still
right and the margin is *larger* than recorded (+0.176, not +0.063) — nothing about the wider
tube is undone. And the brass mouth collars were built on
`makeBasis(side, fwd, up)`, whose determinant is **−1** (`fwd = side × up`, so `side × fwd =
−up`): a mirrored basis handed to `setRotationFromMatrix`, which assumes a proper rotation. The
collar rendered as a tilted ellipse lassoing the mouth instead of a ring round the tube's
section — visible in the run-out shot, and now `makeBasis(side, up, fwd)`.

### Fixed 1: the raft's buoyancy ring passed THROUGH the tube for 15 % of the lap

`TUBE_R` was 0.82 and the raft is a torus of outer radius 0.77 whose ring plane rides ~0.41
below the tube axis (the axis is lifted `TUBE_C` 0.30 so the crown clears heads), which puts its
lowest outboard vertex **0.883 from the axis**. Measured by recovering the shell's own swept ring
centres from its geometry, sweeping the ungated lap at 900–1400 samples and testing every raft
and rider vertex against the local tube axis:

| | worst radial clearance | worst crown clearance | max vertex radius |
|---|---|---|---|
| before (`TUBE_R` 0.82) | **−0.051 u** (218/1400 samples inside the tube) | 0.555 | 0.865 |
| after (`TUBE_R` 0.95) | **+0.063 u** | 0.671 | 0.880 |

The offender was identified precisely — the raft's main ring torus, at azimuth −175° (nearly
straight down), so the penetration was along the tube's lower flank where the channel partly
hides it, which is why it survived every previous still frame. Everything hung on the tube
(ribs at `TUBE_R + 0.035`, the four rails, the brass collars at `+0.08`) derives from `TUBE_R`
and followed it. The wider section reads BETTER, not merely legal: at 0.82 a 1.67-wide raft in a
1.64-wide tube was skin-tight, and the tube now has visible air in it.

Also corrected while in there: the section comment claimed the shell was **depth-WRITING**,
which is the exact opposite of what the code does and of what the note at the shell's own build
site says. `depthWrite = false` is the whole reason the raft is visible inside the tube.

### Fixed 2: the pace table wrapped on the wrong period

`uOf` wraps on `LAP` (45.09 s) and `rideDuration` is 45, so the lap looked honest. But
`createMotionGate` advances its clock during `departing` and `arriving` too, and the FSM counts
neither as ride time: measured against a bare gate driven through the real sequence
(`rideFsm.ts:124-195`), **one cycle hands the runner 1.291 s more clock than `rideDuration`**.
That surplus was never absorbed, so the raft's parking spot walked round the circuit. Over six
cycles it boarded **0.5 → 0.9 → 2.3 → 4.5 → 7.8 → 11.2 u** from the `boardPoint` — and this ride
boards on a launch deck **5 u up**, so by the sixth load the raft was sitting at y 0.94 out in
the lagoon while the queue, the launch gate and the stair were all still at the top of the
tower. That is the same failure the pace table was written to avoid, one layer down.

`CYCLE_SCALE = LAP / (45 + 1.291)` on the clock fed to `uOf` fixes it: the table, the descent
window and the tube placement are untouched and the raft runs 2.8 % slower. `rideDuration` is
unchanged at 45.

### Fixed 3: the signature disappeared after dark

The two night-gated lamps light the tower and the stair — and left the **tube**, the thing the
whole component exists for, as a few dark hoop lines. An oceanarium tunnel is lit from inside,
so the shell now carries its own night-gated emissive (`GLASS_GLOW` 0x62c4c8, a cold aquarium
teal deliberately unlike the warm `LAMP_GLOW` the lanterns burn, 0.02 → 0.34). **Emissive only:
no third PointLight, the budget stays at 2.** It is steady rather than flickering, because the
lamps are flames and this is not. Kept at 0.34 because the glass is also 40 % transparent and a
transparent emissive shell blooms fast; judged in the render, the tunnel now reads as lit glass
under moonlit water rather than as a neon tube.

# ParkEntrance

**CANONICAL IMPORT — copy exactly:** `import { ParkEntrance } from './components/ParkEntrance';`
*(never from `'./Park'`: only the `<Park>` wrappers + track-piece JSX live there. A wrong
specifier makes esbuild refuse the WHOLE bundle — the round-8 black-page failure.)*

The RCT2 PARK entrance gate: two square masonry towers with pyramidal slate roofs flanking a wide archway over the path, a deep stone beam across the opening carrying a white marquee sign band on BOTH faces, ticket booths under striped awnings in the tower fronts, open wrought-iron gate leaves folded back against the piers, night-gated lanterns on both tower faces and iron fence stubs running outward over a stone kerb. A flagstone threshold carries the path through the arch.

**Detailing vocabulary** (matches `SceneryPack`'s `gazebo` / `wishingWell`, and the reason each one exists):

- **Stone value ladder.** `STONE_LT 0xcfc7b2` / `STONE 0x9b948a` / `STONE_DK 0x6b6358`. The old set (`0xb3aca0` / `0x9b948a` / `0x837b70`) spanned 0.10 in luminance, so quoins, cornice and plinth carried no contrast and the whole gate read as ONE FLAT GREY BLOB at park distance. Colour is concentrated where the eye goes: gilt (`0xb8912f`) hardware, bottle-green (`0x27342c`) ironwork, a green-and-cream awning, a red pennant.
- **Roofs are articulated, because the park camera looks DOWN on them.** Each pyramid (4-sided cone, radius 0.68, base 1.70, apex 2.16, `rotY 45°`) carries an EAVES COURSE overhanging to half-side 0.502, three stepped SHINGLE COURSES at u = 0.20/0.44/0.68 standing 0.014 proud of the slope, a HIP CAP straddling each of the four arrises (corner (±0.4808, ±0.4808) → apex), an apex cap over the point where they meet, a gilt finial neck + ball, and a mast with a red pennant. The old roof was a bare cone with nothing on it.
- **Pier mouldings.** plinth → plinth cap (0.12…0.17) → string course (0.62) → blank dado → bed mould (1.58…1.62) → cornice (1.62…1.71), plus corner quoins. Blind sunk PANEL on each outer (±x) face (field 0.015 proud inside a frame 0.025 proud, so the field reads recessed) and a gilt-bossed PLAQUE on each inner (−z) face. The arch-facing ±x faces get contrast from the quoins only — they are 0.72 wide between quoins and anything proud there eats arch clearance.
- **Marquee = a park NAME, not a barcode.** Two WORD GROUPS of 3 and 5 strokes whose widths vary 1.66× (0.55…0.92 units), letter gaps 1.15, word gap 3.0, laid out in abstract units and scaled ONCE to the board so the lettering fills the band at any `width`. Shared BASELINE with taller initial caps. INK COVERAGE is the whole game: 38%. At 69% (wide strokes, narrow gaps) the elevation reads as a dark navy band with pale slots — the barcode failure inverted.
- **Ticket booth.** Recessed pane (4 mm proud inside a proud surround of jambs + sill + lintel) with a brass GRILLE 6 mm into it, a COUNTER on two corbels, and an AWNING derived from its two ENDPOINTS (z HW−0.02, y 1.335) → (z HW+0.36, y 1.175) so the near edge lands 0.02 INSIDE the wall, with green stripes offset onto its upper surface through `rotX`, a hem valance and scallops, on two iron knee brackets off the lintel.
- **Open gate leaves.** Hinged on the tower front corner and swung FULLY open, so each leaf lies in the plane x = ±(W/2 − 0.02) running outward in +z alongside the path. Its foot is buried in the plinth and its hinge stile laps the corner quoin. A partly-closed leaf would swing its far stile to |x| ≈ 0.44 and block the arch, so it is not an option.
- **Coping laid in stones** (6 stones, 0.02 joints) and **flagstone threshold** (grid with 0.022 joints over a dark bedding slab, plus a lighter edging course). Both are the largest flat surfaces the park camera sees straight down onto, and both were single blank rectangles.

**Draw calls went DOWN.** 99 unmerged meshes → **21**, because everything static is one `mergedBoxes` / `mergedParts` batch per material; only the four lantern glasses stay separate (they mutate their own material each frame). Triangles 2396 → **5888** (6008 at width 2.4). ParkEntrance is placed ONCE per park, so triangles are the cheap axis and draw calls are the one worth spending.

**Light budget stays at 2**, measured, not assumed: giving the inner lantern pair real PointLights too took a park 24 → 26 lights and 1658 → 2015 ms/frame for two lamps nobody stands under. The inner lanterns are EMISSIVE ONLY — they still read as lit lamps from inside the park after dark (the gate used to have no lamp at all on that face), they just do not illuminate.

`buildParkEntrance(t, { width? })` → `{ group, spawnPoint, archway }` — EXACT contract the GameManager codes against: the group faces local +z with the park OUTSIDE at +z; `spawnPoint` (`[0, 0, 0.91]`) is just OUTSIDE the arch where new guests appear (the OPENING cohort and every later arrival from the gate stream alike — GameManager/Context.md "The gate stream"), and `archway` (`[0, 0, 0]`) is under the arch at ground level. `width` is the clear arch opening in x (default 1.6 — two 0.5-scale peeps abreast). Deterministic geometry, no update fn needed (the night gate rides on each lantern glass's `onBeforeRender`).

**CLEARANCE IS A CONTRACT.** Audited by `harness/mp3d-render/probe-entrance-attach.mjs` at widths 1.6 AND 2.4:

- **PINCH** (narrowest clear half-width at guest height, y 0.06…1.0, through the arch throat) is **0.730 / 1.130** — set by the tower PLINTHS, exactly as before the detailing. The gate leaves stand at 0.75 / 1.15, outboard of them.
- **HEADROOM** under the arch is **1.120** (the lower haunch step) — unchanged.
- **spawnPoint** nearest geometry **0.750 / 1.150** away.
- **Attachment: all 302 / 312 parts** reach the masonry body by exact point-to-triangle distance, with grade attachment DISABLED (a gate stands on the ground, so "it touches grade" would excuse everything). The probe SPLITS every merged batch back into its authored parts by shared vertex position, so a hip cap or spear tip floating inside a `mergedBoxes` batch is still caught — verified by nudging one of each and watching it go red.

Original three.js composition on the shared Stage; proportions and the twin-tower + marquee-arch look referenced from the canonical RCT2 park entrance, realistic palette only.

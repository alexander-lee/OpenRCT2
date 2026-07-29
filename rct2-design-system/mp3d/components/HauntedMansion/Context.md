# HauntedMansion

**CANONICAL IMPORT — copy exactly:** `import { HauntedMansion } from './components/HauntedMansion';`
*(never from `'./Park'`: only the `<Park>` wrappers + track-piece JSX live there. A wrong
specifier makes esbuild refuse the WHOLE bundle — the round-8 black-page failure.)*

A crooked, decaying **three-tier brick mansion** — the fleet's set-piece building — and a
WALKTHROUGH dark ride. Modelled from the RCT2 HHBUILD sprite's massing (wide ground floor
under a wraparound hipped roof, a set-back middle storey, a square clock tower with a steep
cap) and then built as **architecture** rather than as blocks.

Built with three.js on the shared Stage. 6.83 u tall, 5.95 × 5.40 on plan.

---

## RCT2 station behaviour — EXCEPTION (walkthrough)

HauntedMansion is a WALKTHROUGH, the fleet's other motion-gate **exception** (Chairlift is
the first): there is no vehicle to park, so the updater stays **ungated** — bats, chimney
smoke, ground mist, the weathervane, the clock and the window flicker keep their own life
through the whole FSM cycle.

Capacity **6** = the six interior tour spots. `seatWorld` places boarded guests on six static
anchors **inside the ground-floor room**, so "riders" are simply indoors between the entrance
and exit huts. `rideDuration` **12**.

**The ground floor is a REAL HOLLOW SHELL** — four brick walls 0.16 thick, a boarded floor and
a ceiling — not a solid block with people buried in it. The room is `x ±1.49`, `z ±1.09`,
floor `0.18`, ceiling `1.51`; a park guest is 1.10 tall at `GUEST_SCALE` 0.5, so there is
**0.23 of headroom** and the worst anchor keeps **0.09** of shoulder clearance to a wall.

Concealment is *measured*, not assumed (`aud-hm.mjs hide`): 576 rays fired at each anchor's
head, chest and knee from a full 360° ring at 10°–48° elevation (the park camera band).
**576 / 576 blocked by mansion geometry — 100.00 % concealment, zero exposures.**

---

## The local procedural canvases

Stage's texture set has no masonry, no slate and no cobweb (wood / metal / asphalt / leaf /
fabric / concrete / grass / plastic / sand) and Stage is not this component's to extend, so
the mansion draws **three of its own**, the same way Stage's `drawTexture` does: one small
canvas each, cached module-level, used as `map` **and** `bumpMap`. All three are
**deterministic** — hashed sine only, never `Math.random` — so remounts and screenshots are
byte-identical.

**The rule they obey:** a *local* canvas MULTIPLIES with the material colour, so each one
paints the FINAL tone onto its own ground and every material that uses one keeps
`color: 0xffffff`. (A tinted material over a dark local canvas is how a lichen pass once
turned every megalith near-black.)

* **brick** — a lime-mortar bed, 8 courses of 4 stretchers in **running bond** (alternate
  courses half-lapped), per-brick tonal variation, two weathering flecks, a top-edge highlight
  and a struck perp-joint shadow down each left arris (without it the joints read as pure
  mortar bands instead of solid stretchers). `brickBox()` is the `box()`-shaped wrapper, kept
  for the one-off members (chimney stacks, gate piers); the wall shell is **merged**.
* **slate** — vertical butt joints, per-slate tone, rain streaking and lichen bloom, and
  **no horizontal lines**: the courses are MODELLED, so a horizontal texture would fight the
  geometry.
* **cobweb** — a radial web on black, used as an `alphaMap` on small quads.

---

## What is actually modelled

**Massing.** Stone plinth + water table → ground floor (3.30 × 2.50, quoined, belt string
course, three-member cornice on modillion brackets) → hipped roof with three gabled dormers →
middle storey (2.10 × 1.60, its own quoins/cornice) with a **front cross-gable** → hipped
skirt roof → **clock tower** (0.94 sq, quoins on all four corners) → widow's walk → steep
shingled cap → finial → **bat weathervane** at 6.83.

**Nothing is plumb.** The middle storey leans `rotZ −0.021 / rotX +0.009`; the tower kinks
back `+0.036 / −0.013` against it; three chimneys lean their own ways; every shingle course
sags toward mid-span with a hashed ripple; deck boards are sprung; railing pickets lean and
several are gone. Every lean is *buried* where it matters — tier 2 sits **0.56** inside the
tier-1 rim and the tower **0.30** inside the tier-2 rim, so no tilt can open a gap.

**Roofs are courses, not planes.** `shingleSlope(A, B, C, D)` takes the four corners of a
trapezoid (winding chosen so `(B−A)×(D−A)` points out), and emits `courses × segs` slabs, each
lapped down over the head of the one below, sagged and rippled. Nine courses on the main hip,
seven on the middle storey, nine on the tower cap, six on the cross-gable, five on the porch,
four per dormer — **662 slabs**. `hipRoof()` lays four of them plus lead hip rolls; the
chimney flashings are seated on the **measured** slope height at each stack (`roofYAt`).

**Joinery.** A window is a real opening: stone sill + drip, jambs, and either a lintel with a
label mould and label stops or **seven voussoirs** turning a segmental arch; a sash frame with
mullions and muntins; the glazing; and shutters on strap hinges. Four kinds — `lit`,
`dark`, `boarded` (three planks nailed across at hashed angles) and `smashed` (a muntin
missing, glass shards, a dead pane). **28 glazings** in all, plus a lit radiating **fanlight**
over the door, a **rose window** in the cross-gable and the clock face.

**The porch.** Four turned posts (plinth block, torus, shaft, neck, capital) with a pair of
scroll brackets each, sprung deck boards, a turned balustrade broken by the step opening, a
boarded soffit, a fascia, a gutter that has come away at one end, a downpipe, and a scalloped
**portico** pediment over cracked stone steps.

**Decay.** Ivy in five clumps (clumps, not scatter — scatter reads as confetti), 16 missing
bricks, cracks stepping off two window heads, six cobwebs, seven gravestones and a leaning
cross, two hashed-branching dead trees, and a leaning rusted railing with four brick piers and
a gate whose right leaf is swung open.

---

## Night

Night is the point of this building. **28 emissive glazings** gutter on their own speeds and
phases under one slow shared "draught" term, so the house *breathes* instead of strobing.
Only **four real PointLights** do any lighting work — the porch lantern in its iron cage, a
green facade uplight, a warm **spill** light outside the bay so the light lands on the ground
it comes from, and a high cold **moon wash** off the back-left that rims the roof.

Everything else is emissive, including the **MOONLIGHT RIM**: slate (×1.15), brick (×1.0),
ironwork (×1.4 — near-black metal needs the most to read at all), dead wood (×1.0) and the
limestone dressings (×0.5, because they already sit two stops above the brick) all take a
faint blue self-lift, so the silhouette stays readable rather than collapsing into the sky.
The chimney smoke lerps to a sickly green (it is being lit from below) and the ground mist
goes with it.

`metalness` never exceeds **0.28** anywhere: this Stage has no env map and `metalness ≥ 0.6`
renders near-black (measured: 0 materials at or above 0.6).

---

## Budgets — measured, not estimated

| | |
|---|---|
| Modelled parts | **2 070** (`group.userData.partCounts`) |
| Meshes / draw calls | **109 / 111** |
| Triangles | **29 864** |
| Materials | 80 |
| PointLights | **4**, all night-gated (budget 4) |
| Emitters / particles | 2 / **110** (budget 300) |
| `userData.lodDetail` | 7 meshes / 1 200 tris (cobwebs, ivy) |
| `metalness ≥ 0.6` | **0** |

Batched: shingle courses (662), stone dressings (493), muntins and sash frames (216),
shutters and louvres (132), carpentry (114), ivy (99), ironwork and rust (268), brick shell
(41), lead (28). A detailed mansion costs **111 draws**, not 2 070.

---

## Audit — 2026-07-25, 100/100

| Dimension | Score | Notes |
|---|---|---|
| Mesh richness & count | 15/15 | 2 070 modelled parts → **109 meshes / 111 draws / 29 864 tris**; every repeat merged through `mergedBoxes`/`mergedParts`; cobwebs + ivy on `lodDetail`; silhouette (hip roof → cross-gable → tower → weathervane) survives at the 50° park camera |
| Detail | 15/15 | 3 local procedural canvases as map+bump on every significant surface; quoins, cornices, modillions, string courses, sills, label moulds, voussoirs, muntins, turned posts, brackets, bargeboards, finials, flashings, gutters, chimney pots; night adds 28 gated glazings + 4 lamps + a moonlight rim |
| Cohesion | 20/20 | 64-sample sweep of the full 60 s cycle: extents stable (`minY −0.0304`, `maxY 6.8345`, horizontal 2.98 — no growth), bats clear the tower wall by **0.5587** at their closest (t = 8.44 s). Stated clearances: porch roof under the tier-1 eave **0.060**, bay cap **0.045**, tier-2 base buried **0.560**, tower base buried **0.300**, cross-gable base **0.142** below the slope it pierces. `computeBoundingBox()` forced before every `Box3.setFromObject` |
| Guest comfort | 15/15 | 6 distinct anchors for capacity 6; riders land **exactly** on them (worst distance from an anchor **0.0000** over 300 sim-s); feet flat on the room floor (0.0000), 0.23 headroom, 0.09 shoulder clearance; nothing to clip — a walkthrough has no vehicle |
| Guest location | 15/15 | 300 sim-s in a real GameManager: max **6** simultaneous riders, **6/6** distinct anchors occupied, **0** visible rider-frames outside the room, 13/14 guests rode **and resumed walking**, worst still-while-`walking` **2.43 s** against the 25 s gate. Concealment **100.00 %** (0/576 rays reach a guest) |
| Aesthetic | 20/20 | Reads instantly as a haunted mansion at 50°; muted brick red / limestone / slate / forest green / iron — no orange or pink; dark roof holds 2+ stops off the grass from above; night is *lit differently*, not darker |
| **Total** | **100/100** | |

Probes: `/private/tmp/mp3d-render/aud-hm-facts.tsx` + `aud-hm.mjs` (`facts` / `sweep` /
`hide` / `ground` / `clash` / `sim`).
Shots: `/private/tmp/mp3d-render/shots/hm-final-{0,1,3,4,5}.png`, `hm-final-2night.png`,
`hm-r6-alt115.png` (`[harness] camera az −66.9`), `hm-r7-elev50.png`
(`[harness] camera el 50.0` — a real move, no `CAMERA MOVE FAILED`).
Gates: `check-all.mjs` all previews bundle · `validate-react-park.mjs` `ok: true` ·
`seed-sweep.mjs HauntedMansion` **SWEEP CLEAN (880 builds)**.

**Fixed this pass** (each one measured, then re-rendered):

* Rebuilt from 30 authored primitives / 110 meshes / 2 676 tris to 2 070 modelled parts /
  29 864 tris at the same draw cost — the whole complaint.
* Dead-tree branches were laid with a hand-rolled Euler whose pitch term had the wrong sign;
  every branch shot **backwards** off its fork and the trees rendered as a cloud of loose
  sticks. Now `alongDir`.
* Lead hip rolls: at 0.085 × 0.05 lifted 0.035 they projected as one bright stripe straight
  down the middle of every 45° view (the tier-1 and tier-2 hips project almost collinearly);
  dropped to 0.062 × 0.03 they fell *below* the course surface and winked in and out as a
  dotted line. The lift is now derived from each roof's own pitch (0.05 of normal clearance).
* Sagging shutters rotated about their own centre and swung a clear 0.3 off the wall — two
  green slabs floating in mid-air. They now pivot about the top outer corner (the surviving
  pintle) and swing *outward*, away from the glass.
* Chimney flashings sat at a hand-picked fixed `y 1.98` and were **buried** inside the slates
  on all three stacks. Seated on `roofYAt(x, z)`.
* Ivy leaf spread and its woody stem ran to **−0.222** — a fifth of a unit underground
  (`ground` probe). Rooted at the plinth top.
* Gate piers had a three-tier wedding-cake cap in bright stone and read as two sarcophagi in
  front of the porch; the portico finial was a white stone cube floating over the roof; the
  porch post collars were near-black iron discs that read as rubber washers; the porch had no
  soffit and you looked up at the backs of the shingle slabs. All four fixed.
* Cobwebs were hung at the eave *tips*, seen against the sky as grey smudges — now slung in
  corners where they are always read against timber.

**Known and accepted:** the railing pickets bottom out at **−0.0304**, i.e. seated 3 cm into
the turf. That is deliberate — a fence post that stops exactly at y 0 floats on any terrain
with the slightest slope.

# RCT2 3D Design System — Campaign Handoff

Context summary for resuming this work on another machine with Claude Code.
Written 2026-07-24. Read this file first, then `mp3d/rules/park-generation.md`.

---

## 1. What this project is

A Magic Patterns **design system** of three.js RollerCoaster Tycoon 2 rigs:
`ds-fbd20bf8-b16d-4cf1-8440-d20bc095fc4a` ("3D RollerCoaster Tycoon Park").

- **Source of truth on disk:** `rct2-design-system/mp3d/components/<Name>/{index.tsx, <Name>.previews.tsx, Context.md}` plus `mp3d/rules/*.md`.
- **The design system does NOT generate parks.** `generatePark` was deliberately removed. The *Magic Patterns agent* composes each park from components; the DS supplies building blocks, seeding utilities, rules, skills, and **validators**.
- Published via MCP (`write_design_system_files` → `publish_design_system`). Current published version: **v3.2+** (see §7 for unpushed work).

## 2. The standing goal (not yet met)

Generate theme parks with the MP agent, photograph them from multiple angles, score them on a rubric, and add safeguards (code + rules + skills) until **two consecutive parks score 100/100**.

### Score history

| Round | Park A | Park B | Notes |
|---|---|---|---|
| 1 | 67 / 70 | 66 | |
| 2 | 40 | 70 | |
| 3 | 72 | 74 | |
| 4 | 80 | 78 | |
| 5 | 79 | 70 | |
| 6 | Alder Grove **81** | Obsidian Falls **68.5** | first round with the 13-axis rubric |
| 7 | Willowmere **76.5** | Cinder Peak **67.5** | scores DIPPED because the gates stopped lying |

**Round 8 has not been run.** It is the immediate next step, against the current 15-axis rubric.

## 3. The central diagnosis

Every generated park nails the coaster (**8/8 thrill**, verbatim archetype copies that re-measure to the published numbers) and fails the layout (**paths 1.5–2.5/8, accessibility 0–3/10**).

> **The agent executes copy-paste blocks perfectly and improvises badly.**

The coaster is a copy-paste block (§4.0 archetypes: pieces array, start pose, heading, corridor cell table, pinned queueDir). Layout was arithmetic the agent performed itself. **Every fix in flight converts arithmetic into blocks.**

Worst instance, found late: the rules pointed the agent at `DemoPark` as the canonical worked example, and `DemoPark` was a **size-16, hand-rolled-lattice, points-mode** park — i.e. the example demonstrated the exact anti-pattern we were scoring parks down for. Fixed by adding `DistrictPark` as preview 1 (size 48, `buildParkNet` + set-pieces + pieces-mode archetype); `DemoPark` is relabelled "NOT the layout to copy".

## 4. Tooling (rebuilt after a data loss — see §8)

**Persistent harness:** `/Users/alexanderlee/rct2-harness/`
- `mp3d-render/` — component screenshots. `node check-all.mjs` (esbuild every preview), `node render.mjs <Component> [--night] [--angle]`.
- `park-eval/` — park scoring. `node eval.mjs <park.tsx> --name=X` → 7 PNGs (4 azimuths @34°, topdown @81°, ground @8°, night) + `console.log`; `node probe.mjs <park.tsx>` → scene-graph JSON; `RUBRIC.md`; `samples/`; `signatures/`.

**NEVER put the harness in `/tmp`** — macOS purged it on reboot and destroyed 15 sample parks, all screenshots and `eval.mjs`. That is why it now lives under `~/rct2-harness`.

Both use SwiftShader chromium for determinism. **Agents must READ the PNGs** — image scoring caught dozens of defects arithmetic missed.

### Reference parks (must stay `ok: true`)
`demo-ref.tsx` (DemoPark verbatim), `district-ref.tsx` (the new canonical example), `setpiece-ref.tsx` (buildParkNet + 3 set-pieces, 0 failures 0 warnings), `arch-ref.tsx` (§4.0-A).
`broadmoor.tsx` is **permanently lost** (no copy existed outside `/tmp`).

## 5. The rubric — 15 axes, sums to exactly 100

`~/rct2-harness/park-eval/RUBRIC.md`

| Axis | W | Axis | W |
|---|--:|---|--:|
| Cleanliness | 5 | Scenery | 5 |
| Paths | 8 | Trees | 4 |
| Ride spacing | 8 | Creativity | 8 |
| Entrance/exit | 7 | Accessibility | 10 |
| Food stalls (variety) | 4 | Ride roster | 7 |
| Park entrance | 4 | Thrill | 8 |
| Terrain | 9 | Layout uniqueness | 7 |
| Water | 6 | | |

- **Thrill** is scored *relative to park type* (family ≥5.0 excitement, thrill ≥6.0) and scores 0 on force points if the coaster crashes — thrill must never come from illegality.
- **Layout uniqueness** catches BOTH a monotonous lattice and a huddled-in-one-quadrant plot. `gridRegularity` ≥0.75 → zero anti-lattice points. Measured on the **authored street net only** (access spurs flatter the metric).
- **Ride spacing:** AABB containment is NOT overlap. A ring coaster's AABB encloses its infield. validatePark's OBB sweep is authoritative.

## 6. Key mechanisms to know

- **`validatePark`** is the acceptance gate: accessibility, terrain vibe, footprint OBB sweep, coaster legality + crash-free replay, corridor SAT sweep, sim smoke, budget, determinism — plus wave-6/7 checks `bounds`, `scenery`, `blockers`, `autofix`.
- **Fatal lints** (promote to failures): `coaster:shortDrop`, `padOnStreet`, `queueTailShared`, `latticeInWater`, `causewayRefused`, `plantedInWater`, causeway >1.0 u, queueDir flips, exit-hut relocations. `latticeInWater`/`causewayRefused` **delete the offending edge**, which manufactures downstream `accessibility` failures — one causal chain, not separate bugs.
- **`rateCoaster`** (SplineRideKit) ports `RideRatings.cpp` → excitement/intensity/nausea + speeds, G, drops, airtime, inversions. Shares ONE physics model with the crash gate (proven bit-identical to 1e-12).
- **§4.0 archetypes:** A thrill steel E 6.12 (lat 0.36 g), B family E 5.27 (lat 0.27 g), C inverting E 6.31 (lat 0.90 g) — all crash-free under the 1.275 g limit. Legacy lift-0.6/0.7 archetypes are RETIRED (fail shortDrop).
  - Physics insight: bank is `atan(1.9·κ)` box-smoothed over ~2 u, so the discount LAGS curvature and the lateral peak lands at turn *entry*. Widening turns does nothing; **ride turns at the apex** (v≈4–6 u/s).
  - `queueDir` is only valid **with its heading** AND a minimum tail distance (`start.x + 6.0`). This caused queueDir flips in both round-6 parks.
- **Queue tail reach is NOT computable from props** — `front` is auto-raised to `min(6.5, footMaxZ·scale + 1.27)` for compact rigs. Pin the head: `queue={{ anchor: tail − dir·(laneLenOf(c) + 0.35), dir }}`.
- **Set-pieces** (`SetPieceKit`): `<FountainPlaza>`, `<Bazaar>`, `<Boulevard>` on a **pure-planner** contract — the planner returns ports/footprint/keepDry/sub-net as data BEFORE mount (mount-time refs are useless because `<Paths>`/`<Terrain>` must be declared first). `buildParkNet` fuses them into one graph, splits crossing edges and **prunes dangling stubs**.
- **Terrain (wave 8):** default `<Park size>` is now **192** (4× linear, 16× area) — measured 916 draws / 0.86 M tris / 29 ms validate. Per-seed **landform archetypes** (plains/downs/hollows/ridges/steppe/badlands) replaced a single constant base heightfield whose relief was 0.08–0.21 u across a 48-u plot — that constant was why every park looked identical. `buildSurround` gives an infinite-plane backdrop in **1 draw call**, outside ±size/2 and invisible to every validator.
- **Determinism mandate:** hashed sines only. No `Math.random`, no `Date.now`.

## 7. State / immediate next steps

1. **PUSH + PUBLISH the wave-7 + wave-8 work** — currently on disk, NOT on the server. Interdependent: `Park/pieces.tsx` imports `rateCoaster` from SplineRideKit, so a partial push activates a non-compiling artifact.
2. **Regenerate the §1 seed table** at `parkComposition(THREE, seed, 192, climate)` — it is STALE. Every water centre, mountain position and build field moved when the plot went 4× wider.
3. **Paste the 4 skills** via the MP web UI (Design System → Skills) — MCP cannot write skills. Drafts in `mp3d/skills-drafts/`: `park-composition`, `coaster-pieces`, `ride-and-stall-roster`, `park-troubleshooting`, in that order, **including the `---` frontmatter** (the `description` is the injection trigger). Canary in that folder's README.
4. **Run round 8** — two parks, 15-axis rubric, all 7 screenshots read per park.
5. **`components/Road/Context.md`** — the SERVER is ahead of disk (it has the deprecation notice). Do not overwrite it with the disk copy.

## 8. Hard-won operational lessons

- **Push protocol:** ONE file per write, no `baseArtifactId` (merge-on-current dodges 409s), **leaf modules before any re-exporting `index.tsx`**, rules last. Verify each write against the artifact **file list**, not just read-back — a write can report success, read back correctly, and still be silently absent.
- **File size kills pushes.** Bytes flow through model output tokens; a 145 KB `index.tsx` killed three consecutive agents. Keep modules under ~60 KB and split large components into a small re-exporting `index.tsx`.
- **MP's prop extractor reads ONLY `components/<Name>/index.tsx`** and cannot see through `export { X } from './module'`. A pure re-export publishes as a BREAKING change with every prop "removed". Fix: re-declare the component in `index.tsx` as a thin pass-through listing props explicitly and forwarding them undefined-as-is (see `Park/index.tsx`).
- **A split can ship an unbound hook** that bundles clean and only crashes at runtime (`useEffect` with `import React from 'react'` only). Grep every new submodule for hooks-vs-import.
- **Background agents drop silently** on API stream errors. `SendMessage` reports "had no active task" and resumes them from transcript.
- **Concurrent sessions edit this same tree.** Diff disk-vs-server per file before publishing; never blanket-overwrite; if the server is ahead, report rather than regress.
- **Verify against the source, not the brief.** Agents repeatedly found my instructions wrong: LogFlume/RiverRapids/PaddleBoats build their OWN water (putting PaddleBoats on the lake trips the wet-pad guard); Monorail/Chairlift register ONE station and do not "span districts" in any code sense.
- **A check that fails a genuinely good park is a broken check, not a strict one.** Fix the check; do not weaken it to silence.

## 9. User preferences (enforced)

Realistic RCT2 colours, no orange/pink remap. Pixel-art SVG icons only — **no emoji, no icon libraries**. Every vehicle emits a real PointLight headlamp. Rides reference actual RCT2 sprites. Guests seated at hips ≈ `y + 0.52·scale`. Stage lives only in previews. Parks never auto-rotate (previews may). Coasters are crash-free unless explicitly asked for danger. Always push AND publish when done. Prefers synchronous push agents; background ones appear frozen from their side.

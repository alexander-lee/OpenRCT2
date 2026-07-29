# AGENT BRIEF — read this instead of the big docs

**Purpose: cut startup cost.** `SETUP.md` (47 KB), `park-generation.md` (123 KB),
`-composition.md` (84 KB) and `-rides.md` (73 KB) total ~330 KB ≈ **80k tokens**.
Almost no task needs them end to end. This file is the 90% case in ~3 KB. Open a
big doc only when this one sends you there, and open the ONE section you need.

Component specifics live in `components/<Name>/Context.md` — read that, not the
source, to learn what a component already does and what was already tried.

---

## THE TRAPS (each cost a real debugging round — do not rediscover them)

1. **`metalness >= 0.6` renders NEAR-BLACK.** No env map on this Stage. Metals
   0.2–0.35. Cause of "a random black rail", black goggles, black grid — four
   times so far. If something is inexplicably black, check this first.
2. **`Box3.setFromObject` reads a CACHED `boundingBox`.** Geometry rebuilt per
   frame usually recomputes only its bounding *sphere*, so every sample returns
   identical numbers and you "prove" a fix that did nothing. Call
   `computeBoundingBox()` first.
3. **Never grade the rest pose.** Sweep the whole animation cycle. A rider's arm
   26 mm inside a yoke, gondolas 1.2 mm into their own deck, and a train through
   39 tunnel hoops were all invisible at rest.
4. **AABB probes lie.** One reported an 81 mm "clip" that was a rider correctly
   seated in an open tub. Use exact primitive volumes or triangle tests.
5. **A long ray is not a clearance test on a curve.** An end-to-end ray read
   1.25 clear where point-to-triangle found rock at 0.50. Fire short
   overlapping sections.
6. **`makeBasis(x, y, z)` needs a RIGHT-handed triple.** `dir x side` is the
   negative of `side x dir`; the wrong order mirrors the matrix, flips normals
   inward and renders the part near-black (or a ring as a tilted ellipse). Hit
   three times.
7. **`mat({tex})` bakes tone into the canvas and leaves `material.color` WHITE.**
   Comparing colours to verify a theme reports "not applied" for every case.
   Fingerprint the texture pixels instead.
8. **A local procedural canvas must have a NEAR-WHITE ground** — it MULTIPLIES.
   A `#8b8d80` canvas turned every megalith near-black.
9. **Two clocks.** `simTime` is absolute; `g.timer` and anything driven by frame
   `dt` run on the clamped clock (`s.walkClock`). They diverge >10x under
   SwiftShader. Set and compare a deadline on the SAME clock.
10. **`//` comments inside a JSX fragment are TEXT** and render on screen. They
    bundle clean, so no gate catches it. Use `{/* … */}`, and never nest a
    comment terminator inside one.
11. **A composable picks props BY NAME.** Adding a field to an `Opts` interface
    is not enough — thread it through the `Props` type and the forwarding call,
    or it is silently dropped. Happened twice in one day.
12. **`box()`/`cyl()`/`ball()` return CACHED, SHARED geometry.** Clone before
    mutating or you corrupt every other component using that primitive.
13. **`drawTexture` uses `Math.random()`** — the one determinism hole. Everything
    else must be hashed-sine; never `Math.random`/`Date.now`.

## THE HARNESS (`/tmp/mp3d-render`, rebuildable; durable tools in `mp3d/tools/`)

```sh
node check-some.mjs <A> <B>      # bundle just these — use while iterating
node check-all.mjs              # all 118; the shared gate, slow
node validate-react-park.mjs    # must stay ok: true
node render.mjs <Name> [--preview=N] [--night --nightwait=15000] [--angle=deg] [--elev=deg]
node ../rct2-design-system/mp3d/tools/seed-sweep.mjs <SceneryComp>   # SWEEP CLEAN
```

- **`render.mjs` PRINTS the camera pose it achieved.** Check that line. If it
  says `CAMERA MOVE FAILED`, the shot is at the preview's default pose — a
  "50-degree" verdict was once given on a 17.8-degree shot.
- **`--elev=50` is the park camera** and is mandatory for any look judgement.
- **The harness runs SwiftShader.** Its fps is a software-rasteriser artifact.
  Trust draw calls, triangles, materials, textures, shadow casters and CPU
  profile — not fps.

## WHAT ACTUALLY COSTS FRAMES (measured, not guessed)

**92% of frame CPU is per-draw uniform upload.** The constraint is MESH COUNT,
not triangles. Batch repeats with `mergedBoxes`/`mergedParts` — a detailed rig
can carry 2,070 parts at 111 draw calls. Per-frame allocation was measured and
is NOT a problem (whole-park updater pass <= 0.7 ms). Do not optimise there.

## RULES THAT BITE

- Deterministic hashed-sine only. Two builds must agree.
- <= 4 real PointLights and <= 300 particles per component (4,000 global).
- `userData.lodDetail` on fine detail.
- Components NEVER render a `<Stage>`; previews use `<ScenePreview>`.
- Grade a lattice dither by ADJACENCY, not colour shares — uniform-random on a
  1.2 u lattice IS a chequerboard.

## HOW TO REPORT

- **A claim you did not measure is not a score.** Screenshots grade aesthetics;
  probes grade geometry.
- **Check your probe CAN fail** — revert the fix and confirm it goes red.
- **Reverting is a valid outcome.** Record it in-code with the reason so it is
  not retried.
- A dimension that cannot reach full marks is a score below 100 with a NAMED
  blocker, not "100 with a caveat".

## SCORING A COMPONENT

`rules/component-audit.md` (12 KB) — the six-dimension /100 rubric. Read it only
when auditing.

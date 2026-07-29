# Fence

**CANONICAL IMPORT — copy exactly:** `import { Fence } from './components/Fence';`
*(never from `'./Park'`: only the `<Park>` wrappers + track-piece JSX live there. A wrong
specifier makes esbuild refuse the WHOLE bundle — the round-8 black-page failure.)*

RCT2-style park fencing as **RUNS** between world xz points — the dressing that turns open grass into a park, and the railing every ride queue is flanked with. **Five** styles, all following the terrain through a `groundAt` sampler, all reporting their world-space spans as **BLOCKERS** so guests walk *around* them instead of through them, and all batched into **at most three merged meshes per rig** — of which only two draw at park zoom, because the close-up joinery rides one `userData.lodDetail` mesh the ride runtime hides beyond NEAR.

| style | reads as | height | pitch | blocker half-width |
| --- | --- | --- | --- | --- |
| `'wood'` (default) | post-and-rail: posts on spread **footings**, a collar + 4-sided weather **chamfer** cap, **THREE** rails per bay, a **mortise plate** where every rail enters its post, a moulding **bead** down both faces of every rail | 0.85 | 1.2 | 0.10 |
| `'metal'` | the RCT2 queue railing: **hex-prism** uprights (round at park zoom where a box reads square) on bolted **foot plates**, a tubular mid rail threaded through them, a flat **capping bar** the uprights die into, and thicker **ball-finial end posts** terminating the run | 0.52 | 0.42 | 0.07 |
| `'hedge'` | a clipped privet: a spread **skirt** at the ground, a leaf body in short overlapping segments with hashed crown height, a narrower **crown** course (the clipped batter) and leaf **clumps** on top | 0.72 | 0.30 | 0.21 |
| `'picket'` | white **pointed pickets** on two rails between capped end posts, each picket pyramid-pointed and beaded down its face (SceneryPack's `picketFence`, as a run) | 0.80 | 1.44 | 0.10 |
| `'brick'` | a low garden wall: coursed brick with a proud **plinth**, a **soldier course** of bricks on end, a stone **coping**, and stone-based, stone-capped, ball-**finialled piers** at the pier pitch (SceneryPack's `brickWall`, as a run) | 0.80 | 2.40 | 0.20 |

**Nothing stops in mid-air and nothing floats.** Every post/pier/picket/hedge segment stands on its OWN ground sample and is bedded 0.02–0.06 into it; every post is CAPPED (chamfer cap, ball finial, stone cap + finial) instead of ending on a flat cut; every rail runs post *centre* to post *centre* and is grown half a section past each end, so both ends are mortised inside the post they join. Rails, wall courses and copings are pitched **bay by bay** to the ground under them, so a run over a slope keeps its courses parallel to the grade instead of floating at one end and ploughing into the hill at the other.

**Frames.** Anything spanning two points (rails, tubes, wall courses, soldier bricks) is built by `seg` from THE TWO POINTS IT JOINS, via an explicit right-handed basis (`X = up × d`, `Y = d × X`, `Z = d`), never from an azimuth plus a tilt: three.js composes Euler `'XYZ'` as `Rx·Ry`, so a pitch applied next to a yaw lands about WORLD x and the part leaves its own tangent.

**Texture treatment.** Per-part UV repeats are baked by `mergedParts`, and they run along the part's LONG axis: for a box of dims `[t, h, L]` the visible ±x faces map u along the LENGTH, so a rail takes `[L·2.6, 1]` (the old `[1, L·3]` tiled the grain across the 0.115 rail height instead of along the board). Brick takes a **course-scale** repeat — `u = L/(42·0.06)`, `v = h/(42·0.07)`, one cell of the 3 px `fabric` weave per brick; at brickWall's own `[10, 5]`-per-2-u scale the wall renders FLAT RED, because 400 mortar lines across 2.4 u average out at any zoom a park is seen from.

Night-safe: no lights, no emissive, no updater. Deterministic — hashed sines only.

## Exports

- **`<Fence from to style height spacing inset seed blocking label/>`** — the composable (components/Park/Context.md convention). `from`/`to` are **WORLD xz**, so a fence run IS its own position: `<Fence>` takes **no `position` prop** and mounts at the world origin, settling every post onto the terrain via the park's floor sampler.
  - **`points` + `closed`** fences a POLYGON / polyline instead (`closed` defaults true) — corner posts land exactly on the vertices because every leg plants a post at both ends.
  - **`inset`** trims both ends of every leg: how you leave a **GATEWAY** where a street passes through a boundary (or just author two runs with a gap, as the collision probe's park does).
  - **`blocking`** (default true) registers each fenced span with the GameManager blocker registry: path edges through it are rejected by the routing layer, off-network waypoint walks slide along its edge, and `validatePark`'s `blockers` gate FAILS a street laid through it. `blocking={false}` = pure dressing guests may walk through (use for a fence outside the walkable park).
- **`buildFence(t, { from, to, style?, height?, spacing?, groundAt?, inset?, seed?, color? })`** → `{ group, style, height, length, posts, blockers }` — the imperative builder for ONE straight leg. `blockers` is one rotated-rect OBB (`{ cx, cz, hx, hz, yaw }`) per fenced span, in the same frame `from`/`to` were given in — feed it straight to `registerBlocker({ rect })`.
- **`buildFenceRuns(t, runs, opts?)`** — N straight legs as ONE batched rig (what the queue lanes and `buildFenceLoop` use).
- **`buildFenceLoop(t, points, { closed?, ...opts })`** — fence a polygon/polyline (loops close by default).
- **`FENCE_STYLES`** — the five style specs (heights, pitches, palette, blocker widths) as data, for callers that need to size a layout against a fence.
- **`color`** (builder opt) overrides a style's TONE, keeping its geometry/texture/metalness; the rail course is derived a step lighter (×1.19), as the stock styles are. Used by themed queue lanes.

```tsx
<Fence from={[-3.6, 3]} to={[-0.75, 3]} style="wood" />   {/* boundary, west of the street */}
<Fence from={[0.75, 3]} to={[3.6, 3]} style="wood" />     {/* …and east of it — the street's gateway */}
<Fence points={[[-4.8, 5.4], [-3, 5.4], [-3, 7.2], [-4.8, 7.2]]} style="hedge" />
<Fence from={[-2.4, -6]} to={[2.4, -6]} style="picket" /> {/* a garden edge */}
<Fence from={[6, -6]} to={[13.2, -6]} style="brick" />    {/* a low masonry boundary */}
```

## Queue lanes are fenced

`createGameManager`'s `buildQueueLane` rails **both long sides** of every registered ride's queue with the `'metal'` style (batched: two merged meshes for the whole lane, not ~18 loose posts and rails) and registers both sides as blockers. The railings stop 0.14 short of the tail — the queue's open **MOUTH** — so a queue is only enterable at its TAIL and guests must path to the tail node instead of stepping in sideways. The railings are part of the ride's access rig: `moveRide` translates them and their blockers, `resizeRideLane` rebuilds both at the new length. The whole queue walk (tail join, slot shuffle, hut doorway, balking back out) runs down the lane CENTRE, a clear 0.12 u inside both padded rails.

## Budget (measured, `harness/mp3d-render/probe-fence-attach.mjs --len=12`)

Per **12 u straight run**, and what it costs at park zoom:

| style | meshes | draws at MID/FAR | triangles | was |
| --- | --- | --- | --- | --- |
| wood | 3 (body / trim / detail) | **2** | 1 960 | 504 |
| metal | 2 (body / trim) | **2** | 2 916 | 1 056 |
| hedge | 2 (body / clumps) | **1** | 2 880 | 720 |
| picket | 2 (body / beads) | **1** | 3 148 | — (new) |
| brick | 3 (brick / stone / courses) | **2** | 1 716 | — (new) |

A 48-plot park carrying ~230 u of fencing in five styles measures **508 draw calls / 222 k triangles** whole-frame (`probe-fence-draws.mjs`); the same park's wood + hedge + metal runs measure **504 draws before and 504 draws after** this detailing pass — the fidelity is paid in triangles, not in draw calls, because the mesh count per rig did not move. Fence freely: that is the point of the batching.

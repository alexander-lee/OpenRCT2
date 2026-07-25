# Fence

RCT2-style park fencing as **RUNS** between world xz points — the dressing that turns open grass into a park, and the railing every ride queue is flanked with. Three styles, all built from boxes and batched with `mergedBoxes` (**one draw call per material**, because fences are static dressing that never animates), all following the terrain through a `groundAt` sampler, and all reporting their world-space spans as **BLOCKERS** so guests walk *around* them instead of through them.

| style | reads as | height | pitch | blocker half-width |
| --- | --- | --- | --- | --- |
| `'wood'` (default) | classic post-and-rail: square weathered posts buried 0.08 for ground contact, little chamfer caps, TWO rails per bay | 0.85 | 1.2 | 0.10 |
| `'metal'` | the RCT2 queue railing: slim galvanized uprights + a top and a mid rail (thin tubular read at park zoom) | 0.52 | 0.42 | 0.07 |
| `'hedge'` | a clipped privet: one continuous leaf body in short overlapping segments with hashed height/yaw variation + close-up leaf clumps | 0.72 | 0.30 | 0.21 |

Rails are pitched **bay by bay** to the ground under them, so a run over a slope keeps its rails parallel to the grade instead of floating at one end and ploughing into the hill at the other. Post caps (`wood`) and leaf clumps (`hedge`) go into their own merged mesh tagged `userData.lodDetail`, so they are shed at MID range by the ride runtime. Night-safe: no lights, no emissive, no updater. Deterministic — hashed sines only.

## Exports

- **`<Fence from to style height spacing inset seed blocking label/>`** — the composable (components/Park/Context.md convention). `from`/`to` are **WORLD xz**, so a fence run IS its own position: `<Fence>` takes **no `position` prop** and mounts at the world origin, settling every post onto the terrain via the park's floor sampler.
  - **`points` + `closed`** fences a POLYGON / polyline instead (`closed` defaults true) — corner posts land exactly on the vertices because every leg plants a post at both ends.
  - **`inset`** trims both ends of every leg: how you leave a **GATEWAY** where a street passes through a boundary (or just author two runs with a gap, as the collision probe's park does).
  - **`blocking`** (default true) registers each fenced span with the GameManager blocker registry: path edges through it are rejected by the routing layer, off-network waypoint walks slide along its edge, and `validatePark`'s `blockers` gate FAILS a street laid through it. `blocking={false}` = pure dressing guests may walk through (use for a fence outside the walkable park).
- **`buildFence(t, { from, to, style?, height?, spacing?, groundAt?, inset?, seed? })`** → `{ group, style, height, length, posts, blockers }` — the imperative builder for ONE straight leg. `blockers` is one rotated-rect OBB (`{ cx, cz, hx, hz, yaw }`) per fenced span, in the same frame `from`/`to` were given in — feed it straight to `registerBlocker({ rect })`.
- **`buildFenceRuns(t, runs, opts?)`** — N straight legs as ONE batched rig (what the queue lanes and `buildFenceLoop` use).
- **`buildFenceLoop(t, points, { closed?, ...opts })`** — fence a polygon/polyline (loops close by default).
- **`FENCE_STYLES`** — the three style specs (heights, pitches, palette, blocker widths) as data, for callers that need to size a layout against a fence.

```tsx
<Fence from={[-3.6, 3]} to={[-0.75, 3]} style="wood" />   {/* boundary, west of the street */}
<Fence from={[0.75, 3]} to={[3.6, 3]} style="wood" />     {/* …and east of it — the street's gateway */}
<Fence points={[[-4.8, 5.4], [-3, 5.4], [-3, 7.2], [-4.8, 7.2]]} style="hedge" />
```

## Queue lanes are fenced

`createGameManager`'s `buildQueueLane` rails **both long sides** of every registered ride's queue with the `'metal'` style (batched: two merged meshes instead of ~18 loose posts and rails) and registers both sides as blockers. The railings stop 0.14 short of the tail — the queue's open **MOUTH** — so a queue is only enterable at its TAIL and guests must path to the tail node instead of stepping in sideways. The railings are part of the ride's access rig: `moveRide` translates them and their blockers, `resizeRideLane` rebuilds both at the new length. The whole queue walk (tail join, slot shuffle, hut doorway, balking back out) runs down the lane CENTRE, a clear 0.12 u inside both padded rails.

Budget: a 12-u wood run is ~2 draw calls and ~30 boxes; the hedge is ~1 call. Fence freely — that is the point of the batching.

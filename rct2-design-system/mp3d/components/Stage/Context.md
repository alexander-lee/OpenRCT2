# Stage

**CANONICAL IMPORT — copy exactly:** `import { Stage, box, cyl, ball, mat, mergedBoxes, mergedParts, mtx, alongDir } from './components/Stage';`
*(never from `'./Park'`: only the `<Park>` wrappers + track-piece JSX live there. A wrong
specifier makes esbuild refuse the WHOLE bundle — the round-8 black-page failure.)*

Foundation for every 3D rig. Creates a three.js `WebGLRenderer`, an orbit camera (drag to rotate, auto-rotates when idle), hemisphere + directional sun light with soft shadows, and a grass ground disc. Exposes geometry helpers `box`, `cyl`, `ball`, `mat`.

## Static-geometry merge helpers

- **`mergedBoxes(three, parts: MergedBoxSpec[], color, matOpts?)`** — N same-material BOXES collapse into ONE mesh (one draw call, one shadow draw). Use for static dressing built from many small `box()` calls: kerbs, seams, rivets, spokes, lattice rungs, fence pickets. Per-box `repeat` bakes into the merged UVs so mixed-length parts still share one texture. Not for boxes that move independently or mutate their material per frame — merged parts share one material forever.
- **`mergedParts(three, parts: PartSpec[], material, dispose?)`** — the non-box counterpart: N same-material parts of ANY geometry (prisms, tapered blades, cylinders, tori, lathes) collapse into one mesh the same way. Each `PartSpec` is `{ geo, matrix, uv? }` — a full world matrix rather than pos/rot/scale, since non-box geometries do not all share a common "dims" shape. Pass a ready-made `THREE.Material` (unlike `mergedBoxes`, which builds its own via `mat()`), since callers often need `surface()`/`plain()`-style wrappers Stage doesn't know about. `dispose` (default on) frees the source geometries afterwards, since callers build them as per-call temporaries; pass `false` if the caller keeps its own reference to one of them.
- **`mtx(three, pos, rot?, scl?)`** — compose a `PartSpec.matrix` out of position / YXZ Euler rotation / (possibly non-uniform) scale. The usual way to fill a fixed-pose part.
- **`alongDir(three, p, dir, len)`** — compose a `PartSpec.matrix` for a +Y-axis geometry (cylinder/cone) run defined by its endpoints rather than a fixed pose: pipes, chain, rope, branches, coral. Orients +Y to `dir` and centers the geometry at the run's midpoint.

`mergedParts` / `mtx` / `alongDir` were independently written three times (Emberfall, Tidewater, Brasswork scenery) before being consolidated here — all three copies were byte-identical, so the move was a pure refactor (import from Stage, delete the local copy; behaviour unchanged). Reach for them here rather than re-deriving them in a fourth world.

```tsx
<Stage build={(THREE, group) => {
  group.add(box(THREE, [1,1,1], 0xdd6633, [0,0.5,0]));
  return (t) => { group.rotation.y = t; }; // optional per-frame update
}} />
```

## Performance

- **`quality` prop** — `'high'` (default: pixel-ratio cap 2, AA, 2048² sun shadow map), `'medium'` (cap 1.5, AA, 1024² — what `<Park>` passes), `'low'` (cap 1, no AA, 512²). Previews keep the default so screenshots stay pixel-identical.
- **`api.stats()`** → `{ drawCalls, triangles, fps, frameMs, lights, lightsCulled }` for the last complete frame (all passes; `lights` = visible Point/Spot lights). Poll ≥300 ms. The Stage warns once ~5 s in when a scene sits over ~3000 draws / ~2.5M triangles. **`fps` was wrong until 2026-07-27** — it averaged `1/dt` over the loop's CLAMPED dt, so it could not read below 10 and was biased high anyway; a park at 1.4 fps reported "13.6". It is `1 / mean(unclamped dt)` now. `frameMs` was always honest.
- **DARK-LIGHT CULL (`darkLights.ts`, split out of `index.tsx` for file size and re-exported as `createDarkLightCull`).** three.js only leaves a light out of a material's forward light loop when `visible === false`, so a night-gated lamp at `intensity 0` still costs a full per-fragment PBR iteration all day. The Stage sheds those every 0.25 s, with hysteresis so a day/night transition recompiles the shaders once, and only ever restores lights it shed itself (so `<Park budgets={{ lights }}`'s opt-in nearest-N cap composes as an intersection instead of a fight). `lightsCulled` counts them. Measured, interleaved A/B under SwiftShader: **DemoPark 406 → 281 ms/frame** (21 of 24 lights dark), **monorail-ref size 128 342 → 197 ms/frame** (41 of 41 dark) — with zero change to draw calls or triangles. It buys nothing at night, when those lamps are genuinely lit; the ≤ 4-real-lights-per-component rule still stands.
- **`api.cameras()`** → the main orbit cam + every active inset cam (the Park ride runtime measures LOD distance against all of them).
- **Inset viewports** (`addViewport`) are full scene render passes — shadow maps are reused automatically, but keep ONE live inset (the Stage warns on 2+).
- **Geometry cache** — `box`/`cyl`/`ball` share one BufferGeometry per distinct dimensions; cached geometries carry `userData.shared` and every disposal helper skips them.

## Controls

- **Drag** orbits; **arrow keys / WASD** glide the view across the ground (view-relative, Minecraft-fly style); **Space / Shift** fly up / down; **scroll wheel** dollies from a first-person eye (0.9 units) out to ~3× the stage distance.
- **`api.player`** — the invisible player PILL (capsule) standing at the view target: it IS "the user" in the scene (WASD moves it, terrain clamps it, the camera orbits it). Probe it for position/collision logic; it never renders and never captures clicks.

## Click-pick (`api.onPick`) — the ONE path, never a private raycast

`api.onPick(cb)` → unsubscriber. It raycasts pointer clicks (drags over 8 px are ignored), walks UP the parent chain from the hit mesh and delivers the first ancestor whose `userData` carries a **`rideRef`**, a **`guestRef`** or — round 8, generic scenery — a **`pickRef`**. Tag your root group with `userData.pickRef = (obj) => …` and any component is clickable exactly like a ride or a guest.

Everything this path already gets right, each of which was a separately-fixed bug — do NOT re-derive it in a component:

- **Only what the renderer DREW is pickable.** three's `Raycaster` never tests `visible`, so every invisible object is otherwise a full-price click target (LOD-culled detail, and — the big one — guests the sim has hidden inside huts, on rides or already walked out of the park). A parent-chain `isDrawn()` check enforces it, including objects on a viewport's `hide` list for THAT pass.
- **Real geometry beats click proxies.** A `userData.clickProxy` mesh may be invisible itself (that is the point of a fat hit target) but it is a SECOND-PASS target, resolved in SCREEN space (nearest carrier centre to the cursor), not by ray depth — a 0.72-wide proxy around a 0.2-wide peep otherwise steals a neighbour's click on any busy path.
- **…except a guest standing in front of ride or scenery geometry keeps the click** when their proxy is the nearer surface. You were pointing at the peep, not at the mirror behind them.
- **A click inside a live viewport INSET raycasts with THAT inset's camera**, so what you see in the framed monitor is what you pick.
- **A ±6 px deterministic jitter ring** catches near-miss clicks on small moving targets.

Guest clicking has been broken and re-fixed three times in this project and is measured at 98.9 % (`probe-guestclick.mjs`, insets 5/5). Adding a carrier flavour is additive; changing the ordering rules is not.

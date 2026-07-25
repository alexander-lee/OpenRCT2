# Stage

Foundation for every 3D rig. Creates a three.js `WebGLRenderer`, an orbit camera (drag to rotate, auto-rotates when idle), hemisphere + directional sun light with soft shadows, and a grass ground disc. Exposes geometry helpers `box`, `cyl`, `ball`, `mat`.

```tsx
<Stage build={(THREE, group) => {
  group.add(box(THREE, [1,1,1], 0xdd6633, [0,0.5,0]));
  return (t) => { group.rotation.y = t; }; // optional per-frame update
}} />
```

## Performance

- **`quality` prop** — `'high'` (default: pixel-ratio cap 2, AA, 2048² sun shadow map), `'medium'` (cap 1.5, AA, 1024² — what `<Park>` passes), `'low'` (cap 1, no AA, 512²). Previews keep the default so screenshots stay pixel-identical.
- **`api.stats()`** → `{ drawCalls, triangles, fps, frameMs, lights }` for the last complete frame (all passes; `lights` = visible Point/Spot lights). Poll ≥300 ms. The Stage warns once ~5 s in when a scene sits over ~3000 draws / ~2.5M triangles.
- **`api.cameras()`** → the main orbit cam + every active inset cam (the Park ride runtime measures LOD distance against all of them).
- **Inset viewports** (`addViewport`) are full scene render passes — shadow maps are reused automatically, but keep ONE live inset (the Stage warns on 2+).
- **Geometry cache** — `box`/`cyl`/`ball` share one BufferGeometry per distinct dimensions; cached geometries carry `userData.shared` and every disposal helper skips them.

## Controls

- **Drag** orbits; **arrow keys / WASD** glide the view across the ground (view-relative, Minecraft-fly style); **Space / Shift** fly up / down; **scroll wheel** dollies from a first-person eye (0.9 units) out to ~3× the stage distance.
- **`api.player`** — the invisible player PILL (capsule) standing at the view target: it IS "the user" in the scene (WASD moves it, terrain clamps it, the camera orbits it). Probe it for position/collision logic; it never renders and never captures clicks.

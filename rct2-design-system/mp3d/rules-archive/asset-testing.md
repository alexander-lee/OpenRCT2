# Asset testing — the shipping gate

**Every new or changed 3D asset MUST be screenshot-tested before it ships.
No exceptions.** "Asset" means any component that draws into a Stage — rides,
scenery, kits, terrain, paths, vehicles, UI overlays on the canvas.

## The gate

1. **Render it with the harness** (below), at minimum:
   - **day** shot (default),
   - **night** shot (`--night` — the day/night switcher is clicked first),
   - **at least one alternate angle** (`--angle=45` or a second preview /
     custom camera pose) so silhouettes are checked from more than one side.
2. **Score the renders /100** against the rubric:
   - **Looks** — reads instantly as the RCT2 subject; realistic colours only
     (muted brick red, forest green, navy, cream, silver, grey-brown).
   - **Mesh richness** — no lazy single-box parts; visible part breakdown
     (supports, trims, mechanisms) within the mesh budget.
   - **Detail** — the small stuff: bolts, signage, lamps, rails, steps.
   - **Texture + bump usage** — procedural Stage textures (`tex` + `bump`)
     on every significant surface; no flat untextured slabs.
   - **Placement continuity** — sits on the ground (or `heightAt`) with no
     floating or interpenetrating geometry; connects cleanly to paths,
     terrain and neighbours.
   - **Rides additionally score the seat rubric:** no rider **clipping**
     through the vehicle, visible seat **cushioning**, believable
     **restraints**, correct seat **placement** (peeps actually in seats).
3. **Fix and re-render iteratively.** Every deduction gets a concrete fix,
   then a fresh render. Repeat.
4. **An asset cannot ship until it scores 100/100** — day AND night AND the
   alternate angle.
5. **Determinism is part of the gate** — the same code must produce the same
   screenshot byte-for-byte intent: hashed-sine PRNGs only, no
   `Math.random`, no `Date.now`; animate off the updater's time argument
   (SETUP.md §12). Non-deterministic previews are a gate failure.
6. **It must transpile through esbuild** (the harness bundles with esbuild;
   an esbuild error is an automatic gate failure).

## The render harness

Lives at `/tmp/mp3d-render` (see its README). Usage:

```sh
cd /tmp/mp3d-render
node render.mjs <ComponentName> [--night] [--angle=deg] [--out=path] [--wait=ms] [--preview=N]

node render.mjs Carousel                 # day  -> shots/Carousel.png
node render.mjs Carousel --night         # night -> shots/Carousel-night.png
node render.mjs Carousel --angle=45      # drag-orbits the first canvas 45°
node render.mjs UIWindow --preview=1     # mount ONE preview (default: all stacked)
node render.mjs GuestInfo --wait=6000    # longer settle (default 3500 ms)
```

What it does: imports `components/<Name>/<Name>.previews.tsx` (falls back to
the named export of `index.tsx`), esbuild-bundles it (JSX automatic,
react/react-dom/three bundled in, iife, `NODE_ENV=production`), writes a
self-contained HTML page, opens it at 900x700 in headless chromium with
SwiftShader software GL (deterministic — no GPU context losses), waits for
the scene to settle, then screenshots. Page console errors/warnings are
echoed as `[page:*]`; "GPU stall due to ReadPixels" warnings are benign.
`--night` clicks every `button[aria-label="Switch to night"]` then waits
~2.2 s for the light lerp. `--angle` simulates a canvas drag
(`dx = -deg·π/180/0.01`, Stage orbit `az -= dx * 0.01`).

### Rebuilding the harness anywhere

The harness is disposable — recreate it in any empty folder:

```sh
mkdir mp3d-render && cd mp3d-render
npm i three@0.169 react react-dom esbuild playwright
npx playwright install chromium
```

Then a `render.mjs` that (1) writes a bootstrap tsx importing the component's
previews from the design-system checkout, (2) bundles it with esbuild
(`bundle: true, format: 'iife', jsx: 'automatic'`, `nodePaths` pointing at
this folder's `node_modules`, `define: { 'process.env.NODE_ENV':
'"production"' }`), (3) inlines the bundle into one HTML file, (4) opens it
with playwright chromium launched with `--use-angle=swiftshader` at 900x700,
waits ~3.5 s, and (5) `page.screenshot()`s it. Pin `three@0.169` — it must
match the design system's version.

## Workflow summary

```
edit component -> render day/night/angle -> score /100 -> fix -> re-render
                                                  ^                |
                                                  +----------------+
                                        ship ONLY at 100/100
```

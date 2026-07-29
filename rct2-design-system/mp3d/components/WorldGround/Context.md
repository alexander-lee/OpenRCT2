# WorldGround

**CANONICAL IMPORT — copy exactly:** `import { WorldGround } from './components/WorldGround';`

**LAY A WORLD'S OWN FLOOR.** `<WorldGround plan={W} />` tiles the world's theme `ground` dress
across its rect, settled onto the terrain.

## Why it exists

`<World>` registers a REGION and builds nothing, and `theme.pathSurface` re-skins only the
**streets**. Everything either side of them stayed the climate's default grass — so a volcanic
caldera and an enchanted glade were the same green field with different props on it. That is
the single biggest reason five declared worlds still read as one place from any distance.

**And why it has its own folder:** it used to live inside `SetPieceKit`, where it was exported
and published — and no generated park ever used it. `install_code_component` surfaces
components by FOLDER, so a component buried in a kit is invisible to an agent installing
pieces by name. The first five-world park mounted `<WorldLandmark>` on all five worlds and
`<WorldGround>` **zero** times. `SetPieceKit` still re-exports it, so old imports keep working.

## How it looks like ground

Tone is sampled from **smooth value noise in world space** (~7 u wavelength, two octaves),
quantised into an **eight-step ramp** that runs shadow → `patch` → `soil` → sun-bleached.

That is not the obvious design, and the obvious one is wrong. The first version picked each
tile's tone with an independent `hash01`, and **an independent draw per cell on a lattice IS a
chequerboard** — roughly two thirds of neighbours differ, so the eye sees the grid and nothing
else. Adding tones made it worse: four random tones is a busier chequerboard than two. Tone has
to be spatially CORRELATED before any of the rest matters.

Three other things came out of the same look pass:

- **Tiles are 1.2 u, not 2.4** — the tile size is the resolution the tone field is sampled at,
  so a coarse tile stair-steps every blob edge back into a visible grid.
- **Each tile takes one of four quarter turns**, so the texture canvas does not repeat in
  lockstep across the rect and read as wallpaper.
- **`repeat` is baked into the UVs, not set on the material.** `mergedBoxes` deliberately forces
  the material repeat to `[1, 1]` ("per-part repeats live in the baked UVs"), so the
  `repeat: [2, 2]` this component used to pass was silently dropped and every tile stretched a
  single copy of a 128 px canvas across itself. That is why the floor read as flat squares.

`patchiness` no longer gates a coin flip; it sets how far the field swings along the ramp.

## The six dresses

| theme | soil | patch | reads as |
|---|---|---|---|
| `fire` | dark basalt | ash grey | cooled lava, patchiness 0.40 |
| `pirateBeach` | pale sand | wet sand | tidal beach, 0.42 |
| `steampunk` | packed grey-brown | worn lighter | works yard, 0.35 |
| `enchantedForest` | deep moss | shade green | broken glade floor, 0.45 |
| `neon` | near-black asphalt | lighter grey | wet city street, 0.35 |
| `default` | park green | lighter green | the Original mown lawn, 0.30 |

## API

```tsx
<WorldGround plan={COVE} />                 // the default: 1.2 u tiles
<WorldGround plan={COVE} tile={2.4} />      // coarser, for a very large rect
<WorldGround plan={COVE} detail={0.8} />    // finer texture grain
```

| prop | default | meaning |
|---|---|---|
| `plan` | — | the `worldPlan`; its `theme.ground` picks the dress and its `region` the extent |
| `tile` | `1.2` | tile size in units — also the resolution of the tone field |
| `detail` | `1.2` | world units of ground per ONE copy of the texture canvas |

`buildWorldGroundScene(THREE, plan, park, opts)` is the same thing as a plain builder, exported
for `harness/mp3d-render/shot-world-ground.mjs`. A body that lives inside `useComposable` cannot
be photographed, which is exactly how the texel-density bug shipped unseen.

## Mount order

```tsx
<Paths … />
<WorldGround plan={W} />     {/* the floor goes down FIRST */}
<WorldLandmark plan={W} />   {/* then the land's giant */}
<World plan={W} />
<Bazaar plan={W_ROW} />      {/* …then everything that stands on it */}
```

## Contract

- **Deterministic** — the patch scatter is hashed off the theme's `seedOffset`, never
  `Math.random`; a remount is identical.
- **Merged** — EIGHT draw calls per world (one per tone band), not one per tile.
  Triangles rise with the finer grid; on a real GPU the frame is bound by draw calls, not
  triangles, so that is the right side of the trade.
- Tiles settle on `park.floorAt` and sink **0.025 u**, so paths, plaza tiles and ride pads
  always sit proud of the floor.
- Registers **no footprint** and blocks nothing — it is a floor, not an obstacle.
- **No import from `SetPieceKit`** — that kit re-exports this component, so pulling a value
  back out of it would be a runtime cycle. The fallback dress and the plan shape are declared
  locally instead.

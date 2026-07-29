# Kit

**CANONICAL IMPORT — copy exactly:** `import { tree, rock } from './components/Kit';`
*(never from `'./Park'`: only the `<Park>` wrappers + track-piece JSX live there. A wrong
specifier makes esbuild refuse the WHOLE bundle — the round-8 black-page failure.)*

Scenery kit showcase: trees, bench, bin, lamp, fountain, statue and flower bed together.

Built with three.js on the shared Stage; modelled from the authentic RCT2 sprite.

## The eleven builders

`tree(t, { shape: 'round' | 'pine' | 'palm' | 'willow', scale })` · `bench(t)` · `bin(t)` ·
`hedge(t, len)` · `flowerBed(t)` · `rock(t, scale)` ·
`statue(t, 'obelisk' | 'knight' | 'urn' | 'giraffe')` · `foodStall(t)` · `fence(t, len)` ·
`lamp(t)` · `fountain(t)`

Static builders return a `THREE.Group`; `lamp` and `fountain` return `{ group, update }`.
Scatter is a hashed-sine sequence, never `Math.random` — the same asset is byte-identical
on every mount.

## Layout: four modules, one entry point

`index.tsx` re-exports everything; the builders live in `plants.ts` (tree, hedge,
flowerBed, rock) and `props.ts` (bench, bin, statue, foodStall, fence, lamp, fountain) over
`shared.ts` (palette, `hash01`, `span`, `basis`). Split the way SceneryPack was:
`write_design_system_files` replaces WHOLE files with no patch API, so one 74 KB module was
past the point where a push is safe. The import path above is unchanged.

## Two rules any edit here has to keep

**1. Batch, don't sprinkle.** `tree` is the most-placed asset in the system —
`ParkBuilder/dressing` scatters it by the hundred, `Boulevard` lines every street,
`CoasterBuilder` wraps every layout — and one mesh is one DRAW CALL per instance. Every
repeated part goes through `mergedBoxes` / `mergedParts` from `../Stage`, which is how the
2026-07 detailing pass added mouldings, root flares, frond leaflets and two-tone canopies
while the four tree shapes went 7/5/14/12 meshes → 4/4/4/5. Measured on a 48-plot park
with 160 trees: **2797 → 1726 draw calls**.

**2. `tree`, `bench` and `bin` are dimensionally FROZEN.** Downstream layout code positions
them, so both the group AABB and the per-mesh planted-footprint radius `<Placed>` derives
(`Park/wrappers.tsx` `groundFootprintRadius`) must not move:

| builder | AABB min → max | planted radius |
| --- | --- | --- |
| tree round | `[-1, 0, -0.9] → [1.05, 2.4, 0.86]` | 0.200 |
| tree pine | `[-0.55, 0, -0.55] → [0.55, 2.46, 0.55]` | 0.160 |
| tree palm | `[-0.84, -0.055, -0.882] → [0.88, 1.82, 0.882]` | 0.120 |
| tree willow | `[-0.635, 0, -0.611] → [0.635, 2.1, 0.611]` | 0.180 |
| bench | `[-0.5, -0.01, -0.3] → [0.5, 0.87, 0.22]` | 0.500 |
| bin | `[-0.18, 0, -0.18] → [0.18, 0.575, 0.18]` | 0.160 |

`bench` also keeps its ORIENTATION contract: the backrest is at −z, so the seat looks down
local **+z** (`SetPieceKit`'s `setPieceBench` relies on it).

The planted radius is the subtle one — `groundFootprintRadius` is PER MESH, so merging a
root flare into the trunk's batch changes it even though the group AABB is untouched.
Anything reaching wider than the frozen radius at grade (pine's branch stubs, willow's
limbs) goes in a batch whose own `min.y` clears the 0.45 band.

## Verifying a change

`<ScenePreview>` auto-rotates and takes no camera prop, so `render.mjs` cannot be used to
judge geometry. Use the harness:

```
node shot-kit.mjs treeRound treePine --views=kit-views   # fixed ortho FRONT/BACK/SIDE/TOP + 3/4
node probe-kit-cost.mjs                                  # meshes, triangles, AABBs
node probe-kit-attach.mjs                                # nothing floats, nothing is buried
```

`probe-kit-attach` grades connected SUB-SOLIDS, not meshes — with everything merged, a
mesh-level test would never see a leaflet floating off its own frond. It found the lamp
column standing 0.02 above its socle and the whole foodStall roof hanging 0.06 clear of the
frame; both are fixed. `--nudge=treePalm:60:0,0.35,0` makes it fail on purpose.

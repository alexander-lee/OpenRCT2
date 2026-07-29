# WorldLandmark

**CANONICAL IMPORT — copy exactly:** `import { WorldLandmark } from './components/WorldLandmark';`

**ONE GIANT SET-PIECE PER WORLD.** `<WorldLandmark plan={W} />` reads the world's own theme and
mounts its landmark — one tag per world, the partner of `<WorldGround>`. The ground says what
the land is made of; the landmark says what it **is**.

## Why it exists

`fire` had `<Volcano>` — radius **2.75** (5.5 tiles across), height **2.55**, a cone visible from
the gate. No other world had anything of that mass. Their biggest pieces are *props*:

| world | its previous biggest piece | size |
|---|---|---|
| `pirateBeach` | `<WreckedHull>` | 1.8 long × 0.78 tall |
| `steampunk` | `<GiantGear>` | r 0.64 × 1.10 tall |
| `enchantedForest` | `<GiantToadstools>` | r 0.94 × 1.51 tall |
| `neon` | `<MirrorBallPylon>` | 3.27 tall but **thin** — a pole, not a mass |

So the caldera read as a place and the other four read as a lawn with ornaments on it. Every
world now gets a `<Volcano>`-class anchor.

## The five giants

| theme | landmark | ground radius | reads as |
|---|---|---|---|
| `fire` / `emberfall` | `<Volcano>` (the original) | 2.75 | cone, crater, lava flows |
| `pirateBeach` / `tidewater` | **Beached Galleon** | 3.1 | a whole ship heeled over to port: ONE lofted hull SURFACE (25 stations x 19 points from fair beam/depth/sheer curves), three wales per side with a torn gap, exposed frames, lofted deck + bulwarks, gun ports, transom, two-tier sterncastle, raked stem and bowsprit, mainmast snapped two-thirds up |
| `steampunk` / `brasswork` | **Great Zeppelin** | 2.6 | a rigid airship moored to its mast — 12 u envelope, brass ring frames, tail fins, guy lines, and a DETAILED gondola (rounded forefoot, promenade window band with mullions, raked control-car windscreens, cambered ribbed roof, door + steps + handrails, keel skid, exhaust stacks, red/green nav lights) with cowled engine nacelles and spinning props; she yaws, rolls and rises gently at her mooring |
| `enchantedForest` / `thornwick` | **Dragon Roost** | 2.7 | a claw-raked crag of five stacked tiers under a ~63-stick WOVEN nest (three crossing rim courses, a radial lining tipped into the bowl, long sticks jutting out over the drop), a clutch of five eggs that pulse after dark (one cracked, cap tipped off), a shed scale and a gnawed bone in the moss |
| `neon` / `pulse` | **Disco Ball Floor** | 3.3 | an Epcot-scale geodesic ball (r 2.05, 150 Fibonacci-placed facets) turning on four truss legs over a round 7 × 7 dance floor whose light tiles CHASE in a travelling wave; eight collar spotlights |

Radii are deliberately within a unit of each other so no world out-masses its neighbours.

## API

```tsx
<WorldLandmark plan={COVE} />                        // at the world's centre
<WorldLandmark plan={COVE} position={[42, -8]} />    // moved off a ride pad
<WorldLandmark plan={COVE} scale={0.8} />            // sized to a tight land
```

| prop | default | meaning |
|---|---|---|
| `plan` | — | the `worldPlan` — its `theme.id` picks the landmark |
| `position` | the world's centre | `[x, z]`; move it off a pad or a street |
| `scale` | `1` | uniform; the registered footprint scales with it |

**PUT ITS CELL IN `worldPlan({ include })`** or it stands outside the rect, dresses nothing and
counts for nothing toward the world's build-out.

**MOUNT ORDER:** after `<Paths>` and `<WorldGround>`, before the world's props.

```tsx
<Paths … />
<WorldGround plan={COVE} />
<WorldLandmark plan={COVE} />
<World plan={COVE} />
<Bazaar plan={COVE_ROW} />
```

## Contract

- **Deterministic.** All jitter is hashed (`h01`), never `Math.random` — a remount is identical.
- **Night-gated.** The dragon eggs, the mirror ball's facets and the tower uplights read the
  Stage day/night cycle through `nightKOf(group)`. **`nightKOf` takes the OBJECT, not the time** —
  passing a number throws `Cannot read properties of undefined (reading 'nightK')`, which is an
  uncaught page error and blanks the park. That mistake was made once here; do not repeat it.
- **Registers a footprint**, so the OBB sweep and guest routing both go around it.
- Builders are exported (`buildBeachedGalleon`, `buildGreatZeppelin`, `buildDragonRoost`,
  `buildDiscoBallFloor`) for previews and for direct imperative use.
- **`<ScenePreview>` has no `build` prop** — the imperative hatch is `dress(t, g, api)`. A
  mistyped prop is silently ignored, which is how the first previews here rendered an empty
  ground disc and nothing else.

## Detail pass (2026-07-28)

Four meshes were reported as reading wrong, and each had the same root cause — a
shape faked with the cheapest primitive that could stand in for it:

| reported | what it actually was | now |
|---|---|---|
| "boat looks like it's all the same disk" | 15 scaled SPHERES threaded on the centreline; neighbours differ by a few % of beam, so the eye reads one disk repeated, and every slice is its own convex blob so the silhouette is scalloped | a real lofted SURFACE from beam/depth/sheer curves — `sect(u, w)` walks a station, `loft(rows)` triangulates the grid. One mesh, one draw call |
| "zeppelin car doesn't have enough detail" | a box, a nose cylinder and eight flat window squares | a little boat: forefoot, promenade glazing with mullions, cambered ribbed roof, door/steps/rails, keel skid, plumbing, nav lights — small parts MERGED, so ~10 draw calls |
| "nest, all of the sticks are laid flat" | every stick placed with `rotZ: Math.PI/2` at one of three fixed heights = horizontal pencils on a table | sticks placed FROM THEIR TWO ENDS (the rotation taking local +x onto b−a), in three crossing rim courses plus a radial lining and out-jutting spars |
| "disco ball has a fake reflection effect" | facets `emissive` in magenta/cyan/amber — a glowing beach ball | metalness 1 / roughness 0.05 with a cached equirectangular canvas `envMap`; the colour work belongs to the floor and the lamps, which actually emit |

**The transferable lesson: `rotX/rotY/rotZ` cannot express an arbitrary direction,
and reaching for them is what flattens things.** Anything that should point
somewhere — a stick, a strake, a frame, a spar — is placed from its endpoints via
`setFromUnitVectors` + `Matrix4.setPosition`, which also drops straight into a
`mergedBoxes` spec as `matrix`, so 60 oriented parts still cost one draw call.


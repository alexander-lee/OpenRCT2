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
| `pirateBeach` / `tidewater` | **Beached Galleon** | 3.1 | a whole ship heeled over to port: 11-station lofted hull, sheer strakes with a torn gap, exposed frames, stem post and bowsprit, mainmast snapped two-thirds up, topmast lying in the sand |
| `steampunk` / `brasswork` | **Great Zeppelin** | 2.6 | a rigid airship moored to its mast — 11.5 u envelope on 22 lofted rings, brass ring frames, tail fins, gondola with engine nacelles and props, guy lines; she yaws, rolls and rises gently at her mooring |
| `enchantedForest` / `thornwick` | **Dragon Roost** | 2.7 | a claw-raked crag of five stacked tiers under a 22-stick nest, a clutch of five eggs that pulse after dark (one cracked, cap tipped off), a shed scale and a gnawed bone in the moss |
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

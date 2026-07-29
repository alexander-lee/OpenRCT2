# DiscoBallFloor

**CANONICAL IMPORT — copy exactly:** `import { DiscoBallFloor } from './components/DiscoBallFloor';`

**Pulse District's GIANT** — a giant mirror ball turning over a dance floor whose tiles chase.

## Why it exists

`fire` had `<Volcano>` (radius 2.75, height 2.55, a cone visible from the gate) and no other
world had anything of that mass. Their biggest pieces were PROPS — `<WreckedHull>` 1.8 × 0.78,
`<GiantGear>` r 0.64, `<GiantToadstools>` r 0.94, and neon's pylons are tall but thin. So the
caldera read as a place and the other four read as a lawn with ornaments on it. This is
`neon`'s answer, built to the same class.

An Epcot-scale geodesic ball — radius 2.05, 150 facets placed on a Fibonacci sphere so coverage is even instead of clumping at the poles, most mirror-white with magenta, cyan and amber emissive among them — turning on four truss legs above a round dance floor of light tiles.

The floor CHASES: a travelling wave across six phase buckets, never a strobe. Facets and tiles are MERGED (150 separate meshes crashed the render browser); the ball still turns as one group.

## API

```tsx
<DiscoBallFloor />                                  // at the origin
<DiscoBallFloor position={[42, -8]} rotation={0.4} />  // placed and turned
<DiscoBallFloor scale={0.8} />                        // sized to a tight land
```

Standard `composable` props: `position` `[x, z]`, `rotation`, `scale`, `seed`.

**Ground radius 3.3** — keep ride pads and streets clear of it; it registers a footprint,
so the OBB sweep and guest routing both go around it.

## In a world

Either mount it by name, or let the dispatcher pick it:

```tsx
<Paths … />
<WorldGround plan={W} />        {/* the floor */}
<WorldLandmark plan={W} />      {/* -> this component, chosen off W.theme.id */}
<World plan={W} />
```

**Put its cell in `worldPlan({ include })`** or it stands outside the rect, dresses nothing
and counts for nothing toward the world's build-out.

## Contract

- **Deterministic** — all jitter is hashed (`h01`), never `Math.random`; a remount is identical.
- **Night-gated** through `nightKOf(group)`. It takes the OBJECT, not the time.
- The imperative builder is exported (`buildDiscoBallFloor`) for previews and direct use.

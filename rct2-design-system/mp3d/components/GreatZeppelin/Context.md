# GreatZeppelin

**CANONICAL IMPORT — copy exactly:** `import { GreatZeppelin } from './components/GreatZeppelin';`

**Brasswork Foundry's GIANT** — a moored airship, envelope on ring frames, gondola and props, guy lines to the ground.

## Why it exists

`fire` had `<Volcano>` (radius 2.75, height 2.55, a cone visible from the gate) and no other
world had anything of that mass. Their biggest pieces were PROPS — `<WreckedHull>` 1.8 × 0.78,
`<GiantGear>` r 0.64, `<GiantToadstools>` r 0.94, and neon's pylons are tall but thin. So the
caldera read as a place and the other four read as a lawn with ornaments on it. This is
`steampunk`'s answer, built to the same class.

A rigid airship riding at its mooring mast: an 11.5-unit envelope lofted from 22 rings on a real airship profile (blunt nose, fat third, long taper), five brass ring frames, four tail fins, a slung gondola with two engine nacelles and propellers, and guy lines to the ground.

She BREATHES at her mooring — a slow yaw, a slight roll and a gentle rise and fall, never a spin. The tallest thing in the catalogue.

## API

```tsx
<GreatZeppelin />                                  // at the origin
<GreatZeppelin position={[42, -8]} rotation={0.4} />  // placed and turned
<GreatZeppelin scale={0.8} />                        // sized to a tight land
```

Standard `composable` props: `position` `[x, z]`, `rotation`, `scale`, `seed`.

**Ground radius 2.6** — keep ride pads and streets clear of it; it registers a footprint,
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
- The imperative builder is exported (`buildGreatZeppelin`) for previews and direct use.

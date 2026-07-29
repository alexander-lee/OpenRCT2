# BeachedGalleon

**CANONICAL IMPORT — copy exactly:** `import { BeachedGalleon } from './components/BeachedGalleon';`

**Tidewater Hollow's GIANT** — a broken ship heeled over in the sand, mast snapped, frames showing through a torn side.

## Why it exists

`fire` had `<Volcano>` (radius 2.75, height 2.55, a cone visible from the gate) and no other
world had anything of that mass. Their biggest pieces were PROPS — `<WreckedHull>` 1.8 × 0.78,
`<GiantGear>` r 0.64, `<GiantToadstools>` r 0.94, and neon's pylons are tall but thin. So the
caldera read as a place and the other four read as a lawn with ornaments on it. This is
`pirateBeach`'s answer, built to the same class.

A whole ship heeled over to port in the sand: an eleven-station lofted hull fat amidships and tapering fore and aft, sheer strakes down both sides with a torn gap where the planking is gone, exposed frames through the tear, stem post and bowsprit, and the mainmast snapped two-thirds up with its topmast lying in the sand beside her.

Not the 1.8-unit hull FRAGMENT `<WreckedHull>` gives — this is the ship that fragment came off.

## API

```tsx
<BeachedGalleon />                                  // at the origin
<BeachedGalleon position={[42, -8]} rotation={0.4} />  // placed and turned
<BeachedGalleon scale={0.8} />                        // sized to a tight land
```

Standard `composable` props: `position` `[x, z]`, `rotation`, `scale`, `seed`.

**Ground radius 3.1** — keep ride pads and streets clear of it; it registers a footprint,
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
- The imperative builder is exported (`buildBeachedGalleon`) for previews and direct use.

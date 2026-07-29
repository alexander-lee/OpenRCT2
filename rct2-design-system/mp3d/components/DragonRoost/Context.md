# DragonRoost

**CANONICAL IMPORT — copy exactly:** `import { DragonRoost } from './components/DragonRoost';`

**Thornwick Glade's GIANT** — a claw-raked crag under a stick nest of five eggs that pulse after dark.

## Why it exists

`fire` had `<Volcano>` (radius 2.75, height 2.55, a cone visible from the gate) and no other
world had anything of that mass. Their biggest pieces were PROPS — `<WreckedHull>` 1.8 × 0.78,
`<GiantGear>` r 0.64, `<GiantToadstools>` r 0.94, and neon's pylons are tall but thin. So the
caldera read as a place and the other four read as a lawn with ornaments on it. This is
`enchantedForest`'s answer, built to the same class.

A crag of five stacked, rotated rock tiers with outcrops at the foot and three parallel CLAW RAKES gouged down one flank, moss on the shaded face. On the summit, a woven ring of twenty-two sticks around a bowl floor holds a clutch of five eggs — one already cracked, its shell cap tipped off beside a shard.

A shed scale and a gnawed bone in the moss below say the roost is OCCUPIED, not abandoned. The eggs pulse on a slow out-of-phase heartbeat.

## API

```tsx
<DragonRoost />                                  // at the origin
<DragonRoost position={[42, -8]} rotation={0.4} />  // placed and turned
<DragonRoost scale={0.8} />                        // sized to a tight land
```

Standard `composable` props: `position` `[x, z]`, `rotation`, `scale`, `seed`.

**Ground radius 2.7** — keep ride pads and streets clear of it; it registers a footprint,
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
- The imperative builder is exported (`buildDragonRoost`) for previews and direct use.

## The nest is WOVEN (2026-07-28)

Reported as **"nest for dragon roost, all of the sticks are laid flat"** — literally true: all 22
sticks were placed with `rotZ: Math.PI / 2` (dead horizontal) at one of three fixed heights, so the
nest read as a stack of pencils on a table.

A raptor nest is a BASKET, and a basket needs sticks that point in arbitrary directions — which
`rotX/rotY/rotZ` on a cylinder cannot express. Each stick is now placed **from its two ends**:
`setFromUnitVectors` builds the rotation taking local +x onto `b − a` and `Matrix4.setPosition`
puts it at the midpoint. On that footing the nest is:

- **three rim courses** (16 / 14 / 12 sticks), each rotated off the one below and each leaning
  further out, with both ends at different heights — the crossing is what reads as "woven";
- **14 radial sticks tipped down into the bowl** — the lining, and what stops the rim reading as a
  fence;
- **7 long spars jutting out and up** over the drop, because a nest is never tidy at its edge;
- a dished bowl floor with a moss lining.

~63 sticks in **2 draw calls**: they are boxes in two `mergedBoxes` batches (one per colour), and at
0.08 u thick a square section is indistinguishable from a round one.

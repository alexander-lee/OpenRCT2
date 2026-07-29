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

## The hull is a SURFACE (2026-07-28)

Reported as **"the boat looks like it's all the same disk"**, and it was: the hull was 15 scaled
SPHERES threaded on the centreline. Adjacent stations differ by a few percent of beam, so the eye
read one disk repeated down the length, and because each slice was its own convex blob the
silhouette came out scalloped rather than fair.

It is now the surface it was always drawing:

- **three fair curves** — `beamAt(u)`, `depAt(u)`, `sheerAt(u)` — define a station;
  `sect(u, w)` walks that station from port deck edge through the keel to starboard, with the
  exponents doing the turn of bilge (`|w|^1.85` on depth, `|w|^0.68` on beam);
- **`loft(rows)`** triangulates the 25 x 19 grid into ONE indexed `BufferGeometry`
  (one mesh, one draw call), plus a fan for the **transom**;
- the **deck** and both **bulwarks** are lofted off the same curves, so they follow the sheer
  instead of being straight boxes laid on top of a curve;
- **`side: DoubleSide` is deliberate** — she is a broken shell heeled 0.20 to port with a hole in
  her starboard planking, so the inside of the far side is part of the picture.

**Wales, keel, frames, cap rails, deck seams and gun ports are placed FROM THEIR TWO ENDS**
(`setFromUnitVectors` gives the rotation taking local +x onto b − a; `Matrix4.setPosition` puts it
there) and go into three `mergedBoxes` batches — ~90 oriented parts, 3 draw calls. `rotX/rotY/rotZ`
cannot express "follow this curve", and reaching for them is what produced the disks.

**One trap, paid for once:** after `rotZ = θ` a cylinder's axis points `(−sinθ, cosθ, 0)`, so a
bowsprit needs `θ = −(π/2 − rake)`. The `+` version aims it aft-and-down and leaves the spar
hanging in the air off the bow.

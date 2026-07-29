# Chairlift

**CANONICAL IMPORT — copy exactly:** `import { Chairlift } from './components/Chairlift';`
*(never from `'./Park'`: only the `<Park>` wrappers + track-piece JSX live there. A wrong
specifier makes esbuild refuse the WHOLE bundle — the round-8 black-page failure.)*

Chairlift: orange buckets with flags gliding a cable between pylons (CLIFT1). The stock layout is a real out-and-back cable loop — two bullwheel pylons, six cabins riding the stadium loop, pylon + cabin lamps after dark.

Original three.js model on the shared Stage (day/night lighting); proportions and palette referenced from the RCT2 asset library.

## Upholstered buckets

The buckets are properly **cushioned**, following the CoasterCar upholstery pattern (dark moulded shell + fabric-textured pads proud of it). Two things made that possible:

- The bucket shell is now an **OPEN cone** (a `CylinderGeometry(..., openEnded)` with a double-sided material) and the rim is a **torus RING** rather than a solid disc — previously a capped cylinder plus a full-width rim lid hid the entire interior, so no amount of padding could be seen.
- Inside it: a dark moulded **seat pan**, a **DOMED fabric squab** (a squashed ellipsoid, crown at −0.585 = the hip contact line) with a **rolled nose** under the knees, a reclined dark **backrest shell** carrying a padded fabric **backrest** flanked by two vertical **bolster rolls**, a **head roll** capping the shell and a **lumbar roll** bridging squab → backrest. Saddle-tan fabric (`0x8a7150`) so the padding reads against the red bucket.
- One foam-sleeved **safety bar** sits exactly at the rider's hands on two side arms (the old duplicate grab bar is gone).

Every pad interpenetrates its neighbour by ≥ 0.005, so nothing floats. The `seatWorld` anchor (`0, −0.743, 0.01`) puts a guest's hips 0.005 INTO the squab crown. Identical geometry on the stock loop and on piece-composed courses.

## Track pieces

Optional `pieces` array or JSX piece children (children win) replace the stock loop with a piece-composed cable circuit (compileTrackPieces, auto-closed; report on the group's `userData.trackReport`). The vocabulary is strictly HORIZONTAL — `station` / `straight` (`flat`) / `turnL` / `turnR` / `sbend`; everything else (`lift`/`drop`/`hill`/helixes/corkscrews) is STRIPPED with a console.warn naming the piece — chairlifts never ramp up or down. Only the CABLE sags a shallow catenary belly between the cantilever line towers (masts offset beside the line so cabins always clear them); the drive terminal, flat bullwheel and boarding deck sit on the `station` piece, and cabins glide the closed rope at the stock speed with the same night lamps. Defaults are untouched when no pieces are given.

```jsx
<Chairlift pieces={[
  'station',
  { type: 'turnL', angle: 120, radius: 2.2 },
  { type: 'straight', length: 2.6 },
  { type: 'turnL', angle: 120, radius: 2.2 },
  { type: 'straight', length: 2.6 },
  { type: 'turnL', angle: 120, radius: 2.2 },
]} />
```

## RCT2 station behaviour — EXCEPTION + real seats

Chairlift is the fleet-wide motion-gate **exception**: real chairlifts never stop — the cable keeps circulating through every FSM state and guests board the MOVING chairs (the update is deliberately ungated). Capacity **6** = the stock loop's 6 buckets (was 4): REAL GameManager guests ride the circulating cabins via `seatWorld` (one anchor per bucket, shared by the stock loop and piece-composed courses); decorative riders default true standalone / **false when registered**, so unfilled buckets read visibly empty. Note: a piece-composed course sizes its fleet from the circuit length (4–14 buckets) — keep `capacity ≤` that count when registering a custom course.

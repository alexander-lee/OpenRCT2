# BobsleighCar — DEPRECATED / REMOVED FROM THE CATALOG

**Do not use.** BobsleighCar has been removed from the catalog. Nothing in the design system ever imported it: `<Bobsleigh>` models its own pod, and every spline / piece-composed bobsled course takes its vehicle from **SplineRideKit's `buildMiniSled`** (see `Park/pieces.tsx` — `<TrackRide profile="bobsled">`).

**Replacement:** `<Bobsleigh>` for the whole ride, or `buildMiniSled(three)` from `components/SplineRideKit` for just the sled.

The files survive only as a thin deprecated alias so any existing design that still references `<BobsleighCar>` keeps rendering — the same treatment the retired `Road` component got, because the publish API cannot delete files. `buildBobsleighCarScene` now delegates straight to `buildMiniSled` inside the old chute; the bespoke sled geometry is gone.

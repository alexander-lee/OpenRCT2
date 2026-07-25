# PlayerCam

An on-ride / chase camera bound to any vehicle `Object3D`, rendered as a
Stage viewport inset (bottom-left by default — `rules/ui.md`). Not a React
component: `attachPlayerCam` is an imperative helper for use inside a Stage
`build`; the `PlayerCam` / `PlayerCamChase` React exports are the previews.

```tsx
<Stage build={(t, g, api) => {
  const coaster = buildRideSpline(t, LOOP, { profile: 'coaster' });
  const car = buildCoasterCar(t, 'front');
  const run = coaster.run([car, buildCoasterCar(t, 'end')], { spacing: 1.15 });
  const cam = api && attachPlayerCam(t, api, car, { mode: 'onboard' });
  return (time) => run(time); // cam.detach() to remove early
}} />
```

## `attachPlayerCam(t, api, vehicle, opts?) => { detach(), camera }`

| Opt | Type | Default | Description |
| --- | --- | --- | --- |
| `mode` | `'onboard' \| 'chase'` | `'onboard'` | Camera behaviour (below). |
| `rect` | `StageViewportRect` | `{ x: 0.02, y: 0.68, w: 0.3, h: 0.3 }` | Normalized inset rect, bottom-left default — never the top-right switcher or the bottom-right Park Info slot. |
| `seatHeight` | `number` | `0.55` | Onboard: camera height above the vehicle origin. |
| `fov` | `number` | `60` | Perspective FOV. |

Also exports `PlayerCamMode`, `PlayerCamOpts`, `PlayerCamHandle`.

## Modes

- **onboard** — the camera is PARENTED to the vehicle at seat height looking
  forward, so the vehicle's world matrix carries it with zero lag. Kit cars
  orient local +z along the travel direction (`SplineCoaster` `run()`
  `makeBasis(side, up, fwd)`, `components/SplineCoaster/index.tsx:455`), so
  the camera yaws π to aim its −z view axis down +z.
- **chase** — each frame (rAF) the camera re-poses from
  `vehicle.matrixWorld`: 2.2 units behind the travel direction, 0.9 up,
  `lookAt` the vehicle.

`detach()` cancels the rAF, removes the registered viewport and unparents the
camera. Works with any Object3D whose +z is "forward" — coaster cars, karts,
log flumes, the GameManager's rides via their vehicle groups.

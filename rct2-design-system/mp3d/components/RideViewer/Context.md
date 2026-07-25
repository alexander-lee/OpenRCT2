# RideViewer

The RCT2 **Ride window** composed on `UIWindow` chrome (never custom chrome —
`rules/ui.md`): colour-coded status line, queue length, riders/capacity, total
customers, and the RCT2 viewport tab reborn as a **live camera inset** — a
small THREE camera slowly orbiting the ride's `boardPoint`, rendered through
`api.addViewport` into the bottom-left slot (the default inset corner per
`rules/ui.md`; never the top-right day/night slot).

```tsx
<Stage build={(t, g, api) => { ...; handle = mgr.registerRide(cfg); setLive({ api, ride: handle }); }} />
{live && <RideViewer ride={live.ride} api={live.api} onClose={...} />}
```

## Props

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `ride` | `RideViewerRide` | — | A GameManager `registerRide` handle: `{ name, status(), queueLength(), occupancy(), boardPoint(), totalRides?() }`. |
| `api` | `StageApi` | — | The Stage build API (third `build` arg) — supplies `scene` + `addViewport`. |
| `anchor` | `UIWindowCorner \| { x, y }` | `{ x: 10, y: 10 }` | Window placement. Never top-right. |
| `onClose` | `() => void` | — | Renders the X button; parent unmounts. |
| `rect` | `StageViewportRect` | `{ x: 0.02, y: 0.68, w: 0.3, h: 0.3 }` | Normalized inset rect (bottom-left default). |

Also exports `RideViewerStatus`, `RideViewerRide`, `RideViewerProps`.

## Status line — RCT2 references

String set and colour coding follow `Ride::formatStatusTo`
(`src/openrct2/ride/Ride.cpp:528-564`): **Open** (green `#1E7A28`), **Closed**
(grey `#5A5A52`), **Broken down** (red `#B01818` — RCT2 draws broken/crashed
statuses red-outlined, `openrct2-ui/windows/Ride.cpp:2537-2540`), **Being
repaired** (amber `#B07818`). The queue line mirrors `GetStatusStation`'s
empty / 1 person / N people strings (`openrct2-ui/windows/Ride.cpp:2622-2634`).

## Behaviour

- Polls the ride handle 4×/s (`setInterval` 250 ms) for the body text.
- The inset camera is created on mount, added to `api.scene`, registered with
  `addViewport`, driven by its own rAF (deterministic slow orbit, 0.35 rad/s
  at radius 2.6, 1.5 above the boardPoint) and fully removed on unmount.
- One `UIWindow` per corner; keep the inset clear of anchored windows.

# ParkInfo

**CANONICAL IMPORT — copy exactly:** `import { ParkInfo } from './components/ParkInfo';`
*(never from `'./Park'`: only the `<Park>` wrappers + track-piece JSX live there. A wrong
specifier makes esbuild refuse the WHOLE bundle — the round-8 black-page failure.)*

The park-wide ride roster on `UIWindow` chrome — anchored
**`corner="bottom-right"` and `collapsible`, both hardcoded** because
`rules/ui.md` mandates them for the Park Info window. Each registered ride
gets a row: a colour-coded status dot, the name and the live queue count;
**clicking a row teleports the main orbit camera** to a vantage of that ride
via `api.setCameraPose` (position `boardPoint + [3.4, 2.6, 3.4]`, target the
boardPoint) — orbit dragging keeps working afterwards.

```tsx
<Stage build={(t, g, api) => { const mgr = createGameManager(t); ...; setLive({ api, mgr }); }} />
{live && <ParkInfo manager={live.mgr} api={live.api} />}
```

## Props

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `manager` | `ParkInfoManager` | — | A GameManager (or anything exposing `rides(): { name, status, queue, boardPoint }[]`, optionally `stats()` for the guests/happiness header line, and optionally `guests()` — which enables the "Guest thoughts" button). |
| `api` | `StageApi` | — | The Stage build API — supplies `setCameraPose` (called optionally, so older Stages without it are safe). |
| `width` | `number` | `216` | Window width in px. |

Also exports `ParkInfoStatus`, `ParkInfoRideRow`, `ParkInfoManager`,
`ParkInfoProps`.

## Status dots — RCT2 reference

Colour-coded like the ride-window status line (`Ride::formatStatusTo`,
`src/openrct2/ride/Ride.cpp:528-564`; broken states draw red-outlined per
`openrct2-ui/windows/Ride.cpp:2537-2540`): green `#1E7A28` open, grey
`#5A5A52` closed, red `#B01818` broken down, amber `#B07818` being repaired.

## Behaviour

- Polls `manager.rides()` (and `stats()`) every 300 ms.
- When the manager exposes `guests()`, a bevelled **"Guest thoughts" button**
  (pixel guest icon) sits under the roster — it toggles the `GuestThoughts`
  window (`components/GuestThoughts`, the RCT2 Guest List summarised-thoughts
  view), rendered from ParkInfo's own state at its default free position
  (clear of the top-left slot and the switcher).
- Rows never leave the window's inset panel; long names ellipsise.
- Being bottom-right anchored, it owns that corner — keep viewport insets and
  other windows clear of it (`rules/ui.md`).

# GuestThoughts

**CANONICAL IMPORT — copy exactly:** `import { GuestThoughts } from './components/GuestThoughts';`
*(never from `'./Park'`: only the `<Park>` wrappers + track-piece JSX live there. A wrong
specifier makes esbuild refuse the WHOLE bundle — the round-8 black-page failure.)*

The RCT2 **Guest List window's SUMMARISED THOUGHTS view** on `UIWindow`
chrome: every in-park guest's freshest thought is grouped into one row —
a strip of up to four small pixel emotion faces (`UIIcons`, via
`emotionOf` from GuestInfo), the quoted thought text, and a right-aligned
"N guests" count — with the most-thought rows first.

```tsx
<Stage build={(t, g, api) => { const mgr = createGameManager(t); ...; setLive({ api, mgr }); }} />
{live && <GuestThoughts manager={live.mgr} onClose={() => setOpen(false)} />}
```

**Entry point:** ParkInfo (which already owns the manager) carries a
"Guest thoughts" button that toggles this window — that is how a composed
`<Park>` exposes it. It can also be mounted directly as above.

## Props

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `manager` | `GuestThoughtsManager` | — | Anything exposing `guests(): { id, happiness, nausea, state, thoughts, gone? }[]` — a GameManager qualifies. |
| `onClose` | `() => void` | — | Renders the square X title button when provided. |
| `x`, `y` | `number` | `244`, `10` | Explicit px position — the default starts clear of the top-left RideViewer/GuestInfo slot and the top-right switcher (rules/ui.md; never the top-right corner). |
| `width` | `number` | `232` | Window width in px. |
| `maxRows` | `number` | `10` | Cap on summarised rows (GuestList.cpp caps its groups too). |

Also exports `summariseThoughts(guests, maxRows)` (the pure grouping used by
the window), `GuestThoughtsGuest`, `GuestThoughtsManager`,
`GuestThoughtsProps`.

## RCT2 reference — openrct2-ui/windows/GuestList.cpp

- `GetArgumentsFromPeep` (:875-885): a guest is summarised by
  `peep.thoughts[0]` — the FRESHEST thought only; guests with none join no
  group (the empty group is erased, :850-857).
- `DrawScrollSummarised` (:718-765): each group draws a strip of small guest
  faces, the thought text, and a right-aligned "N guests" count.
- `RefreshGroups` (:860-862): groups sort by `NumGuests` descending; here the
  text is the deterministic tiebreak.
- Refresh is throttled in RCT2 (`_lastFindGroupsWait`); here the window polls
  `manager.guests()` every **500 ms** — never per frame (rules/ui.md).

## Behaviour

- Deterministic: same records in, same rows out (stable sort tiebreak).
- Faces come from `emotionOf` — happiness bands ecstatic → angry, with
  nausea/sickness overriding to the green face.
- All icons are `UIIcon` pixel art — no emoji (rules/ui.md).

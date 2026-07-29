# UIIcons

**CANONICAL IMPORT — copy exactly:** `import { UIIcon, UI_ICON_NAMES } from './components/UIIcons';`
*(never from `'./Park'`: only the `<Park>` wrappers + track-piece JSX live there. A wrong
specifier makes esbuild refuse the WHOLE bundle — the round-8 black-page failure.)*

The pixel-art icon set for ALL overlay UI (see `rules/ui.md`). Each icon is an
original hand-drawn ~10x10 pixel grid (a few are 12x12) in the RCT2
toolbar-pictogram spirit — 2-3 flat colours plus a dark outline — rendered as
crisp-edged SVG `<rect>` runs. No emoji, no icon libraries.

## API

```tsx
import { UIIcon, UI_ICON_NAMES, UIIconName } from 'components/UIIcons';

<UIIcon name="sun" />            // 20px default
<UIIcon name="wrench" size={13} /> // inline with 11px text use 12-14px
```

- `UI_ICON_NAMES`: `sun`, `moon`, `ride` (coaster hill), `guest` (head),
  `park` (tree), `camera`, `wrench` (repairs), `warning` (!), `close` (X),
  `chevronUp`, `chevronDown`, `happy`, `sad`.
- `size` is the square rendered size in px; the grid scales crisply.

## Usage conventions

- `UIDayNight` shows `sun`/`moon`; `UIWindow` title buttons use `close` and
  the chevrons; `RideViewer` status uses `ride`/`wrench`/`warning`;
  `ParkInfo` rows use `ride`; `GuestInfo` mood uses `happy`/`sad`.
- New icons: draw the grid by hand in `index.tsx` (strings of palette chars,
  `.` = transparent), keep 2-3 colours + a dark outline, add to `ICONS`.

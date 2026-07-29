# UIWindow

**CANONICAL IMPORT — copy exactly:** `import { UIWindow } from './components/UIWindow';`
*(never from `'./Park'`: only the `<Park>` wrappers + track-piece JSX live there. A wrong
specifier makes esbuild refuse the WHOLE bundle — the round-8 black-page failure.)*

The classic RCT2 window chrome in pure DOM/CSS (no images): tan bevelled frame,
dark brownish-red title bar with centred text, square bevelled close/collapse
buttons, and a darker inset content panel. **This is the base chrome for every
window in the system** — ride viewer, guest info, park info etc. must compose
it, never roll custom chrome (see `rules/ui.md`).

```tsx
<div style={{ position: 'relative' }}>
  <Stage build={...} />
  <UIWindow title="Park Information" corner="bottom-right" collapsible>
    <div>Guests in park: 512</div>
  </UIWindow>
</div>
```

## Props

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `title` | `string` | — | Centred title-bar text. |
| `children` | `ReactNode` | — | Content, rendered inside the darker inset panel. |
| `x`, `y` | `number` | `10, 10` | Explicit px position from the container's top-left. Ignored when `corner` is set. Deterministic. |
| `width` | `number` | `224` | Window width in px. |
| `onClose` | `() => void` | — | When provided, renders the square X button (right end of the title bar). Parent unmounts the window. |
| `collapsible` | `boolean` | `false` | Shows the chevron button; collapsing hides the body so only the title bar remains. |
| `corner` | `'top-left' \| 'top-right' \| 'bottom-left' \| 'bottom-right'` | — | Anchor to a container corner with a 10px inset. |

Also exports `UIWindowProps` and `UIWindowCorner`.

## Behaviour

- **Draggable from ANY point of the window** — title bar or body (pointer
  capture); the drag offset is a CSS transform on top of the anchored base
  position, so corner-anchored windows drag too. Interactive elements are
  exempt: a pointer-down on (or inside) a `button`, `a`, `input`, `select`,
  `textarea` or any `[data-nodrag]` wrapper never starts a drag, so buttons,
  row links and inputs in window bodies keep working.
- The window is `position: absolute` — mount it inside a `position: relative`
  container (typically the wrapper around a `Stage`).
- `zIndex: 4` — always below the top-right `UIDayNight` switcher (z 5).

## Chrome palette

Body `#BDB4A4`, button faces `#C0B8A8`, highlight `#E8E0D0`, shadow `#6B6456`,
outline `#3A3226`, inset panel `#B0A890`, title bar `#8C3428` (highlight
`#A84A38`, shadow `#5C2018`), title text `#F0E8D0`. Bevels are 2px on the frame,
1px on buttons and the inset panel (light top/left, dark bottom/right; inverted
when sunk/pressed).

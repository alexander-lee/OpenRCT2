# UIDayNight

**CANONICAL IMPORT — copy exactly:** `import { UIDayNight } from './components/UIDayNight';`
*(never from `'./Park'`: only the `<Park>` wrappers + track-piece JSX live there. A wrong
specifier makes esbuild refuse the WHOLE bundle — the round-8 black-page failure.)*

Icon-only day/night switcher with RCT2 tan bevelled chrome. **Stage renders one
automatically top-right** — components and previews never add their own; the
top-right slot belongs exclusively to this control (see `rules/ui.md`).

```tsx
<UIDayNight night={isNight} onToggle={() => setIsNight(n => !n)} />
```

## Props

| Prop | Type | Description |
| --- | --- | --- |
| `night` | `boolean` | Current mode. `false` shows the sun icon (raised bevel), `true` shows the crescent moon (latched pressed-in look, darker face). |
| `onToggle` | `() => void` | Click handler — flip the night state in the owner (Stage keeps the state and lerps the lighting). |

## Notes

- Icons are inline SVG (crisp at any DPI) — never text or emoji.
- Chrome palette: face `#C0B8A8` (night `#ABA294`), highlight `#E8E0D0`,
  shadow `#6B6456`, outline `#3A3226`. Pure DOM/CSS, no images.
- Placement is baked in: `position: absolute; top: 10px; right: 10px` inside
  the Stage's relative wrapper. Do not reposition or wrap it.

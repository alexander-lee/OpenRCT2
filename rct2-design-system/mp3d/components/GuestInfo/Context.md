# GuestInfo

**CANONICAL IMPORT — copy exactly:** `import { GuestInfo } from './components/GuestInfo';`
*(never from `'./Park'`: only the `<Park>` wrappers + track-piece JSX live there. A wrong
specifier makes esbuild refuse the WHOLE bundle — the round-8 black-page failure.)*

The RCT2 **Guest window**'s stats + thoughts tabs on `UIWindow` chrome (never
custom chrome — `rules/ui.md`): a mood line, six bevelled CSS stat bars in the
window's inset panel and the guest's thought ring, latest first, quoted.

```tsx
// parent polls the live record each frame and re-renders the window
const rec = manager.guests().find((g) => g.id === trackedId);
{rec && <GuestInfo guest={rec} onClose={...} />}
```

## Props

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `guest` | `GuestInfoRecord` | — | One record from `GameManager.guests()`: `{ id, name, state, happiness, hunger, thirst, energy, nausea, toilet, thoughts, position? }` (needs 0–255). |
| `onClose` | `() => void` | — | Renders the X button; parent unmounts. |
| `x`, `y` | `number` | `10, 10` | Window position — never the top-right slot. |

Also exports `GuestInfoRecord`, `GuestInfoProps` and `moodOf(happiness)`.

## RCT2 references

- **Stat bars** mirror the stats-tab progress bars
  (`openrct2-ui/windows/Guest.cpp:146-159`): happiness and energy are the
  "green" bars, hunger/thirst/nausea/toilet the red-warning bars.
- **Hunger and thirst are inverted** exactly as RCT2 does it — "the bar should
  be longer when peep->hunger is low" (`Guest.cpp:1125-1129`): the bar shows
  the NEED, so a well-fed guest has a short hunger bar.
- **Thoughts** render the 5-slot ring (`kPeepMaxThoughts` — thoughts tab
  widgets `Guest.cpp:172`, draw loop `:827-848`), latest first, fading with
  age, quoted like the in-game marquee.

## Bar colours

Happiness sweeps `hsl(120→0, 62%, 36%)` (green → red as it empties); energy
yellow `#C8A818`; hunger orange `#B05818`; thirst blue `#2860A8`; nausea
sickly green `#5A8828`; toilet brown `#7A5228`. Bars sit in a 1px sunk bevel
(light bottom/right, shadow top/left) matching the UIWindow inset chrome.

## Mood line (`moodOf`)

`>=200` Very happy, `>=160` Happy, `>=96` Fine, `>=64` Unhappy, else Angry —
matching the sim's posture thresholds (guests trudge below 96).

## Guest player camera

Pass the Stage `api` and the clicked guest's scene `object` (the `userData.guestRef` carrier — `<Park>` wires both automatically on guest click) and the window gains a live camera inset in the standard bottom-left 4:3 slot (ViewportFrame chrome): an over-the-shoulder FOLLOW cam by default, with a **Walk with guest** button that switches to a FIRST-PERSON eye cam (the guest is hidden from its own POV via the viewport hide-list). Guests are big click targets now — every peep carries an invisible body-capsule click proxy (GameManager), so clicks land reliably even on walking guests.

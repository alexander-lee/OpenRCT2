# Tycoon — an RCT2 Design System

A 100-component design system distilled from **RollerCoaster Tycoon 2**, grounded in the real
game assets and the OpenRCT2 source.

- **Aesthetic:** *modernized homage* — RCT2's color language, iconography, and theme-park
  personality, with clean modern spacing/type. (A `retro` token set can re-square the corners and
  restore 1px bevels for a pixel-faithful mode.)
- **Sources of truth:**
  - `tokens.json` — colors/type/space, generated from OpenRCT2's authentic `StandardPalette`.
  - Real game data (Steam depot `app_285330`): **29,294** sprites in `g1.dat`; **2,122** objects in
    `ObjData/` — 267 rides, 1,117 small scenery, 248 large scenery, 313 walls, 43 themed scenery
    groups, 16 park entrances, 20 path additions, 15 footpaths, 9 banners, 4 waters, 70 scenarios.
  - OpenRCT2 UI system (`src/openrct2/interface/Widget.h`, `drawing/Colour.*`, `ColourMap.*`,
    `ride/`, `entity/Peep.*`).

---

## Foundations

### The one idea: bevel, not shadow
Every RCT2 surface is drawn by one primitive (`fillInset`) over a **12-shade color ramp**. Depth is
communicated by *edge inversion*, never drop shadows:

- **Raised** (buttons, panels, tabs): `bevelHighlight` on **top + left**, `bevelShadow` on
  **bottom + right**, `base` fill.
- **Sunken / pressed** (wells, inputs, pressed buttons): inverted — shadow top-left, highlight
  bottom-right, fill lightened.
- Pressed state = flip raised→sunken. There is **no hover/press color change** in the original;
  state reads purely from bevel direction. (Homage mode may add a subtle hover tint.)

Per family, `tokens.json` exposes `base` / `bevelHighlight` / `bevelShadow` so any component can be
beveled consistently.

### Color
18 authentic 12-step ramps → `50`–`900` scales. Signature tokens:
- **neutral** `#EFF3F3 → #172323` — the warm teal-tinted RCT2 window grey (the default chrome).
- **red** `#FFDBD7 → #3F0000`, **blue** `#D7F7FF → #001B6F`, **green** `#C3FFB3 → #0F3F00`,
  **gold**, **orange**, **purple**, **pink**, **teal**, **aqua** (water), **tan/brown/sky** (wood
  & earth), plus grass/moss/seagreen/indigo/rose.
- 14 **text colors** (`black, grey, white, red, green, yellow, topaz, celadon, babyBlue,
  paleLavender, paleGold, lightPink, pearlAqua, paleSilver`).
- **Themes:** `RCT2` (default) and `RCT1` (greyer/browner chrome) — ship as alternate token maps.

### Typography
3 sprite-font sizes: **tiny 6px**, **small 10px**, **medium 10px (heavier)**. Text supports a
2-layer **outline + shadow** decoration and 3 darkness levels. Currency glyphs: guilder `ƒ`,
rouble `₽`, euro `€`. Alignment: left / centre / right.

### Space & dimensions
Base grid is the **12px row**. Bevels are 1px, gutters 2px. Key sizes: title bar 13px (24px
enlarged), close button 10px, scrollbar 10px, tab 31×27px.

### Iconography
Draw from the real sets: 6 animated **ride-category** icons, 7 **scenery-category** icons,
**weather** icons, toolbar/zoom/playback/visibility/multiplayer icons, and 28 **cursors**.

---

## The 100 components

Legend: each entry notes its RCT2 provenance → the modern UI role.

### 1 · Surfaces & Layout (15)
1. **Window / Panel** — beveled raised `frame` → base container/card surface.
2. **Title Bar** — sunken `caption`, white centered outlined text → panel header.
3. **Close Button** — the `❌` box → dismiss control.
4. **Window Controls** — pin/collapse cluster → header action group.
5. **Resize Grabber** — `SPR_RESIZE` corner → resizable-panel handle.
6. **Group Box** — engraved double-line frame w/ notched label → fieldset/section.
7. **Inset Well** — sunken recessed panel → input/viewport container.
8. **Separator** — 1px inset divider (`horizontalSeparator`) → rule.
9. **Tab Strip** — horizontal 31×27 tabs → primary tab nav.
10. **Sideways Tab Strip** — vertical tabs (`SPR_G2_SIDEWAYS_TAB`) → side nav.
11. **Tab** — single tab, active = `image+1` → nav item.
12. **Scroll Area** — striped-trough scroll region → scroll container.
13. **Modal / Prompt** — translucent bordeaux error window → dialog.
14. **Top Toolbar** — 27px game bar → app header/toolbar.
15. **Bottom Status Bar** — translucent bottom bar → status/footer.

### 2 · Buttons & Actions (10)
16. **Bevel Button** — raised text `button` → default button.
17. **Flat Button** — bevel-on-hover `flatBtn` → toolbar/ghost button.
18. **Image Button** — icon `imgBtn` → icon button.
19. **Toggle Button** — pressed = inset → toggle.
20. **Segmented Control** — exclusive-pressed group → segmented/radio.
21. **Icon Toolbar Button** — toolbar sprite button → toolbar action.
22. **Split Button** — button + caret child → split action.
23. **Danger Button** — demolish/red → destructive action.
24. **Primary Action** — "Construct" emphasis → primary CTA.
25. **Cancel / Close Action** — → secondary/dismiss.

### 3 · Inputs & Controls (15)
26. **Spinner / Stepper** — numeric well + `▲▼`, hold-to-repeat → number input.
27. **Dropdown Field** — inset well + caret → select.
28. **Dropdown Menu** — regular/toggle/image/colour/separator items → menu.
29. **Checkbox** — 10×10 inset + `✓` → checkbox.
30. **Text Input** — inset well + blinking caret → text field.
31. **Color Swatch Button** — `SPR_PALETTE_BTN` → color trigger.
32. **Color Palette Grid** — swatch dropdown → color picker.
33. **Slider** — emulated track+thumb → range slider.
34. **Toggle Switch** — modern on/off → switch.
35. **Curve Selector** — 7-step L/R construction segmented → symmetric stepper.
36. **Slope Selector** — 7-step pitch (▼90..▲90) → vertical stepper.
37. **Bank Selector** — 3-step roll → tri-toggle.
38. **Search Field** — `SPR_G2_SEARCH` input → search.
39. **Money Input** — currency-glyph-aware numeric → money field.
40. **Filter Bar** — category filter row → filter/toolbar.

### 4 · Data Display & Feedback (20)
41. **Progress Bar** — inset fill w/ blink threshold → progress.
42. **Need Meter** — green-good / red-bad bar w/ fill threshold → stat bar.
43. **Rating Badge** — 6-tier Low→Ultra Extreme → score badge.
44. **Danger Rating** — intensity ≥10.00 red state → warning metric.
45. **Tooltip** — pale-yellow glass w/ dark border → tooltip.
46. **News Toast** — bottom news ticker item → notification/toast.
47. **Badge / Pill** — → count/label badge.
48. **Status Indicator** — Open/Closed/Testing sprites → status dot.
49. **Category Chip** — ride/scenery category tag → chip.
50. **Stat Tile (KPI)** — measurements panel cell → KPI tile.
51. **List Row** — 12px scrollable row → table/list row.
52. **Table Header** — sortable `tableHeader` + sort icon → column header.
53. **Scrollbar** — striped trough + bevel thumb → scrollbar.
54. **Line Graph** — velocity/altitude/G-force → line chart.
55. **Tabbed Graph Panel** — graphs tab → chart panel.
56. **Empty State** — → empty placeholder.
57. **Loading Indicator** — animated gears/loader art → spinner.
58. **Marquee** — thought/status scrolling text → marquee.
59. **Attention Flash** — window flash outline → highlight pulse.
60. **Definition Row** — label + value pair (finance rows) → key-value.

### 5 · Iconography (10)
61. **Icon** — base, 3 sizes (tiny/small/medium) → icon primitive.
62. **Toolbar Icon Set** — pause/zoom/rotate/land/rides… → nav icons.
63. **Ride-Category Icons** — 6 animated groups → category glyphs.
64. **Scenery-Category Icons** — trees/urban/walls/signage/paths/statues → glyphs.
65. **Weather Icons** — sun→blizzard set → weather glyphs.
66. **Chevron / Arrow Icons** — spinner + map-rotation arrows → directional.
67. **Cursor Set** — 28 `CursorID` cursors → cursor tokens.
68. **Visibility Toggles** — hide vegetation/scenery/vehicles/supports → view toggles.
69. **Playback Icons** — play/stop/restart/skip/fast-forward → media controls.
70. **Multiplayer Icons** — sync/desync/locked → connection status.

### 6 · Typography (8)
71. **Heading** — outlined title text → h1–h3.
72. **Body Text** — small/medium → paragraph.
73. **Caption** — tiny 6px → caption/meta.
74. **Money Label** — guilder/rouble/euro glyph formatting → currency.
75. **Colored Text** — 14 TextColour tokens → semantic text.
76. **Outlined Text** — sunny+shadow decoration → emphasized text.
77. **Link** — → hyperlink.
78. **Inline Glyph** — eye/arrows/tick sprite glyphs → inline icon-text.

### 7 · Guests / Peeps (10)
79. **Avatar** — peep sprite, t-shirt/trousers tint → avatar.
80. **Mood Face** — 13-state (angry→very-very-happy) → sentiment indicator.
81. **Thought Bubble** — up to 5 of ~130 thoughts → annotation/bubble.
82. **Needs Panel** — 6 need meters (happiness/energy/hunger/thirst/nausea/toilet) → stat group.
83. **Tolerance Badge** — nausea tolerance none/low/avg/high → attribute badge.
84. **Guest Profile Card** — tabbed (overview/needs/rides/finance/thoughts/inventory) → profile.
85. **Staff Badge** — handyman/mechanic/security/entertainer + color → role badge.
86. **Costume Selector** — 11 entertainer costumes → avatar/costume picker.
87. **Inventory Chip** — carried item icon+label → item chip.
88. **Status Flag Badge** — lost/hungry/angry/tracking `PeepFlags` → status flags.

### 8 · Rides / Track / Scenery (12)
89. **Ride Card** — hero viewport + status + ratings → featured card.
90. **Ride Status Chip** — open/closed/testing → status control.
91. **E/I/N Rating Trio** — Excitement/Intensity/Nausea stacked → rating cluster.
92. **Track Piece Selector** — from 350 `TrackElemType` → build palette.
93. **Construction Panel** — curve+slope+bank+chain-lift+build/demolish → compound editor.
94. **Vehicle Config Card** — trains / cars-per-train steppers → config card.
95. **Maintenance Meter** — reliability/breakdown/inspection → health meter.
96. **Income Card** — ticket-price spinners + profit → pricing card.
97. **Customer Meters** — satisfaction/popularity/queue → demographics.
98. **Scenery Palette** — tabbed picker (up to 257 tabs) → asset palette.
99. **Theme-Pack Selector** — 43 real scenery groups (1920s, Sports, European, Oriental, 1960s,
    Jurassic, Industrial…) → theme switcher.
100. **Signage** — park-entrance / banner (9 banners, 16 entrances) → banner/hero header.

---

## Using this in Magic Patterns

- Paste **Foundations** + `tokens.json` first to establish the palette, bevel rule, and type scale.
- Then request components family by family (Surfaces → Buttons → Inputs → …). Each numbered entry is
  a self-contained prompt: name, RCT2 provenance, and modern role.
- Anchor prompts on the **bevel-not-shadow** rule and the **neutral teal-grey chrome** — those two
  are what make output read unmistakably as RollerCoaster Tycoon.

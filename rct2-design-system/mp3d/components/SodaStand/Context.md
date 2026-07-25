# SodaStand

Soda stand: a cluster of giant soda cans with a serving hatch and a bendy straw (DRNKS). The cans use REAL can proportions — height ≈ 1.85× diameter — with a neck taper into the rim, a bottom inset over a dark foot ring, a crisp silver top (seam torus + dished lid, LOW metalness: the Stage has no envmap, so high metalness renders black) with an offset stay-tab, and a printed-label read: white main band + dark accent band + thin stripe (stepped radii, nothing coplanar) + a geometric disc-and-bar logo mark embedded into each label's outward face. Semi-gloss plastic texture, low bump.

Composable stall on the BurgerShop pattern (components/Park/Context.md → "The composable convention"). Exports:

- `<SodaStand position rotation scale withGuest register name price value>` — built on `<ConfigurableStall>` via `composableStall`. Inside a `<Park>`, `register` registers a selling DRINK stall with the GameManager (defaults: Soda Stand, item 'drink', price 2, value 4): guests thirst-seek it, buy visible cups, drink and litter. The serving hatch faces local +z — the attach point sits 0.72 out that way, so aim `rotation` at the customers' path. `withGuest` adds the decorative queueing peep (preview flavour; default off — real guests queue in parks).
- `buildSodaStandScene(t, { withGuest? }) → { group, update }` — the imperative builder.

**NAME IT (round-7).** `register` on its own ships the CATALOG DEFAULT NAME — a park with a "Burger Bar", a "Soda Stand" and a "Cotton Candy" reads unfinished, and the GameManager keys `moveStall`/the corridor resolver on the NAME, so duplicates make it measure the wrong shop. Since round 7 the stall components accept the SAME object form as rides (it used to be a silent no-op on stalls):

```tsx
<SodaStand position={[-3, 6.6]} rotation={Math.PI / 2}
  register={{ name: 'Cinder Soda', price: 2, value: 4 }} />
```

Top-level `name`/`price`/`value` props still work and WIN over the object's fields; `register={{ item }}` can override what it sells. (The generic `<Stall kind="balloon">` wrapper is a different contract — it takes `sell`, not `register`.)


Original three.js model on the shared Stage (day/night lighting); proportions and palette referenced from the RCT2 asset library.

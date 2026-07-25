# BurgerShop

Burger shop matched to the RCT2 BURGB stall: the building IS a giant sesame-bun burger — dome top bun, lettuce ruffle, patty/cheese band — with a serving hatch cut into the front (local +z), counter, lit menu board and night-gated sign bulbs. Proportions and palette referenced from the RCT2 asset library.

**THE composable-stall exemplar** (components/Park/Context.md → "The composable convention"). Exports:

- `<BurgerShop position rotation scale withGuest register name price value>` — built on `<ConfigurableStall>` via `composableStall`. Inside a `<Park>`, `register` registers a selling FOOD stall with the GameManager (defaults: Burger Bar, price 3, value 5): guests hunger-seek it, buy visible burgers, eat and litter. The serving hatch faces local +z — the attach point sits 0.72 out that way, so aim `rotation` at the customers' path. `withGuest` adds the decorative queueing peep (preview flavour; default off — real guests queue in parks).
- `buildBurgerShop(t, { withGuest? }) → { group, update }` — the imperative builder.

**NAME IT (round-7).** `register` on its own ships the CATALOG DEFAULT NAME — a park with a "Burger Bar", a "Soda Stand" and a "Cotton Candy" reads unfinished, and the GameManager keys `moveStall`/the corridor resolver on the NAME, so duplicates make it measure the wrong shop. Since round 7 the stall components accept the SAME object form as rides (it used to be a silent no-op on stalls):

```tsx
<BurgerShop position={[-3, 6.6]} rotation={Math.PI / 2}
  register={{ name: 'Ashfall Grill', price: 3, value: 5 }} />
```

Top-level `name`/`price`/`value` props still work and WIN over the object's fields; `register={{ item }}` can override what it sells. (The generic `<Stall kind="balloon">` wrapper is a different contract — it takes `sell`, not `register`.)


The preview wraps `<BurgerShop withGuest>` in `<ScenePreview distance={5.8} targetY={0.75} autoRotate={false}>`.

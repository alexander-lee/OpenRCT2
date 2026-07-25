# CottonCandyStand

Cotton candy stand: a giant fluffy pink floss cloud with a hatch (CNDYF).

Original three.js model on the shared Stage (day/night lighting); proportions and palette referenced from the RCT2 asset library.


**NAME IT (round-7).** `register` on its own ships the CATALOG DEFAULT NAME — a park with a "Burger Bar", a "Soda Stand" and a "Cotton Candy" reads unfinished, and the GameManager keys `moveStall`/the corridor resolver on the NAME, so duplicates make it measure the wrong shop. Since round 7 the stall components accept the SAME object form as rides (it used to be a silent no-op on stalls):

```tsx
<CottonCandyStand position={[-3, 6.6]} rotation={Math.PI / 2}
  register={{ name: 'Ashfall Candy', price: 2, value: 3 }} />
```

Top-level `name`/`price`/`value` props still work and WIN over the object's fields; `register={{ item }}` can override what it sells. (The generic `<Stall kind="balloon">` wrapper is a different contract — it takes `sell`, not `register`.)

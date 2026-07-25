# HotDogStand

Hot dog stand: stone kiosk, striped awning, giant hot dog on the roof (HOTDS). The sausage is a plump CAPSULE — a TubeGeometry (radius 0.15, 24 radial segments) swept along a gentle banana arc with squashed-ball hemisphere end caps — nested between rounded-end bun halves; the mustard is ONE continuous glossy ribbon (a flattened tube following a sine zig-zag along the sausage top), never discrete beads.

Original three.js model on the shared Stage (day/night lighting); proportions and palette referenced from the RCT2 asset library.


**NAME IT (round-7).** `register` on its own ships the CATALOG DEFAULT NAME — a park with a "Burger Bar", a "Soda Stand" and a "Cotton Candy" reads unfinished, and the GameManager keys `moveStall`/the corridor resolver on the NAME, so duplicates make it measure the wrong shop. Since round 7 the stall components accept the SAME object form as rides (it used to be a silent no-op on stalls):

```tsx
<HotDogStand position={[-3, 6.6]} rotation={Math.PI / 2}
  register={{ name: 'Ember Dogs', price: 2, value: 4 }} />
```

Top-level `name`/`price`/`value` props still work and WIN over the object's fields; `register={{ item }}` can override what it sells. (The generic `<Stall kind="balloon">` wrapper is a different contract — it takes `sell`, not `register`.)

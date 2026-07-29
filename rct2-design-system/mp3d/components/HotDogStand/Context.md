# HotDogStand

**CANONICAL IMPORT — copy exactly:** `import { HotDogStand } from './components/HotDogStand';`
*(never from `'./Park'`: only the `<Park>` wrappers + track-piece JSX live there. A wrong
specifier makes esbuild refuse the WHOLE bundle — the round-8 black-page failure.)*

Hot dog stand: stone kiosk, striped awning, giant hot dog on the roof (HOTDS). The sausage is a plump CAPSULE — a TubeGeometry (radius 0.15, 24 radial segments) swept along a gentle banana arc with squashed-ball hemisphere end caps — nested between rounded-end bun halves; the mustard is ONE continuous glossy ribbon (a flattened tube following a sine zig-zag along the sausage top), never discrete beads.

Original three.js model on the shared Stage (day/night lighting); proportions and palette referenced from the RCT2 asset library.


**NAME IT (round-7).** `register` on its own ships the CATALOG DEFAULT NAME — a park with a "Burger Bar", a "Soda Stand" and a "Cotton Candy" reads unfinished, and the GameManager keys `moveStall`/the corridor resolver on the NAME, so duplicates make it measure the wrong shop. Since round 7 the stall components accept the SAME object form as rides (it used to be a silent no-op on stalls):

```tsx
<HotDogStand position={[-3, 6.6]} rotation={Math.PI / 2}
  register={{ name: 'Ember Dogs', price: 2, value: 4 }} />
```

Top-level `name`/`price`/`value` props still work and WIN over the object's fields; `register={{ item }}` can override what it sells. (The generic `<Stall kind="balloon">` wrapper is a different contract — it takes `sell`, not `register`.)

## The HELD hot dog (`buildHeldHotDog`)

`buildHeldHotDog(t) → THREE.Group` is the stand's own 3D item — a miniature of the roof prop (bun trough with rounded ends, plump sausage proud of it, mustard stripe) — registered on the stall descriptor as GameManager's `StallConfig.heldItem`, so buyers walk off eating a REAL hot dog instead of the manager's generic burger. It used to live in this component's PREVIEW, which re-dressed the manager's `heldFood` mesh: that only worked in the preview, so in a real park every hot dog looked like a burger. Peep-local units, fist-to-head sized; the manager clones it per purchase onto the tuned hand hold spot and the eaten-down container/litter flow is unchanged. Override per placement with `register={{ heldItem }}`. See components/GameManager/Context.md → "Per-stall held items".

# CottonCandyStand

**CANONICAL IMPORT — copy exactly:** `import { CottonCandyStand } from './components/CottonCandyStand';`
*(never from `'./Park'`: only the `<Park>` wrappers + track-piece JSX live there. A wrong
specifier makes esbuild refuse the WHOLE bundle — the round-8 black-page failure.)*

Cotton candy stand: a giant fluffy pink floss cloud with a hatch (CNDYF).

Original three.js model on the shared Stage (day/night lighting); proportions and palette referenced from the RCT2 asset library.


**NAME IT (round-7).** `register` on its own ships the CATALOG DEFAULT NAME — a park with a "Burger Bar", a "Soda Stand" and a "Cotton Candy" reads unfinished, and the GameManager keys `moveStall`/the corridor resolver on the NAME, so duplicates make it measure the wrong shop. Since round 7 the stall components accept the SAME object form as rides (it used to be a silent no-op on stalls):

```tsx
<CottonCandyStand position={[-3, 6.6]} rotation={Math.PI / 2}
  register={{ name: 'Ashfall Candy', price: 2, value: 3 }} />
```

Top-level `name`/`price`/`value` props still work and WIN over the object's fields; `register={{ item }}` can override what it sells. (The generic `<Stall kind="balloon">` wrapper is a different contract — it takes `sell`, not `register`.)

## The HELD floss cone (`buildHeldFloss`)

`buildHeldFloss(t) → THREE.Group` is the stand's own 3D item — the counter display recipe (cream paper cone + pink fluff ball) at fist size — registered on the stall descriptor as GameManager's `StallConfig.heldItem`, so buyers walk off eating candy floss instead of the manager's generic burger. It used to live in this component's PREVIEW, which re-dressed the manager's `heldFood` mesh: that only worked in the preview, so in a real park every floss looked like a burger. The group carries its own offset/tilt (pulled back into the fist, tipped forward 0.45 rad) — the manager treats a builder's transform as an offset from the hand hold spot — so the thin stick is gripped rather than floating and the fluff clears the forearm and hair through the whole bite cycle. Override per placement with `register={{ heldItem }}`. See components/GameManager/Context.md → "Per-stall held items".

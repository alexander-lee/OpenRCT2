# BalloonStand

**CANONICAL IMPORT — copy exactly:** `import { BalloonStand } from './components/BalloonStand';`
*(never from `'./Park'`: only the `<Park>` wrappers + track-piece JSX live there. A wrong
specifier makes esbuild refuse the WHOLE bundle — the round-8 black-page failure.)*

The RCT2 balloon stall: a small colourful kiosk (red plastic body, wood counter, serving hatch, red/white striped pitched canopy on metal corner poles with a scalloped skirt) with a tether pole holding a bunch of 7 helium balloons — emissive-tinted balls on thin string cylinders that sway gently — plus two single balloons tied to the counter. `BALLOON_COLS` exports the realistic balloon palette (also the GameManager's per-guest held-balloon colour source, matching RCT2's purchase-time `balloonColour`, Guest.cpp:1682).

API / contract: `buildBalloonStand(t) → { group, front: [0, 0, 1.05] }` — `front` is where a buying guest stands, at ground level in the group's local space (+z of the counter). GameManager agents route guests to this point. Footprint ≈ 1.28 × 1.04 (plus the tether pole at local x 0.78), ridge height 1.41.

`<BalloonStand>` is a **composableStall** (components/Park/Context.md): it mounts the kiosk at `position`/`rotation`/`scale` inside a `<Park>` or `<ScenePreview>`, and with `register` inside a real `<Park>` it SELLS — `item: 'balloon'`, price 2, value 3 (overridable via `name`/`price`/`value` props). Guests route to the counter front, buy through the GameManager ACCESSORY flow (+12 happiness, balloon held on a string above a relaxed hand, deterministic colour), and after a hashed 60–120 sim-s the balloon flies away (accelerating buoyant climb, wind sway, fade-out ~8 u up) while the ex-owner glances up sadly — see GameManager/Context.md "Balloons". `buildBalloonStandScene` (stand + posed balloon-holding guest) remains exported for standalone staging.

**NAME IT (round-7).** `register` on its own ships the CATALOG DEFAULT NAME — a park with a "Burger Bar", a "Soda Stand" and a "Cotton Candy" reads unfinished, and the GameManager keys `moveStall`/the corridor resolver on the NAME, so duplicates make it measure the wrong shop. Since round 7 the stall components accept the SAME object form as rides (it used to be a silent no-op on stalls):

```tsx
<BalloonStand position={[-3, 6.6]} rotation={Math.PI / 2}
  register={{ name: 'Cinder Balloons', price: 2, value: 3 }} />
```

Top-level `name`/`price`/`value` props still work and WIN over the object's fields; `register={{ item }}` can override what it sells. (The generic `<Stall kind="balloon">` wrapper is a different contract — it takes `sell`, not `register`.)


Balloon geometry and colours are deterministic (index math only); sway is driven per-balloon via onBeforeRender with an internal THREE.Clock since the contract carries no update fn. The preview runs a miniature pre-warmed GameManager sim (2× time, fixed substeps) demonstrating the full buy → hold → fly-away loop. Original three.js model on the shared Stage; proportions referenced from the RCT2 balloon stall.

# PaddleBoats

**CANONICAL IMPORT — copy exactly:** `import { PaddleBoats } from './components/PaddleBoats';`
*(never from `'./Park'`: only the `<Park>` wrappers + track-piece JSX live there. A wrong
specifier makes esbuild refuse the WHOLE bundle — the round-8 black-page failure.)*

Paddle boats: slate hulls with orange planks and churning stern wheels (SPBOAT). The pond uses the shared bright WaterTile shader (amp 0.1 — the swell never dips below the pond bed, which is itself a bright aqua 0x1e83c4 so any read-through stays blue).

Original three.js model on the shared Stage (day/night lighting); proportions and palette referenced from the RCT2 asset library.

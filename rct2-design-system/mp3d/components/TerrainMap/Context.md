# TerrainMap

**CANONICAL IMPORT — copy exactly:** `import { TerrainMap } from './components/TerrainMap';`
*(never from `'./Park'`: only the `<Park>` wrappers + track-piece JSX live there. A wrong
specifier makes esbuild refuse the WHOLE bundle — the round-8 black-page failure.)*

A generated RCT2-style landscape: stepped grass/sand tiles flooded by the water shader.

Built with three.js on the shared Stage; modelled from the authentic RCT2 sprite.

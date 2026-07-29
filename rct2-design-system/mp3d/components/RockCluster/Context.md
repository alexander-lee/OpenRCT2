# RockCluster

**CANONICAL IMPORT — copy exactly:** `import { RockCluster } from './components/RockCluster';`
*(never from `'./Park'`: only the `<Park>` wrappers + track-piece JSX live there. A wrong
specifier makes esbuild refuse the WHOLE bundle — the round-8 black-page failure.)*

A natural rock outcrop assembled from Rock boulders.

`buildRockCluster(t, opts?)` scatters seeded `buildRock` instances over an elliptical footprint with centre bias, per-rock scale variation, free yaw plus a slight settle tilt, each partially buried so the formation reads as grown from the ground. Pass `heightAt` from TerrainKit's `buildTerrain` so the rocks conform to sculpted terrain.

Built with three.js on the shared Stage.

# TerrainKit

Sculpted terrain heightfield for building whole park landscapes.

`buildTerrain(t, opts?)` returns `{ mesh, heightAt(x, z), size }`: a displaced PlaneGeometry driven by deterministic FBM value-noise (hashed sines, no Math.random) plus authored `peaks` (hills) and `basins` (lake bowls carved below `waterLevel`). `heightAt` matches the mesh exactly — use it to conform rocks, trees, paths and rides to the ground. Colouring blends an aqua-teal underwater basin (0x4fb0c2 at depth into bright sand at the waterline — submerged ground reads as tropical shallows through the water, never slate), a foam waterline, shore sand, grass and grey rock strata on steep slopes via smoothed vertex colours over the shared procedural grass bump texture; a mud skirt seals the tile edges.

Pair with `buildWater` from components/WaterTile placed at the water level for lakes, and `buildRock` / `buildRockCluster` for outcrops. Built with three.js on the shared Stage (`ground={false}`).

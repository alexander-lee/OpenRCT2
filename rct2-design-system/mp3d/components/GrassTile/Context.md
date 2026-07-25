# GrassTile

A grass land tile (textured earth slab with tufts, wild daisies and pebbles) from the RCT2 terrain surface.

Exports (composable convention — components/Park/Context.md): `<GrassTile position rotation scale>` — mounts the tile in a `<Park>` or `<ScenePreview>` — and `buildGrassTile(t) → { group }`. The preview wraps it in `<ScenePreview distance={5.2} targetY={0.2} autoRotate={false}>`.

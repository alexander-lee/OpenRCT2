# Fountain

**CANONICAL IMPORT — copy exactly:** `import { Fountain } from './components/Fountain';`
*(never from `'./Park'`: only the `<Park>` wrappers + track-piece JSX live there. A wrong
specifier makes esbuild refuse the WHOLE bundle — the round-8 black-page failure.)*

Single-tier stone park fountain: coped basin holding a real `buildWater` sheet at LOW waviness (amp 0.6 × waviness 0.4 — a calm ornamental pool, not open-water chop), LatheGeometry entasis pedestal and one bellied bowl whose TOP-TIER water is a small radius-clipped `buildWater` sheet too (amp 0.12 × waviness 0.5, no skirt, edge hidden behind the rolled lip — same shader as the basin so both tiers read as the same water; replaced the old scrolling-texture disc), six translucent tapered jets arcing from the bowl lip into the basin, ParticleKit SPRAY at each jet's arc top (droplet emitters whose launch velocity is the stream tangent, gravity carrying them down into the basin) plus a slow mist bank drifting over the basin water, gold collar/finial, splash-foam domes at the jet landings, and four cool night up-lights. The old 12 orbiting droplet meshes are replaced by the emitters (~204 particles total; solid jet arcs kept).

API: `buildFountain(t) → { group, update(time) }` — add `group` to your scene and call `update` every frame (it drives both water shaders — which also moonlight-dim themselves at night via `uNight` — spray/mist emitters and the night up-lights). Footprint radius ≈ 1.8, height ≈ 2.2 (one park tile).

Functionality ported from the reference design system's Fountain (basin construction, jet parabola) rebuilt with our Stage helpers, procedural textures and realistic palette. Deterministic — hashed particle emission, no randomness.

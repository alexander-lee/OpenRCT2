# Torch

A rustic park torch: tapered wooden pole (embedded 0.03 below the group origin for ground contact) with a four-ring wrapped leather grip band, an iron sconce head — collar, tapered basket cup, rim ring and four outward-tilted straps — holding a flickering coal bed, topped with a small ParticleKit `buildFire` flame (layered core / outer flame / embers / smoke + one warm point light that flickers on hashed sines and brightens at night via `nightKOf`).

Exports (composable convention — components/Park/Context.md):

- `<Torch position rotation scale height lit>` — composable: mounts one torch in a `<Park>` or `<ScenePreview>` (y settles onto the plaza/terrain). `height` default 1.5; `lit: false` = cold torch.
- `buildTorch(t, opts?: { height?: number; lit?: boolean }) → { group, update(time) }` — the imperative builder; add `group` with its origin at ground level and call `update` every frame. Flame tip ≈ height + 0.5. Deterministic — hashed flicker and hashed particle emission only, no `Math.random`.

The preview (three torches around a stone circle) lives in Torch.previews.tsx as `<ScenePreview dress>` staging + three `<Torch>` children.

Budget: one lit torch ≈ 128 particles (the `buildFire` layers) + 1 point light; keep clusters to a handful of lit torches per scene.

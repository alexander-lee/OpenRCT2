# PeepCrowd

**CANONICAL IMPORT — copy exactly:** `import { PeepCrowd } from './components/PeepCrowd';`
*(never from `'./Park'`: only the `<Park>` wrappers + track-piece JSX live there. A wrong
specifier makes esbuild refuse the WHOLE bundle — the round-8 black-page failure.)*

A milling plaza crowd of shared `buildPeep` guests animated entirely through the Guest POSE LAYER: standers who glance around and idle weight-shifters breathe on pose `idle` (no treadmill legs), wanderers stroll small loops on pose `walk` with the cadence solved from their ACTUAL ground speed (`cadenceForSpeed` — no foot skating), and dancers ride the pose `dance` sequencer on a shared ~2.2 Hz beat. Varied skin tones, outfits, hair and expressions, ~50 % female (hashed).

Built with three.js on top of the shared `Stage` and `Guest.buildPeep`.

## API

```ts
buildCrowd(t: typeof THREE, opts?: { count?: number; radius?: number; dance?: number })
// -> { group: THREE.Group, update(time: number): void }
```

- `count` (default 14) guests scattered inside `radius` (default 2.2) by golden-angle spiral.
- `dance` (0..1, default 0.5): fraction of the crowd dancing, hash-picked. Four per-peep styles map to pose-layer playlists — **bounce** (hops, hands in the air), **twist** (yaw wiggle via `pose.spinYaw`, added to the carrier yaw), **sway** (side lean + nod, one arm waving), **spin-burst** (full eased spins plus a real pose-layer JUMP — crouch, arc, landing — every 8 beats). Every style is enriched with sequenced arm-waves, side-step shuffles and occasional full spins, crossfaded per bar; female skirts swing behind turns and flare on spins/hops.
- Add `group` to your scene (raise `group.position.y` to your slab top) and call `update(time)` each frame.
- Fully deterministic placement and behaviour: hashed-sine seeding, no `Math.random` / `Date.now`. Wander loops are capped by nearest-neighbour distance so bodies never intersect.

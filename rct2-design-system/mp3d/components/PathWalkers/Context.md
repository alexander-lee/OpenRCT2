# PathWalkers

Guests strolling a `buildPathNetwork` graph. Every walker is the shared `buildPeep` guest (varied skin tone, shirt, trousers, hair and expression) walking edge-to-edge, turning at nodes with DETERMINISTIC seeded choices (never doubling straight back unless at a dead end), facing its travel direction, on its own lane offset so opposite streams don't overlap.

Built with three.js on top of the shared `Stage`, `Guest.buildPeep` and `PathNetwork.buildPathNetwork`.

## API

```ts
attachWalkers(t: typeof THREE, g: THREE.Group, net: ReturnType<typeof buildPathNetwork>, opts?: { count?: number })
// -> (time: number) => void   — call every frame (Stage updater)
```

- Adds `opts.count` (default 8) guests to `g` and returns the per-frame updater.
- Walkers use `peep.walk(time, phase)` for the gait and are spread along edges at start so they never stack.
- Fully deterministic: hashed-sine seeding, no `Math.random` / `Date.now`.

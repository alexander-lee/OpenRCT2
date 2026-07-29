# StringLights

**CANONICAL IMPORT — copy exactly:** `import { StringLights } from './components/StringLights';`
*(never from `'./Park'`: only the `<Park>` wrappers + track-piece JSX live there. A wrong
specifier makes esbuild refuse the WHOLE bundle — the round-8 black-page failure.)*

Festival string lights: parabolic-sag cables of warm emissive bulbs zig-zagging between dark iron poles over a concrete plaza.

Original three.js model on the shared Stage (day/night lighting). Exports:

- `buildStringLights(t, from, to, opts?)` — one span between two anchor points. `opts`: `bulbs` (count, default from span length), `sag` (mid-span dip, default 0.35), `colors` (bulb hex array, warm white default), `wireColor`. Returns `{ group, update(time) }` — call `update` each frame for a gentle deterministic twinkle. Every 4th bulb carries a small short-range `THREE.PointLight`, so spans pool real light at night without a light per bulb.
- `buildLightPole(t, pos, opts?)` — dark iron pole with a finial hook; returns `{ group, hook }` where `hook` is the `[x, y, z]` anchor to feed into `buildStringLights`.
- `StringLights` — plaza preview: five poles, four zig-zag spans (warm white + amber festival mix), three walking guests. Use the Stage night toggle to see the bulbs glow.

Colours stay realistic: warm whites and ambers only by default; pass `colors` for custom mixes.

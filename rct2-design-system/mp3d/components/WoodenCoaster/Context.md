# WoodenCoaster (deprecated)

**CANONICAL IMPORT — copy exactly:** `import { WoodenCoaster } from './components/WoodenCoaster';`
*(never from `'./Park'`: only the `<Park>` wrappers + track-piece JSX live there. A wrong
specifier makes esbuild refuse the WHOLE bundle — the round-8 black-page failure.)*

Deprecated — replaced by **SplineCoaster** (the preferred coaster: freeform spline rails, banking, supports, running train; `wood: true` for the wooden look) and **TrackKit/CoasterBuilder** (RCT2-style grid pieces with circuit-closure validation). WoodenCoaster now renders SplineCoaster for backwards compatibility. Do not use in new designs.

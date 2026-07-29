# TrackKit

**CANONICAL IMPORT — copy exactly:** `import { TrackKit } from './components/TrackKit';`
*(never from `'./Park'`: only the `<Park>` wrappers + track-piece JSX live there. A wrong
specifier makes esbuild refuse the WHOLE bundle — the round-8 black-page failure.)*

RCT2-style GRID track pieces (station/flat/up25/down25/up60/down60/turnL/turnR/corkscrewL/corkscrewR) with circuit-closure validation (opposite legs equal, rises cancel, turns total 360°), clearance-envelope wooden supports and `attachTrain`. Use this when you want authentic RCT2 piece-by-piece building. **For park scenes and freeform layouts, prefer SplineCoaster** — it is the primary coaster system.

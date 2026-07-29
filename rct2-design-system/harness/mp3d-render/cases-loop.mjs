// The SHIPPED "Loop Royale" circuit (SplineCoaster.previews.tsx preview 0) plus
// the layout it replaced — a regression case for the vertical loop's size.
//   node probe-loop.mjs cases-loop.mjs
// Expect: OLD tops out at y 3.05 (R clamped 1.25); SHIPPED reaches y 4.55 with
// design.ok, valid.ok, zero synthesized closure, lateral < 1.275 g and a
// POSITIVE crest G.
const opts = { profile: 'coaster', type: 'steel', start: [0, 0.55, 0] };

export default [
  {
    name: 'OLD (R 1.25 → a 2.5-unit loop under a 2.9 lift)',
    opts,
    pieces: ['station', { type: 'lift', height: 2.9 }, { type: 'turnR', angle: 180, radius: 2.8 }, { type: 'drop', height: 2.9 },
      { type: 'straight', length: 1.3 }, { type: 'loopR', radius: 1.25 }, { type: 'straight', length: 1.3 },
      { type: 'lift', height: 1.9 }, { type: 'turnR', angle: 180, radius: 2.2 }, { type: 'drop', height: 1.9 },
      { type: 'straight', length: 1.66 }],
  },
  {
    name: 'SHIPPED (R 2.0 → a 4.0-unit loop under a 4.6 lift)',
    opts,
    pieces: ['station', { type: 'lift', height: 4.6 }, { type: 'turnR', angle: 180, radius: 2.8 }, { type: 'drop', height: 4.6 },
      { type: 'straight', length: 0.72 }, { type: 'loopR', radius: 2.0 }, { type: 'straight', length: 0.72 },
      { type: 'lift', height: 2.4, length: 3.61 }, { type: 'turnR', angle: 180, radius: 2.2 }, { type: 'drop', height: 2.4, length: 3.61 },
      { type: 'straight', length: 1.66 }],
  },
];

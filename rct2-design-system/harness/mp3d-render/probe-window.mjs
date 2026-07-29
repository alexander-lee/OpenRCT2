// WHERE does the widened inversion window actually exempt? Inject the same
// illegal vertical kink at EVERY control point of the Loop Royale circuit and
// report which ones checkCoasterDesign lets through. The exempt set should be
// exactly the vertical loop (plus its lead-in/out ramp) and nothing else — if
// the window over-reached, unrelated points would go quiet too.
import { K, T, analyse } from './probe-loop.mjs';

const opts = { profile: 'coaster', type: 'steel', start: [0, 0.55, 0] };
const pieces = [
  'station', { type: 'lift', height: 4.6 }, { type: 'turnR', angle: 180, radius: 2.8 }, { type: 'drop', height: 4.6 },
  { type: 'straight', length: 0.72 }, { type: 'loopR', radius: 2.0 }, { type: 'straight', length: 0.72 },
  { type: 'lift', height: 2.4, length: 3.61 }, { type: 'turnR', angle: 180, radius: 2.2 }, { type: 'drop', height: 2.4, length: 3.61 },
  { type: 'straight', length: 1.66 },
];
const a = analyse(pieces, opts);
const pts = a.points.map((p) => [...p]);
const kink = (at) => pts.map((p, i) => (i === at ? [p[0], p[1] + 0.55, p[2]] : [...p]));

console.log(`clean control: ${K.checkCoasterDesign(T, pts, { type: 'steel' }).ok ? 'ok (no violations)' : 'ALREADY FAILING'}`);
const exempt = [];
for (let i = 0; i < pts.length; i += 1) if (K.checkCoasterDesign(T, kink(i), { type: 'steel' }).ok) exempt.push(i);
const runs = [];
for (const i of exempt) {
  const last = runs[runs.length - 1];
  if (last && i === last[1] + 1) last[1] = i;
  else runs.push([i, i]);
}
console.log(`${pts.length} points; a kink is ABSORBED at ${exempt.length} of them, in ${runs.length} run(s):`);
for (const [s, e] of runs) {
  const seg = pts.slice(s, e + 1);
  const ys = seg.map((p) => p[1]);
  console.log(`  points ${s}..${e}  y ${Math.min(...ys).toFixed(2)}..${Math.max(...ys).toFixed(2)}`);
}
// the loop, independently: vloop emits 24 points rising to y = 0.55 + 2R = 4.55
const crest = pts.reduce((b, p, i) => (Math.abs(p[1] - 4.55) < Math.abs(pts[b][1] - 4.55) ? i : b), 0);
console.log(`loop crest (y≈4.55) is point ${crest} at y ${pts[crest][1].toFixed(2)} — inside a run above? ${runs.some(([s, e]) => crest >= s && crest <= e)}`);

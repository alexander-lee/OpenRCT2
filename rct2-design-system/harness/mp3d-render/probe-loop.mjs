#!/usr/bin/env node
// COMPILE-ONLY probe for the track-piece compiler (no browser, no renderer).
// Bundles SplineRideKit + SplineCoaster to ESM and runs compileTrackPieces /
// checkCoasterDesign / validateSpline / replayCoasterForces / rateCoaster in
// plain node, so a layout can be iterated in ~1 s instead of a render.
//
//   node probe-loop.mjs                      -> runs the built-in cases
//   node probe-loop.mjs <file.mjs>           -> runs a case file (default export
//                                               = [{ name, pieces, opts }])
import { build } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HARNESS = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HARNESS, '..', '..', 'mp3d');
const OUT = path.join(HARNESS, 'out');
fs.mkdirSync(OUT, { recursive: true });

const entry = path.join(OUT, '_probe-loop-entry.ts');
fs.writeFileSync(
  entry,
  `export * from ${JSON.stringify(path.join(REPO, 'components/SplineRideKit/index.tsx'))};
export { computeSplineFrames, detectLiftHill } from ${JSON.stringify(path.join(REPO, 'components/SplineCoaster/index.tsx'))};
export * as THREE from 'three';
`,
);
const bundlePath = path.join(OUT, '_probe-loop-bundle.mjs');
await build({
  entryPoints: [entry],
  bundle: true,
  outfile: bundlePath,
  format: 'esm',
  jsx: 'automatic',
  platform: 'node',
  loader: { '.tsx': 'tsx', '.ts': 'ts' },
  define: { 'process.env.NODE_ENV': '"production"' },
  nodePaths: [path.join(HARNESS, 'node_modules')],
  external: ['react', 'react-dom', 'react/jsx-runtime'],
  target: 'node20',
  logLevel: 'error',
});

const K = await import(pathToFileURL(bundlePath).href);
const T = K.THREE;

export function analyse(pieces, opts = {}) {
  const quiet = [];
  const realWarn = console.warn;
  const realLog = console.log;
  console.warn = (...a) => quiet.push(a.join(' '));
  let compiled;
  try {
    compiled = K.compileTrackPieces(pieces, opts);
  } finally {
    console.warn = realWarn;
    console.log = realLog;
  }
  const { points, report } = compiled;
  const bank = opts.bank ?? (opts.type === 'wooden' ? 0.42 : 0.7);
  const fb = K.computeSplineFrames(T, points, { bank: K.coasterBankCap(opts.type ?? 'steel', bank) });
  const replay = K.replayCoasterForces(T, points, { bank, frames: fb });
  const ratings = K.rateCoaster(points, { type: opts.type ?? 'steel', bank, cars: 3 });
  // authored vs total arc length
  let authored = 0;
  for (let i = 1; i < points.length; i += 1) {
    const a = points[i - 1];
    const b = points[i];
    authored += Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
  }
  // inverted samples + crest vertical G
  let minUpY = 1;
  let minUpAt = 0;
  for (let i = 0; i < fb.N; i += 1)
    if (fb.frames[i].up.y < minUpY) {
      minUpY = fb.frames[i].up.y;
      minUpAt = i / fb.N;
    }
  let crest = null;
  for (const s of replay.samples) {
    const f = fb.frameAt(s.u);
    if (f.up.y < 0 && (!crest || s.y > crest.y)) crest = { ...s, upY: f.up.y };
  }
  let worstVert = { vertG: 0 };
  let worstNeg = { vertG: 99 };
  for (const s of replay.samples) {
    if (s.vertG > worstVert.vertG) worstVert = s;
    if (s.vertG < worstNeg.vertG) worstNeg = s;
  }
  return {
    points,
    report,
    fb,
    replay,
    ratings,
    authored,
    minUpY,
    minUpAt,
    crest,
    worstVert,
    worstNeg,
    warnings: quiet,
  };
}

export function fmt(name, a) {
  const r = a.report;
  const hard = r.design.violations.filter((v) => !v.warning);
  const warn = r.design.violations.filter((v) => v.warning);
  return [
    `── ${name}`,
    `   ok ${r.ok}  fatal ${r.fatal ?? false}${r.fatalReason ? ` (${r.fatalReason.slice(0, 90)})` : ''}`,
    `   design.ok ${r.design.ok}  hard [${hard.map((v) => `${v.kind}@${v.at.toFixed(2)}`).join(', ')}]  warn [${warn
      .map((v) => v.kind)
      .join(', ')}]`,
    `   valid.ok ${r.valid.ok}  worst clearance ${r.valid.worst.toFixed(3)} at u=${r.valid.at[0].toFixed(3)}/${r.valid.at[1].toFixed(3)}`,
    `   closure closed ${r.closure.closed} gap ${r.closure.gap.toFixed(2)} synthesized [${r.closure.synthesized.join(' | ')}]`,
    `   length ${a.fb.total.toFixed(2)} u (authored ${a.authored.toFixed(2)})  points ${a.points.length}`,
    `   minUp.y ${a.minUpY.toFixed(3)} at u=${a.minUpAt.toFixed(3)}  inversions(rateCoaster) ${a.ratings.inversions}`,
    `   lateral worst ${(a.replay.worstLatAccel / 9.8).toFixed(3)} g at u=${a.replay.worstLatAt.toFixed(2)} (gate 1.275)`,
    `   vertG max ${a.worstVert.vertG.toFixed(2)} @u${(a.worstVert.u ?? 0).toFixed(2)}  min ${a.worstNeg.vertG.toFixed(2)} @u${(
      a.worstNeg.u ?? 0
    ).toFixed(2)}`,
    a.crest
      ? `   INVERTED CREST u=${a.crest.u.toFixed(3)} y=${a.crest.y.toFixed(2)} v=${a.crest.v.toFixed(2)} vertG ${a.crest.vertG.toFixed(
          2,
        )} up.y ${a.crest.upY.toFixed(2)}`
      : '   INVERTED CREST none',
    `   duration ${a.replay.duration.toFixed(1)} s  excitement ${a.ratings.excitement.toFixed(2)} intensity ${a.ratings.intensity.toFixed(
      2,
    )} nausea ${a.ratings.nausea.toFixed(2)} (${a.ratings.ratingBand})`,
    a.warnings.length ? `   warnings:\n${a.warnings.map((w) => `     · ${w.slice(0, 190)}`).join('\n')}` : '   warnings: none',
  ].join('\n');
}

export { K, T };

// ---- CLI -------------------------------------------------------------------
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const caseFile = process.argv[2];
  if (!caseFile) {
    console.log('no case file — pass one: node probe-loop.mjs cases.mjs');
  } else {
    const mod = await import(pathToFileURL(path.resolve(caseFile)).href);
    for (const c of mod.default) console.log(fmt(c.name, analyse(c.pieces, c.opts ?? {})));
  }
}

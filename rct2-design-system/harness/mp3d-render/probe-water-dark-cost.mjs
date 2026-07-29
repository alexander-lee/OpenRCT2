#!/usr/bin/env node
// ---------------------------------------------------------------------------
// probe-water-dark-cost.mjs — DRAWS + TRIANGLES for LogFlume / RiverRapids /
// GhostTrain, built for node behind a canvas shim.
//
// A "draw" here is a visible Mesh/Points/Line with geometry (what the renderer
// submits in the colour pass, before frustum culling), counted for the WHOLE
// component group and again for the parts the component adds on top of the
// SplineRideKit circuit (`kit` vs `dressing`), so structural work can be
// priced separately from the compiled track it hangs off.
//
//   node probe-water-dark-cost.mjs [--json] [--srcdir=<mp3d copy>]
// ---------------------------------------------------------------------------
import { build } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const noop = new Proxy(function () {}, { get: () => noop, apply: () => noop, set: () => true });
globalThis.document = {
  createElement: () => ({ width: 0, height: 0, getContext: () => noop, toDataURL: () => '' }),
};

const HARNESS = path.dirname(fileURLToPath(import.meta.url));
const arg = (k, d) => {
  const hit = process.argv.find((a) => a.startsWith(`--${k}=`));
  return hit ? hit.slice(k.length + 3) : d;
};
const REPO = path.resolve(arg('srcdir', path.resolve(HARNESS, '..', '..', 'mp3d')));
const TAG = arg('tag', 'now');
const OUT = path.join(HARNESS, 'out');
fs.mkdirSync(OUT, { recursive: true });
const asJson = process.argv.includes('--json');

const entry = path.join(OUT, `_wdcost-entry-${TAG}.ts`);
fs.writeFileSync(
  entry,
  `export { buildLogFlumeScene } from ${JSON.stringify(path.join(REPO, 'components/LogFlume/index.tsx'))};
export { buildRiverRapidsScene } from ${JSON.stringify(path.join(REPO, 'components/RiverRapids/index.tsx'))};
export { buildGhostTrainScene } from ${JSON.stringify(path.join(REPO, 'components/GhostTrain/index.tsx'))};
export * as THREE from 'three';
`,
);
const bundlePath = path.join(OUT, `_wdcost-bundle-${TAG}.mjs`);
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

const triCount = (geo) => {
  if (!geo) return 0;
  const idx = geo.getIndex();
  const n = idx ? idx.count : geo.getAttribute('position')?.count ?? 0;
  return Math.floor(n / 3);
};

function census(root) {
  let draws = 0;
  let tris = 0;
  let points = 0;
  let lights = 0;
  const byType = {};
  root.traverse((o) => {
    if (o.isLight) { lights += 1; return; }
    if (o.isPoints) { points += 1; draws += 1; return; }
    if (!o.isMesh && !o.isLine) return;
    draws += 1;
    tris += triCount(o.geometry);
    const k = o.geometry?.type ?? 'unknown';
    byType[k] = (byType[k] ?? 0) + 1;
  });
  return { draws, tris, points, lights, byType };
}

const scenes = [
  ['LogFlume', () => K.buildLogFlumeScene(T, {})],
  ['RiverRapids', () => K.buildRiverRapidsScene(T, {})],
  ['GhostTrain', () => K.buildGhostTrainScene(T, {})],
];

const report = {};
for (const [name, make] of scenes) {
  const built = make();
  // the update closure is what actually assembles LogFlume/RiverRapids
  built.update?.(0.5);
  const g = built.group;
  g.updateMatrixWorld(true);
  const total = census(g);
  // the SplineRideKit circuit is one child group added first by these two
  let kit = null;
  if (name !== 'GhostTrain') {
    // the kit group is the child that holds the swept ribbons (BufferGeometry
    // ribbons + TubeGeometry rails) — identify by the presence of TubeGeometry
    for (const c of g.children) {
      if (!c.isGroup) continue;
      const cc = census(c);
      if ((cc.byType.TubeGeometry ?? 0) > 0 && cc.draws > 20) { kit = cc; break; }
    }
  }
  report[name] = {
    total,
    kit: kit ? { draws: kit.draws, tris: kit.tris } : null,
    dressing: kit ? { draws: total.draws - kit.draws, tris: total.tris - kit.tris } : { draws: total.draws, tris: total.tris },
  };
}

if (asJson) {
  console.log(JSON.stringify(report, null, 2));
} else {
  console.log(`probe-water-dark-cost [${TAG}] — src ${REPO}`);
  for (const [name, r] of Object.entries(report)) {
    console.log(
      `  ${name.padEnd(13)} total ${String(r.total.draws).padStart(4)} draws / ${String(r.total.tris).padStart(7)} tris` +
        (r.kit ? `   kit ${String(r.kit.draws).padStart(4)}/${String(r.kit.tris).padStart(7)}   dressing ${String(r.dressing.draws).padStart(4)}/${String(r.dressing.tris).padStart(7)}` : '') +
        `   lights ${r.total.lights} points ${r.total.points}`,
    );
    const top = Object.entries(r.total.byType).sort((a, b) => b[1] - a[1]).slice(0, 6);
    console.log(`      geom: ${top.map(([k, v]) => `${k}×${v}`).join(', ')}`);
  }
}

#!/usr/bin/env node
// Seed sweep: run every pure `build*` export of the named components over a wide
// seed space and report any that throw.
//
//   node seed-sweep.mjs TidewaterScenery BrassworkScenery EmberfallScenery
//   node seed-sweep.mjs --seeds=800 ThornwickScenery
//
// WHY THIS EXISTS: scenery builders often fill an array inside a loop that can
// `continue` (gaps in a rock lip, skipped bays, pruned branches) and then index
// it by the LOOP BOUND rather than the array's real length. That reads past the
// end on some fraction of seeds and throws inside the mount effect — which takes
// every SIBLING in the same set-piece down with it, so one bad scenery seed
// looks exactly like a broken land. `<TidePool>` shipped that bug and cost a
// whole park-probe round to diagnose.
//
// The builders are PURE (t, opts) => built, so this runs headless in node in
// seconds — no browser, no renderer. A DOM shim covers the procedural
// CanvasTextures that the shared `mat()` helper builds.
//
// DEPENDENCIES: esbuild + three come from the ephemeral render harness at
// /tmp/mp3d-render/node_modules (set HARNESS to point elsewhere). This file
// lives in the repo because /tmp has been wiped mid-project once already, and
// two Context.md files now cite this sweep as the guard on a real bug.
import Module from 'node:module';
import fs from 'node:fs';
import path from 'node:path';

const HARNESS = process.env.MP3D_HARNESS ?? '/tmp/mp3d-render';
// resolve components/ relative to this file (tools/../components); fall back to
// the known checkout so a stray copy of this script still works
const REPO = [
  path.resolve(new URL('..', import.meta.url).pathname, 'components'),
  '/Users/alexanderlee/Desktop/OpenRCT2/rct2-design-system/mp3d/components',
].find((p) => fs.existsSync(p));
if (!REPO) {
  console.log('cannot locate mp3d/components');
  process.exit(2);
}

const NM = path.join(HARNESS, 'node_modules');
if (!fs.existsSync(NM)) {
  console.log(`no harness node_modules at ${NM} — set MP3D_HARNESS to a dir with esbuild+three installed`);
  process.exit(2);
}
const { build } = await import(path.join(NM, 'esbuild', 'lib', 'main.js'));

const argv = process.argv.slice(2);
const names = argv.filter((a) => !a.startsWith('--'));
const seeds = Number((argv.find((a) => a.startsWith('--seeds=')) ?? '--seeds=400').slice(8));
const maxCount = Number((argv.find((a) => a.startsWith('--counts=')) ?? '--counts=8').slice(9));
if (names.length === 0) {
  console.log('usage: node seed-sweep.mjs <Component>... [--seeds=400] [--counts=8]');
  process.exit(2);
}

// The shim + driver are generated, so the sweep needs no per-component file.
const src = `
const noop = () => undefined;
const ctx2d = new Proxy({
  canvas: null,
  createLinearGradient: () => ({ addColorStop: noop }),
  createRadialGradient: () => ({ addColorStop: noop }),
  createConicGradient: () => ({ addColorStop: noop }),
  createPattern: () => null,
  // createImageData/getImageData MUST return a real object with a .data buffer:
  // several builders paint procedural crust/crack tiles pixel-by-pixel into one
  // and then read it back. A Proxy no-op here made every such builder "fail" on
  // every seed, which is a harness bug masquerading as a component bug.
  createImageData: (w, h) => ({ data: new Uint8ClampedArray(Math.max(1, (w | 0) * ((h ?? w) | 0) * 4)), width: w | 0, height: (h ?? w) | 0 }),
  getImageData: (x, y, w, h) => ({ data: new Uint8ClampedArray(Math.max(1, w * h * 4)), width: w, height: h }),
  putImageData: noop,
  measureText: () => ({ width: 10 }),
}, { get: (t, k) => (k in t ? t[k] : noop), set: () => true });
globalThis.document = {
  createElement: (tag) => {
    if (tag !== 'canvas') return {};
    const c = { width: 64, height: 64, getContext: () => ctx2d, style: {}, toDataURL: () => '' };
    ctx2d.canvas = c;
    return c;
  },
  createElementNS: (ns, tag) => globalThis.document.createElement(tag),
};
globalThis.window = globalThis;
globalThis.self = globalThis;

import * as THREE from 'three';
${names.map((n, i) => `import * as M${i} from ${JSON.stringify(path.join(REPO, n))};`).join('\n')}
const MODS = [${names.map((n, i) => `[${JSON.stringify(n)}, M${i}]`).join(', ')}];

const SEEDS = ${seeds};
const MAXC = ${maxCount};
let bad = 0;
let ran = 0;
for (const [modName, mod] of MODS) {
  const builders = Object.keys(mod).filter((k) => /^build[A-Z]/.test(k) && typeof mod[k] === 'function');
  if (builders.length === 0) { console.log('     ' + modName + ': no build* exports'); continue; }
  for (const b of builders) {
    const fails = [];
    let firstErr = '';
    const attempt = (opts, tag) => {
      ran += 1;
      try { mod[b](THREE, opts); } catch (e) {
        if (!firstErr) firstErr = (e && e.message) || String(e);
        fails.push(tag);
      }
    };
    for (let s = 0; s < SEEDS; s += 1) attempt({ seed: s }, 's' + s);
    // discrete count knobs are a second axis of the same failure mode
    for (let c = 1; c <= MAXC; c += 1) for (let s = 0; s < 60; s += 1) attempt({ seed: s, count: c }, 'c' + c + '/s' + s);
    bad += fails.length;
    const label = (modName + '.' + b).padEnd(38);
    if (fails.length === 0) console.log('ok   ' + label + ' clean');
    else console.log('FAIL ' + label + fails.length + ' throw(s)  first=' + fails.slice(0, 5).join(',') + '  "' + firstErr + '"');
  }
}
console.log('');
console.log(bad === 0 ? 'SWEEP CLEAN (' + ran + ' builds)' : 'SWEEP DIRTY: ' + bad + ' throws of ' + ran + ' builds');
process.exitCode = bad === 0 ? 0 : 1;
`;

fs.mkdirSync(path.join(HARNESS, 'out'), { recursive: true });
const entry = path.join(HARNESS, 'out', '_seed-sweep-entry.tsx');
fs.writeFileSync(entry, src);

const res = await build({
  entryPoints: [entry],
  bundle: true,
  write: false,
  format: 'cjs',
  platform: 'node',
  jsx: 'automatic',
  loader: { '.tsx': 'tsx', '.ts': 'ts' },
  define: { 'process.env.NODE_ENV': '"production"' },
  nodePaths: [path.join(HARNESS, 'node_modules')],
  target: 'node20',
  logLevel: 'silent',
}).catch((e) => {
  console.log('BUILD FAIL');
  for (const x of (e.errors ?? []).slice(0, 8)) console.log('  ', `${x.location?.file}:${x.location?.line}`, x.text);
  process.exit(1);
});

const m = new Module('seed-sweep');
m.paths = [path.join(HARNESS, 'node_modules')];
m._compile(res.outputFiles[0].text, path.join(HARNESS, 'seed-sweep.cjs'));

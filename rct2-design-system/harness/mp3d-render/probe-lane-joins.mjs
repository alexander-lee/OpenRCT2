#!/usr/bin/env node
// ---------------------------------------------------------------------------
// probe-lane-joins.mjs — MEASURES the RIDE ACCESS JOINS numerically.
//
// Mounts harness/mp3d-render/lane-park.tsx (six rides on one lattice, real
// undulating terrain) and prints, per ride:
//
//   headStep   rendered queue-lane surface at its HEAD  −  entrance-hut apron
//   tailStep   rendered queue-lane surface at its far end  −  street surface at
//              the tail node, plus whether PAVEMENT exists at that cell at all
//              (an unpaved tail is a guest walking on grass to reach the queue)
//   exStart    exit-path near end  −  exit-hut apron
//   exEnd      exit-path far end   −  the street it joins
//
// A CONSTANT step across every ride is a units/datum error, not a layout one.
// Every sample is the HIGHEST slab-coloured hit over five lateral offsets, and
// the hit colour is recorded, so an expansion seam (0.009 proud) or a kerb
// (0.01 proud) can never be mistaken for the pavement it sits on.
//
//   node probe-lane-joins.mjs [--json=out.json] [--raw]
// ---------------------------------------------------------------------------
import { build } from 'esbuild';
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HARNESS = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const opt = (k, d) => {
  const hit = args.find((a) => a.startsWith(`--${k}=`));
  return hit ? hit.slice(k.length + 3) : d;
};

const entrySrc = `
import React from 'react';
import { createRoot } from 'react-dom/client';
import { LanePark } from ${JSON.stringify(path.join(HARNESS, 'lane-park.tsx'))};
createRoot(document.getElementById('root')).render(React.createElement(LanePark));
`;
const entryPath = path.join(HARNESS, 'out', '_entry-lane-joins.tsx');
fs.mkdirSync(path.dirname(entryPath), { recursive: true });
fs.writeFileSync(entryPath, entrySrc);

const bundle = await build({
  entryPoints: [entryPath], bundle: true, write: false, format: 'iife', jsx: 'automatic',
  loader: { '.tsx': 'tsx', '.ts': 'ts' }, define: { 'process.env.NODE_ENV': '"production"' },
  nodePaths: [path.join(HARNESS, 'node_modules')], target: 'chrome120', logLevel: 'silent',
}).catch((e) => {
  console.error('esbuild failed:');
  for (const err of e.errors ?? []) console.error(` ${err.location?.file}:${err.location?.line} ${err.text}`);
  process.exit(1);
});

const htmlPath = path.join(HARNESS, 'out', 'lane-joins.html');
fs.writeFileSync(htmlPath, `<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0}</style></head><body><div id="root"></div><script>${bundle.outputFiles[0].text}</script></body></html>`);

const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--disable-gpu-driver-bug-workarounds'] });
const page = await browser.newPage({ viewport: { width: 900, height: 700 } });
const logs = [];
page.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`));
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
await page.goto(`file://${htmlPath}`);
let ready = null;
for (let i = 0; i < 140 && !ready; i += 1) {
  await page.waitForTimeout(500);
  ready = await page.evaluate(() => (window.__parkReport && window.__laneProbe ? 1 : null));
}
if (!ready) {
  console.log('[probe] park never became ready');
  console.log(logs.filter((l) => /error|warn/i.test(l)).slice(0, 30).join('\n'));
  await browser.close();
  process.exit(1);
}
const report = await page.evaluate(() => window.__parkReport);
const raw = await page.evaluate(() => window.__laneProbe());
await browser.close();
if (raw.error) {
  console.log('[probe] ' + raw.error);
  process.exit(1);
}

const F = (v) => (v === null || v === undefined || Number.isNaN(v) ? '    n/a' : (v >= 0 ? '+' : '') + v.toFixed(4));
const sub = (a, b) => (a && b ? +(a.y - b.y).toFixed(5) : null);

const rows = [];
console.log('\n=== RIDE ACCESS JOINS =====================================================');
console.log('  headStep/exStart = lane surface − hut apron   (one xz, so a real step)');
console.log('  tailJoin/exitJoin = lane surface − street slab at the SAME xz');
console.log('               laneLen  headStep  tailJoin  tailPaved  exitLen  exStart  exitJoin');
for (const r of raw.rides) {
  const L = r.lane ?? {};
  const X = r.exit ?? {};
  const row = {
    name: r.name,
    laneLen: L.len ?? null,
    headStep: sub(L.head, L.hutApron),
    tailStep: L.end && L.streetAtTail !== undefined ? +(L.end.y - L.streetAtTail).toFixed(5) : null,
    tailPaved: !!L.tailPave,
    // THE STEP where the queue meets the street: both surfaces at ONE xz
    tailJoin: sub(L.overlapLane, L.overlapStreet),
    exitLaneLen: X.laneLen ?? null,
    exStart: sub(X.start, X.hutApron),
    exEnd: X.endSurf && X.streetAtEnd !== undefined ? +(X.endSurf.y - X.streetAtEnd).toFixed(5) : null,
    // THE STEP where the exit path meets the street: both surfaces at ONE xz
    exitJoin: sub(X.overlapExit, X.overlapStreet),
    detail: { lane: L, exit: X },
  };
  rows.push(row);
  console.log(
    `${r.name.padEnd(13)}  ${String(row.laneLen).padStart(5)}   ${F(row.headStep)}   ${F(row.tailJoin)}   ` +
      `${row.tailPaved ? 'yes' : 'NO '}      ${String(row.exitLaneLen).padStart(5)}   ${F(row.exStart)}  ${F(row.exitJoin)}`,
  );
}
const spread = (k) => {
  const v = rows.map((r) => r[k]).filter((x) => x !== null && x !== undefined);
  if (!v.length) return 'n/a';
  const mn = Math.min(...v);
  const mx = Math.max(...v);
  const flat = mx - mn < 1e-4;
  return `${F(mn)} .. ${F(mx)}  spread ${(mx - mn).toFixed(4)}${flat ? (Math.abs(mx) < 1e-4 ? '  CONSTANT ZERO — flush' : '  CONSTANT NON-ZERO ⇒ DATUM BUG') : ''}`;
};
console.log('\n--- across all rides ------------------------------------------------------');
console.log(`headStep  ${spread('headStep')}`);
console.log(`tailJoin  ${spread('tailJoin')}`);
console.log(`exStart   ${spread('exStart')}`);
console.log(`exitJoin  ${spread('exitJoin')}`);
console.log(`(vs the SIM datum walkYAt: tailStep ${spread('tailStep')} / exEnd ${spread('exEnd')} — should be ~+0.006, the rendered lip)`);
console.log(`tailPaved ${rows.filter((r) => r.tailPaved).length}/${rows.length}`);
console.log('\nvalidate ok:', report?.ok, '| failures:', (report?.failures ?? []).length, '| warnings:', (report?.warnings ?? []).map((w) => w.kind).join(','));
for (const f of report?.failures ?? []) console.log('  FAIL', f.kind ?? '', (f.detail ?? f.message ?? JSON.stringify(f)).slice(0, 200));
console.log('\nSCENE CENSUS', JSON.stringify(raw.census));
console.log('streetPave meshes (local y span)', JSON.stringify(raw.bounds));
const st = raw.stats ?? {};
console.log(`sim: t=${(st.simTime ?? 0).toFixed(0)}s guests=${st.activeGuests} queued=${st.queued} riding=${st.riding} ridden=${st.riddenTotal}`);
if (args.includes('--raw')) console.log('\nRAW\n' + JSON.stringify(rows, null, 1));
const bad = logs.filter((l) => /warn|error/i.test(l) && !/GL Driver|WebGL|ReadPixels/i.test(l));
console.log('\nCONSOLE (filtered):', bad.length ? '\n' + bad.join('\n') : 'none');
const jsonOut = opt('json', null);
if (jsonOut) fs.writeFileSync(path.resolve(jsonOut), JSON.stringify({ rows, report }, null, 1));

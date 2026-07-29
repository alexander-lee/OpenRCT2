#!/usr/bin/env node
// MOUNT-COST probe — where does a park's initial load actually go?
//
// Every composable mounts in its own useEffect, and React runs all the effects
// of a commit SYNCHRONOUSLY in one task, so a whole park builds in a single
// blocking block before the browser can paint anything. This measures that
// directly: the long task around createRoot().render(), the delay until the
// first animation frame can run, and a breakdown of the wall time each
// component's build consumed (instrumented through window.__buildMarks, which
// the Park store fills when window.__PARK_PROFILE is set).
//
//   node probe-mount-cost.mjs [--park=<file.tsx>] [--export=Name]
import { build } from 'esbuild';
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HARNESS = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HARNESS, '..', '..', 'mp3d');
const arg = (k, d) => {
  const hit = process.argv.find((a) => a.startsWith(`--${k}=`));
  return hit ? hit.slice(k.length + 3) : d;
};
const parkFile = arg('park', path.join(REPO, 'components/Park/Park.previews.tsx'));
const exportName = arg('export', 'DemoPark');

const entrySrc = `
import React from 'react';
import { createRoot } from 'react-dom/client';
import { ${exportName} } from ${JSON.stringify(parkFile)};
window.__PARK_PROFILE = true;   // ask the Park store to time every build
const t0 = performance.now();
window.__t0 = t0;
// LONG TASKS are the freeze: React 18 runs mount effects in a scheduler task,
// not inside render(), so the block shows up here rather than around render.
window.__long = [];
try {
  new PerformanceObserver((l) => {
    for (const e of l.getEntries()) window.__long.push({ start: e.startTime - t0, ms: e.duration });
  }).observe({ entryTypes: ['longtask'] });
} catch (err) { void err; }
// FRAME GAPS: the longest interval between consecutive animation frames is
// what the user actually experiences as "the page froze".
window.__frames = [];
let prev = t0;
const tick = () => {
  const now = performance.now();
  window.__frames.push({ at: now - t0, gap: now - prev });
  prev = now;
  if (now - t0 < 25000) requestAnimationFrame(tick);
};
requestAnimationFrame(tick);
createRoot(document.getElementById('root')).render(React.createElement(${exportName}));
`;
const entryPath = path.join(HARNESS, 'out', '_entry-mount-cost.tsx');
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

const htmlPath = path.join(HARNESS, 'out', 'mount-cost.html');
fs.writeFileSync(htmlPath, `<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0}</style></head><body><div id="root"></div><script>${bundle.outputFiles[0].text}</script></body></html>`);

const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--disable-gpu-driver-bug-workarounds'] });
const page = await browser.newPage({ viewport: { width: 1000, height: 700 } });
page.on('pageerror', (e) => console.log(`[pageerror] ${e.message}`));
// TIMELINE: what is the page doing during the long tasks? Console arrival
// times attribute the blocking work to a phase (terrain, validate, sim).
const t0 = Date.now();
const timeline = [];
page.on('console', (m) => {
  const txt = m.text();
  if (txt.length < 200 && !/GL Driver|ReadPixels/.test(txt)) timeline.push({ at: Date.now() - t0, txt: txt.slice(0, 110) });
});
await page.goto(`file://${htmlPath}`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(20000);

const r = await page.evaluate(() => {
  const frames = window.__frames ?? [];
  const worst = frames.reduce((b, f) => (!b || f.gap > b.gap ? f : b), null);
  // when did the page settle into steady frames? first 10 consecutive < 60 ms
  let settled = null;
  let run = 0;
  for (const f of frames) {
    run = f.gap < 60 ? run + 1 : 0;
    if (run >= 10) { settled = f.at; break; }
  }
  return {
    long: (window.__long ?? []).sort((a, b) => b.ms - a.ms).slice(0, 6),
    longTotal: (window.__long ?? []).reduce((a, e) => a + e.ms, 0),
    worstGap: worst,
    settled,
    ready: window.__parkReport ? true : false,
    marks: window.__buildMarks ?? null,
  };
});
console.log(`\nWORST FRAME GAP (the freeze the user sees): ${r.worstGap ? `${r.worstGap.gap.toFixed(0)} ms at t+${r.worstGap.at.toFixed(0)} ms` : 'n/a'}`);
console.log(`STEADY FRAMES FROM:                        ${r.settled == null ? 'never settled in 25 s' : 't+' + r.settled.toFixed(0) + ' ms'}`);
console.log(`LONG TASKS: ${r.longTotal.toFixed(0)} ms total; worst ${r.long.map((e) => `${e.ms.toFixed(0)}ms@${e.start.toFixed(0)}`).join(', ') || 'none reported'}`);
console.log(`onReady fired: ${r.ready}`);
if (Array.isArray(r.marks) && r.marks.length) {
  const total = r.marks.reduce((a, m) => a + m.ms, 0);
  r.marks.sort((a, b) => b.ms - a.ms);
  console.log(`\n${r.marks.length} instrumented builds, ${total.toFixed(0)} ms of build work. Worst:`);
  for (const m of r.marks.slice(0, 18)) console.log(`  ${m.ms.toFixed(1).padStart(7)} ms  ${m.name}`);
} else {
  console.log('\n(no build marks — the Park store is not instrumented yet)');
}
console.log('\nTIMELINE (console arrival, ms after launch):');
for (const e of timeline) console.log(`  t+${String(e.at).padStart(6)}  ${e.txt}`);
await browser.close();

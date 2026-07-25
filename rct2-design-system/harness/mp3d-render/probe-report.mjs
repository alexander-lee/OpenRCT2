// Reads the compiled track report the component stashes on its group
// (`g.userData.trackReport`) out of the LIVE preview scene — the in-browser
// proof that the shipped preview layouts compile clean.
//   node probe-report.mjs <Name> [previewIndex]
import { build } from 'esbuild';
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const HARNESS = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HARNESS, '..', '..', 'mp3d');
const name = process.argv[2] || 'MineTrainCoaster';
const only = process.argv[3];
const compDir = path.join(REPO, 'components', name);
const entry = `
import React from 'react';
import { createRoot } from 'react-dom/client';
import previews from ${JSON.stringify(path.join(compDir, `${name}.previews.tsx`))};
const list = previews.previews ?? [];
const shown = ${only === undefined ? 'list' : `[list[${only}]].filter(Boolean)`};
createRoot(document.getElementById('root')).render(React.createElement('div', null, shown.map((p,i)=>React.createElement('div',{key:i},p.render()))));
`;
const ep = path.join(HARNESS, 'out', `_rep-${name}.tsx`);
fs.writeFileSync(ep, entry);
const b = await build({ entryPoints: [ep], bundle: true, write: false, format: 'iife', jsx: 'automatic', loader: { '.tsx': 'tsx', '.ts': 'ts' }, define: { 'process.env.NODE_ENV': '"production"' }, nodePaths: [path.join(HARNESS, 'node_modules')], target: 'chrome120', logLevel: 'silent' });
const html = path.join(HARNESS, 'out', `rep-${name}.html`);
fs.writeFileSync(html, `<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;background:#38343a}#root{width:900px}</style></head><body><div id="root"></div><script>${b.outputFiles[0].text}</script></body></html>`);
const br = await chromium.launch({ args: ['--use-angle=swiftshader'] });
const pg = await br.newPage({ viewport: { width: 900, height: 700 } });
const logs = [];
pg.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`));
pg.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
await pg.goto(`file://${html}`);
await pg.waitForTimeout(9000);
const reports = await pg.evaluate(() => {
  const out = [];
  for (const c of document.querySelectorAll('canvas')) {
    const scene = c.__stageApi?.scene;
    if (!scene) continue;
    scene.traverse((o) => {
      if (o.userData && o.userData.trackReport) {
        const r = o.userData.trackReport;
        out.push({
          ok: r.ok, fatal: r.fatal ?? false, fatalReason: r.fatalReason,
          designOk: r.design?.ok, violations: (r.design?.violations ?? []).map((v) => `${v.kind}@${v.at.toFixed(2)}`),
          clearance: r.valid?.worst, closed: r.closure?.closed, gap: r.closure?.gap,
          synthesized: r.closure?.synthesized, warnings: r.warnings,
        });
      }
    });
  }
  return out;
});
console.log('REPORTS', JSON.stringify(reports, null, 1));
const bad = logs.filter((l) => /warn|error|fatal|self-inter|violation/i.test(l) && !/GL Driver|WebGL|ReadPixels/i.test(l));
console.log('SUSPECT CONSOLE LINES:', bad.length ? '\n' + bad.join('\n') : 'none');
await br.close();

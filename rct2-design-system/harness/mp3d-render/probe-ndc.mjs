// Measure how a preview actually lands on screen: projects every mesh's
// bounding box into NDC and reports the frame occupancy + what sticks out.
//   node probe-ndc.mjs <Name> [previewIndex]
import { build } from 'esbuild';
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const HARNESS = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HARNESS, '..', '..', 'mp3d');
const name = process.argv[2] || 'MineTrainCoaster';
const only = process.argv[3] ?? '0';
const compDir = path.join(REPO, 'components', name);
const entry = `
import React from 'react';
import { createRoot } from 'react-dom/client';
import previews from ${JSON.stringify(path.join(compDir, `${name}.previews.tsx`))};
const list = previews.previews ?? [];
createRoot(document.getElementById('root')).render(React.createElement('div', null, [list[${only}]].map((p,i)=>React.createElement('div',{key:i},p.render()))));
`;
const ep = path.join(HARNESS, 'out', `_ndc-${name}.tsx`);
fs.writeFileSync(ep, entry);
const b = await build({ entryPoints: [ep], bundle: true, write: false, format: 'iife', jsx: 'automatic', loader: { '.tsx': 'tsx', '.ts': 'ts' }, define: { 'process.env.NODE_ENV': '"production"' }, nodePaths: [path.join(HARNESS, 'node_modules')], target: 'chrome120', logLevel: 'silent' });
const html = path.join(HARNESS, 'out', `ndc-${name}.html`);
fs.writeFileSync(html, `<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;background:#38343a}#root{width:900px}</style></head><body><div id="root"></div><script>${b.outputFiles[0].text}</script></body></html>`);
const br = await chromium.launch({ args: ['--use-angle=swiftshader'] });
const pg = await br.newPage({ viewport: { width: 900, height: 700 } });
pg.on('console', (m) => { if (/warn|error|FATAL|design|self-inter/i.test(m.text())) console.log(`[page:${m.type()}] ${m.text()}`); });
await pg.goto(`file://${html}`);
await pg.waitForTimeout(6000);
const info = await pg.evaluate(() => {
  const c = document.querySelector('canvas');
  const cam = c.__stageApi.cameras()[0];
  const scene = c.__stageApi.scene;
  cam.updateMatrixWorld(true);
  cam.matrixWorldInverse.copy(cam.matrixWorld).invert();
  const v = cam.position.clone();
  const proj = (x, y, z) => {
    v.set(x, y, z).applyMatrix4(cam.matrixWorldInverse).applyMatrix4(cam.projectionMatrix);
    return [v.x, v.y, v.z];
  };
  let xmin = 9e9, xmax = -9e9, ymin = 9e9, ymax = -9e9;
  const marks = [];
  scene.traverse((o) => {
    if (!o.isMesh || !o.visible) return;
    const g = o.geometry;
    const pos = g.getAttribute && g.getAttribute('position');
    if (!pos) return;
    if (!g.boundingBox) g.computeBoundingBox();
    const bb = g.boundingBox;
    const size = Math.max(bb.max.x - bb.min.x, bb.max.y - bb.min.y, bb.max.z - bb.min.z);
    if (size > 60) return; // the ground disc / sky dome
    o.updateMatrixWorld();
    const m = o.matrixWorld;
    const n = pos.count;
    const step = Math.max(1, Math.floor(n / 400));
    for (let i = 0; i < n; i += step) {
      v.set(pos.getX(i), pos.getY(i), pos.getZ(i)).applyMatrix4(m);
      const wx = v.x, wy = v.y, wz = v.z;
      const p = proj(wx, wy, wz);
      if (p[0] < xmin) { xmin = p[0]; marks.push(['xmin', +p[0].toFixed(2), [+wx.toFixed(1), +wy.toFixed(1), +wz.toFixed(1)]]); }
      if (p[0] > xmax) { xmax = p[0]; marks.push(['xmax', +p[0].toFixed(2), [+wx.toFixed(1), +wy.toFixed(1), +wz.toFixed(1)]]); }
      if (p[1] < ymin) { ymin = p[1]; marks.push(['ymin', +p[1].toFixed(2), [+wx.toFixed(1), +wy.toFixed(1), +wz.toFixed(1)]]); }
      if (p[1] > ymax) { ymax = p[1]; marks.push(['ymax', +p[1].toFixed(2), [+wx.toFixed(1), +wy.toFixed(1), +wz.toFixed(1)]]); }
    }
  });
  const last = (k) => marks.filter((m2) => m2[0] === k).slice(-1)[0];
  const outliers = ['xmin', 'xmax', 'ymin', 'ymax'].map(last).filter(Boolean);
  const outCount = 0;
  return { cam: cam.position.toArray().map((n) => +n.toFixed(2)), fov: cam.fov, aspect: +cam.aspect.toFixed(3), ndc: { xmin: +xmin.toFixed(2), xmax: +xmax.toFixed(2), ymin: +ymin.toFixed(2), ymax: +ymax.toFixed(2) }, outCount: outliers.length, outliers: outliers.slice(0, 12) };
});
console.log(JSON.stringify(info, null, 1));
await br.close();

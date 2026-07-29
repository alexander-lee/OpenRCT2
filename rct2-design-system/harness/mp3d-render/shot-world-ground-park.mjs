#!/usr/bin/env node
// ---------------------------------------------------------------------------
// shot-world-ground-park.mjs — the floor-vs-path interface in a REAL park,
// over the REAL path builder.
//
// `shot-world-ground.mjs` photographs `buildWorldGroundScene` against a
// HAND-MADE path slab on a synthetic test bed, which is why it passed while
// generated parks still buried their streets: it mounts the builder's group at
// the scene origin, and the bug was that a real <Park> mounts it at
// `park.floorAt(rectCentre)` instead (see the datum note in WorldGround).
//
// This mounts a real sample, aims the camera at a street that runs INSIDE a
// world rect, and shoots the same frame twice from ONE mount:
//
//   after.png   the shipped floor (every WorldGround wrapper at y = 0)
//   before.png  the wrapper lifted by LIFT, reproducing the old datum bug
//
// so the two frames differ by exactly the lift and nothing else.
//
//   node shot-world-ground-park.mjs [x] [z] [lift]
// ---------------------------------------------------------------------------
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { bundleParkPage } from './lib.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SAMPLE = path.resolve(HERE, '../park-eval/samples/w33a.tsx');
// a street that runs through the enchantedForest rect (centre 4.8, 41.4):
// w33a's own validate report names `<Boulevard gateAve>` at [2.5, 27.6]
const AT = [Number(process.argv[2] ?? 2.5), Number(process.argv[3] ?? 27.6)];
// the lift measured on this very sample by probe-world-ground-datum.mjs
const LIFT = Number(process.argv[4] ?? 0.1177);
const OUT = path.join(HERE, 'shots');
fs.mkdirSync(OUT, { recursive: true });

const html = await bundleParkPage(SAMPLE, 'wgpark-w33a');

// HARDWARE GL, not SwiftShader. `lib.mjs`'s openParkPage runs the software
// rasteriser, which is fine for reading geometry out of the scene graph and has
// repeatedly given the wrong answer about PIXELS in this project — and pixels
// are the entire point of this script. Own browser, ANGLE on Metal.
const { chromium } = await import('playwright');
const browser = await chromium.launch({
  args: ['--use-angle=metal', '--ignore-gpu-blocklist', '--enable-gpu-rasterization'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const lines = [];
page.on('console', (m) => lines.push(`[${m.type()}] ${m.text()}`));
page.on('pageerror', (e) => lines.push(`[pageerror] ${e.message}`));
page.setDefaultNavigationTimeout(240000);
await page.goto(`file://${html}`, { waitUntil: 'load', timeout: 240000 });
{
  const deadline = Date.now() + 240000;
  while (Date.now() < deadline) {
    if (lines.some((l) => /validatePark →|validatePark skipped/.test(l))) break;
    await new Promise((r) => setTimeout(r, 500));
  }
  await new Promise((r) => setTimeout(r, 2500)); // let the last builds flush
}

await page.evaluate(
  ([d, h]) => {
    window.__wgDist = d;
    window.__wgHeight = h;
  },
  [Number(process.env.WG_DIST ?? 2.1), Number(process.env.WG_HEIGHT ?? 1.35)],
);

const aim = await page.evaluate(
  ([x, z]) => {
    const api = document.querySelector('canvas')?.__stageApi;
    if (!api) return { error: 'no __stageApi' };
    // close, low and oblique — the angle a buried slab actually shows at
    const d = Number(window.__wgDist ?? 2.1);
    const h = Number(window.__wgHeight ?? 1.35);
    const eye = [x + d, h, z + d];
    api.setCameraPose(eye, [x, 0.15, z]);
    let n = 0;
    api.scene.traverse((o) => {
      if (o.userData?.dsComponent === 'WorldGround') n += 1;
    });
    return { grounds: n, eye };
  },
  AT,
);
console.log('[aim]', JSON.stringify(aim));

const shoot = async (tag) => {
  await new Promise((r) => setTimeout(r, 1500));
  const f = path.join(OUT, `wg-park-${tag}.png`);
  await page.screenshot({ path: f, clip: { x: 320, y: 200, width: 640, height: 400 } });
  console.log('[shot]', f);
};

await shoot('after');

// re-introduce the old datum bug on the SAME mount: lift every floor wrapper
const lifted = await page.evaluate((lift) => {
  const api = document.querySelector('canvas').__stageApi;
  let n = 0;
  api.scene.traverse((o) => {
    if (o.userData?.dsComponent === 'WorldGround' && o.parent) {
      o.parent.position.y = lift;
      n += 1;
    }
  });
  return n;
}, LIFT);
console.log('[lifted]', lifted, 'floors by', LIFT);
await shoot('before');

for (const l of lines.filter((l) => /WorldGround/.test(l))) console.log(l);
await browser.close();

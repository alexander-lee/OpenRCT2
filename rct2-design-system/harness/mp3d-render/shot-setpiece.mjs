#!/usr/bin/env node
// ---------------------------------------------------------------------------
// shot-setpiece.mjs — FIXED ORTHOGRAPHIC ELEVATIONS OF A THEMED SET-PIECE.
//
// `<ScenePreview>` auto-rotates (Stage does `az += 0.0045` every frame and
// exposes no azimuth prop), so `render.mjs` and `shot-scenery.mjs` cannot be
// used to judge geometry at all: two runs frame the piece differently and a true
// elevation is unobtainable. `shot-views.mjs` solved that for SceneryPack, but
// its `--comp=Name:fn` adapter calls `fn(THREE)` — a set-piece builder needs
// `(THREE, plan, park)`, and the question here is per-THEME, one row each.
//
// So this is shot-views' fixed-pose rig (same four cameras, same lights, same
// grade line, one shared bounding box per row so all four views share a scale)
// pointed at `buildBoulevardScene` / `buildFountainPlazaScene` through a stub
// park. In an ortho elevation a leaning mast is unarguably a leaning mast and a
// rigid truss is unarguably straight.
//
//   node shot-setpiece.mjs Boulevard                 # all six themes, one row each
//   node shot-setpiece.mjs FountainPlaza --night
//   node shot-setpiece.mjs Boulevard --theme=fire,neon
// ---------------------------------------------------------------------------
import { build } from 'esbuild';
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HARNESS = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HARNESS, '..', '..', 'mp3d');
const args = process.argv.slice(2);
const piece = args.find((a) => !a.startsWith('--')) ?? 'Boulevard';
const opt = (k, d) => {
  const hit = args.find((a) => a.startsWith(`--${k}=`));
  return hit ? hit.slice(k.length + 3) : d;
};
const NIGHT = args.includes('--night');
const themes = (opt('theme', null) ?? 'default,fire,pirateBeach,steampunk,enchantedForest,neon').split(',');
const CELL = 460;
const W = CELL * 4;
const H = CELL * themes.length;
const outPng = path.resolve(opt('out', path.join(HARNESS, 'shots', `setpiece-${piece}${NIGHT ? '-night' : ''}.png`)));

const entrySrc = `
import * as THREE from 'three';
import { boulevardPlan, buildBoulevardScene } from ${JSON.stringify(path.join(REPO, 'components/Boulevard'))};
import { fountainPlazaPlan, buildFountainPlazaScene } from ${JSON.stringify(path.join(REPO, 'components/FountainPlaza'))};
import { WORLD_THEMES } from ${JSON.stringify(path.join(REPO, 'components/SetPieceKit'))};

const PIECE = ${JSON.stringify(piece)};
const THEMES = ${JSON.stringify(themes)};
const NIGHT = ${NIGHT};
const CELL = ${CELL};
const park = {
  floorAt: () => 0,
  registerPlanted: () => () => {},
  registerBlocker: () => () => {},
  registerFootprint: () => () => {},
  registerWorld: () => () => {},
  _previewHost: true,
};
const CASES = {
  Boulevard: (th) => [boulevardPlan({ id: 'ave', from: [0, -8.4], to: [0, 8.4], seed: 4, theme: th }), buildBoulevardScene],
  FountainPlaza: (th) => [fountainPlazaPlan({ id: 'hub', position: [0, 0], tiles: 7, seed: 1, theme: th }), buildFountainPlazaScene],
};
const VIEWS = [
  { tag: 'FRONT (-z)', dir: [0, 0, -1], up: [0, 1, 0] },
  { tag: 'SIDE (+x)', dir: [1, 0, 0], up: [0, 1, 0] },
  { tag: 'TOP (-y)', dir: [0, 1, 0], up: [0, 0, 1] },
  { tag: '3/4', dir: [0.62, 0.42, 0.62], up: [0, 1, 0] },
];
const root = document.getElementById('root');
for (const tid of THEMES) {
  const theme = tid === 'default' ? undefined : WORLD_THEMES[tid];
  const [plan, builder] = CASES[PIECE](theme);
  const built = builder(THREE, plan, park);
  // nightK lives on the ROOT of the mounted tree in a real park (Stage sets it
  // and nightKOf walks UP the parents), so set it here or every themed glow
  // grades at its daylight floor and the night sheet is the day sheet
  built.group.userData.nightK = NIGHT ? 1 : 0;
  built.update?.(3.7); // never grade the rest pose
  const row = document.createElement('div');
  row.style.cssText = 'display:flex';
  root.appendChild(row);
  const bb = new THREE.Box3();
  built.group.updateMatrixWorld(true);
  built.group.traverse((o) => {
    if (o.isMesh) {
      o.geometry.computeBoundingBox();
      bb.expandByObject(o);
    }
  });
  const ctr = bb.getCenter(new THREE.Vector3());
  const span = Math.max(bb.max.x - bb.min.x, bb.max.y - bb.min.y, bb.max.z - bb.min.z) * 1.06;
  let meshes = 0;
  built.group.traverse((o) => {
    if (o.isMesh) meshes += 1;
  });
  for (const v of VIEWS) {
    const cell = document.createElement('div');
    cell.style.cssText = 'position:relative;width:' + CELL + 'px;height:' + CELL + 'px';
    const tag = document.createElement('div');
    tag.textContent = PIECE + ' · ' + tid + ' · ' + v.tag + ' · ' + meshes + ' meshes';
    tag.style.cssText = 'position:absolute;left:6px;top:4px;z-index:2;font:12px monospace;color:#fff;text-shadow:0 1px 3px #000';
    cell.appendChild(tag);
    row.appendChild(cell);
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(NIGHT ? 0x121620 : 0x2f3a2c);
    scene.add(new THREE.HemisphereLight(0xd8e8ff, 0x4a4030, NIGHT ? 0.28 : 1.5));
    const key = new THREE.DirectionalLight(0xfff2dc, NIGHT ? 0.16 : 1.9);
    key.position.set(4, 7, 5);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0xbcd0ff, NIGHT ? 0.1 : 0.7);
    fill.position.set(-5, 3, -4);
    scene.add(fill);
    const obj = built.group.clone(true); // a mesh lives in one scene at a time
    obj.position.sub(ctr);
    scene.add(obj);
    const grid = new THREE.GridHelper(span * 1.2, 24, 0x8fa07f, 0x64705a);
    grid.position.y = -ctr.y;
    scene.add(grid);
    const h = span / 2;
    if (v.tag === '3/4') {
      const p = new THREE.PerspectiveCamera(32, 1, 0.1, span * 20);
      p.position.set(v.dir[0] * span * 2.4, v.dir[1] * span * 2.4, v.dir[2] * span * 2.4);
      p.lookAt(0, 0, 0);
      renderTo(cell, scene, p);
      continue;
    }
    const cam = new THREE.OrthographicCamera(-h, h, h, -h, -span * 4, span * 4);
    cam.position.set(v.dir[0] * span * 2, v.dir[1] * span * 2, v.dir[2] * span * 2);
    cam.up.set(...v.up);
    cam.lookAt(0, 0, 0);
    renderTo(cell, scene, cam);
  }
}
function renderTo(cell, scene, cam) {
  const r = new THREE.WebGLRenderer({ antialias: true });
  r.setSize(CELL, CELL);
  r.render(scene, cam);
  const img = new Image();
  img.src = r.domElement.toDataURL();
  img.style.cssText = 'position:absolute;inset:0;width:100%;height:100%';
  cell.appendChild(img);
  r.dispose(); // four live WebGL contexts per row would blow the browser's limit
}
window.__ready = true;
`;
const entryPath = path.join(HARNESS, 'out', `_setpiece-${piece}.tsx`);
fs.mkdirSync(path.dirname(entryPath), { recursive: true });
fs.writeFileSync(entryPath, entrySrc);

const bundle = await build({
  entryPoints: [entryPath],
  bundle: true,
  write: false,
  format: 'iife',
  jsx: 'automatic',
  loader: { '.tsx': 'tsx', '.ts': 'ts' },
  define: { 'process.env.NODE_ENV': '"production"' },
  nodePaths: [path.join(HARNESS, 'node_modules')],
  target: 'chrome120',
  logLevel: 'silent',
}).catch((e) => {
  console.error('esbuild failed:');
  for (const err of e.errors ?? []) console.error(` ${err.location?.file}:${err.location?.line} ${err.text}`);
  process.exit(1);
});

const htmlPath = path.join(HARNESS, 'out', `setpiece-${piece}.html`);
fs.writeFileSync(
  htmlPath,
  `<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;background:#22262a}#root{width:${W}px}</style></head><body><div id="root"></div><script>${bundle.outputFiles[0].text}</script></body></html>`,
);

const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--disable-gpu-driver-bug-workarounds'] });
const page = await browser.newPage({ viewport: { width: W, height: Math.min(H, 4000) } });
page.on('pageerror', (e) => console.log(`[pageerror] ${e.message}`));
page.on('console', (m) => {
  if (m.type() === 'error') console.log(`[page:error] ${m.text()}`);
});
await page.goto(`file://${htmlPath}`, { waitUntil: 'domcontentloaded', timeout: 180000 });
await page.waitForFunction('window.__ready === true', null, { timeout: 180000 }).catch(() => console.log('[harness] page never signalled ready'));
await page.waitForTimeout(1500);
fs.mkdirSync(path.dirname(outPng), { recursive: true });
await page.screenshot({ path: outPng, fullPage: true });
await browser.close();
console.log(`[harness] wrote ${outPng}`);

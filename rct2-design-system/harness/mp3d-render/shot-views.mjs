#!/usr/bin/env node
// ---------------------------------------------------------------------------
// shot-views.mjs — DETERMINISTIC ORTHOGRAPHIC VIEWS of a SceneryPack piece.
//
// `shot-scenery.mjs` mounts a <ScenePreview>, whose Stage AUTO-ROTATES (az +=
// 0.0045 every frame) and exposes no azimuth/elevation prop. So every shot is
// taken from whatever angle the page happened to reach — two runs of the same
// command frame the piece differently, and you cannot get a true elevation at
// all. That is exactly the wrong tool for judging "is this roof pitched the
// right way" or "do these ribs leave the surface".
//
// This builds the piece into a bare three.js scene and renders it through
// ORTHOGRAPHIC cameras at fixed poses: FRONT (−z), SIDE (+x), TOP (−y) and a
// 3/4 perspective. Silhouettes in an ortho elevation are unambiguous — a gable
// roof is a /\ and a butterfly roof is a \/, with no perspective to argue about.
//
//   node shot-views.mjs wishingWell [--pad=1.15] [--out=path]
// ---------------------------------------------------------------------------
import { build } from 'esbuild';
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HARNESS = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HARNESS, '..', '..', 'mp3d');
const args = process.argv.slice(2);
const names = args.filter((a) => !a.startsWith('--'));
if (!names.length) {
  console.error('usage: node shot-views.mjs <pieceName> [more…] [--pad=1.15]');
  process.exit(1);
}
const opt = (k, d) => {
  const hit = args.find((a) => a.startsWith(`--${k}=`));
  return hit ? hit.slice(k.length + 3) : d;
};
const pad = Number(opt('pad', 1.12));
const CELL = 420;
const W = CELL * 5;
const H = CELL * names.length;
const outPng = path.resolve(opt('out', path.join(HARNESS, 'shots', `views-${names.join('-')}.png`)));

// `--comp=ParkEntrance:buildParkEntrance` shoots ANY component's builder instead
// of a SceneryPack piece. Builders differ in signature — buildSceneryAnimated is
// (t, name, opts) while buildParkEntrance is (t, opts) — so the entry adapts:
// anything not a SceneryPack name is called as fn(THREE) and must return
// { group, update? }.
const comp = opt('comp', null);
const [compName, compFn] = comp ? comp.split(':') : [null, null];
// `--compopts='{"width":2.4}'` passes an options object to the builder. Without
// it every shot is of the DEFAULTS, so a parameter whose whole job is to change
// the geometry (ParkEntrance's `width` widens the arch, and detail pinned to a
// hard-coded x slides off the tower when it changes) can never be looked at.
const compOpts = opt('compopts', null);

const entrySrc = `
import * as THREE from 'three';
${
  comp
    ? `import { ${compFn} } from ${JSON.stringify(path.join(REPO, 'components', compName))};
const buildSceneryAnimated = () => ${compFn}(THREE${compOpts ? `, ${compOpts}` : ''});`
    : `import { buildSceneryAnimated } from ${JSON.stringify(path.join(REPO, 'components/SceneryPack'))};`
}
const NAMES = ${JSON.stringify(names)};
const CELL = ${CELL};
const PAD = ${pad};
// five fixed poses. dir = where the camera SITS relative to the target.
// BOTH z elevations are shot: components with a FRONT and a BACK (ParkEntrance's
// ticket-booth face is +z, its plaque face −z; a stall's counter faces one way)
// had half their dressing off-sheet, and "I looked at the elevations" then meant
// nothing for that half.
const VIEWS = [
  { tag: 'FRONT (-z)', dir: [0, 0, -1], up: [0, 1, 0] },
  { tag: 'BACK (+z)', dir: [0, 0, 1], up: [0, 1, 0] },
  { tag: 'SIDE (+x)', dir: [1, 0, 0], up: [0, 1, 0] },
  { tag: 'TOP (-y)', dir: [0, 1, 0], up: [0, 0, 1] },
  { tag: '3/4', dir: [0.62, 0.5, 0.62], up: [0, 1, 0] },
];
const root = document.getElementById('root');
for (const name of NAMES) {
  const built = buildSceneryAnimated(THREE, name, { seed: 3 });
  // settle any animation to a mid-cycle pose rather than grading the rest pose
  built.update?.(3.7);
  const row = document.createElement('div');
  row.style.cssText = 'display:flex';
  root.appendChild(row);
  // one shared bounding box so all four views share a scale
  const bb = new THREE.Box3();
  built.group.updateMatrixWorld(true);
  built.group.traverse((o) => {
    if (o.isMesh) {
      o.geometry.computeBoundingBox(); // cached boxes go stale on rebuilt geometry
      bb.expandByObject(o);
    }
  });
  const ctr = bb.getCenter(new THREE.Vector3());
  const span = Math.max(bb.max.x - bb.min.x, bb.max.y - bb.min.y, bb.max.z - bb.min.z) * PAD;
  for (const v of VIEWS) {
    const cell = document.createElement('div');
    cell.style.cssText = 'position:relative;width:' + CELL + 'px;height:' + CELL + 'px';
    const tag = document.createElement('div');
    tag.textContent = name + '  ' + v.tag;
    tag.style.cssText =
      'position:absolute;left:6px;top:4px;z-index:2;font:11px monospace;color:#fff;text-shadow:0 1px 2px #000';
    cell.appendChild(tag);
    row.appendChild(cell);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x2f3a2c);
    scene.add(new THREE.HemisphereLight(0xd8e8ff, 0x4a4030, 1.5));
    const key = new THREE.DirectionalLight(0xfff2dc, 1.9);
    key.position.set(4, 7, 5);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0xbcd0ff, 0.7);
    fill.position.set(-5, 3, -4);
    scene.add(fill);
    // each view needs its own copy — a mesh lives in one scene at a time
    const obj = built.group.clone(true);
    obj.position.sub(ctr);
    scene.add(obj);
    // a faint ground line at the piece's y=0 plane, so "floating" is visible
    const grid = new THREE.GridHelper(span * 2, 20, 0x8fa07f, 0x64705a);
    grid.position.y = -ctr.y;
    scene.add(grid);

    const h = span / 2;
    const cam = new THREE.OrthographicCamera(-h, h, h, -h, -span * 4, span * 4);
    if (v.tag === '3/4') {
      // perspective for the 3/4 so it reads like the park camera
      const p = new THREE.PerspectiveCamera(34, 1, 0.1, span * 20);
      p.position.set(v.dir[0] * span * 2.6, v.dir[1] * span * 2.6, v.dir[2] * span * 2.6);
      p.lookAt(0, 0, 0);
      renderTo(cell, scene, p);
      continue;
    }
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
  r.dispose(); // 4 live WebGL contexts per row would blow the browser's limit
}
window.__ready = true;
`;
const entryPath = path.join(HARNESS, 'out', `_views-${names.join('-')}.tsx`);
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

const htmlPath = path.join(HARNESS, 'out', `views-${names.join('-')}.html`);
fs.writeFileSync(
  htmlPath,
  `<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;background:#22262a}#root{width:${W}px}</style></head><body><div id="root"></div><script>${bundle.outputFiles[0].text}</script></body></html>`,
);

const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--disable-gpu-driver-bug-workarounds'] });
const page = await browser.newPage({ viewport: { width: W, height: H } });
page.on('pageerror', (e) => console.log(`[pageerror] ${e.message}`));
page.on('console', (m) => {
  if (m.type() === 'error') console.log(`[page:error] ${m.text()}`);
});
await page.goto(`file://${htmlPath}`, { waitUntil: 'domcontentloaded', timeout: 120000 });
await page.waitForFunction('window.__ready === true', null, { timeout: 120000 }).catch(() => console.log('[harness] page never signalled ready'));
await page.waitForTimeout(1200);
fs.mkdirSync(path.dirname(outPng), { recursive: true });
await page.screenshot({ path: outPng, fullPage: true });
await browser.close();
console.log(`[harness] wrote ${outPng}`);

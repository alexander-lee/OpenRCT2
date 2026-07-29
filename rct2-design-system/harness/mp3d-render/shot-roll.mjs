#!/usr/bin/env node
// ---------------------------------------------------------------------------
// shot-roll.mjs — FIXED-ANGLE ortho elevations of SplineCoaster's roll channel.
//
// `render.mjs` mounts a <ScenePreview>, whose Stage AUTO-ROTATES, so it cannot
// be used to judge whether track is actually upside down. `shot-views.mjs`
// does fixed ortho poses but calls a component builder as `fn(THREE)` with no
// options, which would only ever shoot the stock (unrolled) circuit. So this
// builds the barrel-roll circuit directly and shoots four DETERMINISTIC views
// of the roll element, cropped to it, with the train ticked to the roll apex.
//
// Row 1 is the rolled build, row 2 the SAME points with the roll removed — the
// A/B is the point: whatever is different between the rows IS the roll channel.
//
//   node shot-roll.mjs [--wide] [--out=path]
//     --wide   shoot the whole circuit instead of the roll element
// ---------------------------------------------------------------------------
import { build } from 'esbuild';
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HARNESS = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HARNESS, '..', '..', 'mp3d');
const args = process.argv.slice(2);
const opt = (k, d) => {
  const hit = args.find((a) => a.startsWith(`--${k}=`));
  return hit ? hit.slice(k.length + 3) : d;
};
const wide = args.includes('--wide');
const CELL = 460;
const outPng = path.resolve(opt('out', path.join(HARNESS, 'shots', `roll${wide ? '-wide' : ''}.png`)));

// the shipped preview's layout + roll, verbatim
const { BARREL } = await import(path.join(HARNESS, 'probe-cork-layout.mjs'));

const entrySrc = `
import * as THREE from 'three';
import { buildSplineCoaster } from ${JSON.stringify(path.join(REPO, 'components/SplineCoaster'))};
import { buildCoasterCar } from ${JSON.stringify(path.join(REPO, 'components/CoasterCar'))};
const BARREL = ${JSON.stringify(BARREL)};
const ROLL = [{ atPoint: 41.5, dir: 'R', turns: 1 }];
const CELL = ${CELL};
const WIDE = ${wide};
// the roll apex: probe-cork reports the lead car at up.y -0.9998 at t = 13.817
const T_APEX = 13.817;
const root = document.getElementById('root');

function scene(roll) {
  const c = buildSplineCoaster(THREE, BARREL, { bank: 0.55, type: 'steel', roll });
  const cars = ['front', 'middle', 'end'].map((v) => buildCoasterCar(THREE, v));
  const tick = c.run(cars, { spacing: 1.5 });
  for (let t = 0; t <= T_APEX; t += 1 / 60) tick(t); // walk the whole cycle, do NOT jump
  tick(T_APEX);
  return { group: c.group, frameAt: c.frameAt };
}

// crop target: the roll element's centre frame (u 0.7094 is the measured apex)
const rows = [
  { tag: 'ROLL  {atPoint:41.5, turns:1}', roll: ROLL },
  { tag: 'same points, NO roll (A/B)', roll: undefined },
];
for (const r of rows) {
  const built = scene(r.roll);
  built.group.updateMatrixWorld(true);
  const f = built.frameAt(0.7094);
  const ctr = WIDE ? new THREE.Vector3(0, 1.8, 0) : f.p.clone();
  const span = WIDE ? 36 : 5.2;
  // camera basis for the roll views: LOOK ALONG the travel axis. In an
  // elevation down the track the twin rails must sweep a full CIRCLE around
  // the centreline — a skewed ellipse there would mean the frame basis is not
  // orthonormal / not right-handed, which is exactly the trap here.
  const fwd = f.fwd.clone();
  const VIEWS = WIDE
    ? [
        { tag: 'TOP (-y)', dir: [0, 1, 0], up: [0, 0, 1] },
        { tag: 'SIDE (+z)', dir: [0, 0, 1], up: [0, 1, 0] },
        { tag: 'END (+x)', dir: [1, 0, 0], up: [0, 1, 0] },
        { tag: '3/4', dir: [0.62, 0.5, 0.62], up: [0, 1, 0], persp: true },
      ]
    : [
        { tag: 'DOWN THE TRACK (-fwd), 1.1u slab', dir: [-fwd.x, -fwd.y, -fwd.z], up: [0, 1, 0], slab: 1.1 },
        { tag: 'SIDE (+z)', dir: [0, 0, 1], up: [0, 1, 0] },
        { tag: 'TOP (-y)', dir: [0, 1, 0], up: [0, 0, 1] },
        { tag: '3/4 at the APEX', dir: [0.5, 0.42, 0.76], up: [0, 1, 0], persp: true },
      ];
  const row = document.createElement('div');
  row.style.cssText = 'display:flex';
  root.appendChild(row);
  for (const v of VIEWS) {
    const cell = document.createElement('div');
    cell.style.cssText = 'position:relative;width:' + CELL + 'px;height:' + CELL + 'px';
    const tag = document.createElement('div');
    tag.textContent = r.tag + '   |   ' + v.tag;
    tag.style.cssText = 'position:absolute;left:6px;top:4px;z-index:2;font:11px monospace;color:#fff;text-shadow:0 1px 2px #000';
    cell.appendChild(tag);
    row.appendChild(cell);

    const sc = new THREE.Scene();
    sc.background = new THREE.Color(0x2f3a2c);
    sc.add(new THREE.HemisphereLight(0xd8e8ff, 0x4a4030, 1.5));
    const key = new THREE.DirectionalLight(0xfff2dc, 1.9);
    key.position.set(4, 7, 5);
    sc.add(key);
    const fill = new THREE.DirectionalLight(0xbcd0ff, 0.7);
    fill.position.set(-5, 3, -4);
    sc.add(fill);
    const obj = built.group.clone(true); // a mesh lives in one scene at a time
    obj.position.sub(ctr);
    sc.add(obj);
    // the y = 0 ground plane, so "upside down" and "floating" are both visible
    const grid = new THREE.GridHelper(span * 2, Math.round(span * 2), 0x8fa07f, 0x64705a);
    grid.position.y = -ctr.y;
    sc.add(grid);
    // a marker at the track CENTRELINE height, so the rails' circle is readable
    const axis = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), new THREE.MeshBasicMaterial({ color: 0xff3b30 }));
    sc.add(axis);

    const r2 = new THREE.WebGLRenderer({ antialias: true });
    r2.setSize(CELL, CELL);
    let cam;
    if (v.persp) {
      cam = new THREE.PerspectiveCamera(34, 1, 0.1, span * 30);
      cam.position.set(v.dir[0] * span * 2.2, v.dir[1] * span * 2.2, v.dir[2] * span * 2.2);
    } else {
      const h = (v.slab ? 2.6 : span) / 2;
      const D = span * 3;
      // A SLAB view clips to +/- v.slab units of depth around the target, so an
      // end-on elevation shows only the roll's own cross-section instead of the
      // whole circuit collapsed into one image (which is what an ortho camera
      // with a wide depth range gives you, and it is unreadable).
      cam = v.slab
        ? new THREE.OrthographicCamera(-h, h, h, -h, D - v.slab, D + v.slab)
        : new THREE.OrthographicCamera(-h, h, h, -h, -span * 8, span * 8);
      cam.position.set(v.dir[0] * D, v.dir[1] * D, v.dir[2] * D);
      cam.up.set(...v.up);
    }
    cam.lookAt(0, 0, 0);
    r2.render(sc, cam);
    const img = new Image();
    img.src = r2.domElement.toDataURL();
    img.style.cssText = 'position:absolute;inset:0;width:100%;height:100%';
    cell.appendChild(img);
    r2.dispose();
  }
}
window.__ready = true;
`;
const entryPath = path.join(HARNESS, 'out', `_roll${wide ? '-wide' : ''}.tsx`);
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

const W = CELL * 4;
const H = CELL * 2;
const htmlPath = path.join(HARNESS, 'out', `roll${wide ? '-wide' : ''}.html`);
fs.writeFileSync(htmlPath, `<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;background:#22262a}#root{width:${W}px}</style></head><body><div id="root"></div><script>${bundle.outputFiles[0].text}</script></body></html>`);

const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--disable-gpu-driver-bug-workarounds'] });
const page = await browser.newPage({ viewport: { width: W, height: H } });
page.on('pageerror', (e) => console.log(`[pageerror] ${e.message}`));
page.on('console', (m) => { if (m.type() === 'error') console.log(`[page:error] ${m.text()}`); });
await page.goto(`file://${htmlPath}`, { waitUntil: 'domcontentloaded', timeout: 180000 });
await page.waitForFunction('window.__ready === true', null, { timeout: 180000 }).catch(() => console.log('[harness] page never signalled ready'));
await page.waitForTimeout(1500);
fs.mkdirSync(path.dirname(outPng), { recursive: true });
await page.screenshot({ path: outPng, fullPage: true });
await browser.close();
console.log(`[harness] wrote ${outPng}`);

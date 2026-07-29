#!/usr/bin/env node
// ---------------------------------------------------------------------------
// shot-loop.mjs — FIXED-ANGLE ortho elevations of a VERTICAL LOOP.
//
// The sibling of `shot-roll.mjs`, for the piece SETUP.md now tells every park to
// include. `<ScenePreview>` auto-rotates so it cannot answer "is this loop the
// right shape", and the compile-only `probe-loop.mjs` answers the physics but
// never the geometry — a loop can rate perfectly and still render wrong.
//
// The decisive view for a loop is the SIDE ELEVATION: a vertical loop must read
// as a closed round-topped teardrop standing in ONE vertical plane. If it leans,
// shears, or opens into a helix, this is where it shows. The second view looks
// DOWN THE TRACK at the apex, where the twin rails must sweep a circle about the
// centreline (a skewed ellipse means a non-orthonormal / left-handed frame — the
// `makeBasis` trap this repo has hit repeatedly).
//
// Row 1 is `loopR`, row 2 the same circuit with the loop swapped for a plain
// straight of the same forward length. Whatever differs between the rows IS the
// loop.
//
//   node shot-loop.mjs [--radius=2.0] [--offset=] [--wide] [--out=path]
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
const RADIUS = Number(opt('radius', '2.0'));
const OFFSET = opt('offset', '');
const CELL = 460;
const outPng = path.resolve(opt('out', path.join(HARNESS, 'out', `loop-r${RADIUS}${OFFSET ? `-o${OFFSET}` : ''}${wide ? '-wide' : ''}.png`)));

const entrySrc = `
import * as THREE from 'three';
import { compileTrackPieces, buildRideSpline } from ${JSON.stringify(path.join(REPO, 'components/SplineRideKit'))};
import { buildSplineCoaster } from ${JSON.stringify(path.join(REPO, 'components/SplineCoaster'))};

const CELL = ${CELL};
const WIDE = ${wide};
const RADIUS = ${RADIUS};
const OFFSET = ${OFFSET === '' ? 'undefined' : Number(OFFSET)};

// cases-loop.mjs's SHIPPED "Loop Royale" circuit, verbatim apart from the radius
// under test — a layout already proven to clear design/valid/closure.
const loopPiece = OFFSET === undefined
  ? { type: 'loopR', radius: RADIUS }
  : { type: 'loopR', radius: RADIUS, offset: OFFSET };
const circuit = (loop) => ['station',
  { type: 'lift', height: 4.6 }, { type: 'turnR', angle: 180, radius: 2.8 }, { type: 'drop', height: 4.6 },
  { type: 'straight', length: 0.72 },
  ...(loop ? [loopPiece] : [{ type: 'straight', length: 1.6 * RADIUS }]),
  { type: 'straight', length: 0.72 },
  { type: 'lift', height: 2.4, length: 3.61 }, { type: 'turnR', angle: 180, radius: 2.2 },
  { type: 'drop', height: 2.4, length: 3.61 }, { type: 'straight', length: 1.66 }];

const root = document.getElementById('root');
const readout = [];

function scene(withLoop) {
  const { points, report } = compileTrackPieces(circuit(withLoop), {
    profile: 'coaster', type: 'steel', start: [0, 0.55, 0], bounds: 128,
  });
  const c = buildSplineCoaster(THREE, points, { bank: 0.7, type: 'steel' });
  return { group: c.group, frameAt: c.frameAt, points, report };
}

// Find the loop by its INVERSION, not by height: the lift crest is the highest
// point on the circuit, so a global-max search frames the lift and never shows
// the loop at all (it did exactly that on the first run). The loop apex is where
// the track frame's up vector points most steeply DOWN.
function apexU(built) {
  let best = 0.5, bestUp = 1e9, invert = 0;
  for (let i = 0; i <= 2000; i += 1) {
    const u = i / 2000;
    const up = built.frameAt(u).up;
    if (up.y < -0.5) invert += 1;
    if (up.y < bestUp) { bestUp = up.y; best = u; }
  }
  return { u: best, up: bestUp, invertedFraction: invert / 2001, y: built.frameAt(best).p.y };
}

const rows = [
  { tag: 'loopR radius ' + RADIUS + (OFFSET === undefined ? ' (default offset)' : ' offset ' + OFFSET), loop: true },
  { tag: 'same circuit, loop -> straight (A/B)', loop: false },
];
for (const r of rows) {
  const built = scene(r.loop);
  built.group.updateMatrixWorld(true);
  const { u, y, up, invertedFraction } = apexU(built);
  const f = built.frameAt(u);
  readout.push(r.tag
    + '  apex y ' + y.toFixed(2) + '  min up.y ' + up.toFixed(3)
    + '  inverted ' + (invertedFraction * 100).toFixed(1) + '% of circuit'
    + '  fatal ' + (built.report.fatal ? 'YES' : 'no')
    + '  synth ' + JSON.stringify(built.report.closure?.synthesized ?? []));

  const ctr = WIDE ? new THREE.Vector3(0, 2.2, 0) : f.p.clone();
  const span = WIDE ? 30 : Math.max(6, RADIUS * 3.6);
  const fwd = f.fwd.clone();
  const VIEWS = WIDE
    ? [
        { tag: 'SIDE (+x)', dir: [1, 0, 0], up: [0, 1, 0] },
        { tag: 'SIDE (+z)', dir: [0, 0, 1], up: [0, 1, 0] },
        { tag: 'TOP (-y)', dir: [0, 1, 0], up: [0, 0, 1] },
        { tag: '3/4', dir: [0.62, 0.5, 0.62], up: [0, 1, 0], persp: true },
      ]
    : [
        // THE decisive one: a vertical loop must be a closed teardrop in ONE plane
        { tag: 'SIDE ELEVATION at the loop', dir: [1, 0, 0], up: [0, 1, 0] },
        { tag: 'DOWN THE TRACK at the apex', dir: [-fwd.x, -fwd.y, -fwd.z], up: [0, 1, 0] },
        { tag: 'TOP (-y) — lateral step shows here', dir: [0, 1, 0], up: [0, 0, 1] },
        { tag: '3/4 at the apex', dir: [0.5, 0.42, 0.76], up: [0, 1, 0], persp: true },
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
    // the y = 0 ground plane, so "floating" and "buried" are both visible
    const grid = new THREE.GridHelper(span * 2, Math.round(span * 2), 0x8fa07f, 0x64705a);
    grid.position.y = -ctr.y;
    sc.add(grid);

    const h = span / 2;
    let cam;
    if (v.persp) {
      cam = new THREE.PerspectiveCamera(34, 1, 0.1, span * 20);
      cam.position.set(v.dir[0] * span * 1.6, v.dir[1] * span * 1.6, v.dir[2] * span * 1.6);
    } else {
      cam = new THREE.OrthographicCamera(-h, h, h, -h, -span * 4, span * 4);
      cam.position.set(v.dir[0] * span * 2, v.dir[1] * span * 2, v.dir[2] * span * 2);
      cam.up.set(...v.up);
    }
    cam.lookAt(0, 0, 0);
    const r2 = new THREE.WebGLRenderer({ antialias: true });
    r2.setSize(CELL, CELL);
    r2.render(sc, cam);
    const img = new Image();
    img.src = r2.domElement.toDataURL();
    img.style.cssText = 'position:absolute;inset:0;width:100%;height:100%';
    cell.appendChild(img);
    r2.dispose();
  }
}
window.__readout = readout;
window.__ready = true;
`;

const entryPath = path.join(HARNESS, 'out', '_shot-loop.tsx');
fs.mkdirSync(path.dirname(entryPath), { recursive: true });
fs.writeFileSync(entryPath, entrySrc);
const res = await build({
  entryPoints: [entryPath], bundle: true, write: false, format: 'iife', jsx: 'automatic',
  loader: { '.tsx': 'tsx', '.ts': 'ts' },
  nodePaths: [path.join(HARNESS, '..', 'park-eval', 'node_modules')],
  target: 'es2020', logLevel: 'silent',
});

const browser = await chromium.launch({
  args: ['--use-angle=metal', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: CELL * 4 + 40, height: CELL * 2 + 40 } });
page.on('console', (m) => { if (m.type() === 'error') console.log('  [page]', m.text().slice(0, 200)); });
await page.setContent('<body style="margin:0;background:#111"><div id="root"></div></body>');
await page.evaluate(res.outputFiles[0].text);
await page.waitForFunction('window.__ready === true', { timeout: 90_000 });
for (const line of await page.evaluate('window.__readout')) console.log('  ' + line);
fs.mkdirSync(path.dirname(outPng), { recursive: true });
await page.locator('#root').screenshot({ path: outPng });
await browser.close();
console.log('wrote', outPng);

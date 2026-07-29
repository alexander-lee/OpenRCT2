#!/usr/bin/env node
// TARGETED PATH-CLIP SHOTS. `eval.mjs`'s 06b eye-level frame looks at the plot
// CENTRE, which is almost never where a path is buried. This one re-runs the
// probe-path-clip sampler in the page, finds the WORST sink (and the worst
// float), then parks the camera a few metres away at kerb height and shoots
// those exact spots from four sides — the picture that decides whether the
// numbers mean anything.
//
//   node probe-path-shot.mjs samples/worlds-ref.tsx [--tag=before]
// -> shots/pathclip-<tag>/<park>-{sink,float}-{a,b}.png
import fs from 'node:fs';
import path from 'node:path';
import { bundleParkPage, openParkPage, sleep } from './evaltags.mjs';
import { HERE } from './paths.mjs';

const argv = process.argv.slice(2);
const tag = (argv.find((a) => a.startsWith('--tag=')) || '--tag=shot').slice(6);
const files = argv.filter((a) => !a.startsWith('--'));
if (!files.length) {
  console.error('usage: node probe-path-shot.mjs <park.tsx> [...] [--tag=before]');
  process.exit(1);
}

const FIND = `(() => {
  const s = window.__evalPark;
  if (!s || !s.ground || !s.paths) return null;
  const g = s.ground.heightAt, P = s.paths, w = P.walkYAt;
  if (!w) return null;
  const nodes = P.net.nodes, edges = P.net.edges, halfW = (P.width ?? 1.1) / 2;
  let sink = { d: Infinity, x: 0, z: 0 }, float = { d: -Infinity, x: 0, z: 0 };
  for (const [a, b] of edges) {
    const A = nodes[a], B = nodes[b];
    if (!A || !B) continue;
    const dx = B[0] - A[0], dz = B[1] - A[1], L = Math.hypot(dx, dz);
    if (!(L > 1e-6)) continue;
    const nx = -dz / L, nz = dx / L, n = Math.max(2, Math.ceil(L / 0.15));
    for (let k = 0; k <= n; k++) {
      const u = k / n, cx = A[0] + dx * u, cz = A[1] + dz * u;
      for (const lat of [-(halfW - 0.02), 0, halfW - 0.02]) {
        const x = cx + nx * lat, z = cz + nz * lat, d = w(x, z) - g(x, z);
        if (d < sink.d) sink = { d, x, z };
        if (d > float.d) float = { d, x, z };
      }
    }
  }
  return { sink, float, ground: (x, z) => 0 } && { sink, float, sinkG: g(sink.x, sink.z), floatG: g(float.x, float.z) };
})()`;

for (const f of files) {
  const nm = path.basename(f).replace(/\.tsx$/, '');
  const outDir = path.join(HERE, 'shots', `pathclip-${tag}`);
  fs.mkdirSync(outDir, { recursive: true });
  const html = await bundleParkPage(f, `pcs-${nm}`);
  const { browser, page } = await openParkPage(html, { waitMs: Number(process.env.PPC_WAIT || 9000) });
  const hit = await page.evaluate(FIND);
  if (!hit) {
    console.log(`${nm}: no paths/ground to shoot`);
    await browser.close();
    continue;
  }
  console.log(`${nm}: worst sink ${hit.sink.d.toFixed(3)} at [${hit.sink.x.toFixed(1)}, ${hit.sink.z.toFixed(1)}]  worst float ${hit.float.d.toFixed(3)} at [${hit.float.x.toFixed(1)}, ${hit.float.z.toFixed(1)}]`);
  const look = async (x, z, gy, az, r, el) => {
    await page.evaluate(
      ({ x, z, gy, az, r, el }) => {
        const api = document.querySelector('canvas')?.__stageApi;
        if (!api || !api.setCameraPose) return;
        const T = [x, gy + 0.35, z];
        api.setCameraPose(
          [T[0] + r * Math.cos(el) * Math.sin(az), T[1] + r * Math.sin(el), T[2] + r * Math.cos(el) * Math.cos(az)],
          T,
        );
      },
      { x, z, gy, az, r, el },
    );
    await sleep(500);
  };
  for (const [kind, p, gy] of [
    ['sink', hit.sink, hit.sinkG],
    ['float', hit.float, hit.floatG],
  ]) {
    // (a) kerb-height oblique, 5 u out; (b) very low grazing shot, 3 u out
    await look(p.x, p.z, gy, Math.PI * 0.25, 5.5, 0.22);
    await page.screenshot({ path: path.join(outDir, `${nm}-${kind}-a.png`) });
    await look(p.x, p.z, gy, Math.PI * 1.15, 3.2, 0.07);
    await page.screenshot({ path: path.join(outDir, `${nm}-${kind}-b.png`) });
  }
  await browser.close();
  console.log(`  -> ${outDir}/${nm}-*.png`);
}

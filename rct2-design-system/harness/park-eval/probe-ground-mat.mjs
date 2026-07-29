#!/usr/bin/env node
// probe-ground-mat.mjs — read the TERRAIN GROUND MESH's material back out of a
// live park page: does it actually have the turf map bound, at what repeat, with
// what colour multiplier, and what does the texture's own canvas look like?
//
// Written 2026-07 while reworking the grass, because "the render still looks
// like a flat fill" has two completely different causes — the map is not
// applied, or the map is applied and too weak — and guessing between them from
// a screenshot wasted a render cycle. Reports both, plus a sampled histogram of
// the generated turf canvas so the texture itself can be judged numerically.
//
//   node probe-ground-mat.mjs <parkFile.tsx>
import { bundleParkPage, openParkPage, parseArgs, defaultName } from './evaltags.mjs';

const { file } = parseArgs(process.argv);
if (!file) {
  console.error('usage: node probe-ground-mat.mjs <parkFile.tsx>');
  process.exit(1);
}
const name = defaultName(file);
const htmlPath = await bundleParkPage(file, `matprobe-${name}`);
const { browser, page } = await openParkPage(htmlPath, { waitMs: 6000, echo: false });

const out = await page.evaluate(() => {
  const canvas = document.querySelector('canvas');
  const api = canvas && canvas.__stageApi;
  if (!api) return { error: 'no __stageApi' };
  const found = [];
  api.scene.traverse((o) => {
    if (!o.isMesh || !o.geometry) return;
    const g = o.geometry;
    const n = g.attributes.position ? g.attributes.position.count : 0;
    // the terrain heightfield is the big plane: many verts, has a color attr
    if (n < 20000 || !g.attributes.color) return;
    const m = Array.isArray(o.material) ? o.material[0] : o.material;
    const t = m.map;
    let hist = null;
    if (t && t.image && t.image.width) {
      // sample the texture canvas back: 64x64 stride
      const c2 = document.createElement('canvas');
      c2.width = t.image.width;
      c2.height = t.image.height;
      const x2 = c2.getContext('2d');
      x2.drawImage(t.image, 0, 0);
      const d = x2.getImageData(0, 0, c2.width, c2.height).data;
      let lo = 255;
      let hi = 0;
      let sum = 0;
      let cnt = 0;
      for (let i = 0; i < d.length; i += 4 * 7) {
        const v = d[i];
        if (v < lo) lo = v;
        if (v > hi) hi = v;
        sum += v;
        cnt += 1;
      }
      hist = { lo, hi, mean: +(sum / cnt).toFixed(1), w: c2.width, h: c2.height };
    }
    found.push({
      name: o.name || '(unnamed)',
      verts: n,
      type: m.type,
      vertexColors: !!m.vertexColors,
      color: [+m.color.r.toFixed(3), +m.color.g.toFixed(3), +m.color.b.toFixed(3)],
      hasMap: !!m.map,
      mapRepeat: m.map ? [m.map.repeat.x, m.map.repeat.y] : null,
      mapColorSpace: m.map ? m.map.colorSpace : null,
      hasBumpMap: !!m.bumpMap,
      bumpScale: m.bumpScale,
      roughness: m.roughness,
      hist,
      // a few sampled vertex colours so the TONE can be judged numerically too
      sampleVertexColors: [0, 1, 2, 3, 4].map((k) => {
        const i = Math.floor((n / 6) * (k + 1));
        const c = g.attributes.color;
        return [+c.getX(i).toFixed(3), +c.getY(i).toFixed(3), +c.getZ(i).toFixed(3)];
      }),
    });
  });
  return { meshes: found, outputColorSpace: api.renderer ? api.renderer.outputColorSpace : null };
});
console.log(JSON.stringify(out, null, 1));

// ---------------------------------------------------------------------------
// SEAM CHECK — mean RENDERED colour of the plot vs the surround skirt, in the
// same frame. "Is the plot edge visible as a line?" is a question about two
// mean pixel colours, and eyeballing a PNG cannot separate "the surround is
// darker" from "the surround is hazier". Poses an overview, then samples two
// horizontal bands: one inside the plot, one above the plot's far edge.
// ---------------------------------------------------------------------------
const seam = await page.evaluate(async () => {
  const canvas = document.querySelector('canvas');
  const api = canvas && canvas.__stageApi;
  if (!api || !api.setCameraPose) return { error: 'no setCameraPose' };
  const store = window.__evalPark;
  const S = store ? store.size : 128;
  const r = 48 * 1.19 + Math.max(0, S - 48) * 0.18;
  const tgt = [0, 0.4, S / 2 - S * 0.117];
  const az = Math.PI / 4;
  const el = (34 * Math.PI) / 180;
  api.setCameraPose(
    [tgt[0] + r * Math.cos(el) * Math.sin(az), tgt[1] + r * Math.sin(el), tgt[2] + r * Math.cos(el) * Math.cos(az)],
    tgt,
  );
  await new Promise((res) => setTimeout(res, 600));
  const c2 = document.createElement('canvas');
  c2.width = canvas.width;
  c2.height = canvas.height;
  const x2 = c2.getContext('2d');
  x2.drawImage(canvas, 0, 0);
  const band = (y0, y1, x0, x1) => {
    const d = x2.getImageData(x0, y0, x1 - x0, y1 - y0).data;
    let r2 = 0;
    let g2 = 0;
    let b2 = 0;
    for (let i = 0; i < d.length; i += 4) {
      r2 += d[i];
      g2 += d[i + 1];
      b2 += d[i + 2];
    }
    const n = d.length / 4;
    return [Math.round(r2 / n), Math.round(g2 / n), Math.round(b2 / n)];
  };
  const W = c2.width;
  const H = c2.height;
  return {
    canvas: [W, H],
    surroundBand: band(Math.round(H * 0.06), Math.round(H * 0.11), Math.round(W * 0.1), Math.round(W * 0.4)),
    plotNearEdge: band(Math.round(H * 0.2), Math.round(H * 0.25), Math.round(W * 0.1), Math.round(W * 0.4)),
    plotMid: band(Math.round(H * 0.5), Math.round(H * 0.55), Math.round(W * 0.1), Math.round(W * 0.4)),
  };
});
console.log('SEAM ' + JSON.stringify(seam));
await browser.close();

#!/usr/bin/env node
// probe-grass-shot.mjs — THE GRASS LOOK PROBE. Four fixed camera distances over
// the same park (eye level, close, mid, orbit overview, nadir), each written as
// a full frame AND as a 1:1 centre crop (no downsample — pixel-level detail is
// exactly what "pixelated / noisy" is about and a scaled-down PNG hides it),
// plus a numeric HIGH-FREQUENCY ENERGY reading per frame so "less noisy" is a
// measurement and not a vibe.
//
//   node probe-grass-shot.mjs samples/grass-check.tsx --tag=before
// -> shots/grass-<tag>/<park>-<pose>.png and -<pose>-crop.png
import fs from 'node:fs';
import path from 'node:path';
import { bundleParkPage, openParkPage, sleep } from './evaltags.mjs';
import { HERE } from './paths.mjs';

const argv = process.argv.slice(2);
const tag = (argv.find((a) => a.startsWith('--tag=')) || '--tag=shot').slice(6);
const files = argv.filter((a) => !a.startsWith('--'));
if (!files.length) {
  console.error('usage: node probe-grass-shot.mjs <park.tsx> [...] [--tag=before]');
  process.exit(1);
}

for (const f of files) {
  const nm = path.basename(f).replace(/\.tsx$/, '');
  const outDir = path.join(HERE, 'shots', `grass-${tag}`);
  fs.mkdirSync(outDir, { recursive: true });
  const html = await bundleParkPage(f, `grass-${nm}`);
  const { browser, page } = await openParkPage(html, { waitMs: Number(process.env.PPC_WAIT || 9000) });

  const poses = await page.evaluate(() => {
    const s = window.__evalPark;
    const S = s ? s.size : 128;
    const g = s && s.ground ? s.ground.heightAt : () => 0;
    // pick a patch of open lawn near the centre-ish that is above any water
    let best = null;
    for (let x = -S * 0.3; x <= S * 0.3; x += 4) {
      for (let z = -S * 0.3; z <= S * 0.3; z += 4) {
        const h = g(x, z);
        const flat = Math.abs(g(x + 1, z) - h) + Math.abs(g(x, z + 1) - h);
        if (h > 0.3 && (!best || flat < best.flat)) best = { x, z, h, flat };
      }
    }
    if (!best) best = { x: 0, z: 0, h: g(0, 0), flat: 0 };
    return { S, spot: best };
  });
  console.log(`${nm}: size ${poses.S}, lawn spot [${poses.spot.x}, ${poses.spot.z}] y=${poses.spot.h.toFixed(2)}`);

  const shots = [
    // name,        radius,               elevation(rad), look-at height above ground
    ['closeup', 1.5, 0.62, 0.2],
    ['eye', 2.6, 0.09, 1.6],
    ['near', 7, 0.16, 0.9],
    ['mid', 22, 0.3, 0.5],
    ['overview', poses.S * 0.78, 0.62, 0.4],
    ['nadir', poses.S * 0.62, 1.52, 0.0],
  ];

  const stats = {};
  for (const [pose, r, el, up] of shots) {
    const res = await page.evaluate(
      async ({ x, z, h, r, el, up, pose }) => {
        const canvas = document.querySelector('canvas');
        const api = canvas && canvas.__stageApi;
        if (!api || !api.setCameraPose) return { error: 'no setCameraPose' };
        const az = Math.PI * 0.29;
        const T = pose === 'nadir' ? [0, 0, 0] : [x, h + up, z];
        api.setCameraPose(
          [T[0] + r * Math.cos(el) * Math.sin(az), T[1] + r * Math.sin(el), T[2] + r * Math.cos(el) * Math.cos(az)],
          T,
        );
        await new Promise((res2) => setTimeout(res2, 700));
        // ---- 1:1 centre crop + high-frequency energy on the SAME pixels ------
        // `drawImage(webglCanvas)` returns BLACK here: the Stage's renderer is
        // built without `preserveDrawingBuffer`, so the back buffer is gone by
        // the time a later task reads it. Render once more and `readPixels`
        // straight out of the GL context in the same task instead.
        const CW = 520;
        const CH = 400;
        const gl = api.renderer.getContext();
        api.renderer.render(api.scene, api.camera);
        const dw = canvas.width;
        const dh = canvas.height;
        const sx = Math.round(dw / 2 - CW / 2);
        // bias the crop DOWN for the oblique poses: the middle of an eye-level
        // frame is sky/horizon, the ground is in the lower half
        const sy = Math.round(dh * (pose === 'nadir' ? 0.5 : 0.62) - CH / 2);
        const raw = new Uint8Array(CW * CH * 4);
        // GL origin is BOTTOM-left
        gl.readPixels(sx, dh - sy - CH, CW, CH, gl.RGBA, gl.UNSIGNED_BYTE, raw);
        const c2 = document.createElement('canvas');
        c2.width = CW;
        c2.height = CH;
        const x2 = c2.getContext('2d');
        const im = x2.createImageData(CW, CH);
        for (let y = 0; y < CH; y++) {
          const src = (CH - 1 - y) * CW * 4;
          im.data.set(raw.subarray(src, src + CW * 4), y * CW * 4);
        }
        x2.putImageData(im, 0, 0);
        const d = im.data;
        const lum = new Float64Array(CW * CH);
        let mean = 0;
        for (let i = 0; i < CW * CH; i++) {
          const L = 0.2126 * d[i * 4] + 0.7152 * d[i * 4 + 1] + 0.0722 * d[i * 4 + 2];
          lum[i] = L;
          mean += L;
        }
        mean /= CW * CH;
        // 1-px Laplacian = per-pixel (Nyquist) energy — the "salt and pepper"
        // term. 3-px Laplacian = coherent detail at a few pixels. A good turf
        // has the SECOND without much of the first.
        const lap = (k) => {
          let s = 0;
          let n = 0;
          for (let y = k; y < CH - k; y++) {
            for (let xp = k; xp < CW - k; xp++) {
              const i = y * CW + xp;
              const v = 4 * lum[i] - lum[i - k] - lum[i + k] - lum[i - k * CW] - lum[i + k * CW];
              s += Math.abs(v);
              n++;
            }
          }
          return s / n;
        };
        let sd = 0;
        for (let i = 0; i < CW * CH; i++) sd += (lum[i] - mean) ** 2;
        sd = Math.sqrt(sd / (CW * CH));
        return {
          crop: c2.toDataURL('image/png'),
          mean: +mean.toFixed(1),
          sd: +sd.toFixed(2),
          hf1: +lap(1).toFixed(2),
          hf3: +lap(3).toFixed(2),
        };
      },
      { x: poses.spot.x, z: poses.spot.z, h: poses.spot.h, r, el, up, pose },
    );
    await sleep(150);
    await page.screenshot({ path: path.join(outDir, `${nm}-${pose}.png`) });
    if (res.crop) {
      fs.writeFileSync(path.join(outDir, `${nm}-${pose}-crop.png`), Buffer.from(res.crop.split(',')[1], 'base64'));
      delete res.crop;
    }
    stats[pose] = res;
    console.log(`  ${pose.padEnd(9)} mean ${String(res.mean).padStart(6)}  sd ${String(res.sd).padStart(6)}  hf1(px) ${String(res.hf1).padStart(6)}  hf3 ${String(res.hf3).padStart(6)}`);
  }
  fs.writeFileSync(path.join(outDir, `${nm}-stats.json`), JSON.stringify(stats, null, 1));
  await browser.close();
  console.log(`  -> ${outDir}/${nm}-*.png`);
}

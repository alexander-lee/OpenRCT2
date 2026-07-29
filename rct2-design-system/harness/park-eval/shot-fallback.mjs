#!/usr/bin/env node
// FALLBACK SHOOTER — same 8 poses as eval.mjs, but with puppeteer's
// `protocolTimeout` raised. eval.mjs launches with the library default, and on
// this machine a settled 128 park with ~130 active lights under SwiftShader can
// exceed it on `Page.captureScreenshot`, producing ZERO PNGs and a
// ProtocolError that looks exactly like a broken park. Nothing about the park
// is changed; this only gives the same capture more wall clock.
//
//   node shot-fallback.mjs <parkFile.tsx> --name=X [--wait=ms] [--scale=0.5]
import fs from 'node:fs';
import path from 'node:path';
import { HERE, bundleParkPage, installFrameShim } from './lib.mjs';
import { preflightCheck, reportPreflight } from './preflight.mjs';

const argv = process.argv.slice(2);
const file = argv.find((a) => !a.startsWith('--'));
const opt = (k) => {
  const hit = argv.find((a) => a.startsWith(`--${k}=`));
  return hit ? hit.slice(k.length + 3) : null;
};
if (!file) {
  console.error('usage: node shot-fallback.mjs <parkFile.tsx> --name=X [--wait=ms] [--scale=f]');
  process.exit(1);
}
if (!reportPreflight(file, preflightCheck(file))) process.exit(1);

const name = opt('name') || path.basename(file).replace(/\.tsx?$/, '');
const waitMs = Number(opt('wait') || 300000);
const SCALE = Number(opt('scale') || 1);
const outDir = path.join(HERE, 'shots', name);
fs.mkdirSync(outDir, { recursive: true });

const htmlPath = await bundleParkPage(file, name);

// chromePath() is not exported by lib.mjs — same resolution, inlined.
const CHROME_DIR = path.join(process.env.HOME ?? '', '.cache/puppeteer/chrome');
const chromePath = () => {
  const builds = fs.existsSync(CHROME_DIR) ? fs.readdirSync(CHROME_DIR).sort().reverse() : [];
  for (const b of builds) {
    const p = path.join(CHROME_DIR, b, 'chrome-mac-arm64', 'Google Chrome for Testing.app', 'Contents', 'MacOS', 'Google Chrome for Testing');
    if (fs.existsSync(p)) return p;
  }
  return null;
};

const puppeteer = (await import('puppeteer-core')).default;
const browser = await puppeteer.launch({
  executablePath: chromePath(),
  headless: true,
  protocolTimeout: 1800000, // 30 min — the whole point of this file
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader', '--window-size=1280,800'],
  defaultViewport: { width: Math.round(1280 * SCALE), height: Math.round(800 * SCALE) },
});
const page = await browser.newPage();
const lines = [];
page.on('console', (m) => lines.push(`[${m.type()}] ${m.text()}`));
page.on('pageerror', (e) => lines.push(`[pageerror] ${e.message}`));
await installFrameShim(page);
page.setDefaultNavigationTimeout(600000);
await page.goto(`file://${htmlPath}`, { waitUntil: 'load', timeout: 600000 });

const deadline = Date.now() + waitMs;
while (Date.now() < deadline) {
  if (lines.some((l) => /validatePark →|validatePark skipped|no component export/.test(l))) break;
  await new Promise((r) => setTimeout(r, 500));
}
await new Promise((r) => setTimeout(r, 2000));
console.log(`[shot-fallback] settled after ${Math.round((Date.now() - (deadline - waitMs)) / 1000)}s, ${lines.length} console lines`);

const parkSize = 128;
const TARGET = [0, 0, 0];
async function setPose(azDeg, elevDeg, radius) {
  const az = (azDeg * Math.PI) / 180;
  const el = (elevDeg * Math.PI) / 180;
  await page.evaluate(({ az, el, r, TARGET }) => {
    const canvas = document.querySelector('canvas');
    const api = canvas && canvas.__stageApi;
    if (!api || !api.setCameraPose) return;
    const x = TARGET[0] + r * Math.cos(el) * Math.sin(az);
    const y = TARGET[1] + r * Math.sin(el);
    const z = TARGET[2] + r * Math.cos(el) * Math.cos(az);
    api.setCameraPose([x, y, z], TARGET);
  }, { az, el, r: radius, TARGET });
  await new Promise((r) => setTimeout(r, 900));
}
const ORBIT = 48 + (parkSize - 48) * 0.18 + 40;
const FULL = 1.64 * parkSize;
const ALL_SHOTS = [
  ['01-overview-az045.png', 45, 34, ORBIT],
  ['02-overview-az135.png', 135, 34, ORBIT],
  ['03-overview-az225.png', 225, 34, ORBIT],
  ['04-overview-az315.png', 315, 34, ORBIT],
  ['05-topdown.png', 45, 81, FULL],
  ['05b-nadir.png', 0, 89, FULL],
  ['06-ground.png', 45, 8, ORBIT],
  ['06b-ground-close.png', 45, 4, 22],
];
// --only=05,05b,01 — capture a subset when the machine is contended.
const only = opt('only');
const SHOTS = only
  ? only.split(',').map((k) => ALL_SHOTS.find((s) => s[0].startsWith(k))).filter(Boolean)
  : ALL_SHOTS;
for (const [f, az, el, r] of SHOTS) {
  await setPose(az, el, r);
  const t = Date.now();
  await page.screenshot({ path: path.join(outDir, f) });
  console.log(`  ${f}  ${Math.round((Date.now() - t) / 1000)}s`);
}
// NIGHT: drive the day/night clock to midnight, then re-shoot the main angle.
await page.evaluate(() => {
  const canvas = document.querySelector('canvas');
  const api = canvas && canvas.__stageApi;
  if (api && api.setTimeOfDay) api.setTimeOfDay(0);
  else if (window.__setTimeOfDay) window.__setTimeOfDay(0);
});
await new Promise((r) => setTimeout(r, 2500));
await setPose(45, 34, ORBIT);
await page.screenshot({ path: path.join(outDir, '07-night-az045.png') });
console.log('  07-night-az045.png');

fs.writeFileSync(path.join(outDir, 'console.log'), lines.join('\n'));
console.log(`[shot-fallback] wrote ${outDir}`);
await browser.close();

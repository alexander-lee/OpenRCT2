#!/usr/bin/env node
// park-eval eval.mjs — REBUILT 2026-07-24 (disaster recovery: the original
// eval.mjs lived only in /tmp and was wiped by a reboot before this wave's
// agent got to it; RUBRIC.md's pipeline section documents its contract).
//
//   node eval.mjs <parkFile.tsx> [--name=X] [--wait=ms]
//
// Bundles the park TSX WITH the eval tags (evaltags.mjs — same instrumented
// bundle probe.mjs uses, so a probe run right after an eval run sees the
// identical scene), mounts it fullscreen at 1280x800 in SwiftShader chromium,
// captures EVERY console line + page error, and shoots 7 angles into
// shots/<name>/ alongside console.log:
//
//   01-04  overview azimuth 45/135/225/315, elevation 34deg
//   05     topdown, elevation 81deg (azimuth 45)
//   06     ground level, elevation 8deg (azimuth 45)
//   07     night, azimuth 45 / elevation 34deg, day/night switcher flipped
//
// Camera framing is ANALYTIC, not a fixed default: it reads the live scene
// bounding box (+ the ParkStore's `size` when the park is composed via
// <Park>) and picks a distance that covers the whole footprint, so a size-48
// park is not cropped to a size-16 default (the wave-7 "size-16 fallback
// crop" bug this rebuild is careful to avoid). Poses are set directly via
// the Stage's `setCameraPose(pos, target)` API (exposed on
// `canvas.__stageApi`) rather than simulated mouse drags, which is both more
// precise and immune to the actionability-timeout issues heavy park scenes
// can cause for drag-based orbiting (see render.mjs's night-click fallback).
import fs from 'node:fs';
import path from 'node:path';
import { HERE } from './paths.mjs';
import { bundleParkPage, openParkPage, parseArgs, defaultName, sleep } from './evaltags.mjs';

const { file, opt } = parseArgs(process.argv);
if (!file) {
  console.error('usage: node eval.mjs <parkFile.tsx> [--name=X] [--wait=ms]');
  process.exit(1);
}
const name = opt('name') || defaultName(file);
const waitMs = Number(opt('wait') || 6000);
const outDir = path.join(HERE, 'shots', name);
fs.mkdirSync(outDir, { recursive: true });

console.error(`[eval] bundling ${file} as "${name}"`);
const htmlPath = await bundleParkPage(file, name);
const { browser, page, lines } = await openParkPage(htmlPath, { waitMs, echo: false });
await sleep(1000); // let the first frame + any async scenery settle

// ---------------------------------------------------------------------------
// analytic camera framing
// ---------------------------------------------------------------------------
const frame = await page.evaluate(() => {
  const T = window.__THREE;
  const canvas = document.querySelector('canvas');
  const api = canvas && canvas.__stageApi;
  const store = window.__evalPark || null;
  if (!api || !T) return null;
  const box = new T.Box3().setFromObject(api.scene);
  const center = box.getCenter(new T.Vector3());
  const size3 = box.getSize(new T.Vector3());
  return {
    center: [center.x, center.y, center.z],
    footprintRadius: Math.max(size3.x, size3.z) / 2,
    parkSize: store ? store.size : null,
    hasSetCameraPose: !!api.setCameraPose,
  };
});
if (!frame) lines.push('[eval] WARNING: no __stageApi/__THREE on the page — cannot pose the camera, shots use the default view only');
else if (!frame.hasSetCameraPose) lines.push('[eval] WARNING: __stageApi has no setCameraPose — shots use the default view only');

// distance: `scene`/`store.root` bbox is NOT usable for this — TerrainKit
// parents a deliberately huge, fog-coloured "backdrop" skirt onto the SAME
// root to hide the edge of the finite terrain plane at the horizon (see
// TerrainKit/index.tsx), so a size-16 park's own root bbox measures ~170
// units wide, not ~16. Framing off that radius is what produces a
// zoomed-out, content-less shot (exactly the "size-16 fallback crop" failure
// mode in reverse — here it would crop EVERY park to a speck regardless of
// size). Use the ParkStore's own `size` through parkRoot.tsx's documented
// `orbitRadiusFor(size)` formula instead — the same distance <Park> itself
// hands its Stage by default — and only fall back to the (backdrop-free)
// scene footprint for non-<Park> components, where no store.size exists.
const orbitRadiusFor = (size) => (size <= 48 ? size * 1.19 : 48 * 1.19 + (size - 48) * 0.18);
const R = frame && frame.parkSize ? orbitRadiusFor(frame.parkSize) : frame ? Math.max(frame.footprintRadius * 1.35, 10) : 14;
const TARGET = frame ? [frame.center[0], Math.max(frame.center[1], 0.4), frame.center[2]] : [0, 0.6, 0];
const canPose = !!(frame && frame.hasSetCameraPose);

async function setPose(azDeg, elevDeg, r = R) {
  if (!canPose) return;
  const az = (azDeg * Math.PI) / 180;
  const el = (elevDeg * Math.PI) / 180;
  await page.evaluate(
    ({ az, el, r, TARGET }) => {
      const canvas = document.querySelector('canvas');
      const api = canvas && canvas.__stageApi;
      if (!api || !api.setCameraPose) return;
      const x = TARGET[0] + r * Math.cos(el) * Math.sin(az);
      const y = TARGET[1] + r * Math.sin(el);
      const z = TARGET[2] + r * Math.cos(el) * Math.cos(az);
      api.setCameraPose([x, y, z], TARGET);
    },
    { az, el, r, TARGET },
  );
  await sleep(450); // let the frame render at the new pose
}

async function shoot(fileName) {
  await page.screenshot({ path: path.join(outDir, fileName) });
}

const OVERVIEWS = [
  { file: '01-overview-az045.png', az: 45 },
  { file: '02-overview-az135.png', az: 135 },
  { file: '03-overview-az225.png', az: 225 },
  { file: '04-overview-az315.png', az: 315 },
];
for (const s of OVERVIEWS) {
  await setPose(s.az, 34);
  await shoot(s.file);
}
await setPose(45, 81);
await shoot('05-topdown.png');
await setPose(45, 8);
await shoot('06-ground.png');

// ---------------------------------------------------------------------------
// night shot — az045 / elev34, day/night switcher flipped, nightK polled
// ---------------------------------------------------------------------------
await setPose(45, 34);
let switchers = 0;
try {
  const handles = await page.$$('button[aria-label="Switch to night"]');
  switchers = handles.length;
  for (const h of handles) {
    try {
      await h.click({ timeout: 3000 });
    } catch {
      try {
        await h.evaluate((el) => el.click());
      } catch {
        /* ignore */
      }
    }
  }
} catch (e) {
  lines.push(`[eval] day/night switcher click failed: ${e.message}`);
}
if (switchers === 0) lines.push('[eval] no day/night switcher found');

// nightK lerps in at ~0.06 PER RENDERED FRAME (not per wall-clock second) —
// on heavy park scenes SwiftShader can render well under 60fps, so a fixed
// sleep is unreliable. Poll instead of guessing a wait: read nightK every
// 300ms up to an 18s ceiling and stop once it clears 0.95.
const readNightK = () =>
  page.evaluate(() => {
    const store = window.__evalPark;
    if (store && store.root && typeof store.root.userData.nightK === 'number') return store.root.userData.nightK;
    const canvas = document.querySelector('canvas');
    const api = canvas && canvas.__stageApi;
    let found = null;
    if (api && api.scene) {
      api.scene.traverse((o) => {
        if (found === null && o.userData && typeof o.userData.nightK === 'number') found = o.userData.nightK;
      });
    }
    return found;
  });
let nightK = await readNightK();
const nightDeadline = Date.now() + 18000;
while ((nightK === null || nightK < 0.95) && Date.now() < nightDeadline) {
  await sleep(300);
  nightK = await readNightK();
}
lines.push(`[eval] nightK=${nightK === null ? 'null (not found)' : nightK}`);
await shoot('07-night-az045.png');

fs.writeFileSync(path.join(outDir, 'console.log'), lines.join('\n') + '\n');
await browser.close();
console.log(`[eval] wrote 7 shots + console.log to ${outDir} (nightK=${nightK})`);

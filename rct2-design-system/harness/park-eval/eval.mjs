#!/usr/bin/env node
// park-eval eval.mjs — REBUILT 2026-07-24 (disaster recovery: the original
// eval.mjs lived only in /tmp and was wiped by a reboot before this wave's
// agent got to it; RUBRIC.md's pipeline section documents its contract).
//
//   node eval.mjs <parkFile.tsx> [--name=X] [--wait=ms] [--nightK=0..1|off]
//
// Bundles the park TSX WITH the eval tags (evaltags.mjs — same instrumented
// bundle probe.mjs uses, so a probe run right after an eval run sees the
// identical scene), mounts it fullscreen at 1280x800 in SwiftShader chromium,
// captures EVERY console line + page error, and shoots 8 angles into
// shots/<name>/ alongside console.log:
//
//   01-04  overview azimuth 45/135/225/315, elevation 34deg
//   05     topdown, elevation 81deg (azimuth 45), WHOLE plot, fog lifted
//   05b    nadir, elevation 89deg / azimuth 0 — +x screen right, +z screen DOWN
//          (the shot to check composed §1 coordinates against)
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
import { execFileSync } from 'node:child_process';
import { HERE } from './paths.mjs';
import { bundleParkPage, openParkPage, parseArgs, defaultName, sleep, auditAnchors } from './evaltags.mjs';
import { preflightCheck, reportPreflight } from './preflight.mjs';
import { shotsConflict, shotsConflictMessage } from './corpus.mjs';

const { file, opt } = parseArgs(process.argv);
if (!file) {
  console.error('usage: node eval.mjs <parkFile.tsx> [--name=X] [--wait=ms] [--nightK=0..1|off] [--reassign-shots]');
  process.exit(1);
}

// PRE-FLIGHT LINT (wave-10): a park importing a deleted/misspelled component
// used to reach esbuild, die there with a raw "could not resolve" dump, and
// leave 0 screenshots / no probe.json / no validatePark line — the round
// scored 0/100 by absence of evidence with no clue why. Catch it here, in
// milliseconds, before esbuild or a browser is ever started.
const preflightProblems = preflightCheck(file);
if (!reportPreflight(file, preflightProblems)) process.exit(1);

// EVAL-TAG ANCHOR GATE — see the long note in probe.mjs. eval.mjs bundles with
// the same injections, and a missing anchor degrades the scene it shoots.
{
  const broken = auditAnchors().filter((r) => !r.ok);
  if (broken.length && !process.argv.includes('--allow-anchor-drift')) {
    console.error(`[eval] ANCHOR DRIFT — ${broken.length} eval-tag anchor(s) no longer match the design system:`);
    for (const b of broken) console.error(`  ✗ ${b.file}  ${b.anchor}`);
    console.error('  Fix INJECTIONS in evaltags.mjs (`node evaltags.mjs --audit-anchors`), or pass --allow-anchor-drift.');
    process.exit(1);
  }
}

const name = opt('name') || defaultName(file);
const waitMs = Number(opt('wait') || (process.argv.includes('--fast') ? 2500 : 6000));

// ---------------------------------------------------------------------------
// NAME OWNERSHIP GATE (2026-07-27) — the same guard probe.mjs runs
// ---------------------------------------------------------------------------
// `--name` maps to `shots/<name>/`, which this file fills with PNGs and a
// `console.log` and then SCORES the `probe.json` sitting in. A `--name` pointing
// at another park's directory therefore overwrites that park's evidence AND
// prints a score computed from a foreign `probe.json` under this park's name.
// Same mechanism as the 2026-07-26 `--name=skeleton-a` scratch run that destroyed
// skeleton-a's measurement; see corpus.mjs. Refuse before bundling.
{
  const clash = shotsConflict({ name, park: path.resolve(file) });
  if (clash) {
    if (!(process.argv.includes('--reassign') || process.argv.includes('--reassign-shots'))) {
      console.error(shotsConflictMessage(clash).replace(/^\[probe\]/, '[eval]'));
      process.exit(1);
    }
    console.error(`[eval] --reassign-shots: shots/${name}/ REASSIGNED from ${clash.storedPark} to ${path.resolve(file)}`);
  }
}

// ---------------------------------------------------------------------------
// --fast — the ITERATION mode. MEASURED: a full pass is ~4 MINUTES per park
// (496 s user at 231% CPU), so a two-park scoring loop pays ~8 minutes of wall
// clock per round BEFORE the model does anything, and it cannot stop until both
// parks reach 100/100. Nearly all of that is SwiftShader fill: 8 screenshots at
// 1280x800 with a software rasteriser.
//
// A scoring round does not need eight full-resolution angles to decide whether
// it is done — it needs the console lines, the validatePark verdict and enough
// pixels to spot a gross defect. `--fast` keeps every measurement and every
// console line intact and cuts only the PIXELS: half-linear resolution (a
// quarter of the fragments) and the 2 diagonal overviews instead of 4 plus the
// detail set. Run the FULL pass for the final scoring shot.
//
//   node eval.mjs samples/coolpark-a.tsx --fast     # iterate
//   node eval.mjs samples/coolpark-a.tsx            # score
const FAST = process.argv.includes('--fast');
// What an ITERATION pass still shoots: one diagonal overview (gross layout) and
// the topdown (the plan view the layout axes score from). The second pair of
// diagonals, the nadir, both ground views and the night shot are for the FINAL
// scoring pass — they do not change the decision "iterate again or not".
const FAST_KEEP = new Set(['01-overview-az045.png', '05-topdown.png']);
const _t0 = Date.now();
const _phase = [];
const _mark = (label) => { _phase.push([label, Date.now() - _t0]); };
const SHOT_SCALE = FAST ? 0.5 : 1;
const outDir = path.join(HERE, 'shots', name);
fs.mkdirSync(outDir, { recursive: true });

console.error(`[eval] bundling ${file} as "${name}"`);
const htmlPath = await bundleParkPage(file, name);
_mark('bundle');
const { browser, page, lines, settle } = await openParkPage(htmlPath, { waitMs, echo: false });
_mark('openPage+waitMs');

// ---------------------------------------------------------------------------
// UNMEASURED-IS-FATAL (2026-07-26) — same policy as probe.mjs
// ---------------------------------------------------------------------------
// eval.mjs's DELIVERABLE is `shots/<name>/console.log` plus 8 PNGs, and the
// scoring pass reads the validatePark verdict off that console.log. Until today
// every one of the conditions below pushed a `[eval] WARNING: …` line into that
// file and exited 0 — a console.log with no verdict, or 8 shots taken from the
// wrong camera, or a "night" shot taken in daylight, all shipped as a clean run.
// The shots are still written (they cost minutes and are worth keeping for
// diagnosis) but the process exits NON-ZERO and says why, so no pipeline treats
// the run as scoreable.
const unmeasured = [];
const fatal = (what, detail) => {
  unmeasured.push({ what, detail });
  lines.push(`[eval] UNMEASURED: ${what} — ${detail}`);
};
if (!settle.validated)
  fatal(
    'the validatePark verdict',
    `${settle.reason} [SETTLE TIMEOUT PARK_SETTLE_MS=${settle.settleMs} ms, elapsed ${settle.ms} ms, flushBuilds ${settle.flushed ? 'ran' : 'did NOT run'}, ${settle.buildsLeft} build(s) still queued]`,
  );
if (FAST) {
  // a quarter of the fragments. SwiftShader is fill-bound, so this is where
  // the 4-minute pass actually goes — not in the sim, not in the bundling.
  // this harness is PUPPETEER (lib.mjs uses defaultViewport/--window-size), so
  // it is setViewport, not Playwright's setViewportSize
  const fw = Math.round(1280 * SHOT_SCALE);
  const fh = Math.round(800 * SHOT_SCALE);
  if (typeof page.setViewport === 'function') await page.setViewport({ width: fw, height: fh });
  else if (typeof page.setViewportSize === 'function') await page.setViewportSize({ width: fw, height: fh });
  lines.push(`[eval] FAST mode: ${Math.round(1280 * SHOT_SCALE)}x${Math.round(800 * SHOT_SCALE)}, reduced angle set — iterate with this, SCORE with a full pass`);
}
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
// A run that cannot pose the camera produces 8 IDENTICAL default-view PNGs. Every
// layout/terrain/material axis is read off specific poses (topdown, nadir,
// eye-level), so those axes are UNMEASURED — not "the park looks like this".
if (!frame)
  fatal('all 8 camera poses', 'no __stageApi/__THREE on the page — every shot is the default view, so the layout, terrain and ground-material axes were never actually looked at');
else if (!frame.hasSetCameraPose)
  fatal('all 8 camera poses', '__stageApi has no setCameraPose — every shot is the default view, so the layout, terrain and ground-material axes were never actually looked at');

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

// ---------------------------------------------------------------------------
// CAPTURE, WITH THE PROTOCOL TIMEOUT RAISED IN THIS FILE (wave-18)
// ---------------------------------------------------------------------------
// `page.screenshot()` inherits the puppeteer connection's `protocolTimeout`
// (180 s by default), and that timeout is a LAUNCH option — `openParkPage`
// launches the browser, so eval.mjs could not raise it. MEASURED: a settled
// size-≥128 park with ~130+ ACTIVE LIGHTS renders at well under 1 fps under
// SwiftShader, and `Page.captureScreenshot` then exceeds the default and throws
// a ProtocolError. Round 14 lost two eval runs to it and both produced ZERO
// PNGs, which reads exactly like a broken park. It has NOTHING to do with two
// chromium runs overlapping — a single run on an idle machine does it.
//
// The fix that needs no change to evaltags.mjs: drive the capture through a CDP
// session, where puppeteer takes a PER-COMMAND `timeout`. `page.screenshot` is
// kept as the fallback, and every failure is recorded so the run can hand the
// remainder to `shot-fallback.mjs` instead of finishing with nothing.
const cdp = await page.createCDPSession().catch(() => null);
const CAPTURE_MS = Number(opt('shotTimeout') || 900000); // 15 min per shot
const failedShots = [];
async function capture(fileName) {
  const dest = path.join(outDir, fileName);
  if (cdp) {
    try {
      const { data } = await cdp.send('Page.captureScreenshot', { format: 'png' }, { timeout: CAPTURE_MS });
      fs.writeFileSync(dest, Buffer.from(data, 'base64'));
      return true;
    } catch (e) {
      lines.push(`[eval] CDP capture of ${fileName} failed (${e.message}) — retrying via page.screenshot`);
    }
  }
  try {
    await page.screenshot({ path: dest });
    return true;
  } catch (e) {
    lines.push(`[eval] SHOT FAILED ${fileName}: ${e.message}`);
    failedShots.push(fileName);
    return false;
  }
}

async function shoot(fileName) {
  // --fast skips the shots an ITERATION does not need. MEASURED: 8 shots cost
  // 101.9 s of a 187 s pass (~12.7 s each), and the cost is DRAW CALLS, not
  // fill — halving the resolution moved the total by only 9%, which matches the
  // profile finding that 92% of frame CPU is per-draw uniform upload. Taking
  // fewer shots is therefore the only real lever here.
  if (FAST && !FAST_KEEP.has(fileName)) return;
  await capture(fileName);
}

// ---------------------------------------------------------------------------
// THE DAY/NIGHT CLOCK IS READ BEFORE SHOT 01, NOT ONLY AT SHOT 07 (wave-18)
// ---------------------------------------------------------------------------
// Shots 01-06b are the rubric's PRIMARY read for the layout axes and 06b is its
// ONLY ground-material read, so "why is this park black?" has to be answerable
// from console.log alone. Until wave 18 `nightK` was read once, AFTER the night
// switcher was clicked, so a dark 01 could not be distinguished from a dark
// scene. It is now read (and asserted at 0) before the first shot as well.
//
// `--nightK=<0..1>` pins the target the night shot drives to and skips the poll
// guess; `--nightK=off` (or `0`) skips the switcher entirely and shoots 07 in
// daylight — useful when the park is under diagnosis and every pixel should be
// comparable to 01.
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
const nightKOpt = opt('nightK');
const NIGHT_TARGET = nightKOpt === undefined ? 0.95 : nightKOpt === 'off' ? 0 : Math.max(0, Math.min(1, Number(nightKOpt)));
const dayNightK = await readNightK();
// THE EXACT DEFECT CLASS THIS FILE IS BEING AUDITED FOR: the old version of this
// line printed "shots 01-06b are in DAYLIGHT, so a dark plate is a LIGHTING
// defect in the park" whenever `dayNightK` was NOT a number — i.e. it asserted
// daylight most confidently in the one case where the clock could not be read at
// all. `null` is unmeasured; it is not zero.
lines.push(
  `[eval] day-shot nightK=${dayNightK === null ? 'null (NOT FOUND — unmeasured)' : dayNightK}` +
    (dayNightK === null
      ? ' — the day/night clock could not be read, so NOTHING can be concluded about whether a dark plate in 01-06b is the park or the clock'
      : dayNightK > 0.02
        ? ' — WARNING: shots 01-06b are NOT in daylight. Anything dark in them is the clock, not the park.'
        : ' — shots 01-06b are in DAYLIGHT, so a dark plate in them is a LIGHTING/RENDER defect in the park, not the day/night switcher'),
);
if (dayNightK === null)
  fatal('the day-shot day/night clock', 'nightK was not found on the store root or anywhere in the scene — shots 01-06b cannot be attributed to the park or to the clock');

const OVERVIEWS = [
  { file: '01-overview-az045.png', az: 45 },
  { file: '02-overview-az135.png', az: 135 },
  { file: '03-overview-az225.png', az: 225 },
  { file: '04-overview-az315.png', az: 315 },
];
for (const s of FAST ? OVERVIEWS.filter((_, i) => i % 2 === 0) : OVERVIEWS) {
  await setPose(s.az, 34);
  await shoot(s.file);
}
// TOPDOWN gets its OWN radius: `orbitRadiusFor` deliberately compresses
// distance on big plots (0.18 u per unit past 48) so an ORBIT view stays close
// to the action, but at elevation 81 that framed only ~76 u of a size-192 park
// (the wave-8 default) — the whole west half, the lake's south lobe and both
// far ranges fell outside the frame, which is useless for checking a §1 seed
// row against the render. Cover the FULL plot instead — parks ≤ ~40 u are
// unaffected, their orbit radius is already the larger of the two.
// The Stage camera is 34 deg VERTICAL FOV, so covering edge S needs height
// (S/2)/tan(17 deg) ≈ 1.64·S — and that is FAR past the park's culling fog
// wall (`fogRangeFor(192)` = near 163 / far 355, camera far plane 373), which
// renders the whole plot as flat haze. So for the topdown ONLY, push the fog
// and the camera far plane out, shoot, then restore them: the park's own props
// are untouched and every other shot keeps its authored haze.
const topdownR = frame && frame.parkSize ? Math.max(R, frame.parkSize * 1.7) : R;
const fogSaved = await page.evaluate((r) => {
  const canvas = document.querySelector('canvas');
  const api = canvas && canvas.__stageApi;
  if (!api || !api.scene) return null;
  const cam = api.cameras ? api.cameras()[0] : null;
  const f = api.scene.fog;
  const saved = { near: f ? f.near : null, far: f ? f.far : null, camFar: cam ? cam.far : null };
  if (f) {
    f.near = r * 2.2;
    f.far = r * 3.4;
  }
  if (cam) {
    cam.far = r * 3.6;
    cam.updateProjectionMatrix();
  }
  return saved;
}, topdownR);
await setPose(45, 81, topdownR);
await shoot('05-topdown.png');
// 05b — AXIS-ALIGNED NADIR (azimuth 0, elevation 89, same lifted fog). The
// az-45 topdown renders the plot as a diamond, which makes "is the lake where
// the §1 seed table says" a guessing game. At azimuth 0 the mapping is exact:
// world +x → screen RIGHT, world +z → screen DOWN (the gate edge), world −z →
// screen UP. Use this one to check composed coordinates against a render.
await setPose(0, 89, topdownR);
await shoot('05b-nadir.png');
if (fogSaved)
  await page.evaluate((s) => {
    const canvas = document.querySelector('canvas');
    const api = canvas && canvas.__stageApi;
    if (!api || !api.scene) return;
    const cam = api.cameras ? api.cameras()[0] : null;
    if (api.scene.fog && s.near !== null) {
      api.scene.fog.near = s.near;
      api.scene.fog.far = s.far;
    }
    if (cam && s.camFar !== null) {
      cam.far = s.camFar;
      cam.updateProjectionMatrix();
    }
  }, fogSaved);
await setPose(45, 8);
await shoot('06-ground.png');
// 06b — EYE-LEVEL. `06-ground` is "elevation 8 at the ORBIT radius", which on
// the 128 default puts the camera 10 u up and 71 u out: the nearest ground is
// still 30+ u away, so it judges the middle distance, not the surface. Ground
// MATERIALS (turf grain, path slabs, shoreline sand) have to be judged from
// where a guest stands, so this one pulls the radius in to ~22 u at elevation 4
// — roughly a person on the lawn looking across it. Added 2026-07 with the
// terrain/grass rework, which was impossible to assess honestly without it.
await setPose(45, 4, Math.min(R, 22));
await shoot('06b-ground-close.png');

// ---------------------------------------------------------------------------
// night shot — az045 / elev34, day/night switcher flipped, nightK polled
// ---------------------------------------------------------------------------
await setPose(45, 34);
let nightK = await readNightK();
if (NIGHT_TARGET <= 0) {
  lines.push('[eval] --nightK=off/0 — day/night switcher NOT clicked, 07 is a DAYLIGHT repeat of 01');
} else {
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
  // no switcher = 07 is a second daylight copy of 01. The night axis then has no
  // plate at all, which is not the same as a park with bad night lighting.
  if (switchers === 0) fatal('the night shot (07)', 'no day/night switcher button was found, so 07 is a DAYLIGHT repeat of 01 — the night-lighting axis has no plate');

  // nightK lerps in at ~0.06 PER RENDERED FRAME (not per wall-clock second), so
  // reaching 0.95 needs ~49 RENDERED FRAMES however long you wait. The old 18 s
  // ceiling assumed those frames arrive quickly; MEASURED on a size-128 park
  // with 157 active lights the scene renders at 0.5 fps, so 18 s buys ~9 frames
  // and the shot was captured at nightK 0.77 — a dusk shot filed as the night
  // shot. The deadline is now DERIVED from the observed frame interval instead
  // of asserted: time two reads, work out how long ~49 frames takes, and cap it.
  const LERP = 0.06; // Stage/index.tsx: nightK += (target − nightK) · 0.06 per frame
  const t0 = Date.now();
  const k0 = (await readNightK()) ?? 0;
  await sleep(2000);
  const k1 = (await readNightK()) ?? 0;
  const elapsed = Math.max(1, Date.now() - t0);
  // frames rendered in `elapsed`, inverted out of the lerp: (1−k1)/(1−k0) = 0.94^n
  const framesSeen = k1 > k0 ? Math.log((1 - k1) / Math.max(1e-6, 1 - k0)) / Math.log(1 - LERP) : 0;
  const frameMs = framesSeen > 0.5 ? elapsed / framesSeen : 60;
  // frames still needed to reach the target, at that frame interval
  const framesLeft = k1 >= NIGHT_TARGET ? 0 : Math.log((1 - NIGHT_TARGET) / Math.max(1e-6, 1 - k1)) / Math.log(1 - LERP);
  const needMs = Math.min(180000, Math.max(18000, Math.ceil(framesLeft * frameMs * 1.35)));
  const nightDeadline = Date.now() + needMs;
  lines.push(
    `[eval] night poll budget ${Math.round(needMs / 1000)}s — ${frameMs.toFixed(0)}ms/frame measured ` +
      `(${(1000 / frameMs).toFixed(1)} fps), ${framesLeft.toFixed(0)} frames still needed from nightK ${k1.toFixed(3)}`,
  );
  nightK = k1;
  while ((nightK === null || nightK < NIGHT_TARGET) && Date.now() < nightDeadline) {
    await sleep(500);
    nightK = await readNightK();
  }
  if (nightK === null)
    fatal('the night shot (07) clock', 'nightK could not be read after the switcher click — 07 cannot be certified as a night plate');
  else if (nightK < NIGHT_TARGET)
    fatal(
      'the night shot (07)',
      `captured at nightK=${nightK} < ${NIGHT_TARGET} — this is DUSK filed as night. The scene renders too slowly for the lerp to finish; shed lights (emissive, nightKOf-gated) or raise the budget.`,
    );
}
lines.push(`[eval] nightK=${nightK === null ? 'null (not found)' : nightK}`);
await shoot('07-night-az045.png');

fs.writeFileSync(path.join(outDir, 'console.log'), lines.join('\n') + '\n');
_mark('shots');
{
  let prev = 0;
  console.log('[phases] ' + _phase.map(([l, t]) => { const d = t - prev; prev = t; return `${l} ${(d / 1000).toFixed(1)}s`; }).join('  |  ') + `  |  TOTAL ${(Date.now() - _t0) / 1000}s`);
}
await browser.close();
// COUNT the PNGs actually on disk. This line used to claim "wrote 8 shots"
// unconditionally — in --fast mode it is 2, and after a capture failure it is
// fewer still, so the one summary line a caller reads was the least reliable
// thing in the run.
{
  const png = fs.readdirSync(outDir).filter((f) => f.endsWith('.png'));
  console.log(
    `[eval] wrote ${png.length} shot(s) + console.log to ${outDir} (nightK=${nightK}${FAST ? ', --fast reduced angle set' : ''}${failedShots.length ? `, ${failedShots.length} CAPTURE FAILURE(S)` : ''})`,
  );
}

// ---------------------------------------------------------------------------
// AUTO-RETRY THROUGH shot-fallback.mjs (wave-18)
// ---------------------------------------------------------------------------
// If a capture still failed after the CDP path AND `page.screenshot`, finish the
// run by handing the MISSING poses to `shot-fallback.mjs --scale=0.5`, which
// launches its own browser with `protocolTimeout: 1800000`. Round 14 had to do
// this by hand twice; a round that ends with no PNGs scores 0 by absence of
// evidence, so it is not something to leave to the operator.
if (failedShots.length && !FAST) {
  const only = failedShots.map((f) => f.replace(/-.*$/, '')).join(',');
  console.error(`[eval] ${failedShots.length} shot(s) failed (${failedShots.join(', ')}) — retrying via shot-fallback.mjs --scale=0.5 --only=${only}`);
  try {
    execFileSync(process.execPath, [path.join(HERE, 'shot-fallback.mjs'), file, `--name=${name}`, '--scale=0.5', `--only=${only}`], {
      stdio: 'inherit',
    });
    console.log('[eval] shot-fallback recovered the missing poses');
  } catch (e) {
    console.error(`[eval] shot-fallback ALSO failed: ${e.message} — the shots directory is incomplete`);
    fatal('the missing shots', `${failedShots.join(', ')} — capture failed and shot-fallback.mjs could not recover them`);
  }
} else if (failedShots.length) {
  // FAST mode skipped the fallback entirely and exited 0 with missing PNGs. An
  // ITERATION pass may take fewer shots on purpose, but a shot it TRIED and
  // FAILED to take is still a missing measurement.
  fatal('the missing shots', `${failedShots.join(', ')} — capture failed in --fast mode, where shot-fallback.mjs is not run`);
}

// ---------------------------------------------------------------------------
// THE RUBRIC SCORE (wired 2026-07-26)
// ---------------------------------------------------------------------------
// Until today this file wrote 8 PNGs and a console.log and computed NO SCORE AT
// ALL — axis 15 and axis 16 were the only executable scorers in the harness and
// every other axis was an agent doing arithmetic in its head off RUBRIC.md. The
// 16-axis scorer now lives in `score-park.mjs`; it reads `probe.json`, which
// `probe.mjs` produces, so eval.mjs scores the probe sitting beside its shots.
//
// THREE THINGS IT REFUSES TO DO, all of them defects this harness has shipped
// before: print a score for a probe.json that does not exist; print a STALE
// probe's score as if it belonged to this run; and print a total for a park with
// unmeasured axes without saying so.
{
  const probePath = path.join(outDir, 'probe.json');
  if (!fs.existsSync(probePath)) {
    console.error('');
    console.error(`[eval] NOT SCORED — no ${probePath}. The rubric score needs the probe:`);
    console.error(`[eval]   node probe.mjs ${file} --name=${name}     # then re-run, or: node score-park.mjs ${name}`);
    console.error(`[eval]   ...add --signature to that probe ONLY if this park is meant to JOIN the novelty corpus (opt-in since 2026-07-26)`);
    lines.push('[eval] NOT SCORED: no probe.json beside these shots. This is NOT a score of 0 and NOT a pass.');
  } else {
    const { scoreProbe, printTable } = await import('./score-park.mjs');
    const probeAge = fs.statSync(probePath).mtimeMs;
    const stale = probeAge < _t0; // written BEFORE this eval run started
    try {
      const probe = JSON.parse(fs.readFileSync(probePath, 'utf8'));
      const logTxt = lines.join('\n');
      const rampLints = logTxt.split('\n').filter((l) => /ramp lint|deck unreachable/i.test(l)).length;
      // NO DEFAULT `--parkType` (fixed 2026-07-26). This passed `'family'`
      // whenever the flag was absent — i.e. always — which is exactly the
      // generous default score-park.mjs REMOVED when it made the park type a
      // MEASUREMENT (deriveParkType()): family targets are lower on three of
      // axis 14's six sub-tests (E 5.0 vs 6.0, +G 1.8 vs 2.5, drop 1.2 vs 2.0).
      // It is harmless only because the scorer now REFUSES the more generous
      // branch and says so in `parkTypeBasis.override` — which is precisely the
      // kind of "harmless" that stops being harmless the moment someone edits
      // the other side. `undefined` lets the measurement stand unopposed.
      const res = scoreProbe(probe, { parkType: opt('parkType') || null, park: name, consoleRampLints: rampLints });
      res.park = name;
      res.probe = probePath;
      res.probeIsFromThisRun = !stale;
      if (stale)
        res.staleWarning = `probe.json was written ${new Date(probeAge).toISOString()}, BEFORE this eval run started — it describes an EARLIER build of this park. Re-run probe.mjs to score these shots.`;
      fs.writeFileSync(path.join(outDir, 'score.json'), JSON.stringify(res, null, 2));
      printTable(res, name + (stale ? ' [probe.json PREDATES this run — see staleWarning]' : ''));
      if (stale) console.error(`\n[eval] WARNING: ${res.staleWarning}`);
      console.log(`  wrote ${path.join(outDir, 'score.json')}`);
      lines.push(`[eval] rubric score: ${res.total}/${res.complete ? 100 : res.measurableMax + ' MEASURED (INCOMPLETE)'}${stale ? ' [from a probe.json that PREDATES this run]' : ''}`);
      if (!res.complete)
        fatal(
          'the rubric score',
          `${res.unmeasured.length} item(s) could not be measured, so this park has NO /100 score: ${res.unmeasured.map((u) => u.what).join('; ')}`,
        );
    } catch (e) {
      fatal('the rubric score', `score-park.mjs threw: ${e.message}`);
    }
  }
}

// ---------------------------------------------------------------------------
// THE GATE
// ---------------------------------------------------------------------------
// console.log is rewritten so it carries every UNMEASURED line, then the run
// exits non-zero. The shots stay on disk for diagnosis; what does NOT happen is
// this run being reported as clean.
fs.writeFileSync(path.join(outDir, 'console.log'), lines.join('\n') + '\n');
if (unmeasured.length) {
  console.error('');
  console.error(`[eval] FAILED — ${unmeasured.length} measurement(s) could not be obtained for "${name}". This run is NOT scoreable.`);
  for (const u of unmeasured) console.error(`  ✗ ${u.what}\n      ${u.detail}`);
  if (!settle.validated) {
    console.error('');
    const flushDesc = !settle.flushed
      ? 'did NOT run'
      : settle.flushError
        ? `THREW: ${settle.flushError}`
        : `ran (${settle.buildsFlushed} builds / ${settle.flushMs} ms)`;
    console.error(`  SETTLE TIMEOUT: PARK_SETTLE_MS = ${settle.settleMs} ms · elapsed ${settle.ms} ms · flushBuilds ${flushDesc} · ${settle.buildsLeft} build(s) still queued`);
    console.error('  <Park> validates through ctx.whenBuilt(), which fires only when the store build queue drains.');
  }
  console.error('');
  console.error(`[eval] the shots and console.log in ${outDir} are for DIAGNOSIS ONLY — do not score them`);
  process.exitCode = 1;
}

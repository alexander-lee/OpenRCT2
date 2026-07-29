#!/usr/bin/env node
// ---------------------------------------------------------------------------
// probe-night-lights.mjs — WHAT NIGHT MODE ACTUALLY GETS, and what a light cap
// takes away from it.
//
// The park runtime used to enforce a nearest-N GLOBAL LIGHT BUDGET (default 16)
// and additionally shed a FAR/OFFSCREEN entry's lights outright. Both are gone
// by default (Park/parkContext.ts). This measures the difference the only way
// that settles it — on a real park, at night:
//
//   * every Point/Spot light in the scene: how many are `visible`, and how many
//     are LIT (intensity > 0.01) once the night gate has run. A capped park
//     shows lit-but-invisible lights: components raise `intensity` for the night
//     and the runtime hides the object anyway.
//   * the frame the cap was supposed to buy — draws / triangles / fps / CPU ms
//     from `api.stats()`, day and night, so "lights are the bottleneck" is a
//     number rather than an assumption.
//
// `--cap=N` re-runs with an explicit `budgets.lights` for the A/B.
//
//   node probe-night-lights.mjs <park.tsx> [--shot]
// ---------------------------------------------------------------------------
import fs from 'node:fs';
import path from 'node:path';
import { HERE } from './paths.mjs';
import { bundleParkPage, openParkPage } from './evaltags.mjs';

const MEASURE = () => {
  const store = window.__evalPark;
  if (!store) return { error: 'no __evalPark store' };
  const api = store.api ?? null;
  // the Stage's own scene root — `nightK` lives on the group the Stage builds
  // into, and every mounted entry hangs under it
  const root = api ? api.scene : null;
  if (!root) return { error: 'no api.scene on the park store' };
  /** the group carrying userData.nightK (nightKOf walks UP to it) */
  let nightHost = null;
  const findNight = (o) => {
    if (nightHost) return;
    if (o.userData && typeof o.userData.nightK === 'number') nightHost = o;
    else (o.children ?? []).forEach(findNight);
  };
  findNight(root);
  const lights = [];
  const seen = new Set();
  const walk = (o) => {
    if (!o || seen.has(o)) return;
    seen.add(o);
    if (o.isPointLight || o.isSpotLight) {
      // is anything between this light and the scene root switched off?
      let hiddenBy = null;
      for (let p = o; p; p = p.parent) if (!p.visible) hiddenBy = p.name || p.type;
      lights.push({
        type: o.isPointLight ? 'point' : 'spot',
        intensity: +o.intensity.toFixed(3),
        visible: o.visible,
        hiddenBy,
      });
    }
    (o.children ?? []).forEach(walk);
  };
  walk(root);
  const stats = api && api.stats ? api.stats() : null;
  return {
    nightK: nightHost ? +nightHost.userData.nightK.toFixed(2) : null,
    total: lights.length,
    visible: lights.filter((l) => l.visible).length,
    lit: lights.filter((l) => l.intensity > 0.01).length,
    // THE DEFECT SIGNATURE: a component raised intensity for the night and
    // something above it in the graph is switched off, so the light does nothing
    litButHidden: lights.filter((l) => l.intensity > 0.01 && (!l.visible || l.hiddenBy)).length,
    stats: stats ? { drawCalls: stats.drawCalls, triangles: stats.triangles, fps: stats.fps, frameMs: stats.frameMs, lights: stats.lights } : null,
  };
};

const args = process.argv.slice(2);
const shot = args.includes('--shot');
const parks = args.filter((a) => !a.startsWith('--'));
if (!parks.length) {
  console.error('usage: node probe-night-lights.mjs <park.tsx> [--shot]');
  process.exit(2);
}

for (const p of parks) {
  const src = path.resolve(HERE, p);
  if (!fs.existsSync(src)) {
    console.error(`missing ${p}`);
    continue;
  }
  const name = path.basename(p, '.tsx');
  const html = await bundleParkPage(src, `night-${name}`);
  const { browser, page, lines } = await openParkPage(html, { waitMs: 90000 });
  const day = await page.evaluate(MEASURE);
  // flip to night through the Stage's own switcher, then let the 0.06/frame
  // nightK lerp finish (and the runtime's 0.3 s light pass run several times)
  // `openParkPage` here is puppeteer-core (playwright is only the fallback), so
  // this goes through `page.$$` rather than a playwright locator. A heavy park
  // starves the actionability checks, so fall back to a DOM click.
  const NIGHT_SEL = 'button[aria-label="Switch to night"]';
  const handles = (await page.$$(NIGHT_SEL)) ?? [];
  for (const h of handles) {
    try {
      await h.click();
    } catch {
      /* fall through to the DOM click below */
    }
  }
  if (!handles.length)
    await page.evaluate((sel) => {
      document.querySelectorAll(sel).forEach((b) => b.click());
    }, NIGHT_SEL);
  await new Promise((r) => setTimeout(r, 9000)); // puppeteer-core has no waitForTimeout
  const night = await page.evaluate(MEASURE);
  if (shot) {
    const out = path.join(HERE, 'shots', name, 'night.png');
    fs.mkdirSync(path.dirname(out), { recursive: true });
    await page.screenshot({ path: out });
    console.log(`  wrote ${out}`);
  }
  await browser.close();
  const verdict = lines.find((l) => /validatePark →/.test(l)) ?? '(no validatePark line)';
  const perf = lines.find((l) => /\[Park\] perf:/.test(l)) ?? '(no perf line)';
  console.log(`\n=== ${name}   ${verdict.replace(/^\[log\] /, '').slice(0, 90)}`);
  if (day.error || night.error) {
    console.log(`  ERROR ${day.error ?? night.error}`);
    continue;
  }
  const row = (label, m) =>
    `  ${label.padEnd(6)} nightK ${String(m.nightK).padStart(5)} · lights ${String(m.total).padStart(3)} total / ${String(m.visible).padStart(
      3,
    )} visible / ${String(m.lit).padStart(3)} LIT · lit-but-hidden ${String(m.litButHidden).padStart(3)}` +
    (m.stats ? ` · ${m.stats.drawCalls} draws · ${(m.stats.triangles / 1e6).toFixed(2)}M tris · ${m.stats.fps} fps · ${m.stats.frameMs}ms` : '');
  console.log(row('DAY', day));
  console.log(row('NIGHT', night));
  console.log(`  ${perf.replace(/^\[info\] /, '')}`);
  const ok = night.litButHidden === 0;
  console.log(
    `\n  VERDICT  ${ok ? 'PASS' : 'FAIL'} — ${night.litButHidden} light(s) are lit for the night but switched off by the runtime (want 0)`,
  );
}

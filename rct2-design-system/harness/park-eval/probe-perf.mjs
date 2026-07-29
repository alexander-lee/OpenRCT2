#!/usr/bin/env node
// probe-perf.mjs — read the `[Park] perf:` line for one or more parks, nothing
// else. No screenshots, no scoring.
//
// `<Park>` logs draws / triangles / fps / CPU frame ms / JS heap / validatePark
// wall-clock ms / active lights / runtime entries three seconds after the park
// settles. Getting that line out of `eval.mjs` means paying for eight
// SwiftShader screenshots first; `w7-check.mjs` closes the page before the
// timer fires. Written 2026-07 for the 192 → 128 plot rescale, where the whole
// question was "what does the smaller plot actually cost".
//
//   node probe-perf.mjs samples/a.tsx [samples/b.tsx …]
//   PARK_NAV_MS / PARK_SETTLE_MS override the browser budgets as everywhere else
import { bundleParkPage, openParkPage } from './lib.mjs';

const files = process.argv.slice(2);
if (!files.length) {
  console.error('usage: node probe-perf.mjs <park.tsx> [...]');
  process.exit(1);
}
for (const f of files) {
  const html = await bundleParkPage(f, 'perf-' + f.split('/').pop().replace(/\.tsx$/, ''));
  const r = await openParkPage(html, { waitMs: Number(process.env.PARK_SETTLE_MS ?? 240000) });
  // the perf line lands ~3 s after the settle effect — wait past it
  await new Promise((res) => setTimeout(res, 9000));
  const perf = r.lines.filter((l) => /\[Park\] perf:/.test(l)).pop();
  const verdict = r.lines.some((l) => /validatePark → ok: true/.test(l)) ? 'ok:true' : 'ok:false';
  console.log(`${f}\n  ${verdict}\n  ${perf ? perf.replace(/^\[info\] /, '') : '(no perf line — the park never settled)'}`);
  await r.browser.close();
}

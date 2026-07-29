#!/usr/bin/env node
// wave-7 regression runner: mount each park, capture the validatePark verdict
// + every [Park] lint line, NO screenshots. `node w7-check.mjs a.tsx b.tsx …`
// W7_WAIT=ms (settle budget — a 192 park needs minutes), W7_VERBOSE=1 (dump
// every lint + failure line).
import { bundleParkPage, openParkPage } from './lib.mjs';
const files = process.argv.slice(2);
if (!files.length) { console.error('usage: node w7-check.mjs <park.tsx> [...]'); process.exit(1); }
let bad = 0;
for (const f of files) {
  const name = `w7-${f.split('/').pop().replace(/\.tsx$/, '')}`;
  let lines = [];
  try {
    const html = await bundleParkPage(f, name);
    const r = await openParkPage(html, { waitMs: Number(process.env.W7_WAIT || 9000) });
    lines = r.lines;
    await r.browser.close();
  } catch (e) {
    console.log(`\n=== ${f}\n  BUNDLE/RUN ERROR ${e.message}`);
    bad++; continue;
  }
  const fails = lines.filter((l) => /validatePark FAIL/.test(l));
  const ok = lines.some((l) => /validatePark → ok: true/.test(l));
  const lints = lines.filter((l) => /\[Park\] (FATAL LINT|lint) \[/.test(l));
  const errs = lines.filter((l) => /\[pageerror\]/.test(l));
  const counts = {}, lkinds = {};
  for (const l of fails) { const m = l.match(/validatePark FAIL \[(\w+)\]/); if (m) counts[m[1]] = (counts[m[1]] ?? 0) + 1; }
  for (const l of lints) { const m = l.match(/(?:FATAL LINT|lint) \[([\w:]+)\]/); if (m) lkinds[m[1]] = (lkinds[m[1]] ?? 0) + 1; }
  // GATE-DISCOVERED warnings (wave-9): `deadStreetNode`, `waterRePicked`,
  // `waterShrunk` … are raised by validatePark ITSELF, not via park.reportLint,
  // so they only appear inside the `[Park] validatePark warnings (…)` JSON dump
  // (one multi-line console message). Count them from there, or a non-fatal
  // finding — "your lakeside district lost its lake" — stays invisible here.
  const dump = lines.filter((l) => /validatePark warnings/.test(l)).join('\n');
  const gkinds = {};
  for (const m of dump.matchAll(/"kind":\s*"([\w:]+)"/g)) gkinds[m[1]] = (gkinds[m[1]] ?? 0) + 1;
  const gateOnly = Object.fromEntries(Object.entries(gkinds).filter(([k]) => !(k in lkinds)));
  console.log(`\n=== ${f}`);
  console.log(`  ok:${ok} failures:${fails.length} ${JSON.stringify(counts)}`);
  console.log(`  lints:${lints.length} ${JSON.stringify(lkinds)}`);
  console.log(`  gate warnings:${Object.keys(gateOnly).length} ${JSON.stringify(gateOnly)}`);
  if (errs.length) console.log(`  PAGE ERRORS: ${errs.length}\n    ${errs.slice(0, 3).join('\n    ')}`);
  if (!ok) bad++;
  if (process.env.W7_VERBOSE) for (const l of [...lints, ...fails]) console.log(`    ${l}`);
}
console.log(bad ? `\n${bad} park(s) NOT ok` : '\nall parks ok:true');

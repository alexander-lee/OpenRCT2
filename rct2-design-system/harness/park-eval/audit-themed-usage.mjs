#!/usr/bin/env node
// ---------------------------------------------------------------------------
// audit-themed-usage.mjs — DID THE PARK ACTUALLY USE THE WORLDS AND THE RIDES?
//
// The 16-axis score answers "is this a good park". It does NOT answer the
// question the campaign keeps failing on: are the three declared worlds three
// DISTINCT PLACES, or one park three times under differently-tinted bazaars?
// A park can score in the 90s with `built: true` on every world while holding
// zero themed rides and zero themed scenery — measured, repeatedly.
//
// So this reads the probe's own world audit and reports, per world, against the
// published floor (rules/setup.md §0-P.4):
//
//     ALL 3 rides OF THAT THEME · its OWN stall · >= 25 themed scenery placements · its own
//     GROUND — and ALL FIVE worlds, not three
//
// and then reads the park SOURCE for the two creative-freedom questions:
//
//     does the flagship coaster contain an inversion, and is it still the
//     turnR x4 rectangle every park used to ship?
//     does any non-Monorail spline ride carry a custom `pieces` array?
//
// Usage:
//   node audit-themed-usage.mjs <probeName> [--src=samples/<file>.tsx]
// ---------------------------------------------------------------------------
import fs from 'node:fs';
import path from 'node:path';
import { HERE } from './paths.mjs';
import { THEME_CONTENT, WORLD_REQUIREMENT, canonicalTheme, THEME_TITLES } from './themes.mjs';

const args = process.argv.slice(2);
const name = args.find((a) => !a.startsWith('--'));
const srcArg = (args.find((a) => a.startsWith('--src=')) || '').slice(6);
if (!name) {
  console.error('usage: node audit-themed-usage.mjs <probeName> [--src=samples/<file>.tsx]');
  process.exit(2);
}

const probePath = path.join(HERE, 'shots', name, 'probe.json');
if (!fs.existsSync(probePath)) {
  console.error(`no probe at ${probePath} — the park must be probed first`);
  process.exit(2);
}
const P = JSON.parse(fs.readFileSync(probePath, 'utf8'));

// `rides` is now PER WORLD (see WORLD_REQUIREMENT) — fire takes 2 named ones,
// everyone else takes all 3. Stalls and scenery stay uniform.
const FLOOR = { stalls: 1, scenery: 25 };
const DEFAULT_REQ = { min: 3, must: [], signature: [] };
const pass = (b) => (b ? '\x1b[32mPASS\x1b[0m' : '\x1b[31mFAIL\x1b[0m');

console.log(`\n  THEMED-USAGE AUDIT — ${name}`);
console.log('  ' + '-'.repeat(74));

// ---- 1. the worlds -------------------------------------------------------
const worlds = (P.worlds && P.worlds.worlds) || [];
if (!worlds.length) console.log('  NO <World> DECLARED — the whole themed layer is absent.');

let worldsOk = 0;
for (const w of worlds) {
  const t = canonicalTheme(w.themeId);
  const own = (t && THEME_CONTENT[t]) || { rides: [], stalls: [], scenery: [] };
  // Prefer the fields the DS now publishes; fall back to counting themedPieces
  // for probes taken before those fields existed.
  const themed = (P.worlds.themedPieces || []).filter((p) => p.world === w.id && canonicalTheme(p.themeId) === t);
  const rides = w.themedRideCount ?? new Set(themed.filter((p) => p.cls === 'ride').map((p) => p.kind)).size;
  const stalls = w.themedStallCount ?? themed.filter((p) => p.cls === 'stall').length;
  const scenery = w.themedSceneryCount ?? themed.filter((p) => p.cls !== 'ride' && p.cls !== 'stall').length;
  const req = WORLD_REQUIREMENT[t] || DEFAULT_REQ;
  // `themedRideKinds` holds the park's REGISTER NAMES ("Ember Wings"), not the
  // component kinds ("EmberWings") — comparing `must` against it marked a world
  // red for two rides it had actually mounted. Match on themedPieces' `kind`.
  const mounted = new Set(themed.filter((p) => p.cls === 'ride').map((p) => p.kind));
  const missingMust = req.must.filter((k) => !mounted.has(k));
  // a signature piece is SCENERY, so look for it among every themed piece in
  // the rect rather than among the rides
  const sigCount = {};
  for (const pc of themed) sigCount[pc.kind] = (sigCount[pc.kind] || 0) + 1;
  const missingSig = req.signature.filter((k) => !sigCount[k]);
  // a signature piece is a singular curiosity, not a hedge. One park placed
  // none of them and the next placed FOUR of each.
  const overSig = req.signature.filter((k) => (sigCount[k] || 0) > 2);
  const ok = rides >= req.min && !missingMust.length && !missingSig.length && !overSig.length
    && stalls >= FLOOR.stalls && scenery >= FLOOR.scenery;
  if (ok) worldsOk += 1;

  console.log(`\n  ${pass(ok)}  world "${w.id}" — ${THEME_TITLES[t] ?? w.themeId}${w.built ? '' : '   [NOT BUILT]'}`);
  console.log(`         rides   ${String(rides).padStart(2)} / ${req.min}   ${
    w.themedRideKinds?.length ? w.themedRideKinds.join(', ') : '(none of its own)'}`);
  if (req.must.length)
    console.log(`         MUST    ${req.must.map((k) => (mounted.has(k) ? `\x1b[32m${k}\x1b[0m` : `\x1b[31m${k}\x1b[0m`)).join(', ')}`);
  if (req.signature.length)
    console.log(`         SIGNATURE ${req.signature.map((k) => {
      const n = sigCount[k] || 0;
      const bad = n < 1 || n > 2;
      return `${bad ? '\x1b[31m' : '\x1b[32m'}${k} x${n}\x1b[0m`;
    }).join(', ')}`);
  console.log(`         stall   ${String(stalls).padStart(2)} / ${FLOOR.stalls}   ${
    stalls ? '' : `(wants ${own.stalls.join('/')})`}`);
  console.log(`         scenery ${String(scenery).padStart(2)} / ${FLOOR.scenery}`);
  if (!ok) {
    const want = [];
    if (missingMust.length) want.push(`MUST mount ${missingMust.join(' + ')}`);
    if (missingSig.length) want.push(`MUST place ${missingSig.join(' + ')}`);
    if (overSig.length) want.push(`${overSig.join(' + ')} is a SIGNATURE piece — place 1, not ${overSig.map((k) => sigCount[k]).join('/')}`);
    if (rides < req.min) want.push(`${req.min - rides} more ride(s) from ${own.rides.join(', ')}`);
    if (stalls < FLOOR.stalls) want.push(`its own counter (${own.stalls.join(', ')})`);
    if (scenery < FLOOR.scenery) want.push(`${FLOOR.scenery - scenery} more placement(s) from ${own.scenery.slice(0, 4).join(', ')}…`);
    console.log(`         NEEDS   ${want.join(' · ')}`);
  }
}

// ---- 2. the coaster + spline questions, read from source -----------------
const src = srcArg ? path.resolve(HERE, srcArg) : path.join(HERE, 'samples', `${name}.tsx`);
console.log('\n  ' + '-'.repeat(74));
if (!fs.existsSync(src)) {
  console.log(`  (no source at ${path.relative(HERE, src)} — skipping the track audit)`);
} else {
  const s = fs.readFileSync(src, 'utf8');
  const inversions = (s.match(/type:\s*'(loop|loopL|loopR|corkscrewL|corkscrewR)'/g) || []);
  const loops = inversions.filter((m) => /loop/.test(m));
  const turnR90 = (s.match(/type:\s*'turnR',\s*angle:\s*90,\s*radius:\s*2\.5/g) || []).length;
  const turnL = (s.match(/type:\s*'turnL'/g) || []).length;
  const helix = (s.match(/type:\s*'helix[LR]'/g) || []).length;
  const sbend = (s.match(/type:\s*'sbend'/g) || []).length;
  const oddAngles = (s.match(/angle:\s*(?!90\b)\d+/g) || []).length;

  console.log(`  ${pass(loops.length > 0)}  flagship has a VERTICAL LOOP        ${loops.length} loop(s), ${inversions.length} inversion(s) total`);
  console.log(`  ${pass(turnR90 < 4)}  not the turnR x4 rectangle          ${turnR90} × turnR/90°/r2.5` +
    `   (turnL ${turnL}, helix ${helix}, sbend ${sbend}, non-90° angles ${oddAngles})`);

  // custom pieces on a non-Monorail spline rig
  const SPLINE = ['LogFlume', 'GoKarts', 'Bobsleigh', 'RiverRapids', 'Chairlift', 'MagneticRide',
    'MagmaRun', 'DeepDrift', 'WyrmsHollow', 'GearworksExpress', 'Bassline', 'LavaTubeRun',
    'ReefRacer', 'OceanTunnelSlide', 'MoonlitBarge', 'EmberWings', 'MineTrainCoaster'];
  const custom = SPLINE.filter((r) => new RegExp(`<${r}[^>]*\\bpieces=`, 's').test(s));
  const mounted = SPLINE.filter((r) => new RegExp(`<${r}[\\s/>]`).test(s));
  console.log(`  ${pass(custom.length > 0)}  custom track on a spline ride       ${
    custom.length ? custom.join(', ') : 'none'}   (spline rigs mounted: ${mounted.join(', ') || 'none'})`);
  const monoCustom = /<Monorail[^>]*\bpieces=\{(?!MONO_PIECES)/s.test(s);
  console.log(`  ${pass(!monoCustom)}  Monorail left on the published ring ${monoCustom ? '— IT WAS RE-AUTHORED' : ''}`);
}

console.log('\n  ' + '-'.repeat(74));
console.log(`  WORLDS MEETING THE FULL FLOOR: ${worldsOk} / ${worlds.length}\n`);
process.exit(worldsOk === worlds.length && worlds.length >= 5 ? 0 : 1);

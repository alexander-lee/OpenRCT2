// park-eval RIDE + STALL CATALOG — enumerated from the LIVE design system
// (read-only) so the category map can never drift from what actually ships.
//
//   rideCatalog()   -> [{ kind, category, tracked, defaultName, intensity, source }]
//   stallCatalog()  -> [{ kind, item, defaultName }]
//
// A component under components/<Kind>/index.tsx counts as a CATALOG RIDE when
// it registers through the universal ride chassis:
//   · `composableRide('<Kind>', …)`  — the one-liner most rides use, or
//   · a hand-rolled `<ConfigurableRide … layout={{ defaults: { … } }}>`
// and as a CATALOG STALL when it goes through `composableStall('<Kind>', …)`.
// `<Coaster>`/`<TrackRide>` (components/Park/pieces.tsx) are the two chassis
// wrappers rather than catalog folders, so they are appended by hand.
//
// CATEGORIES (5, the RCT2 ride groups the rubric scores on):
//   gentle | thrill | water | transport | dark
// `tracked: true` marks the TRACKED / water / transport / simulator
// specialities the campaign never reaches for — a park earns the roster
// speciality point by shipping at least one of these BESIDES its coaster.

import fs from 'node:fs';
import path from 'node:path';
import { REPO } from './paths.mjs';

/** category + tracked flag per catalog ride kind. Anything that ships in the
 *  DS but is missing from this table is reported as category 'unclassified'
 *  (so a new catalog ride shows up loudly instead of silently scoring 0). */
export const RIDE_CATEGORY = {
  // --- gentle (RCT2 "Gentle Rides") ---------------------------------------
  Carousel: ['gentle', false],
  FerrisWheel: ['gentle', false],
  Teacups: ['gentle', false],
  SpaceRings: ['gentle', false],
  TwistRide: ['gentle', false],
  BumperCars: ['gentle', false],
  FlyingSaucers: ['gentle', false],
  Helicycles: ['gentle', true],
  ObservationTower: ['gentle', true],
  // --- thrill (RCT2 "Thrill Rides" + roller coasters) --------------------
  Coaster: ['thrill', false], // <Coaster> chassis wrapper (spline coaster)
  TrackRide: ['thrill', true], // <TrackRide> chassis wrapper (grid pieces)
  SplineCoaster: ['thrill', false],
  MineTrainCoaster: ['thrill', true],
  Bobsleigh: ['thrill', true],
  DropTower: ['thrill', false],
  Enterprise: ['thrill', false],
  LaunchedFreefall: ['thrill', false],
  PirateShip: ['thrill', false],
  SwingingInverterShip: ['thrill', false],
  SwingRide: ['thrill', false],
  TopSpin: ['thrill', false],
  MotionSimulator: ['thrill', true],
  GoKarts: ['thrill', true],
  // --- water (RCT2 "Water Rides") ---------------------------------------
  LogFlume: ['water', true],
  RiverRapids: ['water', true],
  PaddleBoats: ['water', true],
  // --- transport (RCT2 "Transport Rides") -------------------------------
  Monorail: ['transport', true],
  Chairlift: ['transport', true],
  MagneticRide: ['transport', true],
  // --- dark rides -------------------------------------------------------
  GhostTrain: ['dark', true],
  HauntedMansion: ['dark', true],
};

export const CATEGORIES = ['gentle', 'thrill', 'water', 'transport', 'dark'];

const compDir = () => path.join(REPO, 'components');

function readIndex(kind) {
  try {
    return fs.readFileSync(path.join(compDir(), kind, 'index.tsx'), 'utf8');
  } catch {
    return null;
  }
}

function dirs() {
  return fs
    .readdirSync(compDir(), { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();
}

const DEFAULT_NAME = /defaults:\s*\{[^}]*name:\s*'([^']+)'/;
const DEFAULT_INTENSITY = /defaults:\s*\{[^}]*intensity:\s*([0-9.]+)/;

/** every registerable ride the design system currently ships */
export function rideCatalog() {
  const out = [];
  for (const kind of dirs()) {
    const src = readIndex(kind);
    if (!src) continue;
    const viaFactory =
      new RegExp(`composableRide<?[^(]*\\(\\s*\\n?\\s*'${kind}'`).test(src) ||
      new RegExp(`composableRide[^\\n]*\\n\\s*'${kind}'`).test(src);
    const viaChassis = /<ConfigurableRide/.test(src) && /defaults:\s*\{/.test(src);
    if (!viaFactory && !viaChassis) continue;
    const [category, tracked] = RIDE_CATEGORY[kind] || ['unclassified', false];
    out.push({
      kind,
      category,
      tracked,
      defaultName: (src.match(DEFAULT_NAME) || [])[1] ?? null,
      defaultIntensity: Number((src.match(DEFAULT_INTENSITY) || [])[1] ?? NaN) || null,
      source: viaFactory ? 'composableRide' : 'ConfigurableRide',
    });
  }
  // the two chassis WRAPPERS (components/Park/pieces.tsx), not catalog folders
  for (const kind of ['Coaster', 'TrackRide']) {
    const [category, tracked] = RIDE_CATEGORY[kind];
    out.push({ kind, category, tracked, defaultName: kind, defaultIntensity: null, source: 'Park/pieces' });
  }
  // WoodenCoaster is a deprecated alias of SplineCoaster — not a distinct pick
  return out.filter((r) => r.kind !== 'WoodenCoaster');
}

/** every registerable stall the design system currently ships */
export function stallCatalog() {
  const out = [];
  for (const kind of dirs()) {
    const src = readIndex(kind);
    if (!src) continue;
    if (!new RegExp(`composableStall<?[^(]*\\(\\s*\\n?\\s*'${kind}'`).test(src)) continue;
    const tail = src.slice(src.indexOf('composableStall'));
    out.push({
      kind,
      defaultName: (tail.match(/name:\s*'([^']+)'/) || [])[1] ?? null,
      item: (tail.match(/item:\s*'([^']+)'/) || [])[1] ?? null,
    });
  }
  return out;
}

/** kinds mentioned as JSX in a park's own source (comments stripped) — the
 *  fallback for rides/stalls whose scene tag is missing and the authority for
 *  "which catalog kinds does this park FILE reach for". */
export function kindsInSource(files, kinds) {
  const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
  const src = files
    .map((f) => {
      try {
        return strip(fs.readFileSync(f, 'utf8'));
      } catch {
        return '';
      }
    })
    .join('\n');
  const hits = {};
  for (const k of kinds) {
    const m = src.match(new RegExp(`<${k}(?=[\\s/>])`, 'g'));
    if (m) hits[k] = m.length;
  }
  return hits;
}

/** the park file + every sibling source file it relatively imports (one hop is
 *  enough for the corpus: samples/<park>.tsx [+ samples/rides/*]) */
export function parkSourceFiles(parkFile) {
  const abs = path.resolve(parkFile);
  const seen = new Set([abs]);
  const queue = [abs];
  while (queue.length) {
    const f = queue.pop();
    let src = '';
    try {
      src = fs.readFileSync(f, 'utf8');
    } catch {
      continue;
    }
    for (const m of src.matchAll(/from\s*['"](\.[^'"]+)['"]/g)) {
      for (const ext of ['', '.tsx', '.ts', '/index.tsx', '/index.ts']) {
        const cand = path.resolve(path.dirname(f), m[1] + ext);
        if (!seen.has(cand) && fs.existsSync(cand) && fs.statSync(cand).isFile()) {
          seen.add(cand);
          queue.push(cand);
          break;
        }
      }
    }
  }
  return [...seen];
}

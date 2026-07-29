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
 *  (so a new catalog ride shows up loudly instead of silently scoring 0).
 *
 *  THE 13 WORLD RIDES WERE CLASSIFIED 2026-07-25, and it was an AXIS-13 BUG
 *  that they were not. The v6.0 world build added one flagship + two or three
 *  attractions per preset (44 registerable kinds now, was 31) and every one of
 *  them landed in `unclassified`, which is not a scoring category: a park built
 *  the way `rules/park-generation-composition.md` §3 mandates — worlds first,
 *  each world's OWN rides — measured `categoryCount: 1` and `hasSpeciality:
 *  false` no matter how varied its roster actually was. `worlds-ref`, the
 *  reference WORLDS park, read 1 category off 4 world rides + a TrackRide and
 *  scored 0/1.5 on category balance and 0/1 on speciality. Categories below are
 *  read off each component's own header + `defaults.intensity`, mapped onto the
 *  same five RCT2 groups; `tracked` follows the existing convention that a
 *  NAMED coaster variant (MineTrainCoaster, Bobsleigh) counts, while the
 *  generic `Coaster`/`SplineCoaster`/`TrackRide` chassis does not. */
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
  AetherBalloons: ['gentle', false], // brasswork: rotating aerial gondolas, intensity 2
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
  Bassline: ['thrill', true], // pulse: neon steel coaster through light tunnels
  BoilerBurst: ['thrill', false], // brasswork: turntable spinner, intensity 6
  Discotron: ['thrill', false], // pulse: mirror-ball gyro spinner, intensity 6
  EmberWings: ['thrill', true], // emberfall: suspended flyer over the crater rim
  LavaTubeRun: ['thrill', true], // emberfall: steel coaster through the lava tube
  WyrmsHollow: ['thrill', true], // thornwick: dragon FAMILY coaster
  // --- water (RCT2 "Water Rides") ---------------------------------------
  LogFlume: ['water', true],
  RiverRapids: ['water', true],
  PaddleBoats: ['water', true],
  DeepDrift: ['water', true], // tidewater: slow boat ride through sea caves
  MagmaRun: ['water', true], // emberfall: log flume through a basalt canyon
  MoonlitBarge: ['water', true], // thornwick: lantern-lit boat drift, intensity 1
  OceanTunnelSlide: ['water', true], // tidewater: raft slide through the lagoon tube
  ReefRacer: ['water', true], // tidewater: water coaster, intensity 8
  // --- transport (RCT2 "Transport Rides") -------------------------------
  Monorail: ['transport', true],
  Chairlift: ['transport', true],
  MagneticRide: ['transport', true],
  // --- dark rides -------------------------------------------------------
  GhostTrain: ['dark', true],
  HauntedMansion: ['dark', true],
  GearworksExpress: ['dark', true], // brasswork: cars through a hall of machinery
};

export const CATEGORIES = ['gentle', 'thrill', 'water', 'transport', 'dark'];

// ===========================================================================
// CIRCUITS — the rides that run a VEHICLE ALONG A TRACK (added 2026-07-26)
// ===========================================================================
// `RIDE_CATEGORY[…][1]` (`tracked`) is a SPECIALITY flag, not a physical one:
// it deliberately excludes the generic `Coaster`/`SplineCoaster`/`TrackRide`
// chassis so that "ship a tracked ride BESIDES your coaster" means something.
// That is the right reading for axis 13's speciality point and the WRONG one
// for the question the rules now ask — *how many CIRCUITS does this park run?*
//
// So `CIRCUIT_FAMILY` is the PHYSICAL classification: a kind is a circuit when
// a vehicle traverses a spline/track, and its FAMILY is the kind of circuit it
// is. Five families, because the rules require a roster that SPANS them:
//   coaster | water | transport | dark | tower  (vertical/aerial circuits)
// Flat spinners (Carousel, DropTower, Discotron, …) are absent by design — a
// park of one coaster plus eight spinners must measure ONE circuit here.
//
// MEASURED, 24-park corpus (`node probe-tracked-roster.mjs`): 16 of 20 probed
// parks registered exactly ONE coaster, 3 none, and one two. Nothing in the
// rules or the rubric had ever asked for a second circuit.
export const CIRCUIT_FAMILY = {
  // --- coaster circuits ---------------------------------------------------
  Coaster: 'coaster',
  TrackRide: 'coaster',
  SplineCoaster: 'coaster',
  MineTrainCoaster: 'coaster',
  Bobsleigh: 'coaster',
  Bassline: 'coaster',
  EmberWings: 'coaster',
  LavaTubeRun: 'coaster',
  WyrmsHollow: 'coaster',
  ReefRacer: 'coaster', // a WATER coaster — category 'water', family 'coaster'
  // --- water circuits -----------------------------------------------------
  LogFlume: 'water',
  RiverRapids: 'water',
  DeepDrift: 'water',
  OceanTunnelSlide: 'water',
  MagmaRun: 'water',
  MoonlitBarge: 'water',
  PaddleBoats: 'water',
  // --- transport circuits -------------------------------------------------
  Monorail: 'transport',
  Chairlift: 'transport',
  MagneticRide: 'transport',
  GoKarts: 'transport', // a vehicle on a closed course
  // --- dark circuits ------------------------------------------------------
  GhostTrain: 'dark',
  HauntedMansion: 'dark',
  GearworksExpress: 'dark',
  // --- tower / aerial circuits -------------------------------------------
  ObservationTower: 'tower',
  Helicycles: 'tower',
  MotionSimulator: 'tower', // a tracked simulator cabin, not a spinner
};

export const CIRCUIT_FAMILIES = ['coaster', 'water', 'transport', 'dark', 'tower'];

/** the circuit family of a kind, or null when it is a FLAT ride */
export function circuitFamilyOf(kind) {
  return CIRCUIT_FAMILY[kind] || null;
}

// ---------------------------------------------------------------------------
// PIECES_MODE — what happens when you OMIT the `pieces` prop
// ---------------------------------------------------------------------------
// This is the finding that makes a multi-circuit park affordable, and it is
// read off the call sites in `components/<Kind>/index.tsx` (verified by grep
// 2026-07-26, compile-verified by `probe-tracked-roster.mjs`):
//
//   'conditional' — the component guards the call: `if (opts.pieces) { …
//        compileTrackPieces(opts.pieces, …) }`. With NO `pieces` prop the
//        compiler is NEVER INVOKED: no closure report, no synthesized Dubins
//        return leg, no `report.fatal`, no translucent-red non-registration.
//        `<LogFlume position register />` is a registered, rated ride, and
//        omitting `pieces` is the SAFE default — not a compromise.
//   'default' — `compileTrackPieces(opts.pieces ?? DEFAULT_PIECES, …)`. The
//        compile always runs, but on the component's OWN shipped list, which
//        `probe-tracked-roster.mjs` compiles through the real compiler so the
//        claim "the default is clean" is measured rather than assumed.
//   'required' — the `<Coaster>` / `<TrackRide>` chassis wrappers: `pieces` is
//        mandatory, so these are the ONLY circuits that need a published §4.0
//        block copied verbatim.
export const PIECES_MODE = {
  Coaster: 'required',
  TrackRide: 'required',
  SplineCoaster: 'required',
  // guarded call sites — omitting `pieces` skips compileTrackPieces entirely
  LogFlume: 'conditional',
  RiverRapids: 'conditional',
  Chairlift: 'conditional',
  Bobsleigh: 'conditional',
  GoKarts: 'conditional',
  Monorail: 'conditional',
  // `opts.pieces ?? DEFAULT_PIECES` — always compiles, on its own default
  Bassline: 'default',
  DeepDrift: 'default',
  EmberWings: 'default',
  GearworksExpress: 'default',
  LavaTubeRun: 'default',
  MagmaRun: 'default',
  MagneticRide: 'default',
  MineTrainCoaster: 'default',
  MoonlitBarge: 'default',
  OceanTunnelSlide: 'default',
  ReefRacer: 'default',
  WyrmsHollow: 'default',
  // no `pieces` prop at all — the component builds its own rig
  PaddleBoats: 'none',
  GhostTrain: 'none',
  HauntedMansion: 'none',
  ObservationTower: 'none',
  Helicycles: 'none',
  MotionSimulator: 'none',
};

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

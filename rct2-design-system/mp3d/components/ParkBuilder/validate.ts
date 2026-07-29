// ---------------------------------------------------------------------------
// ParkBuilder/validate.ts — validatePark, the park ACCEPTANCE GATE, plus its
// report/input types: accessibility, street grid, terrain vibe, footprint OBB
// sweep, coaster legality + crash replay, track-corridor SAT sweep,
// GameManager sim smoke, budget + determinism.
//
// Everything here is re-exported by ../ParkBuilder — import from
// '../ParkBuilder', never from this file directly.
// ---------------------------------------------------------------------------

import * as THREE from 'three';
import { buildRouting } from '../PathNetwork';
import type { PeakZone } from '../TerrainKit';
import { validateSpline, checkCoasterDesign, coasterBankCap, replayCoasterForces } from '../SplineRideKit';
import type { CoasterType } from '../SplineRideKit';
import { segDist, waterGridStep } from './climate';
import { SECOND_WATER_MIN_FRAC, measurePlotRelief, waterBodyGapMin, waterBodyTarget } from './composition';
import type { ReliefFloorReport } from './composition';
import { obbOverlap, pathClearance, vertClear, OVERFLY_CLEAR } from './placement';
import type { ParkFootRect } from './placement';
import { WORLD_PRESET_IDS } from './worlds';
import type { WorldAudit } from './worlds';

// ---------------------------------------------------------------------------
// validatePark — the park ACCEPTANCE GATE. Every agent-composed park must
// pass before it "opens":
//   0. build-time LINTS / AUTO-FIXES (round-6) — `report.warnings` lists every
//      event the wrappers recorded (a flipped queueDir, a hoisted causeway, a
//      corridor shift, a relocated exit hut, a trimmed lane, a coaster stat
//      warning) and the ones rules/park-generation.md §0 calls FATAL become
//      real `'autofix'` failures. An auto-fix that silently rescues a bad
//      design must NEVER let the gate return ok — that is what shipped
//      round-6 parks over a flipped queue lane and a 2.2-u causeway
//   a. accessibility — the registered park gate routes to EVERY queue tail,
//      and the gate spawn stands AT the park boundary (within ~1.2 u of the
//      terrain edge — a gate buried inside the park reads broken)
//   a2. street grid — with `gridNodeCount`, any RENDERED street edge that
//      runs diagonally FAILS (RCT2 paths are N/S/E/W; spur attaches exempt)
//   a3. hard BOUNDS (round-6) — every audited footprint rect's SWEPT corners
//      and every GameManager-derived queue-tail / exit attach node must stay
//      inside ±size/2 (the manager derives the lane rect + spur nodes from a
//      registration, and those used to be able to hang off the plot)
//   b. terrain vibe — exactly ONE flood-filled water body, a flat dry front
//      apron, no structure footprint parked on an authored hill OR standing
//      in the water (pads/lanes/huts must clear waterLevel + 0.05), and —
//      when the caller passes `probeViolations` — an unsatisfied composition
//      probe ("no terrain seed fully satisfied the rules") is a hard FAIL
//   b1. TERRAIN FLATTENED (2026-07-25) — `waterRePicked`'s twin for the GROUND:
//      a park whose own `keepDry`/`coasterPts` guards crushed the ranges its
//      seed drew, landing the BUILT relief/stdH below the published §1 band, is
//      reported BY NAME — which range, cut from what to what, by WHICH guard
//      cells. FATAL only when the loss is self-inflicted AND the result is below
//      the band (see the check for why either alone stays a warning)
//   b3. WORLD THEME COHERENCE (worlds) — given `worldAudit`, every THEMED
//      catalog piece must stand inside a world of its OWN theme: a lava
//      fissure in the disco street is a `crossTheme` WARNING (never a hard
//      fail — see the check for the three reasons). Neutral pieces (benches,
//      bins, generic trees, paths, stock flat rides) are legal everywhere
//   b2. planted SCENERY (round-6) — every <Scenery>/<Placed> footprint must
//      stand on DRY ground and OUT of the rendered path slabs (plaza
//      dressing exempt): a statue in the main street / a willow in the river
//   c. footprints — OBB SAT sweep over every audited rect (no overlaps) +
//      any residual placeAccess collision (manager.accessAudit) is a FAIL. A
//      ride colliding with ITSELF (own queue lane / entrance hut on its own
//      boardPoint pad) also prints the REQUIRED tail→pad-centre distance and
//      the nearest legal pad cell (§0.4), the way padOnStreet prints its cell
//   d. coaster legality — a compileTrackPieces `fatal` circuit is ONE hard
//      failure; otherwise checkCoasterDesign clean + IN-BOUNDS (every sampled
//      track point within ±size/2 + 0.4) + validateSpline ok + CRASH-FREE:
//      the energy-paced lateral-G profile stays under the 1.5 g no-upstop
//      derail guard with a 15% margin (default parks never crash)
//   d3. BLOCKERS (round-6) — guests cannot walk through solid objects, so no
//      RENDERED street edge may pass through a registered blocker (fountain
//      basins, ride bodies/pads, shop bodies, restroom huts, queue railings,
//      `<Fence>` runs — sampled every ~0.3 u; access spurs are exempt), and
//      every ride's queue tail must stay reachable from the gate once the
//      blockers are respected. Fence a boundary with a GATEWAY where a street
//      crosses it (two runs with a gap, or `<Fence inset>`)
//   e. sim smoke — steps manager.update max(60, 2.5·maxRideDuration + 20)
//      sim-s at a fixed dt (long rides can complete a cycle; rideDuration
//      > 14 draws a "keep acceptance rides ≤ ~12 s" warning): ≥1 completed
//      ride cycle, no stuck walker (position variance guard), queues advance
//   f. budget + determinism — mesh count against an AREA-SCALED budget
//      (~2500 per 16² of plot; over-budget is a console WARNING, not a hard
//      fail — LOD/fog keep big parks drawable) and (when a `rebuild`
//      callback is given) a double-build scene hash match
// Deterministic; the smoke run advances the manager's sim clock (keep render
// time monotonic afterwards — add the report's `simSeconds` to your updater
// clock, as <Park> and the ParkBuilder example preview do).
// ---------------------------------------------------------------------------

/**
 * MINIMUM sim seconds the smoke check steps the manager through (the real
 * window scales with the longest registered rideDuration — see the report's
 * `simSeconds`).
 *
 * 60 → 85 on 2026-07-28, WITH THE BOARDING-QUIET DEPARTURE RULE
 * (`GameManager/rideFsm.ts`, `GameManager/Context.md` "THE DEPARTURE RULE").
 * DO NOT PUT IT BACK TO 60 — the old value was calibrated against a departure
 * rule that no longer exists. A ride used to bolt the instant its first guest
 * sat down (its arrival-anchored `maxWait` had already expired while the
 * platform stood empty), so the first cycle of a park was as fast as the sim
 * could make it. A ride now holds the doors ~10-12 s for a second guest, which
 * is deliberate, and every first cycle lands that much later.
 *
 * THE NUMBER IS MEASURED, AND IT IS SET BY THE CROWDED CASE, NOT THE 12-GUEST
 * ONE. `probe-sim-reach.mjs` (12 guests, capacity 8, `rideDuration` 10, size 192)
 * puts the first completed cycle at 62.0 s for a queue tail 15 u from the gate
 * and 68.5 s at 20 u — §0.3's published floor and hard limit; both FAIL at 60 s.
 * But `probe-gate-stream.mjs gate --guests=12,22,50,75,100 --d=6,15,18,20,24` is
 * the binding measurement, because MORE GUESTS NOW MAKE THE FIRST CYCLE LATER,
 * not sooner (each boarding re-arms the quiet window, so a crowd stretches the
 * dwell to the `maxWait` cap — the exact reverse of the pre-2026-07-28 behaviour
 * §0.3 used to record). Worst cell measured at each distance, over 12/22/50/75/100
 * guests, arrivals off and on:
 *
 *     6 u 55.5 s   15 u 73.5 s   18 u 74.5 s   20 u 77.5 s   24 u 82.0 s
 *
 * At 85 s the published 15-u floor keeps **11.5 s** of margin in its worst crowd
 * and the 20-u limit **7.5 s**; every cell above passes. Compare the old rule at
 * 60 s: the same 15-u floor measured 60.0 s at 22 guests, i.e. **0.0 s of margin
 * — the floor §0.3 published was already knife-edge**. 80 s would leave the floor
 * only 6.5 s, and the observed chaotic spread at a FIXED distance across crowd
 * sizes is ~10 s (15 u reads 60.0/72.0/73.5/63.0/72.0), so a margin under that
 * spread is not a margin. A false `sim` FAIL costs a whole park round; 25 extra
 * sim-s of a headless loop costs milliseconds — measured with `probe-perf.mjs`
 * (which reads `<Park>`'s own `[Park] perf: … validate` figure): `demo-ref`
 * 84 → 105 ms, `arch-ref` (a 128-plot park) 114 → 171 ms. The 42 % longer loop
 * is ~57 ms on the park that costs the most.
 *
 * Lowering this instead of widening it would have shrunk the documented reach
 * from 15 u to 12 u — protecting a number by forbidding parks that are still
 * perfectly buildable.
 */
export const SIM_SMOKE_SECONDS = 85;
const MESH_BUDGET = 2500;
const CRASH_MARGIN = 0.85; // worst lateral G must stay under 1.5 g × this
/** composed water area vs its pinned §1 SEED TABLE row: the band inside which
 *  the shoreline is still where the row says it is. Log-symmetric about
 *  parity — a 25% shortfall and a 33% surplus are the same multiplicative
 *  distance — and measured against the corpus (see the water re-pick check). */
const WATER_SHRUNK = 0.75;
const WATER_GREW = 1 / 0.75; // 1.333…

/** §0-FATAL lint kinds the GATE promotes on its own, whatever `fatal` flag the
 *  reporter passed. Some lints are recorded by code that cannot know the §0
 *  policy (the <Coaster> wrapper just forwards the compiler's stat-gate
 *  warnings), so the policy lives HERE with the gate.
 *
 *  `coaster:shortDrop` (round-6): rules/park-generation.md §0/§4 call a
 *  `shortDrop` warning FATAL — a first drop under RCT2's 0.9-u gate HALVES
 *  excitement/intensity/nausea (RideRatings.cpp:1318), so the coaster opens as
 *  a ride nobody rates. Every §4 archetype publishes lift ≥ 1.0 precisely so
 *  this can be a hard failure. NOT promoted: `coaster:shortLength` (a short
 *  circuit is a deliberate choice for a kiddie coaster) and `laneTrim` (no
 *  threshold separates a legitimate trim from a starved queue). */
const FATAL_LINT_KINDS = new Set<string>(['coaster:shortDrop']);

export interface ParkValidationFailure {
  check:
    | 'accessibility'
    | 'terrain'
    | 'paths'
    | 'footprints'
    | 'coaster'
    | 'corridor'
    | 'sim'
    | 'budget'
    | 'determinism'
    | 'bounds'
    | 'scenery'
    | 'autofix'
    | 'blockers';
  detail: string;
}
/** a build-time LINT / AUTO-FIX event (round-6 safeguard) — see `lints` */
export interface ParkValidationWarning {
  kind: string;
  detail: string;
  /** rules/park-generation.md §0's FATAL-WARNINGS POLICY: promoted into
   *  `failures` (check `'autofix'`) so the gate cannot return ok on it */
  fatal: boolean;
}
export interface ParkValidationReport {
  ok: boolean;
  failures: ParkValidationFailure[];
  /** EVERY build-time lint / auto-fix event the park emitted (round-6
   *  safeguard). An auto-fix that silently rescued a bad design used to be
   *  console-only and `ok` stayed true; now every event is reported here and
   *  the §0-fatal ones also appear in `failures`. An EMPTY array is the only
   *  clean result — a park with warnings needs re-planning even when `ok`. */
  warnings: ParkValidationWarning[];
  /** sim seconds the smoke run actually stepped — shift your render clock by
   *  this (scales with the longest registered rideDuration; ≥ SIM_SMOKE_SECONDS) */
  simSeconds: number;
  /** WALL-CLOCK ms the whole gate took (2026-07). The gate is the single
   *  most expensive thing a `<Park>` does at mount — the flood-fill, the OBB
   *  sweep, the corridor sweep and the sim smoke run all scale with the plot —
   *  so plot-size changes need a number, not a guess. `<Park>` logs it on the
   *  perf line. */
  ms: number;
}


/** structural view of the createGameManager return (only what's validated) */
export interface ValidateParkManager {
  update(time: number, dt: number): void;
  /** HEADLESS SWITCH (optional — older managers do not have it). The smoke run
   *  below steps the WHOLE population ~2550 times with nothing rendered in
   *  between, and at a 500-guest opening crowd the guests' VISUAL half (the pose
   *  layer plus the instanced crowd's matrices) was the dominant cost of this
   *  gate — 163 million array writes for frames that never happen. Everything
   *  with a sim consequence keeps running either way; see GameManager/crowd.ts
   *  `setVisuals` for exactly what is gated. */
  setVisuals?(on: boolean): void;
  stats(): { riddenTotal: number; activeGuests: number };
  guests(): { id: number; state: string; position: [number, number, number]; hidden?: boolean; gone?: boolean }[];
  rides(): { name: string; status: string; queue: number; rideDuration?: number }[];
  accessPoints?(): {
    entranceNode: number;
    rides: {
      name: string;
      queueNode: number;
      exitNode: number;
      // ---- ADDITIVE: the RCT2 entrance/exit LAYOUT facts (check a4) ----
      /** entrance hut centre + its OUTWARD doorway facing (== the queue axis) */
      entranceAt?: [number, number];
      entranceDir?: [number, number];
      /** exit hut centre + its OUTWARD doorway facing */
      exitAt?: [number, number];
      exitDir?: [number, number];
      /** length of the ride's EXIT PATH (0 = none — RCT2's STR_EXIT_NOT_CONNECTED) */
      exitLaneLen?: number;
      /** where that path meets the street */
      exitLaneEnd?: [number, number];
      /** ADDITIVE — EVERY PLATFORM of a multi-station ride (RCT2 rides own a
       *  station ARRAY, `ride/Ride.h:404`). Index 0 repeats the fields above.
       *  Absent on a manager older than this check. Each entry is gated
       *  INDIVIDUALLY by a4b below: one platform guests cannot reach is one
       *  station that does not exist. */
      stations?: {
        idx: number;
        label: string;
        queueNode: number;
        exitNode: number;
        exitLaneLen: number;
        exitAt?: [number, number];
        boardPoint?: [number, number, number];
      }[];
    }[];
  };
  footprints?(): ParkFootRect[];
  /** registered stalls — the track-corridor sweep audits their footprints */
  stalls?(): { name: string; anchor: [number, number, number]; dir: [number, number] }[];
  /** residual placeAccess collisions — promoted to footprint FAILs */
  accessAudit?(): { a: string; b: string; msg: string }[];
  /** resolved gate world points — the gate-at-edge check */
  entrancePoints?(): { spawn: [number, number, number]; arch: [number, number, number] } | null;
  /** registered SOLID obstacles (round-6 safeguard): fountains, ride bodies,
   *  shop bodies, restroom huts, queue railings and `<Fence>` runs. The
   *  blockers gate fails a street laid through one. */
  blockers?(): {
    label: string;
    kind: string;
    owner: string | null;
    rect?: { cx: number; cz: number; hx: number; hz: number; yaw: number };
    circle?: { cx: number; cz: number; r: number };
  }[];
  /** is a path edge walkable? (false = its span crosses a blocker; access
   *  spurs always are) — used for the queue-tail reachability re-check */
  edgeWalkable?(a: number, b: number): boolean;
}

export interface ValidateParkInput {
  /** the SHARED path graph (with the manager's logical attach nodes) */
  net: { nodes: [number, number][]; edges: [number, number][] };
  /** routing over `net` — built fresh when omitted */
  routing?: ReturnType<typeof buildRouting>;
  manager: ValidateParkManager;
  terrain: {
    heightAt: (x: number, z: number) => number;
    waterLevel: number;
    size: number;
    /** authored hill peaks — structures must stay off their flanks */
    peaks?: PeakZone[];
    /** entrance-apron rect [x0, x1, z0, z1]; default = the front forecourt */
    apron?: [number, number, number, number];
  };
  /** tracked coasters to re-check (control points as-built, world space).
   *  `fatal` (set by compileTrackPieces' fatal guard) short-circuits the
   *  legality checks into ONE hard failure. `name` (the registered ride name)
   *  lets the track-corridor sweep exempt the ride's OWN pad/lane/huts —
   *  without it the corridor is only checked against stalls + street edges. */
  coasters?: { points: [number, number, number][]; type?: CoasterType; bank?: number; fatal?: string; name?: string }[];
  /** node count of the RENDERED street lattice (before routing.attach added
   *  logical spur nodes). When given, any street edge between two lattice
   *  nodes that runs diagonally FAILS (RCT2 paths run N/S/E/W) — <Park>
   *  passes it automatically. Spur edges past this count are exempt. */
  gridNodeCount?: number;
  /** audited footprint rects — defaults to manager.footprints() */
  footprints?: ParkFootRect[];
  /** street slab walking level — the corridor sweep's grade-crossing check
   *  measures track clearance above it (default: terrain height at the edge
   *  midpoint). <Park> passes paths.pathY automatically. */
  pathY?: number;
  /** parkComposition's probe outcome (`comp.report.violations`) — non-empty
   *  means NO terrain seed fully satisfied the composition rules for this
   *  park; promoted from a console warning to a hard terrain FAIL (round-2
   *  safeguard). <Park> passes it through automatically. */
  probeViolations?: string[];
  /** the plaza rects `[cx, cz, w, d]` the path network rendered — decoration
   *  INSIDE a plaza slab is legal RCT2 dressing, so the scenery-vs-path audit
   *  exempts them. <Park> passes `paths.plazas` automatically. */
  plazas?: [number, number, number, number][];
  /** rendered street slab width (default 1.1 — the <Paths> default) */
  pathWidth?: number;
  /** PLANTED footprints (scenery pieces, trees, props) with their
   *  ground-contact radius — audited for DRYNESS and for standing in a walked
   *  path slab (round-6 safeguard). <Park> passes <Scenery>/<Placed>
   *  registrations automatically. */
  planted?: { label: string; x: number; z: number; r: number }[];
  /** the water the park PLANNED AGAINST — the pinned §1 SEED TABLE row for its
   *  (seed, climate) at this size, or a re-probe of `parkComposition`. The gate
   *  flood-fills the built heightfield anyway, so it can tell you when the
   *  composition RE-PICKED its water candidate and your "lakeside" district
   *  lost its lake (wave-9 P4). `<Park>` fills this in automatically for the
   *  16 published size-128 rows.
   *
   *  `bodies` is a LIST since 2026-07 (the composition composes two): DOMINANT
   *  FIRST, one entry per composed body. The gate pairs the expected bodies with
   *  the measured ones by nearest centroid (not by index) so a seed whose two
   *  bodies merely swapped ranks is not reported as a re-pick. */
  expectWater?: { bodies: { centre: [number, number]; areaUnits2?: number }[]; source?: string };
  /** the `<Terrain keepDry>` list the composition was GUARDED with. A guard
   *  cell inside the pinned row's wet box is what makes the composer re-pick
   *  its water, so the gate needs the list to name the offending cell in a
   *  `waterRePicked` failure (wave-11 P2). `<Park>` passes it automatically. */
  keepDry?: [number, number][];
  /** THE LANDFORM the park PLANNED AGAINST (2026-07-25) — the counterpart of
   *  `expectWater` for the GROUND. A park's own guard list can flatten its own
   *  terrain: `capPeakForCells`/`capPeakForCoaster` shave (and used to ERASE)
   *  any range the layout stands on, and nothing measured it, so a park could
   *  compose itself below every published §1 row and ship `ok: true` over a
   *  flat green field. The `terrainFlattened` check below reads:
   *   - `floor`: the composition's OWN audit (`comp.report.reliefFloor`) — how
   *     much of the seed's uncapped relief survived the guards, and which peaks
   *     (with the guard cells that forced each) it cost. Null on ≤48 plots and
   *     unguarded compositions, neither of which composes differently.
   *   - `rowRelief`/`rowStdH`: the pinned §1 row's UNGUARDED measurements.
   *   - `bandRelief`/`bandStdH`: the published §1 BAND FLOOR at this size —
   *     `SEED_TABLE_128_BAND` at 128, absent at other sizes (where the gate
   *     therefore only reports the self-inflicted loss, never a hard failure).
   *  `<Park>` fills all of this in automatically. */
  expectTerrain?: {
    floor?: ReliefFloorReport | null;
    rowRelief?: number;
    rowStdH?: number;
    bandRelief?: number;
    bandStdH?: number;
    source?: string;
  };
  /** THE §0 HEADER'S ROSTER CLAIM, machine-readable (wave-10 P3). Give NAMES
   *  rather than counts wherever you can — then the warning can say WHICH
   *  claimed ride never registered. `categories` is only sanity-bounded here
   *  (see the roster block): the RCT2 category map lives in the eval harness,
   *  not in the design system. `<Park roster={...}>` passes this through. */
  roster?: { rides?: number | string[]; stalls?: number | string[]; categories?: number | string[] };
  /** THE WORLD THEME COHERENCE AUDIT (`auditWorldThemes(root, worlds)`) — the
   *  declared `<World>` regions, the per-world build-out counts and every
   *  themed piece resolved against them. `<Park>` runs it and passes it here;
   *  omit it (or declare no worlds) and the whole check is skipped, which is
   *  why every park that predates the world layer is unaffected. Findings are
   *  WARNINGS, not failures — see check b3 for why. */
  worldAudit?: WorldAudit;
  /** build-time lint / auto-fix events (round-6 safeguard): every event is
   *  echoed into `report.warnings`, and `fatal: true` ones become hard
   *  `'autofix'` failures — an auto-fix must never silently rescue a design
   *  rules/park-generation.md §0 calls fatal. <Park> passes them through. */
  lints?: ParkValidationWarning[];
  /** the park's scene group (mesh budget + determinism hash) */
  group?: THREE.Group;
  /** rebuilds the park into a throwaway group for the determinism hash
   *  (MUST build with validation off, so the check can never recurse) */
  rebuild?: () => THREE.Group;
  simSeconds?: number;
}

/** deterministic scene hash: object types + transforms + vertex counts, in
 *  traversal order (FNV-1a) — two builds of the same seed must match */
function hashGroup(root: THREE.Object3D): number {
  let h = 2166136261 >>> 0;
  const mix = (n: number) => {
    h ^= n >>> 0;
    h = Math.imul(h, 16777619) >>> 0;
  };
  const q = (v: number) => Math.round(v * 10000) | 0;
  root.traverse((o) => {
    mix(o.type.length * 131 + o.type.charCodeAt(0) * 7);
    mix(q(o.position.x));
    mix(q(o.position.y));
    mix(q(o.position.z));
    mix(q(o.rotation.x));
    mix(q(o.rotation.y));
    mix(q(o.rotation.z));
    mix(q(o.scale.x * 0.001 + o.scale.y + o.scale.z * 1000));
    const m = o as THREE.Mesh;
    if (m.isMesh && m.geometry) {
      const posAttr = (m.geometry as THREE.BufferGeometry).getAttribute('position');
      if (posAttr) mix(posAttr.count);
    }
  });
  return h;
}

function disposeDeep(root: THREE.Object3D) {
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.geometry && !m.geometry.userData?.shared) m.geometry.dispose();
    if (m.material) (Array.isArray(m.material) ? m.material : [m.material]).forEach((mm) => mm.dispose());
  });
}

/**
 * Run every acceptance check against a composed park. Returns `{ ok,
 * failures }` — a park with failures must be re-planned, not shipped. NOTE:
 * the sim smoke check advances the manager ~`simSeconds` of sim time; keep
 * the render clock monotonic afterwards (add the offset to your updater
 * clock) so nothing keyed to simTime runs backwards.
 */
export function validatePark(t: typeof THREE, park: ValidateParkInput): ParkValidationReport {
  const failures: ParkValidationFailure[] = [];
  const fail = (check: ParkValidationFailure['check'], detail: string) => failures.push({ check, detail });
  let simSecondsRun = 0;
  const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now();

  // ---- 0. build-time LINTS / AUTO-FIXES (round-6 safeguard) -----------------
  // §0's FATAL-WARNINGS POLICY. Before round 6 a queueDir auto-flip, a
  // corridor shift or a hoisted causeway was a console.warn the gate never
  // saw — parks shipped `ok: true` over auto-fixes that had rescued a layout
  // the author was supposed to re-plan. Every recorded event is reported, and
  // the fatal ones fail the park here.
  // FATAL_LINT_KINDS is applied on top of the reporter's own flag: the gate
  // owns the §0 policy, so a lint recorded as non-fatal by a wrapper that
  // cannot know the policy (coaster:shortDrop) still fails the park here.
  const warnings: ParkValidationWarning[] = (park.lints ?? []).map((l) => ({
    kind: l.kind,
    detail: l.detail,
    fatal: !!l.fatal || FATAL_LINT_KINDS.has(l.kind),
  }));
  warnings.filter((w) => w.fatal).forEach((w) => fail('autofix', `[${w.kind}] ${w.detail}`));
  /** record a lint the GATE ITSELF discovered (wave-9) — same channel as the
   *  build-time lints above, so §0's FATAL-WARNINGS POLICY applies unchanged */
  const warn = (kind: string, detail: string, fatal = false) => {
    warnings.push({ kind, detail, fatal });
    if (fatal) fail('autofix', `[${kind}] ${detail}`);
  };

  // ---- 0b. THE HEADER'S ROSTER CLAIM (wave-10 P3) ---------------------------
  // §0.16 makes every park file publish a ROSTER line in its header, and until
  // wave 10 nothing checked it. Round 9's park A claimed "9 registered rides,
  // 5 categories" and registered EIGHT in THREE categories — the source even
  // carried the comment `/* Monorail dropped from the roster to keep the
  // corridor sweep trivial */`, so the roster line was written from the PLAN
  // and never revisited after the plan changed. An overstated header is not a
  // typo: every downstream check (thrill mix, category balance, ride count) is
  // scored off what REGISTERED, so the claim is the one number a reader trusts
  // and cannot verify. `<Park roster={...}>` restates it machine-readably and
  // this block compares it with the registry.
  //
  // WHAT IS AND IS NOT ENFORCEABLE HERE. Ride and stall claims are exact — the
  // registry knows every name. RIDE CATEGORIES ARE NOT: the design system has
  // no category table (the RCT2 gentle/thrill/water/transport/dark mapping
  // lives in `harness/park-eval/catalog.mjs`, keyed by catalog component), so
  // the gate can only check a category claim against the bound it CAN see —
  // you cannot represent more categories than you have rides. §0.16 therefore
  // also requires the roster line to be WRITTEN LAST, from the registered
  // list, and `probe.json`'s `rideRoster.categoryCount` is what audits it.
  if (park.roster) {
    const claim = park.roster;
    const registeredRides = park.manager.rides().map((r) => r.name);
    const registeredStalls = (park.manager.stalls?.() ?? []).map((s) => s.name);
    const audit = (what: string, claimed: number | string[] | undefined, actual: string[]) => {
      if (claimed === undefined) return;
      if (Array.isArray(claimed)) {
        const missing = claimed.filter((n) => !actual.includes(n));
        if (missing.length)
          warn(
            'rosterOverstated',
            `the header claims ${claimed.length} ${what} but ${missing.length} of them never registered: ${missing
              .map((n) => `"${n}"`)
              .join(', ')} — ${actual.length} registered (${actual.map((n) => `"${n}"`).join(', ') || 'none'}). Re-write the §0 roster line FROM the registration (§0.16); a claim the park does not honour misreports every roster-scored axis`,
          );
      } else if (actual.length < claimed)
        warn(
          'rosterOverstated',
          `the header claims ${claimed} ${what} and the park registered ${actual.length} (${actual
            .map((n) => `"${n}"`)
            .join(', ') || 'none'}) — re-write the §0 roster line FROM the registration (§0.16). Pass \`roster={{ ${what}: [...names] }}\` instead of a count and this check names the missing ones`,
        );
      // wave-12 P0: the OTHER direction was silent. Round 11's park claimed
      // `stalls: 6` and registered 13 — not an overclaim, but the same §0.16
      // defect (the line was never re-counted after the plan changed), and it
      // misreports the roster axis just as surely as an overclaim does. Any
      // count claim that disagrees with the registry — either way — is one
      // warning, worded for the direction it actually went.
      else if (actual.length > claimed)
        warn(
          'rosterOverstated',
          `the header claims ${claimed} ${what} but the park registered ${actual.length} (${actual
            .map((n) => `"${n}"`)
            .join(', ') || 'none'}) — UNDERSTATED, not overstated: the §0 roster line was not re-counted after the plan changed. Re-write it FROM the registration (§0.16)`,
        );
    };
    audit('rides', claim.rides, registeredRides);
    audit('stalls', claim.stalls, registeredStalls);
    if (claim.categories !== undefined) {
      const nCat = Array.isArray(claim.categories) ? claim.categories.length : claim.categories;
      // The design system has no RCT2 gentle/thrill/water/transport/dark
      // category table (that map lives in `harness/park-eval/catalog.mjs`),
      // so the true "represented categories" count is out of reach here —
      // but a claim cannot represent MORE categories than there are DISTINCT
      // ride KINDS registered (two rides of the same catalog kind are always
      // the same category), and that count IS visible: every `composableRide`
      // ride's built group carries `userData.dsComponent` (`tagComponent`,
      // Park/composable.tsx). Round 11's park claimed 5 categories from 7
      // rides across only 3 — the old ride-COUNT bound
      // (nCat > registeredRides.length, 5 > 7 = false) let it through
      // silently; the KIND bound is strictly tighter. Trust it only when
      // EVERY registered ride got tagged (a hand-rolled ride that skips the
      // `composableRide` factory — FerrisWheel, Teacups — carries no tag, and
      // an undercount there would flag a legitimate claim), else fall back to
      // the ride-count bound rather than risk a false positive.
      let distinctKinds = registeredRides.length;
      if (park.group) {
        const kinds = new Set<string>();
        let tagged = 0;
        park.group.traverse((o) => {
          const ud = (o as THREE.Object3D).userData as { dsComponent?: string; dsClass?: string };
          if (ud && ud.dsClass === 'ride' && ud.dsComponent) {
            tagged += 1;
            kinds.add(ud.dsComponent);
          }
        });
        if (tagged >= registeredRides.length && kinds.size > 0) distinctKinds = kinds.size;
      }
      if (nCat > distinctKinds)
        warn(
          'rosterOverstated',
          `the header claims ${nCat} ride categories from ${distinctKinds} distinct ride kind(s) (${registeredRides.length} ride(s) registered) — impossible, two rides of the same catalog kind cannot be two categories. (The gate still cannot verify the category claim exactly: the RCT2 category map lives in the eval harness, not the design system — audit the final number against probe.json's rideRoster.categoryCount and write the line from the registration, §0.16)`,
        );
    }
  }

  // ---- f. budget + determinism FIRST (the hash must see the pre-sim scene) --
  if (park.group) {
    let meshes = 0;
    park.group.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) meshes += 1;
    });
    // the mesh budget scales ~linearly with plot AREA (the classic ~2500 was
    // computed for a 16² plot — the default 128 plot earns 64×) and exceeding it
    // is a PERF WARNING, not a hard fail: the ride runtime's LOD tiers +
    // culling fog keep expansive parks drawable, but a park past its budget
    // should shed decoration density rather than lean on them.
    const S0 = park.terrain.size;
    const meshBudget = Math.round(MESH_BUDGET * Math.max(1, (S0 * S0) / 256));
    if (meshes > meshBudget)
      console.warn(
        `[validatePark] ${meshes} meshes exceed the ~${meshBudget} budget for a size-${S0} park (≈${MESH_BUDGET} per 16² of plot area) — thin the decoration; LOD/fog will carry it, but frame cost scales with what you mount`,
      );
    if (park.rebuild) {
      const h1 = hashGroup(park.group);
      const g2 = park.rebuild();
      const h2 = hashGroup(g2);
      disposeDeep(g2);
      if (h1 !== h2) fail('determinism', `double-build hash mismatch (${h1.toString(16)} vs ${h2.toString(16)}) — a Math.random/Date.now leak?`);
    }
  }

  // ---- a. accessibility: gate -> every queue attach --------------------------
  const routing = park.routing ?? buildRouting(park.net);
  const access = park.manager.accessPoints?.();
  if (!access) {
    fail('accessibility', 'manager exposes no accessPoints() — cannot audit gate->queue routes');
  } else if (access.entranceNode < 0) {
    fail('accessibility', 'no registered park entrance (registerParkEntrance) — guests have no gate');
  } else {
    access.rides.forEach((r) => {
      if (r.queueNode < 0) {
        fail('accessibility', `${r.name}: queue tail never attached to the path graph`);
      } else if (r.queueNode !== access.entranceNode && routing.route(access.entranceNode, r.queueNode).length < 2) {
        fail('accessibility', `gate cannot route to the ${r.name} queue tail`);
      }
    });
  }

  // ---- a4. THE EXIT SIDE OF THE STATION (the RCT2 entrance/exit layout) -----
  //
  // Until this check existed the gate audited only HALF of a ride's access: a
  // queue path INTO the entrance. RCT2 gives a ride TWO connections of two
  // different kinds, and the second one is a real mechanic, not decoration:
  //
  //   * a guest finishing a ride is put down on the tile IMMEDIATELY OUTSIDE the
  //     exit (`updateRidePrepareForExit`, Guest.cpp:4412-4452), and
  //     `updateRideLeaveExit` (Guest.cpp:5092-5140) then enters
  //     `PeepState::falling` and looks for a `PathElement` on that tile;
  //   * with no path there `Peep::UpdateFalling` (Peep.cpp:781-890) drops them
  //     onto the bare TERRAIN — they walk on, lost — or DROWNS them if the tile
  //     is water (Peep.cpp:831-854);
  //   * and for as long as the ride is OPEN the park carries a recurring red
  //     news item, `STR_EXIT_NOT_CONNECTED`: "<ride> has no path leading from
  //     its exit! Construct a path from the ride exit" (Ride.cpp:2076; the test
  //     is `RideEntranceExitIsReachable` Ride.cpp:2035 → `MapCoordIsConnected`
  //     Map.cpp:707-741, which looks at exactly that outside tile).
  //
  // SEVERITY — and the split is RCT2's own, not an invention:
  //
  //   FAIL, `accessibility`, for a MISSING or UNROUTABLE exit path. RCT2 blocks
  //     `Ride::open` outright when an entrance or exit does not EXIST
  //     (`RideCheckForEntranceExit`, Ride.cpp:2366-2412 → STR_EXIT_NOT_YET_BUILT)
  //     and permanently flags one that exists but is unpathed. Here the second
  //     case is strictly worse than in RCT2: this sim has no terrain-walking
  //     `falling` state, so a guest whose exit spur never reached the network
  //     is left standing off-graph — which the `sim` gate already reports as a
  //     stuck walker, two checks later and without naming the cause. A ride
  //     nobody can walk away from is a broken park, so it fails here, by name,
  //     with the arithmetic. Exactly symmetric with "gate cannot route to the
  //     <ride> queue tail" above.
  //
  //   WARNING, `exitNotAdjacent`, for entrance and exit NOT on the same outward
  //     face. RCT2 provably does not enforce this: `RideStation` holds two
  //     independent `TileCoordsXYZD` (Ride.h:172-173) and NO code compares them
  //     — each is validated only against the station track
  //     (RideConstruction.cpp:1557-1592). A long station with the entrance at one
  //     end and the exit at the other is authentic RCT2. Failing it would condemn
  //     legal layouts, so it is reported, not failed — and §0's FATAL-WARNINGS
  //     POLICY still means a park carrying one needs re-planning before it ships.
  if (access) {
    access.rides.forEach((r) => {
      // `exitLaneLen === undefined` = a manager older than check a4 (or a mock):
      // nothing to audit. `0` = it reported one and there is no path.
      const laneLen = r.exitLaneLen;
      if (laneLen !== undefined && laneLen <= 0)
        fail(
          'accessibility',
          `${r.name}: NO EXIT PATH — its exit hut${
            r.exitAt ? ` at [${r.exitAt[0].toFixed(1)}, ${r.exitAt[1].toFixed(1)}]` : ''
          } faces${r.exitDir ? ` [${r.exitDir.map((v) => +v.toFixed(2)).join(', ')}]` : ''} with no street on that ray inside 9 u, so guests leaving the ride step onto bare ground. RCT2 calls this out by name for as long as the ride is open — STR_EXIT_NOT_CONNECTED, "has no path leading from its exit! Construct a path from the ride exit" (Ride.cpp:2076) — and a guest put down off the paving there falls to the terrain and wanders off lost (Guest.cpp:5092-5140 → Peep.cpp:781-890). FIX: put the exit on the SAME station face the queue comes off, one tile beside the entrance hut, so its path runs out beside the queue lane and meets the cross-street at the queue's own tail node (§0.4)`,
        );
      if (r.exitNode < 0) {
        if (laneLen === undefined || laneLen > 0)
          fail('accessibility', `${r.name}: exit never attached to the path graph — guests leaving the ride have no way back onto the network`);
      } else if (r.exitNode !== access.entranceNode && routing.route(r.exitNode, access.entranceNode).length < 2) {
        fail(
          'accessibility',
          `${r.name}: its exit path does not reach the rest of the park — no route from the exit spur back to the gate. A guest can ride it and then cannot leave (RCT2's own reachability test looks at exactly this, Ride.cpp:2035 → Map.cpp:707)`,
        );
      }
      // adjacency + same-outward-face — a WARNING, see the header above
      if (r.entranceAt && r.entranceDir && r.exitAt && r.exitDir) {
        const ed = r.exitDir;
        const qd = r.entranceDir;
        const dot = ed[0] * qd[0] + ed[1] * qd[1];
        const dxE = r.exitAt[0] - r.entranceAt[0];
        const dzE = r.exitAt[1] - r.entranceAt[1];
        const across = dxE * qd[0] + dzE * qd[1];
        const along = Math.abs(-dxE * qd[1] + dzE * qd[0]);
        if (!(dot > 0.966 && along <= 1.85 && Math.abs(across) <= 0.85))
          warn(
            'exitNotAdjacent',
            `${r.name}: entrance and exit are not the RCT2 pair. The entrance hut stands at [${r.entranceAt
              .map((v) => +v.toFixed(1))
              .join(', ')}] facing [${qd.map((v) => +v.toFixed(2)).join(', ')}]; the exit at [${r.exitAt
              .map((v) => +v.toFixed(1))
              .join(', ')}] facing [${ed.map((v) => +v.toFixed(2)).join(', ')}] — ${
              dot > 0.966
                ? `same face, but ${along.toFixed(2)} u along it and ${across.toFixed(2)} u out of it (the RCT2 pitch is ONE TILE, 1.2 u along, 0 out)`
                : `${((Math.acos(Math.max(-1, Math.min(1, dot))) * 180) / Math.PI).toFixed(0)}° apart, i.e. on DIFFERENT faces`
            }. Nothing in RCT2 forbids that — station.Entrance and station.Exit are independent (Ride.h:172-173) and each is checked only against the station track (RideConstruction.cpp:1584) — which is why this is a warning. But the entrance-beside-exit station is what a player builds and what makes one queue in / one path out legible: pass \`exit\`/\`exitDir\` on the RCT2 cell, or drop them and let the chassis derive it (§0.4)`,
          );
      }
    });

    // ---- a4b. EVERY PLATFORM OF A MULTI-STATION RIDE ------------------------
    //
    // An RCT2 `Ride` owns an ARRAY of stations (`std::array<RideStation,
    // kMaxStationsPerRide>`, ride/Ride.h:404) and the TRANSPORT rides are why:
    // `ride/rtd/transport/Monorail.h:19-84` sets neither
    // `RtdFlag::hasOneStation` nor `hasSinglePieceStation`. Checks a3/a4 above
    // audit the ride's OWN fields, i.e. platform 0 — so on a four-platform
    // park-spanning monorail three of its four boarding points went completely
    // unaudited. Each one owns a queue INTO its entrance and an ordinary
    // footpath OUT of its exit exactly as a single-station ride does
    // (`STR_EXIT_NOT_CONNECTED`, Ride.cpp:2076), and RCT2's own reachability
    // test looks at every station (Ride.cpp:2035 → Map.cpp:707). A platform
    // guests cannot walk to is not a station; a park-spanning monorail with an
    // unreachable platform is the "transport ride nobody can board" defect in a
    // subtler costume.
    access.rides.forEach((r) => {
      (r.stations ?? []).forEach((st) => {
        if (st.idx === 0) return; // platform 0 IS the ride's own fields (a3/a4)
        const who = `${r.name} platform ${st.idx} ("${st.label}")`;
        if (st.queueNode < 0)
          fail('accessibility', `${who}: its queue tail never attached to the path graph — nobody can join this platform's queue. Land the tail on a street node (§4.2's per-platform table)`);
        else if (st.queueNode !== access.entranceNode && routing.route(access.entranceNode, st.queueNode).length < 2)
          fail('accessibility', `${who}: the gate cannot route to its queue tail (node ${st.queueNode}) — the platform is registered but unreachable on foot`);
        if (st.exitLaneLen <= 0)
          fail(
            'accessibility',
            `${who}: NO EXIT PATH — its exit hut${
              st.exitAt ? ` at [${st.exitAt[0].toFixed(1)}, ${st.exitAt[1].toFixed(1)}]` : ''
            } faces no street inside 9 u, so a guest set down here steps onto bare ground. This is RCT2's STR_EXIT_NOT_CONNECTED (Ride.cpp:2076) and it applies PER STATION: every platform needs its own footpath out (§4.2 — the reference block's four exits all reach the street through planExitLane's join case, 6.01 u each)`,
          );
        if (st.exitNode < 0) {
          if (st.exitLaneLen > 0)
            fail('accessibility', `${who}: its exit never attached to the path graph — riders unloaded at this platform have no way back onto the network`);
        } else if (st.exitNode !== access.entranceNode && routing.route(st.exitNode, access.entranceNode).length < 2) {
          fail('accessibility', `${who}: its exit path does not reach the rest of the park — a guest carried to this platform is stranded there (Ride.cpp:2035 → Map.cpp:707)`);
        }
      });
    });
  }
  // gate AT the park boundary: guests spawn at the terrain edge — a gate
  // buried deep inside the park reads broken (round-1 safeguard)
  {
    const ep = park.manager.entrancePoints?.();
    if (ep) {
      const halfS = park.terrain.size / 2;
      const inset = halfS - Math.max(Math.abs(ep.spawn[0]), Math.abs(ep.spawn[2]));
      // tolerance is size-relative (one 1.2 lattice cell + slack on the
      // classic 16; proportionally looser on expansive plots where the
      // front apron itself is deeper)
      const edgeTol = Math.max(1.25, park.terrain.size * 0.025);
      if (inset > edgeTol)
        fail(
          'accessibility',
          `park gate spawn sits ${inset.toFixed(2)} u inside the terrain edge — the entrance must stand at the park boundary (within ~${edgeTol.toFixed(1)} u of the front edge)`,
        );
    }
  }

  // ---- a3. HARD BOUNDS on RUNTIME-DERIVED access geometry (round-6) ---------
  // §0.1 says every pad, hut and queue lane sits inside ±size/2. The old gate
  // only ever bounds-checked AUTHORED geometry (the coaster polyline, the
  // resolveQueueOrientation hut probe) — the GameManager DERIVES the lane
  // rectangle, its tail spur node and the exit spur node from the
  // registration, and those used to be able to hang metres off the plot with
  // the gate still returning ok (a capacity-10 rig against the back fence put
  // two queue tails at (-20.4, 24.77) and (-25.11, 9.6) on a size-48 park).
  // Audit the SWEPT rectangles (all four corners) plus every attach node.
  {
    const halfB = park.terrain.size / 2;
    const edge = halfB - 0.05; // the terrain edge, minus float slack
    const rects = park.footprints ?? park.manager.footprints?.() ?? [];
    rects.forEach((f) => {
      const ax: [number, number] = [Math.cos(f.yaw), -Math.sin(f.yaw)];
      const az: [number, number] = [Math.sin(f.yaw), Math.cos(f.yaw)];
      let worst = 0;
      for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]] as const) {
        const px = f.cx + ax[0] * f.hx * sx + az[0] * f.hz * sz;
        const pz = f.cz + ax[1] * f.hx * sx + az[1] * f.hz * sz;
        worst = Math.max(worst, Math.abs(px), Math.abs(pz));
      }
      if (worst > edge)
        fail(
          'bounds',
          `${f.label} sweeps out to ±${worst.toFixed(2)} u — OUTSIDE the ±${halfB.toFixed(1)} u plot (its far corner clears the terrain edge); move the ride inward or shorten/re-aim the lane`,
        );
    });
    const apB = park.manager.accessPoints?.();
    if (apB) {
      apB.rides.forEach((r) => {
        (
          [
            ['queue tail', r.queueNode],
            ['exit', r.exitNode],
          ] as const
        ).forEach(([what, ni]) => {
          if (ni < 0 || ni >= park.net.nodes.length) return; // unattached: check a. already failed it
          const [nx, nz] = park.net.nodes[ni];
          const worst = Math.max(Math.abs(nx), Math.abs(nz));
          if (worst > edge)
            fail(
              'bounds',
              `${r.name}: its ${what} access node sits at (${nx.toFixed(2)}, ${nz.toFixed(2)}) — OUTSIDE the ±${halfB.toFixed(
                1,
              )} u plot; guests would walk off the map (re-aim queueDir / move the ride off the fence)`,
            );
        });
      });
    }
  }

  // ---- a2. street grid: RCT2 paths run N/S/E/W (promoted from a lint warn) --
  if (park.gridNodeCount !== undefined) {
    const n0 = park.gridNodeCount;
    park.net.edges.forEach(([a, b], ei) => {
      if (a >= n0 || b >= n0) return; // routing.attach spur — logical only, exempt
      const adx = Math.abs(park.net.nodes[b][0] - park.net.nodes[a][0]);
      const adz = Math.abs(park.net.nodes[b][1] - park.net.nodes[a][1]);
      if (adx >= 0.01 && adz >= 0.01) fail('paths', `street edge ${ei} (${a}→${b}) is diagonal — RCT2 paths run N/S/E/W only`);
    });
  }

  // ---- a2b. DEAD SPINE NODES (wave-9 P4) ------------------------------------
  // `buildParkNet` already prunes a piece PORT nobody wired ("a spur
  // dead-ending in open grass"); the same test never ran on HAND-AUTHORED spine
  // nodes, so round 8 shipped a "restroom spur" and an "observation-tower spur"
  // with nothing whatever on them (and no restroom in the park at all). A
  // street node is DEAD when it has degree ≤ 1 over the FULL graph — the
  // manager's `routing.attach` spur edges included, so any node a ride queue,
  // exit, stall front or the gate hangs off is degree ≥ 2 by construction — and
  // no registered footprint/stall/blocker stands within a tile of it.
  if (park.gridNodeCount !== undefined && park.net.nodes.length) {
    const deg = new Uint16Array(park.net.nodes.length);
    park.net.edges.forEach(([a, b]) => {
      if (a >= 0 && a < deg.length) deg[a] += 1;
      if (b >= 0 && b < deg.length) deg[b] += 1;
    });
    const attached: [number, number][] = [
      ...(park.footprints ?? park.manager.footprints?.() ?? []).map((f) => [f.cx, f.cz] as [number, number]),
      ...(park.manager.stalls?.() ?? []).map((s) => [s.anchor[0], s.anchor[2]] as [number, number]),
      ...(park.manager.blockers?.() ?? []).map((b) =>
        b.rect ? ([b.rect.cx, b.rect.cz] as [number, number]) : b.circle ? ([b.circle.cx, b.circle.cz] as [number, number]) : ([NaN, NaN] as [number, number]),
      ),
    ].filter(([px]) => Number.isFinite(px));
    const gateNode = park.manager.accessPoints?.()?.entranceNode ?? -1;
    const dead: string[] = [];
    for (let i = 0; i < park.gridNodeCount && i < park.net.nodes.length; i += 1) {
      if (deg[i] > 1 || i === gateNode) continue;
      const [nx, nz] = park.net.nodes[i];
      // 2.4 u = two lattice cells: a pad/hut/stall legitimately sits a cell or
      // two off the node it serves, and anything further is not "on" this node
      if (attached.some(([px, pz]) => Math.hypot(px - nx, pz - nz) <= 2.4)) continue;
      dead.push(`${i} [${nx.toFixed(1)}, ${nz.toFixed(1)}]`);
    }
    if (dead.length)
      warn(
        'deadStreetNode',
        `${dead.length} street node(s) dead-end in open grass with NOTHING on them — ${dead.join(
          '; ',
        )}. Each is a spur you authored and never used (round 8 shipped a "restroom spur" and an "observation-tower spur" like this, and no restroom): put the ride/stall/restroom you meant on it, or delete the node and its edge. \`buildParkNet\` prunes unwired PORTS for exactly this reason — it cannot prune a node you authored by hand`,
        false,
      );
  }

  // ---- b. terrain vibe: ONE water body, flat dry apron, hills kept clear ----
  const { heightAt, waterLevel: wl, size: S } = park.terrain;
  const half = S / 2;
  // composition probe outcome (round-2 safeguard): "no terrain seed fully
  // satisfied the composition rules" used to be a console-only warning —
  // parks shipped over it with ride pads inside the lake. Now a hard FAIL.
  if (park.probeViolations && park.probeViolations.length > 0) {
    fail(
      'terrain',
      `composition probe unsatisfied: no terrain seed met the rules — ${park.probeViolations[0]}${
        park.probeViolations.length > 1 ? ` (+${park.probeViolations.length - 1} more)` : ''
      } — re-plan the layout (adjust keepDry cells / move what sits on the offending ground)`,
    );
  }
  {
    // the SAME grid pitch the composition probe and the guard clamps use
    // (climate.waterGridStep) — three different pitches would mean three
    // different answers to "is this exactly ONE water body?"
    const step = waterGridStep(S);
    const n = Math.floor(S / step);
    const wet = new Uint8Array(n * n);
    for (let i = 0; i < n; i += 1)
      for (let j = 0; j < n; j += 1) wet[i * n + j] = heightAt(-half + (i + 0.5) * step, -half + (j + 0.5) * step) < wl ? 1 : 0;
    const seen = new Uint8Array(n * n);
    // every body's measured centroid + area + cell list, biggest first (the §1
    // SEED TABLE's `ctr`/`%` columns are measured exactly this way — see the
    // water re-pick check below)
    const found: { cells: number; cx: number; cz: number; pts: [number, number][] }[] = [];
    for (let idx = 0; idx < n * n; idx += 1) {
      if (!wet[idx] || seen[idx]) continue;
      const stack = [idx];
      seen[idx] = 1;
      let cells = 0;
      let sx = 0;
      let sz = 0;
      const pts: [number, number][] = [];
      while (stack.length) {
        const c = stack.pop()!;
        const ci = Math.floor(c / n);
        const cj = c % n;
        cells += 1;
        const wx = -half + (ci + 0.5) * step;
        const wz = -half + (cj + 0.5) * step;
        sx += wx;
        sz += wz;
        pts.push([wx, wz]);
        (
          [
            [ci - 1, cj],
            [ci + 1, cj],
            [ci, cj - 1],
            [ci, cj + 1],
          ] as const
        ).forEach(([ni, nj]) => {
          if (ni < 0 || nj < 0 || ni >= n || nj >= n) return;
          const nn = ni * n + nj;
          if (wet[nn] && !seen[nn]) {
            seen[nn] = 1;
            stack.push(nn);
          }
        });
      }
      found.push({ cells, cx: sx / cells, cz: sz / cells, pts });
    }
    found.sort((a, b) => b.cells - a.cells);
    const bodies = found.length;
    const bigCells = found[0]?.cells ?? 0;
    const bigCx = found[0]?.cx ?? 0;
    const bigCz = found[0]?.cz ?? 0;

    // ---- THE WATER-BODY GATE (2026-07: TWO bodies, was exactly ONE) ---------
    // Every composed park used to carry exactly one dominant water body and
    // this check said so. The composition now composes TWO — a dominant body
    // plus a secondary (lake + river inlet, lake + tarn) — on every plot ≥
    // `TWO_WATER_MIN_SIZE`, and exactly one below it, so the gate reads the
    // SAME `waterBodyTarget(size)` the composer, the guard clamps and
    // `expandWaterBody` read. (Three sources of truth for "how many bodies?"
    // is how this rule drifted before — see waterGridStep's note.)
    //
    // THE ANTI-SCATTER INTENT IS UNCHANGED, and this is the check that carries
    // it: 3+ bodies still FAIL, and on a two-body plot the SECOND body must be
    // a real body — ≥ `SECOND_WATER_MIN_FRAC` of the dominant one's area — with
    // ≥ `waterBodyGapMin(size)` of dry ground between the two waterlines. A
    // lake plus a puddle, or two lobes of one lake separated by a one-cell
    // isthmus, is NOT two water bodies and fails here.
    const nWant = waterBodyTarget(S);
    if (bodies !== nWant)
      fail(
        'terrain',
        `${bodies} water bod${bodies === 1 ? 'y' : 'ies'} below the waterline (the composition demands exactly ${nWant} on a size-${S} plot${
          nWant === 2 ? ' — a DOMINANT body plus a SECONDARY one' : ''
        })${
          bodies > nWant
            ? ` — the extra ${bodies - nWant} read as scattered ponds. Build with \`firmShore: true\` so raw noise cannot pool puddles, and pass the composition's OWN \`basins\` (both bodies: \`comp.basins\`) to buildTerrain`
            : nWant === 2
              ? ' — the secondary body merged into the dominant one or never composed. Rebuild the terrain from `comp.basins` (which now holds BOTH bodies\' bowls) rather than a hand-written basin list'
              : ''
        }`,
      );
    else if (nWant === 2) {
      const aMain = found[0].cells;
      const aSec = found[1].cells;
      if (aSec < aMain * SECOND_WATER_MIN_FRAC)
        fail(
          'terrain',
          `the secondary water body is only ${((100 * aSec) / Math.max(1, aMain)).toFixed(0)}% of the dominant one (${Math.round(
            aSec * step * step,
          )} u² against ${Math.round(aMain * step * step)} u²) — that is a pond, not the park's second water body. The composition demands ≥ ${(
            100 * SECOND_WATER_MIN_FRAC
          ).toFixed(0)}%; re-probe (the terrain was probably built from a trimmed basin list, or a guard clamp filled the secondary body's bowls dry)`,
        );
      // non-adjacency, measured on the same flood-fill grid: a box scan around
      // the smaller body, so this stays cheap on a big plot
      const gapMin = waterBodyGapMin(S);
      const key = (x: number, z: number) => `${Math.round(x / step)},${Math.round(z / step)}`;
      const grid = new Set<string>();
      for (const [x, z] of found[0].pts) grid.add(key(x, z));
      const kMax = Math.max(1, Math.ceil((gapMin * 1.6) / step));
      let gap = Infinity;
      for (const [x, z] of found[1].pts) {
        const ci = Math.round(x / step);
        const cj = Math.round(z / step);
        for (let di = -kMax; di <= kMax; di += 1)
          for (let dj = -kMax; dj <= kMax; dj += 1) {
            const d = Math.hypot(di, dj) * step;
            if (d < gap && grid.has(`${ci + di},${cj + dj}`)) gap = d;
          }
        if (gap <= step) break;
      }
      if (gap < gapMin)
        fail(
          'terrain',
          `the park's two water bodies are only ${gap.toFixed(1)} u apart (the composition demands ≥ ${gapMin.toFixed(
            1,
          )} u of dry ground between their waterlines) — at that distance they read as ONE lake with an isthmus, not two bodies. Move the secondary body's bowls (comp.basinsSecond) further off the dominant one, or re-probe`,
        );
    }

    // ---- P4: THE WATER RE-PICK CHECK (wave-9) -------------------------------
    // The two area thresholds are LOG-SYMMETRIC about parity: a 25% shortfall
    // (×0.75) and a 33% surplus (×1/0.75) are the same multiplicative distance
    // from the pinned row, so neither direction is privileged. Measured against
    // the sample corpus at 192 (`built area / row area`): a park whose guards
    // leave the composed water alone reads **0.994-1.000**
    // (`seedcheck-s1-192` 0.999, `stormhollow` 0.994) — the composition is
    // deterministic, so there is no noise floor to clear — while round 9's park
    // A read **1.791**. Anything from ~1.1 to ~1.7 separates those cleanly;
    // 1.333 is the principled point inside that window.
    // The §1 SEED TABLE is composed UNGUARDED. The composition probe rejects any
    // water candidate that would drown a `keepDry` cell, so the moment a layout
    // overlaps the listed water the body RE-PICKS and lands somewhere else —
    // twice now a park has planned a "lakeside" district against a row and then
    // built beside dry grass (round 8: `areaUnits2` 2708 against the row's
    // 4340, the body ~50 u from where the plan said). Nothing failed, because
    // the re-picked composition is internally perfectly legal. Compare the
    // COMPOSED water against the pinned row and say so.
    //
    // TWO BODIES (2026-07): the row pins BOTH, so both are audited. Expected
    // and measured bodies are paired by NEAREST CENTROID (over both possible
    // pairings, picking the one with the smaller total displacement) rather
    // than by rank — the two bodies can legitimately swap which is bigger
    // between an unguarded row and a guarded build without any lakeside
    // coordinate moving, and reporting THAT as a re-pick would be noise.
    if (park.expectWater && park.expectWater.bodies.length > 0 && bigCells > 0) {
      const src = park.expectWater.source ?? 'the pinned §1 SEED TABLE row';
      const exp = park.expectWater.bodies;
      const got = found.slice(0, Math.max(exp.length, 1));
      /** pair index i of `exp` with `order[i]` of `got` (−1 = nothing measured) */
      let order: number[] = exp.map((_, i) => (i < got.length ? i : -1));
      if (exp.length === 2 && got.length === 2) {
        const d = (ei: number, gi: number) => Math.hypot(got[gi].cx - exp[ei].centre[0], got[gi].cz - exp[ei].centre[1]);
        if (d(0, 1) + d(1, 0) < d(0, 0) + d(1, 1)) order = [1, 0];
      }
      exp.forEach((e, ei) => {
        const gi = order[ei];
        if (gi < 0) return;
        const g = got[gi];
        const label = exp.length < 2 ? 'water body' : ei === 0 ? 'DOMINANT water body' : 'SECONDARY water body';
        const areaU2 = g.cells * step * step;
        const dCtr = Math.hypot(g.cx - e.centre[0], g.cz - e.centre[1]);
        if (dCtr > 10) {
          // ---- wave-11 P2: a RE-PICK IS A BUILD FAILURE, and it NAMES the
          // guard cell that caused it. Three rounds running have been lost to
          // this one trap: the park pins the §1 row, hand-places a district
          // against it, a keepDry cell lands inside the row's wet box, the
          // composer picks another candidate, and every "lakeside" coordinate
          // is now against dry land (or, as in round 10, the real lake lands
          // UNDER a grove and 12 scenery pieces are REFUSED for standing in
          // open water). As a mere warning it was survivable, so it survived.
          const rowR = e.areaUnits2 ? Math.sqrt(e.areaUnits2 / Math.PI) : 0;
          const culprits = (park.keepDry ?? [])
            .map((c) => ({ c, d: Math.hypot(c[0] - e.centre[0], c[1] - e.centre[1]) }))
            .filter((k) => rowR > 0 && k.d <= rowR * 1.15)
            .sort((a, b) => a.d - b.d);
          const named = culprits.length
            ? ` THE GUARD CELLS THAT FORCED IT: ${culprits
                .slice(0, 5)
                .map((k) => `[${k.c[0]}, ${k.c[1]}] (${k.d.toFixed(1)} u from the row's centroid, inside its ~${rowR.toFixed(
                  0,
                )} u wet radius)`)
                .join(', ')}${culprits.length > 5 ? `, +${culprits.length - 5} more` : ''} — move THOSE cells off the listed water, or plan the district against the re-probed body.`
            : park.keepDry
              ? ' No single keepDry cell sits inside the row\'s wet radius, so the re-pick came from the coasterPts guard or an AUTO-keepDry reclamp — re-probe with the SAME guards the park builds with.'
              : '';
          warn(
            'waterRePicked',
            `the composed ${label}'s centroid (${g.cx.toFixed(1)}, ${g.cz.toFixed(
              1,
            )}) is ${dCtr.toFixed(1)} u from ${src}'s (${e.centre[0].toFixed(1)}, ${e.centre[1].toFixed(
              1,
            )}) — the composition RE-PICKED its water candidate.${named} Every shoreline placement you planned off that row is now against dry land, and anything the real body landed under is REFUSED for standing in open water (measured area ${Math.round(
              areaU2,
            )} u²${
              e.areaUnits2 ? ` vs the row's ${Math.round(e.areaUnits2)} u²` : ''
            }). THE SEED TABLE IS PRE-keepDry: re-probe WITH your guards — \`parkComposition(THREE, seed, size, climate, { keepDry, coasterPts })\` — place against comp.waterCentre / comp.waterCentreSecond / comp.basins (§0.17), and re-check EVERY hand-placed cell with \`park.isDryCell()\` AFTER composition`,
            true,
          );
        }
        else if (e.areaUnits2 && areaU2 < e.areaUnits2 * WATER_SHRUNK)
          warn(
            'waterShrunk',
            `the composed ${label} measures ${Math.round(areaU2)} u² against ${src}'s ${Math.round(
              e.areaUnits2,
            )} u² (${Math.round((100 * areaU2) / e.areaUnits2)}% of it) — the guard clamp traded water area for buildable ground under your keepDry cells. The shoreline is not where the row says; re-probe with your guards (§0.17)`,
            false,
          );
        // ---- the SYMMETRIC case (wave-10 P2) -------------------------------
        // A body that GREW was silent until wave 10, and growth is the same
        // defect as shrinkage: the shoreline is not where the row says, so every
        // lakeside coordinate planned off it is wrong — only now the water came
        // to the plan instead of running from it. Round 9's park A doubled row
        // 83's lake (2 028 u² → 3 632 u², 5.5% → 10% of the plot) when the
        // AUTO-keepDry pass "grew the water back" around its clamped bulges, and
        // NOTHING said so: inside temperate's §0.10 budget, `ok: true`.
        else if (e.areaUnits2 && areaU2 > e.areaUnits2 * WATER_GREW)
          warn(
            'waterGrew',
            `the composed ${label} measures ${Math.round(areaU2)} u² against ${src}'s ${Math.round(
              e.areaUnits2,
            )} u² (${(areaU2 / e.areaUnits2).toFixed(2)}× it, ${(
              (100 * areaU2) /
              (park.terrain.size * park.terrain.size)
            ).toFixed(1)}% of the plot against the row's ${(
              (100 * e.areaUnits2) /
              (park.terrain.size * park.terrain.size)
            ).toFixed(1)}%) — the guard clamp / AUTO-keepDry pass GREW the water back past your keepDry cells, so the shore has moved INWARD onto ground your plan treated as dry. Re-probe with your guards (§0.17) and re-read every shoreline coordinate; check the result still sits inside §0.10's per-climate water budget`,
            false,
          );
      });
    }

    // ---- b1. THE TERRAIN-FLATTENED CHECK (2026-07-25) -----------------------
    // `waterRePicked`'s twin, for the GROUND. That check exists because a park
    // could move its own lake and nothing said so; this one exists because a
    // park can FLATTEN ITS OWN LAND and nothing said so.
    //
    // THE DEFECT, measured. Two round-10 parks composed the SAME seed, climate
    // and size (7, coastal, 128) and differed ONLY in their `keepDry` /
    // `coasterPts` guard lists:
    //   unguarded         7 peaks, max h 6.10, relief 10.54, stdH 0.85
    //   voltmoor         11 peaks, max h 8.02, relief 11.26, stdH 1.04
    //   hollowmere2       7 peaks, max h 3.14, relief  5.50, stdH 0.62
    // hollowmere2's guards crushed four of its seven peaks to the cap's 0.35-u
    // terminal, landing it below EVERY published 128 row (relief 8.15-16.60,
    // stdH 0.76-1.45) — the horizon read as a flat green field. `ok: true`,
    // zero warnings, because the composition was internally perfectly legal.
    //
    // WHAT IS MEASURED: relief + stdH of the BUILT heightfield, on
    // `measurePlotRelief`'s grid — the same function the composition's own floor
    // and `seed-table.mjs`'s §1 rows use, so the gate and the published table
    // can never disagree about what "flat" means.
    //
    // SEVERITY — a WARNING, promoted to FATAL only on the CONJUNCTION:
    //   (a) the park kept < `floor.floor` of the character its OWN seed drew
    //       (self-inflicted — the composition says so, not a guess), AND
    //   (b) the built terrain is below the PUBLISHED BAND FLOOR for its size
    //       (so it is not merely "less dramatic", it reads flat).
    // Either alone stays a non-fatal warning, and that split is deliberate:
    //   * (a) alone is a legal trade — a big layout MUST flatten its own pads,
    //     and a park that gave up a third of a 16-u-relief alpine seed still
    //     has more silhouette than most. Failing it would fail correct parks.
    //   * (b) alone is usually the SEED, not the park: a `plains` seed at
    //     amplitude 0.93 is legitimately gentle. The message says which.
    //   * both together is exactly hollowmere2, and exactly the class of defect
    //     `waterRePicked` was promoted for — self-inflicted, invisible,
    //     survivable-as-a-warning and therefore survived three rounds running.
    // Below 48, and on any UNGUARDED composition, `floor` is null and the check
    // can only ever warn: nothing there composes differently.
    //
    // AND IT NAMES THE GUARD CELLS, the way `waterRePicked` names the cell that
    // displaced the water — `floor.cappedPeaks[].culprits` are the guard cells
    // standing inside each erased peak's authored footprint.
    {
      const et = park.expectTerrain;
      const fl = et?.floor ?? null;
      const built = measurePlotRelief(heightAt, S);
      const bandR = et?.bandRelief;
      const bandS = et?.bandStdH;
      const belowBand = (bandR !== undefined && built.relief < bandR) || (bandS !== undefined && built.stdH < bandS);
      const selfFlattened = !!fl && !fl.ok;
      if (selfFlattened || belowBand) {
        const src = et?.source ?? 'the pinned §1 SEED TABLE row';
        const named = (() => {
          const worst = (fl?.cappedPeaks ?? []).filter((p) => p.culprits.length > 0);
          if (!worst.length) return '';
          return ` THE GUARD CELLS THAT FLATTENED IT: ${worst
            .slice(0, 4)
            .map(
              (p) =>
                `the range at (${p.at[0]}, ${p.at[1]}) was cut h ${p.authoredH} → ${p.keptH} by ${p.culprits
                  .slice(0, 3)
                  .map((c) => `[${(+c[0]).toFixed(1)}, ${(+c[1]).toFixed(1)}]`)
                  .join(', ')}${p.culprits.length > 3 ? ` (+${p.culprits.length - 3} more inside its footprint)` : ''}`,
            )
            .join('; ')}${worst.length > 4 ? `; +${worst.length - 4} more range(s)` : ''}.`;
        })();
        const vs =
          et?.rowRelief !== undefined
            ? ` ${src} composes relief ${et.rowRelief.toFixed(2)}${et.rowStdH !== undefined ? ` / stdH ${et.rowStdH.toFixed(2)}` : ''} UNGUARDED.`
            : '';
        const band = bandR !== undefined ? ` The published band floor at size ${S} is relief ${bandR} / stdH ${bandS}.` : '';
        const kept = fl ? ` Your guards kept ${(100 * fl.kept).toFixed(0)}% of the character this seed drew (relief ${(100 * fl.keptRelief).toFixed(
              0,
            )}%, stdH ${(100 * fl.keptStdH).toFixed(0)}%) against a ${(100 * fl.floor).toFixed(0)}% floor, and ${fl.guardedRanges} range(s) had to be placed on guarded ground.` : '';
        const cause = selfFlattened
          ? 'YOUR OWN GUARD LIST did this — the composition is deterministic, so the same seed/climate/size composes the published landform with a tighter list.'
          : 'This is the SEED\'s own archetype, not your guard list (the composition kept the character it drew) — pin a seed whose published row has the relief you want.';
        const how = selfFlattened
          ? ' FIX IT: guard TIGHTLY (only the cells you really pave or place on — not whole districts); keep guards OFF the ranges the seed drew (probe UNGUARDED first and read `comp.peaks`, or read the §1 row\'s "mountain ranges" column); and use `noDress` where you only need BARE ground rather than FLAT ground (`noDress` stops the planting without moving the heightfield — `keepDry` moves it). Re-probe with your guards and re-read `comp.report.reliefFloor` (rules/park-generation-composition.md §1).'
          : '';
        warn(
          'terrainFlattened',
          `the BUILT terrain measures relief ${built.relief.toFixed(2)} / stdH ${built.stdH.toFixed(
            2,
          )} — the horizon reads as a flat field.${vs}${band}${kept} ${cause}${named}${how}`,
          selfFlattened && belowBand,
        );
      }
    }

    const apron = park.terrain.apron ?? [-2.2, 2.2, half - 3.6, half - 0.4];
    let apronMax = 0;
    let apronWet = false;
    for (let x = apron[0]; x <= apron[1] + 1e-6; x += 0.4)
      for (let z = apron[2]; z <= apron[3] + 1e-6; z += 0.4) {
        const v = heightAt(x, z);
        apronMax = Math.max(apronMax, Math.abs(v));
        if (v < wl + 0.1) apronWet = true;
      }
    if (apronWet) fail('terrain', 'entrance apron dips below the waterline');
    if (apronMax > 0.5) fail('terrain', `entrance apron relief ${apronMax.toFixed(2)} > 0.5 — the gate forecourt must stay flat`);

    const peaks = park.terrain.peaks ?? [];
    const rects = park.footprints ?? park.manager.footprints?.() ?? [];
    rects.forEach((f) => {
      for (const p of peaks) {
        const k = Math.max(0, 1 - Math.hypot(f.cx - p.x, f.cz - p.z) / p.radius);
        const bump = k * k * (3 - 2 * k) * p.height;
        if (bump > 0.75) fail('terrain', `${f.label} is parked on a hill flank (peak contribution ${bump.toFixed(2)})`);
      }
      // WET-PAD guard (round-2 safeguard): every registered pad / queue lane /
      // entrance/exit hut must stand on ground safely ABOVE the waterline — a
      // Teacups pad planted in the lake used to pass. Sample the rect centre
      // + its four corners against waterLevel + 0.05.
      const ax: [number, number] = [Math.cos(f.yaw), -Math.sin(f.yaw)];
      const az: [number, number] = [Math.sin(f.yaw), Math.cos(f.yaw)];
      let minH = Infinity;
      for (const [sx, sz] of [[0, 0], [1, 1], [1, -1], [-1, 1], [-1, -1]] as const) {
        const px = f.cx + ax[0] * f.hx * sx + az[0] * f.hz * sz;
        const pz = f.cz + ax[1] * f.hx * sx + az[1] * f.hz * sz;
        minH = Math.min(minH, heightAt(px, pz));
      }
      if (minH < wl + 0.05)
        fail(
          'terrain',
          `${f.label} stands in the water (ground ${minH.toFixed(2)} is below waterline+0.05 = ${(wl + 0.05).toFixed(2)}) — move it onto dry land (and keepDry that cell)`,
        );
    });
  }

  // ---- b2. PLANTED footprints: dry ground + off the walked path (round-6) ---
  // Scenery and trees were never audited at all: a marbleStatue stood in the
  // middle of a 1.1-u main street and a willow + picnic table stood INSIDE the
  // waterline, and the gate passed. Every <Scenery>/<Placed> registration
  // carries its ground-contact radius, so audit both.
  //   * DRYNESS — the same waterLevel + 0.05 rule the pads obey, sampled at
  //     the centre and around the footprint ring (`terrainLint.isDry`).
  //   * PATH SLABS — the footprint may not intrude into a RENDERED street slab
  //     (half-width `pathWidth/2`). Decoration inside a PLAZA rect is legal
  //     RCT2 dressing (planters on the forecourt) and is exempt.
  {
    const planted = park.planted ?? [];
    const pathHalf = (park.pathWidth ?? 1.1) / 2;
    const plazas = park.plazas ?? [];
    const inPlaza = (x: number, z: number) => plazas.some(([cx, cz, w, d]) => Math.abs(x - cx) <= w / 2 + 0.05 && Math.abs(z - cz) <= d / 2 + 0.05);
    const nStreetP = park.gridNodeCount ?? park.net.nodes.length;
    planted.forEach((p) => {
      let minH = heightAt(p.x, p.z);
      for (let k = 0; k < 8; k += 1) {
        const a = (k / 8) * Math.PI * 2;
        minH = Math.min(minH, heightAt(p.x + Math.cos(a) * p.r, p.z + Math.sin(a) * p.r));
      }
      if (minH < wl + 0.05)
        fail(
          'scenery',
          `${p.label} stands in the water: ground ${minH.toFixed(2)} under its ${p.r.toFixed(2)} u footprint is below waterline+0.05 = ${(
            wl + 0.05
          ).toFixed(2)} — plant it on DRY ground (terrainLint.isDry) or keepDry that cell`,
        );
      if (inPlaza(p.x, p.z)) return; // plaza dressing is legal
      // BLOCKING radius: capped at 0.6 u (half a lattice cell — the widest
      // SOLID base single-tile RCT2 scenery has). Past that the piece is a
      // walk-in structure (a gazebo/pavilion is 2.7 u across and abutting one
      // with a path is classic RCT2 dressing) — what must never happen is a
      // solid base standing IN the walking lane.
      const blockR = Math.min(p.r, 0.6);
      for (let ei = 0; ei < park.net.edges.length; ei += 1) {
        const [ea, eb] = park.net.edges[ei];
        if (ea >= nStreetP || eb >= nStreetP) continue; // logical spur attaches
        const [ax, az] = park.net.nodes[ea];
        const [bx, bz] = park.net.nodes[eb];
        const d = segDist(ax, az, bx, bz, p.x, p.z);
        // 0.1 u of kerb tolerance — touching the slab edge is dressing, but a
        // footprint that eats into the walked surface blocks guests
        if (d + 0.1 < pathHalf + blockR) {
          fail(
            'scenery',
            `${p.label} stands IN the street: its ${p.r.toFixed(2)} u footprint sits only ${d.toFixed(
              2,
            )} u from street edge ${ei} (${ea}→${eb}) — inside the ${(pathHalf * 2).toFixed(
              1,
            )} u path slab, blocking the walked surface. Move it clear of the kerb (≥ ${(pathHalf + blockR).toFixed(
              2,
            )} u from the edge centreline) or put it on a plaza — ask for the cell instead of guessing: \`offPathCell(net, [${p.x.toFixed(
              1,
            )}, ${p.z.toFixed(1)}], { clear: ${(pathHalf + blockR).toFixed(2)} })\` (rules §0.14/§5)`,
          );
          break; // one failure per piece
        }
      }
    });
  }

  // ---- b3. WORLD THEME COHERENCE (worlds) -----------------------------------
  // rules/park-generation-composition.md §3 composes a park WORLDS-FIRST: the
  // author picks ≥ 3 preset worlds, builds each one out as a self-contained
  // district, then connects them. The failure mode that made the rule worth
  // enforcing is a piece from one world's vocabulary dressed into another's —
  // a lava fissure in the disco street, a coral cluster in the foundry. It reads
  // as an accident, and nothing could see it before: the theme was a palette
  // handed to a set-piece, and a ride/scenery component carried no theme at all.
  //
  // Now it is MECHANICAL. `<World plan={W}>` registers each world's REGION, the
  // component factories stamp every group with its catalog kind
  // (`tagComponent`), and `auditWorldThemes` resolves each themed piece's
  // coordinates against the declared regions. `park.worldAudit` is that result.
  //
  // SEVERITY: a WARNING, never a hard failure. Three reasons, and they are the
  // same three that keep `laneTrim` out of FATAL_LINT_KINDS:
  //   1. Every other gate check is about a park being BROKEN — unreachable,
  //      overlapping, derailing, floating, out of bounds. A mis-themed prop is
  //      an aesthetic defect: the park opens, the sim runs, RCT2 legality holds.
  //   2. It is already SCORED. `harness/park-eval/RUBRIC.md`'s Worlds axis
  //      charges 0.5 per cross-theme placement off `probe.worlds.crossTheme`,
  //      and the rubric's own rule is never to charge one defect twice.
  //   3. The world layer is opt-in and additive. Promoting a coherence finding
  //      to `ok: false` would make every park that adopts worlds partially
  //      strictly WORSE off than one that declares none — the wrong incentive
  //      for a feature the composition rules are trying to make standard.
  // The finding still cannot be ignored: §0's warnings policy means a park with
  // ANY warning needs re-planning, and `w7-check.mjs` counts it as a gate
  // warning. Two structural mistakes ARE fatal, because they make the audit
  // itself meaningless rather than reporting a bad placement: a duplicate world
  // id (`worldIdReused`, raised at registration) and a world declared with no
  // theme at all.
  if (park.worldAudit && park.worldAudit.declared > 0) {
    const wa = park.worldAudit;
    wa.crossTheme.forEach((c) => warn('crossTheme', c.detail));
    wa.worlds.forEach((w) => {
      if (!w.themeId || w.themeId === 'default')
        warn(
          'worldUnthemed',
          `world "${w.id}" (${w.title}) is declared with no preset theme — a world IS its theme, so an un-themed region cannot be audited for coherence and counts for nothing on the rubric's Worlds axis. Hand \`worldPlan\` one of the ${WORLD_PRESET_IDS.length} presets (${WORLD_PRESET_IDS.join(', ')})`,
          true,
        );
      else if (!w.built) {
        // wave-11 P1: NAME the registered pieces that fell just outside. Round
        // 10's Pulse world read `rideCount: 0` with three rides 2.4 u past its
        // edge, because `worldPlan({ include })` was given the queue TAIL cells
        // instead of the ride PADS — and the warning only said "not a district".
        const misses = w.nearMisses ?? [];
        const near = misses.length
          ? ` — but ${misses.length} REGISTERED piece(s) stand in NO world just outside it: ${misses
              .slice(0, 6)
              .map((m) => `<${m.kind}> at [${m.at[0]}, ${m.at[1]}] (${m.need} u over the edge)`)
              .join(', ')}${misses.length > 6 ? `, +${misses.length - 6} more` : ''}. Its bounds stop short of its own attractions: give \`worldPlan\` those PAD CENTRES (\`rides: [{ at: [x, z] }]\`, or \`include\` — a queue TAIL is 3-7 u upstream of the pad it serves, §3/wave-11 P1) or raise \`margin\` by ≥ ${
              w.marginNeeded ?? 0
            } u`
          : '';
        warn(
          'worldNotBuiltOut',
          `world "${w.id}" (${w.title}, ${w.themeId}) is a declared REGION but not a district: ${w.rideCount} ride(s), ${w.stallCount} stall(s), ${
            w.sceneryCount + w.setPieceCount
          } scenery/set-piece(s) inside its ${w.hx * 2} × ${w.hz * 2} u bounds${near}. §3 asks each world for its OWN rides, its OWN food and its OWN dressing — a rect with one ride in it is a label, not a place`,
        );
      }
      // THE THEMED-CONTENT FLOOR (2026-07-28) — reported even when the world IS
      // built, because `built` is theme-blind: a land can hold a ride, a stall
      // and a prop and still contain nothing of its own theme. Measured on a
      // generated park that declared three themed worlds and shipped zero themed
      // rides and zero themed scenery. NON-FATAL: a shortfall is a warning, so
      // the settled `worldNotBuiltOut` yardstick is untouched.
      if (w.underThemed && w.underThemed.length)
        warn(
          'worldUnderThemed',
          `world "${w.id}" (${w.title}, ${w.themeId}) is dressed ${w.themeId} but stocked generic — ${w.underThemed.join(
            '; ',
          )}. It currently holds ${w.themedRideCount} themed ride(s)${
            w.themedRideKinds.length ? ` (${w.themedRideKinds.join(', ')})` : ''
          }, ${w.themedStallCount} themed stall(s) and ${w.themedSceneryCount} themed scenery piece(s). ` +
            'A world with none of its own content is a differently-tinted copy of the last one',
        );
    });
    if (wa.presetCount < 3)
      warn(
        'worldVariety',
        `the park declares ${wa.declared} world region(s) covering ${wa.presetCount} preset theme(s) (${
          wa.presets.join(', ') || 'none'
        }) — §3 composes a park from AT LEAST 3 of the ${WORLD_PRESET_IDS.length} presets. Unused: ${wa.unusedPresets.join(', ') || 'none'}`,
      );
    if (wa.unplacedThemed.length)
      warn(
        'themedPieceOutsideWorlds',
        `${wa.unplacedThemed.length} themed piece(s) stand outside every declared world — e.g. ${wa.unplacedThemed
          .slice(0, 4)
          .map((p) => `<${p.kind}> (${p.themeId}) at [${p.at[0]}, ${p.at[1]}]`)
          .join('; ')}. That is legal (a land's circuits sprawl past the rect an author drew), but if it was not deliberate the world's bounds are too tight — grow \`worldPlan\`'s \`margin\`, or \`include\` the cells the piece stands on`,
      );
  }

  // ---- c. footprint no-overlap OBB sweep ------------------------------------
  {
    const rects = park.footprints ?? park.manager.footprints?.() ?? [];
    const rideOf = (label: string) => label.replace(/ (entrance hut|exit hut|queue lane|exit lane( join)?|boardPoint pad)$/, '');
    const kindOf = (label: string) =>
      label.endsWith('entrance hut')
        ? 'ent'
        : label.endsWith('exit hut')
          ? 'exitHut'
          : /exit lane( join)?$/.test(label)
            ? 'exitLane'
            : label.endsWith('queue lane')
              ? 'lane'
              : 'other';
    const failedPairs = new Set<string>();
    // ---- the commonest footprint FAIL: a ride colliding with ITSELF --------
    // (wave-10) The queue lane — or the entrance hut at its head — running
    // through the ride's OWN boardPoint pad, because the layout sized the
    // tail→pad gap from the HEAD-ANCHOR formula alone (`anchor = tail −
    // dir·(laneLenOf(capacity) + 0.35)`). That formula places the LANE and says
    // NOTHING about the pad: a capacity-10 rig with its pad 6.0 u from the tail
    // has 7.05 u of lane+join to fit and the lane simply runs through the
    // machine. The whole arithmetic is knowable right here, so report it the
    // way the `padOnStreet` lint does — the REQUIRED distance, the measured
    // one, and the nearest LEGAL pad cell as a coordinate to paste.
    const JOIN = 0.35; // manager: tail = anchor + (laneLen + 0.35)·dir
    const HUT_BACK = 0.62; // entrance hut centre sits 0.62 behind the queue head
    const PAD_CLEAR = 1.8; // §0.14: a pad centre clears a 1.1-u slab at 1.8 u
    /** SAT projected half-extent of `r` on the unit axis [ux, uz] */
    const projHalf = (r: ParkFootRect, ux: number, uz: number) =>
      r.hx * Math.abs(Math.cos(r.yaw) * ux - Math.sin(r.yaw) * uz) + r.hz * Math.abs(Math.sin(r.yaw) * ux + Math.cos(r.yaw) * uz);
    const nStreetF = park.gridNodeCount ?? park.net.nodes.length;
    /** the tail→pad-centre arithmetic for a ride's own lane/hut × pad hit */
    const ownPadDetail = (a: ParkFootRect, b: ParkFootRect): string => {
      if (rideOf(a.label) !== rideOf(b.label)) return '';
      const pad = a.label.endsWith('boardPoint pad') ? a : b.label.endsWith('boardPoint pad') ? b : null;
      if (!pad) return '';
      const hitKind = kindOf((pad === a ? b : a).label);
      if (hitKind !== 'lane' && hitKind !== 'ent') return '';
      const ride = rideOf(pad.label);
      const lane = rects.find((r) => r.label === `${ride} queue lane`);
      if (!lane) return '';
      const dir: [number, number] = [Math.sin(lane.yaw), Math.cos(lane.yaw)]; // head → tail
      const laneLen = lane.hz * 2;
      const tail: [number, number] = [lane.cx + dir[0] * (lane.hz + JOIN), lane.cz + dir[1] * (lane.hz + JOIN)];
      const ent = rects.find((r) => r.label === `${ride} entrance hut`);
      const hutHalf = ent ? projHalf(ent, dir[0], dir[1]) : 0.5;
      const padHalf = projHalf(pad, dir[0], dir[1]);
      const need = laneLen + JOIN + HUT_BACK + hutHalf + padHalf;
      const have = (tail[0] - pad.cx) * dir[0] + (tail[1] - pad.cz) * dir[1];
      // the nearest LEGAL pad centre: back off down the lane axis until the pad
      // clears the lane AND the hut, then keep stepping the 0.6 half-cell
      // lattice until it also stands dry, in bounds and ≥ 1.8 u off the streets
      const axisAt = (along: number): [number, number] => [+(tail[0] - dir[0] * along).toFixed(2), +(tail[1] - dir[1] * along).toFixed(2)];
      let spot: [number, number] | null = null;
      let spotAlong = 0;
      for (let k = 0; k < 9 && !spot; k += 1) {
        const along = need + 0.05 + k * 0.6;
        const p = axisAt(along);
        if (Math.max(Math.abs(p[0]), Math.abs(p[1])) > half - 1.2) break;
        if (heightAt(p[0], p[1]) <= wl + 0.05) continue;
        if (pathClearance(park.net, p, nStreetF).clearance < PAD_CLEAR) continue;
        spot = p;
        spotAlong = along;
      }
      const p0 = axisAt(need + 0.05);
      const fix = spot
        ? `Move the pad (the ride position) to [${spot[0]}, ${spot[1]}] — ${spotAlong.toFixed(2)} u back down the lane axis from the tail, dry and ≥ ${PAD_CLEAR.toFixed(
            2,
          )} u off every street node + edge centreline (\`offPathCell(net, [${spot[0]}, ${spot[1]}], { clear: ${PAD_CLEAR.toFixed(
            2,
          )} })\` returns it unchanged) — or plant the TAIL NODE ≥ ${need.toFixed(2)} u out the boarding face and re-derive the head from it`
        : `the ${need.toFixed(2)} u point on the lane axis is [${p0[0]}, ${p0[1]}], but NO cell out that way clears both the minimum and the ${PAD_CLEAR.toFixed(
            2,
          )} u street margin within 4.8 u (it stands in a slab or in the water) — move the TAIL NODE further out the boarding face, or drop \`queue\` entirely and let the derived lane trim itself onto the node`;
      return `: the ride's own ${hitKind === 'lane' ? 'queue lane' : 'entrance hut'} stands on its own boarding pad. The pad centre is ${have.toFixed(
        2,
      )} u from the queue tail [${+tail[0].toFixed(1)}, ${+tail[1].toFixed(1)}] along the lane axis [${dir
        .map((v) => +v.toFixed(2))
        .join(', ')}], but the audited MINIMUM tail→pad-centre distance is ${need.toFixed(2)} u = laneLen ${laneLen.toFixed(
        2,
      )} (laneLenOf(capacity)) + ${JOIN} join + ${HUT_BACK} hut offset + ${hutHalf.toFixed(2)} hut half-depth + ${padHalf.toFixed(
        2,
      )} pad half — short by ${Math.max(0, need - have).toFixed(
        2,
      )} u. The head-anchor formula \`anchor = tail − dir·(laneLenOf(capacity) + 0.35)\` places the LANE only; it does NOT protect the PAD. ${fix} (rules/park-generation.md §0.4)`;
    };
    for (let i = 0; i < rects.length; i += 1)
      for (let j = i + 1; j < rects.length; j += 1) {
        const a = rects[i];
        const b = rects[j];
        // a ride's own hut and the path that starts at its doorway ABUT BY
        // DESIGN — the entrance hut with its queue lane, and (since the RCT2
        // entrance/exit fix) the exit hut with its exit path. placeAccess /
        // auditExitLane exempt exactly these two pairs; everything else,
        // including the exit lane against the ride's OWN queue lane, is a real
        // collision (the RCT2 layout leaves a full tile between them).
        if (rideOf(a.label) === rideOf(b.label)) {
          const ka = kindOf(a.label);
          const kb = kindOf(b.label);
          if ((ka === 'ent' && kb === 'lane') || (ka === 'lane' && kb === 'ent')) continue;
          // the exit hut and its path; the path's two legs; and — when the path
          // JOINS the queue's own tail node rather than a cross-street — the exit
          // path against the queue lane and entrance hut it runs beside. All one
          // ride's access rig, built by one function from one plan.
          if (ka === 'exitLane' || kb === 'exitLane') {
            const other = ka === 'exitLane' ? kb : ka;
            if (other === 'exitHut' || other === 'exitLane' || other === 'lane' || other === 'ent') continue;
          }
        }
        if (obbOverlap(a, b)) {
          // NESTING IS LEGAL WHEN NOTHING TOUCHES. This sweep is 2D, so it used
          // to fail a coaster whose track flies clean over another ride's pad —
          // which is not a collision, it is one of the best things a park can
          // do with its space. If both rects declare a vertical extent and they
          // clear each other by OVERFLY_CLEAR, the plan-space overlap is allowed
          // and reported as INFORMATION instead. Rects that do not declare a
          // height are still treated as floor-to-sky and still fail, because an
          // undeclared height cannot be assumed short.
          if (vertClear(a, b)) {
            warn(
              'nestedFootprint',
              `${a.label} and ${b.label} share ground plan but clear each other vertically ` +
                `(${Math.max(a.y0! - b.y1!, b.y0! - a.y1!).toFixed(2)} u >= ${OVERFLY_CLEAR}) — legal, not a collision`,
            );
            continue;
          }
          fail('footprints', `${a.label} overlaps ${b.label}${ownPadDetail(a, b)}`);
          failedPairs.add([a.label, b.label].sort().join(' | '));
        }
      }
    // residual placeAccess collisions the sweep didn't see (round-1
    // safeguard: an access overlap is a FAIL, never a console-only warn)
    (park.manager.accessAudit?.() ?? []).forEach((r) => {
      if (!failedPairs.has([r.a, r.b].sort().join(' | '))) fail('footprints', `placeAccess residual: ${r.msg}`);
    });
  }

  // ---- d. coaster legality: design rules + clearance + CRASH-FREE guard -----
  (park.coasters ?? []).forEach((c, ci) => {
    const type = c.type ?? 'wooden';
    const label = `coaster ${ci} (${type})`;
    if (c.fatal) {
      // compileTrackPieces' fatal guard already condemned this circuit — one
      // hard failure, no point re-running the sweeps over broken geometry
      fail('coaster', `${label}: FATAL compiled track — ${c.fatal}`);
      return;
    }
    // the re-check builds with the SAME saturated bank the kit builds with
    // (round-3 safeguard: an unclamped registered bank made the re-check
    // fail 'bankLimit' on track the kit had actually built legally)
    const bank = coasterBankCap(type, c.bank);
    const design = checkCoasterDesign(t, c.points, { type, bank });
    design.violations
      .filter((v) => !v.warning)
      .forEach((v) => fail('coaster', `${label}: design violation [${v.kind}] ${v.detail}`));
    // crash-free: replay the runner's energy-paced force profile through the
    // SHARED helper the kit's rateCoaster also uses (SplineRideKit's
    // replayCoasterForces — factored out of this loop so the gate and the
    // ratings can never drift apart); it returns the frames it sampled.
    const replay = replayCoasterForces(t, c.points, { bank });
    const fb = replay.frames;
    // IN-BOUNDS: every sampled track point stays inside ±size/2 (+0.4 rail
    // margin) — a circuit hanging over the terrain edge is a broken park
    {
      let worstExt = 0;
      for (const p of fb.P) worstExt = Math.max(worstExt, Math.abs(p.x), Math.abs(p.z));
      if (worstExt > half + 0.4)
        fail('coaster', `${label}: track reaches ±${worstExt.toFixed(2)} u — outside the ±${half.toFixed(1)} u park bounds (+0.4 margin)`);
    }
    const sv = validateSpline(t, fb.curve);
    if (!sv.ok) fail('coaster', `${label}: spline clearance ${sv.worst.toFixed(2)} < 0.9 (self-intersection risk)`);
    // the replay's worst bank-discounted lateral acceleration vs the 1.5 g
    // no-upstop derail guard, with a safety margin (Vehicle.TrackMotion.cpp:58-122)
    const worstG = replay.worstLatAccel;
    const worstAt = replay.worstLatAt;
    const limit = 1.5 * 9.8 * CRASH_MARGIN;
    if (worstG > limit)
      fail(
        'coaster',
        `${label}: worst lateral ${(worstG / 9.8).toFixed(2)} g at u=${worstAt.toFixed(2)} breaches the 1.5 g derail guard margin (must stay under ${(limit / 9.8).toFixed(2)} g) — the train would crash`,
      );

    // ---- d2. track-corridor sweep (round-4 safeguard): nothing LIVES under
    // the track. A 1.6-u-wide corridor is swept along the sampled circuit
    // (segment OBBs, the same SAT as the footprint sweep) against stall
    // footprints, OTHER rides' pads/huts/lanes and street edges. Flying OVER
    // is legal at height: an obstacle only fails when the track passes within
    // 2.2 u of its level (grade crossings / roof-skims); a coaster soaring
    // over a path is the RCT2 look and stays clean.
    {
      const CORR_HALF = 0.8; // 1.6-u corridor
      const CLEAR = 2.2; // required vertical clearance when overflying
      // ---- round-6: the STRICT re-audit ------------------------------------
      // The 1.6-u corridor measured against the bare GROUND let an auto-fixed
      // hut hide: a Ferris wheel exit hut the queueDir machinery had relocated
      // ended 0.96 u from the rail centreline (0.16 u outside the corridor)
      // with the track running 0.59 u over the ground there — straight THROUGH
      // the hut's roof, and the gate passed. Anything the manager DERIVES or
      // RELOCATES (huts, lanes, pads, stalls) is re-swept here against the
      // rails' real keep-clear envelope: RCT2 wants a clear tile beside the
      // track (a 2.2-u sweep) and the rails must clear the obstacle's OWN TOP,
      // never just the dirt underneath it.
      const STRICT_HALF = 1.1;
      const ROOF_CLEAR = 0.3;
      const heightOf = (label: string): number =>
        / (entrance|exit) hut$/.test(label)
          ? 1.5 // hut walls + roof ridge
          : /queue lane$/.test(label)
            ? 0.45 // slab + railings
            : /boardPoint pad$/.test(label)
              ? 0.6
              : / stall$/.test(label)
                ? 2.1 // canopy
                : 1.2;
      const NP = fb.N;
      const dsC = fb.total / NP;
      const stride = Math.max(1, Math.round(0.7 / dsC));
      interface Seg { ax: number; az: number; bx: number; bz: number; minY: number; rect: ParkFootRect }
      const segs: Seg[] = [];
      for (let i = 0; i < NP; i += stride) {
        const a = fb.P[i];
        const b = fb.P[(i + stride) % NP];
        segs.push({
          ax: a.x,
          az: a.z,
          bx: b.x,
          bz: b.z,
          minY: Math.min(a.y, b.y),
          rect: {
            cx: (a.x + b.x) / 2,
            cz: (a.z + b.z) / 2,
            hx: CORR_HALF,
            hz: Math.hypot(b.x - a.x, b.z - a.z) / 2,
            yaw: Math.atan2(b.x - a.x, b.z - a.z),
            label: 'corridor',
          },
        });
      }
      const rideOfLabel = (l: string) => l.replace(/ (entrance hut|exit hut|queue lane|boardPoint pad)$/, '');
      // OTHER rides' pads/huts/lanes (own rects exempt via the registered name)
      if (c.name !== undefined) {
        const rects = park.footprints ?? park.manager.footprints?.() ?? [];
        for (const r of rects) {
          if (rideOfLabel(r.label) === c.name) continue;
          const base = heightAt(r.cx, r.cz);
          const hit = segs.find((s) => s.minY - base < CLEAR && obbOverlap(s.rect, r));
          if (hit) {
            fail(
              'corridor',
              `${label}${c.name ? ` "${c.name}"` : ''}: the 1.6-u track corridor runs through ${r.label} with only ${(hit.minY - base).toFixed(2)} u of clearance (flying over needs ≥ ${CLEAR}) — move it out of the corridor or route the track higher`,
            );
            continue;
          }
          // STRICT re-audit (round-6): roof-skim / keep-clear-tile intrusion
          const top = base + heightOf(r.label);
          const skim = segs.find((s) => s.minY < top + ROOF_CLEAR && obbOverlap({ ...s.rect, hx: STRICT_HALF }, r));
          if (skim)
            fail(
              'corridor',
              `${label}${c.name ? ` "${c.name}"` : ''}: ${r.label} sits under/beside the rails — the track passes at y=${skim.minY.toFixed(
                2,
              )} while the structure's roof reaches ${top.toFixed(2)} (needs ${ROOF_CLEAR} u over it, or a clear ${(STRICT_HALF * 2).toFixed(
                1,
              )} u tile beside the rails). A relocated/derived hut is NOT exempt — re-plan the cell (manager.corridorCells())`,
            );
        }
      }
      // stall footprints (body + serving front)
      for (const st of park.manager.stalls?.() ?? []) {
        const m = Math.hypot(st.dir[0], st.dir[1]) || 1;
        const dxn = st.dir[0] / m;
        const dzn = st.dir[1] / m;
        const rect: ParkFootRect = {
          cx: st.anchor[0] + dxn * 0.36,
          cz: st.anchor[2] + dzn * 0.36,
          hx: 0.65,
          hz: 1.01,
          yaw: Math.atan2(dxn, dzn),
          label: `${st.name} stall`,
        };
        const base = st.anchor[1];
        const hit = segs.find((s) => s.minY - base < CLEAR && obbOverlap(s.rect, rect));
        if (hit) {
          fail(
            'corridor',
            `${label}${c.name ? ` "${c.name}"` : ''}: the 1.6-u track corridor runs through the ${st.name} stall with only ${(hit.minY - base).toFixed(2)} u of clearance (flying over needs ≥ ${CLEAR}) — move the stall out of the corridor`,
          );
          continue;
        }
        const stTop = base + heightOf(rect.label);
        const stSkim = segs.find((s) => s.minY < stTop + ROOF_CLEAR && obbOverlap({ ...s.rect, hx: STRICT_HALF }, rect));
        if (stSkim)
          fail(
            'corridor',
            `${label}${c.name ? ` "${c.name}"` : ''}: the ${st.name} stall sits under/beside the rails — the track passes at y=${stSkim.minY.toFixed(
              2,
            )} while its canopy reaches ${stTop.toFixed(2)} (needs ${ROOF_CLEAR} u over it, or a clear ${(STRICT_HALF * 2).toFixed(
              1,
            )} u tile beside the rails) — move the stall`,
          );
      }
      // street edges at grade: sample each rendered edge every ~1.2 u; a
      // sample inside the corridor fails unless the track clears path level
      // by ≥ 2.2 (real overflights are fine — grade crossings are not)
      const nStreet = park.gridNodeCount ?? park.net.nodes.length;
      park.net.edges.forEach(([ea, eb], ei) => {
        if (ea >= nStreet || eb >= nStreet) return; // logical spur attaches
        const [ax, az] = park.net.nodes[ea];
        const [bx, bz] = park.net.nodes[eb];
        const chunks = Math.max(1, Math.round(Math.hypot(bx - ax, bz - az) / 1.2));
        for (let k = 0; k < chunks; k += 1) {
          const mx = ax + ((bx - ax) * (k + 0.5)) / chunks;
          const mz = az + ((bz - az) * (k + 0.5)) / chunks;
          const level = park.pathY ?? heightAt(mx, mz);
          const hit = segs.find((s) => s.minY - level < CLEAR && segDist(s.ax, s.az, s.bx, s.bz, mx, mz) <= CORR_HALF);
          if (hit) {
            fail(
              'corridor',
              `${label}${c.name ? ` "${c.name}"` : ''}: street edge ${ei} (${ea}→${eb}) crosses the track corridor at grade near (${mx.toFixed(1)}, ${mz.toFixed(1)}) — track is only ${(hit.minY - level).toFixed(2)} u above path level (flying over needs ≥ ${CLEAR}); reroute the street or raise the track`,
            );
            return; // one failure per edge
          }
        }
      });
    }
  });

  // ---- d3. BLOCKERS: nothing solid stands in a walked street (round-6) ------
  // Guests only walk the path graph and short sanctioned hops off it, and the
  // GameManager now refuses to route through a registered blocker (fountains,
  // ride bodies, shop bodies, restroom huts, queue railings, <Fence> runs).
  // A street laid THROUGH one is therefore a broken park: it either strands the
  // guests behind it or forces the routing layer's "no alternative" fallback,
  // which walks them through solid stone. Two gates:
  //   1. every RENDERED street edge is sampled every ~0.3 u — a sample inside a
  //      blocker FAILS (access spurs past `gridNodeCount` are exempt: a queue
  //      tail / stall front / doorway spur IS the sanctioned way in)
  //   2. every ride's queue tail must still be REACHABLE from the gate once the
  //      blockers are respected (the accessibility check above ignores them)
  {
    const blist = park.manager.blockers?.() ?? [];
    if (blist.length) {
      const insideOf = (x: number, z: number) => {
        for (const b of blist) {
          if (b.circle) {
            if (Math.hypot(x - b.circle.cx, z - b.circle.cz) < b.circle.r) return b;
          } else if (b.rect) {
            const dx = x - b.rect.cx;
            const dz = z - b.rect.cz;
            const c = Math.cos(b.rect.yaw);
            const s = Math.sin(b.rect.yaw);
            if (Math.abs(dx * c - dz * s) < b.rect.hx && Math.abs(dx * s + dz * c) < b.rect.hz) return b;
          }
        }
        return null;
      };
      const nStreetB = park.gridNodeCount ?? park.net.nodes.length;
      park.net.edges.forEach(([ea, eb], ei) => {
        if (ea >= nStreetB || eb >= nStreetB) return; // sanctioned access spur
        const [ax, az] = park.net.nodes[ea];
        const [bx, bz] = park.net.nodes[eb];
        const steps = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) / 0.3));
        for (let k = 0; k <= steps; k += 1) {
          const u = k / steps;
          const mx = ax + (bx - ax) * u;
          const mz = az + (bz - az) * u;
          const hit = insideOf(mx, mz);
          if (hit) {
            fail(
              'blockers',
              `street edge ${ei} (${ea}→${eb}) runs THROUGH ${hit.label} near (${mx.toFixed(1)}, ${mz.toFixed(
                1,
              )}) — guests cannot walk through solid objects: reroute the street or move the ${hit.kind}`,
            );
            return; // one failure per edge
          }
        }
      });
      // queue tails must stay reachable with the blockers respected
      const acc2 = park.manager.accessPoints?.();
      const gate = park.manager.edgeWalkable;
      if (acc2 && acc2.entranceNode >= 0 && gate) {
        const blocked = buildRouting(park.net, { edgeAllowed: (a, b) => gate(a, b) });
        acc2.rides.forEach((r) => {
          if (r.queueNode < 0 || r.queueNode === acc2.entranceNode) return;
          // route() falls back to the unfiltered graph, so compare the two:
          // a path that only exists through a blocker is NOT a real route
          const p = blocked.route(acc2.entranceNode, r.queueNode);
          const clean = p.length >= 2 && p.every((n, i) => i === 0 || gate(p[i - 1], n));
          if (!clean)
            fail(
              'blockers',
              `the ${r.name} queue tail is only reachable THROUGH a solid object (a blocker sits across every route from the gate) — reroute the street or move what blocks it`,
            );
        });
      }
    }
  }

  // ---- e. GameManager sim smoke: scaled sim-s at fixed dt --------------------
  {
    // the window scales with the longest registered rideDuration so a long
    // ride can still complete a full cycle: max(60, 2.5·maxDur + 20) sim-s
    const durs = park.manager.rides().map((r) => r.rideDuration ?? 0);
    const maxDur = durs.length ? Math.max(...durs) : 0;
    if (maxDur > 14)
      console.warn(
        `[validatePark] longest registered rideDuration is ${maxDur}s — acceptance sims need ≤ ~12 s rides (long cycles starve the queue checks and stretch the smoke run)`,
      );
    const secs = park.simSeconds ?? Math.max(SIM_SMOKE_SECONDS, Math.ceil(2.5 * maxDur + 20));
    simSecondsRun = secs;
    // A queue legitimately holds for one full ride CYCLE before it can advance,
    // and this threshold has to bound that cycle. `max(30, maxDur + 15)` did not:
    // MEASURED 2026-07-28 (`node harness/park-eval/probe-board-quiet.mjs
    // [--legacy]`, which replicates the detector below exactly — same 0.5 s
    // sampling, same "reset only on an observed shrink" rule), the longest hold
    // on a capacity-8 / `rideDuration` 12 ride is
    //
    //     single-station  33.5 s (old departure rule) / 42.5 s (boarding-quiet)
    //     4-platform      43.5 s (old)                / 51.5 s (boarding-quiet)
    //
    // i.e. it was ALREADY over the 30 s threshold under the OLD rule — the 60 s
    // window simply ended before the detector could see it, and raising the window
    // to 85 s turned a latent mis-calibration into a `sim` FAIL on the reference
    // park `arch-ref` ("Tarn Wheel: its queue held for >30 sim-s"). The dwell is
    // only one term of a cycle: add `waitingToDepart` 0.6 + `loadTime` + the
    // travel + `arriving` 1 + unload (0.8 + riders·0.6 + 0.8) +
    // `movingToEndOfStation` 1, and on a MULTI-STATION ride a platform's queue
    // only advances when the train comes back round to it.
    //
    // So the threshold is now a fraction of the OBSERVATION WINDOW instead of a
    // guess at the cycle: a queue that never advances once in 3/4 of the whole
    // smoke run is the defect this check is for (an unreachable queue or a ride
    // that never departs — `skills-drafts/park-troubleshooting`), and that
    // reading cannot drift out of step with the window again. It stays strictly
    // inside the window, so the check remains able to fire; at the 85 s default it
    // is 64 s, which clears the worst measured legitimate hold (51.5 s) by 12.5 s
    // and still fails a 1-seat/40 s "mobbed" ride whose queue holds the full run.
    const stallSecs = Math.max(45, Math.round(0.75 * secs));
    const dt = 1 / 30;
    const steps = Math.round(secs / dt);
    const sampleEvery = 15; // 0.5 s
    interface MoveRec {
      x: number;
      z: number;
      since: number;
    }
    const moved = new Map<number, MoveRec>();
    const stuck = new Set<number>();
    // queue-stall detector: a queue that stays ≥1 for >stallSecs continuous
    // sim-s without EVER shrinking has stalled (late-forming queues are fine)
    const rideSeen = new Map<string, { since: number; prev: number; stalled: boolean }>();
    // ANIMATE NOBODY: this is a behaviour test, not a frame (see setVisuals)
    park.manager.setVisuals?.(false);
    for (let s = 1; s <= steps; s += 1) {
      const time = s * dt;
      park.manager.update(time, dt);
      if (s % sampleEvery !== 0) continue;
      for (const gr of park.manager.guests()) {
        if (gr.hidden || gr.gone) {
          moved.delete(gr.id);
          continue;
        }
        if (gr.state !== 'walking' && gr.state !== 'leavingPark') {
          moved.set(gr.id, { x: gr.position[0], z: gr.position[2], since: time });
          continue;
        }
        const rec = moved.get(gr.id);
        if (!rec || Math.hypot(gr.position[0] - rec.x, gr.position[2] - rec.z) > 0.06) {
          moved.set(gr.id, { x: gr.position[0], z: gr.position[2], since: time });
        } else if (time - rec.since > 25) {
          stuck.add(gr.id);
        }
      }
      for (const r of park.manager.rides()) {
        const rec = rideSeen.get(r.name) ?? { since: -1, prev: 0, stalled: false };
        if (r.queue < rec.prev || r.queue === 0) rec.since = -1; // advanced / drained
        else if (r.queue > 0 && rec.since < 0) rec.since = time; // queue formed
        if (rec.since >= 0 && time - rec.since > stallSecs) rec.stalled = true;
        rec.prev = r.queue;
        rideSeen.set(r.name, rec);
      }
    }
    park.manager.setVisuals?.(true);
    const st = park.manager.stats();
    if (st.riddenTotal < 1) fail('sim', `no guest completed a ride cycle in ${secs} sim-s`);
    stuck.forEach((id) => fail('sim', `guest ${id} stood still >25 sim-s while "walking" — stuck off the graph?`));
    rideSeen.forEach((rec, name) => {
      if (rec.stalled) fail('sim', `${name}: its queue held for >${stallSecs} sim-s without ever advancing`);
    });
  }

  if (warnings.length)
    console.warn(
      `[validatePark] ${warnings.length} build-time lint/auto-fix event(s) recorded (${
        warnings.filter((w) => w.fatal).length
      } §0-FATAL): ${warnings.map((w) => w.kind).join(', ')} — see report.warnings`,
    );
  const t1 = typeof performance !== 'undefined' ? performance.now() : Date.now();
  return { ok: failures.length === 0, failures, warnings, simSeconds: simSecondsRun, ms: Math.round(t1 - t0) };
}

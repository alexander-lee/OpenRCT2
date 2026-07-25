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
import { obbOverlap } from './placement';
import type { ParkFootRect } from './placement';

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
//   b2. planted SCENERY (round-6) — every <Scenery>/<Placed> footprint must
//      stand on DRY ground and OUT of the rendered path slabs (plaza
//      dressing exempt): a statue in the main street / a willow in the river
//   c. footprints — OBB SAT sweep over every audited rect (no overlaps) +
//      any residual placeAccess collision (manager.accessAudit) is a FAIL
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

/** MINIMUM sim seconds the smoke check steps the manager through (the real
 *  window scales with the longest registered rideDuration — see the report's
 *  `simSeconds`) */
export const SIM_SMOKE_SECONDS = 60;
const MESH_BUDGET = 2500;
const CRASH_MARGIN = 0.85; // worst lateral G must stay under 1.5 g × this

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
}


/** structural view of the createGameManager return (only what's validated) */
export interface ValidateParkManager {
  update(time: number, dt: number): void;
  stats(): { riddenTotal: number; activeGuests: number };
  guests(): { id: number; state: string; position: [number, number, number]; hidden?: boolean; gone?: boolean }[];
  rides(): { name: string; status: string; queue: number; rideDuration?: number }[];
  accessPoints?(): { entranceNode: number; rides: { name: string; queueNode: number; exitNode: number }[] };
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

  // ---- f. budget + determinism FIRST (the hash must see the pre-sim scene) --
  if (park.group) {
    let meshes = 0;
    park.group.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) meshes += 1;
    });
    // the mesh budget scales ~linearly with plot AREA (the classic ~2500 was
    // computed for a 16² plot — a default 48 plot earns 9×) and exceeding it
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
    let bodies = 0;
    for (let idx = 0; idx < n * n; idx += 1) {
      if (!wet[idx] || seen[idx]) continue;
      bodies += 1;
      const stack = [idx];
      seen[idx] = 1;
      while (stack.length) {
        const c = stack.pop()!;
        const ci = Math.floor(c / n);
        const cj = c % n;
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
    }
    if (bodies !== 1) fail('terrain', `${bodies} water bodies below the waterline (the composition demands exactly 1)`);

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

  // ---- c. footprint no-overlap OBB sweep ------------------------------------
  {
    const rects = park.footprints ?? park.manager.footprints?.() ?? [];
    const rideOf = (label: string) => label.replace(/ (entrance hut|exit hut|queue lane|boardPoint pad)$/, '');
    const kindOf = (label: string) => (label.endsWith('entrance hut') ? 'ent' : label.endsWith('queue lane') ? 'lane' : 'other');
    const failedPairs = new Set<string>();
    for (let i = 0; i < rects.length; i += 1)
      for (let j = i + 1; j < rects.length; j += 1) {
        const a = rects[i];
        const b = rects[j];
        // a ride's own entrance hut and queue lane abut by design (placeAccess exempts them)
        if (rideOf(a.label) === rideOf(b.label)) {
          const ka = kindOf(a.label);
          const kb = kindOf(b.label);
          if ((ka === 'ent' && kb === 'lane') || (ka === 'lane' && kb === 'ent')) continue;
        }
        if (obbOverlap(a, b)) {
          fail('footprints', `${a.label} overlaps ${b.label}`);
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
    // a queue legitimately holds for one full ride cycle before it can advance
    const stallSecs = Math.max(30, maxDur + 15);
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
  return { ok: failures.length === 0, failures, warnings, simSeconds: simSecondsRun };
}

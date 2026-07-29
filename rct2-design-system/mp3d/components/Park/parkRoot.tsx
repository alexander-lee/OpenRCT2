import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { Stage } from '../Stage';
import type { StageApi, StageQuality } from '../Stage';
import { auditWorldThemes, climateOf, parkPlanLints, seedTableRow, validatePark, SEED_TABLE_128_BAND, SEED_TABLE_SIZE, SIM_SMOKE_SECONDS } from '../ParkBuilder';
import type { ParkClimate, ParkFootRect, ParkValidationReport } from '../ParkBuilder';
import { RideViewer } from '../RideViewer';
import { GuestInfo } from '../GuestInfo';
import type { GuestInfoRecord } from '../GuestInfo';
import { ParkInfo } from '../ParkInfo';
import { createParkRuntime, guestCapForSize, guestsForSize, makeStore, ParkReactContext, usePark } from './parkContext';
import type { GameMgr, ParkStore, RideHandle, V3 } from './parkContext';
import { resolveCorridorConflicts, resolvePadOnStreet, stallFootRect } from './configurableRide';

// ---- <Park> ------------------------------------------------------------------

/** THE PERF LINE's poll cadence, in ms. ≥300 ms per rules/ui.md — `api.stats()`
 *  walks the scene for its light census, so it is not a per-frame call. */
const PERF_POLL_MS = 500;
/** consecutive IDENTICAL draw-call samples that mean "the scene stopped growing".
 *  4 → 5 samples → 2 s of quiet, which clears the gate stream's arrival gaps. */
const PERF_STABLE_POLLS = 4;
/** hard cap on the poll window (60 × 500 ms = 30 s). Past it the line prints
 *  anyway, marked `STILL RISING` — a low number that says so beats silence. */
const PERF_MAX_POLLS = 60;

/** the plot-scaled opening population + hard population ceiling (defined in
 *  ./parkContext, where the GameManager is wired) — re-exported here because
 *  they are `<Park guests>`'s default and the gate stream's ceiling */
export { guestsForSize, guestCapForSize } from './parkContext';

/** DEFAULT ORBIT RADIUS for a plot. Up to the classic 48 this is the old
 *  `size * 1.19` exactly; past it the radius grows only ~0.3 u per extra unit
 *  of plot, so a 128 park opens FRAMED ON ITS ENTRANCE DISTRICT (rides at a
 *  readable size, the land running off into haze behind) instead of as a green
 *  postage stamp seen from 150 u up. Scroll/zoom still reaches the far corners
 *  — the dolly ceiling is `max(distance * 3, 24)`. */
export const orbitRadiusFor = (size: number) => (size <= 48 ? size * 1.19 : 48 * 1.19 + (size - 48) * 0.18);

/** DEFAULT ORBIT TARGET for a plot. `<Gate>` always lands on the FRONT EDGE
 *  (z ≈ size/2 − 0.8), so on a vast plot the geometric centre is ~63 u behind
 *  the park and an origin-targeted camera opens on empty middle-distance. Big
 *  plots therefore target the ENTRANCE DISTRICT instead; ≤48 keeps the classic
 *  origin target exactly. The 15-u pull-back is a FRACTION of the plot from the
 *  2026-07 128 rescale (`size * 0.117`, = the old 15 u at 128 to within 3 cm),
 *  so the entrance district fills the same share of the frame at every size
 *  instead of the camera creeping toward the middle as plots shrink. */
export const orbitTargetFor = (size: number): V3 => (size <= 48 ? [0, 0.4, 0.6] : [0, 0.4, size / 2 - size * 0.117]);

/** DEFAULT CULLING FOG for a plot. ≤48 keeps the classic `size*1.3 → size*2.6`
 *  wall. Bigger plots scale the wall off the ORBIT RADIUS instead of the plot,
 *  so the haze sits at a constant apparent depth however vast the land is (a
 *  128 plot with a size-scaled wall would put the fog 166-333 u out, i.e. never
 *  in shot). The surround skirt is then sized to end exactly on `far`. */
export const fogRangeFor = (size: number) => {
  if (size <= 48) return { near: size * 1.3, far: size * 2.6 };
  const r = orbitRadiusFor(size);
  // `far` also sets the camera far plane (Stage clips at far*1.05), so it must
  // stay past the diagonal of a fully-pulled-out orbit or the far corner of the
  // plot gets clipped instead of hazed — hence the `size * 1.85` floor.
  return { near: Math.max(size * 0.85, r * 1.3), far: Math.max(size * 1.85, r * 2.6) };
};

type PickState =
  | { kind: 'ride'; handle: RideHandle; vehicle?: THREE.Object3D }
  | { kind: 'guest'; accessor: () => GuestInfoRecord & { gone?: boolean }; object: THREE.Object3D };

export interface ParkProps {
  /** master seed — every child defaults its randomness off it */
  seed?: number;
  /** park climate (default hashed from the seed, `climateOf`) */
  climate?: ParkClimate;
  /** terrain edge length in tile-units. Default **128** (2026-07; wave 8's
   *  default was 192 and it was a THIRD too big — the land read as an empty
   *  green field with the rides lost in it). New parks still open on an
   *  EXPANSIVE plot — 2⅔× the old 48 in every direction, 7.1× the ground — but
   *  a district-to-district walk is now ~40 u instead of ~60. It stays cheap
   *  because nothing scales with AREA: the terrain is one mesh whose segment
   *  count grows with the plot EDGE, the surround skirt is one draw call,
   *  culling fog trims the far field and the ride runtime's LOD tiers throttle
   *  everything past ~60 u. Pass a smaller size for compact scenes (< 24 keeps
   *  the classic flat landform, bit-identical). Plots ≥ 64 compose TWO water
   *  bodies (a dominant one + a secondary); ≤ 48 keeps the classic single body. */
  size?: number;
  /** parks render full-screen by default (rules/ui.md) */
  fullscreen?: boolean;
  /** canvas height when `fullscreen` is off (preview embeds) */
  height?: number;
  /** run `validatePark` once the children settle (default true) — the report
   *  is logged and passed to `onReady`; the sim-smoke clock shift is applied
   *  to the render clock automatically */
  validate?: boolean;
  /** OPENING POPULATION — guests that file in through the gate once the park
   *  settles. Default `guestsForSize(size)`: ~50 on the 128 default plot, 13 on
   *  a 16, 26 on a 48, 66 on a 192 (the crowd grows with the cube root of plot
   *  area — see `guestsForSize` for the measurement it is fitted to).
   *
   *  This is only the OPENING crowd: while the park is well run, more guests
   *  keep arriving THROUGH the gate on RCT2's own guest-generation curve, up to
   *  `guestCapForSize(size)` (GameManager `arrivals.ts`). Pass an explicit
   *  number for a park that must open on an exact roster. */
  guests?: number;
  /** THE §0 HEADER'S ROSTER CLAIM, machine-readable (wave-10 P3). §0.16 makes
   *  every park header publish a roster line; restate it here and
   *  `validatePark` compares it with what actually REGISTERED, warning
   *  `rosterOverstated` when the park under-delivers. Prefer NAMES to counts —
   *  then the warning names the ride that never registered:
   *
   *  ```tsx
   *  <Park roster={{ rides: ['Timberline Racer', 'Briarwood Gallopers'], categories: 5 }}>
   *  ```
   *
   *  Round 9's park A claimed "9 registered rides, 5 categories" and shipped
   *  8 rides in 3 categories, with the dropped ride's own comment still in the
   *  file. Write the line LAST, from the registration. */
  roster?: { rides?: number | string[]; stalls?: number | string[]; categories?: number | string[] };
  background?: string;
  /** Stage fog override — default: classic haze, or `{ near, far }` culling
   *  fog on parks over 20 units */
  fog?: boolean | { near: number; far: number };
  /** orbit radius override (default `orbitRadiusFor(size)`) */
  distance?: number;
  /** opening camera pose (default: a gate-front three-quarter view) */
  cameraPose?: { position: V3; target?: V3 };
  /** Stage rendering quality tier (default 'medium' for composed parks —
   *  pixel-ratio 1.5 + 1024² shadows are invisible from the orbit cam at park
   *  scale; previews stay 'high') */
  quality?: StageQuality;
  /** explicit scene budgets enforced by the ride runtime. `lights` = max
   *  simultaneously ACTIVE PointLights across all mounted objects
   *  (nearest-to-camera win). **OPT-IN: there is no default cap.** It used to
   *  default to 16, which culled every light past the camera's immediate
   *  neighbourhood — see parkContext's LIGHTS ARE NO LONGER THROTTLED note for
   *  what that cost night mode and why measurement did not find the frame it
   *  was supposed to buy. Pass a number only for a scene you have measured. */
  budgets?: { lights?: number };
  onReady?(report: ParkValidationReport | null, park: { manager: GameMgr | null; api: StageApi }): void;
  children?: React.ReactNode;
}

/**
 * ONE shared canvas for a whole composed park. Renders a single Stage
 * (fullscreen, autoRotate OFF, fog, groundAt wired by <Terrain>), owns the
 * one GameManager, wires clickability (ride click → RideViewer, guest click
 * → GuestInfo — one floating window at a time), mounts ParkInfo bottom-right
 * and runs `validatePark` one frame after the children mount.
 */
export function Park({
  seed = 1,
  climate,
  size = 128,
  fullscreen = true,
  height = 620,
  validate = true,
  guests = guestsForSize(size),
  roster,
  background = '#a8cdd9',
  fog,
  distance,
  cameraPose,
  quality = 'medium',
  budgets,
  onReady,
  children,
}: ParkProps) {
  const [ctx, setCtx] = useState<ParkStore | null>(null);
  const [mgrReady, setMgrReady] = useState<GameMgr | null>(null);
  const [picked, setPicked] = useState<PickState | null>(null);
  const [, setTick] = useState(0);
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;
  const settledRef = useRef(false);
  /** the gate's own wall-clock cost, for the perf line (null until it runs) */
  const validateMsRef = useRef<number | null>(null);

  // live guest window: poll the accessor every 250 ms (never per frame)
  useEffect(() => {
    if (picked?.kind !== 'guest') return;
    const id = setInterval(() => setTick((n) => n + 1), 250);
    return () => clearInterval(id);
  }, [picked]);
  const guestRec = picked?.kind === 'guest' ? picked.accessor() : null;
  useEffect(() => {
    if (guestRec?.gone) setPicked(null);
  }, [guestRec?.gone]);

  // settle + validate: children mounted in THIS commit (their effects ran
  // before this one), so one frame later the park is complete
  useEffect(() => {
    if (!ctx || settledRef.current) return;
    settledRef.current = true;
    // ---- THE PERF LINE (SETUP.md §13) --------------------------------------
    //
    // IT USED TO MEASURE A HALF-BUILT PARK. This was a bare
    // `setTimeout(…, 3000)` armed HERE, i.e. before `ctx.whenBuilt()` had
    // drained the time-sliced build queue — and then it fired whether or not
    // the park existed yet. Measured on DemoPark (size 16, the smallest park in
    // the repo) against `harness/mp3d-render/probe-render-cost.mjs`:
    //
    //   the old line      293 draws · 0.14M tris ·  7 lights ·  9 runtime entries
    //   the real park    1804 draws · 0.41M tris · 24 lights · 29 runtime entries
    //
    // It under-reported the park it was measuring by ~6x, which is why nobody
    // could see that a park was spending 42% of its frame on switched-off lamps.
    // It is now (a) armed only after the build queue drains and validatePark has
    // run — see the end of the `whenBuilt` callback below — and (b) POLLED until
    // the scene stops growing rather than printed on a fixed timer, because the
    // gate stream keeps admitting guests for seconds after `onReady` (DemoPark
    // asks for 10 and settles at 22). If it gives up before the counts settle it
    // says `STILL RISING` rather than quietly printing a low number.
    let perfPoll = 0;
    const armPerfLine = () => {
      let last = -1;
      let stable = 0;
      let polls = 0;
      perfPoll = window.setInterval(() => {
        polls += 1;
        const s = ctx.api.stats?.();
        if (!s) {
          window.clearInterval(perfPoll);
          return;
        }
        stable = s.drawCalls === last ? stable + 1 : 0;
        last = s.drawCalls;
        const settled = stable >= PERF_STABLE_POLLS;
        if (!settled && polls < PERF_MAX_POLLS) return;
        window.clearInterval(perfPoll);
        // JS HEAP + GATE COST (2026-07 128 rescale): plot-size changes need
        // measured numbers, and draws/tris alone hide both the terrain mesh's
        // vertex buffers (a 284² heightfield is ~10 MB of attributes) and the
        // gate's cost. `performance.memory` is Chromium-only — omitted elsewhere.
        const mem = (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory;
        const heap = mem ? ` · ${(mem.usedJSHeapSize / 1048576).toFixed(1)}MB heap` : '';
        const gate = validateMsRef.current === null ? '' : ` · ${validateMsRef.current}ms validate`;
        // lights: ACTIVE (in the forward shaders) + how many the dark-light cull
        // shed because they are night-gated and it is day (Stage/darkLights.ts)
        const culled = s.lightsCulled ? ` (+${s.lightsCulled} dark, culled)` : '';
        console.info(
          `[Park] perf: ${s.drawCalls} draws · ${(s.triangles / 1e6).toFixed(2)}M tris · ${s.fps} fps · ${s.frameMs}ms CPU${heap}${gate} · ${s.lights} active lights${culled} · ${ctx._entries.size} runtime entries${
            settled ? '' : ' — STILL RISING, the scene had not settled inside the poll window'
          }`,
        );
      }, PERF_POLL_MS);
    };
    // WAIT FOR THE BUILD QUEUE, not for one frame. Children now mount through
    // the store's time-sliced build queue (parkContext `enqueueBuild`), so a
    // single requestAnimationFrame would run validatePark against a park that
    // is still assembling — it would read missing rides and fail everything.
    // `whenBuilt` fires the moment the queue drains (immediately if the park
    // was small enough to finish inside one frame).
    let cancelled = false;
    ctx.whenBuilt((sync) => {
      if (cancelled) return;
      // HOLD THE SIM until the gate below has run — the settle pass, the
      // reveal and validatePark's smoke run all happen at t = 0 (see the
      // ParkStore `_settling` doc: real frames carrying the manager forward
      // before the smoke run is what puts every FSM timer in the future).
      ctx._settling = true;
      // an explicitly declared <GameManager/> creates the sim even when no
      // ride/gate touched manager() yet (needs <Terrain> + <Paths>)
      if (ctx._gm && !ctx._managerInst && ctx.ground && ctx.paths) ctx.manager();
      const mgr = ctx._managerInst;
      if (mgr) {
        if (!ctx._gm)
          console.info('[Park] legacy mode: sim created without a <GameManager/> child — declare <GameManager/> right after <Paths/> (the explicit way)');
        // ---- round-5 self-healing settle pass (order matters, BEFORE guests
        // spawn and BEFORE validatePark reads anything) --------------------
        // 1. corridor auto-resolution: shift movable stalls/flat-ride rigs out
        //    of the registered coasters' 1.6-u track corridors
        // 0. PAD-ON-STREET auto-correction (wave-11 P0): a pad standing in the
        //    walked slab severs the network behind it, so it is corrected to
        //    the cell the lint already computed BEFORE the corridor pass runs
        resolvePadOnStreet(ctx, mgr);
        resolveCorridorConflicts(ctx, mgr);
        // 2. AUTO-keepDry: re-run the terrain guard clamp over EVERY audited
        //    footprint (derived/trimmed/flipped/shifted lanes+huts included)
        //    + the as-built circuits, and rebuild the terrain in place — the
        //    authors' keepDry list is a hint, not a requirement
        if (ctx._reclamp) {
          const rects: ParkFootRect[] = [
            ...(mgr.footprints?.() ?? []),
            ...ctx._extraFootprints,
            ...(mgr.stalls?.() ?? []).map(stallFootRect),
            // round-7: PLANTED scenery/trees join the sweep too. The guard
            // clamp already dried every registered footprint; a <Scenery>
            // planter standing in a shoreline dip was merely DETECTED by the
            // wave-6 dryness gate. Now the same clamp raises a dry bank under
            // it (open-water spots are refused at mount instead — a tree in
            // the middle of the lake is a re-plan, not a landscaping job).
            ...ctx._planted.map((p) => ({ cx: p.x, cz: p.z, hx: p.r, hz: p.r, yaw: 0, label: p.label })),
          ];
          const pts = ctx._coasters.filter((c) => !c.fatal).flatMap((c) => c.points);
          ctx._reclamp(rects, pts);
        }
        // 3. SHARED QUEUE TAIL audit (round-7): two rides whose lanes attach
        //    to the SAME street node stack their tails on one cell — the
        //    footprint sweep catches the overlap, but only after the fact and
        //    without naming the cause. Round-7's family park landed its Swings
        //    tail on the coaster's own tail node.
        {
          const acc = mgr.accessPoints?.();
          if (acc) {
            const byNode = new Map<number, string[]>();
            acc.rides.forEach((r) => {
              if (r.queueNode < 0) return;
              byNode.set(r.queueNode, [...(byNode.get(r.queueNode) ?? []), r.name]);
            });
            byNode.forEach((names, node) => {
              if (names.length < 2) return;
              const cell = ctx.paths?.net.nodes[node];
              ctx.reportLint(
                'queueTailShared',
                `${names.join(' and ')} attach their queue tails to the SAME street node ${node}${
                  cell ? ` [${cell[0].toFixed(1)}, ${cell[1].toFixed(1)}]` : ''
                } — one cell cannot be the entrance to two queues (the lanes overlap and guests join the wrong one). Give every ride its OWN tail node (§0.4)`,
                true,
              );
            });
          }
        }
        // ---- P0-A: replay the PLAN-TIME LINT BUS ---------------------------
        // A park's set-piece plans and its buildParkNet call run at MODULE
        // SCOPE, long before this effect. Anything they had to degrade around
        // (a diagonal boulevard L-routed, an unknown port, a dropped edge, a
        // NET.warning) was recorded there; hand it to the gate now so §0's
        // FATAL-WARNINGS POLICY applies to plan defects too.
        parkPlanLints().forEach((l) => ctx.reportLint(l.kind, l.detail, l.fatal));
        // ---- WORLD THEME COHERENCE (worlds) --------------------------------
        // Every `<World plan={…}>` registered a REGION and every catalog
        // component stamped its own kind (`tagComponent`), so the whole audit is
        // one sweep: which worlds exist, what each one holds, and every themed
        // piece standing in a world of a DIFFERENT theme (§3). Runs AFTER the
        // corridor/keepDry settle pass so it reads final positions, and BEFORE
        // the gate, which reports its findings as warnings (check b3). It is
        // also published on the store, which is what the eval harness's
        // `probe.worlds` reads.
        ctx._worldAudit = auditWorldThemes(ctx.root, ctx._worlds);
        mgr.spawnGuests(ctx._gm?.guests ?? guests);
        setMgrReady(mgr);
      }
      // ---- OPEN THE PARK ---------------------------------------------------
      // Everything the build queue mounted has been invisible until now
      // (parkContext `addObject`), and this is the first moment it is safe to
      // show: the settle pass above has re-clamped the terrain, moved the
      // pads out of the street and shifted the corridor conflicts, so the park
      // appears in its FINAL arrangement instead of visibly rearranging
      // itself. Then compile every program ONCE, here, at the light count the
      // settled park actually renders with — three.js keys the program cache
      // on that count, so the alternative is paying for the same 26 shaders
      // again at every intermediate count the assembly passed through.
      const shown = ctx.revealBuilt();
      {
        const r = ctx.api.renderer as THREE.WebGLRenderer & {
          compileAsync?: (scene: THREE.Object3D, camera: THREE.Camera) => Promise<unknown>;
        };
        try {
          // compileAsync links in parallel where the driver supports it
          // (KHR_parallel_shader_compile) and falls back to the blocking path
          // itself; three ≤ r151 has no such method at all.
          if (typeof r.compileAsync === 'function') void r.compileAsync(ctx.api.scene, ctx.api.camera);
          else r.compile(ctx.api.scene, ctx.api.camera);
        } catch (e) {
          console.warn('[Park] shader pre-compile skipped:', e); // the first frame pays instead
        }
      }
      // ---- THE ACCEPTANCE GATE, ONE PAINT LATER ----------------------------
      // validatePark is a DEV gate that costs real time on a real park (1.8 s
      // on parkA-99 at --throttle=4, measured with probe-assembly.mjs) and it
      // used to run in this same task — so the very moment the park was ready
      // to be seen, the main thread locked for the length of the gate. It runs
      // after a paint now: the park is on screen and orbitable first, the
      // report lands a frame later, and `_settling` keeps the sim clock frozen
      // across the gap so the smoke run still starts from t = 0.
      const gate = () => {
        if (cancelled) {
          ctx._settling = false;
          return;
        }
        let report: ParkValidationReport | null = null;
        if (mgr && validate && ctx.ground && ctx.paths) {
          report = validatePark(ctx.three, {
            net: ctx.paths.net,
            manager: mgr,
            terrain: {
              heightAt: ctx.ground.heightAt,
              waterLevel: ctx.ground.waterLevel,
              size: ctx.ground.size,
              peaks: ctx.ground.comp.peaks,
            },
            coasters: ctx._coasters,
            footprints: ctx._extraFootprints.length ? [...mgr.footprints(), ...ctx._extraFootprints] : undefined,
            group: ctx.root,
            gridNodeCount: ctx.paths.streetNodes, // spur attaches stay exempt from the N/S/E/W check
            pathY: ctx.paths.pathY, // corridor sweep: grade-crossing clearance is measured above the slabs
            // round-6 safeguards: the scenery-vs-path/dryness audit + §0's
            // FATAL-WARNINGS POLICY (auto-fixes reach the gate, not just the
            // console — see parkContext's ParkLint)
            plazas: ctx.paths.plazas,
            planted: ctx._planted,
            // wave-11 P2: the guard list the composition was probed with, so a
            // `waterRePicked` failure can name the cell that forced the re-pick
            keepDry: ctx.ground.keepDry as [number, number][] | undefined,
            // the WORLD THEME COHERENCE audit (§3) — skipped entirely when the
            // park declares no <World>, so pre-worlds parks are untouched
            worldAudit: ctx._worldAudit ?? undefined,
            lints: ctx._lints,
            // round-2 safeguard: an unsatisfied composition probe is a FAIL,
            // not a console-only warning — pass the probe outcome through
            probeViolations: ctx.ground.comp.report.violations,
            // wave-10 P3: the §0 header's roster claim, so an overstated
            // "9 rides / 5 categories" line cannot pass unnoticed
            roster,
            // wave-9 P4: the §1 SEED TABLE row this (seed, climate, size) was
            // PUBLISHED with, so the gate can tell the park when its water
            // re-picked and the district it planned lost its lake
            expectWater: (() => {
              const row = seedTableRow(seed, ctx.ground.comp.climate, ctx.ground.size);
              if (!row) return undefined;
              const A = ctx.ground.size * ctx.ground.size;
              // BOTH bodies since 2026-07 — the row pins the dominant body and
              // the secondary one, and a park can plan a district against either
              return {
                bodies: [
                  { centre: row.waterCentroid, areaUnits2: row.waterFrac * A },
                  { centre: row.waterCentroid2, areaUnits2: row.waterFrac2 * A },
                ],
                source: `the pinned §1 SEED TABLE row (seed ${row.seed} ${row.climate} @ ${ctx.ground.size})`,
              };
            })(),
            // 2026-07-25: the same, for the GROUND. `comp.report.reliefFloor` is
            // the composition's own audit of what the park's guard list cost its
            // landform (null on ≤48 / unguarded plots); the row + band give the
            // gate the published reference. Without this a park could flatten
            // itself below every §1 row and ship `ok: true` — see check b1.
            expectTerrain: (() => {
              const row = seedTableRow(seed, ctx.ground.comp.climate, ctx.ground.size);
              const floor = ctx.ground.comp.report.reliefFloor ?? null;
              if (!row && !floor) return undefined;
              return {
                floor,
                rowRelief: row?.relief,
                rowStdH: row?.stdH,
                bandRelief: ctx.ground.size === SEED_TABLE_SIZE ? SEED_TABLE_128_BAND.relief[0] : undefined,
                bandStdH: ctx.ground.size === SEED_TABLE_SIZE ? SEED_TABLE_128_BAND.stdH[0] : undefined,
                source: row ? `the pinned §1 SEED TABLE row (seed ${row.seed} ${row.climate} @ ${ctx.ground.size})` : undefined,
              };
            })(),
          });
          // keep render time monotonic after the smoke run (window scales
          // with the longest registered rideDuration)
          ctx._tShift = (report.simSeconds ?? SIM_SMOKE_SECONDS) + 1 / 30;
          validateMsRef.current = report.ms ?? null;
          console.log('[Park] validatePark →', report.ok ? 'ok: true' : JSON.stringify(report.failures, null, 1));
          report.failures.forEach((f) => console.warn(`[Park] validatePark FAIL [${f.check}] ${f.detail}`));
          // round-6: warnings are part of the verdict — §0's FATAL-WARNINGS
          // POLICY means a park with ANY of them still needs re-planning
          if (report.warnings.length)
            console.log(
              `[Park] validatePark warnings (${report.warnings.filter((w) => w.fatal).length} fatal / ${report.warnings.length}) →`,
              JSON.stringify(report.warnings, null, 1),
            );
        } else if (!mgr && validate) {
          // ADDITION 2 (round-8 park B): the harness greps for the
          // `[Park] validatePark → …` line and a park that never produced one was
          // unscoreable. <Park> now ALWAYS emits that exact line — a park with no
          // GameManager has no gate and no rides, which is a FAILED park, not a
          // skipped check.
          console.log(
            '[Park] validatePark →',
            JSON.stringify(
              [
                {
                  check: 'accessibility',
                  detail:
                    'no GameManager was created (no <Gate>/rides mounted, or <Terrain>/<Paths> missing) — nothing to validate: mount <Terrain> → <Paths> → <GameManager/> → <Gate/> → rides',
                },
              ],
              null,
              1,
            ),
          );
          console.warn(
            '[Park] validatePark FAIL [accessibility] no GameManager created (no <Gate>/rides mounted) — validatePark had nothing to check',
          );
        }
        console.info(`[Park] opened — ${shown} streamed object(s) revealed${validate ? '' : ' (validate off)'}`);
        // the gate is done: release the sim clock the settle pass froze
        ctx._settling = false;
        onReadyRef.current?.(report, { manager: mgr ?? null, api: ctx.api });
        // the park is BUILT and validated — only now is a perf number meaningful
        armPerfLine();
      };
      // A caller that drained the queue with `flushBuilds()` (a probe, a test)
      // asked for a complete park in THIS task and is entitled to a synchronous
      // report; the sliced drain gets its paint first.
      if (sync) gate();
      else requestAnimationFrame(() => window.setTimeout(gate, 0));
    });
    return () => {
      cancelled = true; // the queue may still be draining when we unmount
      window.clearInterval(perfPoll);
    };
  }, [ctx, validate, guests]);

  return (
    <div style={{ position: 'relative', width: '100%', height: fullscreen ? '100vh' : height }}>
      <Stage
        fullscreen={fullscreen}
        height={height}
        distance={distance ?? orbitRadiusFor(size)}
        targetY={0.7}
        background={background}
        ground={false}
        autoRotate={false}
        fog={fog ?? (size > 20 ? fogRangeFor(size) : true)}
        quality={quality}
        build={(t, g, api) => {
          if (!api) throw new Error('<Park> requires the StageApi third build argument');
          const store = makeStore(t, g, api, { seed, size, climate: climate ?? climateOf(seed) });
          // NO DEFAULT LIGHT CAP: `budgets.lights` is opt-in (parkContext's LIGHTS ARE
          // NO LONGER THROTTLED note). It used to default to 16, which culled every
          // light past the camera's immediate neighbourhood — night mode's whole point —
          // for a frame saving that measurement could not find.
          const runtime = createParkRuntime(t, store._entries, api, { size, lights: budgets?.lights });
          // opening pose: the classic gate-front three-quarter view, expressed
          // against the ORBIT RADIUS (not the raw plot) so a vast park opens on
          // its entrance district rather than on the whole postage stamp
          const r0 = distance ?? orbitRadiusFor(size);
          const tgt = orbitTargetFor(size);
          // ≤48 keeps the classic absolute pose bit-identical; bigger plots
          // carry the same relative offset around the entrance-district target
          const pos: V3 =
            size <= 48
              ? [r0 * 0.219, r0 * 0.798, -r0 * 0.735]
              : [tgt[0] + r0 * 0.219, tgt[1] + r0 * 0.798, tgt[2] - r0 * 0.735];
          api.setCameraPose?.(cameraPose?.position ?? pos, cameraPose?.target ?? tgt);
          api.onPick?.((obj) => {
            const ud = obj.userData as {
              rideRef?: RideHandle;
              rideVehicle?: THREE.Object3D;
              guestRef?: () => GuestInfoRecord & { gone?: boolean };
              /** GENERIC scenery clickability (round 8): any component may tag
               *  its root group with a `pickRef` callback and get the shared,
               *  occlusion-correct Stage pick — see Stage's `onPick` docs. The
               *  component owns its own window/response; <Park> just delivers
               *  the click, so nothing here needs to know what the scenery is. */
              pickRef?: (o: THREE.Object3D) => void;
            };
            if (ud.rideRef) setPicked({ kind: 'ride', handle: ud.rideRef, vehicle: ud.rideVehicle });
            else if (ud.guestRef) setPicked({ kind: 'guest', accessor: ud.guestRef, object: obj });
            else if (typeof ud.pickRef === 'function') ud.pickRef(obj);
          });
          setCtx(store);
          let last = 0;
          // HOLD THE SIM CLOCK WHILE THE PARK IS STILL ASSEMBLING. Children
          // mount through the store's time-sliced build queue, so frames now
          // render DURING the build. Two reasons the sim must not advance yet:
          // guests should not walk into a park that is still missing half its
          // rides, and validatePark's smoke steps `manager.update(s · dt)` from
          // ~0 — if real frames had already carried the manager to t ≈ 8 s, the
          // smoke REWINDS its clock and every FSM timer lands in the future.
          // That surfaced as a flat "no guest completed a ride cycle in 60
          // sim-s" failure on a park whose build logs were otherwise identical.
          //
          // BUT THE HOLD MUST NOT SKIP THE COMPONENT UPDATERS, and it used to.
          // Returning early skipped `runtime.tick` as well as the manager, and
          // `runtime.tick` is what calls each component's `update` — which is
          // where the fleet's NIGHT GATE lives (a lamp lerps `intensity` from 0
          // by day up to its lit value as `nightKOf()` rises). With the updaters
          // never running during assembly, every lamp kept the intensity it was
          // CONSTRUCTED with, i.e. lit, all the way through the build.
          //
          // That is not a lighting bug — it is the park's biggest load stall,
          // because three.js bakes the VISIBLE LIGHT COUNT into every material's
          // program cache key. Measured on `harness/park-eval/samples/parkA-99`
          // (size 128, 178 night-gated lamps) on a real Apple M4 Pro with
          // `harness/mp3d-render/probe-assembly.mjs`: the visible point-light
          // count climbed to 83 during the build and collapsed to 8 the instant
          // the queue drained and the gates finally ran — and the single frame
          // that rendered at 83 lights cost **828 ms** to compile, on top of a
          // shader cache inflated to 181 programs where the park only has 23
          // distinct shaders.
          //
          // So: run the updaters at the FROZEN clock with `dt` 0. Every gate
          // applies on the frame its component mounts (and `Stage/darkLights.ts`
          // then sheds it before it is ever drawn), while `t` does not advance
          // and the manager is not stepped — which is exactly what the two
          // reasons above require. `dt` 0 also means no LOD demotion grace
          // accrues and no light-budget re-sort fires, so the frozen park holds
          // its t=0 pose rather than creeping.
          let held = 0;
          // Ticking during the build means `createParkRuntime`'s `classify()` now
          // runs on entries that may not be FULL yet: `addObject` can register a
          // group that a later queued build still adds meshes to, and classify
          // measures a bounding box ONCE and latches `ready`. A stale radius
          // feeds the LOD tier decision, so an entry could shed its `lodDetail`
          // children at the wrong distance for the rest of the session. So the
          // whole set is re-classified on the single frame the queue drains,
          // against final geometry. (`classify` is a Box3 per entry — 120 of them
          // once, i.e. the same work the first tick used to do anyway.)
          let wasBuilding = false;
          return (time) => {
            // `_settling` extends the hold across the reveal + the deferred
            // acceptance gate, which now span a paint (see the gate above).
            if (store._buildQ.length || store._settling) {
              held = time; // freeze: the park is not finished mounting
              wasBuilding = true;
              runtime.tick(store._tShift, 0); // gates yes, sim clock no
              return;
            }
            if (wasBuilding) {
              wasBuilding = false;
              store._entries.forEach((e) => { e.ready = false; });
            }
            const t = time - held; // sim time starts when the park is complete
            const dt = Math.min(Math.max(t - last, 0), 0.1);
            last = t;
            const tt = t + store._tShift;
            runtime.tick(tt, dt);
            store._managerInst?.update(tt, dt);
          };
        }}
      />
      {ctx ? <ParkReactContext.Provider value={ctx}>{children}</ParkReactContext.Provider> : null}
      {ctx && picked?.kind === 'ride' && (
        <RideViewer ride={picked.handle} api={ctx.api} vehicle={picked.vehicle} onClose={() => setPicked(null)} />
      )}
      {ctx && guestRec && !guestRec.gone && (
        <GuestInfo
          guest={guestRec}
          api={ctx.api}
          object={picked?.kind === 'guest' ? picked.object : undefined}
          onClose={() => setPicked(null)}
        />
      )}
      {ctx && mgrReady && <ParkInfo manager={mgrReady} api={ctx.api} />}
    </div>
  );
}

// ---- <GameManager> — the declarative sim brain -------------------------------------------

export interface GameManagerProps {
  /** OPENING POPULATION override for `<Park guests>` (same meaning: the crowd
   *  that files in through the gate at settle; more keep arriving on RCT2's
   *  guest-generation curve up to the size-scaled ceiling) */
  guests?: number;
}

/**
 * Declares the park's ONE GameManager explicitly — THE way to turn a
 * composition into a living park: `<Park><GameManager/><Terrain/><Paths/>
 * <Gate/>…rides…</Park>`. Once it is mounted ALL the game logic comes for
 * free: guest spawning/needs/goals, every registered ride's FSM (waiting →
 * departing → travelling → breakdowns → repairs), queue flow, purchases,
 * litter, plus the UI suite — ParkInfo rows, click-a-ride → RideViewer (live
 * + onboard cams), click-a-guest → GuestInfo. Without it (and without any
 * registering child) a <Park> is a static diorama.
 *
 * Mount order is flexible: the underlying manager is created the moment
 * <Terrain> + <Paths> exist (or lazily by the first <Gate>/ride/stall).
 * Legacy compositions that never mount <GameManager/> keep working —
 * usePark().manager() still creates it — with a console note.
 */
export function GameManager({ guests }: GameManagerProps) {
  const park = usePark('GameManager');
  useEffect(() => {
    (park as ParkStore)._gm = { guests };
    if (park.ground && park.paths) park.manager(); // create now when terrain+paths are already up
    // no cleanup — the sim (and its registrations) lives for the <Park>'s lifetime
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [park]);
  return null;
}

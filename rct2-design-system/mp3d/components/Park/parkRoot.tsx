import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { Stage } from '../Stage';
import type { StageApi, StageQuality } from '../Stage';
import { climateOf, validatePark, SIM_SMOKE_SECONDS } from '../ParkBuilder';
import type { ParkClimate, ParkFootRect, ParkValidationReport } from '../ParkBuilder';
import { RideViewer } from '../RideViewer';
import { GuestInfo } from '../GuestInfo';
import type { GuestInfoRecord } from '../GuestInfo';
import { ParkInfo } from '../ParkInfo';
import { createParkRuntime, makeStore, ParkReactContext, usePark } from './parkContext';
import type { GameMgr, ParkStore, RideHandle, V3 } from './parkContext';
import { resolveCorridorConflicts, stallFootRect } from './configurableRide';

// ---- <Park> ------------------------------------------------------------------

/** DEFAULT ORBIT RADIUS for a plot. Up to the classic 48 this is the old
 *  `size * 1.19` exactly; past it the radius grows only ~0.3 u per extra unit
 *  of plot, so a 192 park opens FRAMED ON ITS ENTRANCE DISTRICT (rides at a
 *  readable size, the land running off into haze behind) instead of as a green
 *  postage stamp seen from 230 u up. Scroll/zoom still reaches the far corners
 *  — the dolly ceiling is `max(distance * 3, 24)`. */
export const orbitRadiusFor = (size: number) => (size <= 48 ? size * 1.19 : 48 * 1.19 + (size - 48) * 0.18);

/** DEFAULT ORBIT TARGET for a plot. `<Gate>` always lands on the FRONT EDGE
 *  (z ≈ size/2 − 0.8), so on a vast plot the geometric centre is ~95 u behind
 *  the park and an origin-targeted camera opens on empty middle-distance. Big
 *  plots therefore target the ENTRANCE DISTRICT instead; ≤48 keeps the classic
 *  origin target exactly. */
export const orbitTargetFor = (size: number): V3 => (size <= 48 ? [0, 0.4, 0.6] : [0, 0.4, size / 2 - 15]);

/** DEFAULT CULLING FOG for a plot. ≤48 keeps the classic `size*1.3 → size*2.6`
 *  wall. Bigger plots scale the wall off the ORBIT RADIUS instead of the plot,
 *  so the haze sits at a constant apparent depth however vast the land is (a
 *  192 plot with a size-scaled wall would put the fog 250-500 u out, i.e. never
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
  /** terrain edge length in tile-units. Default 192 — new parks open on a
   *  VAST plot (RCT2 parks sprawl; 4× the old 48 in every direction, 16× the
   *  ground). It stays cheap because nothing scales with AREA: the terrain is
   *  one mesh whose segment count grows with the plot EDGE, the surround skirt
   *  is one draw call, culling fog trims the far field and the ride runtime's
   *  LOD tiers throttle everything past ~60 u. Pass a smaller size for compact
   *  scenes (< 24 keeps the classic flat landform, bit-identical). */
  size?: number;
  /** parks render full-screen by default (rules/ui.md) */
  fullscreen?: boolean;
  /** canvas height when `fullscreen` is off (preview embeds) */
  height?: number;
  /** run `validatePark` once the children settle (default true) — the report
   *  is logged and passed to `onReady`; the sim-smoke clock shift is applied
   *  to the render clock automatically */
  validate?: boolean;
  /** guests spawned at the gate once the park settles (default 12) */
  guests?: number;
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
  /** explicit scene budgets enforced by the ride runtime:
   *  `lights` = max simultaneously ACTIVE PointLights across all mounted
   *  objects (nearest-to-camera win; default 16) */
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
  size = 192,
  fullscreen = true,
  height = 620,
  validate = true,
  guests = 12,
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
    // perf probe once the runtime + budgets have settled (SETUP.md §13)
    const perfTimer = window.setTimeout(() => {
      const s = ctx.api.stats?.();
      if (s)
        console.info(
          `[Park] perf: ${s.drawCalls} draws · ${(s.triangles / 1e6).toFixed(2)}M tris · ${s.fps} fps · ${s.frameMs}ms CPU · ${s.lights} active lights · ${ctx._entries.size} runtime entries`,
        );
    }, 3000);
    const raf = requestAnimationFrame(() => {
      // an explicitly declared <GameManager/> creates the sim even when no
      // ride/gate touched manager() yet (needs <Terrain> + <Paths>)
      if (ctx._gm && !ctx._managerInst && ctx.ground && ctx.paths) ctx.manager();
      const mgr = ctx._managerInst;
      let report: ParkValidationReport | null = null;
      if (mgr) {
        if (!ctx._gm)
          console.info('[Park] legacy mode: sim created without a <GameManager/> child — declare <GameManager/> right after <Paths/> (the explicit way)');
        // ---- round-5 self-healing settle pass (order matters, BEFORE guests
        // spawn and BEFORE validatePark reads anything) --------------------
        // 1. corridor auto-resolution: shift movable stalls/flat-ride rigs out
        //    of the registered coasters' 1.6-u track corridors
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
        mgr.spawnGuests(ctx._gm?.guests ?? guests);
        if (validate && ctx.ground && ctx.paths) {
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
            lints: ctx._lints,
            // round-2 safeguard: an unsatisfied composition probe is a FAIL,
            // not a console-only warning — pass the probe outcome through
            probeViolations: ctx.ground.comp.report.violations,
          });
          // keep render time monotonic after the smoke run (window scales
          // with the longest registered rideDuration)
          ctx._tShift = (report.simSeconds ?? SIM_SMOKE_SECONDS) + 1 / 30;
          console.log('[Park] validatePark →', report.ok ? 'ok: true' : JSON.stringify(report.failures, null, 1));
          report.failures.forEach((f) => console.warn(`[Park] validatePark FAIL [${f.check}] ${f.detail}`));
          // round-6: warnings are part of the verdict — §0's FATAL-WARNINGS
          // POLICY means a park with ANY of them still needs re-planning
          if (report.warnings.length)
            console.log(
              `[Park] validatePark warnings (${report.warnings.filter((w) => w.fatal).length} fatal / ${report.warnings.length}) →`,
              JSON.stringify(report.warnings, null, 1),
            );
        }
        setMgrReady(mgr);
      } else if (validate) {
        console.info('[Park] no GameManager created (no <Gate>/rides mounted) — validatePark skipped');
      }
      onReadyRef.current?.(report, { manager: mgr ?? null, api: ctx.api });
    });
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(perfTimer);
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
          const runtime = createParkRuntime(t, store._entries, api, { size, lights: budgets?.lights ?? 16 });
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
            };
            if (ud.rideRef) setPicked({ kind: 'ride', handle: ud.rideRef, vehicle: ud.rideVehicle });
            else if (ud.guestRef) setPicked({ kind: 'guest', accessor: ud.guestRef, object: obj });
          });
          setCtx(store);
          let last = 0;
          return (time) => {
            const dt = Math.min(Math.max(time - last, 0), 0.1);
            last = time;
            const tt = time + store._tShift;
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
  /** guests spawned at the gate once the park settles (overrides
   *  <Park guests>; more arrive via the gate stream) */
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

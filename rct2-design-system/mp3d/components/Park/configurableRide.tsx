import React from 'react';
import * as THREE from 'three';
import { laneLenOf, groundRideAccess, obbOverlap, offPathCell, pathClearance, WATER_LEVEL, TILE } from '../ParkBuilder';
import type { ParkFootRect, StreetLattice } from '../ParkBuilder';
import { computeSplineFrames } from '../SplineCoaster';
import type { StallItemKind } from '../GameManager';
import { xzOf, yOf } from './parkContext';
import type { GameMgr, MovableRec, ParkContextValue, ParkStore, V3, XZ } from './parkContext';
import { useComposable, toBuilt } from './composable';
import type { ComposableBuilt, ComposableProps } from './composable';

// ---- queue-lane orientation safeguard (round-4) ------------------------------------
// placeAccess only AUDITS access footprints — it has no safe fix for a queue
// lane that spears its own ride (a recurring generated-park failure: a lane
// aimed along the station row overlapped the ride's own boardPoint pad and
// validatePark failed 'footprints'). The register wrappers now choose a sane
// orientation UP FRONT: the authored/derived direction is kept when its lane
// + entrance hut stay inside the park and clear the ride's own rects;
// otherwise the FLIP and the two PERPENDICULARS are tried in order and the
// first clean orientation wins (preferring one that also clears the planned
// exit hut). If the re-oriented lane then runs over the exit cell, the exit
// hut is relocated to the first clear cell along its doorway axes. Every
// choice is warned about; placeAccess still audits the result. Deterministic.

const laneRectFor = (anchor: XZ, dir: XZ, laneLen: number): ParkFootRect => ({
  cx: anchor[0] + dir[0] * (laneLen / 2),
  cz: anchor[1] + dir[1] * (laneLen / 2),
  hx: 0.36,
  hz: laneLen / 2,
  yaw: Math.atan2(dir[0], dir[1]),
  label: 'queue lane',
});
const hutRectFor = (c: XZ, yaw: number, label: string): ParkFootRect => ({ cx: c[0], cz: c[1], hx: 0.55, hz: 0.5, yaw, label });

export function resolveQueueOrientation(opts: {
  /** `[Coaster] 'Name'`-style prefix for the console warnings */
  label: string;
  /** park half-size (bounds guard for the hut/lane) */
  half: number;
  laneLen: number;
  /** authored/derived lane axis (unit, hut → tail) */
  dir: XZ;
  /** queue-HEAD anchor for a candidate direction */
  anchorOf: (dir: XZ) => XZ;
  /** the ride's own no-go rects (boardPoint pad, station straight/deck) */
  own: ParkFootRect[];
  /** planned exit hut cell */
  exit: XZ;
  /** exit doorway facing (unit, axis-aligned) */
  exitDir: XZ;
  /** doorway yaw for a candidate exit cell */
  exitYawOf: (e: XZ) => number;
  /** round-6: record every auto-fix as a §0-FATAL park lint so `validatePark`
   *  fails the park instead of the console swallowing the rescue */
  onLint?: (kind: string, detail: string, fatal: boolean) => void;
}): { dir: XZ; exit: XZ } {
  const { label, half, laneLen, own } = opts;
  const note = (kind: string, detail: string, fatal: boolean) => {
    if (opts.onLint) opts.onLint(kind, detail, fatal);
    else console.warn(detail);
  };
  const rectsFor = (dir: XZ) => {
    const anchor = opts.anchorOf(dir);
    const hut: XZ = [anchor[0] - dir[0] * 0.62, anchor[1] - dir[1] * 0.62];
    // the TAIL the GameManager will derive (anchor + (laneLen + 0.35)·dir) —
    // round-6: it is part of the bounds test, see boundOk
    const tail: XZ = [anchor[0] + dir[0] * (laneLen + 0.35), anchor[1] + dir[1] * (laneLen + 0.35)];
    return { lane: laneRectFor(anchor, dir, laneLen), ent: hutRectFor(hut, Math.atan2(dir[0], dir[1]), 'entrance hut'), hut, tail };
  };
  // ROUND-6 BOUNDS FIX: the old test only asked whether the HUT was inside the
  // park — the LANE and its derived TAIL SPUR could hang metres off the plot
  // (a capacity-10 rig against the back fence put queue tails at
  // (-20.4, 24.77) and (-25.11, 9.6) on a size-48 park and the gate passed).
  // Every swept corner AND the tail node must stay inside the terrain edge.
  const cornersOf = (r: ParkFootRect): XZ[] => {
    const ax: XZ = [Math.cos(r.yaw), -Math.sin(r.yaw)];
    const az: XZ = [Math.sin(r.yaw), Math.cos(r.yaw)];
    const out: XZ[] = [];
    for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]] as const)
      out.push([r.cx + ax[0] * r.hx * sx + az[0] * r.hz * sz, r.cz + ax[1] * r.hx * sx + az[1] * r.hz * sz]);
    return out;
  };
  const boundOk = (r: ReturnType<typeof rectsFor>) =>
    [r.tail, ...cornersOf(r.lane), ...cornersOf(r.ent)].every((p) => Math.max(Math.abs(p[0]), Math.abs(p[1])) <= half - 0.05);
  const hardOk = (r: ReturnType<typeof rectsFor>) => boundOk(r) && !own.some((o) => obbOverlap(r.lane, o) || obbOverlap(r.ent, o));
  let dir = opts.dir;
  let rects = rectsFor(dir);
  if (!hardOk(rects)) {
    const candidates: XZ[] = [
      [-dir[0], -dir[1]], // flip
      [dir[1], -dir[0]], // perpendiculars
      [-dir[1], dir[0]],
    ];
    let picked: XZ | null = null;
    for (const c of candidates) {
      const r = rectsFor(c);
      if (!hardOk(r)) continue;
      if (!picked) picked = c;
      // prefer the first orientation that ALSO clears the planned exit hut
      const exitR = hutRectFor(opts.exit, opts.exitYawOf(opts.exit), 'exit hut');
      if (!obbOverlap(exitR, r.lane) && !obbOverlap(exitR, r.ent)) {
        picked = c;
        break;
      }
    }
    if (picked) {
      note(
        'queueDirFlip',
        `${label}: queue lane along [${dir.map((v) => +v.toFixed(2))}] collides with the ride's own boardPoint pad/station (or leaves the park) — FLIPPED to [${picked.map(
          (v) => +v.toFixed(2),
        )}] (first non-colliding of dir/-dir/perpendiculars). The AUTHORED queueDir was wrong: re-plan the tail node so the lane runs off a real street node, then remove the flip`,
        true,
      );
      dir = picked;
      rects = rectsFor(dir);
    } else {
      note(
        'queueDirUnfixable',
        `${label}: queue lane along [${dir.map((v) => +v.toFixed(2))}] collides with the ride's own boardPoint pad/station and NO flipped/perpendicular orientation is clean — keeping the authored direction; re-plan the tail node/exit cell`,
        true,
      );
    }
  }
  // exit hut vs the (possibly re-oriented) lane/hut + boardPoint pad —
  // relocate to the first clear cell along the doorway axes (0.6-u steps,
  // nearest first). The station straight/deck rects are NOT exit blockers:
  // RCT2 exits sit flush against the station edge by design (placeAccess
  // exempts that adjacency the same way).
  let exit = opts.exit;
  const blockers = [rects.lane, rects.ent, ...own.filter((o) => o.label === 'boardPoint pad')];
  const exitRect0 = hutRectFor(exit, opts.exitYawOf(exit), 'exit hut');
  if (blockers.some((o) => obbOverlap(exitRect0, o))) {
    const [ex, ez] = opts.exitDir;
    const axes: XZ[] = [
      [ex, ez],
      [-ex, -ez],
      [ez, -ex],
      [-ez, ex],
    ];
    let done = false;
    for (const dist of [0.6, 1.2, 1.8, 2.4]) {
      if (done) break;
      for (const a of axes) {
        const cand: XZ = [exit[0] + a[0] * dist, exit[1] + a[1] * dist];
        if (Math.max(Math.abs(cand[0]), Math.abs(cand[1])) > half - 0.6) continue;
        const r = hutRectFor(cand, opts.exitYawOf(cand), 'exit hut');
        if (blockers.some((o) => obbOverlap(r, o))) continue;
        note(
          'exitHutRelocated',
          `${label}: exit hut cell [${exit.map((v) => +v.toFixed(2))}] sits on the ride's own (re-oriented) queue lane/hut — moved to [${cand.map(
            (v) => +v.toFixed(2),
          )}]. A relocated hut is NOT audited by the author's paper plan: it can land under a coaster leg or off the paving — re-plan the exit cell`,
          true,
        );
        exit = cand;
        done = true;
        break;
      }
    }
    if (!done)
      note(
        'exitHutUnfixable',
        `${label}: exit hut cell [${exit.map((v) => +v.toFixed(2))}] collides with the ride's own access and no nearby cell is clear — re-plan the exit`,
        true,
      );
  }
  return { dir, exit };
}

// ---- pad-vs-street placement lint (round-7 safeguard) ------------------------------
//
// ROUND-7's park put five flat-ride pads at (−12, 9.6), (0, 3.6), (6, 3.6),
// (−6, −3.6), (−12, −2.4) — every one of them ON a node of its own street
// lattice (`COLS = [−18,−12,−6,0,6,12]` × `ROWS = [15.6,9.6,3.6,−3.6,…]`).
// The streets then ran straight through the machines: 20 `blockers` FAILs plus
// 5 queue tails "only reachable through a solid object". 25 of its 34
// failures, all from ONE authoring mistake that nothing surfaced until the
// gate — and the gate could only describe it 25 times, edge by edge.
//
// Every registered pad (ride BODY + boardPoint pad; stall body) is now audited
// AT MOUNT TIME against the rendered street lattice:
//
//   * the pad rect INTERSECTS a street slab (clearance < width/2)  → §0-FATAL
//     lint: this is the geometry that becomes the `blockers` FAILs.
//   * the pad is inside the §0.14 advisory margin (1.8 u from every node and
//     edge centreline) but clear of the slab                       → warning
//
// …and the message carries the CONCRETE FIX: the nearest legal interior cell,
// computed with `offPathCell` (the same helper authors can call themselves).
// A ride pad belongs on a cell INTERIOR; only its queue lane may touch a node.

/** §0.14: a pad centre clears a 1.1-u slab from a 2.4-u pad at 1.8 u */
export const PAD_OFF_LATTICE = 1.8;

/** point → OBB distance (0 inside), the pad-vs-street clearance measure */
function distToRect(r: ParkFootRect, px: number, pz: number): number {
  const c = Math.cos(r.yaw);
  const s = Math.sin(r.yaw);
  const dx = px - r.cx;
  const dz = pz - r.cz;
  const lx = Math.abs(dx * c - dz * s) - r.hx;
  const lz = Math.abs(dx * s + dz * c) - r.hz;
  return Math.hypot(Math.max(lx, 0), Math.max(lz, 0));
}

/**
 * Audit a mounted pad against the RENDERED street lattice and report the fix.
 * `rects` are the pad's world footprints (body + boarding pad / stall body);
 * `at` is the placement the author wrote, so the suggestion can name the cell
 * they should have used. Fatal when a rect actually eats into a slab.
 */
export function lintPadOffLattice(
  park: ParkContextValue,
  label: string,
  rects: ParkFootRect[],
  at: XZ,
  kind: 'ride' | 'stall' = 'ride',
): void {
  const paths = park.paths;
  if (!paths || !rects.length || (park as ParkStore)._previewHost) return;
  const { net, streetNodes } = paths;
  const pathHalf = (paths.width ?? 1.1) / 2;
  // 1. worst pad-vs-street-slab clearance over every RENDERED edge + node
  let slab = Infinity;
  let slabWhat = '';
  let slabAt: XZ = at;
  const consider = (d: number, what: string, p: XZ) => {
    if (d < slab) {
      slab = d;
      slabWhat = what;
      slabAt = p;
    }
  };
  for (let ni = 0; ni < Math.min(streetNodes, net.nodes.length); ni += 1) {
    const [nx, nz] = net.nodes[ni];
    for (const r of rects) consider(distToRect(r, nx, nz), `street node ${ni} [${nx.toFixed(1)}, ${nz.toFixed(1)}]`, [nx, nz]);
  }
  net.edges.forEach(([a, b], ei) => {
    if (a >= streetNodes || b >= streetNodes) return; // sanctioned access spur
    const [ax, az] = net.nodes[a];
    const [bx, bz] = net.nodes[b];
    const steps = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) / 0.3));
    for (let k = 0; k <= steps; k += 1) {
      const u = k / steps;
      const px = ax + (bx - ax) * u;
      const pz = az + (bz - az) * u;
      for (const r of rects) consider(distToRect(r, px, pz), `street edge ${ei} (${a}→${b})`, [px, pz]);
    }
  });
  // §0.14 is stated from the pad CENTRE (the number an author can compute on
  // paper): ≥ 1.8 u, or pad half-width + slab half-width + 0.05 for a big rig.
  // A SHOP is different: §3 wants kiosks on cells ABUTTING the street with the
  // serving front toward it (the counter only reaches 0.42 out and the attach
  // point is 0.72 out — a bazaar's stalls flank its own aisle by design), so a
  // stall only has to keep its SOLID BODY out of the slab.
  const padHalf = Math.max(...rects.map((r) => Math.max(r.hx, r.hz)));
  const clearFloor = padHalf + pathHalf + 0.05;
  const need = kind === 'stall' ? clearFloor : Math.max(PAD_OFF_LATTICE, clearFloor);
  const centreClear = pathClearance(net as StreetLattice, at, streetNodes).clearance;
  if (slab > pathHalf && centreClear >= need) return; // clear on both counts
  // 2. the concrete FIX: the nearest cell interior that clears everything
  const spot = offPathCell(net, at, {
    clear: need,
    streetNodes,
    size: park.size,
    isDry: (x, z) => park.isDry([x, z]),
  });
  const fix = spot
    ? `move the pad to [${spot[0]}, ${spot[1]}] (the nearest cell interior ≥ ${need.toFixed(
        2,
      )} u off every node + edge centreline — \`offPathCell(net, [${at[0]}, ${at[1]}], { clear: ${need.toFixed(2)} })\`)`
    : `NO cell within 4.8 u clears ${need.toFixed(2)} u — the street skeleton itself is too dense here: re-plan it (or use buildParkNet + a set-piece, §3.1)`;
  if (slab <= pathHalf) {
    park.reportLint(
      'padOnStreet',
      `${label}: its ${kind} pad INTERSECTS the street — ${slab.toFixed(2)} u to ${slabWhat} near [${slabAt[0].toFixed(1)}, ${slabAt[1].toFixed(
        1,
      )}], inside the ${(pathHalf * 2).toFixed(
        1,
      )} u path slab. Guests cannot walk through it: every street edge crossing this pad becomes a \`blockers\` FAIL and any queue tail behind it becomes unreachable. Pads go on cell INTERIORS, ≥ ${PAD_OFF_LATTICE.toFixed(
        1,
      )} u off every lattice node and edge centreline (only the queue lane may touch a node — §0.14): ${fix}`,
      true,
    );
    return;
  }
  park.reportLint(
    'padNearStreet',
    `${label}: its ${kind} pad centre stands ${centreClear.toFixed(2)} u from the street (${slab.toFixed(
      2,
    )} u of slab clearance to ${slabWhat}) — inside the §0.14 margin of ${need.toFixed(
      2,
    )} u, so any lane trim, corridor shift or exit relocation pushes it INTO the street: ${fix}`,
    false,
  );
}

// ---- corridor auto-resolution (round-5 safeguard) ----------------------------------
// A registered stall/flat-ride pad whose footprint lands inside a coaster's
// 1.6-u track corridor used to be a guaranteed validatePark FAIL that no
// static plan could reliably predict (the corridor is RUNTIME-DERIVED from
// the compiled circuit). At settle time — every child mounted, every circuit
// registered — <Park> sweeps the corridors (the SAME segment OBBs
// validatePark uses) over every MOVABLE object and shifts offenders outward
// along the least-move axis to the first clear cell (≤ 4 cells, 1.2-u steps;
// dry cells preferred — the reclamp pass dries a wet fallback). Every move is
// console.warn'ed; `pinned` opts an object out; streets and the coasters
// themselves never move (grade crossings remain hard FAILs to re-plan).

/** the stall footprint rect the validatePark corridor sweep audits */
export function stallFootRect(st: { name: string; anchor: [number, number, number]; dir: [number, number] }): ParkFootRect {
  const m = Math.hypot(st.dir[0], st.dir[1]) || 1;
  const dxn = st.dir[0] / m;
  const dzn = st.dir[1] / m;
  return {
    cx: st.anchor[0] + dxn * 0.36,
    cz: st.anchor[2] + dzn * 0.36,
    hx: 0.65,
    hz: 1.01,
    yaw: Math.atan2(dxn, dzn),
    label: `${st.name} stall`,
  };
}

export function resolveCorridorConflicts(ctx: ParkStore, mgr: GameMgr): void {
  const t = ctx.three;
  const circuits = ctx._coasters.filter((c) => !c.fatal && c.points.length >= 4);
  if (circuits.length === 0 || ctx._movables.length === 0) return;
  const CORR_HALF = 0.8; // the validator's 1.6-u corridor
  const CLEAR = 2.2; // vertical clearance that makes an overflight legal
  const half = ctx.size / 2;
  interface Seg {
    ax: number;
    az: number;
    bx: number;
    bz: number;
    minY: number;
    rect: ParkFootRect;
  }
  const segs: Seg[] = [];
  for (const c of circuits) {
    const fb = computeSplineFrames(t, c.points, { bank: c.bank });
    const stride = Math.max(1, Math.round(0.7 / (fb.total / fb.N)));
    for (let i = 0; i < fb.N; i += stride) {
      const a = fb.P[i];
      const b = fb.P[(i + stride) % fb.N];
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
  }
  const firstHit = (r: ParkFootRect, base: number): Seg | undefined => segs.find((s) => s.minY - base < CLEAR && obbOverlap(s.rect, r));
  // never shift something ONTO an authored hill flank (the validator's own
  // terrain rule: peak contribution > 0.75 under a footprint is a FAIL)
  const peaks = ctx.ground?.comp.peaks ?? [];
  const onHillFlank = (r: ParkFootRect): boolean =>
    peaks.some((pk) => {
      const k = Math.max(0, 1 - Math.hypot(r.cx - pk.x, r.cz - pk.z) / pk.radius);
      return k * k * (3 - 2 * k) * pk.height > 0.75;
    });
  // every audited rect in the park (live — earlier shifts are visible)
  const allRects = (): ParkFootRect[] => [
    ...(mgr.footprints?.() ?? []),
    ...ctx._extraFootprints,
    ...(mgr.stalls?.() ?? []).map(stallFootRect),
  ];
  for (const mv of ctx._movables) {
    if (mv.rects().length === 0) continue;
    // clearance base per rect: the validator measures ride rects above the
    // TERRAIN and stalls above their anchor; wet ground is floored at the
    // reclamp pass's raise level (it dries those cells before validation)
    const baseOf = (r: ParkFootRect): number => Math.max(mv.base ? mv.base() : ctx.groundAt(r.cx, r.cz), WATER_LEVEL + 0.3);
    const hitsOf = (rs: ParkFootRect[]): ParkFootRect[] => rs.filter((r) => firstHit(r, baseOf(r)));
    if (hitsOf(mv.rects()).length === 0) continue;
    if (mv.pinned) {
      ctx.reportLint(
        'corridorPinned',
        `${mv.label} sits inside a coaster track corridor but is pinned — left in place (unpin or re-plan the cell)`,
        true,
      );
      continue;
    }
    const AXES: XZ[] = [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ];

    // ---- tier 1: exit-hut-only relocation — when the exit hut is the ONLY
    // rect (still) in a corridor, a small hut move beats displacing the rig
    // (the same spirit as placeAccess' pad-edge exit shift / the round-4
    // queueDir machinery's exit relocation). Also the follow-up after a rig
    // shift that cleared everything BUT the exit. -----------------------------
    const tryExitOnly = (): boolean => {
      if (!mv.shiftExit || !mv.exitLabel) return false;
      const rects = mv.rects();
      const offenders = hitsOf(rects);
      if (offenders.length === 0 || !offenders.every((r) => r.label === mv.exitLabel)) return false;
      const exitRect = offenders[0];
      const othersPlusOwn = [...allRects().filter((o) => o.label !== mv.exitLabel), ...rects.filter((r) => r.label !== mv.exitLabel)];
      const preExit = new Set(othersPlusOwn.filter((o) => obbOverlap(exitRect, o)).map((o) => o.label));
      for (const dist of [0.6, 1.2, 1.8, 2.4, 3.0])
        for (const d of [...AXES, [1, 1], [1, -1], [-1, 1], [-1, -1]] as XZ[]) {
          const dx = d[0] * dist;
          const dz = d[1] * dist;
          const cand = { ...exitRect, cx: exitRect.cx + dx, cz: exitRect.cz + dz };
          if (Math.max(Math.abs(cand.cx), Math.abs(cand.cz)) > half - 0.55) continue;
          if (firstHit(cand, baseOf(cand))) continue;
          if (onHillFlank(cand)) continue;
          if (othersPlusOwn.some((o) => !preExit.has(o.label) && obbOverlap(cand, o))) continue;
          mv.shiftExit!(dx, dz);
          ctx.reportLint(
            'corridorExitRelocated',
            `${mv.label}: its exit hut sat inside a coaster track corridor — relocated the hut alone by [${dx.toFixed(1)}, ${dz.toFixed(
              1,
            )}] to the first clear spot. §0.11 says WALK the corridor on paper: re-plan the exit cell instead of shipping the rescue (pass pinned to opt out)`,
            true,
          );
          return true;
        }
      return false;
    };
    if (tryExitOnly()) continue;

    // ---- tier 2: whole-rig shift, outward along the least-move axis --------
    // (≤ 4 cells, axis moves before diagonals, dry cells before wet, clean
    // spots before spots that only keep PRE-EXISTING overlaps). tier 3 rides
    // the same search with a TRIMMED queue lane — a derived lane too long to
    // fit anywhere (capacity-10 rigs) shortens to the first length that fits.
    const rects0 = mv.rects();
    const laneRect0 = rects0.find((r) => r.label.endsWith('queue lane'));
    const laneLens: (number | null)[] = [null];
    if (mv.resizeLane && laneRect0 && laneRect0.hz > 1.11) laneLens.push(2.2, 1.2);
    const ownLabels = new Set(rects0.map((r) => r.label));
    // overlaps the rig ALREADY has (e.g. a mis-planned lane) — a shift may
    // KEEP those (validatePark fails them either way) but never add new ones
    const pairsOf = (own: ParkFootRect[], others: ParkFootRect[]): Set<string> => {
      const found = new Set<string>();
      for (const r of own) for (const o of others) if (obbOverlap(r, o)) found.add(`${r.label}|${o.label}`);
      return found;
    };
    const prePairs = pairsOf(rects0, allRects().filter((o) => !ownLabels.has(o.label)));
    // outward = away from the offending corridor segment — try the axis moves
    // most aligned with it first (the "least-move" direction out)
    const off0 = hitsOf(rects0)[0];
    const hit0 = firstHit(off0, baseOf(off0))!;
    const mx = (hit0.ax + hit0.bx) / 2;
    const mz = (hit0.az + hit0.bz) / 2;
    const om = Math.hypot(off0.cx - mx, off0.cz - mz) || 1;
    const out: XZ = [(off0.cx - mx) / om, (off0.cz - mz) / om];
    const dirs: XZ[] = (
      [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
        [1, 1],
        [1, -1],
        [-1, 1],
        [-1, -1],
      ] as XZ[]
    ).sort((a, b) => {
      const diagA = Math.abs(a[0] * a[1]);
      const diagB = Math.abs(b[0] * b[1]);
      if (diagA !== diagB) return diagA - diagB; // axis moves before diagonals
      return b[0] * out[0] + b[1] * out[1] - (a[0] * out[0] + a[1] * out[1]);
    });
    let moved = false;
    // quality tiers, best first: (1) allowExisting=false — a spot with NO
    // footprint overlap at all beats one that only keeps pre-existing
    // overlaps; (2) exitTolerant=false — a spot where NOTHING stays in the
    // corridor beats one that still needs the exit-hut follow-up fix
    for (const allowExisting of [false, true]) {
    if (moved) break;
    for (const exitTolerant of [false, true]) {
    if (moved) break;
    for (const laneLen of laneLens) {
      if (moved) break;
      // hypothetical rect set at this lane length (the lane's HEAD end stays)
      const rects = rects0.map((r) => {
        if (laneLen === null || !laneRect0 || r.label !== laneRect0.label) return { ...r };
        const dirL: XZ = [Math.sin(r.yaw), Math.cos(r.yaw)];
        const ax0 = r.cx - dirL[0] * r.hz;
        const az0 = r.cz - dirL[1] * r.hz;
        return { ...r, cx: ax0 + (dirL[0] * laneLen) / 2, cz: az0 + (dirL[1] * laneLen) / 2, hz: laneLen / 2 };
      });
      const cellsFrom = laneLen === null ? 1 : 0; // a pure trim (no shift) may already fit
      for (let cells = cellsFrom; cells <= 4 && !moved; cells += 1) {
        {
          for (const allowWet of [false, true]) {
            if (moved) break;
            for (const d of cells === 0 ? ([[0, 0]] as XZ[]) : dirs) {
              const dx = d[0] * cells * TILE;
              const dz = d[1] * cells * TILE;
              const shifted = rects.map((r) => ({ ...r, cx: r.cx + dx, cz: r.cz + dz }));
              if (shifted.some((r) => Math.max(Math.abs(r.cx), Math.abs(r.cz)) > half - 0.55)) continue; // stay in the park
              if (shifted.some(onHillFlank)) continue; // never onto a hill flank
              // corridor: everything must clear — except (tolerant tier) the
              // exit hut, which the tier-1 machinery relocates afterwards
              const stillHit = hitsOf(shifted);
              if (stillHit.some((r) => !(exitTolerant && mv.shiftExit && r.label === mv.exitLabel))) continue;
              const others = allRects().filter((o) => !ownLabels.has(o.label));
              const nowPairs = pairsOf(shifted, others);
              if (allowExisting ? [...nowPairs].some((pp) => !prePairs.has(pp)) : nowPairs.size > 0) continue; // never onto something else
              if (!allowWet && shifted.some((r) => ctx.groundAt(r.cx, r.cz) < WATER_LEVEL + 0.05)) continue; // prefer dry cells
              if (laneLen !== null) {
                mv.resizeLane!(laneLen);
                ctx.reportLint(
                  'corridorLaneTrim',
                  `${mv.label}: its derived queue lane was too long to clear the coaster track corridor anywhere nearby — trimmed to ${laneLen.toFixed(
                    1,
                  )} u (FEWER QUEUE SLOTS than the capacity asks for); move the ride off the corridor instead`,
                  true,
                );
              }
              if (dx !== 0 || dz !== 0) mv.shift(dx, dz);
              if (dx !== 0 || dz !== 0)
                ctx.reportLint(
                  'corridorShift',
                  `${mv.label} sat inside a coaster track corridor — auto-shifted [${dx.toFixed(1)}, ${dz.toFixed(1)}] (${cells} cell${
                    cells > 1 ? 's' : ''
                  } ${d[0] ? (d[0] > 0 ? '+x' : '-x') : ''}${d[1] ? (d[1] > 0 ? '+z' : '-z') : ''}) to the first clear cell. The AUTHORED cell was inside the corridor — re-plan it against manager.corridorCells() (§0.11); pass pinned to opt out`,
                  true,
                );
              moved = true;
              break;
            }
          }
        }
      }
    }
    } // exitTolerant tiers
    } // allowExisting tiers
    if (moved) {
      // a lingering exit hut gets the small fix — and an honest warning
      // when even that cannot find a clear spot
      if (hitsOf(mv.rects()).length > 0 && !tryExitOnly())
        ctx.reportLint(
          'corridorExitStuck',
          `${mv.label}: auto-shifted, but its exit hut still sits inside a coaster track corridor and no nearby spot is clear — re-plan the exit cell`,
          true,
        );
      continue;
    }
    ctx.reportLint(
      'corridorUnresolved',
      `${mv.label} sits inside a coaster track corridor and no clear cell exists within 4 — re-plan the layout`,
      true,
    );
  }
}

// ---- composableRide / composableStall — one-line registration for the catalog -----------
//
// The catalog is meant to be COMPOSED BY AN AGENT: seed a <Terrain>, lay
// <Paths>, mount the <Gate>, then creatively place attractions by just adding
// `<Ride position rotation register />`. These factories wrap composable()
// with the GameManager wiring so a catalog ride/stall needs ONE line to
// become fully simulated: queue lane + entrance/exit huts + boarding are
// derived from position+rotation (simple local-frame offsets, grounded with
// groundRideAccess — the FerrisWheel documents the geometry).

export interface RideRegisterProps {
  name?: string;
  capacity?: number;
  rideDuration?: number;
  loadTime?: number;
  intensity?: number;
  price?: number;
}

/** local-frame access geometry a ride component ships with (all optional) */
export interface RideLayout {
  /** distance from the origin to the queue HEAD out the local +z front
   *  (default 1.8 — the entrance hut sits at front−0.62 with a 0.5 half-depth,
   *  so keep `front ≥ board-pad half 0.45 + 1.12 + margin`). The lane extends
   *  further +z; its TAIL lands on/near a street node (the manager attaches
   *  it to the network). Default tail reach is front + laneLenOf(capacity) +
   *  0.35, but when a street node sits ON the lane axis short of that the
   *  lane is TRIMMED so the tail lands exactly on the node (round-2). */
  front?: number;
  /** exit hut spot in LOCAL [x, z] (default [-1.5, 1.35] — beside the front) */
  exit?: [number, number];
  /** boarding anchor in LOCAL [x, y, z] (default [0, 0.25, 0]) */
  board?: V3;
  /** register defaults for this ride type (name, capacity, duration…) */
  defaults?: RideRegisterProps;
}

/** built groups may carry sim extras the registration picks up */
export type ComposableRideBuilt = ComposableBuilt & {
  /** per-seat world transform (GameManager seatWorld) — real riders ride */
  seatWorld?: (seat: number) => [number, number, number, number];
  /** a vehicle/gondola for the RideViewer onboard cam */
  vehicle?: THREE.Object3D;
  /** FSM visual hook — wired to the manager's ride state machine so the
   *  visual reacts (spin down while brokenDown/beingRepaired, restart after) */
  onStateChange?: (state: string, occupancy?: unknown) => void;
  /** crash wiring for tracked rides (registerRide vehicleHandle) */
  crashed?: () => boolean;
  /** set by a FATAL <TrackRide> build (invalid red track) — the chassis
   *  skips the GameManager registration for it */
  invalid?: boolean;
  /** ADDITIVE: the measured RCT2 rating triple for a tracked build
   *  (SplineRideKit `rateCoaster`) — forwarded to registerRide so the ride
   *  handle can report Excitement/Intensity/Nausea. Informational only. */
  ratings?: { excitement: number; intensity: number; nausea: number; ratingBand?: string; nauseaExtreme?: boolean };
};

/**
 * Register an already-composed ride with the park's GameManager: queue
 * anchor/dir, boardPoint and exit hut derived from the settled position +
 * yaw via `layout`, footprint-grounded with groundRideAccess, tagged
 * `userData.rideRef` (+ `rideVehicle`) for clickability. Returns the cleanup
 * for the grounding meshes (the registration itself is permanent).
 */
export function registerComposedRide(
  park: ParkContextValue,
  built: ComposableRideBuilt,
  reg: RideRegisterProps,
  at: { position: V3; rotation: number; scale?: number },
  layout: RideLayout = {},
  queue?: { anchor?: XZ; dir?: XZ },
  pinned?: boolean,
): () => void {
  const t = park.three;
  const [x, y, z] = at.position;
  const yaw = at.rotation;
  const sc = at.scale ?? 1; // layout offsets scale WITH the ride visual
  const d = layout.defaults ?? {};
  const capacity = reg.capacity ?? d.capacity ?? 4;
  let front = (layout.front ?? 1.8) * sc;
  let [lex, lez] = (layout.exit ?? [-1.5, 1.35]).map((v) => v * sc) as [number, number];
  const [lbx, lby, lbz] = (layout.board ?? [0, 0.25, 0]).map((v) => v * sc) as V3;
  // RCT2 RULE (RideConstruction.cpp:1584 — entrance/exit tiles sit flush
  // against a station edge on one of its four legal sides, doorway
  // perpendicular): measure the built visual's LOCAL footprint and keep the
  // huts flush + perpendicular to that square. Sprawling circuits (tracked
  // rides — the station is at the local origin, the circuit roams) keep
  // their station-local layout; COMPACT rides (footprint ≤ ~5 units) get
  // auto-clearance so a default layout can never sink a hut into the pad.
  const foot = new t.Box3().setFromObject(built.group);
  if (!foot.isEmpty() && Math.max(foot.max.x - foot.min.x, foot.max.z - foot.min.z) * sc <= 10) {
    const minHutFront = foot.max.z * sc + 1.27; // hut nearside (front−1.12) clears the +z edge
    if (front < minHutFront && minHutFront <= 6.5) front = minHutFront; // cap: boarding stays walkable
    const flushX = foot.min.x * sc - 0.62; // exit hut flush on the −x edge
    if (lex > flushX) lex = flushX;
    // keep the exit ALONG that edge (never floating past the corner)
    lez = Math.max(foot.min.z * sc + 0.6, Math.min(lez, foot.max.z * sc + 0.4));
  }
  const ldz: XZ = [Math.sin(yaw), Math.cos(yaw)]; // local +z in world
  const dx: XZ = [Math.cos(yaw), -Math.sin(yaw)]; // local +x in world
  const w = (lx: number, lz: number): XZ => [x + dx[0] * lx + ldz[0] * lz, z + dx[1] * lx + ldz[1] * lz];
  // world-frame queue overrides beat the derived local-frame defaults — but
  // the lane axis is QUANTIZED to the nearest of the ride's four local sides
  // (RCT2 entrances are always perpendicular to the ride square; a diagonal
  // override would skew the hut and lane)
  let dz: XZ = ldz;
  if (queue?.dir) {
    const qm = Math.hypot(queue.dir[0], queue.dir[1]) || 1;
    const qd: XZ = [queue.dir[0] / qm, queue.dir[1] / qm];
    const sides: XZ[] = [ldz, [-ldz[0], -ldz[1]], dx, [-dx[0], -dx[1]]];
    let bestDot = -Infinity;
    for (const s of sides) {
      const dot = qd[0] * s[0] + qd[1] * s[1];
      if (dot > bestDot) {
        bestDot = dot;
        dz = s;
      }
    }
    if (bestDot < 0.995)
      console.info(
        `[Park] queue.dir [${queue.dir}] is not perpendicular to the ride square — snapped to the nearest side [${dz.map((v) => Math.round(v * 100) / 100)}]`,
      );
  }
  let anchor = queue?.anchor ?? w(0, front);
  let exit = w(lex, lez);
  const board = w(lbx, lbz);
  // ---- `queue.anchor` IS THE HEAD, NOT THE TAIL (round-7 safeguard) --------
  // Round-7's park wrote `queue={{ anchor: [-12, 3.6], dir: [0, 1] }}` on five
  // rides, meaning "land the tail on the street node at (−12, 3.6)". `anchor`
  // is the queue HEAD (the hut end): given that override the lane runs FROM
  // the node OUTWARD, straight along the street row, and its railings then
  // cross every perpendicular edge. Detect the tell — an explicit anchor
  // sitting ON a street node — and print the head coordinate that WOULD have
  // put the tail there.
  if (queue?.anchor && park.paths) {
    const streets = park.paths.net.nodes.slice(0, park.paths.streetNodes);
    const join = laneLenOf(capacity) + 0.35;
    let onNode = -1;
    for (let i = 0; i < streets.length; i += 1)
      if (Math.hypot(streets[i][0] - anchor[0], streets[i][1] - anchor[1]) < 0.3) {
        onNode = i;
        break;
      }
    if (onNode >= 0) {
      const head: XZ = [anchor[0] - dz[0] * join, anchor[1] - dz[1] * join];
      park.reportLint(
        'queueAnchorIsHead',
        `${reg.name ?? d.name ?? 'Ride'}: queue.anchor [${anchor.map((v) => +v.toFixed(2)).join(', ')}] sits ON street node ${onNode} — but \`anchor\` is the queue HEAD (the entrance-hut end), not the TAIL. As written the lane runs FROM that node ${laneLenOf(
          capacity,
        ).toFixed(2)} u along [${dz.map((v) => +v.toFixed(2)).join(', ')}], i.e. down the street itself, and its railings cross every edge they meet. To land the TAIL on node ${onNode}, pass anchor [${head[0].toFixed(
          2,
        )}, ${head[1].toFixed(2)}] (node − dir·(laneLenOf(${capacity}) + 0.35) = node − dir·${join.toFixed(
          2,
        )}), or drop \`queue\` entirely and let the derived lane trim itself onto the node (§0.4)`,
        true,
      );
    }
  }
  // ---- queue-lane orientation safeguard (round-4) --------------------------
  // The derived (or provided, side-snapped) lane used to be trusted blindly —
  // when it speared the ride's own boarding pad, placeAccess could only WARN
  // and validatePark failed 'footprints'. Choose a sane orientation up front:
  // keep the lane when it is clean, else flip/rotate to the first orientation
  // whose lane + hut clear the pad and stay in bounds; relocate the exit if
  // the re-oriented lane runs over its cell. Explicit `queue.anchor` opts out.
  if (!queue?.anchor) {
    const base = (layout.front ?? 1.8) * sc;
    const frontFor = (dd: XZ): number => {
      if (foot.isEmpty() || Math.max(foot.max.x - foot.min.x, foot.max.z - foot.min.z) * sc > 10) return front;
      const dotZ = dd[0] * ldz[0] + dd[1] * ldz[1];
      const extent =
        Math.abs(dotZ) > 0.9 ? (dotZ > 0 ? foot.max.z : -foot.min.z) : dd[0] * dx[0] + dd[1] * dx[1] > 0 ? foot.max.x : -foot.min.x;
      const need = extent * sc + 1.27;
      return need > 6.5 ? Math.max(base, front) : Math.max(base, need);
    };
    const resolved = resolveQueueOrientation({
      label: `[Park] ${reg.name ?? d.name ?? 'Ride'}`,
      half: park.size / 2,
      laneLen: laneLenOf(capacity),
      dir: dz,
      anchorOf: (dd) => [x + dd[0] * frontFor(dd), z + dd[1] * frontFor(dd)],
      own: [{ cx: board[0], cz: board[1], hx: 0.45, hz: 0.45, yaw: 0, label: 'boardPoint pad' }],
      exit,
      exitDir: [-dx[0], -dx[1]],
      exitYawOf: (e) => Math.atan2(e[0] - board[0], e[1] - board[1]),
      onLint: (kind, detail, fatal) => park.reportLint(kind, detail, fatal),
    });
    if (resolved.dir[0] !== dz[0] || resolved.dir[1] !== dz[1]) {
      dz = resolved.dir;
      front = frontFor(dz);
      anchor = [x + dz[0] * front, z + dz[1] * front];
    }
    exit = resolved.exit;
  }
  // ---- derived EXIT: snap to the pad edge nearest a WALKED path node --------
  // (round-6 safeguard) `layout.exit` is a LOCAL cell, auto-flushed to the −x
  // pad edge and then possibly nudged up to 2.4 u by the orientation
  // machinery. On a big rig that stacks up: round-6 parks put derived exit huts
  // 3.9-4.8 u from their ride, out in the grass/forest with no path in reach —
  // unloaded guests re-appeared in a meadow. RCT2 exits sit FLUSH against a pad
  // edge, doorway perpendicular (RideConstruction.cpp:1584), so re-pick among
  // the ride's four flush edge cells (never the queue's own side) the one
  // CLOSEST to a street node, and only move when it is a clear improvement
  // (≥ 1 tile nearer the paving, or the current spot is wet). Dry, in bounds
  // and clear of every audited footprint, or the derived spot stands.
  if (!queue?.anchor && park.paths && !foot.isEmpty()) {
    const streets = park.paths.net.nodes.slice(0, park.paths.streetNodes);
    const toPath = (p: XZ): number => {
      let best = Infinity;
      for (const [nx, nz] of streets) best = Math.min(best, Math.hypot(p[0] - nx, p[1] - nz));
      return best;
    };
    const halfP = park.size / 2;
    const wl = park.ground ? park.ground.waterLevel : -Infinity;
    const others = park.manager().footprints?.() ?? [];
    const ownRects: ParkFootRect[] = [
      laneRectFor(anchor, dz, laneLenOf(capacity)),
      hutRectFor([anchor[0] - dz[0] * 0.62, anchor[1] - dz[1] * 0.62], Math.atan2(dz[0], dz[1]), 'entrance hut'),
      { cx: board[0], cz: board[1], hx: 0.45, hz: 0.45, yaw: 0, label: 'boardPoint pad' },
    ];
    const cleanAt = (p: XZ): boolean => {
      if (Math.max(Math.abs(p[0]), Math.abs(p[1])) > halfP - 0.6) return false;
      if (park.groundAt(p[0], p[1]) <= wl + 0.12) return false; // terrainLint.isDry
      const r = hutRectFor(p, Math.atan2(p[0] - board[0], p[1] - board[1]), 'exit hut');
      return ![...ownRects, ...others].some((o) => obbOverlap(r, o));
    };
    // the four flush pad-edge cells, in the ride's own frame
    const sides: { s: XZ; extent: number }[] = [
      { s: ldz, extent: foot.max.z },
      { s: [-ldz[0], -ldz[1]], extent: -foot.min.z },
      { s: dx, extent: foot.max.x },
      { s: [-dx[0], -dx[1]], extent: -foot.min.x },
    ];
    let best: XZ | null = null;
    let bestD = toPath(exit);
    const curDry = park.groundAt(exit[0], exit[1]) > wl + 0.12;
    for (const { s, extent } of sides) {
      if (Math.abs(s[0] * dz[0] + s[1] * dz[1]) > 0.9) continue; // the queue owns that side
      const cand: XZ = [x + s[0] * (extent * sc + 0.62), z + s[1] * (extent * sc + 0.62)];
      if (!cleanAt(cand)) continue;
      const dCand = toPath(cand);
      if (dCand < bestD - (curDry ? 1.2 : 0)) {
        bestD = dCand;
        best = cand;
      }
    }
    if (best) {
      park.reportLint(
        'exitSnapped',
        `${reg.name ?? d.name ?? 'Ride'}: its derived exit hut sat ${toPath(exit).toFixed(1)} u from the nearest walked path node (at [${exit
          .map((v) => +v.toFixed(1))
          .join(', ')}]) — snapped to the flush pad-edge cell [${best.map((v) => +v.toFixed(1)).join(', ')}], ${bestD.toFixed(
          1,
        )} u from the paving. Author layout.exit / queue explicitly to control the side`,
        false,
      );
      exit = best;
    }
  }
  // ---- derived lane length: land the TAIL ON the planned street node ------
  // (round-2 safeguard) The lane always ROTATED with the ride (its axis is
  // the yaw-rotated local +z) — the round-2 Thunder Ridge overlap came from
  // its LENGTH: the default tail reach (front + laneLenOf(capacity) + 0.35 ≈
  // 5.5 u at capacity 4) overshoots the street node a layout planned against
  // the documented footprint (`1.8 + 0.35·capacity + 0.35` — rules/park-
  // generation.md), so two correctly-pitched face-to-face rides speared their
  // lanes through the shared street into each other. When a street node sits
  // ON the derived lane axis SHORT of the default tail, the lane is TRIMMED
  // so its tail lands exactly on that node (never extended; ≥1.2 u of lane is
  // kept so the queue still holds slots). Explicit `queue` overrides opt out.
  let laneLen = laneLenOf(capacity);
  if (!queue?.anchor && !queue?.dir && park.paths) {
    const streets = park.paths.net.nodes.slice(0, park.paths.streetNodes);
    const d0 = front + laneLen + 0.35; // default tail distance from the ride origin
    let bestAlong = Infinity;
    for (const [nx, nz] of streets) {
      const along = (nx - x) * dz[0] + (nz - z) * dz[1];
      const lat = Math.abs(-(nx - x) * dz[1] + (nz - z) * dz[0]);
      if (lat > 0.3) continue; // node is off the lane axis
      if (along < front + 1.55 || along > d0 + 0.05) continue; // keep ≥1.2 u lane; never extend
      if (along < bestAlong) bestAlong = along;
    }
    if (bestAlong < d0 - 0.05) {
      laneLen = bestAlong - front - 0.35;
      // round-6: recorded as a park LINT (report.warnings) so the trim reaches
      // the gate. NOT §0-fatal on its own — landing the tail on the node the
      // layout aimed at is the round-2 safeguard working as designed — but it
      // IS a design smell worth reporting: the queue holds
      // floor((laneLen − 0.45) / 0.28) slots, so a hard trim starves capacity.
      const slots = Math.max(2, Math.floor((laneLen - 0.45) / 0.28));
      park.reportLint(
        'laneTrim',
        `${reg.name ?? d.name ?? 'Ride'}: derived queue lane trimmed to ${laneLen.toFixed(2)} u (${slots} slots for capacity ${capacity}) so its tail lands on the street node ${(
          x + dz[0] * bestAlong
        ).toFixed(1)}, ${(z + dz[1] * bestAlong).toFixed(1)} the layout aimed at (default reach ${d0.toFixed(
          2,
        )} u overshot it) — the REAL reach is front + laneLenOf(capacity) + 0.35 with laneLenOf(c) = max(2.2, 1.1 + 0.56·c) and front ${front.toFixed(
          2,
        )} here (NOT the old 1.8 + 0.35·c + 0.35 — that documented formula was wrong): plan the tail node ${d0.toFixed(
          2,
        )} u out the queue face (§0.4)`,
        false,
      );
    }
  }
  // ---- PAD vs the STREET LATTICE (round-7 safeguard) -----------------------
  // Before anything registers: is this pad standing ON the street? Round-7's
  // five flat rides were parked on their own lattice nodes and the gate could
  // only say so 25 times, edge by edge. One lint, one suggested cell, here.
  {
    const padRects: ParkFootRect[] = [{ cx: board[0], cz: board[1], hx: 0.45, hz: 0.45, yaw: 0, label: 'boardPoint pad' }];
    if (!foot.isEmpty() && Math.max(foot.max.x - foot.min.x, foot.max.z - foot.min.z) * sc <= 10) {
      const cw = w(((foot.min.x + foot.max.x) / 2) * sc, ((foot.min.z + foot.max.z) / 2) * sc);
      padRects.push({
        cx: cw[0],
        cz: cw[1],
        hx: Math.max(0.12, ((foot.max.x - foot.min.x) / 2) * sc - 0.08),
        hz: Math.max(0.12, ((foot.max.z - foot.min.z) / 2) * sc - 0.08),
        yaw,
        label: 'ride body',
      });
    }
    lintPadOffLattice(park, `[Park] ${reg.name ?? d.name ?? 'Ride'}`, padRects, [x, z], 'ride');
  }
  const handle = park.manager().registerRide({
    name: reg.name ?? d.name ?? 'Ride',
    capacity,
    rideDuration: reg.rideDuration ?? d.rideDuration ?? 7,
    loadTime: reg.loadTime ?? d.loadTime ?? 1.6,
    intensity: reg.intensity ?? d.intensity ?? 4,
    price: reg.price ?? d.price ?? 3,
    seatWorld: built.seatWorld,
    onStateChange: built.onStateChange,
    vehicleHandle: built.crashed ? { crashed: built.crashed } : undefined,
    ratings: built.ratings, // ADDITIVE: measured RCT2 ratings, if the build has them
    queueAnchor: [anchor[0], y + 0.05, anchor[1]],
    queueDir: dz,
    laneLen, // trimmed so the tail lands on the planned street node
    boardPoint: [board[0], y + lby, board[1]],
    exitPoint: [exit[0], y + 0.05, exit[1]],
  });
  built.group.userData.rideRef = handle; // click -> RideViewer (rules/ui.md)
  if (built.vehicle) built.group.userData.rideVehicle = built.vehicle;
  // ground the access assembly (berms/plinths) like <Coaster>/<FlatRide>
  const g = new t.Group();
  const join = laneLen + 0.35;
  groundRideAccess(
    t,
    g,
    (xx, zz) => park.groundAt(xx, zz),
    {
      hut: [anchor[0] - dz[0] * 0.62, anchor[1] - dz[1] * 0.62],
      dir: dz,
      anchor,
      tail: [anchor[0] + dz[0] * join, anchor[1] + dz[1] * join],
      tailNode: -1,
      exit,
      exitDir: [-dx[0], -dx[1]],
      capacity,
    },
    y + 0.05,
    [handle.exitPoint()[0], handle.exitPoint()[2]],
  );
  const cleanupGround = park.addObject(g);
  // ---- the ride BODY as a blocker (round-6 safeguard) ----------------------
  // The manager auto-blocks the 0.9-u boardPoint pad, but a ride is as wide as
  // its visual — guests used to walk straight THROUGH the machine. Measure the
  // built group's own footprint (the same local Box3 the hut clearance above is
  // derived from, so the queue/huts already stand clear of it) and register it
  // as a rotated rect. Sprawling circuits are skipped: their Box3 spans half
  // the park, and their rails are what the track-corridor sweep is for.
  const rideName = reg.name ?? d.name ?? 'Ride';
  const bodySpan = foot.isEmpty() ? Infinity : Math.max(foot.max.x - foot.min.x, foot.max.z - foot.min.z) * sc;
  const bodyBlocker =
    bodySpan <= 10
      ? park.manager().registerBlocker({
          rect: {
            ...(() => {
              const cw = w(((foot.min.x + foot.max.x) / 2) * sc, ((foot.min.z + foot.max.z) / 2) * sc);
              return { cx: cw[0], cz: cw[1] };
            })(),
            hx: Math.max(0.12, ((foot.max.x - foot.min.x) / 2) * sc - 0.08),
            hz: Math.max(0.12, ((foot.max.z - foot.min.z) / 2) * sc - 0.08),
            yaw,
          },
          label: `${rideName} body`,
          kind: 'ride',
          owner: rideName,
          height: foot.isEmpty() ? 1 : (foot.max.y - foot.min.y) * sc,
        })
      : null;
  // ---- corridor auto-resolution registration (round-5 safeguard) ----------
  // A flat ride's rig (pad + huts + lane) is MOVABLE: the <Park> settle pass
  // may shift it out of a coaster's track corridor. Tracked circuits
  // (built.crashed — the rails can't follow a shifted registration) and
  // explicitly `pinned` rides never move.
  const store = park as ParkStore;
  if (!store._previewHost && !built.crashed && !built.invalid) {
    const mgr = park.manager();
    const mv: MovableRec = {
      label: `${rideName} (flat-ride rig)`,
      kind: 'ride',
      pinned: !!pinned,
      rects: () => (mgr.footprints?.() ?? []).filter((f) => f.label.startsWith(`${rideName} `)),
      exitLabel: `${rideName} exit hut`,
      shiftExit: (sdx, sdz) => mgr.moveRideExit?.(rideName, sdx, sdz),
      resizeLane: (len) => mgr.resizeRideLane?.(rideName, len),
      shift: (sdx, sdz) => {
        mgr.moveRide(rideName, sdx, sdz);
        // the mounted visual sits under useComposable's transform group —
        // apply the WORLD delta through the parent transform
        const parent = built.group.parent;
        if (parent) {
          const wp = new t.Vector3();
          built.group.getWorldPosition(wp);
          wp.x += sdx;
          wp.z += sdz;
          built.group.position.copy(parent.worldToLocal(wp));
        } else {
          built.group.position.x += sdx;
          built.group.position.z += sdz;
        }
        g.position.x += sdx; // the grounding berms/plinths follow
        g.position.z += sdz;
        bodyBlocker?.move(sdx, sdz); // …and so does the body blocker
      },
    };
    store._movables.push(mv);
    return () => {
      const i = store._movables.indexOf(mv);
      if (i >= 0) store._movables.splice(i, 1);
      bodyBlocker?.remove();
      cleanupGround();
    };
  }
  return () => {
    bodyBlocker?.remove();
    cleanupGround();
  };
}

/** props every ride component accepts on top of its own */
export interface ComposableRideProps extends ComposableProps {
  /** inside a <Park>: register as a real GameManager ride (`true` = the
   *  ride's defaults). Queue/boarding/exit derive from position+rotation. */
  register?: boolean | RideRegisterProps;
  /** opt OUT of the settle-time corridor auto-resolver: a pinned ride is
   *  never auto-shifted out of a coaster track corridor (validatePark will
   *  fail it where it stands) */
  pinned?: boolean;
  // ---- sim conveniences, ROUND-7 FIX ---------------------------------------
  // These are the same props <ConfigurableRide> has always documented, but
  // `composableRide` swept them into `...rest` and handed them to the BUILDER,
  // so on every catalog ride they were SILENTLY IGNORED. Round-7's park wrote
  // `queue={{ anchor, dir }}` on five flat rides to land each tail exactly on
  // a street node — none of it took effect, and it read the resulting lane
  // trims as a formula mismatch. They are forwarded now.
  name?: string;
  capacity?: number;
  rideDuration?: number;
  loadTime?: number;
  intensity?: number;
  price?: number;
  /** world-frame queue overrides — `anchor` [x,z] replaces the derived queue
   *  HEAD, `dir` the lane axis (lane LENGTH always follows `capacity`) */
  queue?: { anchor?: XZ; dir?: XZ };
}

export interface ConfigurableRideProps extends ComposableRideProps {
  /** deterministic visual builder — may return `seatWorld` / `vehicle` /
   *  `onStateChange` / `crashed` sim extras */
  build: (t: typeof THREE, park: ParkContextValue) => THREE.Group | ComposableRideBuilt;
  /** the ride's local access geometry + register defaults */
  layout?: RideLayout;
  // top-level sim config conveniences (merged over `register`'s object form)
  name?: string;
  capacity?: number;
  rideDuration?: number;
  loadTime?: number;
  intensity?: number;
  price?: number;
  /** world-frame queue overrides — `anchor` [x,z] replaces the derived queue
   *  HEAD, `dir` the lane axis (lane LENGTH always follows `capacity`) */
  queue?: { anchor?: XZ; dir?: XZ };
}

/**
 * <ConfigurableRide> — the abstraction EVERY catalog ride delegates to
 * (usually via the composableRide() factory). It mounts the ride visual into
 * the surrounding scene and, when `register` is set inside a real <Park>,
 * wires the full GameManager life: the RCT2 ride FSM (waiting → departing →
 * travelling → breakdowns/repairs), queue lane + entrance/exit huts, guest
 * admission/boarding (real riders when the builder exposes `seatWorld`),
 * pricing/intensity stats, ParkInfo rows, and click-to-open RideViewer with
 * the live/onboard camera (`userData.rideRef` / `rideVehicle`). All of that
 * comes for free — a composition only decides WHERE the ride stands.
 */
export function ConfigurableRide({
  build,
  layout,
  register,
  pinned,
  name,
  capacity,
  rideDuration,
  loadTime,
  intensity,
  price,
  queue,
  position,
  rotation = 0,
  scale = 1,
  deps,
}: ConfigurableRideProps) {
  const explicit = name ?? capacity ?? rideDuration ?? loadTime ?? intensity ?? price;
  useComposable(
    (t, park) => {
      const built = toBuilt(build(t, park)) as ComposableRideBuilt;
      const wantsSim = (register || explicit !== undefined) && !built.invalid; // fatal tracks never register
      if (wantsSim && !(park as ParkStore)._previewHost) {
        const reg: RideRegisterProps = {
          ...(register && register !== true ? register : {}),
          ...(name !== undefined ? { name } : {}),
          ...(capacity !== undefined ? { capacity } : {}),
          ...(rideDuration !== undefined ? { rideDuration } : {}),
          ...(loadTime !== undefined ? { loadTime } : {}),
          ...(intensity !== undefined ? { intensity } : {}),
          ...(price !== undefined ? { price } : {}),
        };
        const pos = position ?? ([0, 0] as XZ);
        const [x, z] = xzOf(pos);
        const y = yOf(pos) ?? park.floorAt(x, z);
        const extra = registerComposedRide(park, built, reg, { position: [x, y, z], rotation, scale }, layout, queue, pinned);
        const prev = built.dispose;
        built.dispose = () => {
          prev?.();
          extra();
        };
      }
      return built;
    },
    { position, rotation, scale, deps: deps ?? [register, name, capacity, rideDuration, loadTime, intensity, price, queue, pinned] },
  );
  return null;
}

/** ride-component factory: `build(t, props, park)` + layout → a component
 *  rendering <ConfigurableRide> (the one-liner most catalog rides use) */
export function composableRide<P extends object>(
  displayName: string,
  build: (t: typeof THREE, props: P, park: ParkContextValue) => THREE.Group | ComposableRideBuilt,
  layout: RideLayout = {},
): React.FC<P & ComposableRideProps> {
  const Component: React.FC<P & ComposableRideProps> = (all) => {
    const {
      position,
      rotation,
      scale,
      deps,
      register,
      pinned,
      // ROUND-7: the sim conveniences are CHASSIS props — they used to fall
      // into `...rest` and reach only the visual builder, so `queue`,
      // `capacity`, `name`… were silently dropped on every catalog ride
      name,
      capacity,
      rideDuration,
      loadTime,
      intensity,
      price,
      queue,
      ...rest
    } = all as ComposableRideProps & Record<string, unknown>;
    // `register` is passed THROUGH to the builder's props — builders key
    // "riders off when registered" (FerrisWheel-style) on it; stripping it
    // here silently broke those defaults
    const props = { ...rest, register } as unknown as P;
    return (
      <ConfigurableRide
        build={(t, park) => build(t, props, park)}
        layout={layout}
        register={register}
        pinned={pinned}
        name={name}
        capacity={capacity}
        rideDuration={rideDuration}
        loadTime={loadTime}
        intensity={intensity}
        price={price}
        queue={queue}
        position={position}
        rotation={rotation}
        scale={scale}
        deps={deps ?? [register, pinned, name, capacity, rideDuration, loadTime, intensity, price, queue, rest]}
      />
    );
  };
  Component.displayName = displayName;
  return Component;
}

/** the object form of a stall's `register` — the SAME shape rides take, so
 *  `register={{ name: 'Cinder Soda' }}` means what it looks like (round-7:
 *  it used to be a rides-only spelling that a stall silently ignored, and a
 *  park shipped three shops called "Burger Bar"/"Soda Stand"/"Cotton Candy") */
export interface StallRegisterProps {
  /** the THEMED name (§0.16) — shown in ParkInfo and in guest thoughts */
  name?: string;
  price?: number;
  value?: number;
  /** override what it sells ('food' | 'drink' | 'balloon') */
  item?: StallItemKind;
}

/** props every stall component accepts on top of its own */
export interface ComposableStallProps extends ComposableProps {
  /** inside a <Park>: register a selling stall with the GameManager (the
   *  serving front faces local +z — the attach point sits 0.72 out that way).
   *  `true` = the catalog defaults (which ships the CATALOG DEFAULT NAME —
   *  always pass a themed one: `register={{ name: 'Cinder Soda' }}`). */
  register?: boolean | StallRegisterProps;
  /** opt OUT of the settle-time corridor auto-resolver: a pinned stall is
   *  never auto-shifted out of a coaster track corridor */
  pinned?: boolean;
  /** themed name — equivalent to `register={{ name }}` (top-level wins) */
  name?: string;
  price?: number;
  value?: number;
}

export interface ConfigurableStallProps extends ComposableStallProps {
  build: (t: typeof THREE, park: ParkContextValue) => THREE.Group | ComposableBuilt;
  /** the stall's sale defaults — `item` covers consumables ('food'/'drink')
   *  AND accessories ('balloon', open for future kinds); see GameManager */
  stall: { name: string; item: StallItemKind; price: number; value: number };
}

/**
 * <ConfigurableStall> — the shop counterpart of <ConfigurableRide>: mounts
 * the stall visual and, when `register` is set inside a real <Park>, registers
 * a selling stall (guest hunger/thirst seeking, purchases, litter) with the
 * attach point 0.72 out the local +z serving front.
 */
export function ConfigurableStall({ build, stall, register, pinned, name, price, value, position, rotation = 0, scale = 1, deps }: ConfigurableStallProps) {
  useComposable(
    (t, park) => {
      const built = toBuilt(build(t, park));
      if (register && !(park as ParkStore)._previewHost) {
        const pos = position ?? ([0, 0] as XZ);
        const [x, z] = xzOf(pos);
        const y = yOf(pos) ?? park.floorAt(x, z);
        // round-7: the object form is honoured (top-level props still win),
        // so the rides' `register={{ name }}` spelling is not a silent no-op
        const ro: StallRegisterProps = register && register !== true ? register : {};
        const stallName = name ?? ro.name ?? stall.name;
        const mgr = park.manager();
        // names are the manager's PRIMARY KEY (moveStall/resolver find by name)
        if ((mgr.stalls?.() ?? []).some((s) => s.name === stallName))
          console.warn(
            `[Park] two stalls are both called "${stallName}" — the corridor auto-resolver and moveStall find a stall BY NAME, so it will measure/move the wrong one. Give each shop its own themed name: register={{ name: '…' }} (§0.16)`,
          );
        mgr.registerStall({
          name: stallName,
          item: ro.item ?? stall.item,
          price: price ?? ro.price ?? stall.price,
          value: value ?? ro.value ?? stall.value,
          anchor: [x, y, z],
          dir: [Math.sin(rotation), Math.cos(rotation)],
        });
        // ---- PAD vs the STREET LATTICE (round-7 safeguard) -----------------
        // Same defect as the flat rides, one wave earlier: round-7's family
        // park gave its stalls the SAME z as the boulevard nodes, so streets
        // ran straight through Burger Bar and Soda Stand. A shop body is as
        // solid as a ride body — audit it against the lattice at mount.
        // the SOLID body only (GameManager registry.ts: hx 0.6, hz 0.42 on the
        // anchor) — NOT the audited stallFootRect, whose 1.01 half-depth is the
        // serving apron the guest queue legitimately stands in
        lintPadOffLattice(
          park,
          `[Park] ${stallName}`,
          [{ cx: x, cz: z, hx: 0.6, hz: 0.42, yaw: Math.atan2(Math.sin(rotation), Math.cos(rotation)), label: `${stallName} body` }],
          [x, z],
          'stall',
        );
        // corridor auto-resolution registration (round-5): stalls are
        // MOVABLE unless pinned — the <Park> settle pass may shift one out
        // of a coaster's track corridor (visual + registration together)
        const store = park as ParkStore;
        const mv: MovableRec = {
          label: `${stallName} stall`,
          kind: 'stall',
          pinned: !!pinned,
          rects: () => {
            const st = (mgr.stalls?.() ?? []).find((s) => s.name === stallName);
            return st ? [stallFootRect(st)] : [];
          },
          base: () => {
            const st = (mgr.stalls?.() ?? []).find((s) => s.name === stallName);
            return st ? st.anchor[1] : y;
          },
          shift: (sdx, sdz) => {
            mgr.moveStall(stallName, sdx, sdz);
            const parent = built.group.parent;
            if (parent) {
              const wp = new t.Vector3();
              built.group.getWorldPosition(wp);
              wp.x += sdx;
              wp.z += sdz;
              built.group.position.copy(parent.worldToLocal(wp));
            } else {
              built.group.position.x += sdx;
              built.group.position.z += sdz;
            }
          },
        };
        store._movables.push(mv);
        const prev = built.dispose;
        built.dispose = () => {
          prev?.();
          const i = store._movables.indexOf(mv);
          if (i >= 0) store._movables.splice(i, 1);
        };
      }
      return built;
    },
    { position, rotation, scale, deps: deps ?? [register, pinned, name, price, value] },
  );
  return null;
}

/** stall-component factory: `build(t, props, park)` + sale defaults → a
 *  component rendering <ConfigurableStall> */
export function composableStall<P extends object>(
  displayName: string,
  build: (t: typeof THREE, props: P, park: ParkContextValue) => THREE.Group | ComposableBuilt,
  stall: { name: string; item: StallItemKind; price: number; value: number },
): React.FC<P & ComposableStallProps> {
  const Component: React.FC<P & ComposableStallProps> = (all) => {
    const { position, rotation, scale, deps, register, pinned, name, price, value, ...rest } = all as ComposableStallProps & Record<string, unknown>;
    const props = rest as unknown as P;
    return (
      <ConfigurableStall
        build={(t, park) => build(t, props, park)}
        stall={stall}
        register={register}
        pinned={pinned}
        name={name}
        price={price}
        value={value}
        position={position}
        rotation={rotation}
        scale={scale}
        deps={deps ?? [register, pinned, name, price, value, rest]}
      />
    );
  };
  Component.displayName = displayName;
  return Component;
}

import React from 'react';
import * as THREE from 'three';
import { laneLenOf, groundRideAccess, obbOverlap, offPathCell, pathClearance, WATER_LEVEL, TILE } from '../ParkBuilder';
import type { ParkFootRect, StreetLattice } from '../ParkBuilder';
import { computeSplineFrames } from '../SplineCoaster';
import type { StallItemKind, StallItemBuilder, QueueSurface, RideStationConfig as GMRideStationConfig } from '../GameManager';
import { xzOf, yOf } from './parkContext';
import type { GameMgr, MovableRec, ParkContextValue, ParkPathsInfo, ParkStore, V3, XZ } from './parkContext';
import { useComposable, toBuilt, tagComponent } from './composable';
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

// ---------------------------------------------------------------------------
// THE RCT2 ENTRANCE/EXIT LAYOUT — adjacent on one station face, both outward
// ---------------------------------------------------------------------------
// WHAT RCT2 ACTUALLY ENFORCES, and what it merely CONVENTIONALISES. Read the
// source before changing any of this:
//
//   * ENFORCED. Each of the entrance and the exit must stand on a full tile
//     orthogonally adjacent to a STATION TRACK tile of its own ride, on a side
//     the track sequence permits. The tool refuses any other tile
//     (`RideGetEntranceOrExitPositionFromScreenPosition`,
//     openrct2-ui/ride/Construction.cpp:449-487) and `Ride::validateStations`
//     DELETES one that no longer qualifies (RideConstruction.cpp:1557-1592 —
//     line 1584 is the relative-direction test this file has always cited).
//   * ENFORCED. The stored element `direction` points INWARD, at the station;
//     both the queue and the footpath attach on the REVERSE side
//     (`kEntranceDirections` = 4, EntranceElement.cpp:22-26 +
//     Footpath.cpp:118-121). Our `dir`/`exitDir` are that reverse — the
//     OUTWARD facing, the sense of the UI's own
//     `gRideEntranceExitPlaceDirection` (Construction.cpp:479-483).
//   * NOT ENFORCED — and this corrects a premise. NOTHING in RCT2 relates the
//     entrance's tile or face to the exit's. `RideStation` holds two entirely
//     independent `TileCoordsXYZD` (Ride.h:172-173) and no code compares them;
//     each is validated only against the station track. On a long station the
//     entrance may sit on tile 1's north face and the exit on tile 4's south.
//     Placing them ADJACENT ON ONE FACE is player convention — the thing every
//     RCT2 player actually builds, because it is what makes one queue in and
//     one path out read as a station.
//
// So: adjacency is the DEFAULT and a WARNING when broken, never a hard error
// (see ParkBuilder/validate.ts check a4 for the same split), while the two
// things RCT2 does enforce — an axis-aligned outward facing and a path on the
// tile outside the exit — are load-bearing.

/** RCT2 tile pitch — the entrance/exit sit on ADJACENT tiles, i.e. this apart */
const HUT_PITCH = TILE;
/** the entrance hut stands this far back from the queue HEAD (registry.ts) */
const HUT_BACK = 0.62;

/** the two station-face cells ADJACENT to the entrance hut, nearest side first
 *  — both facing the same way OUT as the entrance (`dir`) */
export function adjacentExitCells(anchor: XZ, dir: XZ, sideHint = -1): { cell: XZ; side: number }[] {
  const hut: XZ = [anchor[0] - dir[0] * HUT_BACK, anchor[1] - dir[1] * HUT_BACK];
  const tan: XZ = [-dir[1], dir[0]]; // along the station face
  const first = sideHint >= 0 ? 1 : -1;
  return [first, -first].map((side) => ({
    cell: [hut[0] + tan[0] * HUT_PITCH * side, hut[1] + tan[1] * HUT_PITCH * side] as XZ,
    side,
  }));
}

/** is this exit cell/facing the RCT2 shape — one tile along the SAME station
 *  face as the entrance, doorway pointing the same way OUT? */
export function exitIsAdjacentOutward(
  anchor: XZ,
  dir: XZ,
  exit: XZ,
  exitDir: XZ,
): { ok: boolean; sameFace: boolean; along: number; across: number; dot: number } {
  const m = Math.hypot(exitDir[0], exitDir[1]) || 1;
  const ed: XZ = [exitDir[0] / m, exitDir[1] / m];
  const dot = ed[0] * dir[0] + ed[1] * dir[1];
  const hut: XZ = [anchor[0] - dir[0] * HUT_BACK, anchor[1] - dir[1] * HUT_BACK];
  const dx = exit[0] - hut[0];
  const dz = exit[1] - hut[1];
  const across = dx * dir[0] + dz * dir[1]; // out from the face (want ~0)
  const along = Math.abs(-dx * dir[1] + dz * dir[0]); // along the face (want ~1 tile)
  const sameFace = dot > 0.966; // within 15°, i.e. the same cardinal side
  // one tile is 1.2; allow up to 1.85 (a hut is 1.09 wide, so 1.2 is the tightest
  // legal pitch and ~1.5 is still one cell of slack) and 0.85 of depth wobble
  return { ok: sameFace && along <= 1.85 && Math.abs(across) <= 0.85, sameFace, along, across, dot };
}

/**
 * How far an EXIT PATH cast out of `from` along `dir` runs before it meets the
 * street — `Infinity` when nothing is on that ray inside `maxReach`. This is the
 * SAME ray-cast `GameManager/access.ts planExitLane` registers with; it lives
 * here too so the chassis can CHOOSE the exit cell before registering instead of
 * repairing it afterwards. Cardinal only, nodes and edge crossings both.
 */
export function exitLaneReach(
  from: XZ,
  dir: XZ,
  net: StreetLattice,
  streetNodes: number,
  maxReach = 9,
  /** the queue's TAIL cell — the JOIN fallback target (see planExitLane) */
  tail?: XZ,
): number {
  const start: XZ = [from[0] + dir[0] * HUT_BACK, from[1] + dir[1] * HUT_BACK];
  const px = -dir[1];
  const pz = dir[0];
  let best = Infinity;
  const n0 = Math.max(0, Math.min(streetNodes, net.nodes.length));
  for (let i = 0; i < n0; i += 1) {
    const ddx = net.nodes[i][0] - start[0];
    const ddz = net.nodes[i][1] - start[1];
    const along = ddx * dir[0] + ddz * dir[1];
    if (along < 0.35 || along > maxReach) continue;
    if (Math.abs(ddx * px + ddz * pz) > 0.45) continue;
    best = Math.min(best, along);
  }
  for (const [a, b] of net.edges) {
    if (a >= n0 || b >= n0) continue;
    const A = net.nodes[a];
    const B = net.nodes[b];
    const ex = B[0] - A[0];
    const ez = B[1] - A[1];
    const den = dir[0] * ez - dir[1] * ex;
    if (Math.abs(den) < 1e-6) continue; // parallel — never crossed
    const rx = A[0] - start[0];
    const rz = A[1] - start[1];
    const tt = (rx * ez - rz * ex) / den;
    const u = (rx * dir[1] - rz * dir[0]) / den;
    if (u < -0.02 || u > 1.02 || tt < 0.35 || tt > maxReach) continue;
    best = Math.min(best, tt);
  }
  // THE JOIN: a dead-end tail spur has no cross-street for the ray to meet, so
  // the path runs out level with the queue tail and turns one tile onto it —
  // the same fallback `planExitLane` registers with, so the cell CHOSEN here is
  // the cell that actually gets built.
  if (tail) {
    const ddx = tail[0] - start[0];
    const ddz = tail[1] - start[1];
    const alongT = ddx * dir[0] + ddz * dir[1];
    const lat = Math.abs(ddx * px + ddz * pz);
    if (alongT >= 0.35 && lat >= 0.6 && lat <= 1.85) best = Math.min(best, alongT + lat);
  }
  return best;
}

/**
 * PICK the exit cell: of the two station-face cells beside the entrance hut,
 * the legal one whose EXIT PATH is SHORTEST (the hint side wins ties within half
 * a tile). RCT2's exit path is a tile or three, not a causeway — the short side
 * is the one whose ray meets the CROSS-STREET through the queue's own tail node,
 * which is the shape a player builds; the long side is the ray that misses that
 * junction and runs on to the next street, and that is the run that ends up
 * crossing a plaza or another land on its way there.
 *
 * `reach: Infinity` on the returned cell means no street lies on its ray at all
 * — RCT2's `STR_EXIT_NOT_CONNECTED` condition (Ride.cpp:2076). The caller lints
 * it; nothing is auto-moved onto another face, because THAT is what produced the
 * stranded exits this whole change exists to fix.
 */
export function pickAdjacentExitCell(opts: {
  anchor: XZ;
  dir: XZ;
  sideHint?: number;
  net: StreetLattice;
  streetNodes: number;
  /** in bounds / dry / clear of every audited footprint (default: everything is) */
  isClean?: (cell: XZ) => boolean;
  /** the queue's TAIL cell — lets the JOIN fallback count as reachable */
  tail?: XZ;
}): { cell: XZ; reach: number; clean: boolean } {
  const cands = adjacentExitCells(opts.anchor, opts.dir, opts.sideHint ?? -1);
  const clean = opts.isClean ?? (() => true);
  let best: { cell: XZ; reach: number; clean: boolean } | null = null;
  cands.forEach((c, i) => {
    const ok = clean(c.cell);
    if (!ok) return;
    const reach = exitLaneReach(c.cell, opts.dir, opts.net, opts.streetNodes, 9, opts.tail) + (i === 0 ? 0 : 0.6);
    if (!best || reach < best.reach) best = { cell: c.cell, reach, clean: true };
  });
  if (best) return best;
  // neither cell is legal — keep the hinted one and report it unclean
  return { cell: cands[0].cell, reach: exitLaneReach(cands[0].cell, opts.dir, opts.net, opts.streetNodes, 9, opts.tail), clean: false };
}

/** the shared §0.4 lint text for an authored exit that is not adjacent-and-outward */
export function exitAdjacencyLintDetail(label: string, m: ReturnType<typeof exitIsAdjacentOutward>, exit: XZ, suggested: XZ, dir: XZ): string {
  return (
    `${label}: the authored exit hut at [${exit.map((v) => +v.toFixed(2)).join(', ')}] is NOT the RCT2 layout — ` +
    (m.sameFace
      ? `it faces the same way OUT as the entrance (good) but sits ${m.along.toFixed(2)} u along the face and ${m.across.toFixed(
          2,
        )} u out of it, where the RCT2 shape is ONE TILE (1.2 u) along and flush (0 u out)`
      : `its doorway facing is ${(Math.acos(Math.max(-1, Math.min(1, m.dot))) * (180 / Math.PI)).toFixed(
          0,
        )}° off the entrance's, so the two huts open onto DIFFERENT faces — a guest leaving walks out the back of the ride while the queue comes in the front`) +
    `. RCT2 does not FORBID this (nothing in the game relates station.Entrance to station.Exit — Ride.h:172-173, and each is validated only against the station track, RideConstruction.cpp:1584), which is why this is a warning and not a failure; but the entrance-beside-exit, queue-in / path-out station is what every RCT2 park is built from, and the EXIT PATH is cast along \`exitDir\` — a facing that points at the ride, or into a meadow, gets no path at all (RCT2 flags exactly that as STR_EXIT_NOT_CONNECTED, Ride.cpp:2076). Use exit [${suggested
      .map((v) => +v.toFixed(2))
      .join(', ')}] with exitDir [${dir.map((v) => +v.toFixed(2)).join(', ')}], or drop \`exit\`/\`exitDir\` and let the chassis derive the adjacent cell (§0.4)`
  );
}

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
    // wave-11 P0: hand the OFFENDER and the cell already computed above to the
    // settle pass, which MOVES it (`resolvePadOnStreet`). Only pads the gate
    // has actually judged to be in the slab are ever moved — the settle pass
    // never re-derives the geometry, so it cannot disagree with this lint.
    const st = park as ParkStore;
    if (st._padOnStreet)
      st._padOnStreet.push({ name: label.replace(/^\[Park\]\s*/, ''), at, to: spot ?? null, clear: need, kind });
    park.reportLint(
      'padOnStreet',
      `${label}: its ${kind} pad INTERSECTS the street — ${slab.toFixed(2)} u to ${slabWhat} near [${slabAt[0].toFixed(1)}, ${slabAt[1].toFixed(
        1,
      )}], inside the ${(pathHalf * 2).toFixed(
        1,
      )} u path slab. Guests cannot walk through it: every street edge crossing this pad becomes a \`blockers\` FAIL and any queue tail behind it becomes unreachable. Pads go on cell INTERIORS, ≥ ${PAD_OFF_LATTICE.toFixed(
        1,
      )} u off every lattice node and edge centreline (only the queue lane may touch a node — §0.14): ${fix}`,
      // wave-11 P0: NOT §0-fatal here any more. `resolvePadOnStreet` runs at
      // settle time over the same movable rig and APPLIES the cell computed
      // above; it re-reports the case as fatal only when the rig is pinned or
      // no legal cell exists. Reporting-and-shipping the broken placement is
      // what cost round 10 eleven points.
      false,
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

/**
 * PAD-ON-STREET AUTO-CORRECTION (wave-11 P0).
 *
 * ONE ride pad placed 0.00 u from a street node severed 81 % of round 10's
 * park A: 4 `blockers` FAILs, five rides and all seven stalls unreachable,
 * `nodesReachableFromGate: 28/146`, a dead sim — about eleven points from one
 * coordinate. And the validator ALREADY KNEW THE ANSWER: the mount-time
 * `padOnStreet` lint printed `offPathCell(net, [-14.4, 54.48], { clear: 2.40 })
 * → [-14.4, 52.8]` and then shipped the broken placement anyway.
 *
 * A lint that computes the fix and does not apply it guarantees the cascade,
 * so this settle pass applies it, on exactly the wave-9 `queueAnchorIsHead`
 * contract: MOVE the rig to the computed cell, REPORT it as a warning naming
 * the value (so the author writes it into the park), and leave it §0-FATAL
 * only when no legal cell exists or the rig is pinned. It runs on the same
 * `_movables` the corridor resolver uses, BEFORE it — a pad in the street is
 * a worse defect than a pad under a track, and the corridor pass then works
 * from the corrected cell.
 */
export function resolvePadOnStreet(ctx: ParkStore, mgr: GameMgr): void {
  const offenders = ctx._padOnStreet ?? [];
  if (!offenders.length || !ctx.paths || !ctx._movables.length) return;
  const half = ctx.size / 2;
  const allRects = (): ParkFootRect[] => [
    ...(mgr.footprints?.() ?? []),
    ...ctx._extraFootprints,
    ...(mgr.stalls?.() ?? []).map(stallFootRect),
  ];
  for (const off of offenders) {
    // the rig that owns this pad — `mv.label` is `<name> (flat-ride rig)` /
    // `<name> stall`, both prefixed with the registered name the lint used
    const mv = ctx._movables.find((m) => m.label === off.name || m.label.startsWith(`${off.name} `));
    if (!mv) {
      // nothing movable owns it (a tracked circuit, a preview host) — the
      // mount-time lint is advisory now, so the verdict has to be made here
      ctx.reportLint(
        'padOnStreet',
        `${off.name}: its pad stands IN the street and nothing movable owns it (a tracked circuit cannot be shifted — its rails would not follow), so it CANNOT be auto-corrected. Move it to [${
          off.to ? `${off.to[0].toFixed(2)}, ${off.to[1].toFixed(2)}` : 'a cell off the lattice'
        }] in the park source (§0.14)`,
        true,
      );
      continue;
    }
    if (mv.pinned) {
      ctx.reportLint(
        'padOnStreet',
        `${off.name}: its pad stands IN the street and the rig is PINNED, so it was left there. Unpin it or move the pad to [${
          off.to ? `${off.to[0].toFixed(2)}, ${off.to[1].toFixed(2)}` : 'a cell off the lattice'
        }] yourself (§0.14)`,
        true,
      );
      continue;
    }
    if (!off.to) {
      ctx.reportLint(
        'padOnStreet',
        `${off.name}: its pad stands IN the street and NO cell within 4.8 u clears ${off.clear.toFixed(
          2,
        )} u — the street skeleton itself is too dense here, so there is nothing to auto-correct to. Re-plan the cell (or the streets: buildParkNet + a set-piece, §3.1)`,
        true,
      );
      continue;
    }
    const dx = off.to[0] - off.at[0];
    const dz = off.to[1] - off.at[1];
    // the rig's OWN audited rects (the ones a shift carries with it)
    const rects = mv.rects();
    const ownLabels = new Set(rects.map((r) => r.label));
    const others = allRects().filter((o) => !ownLabels.has(o.label));
    const moved = rects.map((r) => ({ ...r, cx: r.cx + dx, cz: r.cz + dz }));
    const outOfPlot = moved.some((r) => Math.max(Math.abs(r.cx), Math.abs(r.cz)) > half - 0.55);
    // never TRADE a street intrusion for a footprint collision it did not have
    const pre = new Set(others.filter((o) => rects.some((r) => obbOverlap(r, o))).map((o) => o.label));
    const collides = others.some((o) => !pre.has(o.label) && moved.some((r) => obbOverlap(r, o)));
    if (outOfPlot || collides) {
      ctx.reportLint(
        'padOnStreet',
        `${off.name}: its pad stands IN the street, and the legal cell [${off.to[0].toFixed(2)}, ${off.to[1].toFixed(
          2,
        )}] the gate computed is ${outOfPlot ? 'outside the plot' : 'already occupied by another footprint'} — the auto-correction was REFUSED rather than trade one defect for another. Re-plan the cell (or the streets: buildParkNet + a set-piece, §3.1)`,
        true,
      );
      continue;
    }
    mv.shift(dx, dz);
    ctx.reportLint(
      'padOnStreet',
      `${off.name}: its ${off.kind} pad stood IN the street at [${off.at[0].toFixed(2)}, ${off.at[1].toFixed(
        2,
      )}] — AUTO-CORRECTED to [${off.to[0].toFixed(2)}, ${off.to[1].toFixed(2)}] = \`offPathCell(net, [${off.at[0].toFixed(
        2,
      )}, ${off.at[1].toFixed(2)}], { clear: ${off.clear.toFixed(2)} })\`, a shift of [${dx.toFixed(2)}, ${dz.toFixed(
        2,
      )}]. Uncorrected it severs the network behind it (round-10: 4 \`blockers\` FAILs, 5 rides + all 7 stalls unreachable, 28/146 nodes reachable from the gate, a dead sim — ~11 points from one coordinate). WRITE THE CORRECTED CELL INTO THE PARK: pads go on cell INTERIORS ≥ ${PAD_OFF_LATTICE.toFixed(
        1,
      )} u off every lattice node and edge centreline, and only the queue lane may touch a node (§0.14)`,
      false,
    );
  }
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
  /** what this ride's QUEUE LANE is paved with (default: RCT2 red).
   *  A themed land passes `theme.queueSurface` — the lanes are a path, and from
   *  the park camera an unthemed red lane is often the brightest paved surface
   *  in the land: measured in Pulse District, `QUEUE_RCT2` (luma 78.8) is
   *  brighter than the kerb meant to be its lightest line (75.0). */
  queueSurface?: QueueSurface;
  /** what this ride's EXIT PATH is paved with (default: `SURFACE_TARMAC`,
   *  municipal grey). The exit path is an ORDINARY footpath, never the red
   *  queue — RCT2's *"Construct a path from the ride exit"* (Ride.cpp:2076) —
   *  so its default is the stock street, not the queue's colour. A themed land
   *  passes `theme.pathSurface` here exactly as it passes `theme.queueSurface`
   *  to the lane: an unthemed grey run through a nightclub street reads as
   *  municipal infrastructure under a costume, which is the note
   *  `queueSurface` exists to answer for the lane. */
  exitSurface?: { pave: number; kerb?: number; seam?: number; paveTex?: string; kerbTex?: string; rough?: number };
  /**
   * ADDITIVE: WORLD-frame boarding anchor, overriding `layout.board`.
   *
   * A component's `layout.board` is a LOCAL offset baked in at
   * `composableRide()` time, which cannot describe a platform whose height is
   * an instance prop — an ELEVATED monorail station boards 2.45 u up on the
   * beam, not 0.25 u off the pad. Pass the resolved world point instead.
   */
  board?: V3;
  /**
   * ADDITIVE — EXTRA PLATFORMS for a multi-station transport ride. RCT2 rides
   * own an ARRAY of stations (`std::array<RideStation, kMaxStationsPerRide>`,
   * ride/Ride.h:404) and the transport RTDs are why: the monorail
   * (ride/rtd/transport/Monorail.h:19-84) sets neither `RtdFlag::hasOneStation`
   * nor `hasSinglePieceStation`, so its station count is unlimited (the legacy
   * RCT2 save format caps it at 4, rct12/Limits.h:21).
   *
   * The chassis DERIVES station 0 from `position`/`rotation`/`queue` as always.
   * These entries are passed to `registerRide` verbatim in WORLD coordinates —
   * one queue lane, entrance hut, exit hut and exit footpath each — because a
   * park-spanning circuit's platforms are nowhere near the component origin and
   * there is no local frame that could derive them. Publish the numbers
   * (rules/park-generation-rides.md §4.2) and copy them.
   */
  stations?: GMRideStationConfig[];
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
  /**
   * exit hut spot in LOCAL [x, z]. Since the RCT2 entrance/exit fix this is a
   * SIDE HINT, not a coordinate: the chassis puts the exit hut on the station
   * face the QUEUE comes off, ONE TILE (1.2 u) beside the entrance hut and
   * facing the same way out (the RCT2 layout — see `adjacentExitCells`), and all
   * this value contributes is the SIGN of its local x, i.e. which side of the
   * queue the catalog component wants its exit on. The old absolute cell
   * (default `[-1.5, 1.35]`, "beside the front") could not know the RESOLVED
   * queue direction — the orientation resolver may flip it — and so put derived
   * huts 3.9-4.8 u out on bare grass with the exit doorway facing the OPPOSITE
   * way from the entrance.
   */
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
  /** ADDITIVE, and the only channel that runs BACKWARDS — from the manager to
   *  the visual. A build that has ground-level structure serving its huts (the
   *  monorail's platform lifts and stair cores) cannot place it at build time:
   *  the huts come from the PARK's authored `queueAnchor` / `exitPoint`, are
   *  resolved against the access audit, and may be auto-shifted again. Called
   *  once, straight after `registerRide`, with one entry per station in station
   *  order, in WORLD xz. */
  onAccessPlaced?: (stations: { entrance: [number, number]; exit: [number, number] }[]) => void;
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
  // `layout.exit` is now only a SIDE HINT (see RideLayout.exit): its local-x sign
  // says which side of the queue face the catalog component wants its exit on.
  const exitSideHint = Math.sign((layout.exit ?? [-1.5, 1.35])[0]) || -1;
  const [lbx, lby, lbz] = (layout.board ?? [0, 0.25, 0]).map((v) => v * sc) as V3;
  // an ELEVATED platform (a monorail beam deck) cannot be described by a local
  // offset frozen at composableRide() time — `reg.board` is the world override
  const boardOverride = reg.board;
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
  }
  // NOTE the flush-to-the-−x-edge clamp that used to live here is GONE with the
  // absolute `layout.exit` cell it clamped. The exit is now derived from the
  // RESOLVED queue frame, at the entrance hut's own depth off the face, so it
  // clears the ride body by exactly the same 1.27 u the entrance hut does —
  // by construction, with nothing left to clamp.
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
  // the RCT2 exit cell — derived, never authored here: one tile along the
  // station face from the entrance hut, facing the same way out. Re-derived
  // after the orientation resolver settles `dz`/`anchor` below.
  let exit = adjacentExitCells(anchor, dz, exitSideHint)[0].cell;
  let exitDir: XZ = dz;
  const board: XZ = boardOverride ? [boardOverride[0], boardOverride[2]] : w(lbx, lbz);
  // ---- `queue.anchor` IS THE HEAD, NOT THE TAIL (round-7 safeguard) --------
  // Round-7's park wrote `queue={{ anchor: [-12, 3.6], dir: [0, 1] }}` on five
  // rides, meaning "land the tail on the street node at (−12, 3.6)". `anchor`
  // is the queue HEAD (the hut end): given that override the lane runs FROM
  // the node OUTWARD, straight along the street row, and its railings then
  // cross every perpendicular edge. Detect the tell — an explicit anchor
  // sitting ON a street node — and print the head coordinate that WOULD have
  // put the tail there.
  //
  // WAVE-9 P1 — THE LINT NOW AUTO-CORRECTS THE ANCHOR. Round 8 recorded this
  // §0-FATAL lint on two rides, PRINTED the right head coordinate, and then
  // kept the broken lane: the lanes ran down the street, which cost 5
  // `footprints` FAILs, 3 `padOnStreet`, 8 `blockers` and a DEAD sim
  // (queued 0 / riding 0 — no guest could reach a queue at all). A lint whose
  // remedy is a subtraction the code has already done should not be left to
  // the author: the anchor is moved to `tail − dir·(laneLenOf(capacity) +
  // 0.35)` and the lint is DOWNGRADED to a (still-reported) warning. The park
  // gets a working queue and a report line naming the arithmetic — which is
  // the pattern ("turn arithmetic into a block") that has worked all campaign.
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
      const tail: XZ = [anchor[0], anchor[1]];
      const head: XZ = [anchor[0] - dz[0] * join, anchor[1] - dz[1] * join];
      anchor = head; // AUTO-CORRECT: the tail now lands on the node, as intended
      park.reportLint(
        'queueAnchorIsHead',
        `${reg.name ?? d.name ?? 'Ride'}: queue.anchor [${tail.map((v) => +v.toFixed(2)).join(', ')}] sits ON street node ${onNode} — but \`anchor\` is the queue HEAD (the entrance-hut end), not the TAIL. AUTO-CORRECTED to [${head[0].toFixed(
          2,
        )}, ${head[1].toFixed(2)}] = node − dir·(laneLenOf(${capacity}) + 0.35) = node − dir·${join.toFixed(
          2,
        )}, so the lane now runs ${laneLenOf(capacity).toFixed(2)} u along [${dz
          .map((v) => +v.toFixed(2))
          .join(', ')}] and its TAIL lands on node ${onNode}. Uncorrected it would have run down the street itself with its railings across every edge it met (round-8: 5 footprints + 8 blockers FAILs and a dead sim). WRITE THE CORRECTED VALUE INTO THE PARK — pin the head, or drop \`queue\` entirely and let the derived lane trim itself onto the node (§0.4). Also re-check the PAD: it must sit ≥ 1.8 u off every lattice node and edge centreline (§0.14)`,
        false,
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
      exitDir: dz, // the exit doorway faces the SAME way OUT as the entrance
      exitYawOf: () => Math.atan2(dz[0], dz[1]),
      onLint: (kind, detail, fatal) => park.reportLint(kind, detail, fatal),
    });
    if (resolved.dir[0] !== dz[0] || resolved.dir[1] !== dz[1]) {
      dz = resolved.dir;
      front = frontFor(dz);
      anchor = [x + dz[0] * front, z + dz[1] * front];
      // the exit rides the FACE, so a flipped lane re-derives it (the old code
      // kept the stale cell, which is how a flip left the exit on the far side)
      exit = adjacentExitCells(anchor, dz, exitSideHint)[0].cell;
      exitDir = dz;
    } else {
      exit = resolved.exit;
    }
  }
  // ---- derived EXIT: WHICH SIDE of the entrance, and does its path reach? ----
  //
  // THE OLD RULE, AND WHY IT WAS WRONG. This block used to re-pick among the
  // ride's FOUR flush pad-edge cells "never the queue's own side" — i.e. it
  // deliberately put the exit on a DIFFERENT face from the entrance, and paired
  // that with `exitDir: [-dx]`, the NEGATED queue direction, so the exit doorway
  // faced the opposite way from the entrance. Nothing then led away from it.
  // Measured over the seven reference parks: 26 rides, ZERO adjacent-and-outward
  // pairs, 25 exits stranded on unpaved ground up to 14.4 u from the nearest
  // paving, several at non-cardinal yaws RCT2 cannot even represent (an
  // `EntranceElement` direction is one of four).
  //
  // THE RCT2 RULE. The exit takes the cell ONE TILE along the SAME station face
  // as the entrance, facing the same way OUT, so the queue runs IN beside it and
  // its own ordinary footpath runs OUT (see the header block). Both adjacent
  // cells satisfy that; this picks BETWEEN them, on the two things that actually
  // differ — whether the cell is legal (in bounds, dry, clear of every audited
  // footprint) and whether an EXIT PATH can be cast from it (a street on its
  // outward ray, `planExitLane`'s test, replicated here so the choice is made
  // BEFORE registration rather than repaired after).
  if (park.paths && !foot.isEmpty()) {
    const net = park.paths.net;
    const nStreet = park.paths.streetNodes;
    const streets = net.nodes.slice(0, nStreet);
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
      const r = hutRectFor(p, Math.atan2(dz[0], dz[1]), 'exit hut');
      return ![...ownRects, ...others].some((o) => obbOverlap(r, o));
    };
    const picked = pickAdjacentExitCell({
      anchor,
      dir: dz,
      sideHint: exitSideHint,
      net,
      streetNodes: nStreet,
      isClean: cleanAt,
      tail: [anchor[0] + dz[0] * (laneLenOf(capacity) + 0.35), anchor[1] + dz[1] * (laneLenOf(capacity) + 0.35)],
    });
    exit = picked.cell;
    exitDir = dz;
    if (!picked.clean)
      // NEITHER adjacent cell is legal — the station face is boxed in. The exit
      // stands on the hinted cell facing outward anyway (a cardinal facing is the
      // part RCT2 does enforce), and this is a RE-PLAN, not something to repair by
      // moving it onto another face: that repair is what produced the stranded
      // exits in the first place.
      park.reportLint(
        'exitFaceBlocked',
        `${reg.name ?? d.name ?? 'Ride'}: NEITHER station-face cell beside the entrance hut is a legal exit — both are out of bounds, wet, or already occupied by an audited footprint. The exit is standing on [${exit
          .map((v) => +v.toFixed(1))
          .join(', ')}] facing [${dz
          .map((v) => +v.toFixed(2))
          .join(
            ', ',
          )}] anyway. RE-PLAN: move the ride so the face its queue comes off has TWO free tiles — one for the entrance, one beside it for the exit (§0.4)`,
        false,
      );
    // report the paving distance the way the round-6 `exitSnapped` lint did, but
    // only when the pick genuinely has no path out (with a lane it is 0 by
    // definition — the run ENDS on the street)
    if (!Number.isFinite(picked.reach))
      park.reportLint(
        'exitLaneUnreachable',
        `${reg.name ?? d.name ?? 'Ride'}: its exit hut at [${exit.map((v) => +v.toFixed(1)).join(', ')}] faces [${dz
          .map((v) => +v.toFixed(2))
          .join(', ')}] with NO street on that ray inside 9 u (nearest paving ${toPath(exit).toFixed(
          1,
        )} u away), so the ride gets NO exit path and guests leaving it step onto bare ground. This is RCT2's STR_EXIT_NOT_CONNECTED — "has no path leading from its exit! Construct a path from the ride exit" (Ride.cpp:2076, reachability test Ride.cpp:2035 → Map.cpp:707) — and in RCT2 a guest put down off the paving falls to the terrain and wanders off lost (Guest.cpp:5092-5140 → Peep.cpp:781-890). FIX THE LAYOUT: aim the queue face at a street the exit path can reach too (the tail node's CROSS street is what the adjacent exit lane meets), or move the ride onto the lattice row (§0.4)`,
        false,
      );
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
    // the world's queue theme — forwarded here, NOT swept into ...rest (the
    // round-7 mistake this file documents), which is why it never reached the
    // lane before and every themed land shipped RCT2-red queues
    queueSurface: reg.queueSurface,
    exitSurface: reg.exitSurface, // the world's STREET surface for the path OUT
    seatWorld: built.seatWorld,
    onStateChange: built.onStateChange,
    vehicleHandle: built.crashed ? { crashed: built.crashed } : undefined,
    ratings: built.ratings, // ADDITIVE: measured RCT2 ratings, if the build has them
    queueAnchor: [anchor[0], y + 0.05, anchor[1]],
    queueDir: dz,
    laneLen, // trimmed so the tail lands on the planned street node
    boardPoint: boardOverride ? [boardOverride[0], boardOverride[1], boardOverride[2]] : [board[0], y + lby, board[1]],
    // ADDITIVE: every EXTRA platform, verbatim in world coordinates
    ...(reg.stations && reg.stations.length ? { stations: reg.stations } : {}),
    exitPoint: [exit[0], y + 0.05, exit[1]],
    // RCT2's outward exit facing (the reverse of the stored element direction) —
    // WITHOUT this the manager falls back to `boardPoint → exitPoint`, which for
    // the adjacent-cell layout is DIAGONAL and skews the hut off the grid
    exitDir,
  });
  built.group.userData.rideRef = handle; // click -> RideViewer (rules/ui.md)
  // hand the RESOLVED hut coordinates back to the visual. The entrance hut is
  // not a field on the handle — it stands 0.62 back from the queue HEAD
  // (GameManager/registry.ts:155), which is the same arithmetic groundRideAccess
  // does just below — while the exit hut IS published, post-audit, as `exitAt`.
  built.onAccessPlaced?.(
    handle.stations().map((s) => ({
      entrance: [s.queueAnchor[0] - s.queueDir[0] * 0.62, s.queueAnchor[2] - s.queueDir[1] * 0.62] as [number, number],
      exit: [s.exitAt[0], s.exitAt[2]] as [number, number],
    })),
  );
  if (built.vehicle) built.group.userData.rideVehicle = built.vehicle;
  // ground the access assembly (berms/plinths) like <Coaster>/<FlatRide>
  const g = new t.Group();
  const join = laneLen + 0.35;
  const crTail: [number, number] = [anchor[0] + dz[0] * join, anchor[1] + dz[1] * join];
  // graded berm under a graded lane: the queue runs from this ride's own level
  // down to the street its tail lands on (GameManager buildQueueLane)
  const crTailY =
    (park.paths as (ParkPathsInfo & { walkYAt?: (x: number, z: number) => number }) | null)?.walkYAt?.(crTail[0], crTail[1]) ?? y + 0.05;
  groundRideAccess(
    t,
    g,
    (xx, zz) => park.groundAt(xx, zz),
    {
      hut: [anchor[0] - dz[0] * 0.62, anchor[1] - dz[1] * 0.62],
      dir: dz,
      anchor,
      tail: crTail,
      tailNode: -1,
      exit,
      exitDir,
      capacity,
    },
    y + 0.05,
    [handle.exitPoint()[0], handle.exitPoint()[2]],
    crTailY,
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
   *  HEAD, `dir` the lane axis (lane LENGTH always follows `capacity`).
   *
   *  `anchor` IS THE HEAD (the entrance-hut end), never the tail:
   *  `anchor = tailNode − dir·(laneLenOf(capacity) + 0.35)`. An anchor landing
   *  ON a street node is the tail-instead-of-head mistake, and since wave 9 it
   *  is AUTO-CORRECTED to that expression with a `queueAnchorIsHead` warning
   *  naming the value — write the corrected number into the park. */
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
   *  HEAD, `dir` the lane axis (lane LENGTH always follows `capacity`).
   *
   *  `anchor` IS THE HEAD (the entrance-hut end), never the tail:
   *  `anchor = tailNode − dir·(laneLenOf(capacity) + 0.35)`. An anchor landing
   *  ON a street node is the tail-instead-of-head mistake, and since wave 9 it
   *  is AUTO-CORRECTED to that expression with a `queueAnchorIsHead` warning
   *  naming the value — write the corrected number into the park. */
  queue?: { anchor?: XZ; dir?: XZ };
}

/**
 * THE CATALOG KIND for a ride mounted through <ConfigurableRide> DIRECTLY —
 * derived from the chassis layout's own `defaults.name`, which is the one piece
 * of catalog identity the chassis already has (`composableRide()` passes the
 * real `displayName`, and a ride that arrives already tagged keeps it).
 *
 * WHY IT IS DERIVED AND NOT PASSED IN. `<ConfigurableRide>` takes no "kind"
 * prop and must not grow one — its prop surface is public and additive-only
 * changes there ship as version bumps. `defaults.name` is a `RideLayout` field
 * every ride component already fills in (`{ name: 'Ferris Wheel', … }`), and
 * squeezing out the spaces is exactly the mapping the eval harness already
 * performs in the other direction (`catalog.mjs`'s defaultName → kind table):
 * 'Ferris Wheel' → FerrisWheel, 'Top Spin' → TopSpin, 'Swinging Inverter
 * Ship' → SwingingInverterShip.
 *
 * It is NOT guaranteed to equal the component's `displayName` — `<TwistRide>`
 * ships `defaults.name: 'Twist'` and so reads 'Twist' here — and that is
 * harmless by construction: `COMPONENT_THEME` (ParkBuilder/worlds.ts) only
 * lists pieces whose SUBJECT MATTER belongs to one world, every one of those
 * ride components goes through the `composableRide()` factory and is tagged
 * with its exact displayName, and everything else is NEUTRAL either way. What
 * the derived kind has to be is NON-EMPTY, so the world audit stops dropping
 * the group (see `auditWorldThemes`).
 */
export const rideKindOfLayout = (layout?: RideLayout): string =>
  (layout?.defaults?.name ?? '').replace(/[^A-Za-z0-9]/g, '') || 'Ride';

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
      // ---- THE COMPONENT TAG, HERE AND NOT ONLY IN THE FACTORY (wave-16B) ---
      // `composableRide()` tags inside the `build` it passes down, so a factory
      // ride arrives here ALREADY tagged and keeps its exact displayName. A ride
      // component that renders <ConfigurableRide> DIRECTLY was never tagged at
      // all — FerrisWheel, Teacups, TwistRide, SwingRide, TopSpin,
      // SwingingInverterShip and <TrackRide>, seven mounts — and
      // `auditWorldThemes` skips an untagged group, so those rides were INVISIBLE
      // to the world layer. Measured on wave-16B: Thornwood Twist stood at
      // [55.66, −19.2], inside thornwick's rect, and the world still reported
      // `rideCount: 0` / `built: false`, the gate raised `worldNotBuiltOut`, and
      // axis 16's buildOut scored 0.67/1 — a park was docked for a district it
      // had actually built. Tagging at the chassis fixes every one of them at
      // once and cannot regress a factory ride (the guard below never overwrites
      // a tag that is already there).
      if (!built.group?.userData?.dsComponent) tagComponent(built, rideKindOfLayout(layout), 'ride');
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
        build={(t, park) => {
          const res = build(t, props, park);
          // THE COMPONENT TAG — see composable.tsx's tagComponent: the WORLD
          // THEME COHERENCE audit needs to know a ride group's catalog kind
          tagComponent(toBuilt(res), displayName, 'ride');
          return res;
        }}
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
  /** override what it sells ('food' | 'drink' | 'balloon' | 'wearable') */
  item?: StallItemKind;
  /** override the 3D item buyers carry away / wear (GameManager
   *  StallItemBuilder) — the stall's own recipe is the default */
  heldItem?: StallItemBuilder;
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
   *  AND accessories ('balloon' / 'wearable', open for future kinds), and the
   *  OPTIONAL `heldItem` is the themed 3D item a buyer carries away (a mini
   *  hot dog, a floss cone) or wears (goggles). Omit `heldItem` and consumable
   *  buyers fall back to the manager's generic burger / cup. See GameManager */
  stall: { name: string; item: StallItemKind; price: number; value: number; heldItem?: StallItemBuilder };
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
      // the SAME hole as <ConfigurableRide> above, one shop wide: `<Stall kind>`
      // (Park/wrappers.tsx) routes through <ConfigurableStall> DIRECTLY, so a
      // generic balloon stand never carried the component tag and never counted
      // toward its world's `stallCount`. The stall's own catalog `name` is the
      // kind here ('Balloon Stand' → BalloonStand); `composableStall()` has
      // already stamped the real displayName by the time we get here.
      if (!built.group?.userData?.dsComponent)
        tagComponent(built, stall.name.replace(/[^A-Za-z0-9]/g, '') || 'Stall', 'stall');
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
          // the stall's own themed 3D item for its buyers (overridable per
          // placement) — undefined leaves consumables on the generic burger/cup
          heldItem: ro.heldItem ?? stall.heldItem,
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
  stall: { name: string; item: StallItemKind; price: number; value: number; heldItem?: StallItemBuilder },
): React.FC<P & ComposableStallProps> {
  const Component: React.FC<P & ComposableStallProps> = (all) => {
    const { position, rotation, scale, deps, register, pinned, name, price, value, ...rest } = all as ComposableStallProps & Record<string, unknown>;
    const props = rest as unknown as P;
    return (
      <ConfigurableStall
        build={(t, park) => {
          const res = build(t, props, park);
          tagComponent(toBuilt(res), displayName, 'stall');
          return res;
        }}
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

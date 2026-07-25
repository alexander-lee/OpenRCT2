// ---------------------------------------------------------------------------
// RIDE ACCESS RIGS — the queue lane mesh + its railing blockers, the queue
// slot geometry, the deterministic placement audit (placeAccess), the RCT2
// status line / breakdown schedule, the NaN-guarded routing attach, and the
// settle-time RELOCATION tooling (moveRide / moveRideExit / resizeRideLane /
// moveStall) plus the coaster-corridor cell sweep.
//
// No randomness anywhere: every collision fix walks a fixed offset ladder and
// every reliability figure is a hashed constant. Implementation detail of
// createGameManager.
// ---------------------------------------------------------------------------

import type * as THREE from 'three';
import { box } from '../Stage';
import { buildFenceRuns } from '../Fence';
import { hash01, SPACING, BREAK_DOWN_SECS } from './types';
import type { BlockerRectSpec, RideStatus, RideRec, WayPt } from './types';
import type { Sim } from './sim';

// ---- queue lane in the QueuePath aesthetic: narrow red slab + FENCED sides -
// The lane is RAILED down both long sides with the Fence 'metal' style (the
// RCT2 queue railing), batched into two merged meshes instead of ~18 loose
// posts/rails. The railings are part of the ride's access rig, so they move
// and rebuild with the lane (moveRide / resizeRideLane), and both sides are
// registered as BLOCKERS — a queue is only enterable at its open TAIL, so
// guests must path to the tail node instead of stepping in sideways.
export const LANE_W = 0.55;
export const LANE_RAIL_X = LANE_W / 2 + 0.05;
/** the railings stop this far short of the TAIL — the queue's open mouth */
export const LANE_MOUTH = 0.14;

export const buildQueueLane = (t: typeof THREE, anchor: [number, number, number], dir: [number, number], len: number) => {
  const lane = new t.Group();
  lane.position.set(anchor[0], anchor[1], anchor[2]);
  lane.rotation.y = Math.atan2(dir[0], dir[1]); // local +z runs head -> tail
  const PAVE = 0x9e3a34;
  lane.add(
    box(t, [LANE_W, 0.09, len], PAVE, [0, 0.045, len / 2], {
      tex: 'asphalt',
      repeat: [2, Math.max(2, Math.round(len * 3.3))],
      rough: 0.95,
      bump: 0.02,
    }),
  );
  const rl = Math.max(0.3, len - LANE_MOUTH);
  const rails = buildFenceRuns(
    t,
    [
      { from: [-LANE_RAIL_X, 0], to: [-LANE_RAIL_X, rl] },
      { from: [LANE_RAIL_X, 0], to: [LANE_RAIL_X, rl] },
    ],
    { style: 'metal', height: 0.5, groundAt: () => 0.09 }, // lane-local: the slab top
  );
  lane.add(rails.group);
  return lane;
};

/** the lane railings' WORLD blocker rects (both long sides) */
export const laneFenceRects = (anchor: [number, number, number], dir: [number, number], len: number): BlockerRectSpec[] => {
  const yaw = Math.atan2(dir[0], dir[1]);
  const px = dir[1]; // local +x in world = [cos yaw, −sin yaw] = [dir.z, −dir.x]
  const pz = -dir[0];
  const rl = Math.max(0.3, len - LANE_MOUTH);
  return [-1, 1].map((s) => ({
    cx: anchor[0] + px * s * LANE_RAIL_X + dir[0] * (rl / 2),
    cz: anchor[2] + pz * s * LANE_RAIL_X + dir[1] * (rl / 2),
    hx: 0.07,
    hz: rl / 2 + 0.07,
    yaw,
  }));
};

export const slotPos = (r: RideRec, i: number): WayPt => ({
  x: r.cfg.queueAnchor[0] + r.dir[0] * (0.45 + i * SPACING),
  z: r.cfg.queueAnchor[2] + r.dir[1] * (0.45 + i * SPACING),
  y: r.laneY,
});

// ---- placeAccess: deterministic entrance/exit/queue placement audit -------
// Conservative oriented-rectangle footprints (2D SAT) for the entrance hut,
// exit hut, queue lane and boardPoint pad. registerRide checks this ride's
// footprints against each other AND every previously registered ride's; any
// collision is console.warn'ed with specifics, and an EXIT collision is
// auto-fixed by shifting the exit hut along its pad edge (first non-
// colliding offset in 0, ±0.1 … ±0.8). No randomness anywhere.
export interface FootRect {
  cx: number;
  cz: number;
  hx: number; // half-extent along local x
  hz: number; // half-extent along local z (yaw facing)
  yaw: number;
  label: string;
}

export const rectsOverlap = (a: FootRect, b: FootRect): boolean => {
  // 2D OBB SAT: 4 candidate axes (each rect's local x and z)
  const axes: [number, number][] = [
    [Math.cos(a.yaw), -Math.sin(a.yaw)],
    [Math.sin(a.yaw), Math.cos(a.yaw)],
    [Math.cos(b.yaw), -Math.sin(b.yaw)],
    [Math.sin(b.yaw), Math.cos(b.yaw)],
  ];
  const dx = b.cx - a.cx;
  const dz = b.cz - a.cz;
  for (const [ux, uz] of axes) {
    const ra =
      a.hx * Math.abs(Math.cos(a.yaw) * ux - Math.sin(a.yaw) * uz) + a.hz * Math.abs(Math.sin(a.yaw) * ux + Math.cos(a.yaw) * uz);
    const rb =
      b.hx * Math.abs(Math.cos(b.yaw) * ux - Math.sin(b.yaw) * uz) + b.hz * Math.abs(Math.sin(b.yaw) * ux + Math.cos(b.yaw) * uz);
    if (Math.abs(dx * ux + dz * uz) > ra + rb) return false; // separating axis
  }
  return true;
};

export const hutRect = (x: number, z: number, yaw: number, label: string): FootRect =>
  ({ cx: x, cz: z, hx: 0.55, hz: 0.5, yaw, label }); // base slab 1.09×0.94 + margin

// ---- additive breakdown model: deterministic, hashed per-ride reliability -
// Each ride carries a hashed reliability that fixes its mean time between
// failures; breakdowns fire on a schedule (no randomness at run time), last
// BREAK_DOWN_SECS ('brokenDown') + REPAIR_SECS ('beingRepaired') and then
// the ride reopens. While broken the FSM is paused (no admissions) and the
// queue drains through the existing crash-ish path (guests walk off).
export const breakIntervalOf = (r: RideRec): number => {
  const rel = hash01(r.idx * 47.9 + 11.3); // 0 fragile .. 1 reliable
  const base = r.cfg.breakdownEvery ?? 40 + rel * 55;
  return base + hash01(r.idx * 13.1 + r.breakN * 29.7) * base * 0.25;
};

export function createAccess(s: Sim) {
  const { t, opts, net, routing, groundAt, rides, stalls } = s;

  const allFootprints: FootRect[] = [];
  // RESIDUAL access collisions (no safe auto-fix / auto-fix exhausted) —
  // recorded so validatePark can promote them to hard failures (round-1
  // safeguard: an overlap must never stay a console-only warn)
  const accessAuditRecs: { a: string; b: string; msg: string }[] = [];
  const placeAccess = (
    name: string,
    entRect: FootRect,
    laneRect: FootRect,
    padRect: FootRect,
    exitXZ: [number, number],
    exitYaw: number,
  ): { exit: [number, number]; shift: number } => {
    const warn = (msg: string) => console.warn(`[GameManager] placeAccess(${name}): ${msg}`);
    // entrance hut / queue lane vs own pad and vs every earlier ride — these
    // have no safe auto-fix, so report them for the caller to re-plan
    const fixed: [FootRect, FootRect[]][] = [
      [entRect, [padRect, ...allFootprints]], // ent×lane skipped: they abut by design
      [laneRect, [padRect, ...allFootprints]],
    ];
    for (const [rect, others] of fixed) {
      for (const o of others)
        if (rectsOverlap(rect, o)) {
          warn(`${rect.label} intersects ${o.label} — adjust queueAnchor/queueDir`);
          accessAuditRecs.push({ a: rect.label, b: o.label, msg: `${rect.label} intersects ${o.label} — adjust queueAnchor/queueDir` });
        }
    }
    // exit hut: try pad-edge tangent offsets deterministically until clear
    const tan: [number, number] = [Math.cos(exitYaw), -Math.sin(exitYaw)]; // ⟂ to the exit's outward facing
    const exitBlockers = [entRect, laneRect, padRect, ...allFootprints];
    const shifts = [0, 0.1, -0.1, 0.2, -0.2, 0.3, -0.3, 0.4, -0.4, 0.5, -0.5, 0.6, -0.6, 0.7, -0.7, 0.8, -0.8];
    for (const sh of shifts) {
      const ex = hutRect(exitXZ[0] + tan[0] * sh, exitXZ[1] + tan[1] * sh, exitYaw, `${name} exit hut`);
      const hit = exitBlockers.find((o) => rectsOverlap(ex, o));
      if (!hit) {
        if (sh !== 0) warn(`exit hut collided at its configured spot — auto-shifted ${sh > 0 ? '+' : ''}${sh.toFixed(1)} along its pad edge`);
        return { exit: [ex.cx, ex.cz], shift: sh };
      }
      if (sh === 0) warn(`exit hut intersects ${hit.label} — searching along the pad edge`);
    }
    warn('exit hut still collides after ±0.8 pad-edge search — keeping the configured spot');
    accessAuditRecs.push({
      a: `${name} exit hut`,
      b: 'multiple obstacles',
      msg: `${name} exit hut still collides after the ±0.8 pad-edge search — re-plan the exit cell`,
    });
    return { exit: exitXZ, shift: 0 };
  };

  // the RCT2 ride-window status line (Ride::formatStatusTo, Ride.cpp:528-564)
  const statusOf = (r: RideRec): RideStatus => {
    if (r.state === 'crashed') return 'closed'; // wreck: not operating
    if (r.brokenAt >= 0) return s.simTime - r.brokenAt < BREAK_DOWN_SECS ? 'brokenDown' : 'beingRepaired';
    return 'open';
  };

  // ---- NaN guard for the routing-attach math ---------------------------------
  // A registration built from a bad anchor (e.g. a 2-element anchor where
  // [x, y, z] is expected, or a doorway derived from a failed hut placement)
  // used to push a NaN node into the SHARED path net — silently corrupting
  // the whole graph (paths.totalLength → NaN). Skip + warn instead.
  const safeAttach = (label: string, x: number, z: number): { node: number; x: number; z: number } | null => {
    if (!routing) return null;
    if (!Number.isFinite(x) || !Number.isFinite(z)) {
      console.warn(
        `[GameManager] ${label}: attach point [${x}, ${z}] is not finite — check the registration's anchor/exit/doorway (world [x, y, z] points); NOT attached to the path graph`,
      );
      return null;
    }
    return routing.attach(x, z);
  };

  // ---- runtime relocation + corridor accessors (round-5 safeguard) ----------
  // <Park>'s settle-time corridor auto-resolver moves a flat ride/stall whose
  // registered footprint landed inside a coaster's 1.6-u track corridor. These
  // keep the SIM in lockstep with the moved visual: every registered point,
  // audited footprint rect, hut/lane mesh and routing attach node translates
  // by the same [dx, dz]. Call BEFORE guests spawn (the <Park> settle pass
  // does) — waypoints already handed to walking guests are not rewritten.
  const shiftWayPt = (p: WayPt, dx: number, dz: number) => {
    p.x += dx;
    p.z += dz;
  };
  // a relocation can RESOLVE a registration-time placeAccess collision — drop
  // every recorded residual whose rects no longer overlap, so validatePark
  // doesn't fail a collision that no longer exists
  const reauditAccess = () => {
    for (let i = accessAuditRecs.length - 1; i >= 0; i -= 1) {
      const rec = accessAuditRecs[i];
      const ra = allFootprints.find((f) => f.label === rec.a);
      if (!ra) continue;
      if (rec.b === 'multiple obstacles') {
        const rideName = rec.a.replace(/ exit hut$/, '');
        if (allFootprints.every((f) => f === ra || f.label.startsWith(`${rideName} `) || !rectsOverlap(ra, f))) accessAuditRecs.splice(i, 1);
        continue;
      }
      const rb = allFootprints.find((f) => f.label === rec.b);
      if (rb && !rectsOverlap(ra, rb)) accessAuditRecs.splice(i, 1);
    }
  };
  const shiftAttach = (a: { node: number; x: number; z: number } | null, dx: number, dz: number) => {
    if (!a) return;
    a.x += dx;
    a.z += dz;
    if (net && net.nodes[a.node]) net.nodes[a.node] = [a.x, a.z]; // logical spur node — routing reads coords live
  };
  /** translate a registered ride (queue anchor, boarding/exit points, hut +
   *  lane meshes, footprints, routing spurs) by [dx, dz]. The ride's MAIN
   *  visual is the caller's — move it by the same delta. */
  const moveRide = (name: string, dx: number, dz: number): boolean => {
    const r = rides.find((rr) => rr.cfg.name === name);
    if (!r) return false;
    r.cfg.queueAnchor = [r.cfg.queueAnchor[0] + dx, r.cfg.queueAnchor[1], r.cfg.queueAnchor[2] + dz];
    r.cfg.boardPoint = [r.cfg.boardPoint[0] + dx, r.cfg.boardPoint[1], r.cfg.boardPoint[2] + dz];
    r.cfg.exitPoint = [r.cfg.exitPoint[0] + dx, r.cfg.exitPoint[1], r.cfg.exitPoint[2] + dz];
    [r.doorway, r.hutIn, r.exitPos, r.exitDoor, r.exitOut].forEach((p) => shiftWayPt(p, dx, dz));
    shiftAttach(r.queueAttach, dx, dz);
    shiftAttach(r.exitAttach, dx, dz);
    r.accessG.position.x += dx;
    r.accessG.position.z += dz;
    allFootprints.forEach((f) => {
      if (f.label.startsWith(`${name} `)) {
        f.cx += dx;
        f.cz += dz;
      }
    });
    // the pad + queue-railing blockers travel with the rig
    r.padBlocker?.move(dx, dz);
    r.laneBlockers.forEach((b) => b.move(dx, dz));
    reauditAccess();
    return true;
  };
  /** relocate ONLY a ride's exit hut (mesh, exit points, routing spur,
   *  footprint) by [dx, dz] — the corridor auto-resolver's small fix when the
   *  exit hut alone landed inside a coaster corridor (same spirit as
   *  placeAccess' pad-edge exit shift). */
  const moveRideExit = (name: string, dx: number, dz: number): boolean => {
    const r = rides.find((rr) => rr.cfg.name === name);
    if (!r) return false;
    r.cfg.exitPoint = [r.cfg.exitPoint[0] + dx, r.cfg.exitPoint[1], r.cfg.exitPoint[2] + dz];
    [r.exitPos, r.exitDoor, r.exitOut].forEach((p) => shiftWayPt(p, dx, dz));
    shiftAttach(r.exitAttach, dx, dz);
    r.exitG.position.x += dx;
    r.exitG.position.z += dz;
    allFootprints.forEach((f) => {
      if (f.label === `${name} exit hut`) {
        f.cx += dx;
        f.cz += dz;
      }
    });
    reauditAccess();
    return true;
  };
  /** SHORTEN a ride's queue lane to `newLen` (≥ 1.2): rebuilds the lane
   *  mesh, shrinks the audited footprint, recomputes the slot count and pulls
   *  the tail spur in. The corridor auto-resolver's last-resort tier for
   *  rigs whose derived lane is too long to fit anywhere. Call before guests
   *  spawn (the queue must be empty). */
  const resizeRideLane = (name: string, newLen: number): boolean => {
    const r = rides.find((rr) => rr.cfg.name === name);
    if (!r) return false;
    const len = Math.max(1.2, newLen);
    if (len >= r.laneLen) return false;
    r.laneLen = len;
    r.maxSlots = Math.max(2, Math.floor((len - 0.45) / SPACING));
    // rebuild the lane mesh (accessG may already carry a moveRide offset)
    r.accessG.remove(r.laneG);
    r.laneG.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.geometry && !m.geometry.userData?.shared) m.geometry.dispose();
      if (m.material) (Array.isArray(m.material) ? m.material : [m.material]).forEach((mm) => mm.dispose());
    });
    r.laneG = buildQueueLane(
      t,
      [r.cfg.queueAnchor[0] - r.accessG.position.x, r.cfg.queueAnchor[1] - r.accessG.position.y, r.cfg.queueAnchor[2] - r.accessG.position.z],
      r.dir,
      len,
    );
    r.accessG.add(r.laneG);
    // audited footprint follows
    allFootprints.forEach((f) => {
      if (f.label === `${name} queue lane`) {
        f.cx = r.cfg.queueAnchor[0] + r.dir[0] * (len / 2);
        f.cz = r.cfg.queueAnchor[2] + r.dir[1] * (len / 2);
        f.hz = len / 2;
      }
    });
    // …and so do the lane's fence-railing blockers (rebuilt at the new length)
    laneFenceRects(r.cfg.queueAnchor, r.dir, len).forEach((rect, i) => r.laneBlockers[i]?.set({ rect }));
    // tail spur pulls in with the lane
    if (r.queueAttach) {
      r.queueAttach.x = r.cfg.queueAnchor[0] + r.dir[0] * (len + 0.35);
      r.queueAttach.z = r.cfg.queueAnchor[2] + r.dir[1] * (len + 0.35);
      if (net && net.nodes[r.queueAttach.node]) net.nodes[r.queueAttach.node] = [r.queueAttach.x, r.queueAttach.z];
    }
    reauditAccess();
    return true;
  };
  /** translate a registered stall (anchor, serving front, routing spur) by
   *  [dx, dz]. The stall's visual mesh is the caller's — move it too. */
  const moveStall = (name: string, dx: number, dz: number): boolean => {
    const st = stalls.find((ss) => ss.cfg.name === name);
    if (!st) return false;
    st.cfg.anchor = [st.cfg.anchor[0] + dx, st.cfg.anchor[1], st.cfg.anchor[2] + dz];
    shiftWayPt(st.front, dx, dz);
    shiftAttach(st.attach, dx, dz);
    st.blocker?.move(dx, dz); // the shop body travels with the registration
    return true;
  };
  /** COASTER-CORRIDOR CELLS: 1.2-grid cells (cell centres, street-lattice
   *  aligned) within 1.6 u laterally of a registered circuit's sampled
   *  polyline where the rails run LOW (< 2.2 u of clearance over the cell
   *  ground — flying over higher is legal). Street layouts and stall/pad
   *  placements should avoid these cells BY CONSTRUCTION; `name` filters to
   *  one registered circuit. Requires the `circuits` opt (<Park> wires it). */
  const corridorCells = (name?: string): [number, number][] => {
    const segD = (ax: number, az: number, bx: number, bz: number, x: number, z: number): number => {
      const vx = bx - ax;
      const vz = bz - az;
      const L2 = vx * vx + vz * vz;
      const u = L2 > 0 ? Math.max(0, Math.min(1, ((x - ax) * vx + (z - az) * vz) / L2)) : 0;
      return Math.hypot(x - (ax + u * vx), z - (az + u * vz));
    };
    const CORR = 1.6;
    const CLEAR = 2.2;
    const list = (opts.circuits?.() ?? []).filter((c) => (!name || c.name === name) && !c.fatal && c.points.length >= 4);
    const out: [number, number][] = [];
    const seen = new Set<string>();
    for (const c of list) {
      const curve = new t.CatmullRomCurve3(
        c.points.map(([x, y, z]) => new t.Vector3(x, y, z)),
        true,
      );
      const P = curve.getPoints(Math.max(64, Math.ceil(curve.getLength() * 2)));
      for (let i = 0; i < P.length - 1; i += 1) {
        const a = P[i];
        const b = P[i + 1];
        const minY = Math.min(a.y, b.y);
        const i0 = Math.floor((Math.min(a.x, b.x) - CORR) / 1.2);
        const i1 = Math.ceil((Math.max(a.x, b.x) + CORR) / 1.2);
        const j0 = Math.floor((Math.min(a.z, b.z) - CORR) / 1.2);
        const j1 = Math.ceil((Math.max(a.z, b.z) + CORR) / 1.2);
        for (let ci = i0; ci <= i1; ci += 1)
          for (let cj = j0; cj <= j1; cj += 1) {
            const key = `${ci},${cj}`;
            if (seen.has(key)) continue;
            const cx = ci * 1.2;
            const cz = cj * 1.2;
            if (segD(a.x, a.z, b.x, b.z, cx, cz) > CORR) continue;
            if (minY - groundAt(cx, cz) >= CLEAR) continue; // soaring over — legal
            seen.add(key);
            out.push([cx, cz]);
          }
      }
    }
    out.sort((p, q) => p[0] - q[0] || p[1] - q[1]);
    return out;
  };

  return {
    allFootprints,
    accessAuditRecs,
    placeAccess,
    statusOf,
    safeAttach,
    shiftWayPt,
    reauditAccess,
    shiftAttach,
    moveRide,
    moveRideExit,
    resizeRideLane,
    moveStall,
    corridorCells,
  };
}

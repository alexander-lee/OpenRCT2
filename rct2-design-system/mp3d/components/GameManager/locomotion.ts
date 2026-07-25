// ---------------------------------------------------------------------------
// LOCOMOTION — the blocker-aware walking primitive shared by every off-network
// hop (stall fronts, hut doorways, bins, queue joins) plus the needs-driven
// walk-speed model and the waypoint runner.
//
// `moveToward` keeps its byte-identical FAST PATH: with nothing solid
// registered (every component preview, and parks without blockers) it takes
// the classic straight-line step, so the pre-blocker behaviour is preserved
// exactly. Implementation detail of createGameManager.
// ---------------------------------------------------------------------------

import { hash01 } from './types';
import type { SimGuest } from './types';
import type { Sim } from './sim';

export function createLocomotion(s: Sim) {
  // ---- movement helpers -------------------------------------------------------
  // Which object's blockers this guest is allowed to ignore right now: the ride
  // it is queuing/riding/heading for, the stall it is buying at, the restroom it
  // is using. Only a deadlock safety valve — the geometry keeps every sanctioned
  // approach (queue tail, hut doorway, serving front) OUTSIDE its own blockers.
  const blockOwnerOf = (g: SimGuest): string | null => {
    if (g.ride) return g.ride.cfg.name;
    if (g.goal?.ride) return g.goal.ride.cfg.name;
    if (g.stall) return g.stall.cfg.name;
    if (g.goal?.stall) return g.goal.stall.cfg.name;
    if (g.restroom) return g.restroom.owner;
    if (g.goal?.restroom) return g.goal.restroom.owner;
    return null;
  };

  /** nearest free spot to (x, z) — pushes a waypoint that landed inside a
   *  blocker out through its short edge so a guest can always ARRIVE */
  const freeSpot = (x: number, z: number, owner: string | null): [number, number] => {
    let px = x;
    let pz = z;
    for (let i = 0; i < 4; i += 1) {
      const b = s.blockers.blockerAt(px, pz, owner);
      if (!b) break;
      const [nx, nz] = s.blockers.bNormal(b, px, pz);
      const push = s.blockers.bDepth(b, px, pz) + 0.04;
      px += nx * push;
      pz += nz * push;
    }
    return [px, pz];
  };

  /**
   * One walking step toward (tx, tz) that never enters a blocker: the straight
   * step is tried first, then a SLIDE along the offending blocker's edge (the
   * tangent whichever way makes progress), then a straight push OUT of it. A
   * guest who somehow starts inside one is always pushed out first.
   */
  const moveToward = (g: SimGuest, tx: number, tz: number, speed: number, dt: number) => {
    const dx = tx - g.x;
    const dz = tz - g.z;
    const d = Math.hypot(dx, dz);
    if (d < 0.02) return true;
    const step = Math.min(speed * dt, d);
    const ux = dx / d;
    const uz = dz / d;
    if (!s.blockers.recs.length) {
      // NOTHING solid registered (every preview, and parks without blockers):
      // the classic path, byte-identical to the pre-blocker behaviour
      if (step >= d) {
        g.x = tx;
        g.z = tz;
        return true;
      }
      g.x += ux * step;
      g.z += uz * step;
      g.yaw = Math.atan2(dx, dz);
      return false;
    }
    const own = blockOwnerOf(g);
    // trapped inside something (a shifted rig, a fence dropped on a guest):
    // walk straight OUT before anything else
    const inside = s.blockers.blockerAt(g.x, g.z, own);
    if (inside) {
      const [nx, nz] = s.blockers.bNormal(inside, g.x, g.z);
      const out = Math.min(step, s.blockers.bDepth(inside, g.x, g.z) + 0.03);
      g.x += nx * out;
      g.z += nz * out;
      g.yaw = Math.atan2(nx, nz);
      return false;
    }
    let cx = g.x + ux * step;
    let cz = g.z + uz * step;
    const hit = s.blockers.blockerAt(cx, cz, own);
    if (hit) {
      const [nx, nz] = s.blockers.bNormal(hit, cx, cz);
      // slide along the blocker edge, whichever tangent makes progress
      const tans: [number, number][] = [
        [-nz, nx],
        [nz, -nx],
      ].sort((a, b) => b[0] * ux + b[1] * uz - (a[0] * ux + a[1] * uz)) as [number, number][];
      let ok = false;
      for (const [sx, sz] of tans) {
        if (sx * ux + sz * uz <= -0.2) continue; // never slide backwards
        const qx = g.x + sx * step;
        const qz = g.z + sz * step;
        if (s.blockers.blockerAt(qx, qz, own)) continue;
        cx = qx;
        cz = qz;
        ok = true;
        break;
      }
      if (!ok) {
        // no tangent works — back off along the outward normal (round a corner)
        const qx = g.x + nx * step * 0.6;
        const qz = g.z + nz * step * 0.6;
        if (s.blockers.blockerAt(qx, qz, own)) return false; // hemmed in: hold position
        cx = qx;
        cz = qz;
      }
    }
    const mx = cx - g.x;
    const mz = cz - g.z;
    g.x = cx;
    g.z = cz;
    if (Math.hypot(mx, mz) > 1e-5) g.yaw = Math.atan2(mx, mz); // face the ACTUAL travel (slides look right)
    return !hit && step >= d;
  };

  // per-guest walk-speed multiplier from needs: hungry / low-energy guests
  // trudge at 0.75×, fresh well-fed guests reach 1.15×, on a hashed per-guest
  // base variance of ±10%. The pose-layer cadence is derived from the ACTUAL
  // ground speed every frame, so limb cadence always matches — no skating.
  const walkMult = (g: SimGuest) => {
    const vit = Math.min(g.energy / 255, 0.3 + (Math.min(g.hunger, g.thirst) / 255) * 0.7);
    const needs = 0.75 + Math.max(0, Math.min(1, (vit - 0.25) / 0.55)) * 0.4; // 0.75..1.15
    return needs * (0.9 + hash01(g.idx * 61.3 + 7.7) * 0.2);
  };

  // walk speed from needs (Guest.cpp:6960 posture; energy drives pace)
  const speedOf = (g: SimGuest) => {
    let sp = (0.3 + (g.energy / 255) * 0.35) * walkMult(g);
    if (g.happiness < 96) sp *= 0.8; // sad guests trudge
    if (g.energy <= 64) sp *= 0.75; // headDown shuffle
    if (g.nausea > 140) sp *= 0.75; // staggering
    if (g.toilet > 220) sp *= 1.35; // hurried gait
    return sp;
  };

  const followWaypoints = (g: SimGuest, dt: number) => {
    const wp = g.waypoints[0];
    if (!wp) return true;
    g.moving = true;
    // a waypoint that landed INSIDE a blocker (a stall front behind a new
    // fence, a doorway under a shifted rig) is nudged out to the nearest free
    // spot ONCE, so the walk can always complete instead of stalling short
    if (s.blockers.recs.length) {
      const own = blockOwnerOf(g);
      if (s.blockers.blockerAt(wp.x, wp.z, own)) {
        const [fx, fz] = freeSpot(wp.x, wp.z, own);
        wp.x = fx;
        wp.z = fz;
      }
    }
    if (moveToward(g, wp.x, wp.z, speedOf(g), dt)) g.waypoints.shift();
    g.baseY += (wp.y - g.baseY) * Math.min(1, dt * 6);
    return g.waypoints.length === 0;
  };

  return { blockOwnerOf, freeSpot, moveToward, walkMult, speedOf, followWaypoints };
}

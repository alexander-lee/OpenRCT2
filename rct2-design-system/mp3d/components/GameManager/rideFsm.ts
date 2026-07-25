// ---------------------------------------------------------------------------
// RIDE STATE MACHINE (Vehicle.h:123 status cycle) — the per-ride admission /
// departure / travel / unload loop, the RCT2 exit-hut unload walk, the
// deterministic breakdown schedule and the shared queue-drain used by both
// crashes and breakdowns.
//
// The FSM never touches guest geometry directly: riders are teleported INSIDE
// the exit hut and walk out through its front doorway, exactly like RCT2's
// leaveVehicle → approachExit → inExit chain. Implementation detail of
// createGameManager.
// ---------------------------------------------------------------------------

import { hash01, clamp255, BREAK_DOWN_SECS, REPAIR_SECS } from './types';
import type { RideState, RideRec, HandSlot } from './types';
import { slotPos, breakIntervalOf } from './access';
import type { Sim } from './sim';

export function createRideFsm(s: Sim) {
  const { routing, walkY } = s;

  const occupancyOf = (r: RideRec) => ({ riders: r.riders.length, capacity: r.cfg.capacity, occupied: r.riders.length > 0 });

  const setState = (r: RideRec, st: RideState, timer: number) => {
    r.state = st;
    r.timer = timer;
    r.cfg.onStateChange?.(st, occupancyOf(r));
  };

  // RCT2 leaveVehicle -> approachExit -> inExit (Peep.h:81): riders teleport
  // INSIDE the exit hut (hidden — they're "in the exit") and file out through
  // its front doorway onto the apron, one at a time. Never across the ride.
  const unloadRiders = (r: RideRec, safe: boolean) => {
    r.riders.forEach((g, k) => {
      g.hidden = true; // inExit — revealed when their exitDelay runs out
      g.state = 'leavingRide';
      g.ride = null;
      g.x = r.exitPos.x;
      g.z = r.exitPos.z;
      g.baseY = r.exitDoor.y;
      g.yaw = r.exitYaw;
      g.exitDelay = k * 0.6;
      g.lastRide = r;
      g.lastRideT = s.simTime;
      if (safe) {
        // RCT2 ride satisfaction: happiness target boost, nausea from intensity
        g.happinessTarget = clamp255(g.happinessTarget + 40);
        g.nausea = clamp255(g.nausea + r.intensity * (6 + hash01(g.idx * 7.9 + g.ridden * 3.1) * 12));
        g.ridden += 1;
        s.riddenTotal += 1;
        r.total += 1; // per-ride lifetime total (handle.totalRides())
        s.fx.pushThought(g, 'wasGreat');
        g.timer = hash01(g.idx * 5.3 + g.ridden * 9.7) < 0.6 ? 0.8 : 0; // 'wow' hop
        g.hopArmed = g.timer > 0; // one pose-layer jump on the exit apron
        // a held balloon sometimes slips away in the post-ride excitement
        // (RCT2 blows held balloons away on a hashed per-tick chance,
        // Guest.cpp:6951-6963) — the release lands once they're on the apron
        (['left', 'right'] as HandSlot[]).forEach((h, hi) => {
          const b = g.balloons[h];
          if (b && hash01(g.idx * 3.9 + g.ridden * 11.7 + hi * 5.3) < 0.12) b.dropAt = Math.min(b.dropAt, s.simTime + 1.6 + k * 0.6);
        });
      } else {
        s.fx.pushThought(g, 'notSafe');
        g.happinessTarget = clamp255(g.happinessTarget - 30);
        g.timer = 0;
      }
      g.waypoints = [{ ...r.exitDoor }];
      if (r.exitAttach) {
        g.waypoints.push({ x: r.exitAttach.x, z: r.exitAttach.z, y: routing ? walkY(r.exitAttach.x, r.exitAttach.z) : 0 });
        g.netReentry = r.exitAttach.node;
      } else {
        g.waypoints.push({ ...r.exitOut });
      }
    });
    r.riders = [];
  };

  // shared queue-drain (crash AND breakdown): guests think it's unsafe and
  // walk away; anyone mid-doorway backs out; anyone aboard leaves via the exit
  const drainRide = (r: RideRec) => {
    // empty the queue — guests think it's unsafe and walk away
    [...r.queue].forEach((g) => {
      g.happinessTarget = clamp255(g.happinessTarget - 30);
      s.needs.leaveQueue(g, 'notSafe');
    });
    r.queue = [];
    // guests mid-doorway turn straight around — back OUT through the doorway
    // first, then down the lane centre (never diagonally through a wall)
    r.entering.forEach((g) => {
      g.happinessTarget = clamp255(g.happinessTarget - 30);
      s.fx.pushThought(g, 'notSafe');
      g.ride = null;
      g.state = 'walking';
      g.hidden = false; // may have been mid-dwell inside the hut
      if (r.queueAttach) {
        // past the doorway (inside the hut zone) -> out via the doorway first
        const along = (g.x - r.cfg.queueAnchor[0]) * r.dir[0] + (g.z - r.cfg.queueAnchor[2]) * r.dir[1];
        g.waypoints = along < 0
          ? [{ ...r.doorway }, { x: r.queueAttach.x, z: r.queueAttach.z, y: walkY(r.queueAttach.x, r.queueAttach.z) }]
          : [{ x: r.queueAttach.x, z: r.queueAttach.z, y: walkY(r.queueAttach.x, r.queueAttach.z) }];
        g.netReentry = r.queueAttach.node;
      } else {
        g.waypoints = [];
        s.nav.newFallbackTarget(g);
      }
    });
    r.entering = [];
    unloadRiders(r, false); // anyone aboard escapes via the exit
  };

  const crashRide = (r: RideRec) => {
    setState(r, 'crashed', 0);
    drainRide(r);
  };

  // deterministic breakdown: pause the FSM, drain everyone off through the
  // crash-ish path, park the vehicle (movingToEndOfStation resets callbacks —
  // e.g. a spin target) and hold until the repair completes
  const breakDown = (r: RideRec) => {
    r.brokenAt = s.simTime;
    drainRide(r);
    setState(r, 'movingToEndOfStation', 1.0);
  };

  const updateRide = (r: RideRec, dt: number) => {
    if (r.state !== 'crashed' && r.cfg.vehicleHandle?.crashed?.()) {
      crashRide(r);
      return;
    }
    // ---- breakdown schedule (additive; deterministic — see breakIntervalOf)
    if (r.state !== 'crashed') {
      if (r.brokenAt >= 0) {
        if (s.simTime - r.brokenAt >= BREAK_DOWN_SECS + REPAIR_SECS) {
          r.brokenAt = -1; // repaired — reopen and rearm the schedule
          r.breakN += 1;
          r.nextBreak = s.simTime + breakIntervalOf(r);
        } else {
          return; // FSM paused: no admissions while broken / being repaired
        }
      } else if (s.simTime >= r.nextBreak) {
        breakDown(r);
        return;
      }
    }
    if (r.state === 'movingToEndOfStation') {
      r.timer -= dt;
      if (r.timer <= 0) setState(r, 'waitingForPassengers', 0);
    } else if (r.state === 'waitingForPassengers') {
      r.timer += dt; // counts UP against minWait / maxWait
      const aboard = r.riders.length + r.entering.length;
      if (aboard < r.cfg.capacity) {
        const head = r.queue[0];
        if (head) {
          const s0 = slotPos(r, 0);
          if (Math.hypot(head.x - s0.x, head.z - s0.z) < 0.22) {
            r.queue.shift();
            head.state = 'enteringRide';
            head.ride = r;
            head.cash = Math.max(0, head.cash - r.price); // pay at the entrance
            // atEntrance -> inEntrance (Peep.h:81): the walk ENDS INSIDE the
            // hut. The ride seats them at boardPoint — they never walk to it.
            head.waypoints = [{ ...r.doorway }, { ...r.hutIn }];
            head.timer = -1; // 'inEntrance' dwell, armed on arrival
            r.entering.push(head);
          }
        }
      }
      // departure: honour minWait / maxWait (RCT2 waiting_time)
      if (r.entering.length === 0 && r.riders.length > 0) {
        const full = r.riders.length >= r.cfg.capacity;
        if ((full && r.timer >= r.minWait) || r.timer >= r.maxWait || (r.timer >= r.minWait && r.queue.length === 0)) {
          setState(r, 'waitingToDepart', 0.6);
        }
      }
    } else if (r.state === 'waitingToDepart') {
      r.timer -= dt;
      if (r.timer <= 0) setState(r, 'departing', r.cfg.loadTime ?? 1.0);
    } else if (r.state === 'departing') {
      r.timer -= dt;
      if (r.timer <= 0) setState(r, 'travelling', r.cfg.rideDuration);
    } else if (r.state === 'travelling') {
      r.timer -= dt;
      if (r.timer <= 0) setState(r, 'arriving', 1.0);
    } else if (r.state === 'arriving') {
      r.timer -= dt;
      if (r.timer <= 0) {
        const n = r.riders.length;
        unloadRiders(r, true);
        setState(r, 'unloadingPassengers', 0.8 + n * 0.6 + 0.8);
      }
    } else if (r.state === 'unloadingPassengers') {
      r.timer -= dt;
      if (r.timer <= 0) setState(r, 'movingToEndOfStation', 1.0);
    }
  };

  return { occupancyOf, setState, unloadRiders, drainRide, crashRide, breakDown, updateRide };
}

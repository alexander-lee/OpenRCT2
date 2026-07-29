// ---------------------------------------------------------------------------
// GUEST PER-FRAME PASS — the single `updateGuest` that runs every guest each
// frame: the needs cadence, the per-second hashed event rolls (sickness,
// stagger, queue fidget, dancing), the STATE DISPATCH (walking / queuing /
// entering / on ride / leaving ride / buying / bin / restroom / sitting), and
// then the whole VISUAL stack — the <Guest> pose layer plus every overlay
// composed on top of it (mood posture, lap-bar fold, held-item eat/drink
// cycles with their slew guard, the litter fling, the vomit hunch, the poop
// squat and the balloon counter-rotation).
//
// Overlay ORDER is load-bearing: pose → posture → lap bar → eat arm → final
// transform → event overlays sampled off this frame's matrices. Nothing here
// changed in the split. Implementation detail of createGameManager.
// ---------------------------------------------------------------------------

import type * as THREE from 'three';
import { cadenceForSpeed } from '../Guest';
import { hash01, clamp255, smoothK, SPACING, GUEST_SCALE, NEEDS_TICK, QUEUE_BALK_AT, SIT_DROP } from './types';
import type { SimGuest, HandSlot } from './types';
import { armOf } from './guestFx';
import { slotPos } from './access';
import { inDanceZone } from './registry';
import type { Sim } from './sim';

/** energy at or below which a guest will take a seat they happen to walk past */
const BENCH_TIRED = 130;
/** …and how long after getting off one before they will take another */
const BENCH_COOLDOWN = 25;

export function createGuestPass(s: Sim) {
  const { t, walkY, nodeXZ, guests, bins, benches, danceZones, routing } = s;
  const _hand = new t.Vector3();

  // ---- guest per-frame ------------------------------------------------------------
  const updateGuest = (g: SimGuest, time: number, dt: number) => {
    if (g.gone) {
      s.needs.releaseBench(g); // a despawned guest never keeps a seat occupied
      return;
    }
    // BENCH INVARIANT. A seat is held for exactly as long as its guest is in
    // the 'sitting' state; anything that yanks them out of it (a maxed toilet,
    // beginLeaving, a crash drain) frees the seat here rather than needing to
    // remember to. Without this a park slowly runs out of benches.
    if (g.bench && g.state !== 'sitting') s.needs.releaseBench(g);
    if (g.entryDelay > 0) {
      // staggered park-gate arrival — not in the world yet
      g.entryDelay -= dt;
      g.peep.group.visible = false;
      return;
    }
    // sick face reverts ~4 s after the vomit began
    if (g.sickUntil >= 0 && s.simTime >= g.sickUntil) {
      g.peep.setSick(false);
      g.sickUntil = -1;
    }
    // balloon DROP events: hashed lifetime expiry (or an earlier ride-exit /
    // hop slip) — released only while visible and not seated (a lap bar pins
    // the hands; the ride-exit slip chance covers on-ride losses)
    if (!g.hidden && g.state !== 'onRide') {
      if (g.balloons.left && s.simTime >= g.balloons.left.dropAt) s.fx.releaseBalloon(g, 'left');
      if (g.balloons.right && s.simTime >= g.balloons.right.dropAt) s.fx.releaseBalloon(g, 'right');
    }
    g.moving = false;
    const px = g.x; // pre-dispatch position — actual displacement drives the
    const pz = g.z; // pose-layer walk cadence (no foot skating)

    // Tick128 needs cadence
    g.acc128 += dt;
    while (g.acc128 >= NEEDS_TICK) {
      g.acc128 -= NEEDS_TICK;
      s.needs.tick128(g);
    }
    // per-second hashed chances
    const sec = Math.floor(s.simTime);
    // …and whether THIS frame is the one that crossed the boundary. Every roll
    // below is keyed on `sec`, so it is constant for a whole second — anything
    // that costs more than a hash to EVALUATE therefore only needs to run once
    // per second, not on all ~60 frames of it (see the bench claim below).
    const newSec = sec !== g.lastSec;
    if (newSec) {
      g.lastSec = sec;
      // abandon a very old queue: 3.3%/s when unhappy (Guest.cpp:7535 region)
      if ((g.state === 'queuing' || g.state === 'queuingFront') && g.timeInQueue >= QUEUE_BALK_AT && g.happiness <= 65) {
        if (hash01(g.idx * 53.1 + sec * 17.7) < 0.033) s.needs.leaveQueue(g, 'fedUp');
      }
      // throw up: nausea ≥ 200 — stop, hunch, face turns GREEN (setSick),
      // droplet burst + splat at the 1.1 s mark, face restored after ~4 s
      if (g.nausea >= 200 && !g.action && (g.state === 'walking' || g.state === 'leavingPark')) {
        if (hash01(g.idx * 37.7 + sec * 9.1) < 0.2) {
          g.action = { kind: 'vomit', until: s.simTime + 2.6 };
          g.vomitT = 0;
          g.peep.setSick(true);
          g.sickUntil = s.simTime + 4;
          s.fx.pushThought(g, 'sick');
        }
      }
      // nausea stagger: occasional 1 s stop
      if (g.nausea > 140 && !g.action && (g.state === 'walking' || g.state === 'leavingPark')) {
        if (hash01(g.idx * 29.3 + sec * 7.1) < 0.25) g.action = { kind: 'staggerStop', until: s.simTime + 1 };
      }
      // long-queue fidget: glance at a watch
      if ((g.state === 'queuing' || g.state === 'queuingFront') && g.timeInQueue > 10 && !g.action) {
        if (hash01(g.idx * 61.7 + sec * 11.3) < 0.08) g.action = { kind: 'checkTime', until: s.simTime + 0.5 };
      }
      // spontaneous dance when very happy near another walker.
      //
      // THE COIN IS ROLLED BEFORE THE SCAN, and that ordering is the whole
      // reason this line is affordable at 500 guests. `guests.some` is O(the
      // population) and `sec` is GLOBAL, so every guest crosses the same second
      // boundary on the same frame: the old order spent up to 500 x 500 =
      // 250 000 distance tests inside ONE frame, once per sim-second. Both
      // halves are pure predicates, so testing the 10 % hash first is the same
      // behaviour for a tenth of the work.
      if (g.state === 'walking' && g.happiness > 165 && !g.action && hash01(g.idx * 19.1 + sec * 5.9) < 0.1) {
        const near = guests.some((o) => o !== g && !o.gone && !o.hidden && o.state === 'walking' && Math.hypot(o.x - g.x, o.z - g.z) < 1.0);
        if (near) g.action = { kind: 'dance', until: s.simTime + 2.4 };
      }
      // ATTENTION-ZONE interlude: a wanderer whose path crosses a registered
      // zone (registerDanceZone / registerWatchZone) stops there for a hashed
      // dwell — 0.35/s coin, so a crossing usually latches within ~2-3 s.
      //   dance zone (<DanceFloor register>): action 'dance', 10-30 s, happy
      //     (≥160) + energetic (>128) guests only. The pose path below beat-
      //     locks to the floor tiles — both run 2.2 Hz off the same Stage clock.
      //   watch zone (scenery to LOOK at): state 'watching', 4-10 s, facing the
      //     zone's `faceAt` — the same three fields navigation.ts's "watch a
      //     nearby ride" sets, so no new pose/dispatch plumbing is needed.
      // THE COOLDOWN: `z.ready` bars this zone from re-latching the SAME guest
      // until `cooldown` s after their dwell ended. Without it the latch simply
      // re-fires on a guest still standing inside and the zone becomes a
      // permanent stop (registry.ts documents the measurement).
      // The 0.35 coin is deliberately the SAME hash expression for every zone —
      // a guest is normally inside at most one, and sharing it keeps the
      // single-dance-zone case bit-for-bit identical to the pre-cooldown code.
      if (g.state === 'walking' && !g.action && danceZones.length && hash01(g.idx * 31.3 + sec * 13.7) < 0.35) {
        for (const z of danceZones) {
          if (g.happiness < z.minHappiness || g.energy < z.minEnergy) continue;
          // THE COOLDOWN MUST BE ON THE SAME CLOCK AS THE DWELL IT PROTECTS.
          // A dance dwell is `action.until`, tested against `simTime`; a watch
          // dwell is `g.timer`, counted down by the CLAMPED frame dt. Storing
          // both bars on `simTime` meant that on a slow page (SwiftShader runs
          // this at ~1.3 fps) a watch cooldown expired ~12x early — measured on
          // the Pulse District zone probe — so the bar that stops a guest being
          // re-latched barely applied, which is the exact failure the cooldown
          // was added to fix.
          //
          // MEASURED, A/B on the same tree (`/tmp/mp3d-render/zoneclock-probe`,
          // identical clamped dt, absolute clock 13x faster): re-latches on the
          // slow clock were **8.38x** the fast-clock count before this line and
          // are **1.14x** after it.
          //
          // The residual 1.14x is NOT this bar — it is `sec` above, which is
          // `Math.floor(s.simTime)`, so a slow page gets more per-second coin
          // flips per unit of simulated walking and therefore more latch
          // OPPORTUNITIES. That coupling is shared by every per-second hashed
          // event here (vomit, stagger, queue fidget, spontaneous dance) and
          // moving it would change all of their behaviour and break the
          // bit-for-bit guarantee the needs retune preserved, so it is left
          // alone deliberately rather than overlooked.
          const zclock = z.mode === 'dance' ? s.simTime : s.walkClock;
          if (zclock < (z.ready.get(g.idx) ?? -Infinity)) continue; // cooling down
          if (!inDanceZone(z, g.x, g.z)) continue;
          const dwell = z.minLinger + hash01(g.idx * 5.7 + sec * 3.1) * (z.maxLinger - z.minLinger);
          if (z.mode === 'dance') {
            g.action = { kind: 'dance', until: s.simTime + dwell };
            g.happinessTarget = clamp255(g.happinessTarget + 6); // dancing is fun
          } else {
            g.state = 'watching'; // RCT2 PeepState::Watching — stand and look
            g.timer = dwell;
            if (z.faceAt) g.yaw = Math.atan2(z.faceAt[0] - g.x, z.faceAt[1] - g.z);
          }
          z.ready.set(g.idx, zclock + dwell + z.cooldown);
          break;
        }
      }
    }
    // squat completion: the poop mesh + embarrassment land as the guest stands
    if (g.action?.kind === 'squat' && s.simTime >= g.action.until) {
      s.fx.dropPoop(g.x + Math.cos(g.yaw) * 0.32, g.z - Math.sin(g.yaw) * 0.32, g.baseY + 0.005);
      g.toilet = 30;
      g.happiness = clamp255(g.happiness - 20);
      g.happinessTarget = clamp255(g.happinessTarget - 20);
      s.fx.pushThought(g, 'embarrassed');
    }
    if (g.action && s.simTime >= g.action.until) g.action = null;
    const paused =
      g.action != null &&
      (g.action.kind === 'staggerStop' || g.action.kind === 'dance' || g.action.kind === 'vomit' || g.action.kind === 'squat');

    // ---- state dispatch ------------------------------------------------------
    if (g.state === 'walking' || g.state === 'leavingPark') {
      if (!paused) {
        if (routing) s.nav.netStep(g, dt);
        else s.nav.fallbackStep(g, dt);
      }
      // bins: deposit the container when passing a non-full bin (Guest.cpp:5534)
      if (!g.gone && g.holding === 'container' && !g.fling && g.waypoints.length === 0 && g.state !== 'leavingPark') {
        for (const b of bins) {
          if (b.count < 3 && Math.hypot(b.x - g.x, b.z - g.z) < 0.6) {
            g.bin = b;
            g.resume = { from: g.fromNode, to: g.toNode, u: g.u };
            g.state = 'usingBin';
            g.timer = -1;
            g.waypoints = [{ x: b.x, z: b.z, y: g.baseY }];
            break;
          }
        }
      }
      // BENCHES: a worn-out guest who walks PAST a free seat sits on it.
      //
      // This is the litter-bin check's sibling and it lives here for the same
      // reason RCT2 puts it in `Guest::UpdateWalking` (entity/Guest.cpp:
      // 2790-2860) rather than in a junction decision: it tests the tile the
      // peep is STANDING ON. The rest impulse on arriving at a node (see
      // navigation.ts) cannot find a bench on most lattices, because verge
      // furniture is planted at interval CENTRES and deliberately kept 0.85
      // clear of the junction pads — measured on r16a, 0 of 7 rests over 300
      // sim-seconds landed on a seat with 194 of them in the park. Walking past
      // one is how a guest actually meets a bench.
      //
      // Reach 1.25: a seat sits `width/2 + 0.34` (≈ 0.89 on a 1.1 street) off
      // the centreline the guest walks, so anything tighter can never trigger.
      //
      // ONCE PER SECOND, not once per frame (`newSec`): the roll below is keyed
      // on `Math.floor(s.simTime)`, so it held the same value for a whole second
      // and a tired guest re-scanned EVERY registered seat on all ~60 frames of
      // it. A lined park-scale street publishes one bench every ~4.8 u down both
      // verges (hundreds of them), so at 500 guests that scan was the single
      // biggest O(guests x benches) term in the pass. Rolling it on the frame the
      // second turns over is strictly closer to the intent of a per-second coin.
      if (
        newSec &&
        !g.gone &&
        !g.hidden &&
        !paused &&
        !g.fling &&
        g.state === 'walking' &&
        !g.waypoints.length &&
        benches.length &&
        g.energy <= BENCH_TIRED &&
        s.simTime - g.benchT > BENCH_COOLDOWN &&
        hash01(g.idx * 17.3 + Math.floor(s.simTime)) < 0.35
      ) {
        const seat = s.needs.claimBench(g, 1.25);
        if (seat) {
          g.resume = { from: g.fromNode, to: g.toNode, u: g.u };
          g.state = 'sitting';
          g.timer = -1; // armed when the short walk onto the seat completes
          g.path = [];
          g.waypoints = [{ x: seat.x, z: seat.z, y: seat.y - SIT_DROP }];
        }
      }
      // container patience cap: ~30-45 hashed s after finishing the meal a
      // guest who never crossed a free bin (the 6 %/edge litter roll can miss
      // for minutes) just throws the rubbish at the next stride — RCT2 guests
      // litter whenever no bin is at hand (Guest.cpp:5534-6256 region).
      // Guests already WALKING OUT are quicker about it (~5-9 s): the classic
      // RCT2 exit-path litter carpet.
      if (
        !g.gone &&
        !g.hidden &&
        g.holding === 'container' &&
        !g.fling &&
        !paused &&
        s.simTime - g.containerSince > (g.state === 'leavingPark' ? 5 + hash01(g.idx * 3.91) * 4 : 30 + hash01(g.idx * 7.13) * 15)
      ) {
        s.fx.startThrow(g);
      }
    } else if (g.state === 'queuing' || g.state === 'queuingFront') {
      const r = g.ride!;
      // the PLATFORM this guest queued at (multi-station transport rides have
      // one lane per station; `stations[0]` is the ordinary single lane)
      const st = g.station ?? r.stations[0];
      const i = st.queue.indexOf(g);
      if (i < 0) {
        g.state = 'walking'; // safety: fell out of the queue array
      } else {
        const slot = slotPos(st, i);
        const jp = g.waypoints[0];
        if (jp && Math.hypot(g.x - slot.x, g.z - slot.z) > SPACING * 1.5) {
          g.moving = !s.loco.moveToward(g, jp.x, jp.z, s.loco.speedOf(g), dt);
          if (!g.moving) g.waypoints.shift();
        } else if (jp) {
          g.waypoints.shift(); // line grew to meet them
        }
        if (!g.waypoints.length) {
          // single-file: advance only when the slot ahead has freed
          let mayMove = true;
          if (i > 0) {
            const ahead = st.queue[i - 1];
            const aheadSlot = slotPos(st, i - 1);
            mayMove = Math.hypot(ahead.x - aheadSlot.x, ahead.z - aheadSlot.z) < 0.16;
          }
          const dSlot = Math.hypot(g.x - slot.x, g.z - slot.z);
          if (dSlot >= 0.03 && mayMove) g.moving = !s.loco.moveToward(g, slot.x, slot.z, s.loco.speedOf(g), dt);
          if (dSlot < 0.03) g.yaw += (Math.atan2(-st.dir[0], -st.dir[1]) - g.yaw) * Math.min(1, dt * 6);
          // the lane RAMPS from the ride down to the street (access.ts), so the
          // slot's own height is the one to settle on — `st.laneY` alone put
          // every guest in the queue at the HEAD's level and floated the ones
          // near the tail
          if (dSlot < 0.6) g.baseY += (slot.y - g.baseY) * Math.min(1, dt * 8);
          g.state = i === 0 && dSlot < 0.1 ? 'queuingFront' : 'queuing';
        }
        g.timeInQueue += dt;
      }
    } else if (g.state === 'enteringRide') {
      if (g.waypoints.length) {
        s.loco.followWaypoints(g, dt);
      } else if (g.timer < 0) {
        g.hidden = true; // 'inEntrance' — swallowed by the hut
        g.timer = 0.35;
      } else {
        g.timer -= dt;
        if (g.timer <= 0) {
          // the ride seats them: re-appear ON the vehicle (never walking there)
          const r = g.ride!;
          g.state = 'onRide';
          const est = g.station ?? r.stations[0];
          const k = est.entering.indexOf(g);
          if (k >= 0) est.entering.splice(k, 1);
          r.riders.push(g);
        }
      }
    } else if (g.state === 'onRide') {
      // SEATED aboard — visible occupancy. Each rider takes the seat matching
      // its riders[] index: cfg.seatWorld (a live vehicle seat, e.g. on a
      // spinning rotor) or the default compact ring around boardPoint.
      const r = g.ride!;
      const k = r.riders.indexOf(g);
      g.hidden = false;
      const seat = r.cfg.seatWorld?.(k);
      if (seat) {
        g.x = seat[0];
        g.baseY = seat[1];
        g.z = seat[2];
        g.yaw = seat[3];
      } else {
        // the vehicle is AT a platform (RCT2 `Vehicle::current_station`), so
        // seated riders ride at THAT platform's boardPoint
        const bp = r.stations[r.atStation]?.boardPoint ?? r.cfg.boardPoint;
        const a = (k / Math.max(1, r.cfg.capacity)) * Math.PI * 2;
        g.x = bp[0] + Math.sin(a) * 0.3;
        g.z = bp[2] + Math.cos(a) * 0.3;
        g.baseY = bp[1] - 0.12; // sunk: lower legs sit inside the vehicle body
        g.yaw = a; // ring faces outward
      }
    } else if (g.state === 'leavingRide') {
      if (g.exitDelay > 0) {
        g.exitDelay -= dt; // still hidden inside the exit hut ('inExit')
      } else {
        g.hidden = false; // re-appear walking OUT through the exit doorway
        if (g.waypoints.length > 1) {
          s.loco.followWaypoints(g, dt); // hut interior -> front doorway apron
        } else if (g.timer > 0) {
          g.timer -= dt; // 'wow' hop ON the apron (pose pass), then walk on
        } else if (s.loco.followWaypoints(g, dt)) {
          if (g.netReentry != null) {
            g.fromNode = g.netReentry;
            g.netReentry = null;
            g.toNode = -1;
            g.u = 0;
          } else {
            s.nav.newFallbackTarget(g);
          }
          g.state = 'walking';
        }
      }
    } else if (g.state === 'buying') {
      if (s.loco.followWaypoints(g, dt)) {
        if (g.timer < 0) g.timer = 1.2; // transaction at the counter
        g.timer -= dt;
        g.yaw += (Math.atan2(g.stall!.cfg.anchor[0] - g.x, g.stall!.cfg.anchor[2] - g.z) - g.yaw) * Math.min(1, dt * 6);
        if (g.timer <= 0) {
          s.needs.doPurchase(g, g.stall!);
          const at = g.stall!.attach;
          g.stall = null;
          g.state = 'walking';
          if (at) {
            g.waypoints = [{ x: at.x, z: at.z, y: walkY(at.x, at.z) }];
            g.netReentry = at.node;
          } else {
            s.nav.newFallbackTarget(g);
          }
        }
      }
    } else if (g.state === 'usingBin') {
      if (s.loco.followWaypoints(g, dt)) {
        if (g.timer < 0) g.timer = 0.8;
        g.timer -= dt;
        if (g.timer <= 0) {
          if (g.bin && g.bin.count < 3) {
            g.bin.count += 1;
            g.holding = null;
          }
          g.bin = null;
          const res = g.resume!;
          g.resume = null;
          if (routing && res) {
            const [ax, az] = nodeXZ(res.from);
            if (res.to >= 0) {
              const [bx, bz] = nodeXZ(res.to);
              g.waypoints = [{ x: ax + (bx - ax) * res.u, z: az + (bz - az) * res.u, y: walkY(ax + (bx - ax) * res.u, az + (bz - az) * res.u) }];
            } else {
              g.waypoints = [{ x: ax, z: az, y: walkY(ax, az) }];
            }
            g.fromNode = res.from;
            g.toNode = res.to;
            g.u = res.u;
          }
          g.state = 'walking';
        }
      }
    } else if (g.state === 'usingRestroom') {
      // walk through the doorway, vanish inside for 2 s ("relieving"), then
      // re-appear and rejoin the network at the doorway's attach spur
      if (s.loco.followWaypoints(g, dt)) {
        if (g.timer < 0) {
          g.hidden = true;
          g.timer = 2;
        } else {
          g.timer -= dt;
          if (g.timer <= 0) {
            const rr = g.restroom!;
            rr.uses += 1;
            g.restroom = null;
            g.hidden = false;
            g.toilet = 40;
            g.happinessTarget = clamp255(g.happinessTarget + 10); // relief
            g.state = 'walking';
            if (rr.attach) {
              g.waypoints = [
                { x: rr.attach.x, z: rr.attach.z, y: routing ? walkY(rr.attach.x, rr.attach.z) : s.groundAt(rr.attach.x, rr.attach.z) },
              ];
              g.netReentry = rr.attach.node;
            } else {
              s.nav.newFallbackTarget(g);
            }
          }
        }
      }
    } else if (g.state === 'sitting' && g.bench) {
      // ON A BENCH (RCT2 PeepState::Sitting, Guest.cpp:2900-2990): walk the last
      // couple of metres onto the seat, sit out a longer dwell than a standing
      // pause, RECOVER energy while sat, and then step back onto the edge the
      // detour left from (the litter-bin `resume` bookkeeping).
      if (s.loco.followWaypoints(g, dt)) {
        const b = g.bench;
        if (g.timer < 0) g.timer = 7 + s.fx.draw(g, 18) * 7; // a real sit-down, not a pause
        g.timer -= dt;
        // settle exactly on the seat, facing the way the bench faces
        g.x += (b.x - g.x) * Math.min(1, dt * 8);
        g.z += (b.z - g.z) * Math.min(1, dt * 8);
        g.baseY += (b.y - SIT_DROP - g.baseY) * Math.min(1, dt * 6);
        let dyaw = b.yaw - g.yaw;
        while (dyaw > Math.PI) dyaw -= 2 * Math.PI;
        while (dyaw < -Math.PI) dyaw += 2 * Math.PI;
        g.yaw += dyaw * Math.min(1, dt * 5);
        // resting is what a bench is FOR: energy climbs back while sat
        // (UpdateSitting's energy recovery), and getting off one is a small
        // mood lift
        g.energyTarget = clamp255(g.energyTarget + 9 * dt);
        if (g.timer <= 0) {
          b.uses += 1;
          s.needs.releaseBench(g);
          g.benchT = s.simTime; // the cooldown before they take another seat
          g.happinessTarget = clamp255(g.happinessTarget + 4); // rested
          const res = g.resume;
          g.resume = null;
          if (routing && res) {
            const [ax, az] = nodeXZ(res.from);
            if (res.to >= 0) {
              const [bx, bz] = nodeXZ(res.to);
              g.waypoints = [
                { x: ax + (bx - ax) * res.u, z: az + (bz - az) * res.u, y: walkY(ax + (bx - ax) * res.u, az + (bz - az) * res.u) },
              ];
            } else {
              g.waypoints = [{ x: ax, z: az, y: walkY(ax, az) }];
            }
            g.fromNode = res.from;
            g.toNode = res.to;
            g.u = res.u;
          }
          g.state = 'walking';
        }
      }
    } else if (g.state === 'sitting' || g.state === 'watching') {
      g.timer -= dt;
      if (g.timer <= 0) g.state = 'walking';
    }

    // ---- THE CLICK PROXY ------------------------------------------------------
    // It tracks the guest from OUTSIDE the rig (see spawn.ts for why it is a
    // sibling rather than a child), so a guest stays pickable at any level of
    // detail. One position assignment per guest per frame.
    //
    // IT IS NEVER `visible` — it is a raycast target, and `Stage`'s `isDrawn`
    // lets an invisible object through precisely when it is flagged `clickProxy`.
    // (Setting `visible` here instead cost 503 draw calls and 507 meshes on
    // parkA-99: five hundred fat cylinders, measured.) What DOES have to follow
    // the guest is whether the proxy is PICKABLE at all: as a sibling it no
    // longer inherits the rig's visibility, so a guest hidden inside a
    // hut/stall/restroom would otherwise still swallow clicks aimed at the
    // pavement. `layers.disableAll()` takes it out of `Raycaster`'s `layers.test`
    // (mask 0 never matches) without touching the scene graph.
    const pg = g.peep.group;
    g.proxy.position.set(g.x, g.baseY + 0.95 * GUEST_SCALE, g.z);
    if (g.hidden || g.gone) {
      g.proxy.layers.disableAll();
      pg.visible = false;
      s.crowd.clear(g);
      g.eatArm = null; // fresh arm baseline when the guest re-appears
      g.fling = null; // any half-played throw is abandoned out of sight
      return;
    }
    g.proxy.layers.enable(0);
    const vWorld = dt > 1e-6 ? Math.hypot(g.x - px, g.z - pz) / dt : 0;
    // LEVEL OF DETAIL, decided once: is this guest close enough to any live
    // camera to be worth an articulated rig? Always true when no cameras were
    // wired (every component preview — see GameManagerOpts.cameras).
    const near = s.crowd.isNear(g);

    // ---- TIMED EVENTS WITH SIM CONSEQUENCES ----------------------------------
    // These three run for EVERY guest, near or far, and they run HERE — above
    // the visual LOD gate — because each one changes state the sim reads: the
    // fling drops litter, the vomit relieves nausea and marks the ground, the
    // post-ride hop rolls a held balloon loose. If they sat below the gate the
    // park would evolve differently depending on where the camera was pointing,
    // which is exactly the determinism this sim guarantees (crowd.ts).
    //
    // Their VISUAL halves (the pose jump, the arm swing) are applied below, off
    // the values computed here.
    let hopNow = false;
    if (g.hopArmed && g.state === 'leavingRide' && g.exitDelay <= 0 && g.waypoints.length <= 1) {
      hopNow = true; // 'wow' hop on the exit apron
      g.hopArmed = false;
      // the hop can shake a held balloon loose (small hashed chance)
      (['left', 'right'] as HandSlot[]).forEach((h, hi) => {
        const b = g.balloons[h];
        if (b && hash01(g.idx * 8.3 + g.ridden * 5.1 + hi * 3.7) < 0.15) b.dropAt = Math.min(b.dropAt, s.simTime + 0.45);
      });
    }
    // throw trash: 0.65 s eat-arm fling — wind-up back, sweep forward (release
    // at 0.28 s), recover. Pure additive offset, 0 at both ends, peak ~7.8
    // rad/s — under the pose layer's 8.5 rad/s limb continuity limit.
    let flingOff = 0;
    if (g.fling) {
      const fl = g.fling;
      fl.t += dt;
      const T = fl.t;
      if (T < 0.15) flingOff = 0.4 * smoothK(T / 0.15);
      else if (T < 0.4) flingOff = 0.4 - 1.3 * smoothK((T - 0.15) / 0.25);
      else flingOff = -0.9 * (1 - smoothK((T - 0.4) / 0.25));
      if (!fl.released && T >= 0.28) {
        fl.released = true;
        s.fx.releaseThrow(g); // scraps leave the hand and arc to the ground spot
      }
      if (T >= 0.65) g.fling = null;
    }
    // vomit: droplet burst + ground splat at the deepest point of the hunch
    if (g.action?.kind === 'vomit') {
      const was = g.vomitT;
      g.vomitT += dt;
      if (was < 1.1 && g.vomitT >= 1.1) {
        // MOUTH ORIGIN. A guest running the full rig has a live head matrix to
        // sample; a far guest's rig is not in the scene at all, so the mouth is
        // reconstructed from the sim's own position + facing (head at peep-local
        // y 0.99, mouth 0.13 forward of it, both times GUEST_SCALE).
        if (near) {
          g.peep.head.updateWorldMatrix(true, false);
          _hand.set(0, -0.02, 0.13).applyMatrix4(g.peep.head.matrixWorld); // mouth
        } else {
          _hand.set(
            g.x + Math.sin(g.yaw) * 0.13 * GUEST_SCALE,
            g.baseY + 0.97 * GUEST_SCALE,
            g.z + Math.cos(g.yaw) * 0.13 * GUEST_SCALE,
          );
        }
        s.fx.vomitFx.setOrigin(_hand.x, _hand.y, _hand.z);
        s.fx.vomitFx.burst(12);
        s.fx.dropVomit(g.x + Math.sin(g.yaw) * 0.32, g.z + Math.cos(g.yaw) * 0.32, g.baseY + 0.004);
        g.nausea = Math.max(0, g.nausea - 130);
        g.happiness = clamp255(g.happiness - 12); // RCT2-ish sick penalty
        g.happinessTarget = clamp255(g.happinessTarget - 12);
      }
    }

    // ---- THE VISUAL LOD GATE (crowd.ts) --------------------------------------
    // Everything past this point is APPEARANCE ONLY. A guest outside the detail
    // radius of every camera is drawn by eight shared InstancedMesh pools
    // instead of its own 13-mesh rig, and its rig leaves the scene graph
    // entirely — three.js then neither draws it nor walks it. Measured: the crowd
    // at 500 guests costs 8 draw calls instead of ~4270.
    if (!near) {
      pg.visible = false;
      if (pg.parent) pg.removeFromParent();
      // proxy cadence for the stride table, from the displacement this frame —
      // the same input the full rig's pose layer solves its cadence from
      g.farCadence = vWorld * s.crowd.CADENCE_PER_SPEED;
      s.crowd.place(g, g.moving && !paused, dt);
      return;
    }
    if (!pg.parent) s.group.add(pg); // back inside the detail radius
    s.crowd.clear(g);
    pg.visible = true;

    // ---- pose: everything goes through the Guest pose layer -------------------
    // (mood is POSTURE, not an orb — Paint.Guest.cpp:60). Queue slots and all
    // stationary states are 'idle' (breathing + weight shift — NO leg swing),
    // locomotion is 'walk' with a cadence solved from the guest's ACTUAL
    // displacement this frame (limbs match ground speed — no foot skating,
    // and the hunger/energy walkMult automatically slows the cadence too),
    // dancing wanderers run the pose 'dance' sequencer, and the post-ride
    // 'wow' is a real pose-layer JUMP (crouch → arc → landing recovery).
    const pose = g.peep.pose;
    pose.seed = g.phase;

    if (hopNow) pose.setState('jump');
    if (g.action?.kind === 'dance') {
      pose.setDanceStyle(Math.floor(hash01(g.idx * 23.9 + 4.1) * 4));
      pose.setState('dance', 2.2);
    } else if (g.moving && !paused) {
      pose.setState('walk', cadenceForSpeed(vWorld, GUEST_SCALE));
    } else {
      // queuing, sitting, watching, buying, transacting, seated on a ride,
      // paused mid-stagger — settled idle, never a treadmill walk cycle
      pose.setState('idle');
    }
    pose.update(time, dt);

    // ---- posture overlays composed ON TOP of the pose layer -------------------
    if (g.moving && !paused) {
      if (g.happiness > 180) pg.position.y *= 1.7; // springy bounce
      if (g.energy <= 64 || g.happiness < 96) pg.position.y *= 0.5; // headDown shuffle, flat bob
    }
    if (g.state === 'queuing' || g.state === 'queuingFront') {
      const unhappy = Math.max(0, 128 - g.happiness) / 128;
      pg.rotation.z += Math.sin(time * (1.2 + unhappy * 3.5) + g.phase) * (0.012 + unhappy * 0.05); // queue fidget
    }
    if (g.nausea > 140 && g.state !== 'onRide') pg.rotation.z += Math.sin(time * 2.6 + g.phase) * 0.1; // stagger sway
    // seated lap-bar fold rides an eased envelope: arms blend from the pose's
    // clean angles onto the bar when seated and back off it on the exit apron
    g.lapW = Math.max(0, Math.min(1, g.lapW + (g.state === 'onRide' ? 1 : -1) * dt * 3));
    if (g.state === 'onRide') {
      // the vehicle carries the guest — flatten the idle bob and lean
      pg.position.y = 0;
      pg.rotation.z = 0;
    }
    if (g.lapW > 0) {
      const limbs = g.peep as unknown as { armL?: THREE.Group; armR?: THREE.Group };
      if (limbs.armL) limbs.armL.rotation.x += (-1.1 - limbs.armL.rotation.x) * g.lapW;
      if (limbs.armR) limbs.armR.rotation.x += (-1.1 - limbs.armR.rotation.x) * g.lapW;
    }
    // BENCH SIT: the same eased fold, on the LEGS. `buildPeep({ seated: true })`
    // is the static build pose the Guest preview uses; a sim guest is built
    // standing and has to get there and back, so the angles ride an envelope
    // that only closes once the walk to the seat has finished.
    g.sitW = Math.max(0, Math.min(1, g.sitW + (g.state === 'sitting' && g.bench && g.waypoints.length === 0 ? 1 : -1) * dt * 3));
    if (g.sitW > 0) {
      const limbs = g.peep as unknown as { armL?: THREE.Group; armR?: THREE.Group; legL?: THREE.Group; legR?: THREE.Group };
      if (limbs.legL) limbs.legL.rotation.x += (-1.5 - limbs.legL.rotation.x) * g.sitW;
      if (limbs.legR) limbs.legR.rotation.x += (-1.5 - limbs.legR.rotation.x) * g.sitW;
      if (limbs.armL) limbs.armL.rotation.x += (-1.1 - limbs.armL.rotation.x) * g.sitW;
      if (limbs.armR) limbs.armR.rotation.x += (-1.1 - limbs.armR.rotation.x) * g.sitW;
      pg.position.y *= 1 - g.sitW * 0.85; // the idle bob damps out once seated
    }

    // head + shoulders carry the mood (Guest.cpp:6960)
    let tilt = 0;
    let slump = 0;
    if (g.happiness < 96) {
      tilt = 0.35;
      slump = 0.06;
    }
    if (g.energy <= 64) {
      tilt = Math.max(tilt, 0.45);
      slump = Math.max(slump, 0.08);
    }
    if (g.action?.kind === 'checkTime' || g.action?.kind === 'staggerStop') tilt = Math.max(tilt, 0.55);
    if (g.action?.kind === 'vomit') {
      // hunch: eased torso pitch + head-down, riding the slew-chased channels
      const k = smoothK(Math.min(g.vomitT / 0.4, 1)) * smoothK(Math.min((2.6 - g.vomitT) / 0.5, 1));
      tilt = Math.max(tilt, 0.65 * k);
      slump = Math.max(slump, 0.42 * k);
    }
    if (s.simTime < g.glanceUpUntil) tilt = -0.55; // sad glance UP at the flown balloon
    g.headTilt += (tilt - g.headTilt) * Math.min(1, dt * 5);
    g.slump += (slump - g.slump) * Math.min(1, dt * 5);
    g.peep.head.rotation.x = g.headTilt + pose.headNod; // keep the pose's nod
    pg.rotation.x = g.slump;

    // ---- held item + eat/drink cycles (meshes live on the eat-hand's arm
    // pivot — built once at purchase; here they are only shown/hidden/posed) --
    // a PER-STALL themed item (StallConfig.heldItem) stands in for the generic
    // food/drink mesh while the meal lasts, then leaves the hand at the
    // CONTAINER stage — from there the generic crumpled container drives the
    // untouched bin / litter lifecycle.
    const themed = g.heldCustom != null;
    if (themed) {
      if (g.holding === 'food' || g.holding === 'drink') g.heldCustom!.visible = true;
      else s.fx.detachStallItem(g);
    }
    if (g.held) {
      const r = g.eatHand === 'right' ? g.holding : null;
      g.held.food.visible = !themed && r === 'food';
      g.held.drink.visible = !themed && r === 'drink';
      g.held.container.visible = r === 'container';
    }
    if (g.heldL) {
      const l = g.eatHand === 'left' ? g.holding : null;
      g.heldL.food.visible = !themed && l === 'food';
      g.heldL.drink.visible = !themed && l === 'drink';
      g.heldL.container.visible = l === 'container';
    }
    // the overlay rides an eased envelope (g.eatK chases the raw cycle at a
    // limited rate, so starting / finishing a snack mid-cycle never snaps the
    // arm) AND the final eat-arm value is slew-limited — a hard continuity
    // guarantee composed ON TOP of the pose layer.
    const eatArmPivot = armOf(g, g.eatHand);
    const eating = (g.holding === 'food' || g.holding === 'drink') && g.state !== 'onRide';
    // ANY held consumable (incl. the leftover container) keeps the eat arm
    // bent forward (≤ -0.45 rad): the fist-fronted item is body-clear there,
    // and it can never back-swing through the hip/skirt on the walk cycle
    const carrying = g.holding !== null && g.state !== 'onRide';
    let kRaw = 0; // 0 = arm rests at the carry bend, 1 = raised to the mouth
    let lift = -1.85; // bite: item stops in front of the face (head nods to it)
    if (g.holding === 'drink') lift = -2.0; // extra tip to drink, head tips back
    if (eating) {
      // bites are OCCASIONAL, not a continuous chew: each scheduled bite
      // (tick128 sets lastBiteAt every biteGap ≈ 10-15 s) plays ONE arm
      // raise, then the arm rests at the carry bend until the next one
      const since = s.simTime - g.lastBiteAt;
      if (g.holding === 'food') {
        if (since >= 0 && since < 0.9) kRaw = Math.sin((since / 0.9) * Math.PI); // one bite: up, mouth, down
        g.peep.head.rotation.x += g.eatK * 0.2; // tiny nod into each bite
      } else {
        if (since >= 0 && since < 1.6) kRaw = Math.min(1, Math.min(since, 1.6 - since) / 0.4); // one long swig
        g.peep.head.rotation.x -= g.eatK * 0.12; // head tips back
      }
    }
    g.eatK += Math.max(-3 * dt, Math.min(3 * dt, (eating ? kRaw : 0) - g.eatK));
    {
      // final eat-arm slew guard: the pose value, the lap-bar fold and the
      // eat/drink lift all funnel through here, so the visible eat arm can
      // never move faster than the pose layer's own limb limit (8.5 rad/s)
      const a = eatArmPivot.rotation.x; // pose (+ lap-bar) value this frame
      let desired = a + (lift - a) * g.eatK;
      if (carrying) desired = Math.min(desired, -0.45); // the carry bend
      const prev = g.eatArm ?? desired;
      const next = prev + Math.max(-8.5 * dt, Math.min(8.5 * dt, desired - prev));
      eatArmPivot.rotation.x = next;
      // inward shoulder tilt rides the same eased envelope so the lifted item
      // crosses toward the mouth — the straight arm alone would keep it a
      // shoulder-width outboard of the face (eatK is rate-limited to 3/s, so
      // this adds ≤ 1.2 rad/s — well under the pose layer's continuity limit)
      eatArmPivot.rotation.z += (g.eatHand === 'left' ? 0.4 : -0.4) * g.eatK;
      g.eatArm = next;
    }

    pg.position.set(g.x, g.baseY + pg.position.y, g.z);
    pg.rotation.y = g.yaw + pose.spinYaw; // dance spins offset the facing

    // ---- event overlays (AFTER the final transform, so hand/mouth world
    // positions sample this frame's matrices) --------------------------------
    // the litter fling's ARM SWING — its timeline and the release itself were
    // resolved above the LOD gate (they change sim state); this is the visible
    // half, a pure additive offset that is 0 at both ends and peaks at ~7.8
    // rad/s, under the pose layer's 8.5 rad/s limb continuity limit.
    if (flingOff !== 0) eatArmPivot.rotation.x += flingOff;
    // poop squat: 0.8 s crouch — legs fold, body drops, skirt flares to cover
    if (g.action?.kind === 'squat') {
      g.squatT += dt;
      const k = smoothK(Math.min(g.squatT / 0.3, 1)) * smoothK(Math.min((0.8 - g.squatT) / 0.2, 1));
      g.peep.legL.rotation.x += 1.15 * k;
      g.peep.legR.rotation.x += 1.15 * k;
      pg.position.y -= 0.13 * k * GUEST_SCALE;
      pg.rotation.x += 0.3 * k;
      if (g.peep.skirt) {
        g.peep.skirt.scale.x *= 1 + 0.3 * k;
        g.peep.skirt.scale.z *= 1 + 0.3 * k;
        g.peep.skirt.scale.y *= 1 - 0.2 * k;
      }
    }
    // held balloons: counter-rotate each rig so the string points world-up
    // above the RELAXED hand (no raised arm — the balloon floats, the guest
    // doesn't lift it), with a gentle hashed sway. Sampled LAST so the rig
    // rides the truly final arm pose (pose + lap bar + eat/fling overlays).
    (['left', 'right'] as HandSlot[]).forEach((h) => {
      const b = g.balloons[h];
      if (!b) return;
      const arm = armOf(g, h);
      b.pivot.rotation.x = -arm.rotation.x - g.slump + Math.sin(time * 0.9 + g.phase) * 0.07;
      b.pivot.rotation.z = -arm.rotation.z + Math.cos(time * 0.7 + g.phase * 1.7) * 0.07;
    });
  };

  return { updateGuest };
}

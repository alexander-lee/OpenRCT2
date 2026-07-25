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
import { hash01, clamp255, smoothK, SPACING, GUEST_SCALE, NEEDS_TICK, QUEUE_BALK_AT } from './types';
import type { SimGuest, HandSlot } from './types';
import { armOf } from './guestFx';
import { slotPos } from './access';
import { inDanceZone } from './registry';
import type { Sim } from './sim';

export function createGuestPass(s: Sim) {
  const { t, walkY, nodeXZ, guests, bins, danceZones, routing } = s;
  const _hand = new t.Vector3();

  // ---- guest per-frame ------------------------------------------------------------
  const updateGuest = (g: SimGuest, time: number, dt: number) => {
    if (g.gone) return;
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
    if (sec !== g.lastSec) {
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
      // spontaneous dance when very happy near another walker
      if (g.state === 'walking' && g.happiness > 165 && !g.action) {
        const near = guests.some((o) => o !== g && !o.gone && !o.hidden && o.state === 'walking' && Math.hypot(o.x - g.x, o.z - g.z) < 1.0);
        if (near && hash01(g.idx * 19.1 + sec * 5.9) < 0.1) g.action = { kind: 'dance', until: s.simTime + 2.4 };
      }
      // dance-floor interlude: a wanderer whose path crosses a registered
      // dance zone (<DanceFloor register>) stops and dances for a hashed
      // 10-30 s — happy (≥160) + energetic (>128) guests only, hashed
      // per-second chance so a crossing usually latches within ~2-3 s. The
      // pose path below (action.kind 'dance') already beat-locks to the
      // floor tiles: both run 2.2 Hz off the same Stage clock.
      if (g.state === 'walking' && !g.action && g.happiness >= 160 && g.energy > 128 && danceZones.length) {
        if (danceZones.some((z) => inDanceZone(z, g.x, g.z)) && hash01(g.idx * 31.3 + sec * 13.7) < 0.35) {
          g.action = { kind: 'dance', until: s.simTime + 10 + hash01(g.idx * 5.7 + sec * 3.1) * 20 };
          g.happinessTarget = clamp255(g.happinessTarget + 6); // dancing is fun
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
      const i = r.queue.indexOf(g);
      if (i < 0) {
        g.state = 'walking'; // safety: fell out of the queue array
      } else {
        const slot = slotPos(r, i);
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
            const ahead = r.queue[i - 1];
            const aheadSlot = slotPos(r, i - 1);
            mayMove = Math.hypot(ahead.x - aheadSlot.x, ahead.z - aheadSlot.z) < 0.16;
          }
          const dSlot = Math.hypot(g.x - slot.x, g.z - slot.z);
          if (dSlot >= 0.03 && mayMove) g.moving = !s.loco.moveToward(g, slot.x, slot.z, s.loco.speedOf(g), dt);
          if (dSlot < 0.03) g.yaw += (Math.atan2(-r.dir[0], -r.dir[1]) - g.yaw) * Math.min(1, dt * 6);
          if (dSlot < 0.6) g.baseY += (r.laneY - g.baseY) * Math.min(1, dt * 8);
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
          const k = r.entering.indexOf(g);
          if (k >= 0) r.entering.splice(k, 1);
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
        const a = (k / Math.max(1, r.cfg.capacity)) * Math.PI * 2;
        g.x = r.cfg.boardPoint[0] + Math.sin(a) * 0.3;
        g.z = r.cfg.boardPoint[2] + Math.cos(a) * 0.3;
        g.baseY = r.cfg.boardPoint[1] - 0.12; // sunk: lower legs sit inside the vehicle body
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
    } else if (g.state === 'sitting' || g.state === 'watching') {
      g.timer -= dt;
      if (g.timer <= 0) g.state = 'walking';
    }

    // ---- pose: everything goes through the Guest pose layer -------------------
    // (mood is POSTURE, not an orb — Paint.Guest.cpp:60). Queue slots and all
    // stationary states are 'idle' (breathing + weight shift — NO leg swing),
    // locomotion is 'walk' with a cadence solved from the guest's ACTUAL
    // displacement this frame (limbs match ground speed — no foot skating,
    // and the hunger/energy walkMult automatically slows the cadence too),
    // dancing wanderers run the pose 'dance' sequencer, and the post-ride
    // 'wow' is a real pose-layer JUMP (crouch → arc → landing recovery).
    const pg = g.peep.group;
    pg.visible = !g.hidden && !g.gone;
    if (g.hidden || g.gone) {
      g.eatArm = null; // fresh arm baseline when the guest re-appears
      g.fling = null; // any half-played throw is abandoned out of sight
      return;
    }
    const pose = g.peep.pose;
    pose.seed = g.phase;
    const vWorld = dt > 1e-6 ? Math.hypot(g.x - px, g.z - pz) / dt : 0;

    if (g.hopArmed && g.state === 'leavingRide' && g.exitDelay <= 0 && g.waypoints.length <= 1) {
      pose.setState('jump'); // 'wow' hop on the exit apron
      g.hopArmed = false;
      // the hop can shake a held balloon loose (small hashed chance)
      (['left', 'right'] as HandSlot[]).forEach((h, hi) => {
        const b = g.balloons[h];
        if (b && hash01(g.idx * 8.3 + g.ridden * 5.1 + hi * 3.7) < 0.15) b.dropAt = Math.min(b.dropAt, s.simTime + 0.45);
      });
    }
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
    if (g.held) {
      const r = g.eatHand === 'right' ? g.holding : null;
      g.held.food.visible = r === 'food';
      g.held.drink.visible = r === 'drink';
      g.held.container.visible = r === 'container';
    }
    if (g.heldL) {
      const l = g.eatHand === 'left' ? g.holding : null;
      g.heldL.food.visible = l === 'food';
      g.heldL.drink.visible = l === 'drink';
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
    // throw trash: 0.65 s eat-arm fling — wind-up back, sweep forward (release
    // at 0.28 s), recover. Pure additive offset, 0 at both ends, peak ~7.8
    // rad/s — under the pose layer's 8.5 rad/s limb continuity limit.
    if (g.fling) {
      const fl = g.fling;
      fl.t += dt;
      const T = fl.t;
      let off = 0;
      if (T < 0.15) off = 0.4 * smoothK(T / 0.15);
      else if (T < 0.4) off = 0.4 - 1.3 * smoothK((T - 0.15) / 0.25);
      else off = -0.9 * (1 - smoothK((T - 0.4) / 0.25));
      eatArmPivot.rotation.x += off;
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
        g.peep.head.updateWorldMatrix(true, false);
        _hand.set(0, -0.02, 0.13).applyMatrix4(g.peep.head.matrixWorld); // mouth
        s.fx.vomitFx.setOrigin(_hand.x, _hand.y, _hand.z);
        s.fx.vomitFx.burst(12);
        s.fx.dropVomit(g.x + Math.sin(g.yaw) * 0.32, g.z + Math.cos(g.yaw) * 0.32, g.baseY + 0.004);
        g.nausea = Math.max(0, g.nausea - 130);
        g.happiness = clamp255(g.happiness - 12); // RCT2-ish sick penalty
        g.happinessTarget = clamp255(g.happinessTarget - 12);
      }
    }
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

// ---------------------------------------------------------------------------
// GUEST NEEDS + TRANSACTIONS — the Tick128 needs clock (hunger / thirst /
// toilet / energy / happiness / nausea, progressive meal consumption, the
// poop fallback, the leave-the-park roll), the queue join/balk decisions and
// the shop counter (RCT2 DecideAndBuyItem: two-hand gate, overpay tolerance,
// consumable schedule, balloon joy buys).
//
// Every chance is a hashed draw off (guest index, tick counter), so a given
// seed always produces the same needs history. Implementation detail of
// createGameManager.
// ---------------------------------------------------------------------------

import {
  hash01,
  clamp255,
  chase,
  QUEUE_UNHAPPY_AT,
  QUEUE_AGES_AT,
  LAST_RIDE_TIMEOUT,
  MEAL_BITES,
  BITE_GAP,
} from './types';
import type { SimGuest, RideRec, StallRec, StallItemKind, ThoughtType } from './types';
import { freeHand } from './guestFx';
import { slotPos } from './access';
import type { Sim } from './sim';

export function createNeeds(s: Sim) {
  const { routing, walkY, groundAt, stalls } = s;

  // ---- queue join checks (Guest.cpp:5774-5837 ShouldGoOnRide, 1980-2042) ------
  const joinRefusal = (g: SimGuest, r: RideRec): ThoughtType | 'silent' | null => {
    if (r.state === 'crashed') return 'notSafe';
    if (r.brokenAt >= 0) return 'notSafe'; // broken down / being repaired: no admissions
    if (g.lastRide === r && s.simTime - g.lastRideT < LAST_RIDE_TIMEOUT) return 'silent'; // previous_ride_time_out
    if (g.cash < r.price) return 'cantAfford';
    if (r.queue.length >= r.maxSlots) return 'queueFull';
    // intensity window widens with happiness (happiness/32)
    if (Math.abs(r.intensity - g.intensityTolerance) > 2 + g.happiness / 32) return 'tooIntense';
    return null;
  };

  const tryJoinQueue = (g: SimGuest, r: RideRec) => {
    const refuse = joinRefusal(g, r);
    if (refuse) {
      if (refuse !== 'silent') {
        s.fx.pushThought(g, refuse);
        g.happinessTarget = clamp255(g.happinessTarget - 8);
      }
      g.goal = null;
      return false;
    }
    g.ride = r;
    g.state = 'queuing';
    g.timeInQueue = 0;
    g.goal = null;
    g.path = [];
    r.queue.push(g);
    // enter single file from BEYOND the lane tail, never through the railings
    const join = slotPos(r, r.queue.length + 1);
    g.waypoints = [{ ...join }];
    return true;
  };

  // guest abandons the queue — a TRANSITION back to walking, not a state
  const leaveQueue = (g: SimGuest, thought: ThoughtType | null) => {
    const r = g.ride;
    if (r) {
      const i = r.queue.indexOf(g);
      if (i >= 0) r.queue.splice(i, 1);
    }
    if (thought) s.fx.pushThought(g, thought);
    g.ride = null;
    g.state = 'walking';
    g.goal = null;
    g.path = [];
    if (r && r.queueAttach) {
      g.waypoints = [{ x: r.queueAttach.x, z: r.queueAttach.z, y: walkY(r.queueAttach.x, r.queueAttach.z) }];
      g.netReentry = r.queueAttach.node;
    } else {
      s.nav.newFallbackTarget(g);
    }
  };

  const startBuying = (g: SimGuest, st: StallRec) => {
    g.state = 'buying';
    g.stall = st;
    g.goal = null;
    g.path = [];
    g.timer = -1;
    g.waypoints = [{ x: st.front.x, z: st.front.z, y: routing ? walkY(st.front.x, st.front.z) : groundAt(st.front.x, st.front.z) }];
  };

  // ---- purchases (Guest.cpp:1529 DecideAndBuyItem) ----------------------------
  // Two-hand gate first: no free hand → 'handsFull'. Consumables prefer the
  // RIGHT hand and refuse while a consumable chain is still active ("I haven't
  // finished yet" — RCT2 haventFinished, Guest.cpp:1546-1553); accessories
  // (balloons) take WHICHEVER hand is free (left preferred, keeping the right
  // free for snacks).
  const doPurchase = (g: SimGuest, st: StallRec) => {
    const c = st.cfg;
    const consumable = c.item === 'food' || c.item === 'drink';
    let refuse: ThoughtType | null = null;
    const hand = freeHand(g, consumable ? 'right' : 'left');
    if (!hand) refuse = 'handsFull';
    else if (consumable && g.holding) refuse = 'haventFinished';
    else if (consumable && g.nausea >= 145) refuse = 'sick';
    else if (c.item === 'food' && g.hunger > 75) refuse = 'notHungry';
    else if (c.item === 'drink' && g.thirst > 75) refuse = 'notThirsty';
    else if (g.cash < c.price) refuse = 'cantAfford';
    else {
      // overpay tolerance 0..7, doubled when happy (>= 128) — halved penalty
      let tol = Math.floor(s.fx.draw(g, 5) * 8);
      if (g.happiness >= 128) tol *= 2;
      if (c.price - c.value > tol) refuse = 'notWorthIt';
    }
    if (refuse) {
      s.fx.pushThought(g, refuse);
      return;
    }
    g.cash -= c.price;
    if (c.value > c.price) {
      g.happinessTarget = clamp255(g.happinessTarget + 4 * (c.value - c.price)); // good value
      s.fx.pushThought(g, 'goodValue');
    }
    if (consumable) {
      g.holding = c.item as 'food' | 'drink';
      g.eatHand = hand!;
      // the meal schedule: 12-16 bites, one every 10-15 s (both hashed per
      // purchase) → the item lasts 2-4 sim-minutes; first bite lands soon
      g.eatN = MEAL_BITES + Math.floor(s.fx.draw(g, 21) * 5);
      g.biteGap = BITE_GAP + s.fx.draw(g, 22) * 5;
      g.nextBiteAt = s.simTime + 2 + s.fx.draw(g, 24) * 3;
      g.lastBiteAt = -999;
      s.fx.ensureHeld(g, hand!); // build the held-item meshes once; visibility does the rest
    } else {
      // ACCESSORY — a balloon: cheap joy (+12 happiness) held in the free hand
      s.fx.attachBalloon(g, hand!);
      g.happinessTarget = clamp255(g.happinessTarget + 12);
      s.balloonsSold += 1;
    }
    st.sold += 1;
  };

  const beginLeaving = (g: SimGuest) => {
    s.fx.pushThought(g, 'goHome');
    g.state = 'leavingPark';
    g.goal = { kind: 'exit', node: s.spawnNode };
    g.path = [];
    g.timer = 0;
    if (!routing) {
      if (s.parkEntrance)
        g.waypoints = [{ x: s.parkEntrance.arch.x, z: s.parkEntrance.arch.z, y: groundAt(s.parkEntrance.arch.x, s.parkEntrance.arch.z) }];
      g.target = { x: s.spawnPt.x, z: s.spawnPt.z, y: groundAt(s.spawnPt.x, s.spawnPt.z) };
    }
  };

  const despawn = (g: SimGuest) => {
    g.gone = true;
    g.hidden = true;
    g.peep.group.visible = false;
  };

  const nearestStall = (g: SimGuest, item: StallItemKind): StallRec | null => {
    let best: StallRec | null = null;
    let bestD = Infinity;
    for (const st of stalls) {
      if (st.cfg.item !== item) continue;
      const d = (st.front.x - g.x) ** 2 + (st.front.z - g.z) ** 2;
      if (d < bestD) {
        bestD = d;
        best = st;
      }
    }
    return best;
  };

  // ---- Tick128 needs update (Guest.cpp:769-921, 3089) --------------------------
  const tick128 = (g: SimGuest) => {
    g.tick128N += 1;
    // passive decay PAUSES for the need currently being consumed — on this
    // sim's compressed needs clock a 2-4 minute meal would otherwise
    // out-decay its own bites and leave the guest hungrier than they started
    if (g.holding !== 'food') g.hunger = Math.max(0, g.hunger - 2);
    if (g.holding !== 'drink') g.thirst = Math.max(0, g.thirst - 2);
    g.toilet = Math.min(255, g.toilet + 1);
    // consumption: PROGRESSIVE relief, one scheduled bite/sip at a time
    // (RCT2 updateConsumptionMotives, Guest.cpp:815-854: +hunger per nibble,
    // food also makes the guest thirstier and fills the bladder :829-834,
    // and consumption pauses while onRide :822). After the last bite the
    // guest keeps the CONTAINER for the usual bin/litter flow.
    if ((g.holding === 'food' || g.holding === 'drink') && g.state !== 'onRide' && s.simTime >= g.nextBiteAt) {
      if (g.holding === 'food') {
        g.hunger = Math.min(255, g.hunger + 4);
        g.thirst = Math.max(0, g.thirst - 1);
        g.toilet = Math.min(255, g.toilet + 1);
      } else {
        g.thirst = Math.min(255, g.thirst + 4);
      }
      g.lastBiteAt = s.simTime;
      g.nextBiteAt = s.simTime + g.biteGap;
      g.eatN -= 1;
      if (g.eatN <= 0) {
        g.holding = 'container';
        g.containerSince = s.simTime;
      }
    }
    if (g.energy <= 50) g.happinessTarget = clamp255(g.happinessTarget - 2);
    if (g.hunger < 10 || g.thirst < 10) g.happinessTarget = clamp255(g.happinessTarget - 1);
    if (g.state === 'queuing' || g.state === 'queuingFront') {
      if (g.timeInQueue >= QUEUE_UNHAPPY_AT) g.happinessTarget = clamp255(g.happinessTarget - 4); // Guest.cpp:7535
      if (g.timeInQueue >= QUEUE_AGES_AT) s.fx.pushThought(g, 'queuingAges');
    }
    // needs chase their targets (RCT2 steps ±2 on 32..128; ±4 on our 0..255)
    g.energy = Math.max(32, Math.min(255, chase(g.energy, g.energyTarget, 4)));
    g.happiness = clamp255(chase(g.happiness, g.happinessTarget, 4));
    g.nausea = Math.max(0, g.nausea - 4);
    // guests tire over the day — but NOT while enjoying a snack: a 2-4 min
    // meal would otherwise outlast the guest's remaining park life on this
    // compressed clock (they'd despawn mid-burger and no container would
    // ever reach the bin/litter flow), so the day clock pauses while eating
    if (g.energyTarget > 32 && g.holding !== 'food' && g.holding !== 'drink') g.energyTarget -= 1;
    // thought triggers (Guest.cpp:1093)
    if (g.hunger <= 10) s.fx.pushThought(g, 'hungry');
    if (g.thirst <= 25) s.fx.pushThought(g, 'thirsty');
    if (g.toilet >= 160) s.fx.pushThought(g, 'toilet');
    // toilet maxed with NO reachable restroom: the discreet poop fallback —
    // a small verge-side mesh (cap 8, oldest reused), embarrassment thought,
    // happiness −20. With a reachable restroom the need just clamps at 255
    // while the guest seeks it (see TOILET_SEEK goal selection).
    if (g.toilet >= 255 && g.state !== 'usingRestroom' && !s.registry.restroomReachable(g)) {
      if (!g.hidden && (g.state === 'walking' || g.state === 'leavingPark') && !g.action) {
        // visible walker: 0.8 s SQUAT first (leg fold + body drop overlay,
        // skirt flares to cover) — the poop mesh and the embarrassment land
        // when the squat completes (see the squat-completion block)
        g.action = { kind: 'squat', until: s.simTime + 0.8 };
        g.squatT = 0;
      } else if (g.action?.kind !== 'squat') {
        // hidden / stationary-state fallback: the old instant drop
        s.fx.dropPoop(g.x + Math.cos(g.yaw) * 0.32, g.z - Math.sin(g.yaw) * 0.32, g.baseY + 0.005);
        g.toilet = 30;
        g.happiness = clamp255(g.happiness - 20);
        g.happinessTarget = clamp255(g.happinessTarget - 20);
        s.fx.pushThought(g, 'embarrassed');
      }
    }
    // leaving the park (Guest.cpp:3106): worn out or miserable, 5% per Tick128
    if ((g.state === 'walking' || g.state === 'sitting' || g.state === 'watching') && (g.energy < 55 || g.happiness < 45)) {
      if (hash01(g.idx * 41.3 + g.tick128N * 13.7) < 0.05) beginLeaving(g);
    }
  };

  return {
    joinRefusal,
    tryJoinQueue,
    leaveQueue,
    startBuying,
    doPurchase,
    beginLeaving,
    despawn,
    nearestStall,
    tick128,
  };
}

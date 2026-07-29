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
  NEEDS_SLOW_EVERY,
  TOILET_FILL,
} from './types';
import type { SimGuest, RideRec, RideStationRec, StallRec, StallItemKind, ThoughtType, BenchRec } from './types';
import { freeHand } from './guestFx';
import { slotPos } from './access';
import type { Sim } from './sim';

/** extra allowance on the TAME side of the intensity window (see joinRefusal) */
const TAME_SLACK = 4;

export function createNeeds(s: Sim) {
  const { routing, walkY, groundAt, stalls } = s;

  // ---- queue join checks (Guest.cpp:5774-5837 ShouldGoOnRide, 1980-2042) ------
  // EVERY refusal here NAMES THE RIDE — RCT2 passes `ride.id` to each of these
  // thoughts (cantAffordRide :2073, notSafe :2086, moreThrilling :2141,
  // intense :2483) so the guest window reads "Boiler Burst looks too intense
  // for me", never a generic line. The one exception is `spentMoney` ("I've
  // spent all my money", :2069) which RCT2 pushes with no argument.
  const joinRefusal = (g: SimGuest, r: RideRec, st: RideStationRec): ThoughtType | 'silent' | null => {
    // a WRECK is the only ride a guest refuses on safety grounds — the
    // `brokenAt >= 0` refusal that used to sit here went with the breakdown
    // schedule (GameManager/access.ts `statusOf`)
    if (r.state === 'crashed') return 'notSafe';
    if (g.lastRide === r && s.simTime - g.lastRideT < LAST_RIDE_TIMEOUT) return 'silent'; // previous_ride_time_out
    // RCT2 splits the money refusal in two (Guest.cpp:2065-2075): an empty
    // pocket is "I've spent all my money", a merely insufficient one is
    // "I can't afford <ride>"
    if (r.price > 0 && g.cash <= 0) return 'spentMoney';
    if (g.cash < r.price) return 'cantAfford';
    if (st.queue.length >= st.maxSlots) return 'queueFull'; // THIS platform's lane
    // INTENSITY, on an ASYMMETRIC window that widens with happiness. RCT2 splits
    // the two sides into different thoughts: above tolerance is "<ride> looks too
    // intense for me" (intense, Guest.cpp:2483), well below it is "I want to go
    // on something more thrilling than <ride>" (moreThrilling, :2141).
    //
    // The two sides are NOT symmetric here, deliberately. The scary side is a
    // real safety instinct and keeps roughly RCT2's width. The TAME side was the
    // single biggest reason a park's roster never got covered: with one window a
    // thrill-seeker REFUSES the carousel, so every gentle ride in the park is
    // closed to every guest with a high tolerance, and the timid guests who would
    // ride it are refused the coaster in the same breath. Nobody minds a ride
    // being gentler than their preference — so the tame side gets `TAME_SLACK`
    // extra, and `moreThrilling` now only fires when the ride is FAR below
    // tolerance AND the guest is already unhappy (a low `window`), which is when
    // the complaint is actually in character.
    const window = 2.5 + g.happiness / 28;
    const gap = r.intensity - g.intensityTolerance;
    if (gap > window) return 'tooIntense';
    if (-gap > window + TAME_SLACK) return 'moreThrilling';
    return null;
  };

  // `st` is the PLATFORM whose entrance the guest walked up to — RCT2 reads it
  // off the entrance tile itself (`GetStationIndex()`, entity/Peep.cpp:1729).
  // Defaults to station 0, so every single-station call site is unchanged.
  const tryJoinQueue = (g: SimGuest, r: RideRec, st: RideStationRec = r.stations[0]) => {
    const refuse = joinRefusal(g, r, st);
    if (refuse) {
      if (refuse !== 'silent') {
        s.fx.pushThought(g, refuse, r.cfg.name);
        g.happinessTarget = clamp255(g.happinessTarget - 8);
      }
      g.goal = null;
      return false;
    }
    g.ride = r;
    g.station = st;
    g.state = 'queuing';
    g.timeInQueue = 0;
    g.goal = null;
    g.path = [];
    st.queue.push(g);
    // enter single file from BEYOND the lane tail, never through the railings
    const join = slotPos(st, st.queue.length + 1);
    g.waypoints = [{ ...join }];
    return true;
  };

  // guest abandons the queue — a TRANSITION back to walking, not a state
  const leaveQueue = (g: SimGuest, thought: ThoughtType | null) => {
    const r = g.ride;
    const st = g.station ?? r?.stations[0] ?? null;
    if (st) {
      const i = st.queue.indexOf(g);
      if (i >= 0) st.queue.splice(i, 1);
    }
    // the abandonment thought names the ride being abandoned (RCT2's
    // queuingAges carries the ride id, Guest.cpp:5785)
    if (thought) s.fx.pushThought(g, thought, r ? r.cfg.name : null);
    g.ride = null;
    g.station = null;
    g.state = 'walking';
    g.goal = null;
    g.path = [];
    if (st && st.queueAttach) {
      g.waypoints = [{ x: st.queueAttach.x, z: st.queueAttach.z, y: walkY(st.queueAttach.x, st.queueAttach.z) }];
      g.netReentry = st.queueAttach.node;
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

  // ---- shop thought subjects --------------------------------------------------
  // RCT2's shop thoughts carry a ShopItem (alreadyGot :1543, haventFinished
  // :1553, cantAffordItem :1603) or the SHOP's ride id (TooMuchThought :1625,
  // GoodValueThought :1640), and its string table pairs the two up per item:
  // "This burger from {shop} is really good value" (STR_1524), "I'm not paying
  // that much for a burger from {shop}" (STR_1558), "I haven't finished my
  // burger yet" (STR_1486). This sim's stalls carry a NAME and an item KIND but
  // no per-item string table, so the subject is composed here as
  // `<noun> from <stall>` — the shop is always named, which is what a park
  // owner actually wants to read.
  const ITEM_NOUN: Record<string, string> = { food: 'food', drink: 'drink', balloon: 'balloon', wearable: 'souvenir' };
  const nounOf = (item: StallItemKind) => ITEM_NOUN[item as string] ?? 'item';
  const shopSubject = (st: StallRec) => `${nounOf(st.cfg.item)} from ${st.cfg.name}`;

  // ---- purchases (Guest.cpp:1529 DecideAndBuyItem) ----------------------------
  // Two-hand gate first: no free hand → 'handsFull'. Consumables prefer the
  // RIGHT hand and refuse while a consumable chain is still active ("I haven't
  // finished yet" — RCT2 haventFinished, Guest.cpp:1546-1553); accessories
  // (balloons) take WHICHEVER hand is free (left preferred, keeping the right
  // free for snacks). WEARABLES skip the hand gate entirely — they occupy the
  // peep's HEAD slot, so the gate is "am I already wearing something?".
  const doPurchase = (g: SimGuest, st: StallRec) => {
    const c = st.cfg;
    const consumable = c.item === 'food' || c.item === 'drink';
    const wearable = c.item === 'wearable';
    let refuse: ThoughtType | null = null;
    // the SUBJECT of whichever refusal fires: the shop's `<noun> from <stall>`
    // for the value/affordability ones, the item ALREADY IN HAND for
    // haventFinished ("I haven't finished my drink yet" — RCT2 passes the held
    // ShopItem, not the shop's, Guest.cpp:1553)
    let subject: string | null = shopSubject(st);
    const hand = wearable ? null : freeHand(g, consumable ? 'right' : 'left');
    if (wearable && g.worn) {
      refuse = 'alreadyWearing';
      subject = `a ${nounOf(c.item)} from ${st.cfg.name}`; // "I've already got a souvenir from X"
    } else if (!wearable && !hand) refuse = 'handsFull';
    else if (consumable && g.holding) {
      refuse = 'haventFinished';
      subject = g.holding === 'container' ? nounOf(c.item) : g.holding;
    } else if (consumable && g.nausea >= 145) refuse = 'sick';
    else if (c.item === 'food' && g.hunger > 75) refuse = 'notHungry';
    else if (c.item === 'drink' && g.thirst > 75) refuse = 'notThirsty';
    else if (c.price > 0 && g.cash <= 0) refuse = 'spentMoney'; // RCT2 :1598
    else if (g.cash < c.price) refuse = 'cantAfford';
    else {
      // overpay tolerance 0..7, doubled when happy (>= 128) — halved penalty
      let tol = Math.floor(s.fx.draw(g, 5) * 8);
      if (g.happiness >= 128) tol *= 2;
      if (c.price - c.value > tol) refuse = 'notWorthIt';
    }
    if (refuse) {
      s.fx.pushThought(g, refuse, subject);
      return;
    }
    // ---- DELIVERY BEFORE PAYMENT ------------------------------------------
    // A purchase that cannot hand over its item must not charge and must not
    // count. `attachWearable` returns null when the stall ships no `heldItem`
    // builder — a wearable is the ONE item with no generic fallback mesh — and
    // the old order charged `c.price`, granted the +12 joy and incremented
    // `st.sold` regardless. Because `g.worn` then stayed null, the
    // `alreadyWearing` gate above never engaged and the same guests bought the
    // same invisible souvenir forever: probe-wearable's `--noitem` control
    // measured 97 sales to 0 wearers, against a healthy 8 sales to 8 wearers.
    // So the attach happens FIRST and a failure aborts the whole transaction.
    //
    // The other two attaches are deliberately NOT gated this way:
    //   * `attachStallItem` also returns null without a `heldItem`, but that is
    //     BENIGN and intentional — `ensureHeld` (below) has already built the
    //     generic burger/cup, so the food/drink is delivered either way and the
    //     stall's own mesh is a garnish;
    //   * `attachBalloon` builds a procedural rig and cannot fail at all.
    if (wearable && !s.fx.attachWearable(g, st)) return;
    g.cash -= c.price;
    if (c.value > c.price) {
      g.happinessTarget = clamp255(g.happinessTarget + 4 * (c.value - c.price)); // good value
      s.fx.pushThought(g, 'goodValue', shopSubject(st)); // "This drink from Soda Stand is really good value"
    }
    if (consumable) {
      g.holding = c.item as 'food' | 'drink';
      g.eatHand = hand!;
      // the meal schedule: 12-16 bites, one every 8-12 s (both hashed per
      // purchase) → the item lasts 1.6-3.2 sim-minutes; first bite lands soon
      g.eatN = MEAL_BITES + Math.floor(s.fx.draw(g, 21) * 5);
      g.biteGap = BITE_GAP + s.fx.draw(g, 22) * 4;
      g.nextBiteAt = s.simTime + 2 + s.fx.draw(g, 24) * 3;
      g.lastBiteAt = -999;
      s.fx.ensureHeld(g, hand!); // build the generic held meshes once; visibility does the rest
      // ...then, if THIS stall ships its own 3D item (StallConfig.heldItem),
      // clone it onto the same hand hold spot: the buyer walks off with a hot
      // dog / floss cone / soda can instead of the generic burger or cup. The
      // generic CONTAINER still takes over when the meal runs out.
      s.fx.detachStallItem(g); // paranoia: nothing should still be in the hand
      s.fx.attachStallItem(g, hand!, st);
    } else if (wearable) {
      // ACCESSORY — WORN, never consumed: on the head slot, +12 joy like a
      // balloon, but with no drop schedule and no litter (it survives rides).
      // Already attached above, before the charge — see DELIVERY BEFORE PAYMENT.
      g.happinessTarget = clamp255(g.happinessTarget + 12);
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
    // ...and take the rig OUT of the scene graph. `gone` is terminal (the
    // per-guest pass returns immediately, every accessor filters them), so a
    // parked invisible rig is pure cost: three's Raycaster ignores `visible`,
    // so each one left a `guestRef` carrier + a fat click proxy standing on the
    // gate apron where they walked out — an invisible pile that grew all session
    // and swallowed clicks aimed at the guests still walking around it (a `gone`
    // pick makes <Park> drop the window again, i.e. "the click does nothing").
    g.peep.group.removeFromParent();
    // the click proxy is a SIBLING of the rig now (spawn.ts), so it has to be
    // taken out on its own — leaving it behind would recreate exactly the
    // invisible click-swallowing pile this removal exists to prevent.
    g.proxy.visible = false;
    g.proxy.removeFromParent();
    // …and give the instanced far crowd its slot back
    s.crowd.clear(g);
  };

  /** can this stall actually HAND OVER what it sells? A `'wearable'` is the one
   *  item with no generic fallback mesh — `attachWearable` needs the stall's own
   *  `heldItem` builder and returns null without it — so a wearable shop that
   *  ships none can never deliver and must not attract guests. Consumables fall
   *  back to the manager's generic burger/cup and a balloon rig is procedural,
   *  so those always deliver. Without this guard a mis-registered wearable stall
   *  is a livelock: `g.worn` never gets set, so the joy-buy router
   *  (`navigation.ts`, gated on `!g.worn`) sends the same guests back forever. */
  const canDeliver = (st: StallRec): boolean => st.cfg.item !== 'wearable' || !!st.cfg.heldItem;

  const nearestStall = (g: SimGuest, item: StallItemKind): StallRec | null => {
    let best: StallRec | null = null;
    let bestD = Infinity;
    for (const st of stalls) {
      if (st.cfg.item !== item) continue;
      if (!canDeliver(st)) continue;
      const d = (st.front.x - g.x) ** 2 + (st.front.z - g.z) ** 2;
      if (d < bestD) {
        bestD = d;
        best = st;
      }
    }
    return best;
  };

  // ---- BENCHES: RCT2's PeepState::Sitting on a real seat ----------------------
  // `Guest::UpdateWalking` (entity/Guest.cpp:2790-2860) looks for a bench path
  // ADDITION on the tile the guest is standing on, checks it is not already
  // occupied, and walks them onto it; `UpdateSitting` (:2900-2990) then runs the
  // dwell and recovers energy. This is the same shape with the same two rules:
  // a seat holds ONE guest, and the guest has to be close enough to reach it
  // without walking off across the park.
  //
  // No routing spur is attached per bench, deliberately. A lined street carries
  // a bench every ~4.8 u on BOTH verges, so a park-scale lattice publishes
  // hundreds of them — pushing that many logical nodes into the shared net
  // would swamp the routing graph for a rest stop. Instead a bench is reached
  // the way a litter bin is: a short off-network waypoint walk with `g.resume`
  // holding the edge position to step back onto (guestPass.ts `usingBin`).

  /** how far off their current position a guest will detour to a free seat */
  const BENCH_REACH = 2.6;

  /** the nearest FREE bench seat within `reach`, claimed for `g`, or null when
   *  the park has no benches (or none free nearby) — in which case the caller
   *  falls back to the in-place rest that was here before. */
  const claimBench = (g: SimGuest, reach = BENCH_REACH): BenchRec | null => {
    let best: BenchRec | null = null;
    let bestD = reach * reach;
    for (const b of s.benches) {
      if (b.taken) continue;
      const d = (b.x - g.x) ** 2 + (b.z - g.z) ** 2;
      if (d < bestD) {
        bestD = d;
        best = b;
      }
    }
    if (!best) return null;
    best.taken = g;
    g.bench = best;
    return best;
  };

  /** give the seat back. Idempotent, and safe to call on a guest who never had
   *  one — `guestPass` calls it as an invariant every frame a guest is holding a
   *  bench without being sat on it, so a despawn or a park exit can never leak
   *  a permanently occupied seat. */
  const releaseBench = (g: SimGuest) => {
    if (!g.bench) return;
    if (g.bench.taken === g) g.bench.taken = null;
    g.bench = null;
  };

  // ---- Tick128 needs update (Guest.cpp:769-921, 3089) --------------------------
  // TWO cadences, exactly as RCT2 has them (see NEEDS_SLOW_EVERY in types.ts):
  //   EVERY needs tick (128 ticks, 0.8 s) — updateConsumptionMotives only: the
  //     scheduled bite/sip, the energy chase and the happiness chase
  //     (Guest.cpp:815-921). This is the block RCT2 reaches on all four calls.
  //   EVERY FOURTH tick (512 ticks, 3.2 s) — the appetite and mood STEPS:
  //     hunger / toilet (GuestUpdateHunger :3089), thirst and energyTarget
  //     (GuestDecideWhetherToLeavePark :3108-3116), the happiness drains
  //     (updateMotivesIdle :769-812), the queuing −4 (:1240) and the
  //     leave-the-park roll (:3145). Each step below cites its line and flags
  //     where the STEP SIZE deviates from RCT2 and why.
  // NOT modelled (a pre-existing gap, unchanged here): RCT2's idle happiness
  // DRIFT toward 127 (updateMotivesIdle :771-775, ±1 per slow cycle).
  const tick128 = (g: SimGuest) => {
    g.tick128N += 1;
    const slow = g.tick128N % NEEDS_SLOW_EVERY === 0; // RCT2's 512-tick gate
    if (slow) {
      // passive decay PAUSES for the need currently being consumed — a
      // multi-minute meal would otherwise out-decay its own bites and leave the
      // guest hungrier than they started
      if (g.holding !== 'food') g.hunger = Math.max(0, g.hunger - 2); // Guest.cpp:3093
      // RCT2 drops thirst by 1 here, and ONLY when the weather is warm
      // (temperature >= 21, Guest.cpp:3113). This sim has no weather model and
      // every park in the fleet is a warm one, so thirst uses the same −2 step
      // as hunger: a DELIBERATE deviation, so drink stalls still see trade
      // inside a guest's few-minute visit. (RCT2-exact would be −1.)
      if (g.holding !== 'drink') g.thirst = Math.max(0, g.thirst - 2);
      // TOILET +1 in RCT2 (Guest.cpp:3096), unconditionally, from a fresh
      // arrival's rolled 0-77. Here the need is a CONSEQUENCE OF EATING instead:
      // every guest spawns at toilet 0 (spawn.ts) and this passive climb is held
      // until their first mouthful — so the trip to the restroom lands after the
      // burger, in that order, which is the loop a park owner can actually see.
      // The step is `TOILET_FILL` (6, not RCT2's 1) because it now has only the
      // POST-MEAL part of a visit to cover rather than the whole of it; the
      // arithmetic is in types.ts.
      if (g.ateFood) g.toilet = Math.min(255, g.toilet + TOILET_FILL);
    }
    // consumption: PROGRESSIVE relief, one scheduled bite/sip at a time
    // (RCT2 updateConsumptionMotives, Guest.cpp:815-854: +7 per nibble,
    // food also makes the guest thirstier (−3) and fills the bladder (+2),
    // and consumption pauses while onRide :822). After the last bite the
    // guest keeps the CONTAINER for the usual bin/litter flow.
    if ((g.holding === 'food' || g.holding === 'drink') && g.state !== 'onRide' && s.simTime >= g.nextBiteAt) {
      if (g.holding === 'food') {
        g.hunger = Math.min(255, g.hunger + 7); // RCT2's +7 (was +4): 12-16 bites now REFILL a meal's worth
        g.thirst = Math.max(0, g.thirst - 3); // Guest.cpp:831 — eating makes you thirsty
        g.toilet = Math.min(255, g.toilet + 2); // Guest.cpp:832
        // THE FIRST MOUTHFUL is what starts the bladder filling at all (see the
        // TOILET_FILL step above and spawn.ts's toilet 0). It is set on the BITE,
        // not on the purchase, so a guest carrying an untouched burger has not
        // eaten yet — RCT2 fills the bladder off the nibble too (:832).
        g.ateFood = true;
      } else {
        g.thirst = Math.min(255, g.thirst + 7); // Guest.cpp:827
      }
      g.lastBiteAt = s.simTime;
      g.nextBiteAt = s.simTime + g.biteGap;
      g.eatN -= 1;
      if (g.eatN <= 0) {
        g.holding = 'container';
        g.containerSince = s.simTime;
      }
    }
    if (slow) {
      if (g.energy <= 50) g.happinessTarget = clamp255(g.happinessTarget - 2); // Guest.cpp:779
      if (g.hunger < 10) g.happinessTarget = clamp255(g.happinessTarget - 1); // Guest.cpp:785
      if (g.thirst < 10) g.happinessTarget = clamp255(g.happinessTarget - 1); // Guest.cpp:790
      if (g.toilet >= 195) g.happinessTarget = clamp255(g.happinessTarget - 1); // Guest.cpp:795
    }
    if (g.state === 'queuing' || g.state === 'queuingFront') {
      // the queue drain is on the 512-tick gate in RCT2 too — the `switch
      // (State)` that holds it sits below the 0x1FF bail (Guest.cpp:1199-1243)
      if (slow && g.timeInQueue >= QUEUE_UNHAPPY_AT) g.happinessTarget = clamp255(g.happinessTarget - 4); // Guest.cpp:1240
      // "I've been queuing for <ride> for ages" — RCT2 passes CurrentRide
      // (Guest.cpp:5785), so the complaint names the line they are standing in
      if (g.timeInQueue >= QUEUE_AGES_AT) s.fx.pushThought(g, 'queuingAges', g.ride?.cfg.name ?? null);
    }
    // needs chase their targets (RCT2 steps ±2 on 32..128; ±4 on our 0..255) —
    // EVERY tick, like RCT2's updateConsumptionMotives (Guest.cpp:856-895)
    g.energy = Math.max(32, Math.min(255, chase(g.energy, g.energyTarget, 4)));
    g.happiness = clamp255(chase(g.happiness, g.happinessTarget, 4));
    g.nausea = Math.max(0, g.nausea - 4);
    // guests tire over the day (RCT2 energyTarget −2 per 512-tick cycle,
    // Guest.cpp:3110) — but NOT while enjoying a snack: a multi-minute meal
    // would otherwise outlast the guest's remaining park life (they'd despawn
    // mid-burger and no container would ever reach the bin/litter flow), so the
    // day clock pauses while eating
    if (slow && g.energyTarget > 32 && g.holding !== 'food' && g.holding !== 'drink') g.energyTarget -= 2;
    // thought triggers (Guest.cpp:1085-1131) — RCT2 rolls these on the 1024-tick
    // half of the slow gate; here they fire on the slow gate itself and are
    // rate-limited by pushThought's own 20 s ambient cadence
    if (slow) {
      if (g.energy <= 70 && g.happiness < 128) s.fx.pushThought(g, 'tired'); // Guest.cpp:1093
      if (g.hunger <= 10 && !g.holding) s.fx.pushThought(g, 'hungry'); // Guest.cpp:1098 (!hasFoodOrDrink)
      if (g.thirst <= 25 && !g.holding) s.fx.pushThought(g, 'thirsty'); // Guest.cpp:1103
      if (g.toilet >= 160) s.fx.pushThought(g, 'toilet'); // Guest.cpp:1108
    }
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
    // leaving the park (GuestDecideWhetherToLeavePark, Guest.cpp:3106-3151):
    // worn out, miserable OR out of pocket money — a guest who clears all three
    // ALWAYS stays; otherwise a 5% roll per 512-tick cycle (RCT2's `> 3276`
    // out of 0xFFFF). The cash clause is RCT2's `cashInPocket >= 5.00_GBP`
    // (:3138), i.e. ~12 sim coins on this price scale.
    if (
      slow &&
      (g.state === 'walking' || g.state === 'sitting' || g.state === 'watching') &&
      (g.energy < 55 || g.happiness < 45 || g.cash < 12)
    ) {
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
    claimBench,
    releaseBench,
    tick128,
  };
}

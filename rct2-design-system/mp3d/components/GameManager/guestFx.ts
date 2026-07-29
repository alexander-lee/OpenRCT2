// ---------------------------------------------------------------------------
// GUEST FX + CARRIED THINGS — the pooled world litter/vomit/poop meshes, the
// thought ring, the deterministic per-guest decision draw, the two-hand held
// item registry (generic food / drink / container PLUS the per-stall themed
// `heldItem` clones), the head slot's worn accessories and the balloon rigs
// (held + flown), plus their per-frame tweens (thrown-litter arcs, airborne
// balloons, the shared vomit emitter).
//
// Every pool is CAPPED with oldest-slot reuse, exactly as RCT2 recycles its
// litter/vomit entities, and every random choice is a hashed draw, so the
// whole module is deterministic. Implementation detail of createGameManager.
// ---------------------------------------------------------------------------

import type * as THREE from 'three';
import { box, cyl, ball } from '../Stage';
import { buildEmitter } from '../ParticleKit';
import { BALLOON_COLS } from '../BalloonStand';
import { hash01, clamp255, LITTER_CAP, POOP_CAP, thoughtText, thoughtNamesSubject } from './types';
import type { ThoughtType, HandSlot, HeldItemKind, SimGuest, LitterFlight, BalloonHold, WornItem, StallRec } from './types';
import type { Sim } from './sim';

// ---- hand-slot registry: two hands, at most ONE item per hand -------------
// Consumables (food/drink/container) occupy g.eatHand (right preferred),
// accessories (balloons) occupy whichever hand carries their rig. A purchase
// that finds no free hand refuses with the 'handsFull' thought.
export const armOf = (g: SimGuest, hand: HandSlot) => (hand === 'left' ? g.peep.armL : g.peep.armR);
export const handItem = (g: SimGuest, hand: HandSlot): HeldItemKind | null => {
  if (g.balloons[hand]) return 'balloon';
  if (g.holding && g.eatHand === hand) return g.holding;
  return null;
};
export const freeHand = (g: SimGuest, prefer: HandSlot): HandSlot | null => {
  const other: HandSlot = prefer === 'right' ? 'left' : 'right';
  if (!handItem(g, prefer)) return prefer;
  if (!handItem(g, other)) return other;
  return null;
};

const dimCol = (c: number, f: number) =>
  (((((c >> 16) & 255) * f) | 0) << 16) | (((((c >> 8) & 255) * f) | 0) << 8) | (((c & 255) * f) | 0);

// ---- flown balloons: pooled airborne rigs (cap 10, oldest reused) ----------
// On release the balloon rises with ACCELERATING buoyancy (RCT2 balloons
// climb z+1 every 3 ticks until they pop at a max height, Balloon.cpp:33-71
// — ours accelerates for the helium feel), sways on hashed wind, spins
// slightly, then shrinks/fades out above ~8 u and frees its pool slot.
interface AirBalloon {
  root: THREE.Group;
  ball: THREE.Mesh;
  ballMat: THREE.MeshStandardMaterial;
  strMat: THREE.MeshStandardMaterial;
  active: boolean;
  x0: number;
  y0: number;
  z0: number;
  t0: number;
  seed: number;
}

export function createGuestFx(s: Sim) {
  const { t, group, routing, walkY, groundAt } = s;

  const litter: { mesh: THREE.Group; x: number; z: number }[] = [];
  let litterNext = 0;
  const poops: { mesh: THREE.Group; x: number; z: number }[] = [];
  let poopNext = 0;

  // ---- thoughts: 5-slot ring per guest, fresh-duplicate suppressed ----------
  // CADENCE GATE: the ambient/need-driven generators (hungry / thirsty /
  // toilet / queuingAges / badLitter re-fire every needs tick) may add a new
  // thought AT MOST every THOUGHT_GAP seconds per guest — urgent EVENT
  // thoughts (ride reactions, purchases, sickness, leaving...) still append
  // immediately, but they too reset the gate so the ring never churns faster
  // than one thought per THOUGHT_GAP under ambient pressure.
  // THE SUBJECT: every thought carries the RCT2 thought ARGUMENT — the ride,
  // stall or held item it names (Guest::insertNewThought's RideId / ShopItem
  // overloads, Guest.cpp:7077-7098). It is substituted into the template's `{}`
  // slot at push time, so `Thought.text` is the finished line every window
  // draws ("Wyrm's Hollow was great!") and `Thought.subject` keeps the raw name
  // for anything that wants to group or link by ride.
  //
  // The freshness gate keys on (type, subject) — RCT2's own duplicate check
  // compares the argument too (Guest.cpp:7109-7127 walks the ring on type AND
  // item) — so "Wyrm's Hollow was great!" never suppresses "Moonlit Barge was
  // great!" 20 s later, which is exactly the case a subjectless table could not
  // express.
  const THOUGHT_GAP = 20;
  const AMBIENT_THOUGHTS = new Set<ThoughtType>(['hungry', 'thirsty', 'toilet', 'tired', 'queuingAges', 'badLitter']);
  const pushThought = (g: SimGuest, type: ThoughtType, subject?: string | null) => {
    // a thought whose RCT2 string has no argument slot carries NO subject, even
    // if the caller offered one (RCT2's spentMoney / notHungry / sick are pushed
    // through the no-argument overload, Guest.cpp:7077) — so `thoughtSubjects`
    // never claims a name the text does not show
    const subj = thoughtNamesSubject(type) ? subject ?? null : null;
    if (g.thoughts.some((th) => th.type === type && th.subject === subj && s.simTime - th.t < 20)) return;
    if (AMBIENT_THOUGHTS.has(type) && s.simTime - g.lastThoughtAt < THOUGHT_GAP) return;
    g.thoughts.unshift({ type, text: thoughtText(type, subj), subject: subj, t: s.simTime });
    if (g.thoughts.length > 5) g.thoughts.pop(); // kPeepMaxThoughts = 5
    g.lastThoughtAt = s.simTime;
  };

  // deterministic draw: advances the guest's decision counter every call
  const draw = (g: SimGuest, salt: number) => {
    g.decN += 1;
    return hash01(g.idx * 131.7 + g.decN * 23.9 + salt * 7.7);
  };

  // ---- litter (Guest.cpp:6172 litter spawn; capped, oldest reused) ----------
  // returns the slot record so throwLitter can fly its mesh in from the hand
  const dropLitter = (x: number, z: number, y: number, seed: number) => {
    if (litter.length < LITTER_CAP) {
      const m = new t.Group();
      const tints = [0xb0342a, 0xc8b898, 0x9a6a30, 0xd8d4c8]; // cup / wrapper / carton / paper
      const n = 2 + Math.floor(hash01(seed) * 2); // 2–3 crumpled scraps
      for (let k = 0; k < n; k += 1) {
        const tint = tints[Math.floor(hash01(seed * 3.7 + k * 1.3) * tints.length)];
        m.add(
          box(t, [0.055, 0.028, 0.042], tint, [(hash01(seed + k * 9.1) - 0.5) * 0.16, 0.016, (hash01(seed + k * 4.3) - 0.5) * 0.16], {
            rough: 0.92,
            rotY: hash01(seed * 1.7 + k) * Math.PI,
          }),
        );
      }
      m.position.set(x, y, z);
      group.add(m);
      const rec = { mesh: m, x, z };
      litter.push(rec);
      return rec;
    }
    const L = litter[litterNext];
    litterNext = (litterNext + 1) % LITTER_CAP;
    L.x = x;
    L.z = z;
    L.mesh.position.set(x, y, z);
    return L;
  };

  // ---- thrown litter: instead of popping in at the ground spot, the guest
  // plays a 0.65 s armR fling (wind-up, sweep, recover — an offset overlay
  // that starts and ends at 0, so it composes over the pose/eat slew guard)
  // and the scraps ARC from the hand to the spot on a parabolic tween --------
  const flights: LitterFlight[] = [];
  const startThrow = (g: SimGuest) => {
    if (g.fling) return;
    g.fling = {
      t: 0,
      released: false,
      tx: g.x + (draw(g, 12) - 0.5) * 0.5 + Math.sin(g.yaw) * 0.3,
      tz: g.z + (draw(g, 13) - 0.5) * 0.5 + Math.cos(g.yaw) * 0.3,
      seed: g.idx * 17.3 + g.decN,
    };
  };
  const _hand = new t.Vector3();
  const releaseThrow = (g: SimGuest) => {
    // hand world position: the hand ball sits at arm-local [0,-0.32,0] on the
    // arm carrying the consumable chain (right unless the right was taken)
    const arm = armOf(g, g.eatHand);
    arm.updateWorldMatrix(true, false);
    _hand.set(0, -0.32, 0).applyMatrix4(arm.matrixWorld);
    const fl = g.fling!;
    const gy = routing ? walkY(fl.tx, fl.tz) : groundAt(fl.tx, fl.tz);
    const rec = dropLitter(fl.tx, fl.tz, gy + 0.005, fl.seed);
    rec.mesh.position.copy(_hand);
    flights.push({ mesh: rec.mesh, x0: _hand.x, y0: _hand.y, z0: _hand.z, x1: fl.tx, y1: gy + 0.005, z1: fl.tz, t0: s.simTime });
    g.holding = null; // the container leaves the hand as the scraps fly
  };

  // ---- vomit: shared green droplet emitter (burst-only) + splat decals on
  // the ground, reusing the litter/poop slot machinery (cap 8, oldest reused)
  const vomitFx = buildEmitter(t, {
    max: 48, rate: 0, life: 0.7, lifeVar: 0.25,
    velocity: [0, 0.5, 0], spread: 0.55, gravity: 4.5,
    size: 0.05, sizeEnd: 0.03, color: 0x8fae4a, colorEnd: 0x5c8436, opacity: 0.9,
  });
  group.add(vomitFx.points);
  const VOMIT_CAP = 8;
  const vomits: { mesh: THREE.Group; x: number; z: number }[] = [];
  let vomitNext = 0;
  const dropVomit = (x: number, z: number, y: number) => {
    if (vomits.length < VOMIT_CAP) {
      const m = new t.Group();
      m.name = 'vomit';
      const splat = ball(t, 0.09, 0x6f8f3e, [0, 0.008, 0], { rough: 0.5 });
      splat.scale.set(1.25, 0.14, 1);
      const lump = ball(t, 0.035, 0x86a24a, [0.05, 0.014, 0.03], { rough: 0.6 });
      lump.scale.set(1, 0.4, 1);
      m.add(splat, lump);
      m.position.set(x, y, z);
      group.add(m);
      vomits.push({ mesh: m, x, z });
    } else {
      const V = vomits[vomitNext];
      vomitNext = (vomitNext + 1) % VOMIT_CAP;
      V.x = x;
      V.z = z;
      V.mesh.position.set(x, y, z);
    }
  };

  // ---- poop fallback mesh: 2 tiny stacked brown flattened balls (cap 8) -----
  const dropPoop = (x: number, z: number, y: number) => {
    if (poops.length < POOP_CAP) {
      const m = new t.Group();
      m.name = 'poop';
      const lo = ball(t, 0.05, 0x5a3a1e, [0, 0.02, 0], { rough: 0.95 });
      lo.scale.set(1, 0.55, 1);
      const hi = ball(t, 0.034, 0x4c3018, [0, 0.05, 0], { rough: 0.95 });
      hi.scale.set(1, 0.6, 1);
      m.add(lo, hi);
      m.position.set(x, y, z);
      group.add(m);
      poops.push({ mesh: m, x, z });
    } else {
      const P = poops[poopNext];
      poopNext = (poopNext + 1) % POOP_CAP;
      P.x = x;
      P.z = z;
      P.mesh.position.set(x, y, z);
    }
  };

  // ---- held consumables: one hidden mesh set per guest PER HAND, parented to
  // the arm hand pivot (hand ball at arm-local [0, -0.32, 0]) so they track
  // every swing. The hold group sits IN FRONT of the closed fist (arm-local
  // z +0.15 — fist front face is z 0.05, item back face just clear of it —
  // nudged 0.03 outboard) so the item never intersects the hand ball, forearm
  // box (z ±0.055) or torso at any point of the carry/bite cycle, yet hugs
  // the fingers at full lift; items are fist-to-head sized (head r 0.12) so
  // they read at park zoom on 0.5-scaled guests, like RCT2's sprites --------
  // the ONE definition of the corrected hand hold transform — arm-local
  // (±0.03, −0.37, 0.15), drinks pulled in to z 0.115 (slimmer, so they sit
  // nearer the fist) and the crumpled container to (…, −0.345, 0.1). Both the
  // generic meshes below and the per-stall `heldItem` clones are placed by it,
  // so a stall's themed item lands exactly where the tuned burger did.
  const holdSpot = (m: THREE.Object3D, hand: HandSlot, kind: 'food' | 'drink' | 'container') => {
    const side = hand === 'right' ? 1 : -1; // outboard nudge mirrors per hand
    m.position.set(side * 0.03, kind === 'container' ? -0.345 : -0.37, kind === 'food' ? 0.15 : kind === 'drink' ? 0.115 : 0.1);
    return m;
  };

  const ensureHeld = (g: SimGuest, hand: HandSlot) => {
    if (hand === 'right' ? g.held : g.heldL) return;
    const hold = (m: THREE.Group, kind: 'food' | 'drink' | 'container' = 'food') => {
      holdSpot(m, hand, kind);
      m.visible = false;
      armOf(g, hand).add(m);
      return m;
    };
    const food = hold(new t.Group()); // light-brown burger, fist-to-head sized
    food.name = 'heldFood';
    const bun = ball(t, 0.095, 0xd8a85e, [0, 0.052, 0], { rough: 0.8 });
    bun.scale.set(1, 0.62, 1);
    food.add(bun);
    food.add(cyl(t, 0.098, 0.098, 0.035, 0x7a4a22, [0, 0, 0], { rough: 0.9, seg: 12 })); // patty
    food.add(cyl(t, 0.088, 0.092, 0.032, 0xe2b26a, [0, -0.028, 0], { rough: 0.85, seg: 12 })); // base bun
    const drink = hold(new t.Group(), 'drink'); // red cup + straw stub
    drink.name = 'heldDrink';
    drink.add(cyl(t, 0.06, 0.048, 0.165, 0xc23028, [0, 0, 0], { rough: 0.6, seg: 12 }));
    drink.add(cyl(t, 0.01, 0.01, 0.095, 0xf0f0e8, [0.022, 0.115, 0], { rough: 0.7, seg: 6 }));
    // the container is much smaller than the burger, so the shared z 0.15
    // hold spot would leave a visible air gap ahead of the fist — its
    // holdSpot() case pulls it in to z 0.1 / y up to the hand-ball line so the
    // crumpled box sits IN the grip (rotated half-depth ~0.063 overlaps the
    // fist front at 0.05)
    const container = hold(new t.Group(), 'container'); // crumpled leftovers: smaller, grey
    container.name = 'heldContainer';
    container.add(box(t, [0.1, 0.075, 0.088], 0x9c9c94, [0, 0, 0], { rough: 0.95, rotY: 0.5 }));
    if (hand === 'right') g.held = { food, drink, container };
    else g.heldL = { food, drink, container };
  };

  // ---- PER-STALL held items (StallConfig.heldItem) ---------------------------
  // A stall may supply its OWN 3D item so its buyers carry a hot dog / a floss
  // cone / a soda can instead of the generic burger or cup. The builder runs
  // ONCE per stall (cached prototype) and every purchase gets a `clone()` —
  // three copies the little transform hierarchy but SHARES geometries and
  // materials with the prototype, so a park full of eaters costs one recipe's
  // worth of GPU resources. (Nothing is disposed on detach for exactly that
  // reason: the clone's wrappers are garbage, the shared resources are not.)
  const stallItemProto = new Map<StallRec, THREE.Group>();
  const stallItemMesh = (st: StallRec): THREE.Group | null => {
    if (!st.cfg.heldItem) return null;
    let proto = stallItemProto.get(st);
    if (!proto) {
      proto = st.cfg.heldItem(t);
      stallItemProto.set(st, proto);
    }
    return proto.clone(true);
  };

  /** attach the stall's own consumable mesh to `hand` (no-op without a
   *  `heldItem`, so the generic burger/cup keeps serving those stalls) */
  const attachStallItem = (g: SimGuest, hand: HandSlot, st: StallRec) => {
    const mesh = stallItemMesh(st);
    if (!mesh) return null;
    // an ANCHOR carrying the tuned hold transform, with the recipe as its
    // child: whatever position/rotation the builder set on its own group stays
    // an OFFSET (the floss cone tips itself forward by 0.45 rad this way)
    const anchor = new t.Group();
    anchor.name = 'heldStallItem';
    holdSpot(anchor, hand, st.cfg.item === 'drink' ? 'drink' : 'food');
    anchor.add(mesh);
    armOf(g, hand).add(anchor);
    g.heldCustom = anchor;
    return anchor;
  };

  /** the themed item leaves the hand — the meal reached the CONTAINER stage
   *  (or the guest lost the item some other way) and the generic crumpled
   *  container takes over the bin/litter lifecycle from here */
  const detachStallItem = (g: SimGuest) => {
    if (!g.heldCustom) return;
    g.heldCustom.removeFromParent();
    g.heldCustom = null;
  };

  // ---- WEARABLES (StallConfig.item 'wearable') -------------------------------
  // Same purchase→attach lifecycle as the balloon above, but parented to the
  // peep's HEAD slot instead of a hand — and with NO fly-away and no drop
  // schedule: a wearable is kept for the rest of the visit. Because it rides
  // `peep.headSlot` it needs no per-frame work at all and cannot be lost when
  // the guest boards a ride (the rig, and with it the hat, goes along).
  const attachWearable = (g: SimGuest, st: StallRec): WornItem | null => {
    if (g.worn) return null; // one head, one hat
    const mesh = stallItemMesh(st);
    if (!mesh) return null;
    const anchor = new t.Group();
    anchor.name = 'wornItem';
    anchor.add(mesh);
    g.peep.headSlot.add(anchor);
    const rec: WornItem = { group: anchor, stall: st.cfg.name, since: s.simTime };
    g.worn = rec;
    return rec;
  };

  // ---- held balloons (ACCESSORY): a string + ball rig above the hand ---------
  // RCT2 guests visibly carry bought balloons (PeepAnimationGroup::balloon,
  // Guest.cpp:6939) in a colour picked at purchase (Guest.cpp:1682-1690) — here
  // the colour is hashed deterministically per guest+hand from BALLOON_COLS.
  // The rig hangs off the hand ball; a per-frame counter-rotation keeps the
  // string pointing world-up with a gentle hashed sway (arm stays RELAXED).
  const attachBalloon = (g: SimGuest, hand: HandSlot): BalloonHold => {
    const col = BALLOON_COLS[Math.floor(hash01(g.idx * 5.77 + (hand === 'left' ? 2.13 : 8.51)) * BALLOON_COLS.length) % BALLOON_COLS.length];
    const pivot = new t.Group();
    pivot.position.set(0, -0.32, 0); // the hand ball
    pivot.add(cyl(t, 0.007, 0.007, 0.55, 0xd8d8d0, [0, 0.275, 0], { rough: 0.9, seg: 6 })); // string, straight up
    pivot.add(ball(t, 0.02, dimCol(col, 0.7), [0, 0.02, 0], { rough: 0.6 })); // knot at the fist
    const b = ball(t, 0.17, col, [0, 0.55 + 0.15, 0], { rough: 0.25, emissive: dimCol(col, 0.22) });
    b.scale.set(1, 1.15, 1); // slightly egg-shaped, matching the stand's stock
    pivot.add(b);
    armOf(g, hand).add(pivot);
    // persists ~60–120 hashed sim-s, then the DROP event (RCT2 blows held
    // balloons away on a per-tick chance, Guest.cpp:6951 — we hash a lifetime)
    const rec: BalloonHold = { pivot, ball: b, col, dropAt: s.simTime + 60 + hash01(g.idx * 12.77 + (hand === 'left' ? 5.1 : 9.3)) * 60 };
    g.balloons[hand] = rec;
    return rec;
  };

  const AIR_CAP = 10;
  const airBalloons: AirBalloon[] = [];
  let airNext = 0;
  const spawnAirBalloon = (x: number, y: number, z: number, col: number, seed: number) => {
    let a = airBalloons.find((b) => !b.active);
    if (!a && airBalloons.length < AIR_CAP) {
      const root = new t.Group();
      const strMat = new t.MeshStandardMaterial({ color: 0xd8d8d0, roughness: 0.9, transparent: true });
      const str = new t.Mesh(new t.CylinderGeometry(0.0035, 0.0035, 0.28, 6), strMat);
      str.position.set(0, -0.2, 0); // string trails below the ball
      root.add(str);
      const ballMat = new t.MeshStandardMaterial({ color: 0xffffff, roughness: 0.25, transparent: true });
      const bl = new t.Mesh(new t.SphereGeometry(0.085, 14, 10), ballMat);
      bl.scale.set(1, 1.15, 1);
      root.add(bl);
      group.add(root);
      a = { root, ball: bl, ballMat, strMat, active: false, x0: 0, y0: 0, z0: 0, t0: 0, seed: 0 };
      airBalloons.push(a);
    }
    if (!a) {
      a = airBalloons[airNext]; // pool exhausted: reuse the oldest slot
      airNext = (airNext + 1) % AIR_CAP;
    }
    a.active = true;
    a.root.visible = true;
    a.root.scale.setScalar(1);
    a.ballMat.color.setHex(col);
    a.ballMat.emissive.setHex(dimCol(col, 0.22));
    a.ballMat.opacity = 1;
    a.strMat.opacity = 1;
    a.x0 = x;
    a.y0 = y;
    a.z0 = z;
    a.t0 = s.simTime;
    a.seed = seed;
    a.root.position.set(x, y, z);
  };

  const _bpos = new t.Vector3();
  const releaseBalloon = (g: SimGuest, hand: HandSlot) => {
    const b = g.balloons[hand];
    if (!b) return;
    b.ball.getWorldPosition(_bpos); // detach exactly where the ball is
    spawnAirBalloon(_bpos.x, _bpos.y, _bpos.z, b.col, g.idx * 3.7 + s.simTime);
    armOf(g, hand).remove(b.pivot);
    g.balloons[hand] = null;
    s.balloonsFlown += 1;
    // the guest watches it go: −4 happiness and a brief sad glance UP
    g.happiness = clamp255(g.happiness - 4);
    g.happinessTarget = clamp255(g.happinessTarget - 4);
    g.glanceUpUntil = s.simTime + 1.6;
  };

  /** the world-fx per-frame pass: thrown-litter arcs, flown balloons, emitter */
  const update = (time: number, d: number) => {
    // thrown litter arcs hand → ground: 0.5 s parabolic tween, apex +0.3
    for (let i = flights.length - 1; i >= 0; i -= 1) {
      const f = flights[i];
      const u = Math.min(1, (s.simTime - f.t0) / 0.5);
      f.mesh.position.set(
        f.x0 + (f.x1 - f.x0) * u,
        f.y0 + (f.y1 - f.y0) * u + 0.3 * 4 * u * (1 - u),
        f.z0 + (f.z1 - f.z0) * u,
      );
      f.mesh.rotation.y = u * 2.6; // scraps tumble as they fly
      if (u >= 1) {
        f.mesh.rotation.y = 0;
        flights.splice(i, 1);
      }
    }
    // flown balloons: ACCELERATING buoyancy (0.25 u/s + 0.15 u/s² — RCT2
    // balloons climb steadily until they pop at altitude, Balloon.cpp:33-71;
    // ours eases out instead), hashed wind sway + drift and a slight spin;
    // above ~8 u of climb they shrink/fade and free their pool slot
    for (const b of airBalloons) {
      if (!b.active) continue;
      const a = s.simTime - b.t0;
      const h = 0.25 * a + 0.075 * a * a;
      const sway = 0.35 * Math.min(1, a * 0.4);
      b.root.position.set(
        b.x0 + Math.sin(a * 0.8 + b.seed) * sway + a * 0.05, // wind drift +x
        b.y0 + h,
        b.z0 + Math.cos(a * 0.6 + b.seed * 1.7) * sway,
      );
      b.root.rotation.y = a * 0.9; // slight spin
      b.root.rotation.z = Math.sin(a * 1.1 + b.seed) * 0.12; // sway tilt
      if (h > 8) {
        const k = 1 - (h - 8) / 2;
        if (k <= 0) {
          b.active = false; // despawned — slot returns to the pool
          b.root.visible = false;
        } else {
          b.root.scale.setScalar(k);
          b.ballMat.opacity = k;
          b.strMat.opacity = k;
        }
      }
    }
    vomitFx.update(time, d);
  };

  return {
    litter,
    poops,
    vomits,
    airBalloons,
    vomitFx,
    pushThought,
    draw,
    dropLitter,
    startThrow,
    releaseThrow,
    dropVomit,
    dropPoop,
    ensureHeld,
    attachStallItem,
    detachStallItem,
    attachWearable,
    attachBalloon,
    releaseBalloon,
    update,
  };
}

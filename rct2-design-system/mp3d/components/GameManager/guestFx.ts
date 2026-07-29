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
//
// Every one of those objects is instantiated per pool slot or PER GUEST, so
// each is built as ONE MERGED MESH PER MATERIAL out of a cached geometry (see
// the MESH RECIPES block below) — detail here is paid in draw calls hundreds of
// times over, and the recipes are exported so shot-guestfx.mjs can shoot them.
// ---------------------------------------------------------------------------

import type * as THREE from 'three';
import { cyl, mat, mergedParts, mtx } from '../Stage';
import type { MatOpts, PartSpec } from '../Stage';
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

// ---------------------------------------------------------------------------
// MESH RECIPES — every pooled / carried thing is ONE MERGED MESH per material.
//
// These are the most-instantiated objects in the park: 40 litter piles, 8
// poops, 8 vomits, 10 airborne balloons and a food / drink / container set on
// EVERY buying guest's hand (and the guest count runs into the hundreds). The
// frame budget here is DRAW CALLS, not triangles — one mesh is one draw call,
// and a mesh also costs a shadow-pass draw and a place in three's per-object
// walk — so no recipe below is a loose pile of `box()`/`ball()` primitives.
// Each is a `mergedParts` batch: the crushed cup, its rolled rim and the
// scrunched wrapper beside it are ONE mesh, and the triangles freed up by that
// are spent on making the silhouette actually readable at park zoom (RCT2's
// litter/poop sprites are recognisable SHAPES, not grey cubes).
//
// The merged geometries are CACHED per recipe key and flagged
// `userData.shared`, exactly like the Stage's box/cyl/ball cache: every guest
// in the park shares ONE bun buffer, and `disposeDeep` leaves the cache warm
// across remounts. Litter therefore has a FIXED SET of hashed VARIANTS
// (LITTER_VARS) instead of a bespoke geometry per pile — the variant and the
// tint are still hashed draws, so the world stays varied AND deterministic
// without minting 40 one-off buffers.
// ---------------------------------------------------------------------------
const _fxGeo = new Map<string, THREE.BufferGeometry>();
const fxGeo = (t: typeof THREE, key: string, parts: () => PartSpec[]): THREE.BufferGeometry => {
  let g = _fxGeo.get(key);
  if (!g) {
    // mergedParts wants a material; the geometry is all we keep from this call
    const tmp = mergedParts(t, parts(), new t.MeshBasicMaterial());
    (tmp.material as THREE.Material).dispose();
    g = tmp.geometry;
    g.userData.shared = true; // survives disposeDeep, like the Stage geo cache
    _fxGeo.set(key, g);
  }
  return g;
};
/** one merged mesh from a cached recipe: `key` identifies the GEOMETRY, while
 *  the material stays per-mesh (repo convention — materials are never shared) */
const fxMesh = (t: typeof THREE, key: string, parts: () => PartSpec[], color: number, o: MatOpts = {}) => {
  const m = new t.Mesh(fxGeo(t, key, parts), mat(t, color, o));
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
};

// ---- litter: 6 hashed variants of 2–3 pieces of RECOGNISABLE rubbish --------
// (was 2–3 identical 5 cm boxes with a random yaw, which read as gravel.) The
// menu is a crushed paper cup on its side with its rolled rim bent open, a
// scrunched foil wrapper of three folded leaves, an emptied carton with its lid
// flap standing up, and a dropped straw beside a flat cup lid.
const LITTER_TINTS = [0xb0342a, 0xc8b898, 0x9a6a30, 0xd8d4c8]; // cup / wrapper / carton / paper
const LITTER_VARS = 6;
const litterParts = (t: typeof THREE, v: number): PartSpec[] => {
  const H = (k: number) => hash01(v * 41.3 + k * 7.13 + 0.37);
  const parts: PartSpec[] = [];
  const n = 2 + Math.floor(H(1) * 2); // 2–3 pieces per pile, as before
  for (let k = 0; k < n; k += 1) {
    const ox = (H(k * 20 + 2) - 0.5) * 0.15;
    const oz = (H(k * 20 + 3) - 0.5) * 0.15;
    const yaw = H(k * 20 + 4) * Math.PI * 2;
    switch (Math.floor(H(k * 20 + 5) * 4) % 4) {
      case 0: {
        // crushed cup on its side: tapered tube squashed across its cross-
        // section (local x — rotZ π/2 lays that flat) + the rolled rim ring
        const rot: [number, number, number] = [0, yaw, Math.PI / 2 + 0.1];
        const ax = new t.Vector3(0, 1, 0).applyEuler(new t.Euler(rot[0], rot[1], rot[2], 'YXZ'));
        parts.push({ geo: new t.CylinderGeometry(0.03, 0.021, 0.07, 12), matrix: mtx(t, [ox, 0.021, oz], rot, [0.62, 1, 1]) });
        parts.push({
          geo: new t.CylinderGeometry(0.033, 0.032, 0.006, 12),
          matrix: mtx(t, [ox + ax.x * 0.036, 0.021 + ax.y * 0.036, oz + ax.z * 0.036], rot, [0.62, 1, 1]),
        });
        break;
      }
      case 1: {
        // scrunched wrapper: three thin leaves folded across each other
        for (let p = 0; p < 3; p += 1)
          parts.push({
            geo: new t.BoxGeometry(0.05, 0.006, 0.042),
            matrix: mtx(
              t,
              [ox + (H(k * 20 + 6 + p) - 0.5) * 0.028, 0.006 + p * 0.008, oz + (H(k * 20 + 9 + p) - 0.5) * 0.028],
              [(H(k * 20 + 12 + p) - 0.5) * 1.1, yaw + p * 1.05, (H(k * 20 + 15 + p) - 0.5) * 1.1],
            ),
          });
        break;
      }
      case 2: {
        // emptied carton, lid flap hinged OPEN (composed off the body matrix so
        // the flap follows the carton's yaw instead of floating beside it)
        const base = mtx(t, [ox, 0.013, oz], [0.06, yaw, 0.05]);
        parts.push({ geo: new t.BoxGeometry(0.052, 0.026, 0.04), matrix: base });
        parts.push({ geo: new t.BoxGeometry(0.052, 0.004, 0.034), matrix: base.clone().multiply(mtx(t, [0, 0.019, -0.021], [-1.15, 0, 0])) });
        break;
      }
      default: {
        // dropped straw + the flat lid it came off
        parts.push({ geo: new t.CylinderGeometry(0.0035, 0.0035, 0.088, 6), matrix: mtx(t, [ox, 0.0045, oz], [0, yaw, Math.PI / 2]) });
        parts.push({ geo: new t.CylinderGeometry(0.023, 0.023, 0.005, 12), matrix: mtx(t, [ox + 0.03, 0.004, oz - 0.02], [0.22, yaw, 0.1]) });
      }
    }
  }
  return parts;
};
/** a hashed litter pile — a Group (the throw tween owns its transform) holding
 *  exactly ONE mesh, down from the 2–3 it used to hold */
export function buildLitterMesh(t: typeof THREE, seed: number): THREE.Group {
  const g = new t.Group();
  g.name = 'litter';
  const v = Math.floor(hash01(seed * 1.93 + 0.11) * LITTER_VARS) % LITTER_VARS;
  const tint = LITTER_TINTS[Math.floor(hash01(seed * 3.7) * LITTER_TINTS.length) % LITTER_TINTS.length];
  g.add(fxMesh(t, `litter:${v}`, () => litterParts(t, v), tint, { rough: 0.9, flat: true }));
  return g;
}

// ---- poop: the RCT2 silhouette — a tapering COIL of three squashed rings on
// a ground smear, capped with a little peak (was two stacked brown balls, which
// read as a pebble). One mesh.
const poopParts = (t: typeof THREE): PartSpec[] => {
  const sph = new t.SphereGeometry(1, 12, 8);
  const parts: PartSpec[] = [
    { geo: sph, matrix: mtx(t, [0, 0.007, 0], [0, 0.3, 0], [0.062, 0.011, 0.052]) }, // smear on the path
    { geo: sph, matrix: mtx(t, [0, 0.03, 0], [0, 0, 0], [0.032, 0.03, 0.03]) }, // core, so the coil has no hole
  ];
  for (const [R, r, y, yaw] of [
    [0.046, 0.017, 0.021, 0.0],
    [0.036, 0.0155, 0.045, 0.7],
    [0.025, 0.0135, 0.065, 1.5],
  ] as [number, number, number, number][])
    parts.push({ geo: new t.TorusGeometry(R, r, 7, 16), matrix: mtx(t, [0, y, 0], [Math.PI / 2, yaw, 0], [1, 1, 0.88]) });
  parts.push({ geo: new t.ConeGeometry(0.014, 0.03, 9), matrix: mtx(t, [0.005, 0.084, 0], [0, 0, -0.4]) });
  return parts;
};
/** a poop slot: a Group (the pool moves its transform) holding ONE mesh */
export function buildPoopMesh(t: typeof THREE): THREE.Group {
  const g = new t.Group();
  g.name = 'poop';
  g.add(fxMesh(t, 'poop', () => poopParts(t), 0x55391b, { rough: 0.72 }));
  return g;
}

// ---- vomit: a wet puddle with three splash lobes creeping out of it and two
// chunks (was one squashed ball + one lump). One mesh; the green DROPLET burst
// is the shared ParticleKit emitter, not geometry.
const vomitParts = (t: typeof THREE): PartSpec[] => {
  const sph = new t.SphereGeometry(1, 14, 9);
  const lo = new t.SphereGeometry(1, 6, 4);
  const parts: PartSpec[] = [{ geo: sph, matrix: mtx(t, [0, 0.006, 0], [0, 0.2, 0], [0.105, 0.011, 0.082]) }];
  for (const [x, z, r] of [
    [0.085, 0.02, 0.036],
    [-0.06, 0.062, 0.03],
    [0.02, -0.085, 0.026],
  ] as [number, number, number][])
    parts.push({ geo: lo, matrix: mtx(t, [x, 0.005, z], [0, x * 9, 0], [r, 0.008, r * 0.85]) });
  parts.push({ geo: lo, matrix: mtx(t, [0.03, 0.012, 0.02], [0, 0.4, 0], [0.026, 0.013, 0.022]) });
  parts.push({ geo: lo, matrix: mtx(t, [-0.028, 0.011, -0.014], [0, 1.1, 0], [0.02, 0.011, 0.018]) });
  return parts;
};
/** a vomit slot: a Group (the pool moves its transform) holding ONE mesh */
export function buildVomitMesh(t: typeof THREE): THREE.Group {
  const g = new t.Group();
  g.name = 'vomit';
  g.add(fxMesh(t, 'vomit', () => vomitParts(t), 0x7a9a42, { rough: 0.32 }));
  return g;
}

// ---- the held BURGER: three meshes, the same count as the old bun/patty/base
// stack, but each is now a merged batch — a SEEDED crown (six same-tint bumps,
// which read as sesame in the shading without a fourth material), a hand-formed
// patty with an uneven grilled edge that overhangs the bun, and a LETTUCE FRILL
// peeking out of the seam. The green frill is what makes it read as a burger
// rather than a beige lump at park zoom.
const bunParts = (t: typeof THREE): PartSpec[] => {
  const sph = new t.SphereGeometry(1, 16, 10);
  const lo = new t.SphereGeometry(1, 6, 4);
  const parts: PartSpec[] = [
    { geo: sph, matrix: mtx(t, [0, 0.048, 0], [0, 0, 0], [0.093, 0.064, 0.093]) }, // crown
    { geo: new t.CylinderGeometry(0.088, 0.081, 0.032, 16), matrix: mtx(t, [0, -0.03, 0]) }, // heel
    { geo: sph, matrix: mtx(t, [0, -0.042, 0], [0, 0, 0], [0.081, 0.016, 0.081]) }, // rounded base
  ];
  for (let i = 0; i < 6; i += 1) {
    const a = i * 1.047 + 0.3;
    const rr = 0.028 + (i % 2) * 0.026;
    parts.push({ geo: lo, matrix: mtx(t, [Math.cos(a) * rr, 0.104 - rr * rr * 2.4, Math.sin(a) * rr], [0, a, 0], [0.008, 0.004, 0.005]) });
  }
  return parts;
};
const pattyParts = (t: typeof THREE): PartSpec[] => {
  const lo = new t.SphereGeometry(1, 6, 4);
  const parts: PartSpec[] = [{ geo: new t.CylinderGeometry(0.099, 0.096, 0.03, 16), matrix: mtx(t, [0, -0.006, 0]) }];
  for (let i = 0; i < 6; i += 1) {
    const a = i * 1.047;
    parts.push({ geo: lo, matrix: mtx(t, [Math.cos(a) * 0.095, -0.006, Math.sin(a) * 0.095], [0, a, 0], [0.022, 0.016, 0.014]) });
  }
  return parts;
};
const lettuceParts = (t: typeof THREE): PartSpec[] => {
  const lo = new t.SphereGeometry(1, 6, 4);
  const parts: PartSpec[] = [];
  for (let i = 0; i < 8; i += 1) {
    const a = i * 0.785 + 0.2;
    parts.push({
      geo: lo,
      matrix: mtx(t, [Math.cos(a) * 0.088, -0.021 + (i % 2) * 0.006, Math.sin(a) * 0.088], [i % 2 ? 0.4 : -0.35, a, 0.25], [0.03, 0.007, 0.022]),
    });
  }
  return parts;
};

// ---- the held DRINK: two meshes, as before, but now a proper LIDDED cup —
// tapered body with a rolled rim, a base ring and a printed band (one red
// mesh), and the lid + straw as the second (one cream mesh). The old version
// was a bare tapered tube with a white stick poking out of the open top.
const cupParts = (t: typeof THREE): PartSpec[] => [
  { geo: new t.CylinderGeometry(0.055, 0.039, 0.148, 16), matrix: mtx(t, [0, 0, 0]) },
  { geo: new t.CylinderGeometry(0.058, 0.055, 0.014, 16), matrix: mtx(t, [0, 0.071, 0]) }, // rolled rim
  { geo: new t.CylinderGeometry(0.042, 0.042, 0.009, 16), matrix: mtx(t, [0, -0.072, 0]) }, // base ring
  { geo: new t.TorusGeometry(0.049, 0.004, 5, 16), matrix: mtx(t, [0, 0.012, 0], [Math.PI / 2, 0, 0]) }, // printed band
];
const lidParts = (t: typeof THREE): PartSpec[] => [
  { geo: new t.CylinderGeometry(0.061, 0.059, 0.013, 16), matrix: mtx(t, [0, 0.083, 0]) }, // lid skirt
  { geo: new t.CylinderGeometry(0.05, 0.058, 0.008, 16), matrix: mtx(t, [0, 0.093, 0]) }, // domed top
  { geo: new t.CylinderGeometry(0.008, 0.008, 0.088, 8), matrix: mtx(t, [0.016, 0.128, 0], [0, 0, -0.2]) }, // straw
];

// ---- the leftovers CONTAINER: still ONE mesh, but a genuinely CRUSHED carton
// — a stamped-flat base with two collapsed leaves folded over it and a corner
// that survived — instead of a single rotated grey cube.
const containerParts = (t: typeof THREE): PartSpec[] => {
  const base = mtx(t, [0, -0.012, 0], [0.1, 0.5, -0.07]);
  return [
    { geo: new t.BoxGeometry(0.086, 0.022, 0.072), matrix: base },
    { geo: new t.BoxGeometry(0.078, 0.006, 0.058), matrix: base.clone().multiply(mtx(t, [0.004, 0.016, 0.006], [0.45, 0.35, 0.28])) },
    { geo: new t.BoxGeometry(0.058, 0.006, 0.05), matrix: base.clone().multiply(mtx(t, [-0.012, 0.03, -0.008], [-0.6, 0.9, 0.4])) },
    { geo: new t.BoxGeometry(0.03, 0.026, 0.028), matrix: base.clone().multiply(mtx(t, [0.03, 0.02, -0.018], [0.3, 1.1, 0.25])) },
  ];
};

// the three GENERIC consumables, each a Group of merged meshes at the hold
// origin — `ensureHeld` only has to place and hide them. Exported so the render
// harness can shoot the recipes in fixed orthographic views without standing up
// a whole sim (a held item can otherwise only be seen on a walking guest).
/** burger: 3 meshes (bun / patty / lettuce) */
export function buildHeldFood(t: typeof THREE): THREE.Group {
  const g = new t.Group();
  g.name = 'heldFood';
  g.add(fxMesh(t, 'bun', () => bunParts(t), 0xd9a961, { rough: 0.78 })); // crown + heel + sesame
  g.add(fxMesh(t, 'patty', () => pattyParts(t), 0x6b3d1b, { rough: 0.85 })); // overhanging grilled patty
  g.add(fxMesh(t, 'lettuce', () => lettuceParts(t), 0x74a53f, { rough: 0.7 })); // frill in the seam
  return g;
}
/** lidded soda cup: 2 meshes (red cup / cream lid + straw) */
export function buildHeldDrink(t: typeof THREE): THREE.Group {
  const g = new t.Group();
  g.name = 'heldDrink';
  g.add(fxMesh(t, 'cup', () => cupParts(t), 0xc23028, { rough: 0.55 }));
  g.add(fxMesh(t, 'lid', () => lidParts(t), 0xf2efe6, { rough: 0.5 }));
  return g;
}
/** crushed leftovers carton: 1 mesh */
export function buildHeldContainer(t: typeof THREE): THREE.Group {
  const g = new t.Group();
  g.name = 'heldContainer';
  g.add(fxMesh(t, 'container', () => containerParts(t), 0x9c9c94, { rough: 0.92, flat: true }));
  return g;
}

/**
 * the balloon SILHOUETTE in ONE mesh: a pear body, a tapered NECK and the tied
 * nub at its tip, so it reads as an inflated balloon on a string rather than a
 * ball floating above a stick. `r` is the equatorial radius (0.17 held, 0.085
 * airborne) and the whole profile scales with it; the neck tip lands at
 * −1.265·r, which is where the string top should meet it. The caller owns the
 * material because the airborne pool ANIMATES colour and opacity on it.
 */
export function buildBalloonBody(t: typeof THREE, r: number, material: THREE.Material): THREE.Mesh {
  const k = r / 0.17;
  const m = new t.Mesh(
    fxGeo(t, `balloon:${r}`, () => {
      const sph = new t.SphereGeometry(1, 16, 12);
      return [
        { geo: sph, matrix: mtx(t, [0, 0.03 * k, 0], [0, 0, 0], [0.168 * k, 0.185 * k, 0.168 * k]) },
        // cone flipped apex-DOWN (rotZ π is a rotation, so normals stay out)
        { geo: new t.ConeGeometry(0.055 * k, 0.105 * k, 12), matrix: mtx(t, [0, -0.145 * k, 0], [0, 0, Math.PI]) },
        { geo: sph, matrix: mtx(t, [0, -0.2 * k, 0], [0, 0, 0], [0.017 * k, 0.021 * k, 0.017 * k]) }, // the knot
      ];
    }),
    material,
  );
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

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
      const m = buildLitterMesh(t, seed); // one merged mesh: cup / wrapper / carton / straw
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
      const m = buildVomitMesh(t); // wet puddle + lobes + chunks, ONE mesh
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

  // ---- poop fallback mesh: ONE merged tapering coil on a smear (cap 8) ------
  const dropPoop = (x: number, z: number, y: number) => {
    if (poops.length < POOP_CAP) {
      const m = buildPoopMesh(t);
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
    const food = hold(buildHeldFood(t)); // seeded burger, fist-to-head sized
    const drink = hold(buildHeldDrink(t), 'drink'); // lidded red cup + straw
    // the container is much smaller than the burger, so the shared z 0.15
    // hold spot would leave a visible air gap ahead of the fist — its
    // holdSpot() case pulls it in to z 0.1 / y up to the hand-ball line so the
    // crumpled box sits IN the grip (rotated half-depth ~0.052 overlaps the
    // fist front at 0.05)
    const container = hold(buildHeldContainer(t), 'container'); // crushed leftovers: smaller, grey
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
    pivot.add(cyl(t, 0.006, 0.006, 0.55, 0xd8d8d0, [0, 0.275, 0], { rough: 0.9, seg: 6 })); // string, straight up
    // pear body + tapered neck + tied knot, ONE mesh (the old separate knot ball
    // at the fist is gone — the knot belongs at the balloon's neck, and it now
    // sits exactly where the string ends, so the rig reads as tied rather than
    // as a ball hovering over a stick)
    const b = buildBalloonBody(t, 0.17, mat(t, col, { rough: 0.25, emissive: dimCol(col, 0.22) }));
    b.position.set(0, 0.55 + 0.17 * 1.265, 0);
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
      const bl = buildBalloonBody(t, 0.085, ballMat); // same pear+neck recipe, half size
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

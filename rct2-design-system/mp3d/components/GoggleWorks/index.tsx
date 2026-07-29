import * as THREE from 'three';
import { box, cyl, ball, mergedBoxes, nightKOf } from '../Stage';
import type { MergedBoxSpec } from '../Stage';
import { buildEmitter } from '../ParticleKit';
import { buildPeep } from '../Guest';
import { composableStall } from '../Park';

// ---------------------------------------------------------------------------
// THE GOGGLE WORKS — the BRASSWORK FOUNDRY world's steampunk optician's stall,
// and the system's first real WEARABLE shop (GameManager `item: 'wearable'`):
// customers walk away with a pair of brass aviator goggles ON THEIR HEAD, worn
// for the rest of the visit.
//
// The building is a riveted brass-and-copper panel kiosk: a verdigris-stained
// copper roof over the BACK of the counter (a full-depth roof reads as a lid at
// the isometric camera elevation and hides the whole shop), a treadle-driven
// LENS-GRINDING WHEEL turning on the counter behind its flat leather belt, a
// patinated copper BOILER venting steam through the roof, three live pressure
// GAUGES bolted to the front panel where the customer can see them, a felt tray
// of lens blanks, a display rack of finished goggles hanging under the roof edge,
// a brass gaslight on a curved bracket, an engraved nameplate, and (RCT2-style,
// the building says what it sells) one heroic pair of goggles as the shop sign.
//
// PALETTE: SetPieceKit's BRASSWORK_FOUNDRY theme — soot-grey iron, muted brass,
// oxidised copper, verdigris, oiled leather, warm gaslight (0xfff0cc / glow
// 0xffb050). Deliberately NO garish gold: brass is a dull yellow-brown metal and
// reads as metal through roughness and rivet detail, not through saturation.
// METALNESS CAUTION: a MeshStandardMaterial at metalness 0.6+ with no env map
// renders almost black (metals are lit only by reflections) — every metal here
// sits in the 0.2-0.35 band, which is what makes the brass read as brass.
//
// Budgets: 2 real PointLights (gaslight + counter fill, both night-gated — no
// molten anything here, so both go fully dark by day), 26 particles (the relief
// valve's steam wisp, released ABOVE the roof), static repeats through
// `mergedBoxes`, rivets/gauge ticks/patina/engraving tagged
// `userData.lodDetail`. Deterministic — hashed sines only, no Math.random /
// Date.now; every updater takes ABSOLUTE time.
// ---------------------------------------------------------------------------

const hash01 = (n: number) => {
  const s = Math.sin(n * 12.9898 + 78.233) * 43758.5453;
  return s - Math.floor(s);
};

// ---- the Brasswork Foundry metals ------------------------------------------
const BRASS = 0xa8863f; // muted brass — a dull yellow-brown, never gold
const BRASS_D = 0x7a6030; // shadowed brass / castings
const BRASS_L = 0xc7a962; // polished brass highlights (rims, bezels)
const COPPER = 0x8a5533; // oxidised copper sheet (warm brown, not terracotta)
const VERDIGRIS = 0x3a5340; // the patina staining the copper (muted green, not a teal stripe)
const IRON = 0x554533; // the theme's soot-grey ironwork
const IRON_D = 0x312a22; // deep soot
const LEATHER = 0x5a3f24; // strap leather
const LEATHER_D = 0x3c2a18;
const GLASS = 0x86aab4; // goggle lens: pale grey-blue, low roughness
const DIAL = 0xe8e0cc; // gauge dial face
const STONE = 0x6d7176; // the grinding wheel's carborundum

// ===========================================================================
// THE GOGGLES — ONE recipe, used at three scales: worn on a guest's head, hung
// on the display rack and blown up into the shop sign. Origin between the two
// lenses, +z = the FACE direction (the way the wearer looks), so the caller
// only has to place it. Built in units where the lens spacing is ~0.116 — i.e.
// PEEP-LOCAL (skull r 0.12) — and scaled up by the props.
// ===========================================================================
/** the brow offset buildWornGoggles applies, INVERTED — added to the strap's own
 *  sub-group so the band is concentric with the SKULL rather than with the
 *  goggles (see gogglesMesh). Kept in one place so the two can never drift. */
const BROW_DROP = { x: 0, y: -0.068, z: 0.012 };
let _strapToHead: THREE.Vector3 | null = null;
function strapToHead(t: typeof THREE): THREE.Vector3 {
  if (!_strapToHead) _strapToHead = new t.Vector3(-BROW_DROP.x, -BROW_DROP.y, -BROW_DROP.z);
  return _strapToHead;
}

function gogglesMesh(t: typeof THREE, o: { strap?: boolean } = {}): THREE.Group {
  const g = new t.Group();
  const withStrap = o.strap ?? true;
  const STRAP_TO_HEAD = strapToHead(t);
  [-1, 1].forEach((sgn) => {
    const x = sgn * 0.058;
    // the CUP: a short brass barrel standing off the face, stepped so it reads
    // as a machined rim rather than a washer
    g.add(cyl(t, 0.05, 0.046, 0.03, BRASS, [x, 0, 0.088], { tex: 'metal', repeat: [4, 1], metal: 0.3, rough: 0.42, seg: 14, rotX: Math.PI / 2 }));
    g.add(cyl(t, 0.052, 0.052, 0.012, BRASS_L, [x, 0, 0.105], { tex: 'metal', repeat: [4, 1], metal: 0.34, rough: 0.3, seg: 14, rotX: Math.PI / 2 })); // bezel ring
    // the LENS: slightly domed glass, sunk just inside the bezel
    const lens = ball(t, 0.043, GLASS, [x, 0, 0.104], { rough: 0.12, metal: 0.12 });
    lens.scale.set(1, 1, 0.36);
    g.add(lens);
    // leather gasket where the cup meets the face
    g.add(cyl(t, 0.049, 0.054, 0.016, LEATHER, [x, 0, 0.07], { tex: 'fabric', repeat: [4, 1], rough: 0.9, seg: 14, rotX: Math.PI / 2 }));
    // the little brass focus knob on the outboard side of each cup
    g.add(cyl(t, 0.009, 0.011, 0.022, BRASS_L, [x + sgn * 0.052, 0.006, 0.09], { metal: 0.33, rough: 0.32, seg: 8, rotZ: Math.PI / 2 }));
  });
  // the BRIDGE: a brass strap over the nose with two rivets
  g.add(box(t, [0.038, 0.016, 0.026], BRASS, [0, 0.002, 0.092], { tex: 'metal', repeat: [2, 1], metal: 0.28, rough: 0.42 }));
  const bits: MergedBoxSpec[] = [
    { dims: [0.008, 0.008, 0.008], pos: [-0.012, 0.012, 0.092] },
    { dims: [0.008, 0.008, 0.008], pos: [0.012, 0.012, 0.092] },
  ];
  // the SIDE BUCKLES: a leather tab, a brass plate and a pin per side
  [-1, 1].forEach((sgn) => {
    g.add(box(t, [0.024, 0.03, 0.02], LEATHER_D, [sgn * 0.104, -0.002, 0.06], { tex: 'fabric', repeat: [1, 1], rough: 0.9, rotY: sgn * 0.35 }));
    g.add(box(t, [0.014, 0.026, 0.016], BRASS_L, [sgn * 0.114, -0.002, 0.046], { tex: 'metal', repeat: [1, 1], metal: 0.33, rough: 0.32, rotY: sgn * 0.35 })); // buckle plate
    bits.push({ dims: [0.006, 0.014, 0.006], pos: [sgn * 0.114, -0.002, 0.052] }); // buckle pin
  });
  // 0.33, matching the bezel ring beside them — NOT 0.75. This file's own rule
  // is a 0.2-0.35 metalness band (no env map in this Stage, so a metal is lit
  // only by reflections and 0.6+ renders near-black), and these two rivet
  // meshes were the only things in the shop breaking it. They are the goggles'
  // brow rivets and buckle pins, i.e. the recipe used for the WORN pair, the
  // three display pairs and the roof sign, so the near-black was on the shop's
  // signature article. Found by measuring every material in the built group
  // (probe: /tmp/mp3d-render/aud-brass-geom.tsx).
  const rivets = mergedBoxes(t, bits, BRASS_L, { tex: 'metal', repeat: [1, 1], metal: 0.33, rough: 0.28 });
  rivets.userData.lodDetail = true; // rivets and pins: close-up only
  g.add(rivets);
  if (withStrap) {
    // THE STRAP: a leather band running AROUND the skull from one buckle to the
    // other. It gets its OWN sub-group, pushed back up to the SKULL CENTRE
    // (`STRAP_TO_HEAD`, the inverse of buildWornGoggles' brow offset), because a
    // band centred on the goggles is not concentric with the head — sunk inside
    // the skull it simply vanishes (the first pass did exactly that). A PARTIAL
    // torus (arc 4.4 rad) leaves the front open where the cups are, and the
    // rotation.z spins that gap round to the face; the small x-tilt lets the band
    // ride up over the back of the skull.
    const strapG = new t.Group();
    strapG.position.copy(STRAP_TO_HEAD);
    strapG.rotation.set(Math.PI / 2 + 0.14, 0, 2.51); // XYZ order: the z spin runs FIRST, inside the band's own plane
    const strap = new t.Mesh(
      new t.TorusGeometry(0.126, 0.011, 6, 20, 4.4),
      new t.MeshStandardMaterial({ color: LEATHER, roughness: 0.92, metalness: 0 }),
    );
    strap.castShadow = true;
    strapG.add(strap);
    g.add(strapG);
    // the adjuster slider, on the back of the band. Its sub-group is at the SKULL
    // CENTRE too, so these really are head-local coordinates: at y 0.02 the skull
    // radius is 0.118, and z −0.126 puts the slider just proud of it. (Placed
    // inside the strap group's own offset frame it flew off the back of the head.)
    const slider = new t.Group();
    slider.position.copy(STRAP_TO_HEAD);
    slider.add(box(t, [0.032, 0.022, 0.016], BRASS_D, [0, 0.02, -0.126], { metal: 0.28, rough: 0.45, rotX: -0.16 }));
    g.add(slider);
  }
  return g;
}

// ---- the WORN goggles (GameManager StallConfig.heldItem, item 'wearable') ---
// The manager parents this group to the peep's `headSlot` — a group on the CROWN
// of the skull (head-local (0, 0.10, 0), +z = the face, skull r 0.12), which
// rides every nod, mood tilt and head bob and cannot be lost when the guest is
// hidden in a hut or seated on a ride.
//
// GOGGLES SIT ON THE BROW, not on the crown, so the recipe takes its OWN offset
// (the manager keeps a builder's transform as an offset from the anchor): DOWN
// 0.068 and FORWARD 0.012, which puts the lens centres at head-local y ≈ 0.032,
// z ≈ 0.10 — the skull surface at that height is z ≈ 0.1156, so the leather
// gaskets press into the face and the bezels stand just proud of it. Peep-local
// units throughout: the park's 0.5 GUEST_SCALE is applied by the guest rig, so
// nothing here is pre-scaled.
export function buildWornGoggles(three: typeof THREE): THREE.Group {
  const t = three;
  const g = new t.Group();
  g.position.set(BROW_DROP.x, BROW_DROP.y, BROW_DROP.z);
  g.rotation.x = -0.08; // the cups tip very slightly up, following the brow
  g.add(gogglesMesh(t));
  return g;
}

export interface GoggleWorksOpts {
  /** add the decorative browsing guest (preview flavour — in a composed park
   *  the GameManager's real guests walk up instead; default false) */
  withGuest?: boolean;
  /** the relief valve's steam wisp (default true) */
  effects?: boolean;
}

export interface GoggleWorksBuilt {
  group: THREE.Group;
  update: (time: number) => void;
  dispose: () => void;
}

/** the Goggle Works kiosk. Group origin on the ground at the counter's centre;
 *  the SERVING FRONT faces local +z. */
export function buildGoggleWorks(three: typeof THREE, opts: GoggleWorksOpts = {}): GoggleWorksBuilt {
  const t = three;
  const g = new t.Group();
  const wantFx = opts.effects ?? true;

  // =========================================================================
  // SCALE NOTE: sized against a 0.5-scale park guest (≈ 0.55 u tall), exactly
  // like the four catalog shops — counter top at y 0.50, roof plate at 0.98,
  // goggles sign topping out at 1.33. (The first pass was modelled at twice
  // this height and the customers could not see over the counter.)
  // =========================================================================

  // =========================================================================
  // 1. THE RIVETED KIOSK — a soot-iron carcass panelled in brass and copper
  //    sheet. Core: x ±0.8, z −0.5…0.45, y 0.02…0.46.
  // =========================================================================
  g.add(box(t, [1.7, 0.06, 1.04], IRON_D, [0, 0.03, -0.02], { tex: 'metal', repeat: [6, 1], metal: 0.2, rough: 0.72 })); // plinth
  g.add(box(t, [1.6, 0.44, 0.95], IRON, [0, 0.24, -0.02], { tex: 'metal', repeat: [6, 2], metal: 0.18, rough: 0.78 }));
  // brass panels on the front and both ends, standing 0.03 proud of the carcass
  [-0.38, 0.38].forEach((x) => g.add(box(t, [0.66, 0.22, 0.03], BRASS, [x, 0.31, 0.465], { tex: 'metal', repeat: [4, 2], metal: 0.26, rough: 0.5 })));
  // copper skirt panel under the counter front, with verdigris streaks
  g.add(box(t, [1.5, 0.14, 0.03], COPPER, [0, 0.14, 0.465], { tex: 'metal', repeat: [6, 1], metal: 0.22, rough: 0.62 }));
  const streaks: MergedBoxSpec[] = [];
  for (let i = 0; i < 9; i += 1) {
    const x = -0.66 + i * 0.165 + (hash01(i * 3.7) - 0.5) * 0.04;
    const h = 0.04 + hash01(i * 5.1) * 0.07;
    streaks.push({ dims: [0.024 + hash01(i * 7.9) * 0.022, h, 0.012], pos: [x, 0.09 + h / 2, 0.482] });
  }
  const streakMesh = mergedBoxes(t, streaks, VERDIGRIS, { tex: 'concrete', repeat: [1, 1], rough: 0.85, bump: 0.02 });
  streakMesh.userData.lodDetail = true; // patina staining: close-up only
  g.add(streakMesh);
  // end panels
  [-1, 1].forEach((sgn) => {
    g.add(box(t, [0.03, 0.22, 0.8], BRASS, [sgn * 0.815, 0.31, -0.02], { tex: 'metal', repeat: [4, 2], metal: 0.26, rough: 0.5 }));
    g.add(box(t, [0.03, 0.14, 0.8], COPPER, [sgn * 0.815, 0.14, -0.02], { tex: 'metal', repeat: [4, 1], metal: 0.22, rough: 0.62 }));
  });
  // RIVET rows along every panel edge — the detail that says "riveted plate"
  const rivets: MergedBoxSpec[] = [];
  for (let i = 0; i < 15; i += 1) {
    const x = -0.7 + i * 0.1;
    rivets.push({ dims: [0.018, 0.018, 0.014], pos: [x, 0.415, 0.482] }); // under the counter nosing
    rivets.push({ dims: [0.018, 0.018, 0.014], pos: [x, 0.205, 0.482] }); // the copper/brass seam
  }
  for (let i = 0; i < 7; i += 1) {
    const z = -0.36 + i * 0.12;
    [-1, 1].forEach((sgn) => rivets.push({ dims: [0.014, 0.018, 0.018], pos: [sgn * 0.832, 0.415, z] }));
  }
  const rivetMesh = mergedBoxes(t, rivets, BRASS_L, { tex: 'metal', repeat: [1, 1], metal: 0.34, rough: 0.32 });
  rivetMesh.userData.lodDetail = true; // rivet heads: close-up only
  g.add(rivetMesh);

  // ---- the counter: oiled wood top with a brass nosing (y 0.45 → 0.50) ----
  g.add(box(t, [1.72, 0.05, 1.02], 0x4e3822, [0, 0.475, 0.0], { tex: 'wood', repeat: [7, 4], rough: 0.68, bump: 0.02 }));
  g.add(box(t, [1.72, 0.035, 0.05], BRASS_L, [0, 0.487, 0.5], { tex: 'metal', repeat: [8, 1], metal: 0.33, rough: 0.34 })); // nosing
  // a felt-lined tray of lens blanks let into the counter, right of centre
  g.add(box(t, [0.36, 0.02, 0.2], 0x2e2a30, [0.4, 0.508, 0.24], { tex: 'fabric', repeat: [3, 2], rough: 0.95 }));
  for (let i = 0; i < 6; i += 1) {
    const l = cyl(t, 0.026, 0.026, 0.01, GLASS, [0.28 + (i % 3) * 0.12, 0.522, 0.19 + Math.floor(i / 3) * 0.1], { rough: 0.14, metal: 0.12, seg: 12 });
    l.userData.lodDetail = true;
    g.add(l);
  }

  // =========================================================================
  // 2. THE LENS-GRINDING WHEEL — a carborundum disc on a brass axle, driven by
  //    a flat leather belt off a hand-cranked flywheel. It SPINS.
  // =========================================================================
  const grinder = new t.Group();
  grinder.position.set(-0.44, 0.5, 0.04);
  g.add(grinder);
  // cast frame: two brass standards carrying the axle
  [-0.09, 0.09].forEach((z) => {
    grinder.add(box(t, [0.045, 0.17, 0.04], BRASS_D, [0, 0.085, z], { tex: 'metal', repeat: [1, 2], metal: 0.26, rough: 0.5 }));
    grinder.add(box(t, [0.1, 0.02, 0.08], BRASS_D, [0, 0.01, z], { tex: 'metal', repeat: [2, 1], metal: 0.26, rough: 0.5 })); // foot
  });
  grinder.add(cyl(t, 0.01, 0.01, 0.24, BRASS_L, [0, 0.17, 0], { metal: 0.33, rough: 0.32, seg: 10, rotZ: Math.PI / 2 })); // the axle, along X
  // the wheel itself: a grey stone disc with a brass hub, spinning about X
  const wheel = new t.Group();
  wheel.position.set(0, 0.17, 0);
  grinder.add(wheel);
  wheel.add(cyl(t, 0.085, 0.085, 0.03, STONE, [0, 0, 0], { tex: 'concrete', repeat: [6, 1], rough: 0.95, bump: 0.04, seg: 20, rotZ: Math.PI / 2 }));
  wheel.add(cyl(t, 0.03, 0.03, 0.042, BRASS, [0, 0, 0], { tex: 'metal', repeat: [3, 1], metal: 0.28, rough: 0.42, seg: 12, rotZ: Math.PI / 2 })); // hub
  [-1, 1].forEach((sgn) => wheel.add(cyl(t, 0.016, 0.016, 0.01, BRASS_L, [sgn * 0.024, 0, 0], { metal: 0.34, rough: 0.3, seg: 10, rotZ: Math.PI / 2 }))); // hub caps
  // a water trough under the wheel and a brass tool rest in front of it
  grinder.add(box(t, [0.19, 0.04, 0.13], IRON_D, [0, 0.04, 0], { tex: 'metal', repeat: [2, 1], metal: 0.2, rough: 0.7 }));
  grinder.add(box(t, [0.15, 0.014, 0.05], BRASS_L, [0, 0.115, 0.075], { tex: 'metal', repeat: [2, 1], metal: 0.32, rough: 0.36, rotX: -0.25 }));
  // the flywheel down the side of the kiosk
  const fly = new t.Group();
  fly.position.set(-0.7, 0.26, 0.04);
  g.add(fly);
  fly.add(cyl(t, 0.1, 0.1, 0.025, IRON, [0, 0, 0], { tex: 'metal', repeat: [6, 1], metal: 0.24, rough: 0.55, seg: 18, rotZ: Math.PI / 2 }));
  fly.add(cyl(t, 0.026, 0.026, 0.04, BRASS, [0, 0, 0], { tex: 'metal', repeat: [2, 1], metal: 0.28, rough: 0.42, seg: 10, rotZ: Math.PI / 2 }));
  for (let i = 0; i < 4; i += 1) fly.add(box(t, [0.014, 0.18, 0.014], IRON, [0, 0, 0], { tex: 'metal', repeat: [1, 2], metal: 0.24, rough: 0.55, rotX: (i / 4) * Math.PI })); // spokes
  // the crank pin rides ON the flywheel, so it simply turns with it
  fly.add(cyl(t, 0.009, 0.009, 0.07, BRASS_L, [-0.024, 0.065, 0], { metal: 0.33, rough: 0.34, seg: 8, rotZ: Math.PI / 2 }));
  fly.add(box(t, [0.014, 0.035, 0.014], BRASS_D, [-0.024, 0.035, 0], { metal: 0.28, rough: 0.42 })); // pin web
  // THE FLAT BELT: the two TANGENT runs between the flywheel (centre (−0.7,
  // 0.26), r 0.1) and the grinding wheel (centre (−0.44, 0.67), r 0.085) —
  // offset ±0.093 along the line's normal, so each strap leaves one rim and
  // lands on the other instead of cutting straight through both hubs
  {
    const ax = -0.7;
    const ay = 0.26;
    const bx = -0.44;
    const by = 0.67;
    const dx = bx - ax;
    const dy = by - ay;
    const len = Math.hypot(dx, dy);
    const nx = dy / len;
    const ny = -dx / len;
    [-1, 1].forEach((sgn) => {
      g.add(
        box(t, [0.018, len, 0.02], LEATHER_D, [(ax + bx) / 2 + nx * 0.093 * sgn, (ay + by) / 2 + ny * 0.093 * sgn, 0.04], {
          tex: 'fabric',
          repeat: [1, 5],
          rough: 0.9,
          rotZ: -Math.atan2(dx, dy),
        }),
      );
    });
  }

  // =========================================================================
  // 3. THE BOILER + PRESSURE GAUGES — a patinated copper barrel on the back of
  //    the counter, venting through the roof, with three live gauges beside it.
  // =========================================================================
  const boiler = new t.Group();
  boiler.position.set(0.46, 0.5, -0.22);
  g.add(boiler);
  boiler.add(cyl(t, 0.1, 0.1, 0.26, COPPER, [0, 0.14, 0], { tex: 'metal', repeat: [5, 2], metal: 0.24, rough: 0.55, seg: 16 }));
  [0.06, 0.14, 0.22].forEach((y, i) =>
    boiler.add(cyl(t, 0.107, 0.107, 0.02, BRASS, [0, y, 0], { tex: 'metal', repeat: [5, 1], metal: 0.3, rough: 0.42, seg: 16, rotY: i * 0.2 })),
  ); // hoop bands
  boiler.add(cyl(t, 0.094, 0.1, 0.03, BRASS_D, [0, 0.285, 0], { tex: 'metal', repeat: [4, 1], metal: 0.28, rough: 0.45, seg: 16 })); // crown
  // verdigris weeping down the copper barrel
  const patina: MergedBoxSpec[] = [];
  for (let i = 0; i < 7; i += 1) {
    const a = hash01(i * 2.3) * Math.PI * 2;
    const h = 0.035 + hash01(i * 6.7) * 0.06;
    patina.push({ dims: [0.018, h, 0.01], pos: [Math.sin(a) * 0.101, 0.11 + hash01(i * 4.1) * 0.1, Math.cos(a) * 0.101], rotY: a });
  }
  const patinaMesh = mergedBoxes(t, patina, VERDIGRIS, { tex: 'concrete', repeat: [1, 1], rough: 0.85, bump: 0.02 });
  patinaMesh.userData.lodDetail = true;
  boiler.add(patinaMesh);
  // the STACK: the boiler vents through the roof, so its steam is released in
  // clear air ABOVE the copper plate (roof top 1.005) instead of puffing into
  // the underside of it — a brass collar flashes the penetration
  boiler.add(cyl(t, 0.03, 0.034, 0.52, BRASS_D, [0, 0.56, 0], { tex: 'metal', repeat: [2, 5], metal: 0.26, rough: 0.5, seg: 12 })); // world 0.80 → 1.32
  g.add(cyl(t, 0.062, 0.08, 0.04, BRASS, [0.46, 1.02, -0.22], { tex: 'metal', repeat: [3, 1], metal: 0.28, rough: 0.45, seg: 12 })); // roof collar
  g.add(cyl(t, 0.048, 0.038, 0.035, BRASS_L, [0.46, 1.33, -0.22], { tex: 'metal', repeat: [3, 1], metal: 0.33, rough: 0.34, seg: 12 })); // relief cap
  g.add(cyl(t, 0.016, 0.016, 0.08, BRASS_L, [0.52, 1.29, -0.22], { metal: 0.33, rough: 0.34, seg: 8, rotZ: -0.5 })); // the whistle spout
  // three gauges bolted to the FRONT brass panel, facing the customer — under the
  // roof and behind the counter they were invisible at the isometric camera
  // elevation, which is where a park actually looks at a stall from
  const needles: THREE.Mesh[] = [];
  const gaugeBar = new t.Group();
  gaugeBar.position.set(0.42, 0.33, 0.482);
  g.add(gaugeBar);
  gaugeBar.add(box(t, [0.34, 0.025, 0.02], BRASS_D, [0, -0.075, 0], { tex: 'metal', repeat: [4, 1], metal: 0.26, rough: 0.48 })); // mounting rail
  [-0.11, 0, 0.11].forEach((x, i) => {
    const r = i === 1 ? 0.062 : 0.045;
    gaugeBar.add(cyl(t, r, r, 0.03, BRASS, [x, 0, 0.015], { tex: 'metal', repeat: [4, 1], metal: 0.3, rough: 0.4, seg: 16, rotX: Math.PI / 2 })); // case
    gaugeBar.add(cyl(t, r * 0.88, r * 0.88, 0.008, DIAL, [x, 0, 0.032], { rough: 0.75, seg: 16, rotX: Math.PI / 2 })); // dial face
    gaugeBar.add(cyl(t, r, r, 0.008, BRASS_L, [x, 0, 0.036], { tex: 'metal', repeat: [4, 1], metal: 0.34, rough: 0.3, seg: 16, rotX: Math.PI / 2 })); // bezel
    // tick marks + needle
    const ticks: MergedBoxSpec[] = [];
    for (let k = 0; k < 9; k += 1) {
      const a = -2.2 + (k / 8) * 4.4;
      ticks.push({ dims: [0.006, r * 0.2, 0.005], pos: [x + Math.sin(a) * r * 0.7, Math.cos(a) * r * 0.7, 0.038], rotZ: -a });
    }
    const tickMesh = mergedBoxes(t, ticks, IRON_D, { rough: 0.8 });
    tickMesh.userData.lodDetail = true; // dial ticks: close-up only
    gaugeBar.add(tickMesh);
    const needle = box(t, [0.006, r * 0.78, 0.005], 0x8c2318, [x, 0, 0.041], { rough: 0.6 });
    needle.geometry = needle.geometry.clone();
    needle.geometry.translate(0, r * 0.34, 0); // pivot at the dial centre
    needle.userData.lodDetail = true;
    gaugeBar.add(needle);
    needles.push(needle);
    gaugeBar.add(cyl(t, 0.008, 0.008, 0.01, BRASS_L, [x, 0, 0.044], { metal: 0.34, rough: 0.3, seg: 8, rotX: Math.PI / 2 })); // needle boss
  });
  // a copper feed pipe running from the boiler down the panel to the gauge rail
  g.add(cyl(t, 0.014, 0.014, 0.2, COPPER, [0.42, 0.5, 0.44], { tex: 'metal', repeat: [1, 3], metal: 0.22, rough: 0.6, seg: 8, rotX: 0.5 }));

  // =========================================================================
  // 4. THE ROOF — a verdigris copper plate carried on two back posts and two
  //    posts standing on the counter, the display rack of goggles hanging under
  //    its front edge, and the giant goggles SIGN on top. IT ONLY COVERS THE
  //    BACK (z −0.56 … 0.16): a full-depth roof turns the whole shop into a lid
  //    at the isometric camera elevation and the grinder/gauges vanish under it.
  // =========================================================================
  [-1, 1].forEach((sgn) => {
    // back posts, off the ground
    g.add(cyl(t, 0.028, 0.034, 0.94, BRASS, [sgn * 0.78, 0.48, -0.42], { tex: 'metal', repeat: [2, 6], metal: 0.28, rough: 0.46, seg: 10 }));
    g.add(cyl(t, 0.046, 0.038, 0.03, BRASS_D, [sgn * 0.78, 0.03, -0.42], { tex: 'metal', repeat: [2, 1], metal: 0.26, rough: 0.5, seg: 10 })); // shoe
    // front posts, standing on the counter top
    g.add(cyl(t, 0.024, 0.028, 0.46, BRASS, [sgn * 0.72, 0.73, 0.1], { tex: 'metal', repeat: [2, 4], metal: 0.28, rough: 0.46, seg: 10 }));
    g.add(cyl(t, 0.04, 0.032, 0.024, BRASS_D, [sgn * 0.72, 0.512, 0.1], { tex: 'metal', repeat: [2, 1], metal: 0.26, rough: 0.5, seg: 10 })); // collar
  });
  g.add(box(t, [1.84, 0.05, 0.76], COPPER, [0, 0.98, -0.2], { tex: 'metal', repeat: [7, 3], metal: 0.2, rough: 0.62 }));
  [0.16, -0.56].forEach((z) => g.add(box(t, [1.9, 0.05, 0.05], BRASS_D, [0, 0.945, z], { tex: 'metal', repeat: [8, 1], metal: 0.26, rough: 0.5 }))); // fascias
  // roof standing seams + a patina wash weathering down them
  const seams: MergedBoxSpec[] = [];
  for (let i = 0; i < 7; i += 1) seams.push({ dims: [0.03, 0.025, 0.74], pos: [-0.72 + i * 0.24, 1.012, -0.2], repeat: [1, 3] });
  g.add(mergedBoxes(t, seams, COPPER, { tex: 'metal', repeat: [1, 1], metal: 0.2, rough: 0.62 }));
  const roofPatina: MergedBoxSpec[] = [];
  for (let i = 0; i < 8; i += 1) {
    const x = -0.66 + i * 0.19 + (hash01(i * 8.3) - 0.5) * 0.05;
    const d = 0.1 + hash01(i * 1.7) * 0.22;
    roofPatina.push({ dims: [0.022 + hash01(i * 5.9) * 0.022, 0.006, d], pos: [x, 1.005, -0.53 + d / 2] });
  }
  const roofPatinaMesh = mergedBoxes(t, roofPatina, VERDIGRIS, { tex: 'concrete', repeat: [1, 1], rough: 0.88, bump: 0.02 });
  roofPatinaMesh.userData.lodDetail = true; // patina wash: close-up only
  g.add(roofPatinaMesh);
  // ---- the DISPLAY RACK: a brass rail under the roof's front edge with three
  // pairs of finished goggles hanging on little hooks
  const rackY = 0.93;
  g.add(cyl(t, 0.013, 0.013, 1.4, BRASS_L, [0, rackY, 0.08], { tex: 'metal', repeat: [8, 1], metal: 0.33, rough: 0.34, seg: 10, rotZ: Math.PI / 2 }));
  [-1, 1].forEach((sgn) => g.add(box(t, [0.03, 0.06, 0.03], BRASS_D, [sgn * 0.7, rackY + 0.02, 0.08], { tex: 'metal', repeat: [1, 1], metal: 0.26, rough: 0.48 })));
  const display: THREE.Group[] = [];
  [-0.44, 0, 0.44].forEach((x, i) => {
    g.add(cyl(t, 0.006, 0.006, 0.05, BRASS_L, [x, rackY - 0.028, 0.08], { metal: 0.33, rough: 0.34, seg: 6 })); // hook
    const pair = new t.Group();
    pair.position.set(x, rackY - 0.075, 0.08);
    pair.rotation.y = (hash01(i * 3.9) - 0.5) * 0.5;
    pair.add(gogglesMesh(t)); // display pairs read at ~2x the worn size
    g.add(pair);
    display.push(pair);
  });
  // =========================================================================
  //     THE GIANT GOGGLES — the building says what it sells AT PARK SCALE
  //
  //     ⚠️ 2.2× WAS NOT A HERO PROP. At 2.2 the roof sign was ~0.56 u wide on a
  //     1.84-u roof and topped out at 1.33: from a high park camera it read as
  //     two brass buttons on a brown plate, the same value as the copper roof
  //     they stand on, and this shop's whole identity — you can SEE what you buy
  //     — was unreadable at exactly the distance a guest picks a shop from.
  //     (The audit's own aesthetic note passes on a 26° close-up of the SERVING
  //     FRONT; nothing in it measured the overhead read.)
  //
  //     CottonCandyStand and BurgerShop never have this problem because THE SHOP
  //     IS THE ITEM at ~2 u across. Goggles are the luckiest article in the
  //     catalog for that treatment: TWO BIG CIRCLES SIDE BY SIDE is an
  //     unmistakable silhouette with zero detail resolved, and the pale grey-blue
  //     lens glass (0x86aab4) is the one COOL colour in a shop made entirely of
  //     warm brass, copper and soot — so it separates from its own building by
  //     hue as well as by size.
  //
  //     So: scale 2.2 → 6.4 (1.64 u wide, spanning the roof plate almost exactly,
  //     lens discs 0.55 across) and TIPPED BACK 0.5 rad, which is the whole
  //     trick — `gogglesMesh`'s lens faces look down local +z, and a park camera
  //     looks DOWN at ~50°, so a sign left plumb shows the camera its brass rims
  //     edge-on. Tipped back the two lens discs face the camera nearly square.
  //     Origin at (0, 1.48, −0.55): after the tilt the lens centres land at about
  //     y 1.80 / z 0.03, the pair occupies y 1.37…2.10, and the front-most
  //     geometry stops near z 0.2 — SHORT of the roof fascia at 0.16 plus a hair,
  //     and well short of the counter nosing at z 0.50, so nothing new hangs over
  //     the counter, the grinder, the gauges or the lens tray. That is this
  //     component's founding rule ("a full-depth roof turns the whole shop into a
  //     lid") applied to its own sign.
  //
  //     NO NEW DRAWS: the same 16-mesh `gogglesMesh` recipe as the worn pair and
  //     the three display pairs — a fourth scale, only the numbers changed. The
  //     two brass stand posts grow from 0.12 to 0.46 long and move out to ±0.34
  //     to carry it. Shadows off (a 1.6-u prop 1.7 u up would stripe the counter,
  //     and it saves 16 shadow-pass draws).
  // =========================================================================
  [-0.34, 0.34].forEach((x) => g.add(cyl(t, 0.026, 0.032, 0.46, BRASS_D, [x, 1.23, -0.42], { tex: 'metal', repeat: [1, 4], metal: 0.26, rough: 0.48, seg: 8 })));
  const signMats: THREE.MeshStandardMaterial[] = [];
  const sign = new t.Group();
  sign.position.set(0, 1.48, -0.55);
  sign.rotation.x = -0.5; // tip the lens faces UP toward the park camera
  sign.scale.setScalar(6.4);
  sign.add(gogglesMesh(t, { strap: false }));
  sign.traverse((n) => {
    const m = n as THREE.Mesh;
    if (!(m as unknown as { isMesh?: boolean }).isMesh) return;
    m.castShadow = false;
    const mm = m.material as THREE.MeshStandardMaterial;
    // A LIT SIGN AFTER DARK. Both PointLights here are at y ≤ 0.8 with a 2.2-2.8
    // range and BOTH gate fully to zero by day (this shop has no fire in it), so
    // after dark the sign 1.8 u up gets almost nothing and the one thing that
    // makes the shop findable would be the darkest object in frame. `mat()` never
    // shares a material instance, so a night-gated emissive on the sign's OWN
    // materials costs no light and no draw — the same gaslight amber the shop's
    // two lamps use, so it reads as gas-lit signage rather than as neon.
    //
    // ⚠️ TINTED WITH EACH PART'S OWN COLOUR, NOT ONE WARM HEX. A flat 0xffb050
    // on all 16 materials turned the sign into TWO PLAIN YELLOW DISCS at night —
    // the brass/glass distinction and the machined rims all gone, i.e. bright but
    // no longer readable. `mat()` bakes the colour INTO the texture and leaves
    // `material.color` white, so a MAPPED material (all the brass here) needs
    // `emissiveMap = map` with a white emissive to glow in its own tint, while an
    // unmapped one (the lens glass) can just copy its colour. Same texture
    // object, so this costs nothing.
    if (mm.map) {
      mm.emissiveMap = mm.map;
      mm.emissive.setHex(0xffffff);
    } else mm.emissive.copy(mm.color);
    signMats.push(mm);
  });
  g.add(sign);
  // an engraved brass nameplate on the front fascia (engraved bars, no text render)
  const plate = new t.Group();
  plate.position.set(-0.02, 0.89, 0.19);
  plate.add(box(t, [0.78, 0.12, 0.025], BRASS_D, [0, 0, 0], { tex: 'metal', repeat: [5, 1], metal: 0.26, rough: 0.5 }));
  const engrave: MergedBoxSpec[] = [
    { dims: [0.52, 0.022, 0.008], pos: [-0.03, 0.026, 0.016] },
    { dims: [0.38, 0.015, 0.008], pos: [-0.09, -0.014, 0.016] },
    { dims: [0.24, 0.012, 0.008], pos: [-0.15, -0.044, 0.016] },
  ];
  const engraveMesh = mergedBoxes(t, engrave, BRASS_L, { tex: 'metal', repeat: [1, 1], metal: 0.33, rough: 0.28 }); // 0.33: the shop's 0.2-0.35 band (was 0.75 — near-black)
  engraveMesh.userData.lodDetail = true; // engraved lettering: close-up only
  plate.add(engraveMesh);
  g.add(plate);

  // =========================================================================
  // 5. GASLIGHT + STEAM
  // =========================================================================
  // a brass gas lantern on a curved bracket over the counter
  const lampMat = new t.MeshStandardMaterial({ color: 0xfff0cc, emissive: 0xffb050, emissiveIntensity: 0.12, roughness: 0.3 });
  const lantern = new t.Group();
  lantern.position.set(-0.76, 0.66, 0.4);
  g.add(lantern);
  lantern.add(cyl(t, 0.012, 0.012, 0.14, BRASS, [0.04, 0.08, 0.0], { metal: 0.28, rough: 0.42, seg: 8, rotZ: -0.6 })); // bracket arm
  lantern.add(cyl(t, 0.036, 0.044, 0.022, BRASS_D, [0.115, 0.13, 0], { tex: 'metal', repeat: [2, 1], metal: 0.26, rough: 0.48, seg: 10 })); // cap
  const flame = new t.Mesh(new t.SphereGeometry(0.032, 10, 8), lampMat);
  flame.position.set(0.115, 0.08, 0);
  lantern.add(flame);
  // the glass chimney: four brass corner ribs (an open cage reads better than a
  // transparent box at park zoom)
  [-1, 1].forEach((sx) =>
    [-1, 1].forEach((sz) => lantern.add(cyl(t, 0.006, 0.006, 0.1, BRASS, [0.115 + sx * 0.03, 0.08, sz * 0.03], { metal: 0.3, rough: 0.4, seg: 6 }))),
  );
  lantern.add(cyl(t, 0.04, 0.032, 0.016, BRASS_D, [0.115, 0.026, 0], { tex: 'metal', repeat: [2, 1], metal: 0.26, rough: 0.48, seg: 10 }));
  const gasLight = new t.PointLight(0xffb968, 0, 2.8, 2);
  gasLight.position.set(-0.6, 0.78, 0.44);
  g.add(gasLight);
  const counterLight = new t.PointLight(0xffc98a, 0, 2.2, 2);
  counterLight.position.set(0.3, 0.8, 0.3);
  g.add(counterLight);

  // ---- the relief valve's steam: 26 particles -----------------------------
  let steam: ReturnType<typeof buildEmitter> | null = null;
  if (wantFx) {
    steam = buildEmitter(t, {
      max: 26,
      rate: 7,
      life: 1.9,
      lifeVar: 0.5,
      velocity: [0.1, 0.42, 0.02],
      spread: 0.12,
      gravity: -0.06,
      size: 0.05,
      sizeEnd: 0.2,
      color: 0xe8e4dc,
      colorEnd: 0xbdb8b0,
      opacity: 0.3,
    });
    steam.setOrigin(0.55, 1.32, -0.22); // the whistle spout, clear above the roof
    g.add(steam.points);
  }

  // ---- optional decorative browsing guest ---------------------------------
  let peep: ReturnType<typeof buildPeep> | null = null;
  if (opts.withGuest) {
    peep = buildPeep(t, { shirt: 0x2f5f6f, expression: 'happy' });
    peep.group.scale.setScalar(0.5);
    peep.group.position.set(0.34, 0, 0.86);
    peep.group.rotation.y = Math.PI;
    // the browsing guest is already wearing a pair — the shop's own recipe on
    // the same head slot the GameManager uses
    peep.headSlot.add(buildWornGoggles(t));
    g.add(peep.group);
  }

  const update = (time: number) => {
    const nk = nightKOf(g);
    const ease = nk * nk * (3 - 2 * nk); // smoothstep
    // 1. gaslight: strictly after dark (this is a lamp, not lava)
    lampMat.emissiveIntensity = 0.12 + (1.3 + 0.09 * Math.sin(time * 2.7) - 0.12) * ease;
    gasLight.intensity = ease * 0.95;
    counterLight.intensity = ease * 0.5;
    // 1b. the GIANT GOGGLES sign: gas-lit signage after dark, plain brass by day.
    //     Kept LOW (0.3) and on the same `ease` as the two lamps — this shop has
    //     nothing molten in it, so NOTHING here glows at noon.
    for (const sm of signMats) sm.emissiveIntensity = 0.22 * ease;
    // 2. the grinding wheel and its flywheel: geared 3.2 : 1 off one clock, with
    //    a slow hashed duty cycle (the optician stops to check the lens)
    const duty = 0.55 + 0.45 * Math.sin(time * 0.31); // eases to a near-stop
    const spin = time * 2.4 * (0.35 + 0.65 * Math.max(0, duty));
    wheel.rotation.x = spin;
    fly.rotation.x = spin / 3.2; // the crank pin turns with it
    // 3. gauge needles: three pressures drifting at their own rates
    needles.forEach((n, i) => {
      n.rotation.z = -(-1.5 + 1.2 * Math.sin(time * (0.37 + i * 0.19) + i * 1.7) + 0.16 * Math.sin(time * 2.3 + i));
    });
    // 4. the display pairs swing a hair on their hooks
    display.forEach((d, i) => {
      d.rotation.z = Math.sin(time * (0.7 + i * 0.13) + i * 2.2) * 0.06;
    });
    steam?.update(time);
    if (peep) peep.group.position.y = Math.abs(Math.sin(time * 1.8)) * 0.01; // idle shuffle
  };

  return {
    group: g,
    update,
    dispose() {
      steam?.dispose();
      lampMat.dispose();
      // the sign's materials are per-mesh instances this builder mutated, so they
      // are OURS to drop (its geometries are `getGeo`-shared and are not)
      signMats.forEach((m) => m.dispose());
      gasLight.dispose();
      counterLight.dispose();
    },
  };
}

export interface GoggleWorksProps {
  /** decorative browsing guest, already wearing a pair (preview flavour) */
  withGuest?: boolean;
  /** the relief valve's steam wisp (default true) */
  effects?: boolean;
}

/** <GoggleWorks> — "The Goggle Works", the Brasswork Foundry world's steampunk
 *  optician and the fleet's first WEARABLE stall, composable
 *  (components/Park/Context.md): mounts the riveted brass kiosk at
 *  `position`/`rotation`; inside a <Park>, `register` (+ optional
 *  `name`/`price`/`value`) registers a selling `'wearable'` stall with the
 *  GameManager — the serving front faces local +z, attach point 0.72 out, so aim
 *  `rotation` at the customers' path. Buyers put the shop's OWN brass aviator
 *  goggles ON (`heldItem`: buildWornGoggles, parented to the peep's headSlot)
 *  and wear them for the rest of the visit — through rides and all. */
export const GoggleWorks = composableStall<GoggleWorksProps>(
  'GoggleWorks',
  (t, { withGuest = false, effects = true }) => buildGoggleWorks(t, { withGuest, effects }),
  { name: 'The Goggle Works', item: 'wearable', price: 4, value: 6, heldItem: buildWornGoggles },
);

import * as THREE from 'three';
import { box, cyl, ball, mergedBoxes, nightKOf } from '../Stage';
import type { MergedBoxSpec } from '../Stage';
import { buildEmitter } from '../ParticleKit';
import { buildPeep } from '../Guest';
import { composableStall } from '../Park';
import { EMBERFALL, crustCanvases, emberfallHeatAt, emberfallLavaMat } from '../EmberfallScenery';

// ---------------------------------------------------------------------------
// EMBER ROAST — the EMBERFALL CALDERA world's food stall: a volcanic-stone
// SKEWER GRILL. Rough basalt block counter, an iron grill grate over a bed of
// glowing embers sunk into the slate top, a soot-blackened chimney breast +
// banded stack, an iron rack of spare skewers, a slate chalk menu board, and
// (RCT2-style) one GIANT charred skewer as the shop's sign on the front gantry.
//
// THE EMBER BED SPEAKS THE WORLD'S LAVA LANGUAGE. It is not an orange blob: the
// coals are near-black crust with an emissive CRACK network, built from
// EmberfallScenery's shared helpers (`crustCanvases` / `emberfallLavaMat` /
// `emberfallHeatAt`) so a skewer grill standing next to a <LavaFissure> is the
// same temperature of fire. And, per the house rule for anything molten, the
// glow is VISIBLE BY DAY as well as at night — `nightKOf` only lerps the
// emissive multiplier between a daylight value and a stronger night one
// (GLOW_DAY → GLOW_NIGHT) and never gates it to zero.
//
// Budgets: 2 real PointLights (the ember bounce — day-floored, never zero — and
// the night-gated counter gaslight), 62 particles (38 smoke + 24 sparks off the
// coals), static repeats batched through `mergedBoxes`, fine litter/chalk tagged
// `userData.lodDetail`. Deterministic — hashed sines only, no Math.random /
// Date.now; every updater takes ABSOLUTE time.
// ---------------------------------------------------------------------------

const hash01 = (n: number) => {
  const s = Math.sin(n * 12.9898 + 78.233) * 43758.5453;
  return s - Math.floor(s);
};

// palette: the world's basalt/cinder greys plus the grill's own ironwork,
// charred meat and scorched peppers. Nothing saturated but the coals and the
// pepper chunks.
const IRON = 0x3a352e; // soot-blackened wrought iron
const IRON_L = 0x554f45; // wiped-clean iron highlights (grate, bands)
const IRON_D = 0x201d19; // deep soot staining
const SLATE = 0x4a4a52; // the counter top and the menu board
const MEAT = 0x5b3620; // seared meat
const MEAT_CHAR = 0x2b1c14; // the blackened side of a chunk
const PEP_G = 0x4e7a2a; // scorched green pepper
const PEP_R = 0x9c3218; // scorched red pepper
const SKEWER_W = 0xbfa06a; // pale hardwood skewer stick
// the world's own canvas, from SetPieceKit's EMBERFALL_CALDERA theme palette
const CANVAS_A = 0xd87a3c; // scorched sailcloth, burnt orange (canopyPrimary)
const CANVAS_B = 0x8f2418; // ember red (canopySecondary)

/** the day → night ember multiplier. LAVA IS NOT A LAMP: this lerps, it never
 *  gates to zero (EmberfallScenery's house rule, same numbers). */
const GLOW_DAY = 1.0;
const GLOW_NIGHT = 1.85;

// ---------------------------------------------------------------------------
// SKEWER PROP — one recipe, three scales: the held item a buyer walks away
// with, the ones sizzling on the grate, the spares in the rack and the giant
// one on the sign. `len` is the stick length along local X, chunks threaded
// along the middle; the group origin is the stick's centre. `foodShift` slides
// the threaded food toward the point, which is what leaves a BARE HANDLE for a
// fist to close around on the held item.
// ---------------------------------------------------------------------------
function skewerProp(
  t: typeof THREE,
  len: number,
  stickR: number,
  chunkR: number,
  seed: number,
  o: { flat?: boolean; foodShift?: number } = {},
): THREE.Group {
  const g = new t.Group();
  const flat = o.flat ?? false;
  const shift = o.foodShift ?? 0;
  // the stick: pale hardwood, with the exposed tip charred black
  g.add(cyl(t, stickR, stickR, len, SKEWER_W, [0, 0, 0], { tex: 'wood', repeat: [3, 1], rough: 0.85, seg: 8, rotZ: Math.PI / 2 }));
  g.add(cyl(t, stickR * 0.9, stickR * 0.55, len * 0.14, MEAT_CHAR, [len * 0.5 - len * 0.06, 0, 0], { rough: 0.95, seg: 8, rotZ: Math.PI / 2 })); // charred point
  // 3 meat chunks + 2 pepper slices threaded alternately over the middle 62 %
  const span = len * 0.62;
  const step = span / 4;
  for (let i = 0; i < 5; i += 1) {
    const x = -span / 2 + i * step + shift;
    const h = hash01(seed * 3.7 + i * 1.9);
    if (i % 2 === 0) {
      // meat: a squashed ball, hashed-jittered so no two chunks match, with a
      // charred cap on the underside (the side that met the grate)
      const m = ball(t, chunkR, MEAT, [x, 0, 0], { tex: 'asphalt', repeat: [2, 2], flat: true, rough: 0.9 });
      m.scale.set(0.85 + h * 0.3, 0.9 + h * 0.2, 0.9 + (1 - h) * 0.25);
      m.rotation.set(h * 1.2, h * 2.1, h * 0.8);
      g.add(m);
      const char = ball(t, chunkR * 0.72, MEAT_CHAR, [x, -chunkR * 0.55, 0], { flat: true, rough: 1 });
      char.scale.set(1.1, 0.42, 1.05);
      g.add(char);
    } else {
      // pepper: a flattened ring-ish slice, alternating green/red
      const p = ball(t, chunkR * 0.82, i === 1 ? PEP_G : PEP_R, [x, chunkR * 0.1, 0], { tex: 'leaf', repeat: [2, 2], flat: true, rough: 0.55 });
      p.scale.set(0.5, 1.05, 1.05);
      p.rotation.x = h * 1.6;
      g.add(p);
    }
  }
  if (flat) g.traverse((n) => ((n as THREE.Mesh).castShadow = false));
  return g;
}

// ---- the HELD skewer (GameManager StallConfig.heldItem) ---------------------
// The 3D item a BUYER walks away eating: the grill's own recipe shrunk to a
// peep's fist. Peep-local units — the manager parents this group at the tuned
// hand hold spot (arm-local ±0.03, −0.37, 0.15), so the park's 0.5 GUEST_SCALE
// is already accounted for and sizes are measured against the head (r 0.12) and
// the closed fist ball (r 0.05, centred 0.05 ABOVE this group's origin).
//
// THE FLOSS-CONE LESSON, HARDER. The hold spot sits 0.15 FORWARD of the fist
// ball (arm-local [0, −0.32, 0]) because it is sized for a fat burger, so a slim
// item left near the origin floats a clear 0.1 in front of the hand — the first
// profile render showed exactly that. Solving the tilted frame for "the stick
// passes through the ball centre" gives a self-offset of z −0.15 (with the 0.4
// rad forward tip and a 0.03 lift), which is what threads the STICK THROUGH THE
// FIST: the bare handle pokes out below the little finger and the lowest meat
// chunk sits right on top of the grip, the way a kebab is actually carried. The
// food is pushed toward the point (`foodShift`) to leave that handle bare, and
// still clears the forearm and — at full bite lift — the hair.
export function buildHeldSkewer(three: typeof THREE): THREE.Group {
  const t = three;
  const g = new t.Group();
  g.position.set(0, 0.03, -0.15);
  g.rotation.x = 0.4;
  // built along X by skewerProp, then stood UP (rotZ) so the stick runs through
  // the fist bottom-to-top like a held kebab
  const s = skewerProp(t, 0.3, 0.009, 0.034, 4.1, { foodShift: 0.045 });
  s.rotation.z = Math.PI / 2;
  s.position.y = 0.15; // stick spans local y 0.00 … 0.30; the fist closes at ~0.10
  g.add(s);
  return g;
}

export interface EmberRoastOpts {
  /** add the decorative queueing guest (preview flavour — in a composed park
   *  the GameManager's real guests walk up instead; default false) */
  withGuest?: boolean;
  /** smoke + spark emitters off the coals (default true) */
  effects?: boolean;
}

export interface EmberRoastBuilt {
  group: THREE.Group;
  update: (time: number) => void;
  dispose: () => void;
}

/** the Ember Roast grill kiosk. Group origin on the ground at the counter's
 *  centre; the SERVING FRONT faces local +z. */
export function buildEmberRoast(three: typeof THREE, opts: EmberRoastOpts = {}): EmberRoastBuilt {
  const t = three;
  const g = new t.Group();
  const wantFx = opts.effects ?? true;
  const texes: THREE.Texture[] = [];
  const lavaMats: { m: THREE.MeshStandardMaterial; heat: number; phase: number }[] = [];

  // ---- shared crust/crack textures: the world's ONE lava palette -----------
  const pair = crustCanvases();
  const crustTex = (rx: number, ry: number) => {
    const a = new t.CanvasTexture(pair.crust);
    const b = new t.CanvasTexture(pair.crack);
    [a, b].forEach((x) => {
      x.wrapS = x.wrapT = t.RepeatWrapping;
      x.repeat.set(rx, ry);
      x.anisotropy = 4;
      (x as unknown as { colorSpace: string }).colorSpace = (t as unknown as { SRGBColorSpace: string }).SRGBColorSpace;
      texes.push(x);
    });
    return [a, b] as const;
  };
  /** an EmberfallScenery lava material, registered for the day/night lerp */
  const lava = (u: number, rx: number, ry: number, phase = 0) => {
    const [a, b] = crustTex(rx, ry);
    const m = emberfallLavaMat(t, u, a, b);
    lavaMats.push({ m, heat: emberfallHeatAt(t, u).intensity, phase });
    return m;
  };

  // =========================================================================
  // SCALE NOTE: the whole rig is sized against a 0.5-scale park guest (≈ 0.55 u
  // tall), the same way the four catalog shops are — serving counter top at
  // y 0.46, grate at 0.58, stack top 1.66. The first pass was built at twice
  // this height and rendered as a wall the customers could not see over.
  // =========================================================================

  // =========================================================================
  // 1. THE BASALT BLOCK COUNTER — a solid core plus TWO merged facings of
  //    rough, jittered blocks in two stone tones, so the mass reads as
  //    dry-stacked volcanic rock rather than as one textured box.
  //    Core: x ±0.83, z −0.53…0.45, y 0…0.42.
  // =========================================================================
  g.add(box(t, [1.66, 0.42, 0.98], EMBERFALL.basaltPale, [0, 0.21, -0.04], { tex: 'concrete', repeat: [7, 3], rough: 0.97, bump: 0.05 }));
  const blocksA: MergedBoxSpec[] = [];
  const blocksB: MergedBoxSpec[] = [];
  [0.07, 0.19, 0.31].forEach((y, ci) => {
    // front face (z 0.45): blocks stand 0.05 proud, embedded 0.035
    let x = -0.8;
    let i = 0;
    while (x < 0.78) {
      const w = Math.min(0.2 + hash01(ci * 5.3 + i * 2.7) * 0.18, 0.8 - x);
      (hash01(ci * 6.1 + i * 3.3) > 0.5 ? blocksA : blocksB).push({
        dims: [w, 0.1 + hash01(ci * 7.9 + i * 1.3) * 0.02, 0.09],
        pos: [x + w / 2, y, 0.45],
        rotZ: (hash01(ci * 3.1 + i * 4.7) - 0.5) * 0.05,
        repeat: [2, 1],
      });
      x += w + 0.018;
      i += 1;
    }
    // the two side walls (x ±0.83)
    [-1, 1].forEach((sgn) => {
      let z = -0.5;
      let k = 0;
      while (z < 0.4) {
        const d = Math.min(0.19 + hash01(ci * 2.3 + k * 3.9 + sgn) * 0.17, 0.42 - z);
        (hash01(ci * 4.3 + k * 2.1 + sgn) > 0.5 ? blocksA : blocksB).push({
          dims: [0.09, 0.1 + hash01(ci * 8.1 + k) * 0.02, d],
          pos: [sgn * 0.83, y, z + d / 2],
          rotX: (hash01(ci * 4.9 + k * 1.7) - 0.5) * 0.05,
          repeat: [1, 2],
        });
        z += d + 0.018;
        k += 1;
      }
    });
  });
  g.add(mergedBoxes(t, blocksA, 0x6f685e, { tex: 'concrete', repeat: [1, 1], rough: 0.97, bump: 0.06, flat: true }));
  g.add(mergedBoxes(t, blocksB, 0x565149, { tex: 'concrete', repeat: [1, 1], rough: 0.97, bump: 0.06, flat: true }));
  // heat-scorched skirt at the foot of the stone (the world's sterile ground)
  g.add(box(t, [1.82, 0.04, 1.14], EMBERFALL.scorch, [0, 0.02, -0.04], { tex: 'asphalt', repeat: [4, 3], rough: 1, bump: 0.03 }));

  // ---- the slate counter top (y 0.42 → 0.49, overhangs the front by 0.03) --
  g.add(box(t, [1.8, 0.07, 1.06], SLATE, [0, 0.455, -0.04], { tex: 'concrete', repeat: [6, 4], rough: 0.72, bump: 0.03 }));
  // a worn iron edging strip along the serving lip
  g.add(box(t, [1.8, 0.035, 0.05], IRON_L, [0, 0.475, 0.5], { tex: 'metal', repeat: [8, 1], metal: 0.5, rough: 0.55 }));

  // =========================================================================
  // 2. THE FIREBOX — an iron-walled pit sunk into the slate holding the ember
  //    bed. Walls y 0.49…0.6, interior x ±0.575, z −0.255…0.135.
  //
  //    IT SITS FORWARD, and the flue is a canted BREAST at the back rather than
  //    a hood over the middle: at the isometric camera elevation a hood over the
  //    coals hides the entire point of the stall (verified in the harness — the
  //    first pass rendered as a closed dark box).
  // =========================================================================
  const fbY = 0.545;
  g.add(box(t, [1.24, 0.11, 0.05], IRON, [0, fbY, 0.16], { tex: 'metal', repeat: [6, 1], metal: 0.35, rough: 0.72 })); // front wall
  g.add(box(t, [1.24, 0.11, 0.05], IRON, [0, fbY, -0.28], { tex: 'metal', repeat: [6, 1], metal: 0.35, rough: 0.72 })); // back wall
  [-1, 1].forEach((sgn) =>
    g.add(box(t, [0.05, 0.11, 0.49], IRON, [sgn * 0.6, fbY, -0.06], { tex: 'metal', repeat: [3, 1], metal: 0.35, rough: 0.72 })),
  );
  // rivet heads around the firebox rim (fine detail — merged, one draw call)
  const rivets: MergedBoxSpec[] = [];
  for (let i = 0; i < 11; i += 1) rivets.push({ dims: [0.022, 0.022, 0.016], pos: [-0.5 + i * 0.1, fbY + 0.032, 0.188] });
  [-1, 1].forEach((sgn) => {
    for (let i = 0; i < 4; i += 1) rivets.push({ dims: [0.016, 0.022, 0.022], pos: [sgn * 0.628, fbY + 0.032, 0.09 - i * 0.11] });
  });
  const rivetMesh = mergedBoxes(t, rivets, IRON_L, { tex: 'metal', repeat: [1, 1], metal: 0.55, rough: 0.5 });
  rivetMesh.userData.lodDetail = true; // rivet heads: close-up only
  g.add(rivetMesh);

  // ---- the EMBER BED: crust plate + hot coal lumps + cold charcoal ---------
  // the bed floor: white-hot cracks under a near-black crust (u 0.10). The
  // texture repeats are DELIBERATELY LOW — at 3× the crack network on a 0.38-deep
  // plate is sub-pixel at park zoom and the fire reads as a black hole.
  const bedMat = lava(0.1, 1.4, 0.5);
  const bed = new t.Mesh(new t.BoxGeometry(1.1, 0.03, 0.38), bedMat);
  bed.position.set(0, 0.505, -0.06);
  bed.receiveShadow = true;
  g.add(bed);
  // glowing coals heaped on it — two temperature bands so the bed has hot and
  // cooling patches instead of one uniform tone
  const coalHot = lava(0.18, 1, 1, 0.7);
  const coalWarm = lava(0.42, 1, 1, 1.9);
  const coalGeo = new t.IcosahedronGeometry(0.038, 1);
  for (let i = 0; i < 15; i += 1) {
    const h1 = hash01(i * 3.13 + 1.7);
    const h2 = hash01(i * 5.71 + 4.3);
    const m = new t.Mesh(coalGeo, h1 > 0.55 ? coalHot : coalWarm);
    m.position.set(-0.5 + (i / 14) * 1.0 + (h1 - 0.5) * 0.05, 0.525 + h2 * 0.01, -0.2 + h2 * 0.28);
    m.scale.set(0.7 + h1 * 0.6, 0.5 + h2 * 0.4, 0.7 + h2 * 0.5);
    m.rotation.set(h1 * 3, h2 * 3, h1 * 2);
    g.add(m);
  }
  // spent charcoal: cold cinder lumps sitting in among the coals (the contrast
  // that stops the bed reading as a light box)
  const charcoal: MergedBoxSpec[] = [];
  for (let i = 0; i < 12; i += 1) {
    const h1 = hash01(i * 7.7 + 0.9);
    const h2 = hash01(i * 2.9 + 6.1);
    const s = 0.024 + h1 * 0.022;
    charcoal.push({
      dims: [s * 1.5, s * 0.8, s],
      pos: [-0.5 + h2 * 1.0, 0.53, -0.21 + h1 * 0.3],
      rotY: h1 * 3,
      rotZ: (h2 - 0.5) * 0.5,
      repeat: [1, 1],
    });
  }
  const charMesh = mergedBoxes(t, charcoal, EMBERFALL.cinder, { tex: 'asphalt', repeat: [1, 1], rough: 1, bump: 0.05, flat: true });
  g.add(charMesh);

  // ---- the GRATE: merged iron bars over the coals (y 0.58) ----------------
  const bars: MergedBoxSpec[] = [];
  for (let i = 0; i < 8; i += 1) bars.push({ dims: [1.16, 0.018, 0.022], pos: [0, 0.58, -0.22 + i * 0.05], repeat: [8, 1] });
  bars.push({ dims: [0.026, 0.026, 0.44], pos: [-0.56, 0.566, -0.055], repeat: [1, 4] }); // side rails carrying the bars
  bars.push({ dims: [0.026, 0.026, 0.44], pos: [0.56, 0.566, -0.055], repeat: [1, 4] });
  g.add(mergedBoxes(t, bars, IRON_L, { tex: 'metal', repeat: [1, 1], metal: 0.55, rough: 0.5 }));

  // ---- three skewers sizzling on the grate --------------------------------
  const cooking: THREE.Group[] = [];
  [-0.14, -0.04, 0.06].forEach((z, i) => {
    const s = skewerProp(t, 0.6, 0.014, 0.05, 11.3 + i * 2.7);
    s.position.set((hash01(i * 4.4) - 0.5) * 0.08, 0.625, z);
    s.rotation.y = (hash01(i * 9.1) - 0.5) * 0.12;
    g.add(s);
    cooking.push(s);
  });

  // =========================================================================
  // 3. THE FLUE — a canted chimney BREAST standing on the back of the counter:
  //    a sooted iron plate leaning over the coals, a gathering lip, and a banded
  //    stack rising behind it. Nothing sits over the fire, so the grate, the
  //    coals and the skewers stay fully visible from the isometric camera.
  // =========================================================================
  g.add(box(t, [1.26, 0.46, 0.045], IRON, [0, 0.72, -0.42], { tex: 'metal', repeat: [6, 3], metal: 0.32, rough: 0.8, rotX: 0.26 })); // the leaning breast plate
  g.add(box(t, [1.3, 0.045, 0.3], IRON, [0, 0.95, -0.24], { tex: 'metal', repeat: [6, 2], metal: 0.32, rough: 0.8, rotX: 0.42 })); // gathering lip over the fire
  [-1, 1].forEach((sgn) => g.add(box(t, [0.05, 0.44, 0.3], IRON, [sgn * 0.62, 0.72, -0.34], { tex: 'metal', repeat: [1, 3], metal: 0.32, rough: 0.8 }))); // side cheeks
  // soot staining up the breast plate (fine detail)
  const soot: MergedBoxSpec[] = [];
  for (let i = 0; i < 8; i += 1) {
    const x = -0.52 + i * 0.15 + (hash01(i * 4.3) - 0.5) * 0.04;
    const h = 0.1 + hash01(i * 6.1) * 0.2;
    soot.push({ dims: [0.05 + hash01(i * 2.9) * 0.04, h, 0.01], pos: [x, 0.56 + h / 2, -0.395], rotX: 0.26 });
  }
  const sootMesh = mergedBoxes(t, soot, IRON_D, { tex: 'asphalt', repeat: [1, 1], rough: 1, bump: 0.02 });
  sootMesh.userData.lodDetail = true; // soot streaks: close-up only
  g.add(sootMesh);
  g.add(cyl(t, 0.075, 0.085, 0.64, IRON, [0, 1.29, -0.46], { tex: 'metal', repeat: [2, 4], metal: 0.35, rough: 0.78, seg: 12 })); // stack
  [1.06, 1.28, 1.5].forEach((y, i) =>
    g.add(cyl(t, 0.095, 0.095, 0.032, IRON_L, [0, y, -0.46], { tex: 'metal', repeat: [3, 1], metal: 0.6, rough: 0.45, seg: 12, rotY: i * 0.3 })),
  ); // bands
  g.add(cyl(t, 0.115, 0.09, 0.04, IRON_L, [0, 1.62, -0.46], { tex: 'metal', repeat: [3, 1], metal: 0.6, rough: 0.5, seg: 12 })); // rain cap
  g.add(cyl(t, 0.015, 0.015, 0.1, IRON_L, [0, 1.67, -0.46], { metal: 0.6, rough: 0.5, seg: 6 }));
  // two guy stays from the stack down to the breast cheeks
  [-1, 1].forEach((sgn) =>
    g.add(box(t, [0.018, 0.32, 0.018], IRON, [sgn * 0.2, 1.1, -0.44], { tex: 'metal', repeat: [1, 3], metal: 0.4, rough: 0.7, rotZ: sgn * 0.42 })),
  );

  // =========================================================================
  // 4. THE SIGN GANTRY at the serving front — two iron posts and a lintel beam
  //    carrying the GIANT charred skewer and the two hanging gaslights. A beam,
  //    not a canopy: an awning plate here reads as a lid from above.
  // =========================================================================
  [-1, 1].forEach((sgn) => {
    g.add(cyl(t, 0.038, 0.046, 1.02, IRON, [sgn * 0.84, 0.51, 0.42], { tex: 'metal', repeat: [2, 6], metal: 0.4, rough: 0.7, seg: 8 }));
    g.add(cyl(t, 0.075, 0.09, 0.05, IRON_L, [sgn * 0.84, 0.025, 0.42], { tex: 'metal', repeat: [2, 1], metal: 0.5, rough: 0.6, seg: 8 })); // foot
    // a scrolled bracket back to the stone, so the post is braced
    g.add(box(t, [0.02, 0.22, 0.22], IRON, [sgn * 0.84, 0.9, 0.3], { tex: 'metal', repeat: [1, 2], metal: 0.4, rough: 0.7, rotX: -0.78 }));
  });
  g.add(box(t, [1.78, 0.08, 0.1], IRON, [0, 1.05, 0.42], { tex: 'metal', repeat: [8, 1], metal: 0.4, rough: 0.68 })); // lintel beam
  // THE WORLD'S CANVAS — a short scorched-sailcloth valance hung off the lintel
  // in the Emberfall Caldera theme's own canopy colours (SetPieceKit
  // EMBERFALL_CALDERA: burnt orange 0xd87a3c / ember red 0x8f2418). Kept to
  // 0.11 deep so it dresses the gantry without becoming a lid over the counter —
  // the only colour on the stall besides the coals and the food.
  for (let i = 0; i < 8; i += 1) {
    const col = i % 2 ? CANVAS_A : CANVAS_B;
    g.add(box(t, [0.222, 0.11, 0.02], col, [-0.78 + i * 0.223, 0.955, 0.468], { tex: 'fabric', repeat: [2, 1], rough: 0.9 }));
    // scalloped hem. SQUASHED, not spherical: full balls of r 0.052 read as a
    // row of red BAUBLES from the park camera (the audit's --elev=50 shot), and
    // a valance's scallops are half-rounds of cloth, not beads.
    const scallop = ball(t, 0.052, col, [-0.78 + i * 0.223, 0.912, 0.468], { tex: 'fabric', repeat: [2, 2], flat: true, rough: 0.9 });
    scallop.scale.set(1, 0.62, 0.45);
    g.add(scallop);
  }
  g.add(box(t, [1.8, 0.03, 0.028], EMBERFALL.sulfur, [0, 1.005, 0.468], { tex: 'metal', repeat: [8, 1], rough: 0.85 })); // ochre binding along the head of the valance
  // =========================================================================
  //     THE GIANT SKEWER — the building says what it sells AT PARK SCALE
  //
  //     ⚠️ THE OLD SIGN WAS ALREADY CALLED "GIANT" AND WAS NOT. At len 1.15 /
  //     chunkR 0.115 it sat at y 1.28, BELOW the 1.66 stack top, so from a high
  //     park camera it was a dark lumpy bar lost inside the stall's own
  //     silhouette — and every colour it owns (seared meat 0x5b3620, char
  //     0x2b1c14) is the same value as the basalt, the slate and the ironwork
  //     around it, so it had neither shape nor contrast to read by. The overhead
  //     audit shot is a dark grey box with darker things on it.
  //
  //     Compare CottonCandyStand and BurgerShop, the two stalls that never have
  //     this problem: THE SHOP IS THE ITEM at ~2 u across, so the SILHOUETTE
  //     carries the message with no detail needing to resolve and no reliance on
  //     hue. So the sign is rebuilt to that scale and, crucially, LIFTED ABOVE
  //     THE STALL so it silhouettes against SKY rather than against basalt:
  //
  //       len 1.15 → 2.00   chunkR 0.115 → 0.26   y 1.28 → 1.90
  //
  //     which spans x ±1.00 (inside the 1.15-1.30 the swept cinder litter
  //     already reaches, so the envelope does not grow), tops out at 2.21 —
  //     0.55 clear of the stack — and puts five 0.52-diameter chunks with a
  //     0.31 pitch into a nearly continuous 1.24-long bar. The two scorched
  //     PEPPERS in the middle of the run are now 0.43-wide discs of green
  //     0x4e7a2a and red 0x9c3218 with sky behind them: the only saturated
  //     silhouette this world's stall has ever had.
  //
  //     Same `skewerProp` recipe as the grate, the rack and the held item — a
  //     fourth scale, no new vocabulary and NO NEW DRAWS (10 meshes before,
  //     10 after; only the numbers changed). The posts grow with it.
  //
  //     IT CASTS NO SHADOW. At 1.9 u up over a serving front a 2-u bar drops a
  //     stripe of shade straight across the counter and the coals, which is this
  //     component's own founding lesson ("nothing sits over the fire") — and it
  //     saves 10 shadow-pass draws.
  //
  //     WHERE IT DOES *NOT* REACH: the chunks span z 0.11…0.73 at y 1.6…2.2. A
  //     ~50° camera above and in +z sees an object at y 1.9 / z 0.42 covering
  //     ground at z > ~2.0 — i.e. the apron IN FRONT of the stall, never the
  //     grate at z −0.22…0.18. Checked in the render, not on paper.
  // =========================================================================
  [-0.55, 0.55].forEach((x, i) =>
    g.add(cyl(t, 0.03, 0.038, 0.72, IRON, [x, 1.41, 0.42], { tex: 'metal', repeat: [1, 4], metal: 0.45, rough: 0.65, seg: 8, rotZ: (i ? -1 : 1) * 0.05 })),
  );
  const signMats: THREE.MeshStandardMaterial[] = [];
  const sign = skewerProp(t, 2.0, 0.05, 0.26, 21.7);
  sign.position.set(0, 1.9, 0.42);
  sign.rotation.z = 0.05;
  sign.traverse((n) => {
    const m = n as THREE.Mesh;
    if (!(m as unknown as { isMesh?: boolean }).isMesh) return;
    m.castShadow = false;
    const mm = m.material as THREE.MeshStandardMaterial;
    // A LIT SIGN AFTER DARK. Both real lights here are at y ≤ 0.83 with a 1.7-2.6
    // range: the hero skewer is 1.9 u up and gets essentially nothing from
    // either, so after dark the one thing that makes this stall findable would be
    // the darkest object in the frame. `mat()` never shares a material instance,
    // so a night-gated emissive on the sign's OWN materials costs no light and no
    // draw.
    //
    // ⚠️ TINTED WITH EACH CHUNK'S OWN COLOUR, NOT ONE EMBER-ORANGE HEX. Almost
    // every material on this skewer is TEXTURED (stick 'wood', meat 'asphalt',
    // peppers 'leaf') and `mat()` bakes the colour INTO the texture, leaving
    // `material.color` white — so a flat warm emissive would glow the whole bar
    // grey-white and throw away the green/red pepper contrast that is the entire
    // reason this sign reads. `emissiveMap = map` with a white emissive glows each
    // part in its own tint off the SAME texture object, so it costs nothing;
    // unmapped parts (the charcoal caps) just copy their colour.
    if (mm.map) {
      mm.emissiveMap = mm.map;
      mm.emissive.setHex(0xffffff);
    } else mm.emissive.copy(mm.color);
    signMats.push(mm);
  });
  g.add(sign);

  // =========================================================================
  // 5. DRESSING — the spare-skewer rack, the slate menu board, cinder litter.
  // =========================================================================
  // iron rack standing on the slate at the right end: two uprights, two rails,
  // four spare raw skewers laid across
  const rack = new t.Group();
  rack.position.set(0.7, 0.49, -0.06);
  [-0.13, 0.13].forEach((z) => {
    rack.add(cyl(t, 0.016, 0.02, 0.26, IRON, [0, 0.13, z], { tex: 'metal', repeat: [1, 3], metal: 0.45, rough: 0.65, seg: 8 }));
    rack.add(box(t, [0.07, 0.015, 0.04], IRON_L, [0, 0.005, z], { tex: 'metal', repeat: [1, 1], metal: 0.5, rough: 0.6 })); // foot plate
  });
  [0.15, 0.25].forEach((y) => rack.add(cyl(t, 0.011, 0.011, 0.3, IRON_L, [0, y, 0], { tex: 'metal', repeat: [3, 1], metal: 0.55, rough: 0.5, seg: 8, rotX: Math.PI / 2 })));
  for (let i = 0; i < 4; i += 1) {
    const s = skewerProp(t, 0.42, 0.01, 0.034, 31.1 + i * 1.7);
    s.position.set((hash01(i * 6.3) - 0.5) * 0.05, 0.27 + i * 0.013, -0.09 + i * 0.055);
    s.rotation.set(0, (hash01(i * 8.9) - 0.5) * 0.2, 0);
    rack.add(s);
  }
  g.add(rack);
  // slate chalk menu board on a basalt post, angled at the queue
  const menu = new t.Group();
  menu.position.set(1.42, 0, 0.72);
  menu.rotation.y = -0.85;
  menu.add(cyl(t, 0.042, 0.058, 0.66, EMBERFALL.basalt, [0, 0.33, 0], { tex: 'concrete', repeat: [2, 4], rough: 0.97, bump: 0.05 }));
  menu.add(box(t, [0.44, 0.34, 0.05], IRON, [0, 0.8, 0], { tex: 'metal', repeat: [3, 2], metal: 0.4, rough: 0.7 })); // iron frame
  menu.add(box(t, [0.38, 0.28, 0.02], SLATE, [0, 0.8, 0.03], { tex: 'concrete', repeat: [3, 2], rough: 0.6, bump: 0.02 })); // slate face
  const chalk: MergedBoxSpec[] = [
    { dims: [0.28, 0.026, 0.006], pos: [0, 0.9, 0.042] },
    { dims: [0.22, 0.013, 0.006], pos: [-0.02, 0.845, 0.042] },
    { dims: [0.19, 0.013, 0.006], pos: [-0.035, 0.8, 0.042] },
    { dims: [0.24, 0.013, 0.006], pos: [-0.01, 0.755, 0.042] },
    { dims: [0.14, 0.013, 0.006], pos: [-0.05, 0.71, 0.042] },
  ];
  const chalkMesh = mergedBoxes(t, chalk, 0xbdb6a6, { rough: 0.85 });
  chalkMesh.userData.lodDetail = true; // chalk lines: close-up only
  menu.add(chalkMesh);
  g.add(menu);
  // cinder + ash litter swept off the grill onto the scorched ground
  const litter: MergedBoxSpec[] = [];
  for (let i = 0; i < 16; i += 1) {
    const a = hash01(i * 1.9) * Math.PI * 2;
    const r = 0.7 + hash01(i * 4.7) * 0.5;
    const s = 0.024 + hash01(i * 7.3) * 0.028;
    litter.push({
      dims: [s * 1.4, s * 0.45, s],
      pos: [Math.cos(a) * r * 1.15, 0.02, -0.04 + Math.sin(a) * r * 0.8],
      rotY: hash01(i * 3.3) * 3,
      repeat: [1, 1],
    });
  }
  const litterMesh = mergedBoxes(t, litter, EMBERFALL.char, { tex: 'asphalt', repeat: [1, 1], rough: 1, bump: 0.05, flat: true });
  litterMesh.userData.lodDetail = true; // swept cinders: close-up only
  g.add(litterMesh);

  // =========================================================================
  // 6. LIGHT + EFFECTS
  // =========================================================================
  // the counter gaslights: two caged iron lamps hung off the lintel (night-gated)
  const lampMat = new t.MeshStandardMaterial({ color: 0xfff0cc, emissive: 0xffb050, emissiveIntensity: 0.12, roughness: 0.35 });
  const lampGeo = new t.SphereGeometry(0.042, 10, 8);
  [-0.58, 0.58].forEach((x) => {
    g.add(cyl(t, 0.014, 0.014, 0.12, IRON, [x, 0.95, 0.42], { metal: 0.45, rough: 0.6, seg: 6 })); // hanger off the lintel
    g.add(cyl(t, 0.07, 0.055, 0.03, IRON_L, [x, 0.875, 0.42], { tex: 'metal', repeat: [2, 1], metal: 0.5, rough: 0.55, seg: 8 })); // shade
    const bulb = new t.Mesh(lampGeo, lampMat);
    bulb.position.set(x, 0.83, 0.42);
    g.add(bulb);
    // a wire cage hoop around each gas flame
    g.add(cyl(t, 0.048, 0.048, 0.006, IRON, [x, 0.83, 0.42], { metal: 0.5, rough: 0.55, seg: 10 }));
  });
  const counterLight = new t.PointLight(0xffb968, 0, 2.6, 2);
  counterLight.position.set(0, 0.82, 0.48);
  g.add(counterLight);
  // the EMBER bounce: day-FLOORED (never zero — the coals burn in daylight too)
  const emberLight = new t.PointLight(0xff6a1e, 0, 1.7, 2);
  emberLight.position.set(0, 0.62, -0.06);
  g.add(emberLight);

  // ---- smoke off the grate + sparks off the coals: 38 + 24 = 62 particles --
  const emitters: ReturnType<typeof buildEmitter>[] = [];
  let smoke: ReturnType<typeof buildEmitter> | null = null;
  let sparks: ReturnType<typeof buildEmitter> | null = null;
  if (wantFx) {
    smoke = buildEmitter(t, {
      max: 38,
      rate: 9,
      life: 2.6,
      lifeVar: 0.7,
      velocity: [0.02, 0.5, -0.04],
      spread: 0.14,
      gravity: -0.05,
      size: 0.075,
      sizeEnd: 0.3,
      color: 0x59504a,
      colorEnd: 0x8d8781,
      opacity: 0.17,
    });
    sparks = buildEmitter(t, {
      max: 24,
      rate: 4,
      life: 1.5,
      lifeVar: 0.5,
      velocity: [0, 0.7, 0],
      spread: 0.16,
      gravity: 1.0,
      size: 0.03,
      sizeEnd: 0.008,
      color: 0xffdc9e,
      colorEnd: 0xc4380a,
      opacity: 1,
      additive: true,
    });
    emitters.push(smoke, sparks);
    emitters.forEach((e) => g.add(e.points));
  }

  // ---- optional decorative queueing guest ---------------------------------
  let peep: ReturnType<typeof buildPeep> | null = null;
  if (opts.withGuest) {
    peep = buildPeep(t, { shirt: 0x8a4a2a, expression: 'happy' });
    peep.group.scale.setScalar(0.5);
    peep.group.position.set(0.28, 0, 0.86);
    peep.group.rotation.y = Math.PI;
    g.add(peep.group);
  }

  const update = (time: number) => {
    const nk = nightKOf(g);
    const ease = nk * nk * (3 - 2 * nk); // smoothstep
    // 1. THE COALS — day AND night. `glow` lerps 1.0 → 1.85, never to zero.
    const glow = GLOW_DAY + (GLOW_NIGHT - GLOW_DAY) * nk;
    const breathe = 1 + 0.1 * Math.sin(time * 0.47); // one slow bed-wide breath
    for (const lm of lavaMats) {
      // a draught crossing the bed: hot patches brighten and fade out of phase
      const draught = 1 + 0.22 * Math.sin(time * 0.83 + lm.phase * 2.1) + 0.1 * Math.sin(time * 1.9 + lm.phase);
      lm.m.emissiveIntensity = lm.heat * glow * breathe * draught;
    }
    // the ember bounce flickers, and keeps a real daylight floor
    const flick = 1 + 0.08 * Math.sin(time * 9.3) + 0.05 * Math.sin(time * 16.1 + 1.7);
    emberLight.intensity = (0.35 + 1.15 * nk) * breathe * flick;
    // 2. the gaslights: strictly after dark
    lampMat.emissiveIntensity = 0.12 + (1.25 + 0.08 * Math.sin(time * 3.1) - 0.12) * ease;
    counterLight.intensity = ease * 0.85;
    // 2b. the GIANT SKEWER sign: a painted-and-lit board after dark, plain
    //     roast meat by day. Kept LOW (0.3) and gated on `ease`, NOT on the
    //     coals' `glow` — the sign is not hot, it is lit, and this file's whole
    //     discipline is that those two are different (lava lerps, lamps gate).
    for (const sm of signMats) sm.emissiveIntensity = 0.25 * ease;
    // 3. skewers turning on the grate — a slow deterministic roll each
    cooking.forEach((s, i) => {
      s.rotation.x = Math.sin(time * (0.5 + i * 0.11) + i * 2.1) * 0.5;
    });
    if (emitters.length) {
      // walk the smoke/spark origins ALONG the grate so the effects come off the
      // whole bed rather than one hot spot
      const s1 = hash01(Math.floor(time * 2.7) * 1.73);
      smoke?.setOrigin(-0.45 + s1 * 0.9, 0.63, -0.2 + hash01(Math.floor(time * 2.7) * 3.31) * 0.28);
      const s2 = hash01(Math.floor(time * 3.3) * 5.11);
      sparks?.setOrigin(-0.45 + s2 * 0.9, 0.57, -0.2 + hash01(Math.floor(time * 3.3) * 7.19) * 0.28);
      for (const e of emitters) e.update(time);
    }
    if (peep) peep.group.position.y = Math.abs(Math.sin(time * 2)) * 0.01; // idle shuffle
  };

  return {
    group: g,
    update,
    dispose() {
      emitters.forEach((e) => e.dispose());
      texes.forEach((x) => x.dispose());
      lavaMats.forEach((lm) => lm.m.dispose());
      lampMat.dispose();
      // the hero skewer's materials are per-mesh instances this builder mutated,
      // so they are OURS to drop (its geometries are `getGeo`-shared and are not)
      signMats.forEach((m) => m.dispose());
      coalGeo.dispose();
      counterLight.dispose();
      emberLight.dispose();
    },
  };
}

export interface EmberRoastProps {
  /** decorative queueing guest (preview flavour) */
  withGuest?: boolean;
  /** smoke + spark emitters off the coals (default true) */
  effects?: boolean;
}

/** <EmberRoast> — "Ember Roast", the Emberfall Caldera world's SKEWER GRILL, a
 *  composable stall (components/Park/Context.md): mounts the basalt grill kiosk
 *  at `position`/`rotation`; inside a <Park>, `register` (+ optional
 *  `name`/`price`/`value`) registers a selling FOOD stall with the GameManager
 *  — the serving front faces local +z, with the attach point 0.72 out that way,
 *  so aim `rotation` at the path the customers walk. Buyers walk away eating the
 *  grill's OWN 3D skewer (`heldItem`: buildHeldSkewer). */
export const EmberRoast = composableStall<EmberRoastProps>(
  'EmberRoast',
  (t, { withGuest = false, effects = true }) => buildEmberRoast(t, { withGuest, effects }),
  { name: 'Ember Roast', item: 'food', price: 4, value: 6, heldItem: buildHeldSkewer },
);

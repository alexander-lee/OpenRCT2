import * as THREE from 'three';
import { box, cyl, ball, mat, mergedBoxes, nightKOf } from '../Stage';
import type { MergedBoxSpec } from '../Stage';
import { buildPeep } from '../Guest';
import { composableStall } from '../Park';
import { TIDEWATER } from '../TidewaterScenery';

// ---------------------------------------------------------------------------
// SushiStall — TIDEWATER HOLLOW's food stall: a weathered DOCKSIDE SUSHI
// COUNTER, not a neon-Tokyo bar. Driftwood-grey plank cladding lashed with
// rope over a stone core, a slate top, an OPEN ice case (a fishmonger's chilled
// display, not a sealed glass cabinet — this is a shipwreck cove, not a mall)
// holding rows of nigiri and a few stood maki rolls, a gantry of two lashed
// posts carrying a short brine-teal noren strip, a swag of cork/glass net
// floats, a slate chalk menu and ONE paper lantern (the stall's only light,
// dark by day like every lamp — contrast EmberRoast's lava, which is not a
// lamp and never gates to zero).
//
// PALETTE: every timber/rope/rust/barnacle hex is `TIDEWATER` straight from
// TidewaterScenery (components/TidewaterScenery/Context.md) — this stall
// weathers exactly like the wreck, the anchor and the piles beside it, not
// its own invented grey. The only saturated colours are the sushi itself and
// the gantry cloth, which reuses Tidewater Hollow's own canopy pair (SetPieceKit
// TIDEWATER_HOLLOW: cream 0xe4e0cc / brine-teal 0x1f6b6a — EmberRoast's valance
// took its scorched-sailcloth pair from EMBERFALL_CALDERA the same way).
//
// Budgets: 1 real PointLight (the lantern, night-gated to zero — a paper
// lantern is unlit by day), 0 particles (a still dockside counter, matching
// the cove's own "no smoke, no spray" discipline), static repeats
// (plank cladding, chalk lines) batched through `mergedBoxes`, fine detail
// (chalk, rope-ring hardware) tagged `userData.lodDetail`. Deterministic —
// hashed sines only, never Math.random/Date.now; the updater takes ABSOLUTE
// time.
// ---------------------------------------------------------------------------

const hash01 = (n: number) => {
  const s = Math.sin(n * 12.9898 + 78.233) * 43758.5453;
  return s - Math.floor(s);
};

// ---- world timber/rope/iron, straight off TIDEWATER (no invented greys) ---
const WOOD = TIDEWATER.driftwood;
const WOOD_PALE = TIDEWATER.driftwoodPale;
const WOOD_WET = TIDEWATER.timberWet;
const ROPE = TIDEWATER.rope;
const BARNACLE = TIDEWATER.barnacle;
const RUST = TIDEWATER.rust;
// cold wet-slate counter/menu stone — NOT concrete-warm; this stood in the sea
const SLATE = 0x53545a;
const SLATE_L = 0x656570;

// the gantry's one splash of colour: Tidewater Hollow's own canopy pair
// (SetPieceKit TIDEWATER_HOLLOW palette: canopyPrimary 0xe4e0cc / canopySecondary
// 0x1f6b6a) — hardcoded here exactly as EmberRoast hardcodes EMBERFALL_CALDERA's,
// so this file has no import-time dependency on SetPieceKit
const CLOTH = 0x1f6b6a;
const CLOTH_TRIM = 0xe4e0cc;
const LANTERN_GLOW = 0xffb84c;

// ---- sushi palette: the only other saturated colour in the piece ----------
const RICE = 0xf1e7ce;
const SALMON = 0xe8916a;
const TUNA = 0x8a3a37;
const TAMAGO = 0xdcb23c;
const EBI = 0xd88a86;
const NORI = 0x1d2620;
const WASABI = 0x8bab3a;
const GINGER = 0xe8a7ad;
const ICE = 0xcfe7ec;

// ---------------------------------------------------------------------------
// SUSHI PROPS — one recipe each, used at BOTH the case scale (the sign — what
// says "this stall sells sushi") and the held-tray scale (what a buyer walks
// away with), exactly the way EmberRoast's `skewerProp` serves the grate, the
// rack and the held skewer from one function.
// ---------------------------------------------------------------------------

/** one nigiri: an oval rice pillow + a draped topping slice, hashed-jittered
 *  so no two pieces in the case match. `nori` belts one in a nori strip
 *  (tamago/eel style) so the case doesn't read as one fish repeated. */
function nigiriPiece(t: typeof THREE, s: number, topping: number, seed: number, o: { nori?: boolean } = {}): THREE.Group {
  const g = new t.Group();
  const h = hash01(seed);
  const rice = ball(t, s * 0.52, RICE, [0, s * 0.2, 0], { flat: true, rough: 0.88 });
  rice.scale.set(1.05, 0.62, 0.72);
  rice.rotation.y = h * 3;
  g.add(rice);
  if (o.nori) {
    const side = h > 0.5 ? 1 : -1;
    g.add(box(t, [s * 0.14, s * 0.4, s * 0.76], NORI, [side * s * 0.42, s * 0.2, 0], { rough: 0.7 }));
  }
  const top = ball(t, s * 0.58, topping, [0, s * 0.42, 0], { flat: true, rough: 0.42 });
  top.scale.set(1.02, 0.22, 0.74);
  top.rotation.set(0, h * 2, (h - 0.5) * 0.14);
  g.add(top);
  return g;
}

/** one maki roll stood on its cut face: a nori-wrapped cylinder with a pale
 *  rice ring and a coloured filling dot on top. */
function makiRoll(t: typeof THREE, r: number, hgt: number, fill: number, seed: number): THREE.Group {
  const g = new t.Group();
  const h = hash01(seed);
  g.add(cyl(t, r, r, hgt, NORI, [0, 0, 0], { rough: 0.62, seg: 14 }));
  g.add(cyl(t, r * 0.84, r * 0.84, hgt * 0.05, RICE, [0, hgt * 0.5 + 0.001, 0], { rough: 0.85, seg: 14 }));
  g.add(cyl(t, r * 0.32, r * 0.32, hgt * 0.06, fill, [0, hgt * 0.5 + 0.004, 0], { rough: 0.5, seg: 10 }));
  g.rotation.y = h * Math.PI * 2;
  return g;
}

// ---- the HELD sushi tray (GameManager StallConfig.heldItem) ---------------
// The 3D item a BUYER walks away with: a small wooden board carrying a PAIR
// of nigiri and a dab of wasabi (+ a curl of ginger). Peep-local units,
// fist-to-head sized (head r 0.12, fist ball r 0.05).
//
// THE FLOSS-CONE LESSON, FLAT. The hand hold spot sits 0.15 FORWARD of the
// fist ball (arm-local [0, -0.32, 0] off the anchor — EmberRoast's solved
// numbers, GameManager Context.md "Per-stall held items"), so a flat board
// left at the anchor's default z floats a clean gap ahead of the fist exactly
// like the floss cone and the skewer did. Pulling this group's own origin
// BACK onto the fist centre (offset (0, 0.06, -0.145) — the same arithmetic
// EmberRoast solved for its stick, tuned a hair for a flat board instead of a
// gripped shaft) and tipping the board back (-0.3 rad) lets the NEAR
// (handle) edge rest ON the fist while the FAR edge — carrying the food —
// lifts into view instead of drooping into the forearm. Verified with close-up
// renders (front + profile), not just the numbers: see Context.md.
export function buildHeldSushiTray(t: typeof THREE): THREE.Group {
  const g = new t.Group();
  g.position.set(0, 0.06, -0.145);
  g.rotation.x = -0.3;
  // the board: a small pale driftwood serving plank, grain running lengthwise
  g.add(box(t, [0.185, 0.011, 0.092], WOOD_PALE, [0, 0, 0.008], { tex: 'wood', repeat: [2, 1], rough: 0.72 }));
  // a shade-darker grip strip along the near (handle) edge
  g.add(box(t, [0.185, 0.004, 0.012], WOOD, [0, 0.0075, -0.038], { rough: 0.8 }));
  [-0.04, 0.04].forEach((x, i) => {
    const n = nigiriPiece(t, 0.078, i ? TUNA : SALMON, 7.1 + i * 3.3, {});
    n.position.set(x, 0.006, 0.03);
    n.rotation.y = (i ? -1 : 1) * 0.3;
    g.add(n);
  });
  // a dab of wasabi and a curl of pickled ginger tucked at the near corners —
  // the classic garnish pair, and cheap colour so the tray isn't two rice mounds
  const wasabi = ball(t, 0.014, WASABI, [0.072, 0.008, -0.018], { flat: true, rough: 0.5 });
  wasabi.scale.set(1, 0.7, 1);
  g.add(wasabi);
  const ging = ball(t, 0.013, GINGER, [-0.075, 0.007, -0.016], { flat: true, rough: 0.6 });
  ging.scale.set(1.1, 0.55, 0.9);
  g.add(ging);
  return g;
}

export interface SushiStallOpts {
  /** add the decorative queueing guest (preview flavour — in a composed park
   *  the GameManager's real guests walk up instead; default false) */
  withGuest?: boolean;
}

export interface SushiStallBuilt {
  group: THREE.Group;
  update: (time: number) => void;
  dispose: () => void;
}

/** the Sushi Stall: a driftwood-and-slate dockside counter. Group origin on
 *  the ground at the counter's centre; the SERVING FRONT faces local +z. */
export function buildSushiStall(t: typeof THREE, opts: SushiStallOpts = {}): SushiStallBuilt {
  const g = new t.Group();

  // =========================================================================
  // SCALE NOTE — sized against a 0.5-scale park guest (~0.55 u tall), the same
  // way the four catalog shops and EmberRoast are: counter top y 0.39, ice
  // case roof 0.63, gantry lintel 1.05, lantern hanging to ~0.88.
  // =========================================================================

  // =========================================================================
  // 1. THE COUNTER — a solid driftwood-clad core under a slate top, rope-
  //    lashed at both front corners where the gantry posts land.
  //    Core: x ±0.75, z -0.39…0.39, y 0…0.36.
  // =========================================================================
  g.add(box(t, [1.5, 0.36, 0.78], WOOD_WET, [0, 0.18, 0], { tex: 'wood', repeat: [5, 2], rough: 0.9, bump: 0.03 }));
  const slats: MergedBoxSpec[] = [];
  // front cladding (z 0.395): vertical driftwood plank staves, hashed-jittered
  // widths/heights so the counter reads as salvaged timber, not one board
  {
    let x = -0.74;
    let i = 0;
    while (x < 0.74) {
      const w = Math.min(0.08 + hash01(i * 3.1) * 0.05, 0.74 - x);
      slats.push({
        dims: [w, 0.33 + hash01(i * 5.7) * 0.02, 0.045],
        pos: [x + w / 2, 0.185, 0.398],
        rotZ: (hash01(i * 7.3) - 0.5) * 0.03,
        repeat: [1, 3],
      });
      x += w + 0.014;
      i += 1;
    }
  }
  // side cladding (x ±0.755)
  [-1, 1].forEach((sgn) => {
    let z = -0.38;
    let k = 0;
    while (z < 0.38) {
      const d = Math.min(0.09 + hash01(k * 4.3 + sgn) * 0.05, 0.38 - z);
      slats.push({
        dims: [0.045, 0.33 + hash01(k * 6.1) * 0.02, d],
        pos: [sgn * 0.755, 0.185, z + d / 2],
        rotX: (hash01(k * 8.9 + sgn) - 0.5) * 0.03,
        repeat: [1, 2],
      });
      z += d + 0.014;
      k += 1;
    }
  });
  g.add(mergedBoxes(t, slats, WOOD, { tex: 'wood', repeat: [1, 1], rough: 0.85, bump: 0.03, flat: true }));
  // the slate counter top, overhanging the cladding front by ~0.05
  g.add(box(t, [1.62, 0.06, 0.9], SLATE, [0, 0.39, 0.02], { tex: 'concrete', repeat: [6, 3], rough: 0.55, bump: 0.02 }));
  g.add(box(t, [1.62, 0.012, 0.9], SLATE_L, [0, 0.4225, 0.02], { rough: 0.35 })); // a wetter, glossier skin on the very top
  // worn driftwood trim along the serving lip
  g.add(box(t, [1.6, 0.03, 0.04], WOOD, [0, 0.4, 0.46], { tex: 'wood', repeat: [6, 1], rough: 0.8 }));
  // a few barnacle-crust flecks at the counter foot — this timber has been in
  // the sea like everything else in the cove, it just got fished out and reused
  const barn: MergedBoxSpec[] = [];
  for (let i = 0; i < 10; i += 1) {
    const side = hash01(i * 2.1) > 0.5 ? 1 : -1;
    barn.push({
      dims: [0.02 + hash01(i * 3.7) * 0.015, 0.014, 0.02 + hash01(i * 5.3) * 0.015],
      pos: [side * (0.3 + hash01(i * 7.1) * 0.44), 0.015, side * 0.39 * (hash01(i * 4.4) > 0.5 ? 1 : -1) * 0.9],
    });
  }
  const barnMesh = mergedBoxes(t, barn, BARNACLE, { rough: 0.9 });
  barnMesh.userData.lodDetail = true;
  g.add(barnMesh);

  // =========================================================================
  // 2. THE GANTRY — two lashed driftwood posts at the front corners rising to
  //    a lintel beam; rope rings at the counter joint are the piece's "rope
  //    lashings" (echoing DockPilings' wrapped pile shafts).
  // =========================================================================
  const postH = 1.05;
  [-1, 1].forEach((sgn) => {
    const x = sgn * 0.78;
    g.add(cyl(t, 0.036, 0.046, postH, WOOD, [x, postH / 2, 0.38], { tex: 'wood', repeat: [2, 6], rough: 0.85, seg: 10 }));
    g.add(cyl(t, 0.07, 0.084, 0.045, WOOD_WET, [x, 0.023, 0.38], { rough: 0.9, seg: 10 })); // foot flare
    // two tarred-rope rings lashing the post to the counter corner
    [0.24, 0.34].forEach((y, ri) => {
      const ring = new t.Mesh(new t.TorusGeometry(0.05, 0.012, 8, 14), mat(t, ri ? ROPE : TIDEWATER.tar, { rough: 0.85 }));
      ring.rotation.x = Math.PI / 2;
      ring.position.set(x, y, 0.38);
      ring.castShadow = true;
      g.add(ring);
    });
  });
  g.add(box(t, [1.72, 0.07, 0.09], WOOD, [0, postH, 0.38], { tex: 'wood', repeat: [6, 1], rough: 0.85 })); // lintel beam
  // a short knee-brace each side (two stubby boxes forming an angle, not one
  // long diagonal plank — the first pass's single full-length diagonal read
  // as a loose board leaning against the post rather than a built joint)
  [-1, 1].forEach((sgn) => {
    g.add(box(t, [0.028, 0.16, 0.028], WOOD, [sgn * 0.78, postH - 0.14, 0.3], { tex: 'wood', repeat: [1, 2], rough: 0.85, rotX: 0.9 }));
  });

  // ---- the NOREN — a short brine-teal split curtain off the LEFT of the
  // lintel (the world's own canopy pair, not a paper-lantern-district neon
  // banner). Kept short and to one side so it dresses the stall without
  // curtaining off the ice case guests are there to see.
  const norenX0 = -0.86;
  const norenW = 0.34;
  const PANELS = 3;
  for (let i = 0; i < PANELS; i += 1) {
    const pw = norenW / PANELS - 0.012;
    const px = norenX0 + i * (norenW / PANELS) + pw / 2;
    const sagH = 0.3 + hash01(i * 3.3) * 0.02; // a hashed-uneven hem, not a ruler-cut one
    g.add(box(t, [pw, sagH, 0.012], CLOTH, [px, postH - 0.05 - sagH / 2, 0.42], { tex: 'fabric', repeat: [1, 3], rough: 0.85 }));
  }
  g.add(box(t, [norenW + 0.02, 0.035, 0.016], CLOTH_TRIM, [norenX0 + norenW / 2, postH - 0.032, 0.421], { rough: 0.75 })); // cream head-band binding

  // ---- the FISHING FLOATS — a rope swag off the RIGHT of the lintel with a
  // handful of cork/glass net floats, balancing the noren on the other side
  // (a nod to DockPilings' draped net without hanging a whole net over food)
  const swagX0 = 0.48;
  const swagX1 = 0.86;
  const SEG = 10;
  const swagPts: THREE.Vector3[] = [];
  for (let i = 0; i <= SEG; i += 1) {
    const u = i / SEG;
    const x = swagX0 + (swagX1 - swagX0) * u;
    const sag = Math.sin(u * Math.PI) * 0.1;
    swagPts.push(new t.Vector3(x, postH - 0.04 - sag, 0.42));
  }
  const swagCurve = new t.CatmullRomCurve3(swagPts);
  const swagMesh = new t.Mesh(new t.TubeGeometry(swagCurve, 24, 0.007, 6), mat(t, ROPE, { rough: 0.85 }));
  swagMesh.castShadow = true;
  g.add(swagMesh);
  [0.18, 0.4, 0.62, 0.84].forEach((u, i) => {
    const p = swagCurve.getPoint(u);
    const r = 0.028 + hash01(i * 4.7) * 0.012;
    const cork = i % 2 === 0;
    const floatBall = ball(t, r, cork ? RUST : 0x6a9c8e, [p.x, p.y - r - 0.03, p.z], { rough: cork ? 0.75 : 0.35 });
    g.add(floatBall);
    // a short hanger strand to the swag rope
    g.add(cyl(t, 0.004, 0.004, 0.03, ROPE, [p.x, p.y - r * 0.4, p.z], { rough: 0.85, seg: 5 }));
  });

  // ---- the PAPER LANTERN — the stall's one real light, centred on the beam
  const lanternMat = new t.MeshStandardMaterial({ color: 0xf3ead0, emissive: LANTERN_GLOW, emissiveIntensity: 0.05, roughness: 0.6 });
  g.add(cyl(t, 0.006, 0.006, 0.13, WOOD, [0, postH - 0.07, 0.38], { rough: 0.8, seg: 6 })); // hanger cord
  const lanternBody = new t.Mesh(new t.SphereGeometry(0.09, 14, 10), lanternMat);
  lanternBody.scale.set(1, 1.15, 1);
  lanternBody.position.set(0, postH - 0.24, 0.38);
  lanternBody.castShadow = true;
  g.add(lanternBody);
  // ribbing — thin dark bamboo hoops around the paper
  const ribs: MergedBoxSpec[] = [];
  for (let i = 0; i < 6; i += 1) {
    const a = (i / 6) * Math.PI;
    ribs.push({ dims: [0.006, 0.208, 0.006], pos: [0, postH - 0.24, 0.38], rotY: a });
  }
  g.add(mergedBoxes(t, ribs, WOOD_WET, { rough: 0.7 }));
  g.add(cyl(t, 0.018, 0.018, 0.012, WOOD_WET, [0, postH - 0.24 + 0.105, 0.38], { rough: 0.7, seg: 8 })); // top cap
  g.add(cyl(t, 0.014, 0.014, 0.01, WOOD_WET, [0, postH - 0.24 - 0.105, 0.38], { rough: 0.7, seg: 8 })); // bottom cap
  const lanternLight = new t.PointLight(LANTERN_GLOW, 0, 1.8, 2);
  lanternLight.position.set(0, postH - 0.24, 0.34);
  g.add(lanternLight);

  // =========================================================================
  // 3. THE ICE CASE — an OPEN chilled display (a fishmonger's tray, not a
  //    sealed glass cabinet: this is a dockside stall, not a mall kiosk),
  //    crushed ice under rows of nigiri and a few stood maki rolls.
  // =========================================================================
  const caseY = 0.4225;
  g.add(box(t, [0.86, 0.05, 0.4], WOOD, [-0.02, caseY + 0.025, 0.02], { tex: 'wood', repeat: [4, 2], rough: 0.8 })); // the tray itself
  g.add(box(t, [0.9, 0.02, 0.44], WOOD_WET, [-0.02, caseY + 0.06, 0.02], { rough: 0.85 })); // rim, proud of the tray
  // crushed ice bed: small hashed-flattened chips, angular (unlike beach
  // rubble, crushed ice IS angular/faceted, so flat icosahedra read correctly)
  for (let i = 0; i < 22; i += 1) {
    const h1 = hash01(i * 2.3 + 1.1);
    const h2 = hash01(i * 5.9 + 3.7);
    const chip = ball(t, 0.028 + h1 * 0.02, ICE, [-0.36 + h2 * 0.72, caseY + 0.055 + h1 * 0.012, -0.13 + hash01(i * 7.7) * 0.26], {
      flat: true,
      rough: 0.12,
    });
    chip.scale.set(0.8 + h1 * 0.5, 0.4 + h2 * 0.3, 0.8 + h2 * 0.4);
    chip.rotation.set(h1 * 3, h2 * 3, h1 * 2);
    g.add(chip);
  }
  // 7 nigiri along the case, four toppings hashed in rotation, one nori-belted
  const NIG_TOP = [SALMON, TUNA, TAMAGO, EBI];
  for (let i = 0; i < 7; i += 1) {
    const topping = NIG_TOP[i % NIG_TOP.length];
    const n = nigiriPiece(t, 0.1, topping, i * 2.9 + 0.4, { nori: topping === TAMAGO });
    const jitterZ = (hash01(i * 6.1) - 0.5) * 0.05;
    n.position.set(-0.32 + i * 0.088, caseY + 0.065, -0.02 + jitterZ);
    n.rotation.y = (hash01(i * 3.7) - 0.5) * 0.5;
    g.add(n);
  }
  // 3 maki rolls stood at the near end of the case
  for (let i = 0; i < 3; i += 1) {
    const fill = i === 0 ? 0x6a9c46 : i === 1 ? TUNA : 0x9c7a3a;
    const m = makiRoll(t, 0.042, 0.11, fill, i * 4.4 + 1.2);
    m.position.set(0.3 + i * 0.1, caseY + 0.06 + 0.055, 0.1 + (hash01(i * 5.1) - 0.5) * 0.03);
    g.add(m);
  }

  // =========================================================================
  // 4. THE MENU — a slate chalk board on a driftwood post beside the queue
  // =========================================================================
  const menu = new t.Group();
  menu.position.set(1.4, 0, 0.7);
  menu.rotation.y = -0.8;
  menu.add(cyl(t, 0.04, 0.055, 0.64, WOOD, [0, 0.32, 0], { tex: 'wood', repeat: [2, 4], rough: 0.85, seg: 10 }));
  menu.add(box(t, [0.42, 0.32, 0.045], WOOD_WET, [0, 0.78, 0], { tex: 'wood', repeat: [3, 2], rough: 0.85 })); // frame
  menu.add(box(t, [0.36, 0.26, 0.018], SLATE, [0, 0.78, 0.028], { rough: 0.55, bump: 0.02 })); // slate face
  const chalk: MergedBoxSpec[] = [
    { dims: [0.26, 0.024, 0.006], pos: [0, 0.87, 0.038] },
    { dims: [0.2, 0.012, 0.006], pos: [-0.02, 0.83, 0.038] },
    { dims: [0.18, 0.012, 0.006], pos: [-0.03, 0.79, 0.038] },
    { dims: [0.22, 0.012, 0.006], pos: [-0.01, 0.75, 0.038] },
    { dims: [0.13, 0.012, 0.006], pos: [-0.045, 0.71, 0.038] },
  ];
  const chalkMesh = mergedBoxes(t, chalk, 0xd8d2c2, { rough: 0.85 });
  chalkMesh.userData.lodDetail = true;
  menu.add(chalkMesh);
  g.add(menu);

  // =========================================================================
  // 5. DRESSING — a small stack of spare serving boards + a coiled rope
  // =========================================================================
  const stack = new t.Group();
  stack.position.set(-0.98, 0, -0.28);
  for (let i = 0; i < 4; i += 1) {
    const b = box(t, [0.16, 0.012, 0.09], WOOD_PALE, [hash01(i * 2.3) * 0.01, 0.02 + i * 0.014, hash01(i * 4.1) * 0.01], {
      tex: 'wood',
      repeat: [2, 1],
      rough: 0.75,
    });
    b.rotation.y = (hash01(i * 5.3) - 0.5) * 0.3;
    stack.add(b);
  }
  g.add(stack);
  const coil = new t.Mesh(new t.TorusGeometry(0.09, 0.018, 8, 16), mat(t, ROPE, { rough: 0.85 }));
  coil.rotation.x = Math.PI / 2;
  coil.position.set(0.95, 0.02, -0.3);
  g.add(coil);
  const coil2 = new t.Mesh(new t.TorusGeometry(0.065, 0.015, 8, 14), mat(t, ROPE, { rough: 0.85 }));
  coil2.rotation.x = Math.PI / 2;
  coil2.position.set(0.95, 0.045, -0.3);
  g.add(coil2);

  // ---- optional decorative queueing guest ---------------------------------
  let peep: ReturnType<typeof buildPeep> | null = null;
  if (opts.withGuest) {
    peep = buildPeep(t, { shirt: 0x2f6a63, expression: 'happy' });
    peep.group.scale.setScalar(0.5);
    peep.group.position.set(0.3, 0, 0.86);
    peep.group.rotation.y = Math.PI;
    g.add(peep.group);
  }

  const update = (time: number) => {
    // day -> night gate: the paper lantern only — NEVER lit by day (this is
    // not lava; a lantern with no flame inside by day is just a paper ball)
    const nk = nightKOf(g);
    const ease = nk * nk * (3 - 2 * nk); // smoothstep
    const flicker = 1 + 0.06 * Math.sin(time * 5.1) + 0.04 * Math.sin(time * 8.7 + 1.3);
    lanternMat.emissiveIntensity = 0.05 + (1.1 * flicker - 0.05) * ease;
    lanternLight.intensity = ease * 0.85 * flicker;
    if (peep) peep.group.position.y = Math.abs(Math.sin(time * 2)) * 0.01; // idle shuffle
  };

  return {
    group: g,
    update,
    dispose() {
      lanternMat.dispose();
      lanternLight.dispose();
    },
  };
}

export interface SushiStallProps {
  /** decorative queueing guest (preview flavour) */
  withGuest?: boolean;
}

/** <SushiStall> — Tidewater Hollow's dockside sushi counter, a composable
 *  stall (components/Park/Context.md): mounts at `position`/`rotation`;
 *  inside a <Park>, `register` (+ optional `name`/`price`/`value`) registers a
 *  selling FOOD stall with the GameManager — the serving front faces local
 *  +z, with the attach point 0.72 u out that way. Buyers walk away carrying a
 *  real mini sushi tray (`heldItem`: buildHeldSushiTray), not the manager's
 *  generic burger. */
export const SushiStall = composableStall<SushiStallProps>(
  'SushiStall',
  (t, { withGuest = false }) => buildSushiStall(t, { withGuest }),
  { name: 'Dockside Sushi', item: 'food', price: 4, value: 6, heldItem: buildHeldSushiTray },
);

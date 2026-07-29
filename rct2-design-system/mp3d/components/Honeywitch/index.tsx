import * as THREE from 'three';
import { alongDir, ball, box, cyl, mat, mergedBoxes, mergedParts, mtx, nightKOf } from '../Stage';
import type { MergedBoxSpec, PartSpec } from '../Stage';
import { buildEmitter } from '../ParticleKit';
import { buildPeep } from '../Guest';
import { composableStall } from '../Park';
import { THORNWICK } from '../WyrmsHollow';
import { GLADE } from '../ThornwickScenery';

// ---------------------------------------------------------------------------
// THE HONEYWITCH — THORNWICK GLADE's food stall: a crooked half-timbered
// COTTAGE COUNTER selling HONEY CAKES and CANDIED APPLES, with a toffee
// cauldron on a tripod beside it.
//
// PALETTE: every stone/moss/ivy/lantern hex is `THORNWICK` straight from
// components/WyrmsHollow (the world's first component owns it) and every living
// tone — cap red, glow-worm green, bark, loam, iron — is `GLADE` from
// components/ThornwickScenery, exactly the way SushiStall dresses out of
// TIDEWATER and EmberRoast out of EMBERFALL. This cottage weathers like the
// ruined arch standing next to it, not like its own invented brown. The only
// saturated colours in the piece are the FOOD (honey gold, toffee amber, candy
// red) and the witch's madder-and-moss awning cloth.
//
// NOTHING HERE IS PLUMB. A witch's cottage leans: the whole shell is built
// inside a group tipped 0.035 rad, the chimney leans the other way, the roof
// ridge SAGS in the middle, the thatch courses are hashed, and the shutters
// hang at two different angles. A stall built square reads as a garden shed.
//
// THE BUILDING SAYS WHAT IT SELLS (the RCT2 rule): a stand of real candied
// apples on the counter, a board of honey cakes beside it, a honey crock with
// a dipper, and — as the SIGN — one heroic candied apple carved on the hanging
// board off the eave bracket, the same recipe as the ones for sale and the one
// a buyer walks away with.
//
// GLOW DISCIPLINE, both kinds. The TOFFEE in the cauldron is hot sugar over a
// fire: it is NOT a lamp, so `nightKOf` only LERPS its emissive and its
// PointLight keeps a real daylight floor (EmberfallScenery's lava rule, which
// this world already applies to glow-worms and flower pods). The EAVE LANTERN
// is a lamp and gates hard to dark by day. The two are deliberately different.
//
// Budgets: 2 real PointLights (the day-floored toffee bounce + the night-gated
// eave lantern), 30 particles (one wisp of chimney smoke — the cottage is
// BAKING, which is the cue that sells a cake shop), every static repeat batched
// through `mergedBoxes` / `mergedParts` (thatch courses, timber framing, cob
// panels, stone rubble, chalk, thatch pegs), fine detail tagged
// `userData.lodDetail`. Deterministic — hashed sines only, never
// Math.random / Date.now; the updater takes ABSOLUTE time.
// ---------------------------------------------------------------------------

const hash01 = (n: number) => {
  const s = Math.sin(n * 12.9898 + 78.233) * 43758.5453;
  return s - Math.floor(s);
};

// ---- the glade's own materials, no invented tones -------------------------
const STONE = THORNWICK.stone;
const STONE_D = THORNWICK.stoneDark;
const MOSS = THORNWICK.moss;
const MOSS_D = THORNWICK.mossDeep;
const OAK = 0x4a3a26; // the dark half-timbering: old smoke-blackened oak
const OAK_L = 0x6b563a; // scrubbed counter top / shutters
const COB = 0xbdae8e; // lime-washed cob infill between the timbers
const COB_D = 0xa2937a; // the damp, weathered panels
// ⚠️ THE THATCH IS A STOP DARKER THAN IT LOOKS IT SHOULD BE, ON PURPOSE. At the
// park's ~50° camera the roof is most of the piece's visible area, and at
// 0xa8905c (luma 145) it was the BRIGHTEST surface in a muted forest stall —
// brighter than the goods it exists to shelter, which is the catslide lesson in
// tone rather than in shape. The dark course tone came up at the same time: at
// 145 vs 107 (0.44 stops) the per-bundle roll below read as random BRICKS.
const THATCH = 0x9c8656; // straw thatch in the sun
const THATCH_D = 0x84714a; // the shaded courses and the eave shadow line
const IRON = GLADE.iron;
const IRON_D = GLADE.ironDark;
const LANTERN = THORNWICK.lantern;

// ---- the goods: the only saturated colours in the piece -------------------
const HONEY = 0xd9922c; // honey, and the glaze on a cake
const HONEY_PALE = 0xe8b657;
const CAKE = 0xc59450; // baked honey-cake crumb
const CAKE_DARK = 0x9a6d34; // the browned base
const CANDY = 0xa32620; // the candied apple's toffee shell — deep madder red
const CANDY_HI = 0xd4402f; // its lit side, so the shell reads GLOSSY
const TOFFEE = 0xae5f18; // molten toffee in the cauldron
const TOFFEE_HOT = 0xffb554; // its emissive tint
const STICK = 0xbfa06a; // pale hardwood stick (EmberRoast's skewer wood)
const CLOTH = 0x7a2b30; // the witch's awning: madder red…
const CLOTH_B = 0x4e6b3a; // …and the glade's own moss green

/** the toffee's day → night emissive multiplier. HOT SUGAR IS NOT A LAMP: this
 *  lerps, it never gates to zero (EmberfallScenery's house rule). */
// Kept LOW at both ends: a 0.19-radius disc of emissive is a big flat surface,
// and at 1.35 the pot rendered as a glowing golden DONUT — a lamp on a tripod
// rather than a pan of hot sugar. 0.14 → 0.8 keeps it visibly hot at noon and
// warm after dark without becoming the brightest thing in the park.
const GLOW_DAY = 0.14;
const GLOW_NIGHT = 0.8;

// ===========================================================================
// THE CANDIED APPLE — one recipe, four scales: the stand on the counter, the
// cauldron's freshly-dipped pair, the giant one carved on the sign, and the
// HELD one a buyer walks away eating.
//
// `r` is the apple radius; the stick runs DOWN local −y from inside the fruit,
// so the group origin is the apple's CENTRE and the caller places the fruit,
// not the stick. That is the right way round for every use except the held
// item, which needs the FIST at a known place — see `buildHeldCandyApple`.
// ===========================================================================
function candyApple(t: typeof THREE, r: number, stickLen: number, seed: number, o: { flat?: boolean; simple?: boolean } = {}): THREE.Group {
  const g = new t.Group();
  const h = (n: number) => hash01(seed * 2.31 + n * 3.77);
  // THE SHELL: an apple is taller than it is wide and DIMPLED at the top, so
  // the fruit is a squashed sphere with a sunken crown, not a ball. Two tones —
  // a lit side and a shaded one — because the read of a toffee shell is that it
  // is GLOSSY, and one flat red at this size reads as a cherry tomato.
  const body = ball(t, r, CANDY, [0, 0, 0], { rough: 0.22 });
  body.scale.set(1, 1.1, 0.98);
  body.rotation.y = h(1) * 3;
  g.add(body);
  // the highlight cap: a smaller, brighter shell offset toward the light.
  // `simple` drops it (and the drip) for the small instances stood in the
  // counter block and hung on the setting rack — nine apples × two extra meshes
  // each is 18 draw calls for a highlight nobody can resolve at that size.
  if (!o.simple) {
    const hi = ball(t, r * 0.82, CANDY_HI, [r * 0.2, r * 0.24, r * 0.14], { rough: 0.14 });
    hi.scale.set(1, 0.96, 0.94);
    g.add(hi);
  }
  // the DIMPLE: a dark toffee well where the stick goes in, which is what makes
  // the stick read as pushed INTO an apple rather than glued under a ball
  g.add(cyl(t, r * 0.34, r * 0.24, r * 0.16, 0x7a1a16, [0, r * 0.98, 0], { rough: 0.3, seg: 10 }));
  // a TOFFEE DRIP running down one side — the single detail that says "dipped"
  if (!o.simple) {
    const drip = ball(t, r * 0.2, CANDY_HI, [Math.cos(h(2) * 6.28) * r * 0.82, -r * 0.72, Math.sin(h(2) * 6.28) * r * 0.82], { rough: 0.18 });
    drip.scale.set(0.7, 1.5, 0.7);
    g.add(drip);
  }
  // THE STICK, entering the dimple from below and running down
  if (stickLen > 0) {
    // 0.17 R, not 0.13: a toffee-apple stick is a chunky lolly stick, and at
    // 0.13 R (a 0.017 shaft on the held item) it went sub-pixel at park zoom and
    // read, in a close-up, as if the apple were floating free of the hand
    g.add(cyl(t, r * 0.17, r * 0.2, stickLen, STICK, [0, -stickLen / 2 + r * 0.55, 0], { tex: 'wood', repeat: [1, 3], rough: 0.85, seg: 8 }));
  }
  if (o.flat) g.traverse((n) => ((n as THREE.Mesh).castShadow = false));
  return g;
}

/** one honey cake: a low domed round with a browned base and a honey glaze
 *  puddle on top, hashed so no two on the board match */
function honeyCake(t: typeof THREE, r: number, seed: number): THREE.Group {
  const g = new t.Group();
  const h = (n: number) => hash01(seed * 3.13 + n * 4.91);
  g.add(cyl(t, r * 0.94, r * 0.86, r * 0.34, CAKE_DARK, [0, r * 0.17, 0], { tex: 'asphalt', repeat: [2, 1], rough: 0.92, seg: 12 }));
  const top = ball(t, r, CAKE, [0, r * 0.36, 0], { tex: 'asphalt', repeat: [2, 2], rough: 0.88 });
  top.scale.set(1, 0.42, 1);
  top.rotation.y = h(1) * 3;
  g.add(top);
  // the glaze: a shiny honey puddle that does NOT cover the whole crown, so the
  // crumb still reads
  const glaze = ball(t, r * (0.6 + h(2) * 0.16), HONEY, [(h(3) - 0.5) * r * 0.3, r * 0.5, (h(4) - 0.5) * r * 0.3], { rough: 0.2 });
  glaze.scale.set(1, 0.16, 1);
  g.add(glaze);
  return g;
}

// ---- the HELD candied apple (GameManager StallConfig.heldItem) -------------
//
// THE FLOSS-CONE LESSON, THIRD TIME. The hand hold spot sits 0.15 FORWARD of
// the fist ball and 0.05 below it (`holdSpot` in GameManager/guestFx.ts: the
// anchor is at arm-local (±0.03, −0.37, 0.15); the fist ball is at arm-local
// (0, −0.32, 0) with r 0.05). It is sized for a FAT BURGER, so a slim item left
// near this group's own origin floats a clear 0.1 in front of the hand — which
// is exactly what happened to CottonCandyStand's floss cone, to EmberRoast's
// skewer, and to SushiStall's tray before each of them carried its own
// self-offset.
//
// So this recipe pulls itself BACK onto the fist and tips forward, using the
// same solved numbers EmberRoast's stick uses: `position (0, 0.03, −0.15)` and
// `rotation.x 0.4`. In the group's own local frame that puts the FIST CENTRE at
// about (0, 0.018, −0.008) — i.e. essentially at this group's origin — so a
// stick standing up local +y from −0.05 passes STRAIGHT THROUGH THE FIST, with
// a real bare handle poking out below the little finger and the apple riding
// clear above the grip.
//
// Peep-local units throughout: the guest rig applies the park's 0.5
// GUEST_SCALE, so never pre-scale for it, and size against the HEAD (r 0.12)
// and the fist ball (r 0.05). The apple is r 0.062 — a little smaller than the
// head, which is what a toffee apple actually looks like in a hand — and its
// bottom sits ~0.1 clear of the top of the fist, so the fruit never intersects
// the fingers, the forearm or (at full bite lift) the hair.
export function buildHeldCandyApple(three: typeof THREE): THREE.Group {
  const t = three;
  const g = new t.Group();
  g.position.set(0, 0.03, -0.15);
  // TILT 0.6, not EmberRoast's 0.4. The z self-offset is what threads the stick
  // through the fist (with dz = −0.15 the fist lands on the group's own y axis,
  // so ANY tilt keeps the stick inside the 0.05 ball); the tilt is what decides
  // how much of the stick clears the ARM BOX, which is 0.11 deep — i.e. |z| <
  // 0.055 is buried inside the sleeve. At 0.4 only 0.03 of shaft showed in front
  // of the arm before the fruit began, and the close-up read as an apple
  // floating with a stub under it. At 0.6 it is 0.075, and the apple reads HELD.
  g.rotation.x = 0.6;
  const R = 0.062;
  // the stick spans local y −0.066 … 0.274 and the fist closes at ~0.018, so
  // ~0.03 of BARE HANDLE pokes out below the little finger (0.016 in the first
  // pass, which read as no handle at all in a close-up) and the fruit's
  // underside rides 0.10 clear above the top of the grip
  const apple = candyApple(t, R, 0.34, 5.3);
  apple.position.y = 0.24;
  g.add(apple);
  return g;
}

export interface HoneywitchOpts {
  /** add the decorative queueing guest (preview flavour — in a composed park
   *  the GameManager's real guests walk up instead; default false) */
  withGuest?: boolean;
  /** the chimney's wisp of baking smoke (default true) */
  effects?: boolean;
  seed?: number;
}

export interface HoneywitchBuilt {
  group: THREE.Group;
  update: (time: number) => void;
  dispose: () => void;
}

/** the Honeywitch cottage counter. Group origin on the ground at the counter's
 *  centre; the SERVING FRONT faces local +z. */
export function buildHoneywitch(three: typeof THREE, opts: HoneywitchOpts = {}): HoneywitchBuilt {
  const t = three;
  const g = new t.Group();
  const seed = opts.seed ?? 1;
  const h = (n: number) => hash01(seed * 1.87 + n * 3.41);
  const wantFx = opts.effects ?? true;
  const mats: THREE.Material[] = [];
  const geos: THREE.BufferGeometry[] = [];
  const keep = <M extends THREE.Mesh>(m: M): M => {
    geos.push(m.geometry);
    mats.push(m.material as THREE.Material);
    return m;
  };

  // =========================================================================
  // SCALE — sized against a 0.5-scale park guest (~0.55 u tall), the same way
  // the four catalog shops, EmberRoast and SushiStall are: counter top y 0.40,
  // window head 0.74, eaves 0.86, ridge 1.24, chimney top 1.62.
  // =========================================================================
  const CTR_Y = 0.4; // the serving counter top
  const EAVE = 0.86;
  const RIDGE = 1.24;
  const HW = 0.82; // half-width of the cottage shell (x)
  const HD = 0.44; // half-depth (z)

  // NOTHING IS PLUMB: the whole shell lives in a group tipped a hair, so the
  // cottage leans into the glade. Everything hung off the building goes in
  // here; the ground dressing stays in `g` so it stays level.
  const shell = new t.Group();
  shell.rotation.z = 0.035;
  shell.rotation.x = -0.012;
  g.add(shell);

  // =========================================================================
  // 1. THE PLINTH — a course of hashed rubble stone the cob sits on, so the
  //    cottage is founded and not standing on the grass. Two tones.
  // =========================================================================
  {
    const light: PartSpec[] = [];
    const dark: PartSpec[] = [];
    let x = -HW;
    let i = 0;
    while (x < HW - 0.02) {
      const bw = Math.min(0.16 + h(i * 3.1) * 0.1, HW - x);
      const bh = 0.15 + h(i * 5.7) * 0.05;
      const spec: PartSpec = {
        geo: new t.BoxGeometry(bw * 1.02, bh, HD * 2 + 0.04 + h(i * 7.3) * 0.02),
        matrix: mtx(t, [x + bw / 2, bh / 2, 0], [0, (h(i * 9.1) - 0.5) * 0.08, 0]),
        uv: [2, 1],
      };
      (h(i * 11.3) > 0.6 ? dark : light).push(spec);
      x += bw;
      i += 1;
    }
    shell.add(keep(mergedParts(t, light, mat(t, STONE, { tex: 'concrete', repeat: [2, 2], rough: 0.95, bump: 0.07 }))));
    shell.add(keep(mergedParts(t, dark, mat(t, STONE_D, { tex: 'concrete', repeat: [2, 2], rough: 0.96, bump: 0.07 }))));
  }

  // =========================================================================
  // 2. THE HALF-TIMBERED SHELL — cob panels between smoke-black oak framing.
  //    This is the piece's whole identity, so the framing is REAL: sill, wall
  //    posts, a mid rail, a head beam, and two braces per bay set at opposite
  //    angles. A grid of even squares reads as a Tudor pub; a witch's cottage
  //    has bays of different widths with the braces going different ways.
  // =========================================================================
  const WALL_Y0 = 0.18;
  const WALL_Y1 = EAVE;
  {
    const cob: MergedBoxSpec[] = [];
    const cobD: MergedBoxSpec[] = [];
    const timber: MergedBoxSpec[] = [];
    const T = 0.055; // timber gauge
    // the cob body first, then the framing laid ON it (proud by half the gauge)
    cob.push({ dims: [HW * 2 - 0.02, WALL_Y1 - WALL_Y0, HD * 2], pos: [0, (WALL_Y0 + WALL_Y1) / 2, 0], repeat: [6, 3] });
    // sill, head and mid rail, all four faces
    for (const [y, th] of [
      [WALL_Y0, T],
      [WALL_Y1, T * 1.25],
      [(WALL_Y0 + WALL_Y1) * 0.52, T * 0.85],
    ] as const) {
      timber.push({ dims: [HW * 2 + 0.02, th, HD * 2 + 0.02], pos: [0, y, 0], repeat: [8, 1] });
    }
    // wall POSTS at four hashed bay boundaries, plus the corners
    const bays = [-HW, -HW * 0.42 + (h(21) - 0.5) * 0.1, HW * 0.06 + (h(22) - 0.5) * 0.12, HW * 0.54 + (h(23) - 0.5) * 0.1, HW];
    for (const bx of bays) timber.push({ dims: [T * 1.2, WALL_Y1 - WALL_Y0, HD * 2 + 0.03], pos: [bx, (WALL_Y0 + WALL_Y1) / 2, 0], repeat: [1, 3] });
    // BRACES: one diagonal per bay, alternating direction, on the front face
    for (let b = 0; b + 1 < bays.length; b += 1) {
      const x0 = bays[b] + T * 0.7;
      const x1 = bays[b + 1] - T * 0.7;
      const bw = x1 - x0;
      if (bw < 0.06) continue;
      const up = b % 2 === 0;
      const len = Math.hypot(bw, (WALL_Y1 - WALL_Y0) * 0.46);
      timber.push({
        dims: [T * 0.8, len, T * 0.9],
        pos: [(x0 + x1) / 2, (WALL_Y0 + WALL_Y1) * 0.5 + (up ? 0.02 : -0.02), HD + 0.012],
        rotZ: (up ? 1 : -1) * Math.atan2(bw, (WALL_Y1 - WALL_Y0) * 0.46),
        repeat: [1, 2],
      });
      // and the damp panel behind that bay, on the front only
      cobD.push({
        dims: [bw * 0.9, (WALL_Y1 - WALL_Y0) * (0.3 + h(b * 13) * 0.3), 0.012],
        pos: [(x0 + x1) / 2, WALL_Y0 + (WALL_Y1 - WALL_Y0) * (0.2 + h(b * 17) * 0.4), HD + 0.007],
        repeat: [2, 1],
      });
    }
    shell.add(keep(mergedBoxes(t, cob, COB, { tex: 'concrete', repeat: [1, 1], rough: 0.96, bump: 0.05 })));
    const dm = keep(mergedBoxes(t, cobD, COB_D, { tex: 'concrete', repeat: [1, 1], rough: 0.97, bump: 0.05 }));
    dm.userData.lodDetail = true;
    shell.add(dm);
    shell.add(keep(mergedBoxes(t, timber, OAK, { tex: 'wood', repeat: [1, 1], rough: 0.9, bump: 0.05 })));
  }

  // =========================================================================
  // 3. THE SERVING HATCH + COUNTER — the open bay guests are served through,
  //    cut into the FRONT (+z) face: a scrubbed oak counter shelf on two
  //    corbels, a lintel over it, and the dark cottage interior behind, so the
  //    hatch reads as a hole in a wall and not as a painted rectangle.
  // =========================================================================
  const HATCH_HW = 0.44;
  {
    // the dark interior behind the hatch (a recess, in near-black)
    shell.add(keep(box(t, [HATCH_HW * 2, CTR_Y + 0.3 - 0.2, 0.02], 0x191510, [0, (0.2 + CTR_Y + 0.3) / 2, HD - 0.055], { rough: 1 })));
    // the counter shelf, overhanging the wall face
    shell.add(keep(box(t, [HATCH_HW * 2 + 0.24, 0.055, 0.34], OAK_L, [0, CTR_Y, HD + 0.08], { tex: 'wood', repeat: [7, 2], rough: 0.72, bump: 0.03 })));
    shell.add(keep(box(t, [HATCH_HW * 2 + 0.26, 0.02, 0.04], OAK, [0, CTR_Y + 0.037, HD + 0.24], { tex: 'wood', repeat: [7, 1], rough: 0.8 }))); // worn front lip
    // two corbels under it
    for (const sx of [-1, 1] as const)
      shell.add(
        keep(box(t, [0.05, 0.13, 0.13], OAK, [sx * (HATCH_HW + 0.04), CTR_Y - 0.1, HD + 0.06], { tex: 'wood', repeat: [1, 2], rough: 0.88, rotX: -0.5 })),
      );
    // the lintel over the hatch
    shell.add(keep(box(t, [HATCH_HW * 2 + 0.16, 0.07, 0.1], OAK, [0, CTR_Y + 0.32, HD + 0.03], { tex: 'wood', repeat: [6, 1], rough: 0.9, bump: 0.04 })));
    // the SHUTTER, propped open above the hatch on two struts — the detail that
    // makes it a cottage window and not a serving slot
    const shutter = new t.Group();
    shutter.position.set(0, CTR_Y + 0.35, HD + 0.06);
    shutter.rotation.x = -0.95;
    const boards: MergedBoxSpec[] = [];
    for (let i = 0; i < 6; i += 1)
      boards.push({ dims: [(HATCH_HW * 2) / 6 - 0.008, 0.016, 0.3], pos: [-HATCH_HW + ((i + 0.5) * (HATCH_HW * 2)) / 6, 0, 0.15], repeat: [1, 3] });
    shutter.add(keep(mergedBoxes(t, boards, OAK_L, { tex: 'wood', repeat: [1, 1], rough: 0.82, bump: 0.03 })));
    shutter.add(keep(box(t, [HATCH_HW * 2, 0.02, 0.035], IRON_D, [0, 0.018, 0.24], { rough: 0.7, metal: 0.28 }))); // a strap hinge band
    shell.add(shutter);
    for (const sx of [-1, 1] as const)
      shell.add(keep(cyl(t, 0.012, 0.014, 0.3, OAK, [sx * HATCH_HW * 0.8, CTR_Y + 0.47, HD + 0.16], { rough: 0.88, seg: 6, rotX: 0.5 })));
  }

  // =========================================================================
  // 4. THE THATCH — a SAGGING, ASYMMETRIC CATSLIDE roof, which is the
  //    silhouette a witch's cottage lives or dies by.
  //
  //    ⚠️ THE FRONT SLOPE IS SHORT ON PURPOSE. The first pass gave both slopes
  //    the same 0.61 overhang, and from the park camera (which looks DOWN at
  //    ~50°) the front eave hung right over the counter: the whole cottage
  //    rendered as a giant brown haystack with the apples, the cakes, the honey
  //    crock and the half-timbering — everything the shop is for — buried in
  //    its shadow. This is EmberRoast's flue-hood lesson in another shape.
  //    So the ridge sits BACK of centre and the roof is a CATSLIDE: a short
  //    steep front slope that clears the goods, and a long shallow back slope
  //    running nearly to the ground, which is a real cottage form and a much
  //    better silhouette than a symmetrical tent.
  //
  //    ⚠️ AND THE BUNDLES ARE NARROW. At 0.13-0.22 wide they read as PLANKS.
  //    Thatch is a mass of small bundles, so they are 0.055-0.10 here, laid in
  //    courses whose lower lip stands proud of the course below, which is what
  //    puts the stepped shadow lines into a thatched roof.
  // =========================================================================
  const FRONT_Z = HD + 0.07; // short: the counter and its goods stay in daylight
  const BACK_Z = HD + 0.36; // long catslide, down the back where nothing is sold
  const RIDGE_Z = -0.1; // the ridge sits back of centre
  const ridgeY = (x: number) => RIDGE - 0.055 * Math.cos((x / HW) * Math.PI * 0.5) ** 2;
  {
    const straw: MergedBoxSpec[] = [];
    const strawD: MergedBoxSpec[] = [];
    const NC = 7; // courses from eave to ridge
    for (const side of [1, -1] as const) {
      // +1 = the short FRONT slope, −1 = the long BACK catslide
      const eaveZ = side > 0 ? FRONT_Z : -BACK_Z;
      const run = Math.abs(eaveZ - RIDGE_Z);
      const eaveY = side > 0 ? EAVE - 0.06 : EAVE - 0.22; // the catslide drops lower
      for (let c = 0; c < NC; c += 1) {
        // ⚠️ COURSES ARE NOT EVENLY PITCHED. At (c + 0.5)/NC every course line was
        // dead straight and dead evenly spaced up the slope, which is half of why
        // the roof read as a BRICK GRID from the park camera; a real thatcher's
        // courses wander. ±0.055 of the pitch is enough to break the rhythm and
        // small enough that the 1.5× lap still covers.
        const u = (c + 0.5) / NC + (h(c * 13.7 + (side > 0 ? 3 : 89)) - 0.5) * 0.11 / NC * 7;
        const zc = eaveZ + (RIDGE_Z - eaveZ) * u;
        // and each course STARTS at a different offset, so the bundle joints
        // never stack into columns
        let x = -HW - 0.11 - h(c * 17.3 + (side > 0 ? 11 : 97)) * 0.09;
        let i = 0;
        while (x < HW + 0.11) {
          const bw = 0.055 + h(c * 31 + i * 3.7 + (side > 0 ? 0 : 101)) * 0.045;
          const yMid = eaveY + (ridgeY(x) - eaveY) * u;
          const pitch = -side * Math.atan2(RIDGE - eaveY, run);
          const spec: MergedBoxSpec = {
            // depth 1.5x the course pitch, so each course laps the one below and
            // the lap line reads as the stepped shadow a thatched roof has
            dims: [Math.min(bw, HW + 0.11 - x) * 1.04, 0.075 + h(c * 37 + i) * 0.03, (run / NC) * 1.5],
            pos: [x + bw / 2, yMid + (h(c * 41 + i) - 0.5) * 0.014, zc],
            rotX: pitch,
            rotZ: (h(c * 43 + i) - 0.5) * 0.05,
            repeat: [1, 1],
          };
          // ⚠️ THE DARK TONE MUST STREAK DOWN THE SLOPE, NOT SPECKLE ACROSS IT.
          // A per-bundle `h(...) > 0.66` roll put a random third of the bundles
          // dark, and runs of two to four of them merged into rectangles: from
          // the ~50° park camera the roof read as courses of BRICKWORK — the
          // "scatter reads as confetti" failure, in two tones on a lattice.
          // Thatch weathers in vertical DAMP STREAKS, so the roll is carried by a
          // low-frequency function of x (shared by every course, hence continuous
          // from eave to ridge) with only a little per-bundle noise on top. The
          // lowest course still goes dark whole: an eave course is in its shade.
          const streak = 0.5 + 0.42 * Math.sin(x * 5.3 + side * 1.7) + 0.2 * Math.sin(x * 11.9 + 0.6);
          (c === 0 || streak + (h(c * 47 + i) - 0.5) * 0.24 > 0.72 ? strawD : straw).push(spec);
          x += bw;
          i += 1;
        }
      }
    }
    // the RIDGE cap: a run of bundles laid ALONG the swayback
    {
      let x = -HW - 0.14;
      let i = 0;
      while (x < HW + 0.14) {
        const bw = 0.15 + h(i * 5.3 + 61) * 0.1;
        straw.push({
          dims: [Math.min(bw, HW + 0.14 - x) * 1.04, 0.1, 0.24],
          pos: [x + bw / 2, ridgeY(x + bw / 2) + 0.02, RIDGE_Z],
          rotZ: (h(i * 7.1 + 62) - 0.5) * 0.06,
          repeat: [2, 1],
        });
        x += bw;
        i += 1;
      }
    }
    shell.add(keep(mergedBoxes(t, straw, THATCH, { tex: 'fabric', repeat: [1, 1], rough: 0.96, bump: 0.09, flat: true })));
    shell.add(keep(mergedBoxes(t, strawD, THATCH_D, { tex: 'fabric', repeat: [1, 1], rough: 0.97, bump: 0.09, flat: true })));

    // THATCH PEGS: bent hazel staples pinning the ridge, close-up only. Without
    // them the ridge is a sausage; with them it is thatched.
    const pegs: MergedBoxSpec[] = [];
    for (let i = 0; i < 14; i += 1) {
      const px = -HW + (i / 13) * HW * 2;
      const pz = (i % 2 ? 1 : -1) * 0.11;
      pegs.push({ dims: [0.012, 0.09, 0.012], pos: [px, ridgeY(px) + 0.03, RIDGE_Z + pz], rotX: (i % 2 ? -1 : 1) * 0.5 });
      pegs.push({ dims: [0.012, 0.012, 0.07], pos: [px, ridgeY(px) + 0.07, RIDGE_Z + pz * 0.6] });
    }
    const pegMesh = keep(mergedBoxes(t, pegs, OAK, { rough: 0.9 }));
    pegMesh.userData.lodDetail = true;
    shell.add(pegMesh);

    // MOSS along the ridge and down the north slope — the glade furs every
    // horizontal, and a mossy thatch is the difference between "cottage" and
    // "new build"
    const mossParts: PartSpec[] = [];
    for (let i = 0; i < 22; i += 1) {
      const mx = -HW + h(i * 2.9 + 71) * HW * 2;
      // moss grows on the long, shaded BACK slope and along the ridge — never
      // on the sunny front, which is the side guests look at
      const u = 0.35 + h(i * 3.7 + 72) * 0.62; // 0 eave … 1 ridge
      const mz = -BACK_Z + (RIDGE_Z + BACK_Z) * u;
      const my = EAVE - 0.22 + (ridgeY(mx) - (EAVE - 0.22)) * u + 0.05;
      const ms = 0.06 + h(i * 5.1 + 73) * 0.07;
      mossParts.push({
        geo: new t.IcosahedronGeometry(1, 0),
        matrix: mtx(t, [mx, my, mz], [0, h(i * 7.9 + 74) * 3, 0], [ms, ms * 0.3, ms * 0.9]),
        uv: [1, 1],
      });
    }
    const mm = keep(mergedParts(t, mossParts, mat(t, MOSS, { tex: 'grass', repeat: [1, 1], rough: 0.96, bump: 0.06, flat: true })));
    mm.castShadow = false;
    shell.add(mm);
  }

  // ---- THE LOG STORE under the catslide. The long back slope reaches out
  // 0.80 past a wall that stops at 0.44, so from behind there was a clear void
  // under the roof with the grass showing through it — a lean-to with nothing
  // in it. A cottage that bakes and boils toffee keeps its firewood exactly
  // there, so: a boarded back panel closing the gap and a stack of split log
  // ENDS (cylinders on end, hashed) under the slope. It also explains the fire
  // under the cauldron.
  {
    const backs: MergedBoxSpec[] = [];
    let bx = -HW + 0.02;
    let bi = 0;
    while (bx < HW - 0.02) {
      const bw = 0.09 + h(bi * 3.7 + 211) * 0.05;
      backs.push({
        dims: [Math.min(bw, HW - 0.02 - bx) * 1.02, 0.44 + h(bi * 5.1 + 212) * 0.03, 0.02],
        pos: [bx + bw / 2, 0.22, -(BACK_Z - 0.09)],
        rotZ: (h(bi * 7.3 + 213) - 0.5) * 0.03,
        repeat: [1, 3],
      });
      bx += bw;
      bi += 1;
    }
    shell.add(keep(mergedBoxes(t, backs, OAK_L, { tex: 'wood', repeat: [1, 1], rough: 0.9, bump: 0.04 })));
    // the split logs, stacked end-on in three rows
    const logEnds: PartSpec[] = [];
    const bark: PartSpec[] = [];
    for (let row = 0; row < 3; row += 1) {
      for (let k = 0; k < 9; k += 1) {
        const lr = 0.032 + h(row * 11 + k * 2.9 + 221) * 0.014;
        const lx = -HW + 0.12 + k * 0.16 + (row % 2 ? 0.06 : 0);
        if (lx > HW - 0.1) continue;
        const ly = 0.05 + row * 0.082 + h(row * 13 + k) * 0.006;
        const lz = -(BACK_Z - 0.24) + (h(row * 17 + k) - 0.5) * 0.05;
        const geo = new t.CylinderGeometry(lr, lr, 0.18, 9, 1);
        (h(row * 19 + k) > 0.5 ? logEnds : bark).push({ geo, matrix: mtx(t, [lx, ly, lz], [Math.PI / 2, (h(row * 23 + k) - 0.5) * 0.2, 0]), uv: [1, 1] });
      }
    }
    if (logEnds.length) shell.add(keep(mergedParts(t, logEnds, mat(t, 0xc0a878, { tex: 'wood', repeat: [1, 1], rough: 0.94, bump: 0.05, flat: true }))));
    if (bark.length) shell.add(keep(mergedParts(t, bark, mat(t, GLADE.bark, { tex: 'wood', repeat: [1, 1], rough: 0.96, bump: 0.06, flat: true }))));
  }

  // =========================================================================
  // 5. THE CROOKED CHIMNEY — leaning the OTHER way to the cottage, on the −x
  //    gable, in the same hashed rubble as the plinth, with a stone cap and an
  //    ivy-ish moss run up it. The smoke is what says "baking".
  // =========================================================================
  const chimney = new t.Group();
  chimney.position.set(-HW + 0.1, 0, -0.14);
  chimney.rotation.z = -0.075;
  shell.add(chimney);
  const smokeAt: [number, number, number] = [-HW + 0.1 - 0.12, 1.66, -0.14];
  {
    const light: PartSpec[] = [];
    const dark: PartSpec[] = [];
    let y = 0.1;
    let i = 0;
    while (y < 1.5) {
      const bh = 0.11 + h(i * 3.3 + 81) * 0.05;
      const taper = 1 - (y / 1.5) * 0.3;
      const spec: PartSpec = {
        geo: new t.BoxGeometry(0.23 * taper, bh * 1.03, 0.23 * taper),
        matrix: mtx(t, [(h(i * 5.9 + 82) - 0.5) * 0.02, y + bh / 2, (h(i * 7.7 + 83) - 0.5) * 0.02], [0, (h(i * 9.3) - 0.5) * 0.14, 0]),
        uv: [1, 1],
      };
      (h(i * 11.9 + 84) > 0.58 ? dark : light).push(spec);
      y += bh;
      i += 1;
    }
    // the CAP: a projecting stone slab and a short pot
    light.push({ geo: new t.BoxGeometry(0.24, 0.036, 0.24), matrix: mtx(t, [0, 1.52, 0]), uv: [1, 1] });
    dark.push({ geo: new t.CylinderGeometry(0.058, 0.066, 0.12, 10, 1), matrix: mtx(t, [0, 1.585, 0]), uv: [1, 1] });
    chimney.add(keep(mergedParts(t, light, mat(t, STONE, { tex: 'concrete', repeat: [2, 2], rough: 0.95, bump: 0.07 }))));
    chimney.add(keep(mergedParts(t, dark, mat(t, STONE_D, { tex: 'concrete', repeat: [2, 2], rough: 0.96, bump: 0.07 }))));
    // moss creeping up the shaded side
    const mp: PartSpec[] = [];
    for (let k = 0; k < 9; k += 1) {
      const my = 0.15 + h(k * 2.7 + 91) * 1.2;
      const ms = 0.04 + h(k * 4.3 + 92) * 0.05;
      mp.push({
        geo: new t.IcosahedronGeometry(1, 0),
        matrix: mtx(t, [-0.115, my, (h(k * 6.1) - 0.5) * 0.16], [0, h(k * 8.9) * 3, 0], [ms * 0.34, ms, ms]),
        uv: [1, 1],
      });
    }
    const cm = keep(mergedParts(t, mp, mat(t, MOSS_D, { tex: 'grass', repeat: [1, 1], rough: 0.96, flat: true })));
    cm.castShadow = false;
    chimney.add(cm);
  }

  // =========================================================================
  // 6. THE AWNING — a short valance of madder-and-moss cloth off the eave over
  //    the counter, on two hashed-uneven hems. Kept SHORT and above the head
  //    beam so it dresses the front without curtaining off the goods guests
  //    are here to look at (EmberRoast's flue-hood lesson: nothing sits over
  //    the thing you are selling).
  // =========================================================================
  {
    const bar = keep(cyl(t, 0.014, 0.014, HATCH_HW * 2 + 0.3, IRON, [0, EAVE - 0.03, HD + 0.3], { rough: 0.62, metal: 0.28, seg: 8, rotZ: Math.PI / 2 }));
    shell.add(bar);
    const panels = 7;
    const span = HATCH_HW * 2 + 0.26;
    const scallops: MergedBoxSpec[] = [];
    const scallopsB: MergedBoxSpec[] = [];
    for (let i = 0; i < panels; i += 1) {
      const pw = span / panels - 0.01;
      const px = -span / 2 + (i + 0.5) * (span / panels);
      const sag = 0.14 + h(i * 3.9 + 101) * 0.03;
      (i % 2 ? scallopsB : scallops).push({ dims: [pw, sag, 0.012], pos: [px, EAVE - 0.04 - sag / 2, HD + 0.3], repeat: [1, 2] });
    }
    shell.add(keep(mergedBoxes(t, scallops, CLOTH, { tex: 'fabric', repeat: [1, 1], rough: 0.88 })));
    shell.add(keep(mergedBoxes(t, scallopsB, CLOTH_B, { tex: 'fabric', repeat: [1, 1], rough: 0.88 })));
    // the two iron stays holding the bar out from the wall
    const stays: MergedBoxSpec[] = [];
    for (const sx of [-1, 1] as const) {
      const a = new t.Vector3(sx * (HATCH_HW + 0.1), EAVE - 0.02, HD + 0.02);
      const b = new t.Vector3(sx * (HATCH_HW + 0.1), EAVE - 0.03, HD + 0.3);
      const dir = b.clone().sub(a);
      const m = new t.Matrix4().makeRotationFromQuaternion(
        new t.Quaternion().setFromUnitVectors(new t.Vector3(0, 1, 0), dir.clone().normalize()),
      );
      m.setPosition(a.clone().addScaledVector(dir, 0.5));
      stays.push({ dims: [0.016, dir.length(), 0.016], matrix: m });
    }
    shell.add(keep(mergedBoxes(t, stays, IRON, { rough: 0.62, metal: 0.28 })));
  }

  // =========================================================================
  // 7. THE SIGN — RCT2 style, the building says what it sells: a painted board
  //    hung on a wrought-iron scroll bracket off the +x gable eave, carrying
  //    ONE HEROIC CANDIED APPLE (the same `candyApple` recipe as the ones for
  //    sale and the one a buyer carries away) over a honeycomb roundel.
  // =========================================================================
  {
    const bx = HW - 0.02;
    const by = EAVE - 0.02;
    const bracket: MergedBoxSpec[] = [
      { dims: [0.3, 0.026, 0.026], pos: [bx + 0.16, by + 0.14, 0.1] },
      { dims: [0.026, 0.16, 0.026], pos: [bx + 0.02, by + 0.07, 0.1] },
      { dims: [0.13, 0.02, 0.02], pos: [bx + 0.08, by + 0.08, 0.1], rotZ: 0.7 }, // the scroll stay
      { dims: [0.05, 0.05, 0.03], pos: [bx + 0.01, by + 0.14, 0.1] },
    ];
    shell.add(keep(mergedBoxes(t, bracket, IRON, { tex: 'metal', repeat: [2, 1], rough: 0.6, metal: 0.28, bump: 0.03 })));
    const board = new t.Group();
    board.position.set(bx + 0.3, by - 0.14, 0.1);
    board.rotation.y = -0.42; // angled out toward the approach
    board.add(keep(box(t, [0.34, 0.3, 0.03], OAK_L, [0, 0, 0], { tex: 'wood', repeat: [3, 3], rough: 0.8, bump: 0.03 })));
    board.add(keep(box(t, [0.36, 0.028, 0.04], OAK, [0, 0.155, 0], { tex: 'wood', repeat: [3, 1], rough: 0.85 })));
    board.add(keep(box(t, [0.36, 0.028, 0.04], OAK, [0, -0.155, 0], { tex: 'wood', repeat: [3, 1], rough: 0.85 })));
    // the painted honeycomb roundel behind the apple: six little hexagon cells
    const comb: MergedBoxSpec[] = [];
    for (let k = 0; k < 6; k += 1) {
      const a = (k / 6) * Math.PI * 2;
      comb.push({ dims: [0.055, 0.055, 0.006], pos: [Math.cos(a) * 0.085, Math.sin(a) * 0.085, 0.017], rotZ: a });
    }
    comb.push({ dims: [0.055, 0.055, 0.006], pos: [0, 0, 0.017], rotZ: 0.4 });
    const combMesh = keep(mergedBoxes(t, comb, HONEY_PALE, { rough: 0.6 }));
    combMesh.userData.lodDetail = true;
    board.add(combMesh);
    // THE HERO APPLE, carved proud of the board
    const hero = candyApple(t, 0.088, 0.17, 9.7);
    hero.position.set(0, 0.03, 0.075);
    hero.rotation.z = 0.2;
    board.add(hero);
    // two hanger links
    for (const sx of [-1, 1] as const) shell.add(keep(cyl(t, 0.008, 0.008, 0.12, IRON_D, [bx + 0.3 + sx * 0.1 * Math.cos(0.42), by - 0.02, 0.1 - sx * 0.1 * Math.sin(-0.42)], { rough: 0.6, metal: 0.28, seg: 6 })));
    shell.add(board);
  }

  // =========================================================================
  // 7b. THE GIANT CANDIED APPLE — the building says what it sells AT PARK SCALE
  //
  //     ⚠️ THE 0.088-R SIGN APPLE ABOVE IS INVISIBLE FROM THE PARK CAMERA. It is
  //     the right size for a guest standing at the counter and it is ONE RED
  //     PIXEL from a high overhead shot at ride distance, where this cottage
  //     reads as a brown thatch rectangle among rides ten times its size.
  //     CottonCandyStand and BurgerShop never have this problem because THE SHOP
  //     IS THE ITEM — a 2.1-u sesame bun, a 1.7-u floss cloud — so the
  //     SILHOUETTE alone says what is sold, from any distance, with no detail
  //     needing to resolve.
  //
  //     This cottage cannot BE an apple without throwing away the catslide, the
  //     half-timbering and the recessed hatch, so it takes the exemplars' move
  //     one step down: ONE candied apple at 0.60 R — 6.8× the sign apple,
  //     1.20 wide × 1.32 tall — planted through the roof ridge on its own 1.5-u
  //     stick. That makes the APPLE, not the thatch, the largest single shape in
  //     the piece (thatch reads ~1.6 × 0.9 in plan; the apple is a 1.2 disc of
  //     saturated madder red against it) and lifts the stall's top from 1.62 to
  //     2.66. Same `candyApple` recipe as the counter stand, the cauldron rack,
  //     the hanging sign and the held item — a FIFTH scale, no new vocabulary.
  //
  //     WHY THE RIDGE AND NOT THE GABLE. Hung off the +x gable beside the
  //     existing board a 1.2-wide apple would push the footprint from x 1.39 to
  //     ~1.6, straight into the cauldron and the approach. Over the ridge it
  //     lives inside x ±0.60 / z −0.69…0.49 — entirely within the measured
  //     2.71 × 1.84 footprint — so the registered body (hx 0.6, hz 0.42), the
  //     queue and the 0.72-u attach point are untouched.
  //
  //     IT CASTS NO SHADOW, on purpose. A 1.3-u ball 2 u up would drop a disc of
  //     shade across the counter, which is the catslide lesson in a third shape
  //     ("nothing sits over the thing you are selling") — and it saves the
  //     shadow-pass draws as well. Cost: 5 draws — the apple's own meshes and
  //     NOTHING ELSE.
  //
  //     ⚠️ NO SOCKET COLLAR, and the y was measured rather than guessed. The
  //     first pass sat the apple at y 2.00 over a two-box iron socket on the
  //     ridge; rendered, the socket was ENTIRELY INSIDE the fruit (collar top
  //     1.44 against an apple underside at 1.34) — a draw call for geometry no
  //     camera can ever see. The apple is at y 1.90 instead, which puts its
  //     underside at 1.24 against a sagging ridge line of `ridgeY(0)` = 1.185 and
  //     a ridge-cap crown at 1.255: it is SEATED IN THE THATCH, its stick spears
  //     down through the roof to y 0.73, and nothing floats.
  // =========================================================================
  const signMats: THREE.MeshStandardMaterial[] = [];
  {
    const hero = candyApple(t, 0.6, 1.5, 13.1);
    hero.position.set(0, 1.9, RIDGE_Z);
    hero.rotation.z = -0.06; // leans back a hair against the cottage's own tip
    hero.traverse((n) => {
      const m = n as THREE.Mesh;
      if (!(m as unknown as { isMesh?: boolean }).isMesh) return;
      m.castShadow = false;
      geos.push(m.geometry);
      const mm = m.material as THREE.MeshStandardMaterial;
      mats.push(mm);
      // the STICK is the one mapped material in the recipe (tex 'wood'), and
      // `mat()` bakes the colour INTO the texture and leaves `material.color`
      // white — so a plain emissive on it glows WHITE. It is buried in the
      // thatch anyway, so it simply opts out.
      if (mm.map) return;
      // A LIT SIGN AFTER DARK. The apple's centre is 2.0 u up — far outside the
      // eave lantern's 3.2-u falloff at any useful intensity — so at night the
      // one thing that makes this stall findable would be the darkest surface in
      // the piece. `mat()` never shares a material instance, so a night-gated
      // emissive on the apple's OWN materials costs no light and no draw call.
      mm.emissive.setHex(CANDY_HI);
      signMats.push(mm);
    });
    shell.add(hero);
  }

  // =========================================================================
  // 8. THE GOODS ON THE COUNTER — the whole point of the stall.
  //    A drilled block of candied apples standing up, a board of honey cakes,
  //    a honey crock with a dipper, and a cut honeycomb frame.
  // =========================================================================
  const counterTop = CTR_Y + 0.028;
  {
    // ---- THE APPLE STAND: a drilled oak block with SEVEN apples stood in it,
    // which is the shop's sign at counter level
    const stand = new t.Group();
    stand.position.set(-0.24, counterTop, HD + 0.09);
    stand.add(keep(box(t, [0.29, 0.035, 0.17], OAK, [0, 0.017, 0], { tex: 'wood', repeat: [3, 1], rough: 0.85, bump: 0.03 })));
    const holes: MergedBoxSpec[] = [];
    for (let i = 0; i < 7; i += 1) {
      const col = i % 4;
      const row = Math.floor(i / 4);
      const ax = -0.105 + col * 0.07;
      const az = -0.035 + row * 0.07;
      holes.push({ dims: [0.028, 0.008, 0.028], pos: [ax, 0.036, az] });
      const ap = candyApple(t, 0.036, 0.15, 3.1 + i * 2.7, { simple: true });
      ap.position.set(ax, 0.035 + 0.115, az);
      ap.rotation.z = (h(i * 13 + 111) - 0.5) * 0.22;
      ap.rotation.x = (h(i * 17 + 112) - 0.5) * 0.18;
      stand.add(ap);
    }
    const holeMesh = keep(mergedBoxes(t, holes, 0x241c12, { rough: 1 }));
    holeMesh.userData.lodDetail = true;
    stand.add(holeMesh);
    shell.add(stand);

    // ---- THE CAKE BOARD: five honey cakes on a pale board under a little
    // domed cloche of nothing (no glass — this is a hatch in a wood, and a
    // sealed cabinet reads as a mall kiosk: SushiStall's open-ice-case call)
    const boardG = new t.Group();
    boardG.position.set(0.2, counterTop, HD + 0.1);
    boardG.add(keep(box(t, [0.34, 0.016, 0.19], OAK_L, [0, 0.008, 0], { tex: 'wood', repeat: [4, 2], rough: 0.75 })));
    for (let i = 0; i < 5; i += 1) {
      const col = i % 3;
      const row = Math.floor(i / 3);
      const c = honeyCake(t, 0.042, 4.3 + i * 3.1);
      c.position.set(-0.105 + col * 0.105 + row * 0.05, 0.016, -0.042 + row * 0.084);
      c.rotation.y = h(i * 19 + 121) * 3;
      boardG.add(c);
    }
    shell.add(boardG);

    // ---- THE HONEY CROCK with a dipper standing in it, and a drip on the
    // counter (a crock with nothing coming out of it is a jar)
    const crock = new t.Group();
    crock.position.set(0.5, counterTop, HD - 0.02);
    crock.add(keep(cyl(t, 0.055, 0.045, 0.11, 0x6b5442, [0, 0.055, 0], { tex: 'concrete', repeat: [2, 1], rough: 0.75, seg: 12 })));
    crock.add(keep(cyl(t, 0.062, 0.058, 0.016, 0x584535, [0, 0.113, 0], { rough: 0.7, seg: 12 }))); // the lip
    const honeyPool = keep(cyl(t, 0.05, 0.05, 0.012, HONEY, [0, 0.108, 0], { rough: 0.15, seg: 12 }));
    crock.add(honeyPool);
    // the dipper, leaning in the crock
    crock.add(keep(cyl(t, 0.006, 0.007, 0.16, STICK, [0.03, 0.16, 0.015], { rough: 0.85, seg: 6, rotZ: -0.3 })));
    for (let k = 0; k < 4; k += 1)
      crock.add(keep(cyl(t, 0.017, 0.017, 0.008, HONEY_PALE, [0.048 + k * 0.005, 0.1 + k * 0.018, 0.017], { rough: 0.2, seg: 8 })));
    shell.add(crock);
    // a honey drip run down the crock and a smear on the counter
    const drips = keep(
      mergedBoxes(
        t,
        [
          { dims: [0.012, 0.06, 0.012], pos: [0.5 + 0.05, counterTop + 0.07, HD - 0.02 + 0.02] },
          { dims: [0.06, 0.005, 0.045], pos: [0.5 + 0.03, counterTop + 0.004, HD + 0.03], rotY: 0.5 },
        ],
        HONEY,
        { rough: 0.16 },
      ),
    );
    drips.userData.lodDetail = true;
    shell.add(drips);

    // ---- A CUT HONEYCOMB FRAME propped against the hatch reveal: a shallow
    // wooden frame filled with a merged grid of little hexagon cells
    const frame = new t.Group();
    frame.position.set(-0.58, counterTop, HD - 0.05);
    frame.rotation.set(-0.35, 0.4, 0);
    frame.add(keep(box(t, [0.22, 0.24, 0.02], OAK, [0, 0.11, 0], { tex: 'wood', repeat: [2, 2], rough: 0.85 })));
    const cells: MergedBoxSpec[] = [];
    for (let r = 0; r < 5; r += 1)
      for (let c = 0; c < 4; c += 1)
        cells.push({
          dims: [0.038, 0.038, 0.012],
          pos: [-0.075 + c * 0.05 + (r % 2 ? 0.025 : 0), 0.035 + r * 0.042, 0.014],
          rotZ: 0.4,
        });
    const cellMesh = keep(mergedBoxes(t, cells, HONEY_PALE, { rough: 0.45 }));
    cellMesh.userData.lodDetail = true;
    frame.add(cellMesh);
    shell.add(frame);
  }

  // =========================================================================
  // 9. THE TOFFEE CAULDRON — a witch's stall needs one, and this one is doing
  //    a job: it is where the apples get dipped. An iron pot on a three-leg
  //    tripod over a low fire, half full of molten toffee, with two
  //    freshly-dipped apples hooked on a rack over it to set.
  //
  //    HOT SUGAR IS NOT A LAMP (EmberfallScenery's rule): the toffee's emissive
  //    only LERPS between a day and a night value and its PointLight keeps a
  //    daylight floor. Compare the eave lantern below, which gates to dark.
  // =========================================================================
  const glowMats: THREE.MeshStandardMaterial[] = [];
  const cauldron = new t.Group();
  cauldron.position.set(HW + 0.34, 0, HD - 0.06);
  cauldron.rotation.y = -0.5;
  g.add(cauldron); // NOT in `shell`: the tripod stands level on the ground
  {
    // the tripod: three iron legs meeting in a ring
    const legs: MergedBoxSpec[] = [];
    for (let k = 0; k < 3; k += 1) {
      const a = (k / 3) * Math.PI * 2 + 0.4;
      const foot = new t.Vector3(Math.cos(a) * 0.17, 0.005, Math.sin(a) * 0.17);
      const top = new t.Vector3(Math.cos(a) * 0.045, 0.32, Math.sin(a) * 0.045);
      const dir = top.clone().sub(foot);
      const m = new t.Matrix4().makeRotationFromQuaternion(
        new t.Quaternion().setFromUnitVectors(new t.Vector3(0, 1, 0), dir.clone().normalize()),
      );
      m.setPosition(foot.clone().addScaledVector(dir, 0.5));
      legs.push({ dims: [0.018, dir.length(), 0.018], matrix: m });
    }
    cauldron.add(keep(mergedBoxes(t, legs, IRON_D, { rough: 0.66, metal: 0.28 })));
    const ring = keep(new t.Mesh(new t.TorusGeometry(0.052, 0.01, 5, 12), mat(t, IRON_D, { rough: 0.6, metal: 0.28 })));
    ring.rotation.x = Math.PI / 2;
    ring.position.set(0, 0.325, 0);
    cauldron.add(ring);
    // THE POT: a belly (squashed sphere), a rolled rim, and two lug handles
    const belly = keep(ball(t, 0.115, 0x2b2822, [0, 0.24, 0], { tex: 'metal', repeat: [2, 2], rough: 0.72, metal: 0.28 }));
    belly.scale.set(1, 0.86, 1);
    cauldron.add(belly);
    const rim = keep(new t.Mesh(new t.TorusGeometry(0.104, 0.014, 6, 16), mat(t, 0x3a352d, { rough: 0.66, metal: 0.28 })));
    rim.rotation.x = Math.PI / 2;
    rim.position.set(0, 0.325, 0);
    cauldron.add(rim);
    for (const sx of [-1, 1] as const) {
      const lug = keep(new t.Mesh(new t.TorusGeometry(0.026, 0.007, 5, 10), mat(t, IRON_D, { rough: 0.6, metal: 0.28 })));
      lug.position.set(sx * 0.108, 0.3, 0);
      lug.rotation.y = Math.PI / 2;
      cauldron.add(lug);
    }
    // THE TOFFEE: a disc just under the rim, plus a lazy bubble or two
    const toffeeMat = new t.MeshStandardMaterial({ color: TOFFEE, emissive: TOFFEE_HOT, emissiveIntensity: GLOW_DAY, roughness: 0.25, metalness: 0 });
    mats.push(toffeeMat);
    glowMats.push(toffeeMat);
    const pool = new t.Mesh(new t.CylinderGeometry(0.095, 0.088, 0.02, 16), toffeeMat);
    pool.position.set(0, 0.313, 0);
    pool.castShadow = false;
    geos.push(pool.geometry);
    cauldron.add(pool);
    // a SWIRL of stirred-in paler toffee across the pool: two shallow arcs, so
    // the surface is not one flat emissive disc
    const swirlMat = new t.MeshStandardMaterial({ color: 0xd8912f, emissive: TOFFEE_HOT, emissiveIntensity: GLOW_DAY * 1.3, roughness: 0.2 });
    mats.push(swirlMat);
    glowMats.push(swirlMat);
    const swirl: PartSpec[] = [];
    for (let k = 0; k < 14; k += 1) {
      const sa = (k / 14) * Math.PI * 3.2 + 0.4;
      const sr = 0.018 + (k / 14) * 0.062;
      swirl.push({
        geo: new t.BoxGeometry(0.026, 0.006, 0.014),
        matrix: mtx(t, [Math.cos(sa) * sr, 0.322, Math.sin(sa) * sr], [0, -sa + Math.PI / 2, 0]),
        uv: [1, 1],
      });
    }
    const swirlMesh = mergedParts(t, swirl, swirlMat);
    swirlMesh.castShadow = false;
    swirlMesh.userData.lodDetail = true;
    geos.push(swirlMesh.geometry);
    cauldron.add(swirlMesh);
    const bubbles: PartSpec[] = [];
    for (let k = 0; k < 5; k += 1) {
      const ba = h(k * 3.7 + 131) * Math.PI * 2;
      const br = 0.02 + h(k * 5.3 + 132) * 0.055;
      const bs = 0.012 + h(k * 7.9 + 133) * 0.012;
      bubbles.push({ geo: new t.IcosahedronGeometry(bs, 1), matrix: mtx(t, [Math.cos(ba) * br, 0.32, Math.sin(ba) * br], [0, 0, 0], [1, 0.6, 1]) });
    }
    const bubMesh = mergedParts(t, bubbles, toffeeMat, false);
    bubMesh.castShadow = false;
    bubMesh.userData.lodDetail = true;
    geos.push(bubMesh.geometry);
    cauldron.add(bubMesh);
    // the FIRE under it: three cold logs and a bed of embers, kept small — the
    // heat is a hint, not a bonfire (and the toffee, not the fire, is the glow)
    const logs: PartSpec[] = [];
    for (let k = 0; k < 3; k += 1) {
      const la = (k / 3) * Math.PI * 2 + 0.9;
      logs.push({
        geo: new t.CylinderGeometry(0.016, 0.019, 0.15, 6, 1),
        matrix: alongDir(t, new t.Vector3(Math.cos(la) * 0.075, 0.018, Math.sin(la) * 0.075), new t.Vector3(-Math.cos(la), 0.1, -Math.sin(la)), 0.15),
        uv: [1, 2],
      });
    }
    cauldron.add(keep(mergedParts(t, logs, mat(t, 0x2e2620, { tex: 'wood', repeat: [1, 2], rough: 0.98 }))));
    const emberMat = new t.MeshStandardMaterial({ color: 0x3a2118, emissive: 0xff7a2a, emissiveIntensity: GLOW_DAY * 0.8, roughness: 0.9 });
    mats.push(emberMat);
    glowMats.push(emberMat);
    const embers: PartSpec[] = [];
    for (let k = 0; k < 9; k += 1) {
      const ea = h(k * 2.3 + 141) * Math.PI * 2;
      const er = h(k * 4.7 + 142) * 0.06;
      const es = 0.011 + h(k * 6.1 + 143) * 0.011;
      embers.push({ geo: new t.IcosahedronGeometry(es, 0), matrix: mtx(t, [Math.cos(ea) * er, 0.012, Math.sin(ea) * er], [0, ea, 0], [1, 0.6, 1]) });
    }
    const emberMesh = mergedParts(t, embers, emberMat);
    emberMesh.castShadow = false;
    geos.push(emberMesh.geometry);
    cauldron.add(emberMesh);
    // THE SETTING RACK: two freshly-dipped apples hanging over the pot to cool
    const rack: MergedBoxSpec[] = [
      { dims: [0.012, 0.34, 0.012], pos: [-0.15, 0.17, -0.13] },
      { dims: [0.012, 0.34, 0.012], pos: [0.15, 0.17, -0.13] },
      { dims: [0.32, 0.012, 0.012], pos: [0, 0.335, -0.13] },
    ];
    cauldron.add(keep(mergedBoxes(t, rack, IRON, { rough: 0.62, metal: 0.28 })));
    for (const sx of [-1, 1] as const) {
      const ap = candyApple(t, 0.034, 0.13, 7.7 + (sx > 0 ? 1 : 2), { simple: true });
      ap.position.set(sx * 0.07, 0.335 - 0.13, -0.13);
      ap.rotation.z = Math.PI; // hung upside-down on its stick, which is how they set
      cauldron.add(ap);
    }
  }
  const toffeeLight = new t.PointLight(TOFFEE_HOT, 0, 1.5, 2);
  toffeeLight.position.set(HW + 0.34, 0.4, HD - 0.06);
  g.add(toffeeLight);

  // =========================================================================
  // 10. THE EAVE LANTERN — the stall's one real lamp, in a wrought-iron cage
  //     off the front. Unlike the toffee this GATES HARD to dark by day: a
  //     lantern with no flame in it is just a glass ball.
  // =========================================================================
  const lampGlass: THREE.MeshStandardMaterial[] = [];
  {
    const lx = -HATCH_HW - 0.18;
    const ly = EAVE - 0.06;
    shell.add(
      keep(
        mergedBoxes(
          t,
          [
            { dims: [0.19, 0.02, 0.02], pos: [lx + 0.07, ly + 0.05, HD + 0.18] },
            { dims: [0.02, 0.1, 0.02], pos: [lx - 0.02, ly, HD + 0.18] },
            { dims: [0.09, 0.016, 0.016], pos: [lx + 0.02, ly + 0.005, HD + 0.18], rotZ: 0.75 },
          ],
          IRON,
          { tex: 'metal', repeat: [2, 1], rough: 0.6, metal: 0.28 },
        ),
      ),
    );
    const lan = new t.Group();
    lan.position.set(lx + 0.15, ly - 0.09, HD + 0.18);
    const cage: MergedBoxSpec[] = [];
    for (let k = 0; k < 4; k += 1) {
      const a = (k / 4) * Math.PI * 2 + 0.38;
      const p0 = new t.Vector3(Math.cos(a) * 0.05, -0.075, Math.sin(a) * 0.05);
      const p1 = new t.Vector3(Math.cos(a) * 0.03, 0.075, Math.sin(a) * 0.03);
      const dir = p1.clone().sub(p0);
      const m = new t.Matrix4().makeRotationFromQuaternion(
        new t.Quaternion().setFromUnitVectors(new t.Vector3(0, 1, 0), dir.clone().normalize()),
      );
      m.setPosition(p0.clone().addScaledVector(dir, 0.5));
      cage.push({ dims: [0.01, dir.length(), 0.01], matrix: m });
    }
    cage.push({ dims: [0.12, 0.016, 0.12], pos: [0, -0.08, 0], rotY: 0.38 });
    cage.push({ dims: [0.105, 0.02, 0.105], pos: [0, 0.082, 0], rotY: 0.38 });
    cage.push({ dims: [0.06, 0.04, 0.06], pos: [0, 0.105, 0], rotY: 0.78 });
    cage.push({ dims: [0.012, 0.06, 0.012], pos: [0, 0.145, 0] });
    lan.add(keep(mergedBoxes(t, cage, IRON, { tex: 'metal', repeat: [1, 1], rough: 0.62, metal: 0.28, bump: 0.04 })));
    const glass = new t.MeshStandardMaterial({ color: GLADE.lampGlass, emissive: LANTERN, emissiveIntensity: 0.05, roughness: 0.3 });
    mats.push(glass);
    lampGlass.push(glass);
    const globe = new t.Mesh(new t.SphereGeometry(0.046, 12, 9), glass);
    globe.castShadow = false;
    geos.push(globe.geometry);
    lan.add(globe);
    const L = new t.PointLight(LANTERN, 0, 3.2, 2);
    lan.add(L);
    lampGlass.push(glass);
    shell.add(lan);
    // the light is a CHILD of the fitting so it follows any placement
    (g.userData as { lanternLight?: THREE.PointLight }).lanternLight = L;
  }
  const lanternLight = (g.userData as { lanternLight?: THREE.PointLight }).lanternLight!;

  // =========================================================================
  // 11. DRESSING — what makes it a witch's cottage in a wood rather than a
  //     kiosk: a straw BEE SKEP on a stone, a besom leaning by the door, a
  //     crate of apples waiting to be dipped, a bundle of dried herbs hung off
  //     the eave, and moss + toadstools planting the whole thing in the glade.
  // =========================================================================
  {
    // ---- the SKEP: a coiled-straw beehive dome, built as real stacked coils
    const skep = new t.Group();
    skep.position.set(-HW - 0.34, 0, HD - 0.1);
    skep.add(keep(cyl(t, 0.15, 0.17, 0.05, STONE_D, [0, 0.025, 0], { tex: 'concrete', repeat: [2, 1], rough: 0.96, seg: 10 })));
    const coils: PartSpec[] = [];
    const NCO = 7;
    for (let k = 0; k < NCO; k += 1) {
      const u = k / NCO;
      const cr = 0.135 * Math.cos(u * Math.PI * 0.46);
      coils.push({
        geo: new t.TorusGeometry(Math.max(0.012, cr), 0.022, 5, 14),
        matrix: mtx(t, [0, 0.06 + u * 0.19, 0], [Math.PI / 2, h(k * 3.1 + 151) * 0.4, 0], [1, 1, 0.8]),
        uv: [3, 1],
      });
    }
    coils.push({ geo: new t.IcosahedronGeometry(0.03, 1), matrix: mtx(t, [0, 0.27, 0]) }); // the crown knot
    skep.add(keep(mergedParts(t, coils, mat(t, THATCH, { tex: 'fabric', repeat: [1, 1], rough: 0.95, bump: 0.06, flat: true }))));
    // the entrance notch, and three bees' worth of dark at it
    skep.add(keep(box(t, [0.05, 0.03, 0.02], 0x241c12, [0, 0.075, 0.125], { rough: 1 })));
    g.add(skep);

    // ---- the BESOM (witch's broom) leaning against the plinth
    const besom = new t.Group();
    besom.position.set(HW - 0.12, 0, HD + 0.3);
    besom.rotation.set(0.34, 0.5, 0.12);
    besom.add(keep(cyl(t, 0.012, 0.016, 0.58, GLADE.bark, [0, 0.29, 0], { tex: 'wood', repeat: [1, 6], rough: 0.9, seg: 7 })));
    const twigs: MergedBoxSpec[] = [];
    for (let k = 0; k < 12; k += 1) {
      const a = (k / 12) * Math.PI * 2;
      const rr = 0.028 + h(k * 2.7 + 161) * 0.02;
      twigs.push({ dims: [0.008, 0.17, 0.008], pos: [Math.cos(a) * rr * 0.6, 0.085, Math.sin(a) * rr * 0.6], rotX: Math.sin(a) * 0.16, rotZ: -Math.cos(a) * 0.16 });
    }
    besom.add(keep(mergedBoxes(t, twigs, GLADE.barkDark, { rough: 0.94 })));
    for (const y of [0.15, 0.185]) {
      const band = keep(new t.Mesh(new t.TorusGeometry(0.026, 0.005, 5, 10), mat(t, GLADE.iron, { rough: 0.7, metal: 0.28 })));
      band.rotation.x = Math.PI / 2;
      band.position.set(0, y, 0);
      band.userData.lodDetail = true;
      besom.add(band);
    }
    g.add(besom);

    // ---- a CRATE of undipped apples (green, on purpose: the contrast is what
    // tells you the red ones on the counter have been dipped)
    const crate = new t.Group();
    crate.position.set(-HW - 0.06, 0, HD + 0.34);
    crate.rotation.y = 0.35;
    const slats: MergedBoxSpec[] = [];
    for (let k = 0; k < 4; k += 1) slats.push({ dims: [0.24, 0.028, 0.012], pos: [0, 0.03 + k * 0.05, 0.085], repeat: [2, 1] });
    for (let k = 0; k < 4; k += 1) slats.push({ dims: [0.24, 0.028, 0.012], pos: [0, 0.03 + k * 0.05, -0.085], repeat: [2, 1] });
    for (const sx of [-1, 1] as const) slats.push({ dims: [0.012, 0.19, 0.18], pos: [sx * 0.12, 0.095, 0], repeat: [1, 2] });
    slats.push({ dims: [0.24, 0.012, 0.18], pos: [0, 0.006, 0], repeat: [2, 2] });
    crate.add(keep(mergedBoxes(t, slats, OAK_L, { tex: 'wood', repeat: [1, 1], rough: 0.86, bump: 0.03 })));
    for (let k = 0; k < 6; k += 1) {
      const ax = -0.075 + (k % 3) * 0.075;
      const az = -0.04 + Math.floor(k / 3) * 0.08;
      const raw = keep(ball(t, 0.036, k % 2 ? 0x7d9c3e : 0x94a83c, [ax, 0.2, az], { rough: 0.42 }));
      raw.scale.set(1, 1.06, 0.98);
      crate.add(raw);
      crate.add(keep(cyl(t, 0.004, 0.005, 0.02, GLADE.barkDark, [ax, 0.238, az], { rough: 0.9, seg: 5 })));
    }
    g.add(crate);

    // ---- HERB BUNDLES hung upside-down off the eave, which is exactly what a
    // cottage that cooks does with its herbs
    for (let b = 0; b < 2; b += 1) {
      const bx = 0.2 + b * 0.26;
      const bundle = new t.Group();
      bundle.position.set(bx, EAVE - 0.14, HD + 0.22);
      bundle.rotation.z = (h(b * 5.9 + 171) - 0.5) * 0.3;
      bundle.add(keep(cyl(t, 0.005, 0.005, 0.06, STICK, [0, 0.03, 0], { rough: 0.85, seg: 5 })));
      const stems: MergedBoxSpec[] = [];
      for (let k = 0; k < 9; k += 1) {
        const a = (k / 9) * Math.PI * 2;
        const rr = 0.012 + h(k * 3.3 + b * 17) * 0.014;
        stems.push({ dims: [0.009, 0.14, 0.009], pos: [Math.cos(a) * rr, -0.07, Math.sin(a) * rr], rotX: Math.sin(a) * 0.2, rotZ: -Math.cos(a) * 0.2 });
      }
      bundle.add(keep(mergedBoxes(t, stems, b ? MOSS_D : GLADE.fern, { tex: 'leaf', repeat: [1, 2], rough: 0.9 })));
      bundle.add(keep(cyl(t, 0.02, 0.02, 0.012, CLOTH, [0, -0.005, 0], { rough: 0.8, seg: 8 }))); // the tie
      bundle.userData.lodDetail = true;
      shell.add(bundle);
    }

    // ---- the GLADE FLOOR: loam, moss cushions and three little toadstools, so
    // the cottage is standing in a wood and not on a lawn
    const floor: PartSpec[] = [];
    for (let i = 0; i < 16; i += 1) {
      const fa = h(i * 2.71 + 181) * Math.PI * 2;
      const fr = 0.3 + h(i * 4.31 + 182) * 0.9;
      const fs = 0.16 + h(i * 6.53 + 183) * 0.18;
      floor.push({
        geo: new t.IcosahedronGeometry(1, 0),
        matrix: mtx(t, [Math.cos(fa) * fr, 0.008, Math.sin(fa) * fr * 0.7], [0, h(i * 8.7) * 3, 0], [fs, 0.03, fs * 0.8]),
        uv: [1, 1],
      });
    }
    const fm = keep(mergedParts(t, floor, mat(t, GLADE.loam, { tex: 'concrete', repeat: [3, 3], rough: 1, bump: 0.05, flat: true })));
    fm.castShadow = false;
    g.add(fm);
    const mossF: PartSpec[] = [];
    for (let i = 0; i < 20; i += 1) {
      const ma = h(i * 3.11 + 191) * Math.PI * 2;
      const mr = 0.4 + h(i * 5.17 + 192) * 0.85;
      const ms = 0.06 + h(i * 7.23 + 193) * 0.07;
      mossF.push({
        geo: new t.IcosahedronGeometry(1, 0),
        matrix: mtx(t, [Math.cos(ma) * mr, 0.018, Math.sin(ma) * mr * 0.75], [0, h(i * 9.4) * 3, 0], [ms, ms * 0.3, ms * 0.8]),
        uv: [1, 1],
      });
    }
    const mf = keep(mergedParts(t, mossF, mat(t, MOSS, { tex: 'grass', repeat: [1, 1], rough: 0.96, bump: 0.06, flat: true })));
    mf.castShadow = false;
    g.add(mf);
    // three toadstools at the cottage foot: the world's own ground cover
    for (let i = 0; i < 3; i += 1) {
      const ta = 2.4 + h(i * 4.9 + 201) * 2.0;
      const tr = 0.75 + h(i * 6.7 + 202) * 0.35;
      const tx = Math.cos(ta) * tr;
      const tz = Math.abs(Math.sin(ta)) * tr * 0.6 + HD * 0.4;
      const cr = 0.035 + h(i * 8.3 + 203) * 0.022;
      g.add(keep(cyl(t, cr * 0.34, cr * 0.44, cr * 1.7, GLADE.stipe, [tx, cr * 0.85, tz], { rough: 0.94, seg: 7 })));
      const cap = new t.Mesh(new t.SphereGeometry(cr, 9, 5, 0, Math.PI * 2, 0, Math.PI * 0.56), mat(t, i % 2 ? GLADE.capRed : GLADE.capViolet, { rough: 0.72 }));
      cap.position.set(tx, cr * 1.7, tz);
      cap.scale.set(1, 0.72, 1);
      cap.castShadow = true;
      geos.push(cap.geometry);
      mats.push(cap.material as THREE.Material);
      g.add(cap);
    }
  }

  // =========================================================================
  // 12. THE CHIMNEY SMOKE — the cottage is BAKING, and that wisp is the cue
  //     that sells a cake shop. ONE emitter, 30 particles, non-additive (smoke
  //     has to occlude), drifting up and away.
  // =========================================================================
  let smoke: ReturnType<typeof buildEmitter> | null = null;
  if (wantFx) {
    smoke = buildEmitter(t, {
      max: 30,
      rate: 7,
      life: 3.0,
      lifeVar: 0.7,
      velocity: [0.06, 0.28, -0.03],
      spread: 0.07,
      gravity: -0.02, // buoyant
      size: 0.07,
      sizeEnd: 0.3,
      color: 0xd8d2c6,
      colorEnd: 0x8e8a80,
      opacity: 0.3,
    });
    smoke.setOrigin(smokeAt[0], smokeAt[1], smokeAt[2]);
    shell.add(smoke.points);
  }

  // ---- optional decorative queueing guest ---------------------------------
  let peep: ReturnType<typeof buildPeep> | null = null;
  if (opts.withGuest) {
    peep = buildPeep(t, { shirt: 0x4e6b3a, expression: 'happy' });
    peep.group.scale.setScalar(0.5);
    peep.group.position.set(0.16, 0, HD + 0.78);
    peep.group.rotation.y = Math.PI;
    // the queueing guest is already holding one, which is the fastest way to
    // read what this shop sells
    const held = buildHeldCandyApple(t);
    const anchor = new t.Group();
    anchor.position.set(0.03, -0.37, 0.15); // GameManager's own holdSpot, right hand
    anchor.add(held);
    peep.armR.add(anchor);
    g.add(peep.group);
  }

  const update = (time: number) => {
    const nk = nightKOf(g);
    // THE TOFFEE: lerped, never gated — hot sugar over a fire is not a lamp
    const k = GLOW_DAY + (GLOW_NIGHT - GLOW_DAY) * nk;
    const shimmer = 1 + 0.08 * Math.sin(time * 1.7) + 0.05 * Math.sin(time * 3.1 + 0.9);
    // [0] the toffee pool, [1] the swirl (a shade hotter), [2] the embers
    // (dimmer — the fire is a hint, the toffee is the glow)
    const share = [1, 1.3, 0.75];
    for (let i = 0; i < glowMats.length; i += 1) glowMats[i].emissiveIntensity = k * (share[i] ?? 1) * shimmer;
    toffeeLight.intensity = (0.3 + 0.85 * nk) * shimmer;
    // THE LANTERN: a real lamp, dark by day
    const ease = nk * nk * (3 - 2 * nk);
    const flick = 1 + 0.07 * Math.sin(time * 4.9) + 0.05 * Math.sin(time * 8.3 + 1.1);
    for (const gl of lampGlass) gl.emissiveIntensity = 0.05 + (1.2 * flick - 0.05) * ease;
    lanternLight.intensity = ease * 0.85 * flick;
    // THE GIANT APPLE reads as a LIT SIGN after dark and as plain painted toffee
    // by day: a self-lit apple at noon would look like a bauble. Kept low (0.32)
    // — this is "still findable in the dark", not a lamp, and the piece already
    // owns exactly one lamp (the eave lantern) and one hot surface (the toffee).
    for (const sm of signMats) sm.emissiveIntensity = 0.32 * ease;
    smoke?.update(time);
    if (peep) peep.group.position.y = Math.abs(Math.sin(time * 2)) * 0.01;
  };

  return {
    group: g,
    update,
    dispose() {
      smoke?.dispose();
      toffeeLight.dispose();
      lanternLight.dispose();
      mats.forEach((m) => m.dispose());
      geos.forEach((x) => {
        if (!x.userData.shared) x.dispose();
      });
    },
  };
}

export interface HoneywitchProps {
  /** decorative queueing guest, already carrying a candied apple (preview
   *  flavour — in a composed park the GameManager's real guests walk up) */
  withGuest?: boolean;
  /** the chimney's wisp of baking smoke (default true) */
  effects?: boolean;
  seed?: number;
}

/** `<Honeywitch>` — Thornwick Glade's cottage-counter stall, a composable stall
 *  (components/Park/Context.md): mounts at `position`/`rotation`; inside a
 *  `<Park>`, `register` (+ optional `name`/`price`/`value`) registers a selling
 *  FOOD stall with the GameManager — the serving front faces local +z, with the
 *  attach point 0.72 u out that way. Buyers walk away eating a real CANDIED
 *  APPLE ON A STICK (`heldItem`: buildHeldCandyApple), threaded through the
 *  fist, not the manager's generic burger. */
export const Honeywitch = composableStall<HoneywitchProps>(
  'Honeywitch',
  (t, { withGuest = false, effects = true, seed = 1 }) => buildHoneywitch(t, { withGuest, effects, seed }),
  { name: 'The Honeywitch', item: 'food', price: 4, value: 6, heldItem: buildHeldCandyApple },
);
